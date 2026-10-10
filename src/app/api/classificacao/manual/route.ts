import { NextRequest } from 'next/server'
import { error, success } from '@/lib/api-response'
import { requirePublicRole } from '@/lib/auth'
import { rejectIfCampeonatoFinalizado } from '@/lib/championship-finalization'
import { selecionarClassificados } from '@/lib/classificados'
import { lerIdCategoria } from '@/lib/isolamento-categoria'
import { chaveIniciadaNaCategoria, mensagemRpcOperacao, recusaClassificacaoManual } from '@/lib/operacao-categoria'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePublicRole(req, ['organizador'], { releasedOnly: true })
    if (auth instanceof Response) return auth

    const body = await req.json().catch(() => null)
    const ligaId = Number(body?.ligaId)
    const equipeId = Number(body?.equipeId)
    const categoria = lerIdCategoria(body?.categoriaCampeonatoId)
    if (!Number.isInteger(ligaId) || !Number.isInteger(equipeId)) return error('Campeonato ou equipe invalidos.', 400)
    if (!('id' in categoria) || !categoria.id) return error('erro' in categoria ? categoria.erro : 'Escolha a categoria antes de classificar a equipe.', 422)
    const categoriaId = categoria.id

    const { data: liga, error: ligaErr } = await supabase
      .from('Liga')
      .select('id,organizadorId')
      .eq('id', ligaId)
      .maybeSingle()
    if (ligaErr || !liga) return error('Campeonato nao encontrado.', 404)
    if (liga.organizadorId !== auth.userId) return error('Voce nao pode alterar a classificacao deste campeonato.', 403)
    const bloqueio = await rejectIfCampeonatoFinalizado(ligaId)
    if (bloqueio) return bloqueio

    const { data: equipe, error: equipeErr } = await supabase
      .from('Equipe')
      .select('id,nome,ligaId,categoriaCampeonatoId,statusEquipe')
      .eq('id', equipeId)
      .maybeSingle()
    if (equipeErr) return error('Erro ao validar a equipe.', 500)
    if (!equipe || Number(equipe.ligaId) !== ligaId || equipe.categoriaCampeonatoId !== categoriaId || equipe.statusEquipe !== 'ATIVA') {
      return error('A equipe não pertence a esta categoria.', 422)
    }

    const { data: inscricao, error: inscricaoErr } = await supabase
      .from('InscricaoCampeonato')
      .select('id')
      .eq('ligaId', ligaId)
      .eq('equipeId', equipeId)
      .eq('categoriaCampeonatoId', categoriaId)
      .eq('status', 'APROVADA')
      .maybeSingle()
    if (inscricaoErr) {
      console.error('[classificacao/manual] erro ao validar inscrição', inscricaoErr)
      return error('Erro ao validar inscricao da equipe.', 500)
    }
    if (!inscricao) return error('Equipe nao pertence a este campeonato.', 404)

    const gravado = await supabase.rpc('classificar_equipe_categoria', {
      p_liga_id: ligaId,
      p_categoria_id: categoriaId,
      p_equipe_id: equipeId,
      p_organizador_id: auth.userId,
    })
    if (gravado.error) {
      const mapeado = mensagemRpcOperacao(gravado.error)
      if (mapeado.motivo !== 'ausente') {
        if (mapeado.motivo === 'outro' && mapeado.status === 500) console.error('[classificacao/manual] rpc', gravado.error)
        return error(mapeado.mensagem, mapeado.status)
      }
      const reserva = await classificarSemFuncao(ligaId, categoriaId, equipeId, auth.userId)
      if (reserva instanceof Response) return reserva
    }

    return success({
      registro: gravado.data,
      message: `${equipe.nome ?? 'Equipe'} foi classificada manualmente pelo organizador.`,
    }, 201)
  } catch (err) {
    console.error('[classificacao/manual] erro', err)
    return error('Erro ao classificar equipe manualmente.', 500)
  }
}

async function classificarSemFuncao(ligaId: number, categoriaId: string, equipeId: number, organizadorId: string) {
  const [configRes, partidasRes, entradasRes, gruposRes, vinculosRes, manuaisRes] = await Promise.all([
    supabase.from('CategoriaConfiguracao').select('formato,quantidadeGrupos,classificadosPorGrupo,melhoresClassificadosGerais,faseEliminatoria').eq('ligaId', ligaId).eq('categoriaCampeonatoId', categoriaId).maybeSingle(),
    supabase.from('Partida').select('fase,categoriaCampeonatoId').eq('ligaId', ligaId).eq('categoriaCampeonatoId', categoriaId),
    supabase.from('ClassificacaoEntrada').select('equipeId,posicao').eq('ligaId', ligaId).eq('categoriaCampeonatoId', categoriaId).order('posicao', { ascending: true }),
    supabase.from('GrupoCampeonato').select('id,classificados').eq('ligaId', ligaId).eq('categoriaCampeonatoId', categoriaId),
    supabase.from('GrupoEquipeCampeonato').select('grupoId,equipeId').eq('ligaId', ligaId).eq('categoriaCampeonatoId', categoriaId),
    supabase.from('ClassificacaoEliminatoria').select('equipeId').eq('ligaId', ligaId).eq('categoriaCampeonatoId', categoriaId),
  ])
  if (configRes.error || partidasRes.error || entradasRes.error || gruposRes.error || vinculosRes.error || manuaisRes.error) {
    return error('Erro ao validar as vagas desta categoria.', 500)
  }
  const manuais = (manuaisRes.data ?? []).map((item) => Number(item.equipeId))
  const classificados = selecionarClassificados({
    formato: configRes.data?.formato,
    faseEliminatoria: configRes.data?.faseEliminatoria,
    quantidadeGrupos: configRes.data?.quantidadeGrupos,
    classificadosPorGrupo: configRes.data?.classificadosPorGrupo,
    melhoresClassificadosGerais: configRes.data?.melhoresClassificadosGerais,
    ordenados: (entradasRes.data ?? []).map((item) => Number(item.equipeId)),
    grupos: (gruposRes.data ?? []).map((grupo) => ({ id: Number(grupo.id), classificados: Number(grupo.classificados ?? 0) })),
    vinculos: (vinculosRes.data ?? []).map((vinculo) => ({ grupoId: Number(vinculo.grupoId), equipeId: Number(vinculo.equipeId) })),
    manuais,
  })
  const recusa = recusaClassificacaoManual({
    faseEliminatoria: configRes.data?.faseEliminatoria,
    chaveIniciada: chaveIniciadaNaCategoria(partidasRes.data ?? [], categoriaId),
    equipeNaCategoria: true,
    jaClassificada: classificados.has(equipeId),
    classificados: classificados.size,
  })
  if (recusa) return error(recusa, recusa.includes('não pertence') || recusa.includes('não possui') ? 422 : 409)

  const { error: insertErr } = await supabase.from('ClassificacaoEliminatoria').insert({
    ligaId,
    categoriaCampeonatoId: categoriaId,
    equipeId,
    organizadorId,
    origem: 'MANUAL',
  })
  if (insertErr) {
    if (insertErr.code === '23505') return error('Esta equipe já está classificada nesta categoria.', 409)
    console.error('[classificacao/manual] erro ao classificar', insertErr)
    return error('Erro ao classificar equipe manualmente.', 500)
  }
  return null
}
