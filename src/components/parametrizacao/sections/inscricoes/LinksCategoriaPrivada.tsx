'use client'

import { useCallback, useEffect, useState } from 'react'
import { Copy, MessageCircle } from 'lucide-react'
import { FormAlert } from '../../ui/FormAlert'
import { avisoLinks, linkWhatsapp, urlCompleta, type LinkCategoriaUi } from './visibilidade-ui'

// Lista os links de inscrição por categoria (rota links-categoria do organizador).
// Só aparece em competição privada: sem o link, ninguém consegue se inscrever.
export function LinksCategoriaPrivada({ ligaId }: { ligaId: number }) {
  const [links, setLinks] = useState<LinkCategoriaUi[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [gerando, setGerando] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    try {
      const resposta = await fetch(`/api/organizador/ligas/${ligaId}/links-categoria`, { cache: 'no-store' })
      const json = await resposta.json().catch(() => ({}))
      if (!resposta.ok) throw new Error(json.error ?? 'Não foi possível carregar os links.')
      const lista = Array.isArray(json.data) ? json.data : []
      setLinks(lista.map((item: { id: string | number; nome?: string; caminho?: string | null }) => ({ id: item.id, nome: String(item.nome ?? 'Categoria'), caminho: item.caminho ?? null })))
      setErro(null)
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível carregar os links.')
    }
  }, [ligaId])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function gerar(id: string | number) {
    setGerando(String(id))
    try {
      const resposta = await fetch(`/api/organizador/ligas/${ligaId}/links-categoria`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoriaCampeonatoId: String(id) }),
      })
      const json = await resposta.json().catch(() => ({}))
      if (!resposta.ok) throw new Error(json.error ?? 'Não foi possível gerar o link.')
      await carregar()
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível gerar o link.')
    } finally {
      setGerando(null)
    }
  }

  async function copiar(id: string | number, url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(String(id))
      window.setTimeout(() => setCopiado((atual) => (atual === String(id) ? null : atual)), 2000)
    } catch {
      setErro('Não foi possível copiar. Selecione o link e copie manualmente.')
    }
  }

  const aviso = links ? avisoLinks(links) : null

  return (
    <section className="grid gap-3 rounded-xl border border-white/10 bg-white/5 p-4" aria-label="Links de inscrição das categorias">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-luva-amber">Links de inscrição</p>
      {erro && <FormAlert variant="error">{erro}</FormAlert>}
      {links === null && !erro && <p className="text-sm font-semibold text-slate-300" role="status">Carregando links...</p>}
      {aviso && <FormAlert variant="info">{aviso}</FormAlert>}
      {links?.map((item) => {
        const url = item.caminho && typeof window !== 'undefined' ? urlCompleta(window.location.origin, item.caminho) : null
        return (
          <div key={item.id} className="grid gap-2 border-t border-white/5 pt-3 first:border-t-0 first:pt-0">
            <p className="text-sm font-bold text-white">{item.nome}</p>
            {url ? (
              <>
                <p className="break-all rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-100">{url}</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => void copiar(item.id, url)} className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-luva-amber px-4 text-sm font-black text-slate-950">
                    <Copy size={16} aria-hidden="true" />
                    {copiado === String(item.id) ? 'Link copiado' : 'Copiar link'}
                  </button>
                  <a href={linkWhatsapp(item.nome, url)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/20 px-4 text-sm font-black text-white">
                    <MessageCircle size={16} aria-hidden="true" />
                    Enviar por WhatsApp
                  </a>
                </div>
              </>
            ) : (
              <button type="button" disabled={gerando === String(item.id)} onClick={() => void gerar(item.id)} className="inline-flex min-h-[44px] w-fit items-center rounded-full border border-luva-amber px-4 text-sm font-black text-luva-amber disabled:opacity-60">
                {gerando === String(item.id) ? 'Gerando...' : 'Gerar link'}
              </button>
            )}
          </div>
        )
      })}
    </section>
  )
}
