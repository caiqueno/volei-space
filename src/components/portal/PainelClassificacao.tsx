'use client'

import { useCallback, useEffect, useState } from 'react'
import { useBancoAoVivo } from '@/lib/use-banco-ao-vivo'
import { PainelChavePublica } from '@/components/portal/PainelChavePublica'
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

type GrupoTabela = {
  id: string
  nome: string
  linhas: Linha[]
}

type BlocoCategoria = {
  id: string | null
  nome: string
  linhas: Linha[]
  grupos?: GrupoTabela[]
}

export function PainelClassificacao({ ligaId, categoriaInicial = null }: { ligaId: number; categoriaInicial?: string | null }) {
  const [blocos, setBlocos] = useState<BlocoCategoria[] | null>(null)
  const [erro, setErro] = useState('')
  const { categorias, categoriaId, setCategoriaId, pronto } = useCategoriaDoCampeonato(ligaId, categoriaInicial)

  const carregar = useCallback(async (sinal?: AbortSignal) => {
    const resposta = await fetch(`/api/portal/classificacao?ligaId=${ligaId}${queryCategoria(categoriaId)}&t=${Date.now()}`, { cache: 'no-store', signal: sinal })
    const json = await resposta.json()
    if (!resposta.ok) throw new Error(json.error || 'Falha')
    const recebidos = Array.isArray(json.data?.categorias) ? json.data.categorias as BlocoCategoria[] : []
    setBlocos(recebidos)
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

  if (!pronto) return <p className="text-sm font-semibold text-slate-300">Carregando...</p>
  const chave = <PainelChavePublica ligaId={ligaId} categoriaId={categoriaId} />
  if (erro) {
    return (
      <div className="grid gap-3">
        {chave}
        <p className="text-sm font-bold text-red-200">{erro}</p>
      </div>
    )
  }
  if (!blocos) return <p className="text-sm font-semibold text-slate-300">Carregando...</p>
  const vazios = blocos.length === 0 || blocos.every((bloco) => bloco.linhas.length === 0)
  if (vazios) {
    return (
      <div className="grid gap-3">
        {chave}
        <SeletorCategoria categorias={categorias} valor={categoriaId} onChange={setCategoriaId} />
        <p className="text-sm font-semibold text-slate-300">{categoriaId ? 'Nenhuma equipe inscrita nesta categoria' : 'Nenhuma equipe inscrita neste campeonato'}</p>
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      {chave}
      <SeletorCategoria categorias={categorias} valor={categoriaId} onChange={setCategoriaId} />
      {blocos.filter((bloco) => bloco.linhas.length > 0).map((bloco) => {
        const grupos = (bloco.grupos ?? []).filter((grupo) => grupo.linhas.length > 0)
        const secoes = grupos.length > 0 ? grupos : [{ id: bloco.id ?? 'legado', nome: bloco.nome, linhas: bloco.linhas }]
        const semJogos = bloco.linhas.every((linha) => (linha.jogos ?? 0) === 0)
        return (
          <div key={bloco.id ?? 'legado'}>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ffb331]">{blocos.length > 1 ? bloco.nome : 'Classificação'}</p>
            {semJogos && (
              <p className="mt-2 text-sm font-semibold text-slate-300">Ainda não há jogos. A tabela começa zerada com as equipes.</p>
            )}
            {secoes.map((grupo) => (
              <section key={grupo.id} className="mt-4">
                {grupos.length > 0 ? <h3 className="font-display text-xl font-black text-white">{grupo.nome}</h3> : null}
                <ol className="mt-3 grid gap-2">
                  {grupo.linhas.map((linha, index) => (
                    <li key={`${grupo.id}-${linha.equipe}`} className={`rounded-2xl bg-white/5 px-4 py-3 text-sm font-black text-white ${mi.linha} ${mi.entrar} ${index === 0 ? mi.lider : ''}`} style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}>
                      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
                        <span className={mi.numero}>{grupos.length > 0 ? index + 1 : linha.posicao}º</span>
                        <span className="min-w-0 truncate">{linha.equipe}</span>
                        <span className={`text-[#ffb331] ${mi.numero}`}>{linha.pontos} pts</span>
                      </div>
                      <p className="mt-1 text-xs font-bold text-white/70">
                        J {linha.jogos ?? 0} · V {linha.vitorias ?? 0} · D {linha.derrotas ?? 0} · Sets {linha.setsPro ?? 0}
                      </p>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        )
      })}
    </div>
  )
}
