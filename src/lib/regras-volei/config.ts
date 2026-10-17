/**
 * Perfis e constantes configuráveis do motor.
 *
 * Itens marcados [M] no 03-regras-validaveis.md (não verificados em fonte oficial)
 * NÃO viram regra testada: ficam aqui como constantes configuráveis com TODO.
 */

export const LIMITE_OFICIAL_SUBSTITUICOES = 6 // RG-SUB-001 [V] 15.1 / Guia p.47
export const LIMITE_OFICIAL_TEMPOS = 2 // RG-TMP-001
export const MINUTOS_MAX_INTERRUPCAO = 240 // RG-INT-005 (4 h)
export const PLACAR_WO_POR_SET = 25 // RG-WO-001 (Guia p.82-86)

export interface PerfilRegras {
  id: string
  /** Máximo de substituições regulares por equipe e set. */
  limiteSubstituicoesPorSet: number
  /** Gera aviso de ilegalidade FIVB/CBV quando passa do limite oficial (6). */
  alertarAcimaDoOficial: boolean
  /** Permite repetir o par A-B / segundo ciclo do titular (com aviso). Oficial: false. */
  permitirParRepetido: boolean
  temposPorSet: number
  /**
   * RG-ELE-001: máximo de jogadores na relação nominal (12; 14 em FIVB/World/Oficiais Adulto).
   * Ausente = o servidor NÃO limita o tamanho do elenco ao iniciar o set (opt-in do perfil).
   */
  maxJogadoresElenco?: number
  /** RG-LIB-001: em competição FIVB, 2 líberos são obrigatórios com mais de 12 jogadores. Padrão: false. */
  exigeDoisLiberosAcimaDe12?: boolean
}

/** Competição FIVB/World/Oficiais Adulto: 14 jogadores e 2 líberos obrigatórios acima de 12 (RG-ELE-001, RG-LIB-001). */
export const PERFIL_FIVB_COMPETICAO: PerfilRegras = {
  id: 'FIVB_COMPETICAO',
  limiteSubstituicoesPorSet: LIMITE_OFICIAL_SUBSTITUICOES,
  alertarAcimaDoOficial: false,
  permitirParRepetido: false,
  temposPorSet: LIMITE_OFICIAL_TEMPOS,
  maxJogadoresElenco: 14,
  exigeDoisLiberosAcimaDe12: true,
}

/** Padrão: FIVB/CBV (D1). */
export const PERFIL_FIVB_CBV: PerfilRegras = {
  id: 'FIVB_CBV',
  limiteSubstituicoesPorSet: LIMITE_OFICIAL_SUBSTITUICOES,
  alertarAcimaDoOficial: false,
  permitirParRepetido: false,
  temposPorSet: LIMITE_OFICIAL_TEMPOS,
}

/** Amador/estadual: 8 substituições, com alerta de ilegalidade FIVB/CBV acima de 6 (D1, D3). */
export const PERFIL_AMADOR: PerfilRegras = {
  id: 'AMADOR',
  limiteSubstituicoesPorSet: 8,
  alertarAcimaDoOficial: true,
  permitirParRepetido: true,
  temposPorSet: LIMITE_OFICIAL_TEMPOS,
}

export interface ConfigPartida {
  perfil: PerfilRegras
  /** Melhor de N sets (3 ou 5). */
  melhorDe: 3 | 5
  /** Alvo dos sets regulares (25 indoor; configurável 15/21/25). */
  alvoSet: number
  /** Alvo do set decisivo / último set (`Nt`; FIVB 15). */
  alvoSetDecisivo: number
  /** Vantagem mínima (2; sem teto). */
  margem: number
  /** D2: 3º set obrigatório mesmo após 2x0 (formato de organizador, não-FIVB). */
  terceiroSetObrigatorio: boolean
  /** RG-SET-006: a líder atinge N pontos no set decisivo e as equipes trocam de quadra. */
  trocaLadoNoDecisivoEm: number
  /**
   * RG-WO-002: tolerância (minutos) para declarar WO por não comparecimento. É do REGULAMENTO
   * (o Guia cita 30 como exemplo): sem valor aqui o motor não declara WO por atraso.
   */
  toleranciaWOMinutos?: number
  /** RG-WO-002: tolerância do WO duplo (o Guia cita 15 como exemplo). Ausente = usa `toleranciaWOMinutos`. */
  toleranciaWODuploMinutos?: number
  /**
   * RG-PRO-002 [M quanto ao não aceite]: exigir que o protesto tenha sido ANUNCIADO na hora para ser
   * registrado ao fim. Ausente = exige (a regra pede aviso "em tempo devido"); false = só registra.
   */
  protestoExigeAnuncio?: boolean
  /**
   * RG-FOR-009 [M quanto a este ponto]: jogador não registrado que entrou em set anterior. O artigo manda a faltosa
   * perder "pontos e/ou sets (0x25 se necessário)"; se os sets que ela já tinha PERDIDO também têm os pontos zerados
   * é decisão do regulamento. Ausente/false = esses sets mantêm o parcial real.
   */
  naoRegistradoZeraSetsJaPerdidos?: boolean
}

