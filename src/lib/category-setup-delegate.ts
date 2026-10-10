import { NextRequest } from 'next/server'
import { error, success } from '@/lib/api-response'
import { CategoryScopeError, getCategoryConfiguration } from '@/lib/category-scope'
import {
  camposAlterados,
  camposParaEspelharNaLiga,
  erroAoConcluirCategoria,
  motivoBloqueioEdicao,
  proximoEstadoSecoes,
  type JogoDaCategoria,
  secoesDependentes,
  statusConfiguracaoDaCategoria,
  type SecaoSetup,
} from '@/lib/configuracao-categoria-edicao'
import type { SetupIntent } from '@/lib/championship-setup-status'
import { validateQrPhotoNameDependency } from '@/lib/championship-validation'
import { supabaseAdmin as db } from '@/lib/supabase-admin'
import { colunaElegibilidadeAusente, mensagemFaixaIdade, separarElegibilidade } from '@/lib/elegibilidade-categoria'
import { criteriosPersistiveis, erroRecusaQuociente } from '@/lib/classificacao'
import { colunaDeSetsQuartasOitavasAusente, semSetsQuartasOitavas, soSetsQuartasOitavas } from '@/lib/sets-por-fase'
import { colunaDeLimiteSubstituicoesAusente, semLimiteSubstituicoes, soLimiteSubstituicoes } from '@/lib/sumula-regras'
import { colunaDeAlertaRodizioAusente, semAlertaRodizio, soAlertaRodizio } from '@/lib/rodizio-sumula'
import { colunaDeTemposAusente, semTempos, soTempos } from '@/lib/tempos-sumula'
import { colunaDeLesaoAusente, semLesao, soLesao } from '@/lib/lesao-sumula'
import { colunaDeLiberoAusente, semLibero, soLibero } from '@/lib/libero-sumula'

