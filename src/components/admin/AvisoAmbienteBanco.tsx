'use client'

import { lerConfiguracaoSupabase } from '@/lib/supabase-env'

export function AvisoAmbienteBanco() {
  const config = lerConfiguracaoSupabase()
  if (config.ok && config.producao) return null

  const texto = config.ok
    ? 'Ambiente de desenvolvimento. Este painel usa o banco de desenvolvimento e não grava na produção.'
    : config.erro

  return (
    <p className="border-b border-amber-300/40 bg-amber-400/15 px-4 py-3 text-sm font-bold leading-6 text-amber-50" role="status">
      {texto}
    </p>
  )
}
