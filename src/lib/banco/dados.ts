/**
 * Leitura de dados do app de banco: partida, equipes, elenco (só id, nome e camisa), papeletas e pedidos.
 * Nunca seleciona documento, telefone, nascimento nem qualquer outro dado pessoal.
 */
import { supabaseAdmin } from '@/lib/supabase-admin'
import { regrasEfetivasDaPartida } from '@/lib/regras-da-partida'
import { perfilDaPartida } from '@/lib/sumula-eventos/config-partida'
import { tabelaBancoAusente, type ErroBanco } from './base'
import type { JogadorBanco } from './papeleta-validacao'

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

/** Set em disputa (ou o próximo a começar): o seguinte ao último com placar gravado. */
export function setAtual(sets: ReadonlyArray<{ numero: number }>): number {
  const maior = sets.reduce((m, s) => Math.max(m, s.numero), 0)
  return Math.min(MAX_SET, maior + 1)
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
