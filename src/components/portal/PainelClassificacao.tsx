'use client'

import { useCallback, useEffect, useState } from 'react'
import { useBancoAoVivo } from '@/lib/use-banco-ao-vivo'
import { SeletorCategoria, queryCategoria, useCategoriaDoCampeonato } from '@/components/portal/SeletorCategoria'
import mi from '@/styles/microinteracoes.module.css'

type Linha = {
  posicao: number
  equipe: string
  pontos: number
  jogos: number
  vitorias: number
  derrotas: number
  setsPro: number
}

export function PainelClassificacao({ ligaId, categoriaInicial = null }: { ligaId: number; categoriaInicial?: string | null }) {
  const [linhas, setLinhas] = useState<Linha[] | null>(null)
  const [erro, setErro] = useState('')
  const { categorias, categoriaId, setCategoriaId, pronto } = useCategoriaDoCampeonato(ligaId, categoriaInicial)

  const carregar = useCallback(async (sinal?: AbortSignal) => {
    const resposta = await fetch(`/api/portal/classificacao?ligaId=${ligaId}${queryCategoria(categoriaId)}&t=${Date.now()}`, { cache: 'no-store', signal: sinal })
    const json = await resposta.json()
    if (!resposta.ok) throw new Error(json.error || 'Falha')
    setLinhas(json.data?.linhas ?? [])
    setErro('')
  }, [ligaId, categoriaId])

  useEffect(() => {
    if (!pronto) return
    const controle = new AbortController()
    carregar(controle.signal).catch((causa) => {
      if (causa instanceof DOMException && causa.name === 'AbortError') return
      setErro('Erro ao carregar dados')
    })
    return () => controle.abort()
  }, [carregar, pronto])

  useBancoAoVivo(
    `classificacao-${ligaId}-${categoriaId ?? 'todas'}`,
    [{ tabela: 'ClassificacaoEntrada', filtro: `ligaId=eq.${ligaId}` }],
    () => { if (pronto) void carregar().catch(() => setErro('Erro ao carregar dados')) },
  )

  if (erro) return <p className="text-sm font-bold text-red-200">{erro}</p>
  if (!pronto || !linhas) return <p className="text-sm font-semibold text-slate-300">Carregando...</p>
  if (linhas.length === 0) {
    return (
      <div className="grid gap-3">
        <SeletorCategoria categorias={categorias} valor={categoriaId} onChange={setCategoriaId} />
        <p className="text-sm font-semibold text-slate-300">{categoriaId ? 'Nenhuma equipe inscrita nesta categoria' : 'Nenhuma equipe inscrita neste campeonato'}</p>
      </div>
    )
  }
  const semJogos = linhas.every((linha) => (linha.jogos ?? 0) === 0)

  return (
    <div className="grid gap-3">
      <SeletorCategoria categorias={categorias} valor={categoriaId} onChange={setCategoriaId} />
      <div>
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ffb331]">Classificação</p>
      {semJogos && (
        <p className="mt-2 text-sm font-semibold text-slate-300">Ainda não há jogos. A tabela começa zerada com as equipes.</p>
      )}
      <ol className="mt-3 grid gap-2">
        {linhas.map((linha, index) => (
          <li key={`${linha.posicao}-${linha.equipe}`} className={`rounded-2xl bg-white/5 px-4 py-3 text-sm font-black text-white ${mi.linha} ${mi.entrar} ${linha.posicao === 1 ? mi.lider : ''}`} style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}>
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
              <span className={mi.numero}>{linha.posicao}º</span>
              <span className="min-w-0 truncate">{linha.equipe}</span>
              <span className={`text-[#ffb331] ${mi.numero}`}>{linha.pontos} pts</span>
            </div>
            <p className="mt-1 text-xs font-bold text-white/70">
              J {linha.jogos ?? 0} · V {linha.vitorias ?? 0} · D {linha.derrotas ?? 0} · Sets {linha.setsPro ?? 0}
            </p>
          </li>
        ))}
      </ol>
      </div>
    </div>
  )
}
