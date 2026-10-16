/**
 * Orquestra a leitura do estado e o processamento de um lote de eventos: valida cada evento com o
 * motor, grava pelo RPC atômico e devolve aceitos/rejeitados. Sem Next: recebe o cliente do banco.
 *
 * Regras do lote:
 *  - ordem do lote = ordem de gravação; o primeiro evento rejeitado interrompe o lote e os
 *    seguintes voltam como "não processados" (RG-LOG-009), porque dependem do anterior;
 *  - reenvio com o mesmo clientEventId é aceito como duplicado, sem regravar;
 *  - `seqEsperado` desatualizado devolve conflito (409) com o estado atual, sem gravar nada.
 */
import { anexarEvento, type AvisoRegra, type ConfigPartida, type ContextoDerivacao, type SumulaEvento } from '@/lib/regras-volei'
import type { LoteRecebido } from './esquema'
import { argumentosDoRpc, linhasParaLog, type OrigemDoEvento, type PartidaParaEvento } from './mapeamento'
import { carregarLinhas, registrarNoBanco, type ClienteEventos } from './repositorio'
import { projetarEstado, validarNovoEvento, type EstadoSumula } from './servico'

export interface EntradaPartida {
  partida: PartidaParaEvento
  config: ConfigPartida
  contexto: ContextoDerivacao
}

export interface EventoAceito {
  indice: number
  clientEventId: string
  seq: number
  duplicado: boolean
  avisos: AvisoRegra[]
}

export interface EventoRejeitado {
  indice: number
  clientEventId: string
  codigo: string
  mensagem: string
  /** true quando o evento nem foi avaliado porque um anterior do lote foi rejeitado. */
  naoProcessado?: boolean
}

export type ResultadoLeitura =
  | { tipo: 'OK'; estado: EstadoSumula; eventos: SumulaEvento[] }
  | { tipo: 'INDISPONIVEL'; mensagem: string }
  | { tipo: 'ERRO'; mensagem: string }

export type ResultadoLote =
  | { tipo: 'PROCESSADO'; aceitos: EventoAceito[]; rejeitados: EventoRejeitado[]; estado: EstadoSumula }
  | { tipo: 'CONFLITO'; aceitos: EventoAceito[]; estado: EstadoSumula; seqAtual: number }
  | { tipo: 'INDISPONIVEL'; mensagem: string }
  | { tipo: 'ERRO'; mensagem: string }

export async function lerEstado(cliente: ClienteEventos, entrada: EntradaPartida, aPartirDeSeq = 0): Promise<ResultadoLeitura> {
  const leitura = await carregarLinhas(cliente, entrada.partida.id)
  if (!leitura.ok) return leitura.indisponivel ? { tipo: 'INDISPONIVEL', mensagem: leitura.mensagem } : { tipo: 'ERRO', mensagem: leitura.mensagem }
  const { log } = linhasParaLog(leitura.linhas)
  return {
    tipo: 'OK',
    estado: projetarEstado(log, entrada.config, entrada.contexto),
    eventos: log.filter((e) => e.seq > aPartirDeSeq),
  }
}

