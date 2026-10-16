// Única porta de conversa da interface com o backend de "Meu Time".
// Contrato: sucesso `{data}`; falha `{error, codigo?}`; 503 = Meu Time ainda não habilitado.
import {
  classificarFalha,
  extrairData,
  falhaDeRede,
  type Falha,
} from '@/lib/meu-time-ui/respostas'
import type {
  Atleta,
  AtletaLote,
  DetalheEquipe,
  Equipe,
  EquipeResumo,
  MembroComissao,
  NovaEquipe,
  NovaInscricao,
  NovoAtleta,
  NovoMembroComissao,
  Prontidao,
  RespostaInscricao,
  ResultadoLote,
} from '@/lib/meu-time-ui/tipos'

export class ErroMeuTime extends Error {
  readonly falha: Falha
  constructor(falha: Falha) {
    super(falha.mensagem)
    Object.setPrototypeOf(this, ErroMeuTime.prototype)
    this.name = 'ErroMeuTime'
    this.falha = falha
  }
}

export interface MeuTimeClient {
  listarEquipes(): Promise<EquipeResumo[]>
  criarEquipe(dados: NovaEquipe): Promise<Equipe>
  obterEquipe(equipeId: string): Promise<DetalheEquipe>
  obterProntidao(equipeId: string): Promise<Prontidao>
  adicionarAtleta(equipeId: string, dados: NovoAtleta): Promise<Atleta>
  adicionarAtletasEmLote(equipeId: string, atletas: AtletaLote[]): Promise<ResultadoLote>
  atualizarAtleta(equipeId: string, atletaId: string, dados: Partial<NovoAtleta>): Promise<Atleta>
  removerAtleta(equipeId: string, atletaId: string): Promise<void>
  listarComissao(equipeId: string): Promise<MembroComissao[]>
  adicionarMembroComissao(equipeId: string, dados: NovoMembroComissao): Promise<MembroComissao>
  removerMembroComissao(equipeId: string, membroId: string): Promise<void>
  inscrever(equipeId: string, dados: NovaInscricao): Promise<RespostaInscricao>
}

// ---------------------------------------------------------------- HTTP

type Fetch = typeof fetch

export function criarClienteHttp(fetchImpl?: Fetch, base = '/api/meu-time'): MeuTimeClient {
  const chamar = fetchImpl ?? ((...args: Parameters<Fetch>) => fetch(...args))

  async function requisitar(metodo: string, caminho: string, corpo?: unknown): Promise<{ corpo: unknown }> {
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
    return { corpo: json }
  }

  async function lerData<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
    const { corpo: json } = await requisitar(metodo, caminho, corpo)
    const data = extrairData<T>(json)
    if (data === null || data === undefined) throw new ErroMeuTime(classificarFalha(500, null))
    return data
  }

  const equipe = (id: string) => `/equipes/${encodeURIComponent(id)}`

  return {
    async listarEquipes() {
      const data = await lerData<{ equipes: EquipeResumo[] }>('GET', '')
      return data.equipes
    },
    criarEquipe: (dados) => lerData<Equipe>('POST', '/equipes', dados),
    obterEquipe: (id) => lerData<DetalheEquipe>('GET', equipe(id)),
    obterProntidao: (id) => lerData<Prontidao>('GET', `${equipe(id)}/prontidao`),
    adicionarAtleta: (id, dados) => lerData<Atleta>('POST', `${equipe(id)}/atletas`, dados),
    adicionarAtletasEmLote: (id, atletas) => lerData<ResultadoLote>('POST', `${equipe(id)}/atletas/lote`, { atletas }),
    atualizarAtleta: (id, atletaId, dados) => lerData<Atleta>('PATCH', `${equipe(id)}/atletas/${encodeURIComponent(atletaId)}`, dados),
    async removerAtleta(id, atletaId) {
      await requisitar('DELETE', `${equipe(id)}/atletas/${encodeURIComponent(atletaId)}`)
    },
    listarComissao: (id) => lerData<MembroComissao[]>('GET', `${equipe(id)}/comissao`),
    adicionarMembroComissao: (id, dados) => lerData<MembroComissao>('POST', `${equipe(id)}/comissao`, dados),
    async removerMembroComissao(id, membroId) {
      await requisitar('DELETE', `${equipe(id)}/comissao/${encodeURIComponent(membroId)}`)
    },
    async inscrever(id, dados) {
      const { corpo } = await requisitar('POST', `${equipe(id)}/inscricoes`, dados)
      const data = extrairData<RespostaInscricao['data']>(corpo)
      if (!data) throw new ErroMeuTime(classificarFalha(500, null))
      const avisos = corpo && typeof corpo === 'object' && Array.isArray((corpo as { avisos?: unknown }).avisos)
        ? ((corpo as { avisos: unknown[] }).avisos.filter((a) => typeof a === 'string') as string[])
        : []
      return { data, avisos }
    },
  }
}

