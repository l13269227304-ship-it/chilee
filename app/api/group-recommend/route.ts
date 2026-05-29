import { NextRequest, NextResponse } from 'next/server'

const CAT_RULES = [
  { cat: '面食',     keys: ['面','拉面','刀削','米线','螺蛳粉','河粉','粉'] },
  { cat: '饺子包子', keys: ['饺','包子','馄饨','抄手','云吞','锅贴'] },
  { cat: '火锅',     keys: ['火锅','串串'] },
  { cat: '麻辣烫',   keys: ['麻辣烫','麻辣拌','冒菜','钵钵鸡'] },
  { cat: '烧烤',     keys: ['烧烤','烤肉','烤串','炭火'] },
  { cat: '米饭',     keys: ['盖浇','盖饭','炒饭','黄焖','砂锅','煲仔','快餐','便当'] },
  { cat: '汉堡炸鸡', keys: ['汉堡','肯德基','KFC','麦当劳','炸鸡','鸡排'] },
  { cat: '日料',     keys: ['寿司','日料','刺身','居酒屋','天妇罗'] },
  { cat: '韩餐',     keys: ['韩','石锅','部队锅','泡菜'] },
  { cat: '西餐',     keys: ['Pizza','披萨','牛排','西餐','意面'] },
  { cat: '轻食',     keys: ['沙拉','轻食','健康'] },
  { cat: '咖啡',     keys: ['咖啡','Coffee','星巴克','瑞幸'] },
  { cat: '奶茶',     keys: ['奶茶','喜茶','蜜雪','霸王'] },
]
function categorize(name: string) {
  for (const r of CAT_RULES) if (r.keys.some(k => name.includes(k))) return r.cat
  return '其他'
}

interface Member { nickname: string; avoidCats: string[]; dietaryNotes: string; recentCats: string[] }
interface Restaurant { id: string; name: string; distance: string }

export async function POST(req: NextRequest) {
  const { groupName, members, restaurants, period, weather } = await req.json() as {
    groupName: string
    members: Member[]
    restaurants: Restaurant[]
    period: string
    weather: string
  }

  if (!members?.length || !restaurants?.length) {
    return NextResponse.json({ error: '缺少成员或餐厅数据' }, { status: 400 })
  }

  // 汇总所有成员的忌口品类（取并集）
  const allAvoid = [...new Set(members.flatMap(m => m.avoidCats || []))]

  // 过滤掉任意成员忌口的餐厅
  const filtered = restaurants.filter(r => {
    const cat = categorize(r.name)
    return !allAvoid.includes(cat)
  })

  if (filtered.length === 0) {
    return NextResponse.json({ error: '忌口太多，附近没有适合所有人的餐厅' }, { status: 200 })
  }

  const memberLines = members.map(m => {
    const avoid = m.avoidCats?.length ? `忌口：${m.avoidCats.join('、')}` : '无忌口'
    const notes = m.dietaryNotes ? `；${m.dietaryNotes}` : ''
    const recent = m.recentCats?.length ? `；最近常吃：${[...new Set(m.recentCats)].slice(0,4).join('、')}` : ''
    return `- ${m.nickname}：${avoid}${notes}${recent}`
  }).join('\n')

  const restLines = filtered.map(r =>
    `- ${r.name}【${categorize(r.name)}】${r.distance === '附近' ? r.distance : `${r.distance}米`}`
  ).join('\n')

  const prompt = `你是一个智能选餐助手，需要为一个饭搭子群组推荐今天吃什么。

【群组：${groupName}】共 ${members.length} 人

【各成员情况】
${memberLines}

【用餐信息】
时段：${period}，天气：${weather}

【可选餐厅】（已排除忌口品类）
${restLines}

【推荐原则】
1. 必须照顾所有人的忌口，不能推荐任何人不吃的品类
2. 尽量回避最近大家都常吃的品类，追求新鲜感
3. 综合距离、品类多样性做出最佳选择
4. 理由要点出为什么适合这个群组

严格按此格式回复，不要输出其他内容：
推荐：[餐厅名]
理由：[两句话，说明为什么这家适合群组所有人]`

  try {
    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.AI_KEY}` },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200, temperature: 0.7
      })
    })
    if (!resp.ok) throw new Error(String(resp.status))
    const data = await resp.json()
    const text = data.choices?.[0]?.message?.content || ''
    const name   = (text.match(/推荐[：:]\s*(.+)/)?.[1] || '').trim().replace(/[【】\[\]「」]/g, '')
    const reason = (text.match(/理由[：:]\s*([\s\S]+)/)?.[1] || text).trim()
    return NextResponse.json({ name, reason })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
