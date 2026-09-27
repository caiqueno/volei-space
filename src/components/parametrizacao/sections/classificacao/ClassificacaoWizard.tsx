'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { revealMissingFields } from '../../wizard/missing-fields'
import { useParametrizacaoNoPainel } from '../../PainelParametrizacaoContext'
import { SectionWizardLayout } from '../../wizard/SectionWizardLayout'
import { WizardStepper, type WizardStepDef } from '../../wizard/WizardStepper'
import { WizardNavigation } from '../../wizard/WizardNavigation'
import { useSectionWizard } from '../../wizard/useSectionWizard'
import { Field } from '../../ui/Field'
import { NumberInput } from '../../ui/NumberInput'
import { OrderedCriteriaList } from '../../ui/OrderedCriteriaList'
import { FormAlert } from '../../ui/FormAlert'
import { PricingSummary } from '../../pricing/PricingSummary'
import PageLoading from '@/components/ui/page-loading'
import { FloatingLabelNumberInput } from '@/components/ui/floating-label'
import type { ClassificacaoSectionDTO } from '@/types/championship-setup'
import { getExamplePontuacaoResultado } from '@/lib/championship-setup-defaults'

const STEPS: WizardStepDef[] = [
  { key: 'pontuacao', title: 'Sistema de pontuação' },
  { key: 'criterios', title: 'Critérios de desempate' },
  { key: 'classificados', title: 'Classificados' },
  { key: 'revisao', title: 'Revisão' },
]

