'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, CheckCircle2, Copy, ImagePlus, Pencil, Plus, Trash2, X } from 'lucide-react'
import { ActionBar, LoadingTrack } from '@/components/ui/action-bar'
import { supabase } from '@/lib/supabase'
import { optimizeImageFile } from '@/lib/client-image-upload'
import type { ResolvedFormularioRapidaConfig, CategoriaSerieOption } from '@/lib/inscricao-rapida'
import { mensagemElegibilidade, type ElegibilidadeCategoria } from '@/lib/elegibilidade-categoria'

const POSICOES = ['Levantador', 'Oposto', 'Central', 'Ponteiro', 'Líbero']
const DOCUMENT_TYPES = [
  { value: 'CPF', label: 'CPF' }, { value: 'CIN', label: 'CIN' },
  { value: 'CTPS', label: 'Carteira Profissional' }, { value: 'RG', label: 'RG' },
  { value: 'PASSAPORTE', label: 'Passaporte' }, { value: 'OUTRO', label: 'Outro' },
]

export type JogadorDraft = {
  id?: string | number
  nome: string
  numero: string
  posicao: string
  fotoUrl: string
  cpf: string
  dataNascimento: string
  documentoTipo: string
  documentoNumero: string
  sexo: string
}

export type InscricaoRapidaInitialData = {
  nomeEquipe: string
  logoUrl: string | null
  lider: string | null
  tecnico: string | null
  categoria: string | null
  serie: string | null
  status: 'RASCUNHO' | 'ENVIADA'
  jogadores: Array<{
    id: string | number
    nome: string
    numero: number | null
    posicao: string | null
    fotoUrl: string | null
    cpf: string | null
    dataNascimento: string | null
    documentoTipo: string | null
    documentoNumero: string | null
    sexo?: string | null
  }>
}

const emptyJogador: JogadorDraft = {
  nome: '', numero: '', posicao: '', fotoUrl: '', cpf: '', dataNascimento: '', documentoTipo: 'CPF', documentoNumero: '', sexo: '',
}

const SEXOS = [
  { value: 'NAO', label: 'Não informar' },
  { value: 'FEMININO', label: 'Feminino' },
  { value: 'MASCULINO', label: 'Masculino' },
]

function FloatingInput({ id, label, value, onChange, type = 'text', required, disabled, locked = false }: {
  id: string; label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; disabled?: boolean; locked?: boolean
}) {
  const [focused, setFocused] = useState(false)
  const floated = locked || focused || value.length > 0

  return (
    <div className="relative">
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        readOnly={locked}
        disabled={disabled}
        autoComplete="off"
        onChange={(event) => { if (!locked) onChange(event.target.value) }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`w-full rounded-xl border border-white/10 bg-[#07111f] px-3 text-sm font-bold text-white outline-none transition-[border-color] focus:border-luva-amber ${floated ? 'pb-1.5 pt-5' : 'py-3.5'} ${locked ? 'cursor-default' : 'disabled:cursor-not-allowed disabled:opacity-60'}`}
      />
      <label htmlFor={id} className={`pointer-events-none absolute left-3 ${floated ? 'top-1.5 text-[9px] font-black uppercase tracking-wide text-luva-amber' : 'top-1/2 -translate-y-1/2 text-xs font-bold normal-case tracking-normal text-slate-500'}`}>
        {label}{required && ' *'}
      </label>
    </div>
  )
}

function FloatingSelect({ id, label, value, onChange, options, required, disabled }: {
  id: string; label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; required?: boolean; disabled?: boolean
}) {
  return (
    <div className="relative">
      <select id={id} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}
        className="peer w-full appearance-none rounded-xl border border-white/10 bg-[#07111f] px-3 pb-1.5 pt-4 text-sm font-bold text-white outline-none transition focus:border-luva-amber disabled:cursor-not-allowed disabled:opacity-60">
        <option value="" disabled hidden></option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <label htmlFor={id} className={`pointer-events-none absolute left-3 text-[9px] font-black uppercase tracking-wide transition-all ${value ? 'top-1 text-luva-amber' : 'top-3 text-xs font-bold normal-case tracking-normal text-slate-500'} peer-focus:top-1 peer-focus:text-[9px] peer-focus:font-black peer-focus:uppercase peer-focus:tracking-wide peer-focus:text-luva-amber`}>
        {label}{required && ' *'}
      </label>
    </div>
  )
}

