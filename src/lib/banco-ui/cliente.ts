/** Chamadas do app do banco ao servidor. O link (token) é a credencial: sem login, sem cookie. */
import { extrairViolacoes, mensagemDeErro } from './falhas'
import type { Violacao } from './tipos'

export interface RespostaBanco {
  ok: boolean
  /** null = falha de rede (sem resposta). */
  status: number | null
  json: unknown
  violacoes: Violacao[]
  erro: string | null
}

export async function chamarBanco(token: string, caminho: string, metodo: 'GET' | 'PUT' | 'POST' | 'DELETE', corpo?: unknown): Promise<RespostaBanco> {
  try {
    const res = await fetch(`/api/banco/${encodeURIComponent(token)}${caminho}`, {
      method: metodo,
      cache: 'no-store',
      headers: corpo === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    })
    const json: unknown = await res.json().catch(() => ({}))
    return {
      ok: res.ok,
      status: res.status,
      json,
      violacoes: res.ok ? [] : extrairViolacoes(json),
      erro: res.ok ? null : mensagemDeErro(json, 'Não foi possível concluir. Tente novamente.'),
    }
  } catch {
    return { ok: false, status: null, json: null, violacoes: [], erro: 'Sem conexão. Tente de novo quando a internet voltar.' }
  }
}
