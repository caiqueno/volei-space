/**
 * Leitura de dados do app de banco: partida, equipes, elenco (só id, nome e camisa), papeletas e pedidos.
 * Nunca seleciona documento, telefone, nascimento nem qualquer outro dado pessoal.
 */
import { supabaseAdmin } from '@/lib/supabase-admin'
import { regrasEfetivasDaPartida } from '@/lib/regras-da-partida'
import { configDaPartida, perfilDaPartida } from '@/lib/sumula-eventos/config-partida'
import { carregarLinhas, linhasParaLog, sumulaEventosAtivo, type ClienteEventos } from '@/lib/sumula-eventos'
import { derivarPlacar, type PerfilRegras } from '@/lib/regras-volei'
import { tabelaBancoAusente, type ErroBanco } from './base'
import type { JogadorBanco } from './papeleta-validacao'
import type { TrocaDoLog } from './pedidos-validacao'

const db = supabaseAdmin as any

export class TabelaBancoAusenteErro extends Error {
  constructor() {
    super('tabela do banco ausente')
  }
}

/** Lança TabelaBancoAusenteErro (vira 503) ou Error (vira 500) quando a consulta falhou. */
export function conferir<T>(r: { data: T; error: ErroBanco }): T {
  if (r.error) {
    if (tabelaBancoAusente(r.error)) throw new TabelaBancoAusenteErro()
    throw new Error(r.error.message ?? 'erro de banco')
  }
  return r.data
}

export const STATUS_PARTIDA_ENCERRADA = ['ENCERRADA', 'WO', 'FINALIZADA', 'APROVADA', 'CANCELADA']
export const MAX_SET = 5

export type PartidaBanco = {
  id: number
  ligaId: number
  equipeAId: number | null
  equipeBId: number | null
  status: string
  fase?: string | null
  categoriaCampeonatoId?: string | null
  setsPorA?: number | null
  setsPorB?: number | null
  pontosPorA?: number | null
  pontosPorB?: number | null
}

export async function lerPartidaBanco(partidaId: number): Promise<PartidaBanco | null> {
  const r = await db
    .from('Partida')
    .select('id,ligaId,equipeAId,equipeBId,status,fase,categoriaCampeonatoId,setsPorA,setsPorB,pontosPorA,pontosPorB')
    .eq('id', partidaId)
    .maybeSingle()
  if (r.error) throw new Error(r.error.message ?? 'erro ao ler a partida')
  return (r.data as PartidaBanco | null) ?? null
}

export async function lerNomeEquipe(equipeId: number | null): Promise<{ id: number; nome: string } | null> {
  if (equipeId == null) return null
  const r = await db.from('Equipe').select('id,nome').eq('id', equipeId).maybeSingle()
  if (r.error) throw new Error(r.error.message ?? 'erro ao ler a equipe')
  return r.data ? { id: Number(r.data.id), nome: String(r.data.nome ?? '') } : null
}

export async function lerSets(partidaId: number): Promise<Array<{ numero: number; pontosA: number; pontosB: number }>> {
  const r = await db.from('SetPartida').select('numero,pontosA,pontosB').eq('partidaId', partidaId)
  if (r.error) throw new Error(r.error.message ?? 'erro ao ler os sets')
  return ((r.data ?? []) as any[]).map((s) => ({ numero: Number(s.numero), pontosA: Number(s.pontosA), pontosB: Number(s.pontosB) }))
}

/** Elenco da equipe na partida: nome e camisa (a da partida, quando houver). Quem foi marcado ausente fica de fora. */
export async function lerElenco(partidaId: number, equipeId: number): Promise<JogadorBanco[]> {
  const jogadores = await db.from('Jogador').select('id,nome,numero,banido').eq('equipeId', equipeId)
  if (jogadores.error) throw new Error(jogadores.error.message ?? 'erro ao ler o elenco')
  const presencas = await db.from('SumulaPresenca').select('jogadorId,presente,numero').eq('partidaId', partidaId).eq('equipeId', equipeId)
  const porJogador = new Map<number, { presente: boolean | null; numero: number | null }>()
  for (const p of ((presencas.error ? [] : presencas.data) ?? []) as any[]) {
    porJogador.set(Number(p.jogadorId), { presente: p.presente ?? null, numero: p.numero ?? null })
  }
  const saida: JogadorBanco[] = []
  for (const j of (jogadores.data ?? []) as any[]) {
    if (j.banido) continue
    const presenca = porJogador.get(Number(j.id))
    if (presenca?.presente === false) continue
    const numero = presenca?.numero ?? j.numero
    if (numero == null || !Number.isInteger(Number(numero)) || Number(numero) < 0) continue
    saida.push({ jogadorId: Number(j.id), nome: String(j.nome ?? ''), numero: Number(numero) })
  }
  return saida.sort((a, b) => a.numero - b.numero)
}

export async function limitesDaPartida(partida: PartidaBanco): Promise<{ tempos: number; substituicoes: number }> {
  try {
    const regras = await regrasEfetivasDaPartida(partida)
    const perfil = perfilDaPartida(regras)
    return { tempos: perfil.temposPorSet, substituicoes: perfil.limiteSubstituicoesPorSet }
  } catch {
    const perfil = perfilDaPartida({})
    return { tempos: perfil.temposPorSet, substituicoes: perfil.limiteSubstituicoesPorSet }
  }
}

/** O set já começou? Há linha dele (ou de um posterior) ou a partida acabou. */
export function setJaIniciado(partida: Pick<PartidaBanco, 'status'>, sets: ReadonlyArray<{ numero: number }>, setNumero: number): boolean {
  if (STATUS_PARTIDA_ENCERRADA.includes(String(partida.status ?? '').toUpperCase())) return true
  return sets.some((s) => s.numero >= setNumero)
}

