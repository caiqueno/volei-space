/**
 * WO, WO duplo, equipe incompleta e interrupção/set anulado.
 * RG-WO-001..005, RG-SAN-012, RG-INT-001..005, CJ-06, CJ-10.
 *
 * TODO [M] (CONFIG_ITENS_M.woResultadoOficial): pontuação do WO em melhor de 3 e efeito do
 * WO duplo na classificação são do regulamento; aqui só o resultado de súmula.
 */
import { MINUTOS_MAX_INTERRUPCAO, type ConfigPartida } from './config'
import { jogadoresAptos, type EstadoEquipe } from './estado-equipe'
import { alvoDoSet, setsParaVencer } from './set-partida'
import { bloqueio, ok, outraEquipe, type CodigoRegra, type Equipe, type PlacarSet, type ResultadoRegra } from './tipos'

export interface ResultadoWO {
  tipo: 'WO_SIMPLES' | 'WO_DUPLO'
  /** null no WO duplo (nenhuma vence; efeito na classificação é do regulamento). */
  vencedor: Equipe | null
  /** Placar OFICIAL da partida por WO: o presente vence pelos sets necessários e o ausente fica com 0 [M]. */
  placarPartida: { setsA: number; setsB: number }
  /** Sets que cada equipe ganhou em quadra antes do WO (registro; não entram no placar da partida). */
  setsRegistrados: { a: number; b: number }
  /** Sets já jogados (mantidos) + sets lançados como WO, cada um com o alvo do próprio set. */
  parciaisRegistrados: PlacarSet[]
  /** Placar parcial do set em andamento quando o WO foi declarado (guardado para a súmula). */
  setInterrompido: { numero: number; placar: PlacarSet } | null
  /** Quantos sets foram lançados como WO. */
  setsLancadosComoWO: number
  assinam: 'TODOS' | 'APENAS_ARBITRAGEM'
  codigo: CodigoRegra
  mensagem: string
}

/** RG-WO-002: o WO por não comparecimento só vale depois da tolerância do regulamento. */
export function validarToleranciaDeWO(minutosDeAtraso: number, toleranciaMinutos: number): ResultadoRegra {
  if (minutosDeAtraso < toleranciaMinutos) {
    return bloqueio(
      'RG-WO-002',
      `Ainda dentro da tolerância de ${toleranciaMinutos} minutos (atraso de ${minutosDeAtraso}). O WO só pode ser declarado depois dela.`,
    )
  }
  return ok()
}

function contarVencidos(sets: PlacarSet[]): { a: number; b: number } {
  let a = 0
  let b = 0
  for (const s of sets) {
    if (s.a > s.b) a += 1
    else if (s.b > s.a) b += 1
  }
  return { a, b }
}

/**
 * RG-WO-001/003/004: equipe ausente (a qualquer momento) ou WO duplo.
 * `setsJogados` são os sets COMPLETOS já disputados (mantidos na súmula).
 */
export function resolverWO(
  config: ConfigPartida,
  params: {
    ausente: Equipe | 'AMBAS'
    setsJogados?: PlacarSet[]
    setInterrompido?: { numero: number; placar: PlacarSet } | null
  },
): ResultadoWO {
  const jogados = params.setsJogados ?? []
  if (params.ausente === 'AMBAS') {
    return {
      tipo: 'WO_DUPLO',
      vencedor: null,
      placarPartida: { setsA: 0, setsB: 0 },
      setsRegistrados: contarVencidos(jogados),
      parciaisRegistrados: [...jogados],
      setInterrompido: params.setInterrompido ?? null,
      setsLancadosComoWO: 0,
      assinam: 'APENAS_ARBITRAGEM',
      codigo: 'RG-WO-004',
      mensagem: 'As duas equipes foram declaradas ausentes (WO duplo): ninguém vence; só a arbitragem assina e o efeito na classificação segue o regulamento.',
    }
  }
  const vencedor = outraEquipe(params.ausente)
  const necessarios = setsParaVencer(config.melhorDe)
  const vencidos = contarVencidos(jogados)
  const ganhosVencedor = vencedor === 'A' ? vencidos.a : vencidos.b
  const faltam = Math.max(0, necessarios - ganhosVencedor)
  const parciais = [...jogados]
  for (let i = 0; i < faltam; i += 1) {
    // O set lançado como WO usa o alvo do próprio set (regular ou decisivo), não um 25 fixo.
    const alvo = alvoDoSet(config, jogados.length + i + 1)
    parciais.push(vencedor === 'A' ? { a: alvo, b: 0 } : { a: 0, b: alvo })
  }
  return {
    tipo: 'WO_SIMPLES',
    vencedor,
    placarPartida: { setsA: vencedor === 'A' ? necessarios : 0, setsB: vencedor === 'B' ? necessarios : 0 },
    setsRegistrados: vencidos,
    parciaisRegistrados: parciais,
    setInterrompido: params.setInterrompido ?? null,
    setsLancadosComoWO: faltam,
    assinam: 'TODOS',
    codigo: 'RG-WO-001',
    mensagem: `Equipe ${params.ausente} declarada ausente: vitória da equipe ${vencedor} por ${necessarios} sets a 0, com o alvo do set x0 nos sets não jogados; sets já jogados ficam registrados.`,
  }
}

export interface ResultadoIncompleta {
  escopo: 'SET' | 'JOGO'
  equipeIncompleta: Equipe
  /** Placar do set em que ocorreu, já ajustado (RG-WO-005). */
  placarSetAjustado: PlacarSet
  /** Sets adicionais lançados no escopo JOGO (alvo x 0). */
  setsAdicionais: PlacarSet[]
  vencedorDoSet: Equipe
  vencedorDaPartida: Equipe | null
  codigo: CodigoRegra
  mensagem: string
}

