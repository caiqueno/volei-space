/**
 * RG-FOR-009 completo (7.3.5.4): jogador em quadra que NÃO consta na relação nominal da súmula.
 *
 * O adversário mantém os pontos e ganha ponto e saque; a equipe faltosa perde "todos os pontos e/ou sets
 * (0x25 se necessário) desde que o não registrado entrou". Quando ele entrou em um set ANTERIOR ao corrente,
 * além do set corrente (que o motor já tratava) é preciso reabrir os sets anteriores:
 *  - set de ENTRADA: os pontos da faltosa desde o momento da entrada são cancelados; se a faltosa tinha vencido
 *    esse set, ela o perde e o adversário recebe os pontos necessários para vencê-lo;
 *  - sets POSTERIORES à entrada: a faltosa perde todos os pontos; um set que ela venceu vira derrota com parcial
 *    0 x alvo (0x25). Um set que ela já tinha perdido mantém o parcial real, salvo `zerarSetsJaPerdidos`.
 *
 * Função PURA. O que é interpretação (e não texto do artigo) fica configurável:
 *  - `zerarSetsJaPerdidos`: o artigo diz "perde todos os pontos e/ou sets"; se também se zeram os pontos dos sets que a
 *    faltosa já havia perdido é decisão do regulamento [M]. Padrão: mantém o parcial real.
 *  - o parcial exato do set de ENTRADA vencido pela faltosa (aqui: pontos dela antes da entrada x pontos necessários do
 *    adversário) não é afirmado pelo artigo; nenhum teste fixa esse número como oficial.
 */
import { bloqueio, outraEquipe, type Equipe, type PlacarSet, type RegraBloqueio } from './tipos'

export interface PontoDeSetAnterior {
  seq: number
  equipe: Equipe
  cancelado: boolean
}

export interface SetAnteriorParaPerda {
  numero: number
  alvo: number
  encerrado: boolean
  vencedor: Equipe | null
  placar: PlacarSet
  pontos: readonly PontoDeSetAnterior[]
}

export interface OpcoesPerdaNaoRegistrado {
  margem: number
  /** [M] Também zera os pontos dos sets posteriores que a faltosa já havia perdido. Padrão: false. */
  zerarSetsJaPerdidos?: boolean
}

export interface PerdaDeSet {
  numero: number
  papel: 'ENTRADA' | 'POSTERIOR'
  /** seq dos pontos da faltosa cancelados neste set. */
  cancelados: number[]
  placarOriginal: PlacarSet
  placar: PlacarSet
  vencedor: Equipe | null
  /** O resultado do set muda: o parcial passa a ser o imposto (ex.: 0x25), não a soma dos pontos vivos. */
  sobrescreve: boolean
  /** A faltosa tinha vencido este set e o perdeu. */
  faltosaPerdeuOSet: boolean
}

export type ResultadoPerdaNaoRegistrado =
  | { ok: true; perdas: PerdaDeSet[]; setsPerdidosPelaFaltosa: number[] }
  | RegraBloqueio

function pontosDe(placar: PlacarSet, equipe: Equipe): number {
  return equipe === 'A' ? placar.a : placar.b
}

function montarPlacar(faltosa: Equipe, pontosFaltosa: number, pontosAdversario: number): PlacarSet {
  return faltosa === 'A' ? { a: pontosFaltosa, b: pontosAdversario } : { a: pontosAdversario, b: pontosFaltosa }
}

export function calcularPerdaPorNaoRegistrado(params: {
  faltosa: Equipe
  /** Set em que o jogador não registrado entrou pela primeira vez. */
  setEntrada: number
  /** seq (dentro do set de entrada) do primeiro ponto a partir do qual a faltosa perde pontos. */
  momentoSeq: number | null
  /** Sets anteriores ao set corrente, em ordem. */
  setsAnteriores: readonly SetAnteriorParaPerda[]
  opcoes: OpcoesPerdaNaoRegistrado
}): ResultadoPerdaNaoRegistrado {
  const { faltosa, setEntrada, momentoSeq, setsAnteriores, opcoes } = params
  const adversario = outraEquipe(faltosa)
  if (momentoSeq === null) {
    return bloqueio('RG-FOR-009', 'Informe o momento (ponto) em que o jogador não registrado entrou: sem ele não dá para saber o que a equipe perde.')
  }
  const afetados = setsAnteriores.filter((s) => s.numero >= setEntrada)
  if (!afetados.some((s) => s.numero === setEntrada)) {
    return bloqueio('RG-FOR-009', `O ${setEntrada}º set não existe entre os sets já jogados.`)
  }

  const perdas: PerdaDeSet[] = []
  for (const s of afetados) {
    const vivosFaltosa = s.pontos.filter((p) => !p.cancelado && p.equipe === faltosa)
    const pontosAdv = pontosDe(s.placar, adversario)
    const faltosaVenceu = s.vencedor === faltosa
    if (s.numero === setEntrada) {
      const cancelados = vivosFaltosa.filter((p) => p.seq >= momentoSeq).map((p) => p.seq)
      const restantes = vivosFaltosa.length - cancelados.length
      if (faltosaVenceu) {
        // Perde o set: o adversário recebe os pontos necessários (alvo e a vantagem mínima).
        const advFinal = Math.max(pontosAdv, s.alvo, restantes + opcoes.margem)
        perdas.push({
          numero: s.numero,
          papel: 'ENTRADA',
          cancelados,
          placarOriginal: { ...s.placar },
          placar: montarPlacar(faltosa, restantes, advFinal),
          vencedor: adversario,
          sobrescreve: true,
          faltosaPerdeuOSet: true,
        })
      } else {
        perdas.push({
          numero: s.numero,
          papel: 'ENTRADA',
          cancelados,
          placarOriginal: { ...s.placar },
          placar: montarPlacar(faltosa, restantes, pontosAdv),
          vencedor: s.vencedor,
          sobrescreve: false,
          faltosaPerdeuOSet: false,
        })
      }
      continue
    }
    const zera = faltosaVenceu || opcoes.zerarSetsJaPerdidos === true
    if (!zera) {
      perdas.push({
        numero: s.numero,
        papel: 'POSTERIOR',
        cancelados: [],
        placarOriginal: { ...s.placar },
        placar: { ...s.placar },
        vencedor: s.vencedor,
        sobrescreve: false,
        faltosaPerdeuOSet: false,
      })
      continue
    }
    perdas.push({
      numero: s.numero,
      papel: 'POSTERIOR',
      cancelados: vivosFaltosa.map((p) => p.seq),
      placarOriginal: { ...s.placar },
      placar: montarPlacar(faltosa, 0, Math.max(pontosAdv, s.alvo)),
      vencedor: adversario,
      sobrescreve: true,
      faltosaPerdeuOSet: faltosaVenceu,
    })
  }
  return { ok: true, perdas, setsPerdidosPelaFaltosa: perdas.filter((p) => p.faltosaPerdeuOSet).map((p) => p.numero) }
}
