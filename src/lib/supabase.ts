import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { clienteSupabaseIndisponivel, lerConfiguracaoSupabase } from '@/lib/supabase-env'

const config = lerConfiguracaoSupabase()

export const supabaseConfigError = config.ok ? null : config.erro
export const isSupabaseConfigured = config.ok
export const alvoSupabase = config.ok ? config.alvo : null
export const ambienteProducao = config.ok && config.producao

export const supabase: SupabaseClient = config.ok
  ? createClient(config.url, config.anonKey)
  : clienteSupabaseIndisponivel(config.erro)
