'use client'

import { useEffect, useMemo, useState } from 'react'
import { ConsultaCancelada, consultar } from '@/lib/api-cliente'
import Link from 'next/link'
import { Image as ImageIcon, PlaySquare } from 'lucide-react'
import { ChampionshipTableSection } from '@/components/classificacao/ChampionshipTableSection'
import { EstadoVazio } from '@/components/ui/EstadoVazio'
import { CollapseBar } from '@/components/ui/collapse-bar'
import { AcessoArbitroJogo } from './AcessoArbitroJogo'
import { LinkInscricaoCampeonato } from './LinkInscricaoCampeonato'
import { formatLigaFormato, formatLigaStatus } from '@/lib/format-liga'
import type { LigaCarouselItem } from './types'

const REGRA_TABELA = 'Vitória por 2 sets a 0 vale 3 pontos. Vitória por 2 sets a 1 vale 2 pontos para o vencedor e 1 para o perdedor.'

type LigaLista = {
  id: number
  slug: string
  nome: string
  subtitulo?: string | null
  descricao?: string | null
  status?: string | null
  quantidadeEquipes?: number | null
  formato?: string | null
  inscricoesAbertas?: boolean | null
}

export function PainelCampeonatos({ ligas }: { ligas: LigaLista[] }) {
  const [status, setStatus] = useState('')
  const [busca, setBusca] = useState('')

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return ligas.filter((liga) => {
      if (status && liga.status !== status) return false
      if (!termo) return true
      return [liga.nome, liga.subtitulo, liga.descricao].some((campo) => String(campo ?? '').toLowerCase().includes(termo))
    })
  }, [ligas, status, busca])

  return (
    <section>
      <div className="championship-filter-bar flex flex-col gap-3 rounded-[1.5rem] border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="type-kicker text-luva-amber">Filtro</p>
          <p className="type-lead mt-1">{visiveis.length === 1 ? '1 campeonato nesta lista' : `${visiveis.length} campeonatos nesta lista`}</p>
        </div>
        <form
          className="flex flex-col gap-2 sm:min-w-[280px] sm:flex-row"
          onSubmit={(event) => event.preventDefault()}
        >
          <input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar campeonato..."
            className="championship-search-input rounded-full border px-4 py-2 text-sm font-bold"
          />
        </form>
        <div className="flex flex-wrap gap-2">
          {[
            { value: '', label: 'Todos' },
            { value: 'EM_BREVE', label: 'Em breve' },
            { value: 'ATIVA', label: 'Ativos' },
            { value: 'ENCERRADA', label: 'Encerrados' },
            { value: 'FINALIZADO', label: 'Finalizados' },
          ].map((option) => (
            <button
              key={option.value || 'todos'}
              type="button"
              onClick={() => setStatus(option.value)}
              className={`championship-filter-button rounded-full px-4 py-2 text-sm font-black ${status === option.value ? 'is-active' : ''}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {visiveis.length === 0 ? (
        <div className="mt-8">
          <EstadoVazio titulo="Nenhum campeonato publicado" descricao="Quando você criar campeonatos, eles aparecem nesta página." />
        </div>
      ) : (
        <div className="championship-list mt-8">
          <div className="championship-list-row championship-list-head">
            <span>Nome</span>
            <span>Status</span>
            <span>Descrição</span>
            <span>Equipes</span>
            <span>Formato</span>
            <span>Inscrições</span>
            <span>Ação</span>
          </div>
          {visiveis.map((liga) => (
            <article key={liga.id} className="championship-list-row">
              <div className="championship-list-main">
                <h2>{liga.nome}</h2>
                {liga.subtitulo && <small>{liga.subtitulo}</small>}
              </div>
              <span data-label="Status">{formatLigaStatus(liga.status)}</span>
              <span className="championship-list-description" data-label="Descrição">{liga.descricao || 'Campeonato publicado na plataforma volei.space.'}</span>
              <span data-label="Equipes">{liga.quantidadeEquipes ?? 'A definir'}</span>
              <span data-label="Formato">{formatLigaFormato(liga.formato)}</span>
              <span data-label="Inscrições">{liga.inscricoesAbertas === false ? 'Fechadas' : 'Abertas'}</span>
              <span className="flex flex-col items-start gap-2">
                <Link href={`/painel/parametrizacao/previa?ligaId=${liga.id}`} className="championship-list-link">Prévia</Link>
                <LinkInscricaoCampeonato ligaId={liga.id} nome={liga.nome} compacto />
                <Link href={`/campeonatos/${liga.slug}`} className="championship-list-link">Ver campeonato</Link>
              </span>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export function PainelTabela({ ligas, organizadorId }: { ligas: LigaCarouselItem[]; organizadorId: string }) {
  const [tabelas, setTabelas] = useState<Array<{ id: number; nome: string; dados: any[]; pendente: boolean }>>([])

  useEffect(() => {
    if (ligas.length === 0) {
      setTabelas([])
      return
    }
    const controlador = new AbortController()
    setTabelas(ligas.map((liga) => ({ id: liga.id, nome: liga.nome, dados: [], pendente: true })))
    const ids = ligas.map((liga) => liga.id).join(',')
    consultar<{ data?: Array<{ ligaId?: number }> }>(`/api/classificacao?ligaIds=${ids}`, { signal: controlador.signal })
      .then((payload) => {
        const linhas = Array.isArray(payload.data) ? payload.data : []
        setTabelas(ligas.map((liga) => ({
          id: liga.id,
          nome: liga.nome,
          dados: linhas.filter((linha) => Number(linha.ligaId) === liga.id),
          pendente: false,
        })))
      })
      .catch((erro) => {
        if (erro instanceof ConsultaCancelada) return
        setTabelas(ligas.map((liga) => ({ id: liga.id, nome: liga.nome, dados: [], pendente: false })))
      })
    return () => controlador.abort()
  }, [ligas])

  if (ligas.length === 0) {
    return (
      <section>
        <EstadoVazio titulo="Nenhum campeonato para classificar." descricao="Crie um campeonato em Início. A tabela fica nesta página quando houver resultados." />
      </section>
    )
  }

  return (
    <section className="space-y-8">
      {tabelas.map((tabela) => (
        <div key={tabela.id}>
          {tabela.pendente ? (
            <CollapseBar title={tabela.nome}>
              <p className="text-sm font-bold text-white/50">Carregando classificação...</p>
            </CollapseBar>
          ) : tabela.dados.length === 0 ? (
            <CollapseBar title={tabela.nome}>
              <EstadoVazio titulo="Nenhuma partida registrada" descricao="A classificação aparece aqui após o primeiro resultado aprovado." />
            </CollapseBar>
          ) : (
            <ChampionshipTableSection
              nome={tabela.nome}
              regra={REGRA_TABELA}
              dados={tabela.dados}
              ligaId={tabela.id}
              organizadorId={organizadorId}
              organizerMode
            />
          )}
        </div>
      ))}
    </section>
  )
}

type PartidaOrganizacao = {
  id: number
  ligaId: number
  rodada?: number | null
  status?: string | null
  dataHora?: string | null
  setsPorA?: number | null
  setsPorB?: number | null
  pontosPorA?: number | null
  pontosPorB?: number | null
  equipeA?: { nome?: string | null } | null
  equipeB?: { nome?: string | null } | null
  liga?: { id?: number; nome?: string | null; simulacao?: boolean | null } | { id?: number; nome?: string | null; simulacao?: boolean | null }[] | null
  escala?: Array<{ arbitroId?: number | null; cargo?: string | null; arbitro?: { nome?: string | null; email?: string | null } | null }>
}

const STATUS_JOGO: Record<string, string> = {
  AGENDADA: 'Agendada',
  EM_ANDAMENTO: 'Em andamento',
  ENCERRADA: 'Encerrada',
  CANCELADA: 'Cancelada',
  WO: 'W.O.',
}

function ligaDaPartida(partida: PartidaOrganizacao) {
  return Array.isArray(partida.liga) ? partida.liga[0] : partida.liga
}

export function PainelJogos({ ligas, ativo = true }: { ligas: LigaCarouselItem[]; ativo?: boolean }) {
  const [partidas, setPartidas] = useState<PartidaOrganizacao[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  async function carregar(silencioso = false) {
    if (!silencioso) setLoading(true)
    try {
      const jogos = await consultar<{ data?: PartidaOrganizacao[] }>('/api/organizador/partidas', { forcar: silencioso })
      setPartidas(Array.isArray(jogos.data) ? jogos.data : [])
      setErro(null)
    } catch (falha) {
      if (falha instanceof ConsultaCancelada) return
      setErro('Não foi possível carregar a tabela de jogos.')
    } finally {
      if (!silencioso) setLoading(false)
    }
  }

  useEffect(() => {
    if (!ativo) return
    carregar()
    const timer = window.setInterval(() => carregar(true), 30000)
    return () => window.clearInterval(timer)
  }, [ativo])

  if (loading) return <p className="px-4 py-10 text-sm font-bold text-white/50">Carregando...</p>

  const grupos = new Map<number, { nome: string; simulacao: boolean; partidas: PartidaOrganizacao[] }>()
  partidas.forEach((partida) => {
    const liga = ligaDaPartida(partida)
    const atual = grupos.get(partida.ligaId) ?? {
      nome: liga?.nome || ligas.find((item) => item.id === partida.ligaId)?.nome || 'Campeonato',
      simulacao: liga?.simulacao === true,
      partidas: [],
    }
    atual.partidas.push(partida)
    grupos.set(partida.ligaId, atual)
  })

  if (grupos.size === 0) {
    return (
      <section>
        <EstadoVazio titulo="Nenhum jogo cadastrado" descricao="As partidas aparecem aqui quando o calendário for montado. A coluna de árbitro fica nesta tabela." />
      </section>
    )
  }

  return (
    <section className="space-y-6">
      {erro && <p className="rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100">{erro}</p>}
      {Array.from(grupos.entries()).map(([ligaId, grupo]) => (
        <CollapseBar key={ligaId} title={grupo.simulacao ? `${grupo.nome} · simulação` : grupo.nome}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm text-white">
              <thead className="text-xs font-black uppercase tracking-wide text-white/60">
                <tr>
                  <th className="px-3 py-2">Rodada</th>
                  <th className="px-3 py-2">Jogo</th>
                  <th className="px-3 py-2">Horário</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Placar</th>
                  <th className="px-3 py-2">Árbitro responsável</th>
                  <th className="px-3 py-2">Acesso do árbitro</th>
                </tr>
              </thead>
              <tbody>
                {grupo.partidas.map((partida) => {
                  const status = String(partida.status || 'AGENDADA').toUpperCase()
                  const quando = partida.dataHora ? new Date(partida.dataHora).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'A definir'
                  const emJogo = status === 'EM_ANDAMENTO'
                  const nomeArbitro = partida.escala?.find((item) => item.cargo === 'PRIMEIRO_ARBITRO')?.arbitro?.nome || partida.escala?.[0]?.arbitro?.nome || 'Não registrado'
                  return (
                    <tr key={partida.id} className="border-t border-white/10">
                      <td className="px-3 py-3 font-bold">{partida.rodada || '—'}</td>
                      <td className="px-3 py-3 font-black">{partida.equipeA?.nome ?? 'Equipe A'} × {partida.equipeB?.nome ?? 'Equipe B'}</td>
                      <td className="px-3 py-3">{quando}</td>
                      <td className="px-3 py-3">{STATUS_JOGO[status] ?? status}</td>
                      <td className="px-3 py-3 font-bold">
                        {partida.setsPorA ?? 0} × {partida.setsPorB ?? 0}
                        {emJogo ? <span className="mt-1 block text-xs font-semibold text-white/70">{partida.pontosPorA ?? 0} a {partida.pontosPorB ?? 0}</span> : null}
                      </td>
                      <td className="px-3 py-3">{nomeArbitro}</td>
                      <td className="px-3 py-3">
                        <AcessoArbitroJogo partidaId={partida.id} jogo={`${partida.equipeA?.nome ?? 'Equipe A'} × ${partida.equipeB?.nome ?? 'Equipe B'}`} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CollapseBar>
      ))}
    </section>
  )
}

export function PainelGaleria({ ligas }: { ligas: LigaCarouselItem[] }) {
  const [blocos, setBlocos] = useState<Array<{ id: number; nome: string; midias: any[] }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const controlador = new AbortController()
    const ids = ligas.map((liga) => liga.id).join(',')
    if (!ids) {
      setBlocos([])
      setLoading(false)
      return
    }
    consultar<{ data?: Array<{ ligaId?: number }> }>(`/api/galeria?ligaIds=${ids}`, { signal: controlador.signal })
      .then((payload) => {
        const midias = Array.isArray(payload.data) ? payload.data : []
        if (!cancelled) {
          setBlocos(ligas.map((liga) => ({
            id: liga.id,
            nome: liga.nome,
            midias: midias.filter((midia) => Number(midia.ligaId) === liga.id),
          })))
        }
      })
      .catch(() => {
        if (!cancelled) setBlocos([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
      controlador.abort()
    }
  }, [ligas])

  if (loading) return <p className="px-4 py-10 text-sm font-bold text-white/50">Carregando...</p>
  if (ligas.length === 0) {
    return (
      <section>
        <EstadoVazio titulo="Nenhuma galeria disponível." descricao="Crie um campeonato em Início. Fotos e vídeos ficam nesta página quando forem publicados." />
      </section>
    )
  }

  return (
    <section className="space-y-10">
      {blocos.map((bloco) => {
        const fotos = bloco.midias.filter((midia) => midia.tipo === 'FOTO')
        const videos = bloco.midias.filter((midia) => midia.tipo === 'VIDEO')
        return (
          <div key={bloco.id}>
            <h2 className="font-display text-3xl font-black text-white">{bloco.nome}</h2>
            {bloco.midias.length === 0 ? (
              <div className="mt-4">
                <EstadoVazio titulo="Nenhuma mídia disponível ainda" descricao="As fotos e vídeos aparecem aqui quando forem publicados." />
              </div>
            ) : (
              <div className="mt-5 grid gap-8">
                {fotos.length > 0 && (
                  <div>
                    <div className="mb-4 flex items-center gap-2">
                      <ImageIcon size={20} className="text-luva-amber" />
                      <h3 className="font-display text-2xl font-black text-white">Fotos</h3>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {fotos.map((foto, index) => (
                        <figure key={foto.id} className={`gallery-card overflow-hidden rounded-2xl border ${index === 0 ? 'sm:col-span-2 sm:row-span-2' : ''}`}>
                          <div className={`${index === 0 ? 'aspect-[16/10]' : 'aspect-square'} bg-slate-950/60`}>
                            <img src={foto.url} alt={foto.titulo ?? 'Foto da liga'} className="h-full w-full object-cover" />
                          </div>
                          <figcaption className="p-4">
                            <p className="font-black text-white">{foto.titulo ?? 'Registro da temporada'}</p>
                            {foto.tag && <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-slate-200">{foto.tag}</p>}
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                  </div>
                )}
                {videos.length > 0 && (
                  <div>
                    <div className="mb-4 flex items-center gap-2">
                      <PlaySquare size={20} className="text-luva-amber" />
                      <h3 className="font-display text-2xl font-black text-white">Vídeos</h3>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {videos.map((video) => (
                        <div key={video.id} className="gallery-card overflow-hidden rounded-2xl border">
                          <div className="aspect-video bg-slate-950/60">
                            <iframe src={video.url} className="h-full w-full" allowFullScreen title={video.titulo ?? 'Vídeo da liga'} />
                          </div>
                          <div className="p-4">
                            <p className="font-black text-white">{video.titulo ?? 'Vídeo da temporada'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}
