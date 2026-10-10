'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ConsultaElenco } from '@/components/elenco/ConsultaElenco'
import type { LinhaElenco } from '@/lib/grupos-fase'

function ElencoDoOrganizador() {
  const busca = useSearchParams()
  const ligaId = busca.get('ligaId')
  const [linhas, setLinhas] = useState<LinhaElenco[]>([])
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!ligaId || !/^\d+$/.test(ligaId)) {
      setLinhas([])
      setCarregando(false)
      setErro('Escolha um campeonato para consultar o elenco.')
      return
    }
    const controle = new AbortController()
    setCarregando(true)
    fetch(`/api/organizador/elenco?ligaId=${ligaId}`, { signal: controle.signal })
      .then(async (resposta) => {
        const json = await resposta.json().catch(() => ({}))
        if (!resposta.ok) throw new Error(json.error || 'Não foi possível carregar o elenco.')
        setLinhas(json.data?.linhas ?? [])
        setErro('')
      })
      .catch((falha) => {
        if (falha instanceof DOMException && falha.name === 'AbortError') return
        setErro(falha instanceof Error ? falha.message : 'Não foi possível carregar o elenco.')
      })
      .finally(() => setCarregando(false))
    return () => controle.abort()
  }, [ligaId])

  return (
    <main className="luva-shell min-h-screen px-4 py-8 text-white">
      <div className="mx-auto grid max-w-3xl gap-4">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ffb331]">Consulta</p>
        <h1 className="font-display text-3xl font-black">Equipes e jogadores</h1>
        <p className="text-sm font-semibold text-slate-300">Somente leitura. A busca usa o nome do jogador, o número ou o nome da equipe.</p>
        {carregando ? <p className="text-sm font-semibold text-slate-300">Carregando...</p> : null}
        {erro ? <p className="text-sm font-bold text-red-200">{erro}</p> : null}
        {!carregando && !erro ? <ConsultaElenco linhas={linhas} /> : null}
      </div>
    </main>
  )
}

export default function PaginaElenco() {
  return (
    <Suspense fallback={<main className="luva-shell min-h-screen p-8 text-white">Carregando...</main>}>
      <ElencoDoOrganizador />
    </Suspense>
  )
}
