import { classificarPorGrupos, type PartidaClassificacao } from '@/lib/classificacao'
import { supabaseAdmin } from '@/lib/supabase-admin'

type LinhaComEquipe = {
  equipeId: number
  pontos?: number | null
  jogos?: number | null
  vitorias?: number | null
  derrotas?: number | null
  setsPro?: number | null
  setsContra?: number | null
  pontosPro?: number | null
  pontosContra?: number | null
  categoriaCampeonatoId?: string | null
  categoria?: string | null
}

export async function montarTabelasDeGrupo<T extends LinhaComEquipe>(ligaId: number, categoriaId: string | null, linhas: T[]) {
  let gruposQuery = supabaseAdmin
    .from('GrupoCampeonato')
    .select('id,nome,ordem,classificados')
    .eq('ligaId', ligaId)
    .order('ordem', { ascending: true })
  let vinculosQuery = supabaseAdmin
    .from('GrupoEquipeCampeonato')
    .select('grupoId,equipeId')
    .eq('ligaId', ligaId)
  let partidasQuery = supabaseAdmin
    .from('Partida')
    .select('equipeAId,equipeBId,setsPorA,setsPorB,pontosPorA,pontosPorB,status,vencedorId,fase,sumulaAprovadaEm,sumulaSubmetidaEm')
    .eq('ligaId', ligaId)
  if (categoriaId) {
    gruposQuery = gruposQuery.eq('categoriaCampeonatoId', categoriaId)
    vinculosQuery = vinculosQuery.eq('categoriaCampeonatoId', categoriaId)
    partidasQuery = partidasQuery.eq('categoriaCampeonatoId', categoriaId)
  }

  const [gruposResposta, vinculosResposta, partidasResposta] = await Promise.all([gruposQuery, vinculosQuery, partidasQuery])
  if (gruposResposta.error || vinculosResposta.error || partidasResposta.error) return []
  const grupos = gruposResposta.data ?? []
  if (grupos.length < 2) return []

  const porGrupo = new Map<number, number[]>()
  for (const vinculo of vinculosResposta.data ?? []) {
    const lista = porGrupo.get(Number(vinculo.grupoId)) ?? []
    lista.push(Number(vinculo.equipeId))
    porGrupo.set(Number(vinculo.grupoId), lista)
  }
  const porEquipe = new Map(linhas.map((linha) => [Number(linha.equipeId), linha]))
  const acumulados = linhas.map((linha) => ({
    equipeId: Number(linha.equipeId),
    categoriaCampeonatoId: linha.categoriaCampeonatoId ?? null,
    categoria: linha.categoria ?? '',
    pontos: Number(linha.pontos ?? 0),
    jogos: Number(linha.jogos ?? 0),
    vitorias: Number(linha.vitorias ?? 0),
    derrotas: Number(linha.derrotas ?? 0),
    setsPro: Number(linha.setsPro ?? 0),
    setsContra: Number(linha.setsContra ?? 0),
    pontosPro: Number(linha.pontosPro ?? 0),
    pontosContra: Number(linha.pontosContra ?? 0),
  }))
  const ranque = classificarPorGrupos({
    linhas: acumulados,
    partidas: (partidasResposta.data ?? []) as PartidaClassificacao[],
    grupos: grupos.map((grupo) => ({
      id: grupo.id,
      nome: grupo.nome,
      equipeIds: porGrupo.get(Number(grupo.id)) ?? [],
      automaticLimit: Number(grupo.classificados ?? 0) > 0 ? Number(grupo.classificados) : 2,
    })),
  })

  return ranque
    .map((grupo) => ({
      id: grupo.id,
      nome: grupo.nome,
      automaticLimit: grupo.automaticLimit,
      linhas: grupo.linhas
        .map((linha) => {
          const original = porEquipe.get(linha.equipeId)
          return original ? { ...original, posicao: linha.posicao } : null
        })
        .filter((linha): linha is T & { posicao: number } => Boolean(linha)),
    }))
    .filter((grupo) => grupo.linhas.length > 0)
}
