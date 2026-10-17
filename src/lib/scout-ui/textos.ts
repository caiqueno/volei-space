/** Textos, estados de tela, leitura do elenco, filtros e resumo do scout. Módulo PURO. */
import type { EstatisticasScout } from '../scout/estatisticas'
import {
  ROTULO_FUNDAMENTO,
  ROTULO_RESULTADO,
  type AcaoServidor,
  type EquipeScoutTela,
  type JogadorScout,
} from './tipos'

export type TelaScout = 'desligado' | 'nao-habilitado' | 'token-invalido' | 'rede' | 'erro'

/** 404 = recurso desligado (ou link inexistente); 503 = ainda não habilitado; 400/401/403 = link inválido. */
export function classificarFalhaScout(status: number | null): TelaScout {
  if (status === null) return 'rede'
  if (status === 404) return 'desligado'
  if (status === 503) return 'nao-habilitado'
  if (status === 400 || status === 401 || status === 403 || status === 410) return 'token-invalido'
  return 'erro'
}

export const TEXTO_TELA_SCOUT: Readonly<Record<TelaScout, { titulo: string; texto: string; tentar: boolean }>> = {
  desligado: { titulo: 'Scout indisponível', texto: 'Este recurso não está ativo, ou o link não existe. Confira o link com o organizador.', tentar: false },
  'nao-habilitado': { titulo: 'Scout ainda não habilitado', texto: 'O scout ainda não foi habilitado para este jogo. Tente de novo mais tarde ou fale com o organizador.', tentar: true },
  'token-invalido': { titulo: 'Link inválido', texto: 'Este link não é válido ou não tem permissão. Peça um novo link ao organizador.', tentar: false },
  rede: { titulo: 'Sem conexão', texto: 'Não foi possível falar com o servidor. Verifique sua internet.', tentar: true },
  erro: { titulo: 'Algo deu errado', texto: 'Não foi possível carregar agora. Tente novamente.', tentar: true },
}

/** Tela de erro vira estado final (sem polling) quando o recurso está desligado ou o link é inválido. */
export function falhaDefinitiva(t: TelaScout): boolean {
  return t === 'desligado' || t === 'token-invalido'
}

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' ? (v as Record<string, unknown>) : null)
const numeroOuNull = (v: unknown): number | null => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

function lerEquipe(lado: 'A' | 'B', bruto: unknown, id: unknown): EquipeScoutTela | null {
  const e = obj(bruto)
  const eid = numeroOuNull(id)
  if (!e || eid === null) return null
  const jogadores: JogadorScout[] = []
  for (const j of Array.isArray(e.jogadores) ? e.jogadores : []) {
    const o = obj(j)
    const jid = o ? numeroOuNull(o.id) : null
    if (!o || jid === null) continue
    jogadores.push({ id: jid, numero: numeroOuNull(o.numero), nome: typeof o.nome === 'string' ? o.nome : `Jogador ${jid}` })
  }
  jogadores.sort((a, b) => (a.numero ?? 999) - (b.numero ?? 999) || a.id - b.id)
  return { id: eid, lado, nome: typeof e.nome === 'string' && e.nome ? e.nome : `Equipe ${lado}`, jogadores }
}

/** Equipes e elenco a partir de GET /api/sumula/[token] (envelope {data} ou direto). Vazio se não reconhecer. */
export function equipesDaPartida(json: unknown): EquipeScoutTela[] {
  const raiz = obj(json)
  const p = obj(raiz?.data) ?? raiz
  if (!p) return []
  const a = lerEquipe('A', p.equipeA, p.equipeAId)
  const b = lerEquipe('B', p.equipeB, p.equipeBId)
  return [a, b].filter((x): x is EquipeScoutTela => x !== null)
}

/** "7", ou "-" sem camisa. */
export function rotuloCamisa(j: Pick<JogadorScout, 'numero'>): string {
  return j.numero === null ? '-' : String(j.numero)
}

export function acoesDaResposta(json: unknown): AcaoServidor[] {
  const d = obj(json)?.data
  const lista = Array.isArray(d) ? d : Array.isArray(obj(d)?.acoes) ? (obj(d)!.acoes as unknown[]) : []
  return lista.filter((a): a is AcaoServidor => !!obj(a) && 'fundamento' in (a as object) && 'resultado' in (a as object) && obj(a)!.id !== undefined)
}

export function acaoDaResposta(json: unknown): AcaoServidor | null {
  const a = obj(obj(json)?.data)?.acao
  const o = obj(a)
  return o && o.id !== undefined && typeof o.fundamento === 'string' ? (a as AcaoServidor) : null
}

/** Frase curta da ação para a lista e para leitores de tela: "#7 Maria: Ataque, Ponto (zona 4)". */
export function descreverAcao(a: AcaoServidor, equipes: readonly EquipeScoutTela[]): string {
  const equipe = equipes.find((e) => e.id === a.equipeId)
  const jog = equipe?.jogadores.find((j) => j.id === a.jogadorId)
  const quem = jog ? `Camisa ${rotuloCamisa(jog)}` : equipe ? equipe.nome : 'Equipe'
  const zona = a.zonaDestino ? `, zona ${a.zonaDestino}` : a.zonaOrigem ? `, da zona ${a.zonaOrigem}` : ''
  return `${quem}: ${ROTULO_FUNDAMENTO[a.fundamento] ?? a.fundamento}, ${ROTULO_RESULTADO[a.resultado] ?? a.resultado}${zona}`
}

export interface Filtro {
  set: number | 'todos'
  equipeId: number | 'todas'
}

/** Últimas `limite` ações (mais recente primeiro) já filtradas por set e equipe. */
export function filtrarAcoes(acoes: readonly AcaoServidor[], f: Filtro, limite = 15): AcaoServidor[] {
  return acoes
    .filter((a) => (f.set === 'todos' || (a.setNumero ?? a.set) === f.set) && (f.equipeId === 'todas' || a.equipeId === f.equipeId))
    .slice(-limite)
    .reverse()
}

export function pct(v: number | null): string {
  return v === null ? 'sem dado' : `${Math.round(v * 100)}%`
}

export interface LinhaResumo {
  rotulo: string
  valor: string
}

/** Linhas do resumo de uma equipe; "sem dado" quando não há denominador (nunca 0). */
export function linhasResumo(e: EstatisticasScout | null | undefined): LinhaResumo[] {
  if (!e) return [
    { rotulo: 'Eficiência de ataque', valor: 'sem dado' },
    { rotulo: 'Recepção positiva', valor: 'sem dado' },
    { rotulo: 'Aces', valor: '0' },
  ]
  return [
    { rotulo: 'Eficiência de ataque', valor: e.ataque.tentativas > 0 ? `${pct(e.ataque.eficiencia)} (${e.ataque.tentativas} ataques)` : 'sem dado' },
    { rotulo: 'Recepção positiva', valor: e.recepcao.total > 0 ? `${pct(e.recepcao.percentualPositiva)} (${e.recepcao.total} recepções)` : 'sem dado' },
    { rotulo: 'Aces', valor: String(e.aces) },
  ]
}

/** Estatística da equipe no JSON do /resumo ({data:{estatisticas:{porEquipe}}}); null se ausente. */
export function estatisticaDaEquipe(json: unknown, lado: 'A' | 'B'): EstatisticasScout | null {
  const lista = obj(obj(obj(json)?.data)?.estatisticas)?.porEquipe
  if (!Array.isArray(lista)) return null
  const e = lista.find((x) => obj(x)?.equipe === lado)
  return e ? (e as EstatisticasScout) : null
}
