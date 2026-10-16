import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { clienteSupabaseIndisponivel, lerConfiguracaoSupabase } from '@/lib/supabase-env'

// Client com a chave publicável (anon). NÃO importar em rota de src/app/api nem em lib de
// servidor: o teste scripts/anon-client-guard.test.ts reprova. Para servidor, supabaseAdmin.
// O estado da configuração fica em supabase-config.ts e é reexportado aqui por compatibilidade.
export { alvoSupabase, ambienteProducao, isSupabaseConfigured, supabaseConfigError } from '@/lib/supabase-config'

const config = lerConfiguracaoSupabase()

export const supabase: SupabaseClient = config.ok
  ? createClient(config.url, config.anonKey)
  : clienteSupabaseIndisponivel(config.erro)
