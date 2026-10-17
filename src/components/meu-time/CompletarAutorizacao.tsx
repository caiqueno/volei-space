'use client'

import { useRef, useState, type FormEvent } from 'react'
import type { MeuTimeClient } from './cliente'
import { CamposResponsavel, RESPONSAVEL_VAZIO } from './CamposResponsavel'
import { Aviso, botaoPrimario, botaoSecundario, falhaDe } from './ui'
import { validarResponsavel, type CampoResponsavel, type EntradaResponsavel } from '@/lib/meu-time-ui/responsavel'
import type { Atleta } from '@/lib/meu-time-ui/tipos'

type Props = { cliente: MeuTimeClient; equipeId: string; atleta: Atleta; aoSalvar: () => Promise<void>; aoCancelar: () => void }

/** "Completar agora": registra a autorização do responsável sem abrir o cadastro inteiro. */
export function CompletarAutorizacao({ cliente, equipeId, atleta, aoSalvar, aoCancelar }: Props) {
  const [valor, setValor] = useState<EntradaResponsavel>(RESPONSAVEL_VAZIO)
  const [erros, setErros] = useState<Partial<Record<CampoResponsavel, string>>>({})
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const nomeRef = useRef<HTMLInputElement>(null)

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    if (salvando) return
    const resultado = validarResponsavel(valor)
    setErros(resultado.erros)
    setMensagem(null)
    if (!resultado.valido) {
      nomeRef.current?.focus()
      return
    }
    setSalvando(true)
    try {
      await cliente.registrarConsentimento(equipeId, atleta.id, resultado.dados)
      // O contato digitado sai do estado assim que foi enviado.
      setValor(RESPONSAVEL_VAZIO)
      await aoSalvar()
    } catch (falha) {
      setMensagem(falhaDe(falha).mensagem)
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={enviar} noValidate aria-label={`Completar autorização do responsável de ${atleta.nome}`} className="flex flex-col gap-3">
      {mensagem && <Aviso tom="is-error" alerta>{mensagem}</Aviso>}
      <CamposResponsavel ref={nomeRef} prefixo={`aut-${atleta.id}`} valor={valor} aoMudar={setValor} erros={erros} nomeAtleta={atleta.nome} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="submit" disabled={salvando} className={botaoPrimario}>{salvando ? 'Salvando…' : 'Salvar autorização'}</button>
        <button type="button" onClick={aoCancelar} disabled={salvando} className={botaoSecundario}>Cancelar</button>
      </div>
    </form>
  )
}
