/**
 * Serviço PURO da súmula por eventos: valida cada evento novo com o motor de regras e projeta o
 * estado derivado. Sem Next, sem Supabase, sem relógio: o log entra, a decisão sai.
 *
 * Códigos próprios do servidor (além dos RG-* do motor), ver docs/analise/07-arquitetura-backend.md:
 *  RG-LOG-007 desfazer deixaria o log inconsistente; RG-LOG-008 súmula oficializada;
 *  RG-LOG-009 evento não processado porque um anterior do lote foi rejeitado;
 *  RG-LOG-010 conflito de versão (seqEsperado); RG-LOG-011 payload inválido.
 */
import {
  anexarEvento,
  avaliarToleranciaWO,
  consequenciaDeDiscrepancia,
  aplicarSubstituicaoLote,
  avaliarSancao,
  trocasDoPayload,
  type PayloadPorTipo,
  bloqueio,
  classificarPedidoIndevido,
  decidirInterrupcao,
  derivarPlacar,
  ehSetDecisivo,
  eventosEfetivos,
  jogadoresImpedidos,
  MINUTOS_MAX_INTERRUPCAO,
  saqueInicialDoSet,
  validarFormacaoInicial,
  validarLog,
  validarPedidoDeTempo,
  validarRedesignacaoLibero,
  validarRegistroDeLiberos,
  validarSacador,
  validarSaqueDoLibero,
  validarSubstituicaoExcepcional,
  validarTrocaLibero,
  type AvisoRegra,
  type ConfigPartida,
  type ContextoDerivacao,
  type Equipe,
  type EstadoEquipe,
  type NovoEvento,
  type PlacarDerivado,
  type RegraBloqueio,
  type SumulaEvento,
} from '@/lib/regras-volei'
import { PAYLOAD_POR_TIPO, type EventoRecebido } from './esquema'

export type ResultadoValidacao =
  | { ok: true; duplicado: true; evento: SumulaEvento }
  | { ok: true; duplicado: false; novo: NovoEvento; avisos: AvisoRegra[]; setNumero: number | null }
  | RegraBloqueio

const CODIGO_ENCERRADA = {
  WO: ['RG-WO-001', 'A partida terminou por WO: não aceita novos lances (só desfazer ou observação).'],
  A_REPETIR: ['RG-INT-005', 'A partida foi marcada para repetição: não aceita novos lances (só desfazer ou observação).'],
  ENCERRADA: ['RG-SET-004', 'A partida já terminou: não aceita novos lances (só desfazer ou observação).'],
} as const

/** Protesto registrado ou abandonado vale depois do fim da partida (RG-PRO-002/003). */
const TIPOS_POS_JOGO: readonly string[] = ['PROTESTO_REGISTRADO', 'PROTESTO_DESISTIDO', 'DESAFIO']

function nomeDaEquipe(equipe: Equipe) {
  return `equipe ${equipe}`
}

/** Valida e normaliza o payload do evento recebido. Falha vira RG-LOG-011 com mensagem em português. */
export function lerPayload(recebido: EventoRecebido): { ok: true; payload: Record<string, unknown> } | RegraBloqueio {
  const r = PAYLOAD_POR_TIPO[recebido.tipo].safeParse(recebido.payload)
  if (!r.success) {
    const campo = r.error.issues[0]
    const onde = campo?.path.length ? ` (campo ${campo.path.join('.')})` : ''
    return bloqueio('RG-LOG-011', `Dados inválidos para o evento ${recebido.tipo}${onde}: ${campo?.message ?? 'formato incorreto'}.`)
  }
  if (recebido.tipo === 'DESFAZ' && (recebido.desfazId ?? null) === null) {
    return bloqueio('RG-LOG-002', 'O evento DESFAZ precisa indicar qual evento desfaz (desfazId).')
  }
  if (recebido.tipo !== 'DESFAZ' && (recebido.desfazId ?? null) !== null) {
    return bloqueio('RG-LOG-002', 'Só o evento DESFAZ pode ter desfazId.')
  }
  return { ok: true, payload: r.data as Record<string, unknown> }
}

