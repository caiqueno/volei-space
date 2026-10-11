'use client'

import { useCallback, useEffect, useState } from 'react'
import { CartaoLider } from '@/components/classificacao/CartaoLider'
import { TabelaGrupos } from '@/components/classificacao/TabelaGrupos'
import { TabelaScouts } from '@/components/classificacao/TabelaScouts'
import { TopCinco } from '@/components/classificacao/TopCinco'
import { queryCategoria } from '@/components/portal/SeletorCategoria'
import { VistaChavePublica } from '@/components/portal/VistaChavePublica'
import { BotaoStoriesInstagram, FaixaStories } from '@/components/stories/BotaoStoriesInstagram'
import { cartazClassificacao, cartazQuadro, cartazRanking, type GrupoCartaz } from '@/lib/stories-cartaz'
import { INTERVALO_RANKING_JOGADORES_MS, type LinhaJogadorRanking } from '@/lib/classificacao-jogadores'
import { liderDaTabela, type AtletaQuadro, type LinhaGrupo } from '@/lib/quadro-publico'
import type { ChavePublica } from '@/lib/portal-chave'
import { useBancoAoVivo } from '@/lib/use-banco-ao-vivo'

type Bloco = {
  id: string | null
  nome: string
  linhas: LinhaGrupo[]
  grupos?: { id: string; nome: string; vagas?: number; linhas: LinhaGrupo[] }[]
}

const CHAVE_VAZIA: ChavePublica = { temMataMata: false, rounds: [], champion: null, thirdPlace: null, podium: [] }

