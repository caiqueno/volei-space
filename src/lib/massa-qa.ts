import { randomUUID } from 'crypto'
import { calcularClassificacao, type PartidaClassificacao, type RegrasCategoria, type TimeClassificacao } from '@/lib/classificacao'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { rpcAusente } from '@/lib/rpc-ausente'
import { normalizarNomeEquipe } from '@/lib/nome-equipe'

const MARCA = 'MASSA-QA-2026'
const SLUG = 'massa-qa-2026'
const NOMES_EQUIPE = [
  'Vôlei Alpha',
  'Vôlei Brasil',
  'Arena Masters',
  'Elite Vôlei',
  'Space Volley',
  'Prime Vôlei',
  'Nova Geração',
  'Impacto Volley',
]
const PRIMEIROS = ['Helena', 'Marina', 'Camila', 'Beatriz', 'Larissa', 'Fernanda', 'Juliana', 'Patricia', 'Renata', 'Aline', 'Bruno', 'Diego', 'Eduardo', 'Felipe', 'Gabriel', 'Henrique', 'Igor', 'João', 'Lucas', 'Mateus']
const SOBRENOMES = ['Vargas', 'Costa', 'Nogueira', 'Almeida', 'Ribeiro', 'Cardoso', 'Mendes', 'Teixeira', 'Barbosa', 'Castro', 'Dias', 'Freitas', 'Gomes', 'Lima', 'Martins', 'Pereira', 'Rocha', 'Souza', 'Azevedo', 'Correia']

type EquipeLinha = { id: number; ligaId: number; nome: string; categoriaCampeonatoId?: string | null }
type LigaLinha = { id: number; elencoQuantidadeMaxima: number | null; status?: string | null; organizadorId: string | null; organizacao?: string }

function nomeAtleta(equipeId: number, numero: number) {
  const primeiro = PRIMEIROS[(equipeId + numero) % PRIMEIROS.length]
  const sobrenome = SOBRENOMES[(equipeId * 3 + numero) % SOBRENOMES.length]
  return `${primeiro} ${sobrenome}`
}

function posicaoDo(numero: number, comLibero: boolean) {
  if (comLibero && (numero === 15 || numero === 16)) return 'Líbero'
  if (numero % 6 === 1) return 'Levantador'
  if (numero % 6 === 2) return 'Oposto'
  if (numero % 6 === 3 || numero % 6 === 4) return 'Central'
  return 'Ponteiro'
}

function alvoElenco(maximo: number | null) {
  if (maximo != null && maximo > 0 && maximo < 20) return maximo
  return 20
}

async function paginar<T>(tabela: string, colunas: string, pagina = 1000): Promise<T[]> {
  const linhas: T[] = []
  for (let offset = 0; ; offset += pagina) {
    const { data, error } = await supabaseAdmin.from(tabela).select(colunas).range(offset, offset + pagina - 1)
    if (error) throw new Error(error.message)
    const lote = (data ?? []) as T[]
    linhas.push(...lote)
    if (lote.length < pagina) return linhas
  }
}

