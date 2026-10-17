/**
 * Dados da súmula impressa derivados do LOG do motor (eventos), não do texto das ocorrências. Módulo PURO.
 *
 * Tudo sai de `derivarPlacar` e das funções puras de `regras-volei`: quadro de pontos com o rodízio ponto a ponto,
 * tempos e substituições em ordem, sanções com a coluna A/P/E/D, folha de controle de líbero, protestos e totais.
 * Só entram camisas (números) e nomes: nenhum documento, data de nascimento ou contato.
 */
import {
  aplicarRally,
  calcularFechamento,
  CONFIG_FIVB_MELHOR_DE_5,
  derivarPlacar,
  eventosEfetivos,
  formatarDuracao,
  montarFolhaControleLibero,
  trocasDoPayload,
  type ConfigPartida,
  type LinhaFolhaLibero,
  type PontoDerivado,
  type SumulaEvento,
} from '@/lib/regras-volei'
import { emOrdemCronologica } from '@/lib/sumula-ui/ordem'
import type { Lado } from './tipos'

/* --------------------------------- tipos --------------------------------- */

export type LinhaPonto = {
  /** Ordem do rally dentro do set (cancelados contam: a linha continua visível). */
  ordem: number
  seq: number
  /** Equipe que marcou o ponto. */
  equipe: Lado
  origem: PontoDerivado['origem']
  cancelado: boolean
  /** Placar acumulado DEPOIS do ponto (sem os cancelados). */
  placarA: number
  placarB: number
  /** Equipe que sacava no rally e camisa do sacador (posição I dela). */
  sacador: Lado
  numeroSacador: number | null
  /** Posições I a VI (índice 0 = I) durante o rally. */
  formacaoA: number[]
  formacaoB: number[]
}

export type TipoLinhaEvento = 'TEMPO' | 'SUBSTITUICAO' | 'SUBSTITUICAO_EXCEPCIONAL'

export type LinhaEvento = {
  seq: number
  /** Chave de ordenação compartilhada com o replay (`emOrdemCronologica`). */
  id: number
  numeroSet: number
  equipe: Lado
  tipo: TipoLinhaEvento
  /** 1º, 2º... da equipe no set, para o mesmo tipo de pedido. */
  ordem: number
  sai: number | null
  entra: number | null
  motivo: string | null
  /** Placar da hora, primeiro os pontos da equipe que pediu (ex.: "10X6"). */
  placar: string
}

export type ColunaSancao = 'A' | 'P' | 'E' | 'D'

export type LinhaSancao = {
  seq: number
  id: number
  numeroSet: number
  equipe: Lado
  membro: string
  categoria: string
  sancao: string
  /** Coluna do quadro de sanções; null na advertência verbal (sem coluna). */
  coluna: ColunaSancao | null
  pontoParaAdversario: boolean
  placar: string
}

export type LinhaProtesto = {
  seq: number
  equipe: Lado
  estado: 'ANUNCIADO' | 'REGISTRADO' | 'DESISTIDO'
  relato: string | null
}

export type LinhaObservacao = { seq: number; id: number; numeroSet: number; texto: string; placar: string }

export type SetMotor = {
  numero: number
  decisivo: boolean
  sacouPrimeiro: Lado
  formacaoInicialA: number[]
  formacaoInicialB: number[]
  pontos: LinhaPonto[]
  temCancelamento: boolean
  /** seq do TROCA_LADO deste set; null se não houve. */
  trocaDeLadoSeq: number | null
  /** Placar (A-B) no instante da troca de lado. */
  trocaDeLadoPlacar: string | null
  eventos: LinhaEvento[]
  sancoes: LinhaSancao[]
  /** Set decisivo: tempos e substituições lançados nos quadros da esquerda e da direita (RG-FOR-011). */
  quadros: QuadrosDoSetDecisivo | null
}

export type QuadrosDoSetDecisivo = {
  esquerda: LinhaEvento[]
  direita: LinhaEvento[]
}

export type FechamentoImpresso = {
  porSet: Array<{
    numero: number
    placarA: number
    placarB: number
    temposA: number
    temposB: number
    substA: number
    substB: number
    sancoesA: number
    sancoesB: number
    inicio: string | null
    fim: string | null
    duracaoMin: number | null
    duracao: string | null
  }>
  totais: {
    temposA: number
    temposB: number
    substA: number
    substB: number
    sancoesA: number
    sancoesB: number
    pontosA: number
    pontosB: number
  }
  setsA: number
  setsB: number
  vencedor: Lado | null
  inicio: string | null
  fim: string | null
  /** Soma dos sets, sem intervalos. */
  duracaoSets: string | null
  /** Jogo inteiro, com intervalos, 1 dígito de hora (ex.: "2h00"). */
  duracaoTotal: string | null
}

