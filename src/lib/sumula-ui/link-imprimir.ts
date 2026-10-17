/**
 * Regra de quando oferecer "Imprimir súmula" fora da súmula. Módulo PURO.
 *
 * - Com sumulaToken: /sumula/<token>/imprimir (credencial opaca).
 * - Sem token: só em modo consulta, e só quando o chamador SABE que o campeonato está publicado
 *   (`campeonatoPublicado === true`); aí vale o id numérico, que o servidor só aceita para campeonato
 *   publicado. Sem essa certeza, não há link (evita levar a uma página de erro).
 * A autorização continua sendo do servidor.
 */
export function linkImprimirSumula(partida: {
  id?: number | string | null
  sumulaToken?: string | null
  campeonatoPublicado?: boolean | null
}): string | null {
  const token = String(partida.sumulaToken ?? '').trim()
  if (token) return `/sumula/${encodeURIComponent(token)}/imprimir`
  const id = String(partida.id ?? '').trim()
  if (partida.campeonatoPublicado === true && /^\d+$/.test(id)) return `/sumula/${id}/imprimir`
  return null
}