export async function auditarMassa() {
  const [equipes, jogadores, ligas, partidas] = await Promise.all([
    paginar<EquipeLinha>('Equipe', 'id,ligaId,nome,categoriaCampeonatoId'),
    paginar<{ equipeId: number; seedKey: string | null }>('Jogador', 'equipeId,seedKey'),
    paginar<{ id: number; nome: string; status: string; quantidadeEquipes: number | null; simulacao: boolean | null }>('Liga', 'id,nome,status,quantidadeEquipes,simulacao'),
    paginar<{ status: string; ligaId: number }>('Partida', 'status,ligaId'),
  ])
  const porEquipe = new Map<number, number>()
  for (const jogador of jogadores) porEquipe.set(jogador.equipeId, (porEquipe.get(jogador.equipeId) ?? 0) + 1)
  const faixas = { zero: 0, ate5: 0, ate11: 0, ate19: 0, vinteOuMais: 0 }
  for (const equipe of equipes) {
    const total = porEquipe.get(equipe.id) ?? 0
    if (total === 0) faixas.zero += 1
    else if (total <= 5) faixas.ate5 += 1
    else if (total <= 11) faixas.ate11 += 1
    else if (total <= 19) faixas.ate19 += 1
    else faixas.vinteOuMais += 1
  }
  const vazias = equipes.filter((equipe) => (porEquipe.get(equipe.id) ?? 0) === 0)
  const porStatus = new Map<string, number>()
  for (const partida of partidas) porStatus.set(partida.status, (porStatus.get(partida.status) ?? 0) + 1)
  const timesPorLiga = new Map<number, number>()
  for (const equipe of equipes) timesPorLiga.set(equipe.ligaId, (timesPorLiga.get(equipe.ligaId) ?? 0) + 1)
  const copa = ligas.find((liga) => liga.nome === 'Copa Massa QA')
  return {
    equipes: equipes.length,
    jogadores: jogadores.length,
    equipesSemJogador: vazias.length,
    faixasElenco: faixas,
    partidas: partidas.length,
    partidasPorStatus: Object.fromEntries(porStatus),
    copaId: copa?.id ?? null,
    campeonatosAbaixoDaQuantidade: ligas
      .filter((liga) => liga.quantidadeEquipes && (timesPorLiga.get(liga.id) ?? 0) < liga.quantidadeEquipes)
      .slice(0, 30)
      .map((liga) => ({ id: liga.id, nome: liga.nome, pedido: liga.quantidadeEquipes, equipes: timesPorLiga.get(liga.id) ?? 0, status: liga.status })),
  }
}

export async function preencherEquipesVazias(limite: number) {
  const [equipes, jogadores, ligas] = await Promise.all([
    paginar<EquipeLinha>('Equipe', 'id,ligaId,nome,categoriaCampeonatoId'),
    paginar<{ equipeId: number; numero: number | null; seedKey: string | null }>('Jogador', 'equipeId,numero,seedKey'),
    paginar<LigaLinha>('Liga', 'id,elencoQuantidadeMaxima,status'),
  ])
  const maximo = new Map(ligas.map((liga) => [liga.id, liga.elencoQuantidadeMaxima]))
  const finalizadas = new Set(ligas.filter((liga) => ['FINALIZADO', 'ENCERRADA'].includes(String(liga.status ?? '').toUpperCase())).map((liga) => liga.id))
  const porEquipe = new Map<number, { total: number; massa: number; numeros: Set<number> }>()
  for (const jogador of jogadores) {
    const atual = porEquipe.get(jogador.equipeId) ?? { total: 0, massa: 0, numeros: new Set<number>() }
    atual.total += 1
    if (jogador.seedKey === MARCA) atual.massa += 1
    if (jogador.numero) atual.numeros.add(jogador.numero)
    porEquipe.set(jogador.equipeId, atual)
  }
  const pendentes = equipes.filter((equipe) => {
    if (!equipe.categoriaCampeonatoId || finalizadas.has(equipe.ligaId)) return false
    const atual = porEquipe.get(equipe.id)
    return (atual?.total ?? 0) < alvoElenco(maximo.get(equipe.ligaId) ?? null)
  })
  const lote = pendentes.slice(0, limite)
  const linhas: Array<Record<string, unknown>> = []
  for (const equipe of lote) {
    const atual = porEquipe.get(equipe.id) ?? { total: 0, massa: 0, numeros: new Set<number>() }
    const alvo = alvoElenco(maximo.get(equipe.ligaId) ?? null)
    const comLibero = equipe.id % 5 !== 0
    let faltam = alvo - atual.total
    for (let numero = 1; numero <= alvo && faltam > 0; numero += 1) {
      if (atual.numeros.has(numero)) continue
      faltam -= 1
      linhas.push({
        nome: nomeAtleta(equipe.id, numero),
        numero,
        posicao: posicaoDo(numero, comLibero),
        equipeId: equipe.id,
        seedKey: `${MARCA}-${equipe.id}-${numero}`,
        autoRegistrado: false,
      })
    }
  }
  for (let i = 0; i < linhas.length; i += 200) {
    const { error } = await supabaseAdmin.from('Jogador').insert(linhas.slice(i, i + 200))
    if (error) throw new Error(error.message)
  }
  return { equipesPreenchidas: lote.length, jogadoresCriados: linhas.length, equipesAindaVazias: Math.max(pendentes.length - lote.length, 0) }
}

