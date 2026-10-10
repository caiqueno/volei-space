'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Trophy } from 'lucide-react'
import { SeletorCategoria, queryCategoria, useCategoriaDoCampeonato } from '@/components/portal/SeletorCategoria'
import { INTERVALO_RANKING_JOGADORES_MS, ordenarJogadores, type ColunaFundamento, type LinhaJogadorRanking } from '@/lib/classificacao-jogadores'

type Ranking = {
  mvp: string | null
  pontos: number
  saque: number
  ataque: number
  bloqueio: number
  concluido: boolean
}

type Direcao = 'asc' | 'desc'

export function PainelRanking({ ligaId, concluido, categoriaInicial = null }: { ligaId: number; concluido: boolean; categoriaInicial?: string | null }) {
  const { categorias, categoriaId, setCategoriaId, pronto } = useCategoriaDoCampeonato(ligaId, categoriaInicial)

  if (!pronto) return <p className="text-sm font-semibold text-slate-300">Carregando...</p>

  return (
    <div className="grid gap-3">
      <SeletorCategoria categorias={categorias} valor={categoriaId} onChange={setCategoriaId} />
      <CartaoMvp ligaId={ligaId} concluido={concluido} categoriaId={categoriaId} />
      <TabelaJogadores ligaId={ligaId} categoriaId={categoriaId} />
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

  if (erro) return <p className="text-sm font-bold text-red-200">{erro}</p>
  if (!dados) return <p className="text-sm font-semibold text-slate-300">Carregando...</p>

  if (!dados.concluido || !dados.mvp) {
    return (
      <article className="rounded-3xl border border-white/10 p-5">
        <p className="luva-kicker">MVP do campeonato</p>
        <p className="mt-3 font-display text-2xl font-black">{dados.concluido ? 'Ainda não definido' : 'Ainda não disponível'}</p>
        <p className="mt-2 max-w-md text-sm font-semibold leading-6 text-slate-300">
          {dados.concluido
            ? 'Nenhum ponto de saque, ataque ou bloqueio foi registrado neste campeonato.'
            : 'O nome aparece quando o campeonato termina, pelo atleta com mais pontos nesses fundamentos.'}
        </p>
      </article>
    )
  }

  const iniciais = dados.mvp.split(' ').slice(0, 2).map((parte) => parte[0]).join('').toUpperCase()

  return (
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

function TabelaJogadores({ ligaId, categoriaId }: { ligaId: number; categoriaId: string | null }) {
  const [fundamentos, setFundamentos] = useState<ColunaFundamento[]>([])
  const [jogadores, setJogadores] = useState<LinhaJogadorRanking[] | null>(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [coluna, setColuna] = useState('posicao')
  const [direcao, setDirecao] = useState<Direcao>('asc')
  const geracao = useRef(0)

  const carregar = useCallback(async (sinal?: AbortSignal, silencioso = false) => {
    const pedido = geracao.current
    const resposta = await fetch(`/api/portal/rankings/jogadores?ligaId=${ligaId}${queryCategoria(categoriaId)}`, { cache: 'no-store', signal: sinal })
    const json = await resposta.json()
    if (sinal?.aborted || geracao.current !== pedido) return
    if (!resposta.ok) throw new Error(json.error || 'Falha')
    const recebidos = Array.isArray(json.data?.jogadores) ? json.data.jogadores as LinhaJogadorRanking[] : []
    const colunas = Array.isArray(json.data?.fundamentos) ? json.data.fundamentos as ColunaFundamento[] : []
    setFundamentos(colunas)
    setJogadores(recebidos)
    setErro('')
    setAviso('')
    if (!silencioso) setColuna('posicao')
    if (!silencioso) setDirecao('asc')
  }, [ligaId, categoriaId])

  useEffect(() => {
    geracao.current += 1
    const controle = new AbortController()
    setJogadores(null)
    setErro('')
    carregar(controle.signal).catch((causa) => {
      if (causa instanceof DOMException && causa.name === 'AbortError') return
      setErro('Erro ao carregar a classificação de jogadores')
    })
    return () => controle.abort()
  }, [carregar])

  useEffect(() => {
    let timer = 0
    let controle = new AbortController()
    const ler = () => {
      if (document.visibilityState !== 'visible') return
      controle.abort()
      controle = new AbortController()
      carregar(controle.signal, true).catch((causa) => {
        if (causa instanceof DOMException && causa.name === 'AbortError') return
        setAviso('Não foi possível atualizar agora. A tabela segue com a última leitura.')
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
  }, [carregar])

  const visiveis = useMemo(
    () => (jogadores ? ordenarJogadores(jogadores, coluna, direcao) : []),
    [jogadores, coluna, direcao],
  )

  function ordenar(proxima: string) {
    if (proxima === coluna) {
      setDirecao((atual) => atual === 'asc' ? 'desc' : 'asc')
      return
    }
    const texto = proxima === 'nome' || proxima === 'equipe' || proxima === 'posicao'
    setColuna(proxima)
    setDirecao(texto ? 'asc' : 'desc')
  }

  if (erro && !jogadores) return <p className="text-sm font-bold text-red-200">{erro}</p>
  if (!jogadores) return <p className="text-sm font-semibold text-slate-300">Carregando classificação...</p>

  return (
    <section className="overflow-hidden rounded-3xl border border-white/10" aria-labelledby="classificacao-jogadores">
      <div className="p-5 sm:p-6">
        <h2 id="classificacao-jogadores" className="font-display text-2xl font-black">Classificação geral de jogadores</h2>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
          Todos os atletas, sem separar por grupo ou equipe. A ordem começa pelo total, depois ataque, bloqueio, saque e nome. A tabela relê a súmula a cada 12 segundos enquanto esta aba está aberta.
        </p>
        {aviso && <p className="mt-3 text-sm font-bold text-amber-200">{aviso}</p>}
        {jogadores.length === 0 ? (
          <p className="mt-4 text-sm font-semibold text-slate-300">Nenhum atleta inscrito neste campeonato.</p>
        ) : (
          <div className="mt-4 max-w-full">
            <div className="mb-3 flex flex-wrap gap-2 md:hidden" role="group" aria-label="Ordenar classificação">
              {colunasDaTabela(fundamentos).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={coluna === item.id}
                  onClick={() => ordenar(item.id)}
                  className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${coluna === item.id ? 'bg-[#ffb331] text-slate-950' : 'border border-white/15 text-slate-200'}`}
                >
                  {item.rotulo}{coluna === item.id ? (direcao === 'asc' ? ' ↑' : ' ↓') : ''}
                </button>
              ))}
            </div>
            {/* Abaixo de 768px o globals.css corta .overflow-x-auto (overflow-x: clip). data-stack empilha cada número na tela. */}
            <table data-stack className="w-full table-fixed border-separate border-spacing-0 text-sm text-white">
              <caption className="sr-only">Classificação geral de jogadores por pontos de fundamento</caption>
              <thead className="max-md:hidden">
                <tr>
                  <Cabecalho rotulo="Pos." coluna="posicao" ativa={coluna} direcao={direcao} onClick={ordenar} className="w-12 text-left" />
                  <Cabecalho rotulo="Jogador" coluna="nome" ativa={coluna} direcao={direcao} onClick={ordenar} className="text-left" />
                  <Cabecalho rotulo="Equipe" coluna="equipe" ativa={coluna} direcao={direcao} onClick={ordenar} className="w-28 text-left" />
                  {fundamentos.map((item) => (
                    <Cabecalho key={item.id} rotulo={item.rotulo} coluna={item.id} ativa={coluna} direcao={direcao} onClick={ordenar} className="w-16 text-right" />
                  ))}
                  <Cabecalho rotulo="Total" coluna="total" ativa={coluna} direcao={direcao} onClick={ordenar} className="w-16 text-right" />
                </tr>
              </thead>
              <tbody>
                {visiveis.map((linha) => (
                  <tr key={linha.jogadorId}>
                    <td data-label="Posição" className="border-t border-white/10 px-3 py-2 font-black text-[#ffb331]">{linha.posicao}</td>
                    <td data-label="Jogador" className="border-t border-white/10 px-3 py-2 font-black md:truncate">{linha.numero == null ? linha.nome : `#${linha.numero} ${linha.nome}`}</td>
                    <td data-label="Equipe" className="border-t border-white/10 px-3 py-2 font-semibold text-slate-200 md:truncate">{linha.equipe}</td>
                    {fundamentos.map((item) => (
                      <td key={item.id} data-label={item.rotulo} className="border-t border-white/10 px-3 py-2 text-right tabular-nums">{linha.fundamentos[item.id] ?? 0}</td>
                    ))}
                    <td data-label="Total" className="border-t border-white/10 px-3 py-2 text-right font-black tabular-nums text-[#ffb331]">{linha.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

function colunasDaTabela(fundamentos: ColunaFundamento[]) {
  return [
    { id: 'posicao', rotulo: 'Pos.' },
    { id: 'nome', rotulo: 'Jogador' },
    { id: 'equipe', rotulo: 'Equipe' },
    ...fundamentos,
    { id: 'total', rotulo: 'Total' },
  ]
}

function Cabecalho({
  rotulo,
  coluna,
  ativa,
  direcao,
  onClick,
  className,
}: {
  rotulo: string
  coluna: string
  ativa: string
  direcao: Direcao
  onClick: (coluna: string) => void
  className?: string
}) {
  const selecionada = ativa === coluna
  return (
    <th scope="col" aria-sort={selecionada ? (direcao === 'asc' ? 'ascending' : 'descending') : 'none'} className={className}>
      <button type="button" onClick={() => onClick(coluna)} className={`w-full px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-300 ${className?.includes('text-right') ? 'text-right' : 'text-left'}`}>
        {rotulo}{selecionada ? (direcao === 'asc' ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  )
}
