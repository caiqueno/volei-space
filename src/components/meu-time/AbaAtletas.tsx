'use client'

import { useState } from 'react'
import type { MeuTimeClient } from './cliente'
import { Aviso, botaoPerigo, botaoPrimario, botaoSecundario, cartao, falhaDe } from './ui'
import { ColarLista } from './ColarLista'
import { FormAtleta } from './FormAtleta'
import { formatarData } from './rotulos'
import type { Atleta } from '@/lib/meu-time-ui/tipos'

type Modo = { tipo: 'lista' } | { tipo: 'novo' } | { tipo: 'colar' } | { tipo: 'editar'; atleta: Atleta }

type Props = {
  cliente: MeuTimeClient
  equipeId: string
  atletas: Atleta[]
  somenteSemDocumento: boolean
  aoMudarFiltro: (valor: boolean) => void
  aoAtualizar: () => Promise<void>
}

export function AbaAtletas({ cliente, equipeId, atletas, somenteSemDocumento, aoMudarFiltro, aoAtualizar }: Props) {
  const [modo, setModo] = useState<Modo>({ tipo: 'lista' })
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [removendo, setRemovendo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const visiveis = somenteSemDocumento ? atletas.filter((a) => !a.temDocumento) : atletas

  async function concluir() {
    setModo({ tipo: 'lista' })
    await aoAtualizar()
  }

  async function remover(atleta: Atleta) {
    if (removendo) return
    setRemovendo(true)
    setErro(null)
    try {
      await cliente.removerAtleta(equipeId, atleta.id)
      setConfirmando(null)
      await aoAtualizar()
    } catch (falha) {
      setErro(falhaDe(falha).mensagem)
    } finally {
      setRemovendo(false)
    }
  }

  if (modo.tipo === 'novo') return <FormAtleta cliente={cliente} equipeId={equipeId} aoSalvar={concluir} aoCancelar={() => setModo({ tipo: 'lista' })} />
  if (modo.tipo === 'editar') return <FormAtleta cliente={cliente} equipeId={equipeId} atleta={modo.atleta} aoSalvar={concluir} aoCancelar={() => setModo({ tipo: 'lista' })} />
  if (modo.tipo === 'colar') return <ColarLista cliente={cliente} equipeId={equipeId} existentes={atletas} aoSalvar={concluir} aoCancelar={() => setModo({ tipo: 'lista' })} />

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={() => setModo({ tipo: 'colar' })} className={botaoPrimario}>Colar lista do WhatsApp</button>
        <button type="button" onClick={() => setModo({ tipo: 'novo' })} className={botaoSecundario}>Adicionar um por um</button>
      </div>
      {erro && <Aviso tom="is-error" alerta>{erro}</Aviso>}

      {atletas.length === 0 && (
        <div className={`${cartao} flex flex-col gap-2`}>
          <h3 className="text-lg font-black">Seu time ainda não tem atletas</h3>
          <p className="text-[var(--vs-muted)]">Cole a lista do WhatsApp e a gente separa nome e camisa. Exemplo: João Silva, 7.</p>
        </div>
      )}

      {atletas.length > 0 && (
        <label className="flex min-h-[44px] items-center gap-3 text-sm font-bold">
          <input type="checkbox" checked={somenteSemDocumento} onChange={(e) => aoMudarFiltro(e.target.checked)} className="h-5 w-5 accent-[var(--vs-gold)]" />
          Mostrar só quem está sem documento
        </label>
      )}

      {atletas.length > 0 && visiveis.length === 0 && <Aviso tom="is-success">Ninguém está sem documento. Desmarque o filtro para ver todos.</Aviso>}

      <ul className="flex flex-col gap-2" aria-label="Atletas do time">
        {visiveis.map((atleta) => (
          <li key={atleta.id} className={`${cartao} flex flex-col gap-2`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-black">{atleta.nome}</p>
                <p className="text-sm text-[var(--vs-muted)]">
                  {[atleta.numeroPreferido != null ? `camisa ${atleta.numeroPreferido}` : 'sem camisa', atleta.posicao, atleta.dataNascimento ? formatarData(atleta.dataNascimento) : null].filter(Boolean).join(' · ')}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ${atleta.temDocumento ? 'vs-state is-success' : 'vs-state is-warning'}`}>
                {atleta.temDocumento ? 'Com documento' : 'Sem documento'}
              </span>
            </div>
            {!atleta.dataNascimento && <p className="text-sm font-bold text-[var(--vs-warning-fg)]">Falta a data de nascimento. Toque em Editar para preencher.</p>}
            {confirmando === atleta.id ? (
              <div role="group" aria-label={`Remover ${atleta.nome}?`} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <p className="text-sm font-bold">Remover {atleta.nome} do time?</p>
                <button type="button" disabled={removendo} onClick={() => remover(atleta)} className={botaoPerigo}>{removendo ? 'Removendo…' : 'Remover'}</button>
                <button type="button" onClick={() => setConfirmando(null)} className="min-h-[44px] rounded-xl px-4 text-sm font-bold underline">Cancelar</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button type="button" onClick={() => setModo({ tipo: 'editar', atleta })} className="min-h-[44px] rounded-xl border border-[var(--vs-border-strong)] px-4 text-sm font-bold" aria-label={`Editar ${atleta.nome}`}>Editar</button>
                <button type="button" onClick={() => setConfirmando(atleta.id)} className={botaoPerigo} aria-label={`Remover ${atleta.nome}`}>Remover</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
