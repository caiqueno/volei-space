'use client'

import { useEffect, useState } from 'react'
import { Check, Copy, ExternalLink } from 'lucide-react'

export function teamRegistrationPath(ligaId: number) {
  return `/inscricao-rapida?ligaId=${ligaId}`
}

export function LinkDoTime({ ligaId, nome }: { ligaId: number; nome?: string | null }) {
  const [copied, setCopied] = useState(false)
  const path = teamRegistrationPath(ligaId)
  const [href, setHref] = useState(path)

  useEffect(() => {
    setHref(`${window.location.origin}${path}`)
  }, [path])

  async function copyLink() {
    const url = `${window.location.origin}${path}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">Link para o time</p>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">
        Envie este link para a equipe preencher os dados e os jogadores. O formulário usa as regras de inscrição{nome ? ` de ${nome}` : ' deste campeonato'}.
      </p>
      <p className="mt-3 break-all rounded-2xl border border-white/10 bg-[#07111f] px-4 py-3 text-sm font-bold text-white">{href}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={path} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-2 text-xs font-black text-white">
          <ExternalLink size={13} /> Abrir cadastro
        </a>
        <button type="button" onClick={() => void copyLink()} className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-2 text-xs font-black text-white">
          {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />} {copied ? 'Copiado' : 'Copiar link'}
        </button>
      </div>
    </div>
  )
}
