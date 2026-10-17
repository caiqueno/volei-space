import assert from 'node:assert/strict'
import {
  anexarEvento,
  configMelhorDe3,
  type Equipe,
  type NovoEvento,
  type PayloadPorTipo,
  type SumulaEvento,
  type SumulaEventoTipo,
} from '../src/lib/regras-volei'
import {
  agregarAcoes,
  BOM_UTF8,
  celulaCsv,
  COLUNAS_CSV,
  derivarScoutDoLog,
  estatisticasDe,
  exportarCsv,
  exportarJson,
  montarResumo,
  validarAcao,
  VERSAO_ESQUEMA_CSV,
  VERSAO_ESQUEMA_JSON,
  type AcaoScout,
} from '../src/lib/scout'

class Jogo {
  log: readonly SumulaEvento[] = []
  private n = 0
  add<K extends SumulaEventoTipo>(tipo: K, payload: PayloadPorTipo[K], criadoEm?: string, desfazId: number | null = null): number {
    this.n += 1
    const r = anexarEvento(this.log, { tipo, payload, clientEventId: `e-${this.n}`, desfazId, ...(criadoEm ? { criadoEm } : {}) } as NovoEvento)
    if (!r.ok) throw new Error(`${r.codigo}: ${r.mensagem}`)
    this.log = r.log
    return r.evento.seq
  }
  ponto(equipe: Equipe, criadoEm?: string) {
    return this.add('PONTO', { equipe }, criadoEm)
  }
}

const config = configMelhorDe3()
let casos = 0
function caso(nome: string, fn: () => void) {
  fn()
  casos += 1
  console.log(`ok - ${nome}`)
}

/** Set 1: A A A B B B A A, com tempo e substituição. A: 1..6, B: 11..16, A saca. */
function jogoExemplo() {
  const j = new Jogo()
  j.add('SET_INICIADO', { numeroSet: 1, formacaoA: [1, 2, 3, 4, 5, 6], formacaoB: [11, 12, 13, 14, 15, 16], saqueInicial: 'A' }, '2026-10-17T10:00:00.000Z')
  for (const e of ['A', 'A', 'A', 'B', 'B', 'B', 'A'] as Equipe[]) j.ponto(e)
  j.add('TEMPO', { equipe: 'B' })
  j.add('SUBSTITUICAO', { equipe: 'A', sai: 3, entra: 7 })
  j.ponto('A', '2026-10-17T10:12:30.000Z')
  return j
}

caso('derivação: pontos, sacadores, rotação e sequências do log de exemplo', () => {
  const d = derivarScoutDoLog(jogoExemplo().log, config)
  assert.equal(d.inconsistencias, 0)
  assert.equal(d.sets.length, 1)
  assert.deepEqual([d.sets[0]!.pontosA, d.sets[0]!.pontosB], [5, 3])
  assert.equal(d.pontos.length, 8)

  const s1 = d.sacadores.find((s) => s.equipe === 'A' && s.jogadorId === 1)!
  assert.deepEqual([s1.saques, s1.pontosNoSaque, s1.saquesPerdidos, s1.maiorSerie, s1.aproveitamento], [4, 3, 1, 3, 0.75])
  const s12 = d.sacadores.find((s) => s.equipe === 'B' && s.jogadorId === 12)!
  assert.deepEqual([s12.saques, s12.pontosNoSaque, s12.saquesPerdidos, s12.maiorSerie], [3, 2, 1, 2])
  const s2 = d.sacadores.find((s) => s.equipe === 'A' && s.jogadorId === 2)!
  assert.deepEqual([s2.saques, s2.pontosNoSaque, s2.maiorSerie], [1, 1, 1])

  assert.equal(d.pontos[3]!.tipo, 'SIDE_OUT')
  assert.equal(d.pontos[0]!.tipo, 'PONTO_NO_SAQUE')
  assert.equal(d.pontos[7]!.rotacaoA, 2)
  assert.equal(d.pontos[7]!.sacadorJogador, 2)

  const a1 = d.porRotacao.A[0]!
  assert.deepEqual([a1.saque.rallies, a1.saque.pontos, a1.recepcao.rallies, a1.recepcao.pontos], [4, 3, 3, 1])
  const b2 = d.porRotacao.B[1]!
  assert.deepEqual([b2.saque.rallies, b2.saque.pontos, b2.recepcao.rallies, b2.recepcao.pontos], [3, 2, 1, 0])
  assert.equal(d.porRotacao.B[0]!.recepcao.aproveitamento, 0.25)
  assert.equal(d.porRotacao.A[5]!.saque.aproveitamento, null, 'rotação sem rally = null, não 0')

  assert.deepEqual(d.sequencias.map((q) => [q.equipe, q.tamanho]), [['A', 3], ['B', 3], ['A', 2]])
  assert.deepEqual(d.maiorSequencia, { A: 3, B: 3 })
  assert.deepEqual(d.eficienciaSaque.A, { rallies: 5, pontos: 4, aproveitamento: 0.8 })
})

