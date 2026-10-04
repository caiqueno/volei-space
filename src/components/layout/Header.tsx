'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  ClipboardCheck,
  Home,
  Images,
  LogOut,
  MapPin,
  ShieldCheck,
  SlidersHorizontal,
  Table2,
  Trophy,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import { InstagramIcon } from '@/components/landing/InstagramIcon'
import { encerrarSessaoPublica } from '@/lib/sessao-publica'

type HeaderSession = {
  tipo: string
  nome?: string
  candidaturaId?: string | null
}

type HeaderLink = {
  href: string
  label: string
  short: string
  icon?: LucideIcon
}

const publicLinks: HeaderLink[] = [
  { href: '/campeonatos', label: 'Campeonatos', short: 'Ligas' },
  { href: '/jogos', label: 'Jogos', short: 'Jogos' },
  { href: '/ao-vivo', label: 'Ao vivo', short: 'Ao vivo' },
  { href: '/portal', label: 'Portal', short: 'Portal' },
  { href: '/classificacao', label: 'Classificação', short: 'Tabela' },
  { href: '/rankings', label: 'Rankings', short: 'Top' },
  { href: '/galeria', label: 'Galeria', short: 'Mídia' },
]

export function Header() {
  const pathname = usePathname()
  const [hydrated, setHydrated] = useState(false)
  const [session, setSession] = useState<HeaderSession | null>(null)
  const panelHref = session?.tipo === 'equipe'
    ? '/capitao'
    : session?.tipo === 'publico'
      ? '/portal'
      : session?.tipo === 'organizador'
        ? '/painel'
        : session
          ? '/painel'
          : null
  const isLegalPage = ['/termos-de-uso', '/politica-de-privacidade', '/politica-de-cookies'].includes(pathname)
  const scopedLinks = useMemo(
    () => (isLegalPage && !session ? [] : getHeaderLinks(session)),
    [isLegalPage, session],
  )
  const desktopLinks = useMemo(() => {
    if (!panelHref) return scopedLinks
    return scopedLinks.filter((link) => {
      const cleanHref = link.href.split('?')[0].split('#')[0]
      return cleanHref !== panelHref || link.href.includes('#')
    })
  }, [panelHref, scopedLinks])
  const mobileLinks = useMemo(() => getMobileLinks(scopedLinks, panelHref), [scopedLinks, panelHref])

  useEffect(() => {
    try {
      setSession(JSON.parse(window.localStorage.getItem('luva_session') ?? 'null'))
    } catch {
      setSession(null)
    }
    setHydrated(true)
  }, [pathname])

  useEffect(() => {
    const root = document.body
    const viewport = window.visualViewport
    const initialHeight = viewport?.height ?? window.innerHeight
    let focused = false

    const isTextInput = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false
      return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
    }

    const updateKeyboardState = () => {
      const currentHeight = viewport?.height ?? window.innerHeight
      const heightDelta = initialHeight - currentHeight
      root.classList.toggle('luv-keyboard-open', focused || heightDelta > 120)
    }

    const handleFocusIn = (event: FocusEvent) => {
      focused = isTextInput(event.target)
      updateKeyboardState()
    }

    const handleFocusOut = () => {
      focused = false
      window.setTimeout(updateKeyboardState, 80)
    }

    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('focusout', handleFocusOut)
    viewport?.addEventListener('resize', updateKeyboardState)
    viewport?.addEventListener('scroll', updateKeyboardState)
    window.addEventListener('resize', updateKeyboardState)

    return () => {
      root.classList.remove('luv-keyboard-open')
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('focusout', handleFocusOut)
      viewport?.removeEventListener('resize', updateKeyboardState)
      viewport?.removeEventListener('scroll', updateKeyboardState)
      window.removeEventListener('resize', updateKeyboardState)
    }
  }, [])

  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/cadastro') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/resetar-senha') ||
    pathname.startsWith('/trocar-senha') ||
    pathname.startsWith('/inscricao') ||
    pathname.startsWith('/sumula') ||
    pathname.startsWith('/arbitro')
  ) {
    return null
  }

  if (pathname === '/painel' && session?.tipo === 'organizador') {
    return null
  }

  if (!hydrated && pathname !== '/') return null

  if (pathname === '/') {
    return (
      <header className="landing-header">
        <div className="landing-header-inner">
          <Link href="/" className="landing-brand">
            <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl">
              <Image src="/brand/volei-space_simbolo-orbital_transparente.png" alt=" " fill sizes="70px" className="object-contain" priority />
            </span>
            <span>
              <strong></strong>
            </span>
          </Link>

          <nav className="landing-nav">
            <a href="#temporada">Campeonato</a>
            <a href="#funcionalidades">Funcionalidades</a>
            <a href="#portal-preview">Prévia</a>
            <a href="#etapas">Etapas</a>
          </nav>

          <div className="landing-header-actions">
             <Link href="/login">Entre ou Cadastre-se</Link>
          </div>
        </div>
      </header>
    )
  }

  if (session && panelHref) {
    const profileLabel = getProfileLabel(session.tipo)
    const userName = session.nome || profileLabel

    return (
      <>
        <aside className="profile-sidebar">
          <Link href={panelHref} className="profile-sidebar-brand">
            <span className="relative h-[45px] w-[135px] shrink-0">
              <Image src="/brand/volei-space_wordmark_transparente.png" alt=" " fill sizes="135px" className="object-contain object-left" priority />
            </span>
            <span>
              <small>{profileLabel}</small>
            </span>
          </Link>

          <nav className="profile-sidebar-nav">
            {scopedLinks.map((link) => {
              const Icon = link.icon ?? Home
              const active = isActivePath(pathname, link.href)
              return (
                <Link key={link.href} href={link.href} className={`profile-sidebar-link ${active ? 'is-active' : ''}`}>
                  <Icon size={18} />
                  <span>{link.label}</span>
                </Link>
              )
            })}
          </nav>

          <div className="profile-sidebar-session">
            <span className="profile-sidebar-session-label">Sessão</span>
            <strong>{userName}</strong>
            <button type="button" onClick={logout} className="profile-sidebar-logout">
              <LogOut size={16} />
              Sair
            </button>
          </div>
        </aside>

        <nav className="profile-mobile-nav">
          {mobileLinks.map((link) => {
            const Icon = link.icon ?? Home
            const active = isActivePath(pathname, link.href)
            return (
              <Link key={link.href} href={link.href} className={`profile-mobile-link ${active ? 'is-active' : ''}`}>
                <Icon size={18} />
                <span>{link.short}</span>
              </Link>
            )
          })}
        </nav>
      </>
    )
  }

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#061426]/92 text-white backdrop-blur-2xl">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-luva-amber opacity-80" />
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4">
          <Link href="/portal" className="group flex min-w-0 items-center gap-3">
            <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl transition duration-300 group-hover:scale-105">
              <Image src="/brand/volei-space_simbolo-orbital_transparente.png" alt="" fill sizes="44px" className="object-contain" priority />
            </span>
            <span className="min-w-0">
              <span className="block font-display text-lg font-black leading-none text-[#ffffff]"> </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-7 lg:flex">
            {desktopLinks.map(({ href, label }) => {
              const active = isActivePath(pathname, href)
              return (
                <Link
                  key={href}
                  href={href}
                  className={`system-nav-link relative py-2 text-sm font-black transition ${
                    active ? 'is-active text-white' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {label}
                  <span className={`absolute inset-x-0 -bottom-0.5 h-0.5 rounded-full bg-luva-amber transition ${
                    active ? 'opacity-100' : 'opacity-0'
                  }`} />
                </Link>
              )
            })}
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-full border border-white/15 bg-white/8 px-4 py-2 text-sm font-black text-slate-100 transition hover:border-luva-amber/70 hover:text-white"
              >
                Entrar
              </Link>
              <Link
                href="/seja-membro"
                className="signup-header-link rounded-full bg-luva-amber px-4 py-2 text-sm font-black text-white transition hover:bg-luva-amber"
              >
                Seja membro
              </Link>
            </div>
          </nav>
        </div>
      </header>

      {!pathname.startsWith('/partidas') && (
        <nav
          className="public-mobile-nav fixed inset-x-3 z-50 grid rounded-2xl border border-white/10 bg-[#061426]/94 p-1.5 shadow-2xl shadow-slate-950/40 backdrop-blur-2xl lg:hidden"
          style={{ gridTemplateColumns: `repeat(${mobileLinks.length}, minmax(0, 1fr))` }}
        >
          {mobileLinks.map(({ href, short }) => {
            const active = isActivePath(pathname, href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex min-h-11 items-center justify-center rounded-xl px-1 text-[10px] font-black transition ${
                  active ? 'bg-luva-amber text-white' : 'text-slate-300'
                }`}
              >
                {short}
              </Link>
            )
          })}
        </nav>
      )}
    </>
  )
}

