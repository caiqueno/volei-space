'use client'

import { startTransition, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CartaoLider } from '@/components/classificacao/CartaoLider'
import { TabelaGrupos } from '@/components/classificacao/TabelaGrupos'
import { TabelaScouts } from '@/components/classificacao/TabelaScouts'
import { TopCinco } from '@/components/classificacao/TopCinco'
import { queryCategoria } from '@/components/portal/SeletorCategoria'
import { VistaChavePublica } from '@/components/portal/VistaChavePublica'
import { INTERVALO_RANKING_JOGADORES_MS, type LinhaJogadorRanking } from '@/lib/classificacao-jogadores'
import { liderDaTabela, type AtletaQuadro, type LinhaGrupo } from '@/lib/quadro-publico'
import type { GrupoProvisorio } from '@/lib/semi-provisoria'
import type { ChavePublica } from '@/lib/portal-chave'
import { useBancoAoVivo } from '@/lib/use-banco-ao-vivo'

type Bloco = {
  id: string | null
  nome: string
  linhas: LinhaGrupo[]
  grupos?: { id: string; nome: string; vagas?: number; linhas: LinhaGrupo[] }[]
}

const CHAVE_VAZIA: ChavePublica = { temMataMata: false, rounds: [], champion: null, thirdPlace: null, podium: [] }

function publicarConteudo<T>(texto: { current: string }, valor: T, aplicar: (proximo: T) => void, rolagem: { current: number | null }) {
  const serie = JSON.stringify(valor)
  if (serie === texto.current) return
  texto.current = serie
  rolagem.current = window.scrollY
  startTransition(() => aplicar(valor))
}

