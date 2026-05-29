'use client'
import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Group, GroupMember, UserPrefs, MealHistory } from '@/lib/types'

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
function getMealPeriod() {
  const h = new Date().getHours()
  if (h >= 11 && h < 14) return '午餐'
  if (h >= 17 && h < 21) return '晚餐'
  if (h >= 7  && h < 10) return '早餐'
  return '加餐'
}

interface Restaurant { id: string; name: string; distance: string }

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [recommending, setRecommending] = useState(false)
  const [result, setResult] = useState<{ name: string; reason: string } | null>(null)
  const [toast, setToast] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [editNickOpen, setEditNickOpen] = useState(false)
  const [newNick, setNewNick] = useState('')
  const bowlLoopRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 从 sessionStorage 拿主页的餐厅列表
  const restaurantsRef = useRef<Restaurant[]>([])

  useEffect(() => {
    // 尝试从 sessionStorage 读取主页已加载的餐厅列表
    try {
      const saved = sessionStorage.getItem('nearby_restaurants')
      if (saved) restaurantsRef.current = JSON.parse(saved)
    } catch {}

    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace('/login'); return }
      setMyUserId(data.user.id)
      loadGroup(data.user.id)
    })
  }, [id])

  async function loadGroup(uid: string) {
    const [{ data: g }, { data: mem }] = await Promise.all([
      supabase.from('groups').select('*').eq('id', id).single(),
      supabase.from('group_members').select('*').eq('group_id', id).order('joined_at')
    ])
    if (!g) { router.replace('/group'); return }
    setGroup(g); if (mem) setMembers(mem)
    setLoading(false)
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2400) }

  async function updateNickname() {
    if (!myUserId || !newNick.trim()) return
    await supabase.from('group_members').update({ nickname: newNick.trim() }).eq('group_id', id).eq('user_id', myUserId)
    setMembers(prev => prev.map(m => m.user_id === myUserId ? { ...m, nickname: newNick.trim() } : m))
    setEditNickOpen(false)
    showToast('昵称已更新')
  }

  async function leaveGroup() {
    if (!myUserId) return
    if (!confirm('确定退出该群组？')) return
    await supabase.from('group_members').delete().eq('group_id', id).eq('user_id', myUserId)
    router.replace('/group')
  }

  // ── 碗动画 ──
  function startBowlAnim() {
    resetBowl()
    setTimeout(() => {
      document.getElementById('gf-dice')?.classList.add('drop')
      setTimeout(() => {
        const bowl = document.getElementById('gf-bowl')
        bowl?.classList.add('shake')
        document.getElementById('gf-parts')?.querySelectorAll('span').forEach(s => s.classList.add('burst'))
        setTimeout(() => {
          bowl?.classList.remove('shake'); bowl?.classList.add('pulse')
          bowlLoopRef.current = setInterval(() => {
            const d = document.getElementById('gf-dice'); if (!d) return
            d.classList.remove('drop'); void (d as HTMLElement).offsetWidth; d.classList.add('drop')
          }, 2200)
        }, 600)
      }, 980)
    }, 200)
  }
  function stopBowlAnim() { if (bowlLoopRef.current) clearInterval(bowlLoopRef.current); resetBowl() }
  function resetBowl() {
    document.getElementById('gf-dice')?.classList.remove('drop')
    const b = document.getElementById('gf-bowl'); b?.classList.remove('shake','pulse')
    document.getElementById('gf-parts')?.querySelectorAll('span').forEach(s => s.classList.remove('burst'))
    const fly = document.getElementById('gf-flyout') as HTMLElement | null
    if (fly) { fly.classList.remove('rise'); fly.textContent = ''; fly.style.opacity = '0' }
  }

  // ── 群组推荐 ──
  async function doGroupRecommend() {
    if (!group || !myUserId) return

    const rests = restaurantsRef.current
    if (rests.length === 0) {
      showToast('请先在主页获取附近餐厅后再使用群组推荐')
      return
    }

    setRecommending(true)
    setResult(null)
    startBowlAnim()

    // 读取所有成员的偏好和近期记录
    const userIds = members.map(m => m.user_id)
    const [{ data: prefs }, { data: hist }] = await Promise.all([
      supabase.from('user_prefs').select('*').in('user_id', userIds),
      supabase.from('meal_history').select('*').in('user_id', userIds).order('created_at', { ascending: false }).limit(100)
    ])

    const memberData = members.map(m => {
      const pref = (prefs || []).find(p => p.user_id === m.user_id) as UserPrefs | undefined
      const mHist = (hist || []).filter(h => h.user_id === m.user_id).slice(0, 10) as MealHistory[]
      return {
        nickname: m.nickname || '成员',
        avoidCats: pref?.avoid_cats || [],
        dietaryNotes: pref?.dietary_notes || '',
        recentCats: mHist.map(h => categorize(h.restaurant_name))
      }
    })

    try {
      const res = await fetch('/api/group-recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupName: group.name,
          members: memberData,
          restaurants: rests,
          period: getMealPeriod(),
          weather: '—'
        })
      })
      const data = await res.json()
      if (data.error) { stopBowlAnim(); setRecommending(false); showToast(data.error); return }

      // 飞出餐厅名
      stopBowlAnim()
      const bowl = document.getElementById('gf-bowl'); bowl?.classList.add('shake')
      setTimeout(() => bowl?.classList.remove('shake'), 600)
      const fly = document.getElementById('gf-flyout') as HTMLElement | null
      if (fly) { fly.textContent = data.name; fly.style.opacity = '0'; void fly.offsetWidth; fly.classList.add('rise') }
      setTimeout(() => { setResult(data); setRecommending(false) }, 950)
    } catch {
      stopBowlAnim(); setRecommending(false); showToast('推荐失败，请重试')
    }
  }

  if (loading) return (
    <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <span style={{ fontSize: 13, color: 'var(--text3)' }}>加载中…</span>
    </div>
  )

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
      <style>{`
        @keyframes dice-drop{0%{top:-120px;opacity:1;transform:translateX(-50%) rotate(0deg) scale(1)}65%{top:15px;opacity:1;transform:translateX(-50%) rotate(300deg) scale(.7)}82%{top:38px;opacity:.6;transform:translateX(-50%) rotate(350deg) scale(.4)}100%{top:52px;opacity:0;transform:translateX(-50%) rotate(390deg) scale(.1)}}
        .gf-fd{position:absolute;top:-120px;left:50%;transform:translateX(-50%);width:60px;height:60px;opacity:0;z-index:10;pointer-events:none}
        .gf-fd.drop{animation:dice-drop .78s cubic-bezier(.4,0,.6,1) forwards}
        @keyframes bowl-shake{0%,100%{transform:rotate(0)}18%{transform:rotate(-9deg)}36%{transform:rotate(8deg)}54%{transform:rotate(-5deg)}72%{transform:rotate(4deg)}}
        @keyframes bowl-glow{0%,100%{filter:drop-shadow(0 6px 18px rgba(0,0,0,.12))}50%{filter:drop-shadow(0 6px 24px rgba(224,92,53,.35))}}
        .gf-bowl.shake{animation:bowl-shake .55s ease-in-out}
        .gf-bowl.pulse{animation:bowl-glow 1.5s ease-in-out infinite}
        @keyframes pb{0%{opacity:0;transform:translateY(0) scale(.5)}30%{opacity:1;transform:translateY(-22px) scale(1.15)}100%{opacity:0;transform:translateY(-75px) scale(.75)}}
        .gf-parts span{font-size:20px;opacity:0;display:inline-block}
        .gf-parts span.burst{animation:pb .9s ease-out forwards}
        .gf-parts span:nth-child(2).burst{animation-delay:.11s}
        .gf-parts span:nth-child(3).burst{animation-delay:.24s}
        @keyframes nr{0%{opacity:0;transform:translateY(28px) scale(.75)}50%{opacity:1;transform:translateY(-8px) scale(1.08)}100%{opacity:1;transform:translateY(0) scale(1)}}
        .gf-fly.rise{animation:nr .9s cubic-bezier(.17,.67,.3,1.28) forwards}
      `}</style>

      {/* Header */}
      <div style={{ flexShrink: 0, background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(20px)', borderBottom: '0.5px solid var(--sep)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => router.push('/group')} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text2)', padding: '0 4px' }}>‹</button>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text1)', flex: 1 }}>{group?.name}</span>
        <button onClick={() => setShowInvite(true)} style={{ background: 'var(--bg)', color: 'var(--text2)', border: '0.5px solid var(--sep)', borderRadius: 8, padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}>邀请</button>
        <button onClick={leaveGroup} style={{ background: 'none', color: 'var(--text3)', border: 'none', fontSize: 12, cursor: 'pointer' }}>退出</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {/* 成员列表 */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text3)', marginBottom: 10, letterSpacing: '.04em', textTransform: 'uppercase' }}>成员 {members.length} 人</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {members.map(m => (
              <div key={m.id} onClick={() => { if (m.user_id === myUserId) { setNewNick(m.nickname || ''); setEditNickOpen(true) } }}
                style={{ background: 'var(--card)', border: '0.5px solid var(--sep)', borderRadius: 10, padding: '10px 14px', cursor: m.user_id === myUserId ? 'pointer' : 'default', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
                <div style={{ fontSize: 22, textAlign: 'center', marginBottom: 4 }}>
                  {m.user_id === myUserId ? '🙋' : '👤'}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text1)', textAlign: 'center' }}>{m.nickname || '未命名'}</div>
                {m.user_id === myUserId && <div style={{ fontSize: 10, color: 'var(--text3)', textAlign: 'center', marginTop: 2 }}>点击改名</div>}
              </div>
            ))}
          </div>
        </div>

        {/* 群组推荐区 */}
        <div style={{ background: 'var(--card)', border: '0.5px solid var(--sep)', borderRadius: 14, padding: '20px 16px', boxShadow: '0 1px 4px rgba(0,0,0,.04)', minHeight: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          {!recommending && !result && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20, lineHeight: 1.6 }}>
                综合所有人的忌口和近期记录<br/>AI 帮大家找到都满意的餐厅
              </div>
              <button onClick={doGroupRecommend}
                style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, padding: '13px 32px', fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(224,92,53,.35)' }}>
                🍜 大家一起选
              </button>
            </div>
          )}

          {recommending && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, width: '100%' }}>
              <div style={{ position: 'relative', width: 170, height: 140, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                <div id="gf-dice" className="gf-fd">
                  <svg viewBox="0 0 96 96" fill="none">
                    <path d="M68 26 L84 12 L84 76 L68 86 Z" fill="#bfbdb6" stroke="#1a1a1a" strokeWidth="2.6" strokeLinejoin="round"/>
                    <path d="M10 26 L68 26 L84 12 L26 12 Z" fill="#dddbd3" stroke="#1a1a1a" strokeWidth="2.6" strokeLinejoin="round"/>
                    <path d="M10 26 L68 26 L68 80 Q68 86 62 86 L16 86 Q10 86 10 80 Z" fill="white" stroke="#1a1a1a" strokeWidth="2.6" strokeLinejoin="round"/>
                    <circle cx="25" cy="39" r="5.8" fill="#1a1a1a"/><circle cx="53" cy="39" r="5.8" fill="#1a1a1a"/>
                    <circle cx="39" cy="56" r="5.8" fill="#1a1a1a"/>
                    <circle cx="25" cy="73" r="5.8" fill="#1a1a1a"/><circle cx="53" cy="73" r="5.8" fill="#1a1a1a"/>
                  </svg>
                </div>
                <div id="gf-parts" className="gf-parts" style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 14, pointerEvents: 'none', zIndex: 5 }}>
                  <span>🍜</span><span>✨</span><span>🍱</span>
                </div>
                <svg id="gf-bowl" className="gf-bowl" viewBox="0 0 170 110" fill="none" style={{ width: 170 }}>
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
              <div id="gf-flyout" className="gf-fly" style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)', fontFamily: "'STKaiti','KaiTi',Georgia,serif", textAlign: 'center', opacity: 0, transform: 'translateY(28px) scale(.75)', letterSpacing: 2 }} />
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>AI 正在综合所有人的偏好…</div>
            </div>
          )}

          {result && !recommending && (
            <div style={{ width: '100%' }}>
              <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4, fontWeight: 500, letterSpacing: '.04em', textTransform: 'uppercase' }}>群组推荐</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text1)', marginBottom: 8, letterSpacing: '-.3px' }}>{result.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{result.reason}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setResult(null); setRecommending(false) }}
                  style={{ flex: 1, background: 'var(--bg)', color: 'var(--text2)', border: '0.5px solid var(--sep)', borderRadius: 10, padding: 11, fontSize: 13, cursor: 'pointer' }}>换一个</button>
                <button onClick={() => { showToast(`已选定：${result.name}！`); setTimeout(() => { setResult(null) }, 1800) }}
                  style={{ flex: 2, background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 10, padding: 11, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>✓ 就这家了</button>
              </div>
            </div>
          )}
        </div>

        {/* 前往设置偏好 */}
        <div onClick={() => router.push('/prefs')}
          style={{ marginTop: 12, background: 'var(--card)', border: '0.5px solid var(--sep)', borderRadius: 10, padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>⚙️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)' }}>设置我的饮食偏好</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>忌口、不吃的品类等，影响群组推荐结果</div>
          </div>
          <span style={{ color: 'var(--text3)', fontSize: 16 }}>›</span>
        </div>
      </div>

      {/* 邀请码弹窗 */}
      {showInvite && (
        <div onClick={() => setShowInvite(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card)', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 480, padding: '24px 24px 36px', textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>邀请加入「{group?.name}」</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 20 }}>把邀请码发给朋友，他们输入后即可加入</div>
            <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: 8, color: 'var(--text1)', fontFamily: 'monospace', marginBottom: 20 }}>{group?.invite_code}</div>
            <button onClick={() => { navigator.clipboard?.writeText(group?.invite_code || ''); showToast('邀请码已复制') }}
              style={{ background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 32px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              复制邀请码
            </button>
          </div>
        </div>
      )}

      {/* 改昵称弹窗 */}
      {editNickOpen && (
        <div onClick={e => e.target === e.currentTarget && setEditNickOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--card)', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 480, padding: '20px 20px 32px' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>修改我的昵称</div>
            <input value={newNick} onChange={e => setNewNick(e.target.value)}
              placeholder="如：大胃王小明"
              style={{ width: '100%', height: 40, padding: '0 12px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 8, fontSize: 14, outline: 'none', marginBottom: 14 }} />
            <button onClick={updateNickname} disabled={!newNick.trim()}
              style={{ width: '100%', height: 44, background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer', opacity: !newNick.trim() ? .4 : 1 }}>
              确认
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: 'rgba(28,28,30,.88)', color: '#fff', padding: '9px 18px', borderRadius: 18, fontSize: 13, zIndex: 300, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