export type MotorImpresso = {
  sets: SetMotor[]
  sancoes: LinhaSancao[]
  protestos: LinhaProtesto[]
  observacoes: LinhaObservacao[]
  folhaLibero: LinhaFolhaLibero[]
  capitaoEmJogo: Array<{ seq: number; equipe: Lado; jogador: number }>
  fechamento: FechamentoImpresso
  houveCancelamentoDePontos: boolean
  /** Eventos que o motor recusou: não entram no documento, mas o total é avisado. */
  recusados: number
}

/* ------------------------------ formatações ------------------------------- */

/** RG-ELE-006: primeiro nome + inicial do último sobrenome + ponto ("Carlos Eduardo Silva" vira "CARLOS S."). */
export function nomeNaSumula(nome: string | null | undefined): string {
  const partes = String(nome ?? '').trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return ''
  const primeiro = partes[0].toUpperCase()
  if (partes.length === 1) return primeiro
  const ultimo = partes[partes.length - 1]
  return `${primeiro} ${ultimo.charAt(0).toUpperCase()}.`
}

const COLUNA_POR_SANCAO: Record<string, ColunaSancao | null> = {
  ADVERTENCIA_VERBAL: null,
  AMARELO: 'A',
  PENALIDADE: 'P',
  EXPULSAO: 'E',
  DESQUALIFICACAO: 'D',
  ADVERTENCIA_ATRASO: 'A',
  PENALIDADE_ATRASO: 'P',
}

export function colunaDaSancao(sancao: string): ColunaSancao | null {
  return COLUNA_POR_SANCAO[sancao] ?? null
}

const ROTULO_SANCAO: Record<string, string> = {
  ADVERTENCIA_VERBAL: 'Advertência verbal',
  AMARELO: 'Cartão amarelo (advertência)',
  PENALIDADE: 'Penalidade',
  EXPULSAO: 'Expulsão',
  DESQUALIFICACAO: 'Desqualificação',
  ADVERTENCIA_ATRASO: 'Advertência por atraso',
  PENALIDADE_ATRASO: 'Penalidade por atraso',
}

const ROTULO_CATEGORIA: Record<string, string> = {
  MENOR: 'Conduta incorreta',
  GROSSEIRA: 'Conduta grosseira',
  OFENSIVA: 'Conduta ofensiva',
  AGRESSAO: 'Agressão',
  ATRASO: 'Atraso de jogo',
}

const ROTULO_MEMBRO: Record<string, string> = {
  TECNICO: 'Técnico',
  ASSISTENTE: 'Técnico assistente',
  MEDICO: 'Médico',
  FISIOTERAPEUTA: 'Fisioterapeuta',
  EQUIPE: 'Equipe',
}

export function rotuloDoMembro(membro: string): string {
  const jogador = /^J:(\d+)$/.exec(membro)
  if (jogador) return `Jogador nº ${jogador[1]}`
  return ROTULO_MEMBRO[membro] ?? membro
}

/** Hora local HH:MM de um carimbo ISO, ou null. */
export function horaDoCarimbo(iso: string | null | undefined, fusoMin = -180): string | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  const d = new Date(t + fusoMin * 60000)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

/* ------------------------------ configuração ------------------------------ */

/**
 * A rota pública não devolve as regras da categoria. A configuração é inferida dos sets que já constam na leitura:
 * alvo dos sets regulares = menor pontuação vencedora entre eles; set decisivo (5º) idem; melhor de 5 se alguma
 * equipe tem 3 sets ou foram jogados mais de 3. Sem sets, vale o padrão FIVB.
 */
export function configParaImpressao(
  sets: ReadonlyArray<{ numero: number; pontosA: number; pontosB: number }>,
  setsA: number,
  setsB: number,
): ConfigPartida {
  const melhorDe: 3 | 5 = setsA >= 3 || setsB >= 3 || sets.length > 3 ? 5 : 3
  const vencedora = (s: { pontosA: number; pontosB: number }) => Math.max(s.pontosA, s.pontosB)
  const ordenados = [...sets].sort((a, b) => a.numero - b.numero)
  const decisivoNumero = melhorDe
  const regulares = ordenados.filter((s) => s.numero < decisivoNumero && vencedora(s) > 0)
  const decisivo = ordenados.find((s) => s.numero === decisivoNumero && vencedora(s) > 0)
  const alvoSet = regulares.length ? Math.min(...regulares.map(vencedora)) : CONFIG_FIVB_MELHOR_DE_5.alvoSet
  const alvoSetDecisivo = decisivo ? Math.min(vencedora(decisivo), alvoSet) : melhorDe === 3 ? alvoSet : CONFIG_FIVB_MELHOR_DE_5.alvoSetDecisivo
  return {
    ...CONFIG_FIVB_MELHOR_DE_5,
    melhorDe,
    alvoSet,
    alvoSetDecisivo,
    trocaLadoNoDecisivoEm: Math.ceil(alvoSetDecisivo / 2),
  }
}

