'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function Root() {
  const router = useRouter()
  useEffect(() => {
    createClient().auth.getSession().then(({ data }) => {
      router.replace(data.session ? '/home' : '/login')
    })
  }, [router])
  return (
    <div className="h-full flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="text-sm" style={{ color: 'var(--text3)' }}>加载中…</div>
    </div>
  )
}
