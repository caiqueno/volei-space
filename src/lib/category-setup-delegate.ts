import { NextRequest } from 'next/server'
import { error, success } from '@/lib/api-response'
import { CategoryScopeError, getCategoryConfiguration } from '@/lib/category-scope'
import {
  camposAlterados,
  camposParaEspelharNaLiga,
  erroAoConcluirCategoria,
  jogoImpedeEdicaoDaCategoria,
  MENSAGEM_EDICAO_BLOQUEADA,
  proximoEstadoSecoes,
  secoesDependentes,
  statusConfiguracaoDaCategoria,
  type SecaoSetup,
} from '@/lib/configuracao-categoria-edicao'
import type { SetupIntent } from '@/lib/championship-setup-status'
import { validateQrPhotoNameDependency } from '@/lib/championship-validation'
import { supabaseAdmin as db } from '@/lib/supabase-admin'

const ALLOWED: Record<string, string[]> = {
  estrutura: ['quantidadeEquipes', 'quantidadeEquipesMinima', 'quantidadeEquipesMaxima', 'formato', 'quantidadeGrupos', 'turnoReturno', 'setsFormato', 'setsPorPartida', 'pontosPorSet', 'diferencaMinimaSet', 'tieBreakUltimoSet', 'pontosUltimoSet', 'terceiroSetObrigatorio', 'sumulaScoutsEnabled'],
  classificacao: ['criteriosClassificacao', 'classificadosPorGrupo', 'melhoresClassificadosGerais', 'pontosVencedorMargem1', 'pontosPerdedorMargem1', 'pontosVencedorMargem2', 'pontosPerdedorMargem2'],
  eliminatorias: ['faseEliminatoria', 'metodoChaveamento', 'eliminatoriaIdaVolta', 'disputaTerceiroLugar', 'goldenSet'],
  calendario: ['dataInicio', 'dataFim'],
  inscricoes: ['inscricoesAbertas', 'inscricoesAberturaEm', 'inscricoesEncerramentoEm', 'inscricaoPermiteEdicaoAposEnvio', 'inscricaoPrazoEdicaoDias', 'elencoQuantidadeMinima', 'elencoQuantidadeMaxima', 'elencoCadastroDuranteInscricao', 'prazoAlteracaoElencoDias', 'qrCodeEnabled', 'formularioInscricaoConfig'],
}

const SECOES_COM_TRAVA = new Set(['estrutura', 'classificacao', 'eliminatorias'])

export function categoryIdFromRequest(req: NextRequest) {
  const value = new URL(req.url).searchParams.get('categoriaCampeonatoId')
  return value && value.length > 0 ? value : null
}

export async function loadCategorySection(req: NextRequest, ligaId: number) {
  const categoryId = categoryIdFromRequest(req)
  if (!categoryId) return error('Selecione a categoria antes de configurar esta etapa.', 422)
  try {
    return success(await getCategoryConfiguration(ligaId, categoryId))
  } catch (cause) {
    if (cause instanceof CategoryScopeError) return error(cause.message, cause.status)
    return error('Não foi possível carregar a categoria.', 500)
  }
}

export async function saveCategorySection(args: {
  req: NextRequest
  ligaId: number
  organizadorId: string
  section: keyof typeof ALLOWED
  patch: Record<string, unknown>
  intent: SetupIntent
}) {
  const categoryId = categoryIdFromRequest(args.req)
  if (!categoryId) return error('Selecione a categoria antes de configurar esta etapa.', 422)
  try {
    const config = await getCategoryConfiguration(args.ligaId, categoryId)
    const allowed = new Set(ALLOWED[args.section])
    const patch: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(args.patch)) {
      if (!allowed.has(key)) continue
      if (key === 'elencoCadastroDuranteInscricao' && value !== true) continue
      patch[key] = value
    }
    if (SECOES_COM_TRAVA.has(args.section)) {
      const bloqueio = await categoriaComJogoIniciado(categoryId)
      if (bloqueio === 'erro') return error('Não foi possível conferir os jogos desta categoria.', 500)
      if (bloqueio) return error(MENSAGEM_EDICAO_BLOQUEADA, 409)
    }
    const { data, error: rpcError } = await db.rpc('salvar_configuracao_categoria', {
      p_liga_id: args.ligaId,
      p_categoria_id: categoryId,
      p_organizador_id: args.organizadorId,
      p_versao: config.versao,
      p_secao: args.section,
      p_patch: patch,
      p_concluir: args.intent === 'complete',
    })
    if (rpcError) {
      if (/Operacao iniciada/i.test(rpcError.message) && SECOES_COM_TRAVA.has(args.section)) {
        const bloqueio = await categoriaComJogoIniciado(categoryId)
        if (bloqueio === 'erro') return error('Não foi possível conferir os jogos desta categoria.', 500)
        if (bloqueio) return error(MENSAGEM_EDICAO_BLOQUEADA, 409)
        const gravada = await gravarCategoriaComEquipes(args.ligaId, categoryId, args.section, config, patch, args.intent)
        if (gravada instanceof Response) return gravada
        await espelharNaLiga(args.ligaId, patch)
        return success({ ...gravada, setupStatus: args.intent === 'complete' ? 'completed' : 'in-progress' })
      }
      const message = /Versao alterada/i.test(rpcError.message)
        ? 'A categoria foi atualizada em outra tela. Recarregue e tente de novo.'
        : 'A configuração da categoria não foi aceita. Revise os campos.'
      return error(message, /Versao alterada/i.test(rpcError.message) ? 409 : 422)
    }
    await espelharNaLiga(args.ligaId, patch)
    const saved = data && typeof data === 'object' ? data : config
    return success({ ...saved, setupStatus: args.intent === 'complete' ? 'completed' : 'in-progress' })
  } catch (cause) {
    if (cause instanceof CategoryScopeError) return error(cause.message, cause.status)
    console.error('[setup] erro ao salvar categoria', cause)
    return error('Não foi possível salvar a categoria.', 500)
  }
}

