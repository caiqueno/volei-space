import { NextResponse } from 'next/server'
import { setTokenCookie, signPublicToken, type PublicJWTPayload } from '@/lib/auth'
import { loginDestination } from '@/lib/login-destination'
import { emailConfigurado, enviarCodigo, whatsappConfigurado } from '@/lib/mensageria'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { MENSAGEM_RECURSO_NAO_HABILITADO, RecursoNaoHabilitadoError, loginSemSenhaAtivo, resumo } from './config'
import { paraPublico, type PerfilVinculado } from './perfis'
import type { DepsCodigo } from './servico'

export type Acesso = 'codigo' | 'google'

/** Flag desligada: as rotas novas respondem 404 e o login atual segue idêntico. */
export function respostaFlagDesligada() {
  return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
}

export function bloqueioPorFlag() {
  return loginSemSenhaAtivo() ? null : respostaFlagDesligada()
}

export function depsReais(): DepsCodigo {
  return {
    db: supabaseAdmin,
    enviar: enviarCodigo,
    canalDisponivel: (canal) => {
      if (process.env.NODE_ENV !== 'production' && process.env.LOGIN_CODIGO_DEV_CONSOLE === '1') return true
      return canal === 'EMAIL' ? emailConfigurado() : whatsappConfigurado()
    },
  }
}

export function payloadDoPerfil(perfil: PerfilVinculado, email: string, acesso: Acesso): PublicJWTPayload {
  return {
    userId: perfil.referenciaId,
    email,
    nome: perfil.nome,
    tipo: perfil.perfil === 'ORGANIZADOR' ? 'organizador' : 'equipe',
    status: perfil.status,
    trocarSenha: false,
    emailVerificado: true,
    acesso,
  }
}

export function payloadDeOnboarding(email: string, acesso: Acesso): PublicJWTPayload {
  return {
    userId: `onboarding:${resumo(email)}`,
    email,
    nome: '',
    tipo: 'publico',
    status: 'ONBOARDING',
    emailVerificado: true,
    acesso,
    onboarding: true,
  }
}

export async function anexarSessao<T>(res: NextResponse<T>, payload: PublicJWTPayload) {
  const token = await signPublicToken(payload)
  const cookie = setTokenCookie(token, payload.tipo === 'organizador' ? 'navegador' : 'persistente')
  res.cookies.set(cookie.name, cookie.value, cookie.options as Parameters<typeof res.cookies.set>[2])
  return res
}

/** Corpo comum de "entrou": perfis, perfil ativo e destino sugerido. */
export function corpoDeSessao(perfis: PerfilVinculado[], ativo: PerfilVinculado) {
  return {
    perfis: perfis.map(paraPublico),
    perfilAtivo: paraPublico(ativo),
    redirectTo: loginDestination(ativo.perfil === 'ORGANIZADOR' ? 'organizador' : 'equipe', false),
  }
}

export function respostaDeErro(err: unknown, rotulo: string) {
  if (err instanceof RecursoNaoHabilitadoError) {
    return NextResponse.json({ error: MENSAGEM_RECURSO_NAO_HABILITADO }, { status: 503 })
  }
  console.error(`[login-sem-senha] ${rotulo}`, err instanceof Error ? err.message : 'erro')
  return NextResponse.json({ error: 'Não foi possível concluir agora. Tente novamente.' }, { status: 500 })
}

export function perfilAtivoDaSessao(sessao: PublicJWTPayload, perfis: PerfilVinculado[]) {
  const perfil = sessao.tipo === 'organizador' ? 'ORGANIZADOR' : 'LIDER'
  return perfis.find((p) => p.perfil === perfil && p.referenciaId === sessao.userId) ?? null
}