/* ----------------------------- quadro de pontos ---------------------------- */

type JornalDoSet = ReturnType<typeof derivarPlacar>['sets'][number]['jornal']

/** Rodízio ponto a ponto: reaplica o jornal do set (pontos e trocas) e fotografa a quadra a cada rally. */
export function quadroDePontos(
  jornal: JornalDoSet,
  formacaoInicialA: readonly number[],
  formacaoInicialB: readonly number[],
  sacouPrimeiro: Lado,
): LinhaPonto[] {
  let formacaoA = [...formacaoInicialA]
  let formacaoB = [...formacaoInicialB]
  let saca: Lado = sacouPrimeiro
  let a = 0
  let b = 0
  let ordem = 0
  const linhas: LinhaPonto[] = []
  for (const passo of jornal) {
    if (passo.tipo === 'TROCA') {
      const troca = (f: number[]) => f.map((j) => (j === passo.sai ? passo.entra : j))
      if (passo.equipe === 'A') formacaoA = troca(formacaoA)
      else formacaoB = troca(formacaoB)
      continue
    }
    const p = passo.ponto
    ordem += 1
    const noRally = saca === 'A' ? formacaoA : formacaoB
    if (!p.cancelado) {
      if (p.equipe === 'A') a += 1
      else b += 1
    }
    linhas.push({
      ordem,
      seq: p.seq,
      equipe: p.equipe,
      origem: p.origem,
      cancelado: p.cancelado,
      placarA: a,
      placarB: b,
      sacador: saca,
      numeroSacador: noRally[0] ?? null,
      formacaoA: [...formacaoA],
      formacaoB: [...formacaoB],
    })
    if (!p.cancelado) {
      const depois = aplicarRally({ formacaoA, formacaoB, saca }, p.equipe)
      formacaoA = [...depois.formacaoA]
      formacaoB = [...depois.formacaoB]
      saca = depois.saca
    }
  }
  return linhas
}

/** Pontos válidos do set, renumerados: é o que a súmula anexa transcreve depois do cancelamento (RG-ROT-005). */
export function pontosDaSumulaAnexa(pontos: readonly LinhaPonto[]): LinhaPonto[] {
  return pontos.filter((p) => !p.cancelado).map((p, i) => ({ ...p, ordem: i + 1 }))
}

/** RG-FOR-011: no set decisivo, tempos e substituições vão para o quadro da esquerda até a troca de lado e para o da direita depois. */
export function dividirPorTrocaDeLado(eventos: readonly LinhaEvento[], trocaDeLadoSeq: number | null): QuadrosDoSetDecisivo {
  if (trocaDeLadoSeq == null) return { esquerda: [...eventos], direita: [] }
  return {
    esquerda: eventos.filter((e) => e.seq < trocaDeLadoSeq),
    direita: eventos.filter((e) => e.seq > trocaDeLadoSeq),
  }
}

/* ------------------------------- paginação -------------------------------- */

/** Capacidade de linhas das caixas da página principal; o excedente segue na súmula anexa. */
export const CAPACIDADE_PAGINA = { observacoes: 12, sancoes: 12, eventosDoSet: 20 } as const

export function paginarLinhas<T>(itens: readonly T[], capacidade: number): { principal: T[]; anexo: T[] } {
  const limite = Math.max(0, Math.floor(capacidade))
  return { principal: itens.slice(0, limite), anexo: itens.slice(limite) }
}

/* -------------------------------- montagem -------------------------------- */

const TIPOS_COM_PLACAR = new Set(['TEMPO', 'SUBSTITUICAO', 'SANCAO', 'TROCA_LADO', 'OBSERVACAO'])

function textoPlacar(proprio: number, adversario: number) {
  return `${proprio}X${adversario}`
}

