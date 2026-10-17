// Porta de conversa da fase 2 com o backend. Sucesso `{data}`; falha `{error, codigo?}`.
import { ErroMeuTime } from '@/components/meu-time/cliente'
import { classificarFalha, extrairData, falhaDeRede } from '@/lib/meu-time-ui/respostas'
import { normalizarEstado } from '@/lib/meu-time-fase2-ui/convites'
import type {
  Clube,
  ConviteGerado,
  ConvitePublico,
  ConviteResumo,
  DadosAtletaConvite,
  Notificacao,
  PreviaImportacao,
} from '@/lib/meu-time-fase2-ui/tipos'

type Fetch = typeof fetch

export interface ClienteFase2 {
  gerarConvite(equipeId: string, contato?: string): Promise<ConviteGerado>
  listarConvites(equipeId: string): Promise<ConviteResumo[]>
  revogarConvite(id: string): Promise<void>
  lerConvitePublico(token: string): Promise<ConvitePublico>
  enviarConvitePublico(token: string, dados: DadosAtletaConvite): Promise<void>
  enviarPlanilha(equipeId: string, csv: string): Promise<PreviaImportacao>
  confirmarImportacao(id: string): Promise<void>
  descartarImportacao(id: string): Promise<void>
  obterClube(): Promise<Clube | null>
  criarClube(nome: string): Promise<Clube>
  vincularEquipe(equipeId: string): Promise<void>
  listarNotificacoes(): Promise<Notificacao[]>
  marcarLida(id: string): Promise<void>
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
const texto = (v: unknown, padrao = '') => (typeof v === 'string' ? v : padrao)

export function criarClienteFase2(fetchImpl?: Fetch): ClienteFase2 {
  const chamar = fetchImpl ?? ((...args: Parameters<Fetch>) => fetch(...args))

  async function req(metodo: string, caminho: string, corpo?: unknown): Promise<unknown> {
    let resposta: Response
    try {
      resposta = await chamar(caminho, {
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

  const dado = (json: unknown) => {
    const d = extrairData<unknown>(json)
    if (d === null || d === undefined) throw new ErroMeuTime(classificarFalha(500, null))
    return d
  }
  const enc = encodeURIComponent

  return {
    async gerarConvite(equipeId, contato) {
      const d = obj(dado(await req('POST', '/api/meu-time/convites', { equipeId, ...(contato?.trim() ? { contato: contato.trim() } : {}) })))
      return { url: texto(d.url), expiraEm: texto(d.expiraEm) }
    },
    async listarConvites(equipeId) {
      const d = dado(await req('GET', `/api/meu-time/convites?equipeId=${enc(equipeId)}`))
      return (Array.isArray(d) ? d : []).map((i) => {
        const o = obj(i)
        return { id: texto(o.id), estado: normalizarEstado(o.estado), criadoEm: texto(o.criadoEm), expiraEm: texto(o.expiraEm) }
      })
    },
    async revogarConvite(id) {
      await req('DELETE', `/api/meu-time/convites/${enc(id)}`)
    },
    async lerConvitePublico(token) {
      const d = obj(dado(await req('GET', `/api/convite-atleta/${enc(token)}`)))
      return { equipe: texto(d.equipe, 'o time'), categoria: typeof d.categoria === 'string' ? d.categoria : null, estado: normalizarEstado(d.estado) }
    },
    async enviarConvitePublico(token, dados) {
      await req('POST', `/api/convite-atleta/${enc(token)}`, dados)
    },
    async enviarPlanilha(equipeId, csv) {
      const d = obj(dado(await req('POST', '/api/meu-time/importacao', { equipeId, csv })))
      const r = obj(d.resumo)
      const linhas = (Array.isArray(d.linhas) ? d.linhas : []).map((l) => {
        const o = obj(l)
        const status = o.status === 'ERRO' || o.status === 'AVISO' ? o.status : 'OK'
        return { n: Number(o.n) || 0, status, erros: Array.isArray(o.erros) ? (o.erros as unknown[]).map((e) => (typeof e === 'string' ? e : JSON.stringify(e))) : [], dados: obj(o.dados) } as PreviaImportacao['linhas'][number]
      })
      return { id: texto(d.id), resumo: { validas: Number(r.validas) || 0, comAviso: Number(r.comAviso) || 0, invalidas: Number(r.invalidas) || 0 }, linhas }
    },
    async confirmarImportacao(id) {
      await req('POST', `/api/meu-time/importacao/${enc(id)}/confirmar`)
    },
    async descartarImportacao(id) {
      await req('DELETE', `/api/meu-time/importacao/${enc(id)}`)
    },
    async obterClube() {
      const json = await req('GET', '/api/meu-time/clube')
      const d = extrairData<unknown>(json)
      if (!d) return null
      const o = obj(d)
      if (!o.nome) return null
      const equipes = (Array.isArray(o.equipes) ? o.equipes : []).map((e) => ({ id: texto(obj(e).id), nome: texto(obj(e).nome) }))
      return { id: typeof o.id === 'string' ? o.id : undefined, nome: texto(o.nome), equipes }
    },
    async criarClube(nome) {
      const o = obj(dado(await req('POST', '/api/meu-time/clube', { nome })))
      return { id: typeof o.id === 'string' ? o.id : undefined, nome: texto(o.nome, nome), equipes: [] }
    },
    async vincularEquipe(equipeId) {
      await req('POST', '/api/meu-time/clube/equipes', { equipeId })
    },
    async listarNotificacoes() {
      const d = dado(await req('GET', '/api/meu-time/notificacoes'))
      return (Array.isArray(d) ? d : []).map((i) => {
        const o = obj(i)
        return { id: texto(o.id), tipo: texto(o.tipo), payload: obj(o.payload), lidaEm: typeof o.lidaEm === 'string' ? o.lidaEm : null, criadoEm: texto(o.criadoEm) }
      })
    },
    async marcarLida(id) {
      await req('POST', `/api/meu-time/notificacoes/${enc(id)}/lida`)
    },
  }
}

let padrao: ClienteFase2 | null = null
export function obterClienteFase2(): ClienteFase2 {
  padrao ??= criarClienteFase2()
  return padrao
}
