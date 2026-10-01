import { NextRequest } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { error, success } from '@/lib/api-response'
import { ligaDoOrganizador, novoTokenInscricao, registrarEventoInscricao, resumoLink } from '@/lib/link-inscricao-campeonato'

async function lerLink(ligaId: number) {
  const { data, error: falha } = await supabase.from('LinkInscricaoCampeonato').select('id,ligaId,token,ativo,revogadoEm,atualizadoEm').eq('ligaId', ligaId).maybeSingle()
  if (falha) throw new Error(falha.message)
  return data
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const ligaId = Number((await context.params).id)
  const posse = await ligaDoOrganizador(req, ligaId)
  if (posse instanceof Response) return posse
  try {
    const link = await lerLink(ligaId)
    return success({ ligaId, nome: posse.liga.nome, ...resumoLink(link), atualizadoEm: link?.atualizadoEm ?? null })
  } catch {
    return error('Não foi possível consultar o link de inscrição.', 500)
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const ligaId = Number((await context.params).id)
  const posse = await ligaDoOrganizador(req, ligaId)
  if (posse instanceof Response) return posse
  const corpo = await req.json().catch(() => null) as { acao?: string } | null
  const acao = corpo?.acao
  if (!acao || !['gerar', 'regenerar', 'desativar', 'reativar'].includes(acao)) return error('Informe a ação do link.', 422)
  const agora = new Date().toISOString()

  try {
    const atual = await lerLink(ligaId)
    if (acao === 'gerar') {
      if (atual) return success({ ligaId, nome: posse.liga.nome, ...resumoLink(atual) })
      const token = novoTokenInscricao()
      const { data, error: falha } = await supabase.from('LinkInscricaoCampeonato').insert({
        ligaId, token, ativo: true, criadoPor: posse.auth.userId,
      }).select('id,token,ativo,revogadoEm').single()
      if (falha || !data) return error('Não foi possível gerar o link.', 500)
      await registrarEventoInscricao({ ligaId, linkId: data.id, tipo: 'LINK_INSCRICAO_GERADO', organizadorId: posse.auth.userId, resultado: 'ok' })
      return success({ ligaId, nome: posse.liga.nome, ...resumoLink(data) }, 201)
    }
    if (!atual) return error('Este campeonato ainda não tem um link de inscrição.', 409)
    if (acao === 'desativar') {
      if (!atual.ativo) return success({ ligaId, nome: posse.liga.nome, ...resumoLink(atual) })
      const { error: falha } = await supabase.from('LinkInscricaoCampeonato').update({ ativo: false, revogadoEm: agora, revogadoPor: posse.auth.userId, atualizadoEm: agora }).eq('id', atual.id)
      if (falha) return error('Não foi possível desativar o link.', 500)
      await registrarEventoInscricao({ ligaId, linkId: atual.id, tipo: 'LINK_INSCRICAO_DESATIVADO', organizadorId: posse.auth.userId, resultado: 'ok' })
      return success({ ligaId, nome: posse.liga.nome, ...resumoLink({ ...atual, ativo: false, revogadoEm: agora }) })
    }
    if (acao === 'reativar') {
      const { error: falha } = await supabase.from('LinkInscricaoCampeonato').update({ ativo: true, revogadoEm: null, revogadoPor: null, atualizadoEm: agora }).eq('id', atual.id)
      if (falha) return error('Não foi possível reativar o link.', 500)
      await registrarEventoInscricao({ ligaId, linkId: atual.id, tipo: 'LINK_INSCRICAO_REATIVADO', organizadorId: posse.auth.userId, resultado: 'ok' })
      return success({ ligaId, nome: posse.liga.nome, ...resumoLink({ ...atual, ativo: true, revogadoEm: null }) })
    }
    const token = novoTokenInscricao()
    const { error: falha } = await supabase.from('LinkInscricaoCampeonato').update({ token, ativo: true, revogadoEm: null, revogadoPor: null, atualizadoEm: agora }).eq('id', atual.id)
    if (falha) return error('Não foi possível regenerar o link.', 500)
    await registrarEventoInscricao({ ligaId, linkId: atual.id, tipo: 'LINK_INSCRICAO_REGENERADO', organizadorId: posse.auth.userId, resultado: 'ok' })
    return success({ ligaId, nome: posse.liga.nome, ...resumoLink({ ...atual, token, ativo: true, revogadoEm: null }) })
  } catch {
    return error('Não foi possível atualizar o link de inscrição.', 500)
  }
}
