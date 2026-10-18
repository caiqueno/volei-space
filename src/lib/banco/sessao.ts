/**
 * App de banco por SESSÃO (R14): o líder/técnico/assistente da equipe entra pela conta do Meu Time, sem link.
 * Só muda a resolução de acesso; a visão, a validação, os limites e as respostas vêm do mesmo serviço do link
 * por token (src/lib/banco/servico.ts). O link por token continua existindo como alternativa.
 *
 * Flags (qualquer uma desligada = 404): BANCO_SESSAO_ATIVO=1, BANCO_APP_ATIVO=1 e MEU_TIME_ATIVO=1.
 * Ponte equipe do Meu Time -> equipe da partida: "Inscricao"."equipeLegadoId" (inteiro, "Equipe" da partida).
 * Papéis: leitura = todos os membros; pedidos (tempo/substituição) = RESPONSAVEL, TECNICO e ASSISTENTE;
 * papeleta = RESPONSAVEL e TECNICO. Quem não é membro da equipe naquela partida recebe 404 (IDOR).
 */
import type { NextRequest, NextResponse } from 'next/server'
import { requirePublicRole } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { consumirLimiteAsync, modoDeFalhaDoMetodo } from '@/lib/rate-limit'
import { ErroMeuTime, meuTimeAtivo } from '@/lib/meu-time/acesso'
import { inscricaoViva } from '@/lib/meu-time/regras'
import type { EquipeBanco, PapelEquipe } from '@/lib/meu-time/dados'
import { limitadoPorIp, respostaDeExcecao, type AcessoBanco } from './acesso'
import {
  MENSAGEM_BANCO_INDISPONIVEL,
  bancoAppAtivo,
  inteiroPositivo,
  naoEncontradoBanco,
  respostaErro,
} from './base'
import { conferir, lerPartidaBanco, setAtual, STATUS_PARTIDA_ENCERRADA, TabelaBancoAusenteErro } from './dados'

const db = supabaseAdmin as any

export function sessaoBancoAtiva(env: Record<string, string | undefined> = process.env): boolean {
  return env.BANCO_SESSAO_ATIVO === '1'
}

/** As três flags ligadas: sessão do banco, app de banco e Meu Time. */
export function bancoPorSessaoDisponivel(): boolean {
  return sessaoBancoAtiva() && bancoAppAtivo() && meuTimeAtivo()
}

export type ExigenciaSessao = 'leitura' | 'pedido' | 'papeleta'

const PAPEIS: Record<ExigenciaSessao, PapelEquipe[]> = {
  leitura: ['RESPONSAVEL', 'TECNICO', 'ASSISTENTE', 'CAPITAO'],
  pedido: ['RESPONSAVEL', 'TECNICO', 'ASSISTENTE'],
  papeleta: ['RESPONSAVEL', 'TECNICO'],
}

