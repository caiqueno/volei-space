// Cliente dos pedidos de troca (R17). Mesma regra do cliente do Meu Time: envelope {data}/{error,codigo?}.
import { ErroMeuTime } from '@/components/meu-time/cliente'
import { classificarFalha, extrairData, falhaDeRede } from '@/lib/meu-time-ui/respostas'
import { normalizarPedidos, type PedidoTroca } from '@/lib/meu-time-elenco-ui/troca'

export interface ElencoClient {
  listarPedidosTroca(inscricaoId: string): Promise<PedidoTroca[]>
  pedirTroca(inscricaoId: string, dados: { sai: string; entra: string; motivo?: string }): Promise<void>
  cancelarPedidoTroca(inscricaoId: string, pedidoId: string): Promise<void>
}

type Fetch = typeof fetch

export function criarElencoClientHttp(fetchImpl?: Fetch, base = '/api/meu-time'): ElencoClient {
  const chamar = fetchImpl ?? ((...args: Parameters<Fetch>) => fetch(...args))

  async function requisitar(metodo: string, caminho: string, corpo?: unknown): Promise<unknown> {
    let resposta: Response
    try {
      resposta = await chamar(`${base}${caminho}`, {
        method: metodo,
        credentials: 'same-origin',
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

  const inscricao = (id: string) => `/inscricoes/${encodeURIComponent(id)}/pedidos-troca`

  return {
    async listarPedidosTroca(id) {
      return normalizarPedidos(extrairData<unknown>(await requisitar('GET', inscricao(id))))
    },
    async pedirTroca(id, dados) {
      await requisitar('POST', inscricao(id), dados)
    },
    async cancelarPedidoTroca(id, pedidoId) {
      await requisitar('DELETE', `${inscricao(id)}/${encodeURIComponent(pedidoId)}`)
    },
  }
}

let padrao: ElencoClient | null = null
export function obterElencoClientPadrao(): ElencoClient {
  if (!padrao) padrao = criarElencoClientHttp()
  return padrao
}
