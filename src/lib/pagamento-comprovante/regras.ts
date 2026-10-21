// Regras puras do pagamento por comprovante (R19): sem banco e sem rede, para testar isoladamente.
import { z } from 'zod'

export const MODOS_PAGAMENTO = ['NENHUM', 'COMPROVANTE'] as const
export type ModoPagamento = (typeof MODOS_PAGAMENTO)[number]

export const ESTADOS_PAGAMENTO = ['PENDENTE', 'COMPROVANTE_ENVIADO', 'CONFIRMADO', 'RECUSADO', 'ISENTO'] as const
export type EstadoPagamento = (typeof ESTADOS_PAGAMENTO)[number]

export const DECISOES_PAGAMENTO = ['CONFIRMAR', 'RECUSAR', 'ISENTAR'] as const
export type DecisaoPagamento = (typeof DECISOES_PAGAMENTO)[number]

/** Teto de uma inscrição: R$ 100.000,00. Barra erro de digitação (centavos x reais). */
export const VALOR_MAXIMO_CENTAVOS = 10_000_000
export const LIMITE_PIX_CHAVE = 140
export const LIMITE_PIX_BENEFICIARIO = 100
export const LIMITE_INSTRUCOES = 500
export const LIMITE_MOTIVO = 500

// eslint-disable-next-line no-control-regex
const SEM_CONTROLE = /^[^\u0000-\u001f\u007f]*$/

function textoCurto(max: number, rotulo: string) {
  return z
    .string()
    .trim()
    .max(max, `${rotulo} deve ter no máximo ${max} caracteres`)
    .refine((v) => SEM_CONTROLE.test(v), `${rotulo} tem caracteres inválidos`)
    .nullable()
    .optional()
    .transform((v) => (v == null || v === '' ? null : v))
}

export const configPagamentoSchema = z
  .object({
    modo: z.enum(MODOS_PAGAMENTO),
    valorCentavos: z.number().int('o valor deve ser em centavos, inteiro').min(0, 'o valor não pode ser negativo').max(VALOR_MAXIMO_CENTAVOS, 'valor acima do permitido').nullable().optional(),
    pixChave: textoCurto(LIMITE_PIX_CHAVE, 'A chave Pix'),
    pixBeneficiario: textoCurto(LIMITE_PIX_BENEFICIARIO, 'O beneficiário'),
    instrucoes: z
      .string()
      .trim()
      .max(LIMITE_INSTRUCOES, `As instruções devem ter no máximo ${LIMITE_INSTRUCOES} caracteres`)
      .nullable()
      .optional()
      .transform((v) => (v == null || v === '' ? null : v)),
  })
  .strict()
  .superRefine((entrada, contexto) => {
    if (entrada.modo !== 'COMPROVANTE') return
    if (entrada.valorCentavos == null || entrada.valorCentavos <= 0) {
      contexto.addIssue({ code: z.ZodIssueCode.custom, path: ['valorCentavos'], message: 'informe um valor maior que zero para cobrar por comprovante' })
    }
    if (!entrada.pixChave) {
      contexto.addIssue({ code: z.ZodIssueCode.custom, path: ['pixChave'], message: 'informe a chave Pix para receber o pagamento' })
    }
  })
export type ConfigPagamentoEntrada = z.infer<typeof configPagamentoSchema>

export const decisaoPagamentoSchema = z
  .object({
    decisao: z.enum(DECISOES_PAGAMENTO),
    motivo: z.string().trim().max(LIMITE_MOTIVO, `O motivo deve ter no máximo ${LIMITE_MOTIVO} caracteres`).nullable().optional(),
  })
  .strict()
  .superRefine((entrada, contexto) => {
    if (entrada.decisao === 'RECUSAR' && !entrada.motivo) {
      contexto.addIssue({ code: z.ZodIssueCode.custom, path: ['motivo'], message: 'informe o motivo da recusa' })
    }
  })
export type DecisaoPagamentoEntrada = z.infer<typeof decisaoPagamentoSchema>

export type ConfigPagamento = {
  modo: ModoPagamento
  valorCentavos: number | null
  pixChave: string | null
  pixBeneficiario: string | null
  instrucoes: string | null
}

/** Linha de CategoriaConfiguracao -> configuração. Qualquer coisa fora do combinado vale como "sem cobrança". */
export function configDaLinha(linha: Record<string, unknown> | null | undefined): ConfigPagamento {
  const valor = Number(linha?.valorInscricaoCentavos)
  const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  return {
    modo: linha?.pagamentoModo === 'COMPROVANTE' ? 'COMPROVANTE' : 'NENHUM',
    valorCentavos: linha?.valorInscricaoCentavos != null && Number.isInteger(valor) && valor >= 0 ? valor : null,
    pixChave: texto(linha?.pixChave),
    pixBeneficiario: texto(linha?.pixBeneficiario),
    instrucoes: texto(linha?.pagamentoInstrucoes),
  }
}

