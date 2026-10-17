import { NextRequest } from 'next/server'
import { isSupabaseServiceConfigured, supabaseAdmin } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { requireAuth, requirePublicRole } from '@/lib/auth'
import { requireOrganizador } from '@/lib/organizador-isolamento'
import { ligaSchema } from '@/lib/schemas'
import { normalizeEliminatoryPhase } from '@/lib/eliminatorias'
import { validateEliminatoryCapacity } from '@/lib/championship-validation'
import { LIGA_COLUNAS_PUBLICAS } from '@/lib/liga-colunas'
import { comCachePublico, semCacheCompartilhado } from '@/lib/cache-publico'
import { STATUS_CAMPEONATO_PUBLICO } from '@/lib/campeonato-publico'
import { idsCompeticoesPrivadas, semIdsPrivados } from '@/lib/visibilidade-competicao'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const organizadorId = searchParams.get('organizadorId')
  const status = searchParams.get('status')
  const busca = searchParams.get('q')?.trim()

  // Com organizadorId a lista inclui simulação, local e categorias daquele
  // organizador e só sai depois da sessão. A CDN não pode guardar isso:
  // a chave dela é a URL, sem o cookie.
  if (organizadorId) {
    const auth = await requirePublicRole(req, ['organizador'])
    if (auth instanceof Response) return semCacheCompartilhado(auth)
    if (auth.userId !== organizadorId) {
      return semCacheCompartilhado(error('Voce nao pode consultar campeonatos de outro organizador.', 403))
    }
  }

  // A chave publicável não lê Liga. A listagem, inclusive a pública, sai
  // pelo service role e só com as colunas da vitrine.
  let query = supabaseAdmin
    .from('Liga')
    .select(LIGA_COLUNAS_PUBLICAS as '*')
    .order('criadoEm', { ascending: false })

  if (organizadorId) query = query.eq('organizadorId', organizadorId)
  else query = query.eq('simulacao', false).in('status', [...STATUS_CAMPEONATO_PUBLICO])
  if (status) query = query.eq('status', status)
  if (busca) {
    const safeBusca = busca.replace(/[%_,]/g, ' ')
    query = query.or(`nome.ilike.%${safeBusca}%,subtitulo.ilike.%${safeBusca}%,descricao.ilike.%${safeBusca}%`)
  }

  const { data: bruto, error: err } = await query
  if (err) {
    console.error('[ligas] erro ao buscar', err)
    return semCacheCompartilhado(error('Erro ao buscar campeonatos', 500))
  }
  // Lista pública não mostra competição privada (só por link/código). A lista do próprio
  // organizador (já autenticada acima) mostra tudo dele.
  const data = organizadorId ? bruto : semIdsPrivados(bruto as Array<{ id: number }> | null, await idsCompeticoesPrivadas())

  // Só para a listagem do próprio organizador (usada no carrossel da home):
  // anexa local principal e categorias reais em 2 queries em lote (não 1 por
  // liga), evitando N+1. Não usa Liga.categoriasConfig (taxonomia solta,
  // preenchida livremente pelo organizador) — as categorias vêm das Equipe
  // de fato inscritas, garantindo que o badge sempre corresponda a dados
  // reais e filtráveis em /classificacao.
  if (organizadorId && Array.isArray(data) && data.length > 0) {
    const ligaIds = data.map((liga: { id: number }) => liga.id)

    const [{ data: locais }, { data: equipes }] = await Promise.all([
      supabaseAdmin.from('LigaLocal').select('ligaId,nome,endereco,quadra,ordem').in('ligaId', ligaIds).order('ordem', { ascending: true }),
      supabaseAdmin.from('Equipe').select('ligaId,categoria,serie').in('ligaId', ligaIds),
    ])

    const localPorLiga = new Map<number, { nome: string; endereco: string | null; quadra: string | null }>()
    for (const local of locais ?? []) {
      if (!localPorLiga.has(local.ligaId)) {
        localPorLiga.set(local.ligaId, { nome: local.nome, endereco: local.endereco, quadra: local.quadra })
      }
    }

    const categoriasPorLiga = new Map<number, Set<string>>()
    for (const equipe of equipes ?? []) {
      if (!equipe.categoria) continue
      const key = `${equipe.categoria}::${equipe.serie ?? ''}`
      if (!categoriasPorLiga.has(equipe.ligaId)) categoriasPorLiga.set(equipe.ligaId, new Set())
      categoriasPorLiga.get(equipe.ligaId)!.add(key)
    }

    const enriched = data.map((liga: { id: number }) => ({
      ...liga,
      localPrincipal: localPorLiga.get(liga.id) ?? null,
      categoriasReais: Array.from(categoriasPorLiga.get(liga.id) ?? []).map((key) => {
        const [categoria, serie] = key.split('::')
        return { categoria, serie: serie || null }
      }),
    }))

    return semCacheCompartilhado(success(enriched))
  }

  // Sem organizadorId o corpo ignora cookie e sessão. status e q mudam o
  // corpo e entram na URL, que é a chave de cache da CDN.
  if (organizadorId) return semCacheCompartilhado(success(data))
  return comCachePublico(success(data))
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = ligaSchema.safeParse(body)
    if (!parsed.success) return error('Dados inválidos', 422, parsed.error.flatten())

    if (!isSupabaseServiceConfigured) {
      return error('SUPABASE_SERVICE_ROLE_KEY não configurada no Vercel. Necessária para criar campeonatos com RLS ativo.', 500)
    }

    if (parsed.data.organizadorId) {
      const auth = await requireOrganizador(req)
      if (auth instanceof Response) return auth
      if (auth.userId !== parsed.data.organizadorId) {
        return error('Você não pode criar campeonato para outro organizador.', 403)
      }
    } else {
      const authErr = await requireAuth(req)
      if (authErr) return authErr
    }

    if (parsed.data.status === 'ENCERRADA') return error('O campeonato nao pode ser criado como encerrado.', 422)

    const validation = validateEliminatoryCapacity(parsed.data)
    if (validation) return error(validation, 422)

    const payload = normalizeLeaguePayload(parsed.data)

    const { data, error: err } = await supabaseAdmin
      .from('Liga')
      .insert(payload)
      .select(LIGA_COLUNAS_PUBLICAS as '*')
      .single()

    if (err) {
      if (err.code === '23505') return error('Já existe um campeonato com este link.', 409)
      throw err
    }

    return success(data, 201)
  } catch (err) {
    console.error('[ligas] erro ao criar', err)
    return error('Erro ao criar campeonato', 500)
  }
}

function normalizeLeaguePayload(data: any) {
  const formato = data.formato === 'COPA_CURTA' ? 'MATA_MATA' : data.formato
  // Sem formato definido (criação mínima pelo painel, que agora só pede nome
  // e datas), não inventar uma fase eliminatória: defaultar para SEMIFINAL
  // faria a Prévia nascer "requer atenção" num campeonato recém-criado, já
  // que a validação cruzada exigiria 4 classificados que ninguém configurou.
  const faseEliminatoria = !formato || formato === 'PONTOS_CORRIDOS'
    ? 'NENHUMA'
    : normalizeEliminatoryPhase(data.faseEliminatoria || 'SEMIFINAL')

  return { ...data, formato, faseEliminatoria, status: data.status || 'EM_BREVE' }
}

