import { rotaCron } from '@/lib/notificacoes-canais/acesso'
import { gerarLembretes } from '@/lib/notificacoes-canais/lembretes'

export const dynamic = 'force-dynamic'

// Gera os lembretes (prazo de inscrição em 48 h e jogo amanhã) sem duplicar (tabela LembreteEnviado).
// Mesmo segredo e mesmas regras de 404/401 da rota de notificações. Rodar uma vez por dia, de manhã (Brasília).
const executar = rotaCron('lembretes', () => gerarLembretes())

export async function POST(req: Request) {
  return executar(req)
}

export async function GET(req: Request) {
  return executar(req)
}
