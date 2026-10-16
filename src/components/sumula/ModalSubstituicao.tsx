'use client'

import { useState } from 'react'
import { CaixaRegra } from '@/components/sumula/CaixaRegra'
import type { Avaliacao, CaixaRegra as DadosCaixa } from '@/lib/sumula-ui/explicacao'
import type { ModoTroca } from '@/lib/sumula-ui/avaliacao'
import type { DecisaoDoArbitro } from '@/lib/sumula-ui/override'

export type MotivoTela = 'LESAO' | 'EXPULSAO' | 'DESQUALIFICACAO'

export type OpcaoAtleta = { numero: string; rotulo: string; funcao: string }

/** Tudo que o modal precisa; a página monta com o motor (src/lib/sumula-ui). */
export type MotorModal = {
  titulo: string
  equipe: string
  modos: ModoTroca[]
  modoInicial: ModoTroca
  motivoInicial: MotivoTela
  contador: (modo: ModoTroca) => string
  candidatos: (modo: ModoTroca) => OpcaoAtleta[]
  avaliar: (modo: ModoTroca, motivo: MotivoTela, numero: string) => Avaliacao
  confirmar: (modo: ModoTroca, motivo: MotivoTela, numero: string, decisao?: DecisaoDoArbitro) => void
  /** A categoria não ativou "substituição por lesão": o servidor ainda soma a excepcional ao limite. */
  excepcionalContaNoServidor: boolean
  onClose: () => void
}

const ROTULO_MODO: Record<ModoTroca, string> = {
  regular: 'Substituição',
  excepcional: 'Excepcional (lesão, expulsão, desqualificação)',
  libero: 'Troca de líbero',
}

export function ModalSubstituicao({ motor }: { motor: MotorModal }) {
  const [modo, setModo] = useState<ModoTroca>(motor.modoInicial)
  const [motivo, setMotivo] = useState<MotivoTela>(motor.motivoInicial)
  const [caixa, setCaixa] = useState<(DadosCaixa & { numero: string }) | null>(null)
  const [pendente, setPendente] = useState<{ numero: string; avisos: DadosCaixa[] } | null>(null)

  function trocarModo(proximo: ModoTroca) {
    setModo(proximo)
    setCaixa(null)
    setPendente(null)
  }

  function escolher(numero: string) {
    const r = motor.avaliar(modo, motivo, numero)
    if (!r.ok) {
      setPendente(null)
      setCaixa({ ...r.caixa, numero })
      return
    }
    setCaixa(null)
    if (r.avisos.length > 0) {
      setPendente({ numero, avisos: r.avisos })
      return
    }
    motor.confirmar(modo, motivo, numero)
  }

  const opcoes = motor.candidatos(modo)

  return (
    <div className="official-modal" role="dialog" aria-modal="true" aria-label={motor.titulo}>
      <div>
        <h3>{motor.titulo}</h3>
        <p className="official-modal-caption">{motor.equipe}</p>
        {motor.modos.length > 1 ? (
          <div role="tablist" aria-label="Tipo de troca" className="mb-2 flex flex-wrap gap-2">
            {motor.modos.map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={modo === item}
                onClick={() => trocarModo(item)}
                className={`min-h-[44px] flex-1 rounded-md border px-3 text-sm font-semibold ${modo === item ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-300 bg-white text-slate-800'}`}
              >
                {ROTULO_MODO[item]}
              </button>
            ))}
          </div>
        ) : null}
        <p className="official-modal-note" aria-live="polite">{motor.contador(modo)}</p>
        {modo === 'excepcional' ? (
          <>
            <label className="official-modal-note">
              Motivo{' '}
              <select value={motivo} onChange={(event) => { setMotivo(event.target.value as MotivoTela); setCaixa(null); setPendente(null) }} className="min-h-[44px] rounded border px-2">
                <option value="LESAO">Lesão</option>
                <option value="EXPULSAO">Expulsão</option>
                <option value="DESQUALIFICACAO">Desqualificação</option>
              </select>
            </label>
            {motor.excepcionalContaNoServidor ? (
              <p className="official-modal-note">Esta categoria não ativou a substituição por lesão: o servidor ainda soma esta troca ao limite de substituições.</p>
            ) : null}
          </>
        ) : null}
        {caixa ? <CaixaRegra caixa={caixa} onFechar={() => setCaixa(null)} onOverride={(justificativa) => motor.confirmar(modo, motivo, caixa.numero, { codigo: caixa.codigo, justificativa })} className="my-2" /> : null}
        {pendente ? (
          <div className="my-2 space-y-2">
            {pendente.avisos.map((aviso, indice) => <CaixaRegra key={`${aviso.codigo}-${indice}`} caixa={aviso} />)}
            <div className="flex gap-2">
              <button type="button" className="min-h-[44px] flex-1 rounded-md bg-blue-700 px-3 font-semibold text-white" onClick={() => motor.confirmar(modo, motivo, pendente.numero)}>Registrar mesmo assim</button>
              <button type="button" className="min-h-[44px] flex-1 rounded-md border px-3 font-semibold" onClick={() => setPendente(null)}>Voltar</button>
            </div>
          </div>
        ) : null}
        <div>
          {opcoes.map((opcao) => (
            <button key={opcao.numero} type="button" onClick={() => escolher(opcao.numero)}>
              <span>{opcao.rotulo}</span>
              <em>{opcao.funcao}</em>
            </button>
          ))}
          {opcoes.length === 0 ? (
            <p className="official-modal-empty">
              {modo === 'libero' ? 'Esta equipe não tem líbero disponível neste set.' : 'Nenhum atleta disponível para entrar.'}
            </p>
          ) : null}
        </div>
        <button type="button" onClick={motor.onClose}>Voltar</button>
      </div>
    </div>
  )
}
