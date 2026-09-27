'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, ImageIcon, MapPin, Send } from 'lucide-react'
import { ActionBar, LoadingTrack } from '@/components/ui/action-bar'
import { supabase } from '@/lib/supabase'
import { formatBytes, imageUploadRules, optimizeImageFile } from '@/lib/client-image-upload'

export interface OrganizacaoFormValues {
  organizacao: string
  cidade: string
  logoUrl: string
}

interface OrganizacaoFormProps {
  mode: 'onboarding' | 'settings'
  initialValues: OrganizacaoFormValues
  onSaved: (values: OrganizacaoFormValues) => void
}

const inputBase =
  'w-full rounded-xl border border-white/18 bg-[#071426] px-3.5 py-2.5 text-sm font-bold text-[#ffffff] outline-none transition placeholder:text-white/45 focus:border-luva-amber focus:bg-[#0b1c33] focus:ring-4 focus:ring-luva-amber/20'
const labelBase = 'mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-white/78'

// Formulário único em cascata (item 8 do pedido) — reaproveita exatamente o
// schema/validação/endpoint de organizadorPerfilSchema (PATCH
// /api/organizador/perfil), o mesmo em onboarding e em Configurações; só o
// texto de cabeçalho/botão muda com `mode`. O upload de logo reaproveita
// optimizeImageFile/imageUploadRules — mesmo utilitário do emblema da equipe.
export function OrganizacaoForm({ mode, initialValues, onSaved }: OrganizacaoFormProps) {
  const [organizacao, setOrganizacao] = useState(initialValues.organizacao)
  const [cidade, setCidade] = useState(initialValues.cidade)
  const [logoUrl, setLogoUrl] = useState(initialValues.logoUrl)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const showNextSections = organizacao.trim().length > 0

  async function handleLogoUpload(file: File | null) {
    if (!file) return
    setUploadError('')
    setUploading(true)
    try {
      const optimized = await optimizeImageFile(file, 'logo-organizacao')
      const extension = optimized.file.type === 'image/webp' ? 'webp' : 'jpg'
      const fileName = `logos/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`
      const { error: uploadErr } = await supabase.storage.from('organizador-logos').upload(fileName, optimized.file, {
        upsert: false,
        contentType: optimized.file.type,
        cacheControl: '3600',
      })
      if (uploadErr) {
        setUploadError('Não foi possível enviar o logo. Tente novamente.')
        return
      }
      const { data } = supabase.storage.from('organizador-logos').getPublicUrl(fileName)
      if (!data.publicUrl) {
        setUploadError('Não foi possível obter o link público do logo.')
        return
      }
      setLogoUrl(data.publicUrl)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Não foi possível processar a imagem selecionada.')
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!organizacao.trim()) {
      setError('Informe o nome da organização para continuar.')
      return
    }
    setError('')
    setSaving(true)
    try {
      const response = await fetch('/api/organizador/perfil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizacao: organizacao.trim(), cidade: cidade.trim(), logoUrl }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(json.error || 'Não foi possível salvar os dados da organização.')
        return
      }
      onSaved({ organizacao: organizacao.trim(), cidade: cidade.trim(), logoUrl })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-lg">
      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-luva-amber">
        {mode === 'onboarding' ? 'Último passo' : 'Configurações'}
      </p>
      <h2 className="mt-2 font-display text-2xl font-black text-[#ffffff] sm:text-3xl">
        {mode === 'onboarding' ? 'Complete sua organização' : 'Dados da organização'}
      </h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-white/72">
        {mode === 'onboarding'
          ? 'Assim que finalizar, seus campeonatos ficam disponíveis no painel.'
          : 'Essas informações aparecem no rodapé do menu e podem ser editadas quando quiser.'}
      </p>

      <div className="mt-6 grid gap-4">
        <label className="block">
          <span className={labelBase}>
            Nome da organização <span className="text-luva-amber">*</span>
          </span>
          <div className="relative">
            <Building2 size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/58" />
            <input
              required
              autoFocus
              value={organizacao}
              onChange={(event) => setOrganizacao(event.target.value)}
              className={`${inputBase} pl-11`}
              placeholder="Ex: Liga, assessoria ou clube"
            />
          </div>
        </label>

        <AnimatePresence>
          {showNextSections && (
            <motion.div
              initial={{ opacity: 0, y: 12, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: 8, height: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="grid gap-4 overflow-hidden"
            >
              <label className="block">
                <span className={labelBase}>Logo da organização</span>
                {uploading ? <LoadingTrack label="Enviando" className="w-full rounded-2xl" /> : (
                <label className="flex min-h-[4.25rem] cursor-pointer items-center gap-4 rounded-2xl border border-white/14 bg-white/6 px-4 py-3 transition hover:border-luva-amber/70 hover:bg-white/10">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo da organização" className="h-12 w-12 rounded-xl border border-white/15 object-cover" />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-luva-amber/40 bg-luva-amber/10 text-luva-amber">
                      <ImageIcon size={20} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black text-[#ffffff]">{logoUrl ? 'Logo enviado' : 'Enviar logo (opcional)'}</span>
                    <span className="mt-1 block text-xs font-bold text-white/62">{imageUploadRules.allowedLabel}. Até {formatBytes(imageUploadRules.maxOriginalBytes)}.</span>
                    {uploadError && <span className="mt-1 block text-xs font-black text-red-200">{uploadError}</span>}
                  </span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => handleLogoUpload(event.target.files?.[0] ?? null)} />
                </label>
                )}
              </label>

              <label className="block">
                <span className={labelBase}>Cidade/Região</span>
                <div className="relative">
                  <MapPin size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/58" />
                  <input value={cidade} onChange={(event) => setCidade(event.target.value)} className={`${inputBase} pl-11`} placeholder="Cidade de atuação" />
                </div>
              </label>
            </motion.div>
          )}
        </AnimatePresence>

        {error && <p className="text-sm font-bold text-red-300">{error}</p>}

        <AnimatePresence>
          {showNextSections && (
            <ActionBar
              type="submit"
              loading={saving}
              disabled={uploading}
              loadingLabel="Salvando"
              className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-luva-amber px-6 py-3 text-sm font-black uppercase tracking-wide text-[#050914] transition hover:-translate-y-0.5 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={17} />
              {mode === 'onboarding' ? 'Finalizar' : 'Salvar alterações'}
            </ActionBar>
          )}
        </AnimatePresence>
      </div>
    </form>
  )
}
