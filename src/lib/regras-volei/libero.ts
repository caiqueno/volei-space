/**
 * Líbero: só fundo de quadra, rally concluído entre trocas, jogador regular ou outro líbero,
 * momento da troca, saque proibido e redesignação. RG-LIB-001..014, CJ-02, CJ-08.
 * A troca de líbero NÃO é substituição (não consome o limite, RG-LIB-005 / D7).
 */
import { jogadorImpedido, substituirNaQuadra, type EstadoEquipe } from './estado-equipe'
import { ehPosicaoDeFundo } from './rotacao'
import { aviso, bloqueio, ok, type AvisoRegra, type ResultadoRegra } from './tipos'

export type MomentoDaTroca = 'BOLA_FORA' | 'APOS_APITO' | 'EM_JOGO'

export interface TrocaLibero {
  /** Quem entra em quadra. */
  entra: number
  /** Quem sai de quadra. */
  sai: number
}

export interface ContextoTrocaLibero {
  momento: MomentoDaTroca
  /** RG-LIB-005: exceções (líbero incapaz; penalidade que leva o líbero à posição IV). */
  excecaoRally?: boolean
  /** RG-LIB-007: a primeira troca do set exige papeleta conferida pelo 2º árbitro. */
  primeiraTrocaDoSet?: boolean
  papeletaConferida?: boolean
}

/** RG-LIB-001: até 2 líberos, da relação nominal (FIVB obriga 2 com mais de 12 jogadores). */
export function validarRegistroDeLiberos(liberos: number[], elenco: number[]): ResultadoRegra {
  if (liberos.length > 2) return bloqueio('RG-LIB-001', 'Cada equipe pode ter no máximo 2 líberos.')
  if (new Set(liberos).size !== liberos.length) return bloqueio('RG-LIB-001', 'Líbero repetido.')
  const fora = liberos.find((l) => !elenco.includes(l))
  if (fora !== undefined) return bloqueio('RG-LIB-001', `O líbero ${fora} não consta na relação nominal.`)
  return ok()
}

export function validarTrocaLibero(estado: EstadoEquipe, troca: TrocaLibero, ctx: ContextoTrocaLibero): ResultadoRegra {
  const { entra, sai } = troca
  const avisos: AvisoRegra[] = []
  const saiEhLibero = estado.liberos.includes(sai)
  const entraEhLibero = estado.liberos.includes(entra)

  if (!estado.emQuadra.includes(sai)) {
    return bloqueio('RG-LIB-006', `O jogador ${sai} não está em quadra.`)
  }
  if (estado.emQuadra.includes(entra)) {
    return bloqueio('RG-LIB-006', `O jogador ${entra} já está em quadra.`)
  }
  if (!estado.elenco.includes(entra)) {
    return bloqueio('RG-FOR-009', `O jogador ${entra} não consta na relação nominal.`)
  }
  if (estado.liberosIncapazes.includes(entra) || estado.liberosIncapazes.includes(sai)) {
    return bloqueio('RG-LIB-011', 'Líbero incapaz/redesignado não joga mais na partida.')
  }

  if (!saiEhLibero && entraEhLibero) {
    // Líbero ENTRA no lugar de jogador regular.
    if (estado.emQuadra.some((j) => estado.liberos.includes(j))) {
      return bloqueio('RG-LIB-002', 'Só um líbero por vez em quadra: tire o líbero atual antes.')
    }
    const indice = estado.emQuadra.indexOf(sai)
    if (!ehPosicaoDeFundo(indice)) {
      return bloqueio('RG-LIB-003', `O líbero só substitui jogador de fundo de quadra (posições I, V ou VI). O jogador ${sai} está na frente.`)
    }
  } else if (saiEhLibero && !entraEhLibero) {
    // Líbero SAI: só o jogador regular substituído ou outro líbero (RG-LIB-006 / CJ-08).
    if (estado.substituidoPorLibero !== entra) {
      return bloqueio(
        'RG-LIB-006',
        `O líbero só pode ser substituído pelo jogador regular da posição (${estado.substituidoPorLibero ?? 'nenhum'}) ou pelo segundo líbero, não pelo jogador ${entra}.`,
      )
    }
  } else if (saiEhLibero && entraEhLibero) {
    // Entre dois líberos: permitido (19.3.2.2); "Troca" em branco na folha de controle.
  } else {
    return bloqueio('RG-LIB-006', 'Troca de líbero precisa envolver um líbero. Para dois jogadores regulares use a substituição.')
  }

  if (jogadorImpedido(estado, entra)) {
    return bloqueio('RG-SUB-011', `O jogador ${entra} está impedido de atuar.`)
  }

  if (ctx.primeiraTrocaDoSet && !ctx.papeletaConferida) {
    return bloqueio('RG-LIB-007', 'A primeira troca de líbero do set só vale depois de o 2º árbitro conferir a papeleta.')
  }
  if (ctx.momento === 'EM_JOGO') {
    return bloqueio('RG-LIB-008', 'A troca de líbero só pode ser feita com a bola fora de jogo e antes do apito do saque.')
  }
  if (!estado.rallyConcluidoDesdeTrocaLibero && !ctx.excecaoRally) {
    return bloqueio('RG-LIB-005', 'É preciso concluir um rally entre duas trocas de líbero.')
  }
  if (ctx.momento === 'APOS_APITO') {
    avisos.push(aviso('RG-LIB-008', 'Troca feita após o apito, antes do golpe de saque: não rejeitar; advertir o capitão (reincidência é atraso).'))
  }
  return ok(avisos)
}

