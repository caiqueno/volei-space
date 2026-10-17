'use client'

import { useRef, useState } from 'react'
import { MAX_DESAFIOS, MAX_SUBS, MAX_TEMPOS, type Lado } from '@/lib/prototipo/placar'
import { TIME_A, TIME_B } from '@/lib/prototipo/exemplo'
import { BTN_PRIMARIO, BTN_SECUNDARIO, CARTAO } from './Moldura'
import { useProto } from './ProtoContext'
import { Historico, PlacarVisual, QuadraRotacao } from './PlacarVisual'

const NOME: Record<Lado, string> = { A: TIME_A, B: TIME_B }
const BTN_PONTO =
  'min-h-[88px] rounded-2xl bg-vs-blue text-lg font-extrabold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vs-gold active:scale-[0.98] disabled:opacity-50'

export function TelaPlacar() {
  const { placar, dispatch } = useProto()
  return (
    <>
      <PlacarVisual placar={placar} />
      <div className="grid grid-cols-2 gap-3">
        {(['A', 'B'] as Lado[]).map((l) => (
          <button key={l} type="button" className={BTN_PONTO} disabled={Boolean(placar.vencedor)} onClick={() => dispatch({ tipo: 'ponto', lado: l })}>
            + Ponto {NOME[l]}
          </button>
        ))}
      </div>
      <button type="button" className={BTN_SECUNDARIO} disabled={placar.anteriores.length === 0} onClick={() => dispatch({ tipo: 'desfazer' })}>
        Desfazer último lance
      </button>
      <Historico placar={placar} />
    </>
  )
}

export function TelaRotacao() {
  const { placar, dispatch } = useProto()
  return (
    <>
      <p className="text-vs-text">
        Saque atual: <strong>{NOME[placar.saque]}</strong>. Quando o outro time ganha o ponto, ele assume o saque e gira uma posição.
      </p>
      <QuadraRotacao lado="A" rotacao={placar.rotacao.A} />
      <QuadraRotacao lado="B" rotacao={placar.rotacao.B} />
      <button type="button" className={BTN_PRIMARIO} disabled={Boolean(placar.vencedor)} onClick={() => dispatch({ tipo: 'ponto', lado: placar.saque === 'A' ? 'B' : 'A' })}>
        Dar ponto ao time que recebe (gira a rotação)
      </button>
    </>
  )
}

export function TelaSubstituicao() {
  const { placar, dispatch } = useProto()
  return (
    <>
      <PlacarVisual placar={placar} />
      {(['A', 'B'] as Lado[]).map((l) => (
        <div key={l} className={`${CARTAO} space-y-2`}>
          <h2 className="font-semibold text-vs-text">{NOME[l]}</h2>
          <p className="text-sm text-vs-muted">
            Tempos: {placar.tempos[l]} de {MAX_TEMPOS} · Substituições: {placar.subs[l]} de {MAX_SUBS}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" className={BTN_SECUNDARIO} disabled={placar.tempos[l] >= MAX_TEMPOS || Boolean(placar.vencedor)} onClick={() => dispatch({ tipo: 'tempo', lado: l })}>
              Pedir tempo
            </button>
            <button type="button" className={BTN_SECUNDARIO} disabled={placar.subs[l] >= MAX_SUBS || Boolean(placar.vencedor)} onClick={() => dispatch({ tipo: 'substituicao', lado: l })}>
              Substituição
            </button>
          </div>
          {placar.tempos[l] >= MAX_TEMPOS ? <p className="text-sm text-vs-gold">Limite de tempos do set atingido.</p> : null}
        </div>
      ))}
    </>
  )
}

export function TelaPedidoBanco() {
  const { placar, dispatch } = useProto()
  const p = placar.pedidoBanco
  return (
    <>
      <div className={`${CARTAO} space-y-3`} aria-live="polite">
        {p ? (
          <>
            <h2 className="font-semibold text-vs-text">Pedido do banco: {p.tipo === 'tempo' ? 'tempo' : 'substituição'} — {NOME[p.lado]}</h2>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" className={BTN_PRIMARIO} onClick={() => dispatch({ tipo: 'aceitar-pedido' })}>Aceitar</button>
              <button type="button" className={BTN_SECUNDARIO} onClick={() => dispatch({ tipo: 'recusar-pedido' })}>Recusar</button>
            </div>
          </>
        ) : (
          <>
            <p className="text-vs-muted">Nenhum pedido pendente.</p>
            <button type="button" className={BTN_SECUNDARIO} onClick={() => dispatch({ tipo: 'pedido', lado: 'A', pedido: 'troca' })}>
              Simular pedido de troca do {TIME_A}
            </button>
          </>
        )}
      </div>
      <Historico placar={placar} />
    </>
  )
}

