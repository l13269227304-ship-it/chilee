'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { MealHistory, Blacklist, CustomRestaurant } from '@/lib/types'

declare global { interface Window { AMap: any } }

const AMAP_KEY = 'aebe845070883bd4481e5e2edf4c3da5'
const AI_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions'
const AI_KEY = 'sk-bba06a094d744521b6a1bad4fbb29786'
const AI_MODEL = 'deepseek-chat'

const CAT_RULES = [
  { cat: '面食',     keys: ['面','拉面','刀削','米线','螺蛳粉','河粉','粉'] },
  { cat: '饺子包子', keys: ['饺','包子','馄饨','抄手','云吞','锅贴','煎饼'] },
  { cat: '火锅',     keys: ['火锅','串串'] },
  { cat: '麻辣烫',   keys: ['麻辣烫','麻辣拌','冒菜','钵钵鸡'] },
  { cat: '烧烤',     keys: ['烧烤','烤肉','烤串','炭火','撸串'] },
  { cat: '米饭',     keys: ['盖浇','盖饭','炒饭','黄焖','砂锅','煲仔','快餐','便当'] },
  { cat: '汉堡炸鸡', keys: ['汉堡','肯德基','KFC','麦当劳','炸鸡','鸡排'] },
  { cat: '日料',     keys: ['寿司','日料','刺身','居酒屋','天妇罗','章鱼'] },
  { cat: '韩餐',     keys: ['韩','石锅','部队锅','泡菜'] },
  { cat: '西餐',     keys: ['Pizza','披萨','意大利','牛排','西餐','意面','三明治'] },
  { cat: '轻食',     keys: ['沙拉','轻食','健康'] },
  { cat: '咖啡',     keys: ['咖啡','Coffee','Café','星巴克','瑞幸','Manner'] },
  { cat: '奶茶',     keys: ['奶茶','喜茶','蜜雪','茶颜','霸王','贡茶'] },
]
function categorize(name: string) {
  for (const r of CAT_RULES) if (r.keys.some(k => name.includes(k))) return r.cat
  return '其他'
}

function getMealPeriod() {
  const h = new Date().getHours()
  if (h >= 11 && h < 14) return '午餐'
  if (h >= 17 && h < 21) return '晚餐'
  if (h >= 7  && h < 10) return '早餐'
  return '加餐'
}

type State = 'idle' | 'loading' | 'result'
interface Restaurant { id: string; name: string; type: string; distance: string; location: { lng: number; lat: number } | null }

