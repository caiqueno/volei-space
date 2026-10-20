// Regras puras da "porta de entrada" de inscrição (links do organizador) e da continuação no Meu Time.
// Sem React, sem rede. Tudo atrás de NEXT_PUBLIC_INSCRICAO_VIA_MEU_TIME_ATIVO.

import type { OfertaCampeonato } from '@/lib/meu-time-campeonatos-ui/regras'

export type TipoEntrada = 'CATEGORIA' | 'CAMPEONATO' | 'VAGA'
export type ModoEntrada = 'AUTOMATICA' | 'APROVACAO'
export type SituacaoCategoria = 'ABERTA' | 'FECHADA' | 'ENCERRADA'

export type CategoriaEntrada = {
  categoriaId: string
  nome: string
  naipe?: string
  modo: ModoEntrada
  abre: string | null
  fecha: string | null
  situacao: SituacaoCategoria
}

export type Entrada = {
  tipo: TipoEntrada
  campeonato: string
  ligaId: string
  categorias: CategoriaEntrada[]
  privada: boolean
  /** Token a repassar no POST (`convite`), quando o servidor o devolve; senão vale o token do link. */
  conviteTokenParaApi?: string
}

/** Flag de tela. Desligada = formulários legados e /capitao como estão. */
export function inscricaoViaMeuTimeAtiva(valor: string | undefined = process.env.NEXT_PUBLIC_INSCRICAO_VIA_MEU_TIME_ATIVO): boolean {
  return valor === '1'
}

// ---------------------------------------------------------------- normalização

