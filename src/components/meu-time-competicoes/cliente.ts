// Porta de conversa da tela Competições e dos comentários da inscrição. Sucesso `{data}`; falha `{error, codigo?}`.
import { ErroMeuTime } from '@/components/meu-time/cliente'
import { classificarFalha, extrairData, falhaDeRede } from '@/lib/meu-time-ui/respostas'
import { normalizarCompeticoes, urlListagem, type Filtros, type ListaCompeticoes } from '@/lib/meu-time-competicoes-ui/regras'
import { normalizarComentarios, type Comentario } from '@/lib/meu-time-competicoes-ui/status'

type Fetch = typeof fetch

export interface ClienteCompeticoes {
  listar(filtros: Filtros, sinal?: AbortSignal): Promise<ListaCompeticoes>
  listarComentarios(inscricaoId: string): Promise<Comentario[]>
  comentar(inscricaoId: string, mensagem: string): Promise<void>
}

export function criarClienteCompeticoes(fetchImpl?: Fetch): ClienteCompeticoes {
  const chamar = fetchImpl ?? ((...args: Parameters<Fetch>) => fetch(...args))

  async function req(metodo: string, caminho: string, corpo?: unknown, sinal?: AbortSignal): Promise<unknown> {
    let resposta: Response
    try {
      resposta = await chamar(caminho, {
        method: metodo,
        credentials: 'same-origin',
        cache: 'no-store',
        signal: sinal,
        headers: corpo === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
      })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e
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
    async listar(filtros, sinal) {
      return normalizarCompeticoes(extrairData<unknown>(await req('GET', urlListagem(filtros), undefined, sinal)))
    },
    async listarComentarios(inscricaoId) {
      return normalizarComentarios(extrairData<unknown>(await req('GET', `/api/meu-time/inscricoes/${enc(inscricaoId)}/comentarios`)))
    },
    async comentar(inscricaoId, mensagem) {
      await req('POST', `/api/meu-time/inscricoes/${enc(inscricaoId)}/comentarios`, { mensagem })
    },
  }
}

let padrao: ClienteCompeticoes | null = null
export function obterClienteCompeticoes(): ClienteCompeticoes {
  padrao ??= criarClienteCompeticoes()
  return padrao
}
