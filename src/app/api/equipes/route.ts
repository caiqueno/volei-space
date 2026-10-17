import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { equipeSchema } from '@/lib/schemas'
import { verifyToken } from '@/lib/auth'
import { exigirOrganizadorDaLiga, ligasVisiveisAoOrganizador } from '@/lib/organizador-isolamento'
import { STATUS_CAMPEONATO_PUBLICO } from '@/lib/campeonato-publico'
import { idsCompeticoesPrivadas } from '@/lib/visibilidade-competicao'
import { EQUIPE_JOGADOR_LISTA_COLUNAS, EQUIPE_LIGA_RESUMO_COLUNAS, EQUIPE_LISTA_COLUNAS } from '@/lib/projecoes-publicas'

const EQUIPE_COLUNAS = EQUIPE_LISTA_COLUNAS
const LIGA_COLUNAS = EQUIPE_LIGA_RESUMO_COLUNAS
const JOGADOR_COLUNAS = EQUIPE_JOGADOR_LISTA_COLUNAS
const STATUS_PUBLICOS: readonly string[] = STATUS_CAMPEONATO_PUBLICO

type EquipeLinha = {
  id: number
  nome: string | null
  slug: string | null
  logoUrl: string | null
  corHex: string | null
  categoria: string | null
  ligaId: number
  categoriaCampeonatoId: string | null
  statusEquipe: string | null
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    if (searchParams.has('serie')) return error('A série não separa mais a categoria. Use a categoria do campeonato.', 422)
    const ligaId = searchParams.get('ligaId')
    const categoria = searchParams.get('categoria')
    const categoriaCampeonatoId = searchParams.get('categoriaCampeonatoId')
    const busca = searchParams.get('q')?.trim()
    const [admin, ligasDoOrganizador] = await Promise.all([
      verifyToken(req),
      ligasVisiveisAoOrganizador(req),
    ])
    if (ligasDoOrganizador && ligaId && !ligasDoOrganizador.includes(Number(ligaId))) return success([])

    if (ligaId) {
      if (!ligasDoOrganizador && !admin) {
        const { data: liga, error: ligaErr } = await supabase
          .from('Liga')
          .select('id,status,simulacao')
          .eq('id', Number(ligaId))
          .maybeSingle()
        if (ligaErr) throw ligaErr
        if (!liga || liga.simulacao === true || !STATUS_PUBLICOS.includes(String(liga.status))) return success([])
      }

      const { data: inscricoes, error: inscricoesError } = await supabase
        .from('InscricaoCampeonato')
        .select('equipeId')
        .eq('ligaId', Number(ligaId))
        .eq('status', 'APROVADA')
      if (inscricoesError) throw inscricoesError

      const ids = Array.from(new Set((inscricoes ?? []).map((item) => Number(item.equipeId)).filter((id) => Number.isInteger(id))))
      if (ids.length === 0) return success([])

      const { data, error: equipesErr } = await supabase.from('Equipe').select(EQUIPE_COLUNAS).in('id', ids)
      if (equipesErr) throw equipesErr

      const termo = busca?.toLowerCase()
      const equipes = ((data ?? []) as EquipeLinha[])
        .filter((equipe) => !categoriaCampeonatoId || equipe.categoriaCampeonatoId === categoriaCampeonatoId)
        .filter((equipe) => Boolean(categoriaCampeonatoId) || !categoria || equipe.categoria === categoria)
        .filter((equipe) => !termo || String(equipe.nome ?? '').toLowerCase().includes(termo))
        .sort((a, b) => String(a.nome ?? '').localeCompare(String(b.nome ?? ''), 'pt-BR'))

      return success(await anexarLigaEJogadores(equipes))
    }

    let q = supabase.from('Equipe').select(EQUIPE_COLUNAS).order('nome', { ascending: true })
    if (ligasDoOrganizador) {
      q = q.in('ligaId', ligasDoOrganizador.length ? ligasDoOrganizador : [-1])
    } else if (!admin) {
      const { data: publicas, error: publicasErr } = await supabase
        .from('Liga')
        .select('id')
        .eq('simulacao', false)
        .in('status', STATUS_PUBLICOS)
      if (publicasErr) throw publicasErr
      // Lista sem campeonato escolhido: competição privada nunca aparece (só com ligaId, pelo link).
      const privadas = await idsCompeticoesPrivadas()
      const ids = (publicas ?? []).map((liga) => liga.id).filter((id) => !privadas.has(Number(id)))
      if (ids.length === 0) return success([])
      q = q.in('ligaId', ids)
    }
    if (categoriaCampeonatoId) q = q.eq('categoriaCampeonatoId', categoriaCampeonatoId)
    else if (categoria) q = q.eq('categoria', categoria)
    if (busca) q = q.ilike('nome', `%${busca.replace(/[%_]/g, '')}%`)

    const { data, error: err } = await q
    if (err) throw err
    return success(await anexarLigaEJogadores((data ?? []) as EquipeLinha[]))
  } catch (err) {
    console.error('[equipes] erro ao buscar', err)
    return error('Erro ao buscar equipes', 500)
  }
}

