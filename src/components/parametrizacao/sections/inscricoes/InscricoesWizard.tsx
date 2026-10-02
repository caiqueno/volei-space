'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { QrCode, ShieldOff } from 'lucide-react'
import { useAbrirSecaoParametrizacao, useParametrizacaoNoPainel } from '../../PainelParametrizacaoContext'
import { abrirProximaSecao, salvarEAvancarEtapa } from '../../wizard/salvar-etapa'
import { SectionWizardLayout } from '../../wizard/SectionWizardLayout'
import { WizardStepper, type WizardStepDef } from '../../wizard/WizardStepper'
import { WizardNavigation } from '../../wizard/WizardNavigation'
import { useSectionWizard } from '../../wizard/useSectionWizard'
import { DateTimePickerInput } from '../../ui/DateTimePickerInput'
import { ToggleCards } from '../../ui/ToggleCards'
import { CheckboxRow } from '../../ui/CheckboxRow'
import { FormAlert } from '../../ui/FormAlert'
import { PricingSummary } from '../../pricing/PricingSummary'
import PageLoading from '@/components/ui/page-loading'
import { FloatingLabelNumberInput } from '@/components/ui/floating-label'
import type { FieldRequirement, InscricoesSectionDTO } from '@/types/championship-setup'
import { getDefaultFormularioInscricaoConfig } from '@/lib/championship-setup-defaults'
import { revealMissingFields } from '../../wizard/missing-fields'

const STEPS: WizardStepDef[] = [
  { key: 'periodo', title: 'Período e limites' },
  { key: 'elenco', title: 'Elenco' },
  { key: 'formulario', title: 'Formulário' },
  { key: 'qr', title: 'QR Code' },
  { key: 'revisao', title: 'Revisão' },
]

const REQUIREMENT_OPTIONS: Array<{ value: FieldRequirement; label: string }> = [
  { value: 'disabled', label: 'Não coletar' },
  { value: 'optional', label: 'Opcional' },
  { value: 'required', label: 'Obrigatório' },
]

const EQUIPE_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'nome', label: 'Nome' },
  { key: 'nomeAbreviado', label: 'Nome abreviado' },
  { key: 'logo', label: 'Logo' },
  { key: 'cidade', label: 'Cidade' },
  { key: 'instagram', label: 'Instagram' },
]
const LIDER_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'nomeCompleto', label: 'Nome completo' },
  { key: 'cpf', label: 'CPF' },
  { key: 'dataNascimento', label: 'Data de nascimento' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'email', label: 'E-mail' },
  { key: 'documento', label: 'Documento' },
  { key: 'foto', label: 'Foto' },
]
const ATLETA_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'nomeCompleto', label: 'Nome completo' },
  { key: 'cpf', label: 'CPF' },
  { key: 'rg', label: 'RG' },
  { key: 'dataNascimento', label: 'Data de nascimento' },
  { key: 'foto', label: 'Foto' },
  { key: 'numeroCamisa', label: 'Número da camisa' },
  { key: 'posicao', label: 'Posição' },
  { key: 'altura', label: 'Altura' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'documento', label: 'Documento' },
]

