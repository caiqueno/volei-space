'use client'

import { useState } from 'react'
import { NOTIFICACOES_EXEMPLO, PLANILHA_EXEMPLO } from '@/lib/prototipo/exemplo'
import { validarPlanilha } from '@/lib/prototipo/planilha'
import { BTN_PRIMARIO, BTN_SECUNDARIO, CAMPO, CARTAO } from './Moldura'

export function CadastrarTime() {
  const [nome, setNome] = useState('')
  const [cidade, setCidade] = useState('')
  const [ok, setOk] = useState(false)
  const [tentou, setTentou] = useState(false)
  const erroNome = tentou && !nome.trim() ? 'Informe o nome do time.' : ''
  return (
    <form
      className={`${CARTAO} space-y-3`}
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        setTentou(true)
        setOk(Boolean(nome.trim()))
      }}
    >
      <div>
        <label htmlFor="p-nome" className="mb-1 block text-sm text-vs-text">Nome do time</label>
        <input id="p-nome" className={CAMPO} value={nome} onChange={(e) => setNome(e.target.value)} aria-invalid={Boolean(erroNome)} aria-describedby={erroNome ? 'p-nome-erro' : undefined} placeholder="Ex.: Time Exemplo A" />
        {erroNome ? <p id="p-nome-erro" role="alert" className="mt-1 text-sm text-vs-loss">{erroNome}</p> : null}
      </div>
      <div>
        <label htmlFor="p-cidade" className="mb-1 block text-sm text-vs-text">Cidade</label>
        <input id="p-cidade" className={CAMPO} value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Cidade de exemplo" />
      </div>
      <button type="submit" className={BTN_PRIMARIO}>Cadastrar time</button>
      {ok ? <p role="status" className="text-vs-win">Time &quot;{nome}&quot; cadastrado (exemplo, nada foi salvo).</p> : null}
    </form>
  )
}

export function ConvidarAtleta() {
  const [gerado, setGerado] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const link = 'https://exemplo.invalid/convite/ABC123'
  return (
    <div className={`${CARTAO} space-y-3`}>
      <p className="text-vs-text">O atleta recebe um link e preenche os próprios dados.</p>
      <button type="button" className={BTN_PRIMARIO} onClick={() => setGerado(true)}>Gerar link de convite</button>
      {gerado ? (
        <div className="space-y-2">
          <p role="status" className="break-all rounded-xl bg-vs-bg p-3 text-vs-text">{link}</p>
          <button type="button" className={BTN_SECUNDARIO} onClick={() => setCopiado(true)}>Copiar link</button>
          {copiado ? <p role="status" className="text-vs-win">Link copiado (simulado). Link fictício, não funciona.</p> : null}
        </div>
      ) : (
        <p className="text-vs-muted">Nenhum link gerado ainda.</p>
      )}
    </div>
  )
}

export function ImportarPlanilha() {
  const [previa, setPrevia] = useState(false)
  const [confirmado, setConfirmado] = useState(false)
  const linhas = validarPlanilha(PLANILHA_EXEMPLO)
  const comErro = linhas.filter((l) => l.erros.length > 0)
  return (
    <div className="space-y-3">
      <div className={CARTAO}>
        <p className="mb-2 text-vs-text">Planilha de exemplo (nome;nascimento;camisa):</p>
        <pre className="overflow-x-auto rounded-xl bg-vs-bg p-3 text-xs text-vs-muted">{PLANILHA_EXEMPLO}</pre>
        <button type="button" className={`${BTN_PRIMARIO} mt-3`} onClick={() => { setPrevia(true); setConfirmado(false) }}>
          Ver prévia
        </button>
      </div>
      {previa ? (
        <section className={CARTAO} aria-label="Prévia da importação">
          <p role="status" className="mb-2 font-semibold text-vs-text">
            {linhas.length - comErro.length} linhas válidas, {comErro.length} com erro
          </p>
          <ul className="space-y-2">
            {linhas.map((l) => (
              <li key={l.linha} className={`rounded-xl border p-3 text-sm ${l.erros.length ? 'border-vs-loss' : 'border-vs-border'}`}>
                <span className="text-vs-text">Linha {l.linha}: {l.nome || '(sem nome)'}</span>
                {l.erros.length ? (
                  <ul className="mt-1 list-disc pl-5 text-vs-loss">
                    {l.erros.map((e) => <li key={e}>{e}</li>)}
                  </ul>
                ) : (
                  <span className="ml-2 text-vs-win">OK</span>
                )}
              </li>
            ))}
          </ul>
          <button type="button" className={`${BTN_PRIMARIO} mt-3`} disabled={comErro.length > 0} onClick={() => setConfirmado(true)}>
            Confirmar importação
          </button>
          {comErro.length > 0 ? <p className="mt-2 text-sm text-vs-muted">Corrija os erros na planilha para liberar a importação.</p> : null}
          {confirmado ? <p role="status" className="mt-2 text-vs-win">Importado (exemplo).</p> : null}
        </section>
      ) : null}
    </div>
  )
}

export function Notificacoes() {
  const [lidas, setLidas] = useState<string[]>([])
  return (
    <ul className="space-y-2" aria-label="Notificações de exemplo">
      {NOTIFICACOES_EXEMPLO.map((n) => {
        const lida = lidas.includes(n.id)
        return (
          <li key={n.id} className={`${CARTAO} flex items-center justify-between gap-3`}>
            <div>
              <p className={lida ? 'text-vs-muted' : 'font-semibold text-vs-text'}>{n.texto}</p>
              <p className="text-sm text-vs-muted">{n.quando}</p>
            </div>
            <button type="button" className={BTN_SECUNDARIO} disabled={lida} onClick={() => setLidas([...lidas, n.id])}>
              {lida ? 'Lida' : 'Marcar como lida'}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