export function TelaDesafio() {
  const { placar, dispatch } = useProto()
  return (
    <>
      {(['A', 'B'] as Lado[]).map((l) => (
        <div key={l} className={`${CARTAO} flex items-center justify-between gap-3`}>
          <div>
            <h2 className="font-semibold text-vs-text">{NOME[l]}</h2>
            <p className="text-sm text-vs-muted">Desafios usados: {placar.desafios[l]} de {MAX_DESAFIOS}</p>
          </div>
          <button type="button" className={BTN_SECUNDARIO} disabled={placar.desafios[l] >= MAX_DESAFIOS} onClick={() => dispatch({ tipo: 'desafio', lado: l })}>
            Registrar desafio
          </button>
        </div>
      ))}
      <Historico placar={placar} />
    </>
  )
}

export function TelaFechamento() {
  const { placar, dispatch } = useProto()
  const [assinou, setAssinou] = useState<string[]>([])
  const papeis = ['Árbitro principal', 'Capitão do Time Exemplo A', 'Capitão do Time Exemplo B']
  const tudo = assinou.length === papeis.length
  return (
    <>
      <PlacarVisual placar={placar} />
      {!placar.vencedor ? (
        <div className={`${CARTAO} space-y-2`}>
          <p className="text-vs-muted">O jogo ainda não terminou. Para a demonstração, finalize rapidamente:</p>
          <button
            type="button"
            className={BTN_SECUNDARIO}
            onClick={() => {
              for (let i = 0; i < 75; i++) dispatch({ tipo: 'ponto', lado: 'A' })
            }}
          >
            Simular vitória do {TIME_A} por 3 sets a 0
          </button>
        </div>
      ) : (
        <p role="status" className="text-vs-win">Vencedor: {NOME[placar.vencedor]}</p>
      )}
      <section className={`${CARTAO} space-y-2`} aria-label="Assinaturas">
        <h2 className="font-semibold text-vs-text">Assinaturas (simuladas)</h2>
        {papeis.map((p) => (
          <div key={p} className="flex items-center justify-between gap-2">
            <span className="text-vs-text">{p}</span>
            <button type="button" className={BTN_SECUNDARIO} disabled={!placar.vencedor || assinou.includes(p)} onClick={() => setAssinou([...assinou, p])}>
              {assinou.includes(p) ? 'Assinado' : 'Assinar'}
            </button>
          </div>
        ))}
        {tudo ? <p role="status" className="text-vs-win">Súmula fechada (exemplo).</p> : <p className="text-sm text-vs-muted">Disponível quando o jogo terminar.</p>}
      </section>
    </>
  )
}

export function TelaConsulta() {
  const { placar } = useProto()
  return (
    <>
      <p className="rounded-xl border border-vs-border p-3 text-vs-muted">Modo leitura: o árbitro consulta, mas não altera a súmula. Marque pontos no percurso do Apontador.</p>
      <PlacarVisual placar={placar} />
      <QuadraRotacao lado="A" rotacao={placar.rotacao.A} />
      <QuadraRotacao lado="B" rotacao={placar.rotacao.B} />
      <Historico placar={placar} />
    </>
  )
}

export function TelaAoVivo() {
  const { placar } = useProto()
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div ref={ref} className="flex flex-col justify-center gap-4 bg-vs-bg">
      <button
        type="button"
        className={BTN_SECUNDARIO}
        onClick={() => {
          if (document.fullscreenElement) void document.exitFullscreen()
          else void ref.current?.requestFullscreen?.()
        }}
      >
        Tela cheia
      </button>
      <PlacarVisual placar={placar} grande />
      <p className="text-center text-sm text-vs-muted">O placar muda conforme o Apontador marca pontos neste protótipo.</p>
    </div>
  )
}
