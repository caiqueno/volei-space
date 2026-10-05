'use client'

import { useState } from 'react'

type CategoriaLink = {
  id: string
  nome: string
  caminho: string | null
}

export function LinksCategoria({ ligaId, nome, compacto = false }: { ligaId: number; nome: string; compacto?: boolean }) {
  const [aberto, setAberto] = useState(false)
  const [categorias, setCategorias] = useState<CategoriaLink[]>([])
  const [aviso, setAviso] = useState('')
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState<string | null>(null)

  async function carregar() {
    const resposta = await fetch(`/api/organizador/ligas/${ligaId}/links-categoria`, { cache: 'no-store' })
    const json = await resposta.json().catch(() => ({}))
    if (!resposta.ok) throw new Error(json.error || 'Não foi possível ler as categorias.')
    setCategorias(json.data ?? [])
  }

  async function abrir() {
    setAberto(true)
    setErro('')
    setAviso('')
    setOcupado('lista')
    try {
      await carregar()
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível ler as categorias.')
    } finally {
      setOcupado(null)
    }
  }

  async function gerar(categoriaId: string) {
    setOcupado(categoriaId)
    setErro('')
    setAviso('')
    try {
      const resposta = await fetch(`/api/organizador/ligas/${ligaId}/links-categoria`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoriaCampeonatoId: categoriaId }),
      })
      const json = await resposta.json().catch(() => ({}))
      if (!resposta.ok) throw new Error(json.error || 'Não foi possível gerar o link.')
      await carregar()
      if (json.data?.caminho) await navigator.clipboard.writeText(`${window.location.origin}${json.data.caminho}`)
      setAviso('Link da categoria copiado. A equipe entra direto, sem aprovação.')
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível gerar o link.')
    } finally {
      setOcupado(null)
    }
  }

  return (
    <>
      <button type="button" onClick={() => void abrir()} className={compacto ? 'championship-list-link' : 'rounded-full bg-[#ffb331] px-5 py-3 text-sm font-black uppercase tracking-wide text-[#050914]'}>
        {compacto ? 'Links das categorias' : 'Links das categorias'}
      </button>
      {aberto ? (
        <div className="mobile-sheet fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-3 sm:items-center sm:px-4">
          <section className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[1.75rem] border border-white/10 bg-[#07111f] p-6 text-white sm:rounded-[1.75rem]">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-luva-amber">Inscrição por categoria</p>
            <h2 className="mt-2 font-display text-3xl font-black">{nome}</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-white/75">Cada categoria tem o próprio link. O líder cadastra a equipe nessa categoria e ela já entra no campeonato.</p>
            <div className="mt-4 grid gap-3">
              {categorias.map((categoria) => (
                <div key={categoria.id} className="rounded-2xl border border-white/10 p-4">
                  <p className="font-black">{categoria.nome}</p>
                  {categoria.caminho ? <p className="mt-2 break-all text-xs font-bold text-white/70">{categoria.caminho}</p> : <p className="mt-2 text-xs font-bold text-white/50">Link ainda não gerado.</p>}
                  <button type="button" disabled={ocupado === categoria.id} onClick={() => void gerar(categoria.id)} className="mt-3 rounded-full bg-[#ffb331] px-4 py-2 text-sm font-black text-[#050914] disabled:opacity-60">
                    {categoria.caminho ? 'Copiar link' : 'Gerar e copiar'}
                  </button>
                </div>
              ))}
              {!ocupado && categorias.length === 0 ? <p className="text-sm font-semibold text-white/70">Este campeonato ainda não tem categoria.</p> : null}
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
