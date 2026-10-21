// Cartão de prontidão do elenco: quem está sem documento, sem foto ou sem CPF, conforme a regra exigida pela categoria.

export type ExigenciaElenco = 'DOCUMENTO' | 'FOTO' | 'CPF'

export type AtletaProntidao = {
  id: string
  nome: string
  temDocumento: boolean
  temFoto?: boolean
  /** Máscara do CPF quando já cadastrado. */
  cpf?: string | null
  temCpf?: boolean
}

/**
 * Converte `documentosExigidos` da regra de elenco em exigências. Valor desconhecido conta como documento.
 * Lista vazia = categoria sem exigência (nada é cobrado).
 */
export function exigenciasDaRegra(documentosExigidos: readonly string[] | null | undefined): ExigenciaElenco[] {
  if (!documentosExigidos || documentosExigidos.length === 0) return []
  const saida = new Set<ExigenciaElenco>()
  for (const bruto of documentosExigidos) {
    const v = String(bruto).trim().toUpperCase()
    if (v === 'FOTO' || v === 'FOTO_ROSTO' || v === 'FOTO_DE_ROSTO') saida.add('FOTO')
    else if (v === 'CPF') saida.add('CPF')
    else saida.add('DOCUMENTO')
  }
  return Array.from(saida)
}

export function atletaTemCpf(a: Pick<AtletaProntidao, 'cpf' | 'temCpf'>): boolean {
  return a.temCpf === true || (typeof a.cpf === 'string' && a.cpf.trim() !== '')
}

export function atletaFalta(a: AtletaProntidao, exigencia: ExigenciaElenco): boolean {
  if (exigencia === 'DOCUMENTO') return !a.temDocumento
  if (exigencia === 'FOTO') return a.temFoto !== true
  return !atletaTemCpf(a)
}

export type PendenciaElenco = { exigencia: ExigenciaElenco; atletas: Array<{ id: string; nome: string }> }

export function pendenciasDoElenco(atletas: readonly AtletaProntidao[], exigencias: readonly ExigenciaElenco[]): PendenciaElenco[] {
  return exigencias.map((exigencia) => ({
    exigencia,
    atletas: atletas.filter((a) => atletaFalta(a, exigencia)).map((a) => ({ id: a.id, nome: a.nome })),
  }))
}

const TEXTO_FALTA: Record<ExigenciaElenco, string> = { DOCUMENTO: 'sem documento', FOTO: 'sem foto', CPF: 'sem CPF' }

export function textoPendencia(exigencia: ExigenciaElenco, total: number): string {
  return `${total} ${total === 1 ? 'atleta' : 'atletas'} ${TEXTO_FALTA[exigencia]}`
}

export function rotuloAtalhoAtleta(exigencia: ExigenciaElenco): string {
  return exigencia === 'DOCUMENTO' ? 'Enviar documento' : exigencia === 'FOTO' ? 'Enviar foto' : 'Informar CPF'
}

export function elencoCompleto(pendencias: readonly PendenciaElenco[]): boolean {
  return pendencias.every((p) => p.atletas.length === 0)
}