const ALLOWED: Record<string, string[]> = {
  estrutura: ['quantidadeEquipes', 'quantidadeEquipesMinima', 'quantidadeEquipesMaxima', 'formato', 'quantidadeGrupos', 'turnoReturno', 'setsFormato', 'setsPorPartida', 'pontosPorSet', 'diferencaMinimaSet', 'tieBreakUltimoSet', 'pontosUltimoSet', 'terceiroSetObrigatorio', 'sumulaScoutsEnabled', 'limiteSubstituicoesPorSet', 'alertaRodizioIlegal', 'limiteTemposPorSet', 'separarTempos', 'tempoMedico', 'substituicaoPorLesao', 'exigirLiberoInicial', 'quantidadeLiberos'],
  classificacao: ['criteriosClassificacao', 'classificadosPorGrupo', 'melhoresClassificadosGerais', 'pontosVencedorMargem1', 'pontosPerdedorMargem1', 'pontosVencedorMargem2', 'pontosPerdedorMargem2', 'woSetsVencedor', 'woSetsPerdedor', 'woPontosSetVencedor', 'woPontosSetPerdedor', 'woPunicaoPontos'],
  eliminatorias: ['faseEliminatoria', 'metodoChaveamento', 'eliminatoriaIdaVolta', 'disputaTerceiroLugar', 'goldenSet', 'setsPorPartidaFinal', 'setsPorPartidaSemifinal', 'setsPorPartidaQuartas', 'setsPorPartidaOitavas', 'setsPorPartidaTerceiroLugar'],
  calendario: ['dataInicio', 'dataFim'],
  inscricoes: ['inscricoesAbertas', 'inscricoesAberturaEm', 'inscricoesEncerramentoEm', 'inscricaoPermiteEdicaoAposEnvio', 'inscricaoPrazoEdicaoDias', 'elencoQuantidadeMinima', 'elencoQuantidadeMaxima', 'elencoCadastroDuranteInscricao', 'prazoAlteracaoElencoDias', 'qrCodeEnabled', 'formularioInscricaoConfig', 'genero', 'idadeMinima', 'idadeMaxima'],
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
    const separado = separarElegibilidade(patch)
    const faixa = mensagemFaixaIdade(separado.elegibilidade)
    if (faixa) return error(faixa, 422)
    const patchRpc = separado.resto
    const setsNovos = soSetsQuartasOitavas(patchRpc)
    const limiteNovo = soLimiteSubstituicoes(patchRpc)
    const alertaNovo = soAlertaRodizio(patchRpc)
    const temposNovos = soTempos(patchRpc)
    const lesaoNova = soLesao(patchRpc)
    const liberoNovo = soLibero(patchRpc)
    let patchEfetivo = semLibero(semLesao(semTempos(semAlertaRodizio(semLimiteSubstituicoes(semSetsQuartasOitavas(patchRpc))))))
    if (SECOES_COM_TRAVA.has(args.section)) {
      const jogos = await jogosDaCategoria(categoryId)
      if (jogos === 'erro') return error('Não foi possível conferir os jogos desta categoria.', 500)
      const motivo = motivoBloqueioEdicao(args.section, patchRpc, jogos)
      if (motivo) return error(motivo, 409)
    }
    let { data, error: rpcError } = await db.rpc('salvar_configuracao_categoria', {
      p_liga_id: args.ligaId,
      p_categoria_id: categoryId,
      p_organizador_id: args.organizadorId,
      p_versao: config.versao,
      p_secao: args.section,
      p_patch: patchEfetivo,
      p_concluir: args.intent === 'complete',
    })
    if (rpcError && erroRecusaQuociente(rpcError)) {
      const semQuociente = criteriosPersistiveis(patchEfetivo.criteriosClassificacao)
      if (semQuociente !== patchEfetivo.criteriosClassificacao) {
        patchEfetivo = { ...patchEfetivo, criteriosClassificacao: semQuociente }
        const segunda = await db.rpc('salvar_configuracao_categoria', {
          p_liga_id: args.ligaId,
          p_categoria_id: categoryId,
          p_organizador_id: args.organizadorId,
          p_versao: config.versao,
          p_secao: args.section,
          p_patch: patchEfetivo,
          p_concluir: args.intent === 'complete',
        })
        data = segunda.data
        rpcError = segunda.error
      }
    }
    if (rpcError) {
      if (/Operacao iniciada/i.test(rpcError.message) && SECOES_COM_TRAVA.has(args.section)) {
        const jogos = await jogosDaCategoria(categoryId)
        if (jogos === 'erro') return error('Não foi possível conferir os jogos desta categoria.', 500)
        const motivo = motivoBloqueioEdicao(args.section, patchRpc, jogos)
        if (motivo) return error(motivo, 409)
        const gravada = await gravarCategoriaComEquipes(args.ligaId, categoryId, args.section, config, patchEfetivo, args.intent)
        if (gravada instanceof Response) return gravada
        const comSets = await gravarSetsQuartasOitavas(args.ligaId, categoryId, setsNovos, gravada)
        if (comSets instanceof Response) return comSets
        const comLimite = await gravarLimiteSubstituicoes(args.ligaId, categoryId, limiteNovo, comSets)
        if (comLimite instanceof Response) return comLimite
        const comAlerta = await gravarAlertaRodizio(args.ligaId, categoryId, alertaNovo, comLimite)
        if (comAlerta instanceof Response) return comAlerta
        const comTempos = await gravarTempos(args.ligaId, categoryId, temposNovos, comAlerta)
        if (comTempos instanceof Response) return comTempos
        const comLesao = await gravarLesao(args.ligaId, categoryId, lesaoNova, comTempos)
        if (comLesao instanceof Response) return comLesao
        const comLibero = await gravarLibero(args.ligaId, categoryId, liberoNovo, comLesao)
        if (comLibero instanceof Response) return comLibero
        const comElegibilidade = await gravarElegibilidade(args.ligaId, categoryId, separado.elegibilidade, comLibero)
        if (comElegibilidade instanceof Response) return comElegibilidade
        await espelharNaLiga(args.ligaId, { ...patchEfetivo, ...setsNovos, ...limiteNovo, ...alertaNovo, ...temposNovos, ...lesaoNova, ...liberoNovo })
        return success({ ...comElegibilidade, setupStatus: args.intent === 'complete' ? 'completed' : 'in-progress' })
      }
      const message = /Versao alterada/i.test(rpcError.message)
        ? 'A categoria foi atualizada em outra tela. Recarregue e tente de novo.'
        : 'A configuração da categoria não foi aceita. Revise os campos.'
      return error(message, /Versao alterada/i.test(rpcError.message) ? 409 : 422)
    }
    const salva = data && typeof data === 'object' ? data as Record<string, unknown> : config
    const comSets = await gravarSetsQuartasOitavas(args.ligaId, categoryId, setsNovos, salva)
    if (comSets instanceof Response) return comSets
    const comLimite = await gravarLimiteSubstituicoes(args.ligaId, categoryId, limiteNovo, comSets)
    if (comLimite instanceof Response) return comLimite
    const comAlerta = await gravarAlertaRodizio(args.ligaId, categoryId, alertaNovo, comLimite)
    if (comAlerta instanceof Response) return comAlerta
    const comTempos = await gravarTempos(args.ligaId, categoryId, temposNovos, comAlerta)
    if (comTempos instanceof Response) return comTempos
    const comLesao = await gravarLesao(args.ligaId, categoryId, lesaoNova, comTempos)
    if (comLesao instanceof Response) return comLesao
    const comLibero = await gravarLibero(args.ligaId, categoryId, liberoNovo, comLesao)
    if (comLibero instanceof Response) return comLibero
    const comElegibilidade = await gravarElegibilidade(args.ligaId, categoryId, separado.elegibilidade, comLibero)
    if (comElegibilidade instanceof Response) return comElegibilidade
    await espelharNaLiga(args.ligaId, { ...patchEfetivo, ...setsNovos, ...limiteNovo, ...alertaNovo, ...temposNovos, ...lesaoNova, ...liberoNovo })
    return success({ ...comElegibilidade, setupStatus: args.intent === 'complete' ? 'completed' : 'in-progress' })
  } catch (cause) {
    if (cause instanceof CategoryScopeError) return error(cause.message, cause.status)
    console.error('[setup] erro ao salvar categoria', cause)
    return error('Não foi possível salvar a categoria.', 500)
  }
}