function inconsistenciasNovas(antes: PlacarDerivado, depois: PlacarDerivado) {
  const conhecidas = new Set(antes.inconsistencias.map((i) => `${i.seq}:${i.codigo}`))
  return depois.inconsistencias.filter((i) => !conhecidas.has(`${i.seq}:${i.codigo}`))
}

interface Ambiente {
  log: readonly SumulaEvento[]
  config: ConfigPartida
  contexto: ContextoDerivacao
  placar: PlacarDerivado
  /** Horário atual confiável (ISO), informado pelo servidor; habilita a tolerância de WO (RG-WO-002). */
  agora?: string
}

type Checagem = { bloqueio: RegraBloqueio } | { avisos: AvisoRegra[]; payload?: Record<string, unknown> }

function exigirSetEmAndamento(amb: Ambiente, codigo: RegraBloqueio['codigo'], acao: string): RegraBloqueio | null {
  const set = amb.placar.setAtual
  if (!set || set.encerrado) return bloqueio(codigo, `${acao} só vale com um set em andamento.`)
  return null
}

function estadoOuErro(amb: Ambiente, equipe: Equipe): EstadoEquipe | RegraBloqueio {
  const estado = amb.placar.estadoEquipes?.[equipe]
  return estado ?? bloqueio('RG-SET-001', `Não há set em andamento para a ${nomeDaEquipe(equipe)}.`)
}

const ehBloqueio = (v: EstadoEquipe | RegraBloqueio): v is RegraBloqueio => 'ok' in v && v.ok === false

function checarSetIniciado(amb: Ambiente, p: Record<string, any>): Checagem {
  const { placar, contexto, config } = amb
  const prev = placar.estadoEquipes
  for (const equipe of ['A', 'B'] as const) {
    const formacao: number[] = p[`formacao${equipe}`]
    const elenco = contexto.elenco[equipe]
    const f = validarFormacaoInicial(formacao)
    if (!f.ok) return { bloqueio: f }
    const fora = formacao.find((j) => !elenco.includes(j))
    if (fora !== undefined) {
      return { bloqueio: bloqueio('RG-FOR-009', `O jogador ${fora} não consta na relação nominal da ${nomeDaEquipe(equipe)}.`) }
    }
    const maxElenco = config.perfil.maxJogadoresElenco
    if (!prev && maxElenco !== undefined && elenco.length > maxElenco) {
      return { bloqueio: bloqueio('RG-ELE-001', `A relação nominal da ${nomeDaEquipe(equipe)} tem ${elenco.length} jogadores; o máximo é ${maxElenco}.`) }
    }
    const liberosInformados: number[] | undefined = p[`liberos${equipe}`]
    // Os líberos só são lidos no 1º set da partida (depois valem os já registrados).
    const liberos = prev ? prev[equipe].liberos : liberosInformados ?? []
    if (!prev && (liberosInformados || config.perfil.exigeDoisLiberosAcimaDe12)) {
      const reg = validarRegistroDeLiberos(liberosInformados ?? [], [...elenco], {
        exigeDoisAcimaDe12: config.perfil.exigeDoisLiberosAcimaDe12 === true,
      })
      if (!reg.ok) return { bloqueio: reg }
    }
    const libero = formacao.find((j) => liberos.includes(j))
    if (libero !== undefined) {
      return { bloqueio: bloqueio('RG-LIB-001', `O líbero ${libero} não pode estar entre os 6 titulares da formação inicial.`) }
    }
    if (prev) {
      const estado = prev[equipe]
      const expulsosNoSet = prev.sancoes
        .filter((s) => s.equipe === equipe && s.sancao === 'EXPULSAO' && s.set === p.numeroSet)
        .map((s) => Number(s.membro.slice(2)))
      const impedido = formacao.find(
        (j) => estado.desqualificados.includes(j) || estado.semRetorno.includes(j) || expulsosNoSet.includes(j),
      )
      if (impedido !== undefined) {
        return { bloqueio: bloqueio('RG-SUB-011', `O jogador ${impedido} está impedido de atuar neste set e não pode estar na formação inicial.`) }
      }
    }
  }
  // RG-FOR-003: nos sets 2 a 4 saca primeiro quem NÃO sacou primeiro no anterior. Set anulado e
  // rejogado repete o saque do set anulado, então a conferência não se aplica nesse caso.
  const anterior = placar.sets[placar.sets.length - 1]
  if (anterior && placar.setsAnulados.length === 0) {
    const decisivo = ehSetDecisivo(config, placar.setsGanhos.a, placar.setsGanhos.b)
    const esperado = saqueInicialDoSet({ decisivo, sacouPrimeiroNoSetAnterior: anterior.sacouPrimeiro })
    if (esperado !== 'SORTEIO' && esperado !== p.saqueInicial) {
      return {
        bloqueio: bloqueio('RG-FOR-003', `No ${p.numeroSet}º set o saque inicial é da ${nomeDaEquipe(esperado)} (a outra equipe sacou primeiro no set anterior).`),
      }
    }
  }
  return { avisos: [] }
}

