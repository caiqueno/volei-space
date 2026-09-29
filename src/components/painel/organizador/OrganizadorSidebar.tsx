'use client'

import Image from 'next/image'
import Link from 'next/link'
import { BadgeCheck, CalendarDays, Home, Images, LogOut, Settings, SlidersHorizontal, Table2, Trophy, type LucideIcon } from 'lucide-react'

export type PainelView = 'home' | 'parametrizacao' | 'campeonatos' | 'tabela' | 'jogos' | 'galeria' | 'arbitros' | 'settings'

interface OrganizadorSidebarProps {
  view: PainelView
  onSelectView: (view: PainelView) => void
  organizacaoNome: string | null
  organizacaoLogoUrl: string | null
  onLogout: () => void
  /** true enquanto a organização não foi cadastrada — só Início/Configurações
   * ficam ofuscados e sem interação; logo do topo e Sair continuam normais. */
  obfuscated: boolean
}

const NAV_ITEMS: Array<{ key: PainelView; label: string; short: string; icon: LucideIcon }> = [
  { key: 'home', label: 'Início', short: 'Início', icon: Home },
  { key: 'parametrizacao', label: 'Parametrização', short: 'Param.', icon: SlidersHorizontal },
  { key: 'campeonatos', label: 'Campeonatos', short: 'Campeonatos', icon: Trophy },
  { key: 'tabela', label: 'Tabela', short: 'Tabela', icon: Table2 },
  { key: 'jogos', label: 'Jogos', short: 'Jogos', icon: CalendarDays },
  { key: 'galeria', label: 'Galeria', short: 'Galeria', icon: Images },
  { key: 'arbitros', label: 'Árbitros', short: 'Árbitros', icon: BadgeCheck },
  { key: 'settings', label: 'Configurações', short: 'Ajustes', icon: Settings },
]

export function OrganizadorSidebar({ view, onSelectView, organizacaoNome, organizacaoLogoUrl, onLogout, obfuscated }: OrganizadorSidebarProps) {
  return (
    <>
      <aside className="profile-sidebar">
        <Link href="/painel" onClick={(event) => { event.preventDefault(); onSelectView('home') }} className="profile-sidebar-brand">
          <span className="relative h-[45px] w-[135px] shrink-0">
            <Image src="/brand/volei-space_wordmark_transparente.png" alt="volei.space" fill sizes="135px" className="object-contain object-left" priority />
          </span>
        </Link>

        <nav className={`profile-sidebar-nav ${obfuscated ? 'pointer-events-none opacity-40 saturate-50 brightness-90' : ''}`} style={{ marginTop: obfuscated ? 24 : undefined }} aria-hidden={obfuscated}>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const active = view === item.key
              return (
                <button
                  key={item.key}
                  type="button"
                  tabIndex={obfuscated ? -1 : 0}
                  onClick={() => {
                    if (obfuscated) return
                    onSelectView(item.key)
                  }}
                  className={`profile-sidebar-link ${active ? 'is-active' : ''}`}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </button>
              )
            })}
        </nav>
        {obfuscated && <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">Finalize o cadastro da organização para liberar a navegação.</p>}

        <div className="profile-sidebar-session">
          <span className="profile-sidebar-session-label">Organização</span>
          <div className="mt-2 flex items-center gap-2.5">
            <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/10 text-xs font-black text-luva-amber">
              {organizacaoLogoUrl ? (
                <Image src={organizacaoLogoUrl} alt={organizacaoNome ?? 'Organização'} fill sizes="32px" className="object-cover" />
              ) : (
                <span>{(organizacaoNome ?? '?').trim().charAt(0).toUpperCase()}</span>
              )}
            </span>
            <strong className="!mt-0 truncate">{organizacaoNome || 'Sua organização'}</strong>
          </div>
          <button type="button" onClick={onLogout} className="profile-sidebar-logout">
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </aside>

      <nav className="profile-mobile-nav">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = view === item.key
          return (
            <button
              key={item.key}
              type="button"
              disabled={obfuscated}
              onClick={() => onSelectView(item.key)}
              className={`profile-mobile-link ${active ? 'is-active' : ''} ${obfuscated ? 'opacity-40' : ''}`}
            >
              <Icon size={18} />
              <span>{item.short}</span>
            </button>
          )
        })}
        <button type="button" onClick={onLogout} className="profile-mobile-link">
          <LogOut size={18} />
          <span>Sair</span>
        </button>
      </nav>
    </>
  )
}
