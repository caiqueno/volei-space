'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ClipboardList, Repeat2, ScanLine, ShieldOff } from 'lucide-react'
import { SectionWizardLayout } from '../../wizard/SectionWizardLayout'
import { WizardStepper, type WizardStepDef } from '../../wizard/WizardStepper'
import { WizardNavigation } from '../../wizard/WizardNavigation'
import { useSectionWizard } from '../../wizard/useSectionWizard'
import { Field } from '../../ui/Field'
import { NumberInput } from '../../ui/NumberInput'
import { SelectInput } from '../../ui/SelectInput'
import { ChoiceChips } from '../../ui/ChoiceChips'
import { ToggleCards } from '../../ui/ToggleCards'
import { CheckboxRow } from '../../ui/CheckboxRow'
import { FormAlert } from '../../ui/FormAlert'
import { PricingSummary } from '../../pricing/PricingSummary'
import { FloatingLabelNumberInput } from '@/components/ui/floating-label'
import PageLoading from '@/components/ui/page-loading'
import type { EstruturaSectionDTO } from '@/types/championship-setup'
import { COMPETITION_FORMATS, formatoTemFaseDeGrupos, type CompetitionFormat } from '@/lib/schemas'

const STEPS: WizardStepDef[] = [
  { key: 'formato', title: 'Formato' },
  { key: 'grupos', title: 'Grupos' },
  { key: 'partidas', title: 'Partidas' },
  { key: 'revisao', title: 'Revisão' },
]

