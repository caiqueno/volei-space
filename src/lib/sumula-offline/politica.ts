/**
 * Regras PURAS da súmula offline-first (sem React, sem rede): reconciliação de conflito, indicador fixo e
 * bloqueio de fechamento. A fila (fila.ts) usa a reconciliação; a tela usa o indicador e o bloqueio.
 */
import type { SnapshotFila } from './tipos'

export interface LinhaLog {
  clientEventId: string
  seq: number
}

/**
 * Quantos eventos de OUTRO aparelho entraram no log desde a última leitura.
 * - Com o log rebuscado: conta os eventos com seq > seqAnterior cujo clientEventId não é nosso.
 * - Sem o log (rebuscar falhou): usa a aritmética `seqAtual - seqAnterior - nossosAceitos` (nunca negativa).
 * Eventos nossos já aceitos (reenvio depois de resposta perdida) nunca contam como externos.
 */
export function contarEventosExternos(args: {
  seqAnterior: number
  seqAtual: number
  /** clientEventId de tudo que é nosso: fila local + já aceitos conhecidos. */
  idsNossos: ReadonlySet<string>
  /** Quantos eventos nossos o 409 informou como já aceitos. */
  aceitosNossos: number
  log?: ReadonlyArray<LinhaLog> | null
}): number {
  const { seqAnterior, seqAtual, idsNossos, aceitosNossos, log } = args
  if (log && log.length > 0) {
    return log.filter((l) => l.seq > seqAnterior && !idsNossos.has(l.clientEventId)).length
  }
  const salto = Math.max(0, Math.floor(seqAtual) - Math.floor(seqAnterior))
  return Math.max(0, salto - Math.max(0, aceitosNossos))
}

/** Extrai {clientEventId, seq} de um corpo de GET /eventos. Tolerante: lixo vira lista vazia. */
export function lerLinhasDoLog(corpo: unknown): LinhaLog[] {
  const eventos = (corpo as { data?: { eventos?: unknown } } | null)?.data?.eventos
  if (!Array.isArray(eventos)) return []
  const saida: LinhaLog[] = []
  for (const e of eventos) {
    const id = (e as { clientEventId?: unknown })?.clientEventId
    const seq = Number((e as { seq?: unknown })?.seq)
    if (typeof id === 'string' && Number.isFinite(seq)) saida.push({ clientEventId: id, seq })
  }
  return saida
}

export type ChaveIndicador = 'salvo' | 'sincronizando' | 'pendente' | 'offline' | 'conflito' | 'erro'

export interface ModeloIndicador {
  chave: ChaveIndicador
  /** Rótulo curto e fixo: Salvo / N pendentes / Sem conexão / Conflito. */
  rotulo: string
  /** Frase de apoio (leitor de tela e tooltip). */
  detalhe: string
}

type EntradaIndicador = Pick<SnapshotFila, 'status' | 'pendentes' | 'enviando' | 'erro' | 'modoLocal'> & {
  conflitoAberto?: boolean
  externos?: number
}

const pendentes = (n: number) => `${n} ${n === 1 ? 'pendente' : 'pendentes'}`

/** Prioridade: conflito > erro > sem conexão > pendentes/sincronizando > salvo. */
export function modeloDoIndicador(s: EntradaIndicador): ModeloIndicador {
  if (s.conflitoAberto) {
    const n = s.externos ?? 0
    return {
      chave: 'conflito',
      rotulo: 'Conflito',
      detalhe:
        n > 0
          ? `Outro aparelho lançou ${n} ${n === 1 ? 'evento' : 'eventos'} nesta súmula. Seus lançamentos foram mantidos; confira o placar.`
          : 'A súmula mudou em outro aparelho. Seus lançamentos foram mantidos; confira o placar.',
    }
  }
  if (s.status === 'erro') return { chave: 'erro', rotulo: 'Erro ao salvar', detalhe: s.erro ?? 'Não foi possível sincronizar agora.' }
  if (s.status === 'offline') {
    return {
      chave: 'offline',
      rotulo: 'Sem conexão',
      detalhe: s.pendentes > 0 ? `${pendentes(s.pendentes)} guardados neste aparelho; envio automático ao voltar a rede.` : 'Sem conexão. O que você lançar fica guardado neste aparelho.',
    }
  }
  if (s.status === 'sincronizando') return { chave: 'sincronizando', rotulo: pendentes(s.enviando || s.pendentes), detalhe: 'Enviando os lançamentos.' }
  if (s.status === 'pendente') {
    if (s.modoLocal) return { chave: 'salvo', rotulo: 'Salvo', detalhe: 'Salvo neste aparelho (a sincronização por eventos ainda não está ativa no servidor).' }
    return { chave: 'pendente', rotulo: pendentes(s.pendentes), detalhe: 'Aguardando envio ao servidor.' }
  }
  return { chave: 'salvo', rotulo: 'Salvo', detalhe: 'Tudo salvo no servidor.' }
}

export interface BloqueioFechamento {
  bloqueado: boolean
  motivo: string | null
}

/**
 * A súmula não pode ser fechada com lançamentos que o servidor ainda não confirmou, nem com recusas por regra
 * sem decisão do apontador, nem com conflito não visto. Rota desligada (modo local, 404/503) NÃO bloqueia:
 * o fluxo legado (PUT/POST da súmula) é a fonte e a fila não tem para onde enviar.
 */
export function bloqueioDeFechamento(s: Pick<SnapshotFila, 'pendentes' | 'pendencias' | 'modoLocal'> & { conflitoAberto?: boolean }): BloqueioFechamento {
  if (s.modoLocal) return { bloqueado: false, motivo: null }
  if (s.pendentes > 0) {
    return {
      bloqueado: true,
      motivo: `Há ${s.pendentes} ${s.pendentes === 1 ? 'lançamento' : 'lançamentos'} que ainda não ${s.pendentes === 1 ? 'foi enviado' : 'foram enviados'} ao servidor. Aguarde o envio (volte a ter conexão) antes de fechar a súmula.`,
    }
  }
  if (s.pendencias.length > 0) {
    return {
      bloqueado: true,
      motivo: `Há ${s.pendencias.length} ${s.pendencias.length === 1 ? 'lançamento recusado' : 'lançamentos recusados'} pelas regras. Abra "Ver pendências" e resolva antes de fechar a súmula.`,
    }
  }
  if (s.conflitoAberto) {
    return { bloqueado: true, motivo: 'A súmula mudou em outro aparelho. Confira o placar e toque em "Entendi" antes de fechar.' }
  }
  return { bloqueado: false, motivo: null }
}
