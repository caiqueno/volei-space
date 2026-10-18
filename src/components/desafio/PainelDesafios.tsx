'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  agruparPorSet,
  desafioAtivo,
  iconeEstadoDesafio,
  linkVideoSeguro,
  TEXTO_SISTEMA_VIDEO,
  lerRespostaDesafio,
  MOTIVO_MAX,
  montarCorpoDesafio,
  normalizarDesafios,
  podeDecidir,
  podeRegistrar,
  saldoDesafios,
  textoDecisao,
  textoEstadoDesafio,
  textoSaldo,
  type DecisaoDesafio,
  type Desafio,
} from '@/lib/desafio-ui'

const INTERVALO_MS = 3000

export interface PainelDesafiosProps {
  token: string
  /** Set em andamento (o formulário registra o desafio neste set). */
  set: number
  /** Ids das duas equipes da partida. */
  equipes: readonly number[]
  nomeEquipe: (equipeId: number) => string
  partidaEmAndamento: boolean
}

const CAMPO =
  'mt-1 min-h-[48px] w-full rounded-md border-2 border-slate-500 bg-white px-3 text-base text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700'
const BTN = 'min-h-[48px] min-w-[104px] rounded-md px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700'

/** Painel de desafios de vídeo do apontador. Com a flag desligada, ou se o servidor responder 404/503, não renderiza nada. */
export function PainelDesafios({ token, set, equipes, nomeEquipe, partidaEmAndamento }: PainelDesafiosProps) {
  const ativo = desafioAtivo(process.env.NEXT_PUBLIC_DESAFIO_ATIVO)
  const [desafios, setDesafios] = useState<Desafio[]>([])
  const [carregou, setCarregou] = useState(false)
  const [desligado, setDesligado] = useState(false)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [equipeId, setEquipeId] = useState<number | null>(null)
  const [motivo, setMotivo] = useState('')
  const [link, setLink] = useState('')
  const [erroForm, setErroForm] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [decidindo, setDecidindo] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState<{ id: string; decisao: DecisaoDesafio } | null>(null)
  const [recarga, setRecarga] = useState(0)
  const desligadoRef = useRef(false)

  useEffect(() => {
    if (!ativo || !token) return
    let vivo = true
    let timer: ReturnType<typeof setTimeout> | undefined

    async function buscar() {
      if (!vivo || desligadoRef.current) return
      if (typeof document !== 'undefined' && document.hidden) {
        timer = setTimeout(buscar, INTERVALO_MS)
        return
      }
      try {
        const resposta = await fetch(`/api/sumula/${encodeURIComponent(token)}/desafios`, { cache: 'no-store' })
        const lido = await lerRespostaDesafio<unknown>(resposta)
        if (!vivo) return
        if (lido.tipo === 'desligado') {
          desligadoRef.current = true
          setDesligado(true)
          return
        }
        if (lido.tipo === 'ok') {
          setDesafios(normalizarDesafios(lido.data))
          setErro('')
          setCarregou(true)
        } else {
          setErro(`${lido.mensagem} Tentando de novo.`)
        }
      } catch {
        if (vivo) setErro('Sem conexão para atualizar os desafios. Tentando de novo.')
      }
      if (vivo) timer = setTimeout(buscar, INTERVALO_MS)
    }

    void buscar()
    return () => {
      vivo = false
      if (timer) clearTimeout(timer)
    }
  }, [ativo, token, recarga])

  const registrar = useCallback(async () => {
    if (enviando) return
    const corpo = montarCorpoDesafio({ setNumero: set, equipeId, motivo, linkVideo: link })
    if (!corpo.ok) {
      setErroForm(corpo.mensagem)
      return
    }
    setEnviando(true)
    setErroForm('')
    setAviso('')
    try {
      const resposta = await fetch(`/api/sumula/${encodeURIComponent(token)}/desafios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo.corpo),
      })
      const lido = await lerRespostaDesafio<unknown>(resposta)
      if (lido.tipo === 'ok') {
        setMotivo('')
        setLink('')
        setAviso('Desafio registrado.')
        setRecarga((n) => n + 1)
      } else if (lido.tipo === 'desligado') {
        setErroForm('O desafio de vídeo não está habilitado para esta partida.')
      } else {
        setErroForm(lido.mensagem)
      }
    } catch {
      setErroForm('Sem conexão. Tente de novo quando a internet voltar.')
    } finally {
      setEnviando(false)
    }
  }, [enviando, set, equipeId, motivo, link, token])

  async function decidir(id: string, decisao: DecisaoDesafio) {
    setDecidindo(id)
    setConfirmar(null)
    setAviso('')
    setErro('')
    try {
      const resposta = await fetch(`/api/sumula/${encodeURIComponent(token)}/desafios/${encodeURIComponent(id)}/decidir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisao }),
      })
      const lido = await lerRespostaDesafio<unknown>(resposta)
      if (lido.tipo === 'ok') {
        setAviso('Decisão registrada.')
        setRecarga((n) => n + 1)
      } else if (lido.tipo === 'desligado') {
        setErro('O desafio de vídeo não está habilitado para esta partida.')
      } else {
        setErro(lido.mensagem)
      }
    } catch {
      setErro('Sem conexão para enviar a decisão. Tente de novo.')
    } finally {
      setDecidindo(null)
    }
  }

  if (!ativo || desligado) return null

  const permissao = podeRegistrar({ partidaEmAndamento, enviando })
  const grupos = agruparPorSet(desafios)

  return (
    <section aria-label="Desafios de vídeo" className="mx-auto my-2 w-full max-w-3xl rounded-lg border-2 border-blue-700 bg-white px-3 py-2 text-slate-900 shadow-sm">
      <h2 className="text-xs font-bold uppercase tracking-wide text-blue-900">Desafios de vídeo</h2>

      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label={`Desafios por equipe no set ${set}`}>
        {equipes.map((id) => (
          <li key={id}>
            <span className="font-semibold">{nomeEquipe(id)}:</span> {textoSaldo(saldoDesafios(desafios, id, set))}
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-700">Informativo. O limite de desafios é conferido pelo servidor ao registrar.</p>
      <p className="text-xs text-slate-700">{TEXTO_SISTEMA_VIDEO}</p>

      <div aria-live="polite">
        {erro ? <p className="mt-1 text-xs font-semibold text-amber-900">{erro}</p> : null}
        {aviso ? <p className="mt-1 text-sm font-bold text-green-800">{aviso}</p> : null}
      </div>

      <form
        className="mt-2 rounded-md border border-slate-300 p-2"
        onSubmit={(e) => {
          e.preventDefault()
          void registrar()
        }}
        noValidate
      >
        <p className="text-sm font-bold">Registrar desafio no set {set}</p>
        <label htmlFor="desafio-equipe" className="mt-1 block text-sm font-semibold">
          Equipe
        </label>
        <select id="desafio-equipe" className={CAMPO} value={equipeId ?? ''} onChange={(e) => setEquipeId(e.target.value === '' ? null : Number(e.target.value))}>
          <option value="">Escolha a equipe</option>
          {equipes.map((id) => (
            <option key={id} value={id}>
              {nomeEquipe(id)}
            </option>
          ))}
        </select>
        <label htmlFor="desafio-motivo" className="mt-2 block text-sm font-semibold">
          Motivo (opcional)
        </label>
        <input id="desafio-motivo" type="text" maxLength={MOTIVO_MAX} className={CAMPO} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        <label htmlFor="desafio-link" className="mt-2 block text-sm font-semibold">
          Link do vídeo (opcional, http ou https)
        </label>
        <input id="desafio-link" type="url" inputMode="url" autoComplete="off" className={CAMPO} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" />
        {erroForm ? (
          <p role="alert" className="mt-2 rounded-md border border-red-700 bg-red-50 p-2 text-sm font-bold text-red-900">
            {erroForm}
          </p>
        ) : null}
        {!permissao.ok ? <p className="mt-1 text-xs text-slate-700">{permissao.motivo}</p> : null}
        <button type="submit" disabled={!permissao.ok} className={`${BTN} mt-2 bg-blue-700 text-white`}>
          {enviando ? 'Enviando...' : 'Registrar desafio'}
        </button>
      </form>

      <h3 className="mt-3 text-sm font-bold">Desafios da partida</h3>
      {!carregou && !erro ? <p className="text-sm text-slate-700">Carregando...</p> : null}
      {carregou && grupos.length === 0 ? <p className="text-sm text-slate-700">Nenhum desafio nesta partida.</p> : null}
      {grupos.map((g) => (
        <div key={g.setNumero} className="mt-2">
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-700">Set {g.setNumero}</h4>
          <ul className="mt-1 space-y-2">
            {g.itens.map((d) => {
              const id = String(d.id)
              const emVoo = decidindo === id
              const aberto = podeDecidir(d, emVoo)
              const emConfirmacao = confirmar?.id === id ? confirmar.decisao : null
              return (
                <li key={id} className="rounded-md border border-slate-300 p-2">
                  <p className="text-sm font-semibold">
                    {nomeEquipe(d.equipeId)} <span aria-hidden="true">{iconeEstadoDesafio(d.estado)} </span>
                    <span>{textoEstadoDesafio(d.estado)}</span>
                  </p>
                  {d.motivo ? <p className="text-sm">Motivo: {d.motivo}</p> : null}
                  {linkVideoSeguro(d.linkVideo) ? (
                    <p className="text-sm">
                      <a href={linkVideoSeguro(d.linkVideo) ?? undefined} target="_blank" rel="noopener noreferrer" className="break-all font-semibold text-blue-800 underline">
                        Ver vídeo
                      </a>
                    </p>
                  ) : null}
                  {podeDecidir(d, false) ? (
                    emConfirmacao ? (
                      <div className="mt-2" role="group" aria-label="Confirmar decisão">
                        <p className="text-sm font-bold">{textoDecisao(emConfirmacao)}?</p>
                        <div className="mt-1 flex flex-wrap gap-2">
                          <button type="button" disabled={!aberto} onClick={() => void decidir(id, emConfirmacao)} className={`${BTN} bg-blue-700 text-white`}>
                            {emVoo ? 'Enviando...' : 'Confirmar'}
                          </button>
                          <button type="button" disabled={emVoo} onClick={() => setConfirmar(null)} className={`${BTN} border-2 border-slate-500 bg-white text-slate-900`}>
                            Voltar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button type="button" disabled={!aberto} onClick={() => setConfirmar({ id, decisao: 'MANTIDA' })} className={`${BTN} bg-blue-700 text-white`}>
                          Mantida
                        </button>
                        <button type="button" disabled={!aberto} onClick={() => setConfirmar({ id, decisao: 'REVERTIDA' })} className={`${BTN} bg-blue-700 text-white`}>
                          Revertida
                        </button>
                        <button type="button" disabled={!aberto} onClick={() => setConfirmar({ id, decisao: 'INCONCLUSIVA' })} className={`${BTN} border-2 border-blue-700 bg-white text-blue-900`}>
                          Inconclusiva (não consome)
                        </button>
                        <button type="button" disabled={!aberto} onClick={() => setConfirmar({ id, decisao: 'CANCELADO' })} className={`${BTN} border-2 border-slate-500 bg-white text-slate-900`}>
                          Cancelar
                        </button>
                      </div>
                    )
                  ) : null}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </section>
  )
}
