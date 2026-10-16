import type { ReactNode } from 'react'
import { NAO_REGISTRADO, textoDuracao } from '@/lib/sumula-impressa/montar'
import { avisoDeOverrides } from '@/lib/sumula-ui/override'
import type {
  EquipeImpressa,
  EventoImpresso,
  ModeloImpressao,
  PosicaoFormacao,
  SetImpresso,
} from '@/lib/sumula-impressa/tipos'
import { ESTILOS_SUMULA_IMPRESSA } from './estilos'

function Ausente({ children }: { children?: ReactNode }) {
  return <p className="si-ausente">{children ?? `Dado ${NAO_REGISTRADO}.`}</p>
}

function Relacao({ equipe }: { equipe: EquipeImpressa }) {
  return (
    <article>
      <h3>Equipe {equipe.lado}: {equipe.nome}</h3>
      {equipe.atletas.length ? (
        <table>
          <thead><tr><th className="si-num">Nº</th><th>Atleta</th><th>Marca</th></tr></thead>
          <tbody>
            {equipe.atletas.map((a) => (
              <tr key={a.jogadorId}>
                <td className="si-num">{a.camisa || '—'}</td>
                <td className={a.capitao ? 'si-cap' : undefined}>{a.nome}</td>
                <td>{[a.capitao ? 'Capitão (C)' : '', a.libero ? 'Líbero (L)' : ''].filter(Boolean).join(' · ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="si-vazio">Nenhum atleta confirmado.</p>}
      {equipe.atletas.some((a) => a.capitao) ? null : <p className="si-vazio">Capitão: {NAO_REGISTRADO}.</p>}
    </article>
  )
}

function Formacao({ titulo, formacao }: { titulo: string; formacao: PosicaoFormacao[] | null }) {
  if (!formacao) return <p className="si-vazio">{titulo}: formação inicial {NAO_REGISTRADO}.</p>
  return (
    <table aria-label={`Formação inicial ${titulo}`}>
      <thead><tr><th colSpan={6}>Formação inicial: {titulo}</th></tr><tr>{formacao.map((p) => <th key={p.posicao} className="si-num">{p.posicao}</th>)}</tr></thead>
      <tbody><tr>{formacao.map((p) => <td key={p.posicao} className="si-num">{p.camisa || '—'}</td>)}</tr></tbody>
    </table>
  )
}

/** Marca na linha o que foi registrado por decisão do árbitro, fora do motor de regras. */
function Decisao({ e }: { e: EventoImpresso }) {
  return e.decisaoArbitro ? <strong className="si-decisao"> [DECISÃO DO ÁRBITRO — {e.decisaoArbitro}]</strong> : null
}

function Eventos({ itens, vazio }: { itens: EventoImpresso[]; vazio: string }) {
  if (!itens.length) return <p className="si-vazio">{vazio}</p>
  return (
    <table>
      <thead><tr><th>Hora</th><th>Placar</th><th>Registro</th></tr></thead>
      <tbody>{itens.map((e) => <tr key={e.id}><td>{e.hora || '—'}</td><td className="si-num">{e.placar || '—'}</td><td>{e.texto}<Decisao e={e} /></td></tr>)}</tbody>
    </table>
  )
}

function BlocoSet({ s, m }: { s: SetImpresso; m: ModeloImpressao }) {
  const nome = (lado: 'A' | 'B' | null) => (lado === 'A' ? m.equipeA.nome : lado === 'B' ? m.equipeB.nome : null)
  return (
    <section className="si-set" aria-label={`Set ${s.numero}`}>
      <div className="si-set-topo">
        <span>{s.numero}º set</span>
        <span>{m.equipeA.nome} {s.pontosA} × {s.pontosB} {m.equipeB.nome}</span>
        <span>Saque inicial: {nome(s.sacador) ?? NAO_REGISTRADO}</span>
      </div>
      <div className="si-duas">
        <Formacao titulo={m.equipeA.nome} formacao={s.formacaoA} />
        <Formacao titulo={m.equipeB.nome} formacao={s.formacaoB} />
      </div>
      <p>
        Líbero inicial: {m.equipeA.nome} <strong className="si-lib">{s.liberoA ?? 'nenhum'}</strong> · {m.equipeB.nome} <strong className="si-lib">{s.liberoB ?? 'nenhum'}</strong>
      </p>
      <p>Início: {s.inicio ?? NAO_REGISTRADO} · Fim: {s.fim ?? NAO_REGISTRADO} · Duração: {textoDuracao(s.duracaoMin)}</p>
      <h3>Tempos (A: {s.tempoA} · B: {s.tempoB})</h3>
      <Eventos itens={s.tempos} vazio="Nenhum tempo registrado neste set." />
      <h3>Substituições e trocas de líbero (regulares A: {s.substA} · B: {s.substB})</h3>
      <Eventos itens={s.substituicoes} vazio="Nenhuma substituição registrada neste set." />
      <Ausente>Rodízio e sacador ponto a ponto: {NAO_REGISTRADO}.</Ausente>
    </section>
  )
}

export function SumulaImpressa({ modelo: m, aoImprimir }: { modelo: ModeloImpressao; aoImprimir: () => void }) {
  return (
    <div className="si-tela">
      <style dangerouslySetInnerHTML={{ __html: ESTILOS_SUMULA_IMPRESSA }} />
      <div className="si-barra si-nao-imprimir">
        <p>Use &quot;Imprimir / salvar PDF&quot; e, na janela do navegador, escolha &quot;Salvar como PDF&quot; em papel A4.</p>
        <button type="button" className="si-botao" onClick={aoImprimir}>Imprimir / salvar PDF</button>
      </div>

      <main className="si-folha">
        <h1>Súmula oficial de vôlei</h1>
        <dl className="si-cab">
          <div><dt>Campeonato</dt><dd>{m.campeonato}</dd></div>
          <div><dt>Categoria</dt><dd>{m.categoria}</dd></div>
          <div><dt>Fase</dt><dd>{m.fase}</dd></div>
          <div><dt>Data</dt><dd>{m.data}</dd></div>
          <div><dt>Local</dt><dd>{m.local}</dd></div>
          <div><dt>Árbitros</dt><dd>{m.arbitros.length ? m.arbitros.map((a) => `${a.cargo}: ${a.nome}`).join(' · ') : 'Não registrados'}</dd></div>
          <div><dt>Equipe A</dt><dd>{m.equipeA.nome}</dd></div>
          <div><dt>Equipe B</dt><dd>{m.equipeB.nome}</dd></div>
        </dl>

        <h2>Relação nominal</h2>
        <div className="si-duas">
          <Relacao equipe={m.equipeA} />
          <Relacao equipe={m.equipeB} />
        </div>

        <h2>Sets</h2>
        {m.sets.length ? m.sets.map((s) => <BlocoSet key={s.numero} s={s} m={m} />) : <p className="si-vazio">Nenhum set registrado.</p>}

        <h2>Sanções</h2>
        {m.sancoes.length ? (
          <table>
            <thead><tr><th>Set</th><th>Hora</th><th>Placar</th><th>Equipe</th><th>Registro</th></tr></thead>
            <tbody>
              {m.sancoes.map((e) => (
                <tr key={e.id}>
                  <td className="si-num">{e.set ?? '—'}</td><td>{e.hora || '—'}</td><td className="si-num">{e.placar || '—'}</td>
                  <td>{e.lado === 'A' ? m.equipeA.nome : e.lado === 'B' ? m.equipeB.nome : '—'}</td><td>{e.texto}<Decisao e={e} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="si-vazio">Nenhuma sanção registrada.</p>}

        <h2>Observações</h2>
        {m.observacoes.length ? (
          <table>
            <thead><tr><th>Set</th><th>Hora</th><th>Placar</th><th>Registro</th></tr></thead>
            <tbody>{m.observacoes.map((e) => <tr key={e.id}><td className="si-num">{e.set ?? '—'}</td><td>{e.hora || '—'}</td><td className="si-num">{e.placar || '—'}</td><td>{e.texto}<Decisao e={e} /></td></tr>)}</tbody>
          </table>
        ) : <p className="si-vazio">Nenhuma observação registrada.</p>}

        {m.decisoesDoArbitro.length ? (
          <>
            <h2>Registros por decisão do árbitro</h2>
            <p className="si-aviso" role="note">{avisoDeOverrides(m.decisoesDoArbitro.length)}</p>
            <table>
              <thead><tr><th>Set</th><th>Hora</th><th>Placar</th><th>Registro</th><th>Regra e justificativa</th></tr></thead>
              <tbody>{m.decisoesDoArbitro.map((e) => <tr key={e.id}><td className="si-num">{e.set ?? '—'}</td><td>{e.hora || '—'}</td><td className="si-num">{e.placar || '—'}</td><td>{e.texto}</td><td>{e.decisaoArbitro}</td></tr>)}</tbody>
            </table>
          </>
        ) : null}

        <h2>Folha de controle de líbero</h2>
        <Ausente>Folha de controle de líbero (saídas e entradas por jogada): {NAO_REGISTRADO}. A troca de líbero aparece nas substituições de cada set.</Ausente>

        <h2>Súmula anexa (cancelamento de pontos)</h2>
        <Ausente>Súmula anexa: {NAO_REGISTRADO}.</Ausente>

        <h2>Quadro de resultados</h2>
        <table>
          <thead>
            <tr><th>Set</th><th>{m.equipeA.nome}: pontos</th><th>Tempos</th><th>Subst.</th><th>{m.equipeB.nome}: pontos</th><th>Tempos</th><th>Subst.</th><th>Duração</th></tr>
          </thead>
          <tbody>
            {m.sets.map((s) => (
              <tr key={s.numero}>
                <td className="si-num">{s.numero}</td><td className="si-num">{s.pontosA}</td><td className="si-num">{s.tempoA}</td><td className="si-num">{s.substA}</td>
                <td className="si-num">{s.pontosB}</td><td className="si-num">{s.tempoB}</td><td className="si-num">{s.substB}</td><td>{textoDuracao(s.duracaoMin)}</td>
              </tr>
            ))}
            <tr>
              <th>Total</th>
              <th className="si-num">{m.totalPontosA}</th><th className="si-num">{m.sets.reduce((t, s) => t + s.tempoA, 0)}</th><th className="si-num">{m.sets.reduce((t, s) => t + s.substA, 0)}</th>
              <th className="si-num">{m.totalPontosB}</th><th className="si-num">{m.sets.reduce((t, s) => t + s.tempoB, 0)}</th><th className="si-num">{m.sets.reduce((t, s) => t + s.substB, 0)}</th>
              <th>{textoDuracao(m.duracaoTotalMin)}</th>
            </tr>
            <tr><th>Sets</th><th className="si-num">{m.setsA}</th><td colSpan={2} /><th className="si-num">{m.setsB}</th><td colSpan={3} /></tr>
          </tbody>
        </table>

        <h2>Resultado final</h2>
        <p className="si-resultado">{m.equipeA.nome} {m.setsA} × {m.setsB} {m.equipeB.nome}</p>
        <p>Vencedor: <strong>{m.vencedor ?? 'não registrado'}</strong></p>
        <p>MVP: <strong>{m.mvp.length ? m.mvp.join(', ') : 'não registrado'}</strong></p>

        <div className="si-assin">
          <div>Apontador</div>
          <div>Capitão {m.equipeA.nome}</div>
          <div>Capitão {m.equipeB.nome}</div>
          <div>1º árbitro</div>
          <div>2º árbitro</div>
          <div>Delegado / organização</div>
        </div>
        <p className="si-rodape">Documento gerado pelo volei.space a partir da súmula digital. {m.encerrada ? '' : 'Partida sem vencedor registrado: documento parcial. '}Valem as assinaturas manuscritas na versão impressa.</p>
      </main>
    </div>
  )
}