export default function HomePage() {
  const router = useRouter()
  const mapRef = useRef<any>(null)
  const mapElRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<State>('idle')
  const [result, setResult] = useState<{ name: string; reason: string; cat: string } | null>(null)
  const [weatherText, setWeatherText] = useState('获取中')
  const [weatherIcon, setWeatherIcon] = useState('🌤')
  const [mealPeriod, setMealPeriod] = useState('—')
  const [locInput, setLocInput] = useState('')
  const [radius, setRadius] = useState('1000')
  const [history, setHistory] = useState<MealHistory[]>([])
  const [blacklist, setBlacklist] = useState<Blacklist[]>([])
  const [customRestaurants, setCustomRestaurants] = useState<CustomRestaurant[]>([])
  const [histOpen, setHistOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [userId, setUserId] = useState<string | null>(null)

  const restaurantsRef = useRef<Restaurant[]>([])
  const sessionShownRef = useRef<string[]>([])
  const sessionRejectedRef = useRef<Record<string, number>>({})
  const selectedRef = useRef<Restaurant | null>(null)
  const bowlLoopRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const supabase = createClient()

  // ── 显示 toast ──
  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2400)
  }, [])

  // ── 加载用户数据 ──
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = '/login'; return }
      setUserId(data.user.id)
      loadCloudData(data.user.id)
    })
    setMealPeriod(getMealPeriod())
    initMap()
  }, [])

  async function loadCloudData(uid: string) {
    const [{ data: hist }, { data: bl }, { data: custom }] = await Promise.all([
      supabase.from('meal_history').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(30),
      supabase.from('blacklist').select('*').eq('user_id', uid),
      supabase.from('custom_restaurants').select('*').eq('user_id', uid),
    ])
    if (hist)   setHistory(hist)
    if (bl)     setBlacklist(bl)
    if (custom) setCustomRestaurants(custom)
  }

  // ── 地图初始化 ──
  function initMap() {
    const s = document.createElement('script')
    s.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}&plugin=AMap.Geolocation`
    s.onload = startMap
    document.head.appendChild(s)
  }

  function startMap() {
    const AMap = window.AMap
    mapRef.current = new AMap.Map(mapElRef.current, { zoom: 16, resizeEnable: true })
    new AMap.Geolocation({ enableHighAccuracy: true, timeout: 8000 })
      .getCurrentPosition((status: string, result: any) => {
        if (status === 'complete') {
          const { lng, lat } = result.position
          mapRef.current.setCenter([lng, lat])
          loadNearby(lng, lat)
          if (result.addressComponent?.adcode) loadWeather(result.addressComponent.adcode)
        } else {
          AMap.plugin('AMap.CitySearch', () => {
            new AMap.CitySearch().getLocalCity((st: string, r: any) => {
              if (st === 'complete' && r.adcode) loadWeather(r.adcode)
              if (st === 'complete' && r.bounds) mapRef.current.setBounds(r.bounds)
            })
          })
        }
      })
  }

  const W_ICONS: Record<string, string> = { '晴': '☀️', '少云': '🌤', '多云': '☁️', '阴': '🌫', '小雨': '🌦', '中雨': '🌧', '大雨': '🌧', '暴雨': '⛈', '雷阵雨': '⛈', '小雪': '🌨', '中雪': '❄️', '大雪': '❄️', '霾': '😷' }

  async function loadWeather(adcode: string) {
    try {
      const d = await fetch(`/api/weather?adcode=${adcode}`).then(r => r.json())
      if (d.status === '1' && d.lives?.[0]) {
        const { weather, temperature } = d.lives[0]
        setWeatherIcon(W_ICONS[weather] || '🌤')
        setWeatherText(`${weather} ${temperature}°C`)
      }
    } catch { setWeatherText('—') }
  }

  async function loadNearby(lng: number, lat: number) {
    try {
      const d = await fetch(`/api/restaurants?lng=${lng}&lat=${lat}&radius=${radius}`).then(r => r.json())
      if (d.status === '1' && d.pois?.length > 0) {
        const blIds = new Set(blacklist.map(b => b.restaurant_id))
        restaurantsRef.current = d.pois
          .filter((p: any) => !blIds.has(p.id))
          .map((p: any) => {
            const [pLng, pLat] = (p.location || '').split(',').map(Number)
            return { id: p.id, name: p.name, type: p.type || '', distance: p.distance, location: pLng && pLat ? { lng: pLng, lat: pLat } : null }
          })
        addMapMarkers(restaurantsRef.current, [lng, lat])
      }
    } catch { /* silent */ }
  }

  function addMapMarkers(list: Restaurant[], center: [number, number]) {
    const AMap = window.AMap
    new AMap.Marker({ position: center, map: mapRef.current, title: '我的位置',
      icon: new AMap.Icon({ size: new AMap.Size(20, 20), image: 'https://webapi.amap.com/theme/v1.3/markers/n/mark_b.png', imageSize: new AMap.Size(20, 20) }) })
    list.forEach(r => {
      if (!r.location) return
      new AMap.Marker({ position: [r.location.lng, r.location.lat], title: r.name, map: mapRef.current })
    })
  }

  async function searchLocation() {
    if (!locInput.trim()) { showToast('请输入地址'); return }
    showToast('搜索中…')
    try {
      const d = await fetch(`/api/geocode?address=${encodeURIComponent(locInput)}`).then(r => r.json())
      if (d.status === '1' && d.geocodes?.length > 0) {
        const [lng, lat] = d.geocodes[0].location.split(',').map(Number)
        mapRef.current.setCenter([lng, lat]); mapRef.current.setZoom(16)
        restaurantsRef.current = []
        loadNearby(lng, lat)
        if (d.geocodes[0].adcode) loadWeather(d.geocodes[0].adcode)
      } else showToast('地址未找到')
    } catch { showToast('搜索失败') }
  }

  // ── 碗动画 ──
  function startBowlAnim() {
    const dice = document.getElementById('fallingDice')
    const bowl = document.getElementById('bowlSvg')
    const parts = document.getElementById('bowlParticles')
    resetBowl()
    setTimeout(() => {
      dice?.classList.add('drop')
      setTimeout(() => {
        bowl?.classList.add('shake')
        parts?.querySelectorAll('span').forEach(s => s.classList.add('burst'))
        setTimeout(() => {
          bowl?.classList.remove('shake')
          bowl?.classList.add('pulse')
          bowlLoopRef.current = setInterval(() => {
            if (!dice) return
            dice.classList.remove('drop')
            void (dice as HTMLElement).offsetWidth
            dice.classList.add('drop')
          }, 2200)
        }, 600)
      }, 980)
    }, 200)
  }

  function stopBowlAnim() {
    if (bowlLoopRef.current) clearInterval(bowlLoopRef.current)
    resetBowl()
  }

  function resetBowl() {
    document.getElementById('fallingDice')?.classList.remove('drop')
    const bowl = document.getElementById('bowlSvg')
    bowl?.classList.remove('shake', 'pulse')
    document.getElementById('bowlParticles')?.querySelectorAll('span').forEach(s => s.classList.remove('burst'))
    const fly = document.getElementById('nameFlyout') as HTMLElement | null
    if (fly) { fly.classList.remove('rise'); fly.textContent = ''; fly.style.opacity = '0' }
  }

  function flyoutThenResult(name: string, reason: string, cat: string) {
    stopBowlAnim()
    const bowl = document.getElementById('bowlSvg')
    bowl?.classList.add('shake')
    setTimeout(() => bowl?.classList.remove('shake'), 600)
    const fly = document.getElementById('nameFlyout') as HTMLElement | null
    if (fly) {
      fly.textContent = name; fly.style.opacity = '0'
      void fly.offsetWidth; fly.classList.add('rise')
    }
    setTimeout(() => {
      setResult({ name, reason, cat })
      setState('result')
    }, 950)
  }

  // ── AI 推荐 ──
  async function getAIRecommend() {
    if (selectedRef.current) {
      const cat = categorize(selectedRef.current.name)
      sessionRejectedRef.current[cat] = (sessionRejectedRef.current[cat] || 0) + 1
    }
    const blIds = new Set(blacklist.map(b => b.restaurant_id))
    const blNames = new Set(blacklist.map(b => b.restaurant_name))
    // 合并地图餐厅 + 自定义餐厅
    const customPool: Restaurant[] = customRestaurants
      .filter(r => !blNames.has(r.name))
      .map(r => ({ id: `custom_${r.id}`, name: r.name, type: r.category || '其他', distance: '附近', location: null }))
    const mapPool = restaurantsRef.current.filter(r => !blIds.has(r.id))
    const fullPool = [...mapPool, ...customPool]
    let avail = fullPool.filter(r => !sessionShownRef.current.includes(r.id))
    if (avail.length === 0) {
      sessionShownRef.current = []
      avail = fullPool
      showToast('都推荐过了，重新开始')
    }
    if (avail.length === 0) { showToast('附近没有找到餐厅，请搜索其他地址'); return }

    setState('loading')
    startBowlAnim()

    const period = getMealPeriod()
    const catStats = history.slice(0, 14).reduce((acc: Record<string, number>, h) => {
      const c = categorize(h.restaurant_name); acc[c] = (acc[c] || 0) + 1; return acc
    }, {})
    const catLine = Object.entries(catStats).length
      ? Object.entries(catStats).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c}×${n}`).join('、')
      : '（暂无）'
    const rejLine = Object.entries(sessionRejectedRef.current).length
      ? Object.entries(sessionRejectedRef.current).map(([c, n]) => `${c}（已跳过${n}次）`).join('、')
      : '（无）'
    const restLines = avail.map(r => {
      const isCustom = r.id.startsWith('custom_')
      return `- ${r.name}【${categorize(r.name)}】${isCustom ? '用户收藏' : `${r.distance}米`}`
    }).join('\n')
    const histLines = history.length
      ? history.slice(0, 7).map(h => `- ${h.date} ${h.period}：${h.restaurant_name}【${categorize(h.restaurant_name)}】`).join('\n')
      : '（暂无，用户可能是首次使用，请勿推断或编造用户最近吃过什么，直接基于天气和时段推荐即可）'

    const prompt = `你是一个智能选餐助手，目标是让用户今天的选择既好吃又不重样。

【用餐信息】
- 时段：${period}
- 天气：${weatherText}

【近14天品类分布】
${catLine}

【本轮已跳过的品类】
${rejLine}

【近期用餐记录】
${histLines}

【黑名单】
${blacklist.length ? blacklist.map(b => `- ${b.restaurant_name}`).join('\n') : '（无）'}

【可选餐厅】
${restLines}

【推荐原则】
1. 本轮已跳过的品类本次必须回避
2. 近期高频品类尽量少推
3. 距离和新鲜感综合考量
4. 结合天气时段给出有温度的理由

严格按此格式回复，不要输出其他内容：
推荐：[餐厅名]
理由：[两句话]`

    try {
      const resp = await fetch(AI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AI_KEY}` },
        body: JSON.stringify({ model: AI_MODEL, messages: [{ role: 'user', content: prompt }], max_tokens: 200, temperature: 0.7 })
      })
      if (!resp.ok) throw new Error(String(resp.status))
      const data = await resp.json()
      parseAndShow(data.choices?.[0]?.message?.content || '', avail)
    } catch {
      setState('idle'); stopBowlAnim(); showToast('AI 调用失败，请重试')
    }
  }

  function parseAndShow(text: string, avail: Restaurant[]) {
    const name = (text.match(/推荐[：:]\s*(.+)/)?.[1] || '').trim().replace(/[【】\[\]「」]/g, '')
    const reason = (text.match(/理由[：:]\s*([\s\S]+)/)?.[1] || text).trim()
    if (!name) { setState('idle'); stopBowlAnim(); showToast('AI 返回格式有误，请重试'); return }
    let found = avail.find(r => r.name.includes(name) || name.includes(r.name))
    if (!found || sessionShownRef.current.includes(found.id)) {
      const fb = avail.filter(r => !sessionShownRef.current.includes(r.id))
      if (fb.length) found = fb[Math.floor(Math.random() * fb.length)]
    }
    if (found) { selectedRef.current = found; sessionShownRef.current.push(found.id) }
    flyoutThenResult(found?.name || name, reason, categorize(found?.name || name))
  }

  // ── 确认 / 黑名单 ──
  async function confirmChoice() {
    if (!selectedRef.current || !userId) { showToast('请先让 AI 选择'); return }
    const now = new Date()
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const period = getMealPeriod()
    const row = { user_id: userId, restaurant_name: selectedRef.current.name, restaurant_id: selectedRef.current.id, is_custom: false, period, date }
    const { data } = await supabase.from('meal_history').insert(row).select().single()
    if (data) setHistory(prev => [data, ...prev].slice(0, 30))
    showToast(`已记录：${period} 吃了「${selectedRef.current.name}」`)
    sessionShownRef.current = []; sessionRejectedRef.current = {}
    selectedRef.current = null; setState('idle')
    setHistOpen(true)
  }

  async function blacklistChoice() {
    if (!selectedRef.current || !userId) return
    const row = { user_id: userId, restaurant_name: selectedRef.current.name, restaurant_id: selectedRef.current.id }
    await supabase.from('blacklist').insert(row)
    setBlacklist(prev => [...prev, { ...row, id: '', created_at: '' }])
    restaurantsRef.current = restaurantsRef.current.filter(r => r.id !== selectedRef.current!.id)
    showToast(`「${selectedRef.current.name}」已加入黑名单`)
    selectedRef.current = null; setState('idle')
    getAIRecommend()
  }

  async function deleteHistory(id: string) {
    await supabase.from('meal_history').delete().eq('id', id)
    setHistory(prev => prev.filter(h => h.id !== id))
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--card)', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ flexShrink: 0, background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(20px)', borderBottom: '0.5px solid var(--sep)', padding: '14px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text1)', display: 'flex', alignItems: 'center', gap: 7 }}>
          今天吃
          <span style={{ position: 'relative', display: 'inline-block' }}>
            <span style={{ color: '#b0aca6', fontWeight: 600 }}>什么呢</span>
            <svg style={{ position: 'absolute', left: -3, top: '50%', transform: 'translateY(-50%)', width: 'calc(100% + 6px)', height: 14, pointerEvents: 'none' }} viewBox="0 0 72 14" fill="none">
              <path d="M2 10 Q17 3 36 7 Q55 11 70 5" stroke="#2d5be3" strokeWidth="2.8" strokeLinecap="round"/>
            </svg>
          </span>
          <em style={{ fontStyle: 'italic', color: 'var(--accent)', fontFamily: "'STKaiti','KaiTi',Georgia,serif" }}>AI帮选</em>
        </div>
        <div style={{ position: 'absolute', right: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => router.push('/restaurants')} style={{ fontSize: 11, color: 'var(--blue)', background: 'none', border: '0.5px solid rgba(45,91,227,.3)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontWeight: 500 }}>我的餐厅</button>
          <button onClick={handleLogout} style={{ fontSize: 11, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer' }}>退出</button>
        </div>
      </div>

      {/* Map */}
      <div ref={mapElRef} style={{ height: '25vh', width: '100%', flexShrink: 0 }} />

      {/* Controls row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderBottom: '0.5px solid var(--sep)', flexShrink: 0 }}>
        <span style={{ fontSize: 13, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{weatherIcon} {weatherText}</span>
        <span style={{ color: 'var(--text3)', fontSize: 11 }}>·</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text1)', whiteSpace: 'nowrap' }}>{mealPeriod}</span>
        <input value={locInput} onChange={e => setLocInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchLocation()}
          placeholder="搜索地址" style={{ flex: 1, minWidth: 0, border: 'none', background: 'var(--bg)', borderRadius: 7, padding: '6px 10px', fontSize: 13, color: 'var(--text1)', outline: 'none' }} />
        <select value={radius} onChange={e => setRadius(e.target.value)} style={{ border: 'none', background: 'var(--bg)', borderRadius: 7, padding: '6px 4px', fontSize: 12, color: 'var(--text2)', outline: 'none' }}>
          <option value="500">500m</option><option value="1000">1km</option><option value="1500">1.5km</option><option value="2000">2km</option>
        </select>
        <button onClick={searchLocation} style={{ background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 12px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>搜索</button>
      </div>

      {/* Center area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 16px', position: 'relative', minHeight: 160 }}>

        {/* Idle: Dice button */}
        {state === 'idle' && (
          <button onClick={getAIRecommend} style={{ width: 130, height: 130, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, position: 'relative' }}>
            <style>{`
              @keyframes halo{0%,100%{transform:scale(1);opacity:.9}50%{transform:scale(1.5);opacity:0}}
              @keyframes breathe{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(0,122,255,.45),0 8px 28px rgba(0,122,255,.38)}50%{transform:scale(1.07);box-shadow:0 0 0 10px rgba(0,122,255,0),0 12px 40px rgba(0,122,255,.55)}}
              @keyframes rotateGlow{to{transform:rotate(360deg)}}
              .dice-halo{position:absolute;top:50%;left:50%;width:100px;height:100px;margin:-50px 0 0 -50px;border-radius:50%;background:rgba(0,122,255,.22);animation:halo 2.6s ease-in-out infinite;pointer-events:none}
              .dice-ring{width:90px;height:90px;border-radius:50%;background:radial-gradient(circle at 32% 32%,#34aaff,#007AFF 55%,#0040cc);display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;animation:breathe 2.6s ease-in-out infinite}
              .dice-ring::before{content:'';position:absolute;inset:0;background:conic-gradient(from 0deg,transparent 60%,rgba(255,255,255,.14) 80%,transparent 100%);animation:rotateGlow 3s linear infinite}
            `}</style>
            <div className="dice-halo" />
            <div className="dice-ring">
              <svg width="38" height="38" viewBox="0 0 38 38" fill="none" style={{ position: 'relative', zIndex: 1 }}>
                <circle cx="19" cy="19" r="18" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
                <path d="M19 4 L32 11.5 L32 26.5 L19 34 L6 26.5 L6 11.5 Z" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" fill="none"/>
                <circle cx="19" cy="19" r="3.5" fill="white" opacity="0.95"/>
                <circle cx="12" cy="13" r="2" fill="white" opacity="0.7"/>
                <circle cx="26" cy="13" r="2" fill="white" opacity="0.7"/>
                <circle cx="12" cy="25" r="2" fill="white" opacity="0.7"/>
                <circle cx="26" cy="25" r="2" fill="white" opacity="0.7"/>
              </svg>
            </div>
            <span style={{ fontSize: 12, color: 'var(--blue)', fontWeight: 600, letterSpacing: '.5px' }}>帮我选</span>
          </button>
        )}

        {/* Loading: Bowl animation */}
        {state === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, width: '100%' }}>
            <style>{`
              @keyframes dice-drop{0%{top:-120px;opacity:1;transform:translateX(-50%) rotate(0deg) scale(1)}65%{top:15px;opacity:1;transform:translateX(-50%) rotate(300deg) scale(.7)}82%{top:38px;opacity:.6;transform:translateX(-50%) rotate(350deg) scale(.4)}100%{top:52px;opacity:0;transform:translateX(-50%) rotate(390deg) scale(.1)}}
              .falling-dice{position:absolute;top:-120px;left:50%;transform:translateX(-50%);width:60px;height:60px;opacity:0;z-index:10;pointer-events:none}
              .falling-dice.drop{animation:dice-drop .78s cubic-bezier(.4,0,.6,1) forwards}
              @keyframes bowl-shake{0%,100%{transform:rotate(0) translateY(0)}18%{transform:rotate(-9deg) translateY(-4px)}36%{transform:rotate(8deg) translateY(-3px)}54%{transform:rotate(-5deg) translateY(-2px)}72%{transform:rotate(4deg) translateY(-1px)}}
              @keyframes bowl-glow{0%,100%{filter:drop-shadow(0 6px 18px rgba(0,0,0,.12))}50%{filter:drop-shadow(0 6px 24px rgba(224,92,53,.35))}}
              .bowl-svg.shake{animation:bowl-shake .55s ease-in-out}
              .bowl-svg.pulse{animation:bowl-glow 1.5s ease-in-out infinite}
              @keyframes particle-burst{0%{opacity:0;transform:translateY(0) scale(.5) rotate(-15deg)}30%{opacity:1;transform:translateY(-22px) scale(1.15) rotate(8deg)}100%{opacity:0;transform:translateY(-75px) scale(.75) rotate(20deg)}}
              .bowl-particles span{font-size:20px;opacity:0;display:inline-block}
              .bowl-particles span.burst{animation:particle-burst .9s ease-out forwards}
              .bowl-particles span:nth-child(2).burst{animation-delay:.11s}
              .bowl-particles span:nth-child(3).burst{animation-delay:.24s}
              @keyframes name-rise{0%{opacity:0;transform:translateY(28px) scale(.75)}50%{opacity:1;transform:translateY(-8px) scale(1.08)}100%{opacity:1;transform:translateY(0) scale(1)}}
              .name-flyout.rise{animation:name-rise .9s cubic-bezier(.17,.67,.3,1.28) forwards}
            `}</style>
            <div style={{ position: 'relative', width: 170, height: 140, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              <div id="fallingDice" className="falling-dice">
                <svg viewBox="0 0 96 96" fill="none">
                  <path d="M68 26 L84 12 L84 76 L68 86 Z" fill="#bfbdb6" stroke="#1a1a1a" strokeWidth="2.6" strokeLinejoin="round"/>
                  <path d="M10 26 L68 26 L84 12 L26 12 Z" fill="#dddbd3" stroke="#1a1a1a" strokeWidth="2.6" strokeLinejoin="round"/>
                  <path d="M10 26 L68 26 L68 80 Q68 86 62 86 L16 86 Q10 86 10 80 Z" fill="white" stroke="#1a1a1a" strokeWidth="2.6" strokeLinejoin="round"/>
                  <circle cx="25" cy="39" r="5.8" fill="#1a1a1a"/><circle cx="53" cy="39" r="5.8" fill="#1a1a1a"/><circle cx="39" cy="56" r="5.8" fill="#1a1a1a"/><circle cx="25" cy="73" r="5.8" fill="#1a1a1a"/><circle cx="53" cy="73" r="5.8" fill="#1a1a1a"/>
                </svg>
              </div>
              <div id="bowlParticles" className="bowl-particles" style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 14, pointerEvents: 'none', zIndex: 5 }}>
                <span>🍜</span><span>✨</span><span>🍱</span>
              </div>
              <svg id="bowlSvg" className="bowl-svg" viewBox="0 0 170 110" fill="none" style={{ width: 170 }}>
                <path d="M18 46 Q10 88 85 98 Q160 88 152 46" fill="white" stroke="#1a1a1a" strokeWidth="2.8" strokeLinejoin="round"/>
                <ellipse cx="85" cy="46" rx="67" ry="14" fill="#f0ebe2" stroke="#1a1a1a" strokeWidth="2.8"/>
                <ellipse cx="85" cy="46" rx="54" ry="9" fill="#fdf8f0"/>
                <path d="M52 44 Q62 40 74 44" stroke="#d4c8a8" strokeWidth="1.6" strokeLinecap="round"/>
                <path d="M88 43 Q99 39 110 43" stroke="#d4c8a8" strokeWidth="1.6" strokeLinecap="round"/>
                <path d="M66 48 Q77 44 90 48" stroke="#d4c8a8" strokeWidth="1.6" strokeLinecap="round"/>
                <ellipse cx="85" cy="100" rx="52" ry="6" fill="rgba(0,0,0,0.08)"/>
                <path d="M34 76 Q85 84 136 76" stroke="#e8e0d4" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              </svg>
            </div>
            <div id="nameFlyout" className="name-flyout" style={{ fontSize: 21, fontWeight: 700, color: 'var(--accent)', fontFamily: "'STKaiti','KaiTi',Georgia,serif", textAlign: 'center', maxWidth: 280, letterSpacing: 2, opacity: 0, transform: 'translateY(28px) scale(.75)' }} />
            <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500 }}>AI 正在为你选…</div>
          </div>
        )}

        {/* Result */}
        {state === 'result' && result && (
          <div style={{ width: '100%' }}>
            <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text3)', marginBottom: 4, letterSpacing: '.04em', textTransform: 'uppercase' }}>{result.cat}</div>
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.4px', marginBottom: 6, color: 'var(--text1)' }}>{result.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.55 }}>{result.reason}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button onClick={confirmChoice} style={{ flex: 2, background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 10, padding: 11, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>✓ 确认这家</button>
              <button onClick={blacklistChoice} style={{ flex: 1, background: '#fff0f0', color: 'var(--red)', border: '0.5px solid rgba(220,38,38,.15)', borderRadius: 10, padding: 11, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>不去了</button>
            </div>
            <button onClick={getAIRecommend} style={{ width: '100%', background: 'transparent', color: 'var(--blue)', border: '0.5px solid rgba(45,91,227,.3)', borderRadius: 10, padding: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>换一个 →</button>
          </div>
        )}
      </div>

      {/* History */}
      <div style={{ borderTop: '0.5px solid var(--sep)', flexShrink: 0 }}>
        <div onClick={() => setHistOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 18px', cursor: 'pointer', userSelect: 'none' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>用餐记录</span>
          <span style={{ color: 'var(--text3)', fontSize: 10, transition: 'transform .2s', display: 'inline-block', transform: histOpen ? 'rotate(180deg)' : 'none' }}>▼</span>
        </div>
        {histOpen && (
          <div style={{ maxHeight: 150, overflowY: 'auto', borderTop: '0.5px solid var(--sep)' }}>
            {history.length === 0
              ? <div style={{ color: 'var(--text3)', textAlign: 'center', padding: 16, fontSize: 13 }}>暂无用餐记录</div>
              : history.map(h => (
                <div key={h.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '0.5px solid var(--sep)', fontSize: 13 }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{h.restaurant_name}</div>
                    <div style={{ color: 'var(--text3)', fontSize: 11, marginTop: 1 }}>{h.date} · {h.period}</div>
                  </div>
                  <button onClick={() => deleteHistory(h.id)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 14, padding: '2px 4px' }}>×</button>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: 'rgba(28,28,30,.88)', color: '#fff', padding: '9px 18px', borderRadius: 18, fontSize: 13, zIndex: 300, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
