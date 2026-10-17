/**
 * Interpretação PURA das ocorrências que a tela grava (texto livre + marcadores) em ocorrências
 * estruturadas do adaptador (src/lib/sumula-ui/fila-adaptador.ts). Base da revalidação em MODO SOMBRA
 * no PUT /api/sumula/[token]: nada aqui lança nem decide gravação.
 *
 * A tela grava `descricao = "<hora> | <placar> | <texto>"`, em ordem do mais novo para o mais antigo.
 * O que o texto não permite reconstruir com segurança vira "não interpretada" (nunca é adivinhado).
 */
import { emOrdemCronologica } from '@/lib/sumula-ui/ordem'
import { ehPontoDePenalidade, formacaoParaMotor, lerMotivoExcepcional, lerSancao, lerTroca, semMarcadores } from '@/lib/sumula-ui/estado'
import { lerLiberosIniciais } from '@/lib/libero-sumula'
import { extrairSaquesIniciais } from '@/lib/saque-inicial'
import type { LadoTela, Ocorrencia } from '@/lib/sumula-ui/fila-adaptador'

export type OcorrenciaGravada = {
  tipo: string
  descricao?: string | null
  set?: number | null
  jogadorId?: number | null
}

export interface JogadorDaPartida {
  id: number
  numero?: unknown
}

export interface EquipeDaPartida {
  nome: string
  jogadores: JogadorDaPartida[]
}

export interface PresencaGravada {
  jogadorId: number
  equipeId: number
  numero?: number | null
  presente?: boolean | null
}

export type ItemInterpretado = {
  /** Posição da ocorrência na lista recebida (para diagnóstico). */
  indice: number
  tipoGravado: string
  texto: string
  ocorrencia: Ocorrencia
}

export type NaoInterpretada = {
  indice: number
  tipoGravado: string
  /** `SANCAO_SEM_MARCADOR` é o único motivo que merece atenção; os demais são lacunas esperadas. */
  motivo: 'SANCAO_SEM_MARCADOR' | 'REDESIGNACAO_LIBERO' | 'TEXTO_NAO_RECONHECIDO' | 'ATLETA_DESCONHECIDO' | 'EQUIPE_DESCONHECIDA' | 'FORMACAO_INCOMPLETA'
  detalhe: string
}

export interface ResultadoInterpretacao {
  itens: ItemInterpretado[]
  naoInterpretadas: NaoInterpretada[]
}

