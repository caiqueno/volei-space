'use client'

import { useCallback, useRef, useState } from 'react'
import { TEXTO_SEM_CONEXAO } from '@/lib/ao-vivo-conexao'
import { decidirVisao, normalizarPlacar, partidaFinalizada, rotuloStatus, type PlacarPublico } from '@/lib/ao-vivo-ui/placar'
import { rotuloAtualizado } from '@/lib/ao-vivo-ui/polling'
import { usePollingVisivel, type ResultadoConsulta } from '@/lib/ao-vivo-ui/usePollingVisivel'

interface Props {
  partidaId: number
}

/**
 * Placar ao vivo público em tela cheia (modo TV/tablet): números enormes, alto contraste, sem dados pessoais.
 * Atualiza a cada 3 s (com recuo), pausa com a aba oculta e mantém o último placar se a rede cair.
 */
export function PlacarAoVivo({ partidaId }: Props) {
  const [placar, setPlacar] = useState<PlacarPublico | null>(null)
  const [naoEncontrada, setNaoEncontrada] = useState(false)
  const [falhou, setFalhou] = useState(false)
  const [carregou, setCarregou] = useState(false)
  const sequencia = useRef(0)

  const consultar = useCallback(
    async (sinal: AbortSignal): Promise<ResultadoConsulta> => {
      const minha = ++sequencia.current
      try {
        const res = await fetch(`/api/ao-vivo/${partidaId}`, { cache: 'no-store', signal: sinal, headers: { Accept: 'application/json' } })
        if (minha !== sequencia.current) return 'falha'
        if (res.status === 404) {
          setNaoEncontrada(true)
          setCarregou(true)
          return 'parar'
        }
        if (!res.ok) throw new Error('indisponivel')
        const lido = normalizarPlacar(await res.json().catch(() => null))
        if (!lido) throw new Error('formato')
        setPlacar(lido)
        setFalhou(false)
        setCarregou(true)
        return partidaFinalizada(lido.status) ? 'parar' : 'ok'
      } catch {
        if (sinal.aborted) return 'falha'
        setFalhou(true)
        setCarregou(true)
        return 'falha'
      }
    },
    [partidaId]
  )

  const { atualizadoEm, falhasSeguidas } = usePollingVisivel(consultar)
  const visao = decidirVisao({ temPlacar: !!placar, naoEncontrada, falhou, carregou })

  if (visao === 'carregando') {
    return (
      <Moldura>
        <p role="status" className="text-center text-2xl font-bold text-white">
          Carregando o placar...
        </p>
      </Moldura>
    )
  }
  if (visao === 'nao-encontrada') {
    return (
      <Moldura>
        <div className="text-center">
          <h1 className="text-3xl font-black text-white sm:text-5xl">Partida não encontrada</h1>
          <p className="mt-4 text-lg text-slate-200">Confira o endereço ou volte à lista de jogos.</p>
          <a href="/jogos" className="mt-8 inline-flex min-h-[48px] items-center rounded-xl bg-luva-amber px-6 text-lg font-bold text-luva-bg focus:outline-none focus-visible:ring-4 focus-visible:ring-white">
            Ver jogos
          </a>
        </div>
      </Moldura>
    )
  }
  if (visao === 'erro' || !placar) {
    return (
      <Moldura>
        <div role="alert" className="text-center">
          <h1 className="text-3xl font-black text-white sm:text-5xl">{TEXTO_SEM_CONEXAO}</h1>
          <p className="mt-4 text-lg text-slate-200">Não foi possível carregar o placar agora. Vamos tentar de novo sozinhos.</p>
        </div>
      </Moldura>
    )
  }

  const vivo = placar.status === 'EM_ANDAMENTO'
  const semConexao = falhasSeguidas > 0 || falhou
  return (
    <Moldura>
      <div className="flex min-h-screen w-full flex-col px-4 py-4 sm:px-8 sm:py-6">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-4 py-1 text-lg font-black uppercase tracking-wide ${
              vivo ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-950'
            }`}
          >
            {vivo && <span aria-hidden="true" className="h-3 w-3 rounded-full bg-white motion-safe:animate-pulse" />}
            {rotuloStatus(placar.status)}
          </span>
          {placar.setAtual && vivo && <span className="text-xl font-bold text-white sm:text-3xl">Set {placar.setAtual}</span>}
        </header>

        <section aria-label="Placar" className="grid flex-1 grid-cols-2 items-center gap-4 py-4">
          <Lado nome={placar.equipeA} pontos={placar.pontosA} sets={placar.setsA} saca={vivo && placar.sacador === 'A'} lado="A" />
          <Lado nome={placar.equipeB} pontos={placar.pontosB} sets={placar.setsB} saca={vivo && placar.sacador === 'B'} lado="B" />
        </section>

        {placar.sets.length > 0 && (
          <section aria-label="Sets" className="mb-4">
            <ul className="flex flex-wrap items-center justify-center gap-3">
              {placar.sets.map((s) => (
                <li key={s.numero} className="rounded-xl border-2 border-slate-400 bg-black/40 px-4 py-2 text-center text-white">
                  <span className="block text-sm font-bold uppercase text-slate-200">Set {s.numero}</span>
                  <span className="text-2xl font-black tabular-nums sm:text-4xl">
                    {s.a} x {s.b}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="flex flex-wrap items-center justify-between gap-2 text-base text-slate-100 sm:text-lg" aria-live="polite">
          <span>{atualizadoEm ? rotuloAtualizado(atualizadoEm) : rotuloAtualizado(placar.atualizadoEm ? Date.parse(placar.atualizadoEm) || null : null)}</span>
          {semConexao && <span className="rounded-md bg-amber-300 px-3 py-1 font-bold text-slate-950">{TEXTO_SEM_CONEXAO}</span>}
        </footer>
      </div>
    </Moldura>
  )
}

function Moldura({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center bg-luva-bg p-4">{children}</main>
}

function Lado({ nome, pontos, sets, saca, lado }: { nome: string; pontos: number; sets: number; saca: boolean; lado: 'A' | 'B' }) {
  return (
    <div className={`flex flex-col items-center rounded-3xl border-4 p-3 text-center sm:p-6 ${saca ? 'border-luva-amber bg-luva-navy' : 'border-slate-600 bg-luva-navy/70'}`}>
      <h2 className="line-clamp-2 break-words text-2xl font-black text-white sm:text-5xl" title={nome}>
        {nome}
      </h2>
      <p className="mt-2 text-xl font-bold text-slate-100 sm:text-3xl">
        Sets: <span className="text-luva-amber">{sets}</span>
      </p>
      <p className="font-black leading-none tabular-nums text-white" style={{ fontSize: 'clamp(5rem, 24vw, 22rem)' }} aria-label={`Pontos da equipe ${lado}: ${pontos}`}>
        {pontos}
      </p>
      <p className={`mt-2 min-h-[2rem] text-xl font-black uppercase tracking-wide sm:text-3xl ${saca ? 'text-luva-amber' : 'text-transparent'}`} aria-hidden={!saca}>
        {saca ? 'Saque' : ' '}
      </p>
    </div>
  )
}
