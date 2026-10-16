import { lerLiberosIniciais, numeroDeLibero } from '@/lib/libero-sumula'
import { numeroNaPartida } from '@/lib/numero-camisa-partida'
import type {
  EquipeRegistro,
  JogadorRegistro,
  Lado,
  OcorrenciaRegistro,
  PosicaoFormacao,
  PresencaRegistro,
} from './tipos'

// Leitura das descrições gravadas pela súmula digital. O formato é
// "hora | placar | texto"; marcas técnicas como [[ROT:...]] são removidas do texto.

export function normalizar(valor: string) {
  return valor.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

export function limparMarcas(texto: string) {
  return texto.replace(/\s*\[\[[A-Z]+:[^\]]*\]\]/g, '').trim()
}

export function partesDaDescricao(descricao?: string | null) {
  const bruto = String(descricao ?? '')
  const partes = bruto.split('|').map((parte) => parte.trim())
  if (partes.length < 3) return { hora: '', placar: '', texto: limparMarcas(bruto) }
  return { hora: partes[0], placar: partes[1], texto: limparMarcas(partes.slice(2).join(' | ')) }
}

/** Texto cru (com marcas) da descrição, sem hora nem placar. */
export function textoBruto(descricao?: string | null) {
  const partes = String(descricao ?? '').split('|').map((parte) => parte.trim())
  return partes.length < 3 ? String(descricao ?? '') : partes.slice(2).join(' | ')
}

/** Posições na ordem visual gravada pela súmula: P4, P3, P2, P5, P6, P1. */
export const POSICOES_DA_FORMACAO = ['IV', 'III', 'II', 'V', 'VI', 'I'] as const

