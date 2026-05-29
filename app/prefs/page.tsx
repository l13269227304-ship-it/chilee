'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const ALL_CATS = ['面食','饺子包子','火锅','麻辣烫','烧烤','米饭','汉堡炸鸡','日料','韩餐','西餐','轻食','咖啡','奶茶']

export default function PrefsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [avoidCats, setAvoidCats] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [nickname, setNickname] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace('/login'); return }
      setUserId(data.user.id)
      supabase.from('user_prefs').select('*').eq('user_id', data.user.id).single()
        .then(({ data: p }) => {
          if (p) { setAvoidCats(p.avoid_cats || []); setNotes(p.dietary_notes || '') }
        })
    })
  }, [])

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2000) }

  function toggleCat(cat: string) {
    setAvoidCats(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])
  }

  async function handleSave() {
    if (!userId) return
    setSaving(true)
    await supabase.from('user_prefs').upsert({
      user_id: userId, avoid_cats: avoidCats, dietary_notes: notes.trim(), updated_at: new Date().toISOString()
    })
    setSaving(false)
    showToast('已保存')
  }

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
      <div style={{ flexShrink: 0, background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(20px)', borderBottom: '0.5px solid var(--sep)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text2)', padding: '0 4px' }}>‹</button>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text1)', flex: 1 }}>我的饮食偏好</span>
        <button onClick={handleSave} disabled={saving}
          style={{ background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving ? .5 : 1 }}>
          {saving ? '保存中…' : '保存'}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px' }}>
        {/* 忌口品类 */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)', marginBottom: 4 }}>不吃的品类</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>饭搭子推荐时会自动排除这些品类</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {ALL_CATS.map(cat => (
              <button key={cat} onClick={() => toggleCat(cat)}
                style={{
                  padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none',
                  background: avoidCats.includes(cat) ? 'var(--red)' : 'var(--card)',
                  color: avoidCats.includes(cat) ? '#fff' : 'var(--text2)',
                  boxShadow: '0 1px 3px rgba(0,0,0,.08)'
                }}>
                {avoidCats.includes(cat) ? '✕ ' : ''}{cat}
              </button>
            ))}
          </div>
        </div>

        {/* 其他备注 */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)', marginBottom: 4 }}>其他饮食说明</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>如：不吃辣、素食、对坚果过敏等</div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="例：不吃辣，对海鲜过敏"
            rows={3}
            style={{ width: '100%', padding: '10px 12px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 10, fontSize: 14, outline: 'none', background: 'var(--card)', color: 'var(--text1)', resize: 'none', fontFamily: 'inherit', lineHeight: 1.6 }} />
        </div>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: 'rgba(28,28,30,.88)', color: '#fff', padding: '9px 18px', borderRadius: 18, fontSize: 13, zIndex: 300, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