export interface ResultadoAplicacaoLibero {
  resultado: ResultadoRegra
  estado: EstadoEquipe
}

export function aplicarTrocaLibero(estado: EstadoEquipe, troca: TrocaLibero, ctx: ContextoTrocaLibero): ResultadoAplicacaoLibero {
  const resultado = validarTrocaLibero(estado, troca, ctx)
  if (!resultado.ok) return { resultado, estado }
  const { entra, sai } = troca
  const saiEhLibero = estado.liberos.includes(sai)
  const entraEhLibero = estado.liberos.includes(entra)
  let substituidoPorLibero = estado.substituidoPorLibero
  if (!saiEhLibero && entraEhLibero) substituidoPorLibero = sai
  else if (saiEhLibero && !entraEhLibero) substituidoPorLibero = null
  return {
    resultado,
    estado: {
      ...estado,
      emQuadra: substituirNaQuadra(estado, sai, entra),
      substituidoPorLibero,
      rallyConcluidoDesdeTrocaLibero: false,
    },
  }
}

/** RG-LIB-004: líbero não saca. Retorna bloqueio se o sacador da vez for líbero. */
export function validarSaqueDoLibero(estado: EstadoEquipe): ResultadoRegra {
  const sacador = estado.emQuadra[0]
  if (sacador !== undefined && estado.liberos.includes(sacador)) {
    return bloqueio('RG-LIB-004', `O líbero (${sacador}) está na posição de saque e não pode sacar: troque-o pelo jogador regular antes do saque.`)
  }
  return ok()
}

export type DescobertaTrocaIlegal = 'ANTES_PROXIMO_RALLY' | 'APOS_SAQUE'

/** RG-LIB-009 / CJ-08: consequência de troca ilegal de líbero conforme o momento da descoberta. */
export function consequenciaTrocaLiberoIlegal(descoberta: DescobertaTrocaIlegal): {
  consequencia: 'CORRIGIR_E_ATRASO' | 'SUBSTITUICAO_ILEGAL'
  codigo: 'RG-LIB-009'
  mensagem: string
} {
  if (descoberta === 'ANTES_PROXIMO_RALLY') {
    return { consequencia: 'CORRIGIR_E_ATRASO', codigo: 'RG-LIB-009', mensagem: 'Troca ilegal de líbero vista antes do próximo rally: corrigir e aplicar sanção de atraso.' }
  }
  return {
    consequencia: 'SUBSTITUICAO_ILEGAL',
    codigo: 'RG-LIB-009',
    mensagem: 'Troca ilegal de líbero vista após o golpe de saque: tratar como substituição ilegal (ponto e saque ao adversário, cancelamento de pontos da equipe faltosa e nova súmula do set).',
  }
}

export type MotivoLiberoIncapaz = 'LESIONADO' | 'DOENTE' | 'EXPULSO' | 'DESQUALIFICADO' | 'INCAPAZ'

export interface RedesignacaoLibero {
  liberoIncapaz: number
  novoLibero: number
  motivo: MotivoLiberoIncapaz
}

export interface ContextoRedesignacao {
  equipe: 'A' | 'B'
  numeroSet: number
  /** Pontos da equipe em questão e do adversário (a observação cita a equipe primeiro). */
  pontosEquipe: number
  pontosAdversario: number
}

