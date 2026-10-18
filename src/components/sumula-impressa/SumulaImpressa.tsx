import type { ReactNode } from 'react'
import { NAO_REGISTRADO, textoDuracao } from '@/lib/sumula-impressa/montar'
import { TITULO_EVENTOS_NAO_APLICADOS } from '@/lib/sumula-impressa/motor'
import { CAPACIDADE_PAGINA, paginarLinhas, pontosDaSumulaAnexa, type LinhaEvento, type LinhaPonto, type LinhaSancao, type SetMotor } from '@/lib/sumula-impressa/motor'
import { avisoDeOverrides } from '@/lib/sumula-ui/override'
import type {
  EquipeImpressa,
  EventoImpresso,
  ModeloImpressao,
  PosicaoFormacao,
  SetImpresso,
} from '@/lib/sumula-impressa/tipos'
import { ESTILOS_SUMULA_IMPRESSA } from './estilos'

const POSICOES = ['I', 'II', 'III', 'IV', 'V', 'VI'] as const

function Ausente({ children }: { children?: ReactNode }) {
  return <p className="si-ausente">{children ?? `Dado ${NAO_REGISTRADO}.`}</p>
}

function Rolagem({ children }: { children: ReactNode }) {
  return <div className="si-rolagem">{children}</div>
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
                <td className={a.capitao ? 'si-cap' : undefined}>{a.nomeImpresso || a.nome}</td>
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
    <Rolagem>
      <table>
        <thead><tr><th>Hora</th><th>Placar</th><th>Registro</th></tr></thead>
        <tbody>{itens.map((e) => <tr key={e.id}><td>{e.hora || '—'}</td><td className="si-num">{e.placar || '—'}</td><td>{e.texto}<Decisao e={e} /></td></tr>)}</tbody>
      </table>
    </Rolagem>
  )
}

/* ------------------------- quadro de pontos (motor) ------------------------ */

function CelulaPosicao({ numero, saca }: { numero: number | undefined; saca: boolean }) {
  if (!saca) return <td className="si-num">{numero ?? '—'}</td>
  // Sacador: negrito, moldura e a letra S (não depende de cor, para sair bem em impressão preto e branco).
  return <td className="si-num si-saque" aria-label={`Sacador, nº ${numero ?? 'não registrado'}`}><strong>{numero ?? '—'}</strong><span aria-hidden="true"> S</span></td>
}

function QuadroDePontos({ pontos, m, titulo }: { pontos: LinhaPonto[]; m: ModeloImpressao; titulo: string }) {
  if (!pontos.length) return <p className="si-vazio">{titulo}: nenhum ponto registrado.</p>
  return (
    <Rolagem>
      <table className="si-quadro" aria-label={titulo}>
        <thead>
          <tr>
            <th rowSpan={2} className="si-num">Nº</th>
            <th rowSpan={2} className="si-num">{m.equipeA.nome} × {m.equipeB.nome}</th>
            <th rowSpan={2} className="si-num">Ponto</th>
            <th colSpan={6} className="si-num">{m.equipeA.nome} (A)</th>
            <th colSpan={6} className="si-num">{m.equipeB.nome} (B)</th>
          </tr>
          <tr>
            {POSICOES.map((p) => <th key={`a${p}`} className="si-num">{p}</th>)}
            {POSICOES.map((p) => <th key={`b${p}`} className="si-num">{p}</th>)}
          </tr>
        </thead>
        <tbody>
          {pontos.map((p) => (
            <tr key={p.seq} className={p.cancelado ? 'si-cancelado' : undefined}>
              <td className="si-num">{p.ordem}</td>
              <td className="si-num">{p.cancelado ? 'CANCELADO' : `${p.placarA} × ${p.placarB}`}</td>
              <td className="si-num">{p.equipe}</td>
              {POSICOES.map((pos, i) => <CelulaPosicao key={`a${pos}`} numero={p.formacaoA[i]} saca={p.sacador === 'A' && i === 0} />)}
              {POSICOES.map((pos, i) => <CelulaPosicao key={`b${pos}`} numero={p.formacaoB[i]} saca={p.sacador === 'B' && i === 0} />)}
            </tr>
          ))}
        </tbody>
      </table>
    </Rolagem>
  )
}