function checarSancao(amb: Ambiente, p: Record<string, any>): Checagem {
  const { placar, contexto } = amb
  const set = placar.setAtual
  if (!set) return { bloqueio: bloqueio('RG-SET-001', 'Sanção só vale depois de iniciado o primeiro set.') }
  if (p.entreSets ? !set.encerrado : set.encerrado) {
    return {
      bloqueio: bloqueio(
        p.entreSets ? 'RG-SAN-010' : 'RG-SET-001',
        p.entreSets ? 'Sanção entre sets só vale com o set anterior encerrado.' : 'Sanção durante o jogo só vale com um set em andamento (use "entre sets" se o set acabou).',
      ),
    }
  }
  if (p.entreSets && placar.status !== 'EM_ANDAMENTO') {
    return { bloqueio: bloqueio('RG-SAN-010', 'A partida terminou: não há set seguinte para a sanção valer.') }
  }
  if (String(p.membro).startsWith('J:')) {
    const id = Number(String(p.membro).slice(2))
    if (!contexto.elenco[p.equipe as Equipe].includes(id)) {
      return { bloqueio: bloqueio('RG-FOR-009', `O jogador ${id} não consta na relação nominal da ${nomeDaEquipe(p.equipe)}.`) }
    }
  }
  const avaliada = avaliarSancao(placar.estadoEquipes?.sancoes ?? [], {
    equipe: p.equipe,
    membro: p.membro,
    categoria: p.categoria,
    set: set.numero,
    entreSets: p.entreSets === true,
  })
  if (!avaliada.ok) return { bloqueio: bloqueio(avaliada.codigo, avaliada.mensagem) }
  return {
    avisos: [{ codigo: avaliada.codigo, mensagem: avaliada.mensagem }, ...avaliada.avisos],
    payload: {
      equipe: p.equipe,
      membro: p.membro,
      categoria: p.categoria,
      sancao: avaliada.sancao,
      pontoParaAdversario: avaliada.pontoParaAdversario,
      ...(p.entreSets ? { entreSets: true } : {}),
    },
  }
}

function checarInterrupcao(amb: Ambiente, p: Record<string, any>): Checagem {
  const anteriores = eventosEfetivos(amb.log).filter((e) => e.tipo === 'INTERRUPCAO')
  const total = anteriores.reduce((soma, e) => soma + (e.tipo === 'INTERRUPCAO' ? e.payload.minutos : 0), 0) + p.minutos
  const decisao = decidirInterrupcao({
    minutosTotaisDeParalisacao: total,
    voltaNaMesmaQuadra: p.acao === 'CONTINUAR_SET',
  })
  if (decisao.acao === 'REPETIR_PARTIDA' && p.acao !== 'REPETIR_PARTIDA') {
    return { bloqueio: bloqueio(decisao.codigo, decisao.mensagem) }
  }
  if (p.acao === 'REPETIR_PARTIDA' && total <= MINUTOS_MAX_INTERRUPCAO) {
    return {
      bloqueio: bloqueio('RG-INT-005', `Repetir a partida só vale quando as paralisações passam de ${MINUTOS_MAX_INTERRUPCAO} minutos (somam ${total}).`),
    }
  }
  return { avisos: [] }
}

