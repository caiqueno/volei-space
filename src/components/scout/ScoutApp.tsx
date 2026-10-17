'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePolling } from '@/lib/banco-ui/use-polling'
import { textoAtualizado } from '@/lib/banco-ui/polling'
import { caminhoScout, caminhoSumula, chamarApi } from '@/lib/scout-ui/cliente'
import {
  destinoDaResposta,
  enfileirar,
  gravarFila,
  gravarMinhas,
  lerFila,
  lerMinhas,
  planoDesfazer,
  proximoParaEnviar,
  registrarFalha,
  registrarMinha,
  remover,
  textoPendentes,
  type Armazenamento,
  type ItemFila,
  type MinhaAcao,
} from '@/lib/scout-ui/fila'
import { montarPayload, motivoNaoPodeLancar, novoClientEventId } from '@/lib/scout-ui/payload'
import {
  acaoDaResposta,
  acoesDaResposta,
  classificarFalhaScout,
  descreverAcao,
  equipesDaPartida,
  estatisticaDaEquipe,
  falhaDefinitiva,
  filtrarAcoes,
  linhasResumo,
  rotuloCamisa,
  type TelaScout,
} from '@/lib/scout-ui/textos'
import {
  FUNDAMENTOS,
  RESULTADOS,
  ROTULO_FUNDAMENTO,
  ROTULO_RESULTADO,
  type AcaoServidor,
  type EquipeScoutTela,
  type Fundamento,
  type ResultadoAcao,
} from '@/lib/scout-ui/tipos'
import { CarregandoScout, EstadoScout } from './EstadoScout'
import { MiniQuadra } from './MiniQuadra'

const FOCO = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'
const BTN = `min-h-[48px] rounded-xl border px-3 text-base font-bold ${FOCO} disabled:cursor-not-allowed disabled:opacity-50`
const ON = 'border-vs-gold bg-vs-gold text-vs-on-gold'
const OFF = 'border-vs-border bg-vs-elevated text-vs-text hover:border-vs-muted'

