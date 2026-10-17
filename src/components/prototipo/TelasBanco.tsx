'use client'

import { ATLETAS_EXEMPLO } from '@/lib/prototipo/exemplo'
import { POSICOES, atribuir, papeletaCompleta } from '@/lib/prototipo/papeleta'
import { BTN_PRIMARIO, BTN_SECUNDARIO, CAMPO, CARTAO } from './Moldura'
import { useProto } from './ProtoContext'
import { Historico } from './PlacarVisual'

export function TelaPapeleta() {
  const { papeleta, setPapeleta } = useProto()
  return (
    <div className={`${CARTAO} space-y-3`}>
      {POSICOES.map((pos, i) => (
        <div key={pos}>
          <label htmlFor={`pos-${pos}`} className="mb-1 block text-sm text-vs-text">Posição {pos}</label>
          <select id={`pos-${pos}`} className={CAMPO} value={papeleta[i] ?? ''} onChange={(e) => setPapeleta(atribuir(papeleta, i, e.target.value || null))}>
            <option value="">Escolher atleta</option>
            {ATLETAS_EXEMPLO.map((a) => (
              <option key={a.id} value={a.id}>{`${a.camisa} - ${a.nome} (${a.posicao})`}</option>
            ))}
          </select>
        </div>
      ))}
      <p className="text-sm text-vs-muted">{papeleta.filter(Boolean).length} de 6 posições preenchidas. Um atleta ocupa só uma posição.</p>
    </div>
  )
}

export function TelaEnviar() {
  const { papeleta, papeletaEnviada, setPapeletaEnviada } = useProto()
  const completa = papeletaCompleta(papeleta)
  return (
    <div className={`${CARTAO} space-y-3`}>
      <ul className="space-y-1 text-vs-text">
        {POSICOES.map((pos, i) => {
          const a = ATLETAS_EXEMPLO.find((x) => x.id === papeleta[i])
          return <li key={pos}>{pos}: {a ? `${a.camisa} - ${a.nome}` : 'vazia'}</li>
        })}
      </ul>
      {!completa ? <p role="alert" className="text-vs-gold">Complete as 6 posições no passo anterior para enviar.</p> : null}
      <button type="button" className={BTN_PRIMARIO} disabled={!completa || papeletaEnviada} onClick={() => setPapeletaEnviada(true)}>
        {papeletaEnviada ? 'Papeleta enviada' : 'Enviar ao apontador'}
      </button>
      {papeletaEnviada ? <p role="status" className="text-vs-win">Enviada ao apontador (simulado).</p> : null}
    </div>
  )
}

export function TelaPedidos() {
  const { placar, dispatch } = useProto()
  const p = placar.pedidoBanco
  return (
    <>
      <div className={`${CARTAO} space-y-3`}>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" className={BTN_SECUNDARIO} disabled={Boolean(p)} onClick={() => dispatch({ tipo: 'pedido', lado: 'A', pedido: 'tempo' })}>Pedir tempo</button>
          <button type="button" className={BTN_SECUNDARIO} disabled={Boolean(p)} onClick={() => dispatch({ tipo: 'pedido', lado: 'A', pedido: 'troca' })}>Pedir troca</button>
        </div>
        <p role="status" className="text-vs-text">
          {p ? `Pedido de ${p.tipo === 'tempo' ? 'tempo' : 'troca'} aguardando o apontador.` : 'Nenhum pedido pendente.'}
        </p>
        {p ? <button type="button" className={BTN_SECUNDARIO} onClick={() => dispatch({ tipo: 'recusar-pedido' })}>Cancelar pedido</button> : null}
      </div>
      <p className="text-sm text-vs-muted">Veja o pedido na tela &quot;Pedido do banco&quot; do Apontador.</p>
      <Historico placar={placar} />
    </>
  )
}