caso('derivação: tempos, substituições, duração e pontos por set', () => {
  const d = derivarScoutDoLog(jogoExemplo().log, config)
  assert.deepEqual(d.tempos.map((t) => [t.equipe, t.set, t.placarA, t.placarB]), [['B', 1, 4, 3]])
  assert.deepEqual(d.substituicoes.map((s) => [s.equipe, s.sai, s.entra, s.tipo, s.placarA, s.placarB]), [['A', 3, 7, 'REGULAR', 4, 3]])
  assert.equal(d.sets[0]!.duracaoSegundos, 750)
  assert.deepEqual(d.sets[0]!.tempos, { A: 0, B: 1 })
  assert.deepEqual(d.sets[0]!.substituicoes, { A: 1, B: 0 })
  assert.equal(d.sets[0]!.pontosPorOrigem.RALLY, 8)
})

caso('derivação: DESFAZ remove o ponto; falta de posição é ponto administrativo sem saque', () => {
  const j = new Jogo()
  j.add('SET_INICIADO', { numeroSet: 1, formacaoA: [1, 2, 3, 4, 5, 6], formacaoB: [11, 12, 13, 14, 15, 16], saqueInicial: 'A' })
  const errado = j.ponto('B')
  j.add('DESFAZ', {}, undefined, errado)
  j.ponto('A')
  j.add('FALTA_POSICAO', { equipeFaltosa: 'B' })
  const d = derivarScoutDoLog(j.log, config)
  assert.equal(d.pontos.length, 2)
  assert.deepEqual([d.sets[0]!.pontosA, d.sets[0]!.pontosB], [2, 0])
  assert.equal(d.pontos[1]!.tipo, 'ADMINISTRATIVO')
  assert.equal(d.pontos[1]!.sacadorJogador, null)
  assert.equal(d.sacadores.find((s) => s.jogadorId === 1)!.saques, 1, 'só o rally conta como saque')
})

caso('derivação: log vazio e vários sets', () => {
  const vazio = derivarScoutDoLog([], config)
  assert.equal(vazio.sets.length, 0)
  assert.equal(vazio.pontos.length, 0)
  assert.equal(vazio.sacadores.length, 0)

  const j = new Jogo()
  j.add('SET_INICIADO', { numeroSet: 1, formacaoA: [1, 2, 3, 4, 5, 6], formacaoB: [11, 12, 13, 14, 15, 16], saqueInicial: 'A' })
  for (let i = 0; i < 25; i += 1) j.ponto('A')
  j.add('SET_INICIADO', { numeroSet: 2, formacaoA: [1, 2, 3, 4, 5, 6], formacaoB: [11, 12, 13, 14, 15, 16], saqueInicial: 'B' })
  j.ponto('B')
  const d = derivarScoutDoLog(j.log, config)
  assert.equal(d.sets.length, 2)
  assert.equal(d.sets[0]!.encerrado, true)
  assert.equal(d.sets[0]!.vencedor, 'A')
  assert.equal(d.sets[0]!.maiorSequenciaA, 25)
  assert.equal(d.pontos.filter((p) => p.set === 2).length, 1)
  assert.equal(d.pontos.find((p) => p.set === 2)!.sacadorJogador, 11)
})

function acao(p: Partial<AcaoScout>): AcaoScout {
  return { id: 1, set: 1, pontoA: 0, pontoB: 0, equipe: 'A', jogadorId: 7, fundamento: 'ATAQUE', resultado: 'NEUTRO', rotacao: 1, posicao: 4, zonaOrigem: 4, zonaDestino: 6, origem: 'MANUAL', ...p }
}

caso('modelo: validação de ação (zonas 1-9, rotação 1-6, enums)', () => {
  assert.deepEqual(validarAcao(acao({})), [])
  assert.ok(validarAcao(acao({ zonaDestino: 10 as never })).length > 0)
  assert.ok(validarAcao(acao({ zonaOrigem: 0 as never })).length > 0)
  assert.ok(validarAcao(acao({ rotacao: 7 })).length > 0)
  assert.ok(validarAcao(acao({ fundamento: 'CORTADA' as never })).length > 0)
  assert.ok(validarAcao(acao({ resultado: 'ACE' as never })).length > 0)
  assert.deepEqual(validarAcao(acao({ jogadorId: null, rotacao: null, posicao: null, zonaOrigem: null, zonaDestino: null })), [])
  assert.ok(validarAcao(null).length > 0)
})

