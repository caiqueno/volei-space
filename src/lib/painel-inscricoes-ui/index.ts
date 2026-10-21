/** Lógica PURA da área de Inscrições e Minha equipe do organizador (sem React, sem rede). A regra de verdade é do servidor. */

export const INTERVALO_INSCRICOES_MS = 20_000
export const MENSAGEM_MAX = 500

/** Só o valor exato '1' liga a área nova. */
export function painelInscricoesAtivo(valor: string | undefined | null): boolean {
  return valor === '1'
}

export type StatusInscricao =
  | 'RASCUNHO' | 'EM_ANALISE' | 'CONFIRMADA' | 'CONFIRMADA_COM_PENDENCIAS' | 'AJUSTE_PEDIDO' | 'LISTA_ESPERA' | 'REMOVIDA'
export type AcaoDecisao = 'APROVAR' | 'ANALISAR' | 'PEDIR_CORRECAO' | 'LISTA_ESPERA' | 'RECUSAR'
export type PapelOrganizador = 'ADMINISTRADOR' | 'FINANCEIRO' | 'ARBITRAGEM'
export type AbaInscricao = 'EM_ANALISE' | 'PENDENCIA' | 'LISTA_ESPERA' | 'APROVADAS' | 'RECUSADAS'

const STATUS: StatusInscricao[] = ['RASCUNHO', 'EM_ANALISE', 'CONFIRMADA', 'CONFIRMADA_COM_PENDENCIAS', 'AJUSTE_PEDIDO', 'LISTA_ESPERA', 'REMOVIDA']

export interface InscricaoItem {
  id: string
  equipe: { id: string; nome: string; cidade: string | null }
  categoria: string
  campeonato: string
  ligaId: string
  status: StatusInscricao
  atletas: number
  pendencias: string[]
  posicaoEspera: number | null
  atualizadoEm: string | null
  comentariosAbertos: number
}

export interface AtletaDetalhe {
  id: string
  nome: string
  camisa: number | null
  capitao: boolean
  libero: boolean
  temFoto: boolean
  temDocumento: boolean
  temCpf: boolean
}

export interface ComentarioInscricao {
  id: string
  autor: string
  texto: string
  criadoEm: string | null
}

export interface InscricaoDetalhe extends InscricaoItem {
  atletasLista: AtletaDetalhe[]
  comissao: Array<{ nome: string; funcao: string }>
  comentarios: ComentarioInscricao[]
}

export interface MembroEquipe {
  email: string
  nome: string | null
  papel: PapelOrganizador
  pendente: boolean
}

function texto(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v)
}

function numero(v: unknown, padrao = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : padrao
}

function objeto(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
}

export function normalizarStatus(v: unknown): StatusInscricao {
  const s = texto(v).trim().toUpperCase()
  return (STATUS as string[]).includes(s) ? (s as StatusInscricao) : 'EM_ANALISE'
}

export function normalizarPapel(v: unknown): PapelOrganizador | null {
  const s = texto(v).trim().toUpperCase()
  return s === 'ADMINISTRADOR' || s === 'FINANCEIRO' || s === 'ARBITRAGEM' ? s : null
}

function normalizarItem(bruto: unknown): InscricaoItem | null {
  const s = objeto(bruto)
  if (s.id == null || s.id === '') return null
  const eq = objeto(s.equipe)
  const camp = s.campeonato
  const campObj = objeto(camp)
  const nomeCamp = typeof camp === 'object' && camp ? texto(campObj.nome) : texto(camp)
  const cat = s.categoria
  const nomeCat = typeof cat === 'object' && cat ? texto(objeto(cat).nome) : texto(cat)
  return {
    id: texto(s.id),
    equipe: { id: texto(eq.id), nome: texto(eq.nome) || 'Equipe', cidade: eq.cidade ? texto(eq.cidade) : null },
    categoria: nomeCat,
    campeonato: nomeCamp,
    ligaId: texto(s.ligaId ?? campObj.id),
    status: normalizarStatus(s.status),
    atletas: Math.max(0, Math.floor(numero(s.atletas))),
    pendencias: Array.isArray(s.pendencias) ? s.pendencias.map(texto).filter(Boolean) : [],
    posicaoEspera: s.posicaoEspera == null ? null : numero(s.posicaoEspera, 0) || null,
    atualizadoEm: s.atualizadoEm ? texto(s.atualizadoEm) : null,
    comentariosAbertos: Math.max(0, Math.floor(numero(s.comentariosAbertos))),
  }
}

