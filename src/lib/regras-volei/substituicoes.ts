/**
 * Substituições: limite configurável por perfil (padrão FIVB/CBV = 6; amador = 8 com alerta),
 * par A-B, substituição excepcional (contador próprio; lesionado não volta) e
 * equipe incompleta. RG-SUB-001..014, CJ-01, CJ-07.
 */
import { LIMITE_OFICIAL_SUBSTITUICOES, type PerfilRegras } from './config'
import {
  ehLibero,
  jogadorImpedido,
  substituirNaQuadra,
  totalSubstituicoes,
  type EstadoEquipe,
} from './estado-equipe'
import { calcularReversaoFaltaRotacao, type PontoLog, type ReversaoRotacao } from './rotacao'
import { aviso, bloqueio, ok, type AvisoRegra, type CodigoRegra, type Equipe, type ResultadoRegra } from './tipos'

export interface PedidoSubstituicao {
  /** Jogador que sai (em quadra). */
  sai: number
  /** Jogador que entra (fora de quadra). */
  entra: number
}

export type MotivoExcepcional = 'LESAO' | 'DOENCA' | 'EXPULSAO' | 'DESQUALIFICACAO'
const MOTIVOS_EXCEPCIONAIS: readonly MotivoExcepcional[] = ['LESAO', 'DOENCA', 'EXPULSAO', 'DESQUALIFICACAO']

export interface PedidoExcepcional extends PedidoSubstituicao {
  motivo: MotivoExcepcional
}

function validarParticipantes(estado: EstadoEquipe, pedido: PedidoSubstituicao): ResultadoRegra | null {
  const { sai, entra } = pedido
  if (!estado.elenco.includes(entra)) {
    return bloqueio('RG-FOR-009', `O jogador ${entra} não consta na relação nominal da equipe e não pode entrar em quadra.`)
  }
  if (!estado.emQuadra.includes(sai)) {
    return bloqueio('RG-SUB-006', `O jogador ${sai} não está em quadra, então não pode ser substituído.`)
  }
  if (estado.emQuadra.includes(entra)) {
    return bloqueio('RG-SUB-006', `O jogador ${entra} já está em quadra.`)
  }
  if (ehLibero(estado, sai) || ehLibero(estado, entra)) {
    return bloqueio('RG-LIB-006', 'Entrada e saída de líbero não são substituição: use a troca de líbero, que tem regras próprias.')
  }
  if (estado.substituidoPorLibero === entra) {
    return bloqueio('RG-LIB-006', `O jogador ${entra} está sendo substituído pelo líbero e só volta por troca de líbero.`)
  }
  if (jogadorImpedido(estado, entra)) {
    return impedimento(estado, entra)
  }
  return null
}

function impedimento(estado: EstadoEquipe, jogador: number): ResultadoRegra {
  if (estado.desqualificados.includes(jogador)) {
    return bloqueio('RG-SAN-008', `O jogador ${jogador} foi desqualificado e não participa mais da partida.`)
  }
  if (estado.expulsosNoSet.includes(jogador)) {
    return bloqueio('RG-SAN-007', `O jogador ${jogador} foi expulso e não participa do restante do set.`)
  }
  return bloqueio('RG-SUB-011', `O jogador ${jogador} foi substituído excepcionalmente (lesão) e não volta mais à partida.`)
}

