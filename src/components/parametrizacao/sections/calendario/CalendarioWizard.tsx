'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { MapPin, Plus, Trash2 } from 'lucide-react'
import { useAbrirSecaoParametrizacao, useParametrizacaoNoPainel } from '../../PainelParametrizacaoContext'
import { abrirProximaSecao, salvarEAvancarEtapa } from '../../wizard/salvar-etapa'
import { SectionWizardLayout } from '../../wizard/SectionWizardLayout'
import { WizardStepper, type WizardStepDef } from '../../wizard/WizardStepper'
import { WizardNavigation } from '../../wizard/WizardNavigation'
import { useSectionWizard } from '../../wizard/useSectionWizard'
import { DatePickerInput } from '../../ui/DatePickerInput'
import { TextInput } from '../../ui/TextInput'
import { FormAlert } from '../../ui/FormAlert'
import { useToast } from '../../ui/Toast'
import PageLoading from '@/components/ui/page-loading'
import { revealMissingFields } from '../../wizard/missing-fields'
import { formatDateBr } from '@/lib/date-brazil'
import { validateDateRange } from '@/lib/championship-validation'
import type { CalendarioSectionDTO, LigaLocalDTO } from '@/types/championship-setup'

const STEPS: WizardStepDef[] = [
  { key: 'periodo', title: 'Período' },
  { key: 'locais', title: 'Locais' },
  { key: 'revisao', title: 'Revisão' },
]

