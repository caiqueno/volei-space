// Entrada comum das rotas do painel de inscrições do organizador (R18).
// Flag própria: PAINEL_INSCRICOES_ATIVO=1. Desligada, as rotas NOVAS respondem 404 como se não existissem.
// Quem pode: o organizador dono do campeonato ou membro da organização (MembroOrganizador).
//   - leitura: qualquer papel (ADMINISTRADOR, FINANCEIRO, ARBITRAGEM);
//   - escrita: dono ou ADMINISTRADOR (FINANCEIRO e ARBITRAGEM recebem 403).
// Quem não tem nenhuma relação com o campeonato recebe 404 (IDOR): o campeonato "não existe" para essa pessoa.
// Tabela/coluna das migrations pendentes ausente = 503 "Recurso ainda não habilitado neste ambiente.".
import { NextRequest } from 'next/server'
import { colunaAusente } from '@/lib/coluna-ausente'
import { requireOrganizador } from '@/lib/organizador-isolamento'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ErroMeuTime, falha, rotaMeuTime, tabelaAusente, type ContextoRota } from '@/lib/meu-time/acesso'
import { limitarUsuario } from '@/lib/inscricoes-solicitacao/acesso'

const db = supabaseAdmin as any

export const MENSAGEM_PAINEL_NAO_HABILITADO = 'Recurso ainda não habilitado neste ambiente.'

export function painelAtivo(env: Record<string, string | undefined> = process.env) {
  return env.PAINEL_INSCRICOES_ATIVO === '1'
}

type ErroBanco = { code?: string | null; message?: string | null; details?: string | null } | null | undefined

/** Tabela nova, coluna nova ou valor de status ainda não aceito (CHECK da migration pendente). */
export function recursoPainelAusente(erro: ErroBanco) {
  if (!erro) return false
  if (tabelaAusente(erro)) return true
  if (erro.code === '23514') return true
  return colunaAusente(erro, ['42703', 'PGRST204', 'posicaoEspera', 'ComentarioInscricao', 'Inscricao_status_check'])
}

export function indisponivelPainel() {
  return new ErroMeuTime(MENSAGEM_PAINEL_NAO_HABILITADO, 503, 'RECURSO_NAO_HABILITADO')
}

/** Devolve os dados ou interrompe a rota: 503 se o recurso não existe, 500 genérico nos demais erros. */
export function lerPainel<T>(resultado: { data: T | null; error: ErroBanco }, onde: string): T | null {
  if (!resultado.error) return resultado.data
  if (recursoPainelAusente(resultado.error)) throw indisponivelPainel()
  console.error(`[painel-inscricoes] ${onde}`, resultado.error.code ?? '')
  throw new ErroMeuTime('Não foi possível concluir a operação. Tente novamente.', 500)
}

// --- Papéis ------------------------------------------------------------------

export const PAPEIS_MEMBRO = ['ADMINISTRADOR', 'FINANCEIRO', 'ARBITRAGEM'] as const
export type PapelMembro = (typeof PAPEIS_MEMBRO)[number]
export type PapelNoOrganizador = 'DONO' | PapelMembro

/**
 * Papel de `usuarioId` na organização cujo dono é `donoLegadoId` (= Liga.organizadorId = Organizador.legadoId).
 * Dono é quem tem o mesmo id; os demais vêm de MembroOrganizador. Sem relação = null. Tabelas de organização
 * ausentes (migration pendente) significam "só existe dono".
 */
export async function papelNoOrganizador(usuarioId: string, donoLegadoId: string | null | undefined): Promise<PapelNoOrganizador | null> {
  if (!donoLegadoId) return null
  if (String(usuarioId) === String(donoLegadoId)) return 'DONO'
  const org = await db.from('Organizador').select('id').eq('legadoId', String(donoLegadoId)).maybeSingle()
  if (org.error) {
    if (recursoPainelAusente(org.error)) return null
    throw new ErroMeuTime('Não foi possível concluir a operação. Tente novamente.', 500)
  }
  if (!org.data) return null
  const membro = await db.from('MembroOrganizador').select('papel').eq('organizadorId', org.data.id).eq('usuarioId', String(usuarioId)).maybeSingle()
  if (membro.error) {
    if (recursoPainelAusente(membro.error)) return null
    throw new ErroMeuTime('Não foi possível concluir a operação. Tente novamente.', 500)
  }
  const papel = String(membro.data?.papel ?? '')
  return (PAPEIS_MEMBRO as readonly string[]).includes(papel) ? (papel as PapelMembro) : null
}

export function papelPodeEscrever(papel: PapelNoOrganizador | null) {
  return papel === 'DONO' || papel === 'ADMINISTRADOR'
}

export type LigaDoPainel = {
  id: number
  nome: string
  status: string | null
  organizadorId: string
  papel: PapelNoOrganizador
}

export function campeonatoNaoEncontrado() {
  return new ErroMeuTime('Campeonato não encontrado.', 404, 'CAMPEONATO_NAO_ENCONTRADO')
}