async function uploadOptimizedImage(bucket: string, folder: string, file: File, outputName: string) {
  const optimized = await optimizeImageFile(file, outputName)
  const extension = optimized.file.type === 'image/webp' ? 'webp' : 'jpg'
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`
  const { error } = await supabase.storage.from(bucket).upload(fileName, optimized.file, { upsert: false, contentType: optimized.file.type, cacheControl: '3600' })
  if (error) throw new Error(`Não foi possível enviar a imagem. Verifique o bucket ${bucket} no Supabase.`)
  const { data } = supabase.storage.from(bucket).getPublicUrl(fileName)
  if (!data.publicUrl) throw new Error('Não foi possível obter o link público da imagem.')
  return data.publicUrl
}

function toDraft(player: InscricaoRapidaInitialData['jogadores'][number]): JogadorDraft {
  return {
    id: player.id, nome: player.nome, numero: player.numero == null ? '' : String(player.numero),
    posicao: player.posicao || '', fotoUrl: player.fotoUrl || '', cpf: player.cpf || '',
    dataNascimento: player.dataNascimento ? player.dataNascimento.slice(0, 10) : '',
    documentoTipo: player.documentoTipo || 'CPF', documentoNumero: player.documentoNumero || '',
    sexo: player.sexo || '',
  }
}

function jogadorPayload(player: JogadorDraft, config: ResolvedFormularioRapidaConfig, coletarSexo: boolean) {
  return {
    nome: player.nome,
    ...(config.atleta.numeroCamisa === 'disabled' ? {} : { numero: player.numero ? Number(player.numero) : undefined }),
    ...(config.atleta.posicao === 'disabled' ? {} : { posicao: player.posicao || undefined }),
    ...(config.atleta.foto === 'disabled' ? {} : { fotoUrl: player.fotoUrl || undefined }),
    ...(config.atleta.cpf === 'disabled' ? {} : { cpf: player.cpf || undefined }),
    ...(config.atleta.dataNascimento === 'disabled' ? {} : { dataNascimento: player.dataNascimento || undefined }),
    ...(config.atleta.documento === 'disabled' ? {} : {
      documentoTipo: player.documentoTipo || undefined,
      documentoNumero: player.documentoNumero || undefined,
    }),
    ...(coletarSexo ? { sexo: player.sexo || null } : {}),
  }
}

export function FormularioInscricaoRapida({ ligaId, nomeCampeonato, config, categoriaFixa, categoriaOptions, token = null, linkToken = null, tokenCategoria = null, initialData = null, canEdit = true, canEditRoster = true, readOnlyReason = null, registrationStatus = null, elegibilidade = null }: {
  ligaId: number
  linkToken?: string | null
  tokenCategoria?: string | null
  nomeCampeonato: string
  config: ResolvedFormularioRapidaConfig
  categoriaFixa: CategoriaSerieOption | null
  categoriaOptions: CategoriaSerieOption[]
  token?: string | null
  initialData?: InscricaoRapidaInitialData | null
  canEdit?: boolean
  canEditRoster?: boolean
  readOnlyReason?: string | null
  registrationStatus?: string | null
  elegibilidade?: ElegibilidadeCategoria | null
}) {
  const router = useRouter()
  const [nomeEquipe, setNomeEquipe] = useState(initialData?.nomeEquipe || '')
  const [logoUrl, setLogoUrl] = useState(initialData?.logoUrl || '')
  const [lider, setLider] = useState(initialData?.lider || '')
  const [tecnico, setTecnico] = useState(initialData?.tecnico || '')
  const [categoriaSerie, setCategoriaSerie] = useState(initialData?.categoria && initialData?.serie ? `${initialData.categoria}:${initialData.serie}` : '')
  const [jogadores, setJogadores] = useState<JogadorDraft[]>(() => initialData?.jogadores.map(toDraft) || [])
  const [draft, setDraft] = useState<JogadorDraft>(emptyJogador)
  const [editingId, setEditingId] = useState<string | number | null>(null)
  const [addingJogador, setAddingJogador] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingFotoJogador, setUploadingFotoJogador] = useState(false)
  const [creating, setCreating] = useState(false)
  const [savingPlayer, setSavingPlayer] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [issues, setIssues] = useState<string[]>([])
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [successNome, setSuccessNome] = useState('')
  const [finalStatus, setFinalStatus] = useState<string | null>(registrationStatus)
  const [copied, setCopied] = useState(false)
  const autosaveReady = useRef(false)

  const logoEnabled = config.equipe.logo !== 'disabled'
  const logoRequired = config.equipe.logo === 'required'
  const liderEnabled = config.lider.nomeCompleto !== 'disabled'
  const liderRequired = config.lider.nomeCompleto === 'required'
  const numeroEnabled = config.atleta.numeroCamisa !== 'disabled'
  const numeroRequired = config.atleta.numeroCamisa === 'required'
  const posicaoEnabled = config.atleta.posicao !== 'disabled'
  const posicaoRequired = config.atleta.posicao === 'required'
  const fotoEnabled = config.atleta.foto !== 'disabled'
  const cpfEnabled = config.atleta.cpf !== 'disabled'
  const cpfRequired = config.atleta.cpf === 'required'
  const nascimentoEnabled = config.atleta.dataNascimento !== 'disabled'
  const nascimentoRequired = config.atleta.dataNascimento === 'required'
  const documentoEnabled = config.atleta.documento !== 'disabled'
  const documentoRequired = config.atleta.documento === 'required'
  const coletarSexo = Boolean(elegibilidade?.genero)

  useEffect(() => {
    if (!token || !canEdit) return
    if (!autosaveReady.current) {
      autosaveReady.current = true
      return
    }
    const timer = window.setTimeout(async () => {
      const [categoria, serie] = categoriaFixa ? [categoriaFixa.categoria, categoriaFixa.serie] : categoriaSerie.split(':')
      if (!nomeEquipe.trim() || !categoria || !serie) return
      if (liderRequired && !lider.trim()) return
      setSaveState('saving')
      try {
        const response = await fetch(`/api/inscricao-rapida/${token}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nomeEquipe, logoUrl: logoUrl || null, lider: lider || null, tecnico: tecnico || null, categoria, serie }),
        })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Não foi possível salvar as alterações.')
        setSaveState('saved')
      } catch (err) {
        setSaveState('error')
        setErrorMsg(err instanceof Error ? err.message : 'Não foi possível salvar as alterações.')
      }
    }, 700)
    return () => window.clearTimeout(timer)
  }, [token, canEdit, nomeEquipe, logoUrl, lider, tecnico, categoriaSerie, categoriaFixa, liderRequired])

  async function iniciarCadastro() {
    const [categoria, serie] = categoriaFixa ? [categoriaFixa.categoria, categoriaFixa.serie] : categoriaSerie.split(':')
    if (nomeEquipe.trim().length < 2 || !categoria || !serie) return
    setCreating(true)
    setErrorMsg('')
    try {
      const response = await fetch('/api/inscricao-rapida', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ligaId, nomeEquipe, categoria, serie, linkToken, tokenCategoria }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Não foi possível iniciar a inscrição.')
      router.replace(`/inscricao-rapida/${payload.data.token}`)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Não foi possível iniciar a inscrição.')
      setCreating(false)
    }
  }

  async function handleLogoUpload(file: File | null) {
    if (!file || !token) return
    setErrorMsg('')
    try {
      setUploadingLogo(true)
      setLogoUrl(await uploadOptimizedImage('equipe-emblemas', `inscricoes/${token}/emblemas`, file, `emblema-${nomeEquipe || 'equipe'}`))
    } catch (err) { setErrorMsg(err instanceof Error ? err.message : 'Erro ao enviar a logo.') }
    finally { setUploadingLogo(false) }
  }

  async function handleJogadorFotoUpload(file: File | null) {
    if (!file || !token) return
    setErrorMsg('')
    try {
      setUploadingFotoJogador(true)
      const url = await uploadOptimizedImage('jogador-fotos', `inscricoes/${token}/jogadores`, file, `jogador-${draft.nome || 'atleta'}`)
      setDraft((current) => ({ ...current, fotoUrl: url }))
    } catch (err) { setErrorMsg(err instanceof Error ? err.message : 'Erro ao enviar a foto.') }
    finally { setUploadingFotoJogador(false) }
  }

  async function salvarJogador() {
    if (!token || !draft.nome.trim()) return
    if (nascimentoRequired && !draft.dataNascimento) {
      setErrorMsg('Data de nascimento é obrigatória.')
      return
    }
    if (documentoRequired && !draft.documentoNumero.trim()) {
      setErrorMsg('Documento é obrigatório.')
      return
    }
    const regra = mensagemElegibilidade(elegibilidade, { sexo: draft.sexo || null, dataNascimento: draft.dataNascimento || null })
    if (regra) {
      setErrorMsg(regra)
      return
    }
    setSavingPlayer(true)
    setErrorMsg('')
    try {
      const editing = editingId !== null
      const response = await fetch(editing ? `/api/inscricao-rapida/${token}/jogadores/${editingId}` : `/api/inscricao-rapida/${token}/jogadores`, {
        method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(jogadorPayload(draft, config, coletarSexo)),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Não foi possível salvar o jogador.')
      const persisted = toDraft(payload.data)
      setJogadores((current) => editing ? current.map((player) => player.id === editingId ? persisted : player) : [...current, persisted])
      cancelarEdicaoJogador()
    } catch (err) { setErrorMsg(err instanceof Error ? err.message : 'Não foi possível salvar o jogador.') }
    finally { setSavingPlayer(false) }
  }

  function editarJogador(player: JogadorDraft) {
    setDraft(player)
    setEditingId(player.id ?? null)
    setAddingJogador(true)
  }

  function cancelarEdicaoJogador() {
    setAddingJogador(false)
    setDraft(emptyJogador)
    setEditingId(null)
  }

  async function removerJogador(player: JogadorDraft) {
    if (!token || player.id == null) return
    setErrorMsg('')
    try {
      const response = await fetch(`/api/inscricao-rapida/${token}/jogadores/${player.id}`, { method: 'DELETE' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Não foi possível excluir o jogador.')
      setJogadores((current) => current.filter((item) => item.id !== player.id))
    } catch (err) { setErrorMsg(err instanceof Error ? err.message : 'Não foi possível excluir o jogador.') }
  }

  async function handleSubmit() {
    if (!token) return
    setErrorMsg('')
    setIssues([])
    setSubmitting(true)
    try {
      const [categoria, serie] = categoriaFixa ? [categoriaFixa.categoria, categoriaFixa.serie] : categoriaSerie.split(':')
      const saveResponse = await fetch(`/api/inscricao-rapida/${token}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomeEquipe, logoUrl: logoUrl || null, lider: lider || null, tecnico: tecnico || null, categoria, serie }),
      })
      const savePayload = await saveResponse.json()
      if (!saveResponse.ok) throw new Error(savePayload.error || 'Não foi possível salvar os dados antes de concluir.')
      const response = await fetch(`/api/inscricao-rapida/${token}/finalizar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const payload = await response.json()
      if (!response.ok) {
        if (Array.isArray(payload.details)) setIssues(payload.details)
        throw new Error(payload.error || 'Erro ao concluir inscrição.')
      }
      setFinalStatus(payload.data.status)
      setSuccessNome(nomeEquipe)
    } catch (err) { setErrorMsg(err instanceof Error ? err.message : 'Erro ao concluir inscrição. Verifique sua conexão e tente novamente.') }
    finally { setSubmitting(false) }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  if (!token) {
    return (
      <main className="min-h-screen bg-[#040b16] px-4 py-8">
        <div className="mx-auto max-w-lg">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-luva-amber">Cadastro de equipe</p>
          <h1 className="mt-1 font-display text-2xl font-black leading-tight text-white">Inicie sua inscrição em {nomeCampeonato}</h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-400">Informe os dados mínimos para receber o link exclusivo que salva seu progresso.</p>
          {errorMsg && <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300">{errorMsg}</p>}
          <div className="mt-5 grid gap-3 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
            <FloatingInput id="nomeEquipe" label="Nome da equipe" value={nomeEquipe} onChange={setNomeEquipe} required />
            {categoriaFixa ? <FloatingInput id="nomeTorneio" label="Nome do torneio" value={nomeCampeonato} onChange={() => {}} locked /> : (
              <FloatingSelect id="categoriaSerie" label="Nome do torneio" value={categoriaSerie} onChange={setCategoriaSerie} required options={categoriaOptions.map((option) => ({ value: `${option.categoria}:${option.serie}`, label: option.label }))} />
            )}
            <ActionBar type="button" onClick={iniciarCadastro} loading={creating} loadingLabel="Criando link" disabled={nomeEquipe.trim().length < 2 || (!categoriaFixa && !categoriaSerie)} className="mt-1 w-full rounded-full bg-[#ffb331] py-3 text-sm font-black text-slate-950 disabled:opacity-50">
              Iniciar e salvar cadastro
            </ActionBar>
          </div>
        </div>
      </main>
    )
  }

  if (successNome) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#040b16] px-4 py-10">
        <div className="w-full max-w-md rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-8 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white"><CheckCircle2 size={26} /></span>
          <h1 className="mt-5 font-display text-2xl font-black text-white">Inscrição enviada</h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">{successNome} foi enviada para {nomeCampeonato}. {finalStatus === 'SOLICITADA' ? 'A aprovação depende do organizador.' : ''}</p>
          <button type="button" onClick={copyLink} className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs font-black text-white"><Copy size={14} /> Copiar link desta inscrição</button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#040b16] px-4 py-8">
      <div className="mx-auto max-w-lg">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-luva-amber">Cadastro de equipe</p>
        <h1 className="mt-1 font-display text-2xl font-black leading-tight text-white">Cadastre sua equipe para {nomeCampeonato}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={copyLink} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-black text-white">{copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}{copied ? 'Link copiado' : 'Copiar link desta inscrição'}</button>
          <span className="text-[11px] font-semibold text-slate-400">Use este link para continuar o cadastro depois.</span>
        </div>
        {initialData?.status === 'ENVIADA' && <p className="mt-4 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-100">Esta inscrição já foi enviada{registrationStatus === 'SOLICITADA' ? ' e aguarda aprovação' : ''}.</p>}
        {!canEdit && <p className="mt-4 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-100">Modo somente leitura. {readOnlyReason}</p>}
        {errorMsg && <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300">{errorMsg}</p>}
        {issues.length > 0 && <ul className="mt-2 list-disc rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-2 text-xs font-bold text-red-300">{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>}
        {canEdit && <p className={`mt-3 text-right text-[10px] font-bold uppercase tracking-wide ${saveState === 'error' ? 'text-red-300' : 'text-slate-500'}`}>{saveState === 'saving' ? 'Salvando...' : saveState === 'saved' ? 'Alterações salvas' : saveState === 'error' ? 'Falha ao salvar' : ''}</p>}

        <div className="mt-3 grid gap-3 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
          <FloatingInput id="nomeEquipe" label="Nome da equipe" value={nomeEquipe} onChange={setNomeEquipe} required disabled={!canEdit} />
          {logoEnabled && <div className="flex items-center gap-3">{logoUrl ? <img src={logoUrl} alt="Logo da equipe" className="h-11 w-11 rounded-full border border-white/10 object-cover" /> : <span className="flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-white/15 text-slate-500"><ImagePlus size={16} /></span>}{canEdit && (uploadingLogo ? <LoadingTrack label="Enviando" className="min-w-[12rem]" /> : <label className="cursor-pointer text-xs font-black uppercase tracking-wide text-luva-amber">{`Logo da equipe${logoRequired ? ' *' : ' (opcional)'}`}<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => handleLogoUpload(event.target.files?.[0] ?? null)} /></label>)}</div>}
          {categoriaFixa ? <FloatingInput id="nomeTorneio" label="Nome do torneio" value={nomeCampeonato} onChange={() => {}} locked /> : <FloatingSelect id="categoriaSerie" label="Nome do torneio" value={categoriaSerie} onChange={setCategoriaSerie} required disabled={!canEdit} options={categoriaOptions.map((option) => ({ value: `${option.categoria}:${option.serie}`, label: option.label }))} />}
          {liderEnabled && <FloatingInput id="lider" label="Líder da equipe" value={lider} onChange={setLider} required={liderRequired} disabled={!canEdit} />}
          <FloatingInput id="tecnico" label="Técnico (opcional)" value={tecnico} onChange={setTecnico} disabled={!canEdit} />
        </div>

        <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">Cadastro de jogadores</p>{canEditRoster && !addingJogador && <button type="button" onClick={() => setAddingJogador(true)} className="inline-flex items-center gap-1 rounded-full bg-[#ffb331] px-3 py-1.5 text-[11px] font-black text-slate-950"><Plus size={13} /> Novo jogador</button>}</div>
          {jogadores.length > 0 && <div className="mt-3 grid gap-1.5">{jogadores.map((player) => <div key={player.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#07111f] px-2.5 py-1.5"><p className="min-w-0 truncate text-xs font-bold text-slate-400">{player.nome}{player.numero && ` · #${player.numero}`}{player.posicao && ` · ${player.posicao}`}</p>{canEditRoster && <div className="flex shrink-0 items-center gap-2.5"><button type="button" onClick={() => editarJogador(player)} aria-label={`Editar ${player.nome}`} className="text-slate-500 hover:text-luva-amber"><Pencil size={13} /></button><button type="button" onClick={() => removerJogador(player)} aria-label={`Remover ${player.nome}`} className="text-slate-500 hover:text-red-400"><Trash2 size={13} /></button></div>}</div>)}</div>}
          {addingJogador && canEditRoster && <div className="mt-3 grid gap-2.5 rounded-xl border border-white/10 bg-[#07111f] p-3">
            <div className="flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{editingId !== null ? 'Editar jogador' : 'Novo jogador'}</p><button type="button" onClick={cancelarEdicaoJogador} aria-label="Cancelar" className="text-slate-500 hover:text-white"><X size={14} /></button></div>
            <FloatingInput id="jogadorNome" label="Nome completo" value={draft.nome} onChange={(value) => setDraft((current) => ({ ...current, nome: value }))} required />
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">{numeroEnabled && <FloatingInput id="jogadorNumero" label="Número" type="number" value={draft.numero} onChange={(value) => setDraft((current) => ({ ...current, numero: value }))} required={numeroRequired} />}{posicaoEnabled && <FloatingSelect id="jogadorPosicao" label="Posição" value={draft.posicao} onChange={(value) => setDraft((current) => ({ ...current, posicao: value }))} required={posicaoRequired} options={POSICOES.map((position) => ({ value: position, label: position }))} />}</div>
            {cpfEnabled && <FloatingInput id="jogadorCpf" label="CPF" value={draft.cpf} onChange={(value) => setDraft((current) => ({ ...current, cpf: value }))} required={cpfRequired} />}
            {nascimentoEnabled && <FloatingInput id="jogadorNascimento" label={nascimentoRequired ? 'Data de nascimento' : 'Data de nascimento (opcional)'} type="date" value={draft.dataNascimento} onChange={(value) => setDraft((current) => ({ ...current, dataNascimento: value }))} required={nascimentoRequired} />}
            {coletarSexo && <FloatingSelect id="jogadorSexo" label="Sexo (opcional)" value={draft.sexo || 'NAO'} onChange={(value) => setDraft((current) => ({ ...current, sexo: value === 'NAO' ? '' : value }))} options={SEXOS} />}
            {documentoEnabled && <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2"><FloatingSelect id="jogadorDocTipo" label={documentoRequired ? 'Documento' : 'Documento (opcional)'} value={draft.documentoTipo} onChange={(value) => setDraft((current) => ({ ...current, documentoTipo: value }))} required={documentoRequired} options={DOCUMENT_TYPES} /><FloatingInput id="jogadorDocNumero" label={documentoRequired ? 'Número do documento' : 'Número do documento (opcional)'} value={draft.documentoNumero} onChange={(value) => setDraft((current) => ({ ...current, documentoNumero: value }))} required={documentoRequired} /></div>}
            {fotoEnabled && <div className="flex items-center gap-3">{draft.fotoUrl ? <img src={draft.fotoUrl} alt="Foto do jogador" className="h-10 w-10 rounded-full border border-white/10 object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-white/15 text-slate-500"><ImagePlus size={14} /></span>}{uploadingFotoJogador ? <LoadingTrack label="Enviando" className="min-w-[12rem]" /> : <label className="cursor-pointer text-xs font-black uppercase tracking-wide text-luva-amber">Foto (opcional)<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => handleJogadorFotoUpload(event.target.files?.[0] ?? null)} /></label>}</div>}
            <ActionBar type="button" onClick={salvarJogador} loading={savingPlayer} loadingLabel="Salvando" disabled={!draft.nome.trim()} className="mt-1 w-full rounded-xl bg-[#ffb331] py-2.5 text-xs font-black text-slate-950 disabled:opacity-50">{editingId !== null ? 'Salvar alterações' : 'Salvar jogador'}</ActionBar>
          </div>}
        </div>
        {initialData?.status === 'RASCUNHO' && canEdit && <ActionBar type="button" onClick={handleSubmit} loading={submitting} loadingLabel="Concluindo" disabled={!nomeEquipe.trim() || (!categoriaFixa && !categoriaSerie) || jogadores.length === 0} className="mt-5 w-full rounded-full bg-[#ffb331] py-3.5 text-sm font-black text-slate-950 disabled:opacity-50">Concluir inscrição</ActionBar>}
      </div>
    </main>
  )
}
