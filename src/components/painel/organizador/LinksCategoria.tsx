'use client'

import { useState } from 'react'

type Categoria = { id: string; nome: string; quantidade: number }
type Vaga = { vaga: number; nome: string; caminho: string | null }

export function LinksCategoria({ ligaId, nome, compacto = false }: { ligaId: number; nome: string; compacto?: boolean }) {
  const [aberto, setAberto] = useState(false)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [categoriaId, setCategoriaId] = useState<string | null>(null)
  const [vagas, setVagas] = useState<Vaga[]>([])
  const [aviso, setAviso] = useState('')
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState<string | null>(null)

  async function carregar(id?: string | null) {
    const consulta = id ? `?categoriaCampeonatoId=${encodeURIComponent(id)}` : ''
    const resposta = await fetch(`/api/organizador/ligas/${ligaId}/vagas-inscricao${consulta}`, { cache: 'no-store' })
    const json = await resposta.json().catch(() => ({}))
    if (!resposta.ok) throw new Error(json.error || 'Não foi possível ler as vagas.')
    setCategorias(json.data?.categorias ?? [])
    setCategoriaId(json.data?.categoriaId ?? null)
    setVagas(json.data?.vagas ?? [])
  }

  async function abrir() {
    setAberto(true)
    setErro('')
    setAviso('')
    setOcupado('lista')
    try {
      await carregar(categoriaId)
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível ler as vagas.')
    } finally {
      setOcupado(null)
    }
  }

  async function gerar(vaga: number) {
    if (!categoriaId) return
    setOcupado(String(vaga))
    setErro('')
    setAviso('')
    try {
      const resposta = await fetch(`/api/organizador/ligas/${ligaId}/vagas-inscricao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoriaCampeonatoId: categoriaId, vaga }),
      })
      const json = await resposta.json().catch(() => ({}))
      if (!resposta.ok) throw new Error(json.error || 'Não foi possível gerar o link.')
      await carregar(categoriaId)
      const caminho = json.data?.caminho as string | undefined
      if (caminho) await navigator.clipboard.writeText(`${window.location.origin}${caminho}`)
      setAviso(caminho ? 'Link copiado. Ele continua o mesmo depois de atualizar a página.' : 'Link recuperado.')
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível gerar o link.')
    } finally {
      setOcupado(null)
    }
  }

  return (
    <>
      <button type="button" onClick={() => void abrir()} className={compacto ? 'championship-list-link' : 'rounded-full bg-[#ffb331] px-5 py-3 text-sm font-black uppercase tracking-wide text-[#050914]'}>
        Links das equipes
      </button>
      {aberto ? (
        <div className="mobile-sheet fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-3 sm:items-center sm:px-4">
          <section className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-t-[1.75rem] border border-white/10 bg-[#07111f] p-6 text-white sm:rounded-[1.75rem]">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-luva-amber">Inscrição por equipe</p>
            <h2 className="mt-2 font-display text-3xl font-black">{nome}</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-white/75">Cada vaga tem o próprio link. A quantidade segue a parametrização da categoria. Gerar de novo devolve o mesmo link.</p>
            {categorias.length > 1 ? (
              <label className="mt-4 block text-sm font-black">
                Categoria
                <select className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm" value={categoriaId ?? ''} onChange={(evento) => void carregar(evento.target.value)}>
                  {categorias.map((categoria) => <option key={categoria.id} value={categoria.id}>{categoria.nome}</option>)}
                </select>
              </label>
            ) : null}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs font-black uppercase tracking-wide text-white/60">
                  <tr>
                    <th className="px-3 py-2">Nome equipe</th>
                    <th className="px-3 py-2">Gerar link</th>
                    <th className="px-3 py-2">Link compartilhável</th>
                  </tr>
                </thead>
                <tbody>
                  {vagas.map((vaga) => (
                    <tr key={vaga.vaga} className="border-t border-white/10">
                      <td className="px-3 py-3 font-black">{vaga.nome}</td>
                      <td className="px-3 py-3">
                        <button type="button" disabled={ocupado === String(vaga.vaga)} onClick={() => void gerar(vaga.vaga)} className="rounded-full bg-[#ffb331] px-4 py-2 text-xs font-black text-[#050914] disabled:opacity-60">
                          {vaga.caminho ? 'Copiar link' : 'Gerar link'}
                        </button>
                      </td>
                      <td className="px-3 py-3 break-all text-xs font-bold text-white/70">{vaga.caminho ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!ocupado && vagas.length === 0 ? <p className="mt-3 text-sm font-semibold text-white/70">Defina a quantidade de equipes na parametrização desta categoria.</p> : null}
            </div>
            {aviso ? <p className="mt-3 text-sm font-black text-emerald-300">{aviso}</p> : null}
            {erro ? <p className="mt-3 text-sm font-bold text-red-200">{erro}</p> : null}
            <button type="button" onClick={() => setAberto(false)} className="mt-5 rounded-full border border-white/20 px-4 py-2 text-sm font-black">Fechar</button>
          </section>
        </div>
      ) : null}
    </>
  )
}
