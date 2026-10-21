import { NextRequest } from 'next/server'
import { error, success } from '@/lib/api-response'
import { ipDaRequisicao } from '@/lib/rate-limit'
import { bloqueioPorFlag, depsReais, respostaDeErro } from '@/lib/login-sem-senha/sessao'
import { solicitarCodigo } from '@/lib/login-sem-senha/servico'

export async function POST(req: NextRequest) {
  const desligado = bloqueioPorFlag()
  if (desligado) return desligado
  try {
    const corpo = await req.json().catch(() => null)
    const resultado = await solicitarCodigo(depsReais(), {
      email: corpo?.email,
      canal: corpo?.canal,
      telefone: corpo?.telefone,
      ip: ipDaRequisicao(req),
    })
    if (resultado.tipo === 'invalido') return error(resultado.mensagem, 422)
    if (resultado.tipo === 'limitado') {
      const res = error('Muitas tentativas. Tente novamente em instantes.', 429)
      res.headers.set('Retry-After', String(resultado.retryAfterSeconds))
      return res
    }
    return success({ enviado: true }, 202)
  } catch (err) {
    return respostaDeErro(err, 'solicitar')
  }
}