/** Valida uma substituição REGULAR (conta no limite do set). */
export function validarSubstituicaoRegular(
  estado: EstadoEquipe,
  pedido: PedidoSubstituicao,
  perfil: PerfilRegras,
): ResultadoRegra {
  const basico = validarParticipantes(estado, pedido)
  if (basico) return basico
  const { sai, entra } = pedido
  const avisos: AvisoRegra[] = []

  if (estado.pedidoNaInterrupcao) {
    return bloqueio(
      'RG-SUB-007',
      'Já houve pedido de substituição nesta interrupção. É preciso concluir um rally antes de outro pedido (exceto lesão, expulsão ou desqualificação).',
    )
  }

  const retorno = estado.pares.find((p) => p.reserva === sai && p.titular === entra && !p.retornou)
  if (!retorno) {
    const saiEhTitular = estado.titularesSet.includes(sai)
    const parAnterior = estado.pares.find((p) => p.titular === sai)
    const ciclo = (motivo: string): ResultadoRegra | null => {
      if (!perfil.permitirParRepetido) return bloqueio('RG-SUB-003', motivo)
      avisos.push(aviso('RG-SUB-003', `${motivo} Permitido só no perfil amador; é substituição ilegal pela FIVB/CBV.`))
      return null
    }

    if (!saiEhTitular) {
      // Reserva em quadra: só pode ser substituído pelo próprio titular (RG-SUB-004).
      const parDoReserva = estado.pares.find((p) => p.reserva === sai)
      if (!parDoReserva || parDoReserva.titular !== entra) {
        return bloqueio('RG-SUB-004', `O jogador ${sai} entrou como reserva e só pode ser substituído pelo titular que ele substituiu.`)
      }
      const r = ciclo(`O titular ${entra} já usou a saída e o retorno neste set.`)
      if (r) return r
    } else if (parAnterior) {
      // Titular que já saiu uma vez e voltou: segunda saída (RG-SUB-003).
      if (parAnterior.reserva !== entra) {
        return bloqueio('RG-SUB-003', `O titular ${sai} já saiu uma vez neste set; só pode sair de novo na repetição do mesmo par.`)
      }
      const r = ciclo(`O titular ${sai} já saiu e voltou uma vez neste set.`)
      if (r) return r
    } else {
      if (estado.jaEntraramNoSet.includes(entra)) {
        const r = ciclo(`O reserva ${entra} já entrou neste set (RG-SUB-004: uma entrada por set).`)
        if (r) return r
      } else if (estado.titularesSet.includes(entra)) {
        return bloqueio('RG-SUB-003', `O titular ${entra} já saiu neste set e só pode voltar à sua posição, no lugar de quem o substituiu.`)
      }
    }
  }

  // Limite por set (RG-SUB-001), configurável por perfil.
  if (estado.regulares >= perfil.limiteSubstituicoesPorSet) {
    return bloqueio(
      'RG-SUB-001',
      `Limite de ${perfil.limiteSubstituicoesPorSet} substituições por set atingido (perfil ${perfil.id}).`,
    )
  }
  if (perfil.alertarAcimaDoOficial && estado.regulares + 1 > LIMITE_OFICIAL_SUBSTITUICOES) {
    avisos.push(
      aviso(
        'RG-SUB-001',
        `Esta é a ${estado.regulares + 1}ª substituição do set: passa do limite oficial de ${LIMITE_OFICIAL_SUBSTITUICOES} da FIVB/CBV e seria substituição ilegal nessas competições (RG-SUB-009).`,
      ),
    )
  }
  return ok(avisos)
}

export interface ResultadoAplicacao {
  resultado: ResultadoRegra
  /** Estado novo (igual ao anterior se houve bloqueio). */
  estado: EstadoEquipe
}

export function aplicarSubstituicaoRegular(
  estado: EstadoEquipe,
  pedido: PedidoSubstituicao,
  perfil: PerfilRegras,
): ResultadoAplicacao {
  const resultado = validarSubstituicaoRegular(estado, pedido, perfil)
  if (!resultado.ok) return { resultado, estado }
  const { sai, entra } = pedido
  const retorno = estado.pares.find((p) => p.reserva === sai && p.titular === entra && !p.retornou)
  const pares = retorno
    ? estado.pares.map((p) => (p === retorno ? { ...p, retornou: true } : p))
    : [...estado.pares, { titular: sai, reserva: entra, retornou: false }]
  // Titular que volta ao lugar do reserva (ou titular saindo): reserva só registra entrada ao entrar.
  const jaEntraram =
    retorno || estado.jaEntraramNoSet.includes(entra) ? estado.jaEntraramNoSet : [...estado.jaEntraramNoSet, entra]
  return {
    resultado,
    estado: {
      ...estado,
      emQuadra: substituirNaQuadra(estado, sai, entra),
      regulares: estado.regulares + 1,
      pares,
      jaEntraramNoSet: jaEntraram,
      pedidoNaInterrupcao: true,
    },
  }
}