async function jogosDaCategoria(categoryId: string) {
  const { data, error: consultaErro } = await db
    .from('Partida')
    .select('fase,status,sumulaSubmetidaEm,sumulaAprovadaEm,setsPorA,setsPorB,vencedorId')
    .eq('categoriaCampeonatoId', categoryId)
  if (consultaErro) {
    console.error('[setup] erro ao conferir jogos da categoria', consultaErro)
    return 'erro' as const
  }
  return (data ?? []) as JogoDaCategoria[]
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
    const gravar = (corpo: Record<string, unknown>) => db
      .from('CategoriaConfiguracao')
      .update(corpo)
      .eq('categoriaCampeonatoId', categoryId)
      .eq('ligaId', ligaId)
      .eq('versao', config.versao)
      .select('*')
      .maybeSingle()
    let corpo = alterados
    let { data, error: updateErro } = await gravar(corpo)
    if (updateErro && erroRecusaQuociente(updateErro)) {
      const semQuociente = criteriosPersistiveis(corpo.criteriosClassificacao)
      if (semQuociente !== corpo.criteriosClassificacao) {
        corpo = { ...corpo, criteriosClassificacao: semQuociente }
        const segunda = await gravar(corpo)
        data = segunda.data
        updateErro = segunda.error
      }
    }
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

async function gravarElegibilidade(
  ligaId: number,
  categoryId: string,
  elegibilidade: Record<string, unknown>,
  salva: Record<string, unknown>,
) {
  if (Object.keys(elegibilidade).length === 0) return salva
  const { error: updateErro } = await db
    .from('CategoriaConfiguracao')
    .update(elegibilidade)
    .eq('categoriaCampeonatoId', categoryId)
    .eq('ligaId', ligaId)
  if (!updateErro) return { ...salva, ...elegibilidade }
  if (colunaElegibilidadeAusente(updateErro)) {
    console.error('[setup] gênero e idade ainda não existem nesta base; a inscrição segue sem essa regra')
    return salva
  }
  console.error('[setup] erro ao gravar gênero ou idade', updateErro)
  return error('Não foi possível gravar gênero ou idade da categoria.', 422)
}

async function gravarSetsQuartasOitavas(
  ligaId: number,
  categoryId: string,
  campos: Record<string, unknown>,
  salva: Record<string, unknown>,
) {
  if (Object.keys(campos).length === 0) return salva
  const { data, error: updateErro } = await db
    .from('CategoriaConfiguracao')
    .update(campos)
    .eq('categoriaCampeonatoId', categoryId)
    .eq('ligaId', ligaId)
    .select('*')
    .maybeSingle()
  if (!updateErro && data) return data
  if (colunaDeSetsQuartasOitavasAusente(updateErro)) {
    console.error('[setup] sets de quartas e oitavas ainda não existem nesta base; a fase segue com a quantidade do campeonato')
    return salva
  }
  console.error('[setup] erro ao gravar sets de quartas ou oitavas', updateErro)
  return error('Não foi possível gravar a quantidade de sets de quartas ou oitavas.', 422)
}

async function gravarLimiteSubstituicoes(
  ligaId: number,
  categoryId: string,
  campos: Record<string, unknown>,
  salva: Record<string, unknown>,
) {
  if (Object.keys(campos).length === 0) return salva
  const { data, error: updateErro } = await db
    .from('CategoriaConfiguracao')
    .update(campos)
    .eq('categoriaCampeonatoId', categoryId)
    .eq('ligaId', ligaId)
    .select('*')
    .maybeSingle()
  if (!updateErro && data) return data
  if (colunaDeLimiteSubstituicoesAusente(updateErro)) {
    console.error('[setup] limite de substituições ainda não existe nesta base; a súmula segue com 8')
    return salva
  }
  console.error('[setup] erro ao gravar limite de substituições', updateErro)
  return error('Não foi possível gravar o limite de substituições.', 422)
}

async function gravarAlertaRodizio(
  ligaId: number,
  categoryId: string,
  campos: Record<string, unknown>,
  salva: Record<string, unknown>,
) {
  if (Object.keys(campos).length === 0) return salva
  const { data, error: updateErro } = await db
    .from('CategoriaConfiguracao')
    .update(campos)
    .eq('categoriaCampeonatoId', categoryId)
    .eq('ligaId', ligaId)
    .select('*')
    .maybeSingle()
  if (!updateErro && data) return data
  if (colunaDeAlertaRodizioAusente(updateErro)) {
    console.error('[setup] alerta de rodízio ainda não existe nesta base; a súmula segue sem aviso')
    return salva
  }
  console.error('[setup] erro ao gravar alerta de rodízio', updateErro)
  return error('Não foi possível gravar o alerta de rodízio.', 422)
}

async function gravarTempos(
  ligaId: number,
  categoryId: string,
  campos: Record<string, unknown>,
  salva: Record<string, unknown>,
) {
  if (Object.keys(campos).length === 0) return salva
  const { data, error: updateErro } = await db
    .from('CategoriaConfiguracao')
    .update(campos)
    .eq('categoriaCampeonatoId', categoryId)
    .eq('ligaId', ligaId)
    .select('*')
    .maybeSingle()
  if (!updateErro && data) return data
  if (colunaDeTemposAusente(updateErro)) {
    console.error('[setup] tempos ainda não existem nesta base; a súmula segue com 2')
    return salva
  }
  console.error('[setup] erro ao gravar tempos', updateErro)
  return error('Não foi possível gravar os tempos.', 422)
}

async function gravarLesao(
  ligaId: number,
  categoryId: string,
  campos: Record<string, unknown>,
  salva: Record<string, unknown>,
) {
  if (Object.keys(campos).length === 0) return salva
  const { data, error: updateErro } = await db
    .from('CategoriaConfiguracao')
    .update(campos)
    .eq('categoriaCampeonatoId', categoryId)
    .eq('ligaId', ligaId)
    .select('*')
    .maybeSingle()
  if (!updateErro && data) return data
  if (colunaDeLesaoAusente(updateErro)) {
    console.error('[setup] lesão ainda não existe nesta base; a súmula segue sem tempo médico e sem substituição excepcional')
    return salva
  }
  console.error('[setup] erro ao gravar lesão', updateErro)
  return error('Não foi possível gravar o tempo médico ou a substituição por lesão.', 422)
}

async function gravarLibero(
  ligaId: number,
  categoryId: string,
  campos: Record<string, unknown>,
  salva: Record<string, unknown>,
) {
  if (Object.keys(campos).length === 0) return salva
  const { data, error: updateErro } = await db
    .from('CategoriaConfiguracao')
    .update(campos)
    .eq('categoriaCampeonatoId', categoryId)
    .eq('ligaId', ligaId)
    .select('*')
    .maybeSingle()
  if (!updateErro && data) return data
  if (colunaDeLiberoAusente(updateErro)) {
    console.error('[setup] líbero configurável ainda não existe nesta base; a súmula segue pedindo um líbero inicial')
    return salva
  }
  console.error('[setup] erro ao gravar líbero', updateErro)
  return error('Não foi possível gravar a regra do líbero.', 422)
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
  let corpo = campos
  for (let tentativa = 0; tentativa < 9 && Object.keys(corpo).length > 0; tentativa += 1) {
    const resultado = await db.from('Liga').update(corpo).eq('id', ligaId)
    if (!resultado.error) return
    const reduzido = enxugarEspelhoDaLiga(corpo, resultado.error)
    if (reduzido === corpo) throw resultado.error
    corpo = reduzido
  }
}

function enxugarEspelhoDaLiga(corpo: Record<string, unknown>, erro: { message?: string; code?: string; details?: string }) {
  let atual = corpo
  if (colunaDeSetsQuartasOitavasAusente(erro)) atual = semSetsQuartasOitavas(atual)
  if (colunaDeLimiteSubstituicoesAusente(erro)) atual = semLimiteSubstituicoes(atual)
  if (colunaDeAlertaRodizioAusente(erro)) atual = semAlertaRodizio(atual)
  if (colunaDeTemposAusente(erro)) atual = semTempos(atual)
  if (colunaDeLesaoAusente(erro)) atual = semLesao(atual)
  if (colunaDeLiberoAusente(erro)) atual = semLibero(atual)
  return atual
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