function FieldRequirementRow({
  label,
  value,
  onChange,
  locked,
  lockedHint,
}: {
  label: string
  value: FieldRequirement
  onChange: (value: FieldRequirement) => void
  locked?: boolean
  lockedHint?: string
}) {
  return (
    <div className="grid gap-2 border-b border-white/5 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
      <div>
        <p className="text-sm font-bold text-white">{label}</p>
        {locked && lockedHint && <p className="text-xs font-semibold text-luva-amber">{lockedHint}</p>}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {REQUIREMENT_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={locked}
            onClick={() => onChange(option.value)}
            className={`creator-category-option creator-category-option--compact text-[11px] disabled:cursor-not-allowed disabled:opacity-50 ${value === option.value ? 'is-selected' : ''}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function InscricoesWizard({ ligaId }: { ligaId: number }) {
  const noPainel = useParametrizacaoNoPainel()
  const abrir = useAbrirSecaoParametrizacao()
  const router = useRouter()
  const { data, loading, loadError, autosaveStatus, autosaveError, updateNow, flush, persist, complete } =
    useSectionWizard<InscricoesSectionDTO>('inscricoes', `/api/organizador/ligas/${ligaId}/setup/inscricoes`)

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
      setSaving(true)
      await salvarEAvancarEtapa({ persist, goTo, proximoIndice: stepIndex + 1, setCompletionIssues })
      setSaving(false)
      return
    }
    setSaving(true)
    const result = await complete()
    setSaving(false)
    if (result.ok) {
      abrirProximaSecao({ atual: 'inscricoes', ligaId, noPainel, abrir, router })
      return
    }
    const fields = result.fields ?? []
    setInvalidKeys(fields)
    setCompletionIssues(Array.isArray(result.issues) ? result.issues.map((issue) => issue.message) : [])
    revealMissingFields(fields, { formularioInscricaoConfig: 2 }, setStepIndex, setVisited)
  }

  if (loading) return <PageLoading label="Carregando inscrições..." />
  if (loadError || !data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <FormAlert variant="error">{loadError ?? 'Campeonato não encontrado.'}</FormAlert>
      </div>
    )
  }

  const formulario = data.formularioInscricaoConfig ?? getDefaultFormularioInscricaoConfig()
  const qrOn = data.qrCodeEnabled

  // Enviar só o grupo alterado — o servidor mescla por grupo, então isto é
  // seguro mesmo sem reenviar equipe/lider a cada mudança de atleta.
  function setAtletaField(key: string, value: FieldRequirement) {
    setInvalidKeys((current) => current.filter((item) => item !== 'formularioInscricaoConfig'))
    updateNow({ formularioInscricaoConfig: { atleta: { ...formulario.atleta, [key]: value } } })
  }
  function setLiderField(key: string, value: FieldRequirement) {
    setInvalidKeys((current) => current.filter((item) => item !== 'formularioInscricaoConfig'))
    updateNow({ formularioInscricaoConfig: { lider: { ...formulario.lider, [key]: value } } })
  }
  function setEquipeField(key: string, value: FieldRequirement) {
    setInvalidKeys((current) => current.filter((item) => item !== 'formularioInscricaoConfig'))
    updateNow({ formularioInscricaoConfig: { equipe: { ...formulario.equipe, [key]: value } } })
  }

  function toggleQr(next: boolean) {
    if (next) {
      // Ao ligar o QR, força nome+foto do atleta para obrigatório no MESMO
      // PATCH — o 422 do servidor fica inalcançável pelo caminho feliz.
      updateNow({
        qrCodeEnabled: true,
        formularioInscricaoConfig: { atleta: { ...formulario.atleta, nomeCompleto: 'required', foto: 'required' } },
      })
    } else {
      updateNow({ qrCodeEnabled: false })
    }
  }

  return (
    <SectionWizardLayout
      ligaId={ligaId}
      section="inscricoes"
      title="Inscrições"
      subtitle="O líder da equipe se inscreve por um link público. Sem lista de espera — o limite é a quantidade de equipes definida em Estrutura."
      autosaveStatus={autosaveStatus}
      autosaveError={autosaveError}
      priceSlot={<PricingSummary ligaId={ligaId} refreshKey={autosaveStatus} />}
    >
      <WizardStepper steps={STEPS} currentIndex={stepIndex} visitedIndexes={visited} onSelect={goTo} />

      <div className="mt-6 grid gap-4">
        {stepIndex === 0 && (
          <>
            <CheckboxRow label="Inscrições abertas" checked={data.inscricoesAbertas} onChange={(v) => updateNow({ inscricoesAbertas: v })} />
            <div className="grid gap-4 sm:grid-cols-2">
              <DateTimePickerInput
                id="inscricoes-abertura"
                label="Data de início das inscrições"
                value={data.inscricoesAberturaEm}
                onChange={(iso) => updateNow({ inscricoesAberturaEm: iso })}
              />
              <DateTimePickerInput
                id="inscricoes-encerramento"
                label="Data de encerramento das inscrições"
                value={data.inscricoesEncerramentoEm}
                onChange={(iso) => updateNow({ inscricoesEncerramentoEm: iso })}
              />
            </div>
            <ToggleCards
              value={data.inscricaoAprovacaoAutomatica}
              onChange={(v) => updateNow({ inscricaoAprovacaoAutomatica: v })}
              trueOption={{ icon: QrCode, title: 'Aprovação automática', description: 'Toda solicitação já entra aprovada.' }}
              falseOption={{ icon: ShieldOff, title: 'Aprovação manual', description: 'Você revisa e aprova cada equipe.' }}
            />
            <CheckboxRow label="Permitir edição após o envio" checked={data.inscricaoPermiteEdicaoAposEnvio} onChange={(v) => updateNow({ inscricaoPermiteEdicaoAposEnvio: v })} />
            <FloatingLabelNumberInput
              id="prazo-edicao-inscricao"
              label="Prazo limite para edição (dias)"
              value={data.inscricaoPrazoEdicaoDias}
              min={0}
              max={365}
              onChange={(v) => updateNow({ inscricaoPrazoEdicaoDias: v })}
            />
            <p className="text-xs font-semibold text-slate-400">Deixe em branco para não ter prazo.</p>
          </>
        )}

        {stepIndex === 1 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <FloatingLabelNumberInput id="elenco-minimo" label="Mínimo de atletas" value={data.elencoQuantidadeMinima} min={1} onChange={(v) => updateNow({ elencoQuantidadeMinima: v })} />
              <FloatingLabelNumberInput id="elenco-maximo" label="Máximo de atletas" value={data.elencoQuantidadeMaxima} min={1} onChange={(v) => updateNow({ elencoQuantidadeMaxima: v })} />
            </div>
            <CheckboxRow label="Permitir cadastro de atletas durante a inscrição" checked={data.elencoCadastroDuranteInscricao} onChange={(v) => updateNow({ elencoCadastroDuranteInscricao: v })} />
            <CheckboxRow label="Permitir cadastro de atletas após aprovação" checked={data.elencoCadastroAposAprovacao} onChange={(v) => updateNow({ elencoCadastroAposAprovacao: v })} />
            <FloatingLabelNumberInput
              id="prazo-alteracao-elenco"
              label="Prazo para alteração do elenco após o início (dias)"
              value={data.prazoAlteracaoElencoDias}
              min={0}
              max={365}
              onChange={(v) => updateNow({ prazoAlteracaoElencoDias: v ?? 0 })}
            />
          </>
        )}

        {stepIndex === 2 && (
          <div id="formulario-inscricao" className={invalidKeys.includes('formularioInscricaoConfig') ? 'field-missing grid gap-5 rounded-2xl p-1' : 'grid gap-5'}>
            <div>
              <p className="mb-1 text-xs font-black uppercase tracking-[0.16em] text-luva-amber">Dados da equipe</p>
              <div className="creator-modal-section rounded-2xl border p-4">
                {EQUIPE_FIELDS.map((field) => (
                  <FieldRequirementRow key={field.key} label={field.label} value={formulario.equipe?.[field.key as keyof typeof formulario.equipe] ?? 'disabled'} onChange={(v) => setEquipeField(field.key, v)} />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-black uppercase tracking-[0.16em] text-luva-amber">Dados do líder</p>
              <div className="creator-modal-section rounded-2xl border p-4">
                {LIDER_FIELDS.map((field) => (
                  <FieldRequirementRow key={field.key} label={field.label} value={formulario.lider?.[field.key as keyof typeof formulario.lider] ?? 'disabled'} onChange={(v) => setLiderField(field.key, v)} />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-black uppercase tracking-[0.16em] text-luva-amber">Dados dos atletas</p>
              <div className="creator-modal-section rounded-2xl border p-4">
                {ATLETA_FIELDS.map((field) => {
                  const isLockedByQr = qrOn && (field.key === 'nomeCompleto' || field.key === 'foto')
                  return (
                    <FieldRequirementRow
                      key={field.key}
                      label={field.label}
                      value={formulario.atleta?.[field.key as keyof typeof formulario.atleta] ?? 'disabled'}
                      onChange={(v) => setAtletaField(field.key, v)}
                      locked={isLockedByQr}
                      lockedHint={isLockedByQr ? 'Obrigatório porque o QR Code está ativo' : undefined}
                    />
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {stepIndex === 3 && (
          <>
            <ToggleCards
              value={qrOn}
              onChange={toggleQr}
              trueOption={{ icon: QrCode, title: 'Gerar QR Code', description: 'Consulte rapidamente o nome e a foto do atleta durante a competição.' }}
              falseOption={{ icon: ShieldOff, title: 'Não usar QR Code', description: 'Sem identificação por QR na súmula digital.' }}
            />
            {qrOn && (
              <FormAlert variant="info">
                O QR contém apenas um identificador opaco — a consulta mostra somente nome completo e foto, nunca CPF, RG ou outros dados pessoais. Por isso nome e foto do atleta ficaram obrigatórios na etapa anterior.
              </FormAlert>
            )}
          </>
        )}

        {stepIndex === 4 && (
          <div className="grid gap-3">
            <ReviewRow label="Inscrições" value={data.inscricoesAbertas ? 'Abertas' : 'Fechadas'} />
            <ReviewRow label="Aprovação" value={data.inscricaoAprovacaoAutomatica ? 'Automática' : 'Manual'} />
            <ReviewRow label="Elenco" value={`${data.elencoQuantidadeMinima ?? '—'} a ${data.elencoQuantidadeMaxima ?? '—'} atletas`} />
            <ReviewRow label="QR Code" value={qrOn ? 'Ativado' : 'Desativado'} />
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
