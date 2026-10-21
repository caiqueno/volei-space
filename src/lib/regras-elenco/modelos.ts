// Modelos (presets) de regra de elenco por categoria (R17). Só dados e funções puras.
// Origem dos valores: docs/analise/03-regras-validaveis.md (RG-ELE-001 e RG-LIB-001) e docs/analise/25-lgpd-menores.md.
// Legenda das fontes:
//   V = Regras Oficiais FIVB 2025-2028 (verificado no PDF)       G = Guia de Súmula CBV/COBRAV (fev/2025)
//   P = decisão de produto / LGPD (doc 25)                       M = NÃO CONFIRMADO (de memória ou sem fonte; confirmar antes de impor)
// Nada marcado M deve ser tratado como regra oficial: é só um valor inicial que o organizador pode trocar.

export const MODELOS_REGRA_ELENCO = ['FIVB', 'CBV', 'AMADOR_LIVRE', 'PERSONALIZADO'] as const
export type ModeloRegraElenco = (typeof MODELOS_REGRA_ELENCO)[number]

export const DOCUMENTOS_REGRA = ['FOTO', 'DOCUMENTO', 'CPF'] as const
export type DocumentoRegra = (typeof DOCUMENTOS_REGRA)[number]

export type ValoresRegraElenco = {
  atletasMin: number | null
  atletasMax: number | null
  liberosMax: number
  nascimentoDe: string | null
  nascimentoAte: string | null
  documentosExigidos: DocumentoRegra[]
  comissaoMax: number | null
  prazoTrocaEm: string | null
  exigeConsentimentoMenor: boolean
}

export type FonteValor = 'V' | 'G' | 'P' | 'M'

export type ModeloElenco = {
  modelo: ModeloRegraElenco
  nome: string
  descricao: string
  valores: ValoresRegraElenco
  fontes: Record<keyof ValoresRegraElenco, FonteValor>
  /** Campos cujo valor padrão é [M], não confirmado em fonte oficial. */
  naoConfirmados: Array<keyof ValoresRegraElenco>
}

const LIVRE: ValoresRegraElenco = {
  atletasMin: null,
  atletasMax: null,
  liberosMax: 2,
  nascimentoDe: null,
  nascimentoAte: null,
  documentosExigidos: [],
  comissaoMax: null,
  prazoTrocaEm: null,
  exigeConsentimentoMenor: true,
}

function modelo(entrada: Omit<ModeloElenco, 'naoConfirmados'>): ModeloElenco {
  const naoConfirmados = (Object.keys(entrada.fontes) as Array<keyof ValoresRegraElenco>).filter((campo) => entrada.fontes[campo] === 'M')
  return { ...entrada, naoConfirmados }
}

export const MODELOS_ELENCO: Record<ModeloRegraElenco, ModeloElenco> = {
  FIVB: modelo({
    modelo: 'FIVB',
    nome: 'FIVB',
    descricao: 'Competições FIVB, World e oficiais adulto: até 14 jogadores, 2 líberos e comissão de até 5 pessoas (1 técnico, 2 assistentes, 2 da área médica).',
    valores: { ...LIVRE, atletasMin: 6, atletasMax: 14, liberosMax: 2, comissaoMax: 5 },
    fontes: {
      atletasMin: 'M', // 6 em quadra; o mínimo de registro na súmula não consta do doc 03.
      atletasMax: 'V', // RG-ELE-001 (4.1.1): 14 em FIVB/World/Oficiais Adulto.
      liberosMax: 'V', // RG-LIB-001 (19.1): até 2 líberos.
      nascimentoDe: 'M',
      nascimentoAte: 'M',
      documentosExigidos: 'M',
      comissaoMax: 'V', // RG-ELE-001: 1 técnico + 2 assistentes + 2 área médica.
      prazoTrocaEm: 'M',
      exigeConsentimentoMenor: 'P', // doc 25 (LGPD art. 14).
    },
  }),
  CBV: modelo({
    modelo: 'CBV',
    nome: 'CBV',
    descricao: 'Competições nacionais regidas pela CBV com o Guia de súmula: até 12 jogadores, 2 líberos e comissão de até 5 pessoas.',
    valores: { ...LIVRE, atletasMin: 6, atletasMax: 12, liberosMax: 2, comissaoMax: 5 },
    fontes: {
      atletasMin: 'M',
      atletasMax: 'G', // RG-ELE-001: 12 jogadores na regra geral; Guia p.18 e p.23.
      liberosMax: 'G', // RG-LIB-001: Guia p.19-20.
      nascimentoDe: 'M',
      nascimentoAte: 'M',
      documentosExigidos: 'M',
      comissaoMax: 'G', // Guia p.23 (regulamento pode incluir outras funções).
      prazoTrocaEm: 'M',
      exigeConsentimentoMenor: 'P',
    },
  }),
  AMADOR_LIVRE: modelo({
    modelo: 'AMADOR_LIVRE',
    nome: 'Amador livre',
    descricao: 'Sem limite de atletas nem de comissão e sem faixa de idade: o regulamento do organizador manda. Líberos até 2.',
    valores: { ...LIVRE },
    fontes: {
      atletasMin: 'M',
      atletasMax: 'M',
      liberosMax: 'V',
      nascimentoDe: 'M',
      nascimentoAte: 'M',
      documentosExigidos: 'M',
      comissaoMax: 'M',
      prazoTrocaEm: 'M',
      exigeConsentimentoMenor: 'P',
    },
  }),
  PERSONALIZADO: modelo({
    modelo: 'PERSONALIZADO',
    nome: 'Personalizado',
    descricao: 'O organizador define cada limite. Começa igual ao modelo amador livre.',
    valores: { ...LIVRE },
    fontes: {
      atletasMin: 'M',
      atletasMax: 'M',
      liberosMax: 'V',
      nascimentoDe: 'M',
      nascimentoAte: 'M',
      documentosExigidos: 'M',
      comissaoMax: 'M',
      prazoTrocaEm: 'M',
      exigeConsentimentoMenor: 'P',
    },
  }),
}

export const LEGENDA_FONTES: Record<FonteValor, string> = {
  V: 'Regras Oficiais FIVB 2025-2028 (verificado)',
  G: 'Guia de Súmula CBV/COBRAV, fev/2025 (verificado)',
  P: 'Decisão de produto / LGPD (docs/analise/25-lgpd-menores.md)',
  M: 'Não confirmado: valor inicial sem fonte oficial; confirmar com o regulamento',
}

export function listarModelos() {
  return {
    modelos: MODELOS_REGRA_ELENCO.map((chave) => MODELOS_ELENCO[chave]),
    legenda: LEGENDA_FONTES,
  }
}
