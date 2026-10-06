'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus } from 'lucide-react'
import { ActionBar } from '@/components/ui/action-bar'
import { slugify } from '@/utils/slug'
import type { PainelView } from './OrganizadorSidebar'
import { ParametrizacaoNoPainel } from './PainelSecoes'
import { PainelCampeonatos, PainelGaleria, PainelJogos, PainelTabela } from './PainelConteudos'
import { PainelAoVivo } from './PainelAoVivo'
import { InicioPortal } from './InicioPortal'
import { OrganizacaoForm, type OrganizacaoFormValues } from './OrganizacaoForm'
import { consultar, invalidarConsultas, lerJson } from '@/lib/api-cliente'
import type { LigaCarouselItem } from './types'

const SECOES = new Set<string>(['parametrizacao', 'campeonatos', 'tabela', 'jogos', 'aovivo', 'galeria', 'settings'])

interface Session {
  tipo: string
  nome?: string
  candidaturaId?: string | null
}

// Orquestrador da nova home do organizador (/painel). Busca perfil da
// organização + ligas 1x no mount; sidebar e carrossel têm estados
// independentes entre si (item 36) — aqui só decide QUAL conteúdo mostrar à
// direita (onboarding / carrossel-empty-state / configurações).
export function OrganizadorHome({ session }: { session: Session }) {
  const organizadorId = session.candidaturaId ?? ''
  const router = useRouter()
  const busca = useSearchParams()
  const secao = busca.get('secao')
  const view: PainelView = secao && SECOES.has(secao) ? (secao as PainelView) : 'home'

  const [loading, setLoading] = useState(true)
  const [perfil, setPerfil] = useState<OrganizacaoFormValues | null>(null)
  const [ligas, setLigas] = useState<LigaCarouselItem[]>([])
  const [activeChampionshipId, setActiveChampionshipId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [passo, setPasso] = useState<0 | 1 | 2 | 3>(0)
  const [nomeCampeonato, setNomeCampeonato] = useState('')
  const [nomeCategoria, setNomeCategoria] = useState('')
  const [linkCategoria, setLinkCategoria] = useState('')

  useEffect(() => {
    if (secao === 'portal') router.replace('/painel', { scroll: false })
  }, [router, secao])

  useEffect(() => {
    const liga = Number(busca.get('ligaId'))
    if (Number.isInteger(liga) && liga > 0) setActiveChampionshipId(liga)
  }, [busca])

  function enderecoDoPainel(proxima: PainelView, liga: number | null) {
    const params = new URLSearchParams()
    if (proxima !== 'home') params.set('secao', proxima)
    if (liga) params.set('ligaId', String(liga))
    const consulta = params.toString()
    return consulta ? `/painel?${consulta}` : '/painel'
  }

  function escolherCampeonato(id: number) {
    setActiveChampionshipId(id)
    router.replace(enderecoDoPainel(view, id), { scroll: false })
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
        if (ligasData.length > 0) {
          const pedido = Number(new URLSearchParams(window.location.search).get('ligaId'))
          setActiveChampionshipId((current) => {
            const escolhido = current ?? (Number.isInteger(pedido) ? pedido : null)
            return ligasData.some((liga) => liga.id === escolhido) ? escolhido : ligasData[0].id
          })
        }
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
    setPerfil(values)
    window.dispatchEvent(new CustomEvent('volei-organizacao', { detail: values }))
  }

  async function criarCampeonatoFluxo() {
    if (!organizadorId || creating) return
    const nome = nomeCampeonato.trim()
    const categoria = nomeCategoria.trim()
    if (nome.length < 2 || categoria.length < 2) {
      setFeedback('Informe o nome do campeonato e da categoria.')
      return
    }
    setCreating(true)
    setFeedback(null)
    try {
      const slug = `${slugify(nome)}-c${Date.now().toString(36)}`
      const response = await fetch('/api/ligas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizadorId, nome, slug, status: 'EM_BREVE' }),
      })
      const json = await lerJson<{ error?: string; data?: { id: number; slug?: string; nome?: string; status?: string } }>(response)
      if (!response.ok || !json.data) throw new Error(json.error ?? 'Erro ao criar campeonato')
      const categoriaResposta = await fetch(`/api/organizador/ligas/${json.data.id}/categoria-inicial`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: categoria }),
      })
      const categoriaJson = await lerJson<{ error?: string; data?: { caminho?: string } }>(categoriaResposta)
      if (!categoriaResposta.ok || !categoriaJson.data?.caminho) throw new Error(categoriaJson.error ?? 'Campeonato criado, mas o link da categoria falhou.')
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
      setLinkCategoria(`${window.location.origin}${categoriaJson.data.caminho}`)
      setPasso(3)
      setCreating(false)
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao criar campeonato')
      setCreating(false)
    }
  }

  const organizacaoIncompleta = !loading && !perfil?.organizacao
  const criarCampeonato = (
    <div className="mb-6">
      <div className="flex justify-end">
        <ActionBar
          type="button"
          onClick={() => { setPasso(1); setFeedback(null) }}
          loadingLabel="Criando"
          className="inline-flex items-center gap-2 rounded-full bg-luva-amber px-4 py-2.5 text-sm font-black text-[#050914] transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus size={16} />
          Novo Campeonato
        </ActionBar>
      </div>
      {passo > 0 && (
        <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ffb331]">Passo {Math.min(passo, 3)} de 3</p>
          {passo === 1 && (
            <label className="mt-4 block">
              <span className="text-sm font-black text-white">Nome do campeonato</span>
              <input value={nomeCampeonato} onChange={(evento) => setNomeCampeonato(evento.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-semibold text-white" />
              <button type="button" className="mt-4 rounded-full bg-[#ffb331] px-5 py-3 text-sm font-black text-slate-950" onClick={() => nomeCampeonato.trim().length >= 2 ? setPasso(2) : setFeedback('Informe o nome do campeonato.')}>Continuar</button>
            </label>
          )}
          {passo === 2 && (
            <label className="mt-4 block">
              <span className="text-sm font-black text-white">Categoria</span>
              <input value={nomeCategoria} onChange={(evento) => setNomeCategoria(evento.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-semibold text-white" placeholder="Ex.: Masculino" />
              <button type="button" className="mt-4 rounded-full bg-[#ffb331] px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-60" disabled={creating} onClick={() => void criarCampeonatoFluxo()}>{creating ? 'Criando…' : 'Criar e gerar link'}</button>
            </label>
          )}
          {passo === 3 && (
            <div className="mt-4">
              <p className="text-sm font-black text-white">Link da categoria</p>
              <p className="mt-2 break-all rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-slate-100">{linkCategoria}</p>
              <button type="button" className="mt-4 rounded-full bg-[#ffb331] px-5 py-3 text-sm font-black text-slate-950" onClick={() => void navigator.clipboard.writeText(linkCategoria)}>Copiar link</button>
              <p className="mt-3 text-sm font-semibold text-slate-300">O campeonato já existe. Grupos e o restante da configuração ficam para depois que as equipes entrarem.</p>
            </div>
          )}
        </div>
      )}
      {feedback && <p className="mt-4 text-sm font-bold text-red-300">{feedback}</p>}
    </div>
  )

  return (
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
              {view === 'settings' && (
                <div className="luva-card w-full rounded-2xl p-6 sm:p-8">
                  <OrganizacaoForm mode="settings" initialValues={perfil!} onSaved={handleOnboardingSaved} />
                </div>
              )}
              {view === 'parametrizacao' && (
                <div>
                  {criarCampeonato}
                  <ParametrizacaoNoPainel ligas={ligas} campeonatoId={activeChampionshipId} onSelect={escolherCampeonato} />
                </div>
              )}
              {view === 'home' && (
                <InicioPortal organizadorId={organizadorId} ativo={view === 'home'} />
              )}
              {view === 'campeonatos' && (
                <div>
                  {criarCampeonato}
                  <PainelCampeonatos ligas={ligas} />
                </div>
              )}
              {view === 'tabela' && <PainelTabela ligas={ligas} organizadorId={organizadorId} campeonatoId={activeChampionshipId} onSelect={escolherCampeonato} />}
              {view === 'jogos' && <PainelJogos ligas={ligas} campeonatoId={activeChampionshipId} onSelect={escolherCampeonato} />}
              {view === 'aovivo' && <PainelAoVivo ligas={ligas} campeonatoId={activeChampionshipId} onSelect={escolherCampeonato} />}
              {view === 'galeria' && <PainelGaleria ligas={ligas} campeonatoId={activeChampionshipId} onSelect={escolherCampeonato} />}
            </>
          )}
        </section>
      </main>
  )
}
