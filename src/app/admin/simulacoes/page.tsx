'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type PartidaSim = {
  id: number
  ligaId: number
  campeonato: string
  status: string
  statusCampeonato: string
  rodada: number
  dataHora: string | null
  localNome: string | null
  setsPorA: number | null
  setsPorB: number | null
  pontosPorA: number | null
  pontosPorB: number | null
  sumulaToken: string | null
  equipeA: { nome: string } | null
  equipeB: { nome: string } | null
  escala: Array<{ cargo: string; arbitro: { nome: string } | null }>
  candidaturasArbitro: Array<{ status: string }>
  sets: Array<{ numero: number; pontosA: number; pontosB: number }>
  ocorrencias: Array<{ id: number; tipo: string; descricao: string | null; set: number | null }>
  placar: { pausada: boolean; velocidade: number; acumuladoMs: number; marcaEm: number; pontosA: number; pontosB: number; setsA: number; setsB: number }
}

type Painel = {
  campeonatos: number
  agendadas: number
  andamento: number
  encerradas: number
  semArbitro: number
  arbitrosEmQuadra: number
  alertas: string[]
  partidas: PartidaSim[]
  campeonatosLista: Array<{ id: number; nome: string; status: string; inscricoesAbertas: boolean }>
  servidorAgora: number
}

const VAZIO: Painel = {
  campeonatos: 0, agendadas: 0, andamento: 0, encerradas: 0, semArbitro: 0, arbitrosEmQuadra: 0, alertas: [], partidas: [], campeonatosLista: [], servidorAgora: 0,
}

function relogioVisivel(placar: PartidaSim['placar'] | undefined, servidorAgora: number, recebidoEm: number) {
  if (!placar) return 0
  if (placar.pausada) return placar.acumuladoMs
  const agoraServidor = servidorAgora + (Date.now() - recebidoEm)
  const decorrido = Math.max(0, agoraServidor - placar.marcaEm)
  return placar.acumuladoMs + decorrido * placar.velocidade
}

function formatarRelogio(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const minutos = Math.floor(total / 60)
  const segundos = total % 60
  return `${minutos}:${String(segundos).padStart(2, '0')}`
}

