'use client'

import type React from 'react'
import { useRouter } from 'next/navigation'

export function LogoutButton({ icon }: { icon?: React.ReactNode }) {
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className="inline-flex items-center justify-center gap-1 rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-2 text-xs font-black text-white/75 transition hover:bg-white/10 hover:text-white"
    >
      {icon}
      Sair
    </button>
  )
}
