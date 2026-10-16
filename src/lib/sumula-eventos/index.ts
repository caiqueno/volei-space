/**
 * Súmula por eventos (J02): serviço puro + camada Supabase. Atrás da flag SUMULA_EVENTOS_ATIVO.
 * Não substitui o fluxo atual da súmula (api/sumula/[token]); roda ao lado, só para a rota nova.
 */
export * from './config-partida'
export * from './contexto'
export * from './esquema'
export * from './lote'
export * from './mapeamento'
export * from './repositorio'
export * from './servico'

/** A rota de eventos só responde com `SUMULA_EVENTOS_ATIVO=1`. Desligada por padrão. */
export function sumulaEventosAtivo(env: Record<string, string | undefined> = process.env): boolean {
  return env.SUMULA_EVENTOS_ATIVO === '1'
}