export default function SimulacoesPage() {
  const [painel, setPainel] = useState<Painel>(VAZIO)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [campeonato, setCampeonato] = useState('todos')
  const [status, setStatus] = useState('todos')
  const [arbitro, setArbitro] = useState('todos')
  const [equipe, setEquipe] = useState('todos')
  const [selecionada, setSelecionada] = useState<number | null>(null)
  const [recebidoEm, setRecebidoEm] = useState(Date.now())
  const [tick, setTick] = useState(0)

  async function carregar() {
    const resposta = await fetch('/api/admin/simulacoes', { cache: 'no-store' })
    const json = await resposta.json().catch(() => ({}))
    if (!resposta.ok) throw new Error(json.error || 'Não foi possível carregar a central.')
    setPainel(json.data ?? VAZIO)
    setRecebidoEm(Date.now())
    setErro(null)
  }

  useEffect(() => {
    let ativo = true
    const ler = () => carregar().catch((falha) => {
      if (ativo) setErro(falha instanceof Error ? falha.message : 'Não foi possível carregar a central.')
    })
    ler()
    const timer = window.setInterval(ler, 8000)
    const ponteiro = window.setInterval(() => setTick((valor) => valor + 1), 1000)
    return () => {
      ativo = false
      window.clearInterval(timer)
      window.clearInterval(ponteiro)
    }
  }, [])

  async function acao(corpo: Record<string, unknown>) {
    setOcupado(true)
    setErro(null)
    try {
      const resposta = await fetch('/api/admin/simulacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      })
      const json = await resposta.json().catch(() => ({}))
      if (!resposta.ok) throw new Error(json.error || 'A simulação não foi atualizada.')
      if (json.data?.partidas) setPainel(json.data)
      else await carregar()
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'A simulação não foi atualizada.')
    } finally {
      setOcupado(false)
    }
  }

  const equipes = useMemo(() => {
    const nomes = new Set<string>()
    painel.partidas.forEach((partida) => {
      if (partida.equipeA?.nome) nomes.add(partida.equipeA.nome)
      if (partida.equipeB?.nome) nomes.add(partida.equipeB.nome)
    })
    return Array.from(nomes)
  }, [painel.partidas])

  const arbitros = useMemo(() => {
    const nomes = new Set<string>()
    painel.partidas.forEach((partida) => partida.escala?.forEach((item) => {
      if (item.arbitro?.nome) nomes.add(item.arbitro.nome)
    }))
    return Array.from(nomes)
  }, [painel.partidas])

  const lista = painel.partidas.filter((partida) => {
    if (campeonato !== 'todos' && String(partida.ligaId) !== campeonato) return false
    if (status !== 'todos' && partida.status !== status) return false
    if (arbitro !== 'todos' && !partida.escala?.some((item) => item.arbitro?.nome === arbitro)) return false
    if (equipe !== 'todos' && partida.equipeA?.nome !== equipe && partida.equipeB?.nome !== equipe) return false
    return true
  })
  const detalhe = lista.find((partida) => partida.id === selecionada) ?? lista[0] ?? null

  return (
    <div className="grid gap-6 p-4 lg:p-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Desenvolvimento</p>
        <h2 className="mt-2 text-2xl font-black text-slate-950">Central de simulações</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
          Campeonatos, equipes e partidas fictícias, com as mesmas tabelas da operação. Eles ficam fora do portal, da lista pública e do sitemap. O árbitro de teste só entra fora de produção.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" disabled={ocupado} onClick={() => acao({ acao: 'recriar' })} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:opacity-60">Recriar cenários</button>
          <button type="button" disabled={ocupado} onClick={() => acao({ acao: 'limpar' })} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-black text-slate-800 disabled:opacity-60">Limpar simulação</button>
        </div>
        {erro && <p className="mt-4 text-sm font-bold text-red-700">{erro}</p>}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Campeonatos de teste', painel.campeonatos],
          ['Agendadas', painel.agendadas],
          ['Em andamento', painel.andamento],
          ['Encerradas', painel.encerradas],
          ['Sem árbitro', painel.semArbitro],
          ['Árbitros em quadra', painel.arbitrosEmQuadra],
        ].map(([rotulo, valor]) => (
          <article key={String(rotulo)} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{rotulo}</p>
            <p className="mt-2 text-3xl font-black text-slate-950">{valor}</p>
          </article>
        ))}
      </section>

      {painel.alertas.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-950">
          {painel.alertas.map((alerta) => <p key={alerta}>{alerta}</p>)}
        </section>
      )}

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <select value={campeonato} onChange={(evento) => setCampeonato(evento.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold">
              <option value="todos">Todos os campeonatos</option>
              {painel.campeonatosLista.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </select>
            <select value={status} onChange={(evento) => setStatus(evento.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold">
              <option value="todos">Todos os status</option>
              <option value="AGENDADA">Agendada</option>
              <option value="EM_ANDAMENTO">Em andamento</option>
              <option value="ENCERRADA">Encerrada</option>
            </select>
            <select value={arbitro} onChange={(evento) => setArbitro(evento.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold">
              <option value="todos">Todos os árbitros</option>
              {arbitros.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
            </select>
            <select value={equipe} onChange={(evento) => setEquipe(evento.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold">
              <option value="todos">Todas as equipes</option>
              {equipes.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
            </select>
          </div>
          <div className="mt-4 grid gap-2">
            {lista.length === 0 && <p className="text-sm font-semibold text-slate-500">Nenhuma partida de simulação neste filtro. Recrie os cenários para começar.</p>}
            {lista.map((partida) => (
              <button key={partida.id} type="button" onClick={() => setSelecionada(partida.id)} className={`rounded-2xl border p-3 text-left ${detalhe?.id === partida.id ? 'border-amber-400 bg-amber-50' : 'border-slate-200'}`}>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{partida.campeonato} · {partida.status}</p>
                <p className="mt-1 font-black text-slate-950">{partida.equipeA?.nome} {partida.placar?.setsA ?? partida.setsPorA ?? 0} × {partida.placar?.setsB ?? partida.setsPorB ?? 0} {partida.equipeB?.nome}</p>
                <p className="text-sm font-semibold text-slate-600">{partida.localNome} · set {partida.placar?.pontosA ?? 0} × {partida.placar?.pontosB ?? 0}{partida.placar?.pausada ? ' · pausada' : ''}</p>
              </button>
            ))}
          </div>
        </div>

        {detalhe && (
          <aside className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Partida {detalhe.id}</p>
            <h3 className="mt-2 text-xl font-black text-slate-950">{detalhe.equipeA?.nome} × {detalhe.equipeB?.nome}</h3>
            <p className="mt-1 text-sm font-semibold text-slate-600">{detalhe.campeonato} · {detalhe.statusCampeonato}</p>
            <p className="mt-3 text-4xl font-black text-slate-950">{detalhe.placar?.setsA ?? detalhe.setsPorA ?? 0} × {detalhe.placar?.setsB ?? detalhe.setsPorB ?? 0}</p>
            <p className="text-sm font-bold text-slate-700">Set atual {detalhe.placar?.pontosA ?? detalhe.pontosPorA ?? 0} × {detalhe.placar?.pontosB ?? detalhe.pontosPorB ?? 0} · velocidade {detalhe.placar?.velocidade ?? 1}×</p>
            <p key={tick} className="mt-1 text-sm font-black text-slate-950">Tempo da simulação {formatarRelogio(relogioVisivel(detalhe.placar, painel.servidorAgora, recebidoEm))}</p>
            <p className="mt-3 text-sm font-semibold text-slate-600">{detalhe.localNome || 'Local não informado'}</p>
            <ul className="mt-3 grid gap-1 text-sm font-semibold text-slate-700">
              {(detalhe.escala ?? []).length === 0 && <li>Sem árbitro escalado.</li>}
              {(detalhe.escala ?? []).map((item) => <li key={item.cargo}>{item.cargo === 'PRIMEIRO_ARBITRO' ? 'Primeiro árbitro' : 'Segundo árbitro'}: {item.arbitro?.nome}</li>)}
              {(detalhe.candidaturasArbitro ?? []).some((item) => item.status === 'SOLICITADA') && <li>Há um pedido de arbitragem aguardando confirmação.</li>}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={ocupado} onClick={() => acao({ acao: 'iniciar', partidaId: detalhe.id })} className="rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white">Iniciar</button>
              <button type="button" disabled={ocupado} onClick={() => acao({ acao: 'pausar', partidaId: detalhe.id })} className="rounded-full border border-slate-300 px-3 py-2 text-xs font-black">Pausar</button>
              <button type="button" disabled={ocupado} onClick={() => acao({ acao: 'retomar', partidaId: detalhe.id })} className="rounded-full border border-slate-300 px-3 py-2 text-xs font-black">Retomar</button>
              <button type="button" disabled={ocupado} onClick={() => acao({ acao: 'encerrar', partidaId: detalhe.id })} className="rounded-full border border-slate-300 px-3 py-2 text-xs font-black">Encerrar</button>
              {[1, 2, 4, 8].map((valor) => (
                <button key={valor} type="button" disabled={ocupado} onClick={() => acao({ acao: 'avancar', partidaId: detalhe.id, velocidade: valor })} className="rounded-full border border-slate-300 px-3 py-2 text-xs font-black">{valor}×</button>
              ))}
            </div>
            {detalhe.sumulaToken && (
              <Link href={`/sumula/${detalhe.sumulaToken}`} className="mt-4 inline-flex text-sm font-black text-amber-800">Abrir a súmula real desta partida</Link>
            )}
            <ol className="mt-4 grid gap-1 text-sm font-semibold text-slate-600">
              {(detalhe.sets ?? []).map((set) => <li key={set.numero}>Set {set.numero}: {set.pontosA} × {set.pontosB}</li>)}
              {(detalhe.ocorrencias ?? []).map((evento) => <li key={evento.id}>{evento.descricao}</li>)}
            </ol>
          </aside>
        )}
      </section>
    </div>
  )
}
