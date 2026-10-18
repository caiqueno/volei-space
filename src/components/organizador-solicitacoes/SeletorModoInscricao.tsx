'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { OPCOES_MODO, normalizarModo, tratarResposta, type ModoInscricao } from '@/lib/organizador-solicitacoes-ui'

/** "Como as equipes entram neste campeonato?" Salva por categoria (a categoria vem da URL da parametrização). */
export function SeletorModoInscricao() {
  const categoriaId = useSearchParams().get('categoriaCampeonatoId')
  const [modo, setModo] = useState<ModoInscricao | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState<{ ok: boolean; texto: string } | null>(null)
  const [indisponivel, setIndisponivel] = useState(false)

  useEffect(() => {
    if (!categoriaId) return
    let vivo = true
    setCarregando(true)
    setMensagem(null)
    fetch(`/api/organizador/categorias/${encodeURIComponent(categoriaId)}/inscricao`, { cache: 'no-store' })
      .then(async (r) => {
        const corpo = await r.json().catch(() => null)
        const t = tratarResposta(r.status, corpo)
        if (!vivo) return
        if (!t.ok) {
          if (t.tipo === 'desligado' || t.tipo === 'nao-habilitado') setIndisponivel(true)
          else setMensagem({ ok: false, texto: t.mensagem })
          return
        }
        setModo(normalizarModo((corpo as { data?: { modoInscricao?: unknown } } | null)?.data?.modoInscricao))
      })
      .catch(() => { if (vivo) setMensagem({ ok: false, texto: 'Não foi possível carregar o modo de inscrição.' }) })
      .finally(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
  }, [categoriaId])

  if (indisponivel) return null

  async function escolher(proximo: ModoInscricao) {
    if (!categoriaId || salvando || proximo === modo) return
    const anterior = modo
    setModo(proximo)
    setSalvando(true)
    setMensagem(null)
    try {
      const r = await fetch(`/api/organizador/categorias/${encodeURIComponent(categoriaId)}/inscricao`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modoInscricao: proximo }),
      })
      const corpo = await r.json().catch(() => null)
      const t = tratarResposta(r.status, corpo)
      if (!t.ok) {
        setModo(anterior)
        setMensagem({ ok: false, texto: t.mensagem })
      } else {
        setMensagem({ ok: true, texto: 'Modo de inscrição salvo.' })
      }
    } catch {
      setModo(anterior)
      setMensagem({ ok: false, texto: 'Sem conexão. Tente de novo.' })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <fieldset className="grid gap-2" disabled={!categoriaId || carregando}>
      <legend className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-luva-amber">Como as equipes entram neste campeonato?</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {OPCOES_MODO.map((o) => (
          <label
            key={o.value}
            className={`creator-category-option grid cursor-pointer gap-1 text-left focus-within:ring-2 focus-within:ring-luva-amber ${modo === o.value ? 'is-selected' : ''}`}
          >
            <input type="radio" name="modo-inscricao" value={o.value} checked={modo === o.value} onChange={() => void escolher(o.value)} className="sr-only" />
            <span className="text-sm font-black">{o.titulo}</span>
            <span className="text-xs font-semibold opacity-80">{o.descricao}</span>
          </label>
        ))}
      </div>
      {!categoriaId && <p className="text-xs font-semibold text-slate-400">Escolha uma categoria para definir como as equipes entram.</p>}
      {(carregando || salvando) && (
        <p className="flex items-center gap-2 text-xs font-semibold text-slate-300"><Loader2 className="animate-spin" size={14} /> {salvando ? 'Salvando...' : 'Carregando...'}</p>
      )}
      <div aria-live="polite">
        {mensagem && <p className={`text-xs font-bold ${mensagem.ok ? 'text-emerald-300' : 'text-red-300'}`}>{mensagem.texto}</p>}
      </div>
    </fieldset>
  )
}
