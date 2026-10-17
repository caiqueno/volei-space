'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { chamarBanco } from '@/lib/banco-ui/cliente'
import { classificarFalha, formatarPlacar, nomeDoLado, type TelaEstado } from '@/lib/banco-ui/falhas'
import { textoAtualizado } from '@/lib/banco-ui/polling'
import { setPadrao, setsDisponiveis } from '@/lib/banco-ui/sets'
import type { VisaoBanco } from '@/lib/banco-ui/tipos'
import { usePolling } from '@/lib/banco-ui/use-polling'
import { CarregandoTela, EstadoTela } from './EstadoTela'
import { PapeletaPainel } from './PapeletaPainel'
import { PedidosPainel } from './PedidosPainel'

export function BancoApp({ token }: { token: string }) {
  const [visao, setVisao] = useState<VisaoBanco | null>(null)
  const [tela, setTela] = useState<TelaEstado | null>(null)
  const [setEscolhido, setSetEscolhido] = useState<number | null>(null)
  const [limitado, setLimitado] = useState(false)
  const ultimoJson = useRef('')
  const temVisao = useRef(false)

  const tarefa = useCallback(async (): Promise<'parar' | void> => {
    const r = await chamarBanco(token, '', 'GET')
    if (r.ok) {
      const dados = (r.json as { data?: VisaoBanco } | null)?.data
      if (!dados) throw new Error('resposta vazia')
      const texto = JSON.stringify(dados)
      if (texto !== ultimoJson.current) {
        ultimoJson.current = texto
        setVisao(dados)
      }
      temVisao.current = true
      setLimitado(false)
      setTela(null)
      return
    }
    const t = classificarFalha(r.status)
    setLimitado(t === 'limite')
    if (t === 'desligado' || t === 'token-invalido' || t === 'expirado') {
      setTela(t)
      return 'parar'
    }
    if (!temVisao.current) setTela(t)
    throw new Error(t)
  }, [token])

  const { semConexao, ultimaAtualizacao, atualizarAgora } = usePolling(tarefa)

  useEffect(() => {
    if (visao && setEscolhido === null) setSetEscolhido(setPadrao(visao.papeletas))
  }, [visao, setEscolhido])

  if (tela && !visao) return <EstadoTela tela={tela} onTentar={atualizarAgora} />
  if (tela && visao && tela !== 'rede' && tela !== 'erro' && tela !== 'limite' && tela !== 'nao-habilitado') return <EstadoTela tela={tela} />
  if (!visao || setEscolhido === null) return <CarregandoTela />

  const placar = formatarPlacar(visao.partida.placar)
  const sets = setsDisponiveis(visao.papeletas)

  return (
    <div className="mx-auto w-full max-w-3xl px-3 pb-16 pt-3 text-vs-text">
      <header className="rounded-3xl border border-vs-border bg-vs-surface p-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-vs-gold">Banco de reservas</p>
        <h1 className="font-display text-3xl font-bold">{visao.equipe.nome}</h1>
        <p className="mt-1 text-base font-semibold">
          {nomeDoLado(visao.partida.equipeA)} <span aria-hidden="true">×</span>
          <span className="sr-only">contra</span> {nomeDoLado(visao.partida.equipeB)}
        </p>
        {placar ? (
          <p className="mt-2 text-lg font-bold" aria-label="Placar">
            {placar.sets ? <span>Sets {placar.sets}</span> : null}
            {placar.sets && placar.pontos ? <span aria-hidden="true"> · </span> : null}
            {placar.pontos ? <span>{placar.sets ? `Pontos ${placar.pontos}` : placar.pontos}</span> : null}
          </p>
        ) : null}
        <p className="mt-1 text-sm text-vs-muted">{String(visao.partida.status || '').replace(/_/g, ' ').toLowerCase()}</p>
        <p role="status" className={`mt-2 inline-block rounded-full border px-3 py-1 text-sm font-bold ${semConexao ? 'border-red-400 bg-red-950/60 text-red-100' : 'border-vs-border text-vs-muted'}`}>
          {limitado
            ? `Muitas consultas, aguardando. Mostrando os dados ${ultimaAtualizacao ? textoAtualizado(ultimaAtualizacao) : 'antigos'}.`
            : semConexao
              ? `Sem conexão. Mostrando os dados ${ultimaAtualizacao ? textoAtualizado(ultimaAtualizacao) : 'antigos'}.`
              : textoAtualizado(ultimaAtualizacao)}
        </p>
      </header>

      <nav aria-label="Escolher o set" className="mt-3 flex flex-wrap gap-2">
        {sets.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={s === setEscolhido}
            onClick={() => setSetEscolhido(s)}
            className={`min-h-[44px] min-w-[64px] rounded-full border px-4 text-base font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
              s === setEscolhido ? 'border-vs-gold bg-vs-gold text-vs-on-gold' : 'border-vs-border bg-vs-elevated text-vs-text'
            }`}
          >
            Set {s}
          </button>
        ))}
      </nav>

      <div className="mt-3 space-y-4">
        <PapeletaPainel key={setEscolhido} token={token} visao={visao} set={setEscolhido} semConexao={semConexao} onAtualizar={atualizarAgora} />
        <PedidosPainel token={token} visao={visao} setAtual={setEscolhido} semConexao={semConexao} onAtualizar={atualizarAgora} />
      </div>
    </div>
  )
}
