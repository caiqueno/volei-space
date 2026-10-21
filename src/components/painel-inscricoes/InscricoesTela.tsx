'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Download, Inbox, Loader2, Search, Users } from 'lucide-react'
import { usePollingVisivel, type ResultadoConsulta } from '@/lib/ao-vivo-ui/usePollingVisivel'
import {
  ABAS, INTERVALO_INSCRICOES_MS, URL_EQUIPE, URL_LOTE, campeonatosDaLista, categoriasDaLista, contarPorAba, corpoLote, estaParada, falhaBloqueante,
  filtrarPorAba, filtrarPorCategoria, mensagemLote, motivoBloqueio, normalizarEquipe, normalizarInscricoes, painelInscricoesAtivo,
  podeAprovarEmLote, podeDecidirPapel, rotuloStatus, statusDaAba, tempoParado, textoAtletas, textoVazio, tratarResposta, urlExportar,
  urlInscricoes, urlDecidir, type AbaInscricao, type InscricaoItem, type PapelOrganizador, type TipoFalha,
} from '@/lib/painel-inscricoes-ui'
import {
  avisoAprovarBloqueado, etiquetaDaLista, extrairPagamentosDaLista, mensagemDaAprovacao, pagamentoBloqueiaAprovar, pagamentoComprovanteAtivo, tomDoEstado,
  type PagamentoDaLista, type Tom,
} from '@/lib/pagamento-comprovante-ui'
import { DetalheInscricao } from './DetalheInscricao'

const COR_PAGAMENTO: Record<Tom, string> = {
  ok: 'bg-emerald-400/15 text-emerald-300',
  atencao: 'bg-luva-amber/20 text-luva-amber',
  erro: 'bg-red-400/15 text-red-300',
  neutro: 'bg-white/10 text-slate-200',
}

const COR_STATUS: Record<string, string> = {
  EM_ANALISE: 'bg-luva-amber/20 text-luva-amber',
  AJUSTE_PEDIDO: 'bg-orange-400/15 text-orange-300',
  CONFIRMADA_COM_PENDENCIAS: 'bg-orange-400/15 text-orange-300',
  CONFIRMADA: 'bg-emerald-400/15 text-emerald-300',
  LISTA_ESPERA: 'bg-sky-300/15 text-sky-200',
  REMOVIDA: 'bg-red-400/15 text-red-300',
  RASCUNHO: 'bg-white/10 text-slate-300',
}

