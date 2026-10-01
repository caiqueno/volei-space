import type { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { requirePublicRole, isReleasedPublicStatus, type PublicJWTPayload } from '@/lib/auth'
import { error } from '@/lib/api-response'
import { lerSessaoAcesso } from '@/lib/acesso-arbitro-jogo'

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

const PARTIDA_OPERACAO = '*, liga:Liga!Partida_ligaId_fkey(*), equipeA:Equipe!Partida_equipeAId_fkey(*, jogadores:Jogador(*)), equipeB:Equipe!Partida_equipeBId_fkey(*, jogadores:Jogador(*)), presencas:SumulaPresenca(*, jogador:Jogador(*)), escala:EscalaArbitro(*, arbitro:Arbitro(*))'

export async function requireArbitroPartidaAccess(
  req: NextRequest,
  token: string,
): Promise<ArbitroPartidaAccess | NextResponse> {
  const peloLink = await acessoPeloLink(req, token)
  if (peloLink) return peloLink

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

  const numerico = /^\d+$/.test(token)
  let consulta = supabase.from('Partida').select(PARTIDA_OPERACAO)
  consulta = numerico ? consulta.eq('id', Number(token)) : consulta.eq('sumulaToken', token)
  const { data: partida, error: partidaErr } = await consulta.maybeSingle()

  if (partidaErr) return error('Não foi possível abrir a partida.', 500)
  if (!partida) return error('Partida não encontrada.', 404)
  partida.liga = Array.isArray(partida.liga) ? partida.liga[0] ?? null : partida.liga
  partida.equipeA = Array.isArray(partida.equipeA) ? partida.equipeA[0] ?? null : partida.equipeA
  partida.equipeB = Array.isArray(partida.equipeB) ? partida.equipeB[0] ?? null : partida.equipeB

  const escala = Array.isArray(partida.escala) ? partida.escala : []
  const arbitroId = Number(candidatura.arbitroId)
  const escalado = escala.some((item: any) => Number(item.arbitroId) === arbitroId)
  if (!arbitroId || !escalado) return error('Voce nao esta escalado para operar esta partida.', 403)

  return { auth, candidatura, partida }
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
  const { data: partida, error: partidaErr } = await supabase.from('Partida').select(PARTIDA_OPERACAO).eq('id', acesso.partidaId).maybeSingle()
  if (partidaErr || !partida) return error('Não foi possível abrir a partida.', 500)
  partida.liga = Array.isArray(partida.liga) ? partida.liga[0] ?? null : partida.liga
  partida.equipeA = Array.isArray(partida.equipeA) ? partida.equipeA[0] ?? null : partida.equipeA
  partida.equipeB = Array.isArray(partida.equipeB) ? partida.equipeB[0] ?? null : partida.equipeB
  return {
    auth: { userId: acesso.id, email: '', nome: 'Árbitro do jogo', tipo: 'arbitro', status: 'ATIVA' },
    candidatura: { id: acesso.id, nome: 'Árbitro do jogo', email: '', status: 'ATIVA', arbitroId: null },
    partida,
  }
}
