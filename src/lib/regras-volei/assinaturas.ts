/**
 * Assinaturas do fechamento da súmula. RG-FEC-002 (ordem) e RG-FEC-003 (capitão ausente ou que recusa).
 * Módulo PURO: valida a lista de assinaturas que o servidor recebeu; não grava nada.
 *
 * Ordem (27.2.3.3, 5.1.3.1, 24.3.3; Guia p.75): apontador(es), depois os capitães (que ratificam o resultado),
 * depois os árbitros. Capitão ausente por motivo que não seja recusa: assina o capitão em jogo, com observação
 * do fato. Capitão que recusa: o campo fica em branco, com observação do motivo (Guia p.73-74, 123).
 */
import { bloqueio, ok, type AvisoRegra, type Equipe, type ResultadoRegra } from './tipos'

export type PapelAssinatura = 'APONTADOR' | 'CAPITAO' | 'ARBITRO'

/** Posição na sequência de assinatura (1 = primeiro a assinar). Registros em branco não entram na ordem. */
interface AssinaturaBase {
  ordem: number
}

export interface AssinaturaApontador extends AssinaturaBase {
  papel: 'APONTADOR'
}

export interface AssinaturaArbitro extends AssinaturaBase {
  papel: 'ARBITRO'
  funcao?: 'PRIMEIRO' | 'SEGUNDO'
}

export type SituacaoCapitao =
  /** O capitão da equipe assinou. */
  | 'PRESENTE'
  /** O capitão não está (motivo que não é recusa): assina o capitão em jogo, com observação. */
  | 'AUSENTE_SUBSTITUIDO'
  /** O capitão recusou: campo em branco, com observação do motivo. */
  | 'RECUSA'

export interface AssinaturaCapitao extends AssinaturaBase {
  papel: 'CAPITAO'
  equipe: Equipe
  situacao: SituacaoCapitao
  /** Quem assinou (obrigatório em AUSENTE_SUBSTITUIDO: o capitão em jogo). */
  jogadorId?: number
  observacao?: string
}

export type AssinaturaFechamento = AssinaturaApontador | AssinaturaCapitao | AssinaturaArbitro

export interface OpcoesAssinaturas {
  /** Capitão em jogo de cada equipe ao fim do jogo (de `derivarPlacar().capitaesEmJogo`), para conferir o substituto. */
  capitaesEmJogo?: { A: number | null; B: number | null }
}

const RANK: Record<PapelAssinatura, number> = { APONTADOR: 1, CAPITAO: 2, ARBITRO: 3 }
const NOME: Record<PapelAssinatura, string> = { APONTADOR: 'apontador', CAPITAO: 'capitão', ARBITRO: 'árbitro' }

/** Ordem esperada, para a tela mostrar o que falta assinar (RG-FEC-002). */
export const ORDEM_DE_ASSINATURA: readonly PapelAssinatura[] = ['APONTADOR', 'CAPITAO', 'ARBITRO']

function assinou(a: AssinaturaFechamento): boolean {
  return a.papel !== 'CAPITAO' || a.situacao !== 'RECUSA'
}

