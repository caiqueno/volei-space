/**
 * Formato dos eventos recebidos pela API. O envelope é validado antes de qualquer coisa;
 * o payload de cada evento é validado depois, evento a evento, para que um payload ruim
 * vire uma rejeição desse evento (RG-LOG-011) e não derrube o lote inteiro.
 */
import { z } from 'zod'
import type { SumulaEventoTipo } from '@/lib/regras-volei'

export const TIPOS_DE_EVENTO = [
  'SET_INICIADO',
  'PONTO',
  'RALLY_REPETIDO',
  'SUBSTITUICAO',
  'TEMPO',
  'TROCA_LIBERO',
  'REDESIGNACAO_LIBERO',
  'SANCAO',
  'FALTA_POSICAO',
  'FALTA_ROTACAO',
  'TROCA_LADO',
  'SET_ANULADO',
  'INTERRUPCAO',
  'WO',
  'EQUIPE_INCOMPLETA',
  'OBSERVACAO',
  'DISCREPANCIA_PAPELETA',
  'CAPITAO_EM_JOGO',
  'PROTESTO_ANUNCIADO',
  'PROTESTO_REGISTRADO',
  'PROTESTO_DESISTIDO',
  'DESFAZ',
] as const satisfies readonly SumulaEventoTipo[]

export const MAX_EVENTOS_POR_LOTE = 50

const jogador = z.number().int().positive()
const equipe = z.enum(['A', 'B'])
const formacao = z.array(jogador).length(6)
const liberos = z.array(jogador).max(2)

/** Schema do payload por tipo. Chaves desconhecidas são descartadas (nada de lixo no log). */
export const PAYLOAD_POR_TIPO: Record<SumulaEventoTipo, z.ZodTypeAny> = {
  SET_INICIADO: z.object({
    numeroSet: z.number().int().min(1).max(5),
    formacaoA: formacao,
    formacaoB: formacao,
    saqueInicial: equipe,
    liberosA: liberos.optional(),
    liberosB: liberos.optional(),
  }),
  PONTO: z.object({ equipe, sacador: jogador.optional() }),
  RALLY_REPETIDO: z.object({ motivo: z.enum(['ACIDENTE_COM_BOLA_EM_JOGO', 'INTERFERENCIA_EXTERNA', 'OUTRO']).optional() }),
  // Uma troca (`sai`/`entra`) OU várias no mesmo pedido (`trocas`, RG-SUB-007), nunca as duas formas.
  SUBSTITUICAO: z
    .object({
      equipe,
      sai: jogador.optional(),
      entra: jogador.optional(),
      trocas: z.array(z.object({ sai: jogador, entra: jogador })).min(1).max(6).optional(),
      excepcional: z.boolean().optional(),
      motivo: z.enum(['LESAO', 'DOENCA', 'EXPULSAO', 'DESQUALIFICACAO']).optional(),
    })
    .refine((v) => (v.trocas !== undefined) !== (v.sai !== undefined || v.entra !== undefined), {
      message: 'Informe sai e entra, ou a lista trocas (não as duas).',
    })
    .refine((v) => v.trocas !== undefined || (v.sai !== undefined && v.entra !== undefined), {
      message: 'Informe sai e entra.',
    }),
  TEMPO: z.object({ equipe }),
  TROCA_LIBERO: z.object({
    equipe,
    sai: jogador,
    entra: jogador,
    momento: z.enum(['BOLA_FORA', 'APOS_APITO', 'EM_JOGO']).optional(),
  }),
  REDESIGNACAO_LIBERO: z.object({ equipe, liberoIncapaz: jogador, novoLibero: jogador }),
  // `sancao` e `pontoParaAdversario` NÃO são aceitos do cliente: o servidor calcula.
  SANCAO: z.object({
    equipe,
    membro: z.string().regex(/^(J:\d+|[A-Z_]{3,20})$/, 'Use J:<id do jogador> ou TECNICO, ASSISTENTE, MEDICO...'),
    categoria: z.enum(['MENOR', 'GROSSEIRA', 'OFENSIVA', 'AGRESSAO', 'ATRASO']),
    entreSets: z.boolean().optional(),
  }),
  FALTA_POSICAO: z.object({ equipeFaltosa: equipe }),
  FALTA_ROTACAO: z.object({
    equipeFaltosa: equipe,
    momentoSeq: z.number().int().positive().nullable(),
    pontoDoRallyDaFaltaSeq: z.number().int().positive().nullable().optional(),
    formacaoCorrigida: formacao.optional(),
  }),
  TROCA_LADO: z.object({}),
  SET_ANULADO: z.object({ motivo: z.string().max(200).optional() }),
  INTERRUPCAO: z.object({
    minutos: z.number().int().min(1).max(10_000),
    motivo: z.string().trim().min(1).max(200),
    acao: z.enum(['CONTINUAR_SET', 'ANULAR_SET_E_REJOGAR', 'REPETIR_PARTIDA']),
  }),
  WO: z.object({ ausente: z.enum(['A', 'B', 'AMBAS']) }),
  EQUIPE_INCOMPLETA: z.object({ equipe, escopo: z.enum(['SET', 'JOGO']) }),
  OBSERVACAO: z.object({ texto: z.string().trim().min(1).max(500) }),
  DISCREPANCIA_PAPELETA: z.object({
    equipe,
    fase: z.enum(['ANTES_DO_SET', 'DEPOIS_DO_INICIO']),
    causa: z.enum(['POSICAO', 'JOGADOR_FORA_DA_PAPELETA', 'JOGADOR_NAO_REGISTRADO']),
    jogador: jogador.optional(),
    momentoSeq: z.number().int().positive().nullable().optional(),
    pontoDoRallyDaFaltaSeq: z.number().int().positive().nullable().optional(),
    formacaoCorrigida: formacao.optional(),
    setEntrada: z.number().int().min(1).max(5).optional(),
  }),
  CAPITAO_EM_JOGO: z.object({ equipe, jogador }),
  PROTESTO_ANUNCIADO: z.object({ equipe, jogador: jogador.optional(), motivo: z.string().trim().max(300).optional() }),
  PROTESTO_REGISTRADO: z.object({
    equipe,
    relato: z.string().trim().min(1).max(2000),
    anunciadoSeq: z.number().int().positive().nullable().optional(),
  }),
  PROTESTO_DESISTIDO: z.object({ equipe, anunciadoSeq: z.number().int().positive().nullable().optional() }),
  DESFAZ: z.object({}),
}

export const eventoRecebidoSchema = z.object({
  clientEventId: z.string().uuid('clientEventId precisa ser um UUID.'),
  tipo: z.enum(TIPOS_DE_EVENTO),
  payload: z.record(z.unknown()).default({}),
  /** Obrigatório (e só aceito) em DESFAZ: seq do evento a desfazer. */
  desfazId: z.number().int().positive().nullable().optional(),
  /** Quando o fato aconteceu no cliente (reenvio offline). Opcional. */
  ocorridoEm: z.string().datetime({ offset: true }).optional(),
})

export const loteSchema = z.object({
  /** Último seq que o cliente conhece (concorrência otimista). Omitido = sem controle de versão. */
  seqEsperado: z.number().int().min(0).optional(),
  eventos: z.array(eventoRecebidoSchema).min(1).max(MAX_EVENTOS_POR_LOTE),
})

export type EventoRecebido = z.infer<typeof eventoRecebidoSchema>
export type LoteRecebido = z.infer<typeof loteSchema>
