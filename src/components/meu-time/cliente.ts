// Única porta de conversa da interface com o backend de "Meu Time".
// Contrato (docs/analise/20-contrato-meu-time.yaml): sucesso `{data}`; falha `{error, codigo?, erros?}`; 503 = Meu Time ainda não habilitado.
//
// Comissão técnica = nome + função, em /equipes/:id/comissao (sem conta no sistema).
// Pessoas com acesso à equipe (com conta, por e-mail) ficam em /equipes/:id/membros.
import {
  classificarFalha,
  extrairData,
  falhaDeRede,
  normalizarRegrasCategoria,
  normalizarResultadoLote,
  type Falha,
} from '@/lib/meu-time-ui/respostas'
import { mensagemSemPermissao, podeFazer, type Acao } from '@/lib/meu-time-ui/permissoes'
import { POSICOES_CODIGOS } from '@/lib/meu-time-ui/tipos'
import type {
  Atleta,
  AtletaLote,
  DetalheEquipe,
  EdicaoEquipe,
  Equipe,
  EquipeResumo,
  MembroAcesso,
  MembroComissao,
  NovaEquipe,
  NovaInscricao,
  NovoAcesso,
  NovoAtleta,
  NovoMembroComissao,
  PapelAcesso,
  Prontidao,
  RegrasCategoria,
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
  atualizarEquipe(equipeId: string, dados: EdicaoEquipe): Promise<Equipe>
  obterProntidao(equipeId: string): Promise<Prontidao>
  adicionarAtleta(equipeId: string, dados: NovoAtleta): Promise<Atleta>
  adicionarAtletasEmLote(equipeId: string, atletas: AtletaLote[]): Promise<ResultadoLote>
  atualizarAtleta(equipeId: string, atletaId: string, dados: Partial<NovoAtleta>): Promise<Atleta>
  removerAtleta(equipeId: string, atletaId: string): Promise<void>
  listarComissao(equipeId: string): Promise<MembroComissao[]>
  adicionarMembroComissao(equipeId: string, dados: NovoMembroComissao): Promise<MembroComissao>
  removerMembroComissao(equipeId: string, membroId: string): Promise<void>
  listarAcesso(equipeId: string): Promise<MembroAcesso[]>
  adicionarAcesso(equipeId: string, dados: NovoAcesso): Promise<MembroAcesso>
  removerAcesso(equipeId: string, membroId: string): Promise<void>
  obterRegrasCategoria(categoriaId: string): Promise<RegrasCategoria>
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
    atualizarEquipe: (id, dados) => lerData<Equipe>('PATCH', equipe(id), dados),
    obterProntidao: (id) => lerData<Prontidao>('GET', `${equipe(id)}/prontidao`),
    adicionarAtleta: (id, dados) => lerData<Atleta>('POST', `${equipe(id)}/atletas`, dados),
    async adicionarAtletasEmLote(id, atletas) {
      const resultado = normalizarResultadoLote(await lerData<unknown>('POST', `${equipe(id)}/atletas/lote`, { atletas }))
      if (!resultado) throw new ErroMeuTime(classificarFalha(500, null))
      return resultado
    },
    atualizarAtleta: (id, atletaId, dados) => lerData<Atleta>('PATCH', `${equipe(id)}/atletas/${encodeURIComponent(atletaId)}`, dados),
    async removerAtleta(id, atletaId) {
      await requisitar('DELETE', `${equipe(id)}/atletas/${encodeURIComponent(atletaId)}`)
    },
    listarComissao: (id) => lerData<MembroComissao[]>('GET', `${equipe(id)}/comissao`),
    adicionarMembroComissao: (id, dados) => lerData<MembroComissao>('POST', `${equipe(id)}/comissao`, dados),
    async removerMembroComissao(id, membroId) {
      await requisitar('DELETE', `${equipe(id)}/comissao/${encodeURIComponent(membroId)}`)
    },
    listarAcesso: (id) => lerData<MembroAcesso[]>('GET', `${equipe(id)}/membros`),
    adicionarAcesso: (id, dados) => lerData<MembroAcesso>('POST', `${equipe(id)}/membros`, dados),
    async removerAcesso(id, membroId) {
      await requisitar('DELETE', `${equipe(id)}/membros?membroId=${encodeURIComponent(membroId)}`)
    },
    async obterRegrasCategoria(categoriaId) {
      const regras = normalizarRegrasCategoria(await lerData<unknown>('GET', `/categorias/${encodeURIComponent(categoriaId)}/regras`))
      if (!regras) throw new ErroMeuTime(classificarFalha(500, null))
      return regras
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

type EquipeMemoria = Equipe & {
  atletas: Atleta[]
  comissao: MembroComissao[]
  acesso: MembroAcesso[]
  inscricoes: DetalheEquipe['inscricoes']
  meuPapel: PapelAcesso
}

export type OpcoesMemoria = {
  /** Simula o 503 do servidor (tabela ausente). */
  naoHabilitado?: boolean
  /** Simula a flag MEU_TIME_ATIVO desligada: 404 `{error:'Não encontrado.'}` em tudo. */
  desligado?: boolean
  equipes?: Array<Equipe & { atletas?: Atleta[]; comissao?: MembroComissao[]; acesso?: MembroAcesso[]; meuPapel?: PapelAcesso }>
  /** Regras por categoria; categoria ausente responde 404 (a tela cai nas regras da URL). */
  regras?: RegrasCategoria[]
  /** E-mails com conta, para o convite de acesso (e-mail -> nome). */
  contas?: Record<string, string>
}

function falhaMemoria(tipo: Falha['tipo'], status: number, mensagem: string, codigo?: string): ErroMeuTime {
  return new ErroMeuTime({ tipo, status, mensagem, codigo })
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
    equipes.set(semente.id, {
      ...semente,
      atletas: semente.atletas ?? [],
      comissao: semente.comissao ?? [],
      acesso: semente.acesso ?? [{ id: 'voce', nome: 'Você', papel: semente.meuPapel ?? 'RESPONSAVEL', voce: true }],
      inscricoes: [],
      meuPapel: semente.meuPapel ?? 'RESPONSAVEL',
    })
  }

  const checar = () => {
    if (opcoes.desligado) throw new ErroMeuTime(classificarFalha(404, { error: 'Não encontrado.' }))
    if (opcoes.naoHabilitado) throw falhaMemoria('nao-habilitado', 503, 'Meu Time ainda não habilitado')
  }
  const achar = (id: string) => {
    checar()
    const encontrada = equipes.get(id)
    if (!encontrada) throw falhaMemoria('nao-encontrado', 404, 'Time não encontrado.')
    return encontrada
  }
  // Mesma matriz do servidor (contrato): atletas, inscrição e comissão = RESPONSAVEL e TECNICO; dados e acesso = só RESPONSAVEL.
  const exigir = (e: EquipeMemoria, acao: Acao) => {
    if (!podeFazer(e.meuPapel, acao)) throw falhaMemoria('sem-permissao', 403, mensagemSemPermissao(acao), 'SEM_PERMISSAO')
  }
  const exigirResponsavel = (e: EquipeMemoria) => exigir(e, 'acesso')
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
      const duplicada = Array.from(equipes.values()).some((e) => e.nome.toLowerCase() === nome.toLowerCase() && e.naipe === dados.naipe)
      if (duplicada) throw falhaMemoria('conflito', 409, 'Já existe um time com esse nome e naipe.', 'EQUIPE_DUPLICADA')
      const criada: EquipeMemoria = {
        id: novoId('eq'), nome, cidade: dados.cidade?.trim() || null, naipe: dados.naipe,
        escudoUrl: dados.escudoUrl ?? null, atletas: [], comissao: [],
        acesso: [{ id: 'voce', nome: 'Você', papel: 'RESPONSAVEL', voce: true }], inscricoes: [], meuPapel: 'RESPONSAVEL',
      }
      equipes.set(criada.id, criada)
      return publica(criada)
    },
    async obterEquipe(id) {
      const e = achar(id)
      return {
        equipe: publica(e), atletas: [...e.atletas], comissao: [...e.comissao], membros: [...e.acesso],
        inscricoes: [...e.inscricoes], prontidao: prontidao(e), meuPapel: e.meuPapel,
      }
    },
    async atualizarEquipe(id, dados) {
      const e = achar(id)
      exigir(e, 'dados')
      const nome = dados.nome.trim()
      if (nome.length < 2) throw falhaMemoria('validacao', 422, 'Informe o nome do time.')
      const duplicada = Array.from(equipes.values()).some((o) => o.id !== e.id && o.nome.toLowerCase() === nome.toLowerCase() && o.naipe === e.naipe)
      if (duplicada) throw falhaMemoria('conflito', 409, 'Já existe um time com esse nome e naipe.', 'EQUIPE_DUPLICADA')
      e.nome = nome
      e.cidade = dados.cidade?.trim() || null
      e.escudoUrl = dados.escudoUrl?.trim() || null
      return publica(e)
    },
    async obterProntidao(id) {
      return prontidao(achar(id))
    },
    async adicionarAtleta(id, dados) {
      const e = achar(id)
      exigir(e, 'atletas')
      const atleta: Atleta = {
        id: novoId('at'), nome: dados.nome.trim(), dataNascimento: dados.dataNascimento,
        numeroPreferido: dados.numeroPreferido ?? null, posicao: dados.posicao ?? null, temDocumento: false,
      }
      e.atletas.push(atleta)
      return atleta
    },
    async adicionarAtletasEmLote(id, lista) {
      const e = achar(id)
      exigir(e, 'atletas')
      const ignorados: ResultadoLote['ignorados'] = []
      const atletasCriados: Atleta[] = []
      lista.forEach((item, indice) => {
        const nome = item.nome.trim()
        // `linha` = posição (1 a N) na lista enviada, como no servidor.
        if (!nome) { ignorados.push({ linha: indice + 1, motivo: 'Sem nome.' }); return }
        if (item.numero != null && (!Number.isInteger(item.numero) || item.numero < 0 || item.numero > 99)) {
          ignorados.push({ linha: indice + 1, motivo: 'Camisa fora de 0 a 99.' }); return
        }
        if (e.atletas.some((a) => a.nome.toLowerCase() === nome.toLowerCase())) {
          ignorados.push({ linha: indice + 1, motivo: 'Já está no time.' }); return
        }
        const novo: Atleta = {
          id: novoId('at'), nome, dataNascimento: item.dataNascimento ?? null,
          numeroPreferido: item.numero ?? null,
          posicao: item.posicao && (POSICOES_CODIGOS as readonly string[]).includes(item.posicao) ? item.posicao : null,
          temDocumento: false,
        }
        e.atletas.push(novo)
        atletasCriados.push(novo)
      })
      return { criados: atletasCriados.length, atletasCriados, ignorados }
    },
    async atualizarAtleta(id, atletaId, dados) {
      const e = achar(id)
      exigir(e, 'atletas')
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
      exigir(e, 'atletas')
      e.atletas = e.atletas.filter((a) => a.id !== atletaId)
    },
    async listarComissao(id) {
      return [...achar(id).comissao]
    },
    async adicionarMembroComissao(id, dados) {
      const e = achar(id)
      exigir(e, 'comissao')
      const membro: MembroComissao = { id: novoId('cm'), nome: dados.nome.trim(), funcao: dados.funcao }
      e.comissao.push(membro)
      return membro
    },
    async removerMembroComissao(id, membroId) {
      const e = achar(id)
      exigir(e, 'comissao')
      e.comissao = e.comissao.filter((m) => m.id !== membroId)
    },
    async listarAcesso(id) {
      return [...achar(id).acesso]
    },
    async adicionarAcesso(id, dados) {
      const e = achar(id)
      exigirResponsavel(e)
      const email = dados.email.trim().toLowerCase()
      const nome = opcoes.contas?.[email]
      if (!nome) throw falhaMemoria('nao-encontrado', 404, 'Conta não encontrada.', 'CONTA_NAO_ENCONTRADA')
      if (e.acesso.some((m) => m.nome === nome)) throw falhaMemoria('conflito', 409, 'Já é membro.', 'MEMBRO_DUPLICADO')
      const membro: MembroAcesso = { id: novoId('ac'), nome, papel: dados.papel }
      e.acesso.push(membro)
      return membro
    },
    async removerAcesso(id, membroId) {
      const e = achar(id)
      exigirResponsavel(e)
      const alvo = e.acesso.find((m) => m.id === membroId)
      if (!alvo) throw falhaMemoria('nao-encontrado', 404, 'Pessoa não encontrada.')
      if (alvo.papel === 'RESPONSAVEL') throw falhaMemoria('conflito', 409, 'O responsável não sai por aqui.', 'RESPONSAVEL_FIXO')
      e.acesso = e.acesso.filter((m) => m.id !== membroId)
    },
    async obterRegrasCategoria(categoriaId) {
      checar()
      const regras = opcoes.regras?.find((r) => r.categoriaId === categoriaId)
      if (!regras) throw falhaMemoria('nao-encontrado', 404, 'Categoria não encontrada.', 'CATEGORIA_NAO_ENCONTRADA')
      return regras
    },
    async inscrever(id, dados) {
      const e = achar(id)
      exigir(e, 'inscricao')
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
