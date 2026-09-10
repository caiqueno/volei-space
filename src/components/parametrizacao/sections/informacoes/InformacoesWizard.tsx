'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { SectionWizardLayout } from '../../wizard/SectionWizardLayout'
import { WizardStepper, type WizardStepDef } from '../../wizard/WizardStepper'
import { WizardNavigation } from '../../wizard/WizardNavigation'
import { useSectionWizard } from '../../wizard/useSectionWizard'
import { Field } from '../../ui/Field'
import { TextInput } from '../../ui/TextInput'
import { FloatingLabelInput } from '@/components/ui/floating-label'
import { TextareaInput } from '../../ui/TextareaInput'
import { SelectInput } from '../../ui/SelectInput'
import { ChoiceChips } from '../../ui/ChoiceChips'
import { FormAlert } from '../../ui/FormAlert'
import PageLoading from '@/components/ui/page-loading'
import type { InformacoesSectionDTO } from '@/types/championship-setup'

const STEPS: WizardStepDef[] = [
  { key: 'dados', title: 'Dados principais' },
  { key: 'identidade', title: 'Identidade' },
  { key: 'regulamento', title: 'Regulamento e premiação' },
  { key: 'revisao', title: 'Revisão' },
]

const STATUS_OPTIONS = [
  { value: 'EM_BREVE' as const, label: 'Em breve' },
  { value: 'ATIVA' as const, label: 'Ativa' },
  { value: 'ENCERRADA' as const, label: 'Encerrada' },
]

export function InformacoesWizard({ ligaId }: { ligaId: number }) {
  const router = useRouter()
  const { data, loading, loadError, autosaveStatus, autosaveError, update, updateNow, flush, complete } =
    useSectionWizard<InformacoesSectionDTO>('informacoes', `/api/organizador/ligas/${ligaId}/setup/informacoes`)

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
    if (result.ok) {
      router.push(`/painel/parametrizacao?ligaId=${ligaId}`)
    } else {
      setCompletionIssues(result.issues.map((issue) => issue.message))
    }
  }

  if (loading) return <PageLoading label="Carregando informações do campeonato..." />
  if (loadError || !data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <FormAlert variant="error">{loadError ?? 'Campeonato não encontrado.'}</FormAlert>
      </div>
    )
  }

  return (
    <SectionWizardLayout
      ligaId={ligaId}
      section="informacoes"
      title="Informações do campeonato"
      subtitle="Nome, identidade visual e regulamento — dados independentes das regras esportivas."
      autosaveStatus={autosaveStatus}
      autosaveError={autosaveError}
    >
      <WizardStepper steps={STEPS} currentIndex={stepIndex} visitedIndexes={visited} onSelect={goTo} />

      <div className="mt-6 grid gap-4">
        {stepIndex === 0 && (
          <>
            <FloatingLabelInput
              id="nome-campeonato"
              label="Nome do campeonato"
              required
              value={data.nome ?? ''}
              onChange={(v) => update({ nome: v })}
              onBlur={flush}
            />
            <Field label="Nome curto / sigla" hint="Até 20 caracteres — usado em espaços reduzidos.">
              <TextInput value={data.nomeCurto ?? ''} maxLength={20} onChange={(e) => update({ nomeCurto: e.target.value })} onBlur={flush} placeholder="Ex.: COPA-RJ" />
            </Field>
            <FloatingLabelInput
              id="subtitulo-campeonato"
              label="Subtítulo"
              value={data.subtitulo ?? ''}
              onChange={(v) => update({ subtitulo: v })}
              onBlur={flush}
            />
            <Field label="Status">
              <SelectInput value={data.status} onChange={(value) => updateNow({ status: value })} options={STATUS_OPTIONS} />
            </Field>
          </>
        )}

        {stepIndex === 1 && (
          <>
            <Field label="Descrição">
              <TextareaInput value={data.descricao ?? ''} onChange={(e) => update({ descricao: e.target.value })} onBlur={flush} />
            </Field>
            <Field label="URL do logo" hint="Upload de imagem será adicionado no wizard visual definitivo — por ora, cole a URL.">
              <TextInput value={data.logoUrl ?? ''} onChange={(e) => update({ logoUrl: e.target.value })} onBlur={flush} placeholder="https://..." />
            </Field>
            <Field label="URL da capa">
              <TextInput value={data.capaUrl ?? ''} onChange={(e) => update({ capaUrl: e.target.value })} onBlur={flush} placeholder="https://..." />
            </Field>
          </>
        )}

        {stepIndex === 2 && (
          <>
            <Field label="Regulamento">
              <TextareaInput value={data.regulamento ?? ''} onChange={(e) => update({ regulamento: e.target.value })} onBlur={flush} />
            </Field>
            <Field label="Premiação">
              <TextareaInput value={data.premiacao ?? ''} onChange={(e) => update({ premiacao: e.target.value })} onBlur={flush} />
            </Field>
          </>
        )}

        {stepIndex === 3 && (
          <div className="grid gap-3">
            <ReviewRow label="Nome" value={data.nome} />
            <ReviewRow label="Nome curto" value={data.nomeCurto} />
            <ReviewRow label="Subtítulo" value={data.subtitulo} />
            <ReviewRow label="Status" value={STATUS_OPTIONS.find((o) => o.value === data.status)?.label} />
            <ReviewRow label="Descrição" value={data.descricao} />
            <ReviewRow label="Regulamento" value={data.regulamento ? 'Preenchido' : null} />
            <ReviewRow label="Premiação" value={data.premiacao ? 'Preenchido' : null} />
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

function ReviewRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="text-right text-sm font-bold text-white">{value || 'Não preenchido'}</p>
    </div>
  )
}
