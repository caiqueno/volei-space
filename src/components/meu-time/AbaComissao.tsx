'use client'

import { useState, type FormEvent } from 'react'
import type { MeuTimeClient } from './cliente'
import { Aviso, botaoPerigo, botaoPrimario, Campo, campoEstilo, cartao, descreve, falhaDe } from './ui'
import { FUNCOES_COMISSAO, rotuloFuncao } from './rotulos'
import { validarMembroComissao } from '@/lib/meu-time-ui/formularios'
import { MENSAGEM_COMISSAO_INDISPONIVEL } from '@/lib/meu-time-ui/respostas'
import { mensagemSemPermissao, podeFazer } from '@/lib/meu-time-ui/permissoes'
import type { MembroComissao, PapelAcesso } from '@/lib/meu-time-ui/tipos'

type Props = { cliente: MeuTimeClient; equipeId: string; comissao: MembroComissao[]; meuPapel?: PapelAcesso; aoAtualizar: () => Promise<void> }

/** 503 aqui é só a tabela da comissão que falta: o resto do time funciona, então a explicação é própria. */
function textoDaFalha(erro: unknown) {
  const falha = falhaDe(erro)
  return falha.tipo === 'nao-habilitado' ? MENSAGEM_COMISSAO_INDISPONIVEL : falha.mensagem
}

export function AbaComissao({ cliente, equipeId, comissao, meuPapel, aoAtualizar }: Props) {
  const podeEditar = podeFazer(meuPapel, 'comissao')
  const [nome, setNome] = useState('')
  const [funcao, setFuncao] = useState('')
  const [erros, setErros] = useState<Partial<Record<'nome' | 'funcao', string>>>({})
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function adicionar(evento: FormEvent) {
    evento.preventDefault()
    if (ocupado) return
    const resultado = validarMembroComissao({ nome, funcao })
    setErros(resultado.erros)
    setMensagem(null)
    if (!resultado.valido) return
    setOcupado(true)
    try {
      await cliente.adicionarMembroComissao(equipeId, resultado.dados)
      setNome('')
      setFuncao('')
      await aoAtualizar()
    } catch (erro) {
      setMensagem(textoDaFalha(erro))
    } finally {
      setOcupado(false)
    }
  }

  async function remover(membro: MembroComissao) {
    if (ocupado) return
    setOcupado(true)
    setMensagem(null)
    try {
      await cliente.removerMembroComissao(equipeId, membro.id)
      await aoAtualizar()
    } catch (erro) {
      setMensagem(textoDaFalha(erro))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[var(--vs-muted)]">Técnico, auxiliares e quem acompanha o time no banco. É opcional: só entra na inscrição se você quiser.</p>
      {!podeEditar && <Aviso>{mensagemSemPermissao('comissao')} Você pode ver a comissão, mas não alterar.</Aviso>}
      {mensagem && <Aviso tom="is-error" alerta>{mensagem}</Aviso>}
      {comissao.length === 0 && <Aviso>Nenhuma pessoa na comissão técnica ainda.</Aviso>}
      <ul className="flex flex-col gap-2" aria-label="Comissão técnica">
        {comissao.map((membro) => (
          <li key={membro.id} className={`${cartao} flex items-center justify-between gap-3`}>
            <span><strong className="block">{membro.nome}</strong><span className="text-sm text-[var(--vs-muted)]">{rotuloFuncao(membro.funcao)}</span></span>
            {podeEditar && <button type="button" disabled={ocupado} onClick={() => remover(membro)} className={botaoPerigo} aria-label={`Remover ${membro.nome}`}>Remover</button>}
          </li>
        ))}
      </ul>
      {podeEditar && <form onSubmit={adicionar} noValidate aria-label="Adicionar à comissão técnica" className={`${cartao} flex flex-col gap-4`}>
        <h3 className="text-lg font-black">Adicionar pessoa</h3>
        <Campo id="comissao-nome" rotulo="Nome" erro={erros.nome}>
          <input id="comissao-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={100} className={campoEstilo} {...descreve('comissao-nome', undefined, erros.nome)} />
        </Campo>
        <Campo id="comissao-funcao" rotulo="Função" erro={erros.funcao}>
          <select id="comissao-funcao" value={funcao} onChange={(e) => setFuncao(e.target.value)} className={campoEstilo} {...descreve('comissao-funcao', undefined, erros.funcao)}>
            <option value="">Escolha a função</option>
            {FUNCOES_COMISSAO.map((f) => <option key={f.valor} value={f.valor}>{f.rotulo}</option>)}
          </select>
        </Campo>
        <button type="submit" disabled={ocupado} className={botaoPrimario}>{ocupado ? 'Salvando…' : 'Adicionar à comissão'}</button>
      </form>}
    </div>
  )
}
