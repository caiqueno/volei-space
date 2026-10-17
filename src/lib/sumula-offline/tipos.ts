/**
 * Tipos da fila offline (outbox) da súmula por eventos.
 * Contrato do servidor: POST /api/sumula/[token]/eventos (ver src/lib/sumula-eventos/esquema.ts).
 */
import type { SumulaEventoTipo } from '@/lib/regras-volei/eventos'
import type { EstadoSumula } from '@/lib/sumula-eventos/servico'

export interface EventoNovo {
  /** Opcional: a tela pode gerar o id no gesto do toque; o mesmo id nunca entra duas vezes na fila (duplo toque). */
  clientEventId?: string
  tipo: SumulaEventoTipo
  payload?: Record<string, unknown>
  desfazId?: number | null
  /**
   * DESFAZ por referência: clientEventId do evento a desfazer. A fila troca pelo `seq` do servidor na hora de enviar
   * (a tela não conhece o seq). Se o alvo nunca chegou ao servidor, o DESFAZ é descartado (não há o que desfazer).
   */
  desfazClientEventId?: string
}

export interface ItemFila {
  clientEventId: string
  /** Ordem local, crescente e sem buracos. É ela (e não a hora do aparelho) que manda na ordem de envio (G8). */
  seqLocal: number
  tipo: SumulaEventoTipo
  payload: Record<string, unknown>
  desfazId?: number | null
  desfazClientEventId?: string
  /** Hora do aparelho: só informativa para o servidor, nunca usada para ordenar. */
  ocorridoEm: string
  tentativas: number
}

/** Evento recusado por regra: o apontador precisa decidir (corrigir, desfazer ou descartar). */
export interface Pendencia {
  clientEventId: string
  seqLocal: number
  tipo: SumulaEventoTipo
  payload: Record<string, unknown>
  codigo: string
  mensagem: string
  em: string
}

export interface ConflitoRegistrado {
  em: string
  seqAtual: number
  /** Eventos que outro aparelho gravou entre a última leitura e o 409. 0 = só reenvio dos nossos (sem aviso). */
  externos?: number
  /** O apontador já viu o aviso (persistido: o aviso não volta ao recarregar a tela). */
  reconhecido?: boolean
}

export interface DadosPersistidos {
  versao: 1
  proximoSeqLocal: number
  /** Último seq do servidor conhecido (vai em `seqEsperado`). */
  seqServidor: number
  itens: ItemFila[]
  pendencias: Pendencia[]
  ultimoConflito: ConflitoRegistrado | null
  /** seq do servidor por clientEventId aceito (resolve DESFAZ por referência). Opcional em dados antigos. */
  seqs?: Record<string, number>
}

export type StatusConexao = 'online' | 'sincronizando' | 'pendente' | 'offline' | 'erro'

export interface SnapshotFila {
  status: StatusConexao
  online: boolean
  /** Rota de eventos desligada (404/503): a fila segue local, sem alarme ao usuário. */
  modoLocal: boolean
  pendentes: number
  enviando: number
  pendencias: Pendencia[]
  seqServidor: number
  estadoServidor: EstadoSumula | null
  ultimoConflito: ConflitoRegistrado | null
  /** Há conflito reconciliado que o apontador ainda não viu (outro aparelho lançou eventos). */
  conflitoAberto: boolean
  /** Mensagem curta para o usuário; só em status 'erro'. */
  erro: string | null
  proximaTentativaEm: number | null
}

export interface ArmazenamentoFila {
  carregar(chave: string): Promise<string | null>
  salvar(chave: string, valor: string): Promise<void>
  remover(chave: string): Promise<void>
}

export interface OpcoesFila {
  token: string
  armazenamento: ArmazenamentoFila
  fetchImpl?: typeof fetch
  /** Relógio (ms). Só para recuo e carimbo informativo. */
  agora?: () => number
  aleatorio?: () => number
  gerarId?: () => string
  estaOnline?: () => boolean
  /** Agendador injetável (teste). */
  agendar?: (fn: () => void, ms: number) => unknown
  cancelar?: (handle: unknown) => void
  recuoBaseMs?: number
  recuoMaxMs?: number
  /** Espera mínima quando a rota está desligada (404/503). */
  recuoModoLocalMs?: number
  tamanhoLote?: number
  /** Quantas vezes seguidas reconciliar um 409 num mesmo ciclo. */
  maxConflitosPorCiclo?: number
  url?: string
}