export function validarRedesignacaoLibero(estado: EstadoEquipe, r: RedesignacaoLibero): ResultadoRegra {
  if (!estado.liberos.includes(r.liberoIncapaz)) {
    return bloqueio('RG-LIB-010', `O jogador ${r.liberoIncapaz} não é líbero ativo da equipe.`)
  }
  const outrosCapazes = estado.liberos.filter((l) => l !== r.liberoIncapaz)
  if (outrosCapazes.length > 0) {
    return bloqueio(
      'RG-LIB-012',
      'A equipe tem outro líbero capaz: segue com ele, sem redesignação (só se o restante também ficar incapaz). Líbero expulso/desqualificado: o segundo entra imediatamente.',
    )
  }
  const { novoLibero } = r
  if (!estado.elenco.includes(novoLibero)) {
    return bloqueio('RG-LIB-010', `O jogador ${novoLibero} não consta na relação nominal.`)
  }
  if (estado.emQuadra.includes(novoLibero)) {
    return bloqueio('RG-LIB-010', 'O novo líbero não pode ser jogador que está em quadra.')
  }
  if (estado.substituidoPorLibero === novoLibero) {
    return bloqueio('RG-LIB-010', 'O novo líbero não pode ser o jogador regular que o líbero substituía.')
  }
  // TODO [M] CONFIG_ITENS_M.redesignadoNaoJogaComoLinha: o redesignado deixa de ser jogador de linha (inferência de 19.4.2.1).
  if (jogadorImpedido(estado, novoLibero) || estado.liberosIncapazes.includes(novoLibero)) {
    return bloqueio('RG-LIB-010', `O jogador ${novoLibero} está impedido de atuar.`)
  }
  return ok()
}

/**
 * RG-LIB-010/011: marca o líbero como incapaz (lesão, doença, expulsão, desqualificação) SEM exigir
 * redesignação. Havendo outro líbero capaz, a equipe segue com ele; sem nenhum, segue sem líbero
 * (a redesignação é opcional e vem depois). Libera a troca fora da regra do rally (RG-LIB-005,
 * exceção do líbero incapaz) para tirá-lo de quadra, se estiver nela.
 */
export function declararLiberoIncapaz(
  estado: EstadoEquipe,
  liberoId: number,
  motivo: MotivoLiberoIncapaz,
): ResultadoAplicacaoLibero & { motivo: MotivoLiberoIncapaz; aindaEmQuadra: boolean } {
  if (!estado.liberos.includes(liberoId)) {
    return {
      resultado: bloqueio('RG-LIB-010', `O jogador ${liberoId} não é líbero ativo da equipe.`),
      estado,
      motivo,
      aindaEmQuadra: false,
    }
  }
  return {
    resultado: ok(),
    motivo,
    aindaEmQuadra: estado.emQuadra.includes(liberoId),
    estado: {
      ...estado,
      liberos: estado.liberos.filter((l) => l !== liberoId),
      liberosIncapazes: [...estado.liberosIncapazes, liberoId],
      rallyConcluidoDesdeTrocaLibero: true,
    },
  }
}

/** Texto padronizado da observação (modelo RG-LIB-013, Guia p.77/120). */
export function observacaoRedesignacao(r: RedesignacaoLibero, ctx: ContextoRedesignacao): string {
  return `REDESIGNAÇÃO DE LÍBERO, EQUIPE ${ctx.equipe}, LÍBERO Nº ${r.liberoIncapaz} ${r.motivo}, NOVO LÍBERO JOGADOR Nº ${r.novoLibero}, ${ctx.numeroSet}º SET, PLACAR ${ctx.pontosEquipe}X${ctx.pontosAdversario}`
}

export function aplicarRedesignacaoLibero(
  estado: EstadoEquipe,
  r: RedesignacaoLibero,
  ctx: ContextoRedesignacao,
): ResultadoAplicacaoLibero & { observacao: string | null } {
  const resultado = validarRedesignacaoLibero(estado, r)
  if (!resultado.ok) return { resultado, estado, observacao: null }
  const emQuadra = estado.emQuadra.includes(r.liberoIncapaz)
    ? substituirNaQuadra(estado, r.liberoIncapaz, r.novoLibero) // entra direta e imediatamente (19.4.2.2)
    : estado.emQuadra
  return {
    resultado,
    observacao: observacaoRedesignacao(r, ctx),
    estado: {
      ...estado,
      emQuadra,
      liberos: [r.novoLibero],
      liberosIncapazes: [...estado.liberosIncapazes, r.liberoIncapaz],
    },
  }
}
