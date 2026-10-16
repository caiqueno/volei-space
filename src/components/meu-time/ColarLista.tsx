'use client'

import { useMemo, useState } from 'react'
import type { MeuTimeClient } from './cliente'
import { Aviso, botaoPrimario, botaoSecundario, Campo, campoEstilo, falhaDe } from './ui'
import { prepararLista, resumirResultadoLote } from '@/lib/meu-time-ui/lista-colada'
import type { Atleta, ResultadoLote } from '@/lib/meu-time-ui/tipos'

type Props = {
  cliente: MeuTimeClient
  equipeId: string
  existentes: Atleta[]
  aoSalvar: () => void
  aoCancelar: () => void
}

const EXEMPLO = 'João Silva, 7\nMaria Souza, 10'

/** Passo 1: colar. Passo 2: conferir. Nada é salvo até o líder confirmar. */
export function ColarLista({ cliente, equipeId, existentes, aoSalvar, aoCancelar }: Props) {
  const [texto, setTexto] = useState('')
  const [conferindo, setConferindo] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoLote | null>(null)
  const preparo = useMemo(() => prepararLista(texto, existentes), [texto, existentes])

  async function salvar() {
    if (salvando || preparo.payload.length === 0) return
    setSalvando(true)
    setMensagem(null)
    try {
      const retorno = await cliente.adicionarAtletasEmLote(equipeId, preparo.payload)
      if (retorno.ignorados.length === 0) {
        aoSalvar()
        return
      }
      setResultado(retorno)
      setSalvando(false)
    } catch (erro) {
      setMensagem(falhaDe(erro).mensagem)
      setSalvando(false)
    }
  }

  if (resultado) {
    return (
      <section aria-labelledby="lista-resultado" className="flex flex-col gap-3 rounded-2xl border border-[var(--vs-border-strong)] bg-[var(--vs-elevated)] p-4">
        <h3 id="lista-resultado" className="text-lg font-black">{resumirResultadoLote(resultado.criados, resultado.ignorados)}</h3>
        <ul className="list-disc pl-5 text-sm">
          {resultado.ignorados.map((item) => <li key={`${item.linha}-${item.motivo}`}>Linha {item.linha}: {item.motivo}</li>)}
        </ul>
        <button type="button" onClick={aoSalvar} className={botaoPrimario}>Ver atletas do time</button>
      </section>
    )
  }

  return (
    <section aria-labelledby="lista-titulo" className="flex flex-col gap-4 rounded-2xl border border-[var(--vs-border-strong)] bg-[var(--vs-elevated)] p-4">
      <h3 id="lista-titulo" className="text-lg font-black">{conferindo ? `Achamos ${preparo.novos.length} ${preparo.novos.length === 1 ? 'atleta' : 'atletas'}` : 'Cole a lista de atletas'}</h3>
      {mensagem && <Aviso tom="is-error" alerta>{mensagem}</Aviso>}

      {!conferindo && (
        <>
          <Campo id="lista-texto" rotulo="Uma pessoa por linha: nome e número da camisa" ajuda="Exemplo: João Silva, 7 e depois, na linha de baixo, Maria Souza, 10">
            <textarea
              id="lista-texto" value={texto} onChange={(e) => setTexto(e.target.value)} rows={8} placeholder={EXEMPLO}
              aria-describedby="lista-texto-ajuda" className={`${campoEstilo} resize-y`}
            />
          </Campo>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" disabled={texto.trim() === ''} onClick={() => setConferindo(true)} className={botaoPrimario}>Conferir lista</button>
            <button type="button" onClick={aoCancelar} className={botaoSecundario}>Cancelar</button>
          </div>
          {texto.trim() === '' && <p className="text-sm text-[var(--vs-muted)]">Cole o texto para liberar o botão Conferir lista.</p>}
        </>
      )}

      {conferindo && (
        <>
          {preparo.novos.length === 0 && (
            <Aviso tom="is-warning">Não encontramos atletas novos nesse texto. Volte e confira se cada linha tem um nome.</Aviso>
          )}
          {preparo.novos.length > 0 && (
            <ul className="divide-y divide-[var(--vs-border)] rounded-xl border border-[var(--vs-border)]" aria-label="Atletas encontrados">
              {preparo.novos.map((a) => (
                <li key={`${a.nome}-${a.numero}`} className="flex min-h-[44px] items-center justify-between gap-3 px-3 py-2">
                  <span className="font-bold">{a.nome}</span>
                  <span className="text-sm text-[var(--vs-muted)]">{a.numero ? `camisa ${a.numero}` : 'sem camisa por enquanto'}</span>
                </li>
              ))}
            </ul>
          )}
          {preparo.semNumero > 0 && <Aviso>{preparo.semNumero} {preparo.semNumero === 1 ? 'atleta ficou' : 'atletas ficaram'} sem camisa. Tudo bem: você escolhe o número na hora de inscrever.</Aviso>}
          {(preparo.repetidos.length > 0 || preparo.ignoradas.length > 0) && (
            <Aviso tom="is-warning">
              <strong className="block">Ficam de fora:</strong>
              <ul className="list-disc pl-5">
                {preparo.repetidos.map((r) => <li key={`r-${r.nome}`}>{r.nome}: {r.motivo.toLowerCase()}</li>)}
                {preparo.ignoradas.map((i) => <li key={`i-${i.linha}`}>Linha {i.linha} ({i.texto}): {i.motivo.toLowerCase()}</li>)}
              </ul>
            </Aviso>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" disabled={salvando || preparo.payload.length === 0} onClick={salvar} className={botaoPrimario}>
              {salvando ? 'Salvando…' : `Salvar ${preparo.payload.length} ${preparo.payload.length === 1 ? 'atleta' : 'atletas'}`}
            </button>
            <button type="button" onClick={() => setConferindo(false)} className={botaoSecundario}>Voltar e corrigir</button>
          </div>
        </>
      )}
    </section>
  )
}
