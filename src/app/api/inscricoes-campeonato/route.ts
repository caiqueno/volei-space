import { NextRequest } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { inscricaoCampeonatoSchema } from '@/lib/schemas'
import { countApprovedRegistrations, ensureClassificationAndCalendar } from '@/lib/championship-operations'
import { requirePublicRole } from '@/lib/auth'
import { ensureEquipeForCandidatura } from '@/lib/team-activation'
import { reconcileAcceptedInvitations } from '@/lib/championship-registration-sync'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const EQUIPE_WITH_ROSTER_SELECT = `
  *,
  jogadores:Jogador(
    id,
    nome,
    numero,
    posicao,
    fotoUrl,
    fotoRostoUrl,
    qrCodeToken,
    banido,
    criadoEm
  )
`

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const organizadorId = searchParams.get('organizadorId')
  const candidaturaId = searchParams.get('candidaturaId')

  if (organizadorId) {
    const auth = await requirePublicRole(req, ['organizador'])
    if (auth instanceof Response) return auth
    if (auth.userId !== organizadorId) return error('Acesso negado para este organizador.', 403)

    const { data: ligas, error: ligasErr } = await supabase
      .from('Liga')
      .select('id,nome,status,slug')
      .eq('organizadorId', organizadorId)
      .order('criadoEm', { ascending: false })

    if (ligasErr) return error('Erro ao buscar campeonatos.', 500)

    const ligaIds = (ligas ?? []).map((liga: any) => liga.id)
    if (ligaIds.length === 0) return success({ campeonatos: [], inscricoes: [] })

    let reconciliacao
    try {
      reconciliacao = await reconcileAcceptedInvitations(ligaIds)
    } catch (reconciliationError) {
      console.error('[inscricoes-campeonato] erro ao reconciliar inscrições legadas', reconciliationError)
      return error('Não foi possível sincronizar as inscrições das equipes.', 500)
    }

    const { data: inscricoes, error: inscricoesErr } = await supabase
      .from('InscricaoCampeonato')
      .select('id,ligaId,equipeId,status,criadaEm,equipe:Equipe(id,nome,categoria,serie)')
      .in('ligaId', ligaIds)
      .order('criadaEm', { ascending: false })

    if (inscricoesErr) return error('Erro ao buscar inscrições.', 500)
    const { data: rascunhos, error: rascunhosErr } = await supabase
      .from('InscricaoEquipeRascunho')
      .select('id,token,ligaId,status,nomeEquipe,categoria,serie,inscricaoCampeonatoId')
      .in('ligaId', ligaIds)
      .order('criadaEm', { ascending: false })
    if (rascunhosErr) return error('Erro ao recuperar links das inscrições.', 500, rascunhosErr)
    const tokenByRegistration = new Map((rascunhos ?? []).map((draft: any) => [draft.inscricaoCampeonatoId, draft.token]))
    const activeDrafts = (rascunhos ?? []).filter((draft: any) => !draft.inscricaoCampeonatoId).map((draft: any) => ({
      id: `draft-${draft.id}`,
      ligaId: draft.ligaId,
      status: draft.status,
      registrationToken: draft.token,
      equipe: { nome: draft.nomeEquipe, categoria: draft.categoria, serie: draft.serie },
    }))
    return success({
      campeonatos: ligas ?? [],
      inscricoes: [...activeDrafts, ...(inscricoes ?? []).map((item: any) => ({
        ...item,
        registrationToken: tokenByRegistration.get(item.id) ?? null,
      }))],
      reconciliacao,
    })
  }

  if (!candidaturaId) return error('Candidatura não informada.', 400)

  const auth = await requirePublicRole(req, ['equipe'])
  if (auth instanceof Response) return auth
  if (auth.userId !== candidaturaId) return error('Acesso negado para esta equipe.', 403)

  const equipe = await getEquipeAtiva(candidaturaId)
  if (!equipe) return success({ equipeAtiva: false, campeonatos: [] })

  const [{ data: ligas, error: ligasErr }, { data: inscricoes, error: inscricoesErr }] = await Promise.all([
    supabase
      .from('Liga')
      .select('*')
      .in('status', ['EM_BREVE', 'ATIVA'])
      .order('dataInicio', { ascending: true, nullsFirst: false }),
    supabase
      .from('InscricaoCampeonato')
      .select('*')
      .eq('equipeId', equipe.id),
  ])

  if (ligasErr || inscricoesErr) return error('Erro ao buscar campeonatos.', 500)

  const inscricaoByLiga = new Map((inscricoes ?? []).map((item: any) => [item.ligaId, item]))
  const ligaIds = (ligas ?? []).map((liga: any) => liga.id)
  const { data: aprovadasPorLiga } = ligaIds.length
    ? await supabase
      .from('InscricaoCampeonato')
      .select('ligaId')
      .in('ligaId', ligaIds)
      .eq('status', 'APROVADA')
    : { data: [] as any[] }
  const approvedCount = new Map<number, number>()
  ;(aprovadasPorLiga ?? []).forEach((item: any) => {
    approvedCount.set(item.ligaId, (approvedCount.get(item.ligaId) ?? 0) + 1)
  })

  return success({
    equipeAtiva: true,
    equipe,
    campeonatos: (ligas ?? []).map((liga: any) => ({
      ...liga,
      inscricao: inscricaoByLiga.get(liga.id) ?? null,
      campeonatoAtual: liga.id === equipe.ligaId,
      equipesAprovadas: approvedCount.get(liga.id) ?? 0,
      vagasDisponiveis: liga.quantidadeEquipes ? Math.max(Number(liga.quantidadeEquipes) - (approvedCount.get(liga.id) ?? 0), 0) : null,
    })),
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = inscricaoCampeonatoSchema.safeParse(body)
    if (!parsed.success) return error('Dados inválidos.', 422, parsed.error.flatten())

    const auth = await requirePublicRole(req, ['equipe'])
    if (auth instanceof Response) return auth
    if (auth.userId !== parsed.data.candidaturaId) return error('Acesso negado para esta equipe.', 403)

    const equipe = await getEquipeAtiva(parsed.data.candidaturaId)
    if (!equipe) return error('Equipe ainda não está ativa para inscrição em campeonatos.', 403)

    const { data: liga, error: ligaErr } = await supabase
      .from('Liga')
      .select('id,status,quantidadeEquipes,inscricoesAbertas')
      .eq('id', parsed.data.ligaId)
      .single()

    if (ligaErr || !liga) return error('Campeonato não encontrado.', 404)
    if (liga.status === 'FINALIZADO') return error('Este campeonato está finalizado e não aceita novas inscrições.', 409)
    if (!['EM_BREVE', 'ATIVA'].includes(liga.status)) return error('Campeonato não está aberto para inscrição.', 400)
    if (liga.inscricoesAbertas === false) return error('As inscrições deste campeonato estão fechadas.', 400)

    const aprovadas = await countApprovedRegistrations(parsed.data.ligaId)
    if (liga.quantidadeEquipes && aprovadas >= liga.quantidadeEquipes) {
      return error('O limite de equipes aprovadas deste campeonato já foi atingido.', 400)
    }

    const { data, error: insertErr } = await supabase
      .from('InscricaoCampeonato')
      .upsert({
        ligaId: parsed.data.ligaId,
        equipeId: equipe.id,
        status: 'APROVADA',
      }, { onConflict: 'ligaId,equipeId' })
      .select()
      .single()

    if (insertErr) throw insertErr
    return success(data, 201)
  } catch (err) {
    console.error('[inscricoes-campeonato] erro', err)
    return error('Erro ao solicitar inscrição.', 500)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const id = String(body.id ?? '')
    const status = String(body.status ?? '')

    if (!id || !['APROVADA', 'REJEITADA', 'SOLICITADA'].includes(status)) {
      return error('Dados inválidos.', 422)
    }

    const auth = await requirePublicRole(req, ['organizador'])
    if (auth instanceof Response) return auth

    const { data: inscricaoAtual, error: findErr } = await supabase
      .from('InscricaoCampeonato')
      .select(`*, liga:Liga(*), equipe:Equipe(${EQUIPE_WITH_ROSTER_SELECT})`)
      .eq('id', id)
      .single()

    if (findErr || !inscricaoAtual) return error('Inscrição não encontrada.', 404)
    const liga = Array.isArray(inscricaoAtual.liga) ? inscricaoAtual.liga[0] : inscricaoAtual.liga
    if (liga?.organizadorId !== auth.userId) return error('Acesso negado para este campeonato.', 403)

    if (status === 'APROVADA') {
      const aprovadas = await countApprovedRegistrations(inscricaoAtual.ligaId)
      const jaAprovada = inscricaoAtual.status === 'APROVADA'
      if (!jaAprovada && liga?.quantidadeEquipes && aprovadas >= liga.quantidadeEquipes) {
        return error('Não há mais vagas aprovadas para este campeonato.', 400)
      }
    }

    const { data, error: updateErr } = await supabase
      .from('InscricaoCampeonato')
      .update({ status })
      .eq('id', id)
      .select(`*, liga:Liga(*), equipe:Equipe(${EQUIPE_WITH_ROSTER_SELECT})`)
      .single()

    if (updateErr) throw updateErr
    if (status === 'APROVADA') await ensureClassificationAndCalendar(data)
    return success(withSynchronizedRoster(data))
  } catch (err) {
    console.error('[inscricoes-campeonato] erro ao atualizar', err)
    return error('Erro ao atualizar inscrição.', 500)
  }
}