/** Resolve o acesso do banco pela sessão. Devolve a resposta de erro pronta quando o acesso não vale. */
export async function resolverAcessoSessao(
  req: NextRequest,
  partidaParam: string,
  equipeParam: string,
  exigencia: ExigenciaSessao,
): Promise<AcessoBanco | NextResponse> {
  if (!bancoPorSessaoDisponivel()) return naoEncontradoBanco()
  const auth = await requirePublicRole(req, ['equipe'])
  if (auth instanceof Response) return auth as NextResponse
  const porIp = await limitadoPorIp(req)
  if (porIp) return porIp
  const porUsuario = await consumirLimiteAsync(`banco:sessao:${auth.userId}`, 90, 60_000, modoDeFalhaDoMetodo(req.method))
  if (!porUsuario.ok) {
    return respostaErro('Muitas requisições. Aguarde um instante.', 429, 'LIMITE_EXCEDIDO', { retryAfterSeconds: porUsuario.retryAfterSeconds })
  }

  const partidaId = inteiroPositivo(partidaParam)
  const equipeId = inteiroPositivo(equipeParam)
  if (partidaId == null || equipeId == null) return naoEncontradoBanco()
  try {
    const partida = await lerPartidaBanco(partidaId)
    if (!partida || (equipeId !== partida.equipeAId && equipeId !== partida.equipeBId)) return naoEncontradoBanco()

    const inscricoes = (conferir(
      await db.from('Inscricao').select('timeId,status,categoriaCampeonatoId').eq('equipeLegadoId', equipeId).eq('ligaId', partida.ligaId),
    ) as any[] | null) ?? []
    const times = inscricoes
      .filter((item) => inscricaoViva(String(item.status)))
      .filter((item) => !partida.categoriaCampeonatoId || item.categoriaCampeonatoId === partida.categoriaCampeonatoId)
      .map((item) => String(item.timeId))
    if (times.length === 0) return naoEncontradoBanco()
    const membros = (conferir(
      await db.from('MembroEquipe').select('timeId,papel').eq('usuarioId', String(auth.userId)).in('timeId', times),
    ) as Array<{ timeId: string; papel: PapelEquipe }> | null) ?? []
    if (membros.length === 0) return naoEncontradoBanco()
    if (!membros.some((membro) => PAPEIS[exigencia].includes(membro.papel))) {
      return respostaErro('Você não tem permissão para esta ação nesta equipe.', 403, 'SEM_PERMISSAO')
    }
    return { acessoId: `sessao:${auth.userId}`, partida, equipeId }
  } catch (e) {
    return respostaDeExcecao(e)
  }
}

// --- Jogos da equipe ----------------------------------------------------------------------------

export type JogoDaEquipe = {
  partidaId: number
  /** "Equipe" da partida (inteiro): é o `equipeId` das rotas /api/banco/sessao/[partidaId]/[equipeId]. */
  equipeId: number
  adversario: string
  horario: string | null
  local: string | null
  status: string
  campeonato: string
  categoria: string
  papeletaPendente: boolean
}

/** Início do dia em Brasília (UTC-3, sem horário de verão). */
function inicioDoDia(agora: Date): Date {
  const base = new Date(agora.getTime() - 3 * 3_600_000)
  base.setUTCHours(0, 0, 0, 0)
  return new Date(base.getTime() + 3 * 3_600_000)
}

/**
 * Jogos de hoje e futuros da equipe, nos campeonatos em que ela está inscrita (ponte Inscricao.equipeLegadoId).
 * Sem PII: nomes de equipe, campeonato e categoria, horário e local. `papeletaPendente`: partida não encerrada e
 * a papeleta do set em disputa (ou do próximo) ainda não foi enviada.
 */
