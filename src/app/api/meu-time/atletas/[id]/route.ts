import { z } from 'zod'
import { ErroMeuTime, lerCorpo, sucesso, validar } from '@/lib/meu-time/acesso'
import { editarAtletaCompleto } from '@/lib/meu-time/atleta-dados'
import { exigirEquipe } from '@/lib/meu-time/dados'
import { rotaElencoLider } from '@/lib/meu-time/elenco'
import { editarAtletaElencoSchema } from '@/lib/meu-time/schemas'

export const dynamic = 'force-dynamic'

// PATCH /api/meu-time/atletas/:id {equipeId, nome?, dataNascimento?, numeroPreferido?, posicao?, cpf?, documentoTipo?, documentoNumero?,
// telefone?, telefoneEmergencia?}. Mesma regra de PATCH /api/meu-time/equipes/:equipeId/atletas/:id (que também aceita os campos novos
// com ELENCO_COMPLETO_ATIVO=1). Líder ou técnico da equipe; o atleta precisa estar no banco dela (senão 404).
// A resposta traz só máscaras (cpf '***.***.***-12', telefone '(11) *****-5678') e flags, nunca o valor em claro.
export const PATCH = rotaElencoLider<{ id: string }>(async ({ req, usuarioId, params }) => {
  const corpo = await lerCorpo(req)
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) {
    throw new ErroMeuTime('Dados inválidos: corpo vazio', 422, 'DADOS_INVALIDOS')
  }
  const { equipeId } = validar(z.object({ equipeId: z.string().trim().min(1).max(64) }), corpo)
  const { equipeId: _ignorado, ...resto } = corpo as Record<string, unknown>
  void _ignorado
  const { equipe } = await exigirEquipe(usuarioId, equipeId, 'escrita')
  const entrada = validar(editarAtletaElencoSchema, resto)
  return sucesso(await editarAtletaCompleto(equipe.clubeId, params.id, entrada, usuarioId))
})
