import type { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { requirePublicRole, verifyPublicToken, isReleasedPublicStatus, type PublicJWTPayload } from '@/lib/auth'
import { error } from '@/lib/api-response'
import { lerSessaoAcesso } from '@/lib/acesso-arbitro-jogo'
import { lerPartidaOperacao, organizadorDaLiga, type FiltroPartida } from '@/lib/partida-operacao'

export type ArbitroPartidaAccess = {
  auth: PublicJWTPayload
  candidatura: {
    id: string
    nome: string
    email: string
    status: string
    arbitroId: number | null
  }
  partida: any
}


export async function requireArbitroPartidaAccess(
  req: NextRequest,
  token: string,
): Promise<ArbitroPartidaAccess | NextResponse> {
  // O id numérico não é token de AcessoArbitroJogo. Sem sessão, a resposta
  // continua 401 antes de consultar o banco.
  if (!/^\d+$/.test(token)) {
    const peloLink = await acessoPeloLink(req, token)
    if (peloLink) return peloLink
  }
  const pelaSessao = await acessoPelaSessaoNaPartida(req, token)
  if (pelaSessao) return pelaSessao
  const peloOrganizador = await acessoPeloOrganizador(req, token)
  if (peloOrganizador) return peloOrganizador

  if (/^\d+$/.test(token)) {
    return error('Use o link exclusivo do jogo para operar esta partida.', 401)
  }

  const auth = await requirePublicRole(req, ['arbitro'], { releasedOnly: true })
  if (auth instanceof Response) return auth

  const { data: candidatura, error: candidaturaErr } = await supabase
    .from('CandidaturaArbitro')
    .select('id,nome,email,status,arbitroId')
    .eq('id', auth.userId)
    .maybeSingle()

  if (candidaturaErr || !candidatura) return error('Cadastro de arbitro nao encontrado.', 404)
  if (!isReleasedPublicStatus(candidatura.status)) {
    return error('Cadastro de arbitro ainda nao liberado para operar partidas.', 403)
  }

  const { partida, error: partidaErr } = await lerPartidaOperacao(filtroDoToken(token))

  if (partidaErr) return error('Não foi possível abrir a partida.', 500)
  if (!partida) return error('Partida não encontrada.', 404)

  const escala = Array.isArray(partida.escala) ? partida.escala : []
  const arbitroId = Number(candidatura.arbitroId)
  const escalado = escala.some((item: any) => Number(item.arbitroId) === arbitroId)
  if (!arbitroId || !escalado) return error('Voce nao esta escalado para operar esta partida.', 403)

  return { auth, candidatura, partida }
}

async function acessoPelaSessaoNaPartida(req: NextRequest, token: string): Promise<ArbitroPartidaAccess | null> {
  const sessao = await lerSessaoAcesso(req)
  if (!sessao) return null
  const { data: acesso } = await supabase
    .from('AcessoArbitroJogo')
    .select('id,partidaId,token,ativo,revogadoEm')
    .eq('id', sessao.acessoId)
    .maybeSingle()
  if (!acesso || !acesso.ativo || acesso.revogadoEm || acesso.token !== sessao.token || Number(acesso.partidaId) !== Number(sessao.partidaId)) return null

  const { partida } = await lerPartidaOperacao(filtroDoToken(token))
  if (!partida || Number(partida.id) !== Number(acesso.partidaId)) return null
  return {
    auth: { userId: acesso.id, email: '', nome: 'Árbitro do jogo', tipo: 'arbitro', status: 'ATIVA' },
    candidatura: { id: acesso.id, nome: 'Árbitro do jogo', email: '', status: 'ATIVA', arbitroId: null },
    partida,
  }
}

async function acessoPeloOrganizador(req: NextRequest, token: string): Promise<ArbitroPartidaAccess | null> {
  const sessao = await verifyPublicToken(req)
  if (!sessao || sessao.tipo !== 'organizador' || sessao.trocarSenha) return null
  if (!isReleasedPublicStatus(sessao.status)) return null

  const { partida } = await lerPartidaOperacao(filtroDoToken(token))
  if (!partida?.liga) return null
  // O organizadorId não vem no embed da partida: a posse é lida à parte.
  if ((await organizadorDaLiga(partida.ligaId)) !== sessao.userId) return null

  return {
    auth: sessao,
    candidatura: {
      id: sessao.userId,
      nome: sessao.nome || 'Organizador',
      email: sessao.email,
      status: sessao.status,
      arbitroId: null,
    },
    partida,
  }
}

async function acessoPeloLink(req: NextRequest, token: string): Promise<ArbitroPartidaAccess | NextResponse | null> {
  const { data: acesso } = await supabase
    .from('AcessoArbitroJogo')
    .select('id,partidaId,token,ativo,revogadoEm')
    .eq('token', token)
    .maybeSingle()
  if (!acesso) return null
  if (!acesso.ativo || acesso.revogadoEm) {
    return error('Este link de acesso ao jogo foi revogado pelo organizador.', 410)
  }
  const sessao = await lerSessaoAcesso(req)
  if (!sessao || sessao.acessoId !== acesso.id || sessao.token !== acesso.token || sessao.partidaId !== acesso.partidaId) {
    return error('Informe o código de acesso enviado pelo organizador.', 401)
  }
  const { partida, error: partidaErr } = await lerPartidaOperacao({ coluna: 'id', valor: Number(acesso.partidaId) })
  if (partidaErr || !partida) return error('Não foi possível abrir a partida.', 500)
  return {
    auth: { userId: acesso.id, email: '', nome: 'Árbitro do jogo', tipo: 'arbitro', status: 'ATIVA' },
    candidatura: { id: acesso.id, nome: 'Árbitro do jogo', email: '', status: 'ATIVA', arbitroId: null },
    partida,
  }
}

/** Token numérico é Partida.id (só com sessão válida); qualquer outro é o sumulaToken opaco. */
function filtroDoToken(token: string): FiltroPartida {
  return /^d+$/.test(token) ? { coluna: 'id', valor: Number(token) } : { coluna: 'sumulaToken', valor: token }
}
