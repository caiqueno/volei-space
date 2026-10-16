// Tokens fixos de demonstração da súmula. Só valem fora de produção e de preview:
// em produção a rota trata o token como qualquer outro e responde 404.

export const DEMO_SUMULA_TOKENS: ReadonlySet<string> = new Set(['token-demo-1-luva2026', 'token-demo-1-luv2026'])

type AmbienteDemo = { NODE_ENV?: string; VERCEL_ENV?: string }

export function demoSumulaLiberado(token: string, env: AmbienteDemo = process.env as AmbienteDemo) {
  if (env.NODE_ENV === 'production') return false
  if (env.VERCEL_ENV === 'production' || env.VERCEL_ENV === 'preview') return false
  return DEMO_SUMULA_TOKENS.has(token)
}
