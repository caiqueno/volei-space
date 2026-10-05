import { supabaseAdmin } from '@/lib/supabase-admin'
import { campeonatoDeTeste } from '@/lib/campeonato-teste'

export type CampeonatoCapa = {
  id: number
  nome: string
  slug: string
  subtitulo: string | null
  capaUrl: string | null
  logoUrl: string | null
}

const COLUNAS = 'id,nome,slug,subtitulo,capaUrl,logoUrl,descricao,simulacao'

export async function listarCampeonatosPublicos(opcoes?: { busca?: string; offset?: number; limite?: number }) {
  const limite = Math.min(24, Math.max(1, opcoes?.limite ?? 12))
  const offset = Math.max(0, opcoes?.offset ?? 0)
  const busca = opcoes?.busca?.trim().slice(0, 60) ?? ''
  let consulta = supabaseAdmin
    .from('Liga')
    .select(COLUNAS)
    .eq('simulacao', false)
    .order('criadoEm', { ascending: false })
  if (busca) consulta = consulta.ilike('nome', `%${busca.replace(/[%_]/g, '')}%`)

  const { data, error } = await consulta.range(offset, offset + 39)
  if (error) return { campeonatos: [] as CampeonatoCapa[], temMais: false, proximoOffset: offset, erro: true }
  const linhas = data ?? []
  const campeonatos: CampeonatoCapa[] = []
  let proximoOffset = offset + linhas.length
  for (let indice = 0; indice < linhas.length; indice += 1) {
    const liga = linhas[indice]
    if (campeonatoDeTeste(liga)) continue
    if (campeonatos.length === limite) {
      proximoOffset = offset + indice
      break
    }
    campeonatos.push({
      id: liga.id,
      nome: liga.nome,
      slug: liga.slug,
      subtitulo: liga.subtitulo ?? null,
      capaUrl: liga.capaUrl ?? null,
      logoUrl: liga.logoUrl ?? null,
    })
  }
  return {
    campeonatos,
    temMais: campeonatos.length === limite && proximoOffset < offset + linhas.length || linhas.length === 40 && campeonatos.length === limite,
    proximoOffset,
    erro: false,
  }
}