export const CONFIG_FIVB_MELHOR_DE_5: ConfigPartida = {
  perfil: PERFIL_FIVB_CBV,
  melhorDe: 5,
  alvoSet: 25,
  alvoSetDecisivo: 15,
  margem: 2,
  terceiroSetObrigatorio: false,
  trocaLadoNoDecisivoEm: 8,
}

export function configMelhorDe3(parcial: Partial<ConfigPartida> = {}): ConfigPartida {
  return { ...CONFIG_FIVB_MELHOR_DE_5, melhorDe: 3, ...parcial }
}

/* ------------------------------------------------------------------ */
/* Itens [M]: constantes configuráveis, SEM teste automatizado.       */
/* ------------------------------------------------------------------ */

/**
 * ATENÇÃO: só `sancaoCombinacaoCategorias` (lida como `void`, sem efeito) e `faltaRotacaoPontoAdversario`
 * têm leitor. Os demais campos são CONSTANTES DECORATIVAS: documentam a decisão pendente, mas nenhum
 * código os lê ainda. Mudar o valor aqui NÃO muda o comportamento do motor.
 */
export const CONFIG_ITENS_M = {
  /**
   * TODO [M] RG-WO-001/D9: pontuação do WO em melhor de 3 e no regulamento estadual.
   * Hoje o resultado de súmula do WO é "maioria de sets para o presente (ausente com 0), alvo x 0 por set não jogado".
   */
  woResultadoOficial: 'MAIORIA_25x0' as 'MAIORIA_25x0',
  /**
   * TODO [M] RG-SAN-009/CJ-04: combinação de categorias diferentes no mesmo membro.
   * Implementado: contagem POR CATEGORIA (grosseira conta grosseiras; ofensiva conta ofensivas).
   * Confirmar com o Livro de Casos CBV / COBRAV antes de testar.
   */
  sancaoCombinacaoCategorias: 'POR_CATEGORIA' as 'POR_CATEGORIA',
  /**
   * TODO [M] RG-SAN-010: quem saca em 0x0 após penalidade aplicada entre sets.
   * Implementado: o adversário da equipe punida recebe o ponto; saque inicial a confirmar.
   */
  saqueEm0x0AposPenalidadeEntreSets: 'ADVERSARIO' as 'ADVERSARIO',
  /**
   * TODO [M] CJ-02/RG-LIB-011: o redesignado "não joga mais como jogador de linha".
   * É inferência de 19.4.2.1. Configurável.
   */
  redesignadoNaoJogaComoLinha: true,
  /**
   * TODO [M] CJ-03: placar exato após o cancelamento de pontos (o adversário recebe
   * ponto e saque, 7.7.1). O motor aplica o ponto; confirmar o placar final com a COBRAV.
   */
  faltaRotacaoPontoAdversario: 1,
  /**
   * TODO [M] RG-TMP-009: tempo técnico indoor é do regulamento (não existe na FIVB 2025-2028).
   * Desligado por padrão; sem regra testada.
   */
  tempoTecnico: { ativo: false, gatilhoSomaPontos: [] as number[], duracaoSegundos: 60 },
  /**
   * TODO [M] RG-SUB-002: critério de contar "por jogador" em vez de "por pedido".
   * Implementado: 1 por jogador que entra (cada entrada/retorno conta 1).
   */
  substituicaoContaPorJogador: true,
  /** TODO [M] RG-PRO-004: decisão de protesto técnico cabe ao órgão do regulamento; o motor só registra. */
  protestoDecisaoNoMotor: false,
}