caso('estatísticas: eficiência de ataque, recepção positiva, aces, erros e bloqueios', () => {
  const acoes: AcaoScout[] = []
  let id = 0
  const add = (n: number, p: Partial<AcaoScout>) => { for (let i = 0; i < n; i += 1) acoes.push(acao({ ...p, id: (id += 1) })) }
  add(5, { fundamento: 'ATAQUE', resultado: 'PONTO' })
  add(1, { fundamento: 'ATAQUE', resultado: 'ERRO' })
  add(4, { fundamento: 'ATAQUE', resultado: 'CONTINUA' })
  add(1, { fundamento: 'RECEPCAO', resultado: 'PONTO' })
  add(2, { fundamento: 'RECEPCAO', resultado: 'CONTINUA' })
  add(1, { fundamento: 'RECEPCAO', resultado: 'NEUTRO' })
  add(2, { fundamento: 'SAQUE', resultado: 'PONTO' })
  add(1, { fundamento: 'SAQUE', resultado: 'ERRO' })
  add(2, { fundamento: 'SAQUE', resultado: 'CONTINUA' })
  add(2, { fundamento: 'BLOQUEIO', resultado: 'PONTO' })
  add(3, { fundamento: 'DEFESA', resultado: 'CONTINUA', jogadorId: 9, equipe: 'B', set: 2 })

  const g = estatisticasDe(acoes.filter((a) => a.jogadorId === 7))
  assert.deepEqual(g.ataque, { tentativas: 10, pontos: 5, erros: 1, eficiencia: 0.4 })
  assert.deepEqual(g.recepcao, { total: 4, positivas: 3, percentualPositiva: 0.75 })
  assert.deepEqual(g.saque, { total: 5, aces: 2, erros: 1, eficiencia: 0.2 })
  assert.equal(g.aces, 2)
  assert.equal(g.erros, 2)
  assert.equal(g.bloqueios, 2)

  const ag = agregarAcoes(acoes)
  assert.deepEqual(ag.porJogador.map((x) => [x.equipe, x.jogadorId, x.acoes]), [['A', 7, 21], ['B', 9, 3]])
  assert.deepEqual(ag.porEquipe.map((x) => x.equipe), ['A', 'B'])
  assert.deepEqual(ag.porSet.map((x) => [x.set, x.equipe]), [[1, 'A'], [2, 'B']])
  // Sem tentativas: null, nunca 0.
  assert.equal(ag.porEquipe[1]!.ataque.eficiencia, null)
  assert.equal(ag.porEquipe[1]!.recepcao.percentualPositiva, null)
  assert.equal(estatisticasDe([]).saque.eficiencia, null)
})

caso('exportação JSON: versão do esquema, estável e com lacunas', () => {
  const r = montarResumo({ partidaId: 42, log: jogoExemplo().log, config, geradoEm: '2026-10-17T12:00:00.000Z' })
  const a = exportarJson(r)
  const b = exportarJson(montarResumo({ partidaId: 42, log: jogoExemplo().log, config, geradoEm: '2026-10-17T12:00:00.000Z' }))
  assert.equal(a, b)
  const o = JSON.parse(a)
  assert.equal(o.versaoEsquema, VERSAO_ESQUEMA_JSON)
  assert.equal(Object.keys(o)[0], 'versaoEsquema')
  assert.equal(o.partidaId, 42)
  assert.equal(o.derivado.pontos.length, 8)
  assert.deepEqual(o.acoes, [])
  assert.ok(o.lacunas.length >= 4)
  assert.ok(!/dvw/i.test(Object.keys(o).join()), 'sem formato .dvw')
})

caso('exportação CSV: BOM, separador ;, CRLF, versão em toda linha, colunas fixas', () => {
  const acoes = [acao({ id: 1, set: 1, jogadorId: 7, fundamento: 'ATAQUE', resultado: 'PONTO' })]
  const r = montarResumo({ partidaId: 42, log: jogoExemplo().log, config, acoes, geradoEm: '2026-10-17T12:00:00.000Z' })
  const csv = exportarCsv(r)
  assert.equal(csv.charCodeAt(0), 0xfeff)
  assert.ok(Buffer.from(csv, 'utf8').subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])))
  const linhas = csv.slice(1).split('\r\n')
  assert.equal(linhas[linhas.length - 1], '')
  const dados = linhas.slice(0, -1)
  assert.equal(dados[0], COLUNAS_CSV.join(';'))
  // 8 pontos + 1 tempo + 1 substituição + 1 ação + cabeçalho
  assert.equal(dados.length, 12)
  for (const l of dados.slice(1)) {
    const c = l.split(';')
    assert.equal(c.length, COLUNAS_CSV.length)
    assert.equal(c[0], VERSAO_ESQUEMA_CSV)
    assert.equal(c[1], '42')
  }
  assert.ok(dados.some((l) => l.split(';')[2] === 'ACAO' && l.includes('ATAQUE;PONTO')))
  assert.equal(csv, exportarCsv(r), 'saída determinística')
})

caso('CSV: escape de aspas/ponto e vírgula e neutralização de fórmula', () => {
  assert.equal(celulaCsv(null), '')
  assert.equal(celulaCsv(0), '0')
  assert.equal(celulaCsv(-0.25), '-0.25')
  assert.equal(celulaCsv('a;b'), '"a;b"')
  assert.equal(celulaCsv('diz "oi"'), '"diz ""oi"""')
  assert.equal(celulaCsv('=1+1'), "'=1+1")
  assert.equal(celulaCsv('@cmd'), "'@cmd")
})

console.log(`scout.test.ts: ${casos} casos ok.`)
