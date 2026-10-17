/**
 * Scout (base): modelo, derivação do log de eventos, agregação e exportação. Atrás da flag SCOUT_ATIVO.
 */
export * from './modelo'
export * from './derivacao'
export * from './estatisticas'
export * from './exportacao'
export * from './servidor'
export * from './acoes'

/** As rotas de scout só respondem com `SCOUT_ATIVO=1`. Desligada por padrão. */
export function scoutAtivo(env: Record<string, string | undefined> = process.env): boolean {
  return env.SCOUT_ATIVO === '1'
}
