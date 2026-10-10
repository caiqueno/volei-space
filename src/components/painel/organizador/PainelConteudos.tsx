'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useBancoAoVivo } from '@/lib/use-banco-ao-vivo'
import { ConsultaCancelada, consultar } from '@/lib/api-cliente'
import Link from 'next/link'
import { GaleriaOrganizador } from '@/components/galeria/GaleriaOrganizador'
import { ChampionshipTableSection } from '@/components/classificacao/ChampionshipTableSection'
import { EstadoVazio } from '@/components/ui/EstadoVazio'
import { CollapseBar } from '@/components/ui/collapse-bar'
import { AcessoArbitroJogo, type LinkDoJuiz } from './AcessoArbitroJogo'
import { LinksCategoria } from './LinksCategoria'
import { SeletorCategoria, queryCategoria, useCategoriaDoCampeonato } from '@/components/portal/SeletorCategoria'
import type { TabelaCategoria } from '@/lib/operacao-categoria'
import { ordenarJogos } from '@/lib/data-hora'
import { formatarDataPartida } from '@/lib/format-partida'
import { manterPaginaAberta } from '@/lib/pagina-aberta'
import { rotuloArbitroResponsavel } from '@/lib/arbitro-responsavel'
import { NomeEquipe } from '@/components/equipes/NomeEquipe'
import { normalizarNomeEquipe } from '@/lib/nome-equipe'
import { formatLigaFormato, formatLigaStatus } from '@/lib/format-liga'
import type { LigaCarouselItem } from './types'