/** Há alguma substituição regular legal para tirar `sai`? (RG-SUB-011: excepcional só sem legal). */
export function existeSubstituicaoRegular(estado: EstadoEquipe, sai: number, perfil: PerfilRegras): boolean {
  const naoPodeContarInterrupcao: EstadoEquipe = { ...estado, pedidoNaInterrupcao: false }
  return estado.elenco.some(
    (candidato) => validarSubstituicaoRegular(naoPodeContarInterrupcao, { sai, entra: candidato }, perfil).ok,
  )
}

/** Candidatos a entrar em substituição excepcional (RG-SUB-011). */
export function candidatosExcepcionais(estado: EstadoEquipe): number[] {
  return estado.elenco.filter(
    (j) =>
      !estado.emQuadra.includes(j) &&
      !ehLibero(estado, j) &&
      estado.substituidoPorLibero !== j &&
      !jogadorImpedido(estado, j),
  )
}

/**
 * RG-SUB-010/011: substituição excepcional por lesão/doença/expulsão/desqualificação.
 * Não consome o limite regular, não exige rally entre pedidos (15.2.3), tem contador próprio
 * e o substituído não volta.
 */
export function validarSubstituicaoExcepcional(
  estado: EstadoEquipe,
  pedido: PedidoExcepcional,
  perfil: PerfilRegras,
): ResultadoRegra {
  if (!MOTIVOS_EXCEPCIONAIS.includes(pedido.motivo)) {
    return bloqueio('RG-SUB-011', 'A substituição excepcional exige motivo: lesão, doença, expulsão ou desqualificação.')
  }
  const basico = validarParticipantes(estado, pedido)
  if (basico) return basico
  if (!candidatosExcepcionais(estado).includes(pedido.entra)) {
    return bloqueio('RG-SUB-011', `O jogador ${pedido.entra} não pode entrar em substituição excepcional.`)
  }
  if (existeSubstituicaoRegular(estado, pedido.sai, perfil)) {
    return bloqueio(
      'RG-SUB-011',
      'Existe substituição regular possível para este jogador; a substituição excepcional só vale quando não há substituição legal.',
    )
  }
  return ok()
}

export function aplicarSubstituicaoExcepcional(
  estado: EstadoEquipe,
  pedido: PedidoExcepcional,
  perfil: PerfilRegras,
): ResultadoAplicacao {
  const resultado = validarSubstituicaoExcepcional(estado, pedido, perfil)
  if (!resultado.ok) return { resultado, estado }
  const novo: EstadoEquipe = {
    ...estado,
    emQuadra: substituirNaQuadra(estado, pedido.sai, pedido.entra),
    excepcionais: estado.excepcionais + 1,
    semRetorno: [...estado.semRetorno, pedido.sai],
    expulsosNoSet:
      pedido.motivo === 'EXPULSAO' && !estado.expulsosNoSet.includes(pedido.sai)
        ? [...estado.expulsosNoSet, pedido.sai]
        : estado.expulsosNoSet,
    desqualificados:
      pedido.motivo === 'DESQUALIFICACAO' && !estado.desqualificados.includes(pedido.sai)
        ? [...estado.desqualificados, pedido.sai]
        : estado.desqualificados,
  }
  return { resultado, estado: novo }
}

export interface SaidaSemSubstituto {
  acao: 'RECUPERACAO_3_MIN' | 'EQUIPE_INCOMPLETA'
  codigo: CodigoRegra
  mensagem: string
}

/**
 * RG-SUB-012/013: jogador que não pode continuar, sem substituição legal nem excepcional.
 * Lesão: 3 min de recuperação, uma vez por jogador; sem recuperação, equipe incompleta.
 */