/** A categoria cobra por comprovante: modo COMPROVANTE e valor maior que zero. */
export function exigeComprovante(config: Pick<ConfigPagamento, 'modo' | 'valorCentavos'> | null | undefined) {
  return Boolean(config && config.modo === 'COMPROVANTE' && config.valorCentavos != null && config.valorCentavos > 0)
}

/** Só pagamento confirmado ou isento libera a aprovação da inscrição. */
export function estadoLiberaAprovacao(estado: string | null | undefined) {
  return estado === 'CONFIRMADO' || estado === 'ISENTO'
}

export function mensagemPagamentoPendente(estado: string | null | undefined, motivoRecusa?: string | null) {
  if (estado === 'COMPROVANTE_ENVIADO') {
    return 'O comprovante de pagamento ainda não foi confirmado. Confirme o pagamento (ou isente a equipe) antes de aprovar.'
  }
  if (estado === 'RECUSADO') {
    return `O comprovante foi recusado${motivoRecusa ? ` (${motivoRecusa})` : ''}. Aguarde um novo envio ou isente a equipe antes de aprovar.`
  }
  return 'Esta categoria exige pagamento por comprovante e a equipe ainda não enviou o comprovante. Aguarde o envio ou isente a equipe antes de aprovar.'
}

export type TransicaoPagamento =
  | { tipo: 'aplicar'; destino: EstadoPagamento }
  | { tipo: 'repetida'; destino: EstadoPagamento }
  | { tipo: 'conflito'; mensagem: string }

const DESTINO_DA_DECISAO: Record<DecisaoPagamento, EstadoPagamento> = {
  CONFIRMAR: 'CONFIRMADO',
  RECUSAR: 'RECUSADO',
  ISENTAR: 'ISENTO',
}

const ORIGENS_DA_DECISAO: Record<DecisaoPagamento, readonly EstadoPagamento[]> = {
  CONFIRMAR: ['COMPROVANTE_ENVIADO'],
  RECUSAR: ['COMPROVANTE_ENVIADO'],
  ISENTAR: ['PENDENTE', 'COMPROVANTE_ENVIADO', 'RECUSADO'],
}

/**
 * Decisão do organizador sobre o pagamento. Repetir a decisão que já vale é idempotente; decisão contrária ao que já
 * foi decidido (ex.: recusar um pagamento confirmado) é conflito. CONFIRMAR e RECUSAR só existem sobre um comprovante enviado.
 */
export function transicaoDoPagamento(decisao: DecisaoPagamento, atual: EstadoPagamento): TransicaoPagamento {
  const destino = DESTINO_DA_DECISAO[decisao]
  if (atual === destino) return { tipo: 'repetida', destino }
  if (ORIGENS_DA_DECISAO[decisao].includes(atual)) return { tipo: 'aplicar', destino }
  if (atual === 'PENDENTE') {
    return { tipo: 'conflito', mensagem: 'A equipe ainda não enviou o comprovante. Aguarde o envio ou isente a equipe.' }
  }
  return { tipo: 'conflito', mensagem: `O pagamento já está ${rotuloEstado(atual)}; a decisão contrária não é permitida.` }
}

export function rotuloEstado(estado: string) {
  switch (estado) {
    case 'PENDENTE': return 'pendente'
    case 'COMPROVANTE_ENVIADO': return 'com comprovante enviado'
    case 'CONFIRMADO': return 'confirmado'
    case 'RECUSADO': return 'recusado'
    case 'ISENTO': return 'isento'
    default: return estado
  }
}

/** Valor mostrado no explorar (em reais): nulo se não definido; zero só com modo NENHUM e valor explícito 0 (vira "Gratuito"). */
export function valorInscricaoParaExplorar(config: ConfigPagamento): number | null {
  if (config.valorCentavos == null) return null
  if (config.modo === 'COMPROVANTE' && config.valorCentavos <= 0) return null
  return config.valorCentavos / 100
}

/** Estado enviado ao líder por upload: de onde o comprovante pode (re)entrar. */
export function podeReceberComprovante(estado: EstadoPagamento) {
  return estado === 'PENDENTE' || estado === 'COMPROVANTE_ENVIADO' || estado === 'RECUSADO'
}