function placar(set: number, total: number, aVenceSet: boolean): [number, number] {
  const apertados: Array<[number, number]> = [[25, 23], [25, 22], [26, 24], [25, 21], [23, 25], [22, 25]]
  if (set === total && total === 5) return aVenceSet ? [15, 13] : [13, 15]
  const base = apertados[(set + total) % apertados.length]
  const aMaior = base[0] >= base[1] ? base : [base[1], base[0]] as [number, number]
  return aVenceSet ? aMaior : [aMaior[1], aMaior[0]]
}

function setsDaPartida(indice: number, aVence: boolean) {
  const sequenciaA = indice % 4 === 0
    ? [true, false, true, false, true]
    : indice % 3 === 0
      ? [true, true, false, true]
      : [true, true, true]
  return sequenciaA.map((aGanha, set) => placar(set + 1, sequenciaA.length, aVence ? aGanha : !aGanha))
}

export async function gravarClassificacao(ligaId: number) {
  for (let tentativa = 0; tentativa < 3; tentativa += 1) {
    const antes = await marcaDasPartidas(ligaId)
    const gravadas = await gravarClassificacaoUmaVez(ligaId)
    const depois = await marcaDasPartidas(ligaId)
    if (antes === depois || tentativa === 2) return gravadas
  }
  return 0
}

async function marcaDasPartidas(ligaId: number) {
  const { data, error } = await supabaseAdmin
    .from('Partida')
    .select('id,status,setsPorA,setsPorB,vencedorId,fase')
    .eq('ligaId', ligaId)
    .order('id', { ascending: true })
  if (error) throw new Error(error.message)
  return JSON.stringify(data ?? [])
}