export function resolverSemSubstituto(
  estado: EstadoEquipe,
  jogador: number,
  motivo: MotivoExcepcional,
): SaidaSemSubstituto {
  const podeRecuperar = (motivo === 'LESAO' || motivo === 'DOENCA') && !estado.recuperacaoUsada.includes(jogador)
  if (podeRecuperar) {
    return {
      acao: 'RECUPERACAO_3_MIN',
      codigo: 'RG-SUB-013',
      mensagem: `Sem substituto possível: conceder 3 minutos de recuperação ao jogador ${jogador} (uma vez por jogador na partida). Se não se recuperar, a equipe é declarada incompleta.`,
    }
  }
  return {
    acao: 'EQUIPE_INCOMPLETA',
    codigo: motivo === 'EXPULSAO' || motivo === 'DESQUALIFICACAO' ? 'RG-SUB-012' : 'RG-SUB-013',
    mensagem: `Sem substituto legal ou excepcional e sem recuperação disponível para o jogador ${jogador}: a equipe é declarada incompleta.`,
  }
}

/**
 * RG-SUB-012: jogador em quadra expulso/desqualificado. Decide o caminho imediato:
 * substituição legal, depois excepcional, depois incompleta.
 */
export function caminhoParaJogadorImpedido(
  estado: EstadoEquipe,
  jogador: number,
  motivo: 'EXPULSAO' | 'DESQUALIFICACAO',
  perfil: PerfilRegras,
): { via: 'REGULAR' | 'EXCEPCIONAL' | 'INCOMPLETA'; candidatos: number[]; mensagem: string } {
  // A substituição por sanção é imediata: não depende de rally concluído (RG-SUB-007).
  const livres: EstadoEquipe = { ...estado, pedidoNaInterrupcao: false }
  void motivo
  const regulares = estado.elenco.filter((c) => validarSubstituicaoRegular(livres, { sai: jogador, entra: c }, perfil).ok)
  if (regulares.length > 0) {
    return { via: 'REGULAR', candidatos: regulares, mensagem: 'Substitua imediatamente o jogador sancionado por uma substituição regular.' }
  }
  const excepcionais = candidatosExcepcionais(livres)
  if (excepcionais.length > 0) {
    return { via: 'EXCEPCIONAL', candidatos: excepcionais, mensagem: 'Sem substituição regular: use a substituição excepcional.' }
  }
  return { via: 'INCOMPLETA', candidatos: [], mensagem: 'Sem substituição regular nem excepcional: a equipe é declarada incompleta (RG-SUB-012).' }
}

export type ConsequenciaSubstituicaoIlegal =
  | { tipo: 'ATRASO'; codigo: 'RG-SUB-009'; mensagem: string }
  | { tipo: 'REVERSAO'; codigo: 'RG-SUB-009'; mensagem: string; reversao: ReversaoRotacao }

/**
 * RG-SUB-009 / CJ-07: substituição ilegal. Vista antes de reiniciar o jogo vale só atraso;
 * depois do reinício: ponto e saque ao adversário e cancelamento dos pontos da equipe faltosa
 * desde a substituição (mesma reversão seletiva da falta de rotação), com nova súmula do set.
 */
export function consequenciaSubstituicaoIlegal(params: {
  equipeFaltosa: Equipe
  descobertaAntesDoReinicio: boolean
  /** seq do 1º evento após a substituição ilegal (início do cancelamento). */
  momentoSeq: number | null
  pontosDoSet: readonly PontoLog[]
}): ConsequenciaSubstituicaoIlegal {
  if (params.descobertaAntesDoReinicio) {
    return {
      tipo: 'ATRASO',
      codigo: 'RG-SUB-009',
      mensagem: 'Substituição ilegal vista antes do reinício do jogo: corrija e aplique sanção de atraso (advertência; penalidade no 2º atraso).',
    }
  }
  const reversao = calcularReversaoFaltaRotacao(params.pontosDoSet, {
    equipeFaltosa: params.equipeFaltosa,
    momentoSeq: params.momentoSeq,
  })
  return {
    tipo: 'REVERSAO',
    codigo: 'RG-SUB-009',
    mensagem: `Substituição ilegal vista após o reinício: ponto e saque ao adversário, substituição retificada e ${reversao.cancelados.length} ponto(s) da equipe ${params.equipeFaltosa} cancelado(s); abra nova súmula do set.`,
    reversao,
  }
}

export { totalSubstituicoes }
