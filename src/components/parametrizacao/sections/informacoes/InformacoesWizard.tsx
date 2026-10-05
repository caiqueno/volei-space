'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { revealMissingFields } from '../../wizard/missing-fields'
import { ImagePlus } from 'lucide-react'
import { useAbrirSecaoParametrizacao, useDefinirCategoriaAtiva, useParametrizacaoNoPainel } from '../../PainelParametrizacaoContext'
import { abrirProximaSecao, salvarEAvancarEtapa } from '../../wizard/salvar-etapa'
import { SelecaoCategorias, type SelecaoCategoriasHandle } from '../categorias/CategoriasWizard'
import { SectionWizardLayout } from '../../wizard/SectionWizardLayout'
import { WizardStepper, type WizardStepDef } from '../../wizard/WizardStepper'
import { WizardNavigation } from '../../wizard/WizardNavigation'
import { useSectionWizard } from '../../wizard/useSectionWizard'
import { invalidarConsultas } from '@/lib/api-cliente'
import { Field } from '../../ui/Field'
import { TextInput } from '../../ui/TextInput'
import { FloatingLabelInput } from '@/components/ui/floating-label'
import { TextareaInput } from '../../ui/TextareaInput'
import { SelectInput } from '../../ui/SelectInput'
import { FormAlert } from '../../ui/FormAlert'
import { LoadingTrack } from '@/components/ui/action-bar'
import PageLoading from '@/components/ui/page-loading'
import { supabase } from '@/lib/supabase'
import { optimizeImageFile } from '@/lib/client-image-upload'
import type { InformacoesSectionDTO } from '@/types/championship-setup'

const STEPS: WizardStepDef[] = [
  { key: 'dados', title: 'Dados principais' },
  { key: 'identidade', title: 'Identidade' },
  { key: 'regulamento', title: 'Regulamento e premiação' },
  { key: 'revisao', title: 'Revisão' },
  { key: 'categorias', title: 'Categorias' },
]

const STATUS_OPTIONS = [
  { value: 'EM_BREVE' as const, label: 'Em breve' },
  { value: 'ATIVA' as const, label: 'Ativa' },
  { value: 'ENCERRADA' as const, label: 'Encerrada' },
]