function getHeaderLinks(session: HeaderSession | null): HeaderLink[] {
  if (!session) return publicLinks

  if (session.tipo === 'equipe') {
    const scoped = (href: string) => {
      if (!session.candidaturaId) return href
      const separator = href.includes('?') ? '&' : '?'
      return `${href}${separator}candidaturaId=${encodeURIComponent(session.candidaturaId)}`
    }

    return [
      { href: '/capitao', label: 'Painel', short: 'Painel', icon: Home },
      { href: scoped('/campeonatos'), label: 'Campeonatos', short: 'Ligas', icon: Trophy },
      { href: scoped('/portal'), label: 'Portal público', short: 'Portal', icon: ClipboardCheck },
      { href: scoped('/jogos'), label: 'Jogos', short: 'Jogos', icon: CalendarDays },
      { href: '/capitao#elenco', label: 'Elenco', short: 'Elenco', icon: UsersRound },
    ]
  }

  if (session.tipo === 'publico') {
    return [
      { href: '/portal', label: 'Portal', short: 'Portal', icon: ClipboardCheck },
      { href: '/campeonatos', label: 'Campeonatos', short: 'Eventos', icon: Trophy },
      { href: '/jogos', label: 'Jogos', short: 'Jogos', icon: CalendarDays },
      { href: '/classificacao', label: 'Tabela', short: 'Tabela', icon: Table2 },
      { href: '/galeria', label: 'Galeria', short: 'Mídia', icon: Images },
    ]
  }

  if (session.tipo === 'organizador') {
    return [
      { href: '/painel', label: 'Painel', short: 'Painel', icon: Home },
      { href: '/painel?secao=campeonatos', label: 'Campeonatos', short: 'Ligas', icon: Trophy },
      { href: '/painel?secao=parametrizacao', label: 'Parametrização', short: 'Param.', icon: SlidersHorizontal },
      { href: '/painel?secao=tabela', label: 'Tabela', short: 'Tabela', icon: Table2 },
      { href: '/painel?secao=jogos', label: 'Jogos', short: 'Jogos', icon: CalendarDays },
      { href: '/painel?secao=galeria', label: 'Galeria', short: 'Mídia', icon: Images },
    ]
  }

  if (session.tipo === 'arbitro') {
    return [
      { href: '/painel', label: 'Painel', short: 'Painel', icon: Home },
      { href: '/jogos', label: 'Partidas', short: 'Jogos', icon: CalendarDays },
      { href: '/portal', label: 'Portal público', short: 'Portal', icon: ClipboardCheck },
    ]
  }

  if (session.tipo === 'quadra') {
    return [
      { href: '/painel', label: 'Painel', short: 'Painel', icon: Home },
      { href: '/jogos', label: 'Agenda', short: 'Agenda', icon: CalendarDays },
      { href: '/portal', label: 'Portal público', short: 'Portal', icon: MapPin },
    ]
  }

  return publicLinks
}

