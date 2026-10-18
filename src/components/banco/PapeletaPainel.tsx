'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { botaoEnviarPapeleta, papeletaEditavel, ROTULO_ESTADO_PAPELETA } from '@/lib/banco-ui/botoes'
import { chamarBanco } from '@/lib/banco-ui/cliente'
import {
  admiteSegundoLibero,
  agruparViolacoes,
  colocarJogador,
  corpoDaPapeleta,
  definirCapitao,
  definirLibero,
  definirLibero2,
  igual,
  motivoNaoPodeEnviar,
  NUMERAL_POSICAO,
  rascunhoDaPapeleta,
  rotuloJogador,
  validarFormacaoLocal,
} from '@/lib/banco-ui/formacao'
import { gravarRascunho, lerRascunho } from '@/lib/banco-ui/rascunho-local'
import type { RascunhoPapeleta, Violacao, VisaoBanco } from '@/lib/banco-ui/tipos'
import { partidaEncerrada } from '@/lib/banco-ui/botoes'
import { BTN_PRIMARIO, BTN_SECUNDARIO, Dialogo } from './Dialogo'
import { Quadra } from './Quadra'

type StatusSalvo = 'nada' | 'local' | 'salvando' | 'salvo' | 'rede' | 'limite' | 'recusado'

const TEXTO_SALVO: Record<StatusSalvo, string> = {
  nada: '',
  local: 'Rascunho guardado neste aparelho. Escolha as 6 posições para salvar no servidor.',
  salvando: 'Salvando o rascunho...',
  salvo: 'Rascunho salvo.',
  rede: 'Sem conexão: rascunho guardado só neste aparelho. Tentando de novo.',
  limite: 'Muitas consultas, aguardando. O rascunho está guardado neste aparelho e vamos tentar de novo.',
  recusado: 'O servidor não aceitou esta formação (veja os motivos abaixo).',
}

const CAMPO =
  'mt-1 min-h-[48px] w-full rounded-xl border border-vs-border bg-vs-elevated px-3 text-base text-vs-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-70'