export function montarMotorImpresso(log: readonly SumulaEvento[], config: ConfigPartida): MotorImpresso {
  const efetivos = eventosEfetivos(log)
  const final = derivarPlacar(log, config)
  const recusadas = new Set(final.inconsistencias.map((i) => i.seq))

  const eventosPorSet = new Map<number, LinhaEvento[]>()
  const sancoesPorSet = new Map<number, LinhaSancao[]>()
  const trocaDeLado = new Map<number, { seq: number; placar: string }>()
  const observacoes: LinhaObservacao[] = []
  const contagem = new Map<string, number>()

  const proximaOrdem = (chave: string) => {
    const n = (contagem.get(chave) ?? 0) + 1
    contagem.set(chave, n)
    return n
  }

  for (const e of efetivos) {
    if (!TIPOS_COM_PLACAR.has(e.tipo) || recusadas.has(e.seq)) continue
    const antes = derivarPlacar(efetivos.filter((x) => x.seq < e.seq), config)
    const set = antes.setAtual
    const entreSets = e.tipo === 'SANCAO' && e.payload.entreSets === true
    const numeroSet = set ? set.numero + (entreSets && set.encerrado ? 1 : 0) : 1
    const a = set?.placar.a ?? 0
    const b = set?.placar.b ?? 0

    if (e.tipo === 'TROCA_LADO') {
      if (!trocaDeLado.has(numeroSet)) trocaDeLado.set(numeroSet, { seq: e.seq, placar: `${a}-${b}` })
      continue
    }
    if (e.tipo === 'OBSERVACAO') {
      observacoes.push({ seq: e.seq, id: e.seq, numeroSet, texto: e.payload.texto, placar: `${a}-${b}` })
      continue
    }
    if (e.tipo === 'SANCAO') {
      const p = e.payload
      const linha: LinhaSancao = {
        seq: e.seq,
        id: e.seq,
        numeroSet,
        equipe: p.equipe,
        membro: rotuloDoMembro(p.membro),
        categoria: ROTULO_CATEGORIA[p.categoria] ?? p.categoria,
        sancao: ROTULO_SANCAO[p.sancao] ?? p.sancao,
        coluna: colunaDaSancao(p.sancao),
        pontoParaAdversario: p.pontoParaAdversario,
        placar: p.equipe === 'A' ? textoPlacar(a, b) : textoPlacar(b, a),
      }
      sancoesPorSet.set(numeroSet, [...(sancoesPorSet.get(numeroSet) ?? []), linha])
      continue
    }
    if (e.tipo === 'TEMPO') {
      const p = e.payload
      const linha: LinhaEvento = {
        seq: e.seq,
        id: e.seq,
        numeroSet,
        equipe: p.equipe,
        tipo: 'TEMPO',
        ordem: proximaOrdem(`${numeroSet}:${p.equipe}:T`),
        sai: null,
        entra: null,
        motivo: null,
        placar: p.equipe === 'A' ? textoPlacar(a, b) : textoPlacar(b, a),
      }
      eventosPorSet.set(numeroSet, [...(eventosPorSet.get(numeroSet) ?? []), linha])
      continue
    }
    if (e.tipo === 'SUBSTITUICAO') {
      const p = e.payload
      for (const troca of trocasDoPayload(p)) {
        const tipo: TipoLinhaEvento = p.excepcional ? 'SUBSTITUICAO_EXCEPCIONAL' : 'SUBSTITUICAO'
        const linha: LinhaEvento = {
          seq: e.seq,
          id: e.seq,
          numeroSet,
          equipe: p.equipe,
          tipo,
          ordem: proximaOrdem(`${numeroSet}:${p.equipe}:S`),
          sai: troca.sai,
          entra: troca.entra,
          motivo: p.motivo ?? null,
          placar: p.equipe === 'A' ? textoPlacar(a, b) : textoPlacar(b, a),
        }
        eventosPorSet.set(numeroSet, [...(eventosPorSet.get(numeroSet) ?? []), linha])
      }
    }
  }

  const sets: SetMotor[] = final.sets.map((s) => {
    const pontos = quadroDePontos(s.jornal, s.formacaoInicialA, s.formacaoInicialB, s.sacouPrimeiro)
    // Ordem cronológica pela função compartilhada com o replay; o seq do motor cresce no tempo.
    const eventos = emOrdemCronologica(eventosPorSet.get(s.numero) ?? [], 'antigo-primeiro')
    const sancoes = emOrdemCronologica(sancoesPorSet.get(s.numero) ?? [], 'antigo-primeiro')
    const troca = trocaDeLado.get(s.numero) ?? null
    return {
      numero: s.numero,
      decisivo: s.decisivo,
      sacouPrimeiro: s.sacouPrimeiro,
      formacaoInicialA: [...s.formacaoInicialA],
      formacaoInicialB: [...s.formacaoInicialB],
      pontos,
      temCancelamento: pontos.some((p) => p.cancelado),
      trocaDeLadoSeq: troca?.seq ?? null,
      trocaDeLadoPlacar: troca?.placar ?? null,
      eventos,
      sancoes,
      quadros: s.decisivo ? dividirPorTrocaDeLado(eventos, troca?.seq ?? null) : null,
    }
  })

  const fech = calcularFechamento(log, config)
  const fechamento: FechamentoImpresso = {
    porSet: fech.porSet.map((s) => ({
      numero: s.numero,
      placarA: s.placar.a,
      placarB: s.placar.b,
      temposA: s.tempos.A,
      temposB: s.tempos.B,
      substA: s.substituicoes.A,
      substB: s.substituicoes.B,
      sancoesA: s.sancoes.A,
      sancoesB: s.sancoes.B,
      inicio: horaDoCarimbo(s.inicioEm),
      fim: horaDoCarimbo(s.fimEm),
      duracaoMin: s.duracaoMinutos,
      duracao: s.duracaoMinutos == null ? null : formatarDuracao(s.duracaoMinutos),
    })),
    totais: {
      temposA: fech.totais.tempos.A,
      temposB: fech.totais.tempos.B,
      substA: fech.totais.substituicoes.A,
      substB: fech.totais.substituicoes.B,
      sancoesA: fech.totais.sancoes.A,
      sancoesB: fech.totais.sancoes.B,
      pontosA: fech.totais.pontos.A,
      pontosB: fech.totais.pontos.B,
    },
    setsA: fech.resultadoEmSets.a,
    setsB: fech.resultadoEmSets.b,
    vencedor: fech.vencedor,
    inicio: horaDoCarimbo(fech.inicioEm),
    fim: horaDoCarimbo(fech.fimEm),
    duracaoSets: fech.duracaoSetsMinutos == null ? null : formatarDuracao(fech.duracaoSetsMinutos),
    duracaoTotal: fech.duracaoTotalFormatada,
  }

  const capitaoEmJogo = efetivos
    .filter((e): e is Extract<SumulaEvento, { tipo: 'CAPITAO_EM_JOGO' }> => e.tipo === 'CAPITAO_EM_JOGO' && !recusadas.has(e.seq))
    .map((e) => ({ seq: e.seq, equipe: e.payload.equipe, jogador: e.payload.jogador }))

  return {
    sets,
    sancoes: sets.flatMap((s) => s.sancoes),
    protestos: final.protestos.map((p) => ({ seq: p.seq, equipe: p.equipe, estado: p.estado, relato: p.relato })),
    observacoes: emOrdemCronologica(observacoes, 'antigo-primeiro'),
    folhaLibero: montarFolhaControleLibero(log, config).linhas.filter((l) => !recusadas.has(l.seq)),
    capitaoEmJogo,
    fechamento,
    houveCancelamentoDePontos: final.houveCancelamentoDePontos,
    recusados: recusadas.size,
  }
}

