import { lerTodasAsLinhas } from '@/lib/leitura-paginada'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  CACHE_RANKING_JOGADORES_MS,
  classificarJogadores,
  TIPOS_FUNDAMENTO_CONSULTA,
  type AtletaRanking,
  type ClassificacaoJogadores,
  type LanceRanking,
} from '@/lib/classificacao-jogadores'

export type ClassificacaoJogadoresLida = ClassificacaoJogadores & { atualizadoEm: string }

type ResultadoLeitura = ClassificacaoJogadoresLida | { erro: string; status: number }

type Guardado = { expira: number; corpo: ClassificacaoJogadoresLida }

const cache = new Map<string, Guardado>()
const emVoo = new Map<string, Promise<ResultadoLeitura>>()

export function limparCacheClassificacaoJogadores() {
  cache.clear()
  emVoo.clear()
}

export async function lerClassificacaoJogadores(ligaId: number, categoriaId: string | null): Promise<ResultadoLeitura> {
  const chave = `${ligaId}:${categoriaId ?? ''}`
  const agora = Date.now()
  const guardado = cache.get(chave)
  if (guardado && guardado.expira > agora) return guardado.corpo
  if (guardado) cache.delete(chave)

  const voo = emVoo.get(chave)
  if (voo) return voo

  const promessa = consultar(ligaId, categoriaId)
    .then((corpo) => {
      if (!('erro' in corpo)) cache.set(chave, { expira: Date.now() + CACHE_RANKING_JOGADORES_MS, corpo })
      return corpo
    })
    .finally(() => {
      emVoo.delete(chave)
    })
  emVoo.set(chave, promessa)
  return promessa
}

async function consultar(ligaId: number, categoriaId: string | null): Promise<ResultadoLeitura> {
  const { data: liga, error: falhaLiga } = await supabaseAdmin.from('Liga').select('id').eq('id', ligaId).maybeSingle()
  if (falhaLiga) throw falhaLiga
  if (!liga) return { erro: 'Campeonato não encontrado.', status: 404 }

  const equipes = await listarEquipes(ligaId, categoriaId)
  const atletas = await listarAtletas(equipes)
  const lances = await listarLances(ligaId, categoriaId)
  return {
    ...classificarJogadores(atletas, lances),
    atualizadoEm: new Date().toISOString(),
  }
}

type EquipeLinha = { id: number; nome: string | null; logoUrl?: string | null; corHex?: string | null }

// OcorrenciaPartida não tem coluna de criação nem de atualização.
const COLUNAS_LANCE = 'tipo,jogadorId,descricao,partida:Partida!inner(ligaId,categoriaCampeonatoId)'
const COLUNAS_JOGADOR = 'id,nome,numero,equipeId,banido'
const COLUNAS_EQUIPE = 'id,nome,logoUrl,corHex,categoriaCampeonatoId'

async function listarEquipes(ligaId: number, categoriaId: string | null) {
  const linhas = await lerTodasAsLinhas<EquipeLinha>(() => {
    let consulta = supabaseAdmin.from('Equipe').select(COLUNAS_EQUIPE).eq('ligaId', ligaId)
    if (categoriaId) consulta = consulta.eq('categoriaCampeonatoId', categoriaId)
    return consulta
  })
  return linhas
}

async function listarAtletas(equipes: EquipeLinha[]): Promise<AtletaRanking[]> {
  const porEquipe = new Map(equipes.map((equipe) => [equipe.id, equipe]))
  const ids = equipes.map((equipe) => equipe.id)
  const atletas: AtletaRanking[] = []
  for (let inicio = 0; inicio < ids.length; inicio += 80) {
    const fatia = ids.slice(inicio, inicio + 80)
    const lote = await lerTodasAsLinhas(() => supabaseAdmin
      .from('Jogador')
      .select(COLUNAS_JOGADOR)
      .in('equipeId', fatia)
      .eq('banido', false))
    for (const jogador of lote) {
        const equipeId = Number(jogador.equipeId)
        const equipe = porEquipe.get(equipeId)
        atletas.push({
          id: Number(jogador.id),
          nome: String(jogador.nome ?? ''),
          equipe: String(equipe?.nome ?? '').trim() || 'Equipe',
          numero: jogador.numero,
          logoUrl: equipe?.logoUrl ?? null,
          corHex: equipe?.corHex ?? null,
        })
      }
  }
  return atletas
}

async function listarLances(ligaId: number, categoriaId: string | null): Promise<LanceRanking[]> {
  const lote = await lerTodasAsLinhas<{ tipo?: string | null; jogadorId?: number | null; descricao?: string | null }>(() => {
    let consulta = supabaseAdmin
      .from('OcorrenciaPartida')
      .select(COLUNAS_LANCE)
      .eq('partida.ligaId', ligaId)
      .in('tipo', TIPOS_FUNDAMENTO_CONSULTA)
      .not('jogadorId', 'is', null)
    if (categoriaId) consulta = consulta.eq('partida.categoriaCampeonatoId', categoriaId)
    return consulta
  })
  return lote.map((item) => ({
    tipo: String(item.tipo ?? ''),
    jogadorId: item.jogadorId == null ? null : Number(item.jogadorId),
    descricao: item.descricao == null ? null : String(item.descricao),
    campeonatoExiste: true,
  }))
}