export function InscricoesTela() {
  const ativo = painelInscricoesAtivo(process.env.NEXT_PUBLIC_PAINEL_INSCRICOES_ATIVO)
  const [aba, setAba] = useState<AbaInscricao>('EM_ANALISE')
  const [ligaId, setLigaId] = useState('')
  const [categoria, setCategoria] = useState('')
  const [busca, setBusca] = useState('')
  const [q, setQ] = useState('')
  const pagamentoAtivo = pagamentoComprovanteAtivo()
  const [pagamentos, setPagamentos] = useState<Record<string, PagamentoDaLista>>({})
  const [itens, setItens] = useState<InscricaoItem[]>([])
  const [conhecidos, setConhecidos] = useState<InscricaoItem[]>([])
  const [total, setTotal] = useState(0)
  const [carregou, setCarregou] = useState(false)
  const [carregandoMais, setCarregandoMais] = useState(false)
  const [falha, setFalha] = useState<{ tipo: TipoFalha; mensagem: string } | null>(null)
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const [selecionadas, setSelecionadas] = useState<string[]>([])
  const [detalheId, setDetalheId] = useState<string | null>(null)
  const [papel, setPapel] = useState<PapelOrganizador | null>(null)
  const [loteEmCurso, setLoteEmCurso] = useState(false)
  const [agora, setAgora] = useState(() => Date.now())
  const paginasRef = useRef(1)
  const filtroRef = useRef({ ligaId, q })
  filtroRef.current = { ligaId, q }

  // Busca com atraso para não consultar a cada tecla.
  useEffect(() => {
    const t = setTimeout(() => setQ(busca.trim()), 400)
    return () => clearTimeout(t)
  }, [busca])

  // Papel de quem está logado (só para desabilitar botões; o servidor valida).
  useEffect(() => {
    if (!ativo) return
    const c = new AbortController()
    fetch(URL_EQUIPE, { cache: 'no-store', signal: c.signal })
      .then(async (r) => (r.ok ? normalizarEquipe(await r.json().catch(() => null)).meuPapel : null))
      .then((p) => setPapel(p))
      .catch(() => undefined)
    return () => c.abort()
  }, [ativo])

  const buscar = useCallback(async (sinal?: AbortSignal): Promise<ResultadoConsulta> => {
    const { ligaId: l, q: termo } = filtroRef.current
    try {
      let acumulado: InscricaoItem[] = []
      const pagamentosAcum: Record<string, PagamentoDaLista> = {}
      let totalServidor = 0
      for (let p = 1; p <= paginasRef.current; p++) {
        const r = await fetch(urlInscricoes({ ligaId: l, q: termo, pagina: p }), { cache: 'no-store', signal: sinal })
        const corpo = await r.json().catch(() => null)
        const t = tratarResposta(r.status, corpo)
        if (!t.ok) {
          setFalha({ tipo: t.tipo ?? 'generica', mensagem: t.mensagem })
          setCarregou(true)
          return falhaBloqueante(t.tipo) ? 'parar' : 'falha'
        }
        const lista = normalizarInscricoes(corpo)
        if (pagamentoAtivo) Object.assign(pagamentosAcum, extrairPagamentosDaLista(corpo))
        acumulado = acumulado.concat(lista.itens)
        totalServidor = lista.total
        if (lista.itens.length === 0) break
      }
      // Descarta resposta de um filtro que já mudou.
      if (filtroRef.current.ligaId !== l || filtroRef.current.q !== termo) return 'ok'
      setItens(acumulado)
      if (pagamentoAtivo) setPagamentos(pagamentosAcum)
      setTotal(totalServidor)
      if (!l && !termo) setConhecidos(acumulado)
      setFalha(null)
      setCarregou(true)
      setAgora(Date.now())
      return 'ok'
    } catch {
      if (sinal?.aborted) return 'ok'
      setFalha({ tipo: 'generica', mensagem: 'Sem conexão. Tentando de novo em instantes.' })
      setCarregou(true)
      return 'falha'
    }
  }, [pagamentoAtivo])

  // Polling de 20 s; pausa com a aba oculta. Desligado pela flag: nenhuma requisição.
  usePollingVisivel(buscar, { ativo, baseMs: INTERVALO_INSCRICOES_MS, maxMs: 60_000 })

  const primeira = useRef(true)
  useEffect(() => {
    if (!ativo) return
    if (primeira.current) {
      primeira.current = false
      return
    }
    paginasRef.current = 1
    setCarregou(false)
    setSelecionadas([])
    void buscar()
  }, [ativo, ligaId, q, buscar])

  const contadores = useMemo(() => contarPorAba(filtrarPorCategoria(itens, categoria)), [itens, categoria])
  const visiveis = useMemo(() => filtrarPorAba(filtrarPorCategoria(itens, categoria), aba), [itens, categoria, aba])
  const loteIds = useMemo(() => selecionadas.filter((id) => visiveis.some((i) => i.id === id && podeAprovarEmLote(i.status, papel))), [selecionadas, visiveis, papel])

  if (!ativo) {
    return (
      <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6 text-sm font-semibold text-slate-200">
        Este recurso ainda não está disponível.
      </div>
    )
  }

  const bloqueada = falha ? falhaBloqueante(falha.tipo) : false
  const semPermissao = !podeDecidirPapel(papel)
  const filtrando = Boolean(ligaId || categoria || q)
  const campeonatos = campeonatosDaLista(conhecidos)
  const categorias = categoriasDaLista(conhecidos)
  const statusAba = statusDaAba(aba)
  const hrefExportar = urlExportar({ ligaId, status: statusAba.length === 1 ? statusAba[0] : undefined })
  const temMais = itens.length < total

  function alternar(id: string) {
    setSelecionadas((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]))
  }

  async function aprovarUma(i: InscricaoItem) {
    setAviso(null)
    try {
      const r = await fetch(urlDecidir(i.id), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'APROVAR' }) })
      const corpo = await r.json().catch(() => null)
      const t = tratarResposta(r.status, corpo)
      setAviso({ ok: t.ok, texto: t.ok ? `${i.equipe.nome} foi aprovada.` : mensagemDaAprovacao(r.status, corpo, t.mensagem) })
      if (t.ok || t.recarregar) await buscar()
    } catch {
      setAviso({ ok: false, texto: 'Sem conexão. Tente de novo.' })
    }
  }

  async function aprovarLote() {
    if (loteEmCurso || loteIds.length === 0) return
    setLoteEmCurso(true)
    setAviso(null)
    try {
      const r = await fetch(URL_LOTE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpoLote(loteIds)) })
      const corpo = (await r.json().catch(() => null)) as { data?: { aprovadas?: unknown } } | null
      const t = tratarResposta(r.status, corpo as { error?: string } | null)
      if (t.ok) {
        const n = Number(corpo?.data?.aprovadas)
        setAviso({ ok: true, texto: mensagemLote(Number.isFinite(n) ? n : loteIds.length, loteIds.length) })
        setSelecionadas([])
      } else {
        setAviso({ ok: false, texto: mensagemDaAprovacao(r.status, corpo as { codigo?: unknown } | null, t.mensagem) })
      }
      if (t.ok || t.recarregar) await buscar()
    } catch {
      setAviso({ ok: false, texto: 'Sem conexão. Tente de novo.' })
    } finally {
      setLoteEmCurso(false)
    }
  }

  async function carregarMais() {
    setCarregandoMais(true)
    paginasRef.current += 1
    await buscar()
    setCarregandoMais(false)
  }

  return (
    <div className="space-y-6">
      <header className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-luva-amber">Inscrições</p>
        <h2 className="mt-2 font-display text-3xl font-black text-white">Inscrições das equipes</h2>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-200">
          Confira atletas e documentos, aprove em um clique ou peça correções. As decisões chegam às equipes na hora.
        </p>
      </header>

      <section className="grid gap-3 rounded-[1.5rem] border border-white/10 bg-[#102033] p-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
        <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-300">
          Campeonato
          <select value={ligaId} onChange={(e) => setLigaId(e.target.value)} className="min-h-[44px] rounded-xl border border-white/10 bg-[#07111f] px-3 text-sm font-bold normal-case tracking-normal text-white">
            <option value="">Todos os campeonatos</option>
            {campeonatos.map((c) => <option key={c.ligaId} value={c.ligaId}>{c.nome}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-300">
          Categoria
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="min-h-[44px] rounded-xl border border-white/10 bg-[#07111f] px-3 text-sm font-bold normal-case tracking-normal text-white">
            <option value="">Todas as categorias</option>
            {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-300">
          Buscar equipe
          <span className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              maxLength={80}
              placeholder="Nome da equipe"
              className="min-h-[44px] w-full rounded-xl border border-white/10 bg-[#07111f] pl-9 pr-3 text-sm font-bold normal-case tracking-normal text-white"
            />
          </span>
        </label>
        <a
          href={hrefExportar}
          download
          className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-white/20 px-4 text-sm font-black text-white hover:border-luva-amber/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-luva-amber"
        >
          <Download size={16} /> Exportar planilha
        </a>
      </section>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por situação">
        {ABAS.map((a) => (
          <button
            key={a.value}
            type="button"
            aria-pressed={aba === a.value}
            onClick={() => { setAba(a.value); setSelecionadas([]) }}
            className={`min-h-[44px] rounded-full px-4 py-2 text-sm font-black transition focus:outline-none focus-visible:ring-2 focus-visible:ring-luva-amber ${aba === a.value ? 'bg-luva-amber text-[#07111f]' : 'border border-white/15 bg-white/5 text-slate-100 hover:border-luva-amber/70'}`}
          >
            {a.rotulo} <span className="ml-1 opacity-80">({contadores[a.value]})</span>
          </button>
        ))}
      </div>

      <div aria-live="polite">
        {aviso && (
          <p role={aviso.ok ? 'status' : 'alert'} className={`rounded-2xl border px-4 py-3 text-sm font-bold text-white ${aviso.ok ? 'border-emerald-400/40 bg-emerald-400/10' : 'border-red-400/40 bg-red-400/10'}`}>
            {aviso.texto}
          </p>
        )}
      </div>

      {semPermissao && <p className="rounded-2xl bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200">{motivoBloqueio(papel)}</p>}

      {falha && (
        <p role="alert" className="rounded-2xl border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm font-bold text-white">
          {falha.mensagem}
          {!bloqueada && <button type="button" onClick={() => void buscar()} className="ml-3 min-h-[44px] underline">Tentar de novo</button>}
        </p>
      )}

      {aba === 'EM_ANALISE' && visiveis.length > 0 && !semPermissao && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={loteIds.length === 0 || loteEmCurso}
            onClick={() => void aprovarLote()}
            className="flex min-h-[48px] items-center gap-2 rounded-2xl bg-emerald-500 px-4 text-sm font-black text-[#07111f] disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {loteEmCurso ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Aprovar selecionadas ({loteIds.length})
          </button>
          <button
            type="button"
            onClick={() => setSelecionadas(loteIds.length === visiveis.length ? [] : visiveis.filter((i) => podeAprovarEmLote(i.status, papel)).map((i) => i.id))}
            className="min-h-[44px] text-sm font-black text-slate-200 underline"
          >
            {loteIds.length === visiveis.length ? 'Limpar seleção' : 'Selecionar todas'}
          </button>
        </div>
      )}

      {!carregou ? (
        <p className="flex items-center gap-2 text-sm font-bold text-slate-200"><Loader2 className="animate-spin" size={16} /> Carregando inscrições...</p>
      ) : visiveis.length === 0 && !bloqueada ? (
        <div className="flex flex-col items-center gap-3 rounded-[1.5rem] border border-dashed border-white/15 p-10 text-center">
          <Inbox size={28} className="text-luva-amber" />
          <p className="max-w-md text-sm font-semibold text-slate-200">{textoVazio(aba, filtrando)}</p>
        </div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {visiveis.map((i) => {
            const parada = estaParada(i.status, i.atualizadoEm, agora)
            const podeAprovar = podeAprovarEmLote(i.status, papel)
            return (
              <li key={i.id} className="rounded-[1.5rem] border border-white/10 bg-[#102033] p-5">
                <div className="flex items-start gap-3">
                  {aba === 'EM_ANALISE' && !semPermissao && (
                    <input
                      type="checkbox"
                      checked={selecionadas.includes(i.id)}
                      onChange={() => alternar(i.id)}
                      disabled={!podeAprovar}
                      aria-label={`Selecionar ${i.equipe.nome}`}
                      className="mt-1 h-6 w-6 shrink-0 accent-emerald-500"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-black text-white">{i.equipe.nome}</p>
                        <p className="text-xs font-semibold text-slate-300">{[i.equipe.cidade, i.campeonato, i.categoria].filter(Boolean).join(' - ')}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${COR_STATUS[i.status] ?? COR_STATUS.RASCUNHO}`}>
                        {rotuloStatus(i.status)}{i.status === 'LISTA_ESPERA' && i.posicaoEspera ? ` #${i.posicaoEspera}` : ''}
                      </span>
                    </div>
                    <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-slate-300"><Users size={14} /> {textoAtletas(i.atletas)}</p>
                    {i.pendencias.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Pendências">
                        {i.pendencias.map((p) => <li key={p} className="rounded-full bg-red-400/15 px-2.5 py-0.5 text-xs font-bold text-red-200">{p}</li>)}
                      </ul>
                    )}
                    {pagamentoAtivo && pagamentos[i.id] && (
                      <div className="mt-2">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${COR_PAGAMENTO[tomDoEstado(pagamentos[i.id].estado)]}`}>
                          Pagamento: {etiquetaDaLista(pagamentos[i.id])}
                        </span>
                        {pagamentoBloqueiaAprovar(pagamentos[i.id].estado) && i.status !== 'CONFIRMADA' && i.status !== 'REMOVIDA' && (
                          <p className="mt-1 text-xs font-semibold text-luva-amber">{avisoAprovarBloqueado(pagamentos[i.id].estado)}</p>
                        )}
                      </div>
                    )}
                    <p className={`mt-2 text-xs font-semibold ${parada ? 'text-luva-amber' : 'text-slate-400'}`}>
                      {i.atualizadoEm ? `Parada ${tempoParado(i.atualizadoEm, agora)}` : ''}
                      {i.comentariosAbertos > 0 ? `${i.atualizadoEm ? ' - ' : ''}${i.comentariosAbertos} comentário${i.comentariosAbertos > 1 ? 's' : ''} em aberto` : ''}
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setDetalheId(i.id)}
                        className="min-h-[48px] rounded-2xl border border-white/20 px-4 text-sm font-black text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-luva-amber"
                      >
                        Ver detalhe
                      </button>
                      <button
                        type="button"
                        disabled={!podeAprovar}
                        title={semPermissao ? motivoBloqueio(papel) : undefined}
                        onClick={() => void aprovarUma(i)}
                        className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 text-sm font-black text-[#07111f] disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                      >
                        <Check size={16} /> Aprovar
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {carregou && temMais && (
        <div className="text-center">
          <button type="button" disabled={carregandoMais} onClick={() => void carregarMais()} className="min-h-[48px] rounded-2xl border border-white/20 px-6 text-sm font-black text-white disabled:opacity-50">
            {carregandoMais ? 'Carregando...' : `Carregar mais (${itens.length} de ${total})`}
          </button>
        </div>
      )}

      {detalheId && (
        <DetalheInscricao
          id={detalheId}
          papel={papel}
          aoFechar={() => setDetalheId(null)}
          aoAtualizar={() => void buscar()}
        />
      )}
    </div>
  )
}
