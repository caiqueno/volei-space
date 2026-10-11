'use client'

import { useEffect, useState } from 'react'
import { Trophy } from 'lucide-react'
import { QuadroPublico } from '@/components/portal/QuadroPublico'
import { iniciais } from '@/lib/iniciais'
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
  const { categorias, categoriaId, setCategoriaId, pronto } = useCategoriaDoCampeonato(ligaId, categoriaInicial)

  if (!pronto) return <p className="text-sm font-semibold text-vs-muted">Carregando...</p>

  return (
    <div className="grid gap-4">
      <SeletorCategoria categorias={categorias} valor={categoriaId} onChange={setCategoriaId} />
      <CartaoMvp ligaId={ligaId} concluido={concluido} categoriaId={categoriaId} />
      <QuadroPublico ligaId={ligaId} categoriaId={categoriaId} destaque="ranking" />
    </div>
  )
}

function CartaoMvp({ ligaId, concluido, categoriaId }: { ligaId: number; concluido: boolean; categoriaId: string | null }) {
  const [dados, setDados] = useState<Ranking | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    const controle = new AbortController()
    setDados(null)
    fetch(`/api/portal/rankings?ligaId=${ligaId}${queryCategoria(categoriaId)}`, { signal: controle.signal, cache: 'no-store' })
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
  }, [ligaId, concluido, categoriaId])

  if (erro) return <p className="text-sm font-bold text-vs-loss">{erro}</p>
  if (!dados) return <p className="text-sm font-semibold text-vs-muted">Carregando...</p>

  if (!dados.concluido || !dados.mvp) {
    return (
      <article className="rounded-2xl border border-vs-border bg-vs-surface p-5">
        <p className="luva-kicker">MVP do campeonato</p>
        <p className="mt-3 font-display text-2xl font-bold text-vs-text">{dados.concluido ? 'Ainda não definido' : 'Ainda não disponível'}</p>
        <p className="mt-2 max-w-md text-sm font-semibold leading-6 text-vs-muted">
          {dados.concluido
            ? 'Nenhum ponto de saque, ataque ou bloqueio foi registrado neste campeonato.'
            : 'O nome aparece quando o campeonato termina, pelo atleta com mais pontos nesses fundamentos.'}
        </p>
      </article>
    )
  }

  const sigla = iniciais(dados.mvp, { manterEspacosRepetidos: true })

  return (
    <article className="overflow-hidden rounded-2xl border border-vs-border bg-vs-surface">
      <div className="h-1 bg-vs-gold" />
      <div className="p-5">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-vs-gold text-lg font-bold text-vs-on-gold">{sigla}</span>
          <div className="min-w-0">
            <p className="luva-kicker flex items-center gap-2"><Trophy size={14} aria-hidden="true" /> MVP do campeonato</p>
            <h2 className="mt-1 truncate font-display text-3xl font-bold text-vs-text">{dados.mvp}</h2>
            <p className="mt-1 text-sm font-semibold text-vs-muted">{dados.pontos} pontos no total</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3">
          <Fundamento nome="Saque" pontos={dados.saque} />
          <Fundamento nome="Ataque" pontos={dados.ataque} />
          <Fundamento nome="Bloqueio" pontos={dados.bloqueio} />
        </div>
      </div>
    </article>
  )
}

function Fundamento({ nome, pontos }: { nome: string; pontos: number }) {
  return (
    <div className="rounded-xl bg-vs-elevated px-2 py-3 text-center">
      <p className="font-display text-2xl font-bold tabular-nums text-vs-text">{pontos}</p>
      <p className="luva-kicker mt-1">{nome}</p>
    </div>
  )
}
