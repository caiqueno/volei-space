'use client'

import { useState, type FormEvent } from 'react'
import type { MeuTimeClient } from './cliente'
import { Aviso, botaoPerigo, botaoPrimario, Campo, campoEstilo, Carregando, cartao, descreve, falhaDe, FalhaTela, useCarregar } from './ui'
import { PAPEIS_ACESSO } from './rotulos'
import { validarNovoAcesso } from '@/lib/meu-time-ui/formularios'
import type { MembroAcesso, PapelAcesso } from '@/lib/meu-time-ui/tipos'

type Props = {
  cliente: MeuTimeClient
  equipeId: string
  /** Papel de quem está logado, se o servidor informou. Desconhecido: mostramos os botões e o servidor decide (403). */
  meuPapel?: PapelAcesso
}

/** "Quem tem acesso": pessoas com conta que podem mexer no time. Só o RESPONSAVEL convida e remove. */
export function AcessoEquipe({ cliente, equipeId, meuPapel }: Props) {
  const { carga, recarregar, tentarDeNovo } = useCarregar(() => cliente.listarAcesso(equipeId))
  const [email, setEmail] = useState('')
  const [papel, setPapel] = useState('')
  const [erros, setErros] = useState<Partial<Record<'email' | 'papel', string>>>({})
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  if (carga.estado === 'carregando') return <Carregando texto="Carregando quem tem acesso…" />
  if (carga.estado === 'falha') return <FalhaTela falha={carga.falha} aoTentar={tentarDeNovo} />

  const lista = carga.dados
  const papelConhecido = meuPapel ?? lista.find((m) => m.voce)?.papel
  const podeGerir = papelConhecido === undefined || papelConhecido === 'RESPONSAVEL'

  async function convidar(evento: FormEvent) {
    evento.preventDefault()
    if (ocupado) return
    const resultado = validarNovoAcesso({ email, papel })
    setErros(resultado.erros)
    setMensagem(null)
    if (!resultado.valido) return
    setOcupado(true)
    try {
      await cliente.adicionarAcesso(equipeId, resultado.dados)
      setEmail('')
      setPapel('')
      await recarregar()
    } catch (erro) {
      setMensagem(falhaDe(erro).mensagem)
    } finally {
      setOcupado(false)
    }
  }

  async function remover(membro: MembroAcesso) {
    if (ocupado) return
    setOcupado(true)
    setMensagem(null)
    try {
      await cliente.removerAcesso(equipeId, membro.id)
      await recarregar()
    } catch (erro) {
      setMensagem(falhaDe(erro).mensagem)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section aria-labelledby="acesso-titulo" className="flex flex-col gap-3">
      <h3 id="acesso-titulo" className="text-lg font-black">Quem tem acesso</h3>
      <p className="text-sm text-[var(--vs-muted)]">Pessoas com conta no volei.space que podem ver e mexer neste time.</p>
      {mensagem && <Aviso tom="is-error" alerta>{mensagem}</Aviso>}
      <ul className="flex flex-col gap-2" aria-label="Pessoas com acesso ao time">
        {lista.map((membro) => (
          <li key={membro.id} className={`${cartao} flex items-center justify-between gap-3`}>
            <span>
              <strong className="block">{membro.nome}{membro.voce ? ' (você)' : ''}</strong>
              <span className="text-sm text-[var(--vs-muted)]">{PAPEIS_ACESSO[membro.papel] ?? membro.papel}</span>
            </span>
            {podeGerir && membro.papel !== 'RESPONSAVEL' && (
              <button type="button" disabled={ocupado} onClick={() => remover(membro)} className={botaoPerigo} aria-label={`Tirar o acesso de ${membro.nome}`}>Tirar acesso</button>
            )}
          </li>
        ))}
      </ul>
      {podeGerir ? (
        <form onSubmit={convidar} noValidate aria-label="Dar acesso a uma pessoa" className={`${cartao} flex flex-col gap-4`}>
          <h4 className="text-base font-black">Dar acesso a uma pessoa</h4>
          <Campo id="acesso-email" rotulo="E-mail da conta" ajuda="A pessoa precisa já ter conta no volei.space." erro={erros.email}>
            <input id="acesso-email" type="email" inputMode="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} className={campoEstilo} {...descreve('acesso-email', 'A pessoa precisa já ter conta no volei.space.', erros.email)} />
          </Campo>
          <Campo id="acesso-papel" rotulo="O que a pessoa faz" erro={erros.papel}>
            <select id="acesso-papel" value={papel} onChange={(e) => setPapel(e.target.value)} className={campoEstilo} {...descreve('acesso-papel', undefined, erros.papel)}>
              <option value="">Escolha</option>
              <option value="TECNICO">Técnico (mexe em atletas e inscrições)</option>
              <option value="ASSISTENTE">Assistente (só acompanha)</option>
            </select>
          </Campo>
          <button type="submit" disabled={ocupado} className={botaoPrimario}>{ocupado ? 'Salvando…' : 'Dar acesso'}</button>
        </form>
      ) : (
        <Aviso>Só o responsável pelo time dá ou tira acesso.</Aviso>
      )}
    </section>
  )
}