export function normalizarInscricoes(corpo: unknown): { itens: InscricaoItem[]; total: number } {
  const dados = objeto(objeto(corpo).data)
  const bruta = Array.isArray(dados.itens) ? dados.itens : []
  const itens: InscricaoItem[] = []
  for (const b of bruta) {
    const i = normalizarItem(b)
    if (i) itens.push(i)
  }
  const total = numero(dados.total, itens.length)
  return { itens, total: Math.max(total, itens.length) }
}

export function normalizarDetalhe(corpo: unknown): InscricaoDetalhe | null {
  const d = objeto(objeto(corpo).data)
  const base = normalizarItem(d)
  if (!base) return null
  const atletasBrutos = Array.isArray(d.atletas) ? d.atletas : Array.isArray(d.atletasLista) ? d.atletasLista : []
  const atletasLista: AtletaDetalhe[] = []
  for (const b of atletasBrutos) {
    const a = objeto(b)
    if (a.id == null) continue
    atletasLista.push({
      id: texto(a.id),
      nome: texto(a.nome) || 'Atleta',
      camisa: a.camisa == null || a.camisa === '' || !Number.isFinite(Number(a.camisa)) ? null : Number(a.camisa),
      capitao: a.capitao === true,
      libero: a.libero === true,
      temFoto: a.temFoto === true,
      temDocumento: a.temDocumento === true,
      temCpf: a.temCpf === true,
    })
  }
  const comissao = (Array.isArray(d.comissao) ? d.comissao : []).map((c) => {
    const o = objeto(c)
    return { nome: texto(o.nome), funcao: texto(o.funcao ?? o.papel) }
  }).filter((c) => c.nome)
  const comentarios: ComentarioInscricao[] = []
  for (const c of Array.isArray(d.comentarios) ? d.comentarios : []) {
    const o = objeto(c)
    const t = texto(o.texto ?? o.mensagem)
    if (!t) continue
    comentarios.push({ id: texto(o.id) || String(comentarios.length), autor: texto(o.autor) || 'Organização', texto: t, criadoEm: o.criadoEm ? texto(o.criadoEm) : null })
  }
  return { ...base, atletas: base.atletas || atletasLista.length, atletasLista, comissao, comentarios }
}

/** Resposta de GET /api/organizador/equipe: membros e, se o servidor informar, o papel de quem está logado. */
export function normalizarEquipe(corpo: unknown): { membros: MembroEquipe[]; meuPapel: PapelOrganizador | null } {
  const data = objeto(corpo).data
  const d = objeto(data)
  const bruta = Array.isArray(data) ? data : Array.isArray(d.membros) ? d.membros : []
  const membros: MembroEquipe[] = []
  for (const b of bruta) {
    const m = objeto(b)
    const papel = normalizarPapel(m.papel)
    const email = texto(m.email).trim()
    if (!papel || !email) continue
    membros.push({ email, nome: m.nome ? texto(m.nome) : null, papel, pendente: m.pendente === true || texto(m.status).toUpperCase() === 'PENDENTE' })
  }
  return { membros, meuPapel: normalizarPapel(d.meuPapel) }
}

// ---------- Abas e contadores ----------

export const ABAS: Array<{ value: AbaInscricao; rotulo: string; status: StatusInscricao[] }> = [
  { value: 'EM_ANALISE', rotulo: 'Em análise', status: ['EM_ANALISE'] },
  { value: 'PENDENCIA', rotulo: 'Pendência', status: ['AJUSTE_PEDIDO', 'CONFIRMADA_COM_PENDENCIAS'] },
  { value: 'LISTA_ESPERA', rotulo: 'Lista de espera', status: ['LISTA_ESPERA'] },
  { value: 'APROVADAS', rotulo: 'Aprovadas', status: ['CONFIRMADA'] },
  { value: 'RECUSADAS', rotulo: 'Recusadas', status: ['REMOVIDA'] },
]

export function statusDaAba(aba: AbaInscricao): StatusInscricao[] {
  return ABAS.find((a) => a.value === aba)?.status ?? []
}

export function contarPorAba(lista: Array<{ status: string }>): Record<AbaInscricao, number> {
  const out: Record<AbaInscricao, number> = { EM_ANALISE: 0, PENDENCIA: 0, LISTA_ESPERA: 0, APROVADAS: 0, RECUSADAS: 0 }
  for (const i of lista) {
    const aba = ABAS.find((a) => (a.status as string[]).includes(i.status))
    if (aba) out[aba.value] += 1
  }
  return out
}

export function filtrarPorAba<T extends { status: string }>(lista: T[], aba: AbaInscricao): T[] {
  const st = statusDaAba(aba) as string[]
  return lista.filter((i) => st.includes(i.status))
}