export function PapeletaPainel({
  token,
  baseApi,
  somenteLeitura = false,
  visao,
  set,
  semConexao,
  onAtualizar,
}: {
  token: string
  baseApi?: string
  /** Assistente: vê a papeleta, mas não edita nem envia. */
  somenteLeitura?: boolean
  visao: VisaoBanco
  set: number
  semConexao: boolean
  onAtualizar: () => void
}) {
  const doServidor = visao.papeletas.find((p) => p.setNumero === set)
  const estado = doServidor?.estado
  const editavel = papeletaEditavel(estado) && !somenteLeitura
  const encerrada = partidaEncerrada(visao.partida.status)

  const [rascunho, setRascunho] = useState<RascunhoPapeleta>(() => lerRascunho(token, set) ?? rascunhoDaPapeleta(doServidor))
  const [escolhendo, setEscolhendo] = useState<number | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [salvo, setSalvo] = useState<StatusSalvo>('nada')
  const [violacoesServidor, setViolacoesServidor] = useState<Violacao[]>([])
  const [erroEnvio, setErroEnvio] = useState<string | null>(null)
  const [tentativa, setTentativa] = useState(0)
  const sequencia = useRef(0)
  const primeira = useRef(true)

  // O que se mostra: papeleta já enviada/aceita vem do servidor; senão o rascunho do aparelho.
  const exibido = editavel ? rascunho : rascunhoDaPapeleta(doServidor)
  const validacao = useMemo(() => validarFormacaoLocal(exibido, visao.elenco), [exibido, visao.elenco])
  const motivo = motivoNaoPodeEnviar(validacao)
  const botaoEnviar = botaoEnviarPapeleta({ estado, pronta: validacao.pronta, motivoPendencia: motivo, enviando, encerrada, semConexao })

  // Rascunho automático: aparelho na hora, servidor depois de 0,8 s sem mexer (só com as 6 posições).
  useEffect(() => {
    if (!editavel) return
    if (primeira.current) {
      primeira.current = false
      return
    }
    gravarRascunho(token, set, rascunho)
    const corpo = corpoDaPapeleta(rascunho)
    if (!corpo) {
      setSalvo('local')
      return
    }
    const minha = ++sequencia.current
    let tentarDeNovo: ReturnType<typeof setTimeout> | undefined
    const timer = setTimeout(async () => {
      setSalvo('salvando')
      const r = await chamarBanco(token, `/papeleta/${set}`, 'PUT', corpo, baseApi)
      if (minha !== sequencia.current) return
      if (r.ok) {
        setSalvo('salvo')
        setViolacoesServidor([])
        return
      }
      if (r.status === 429) {
        setSalvo('limite')
        tentarDeNovo = setTimeout(() => setTentativa((n) => n + 1), 10000)
        return
      }
      if (r.status === null || (r.status ?? 0) >= 500) {
        setSalvo('rede')
        tentarDeNovo = setTimeout(() => setTentativa((n) => n + 1), 5000)
        return
      }
      setSalvo('recusado')
      setViolacoesServidor(r.violacoes.length > 0 ? r.violacoes : [{ codigo: 'ERRO', mensagem: r.erro ?? 'Formação recusada.' }])
    }, 800)
    return () => {
      clearTimeout(timer)
      if (tentarDeNovo) clearTimeout(tentarDeNovo)
    }
  }, [rascunho, tentativa, editavel, token, set, baseApi])

  function alterar(proximo: RascunhoPapeleta) {
    if (igual(proximo, rascunho)) return
    setViolacoesServidor([])
    setErroEnvio(null)
    setRascunho(proximo)
  }

  async function enviar() {
    const corpo = corpoDaPapeleta(rascunho)
    if (!corpo || enviando) return
    setEnviando(true)
    setErroEnvio(null)
    sequencia.current += 1 // descarta resposta de PUT em andamento
    const salvar = await chamarBanco(token, `/papeleta/${set}`, 'PUT', corpo, baseApi)
    if (!salvar.ok) {
      setViolacoesServidor(salvar.violacoes)
      setErroEnvio(salvar.erro)
      setEnviando(false)
      setConfirmando(false)
      return
    }
    const r = await chamarBanco(token, `/papeleta/${set}/enviar`, 'POST', undefined, baseApi)
    setEnviando(false)
    setConfirmando(false)
    if (!r.ok) {
      setViolacoesServidor(r.violacoes)
      setErroEnvio(r.erro)
      return
    }
    onAtualizar()
  }

  const todasViolacoes = [...validacao.violacoes, ...violacoesServidor.filter((v) => !validacao.violacoes.some((l) => l.mensagem === v.mensagem))]
  const grupos = agruparViolacoes(todasViolacoes)
  const emQuadra = new Set(Object.values(exibido.slots).filter((x): x is number => typeof x === 'number'))
  const nomeDe = (id: number | null) => (id == null ? 'Nenhum' : rotuloJogador(visao.elenco.find((j) => j.jogadorId === id)))

  return (
    <section aria-labelledby="titulo-papeleta" className="rounded-3xl border border-vs-border bg-vs-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="titulo-papeleta" className="font-display text-2xl font-bold text-vs-text">
          Papeleta do set {set}
        </h2>
        <p
          role="status"
          className={`rounded-full px-3 py-1 text-sm font-bold ${
            estado === 'ACEITA' ? 'bg-vs-win text-black' : estado === 'ENVIADA' ? 'bg-vs-blue text-black' : 'border border-vs-muted text-vs-text'
          }`}
        >
          {estado ? ROTULO_ESTADO_PAPELETA[estado] : 'Rascunho (ainda não enviada)'}
        </p>
      </div>

      {somenteLeitura ? (
        <p className="mt-3 rounded-xl border border-vs-border bg-vs-elevated p-3 text-sm font-semibold text-vs-text">
          Você está como assistente: pode ver a papeleta, mas só quem lidera o time escolhe os jogadores e envia.
        </p>
      ) : !editavel ? (
        <p className="mt-3 rounded-xl border border-vs-border bg-vs-elevated p-3 text-sm font-semibold text-vs-text">
          Papeleta travada: depois de enviada ela não muda. Para alterar um jogador, só por substituição regular durante o jogo.
        </p>
      ) : (
        <p className="mt-3 text-sm text-vs-muted">Toque numa posição para escolher o jogador. Ordem: IV, III, II na frente; V, VI, I atrás.</p>
      )}

      <div className="mt-3">
        <Quadra rascunho={exibido} elenco={visao.elenco} editavel={editavel && !encerrada} onEscolher={setEscolhendo} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="sel-libero" className="text-sm font-bold text-vs-text">
            Líbero
          </label>
          <select
            id="sel-libero"
            className={CAMPO}
            disabled={!editavel || encerrada}
            value={exibido.liberoId ?? ''}
            onChange={(e) => alterar(definirLibero(rascunho, e.target.value === '' ? null : Number(e.target.value)))}
          >
            <option value="">Sem líbero</option>
            {visao.elenco.map((j) => (
              <option key={j.jogadorId} value={j.jogadorId} disabled={emQuadra.has(j.jogadorId) || j.jogadorId === exibido.libero2Id}>
                {rotuloJogador(j)}
                {emQuadra.has(j.jogadorId) ? ' (titular)' : ''}
              </option>
            ))}
          </select>
        </div>
        {admiteSegundoLibero(visao.elenco) ? (
          <div>
            <label htmlFor="sel-libero2" className="text-sm font-bold text-vs-text">
              Segundo líbero (opcional)
            </label>
            <select
              id="sel-libero2"
              className={CAMPO}
              disabled={!editavel || encerrada}
              value={exibido.libero2Id ?? ''}
              onChange={(e) => alterar(definirLibero2(rascunho, e.target.value === '' ? null : Number(e.target.value)))}
            >
              <option value="">Sem segundo líbero</option>
              {visao.elenco.map((j) => (
                <option key={j.jogadorId} value={j.jogadorId} disabled={emQuadra.has(j.jogadorId) || j.jogadorId === exibido.liberoId}>
                  {rotuloJogador(j)}
                  {emQuadra.has(j.jogadorId) ? ' (titular)' : ''}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div>
          <label htmlFor="sel-capitao" className="text-sm font-bold text-vs-text">
            Capitão
          </label>
          <select
            id="sel-capitao"
            className={CAMPO}
            disabled={!editavel || encerrada}
            value={exibido.capitaoId ?? ''}
            onChange={(e) => alterar(definirCapitao(rascunho, e.target.value === '' ? null : Number(e.target.value)))}
          >
            <option value="">Sem capitão</option>
            {visao.elenco.map((j) => (
              <option key={j.jogadorId} value={j.jogadorId} disabled={j.jogadorId === exibido.liberoId || j.jogadorId === exibido.libero2Id}>
                {rotuloJogador(j)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div aria-live="polite" className="mt-3 space-y-2">
        {([
          ['Problema no elenco', grupos.elenco],
          ['Problema na formação', grupos.formacao],
          ['Recusado pelo servidor', grupos.outras],
        ] as const).map(([titulo, lista]) =>
          lista.length > 0 ? (
            <div key={titulo} className="rounded-xl border border-red-400 bg-red-950/60 p-3 text-sm font-semibold text-red-100">
              <p className="text-xs font-bold uppercase tracking-wide text-red-200">{titulo}</p>
              <ul className="mt-1 space-y-1">
                {lista.map((v, i) => (
                  <li key={`${v.codigo}-${i}`}>
                    {v.mensagem} <span className="text-xs font-normal text-red-200">({v.codigo})</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null,
        )}
        {editavel && salvo !== 'nada' ? <p className="text-sm text-vs-muted">{TEXTO_SALVO[salvo]}</p> : null}
        {erroEnvio ? (
          <p role="alert" className="rounded-xl border border-red-400 bg-red-950/60 p-3 text-sm font-bold text-red-100">
            {erroEnvio}
          </p>
        ) : null}
      </div>

      {editavel ? (
        <div className="mt-4">
          <button type="button" className={`${BTN_PRIMARIO} w-full`} disabled={!botaoEnviar.habilitado} aria-describedby="motivo-enviar" onClick={() => setConfirmando(true)}>
            Enviar papeleta
          </button>
          <p id="motivo-enviar" className="mt-2 text-sm text-vs-muted">
            {botaoEnviar.motivo ?? 'Tudo certo. Confira e envie ao apontador.'}
          </p>
        </div>
      ) : null}

      {escolhendo !== null ? (
        <Dialogo titulo={`Quem joga na posição ${NUMERAL_POSICAO[escolhendo]}?`} onFechar={() => setEscolhendo(null)}>
          <ul className="space-y-2">
            {visao.elenco.map((j) => {
              const ondeEsta = Object.entries(rascunho.slots).find(([, id]) => id === j.jogadorId)?.[0]
              const atual = rascunho.slots[escolhendo] === j.jogadorId
              return (
                <li key={j.jogadorId}>
                  <button
                    type="button"
                    aria-pressed={atual}
                    onClick={() => {
                      alterar(colocarJogador(rascunho, escolhendo, j.jogadorId))
                      setEscolhendo(null)
                    }}
                    className={`flex min-h-[52px] w-full items-center justify-between gap-2 rounded-xl border px-4 text-left text-base font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                      atual ? 'border-vs-gold bg-vs-elevated text-vs-gold' : 'border-vs-border bg-vs-elevated text-vs-text'
                    }`}
                  >
                    <span>{rotuloJogador(j)}</span>
                    <span className="text-xs font-semibold text-vs-muted">
                      {atual ? 'Aqui agora' : ondeEsta ? `Está na ${NUMERAL_POSICAO[Number(ondeEsta)]} (troca)` : j.jogadorId === rascunho.liberoId ? 'Líbero' : ''}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="mt-4 flex gap-2">
            {rascunho.slots[escolhendo] != null ? (
              <button
                type="button"
                className={`${BTN_SECUNDARIO} flex-1`}
                onClick={() => {
                  alterar(colocarJogador(rascunho, escolhendo, null))
                  setEscolhendo(null)
                }}
              >
                Deixar vazia
              </button>
            ) : null}
            <button type="button" className={`${BTN_SECUNDARIO} flex-1`} onClick={() => setEscolhendo(null)}>
              Cancelar
            </button>
          </div>
        </Dialogo>
      ) : null}

      {confirmando ? (
        <Dialogo titulo="Enviar a papeleta?" onFechar={() => !enviando && setConfirmando(false)}>
          <p className="text-base font-bold text-vs-gold">Depois de enviada, a papeleta não muda.</p>
          <ul className="mt-3 space-y-1 text-sm text-vs-text">
            {[4, 3, 2, 5, 6, 1].map((p) => (
              <li key={p}>
                <span className="font-bold">{NUMERAL_POSICAO[p]}:</span> {nomeDe(exibido.slots[p] ?? null)}
              </li>
            ))}
            <li>
              <span className="font-bold">Líbero:</span> {nomeDe(exibido.liberoId)}
            </li>
            <li>
              <span className="font-bold">Capitão:</span> {nomeDe(exibido.capitaoId)}
            </li>
          </ul>
          <div className="mt-5 flex gap-2">
            <button type="button" className={`${BTN_SECUNDARIO} flex-1`} disabled={enviando} onClick={() => setConfirmando(false)}>
              Voltar e conferir
            </button>
            <button type="button" className={`${BTN_PRIMARIO} flex-1`} disabled={enviando} onClick={enviar}>
              {enviando ? 'Enviando...' : 'Enviar agora'}
            </button>
          </div>
        </Dialogo>
      ) : null}
    </section>
  )
}
