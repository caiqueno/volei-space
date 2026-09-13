'use client'

import { useState } from 'react'
import { CheckCircle2, ImagePlus, Pencil, Plus, Trash2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { optimizeImageFile } from '@/lib/client-image-upload'
import type { ResolvedFormularioRapidaConfig, CategoriaSerieOption } from '@/lib/inscricao-rapida'

type ResolvedConfig = ResolvedFormularioRapidaConfig

const POSICOES = ['Levantador', 'Oposto', 'Central', 'Ponteiro', 'Líbero']
const DOCUMENT_TYPES = [
  { value: 'CPF', label: 'CPF' },
  { value: 'CIN', label: 'CIN' },
  { value: 'CTPS', label: 'Carteira Profissional' },
  { value: 'RG', label: 'RG' },
  { value: 'PASSAPORTE', label: 'Passaporte' },
  { value: 'OUTRO', label: 'Outro' },
]

type JogadorDraft = {
  nome: string
  numero: string
  posicao: string
  fotoUrl: string
  cpf: string
  dataNascimento: string
  documentoTipo: string
  documentoNumero: string
}

const emptyJogador: JogadorDraft = {
  nome: '', numero: '', posicao: '', fotoUrl: '', cpf: '', dataNascimento: '', documentoTipo: 'CPF', documentoNumero: '',
}

function FloatingInput({
  id, label, value, onChange, type = 'text', required,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  required?: boolean
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder=" "
        className="peer w-full rounded-xl border border-white/10 bg-[#07111f] px-3 pb-1.5 pt-4 text-sm font-bold text-white outline-none transition focus:border-luva-amber"
      />
      <label
        htmlFor={id}
        className="pointer-events-none absolute left-3 top-1 text-[9px] font-black uppercase tracking-wide text-luva-amber transition-all peer-placeholder-shown:top-3 peer-placeholder-shown:text-xs peer-placeholder-shown:font-bold peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-placeholder-shown:text-slate-500 peer-focus:top-1 peer-focus:text-[9px] peer-focus:font-black peer-focus:uppercase peer-focus:tracking-wide peer-focus:text-luva-amber"
      >
        {label}{required && ' *'}
      </label>
    </div>
  )
}

function FloatingSelect({
  id, label, value, onChange, options, required,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  required?: boolean
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="peer w-full appearance-none rounded-xl border border-white/10 bg-[#07111f] px-3 pb-1.5 pt-4 text-sm font-bold text-white outline-none transition focus:border-luva-amber"
      >
        <option value="" disabled hidden></option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <label
        htmlFor={id}
        className={`pointer-events-none absolute left-3 text-[9px] font-black uppercase tracking-wide transition-all ${value ? 'top-1 text-luva-amber' : 'top-3 text-xs font-bold normal-case tracking-normal text-slate-500'} peer-focus:top-1 peer-focus:text-[9px] peer-focus:font-black peer-focus:uppercase peer-focus:tracking-wide peer-focus:text-luva-amber`}
      >
        {label}{required && ' *'}
      </label>
    </div>
  )
}

async function uploadOptimizedImage(bucket: string, folder: string, file: File, outputName: string) {
  const optimized = await optimizeImageFile(file, outputName)
  const extension = optimized.file.type === 'image/webp' ? 'webp' : 'jpg'
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`
  const { error } = await supabase.storage.from(bucket).upload(fileName, optimized.file, {
    upsert: false,
    contentType: optimized.file.type,
    cacheControl: '3600',
  })
  if (error) throw new Error(`Não foi possível enviar a imagem. Verifique o bucket ${bucket} no Supabase.`)
  const { data } = supabase.storage.from(bucket).getPublicUrl(fileName)
  if (!data.publicUrl) throw new Error('Não foi possível obter o link público da imagem.')
  return data.publicUrl
}

export function FormularioInscricaoRapida({
  ligaId, nomeCampeonato, config, categoriaFixa, categoriaOptions,
}: {
  ligaId: number
  nomeCampeonato: string
  config: ResolvedConfig
  categoriaFixa: CategoriaSerieOption | null
  categoriaOptions: CategoriaSerieOption[]
}) {
  const [nomeEquipe, setNomeEquipe] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [lider, setLider] = useState('')
  const [tecnico, setTecnico] = useState('')
  const [categoriaSerie, setCategoriaSerie] = useState('')
  const [jogadores, setJogadores] = useState<JogadorDraft[]>([])
  const [draft, setDraft] = useState<JogadorDraft>(emptyJogador)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [addingJogador, setAddingJogador] = useState(false)
  const [uploadingFotoJogador, setUploadingFotoJogador] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [issues, setIssues] = useState<string[]>([])
  const [successNome, setSuccessNome] = useState('')

  const logoEnabled = config.equipe.logo !== 'disabled'
  const logoRequired = config.equipe.logo === 'required'
  const liderEnabled = config.lider.nomeCompleto !== 'disabled'
  const liderRequired = config.lider.nomeCompleto === 'required'
  const numeroEnabled = config.atleta.numeroCamisa !== 'disabled'
  const numeroRequired = config.atleta.numeroCamisa === 'required'
  const posicaoEnabled = config.atleta.posicao !== 'disabled'
  const posicaoRequired = config.atleta.posicao === 'required'
  const fotoEnabled = config.atleta.foto !== 'disabled'
  const fotoRequired = config.atleta.foto === 'required'
  const cpfEnabled = config.atleta.cpf !== 'disabled'
  const cpfRequired = config.atleta.cpf === 'required'
  const nascimentoEnabled = config.atleta.dataNascimento !== 'disabled'
  const nascimentoRequired = config.atleta.dataNascimento === 'required'
  const documentoEnabled = config.atleta.documento !== 'disabled'
  const documentoRequired = config.atleta.documento === 'required'

  async function handleLogoUpload(file: File | null) {
    if (!file) return
    setErrorMsg('')
    try {
      setUploadingLogo(true)
      const url = await uploadOptimizedImage('equipe-emblemas', 'emblemas', file, `emblema-${nomeEquipe || 'equipe'}`)
      setLogoUrl(url)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao enviar a logo.')
    } finally {
      setUploadingLogo(false)
    }
  }

  async function handleJogadorFotoUpload(file: File | null) {
    if (!file) return
    setErrorMsg('')
    try {
      setUploadingFotoJogador(true)
      const url = await uploadOptimizedImage('jogador-fotos', 'jogadores', file, `jogador-${draft.nome || 'atleta'}`)
      setDraft((current) => ({ ...current, fotoUrl: url }))
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao enviar a foto.')
    } finally {
      setUploadingFotoJogador(false)
    }
  }

  function salvarJogador() {
    if (!draft.nome.trim()) return
    if (editingIndex !== null) {
      setJogadores((current) => current.map((jogador, i) => (i === editingIndex ? draft : jogador)))
    } else {
      setJogadores((current) => [...current, draft])
    }
    setDraft(emptyJogador)
    setEditingIndex(null)
    setAddingJogador(false)
  }

  function editarJogador(index: number) {
    setDraft(jogadores[index])
    setEditingIndex(index)
    setAddingJogador(true)
  }

  function cancelarEdicaoJogador() {
    setAddingJogador(false)
    setDraft(emptyJogador)
    setEditingIndex(null)
  }

  function removerJogador(index: number) {
    setJogadores((current) => current.filter((_, i) => i !== index))
  }

  async function handleSubmit() {
    setErrorMsg('')
    setIssues([])
    if (jogadores.length === 0) {
      setErrorMsg('Cadastre ao menos um jogador antes de confirmar.')
      return
    }
    const [categoriaSelecionada, serieSelecionada] = categoriaFixa
      ? [categoriaFixa.categoria, categoriaFixa.serie]
      : categoriaSerie.split(':')

    setSubmitting(true)
    try {
      const res = await fetch('/api/inscricao-rapida', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ligaId,
          nomeEquipe,
          logoUrl: logoUrl || undefined,
          lider: lider || undefined,
          tecnico: tecnico || undefined,
          categoria: categoriaSelecionada,
          serie: serieSelecionada,
          jogadores: jogadores.map((jogador) => ({
            nome: jogador.nome,
            numero: jogador.numero ? Number(jogador.numero) : undefined,
            posicao: jogador.posicao || undefined,
            fotoUrl: jogador.fotoUrl || undefined,
            cpf: jogador.cpf || undefined,
            dataNascimento: jogador.dataNascimento || undefined,
            documentoTipo: jogador.documentoTipo || undefined,
            documentoNumero: jogador.documentoNumero || undefined,
          })),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        if (Array.isArray(json.details)) setIssues(json.details)
        setErrorMsg(json.error || 'Erro ao cadastrar equipe.')
        return
      }
      setSuccessNome(json.data.nome)
    } catch {
      setErrorMsg('Erro ao cadastrar equipe. Verifique sua conexão e tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  if (successNome) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#040b16] px-4 py-10">
        <div className="w-full max-w-md rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-8 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white">
            <CheckCircle2 size={26} />
          </span>
          <h1 className="mt-5 font-display text-2xl font-black text-white">Equipe cadastrada</h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">
            {successNome} está confirmada em {nomeCampeonato}. O organizador já pode ver sua equipe na estrutura do campeonato.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#040b16] px-4 py-8">
      <div className="mx-auto max-w-lg">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-luva-amber">Cadastro de equipe</p>
        <h1 className="mt-1 font-display text-2xl font-black leading-tight text-white">Cadastre sua equipe para {nomeCampeonato}</h1>

        {errorMsg && <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300">{errorMsg}</p>}
        {issues.length > 0 && (
          <ul className="mt-2 list-disc rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-2 text-xs font-bold text-red-300">
            {issues.map((issue) => <li key={issue}>{issue}</li>)}
          </ul>
        )}

        <div className="mt-5 grid gap-3 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
          <FloatingInput id="nomeEquipe" label="Nome da equipe" value={nomeEquipe} onChange={setNomeEquipe} required />

          {logoEnabled && (
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo da equipe" className="h-11 w-11 rounded-full border border-white/10 object-cover" />
              ) : (
                <span className="flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-white/15 text-slate-500"><ImagePlus size={16} /></span>
              )}
              <label className="cursor-pointer text-xs font-black uppercase tracking-wide text-luva-amber">
                {uploadingLogo ? 'Enviando...' : `Logo da equipe${logoRequired ? ' *' : ' (opcional)'}`}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploadingLogo} onChange={(event) => handleLogoUpload(event.target.files?.[0] ?? null)} />
              </label>
            </div>
          )}

          {categoriaFixa ? (
            <p className="text-xs font-bold text-slate-300">Categoria: <span className="text-white">{categoriaFixa.label}</span></p>
          ) : (
            <FloatingSelect
              id="categoriaSerie"
              label="Categoria"
              value={categoriaSerie}
              onChange={setCategoriaSerie}
              required
              options={categoriaOptions.map((option) => ({ value: `${option.categoria}:${option.serie}`, label: option.label }))}
            />
          )}

          {liderEnabled && <FloatingInput id="lider" label="Líder da equipe" value={lider} onChange={setLider} required={liderRequired} />}
          <FloatingInput id="tecnico" label="Técnico (opcional)" value={tecnico} onChange={setTecnico} />
        </div>

        <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">Cadastro de jogadores</p>
            {!addingJogador && (
              <button type="button" onClick={() => setAddingJogador(true)} className="inline-flex items-center gap-1 rounded-full bg-[#ffb331] px-3 py-1.5 text-[11px] font-black text-slate-950">
                <Plus size={13} /> Novo jogador
              </button>
            )}
          </div>

          {jogadores.length > 0 && (
            <div className="mt-3 grid gap-1.5">
              {jogadores.map((jogador, index) => (
                <div key={`${jogador.nome}-${index}`} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#07111f] px-2.5 py-1.5">
                  <p className="min-w-0 truncate text-xs font-bold">
                    <span className="text-slate-400">{jogador.nome}</span>
                    {jogador.numero && <span className="text-slate-400"> · #{jogador.numero}</span>}
                    {jogador.posicao && <span className="text-slate-400"> · {jogador.posicao}</span>}
                  </p>
                  <div className="flex shrink-0 items-center gap-2.5">
                    <button type="button" onClick={() => editarJogador(index)} aria-label={`Editar ${jogador.nome}`} className="text-slate-500 hover:text-luva-amber">
                      <Pencil size={13} />
                    </button>
                    <button type="button" onClick={() => removerJogador(index)} aria-label={`Remover ${jogador.nome}`} className="text-slate-500 hover:text-red-400">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {addingJogador && (
            <div className="mt-3 grid gap-2.5 rounded-xl border border-white/10 bg-[#07111f] p-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{editingIndex !== null ? 'Editar jogador' : 'Novo jogador'}</p>
                <button type="button" onClick={cancelarEdicaoJogador} aria-label="Cancelar" className="text-slate-500 hover:text-white"><X size={14} /></button>
              </div>
              <FloatingInput id="jogadorNome" label="Nome completo" value={draft.nome} onChange={(v) => setDraft((c) => ({ ...c, nome: v }))} required />
              <div className="grid grid-cols-2 gap-2.5">
                {numeroEnabled && <FloatingInput id="jogadorNumero" label="Número" type="number" value={draft.numero} onChange={(v) => setDraft((c) => ({ ...c, numero: v }))} required={numeroRequired} />}
                {posicaoEnabled && <FloatingSelect id="jogadorPosicao" label="Posição" value={draft.posicao} onChange={(v) => setDraft((c) => ({ ...c, posicao: v }))} required={posicaoRequired} options={POSICOES.map((p) => ({ value: p, label: p }))} />}
              </div>
              {cpfEnabled && <FloatingInput id="jogadorCpf" label="CPF" value={draft.cpf} onChange={(v) => setDraft((c) => ({ ...c, cpf: v }))} required={cpfRequired} />}
              {nascimentoEnabled && <FloatingInput id="jogadorNascimento" label="Data de nascimento" type="date" value={draft.dataNascimento} onChange={(v) => setDraft((c) => ({ ...c, dataNascimento: v }))} required={nascimentoRequired} />}
              {documentoEnabled && (
                <div className="grid grid-cols-2 gap-2.5">
                  <FloatingSelect id="jogadorDocTipo" label="Documento" value={draft.documentoTipo} onChange={(v) => setDraft((c) => ({ ...c, documentoTipo: v }))} required={documentoRequired} options={DOCUMENT_TYPES} />
                  <FloatingInput id="jogadorDocNumero" label="Número do documento" value={draft.documentoNumero} onChange={(v) => setDraft((c) => ({ ...c, documentoNumero: v }))} required={documentoRequired} />
                </div>
              )}
              {fotoEnabled && (
                <div className="flex items-center gap-3">
                  {draft.fotoUrl ? (
                    <img src={draft.fotoUrl} alt="Foto do jogador" className="h-10 w-10 rounded-full border border-white/10 object-cover" />
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-white/15 text-slate-500"><ImagePlus size={14} /></span>
                  )}
                  <label className="cursor-pointer text-xs font-black uppercase tracking-wide text-luva-amber">
                    {uploadingFotoJogador ? 'Enviando...' : `Foto${fotoRequired ? ' *' : ' (opcional)'}`}
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploadingFotoJogador} onChange={(event) => handleJogadorFotoUpload(event.target.files?.[0] ?? null)} />
                  </label>
                </div>
              )}
              <button type="button" onClick={salvarJogador} disabled={!draft.nome.trim()} className="mt-1 rounded-xl bg-[#ffb331] py-2.5 text-xs font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">
                {editingIndex !== null ? 'Salvar alterações' : 'Salvar jogador'}
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !nomeEquipe.trim() || (!categoriaFixa && !categoriaSerie) || jogadores.length === 0}
          className="mt-5 w-full rounded-full bg-[#ffb331] py-3.5 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Cadastrando...' : 'Cadastrar equipe'}
        </button>
      </div>
    </main>
  )
}
