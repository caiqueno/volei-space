'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, ImageIcon, Plus, Save, Trash2, X } from 'lucide-react'
import { ActionBar, LoadingTrack } from '@/components/ui/action-bar'
import { enviarArquivoAssinado, ErroUpload } from '@/lib/uploads-cliente'
import { fetchCepAddress, formatCep, normalizeCep } from '@/lib/client-cep'
import { formatBytes, imageUploadRules, optimizeImageFile } from '@/lib/client-image-upload'

type CandidaturaTipo = 'equipe' | 'arbitro' | 'quadra'
export type CandidateEditSection = 'cadastro' | 'credenciais' | 'disponibilidade' | 'quadra' | 'arena' | 'localizacao' | 'estrutura'

type Session = {
  tipo: string
  nome?: string
  email?: string
  candidaturaId?: string | null
  status?: string
}

type FormValue = string | boolean | string[] | Record<string, unknown>
type FormState = Record<string, FormValue>

const inputClass =
  'w-full rounded-xl border border-white/15 bg-[#071426] px-3.5 py-2.5 text-sm font-bold text-white outline-none transition placeholder:text-slate-400 focus:border-luva-amber focus:ring-4 focus:ring-luva-amber/20'
const labelClass = 'mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-200'
const dias = ['Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado', 'Domingo']
const generosEquipe = [
  { value: 'MASCULINO', label: 'Masculino' },
  { value: 'FEMININO', label: 'Feminino' },
  { value: 'MISTO', label: 'Misto' },
]
const categoriasEtariasEquipe = [
  { value: 'SUB15', label: 'Sub15' },
  { value: 'SUB18', label: 'Sub18' },
  { value: 'SUB21', label: 'Sub21' },
  { value: 'ADULTO', label: 'Adulto (+22)' },
  { value: 'MASTER', label: 'Master' },
]
const niveisEquipe = [
  { value: 'INICIANTE', label: 'Iniciante' },
  { value: 'INTERMEDIARIO', label: 'Intermediário' },
  { value: 'AVANCADO', label: 'Avançado' },
]