/**
 * RG-WO-005 / RG-SAN-012: equipe incompleta perde o set (ou o jogo) mantendo seus pontos e sets;
 * o adversário recebe os pontos (ou pontos e sets) necessários para vencer.
 */
export function resolverEquipeIncompleta(
  config: ConfigPartida,
  params: {
    equipeIncompleta: Equipe
    escopo: 'SET' | 'JOGO'
    numeroSet: number
    placarAtual: PlacarSet
    /** Sets completos anteriores (para contar sets no escopo JOGO). */
    setsJogados?: PlacarSet[]
  },
): ResultadoIncompleta {
  const adversario = outraEquipe(params.equipeIncompleta)
  const alvo = alvoDoSet(config, params.numeroSet)
  const pontosIncompleta = params.equipeIncompleta === 'A' ? params.placarAtual.a : params.placarAtual.b
  const pontosAdversarioAtual = adversario === 'A' ? params.placarAtual.a : params.placarAtual.b
  const necessarios = Math.max(alvo, pontosIncompleta + config.margem)
  const pontosAdversario = Math.max(pontosAdversarioAtual, necessarios)
  const placarSetAjustado: PlacarSet =
    adversario === 'A' ? { a: pontosAdversario, b: pontosIncompleta } : { a: pontosIncompleta, b: pontosAdversario }

  const setsAdicionais: PlacarSet[] = []
  let vencedorDaPartida: Equipe | null = null
  if (params.escopo === 'JOGO') {
    const vencidos = contarVencidos([...(params.setsJogados ?? []), placarSetAjustado])
    let ganhos = adversario === 'A' ? vencidos.a : vencidos.b
    const total = (params.setsJogados?.length ?? 0) + 1
    let proximo = total + 1
    const exigidos = setsParaVencer(config.melhorDe)
    while (ganhos < exigidos) {
      const a = alvoDoSet(config, proximo)
      setsAdicionais.push(adversario === 'A' ? { a, b: 0 } : { a: 0, b: a })
      ganhos += 1
      proximo += 1
    }
    vencedorDaPartida = adversario
  }

  return {
    escopo: params.escopo,
    equipeIncompleta: params.equipeIncompleta,
    placarSetAjustado,
    setsAdicionais,
    vencedorDoSet: adversario,
    vencedorDaPartida,
    codigo: params.escopo === 'SET' ? 'RG-WO-005' : 'RG-SAN-012',
    mensagem:
      params.escopo === 'SET'
        ? `Equipe ${params.equipeIncompleta} incompleta: perde o set mantendo seus ${pontosIncompleta} pontos; a equipe ${adversario} recebe os pontos necessários (${placarSetAjustado.a}x${placarSetAjustado.b}).`
        : `Equipe ${params.equipeIncompleta} incompleta para o jogo: perde a partida mantendo pontos e sets; a equipe ${adversario} recebe o necessário para vencer.`,
  }
}

/** RG-WO-005: o próximo set só pode ser disputado se a equipe tiver 6 jogadores aptos. */
export function equipePodeJogarProximoSet(estado: EstadoEquipe): ResultadoRegra {
  const aptos = jogadoresAptos(estado).length
  if (aptos < 6) {
    return bloqueio(
      'RG-WO-005',
      `A equipe tem só ${aptos} jogador(es) apto(s) (mínimo 6): fica incompleta para o jogo.`,
    )
  }
  return ok()
}

export type AcaoInterrupcao = 'CONTINUAR_SET' | 'ANULAR_SET_E_REJOGAR' | 'REPETIR_PARTIDA'

/** RG-INT-003/004/005: decisão após interrupção imprevista (falta de energia, goteira...). */
export function decidirInterrupcao(params: { minutosTotaisDeParalisacao: number; voltaNaMesmaQuadra: boolean }): {
  acao: AcaoInterrupcao
  codigo: CodigoRegra
  mensagem: string
} {
  if (params.minutosTotaisDeParalisacao > MINUTOS_MAX_INTERRUPCAO) {
    return {
      acao: 'REPETIR_PARTIDA',
      codigo: 'RG-INT-005',
      mensagem: 'As paralisações somam mais de 4 horas: toda a partida é repetida.',
    }
  }
  if (params.voltaNaMesmaQuadra) {
    return {
      acao: 'CONTINUAR_SET',
      codigo: 'RG-INT-003',
      mensagem: 'O jogo volta na mesma quadra: o set continua com o mesmo placar, jogadores e posições; registre início e fim da interrupção.',
    }
  }
  return {
    acao: 'ANULAR_SET_E_REJOGAR',
    codigo: 'RG-INT-004',
    mensagem: 'O jogo volta em outra quadra: o set interrompido é anulado e rejogado do 0x0 com as mesmas formações iniciais (exceto expulsos/desqualificados); sanções são mantidas e abre-se súmula anexa.',
  }
}

/** Modelo padronizado da observação (RG-INT-003, Guia p.103). */
export function observacaoInterrupcao(params: {
  numeroSet: number
  pontosA: number
  pontosB: number
  minutos: number
  motivo: string
}): string {
  return `JOGO INTERROMPIDO NO ${params.numeroSet}º SET, PLACAR ${params.pontosA}X${params.pontosB}, POR ${params.minutos} MINUTOS, POR MOTIVO DE ${params.motivo.toUpperCase()}`
}
