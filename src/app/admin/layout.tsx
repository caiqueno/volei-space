import Image from 'next/image'
import Link from 'next/link'
import { cookies } from 'next/headers'
import type { JWTPayload } from 'jose'
import { Home, LogOut, ShieldCheck, Trophy } from 'lucide-react'
import { LogoutButton } from './LogoutButton'
import { AdminNav } from './AdminNav'
import { isAdminSession } from '@/lib/admin-access'
import { lerToken } from '@/lib/token-verify'
import { AvisoAmbienteBanco } from '@/components/admin/AvisoAmbienteBanco'

async function getAdmin(): Promise<JWTPayload | null> {
  const cookieStore = cookies()
  const token = cookieStore.get('luva_token')?.value
  if (!token) return null
  const payload = await lerToken<JWTPayload>(token, 'admin')
  if (!payload || !isAdminSession(payload)) return null
  return payload
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin()

  if (!admin) {
    return (
      <>
        <AvisoAmbienteBanco />
        {children}
      </>
    )
  }

  return (
    <div className="admin-shell min-h-screen text-white lg:grid lg:grid-cols-[292px_1fr]">
      <aside className="admin-sidebar border-r text-white lg:min-h-screen">
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          <span className="relative h-12 w-12 overflow-hidden rounded-xl">
            <Image src="/brand/volei-space_simbolo-orbital_transparente.png" alt="volei.space" fill sizes="48px" className="object-contain" />
          </span>
          <div>
            <p className="font-black leading-tight text-white">volei.space</p>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-luva-amber">Operação</p>
          </div>
        </div>

        <AdminNav />

        <div className="border-t border-white/10 p-4">
          <div className="admin-session-card rounded-3xl border p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-black text-white">
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-luva-amber/14 text-luva-amber ring-1 ring-luva-amber/30">
                  <ShieldCheck size={17} />
                </span>
                Sessão ativa
              </div>
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,.8)]" />
            </div>
            <p className="mt-3 truncate rounded-2xl bg-white/[0.055] px-3 py-2 text-xs font-bold text-white/80">{String(admin.email ?? '')}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <LogoutButton icon={<LogOut size={14} />} />
              <Link href="/" className="inline-flex items-center justify-center gap-1 rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-2 text-xs font-black text-white/75 transition hover:bg-white/10 hover:text-white">
                <Home size={14} />
                Ver site
              </Link>
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <AvisoAmbienteBanco />
        <header className="admin-topbar sticky top-0 z-30 border-b px-4 py-4 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-luva-amber">Painel da organização</p>
              <h1 className="mt-1 text-2xl font-black text-white">volei.space</h1>
            </div>
            <div className="admin-active-season inline-flex w-fit items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black text-white">
              <Trophy size={16} className="text-luva-amber" />
              Temporada ativa
            </div>
          </div>
        </header>
        <main className="admin-content min-h-[calc(100vh-81px)] px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  )
}
