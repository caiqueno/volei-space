import type { ComponentType } from 'react'
import { InformacoesWizard } from './informacoes/InformacoesWizard'
import { EstruturaWizard } from './estrutura/EstruturaWizard'
import { ClassificacaoWizard } from './classificacao/ClassificacaoWizard'
import { EliminatoriasWizard } from './eliminatorias/EliminatoriasWizard'
import { CalendarioWizard } from './calendario/CalendarioWizard'
import { InscricoesWizard } from './inscricoes/InscricoesWizard'
import { PreviaView } from './previa/PreviaView'
import { PagamentoView } from './pagamento/PagamentoView'
import { CategoriasWizard } from './categorias/CategoriasWizard'
import { SECTION_TITLES, CARD_TITLES, type SetupCardKey } from '@/lib/championship-setup-status'

// `pagamento` fica de fora de CARD_ORDER de propósito — é uma tela de ação
// (checkout), não uma seção com status persistente, então não deve aparecer
// como 8º card na Central nem na trilha do SetupSectionNav. Ainda assim
// precisa estar aqui para a rota dinâmica /painel/parametrizacao/[secao]
// conseguir resolvê-la.
export const SECTION_WIZARD_REGISTRY: Record<SetupCardKey, { component: ComponentType<{ ligaId: number; etapaInicial?: number }>; title: string }> = {
  informacoes: { component: InformacoesWizard, title: SECTION_TITLES.informacoes },
  estrutura: { component: EstruturaWizard, title: SECTION_TITLES.estrutura },
  classificacao: { component: ClassificacaoWizard, title: SECTION_TITLES.classificacao },
  eliminatorias: { component: EliminatoriasWizard, title: SECTION_TITLES.eliminatorias },
  calendario: { component: CalendarioWizard, title: SECTION_TITLES.calendario },
  inscricoes: { component: InscricoesWizard, title: SECTION_TITLES.inscricoes },
  previa: { component: PreviaView, title: CARD_TITLES.previa },
  pagamento: { component: PagamentoView, title: CARD_TITLES.pagamento },
  categorias: { component: CategoriasWizard, title: CARD_TITLES.categorias },
}

export function isValidSetupSectionSlug(slug: string): slug is SetupCardKey {
  return slug in SECTION_WIZARD_REGISTRY
}
