import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { success, error } from '@/lib/api-response'
import { equipeSchema } from '@/lib/schemas'
import { exigirOrganizadorDaLiga, ligasVisiveisAoOrganizador } from '@/lib/organizador-isolamento'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    if (searchParams.has('serie')) return error('A série não separa mais a categoria. Use a categoria do campeonato.', 422)
    const ligaId = searchParams.get('ligaId')
    const categoria = searchParams.get('categoria')
    const categoriaCampeonatoId = searchParams.get('categoriaCampeonatoId')
    const busca = searchParams.get('q')?.trim()
    const ligasDoOrganizador = await ligasVisiveisAoOrganizador(req)
    if (ligasDoOrganizador && ligaId && !ligasDoOrganizador.includes(Number(ligaId))) return success([])

    if (ligaId) {
      const { data: inscricoes, error: inscricoesError } = await supabase
        .from('InscricaoCampeonato')
        .select('equipe:Equipe(*, liga:Liga(*), jogadores:Jogador(id,nome,numero,posicao,fotoUrl,fotoRostoUrl))')
        .eq('ligaId', Number(ligaId))
        .eq('status', 'APROVADA')

      if (inscricoesError) throw inscricoesError

      const equipes = (inscricoes ?? [])
        .map((inscricao: any) => inscricao.equipe)
        .filter(Boolean)
        .filter((equipe: any) => !categoriaCampeonatoId || equipe.categoriaCampeonatoId === categoriaCampeonatoId)
        .filter((equipe: any) => Boolean(categoriaCampeonatoId) || !categoria || equipe.categoria === categoria)
        .filter((equipe: any) => !busca || equipe.nome?.toLowerCase().includes(busca.toLowerCase()))
        .sort((a: any, b: any) => a.nome.localeCompare(b.nome, 'pt-BR'))

      return success(equipes)
    }

    let q = supabase
      .from('Equipe')
      .select('*, liga:Liga(*), jogadores:Jogador(id,nome,numero,posicao,fotoUrl,fotoRostoUrl)')
      .order('nome', { ascending: true })

    if (ligasDoOrganizador) q = q.in('ligaId', ligasDoOrganizador.length ? ligasDoOrganizador : [-1])
    if (categoriaCampeonatoId) q = q.eq('categoriaCampeonatoId', categoriaCampeonatoId)
    else if (categoria) q = q.eq('categoria', categoria)
    if (busca) q = q.ilike('nome', `%${busca.replace(/[%_]/g, '')}%`)

    const { data, error: err } = await q
    if (err) throw err
    return success(data)
  } catch {
    return error('Erro ao buscar equipes', 500)
  }
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
      .select()
      .single()

    if (err) {
      if (err.code === '23505') return error('Equipe já cadastrada nessa liga/categoria/série', 409)
      throw err
    }
    return success(data, 201)
  } catch {
    return error('Erro ao criar equipe', 500)
  }
}
