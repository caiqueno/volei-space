'use client'

import { useEffect, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { PartidaCard } from '@/components/partidas/PartidaCard'
import { BotaoJogosStories } from '@/components/stories/BotaoStoriesInstagram'
import { EstadoVazio } from '@/components/ui/EstadoVazio'
import { useBancoAoVivo } from '@/lib/use-banco-ao-vivo'
import type { GruposPartidaPublica, PartidaPublica } from '@/lib/partida-publica'
import { queryCategoria } from '@/components/portal/SeletorCategoria'
import { ordenarJogos } from '@/lib/data-hora'
import { manterPaginaAberta } from '@/lib/pagina-aberta'

type TemMais = { aoVivo: boolean; proximos: boolean; encerradas: boolean }
type Parte = 'aoVivo' | 'proximos' | 'encerradas'

type Props = {
  ligaId: number
  inicial: GruposPartidaPublica
  temMaisInicial?: TemMais
  falhaInicial: boolean
  categoriaId?: string | null
  compartilhar?: boolean
}

const consultaParte: Record<Parte, string> = {
  aoVivo: 'ao-vivo',
  proximos: 'proximos',
  encerradas: 'encerradas',
}

export function PortalAgenda({ ligaId, inicial, temMaisInicial, falhaInicial, categoriaId = null, compartilhar = false }: Props) {
  const [grupos, setGrupos] = useState(inicial)
  const [temMais, setTemMais] = useState<TemMais>(temMaisInicial ?? { aoVivo: false, proximos: false, encerradas: false })
  const [falha, setFalha] = useState(falhaInicial)
  const [atualizando, setAtualizando] = useState(false)
  const [carregando, setCarregando] = useState<Parte | null>(null)
  const gruposRef = useRef(grupos)
  gruposRef.current = grupos
  const origem = useRef({ inicial, temMaisInicial, falhaInicial })
  origem.current = { inicial, temMaisInicial, falhaInicial }
  // Sobe quando o campeonato muda ou o usuário pede outra página.
  // A releitura do Realtime que já estava no ar não aplica por cima.
  const versao = useRef(0)

  useEffect(() => {
    versao.current += 1
    const props = origem.current
    setGrupos(props.inicial)
    setTemMais(props.temMaisInicial ?? { aoVivo: false, proximos: false, encerradas: false })
    setFalha(props.falhaInicial)
  }, [ligaId, categoriaId])

  async function sincronizar() {
    const visto = versao.current
    setAtualizando(true)
    const atual = gruposRef.current
    const limite = Math.max(8, atual.aoVivo.length, atual.proximos.length, atual.encerradas.length)
    try {
      const resposta = await fetch(`/api/portal/jogos?ligaId=${ligaId}${queryCategoria(categoriaId)}&limite=${limite}&t=${Date.now()}`, { cache: 'no-store' })
      const json = await resposta.json()
      if (visto !== versao.current) return
      if (!resposta.ok) throw new Error(json?.error || 'Erro ao carregar jogos')
      const proximo = {
        aoVivo: (json.data?.aoVivo ?? []) as PartidaPublica[],
        proximos: (json.data?.proximos ?? []) as PartidaPublica[],
        encerradas: (json.data?.encerradas ?? []) as PartidaPublica[],
      }
      const mais = {
        aoVivo: Boolean(json.data?.temMais?.aoVivo),
        proximos: Boolean(json.data?.temMais?.proximos),
        encerradas: Boolean(json.data?.temMais?.encerradas),
      }
      setGrupos((corrente) => ({
        aoVivo: ordenarJogos(manterPaginaAberta(corrente.aoVivo, proximo.aoVivo, mais.aoVivo)),
        proximos: ordenarJogos(manterPaginaAberta(corrente.proximos, proximo.proximos, mais.proximos)),
        encerradas: ordenarJogos(manterPaginaAberta(corrente.encerradas, proximo.encerradas, mais.encerradas)),
        analise: [],
        outras: [],
      }))
      setTemMais(mais)
      setFalha(false)
    } catch {
      if (visto !== versao.current) return
      setFalha(true)
    } finally {
      setAtualizando(false)
    }
  }

  useBancoAoVivo(
    `agenda-${ligaId}`,
    [{ tabela: 'Partida', filtro: `ligaId=eq.${ligaId}` }],
    () => { void sincronizar() },
  )

  async function carregarMais(parte: Parte) {
    if (carregando) return
    versao.current += 1
    const visto = versao.current
    setCarregando(parte)
    try {
      const offset = grupos[parte].length
      const resposta = await fetch(`/api/portal/jogos?ligaId=${ligaId}${queryCategoria(categoriaId)}&parte=${consultaParte[parte]}&offset=${offset}&limite=8`, { cache: 'no-store' })
      const json = await resposta.json()
      if (visto !== versao.current) return
      if (!resposta.ok) throw new Error(json?.error || 'Erro ao carregar jogos')
      const novas = (json.data?.[parte] ?? []) as PartidaPublica[]
      setGrupos((atual) => {
        const ids = new Set(atual[parte].map((partida) => partida.id))
        return { ...atual, [parte]: ordenarJogos([...atual[parte], ...novas.filter((partida) => !ids.has(partida.id))]) }
      })
      setTemMais((atual) => ({ ...atual, [parte]: Boolean(json.data?.temMais?.[parte]) }))
      setFalha(false)
    } catch {
      if (visto !== versao.current) return
      setFalha(true)
    } finally {
      setCarregando(null)
    }
  }

  const vazio = grupos.aoVivo.length + grupos.proximos.length + grupos.encerradas.length === 0

  return (
    <div>
      {compartilhar && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-black text-white">Jogos</h2>
          <BotaoJogosStories
            titulo="Jogos"
            jogos={[...grupos.aoVivo, ...grupos.proximos, ...grupos.encerradas].map((partida) => ({
              nomeA: partida.equipeA?.nome || 'A definir',
              nomeB: partida.equipeB?.nome || 'A definir',
              status: partida.status,
              setsPorA: partida.setsPorA,
              setsPorB: partida.setsPorB,
            }))}
          />
        </div>
      )}
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-slate-400" aria-live="polite">
          {falha && vazio ? 'Não foi possível atualizar os jogos.' : falha ? 'A atualização falhou. Os jogos já exibidos continuam na tela.' : atualizando ? 'Atualizando o ao vivo…' : categoriaId ? 'Jogos desta categoria' : 'Jogos deste campeonato'}
        </p>
        {falha && (
          <button type="button" className="inline-flex items-center gap-2 rounded-full bg-[#ffb331] px-4 py-2 text-xs font-black text-slate-950" onClick={() => void sincronizar()}>
            <RotateCcw size={14} />
            Tentar novamente
          </button>
        )}
      </div>

      {falha && vazio ? (
        <EstadoVazio titulo="Não foi possível carregar os jogos" descricao="Tivemos uma falha ao buscar a agenda. Tente novamente em instantes." />
      ) : vazio ? (
        <EstadoVazio titulo={categoriaId ? 'Nenhum jogo nesta categoria' : 'Nenhum jogo neste campeonato'} descricao="As partidas aparecem aqui quando a organização montar o calendário." />
      ) : (
        <div className="grid gap-8">
          <Faixa titulo="Ao vivo" parte="aoVivo" partidas={grupos.aoVivo} temMais={temMais.aoVivo} carregando={carregando === 'aoVivo'} onMore={() => carregarMais('aoVivo')} />
          <Faixa titulo="Próximos jogos" parte="proximos" partidas={grupos.proximos} temMais={temMais.proximos} carregando={carregando === 'proximos'} onMore={() => carregarMais('proximos')} />
          <Faixa titulo="Últimos jogos" parte="encerradas" partidas={grupos.encerradas} temMais={temMais.encerradas} carregando={carregando === 'encerradas'} onMore={() => carregarMais('encerradas')} />
        </div>
      )}
    </div>
  )
}

function Faixa({ titulo, partidas, temMais, carregando, onMore }: { titulo: string; parte: Parte; partidas: PartidaPublica[]; temMais: boolean; carregando: boolean; onMore: () => void }) {
  if (partidas.length === 0 && !temMais) return null
  return (
    <section>
      <h3 className="font-display text-2xl font-black text-white">{titulo}</h3>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {partidas.map((partida) => <PartidaCard key={partida.id} partida={partida} />)}
      </div>
      {temMais && (
        <button type="button" className="mt-4 rounded-full bg-[#ffb331] px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-60" onClick={onMore} disabled={carregando}>
          {carregando ? 'Carregando…' : 'Ver mais'}
        </button>
      )}
    </section>
  )
}