function texto(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function dataOuNulo(v: unknown): string | null {
  const t = texto(v)
  return t && !Number.isNaN(Date.parse(t)) ? t : null
}

export function normalizarEntrada(bruto: unknown): Entrada | null {
  if (!bruto || typeof bruto !== 'object') return null
  const o = bruto as Record<string, unknown>
  const tipo: TipoEntrada | null = o.tipo === 'CATEGORIA' || o.tipo === 'CAMPEONATO' || o.tipo === 'VAGA' ? o.tipo : null
  const campeonato = texto(o.campeonato)
  if (!tipo || !campeonato) return null
  const lista = Array.isArray(o.categorias) ? o.categorias : []
  const categorias: CategoriaEntrada[] = []
  for (const item of lista) {
    if (!item || typeof item !== 'object') continue
    const c = item as Record<string, unknown>
    const id = typeof c.categoriaId === 'string' || typeof c.categoriaId === 'number' ? String(c.categoriaId) : ''
    const nome = texto(c.nome)
    if (!id || !nome) continue
    const periodo = c.periodo && typeof c.periodo === 'object' ? (c.periodo as Record<string, unknown>) : {}
    const situacao: SituacaoCategoria = c.situacao === 'ABERTA' || c.situacao === 'FECHADA' ? c.situacao : 'ENCERRADA'
    categorias.push({
      categoriaId: id,
      nome,
      naipe: texto(c.naipe) || undefined,
      modo: c.modoInscricao === 'AUTOMATICA' ? 'AUTOMATICA' : 'APROVACAO',
      abre: dataOuNulo(periodo.abre),
      fecha: dataOuNulo(periodo.fecha),
      situacao,
    })
  }
  return {
    tipo,
    campeonato,
    ligaId: typeof o.ligaId === 'string' || typeof o.ligaId === 'number' ? String(o.ligaId) : '',
    categorias,
    privada: o.privada === true,
    conviteTokenParaApi: texto(o.conviteTokenParaApi) || undefined,
  }
}

// ---------------------------------------------------------------- estados da porta

export type EstadoPorta =
  | { estado: 'desligada' }
  | { estado: 'carregando' }
  | { estado: 'invalido' }
  | { estado: 'indisponivel' }
  | { estado: 'aberta'; entrada: Entrada; abertas: CategoriaEntrada[] }
  | { estado: 'ainda-nao'; entrada: Entrada }
  | { estado: 'encerrada'; entrada: Entrada }

/** Classifica a resposta da API (`status` HTTP e corpo já normalizado) no estado da tela. */
export function estadoDaPorta(flag: boolean, resposta: { status: number; entrada: Entrada | null } | null): EstadoPorta {
  if (!flag) return { estado: 'desligada' }
  if (!resposta) return { estado: 'carregando' }
  if (resposta.status === 404 || resposta.status === 410) return { estado: 'invalido' }
  if (resposta.status >= 400 || !resposta.entrada) return { estado: 'indisponivel' }
  const entrada = resposta.entrada
  const abertas = entrada.categorias.filter((c) => c.situacao === 'ABERTA')
  if (abertas.length > 0) return { estado: 'aberta', entrada, abertas }
  if (entrada.categorias.some((c) => c.situacao === 'FECHADA')) return { estado: 'ainda-nao', entrada }
  return { estado: 'encerrada', entrada }
}

export const ROTULO_MODO_ENTRADA: Readonly<Record<ModoEntrada, string>> = {
  AUTOMATICA: 'Inscrição automática: seu time entra na hora',
  APROVACAO: 'Com aprovação: o organizador analisa o seu pedido',
}

export function textoPeriodo(c: Pick<CategoriaEntrada, 'abre' | 'fecha'>, formatar: (iso: string) => string = formatarData): string {
  if (c.abre && c.fecha) return `De ${formatar(c.abre)} até ${formatar(c.fecha)}`
  if (c.fecha) return `Até ${formatar(c.fecha)}`
  if (c.abre) return `A partir de ${formatar(c.abre)}`
  return 'Sem prazo definido'
}

export function formatarData(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' })
}

// ---------------------------------------------------------------- returnTo e continuação

const PREFIXOS_PERMITIDOS = ['/meu-time', '/inscricao', '/inscricao-rapida'] as const

/** Aceita só caminho interno nosso. Nunca URL externa, `//host` ou barra invertida. */
export function returnToSeguro(valor: string | null | undefined): string | null {
  if (!valor || valor.length > 600) return null
  const bruto = valor.trim()
  let decodificado: string
  try {
    decodificado = decodeURIComponent(bruto)
  } catch {
    return null
  }
  for (const v of [bruto, decodificado]) {
    if (!v.startsWith('/') || v.startsWith('//') || v.includes('\\') || /[\u0000-\u001f]/.test(v)) return null
    const caminho = v.split(/[?#]/)[0]
    if (!PREFIXOS_PERMITIDOS.some((p) => caminho === p || caminho.startsWith(`${p}/`))) return null
  }
  return bruto
}

export type LeituraEntrada = { categoria?: string; entrada?: string }

/** Lê `?categoria=&entrada=`. Valores vazios, enormes ou com caracteres estranhos são descartados. */
export function lerEntradaDaUrl(obter: (chave: string) => string | null | undefined): LeituraEntrada {
  const limpa = (chave: string, max: number) => {
    const v = obter(chave)?.trim()
    return v && v.length <= max && /^[\w.~-]+$/.test(v) ? v : undefined
  }
  return { categoria: limpa('categoria', 80), entrada: limpa('entrada', 200) }
}

export function hrefContinuacao(token: string, categoriaId?: string): string {
  const p = new URLSearchParams()
  if (categoriaId) p.set('categoria', categoriaId)
  p.set('entrada', token)
  return `/meu-time/campeonatos?${p.toString()}`
}

/** Para onde voltar depois de entrar ou criar a conta. */
export function montarReturnTo(token: string, categoriaId?: string): string {
  return hrefContinuacao(token, categoriaId)
}

export function hrefLogin(returnTo: string): string {
  return `/login?modo=membro&returnTo=${encodeURIComponent(returnTo)}`
}

export function hrefCadastro(returnTo: string): string {
  return `/cadastro?perfil=equipe&returnTo=${encodeURIComponent(returnTo)}`
}

export function hrefCriarTime(voltarPara: string): string {
  return `/meu-time/novo?voltar=${encodeURIComponent(voltarPara)}`
}

/** Destino pós-login: o `returnTo` seguro tem prioridade sobre o destino padrão, só com a flag ligada. */
export function destinoPosLogin(flag: boolean, returnTo: string | null | undefined, padrao: string): string {
  if (!flag) return padrao
  return returnToSeguro(returnTo) ?? padrao
}

// ---------------------------------------------------------------- ofertas vindas da entrada

/** Categorias do convite como ofertas do Meu Time (servem para convite privado, que a lista comum não traz). */
export function ofertasDaEntrada(entrada: Entrada, categoriaId?: string): OfertaCampeonato[] {
  return entrada.categorias
    .filter((c) => !categoriaId || c.categoriaId === categoriaId)
    .map((c) => ({
      ligaId: entrada.ligaId,
      categoriaId: c.categoriaId,
      campeonato: entrada.campeonato,
      categoria: c.nome,
      naipe: c.naipe ?? '',
      modo: c.modo,
      situacao: c.situacao === 'ABERTA' ? ('DISPONIVEL' as const) : ('ENCERRADA' as const),
    }))
}

/**
 * Junta a lista do servidor com as categorias do convite. A oferta do servidor vence (traz o estado real da equipe);
 * a do convite só entra quando o servidor não a listou. A categoria do convite vai primeiro.
 */
export function mesclarOfertas(doServidor: OfertaCampeonato[], daEntrada: OfertaCampeonato[]): OfertaCampeonato[] {
  if (daEntrada.length === 0) return doServidor
  const destaque = daEntrada.map((e) => doServidor.find((s) => s.categoriaId === e.categoriaId) ?? e)
  const ids = new Set(destaque.map((o) => o.categoriaId))
  return [...destaque, ...doServidor.filter((o) => !ids.has(o.categoriaId))]
}

/** O `convite` só vai no POST de categorias que pertencem ao convite. */
export function conviteParaCategoria(entrada: Entrada | null, token: string | undefined, categoriaId: string): string | undefined {
  if (!entrada || !token) return undefined
  if (!entrada.categorias.some((c) => c.categoriaId === categoriaId)) return undefined
  return entrada.conviteTokenParaApi ?? token
}

export type PassoSeguinte = { href: string; rotulo: string }

/** O que fazer depois de inscrever: completar atletas e documentos na ficha do time. */
export function proximosPassos(equipeId: string): PassoSeguinte[] {
  return [{ href: `/meu-time/${encodeURIComponent(equipeId)}`, rotulo: 'Completar atletas e documentos' }]
}

// ---------------------------------------------------------------- guarda do token (sessionStorage)

const CHAVE = 'vs_entrada_inscricao'

type Armazem = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function armazemPadrao(): Armazem | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

export function guardarEntrada(l: LeituraEntrada, armazem: Armazem | null = armazemPadrao()): void {
  if (!armazem || !l.entrada) return
  try {
    armazem.setItem(CHAVE, JSON.stringify(l))
  } catch {
    /* sem armazenamento: segue só com a URL */
  }
}

export function lerEntradaGuardada(armazem: Armazem | null = armazemPadrao()): LeituraEntrada {
  if (!armazem) return {}
  try {
    const bruto = armazem.getItem(CHAVE)
    if (!bruto) return {}
    const o = JSON.parse(bruto) as LeituraEntrada
    return lerEntradaDaUrl((k) => (k === 'categoria' ? o.categoria : k === 'entrada' ? o.entrada : undefined))
  } catch {
    return {}
  }
}

export function limparEntradaGuardada(armazem: Armazem | null = armazemPadrao()): void {
  try {
    armazem?.removeItem(CHAVE)
  } catch {
    /* nada a limpar */
  }
}

// ---------------------------------------------------------------- /capitao

export const MENSAGEM_CAPITAO = 'O painel do capitão agora é o Meu Time: tudo em um só lugar.'

/** Destino do /capitao com a flag ligada. Sem conta (sessão ausente) vai explicar no cadastro. */
export function destinoCapitao(temSessao: boolean): string {
  return temSessao ? '/meu-time?de=capitao' : '/login?modo=membro&de=capitao&returnTo=%2Fmeu-time'
}

export const AVISO_SLUG = 'Peça um novo convite ao líder do time.'
