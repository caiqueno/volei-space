import { NextRequest } from 'next/server'
import { error, success } from '@/lib/api-response'
import { requirePublicRole } from '@/lib/auth'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { rejectIfCampeonatoFinalizado } from '@/lib/championship-finalization'
import { getBracketRounds, THIRD_PLACE_FASE } from '@/lib/mata-mata'
import { colunasDeVagaAtivas, erroColunaDeVagaAusente } from '@/lib/consulta-vaga'
import { lerIdCategoria } from '@/lib/isolamento-categoria'
import { sincronizarVagas } from '@/lib/preencher-vagas'
import { gerarSumulaToken } from '@/lib/sumula-token'
import { lerOrigemVaga, sugerirVagasSemifinal, timesDefinidos } from '@/lib/vaga-a-definir'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type RouteContext = { params: Promise<{ id: string }> }

const MENSAGEM_DESLIGADA = 'As vagas a definir ainda não estão disponíveis neste campeonato.'

function recursoIndisponivel(erro: { message?: string; code?: string; details?: string } | null) {
  if (erroColunaDeVagaAusente(erro)) return true
  const texto = `${erro?.code ?? ''} ${erro?.message ?? ''} ${erro?.details ?? ''}`
  return /23502|null value in column "equipe[AB]Id"|not-null/i.test(texto)
}

