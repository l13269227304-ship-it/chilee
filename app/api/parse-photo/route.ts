import { NextRequest, NextResponse } from 'next/server'

const CAT_LIST = ['面食','饺子包子','火锅','麻辣烫','烧烤','米饭','汉堡炸鸡','日料','韩餐','西餐','轻食','咖啡','奶茶','其他']

export async function POST(req: NextRequest) {
  const { imageBase64, mimeType } = await req.json()
  if (!imageBase64) return NextResponse.json({ error: '缺少图片' }, { status: 400 })

  const prompt = `请识别这张餐厅/店铺照片，提取以下信息。如果某项信息图中不可见，填写"无"。

严格按此格式回复，不要输出其他任何内容：
名称：[餐厅或店铺名称]
品类：[从以下选项中选一个最接近的：${CAT_LIST.join('、')}]
地址：[图中可见的地址或门牌号，没有则填无]`

  try {
    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.AI_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}` }
            },
            { type: 'text', text: prompt }
          ]
        }],
        max_tokens: 200,
        temperature: 0.1,
      })
    })

    if (!resp.ok) {
      const err = await resp.text()
      return NextResponse.json({ error: `AI 调用失败: ${err}` }, { status: 500 })
    }

    const data = await resp.json()
    const text = data.choices?.[0]?.message?.content || ''

    const name     = (text.match(/名称[：:]\s*(.+)/)?.[1] || '').trim().replace(/^无$/, '')
    const category = (text.match(/品类[：:]\s*(.+)/)?.[1] || '').trim().replace(/^无$/, '')
    const address  = (text.match(/地址[：:]\s*(.+)/)?.[1] || '').trim().replace(/^无$/, '')

    return NextResponse.json({ name, category: CAT_LIST.includes(category) ? category : '其他', address })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
