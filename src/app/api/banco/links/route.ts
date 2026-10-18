import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { success } from '@/lib/api-response'
import { requireArbitroPartidaAccess } from '@/lib/arbitro-access'
import { exigirOrganizadorDaLiga } from '@/lib/organizador-isolamento'
import { consumirLimite, ipDaRequisicao } from '@/lib/rate-limit'
import {
  bancoAppAtivo,
  falhaBanco,
  gerarTokenBanco,
  hashTokenBanco,
  inteiroPositivo,
  naoEncontradoBanco,
  respostaErro,
} from '@/lib/banco/base'
import { conferir } from '@/lib/banco/dados'
import { idUuid, lerCorpo } from '@/lib/banco/servico'
import { respostaDeExcecao } from '@/lib/banco/acesso'

/**
 * Links do app de banco (R9). Desligado sem `BANCO_APP_ATIVO=1` (404).
 * Quem gera, lista e revoga: organizador dono do campeonato, ou árbitro/apontador com acesso à partida.
 * O token aparece uma única vez na resposta do POST; no banco fica só o hash (a listagem nunca o devolve).
 *
 * Partida inexistente e partida sem permissão respondem a MESMA 404 ("Partida não encontrada."),
 * para não revelar quais partidas existem. A autorização acontece antes de qualquer resposta específica.
 */
export const dynamic = 'force-dynamic'

const db = supabaseAdmin as any
const HORAS_APOS_O_JOGO = 12
const MS_HORA = 3_600_000

const corpoSchema = z.object({
  partidaId: z.number().int().positive(),
  equipeId: z.number().int().positive(),
})

const semPartida = () => respostaErro('Partida não encontrada.', 404)
const semLink = () => respostaErro('Link não encontrado.', 404)

function limitar(req: NextRequest) {
  const limite = consumirLimite(`banco:links:${ipDaRequisicao(req)}`, 30, 60_000)
  return limite.ok
    ? null
    : respostaErro('Muitas requisições. Aguarde um instante.', 429, 'LIMITE_EXCEDIDO', { retryAfterSeconds: limite.retryAfterSeconds })
}

/** Falha de identidade ou de permissão (401/403/404) vira a mesma 404 neutra; o resto (429, 5xx) passa. */
function mascarar(resposta: NextResponse, neutra: () => NextResponse) {
  return [401, 403, 404].includes(resposta.status) ? neutra() : resposta
}

/** Autoriza quem opera a partida (mesma regra da súmula). Devolve o usuário ou a resposta de erro. */
async function autorizar(req: NextRequest, partida: { id: number; ligaId: number; sumulaToken: string | null }) {
  if (partida.sumulaToken) {
    const acesso = await requireArbitroPartidaAccess(req, partida.sumulaToken)
    if (acesso instanceof Response) return acesso as NextResponse
    return { usuarioId: String(acesso.auth.userId) }
  }
  const org = await exigirOrganizadorDaLiga(req, Number(partida.ligaId))
  if (org instanceof Response) return org as NextResponse
  return { usuarioId: String(org.userId) }
}

async function lerPartida(partidaId: number) {
  const partida = (await db
    .from('Partida')
    .select('id,ligaId,equipeAId,equipeBId,sumulaToken,dataHora')
    .eq('id', partidaId)
    .maybeSingle()) as { data: any; error: any }
  return partida
}

