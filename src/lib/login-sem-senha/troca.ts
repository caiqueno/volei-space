import type { PublicJWTPayload } from '@/lib/auth'
import { normalizarEmail } from './config'
import { emailDeAdministrador, listarPerfis, type ClienteDb, type PerfilVinculado } from './perfis'

export type ResultadoTroca =
  | { tipo: 'ok'; perfil: PerfilVinculado; perfis: PerfilVinculado[] }
  | { tipo: 'negado'; status: 400 | 401 | 403 | 404; mensagem: string }

/** A sessão veio de código ou Google e tem e-mail verificado (não é onboarding)? */
export function sessaoVerificada(sessao: PublicJWTPayload | null) {
  return Boolean(sessao && sessao.emailVerificado === true && sessao.onboarding !== true && sessao.acesso)
}

export async function trocarPerfil(
  db: ClienteDb,
  sessao: PublicJWTPayload | null,
  entrada: { perfil: unknown; referenciaId: unknown },
): Promise<ResultadoTroca> {
  if (!sessao) return { tipo: 'negado', status: 401, mensagem: 'Não autorizado' }
  if (!sessaoVerificada(sessao)) {
    return { tipo: 'negado', status: 403, mensagem: 'Troca de perfil exige entrada por código ou Google.' }
  }
  if (entrada.perfil !== 'LIDER' && entrada.perfil !== 'ORGANIZADOR') {
    return { tipo: 'negado', status: 400, mensagem: 'Perfil inválido.' }
  }
  const referenciaId = String(entrada.referenciaId ?? '')
  if (!referenciaId) return { tipo: 'negado', status: 400, mensagem: 'Perfil inválido.' }

  const email = normalizarEmail(sessao.email)
  if (await emailDeAdministrador(db, email)) {
    return { tipo: 'negado', status: 403, mensagem: 'Este e-mail só entra por senha.' }
  }
  // Os perfis vêm do banco, do e-mail verificado da sessão; o cliente só escolhe entre eles.
  const perfis = await listarPerfis(db, email)
  const alvo = perfis.find((p) => p.perfil === entrada.perfil && p.referenciaId === referenciaId)
  if (!alvo) return { tipo: 'negado', status: 404, mensagem: 'Perfil não vinculado a este e-mail.' }
  return { tipo: 'ok', perfil: alvo, perfis }
}