function armazenamento(): Armazenamento | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export function ScoutApp({ token }: { token: string }) {
  const [equipes, setEquipes] = useState<EquipeScoutTela[]>([])
  const [acoes, setAcoes] = useState<AcaoServidor[]>([])
  const [resumo, setResumo] = useState<unknown>(null)
  const [tela, setTela] = useState<TelaScout | null>(null)
  const [fila, setFila] = useState<ItemFila[]>([])
  const [, setMinhas] = useState<MinhaAcao[]>([])
  const [carregou, setCarregou] = useState(false)

  const [setNumero, setSetNumero] = useState(1)
  const [equipeId, setEquipeId] = useState<number | null>(null)
  const [jogadorId, setJogadorId] = useState<number | null>(null)
  const [fundamento, setFundamento] = useState<Fundamento | null>(null)
  const [resultado, setResultado] = useState<ResultadoAcao | null>(null)
  const [zonaOrigem, setZonaOrigem] = useState<number | null>(null)
  const [zonaDestino, setZonaDestino] = useState<number | null>(null)
  const [filtroSet, setFiltroSet] = useState<number | 'todos'>('todos')
  const [filtroEquipe, setFiltroEquipe] = useState<number | 'todas'>('todas')
  const [aviso, setAviso] = useState('')

  const filaRef = useRef<ItemFila[]>([])
  const minhasRef = useRef<MinhaAcao[]>([])
  const enviando = useRef(false)
  const temDados = useRef(false)
  const [, forcar] = useState(0)

  const salvarFila = useCallback(
    (f: ItemFila[]) => {
      filaRef.current = f
      setFila(f)
      gravarFila(armazenamento(), token, f)
    },
    [token],
  )
  const salvarMinhas = useCallback(
    (m: MinhaAcao[]) => {
      minhasRef.current = m
      setMinhas(m)
      gravarMinhas(armazenamento(), token, m)
    },
    [token],
  )

  useEffect(() => {
    const arm = armazenamento()
    const f = lerFila(arm, token)
    const m = lerMinhas(arm, token)
    filaRef.current = f
    minhasRef.current = m
    setFila(f)
    setMinhas(m)
    setCarregou(true)
  }, [token])

  /** Esvazia a fila em ordem; para na primeira falha para não furar a ordem de lançamento. */
  const enviarFila = useCallback(async () => {
    if (enviando.current) return
    enviando.current = true
    try {
      for (;;) {
        const item = proximoParaEnviar(filaRef.current, Date.now())
        if (!item) break
        const r = await chamarApi(caminhoScout(token, '/acoes'), 'POST', item.payload)
        const destino = destinoDaResposta(r.status)
        if (destino === 'tentar-de-novo') {
          if (r.status === 404 || r.status === 503) setTela(classificarFalhaScout(r.status))
          salvarFila(registrarFalha(filaRef.current, item.payload.clientEventId, Date.now()))
          break
        }
        if (destino === 'enviada') {
          const acao = acaoDaResposta(r.json)
          if (acao) salvarMinhas(registrarMinha(minhasRef.current, { id: acao.id, clientEventId: item.payload.clientEventId }))
        } else {
          setAviso('Uma ação foi recusada pelo servidor e saiu da fila.')
        }
        salvarFila(remover(filaRef.current, item.payload.clientEventId))
      }
    } finally {
      enviando.current = false
    }
  }, [token, salvarFila, salvarMinhas])

  const tarefa = useCallback(async (): Promise<'parar' | void> => {
    const rResumo = await chamarApi(caminhoScout(token, '/resumo'), 'GET')
    if (!rResumo.ok) {
      const t = classificarFalhaScout(rResumo.status)
      if (falhaDefinitiva(t)) {
        setTela(t)
        return 'parar'
      }
      if (!temDados.current) setTela(t)
      throw new Error(t)
    }
    setResumo(rResumo.json)
    if (equipes.length === 0) {
      const rPartida = await chamarApi(caminhoSumula(token), 'GET')
      if (!rPartida.ok) {
        const t = classificarFalhaScout(rPartida.status)
        if (!temDados.current) setTela(t)
        throw new Error(t)
      }
      const lista = equipesDaPartida(rPartida.json)
      if (lista.length === 0) {
        setTela('erro')
        throw new Error('sem equipes')
      }
      setEquipes(lista)
    }
    const rAcoes = await chamarApi(caminhoScout(token, '/acoes'), 'GET')
    if (rAcoes.ok) setAcoes(acoesDaResposta(rAcoes.json))
    temDados.current = true
    setTela(null)
    await enviarFila()
  }, [token, equipes.length, enviarFila])

  const { semConexao, ultimaAtualizacao, atualizarAgora } = usePolling(tarefa, carregou)

  useEffect(() => {
    if (equipes.length && equipeId === null) setEquipeId(equipes[0]!.id)
  }, [equipes, equipeId])

  useEffect(() => {
    const aoVoltar = () => void enviarFila().then(() => forcar((n) => n + 1))
    window.addEventListener('online', aoVoltar)
    return () => window.removeEventListener('online', aoVoltar)
  }, [enviarFila])

  const equipe = equipes.find((e) => e.id === equipeId) ?? null
  const motivo = motivoNaoPodeLancar({ setNumero, equipeId, fundamento, resultado })

  function escolherEquipe(id: number) {
    setEquipeId(id)
    setJogadorId(null)
  }

  function lancar() {
    const payload = montarPayload({
      clientEventId: novoClientEventId(),
      setNumero,
      equipeId,
      jogadorId,
      fundamento,
      resultado,
      zonaOrigem,
      zonaDestino,
    })
    if (!payload) return
    salvarFila(enfileirar(filaRef.current, payload, Date.now()))
    setAviso(`Lançado: ${fundamento ? ROTULO_FUNDAMENTO[fundamento] : ''}, ${resultado ? ROTULO_RESULTADO[resultado] : ''}.`)
    // Mantém equipe e jogador para o próximo toque; limpa o que muda a cada lance.
    setFundamento(null)
    setResultado(null)
    setZonaOrigem(null)
    setZonaDestino(null)
    void enviarFila().then(() => atualizarAgora())
  }

  async function desfazer() {
    const plano = planoDesfazer(filaRef.current, minhasRef.current)
    if (plano.tipo === 'nada') {
      setAviso('Não há ação deste aparelho para desfazer.')
      return
    }
    if (plano.tipo === 'cancelar-pendente') {
      salvarFila(remover(filaRef.current, plano.clientEventId))
      setAviso('Última ação pendente cancelada.')
      return
    }
    const r = await chamarApi(caminhoScout(token, `/acoes/${encodeURIComponent(String(plano.id))}`), 'DELETE')
    if (r.ok || r.status === 404 || r.status === 410) {
      salvarMinhas(minhasRef.current.filter((m) => m.clientEventId !== plano.clientEventId))
      setAviso('Última ação desfeita.')
      atualizarAgora()
    } else {
      setAviso('Não foi possível desfazer agora. Tente de novo.')
    }
  }

  const visiveis = useMemo(() => filtrarAcoes(acoes, { set: filtroSet, equipeId: filtroEquipe }), [acoes, filtroSet, filtroEquipe])

  if (tela && !temDados.current) return <EstadoScout tela={tela} onTentar={atualizarAgora} />
  if (tela && temDados.current && falhaDefinitiva(tela)) return <EstadoScout tela={tela} />
  if (!carregou || equipes.length === 0) return <CarregandoScout />

  const pendentes = fila.length

  return (
    <div className="mx-auto w-full max-w-6xl px-3 pb-24 pt-3 text-vs-text">
      <header className="flex flex-wrap items-center justify-between gap-2 rounded-3xl border border-vs-border bg-vs-surface p-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-vs-gold">Scout</p>
          <h1 className="font-display text-2xl font-bold">
            {equipes[0]!.nome} <span aria-hidden="true">×</span>
            <span className="sr-only">contra</span> {equipes[1]?.nome ?? ''}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p
            role="status"
            className={`rounded-full border px-3 py-1 text-sm font-bold ${pendentes ? 'border-vs-gold text-vs-gold' : 'border-vs-border text-vs-muted'}`}
          >
            {textoPendentes(pendentes)}
          </p>
          <p role="status" className={`rounded-full border px-3 py-1 text-sm font-bold ${semConexao ? 'border-red-400 bg-red-950/60 text-red-100' : 'border-vs-border text-vs-muted'}`}>
            {semConexao ? 'Sem conexão. Os lançamentos ficam guardados.' : textoAtualizado(ultimaAtualizacao)}
          </p>
        </div>
      </header>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-label="Lançar ação" className="space-y-3 rounded-3xl border border-vs-border bg-vs-surface p-4">
          <fieldset>
            <legend className="mb-1 text-sm font-bold text-vs-muted">Set</legend>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} type="button" aria-pressed={s === setNumero} onClick={() => setSetNumero(s)} className={`${BTN} min-w-[56px] ${s === setNumero ? ON : OFF}`}>
                  {s}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-1 text-sm font-bold text-vs-muted">Equipe</legend>
            <div className="flex flex-wrap gap-2">
              {equipes.map((e) => (
                <button key={e.id} type="button" aria-pressed={e.id === equipeId} onClick={() => escolherEquipe(e.id)} className={`${BTN} ${e.id === equipeId ? ON : OFF}`}>
                  {e.nome}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-1 text-sm font-bold text-vs-muted">Jogador (camisa)</legend>
            <div className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={jogadorId === null} onClick={() => setJogadorId(null)} className={`${BTN} ${jogadorId === null ? ON : OFF}`}>
                Sem jogador
              </button>
              {equipe?.jogadores.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  aria-pressed={j.id === jogadorId}
                  aria-label={j.numero === null ? `Jogador sem camisa, ${j.nome}` : `Camisa ${j.numero}, ${j.nome}`}
                  onClick={() => setJogadorId(j.id)}
                  className={`${BTN} min-w-[56px] text-lg ${j.id === jogadorId ? ON : OFF}`}
                >
                  {rotuloCamisa(j)}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-1 text-sm font-bold text-vs-muted">Fundamento</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {FUNDAMENTOS.map((f) => (
                <button key={f} type="button" aria-pressed={f === fundamento} onClick={() => setFundamento(f)} className={`${BTN} ${f === fundamento ? ON : OFF}`}>
                  {ROTULO_FUNDAMENTO[f]}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-1 text-sm font-bold text-vs-muted">Resultado</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {RESULTADOS.map((r) => (
                <button key={r} type="button" aria-pressed={r === resultado} onClick={() => setResultado(r)} className={`${BTN} ${r === resultado ? ON : OFF}`}>
                  {ROTULO_RESULTADO[r]}
                </button>
              ))}
            </div>
          </fieldset>

          <details className="rounded-2xl border border-vs-border p-3">
            <summary className="min-h-[44px] cursor-pointer text-base font-bold leading-[44px]">Zona (opcional)</summary>
            <div className="mt-2 grid gap-4 sm:grid-cols-2">
              <MiniQuadra titulo="Zona de origem" valor={zonaOrigem} onChange={setZonaOrigem} />
              <MiniQuadra titulo="Zona de destino" valor={zonaDestino} onChange={setZonaDestino} />
            </div>
          </details>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={motivo !== null} onClick={lancar} className={`${BTN} flex-1 bg-vs-gold px-6 text-lg text-vs-on-gold border-vs-gold`}>
              Lançar ação
            </button>
            <button type="button" onClick={() => void desfazer()} className={`${BTN} ${OFF}`}>
              Desfazer última
            </button>
          </div>
          {motivo ? <p className="text-sm text-vs-muted">{motivo}</p> : null}
          <p role="status" aria-live="polite" className="min-h-[1.5rem] text-sm font-semibold text-vs-text">
            {aviso}
          </p>
        </section>

        <aside className="space-y-3">
          <section aria-label="Resumo" className="rounded-3xl border border-vs-border bg-vs-surface p-4">
            <h2 className="font-display text-xl font-bold">Resumo</h2>
            {equipes.map((e) => (
              <div key={e.id} className="mt-2">
                <h3 className="text-sm font-bold text-vs-gold">{e.nome}</h3>
                <dl className="mt-1 space-y-1 text-base">
                  {linhasResumo(estatisticaDaEquipe(resumo, e.lado)).map((l) => (
                    <div key={l.rotulo} className="flex justify-between gap-2">
                      <dt className="text-vs-muted">{l.rotulo}</dt>
                      <dd className="text-right font-bold">{l.valor}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </section>

          <section aria-label="Últimas ações" className="rounded-3xl border border-vs-border bg-vs-surface p-4">
            <h2 className="font-display text-xl font-bold">Últimas ações</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <label className="text-sm font-bold text-vs-muted">
                Set
                <select
                  value={String(filtroSet)}
                  onChange={(e) => setFiltroSet(e.target.value === 'todos' ? 'todos' : Number(e.target.value))}
                  className={`ml-2 min-h-[44px] rounded-lg border border-vs-border bg-vs-elevated px-2 text-base text-vs-text ${FOCO}`}
                >
                  <option value="todos">Todos</option>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-bold text-vs-muted">
                Equipe
                <select
                  value={String(filtroEquipe)}
                  onChange={(e) => setFiltroEquipe(e.target.value === 'todas' ? 'todas' : Number(e.target.value))}
                  className={`ml-2 min-h-[44px] rounded-lg border border-vs-border bg-vs-elevated px-2 text-base text-vs-text ${FOCO}`}
                >
                  <option value="todas">Todas</option>
                  {equipes.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nome}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {visiveis.length === 0 ? (
              <p className="mt-3 text-base text-vs-muted">Nenhuma ação lançada ainda.</p>
            ) : (
              <ul className="mt-3 space-y-1">
                {visiveis.map((a) => (
                  <li key={String(a.id)} className="rounded-lg border border-vs-border px-3 py-2 text-base">
                    <span className="text-vs-muted">Set {a.setNumero ?? a.set}: </span>
                    {descreverAcao(a, equipes)}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
