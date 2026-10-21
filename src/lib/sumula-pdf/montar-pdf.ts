/**
 * Converte o modelo da súmula impressa (`montarSumulaImpressa`) em um arquivo PDF. Módulo PURO.
 *
 * Reproduz a estrutura de `components/sumula-impressa/SumulaImpressa.tsx`. Só usa camisa e nome abreviado
 * (RG-ELE-006): nunca CPF, telefone, documento ou nascimento, que nem existem no modelo.
 */
import { TITULO_EVENTOS_NAO_APLICADOS, pontosDaSumulaAnexa, type LinhaEvento, type LinhaPonto } from '@/lib/sumula-impressa/motor'
import { NAO_REGISTRADO, textoDuracao } from '@/lib/sumula-impressa/montar'
import type { EventoImpresso, ModeloImpressao, PosicaoFormacao, SetImpresso } from '@/lib/sumula-impressa/tipos'
import { EscritorPdf, type Celula, type Coluna } from './escritor'

const POSICOES = ['I', 'II', 'III', 'IV', 'V', 'VI'] as const

/** Segmento seguro para nome de arquivo: só letras, dígitos, hífen e sublinhado. */
export function segmentoSeguro(valor: unknown, padrao = 'x') {
  const limpo = String(valor ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
  return limpo || padrao
}

/** 'sumula-<jogo>-AAAA-MM-DD.pdf' (data no fuso de São Paulo; sem data legível, 'sem-data'). */
export function nomeDoArquivoSumula(jogo: unknown, dataHora?: string | null) {
  let data = 'sem-data'
  if (dataHora) {
    const d = new Date(dataHora)
    if (!Number.isNaN(d.getTime())) {
      try {
        data = d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
      } catch {
        data = d.toISOString().slice(0, 10)
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) data = d.toISOString().slice(0, 10)
    }
  }
  return `sumula-${segmentoSeguro(jogo, 'jogo')}-${data}.pdf`
}

const esq = (titulo: string, peso: number): Coluna => ({ titulo, peso })
const cen = (titulo: string, peso: number): Coluna => ({ titulo, peso, alinhar: 'centro' })

function textoEvento(e: LinhaEvento, nomeA: string, nomeB: string) {
  const nome = e.equipe === 'A' ? nomeA : nomeB
  if (e.tipo === 'TEMPO') return `${e.ordem}º tempo - ${nome}`
  const excepcional = e.tipo === 'SUBSTITUICAO_EXCEPCIONAL' ? ' (excepcional)' : ''
  return `${e.ordem}ª substituição${excepcional} - ${nome}: sai nº ${e.sai ?? '-'}, entra nº ${e.entra ?? '-'}${e.motivo ? ` (${e.motivo})` : ''}`
}

function quadroDePontos(w: EscritorPdf, pontos: LinhaPonto[], m: ModeloImpressao) {
  if (!pontos.length) {
    w.paragrafo('Nenhum ponto registrado.', { tamanho: 8 })
    return
  }
  const colunas: Coluna[] = [
    cen('Nº', 5),
    cen(`${m.equipeA.nome.slice(0, 10)} x ${m.equipeB.nome.slice(0, 10)}`, 13),
    cen('Pt', 3.5),
    ...POSICOES.map((p) => cen(`A ${p}`, 4.6)),
    ...POSICOES.map((p) => cen(`B ${p}`, 4.6)),
  ]
  const celulaPos = (numero: number | undefined, saca: boolean): Celula =>
    saca ? { t: `${numero ?? '-'} S`, negrito: true, fundo: 0.8, centro: true } : { t: String(numero ?? '-'), centro: true }
  const linhas: Celula[][] = pontos.map((p) => [
    { t: String(p.ordem), centro: true },
    { t: p.cancelado ? 'CANCELADO' : `${p.placarA} x ${p.placarB}`, centro: true, fundo: p.cancelado ? 0.9 : undefined },
    { t: p.equipe, centro: true },
    ...POSICOES.map((_, i) => celulaPos(p.formacaoA[i], p.sacador === 'A' && i === 0)),
    ...POSICOES.map((_, i) => celulaPos(p.formacaoB[i], p.sacador === 'B' && i === 0)),
  ])
  w.tabela(colunas, linhas, { tamanho: 7 })
}

function formacao(w: EscritorPdf, m: ModeloImpressao, s: SetImpresso) {
  const faltando = (nome: string) => w.paragrafo(`${nome}: formação inicial ${NAO_REGISTRADO}.`, { tamanho: 8 })
  const linha = (nome: string, f: PosicaoFormacao[] | null): Celula[] | null =>
    f ? [{ t: nome, negrito: true }, ...POSICOES.map((_, i) => ({ t: f[i] ? `${f[i].camisa ? `#${f[i].camisa} ` : ''}${f[i].nome}` : '-', centro: true }))] : null
  const a = linha(m.equipeA.nome, s.formacaoA)
  const b = linha(m.equipeB.nome, s.formacaoB)
  if (!a) faltando(m.equipeA.nome)
  if (!b) faltando(m.equipeB.nome)
  const linhas = [a, b].filter((x): x is Celula[] => x != null)
  if (linhas.length) w.tabela([esq('Formação inicial', 3), ...POSICOES.map((p) => cen(p, 2.4))], linhas, { tamanho: 7 })
}

function eventosLegados(w: EscritorPdf, itens: EventoImpresso[], vazio: string) {
  if (!itens.length) {
    w.paragrafo(vazio, { tamanho: 8 })
    return
  }
  w.tabela([esq('Hora', 1.2), cen('Placar', 1.4), esq('Registro', 8)], itens.map((e) => [e.hora || '-', { t: e.placar || '-', centro: true }, e.texto]), { tamanho: 7.5 })
}

function blocoDoSet(w: EscritorPdf, m: ModeloImpressao, s: SetImpresso) {
  const nome = (lado: 'A' | 'B' | null) => (lado === 'A' ? m.equipeA.nome : lado === 'B' ? m.equipeB.nome : null)
  const motor = m.motor?.sets.find((x) => x.numero === s.numero) ?? null
  w.novaPagina()
  w.titulo(`${s.numero}º set - ${m.equipeA.nome} ${s.pontosA} x ${s.pontosB} ${m.equipeB.nome}`)
  w.paragrafo(`Saque inicial: ${nome(s.sacador) ?? (motor ? nome(motor.sacouPrimeiro) : null) ?? NAO_REGISTRADO}`, { tamanho: 8.5 })
  formacao(w, m, s)
  w.paragrafo(`Líbero inicial: ${m.equipeA.nome} ${s.liberoA ?? 'nenhum'} · ${m.equipeB.nome} ${s.liberoB ?? 'nenhum'}`, { tamanho: 8.5 })
  w.paragrafo(`Início: ${s.inicio ?? NAO_REGISTRADO} · Fim: ${s.fim ?? NAO_REGISTRADO} · Duração: ${textoDuracao(s.duracaoMin)}`, { tamanho: 8.5 })
  if (motor) {
    w.titulo('Quadro de pontos e rodízio (posições I a VI; sacador marcado com S)', 3)
    quadroDePontos(w, motor.pontos, m)
    if (motor.temCancelamento) w.paragrafo('Pontos cancelados neste set. SEGUE SÚMULA ANEXA.', { fonte: 'negrito', tamanho: 8.5 })
    w.titulo(`Tempos e substituições em ordem (tempos A: ${s.tempoA} · B: ${s.tempoB} / subst. A: ${s.substA} · B: ${s.substB})`, 3)
    if (!motor.eventos.length) w.paragrafo('Nenhum tempo ou substituição neste set.', { tamanho: 8 })
    else {
      w.tabela(
        [cen('Placar (quem pediu primeiro)', 3), esq('Registro', 9)],
        motor.eventos.map((e) => [{ t: e.placar, centro: true }, textoEvento(e, m.equipeA.nome, m.equipeB.nome)]),
        { tamanho: 7.5 },
      )
      if (motor.quadros) w.paragrafo(`Set decisivo: registros até a troca de lado${motor.trocaDeLadoPlacar ? ` (placar ${motor.trocaDeLadoPlacar})` : ''} no quadro da esquerda (${motor.quadros.esquerda.length}); depois, no da direita (${motor.quadros.direita.length}).`, { tamanho: 7.5 })
    }
  } else {
    w.titulo(`Tempos (A: ${s.tempoA} · B: ${s.tempoB})`, 3)
    eventosLegados(w, s.tempos, 'Nenhum tempo registrado neste set.')
    w.titulo(`Substituições e trocas de líbero (regulares A: ${s.substA} · B: ${s.substB})`, 3)
    eventosLegados(w, s.substituicoes, 'Nenhuma substituição registrada neste set.')
    w.paragrafo(`Rodízio e sacador ponto a ponto: ${NAO_REGISTRADO} (a leitura não trouxe o log de eventos da súmula).`, { tamanho: 8 })
  }
}

function sancoes(w: EscritorPdf, m: ModeloImpressao) {
  const nomeLado = (l: 'A' | 'B' | null) => (l === 'A' ? m.equipeA.nome : l === 'B' ? m.equipeB.nome : '-')
  if (m.motor) {
    if (!m.motor.sancoes.length) return w.paragrafo('Nenhuma sanção registrada.', { tamanho: 8.5 })
    const marca = (coluna: string, c: string | null): Celula => ({ t: coluna === c ? 'X' : '', centro: true })
    return w.tabela(
      [cen('Set', 1.3), esq('Equipe', 3), esq('Membro', 3), esq('Motivo', 3), esq('Sanção', 3), cen('A', 1), cen('P', 1), cen('E', 1), cen('D', 1), cen('Placar', 1.8), cen('Pt adv.', 1.6)],
      m.motor.sancoes.map((l) => [
        { t: String(l.numeroSet), centro: true }, nomeLado(l.equipe), l.membro, l.categoria, l.sancao,
        marca('A', l.coluna), marca('P', l.coluna), marca('E', l.coluna), marca('D', l.coluna),
        { t: l.placar, centro: true }, { t: l.pontoParaAdversario ? 'Sim' : 'Não', centro: true },
      ]),
      { tamanho: 7 },
    )
  }
  if (!m.sancoes.length) return w.paragrafo('Nenhuma sanção registrada.', { tamanho: 8.5 })
  w.tabela(
    [cen('Set', 1), esq('Hora', 1.4), cen('Placar', 1.6), esq('Equipe', 3), esq('Registro', 8)],
    m.sancoes.map((e) => [{ t: String(e.set ?? '-'), centro: true }, e.hora || '-', { t: e.placar || '-', centro: true }, nomeLado(e.lado), e.texto]),
    { tamanho: 7.5 },
  )
}

function folhaDeLibero(w: EscritorPdf, m: ModeloImpressao) {
  if (m.motor) {
    const linhas = m.motor.folhaLibero
    if (!linhas.length) return w.paragrafo('Nenhuma troca ou redesignação de líbero registrada.', { tamanho: 8.5 })
    for (const [lado, nome] of [['A', m.equipeA.nome], ['B', m.equipeB.nome]] as const) {
      const doLado = linhas.filter((l) => l.equipe === lado).sort((a, b) => a.numeroSet - b.numeroSet || a.ordem - b.ordem)
      w.titulo(`Equipe ${lado}: ${nome}`, 3)
      if (!doLado.length) {
        w.paragrafo('Sem trocas de líbero.', { tamanho: 8 })
        continue
      }
      w.tabela(
        [cen('Set', 1), cen('Nº', 1), cen('Líb.', 1.2), cen('Troca', 3), cen('Pos.', 1.2), cen('Placar', 1.8)],
        doLado.map((l) => [
          { t: String(l.numeroSet), centro: true }, { t: String(l.ordem), centro: true }, { t: String(l.libero ?? '-'), centro: true },
          { t: l.tipo === 'REDESIGNACAO' ? `REDESIGNAÇÃO: sai ${l.liberoSubstituido ?? '-'}` : String(l.troca ?? ''), centro: true },
          { t: l.posicao ? POSICOES[l.posicao - 1] : '-', centro: true }, { t: `${l.placar.texto}${l.liberoInferido ? ' *' : ''}`, centro: true },
        ]),
        { tamanho: 7.5 },
      )
    }
    if (linhas.some((l) => l.liberoInferido)) w.paragrafo('* Relação de líberos não registrada: líbero inferido pelo jogador que entrou.', { tamanho: 7 })
    return
  }
  const todas = m.sets.flatMap((s) => s.trocasLibero.map((e) => ({ set: s.numero, e })))
  if (!todas.length) return w.paragrafo('Nenhuma troca de líbero registrada.', { tamanho: 8.5 })
  w.tabela([cen('Set', 1), esq('Hora', 1.4), cen('Placar', 1.6), esq('Registro', 8)], todas.map(({ set, e }) => [{ t: String(set), centro: true }, e.hora || '-', { t: e.placar || '-', centro: true }, e.texto]), { tamanho: 7.5 })
  w.paragrafo(`Posição e coluna "Troca" ${NAO_REGISTRADO} (a leitura não trouxe o log de eventos).`, { tamanho: 7 })
}

/** Gera o PDF (bytes) da súmula a partir do modelo de impressão. */
export function gerarPdfDaSumula(m: ModeloImpressao): Buffer {
  const w = new EscritorPdf({
    titulo: `Súmula - ${m.equipeA.nome} x ${m.equipeB.nome}`,
    rodape: `volei.space · Súmula ${m.equipeA.nome} x ${m.equipeB.nome} · ${m.data}`,
  })

  w.titulo('Súmula oficial de vôlei', 1)
  w.espaco(4)
  w.tabela(
    [esq('Campo', 2), esq('Informação', 8)],
    [
      ['Campeonato', m.campeonato],
      ['Categoria', m.categoria],
      ['Fase', m.fase],
      ['Data', m.data],
      ['Local', m.local],
      ['Árbitros', m.arbitros.length ? m.arbitros.map((a) => `${a.cargo}: ${a.nome}`).join(' · ') : 'Não registrados'],
      ['Equipe A', m.equipeA.nome],
      ['Equipe B', m.equipeB.nome],
      ['Resultado', `${m.equipeA.nome} ${m.setsA} x ${m.setsB} ${m.equipeB.nome}`],
    ].map(([k, v]) => [{ t: k, negrito: true, fundo: 0.93 }, v]),
    { tamanho: 8.5 },
  )

  w.titulo('Relação nominal')
  for (const equipe of [m.equipeA, m.equipeB]) {
    w.titulo(`Equipe ${equipe.lado}: ${equipe.nome}`, 3)
    if (equipe.atletas.length) {
      w.tabela(
        [cen('Nº', 1.2), esq('Atleta', 6), esq('Marca', 3)],
        equipe.atletas.map((a) => [
          { t: a.camisa || '-', centro: true },
          { t: a.nomeImpresso || a.nome, negrito: a.capitao },
          [a.capitao ? 'Capitão (C)' : '', a.libero ? 'Líbero (L)' : ''].filter(Boolean).join(' · '),
        ]),
        { tamanho: 8 },
      )
    } else w.paragrafo('Nenhum atleta confirmado.', { tamanho: 8.5 })
    if (!equipe.atletas.some((a) => a.capitao)) w.paragrafo(`Capitão: ${NAO_REGISTRADO}.`, { tamanho: 8 })
  }

  w.titulo('Resultado por set')
  const fech = m.motor?.fechamento ?? null
  if (m.sets.length) {
    w.tabela(
      [cen('Set', 1), cen(`${m.equipeA.nome}: pts`, 2), cen('Tempos', 1.2), cen('Subst.', 1.2), cen(`${m.equipeB.nome}: pts`, 2), cen('Tempos', 1.2), cen('Subst.', 1.2), cen('Duração', 2.4)],
      [
        ...m.sets.map((s): Celula[] => [
          { t: String(s.numero), centro: true }, { t: String(s.pontosA), centro: true, negrito: s.vencedor === 'A' }, { t: String(s.tempoA), centro: true }, { t: String(s.substA), centro: true },
          { t: String(s.pontosB), centro: true, negrito: s.vencedor === 'B' }, { t: String(s.tempoB), centro: true }, { t: String(s.substB), centro: true }, { t: textoDuracao(s.duracaoMin), centro: true },
        ]),
        [
          { t: 'Total', negrito: true, fundo: 0.93, centro: true }, { t: String(m.totalPontosA), negrito: true, fundo: 0.93, centro: true },
          { t: String(m.sets.reduce((t, s) => t + s.tempoA, 0)), fundo: 0.93, centro: true }, { t: String(m.sets.reduce((t, s) => t + s.substA, 0)), fundo: 0.93, centro: true },
          { t: String(m.totalPontosB), negrito: true, fundo: 0.93, centro: true },
          { t: String(m.sets.reduce((t, s) => t + s.tempoB, 0)), fundo: 0.93, centro: true }, { t: String(m.sets.reduce((t, s) => t + s.substB, 0)), fundo: 0.93, centro: true },
          { t: textoDuracao(m.duracaoTotalMin), fundo: 0.93, centro: true },
        ],
      ],
      { tamanho: 8 },
    )
    w.paragrafo(`Sets: ${m.equipeA.nome} ${m.setsA} x ${m.setsB} ${m.equipeB.nome}`, { fonte: 'negrito', tamanho: 9 })
  } else w.paragrafo('Nenhum set registrado.', { tamanho: 8.5 })
  if (fech) {
    w.paragrafo(
      `Sanções: ${m.equipeA.nome} ${fech.totais.sancoesA} · ${m.equipeB.nome} ${fech.totais.sancoesB}. Início do jogo: ${fech.inicio ?? NAO_REGISTRADO} · Fim: ${fech.fim ?? NAO_REGISTRADO} · ` +
        `Duração dos sets (sem intervalos): ${fech.duracaoSets ?? NAO_REGISTRADO} · Duração total (com intervalos): ${fech.duracaoTotal ?? NAO_REGISTRADO}.`,
      { tamanho: 8 },
    )
  }

  for (const s of m.sets) blocoDoSet(w, m, s)

  w.titulo('Sanções')
  sancoes(w, m)

  w.titulo('Protesto')
  if (m.motor?.protestos.length) {
    for (const p of m.motor.protestos) {
      const estado = p.estado === 'ANUNCIADO' ? 'protesto anunciado' : p.estado === 'REGISTRADO' ? 'protesto registrado' : 'protesto desistido'
      w.paragrafo(`${p.equipe === 'A' ? m.equipeA.nome : m.equipeB.nome}: ${estado}${p.relato ? ` - ${p.relato}` : ''}`, { tamanho: 8.5, recuo: 8 })
    }
  } else w.paragrafo(m.motor ? 'Nenhum protesto registrado.' : `Protesto: ${NAO_REGISTRADO} (a leitura não trouxe o log de eventos).`, { tamanho: 8.5 })

  w.titulo('Observações')
  const observacoes = m.motor?.observacoes.length
    ? m.motor.observacoes.map((o) => ({ set: o.numeroSet as number | null, hora: '', placar: o.placar, texto: o.texto }))
    : m.observacoes.map((e) => ({ set: e.set, hora: e.hora, placar: e.placar, texto: e.texto }))
  if (observacoes.length) {
    w.tabela(
      [cen('Set', 1), esq('Hora', 1.4), cen('Placar', 1.6), esq('Registro', 8)],
      observacoes.map((o) => [{ t: String(o.set ?? '-'), centro: true }, o.hora || '-', { t: o.placar || '-', centro: true }, o.texto]),
      { tamanho: 7.5 },
    )
  } else w.paragrafo('Nenhuma observação registrada.', { tamanho: 8.5 })

  if (m.decisoesDoArbitro.length) {
    w.titulo('Registros por decisão do árbitro')
    w.tabela(
      [cen('Set', 1), esq('Hora', 1.4), cen('Placar', 1.6), esq('Registro', 5), esq('Regra e justificativa', 5)],
      m.decisoesDoArbitro.map((e) => [{ t: String(e.set ?? '-'), centro: true }, e.hora || '-', { t: e.placar || '-', centro: true }, e.texto, e.decisaoArbitro ?? '']),
      { tamanho: 7.5 },
    )
  }

  w.titulo('Folha de controle de líbero')
  folhaDeLibero(w, m)

  w.titulo('Súmula anexa')
  const cancelados = m.motor?.sets.filter((s) => s.temCancelamento) ?? []
  if (!cancelados.length) w.paragrafo('Não houve necessidade de súmula anexa.', { tamanho: 8.5 })
  for (const s of cancelados) {
    const set = m.sets.find((x) => x.numero === s.numero)
    w.titulo(`Súmula anexa do ${s.numero}º set (cancelamento de pontos)`, 3)
    if (set) formacao(w, m, set)
    w.paragrafo(`Início: ${set?.inicio ?? NAO_REGISTRADO}`, { tamanho: 8 })
    quadroDePontos(w, pontosDaSumulaAnexa(s.pontos), m)
  }

  w.titulo('Resultado final')
  w.paragrafo(`${m.equipeA.nome} ${m.setsA} x ${m.setsB} ${m.equipeB.nome}`, { fonte: 'negrito', tamanho: 12 })
  w.paragrafo(`Vencedor: ${m.vencedor ?? 'não registrado'}`, { tamanho: 9 })
  w.paragrafo(`MVP: ${m.mvp.length ? m.mvp.join(', ') : 'não registrado'}`, { tamanho: 9 })

  if (m.eventosNaoAplicados.length > 0) {
    w.titulo(TITULO_EVENTOS_NAO_APLICADOS)
    w.paragrafo('Registros que as regras não aceitaram e que, por isso, não entram no quadro de pontos. Confira com a arbitragem.', { tamanho: 8 })
    for (const e of m.eventosNaoAplicados) {
      w.paragrafo(`#${e.seq} ${e.tipo}${e.equipe ? ` (equipe ${e.equipe})` : ''}: ${e.mensagem}`, { tamanho: 8, recuo: 8 })
    }
  }

  w.titulo('Assinaturas')
  const campos = [...m.assinaturas.map((a) => ({ rotulo: a.rotulo, nota: a.nota })), { rotulo: 'Delegado / organização', nota: null as string | null }]
  const larguraCampo = (w.larguraUtil - 20) / 2
  for (let i = 0; i < campos.length; i += 2) {
    w.garantirEspaco(80)
    const par = campos.slice(i, i + 2)
    const alturas = par.map((c, k) => w.campoAssinatura(w.margem + k * (larguraCampo + 20), larguraCampo, c.rotulo, c.nota))
    w.espaco(Math.max(...alturas) + 4)
  }
  w.paragrafo(
    `Documento gerado pelo volei.space a partir da súmula digital. ${m.encerrada ? '' : 'Partida sem vencedor registrado: documento parcial. '}` +
      `${m.motor?.recusados ? `${m.motor.recusados} registro(s) recusado(s) pelas regras ficaram fora do quadro. ` : ''}Valem as assinaturas manuscritas na versão impressa.`,
    { tamanho: 7 },
  )
  return w.finalizar()
}