/** Contador do menu: em análise + pendências (rascunhos não contam). */
export function contarParaMenu(lista: Array<{ status: string }>): number {
  const c = contarPorAba(lista)
  return c.EM_ANALISE + c.PENDENCIA
}

export function rotuloContador(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return ''
  return n > 99 ? '99+' : String(Math.floor(n))
}

// ---------- Filtros e URLs ----------

export interface FiltrosInscricao {
  ligaId?: string
  categoriaId?: string
  status?: string
  q?: string
  pagina?: number
}

const SOMENTE_DIGITOS = /^\d+$/

export function urlInscricoes(f: FiltrosInscricao = {}): string {
  const p = new URLSearchParams()
  if (f.ligaId && SOMENTE_DIGITOS.test(f.ligaId)) p.set('ligaId', f.ligaId)
  if (f.categoriaId && SOMENTE_DIGITOS.test(f.categoriaId)) p.set('categoriaId', f.categoriaId)
  if (f.status && (STATUS as string[]).includes(f.status)) p.set('status', f.status)
  const q = (f.q ?? '').trim().slice(0, 80)
  if (q) p.set('q', q)
  if (f.pagina && f.pagina > 1) p.set('pagina', String(Math.floor(f.pagina)))
  const s = p.toString()
  return `/api/organizador/inscricoes${s ? `?${s}` : ''}`
}

export function urlExportar(f: Pick<FiltrosInscricao, 'ligaId' | 'categoriaId' | 'status'> = {}): string {
  return urlInscricoes({ ...f }).replace('/api/organizador/inscricoes', '/api/organizador/inscricoes/exportar')
}

export const URL_LOTE = '/api/organizador/inscricoes/lote'
export const URL_EQUIPE = '/api/organizador/equipe'

export function urlDetalhe(id: string): string {
  return `/api/organizador/inscricoes/${encodeURIComponent(id)}`
}
export function urlDecidir(id: string): string {
  return `${urlDetalhe(id)}/decidir`
}
export function urlDocumento(inscricaoId: string, atletaId: string): string {
  return `${urlDetalhe(inscricaoId)}/atletas/${encodeURIComponent(atletaId)}/documento-url`
}

