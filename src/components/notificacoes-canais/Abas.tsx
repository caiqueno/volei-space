'use client'

import { useState } from 'react'
import { Pagina } from '@/components/meu-time/ui'
import { NotificacoesTela } from '@/components/meu-time-fase2/Notificacoes'
import { notificacoesMulticanalAtivo } from '@/lib/notificacoes-canais-ui/regras'
import { PreferenciasTela } from './Preferencias'

type Aba = 'avisos' | 'preferencias'

/** Com a flag desligada devolve exatamente a tela atual, sem a aba de preferências. */
export function NotificacoesComPreferencias() {
  const [aba, setAba] = useState<Aba>('avisos')
  if (!notificacoesMulticanalAtivo()) return <NotificacoesTela />
  const classe = (ativa: boolean) =>
    `inline-flex min-h-[48px] flex-1 items-center justify-center rounded-xl px-3 text-base font-bold ${ativa ? 'bg-[var(--vs-elevated)] text-[var(--vs-gold)] underline' : 'text-[var(--vs-text)] hover:bg-[var(--vs-elevated)]'}`
  return (
    <>
      <div role="tablist" aria-label="Notificações" className="mx-auto flex w-full max-w-xl gap-1 px-4 pt-4">
        <button type="button" role="tab" id="aba-avisos" aria-selected={aba === 'avisos'} aria-controls="painel-avisos" className={classe(aba === 'avisos')} onClick={() => setAba('avisos')}>
          Avisos
        </button>
        <button type="button" role="tab" id="aba-preferencias" aria-selected={aba === 'preferencias'} aria-controls="painel-preferencias" className={classe(aba === 'preferencias')} onClick={() => setAba('preferencias')}>
          Preferências
        </button>
      </div>
      {aba === 'avisos' ? (
        <div role="tabpanel" id="painel-avisos" aria-labelledby="aba-avisos">
          <NotificacoesTela />
        </div>
      ) : (
        <div role="tabpanel" id="painel-preferencias" aria-labelledby="aba-preferencias">
          <Pagina titulo="Como avisar você" voltar={{ href: '/meu-time', texto: 'Voltar aos meus times' }}>
            <PreferenciasTela />
          </Pagina>
        </div>
      )}
    </>
  )
}
