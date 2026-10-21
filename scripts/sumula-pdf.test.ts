import assert from 'node:assert/strict'
import { configMelhorDe3, type PayloadPorTipo, type SumulaEvento, type SumulaEventoTipo } from '../src/lib/regras-volei'
import { codificarWinAnsi, EscritorPdf, larguraDoTexto, literalPdf, quebrarTexto } from '../src/lib/sumula-pdf/escritor'
import { gerarPdfDaSumula, nomeDoArquivoSumula, segmentoSeguro } from '../src/lib/sumula-pdf/montar-pdf'
import { montarSumulaImpressa } from '../src/lib/sumula-impressa/montar'
import type { RegistroSumula } from '../src/lib/sumula-impressa/tipos'
import { lerPdf } from './sumula-pdf-leitor'

// ---------- escritor: codificação, largura e quebra ----------
assert.deepEqual(codificarWinAnsi('açãõé'), [0x61, 0xe7, 0xe3, 0xf5, 0xe9])
assert.deepEqual(codificarWinAnsi('€—“”'), [0x80, 0x97, 0x93, 0x94])
assert.deepEqual(codificarWinAnsi('A中B😀'), [0x41, 0x3f, 0x42, 0x3f], 'o que não existe vira ?')
assert.equal(literalPdf('a(b)\\ç'), '(a\\(b\\)\\\\\\347)')
assert.equal(larguraDoTexto('Hello', 'regular', 10), (722 + 556 + 222 + 222 + 556) / 100)
assert.ok(larguraDoTexto('Hello', 'negrito', 10) > larguraDoTexto('Hello', 'regular', 10))
assert.equal(larguraDoTexto('é', 'regular', 10), larguraDoTexto('e', 'regular', 10))
const quebradas = quebrarTexto('uma frase bem longa que precisa quebrar em várias linhas', 'regular', 10, 80)
assert.ok(quebradas.length > 2 && quebradas.every((l) => larguraDoTexto(l, 'regular', 10) <= 80))
assert.ok(quebrarTexto('X'.repeat(200), 'regular', 10, 80).every((l) => larguraDoTexto(l, 'regular', 10) <= 80), 'palavra gigante é cortada')

// ---------- escritor: documento mínimo e quebra de página ----------
const w = new EscritorPdf({ titulo: 'Teste', rodape: 'rodapé do teste' })
w.titulo('Ação rápida çãõ', 1)
for (let i = 0; i < 120; i++) w.paragrafo(`Linha ${i} com acentuação: ção, ã, õ, é, ü.`)
const pdf1 = lerPdf(w.finalizar())
assert.ok(pdf1.paginas.length >= 3, 'texto longo quebra de página automaticamente')
assert.ok(pdf1.texto.includes('Ação rápida çãõ'))
assert.ok(pdf1.texto.includes(`Página 1 de ${pdf1.paginas.length}`) && pdf1.texto.includes(`Página ${pdf1.paginas.length} de ${pdf1.paginas.length}`))
assert.ok(pdf1.paginas.every((p) => p.includes('rodapé do teste')), 'rodapé em todas as páginas')