export async function processarLote(
  cliente: ClienteEventos,
  entrada: EntradaPartida,
  lote: LoteRecebido,
  origem: OrigemDoEvento,
): Promise<ResultadoLote> {
  const { partida, config, contexto } = entrada
  const leitura = await carregarLinhas(cliente, partida.id)
  if (!leitura.ok) return leitura.indisponivel ? { tipo: 'INDISPONIVEL', mensagem: leitura.mensagem } : { tipo: 'ERRO', mensagem: leitura.mensagem }
  let { log, idPorSeq } = linhasParaLog(leitura.linhas)

  const aceitos: EventoAceito[] = []
  const rejeitados: EventoRejeitado[] = []

  const conflito = (seqAtual: number): ResultadoLote => ({
    tipo: 'CONFLITO',
    aceitos,
    seqAtual,
    estado: projetarEstado(log, config, contexto),
  })

  // Versão otimista. Os eventos do início do lote que já estão gravados (reenvio) contam como
  // conhecidos: o cliente que reenvia o mesmo lote não deve tomar 409 por causa dos próprios eventos.
  const ids = new Set(log.map((e) => e.clientEventId))
  let iniciais = 0
  while (iniciais < lote.eventos.length && ids.has(lote.eventos[iniciais]!.clientEventId)) iniciais += 1
  const haNovos = iniciais < lote.eventos.length
  const ultimoSeq = log.length
  if (haNovos && lote.seqEsperado !== undefined && lote.seqEsperado + iniciais !== ultimoSeq) {
    return conflito(ultimoSeq)
  }

  for (let indice = 0; indice < lote.eventos.length; indice += 1) {
    const recebido = lote.eventos[indice]!
    const resultado = validarNovoEvento(log, config, contexto, recebido)

    if (!resultado.ok) {
      rejeitados.push({ indice, clientEventId: recebido.clientEventId, codigo: resultado.codigo, mensagem: resultado.mensagem })
      for (let resto = indice + 1; resto < lote.eventos.length; resto += 1) {
        rejeitados.push({
          indice: resto,
          clientEventId: lote.eventos[resto]!.clientEventId,
          codigo: 'RG-LOG-009',
          mensagem: 'Evento não processado: um evento anterior do lote foi rejeitado. Corrija e reenvie a partir dele.',
          naoProcessado: true,
        })
      }
      break
    }
    if (resultado.duplicado) {
      aceitos.push({ indice, clientEventId: recebido.clientEventId, seq: resultado.evento.seq, duplicado: true, avisos: [] })
      continue
    }

    const args = argumentosDoRpc({
      partida,
      novo: resultado.novo,
      setNumero: resultado.setNumero,
      origem: { ...origem, ocorridoEm: recebido.ocorridoEm },
      seqEsperado: log.length,
      idPorSeq,
    })
    const gravado = await registrarNoBanco(cliente, args)

    if (gravado.tipo === 'INDISPONIVEL' || gravado.tipo === 'FALHA') {
      return { tipo: gravado.tipo === 'INDISPONIVEL' ? 'INDISPONIVEL' : 'ERRO', mensagem: gravado.mensagem }
    }
    if (gravado.tipo === 'CONFLITO') {
      const atual = await carregarLinhas(cliente, partida.id)
      if (atual.ok) ({ log, idPorSeq } = linhasParaLog(atual.linhas))
      return conflito(gravado.seqAtual ?? log.length)
    }
    if (gravado.tipo === 'RECUSADO') {
      rejeitados.push({
        indice,
        clientEventId: recebido.clientEventId,
        codigo: gravado.oficializada ? 'RG-LOG-008' : 'RG-LOG-011',
        mensagem: gravado.oficializada
          ? 'A súmula já foi oficializada e não aceita novos eventos.'
          : 'O banco recusou o evento por violar uma regra de integridade.',
      })
      break
    }

    // Gravado. Se o RPC achou o clientEventId (outro envio venceu a corrida), o log local está velho.
    const anexado = anexarEvento(log, resultado.novo)
    if (gravado.duplicado || !anexado.ok || anexado.evento.seq !== gravado.seq) {
      const atual = await carregarLinhas(cliente, partida.id)
      if (!atual.ok) return { tipo: 'ERRO', mensagem: atual.mensagem }
      ;({ log, idPorSeq } = linhasParaLog(atual.linhas))
    } else {
      log = [...anexado.log]
      idPorSeq.set(gravado.seq, gravado.id)
    }
    aceitos.push({ indice, clientEventId: recebido.clientEventId, seq: gravado.seq, duplicado: gravado.duplicado, avisos: resultado.avisos })
  }

  return { tipo: 'PROCESSADO', aceitos, rejeitados, estado: projetarEstado(log, config, contexto) }
}
