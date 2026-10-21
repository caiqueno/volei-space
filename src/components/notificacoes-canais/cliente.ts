// Porta de conversa das preferências e do push. Sucesso `{data}`; falha `{error, codigo?}`.
import { ErroMeuTime } from '@/components/meu-time/cliente'
import { classificarFalha, extrairData, falhaDeRede } from '@/lib/meu-time-ui/respostas'
import { normalizarPreferencias, type Preferencia } from '@/lib/notificacoes-canais-ui/regras'

type Fetch = typeof fetch

export interface ClienteCanais {
  listarPreferencias(): Promise<Preferencia[]>
  salvarPreferencia(p: Preferencia): Promise<void>
  /** Chave pública VAPID (base64url). */
  obterChavePublica(): Promise<string>
  assinar(corpo: { endpoint: string; chaves: { p256dh: string; auth: string } }): Promise<void>
  cancelarAssinatura(endpoint: string): Promise<void>
}

export function criarClienteCanais(fetchImpl?: Fetch): ClienteCanais {
  const chamar = fetchImpl ?? ((...args: Parameters<Fetch>) => fetch(...args))

  async function req(metodo: string, caminho: string, corpo?: unknown): Promise<unknown> {
    let resposta: Response
    try {
      resposta = await chamar(caminho, {
        method: metodo,
        credentials: 'same-origin',
        cache: 'no-store',
        headers: corpo === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
      })
    } catch {
      throw new ErroMeuTime(falhaDeRede())
    }
    let json: unknown = null
    try {
      json = await resposta.json()
    } catch {
      json = null
    }
    if (!resposta.ok) throw new ErroMeuTime(classificarFalha(resposta.status, json))
    return json
  }

  return {
    async listarPreferencias() {
      return normalizarPreferencias(extrairData<unknown>(await req('GET', '/api/notificacoes/preferencias')))
    },
    async salvarPreferencia(p) {
      await req('PUT', '/api/notificacoes/preferencias', { canal: p.canal, tipo: p.tipo, ativo: p.ativo })
    },
    async obterChavePublica() {
      const d = extrairData<{ chavePublica?: unknown }>(await req('GET', '/api/notificacoes/push/chave'))
      return typeof d?.chavePublica === 'string' ? d.chavePublica : ''
    },
    async assinar(corpo) {
      await req('POST', '/api/notificacoes/push/assinar', corpo)
    },
    async cancelarAssinatura(endpoint) {
      await req('DELETE', '/api/notificacoes/push/assinar', { endpoint })
    },
  }
}

let padrao: ClienteCanais | null = null
export function obterClienteCanais(): ClienteCanais {
  padrao ??= criarClienteCanais()
  return padrao
}