export async function GET(req: NextRequest, context: RouteContext) {
  const auth = await requirePublicRole(req, ['organizador'], { releasedOnly: true })
  if (auth instanceof Response) return auth
  const ligaId = Number((await context.params).id)
  if (!Number.isInteger(ligaId)) return error('Campeonato inválido.', 400)
  const categoria = lerIdCategoria(new URL(req.url).searchParams.get('categoria'))
  if ('erro' in categoria || !categoria.id) return error('Escolha a categoria.', 422)

  const { data: liga } = await supabase.from('Liga').select('id,organizadorId').eq('id', ligaId).maybeSingle()
  if (!liga) return error('Campeonato não encontrado.', 404)
  if (liga.organizadorId !== auth.userId) return error('Você não pode ver a chave deste campeonato.', 403)
  if (!(await colunasDeVagaAtivas())) return success({ disponivel: false, grupos: [], jogos: [] })

  const [{ data: config }, { data: grupos }, { data: partidas }] = await Promise.all([
    supabase.from('CategoriaConfiguracao').select('faseEliminatoria,disputaTerceiroLugar').eq('ligaId', ligaId).eq('categoriaCampeonatoId', categoria.id).maybeSingle(),
    supabase.from('GrupoCampeonato').select('nome,ordem').eq('ligaId', ligaId).eq('categoriaCampeonatoId', categoria.id).order('ordem', { ascending: true }),
    supabase.from('Partida').select('id,fase,rodada,equipeAId,equipeBId,origemVagaA,origemVagaB,dataHora,localNome').eq('ligaId', ligaId).eq('categoriaCampeonatoId', categoria.id),
  ])
  const rounds = getBracketRounds(config?.faseEliminatoria)
  if (!rounds.some((rodada) => rodada.fase === 'SEMIFINAL')) return success({ disponivel: true, grupos: [], jogos: [] })

  const nomes = (grupos ?? []).map((grupo) => String(grupo.nome ?? '').trim()).filter(Boolean)
  const disputa = config?.disputaTerceiroLugar !== false
  const sugestoes = sugerirVagasSemifinal(nomes, disputa)
  const jogos = sugestoes.map((jogo) => {
    const existente = (partidas ?? []).find((partida) => partida.fase === jogo.fase && Number(partida.rodada) === jogo.rodada)
    return {
      ...jogo,
      ocupado: Boolean(existente),
      partidaId: existente?.id ?? null,
      timesDefinidos: existente ? timesDefinidos(existente) : false,
      dataHora: existente?.dataHora ?? null,
      localNome: existente?.localNome ?? null,
      origemVagaA: existente?.origemVagaA || jogo.origemVagaA,
      origemVagaB: existente?.origemVagaB || jogo.origemVagaB,
    }
  })
  return success({ disponivel: true, grupos: nomes, jogos })
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const auth = await requirePublicRole(req, ['organizador'], { releasedOnly: true })
    if (auth instanceof Response) return auth
    const ligaId = Number((await context.params).id)
    if (!Number.isInteger(ligaId)) return error('Campeonato inválido.', 400)
    if (!(await colunasDeVagaAtivas())) return error(MENSAGEM_DESLIGADA, 422)

    const body = await req.json().catch(() => null)
    const categoria = lerIdCategoria(body?.categoriaCampeonatoId)
    if ('erro' in categoria || !categoria.id) return error('Escolha a categoria.', 422)
    const jogos = Array.isArray(body?.jogos) ? body.jogos.slice(0, 8) : []
    if (jogos.length === 0) return error('Informe os jogos do mata-mata.', 422)

    const { data: liga } = await supabase.from('Liga').select('id,organizadorId,pagamentoConfirmadoEm').eq('id', ligaId).maybeSingle()
    if (!liga) return error('Campeonato não encontrado.', 404)
    if (liga.organizadorId !== auth.userId) return error('Você não pode alterar o chaveamento deste campeonato.', 403)
    if (!liga.pagamentoConfirmadoEm) return error('Confirme o pagamento do campeonato antes de montar a chave.', 403)
    const bloqueio = await rejectIfCampeonatoFinalizado(ligaId)
    if (bloqueio) return bloqueio

    const [{ data: categoriaRow }, { data: config }] = await Promise.all([
      supabase.from('CategoriaCampeonato').select('id').eq('id', categoria.id).eq('ligaId', ligaId).is('removidaEm', null).maybeSingle(),
      supabase.from('CategoriaConfiguracao').select('faseEliminatoria,disputaTerceiroLugar').eq('ligaId', ligaId).eq('categoriaCampeonatoId', categoria.id).maybeSingle(),
    ])
    if (!categoriaRow) return error('Categoria não encontrada neste campeonato.', 404)
    if (!config) return error('Configure a categoria antes de montar a chave.', 422)
    const rounds = getBracketRounds(config.faseEliminatoria)
    if (!rounds.some((rodada) => rodada.fase === 'SEMIFINAL')) return error('Esta categoria não tem semifinal.', 422)

    const criados: Array<{ id: number; fase: string; rodada: number }> = []
    for (const jogo of jogos) {
      const fase = String(jogo?.fase ?? '').toUpperCase()
      const rodada = Number(jogo?.rodada)
      const origemA = lerOrigemVaga(jogo?.origemVagaA)
      const origemB = lerOrigemVaga(jogo?.origemVagaB)
      const rotuloA = origemA ? String(jogo.origemVagaA).replace(/\s+/g, ' ').trim() : ''
      const rotuloB = origemB ? String(jogo.origemVagaB).replace(/\s+/g, ' ').trim() : ''
      if (!origemA || !origemB || rotuloA.toLocaleLowerCase('pt-BR') === rotuloB.toLocaleLowerCase('pt-BR')) {
        return error('Cada lado da vaga precisa de uma origem diferente.', 422)
      }
      const dataHora = dataAgendada(jogo?.dataHora)
      const localNome = String(jogo?.localNome ?? '').trim()
      if (!dataHora) return error('Informe a data e o horário do jogo.', 422)
      if (!localNome || localNome.length > 120) return error('Informe a quadra do jogo.', 422)
      if (!vagaPermitida(fase, rodada, rounds, config.disputaTerceiroLugar !== false)) {
        return error('Este jogo não faz parte da chave desta categoria.', 422)
      }

      const { data: existente, error: existenteErr } = await supabase
        .from('Partida')
        .select('id,equipeAId,equipeBId')
        .eq('ligaId', ligaId)
        .eq('categoriaCampeonatoId', categoria.id)
        .eq('fase', fase)
        .eq('rodada', rodada)
        .maybeSingle()
      if (existenteErr) {
        if (recursoIndisponivel(existenteErr)) return error(MENSAGEM_DESLIGADA, 422)
        return error('Erro ao verificar o confronto.', 500)
      }
      if (existente) {
        if (timesDefinidos(existente)) return error('Este confronto já foi criado nesta categoria.', 409)
        const { error: updateErr } = await supabase.from('Partida').update({
          origemVagaA: canonical(origemA),
          origemVagaB: canonical(origemB),
          dataHora,
          localNome,
          atualizadoEm: new Date().toISOString(),
        }).eq('id', existente.id)
        if (updateErr) {
          if (recursoIndisponivel(updateErr)) return error(MENSAGEM_DESLIGADA, 422)
          return error('Erro ao atualizar o jogo.', 500)
        }
        criados.push({ id: Number(existente.id), fase, rodada })
        continue
      }

      const { data: partida, error: insertErr } = await supabase.from('Partida').insert({
        ligaId,
        equipeAId: null,
        equipeBId: null,
        origemVagaA: canonical(origemA),
        origemVagaB: canonical(origemB),
        categoria: 'GERAL',
        serie: null,
        categoriaCampeonatoId: categoria.id,
        rodada,
        status: 'AGENDADA',
        dataHora,
        localNome,
        sumulaToken: gerarSumulaToken(),
        grupoId: null,
        fase,
        atualizadoEm: new Date().toISOString(),
      }).select('id,fase,rodada').single()
      if (insertErr || !partida) {
        if (recursoIndisponivel(insertErr)) return error(MENSAGEM_DESLIGADA, 422)
        if (insertErr?.code === '23505') return error('Este confronto já foi criado nesta categoria.', 409)
        console.error('[vaga] erro ao criar jogo', insertErr)
        return error('Erro ao criar o jogo.', 500)
      }
      criados.push({ id: Number(partida.id), fase: String(partida.fase), rodada: Number(partida.rodada) })
    }

    let preenchidos = 0
    try {
      preenchidos = (await sincronizarVagas(ligaId, categoria.id)).atualizados
    } catch (err) {
      console.error('[vaga] jogos criados; times não preenchidos', err)
    }
    return success({ criados: criados.length, partidas: criados, preenchidos }, 201)
  } catch (err) {
    console.error('[vaga] erro ao agendar', err)
    return error('Erro ao agendar o mata-mata.', 500)
  }
}

function canonical(origem: NonNullable<ReturnType<typeof lerOrigemVaga>>) {
  return origem.tipo === 'grupo'
    ? `${origem.posicao}º ${origem.grupo}`
    : `${origem.tipo === 'vencedor' ? 'Vencedor' : 'Perdedor'} Semi ${origem.rodada}`
}

function dataAgendada(valor: unknown) {
  if (typeof valor !== 'string' || !valor.trim()) return null
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return null
  return data.toISOString()
}

function vagaPermitida(
  fase: string,
  rodada: number,
  rounds: Array<{ fase: string; slots: number }>,
  disputaTerceiro: boolean,
) {
  if (!Number.isInteger(rodada) || rodada < 1) return false
  if (fase === THIRD_PLACE_FASE) return disputaTerceiro && rodada === 1 && rounds.some((item) => item.fase === 'SEMIFINAL')
  const round = rounds.find((item) => item.fase === fase)
  return Boolean(round && rodada <= round.slots)
}
