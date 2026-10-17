'use client'

import { useState } from 'react'
import { ehDataValida, ehMenor } from '@/lib/prototipo/planilha'
import { BTN_PRIMARIO, CAMPO, CARTAO } from './Moldura'

// Data fixa para o protótipo ser previsível.
const HOJE_EXEMPLO = '2026-10-17'

export function AbrirConvite() {
  return (
    <div className={`${CARTAO} space-y-2`}>
      <p className="text-vs-muted">Você recebeu um convite de exemplo</p>
      <h2 className="text-xl font-bold text-vs-text">Líder Exemplo convidou você para o Time Exemplo A</h2>
      <p className="text-vs-text">Campeonato Exemplo — categoria Misto Livre.</p>
      <p className="text-sm text-vs-muted">Toque em Próximo para preencher seus dados.</p>
    </div>
  )
}

export function PreencherDados() {
  const [nome, setNome] = useState('')
  const [nasc, setNasc] = useState('')
  const [posicao, setPosicao] = useState('')
  const [tentou, setTentou] = useState(false)
  const [ok, setOk] = useState(false)
  const erroNasc = tentou && !ehDataValida(nasc) ? 'Informe a data no formato AAAA-MM-DD.' : ''
  const erroNome = tentou && !nome.trim() ? 'Informe seu nome.' : ''
  const menor = ehDataValida(nasc) && ehMenor(nasc, HOJE_EXEMPLO)
  return (
    <form
      className={`${CARTAO} space-y-3`}
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        setTentou(true)
        setOk(Boolean(nome.trim()) && ehDataValida(nasc))
      }}
    >
      <div>
        <label htmlFor="a-nome" className="mb-1 block text-sm text-vs-text">Nome completo</label>
        <input id="a-nome" className={CAMPO} value={nome} onChange={(e) => setNome(e.target.value)} aria-invalid={Boolean(erroNome)} />
        {erroNome ? <p role="alert" className="mt-1 text-sm text-vs-loss">{erroNome}</p> : null}
      </div>
      <div>
        <label htmlFor="a-nasc" className="mb-1 block text-sm text-vs-text">Data de nascimento (AAAA-MM-DD)</label>
        <input id="a-nasc" className={CAMPO} inputMode="numeric" placeholder="2008-05-20" value={nasc} onChange={(e) => setNasc(e.target.value)} aria-invalid={Boolean(erroNasc)} />
        {erroNasc ? <p role="alert" className="mt-1 text-sm text-vs-loss">{erroNasc}</p> : null}
      </div>
      <div>
        <label htmlFor="a-pos" className="mb-1 block text-sm text-vs-text">Posição</label>
        <select id="a-pos" className={CAMPO} value={posicao} onChange={(e) => setPosicao(e.target.value)}>
          <option value="">Selecione</option>
          {['Levantador', 'Ponteiro', 'Central', 'Oposto', 'Líbero'].map((p) => <option key={p}>{p}</option>)}
        </select>
      </div>
      {menor ? <p role="status" className="rounded-xl border border-vs-gold p-3 text-vs-text">Você é menor de idade: será necessário um responsável (próximo passo).</p> : null}
      <button type="submit" className={BTN_PRIMARIO}>Enviar dados</button>
      {ok ? <p role="status" className="text-vs-win">Dados enviados (exemplo, nada foi salvo).</p> : null}
    </form>
  )
}

export function AvisoMenor() {
  const [aceito, setAceito] = useState(false)
  return (
    <div className={`${CARTAO} space-y-3`}>
      <h2 className="text-lg font-bold text-vs-gold">Atleta menor de 18 anos</h2>
      <p className="text-vs-text">
        Para atletas menores, o responsável legal precisa autorizar a participação. O atleta fica pendente até a autorização.
      </p>
      <label className="flex min-h-[44px] items-center gap-3 text-vs-text">
        <input type="checkbox" className="h-6 w-6" checked={aceito} onChange={(e) => setAceito(e.target.checked)} />
        Meu responsável (Responsável Exemplo) foi avisado
      </label>
      {aceito ? <p role="status" className="text-vs-win">Pedido de autorização enviado (simulado).</p> : null}
    </div>
  )
}