async function categoriaComJogoIniciado(categoryId: string) {
  const { data, error: consultaErro } = await db
    .from('Partida')
    .select('status,sumulaSubmetidaEm,sumulaAprovadaEm,setsPorA,setsPorB,vencedorId')
    .eq('categoriaCampeonatoId', categoryId)
  if (consultaErro) {
    console.error('[setup] erro ao conferir jogos da categoria', consultaErro)
    return 'erro' as const
  }
  return (data ?? []).some((jogo) => jogoImpedeEdicaoDaCategoria(jogo))
}

async function gravarCategoriaComEquipes(
  ligaId: number,
  categoryId: string,
  section: string,
  config: Record<string, any>,
  patch: Record<string, unknown>,
  intent: SetupIntent,
) {
  const efetivo = { ...config, ...patch }
  if (intent === 'complete') {
    const motivo = erroAoConcluirCategoria(section, efetivo)
    if (motivo) return error(motivo, 422)
  }
  const formulario = formularioInscricao(efetivo.formularioInscricaoConfig)
  const qr = validateQrPhotoNameDependency(efetivo.qrCodeEnabled === true, formulario?.atleta)
  if (qr.length > 0) return error(qr[0].message, 422)

  const alterados = camposAlterados(config, patch)
  let salva = config
  if (Object.keys(alterados).length > 0) {
    const { data, error: updateErro } = await db
      .from('CategoriaConfiguracao')
      .update(alterados)
      .eq('categoriaCampeonatoId', categoryId)
      .eq('ligaId', ligaId)
      .eq('versao', config.versao)
      .select('*')
      .maybeSingle()
    if (updateErro || !data) {
      console.error('[setup] versão da categoria mudou durante a gravação', updateErro)
      return error('A categoria foi atualizada em outra tela. Recarregue e tente de novo.', 409)
    }
    salva = data
  }

  const { data: linhas, error: secoesErro } = await db
    .from('CategoriaSetupSecao')
    .select('secao,status,revisaoConfirmada')
    .eq('categoriaCampeonatoId', categoryId)
  if (secoesErro) {
    console.error('[setup] erro ao ler seções da categoria', secoesErro)
    return error('Não foi possível salvar a categoria.', 500)
  }
  const antes = (linhas ?? []) as SecaoSetup[]
  const versaoAnterior = Number(config.versao)
  const versaoNova = Number(salva.versao)
  const depois = proximoEstadoSecoes({
    secoes: antes,
    secaoAtual: section,
    versaoAnterior,
    versaoNova,
    dependentes: secoesDependentes(section, alterados),
    concluir: intent === 'complete',
  })
  const porNome = new Map(antes.map((secao) => [secao.secao, secao]))
  for (const secao of depois) {
    const anterior = porNome.get(secao.secao)
    if (anterior && anterior.status === secao.status && anterior.revisaoConfirmada === secao.revisaoConfirmada) continue
    const linha: Record<string, unknown> = {
      ligaId,
      categoriaCampeonatoId: categoryId,
      secao: secao.secao,
      status: secao.status,
      revisaoConfirmada: secao.revisaoConfirmada,
      atualizadoEm: new Date().toISOString(),
    }
    if (!anterior || anterior.status !== secao.status) {
      linha.concluidoEm = secao.status === 'completed' ? new Date().toISOString() : null
    }
    const { error: secaoErro } = await db.from('CategoriaSetupSecao').upsert(linha, { onConflict: 'categoriaCampeonatoId,secao' })
    if (secaoErro) {
      console.error('[setup] erro ao atualizar seção da categoria', secaoErro)
      return error('Não foi possível salvar a categoria.', 500)
    }
  }
  const status = statusConfiguracaoDaCategoria(salva.formato, depois, versaoNova)
  const { error: statusErro } = await db
    .from('CategoriaCampeonato')
    .update({ statusConfiguracao: status })
    .eq('id', categoryId)
    .eq('ligaId', ligaId)
  if (statusErro) {
    console.error('[setup] erro ao atualizar status da categoria', statusErro)
    return error('Não foi possível salvar a categoria.', 500)
  }
  return salva
}

async function espelharNaLiga(ligaId: number, patch: Record<string, unknown>) {
  const campos = camposParaEspelharNaLiga(patch)
  if (Object.keys(campos).length === 0) return
  const { count, error: contagemErro } = await db
    .from('CategoriaCampeonato')
    .select('id', { count: 'exact', head: true })
    .eq('ligaId', ligaId)
    .is('removidaEm', null)
  if (contagemErro) throw contagemErro
  if (count !== 1) return
  const { error: ligaErro } = await db.from('Liga').update(campos).eq('id', ligaId)
  if (ligaErro) throw ligaErro
}

function formularioInscricao(valor: unknown) {
  const objeto = typeof valor === 'string' ? jsonSeguro(valor) : valor
  if (!objeto || typeof objeto !== 'object') return undefined
  const atleta = (objeto as { atleta?: unknown }).atleta
  if (!atleta || typeof atleta !== 'object') return undefined
  return { atleta: atleta as { nomeCompleto?: 'required' | 'optional' | 'disabled'; foto?: 'required' | 'optional' | 'disabled' } }
}

function jsonSeguro(valor: string) {
  try {
    return JSON.parse(valor)
  } catch {
    return null
  }
}
