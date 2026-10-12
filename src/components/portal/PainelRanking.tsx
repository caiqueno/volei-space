'use client'

import { useEffect, useState } from 'react'
import { Trophy } from 'lucide-react'
import { NomeEquipe } from '@/components/equipes/NomeEquipe'
import { QuadroPublico } from '@/components/portal/QuadroPublico'
import { BotaoStoriesInstagram } from '@/components/stories/BotaoStoriesInstagram'
import { iniciais } from '@/lib/iniciais'
import { cartazMvpCampeonato } from '@/lib/stories-cartaz'
import { SeletorCategoria, queryCategoria, useCategoriaDoCampeonato } from '@/components/portal/SeletorCategoria'

type Ranking = {
  mvp: string | null
  equipe: string | null
  foto: string | null
  pontos: number
  saque: number
  ataque: number
  bloqueio: number
  concluido: boolean
}

export function PainelRanking({ ligaId, concluido, categoriaInicial = null, campeonato, logoCampeonato }: { ligaId: number; concluido: boolean; categoriaInicial?: string | null; campeonato?: string; logoCampeonato?: string | null }) {
  const { categorias, categoriaId, setCategoriaId, pronto } = useCategoriaDoCampeonato(ligaId, categoriaInicial)

  if (!pronto) return <p className="text-sm font-semibold text-vs-muted">Carregando...</p>

  return (
    <div className="grid gap-4">
      <SeletorCategoria categorias={categorias} valor={categoriaId} onChange={setCategoriaId} />
      <CartaoMvp ligaId={ligaId} concluido={concluido} categoriaId={categoriaId} campeonato={campeonato} logoCampeonato={logoCampeonato} />
      <QuadroPublico ligaId={ligaId} categoriaId={categoriaId} destaque="ranking" campeonato={campeonato} logoCampeonato={logoCampeonato} />
    </div>
  )
}

function CartaoMvp({ ligaId, concluido, categoriaId, campeonato, logoCampeonato }: { ligaId: number; concluido: boolean; categoriaId: string | null; campeonato?: string; logoCampeonato?: string | null }) {
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
          equipe: json.data?.equipe ?? null,
          foto: json.data?.foto ?? null,
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
            : 'O nome aparece quando o campeonato termina. Com a final já escolhida, vale o MVP dessa partida. Sem essa escolha, vale quem mais pontuou em saque, ataque e bloqueio.'}
        </p>
      </article>
    )
  }

  const sigla = iniciais(dados.mvp, { manterEspacosRepetidos: true })

  return (
    <article className="overflow-hidden rounded-2xl border border-vs-border bg-vs-surface">
      <div className="h-1 bg-vs-gold" />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-[3px] border-[#ffb331] bg-[#1a1205] text-lg font-bold text-[#ffb331] shadow-[0_0_0_4px_rgba(255,179,49,0.45)]">
              {dados.foto ? <img src={dados.foto} alt="" className="h-full w-full object-cover" /> : sigla}
            </span>
            <div className="min-w-0">
              <p className="luva-kicker flex items-center gap-2"><Trophy size={14} aria-hidden="true" /> MVP do campeonato</p>
              <h2 className="mt-1 font-display text-3xl font-bold text-vs-text [overflow-wrap:anywhere]">{dados.mvp}</h2>
              {dados.equipe ? <p className="mt-1 text-sm font-extrabold text-[#ffb331] [overflow-wrap:anywhere]"><NomeEquipe nome={dados.equipe} /></p> : null}
              <p className="mt-1 text-sm font-semibold text-vs-muted">{dados.pontos} pontos no total</p>
            </div>
          </div>
          <BotaoStoriesInstagram
            titulo="MVP do campeonato"
            versao={`${dados.mvp}-${dados.equipe ?? ''}-${dados.pontos}`}
            montar={({ link }) => cartazMvpCampeonato({
              nome: dados.mvp ?? 'Atleta',
              equipe: dados.equipe,
              foto: dados.foto,
              pontos: dados.pontos,
              saque: dados.saque,
              ataque: dados.ataque,
              bloqueio: dados.bloqueio,
            }, link, campeonato, logoCampeonato)}
          />
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
