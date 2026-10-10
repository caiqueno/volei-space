'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Jogo = {
  fase: string
  rodada: number
  origemVagaA: string
  origemVagaB: string
  ocupado: boolean
  timesDefinidos: boolean
  dataHora: string | null
  localNome: string | null
}

const ROTULO: Record<string, string> = {
  SEMIFINAL: 'Semifinal',
  FINAL: 'Final',
  TERCEIRO_LUGAR: '3º lugar',
}

function horaLocal(valor: string | null) {
  if (!valor) return ''
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return ''
  const ajuste = new Date(data.getTime() - data.getTimezoneOffset() * 60000)
  return ajuste.toISOString().slice(0, 16)
}

export function AgendarVagas({ ligaId, categoriaId }: { ligaId: number; categoriaId: string }) {
  const router = useRouter()
  const [jogos, setJogos] = useState<Jogo[]>([])
  const [opcoes, setOpcoes] = useState<string[]>([])
  const [mensagem, setMensagem] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    let ativo = true
    fetch(`/api/organizador/ligas/${ligaId}/mata-mata/vagas?categoria=${encodeURIComponent(categoriaId)}`)
      .then(async (resposta) => {
        const json = await resposta.json().catch(() => null)
        if (!resposta.ok) throw new Error(json?.error || 'Não foi possível carregar as vagas.')
        return json?.data
      })
      .then((data) => {
        if (!ativo || !data?.disponivel) return
        const lista = (data.jogos ?? []) as Jogo[]
        setJogos(lista.map((jogo) => ({ ...jogo, dataHora: horaLocal(jogo.dataHora) })))
        const grupos = (data.grupos ?? []) as string[]
        const bases = grupos.length ? grupos : ['Grupo A', 'Grupo B']
        const vagas = bases.flatMap((grupo) => [`1º ${grupo}`, `2º ${grupo}`])
        const atuais = lista.flatMap((jogo) => [jogo.origemVagaA, jogo.origemVagaB]).filter(Boolean)
        setOpcoes(Array.from(new Set(vagas.concat(['Vencedor Semi 1', 'Vencedor Semi 2', 'Perdedor Semi 1', 'Perdedor Semi 2'], atuais))))
      })
      .catch((err) => {
        if (ativo) setMensagem(err instanceof Error ? err.message : 'Não foi possível carregar as vagas.')
      })
    return () => {
      ativo = false
    }
  }, [categoriaId, ligaId])

  function alterar(indice: number, campo: keyof Jogo, valor: string) {
    setJogos((atual) => atual.map((jogo, i) => (i === indice ? { ...jogo, [campo]: valor } : jogo)))
  }

  async function salvar() {
    setSalvando(true)
    setMensagem('')
    try {
      const resposta = await fetch(`/api/organizador/ligas/${ligaId}/mata-mata/vagas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoriaCampeonatoId: categoriaId,
          jogos: jogos.filter((jogo) => !jogo.timesDefinidos).map((jogo) => ({
            fase: jogo.fase,
            rodada: jogo.rodada,
            origemVagaA: jogo.origemVagaA,
            origemVagaB: jogo.origemVagaB,
            dataHora: jogo.dataHora ? new Date(jogo.dataHora).toISOString() : '',
            localNome: jogo.localNome ?? '',
          })),
        }),
      })
      const json = await resposta.json().catch(() => null)
      if (!resposta.ok) throw new Error(json?.error || 'Não foi possível agendar os jogos.')
      setMensagem('Jogos gravados. O link do juiz fica em Jogos e continua o mesmo quando os times entrarem.')
      router.refresh()
    } catch (err) {
      setMensagem(err instanceof Error ? err.message : 'Não foi possível agendar os jogos.')
    } finally {
      setSalvando(false)
    }
  }

  if (jogos.length === 0) return null
  const abertos = jogos.some((jogo) => !jogo.timesDefinidos)

  return (
    <section className="mb-8 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <h2 className="font-display text-2xl font-black text-white">Agendar mata-mata</h2>
      <p className="mt-2 max-w-3xl text-sm font-semibold text-slate-300">
        Crie as semifinais, o 3º lugar e a final com data, horário e quadra antes de saber os times. A vaga mostra a origem, por exemplo 1º Grupo A ou Vencedor Semi 1. Quando a classificação fechar ou a semi terminar, o time entra neste mesmo jogo.
      </p>
      <div className="mt-5 grid gap-4">
        {jogos.map((jogo, indice) => (
          <div key={`${jogo.fase}-${jogo.rodada}`} className="grid gap-3 rounded-2xl bg-white p-4 text-slate-950 md:grid-cols-2">
            <p className="md:col-span-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              {ROTULO[jogo.fase] ?? jogo.fase}{jogo.fase === 'SEMIFINAL' ? ` ${jogo.rodada}` : ''}
              {jogo.timesDefinidos ? ' · times definidos' : ''}
            </p>
            <select disabled={jogo.timesDefinidos} value={jogo.origemVagaA} onChange={(event) => alterar(indice, 'origemVagaA', event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">
              {opcoes.map((opcao) => <option key={`a-${opcao}`}>{opcao}</option>)}
            </select>
            <select disabled={jogo.timesDefinidos} value={jogo.origemVagaB} onChange={(event) => alterar(indice, 'origemVagaB', event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">
              {opcoes.map((opcao) => <option key={`b-${opcao}`}>{opcao}</option>)}
            </select>
            <input disabled={jogo.timesDefinidos} type="datetime-local" value={jogo.dataHora ?? ''} onChange={(event) => alterar(indice, 'dataHora', event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold" />
            <input disabled={jogo.timesDefinidos} value={jogo.localNome ?? ''} onChange={(event) => alterar(indice, 'localNome', event.target.value)} placeholder="Quadra" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold" />
          </div>
        ))}
      </div>
      {abertos ? (
        <button type="button" onClick={salvar} disabled={salvando} className="mt-4 rounded-full bg-[#ffb331] px-5 py-2 text-sm font-black text-slate-950 disabled:opacity-60">
          {salvando ? 'Salvando' : 'Salvar jogos'}
        </button>
      ) : null}
      {mensagem ? <p className="mt-3 text-sm font-bold text-white">{mensagem}</p> : null}
    </section>
  )
}
