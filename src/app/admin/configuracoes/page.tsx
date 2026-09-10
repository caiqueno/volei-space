'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Plus, Save, Trophy } from 'lucide-react'

type Liga = {
  id: number
  slug: string
  nome: string
  subtitulo?: string | null
  descricao?: string | null
  corTematica?: string | null
  status?: string | null
  dataInicio?: string | null
  dataFim?: string | null
}

const emptyForm = {
  nome: '',
  slug: '',
  subtitulo: '',
  descricao: '',
  corTematica: '#0F2C52',
  status: 'EM_BREVE',
  dataInicio: '',
  dataFim: '',
}

export default function ConfiguracoesPage() {
  const [ligas, setLigas] = useState<Liga[]>([])
  const [selectedSlug, setSelectedSlug] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const selected = useMemo(() => ligas.find((liga) => liga.slug === selectedSlug) ?? null, [ligas, selectedSlug])

  useEffect(() => {
    fetchLigas()
  }, [])

  async function fetchLigas() {
    const res = await fetch('/api/ligas')
    const json = await res.json()
    const items = json.data ?? []
    setLigas(items)
    if (!selectedSlug && items[0]) selectLiga(items[0])
  }

  function selectLiga(liga: Liga) {
    setSelectedSlug(liga.slug)
    setForm({
      nome: liga.nome ?? '',
      slug: liga.slug ?? '',
      subtitulo: liga.subtitulo ?? '',
      descricao: liga.descricao ?? '',
      corTematica: liga.corTematica ?? '#0F2C52',
      status: liga.status ?? 'EM_BREVE',
      dataInicio: toDatetimeLocal(liga.dataInicio),
      dataFim: toDatetimeLocal(liga.dataFim),
    })
  }

  function newLiga() {
    setSelectedSlug('')
    setForm(emptyForm)
    setMsg('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMsg('')

    const payload = {
      ...form,
      dataInicio: form.dataInicio ? new Date(form.dataInicio).toISOString() : undefined,
      dataFim: form.dataFim ? new Date(form.dataFim).toISOString() : undefined,
    }

    const res = await fetch(selected ? `/api/ligas/${selected.slug}` : '/api/ligas', {
      method: selected ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    setSaving(false)

    if (!res.ok) {
      setMsg(json.error ?? 'Não foi possível salvar o campeonato.')
      return
    }

    setMsg(selected ? 'Campeonato atualizado.' : 'Campeonato criado.')
    await fetchLigas()
    if (json.data) selectLiga(json.data)
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-luva-blue">Campeonatos</p>
            <h2 className="mt-1 text-2xl font-black text-luva-navy">Temporadas</h2>
          </div>
          <button onClick={newLiga} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-luva-amber text-slate-950 transition hover:bg-amber-300" aria-label="Novo campeonato">
            <Plus size={19} />
          </button>
        </div>

        <div className="mt-5 grid gap-3">
          {ligas.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-luva-muted">Nenhum campeonato cadastrado.</p>
          ) : (
            ligas.map((liga) => (
              <button
                key={liga.id}
                onClick={() => selectLiga(liga)}
                className={`rounded-2xl border p-4 text-left transition ${selectedSlug === liga.slug ? 'border-luva-amber bg-amber-50' : 'border-slate-200 bg-white hover:border-luva-blue'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-950">{liga.nome}</p>
                    <p className="mt-1 text-xs font-bold text-luva-muted">{liga.slug}</p>
                  </div>
                  <span className="rounded-full bg-slate-950 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white">{liga.status}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-luva-blue">{selected ? 'Editar campeonato' : 'Novo campeonato'}</p>
            <h2 className="mt-1 text-3xl font-black text-luva-navy">{selected ? selected.nome : 'Cadastrar temporada'}</h2>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-2xl bg-luva-navy px-4 py-3 text-sm font-black text-white">
            <Trophy size={16} className="text-luva-amber" />
            Gestão oficial
          </span>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <Field label="Nome do campeonato">
            <input className={inputClass} value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} required placeholder="LUV 2026 - Série Ouro" />
          </Field>
          <Field label="Slug público">
            <input className={inputClass} value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))} required placeholder="luv-2026-serie-ouro" />
          </Field>
          <Field label="Subtítulo">
            <input className={inputClass} value={form.subtitulo} onChange={(e) => setForm((f) => ({ ...f, subtitulo: e.target.value }))} placeholder="Temporada oficial" />
          </Field>
          <Field label="Status">
            <select className={inputClass} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              <option value="EM_BREVE">Em breve</option>
              <option value="ATIVA">Ativa</option>
              <option value="ENCERRADA">Encerrada</option>
            </select>
          </Field>
          <Field label="Início">
            <input type="datetime-local" className={inputClass} value={form.dataInicio} onChange={(e) => setForm((f) => ({ ...f, dataInicio: e.target.value }))} />
          </Field>
          <Field label="Fim">
            <input type="datetime-local" className={inputClass} value={form.dataFim} onChange={(e) => setForm((f) => ({ ...f, dataFim: e.target.value }))} />
          </Field>
          <Field label="Cor temática">
            <div className="flex gap-2">
              <input type="color" className="h-12 w-14 rounded-2xl border border-slate-200 bg-white p-1" value={form.corTematica} onChange={(e) => setForm((f) => ({ ...f, corTematica: e.target.value }))} />
              <input className={`${inputClass} font-mono`} value={form.corTematica} onChange={(e) => setForm((f) => ({ ...f, corTematica: e.target.value }))} />
            </div>
          </Field>
          <Field label="Descrição" className="md:col-span-2">
            <textarea className={`${inputClass} min-h-32 resize-none`} value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} placeholder="Resumo público do campeonato, formato, fases e diferenciais." />
          </Field>

          {msg && <p className="md:col-span-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-luva-muted">{msg}</p>}

          <button type="submit" disabled={saving} className="md:col-span-2 inline-flex items-center justify-center gap-2 rounded-2xl bg-luva-amber px-5 py-4 text-sm font-black uppercase tracking-wide text-slate-950 transition hover:-translate-y-0.5 hover:bg-amber-300 disabled:opacity-60">
            <Save size={18} />
            {saving ? 'Salvando...' : selected ? 'Salvar campeonato' : 'Criar campeonato'}
          </button>
        </form>
      </section>
    </div>
  )
}

function Field({ label, className = '', children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`grid gap-1.5 ${className}`}>
      <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</span>
      {children}
    </label>
  )
}

const inputClass = 'w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-950 outline-none transition focus:border-luva-blue focus:bg-white focus:ring-4 focus:ring-blue-100'

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function toDatetimeLocal(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
