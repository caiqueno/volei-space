import type { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { error } from '@/lib/api-response'
import { verifyPublicToken } from '@/lib/auth'
import { lerSessaoAcesso } from '@/lib/acesso-arbitro-jogo'

export type SumulaTokenAccess = {
  partida: any
}

const JOGADOR_PARTIDA = 'id,nome,numero,posicao,fotoUrl,fotoRostoUrl,equipeId'
const PARTIDA_SUMULA = `*, liga:Liga!Partida_ligaId_fkey(*), equipeA:Equipe!Partida_equipeAId_fkey(*, jogadores:Jogador(${JOGADOR_PARTIDA})), equipeB:Equipe!Partida_equipeBId_fkey(*, jogadores:Jogador(${JOGADOR_PARTIDA})), presencas:SumulaPresenca(*, jogador:Jogador(${JOGADOR_PARTIDA})), sets:SetPartida(*), ocorrencias:OcorrenciaPartida(*), destaques:DestaquesPartida(*, jogador:Jogador(${JOGADOR_PARTIDA})), escala:EscalaArbitro(*, arbitro:Arbitro(id,nome))`

export async function requireSumulaTokenAccess(token: string): Promise<SumulaTokenAccess | NextResponse> {
  const numerico = /^\d+$/.test(token)
  let consulta = supabase.from('Partida').select(PARTIDA_SUMULA)
  consulta = numerico ? consulta.eq('id', Number(token)) : consulta.eq('sumulaToken', token)
  const { data: partida, error: partidaErr } = await consulta.maybeSingle()

  if (partidaErr) return error('Não foi possível abrir a súmula.', 500)
  if (!partida) return error('Partida não encontrada.', 404)
  if (partida.sumulaTokenExpira && new Date(partida.sumulaTokenExpira).getTime() < Date.now()) {
    return error('O link da súmula expirou.', 410)
  }
  partida.liga = primeiro(partida.liga)
  partida.equipeA = primeiro(partida.equipeA)
  partida.equipeB = primeiro(partida.equipeB)
  return { partida }
}

function primeiro(valor: unknown) {
  return Array.isArray(valor) ? valor[0] ?? null : valor
}

export async function requireSumulaLeitura(req: NextRequest, partida: any): Promise<NextResponse | null> {
  const acesso = await lerSessaoAcesso(req)
  if (acesso && Number(acesso.partidaId) === Number(partida.id)) {
    const { data: link } = await supabase
      .from('AcessoArbitroJogo')
      .select('id,token,ativo,revogadoEm')
      .eq('id', acesso.acessoId)
      .maybeSingle()
    if (link && link.ativo && !link.revogadoEm && link.token === acesso.token) return null
  }

  const sessao = await verifyPublicToken(req)
  if (!sessao) return error('Entre para abrir a súmula.', 401)

  const liga = Array.isArray(partida.liga) ? partida.liga[0] : partida.liga
  if (sessao.tipo === 'organizador' && liga?.organizadorId === sessao.userId) return null

  if (sessao.tipo === 'arbitro') {
    const { data: conta } = await supabase
      .from('CandidaturaArbitro')
      .select('arbitroId,status')
      .eq('id', sessao.userId)
      .maybeSingle()
    const escala = Array.isArray(partida.escala) ? partida.escala : []
    const escalado = escala.some((item: { arbitroId?: number }) => Number(item.arbitroId) === Number(conta?.arbitroId))
    if (!conta?.arbitroId || !escalado) return error('Você não está escalado para esta súmula.', 403)
    return null
  }

  return error('Você não pode abrir esta súmula.', 403)
}
