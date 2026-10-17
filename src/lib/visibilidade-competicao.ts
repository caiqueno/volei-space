import { supabaseAdmin } from '@/lib/supabase-admin'
import { colunaAusente } from '@/lib/coluna-ausente'
import { campeonatoPublicado } from '@/lib/campeonato-publico'

// Competição privada (Liga.visibilidade = 'PRIVADA', migration pendente 202610170030).
// Privada: não aparece em lista pública, só por link/código, e exige convite para inscrever.
// Tolerância: sem a coluna (migration não aplicada) tudo é público, como antes.

export const VISIBILIDADES = ['PUBLICA', 'PRIVADA'] as const
export type VisibilidadeCompeticao = (typeof VISIBILIDADES)[number]

export function competicaoPrivada(liga: { visibilidade?: unknown } | null | undefined): boolean {
  return String(liga?.visibilidade ?? '').trim().toUpperCase() === 'PRIVADA'
}

/** Remove da lista as competições privadas. Linha sem o campo (coluna ausente) é pública. */
export function semPrivadas<T extends { visibilidade?: unknown }>(ligas: readonly T[] | null | undefined): T[] {
  return (ligas ?? []).filter((liga) => !competicaoPrivada(liga))
}

/** Remove da lista as competições cujo id está no conjunto de privadas. */
export function semIdsPrivados<T extends { id?: unknown }>(ligas: readonly T[] | null | undefined, privados: ReadonlySet<number>): T[] {
  return (ligas ?? []).filter((liga) => !privados.has(Number(liga.id)))
}

let cache: { ids: Set<number>; expira: number } | null = null

/**
 * Ids das competições privadas, em consulta separada para que a coluna ausente não
 * quebre a leitura principal: qualquer erro (coluna inexistente inclusive) vira conjunto vazio.
 * Cache curto, só para listas públicas; nunca usar para autorizar escrita.
 */
export async function idsCompeticoesPrivadas(opcoes: { semCache?: boolean } = {}): Promise<Set<number>> {
  if (!opcoes.semCache && cache && cache.expira > Date.now()) return cache.ids
  try {
    const { data, error } = await supabaseAdmin.from('Liga').select('id').eq('visibilidade', 'PRIVADA')
    if (error) return new Set()
    const ids = new Set<number>((data ?? []).map((linha: { id: number }) => Number(linha.id)))
    if (!opcoes.semCache) cache = { ids, expira: Date.now() + 30_000 }
    return ids
  } catch {
    return new Set()
  }
}

export function limparCacheCompeticoesPrivadas() {
  cache = null
}

/**
 * Visibilidade de uma liga, lida à parte para a coluna ausente não quebrar a leitura principal.
 * Sem a coluna (migration não aplicada), erro ou liga inexistente: 'PUBLICA'.
 */
export async function lerVisibilidadeDaLiga(ligaId: number): Promise<VisibilidadeCompeticao> {
  try {
    const { data, error } = await supabaseAdmin.from('Liga').select('visibilidade').eq('id', ligaId).maybeSingle()
    if (error || !data) return 'PUBLICA'
    return competicaoPrivada(data as { visibilidade?: unknown }) ? 'PRIVADA' : 'PUBLICA'
  } catch {
    return 'PUBLICA'
  }
}

export type ResultadoGravarVisibilidade =
  | { ok: true }
  | { ok: false; status: 503 | 500; mensagem: string }

/**
 * Grava Liga.visibilidade. Quem chama já provou que é o dono (ou admin) da liga.
 * Coluna ausente vira 503 com mensagem clara, sem derrubar o restante do salvamento.
 */
export async function gravarVisibilidadeDaLiga(ligaId: number, visibilidade: VisibilidadeCompeticao): Promise<ResultadoGravarVisibilidade> {
  const { error } = await supabaseAdmin.from('Liga').update({ visibilidade }).eq('id', ligaId)
  if (!error) {
    limparCacheCompeticoesPrivadas()
    return { ok: true }
  }
  if (colunaAusente(error, ['visibilidade'])) {
    return { ok: false, status: 503, mensagem: 'A competição privada ainda não está disponível neste ambiente. Tente novamente depois da atualização do banco.' }
  }
  return { ok: false, status: 500, mensagem: 'Não foi possível salvar a visibilidade do campeonato.' }
}

/**
 * Campeonato publicado para visitante: não é simulação, tem status público e NÃO é privado.
 * Alimenta `campeonatoPublicado` nos payloads de partida do árbitro e do organizador.
 */
export function campeonatoPublicadoParaVisitante(
  liga: { status?: unknown; simulacao?: unknown; visibilidade?: unknown } | null | undefined,
): boolean {
  return campeonatoPublicado(liga) && !competicaoPrivada(liga)
}

/** Lê a liga (tolerando coluna ausente) e diz se ela está publicada para visitante. */
export async function campeonatoPublicadoDaLiga(ligaId: number): Promise<boolean> {
  if (!Number.isInteger(Number(ligaId))) return false
  try {
    const com = await supabaseAdmin.from('Liga').select('status,simulacao,visibilidade').eq('id', Number(ligaId)).maybeSingle()
    if (!com.error) return campeonatoPublicadoParaVisitante(com.data)
    if (!colunaAusente(com.error, ['visibilidade'])) return false
    const sem = await supabaseAdmin.from('Liga').select('status,simulacao').eq('id', Number(ligaId)).maybeSingle()
    return sem.error ? false : campeonatoPublicadoParaVisitante(sem.data)
  } catch {
    return false
  }
}
