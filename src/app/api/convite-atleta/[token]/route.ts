import { z } from 'zod'
import { ErroMeuTime, lerCorpo, sucesso, validar } from '@/lib/meu-time/acesso'
import { rotaFase2Publica } from '@/lib/meu-time-fase2/acesso'
import { aceitarConvite, consultarConviteAberto } from '@/lib/meu-time-fase2/convites'
import { POSICOES } from '@/lib/meu-time/schemas'
import { dataNascimentoValida, NUMERO_MAXIMO_CAMISA } from '@/lib/meu-time/regras'
import { consumirLimite, ipDaRequisicao } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

type Params = { token: string }

const aceiteSchema = z.object({
  nome: z.string().trim().min(2).max(200),
  dataNascimento: z.string().refine((valor) => dataNascimentoValida(valor), 'Data de nascimento inválida.'),
  camisa: z.number().int().min(0).max(NUMERO_MAXIMO_CAMISA).optional().nullable(),
  posicao: z.enum(POSICOES).optional().nullable(),
})

function limitar(req: Request, escopo: string, max: number, janelaMs: number, token: string) {
  const porIp = consumirLimite(`convite-atleta:${escopo}:ip:${ipDaRequisicao(req as never)}`, max, janelaMs)
  const porToken = consumirLimite(`convite-atleta:${escopo}:t:${token.slice(0, 64)}`, max, janelaMs)
  if (!porIp.ok || !porToken.ok) {
    const espera = Math.max(porIp.retryAfterSeconds, porToken.retryAfterSeconds)
    throw new ErroMeuTime('Muitas tentativas. Aguarde e tente de novo.', 429, 'LIMITE_DE_TAXA', { retryAfterSeconds: espera })
  }
}

// GET público: estado do convite e nome/naipe da equipe. Sem PII; todo motivo de indisponibilidade responde igual.
export const GET = rotaFase2Publica<Params>(async ({ req, params }) => {
  limitar(req, 'ver', 60, 10 * 60 * 1000, params.token)
  return sucesso(await consultarConviteAberto(params.token))
})

// POST público {nome, dataNascimento, camisa?, posicao?}: cria o atleta na equipe, uma única vez.
export const POST = rotaFase2Publica<Params>(async ({ req, params }) => {
  limitar(req, 'aceitar', 10, 60 * 60 * 1000, params.token)
  const entrada = validar(aceiteSchema, await lerCorpo(req))
  const resposta = await aceitarConvite(params.token, {
    nome: entrada.nome,
    dataNascimento: entrada.dataNascimento,
    numeroPreferido: entrada.camisa ?? null,
    posicao: entrada.posicao ?? null,
  })
  return sucesso(resposta, 201)
})
