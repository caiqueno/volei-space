'use client'

import type { ReactNode } from 'react'
import { useParametrizacaoNoPainel } from '../PainelParametrizacaoContext'
import { CampeonatosRolagemDaSecao } from '../CampeonatosRolagem'
import { SetupSectionNav } from './SetupSectionNav'
import { WizardAutosaveStatus } from './WizardAutosaveStatus'
import type { AutosaveStatus } from './useSectionWizard'

// Casca de 2 colunas de cada macroetapa: trilho com as 7 seções à esquerda,
// painel do wizard à direita. Mesma largura do cabeçalho (max-w-7xl).
export function SectionWizardLayout({
  ligaId,
  section,
  title,
  subtitle,
  autosaveStatus,
  autosaveError,
  priceSlot,
  embedded = false,
  children,
}: {
  ligaId: number
  section: string
  title: string
  subtitle?: string
  autosaveStatus: AutosaveStatus
  autosaveError?: string | null
  priceSlot?: ReactNode
  embedded?: boolean
  children: ReactNode
}) {
  const noPainel = useParametrizacaoNoPainel()
  if (embedded || noPainel) {
    return (
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-black text-white md:text-3xl">{title}</h2>
            {subtitle && <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">{subtitle}</p>}
          </div>
          <div className="shrink-0 pt-1">
            <WizardAutosaveStatus status={autosaveStatus} errorMessage={autosaveError} />
          </div>
        </div>
        <div className="luva-card mt-6 rounded-2xl p-5">{children}</div>
        {priceSlot}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex flex-col gap-8 lg:flex-row">
        <aside className="lg:w-64 lg:shrink-0">
          <SetupSectionNav ligaId={ligaId} activeSection={section} />
        </aside>

        <div className="min-w-0 flex-1 lg:max-w-3xl">
          <CampeonatosRolagemDaSecao ligaId={ligaId} secao={section} />
          <div className="mt-6 flex items-start justify-between gap-4">
            <div>
              <p className="luva-kicker">Parametrização do campeonato</p>
              <h1 className="mt-2 font-display text-2xl font-black text-white md:text-3xl">{title}</h1>
              {subtitle && <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">{subtitle}</p>}
            </div>
            <div className="shrink-0 pt-1">
              <WizardAutosaveStatus status={autosaveStatus} errorMessage={autosaveError} />
            </div>
          </div>

          <div className="luva-card mt-6 rounded-2xl p-5">{children}</div>

          {priceSlot}
        </div>
      </div>
    </div>
  )
}