export function minutosDaHora(hora: string): number | null {
  const m = String(hora ?? '').match(/(\d{1,2}):(\d{2})/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

/** Duração em minutos entre duas horas HH:MM; atravessa a meia-noite. Null se faltar uma. */
export function duracaoEntre(inicio: string | null, fim: string | null): number | null {
  if (!inicio || !fim) return null
  const a = minutosDaHora(inicio)
  const b = minutosDaHora(fim)
  if (a == null || b == null) return null
  return b >= a ? b - a : b + 24 * 60 - a
}

export function ladoDoTexto(texto: string, nomeA: string, nomeB: string): Lado | null {
  const alvo = normalizar(texto)
  const ia = nomeA ? alvo.indexOf(normalizar(nomeA)) : -1
  const ib = nomeB ? alvo.indexOf(normalizar(nomeB)) : -1
  if (ia < 0 && ib < 0) return null
  if (ia < 0) return 'B'
  if (ib < 0) return 'A'
  return ia <= ib ? 'A' : 'B'
}

export function camisaDe(jogador: JogadorRegistro, presencas: PresencaRegistro[]): string {
  const numero = numeroNaPartida(jogador, presencas)
  return numero == null ? '' : String(numero)
}

/**
 * Acha o atleta pelo número gravado na súmula. A papeleta guarda o número do
 * cadastro; a camisa do jogo pode ser outra. Tenta o cadastro e depois a camisa.
 */
export function atletaPeloNumero(
  equipe: EquipeRegistro | null | undefined,
  numero: string,
  presencas: PresencaRegistro[],
): JogadorRegistro | null {
  const alvo = String(numero ?? '').trim().replace(/^#/, '')
  if (!alvo) return null
  const jogadores = equipe?.jogadores ?? []
  return (
    jogadores.find((j) => String(j.numero ?? '') === alvo)
    ?? jogadores.find((j) => camisaDe(j, presencas) === alvo)
    ?? null
  )
}

export type RotacaoLida = { lado: Lado; formacaoA: string[]; formacaoB: string[] }

export function lerRotacao(descricao?: string | null): RotacaoLida | null {
  const m = String(descricao ?? '').match(/\[\[ROT:(\d+):(teamA|teamB):([^:\]]*):([^\]]*)\]\]/)
  if (!m) return null
  return {
    lado: m[2] === 'teamA' ? 'A' : 'B',
    formacaoA: m[3].split(',').map((s) => s.trim()),
    formacaoB: m[4].split(',').map((s) => s.trim()),
  }
}

export function formacaoComNomes(
  numeros: string[],
  equipe: EquipeRegistro | null | undefined,
  presencas: PresencaRegistro[],
): PosicaoFormacao[] | null {
  if (numeros.length < 6 || numeros.every((n) => !n)) return null
  return POSICOES_DA_FORMACAO.map((posicao, indice) => {
    const atleta = atletaPeloNumero(equipe, numeros[indice] ?? '', presencas)
    return {
      posicao,
      camisa: atleta ? camisaDe(atleta, presencas) || numeros[indice] : numeros[indice] ?? '',
      nome: atleta?.nome ?? '',
    }
  })
}

/** Capitães gravados na anotação "Capitães da partida: A #n Nome e B #m Nome." */
export function lerCapitaes(ocorrencias: OcorrenciaRegistro[], nomeA: string, nomeB: string) {
  for (const o of ocorrencias) {
    const texto = textoBruto(o.descricao)
    if (!normalizar(texto).includes('capitaes da partida')) continue
    const numeroApos = (nome: string) => {
      const i = normalizar(texto).indexOf(normalizar(nome))
      if (i < 0) return ''
      const m = texto.slice(i).match(/#([^\s.,|]+)/)
      return m ? m[1] : ''
    }
    return { A: numeroApos(nomeA), B: numeroApos(nomeB) }
  }
  return { A: '', B: '' }
}

export function liberoDoSet(descricoes: string[]) {
  for (const d of descricoes) {
    const lidos = lerLiberosIniciais(textoBruto(d))
    if (lidos) return { equipeA: lidos.equipeA, liberoA: lidos.liberoA, equipeB: lidos.equipeB, liberoB: lidos.liberoB }
  }
  return null
}

export { numeroDeLibero }

const TECNICOS = [
  'formacao da quadra atualizada',
  'papeleta do set',
  'capitaes da partida',
  'saque inicial',
  'equipes inverteram',
  'sorteio',
  'alternancia do set',
  'escalacao',
  'aguardando oficializacao',
]

export function ehTextoTecnico(texto: string) {
  const n = normalizar(texto)
  return TECNICOS.some((t) => n.includes(t))
}

const TIPOS_SANCAO = new Set(['cartao_amarelo', 'cartao_vermelho', 'advertencia', 'penalidade', 'expulsao', 'desqualificacao', 'wo'])

export function ehSancao(o: Pick<OcorrenciaRegistro, 'tipo' | 'descricao'>) {
  const tipo = normalizar(String(o.tipo ?? '')).replace(/ /g, '_')
  if (TIPOS_SANCAO.has(tipo)) return true
  const n = normalizar(textoBruto(o.descricao))
  return /^\[(cartao|sancao|conduta irregular|w\.o\.|atraso)/.test(n)
}

export function ehTempo(o: Pick<OcorrenciaRegistro, 'tipo'>) {
  return normalizar(String(o.tipo ?? '')) === 'timeout'
}

/** Substituição regular, por lesão ou troca de líbero (cada uma é um tipo próprio). */
export function ehSubstituicao(o: Pick<OcorrenciaRegistro, 'tipo'>) {
  const tipo = normalizar(String(o.tipo ?? ''))
  return tipo === 'substitution' || tipo === 'lesao' || tipo === 'troca_libero'
}

export function ehObservacao(o: Pick<OcorrenciaRegistro, 'tipo' | 'descricao'>) {
  if (ehSancao(o) || ehTempo(o) || ehSubstituicao(o)) return false
  const tipo = normalizar(String(o.tipo ?? ''))
  if (!['observacao', 'anotacao'].includes(tipo)) return false
  const texto = textoBruto(o.descricao)
  return limparMarcas(texto) !== '' && !ehTextoTecnico(texto)
}
