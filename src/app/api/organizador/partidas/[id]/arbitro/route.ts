import { NextRequest } from 'next/server'
import { z } from 'zod'
import { error, success } from '@/lib/api-response'
import { requirePublicRole } from '@/lib/auth'
import { EMAIL_ARBITRO_SIMULACAO } from '@/lib/simulacao'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { rejectIfCampeonatoFinalizado } from '@/lib/championship-finalization'

const STATUS_EDITAVEIS = new Set(['AGENDADA', 'PENDENTE', 'PENDENTE_APROVACAO'])
const STATUS_ARBITRO = new Set(['APROVADA', 'APROVADO', 'ATIVA', 'ATIVO'])

const bodySchema = z.object({
  arbitroId: z.number().int().positive().nullable(),
})

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePublicRole(req, ['organizador'], { releasedOnly: true })
  if (auth instanceof Response) return auth

  const partidaId = Number((await context.params).id)
  if (!Number.isInteger(partidaId)) return error('Partida inválida.', 400)

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return error('Informe o árbitro da partida.', 422)

  const { data: partida, error: partidaErr } = await supabase
    .from('Partida')
    .select('id,ligaId,status,liga:Liga!Partida_ligaId_fkey(id,organizadorId,simulacao,status)')
    .eq('id', partidaId)
    .maybeSingle()

  if (partidaErr || !partida) return error('Partida não encontrada.', 404)
  const liga = Array.isArray(partida.liga) ? partida.liga[0] : partida.liga
  if (!liga || liga.organizadorId !== auth.userId) return error('Acesso negado para esta partida.', 403)

  const bloqueio = await rejectIfCampeonatoFinalizado(Number(partida.ligaId))
  if (bloqueio) return bloqueio
  if (!STATUS_EDITAVEIS.has(String(partida.status || '').toUpperCase())) {
    return error('O árbitro só pode ser alterado enquanto a partida ainda não começou.', 409)
  }

  if (parsed.data.arbitroId === null) {
    const { error: deleteErr } = await supabase
      .from('EscalaArbitro')
      .delete()
      .eq('partidaId', partidaId)
      .eq('cargo', 'PRIMEIRO_ARBITRO')
    if (deleteErr) return error('Não foi possível remover o árbitro.', 500)
    return success({ partidaId, arbitroId: null })
  }

  const { data: conta, error: contaErr } = await supabase
    .from('CandidaturaArbitro')
    .select('id,nome,email,status,arbitroId,organizadorId')
    .eq('arbitroId', parsed.data.arbitroId)
    .maybeSingle()

  if (contaErr || !conta?.arbitroId) return error('Árbitro não encontrado.', 404)
  if (conta.organizadorId !== auth.userId) return error('Este árbitro não pertence à sua organização.', 403)
  if (!STATUS_ARBITRO.has(String(conta.status || '').toUpperCase())) {
    return error('Este árbitro ainda não está autorizado a atuar.', 422)
  }

  const contaDeTeste = EMAIL_ARBITRO_SIMULACAO.test(String(conta.email || ''))
  if (liga.simulacao === true && !contaDeTeste) {
    return error('Uma partida de simulação recebe somente o árbitro de teste.', 422)
  }
  if (liga.simulacao !== true && contaDeTeste) {
    return error('O árbitro de teste não atua em campeonato real.', 422)
  }

  const { data: escalaExistente, error: escalaErr } = await supabase
    .from('EscalaArbitro')
    .select('id')
    .eq('partidaId', partidaId)
    .eq('cargo', 'PRIMEIRO_ARBITRO')
    .maybeSingle()

  if (escalaErr) return error('Não foi possível consultar a escala.', 500)

  if (escalaExistente?.id) {
    const { error: updateErr } = await supabase
      .from('EscalaArbitro')
      .update({ arbitroId: conta.arbitroId })
      .eq('id', escalaExistente.id)
    if (updateErr) {
      console.error('[arbitro] erro ao atualizar escala', updateErr)
      return error('Não foi possível atualizar o árbitro.', 500)
    }
  } else {
    const { error: insertErr } = await supabase.from('EscalaArbitro').insert({
      partidaId,
      arbitroId: conta.arbitroId,
      cargo: 'PRIMEIRO_ARBITRO',
    })
    if (insertErr) {
      console.error('[arbitro] erro ao designar', insertErr)
      return error('Não foi possível designar o árbitro.', 500)
    }
  }

  return success({ partidaId, arbitroId: conta.arbitroId, nome: conta.nome })
}
