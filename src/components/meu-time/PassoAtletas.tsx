'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Aviso, botaoPrimario, botaoSecundario, campoEstilo } from './ui'
import {
  alternarAtleta,
  avaliarElegibilidade,
  definirCapitao,
  definirLibero,
  definirNumero,
  podeSelecionar,
  problemasDeEnvio,
  resumirSelecao,
  type Escolha,
  type RegrasInscricao,
} from '@/lib/meu-time-ui/selecao'
import type { Atleta } from '@/lib/meu-time-ui/tipos'

type Props = {
  equipeId: string
  atletas: Atleta[]
  escolhas: Escolha[]
  regras: RegrasInscricao
  aoMudar: (escolhas: Escolha[]) => void
  aoVoltar: () => void
  aoContinuar: () => void
}

/** Escolha de quem joga, com contador fixo no topo e o motivo de cada atleta que não pode entrar. */
export function PassoAtletas({ equipeId, atletas, escolhas, regras, aoMudar, aoVoltar, aoContinuar }: Props) {
  const [tentou, setTentou] = useState(false)
  const resumo = resumirSelecao(escolhas, regras)
  const problemas = problemasDeEnvio(escolhas, atletas, regras)
  const porAtleta = (id: string) => problemas.filter((p) => p.atletaId === id && (tentou || p.codigo === 'repetida' || p.codigo === 'libero-capitao'))
  const globais = problemas.filter((p) => !p.atletaId)

  function continuar() {
    if (problemas.length > 0) {
      setTentou(true)
      requestAnimationFrame(() => document.getElementById('problemas-atletas')?.focus())
      return
    }
    aoContinuar()
  }

  const corContador = resumo.situacao === 'ok' ? 'is-success' : resumo.situacao === 'acima' ? 'is-error' : 'is-warning'

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-0 z-10 -mx-4 border-b border-[var(--vs-border)] bg-[var(--vs-bg)] px-4 py-2">
        <p role="status" className={`vs-state ${corContador} font-black`}>{resumo.texto}</p>
      </div>

      {atletas.length === 0 && (
        <Aviso tom="is-warning">
          Seu time ainda não tem atletas. <Link href={`/meu-time/${encodeURIComponent(equipeId)}`} className="font-black underline">Cadastre os atletas</Link> e volte: o que você já fez aqui fica guardado.
        </Aviso>
      )}

      {tentou && problemas.length > 0 && (
        <div id="problemas-atletas" tabIndex={-1} role="alert" className="vs-state is-error outline-none">
          <strong className="block">Falta resolver antes de continuar:</strong>
          <ul className="list-disc pl-5">
            {problemas.map((p, i) => <li key={`${p.codigo}-${p.atletaId ?? i}`}>{p.mensagem}</li>)}
          </ul>
        </div>
      )}
      {!tentou && globais.length > 0 && resumo.selecionados > 0 && (
        <p className="text-sm text-[var(--vs-muted)]">{globais[0].mensagem}</p>
      )}

      <ul className="flex flex-col gap-3" aria-label="Atletas do time">
        {atletas.map((atleta) => {
          const escolha = escolhas.find((e) => e.atletaId === atleta.id)
          const elegibilidade = avaliarElegibilidade(atleta, regras)
          const apagado = !elegibilidade.elegivel && !escolha
          const erros = escolha ? porAtleta(atleta.id) : []
          const idNumero = `numero-${atleta.id}`
          return (
            <li key={atleta.id} className={`rounded-2xl border p-3 ${escolha ? 'border-[var(--vs-gold)] bg-[var(--vs-elevated)]' : 'border-[var(--vs-border)] bg-[var(--vs-surface)]'}`}>
              <div className={apagado ? 'opacity-70' : undefined}>
                <label className="flex min-h-[52px] cursor-pointer items-center gap-3">
                  <input
                    type="checkbox" checked={Boolean(escolha)} disabled={apagado}
                    onChange={() => aoMudar(alternarAtleta(escolhas, atleta))}
                    className="h-6 w-6 shrink-0 accent-[var(--vs-gold)]"
                    aria-describedby={!elegibilidade.elegivel ? `motivo-${atleta.id}` : undefined}
                  />
                  <span className="text-base font-black">{atleta.nome}</span>
                </label>
                {!elegibilidade.elegivel && (
                  <p id={`motivo-${atleta.id}`} className="pl-9 text-sm text-[var(--vs-warning-fg)]">{elegibilidade.motivo}</p>
                )}
              </div>
              {apagado && !elegibilidade.elegivel && podeSelecionar(elegibilidade, true) && (
                <div className="pl-9 pt-2">
                  <button type="button" onClick={() => aoMudar(alternarAtleta(escolhas, atleta))} className="min-h-[44px] rounded-xl border border-[var(--vs-border-strong)] px-4 text-sm font-bold">
                    Incluir mesmo assim
                  </button>
                </div>
              )}
              {escolha && (
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 pl-9">
                  <div className="flex items-center gap-2">
                    <label htmlFor={idNumero} className="text-sm font-bold">Camisa</label>
                    <input
                      id={idNumero} inputMode="numeric" pattern="[0-9]*" maxLength={2} value={escolha.numero}
                      onChange={(e) => aoMudar(definirNumero(escolhas, atleta.id, e.target.value))}
                      aria-invalid={erros.some((p) => p.codigo === 'numero' || p.codigo === 'repetida') || undefined}
                      className={`${campoEstilo} !w-20 text-center`}
                    />
                  </div>
                  <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm font-bold">
                    <input type="checkbox" checked={escolha.capitao} onChange={() => aoMudar(definirCapitao(escolhas, atleta.id))} className="h-5 w-5 accent-[var(--vs-gold)]" />
                    Capitão
                  </label>
                  <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm font-bold">
                    <input type="checkbox" checked={escolha.libero} onChange={() => aoMudar(definirLibero(escolhas, atleta.id))} className="h-5 w-5 accent-[var(--vs-gold)]" />
                    Líbero
                  </label>
                </div>
              )}
              {erros.map((p) => <p key={p.codigo} role="alert" className="pl-9 pt-1 text-sm font-bold text-[var(--vs-error-fg)]">{p.mensagem}</p>)}
            </li>
          )
        })}
      </ul>

      {atletas.length > 0 && (
        <Link href={`/meu-time/${encodeURIComponent(equipeId)}`} className="inline-flex min-h-[44px] items-center text-sm font-bold text-[var(--vs-gold)] underline">
          Falta alguém? Cadastre o atleta no time (sua escolha fica guardada)
        </Link>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={continuar} className={botaoPrimario}>Continuar</button>
        <button type="button" onClick={aoVoltar} className={botaoSecundario}>Voltar</button>
      </div>
    </div>
  )
}
