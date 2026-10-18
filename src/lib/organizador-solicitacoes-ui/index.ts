/** Lógica PURA da fila de solicitações de inscrição do organizador (sem React, sem rede). A regra de verdade é do servidor. */

export type EstadoSolicitacao = 'PENDENTE' | 'APROVADA' | 'RECUSADA' | 'CANCELADA'
export type ModoInscricao = 'AUTOMATICA' | 'APROVACAO'
export type FiltroEstado = 'PENDENTE' | 'APROVADA' | 'RECUSADA'

export const INTERVALO_SOLICITACOES_MS = 15_000
export const MOTIVO_MAX = 300

export interface Solicitacao {
  id: string
  equipe: { id: string; nome: string; cidade: string | null }
  ligaId: string
  campeonato: string
  categoria: string
  mensagem: string | null
  estado: EstadoSolicitacao
  solicitadoEm: string | null
  atletas: number
}

export interface NotificacaoOrganizador {
  id: string
  tipo: string
  titulo: string
  mensagem: string
  dados: Record<string, unknown> | null
  lida: boolean
  criadaEm: string | null
}

/** Só o valor exato '1' liga a área nova. */
export function solicitacoesAtivo(valor: string | undefined | null): boolean {
  return valor === '1'
}

export const FILTROS_ESTADO: Array<{ value: FiltroEstado; rotulo: string }> = [
  { value: 'PENDENTE', rotulo: 'Pendentes' },
  { value: 'APROVADA', rotulo: 'Aprovadas' },
  { value: 'RECUSADA', rotulo: 'Recusadas' },
]

const ROTULOS_ESTADO: Record<EstadoSolicitacao, string> = {
  PENDENTE: 'Pendente',
  APROVADA: 'Aprovada',
  RECUSADA: 'Recusada',
  CANCELADA: 'Cancelada',
}

export function rotuloEstado(estado: string): string {
  return ROTULOS_ESTADO[estado as EstadoSolicitacao] ?? 'Desconhecido'
}

export const OPCOES_MODO: Array<{ value: ModoInscricao; titulo: string; descricao: string }> = [
  { value: 'AUTOMATICA', titulo: 'Automática', descricao: 'A equipe que pede para entrar é inscrita na hora, sem esperar você. O limite de vagas continua valendo.' },
  { value: 'APROVACAO', titulo: 'Com aprovação do organizador', descricao: 'A equipe envia um pedido e só entra no campeonato depois que você aprovar. Você recebe um aviso a cada pedido novo.' },
]

export function normalizarModo(valor: unknown): ModoInscricao {
  return String(valor ?? '').trim().toUpperCase() === 'APROVACAO' ? 'APROVACAO' : 'AUTOMATICA'
}

export function rotuloModo(modo: ModoInscricao): string {
  return modo === 'APROVACAO' ? 'Com aprovação do organizador' : 'Automática'
}

/** Aprovar e recusar só fazem sentido enquanto o pedido está pendente. */
export function podeDecidir(estado: string): boolean {
  return estado === 'PENDENTE'
}

export function contarPendentes(lista: Array<{ estado: string }>): number {
  return lista.filter((item) => item.estado === 'PENDENTE').length
}

/** Texto curto do contador do menu: vazio quando zero, "99+" no teto. */
export function rotuloContador(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return ''
  return n > 99 ? '99+' : String(Math.floor(n))
}

export function textoAtletas(n: number): string {
  return n === 1 ? '1 atleta' : `${n} atletas`
}

export function limparMotivo(valor: string): string | undefined {
  const m = valor.trim().slice(0, MOTIVO_MAX)
  return m ? m : undefined
}

function texto(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v)
}

export function normalizarSolicitacoes(corpo: unknown): Solicitacao[] {
  const lista = (corpo as { data?: unknown } | null)?.data
  if (!Array.isArray(lista)) return []
  const out: Solicitacao[] = []
  for (const bruto of lista) {
    const s = bruto as Record<string, unknown> | null
    if (!s || s.id == null) continue
    const eq = (s.equipe ?? {}) as Record<string, unknown>
    const estado = texto(s.estado)
    out.push({
      id: texto(s.id),
      equipe: { id: texto(eq.id), nome: texto(eq.nome) || 'Equipe', cidade: eq.cidade ? texto(eq.cidade) : null },
      ligaId: texto(s.ligaId),
      campeonato: texto(s.campeonato),
      categoria: texto(s.categoria),
      mensagem: s.mensagem ? texto(s.mensagem) : null,
      estado: (['PENDENTE', 'APROVADA', 'RECUSADA', 'CANCELADA'].includes(estado) ? estado : 'PENDENTE') as EstadoSolicitacao,
      solicitadoEm: s.solicitadoEm ? texto(s.solicitadoEm) : null,
      atletas: Number.isFinite(Number(s.atletas)) ? Number(s.atletas) : 0,
    })
  }
  return out
}