/** Só aceita URL https para abrir o documento assinado. */
export function urlDocumentoSegura(url: unknown): string | null {
  if (typeof url !== 'string') return null
  try {
    const u = new URL(url)
    return u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

export function campeonatosDaLista(lista: Array<{ ligaId: string; campeonato: string }>): Array<{ ligaId: string; nome: string }> {
  const mapa = new Map<string, string>()
  for (const i of lista) if (i.ligaId && !mapa.has(i.ligaId)) mapa.set(i.ligaId, i.campeonato || `Campeonato ${i.ligaId}`)
  return Array.from(mapa, ([ligaId, nome]) => ({ ligaId, nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

export function categoriasDaLista(lista: Array<{ categoria: string }>): string[] {
  return Array.from(new Set(lista.map((i) => i.categoria).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

/** Filtro de categoria por nome, no cliente (o contrato só tem categoriaId; a lista traz o nome). */
export function filtrarPorCategoria<T extends { categoria: string }>(lista: T[], categoria: string): T[] {
  return categoria ? lista.filter((i) => i.categoria === categoria) : lista
}

// ---------- Decisões e permissões ----------

export const ROTULO_ACAO: Record<AcaoDecisao, string> = {
  APROVAR: 'Aprovar',
  ANALISAR: 'Analisar',
  PEDIR_CORRECAO: 'Pedir correção',
  LISTA_ESPERA: 'Lista de espera',
  RECUSAR: 'Recusar',
}

/** Quais ações fazem sentido em cada status. O servidor valida de verdade (409 em transição inválida). */
const TRANSICOES: Record<StatusInscricao, AcaoDecisao[]> = {
  RASCUNHO: [],
  EM_ANALISE: ['APROVAR', 'PEDIR_CORRECAO', 'LISTA_ESPERA', 'RECUSAR'],
  AJUSTE_PEDIDO: ['ANALISAR', 'APROVAR', 'LISTA_ESPERA', 'RECUSAR'],
  LISTA_ESPERA: ['ANALISAR', 'APROVAR', 'RECUSAR'],
  CONFIRMADA_COM_PENDENCIAS: ['ANALISAR', 'APROVAR', 'PEDIR_CORRECAO', 'RECUSAR'],
  CONFIRMADA: ['ANALISAR', 'PEDIR_CORRECAO', 'RECUSAR'],
  REMOVIDA: ['ANALISAR'],
}

export function podeDecidirPapel(papel: PapelOrganizador | null): boolean {
  // Papel desconhecido: libera a tela e deixa o servidor responder 403.
  return papel === null || papel === 'ADMINISTRADOR'
}

export function acoesPermitidas(status: string, papel: PapelOrganizador | null): AcaoDecisao[] {
  if (!podeDecidirPapel(papel)) return []
  return TRANSICOES[normalizarStatus(status)] ?? []
}

export function acoesDoStatus(status: string): AcaoDecisao[] {
  return TRANSICOES[normalizarStatus(status)] ?? []
}

export function motivoBloqueio(papel: PapelOrganizador | null): string {
  if (podeDecidirPapel(papel)) return ''
  return `O papel ${rotuloPapel(papel)} não decide inscrições. Peça a um administrador.`
}

export function podeAprovarEmLote(status: string, papel: PapelOrganizador | null): boolean {
  return acoesPermitidas(status, papel).includes('APROVAR')
}

export function exigeMensagem(acao: AcaoDecisao): boolean {
  return acao === 'PEDIR_CORRECAO' || acao === 'RECUSAR'
}

export function limparMensagem(valor: string): string {
  return valor.trim().slice(0, MENSAGEM_MAX)
}

export function validarDecisao(acao: AcaoDecisao, mensagem: string): string | null {
  if (exigeMensagem(acao) && !limparMensagem(mensagem)) {
    return acao === 'RECUSAR' ? 'Informe o motivo da recusa.' : 'Escreva o que a equipe precisa corrigir.'
  }
  return null
}

export function corpoDecisao(acao: AcaoDecisao, mensagem: string): { acao: AcaoDecisao; mensagem?: string } {
  const m = limparMensagem(mensagem)
  return m ? { acao, mensagem: m } : { acao }
}

export function corpoLote(ids: string[]): { ids: string[]; acao: 'APROVAR' } {
  return { ids: Array.from(new Set(ids)), acao: 'APROVAR' }
}

export function tituloConfirmacao(acao: AcaoDecisao): string {
  switch (acao) {
    case 'APROVAR': return 'Aprovar inscrição?'
    case 'ANALISAR': return 'Voltar para análise?'
    case 'PEDIR_CORRECAO': return 'Pedir correção?'
    case 'LISTA_ESPERA': return 'Mandar para a lista de espera?'
    case 'RECUSAR': return 'Recusar inscrição?'
  }
}

export function textoConfirmacao(acao: AcaoDecisao, equipe: string, destino: string): string {
  switch (acao) {
    case 'APROVAR': return `${equipe} será confirmada em ${destino}.`
    case 'ANALISAR': return `A inscrição de ${equipe} em ${destino} volta para análise.`
    case 'PEDIR_CORRECAO': return `${equipe} recebe o seu comentário e poderá ajustar a inscrição em ${destino}.`
    case 'LISTA_ESPERA': return `${equipe} fica na lista de espera de ${destino} até abrir vaga.`
    case 'RECUSAR': return `${equipe} não participará de ${destino}. O motivo será enviado à equipe.`
  }
}

export function mensagemDecisao(acao: AcaoDecisao, equipe: string): string {
  switch (acao) {
    case 'APROVAR': return `${equipe} foi aprovada.`
    case 'ANALISAR': return `${equipe} voltou para análise.`
    case 'PEDIR_CORRECAO': return `Pedido de correção enviado para ${equipe}.`
    case 'LISTA_ESPERA': return `${equipe} foi para a lista de espera.`
    case 'RECUSAR': return `A inscrição de ${equipe} foi recusada.`
  }
}

export function mensagemLote(aprovadas: number, total: number): string {
  if (aprovadas >= total) return aprovadas === 1 ? '1 inscrição aprovada.' : `${aprovadas} inscrições aprovadas.`
  return `${aprovadas} de ${total} aprovadas. As demais mudaram de situação; a lista foi atualizada.`
}

// ---------- Papéis da equipe ----------

export const PAPEIS: Array<{ value: PapelOrganizador; rotulo: string; descricao: string }> = [
  { value: 'ADMINISTRADOR', rotulo: 'Administrador', descricao: 'Faz tudo: decide inscrições, configura campeonatos e gerencia a equipe.' },
  { value: 'FINANCEIRO', rotulo: 'Financeiro', descricao: 'Acompanha pagamentos e taxas. Vê as inscrições, mas não decide.' },
  { value: 'ARBITRAGEM', rotulo: 'Arbitragem', descricao: 'Cuida de jogos, árbitros e súmulas. Vê as inscrições, mas não decide.' },
]

export function rotuloPapel(papel: string | null): string {
  return PAPEIS.find((p) => p.value === papel)?.rotulo ?? 'sem papel'
}

export function validarEmail(valor: string): string | null {
  const e = valor.trim()
  if (!e) return 'Informe o e-mail.'
  if (e.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return 'E-mail inválido.'
  return null
}

export function corpoConvite(email: string, papel: PapelOrganizador): { email: string; papel: PapelOrganizador } {
  return { email: email.trim().toLowerCase(), papel }
}

// ---------- Textos e datas ----------

export const ROTULO_STATUS: Record<StatusInscricao, string> = {
  RASCUNHO: 'Rascunho',
  EM_ANALISE: 'Em análise',
  CONFIRMADA: 'Aprovada',
  CONFIRMADA_COM_PENDENCIAS: 'Aprovada com pendências',
  AJUSTE_PEDIDO: 'Correção pedida',
  LISTA_ESPERA: 'Lista de espera',
  REMOVIDA: 'Recusada',
}

export function rotuloStatus(status: string): string {
  return ROTULO_STATUS[normalizarStatus(status)]
}

export function textoAtletas(n: number): string {
  return n === 1 ? '1 atleta' : `${n} atletas`
}

export function textoVazio(aba: AbaInscricao, filtrando: boolean): string {
  if (filtrando) return 'Nenhuma inscrição com esses filtros.'
  switch (aba) {
    case 'EM_ANALISE': return 'Nenhuma inscrição esperando análise. Quando uma equipe enviar, ela aparece aqui.'
    case 'PENDENCIA': return 'Nenhuma inscrição com pendência.'
    case 'LISTA_ESPERA': return 'Ninguém na lista de espera.'
    case 'APROVADAS': return 'Nenhuma inscrição aprovada ainda.'
    case 'RECUSADAS': return 'Nenhuma inscrição recusada.'
  }
}

/** "Parada há 3 dias": tempo desde a última atualização. */
export function tempoParado(iso: string | null, agora: number = Date.now()): string {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const min = Math.max(0, Math.floor((agora - t) / 60_000))
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.floor(h / 24)
  return d === 1 ? 'há 1 dia' : `há ${d} dias`
}

/** Parada há mais de 3 dias em análise merece destaque. */
export function estaParada(status: string, iso: string | null, agora: number = Date.now()): boolean {
  if (normalizarStatus(status) !== 'EM_ANALISE' || !iso) return false
  const t = new Date(iso).getTime()
  return !Number.isNaN(t) && agora - t > 3 * 24 * 3_600_000
}

export function dataCurta(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// ---------- Tratamento de respostas ----------

export type TipoFalha = 'desligado' | 'nao-habilitado' | 'conflito' | 'sessao' | 'validacao' | 'generica'

export interface RespostaTratada {
  ok: boolean
  tipo?: TipoFalha
  mensagem: string
  /** Em 409 a tela recarrega a lista (a situação mudou). */
  recarregar?: boolean
}

/** 404 = recurso desligado; 503 = não habilitado; 409 = transição inválida. */
export function tratarResposta(status: number, corpo?: { error?: string } | null): RespostaTratada {
  if (status >= 200 && status < 300) return { ok: true, mensagem: '' }
  const erro = typeof corpo?.error === 'string' && corpo.error ? corpo.error : ''
  if (status === 404) return { ok: false, tipo: 'desligado', mensagem: 'Este recurso ainda não está disponível.' }
  if (status === 503) return { ok: false, tipo: 'nao-habilitado', mensagem: 'As inscrições do painel ainda não estão habilitadas neste ambiente.' }
  if (status === 409) return { ok: false, tipo: 'conflito', recarregar: true, mensagem: erro || 'Esta inscrição mudou de situação e a ação não vale mais. A lista foi atualizada.' }
  if (status === 401) return { ok: false, tipo: 'sessao', mensagem: 'Sua sessão expirou. Entre novamente.' }
  if (status === 403) return { ok: false, tipo: 'sessao', mensagem: erro || 'Seu papel na equipe não permite esta ação.' }
  if (status === 400 || status === 422) return { ok: false, tipo: 'validacao', mensagem: erro || 'Confira os dados informados.' }
  return { ok: false, tipo: 'generica', mensagem: erro || 'Não foi possível concluir. Tente de novo.' }
}

export function falhaBloqueante(tipo: TipoFalha | undefined): boolean {
  return tipo === 'desligado' || tipo === 'nao-habilitado'
}
