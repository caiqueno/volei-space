/**
 * Decisão do árbitro (override): saída para todo bloqueio do motor na tela (achados M2 e M6 do doc 24).
 * Módulo PURO.
 *
 * Quando o motor recusa um fato que aconteceu (ou quando a regra é [M]/NÃO CONFIRMADA no doc 23),
 * o árbitro pode registrar mesmo assim, com justificativa obrigatória. A ocorrência fica marcada com
 * `[[OVR:<código>:<justificativa>]]` no texto, o que a tela, o replay e a súmula impressa leem.
 * O formato do PUT /api/sumula não muda: é só texto dentro da descrição.
 */

export const JUSTIFICATIVA_MINIMA = 8
export const JUSTIFICATIVA_MAXIMA = 200
export const ROTULO_OVERRIDE = 'Registrar mesmo assim (decisão do árbitro)'

/**
 * Itens [M]/NÃO CONFIRMADO do doc 23 que a tela nunca trata como proibição:
 * advertência verbal antes do amarelo (divergência 7) e contagem por categoria (divergência 8),
 * que sustenta as escaladas de conduta grosseira e ofensiva.
 */
const NAO_CONFIRMADOS = new Set(['RG-SAN-001', 'RG-SAN-003', 'RG-SAN-004', 'RG-SAN-005'])

export function ehNaoConfirmado(codigo: string): boolean {
  return NAO_CONFIRMADOS.has(codigo)
}

/** Remove o que quebraria o texto gravado: marcadores, barras, '#' (lido como camisa) e quebras de linha. */
export function limparJustificativa(texto: string): string {
  return String(texto ?? '')
    .replace(/[\[\]|#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, JUSTIFICATIVA_MAXIMA)
}

export function justificativaValida(texto: string): boolean {
  return limparJustificativa(texto).length >= JUSTIFICATIVA_MINIMA
}

export type DecisaoDoArbitro = { codigo: string; justificativa: string }

/** Marcador `[[OVR:<código>:<justificativa>]]`; devolve '' se a justificativa for curta demais. */
export function marcadorOverride(decisao: DecisaoDoArbitro): string {
  const justificativa = limparJustificativa(decisao.justificativa)
  if (justificativa.length < JUSTIFICATIVA_MINIMA) return ''
  const codigo = decisao.codigo.replace(/[^A-Z0-9-]/gi, '').toUpperCase() || 'SEM-CODIGO'
  return ` [[OVR:${codigo}:${justificativa}]]`
}

/** Frase visível no registro (a justificativa vai no marcador, para não confundir leituras do texto). */
export function frasePadraoOverride(codigo: string): string {
  return `Decisão do árbitro (fora da regra ${codigo}).`
}

/** Acrescenta a frase e o marcador ao texto da ocorrência. */
export function anexarOverride(texto: string, decisao: DecisaoDoArbitro): string {
  const marcador = marcadorOverride(decisao)
  if (!marcador) return texto
  return `${texto} ${frasePadraoOverride(decisao.codigo)}${marcador}`
}

const PADRAO_OVR = /\[\[OVR:([A-Za-z0-9-]+):([^\]]*)\]\]/

export function lerOverride(texto: string | null | undefined): DecisaoDoArbitro | null {
  const m = String(texto ?? '').match(PADRAO_OVR)
  return m ? { codigo: m[1], justificativa: m[2].trim() } : null
}

export function contarOverrides(textos: ReadonlyArray<string | null | undefined>): number {
  return textos.filter((t) => lerOverride(t) != null).length
}

/** Aviso persistente da tela e da impressão. */
export function avisoDeOverrides(quantidade: number): string {
  return quantidade === 1
    ? '1 registro desta súmula foi feito por decisão do árbitro, fora do que o motor de regras aceita. Ele aparece marcado na súmula impressa.'
    : `${quantidade} registros desta súmula foram feitos por decisão do árbitro, fora do que o motor de regras aceita. Eles aparecem marcados na súmula impressa.`
}