export function QuadroPublico({ ligaId, categoriaId, destaque = 'quadro' }: { ligaId: number; categoriaId: string | null; destaque?: 'ranking' | 'classificacao' | 'quadro' }) {
  const [blocos, setBlocos] = useState<Bloco[] | null>(null)
  const [chave, setChave] = useState<ChavePublica | null>(null)
  const [atletas, setAtletas] = useState<AtletaQuadro[] | null>(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')

  const carregarTabela = useCallback(async (sinal?: AbortSignal) => {
    const resposta = await fetch(`/api/portal/classificacao?ligaId=${ligaId}${queryCategoria(categoriaId)}&t=${Date.now()}`, { cache: 'no-store', signal: sinal })
    const json = await resposta.json()
    if (!resposta.ok) throw new Error(json.error || 'Falha')
    setBlocos(Array.isArray(json.data?.categorias) ? json.data.categorias as Bloco[] : [])
    setErro('')
  }, [ligaId, categoriaId])

  const carregarChave = useCallback(async (sinal?: AbortSignal) => {
    const resposta = await fetch(`/api/portal/mata-mata?ligaId=${ligaId}${queryCategoria(categoriaId)}`, { cache: 'no-store', signal: sinal })
    const json = await resposta.json()
    if (!resposta.ok) throw new Error(json.error || 'Falha')
    setChave(json.data ?? CHAVE_VAZIA)
  }, [ligaId, categoriaId])

  const carregarAtletas = useCallback(async (sinal?: AbortSignal) => {
    const resposta = await fetch(`/api/portal/rankings/jogadores?ligaId=${ligaId}${queryCategoria(categoriaId)}`, { cache: 'no-store', signal: sinal })
    const json = await resposta.json()
    if (!resposta.ok) throw new Error(json.error || 'Falha')
    const recebidos = Array.isArray(json.data?.jogadores) ? json.data.jogadores as LinhaJogadorRanking[] : []
    setAtletas(recebidos.map((linha) => ({
      jogadorId: linha.jogadorId,
      nome: linha.nome,
      equipe: linha.equipe,
      numero: linha.numero,
      ataque: linha.fundamentos.ataque ?? 0,
      bloqueio: linha.fundamentos.bloqueio ?? 0,
      saque: linha.fundamentos.saque ?? 0,
    })))
    setAviso('')
  }, [ligaId, categoriaId])

  useEffect(() => {
    const controle = new AbortController()
    setBlocos(null)
    setChave(null)
    setAtletas(null)
    carregarTabela(controle.signal).catch((causa) => {
      if (causa instanceof DOMException && causa.name === 'AbortError') return
      setErro('Erro ao carregar a classificação')
    })
    carregarChave(controle.signal).catch((causa) => {
      if (causa instanceof DOMException && causa.name === 'AbortError') return
      setChave(CHAVE_VAZIA)
    })
    carregarAtletas(controle.signal).catch((causa) => {
      if (causa instanceof DOMException && causa.name === 'AbortError') return
      setAtletas([])
      setAviso('Não foi possível ler os scouts agora.')
    })
    return () => controle.abort()
  }, [carregarTabela, carregarChave, carregarAtletas])

  useEffect(() => {
    let timer = 0
    let controle = new AbortController()
    const ler = () => {
      if (document.visibilityState !== 'visible') return
      controle.abort()
      controle = new AbortController()
      carregarAtletas(controle.signal).catch((causa) => {
        if (causa instanceof DOMException && causa.name === 'AbortError') return
        setAviso('Não foi possível atualizar os scouts agora. A tabela segue com a última leitura.')
      })
    }
    const ligar = () => {
      window.clearInterval(timer)
      if (document.visibilityState !== 'visible') return
      timer = window.setInterval(ler, INTERVALO_RANKING_JOGADORES_MS)
    }
    const aoVisibilidade = () => {
      if (document.visibilityState === 'visible') {
        ler()
        ligar()
      } else {
        window.clearInterval(timer)
      }
    }
    ligar()
    document.addEventListener('visibilitychange', aoVisibilidade)
    return () => {
      window.clearInterval(timer)
      controle.abort()
      document.removeEventListener('visibilitychange', aoVisibilidade)
    }
  }, [carregarAtletas])

  useBancoAoVivo(
    `quadro-${ligaId}-${categoriaId ?? 'todas'}`,
    [{ tabela: 'ClassificacaoEntrada', filtro: `ligaId=eq.${ligaId}` }, { tabela: 'Partida', filtro: `ligaId=eq.${ligaId}` }],
    () => {
      void carregarTabela().catch(() => setErro('Erro ao carregar a classificação'))
      void carregarChave().catch(() => setChave(CHAVE_VAZIA))
    },
  )

  if (erro && !blocos) return <p className="text-sm font-bold text-vs-loss">{erro}</p>
  if (!blocos || !atletas || !chave) return <p className="text-sm font-semibold text-vs-muted">Carregando...</p>

  const linhas = blocos.flatMap((bloco) => bloco.linhas)
  const lider = liderDaTabela(linhas)
  const grupos = gruposDoQuadro(blocos)
  const liderCartaz = lider ? { equipe: lider.equipe, pontos: lider.pontos } : null
  const versao = `${atletas.length}-${linhas.length}-${chave.rounds.length}`

  return (
    <div className="grid gap-6">
      {destaque === 'ranking' && (
        <FaixaStories kicker="Ranking" titulo="Top 5">
          <BotaoStoriesInstagram titulo="Ranking" versao={versao} montar={({ link }) => cartazRanking(atletas, link)} />
        </FaixaStories>
      )}
      <FaixaStories kicker={destaque === 'classificacao' ? 'Classificação' : 'Quadro'} titulo={destaque === 'classificacao' ? 'Tabela' : 'Quadro do campeonato'}>
        <BotaoStoriesInstagram
          titulo={destaque === 'classificacao' ? 'Classificação' : 'Quadro do campeonato'}
          versao={versao}
          montar={({ link }) => destaque === 'classificacao' ? cartazClassificacao(grupos, link, liderCartaz) : cartazQuadro({ lider: liderCartaz, atletas, grupos }, link)}
        />
      </FaixaStories>
      {lider && <CartaoLider lider={lider} />}
      <VistaChavePublica ligaId={ligaId} chave={chave} />
      {destaque !== 'ranking' && (
        <FaixaStories kicker="Ranking" titulo="Top 5">
          <BotaoStoriesInstagram titulo="Ranking" versao={versao} montar={({ link }) => cartazRanking(atletas, link)} />
        </FaixaStories>
      )}
      <TopCinco atletas={atletas} />
      {aviso && <p className="text-sm font-bold text-vs-gold">{aviso}</p>}
      <TabelaScouts atletas={atletas} />
      {destaque !== 'classificacao' && (
        <FaixaStories kicker="Classificação" titulo="Tabela">
          <BotaoStoriesInstagram titulo="Classificação" versao={versao} montar={({ link }) => cartazClassificacao(grupos, link, liderCartaz)} />
        </FaixaStories>
      )}
      {blocos.map((bloco) => {
        const grupos = (bloco.grupos ?? []).filter((grupo) => grupo.linhas.length > 0)
        const secoes = grupos.length > 0 ? grupos : [{ id: bloco.id ?? 'geral', nome: bloco.nome || 'Classificação', vagas: 0, linhas: bloco.linhas }]
        return secoes.map((grupo) => (
          <TabelaGrupos key={`${bloco.id}-${grupo.id}`} nome={grupo.nome} linhas={grupo.linhas} vagas={grupo.vagas ?? 0} />
        ))
      })}
    </div>
  )
}

function gruposDoQuadro(blocos: Bloco[]): GrupoCartaz[] {
  return blocos.flatMap((bloco) => {
    const grupos = (bloco.grupos ?? []).filter((grupo) => grupo.linhas.length > 0)
    const secoes = grupos.length > 0 ? grupos : [{ nome: bloco.nome || 'Classificação', linhas: bloco.linhas }]
    return secoes.filter((grupo) => grupo.linhas.length > 0).map((grupo) => ({ nome: grupo.nome, linhas: grupo.linhas }))
  })
}
