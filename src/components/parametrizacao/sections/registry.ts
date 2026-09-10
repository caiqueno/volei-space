import type { ComponentType } from 'react'
import { InformacoesWizard } from './informacoes/InformacoesWizard'
import { EstruturaWizard } from './estrutura/EstruturaWizard'
import { ClassificacaoWizard } from './classificacao/ClassificacaoWizard'
import { EliminatoriasWizard } from './eliminatorias/EliminatoriasWizard'
import { CalendarioWizard } from './calendario/CalendarioWizard'
import { InscricoesWizard } from './inscricoes/InscricoesWizard'
import { PreviaView } from './previa/PreviaView'
import { SECTION_TITLES, CARD_TITLES, type SetupCardKey } from '@/lib/championship-setup-status'

export const SECTION_WIZARD_REGISTRY: Record<SetupCardKey, { component: ComponentType<{ ligaId: number }>; title: string }> = {
  informacoes: { component: InformacoesWizard, title: SECTION_TITLES.informacoes },
  estrutura: { component: EstruturaWizard, title: SECTION_TITLES.estrutura },
  classificacao: { component: ClassificacaoWizard, title: SECTION_TITLES.classificacao },
  eliminatorias: { component: EliminatoriasWizard, title: SECTION_TITLES.eliminatorias },
  calendario: { component: CalendarioWizard, title: SECTION_TITLES.calendario },
  inscricoes: { component: InscricoesWizard, title: SECTION_TITLES.inscricoes },
  previa: { component: PreviaView, title: CARD_TITLES.previa },
}

export function isValidSetupSectionSlug(slug: string): slug is SetupCardKey {
  return slug in SECTION_WIZARD_REGISTRY
}
