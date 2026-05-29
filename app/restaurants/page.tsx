'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { CustomRestaurant } from '@/lib/types'

const CATS = ['其他','面食','饺子包子','火锅','麻辣烫','烧烤','米饭','汉堡炸鸡','日料','韩餐','西餐','轻食','咖啡','奶茶']

export default function RestaurantsPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [list, setList] = useState<CustomRestaurant[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [parsing, setParsing] = useState(false)
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

  // 拍照/上传图片 → AI 解析
  function openCamera() {
    fileInputRef.current?.click()
  }

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    // 压缩：最大边 1024px，quality 0.8
    const compressed = await compressImage(file, 1024, 0.8)
    const base64 = compressed.split(',')[1]
    const mimeType = file.type || 'image/jpeg'

    setParsing(true)
    showToast('AI 正在识别图片…')
    try {
      const res = await fetch('/api/parse-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType })
      })
      const data = await res.json()
      if (data.error) { showToast('识别失败，请手动填写'); openAdd(); return }
      setEditing(null)
      setForm({ name: data.name || '', category: data.category || '其他', address: data.address || '', notes: '' })
      setShowForm(true)
      if (data.name) showToast(`已识别：${data.name}，请确认信息`)
      else showToast('未能识别店名，请手动补充')
    } catch {
      showToast('识别失败，请手动填写')
      openAdd()
    } finally {
      setParsing(false)
    }
  }

  function compressImage(file: File, maxPx: number, quality: number): Promise<string> {
    return new Promise(resolve => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
        URL.revokeObjectURL(url)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = url
    })
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

      {/* 隐藏的文件输入（拍照/相册） */}
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
        onChange={handlePhotoSelect} style={{ display: 'none' }} />

      {/* Header */}
      <div style={{ flexShrink: 0, background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(20px)', borderBottom: '0.5px solid var(--sep)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => router.push('/home')} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text2)', lineHeight: 1, padding: '0 4px' }}>‹</button>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text1)', flex: 1 }}>我的餐厅</span>
        {/* 拍照录入按钮 */}
        <button onClick={openCamera} disabled={parsing}
          style={{ background: parsing ? 'var(--bg)' : '#fff7ed', color: parsing ? 'var(--text3)' : 'var(--accent)', border: `0.5px solid ${parsing ? 'var(--sep)' : 'rgba(224,92,53,.3)'}`, borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: parsing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
          {parsing ? '识别中…' : '📷 拍照'}
        </button>
        <button onClick={openAdd} style={{ background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ 手动</button>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {loading && <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 32, fontSize: 13 }}>加载中…</div>}
        {!loading && list.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🍜</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text1)', marginBottom: 6 }}>还没有自定义餐厅</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6, marginBottom: 20 }}>拍张店铺照片，AI 自动识别录入<br/>也可以手动填写</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={openCamera} style={{ background: '#fff7ed', color: 'var(--accent)', border: '0.5px solid rgba(224,92,53,.3)', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>📷 拍照录入</button>
              <button onClick={openAdd} style={{ background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>手动添加</button>
            </div>
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
