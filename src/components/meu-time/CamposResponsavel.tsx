'use client'

import { forwardRef } from 'react'
import { Campo, campoEstilo, descreve } from './ui'
import { TERMO_RESPONSAVEL } from '@/lib/meu-time-ui/termo-responsavel'
import type { CampoResponsavel, EntradaResponsavel } from '@/lib/meu-time-ui/responsavel'

type Props = {
  /** Prefixo dos ids (um por atleta, para não repetir na página). */
  prefixo: string
  valor: EntradaResponsavel
  aoMudar: (valor: EntradaResponsavel) => void
  erros: Partial<Record<CampoResponsavel, string>>
  /** Nome de quem é menor, para a explicação. */
  nomeAtleta?: string
}

/**
 * Nome, contato e aceite do responsável legal de atleta menor de 18 anos.
 * O contato só é digitado aqui e enviado ao servidor; depois de salvo, ele nunca volta para a tela.
 */
export const CamposResponsavel = forwardRef<HTMLInputElement, Props>(function CamposResponsavel({ prefixo, valor, aoMudar, erros, nomeAtleta }, refNome) {
  const idNome = `${prefixo}-resp-nome`
  const idContato = `${prefixo}-resp-contato`
  const idAceite = `${prefixo}-resp-aceite`
  const idTermo = `${prefixo}-resp-termo`
  const ajudaContato = 'Telefone com DDD ou e-mail. Só usamos para registrar a autorização e não aparece mais depois de salvo.'
  return (
    <fieldset className="flex flex-col gap-3 rounded-xl border border-[var(--vs-border-strong)] p-3">
      <legend className="px-1 text-base font-black">Responsável legal</legend>
      <p className="text-sm text-[var(--vs-muted)]">
        {nomeAtleta ? `${nomeAtleta} tem menos de 18 anos` : 'Esta pessoa tem menos de 18 anos'}. Precisamos do nome e do contato de um responsável e da autorização dele.
      </p>
      <Campo id={idNome} rotulo="Nome do responsável" erro={erros.nome}>
        <input
          ref={refNome} id={idNome} value={valor.nome} onChange={(e) => aoMudar({ ...valor, nome: e.target.value })}
          autoComplete="off" maxLength={100} className={campoEstilo} {...descreve(idNome, undefined, erros.nome)}
        />
      </Campo>
      <Campo id={idContato} rotulo="Telefone ou e-mail do responsável" ajuda={ajudaContato} erro={erros.contato}>
        <input
          id={idContato} value={valor.contato} onChange={(e) => aoMudar({ ...valor, contato: e.target.value })}
          autoComplete="off" inputMode="email" maxLength={120} className={campoEstilo} {...descreve(idContato, ajudaContato, erros.contato)}
        />
      </Campo>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={idAceite} className="flex min-h-[44px] cursor-pointer items-start gap-3">
          <input
            id={idAceite} type="checkbox" checked={valor.aceite} onChange={(e) => aoMudar({ ...valor, aceite: e.target.checked })}
            className="mt-1 h-6 w-6 shrink-0 accent-[var(--vs-gold)]" aria-describedby={`${idTermo}${erros.aceite ? ` ${idAceite}-erro` : ''}`}
            aria-invalid={erros.aceite ? true : undefined}
          />
          <span id={idTermo} className="text-sm">{TERMO_RESPONSAVEL}</span>
        </label>
        {erros.aceite && <p id={`${idAceite}-erro`} role="alert" className="text-sm font-bold text-[var(--vs-error-fg)]">{erros.aceite}</p>}
      </div>
    </fieldset>
  )
})

export const RESPONSAVEL_VAZIO: EntradaResponsavel = { nome: '', contato: '', aceite: false }
