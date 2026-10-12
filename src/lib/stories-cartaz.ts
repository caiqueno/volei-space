import { vencedorDaPartida } from '@/lib/chave-visual'
import { topCinco, type AtletaQuadro, type LinhaGrupo } from '@/lib/quadro-publico'
import { tipoSancao } from '@/lib/sancoes'

export const LIMITE_RANKING = 5
export const LIMITE_GRUPO = 8
export const ALTURA_LINHA_RANKING = 180

export type FundamentoCartaz = 'ataque' | 'bloqueio' | 'saque'

export const TITULO_FUNDAMENTO: Record<FundamentoCartaz, string> = {
  ataque: 'Top Atacantes',
  bloqueio: 'Top Bloqueadores',
  saque: 'Top Sacadores',
}

export type LinhaTabelaCartaz = {
  equipe: string
  logoUrl?: string | null
  corHex?: string | null
  pontos: number
  jogos?: number
  vitorias?: number
  derrotas?: number
  setsPro?: number
  setsContra?: number
  saldoSets?: number
  saldoPontos?: number
  pontosPro?: number
  pontosContra?: number
  punicoes?: number
}

export type AtletaCartaz = AtletaQuadro & { pontos: number }

export type LadoCartaz = {
  nome: string
  definir: boolean
  cor: string | null
  logo: string | null
  id?: number
  provisorio?: boolean
  origem?: string | null
}

export type ConfrontoCartaz = {
  tag: string
  status: string
  ladoA: LadoCartaz
  ladoB: LadoCartaz
  setsPorA: number | null
  setsPorB: number | null
  parciais: Array<{ numero: number; pontosA: number; pontosB: number }>
  vencedor: 'A' | 'B' | null
  volta: string | null
}

export type GrupoCartaz = {
  id?: string
  nome: string
  vagas?: number
  linhas: Array<Pick<LinhaGrupo, 'equipe' | 'pontos'> & Partial<LinhaTabelaCartaz>>
}

export type JogoCartaz = {
  nomeA: string
  nomeB: string
  corA?: string | null
  corB?: string | null
  logoA?: string | null
  logoB?: string | null
  status: string
  setsPorA: number | null
  setsPorB: number | null
  parciais?: ResultadoCartaz['parciais']
  campeonato?: string | null
  rotulo?: string | null
  data?: string | null
  local?: string | null
}

export type CartaoJogoCartaz = {
  nomeA: string
  nomeB: string
  corA: string | null
  corB: string | null
  logoA: string | null
  logoB: string | null
  status: string
  aoVivo: boolean
  encerrado: boolean
  setsPorA: number | null
  setsPorB: number | null
  parciais: ResultadoCartaz['parciais']
  rotulo: string
  data: string | null
  local: string | null
}

export type PartidaChaveCartaz = {
  status?: string | null
  equipeA?: { id?: number; nome?: string | null; vaga?: boolean; corHex?: string | null; logoUrl?: string | null } | null
  equipeB?: { id?: number; nome?: string | null; vaga?: boolean; corHex?: string | null; logoUrl?: string | null } | null
  setsPorA?: number | null
  setsPorB?: number | null
  sets?: Array<{ numero?: number; pontosA: number; pontosB: number }>
}

export type ChaveCartaz = {
  rounds: Array<{ fase: string; label: string; slots: Array<{ partida: PartidaChaveCartaz | null; volta?: PartidaChaveCartaz | null }> }>
  thirdPlace?: { fase?: string | null; partida: PartidaChaveCartaz | null } | null
}

export type ResultadoCartaz = {
  nomeA: string
  nomeB: string
  logoA?: string | null
  logoB?: string | null
  corA?: string | null
  corB?: string | null
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
  fundamentos: Array<{ equipe: string; ataque: number; bloqueio: number; saque: number; logoUrl?: string | null; corHex?: string | null }>
  cartoes: Array<{ tipo: string; nome: string }>
}

type BaseCartaz = {
  kicker: string
  titulo: string
  campeonato: string
  logoCampeonato: string | null
  link: string
  lider: { equipe: string; pontos: number } | null
}

function logoDoCampeonato(logo?: string | null) {
  const texto = String(logo ?? '').trim()
  return texto || null
}

export type LugarPodioCartaz = {
  posicao: 1 | 2 | 3
  nome: string
  logoUrl?: string | null
  corHex?: string | null
}

