// Regra única de "campeonato publicado" para leituras sem sessão.
// Espelha a policy luv_public_select_liga (supabase/migrations/202609200021) e a
// regra do ao-vivo: rascunho e simulação nunca aparecem para visitante.

export const STATUS_CAMPEONATO_PUBLICO = ['EM_BREVE', 'ATIVA', 'ENCERRADA', 'FINALIZADO'] as const

export function campeonatoPublicado(liga: { status?: unknown; simulacao?: unknown } | null | undefined): boolean {
  if (!liga) return false
  if (liga.simulacao === true) return false
  return (STATUS_CAMPEONATO_PUBLICO as readonly string[]).includes(String(liga.status ?? '').toUpperCase())
}
