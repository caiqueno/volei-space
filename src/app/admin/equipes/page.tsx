'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { consultar } from '@/lib/api-cliente'
import { Badge } from '@/components/ui/Badge'
import { ActionBar } from '@/components/ui/action-bar'

export default function AdminEquipesPage() {
  const [equipes, setEquipes] = useState<any[]>([])
  const [ligas, setLigas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [nome, setNome] = useState('')
  const [ligaId, setLigaId] = useState('')
  const [categoria, setCategoria] = useState('MASCULINO')
  const [busca, setBusca] = useState('')
  const [filtroLigaId, setFiltroLigaId] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function fetchEquipes() {
    setLoading(true)
    const params = new URLSearchParams()
    if (busca.trim()) params.set('q', busca.trim())
    if (filtroLigaId) params.set('ligaId', filtroLigaId)
    if (filtroCategoria) params.set('categoria', filtroCategoria)
    const res = await fetch(`/api/equipes${params.toString() ? `?${params.toString()}` : ''}`)
    const json = await res.json()
    setEquipes(json.data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    fetchEquipes()
    consultar<{ data?: Array<{ id: number }> }>('/api/ligas').then((j) => {
      const items = j.data ?? []
      setLigas(items)
      if (items[0]) setLigaId(String(items[0].id))
    })
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/equipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, ligaId: Number(ligaId), categoria }),
    })
    const json = await res.json()
    setSaving(false)
    if (res.ok) {
      setMsg('Equipe criada com sucesso!')
      setNome('')
      fetchEquipes()
    } else {
      setMsg(json.error ?? 'Erro ao criar equipe')
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Excluir esta equipe?')) return
    await fetch(`/api/equipes/${id}`, { method: 'DELETE' })
    fetchEquipes()
  }

  const categorias = ['FEMININO', 'FEMININO_MASTER', 'MISTO', 'MASCULINO', 'MASCULINO_MASTER']

  return (
    <div>
      <h2 className="text-2xl font-black text-luva-navy mb-6">Equipes</h2>

      <div className="bg-white rounded-xl border border-luva-border p-4 mb-6">
        <div className="grid gap-3 md:grid-cols-4">
          <input className="border border-luva-border rounded-lg px-3 py-2 text-sm md:col-span-2" placeholder="Buscar equipe" value={busca} onChange={e => setBusca(e.target.value)} />
          <select className="border border-luva-border rounded-lg px-3 py-2 text-sm" value={filtroLigaId} onChange={e => setFiltroLigaId(e.target.value)}>
            <option value="">Todos os campeonatos</option>
            {ligas.map((liga: any) => <option key={liga.id} value={liga.id}>{liga.nome}</option>)}
          </select>
          <div className="flex gap-2">
            <select className="min-w-0 flex-1 border border-luva-border rounded-lg px-3 py-2 text-sm" value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
              <option value="">Todas as categorias</option>
              {categorias.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button type="button" onClick={fetchEquipes} className="rounded-lg bg-luva-blue px-4 py-2 text-sm font-bold text-white">Filtrar</button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-luva-border p-6 mb-6">
        <h3 className="font-bold mb-4">Nova Equipe</h3>
        <form onSubmit={handleCreate} className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <input
            className="col-span-2 border border-luva-border rounded-lg px-3 py-2 text-sm"
            placeholder="Nome da equipe" value={nome} onChange={e => setNome(e.target.value)} required
          />
          <select className="border border-luva-border rounded-lg px-3 py-2 text-sm" value={categoria} onChange={e => setCategoria(e.target.value)}>
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="col-span-2 border border-luva-border rounded-lg px-3 py-2 text-sm md:col-span-4" value={ligaId} onChange={e => setLigaId(e.target.value)} required>
            <option value="">Selecionar campeonato</option>
            {ligas.map((liga: any) => <option key={liga.id} value={liga.id}>{liga.nome}</option>)}
          </select>
          <ActionBar type="submit" loading={saving} loadingLabel="Criando"
            className="col-span-2 md:col-span-4 w-full bg-luva-blue text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-luva-navy transition-colors disabled:opacity-50"
          >
            + Criar Equipe
          </ActionBar>
        </form>
        {msg && <p className="text-sm mt-2 text-luva-muted">{msg}</p>}
      </div>

      {loading ? (
        <p className="text-luva-muted">Carregando...</p>
      ) : (
        <div className="bg-white rounded-xl border border-luva-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-luva-border">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Nome</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Categoria</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Campeonato</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Jogadores</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-luva-border">
              {equipes.map((e: any) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{e.nome}</td>
                  <td className="px-4 py-3"><Badge variant="neutral">{e.categoria}</Badge></td>
                  <td className="px-4 py-3 text-luva-muted">{e.liga?.nome ?? e.ligaId}</td>
                  <td className="px-4 py-3 text-luva-muted">{e.jogadores?.length ?? 0}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(e.id)} className="text-xs text-red-500 hover:text-red-700">Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
