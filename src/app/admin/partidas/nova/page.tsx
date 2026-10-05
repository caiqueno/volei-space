'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { consultar } from '@/lib/api-cliente'
import { ActionBar } from '@/components/ui/action-bar'

export default function NovaPartidaPage() {
  const router = useRouter()
  const [equipes, setEquipes] = useState<any[]>([])
  const [ligas, setLigas] = useState<any[]>([])
  const [form, setForm] = useState({
    equipeAId: '', equipeBId: '', ligaId: '', categoria: 'MASCULINO',
    rodada: '1', dataHora: '', localNome: '', localEndereco: '',
  })
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    consultar<{ data?: Array<{ id: number }> }>('/api/ligas').then((j) => {
      const items = j.data ?? []
      setLigas(items)
      if (items[0]) {
        setForm(f => ({ ...f, ligaId: String(items[0].id) }))
        fetch(`/api/equipes?ligaId=${items[0].id}`).then(r => r.json()).then(e => setEquipes(e.data ?? []))
      }
    })
  }, [])

  useEffect(() => {
    if (!form.ligaId) return
    fetch(`/api/equipes?ligaId=${form.ligaId}`).then(r => r.json()).then(j => setEquipes(j.data ?? []))
  }, [form.ligaId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.equipeAId === form.equipeBId) {
      setErro('As duas equipes devem ser diferentes')
      return
    }
    setSaving(true)
    const res = await fetch('/api/partidas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        equipeAId: Number(form.equipeAId),
        equipeBId: Number(form.equipeBId),
        ligaId: Number(form.ligaId),
        rodada: Number(form.rodada),
        dataHora: form.dataHora || undefined,
        localNome: form.localNome || undefined,
        localEndereco: form.localEndereco || undefined,
      }),
    })
    setSaving(false)
    if (res.ok) {
      router.push('/admin/partidas')
    } else {
      const json = await res.json()
      setErro(json.error ?? 'Erro ao criar partida')
    }
  }

  const categorias = ['FEMININO', 'FEMININO_MASTER', 'MISTO', 'MASCULINO', 'MASCULINO_MASTER']

  return (
    <div>
      <h2 className="text-2xl font-black text-luva-navy mb-6">Nova Partida</h2>
      <div className="bg-white rounded-xl border border-luva-border p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1">Campeonato</label>
            <select className="w-full border border-luva-border rounded-lg px-3 py-2 text-sm"
              value={form.ligaId} onChange={e => setForm(f => ({ ...f, ligaId: e.target.value, equipeAId: '', equipeBId: '' }))} required>
              <option value="">Selecionar campeonato</option>
              {ligas.map((liga: any) => <option key={liga.id} value={liga.id}>{liga.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Equipe A</label>
            <select className="w-full border border-luva-border rounded-lg px-3 py-2 text-sm"
              value={form.equipeAId} onChange={e => setForm(f => ({ ...f, equipeAId: e.target.value }))} required>
              <option value="">Selecionar</option>
              {equipes.map((eq: any) => <option key={eq.id} value={eq.id}>{eq.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Equipe B</label>
            <select className="w-full border border-luva-border rounded-lg px-3 py-2 text-sm"
              value={form.equipeBId} onChange={e => setForm(f => ({ ...f, equipeBId: e.target.value }))} required>
              <option value="">Selecionar</option>
              {equipes.map((eq: any) => <option key={eq.id} value={eq.id}>{eq.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Categoria</label>
            <select className="w-full border border-luva-border rounded-lg px-3 py-2 text-sm"
              value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
              {categorias.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Rodada</label>
            <input type="number" min="1" className="w-full border border-luva-border rounded-lg px-3 py-2 text-sm"
              value={form.rodada} onChange={e => setForm(f => ({ ...f, rodada: e.target.value }))} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Data e Hora</label>
            <input type="datetime-local" className="w-full border border-luva-border rounded-lg px-3 py-2 text-sm"
              value={form.dataHora} onChange={e => setForm(f => ({ ...f, dataHora: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Local</label>
            <input className="w-full border border-luva-border rounded-lg px-3 py-2 text-sm" placeholder="Nome do ginásio"
              value={form.localNome} onChange={e => setForm(f => ({ ...f, localNome: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Endereço</label>
            <input className="w-full border border-luva-border rounded-lg px-3 py-2 text-sm" placeholder="Endereço"
              value={form.localEndereco} onChange={e => setForm(f => ({ ...f, localEndereco: e.target.value }))} />
          </div>
          {erro && <p className="col-span-2 text-sm text-red-500">{erro}</p>}
          <ActionBar type="submit" loading={saving} loadingLabel="Criando"
            className="col-span-2 w-full bg-luva-blue text-white rounded-lg px-4 py-2 font-semibold hover:bg-luva-navy disabled:opacity-50">
            Criar Partida
          </ActionBar>
        </form>
      </div>
    </div>
  )
}