function checarFaltaRotacao(amb: Ambiente, p: Record<string, any>): Checagem {
  const vivos = new Set(eventosEfetivos(amb.log).map((e) => e.seq))
  for (const campo of ['momentoSeq', 'pontoDoRallyDaFaltaSeq'] as const) {
    const seq = p[campo]
    if (seq != null && !vivos.has(seq)) {
      return { bloqueio: bloqueio('RG-ROT-002', `O evento ${seq} indicado na falta de rotação não existe ou foi desfeito.`) }
    }
  }
  return { avisos: [] }
}

/** Regras de cada tipo de evento. Devolve bloqueio ou avisos (e o payload normalizado pelo servidor). */
function checarPorTipo(amb: Ambiente, tipo: NovoEvento['tipo'], p: Record<string, any>): Checagem {
  const { placar, config } = amb
  switch (tipo) {
    case 'SET_INICIADO':
      return checarSetIniciado(amb, p)
    case 'PONTO': {
      const erro = exigirSetEmAndamento(amb, 'RG-SET-001', 'O ponto')
      if (erro) return { bloqueio: erro }
      const saca = placar.saca as Equipe
      if (p.sacador !== undefined) {
        const r = validarSacador({ formacaoA: placar.formacaoA, formacaoB: placar.formacaoB, saca }, p.sacador)
        if (!r.ok) return { bloqueio: r }
      }
      const estado = estadoOuErro(amb, saca)
      if (ehBloqueio(estado)) return { bloqueio: estado }
      const libero = validarSaqueDoLibero(estado)
      if (!libero.ok) return { bloqueio: libero }
      return { avisos: [] }
    }
    case 'SUBSTITUICAO': {
      const erro = exigirSetEmAndamento(amb, 'RG-SUB-006', 'A substituição')
      if (erro) return { bloqueio: erro }
      const estado = estadoOuErro(amb, p.equipe)
      if (ehBloqueio(estado)) return { bloqueio: estado }
      const trocas = trocasDoPayload(p as PayloadPorTipo['SUBSTITUICAO'])
      if (trocas.length === 0) {
        return { bloqueio: bloqueio('RG-SUB-007', 'Informe a troca (sai/entra) ou a lista de trocas do pedido.') }
      }
      const excepcional = p.excepcional === true
      if (excepcional) {
        if (!p.motivo) {
          return { bloqueio: bloqueio('RG-SUB-011', 'A substituição excepcional exige motivo: lesão, doença, expulsão ou desqualificação.') }
        }
        if (trocas.length > 1) {
          return { bloqueio: bloqueio('RG-SUB-011', 'A substituição excepcional é de um jogador por vez; envie um pedido para cada jogador.') }
        }
        const r = validarSubstituicaoExcepcional(estado, { ...trocas[0]!, motivo: p.motivo }, config.perfil)
        return r.ok ? { avisos: r.avisos, payload: { ...p, excepcional: true } } : { bloqueio: r }
      }
      // Pedido em lote (RG-SUB-007): simula as trocas em sequência; qualquer falha recusa o pedido todo.
      const lote = aplicarSubstituicaoLote(estado, trocas, config.perfil)
      const { motivo: _motivo, ...semMotivo } = p
      if (!lote.resultado.ok) {
        const quando = trocas.length > 1 && lote.indiceBloqueado !== null ? ` (troca ${lote.indiceBloqueado + 1} do pedido)` : ''
        return { bloqueio: bloqueio(lote.resultado.codigo, `${lote.resultado.mensagem}${quando}`) }
      }
      return { avisos: lote.resultado.avisos, payload: { ...semMotivo, excepcional: false } }
    }
    case 'TROCA_LIBERO': {
      const erro = exigirSetEmAndamento(amb, 'RG-LIB-006', 'A troca de líbero')
      if (erro) return { bloqueio: erro }
      const estado = estadoOuErro(amb, p.equipe)
      if (ehBloqueio(estado)) return { bloqueio: estado }
      const r = validarTrocaLibero(estado, { sai: p.sai, entra: p.entra }, { momento: p.momento ?? 'BOLA_FORA' })
      return r.ok ? { avisos: r.avisos } : { bloqueio: r }
    }
    case 'REDESIGNACAO_LIBERO': {
      const erro = exigirSetEmAndamento(amb, 'RG-LIB-010', 'A redesignação de líbero')
      if (erro) return { bloqueio: erro }
      const estado = estadoOuErro(amb, p.equipe)
      if (ehBloqueio(estado)) return { bloqueio: estado }
      const r = validarRedesignacaoLibero(estado, { liberoIncapaz: p.liberoIncapaz, novoLibero: p.novoLibero, motivo: 'INCAPAZ' })
      return r.ok ? { avisos: r.avisos } : { bloqueio: r }
    }
    case 'TEMPO': {
      const erro = exigirSetEmAndamento(amb, 'RG-TMP-001', 'O pedido de tempo')
      if (erro) return { bloqueio: erro }
      const usados = placar.setAtual!.contadores[p.equipe as Equipe].tempos
      const r = validarPedidoDeTempo({ temposUsados: usados, limite: config.perfil.temposPorSet, bolaForaDeJogo: true, antesDoApito: true })
      return r.ok ? { avisos: r.avisos } : { bloqueio: r }
    }
    case 'PEDIDO_INDEVIDO': {
      const erro = exigirSetEmAndamento(amb, 'RG-TMP-005', 'O registro de pedido indevido')
      if (erro) return { bloqueio: erro }
      // RG-TMP-005: o servidor classifica (registro sem sanção ou atraso) e sugere a sanção; o apontador a lança à parte.
      const equipe = p.equipe as Equipe
      const c = classificarPedidoIndevido({
        indevidosAnterioresSemAtraso: placar.pedidosIndevidos.filter((x) => x.equipe === equipe && x.consequencia === 'REGISTRO_SEM_SANCAO').length,
        atrasosAnteriores: (placar.estadoEquipes?.sancoes ?? []).filter((s) => s.equipe === equipe && s.categoria === 'ATRASO').length,
        atrasaOJogo: p.atrasaOJogo === true,
      })
      return { avisos: [{ codigo: c.codigo, mensagem: c.mensagem }] }
    }
    case 'SANCAO':
      return checarSancao(amb, p)
    case 'FALTA_POSICAO': {
      const erro = exigirSetEmAndamento(amb, 'RG-POS-003', 'A falta de posição')
      return erro ? { bloqueio: erro } : { avisos: [] }
    }
    case 'FALTA_ROTACAO':
      return checarFaltaRotacao(amb, p)
    case 'TROCA_LADO':
      return placar.setAtual?.trocaLadoPendente
        ? { avisos: [] }
        : { bloqueio: bloqueio('RG-SET-006', 'A troca de quadra só vale no set decisivo, quando a líder atinge o ponto de troca.') }
    case 'SET_ANULADO': {
      const ultimo = [...eventosEfetivos(amb.log)].reverse().find((e) => e.tipo === 'INTERRUPCAO' || e.tipo === 'SET_ANULADO')
      if (!placar.setAtual || !ultimo || ultimo.tipo !== 'INTERRUPCAO' || ultimo.payload.acao !== 'ANULAR_SET_E_REJOGAR') {
        return { bloqueio: bloqueio('RG-INT-004', 'O set só pode ser anulado depois de uma interrupção com a decisão "anular o set e rejogar".') }
      }
      return { avisos: [] }
    }
    case 'INTERRUPCAO':
      return placar.status === 'EM_ANDAMENTO'
        ? checarInterrupcao(amb, p)
        : { bloqueio: bloqueio('RG-INT-001', 'A interrupção só pode ser registrada com a partida em andamento.') }
    case 'EQUIPE_INCOMPLETA': {
      const erro = exigirSetEmAndamento(amb, 'RG-WO-005', 'Declarar equipe incompleta')
      return erro ? { bloqueio: erro } : { avisos: [] }
    }
    case 'RALLY_REPETIDO': {
      const erro = exigirSetEmAndamento(amb, 'RG-SET-001', 'O rally repetido')
      return erro ? { bloqueio: erro } : { avisos: [] }
    }
    case 'WO': {
      // RG-WO-002: antes de qualquer set, com horário previsto e horário atual, vale a tolerância do regulamento.
      if (amb.agora && amb.contexto.horarioPrevisto && placar.sets.length === 0) {
        const t = avaliarToleranciaWO(config, { horarioPrevisto: amb.contexto.horarioPrevisto, agora: amb.agora, duplo: p.ausente === 'AMBAS' })
        if (!t.resultado.ok) return { bloqueio: t.resultado }
      }
      return { avisos: [] }
    }
    case 'DISCREPANCIA_PAPELETA': {
      const erro = exigirSetEmAndamento(amb, 'RG-FOR-007', 'A discrepância de papeleta')
      if (erro) return { bloqueio: erro }
      if (p.causa === 'JOGADOR_NAO_REGISTRADO' && p.jogador === undefined) {
        return { bloqueio: bloqueio('RG-FOR-009', 'Informe o jogador não registrado que estava em quadra.') }
      }
      if (p.causa === 'JOGADOR_FORA_DA_PAPELETA') {
        if (p.jogador === undefined) return { bloqueio: bloqueio('RG-FOR-008', 'Informe o jogador que estava em quadra fora da papeleta.') }
        if (!amb.contexto.elenco[p.equipe as Equipe].includes(p.jogador)) {
          return { bloqueio: bloqueio('RG-FOR-009', `O jogador ${p.jogador} não consta na relação nominal: use a causa JOGADOR_NAO_REGISTRADO.`) }
        }
      }
      const ef = consequenciaDeDiscrepancia(p.fase, p.causa)
      return { avisos: [{ codigo: ef.codigo, mensagem: ef.mensagem }] }
    }
    case 'CAPITAO_EM_JOGO': {
      const erro = exigirSetEmAndamento(amb, 'RG-ELE-005', 'A designação do capitão em jogo')
      return erro ? { bloqueio: erro } : { avisos: [] }
    }
    case 'PROTESTO_ANUNCIADO':
    case 'PROTESTO_REGISTRADO':
    case 'PROTESTO_DESISTIDO':
      // As regras de estado (partida em andamento ou terminada, anúncio prévio) são conferidas na derivação.
      return { avisos: [] }
    case 'OBSERVACAO':
    case 'DESAFIO':
    case 'DESFAZ':
      return { avisos: [] }
  }
}