/** Quem assina o documento, na ordem do fechamento (RG-FEC-002): apontador, capitães, árbitros. */
export type LinhaAssinatura = { papel: 'APONTADOR' | 'CAPITAO' | 'ARBITRO'; rotulo: string; nota: string | null }

export function montarAssinaturas(params: {
  nomeA: string
  nomeB: string
  arbitros: ReadonlyArray<{ cargo: string; nome: string }>
  capitaoEmJogo?: ReadonlyArray<{ equipe: Lado; jogador: number }>
}): LinhaAssinatura[] {
  const emJogo = (lado: Lado) => [...(params.capitaoEmJogo ?? [])].reverse().find((c) => c.equipe === lado)
  const capitao = (lado: Lado, nome: string): LinhaAssinatura => {
    const c = emJogo(lado)
    return {
      papel: 'CAPITAO',
      rotulo: `Capitão ${nome}`,
      // RG-FEC-003: capitão ausente ao final, assina o capitão em jogo, com observação do fato.
      nota: c ? `Capitão em jogo designado: nº ${c.jogador}. Em caso de ausência do capitão, assina o capitão em jogo, com observação.` : null,
    }
  }
  const primeiro = params.arbitros.find((a) => /prim/i.test(a.cargo))
  const segundo = params.arbitros.find((a) => /segu/i.test(a.cargo))
  return [
    { papel: 'APONTADOR', rotulo: 'Apontador', nota: null },
    { papel: 'APONTADOR', rotulo: 'Apontador assistente (folha de líbero)', nota: null },
    capitao('A', params.nomeA),
    capitao('B', params.nomeB),
    { papel: 'ARBITRO', rotulo: '1º árbitro', nota: primeiro?.nome ?? null },
    { papel: 'ARBITRO', rotulo: '2º árbitro', nota: segundo?.nome ?? null },
  ]
}