export function InformacoesWizard({ ligaId, embedded = false, etapaInicial = 0 }: { ligaId: number; embedded?: boolean; etapaInicial?: number }) {
  const noPainel = useParametrizacaoNoPainel()
  const abrir = useAbrirSecaoParametrizacao()
  const definirCategoriaAtiva = useDefinirCategoriaAtiva()
  const router = useRouter()
  const categoriasRef = useRef<SelecaoCategoriasHandle>(null)
  const { data, loading, loadError, autosaveStatus, autosaveError, update, updateNow, flush, persist, complete } =
    useSectionWizard<InformacoesSectionDTO>('informacoes', `/api/organizador/ligas/${ligaId}/setup/informacoes`)

  const etapaInicialValida = etapaInicial >= 0 && etapaInicial < STEPS.length ? etapaInicial : 0
  const [stepIndex, setStepIndex] = useState(etapaInicialValida)
  const [visited, setVisited] = useState<Set<number>>(new Set([etapaInicialValida]))
  const [completionIssues, setCompletionIssues] = useState<string[]>([])
  const [invalidKeys, setInvalidKeys] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageError, setImageError] = useState('')

  function goTo(index: number) {
    flush()
    setStepIndex(index)
    setVisited((current) => new Set(current).add(index))
    setCompletionIssues([])
    setInvalidKeys([])
  }

  async function handleImage(file: File | null) {
    if (!file) return
    setImageError('')
    setUploadingImage(true)
    try {
      const optimized = await optimizeImageFile(file, 'imagem-campeonato')
      const extension = optimized.file.type === 'image/webp' ? 'webp' : 'jpg'
      const fileName = `campeonatos/${ligaId}/identidade/${Date.now()}.${extension}`
      const { error: uploadError } = await supabase.storage.from('galeria-campeonato').upload(fileName, optimized.file, {
        upsert: false,
        contentType: optimized.file.type,
        cacheControl: '3600',
      })
      if (uploadError) {
        setImageError(uploadError.message || 'Não foi possível enviar a imagem. Tente novamente.')
        return
      }
      const { data: uploaded } = supabase.storage.from('galeria-campeonato').getPublicUrl(fileName)
      if (!uploaded.publicUrl) {
        setImageError('Não foi possível obter o link da imagem.')
        return
      }
      updateNow({ logoUrl: uploaded.publicUrl, capaUrl: uploaded.publicUrl })
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Não foi possível processar a imagem.')
    } finally {
      setUploadingImage(false)
    }
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
    const categorias = await categoriasRef.current?.salvar()
    if (!categorias?.ok) {
      setSaving(false)
      setCompletionIssues([categorias?.message || 'Não foi possível salvar as categorias. A seleção continua na tela.'])
      return
    }
    const result = await complete()
    setSaving(false)
    if (result.ok) {
      const primeira = categorias.categorias?.[0]?.id ?? null
      if (primeira) {
        definirCategoriaAtiva?.(primeira)
        invalidarConsultas(`/api/organizador/ligas/${ligaId}/categorias`)
        window.dispatchEvent(new Event('categories-updated'))
      }
      if (!embedded) abrirProximaSecao({ atual: 'informacoes', ligaId, noPainel, abrir, router, categoriaId: primeira })
      return
    }
    const fields = result.fields ?? []
    setInvalidKeys(fields)
    setCompletionIssues(Array.isArray(result.issues) ? result.issues.map((issue) => issue.message) : [])
    revealMissingFields(fields, { nome: 0 }, setStepIndex, setVisited)
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
      embedded={embedded}
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
              className={invalidKeys.includes('nome') ? 'field-missing-control' : undefined}
              onChange={(v) => {
                setInvalidKeys((current) => current.filter((key) => key !== 'nome'))
                update({ nome: v })
              }}
              onBlur={flush}
            />
            <Field label="Nome curto / sigla" hint="Até 20 caracteres — usado em espaços reduzidos.">
              <TextInput
                value={data.nomeCurto ?? ''}
                maxLength={20}
                onChange={(e) => {
                  const nomeCurto = e.target.value
                  const nomeAindaProvisorio = (data.nome ?? '').trim() === 'Novo campeonato'
                  update(nomeAindaProvisorio && nomeCurto.trim() ? { nomeCurto, nome: nomeCurto.trim() } : { nomeCurto })
                }}
                onBlur={flush}
                placeholder="Ex.: COPA-RJ"
              />
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
          <Field label="Imagem do campeonato" hint="Uma imagem só. Ela vale como logo e como capa.">
            {data.logoUrl ? (
              <img src={data.logoUrl} alt="Imagem do campeonato" className="h-36 w-full rounded-2xl border border-white/10 object-cover" />
            ) : (
              <span className="flex h-36 w-full items-center justify-center rounded-2xl border border-dashed border-white/15 text-slate-500">
                <ImagePlus size={28} />
              </span>
            )}
            {uploadingImage ? (
              <LoadingTrack label="Enviando imagem" />
            ) : (
              <label className="inline-flex cursor-pointer text-sm font-black text-luva-amber">
                Carregar imagem
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => handleImage(event.target.files?.[0] ?? null)} />
              </label>
            )}
            {imageError && <p className="text-sm font-bold text-red-300">{imageError}</p>}
          </Field>
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
            <ReviewRow label="Imagem" value={data.logoUrl ? 'Carregada' : null} />
            <ReviewRow label="Regulamento" value={data.regulamento ? 'Preenchido' : null} />
            <ReviewRow label="Premiação" value={data.premiacao ? 'Preenchido' : null} />
          </div>
        )}

        {stepIndex === 4 && <SelecaoCategorias ref={categoriasRef} ligaId={ligaId} />}

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
