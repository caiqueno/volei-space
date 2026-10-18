/** Montagem e validação do payload de uma ação. Módulo PURO (o servidor valida de novo). */
import { FUNDAMENTOS, RESULTADOS, type AcaoServidor, type CamposCorrecao, type Fundamento, type PayloadAcao, type ResultadoAcao } from './tipos'

export interface EntradaAcao {
  clientEventId: string
  setNumero: number
  equipeId: number | null
  jogadorId: number | null
  fundamento: Fundamento | null
  resultado: ResultadoAcao | null
  zonaOrigem?: number | null
  zonaDestino?: number | null
  rotacao?: number | null
  placarA?: number | null
  placarB?: number | null
}

const inteiro = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max

/** Motivo de ainda não poder lançar, ou null se já pode. */
export function motivoNaoPodeLancar(e: Pick<EntradaAcao, 'setNumero' | 'equipeId' | 'fundamento' | 'resultado'>): string | null {
  if (!inteiro(e.setNumero, 1, 5)) return 'Escolha o set.'
  if (e.equipeId === null) return 'Escolha a equipe.'
  if (!e.fundamento || !FUNDAMENTOS.includes(e.fundamento)) return 'Escolha o fundamento.'
  if (!e.resultado || !RESULTADOS.includes(e.resultado)) return 'Escolha o resultado.'
  return null
}

/** Monta o payload só com os campos preenchidos e válidos; null se faltar o essencial. */
export function montarPayload(e: EntradaAcao): PayloadAcao | null {
  if (motivoNaoPodeLancar(e) !== null || !e.clientEventId) return null
  const p: PayloadAcao = {
    clientEventId: e.clientEventId,
    setNumero: e.setNumero,
    equipeId: e.equipeId as number,
    fundamento: e.fundamento as Fundamento,
    resultado: e.resultado as ResultadoAcao,
  }
  if (inteiro(e.jogadorId, 1, Number.MAX_SAFE_INTEGER)) p.jogadorId = e.jogadorId
  if (inteiro(e.zonaOrigem, 1, 9)) p.zonaOrigem = e.zonaOrigem
  if (inteiro(e.zonaDestino, 1, 9)) p.zonaDestino = e.zonaDestino
  if (inteiro(e.rotacao, 1, 6)) p.rotacao = e.rotacao
  if (inteiro(e.placarA, 0, 999)) p.placarA = e.placarA
  if (inteiro(e.placarB, 0, 999)) p.placarB = e.placarB
  return p
}

export interface EntradaCorrecao {
  jogadorId: number | null
  fundamento: Fundamento | null
  resultado: ResultadoAcao | null
  zonaOrigem: number | null
  zonaDestino: number | null
}

/**
 * Diferença entre a ação original e o que está no seletor: só os campos alterados e válidos.
 * null se nada mudou (nada a salvar). Zona ou jogador limpos não são enviados (o contrato não prevê limpar).
 */
export function montarCorrecao(original: AcaoServidor, e: EntradaCorrecao): CamposCorrecao | null {
  const c: CamposCorrecao = {}
  if (e.fundamento && FUNDAMENTOS.includes(e.fundamento) && e.fundamento !== original.fundamento) c.fundamento = e.fundamento
  if (e.resultado && RESULTADOS.includes(e.resultado) && e.resultado !== original.resultado) c.resultado = e.resultado
  if (inteiro(e.zonaOrigem, 1, 9) && e.zonaOrigem !== (original.zonaOrigem ?? null)) c.zonaOrigem = e.zonaOrigem
  if (inteiro(e.zonaDestino, 1, 9) && e.zonaDestino !== (original.zonaDestino ?? null)) c.zonaDestino = e.zonaDestino
  if (inteiro(e.jogadorId, 1, Number.MAX_SAFE_INTEGER) && e.jogadorId !== (original.jogadorId ?? null)) c.jogadorId = e.jogadorId
  return Object.keys(c).length > 0 ? c : null
}

interface Cripto {
  randomUUID?: () => string
  getRandomValues?: (a: Uint8Array) => Uint8Array
}

/** uuid v4 gerado no aparelho: crypto.randomUUID, senão getRandomValues, senão Math.random. */
export function novoClientEventId(cripto?: Cripto | null): string {
  const c = cripto === undefined ? (globalThis as { crypto?: Cripto }).crypto : cripto
  if (c?.randomUUID) return c.randomUUID()
  const b = new Uint8Array(16)
  if (c?.getRandomValues) c.getRandomValues(b)
  else for (let i = 0; i < 16; i += 1) b[i] = Math.floor(Math.random() * 256)
  b[6] = (b[6]! & 0x0f) | 0x40
  b[8] = (b[8]! & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
