'use client'

import { useState, type FormEvent } from 'react'
import { Aviso, botaoPrimario, botaoSecundario, Campo, campoEstilo, Carregando, descreve, falhaDe, useCarregar } from '@/components/meu-time/ui'
import type { Atleta, InscricaoResumo } from '@/lib/meu-time-ui/tipos'
import {
  atletaEmPedidoPendente,
  mensagemFalhaTroca,
  podeCancelarPedido,
  regraBotaoTroca,
  ROTULO_ESTADO_PEDIDO,
  validarPedidoTroca,
  type EstadoPedido,
} from '@/lib/meu-time-elenco-ui/troca'
import { obterElencoClientPadrao, type ElencoClient } from './cliente'

type Props = {
  inscricao: InscricaoResumo
  atletas: Atleta[]
  /** Papéis que podem pedir troca (responsável e técnico). Os demais só acompanham. */
  podePedir: boolean
  cliente?: ElencoClient
  agora?: Date
}

const CLASSE_ESTADO: Record<EstadoPedido, string> = { PENDENTE: 'is-warning', APROVADO: 'is-success', RECUSADO: 'is-error', CANCELADO: '' }

/** Troca de atleta numa inscrição já confirmada: livre até o prazo; depois vira pedido para o organizador. */
export function PedidosTroca({ inscricao, atletas, podePedir, cliente, agora }: Props) {
  const api = cliente ?? obterElencoClientPadrao()
  const regra = regraBotaoTroca(inscricao.prazoTrocaEm, agora)
  const { carga, recarregar, tentarDeNovo } = useCarregar(() => api.listarPedidosTroca(inscricao.id))
  const [aberto, setAberto] = useState(false)
  const [sai, setSai] = useState('')
  const [entra, setEntra] = useState('')
  const [motivo, setMotivo] = useState('')
  const [erros, setErros] = useState<Partial<Record<'sai' | 'entra' | 'motivo', string>>>({})
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [cancelando, setCancelando] = useState<string | null>(null)

  const naInscricao = inscricao.atletaIds
  const quemSai = naInscricao ? atletas.filter((a) => naInscricao.includes(a.id)) : atletas
  const quemEntra = (naInscricao ? atletas.filter((a) => !naInscricao.includes(a.id)) : atletas).filter((a) => a.id !== sai)
  const nomeDe = (id: string, nome: string | null) => nome ?? atletas.find((a) => a.id === id)?.nome ?? 'Atleta'

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    if (enviando) return
    const r = validarPedidoTroca({ sai, entra, motivo })
    setErros(r.erros)
    setMensagem(null)
    if (!r.valido || !r.dados) return
    setEnviando(true)
    try {
      await api.pedirTroca(inscricao.id, r.dados)
      setAberto(false)
      setSai('')
      setEntra('')
      setMotivo('')
      await recarregar()
    } catch (erro) {
      const falha = falhaDe(erro)
      setMensagem([403, 404, 409].includes(falha.status) || falha.codigo ? mensagemFalhaTroca(falha.status, falha.codigo) : falha.mensagem)
    } finally {
      setEnviando(false)
    }
  }

  async function cancelar(pedidoId: string) {
    if (cancelando) return
    setCancelando(pedidoId)
    setMensagem(null)
    try {
      await api.cancelarPedidoTroca(inscricao.id, pedidoId)
      await recarregar()
    } catch (erro) {
      setMensagem(falhaDe(erro).mensagem)
    } finally {
      setCancelando(null)
    }
  }

  const pedidos = carga.estado === 'pronto' ? carga.dados : []
  const idForm = `troca-${inscricao.id}`

  return (
    <div className="flex flex-col gap-3 border-t border-[var(--vs-border)] pt-3" data-testid="troca-inscricao">
      <p className="text-sm">{regra.explicacao}</p>
      {mensagem && <Aviso tom="is-error" alerta>{mensagem}</Aviso>}

      {regra.modo === 'pedir' && podePedir && !aberto && (
        <button type="button" onClick={() => setAberto(true)} className={botaoSecundario}>{regra.rotuloBotao}</button>
      )}
      {regra.modo === 'pedir' && !podePedir && <Aviso>Só o responsável ou o técnico do time pode pedir troca.</Aviso>}

      {aberto && (
        <form onSubmit={enviar} noValidate aria-label="Pedir troca de atleta" className="flex flex-col gap-3 rounded-xl border border-[var(--vs-border-strong)] bg-[var(--vs-elevated)] p-3">
          <Campo id={`${idForm}-sai`} rotulo="Quem sai" erro={erros.sai}>
            <select id={`${idForm}-sai`} value={sai} onChange={(e) => setSai(e.target.value)} className={campoEstilo} {...descreve(`${idForm}-sai`, undefined, erros.sai)}>
              <option value="">Escolha</option>
              {quemSai.map((a) => <option key={a.id} value={a.id} disabled={atletaEmPedidoPendente(pedidos, a.id)}>{a.nome}{atletaEmPedidoPendente(pedidos, a.id) ? ' (já tem pedido)' : ''}</option>)}
            </select>
          </Campo>
          <Campo id={`${idForm}-entra`} rotulo="Quem entra" erro={erros.entra}>
            <select id={`${idForm}-entra`} value={entra} onChange={(e) => setEntra(e.target.value)} className={campoEstilo} {...descreve(`${idForm}-entra`, undefined, erros.entra)}>
              <option value="">Escolha</option>
              {quemEntra.map((a) => <option key={a.id} value={a.id} disabled={atletaEmPedidoPendente(pedidos, a.id)}>{a.nome}{atletaEmPedidoPendente(pedidos, a.id) ? ' (já tem pedido)' : ''}</option>)}
            </select>
          </Campo>
          <Campo id={`${idForm}-motivo`} rotulo="Motivo (opcional)" ajuda="Ajuda o organizador a decidir. Exemplo: lesão." erro={erros.motivo}>
            <textarea id={`${idForm}-motivo`} value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} rows={2} className={campoEstilo} {...descreve(`${idForm}-motivo`, 'Ajuda o organizador a decidir. Exemplo: lesão.', erros.motivo)} />
          </Campo>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="submit" disabled={enviando} className={botaoPrimario}>{enviando ? 'Enviando…' : 'Enviar pedido'}</button>
            <button type="button" disabled={enviando} onClick={() => setAberto(false)} className={botaoSecundario}>Cancelar</button>
          </div>
        </form>
      )}

      {carga.estado === 'carregando' && <Carregando texto="Carregando os pedidos de troca…" />}
      {carga.estado === 'falha' && carga.falha.tipo !== 'nao-habilitado' && (
        <Aviso tom="is-error" alerta>
          {carga.falha.mensagem}{' '}
          <button type="button" onClick={tentarDeNovo} className="min-h-[44px] font-black underline">Tentar de novo</button>
        </Aviso>
      )}
      {carga.estado === 'pronto' && pedidos.length === 0 && regra.modo === 'pedir' && <p className="text-sm text-[var(--vs-muted)]">Nenhum pedido de troca ainda.</p>}
      {pedidos.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Pedidos de troca">
          {pedidos.map((p) => (
            <li key={p.id} className="flex flex-col gap-1 rounded-xl border border-[var(--vs-border)] p-3">
              <p className="text-sm font-bold">Sai {nomeDe(p.sai.id, p.sai.nome)} · entra {nomeDe(p.entra.id, p.entra.nome)}</p>
              <p className={`vs-state ${CLASSE_ESTADO[p.estado]} inline-block self-start rounded-full px-2 py-1 text-xs font-bold`}>{ROTULO_ESTADO_PEDIDO[p.estado]}</p>
              {p.motivo && <p className="text-sm text-[var(--vs-muted)]">Motivo: {p.motivo}</p>}
              {p.estado === 'RECUSADO' && <p className="text-sm font-bold">{p.motivoRecusa ? `Motivo da recusa: ${p.motivoRecusa}` : 'O organizador recusou este pedido.'}</p>}
              {podePedir && podeCancelarPedido(p) && (
                <button type="button" disabled={cancelando === p.id} onClick={() => void cancelar(p.id)} aria-label={`Cancelar o pedido de troca: sai ${nomeDe(p.sai.id, p.sai.nome)}`} className="min-h-[44px] self-start rounded-xl border border-[var(--vs-error-border)] px-4 text-sm font-bold text-[var(--vs-error-fg)]">
                  {cancelando === p.id ? 'Cancelando…' : 'Cancelar pedido'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