async function getEquipeAtiva(candidaturaId: string) {
  return ensureEquipeForCandidatura(candidaturaId)
}

function withSynchronizedRoster(inscricao: any) {
  const equipe = Array.isArray(inscricao?.equipe) ? inscricao.equipe[0] : inscricao?.equipe
  if (!equipe) return inscricao

  const jogadores: any[] = (Array.isArray(equipe.jogadores) ? equipe.jogadores : [])
    .map((jogador: any) => ({
      ...jogador,
      status: jogador.banido ? 'INATIVO' : 'ATIVO',
    }))
    .sort((a: any, b: any) => {
      const numeroA = Number.isInteger(a.numero) ? a.numero : Number.MAX_SAFE_INTEGER
      const numeroB = Number.isInteger(b.numero) ? b.numero : Number.MAX_SAFE_INTEGER
      return numeroA - numeroB || String(a.nome).localeCompare(String(b.nome), 'pt-BR')
    })

  return {
    ...inscricao,
    equipe: {
      ...equipe,
      jogadores,
      quantidadeJogadores: jogadores.filter((jogador: any) => jogador.status === 'ATIVO').length,
      elencoAtualizadoEm: jogadores.reduce<string | null>((latest, jogador: any) => {
        if (!jogador.criadoEm) return latest
        return !latest || jogador.criadoEm > latest ? jogador.criadoEm : latest
      }, null),
    },
  }
}
