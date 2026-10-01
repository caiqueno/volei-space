'use client'

import { useEffect, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { PartidaCard } from '@/components/partidas/PartidaCard'
import { EstadoVazio } from '@/components/ui/EstadoVazio'
import type { GruposPartidaPublica, PartidaPublica } from '@/lib/partida-publica'

const INTERVALO_MS = 8000

type Props = {
  ligaId: number | null
  global?: boolean
  inicial: GruposPartidaPublica
  falhaInicial: boolean
}

export function PortalAgenda({ ligaId, global = false, inicial, falhaInicial }: Props) {
  const [grupos, setGrupos] = useState(inicial)
  const [falha, setFalha] = useState(falhaInicial)
  const [atualizando, setAtualizando] = useState(false)
  const [tentativa, setTentativa] = useState(0)
  const aoVivoNaTela = useRef(inicial.aoVivo.length > 0)
  aoVivoNaTela.current = grupos.aoVivo.length > 0

  useEffect(() => {
    setGrupos(inicial)
    setFalha(falhaInicial)
  }, [inicial, falhaInicial])

  useEffect(() => {
    if (!ligaId && !global) return
    let vivo = true
    let sequencia = 0
    const controle = new AbortController()

    async function carregar() {
      if (document.visibilityState === 'hidden') return
      const atual = ++sequencia
      setAtualizando(true)
      try {
        const consulta = ligaId ? `/api/portal/jogos?ligaId=${ligaId}&t=${Date.now()}` : `/api/portal/jogos?t=${Date.now()}`
        const resposta = await fetch(consulta, { cache: 'no-store', signal: controle.signal })
        const json = await resposta.json()
        if (!resposta.ok) throw new Error(json?.error || 'Erro ao carregar jogos')
        if (!vivo || atual !== sequencia) return
        setGrupos({
          aoVivo: json.data?.aoVivo ?? [],
          proximos: json.data?.proximos ?? [],
          encerradas: json.data?.encerradas ?? [],
          analise: json.data?.analise ?? [],
          outras: json.data?.outras ?? [],
        })
        setFalha(false)
      } catch (erro) {
        if (!vivo || atual !== sequencia || (erro instanceof DOMException && erro.name === 'AbortError')) return
        setFalha(true)
      } finally {
        if (vivo && atual === sequencia) setAtualizando(false)
      }
    }

    if (tentativa > 0) void carregar()
    let timer = 0
    const agendar = () => {
      const espera = aoVivoNaTela.current ? INTERVALO_MS : 60000
      timer = window.setTimeout(() => {
        void carregar().finally(() => {
          if (vivo) agendar()
        })
      }, espera)
    }
    agendar()
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') void carregar()
    }
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      vivo = false
      controle.abort()
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [ligaId, global, tentativa])

  const vazio = grupos.aoVivo.length + grupos.proximos.length + grupos.encerradas.length + grupos.analise.length === 0

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-slate-400" aria-live="polite">
          {falha && vazio ? 'Não foi possível atualizar os jogos.' : falha ? 'A atualização falhou. Os últimos jogos válidos continuam na tela.' : atualizando ? 'Atualizando jogos…' : 'Jogos do campeonato'}
        </p>
        {falha && (ligaId || global) && (
          <button type="button" className="inline-flex items-center gap-2 rounded-full bg-[#ffb331] px-4 py-2 text-xs font-black text-slate-950" onClick={() => setTentativa((valor) => valor + 1)}>
            <RotateCcw size={14} />
            Tentar novamente
          </button>
        )}
      </div>

      {falha && vazio ? (
        <EstadoVazio titulo="Não foi possível carregar os jogos" descricao="Tivemos uma falha ao buscar a agenda. Tente novamente em instantes." />
      ) : vazio ? (
        <EstadoVazio titulo="Nenhum jogo neste campeonato" descricao="As partidas aparecem aqui quando a organização montar o calendário." />
      ) : (
        <div className="grid gap-8">
          <Faixa titulo="Em andamento" partidas={grupos.aoVivo} />
          <Faixa titulo="Próximos jogos" partidas={grupos.proximos} />
          <Faixa titulo="Resultados" partidas={grupos.encerradas} />
          <Faixa titulo="Em análise" partidas={grupos.analise} />
          <Faixa titulo="Outros" partidas={grupos.outras} />
        </div>
      )}
    </div>
  )
}

function Faixa({ titulo, partidas }: { titulo: string; partidas: PartidaPublica[] }) {
  if (partidas.length === 0) return null
  return (
    <section>
      <h3 className="font-display text-2xl font-black text-white">{titulo}</h3>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {partidas.map((partida) => <PartidaCard key={partida.id} partida={partida} />)}
      </div>
    </section>
  )
}