export function normalizarNotificacoes(corpo: unknown): { lista: NotificacaoOrganizador[]; naoLidas: number } {
  const c = corpo as { data?: unknown; naoLidas?: unknown } | null
  const bruta = Array.isArray(c?.data) ? (c.data as unknown[]) : []
  const lista: NotificacaoOrganizador[] = []
  for (const b of bruta) {
    const n = b as Record<string, unknown> | null
    if (!n || n.id == null) continue
    lista.push({
      id: texto(n.id),
      tipo: texto(n.tipo),
      titulo: texto(n.titulo),
      mensagem: texto(n.mensagem),
      dados: n.dados && typeof n.dados === 'object' ? (n.dados as Record<string, unknown>) : null,
      lida: n.lida === true,
      criadaEm: n.criadaEm ? texto(n.criadaEm) : null,
    })
  }
  const informado = typeof c?.naoLidas === 'number' ? c.naoLidas : NaN
  const naoLidas = Number.isFinite(informado) && informado >= 0 ? informado : lista.filter((n) => !n.lida).length
  return { lista, naoLidas }
}

/** Notificação de pedido de inscrição leva à fila; as demais só são marcadas como lidas. */
export function destinoNotificacao(tipo: string): string | null {
  return tipo === 'SOLICITACAO_INSCRICAO' ? '/admin/solicitacoes' : null
}

export function filtrarPorCampeonato<T extends { ligaId: string }>(lista: T[], ligaId: string): T[] {
  return ligaId ? lista.filter((item) => item.ligaId === ligaId) : lista
}

export function campeonatosDaLista(lista: Array<{ ligaId: string; campeonato: string }>): Array<{ ligaId: string; nome: string }> {
  const mapa = new Map<string, string>()
  for (const item of lista) if (item.ligaId && !mapa.has(item.ligaId)) mapa.set(item.ligaId, item.campeonato || `Campeonato ${item.ligaId}`)
  return Array.from(mapa, ([ligaId, nome]) => ({ ligaId, nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

export function urlSolicitacoes(estado: FiltroEstado, ligaId?: string): string {
  const p = new URLSearchParams({ estado })
  if (ligaId) p.set('ligaId', ligaId)
  return `/api/organizador/solicitacoes?${p.toString()}`
}

export type TipoFalha = 'desligado' | 'nao-habilitado' | 'conflito' | 'sessao' | 'generica'

export interface RespostaTratada {
  ok: boolean
  tipo?: TipoFalha
  mensagem: string
  /** Em 409 a tela deve recarregar a fila (outra decisão já foi tomada). */
  recarregar?: boolean
}

/** Traduz o status da API em mensagem e ação de tela: 404 = recurso desligado, 503 = não habilitado, 409 = decisão contrária. */
export function tratarResposta(status: number, corpo?: { error?: string } | null): RespostaTratada {
  if (status >= 200 && status < 300) return { ok: true, mensagem: '' }
  const erro = typeof corpo?.error === 'string' && corpo.error ? corpo.error : ''
  if (status === 404) return { ok: false, tipo: 'desligado', mensagem: 'Este recurso ainda não está disponível.' }
  if (status === 503) return { ok: false, tipo: 'nao-habilitado', mensagem: 'As solicitações de inscrição ainda não estão habilitadas neste ambiente.' }
  if (status === 409) return { ok: false, tipo: 'conflito', recarregar: true, mensagem: erro || 'Este pedido já recebeu outra decisão. A lista foi atualizada.' }
  if (status === 401 || status === 403) return { ok: false, tipo: 'sessao', mensagem: 'Sua sessão não tem permissão para esta ação. Entre novamente.' }
  return { ok: false, tipo: 'generica', mensagem: erro || 'Não foi possível concluir. Tente de novo.' }
}

export function mensagemDecisao(decisao: 'APROVADA' | 'RECUSADA', equipe: string): string {
  return decisao === 'APROVADA' ? `${equipe} foi aprovada e já está inscrita.` : `O pedido de ${equipe} foi recusado.`
}

export function textoVazio(estado: FiltroEstado): string {
  if (estado === 'PENDENTE') return 'Nenhum pedido esperando por você. Quando uma equipe pedir para entrar, ele aparece aqui.'
  if (estado === 'APROVADA') return 'Nenhum pedido aprovado ainda.'
  return 'Nenhum pedido recusado.'
}

export function dataCurta(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`
}