/** Campeonato visível a quem chama: dono ou membro. Outro organizador = 404. */
export async function exigirLigaDoPainel(usuarioId: string, ligaId: number, escrita = false): Promise<LigaDoPainel> {
  if (!Number.isInteger(ligaId) || ligaId <= 0) throw campeonatoNaoEncontrado()
  const r = await db.from('Liga').select('id,nome,status,organizadorId').eq('id', ligaId).maybeSingle()
  if (r.error) {
    console.error('[painel-inscricoes] campeonato', r.error.code ?? '')
    throw new ErroMeuTime('Não foi possível concluir a operação. Tente novamente.', 500)
  }
  const liga = r.data as { id: number; nome: string; status: string | null; organizadorId: string | null } | null
  if (!liga) throw campeonatoNaoEncontrado()
  const papel = await papelNoOrganizador(usuarioId, liga.organizadorId)
  if (!papel) throw campeonatoNaoEncontrado()
  if (escrita && !papelPodeEscrever(papel)) {
    throw new ErroMeuTime('Seu papel na organização só permite consultar.', 403, 'SEM_PERMISSAO')
  }
  return { id: Number(liga.id), nome: String(liga.nome ?? ''), status: liga.status ?? null, organizadorId: String(liga.organizadorId), papel }
}

/** Ids das ligas que a pessoa enxerga: as próprias e as das organizações em que é membro. */
export async function ligasVisiveis(usuarioId: string): Promise<LigaDoPainel[]> {
  const proprias = await db.from('Liga').select('id,nome,status,organizadorId').eq('organizadorId', String(usuarioId))
  if (proprias.error) {
    console.error('[painel-inscricoes] ligas próprias', proprias.error.code ?? '')
    throw new ErroMeuTime('Não foi possível concluir a operação. Tente novamente.', 500)
  }
  const saida: LigaDoPainel[] = ((proprias.data ?? []) as any[]).map((l) => ({
    id: Number(l.id), nome: String(l.nome ?? ''), status: l.status ?? null, organizadorId: String(l.organizadorId), papel: 'DONO' as const,
  }))
  const vinculos = await db.from('MembroOrganizador').select('organizadorId,papel').eq('usuarioId', String(usuarioId))
  if (vinculos.error) {
    if (recursoPainelAusente(vinculos.error)) return saida
    throw new ErroMeuTime('Não foi possível concluir a operação. Tente novamente.', 500)
  }
  for (const vinculo of (vinculos.data ?? []) as Array<{ organizadorId: string; papel: string }>) {
    if (!(PAPEIS_MEMBRO as readonly string[]).includes(vinculo.papel)) continue
    const org = await db.from('Organizador').select('id,legadoId').eq('id', vinculo.organizadorId).maybeSingle()
    const legadoId = org.data?.legadoId
    if (org.error || !legadoId) continue
    const ligas = await db.from('Liga').select('id,nome,status,organizadorId').eq('organizadorId', String(legadoId))
    for (const l of (ligas.data ?? []) as any[]) {
      if (saida.some((s) => s.id === Number(l.id))) continue
      saida.push({ id: Number(l.id), nome: String(l.nome ?? ''), status: l.status ?? null, organizadorId: String(l.organizadorId), papel: vinculo.papel as PapelMembro })
    }
  }
  return saida
}

/** Rota do líder/técnico (Meu Time) atrás da flag do painel: a conversa de correção com o organizador. */
export function rotaLiderPainel<P = Record<string, never>>(manipulador: (contexto: ContextoRota<P>) => Promise<Response>) {
  const interna = rotaMeuTime<P>(manipulador)
  return async (req: NextRequest, argumentos?: { params?: P }): Promise<Response> => {
    if (!painelAtivo()) return falha('Não encontrado.', 404)
    return interna(req, argumentos)
  }
}

// --- Rota ------------------------------------------------------------------------

export type ContextoPainel<P> = { req: NextRequest; usuarioId: string; nome: string; params: P }

/** Rota do painel: flag (404), sessão de organizador liberada (401/403), limite por usuário e tradução de erros. */
export function rotaPainel<P = Record<string, never>>(
  escopo: string,
  manipulador: (contexto: ContextoPainel<P>) => Promise<Response>,
) {
  return async (req: NextRequest, argumentos?: { params?: P | Promise<P> }): Promise<Response> => {
    if (!painelAtivo()) return falha('Não encontrado.', 404)
    const auth = await requireOrganizador(req)
    if (auth instanceof Response) return auth
    try {
      await limitarUsuario(req, `painel-${escopo}`, String(auth.userId), req.method === 'GET' ? 60 : 30)
      const params = (await Promise.resolve(argumentos?.params ?? {})) as P
      return await manipulador({ req, usuarioId: String(auth.userId), nome: String(auth.nome ?? ''), params })
    } catch (erro) {
      if (erro instanceof ErroMeuTime) {
        const resposta = falha(erro.message, erro.status, erro.codigo, erro.extra)
        const espera = erro.extra?.retryAfterSeconds
        if (typeof espera === 'number') resposta.headers.set('Retry-After', String(espera))
        return resposta
      }
      console.error('[painel-inscricoes] erro inesperado', erro instanceof Error ? erro.message : 'desconhecido')
      return falha('Não foi possível concluir a operação. Tente novamente.', 500)
    }
  }
}
