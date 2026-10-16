/**
 * Camada Supabase do log de eventos. O cliente entra por parâmetro (injeção) para o teste usar o
 * banco falso; a rota passa o `supabaseAdmin`. Toda escrita passa pelo RPC `registrar_evento_sumula`
 * (atômico, idempotente, com versão otimista); este módulo nunca faz INSERT direto.
 */
import { COLUNAS_LEITURA, type LinhaSumulaEvento } from './mapeamento'

export interface ClienteEventos {
  from(tabela: string): any
  rpc(nome: string, args: Record<string, unknown>): PromiseLike<{ data: any; error: ErroBanco | null }>
}

export interface ErroBanco {
  code?: string
  message?: string
  details?: string | null
}

const TAMANHO_PAGINA = 500

/** Tabela ainda não existe (migration pendente 202610170023 não aplicada). */
export function tabelaAusente(erro: ErroBanco | null | undefined): boolean {
  if (!erro) return false
  const texto = `${erro.message ?? ''} ${erro.details ?? ''}`
  return (
    erro.code === '42P01' ||
    erro.code === 'PGRST205' ||
    (/SumulaEvento/.test(texto) && /does not exist|schema cache|Could not find the table/i.test(texto))
  )
}

/** Função RPC ainda não existe no banco. */
export function rpcAusente(erro: ErroBanco | null | undefined): boolean {
  if (!erro) return false
  return erro.code === 'PGRST202' ||
    erro.code === '42883' ||
    (/registrar_evento_sumula/.test(erro.message ?? '') && /does not exist|schema cache/i.test(erro.message ?? ''))
}

export type LeituraLinhas =
  | { ok: true; linhas: LinhaSumulaEvento[] }
  | { ok: false; indisponivel: boolean; mensagem: string }

/** Lê o log inteiro da partida em páginas (o PostgREST corta respostas grandes). Ordem por seq. */
export async function carregarLinhas(cliente: ClienteEventos, partidaId: number): Promise<LeituraLinhas> {
  const linhas: LinhaSumulaEvento[] = []
  let ultimo = 0
  for (;;) {
    const { data, error } = await cliente
      .from('SumulaEvento')
      .select(COLUNAS_LEITURA)
      .eq('partidaId', partidaId)
      .gt('seq', ultimo)
      .order('seq', { ascending: true })
      .limit(TAMANHO_PAGINA)
    if (error) {
      if (tabelaAusente(error)) {
        return { ok: false, indisponivel: true, mensagem: 'O registro de eventos da súmula ainda não está disponível neste ambiente (migration pendente).' }
      }
      return { ok: false, indisponivel: false, mensagem: 'Não foi possível ler os eventos da súmula.' }
    }
    const pagina = (data ?? []) as LinhaSumulaEvento[]
    linhas.push(...pagina)
    if (pagina.length < TAMANHO_PAGINA) return { ok: true, linhas }
    ultimo = Number(pagina[pagina.length - 1]!.seq)
  }
}

export type ResultadoRpc =
  | { tipo: 'GRAVADO'; id: number; seq: number; duplicado: boolean }
  | { tipo: 'CONFLITO'; seqAtual: number | null }
  | { tipo: 'RECUSADO'; codigo: string; mensagem: string; oficializada: boolean }
  | { tipo: 'INDISPONIVEL'; mensagem: string }
  | { tipo: 'FALHA'; mensagem: string }

/** Chama o RPC e traduz o erro do Postgres em um resultado que o orquestrador entende. */
export async function registrarNoBanco(cliente: ClienteEventos, args: Record<string, unknown>): Promise<ResultadoRpc> {
  const { data, error } = await cliente.rpc('registrar_evento_sumula', args)
  if (!error) {
    const r = (Array.isArray(data) ? data[0] : data) as { id?: number; seq?: number; duplicado?: boolean } | null
    if (!r || typeof r.seq !== 'number' || typeof r.id !== 'number') {
      return { tipo: 'FALHA', mensagem: 'Resposta inesperada do registro de eventos.' }
    }
    return { tipo: 'GRAVADO', id: r.id, seq: r.seq, duplicado: r.duplicado === true }
  }
  if (tabelaAusente(error) || rpcAusente(error)) {
    return { tipo: 'INDISPONIVEL', mensagem: 'O registro de eventos da súmula ainda não está disponível neste ambiente (migration pendente).' }
  }
  if (error.code === '40001') {
    const atual = Number(error.details)
    return { tipo: 'CONFLITO', seqAtual: Number.isFinite(atual) ? atual : null }
  }
  if (error.code === '23514' || error.code === '23503' || error.code === '22023' || error.code === 'P0002') {
    return {
      tipo: 'RECUSADO',
      codigo: error.code,
      mensagem: error.message ?? 'O banco recusou o evento.',
      oficializada: /oficializada/i.test(error.message ?? ''),
    }
  }
  return { tipo: 'FALHA', mensagem: 'Não foi possível gravar o evento da súmula.' }
}