export function QuadroPublico({ ligaId, categoriaId, destaque = 'quadro', campeonato, logoCampeonato }: { ligaId: number; categoriaId: string | null; destaque?: 'ranking' | 'classificacao' | 'quadro'; campeonato?: string; logoCampeonato?: string | null }) {
  const [blocos, setBlocos] = useState<Bloco[] | null>(null)
  const [chave, setChave] = useState<ChavePublica | null>(null)
  const [atletas, setAtletas] = useState<AtletaQuadro[] | null>(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')

  const textoTabela = useRef('')
  const textoChave = useRef('')
  const textoAtletas = useRef('')
  const rolagem = useRef<number | null>(null)
  const geracao = useRef(0)

  const carregarTabela = useCallback(async (sinal?: AbortSignal) => {
    const marca = geracao.current
    const resposta = await fetch(`/api/portal/classificacao?ligaId=${ligaId}${queryCategoria(categoriaId)}&t=${Date.now()}`, { cache: 'no-store', signal: sinal })
    const json = await resposta.json()
    if (sinal?.aborted || marca !== geracao.current) return
    if (!resposta.ok) throw new Error(json.error || 'Falha')
    const categorias = Array.isArray(json.data?.categorias) ? json.data.categorias as Bloco[] : []
    publicarConteudo(textoTabela, categorias, setBlocos, rolagem)
    setErro('')
  }, [ligaId, categoriaId])

  const carregarChave = useCallback(async (sinal?: AbortSignal) => {
    const marca = geracao.current
    const resposta = await fetch(`/api/portal/mata-mata?ligaId=${ligaId}${queryCategoria(categoriaId)}`, { cache: 'no-store', signal: sinal })
    const json = await resposta.json()
    if (sinal?.aborted || marca !== geracao.current) return
    if (!resposta.ok) throw new Error(json.error || 'Falha')
    publicarConteudo(textoChave, (json.data ?? CHAVE_VAZIA) as ChavePublica, setChave, rolagem)
  }, [ligaId, categoriaId])

  const carregarAtletas = useCallback(async (sinal?: AbortSignal) => {
    const marca = geracao.current
    const resposta = await fetch(`/api/portal/rankings/jogadores?ligaId=${ligaId}${queryCategoria(categoriaId)}`, { cache: 'no-store', signal: sinal })
    const json = await resposta.json()
    if (sinal?.aborted || marca !== geracao.current) return
    if (!resposta.ok) throw new Error(json.error || 'Falha')
    const recebidos = Array.isArray(json.data?.jogadores) ? json.data.jogadores as LinhaJogadorRanking[] : []
    const lista = recebidos.map((linha) => ({
      jogadorId: linha.jogadorId,
      nome: linha.nome,
      equipe: linha.equipe,
      numero: linha.numero,
      ataque: linha.fundamentos.ataque ?? 0,
      bloqueio: linha.fundamentos.bloqueio ?? 0,
      saque: linha.fundamentos.saque ?? 0,
      logoUrl: linha.logoUrl ?? null,
      corHex: linha.corHex ?? null,
    }))
    publicarConteudo(textoAtletas, lista, setAtletas, rolagem)
    setAviso('')
  }, [ligaId, categoriaId])

  useLayoutEffect(() => {
    const alvo = rolagem.current
    if (alvo == null || alvo < 80) return
    rolagem.current = null
    const corrigir = () => {
      if (window.scrollY + 48 >= alvo) return
      const html = document.documentElement
      const anterior = html.style.scrollBehavior
      html.style.scrollBehavior = 'auto'
      window.scrollTo(0, alvo)
      html.style.scrollBehavior = anterior
    }
    corrigir()
    const quadro = window.requestAnimationFrame(corrigir)
    return () => window.cancelAnimationFrame(quadro)
  }, [blocos, chave, atletas])

  useEffect(() => {
    const controle = new AbortController()
    geracao.current += 1
    textoTabela.current = ''
    textoChave.current = ''
    textoAtletas.current = ''
    carregarTabela(controle.signal).catch((causa) => {
      if (causa instanceof DOMException && causa.name === 'AbortError') return
      setErro('Erro ao carregar a classificação')
    })
    carregarChave(controle.signal).catch((causa) => {
      if (causa instanceof DOMException && causa.name === 'AbortError') return
      setChave((atual) => atual ?? CHAVE_VAZIA)
    })
    carregarAtletas(controle.signal).catch((causa) => {
      if (causa instanceof DOMException && causa.name === 'AbortError') return
      setAtletas((atual) => atual ?? [])
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
      void carregarChave().catch(() => setChave((atual) => atual ?? CHAVE_VAZIA))
    },
  )

  if (erro && !blocos) return <p className="text-sm font-bold text-vs-loss">{erro}</p>
  if (!blocos || !atletas || !chave) return <p className="text-sm font-semibold text-vs-muted">Carregando...</p>

  const linhas = blocos.flatMap((bloco) => bloco.linhas)
  const lider = liderDaTabela(linhas)

  return (
    <div className="grid gap-6" data-destaque={destaque}>
      {lider && <CartaoLider lider={lider} />}
      <VistaChavePublica ligaId={ligaId} chave={chave} campeonato={campeonato} logoCampeonato={logoCampeonato} grupos={gruposDaTabela(blocos)} />
      <TopCinco atletas={atletas} campeonato={campeonato} logoCampeonato={logoCampeonato} />
      {aviso && <p className="text-sm font-bold text-vs-gold">{aviso}</p>}
      {blocos.map((bloco) => {
        const grupos = (bloco.grupos ?? []).filter((grupo) => grupo.linhas.length > 0)
        const secoes = grupos.length > 0 ? grupos : [{ id: bloco.id ?? 'geral', nome: bloco.nome || 'Classificação', vagas: 0, linhas: bloco.linhas }]
        return secoes.map((grupo) => (
          <TabelaGrupos key={`${bloco.id}-${grupo.id}`} nome={grupo.nome} linhas={grupo.linhas} vagas={grupo.vagas ?? 0} campeonato={campeonato} logoCampeonato={logoCampeonato} />
        ))
      })}
      <TabelaScouts atletas={atletas} />
    </div>
  )
}

function gruposDaTabela(blocos: Bloco[]): GrupoProvisorio[] {
  return blocos.flatMap((bloco) => (bloco.grupos ?? []).map((grupo) => ({
    nome: grupo.nome,
    vagas: Number.isFinite(grupo.vagas) ? Number(grupo.vagas) : 0,
    linhas: grupo.linhas.flatMap((linha) => {
      const equipeId = Number(linha.equipeId)
      if (!Number.isInteger(equipeId) || equipeId <= 0) return []
      return [{
        posicao: linha.posicao,
        equipeId,
        equipe: linha.equipe,
        logoUrl: linha.logoUrl ?? null,
        corHex: linha.corHex ?? null,
      }]
    }),
  })))
}
