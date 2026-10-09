'use client'

import { useEffect, useState } from 'react'
import { optimizeImageFile, validateImageFile } from '@/lib/client-image-upload'
import { lerJson } from '@/lib/api-cliente'
import { supabase } from '@/lib/supabase'

type Foto = {
  id: number
  url: string
  thumbUrl?: string | null
  titulo?: string | null
}

export function GaleriaOrganizador({ ligaId, capaUrl }: { ligaId: number; capaUrl?: string | null }) {
  const [fotos, setFotos] = useState<Foto[]>([])
  const [temMais, setTemMais] = useState(false)
  const [capa, setCapa] = useState(capaUrl ?? '')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [erro, setErro] = useState('')
  const [publicando, setPublicando] = useState(false)
  const [aberto, setAberto] = useState<Foto | null>(null)

  useEffect(() => {
    setCapa(capaUrl ?? '')
  }, [capaUrl, ligaId])

  useEffect(() => {
    let vivo = true
    fetch(`/api/galeria?ligaId=${ligaId}&limite=12`)
      .then((resposta) => resposta.json())
      .then((json) => {
        if (!vivo) return
        setFotos(json.data?.midias ?? [])
        setTemMais(Boolean(json.data?.temMais))
      })
      .catch(() => {
        if (vivo) setErro('Não foi possível carregar a galeria.')
      })
    return () => {
      vivo = false
    }
  }, [ligaId])

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview)
  }, [preview])

  function escolher(file: File | null) {
    setErro('')
    setArquivo(null)
    if (preview) URL.revokeObjectURL(preview)
    setPreview('')
    if (!file) return
    const validacao = validateImageFile(file)
    if (validacao) {
      setErro(validacao)
      return
    }
    setArquivo(file)
    setPreview(URL.createObjectURL(file))
  }

  async function publicar() {
    if (!arquivo || publicando) return
    setPublicando(true)
    setErro('')
    try {
      const [grande, mini] = await Promise.all([
        optimizeImageFile(arquivo, `liga-${ligaId}`),
        optimizeImageFile(arquivo, `liga-${ligaId}-thumb`, { maxDimension: 480, maxOutputBytes: 180 * 1024 }),
      ])
      const nome = crypto.randomUUID()
      const caminho = `ligas/${ligaId}/${nome}.webp`
      const caminhoMini = `ligas/${ligaId}/${nome}-thumb.webp`
      const envioGrande = await supabase.storage.from('galeria-campeonato').upload(caminho, grande.file, { upsert: false, contentType: 'image/webp', cacheControl: '3600' })
      if (envioGrande.error) throw new Error('Não foi possível enviar a foto.')
      const envioMini = await supabase.storage.from('galeria-campeonato').upload(caminhoMini, mini.file, { upsert: false, contentType: 'image/webp', cacheControl: '3600' })
      if (envioMini.error) throw new Error('Não foi possível enviar a miniatura.')
      const url = supabase.storage.from('galeria-campeonato').getPublicUrl(caminho).data.publicUrl
      const thumbUrl = supabase.storage.from('galeria-campeonato').getPublicUrl(caminhoMini).data.publicUrl
      const resposta = await fetch('/api/galeria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ligaId, tipo: 'FOTO', url, thumbUrl, titulo: arquivo.name }),
      })
      const json = await lerJson<{ error?: string; data?: Foto }>(resposta)
      if (!resposta.ok || !json.data) throw new Error(json.error ?? 'Não foi possível publicar a foto.')
      setFotos((atual) => [json.data as Foto, ...atual])
      escolher(null)
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não foi possível publicar a foto.')
    } finally {
      setPublicando(false)
    }
  }

  async function definirCapa(foto: Foto) {
    const resposta = await fetch(`/api/organizador/ligas/${ligaId}/galeria/${foto.id}`, { method: 'PATCH' })
    const json = await lerJson<{ error?: string; data?: { capaUrl?: string } }>(resposta)
    if (!resposta.ok) {
      setErro(json.error ?? 'Não foi possível definir a foto principal.')
      return
    }
    setCapa(json.data?.capaUrl ?? foto.url)
  }

  async function excluir(foto: Foto) {
    if (!window.confirm('Excluir esta foto da galeria?')) return
    const resposta = await fetch(`/api/organizador/ligas/${ligaId}/galeria/${foto.id}`, { method: 'DELETE' })
    const json = await lerJson<{ error?: string }>(resposta)
    if (!resposta.ok) {
      setErro(json.error ?? 'Não foi possível excluir a foto.')
      return
    }
    setFotos((atual) => atual.filter((item) => item.id !== foto.id))
    if (capa === foto.url) setCapa('')
    if (aberto?.id === foto.id) setAberto(null)
  }

  async function verMais() {
    const resposta = await fetch(`/api/galeria?ligaId=${ligaId}&limite=12&offset=${fotos.length}`)
    const json = await resposta.json()
    const novas = (json.data?.midias ?? []) as Foto[]
    setFotos((atual) => {
      const ids = new Set(atual.map((foto) => foto.id))
      return [...atual, ...novas.filter((foto) => !ids.has(foto.id))]
    })
    setTemMais(Boolean(json.data?.temMais))
  }

  return (
    <section className="space-y-6">
      <div className="overflow-hidden rounded-3xl border border-white/10">
        <div className="aspect-[21/9] bg-slate-950">
          {capa ? <img src={capa} alt="Foto principal" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm font-bold text-slate-400">Sem foto principal</div>}
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
        <h3 className="font-black text-white">Adicionar foto</h3>
        <p className="mt-1 text-sm font-semibold text-slate-300">JPG, PNG ou WEBP. A foto é reduzida antes de ser publicada.</p>
        <input
          className="mt-4 block w-full text-sm text-slate-200"
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          onChange={(evento) => escolher(evento.target.files?.[0] ?? null)}
        />
        {preview && (
          <div className="mt-4 max-w-sm overflow-hidden rounded-2xl border border-white/10">
            <img src={preview} alt="Pré-visualização" className="aspect-video w-full object-cover" />
          </div>
        )}
        {erro && <p className="mt-3 text-sm font-bold text-red-200">{erro}</p>}
        <button type="button" className="mt-4 rounded-full bg-[#ffb331] px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-50" disabled={!arquivo || publicando} onClick={() => void publicar()}>
          {publicando ? 'Publicando…' : 'Publicar'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {fotos.map((foto) => (
          <figure key={foto.id} className="overflow-hidden rounded-2xl border border-white/10">
            <button type="button" className="block w-full" onClick={() => setAberto(foto)}>
              <img src={foto.thumbUrl || foto.url} alt={foto.titulo ?? 'Foto do campeonato'} className="aspect-square w-full object-cover" loading="lazy" decoding="async" />
            </button>
            <figcaption className="flex gap-2 p-3">
              <button type="button" className="rounded-full bg-white/10 px-3 py-2 text-xs font-black text-white" onClick={() => void definirCapa(foto)}>Foto principal</button>
              <button type="button" className="rounded-full bg-red-500/20 px-3 py-2 text-xs font-black text-red-100" onClick={() => void excluir(foto)}>Excluir</button>
            </figcaption>
          </figure>
        ))}
      </div>
      {temMais && <button type="button" className="rounded-full bg-white/10 px-5 py-3 text-sm font-black text-white" onClick={() => void verMais()}>Ver mais</button>}
      {aberto && (
        <button type="button" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" onClick={() => setAberto(null)}>
          <img src={aberto.url} alt={aberto.titulo ?? 'Foto do campeonato'} className="max-h-[85vh] max-w-full rounded-2xl object-contain" />
        </button>
      )}
    </section>
  )
}
