'use client'

import { useState } from 'react'
import { Check, Copy, Link2 } from 'lucide-react'

export function LinkInscricaoRapida({ ligaId }: { ligaId: number }) {
  const [copiado, setCopiado] = useState(false)
  const link = typeof window !== 'undefined'
    ? `${window.location.origin}/inscricao-rapida?ligaId=${ligaId}`
    : `/inscricao-rapida?ligaId=${ligaId}`

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(link)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      setCopiado(false)
    }
  }

  return (
    <section className="mx-auto mt-6 max-w-7xl px-4">
      <div className="flex flex-col gap-3 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ffb331]/15 text-luva-amber"><Link2 size={18} /></span>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">Cadastro rápido de equipes</p>
            <p className="mt-0.5 truncate text-sm font-bold text-slate-200">{link}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={copiarLink}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-black uppercase tracking-wide text-white transition hover:bg-white/10"
        >
          {copiado ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
          {copiado ? 'Copiado' : 'Copiar link'}
        </button>
      </div>
      <p className="mt-2 text-xs font-semibold text-slate-400">
        Envie este link para as equipes já aprovadas preencherem o cadastro direto — sem login, já entra confirmado no campeonato.
      </p>
    </section>
  )
}
