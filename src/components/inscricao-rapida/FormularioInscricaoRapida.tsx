'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, CheckCircle2, ClipboardPaste, Copy, ImagePlus, Lock, MessageCircle, Pencil, Plus, Trash2, X } from 'lucide-react'
import { interpretarListaColada, localizarAtletaComProblema, motivoBloqueioConcluir, resumirElenco, separarNovosAtletas } from '@/lib/elenco-inscricao'
import { ActionBar, LoadingTrack } from '@/components/ui/action-bar'
import { supabase } from '@/lib/supabase'
import { optimizeImageFile } from '@/lib/client-image-upload'
import type { ResolvedFormularioRapidaConfig, CategoriaSerieOption } from '@/lib/inscricao-rapida'
import { mensagemElegibilidade, type ElegibilidadeCategoria } from '@/lib/elegibilidade-categoria'

const POSICOES = ['Levantador', 'Oposto', 'Central', 'Ponteiro', 'Líbero']
const DOCUMENT_TYPES = [
  { value: 'CPF', label: 'CPF' }, { value: 'CIN', label: 'Identidade nova (CIN)' },
  { value: 'CTPS', label: 'Carteira de trabalho' }, { value: 'RG', label: 'RG' },
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
    <div>
    <div className="relative">
      <input
        id={id}
        aria-describedby={locked ? `${id}-bloqueado` : undefined}
        name={id}
        type={type}
        value={value}
        readOnly={locked}
        aria-readonly={locked || undefined}
        disabled={disabled}
        autoComplete="off"
        onChange={(event) => { if (!locked) onChange(event.target.value) }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`w-full rounded-xl border border-white/10 bg-[#07111f] px-3 text-sm font-bold text-white outline-none transition-[border-color] focus:border-luva-amber ${floated ? 'pb-1.5 pt-5' : 'py-3.5'} ${locked ? 'cursor-not-allowed border-dashed bg-white/[0.03] pr-9 text-slate-300' : 'disabled:cursor-not-allowed disabled:opacity-60'}`}
      />
      {locked && <Lock size={14} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />}
      <label htmlFor={id} className={`pointer-events-none absolute left-3 ${floated ? 'top-1.5 text-[9px] font-black uppercase tracking-wide text-luva-amber' : 'top-1/2 -translate-y-1/2 text-xs font-bold normal-case tracking-normal text-slate-500'}`}>
        {label}{required && ' *'}
      </label>
    </div>
    {locked && <p id={`${id}-bloqueado`} className="mt-1 px-1 text-[11px] font-semibold text-slate-400">Definido pelo organizador. Não é possível alterar.</p>}
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
  if (error) throw new Error(`Não foi possível enviar a imagem. Tente uma foto menor ou envie de novo em instantes.`)
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

export function FormularioInscricaoRapida({ ligaId, nomeCampeonato, config, categoriaFixa, categoriaOptions, token = null, linkToken = null, tokenCategoria = null, initialData = null, canEdit = true, canEditRoster = true, readOnlyReason = null, registrationStatus = null, elegibilidade = null, elencoMinimo = null, elencoMaximo = null }: {
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
  elencoMinimo?: number | null
  elencoMaximo?: number | null
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
  const [copyFailed, setCopyFailed] = useState(false)
  const [colando, setColando] = useState(false)
  const [textoColado, setTextoColado] = useState('')
  const [importando, setImportando] = useState(false)
  const [avisoColar, setAvisoColar] = useState('')
  const [removendoConfirmarId, setRemovendoConfirmarId] = useState<string | number | null>(null)
  const [jogadorDestaqueId, setJogadorDestaqueId] = useState<string | number | null>(null)
  const autosaveReady = useRef(false)
  // Travas síncronas: o estado React só atualiza após o render, então um duplo clique rápido passaria por ele.
  const criandoRef = useRef(false)
  const salvandoJogadorRef = useRef(false)
  const importandoRef = useRef(false)
  const enviandoRef = useRef(false)

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
    if (criandoRef.current) return
    criandoRef.current = true
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
      criandoRef.current = false
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
    if (!token || !draft.nome.trim() || salvandoJogadorRef.current) return
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
    salvandoJogadorRef.current = true
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
    finally { salvandoJogadorRef.current = false; setSavingPlayer(false) }
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
    setRemovendoConfirmarId(null)
    try {
      const response = await fetch(`/api/inscricao-rapida/${token}/jogadores/${player.id}`, { method: 'DELETE' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Não foi possível excluir o jogador.')
      setJogadores((current) => current.filter((item) => item.id !== player.id))
    } catch (err) { setErrorMsg(err instanceof Error ? err.message : 'Não foi possível excluir o jogador.') }
  }

  async function handleSubmit() {
    if (!token || enviandoRef.current) return
    enviandoRef.current = true
    setJogadorDestaqueId(null)
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
        if (Array.isArray(payload.details)) {
          const problemas = payload.details.filter((item: unknown): item is string => typeof item === 'string')
          setIssues(problemas)
          irParaAtletaComProblema(localizarAtletaComProblema(problemas, jogadores))
        }
        throw new Error(payload.error || 'Erro ao concluir inscrição.')
      }
      setFinalStatus(payload.data.status)
      setSuccessNome(nomeEquipe)
    } catch (err) { setErrorMsg(err instanceof Error ? err.message : 'Erro ao concluir inscrição. Verifique sua conexão e tente novamente.') }
    finally { enviandoRef.current = false; setSubmitting(false) }
  }

  function irParaAtletaComProblema(id: string | number | null) {
    if (id == null) return
    setJogadorDestaqueId(id)
    // Espera o React pintar a lista de problemas antes de rolar até o atleta.
    window.setTimeout(() => {
      const alvo = document.getElementById(`jogador-${id}`)
      if (!alvo) return
      const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      alvo.scrollIntoView({ behavior: reduzir ? 'auto' : 'smooth', block: 'center' })
      alvo.focus({ preventScroll: true })
    }, 50)
  }

  const colagem = interpretarListaColada(textoColado)
  const vagasRestantes = elencoMaximo != null && elencoMaximo > 0 ? Math.max(0, elencoMaximo - jogadores.length) : Infinity
  const separacao = separarNovosAtletas(colagem.atletas, jogadores)

  async function importarLista() {
    if (!token || separacao.novos.length === 0 || importandoRef.current) return
    importandoRef.current = true
    setImportando(true)
    setErrorMsg('')
    setAvisoColar('')
    const aImportar = vagasRestantes === Infinity ? separacao.novos : separacao.novos.slice(0, vagasRestantes)
    const falhas: Array<{ nome: string; numero: string; motivo: string }> = []
    const salvos: JogadorDraft[] = []
    for (const atleta of aImportar) {
      try {
        const response = await fetch(`/api/inscricao-rapida/${token}/jogadores`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome: atleta.nome, ...(numeroEnabled && atleta.numero ? { numero: Number(atleta.numero) } : {}) }),
        })
        const payload = await response.json()
        if (!response.ok) { falhas.push({ ...atleta, motivo: payload.error || 'não foi possível salvar' }); continue }
        salvos.push(toDraft(payload.data))
      } catch {
        falhas.push({ ...atleta, motivo: 'sem conexão' })
      }
    }
    if (salvos.length) setJogadores((current) => [...current, ...salvos])
    const naoEntraram = colagem.ignoradas.length + separacao.repetidos.length + (separacao.novos.length - aImportar.length)
    const partes = [`${salvos.length} ${salvos.length === 1 ? 'atleta adicionado' : 'atletas adicionados'}.`]
    if (naoEntraram > 0) partes.push(`${naoEntraram} ${naoEntraram === 1 ? 'linha não entrou' : 'linhas não entraram'} (repetida, sem nome ou acima do máximo).`)
    if (falhas.length) partes.push(`Não salvou: ${falhas.map((f) => `${f.nome} (${f.motivo})`).join('; ')}.`)
    if (salvos.length) partes.push('Complete os demais dados de cada atleta tocando no lápis.')
    setAvisoColar(partes.join(' '))
    if (falhas.length === 0) { setTextoColado(''); setColando(false) } else {
      setTextoColado(falhas.map((f) => `${f.nome}${f.numero ? `, ${f.numero}` : ''}`).join('\n'))
    }
    importandoRef.current = false
    setImportando(false)
  }

  const resumoElenco = resumirElenco(jogadores.length, elencoMinimo, elencoMaximo)
  const motivoConcluir = motivoBloqueioConcluir({
    nomeEquipe, precisaCategoria: !categoriaFixa, categoriaEscolhida: Boolean(categoriaSerie),
    liderObrigatorio: liderEnabled && liderRequired, lider, total: jogadores.length, minimo: elencoMinimo, maximo: elencoMaximo,
  })

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopyFailed(false)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopyFailed(true)
    }
  }

  function linkWhatsApp() {
    const endereco = typeof window === 'undefined' ? '' : window.location.href
    return `https://wa.me/?text=${encodeURIComponent(`Link da inscrição da equipe em ${nomeCampeonato}: ${endereco}`)}`
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
            <ActionBar type="button" onClick={iniciarCadastro} loading={creating} loadingLabel="Preparando seu cadastro" disabled={nomeEquipe.trim().length < 2 || (!categoriaFixa && !categoriaSerie)} className="mt-1 w-full rounded-full bg-[#ffb331] py-3 text-sm font-black text-slate-950 disabled:opacity-50">
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
          <h1 className="mt-5 font-display text-2xl font-black text-white">Equipe cadastrada</h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">{successNome} foi cadastrada em {nomeCampeonato}. Guarde o link abaixo: com ele você volta e ajusta o elenco quando precisar.</p>
          <button type="button" onClick={copyLink} className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs font-black text-white">{copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />} {copied ? 'Link copiado' : 'Copiar link desta inscrição'}</button>
          <a href={linkWhatsApp()} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs font-black text-white"><MessageCircle size={14} /> Enviar por WhatsApp</a>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#040b16] px-4 py-8">
      <div className="mx-auto max-w-lg">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-luva-amber">Cadastro de equipe</p>
        <h1 className="mt-1 font-display text-2xl font-black leading-tight text-white">Cadastre sua equipe para {nomeCampeonato}</h1>
        <div role="note" className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3">
          <p className="text-xs font-black text-amber-100">Guarde este link: ele é a única forma de voltar a esta inscrição.</p>
          <p className="mt-1 text-[11px] font-semibold leading-5 text-amber-100/80">Não há login nem recuperação por e-mail. Se perder o link, você terá que começar de novo.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={copyLink} className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#ffb331] px-4 py-2 text-xs font-black text-slate-950">{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Link copiado' : 'Copiar link'}</button>
            <a href={linkWhatsApp()} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-black text-white"><MessageCircle size={14} /> Enviar por WhatsApp</a>
          </div>
          {copyFailed && <p role="status" className="mt-2 text-[11px] font-bold text-amber-100">Não foi possível copiar. Copie o endereço na barra do navegador.</p>}
        </div>
        {initialData?.status === 'ENVIADA' && <p className="mt-4 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-100">Esta inscrição já foi enviada. Você pode ajustar o elenco pelo mesmo link.</p>}
        {!canEdit && <p className="mt-4 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-100">Modo somente leitura. {readOnlyReason}</p>}
        {errorMsg && <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300">{errorMsg}</p>}
        {issues.length > 0 && <ul className="mt-2 list-disc rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-2 text-xs font-bold text-red-300">{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>}
        {canEdit && <p className={`mt-3 text-right text-[10px] font-bold uppercase tracking-wide ${saveState === 'error' ? 'text-red-300' : 'text-slate-500'}`}>{saveState === 'saving' ? 'Salvando...' : saveState === 'saved' ? 'Alterações salvas' : saveState === 'error' ? 'Não salvou. Confira a conexão e altere o campo de novo' : ''}</p>}

        <div className="mt-3 grid gap-3 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
          <FloatingInput id="nomeEquipe" label="Nome da equipe" value={nomeEquipe} onChange={setNomeEquipe} required disabled={!canEdit} />
          {logoEnabled && <div className="flex items-center gap-3">{logoUrl ? <img src={logoUrl} alt="Logo da equipe" className="h-11 w-11 rounded-full border border-white/10 object-cover" /> : <span className="flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-white/15 text-slate-500"><ImagePlus size={16} /></span>}{canEdit && (uploadingLogo ? <LoadingTrack label="Enviando" className="min-w-[12rem]" /> : <label className="cursor-pointer text-xs font-black uppercase tracking-wide text-luva-amber">{`Logo da equipe${logoRequired ? ' *' : ' (opcional)'}`}<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => handleLogoUpload(event.target.files?.[0] ?? null)} /></label>)}</div>}
          {categoriaFixa ? <FloatingInput id="nomeTorneio" label="Nome do torneio" value={nomeCampeonato} onChange={() => {}} locked /> : <FloatingSelect id="categoriaSerie" label="Nome do torneio" value={categoriaSerie} onChange={setCategoriaSerie} required disabled={!canEdit} options={categoriaOptions.map((option) => ({ value: `${option.categoria}:${option.serie}`, label: option.label }))} />}
          {liderEnabled && <FloatingInput id="lider" label="Líder da equipe" value={lider} onChange={setLider} required={liderRequired} disabled={!canEdit} />}
          <FloatingInput id="tecnico" label="Técnico (opcional)" value={tecnico} onChange={setTecnico} disabled={!canEdit} />
        </div>

        <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">Cadastro de jogadores</p>{canEditRoster && !addingJogador && <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setColando((current) => !current)} aria-expanded={colando} className="inline-flex min-h-[44px] items-center gap-1 rounded-full border border-white/15 px-3.5 py-2 text-[11px] font-black text-white"><ClipboardPaste size={14} /> Colar lista</button><button type="button" onClick={() => setAddingJogador(true)} className="inline-flex min-h-[44px] items-center gap-1 rounded-full bg-[#ffb331] px-3.5 py-2 text-[11px] font-black text-slate-950"><Plus size={14} /> Novo jogador</button></div>}</div>
          <p role="status" aria-live="polite" data-testid="contador-elenco" className={`mt-3 rounded-lg border px-3 py-2 text-xs font-black ${resumoElenco.situacao === 'ok' ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100' : resumoElenco.situacao === 'acima' ? 'border-red-400/30 bg-red-500/10 text-red-200' : 'border-amber-400/30 bg-amber-500/10 text-amber-100'}`}>{resumoElenco.texto}</p>
          {avisoColar && <p role="status" className="mt-2 rounded-lg border border-white/10 bg-[#07111f] px-3 py-2 text-xs font-semibold text-slate-300">{avisoColar}</p>}
          {colando && canEditRoster && <div className="mt-3 grid gap-2 rounded-xl border border-white/10 bg-[#07111f] p-3">
            <label htmlFor="listaColada" className="text-[11px] font-black uppercase tracking-wide text-slate-300">Cole um atleta por linha (nome e camisa)</label>
            <textarea id="listaColada" value={textoColado} onChange={(event) => setTextoColado(event.target.value)} rows={7} placeholder={'Maria Souza, 10\nAna Lima, 7\nBia Santos, 12'} className="w-full rounded-lg border border-white/10 bg-[#040b16] p-3 text-sm font-semibold text-white outline-none focus:border-luva-amber" />
            {textoColado.trim() && <p className="text-xs font-semibold text-slate-300">
              {separacao.novos.length} {separacao.novos.length === 1 ? 'atleta reconhecido' : 'atletas reconhecidos'}
              {separacao.repetidos.length > 0 && ` · ${separacao.repetidos.length} repetido(s): ${separacao.repetidos.map((item) => `${item.nome} (${item.motivo})`).join(', ')}`}
              {colagem.ignoradas.length > 0 && ` · ${colagem.ignoradas.length} linha(s) ignorada(s): ${colagem.ignoradas.map((item) => `"${item.texto}" (${item.motivo})`).join(', ')}`}
              {vagasRestantes !== Infinity && separacao.novos.length > vagasRestantes && ` · só cabem mais ${vagasRestantes} no máximo do elenco`}
            </p>}
            <div className="flex gap-2">
              <ActionBar type="button" onClick={importarLista} loading={importando} loadingLabel="Adicionando" disabled={separacao.novos.length === 0 || vagasRestantes === 0} className="min-h-[44px] flex-1 rounded-xl bg-[#ffb331] py-2.5 text-xs font-black text-slate-950 disabled:opacity-50">{separacao.novos.length > 0 ? `Adicionar ${Math.min(separacao.novos.length, vagasRestantes === Infinity ? separacao.novos.length : vagasRestantes)} atletas` : 'Adicionar atletas'}</ActionBar>
              <button type="button" onClick={() => { setColando(false); setTextoColado('') }} className="min-h-[44px] rounded-xl border border-white/15 px-4 text-xs font-black text-white">Cancelar</button>
            </div>
          </div>}
          {jogadores.length > 0 && <div className="mt-3 grid gap-1.5">{jogadores.map((player) => {
            const destacado = player.id != null && player.id === jogadorDestaqueId
            const confirmando = player.id != null && player.id === removendoConfirmarId
            return (
              <div key={player.id} id={`jogador-${player.id}`} tabIndex={-1} className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 ${destacado ? 'border-red-400 bg-red-500/15 ring-2 ring-red-400/60' : 'border-white/10 bg-[#07111f]'}`}>
                <p className={`min-w-0 truncate text-xs font-bold ${destacado ? 'text-red-100' : 'text-slate-400'}`}>{player.nome}{player.numero && ` · #${player.numero}`}{player.posicao && ` · ${player.posicao}`}{destacado && ' · corrija este atleta'}</p>
                {canEditRoster && (confirmando ? (
                  <div className="flex shrink-0 items-center gap-2" role="group" aria-label={`Confirmar remoção de ${player.nome}`}>
                    <span className="text-[11px] font-black text-red-200">Remover?</span>
                    <button type="button" onClick={() => removerJogador(player)} className="min-h-[36px] rounded-full bg-red-500 px-3 text-[11px] font-black text-white">Remover</button>
                    <button type="button" onClick={() => setRemovendoConfirmarId(null)} className="min-h-[36px] rounded-full border border-white/20 px-3 text-[11px] font-black text-white">Manter</button>
                  </div>
                ) : (
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={() => editarJogador(player)} aria-label={`Editar ${player.nome}`} className="flex h-9 w-9 items-center justify-center text-slate-500 hover:text-luva-amber"><Pencil size={14} /></button>
                    <button type="button" onClick={() => setRemovendoConfirmarId(player.id ?? null)} aria-label={`Remover ${player.nome}`} className="flex h-9 w-9 items-center justify-center text-slate-500 hover:text-red-400"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )
          })}</div>}
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
        {initialData?.status === 'RASCUNHO' && canEdit && <>
          {motivoConcluir && <p id="motivo-concluir" role="status" className="mt-5 text-center text-xs font-bold text-amber-200">{motivoConcluir}</p>}
          <ActionBar type="button" onClick={handleSubmit} loading={submitting} loadingLabel="Enviando inscrição" disabled={Boolean(motivoConcluir)} aria-describedby={motivoConcluir ? 'motivo-concluir' : undefined} className={`${motivoConcluir ? 'mt-2' : 'mt-5'} min-h-[48px] w-full rounded-full bg-[#ffb331] py-3.5 text-sm font-black text-slate-950 disabled:opacity-50`}>Concluir inscrição</ActionBar>
        </>}
      </div>
    </main>
  )
}