/**
 * Valida um evento novo contra o log atual. Ordem: idempotência, integridade do log, estado da
 * partida, regra do tipo e, por fim, simulação: anexa o evento e deriva de novo; se a derivação
 * ficar mais inconsistente, o evento é recusado (cobre desfazer fora de ordem).
 */
export function validarNovoEvento(
  log: readonly SumulaEvento[],
  config: ConfigPartida,
  contexto: ContextoDerivacao,
  recebido: EventoRecebido,
  agora?: string,
): ResultadoValidacao {
  const existente = log.find((e) => e.clientEventId === recebido.clientEventId)
  if (existente) return { ok: true, duplicado: true, evento: existente }

  const lido = lerPayload(recebido)
  if (!lido.ok) return lido
  const corrompido = validarLog(log)
  if (corrompido) return corrompido

  const placar = derivarPlacar(log, config, contexto)
  if (placar.status in CODIGO_ENCERRADA && recebido.tipo !== 'DESFAZ' && recebido.tipo !== 'OBSERVACAO' && !TIPOS_POS_JOGO.includes(recebido.tipo)) {
    const [codigo, mensagem] = CODIGO_ENCERRADA[placar.status as keyof typeof CODIGO_ENCERRADA]
    return bloqueio(codigo, mensagem)
  }

  const checagem = checarPorTipo({ log, config, contexto, placar, ...(agora ? { agora } : {}) }, recebido.tipo, lido.payload)
  if ('bloqueio' in checagem) return checagem.bloqueio

  const novo = {
    tipo: recebido.tipo,
    payload: checagem.payload ?? lido.payload,
    clientEventId: recebido.clientEventId,
    desfazId: recebido.desfazId ?? null,
  } as NovoEvento
  const anexado = anexarEvento(log, novo)
  if (!anexado.ok) return anexado

  const depois = derivarPlacar(anexado.log, config, contexto)
  const novas = inconsistenciasNovas(placar, depois)
  if (novas.length > 0) {
    const primeira = novas[0]!
    if (recebido.tipo === 'DESFAZ') {
      return bloqueio('RG-LOG-007', `Não dá para desfazer este evento agora: ${primeira.mensagem} Desfaça primeiro os lances seguintes.`)
    }
    return bloqueio(primeira.codigo, primeira.mensagem)
  }
  const setNumero = novo.tipo === 'SET_INICIADO' ? novo.payload.numeroSet : (placar.setAtual?.numero ?? null)
  return { ok: true, duplicado: false, novo, avisos: checagem.avisos, setNumero }
}

