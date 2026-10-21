import { NextRequest } from 'next/server'
import { error, success } from '@/lib/api-response'
import { verifyPublicToken } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { bloqueioPorFlag, perfilAtivoDaSessao, respostaDeErro } from '@/lib/login-sem-senha/sessao'
import { listarPerfis, paraPublico } from '@/lib/login-sem-senha/perfis'
import { normalizarEmail } from '@/lib/login-sem-senha/config'
import { sessaoVerificada } from '@/lib/login-sem-senha/troca'

export async function GET(req: NextRequest) {
  const desligado = bloqueioPorFlag()
  if (desligado) return desligado
  try {
    const sessao = await verifyPublicToken(req)
    if (!sessao) return error('Não autorizado', 401)
    if (sessao.onboarding === true) return success({ perfis: [], perfilAtivo: null, novaConta: true })
    if (!sessaoVerificada(sessao)) return error('Lista de perfis exige entrada por código ou Google.', 403)
    const perfis = await listarPerfis(supabaseAdmin, normalizarEmail(sessao.email))
    const ativo = perfilAtivoDaSessao(sessao, perfis)
    return success({ perfis: perfis.map(paraPublico), perfilAtivo: ativo ? paraPublico(ativo) : null })
  } catch (err) {
    return respostaDeErro(err, 'perfis')
  }
}
