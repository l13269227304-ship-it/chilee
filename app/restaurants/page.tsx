'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { CustomRestaurant } from '@/lib/types'

const CATS = ['其他','面食','饺子包子','火锅','麻辣烫','烧烤','米饭','汉堡炸鸡','日料','韩餐','西餐','轻食','咖啡','奶茶']

export default function RestaurantsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [list, setList] = useState<CustomRestaurant[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<CustomRestaurant | null>(null)
  const [form, setForm] = useState({ name: '', category: '其他', address: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace('/login'); return }
      setUserId(data.user.id)
      supabase.from('custom_restaurants').select('*').eq('user_id', data.user.id).order('created_at', { ascending: false })
        .then(({ data: rows }) => { if (rows) setList(rows); setLoading(false) })
    })
  }, [])

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2200) }

  function openAdd() {
    setEditing(null)
    setForm({ name: '', category: '其他', address: '', notes: '' })
    setShowForm(true)
  }

  function openEdit(r: CustomRestaurant) {
    setEditing(r)
    setForm({ name: r.name, category: r.category || '其他', address: r.address || '', notes: r.notes || '' })
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.name.trim() || !userId) return
    setSaving(true)
    if (editing) {
      const { data } = await supabase.from('custom_restaurants')
        .update({ name: form.name.trim(), category: form.category, address: form.address.trim(), notes: form.notes.trim() })
        .eq('id', editing.id).select().single()
      if (data) setList(prev => prev.map(r => r.id === data.id ? data : r))
      showToast('已更新')
    } else {
      const { data } = await supabase.from('custom_restaurants')
        .insert({ user_id: userId, name: form.name.trim(), category: form.category, address: form.address.trim(), notes: form.notes.trim() })
        .select().single()
      if (data) setList(prev => [data, ...prev])
      showToast('已添加')
    }
    setSaving(false)
    setShowForm(false)
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`确定删除「${name}」吗？`)) return
    await supabase.from('custom_restaurants').delete().eq('id', id)
    setList(prev => prev.filter(r => r.id !== id))
    showToast('已删除')
  }

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ flexShrink: 0, background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(20px)', borderBottom: '0.5px solid var(--sep)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.push('/home')} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text2)', lineHeight: 1, padding: '0 4px' }}>‹</button>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text1)', flex: 1 }}>我的餐厅</span>
        <button onClick={openAdd} style={{ background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ 添加</button>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {loading && <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 32, fontSize: 13 }}>加载中…</div>}
        {!loading && list.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🍜</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text1)', marginBottom: 6 }}>还没有自定义餐厅</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6, marginBottom: 20 }}>把那些没上外卖平台的好店<br/>手动加进来，AI 也会帮你选</div>
            <button onClick={openAdd} style={{ background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>添加第一家</button>
          </div>
        )}
        {list.map(r => (
          <div key={r.id} style={{ background: 'var(--card)', border: '0.5px solid var(--sep)', borderRadius: 12, padding: '14px 16px', marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text1)' }}>{r.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 500, background: 'var(--bg)', color: 'var(--text3)', borderRadius: 6, padding: '2px 8px', border: '0.5px solid var(--sep)' }}>{r.category || '其他'}</span>
                </div>
                {r.address && <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 2 }}>📍 {r.address}</div>}
                {r.notes && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4, lineHeight: 1.5 }}>{r.notes}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => openEdit(r)} style={{ background: 'var(--bg)', border: '0.5px solid var(--sep)', borderRadius: 7, padding: '5px 10px', fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}>编辑</button>
                <button onClick={() => handleDelete(r.id, r.name)} style={{ background: '#fff0f0', border: '0.5px solid rgba(220,38,38,.15)', borderRadius: 7, padding: '5px 10px', fontSize: 12, color: 'var(--red)', cursor: 'pointer' }}>删除</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div onClick={e => e.target === e.currentTarget && setShowForm(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--card)', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 480, padding: '20px 20px 32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text1)' }}>{editing ? '编辑餐厅' : '添加餐厅'}</span>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--text3)', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 6 }}>餐厅名称 *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="如：楼下那家沙县"
                  style={{ width: '100%', height: 40, padding: '0 12px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 8, fontSize: 14, outline: 'none', background: '#fff', color: 'var(--text1)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 6 }}>品类</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  style={{ width: '100%', height: 40, padding: '0 12px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 8, fontSize: 14, outline: 'none', background: '#fff', color: 'var(--text1)', appearance: 'none' }}>
                  {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 6 }}>地址（可选）</label>
                <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="如：XX路XX号"
                  style={{ width: '100%', height: 40, padding: '0 12px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 8, fontSize: 14, outline: 'none', background: '#fff', color: 'var(--text1)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 6 }}>备注（可选）</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="如：招牌菜是红烧肉，老板很热情"
                  rows={2}
                  style={{ width: '100%', padding: '10px 12px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', color: 'var(--text1)', resize: 'none', fontFamily: 'inherit' }} />
              </div>
              <button onClick={handleSave} disabled={!form.name.trim() || saving}
                style={{ width: '100%', height: 44, background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer', opacity: (!form.name.trim() || saving) ? .4 : 1 }}>
                {saving ? '保存中…' : (editing ? '保存修改' : '添加餐厅')}
              </button>
            </div>
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
