'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { ActionBar } from '@/components/ui/action-bar'

export default function AdminJogadoresPage() {
  const [jogadores, setJogadores] = useState<any[]>([])
  const [equipes, setEquipes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ nome: '', equipeId: '', numero: '', posicao: '' })
  const [busca, setBusca] = useState('')
  const [filtroEquipeId, setFiltroEquipeId] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function fetchData() {
    setLoading(true)
    const params = new URLSearchParams()
    if (busca.trim()) params.set('q', busca.trim())
    if (filtroEquipeId) params.set('equipeId', filtroEquipeId)

    const [jRes, eRes] = await Promise.all([
      fetch(`/api/jogadores${params.toString() ? `?${params.toString()}` : ''}`).then(r => r.json()),
      fetch('/api/equipes').then(r => r.json()),
    ])

    setJogadores(jRes.data ?? [])
    setEquipes(eRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/jogadores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: form.nome,
        equipeId: Number(form.equipeId),
        numero: form.numero ? Number(form.numero) : undefined,
        posicao: form.posicao || undefined,
      }),
    })
    const json = await res.json().catch(() => ({}))
    setSaving(false)
    if (res.ok) {
      setMsg('Jogador criado.')
      setForm({ nome: '', equipeId: '', numero: '', posicao: '' })
      fetchData()
    } else {
      setMsg(json.error ?? 'Erro ao criar jogador.')
    }
  }

  async function toggleBan(jogador: any) {
    const next = !jogador.banido
    const label = next ? 'bloquear' : 'desbloquear'
    if (!confirm(`Deseja ${label} este jogador?`)) return

    const res = await fetch(`/api/jogadores/${jogador.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ banido: next }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMsg(json.error ?? `Erro ao ${label} jogador.`)
      return
    }

    setMsg(next ? 'Jogador bloqueado.' : 'Jogador desbloqueado.')
    fetchData()
  }

  async function handleDelete(id: number) {
    if (!confirm('Excluir este jogador?')) return
    const res = await fetch(`/api/jogadores/${id}`, { method: 'DELETE' })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMsg(json.error ?? 'Erro ao excluir jogador.')
      return
    }
    setMsg('Jogador excluído.')
    fetchData()
  }

  return (
    <div>
      <h2 className="mb-6 text-2xl font-black text-white">Jogadores</h2>

      <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <input
            className="rounded-xl border border-white/15 bg-[#0b1726] px-3 py-2 text-sm font-semibold text-white outline-none placeholder:text-slate-400"
            placeholder="Buscar jogador"
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
          <select
            className="rounded-xl border border-white/15 bg-[#0b1726] px-3 py-2 text-sm font-semibold text-white outline-none"
            value={filtroEquipeId}
            onChange={e => setFiltroEquipeId(e.target.value)}
          >
            <option value="">Todas as equipes</option>
            {equipes.map((eq: any) => <option key={eq.id} value={eq.id}>{eq.nome}</option>)}
          </select>
          <button type="button" onClick={fetchData} className="rounded-xl bg-[#ffb331] px-4 py-2 text-sm font-black text-white">
            Filtrar
          </button>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-6">
        <h3 className="mb-4 font-black text-white">Novo jogador</h3>
        <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-4">
          <input
            className="rounded-xl border border-white/15 bg-[#0b1726] px-3 py-2 text-sm font-semibold text-white outline-none placeholder:text-slate-400"
            placeholder="Nome"
            value={form.nome}
            onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
            required
          />
          <select
            className="rounded-xl border border-white/15 bg-[#0b1726] px-3 py-2 text-sm font-semibold text-white outline-none"
            value={form.equipeId}
            onChange={e => setForm(f => ({ ...f, equipeId: e.target.value }))}
            required
          >
            <option value="">Selecionar equipe</option>
            {equipes.map((eq: any) => <option key={eq.id} value={eq.id}>{eq.nome}</option>)}
          </select>
          <input
            className="rounded-xl border border-white/15 bg-[#0b1726] px-3 py-2 text-sm font-semibold text-white outline-none placeholder:text-slate-400"
            placeholder="Nº camisa"
            type="number"
            value={form.numero}
            onChange={e => setForm(f => ({ ...f, numero: e.target.value }))}
          />
          <input
            className="rounded-xl border border-white/15 bg-[#0b1726] px-3 py-2 text-sm font-semibold text-white outline-none placeholder:text-slate-400"
            placeholder="Posição"
            value={form.posicao}
            onChange={e => setForm(f => ({ ...f, posicao: e.target.value }))}
          />
          <ActionBar type="submit" loading={saving} loadingLabel="Criando" className="w-full rounded-xl bg-[#ffb331] px-4 py-2 text-sm font-black text-white disabled:opacity-50 md:col-span-4">
            + Criar jogador
          </ActionBar>
        </form>
        {msg && <p className="mt-3 text-sm font-semibold text-slate-200">{msg}</p>}
      </div>

      {loading ? <p className="text-slate-300">Carregando...</p> : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
          <div className="max-w-full">
            <table data-stack className="w-full text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03]">
                <tr>
                  <th className="px-4 py-3 text-left font-black text-slate-300">Nome</th>
                  <th className="px-4 py-3 text-left font-black text-slate-300">Equipe</th>
                  <th className="px-4 py-3 text-left font-black text-slate-300">Nº</th>
                  <th className="px-4 py-3 text-left font-black text-slate-300">Posição</th>
                  <th className="px-4 py-3 text-left font-black text-slate-300">Status</th>
                  <th className="px-4 py-3 text-left font-black text-slate-300">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {jogadores.map((j: any) => (
                  <tr key={j.id} className="transition hover:bg-white/[0.03]">
                    <td data-label="Nome" className="px-4 py-3 font-black text-white">{j.nome}</td>
                    <td data-label="Equipe" className="px-4 py-3 font-semibold text-slate-300">{j.equipe?.nome ?? '-'}</td>
                    <td data-label="Número" className="px-4 py-3 font-semibold text-slate-300">{j.numero ?? '-'}</td>
                    <td data-label="Posição" className="px-4 py-3 font-semibold text-slate-300">{j.posicao ?? '-'}</td>
                    <td data-label="Status" className="px-4 py-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${j.banido ? 'bg-red-500/15 text-red-200 ring-1 ring-red-400/30' : 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/30'}`}>
                        {j.banido ? 'Bloqueado' : 'Ativo'}
                      </span>
                    </td>
                    <td data-label="Ações" className="flex flex-wrap gap-3 px-4 py-3">
                      <button onClick={() => toggleBan(j)} className="text-xs font-black text-[#ffb331] hover:text-white">
                        {j.banido ? 'Desbloquear' : 'Bloquear'}
                      </button>
                      <button onClick={() => handleDelete(j.id)} className="text-xs font-black text-red-300 hover:text-red-100">
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