// ---------------------------------------------------------------- Em memória (testes)

type EquipeMemoria = Equipe & { atletas: Atleta[]; comissao: MembroComissao[]; inscricoes: DetalheEquipe['inscricoes'] }

export type OpcoesMemoria = {
  /** Simula o 503 do servidor. */
  naoHabilitado?: boolean
  equipes?: Array<Equipe & { atletas?: Atleta[]; comissao?: MembroComissao[] }>
}

function falhaMemoria(tipo: Falha['tipo'], status: number, mensagem: string): ErroMeuTime {
  return new ErroMeuTime({ tipo, status, mensagem })
}

export function mensagemProntidao(total: number, semDocumento: number) {
  if (total === 0) return 'Seu time ainda não tem atletas.'
  const base = `Seu time tem ${total} ${total === 1 ? 'atleta' : 'atletas'}.`
  if (semDocumento === 0) return `${base} Tudo certo com os documentos.`
  return `${base} ${semDocumento} ${semDocumento === 1 ? 'está' : 'estão'} sem documento.`
}

export function criarClienteMemoria(opcoes: OpcoesMemoria = {}): MeuTimeClient {
  let sequencia = 0
  const novoId = (prefixo: string) => `${prefixo}-${++sequencia}`
  const equipes = new Map<string, EquipeMemoria>()
  for (const semente of opcoes.equipes ?? []) {
    equipes.set(semente.id, { ...semente, atletas: semente.atletas ?? [], comissao: semente.comissao ?? [], inscricoes: [] })
  }

  const checar = () => {
    if (opcoes.naoHabilitado) throw falhaMemoria('nao-habilitado', 503, 'Meu Time ainda não habilitado')
  }
  const achar = (id: string) => {
    checar()
    const encontrada = equipes.get(id)
    if (!encontrada) throw falhaMemoria('nao-encontrado', 404, 'Time não encontrado.')
    return encontrada
  }
  const prontidao = (e: EquipeMemoria): Prontidao => {
    const semDocumento = e.atletas.filter((a) => !a.temDocumento).length
    return { atletas: e.atletas.length, semDocumento, mensagem: mensagemProntidao(e.atletas.length, semDocumento) }
  }
  const resumo = (e: EquipeMemoria): EquipeResumo => ({
    id: e.id, nome: e.nome, cidade: e.cidade, naipe: e.naipe, totalAtletas: e.atletas.length, prontidao: prontidao(e),
  })
  const publica = (e: EquipeMemoria): Equipe => ({ id: e.id, nome: e.nome, cidade: e.cidade, naipe: e.naipe, escudoUrl: e.escudoUrl ?? null })

  return {
    async listarEquipes() {
      checar()
      return Array.from(equipes.values()).map(resumo)
    },
    async criarEquipe(dados) {
      checar()
      const nome = dados.nome.trim()
      if (nome.length < 2) throw falhaMemoria('validacao', 422, 'Informe o nome do time.')
      const criada: EquipeMemoria = {
        id: novoId('eq'), nome, cidade: dados.cidade?.trim() || null, naipe: dados.naipe,
        escudoUrl: dados.escudoUrl ?? null, atletas: [], comissao: [], inscricoes: [],
      }
      equipes.set(criada.id, criada)
      return publica(criada)
    },
    async obterEquipe(id) {
      const e = achar(id)
      return { equipe: publica(e), atletas: [...e.atletas], comissao: [...e.comissao], inscricoes: [...e.inscricoes], prontidao: prontidao(e) }
    },
    async obterProntidao(id) {
      return prontidao(achar(id))
    },
    async adicionarAtleta(id, dados) {
      const e = achar(id)
      const atleta: Atleta = {
        id: novoId('at'), nome: dados.nome.trim(), dataNascimento: dados.dataNascimento,
        numeroPreferido: dados.numeroPreferido ?? null, posicao: dados.posicao ?? null, temDocumento: false,
      }
      e.atletas.push(atleta)
      return atleta
    },
    async adicionarAtletasEmLote(id, lista) {
      const e = achar(id)
      const ignorados: ResultadoLote['ignorados'] = []
      let criados = 0
      lista.forEach((item, indice) => {
        const nome = item.nome.trim()
        if (!nome) { ignorados.push({ linha: indice + 1, motivo: 'Sem nome.' }); return }
        if (e.atletas.some((a) => a.nome.toLowerCase() === nome.toLowerCase())) {
          ignorados.push({ linha: indice + 1, motivo: 'Já está no time.' }); return
        }
        e.atletas.push({ id: novoId('at'), nome, dataNascimento: null, numeroPreferido: item.numero ?? null, posicao: null, temDocumento: false })
        criados += 1
      })
      return { criados, ignorados }
    },
    async atualizarAtleta(id, atletaId, dados) {
      const e = achar(id)
      const indice = e.atletas.findIndex((a) => a.id === atletaId)
      if (indice < 0) throw falhaMemoria('nao-encontrado', 404, 'Atleta não encontrado.')
      const atual = e.atletas[indice]
      const atualizado: Atleta = {
        ...atual,
        nome: dados.nome?.trim() || atual.nome,
        dataNascimento: dados.dataNascimento ?? atual.dataNascimento,
        numeroPreferido: dados.numeroPreferido ?? atual.numeroPreferido,
        posicao: dados.posicao ?? atual.posicao,
      }
      e.atletas[indice] = atualizado
      return atualizado
    },
    async removerAtleta(id, atletaId) {
      const e = achar(id)
      e.atletas = e.atletas.filter((a) => a.id !== atletaId)
    },
    async listarComissao(id) {
      return [...achar(id).comissao]
    },
    async adicionarMembroComissao(id, dados) {
      const e = achar(id)
      const membro: MembroComissao = { id: novoId('cm'), nome: dados.nome.trim(), funcao: dados.funcao }
      e.comissao.push(membro)
      return membro
    },
    async removerMembroComissao(id, membroId) {
      const e = achar(id)
      e.comissao = e.comissao.filter((m) => m.id !== membroId)
    },
    async inscrever(id, dados) {
      const e = achar(id)
      if (dados.atletas.length === 0) throw falhaMemoria('validacao', 422, 'Escolha pelo menos um atleta.')
      const inscricao = {
        id: novoId('in'),
        categoriaCampeonatoId: dados.categoriaCampeonatoId,
        status: 'CONFIRMADA' as const,
        totalAtletas: dados.atletas.length,
      }
      e.inscricoes.push(inscricao)
      return { data: inscricao, avisos: [] }
    },
  }
}

let padrao: MeuTimeClient | null = null

/** Cliente HTTP compartilhado pelas telas. */
export function obterClientePadrao(): MeuTimeClient {
  if (!padrao) padrao = criarClienteHttp()
  return padrao
}
