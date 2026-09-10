'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle2, ImagePlus, Lock, QrCode, ShieldCheck, UserPlus, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Equipe {
  id: number
  nome: string
  logoUrl?: string
  corHex?: string
  categoria: string
  serie: string
  inscricaoAtiva: boolean
}

const inputBase = 'w-full rounded-2xl border border-[#17263c] bg-[#07101d] px-4 py-3.5 text-sm font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-luva-amber focus:ring-4 focus:ring-amber-400/10'
const labelBase = 'mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500'
const playerPhotosBucket = 'jogador-fotos'
const documentTypes = [
  { value: 'CPF', label: 'CPF' },
  { value: 'CIN', label: 'CIN' },
  { value: 'CTPS', label: 'Carteira Profissional' },
  { value: 'RG', label: 'RG' },
  { value: 'PASSAPORTE', label: 'Passaporte' },
  { value: 'OUTRO', label: 'Outro' },
]

export default function InscricaoJogadorPage() {
  const { slug } = useParams<{ slug: string }>()
  const [equipe, setEquipe] = useState<Equipe | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    nome: '',
    dataNascimento: '',
    cpf: '',
    documentoTipo: 'CPF',
    documentoNumero: '',
    email: '',
    celular: '',
    telefoneEmergencia: '',
    fotoRostoUrl: '',
    posicao: '',
    numero: '',
  })

  useEffect(() => {
    fetch(`/api/equipes?slug=${slug}`)
      .then((res) => res.json())
      .then((json) => {
        const eq = (json.data ?? []).find((item: any) => item.slug === slug)
        if (!eq) {
          setNotFound(true)
          setLoading(false)
          return
        }
        setEquipe(eq)
        setLoading(false)
      })
      .catch(() => {
        setNotFound(true)
        setLoading(false)
      })
  }, [slug])

  function handleChange(event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setFieldErrors((current) => {
      const next = { ...current }
      delete next[name]
      return next
    })
  }

  function formatCPF(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 11)
    return digits.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }

  function formatPhone(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 11)
    if (digits.length <= 10) return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim()
    return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim()
  }

  async function handlePhotoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setFieldErrors((current) => ({ ...current, fotoRostoUrl: 'Envie uma imagem válida.' }))
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setFieldErrors((current) => ({ ...current, fotoRostoUrl: 'A foto deve ter no máximo 5 MB.' }))
      return
    }

    setUploadingPhoto(true)
    setFieldErrors((current) => {
      const next = { ...current }
      delete next.fotoRostoUrl
      return next
    })

    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${slug}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`
    const { error: uploadError } = await supabase.storage.from(playerPhotosBucket).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })

    setUploadingPhoto(false)
    if (uploadError) {
      setFieldErrors((current) => ({ ...current, fotoRostoUrl: 'Não foi possível enviar a foto. Verifique o bucket jogador-fotos no Supabase.' }))
      return
    }

    const { data } = supabase.storage.from(playerPhotosBucket).getPublicUrl(path)
    setForm((current) => ({ ...current, fotoRostoUrl: data.publicUrl }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setFieldErrors({})

    const res = await fetch(`/api/inscricao/${slug}/jogadores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, numero: form.numero ? parseInt(form.numero) : undefined }),
    })
    const json = await res.json()
    setSubmitting(false)

    if (res.ok) {
      setQrCodeDataUrl(json.data.qrCodeDataUrl)
      setSuccessMsg(json.data.mensagem)
    } else if (res.status === 422 && json.details?.fieldErrors) {
      const errors: Record<string, string> = {}
      for (const [field, messages] of Object.entries(json.details.fieldErrors as Record<string, string[]>)) errors[field] = messages[0]
      setFieldErrors(errors)
    } else {
      setFieldErrors({ _geral: json.error ?? 'Erro ao cadastrar. Tente novamente.' })
    }
  }

  if (loading) return <StatusScreen icon={<UserPlus size={24} />} title="Carregando inscrição" description="Estamos buscando os dados da equipe." />
  if (notFound || !equipe) return <StatusScreen icon={<UserPlus size={24} />} title="Equipe não encontrada" description="Verifique se o link de inscrição está correto e tente novamente." />
  if (!equipe.inscricaoAtiva) return <StatusScreen icon={<Lock size={24} />} title="Inscrições encerradas" description={`As inscrições para ${equipe.nome} estão encerradas no momento.`} />

  if (qrCodeDataUrl) {
    return (
      <main className="sport-grid flex min-h-screen items-center justify-center px-4 py-8">
        <div className="luva-surface mx-auto max-w-lg rounded-[2rem] p-7 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-white">
            <CheckCircle2 size={30} />
          </span>
          <h1 className="mt-5 text-3xl font-black text-luva-navy">Cadastro realizado</h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-luva-muted">{successMsg}</p>
          <div className="mx-auto mt-6 max-w-xs rounded-[1.5rem] border border-[#17263c] bg-slate-100 p-4 shadow-lg">
            <img src={qrCodeDataUrl} alt="QR Code do atleta" className="mx-auto h-52 w-52" />
          </div>
          <p className="mt-4 text-sm font-bold leading-6 text-slate-600">Salve este QR Code. Ele será usado para validar sua participação antes das partidas.</p>
        </div>
      </main>
    )
  }

  const posicoes = ['Levantador', 'Oposto', 'Central', 'Ponteiro', 'Líbero']

  return (
    <main className="sport-grid min-h-screen">
      <section className="bg-[#050914] text-white shadow-[0_1px_0_#17263c]">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-[0.9fr_1.1fr] md:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-luva-amber">Inscrição de atleta</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">{equipe.nome}</h1>
            <p className="mt-3 text-sm font-semibold text-white/70">volei.space - {equipe.categoria} - {equipe.serie}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Info icon={<ShieldCheck size={22} />} text="Dados usados apenas para organização da liga." />
            <Info icon={<QrCode size={22} />} text="QR Code gerado ao final do cadastro." />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-8">
        <form onSubmit={handleSubmit} className="luva-surface rounded-[2rem] p-5 md:p-7">
          {fieldErrors._geral && <div className="mb-5 rounded-2xl border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm font-bold text-red-200">{fieldErrors._geral}</div>}
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Nome completo *" error={fieldErrors.nome} className="md:col-span-2"><input name="nome" required value={form.nome} onChange={handleChange} className={inputBase} placeholder="Seu nome completo" /></Field>
            <Field label="Data de nascimento *" error={fieldErrors.dataNascimento}><input name="dataNascimento" type="date" required value={form.dataNascimento} onChange={handleChange} className={inputBase} /></Field>
            <Field label="Tipo de documento *" error={fieldErrors.documentoTipo}>
              <select name="documentoTipo" required value={form.documentoTipo} onChange={handleChange} className={inputBase}>
                {documentTypes.map((documentType) => (
                  <option key={documentType.value} value={documentType.value}>{documentType.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Documento *" error={fieldErrors.documentoNumero || fieldErrors.cpf}>
              <input
                name="documentoNumero"
                required
                value={form.documentoNumero}
                onChange={(event) => {
                  const value = form.documentoTipo === 'CPF' ? formatCPF(event.target.value) : event.target.value
                  setForm((current) => ({ ...current, documentoNumero: value, cpf: current.documentoTipo === 'CPF' ? value : current.cpf }))
                }}
                className={inputBase}
                placeholder={form.documentoTipo === 'CPF' ? '000.000.000-00' : 'Informe o documento'}
                maxLength={form.documentoTipo === 'CPF' ? 14 : 80}
              />
            </Field>
            <Field label="E-mail *" error={fieldErrors.email}><input name="email" type="email" required value={form.email} onChange={handleChange} className={inputBase} placeholder="seu@email.com" /></Field>
            <Field label="Celular *" error={fieldErrors.celular}><input name="celular" required value={form.celular} onChange={(event) => setForm((current) => ({ ...current, celular: formatPhone(event.target.value) }))} className={inputBase} placeholder="(00) 00000-0000" maxLength={15} /></Field>
            <Field label="Telefone de emergência *" error={fieldErrors.telefoneEmergencia}><input name="telefoneEmergencia" required value={form.telefoneEmergencia} onChange={(event) => setForm((current) => ({ ...current, telefoneEmergencia: formatPhone(event.target.value) }))} className={inputBase} placeholder="(00) 00000-0000" maxLength={15} /></Field>
            <Field label="Foto de perfil do atleta" error={fieldErrors.fotoRostoUrl} className="md:col-span-2">
              <div className="grid gap-4 rounded-3xl border border-[#17263c] bg-[#07101d] p-4 sm:grid-cols-[auto_1fr] sm:items-center">
                <div className="relative h-28 w-28 overflow-hidden rounded-3xl border border-luva-amber/30 bg-[#0b1626]">
                  {form.fotoRostoUrl ? (
                    <img src={form.fotoRostoUrl} alt="Foto do atleta" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-500">
                      <ImagePlus size={26} />
                      <span className="text-[10px] font-black uppercase tracking-wide">Sem foto</span>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-black text-white">Envie a foto de rosto usada na validação por QR Code.</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">Arquivo JPG, PNG ou WEBP, até 5 MB. A organização e o árbitro verão essa imagem na conferência pré-partida.</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-luva-amber px-4 py-3 text-xs font-black uppercase tracking-wide text-[#050914] transition hover:bg-amber-300">
                      <ImagePlus size={16} />
                      {uploadingPhoto ? 'Enviando...' : form.fotoRostoUrl ? 'Trocar foto' : 'Enviar foto'}
                      <input type="file" accept="image/png,image/jpeg,image/webp" capture="environment" className="sr-only" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
                    </label>
                    {form.fotoRostoUrl && (
                      <button type="button" onClick={() => setForm((current) => ({ ...current, fotoRostoUrl: '' }))} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-xs font-black uppercase tracking-wide text-white transition hover:border-luva-amber/40">
                        <X size={16} />
                        Remover
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </Field>
            <Field label="Posição"><select name="posicao" value={form.posicao} onChange={handleChange} className={inputBase}><option value="">Selecionar</option>{posicoes.map((posicao) => <option key={posicao} value={posicao}>{posicao}</option>)}</select></Field>
            <Field label="Número da camisa"><input name="numero" type="number" min="1" max="99" value={form.numero} onChange={handleChange} className={inputBase} placeholder="Ex: 10" /></Field>
          </div>
          <button type="submit" disabled={submitting || uploadingPhoto} className="mt-7 w-full rounded-2xl bg-luva-amber px-5 py-4 text-sm font-black uppercase tracking-wide text-[#050914] shadow-xl shadow-black/20 transition hover:-translate-y-0.5 hover:bg-amber-300 disabled:opacity-50">
            {uploadingPhoto ? 'Aguardando upload da foto...' : submitting ? 'Cadastrando...' : 'Concluir cadastro e gerar QR Code'}
          </button>
          <p className="mt-4 text-center text-xs font-semibold leading-5 text-luva-muted">Ao concluir, seus dados ficam vinculados à equipe e à temporada da volei.space.</p>
        </form>
      </section>
    </main>
  )
}

function Field({ label, error, className = '', children }: { label: string; error?: string; className?: string; children: React.ReactNode }) {
  return <div className={className}><label className={labelBase}>{label}</label>{children}{error && <p className="mt-1.5 text-xs font-semibold text-red-600">{error}</p>}</div>
}

function Info({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="rounded-2xl border border-[#17263c] bg-[#0a1423] p-4"><span className="text-luva-amber">{icon}</span><p className="mt-3 text-sm font-semibold text-slate-300">{text}</p></div>
}

function StatusScreen({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <main className="sport-grid flex min-h-screen items-center justify-center px-4">
      <div className="luva-surface max-w-md rounded-[2rem] p-7 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-luva-amber text-[#050914]">{icon}</span>
        <h1 className="mt-5 text-2xl font-black text-luva-navy">{title}</h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-luva-muted">{description}</p>
      </div>
    </main>
  )
}