export function normalizar(valor: unknown): string {
  return String(valor ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Tira "<hora> | <placar> | " do início. Sem os dois separadores, devolve o texto inteiro. */
export function textoDaOcorrencia(descricao: string | null | undefined): string {
  const bruto = String(descricao ?? '')
  const partes = bruto.split('|')
  if (partes.length < 3) return bruto.trim()
  return partes.slice(2).join('|').trim()
}

/** Lado cujo nome aparece primeiro depois de `inicio` (nome mais longo vence empates por prefixo). */
function ladoNoInicio(restoNormalizado: string, nomes: { teamA: string; teamB: string }): LadoTela | null {
  let melhor: { lado: LadoTela; tamanho: number } | null = null
  for (const lado of ['teamA', 'teamB'] as const) {
    const nome = normalizar(nomes[lado])
    if (!nome || !restoNormalizado.startsWith(nome)) continue
    if (!melhor || nome.length > melhor.tamanho) melhor = { lado, tamanho: nome.length }
  }
  return melhor?.lado ?? null
}

/** Lado citado depois de qualquer um dos prefixos (ex.: "solicitado por ", "para "). */
function ladoApos(texto: string, prefixos: RegExp, nomes: { teamA: string; teamB: string }): LadoTela | null {
  const normal = normalizar(texto)
  const regex = new RegExp(prefixos.source, 'g')
  let m: RegExpExecArray | null
  while ((m = regex.exec(normal))) {
    const lado = ladoNoInicio(normal.slice(m.index + m[0].length), nomes)
    if (lado) return lado
  }
  return null
}

/** Lado cujo nome aparece mais cedo no texto (usado quando o texto começa pelo nome da equipe). */
function ladoPrimeiroCitado(texto: string, nomes: { teamA: string; teamB: string }): LadoTela | null {
  const normal = normalizar(texto)
  let melhor: { lado: LadoTela; pos: number; tamanho: number } | null = null
  for (const lado of ['teamA', 'teamB'] as const) {
    const nome = normalizar(nomes[lado])
    if (!nome) continue
    const pos = normal.indexOf(nome)
    if (pos < 0) continue
    if (!melhor || pos < melhor.pos || (pos === melhor.pos && nome.length > melhor.tamanho)) melhor = { lado, pos, tamanho: nome.length }
  }
  return melhor?.lado ?? null
}

export interface EntradaInterpretacao {
  equipeAId: number
  equipeBId: number
  equipeA: EquipeDaPartida
  equipeB: EquipeDaPartida
  presencas: ReadonlyArray<PresencaGravada>
  ocorrencias: ReadonlyArray<OcorrenciaGravada>
}

const TIPOS_PONTO = new Set(['point', 'attack', 'block', 'ace'])
const TIPOS_SANCAO_GRAVADOS = new Set(['cartao_amarelo', 'cartao_vermelho', 'advertencia', 'penalidade', 'expulsao', 'desqualificacao'])

/** Resolve camisa/número -> id do atleta da equipe (camisa da súmula primeiro, depois cadastro). */
function criarResolvedor(entrada: EntradaInterpretacao) {
  const camisa: Record<LadoTela, Map<string, number>> = { teamA: new Map(), teamB: new Map() }
  const cadastro: Record<LadoTela, Map<string, number>> = { teamA: new Map(), teamB: new Map() }
  const lados: Array<[LadoTela, EquipeDaPartida, number]> = [['teamA', entrada.equipeA, entrada.equipeAId], ['teamB', entrada.equipeB, entrada.equipeBId]]
  for (const [lado, equipe, equipeId] of lados) {
    for (const j of equipe.jogadores) {
      const n = String(j.numero ?? '').trim()
      if (n) cadastro[lado].set(n, Number(j.id))
    }
    for (const p of entrada.presencas) {
      if (Number(p.equipeId) !== equipeId || p.numero == null) continue
      camisa[lado].set(String(p.numero), Number(p.jogadorId))
    }
  }
  const ladoDoJogador = new Map<number, LadoTela>()
  for (const j of entrada.equipeA.jogadores) ladoDoJogador.set(Number(j.id), 'teamA')
  for (const j of entrada.equipeB.jogadores) ladoDoJogador.set(Number(j.id), 'teamB')
  return {
    id(lado: LadoTela, numero: string): number | null {
      const n = String(numero ?? '').trim().replace(/^#/, '')
      return camisa[lado].get(n) ?? cadastro[lado].get(n) ?? null
    },
    ladoDoJogador: (id: number | null | undefined) => (id == null ? null : ladoDoJogador.get(Number(id)) ?? null),
  }
}

export function interpretarOcorrencias(entrada: EntradaInterpretacao): ResultadoInterpretacao {
  const nomes = { teamA: entrada.equipeA.nome, teamB: entrada.equipeB.nome }
  const resolvedor = criarResolvedor(entrada)
  const itens: ItemInterpretado[] = []
  const naoInterpretadas: NaoInterpretada[] = []
  const setsIniciados = new Set<number>()

  const indexadas = entrada.ocorrencias.map((o, indice) => ({ ...o, indice, tipo: String(o.tipo ?? '') }))
  const cronologicas = emOrdemCronologica(indexadas, 'auto')

  for (const o of cronologicas) {
    const tipoGravado = o.tipo
    const tipo = tipoGravado.toLowerCase()
    const texto = textoDaOcorrencia(o.descricao)
    const limpo = semMarcadores(texto)
    const falha = (motivo: NaoInterpretada['motivo'], detalhe: string) => naoInterpretadas.push({ indice: o.indice, tipoGravado, motivo, detalhe })
    const aceitar = (ocorrencia: Ocorrencia) => itens.push({ indice: o.indice, tipoGravado, texto, ocorrencia })
    const numeroSet = Number.isInteger(o.set) && Number(o.set) > 0 ? Number(o.set) : 1

    if (TIPOS_PONTO.has(tipo)) {
      const lado = resolvedor.ladoDoJogador(o.jogadorId)
        ?? ladoApos(limpo, /(?:ponto e saque para|ponto para|ataque para|bloqueio para|ace para) /, nomes)
      if (!lado) { falha('EQUIPE_DESCONHECIDA', 'ponto sem equipe identificável'); continue }
      const penalidade = tipo === 'point' && ehPontoDePenalidade(texto)
      // O ponto de penalidade já nasce da própria sanção no motor: só vale se a sanção anterior não o gerou (decidido na sombra).
      aceitar({ tipo: 'PONTO', telaId: penalidade ? `penalidade-${o.indice}` : `ponto-${o.indice}`, equipe: lado })
      continue
    }

    if (tipo === 'set_start') {
      if (setsIniciados.has(numeroSet)) continue
      const rot = texto.match(/\[\[ROT:\d+:(teamA|teamB):([^:]*):([^\]]*)\]\]/)
      const saques = extrairSaquesIniciais([{ descricao: texto, set: numeroSet }], nomes)
      const saque = saques[numeroSet]
      if (!rot || !saque) { falha('FORMACAO_INCOMPLETA', 'papeleta sem formação ou sem saque inicial'); continue }
      const formacao = (lado: LadoTela, lista: string) => formacaoParaMotor(lista.split(','), (n) => resolvedor.id(lado, n))
      const formacaoA = formacao('teamA', rot[2])
      const formacaoB = formacao('teamB', rot[3])
      if (!formacaoA || !formacaoB) { falha('FORMACAO_INCOMPLETA', 'formação com camisa sem atleta conhecido'); continue }
      const liberos = lerLiberosIniciais(texto)
      const libA = liberos?.liberoA ? resolvedor.id('teamA', liberos.liberoA) : null
      const libB = liberos?.liberoB ? resolvedor.id('teamB', liberos.liberoB) : null
      setsIniciados.add(numeroSet)
      aceitar({
        tipo: 'SET_INICIADO',
        telaId: `set-${numeroSet}`,
        numeroSet,
        formacaoA,
        formacaoB,
        saqueInicial: saque,
        liberosA: [libA],
        liberosB: [libB],
      })
      continue
    }

    if (tipo === 'timeout') {
      const lado = ladoApos(limpo, /solicitado por /, nomes) ?? ladoPrimeiroCitado(limpo, nomes)
      if (!lado) { falha('EQUIPE_DESCONHECIDA', 'tempo sem equipe identificável'); continue }
      aceitar({ tipo: 'TEMPO', telaId: `tempo-${o.indice}`, equipe: lado })
      continue
    }

    if (tipo === 'substitution' || tipo === 'lesao' || tipo === 'troca_libero') {
      const antes = limpo.split(/sai #/i)[0] ?? limpo
      const lado = ladoApos(antes, /(?:substituicao excepcional \([^)]*\)|substituicao|troca de libero) /, nomes) ?? ladoPrimeiroCitado(antes, nomes)
      const troca = lerTroca(texto)
      if (!lado || !troca) { falha('TEXTO_NAO_RECONHECIDO', 'troca sem equipe ou sem camisas'); continue }
      const saiId = resolvedor.id(lado, troca[0])
      const entraId = resolvedor.id(lado, troca[1])
      if (saiId == null || entraId == null) { falha('ATLETA_DESCONHECIDO', 'troca com camisa sem atleta conhecido'); continue }
      if (tipo === 'troca_libero') aceitar({ tipo: 'TROCA_LIBERO', telaId: `libero-${o.indice}`, equipe: lado, saiId, entraId })
      else if (tipo === 'lesao') aceitar({ tipo: 'SUBSTITUICAO', telaId: `sub-${o.indice}`, equipe: lado, saiId, entraId, excepcional: true, motivo: lerMotivoExcepcional(texto) })
      else aceitar({ tipo: 'SUBSTITUICAO', telaId: `sub-${o.indice}`, equipe: lado, saiId, entraId })
      continue
    }

    // Anotações: sanção (marcador), redesignação de líbero, inversão de lados, W.O.
    const sancao = lerSancao(texto)
    if (sancao) {
      const lado: LadoTela = sancao.equipe === 'A' ? 'teamA' : 'teamB'
      const jogadorId = sancao.membro.startsWith('J:') ? Number(sancao.membro.slice(2)) : null
      aceitar({
        tipo: 'SANCAO',
        telaId: `sancao-${o.indice}`,
        equipe: lado,
        categoria: sancao.categoria,
        ...(jogadorId ? { jogadorId } : { membro: sancao.membro === 'TECNICO' ? 'TECNICO' as const : 'EQUIPE' as const }),
      })
      continue
    }
    if (/\[\[LIBRED:/.test(texto)) { falha('REDESIGNACAO_LIBERO', 'redesignação de líbero não é traduzida pela sombra'); continue }
    if (tipo === 'anotacao' || TIPOS_SANCAO_GRAVADOS.has(tipo)) {
      if (normalizar(limpo).includes('equipes inverteram os lados')) { aceitar({ tipo: 'TROCA_LADO', telaId: `lado-${o.indice}` }); continue }
      const cabecalho = normalizar(limpo).match(/^\[([^\]]+)\]/)?.[1] ?? ''
      if (cabecalho === 'w.o.') {
        const lado = ladoPrimeiroCitado(limpo.replace(/^\[[^\]]+\]\s*/, ''), nomes)
        if (lado) aceitar({ tipo: 'WO', telaId: `wo-${o.indice}`, ausente: lado })
        else falha('EQUIPE_DESCONHECIDA', 'W.O. sem equipe identificável')
        continue
      }
      const pareceSancao = TIPOS_SANCAO_GRAVADOS.has(tipo) || /^(cartao (amarelo|vermelho)|advertencia|atraso|penalidade|expulsao|desqualificacao)/.test(cabecalho)
      if (pareceSancao) falha('SANCAO_SEM_MARCADOR', 'sanção gravada sem o marcador técnico: o motor não consegue revalidar')
    }
    // set_end, system, observações e notas livres não alteram o jogo: ignoradas sem aviso.
  }

  return { itens, naoInterpretadas }
}
