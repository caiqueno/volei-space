import { colunaAusente, type ErroDeColuna } from '@/lib/coluna-ausente'

/**
 * Gênero e faixa de idade da categoria. Os dois são opcionais.
 * Sem coluna no banco, a regra fica desligada e a inscrição segue como está.
 * Sexo e data de nascimento vazios não bloqueiam: a conferência só roda
 * quando a categoria e o atleta têm o dado.
 */

export const GENEROS_CATEGORIA = ['MASCULINO', 'FEMININO', 'MISTO'] as const
export const SEXOS_ATLETA = ['MASCULINO', 'FEMININO'] as const
export const CAMPOS_ELEGIBILIDADE = ['genero', 'idadeMinima', 'idadeMaxima'] as const

export type GeneroCategoria = (typeof GENEROS_CATEGORIA)[number]
export type SexoAtleta = (typeof SEXOS_ATLETA)[number]

export type ElegibilidadeCategoria = {
  genero: GeneroCategoria | null
  idadeMinima: number | null
  idadeMaxima: number | null
}

const VAZIA: ElegibilidadeCategoria = { genero: null, idadeMinima: null, idadeMaxima: null }

export function colunaElegibilidadeAusente(erro: ErroDeColuna) {
  return colunaAusente(erro, ['genero', 'idadeMinima', 'idadeMaxima', /\bsexo\b/i, '42703', 'PGRST204'])
}

export function generoCategoria(valor: unknown): GeneroCategoria | null {
  const chave = String(valor ?? '').trim().toUpperCase()
  return (GENEROS_CATEGORIA as readonly string[]).includes(chave) ? chave as GeneroCategoria : null
}

export function sexoAtleta(valor: unknown): SexoAtleta | null {
  const chave = String(valor ?? '').trim().toUpperCase()
  return (SEXOS_ATLETA as readonly string[]).includes(chave) ? chave as SexoAtleta : null
}

function idadeInteira(valor: unknown): number | null {
  if (valor == null || valor === '') return null
  const numero = Number(valor)
  if (!Number.isInteger(numero) || numero < 0 || numero > 120) return null
  return numero
}

export function normalizarElegibilidade(linha: Record<string, unknown> | null | undefined): ElegibilidadeCategoria {
  if (!linha) return { ...VAZIA }
  return {
    genero: generoCategoria(linha.genero),
    idadeMinima: idadeInteira(linha.idadeMinima),
    idadeMaxima: idadeInteira(linha.idadeMaxima),
  }
}

export function elegibilidadeAtiva(regra: ElegibilidadeCategoria | null | undefined) {
  if (!regra) return false
  return regra.genero != null || regra.idadeMinima != null || regra.idadeMaxima != null
}

/** Recusa faixa invertida ou valor fora de 0–120 antes de gravar. */
export function mensagemFaixaIdade(entrada: { idadeMinima?: unknown; idadeMaxima?: unknown }) {
  const minimaInformada = entrada.idadeMinima != null && entrada.idadeMinima !== ''
  const maximaInformada = entrada.idadeMaxima != null && entrada.idadeMaxima !== ''
  const minima = idadeInteira(entrada.idadeMinima)
  const maxima = idadeInteira(entrada.idadeMaxima)
  if (minimaInformada && minima == null) return 'A idade mínima precisa ser um número inteiro de 0 a 120.'
  if (maximaInformada && maxima == null) return 'A idade máxima precisa ser um número inteiro de 0 a 120.'
  if (minima != null && maxima != null && minima > maxima) return 'A idade mínima não pode ser maior que a idade máxima.'
  return null
}

export function separarElegibilidade(patch: Record<string, unknown>) {
  const elegibilidade: Record<string, unknown> = {}
  const resto: Record<string, unknown> = {}
  for (const [chave, valor] of Object.entries(patch)) {
    if ((CAMPOS_ELEGIBILIDADE as readonly string[]).includes(chave)) elegibilidade[chave] = valor
    else resto[chave] = valor
  }
  return { elegibilidade, resto }
}

function idadeEmAnos(nascimento: string, hoje: Date) {
  const dia = nascimento.slice(0, 10)
  const partes = dia.split('-').map((item) => Number(item))
  if (partes.length < 3 || partes.some((item) => !Number.isInteger(item))) return null
  const [ano, mes, data] = partes
  if (mes < 1 || mes > 12 || data < 1 || data > 31) return null
  let anos = hoje.getUTCFullYear() - ano
  const aniversario = new Date(Date.UTC(hoje.getUTCFullYear(), mes - 1, data))
  if (hoje < aniversario) anos -= 1
  return anos
}

export function mensagemElegibilidade(
  regra: ElegibilidadeCategoria | null | undefined,
  atleta: { sexo?: string | null; dataNascimento?: string | null },
  hoje = new Date(),
) {
  if (!elegibilidadeAtiva(regra)) return null
  const sexo = sexoAtleta(atleta.sexo)
  if (regra?.genero && regra.genero !== 'MISTO' && sexo && sexo !== regra.genero) {
    const esperado = regra.genero === 'FEMININO' ? 'feminino' : 'masculino'
    return `Esta categoria é ${esperado}. O sexo informado não confere.`
  }
  const nascimento = String(atleta.dataNascimento ?? '').trim()
  if (!nascimento || (regra?.idadeMinima == null && regra?.idadeMaxima == null)) return null
  const anos = idadeEmAnos(nascimento, hoje)
  if (anos == null) return null
  if (regra?.idadeMinima != null && anos < regra.idadeMinima) {
    return `A idade mínima desta categoria é ${regra.idadeMinima} anos.`
  }
  if (regra?.idadeMaxima != null && anos > regra.idadeMaxima) {
    return `A idade máxima desta categoria é ${regra.idadeMaxima} anos.`
  }
  return null
}
