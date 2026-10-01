'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { ActionBar } from '@/components/ui/action-bar'
import { slugify } from '@/utils/slug'
import { OrganizadorSidebar, type PainelView } from './OrganizadorSidebar'
import { ParametrizacaoNoPainel } from './PainelSecoes'
import { PainelCampeonatos, PainelGaleria, PainelJogos, PainelTabela } from './PainelConteudos'
import { InicioPortal } from './InicioPortal'
import { OrganizacaoForm, type OrganizacaoFormValues } from './OrganizacaoForm'
import { consultar, invalidarConsultas, lerJson } from '@/lib/api-cliente'
import type { LigaCarouselItem } from './types'

const SECOES = new Set<string>(['parametrizacao', 'campeonatos', 'tabela', 'jogos', 'galeria', 'settings'])

interface Session {
  tipo: string
  nome?: string
  candidaturaId?: string | null
}

// Orquestrador da nova home do organizador (/painel). Busca perfil da
// organização + ligas 1x no mount; sidebar e carrossel têm estados
// independentes entre si (item 36) — aqui só decide QUAL conteúdo mostrar à
// direita (onboarding / carrossel-empty-state / configurações).
export function OrganizadorHome({ session, logout }: { session: Session; logout: () => void }) {
  const organizadorId = session.candidaturaId ?? ''

  const [loading, setLoading] = useState(true)
  const [perfil, setPerfil] = useState<OrganizacaoFormValues | null>(null)
  const [ligas, setLigas] = useState<LigaCarouselItem[]>([])
  const [view, setView] = useState<PainelView>('home')
  const [abertas, setAbertas] = useState<PainelView[]>(['home'])
  const [activeChampionshipId, setActiveChampionshipId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    const secao = new URLSearchParams(window.location.search).get('secao')
    if (secao === 'portal') {
      setView('home')
      window.history.replaceState(null, '', '/painel')
      return
    }
    if (secao && SECOES.has(secao)) {
      const proxima = secao as PainelView
      setView(proxima)
      setAbertas((atual) => atual.includes(proxima) ? atual : [...atual, proxima])
    }
  }, [])

  function abrir(next: PainelView) {
    setAbertas((atual) => atual.includes(next) ? atual : [...atual, next])
  }

  function selectView(next: PainelView) {
    setView(next)
    abrir(next)
    const url = next === 'home' ? '/painel' : `/painel?secao=${next}`
    window.history.replaceState(null, '', url)
  }

  useEffect(() => {
    if (!organizadorId) {
      setLoading(false)
      return
    }
    let cancelled = false

    const controlador = new AbortController()
    Promise.all([
      consultar<{ data?: OrganizacaoFormValues }>(`/api/organizador/perfil`, { signal: controlador.signal }),
      consultar<{ data?: LigaCarouselItem[] }>(`/api/ligas?organizadorId=${encodeURIComponent(organizadorId)}`, { signal: controlador.signal }),
    ])
      .then(([perfilJson, ligasJson]) => {
        if (cancelled) return
        if (perfilJson.data) {
          setPerfil({
            organizacao: perfilJson.data.organizacao ?? '',
            cidade: perfilJson.data.cidade ?? '',
            logoUrl: perfilJson.data.logoUrl ?? '',
          })
        }
        const ligasData: LigaCarouselItem[] = (Array.isArray(ligasJson.data) ? ligasJson.data : []).filter((liga) => liga.simulacao !== true)
        setLigas(ligasData)
        if (ligasData.length > 0) setActiveChampionshipId((current) => current ?? ligasData[0].id)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      controlador.abort()
    }
  }, [organizadorId])

  function handleOnboardingSaved(values: OrganizacaoFormValues) {
    // Atualiza o estado local — sem refetch, sem reload (item 10).
    setPerfil(values)
  }

  async function criarCampeonato() {
    if (!organizadorId || creating) return
    setCreating(true)
    setFeedback(null)
    try {
      const nome = 'Novo campeonato'
      const slug = `${slugify(nome)}-c${Date.now().toString(36)}`
      const response = await fetch('/api/ligas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizadorId, nome, slug, status: 'EM_BREVE' }),
      })
      const json = await lerJson<{ error?: string; data?: { id: number; slug?: string; nome?: string; status?: string } }>(response)
      if (!response.ok || !json.data) throw new Error(json.error ?? 'Erro ao criar campeonato')
      invalidarConsultas('/api/ligas')
      const criado: LigaCarouselItem = {
        id: json.data.id,
        slug: json.data.slug ?? slug,
        nome: json.data.nome ?? nome,
        logoUrl: null,
        capaUrl: null,
        dataInicio: null,
        dataFim: null,
        status: json.data.status ?? 'EM_BREVE',
        localPrincipal: null,
        categoriasReais: [],
      }
      setLigas((current) => [criado, ...current.filter((liga) => liga.id !== criado.id)])
      setActiveChampionshipId(criado.id)
      selectView('parametrizacao')
      setCreating(false)
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao criar campeonato')
      setCreating(false)
    }
  }

  const organizacaoIncompleta = !loading && !perfil?.organizacao

  return (
    <>
      <OrganizadorSidebar
        view={view}
        onSelectView={selectView}
        organizacaoNome={perfil?.organizacao || null}
        organizacaoLogoUrl={perfil?.logoUrl || null}
        onLogout={logout}
        obfuscated={organizacaoIncompleta}
      />

      {/* Mesmo padrão de /painel/campeonatos/page.tsx: main.luva-shell.public-dashboard.creator-dashboard
          sem aside própria — o deslocamento para a .profile-sidebar fixa acontece
          automaticamente via CSS global (:has(.profile-sidebar) > main). */}
      <main className="luva-shell public-dashboard creator-dashboard min-h-screen text-white">
        <section className="w-full min-w-0 px-6 py-8">
          {loading ? (
            <p className="text-sm font-bold text-white/50">Carregando...</p>
          ) : organizacaoIncompleta ? (
            <div className="luva-card w-full rounded-2xl p-6 sm:p-8">
              <OrganizacaoForm mode="onboarding" initialValues={perfil ?? { organizacao: '', cidade: '', logoUrl: '' }} onSaved={handleOnboardingSaved} />
            </div>
          ) : (
            <>
              {abertas.includes('settings') && (
                <div hidden={view !== 'settings'}>
                  <div className="luva-card w-full rounded-2xl p-6 sm:p-8">
                    <OrganizacaoForm mode="settings" initialValues={perfil!} onSaved={handleOnboardingSaved} />
                  </div>
                </div>
              )}
              {abertas.includes('parametrizacao') && (
                <div hidden={view !== 'parametrizacao'}>
                  <ParametrizacaoNoPainel ligas={ligas} campeonatoId={activeChampionshipId} onSelect={setActiveChampionshipId} />
                </div>
              )}
              {abertas.includes('home') && (
                <div hidden={view !== 'home'}>
                  <div className="mb-6 flex justify-end">
                    <ActionBar
                      type="button"
                      onClick={criarCampeonato}
                      loading={creating}
                      loadingLabel="Criando"
                      className="inline-flex items-center gap-2 rounded-full bg-luva-amber px-4 py-2.5 text-sm font-black text-[#050914] transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Plus size={16} />
                      Novo Campeonato
                    </ActionBar>
                  </div>
                  {feedback && <p className="mb-4 text-sm font-bold text-red-300">{feedback}</p>}
                  <InicioPortal organizadorId={organizadorId} ativo={view === 'home'} />
                </div>
              )}
              {abertas.includes('campeonatos') && <div hidden={view !== 'campeonatos'}><PainelCampeonatos ligas={ligas} /></div>}
              {abertas.includes('tabela') && <div hidden={view !== 'tabela'}><PainelTabela ligas={ligas} organizadorId={organizadorId} /></div>}
              {abertas.includes('jogos') && <div hidden={view !== 'jogos'}><PainelJogos ligas={ligas} ativo={view === 'jogos'} /></div>}
              {abertas.includes('galeria') && <div hidden={view !== 'galeria'}><PainelGaleria ligas={ligas} /></div>}
            </>
          )}
        </section>
      </main>
    </>
  )
}
