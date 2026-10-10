import { NextRequest } from 'next/server'
import { z } from 'zod'
import { error, success } from '@/lib/api-response'
import { requirePublicRole } from '@/lib/auth'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { rejectIfCampeonatoFinalizado } from '@/lib/championship-finalization'
import { partidaForaDaCategoria } from '@/lib/isolamento-categoria'

type RouteContext = {
  params: Promise<{ id: string }>
}

const editableStatuses = new Set(['AGENDADA', 'PENDENTE_APROVACAO', 'CANCELADA'])
const lockedStatuses = new Set(['EM_ANDAMENTO', 'ENCERRADA'])

const calendarSchema = z.object({
  categoriaCampeonatoId: z.string().uuid(),
  partidas: z.array(z.object({
    id: z.number().int().positive(),
    data: z.string().optional().nullable(),
    horario: z.string().optional().nullable(),
    localNome: z.string().optional().nullable(),
    mandanteId: z.number().int().positive().optional().nullable(),
    arbitroId: z.number().int().positive().optional().nullable(),
    status: z.string().optional().nullable(),
  })).min(1),
})

export async function PATCH(req: NextRequest, context: RouteContext) {
  const auth = await requirePublicRole(req, ['organizador'], { releasedOnly: true })
  if (auth instanceof Response) return auth

  const { id } = await context.params
  const ligaId = Number(id)
  if (!Number.isInteger(ligaId)) return error('Campeonato inválido.', 400)

  const parsed = calendarSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return error('Dados inválidos para atualizar calendário.', 422, parsed.error.flatten())

  const { data: liga, error: ligaErr } = await supabase
    .from('Liga')
    .select('id,organizadorId')
    .eq('id', ligaId)
    .single()

  if (ligaErr || !liga) {
    if (ligaErr) console.error('[calendario] campeonato não encontrado', ligaErr)
    return error('Campeonato não encontrado.', 404)
  }
  if (liga.organizadorId !== auth.userId) return error('Acesso negado para este campeonato.', 403)
  const bloqueio = await rejectIfCampeonatoFinalizado(ligaId)
  if (bloqueio) return bloqueio

  const ids = parsed.data.partidas.map((partida) => partida.id)
  const { data: currentMatches, error: matchesErr } = await supabase
    .from('Partida')
    .select('id,ligaId,equipeAId,equipeBId,status,categoriaCampeonatoId')
    .eq('ligaId', ligaId)
    .in('id', ids)

  if (matchesErr) {
    console.error('[calendario] erro ao validar partidas', matchesErr)
    return error('Erro ao validar partidas do calendário.', 500)
  }
  if ((currentMatches ?? []).length !== ids.length) return error('Uma ou mais partidas não pertencem a este campeonato.', 403)
  if (partidaForaDaCategoria(currentMatches ?? [], parsed.data.categoriaCampeonatoId)) {
    return error('O calendário desta categoria não altera jogos de outra.', 422)
  }

  const currentById = new Map((currentMatches ?? []).map((partida: any) => [Number(partida.id), partida]))
  let updated = 0

  for (const item of parsed.data.partidas) {
    const current = currentById.get(item.id)
    if (!current) continue
    if (lockedStatuses.has(String(current.status))) {
      return error('Partidas em andamento ou encerradas não podem ter agenda alterada.', 409)
    }

    const update: Record<string, unknown> = {}
    const nextStatus = String(item.status || current.status || 'AGENDADA').toUpperCase()
    if (editableStatuses.has(nextStatus)) update.status = nextStatus

    const dateTime = buildDateTime(item.data, item.horario)
    if (dateTime) update.dataHora = dateTime
    if (typeof item.localNome === 'string') update.localNome = item.localNome.trim() || 'A definir'

    if (item.mandanteId && item.mandanteId === current.equipeBId) {
      update.equipeAId = current.equipeBId
      update.equipeBId = current.equipeAId
    }

    if (Object.keys(update).length > 0) {
      const { error: updateErr } = await supabase.from('Partida').update(update).eq('id', item.id).eq('ligaId', ligaId)
      if (updateErr) {
        console.error('[calendario] erro ao atualizar partida', updateErr)
        return error('Erro ao atualizar partida do calendário.', 500)
      }
      updated += 1
    }

    if (item.arbitroId) {
      const { data: escalaExistente, error: escalaFetchErr } = await supabase
        .from('EscalaArbitro')
        .select('id')
        .eq('partidaId', item.id)
        .limit(1)

      if (escalaFetchErr) {
        console.error('[calendario] erro ao buscar escala', escalaFetchErr)
        return error('Erro ao buscar escala de arbitragem.', 500)
      }

      if (escalaExistente?.length) {
        const { error: escalaUpdateErr } = await supabase
          .from('EscalaArbitro')
          .update({ arbitroId: item.arbitroId, cargo: 'PRIMEIRO_ARBITRO' })
          .eq('id', escalaExistente[0].id)
        if (escalaUpdateErr) {
          console.error('[calendario] erro ao atualizar árbitro', escalaUpdateErr)
          return error('Erro ao atualizar árbitro da partida.', 500)
        }
      } else {
        const { error: escalaInsertErr } = await supabase
          .from('EscalaArbitro')
          .insert({ partidaId: item.id, arbitroId: item.arbitroId, cargo: 'PRIMEIRO_ARBITRO' })
        if (escalaInsertErr) {
          console.error('[calendario] erro ao escalar árbitro', escalaInsertErr)
          return error('Erro ao escalar árbitro da partida.', 500)
        }
      }
    } else if (item.arbitroId === null) {
      const { error: escalaDeleteErr } = await supabase.from('EscalaArbitro').delete().eq('partidaId', item.id)
      if (escalaDeleteErr) {
        console.error('[calendario] erro ao remover árbitro', escalaDeleteErr)
        return error('Erro ao remover árbitro da partida.', 500)
      }
    }
  }

  return success({ atualizadas: updated })
}

function buildDateTime(data?: string | null, horario?: string | null) {
  if (!data) return null
  const safeTime = horario && /^\d{2}:\d{2}$/.test(horario) ? horario : '17:00'
  const value = new Date(`${data}T${safeTime}:00-03:00`)
  if (Number.isNaN(value.getTime())) return null
  return value.toISOString()
}
