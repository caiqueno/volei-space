'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Home, LogOut, Settings } from 'lucide-react'

interface OrganizadorSidebarProps {
  view: 'home' | 'settings'
  onSelectView: (view: 'home' | 'settings') => void
  organizacaoNome: string | null
  organizacaoLogoUrl: string | null
  onLogout: () => void
  /** true enquanto a organização não foi cadastrada — só Início/Configurações
   * ficam ofuscados e sem interação; logo do topo e Sair continuam normais. */
  obfuscated: boolean
}

const NAV_ITEMS = [
  { key: 'home' as const, label: 'Início', icon: Home },
  { key: 'settings' as const, label: 'Configurações', icon: Settings },
]

// A sidebar REAL do sistema é `.profile-sidebar` (globals.css:5537-5665),
// renderizada normalmente por Header.tsx em toda página autenticada — só é
// suprimida (Header.tsx:120) na rota exata /painel, porque esta tela
// substitui por completo essa área. Aqui reaproveitamos as MESMAS classes
// (não uma reimplementação visual): largura, fundo, divisores, hover, estado
// ativo e o cartão de sessão com Sair vêm todos do CSS já existente — só o
// conteúdo (Início/Configurações em vez dos 7 links operacionais) muda.
export function OrganizadorSidebar({ view, onSelectView, organizacaoNome, organizacaoLogoUrl, onLogout, obfuscated }: OrganizadorSidebarProps) {
  return (
    <>
      <aside className="profile-sidebar">
        {/* Só o wordmark — sem o símbolo (bola+anel), a pedido. Mesmo padrão
            aplicado globalmente em Header.tsx (.profile-sidebar-brand), único
            sidebar-header do sistema. */}
        <Link href="/painel" className="profile-sidebar-brand">
          <span className="relative h-[45px] w-[135px] shrink-0">
            <Image src="/brand/volei-space_wordmark_transparente.png" alt="volei.space" fill sizes="135px" className="object-contain object-left" priority />
          </span>
        </Link>

        <div className={`transition-all duration-500 ${obfuscated ? 'pointer-events-none opacity-40 saturate-50 brightness-90' : 'opacity-100'}`} aria-hidden={obfuscated}>
          <nav className="profile-sidebar-nav" style={{ marginTop: obfuscated ? 24 : undefined }}>
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
        </div>
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

      {/* Abaixo de 1024px, .profile-sidebar vira display:none por definição
          do próprio sistema — reaproveita a mesma barra inferior fixa que
          Header.tsx já usa em toda página autenticada, em vez de um drawer
          próprio. */}
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
              <span>{item.label}</span>
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