export async function listarJogosDaEquipe(equipe: EquipeBanco, agora = new Date()): Promise<JogoDaEquipe[]> {
  try {
    const inscricoes = ((conferir(
      await db.from('Inscricao').select('ligaId,categoriaCampeonatoId,status,equipeLegadoId').eq('timeId', equipe.id),
    ) as any[] | null) ?? []).filter((item) => item.equipeLegadoId != null && inscricaoViva(String(item.status)))
    if (inscricoes.length === 0) return []
    const porEquipe = new Map<number, { ligaId: number; categoriaId: string }>()
    for (const item of inscricoes) porEquipe.set(Number(item.equipeLegadoId), { ligaId: Number(item.ligaId), categoriaId: String(item.categoriaCampeonatoId) })
    const ids = Array.from(porEquipe.keys())

    const colunas = 'id,ligaId,equipeAId,equipeBId,status,dataHora,localNome,categoriaCampeonatoId'
    const [comoA, comoB] = await Promise.all([
      db.from('Partida').select(colunas).in('equipeAId', ids),
      db.from('Partida').select(colunas).in('equipeBId', ids),
    ])
    const brutas = [...((conferir(comoA) as any[] | null) ?? []), ...((conferir(comoB) as any[] | null) ?? [])]
    const vistas = new Set<number>()
    const inicio = inicioDoDia(agora).getTime()
    const partidas = brutas
      .filter((p) => (vistas.has(Number(p.id)) ? false : (vistas.add(Number(p.id)), true)))
      .filter((p) => {
        const minha = ids.find((id) => id === Number(p.equipeAId) || id === Number(p.equipeBId))
        const alvo = minha != null ? porEquipe.get(minha) : undefined
        if (!alvo || alvo.ligaId !== Number(p.ligaId)) return false
        if (p.categoriaCampeonatoId && p.categoriaCampeonatoId !== alvo.categoriaId) return false
        if (String(p.status ?? '').toUpperCase() === 'CANCELADA') return false
        const quando = p.dataHora ? new Date(p.dataHora).getTime() : NaN
        return !Number.isNaN(quando) && quando >= inicio
      })
      .sort((a, b) => String(a.dataHora).localeCompare(String(b.dataHora)) || Number(a.id) - Number(b.id))
    if (partidas.length === 0) return []

    const partidaIds = partidas.map((p) => Number(p.id))
    const equipeIds = Array.from(new Set(partidas.flatMap((p) => [Number(p.equipeAId), Number(p.equipeBId)]).filter((id) => Number.isInteger(id) && id > 0)))
    const [equipes, ligas, categorias, sets, papeletas] = await Promise.all([
      db.from('Equipe').select('id,nome').in('id', equipeIds),
      db.from('Liga').select('id,nome').in('id', Array.from(new Set(partidas.map((p) => Number(p.ligaId))))),
      db.from('CategoriaCampeonato').select('id,nome').in('id', Array.from(new Set(partidas.map((p) => p.categoriaCampeonatoId).filter(Boolean)))),
      db.from('SetPartida').select('partidaId,numero,pontosA,pontosB').in('partidaId', partidaIds),
      db.from('Papeleta').select('partidaId,equipeId,setNumero,estado').in('partidaId', partidaIds),
    ])
    const nomeEquipe = new Map(((conferir(equipes) as any[] | null) ?? []).map((e) => [Number(e.id), String(e.nome ?? '')]))
    const nomeLiga = new Map(((conferir(ligas) as any[] | null) ?? []).map((l) => [Number(l.id), String(l.nome ?? '')]))
    const nomeCategoria = new Map(((conferir(categorias) as any[] | null) ?? []).map((c) => [String(c.id), String(c.nome ?? '')]))
    const setsLidos = (conferir(sets) as any[] | null) ?? []
    const papeletasLidas = (conferir(papeletas) as any[] | null) ?? []

    return partidas.map((p) => {
      const minha = ids.find((id) => id === Number(p.equipeAId) || id === Number(p.equipeBId))!
      const outra = Number(p.equipeAId) === minha ? Number(p.equipeBId) : Number(p.equipeAId)
      const encerrada = STATUS_PARTIDA_ENCERRADA.includes(String(p.status ?? '').toUpperCase())
      const setNumero = setAtual(setsLidos.filter((s) => Number(s.partidaId) === Number(p.id)).map((s) => ({ numero: Number(s.numero), pontosA: Number(s.pontosA), pontosB: Number(s.pontosB) })))
      const enviada = papeletasLidas.some(
        (x) => Number(x.partidaId) === Number(p.id) && Number(x.equipeId) === minha && Number(x.setNumero) === setNumero && ['ENVIADA', 'ACEITA'].includes(String(x.estado)),
      )
      return {
        partidaId: Number(p.id),
        equipeId: minha,
        adversario: nomeEquipe.get(outra) || 'A definir',
        horario: p.dataHora ?? null,
        local: p.localNome ?? null,
        status: String(p.status ?? ''),
        campeonato: nomeLiga.get(Number(p.ligaId)) ?? '',
        categoria: nomeCategoria.get(String(p.categoriaCampeonatoId)) ?? '',
        papeletaPendente: !encerrada && !enviada,
      }
    })
  } catch (e) {
    if (e instanceof TabelaBancoAusenteErro) throw new ErroMeuTime(MENSAGEM_BANCO_INDISPONIVEL, 503, 'BANCO_INDISPONIVEL')
    throw e
  }
}
