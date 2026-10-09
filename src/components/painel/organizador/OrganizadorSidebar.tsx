'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { CalendarDays, ClipboardCheck, Home, Images, LogOut, Radio, Settings, SlidersHorizontal, Table2, Trophy, type LucideIcon } from 'lucide-react'
import { consultar } from '@/lib/api-cliente'
import { encerrarSessaoPublica } from '@/lib/sessao-publica'

export type PainelView = 'home' | 'parametrizacao' | 'campeonatos' | 'tabela' | 'jogos' | 'aovivo' | 'galeria' | 'settings'

type ItemMenu = {
  key: PainelView | 'portal' | 'rankings'
  label: string
  short: string
  icon: LucideIcon
}

const ITENS: ItemMenu[] = [
  { key: 'home', label: 'Início', short: 'Início', icon: Home },
  { key: 'parametrizacao', label: 'Parametrização', short: 'Param.', icon: SlidersHorizontal },
  { key: 'campeonatos', label: 'Campeonatos', short: 'Campeonatos', icon: Trophy },
  { key: 'tabela', label: 'Classificação', short: 'Tabela', icon: Table2 },
  { key: 'jogos', label: 'Jogos', short: 'Jogos', icon: CalendarDays },
  { key: 'aovivo', label: 'Ao vivo', short: 'Ao vivo', icon: Radio },
  { key: 'galeria', label: 'Galeria', short: 'Galeria', icon: Images },
  { key: 'settings', label: 'Configurações', short: 'Ajustes', icon: Settings },
  { key: 'portal', label: 'Portal', short: 'Portal', icon: ClipboardCheck },
  { key: 'rankings', label: 'Rankings', short: 'Rankings', icon: Trophy },
]

function ligaDaConsulta(valor: string | null) {
  return valor && /^\d+$/.test(valor) ? valor : null
}

function enderecoDoItem(item: ItemMenu, ligaId: string | null) {
  if (item.key === 'portal' || item.key === 'rankings') {
    return ligaId ? `/${item.key}?ligaId=${ligaId}` : `/${item.key}`
  }
  const params = new URLSearchParams()
  if (item.key !== 'home') params.set('secao', item.key)
  if (ligaId) params.set('ligaId', ligaId)
  const consulta = params.toString()
  return consulta ? `/painel?${consulta}` : '/painel'
}

function itemAtivo(pathname: string, secao: string | null): ItemMenu['key'] | null {
  if (pathname === '/portal' || pathname.startsWith('/portal/')) return 'portal'
  if (pathname === '/rankings' || pathname.startsWith('/rankings/')) return 'rankings'
  if (pathname.startsWith('/painel/parametrizacao') || pathname.startsWith('/painel/estrutura')) return 'parametrizacao'
  if (pathname.startsWith('/painel/campeonatos')) return 'campeonatos'
  if (pathname !== '/painel') return null
  if (secao === 'parametrizacao' || secao === 'campeonatos' || secao === 'tabela' || secao === 'jogos' || secao === 'aovivo' || secao === 'galeria' || secao === 'settings') {
    return secao
  }
  return 'home'
}

export function OrganizadorSidebar() {
  const pathname = usePathname()
  const busca = useSearchParams()
  const ligaId = ligaDaConsulta(busca.get('ligaId'))
  const ativo = itemAtivo(pathname, busca.get('secao'))
  const [organizacaoNome, setOrganizacaoNome] = useState<string | null>(null)
  const [organizacaoLogoUrl, setOrganizacaoLogoUrl] = useState<string | null>(null)
  const [perfilLido, setPerfilLido] = useState(false)

  useEffect(() => {
    const controlador = new AbortController()
    consultar<{ data?: { organizacao?: string; logoUrl?: string } }>('/api/organizador/perfil', { signal: controlador.signal })
      .then((json) => {
        setOrganizacaoNome(json.data?.organizacao?.trim() || null)
        setOrganizacaoLogoUrl(json.data?.logoUrl?.trim() || null)
      })
      .catch(() => {})
      .finally(() => setPerfilLido(true))
    return () => controlador.abort()
  }, [pathname])

  useEffect(() => {
    function atualizar(evento: Event) {
      const detalhe = (evento as CustomEvent<{ organizacao?: string; logoUrl?: string }>).detail
      if (!detalhe) return
      setOrganizacaoNome(detalhe.organizacao?.trim() || null)
      setOrganizacaoLogoUrl(detalhe.logoUrl?.trim() || null)
      setPerfilLido(true)
    }
    window.addEventListener('volei-organizacao', atualizar)
    return () => window.removeEventListener('volei-organizacao', atualizar)
  }, [])

  const obfuscated = perfilLido && !organizacaoNome
  const inicial = (organizacaoNome ?? '?').trim().charAt(0).toUpperCase()

  return (
    <>
      <aside className="profile-sidebar">
        <Link href={enderecoDoItem(ITENS[0], ligaId)} className="profile-sidebar-brand">
          <span className="relative h-[45px] w-[135px] shrink-0">
            <Image src="/brand/volei-space_wordmark_transparente.png" alt="volei.space" fill sizes="135px" className="object-contain object-left" priority />
          </span>
        </Link>

        <nav className={`profile-sidebar-nav ${obfuscated ? 'pointer-events-none opacity-40 saturate-50 brightness-90' : ''}`} style={{ marginTop: obfuscated ? 24 : undefined }} aria-hidden={obfuscated}>
          {ITENS.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.key}
                href={enderecoDoItem(item, ligaId)}
                tabIndex={obfuscated ? -1 : 0}
                className={`profile-sidebar-link ${ativo === item.key ? 'is-active' : ''}`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
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
                <span>{inicial}</span>
              )}
            </span>
            <strong className="!mt-0 truncate">{organizacaoNome || 'Sua organização'}</strong>
          </div>
          <button type="button" onClick={() => void encerrarSessaoPublica()} className="profile-sidebar-logout">
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </aside>

      <nav className="profile-mobile-nav">
        {ITENS.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.key}
              href={enderecoDoItem(item, ligaId)}
              aria-disabled={obfuscated}
              tabIndex={obfuscated ? -1 : 0}
              className={`profile-mobile-link ${ativo === item.key ? 'is-active' : ''} ${obfuscated ? 'pointer-events-none opacity-40' : ''}`}
            >
              <Icon size={18} />
              <span>{item.short}</span>
            </Link>
          )
        })}
        <button type="button" onClick={() => void encerrarSessaoPublica()} className="profile-mobile-link">
          <LogOut size={18} />
          <span>Sair</span>
        </button>
      </nav>
    </>
  )
}
