import { NextRequest } from 'next/server'
import { error, success } from '@/lib/api-response'
import { ipDaRequisicao } from '@/lib/rate-limit'
import {
  anexarSessao,
  bloqueioPorFlag,
  corpoDeSessao,
  depsReais,
  payloadDeOnboarding,
  payloadDoPerfil,
  respostaDeErro,
} from '@/lib/login-sem-senha/sessao'
import { confirmarCodigo } from '@/lib/login-sem-senha/servico'

export async function POST(req: NextRequest) {
  const desligado = bloqueioPorFlag()
  if (desligado) return desligado
  try {
    const corpo = await req.json().catch(() => null)
    const resultado = await confirmarCodigo(depsReais(), {
      email: corpo?.email,
      codigo: corpo?.codigo,
      ip: ipDaRequisicao(req),
    })
    switch (resultado.tipo) {
      case 'malformado':
        return error(resultado.mensagem, 422)
      case 'limitado': {
        const res = error('Muitas tentativas. Tente novamente em instantes.', 429)
        res.headers.set('Retry-After', String(resultado.retryAfterSeconds))
        return res
      }
      case 'invalido':
        return error('Código inválido ou expirado.', 401)
      case 'admin':
        return error('Este e-mail só entra por senha.', 403)
    }
    if (resultado.perfis.length === 0) {
      return anexarSessao(success({ novaConta: true }), payloadDeOnboarding(resultado.email, 'codigo'))
    }
    const ativo = resultado.perfis[0]
    return anexarSessao(
      success(corpoDeSessao(resultado.perfis, ativo)),
      payloadDoPerfil(ativo, resultado.email, 'codigo'),
    )
  } catch (err) {
    return respostaDeErro(err, 'confirmar')
  }
}
