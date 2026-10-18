// Porta de conversa das abas Campeonatos e Jogos. Sucesso `{data}`; falha `{error, codigo?}`.
import { ErroMeuTime } from '@/components/meu-time/cliente'
import { classificarFalha, extrairData, falhaDeRede } from '@/lib/meu-time-ui/respostas'
import { normalizarJogos, normalizarOfertas, type JogoDoTime, type OfertaCampeonato } from '@/lib/meu-time-campeonatos-ui/regras'

type Fetch = typeof fetch

export type ResultadoSolicitacao = { estado: 'INSCRITA' | 'PENDENTE'; id?: string }

export interface ClienteCampeonatos {
  listarOfertas(equipeId: string): Promise<OfertaCampeonato[]>
  solicitar(equipeId: string, categoriaId: string, mensagem?: string): Promise<ResultadoSolicitacao>
  cancelarSolicitacao(id: string): Promise<void>
  listarJogos(equipeId: string): Promise<JogoDoTime[]>
}

export function criarClienteCampeonatos(fetchImpl?: Fetch): ClienteCampeonatos {
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

  const enc = encodeURIComponent

  return {
    async listarOfertas(equipeId) {
      return normalizarOfertas(extrairData<unknown>(await req('GET', `/api/meu-time/campeonatos?equipeId=${enc(equipeId)}`)))
    },
    async solicitar(equipeId, categoriaId, mensagem) {
      const json = await req('POST', '/api/meu-time/campeonatos/solicitacoes', { equipeId, categoriaId, ...(mensagem ? { mensagem } : {}) })
      const d = extrairData<Record<string, unknown>>(json)
      const estado = d?.estado === 'INSCRITA' ? 'INSCRITA' : 'PENDENTE'
      const id = d && (typeof d.id === 'string' || typeof d.id === 'number') ? String(d.id) : undefined
      return { estado, id }
    },
    async cancelarSolicitacao(id) {
      await req('DELETE', `/api/meu-time/campeonatos/solicitacoes/${enc(id)}`)
    },
    async listarJogos(equipeId) {
      return normalizarJogos(extrairData<unknown>(await req('GET', `/api/meu-time/jogos?equipeId=${enc(equipeId)}`)))
    },
  }
}

let padrao: ClienteCampeonatos | null = null

export function obterClienteCampeonatos(): ClienteCampeonatos {
  if (!padrao) padrao = criarClienteCampeonatos()
  return padrao
}
