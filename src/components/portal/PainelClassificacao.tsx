'use client'

import { useEffect, useState } from 'react'

type Linha = {
  posicao: number
  equipe: string
  pontos: number
  vitorias: number
  derrotas: number
  saldoSets: number
}

export function PainelClassificacao({ ligaId }: { ligaId: number }) {
  const [linhas, setLinhas] = useState<Linha[] | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    const controle = new AbortController()
    fetch(`/api/portal/classificacao?ligaId=${ligaId}`, { signal: controle.signal })
      .then(async (resposta) => {
        const json = await resposta.json()
        if (!resposta.ok) throw new Error(json.error || 'Falha')
        setLinhas(json.data?.linhas ?? [])
      })
      .catch((causa) => {
        if (causa instanceof DOMException && causa.name === 'AbortError') return
        setErro('Erro ao carregar dados')
      })
    return () => controle.abort()
  }, [ligaId])

  if (erro) return <p className="text-sm font-bold text-red-200">{erro}</p>
  if (!linhas) return <p className="text-sm font-semibold text-slate-300">Carregando...</p>
  if (linhas.length === 0) return <p className="text-sm font-semibold text-slate-300">Nenhuma classificação disponível</p>

  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ffb331]">Classificação</p>
      <ol className="mt-3 grid gap-2">
        {linhas.map((linha) => (
          <li key={`${linha.posicao}-${linha.equipe}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl bg-white/5 px-4 py-3 text-sm font-black text-white">
            <span>{linha.posicao}º</span>
            <span className="min-w-0 truncate">{linha.equipe}</span>
            <span className="text-[#ffb331]">{linha.pontos} pts</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
