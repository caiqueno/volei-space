import { NextRequest } from 'next/server'
import { error, success } from '@/lib/api-response'
import { buscarPartidasPublicas } from '@/lib/agenda-publica'
import { agruparPartidasPublicas } from '@/lib/partida-publica'
import { campeonatoDeTeste } from '@/lib/campeonato-teste'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  const ligaParam = new URL(req.url).searchParams.get('ligaId')
  const ligaId = ligaParam == null || ligaParam === '' ? null : Number(ligaParam)
  if (ligaId != null && (!Number.isFinite(ligaId) || ligaId <= 0)) return error('Informe o campeonato.', 422)

  let idsPublicos: number[] = []
  if (ligaId != null) {
    const { data: liga, error: ligaErr } = await supabaseAdmin
      .from('Liga')
      .select('id,nome,slug,descricao,simulacao')
      .eq('id', ligaId)
      .maybeSingle()
    if (ligaErr) return error('Não foi possível carregar os jogos agora. Tente novamente em instantes.', 500)
    if (!liga || campeonatoDeTeste(liga)) return error('Campeonato não encontrado.', 404)
    idsPublicos = [liga.id]
  } else {
    const { data: ligas, error: ligaErr } = await supabaseAdmin
      .from('Liga')
      .select('id,nome,slug,descricao,simulacao')
      .eq('simulacao', false)
    if (ligaErr) return error('Não foi possível carregar os jogos agora. Tente novamente em instantes.', 500)
    idsPublicos = (ligas ?? []).filter((liga) => !campeonatoDeTeste(liga)).map((liga) => liga.id)
  }

  const { partidas, erro: partidasErr } = await buscarPartidasPublicas(idsPublicos, ligaId != null)
  if (partidasErr) {
    console.error('[portal/jogos] erro ao buscar partidas')
    return error('Não foi possível carregar os jogos agora. Tente novamente em instantes.', 500)
  }
  const grupos = agruparPartidasPublicas(partidas)
  const resposta = success({ ...grupos, atualizadoEm: new Date().toISOString() })
  resposta.headers.set('Cache-Control', 'no-store')
  return resposta
}
