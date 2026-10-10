import { NextRequest } from 'next/server'
import { error, success } from '@/lib/api-response'
import { requirePublicRole, verifyToken } from '@/lib/auth'
import { recalculateLeagueClassification } from '@/lib/championship-operations'
import { isCampeonatoFinalizado, STATUS_CAMPEONATO_FINALIZADO } from '@/lib/championship-finalization'
import { avaliarFinalizacao } from '@/lib/finalizacao-regras'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ligaId = Number(id)
  if (!Number.isInteger(ligaId)) return error('Campeonato inválido.', 400)

  const { data: liga, error: ligaErr } = await supabase
    .from('Liga')
    .select('id,organizadorId,status,formato,faseEliminatoria,disputaTerceiroLugar')
    .eq('id', ligaId)
    .single()

  if (ligaErr || !liga) return error('Campeonato não encontrado.', 404)
  if (isCampeonatoFinalizado(liga.status)) return error('Este campeonato já está finalizado.', 409)

  let autor: string | null = null
  const organizador = await requirePublicRole(req, ['organizador'], { releasedOnly: true })
  if (!(organizador instanceof Response) && organizador.userId === liga.organizadorId) {
    autor = organizador.userId
  } else {
    const admin = await verifyToken(req)
    if (!admin) {
      if (organizador instanceof Response) return organizador
      return error('Você não pode finalizar este campeonato.', 403)
    }
    autor = String(admin.email ?? 'admin')
  }

  try {
    await recalculateLeagueClassification(ligaId)
  } catch (err) {
    console.error('[finalizar] classificação não recalculada', err)
    return error('Não foi possível recalcular a classificação antes de finalizar.', 500)
  }

  const [{ data: partidas, error: partidasErr }, { data: classificacao, error: classificacaoErr }, { data: categorias, error: categoriasErr }] = await Promise.all([
    supabase.from('Partida').select('fase,status,vencedorId,equipeAId,equipeBId,setsPorA,setsPorB,categoriaCampeonatoId').eq('ligaId', ligaId),
    supabase.from('ClassificacaoEntrada').select('equipeId,posicao,jogos,categoriaCampeonatoId').eq('ligaId', ligaId),
    supabase.from('CategoriaConfiguracao').select('categoriaCampeonatoId,formato,faseEliminatoria,disputaTerceiroLugar').eq('ligaId', ligaId),
  ])
  if (partidasErr || classificacaoErr || categoriasErr) return error('Não foi possível conferir o campeão antes de finalizar.', 500)

  const avaliacao = avaliarFinalizacao({
    liga,
    categorias: categorias ?? [],
    partidas: partidas ?? [],
    classificacao: classificacao ?? [],
  })
  if (!avaliacao.ok) return error(avaliacao.mensagem, 409)

  const finalizadoEm = new Date().toISOString()
  const { data, error: updateErr } = await supabase
    .from('Liga')
    .update({
      status: STATUS_CAMPEONATO_FINALIZADO,
      inscricoesAbertas: false,
      finalizadoEm,
      finalizadoPor: autor,
    })
    .eq('id', ligaId)
    .select('id,status,slug,nome,finalizadoEm,finalizadoPor')
    .single()

  if (updateErr || !data) return error('Não foi possível finalizar o campeonato.', 500)

  return success({
    ...data,
    mensagem: 'Campeonato finalizado. Ele permanece disponível para consulta e apresentação.',
  })
}
