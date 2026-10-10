'use client'

import { useEffect, useState } from 'react'
import { Trophy } from 'lucide-react'
import { SeletorCategoria, queryCategoria, useCategoriaDoCampeonato } from '@/components/portal/SeletorCategoria'

type Ranking = {
  mvp: string | null
  pontos: number
  saque: number
  ataque: number
  bloqueio: number
  concluido: boolean
}

export function PainelRanking({ ligaId, concluido, categoriaInicial = null }: { ligaId: number; concluido: boolean; categoriaInicial?: string | null }) {
  const [dados, setDados] = useState<Ranking | null>(null)
  const [erro, setErro] = useState('')
  const { categorias, categoriaId, setCategoriaId, pronto } = useCategoriaDoCampeonato(ligaId, categoriaInicial)

  useEffect(() => {
    if (!pronto) return
    const controle = new AbortController()
    setDados(null)
    fetch(`/api/portal/rankings?ligaId=${ligaId}${queryCategoria(categoriaId)}`, { signal: controle.signal })
      .then(async (resposta) => {
        const json = await resposta.json()
        if (!resposta.ok) throw new Error(json.error || 'Falha')
        setDados({
          mvp: json.data?.mvp ?? null,
          pontos: Number(json.data?.pontos ?? 0),
          saque: Number(json.data?.saque ?? 0),
          ataque: Number(json.data?.ataque ?? 0),
          bloqueio: Number(json.data?.bloqueio ?? 0),
          concluido: json.data?.concluido === true && concluido,
        })
      })
      .catch((causa) => {
        if (causa instanceof DOMException && causa.name === 'AbortError') return
        setErro('Erro ao carregar dados')
      })
    return () => controle.abort()
  }, [ligaId, concluido, categoriaId, pronto])

  if (erro) return <p className="text-sm font-bold text-red-200">{erro}</p>
  if (!pronto || !dados) return <p className="text-sm font-semibold text-slate-300">Carregando...</p>

  if (!dados.concluido || !dados.mvp) {
    return (
      <div className="grid gap-3">
        <SeletorCategoria categorias={categorias} valor={categoriaId} onChange={setCategoriaId} />
      <article className="rounded-3xl border border-white/10 p-5">
        <p className="luva-kicker">MVP do campeonato</p>
        <p className="mt-3 font-display text-2xl font-black">{dados.concluido ? 'Ainda não definido' : 'Ainda não disponível'}</p>
        <p className="mt-2 max-w-md text-sm font-semibold leading-6 text-slate-300">
          {dados.concluido
            ? 'Nenhum ponto de saque, ataque ou bloqueio foi registrado neste campeonato.'
            : 'O nome aparece quando o campeonato termina, pelo atleta com mais pontos nesses fundamentos.'}
        </p>
      </article>
      </div>
    )
  }

  const iniciais = dados.mvp.split(' ').slice(0, 2).map((parte) => parte[0]).join('').toUpperCase()

  return (
    <div className="grid gap-3">
      <SeletorCategoria categorias={categorias} valor={categoriaId} onChange={setCategoriaId} />
    <article className="overflow-hidden rounded-3xl border border-white/10">
      <div className="bg-luva-amber h-1" />
      <div className="p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <span className="bg-luva-amber flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-lg font-black">{iniciais}</span>
          <div className="min-w-0">
            <p className="luva-kicker flex items-center gap-2"><Trophy size={14} /> MVP do campeonato</p>
            <h2 className="mt-1 truncate font-display text-3xl font-black">{dados.mvp}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-300">{dados.pontos} pontos no total</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3">
          <Fundamento nome="Saque" pontos={dados.saque} />
          <Fundamento nome="Ataque" pontos={dados.ataque} />
          <Fundamento nome="Bloqueio" pontos={dados.bloqueio} />
        </div>
      </div>
    </article>
    </div>
  )
}

function Fundamento({ nome, pontos }: { nome: string; pontos: number }) {
  return (
    <div className="rounded-2xl bg-white/5 px-2 py-3 text-center">
      <p className="font-display text-2xl font-black">{pontos}</p>
      <p className="luva-kicker mt-1">{nome}</p>
    </div>
  )
}
