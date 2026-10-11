import { ordenarScouts, pontosDoAtleta, type AtletaQuadro, type LinhaGrupo } from '@/lib/quadro-publico'
import { tipoSancao } from '@/lib/sancoes'

export type LinhaCartaz = {
  tipo: 'posto' | 'secao' | 'nota' | 'placar'
  texto: string
  detalhe?: string
  valor?: string
  destaque?: boolean
}

export type CartazStories = {
  kicker: string
  titulo: string
  linhas: LinhaCartaz[]
  link: string
}

export type GrupoCartaz = {
  nome: string
  linhas: Array<Pick<LinhaGrupo, 'equipe' | 'pontos' | 'vitorias' | 'derrotas' | 'setsPro' | 'setsContra'>>
}

export type JogoCartaz = {
  nomeA: string
  nomeB: string
  status: string
  setsPorA: number | null
  setsPorB: number | null
  campeonato?: string | null
}

export type PartidaChaveCartaz = {
  status?: string | null
  equipeA?: { nome?: string | null } | null
  equipeB?: { nome?: string | null } | null
  setsPorA?: number | null
  setsPorB?: number | null
  sets?: Array<{ pontosA: number; pontosB: number }>
}

export type ChaveCartaz = {
  rounds: Array<{ fase: string; label: string; slots: Array<{ partida: PartidaChaveCartaz | null }> }>
  thirdPlace?: { fase?: string | null; partida: PartidaChaveCartaz | null } | null
}

export type ResultadoCartaz = {
  nomeA: string
  nomeB: string
  setsPorA: number
  setsPorB: number
  parciais: Array<{ numero: number; pontosA: number; pontosB: number }>
  vencedor: string | null
  mvp: string | null
  aoVivo: boolean
  pontosA?: number
  pontosB?: number
}

export type SumulaCartaz = {
  parciais: Array<{ numero: number; pontosA: number; pontosB: number }>
  fundamentos: Array<{ equipe: string; ataque: number; bloqueio: number; saque: number }>
  cartoes: Array<{ tipo: string; nome: string }>
}

const ROTULO_SANCAO: Record<string, string> = {
  ADVERTENCIA: 'Advertência',
  PENALIDADE: 'Penalidade',
  EXPULSAO: 'Expulsão',
  DESQUALIFICACAO: 'Desqualificação',
}

const FUNDAMENTO: Record<string, 'ataque' | 'bloqueio' | 'saque'> = {
  attack: 'ataque',
  ataque: 'ataque',
  block: 'bloqueio',
  bloqueio: 'bloqueio',
  ace: 'saque',
  saque: 'saque',
}

