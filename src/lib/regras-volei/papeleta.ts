/**
 * Papeleta (ficha de formação inicial do set): imutabilidade e discrepâncias.
 * RG-FOR-006 (imutável depois de entregue), RG-FOR-007 (discrepância ANTES do set),
 * RG-FOR-008 (DEPOIS do início) e RG-FOR-009 (jogador não registrado). Módulo PURO.
 */
import { bloqueio, ok, type CodigoRegra, type Formacao, type ResultadoRegra } from './tipos'

export type FaseDiscrepancia = 'ANTES_DO_SET' | 'DEPOIS_DO_INICIO'
export type CausaDiscrepancia = 'POSICAO' | 'JOGADOR_FORA_DA_PAPELETA' | 'JOGADOR_NAO_REGISTRADO'

/** RG-FOR-006: a formação entregue só muda por substituição regular (que conta no limite do set). */
export function validarMudancaDeFormacao(params: {
  papeleta: Formacao
  nova: Formacao
  viaSubstituicaoRegular: boolean
}): ResultadoRegra {
  const igual = params.papeleta.length === params.nova.length && params.papeleta.every((j, i) => j === params.nova[i])
  if (igual || params.viaSubstituicaoRegular) return ok()
  return bloqueio(
    'RG-FOR-006',
    'A formação inicial já foi entregue e não muda: para alterar um jogador faça uma substituição regular (ela conta no limite do set).',
  )
}

/**
 * RG-FOR-004 / RG-FOR-005 (5.2.3.1, 7.3.2): antes de cada set o técnico entrega ao 2º árbitro/apontador a papeleta
 * preenchida e assinada (ou a envia eletronicamente, que vale como oficial). Exatamente 6 jogadores distintos da
 * relação nominal.
 */
export function validarEntregaDaPapeleta(params: {
  formacao: Formacao
  relacao: readonly number[]
  /** Assinada pelo técnico (papel) ou enviada pelo canal eletrônico oficial (vale como assinada). */
  assinada: boolean
  /** A entrega ainda é anterior ao início do set (depois dele, só pelas regras de discrepância). */
  antesDoSet: boolean
}): ResultadoRegra {
  if (!params.antesDoSet) {
    return bloqueio('RG-FOR-004', 'A papeleta é entregue antes do início do set; depois dele só valem a substituição regular e as regras de discrepância.')
  }
  if (!params.assinada) {
    return bloqueio('RG-FOR-004', 'A papeleta precisa estar assinada pelo técnico (ou ser enviada eletronicamente pelo canal oficial).')
  }
  if (params.formacao.length !== 6 || new Set(params.formacao).size !== 6) {
    return bloqueio('RG-FOR-005', 'A papeleta precisa ter exatamente 6 jogadores distintos nas posições I a VI.')
  }
  const fora = params.formacao.find((j) => !params.relacao.includes(j))
  if (fora !== undefined) {
    return bloqueio('RG-FOR-009', `O jogador ${fora} da papeleta não consta na relação nominal da súmula.`)
  }
  return ok()
}

export interface DiscrepanciaDetectada {
  causa: CausaDiscrepancia
  /** Índice da posição (0 = I). */
  posicao: number
  esperado: number
  encontrado: number
}

/**
 * Compara a formação da papeleta com quem está de fato em quadra (RG-FOR-007/008/009).
 * `elenco` é a relação nominal da equipe; quem está fora dela é "não registrado".
 */
export function compararComPapeleta(papeleta: Formacao, emQuadra: Formacao, elenco: readonly number[]): DiscrepanciaDetectada[] {
  const achadas: DiscrepanciaDetectada[] = []
  for (let i = 0; i < papeleta.length; i += 1) {
    const esperado = papeleta[i]!
    const encontrado = emQuadra[i]
    if (encontrado === undefined || encontrado === esperado) continue
    const causa: CausaDiscrepancia = !elenco.includes(encontrado)
      ? 'JOGADOR_NAO_REGISTRADO'
      : papeleta.includes(encontrado)
        ? 'POSICAO'
        : 'JOGADOR_FORA_DA_PAPELETA'
    achadas.push({ causa, posicao: i, esperado, encontrado })
  }
  return achadas
}

export interface ConsequenciaDiscrepancia {
  codigo: CodigoRegra
  sancao: boolean
  /** A equipe faltosa tem pontos cancelados (reversão seletiva). */
  cancelaPontosDaFaltosa: boolean
  pontoESaqueParaAdversario: boolean
  mensagem: string
}

/** Efeito de uma discrepância conforme a fase em que foi descoberta. */
export function consequenciaDeDiscrepancia(fase: FaseDiscrepancia, causa: CausaDiscrepancia): ConsequenciaDiscrepancia {
  if (fase === 'ANTES_DO_SET') {
    return {
      codigo: 'RG-FOR-007',
      sancao: false,
      cancelaPontosDaFaltosa: false,
      pontoESaqueParaAdversario: false,
      mensagem:
        'Discrepância descoberta antes do início do set: posições corrigidas conforme a papeleta, sem sanção. Se o técnico quiser manter o jogador que está em quadra, é substituição regular.',
    }
  }
  if (causa === 'JOGADOR_NAO_REGISTRADO') {
    return {
      codigo: 'RG-FOR-009',
      sancao: false,
      cancelaPontosDaFaltosa: true,
      pontoESaqueParaAdversario: true,
      mensagem:
        'Jogador não registrado na súmula em quadra: o adversário mantém os pontos e ganha ponto e saque; a equipe faltosa perde os pontos desde a entrada dele, entrega nova papeleta e põe um jogador registrado na posição.',
    }
  }
  return {
    codigo: 'RG-FOR-008',
    sancao: false,
    cancelaPontosDaFaltosa: true,
    pontoESaqueParaAdversario: true,
    mensagem:
      'Discrepância com a papeleta descoberta depois do início: a equipe faltosa volta às posições corretas, o adversário ganha ponto e saque e os pontos da faltosa desde o momento exato da falta são cancelados (abrir nova súmula do set).',
  }
}
