'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await createClient().auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    router.replace('/home')
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-6 py-12" style={{ background: 'var(--bg)' }}>
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="text-3xl font-bold mb-1" style={{ color: 'var(--text1)' }}>
          今天吃
          <span className="relative inline-block mx-2">
            <span style={{ color: '#b0aca6' }}>什么呢</span>
            <svg className="absolute" style={{ left: -3, top: '50%', transform: 'translateY(-50%)', width: 'calc(100% + 6px)', height: 14, pointerEvents: 'none' }} viewBox="0 0 72 14" fill="none">
              <path d="M2 10 Q17 3 36 7 Q55 11 70 5" stroke="#2d5be3" strokeWidth="2.8" strokeLinecap="round"/>
            </svg>
          </span>
          <em style={{ fontStyle: 'italic', color: 'var(--accent)', fontFamily: "'STKaiti','KaiTi',Georgia,serif" }}>AI帮选</em>
        </div>
        <p className="text-sm mt-1" style={{ color: 'var(--text3)' }}>登录后数据云端保存</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-sm" style={{ border: '0.5px solid var(--sep)' }}>
        <h2 className="text-lg font-semibold mb-5" style={{ color: 'var(--text1)' }}>登录账号</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text2)' }}>邮箱</label>
            <input
              type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full h-10 px-3 rounded-lg text-sm outline-none transition-all"
              style={{ border: '0.5px solid rgba(0,0,0,0.15)', background: '#fff', color: 'var(--text1)' }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text2)' }}>密码</label>
            <input
              type="password" required value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full h-10 px-3 rounded-lg text-sm outline-none"
              style={{ border: '0.5px solid rgba(0,0,0,0.15)', background: '#fff', color: 'var(--text1)' }}
            />
          </div>
          {error && <p className="text-xs" style={{ color: 'var(--red)' }}>{error}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full h-11 rounded-lg text-white text-sm font-semibold disabled:opacity-40 transition-opacity"
            style={{ background: 'var(--blue)' }}
          >
            {loading ? '登录中…' : '登 录'}
          </button>
        </form>
        <p className="text-center text-xs mt-4" style={{ color: 'var(--text3)' }}>
          没有账号？{' '}
          <Link href="/signup" className="font-medium" style={{ color: 'var(--blue)' }}>注册</Link>
        </p>
      </div>
    </div>
  )
}