function textoEvento(e: LinhaEvento, m: ModeloImpressao) {
  const nome = e.equipe === 'A' ? m.equipeA.nome : m.equipeB.nome
  if (e.tipo === 'TEMPO') return `${e.ordem}º tempo — ${nome}`
  const excepcional = e.tipo === 'SUBSTITUICAO_EXCEPCIONAL' ? ' (excepcional)' : ''
  return `${e.ordem}ª substituição${excepcional} — ${nome}: sai nº ${e.sai ?? '—'}, entra nº ${e.entra ?? '—'}${e.motivo ? ` (${e.motivo})` : ''}`
}

function EventosDoMotor({ itens, m, vazio }: { itens: LinhaEvento[]; m: ModeloImpressao; vazio: string }) {
  if (!itens.length) return <p className="si-vazio">{vazio}</p>
  return (
    <Rolagem>
      <table>
        <thead><tr><th>Placar (equipe que pediu primeiro)</th><th>Registro</th></tr></thead>
        <tbody>{itens.map((e, i) => <tr key={`${e.seq}-${i}`}><td className="si-num">{e.placar}</td><td>{textoEvento(e, m)}</td></tr>)}</tbody>
      </table>
    </Rolagem>
  )
}

function SubstituicoesDoSet({ motor, m, s }: { motor: SetMotor; m: ModeloImpressao; s: SetImpresso }) {
  const { principal, anexo } = paginarLinhas(motor.eventos, CAPACIDADE_PAGINA.eventosDoSet)
  if (motor.quadros) {
    // RG-FOR-011: set decisivo, tempos e substituições lançados nos quadros da esquerda e da direita.
    return (
      <>
        <h3>Tempos e substituições no set decisivo (A: {s.tempoA}/{s.substA} · B: {s.tempoB}/{s.substB})</h3>
        <div className="si-tres">
          <section aria-label="Quadro da esquerda"><h4>Quadro da esquerda (até a troca de lado)</h4><EventosDoMotor itens={motor.quadros.esquerda} m={m} vazio="Nenhum registro." /></section>
          <section aria-label="Quadro central"><h4>Quadro central</h4><p>Pontos e rodízio no quadro abaixo.{motor.trocaDeLadoPlacar ? ` Troca de lado em ${motor.trocaDeLadoPlacar}.` : ''}</p></section>
          <section aria-label="Quadro da direita"><h4>Quadro da direita (após a troca de lado)</h4><EventosDoMotor itens={motor.quadros.direita} m={m} vazio="Nenhum registro." /></section>
        </div>
      </>
    )
  }
  return (
    <>
      <h3>Tempos e substituições em ordem (tempos A: {s.tempoA} · B: {s.tempoB} / subst. A: {s.substA} · B: {s.substB})</h3>
      <EventosDoMotor itens={principal} m={m} vazio="Nenhum tempo ou substituição registrado neste set." />
      {anexo.length ? <p className="si-vazio">Continua na súmula anexa ({anexo.length} registro{anexo.length > 1 ? 's' : ''}).</p> : null}
    </>
  )
}

function BlocoSet({ s, m }: { s: SetImpresso; m: ModeloImpressao }) {
  const nome = (lado: 'A' | 'B' | null) => (lado === 'A' ? m.equipeA.nome : lado === 'B' ? m.equipeB.nome : null)
  const motor = m.motor?.sets.find((x) => x.numero === s.numero) ?? null
  return (
    <section className="si-set si-nova-pagina" aria-label={`Set ${s.numero}`}>
      <div className="si-set-topo">
        <span>{s.numero}º set</span>
        <span>{m.equipeA.nome} {s.pontosA} × {s.pontosB} {m.equipeB.nome}</span>
        <span>Saque inicial: {nome(s.sacador) ?? (motor ? nome(motor.sacouPrimeiro) : null) ?? NAO_REGISTRADO}</span>
      </div>
      <div className="si-duas">
        <Formacao titulo={m.equipeA.nome} formacao={s.formacaoA} />
        <Formacao titulo={m.equipeB.nome} formacao={s.formacaoB} />
      </div>
      <p>
        Líbero inicial: {m.equipeA.nome} <strong className="si-lib">{s.liberoA ?? 'nenhum'}</strong> · {m.equipeB.nome} <strong className="si-lib">{s.liberoB ?? 'nenhum'}</strong>
      </p>
      <p>Início: {s.inicio ?? NAO_REGISTRADO} · Fim: {s.fim ?? NAO_REGISTRADO} · Duração: {textoDuracao(s.duracaoMin)}</p>
      {motor ? (
        <>
          <h3>Quadro de pontos e rodízio (posições I a VI; sacador marcado com S)</h3>
          <QuadroDePontos pontos={motor.pontos} m={m} titulo={`Pontos do ${s.numero}º set`} />
          {motor.temCancelamento ? <p className="si-aviso" role="note">Pontos cancelados neste set. SEGUE SÚMULA ANEXA.</p> : null}
          <SubstituicoesDoSet motor={motor} m={m} s={s} />
        </>
      ) : (
        <>
          <h3>Tempos (A: {s.tempoA} · B: {s.tempoB})</h3>
          <Eventos itens={s.tempos} vazio="Nenhum tempo registrado neste set." />
          <h3>Substituições e trocas de líbero (regulares A: {s.substA} · B: {s.substB})</h3>
          <Eventos itens={s.substituicoes} vazio="Nenhuma substituição registrada neste set." />
          <Ausente>Rodízio e sacador ponto a ponto: {NAO_REGISTRADO} (a leitura não trouxe o log de eventos da súmula).</Ausente>
        </>
      )}
    </section>
  )
}