const REGRA_TABELA = 'Vitória por 2 sets a 0 vale 3 pontos. Vitória por 2 sets a 1 vale 2 pontos para o vencedor e 1 para o perdedor. Cada grupo tem a sua tabela. Empate em pontos desempata pelo confronto direto.'

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
                <LinksCategoria ligaId={liga.id} nome={liga.nome} compacto />
                <Link href={`/campeonatos/${liga.slug}`} className="championship-list-link">Ver campeonato</Link>
              </span>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export function PainelTabela({ ligas, organizadorId, campeonatoId, onSelect }: { ligas: LigaCarouselItem[]; organizadorId: string; campeonatoId: number | null; onSelect: (id: number) => void }) {
  const [tabelas, setTabelas] = useState<TabelaCategoria[]>([])
  const [pendente, setPendente] = useState(true)
  const liga = ligas.find((item) => item.id === campeonatoId) ?? ligas[0] ?? null
  const { categorias, categoriaId, setCategoriaId, pronto } = useCategoriaDoCampeonato(liga?.id ?? null)

  useEffect(() => {
    if (!liga || !pronto) {
      if (!liga) {
        setTabelas([])
        setPendente(false)
      }
      return
    }
    const controlador = new AbortController()
    setPendente(true)
    const consulta = queryCategoria(categoriaId)
    consultar<{ data?: { categorias?: TabelaCategoria[] } }>(`/api/classificacao?ligaId=${liga.id}${consulta}`, { signal: controlador.signal })
      .then((classificacao) => {
        setTabelas(Array.isArray(classificacao.data?.categorias) ? classificacao.data.categorias : [])
      })
      .catch((erro) => {
        if (erro instanceof ConsultaCancelada) return
        setTabelas([])
      })
      .finally(() => setPendente(false))
    return () => controlador.abort()
  }, [liga, categoriaId, pronto])

  useBancoAoVivo(
    liga ? `classificacao-painel-${liga.id}-${categoriaId ?? 'todas'}` : '',
    liga ? [{ tabela: 'ClassificacaoEntrada', filtro: `ligaId=eq.${liga.id}` }, { tabela: 'Partida', filtro: `ligaId=eq.${liga.id}` }] : [],
    () => {
      if (!liga || !pronto) return
      const consulta = queryCategoria(categoriaId)
      consultar<{ data?: { categorias?: TabelaCategoria[] } }>(`/api/classificacao?ligaId=${liga.id}${consulta}`, { forcar: true })
        .then((classificacao) => {
          setTabelas(Array.isArray(classificacao.data?.categorias) ? classificacao.data.categorias : [])
        })
        .catch((erro) => {
          if (erro instanceof ConsultaCancelada) return
        })
    },
  )

  if (!liga) {
    return (
      <section>
        <EstadoVazio titulo="Nenhum campeonato para classificar." descricao="Crie um campeonato em Início. A tabela fica nesta página quando houver resultados." />
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <label className="block max-w-md">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">Campeonato</span>
        <select className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-white" value={liga.id} onChange={(evento) => onSelect(Number(evento.target.value))}>
          {ligas.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
        </select>
      </label>
      <SeletorCategoria categorias={categorias} valor={categoriaId} onChange={setCategoriaId} />
      <p className="text-xs font-black uppercase tracking-[0.14em] text-white/50">Liga ID {liga.id}</p>
      {pendente || !pronto ? (
        <p className="text-sm font-bold text-white/50">Carregando classificação...</p>
      ) : tabelas.length === 0 || tabelas.every((tabela) => tabela.linhas.length === 0) ? (
        <EstadoVazio titulo={categoriaId ? 'Nenhuma equipe nesta categoria' : 'Nenhuma equipe inscrita'} descricao="A classificação aparece aqui com zero até a primeira partida desta categoria." />
      ) : (
        tabelas.filter((tabela) => tabela.linhas.length > 0).map((tabela) => (
          <ChampionshipTableSection
            key={tabela.id ?? 'legado'}
            nome={tabela.nome && tabela.nome !== 'Classificação' ? `${liga.nome} · ${tabela.nome}` : liga.nome}
            regra={REGRA_TABELA}
            dados={tabela.linhas}
            groups={tabela.groups}
            ligaId={liga.id}
            categoriaCampeonatoId={tabela.id}
            organizadorId={organizadorId}
            organizerMode
            requiredClassified={tabela.requiredClassified}
            automaticClassifiedIds={tabela.automaticClassifiedIds}
            initialManualClassifiedIds={tabela.manualClassifiedIds}
            locked={tabela.locked}
            groupStageFinished={tabela.groupStageFinished}
          />
        ))
      )}
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
  sumulaToken?: string | null
  equipeA?: { nome?: string | null } | null
  equipeB?: { nome?: string | null } | null
  liga?: { id?: number; nome?: string | null; simulacao?: boolean | null } | { id?: number; nome?: string | null; simulacao?: boolean | null }[] | null
  escala?: Array<{ arbitroId?: number | null; cargo?: string | null; arbitro?: { nome?: string | null; email?: string | null } | null }>
  acesso?: { ultimoAcessoEm?: string | null } | Array<{ ultimoAcessoEm?: string | null }> | null
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

function arbitroDoLink(partida: PartidaOrganizacao) {
  const acesso = Array.isArray(partida.acesso) ? partida.acesso[0] : partida.acesso
  return Boolean(acesso?.ultimoAcessoEm)
}

export function PainelJogos({ ligas, campeonatoId, onSelect, ativo = true }: { ligas: LigaCarouselItem[]; campeonatoId: number | null; onSelect: (id: number) => void; ativo?: boolean }) {
  const [partidas, setPartidas] = useState<PartidaOrganizacao[]>([])
  const [temMais, setTemMais] = useState(false)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [avisoRodada, setAvisoRodada] = useState('')
  const linksDoJuiz = useRef(new Map<number, LinkDoJuiz>())
  const liga = ligas.find((item) => item.id === campeonatoId) ?? ligas[0] ?? null
  const { categorias, categoriaId, setCategoriaId, pronto } = useCategoriaDoCampeonato(liga?.id ?? null)
  const quantidade = useRef(20)
  // Sobe quando o usuário pede outra página ou troca de campeonato.
  // Uma releitura que começou antes disso não pode recolher o que ele abriu.
  const versao = useRef(0)
  quantidade.current = Math.max(20, partidas.length)

  async function carregar(silencioso = false) {
    if (!liga) {
      setPartidas([])
      setLoading(false)
      return
    }
    const visto = versao.current
    const ligaId = liga.id
    const limite = Math.max(20, quantidade.current)
    if (!silencioso) setLoading(true)
    try {
      const jogos = await consultar<{ data?: { partidas?: PartidaOrganizacao[]; temMais?: boolean } }>(`/api/organizador/partidas?ligaId=${ligaId}&limite=${limite}${queryCategoria(categoriaId)}`, { forcar: true })
      if (visto !== versao.current) return
      const novas = Array.isArray(jogos.data?.partidas) ? jogos.data.partidas : []
      const aindaTem = Boolean(jogos.data?.temMais)
      setPartidas((atual) => ordenarJogos(manterPaginaAberta(atual, novas, aindaTem)))
      setTemMais(aindaTem)
      setErro(null)
    } catch (falha) {
      if (falha instanceof ConsultaCancelada || visto !== versao.current) return
      setErro('Não foi possível carregar a tabela de jogos.')
    } finally {
      if (!silencioso) setLoading(false)
    }
  }

  useEffect(() => {
    if (!ativo || !liga || !pronto) return
    versao.current += 1
    quantidade.current = 20
    void carregar()
  }, [ativo, liga?.id, categoriaId, pronto])

  useBancoAoVivo(
    ativo && liga ? `painel-jogos-${liga.id}` : '',
    ativo && liga ? [{ tabela: 'Partida', filtro: `ligaId=eq.${liga.id}` }] : [],
    () => { void carregar(true) },
  )

  async function verMais() {
    if (!liga) return
    versao.current += 1
    const visto = versao.current
    const jogos = await consultar<{ data?: { partidas?: PartidaOrganizacao[]; temMais?: boolean } }>(`/api/organizador/partidas?ligaId=${liga.id}&limite=20&offset=${partidas.length}${queryCategoria(categoriaId)}`, { forcar: true })
    if (visto !== versao.current) return
    const novas = Array.isArray(jogos.data?.partidas) ? jogos.data.partidas : []
    setPartidas((atual) => {
      const ids = new Set(atual.map((partida) => partida.id))
      return ordenarJogos([...atual, ...novas.filter((partida) => !ids.has(partida.id))])
    })
    setTemMais(Boolean(jogos.data?.temMais))
  }

  if (!liga) {
    return <EstadoVazio titulo="Nenhum jogo cadastrado" descricao="Crie um campeonato para montar a agenda." />
  }

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

  return (
    <section className="space-y-6">
      <label className="block max-w-md">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">Campeonato</span>
        <select className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-white" value={liga.id} onChange={(evento) => onSelect(Number(evento.target.value))}>
          {ligas.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
        </select>
      </label>
      <SeletorCategoria categorias={categorias} valor={categoriaId} onChange={setCategoriaId} />
      <p className="text-xs font-black uppercase tracking-[0.14em] text-white/50">Liga ID {liga.id}</p>
      {loading || !pronto ? <p className="text-sm font-bold text-white/50">Carregando...</p> : grupos.size === 0 ? (
        <EstadoVazio titulo={categoriaId ? 'Nenhum jogo nesta categoria' : 'Nenhum jogo neste campeonato'} descricao="As partidas aparecem aqui quando o calendário desta categoria for montado." />
      ) : null}
      {erro && <p className="rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100">{erro}</p>}
      {avisoRodada ? <p className="text-sm font-black text-emerald-300">{avisoRodada}</p> : null}
      {Array.from(grupos.entries()).map(([ligaId, grupo]) => (
        <CollapseBar key={ligaId} title={grupo.simulacao ? `${grupo.nome} · simulação` : grupo.nome}>
          <div className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              {rodadasDoGrupo(grupo.partidas).map(([rodada, jogosDaRodada]) => (
                <button key={rodada} type="button" className="rounded-full border border-white/15 px-3 py-2 text-xs font-black text-white" onClick={() => void copiarRodada(jogosDaRodada, linksDoJuiz.current, setAvisoRodada)}>
                  Copiar links da rodada {rodada}
                </button>
              ))}
            </div>
            <table data-stack className="w-full text-left text-sm text-white">
              <thead className="text-xs font-black uppercase tracking-wide text-white/60">
                <tr>
                  <th className="px-3 py-2">Rodada</th>
                  <th className="px-3 py-2">Jogo</th>
                  <th className="px-3 py-2">Horário</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Placar</th>
                  <th className="px-3 py-2">Árbitro responsável</th>
                  <th className="px-3 py-2">Súmula</th>
                  <th className="px-3 py-2">Link do juiz</th>
                </tr>
              </thead>
              <tbody>
                {ordenarJogos(grupo.partidas).map((partida) => {
                  const status = String(partida.status || 'AGENDADA').toUpperCase()
                  const quando = formatarDataPartida(partida.dataHora) ?? 'A definir'
                  const emJogo = status === 'EM_ANDAMENTO'
                  const nomeArbitro = rotuloArbitroResponsavel([
                    partida.escala?.find((item) => item.cargo === 'PRIMEIRO_ARBITRO')?.arbitro?.nome,
                    partida.escala?.[0]?.arbitro?.nome,
                  ], arbitroDoLink(partida))
                  return (
                    <tr key={partida.id} className="border-t border-white/10">
                      <td data-label="Rodada" className="px-3 py-3 font-bold">{partida.rodada || '—'}</td>
                      <td data-label="Jogo" className="px-3 py-3 font-black"><NomeEquipe nome={partida.equipeA?.nome} vazio="Equipe A" /> × <NomeEquipe nome={partida.equipeB?.nome} vazio="Equipe B" /></td>
                      <td data-label="Horário" className="px-3 py-3">{quando}</td>
                      <td data-label="Status" className="px-3 py-3">{STATUS_JOGO[status] ?? status}</td>
                      <td data-label="Placar" className="px-3 py-3 font-bold">
                        {partida.setsPorA ?? 0} × {partida.setsPorB ?? 0}
                        {emJogo ? <span className="mt-1 block text-xs font-semibold text-white/70">{partida.pontosPorA ?? 0} a {partida.pontosPorB ?? 0}</span> : null}
                      </td>
                      <td data-label="Árbitro" className="px-3 py-3">{nomeArbitro}</td>
                      <td data-label="Súmula" className="px-3 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <a className="font-black text-[#ffb331]" href={`/sumula/${encodeURIComponent(partida.sumulaToken || String(partida.id))}/lancar`}>Lançar súmula</a>
                          <a className="font-bold text-white/80" href={`/sumula/${encodeURIComponent(partida.sumulaToken || String(partida.id))}`}>Abrir súmula</a>
                          <a className="font-bold text-white/80" href={`/partidas/${partida.id}/ao-vivo`}>Link público</a>
                          <a className="font-bold text-white/80" href={`/partidas/${partida.id}/ao-vivo`}>Resumo da partida</a>
                        </div>
                      </td>
                      <td data-label="Link do juiz" className="px-3 py-3">
                        <AcessoArbitroJogo
                          partidaId={partida.id}
                          jogo={`${normalizarNomeEquipe(partida.equipeA?.nome ?? 'Equipe A')} × ${normalizarNomeEquipe(partida.equipeB?.nome ?? 'Equipe B')}`}
                          onDisponivel={(link) => { linksDoJuiz.current.set(partida.id, link) }}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CollapseBar>
      ))}
      {temMais && <button type="button" className="rounded-full bg-[#ffb331] px-5 py-3 text-sm font-black text-slate-950" onClick={() => void verMais()}>Ver mais</button>}
    </section>
  )
}

function rodadasDoGrupo(partidas: PartidaOrganizacao[]) {
  const grupos = new Map<string, PartidaOrganizacao[]>()
  for (const partida of partidas) {
    const chave = String(partida.rodada || '—')
    const lista = grupos.get(chave) ?? []
    lista.push(partida)
    grupos.set(chave, lista)
  }
  return Array.from(grupos.entries())
}

async function copiarRodada(
  partidas: PartidaOrganizacao[],
  links: Map<number, LinkDoJuiz>,
  avisar: (texto: string) => void,
) {
  const linhas = partidas.flatMap((partida) => {
    const link = links.get(partida.id)
    if (!link?.url) return []
    const jogo = `${normalizarNomeEquipe(partida.equipeA?.nome ?? 'Equipe A')} × ${normalizarNomeEquipe(partida.equipeB?.nome ?? 'Equipe B')}`
    return [`${jogo}\n${link.url}${link.codigo ? `\nCódigo: ${link.codigo}` : ''}`]
  })
  if (linhas.length === 0) {
    avisar('Gere o link do juiz dos jogos desta rodada antes de copiar.')
    return
  }
  await navigator.clipboard.writeText(linhas.join('\n\n'))
  avisar(`${linhas.length} link(s) da rodada copiado(s).`)
}

export function PainelGaleria({ ligas, campeonatoId, onSelect }: { ligas: LigaCarouselItem[]; campeonatoId: number | null; onSelect: (id: number) => void }) {
  const liga = ligas.find((item) => item.id === campeonatoId) ?? ligas[0] ?? null

  if (ligas.length === 0 || !liga) {
    return (
      <section>
        <EstadoVazio titulo="Nenhuma galeria disponível." descricao="Crie um campeonato em Início. As fotos ficam nesta página quando forem publicadas." />
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <label className="block max-w-md">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">Campeonato</span>
        <select className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-white" value={liga.id} onChange={(evento) => onSelect(Number(evento.target.value))}>
          {ligas.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
        </select>
      </label>
      <GaleriaOrganizador key={liga.id} ligaId={liga.id} capaUrl={liga.capaUrl} />
    </section>
  )
}