export async function POST(req: NextRequest) {
  if (!bancoAppAtivo()) return naoEncontradoBanco()
  const bloqueado = limitar(req)
  if (bloqueado) return bloqueado

  const lido = corpoSchema.safeParse(await lerCorpo(req))
  if (!lido.success) return respostaErro('Dados inválidos.', 400, 'DADOS_INVALIDOS', { details: lido.error.flatten().fieldErrors })
  const { partidaId, equipeId } = lido.data

  try {
    const partida = await lerPartida(partidaId)
    if (partida.error) return falhaBanco()
    if (!partida.data) return semPartida()
    const p = partida.data
    const auth = await autorizar(req, p)
    if (auth instanceof Response) return mascarar(auth, semPartida)
    if (equipeId !== p.equipeAId && equipeId !== p.equipeBId) {
      return respostaErro('A equipe não joga esta partida.', 422, 'EQUIPE_FORA_DA_PARTIDA')
    }

    const token = gerarTokenBanco()
    const inicio = p.dataHora ? new Date(p.dataHora).getTime() : NaN
    const base = Number.isFinite(inicio) ? Math.max(inicio, Date.now()) : Date.now()
    const expiraEm = new Date(base + HORAS_APOS_O_JOGO * MS_HORA).toISOString()
    const criado = conferir(
      await db
        .from('BancoAcesso')
        .insert({
          partidaId,
          equipeId,
          tokenHash: hashTokenBanco(token),
          criadoPor: auth.usuarioId,
          expiraEm,
        })
        .select('id')
        .maybeSingle(),
    ) as { id?: string } | null
    const origem = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? new URL(req.url).origin
    return success({ url: `${origem}/banco/${token}`, expiraEm, acessoId: criado?.id ? String(criado.id) : null }, 201)
  } catch (e) {
    return respostaDeExcecao(e)
  }
}

/**
 * Lista os links emitidos para a partida: GET /api/banco/links?partidaId=...
 * Nunca devolve o token (que não é guardado), só o necessário para exibir e revogar.
 */
export async function GET(req: NextRequest) {
  if (!bancoAppAtivo()) return naoEncontradoBanco()
  const bloqueado = limitar(req)
  if (bloqueado) return bloqueado

  const partidaId = inteiroPositivo(new URL(req.url).searchParams.get('partidaId') ?? '')
  if (!partidaId) return respostaErro('Dados inválidos.', 400, 'DADOS_INVALIDOS')

  try {
    const partida = await lerPartida(partidaId)
    if (partida.error) return falhaBanco()
    if (!partida.data) return semPartida()
    const auth = await autorizar(req, partida.data)
    if (auth instanceof Response) return mascarar(auth, semPartida)

    const linhas = conferir(
      await db.from('BancoAcesso').select('id,equipeId,criadoEm,expiraEm,revogadoEm').eq('partidaId', partidaId),
    ) as any[]
    const data = (linhas ?? [])
      .map((l) => ({
        acessoId: String(l.id),
        equipeId: Number(l.equipeId),
        criadoEm: l.criadoEm ?? null,
        expiraEm: l.expiraEm ?? null,
        revogadoEm: l.revogadoEm ?? null,
      }))
      .sort((x, y) => String(y.criadoEm ?? '').localeCompare(String(x.criadoEm ?? '')))
    return success(data)
  } catch (e) {
    return respostaDeExcecao(e)
  }
}

/** Revoga um link: DELETE /api/banco/links?acessoId=... (idempotente). */
export async function DELETE(req: NextRequest) {
  if (!bancoAppAtivo()) return naoEncontradoBanco()
  const bloqueado = limitar(req)
  if (bloqueado) return bloqueado

  const acessoId = new URL(req.url).searchParams.get('acessoId') ?? ''
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(acessoId)) return respostaErro('Dados inválidos.', 400, 'DADOS_INVALIDOS')
  // id que não é uuid nunca existe: mesma 404 de link inexistente (evita erro 22P02 do Postgres).
  if (!idUuid(acessoId)) return semLink()
  try {
    const acesso = conferir(await db.from('BancoAcesso').select('id,partidaId,revogadoEm').eq('id', acessoId).maybeSingle()) as any
    if (!acesso) return semLink()
    const partidaId = inteiroPositivo(acesso.partidaId)
    const partida = partidaId
      ? ((await db.from('Partida').select('id,ligaId,sumulaToken').eq('id', partidaId).maybeSingle()) as { data: any }).data
      : null
    if (!partida) return semLink()
    const auth = await autorizar(req, partida)
    if (auth instanceof Response) return mascarar(auth, semLink)
    if (!acesso.revogadoEm) {
      conferir(await db.from('BancoAcesso').update({ revogadoEm: new Date().toISOString() }).eq('id', acesso.id))
    }
    return success({ revogado: true })
  } catch (e) {
    return respostaDeExcecao(e)
  }
}