export type MvpCartaz = {
  nome: string
  equipe: string | null
  foto: string | null
  pontos: number
  saque: number
  ataque: number
  bloqueio: number
}

export type CartazStories =
  | (BaseCartaz & { tipo: 'ranking'; fundamento: FundamentoCartaz; atletas: AtletaCartaz[] })
  | (BaseCartaz & { tipo: 'grupo'; grupo: { nome: string; vagas: number; linhas: LinhaTabelaCartaz[] } | null; grupos: Array<{ id: string; nome: string }>; grupoId: string | null })
  | (BaseCartaz & { tipo: 'chave'; semis: ConfrontoCartaz[]; rotuloSemis: string; final: ConfrontoCartaz | null; terceiro: ConfrontoCartaz | null })
  | (BaseCartaz & { tipo: 'resultado' | 'aovivo'; resultado: ResultadoCartaz; fraseVencedor: string | null; sumula: SumulaCartaz | null })
  | (BaseCartaz & { tipo: 'jogo'; jogo: CartaoJogoCartaz })
  | (BaseCartaz & { tipo: 'podio'; lugares: LugarPodioCartaz[] })
  | (BaseCartaz & { tipo: 'mvp'; atleta: MvpCartaz })

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

export function cartazPodio(lugares: LugarPodioCartaz[], link: string, campeonato?: string, logoCampeonato?: string | null) {
  const ordem = ([1, 2, 3] as const).flatMap((posicao) => {
    const lugar = lugares.find((item) => item.posicao === posicao)
    return lugar ? [lugar] : []
  })
  return {
    tipo: 'podio' as const,
    kicker: 'Pódio',
    titulo: 'Campeão, vice e 3º lugar',
    campeonato: campeonato ?? '',
    logoCampeonato: logoDoCampeonato(logoCampeonato),
    link: linkCurto(link),
    lider: null,
    lugares: ordem,
  } satisfies CartazStories
}

export function cartazMvpCampeonato(atleta: MvpCartaz, link: string, campeonato?: string, logoCampeonato?: string | null) {
  return {
    tipo: 'mvp' as const,
    kicker: 'MVP',
    titulo: 'MVP do campeonato',
    campeonato: campeonato ?? '',
    logoCampeonato: logoDoCampeonato(logoCampeonato),
    link: linkCurto(link),
    lider: null,
    atleta,
  } satisfies CartazStories
}

export function cartazRanking(atletas: AtletaQuadro[], fundamento: FundamentoCartaz, link: string, campeonato?: string, logoCampeonato?: string | null) {
  return {
    tipo: 'ranking' as const,
    kicker: 'Ranking',
    titulo: TITULO_FUNDAMENTO[fundamento],
    fundamento,
    campeonato: campeonato ?? '',
    logoCampeonato: logoDoCampeonato(logoCampeonato),
    link: linkCurto(link),
    lider: null,
    atletas: topCinco(atletas, fundamento).slice(0, LIMITE_RANKING).map((atleta) => ({ ...atleta, pontos: atleta[fundamento] })),
  } satisfies CartazStories
}

export function cartazClassificacao(
  grupos: GrupoCartaz[],
  link: string,
  lider?: { equipe: string; pontos: number } | null,
  grupoId?: string | null,
  campeonato?: string,
  logoCampeonato?: string | null,
) {
  const comDados = grupos.filter((grupo) => grupo.linhas.length > 0)
  const opcoes = comDados.map((grupo, indice) => ({ id: grupo.id || grupo.nome || String(indice), nome: grupo.nome }))
  const escolhido = comDados.find((grupo, indice) => (grupo.id || grupo.nome || String(indice)) === grupoId) ?? comDados[0] ?? null
  const id = escolhido ? (escolhido.id || escolhido.nome) : null
  return {
    tipo: 'grupo' as const,
    kicker: 'Classificação',
    titulo: escolhido?.nome || 'Tabela',
    campeonato: campeonato ?? '',
    logoCampeonato: logoDoCampeonato(logoCampeonato),
    link: linkCurto(link),
    lider: lider ?? null,
    grupo: escolhido ? { nome: escolhido.nome, vagas: escolhido.vagas ?? 0, linhas: escolhido.linhas.slice(0, LIMITE_GRUPO) } : null,
    grupos: opcoes,
    grupoId: id,
  } satisfies CartazStories
}

