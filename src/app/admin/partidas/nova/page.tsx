'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ActionBar } from '@/components/ui/action-bar'
import { useConsulta } from '@/lib/use-consulta'

type LigaOpcao = { id: number; nome: string }
type EquipeOpcao = { id: number; nome: string }
type CategoriaOpcao = { id: string; nome: string; codigo: string }

export default function NovaPartidaPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    equipeAId: '', equipeBId: '', ligaId: '', categoria: '',
    rodada: '1', dataHora: '', localNome: '', localEndereco: '',
  })
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  const ligasConsulta = useConsulta<{ data?: LigaOpcao[] }>('/api/ligas')
  const ligas = ligasConsulta.dados?.data ?? []

  useEffect(() => {
    const primeira = ligasConsulta.dados?.data?.[0]
    if (!primeira) return
    setForm((atual) => (atual.ligaId ? atual : { ...atual, ligaId: String(primeira.id) }))
  }, [ligasConsulta.dados])

  const equipesConsulta = useConsulta<{ data?: EquipeOpcao[] }>(
    form.ligaId ? `/api/equipes?ligaId=${encodeURIComponent(form.ligaId)}` : null,
  )
  const categoriasConsulta = useConsulta<{ data?: CategoriaOpcao[] }>(
    form.ligaId ? `/api/categorias?ligaId=${encodeURIComponent(form.ligaId)}` : null,
  )
  const equipesCarregando = equipesConsulta.carregando || equipesConsulta.atualizando
  const categoriasCarregando = categoriasConsulta.carregando || categoriasConsulta.atualizando
  const equipes = equipesConsulta.estado === 'success' ? equipesConsulta.dados?.data ?? [] : []
  const categorias = (categoriasConsulta.estado === 'success' ? categoriasConsulta.dados?.data ?? [] : [])
    .filter((categoria) => categoria.codigo)

  useEffect(() => {
    const lista = (categoriasConsulta.dados?.data ?? []).filter((categoria) => categoria.codigo)
    if (categoriasConsulta.estado !== 'success' || !lista.length) return
    setForm((atual) => (
      lista.some((categoria) => categoria.codigo === atual.categoria)
        ? atual
        : { ...atual, categoria: lista[0].codigo }
    ))
  }, [categoriasConsulta.dados, categoriasConsulta.estado])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    if (form.equipeAId === form.equipeBId) {
      setErro('As duas equipes devem ser diferentes')
      return
    }
    if (!form.categoria) {
      setErro('Selecione a categoria do campeonato')
      return
    }
    setErro('')
    setSaving(true)
    try {
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
      const json = await res.json().catch(() => null) as { error?: string } | null
      if (!res.ok) {
        setErro(json?.error ?? 'Erro ao criar partida')
        return
      }
      router.push('/admin/partidas')
    } catch {
      setErro('Falha na conexão. Tente novamente em instantes.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-black text-luva-navy mb-6">Nova Partida</h2>
      <div className="bg-white rounded-xl border border-luva-border p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1">Campeonato</label>
            <select className="w-full border border-luva-border rounded-lg px-3 py-2 text-sm"
              value={form.ligaId} onChange={e => setForm(f => ({ ...f, ligaId: e.target.value, equipeAId: '', equipeBId: '', categoria: '' }))} required>
              <option value="">{ligasConsulta.carregando && ligas.length === 0 ? 'Carregando campeonatos...' : 'Selecionar campeonato'}</option>
              {ligas.map((liga) => <option key={liga.id} value={liga.id}>{liga.nome}</option>)}
            </select>
            {ligasConsulta.erro && (
              <p className="mt-1 text-sm text-red-500">
                {ligasConsulta.erro}{' '}
                <button type="button" onClick={() => ligasConsulta.tentarNovamente()} className="font-semibold underline">Tentar novamente</button>
              </p>
            )}
            {ligasConsulta.estado === 'success' && ligas.length === 0 && (
              <p className="mt-1 text-sm text-slate-500">Nenhum campeonato disponível.</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Equipe A</label>
            <select className="w-full border border-luva-border rounded-lg px-3 py-2 text-sm"
              value={form.equipeAId} onChange={e => setForm(f => ({ ...f, equipeAId: e.target.value }))} required>
              <option value="">{equipesCarregando ? 'Carregando equipes...' : 'Selecionar'}</option>
              {equipes.map((eq) => <option key={eq.id} value={eq.id}>{eq.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Equipe B</label>
            <select className="w-full border border-luva-border rounded-lg px-3 py-2 text-sm"
              value={form.equipeBId} onChange={e => setForm(f => ({ ...f, equipeBId: e.target.value }))} required>
              <option value="">{equipesCarregando ? 'Carregando equipes...' : 'Selecionar'}</option>
              {equipes.map((eq) => <option key={eq.id} value={eq.id}>{eq.nome}</option>)}
            </select>
          </div>
          {equipesConsulta.erro && (
            <p className="col-span-2 text-sm text-red-500">
              {equipesConsulta.erro}{' '}
              <button type="button" onClick={() => equipesConsulta.tentarNovamente()} className="font-semibold underline">Tentar novamente</button>
            </p>
          )}
          {form.ligaId && equipesConsulta.estado === 'success' && equipes.length === 0 && (
            <p className="col-span-2 text-sm text-slate-500">Nenhuma equipe aprovada neste campeonato.</p>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Categoria</label>
            <select className="w-full border border-luva-border rounded-lg px-3 py-2 text-sm"
              value={categorias.some((categoria) => categoria.codigo === form.categoria) ? form.categoria : ''}
              onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
              required>
              {!form.ligaId && <option value="">Selecione o campeonato</option>}
              {form.ligaId && categoriasCarregando && <option value="">Carregando categorias...</option>}
              {form.ligaId && categoriasConsulta.estado === 'error' && <option value="">Não foi possível carregar</option>}
              {form.ligaId && categoriasConsulta.estado === 'success' && categorias.length === 0 && <option value="">Nenhuma categoria neste campeonato</option>}
              {categorias.map((categoria) => <option key={categoria.id} value={categoria.codigo}>{categoria.nome}</option>)}
            </select>
            {categoriasConsulta.erro && (
              <p className="mt-1 text-sm text-red-500">
                {categoriasConsulta.erro}{' '}
                <button type="button" onClick={() => categoriasConsulta.tentarNovamente()} className="font-semibold underline">Tentar novamente</button>
              </p>
            )}
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
