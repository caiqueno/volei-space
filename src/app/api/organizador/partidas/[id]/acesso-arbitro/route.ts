import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { error, success } from '@/lib/api-response'
import {
  codigosConferem,
  hashCodigoAcesso,
  novoTokenAcesso,
  partidaDoOrganizador,
  registrarEventoAcesso,
  resumoAcesso,
} from '@/lib/acesso-arbitro-jogo'

const corpoSchema = z.object({
  acao: z.enum(['gerar', 'codigo', 'regenerar', 'revogar']),
  codigo: z.string().optional(),
  confirmar: z.string().optional(),
})

async function lerAcesso(partidaId: number) {
  const { data, error: acessoErr } = await supabase
    .from('AcessoArbitroJogo')
    .select('id,partidaId,token,ativo,revogadoEm,atualizadoEm')
    .eq('partidaId', partidaId)
    .maybeSingle()
  if (acessoErr) throw new Error(acessoErr.message)
  return data
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const partidaId = Number((await context.params).id)
  const posse = await partidaDoOrganizador(req, partidaId)
  if (posse instanceof Response) return posse

  try {
    const acesso = await lerAcesso(partidaId)
    return success({ partidaId, ...resumoAcesso(acesso), atualizadoEm: acesso?.atualizadoEm ?? null })
  } catch {
    return error('Não foi possível consultar o link do árbitro.', 500)
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const partidaId = Number((await context.params).id)
  const posse = await partidaDoOrganizador(req, partidaId)
  if (posse instanceof Response) return posse

  const parsed = corpoSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return error('Informe a ação do link.', 422)
  const { acao, codigo = '', confirmar = '' } = parsed.data
  const agora = new Date().toISOString()

  try {
    const atual = await lerAcesso(partidaId)

    if (acao === 'revogar') {
      if (!atual || !atual.ativo) return error('Este jogo não tem um link ativo.', 409)
      const { error: updateErr } = await supabase
        .from('AcessoArbitroJogo')
        .update({ ativo: false, revogadoEm: agora, revogadoPor: posse.auth.userId, atualizadoEm: agora })
        .eq('id', atual.id)
      if (updateErr) return error('Não foi possível revogar o link.', 500)
      await registrarEventoAcesso({ partidaId, acessoId: atual.id, tipo: 'LINK_REVOGADO', organizadorId: posse.auth.userId, resultado: 'ok' })
      return success({ partidaId, ...resumoAcesso({ ...atual, ativo: false, revogadoEm: agora }) })
    }

    if (acao === 'codigo' || (acao === 'regenerar' && codigo.trim())) {
      if (!codigosConferem(codigo, confirmar)) return error('O código e a confirmação precisam ser iguais e ter entre 4 e 32 caracteres.', 422)
    } else if (acao === 'gerar' && !codigosConferem(codigo, confirmar)) {
      return error('O código e a confirmação precisam ser iguais e ter entre 4 e 32 caracteres.', 422)
    }

    if (acao === 'gerar') {
      if (atual?.ativo && !atual.revogadoEm) return error('Este jogo já tem um link ativo.', 409)
      const token = novoTokenAcesso()
      const codigoHash = await hashCodigoAcesso(codigo)
      if (atual) {
        const { error: updateErr } = await supabase.from('AcessoArbitroJogo').update({
          token, codigoHash, ativo: true, revogadoEm: null, revogadoPor: null, tentativasFalhas: 0, bloqueadoAte: null, atualizadoEm: agora, criadoPor: posse.auth.userId,
        }).eq('id', atual.id)
        if (updateErr) return error('Não foi possível gerar o link.', 500)
        await registrarEventoAcesso({ partidaId, acessoId: atual.id, tipo: 'LINK_GERADO', organizadorId: posse.auth.userId, resultado: 'ok' })
        return success({ partidaId, ...resumoAcesso({ token, ativo: true, revogadoEm: null }) })
      }
      const { data, error: insertErr } = await supabase.from('AcessoArbitroJogo').insert({
        partidaId, token, codigoHash, ativo: true, criadoPor: posse.auth.userId,
      }).select('id').single()
      if (insertErr || !data) return error('Não foi possível gerar o link.', 500)
      await registrarEventoAcesso({ partidaId, acessoId: data.id, tipo: 'LINK_GERADO', organizadorId: posse.auth.userId, resultado: 'ok' })
      return success({ partidaId, ...resumoAcesso({ token, ativo: true, revogadoEm: null }) })
    }

    if (!atual?.ativo || atual.revogadoEm) return error('Gere um link ativo antes de alterar o acesso.', 409)

    if (acao === 'codigo') {
      const codigoHash = await hashCodigoAcesso(codigo)
      const { error: updateErr } = await supabase.from('AcessoArbitroJogo').update({
        codigoHash, tentativasFalhas: 0, bloqueadoAte: null, atualizadoEm: agora,
      }).eq('id', atual.id)
      if (updateErr) return error('Não foi possível alterar o código.', 500)
      await registrarEventoAcesso({ partidaId, acessoId: atual.id, tipo: 'CODIGO_ALTERADO', organizadorId: posse.auth.userId, resultado: 'ok' })
      return success({ partidaId, ...resumoAcesso(atual) })
    }

    const token = novoTokenAcesso()
    const patch: Record<string, unknown> = { token, tentativasFalhas: 0, bloqueadoAte: null, atualizadoEm: agora }
    if (codigo.trim()) patch.codigoHash = await hashCodigoAcesso(codigo)
    const { error: updateErr } = await supabase.from('AcessoArbitroJogo').update(patch).eq('id', atual.id)
    if (updateErr) return error('Não foi possível regenerar o link.', 500)
    await registrarEventoAcesso({ partidaId, acessoId: atual.id, tipo: 'LINK_REGENERADO', organizadorId: posse.auth.userId, resultado: 'ok' })
    return success({ partidaId, ...resumoAcesso({ token, ativo: true, revogadoEm: null }) })
  } catch {
    return error('Não foi possível atualizar o acesso do árbitro.', 500)
  }
}
