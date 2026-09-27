import { error } from '@/lib/api-response'

export async function POST() {
  return error('O slug público não autoriza cadastro de atleta. Use o link de convite da equipe.', 403)
}
