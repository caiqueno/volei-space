'use client'

import { useState } from 'react'
import { CLASSIFICACAO_EXEMPLO, SUMULAS_EXEMPLO } from '@/lib/prototipo/exemplo'
import { BTN_PRIMARIO, CARTAO } from './Moldura'

export function TelaCompeticao() {
  return (
    <div className={`${CARTAO} space-y-2`}>
      <h2 className="text-xl font-bold text-vs-text">Campeonato Exemplo</h2>
      <p className="text-vs-muted">Vôlei de quadra · 4 times · 1 categoria (Misto Livre)</p>
      <dl className="grid grid-cols-3 gap-2 text-center">
        {[['4', 'Times'], ['6', 'Jogos'], ['3', 'Súmulas']].map(([v, r]) => (
          <div key={r} className="rounded-xl bg-vs-elevated p-3">
            <dt className="text-xs text-vs-muted">{r}</dt>
            <dd className="text-2xl font-bold text-vs-text">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function TelaTabela() {
  return (
    <div className={`${CARTAO} overflow-x-auto`}>
      <table className="w-full text-left text-vs-text">
        <caption className="mb-2 text-left text-sm text-vs-muted">Classificação de exemplo</caption>
        <thead>
          <tr className="text-sm text-vs-muted">
            <th scope="col" className="py-2">Time</th>
            <th scope="col">J</th>
            <th scope="col">V</th>
            <th scope="col">Pts</th>
          </tr>
        </thead>
        <tbody>
          {CLASSIFICACAO_EXEMPLO.map((l) => (
            <tr key={l.time} className="border-t border-vs-border">
              <th scope="row" className="py-3 font-medium">{l.time}</th>
              <td>{l.jogos}</td>
              <td>{l.vitorias}</td>
              <td className="font-bold">{l.pontos}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function TelaSumulas() {
  return (
    <ul className="space-y-2" aria-label="Súmulas de exemplo">
      {SUMULAS_EXEMPLO.map((s) => (
        <li key={s.id} className={`${CARTAO} flex items-center justify-between gap-2`}>
          <span className="text-vs-text">{s.jogo}</span>
          <span className="rounded-full border border-vs-border px-3 py-1 text-sm text-vs-muted">{s.situacao}</span>
        </li>
      ))}
    </ul>
  )
}

export function TelaExportar() {
  const [feito, setFeito] = useState(false)
  return (
    <div className={`${CARTAO} space-y-3`}>
      <p className="text-vs-text">Exporte o scout do campeonato exemplo em planilha (CSV).</p>
      <button type="button" className={BTN_PRIMARIO} onClick={() => setFeito(true)}>Exportar scout (exemplo)</button>
      {feito ? <p role="status" className="text-vs-win">Exportação simulada: nenhum arquivo foi gerado neste protótipo.</p> : null}
    </div>
  )
}
