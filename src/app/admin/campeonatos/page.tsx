'use client'
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ExternalLink, Trash2 } from 'lucide-react'
import { formatLigaFormato, formatLigaStatus } from '@/lib/format-liga'

const statusOptions = [
  { value: '', label: 'Todos' },
  { value: 'EM_BREVE', label: 'Em breve' },
  { value: 'ATIVA', label: 'Ativos' },
  { value: 'ENCERRADA', label: 'Encerrados' },
]

export default function AdminCampeonatosPage() {
  const [ligas, setLigas] = useState<any[]>([])
  const [busca, setBusca] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  async function fetchLigas() {
    setLoading(true)
    const params = new URLSearchParams()
    if (busca.trim()) params.set('q', busca.trim())
    if (status) params.set('status', status)

    const res = await fetch(`/api/ligas${params.toString() ? `?${params.toString()}` : ''}`, { cache: 'no-store' })
    const json = await res.json().catch(() => ({}))
    setLigas(json.data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchLigas() }, [])

  async function handleDelete(liga: any) {
    const confirmed = confirm(
      `Excluir o campeonato "${liga.nome}"?\n\nEssa ação remove partidas, equipes, inscrições, galeria e mensagens vinculadas.`
    )
    if (!confirmed) return

    const res = await fetch(`/api/ligas/${encodeURIComponent(liga.slug)}`, { method: 'DELETE' })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMsg(json.error ?? 'Erro ao excluir campeonato.')
      return
    }

    setMsg('Campeonato excluído.')
    fetchLigas()
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 text-xs font-black uppercase tracking-[0.24em] text-[#ffb331]">Gestão da liga</p>
          <h2 className="text-3xl font-black text-white">Campeonatos</h2>
          <p className="mt-2 text-sm font-semibold text-slate-300">Busque, acompanhe e remova campeonatos publicados na plataforma.</p>
        </div>
        <Link href="/painel" className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-black text-white hover:border-[#ffb331]">
          Painel do criador
        </Link>
      </div>

      <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
          <input
            className="rounded-xl border border-white/15 bg-[#0b1726] px-3 py-2 text-sm font-semibold text-white outline-none placeholder:text-slate-400"
            placeholder="Buscar por nome, subtítulo ou descrição"
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
          <select
            className="rounded-xl border border-white/15 bg-[#0b1726] px-3 py-2 text-sm font-semibold text-white outline-none"
            value={status}
            onChange={e => setStatus(e.target.value)}
          >
            {statusOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <button type="button" onClick={fetchLigas} className="rounded-xl bg-[#ffb331] px-4 py-2 text-sm font-black text-white">
            Filtrar
          </button>
        </div>
      </div>

      {msg && <p className="mb-4 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100">{msg}</p>}

      {loading ? (
        <p className="text-slate-300">Carregando...</p>
      ) : ligas.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-10 text-center">
          <h3 className="text-xl font-black text-white">Nenhum campeonato encontrado.</h3>
          <p className="mt-2 text-sm font-semibold text-slate-300">Ajuste os filtros ou crie um campeonato no painel do criador.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03]">
                <tr>
                  <th className="px-4 py-3 text-left font-black text-slate-300">Campeonato</th>
                  <th className="px-4 py-3 text-left font-black text-slate-300">Status</th>
                  <th className="px-4 py-3 text-left font-black text-slate-300">Formato</th>
                  <th className="px-4 py-3 text-left font-black text-slate-300">Equipes</th>
                  <th className="px-4 py-3 text-left font-black text-slate-300">Link público</th>
                  <th className="px-4 py-3 text-left font-black text-slate-300">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {ligas.map((liga: any) => (
                  <tr key={liga.id} className="transition hover:bg-white/[0.03]">
                    <td className="px-4 py-4">
                      <p className="font-black text-white">{liga.nome}</p>
                      <p className="mt-1 max-w-sm truncate text-xs font-semibold text-slate-300">{liga.subtitulo || liga.descricao || '-'}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-full border border-white/15 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-slate-100">
                        {formatLigaStatus(liga.status)}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-semibold text-slate-200">{formatLigaFormato(liga.formato)}</td>
                    <td className="px-4 py-4 font-semibold text-slate-200">
                      {liga.quantidadeEquipes ? `${liga.equipesAprovadas ?? 0}/${liga.quantidadeEquipes}` : '-'}
                    </td>
                    <td className="px-4 py-4">
                      <Link href={`/campeonatos/${liga.slug}`} className="inline-flex items-center gap-2 text-xs font-black text-[#ffb331] hover:text-white">
                        Abrir <ExternalLink size={14} />
                      </Link>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        onClick={() => handleDelete(liga)}
                        className="inline-flex items-center gap-2 rounded-full border border-red-400/30 px-3 py-2 text-xs font-black text-red-200 hover:bg-red-500/15"
                      >
                        <Trash2 size={14} />
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