function parseCriterios(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

export function ClassificacaoWizard({ ligaId }: { ligaId: number }) {
  const router = useRouter()
  const noPainel = useParametrizacaoNoPainel()
  const { data, loading, loadError, autosaveStatus, autosaveError, updateNow, flush, complete } =
    useSectionWizard<ClassificacaoSectionDTO>('classificacao', `/api/organizador/ligas/${ligaId}/setup/classificacao`)

  const [stepIndex, setStepIndex] = useState(0)
  const [visited, setVisited] = useState<Set<number>>(new Set([0]))
  const [completionIssues, setCompletionIssues] = useState<string[]>([])
  const [invalidKeys, setInvalidKeys] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  function goTo(index: number) {
    flush()
    setStepIndex(index)
    setVisited((current) => new Set(current).add(index))
    setCompletionIssues([])
    setInvalidKeys([])
  }

  async function handleNext() {
    setCompletionIssues([])
    if (stepIndex < STEPS.length - 1) {
      goTo(stepIndex + 1)
      return
    }
    setSaving(true)
    const result = await complete()
    setSaving(false)
    if (result.ok) {
      if (!noPainel) router.push(`/painel/parametrizacao?ligaId=${ligaId}`)
      return
    }
    const fields = result.fields ?? []
    setInvalidKeys(fields)
    setCompletionIssues(Array.isArray(result.issues) ? result.issues.map((issue) => issue.message) : [])
    revealMissingFields(fields, { criteriosClassificacao: 1 }, setStepIndex, setVisited)
  }

  if (loading) return <PageLoading label="Carregando classificação..." />
  if (loadError || !data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <FormAlert variant="error">{loadError ?? 'Campeonato não encontrado.'}</FormAlert>
      </div>
    )
  }

  const criterios = parseCriterios(data.criteriosClassificacao)
  // Valor de exibição — só é gravado no banco quando o organizador de fato
  // edita um placar (ver onChange abaixo). Enquanto isso, quem nunca mexer
  // aqui continua com pontuacaoResultado=null, usando o fallback real do
  // SQL (calcular_pontos_resultado) — não muda pontuação de campeonatos
  // existentes silenciosamente.
  const pontuacao = data.pontuacaoResultado ?? getExamplePontuacaoResultado(data.setsPorPartida ?? 3)

  function updatePontuacao(index: number, campo: 'pontosVencedor' | 'pontosPerdedor', valor: number | null) {
    const next = pontuacao.map((regra, i) => (i === index ? { ...regra, [campo]: valor ?? 0 } : regra))
    updateNow({ pontuacaoResultado: next })
  }

  return (
    <SectionWizardLayout
      ligaId={ligaId}
      section="classificacao"
      title="Classificação"
      subtitle="Pontuação por resultado, critérios de desempate e vagas de classificação — o backend calcula, esta tela só configura."
      autosaveStatus={autosaveStatus}
      autosaveError={autosaveError}
      priceSlot={<PricingSummary ligaId={ligaId} refreshKey={autosaveStatus} />}
    >
      <WizardStepper steps={STEPS} currentIndex={stepIndex} visitedIndexes={visited} onSelect={goTo} />

      <div className="mt-6 grid gap-4">
        {stepIndex === 0 && (
          <div className="creator-modal-section grid gap-3 rounded-2xl border p-4">
            <p className="text-xs font-semibold text-slate-400">Pontos do vencedor e do perdedor para cada placar de sets possível.</p>
            {pontuacao.map((regra, index) => (
              <div key={`${regra.setsVencedor}-${regra.setsPerdedor}`} className="grid grid-cols-[1fr_auto_auto] items-center gap-3">
                <p className="text-sm font-bold text-white">{regra.setsVencedor}x{regra.setsPerdedor}</p>
                <FloatingLabelNumberInput
                  id={`pontos-vencedor-${index}`}
                  label="Pontos vencedor"
                  value={regra.pontosVencedor}
                  min={0}
                  onChange={(v) => updatePontuacao(index, 'pontosVencedor', v)}
                />
                <FloatingLabelNumberInput
                  id={`pontos-perdedor-${index}`}
                  label="Pontos perdedor"
                  value={regra.pontosPerdedor}
                  min={0}
                  onChange={(v) => updatePontuacao(index, 'pontosPerdedor', v)}
                />
              </div>
            ))}
          </div>
        )}

        {stepIndex === 1 && (
          <div className="grid gap-2">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-200">Critérios de classificação <span className="text-luva-amber">*</span></p>
            <OrderedCriteriaList
              invalid={invalidKeys.includes('criteriosClassificacao')}
              value={criterios}
              onChange={(next) => {
                setInvalidKeys((current) => current.filter((key) => key !== 'criteriosClassificacao'))
                updateNow({ criteriosClassificacao: JSON.stringify(next) })
              }}
            />
            <p className="text-xs font-semibold leading-5 text-slate-400">Escolha ao menos um critério. A ordem define o desempate.</p>
          </div>
        )}

        {stepIndex === 2 && (
          <>
            <Field label="Classificados por grupo" hint="Quantidade de equipes de cada grupo que avançam para a fase eliminatória.">
              <NumberInput value={data.classificadosPorGrupo} min={0} max={64} onChange={(v) => updateNow({ classificadosPorGrupo: v })} />
            </Field>
            <Field label="Melhores classificados gerais" hint="Vagas extras por ranking geral entre grupos (ex.: melhores terceiros). Deixe 0 se não usar.">
              <NumberInput value={data.melhoresClassificadosGerais} min={0} max={64} onChange={(v) => updateNow({ melhoresClassificadosGerais: v ?? 0 })} />
            </Field>
          </>
        )}

        {stepIndex === 3 && (
          <div className="grid gap-3">
            <ReviewRow label="Pontuação por resultado" value={pontuacao.map((r) => `${r.setsVencedor}x${r.setsPerdedor}: ${r.pontosVencedor}-${r.pontosPerdedor}`).join(' · ')} />
            <ReviewRow label="Critérios de classificação" value={criterios.length > 0 ? criterios.join(' → ') : 'Nenhum'} />
            <ReviewRow label="Classificados por grupo" value={String(data.classificadosPorGrupo ?? 0)} />
            <ReviewRow label="Melhores classificados gerais" value={String(data.melhoresClassificadosGerais ?? 0)} />
          </div>
        )}

        {completionIssues.length > 0 && (
          <FormAlert variant="error">
            <p className="font-black">Não foi possível concluir:</p>
            <ul className="mt-1 list-disc pl-4">
              {completionIssues.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </FormAlert>
        )}
      </div>

      <WizardNavigation
        onBack={() => goTo(Math.max(0, stepIndex - 1))}
        backDisabled={stepIndex === 0}
        onNext={handleNext}
        isLastStep={stepIndex === STEPS.length - 1}
        saving={saving}
      />
    </SectionWizardLayout>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="text-right text-sm font-bold text-white">{value}</p>
    </div>
  )
}