async function anexarLigaEJogadores(equipes: EquipeLinha[]) {
  if (equipes.length === 0) return []
  const ligaIds = Array.from(new Set(equipes.map((equipe) => equipe.ligaId).filter((id) => Number.isInteger(id))))
  const equipeIds = equipes.map((equipe) => equipe.id)
  const [{ data: ligas, error: ligaErr }, { data: jogadores, error: jogadorErr }] = await Promise.all([
    ligaIds.length
      ? supabase.from('Liga').select(LIGA_COLUNAS).in('id', ligaIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('Jogador').select(JOGADOR_COLUNAS).in('equipeId', equipeIds).eq('banido', false),
  ])
  if (ligaErr) throw ligaErr
  if (jogadorErr) throw jogadorErr

  const ligaPorId = new Map((ligas ?? []).map((liga) => [liga.id, liga]))
  const jogadoresPorEquipe = new Map<number, Array<Record<string, unknown>>>()
  for (const jogador of jogadores ?? []) {
    const lista = jogadoresPorEquipe.get(jogador.equipeId) ?? []
    lista.push({
      id: jogador.id,
      nome: jogador.nome,
      numero: jogador.numero,
      posicao: jogador.posicao,
      fotoUrl: jogador.fotoUrl,
      fotoRostoUrl: jogador.fotoRostoUrl,
    })
    jogadoresPorEquipe.set(jogador.equipeId, lista)
  }

  return equipes.map((equipe) => ({
    ...equipe,
    liga: ligaPorId.get(equipe.ligaId) ?? null,
    jogadores: jogadoresPorEquipe.get(equipe.id) ?? [],
  }))
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = equipeSchema.safeParse(body)
    if (!parsed.success) return error('Dados inválidos', 422, parsed.error.flatten())
    const acesso = await exigirOrganizadorDaLiga(req, parsed.data.ligaId)
    if (acesso instanceof NextResponse) return acesso

    const { data: categoria } = await supabase
      .from('CategoriaCampeonato')
      .select('id')
      .eq('ligaId', parsed.data.ligaId)
      .eq('codigo', parsed.data.categoria)
      .is('removidaEm', null)
      .maybeSingle()
    if (!categoria) return error('Esta categoria não está disponível no campeonato.', 422)

    const { data, error: err } = await supabase
      .from('Equipe')
      .insert({ ...parsed.data, serie: null, categoriaCampeonatoId: categoria.id })
      .select(EQUIPE_COLUNAS)
      .single()

    if (err) {
      if (err.code === '23505') return error('Equipe já cadastrada nesse campeonato e nessa categoria.', 409)
      throw err
    }
    return success(data, 201)
  } catch {
    return error('Erro ao criar equipe', 500)
  }
}
