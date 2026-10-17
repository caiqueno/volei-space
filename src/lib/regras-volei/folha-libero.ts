/**
 * Folha de controle de líbero DERIVADA do log (RG-LIB-014, 28.2; Guia p.125-137). Módulo PURO.
 *
 * Cada troca vira uma linha: número do líbero (coluna "Líb."), número do jogador regular (coluna "Troca"; em branco
 * quando a troca é entre dois líberos), posição em quadra, placar da hora (primeiro o da equipe que troca) e a ordem
 * dentro do set. As redesignações (RG-LIB-013) entram com o líbero antigo e o novo. A assinatura do apontador assistente
 * e a conferência dos árbitros são do documento impresso, não do log, e ficam fora daqui.
 *
 * Quem é líbero vem do registro do SET_INICIADO (`liberosA`/`liberosB`) e das redesignações. Se a relação de líberos não
 * foi registrada, a linha sai marcada `liberoInferido` (o jogador que ENTRA é tratado como o líbero).
 */
import type { ConfigPartida } from './config'
import { derivarPlacar, eventosEfetivos, type SumulaEvento } from './eventos'
import type { Equipe } from './tipos'

export interface LinhaFolhaLibero {
  /** Ordem da troca dentro do set e da equipe (1, 2, 3...). */
  ordem: number
  seq: number
  tipo: 'TROCA' | 'REDESIGNACAO'
  equipe: Equipe
  numeroSet: number
  /** Coluna "Líb.": número do líbero da troca (na redesignação, o NOVO líbero). */
  libero: number | null
  /** Coluna "Troca": número do jogador regular; null entre dois líberos e na redesignação. */
  troca: number | null
  /** Na redesignação: o líbero que ficou incapaz. */
  liberoSubstituido: number | null
  /** Posição em quadra (1 = I ... 6 = VI) do jogador que sai; null se não estava na formação. */
  posicao: number | null
  /** Placar da hora, primeiro os pontos da equipe que troca. */
  placar: { equipe: number; adversario: number; texto: string }
  /** A relação de líberos não estava registrada: a identificação do líbero é inferida. */
  liberoInferido: boolean
}

export interface FolhaLiberoSet {
  numero: number
  A: LinhaFolhaLibero[]
  B: LinhaFolhaLibero[]
}

export interface FolhaControleLibero {
  porSet: FolhaLiberoSet[]
  /** Total de linhas por equipe na partida (trocas e redesignações). */
  total: { A: number; B: number }
  /** Linhas em ordem cronológica do log, de todas as equipes e sets. */
  linhas: LinhaFolhaLibero[]
}

export function montarFolhaControleLibero(log: readonly SumulaEvento[], config: ConfigPartida): FolhaControleLibero {
  const efetivos = eventosEfetivos(log)
  const liberos: { A: Set<number>; B: Set<number> } = { A: new Set(), B: new Set() }
  const linhas: LinhaFolhaLibero[] = []
  const contagem = new Map<string, number>()

  for (const e of efetivos) {
    if (e.tipo === 'SET_INICIADO') {
      for (const n of e.payload.liberosA ?? []) liberos.A.add(n)
      for (const n of e.payload.liberosB ?? []) liberos.B.add(n)
      continue
    }
    if (e.tipo !== 'TROCA_LIBERO' && e.tipo !== 'REDESIGNACAO_LIBERO') continue

    // Estado no instante anterior ao evento: set corrente, placar e quem estava em quadra.
    const antes = derivarPlacar(
      efetivos.filter((x) => x.seq < e.seq),
      config,
    )
    const set = antes.setAtual
    if (!set) continue
    const equipe = e.payload.equipe
    const formacao = equipe === 'A' ? antes.formacaoA : antes.formacaoB
    const proprio = equipe === 'A' ? set.placar.a : set.placar.b
    const adversario = equipe === 'A' ? set.placar.b : set.placar.a
    const chave = `${set.numero}:${equipe}`
    const ordem = (contagem.get(chave) ?? 0) + 1
    contagem.set(chave, ordem)
    const placar = { equipe: proprio, adversario, texto: `${proprio}X${adversario}` }

    if (e.tipo === 'REDESIGNACAO_LIBERO') {
      const { liberoIncapaz, novoLibero } = e.payload
      liberos[equipe].add(novoLibero)
      linhas.push({
        ordem,
        seq: e.seq,
        tipo: 'REDESIGNACAO',
        equipe,
        numeroSet: set.numero,
        libero: novoLibero,
        troca: null,
        liberoSubstituido: liberoIncapaz,
        posicao: formacao.indexOf(liberoIncapaz) >= 0 ? formacao.indexOf(liberoIncapaz) + 1 : null,
        placar,
        liberoInferido: false,
      })
      continue
    }

    const { sai, entra } = e.payload
    const conhecidos = liberos[equipe]
    const entraLibero = conhecidos.has(entra)
    const saiLibero = conhecidos.has(sai)
    let libero: number
    let troca: number | null
    let inferido = false
    if (entraLibero && saiLibero) {
      libero = entra
      troca = null // entre dois líberos a coluna "Troca" fica em branco
    } else if (saiLibero) {
      libero = sai
      troca = entra
    } else {
      libero = entra
      troca = sai
      inferido = !entraLibero
    }
    linhas.push({
      ordem,
      seq: e.seq,
      tipo: 'TROCA',
      equipe,
      numeroSet: set.numero,
      libero,
      troca,
      liberoSubstituido: null,
      posicao: formacao.indexOf(sai) >= 0 ? formacao.indexOf(sai) + 1 : null,
      placar,
      liberoInferido: inferido,
    })
  }

  const numeros = Array.from(new Set(linhas.map((l) => l.numeroSet))).sort((x, y) => x - y)
  return {
    porSet: numeros.map((numero) => ({
      numero,
      A: linhas.filter((l) => l.numeroSet === numero && l.equipe === 'A'),
      B: linhas.filter((l) => l.numeroSet === numero && l.equipe === 'B'),
    })),
    total: { A: linhas.filter((l) => l.equipe === 'A').length, B: linhas.filter((l) => l.equipe === 'B').length },
    linhas,
  }
}
