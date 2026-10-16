import type { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { error } from '@/lib/api-response'
import { isReleasedPublicStatus, verifyPublicToken, type PublicJWTPayload } from '@/lib/auth'
import { lerSessaoAcesso } from '@/lib/acesso-arbitro-jogo'

// Quem pode mexer em arquivos de uma equipe. Tudo é decidido no servidor, com a sessão
// do cookie e consultas ao banco; nada que o cliente declare vale como prova de posse.

export type AtorDaEquipe = 'organizador' | 'capitao' | 'arbitro'

export type EquipeAlvo = { id: number; ligaId: number }

export async function carregarEquipeAlvo(equipeId: number): Promise<EquipeAlvo | null> {
  if (!Number.isInteger(equipeId) || equipeId <= 0) return null
  const { data } = await supabase.from('Equipe').select('id,ligaId').eq('id', equipeId).maybeSingle()
  if (!data) return null
  return { id: Number(data.id), ligaId: Number(data.ligaId) }
}

export async function atorDaEquipe(req: NextRequest, equipe: EquipeAlvo): Promise<AtorDaEquipe | null> {
  const sessao = await verifyPublicToken(req)
  if (sessao && isReleasedPublicStatus(sessao.status) && sessao.trocarSenha !== true) {
    if (sessao.tipo === 'organizador' && (await ehOrganizadorDono(sessao, equipe))) return 'organizador'
    if (sessao.tipo === 'equipe' && (await ehCapitaoDaEquipe(sessao, equipe))) return 'capitao'
    if (sessao.tipo === 'arbitro' && (await ehArbitroEscalado(sessao, equipe))) return 'arbitro'
  }
  // Árbitro que entrou pelo link exclusivo do jogo, sem conta.
  if (await ehArbitroDoLinkDoJogo(req, equipe)) return 'arbitro'
  return null
}

/** 401 sem sessão nenhuma, 403 com sessão sem poder sobre a equipe. */
export async function exigirAtorDaEquipe(req: NextRequest, equipe: EquipeAlvo, permitidos: AtorDaEquipe[]): Promise<AtorDaEquipe | NextResponse> {
  const ator = await atorDaEquipe(req, equipe)
  if (ator && permitidos.includes(ator)) return ator
  const temSessao = Boolean(await verifyPublicToken(req)) || Boolean(await lerSessaoAcesso(req))
  return temSessao ? error('Você não tem acesso a esta equipe.', 403) : error('Não autorizado', 401)
}

async function ehOrganizadorDono(sessao: PublicJWTPayload, equipe: EquipeAlvo) {
  const { data } = await supabase.from('Liga').select('id,organizadorId').eq('id', equipe.ligaId).maybeSingle()
  return Boolean(data?.organizadorId && data.organizadorId === sessao.userId)
}

async function ehCapitaoDaEquipe(sessao: PublicJWTPayload, equipe: EquipeAlvo) {
  const { data } = await supabase.from('CandidaturaEquipe').select('id,equipeId').eq('id', sessao.userId).maybeSingle()
  return Boolean(data?.equipeId && Number(data.equipeId) === equipe.id)
}

async function partidasDaEquipe(equipe: EquipeAlvo): Promise<number[]> {
  const [comoA, comoB] = await Promise.all([
    supabase.from('Partida').select('id').eq('equipeAId', equipe.id),
    supabase.from('Partida').select('id').eq('equipeBId', equipe.id),
  ])
  return [...(comoA.data ?? []), ...(comoB.data ?? [])].map((linha) => Number(linha.id))
}

async function ehArbitroEscalado(sessao: PublicJWTPayload, equipe: EquipeAlvo) {
  const { data: conta } = await supabase.from('CandidaturaArbitro').select('id,arbitroId').eq('id', sessao.userId).maybeSingle()
  if (!conta?.arbitroId) return false
  const partidas = await partidasDaEquipe(equipe)
  if (partidas.length === 0) return false
  const { data: escala } = await supabase
    .from('EscalaArbitro')
    .select('id')
    .eq('arbitroId', conta.arbitroId)
    .in('partidaId', partidas)
    .limit(1)
  return (escala ?? []).length > 0
}

async function ehArbitroDoLinkDoJogo(req: NextRequest, equipe: EquipeAlvo) {
  const acesso = await lerSessaoAcesso(req)
  if (!acesso) return false
  const { data: link } = await supabase
    .from('AcessoArbitroJogo')
    .select('id,partidaId,token,ativo,revogadoEm')
    .eq('id', acesso.acessoId)
    .maybeSingle()
  if (!link || !link.ativo || link.revogadoEm || link.token !== acesso.token || Number(link.partidaId) !== Number(acesso.partidaId)) return false
  const { data: partida } = await supabase.from('Partida').select('id,equipeAId,equipeBId').eq('id', link.partidaId).maybeSingle()
  return Boolean(partida && [Number(partida.equipeAId), Number(partida.equipeBId)].includes(equipe.id))
}