// ---------- súmula: modelo de exemplo ----------
let seq = 0
function ev<K extends SumulaEventoTipo>(tipo: K, payload: PayloadPorTipo[K], criadoEm?: string): SumulaEvento {
  seq += 1
  return { seq, clientEventId: `e-${seq}`, desfazId: null, criadoEm, tipo, payload } as SumulaEvento
}
const ponto = (equipe: 'A' | 'B', criadoEm?: string) => ev('PONTO', { equipe }, criadoEm)
const log: SumulaEvento[] = [
  ev('SET_INICIADO', { numeroSet: 1, formacaoA: [1, 2, 3, 4, 5, 6], formacaoB: [11, 12, 13, 14, 15, 16], saqueInicial: 'A', liberosA: [7], liberosB: [] }, '2026-05-10T17:00:00.000Z'),
  ponto('A'), ponto('A'), ponto('B'),
  ev('TEMPO', { equipe: 'A' }),
  ev('SUBSTITUICAO', { equipe: 'B', sai: 13, entra: 18 }),
  ev('SANCAO', { equipe: 'B', membro: 'J:14', categoria: 'MENOR', sancao: 'AMARELO', pontoParaAdversario: false }),
  ev('OBSERVACAO', { texto: 'Bola trocada por desgaste.' }),
  ev('TROCA_LIBERO', { equipe: 'A', sai: 4, entra: 7 }),
  ponto('B'), ponto('A'), ponto('A'), ponto('A', '2026-05-10T17:25:00.000Z'),
]
const reg: RegistroSumula = {
  id: 77, setsPorA: 1, setsPorB: 0, vencedorId: 1, categoria: 'Adulto Misto', dataHora: '2026-05-10T15:00:00.000Z', localNome: 'Ginásio Municipal',
  liga: { nome: 'Copa Açaí de Vôlei' },
  equipeA: { id: 1, nome: 'Águias do Sul', jogadores: [{ id: 1, nome: 'Carlos Eduardo Silva', numero: 1 }, { id: 2, nome: 'João Conceição', numero: 2 }, { id: 7, nome: 'Gi Lima', numero: 7, posicao: 'Líbero' }] },
  equipeB: { id: 2, nome: 'Beta', jogadores: [{ id: 11, nome: 'Lia Souza', numero: 11 }] },
  sets: [{ numero: 1, pontosA: 5, pontosB: 2 }],
  escala: [{ cargo: 'PRIMEIRO', arbitro: { nome: 'Árbitro Um' } }],
  destaques: [{ tipo: 'MVP', jogador: { id: 1, nome: 'Carlos Eduardo Silva' } }],
  ocorrencias: [],
}
// Campos pessoais que, por descuido, viessem no registro nunca chegam ao documento.
;(reg.equipeA!.jogadores![0] as Record<string, unknown>).cpf = '123.456.789-09'
;(reg.equipeA!.jogadores![0] as Record<string, unknown>).telefone = '(11) 98765-4321'
;(reg.equipeA!.jogadores![0] as Record<string, unknown>).dataNascimento = '1990-02-03'

for (const [rotulo, eventos] of [['com log do motor', log], ['sem log', null]] as const) {
  const modelo = montarSumulaImpressa(reg, eventos)!
  const bytes = gerarPdfDaSumula(modelo)
  const lido = lerPdf(bytes)
  const t = lido.texto
  assert.ok(t.includes('Súmula oficial de vôlei'), rotulo)
  assert.ok(t.includes('Copa Açaí de Vôlei') && t.includes('Adulto Misto') && t.includes('Ginásio Municipal'), `${rotulo}: cabeçalho com acentos`)
  assert.ok(t.includes('ÁGUIAS DO SUL') || t.includes('Águias do Sul'), `${rotulo}: equipe A`)
  assert.ok(t.includes('Beta') || t.includes('BETA'), `${rotulo}: equipe B`)
  assert.ok(/1 x 0/.test(t) && /5/.test(t) && /2/.test(t), `${rotulo}: placar`)
  assert.ok(t.includes('Árbitro Um'), `${rotulo}: árbitros`)
  assert.ok(t.includes('CARLOS S.') && t.includes('JOÃO C.'), `${rotulo}: nome abreviado e acentos`)
  for (const rot of ['Assinaturas', 'Apontador', '1º árbitro', '2º árbitro', 'Delegado / organização', 'Folha de controle de líbero', 'Protesto', 'Observações', 'Sanções', 'Resultado final']) {
    assert.ok(t.includes(rot), `${rotulo}: seção "${rot}"`)
  }
  assert.ok(t.includes('Carlos Eduardo Silva'), `${rotulo}: MVP`)
  for (const proibido of ['123.456.789-09', '98765', '1990-02-03', 'cpf', 'CPF', 'telefone']) assert.ok(!t.includes(proibido), `${rotulo}: sem dado pessoal (${proibido})`)
  assert.ok(!/123\.456|98765|1990/.test(bytes.toString('latin1')), `${rotulo}: bytes sem dado pessoal`)
  if (eventos) {
    assert.ok(t.includes('Quadro de pontos e rodízio'), 'quadro de pontos com o log')
    assert.ok(/\d+ S/.test(t), 'sacador marcado com S')
    assert.ok(t.includes('Bola trocada por desgaste.'))
    assert.ok(t.includes('1ª substituição'))
  } else {
    assert.ok(t.includes('não registrado nesta versão'), 'sem log: nota "não registrado nesta versão"')
  }
}

