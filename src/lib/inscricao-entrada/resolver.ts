// Porta de entrada dos links do organizador (R15). Os links legados (categoria, campeonato, vaga) deixam de abrir
// um formulário próprio e passam a levar o líder para o Meu Time. Este leitor devolve só o necessário para a tela
// decidir o que mostrar: sem PII, sem o token e sem dados do organizador.
// Flag própria: INSCRICAO_VIA_MEU_TIME_ATIVO=1. Desligada, a rota responde 404 e o fluxo legado segue igual.
import { supabaseAdmin } from '@/lib/supabase-admin'
import { colunaAusente } from '@/lib/coluna-ausente'
import { campeonatoPublicado } from '@/lib/campeonato-publico'
import { idsCompeticoesPrivadas } from '@/lib/visibilidade-competicao'
import { periodoInscricao } from '@/lib/link-inscricao-campeonato'
import { linkVigente, type LinkCampeonato } from '@/lib/meu-time/convite'
import { naipeDaCategoria } from '@/lib/inscricoes-solicitacao/servico'

const db = supabaseAdmin as any

export function entradaViaMeuTimeAtiva(env: Record<string, string | undefined> = process.env) {
  return env.INSCRICAO_VIA_MEU_TIME_ATIVO === '1'
}

export type TipoEntrada = 'CATEGORIA' | 'CAMPEONATO' | 'VAGA'
export type SituacaoEntrada = 'ABERTA' | 'FECHADA' | 'ENCERRADA'

export type CategoriaEntrada = {
  categoriaId: string
  nome: string
  naipe?: 'FEMININO' | 'MASCULINO' | 'MISTO'
  modoInscricao: 'AUTOMATICA' | 'APROVACAO'
  periodo: { abre: string | null; fecha: string | null }
  situacao: SituacaoEntrada
}

export type EntradaInscricao = {
  tipo: TipoEntrada
  campeonato: string
  ligaId: number
  categorias: CategoriaEntrada[]
  privada: boolean
  /** Só quando o token dá direito de entrar em competição privada. É o valor aceito no campo `convite` das rotas do Meu Time. */
  conviteTokenParaApi?: string
}

/** Formato aceito para token de link (hex, uuid, base64url). Evita consulta ao banco com lixo. */
export function tokenComFormatoValido(token: unknown): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{8,200}$/.test(token)
}

type LigaEntrada = {
  id: number
  nome: string
  status: string
  simulacao?: boolean | null
  inscricoesAbertas: boolean | null
  inscricoesAberturaEm: string | null
  inscricoesEncerramentoEm: string | null
}

const COLUNAS_LIGA = 'id,nome,status,simulacao,inscricoesAbertas,inscricoesAberturaEm,inscricoesEncerramentoEm'

type CategoriaLinha = { id: string; ligaId: number; codigo: string; nome: string; ordem?: number | null; tokenInscricao?: string | null; modoInscricao?: string | null }

/** Erro de infraestrutura: a rota responde 503 genérico, nunca vaza o detalhe. */
export class ErroEntrada extends Error {}

function ler<T>(r: { data: T | null; error: any }): T | null {
  if (r.error) throw new ErroEntrada('leitura falhou')
  return r.data
}

async function lerCategorias(filtrar: (c: any) => any): Promise<CategoriaLinha[]> {
  const base = 'id,ligaId,codigo,nome,ordem,tokenInscricao'
  let r = await filtrar(db.from('CategoriaCampeonato').select(`${base},modoInscricao`).is('removidaEm', null))
  if (r.error && colunaAusente(r.error, ['modoInscricao'])) r = await filtrar(db.from('CategoriaCampeonato').select(base).is('removidaEm', null))
  return ler<CategoriaLinha[]>(r) ?? []
}

async function lerLinkDoCampeonato(token: string): Promise<{ ligaId: number; link: LinkCampeonato } | null> {
  const colunas = 'ligaId,token,ativo,revogadoEm'
  let r = await db.from('LinkInscricaoCampeonato').select(`${colunas},expiraEm`).eq('token', token).maybeSingle()
  if (r.error && colunaAusente(r.error, ['expiraEm'])) r = await db.from('LinkInscricaoCampeonato').select(colunas).eq('token', token).maybeSingle()
  if (r.error) {
    // Tabela ainda inexistente: o token simplesmente não existe.
    if (r.error.code === '42P01' || r.error.code === 'PGRST205') return null
    throw new ErroEntrada('leitura falhou')
  }
  if (!r.data) return null
  return { ligaId: Number(r.data.ligaId), link: r.data as LinkCampeonato }
}