/* ------------------------------ projeção ------------------------------ */

interface ContadoresResumo {
  tempos: number
  substituicoesRegulares: number
  substituicoesExcepcionais: number
  trocasLibero: number
  redesignacoes: number
}

export interface EstadoSumula {
  status: PlacarDerivado['status']
  ultimoSeq: number
  setsGanhos: { a: number; b: number }
  vencedor: Equipe | null
  /** Quem saca agora. */
  saca: Equipe | null
  /** Placar do set corrente (ou do último set, se encerrado). */
  placar: { a: number; b: number } | null
  setAtual: {
    numero: number
    encerrado: boolean
    decisivo: boolean
    alvo: number
    trocaLadoPendente: boolean
    trocouLado: boolean
  } | null
  /** Rotação atual: índice 0 = posição I (saque). */
  rotacao: { A: number[]; B: number[] }
  contadores: { A: ContadoresResumo | null; B: ContadoresResumo | null }
  /** Jogadores impedidos de atuar agora (expulsos no set, desqualificados, sem retorno, líberos incapazes). */
  impedidos: { A: number[]; B: number[] }
  /** Limite de substituições e tempos do set (perfil da partida), para a tela mostrar o saldo. */
  limites: { substituicoesPorSet: number; temposPorSet: number }
  sets: Array<{ numero: number; placar: { a: number; b: number }; encerrado: boolean; vencedor: Equipe | null }>
  observacoes: Array<{ seq: number; texto: string }>
  houveCancelamentoDePontos: boolean
  inconsistencias: PlacarDerivado['inconsistencias']
}