export function EstruturaWizard({ ligaId }: { ligaId: number }) {
  const router = useRouter()
  const { data, loading, loadError, autosaveStatus, autosaveError, update, updateNow, flush, complete } =
    useSectionWizard<EstruturaSectionDTO>('estrutura', `/api/organizador/ligas/${ligaId}/setup/estrutura`)

  const [stepIndex, setStepIndex] = useState(0)
  const [visited, setVisited] = useState<Set<number>>(new Set([0]))
  const [completionIssues, setCompletionIssues] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  function goTo(index: number) {
    flush()
    setStepIndex(index)
    setVisited((current) => new Set(current).add(index))
    setCompletionIssues([])
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
    if (result.ok) router.push(`/painel/parametrizacao?ligaId=${ligaId}`)
    else setCompletionIssues(result.issues.map((issue) => issue.message))
  }

  if (loading) return <PageLoading label="Carregando estrutura do campeonato..." />
  if (loadError || !data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <FormAlert variant="error">{loadError ?? 'Campeonato não encontrado.'}</FormAlert>
      </div>
    )
  }

  const comGrupos = formatoTemFaseDeGrupos(data.formato)

  return (
    <SectionWizardLayout
      ligaId={ligaId}
      section="estrutura"
      title="Estrutura da competição"
      subtitle="Formato, grupos e regras de partida — as regras da distribuição real de equipes continuam na tela de Estrutura já existente, depois que as inscrições fecharem."
      autosaveStatus={autosaveStatus}
      autosaveError={autosaveError}
      priceSlot={<PricingSummary ligaId={ligaId} refreshKey={autosaveStatus} />}
    >
      <WizardStepper steps={STEPS} currentIndex={stepIndex} visitedIndexes={visited} onSelect={goTo} />

      <div className="mt-6 grid gap-4">
        {stepIndex === 0 && (
          <>
            <Field label="Formato da competição" required>
              <ChoiceChips
                value={data.formato as CompetitionFormat | null}
                onChange={(value) => updateNow({ formato: value })}
                options={COMPETITION_FORMATS.map((f) => ({ value: f.value, label: f.label }))}
              />
            </Field>
            <FloatingLabelNumberInput
              id="quantidade-equipes"
              label="Quantidade de Equipes"
              required
              value={data.quantidadeEquipes}
              min={2}
              onChange={(v) => updateNow({ quantidadeEquipes: v })}
            />
          </>
        )}

        {stepIndex === 1 && (
          comGrupos ? (
            <>
              <Field label="Quantidade de grupos" hint="A distribuição real das equipes nos grupos acontece depois, quando as inscrições fecharem.">
                <NumberInput value={data.quantidadeGrupos} min={1} max={32} onChange={(v) => updateNow({ quantidadeGrupos: v })} />
              </Field>
              <CheckboxRow label="Ida e volta (turno e returno)" checked={Boolean(data.turnoReturno)} onChange={(v) => updateNow({ turnoReturno: v })} />
            </>
          ) : (
            <FormAlert variant="info">Mata-mata puro não tem fase de grupos — as equipes entram direto na chave eliminatória.</FormAlert>
          )
        )}

        {stepIndex === 2 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Formato de sets">
                <SelectInput
                  value={data.setsFormato}
                  onChange={(value) => updateNow({ setsFormato: value })}
                  options={[
                    { value: 'MELHOR_DE', label: 'Melhor de N sets' },
                    { value: 'QUANTIDADE_FIXA', label: 'Quantidade fixa de sets' },
                  ]}
                />
              </Field>
              <Field label="Sets por partida">
                <NumberInput value={data.setsPorPartida} min={1} max={5} onChange={(v) => updateNow({ setsPorPartida: v })} />
              </Field>
              <Field label="Pontos por set">
                <NumberInput value={data.pontosPorSet} min={1} max={99} onChange={(v) => updateNow({ pontosPorSet: v })} />
              </Field>
              <Field label="Diferença mínima de pontos">
                <NumberInput value={data.diferencaMinimaSet} min={1} max={10} onChange={(v) => updateNow({ diferencaMinimaSet: v ?? 2 })} />
              </Field>
            </div>
            <CheckboxRow label="Usar tie-break no último set" checked={Boolean(data.tieBreakUltimoSet)} onChange={(v) => updateNow({ tieBreakUltimoSet: v })} />
            {data.tieBreakUltimoSet && (
              <Field label="Pontos do tie-break">
                <NumberInput value={data.pontosUltimoSet} min={1} max={99} onChange={(v) => updateNow({ pontosUltimoSet: v })} />
              </Field>
            )}
            <ToggleCards
              value={Boolean(data.sumulaScoutsEnabled)}
              onChange={(v) => updateNow({ sumulaScoutsEnabled: v })}
              trueOption={{ icon: ScanLine, title: 'Súmula Digital + Scouts', description: 'Registre a partida e transforme os dados do jogo em resultados, scouts e rankings.' }}
              falseOption={{ icon: ShieldOff, title: 'Não contratar', description: 'Súmula digital básica, sem scouts detalhados.' }}
            />
          </>
        )}

        {stepIndex === 3 && (
          <div className="grid gap-3">
            <ReviewRow icon={ClipboardList} label="Formato" value={COMPETITION_FORMATS.find((f) => f.value === data.formato)?.label ?? 'Não definido'} />
            <ReviewRow icon={ClipboardList} label="Quantidade de Equipes" value={data.quantidadeEquipes ? String(data.quantidadeEquipes) : 'Não definido'} />
            {comGrupos && <ReviewRow icon={ClipboardList} label="Grupos" value={String(data.quantidadeGrupos ?? 1)} />}
            <ReviewRow icon={Repeat2} label="Ida e volta" value={data.turnoReturno ? 'Sim' : 'Não'} />
            <ReviewRow icon={ClipboardList} label="Regras de partida" value={`Melhor de ${data.setsPorPartida ?? '?'} sets · ${data.pontosPorSet ?? '?'} pontos`} />
            <ReviewRow icon={ScanLine} label="Súmula Digital + Scouts" value={data.sumulaScoutsEnabled ? 'Contratado' : 'Não contratado'} />
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

function ReviewRow({ icon: Icon, label, value }: { icon: typeof ClipboardList; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <Icon size={16} className="shrink-0 text-slate-400" />
      <p className="flex-1 text-xs font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="text-right text-sm font-bold text-white">{value}</p>
    </div>
  )
}