async function gravarClassificacaoUmaVez(ligaId: number) {
  const { data: inscricoes, error: falhaInscricoes } = await supabaseAdmin
    .from('InscricaoCampeonato')
    .select('equipeId,equipe:Equipe(id,categoria,categoriaCampeonatoId,statusEquipe)')
    .eq('ligaId', ligaId)
    .eq('status', 'APROVADA')
  if (falhaInscricoes) throw new Error(falhaInscricoes.message)

  const { data: partidas, error: falhaPartidas } = await supabaseAdmin
    .from('Partida')
    .select('equipeAId,equipeBId,setsPorA,setsPorB,pontosPorA,pontosPorB,status,vencedorId,fase,categoriaCampeonatoId,sumulaAprovadaEm,sumulaSubmetidaEm,sets:SetPartida(numero,pontosA,pontosB)')
    .eq('ligaId', ligaId)
  if (falhaPartidas) throw new Error(falhaPartidas.message)

  const regrasCategoria = await listarRegrasDeCategoria(ligaId)
  const liga = await lerRegrasDeLiga(ligaId)

  const times: TimeClassificacao[] = []
  for (const inscricao of inscricoes ?? []) {
    const equipe = Array.isArray(inscricao.equipe) ? inscricao.equipe[0] : inscricao.equipe
    if (!equipe?.id) continue
    if (equipe.statusEquipe && equipe.statusEquipe !== 'ATIVA') continue
    times.push({
      equipeId: equipe.id,
      categoriaCampeonatoId: equipe.categoriaCampeonatoId ?? null,
      categoria: equipe.categoria || '',
    })
  }

  const regras: Record<string, RegrasCategoria> = {}
  if (liga) {
    regras[''] = {
      criterios: liga.criteriosClassificacao,
      set: regraDeSetGravada(liga, 25),
    }
  }
  for (const regra of regrasCategoria) {
    regras[regra.categoriaCampeonatoId] = {
      faixas: {
        pontosVencedorMargem1: Number(regra.pontosVencedorMargem1 ?? 2),
        pontosPerdedorMargem1: Number(regra.pontosPerdedorMargem1 ?? 1),
        pontosVencedorMargem2: Number(regra.pontosVencedorMargem2 ?? 3),
        pontosPerdedorMargem2: Number(regra.pontosPerdedorMargem2 ?? 0),
      },
      criterios: regra.criteriosClassificacao,
      wo: {
        setsVencedor: regra.woSetsVencedor ?? null,
        setsPerdedor: regra.woSetsPerdedor ?? null,
        pontosSetVencedor: regra.woPontosSetVencedor ?? null,
        pontosSetPerdedor: regra.woPontosSetPerdedor ?? null,
        punicaoPontos: regra.woPunicaoPontos ?? 0,
      },
      set: {
        ...regraDeSetGravada(regra, 21),
        setsFormato: regra.setsFormato ?? undefined,
        terceiroSetObrigatorio: regra.terceiroSetObrigatorio === true,
      },
    }
  }

  const ranque = calcularClassificacao({
    times,
    partidas: (partidas ?? []) as PartidaClassificacao[],
    regras,
  })
  const linhas = ranque.map((linha) => ({
    equipeId: linha.equipeId,
    categoriaCampeonatoId: linha.categoriaCampeonatoId,
    categoria: linha.categoria,
    posicao: linha.posicao,
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
  const gravacao = await supabaseAdmin.rpc('gravar_classificacao_calculada', {
    p_liga_id: ligaId,
    p_linhas: linhas,
  })
  if (!gravacao.error) return ranque.length
  if (!rpcAusente(gravacao.error)) throw new Error(gravacao.error.message)
  console.error('[classificacao] RPC gravar_classificacao_calculada ausente; gravação sem trava')
  await gravarClassificacaoSemTrava(ligaId, linhas)
  return ranque.length
}

const CAMPOS_REGRA_CATEGORIA = 'categoriaCampeonatoId,setsPorPartida,pontosPorSet,tieBreakUltimoSet,pontosUltimoSet,diferencaMinimaSet,setsFormato,terceiroSetObrigatorio,pontosVencedorMargem1,pontosPerdedorMargem1,pontosVencedorMargem2,pontosPerdedorMargem2,criteriosClassificacao'
const CAMPOS_REGRA_LIGA = 'setsPorPartida,pontosPorSet,tieBreakUltimoSet,pontosUltimoSet,diferencaMinimaSet,setsFormato,criteriosClassificacao'
const CAMPOS_FASE = 'setsPorPartidaFinal,setsPorPartidaSemifinal,setsPorPartidaTerceiroLugar'
const CAMPOS_WO = 'woSetsVencedor,woSetsPerdedor,woPontosSetVencedor,woPontosSetPerdedor,woPunicaoPontos'

type RegraCategoriaLida = {
  categoriaCampeonatoId: string
  setsPorPartida?: number | null
  pontosPorSet?: number | null
  tieBreakUltimoSet?: boolean | null
  pontosUltimoSet?: number | null
  diferencaMinimaSet?: number | null
  setsFormato?: string | null
  terceiroSetObrigatorio?: boolean | null
  pontosVencedorMargem1?: number | null
  pontosPerdedorMargem1?: number | null
  pontosVencedorMargem2?: number | null
  pontosPerdedorMargem2?: number | null
  criteriosClassificacao?: string[] | string | null
  setsPorPartidaFinal?: number | null
  setsPorPartidaSemifinal?: number | null
  setsPorPartidaTerceiroLugar?: number | null
  woSetsVencedor?: number | null
  woSetsPerdedor?: number | null
  woPontosSetVencedor?: number | null
  woPontosSetPerdedor?: number | null
  woPunicaoPontos?: number | null
}

function colunaOpcionalAusente(erro: { message?: string; code?: string; details?: string } | null) {
  const texto = `${erro?.code ?? ''} ${erro?.message ?? ''} ${erro?.details ?? ''}`
  return /setsPorPartida(Final|Semifinal|TerceiroLugar)|woSetsVencedor|woPunicaoPontos|PGRST204|42703/i.test(texto)
}

async function listarRegrasDeCategoria(ligaId: number): Promise<RegraCategoriaLida[]> {
  const tentativas = [
    `${CAMPOS_REGRA_CATEGORIA},${CAMPOS_FASE},${CAMPOS_WO}`,
    `${CAMPOS_REGRA_CATEGORIA},${CAMPOS_FASE}`,
    `${CAMPOS_REGRA_CATEGORIA},${CAMPOS_WO}`,
    CAMPOS_REGRA_CATEGORIA,
  ]
  let ultimo: { message?: string } | null = null
  for (const colunas of tentativas) {
    const resposta = await supabaseAdmin.from('CategoriaConfiguracao').select(colunas).eq('ligaId', ligaId)
    if (!resposta.error) return (resposta.data ?? []) as unknown as RegraCategoriaLida[]
    ultimo = resposta.error
    if (!colunaOpcionalAusente(resposta.error)) throw new Error(resposta.error.message)
  }
  throw new Error(ultimo?.message ?? 'Não foi possível ler a configuração da categoria.')
}

async function lerRegrasDeLiga(ligaId: number) {
  const cheia = await supabaseAdmin.from('Liga').select(`${CAMPOS_REGRA_LIGA},${CAMPOS_FASE}`).eq('id', ligaId).maybeSingle()
  if (!cheia.error) return cheia.data
  if (!colunaOpcionalAusente(cheia.error)) throw new Error(cheia.error.message)
  const base = await supabaseAdmin.from('Liga').select(CAMPOS_REGRA_LIGA).eq('id', ligaId).maybeSingle()
  if (base.error) throw new Error(base.error.message)
  return base.data
}

function regraDeSetGravada(regra: { [key: string]: any }, pontosPadrao: number) {
  return {
    setsPorPartida: Number(regra.setsPorPartida) > 0 ? Number(regra.setsPorPartida) : 3,
    pontosPorSet: Number(regra.pontosPorSet) > 0 ? Number(regra.pontosPorSet) : pontosPadrao,
    tieBreakUltimoSet: regra.tieBreakUltimoSet === true,
    pontosUltimoSet: Number(regra.pontosUltimoSet) > 0 ? Number(regra.pontosUltimoSet) : 15,
    diferencaMinimaSet: Number(regra.diferencaMinimaSet) > 0 ? Number(regra.diferencaMinimaSet) : 2,
    setsPorPartidaFinal: regra.setsPorPartidaFinal ?? null,
    setsPorPartidaSemifinal: regra.setsPorPartidaSemifinal ?? null,
    setsPorPartidaTerceiroLugar: regra.setsPorPartidaTerceiroLugar ?? null,
  }
}

async function gravarClassificacaoSemTrava(ligaId: number, linhas: Array<Record<string, unknown>>) {
  if (linhas.length > 0) {
    const { error } = await supabaseAdmin.from('ClassificacaoEntrada').upsert(linhas.map((linha) => ({
      ...linha,
      ligaId,
      serie: null,
      punicoes: linha.punicoes ?? 0,
      atualizadoEm: new Date().toISOString(),
    })), { onConflict: 'ligaId,equipeId' })
    if (error) throw new Error(error.message)
  }
  const ids = linhas.map((linha) => Number(linha.equipeId))
  const apagar = supabaseAdmin.from('ClassificacaoEntrada').delete().eq('ligaId', ligaId)
  const { error: erroApagar } = ids.length > 0 ? await apagar.not('equipeId', 'in', `(${ids.join(',')})`) : await apagar
  if (erroApagar) throw new Error(erroApagar.message)
}

export async function criarCopaMassa() {
  const { data: existente, error: falhaBusca } = await supabaseAdmin.from('Liga').select('id').eq('slug', SLUG).maybeSingle()
  if (falhaBusca) throw new Error(falhaBusca.message)
  if (existente?.id) {
    const { count } = await supabaseAdmin.from('Partida').select('id', { count: 'exact', head: true }).eq('ligaId', existente.id)
    if ((count ?? 0) > 0) {
      await gravarClassificacao(existente.id)
      const { error: falhaStatusExistente } = await supabaseAdmin.from('Liga').update({ status: 'FINALIZADO' }).eq('id', existente.id)
      if (falhaStatusExistente) throw new Error(falhaStatusExistente.message)
      return { ligaId: existente.id, criada: false, partidas: count ?? 0 }
    }
  }

  const { data: organizadores, error: falhaOrg } = await supabaseAdmin
    .from('CandidaturaOrganizador')
    .select('id,organizacao')
    .limit(40)
  if (falhaOrg) throw new Error(falhaOrg.message)
  const organizador = (organizadores ?? []).find((item) => String(item.organizacao ?? '').toLowerCase().includes('teste')) ?? organizadores?.[0]
  if (!organizador?.id) throw new Error('Nenhum organizador encontrado para receber a copa de validação.')

  let ligaId = existente?.id ?? null
  if (!ligaId) {
    const { data: liga, error: falhaLiga } = await supabaseAdmin
      .from('Liga')
      .insert({
        slug: SLUG,
        nome: 'Copa Massa QA',
        descricao: 'Campeonato de validação com jogos equilibrados, súmulas e ranking calculado.',
        status: 'ATIVA',
        simulacao: false,
        organizadorId: organizador.id,
        quantidadeEquipes: 8,
        formato: 'PONTOS_CORRIDOS',
        setsPorPartida: 5,
        pontosPorSet: 25,
        inscricoesAbertas: false,
      })
      .select('id')
      .single()
    if (falhaLiga || !liga) throw new Error(falhaLiga?.message ?? 'Não foi possível criar a copa.')
    ligaId = liga.id
  }

  const { data: categoriaExistente, error: falhaCategoriaBusca } = await supabaseAdmin
    .from('CategoriaCampeonato')
    .select('id')
    .eq('ligaId', ligaId)
    .eq('codigo', 'MASC')
    .maybeSingle()
  if (falhaCategoriaBusca) throw new Error(falhaCategoriaBusca.message)
  let categoriaId = categoriaExistente?.id ?? null
  if (!categoriaId) {
    categoriaId = randomUUID()
    const { error: falhaCategoria } = await supabaseAdmin.from('CategoriaCampeonato').insert({
      id: categoriaId,
      ligaId,
      codigo: 'MASC',
      nome: 'Masculino',
      slug: 'masculino',
      statusConfiguracao: 'CONCLUIDA',
    })
    if (falhaCategoria) throw new Error(falhaCategoria.message)
  }

  const { data: equipesAtuais, error: falhaEquipesAtuais } = await supabaseAdmin.from('Equipe').select('id,nome').eq('ligaId', ligaId)
  if (falhaEquipesAtuais) throw new Error(falhaEquipesAtuais.message)
  const faltantes = NOMES_EQUIPE.filter((nome) => {
    const alvo = normalizarNomeEquipe(nome)
    return !(equipesAtuais ?? []).some((equipe) => normalizarNomeEquipe(equipe.nome) === alvo)
  })
  if (faltantes.length) {
    const { error: falhaEquipes } = await supabaseAdmin.from('Equipe').insert(faltantes.map((nome) => ({
      nome: normalizarNomeEquipe(nome),
      ligaId,
      categoria: 'MASCULINO',
      serie: null,
      categoriaCampeonatoId: categoriaId,
      statusEquipe: 'ATIVA',
      lider: 'Comissão técnica',
      tecnico: 'Técnico da casa',
    })))
    if (falhaEquipes) throw new Error(falhaEquipes.message)
  }
  const { data: equipes, error: falhaLista } = await supabaseAdmin.from('Equipe').select('id,nome').eq('ligaId', ligaId)
  if (falhaLista || !equipes?.length) throw new Error(falhaLista?.message ?? 'Não foi possível criar as equipes.')
  const { error: falhaVinculo } = await supabaseAdmin.from('Equipe').update({ categoriaCampeonatoId: categoriaId }).eq('ligaId', ligaId).is('categoriaCampeonatoId', null)
  if (falhaVinculo) throw new Error(falhaVinculo.message)
  const times = [...equipes].sort((a, b) => a.id - b.id)

  const idsTimes = times.map((equipe) => equipe.id)
  const { data: atletasAtuais, error: falhaAtletasAtuais } = await supabaseAdmin.from('Jogador').select('equipeId,numero').in('equipeId', idsTimes)
  if (falhaAtletasAtuais) throw new Error(falhaAtletasAtuais.message)
  const numerosAtuais = new Set((atletasAtuais ?? []).map((atleta) => `${atleta.equipeId}:${atleta.numero}`))
  const atletas: Array<Record<string, unknown>> = []
  times.forEach((equipe, indice) => {
    const comLibero = indice !== 4
    for (let numero = 1; numero <= 20; numero += 1) {
      if (numerosAtuais.has(`${equipe.id}:${numero}`)) continue
      atletas.push({
        nome: indice === 0 && numero === 1 ? 'Helena Vargas' : nomeAtleta(equipe.id, numero),
        numero,
        posicao: posicaoDo(numero, comLibero),
        equipeId: equipe.id,
        seedKey: `${MARCA}-${equipe.id}-${numero}`,
        autoRegistrado: false,
      })
    }
  })
  for (let i = 0; i < atletas.length; i += 80) {
    const { error } = await supabaseAdmin.from('Jogador').insert(atletas.slice(i, i + 80))
    if (error) throw new Error(error.message)
  }
  const { data: criados, error: falhaCriados } = await supabaseAdmin.from('Jogador').select('id,equipeId,numero,nome').in('equipeId', idsTimes)
  if (falhaCriados) throw new Error(falhaCriados.message)
  const porTime = new Map<number, Map<number, { id: number; nome: string }>>()
  for (const atleta of criados ?? []) {
    const mapa = porTime.get(atleta.equipeId) ?? new Map()
    mapa.set(atleta.numero, { id: atleta.id, nome: atleta.nome })
    porTime.set(atleta.equipeId, mapa)
  }

  const { data: inscricoesAtuais, error: falhaInscricoesAtuais } = await supabaseAdmin.from('InscricaoCampeonato').select('equipeId').eq('ligaId', ligaId)
  if (falhaInscricoesAtuais) throw new Error(falhaInscricoesAtuais.message)
  const inscritas = new Set((inscricoesAtuais ?? []).map((item) => item.equipeId))
  const inscricoesNovas = times.filter((equipe) => !inscritas.has(equipe.id)).map((equipe) => ({
    id: randomUUID(),
    ligaId,
    equipeId: equipe.id,
    categoriaCampeonatoId: categoriaId,
    status: 'APROVADA',
  }))
  if (inscricoesNovas.length) {
    const { error: falhaInscricao } = await supabaseAdmin.from('InscricaoCampeonato').insert(inscricoesNovas)
    if (falhaInscricao) throw new Error(falhaInscricao.message)
  }

  const pares: Array<[number, number]> = []
  for (let a = 0; a < times.length; a += 1) {
    for (let b = a + 1; b < times.length; b += 1) pares.push([a, b])
  }

  let partidasCriadas = 0
  for (let indice = 0; indice < pares.length; indice += 1) {
    const [ia, ib] = pares[indice]
    const equipeA = times[ia]
    const equipeB = times[ib]
    const situacao = indice === pares.length - 1 ? 'EM_ANDAMENTO' : indice === pares.length - 2 ? 'AGENDADA' : indice === pares.length - 3 ? 'CANCELADA' : 'ENCERRADA'
    const aVence = (ia + ib) % 5 !== 0
    const sets = situacao === 'ENCERRADA' ? setsDaPartida(indice, aVence) : []
    const setsPorA = sets.filter(([a, b]) => a > b).length
    const setsPorB = sets.filter(([a, b]) => b > a).length
    const pontosPorA = sets.reduce((total, item) => total + item[0], 0)
    const pontosPorB = sets.reduce((total, item) => total + item[1], 0)
    const vencedorId = situacao === 'ENCERRADA' ? (setsPorA > setsPorB ? equipeA.id : equipeB.id) : null
    const { data: partida, error: falhaPartida } = await supabaseAdmin.from('Partida').insert({
      ligaId,
      equipeAId: equipeA.id,
      equipeBId: equipeB.id,
      categoria: 'MASCULINO',
      serie: null,
      categoriaCampeonatoId: categoriaId,
      rodada: Math.floor(indice / 4) + 1,
      status: situacao,
      dataHora: new Date(Date.now() - (pares.length - indice) * 86400000).toISOString(),
      localNome: 'Ginásio da validação',
      setsPorA: situacao === 'ENCERRADA' ? setsPorA : null,
      setsPorB: situacao === 'ENCERRADA' ? setsPorB : null,
      pontosPorA: situacao === 'ENCERRADA' ? pontosPorA : null,
      pontosPorB: situacao === 'ENCERRADA' ? pontosPorB : null,
      vencedorId,
      sumulaToken: randomUUID(),
      sumulaAprovadaEm: situacao === 'ENCERRADA' ? new Date().toISOString() : null,
    }).select('id,sumulaToken').single()
    if (falhaPartida || !partida) throw new Error(falhaPartida?.message ?? 'Não foi possível criar a partida.')
    partidasCriadas += 1
    if (situacao !== 'ENCERRADA') continue

    const { error: falhaSets } = await supabaseAdmin.from('SetPartida').insert(sets.map((item, set) => ({
      partidaId: partida.id,
      numero: set + 1,
      pontosA: item[0],
      pontosB: item[1],
    })))
    if (falhaSets) throw new Error(falhaSets.message)

    const presencas = [equipeA, equipeB].flatMap((equipe) => {
      const mapa = porTime.get(equipe.id) ?? new Map()
      return Array.from(mapa.entries()).sort((a, b) => a[0] - b[0]).slice(0, 12).map(([numero, atleta]) => ({
        partidaId: partida.id,
        jogadorId: atleta.id,
        equipeId: equipe.id,
        presente: true,
        numero,
      }))
    })
    const { error: falhaPresenca } = await supabaseAdmin.from('SumulaPresenca').insert(presencas)
    if (falhaPresenca) throw new Error(falhaPresenca.message)

    const eventos: Array<Record<string, unknown>> = []
    sets.forEach((item, set) => {
      const numero = set + 1
      const liberoA = ia === 4 ? '—' : numero >= 3 && ia === 0 ? '16' : '15'
      const liberoB = ib === 5 ? '—' : '15'
      eventos.push({
        partidaId: partida.id,
        tipo: 'set_start',
        set: numero,
        descricao: `18:${String(numero).padStart(2, '0')} | ${item[0]} x ${item[1]} | Líberos iniciais: ${equipeA.nome} #${liberoA} e ${equipeB.nome} #${liberoB}.`,
      })
      eventos.push({
        partidaId: partida.id,
        tipo: 'timeout',
        set: numero,
        descricao: `18:${String(10 + numero).padStart(2, '0')} | 12 x 15 | ${equipeA.nome} — tempo técnico`,
      })
      if (numero % 2 === 0) {
        eventos.push({
          partidaId: partida.id,
          tipo: 'timeout',
          set: numero,
          descricao: `18:${String(20 + numero).padStart(2, '0')} | 20 x 22 | ${equipeB.nome} — tempo técnico`,
        })
      }
      const cota = [
        { equipe: equipeA, quantidade: ia === 0 ? 4 : ia === 1 ? 3 : 1, numero: ia === 0 ? 1 : 7, tipo: 'attack' },
        { equipe: equipeB, quantidade: ib === 2 ? 2 : 1, numero: 4, tipo: ib === 3 ? 'block' : 'ace' },
      ]
      for (const itemCota of cota) {
        const atleta = porTime.get(itemCota.equipe.id)?.get(itemCota.numero)
        if (!atleta) continue
        for (let ponto = 0; ponto < itemCota.quantidade; ponto += 1) {
          eventos.push({
            partidaId: partida.id,
            tipo: itemCota.tipo,
            set: numero,
            jogadorId: atleta.id,
            descricao: `18:${String(30 + ponto).padStart(2, '0')} | ${item[0]} x ${item[1]} | Ponto de ${atleta.nome}`,
          })
        }
      }
    })
    const { error: falhaEventos } = await supabaseAdmin.from('OcorrenciaPartida').insert(eventos)
    if (falhaEventos) throw new Error(falhaEventos.message)
  }

  await gravarClassificacao(ligaId)
  const { error: falhaStatus } = await supabaseAdmin.from('Liga').update({ status: 'FINALIZADO' }).eq('id', ligaId)
  if (falhaStatus) throw new Error(falhaStatus.message)

  return { ligaId, criada: true, partidas: partidasCriadas, organizacao: organizador.organizacao ?? null }
}