export function projetarEstado(log: readonly SumulaEvento[], config: ConfigPartida, contexto: ContextoDerivacao): EstadoSumula {
  const p = derivarPlacar(log, config, contexto)
  const set = p.setAtual
  const eq = p.estadoEquipes
  return {
    status: p.status,
    ultimoSeq: p.ultimoSeq,
    setsGanhos: p.setsGanhos,
    vencedor: p.vencedor,
    saca: p.saca,
    placar: set ? { ...set.placar } : null,
    setAtual: set
      ? {
          numero: set.numero,
          encerrado: set.encerrado,
          decisivo: set.decisivo,
          alvo: set.alvo,
          trocaLadoPendente: set.trocaLadoPendente,
          trocouLado: set.trocouLado,
        }
      : null,
    rotacao: { A: [...p.formacaoA], B: [...p.formacaoB] },
    contadores: set ? { A: { ...set.contadores.A }, B: { ...set.contadores.B } } : { A: null, B: null },
    impedidos: { A: eq ? jogadoresImpedidos(eq.A) : [], B: eq ? jogadoresImpedidos(eq.B) : [] },
    limites: { substituicoesPorSet: config.perfil.limiteSubstituicoesPorSet, temposPorSet: config.perfil.temposPorSet },
    sets: p.sets.map((s) => ({ numero: s.numero, placar: { ...s.placar }, encerrado: s.encerrado, vencedor: s.vencedor })),
    observacoes: p.observacoes,
    houveCancelamentoDePontos: p.houveCancelamentoDePontos,
    inconsistencias: p.inconsistencias,
  }
}