export type OpcoesSetAtual = {
  /** A partida acabou? Encerrada mantém o critério antigo (último set + 1). */
  partidaEncerrada?: boolean
  /** Alvo dos sets regulares e do decisivo, e melhor de N (do motor, pelas regras da categoria). */
  alvoSet?: number
  alvoDecisivo?: number
  melhorDe?: number
}

type SetComPlacar = { numero: number; pontosA?: number; pontosB?: number }

function setEncerrado(s: SetComPlacar, o: OpcoesSetAtual): boolean {
  const a = Number(s.pontosA ?? 0)
  const b = Number(s.pontosB ?? 0)
  const decisivo = o.melhorDe != null && s.numero >= o.melhorDe
  const alvo = (decisivo ? o.alvoDecisivo : o.alvoSet) ?? (decisivo ? 15 : 25)
  return Math.max(a, b) >= alvo && Math.abs(a - b) >= 2
}

/**
 * Set em disputa (ou o próximo a começar).
 * Sem opções, ou com a partida encerrada: o seguinte ao último com placar gravado (critério antigo).
 * Com `partidaEncerrada: false`: o PUT de andamento da súmula já grava a linha do set corrente (até 0x0),
 * então, se o último set gravado ainda NÃO terminou pelo placar (alvo e vantagem de 2), ele é o set em disputa;
 * se terminou, é o seguinte. Papeleta continua usando o "próximo set sem linha" (`setJaIniciado`).
 */
export function setAtual(sets: ReadonlyArray<SetComPlacar>, opcoes: OpcoesSetAtual = {}): number {
  const maior = sets.reduce((m, s) => Math.max(m, s.numero), 0)
  if (opcoes.partidaEncerrada === false && maior > 0) {
    const ultimo = sets.find((s) => s.numero === maior)!
    if (!setEncerrado(ultimo, opcoes)) return maior
  }
  return Math.min(MAX_SET, maior + 1)
}

/** Opções de `setAtual` para a partida (regras da categoria). Falha de regras cai nos alvos padrão. */
export async function opcoesDoSetAtual(partida: PartidaBanco): Promise<OpcoesSetAtual> {
  const encerrada = STATUS_PARTIDA_ENCERRADA.includes(String(partida.status ?? '').toUpperCase())
  try {
    const config = configDaPartida(await regrasEfetivasDaPartida(partida))
    return { partidaEncerrada: encerrada, alvoSet: config.alvoSet, alvoDecisivo: config.alvoSetDecisivo, melhorDe: config.melhorDe }
  } catch {
    return { partidaEncerrada: encerrada }
  }
}

/** Set em disputa da partida, lendo as regras da categoria. */
export async function setAtualDaPartida(partida: PartidaBanco, sets: ReadonlyArray<SetComPlacar>): Promise<number> {
  return setAtual(sets, await opcoesDoSetAtual(partida))
}

/** Perfil de regras da partida (categoria/competição); sem regras legíveis, o padrão. */
export async function perfilDaPartidaBanco(partida: PartidaBanco): Promise<PerfilRegras> {
  try {
    return perfilDaPartida(await regrasEfetivasDaPartida(partida))
  } catch {
    return perfilDaPartida({})
  }
}

export type UsoDoLog = { tempos: number; substituicoes: number; trocas: TrocaDoLog[] }

/**
 * Uso do set pelo log efetivo da súmula (derivarPlacar().contadores), quando o log existe e está habilitado
 * (SUMULA_EVENTOS_ATIVO). Sem log (flag desligada, tabela ausente, log vazio ou falha) devolve null e o
 * chamador conta só os pedidos aceitos.
 */
export async function usoDoLogDaSumula(partida: PartidaBanco, equipeId: number, setNumero: number): Promise<UsoDoLog | null> {
  if (!sumulaEventosAtivo()) return null
  const lado = equipeId === partida.equipeAId ? 'A' : equipeId === partida.equipeBId ? 'B' : null
  if (!lado) return null
  try {
    const leitura = await carregarLinhas(db as ClienteEventos, partida.id)
    if (!leitura.ok || leitura.linhas.length === 0) return null
    const config = configDaPartida(await regrasEfetivasDaPartida(partida))
    const { log } = linhasParaLog(leitura.linhas)
    const placar = derivarPlacar(log, config)
    const set = [...placar.sets, ...placar.setsAnulados].find((s) => s.numero === setNumero) ?? (placar.setAtual?.numero === setNumero ? placar.setAtual : null)
    if (!set) return { tempos: 0, substituicoes: 0, trocas: [] }
    const c = set.contadores[lado]
    const trocas: TrocaDoLog[] = []
    for (const passo of set.jornal) {
      if (passo.tipo === 'TROCA' && passo.equipe === lado) trocas.push({ sai: passo.sai, entra: passo.entra })
    }
    return { tempos: c.tempos, substituicoes: c.substituicoesRegulares + c.substituicoesExcepcionais, trocas }
  } catch {
    return null
  }
}

export function papeletaPublica(p: any) {
  return {
    setNumero: Number(p.setNumero),
    estado: p.estado,
    formacao: Array.isArray(p.formacao) ? p.formacao : [],
    liberoId: p.liberoId ?? null,
    capitaoId: p.capitaoId ?? null,
  }
}

export function pedidoPublico(p: any) {
  return { id: p.id, tipo: p.tipo, estado: p.estado, payload: p.payload ?? {}, criadoEm: p.criadoEm }
}
