// Prévia: resumo consolidado do campeonato + validação. Aceita dados
// parciais de propósito (não bloqueia até 100%) — o front define como
// exibir "N de 6 áreas disponíveis" a partir de `progress`.
import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { requireOwnedLigaForSetup, getStoredSectionStatuses } from '@/lib/championship-setup-access'
import { validateChampionshipSetup } from '@/lib/championship-setup-engine'
import { SECTION_ORDER, computeAllEffectiveStatuses, computeSetupProgress, type SetupSection } from '@/lib/championship-setup-status'
import { calculateChampionshipPrice, estimateMatchCount } from '@/lib/pricing'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ligaId = Number(id)
  const liga = await requireOwnedLigaForSetup(req, ligaId, '*')
  if (liga instanceof Response) return liga

  const [{ data: grupos }, { data: locais }, { count: aprovadasCount }, { count: partidasGeradas }, validation, stored] = await Promise.all([
    supabase.from('GrupoCampeonato').select('id,nome,ordem,classificados').eq('ligaId', ligaId).order('ordem', { ascending: true }),
    supabase.from('LigaLocal').select('id,nome,endereco,quadra').eq('ligaId', ligaId).order('ordem', { ascending: true }),
    supabase.from('InscricaoCampeonato').select('id', { count: 'exact', head: true }).eq('ligaId', ligaId).eq('status', 'APROVADA'),
    supabase.from('Partida').select('id', { count: 'exact', head: true }).eq('ligaId', ligaId),
    validateChampionshipSetup(ligaId),
    getStoredSectionStatuses(ligaId),
  ])

  const hasErrorsBySection = Object.fromEntries(
    SECTION_ORDER.map((section) => [section, (validation.perSecao[section] ?? []).some((issue) => issue.severity === 'error')]),
  ) as Record<SetupSection, boolean>
  const formato = liga.formato as string | null
  const effective = computeAllEffectiveStatuses(stored, hasErrorsBySection, formato)
  const progress = computeSetupProgress(effective, formato)

  // Valor autoritativo: o wizard calcula ao vivo com o mesmo módulo puro,
  // mas quem vale é este cálculo do servidor.
  const estimativaPartidas = estimateMatchCount({
    formato: liga.formato as string | null,
    quantidadeEquipes: liga.quantidadeEquipes as number | null,
    quantidadeGrupos: liga.quantidadeGrupos as number | null,
    turnoReturno: liga.turnoReturno as boolean | null,
    faseEliminatoria: liga.faseEliminatoria as string | null,
    disputaTerceiroLugar: liga.disputaTerceiroLugar as boolean | null,
  })
  const pricing = calculateChampionshipPrice({
    matchCount: estimativaPartidas.disponivel ? estimativaPartidas.total : 0,
    sumulaScoutsEnabled: liga.sumulaScoutsEnabled as boolean | null,
    qrCodeEnabled: liga.qrCodeEnabled as boolean | null,
  })

  return success({
    championship: {
      id: liga.id,
      nome: liga.nome,
      nomeCurto: liga.nomeCurto,
      subtitulo: liga.subtitulo,
      descricao: liga.descricao,
      logoUrl: liga.logoUrl,
      capaUrl: liga.capaUrl,
      status: liga.status,
    },
    structure: {
      quantidadeEquipes: liga.quantidadeEquipes,
      quantidadeEquipesMinima: liga.quantidadeEquipesMinima,
      quantidadeEquipesMaxima: liga.quantidadeEquipesMaxima,
      formato: liga.formato,
      quantidadeGrupos: liga.quantidadeGrupos,
      grupos: grupos ?? [],
      turnoReturno: liga.turnoReturno,
      setsFormato: liga.setsFormato,
      setsPorPartida: liga.setsPorPartida,
      pontosPorSet: liga.pontosPorSet,
      diferencaMinimaSet: liga.diferencaMinimaSet,
      tieBreakUltimoSet: liga.tieBreakUltimoSet,
      pontosUltimoSet: liga.pontosUltimoSet,
    },
    classification: {
      criteriosClassificacao: liga.criteriosClassificacao,
      pontuacaoResultado: liga.pontuacaoResultado,
      classificadosPorGrupo: liga.classificadosPorGrupo,
      melhoresClassificadosGerais: liga.melhoresClassificadosGerais,
    },
    knockout: {
      faseEliminatoria: liga.faseEliminatoria,
      metodoChaveamento: liga.metodoChaveamento,
      eliminatoriaIdaVolta: liga.eliminatoriaIdaVolta,
      disputaTerceiroLugar: liga.disputaTerceiroLugar,
      goldenSet: liga.goldenSet,
    },
    calendar: {
      dataInicio: liga.dataInicio,
      dataFim: liga.dataFim,
      locais: locais ?? [],
    },
    registration: {
      inscricoesAbertas: liga.inscricoesAbertas,
      inscricoesAberturaEm: liga.inscricoesAberturaEm,
      inscricoesEncerramentoEm: liga.inscricoesEncerramentoEm,
      limiteEquipes: liga.quantidadeEquipes,
      equipesAprovadas: aprovadasCount ?? 0,
      inscricaoAprovacaoAutomatica: liga.inscricaoAprovacaoAutomatica,
      elencoQuantidadeMinima: liga.elencoQuantidadeMinima,
      elencoQuantidadeMaxima: liga.elencoQuantidadeMaxima,
      qrCodeEnabled: liga.qrCodeEnabled,
      formularioInscricaoConfig: liga.formularioInscricaoConfig,
    },
    recursos: {
      sumulaScoutsEnabled: Boolean(liga.sumulaScoutsEnabled),
      qrCodeEnabled: Boolean(liga.qrCodeEnabled),
    },
    // `estimativaPartidas` é previsão a partir da configuração;
    // `partidasGeradas` é o número real já criado no banco. São diferentes
    // por natureza (a geração real usa as equipes aprovadas), então a UI
    // mostra os dois rotulados.
    estimativaPartidas,
    partidasGeradas: partidasGeradas ?? 0,
    pricing,
    pagamentoConfirmadoEm: (liga.pagamentoConfirmadoEm as string | null) ?? null,
    progress,
    sectionStatus: effective,
    validation: {
      isValid: validation.isValid,
      canPublish: validation.canPublish,
      errors: validation.errors,
      warnings: validation.warnings,
    },
  })
}