async function lerVaga(token: string): Promise<{ ligaId: number; categoriaId: string } | null> {
  const r = await db.from('ConviteVagaEquipe').select('ligaId,categoriaCampeonatoId').eq('token', token).maybeSingle()
  if (r.error) {
    if (r.error.code === '42P01' || r.error.code === 'PGRST205') return null
    throw new ErroEntrada('leitura falhou')
  }
  if (!r.data) return null
  return { ligaId: Number(r.data.ligaId), categoriaId: String(r.data.categoriaCampeonatoId) }
}

function situacaoDaLiga(liga: LigaEntrada): SituacaoEntrada {
  const periodo = periodoInscricao(liga)
  if (periodo === 'aberto') return 'ABERTA'
  if (periodo === 'antes') return 'FECHADA'
  if (periodo === 'depois') return 'ENCERRADA'
  return ['FINALIZADO', 'ENCERRADA'].includes(String(liga.status).toUpperCase()) ? 'ENCERRADA' : 'FECHADA'
}

function montarCategoria(liga: LigaEntrada, categoria: CategoriaLinha): CategoriaEntrada {
  const naipe = naipeDaCategoria(categoria.codigo)
  return {
    categoriaId: categoria.id,
    nome: categoria.nome,
    ...(naipe ? { naipe } : {}),
    modoInscricao: categoria.modoInscricao === 'APROVACAO' ? 'APROVACAO' : 'AUTOMATICA',
    periodo: { abre: liga.inscricoesAberturaEm ?? null, fecha: liga.inscricoesEncerramentoEm ?? null },
    situacao: situacaoDaLiga(liga),
  }
}

/**
 * Resolve um token legado. `null` para qualquer token que não existe, está revogado, desativado ou expirado,
 * ou cujo campeonato não é publicado: o chamador responde igual nos quatro casos (nada de enumeração).
 * Lança ErroEntrada só para falha de infraestrutura.
 */
export async function resolverEntradaInscricao(token: string): Promise<EntradaInscricao | null> {
  if (!tokenComFormatoValido(token)) return null

  let tipo: TipoEntrada | null = null
  let ligaId = 0
  let categoriaAlvo: string | null = null
  let concedeConvite = false

  const porCategoria = await lerCategorias((c) => c.eq('tokenInscricao', token))
  if (porCategoria.length > 0) {
    tipo = 'CATEGORIA'
    ligaId = Number(porCategoria[0].ligaId)
    categoriaAlvo = porCategoria[0].id
    concedeConvite = true
  } else {
    const achado = await lerLinkDoCampeonato(token)
    if (achado) {
      if (!linkVigente(achado.link)) return null
      tipo = 'CAMPEONATO'
      ligaId = achado.ligaId
      concedeConvite = true
    } else {
      const vaga = await lerVaga(token)
      if (!vaga) return null
      tipo = 'VAGA'
      ligaId = vaga.ligaId
      categoriaAlvo = vaga.categoriaId
      // O token da vaga não é aceito como convite pelas regras atuais (avaliarConvite): não concede entrada em privada.
      concedeConvite = false
    }
  }

  const liga = ler<LigaEntrada>(await db.from('Liga').select(COLUNAS_LIGA).eq('id', ligaId).maybeSingle())
  if (!liga || !campeonatoPublicado(liga)) return null

  const categorias = await lerCategorias((c) => c.eq('ligaId', ligaId))
  const escolhidas = categoriaAlvo ? categorias.filter((item) => item.id === categoriaAlvo) : categorias
  if (categoriaAlvo && escolhidas.length === 0) return null
  escolhidas.sort((a, b) => Number(a.ordem ?? 0) - Number(b.ordem ?? 0))

  const privada = (await idsCompeticoesPrivadas({ semCache: true })).has(ligaId)
  return {
    tipo,
    campeonato: String(liga.nome ?? ''),
    ligaId,
    categorias: escolhidas.map((item) => montarCategoria(liga, item)),
    privada,
    ...(privada && concedeConvite ? { conviteTokenParaApi: token } : {}),
  }
}