/** RG-FEC-002 / RG-FEC-003: confere ordem, presença das assinaturas e o tratamento do capitão ausente ou que recusa. */
export function validarAssinaturasFechamento(
  assinaturas: readonly AssinaturaFechamento[],
  opcoes: OpcoesAssinaturas = {},
): ResultadoRegra {
  const avisos: AvisoRegra[] = []

  // RG-FEC-003: cada equipe tem exatamente um registro de capitão.
  for (const equipe of ['A', 'B'] as const) {
    const registros = assinaturas.filter((a): a is AssinaturaCapitao => a.papel === 'CAPITAO' && a.equipe === equipe)
    if (registros.length === 0) {
      return bloqueio('RG-FEC-002', `Falta a assinatura do capitão da equipe ${equipe} (ou o registro da ausência/recusa com observação).`)
    }
    if (registros.length > 1) {
      return bloqueio('RG-FEC-003', `A equipe ${equipe} tem mais de um registro de capitão no fechamento.`)
    }
    const r = registros[0]!
    const observacao = (r.observacao ?? '').trim()
    if (r.situacao === 'AUSENTE_SUBSTITUIDO') {
      if (observacao === '') {
        return bloqueio('RG-FEC-003', `Capitão da equipe ${equipe} ausente: registre a observação do fato junto à assinatura do capitão em jogo.`)
      }
      if (r.jogadorId === undefined) {
        return bloqueio('RG-FEC-003', `Capitão da equipe ${equipe} ausente: informe o capitão em jogo que assinou no lugar dele.`)
      }
      const emJogo = opcoes.capitaesEmJogo?.[equipe]
      if (emJogo !== undefined && emJogo !== null && emJogo !== r.jogadorId) {
        return bloqueio('RG-FEC-003', `Na ausência do capitão assina o capitão em jogo (${emJogo}); o jogador ${r.jogadorId} não é.`)
      }
      if (emJogo === null) {
        avisos.push({ codigo: 'RG-FEC-003', mensagem: `Não há capitão em jogo designado para a equipe ${equipe}: confira quem assinou (${r.jogadorId}).` })
      }
    } else if (r.situacao === 'RECUSA' && observacao === '') {
      return bloqueio('RG-FEC-003', `Capitão da equipe ${equipe} recusou assinar: o campo fica em branco, mas o motivo precisa ir na observação.`)
    }
  }

  // Presença: ao menos um apontador e um árbitro (o resultado é ratificado pelos capitães, mas conferido por eles).
  for (const papel of ['APONTADOR', 'ARBITRO'] as const) {
    if (!assinaturas.some((a) => a.papel === papel)) {
      return bloqueio('RG-FEC-002', `Falta a assinatura do ${NOME[papel]} no fechamento.`)
    }
  }

  // Ordem: tudo que foi assinado segue apontador -> capitão -> árbitro, pela posição informada.
  const assinadas = assinaturas.filter(assinou)
  const ordens = new Set<number>()
  for (const a of assinadas) {
    if (!Number.isInteger(a.ordem) || a.ordem < 1) {
      return bloqueio('RG-FEC-002', 'Cada assinatura precisa de uma posição de ordem (1, 2, 3...).')
    }
    if (ordens.has(a.ordem)) return bloqueio('RG-FEC-002', `Duas assinaturas com a mesma posição de ordem (${a.ordem}).`)
    ordens.add(a.ordem)
  }
  const emOrdem = [...assinadas].sort((x, y) => x.ordem - y.ordem)
  for (let i = 1; i < emOrdem.length; i += 1) {
    const antes = emOrdem[i - 1]!
    const depois = emOrdem[i]!
    if (RANK[depois.papel] < RANK[antes.papel]) {
      return bloqueio(
        'RG-FEC-002',
        `Ordem de assinatura inválida: o ${NOME[depois.papel]} assinou depois do ${NOME[antes.papel]}. A ordem é apontador, capitães, árbitros.`,
      )
    }
  }
  return ok(avisos)
}

/* ------------------------------------------------------------------ */
/* Abertura (RG-FEC-001) e depois do fechamento (RG-FEC-005)           */
/* ------------------------------------------------------------------ */

export type SituacaoAssinaturaAbertura = 'ASSINOU' | 'PENDENTE' | 'SEM_TECNICO'

export interface AssinaturasDeAbertura {
  /** Técnico de cada equipe depois de conferir a relação nominal. SEM_TECNICO: equipe sem técnico (o capitão responde). */
  tecnico: { A: SituacaoAssinaturaAbertura; B: SituacaoAssinaturaAbertura }
  /** Capitães assinam o quadro de equipes. */
  capitao: { A: boolean; B: boolean }
  /** Os capitães assinam de novo no sorteio. */
  sorteio: { A: boolean; B: boolean }
}

/**
 * RG-FEC-001 (5.1.1, 5.2.2, 27.2.1.1; Guia p.27): antes do jogo, com a relação nominal pronta, assinam os técnicos e os
 * capitães (no quadro de equipes), e os capitães assinam também no sorteio. O técnico confere a relação antes de assinar.
 */
export function validarAssinaturasDeAbertura(a: AssinaturasDeAbertura): ResultadoRegra {
  for (const equipe of ['A', 'B'] as const) {
    if (a.tecnico[equipe] === 'PENDENTE') {
      return bloqueio('RG-FEC-001', `O técnico da equipe ${equipe} ainda não conferiu e assinou a relação nominal.`)
    }
    if (!a.capitao[equipe]) {
      return bloqueio('RG-FEC-001', `O capitão da equipe ${equipe} ainda não assinou o quadro de equipes.`)
    }
    if (!a.sorteio[equipe]) {
      return bloqueio('RG-FEC-001', `O capitão da equipe ${equipe} ainda não assinou o sorteio.`)
    }
  }
  return ok()
}

/**
 * RG-FEC-005 (5.1.3.1): com as assinaturas apostas a assinatura ratifica o resultado; a regra não prevê alteração posterior
 * pela equipe. Correção depois da oficialização é ato administrativo do organizador, com motivo registrado (trilha de
 * auditoria). A janela de correção por link do produto (D6) é regra de produto, não está aqui.
 */
export function validarAlteracaoDeResultado(params: {
  oficializada: boolean
  autor: 'EQUIPE' | 'ORGANIZADOR'
  motivo?: string
}): ResultadoRegra {
  if (!params.oficializada) return ok()
  if (params.autor === 'EQUIPE') {
    return bloqueio('RG-FEC-005', 'Com as assinaturas apostas o resultado está ratificado: a equipe não altera a súmula; a correção é ato administrativo do organizador.')
  }
  if ((params.motivo ?? '').trim() === '') {
    return bloqueio('RG-FEC-005', 'A correção de uma súmula oficializada exige o motivo registrado pelo organizador.')
  }
  return ok()
}
