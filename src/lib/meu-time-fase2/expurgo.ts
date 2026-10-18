// Expurgo agendável das prévias de importação vencidas (LGPD: a prévia guarda nome e nascimento).
// A função SQL public.expurgar_previas_importacao() vem de migration separada; sem ela a rota responde 503.
import { createHash, timingSafeEqual } from 'node:crypto'

/** Segredo do cron. Vazio/ausente = rota desligada (404). */
export function segredoDoCron(env: Record<string, string | undefined> = process.env): string | null {
  const valor = env.CRON_SECRET?.trim()
  return valor ? valor : null
}

/** `Authorization: Bearer <CRON_SECRET>` comparado em tempo constante (via hash, sem vazar o tamanho). */
export function cabecalhoCronValido(autorizacao: string | null | undefined, segredo: string): boolean {
  const esperado = createHash('sha256').update(`Bearer ${segredo}`).digest()
  const recebido = createHash('sha256').update(String(autorizacao ?? '')).digest()
  return timingSafeEqual(esperado, recebido)
}

type ClienteRpc = {
  rpc(nome: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string | null; message?: string | null } | null }>
}

export type ResultadoExpurgo = { tipo: 'OK'; apagadas: number } | { tipo: 'INDISPONIVEL' } | { tipo: 'ERRO' }

const CODIGOS_FUNCAO_AUSENTE = new Set(['42883', 'PGRST202', '42P01'])

/** Chama a função de expurgo. Função ausente = INDISPONIVEL (503); outro erro = ERRO (sem detalhes no corpo). */
export async function expurgarPreviasImportacao(cliente: ClienteRpc): Promise<ResultadoExpurgo> {
  try {
    const { data, error } = await cliente.rpc('expurgar_previas_importacao')
    if (error) {
      if (error.code && CODIGOS_FUNCAO_AUSENTE.has(error.code)) return { tipo: 'INDISPONIVEL' }
      console.error('[cron-expurgo] falha na função de expurgo', error.code ?? '')
      return { tipo: 'ERRO' }
    }
    const bruto = Array.isArray(data) ? data[0] : data
    const apagadas = Number(typeof bruto === 'object' && bruto !== null ? Object.values(bruto)[0] : bruto)
    return { tipo: 'OK', apagadas: Number.isFinite(apagadas) && apagadas >= 0 ? apagadas : 0 }
  } catch {
    console.error('[cron-expurgo] exceção ao chamar a função de expurgo')
    return { tipo: 'ERRO' }
  }
}