export function CalendarioWizard({ ligaId }: { ligaId: number }) {
  const router = useRouter()
  const noPainel = useParametrizacaoNoPainel()
  const abrir = useAbrirSecaoParametrizacao()
  const showToast = useToast()
  const { data, loading, loadError, autosaveStatus, autosaveError, fieldMessages, clearFieldMessage, updateNow, flush, persist, complete } =
    useSectionWizard<CalendarioSectionDTO>('calendario', `/api/organizador/ligas/${ligaId}/setup/calendario`)

  const [stepIndex, setStepIndex] = useState(0)
  const [visited, setVisited] = useState<Set<number>>(new Set([0]))
  const [completionIssues, setCompletionIssues] = useState<string[]>([])
  const [invalidKeys, setInvalidKeys] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const lastInvalidDateMessageRef = useRef('')

  // Validação client-side de dataFim < dataInicio — antes, nada checava essa
  // relação antes do PATCH (só existia um CHECK no banco). Reaproveita a
  // mesma função pura já usada pelo motor de validação do servidor
  // (championship-setup-engine.ts), então a mensagem é idêntica nos dois
  // lugares — sem duplicar o aviso com um texto diferente.
  useEffect(() => {
    if (!data) return
    const message = validateDateRange(data.dataInicio, data.dataFim)
    if (message && message !== lastInvalidDateMessageRef.current) {
      showToast({ title: 'Data inválida', message, variant: 'error' })
    }
    lastInvalidDateMessageRef.current = message
  }, [data?.dataInicio, data?.dataFim, showToast])

  // CRUD de locais é um recurso à parte de Liga — não passa pela fila de
  // autosave de useSectionWizard, que só sabe fazer PATCH em Liga.
  const [locais, setLocais] = useState<LigaLocalDTO[]>([])
  const [novoLocal, setNovoLocal] = useState({ nome: '', endereco: '', quadra: '' })
  const [localError, setLocalError] = useState<string | null>(null)
  const [localMessages, setLocalMessages] = useState<Record<string, string>>({})

  useEffect(() => {
    if (data) setLocais(data.locais)
  }, [data])

  function goTo(index: number) {
    // Datas só são editáveis na etapa 0 ("Período") — bloqueia sair dela
    // (avançar pela navegação inferior ou pular direto por uma aba já
    // visitada do stepper) enquanto a combinação for inválida. Voltar para a
    // etapa 0 continua sempre permitido, é o caminho pra corrigir o problema.
    if (index !== 0) {
      const dateRangeMessage = validateDateRange(data?.dataInicio, data?.dataFim)
      if (dateRangeMessage) {
        const missing = [!data?.dataInicio ? 'dataInicio' : null, !data?.dataFim ? 'dataFim' : null].filter((key): key is string => Boolean(key))
        setInvalidKeys(missing.length ? missing : ['dataInicio', 'dataFim'])
        showToast({ title: 'Data inválida', message: dateRangeMessage, variant: 'error' })
        return
      }
    }
    flush()
    setStepIndex(index)
    setVisited((current) => new Set(current).add(index))
    setCompletionIssues([])
    setInvalidKeys([])
  }

  async function handleNext() {
    setCompletionIssues([])
    if (stepIndex < STEPS.length - 1) {
      if (stepIndex === 0 && validateDateRange(data?.dataInicio, data?.dataFim)) {
        goTo(stepIndex + 1)
        return
      }
      setSaving(true)
      await salvarEAvancarEtapa({ persist, goTo, proximoIndice: stepIndex + 1, setCompletionIssues })
      setSaving(false)
      return
    }
    setSaving(true)
    const result = await complete()
    setSaving(false)
    if (result.ok) {
      abrirProximaSecao({ atual: 'calendario', ligaId, noPainel, abrir, router })
      return
    }
    const fields = result.fields ?? []
    setInvalidKeys(fields)
    setCompletionIssues(Array.isArray(result.issues) ? result.issues.map((issue) => issue.message) : [])
    revealMissingFields(fields, { dataInicio: 0, dataFim: 0 }, setStepIndex, setVisited)
  }

  function changeLocal(key: 'nome' | 'endereco' | 'quadra', value: string) {
    setNovoLocal((current) => ({ ...current, [key]: value }))
    setLocalMessages((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  async function addLocal() {
    if (!novoLocal.nome.trim()) {
      setLocalMessages({ nome: 'Preencha Nome do local.' })
      setLocalError('Preencha Nome do local.')
      return
    }
    setLocalError(null)
    setLocalMessages({})
    const response = await fetch(`/api/organizador/ligas/${ligaId}/setup/calendario/locais`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(novoLocal),
    })
    const payload = await response.json()
    if (!response.ok) {
      const details = payload.details && !Array.isArray(payload.details) ? payload.details as { fields?: unknown; messages?: unknown } : null
      const fields = Array.isArray(details?.fields) ? details.fields.filter((field): field is string => typeof field === 'string') : []
      const messages = Array.isArray(details?.messages) ? details.messages.filter((message): message is string => typeof message === 'string') : []
      const map: Record<string, string> = {}
      fields.forEach((field, index) => {
        map[field] = messages[index] || payload.error || 'Dado inválido'
      })
      if (!fields.length) map.nome = payload.error || 'Erro ao adicionar local.'
      setLocalMessages(map)
      setLocalError(messages.length ? messages.join(' ') : payload.error || 'Erro ao adicionar local.')
      return
    }
    setLocais((current) => [...current, payload.data])
    setNovoLocal({ nome: '', endereco: '', quadra: '' })
    setLocalMessages({})
  }

  async function removeLocal(id: number) {
    setLocalError(null)
    const previous = locais
    setLocais((current) => current.filter((local) => local.id !== id))
    const response = await fetch(`/api/organizador/ligas/${ligaId}/setup/calendario/locais/${id}`, { method: 'DELETE' })
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      setLocais(previous)
      setLocalError(payload.error || 'Erro ao remover local.')
    }
  }

  const rangeMessage = validateDateRange(data?.dataInicio, data?.dataFim)

  if (loading) return <PageLoading label="Carregando calendário..." />
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
      section="calendario"
      title="Calendário e local"
      subtitle="Só o período do campeonato. Datas e horários de cada partida continuam manuais, definidos depois na tela de Estrutura."
      autosaveStatus={autosaveStatus}
      autosaveError={autosaveError}
    >
      <WizardStepper steps={STEPS} currentIndex={stepIndex} visitedIndexes={visited} onSelect={goTo} />

      <div className="mt-6 grid gap-4">
        {stepIndex === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1">
              <DatePickerInput id="data-inicio" label="Data de início" required invalid={invalidKeys.includes('dataInicio') || Boolean(fieldMessages.dataInicio) || Boolean(rangeMessage)} value={data.dataInicio} edge="start" onChange={(iso) => { setInvalidKeys((current) => current.filter((key) => key !== 'dataInicio')); clearFieldMessage('dataInicio'); updateNow({ dataInicio: iso }) }} />
              {fieldMessages.dataInicio && <FieldHint>{fieldMessages.dataInicio}</FieldHint>}
            </div>
            <div className="grid gap-1">
              <DatePickerInput id="data-fim" label="Data de término" required invalid={invalidKeys.includes('dataFim') || Boolean(fieldMessages.dataFim) || Boolean(rangeMessage)} value={data.dataFim} edge="end" onChange={(iso) => { setInvalidKeys((current) => current.filter((key) => key !== 'dataFim')); clearFieldMessage('dataFim'); updateNow({ dataFim: iso }) }} />
              {(fieldMessages.dataFim || rangeMessage) && <FieldHint>{fieldMessages.dataFim || rangeMessage}</FieldHint>}
            </div>
          </div>
        )}

        {stepIndex === 1 && (
          <>
            <div className="grid gap-2">
              {locais.length === 0 && <p className="text-sm font-semibold text-slate-400">Nenhum local cadastrado ainda — pode ser definido depois.</p>}
              {locais.map((local) => (
                <div key={local.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <MapPin size={16} className="shrink-0 text-slate-400" />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-white">{local.nome}</p>
                    {(local.endereco || local.quadra) && (
                      <p className="text-xs font-semibold text-slate-400">{[local.endereco, local.quadra].filter(Boolean).join(' · ')}</p>
                    )}
                  </div>
                  <button type="button" onClick={() => removeLocal(local.id)} aria-label={`Remover ${local.nome}`} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition hover:border-red-400/50 hover:text-red-200">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>

            <div className="creator-modal-section grid gap-3 rounded-2xl border p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Adicionar local</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="grid gap-1">
                  <TextInput placeholder="Nome" aria-invalid={Boolean(localMessages.nome)} className={localMessages.nome ? 'field-missing-control' : undefined} value={novoLocal.nome} onChange={(e) => changeLocal('nome', e.target.value)} />
                  {localMessages.nome && <FieldHint>{localMessages.nome}</FieldHint>}
                </div>
                <div className="grid gap-1">
                  <TextInput placeholder="Endereço" aria-invalid={Boolean(localMessages.endereco)} className={localMessages.endereco ? 'field-missing-control' : undefined} value={novoLocal.endereco} onChange={(e) => changeLocal('endereco', e.target.value)} />
                  {localMessages.endereco && <FieldHint>{localMessages.endereco}</FieldHint>}
                </div>
                <div className="grid gap-1">
                  <TextInput placeholder="Quadra" aria-invalid={Boolean(localMessages.quadra)} className={localMessages.quadra ? 'field-missing-control' : undefined} value={novoLocal.quadra} onChange={(e) => changeLocal('quadra', e.target.value)} />
                  {localMessages.quadra && <FieldHint>{localMessages.quadra}</FieldHint>}
                </div>
              </div>
              <button
                type="button"
                onClick={addLocal}
                disabled={!novoLocal.nome.trim()}
                className="public-secondary-action inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-black disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus size={16} /> Adicionar local
              </button>
              {localError && <FormAlert variant="error">{localError}</FormAlert>}
            </div>
          </>
        )}

        {stepIndex === 2 && (
          <div className="grid gap-3">
            <ReviewRow label="Início" value={formatDateBr(data.dataInicio)} />
            <ReviewRow label="Término" value={formatDateBr(data.dataFim)} />
            <ReviewRow label="Locais cadastrados" value={locais.length > 0 ? locais.map((l) => l.nome).join(', ') : 'Nenhum (a definir depois)'} />
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

function FieldHint({ children }: { children: string }) {
  return <p className="text-sm font-bold text-red-300">{children}</p>
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="text-right text-sm font-bold text-white">{value}</p>
    </div>
  )
}
