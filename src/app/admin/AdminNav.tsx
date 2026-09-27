'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, CalendarDays, ClipboardList, KeyRound, Trophy, UserRound, Users } from 'lucide-react'

const navLinks = [
  { href: '/admin', label: 'Dashboard', icon: BarChart3 },
  { href: '/admin/candidaturas', label: 'Candidaturas', icon: ClipboardList },
  { href: '/admin/acessos', label: 'Organizadores', icon: KeyRound },
  { href: '/admin/partidas', label: 'Partidas', icon: CalendarDays },
  { href: '/admin/equipes', label: 'Equipes', icon: Users },
  { href: '/admin/jogadores', label: 'Jogadores', icon: UserRound },
  { href: '/admin/campeonatos', label: 'Campeonatos', icon: Trophy },
]

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="grid gap-1 px-3 py-4">
      {navLinks.map(({ href, label, icon: Icon }) => {
        const active = href === '/admin' ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`admin-nav-link flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold transition ${active ? 'admin-nav-link-active' : ''}`}
          >
            <Icon size={18} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
