'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { SetupSectionNav } from '../../wizard/SetupSectionNav'
import { PricingBreakdown } from '../../pricing/PricingBreakdown'
import { FormAlert } from '../../ui/FormAlert'
import PageLoading from '@/components/ui/page-loading'
import { formatDateBr } from '@/lib/date-brazil'
import { formatEliminatoryPhase } from '@/lib/eliminatorias'
import { SECTION_TITLES } from '@/lib/championship-setup-status'
import type { ChampionshipPreviaDTO } from '@/types/championship-setup'

export function PreviaView({ ligaId }: { ligaId: number }) {
  const [previa, setPrevia] = useState<ChampionshipPreviaDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/organizador/ligas/${ligaId}/setup/previa`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Erro ao carregar a prévia.')
        return payload.data as ChampionshipPreviaDTO
      })
      .then((loaded) => {
        if (!cancelled) setPrevia(loaded)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Erro ao carregar a prévia.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [ligaId])

  if (loading) return <PageLoading label="Carregando prévia..." />
  if (loadError || !previa) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <FormAlert variant="error">{loadError ?? 'Campeonato não encontrado.'}</FormAlert>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-8 lg:flex-row">
        <aside className="lg:w-64 lg:shrink-0">
          <SetupSectionNav ligaId={ligaId} activeSection="previa" />
        </aside>

        <div className="min-w-0 flex-1 lg:max-w-3xl">
          <p className="luva-kicker">Parametrização do campeonato</p>
          <h1 className="mt-2 font-display text-2xl font-black text-white md:text-3xl">Prévia</h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">
            Resumo consolidado — {previa.progress.completedSections} de {previa.progress.totalSections} áreas disponíveis. Aceita dados parciais.
          </p>

          <div className="mt-6 grid gap-4">
            {previa.validation.isValid ? (
              <FormAlert variant="success">
                <p className="font-black">Configuração válida — o campeonato pode ser publicado.</p>
              </FormAlert>
            ) : (
              <FormAlert variant="error">
                <p className="font-black">Ainda há pendências antes de publicar:</p>
                <ul className="mt-1 list-disc pl-4">
                  {previa.validation.errors.map((issue) => (
                    <li key={`${issue.section}-${issue.code}`}>
                      {SECTION_TITLES[issue.section as keyof typeof SECTION_TITLES] ?? issue.section}: {issue.message}{' '}
                      <Link href={`/painel/parametrizacao/${issue.section}?ligaId=${ligaId}`} className="underline">
                        corrigir
                      </Link>
                    </li>
                  ))}
                </ul>
              </FormAlert>
            )}

            {previa.validation.warnings.length > 0 && (
              <FormAlert variant="info">
                <ul className="list-disc pl-4">
                  {previa.validation.warnings.map((issue) => (
                    <li key={`${issue.section}-${issue.code}`}>{issue.message}</li>
                  ))}
                </ul>
              </FormAlert>
            )}

            <SummaryCard title="Informações" href={`/painel/parametrizacao/informacoes?ligaId=${ligaId}`}>
              <SummaryRow label="Nome" value={previa.championship.nome} />
              <SummaryRow label="Status" value={previa.championship.status} />
            </SummaryCard>

            <SummaryCard title="Estrutura" href={`/painel/parametrizacao/estrutura?ligaId=${ligaId}`}>
              <SummaryRow label="Formato" value={previa.structure.formato ?? 'Não definido'} />
              <SummaryRow label="Quantidade de Equipes" value={previa.structure.quantidadeEquipes != null ? String(previa.structure.quantidadeEquipes) : 'Não definido'} />
              <SummaryRow label="Grupos" value={previa.structure.grupos.length > 0 ? previa.structure.grupos.map((g) => g.nome).join(', ') : String(previa.structure.quantidadeGrupos ?? 1)} />
              <SummaryRow label="Súmula Digital + Scouts" value={previa.recursos.sumulaScoutsEnabled ? 'Contratado' : 'Não contratado'} />
            </SummaryCard>

            <SummaryCard title="Classificação" href={`/painel/parametrizacao/classificacao?ligaId=${ligaId}`}>
              <SummaryRow label="Classificados por grupo" value={String(previa.classification.classificadosPorGrupo ?? 0)} />
              <SummaryRow label="Melhores classificados gerais" value={String(previa.classification.melhoresClassificadosGerais)} />
            </SummaryCard>

            <SummaryCard title="Eliminatórias" href={`/painel/parametrizacao/eliminatorias?ligaId=${ligaId}`}>
              <SummaryRow label="Fase inicial" value={formatEliminatoryPhase(previa.knockout.faseEliminatoria)} />
              <SummaryRow label="Formato" value={previa.knockout.eliminatoriaIdaVolta ? 'Ida e volta' : 'Jogo único'} />
            </SummaryCard>

            <SummaryCard title="Calendário e local" href={`/painel/parametrizacao/calendario?ligaId=${ligaId}`}>
              <SummaryRow label="Período" value={`${formatDateBr(previa.calendar.dataInicio)} a ${formatDateBr(previa.calendar.dataFim)}`} />
              <SummaryRow label="Locais" value={previa.calendar.locais.length > 0 ? previa.calendar.locais.map((l) => l.nome).join(', ') : 'A definir'} />
            </SummaryCard>

            <SummaryCard title="Inscrições" href={`/painel/parametrizacao/inscricoes?ligaId=${ligaId}`}>
              <SummaryRow label="Limite de equipes" value={previa.registration.limiteEquipes != null ? String(previa.registration.limiteEquipes) : 'Não definido'} />
              <SummaryRow label="Equipes aprovadas" value={String(previa.registration.equipesAprovadas)} />
              <SummaryRow label="QR Code" value={previa.recursos.qrCodeEnabled ? 'Ativado' : 'Desativado'} />
            </SummaryCard>

            <PricingBreakdown pricing={previa.pricing} estimativaPartidas={previa.estimativaPartidas} partidasGeradas={previa.partidasGeradas} />
          </div>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <div className="luva-card rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-base font-black text-white">{title}</p>
        <Link href={href} className="text-xs font-black uppercase tracking-[0.12em] text-luva-amber hover:underline">
          Corrigir
        </Link>
      </div>
      <div className="mt-3 grid gap-2">{children}</div>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <p className="font-semibold text-slate-400">{label}</p>
      <p className="text-right font-bold text-white">{value}</p>
    </div>
  )
}