/* -------------------------------- sanções --------------------------------- */

function TabelaSancoesMotor({ itens, m }: { itens: LinhaSancao[]; m: ModeloImpressao }) {
  const marca = (l: LinhaSancao, coluna: 'A' | 'P' | 'E' | 'D') => (l.coluna === coluna ? 'X' : '')
  return (
    <Rolagem>
      <table aria-label="Quadro de sanções">
        <thead>
          <tr><th>Set</th><th>Equipe</th><th>Membro</th><th>Motivo</th><th>Sanção</th><th className="si-num" title="Advertência">A</th><th className="si-num" title="Penalidade">P</th><th className="si-num" title="Expulsão">E</th><th className="si-num" title="Desqualificação">D</th><th>Placar</th><th>Ponto ao adversário</th></tr>
        </thead>
        <tbody>
          {itens.map((l) => (
            <tr key={l.seq}>
              <td className="si-num">{l.numeroSet}</td>
              <td>{l.equipe === 'A' ? m.equipeA.nome : m.equipeB.nome}</td>
              <td>{l.membro}</td>
              <td>{l.categoria}</td>
              <td>{l.sancao}</td>
              <td className="si-num">{marca(l, 'A')}</td><td className="si-num">{marca(l, 'P')}</td><td className="si-num">{marca(l, 'E')}</td><td className="si-num">{marca(l, 'D')}</td>
              <td className="si-num">{l.placar}</td>
              <td className="si-num">{l.pontoParaAdversario ? 'Sim' : 'Não'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Rolagem>
  )
}

function TabelaSancoesLegado({ itens, m }: { itens: ModeloImpressao['sancoes']; m: ModeloImpressao }) {
  return (
    <Rolagem>
      <table>
        <thead><tr><th>Set</th><th>Hora</th><th>Placar</th><th>Equipe</th><th>Registro</th></tr></thead>
        <tbody>
          {itens.map((e) => (
            <tr key={e.id}>
              <td className="si-num">{e.set ?? '—'}</td><td>{e.hora || '—'}</td><td className="si-num">{e.placar || '—'}</td>
              <td>{e.lado === 'A' ? m.equipeA.nome : e.lado === 'B' ? m.equipeB.nome : '—'}</td><td>{e.texto}<Decisao e={e} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Rolagem>
  )
}

function Sancoes({ m }: { m: ModeloImpressao }) {
  if (m.motor) {
    if (!m.motor.sancoes.length) return <p className="si-vazio">Nenhuma sanção registrada.</p>
    const { principal, anexo } = paginarLinhas(m.motor.sancoes, CAPACIDADE_PAGINA.sancoes)
    return (
      <>
        <TabelaSancoesMotor itens={principal} m={m} />
        <p className="si-legenda">A = advertência · P = penalidade · E = expulsão · D = desqualificação. Advertência verbal não ocupa coluna.</p>
        {anexo.length ? <p className="si-vazio">Continua na súmula anexa ({anexo.length} sanç{anexo.length > 1 ? 'ões' : 'ão'}).</p> : null}
      </>
    )
  }
  if (!m.sancoes.length) return <p className="si-vazio">Nenhuma sanção registrada.</p>
  const { principal, anexo } = paginarLinhas(m.sancoes, CAPACIDADE_PAGINA.sancoes)
  return (
    <>
      <TabelaSancoesLegado itens={principal} m={m} />
      {anexo.length ? <p className="si-vazio">Continua na súmula anexa ({anexo.length} sanç{anexo.length > 1 ? 'ões' : 'ão'}).</p> : null}
    </>
  )
}

/* ------------------------------ observações ------------------------------- */

type LinhaObs = { chave: string; set: number | null; hora: string; placar: string; texto: ReactNode }

function observacoesDoModelo(m: ModeloImpressao): LinhaObs[] {
  if (m.motor?.observacoes.length) {
    return m.motor.observacoes.map((o) => ({ chave: `m${o.seq}`, set: o.numeroSet, hora: '', placar: o.placar, texto: o.texto }))
  }
  return m.observacoes.map((e) => ({ chave: `l${e.id}`, set: e.set, hora: e.hora, placar: e.placar, texto: <>{e.texto}<Decisao e={e} /></> }))
}

function TabelaObservacoes({ itens }: { itens: LinhaObs[] }) {
  return (
    <Rolagem>
      <table>
        <thead><tr><th>Set</th><th>Hora</th><th>Placar</th><th>Registro</th></tr></thead>
        <tbody>{itens.map((e) => <tr key={e.chave}><td className="si-num">{e.set ?? '—'}</td><td>{e.hora || '—'}</td><td className="si-num">{e.placar || '—'}</td><td>{e.texto}</td></tr>)}</tbody>
      </table>
    </Rolagem>
  )
}

/* ------------------------------ folha de líbero ---------------------------- */

function FolhaDeLibero({ m }: { m: ModeloImpressao }) {
  if (m.motor) {
    const linhas = m.motor.folhaLibero
    if (!linhas.length) return <p className="si-vazio">Nenhuma troca ou redesignação de líbero registrada.</p>
    const lados = [
      { lado: 'A' as const, nome: m.equipeA.nome },
      { lado: 'B' as const, nome: m.equipeB.nome },
    ]
    const sets = Array.from(new Set(linhas.map((l) => l.numeroSet))).sort((a, b) => a - b)
    return (
      <div className="si-duas">
        {lados.map(({ lado, nome }) => (
          <article key={lado}>
            <h3>Equipe {lado}: {nome}</h3>
            <Rolagem>
              <table aria-label={`Folha de controle de líbero, equipe ${lado}`}>
                <thead><tr><th>Set</th><th className="si-num">Nº</th><th className="si-num">Líb.</th><th className="si-num">Troca</th><th className="si-num">Pos.</th><th className="si-num">Placar</th></tr></thead>
                <tbody>
                  {sets.flatMap((set) =>
                    linhas.filter((l) => l.numeroSet === set && l.equipe === lado).map((l) => (
                      <tr key={l.seq}>
                        <td className="si-num">{set}</td>
                        <td className="si-num">{l.ordem}</td>
                        <td className="si-num">{l.libero ?? '—'}</td>
                        <td className="si-num">{l.tipo === 'REDESIGNACAO' ? `REDESIGNAÇÃO: sai ${l.liberoSubstituido ?? '—'}` : (l.troca ?? '')}</td>
                        <td className="si-num">{l.posicao ? POSICOES[l.posicao - 1] : '—'}</td>
                        <td className="si-num">{l.placar.texto}{l.liberoInferido ? ' *' : ''}</td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </Rolagem>
          </article>
        ))}
        {linhas.some((l) => l.liberoInferido) ? <p className="si-legenda">* Relação de líberos não registrada: líbero inferido pelo jogador que entrou.</p> : null}
      </div>
    )
  }
  const todas = m.sets.flatMap((s) => s.trocasLibero.map((e) => ({ set: s.numero, e })))
  if (!todas.length) return <p className="si-vazio">Nenhuma troca de líbero registrada.</p>
  return (
    <>
      <Rolagem>
        <table>
          <thead><tr><th>Set</th><th>Hora</th><th>Placar</th><th>Registro</th></tr></thead>
          <tbody>{todas.map(({ set, e }) => <tr key={e.id}><td className="si-num">{set}</td><td>{e.hora || '—'}</td><td className="si-num">{e.placar || '—'}</td><td>{e.texto}</td></tr>)}</tbody>
        </table>
      </Rolagem>
      <p className="si-legenda">Posição e coluna &quot;Troca&quot; {NAO_REGISTRADO} (a leitura não trouxe o log de eventos).</p>
    </>
  )
}

/* --------------------------------- anexos ---------------------------------- */

function Anexos({ m, observacoes }: { m: ModeloImpressao; observacoes: LinhaObs[] }) {
  const obsAnexo = paginarLinhas(observacoes, CAPACIDADE_PAGINA.observacoes).anexo
  const sancoesAnexo = m.motor
    ? paginarLinhas(m.motor.sancoes, CAPACIDADE_PAGINA.sancoes).anexo
    : paginarLinhas(m.sancoes, CAPACIDADE_PAGINA.sancoes).anexo
  const setsCancelados = m.motor?.sets.filter((s) => s.temCancelamento) ?? []
  const eventosAnexo = (m.motor?.sets ?? []).map((s) => ({ s, anexo: s.quadros ? [] : paginarLinhas(s.eventos, CAPACIDADE_PAGINA.eventosDoSet).anexo })).filter((x) => x.anexo.length)
  if (!obsAnexo.length && !sancoesAnexo.length && !setsCancelados.length && !eventosAnexo.length) {
    return <p className="si-vazio">Não houve necessidade de súmula anexa.</p>
  }
  return (
    <>
      {obsAnexo.length ? (<><h3>Observações — continuação</h3><TabelaObservacoes itens={obsAnexo} /></>) : null}
      {sancoesAnexo.length ? (
        <>
          <h3>Sanções — continuação</h3>
          {m.motor ? <TabelaSancoesMotor itens={m.motor.sancoes.slice(CAPACIDADE_PAGINA.sancoes)} m={m} /> : <TabelaSancoesLegado itens={m.sancoes.slice(CAPACIDADE_PAGINA.sancoes)} m={m} />}
        </>
      ) : null}
      {eventosAnexo.map(({ s, anexo }) => (
        <div key={`ev${s.numero}`}><h3>{s.numero}º set — tempos e substituições, continuação</h3><EventosDoMotor itens={anexo} m={m} vazio="" /></div>
      ))}
      {setsCancelados.map((s) => {
        const set = m.sets.find((x) => x.numero === s.numero)
        return (
          <section key={`can${s.numero}`} className="si-anexo" aria-label={`Súmula anexa do set ${s.numero}`}>
            <h3>Súmula anexa do {s.numero}º set (cancelamento de pontos)</h3>
            <p>Mesmas formações e horário de início do set, com os pontos válidos transcritos em ordem. Os capitães e os árbitros assinam as duas súmulas.</p>
            {set ? (
              <div className="si-duas">
                <Formacao titulo={m.equipeA.nome} formacao={set.formacaoA} />
                <Formacao titulo={m.equipeB.nome} formacao={set.formacaoB} />
              </div>
            ) : null}
            <p>Início: {set?.inicio ?? NAO_REGISTRADO}</p>
            <QuadroDePontos pontos={pontosDaSumulaAnexa(s.pontos)} m={m} titulo={`Súmula anexa do ${s.numero}º set`} />
            <EventosDoMotor itens={s.eventos} m={m} vazio="Nenhum tempo ou substituição neste set." />
            {s.sancoes.length ? <TabelaSancoesMotor itens={s.sancoes} m={m} /> : null}
          </section>
        )
      })}
    </>
  )
}

/* -------------------------------- documento -------------------------------- */

export function SumulaImpressa({ modelo: m, aoImprimir }: { modelo: ModeloImpressao; aoImprimir: () => void }) {
  const observacoes = observacoesDoModelo(m)
  const obsPrincipal = paginarLinhas(observacoes, CAPACIDADE_PAGINA.observacoes)
  const fech = m.motor?.fechamento ?? null
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
          <div><dt>Resultado</dt><dd>{m.equipeA.nome} {m.setsA} × {m.setsB} {m.equipeB.nome}</dd></div>
        </dl>

        <h2>Relação nominal</h2>
        <div className="si-duas">
          <Relacao equipe={m.equipeA} />
          <Relacao equipe={m.equipeB} />
        </div>

        <h2>Sets</h2>
        {m.sets.length ? m.sets.map((s) => <BlocoSet key={s.numero} s={s} m={m} />) : <p className="si-vazio">Nenhum set registrado.</p>}

        <h2 className="si-nova-pagina">Sanções</h2>
        <Sancoes m={m} />

        <h2>Protesto</h2>
        {m.motor?.protestos.length ? (
          <ul className="si-lista">
            {m.motor.protestos.map((p) => (
              <li key={p.seq}>
                {p.equipe === 'A' ? m.equipeA.nome : m.equipeB.nome}: {p.estado === 'ANUNCIADO' ? 'protesto anunciado' : p.estado === 'REGISTRADO' ? 'protesto registrado' : 'protesto desistido'}
                {p.relato ? ` — ${p.relato}` : ''}
              </li>
            ))}
          </ul>
        ) : <p className="si-vazio">{m.motor ? 'Nenhum protesto registrado.' : `Protesto: ${NAO_REGISTRADO} (a leitura não trouxe o log de eventos).`}</p>}

        <h2>Observações</h2>
        {obsPrincipal.principal.length ? <TabelaObservacoes itens={obsPrincipal.principal} /> : <p className="si-vazio">Nenhuma observação registrada.</p>}
        {obsPrincipal.anexo.length ? <p className="si-vazio">Continua na súmula anexa ({obsPrincipal.anexo.length} observaç{obsPrincipal.anexo.length > 1 ? 'ões' : 'ão'}).</p> : null}
        {m.motor?.sets.some((s) => s.temCancelamento) ? (
          <p className="si-aviso" role="note">Houve cancelamento de pontos: SEGUE SÚMULA ANEXA do(s) set(s) {m.motor.sets.filter((s) => s.temCancelamento).map((s) => s.numero).join(', ')}.</p>
        ) : null}

        {m.decisoesDoArbitro.length ? (
          <>
            <h2>Registros por decisão do árbitro</h2>
            <p className="si-aviso" role="note">{avisoDeOverrides(m.decisoesDoArbitro.length)}</p>
            <Rolagem>
              <table>
                <thead><tr><th>Set</th><th>Hora</th><th>Placar</th><th>Registro</th><th>Regra e justificativa</th></tr></thead>
                <tbody>{m.decisoesDoArbitro.map((e) => <tr key={e.id}><td className="si-num">{e.set ?? '—'}</td><td>{e.hora || '—'}</td><td className="si-num">{e.placar || '—'}</td><td>{e.texto}</td><td>{e.decisaoArbitro}</td></tr>)}</tbody>
              </table>
            </Rolagem>
          </>
        ) : null}

        <h2 className="si-nova-pagina">Folha de controle de líbero</h2>
        <FolhaDeLibero m={m} />
        <div className="si-assin si-assin-curta">
          <div>Apontador assistente</div>
        </div>

        <h2>Súmula anexa</h2>
        <Anexos m={m} observacoes={observacoes} />

        <h2 className="si-nova-pagina">Quadro de resultados</h2>
        <Rolagem>
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
        </Rolagem>
        {fech ? (
          <p>
            Sanções: {m.equipeA.nome} {fech.totais.sancoesA} · {m.equipeB.nome} {fech.totais.sancoesB}. Início do jogo: {fech.inicio ?? NAO_REGISTRADO} · Fim: {fech.fim ?? NAO_REGISTRADO} ·
            Duração dos sets (sem intervalos): {fech.duracaoSets ?? NAO_REGISTRADO} · Duração total (com intervalos): {fech.duracaoTotal ?? NAO_REGISTRADO}.
          </p>
        ) : null}

        <h2>Resultado final</h2>
        <p className="si-resultado">{m.equipeA.nome} {m.setsA} × {m.setsB} {m.equipeB.nome}</p>
        <p>Vencedor: <strong>{m.vencedor ?? 'não registrado'}</strong></p>
        <p>MVP: <strong>{m.mvp.length ? m.mvp.join(', ') : 'não registrado'}</strong></p>

        {m.eventosNaoAplicados.length > 0 ? (
          <section aria-label={TITULO_EVENTOS_NAO_APLICADOS}>
            <h2>{TITULO_EVENTOS_NAO_APLICADOS}</h2>
            <p className="si-nota">Registros que as regras não aceitaram e que, por isso, não entram no quadro de pontos. Confira com a arbitragem.</p>
            <ul>
              {m.eventosNaoAplicados.map((e) => (
                <li key={e.seq}>
                  #{e.seq} {e.tipo}{e.equipe ? ` (equipe ${e.equipe})` : ''}: {e.mensagem}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <h2>Assinaturas</h2>
        <div className="si-assin">
          {m.assinaturas.map((a) => (
            <div key={a.rotulo}>
              {a.rotulo}
              {a.nota ? <small className="si-nota">{a.nota}</small> : null}
            </div>
          ))}
          <div>Delegado / organização</div>
        </div>
        <p className="si-rodape">
          Documento gerado pelo volei.space a partir da súmula digital. {m.encerrada ? '' : 'Partida sem vencedor registrado: documento parcial. '}
          {m.motor?.recusados ? `${m.motor.recusados} registro(s) recusado(s) pelas regras ficaram fora do documento. ` : ''}
          Valem as assinaturas manuscritas na versão impressa.
        </p>
      </main>
    </div>
  )
}