export function CandidateEditForm({
  tipo,
  session,
  section,
  open,
  onClose,
  onSessionUpdate,
}: {
  tipo: CandidaturaTipo
  session: Session
  section: CandidateEditSection | null
  open: boolean
  onClose: () => void
  onSessionUpdate?: (session: Session) => void
}) {
  const [form, setForm] = useState<FormState>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [cepLoading, setCepLoading] = useState(false)
  const [cepMessage, setCepMessage] = useState<string | null>(null)
  const lastCepSearchRef = useRef('')

  const candidaturaId = session.candidaturaId
  const pending = String(session.status || 'PENDENTE').toUpperCase() === 'PENDENTE'
  const canEdit = tipo === 'equipe' || pending
  const meta = useMemo(() => modalMeta(tipo, section), [tipo, section])
  const editableCep = useMemo(() => {
    if (!open) return ''
    if (tipo === 'equipe' && section === 'quadra') {
      return String((form.quadraInfo as Record<string, unknown> | undefined)?.cep || '')
    }
    if (tipo === 'quadra' && section === 'localizacao') {
      return String(form.cep || '')
    }
    return ''
  }, [form, open, section, tipo])

  useEffect(() => {
    if (!open) return
    let active = true

    async function load() {
      if (!candidaturaId) {
        setFeedback({ type: 'error', text: 'Não encontramos o identificador da candidatura. Entre novamente para editar.' })
        return
      }

      setLoading(true)
      setFeedback(null)
      setCepMessage(null)
      lastCepSearchRef.current = ''
      const res = await fetch(`/api/candidaturas/${tipo}/${candidaturaId}`)
      const json = await res.json().catch(() => ({}))
      if (!active) return

      if (!res.ok) {
        setFeedback({ type: 'error', text: json.error || 'Não foi possível carregar seus dados.' })
      } else {
        setForm(normalizeInitialForm(tipo, json.data?.candidatura || {}))
      }
      setLoading(false)
    }

    load()
    return () => {
      active = false
    }
  }, [open, tipo, candidaturaId])

  function setField(name: string, value: FormValue) {
    setFeedback(null)
    if (name === 'cep') {
      setCepMessage(null)
      lastCepSearchRef.current = ''
    }
    setForm((current) => ({ ...current, [name]: value }))
  }

  function setNested(group: string, name: string, value: boolean | string) {
    setFeedback(null)
    if (group === 'quadraInfo' && name === 'cep') {
      setCepMessage(null)
      lastCepSearchRef.current = ''
    }
    setForm((current) => ({
      ...current,
      [group]: {
        ...((current[group] as Record<string, unknown>) || {}),
        [name]: value,
      },
    }))
  }

  async function searchCep() {
    if (!canEdit) return
    const rawCep =
      tipo === 'equipe' && section === 'quadra'
        ? String((form.quadraInfo as Record<string, unknown> | undefined)?.cep || '')
        : tipo === 'quadra' && section === 'localizacao'
          ? String(form.cep || '')
          : ''
    const cep = normalizeCep(rawCep)
    const searchKey = `${tipo}:${section}:${cep}`
    setCepMessage(null)
    if (!cep) return
    if (cep.length !== 8) {
      setCepMessage('Informe um CEP com 8 numeros ou preencha o endereco manualmente.')
      return
    }
    if (cepLoading && lastCepSearchRef.current === searchKey) return

    lastCepSearchRef.current = searchKey
    setCepLoading(true)
    try {
      const address = await fetchCepAddress(cep)
      if (tipo === 'equipe' && section === 'quadra') {
        setForm((current) => {
          const quadraInfo = (current.quadraInfo as Record<string, unknown>) || {}
          return {
            ...current,
            quadraInfo: {
              ...quadraInfo,
              cep: formatCep(address.cep),
              endereco: address.enderecoCompleto || quadraInfo.endereco || '',
              bairro: address.bairro || quadraInfo.bairro || '',
            },
          }
        })
      } else if (tipo === 'quadra' && section === 'localizacao') {
        setForm((current) => ({
          ...current,
          cep: formatCep(address.cep),
          endereco: address.enderecoCompleto || current.endereco || '',
          bairro: address.bairro || current.bairro || '',
        }))
      }
      setCepMessage('Endereco preenchido pelo CEP.')
    } catch (error) {
      setCepMessage(error instanceof Error ? error.message : 'Nao foi possivel consultar o CEP agora. Preencha o endereco manualmente.')
    } finally {
      setCepLoading(false)
    }
  }

  useEffect(() => {
    const cep = normalizeCep(editableCep)
    if (!open || !canEdit || cep.length !== 8) return
    const searchKey = `${tipo}:${section}:${cep}`
    if (lastCepSearchRef.current === searchKey) return
    const timeout = window.setTimeout(() => {
      void searchCep()
    }, 550)
    return () => window.clearTimeout(timeout)
  }, [canEdit, editableCep, open, section, tipo])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!candidaturaId) return

    setSaving(true)
    setFeedback(null)
    const res = await fetch(`/api/candidaturas/${tipo}/${candidaturaId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadByTipo(tipo, form)),
    })
    const json = await res.json().catch(() => ({}))
    setSaving(false)

    if (!res.ok) {
      setFeedback({ type: 'error', text: json.error || 'Não foi possível salvar.' })
      return
    }

    const updated = json.data?.candidatura || {}
    setForm(normalizeInitialForm(tipo, updated))
    setFeedback({ type: 'success', text: 'Dados atualizados com sucesso. A organização analisará as informações revisadas.' })

    const nextSession = {
      ...session,
      nome: String(updated.responsavel || updated.nome || session.nome || ''),
      status: String(updated.status || session.status || 'PENDENTE'),
    }
    window.localStorage.setItem('luva_session', JSON.stringify(nextSession))
    onSessionUpdate?.(nextSession)
  }

  if (!open || !section) return null

  return (
    <div className="candidate-modal fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-[#020611]/82 px-4 py-6 text-white backdrop-blur-xl sm:px-6 sm:py-10">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(255,179,49,0.18),transparent_28%),radial-gradient(circle_at_82%_16%,rgba(31,111,184,0.28),transparent_34%)]" />
      <section className="candidate-modal-card relative mx-auto w-full max-w-5xl rounded-[2rem] border border-white/12 bg-[#071426]/96 p-5 shadow-[0_30px_120px_rgba(0,0,0,0.55)] sm:p-8">
        <div className="candidate-modal-head flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="luva-kicker">{meta.kicker}</p>
            <h2 className="mt-3 font-display text-3xl font-black text-white sm:text-5xl">{meta.title}</h2>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-slate-200">{meta.description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="candidate-close-button inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white bg-white text-[#061322] shadow-[0_14px_32px_rgba(255,255,255,0.12)] transition hover:border-luva-amber hover:bg-luva-amber hover:text-[#061322]"
            aria-label="Fechar edição"
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="mt-6 rounded-2xl border border-white/12 bg-white/[0.04] p-5 text-sm font-bold text-slate-200">
            Carregando dados...
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 grid gap-4 md:grid-cols-2">
            {tipo === 'equipe' && (
              <EquipeFields
                section={section}
                form={form}
                setField={setField}
                setNested={setNested}
                disabled={!canEdit}
                searchCep={searchCep}
                cepLoading={cepLoading}
                cepMessage={cepMessage}
              />
            )}
            {tipo === 'arbitro' && <ArbitroFields section={section} form={form} setField={setField} disabled={!canEdit} />}
            {tipo === 'quadra' && (
              <QuadraFields
                section={section}
                form={form}
                setField={setField}
                disabled={!canEdit}
                searchCep={searchCep}
                cepLoading={cepLoading}
                cepMessage={cepMessage}
              />
            )}

            {!pending && tipo !== 'equipe' && (
              <p className="md:col-span-2 rounded-2xl border border-luva-amber/25 bg-luva-amber/10 p-4 text-sm font-bold text-slate-100">
                Esta candidatura já saiu da etapa de análise. Para alterar dados agora, fale com a organização.
              </p>
            )}

            {feedback && (
              <div
                className={`md:col-span-2 flex items-start gap-3 rounded-2xl border p-4 text-sm font-bold ${
                  feedback.type === 'success'
                    ? 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100'
                    : 'border-red-300/30 bg-red-500/10 text-red-100'
                }`}
              >
                {feedback.type === 'success' && <CheckCircle2 size={18} className="mt-0.5 shrink-0" />}
                <span>{feedback.text}</span>
              </div>
            )}

            <div className="md:col-span-2 mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={onClose} className="candidate-cancel-button rounded-xl border px-5 py-3 text-sm font-black transition">
                Fechar
              </button>
              <ActionBar
                type="submit"
                loading={saving}
                disabled={!canEdit}
                loadingLabel="Salvando"
                className="candidate-save-button inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-black uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Save size={18} />
                Salvar alterações
              </ActionBar>
            </div>
          </form>
        )}
      </section>
    </div>
  )
}

function EquipeFields({
  section,
  form,
  setField,
  setNested,
  disabled,
  searchCep,
  cepLoading,
  cepMessage,
}: {
  section: CandidateEditSection
  form: FormState
  setField: (name: string, value: FormValue) => void
  setNested: (group: string, name: string, value: boolean | string) => void
  disabled: boolean
  searchCep: () => Promise<void>
  cepLoading: boolean
  cepMessage: string | null
}) {
  const horarios = form.horarios as Record<string, boolean>
  const quadraInfo = form.quadraInfo as Record<string, boolean | string>
  const selectedDias = (form.diasDisponiveis as string[]) || []

  if (section === 'disponibilidade') {
    return (
      <>
        <ChoiceGroup title="Dias disponíveis para jogos" options={dias} selected={selectedDias} onChange={(next) => setField('diasDisponiveis', next)} disabled={disabled} />
        <div className="md:col-span-2">
          <p className={labelClass}>Períodos disponíveis</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              ['manha', 'Manhã'],
              ['tarde', 'Tarde'],
              ['noite', 'Noite'],
            ].map(([key, label]) => (
              <ToggleButton key={key} active={Boolean(horarios?.[key])} disabled={disabled} onClick={() => setNested('horarios', key, !horarios?.[key])}>
                {label}
              </ToggleButton>
            ))}
          </div>
        </div>
      </>
    )
  }

  if (section === 'quadra') {
    return (
      <>
        <Input label="CEP da quadra" value={formatCep(String(quadraInfo?.cep || ''))} onChange={(value) => setNested('quadraInfo', 'cep', formatCep(value))} onBlur={searchCep} disabled={disabled} />
        <Input label="Endereço da quadra" value={String(quadraInfo?.endereco || '')} onChange={(value) => setNested('quadraInfo', 'endereco', value)} disabled={disabled} />
        <Input label="Bairro" value={String(quadraInfo?.bairro || '')} onChange={(value) => setNested('quadraInfo', 'bairro', value)} disabled={disabled} />
        <CepFeedback cepLoading={cepLoading} cepMessage={cepMessage} />
        <Input label="Tipo de piso" value={String(quadraInfo?.piso || '')} onChange={(value) => setNested('quadraInfo', 'piso', value)} disabled={disabled} />
        <Toggle label="Quadra coberta" checked={Boolean(quadraInfo?.cobertura)} onChange={(value) => setNested('quadraInfo', 'cobertura', value)} disabled={disabled} />
        <Toggle label="Possui banheiro" checked={Boolean(quadraInfo?.banheiro)} onChange={(value) => setNested('quadraInfo', 'banheiro', value)} disabled={disabled} />
      </>
    )
  }

  return (
    <>
      <Input label="Nome da equipe" value={String(form.nome || '')} onChange={(value) => setField('nome', value)} disabled={disabled} required />
      <Input label="Responsável pela equipe" value={String(form.responsavel || '')} onChange={(value) => setField('responsavel', value)} disabled={disabled} required />
      <Input label="Telefone" value={String(form.telefone || '')} onChange={(value) => setField('telefone', value)} disabled={disabled} />
      <EquipeEmblemaEdit form={form} setField={setField} disabled={disabled} />
      <div>
        <label className={labelClass}>Gênero da equipe</label>
        <select value={String(form.genero || 'MASCULINO')} onChange={(event) => setField('genero', event.target.value)} disabled={disabled} className={inputClass}>
          {generosEquipe.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      <div>
        <label className={labelClass}>Categoria etária</label>
        <select value={String(form.categoriaEtaria || 'ADULTO')} onChange={(event) => setField('categoriaEtaria', event.target.value)} disabled={disabled} className={inputClass}>
          {categoriasEtariasEquipe.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      <div className="md:col-span-2">
        <p className={labelClass}>Nível autodeclarado</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {niveisEquipe.map((option) => (
            <ToggleButton key={option.value} active={form.nivel === option.value} disabled={disabled} onClick={() => setField('nivel', option.value)}>
              {option.label}
            </ToggleButton>
          ))}
        </div>
      </div>
      <Toggle label="Equipe tem Instagram?" checked={Boolean(form.temInstagram)} onChange={(value) => setField('temInstagram', value)} disabled={disabled} />
      {form.temInstagram && <Input label="@ do Instagram" value={String(form.instagram || '')} onChange={(value) => setField('instagram', value.replace(/^@/, ''))} disabled={disabled} />}
    </>
  )
}

function EquipeEmblemaEdit({ form, setField, disabled }: BasicFieldProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const emblemaUrl = String(form.emblemaUrl || '')

  async function uploadEmblema(file: File | null) {
    if (!file || disabled) return

    setError('')
    setInfo('')

    try {
      setUploading(true)
      const optimized = await optimizeImageFile(file, `emblema-${String(form.nome || 'equipe')}`)

      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current)
        return optimized.previewUrl
      })

      let publicUrl: string | null
      try {
        publicUrl = (await enviarArquivoAssinado({ tipo: 'candidatura-emblema', arquivo: optimized.file })).urlPublica
      } catch (erroEnvio) {
        setField('emblemaUrl', '')
        setError(erroEnvio instanceof ErroUpload ? erroEnvio.message : 'Não foi possível enviar o emblema. Tente novamente.')
        return
      }
      if (!publicUrl) {
        setField('emblemaUrl', '')
        setError('Não foi possível obter o link público do emblema.')
        return
      }

      setField('emblemaUrl', publicUrl)
      setInfo(`Imagem otimizada: ${formatBytes(optimized.originalBytes)} para ${formatBytes(optimized.optimizedBytes)}.`)
    } catch (uploadError) {
      setField('emblemaUrl', '')
      setError(uploadError instanceof Error ? uploadError.message : 'Não foi possível processar a imagem selecionada.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="md:col-span-2">
      <span className={labelClass}>Emblema da equipe</span>
      {uploading ? <LoadingTrack label="Enviando" className="mt-2 w-full rounded-2xl" /> : (
      <label className={`candidate-upload-card mt-2 flex cursor-pointer items-center gap-4 rounded-2xl border border-white/12 bg-white/[0.04] p-4 transition hover:border-luva-amber/70 ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}>
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/12 bg-[#071426] text-luva-amber">
          {previewUrl || emblemaUrl ? (
            <img src={previewUrl || emblemaUrl} alt="Prévia do emblema" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon size={28} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-white">Enviar emblema da equipe</p>
          <p className="mt-1 text-xs font-bold leading-relaxed text-slate-300">
            {imageUploadRules.allowedLabel}. Até {formatBytes(imageUploadRules.maxOriginalBytes)}; a imagem é comprimida automaticamente.
          </p>
          {info && <p className="mt-2 text-xs font-black text-emerald-200">{info}</p>}
          {error && <p className="mt-2 text-xs font-black text-red-200">{error}</p>}
        </div>
        <input
          type="file"
          accept={imageUploadRules.allowedTypes.join(',')}
          className="sr-only"
          disabled={disabled || uploading}
          onChange={(event) => {
            uploadEmblema(event.target.files?.[0] || null)
            event.currentTarget.value = ''
          }}
        />
      </label>
      )}
    </div>
  )
}