// Eventos não aplicados e súmula anexa aparecem quando existem.
{
  const base: SumulaEvento[] = [
    ev('SET_INICIADO', { numeroSet: 1, formacaoA: [1, 2, 3, 4, 5, 6], formacaoB: [11, 12, 13, 14, 15, 16], saqueInicial: 'A' }),
    ponto('A'),
  ]
  for (let i = 0; i < 8; i++) base.push(ev('TEMPO', { equipe: 'B' })) // além do limite: o motor recusa
  const modelo = montarSumulaImpressa(reg, base)!
  if (modelo.eventosNaoAplicados.length > 0) {
    assert.ok(lerPdf(gerarPdfDaSumula(modelo)).texto.includes('Eventos não aplicados'))
  }
  const semNaoAplicados = { ...montarSumulaImpressa(reg, log)!, eventosNaoAplicados: [] }
  assert.ok(!lerPdf(gerarPdfDaSumula(semNaoAplicados)).texto.includes('Eventos não aplicados'))
  const forcado = { ...semNaoAplicados, eventosNaoAplicados: [{ seq: 9, tipo: 'TEMPO', equipe: 'B' as const, codigo: 'RG-X', mensagem: 'Tempo além do limite.' }] }
  const forcadoTexto = lerPdf(gerarPdfDaSumula(forcado)).texto
  assert.ok(forcadoTexto.includes('Eventos não aplicados') && forcadoTexto.includes('Tempo além do limite.'))
  // Súmula anexa dos pontos cancelados.
  const cancel = { ...semNaoAplicados, motor: { ...semNaoAplicados.motor!, sets: semNaoAplicados.motor!.sets.map((s) => ({ ...s, temCancelamento: true })) } }
  const tc = lerPdf(gerarPdfDaSumula(cancel)).texto
  assert.ok(tc.includes('SEGUE SÚMULA ANEXA') && tc.includes('Súmula anexa do 1º set'))
}

// Súmula longa: muitas observações quebram de página e o xref continua correto.
{
  const longo: RegistroSumula = {
    ...reg,
    ocorrencias: Array.from({ length: 150 }, (_, i) => ({ id: i + 1, tipo: 'OBSERVACAO', set: 1, descricao: `14:${String(i % 60).padStart(2, '0')} | 1-0 | Observação número ${i + 1} com texto razoavelmente comprido para ocupar a linha e exigir a quebra automática na célula da tabela.` })),
  }
  const modelo = montarSumulaImpressa(longo)!
  const lido = lerPdf(gerarPdfDaSumula(modelo))
  const curto = lerPdf(gerarPdfDaSumula(montarSumulaImpressa(reg)!))
  assert.ok(lido.paginas.length > curto.paginas.length + 2, `súmula longa tem mais páginas (${lido.paginas.length} > ${curto.paginas.length})`)
  assert.ok(lido.texto.includes('Observação número 150'))
  assert.ok(lido.texto.includes(`Página ${lido.paginas.length} de ${lido.paginas.length}`))
}

// ---------- nome do arquivo ----------
assert.equal(nomeDoArquivoSumula(77, '2026-05-10T15:00:00.000Z'), 'sumula-77-2026-05-10.pdf')
assert.equal(nomeDoArquivoSumula(77, '2026-05-11T01:00:00.000Z'), 'sumula-77-2026-05-10.pdf', 'data no fuso de São Paulo')
assert.equal(nomeDoArquivoSumula('../etc/passwd"\r\n', null), 'sumula-etc-passwd-sem-data.pdf')
assert.match(nomeDoArquivoSumula('a b/ç"', 'lixo'), /^sumula-[A-Za-z0-9_-]+-sem-data\.pdf$/)
assert.equal(segmentoSeguro('', 'jogo'), 'jogo')

console.log('sumula-pdf.test.ts: ok.')
