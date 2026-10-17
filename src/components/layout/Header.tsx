'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarDays,
  ClipboardCheck,
  Home,
  Images,
  LogOut,
  MapPin,
  ShieldCheck,
  Table2,
  Trophy,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import { InstagramIcon } from '@/components/landing/InstagramIcon'
import { OrganizadorSidebar } from '@/components/painel/organizador/OrganizadorSidebar'
import { rotaSemMicroInteracao } from '@/lib/motion-rotas'
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

const TELAS_DO_PORTAL = new Set(['/portal', '/jogos', '/classificacao', '/rankings', '/galeria'])

function linksDoPortal(ligaId: string | null): HeaderLink[] {
  const consulta = ligaId ? `?ligaId=${encodeURIComponent(ligaId)}` : ''
  return [
    { href: `/portal${consulta}`, label: 'Portal', short: 'Portal', icon: ClipboardCheck },
    { href: `/jogos${consulta}`, label: 'Jogos', short: 'Jogos', icon: CalendarDays },
    { href: `/classificacao${consulta}`, label: 'Classificação', short: 'Classificação', icon: Table2 },
    { href: `/rankings${consulta}`, label: 'Rankings', short: 'Rankings', icon: Trophy },
    { href: `/galeria${consulta}`, label: 'Galeria', short: 'Galeria', icon: Images },
  ]
}