function ArbitroFields({ section, form, setField, disabled }: BasicFieldProps & { section: CandidateEditSection }) {
  if (section === 'credenciais') {
    return (
      <>
        <Input label="CREF ou registro" value={String(form.cref || '')} onChange={(value) => setField('cref', value)} disabled={disabled} />
        <Input label="Link de certificado" value={String(form.diplomaUrl || '')} onChange={(value) => setField('diplomaUrl', value)} disabled={disabled} />
      </>
    )
  }

  return (
    <>
      <Input label="Nome completo" value={String(form.nome || '')} onChange={(value) => setField('nome', value)} disabled={disabled} required />
      <Input label="Telefone" value={String(form.telefone || '')} onChange={(value) => setField('telefone', value)} disabled={disabled} />
    </>
  )
}

function QuadraFields({
  section,
  form,
  setField,
  disabled,
  searchCep,
  cepLoading,
  cepMessage,
}: BasicFieldProps & {
  section: CandidateEditSection
  searchCep: () => Promise<void>
  cepLoading: boolean
  cepMessage: string | null
}) {
  if (section === 'localizacao') {
    return (
      <>
        <Input label="CEP" value={formatCep(String(form.cep || ''))} onChange={(value) => setField('cep', formatCep(value))} onBlur={searchCep} disabled={disabled} />
        <Input label="Endereço" value={String(form.endereco || '')} onChange={(value) => setField('endereco', value)} disabled={disabled} required />
        <Input label="Bairro" value={String(form.bairro || '')} onChange={(value) => setField('bairro', value)} disabled={disabled} />
        <CepFeedback cepLoading={cepLoading} cepMessage={cepMessage} />
      </>
    )
  }

  if (section === 'disponibilidade') {
    const agenda = (form.horarios as { horariosDisponiveis?: Array<{ diaSemana: string; horaInicio: string; horaFim: string }> }) || {}
    const horariosDisponiveis = agenda.horariosDisponiveis?.length ? agenda.horariosDisponiveis : [{ diaSemana: 'Sabado', horaInicio: '14:00', horaFim: '18:00' }]

    const setHorario = (index: number, field: 'diaSemana' | 'horaInicio' | 'horaFim', value: string) => {
      const next = horariosDisponiveis.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item)
      setField('horarios', { horariosDisponiveis: next })
    }

    const addHorario = () => {
      setField('horarios', { horariosDisponiveis: [...horariosDisponiveis, { diaSemana: '', horaInicio: '', horaFim: '' }] })
    }

    const removeHorario = (index: number) => {
      const next = horariosDisponiveis.filter((_, itemIndex) => itemIndex !== index)
      setField('horarios', { horariosDisponiveis: next.length ? next : [{ diaSemana: '', horaInicio: '', horaFim: '' }] })
    }

    return (
      <>
        <div className="md:col-span-2">
          <p className={labelClass}>Dias e horários disponíveis</p>
          <div className="grid gap-2">
            {horariosDisponiveis.map((item, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[1fr_140px_140px_44px]">
                <select value={item.diaSemana} onChange={(event) => setHorario(index, 'diaSemana', event.target.value)} disabled={disabled} className={inputClass}>
                  <option value="">Selecionar dia</option>
                  {dias.map((dia) => <option key={dia} value={dia}>{displayDay(dia)}</option>)}
                </select>
                <input type="time" aria-label="Horário inicial" value={item.horaInicio} onChange={(event) => setHorario(index, 'horaInicio', event.target.value)} disabled={disabled} className={inputClass} />
                <input type="time" aria-label="Horário final" value={item.horaFim} onChange={(event) => setHorario(index, 'horaFim', event.target.value)} disabled={disabled} className={inputClass} />
                <button
                  type="button"
                  onClick={() => removeHorario(index)}
                  disabled={disabled || horariosDisponiveis.length === 1}
                  className="flex h-[46px] items-center justify-center rounded-xl border border-white/15 bg-white/[0.045] text-white/72 transition hover:border-red-300/70 hover:bg-red-500/15 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-35"
                  aria-label="Remover horário disponível"
                >
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
            <button type="button" onClick={addHorario} disabled={disabled} className="candidate-card-edit inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-45">
              <Plus size={17} />
              Adicionar outro dia e horário
            </button>
          </div>
        </div>
      </>
    )
  }

  if (section === 'estrutura') {
    return (
      <>
        <Textarea label="Estrutura" value={String(form.estrutura || '')} onChange={(value) => setField('estrutura', value)} disabled={disabled} />
        <Toggle label="Cobertura" checked={Boolean(form.cobertura)} onChange={(value) => setField('cobertura', value)} disabled={disabled} />
        <Toggle label="Banheiro" checked={Boolean(form.banheiro)} onChange={(value) => setField('banheiro', value)} disabled={disabled} />
        <Toggle label="Estacionamento" checked={Boolean(form.estacionamento)} onChange={(value) => setField('estacionamento', value)} disabled={disabled} />
        <FotosQuadraEdit form={form} setField={setField} disabled={disabled} />
      </>
    )
  }

  return (
    <>
      <Input label="Nome da quadra/arena" value={String(form.nome || '')} onChange={(value) => setField('nome', value)} disabled={disabled} required />
      <Input label="Responsável" value={String(form.responsavel || '')} onChange={(value) => setField('responsavel', value)} disabled={disabled} required />
      <Input label="Telefone" value={String(form.telefone || '')} onChange={(value) => setField('telefone', value)} disabled={disabled} />
    </>
  )
}

function FotosQuadraEdit({ form, setField, disabled }: BasicFieldProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fotos = Array.isArray(form.fotosUrls) ? form.fotosUrls.map(String) : []

  async function uploadFotos(files: FileList | null) {
    if (!files?.length || disabled) return
    setError('')
    setUploading(true)

    const uploaded: string[] = []
    for (const file of Array.from(files).slice(0, Math.max(0, 8 - fotos.length))) {
      if (!file.type.startsWith('image/')) {
        setError('Envie apenas imagens da quadra.')
        continue
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('Cada foto deve ter no máximo 5 MB.')
        continue
      }

      try {
        const envio = await enviarArquivoAssinado({ tipo: 'quadra-foto', arquivo: file })
        if (envio.urlPublica) uploaded.push(envio.urlPublica)
      } catch (erroEnvio) {
        setError(erroEnvio instanceof ErroUpload ? erroEnvio.message : 'Não foi possível enviar uma das fotos. Tente novamente.')
      }
    }

    if (uploaded.length) setField('fotosUrls', [...fotos, ...uploaded].slice(0, 8))
    setUploading(false)
  }

  return (
    <div className="md:col-span-2">
      <p className={labelClass}>Fotos da quadra para aprovação</p>
      <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-luva-amber/45 bg-luva-amber/10 px-4 py-5 text-center transition hover:border-luva-amber hover:bg-luva-amber/15">
        <Plus size={22} className="text-luva-amber" />
        <span className="mt-2 text-sm font-black text-white">Adicionar fotos da quadra</span>
        <span className="mt-1 text-xs font-semibold text-white/62">Até 8 imagens, 5 MB cada.</span>
        <input
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          disabled={disabled || uploading || fotos.length >= 8}
          onChange={(event) => {
            uploadFotos(event.target.files)
            event.currentTarget.value = ''
          }}
        />
      </label>
      {uploading && <p className="mt-2 text-xs font-bold text-luva-amber">Enviando fotos...</p>}
      {error && <p className="mt-2 text-xs font-bold text-red-200">{error}</p>}
      {fotos.length > 0 && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {fotos.map((url) => (
            <div key={url} className="group relative overflow-hidden rounded-2xl border border-white/12 bg-white/[0.04]">
              <img src={url} alt="Foto da quadra" className="h-36 w-full object-cover" />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => setField('fotosUrls', fotos.filter((foto) => foto !== url))}
                  className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-[#071426]/90 text-white shadow-lg transition hover:bg-red-500"
                  aria-label="Remover foto"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

type BasicFieldProps = {
  form: FormState
  setField: (name: string, value: FormValue) => void
  disabled: boolean
}

function Input({ label, value, onChange, onBlur, disabled, required, className = '' }: { label: string; value: string; onChange: (value: string) => void; onBlur?: () => void; disabled: boolean; required?: boolean; className?: string }) {
  return (
    <label className={className}>
      <span className={labelClass}>{label}{required && <span className="text-luva-amber"> *</span>}</span>
      <input className={inputClass} value={value} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} disabled={disabled} required={required} />
    </label>
  )
}

function CepFeedback({ cepLoading, cepMessage }: { cepLoading: boolean; cepMessage: string | null }) {
  if (!cepLoading && !cepMessage) return null
  return (
    <div className="md:col-span-2 rounded-xl border border-white/12 bg-white/[0.04] px-4 py-3 text-xs font-bold text-slate-200">
      {cepLoading ? 'Buscando endereco pelo CEP...' : cepMessage}
    </div>
  )
}

function Textarea({ label, value, onChange, disabled }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean }) {
  return (
    <label className="md:col-span-2">
      <span className={labelClass}>{label}</span>
      <textarea className={`${inputClass} min-h-28 resize-y`} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} />
    </label>
  )
}

function Toggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (value: boolean) => void; disabled: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={() => onChange(!checked)} className={`candidate-toggle rounded-xl border px-3 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${checked ? 'is-active' : ''}`}>
      {label}
    </button>
  )
}

function ChoiceGroup({ title, options, selected, onChange, disabled }: { title: string; options: string[]; selected: string[]; onChange: (value: string[]) => void; disabled: boolean }) {
  return (
    <div className="md:col-span-2">
      <p className={labelClass}>{title}</p>
      <div className="grid gap-2 sm:grid-cols-4">
        {options.map((option) => {
          const active = selected.includes(option)
          return (
            <ToggleButton
              key={option}
              active={active}
              disabled={disabled}
              onClick={() => onChange(active ? selected.filter((item) => item !== option) : [...selected, option])}
            >
              {displayDay(option)}
            </ToggleButton>
          )
        })}
      </div>
    </div>
  )
}

function ToggleButton({ active, disabled, onClick, children }: { active: boolean; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`candidate-toggle rounded-xl border px-3 py-2.5 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${active ? 'is-active' : ''}`}>
      {children}
    </button>
  )
}

function normalizeInitialForm(tipo: CandidaturaTipo, row: Record<string, unknown>): FormState {
  if (tipo === 'equipe') {
    return {
      nome: String(row.nome || ''),
      responsavel: String(row.responsavel || ''),
      telefone: String(row.telefone || ''),
      emblemaUrl: String(row.emblemaUrl || ''),
      genero: String(row.genero || row.categoria || 'MASCULINO'),
      categoriaEtaria: String(row.categoriaEtaria || 'ADULTO'),
      nivel: String(row.nivel || 'INTERMEDIARIO'),
      temInstagram: Boolean(row.temInstagram),
      instagram: String(row.instagram || ''),
      diasDisponiveis: parseJsonArray(row.diasDisponiveis),
      horarios: parseJsonObject(row.horarios, { manha: false, tarde: false, noite: true }),
      quadraInfo: parseJsonObject(row.quadraInfo, { cobertura: false, banheiro: false, piso: '', cep: '', endereco: '', bairro: '' }),
    }
  }
  if (tipo === 'arbitro') return { nome: String(row.nome || ''), telefone: String(row.telefone || ''), cref: String(row.cref || ''), diplomaUrl: String(row.diplomaUrl || '') }
  return {
    nome: String(row.nome || ''),
    responsavel: String(row.responsavel || ''),
    telefone: String(row.telefone || ''),
    cep: String(row.cep || ''),
    endereco: String(row.endereco || ''),
    bairro: String(row.bairro || ''),
    estrutura: String(row.estrutura || ''),
    horarios: normalizeQuadraHorarios(row.horarios),
    fotosUrls: parseJsonArray(row.fotosUrls),
    cobertura: Boolean(row.cobertura),
    banheiro: Boolean(row.banheiro),
    estacionamento: Boolean(row.estacionamento),
  }
}

function payloadByTipo(tipo: CandidaturaTipo, form: FormState) {
  const telefone = String(form.telefone || '').trim() || null

  if (tipo === 'equipe') {
    return {
      nome: form.nome,
      responsavel: form.responsavel,
      telefone,
      emblemaUrl: form.emblemaUrl,
      genero: form.genero || 'MASCULINO',
      categoriaEtaria: form.categoriaEtaria || 'ADULTO',
      nivel: form.nivel || 'INTERMEDIARIO',
      temInstagram: Boolean(form.temInstagram),
      instagram: form.instagram,
      diasDisponiveis: form.diasDisponiveis || [],
      horarios: form.horarios || { manha: false, tarde: false, noite: true },
      quadraInfo: form.quadraInfo || {},
    }
  }
  if (tipo === 'arbitro') return { nome: form.nome, telefone, cref: form.cref, diplomaUrl: form.diplomaUrl }
  return {
    ...form,
    telefone,
    horarios: form.horarios || { horariosDisponiveis: [] },
    fotosUrls: form.fotosUrls || [],
  }
}

function modalMeta(tipo: CandidaturaTipo, section: CandidateEditSection | null) {
  const map: Record<string, { kicker: string; title: string; description: string }> = {
    'equipe:cadastro': { kicker: 'Cadastro da equipe', title: 'Editar responsável e contato', description: 'Atualize apenas as informações de contato usadas pela organização durante a análise.' },
    'equipe:disponibilidade': { kicker: 'Agenda da equipe', title: 'Editar disponibilidade', description: 'Ajuste dias e períodos em que a equipe pode participar dos jogos.' },
    'equipe:quadra': { kicker: 'Estrutura da equipe', title: 'Editar dados da quadra', description: 'Informe local, piso e estrutura caso a equipe tenha uma quadra para ceder.' },
    'arbitro:cadastro': { kicker: 'Cadastro do árbitro', title: 'Editar dados pessoais', description: 'Atualize nome e telefone de contato usados pela organização.' },
    'arbitro:credenciais': { kicker: 'Credenciais', title: 'Editar registro e certificado', description: 'Atualize CREF, registro ou link de comprovação profissional.' },
    'quadra:arena': { kicker: 'Arena parceira', title: 'Editar dados da quadra', description: 'Atualize identificação do local, responsável e telefone.' },
    'quadra:localizacao': { kicker: 'Localização', title: 'Editar endereço', description: 'Revise CEP, endereço e bairro para análise da organização.' },
    'quadra:disponibilidade': { kicker: 'Disponibilidade', title: 'Editar horários disponíveis', description: 'Informe quando a quadra pode receber jogos da liga.' },
    'quadra:estrutura': { kicker: 'Estrutura', title: 'Editar recursos do local', description: 'Descreva infraestrutura, cobertura, banheiro e estacionamento.' },
  }
  return map[`${tipo}:${section}`] || { kicker: 'Dados cadastrais', title: 'Editar candidatura', description: 'Atualize as informações permitidas enquanto a candidatura está em análise.' }
}

function parseJsonArray(value: unknown) {
  if (Array.isArray(value)) return value.map(String)
  if (typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

function parseJsonObject(value: unknown, fallback: Record<string, unknown>) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  if (typeof value !== 'string') return fallback
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : fallback
  } catch {
    return fallback
  }
}

function normalizeQuadraHorarios(value: unknown) {
  const parsed = parseJsonObject(value, { horariosDisponiveis: [] }) as {
    horariosDisponiveis?: Array<{ diaSemana: string; horario?: string; horaInicio?: string; horaFim?: string }>
    diasDisponiveis?: string[]
    periodos?: Record<string, boolean>
  }

  if (Array.isArray(parsed.horariosDisponiveis)) {
    return {
      horariosDisponiveis: parsed.horariosDisponiveis.map((item) => ({
        diaSemana: item.diaSemana,
        horaInicio: item.horaInicio || item.horario || '',
        horaFim: item.horaFim || '',
      })),
    }
  }

  const diasAntigos = Array.isArray(parsed.diasDisponiveis) ? parsed.diasDisponiveis : []
  const periodos = parsed.periodos || {}
  const primeiroPeriodo = Object.entries(periodos).find(([, active]) => Boolean(active))?.[0]
  const horarioPorPeriodo: Record<string, string> = { manha: '09:00', tarde: '14:00', noite: '19:00' }

  return {
    horariosDisponiveis: diasAntigos.map((dia) => ({
      diaSemana: dia === 'Terça' ? 'Terca' : dia === 'Sábado' ? 'Sabado' : dia,
      horaInicio: horarioPorPeriodo[primeiroPeriodo || 'tarde'] || '14:00',
      horaFim: primeiroPeriodo === 'manha' ? '12:00' : primeiroPeriodo === 'noite' ? '22:00' : '18:00',
    })),
  }
}

function displayDay(day: string) {
  if (day === 'Terca') return 'Terça'
  if (day === 'Sabado') return 'Sábado'
  return day
}
