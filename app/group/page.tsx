'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Group } from '@/lib/types'

function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export default function GroupPage() {
  const router = useRouter()
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [createName, setCreateName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace('/login'); return }
      setUserId(data.user.id)
      loadGroups(data.user.id)
    })
  }, [])

  async function loadGroups(uid: string) {
    const { data: members } = await supabase.from('group_members').select('group_id').eq('user_id', uid)
    if (!members?.length) { setLoading(false); return }
    const ids = members.map(m => m.group_id)
    const { data } = await supabase.from('groups').select('*').in('id', ids).order('created_at', { ascending: false })
    if (data) setGroups(data)
    setLoading(false)
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2200) }

  async function handleCreate() {
    if (!createName.trim() || !userId) return
    setSaving(true)
    const code = genCode()
    const { data: g } = await supabase.from('groups')
      .insert({ name: createName.trim(), invite_code: code, created_by: userId })
      .select().single()
    if (g) {
      await supabase.from('group_members').insert({ group_id: g.id, user_id: userId, nickname: '我' })
      setGroups(prev => [g, ...prev])
      setShowCreate(false); setCreateName('')
      router.push(`/group/${g.id}`)
    }
    setSaving(false)
  }

  async function handleJoin() {
    if (!joinCode.trim() || !userId) return
    setSaving(true)
    const { data: g } = await supabase.from('groups').select('*').eq('invite_code', joinCode.trim().toUpperCase()).single()
    if (!g) { showToast('邀请码无效'); setSaving(false); return }
    const { error } = await supabase.from('group_members').insert({ group_id: g.id, user_id: userId, nickname: '我' })
    if (error?.code === '23505') { showToast('已在该群组中'); setSaving(false); return }
    setGroups(prev => [g, ...prev.filter(x => x.id !== g.id)])
    setShowJoin(false); setJoinCode('')
    router.push(`/group/${g.id}`)
    setSaving(false)
  }

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
      <div style={{ flexShrink: 0, background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(20px)', borderBottom: '0.5px solid var(--sep)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => router.push('/home')} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text2)', padding: '0 4px' }}>‹</button>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text1)', flex: 1 }}>饭搭子</span>
        <button onClick={() => setShowJoin(true)} style={{ background: 'var(--bg)', color: 'var(--text2)', border: '0.5px solid var(--sep)', borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}>加入</button>
        <button onClick={() => setShowCreate(true)} style={{ background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ 新建</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {loading && <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 32, fontSize: 13 }}>加载中…</div>}
        {!loading && groups.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🍽️</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text1)', marginBottom: 6 }}>还没有饭搭子</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6, marginBottom: 20 }}>建一个群组，和同事朋友一起<br/>让 AI 找到大家都满意的餐厅</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setShowCreate(true)} style={{ background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>新建群组</button>
              <button onClick={() => setShowJoin(true)} style={{ background: 'var(--card)', color: 'var(--text2)', border: '0.5px solid var(--sep)', borderRadius: 10, padding: '10px 20px', fontSize: 14, cursor: 'pointer' }}>输入邀请码</button>
            </div>
          </div>
        )}
        {groups.map(g => (
          <div key={g.id} onClick={() => router.push(`/group/${g.id}`)}
            style={{ background: 'var(--card)', border: '0.5px solid var(--sep)', borderRadius: 12, padding: '14px 16px', marginBottom: 10, cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,.04)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--primary-pale, #f0f0f0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🍜</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text1)', marginBottom: 3 }}>{g.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>邀请码：{g.invite_code}</div>
            </div>
            <span style={{ color: 'var(--text3)', fontSize: 16 }}>›</span>
          </div>
        ))}
      </div>

      {/* 新建群组弹窗 */}
      {showCreate && (
        <div onClick={e => e.target === e.currentTarget && setShowCreate(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--card)', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 480, padding: '20px 20px 32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>新建饭搭子</span>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--text3)', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 6 }}>群组名称 *</label>
              <input value={createName} onChange={e => setCreateName(e.target.value)}
                placeholder="如：研发组午饭群"
                style={{ width: '100%', height: 40, padding: '0 12px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 8, fontSize: 14, outline: 'none' }} />
            </div>
            <button onClick={handleCreate} disabled={!createName.trim() || saving}
              style={{ width: '100%', height: 44, background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer', opacity: (!createName.trim() || saving) ? .4 : 1 }}>
              {saving ? '创建中…' : '创建'}
            </button>
          </div>
        </div>
      )}

      {/* 加入群组弹窗 */}
      {showJoin && (
        <div onClick={e => e.target === e.currentTarget && setShowJoin(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--card)', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 480, padding: '20px 20px 32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>加入饭搭子</span>
              <button onClick={() => setShowJoin(false)} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--text3)', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 6 }}>邀请码</label>
              <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
                placeholder="输入6位邀请码"
                maxLength={6}
                style={{ width: '100%', height: 44, padding: '0 12px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 8, fontSize: 18, outline: 'none', textAlign: 'center', letterSpacing: 4, fontWeight: 700 }} />
            </div>
            <button onClick={handleJoin} disabled={joinCode.length !== 6 || saving}
              style={{ width: '100%', height: 44, background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer', opacity: (joinCode.length !== 6 || saving) ? .4 : 1 }}>
              {saving ? '加入中…' : '加入'}
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