export function cartazJogo(jogo: JogoCartaz, link: string, campeonato?: string, logoCampeonato?: string | null) {
  const encerrado = jogo.status === 'ENCERRADA' || jogo.status === 'WO'
  const aoVivo = jogo.status === 'EM_ANDAMENTO'
  const nomeCampeonato = campeonato || jogo.campeonato || ''
  return {
    tipo: 'jogo' as const,
    kicker: 'Jogo',
    titulo: jogo.rotulo || `${jogo.nomeA} x ${jogo.nomeB}`,
    campeonato: nomeCampeonato,
    logoCampeonato: logoDoCampeonato(logoCampeonato),
    link: linkCurto(link),
    lider: null,
    jogo: {
      nomeA: jogo.nomeA,
      nomeB: jogo.nomeB,
      corA: jogo.corA ?? null,
      corB: jogo.corB ?? null,
      logoA: jogo.logoA ?? null,
      logoB: jogo.logoB ?? null,
      status: rotuloStatus(jogo.status),
      aoVivo,
      encerrado,
      setsPorA: jogo.setsPorA,
      setsPorB: jogo.setsPorB,
      parciais: jogo.parciais ?? [],
      rotulo: jogo.rotulo || 'Jogo',
      data: jogo.data ?? null,
      local: jogo.local ?? null,
    },
  } satisfies CartazStories
}

export function cartazMataMata(chave: ChaveCartaz, link: string, campeonato?: string, logoCampeonato?: string | null) {
  const semis = confrontosDaFase(chave, 'semi')
  const superior = semis.jogos.length > 0 ? semis : confrontosDaFase(chave, 'outra')
  return {
    tipo: 'chave' as const,
    kicker: 'Mata-mata',
    titulo: 'Chave',
    campeonato: campeonato ?? '',
    logoCampeonato: logoDoCampeonato(logoCampeonato),
    link: linkCurto(link),
    lider: null,
    semis: superior.jogos,
    rotuloSemis: superior.rotulo,
    final: confrontosDaFase(chave, 'final').jogos[0] ?? null,
    terceiro: confrontosDaFase(chave, 'terceiro').jogos[0] ?? null,
  } satisfies CartazStories
}

export function cartazPartida(jogo: ResultadoCartaz, link: string, sumula?: SumulaCartaz | null, campeonato?: string, logoCampeonato?: string | null) {
  const fraseVencedor = !jogo.aoVivo && jogo.vencedor ? `${jogo.vencedor.toLocaleUpperCase('pt-BR')} venceu` : null
  return {
    tipo: jogo.aoVivo ? 'aovivo' as const : 'resultado' as const,
    kicker: jogo.aoVivo ? 'Ao vivo' : 'Fim de jogo',
    titulo: jogo.aoVivo ? `${jogo.nomeA} x ${jogo.nomeB}` : 'Fim de jogo',
    campeonato: campeonato ?? '',
    logoCampeonato: logoDoCampeonato(logoCampeonato),
    link: linkCurto(link),
    lider: null,
    resultado: jogo,
    fraseVencedor,
    sumula: sumula ?? null,
  } satisfies CartazStories
}

export function linhasDaSumula(sumula: SumulaCartaz) {
  return sumula
}

export function montarSumulaPublica(entrada: {
  nomeA: string
  nomeB: string
  logoA?: string | null
  logoB?: string | null
  corA?: string | null
  corB?: string | null
  parciais: Array<{ numero: number; pontosA: number; pontosB: number }>
  ocorrencias: Array<{ tipo?: string | null; descricao?: string | null; jogadorId?: number | null }>
  jogadoresA: Array<{ id: number; nome: string }>
  jogadoresB: Array<{ id: number; nome: string }>
}): SumulaCartaz {
  const times = [
    { equipe: entrada.nomeA, logoUrl: entrada.logoA ?? null, corHex: entrada.corA ?? null, ids: new Set(entrada.jogadoresA.map((jogador) => jogador.id)), ataque: 0, bloqueio: 0, saque: 0 },
    { equipe: entrada.nomeB, logoUrl: entrada.logoB ?? null, corHex: entrada.corB ?? null, ids: new Set(entrada.jogadoresB.map((jogador) => jogador.id)), ataque: 0, bloqueio: 0, saque: 0 },
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
    fundamentos: times.map(({ equipe, ataque, bloqueio, saque, logoUrl, corHex }) => ({ equipe, ataque, bloqueio, saque, logoUrl, corHex })),
    cartoes,
  }
}

