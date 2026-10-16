'use client'

import { useState, type FormEvent } from 'react'
import type { MeuTimeClient } from './cliente'
import { Campo, campoEstilo, descreve, falhaDe } from './ui'
import { dataNascimentoValida } from '@/lib/meu-time-ui/selecao'
import type { Atleta } from '@/lib/meu-time-ui/tipos'

type Props = { cliente: MeuTimeClient; equipeId: string; atleta: Atleta; aoSalvar: () => Promise<void> }

/** Jeito rápido de completar a pendência "falta nascimento" sem abrir o formulário inteiro. */
export function CompletarNascimento({ cliente, equipeId, atleta, aoSalvar }: Props) {
  const [data, setData] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const id = `nasc-${atleta.id}`

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    if (salvando) return
    if (!dataNascimentoValida(data)) {
      setErro('Informe a data completa (dia, mês e ano).')
      return
    }
    setSalvando(true)
    setErro(null)
    try {
      await cliente.atualizarAtleta(equipeId, atleta.id, { dataNascimento: data })
      await aoSalvar()
    } catch (falha) {
      setErro(falhaDe(falha).mensagem)
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={enviar} noValidate aria-label={`Completar nascimento de ${atleta.nome}`} className="flex flex-col gap-2 rounded-xl border border-[var(--vs-border)] p-3">
      <Campo id={id} rotulo="Falta nascimento: preencha aqui" erro={erro}>
        <input
          id={id} type="date" value={data} max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setData(e.target.value)} className={campoEstilo} {...descreve(id, undefined, erro)}
        />
      </Campo>
      <button type="submit" disabled={salvando} className="min-h-[48px] rounded-xl bg-[var(--vs-gold)] px-4 text-base font-black text-[var(--vs-on-gold)] disabled:opacity-60">
        {salvando ? 'Salvando…' : 'Salvar nascimento'}
      </button>
    </form>
  )
}