export function Header() {
  const pathname = usePathname()
  const busca = useSearchParams()
  const ligaInformada = busca.get('ligaId')
  const ligaId = ligaInformada && /^\d+$/.test(ligaInformada) ? ligaInformada : null
  const [hydrated, setHydrated] = useState(false)
  const [session, setSession] = useState<HeaderSession | null>(null)
  const [menuAberto, setMenuAberto] = useState(false)
  const [menuVisivel, setMenuVisivel] = useState(false)
  const menuTimer = useRef<number | null>(null)
  const semMotion = rotaSemMicroInteracao(pathname)
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
  const telaDoPortal = TELAS_DO_PORTAL.has(pathname)
  const scopedLinks = useMemo(
    () => {
      if (telaDoPortal) return linksDoPortal(ligaId)
      if (isLegalPage && !session) return []
      if (!session || session.tipo === 'publico') return linksDoPortal(ligaId)
      return getHeaderLinks(session, ligaId)
    },
    [isLegalPage, ligaId, session, telaDoPortal],
  )
  const desktopLinks = useMemo(() => {
    if (!panelHref || telaDoPortal) return scopedLinks
    return scopedLinks.filter((link) => {
      const cleanHref = link.href.split('?')[0].split('#')[0]
      return cleanHref !== panelHref || link.href.includes('#')
    })
  }, [panelHref, scopedLinks, telaDoPortal])
  const mobileLinks = useMemo(
    () => telaDoPortal ? scopedLinks : getMobileLinks(scopedLinks, panelHref),
    [scopedLinks, panelHref, telaDoPortal],
  )

  const fecharMenu = useCallback(() => {
    if (!menuAberto) return
    if (menuTimer.current) window.clearTimeout(menuTimer.current)
    setMenuAberto(false)
    menuTimer.current = window.setTimeout(() => setMenuVisivel(false), 180)
  }, [menuAberto])

  const alternarMenu = useCallback(() => {
    if (menuTimer.current) window.clearTimeout(menuTimer.current)
    if (menuAberto) {
      setMenuAberto(false)
      menuTimer.current = window.setTimeout(() => setMenuVisivel(false), 180)
      return
    }
    setMenuVisivel(true)
    setMenuAberto(true)
  }, [menuAberto])

  useEffect(() => {
    try {
      setSession(JSON.parse(window.localStorage.getItem('luva_session') ?? 'null'))
    } catch {
      setSession(null)
    }
    setHydrated(true)
  }, [pathname])

  useEffect(() => {
    if (menuTimer.current) window.clearTimeout(menuTimer.current)
    setMenuAberto(false)
    setMenuVisivel(false)
  }, [pathname])

  useEffect(() => {
    if (!menuAberto) return
    const fechar = (event: KeyboardEvent) => {
      if (event.key === 'Escape') fecharMenu()
    }
    window.addEventListener('keydown', fechar)
    return () => window.removeEventListener('keydown', fechar)
  }, [fecharMenu, menuAberto])

  useEffect(() => () => {
    if (menuTimer.current) window.clearTimeout(menuTimer.current)
  }, [])

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

  if (pathname.startsWith('/banco') || pathname.startsWith('/scout') || pathname.startsWith('/ao-vivo/')) return null

  if (pathname.startsWith('/arbitro') || pathname.startsWith('/sumula')) {
    return (
      <div className="sticky top-0 z-50 flex justify-end border-b border-white/10 bg-[#061426]/92 px-4 py-2">
        <BotaoSair />
      </div>
    )
  }

  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/cadastro') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/resetar-senha') ||
    pathname.startsWith('/trocar-senha') ||
    pathname.startsWith('/inscricao')
  ) {
    return null
  }

  if (!hydrated && pathname !== '/') return <CabecalhoReservado />

  if (pathname === '/') {
    return (
      <header className="landing-header">
        <div className="landing-header-inner">
          <Link href="/" className="landing-brand">
            <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl">
              <Image src="/brand/volei-space_simbolo-orbital_transparente.png" alt="volei.space" aria-hidden="true" fill sizes="70px" className="object-contain" priority />
            </span>
            <span>
              <strong>volei.space</strong>
            </span>
          </Link>

          <nav className="landing-nav">
            <a href="#temporada">Campeonato</a>
            <a href="#funcionalidades">Funcionalidades</a>
            <a href="#portal-preview">Prévia</a>
            <a href="#etapas">Etapas</a>
            <Link href="/portal">Portal</Link>
          </nav>

          <div className="landing-header-actions">
             {session ? <BotaoSair /> : <Link href="/login">Entre ou Cadastre-se</Link>}
          </div>
        </div>
      </header>
    )
  }

  if (session?.tipo === 'organizador') {
    return <OrganizadorSidebar />
  }

  if (session && panelHref && !telaDoPortal) {
    const profileLabel = getProfileLabel(session.tipo)
    const userName = session.nome || profileLabel

    return (
      <>
        <aside className="profile-sidebar">
          <Link href={panelHref} className="profile-sidebar-brand">
            <span className="relative h-[45px] w-[135px] shrink-0">
              <Image src="/brand/volei-space_wordmark_transparente.png" alt="volei.space" fill sizes="135px" className="object-contain object-left" priority />
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
            <button type="button" onClick={logout} className="profile-sidebar-link profile-sidebar-logout">
              <LogOut size={18} />
              <span>Sair</span>
            </button>
          </nav>

          <div className="profile-sidebar-session">
            <span className="profile-sidebar-session-label">Sessão</span>
            <strong>{userName}</strong>
          </div>
        </aside>

        <nav className="profile-mobile-nav" aria-label="Menu do painel">
          <div className="profile-mobile-scroll">
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
            <BotaoSair compacto />
          </div>
        </nav>
      </>
    )
  }

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#061426]/92 text-white backdrop-blur-2xl">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-luva-amber opacity-80" />
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4">
          <Link href="/" className="group flex min-w-0 items-center gap-3">
            <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl transition duration-300 group-hover:scale-105">
              <Image src="/brand/volei-space_simbolo-orbital_transparente.png" alt="volei.space" aria-hidden="true" fill sizes="44px" className="object-contain" priority />
            </span>
            <span className="min-w-0">
              <span className="block font-display text-lg font-black leading-none text-[#ffffff]">volei.space</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-4 xl:gap-6 lg:flex">
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
              {session ? <BotaoSair /> : !telaDoPortal ? (
                <Link
                  href="/login"
                  className="rounded-full border border-white/15 bg-white/8 px-4 py-2 text-sm font-black text-slate-100 transition hover:border-luva-amber/70 hover:text-white"
                >
                  Entrar
                </Link>
              ) : null}
            </div>
          </nav>

          {!semMotion && (
            <button
              type="button"
              className="vs-menu-toggle lg:hidden"
              aria-expanded={menuAberto}
              aria-controls="menu-principal"
              aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
              onClick={alternarMenu}
            >
              <span />
              <span />
              <span />
            </button>
          )}
        </div>

        {!semMotion && menuVisivel && (
          <nav
            id="menu-principal"
            aria-label="Menu"
            className={`vs-menu-panel grid gap-1 px-4 pb-4 lg:hidden ${menuAberto ? '' : 'is-closing'}`}
          >
            {mobileLinks.map(({ href, label }) => {
              const active = isActivePath(pathname, href)
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={fecharMenu}
                  className={`flex min-h-11 items-center rounded-xl px-3 text-sm font-black ${active ? 'is-active text-white' : 'text-slate-300'}`}
                >
                  {label}
                </Link>
              )
            })}
            {session ? <BotaoSair /> : null}
          </nav>
        )}
      </header>

      {!pathname.startsWith('/partidas') && (
        <nav
          className="public-mobile-nav fixed inset-x-3 z-50 flex flex-wrap gap-1 rounded-2xl border border-white/10 bg-[#061426]/94 p-1.5 shadow-2xl shadow-slate-950/40 backdrop-blur-2xl lg:hidden"
        >
          {mobileLinks.map(({ href, label }) => {
            const active = isActivePath(pathname, href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex min-h-11 shrink-0 items-center justify-center rounded-xl px-3 text-xs font-black transition ${
                  active ? 'bg-luva-amber text-white' : 'text-slate-300'
                }`}
              >
                {label}
              </Link>
            )
          })}
          {session ? <BotaoSair compacto /> : null}
        </nav>
      )}
    </>
  )
}

function getHeaderLinks(session: HeaderSession | null, ligaId: string | null = null): HeaderLink[] {
  if (!session) return linksDoPortal(ligaId)

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
    return []
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

  return linksDoPortal(ligaId)
}

function getMobileLinks(scopedLinks: HeaderLink[], panelHref: string | null): HeaderLink[] {
  if (panelHref) {
    const hasPanel = scopedLinks.some((link) => link.href.split('?')[0].split('#')[0] === panelHref)
    return hasPanel ? scopedLinks.slice(0, 5) : [...scopedLinks, { href: panelHref, label: 'Painel', short: 'Painel', icon: Home }].slice(0, 5)
  }

  return [
    ...scopedLinks,
    { href: '/login', label: 'Entrar', short: 'Entrar', icon: ShieldCheck },
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

function BotaoSair({ compacto = false }: { compacto?: boolean }) {
  if (compacto) {
    return (
      <button type="button" onClick={logout} className="profile-mobile-link profile-mobile-logout">
        <LogOut size={18} />
        <span>Sair</span>
      </button>
    )
  }
  return (
    <button type="button" onClick={logout} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 bg-white/8 px-4 py-2 text-sm font-black text-slate-100 transition hover:border-luva-amber/70 hover:text-white">
      <LogOut size={16} />
      Sair
    </button>
  )
}

function CabecalhoReservado() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#061426]/92 text-white backdrop-blur-2xl" aria-hidden="true">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-luva-amber opacity-80" />
      <div className="mx-auto h-[72px] max-w-7xl px-4" />
    </header>
  )
}
