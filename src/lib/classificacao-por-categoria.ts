import { montarTabelasDeGrupo } from '@/lib/classificacao-grupos'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { montarTabelasPorCategoria, type EntradaBruta, type LinhaClassificacao, type TabelaCategoria } from '@/lib/operacao-categoria'

export async function carregarClassificacaoPorCategoria(
  ligaId: number,
  categoriaId: string | null,
): Promise<{ tabelas: TabelaCategoria[] } | { erro: string; status: number }> {
  const categoriasConsulta = await supabaseAdmin
    .from('CategoriaCampeonato')
    .select('id,nome,ordem')
    .eq('ligaId', ligaId)
    .is('removidaEm', null)
    .order('ordem', { ascending: true })
  if (categoriasConsulta.error) return { erro: 'Não foi possível consultar as categorias.', status: 503 }
  const categorias = (categoriasConsulta.data ?? []) as { id: string; nome: string }[]
  if (categoriaId && !categorias.some((categoria) => categoria.id === categoriaId)) {
    return { erro: 'Categoria não encontrada neste campeonato.', status: 404 }
  }
  const alvos = categoriaId ? categorias.filter((categoria) => categoria.id === categoriaId) : categorias

  let entradas = supabaseAdmin
    .from('ClassificacaoEntrada')
    .select('equipeId,categoriaCampeonatoId,posicao,pontos,jogos,vitorias,derrotas,setsPro,setsContra,pontosPro,pontosContra,punicoes,equipe:Equipe(id,nome,corHex,logoUrl)')
    .eq('ligaId', ligaId)
    .order('posicao', { ascending: true })
  let equipes = supabaseAdmin
    .from('Equipe')
    .select('id,nome,corHex,logoUrl,categoriaCampeonatoId')
    .eq('ligaId', ligaId)
    .eq('statusEquipe', 'ATIVA')
    .order('nome', { ascending: true })
  let partidas = supabaseAdmin
    .from('Partida')
    .select('categoriaCampeonatoId,fase,status,sumulaSubmetidaEm,sumulaAprovadaEm,vencedorId')
    .eq('ligaId', ligaId)
  let configs = supabaseAdmin
    .from('CategoriaConfiguracao')
    .select('categoriaCampeonatoId,formato,quantidadeGrupos,classificadosPorGrupo,melhoresClassificadosGerais,faseEliminatoria')
    .eq('ligaId', ligaId)
  let manuais = supabaseAdmin
    .from('ClassificacaoEliminatoria')
    .select('equipeId,categoriaCampeonatoId')
    .eq('ligaId', ligaId)
  let grupos = supabaseAdmin
    .from('GrupoCampeonato')
    .select('id,nome,classificados,categoriaCampeonatoId')
    .eq('ligaId', ligaId)
    .order('ordem', { ascending: true })
  let vinculos = supabaseAdmin
    .from('GrupoEquipeCampeonato')
    .select('grupoId,equipeId,categoriaCampeonatoId,posicao')
    .eq('ligaId', ligaId)
    .order('posicao', { ascending: true })
  if (categoriaId) {
    entradas = entradas.eq('categoriaCampeonatoId', categoriaId)
    equipes = equipes.eq('categoriaCampeonatoId', categoriaId)
    partidas = partidas.eq('categoriaCampeonatoId', categoriaId)
    configs = configs.eq('categoriaCampeonatoId', categoriaId)
    manuais = manuais.eq('categoriaCampeonatoId', categoriaId)
    grupos = grupos.eq('categoriaCampeonatoId', categoriaId)
    vinculos = vinculos.eq('categoriaCampeonatoId', categoriaId)
  }

  const ligaConsulta = categorias.length > 0
    ? Promise.resolve({ data: null, error: null })
    : supabaseAdmin
      .from('Liga')
      .select('formato,quantidadeGrupos,classificadosPorGrupo,melhoresClassificadosGerais,faseEliminatoria')
      .eq('id', ligaId)
      .maybeSingle()

  const [entradasRes, equipesRes, partidasRes, configsRes, manuaisRes, gruposRes, vinculosRes, ligaRes] = await Promise.all([
    entradas,
    equipes,
    partidas,
    configs,
    manuais,
    grupos,
    vinculos,
    ligaConsulta,
  ])
  if (entradasRes.error || equipesRes.error || partidasRes.error || configsRes.error || manuaisRes.error || gruposRes.error || vinculosRes.error || ligaRes.error) {
    return { erro: 'Não foi possível carregar a classificação.', status: 500 }
  }

  const tabelas = montarTabelasPorCategoria({
    categorias: alvos,
    configs: configsRes.data ?? [],
    liga: ligaRes.data,
    entradas: (entradasRes.data ?? []) as EntradaBruta[],
    equipesAtivas: equipesRes.data ?? [],
    partidas: partidasRes.data ?? [],
    grupos: gruposRes.data ?? [],
    vinculos: vinculosRes.data ?? [],
    manuais: manuaisRes.data ?? [],
  })
  return { tabelas: await Promise.all(tabelas.map((tabela) => ranquearGrupos(ligaId, tabela))) }
}

async function ranquearGrupos(ligaId: number, tabela: TabelaCategoria): Promise<TabelaCategoria> {
  const linhas = tabela.linhas.map((linha) => ({
    equipeId: linha.equipe.id,
    categoriaCampeonatoId: tabela.id,
    pontos: linha.pontos,
    jogos: linha.jogos,
    vitorias: linha.vitorias,
    derrotas: linha.derrotas,
    setsPro: linha.setsPro,
    setsContra: linha.setsContra,
    pontosPro: linha.pontosPro,
    pontosContra: linha.pontosContra,
    punicoes: linha.punicoes,
  }))
  const ranque = await montarTabelasDeGrupo(ligaId, tabela.id, linhas)
  if (ranque.length === 0) return tabela
  const porEquipe = new Map(tabela.linhas.map((linha) => [linha.equipe.id, linha]))
  return {
    ...tabela,
    groups: ranque
      .map((grupo) => ({
        id: String(grupo.id),
        nome: grupo.nome,
        automaticLimit: grupo.automaticLimit,
        dados: grupo.linhas
          .map((linha) => {
            const original = porEquipe.get(Number(linha.equipeId))
            return original ? { ...original, posicao: linha.posicao } : null
          })
          .filter((linha): linha is LinhaClassificacao => Boolean(linha)),
      }))
      .filter((grupo) => grupo.dados.length > 0),
  }
}
