import { error } from '@/lib/api-response'

export async function POST() {
  return error('A conta de organizador é criada pelo administrador.', 403)
}
