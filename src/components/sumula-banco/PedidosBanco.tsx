'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  bancoAppAtivo,
  lerEnvelope,
  podeAceitar,
  pedidosPendentes,
  textoPedido,
  type PedidoBanco,
} from '@/lib/sumula-banco-ui'

const INTERVALO_MS = 3000

export interface PedidosBancoProps {
  token: string
  partidaEmAndamento: boolean
  nomeEquipe: (equipeId: number) => string
  /** Número de camisa/rótulo do atleta (ex.: "#7"), ou null se desconhecido. */
  rotuloJogador: (equipeId: number, jogadorId: number) => string | null
  /**
   * Registra o tempo pela função que a tela já usa (com a validação do motor). Se o motor bloquear, a tela mostra a
   * CaixaRegra e NÃO chama `aoRegistrar`; a decisão fica com o árbitro.
   */
  onAceitarTempo: (equipeId: number, aoRegistrar: () => void) => void
  onAceitarTroca: (equipeId: number, saiJogadorId: number, entraJogadorId: number, aoRegistrar: () => void) => void
  /** Notifica o apontador (toast da tela). */
  aviso?: (mensagem: string) => void
}

/** Painel compacto de pedidos do banco. Com a flag desligada não renderiza nada e não faz requisição. */
export function PedidosBanco(props: PedidosBancoProps) {
  const ativo = bancoAppAtivo(process.env.NEXT_PUBLIC_BANCO_APP_ATIVO)
  const { token } = props
  const [pedidos, setPedidos] = useState<PedidoBanco[]>([])
  const [decidindo, setDecidindo] = useState<Set<string>>(new Set())
  const [decididos, setDecididos] = useState<Set<string>>(new Set())
  const [erro, setErro] = useState('')
  const [dica, setDica] = useState('')
  const [recarga, setRecarga] = useState(0)
  const desligadoRef = useRef(false)
  const avisoRef = useRef(props.aviso)
  avisoRef.current = props.aviso

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
        const resposta = await fetch(`/api/sumula/${encodeURIComponent(token)}/pedidos-banco`, { cache: 'no-store' })
        const lido = await lerEnvelope<{ pedidos: PedidoBanco[] }>(resposta)
        if (!vivo) return
        if (lido.tipo === 'desligado') {
          desligadoRef.current = true
          setPedidos([])
          return
        }
        if (lido.tipo === 'ok') {
          setPedidos(Array.isArray(lido.data?.pedidos) ? lido.data.pedidos : [])
          setErro('')
        } else {
          setErro('Não foi possível atualizar os pedidos do banco. Tentando de novo.')
        }
      } catch {
        if (vivo) setErro('Sem conexão para atualizar os pedidos do banco. Tentando de novo.')
      }
      if (vivo) timer = setTimeout(buscar, INTERVALO_MS)
    }

    void buscar()
    return () => {
      vivo = false
      if (timer) clearTimeout(timer)
    }
  }, [ativo, token, recarga])

  const enviarDecisao = useCallback(async (pedido: PedidoBanco, decisao: 'ACEITO' | 'RECUSADO') => {
    const chave = String(pedido.id)
    setDecidindo((atual) => new Set(atual).add(chave))
    try {
      const resposta = await fetch(`/api/sumula/${encodeURIComponent(token)}/pedidos-banco/${encodeURIComponent(chave)}/decidir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisao }),
      })
      const lido = await lerEnvelope<unknown>(resposta)
      if (lido.tipo === 'ok') {
        setDecididos((atual) => new Set(atual).add(chave))
        setDica('')
        // Aceitar DESAFIO: o servidor cria o desafio; recarrega a lista de pedidos (o painel de desafios atualiza no próprio polling).
        if (decisao === 'ACEITO' && pedido.tipo === 'DESAFIO') setRecarga((n) => n + 1)
      } else {
        const mensagem = lido.tipo === 'erro' ? lido.mensagem : 'O banco não está habilitado para esta partida.'
        avisoRef.current?.(
          decisao === 'ACEITO'
            ? `O pedido foi registrado na súmula, mas o banco não recebeu a resposta (${mensagem}). Avise o banco e toque em Recusar/Aceitar de novo só se precisar.`
            : `Não foi possível enviar a recusa: ${mensagem}`,
        )
      }
    } catch {
      avisoRef.current?.('Sem conexão para responder ao banco. Tente de novo.')
    } finally {
      setDecidindo((atual) => {
        const proximo = new Set(atual)
        proximo.delete(chave)
        return proximo
      })
    }
  }, [token])

  if (!ativo) return null
  const visiveis = pedidosPendentes(pedidos).filter((p) => !decididos.has(String(p.id)))
  if (visiveis.length === 0 && !erro) return null

  function aceitar(pedido: PedidoBanco) {
    const registrar = () => void enviarDecisao(pedido, 'ACEITO')
    setDica('')
    if (pedido.tipo === 'TEMPO') {
      props.onAceitarTempo(pedido.equipeId, registrar)
      setDica('Se o motor bloquear, leia o aviso da regra: o registro depende da decisão do árbitro.')
    } else if (pedido.tipo === 'SUBSTITUICAO') {
      const sai = Number(pedido.payload?.sai)
      const entra = Number(pedido.payload?.entra)
      props.onAceitarTroca(pedido.equipeId, sai, entra, registrar)
      setDica('Se o motor bloquear, leia o aviso da regra: o registro depende da decisão do árbitro.')
    } else {
      registrar()
    }
  }

  return (
    <section
      aria-label="Pedidos do banco"
      aria-live="polite"
      className="mx-auto my-2 w-full max-w-3xl rounded-lg border-2 border-blue-700 bg-white px-3 py-2 text-slate-900 shadow-sm"
    >
      <h2 className="text-xs font-bold uppercase tracking-wide text-blue-900">Pedidos do banco</h2>
      {erro ? <p className="mt-1 text-xs text-amber-900">{erro}</p> : null}
      <ul className="mt-1 space-y-2">
        {visiveis.map((pedido) => {
          const chave = String(pedido.id)
          const emVoo = decidindo.has(chave)
          const regra = podeAceitar(pedido, { partidaEmAndamento: props.partidaEmAndamento, decidindo: emVoo })
          const texto = textoPedido(pedido, props.nomeEquipe(pedido.equipeId), (jogadorId) => props.rotuloJogador(pedido.equipeId, jogadorId))
          return (
            <li key={chave} className="flex flex-wrap items-center gap-2">
              <p className="min-w-0 flex-1 text-sm font-semibold">{texto}</p>
              <button
                type="button"
                disabled={!regra.ok}
                onClick={() => aceitar(pedido)}
                className="min-h-[48px] min-w-[104px] rounded-md bg-blue-700 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Aceitar
              </button>
              <button
                type="button"
                disabled={emVoo || pedido.estado.toUpperCase() !== 'PENDENTE'}
                onClick={() => void enviarDecisao(pedido, 'RECUSADO')}
                className="min-h-[48px] min-w-[104px] rounded-md border-2 border-slate-500 bg-white px-4 text-sm font-bold text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Recusar
              </button>
              {!regra.ok && !emVoo ? <p className="w-full text-xs text-slate-700">{regra.motivo}</p> : null}
            </li>
          )
        })}
      </ul>
      {dica ? <p className="mt-1 text-xs text-slate-700">{dica}</p> : null}
    </section>
  )
}
