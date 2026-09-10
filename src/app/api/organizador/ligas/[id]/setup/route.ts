// GET overview da Central de Parametrização: os 7 cards (status efetivo +
// resumo) + progresso geral ("N de 6" / %). Não confundir com
// src/app/api/organizador/ligas/[id]/estrutura/route.ts (distribuição real).
import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { requireOwnedLigaForSetup, getStoredSectionStatuses, isLigaEmAndamento } from '@/lib/championship-setup-access'
import { validateChampionshipSetup } from '@/lib/championship-setup-engine'
import {
  SECTION_ORDER,
  CARD_TITLES,
  computeAllEffectiveStatuses,
  computeSetupProgress,
  type SetupCardKey,
  type SetupSection,
} from '@/lib/championship-setup-status'
import { formatEliminatoryPhase } from '@/lib/eliminatorias'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ligaId = Number(id)

  const liga = await requireOwnedLigaForSetup(
    req,
    ligaId,
    'id,nome,status,subtitulo,quantidadeEquipes,quantidadeGrupos,formato,turnoReturno,faseEliminatoria,disputaTerceiroLugar,dataInicio,dataFim,inscricoesAbertas,qrCodeEnabled,sumulaScoutsEnabled',
  )
  if (liga instanceof Response) return liga

  const [stored, validation, ligaEmAndamento] = await Promise.all([
    getStoredSectionStatuses(ligaId),
    validateChampionshipSetup(ligaId),
    isLigaEmAndamento(ligaId, liga.status as string | null),
  ])

  // Só 'error' vira attention-required no card — 'warning' fica visível na
  // Prévia (validation.warnings) sem derrubar uma sessão já completed.
  const hasErrorsBySection = Object.fromEntries(
    SECTION_ORDER.map((section) => [section, (validation.perSecao[section] ?? []).some((issue) => issue.severity === 'error')]),
  ) as Record<SetupSection, boolean>

  const effective = computeAllEffectiveStatuses(stored, hasErrorsBySection)
  const progress = computeSetupProgress(effective)

  const summaryBySection: Record<SetupSection, string | undefined> = {
    informacoes: effective.informacoes === 'not-started' ? undefined : (liga.subtitulo as string) || 'Dados principais configurados',
    estrutura: effective.estrutura === 'not-started'
      ? undefined
      : [
        liga.quantidadeEquipes != null ? `${liga.quantidadeEquipes} equipes` : null,
        liga.quantidadeGrupos != null ? `${liga.quantidadeGrupos} grupo(s)` : null,
        liga.turnoReturno ? 'Ida e volta' : null,
      ].filter(Boolean).join(' · ') || undefined,
    // A mensagem de erro só aparece quando o status efetivo já reflete um
    // problema real (attention-required/blocked) — uma sessão not-started
    // não deve exibir o erro de validação cruzada antes do organizador
    // sequer ter tocado nela (contradiria o próprio rótulo "não iniciado").
    classificacao: effective.classificacao === 'not-started'
      ? undefined
      : (validation.perSecao.classificacao[0]?.message ?? 'Critérios de desempate configurados'),
    eliminatorias: effective.eliminatorias === 'not-started'
      ? undefined
      : (validation.perSecao.eliminatorias[0]?.message ?? formatEliminatoryPhase(liga.faseEliminatoria as string | null)),
    calendario: liga.dataInicio && liga.dataFim ? 'Datas definidas' : undefined,
    inscricoes: effective.inscricoes === 'not-started' ? undefined : (liga.inscricoesAbertas ? 'Inscrições abertas' : 'Inscrições fechadas'),
  }

  const cards: Array<{ key: SetupCardKey; title: string; status: string; summary?: string; href: string }> = [
    ...SECTION_ORDER.map((section) => ({
      key: section as SetupCardKey,
      title: CARD_TITLES[section],
      status: effective[section],
      summary: summaryBySection[section],
      href: `/painel/parametrizacao/${section}?ligaId=${ligaId}`,
    })),
    {
      key: 'previa',
      title: CARD_TITLES.previa,
      status: validation.isValid ? 'completed' : 'attention-required',
      summary: validation.isValid ? 'Pronta para consulta' : `${progress.completedSections} de ${progress.totalSections} áreas disponíveis`,
      href: `/painel/parametrizacao/previa?ligaId=${ligaId}`,
    },
  ]

  return success({
    ligaId,
    nome: liga.nome,
    // Com o campeonato em andamento, decisões estruturais ficam travadas —
    // regra que antes só existia no modal de /painel e que a Central precisa
    // reproduzir (a API também barra, ver rejectLockedFields).
    ligaEmAndamento,
    recursos: {
      sumulaScoutsEnabled: Boolean(liga.sumulaScoutsEnabled),
      qrCodeEnabled: Boolean(liga.qrCodeEnabled),
    },
    progress,
    cards,
  })
}
