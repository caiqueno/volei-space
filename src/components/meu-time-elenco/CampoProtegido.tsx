'use client'

import { useRef, useState } from 'react'
import { Campo, campoEstilo, descreve } from '@/components/meu-time/ui'
import { TEXTO_ALTERAR, TEXTO_MANTER, textoCampoMascarado } from '@/lib/meu-time-elenco-ui/textos'

type Props = {
  id: string
  rotulo: string
  /** Versão mascarada que o servidor devolve. Nunca é colocada dentro do campo. */
  mascara?: string | null
  valor: string
  aoMudar: (valor: string) => void
  /** Aplica a máscara de digitação (CPF, telefone). */
  formatar?: (valor: string) => string
  inputMode?: 'text' | 'numeric' | 'tel' | 'email'
  maxLength?: number
  ajuda?: string
  erro?: string | null
  placeholder?: string
  type?: 'text' | 'email' | 'tel'
}

/**
 * Dado pessoal sensível. Se já existe valor salvo, mostra só a máscara e o botão "Alterar".
 * O campo para digitar um valor novo nasce vazio (o valor em claro nunca volta do servidor).
 */
export function CampoProtegido({ id, rotulo, mascara, valor, aoMudar, formatar, inputMode, maxLength, ajuda, erro, placeholder, type = 'text' }: Props) {
  const [alterando, setAlterando] = useState(false)
  const entrada = useRef<HTMLInputElement>(null)
  const salvo = typeof mascara === 'string' && mascara.trim() !== ''

  if (salvo && !alterando && !erro) {
    return (
      <div className="flex flex-col gap-1.5">
        <span id={`${id}-rotulo`} className="text-sm font-bold">{rotulo}</span>
        <div className="flex min-h-[48px] items-center justify-between gap-3 rounded-xl border border-[var(--vs-border)] bg-[var(--vs-elevated)] px-3 py-1">
          <span aria-labelledby={`${id}-rotulo`} className="font-mono text-base">{textoCampoMascarado(mascara as string)}</span>
          <button
            type="button" aria-label={`${TEXTO_ALTERAR} ${rotulo.toLowerCase()}`}
            onClick={() => { setAlterando(true); setTimeout(() => entrada.current?.focus(), 0) }}
            className="min-h-[44px] px-2 text-sm font-black text-[var(--vs-gold)] underline"
          >
            {TEXTO_ALTERAR}
          </button>
        </div>
      </div>
    )
  }

  return (
    <Campo id={id} rotulo={salvo ? `${rotulo} (novo valor)` : rotulo} ajuda={ajuda} erro={erro}>
      <input
        ref={entrada} id={id} type={type} value={valor} placeholder={placeholder} maxLength={maxLength} inputMode={inputMode} autoComplete="off"
        onChange={(e) => aoMudar(formatar ? formatar(e.target.value) : e.target.value)}
        className={campoEstilo} {...descreve(id, ajuda, erro)}
      />
      {salvo && (
        <button type="button" onClick={() => { aoMudar(''); setAlterando(false) }} className="min-h-[44px] self-start text-sm font-bold underline">
          {TEXTO_MANTER}
        </button>
      )}
    </Campo>
  )
}
