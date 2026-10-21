import { rotaCron } from '@/lib/notificacoes-canais/acesso'
import { processarEntregas } from '@/lib/notificacoes-canais/despachante'

export const dynamic = 'force-dynamic'

// Despachante das entregas por canal (e-mail, WhatsApp, push). Protegido por `Authorization: Bearer ${CRON_SECRET}`.
// Sem CRON_SECRET (ou com a flag NOTIFICACOES_MULTICANAL_ATIVO desligada) a rota "não existe" (404).
// Até 50 entregas por execução, recuo exponencial e no máximo 5 tentativas por entrega.
const executar = rotaCron('notificacoes', () => processarEntregas())

export async function POST(req: Request) {
  return executar(req)
}

// A Vercel cron dispara GET com o mesmo cabeçalho Authorization; o segredo continua sendo obrigatório.
export async function GET(req: Request) {
  return executar(req)
}