export function linkCurto(url: string) {
  try {
    const alvo = new URL(url)
    const caminho = `${alvo.host}${alvo.pathname}${alvo.search}`.replace(/\/$/, '')
    return caminho || alvo.host
  } catch {
    return url.replace(/^https?:\/\//, '')
  }
}

export function cartazRanking(atletas: AtletaQuadro[], link: string, campeonato?: string) {
  const top = ordenarScouts(atletas).slice(0, 5)
  const linhas: LinhaCartaz[] = campeonato ? [{ tipo: 'nota', texto: campeonato }] : []
  if (top.length === 0) {
    linhas.push({ tipo: 'nota', texto: 'Sem dados ainda' })
  } else {
    top.forEach((atleta, indice) => {
      linhas.push({
        tipo: 'posto',
        texto: `${indice + 1}º ${atleta.nome}`,
        detalhe: atleta.equipe,
        valor: String(pontosDoAtleta(atleta)),
        destaque: indice === 0,
      })
    })
  }
  return { kicker: 'Ranking', titulo: 'Top 5', linhas, link: linkCurto(link) } satisfies CartazStories
}

export function cartazClassificacao(grupos: GrupoCartaz[], link: string, lider?: { equipe: string; pontos: number } | null) {
  const linhas: LinhaCartaz[] = []
  if (lider) linhas.push({ tipo: 'nota', texto: `Líder: ${lider.equipe}`, valor: String(lider.pontos), destaque: true })
  const blocos = grupos.filter((grupo) => grupo.linhas.length > 0).slice(0, 2)
  if (blocos.length === 0) {
    linhas.push({ tipo: 'nota', texto: 'Sem dados ainda' })
  }
  for (const grupo of blocos) {
    linhas.push({ tipo: 'secao', texto: grupo.nome })
    grupo.linhas.slice(0, 6).forEach((linha, indice) => {
      linhas.push({
        tipo: 'posto',
        texto: `${indice + 1}º ${linha.equipe}`,
        detalhe: `${linha.vitorias}V ${linha.derrotas}D · ${linha.setsPro}-${linha.setsContra}`,
        valor: String(linha.pontos),
        destaque: indice === 0,
      })
    })
  }
  return { kicker: 'Classificação', titulo: 'Tabela', linhas, link: linkCurto(link) } satisfies CartazStories
}

export function cartazQuadro(entrada: { lider?: { equipe: string; pontos: number } | null; atletas: AtletaQuadro[]; grupos: GrupoCartaz[] }, link: string) {
  const linhas: LinhaCartaz[] = []
  if (entrada.lider) linhas.push({ tipo: 'nota', texto: `Líder: ${entrada.lider.equipe}`, valor: `${entrada.lider.pontos} pts`, destaque: true })
  const top = ordenarScouts(entrada.atletas).slice(0, 5)
  if (top.length > 0) {
    linhas.push({ tipo: 'secao', texto: 'Top 5' })
    top.forEach((atleta, indice) => {
      linhas.push({ tipo: 'posto', texto: `${indice + 1}º ${atleta.nome}`, detalhe: atleta.equipe, valor: String(pontosDoAtleta(atleta)), destaque: indice === 0 })
    })
  }
  const grupo = entrada.grupos.find((item) => item.linhas.length > 0)
  if (grupo) {
    linhas.push({ tipo: 'secao', texto: grupo.nome })
    grupo.linhas.slice(0, 5).forEach((linha, indice) => {
      linhas.push({ tipo: 'posto', texto: `${indice + 1}º ${linha.equipe}`, detalhe: `${linha.vitorias}V ${linha.derrotas}D`, valor: String(linha.pontos), destaque: indice === 0 })
    })
  }
  if (linhas.length === 0) linhas.push({ tipo: 'nota', texto: 'Sem dados ainda' })
  return { kicker: 'Quadro', titulo: 'Campeonato', linhas, link: linkCurto(link) } satisfies CartazStories
}

export function cartazJogos(jogos: JogoCartaz[], link: string) {
  const linhas: LinhaCartaz[] = jogos.slice(0, 8).map((jogo) => ({
    tipo: 'placar' as const,
    texto: `${jogo.nomeA} x ${jogo.nomeB}`,
    detalhe: jogo.campeonato || rotuloStatus(jogo.status),
    valor: placarSets(jogo.status, jogo.setsPorA, jogo.setsPorB),
    destaque: jogo.status === 'EM_ANDAMENTO',
  }))
  if (linhas.length === 0) linhas.push({ tipo: 'nota', texto: 'Nenhum jogo encontrado' })
  return { kicker: 'Jogos', titulo: 'Agenda', linhas, link: linkCurto(link) } satisfies CartazStories
}

export function cartazMataMata(chave: ChaveCartaz, link: string, campeonato?: string) {
  const linhas: LinhaCartaz[] = []
  if (campeonato) linhas.push({ tipo: 'nota', texto: campeonato })
  const fases = [
    { id: 'semi', titulo: 'Semifinais' },
    { id: 'terceiro', titulo: '3º lugar' },
    { id: 'final', titulo: 'Final' },
  ] as const
  for (const fase of fases) {
    const jogos = jogosDaFase(chave, fase.id)
    if (jogos.length === 0) continue
    linhas.push({ tipo: 'secao', texto: fase.titulo })
    for (const jogo of jogos) linhas.push(linhaConfronto(jogo))
  }
  if (linhas.every((linha) => linha.tipo === 'nota')) linhas.push({ tipo: 'nota', texto: 'Sem chave ainda' })
  return { kicker: 'Mata-mata', titulo: 'Chave', linhas, link: linkCurto(link) } satisfies CartazStories
}

export function cartazPartida(jogo: ResultadoCartaz, link: string, sumula?: SumulaCartaz | null) {
  if (!jogo.aoVivo) return cartazResultado(jogo, link, sumula)
  const linhas: LinhaCartaz[] = [
    {
      tipo: 'placar',
      texto: `${jogo.nomeA} x ${jogo.nomeB}`,
      detalhe: `Sets ${jogo.setsPorA} x ${jogo.setsPorB}`,
      valor: `${jogo.pontosA ?? 0} x ${jogo.pontosB ?? 0}`,
      destaque: true,
    },
  ]
  for (const set of jogo.parciais) {
    linhas.push({ tipo: 'posto', texto: `Set ${set.numero}`, valor: `${set.pontosA} x ${set.pontosB}` })
  }
  return { kicker: 'Ao vivo', titulo: `${jogo.nomeA} x ${jogo.nomeB}`, linhas, link: linkCurto(link) } satisfies CartazStories
}

export function cartazResultado(jogo: ResultadoCartaz, link: string, sumula?: SumulaCartaz | null) {
  const linhas: LinhaCartaz[] = []
  if (jogo.vencedor) linhas.push({ tipo: 'nota', texto: `${jogo.vencedor.toLocaleUpperCase('pt-BR')} venceu`, destaque: true })
  linhas.push({
    tipo: 'placar',
    texto: jogo.nomeA,
    valor: String(jogo.setsPorA),
    destaque: jogo.vencedor != null && jogo.vencedor === jogo.nomeA,
  })
  linhas.push({
    tipo: 'placar',
    texto: jogo.nomeB,
    valor: String(jogo.setsPorB),
    destaque: jogo.vencedor != null && jogo.vencedor === jogo.nomeB,
  })
  linhas.push({ tipo: 'secao', texto: 'Parciais' })
  if (jogo.parciais.length === 0) linhas.push({ tipo: 'nota', texto: 'Sem parciais' })
  for (const set of jogo.parciais) {
    linhas.push({ tipo: 'posto', texto: `Set ${set.numero}`, valor: `${set.pontosA} x ${set.pontosB}` })
  }
  if (jogo.mvp) linhas.push({ tipo: 'nota', texto: `MVP ${jogo.mvp}`, destaque: true })
  if (sumula) linhas.push(...linhasDaSumula(sumula))
  return { kicker: 'Fim de jogo', titulo: 'Fim de jogo', linhas, link: linkCurto(link) } satisfies CartazStories
}

export function linhasDaSumula(sumula: SumulaCartaz): LinhaCartaz[] {
  const linhas: LinhaCartaz[] = [{ tipo: 'secao', texto: 'Súmula' }]
  if (sumula.parciais.length === 0) linhas.push({ tipo: 'nota', texto: 'Sem parciais' })
  for (const set of sumula.parciais) {
    linhas.push({ tipo: 'posto', texto: `Set ${set.numero}`, valor: `${set.pontosA} x ${set.pontosB}` })
  }
  linhas.push({ tipo: 'secao', texto: 'Fundamentos' })
  if (sumula.fundamentos.length === 0) linhas.push({ tipo: 'nota', texto: 'Sem pontos por fundamento' })
  for (const equipe of sumula.fundamentos) {
    linhas.push({
      tipo: 'posto',
      texto: equipe.equipe,
      detalhe: `Ataque ${equipe.ataque} · Bloqueio ${equipe.bloqueio} · Saque ${equipe.saque}`,
    })
  }
  linhas.push({ tipo: 'secao', texto: 'Cartões' })
  if (sumula.cartoes.length === 0) linhas.push({ tipo: 'nota', texto: 'Nenhum cartão' })
  for (const cartao of sumula.cartoes.slice(0, 6)) {
    linhas.push({ tipo: 'nota', texto: `${cartao.tipo}${cartao.nome ? ` · ${cartao.nome}` : ''}` })
  }
  return linhas
}

export function montarSumulaPublica(entrada: {
  nomeA: string
  nomeB: string
  parciais: Array<{ numero: number; pontosA: number; pontosB: number }>
  ocorrencias: Array<{ tipo?: string | null; descricao?: string | null; jogadorId?: number | null }>
  jogadoresA: Array<{ id: number; nome: string }>
  jogadoresB: Array<{ id: number; nome: string }>
}): SumulaCartaz {
  const times = [
    { equipe: entrada.nomeA, ids: new Set(entrada.jogadoresA.map((jogador) => jogador.id)), ataque: 0, bloqueio: 0, saque: 0 },
    { equipe: entrada.nomeB, ids: new Set(entrada.jogadoresB.map((jogador) => jogador.id)), ataque: 0, bloqueio: 0, saque: 0 },
  ]
  const nomes = new Map<number, string>()
  for (const jogador of [...entrada.jogadoresA, ...entrada.jogadoresB]) nomes.set(jogador.id, jogador.nome)
  const cartoes: SumulaCartaz['cartoes'] = []
  for (const ocorrencia of entrada.ocorrencias) {
    const fundamento = FUNDAMENTO[String(ocorrencia.tipo ?? '').toLowerCase()]
    if (fundamento && ocorrencia.jogadorId != null) {
      const time = times.find((item) => item.ids.has(ocorrencia.jogadorId as number))
      if (time) time[fundamento] += 1
    }
    const sancao = tipoSancao(ocorrencia.tipo)
    if (!sancao) continue
    cartoes.push({
      tipo: ROTULO_SANCAO[sancao],
      nome: ocorrencia.jogadorId != null ? nomes.get(ocorrencia.jogadorId) ?? '' : '',
    })
  }
  return {
    parciais: entrada.parciais,
    fundamentos: times.map(({ equipe, ataque, bloqueio, saque }) => ({ equipe, ataque, bloqueio, saque })),
    cartoes,
  }
}

function jogosDaFase(chave: ChaveCartaz, fase: 'semi' | 'terceiro' | 'final') {
  const jogos: PartidaChaveCartaz[] = []
  for (const round of chave.rounds) {
    if (classeDaFase(round.fase) !== fase && classeDaFase(round.label) !== fase) continue
    for (const slot of round.slots) {
      if (slot.partida) jogos.push(slot.partida)
    }
  }
  if (fase === 'terceiro' && chave.thirdPlace?.partida) {
    const extra = chave.thirdPlace.partida
    const jaTem = jogos.some((jogo) => mesmaPartida(jogo, extra))
    if (!jaTem) jogos.push(extra)
  }
  return jogos
}

function mesmaPartida(a: PartidaChaveCartaz, b: PartidaChaveCartaz) {
  return a.equipeA?.nome === b.equipeA?.nome && a.equipeB?.nome === b.equipeB?.nome && a.setsPorA === b.setsPorA && a.setsPorB === b.setsPorB
}

function classeDaFase(fase?: string | null) {
  const texto = String(fase ?? '').trim().toUpperCase()
  if (!texto) return null
  if (texto.includes('TERCEIRO') || texto.includes('3º') || texto.includes('3O LUGAR')) return 'terceiro'
  if (texto.includes('SEMI')) return 'semi'
  if (texto === 'FINAL') return 'final'
  return null
}

function linhaConfronto(jogo: PartidaChaveCartaz): LinhaCartaz {
  const nomeA = jogo.equipeA?.nome || 'A definir'
  const nomeB = jogo.equipeB?.nome || 'A definir'
  const encerrado = jogo.status === 'ENCERRADA' || jogo.status === 'WO'
  const setsA = Number(jogo.setsPorA ?? 0)
  const setsB = Number(jogo.setsPorB ?? 0)
  const temPlacar = encerrado || jogo.setsPorA != null || jogo.setsPorB != null
  const parciais = (jogo.sets ?? []).map((set) => `${set.pontosA}-${set.pontosB}`).join(' · ')
  return {
    tipo: 'placar',
    texto: `${nomeA} x ${nomeB}`,
    detalhe: parciais || undefined,
    valor: temPlacar ? `${setsA} x ${setsB}` : 'a definir',
    destaque: encerrado && setsA !== setsB,
  }
}

function placarSets(status: string, setsA: number | null, setsB: number | null) {
  if (status === 'EM_ANDAMENTO' || status === 'ENCERRADA' || status === 'WO') return `${setsA ?? 0} x ${setsB ?? 0}`
  return rotuloStatus(status)
}

function rotuloStatus(status: string) {
  if (status === 'EM_ANDAMENTO') return 'Ao vivo'
  if (status === 'ENCERRADA') return 'Encerrado'
  if (status === 'WO') return 'W.O.'
  if (status === 'AGENDADA' || status === 'PENDENTE') return 'Agendado'
  return 'Jogo'
}