function getMobileLinks(scopedLinks: HeaderLink[], panelHref: string | null): HeaderLink[] {
  if (panelHref) {
    const hasPanel = scopedLinks.some((link) => link.href.split('?')[0].split('#')[0] === panelHref)
    return hasPanel ? scopedLinks.slice(0, 5) : [...scopedLinks, { href: panelHref, label: 'Painel', short: 'Painel', icon: Home }].slice(0, 5)
  }

  return [
    ...scopedLinks,
    { href: '/login', label: 'Entrar', short: 'Entrar', icon: ShieldCheck },
    { href: '/seja-membro', label: 'Seja membro', short: 'Membro', icon: ClipboardCheck },
  ]
}

function isActivePath(pathname: string, href: string) {
  if (href.includes('#')) return false
  const cleanHref = href.split('?')[0].split('#')[0]
  if (cleanHref === '/painel/parametrizacao') {
    return pathname === cleanHref || pathname.startsWith(`${cleanHref}/`)
  }
  return cleanHref === pathname
}

function getProfileLabel(tipo: string) {
  if (tipo === 'equipe') return 'Equipe'
  if (tipo === 'arbitro') return 'Árbitro'
  if (tipo === 'quadra') return 'Quadra'
  if (tipo === 'organizador') return 'Organizador'
  if (tipo === 'publico') return 'Público'
  return 'Perfil'
}

function logout() {
  void encerrarSessaoPublica()
}
