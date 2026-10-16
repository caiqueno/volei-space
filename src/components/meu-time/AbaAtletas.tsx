'use client'

import { useState } from 'react'
import type { MeuTimeClient } from './cliente'
import { Aviso, botaoPerigo, botaoPrimario, botaoSecundario, cartao, falhaDe } from './ui'
import { ColarLista } from './ColarLista'
import { FormAtleta } from './FormAtleta'
import { CompletarNascimento } from './CompletarNascimento'
import { formatarData, rotuloPosicao } from './rotulos'
import { contarSemNascimento, faltaNascimento } from '@/lib/meu-time-ui/selecao'
import { mensagemSemPermissao, podeFazer } from '@/lib/meu-time-ui/permissoes'
import type { Atleta, PapelAcesso } from '@/lib/meu-time-ui/tipos'

type Modo = { tipo: 'lista' } | { tipo: 'novo' } | { tipo: 'colar' } | { tipo: 'editar'; atleta: Atleta }

type Props = {
  cliente: MeuTimeClient
  equipeId: string
  atletas: Atleta[]
  somenteSemDocumento: boolean
  aoMudarFiltro: (valor: boolean) => void
  /** Papel de quem está logado. ASSISTENTE e CAPITAO só olham: o servidor recusa a escrita deles (403). */
  meuPapel?: PapelAcesso
  aoAtualizar: () => Promise<void>
}

export function AbaAtletas({ cliente, equipeId, atletas, somenteSemDocumento, aoMudarFiltro, meuPapel, aoAtualizar }: Props) {
  const podeEditar = podeFazer(meuPapel, 'atletas')
  const [modo, setModo] = useState<Modo>({ tipo: 'lista' })
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [removendo, setRemovendo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const [somenteSemNascimento, setSomenteSemNascimento] = useState(false)
  const semNascimento = contarSemNascimento(atletas)
  const filtroNascimento = somenteSemNascimento && semNascimento > 0
  const visiveis = atletas
    .filter((a) => (somenteSemDocumento ? !a.temDocumento : true))
    .filter((a) => (filtroNascimento ? faltaNascimento(a) : true))

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

  if (podeEditar && modo.tipo === 'novo') return <FormAtleta cliente={cliente} equipeId={equipeId} aoSalvar={concluir} aoCancelar={() => setModo({ tipo: 'lista' })} />
  if (podeEditar && modo.tipo === 'editar') return <FormAtleta cliente={cliente} equipeId={equipeId} atleta={modo.atleta} aoSalvar={concluir} aoCancelar={() => setModo({ tipo: 'lista' })} />
  if (podeEditar && modo.tipo === 'colar') return <ColarLista cliente={cliente} equipeId={equipeId} existentes={atletas} aoSalvar={concluir} aoCancelar={() => setModo({ tipo: 'lista' })} />

  return (
    <div className="flex flex-col gap-4">
      {podeEditar ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={() => setModo({ tipo: 'colar' })} className={botaoPrimario}>Colar lista do WhatsApp</button>
          <button type="button" onClick={() => setModo({ tipo: 'novo' })} className={botaoSecundario}>Adicionar um por um</button>
        </div>
      ) : (
        <Aviso>{mensagemSemPermissao('atletas')} Você pode ver os atletas, mas não alterar.</Aviso>
      )}
      {erro && <Aviso tom="is-error" alerta>{erro}</Aviso>}

      {atletas.length === 0 && (
        <div className={`${cartao} flex flex-col gap-2`}>
          <h3 className="text-lg font-black">Seu time ainda não tem atletas</h3>
          {podeEditar && <p className="text-[var(--vs-muted)]">Cole a lista do WhatsApp e a gente separa nome e camisa. Exemplo: João Silva, 7.</p>}
        </div>
      )}

      {atletas.length > 0 && (
        <label className="flex min-h-[44px] items-center gap-3 text-sm font-bold">
          <input type="checkbox" checked={somenteSemDocumento} onChange={(e) => aoMudarFiltro(e.target.checked)} className="h-5 w-5 accent-[var(--vs-gold)]" />
          Mostrar só quem está sem documento
        </label>
      )}

      {semNascimento > 0 && (
        <Aviso tom="is-warning">
          <strong className="block">{semNascimento} {semNascimento === 1 ? 'atleta está' : 'atletas estão'} sem data de nascimento.</strong>
          Sem ela, a categoria com faixa de idade fica com pendência. Preencha direto no cartão de cada atleta.
          <label className="mt-2 flex min-h-[44px] items-center gap-3 font-bold">
            <input type="checkbox" checked={somenteSemNascimento} onChange={(e) => setSomenteSemNascimento(e.target.checked)} className="h-5 w-5 accent-[var(--vs-gold)]" />
            Mostrar só quem falta nascimento
          </label>
        </Aviso>
      )}

      {atletas.length > 0 && visiveis.length === 0 && <Aviso tom="is-success">Ninguém neste filtro. Desmarque para ver todos.</Aviso>}

      <ul className="flex flex-col gap-2" aria-label="Atletas do time">
        {visiveis.map((atleta) => (
          <li key={atleta.id} className={`${cartao} flex flex-col gap-2`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-black">{atleta.nome}</p>
                <p className="text-sm text-[var(--vs-muted)]">
                  {[atleta.numeroPreferido != null ? `camisa ${atleta.numeroPreferido}` : 'sem camisa', rotuloPosicao(atleta.posicao), atleta.dataNascimento ? formatarData(atleta.dataNascimento) : null].filter(Boolean).join(' · ')}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ${atleta.temDocumento ? 'vs-state is-success' : 'vs-state is-warning'}`}>
                {atleta.temDocumento ? 'Com documento' : 'Sem documento'}
              </span>
            </div>
            {podeEditar && faltaNascimento(atleta) && <CompletarNascimento cliente={cliente} equipeId={equipeId} atleta={atleta} aoSalvar={aoAtualizar} />}
            {!podeEditar ? null : confirmando === atleta.id ? (
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
