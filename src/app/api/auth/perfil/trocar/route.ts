import { NextRequest } from 'next/server'
import { error, success } from '@/lib/api-response'
import { verifyPublicToken } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { anexarSessao, bloqueioPorFlag, corpoDeSessao, payloadDoPerfil, respostaDeErro } from '@/lib/login-sem-senha/sessao'
import { trocarPerfil } from '@/lib/login-sem-senha/troca'

export async function POST(req: NextRequest) {
  const desligado = bloqueioPorFlag()
  if (desligado) return desligado
  try {
    const sessao = await verifyPublicToken(req)
    const corpo = await req.json().catch(() => null)
    const resultado = await trocarPerfil(supabaseAdmin, sessao, { perfil: corpo?.perfil, referenciaId: corpo?.referenciaId })
    if (resultado.tipo === 'negado') return error(resultado.mensagem, resultado.status)
    return anexarSessao(
      success(corpoDeSessao(resultado.perfis, resultado.perfil)),
      payloadDoPerfil(resultado.perfil, sessao!.email, sessao!.acesso ?? 'codigo'),
    )
  } catch (err) {
    return respostaDeErro(err, 'perfil/trocar')
  }
}