function confrontosDaFase(chave: ChaveCartaz, fase: 'semi' | 'terceiro' | 'final' | 'outra') {
  const jogos: ConfrontoCartaz[] = []
  let rotulo = fase === 'semi' ? 'Semifinais' : fase === 'final' ? 'Final' : fase === 'terceiro' ? '3º lugar' : ''
  for (const round of chave.rounds) {
    const classe = classeDaFase(round.fase) ?? classeDaFase(round.label)
    const entra = fase === 'outra' ? classe == null : classe === fase
    if (!entra) continue
    if (!rotulo) rotulo = round.label || round.fase
    for (const slot of round.slots) {
      if (!slot.partida) continue
      jogos.push(confrontoDe(slot.partida, round.slots.length > 1 ? `${round.label} · Jogo ${jogos.length + 1}` : (round.label || rotulo), slot.volta))
    }
  }
  if (fase === 'terceiro' && chave.thirdPlace?.partida) {
    const extra = confrontoDe(chave.thirdPlace.partida, '3º lugar', null)
    const jaTem = jogos.some((jogo) => jogo.ladoA.nome === extra.ladoA.nome && jogo.ladoB.nome === extra.ladoB.nome && jogo.setsPorA === extra.setsPorA)
    if (!jaTem) jogos.push(extra)
  }
  return { jogos, rotulo }
}

function confrontoDe(jogo: PartidaChaveCartaz, tag: string, volta?: PartidaChaveCartaz | null): ConfrontoCartaz {
  const ladoA = ladoDe(jogo.equipeA)
  const ladoB = ladoDe(jogo.equipeB)
  const idVencedor = vencedorDaPartida({
    status: jogo.status,
    setsPorA: jogo.setsPorA,
    setsPorB: jogo.setsPorB,
    equipeA: jogo.equipeA?.id != null ? { id: jogo.equipeA.id } : ladoA.definir ? null : { id: 1 },
    equipeB: jogo.equipeB?.id != null ? { id: jogo.equipeB.id } : ladoB.definir ? null : { id: 2 },
  })
  let vencedor: 'A' | 'B' | null = null
  if (idVencedor != null && !ladoA.definir && jogo.equipeA?.id != null && idVencedor === jogo.equipeA.id) vencedor = 'A'
  else if (idVencedor != null && !ladoB.definir && jogo.equipeB?.id != null && idVencedor === jogo.equipeB.id) vencedor = 'B'
  else if (idVencedor === 1 && !ladoA.definir) vencedor = 'A'
  else if (idVencedor === 2 && !ladoB.definir) vencedor = 'B'
  const setsVolta = volta && (volta.setsPorA != null || volta.setsPorB != null) ? `Volta: ${volta.setsPorA ?? 0}–${volta.setsPorB ?? 0}` : null
  return {
    tag,
    status: jogo.status ?? '',
    ladoA,
    ladoB,
    setsPorA: jogo.setsPorA ?? null,
    setsPorB: jogo.setsPorB ?? null,
    parciais: (jogo.sets ?? []).map((set, indice) => ({ numero: set.numero ?? indice + 1, pontosA: set.pontosA, pontosB: set.pontosB })),
    vencedor,
    volta: setsVolta,
  }
}

function ladoDe(equipe?: PartidaChaveCartaz['equipeA']): LadoCartaz {
  const definir = !equipe?.nome || Boolean(equipe.vaga)
  return {
    nome: definir ? 'A definir' : equipe?.nome || 'A definir',
    definir,
    cor: equipe?.corHex ?? null,
    logo: equipe?.logoUrl ?? null,
  }
}

function classeDaFase(fase?: string | null) {
  const texto = String(fase ?? '').trim().toUpperCase()
  if (!texto) return null
  if (texto.includes('TERCEIRO') || texto.includes('3º') || texto.includes('3O LUGAR')) return 'terceiro'
  if (texto.includes('SEMI')) return 'semi'
  if (texto === 'FINAL') return 'final'
  return null
}

function rotuloStatus(status: string) {
  if (status === 'EM_ANDAMENTO') return 'Em andamento'
  if (status === 'ENCERRADA') return 'Encerrada'
  if (status === 'WO') return 'W.O.'
  if (status === 'AGENDADA') return 'Agendada'
  if (status === 'PENDENTE' || status === 'PENDENTE_APROVACAO') return 'Em análise'
  if (status === 'CANCELADA') return 'Cancelada'
  return 'Jogo'
}
