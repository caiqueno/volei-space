import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { clienteSupabaseIndisponivel, lerChaveServicoSupabase, lerConfiguracaoSupabase } from '@/lib/supabase-env'

const config = lerConfiguracaoSupabase()
const serviceRoleKey = config.ok ? lerChaveServicoSupabase() : null

export const isSupabaseServiceConfigured = Boolean(serviceRoleKey)

export const supabaseAdmin: SupabaseClient = serviceRoleKey && config.ok
  ? createClient(config.url, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
      },
    })
  : clienteSupabaseIndisponivel(
      config.ok
        ? 'SUPABASE_SERVICE_ROLE_KEY não está configurada neste ambiente.'
        : config.erro,
    )
