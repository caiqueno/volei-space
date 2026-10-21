import { sucesso } from '@/lib/meu-time/acesso'
import { rotaElencoOrganizador } from '@/lib/meu-time/elenco'
import { listarModelos } from '@/lib/regras-elenco/modelos'

export const dynamic = 'force-dynamic'

// GET /api/regras-elenco/modelos: presets FIVB, CBV, AMADOR_LIVRE e PERSONALIZADO com os valores padrão.
// Cada campo traz a fonte (V/G/P) ou M = não confirmado; `naoConfirmados` lista os campos [M] de cada modelo.
export const GET = rotaElencoOrganizador(async () => sucesso(listarModelos()))
