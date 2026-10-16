import { lerConfiguracaoSupabase } from '@/lib/supabase-env'

// Estado da configuração do Supabase, sem criar nenhum client. Rotas e libs de servidor
// importam daqui para saber se o ambiente está configurado; quem precisa ler ou gravar
// dados usa supabaseAdmin (src/lib/supabase-admin.ts). O client anon (src/lib/supabase.ts)
// fica só para uploads transitórios do navegador e para o realtime.

const config = lerConfiguracaoSupabase()

export const supabaseConfigError = config.ok ? null : config.erro
export const isSupabaseConfigured = config.ok
export const alvoSupabase = config.ok ? config.alvo : null
export const ambienteProducao = config.ok && config.producao
