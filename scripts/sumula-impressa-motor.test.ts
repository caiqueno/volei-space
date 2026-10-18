import assert from 'node:assert/strict'
import {
  configMelhorDe3,
  derivarPlacar,
  type PayloadPorTipo,
  type SumulaEvento,
  type SumulaEventoTipo,
} from '../src/lib/regras-volei'
import {
  CAPACIDADE_PAGINA,
  colunaDaSancao,
  configParaImpressao,
  dividirPorTrocaDeLado,
  horaDoCarimbo,
  montarAssinaturas,
  montarMotorImpresso,
  nomeNaSumula,
  paginarLinhas,
  pontosDaSumulaAnexa,
  rotuloDoMembro,
  TITULO_EVENTOS_NAO_APLICADOS,
} from '../src/lib/sumula-impressa/motor'
import { montarSumulaImpressa } from '../src/lib/sumula-impressa/montar'
import type { RegistroSumula } from '../src/lib/sumula-impressa/tipos'

let seq = 0
function ev<K extends SumulaEventoTipo>(tipo: K, payload: PayloadPorTipo[K], extra: { desfazId?: number; criadoEm?: string } = {}): SumulaEvento {
  seq += 1
  return { seq, clientEventId: `e-${seq}`, desfazId: extra.desfazId ?? null, criadoEm: extra.criadoEm, tipo, payload } as SumulaEvento
}
const ponto = (equipe: 'A' | 'B', criadoEm?: string) => ev('PONTO', { equipe }, { criadoEm })

const config = configMelhorDe3({ alvoSet: 5, alvoSetDecisivo: 5, trocaLadoNoDecisivoEm: 3 })

// Set 1: A saca. A, A, B (B ganha saque e roda), tempo A, substituição B, amarelo B, observação, A, A, A (5x1).
const log: SumulaEvento[] = []
log.push(ev('SET_INICIADO', { numeroSet: 1, formacaoA: [1, 2, 3, 4, 5, 6], formacaoB: [11, 12, 13, 14, 15, 16], saqueInicial: 'A', liberosA: [7], liberosB: [] }, { criadoEm: '2026-05-10T17:00:00.000Z' }))
log.push(ponto('A'))
log.push(ponto('A'))
log.push(ponto('B')) // B ganha o saque: formacaoB roda (12,13,14,15,16,11)
log.push(ev('TEMPO', { equipe: 'A' }))
log.push(ev('SUBSTITUICAO', { equipe: 'B', sai: 13, entra: 18 }))
log.push(ev('SANCAO', { equipe: 'B', membro: 'J:14', categoria: 'MENOR', sancao: 'ADVERTENCIA_VERBAL', pontoParaAdversario: false }))
log.push(ev('SANCAO', { equipe: 'B', membro: 'J:14', categoria: 'MENOR', sancao: 'AMARELO', pontoParaAdversario: false }))
log.push(ev('OBSERVACAO', { texto: 'Bola trocada por desgaste.' }))
log.push(ev('TROCA_LIBERO', { equipe: 'A', sai: 4, entra: 7 }))
log.push(ponto('B'))
log.push(ponto('A'))
log.push(ponto('A'))
log.push(ponto('A', '2026-05-10T17:25:00.000Z'))

const placar = derivarPlacar(log, config)
assert.equal(placar.sets.length, 1, JSON.stringify(placar.inconsistencias))
assert.equal(placar.inconsistencias.length, 0, JSON.stringify(placar.inconsistencias))

const m = montarMotorImpresso(log, config)
const s1 = m.sets[0]

// quadro de pontos: ordem, placar acumulado e sacador em destaque (posição I)
assert.equal(s1.pontos.length, 7)
assert.deepEqual(s1.pontos.map((p) => `${p.placarA}-${p.placarB}`).slice(0, 4), ['1-0', '2-0', '2-1', '2-2'])
assert.equal(s1.pontos[0].sacador, 'A')
assert.equal(s1.pontos[0].numeroSacador, 1) // RG-FOR-010: o sacador está na posição I
assert.deepEqual(s1.pontos[0].formacaoA, [1, 2, 3, 4, 5, 6])
// depois que B ganha o saque, B roda e o novo sacador é o da posição I rodada
assert.equal(s1.pontos[3].sacador, 'B')
assert.equal(s1.pontos[3].numeroSacador, 12)
assert.deepEqual(s1.pontos[2].formacaoB, [11, 12, 13, 14, 15, 16])
assert.deepEqual(s1.pontos[3].formacaoB, [12, 18, 14, 15, 16, 11])
// a substituição entrou no rodízio (13 saiu, 18 entrou) a partir do rally seguinte
assert.ok(s1.pontos.slice(3).every((p) => p.formacaoB.includes(18) && !p.formacaoB.includes(13)))
// o rodízio refeito do jornal fecha com a formação derivada pelo motor
const ultimo = s1.pontos[s1.pontos.length - 1]
assert.equal(ultimo.placarA, placar.sets[0].placar.a)
assert.equal(ultimo.placarB, placar.sets[0].placar.b)

// tempos e substituições em ordem, com placar da equipe que pediu primeiro
assert.deepEqual(s1.eventos.map((e) => [e.tipo, e.equipe, e.ordem, e.placar]), [
  ['TEMPO', 'A', 1, '2X1'],
  ['SUBSTITUICAO', 'B', 1, '1X2'],
])
assert.deepEqual([s1.eventos[1].sai, s1.eventos[1].entra], [13, 18])
assert.ok(s1.eventos[0].seq < s1.eventos[1].seq)

// sanções: coluna A/P/E/D (aqui, cartão amarelo = A) e placar
assert.equal(s1.sancoes.length, 2)
assert.equal(s1.sancoes[0].coluna, null)
assert.equal(s1.sancoes[1].coluna, 'A')
assert.equal(s1.sancoes[0].membro, 'Jogador nº 14')
assert.equal(s1.sancoes[0].placar, '1X2')
assert.deepEqual(['ADVERTENCIA_VERBAL', 'AMARELO', 'PENALIDADE', 'EXPULSAO', 'DESQUALIFICACAO', 'ADVERTENCIA_ATRASO', 'PENALIDADE_ATRASO', 'x'].map(colunaDaSancao), [null, 'A', 'P', 'E', 'D', 'A', 'P', null])
assert.equal(rotuloDoMembro('TECNICO'), 'Técnico')

// observações em ordem cronológica, com set e placar
assert.deepEqual(m.observacoes.map((o) => [o.numeroSet, o.placar, o.texto]), [[1, '2-1', 'Bola trocada por desgaste.']])

// RG-LIB-014: folha de controle de líbero (Líb., Troca, posição, placar com a equipe que troca primeiro)
assert.equal(m.folhaLibero.length, 1)
assert.deepEqual([m.folhaLibero[0].equipe, m.folhaLibero[0].libero, m.folhaLibero[0].troca, m.folhaLibero[0].posicao, m.folhaLibero[0].placar.texto], ['A', 7, 4, 4, '2X1'])

// RG-SET-007 / RG-SET-008: quadro de resultados e totais derivados do log
assert.equal(m.fechamento.porSet[0].temposA, 1)
assert.equal(m.fechamento.porSet[0].substB, 1)
assert.equal(m.fechamento.porSet[0].sancoesB, 2)
assert.equal(m.fechamento.porSet[0].inicio, '14:00') // 17:00Z em Brasília
assert.equal(m.fechamento.porSet[0].fim, '14:25')
assert.equal(m.fechamento.porSet[0].duracao, '0h25')
assert.equal(m.fechamento.totais.pontosA, 5)
assert.equal(m.fechamento.totais.pontosB, 2)
assert.equal(m.fechamento.duracaoTotal, null) // partida ainda não encerrada: sem duração total
const logFim: SumulaEvento[] = [
  ev('SET_INICIADO', { numeroSet: 1, formacaoA: [1, 2, 3, 4, 5, 6], formacaoB: [11, 12, 13, 14, 15, 16], saqueInicial: 'A' }, { criadoEm: '2026-05-10T17:00:00.000Z' }),
]
for (let i = 0; i < 5; i++) logFim.push(ponto('A', i === 4 ? '2026-05-10T17:25:00.000Z' : undefined))
logFim.push(ev('SET_INICIADO', { numeroSet: 2, formacaoA: [1, 2, 3, 4, 5, 6], formacaoB: [11, 12, 13, 14, 15, 16], saqueInicial: 'B' }, { criadoEm: '2026-05-10T17:40:00.000Z' }))
for (let i = 0; i < 5; i++) logFim.push(ponto('A', i === 4 ? '2026-05-10T18:05:00.000Z' : undefined))
const mFim = montarMotorImpresso(logFim, config)
assert.equal(mFim.fechamento.vencedor, 'A')
assert.equal(mFim.fechamento.duracaoTotal, '1h05') // RG-SET-008: com intervalos, 1 dígito de hora
assert.equal(mFim.fechamento.duracaoSets, '0h50') // só os sets, sem o intervalo
assert.deepEqual([mFim.fechamento.inicio, mFim.fechamento.fim], ['14:00', '15:05'])
assert.deepEqual([mFim.fechamento.setsA, mFim.fechamento.setsB], [2, 0])
assert.equal(horaDoCarimbo('lixo'), null)
assert.equal(horaDoCarimbo(null), null)

// RG-ELE-006: nome na súmula
assert.equal(nomeNaSumula('Carlos Eduardo Silva'), 'CARLOS S.')
assert.equal(nomeNaSumula('  maria   souza '), 'MARIA S.')
assert.equal(nomeNaSumula('Ana'), 'ANA')
assert.equal(nomeNaSumula(null), '')

// RG-INT-006: observações sem pular ordem, cronológicas e com o placar da equipe A primeiro
const logObs: SumulaEvento[] = [
  ev('SET_INICIADO', { numeroSet: 1, formacaoA: [1, 2, 3, 4, 5, 6], formacaoB: [11, 12, 13, 14, 15, 16], saqueInicial: 'A' }),
  ev('OBSERVACAO', { texto: 'Primeira.' }),
  ponto('B'),
  ev('OBSERVACAO', { texto: 'Segunda.' }),
]
const mObs = montarMotorImpresso(logObs, config)
assert.deepEqual(mObs.observacoes.map((o) => [o.texto, o.placar]), [['Primeira.', '0-0'], ['Segunda.', '0-1']])

// RG-INT-007: sem rasura; o desfazer não apaga, o evento anulado simplesmente não entra no documento
const logDesfaz: SumulaEvento[] = []
logDesfaz.push(ev('SET_INICIADO', { numeroSet: 1, formacaoA: [1, 2, 3, 4, 5, 6], formacaoB: [11, 12, 13, 14, 15, 16], saqueInicial: 'A' }))
const errado = ponto('B')
logDesfaz.push(errado, ev('DESFAZ', {}, { desfazId: errado.seq }), ponto('A'))
const mDesfaz = montarMotorImpresso(logDesfaz, config)
assert.equal(mDesfaz.sets[0].pontos.length, 1)
assert.equal(mDesfaz.sets[0].pontos[0].equipe, 'A')

// RG-LIB-013: redesignação aparece na folha com o líbero antigo e o novo
const logRed: SumulaEvento[] = [
  ev('SET_INICIADO', { numeroSet: 1, formacaoA: [1, 2, 3, 4, 5, 6], formacaoB: [11, 12, 13, 14, 15, 16], saqueInicial: 'A', liberosA: [7, 8] }),
  ponto('A'),
  ev('REDESIGNACAO_LIBERO', { equipe: 'A', liberoIncapaz: 7, novoLibero: 2 }),
]
const mRed = montarMotorImpresso(logRed, config)
assert.equal(mRed.folhaLibero.length, 1)
assert.equal(mRed.folhaLibero[0].tipo, 'REDESIGNACAO')
assert.deepEqual([mRed.folhaLibero[0].liberoSubstituido, mRed.folhaLibero[0].libero], [7, 2])

// RG-ROT-005 / RG-PTO-003: ponto cancelado fica visível e a súmula anexa traz só os válidos, renumerados
const logCancel: SumulaEvento[] = [
  ev('SET_INICIADO', { numeroSet: 1, formacaoA: [1, 2, 3, 4, 5, 6], formacaoB: [11, 12, 13, 14, 15, 16], saqueInicial: 'A' }),
  ponto('A'),
  ponto('B'),
  ponto('A'),
]
logCancel.push(ev('FALTA_ROTACAO', { equipeFaltosa: 'A', momentoSeq: logCancel[1].seq }))
const mCancel = montarMotorImpresso(logCancel, config)
const pCancel = mCancel.sets[0].pontos
assert.equal(mCancel.houveCancelamentoDePontos, true)
assert.equal(mCancel.sets[0].temCancelamento, true)
assert.ok(pCancel.some((p) => p.cancelado))
const anexa = pontosDaSumulaAnexa(pCancel)
assert.ok(anexa.length < pCancel.length)
assert.deepEqual(anexa.map((p) => p.ordem), anexa.map((_, i) => i + 1))
assert.ok(anexa.every((p) => !p.cancelado))
// último ponto de cada equipe: o placar do quadro nunca conta cancelado
assert.equal(pCancel[pCancel.length - 1].placarA + pCancel[pCancel.length - 1].placarB, derivarPlacar(logCancel, config).sets[0].placar.a + derivarPlacar(logCancel, config).sets[0].placar.b)

// RG-FOR-011: set decisivo usa os quadros da esquerda e da direita, divididos pela troca de lado
const logDecisivo: SumulaEvento[] = []
for (const n of [1, 2]) {
  logDecisivo.push(ev('SET_INICIADO', { numeroSet: n, formacaoA: [1, 2, 3, 4, 5, 6], formacaoB: [11, 12, 13, 14, 15, 16], saqueInicial: 'A' }))
  for (let i = 0; i < 5; i++) logDecisivo.push(ponto(n === 1 ? 'A' : 'B'))
}
logDecisivo.push(ev('SET_INICIADO', { numeroSet: 3, formacaoA: [1, 2, 3, 4, 5, 6], formacaoB: [11, 12, 13, 14, 15, 16], saqueInicial: 'B' }))
logDecisivo.push(ev('TEMPO', { equipe: 'A' }))
logDecisivo.push(ponto('A'), ponto('A'), ponto('A'))
logDecisivo.push(ev('TROCA_LADO', {}))
logDecisivo.push(ev('TEMPO', { equipe: 'B' }))
const mDec = montarMotorImpresso(logDecisivo, config)
assert.equal(mDec.recusados, 0, JSON.stringify(derivarPlacar(logDecisivo, config).inconsistencias))
const s3 = mDec.sets.find((s) => s.numero === 3)!
assert.equal(s3.decisivo, true)
assert.ok(s3.trocaDeLadoSeq != null)
assert.equal(s3.trocaDeLadoPlacar, '3-0')
assert.deepEqual(s3.quadros!.esquerda.map((e) => e.equipe), ['A'])
assert.deepEqual(s3.quadros!.direita.map((e) => e.equipe), ['B'])
assert.equal(mDec.sets[0].quadros, null)
assert.deepEqual(dividirPorTrocaDeLado(s3.eventos, null).direita, [])

// RG-FEC-003: capitão em jogo vira nota na assinatura; sem ele, a assinatura fica em branco
const ass = montarAssinaturas({ nomeA: 'ALFA', nomeB: 'BETA', arbitros: [{ cargo: 'PRIMEIRO', nome: 'Juiz Um' }, { cargo: 'SEGUNDO', nome: 'Juiz Dois' }], capitaoEmJogo: [{ equipe: 'B', jogador: 14 }] })
assert.deepEqual(ass.map((a) => a.papel), ['APONTADOR', 'APONTADOR', 'CAPITAO', 'CAPITAO', 'ARBITRO', 'ARBITRO'])
assert.equal(ass[2].nota, null)
assert.match(ass[3].nota ?? '', /nº 14/)
assert.equal(ass[4].nota, 'Juiz Um')

// RG-LIB-014 e anexos: quando passa da capacidade da página, o excedente vai para a súmula anexa
const linhas = Array.from({ length: CAPACIDADE_PAGINA.observacoes + 3 }, (_, i) => i)
const pag = paginarLinhas(linhas, CAPACIDADE_PAGINA.observacoes)
assert.equal(pag.principal.length, CAPACIDADE_PAGINA.observacoes)
assert.deepEqual(pag.anexo, [12, 13, 14])
assert.deepEqual(paginarLinhas([1, 2], 5), { principal: [1, 2], anexo: [] })
assert.deepEqual(paginarLinhas([1, 2], -1), { principal: [], anexo: [1, 2] })

// configuração inferida dos sets da leitura
assert.equal(configParaImpressao([{ numero: 1, pontosA: 25, pontosB: 20 }, { numero: 2, pontosA: 25, pontosB: 18 }], 2, 0).melhorDe, 3)
const c5 = configParaImpressao([{ numero: 1, pontosA: 25, pontosB: 20 }, { numero: 2, pontosA: 20, pontosB: 25 }, { numero: 3, pontosA: 25, pontosB: 22 }, { numero: 4, pontosA: 23, pontosB: 25 }, { numero: 5, pontosA: 15, pontosB: 12 }], 3, 2)
assert.deepEqual([c5.melhorDe, c5.alvoSet, c5.alvoSetDecisivo, c5.trocaLadoNoDecisivoEm], [5, 25, 15, 8])
assert.equal(configParaImpressao([], 0, 0).alvoSet, 25)

// R8: a configuração inferida é permissiva e não derruba eventos legítimos
// (3º tempo, 7º e 8º substituição, 3º set obrigatório depois de 2x0, set estendido 27x25, decisivo 17x15)
{
  seq = 0
  const permissivo: SumulaEvento[] = []
  const par = () => permissivo.push(ponto('A'), ponto('B'))
  const F_A = [1, 2, 3, 4, 5, 6]
  const F_B = [11, 12, 13, 14, 15, 16]
  // Set 1: 3 tempos de A e 8 substituições de B (6 trocas e depois o retorno do titular ao próprio lugar), A vence 25x20
  permissivo.push(ev('SET_INICIADO', { numeroSet: 1, formacaoA: F_A, formacaoB: F_B, saqueInicial: 'A' }))
  for (let i = 0; i < 3; i++) { par(); permissivo.push(ev('TEMPO', { equipe: 'A' })) }
  const trocas: Array<[number, number]> = [[11, 21], [12, 22], [13, 23], [14, 24], [15, 25], [16, 26], [21, 11], [22, 12]]
  for (const [sai, entra] of trocas) { par(); permissivo.push(ev('SUBSTITUICAO', { equipe: 'B', sai, entra })) }
  for (let i = 0; i < 9; i++) par() // 11 + 9 = 20x20 ... (11 pares já lançados acima: 3 + 8)
  for (let i = 0; i < 5; i++) permissivo.push(ponto('A'))
  // Set 2: estendido, A vence 27x25
  permissivo.push(ev('SET_INICIADO', { numeroSet: 2, formacaoA: F_A, formacaoB: F_B, saqueInicial: 'B' }))
  for (let i = 0; i < 24; i++) par()
  permissivo.push(ponto('A'), ponto('B'), ponto('A'), ponto('A'))
  // Set 3 (obrigatório depois de 2x0, decisivo): B vence 17x15, com troca de lado aos 8
  permissivo.push(ev('SET_INICIADO', { numeroSet: 3, formacaoA: F_A, formacaoB: F_B, saqueInicial: 'A' }))
  for (let i = 0; i < 7; i++) par()
  permissivo.push(ponto('B'), ev('TROCA_LADO', {}), ponto('A'))
  for (let i = 0; i < 6; i++) par()
  permissivo.push(ponto('B'), ponto('A'), ponto('B'), ponto('B'))

  const setsLidos = [{ numero: 1, pontosA: 25, pontosB: 20 }, { numero: 2, pontosA: 27, pontosB: 25 }, { numero: 3, pontosA: 15, pontosB: 17 }]
  const inferida = configParaImpressao(setsLidos, 2, 1)
  assert.deepEqual([inferida.melhorDe, inferida.alvoSet, inferida.alvoSetDecisivo, inferida.terceiroSetObrigatorio], [3, 25, 15, true])
  assert.ok(inferida.perfil.temposPorSet >= 99 && inferida.perfil.limiteSubstituicoesPorSet >= 99)
  const mPerm = montarMotorImpresso(permissivo, inferida)
  assert.equal(mPerm.recusados, 0, JSON.stringify(mPerm.naoAplicados))
  assert.deepEqual(mPerm.naoAplicados, [])
  assert.deepEqual(mPerm.sets.map((s) => s.numero), [1, 2, 3])
  assert.equal(mPerm.sets[0].eventos.filter((e) => e.tipo === 'TEMPO').length, 3)
  assert.equal(mPerm.sets[0].eventos.filter((e) => e.tipo === 'SUBSTITUICAO').length, 8)
  assert.deepEqual([mPerm.fechamento.setsA, mPerm.fechamento.setsB], [2, 1])
  // com um perfil restritivo (o que a inferência antiga usava) o 3º tempo e a 7ª substituição são recusados
  const restritivo = { ...inferida, perfil: { ...inferida.perfil, temposPorSet: 2, limiteSubstituicoesPorSet: 6 } }
  assert.ok(montarMotorImpresso(permissivo, restritivo).recusados > 0)

  // alvoSet: 25 se algum set encerrado >= 25; senão o menor; set em andamento não define o alvo
  assert.equal(configParaImpressao([{ numero: 1, pontosA: 27, pontosB: 25 }], 1, 0).alvoSet, 25)
  assert.equal(configParaImpressao([{ numero: 1, pontosA: 21, pontosB: 15 }, { numero: 2, pontosA: 23, pontosB: 21 }], 2, 0).alvoSet, 21)
  assert.equal(configParaImpressao([{ numero: 1, pontosA: 25, pontosB: 20 }, { numero: 2, pontosA: 7, pontosB: 5 }], 1, 0).alvoSet, 25, 'set 2 em andamento')
  assert.equal(configParaImpressao([{ numero: 1, pontosA: 25, pontosB: 20 }, { numero: 2, pontosA: 20, pontosB: 25 }, { numero: 3, pontosA: 25, pontosB: 22 }, { numero: 4, pontosA: 23, pontosB: 25 }, { numero: 5, pontosA: 17, pontosB: 15 }], 3, 2).alvoSetDecisivo, 15)
  assert.equal(configParaImpressao([{ numero: 1, pontosA: 25, pontosB: 20 }, { numero: 2, pontosA: 20, pontosB: 25 }], 1, 1).terceiroSetObrigatorio, false)

  // evento que o motor ainda recusa NÃO some: aparece em "Eventos não aplicados" com tipo, equipe e motivo
  seq = 0
  const comRecusa: SumulaEvento[] = [
    ev('SET_INICIADO', { numeroSet: 1, formacaoA: F_A, formacaoB: F_B, saqueInicial: 'A' }),
    ponto('A'),
    ev('TEMPO', { equipe: 'B' }),
    ponto('B'),
    ev('TEMPO', { equipe: 'B' }),
    ponto('A'),
    ev('TEMPO', { equipe: 'B' }), // 3º tempo com um perfil de 2: o motor recusa
  ]
  const mRec = montarMotorImpresso(comRecusa, restritivo)
  assert.equal(mRec.recusados, 1)
  assert.equal(mRec.naoAplicados.length, 1)
  assert.deepEqual([mRec.naoAplicados[0].tipo, mRec.naoAplicados[0].equipe], ['TEMPO', 'B'])
  assert.ok(mRec.naoAplicados[0].codigo.startsWith('RG-') && mRec.naoAplicados[0].mensagem.length > 5)
  assert.equal(mRec.sets[0].eventos.length, 2, 'o recusado fica fora dos quadros')
  assert.equal(montarMotorImpresso(comRecusa, inferida).naoAplicados.length, 0, 'com a inferência permissiva o mesmo log passa inteiro')
  assert.equal(TITULO_EVENTOS_NAO_APLICADOS, 'Eventos não aplicados')
  seq = 1000
}

// integração com o modelo: sem log o modelo segue só com as ocorrências; com log traz o motor
const reg: RegistroSumula = {
  id: 1, setsPorA: 1, setsPorB: 0, equipeA: { id: 1, nome: 'Alfa', jogadores: [{ id: 1, nome: 'Carlos Eduardo Silva', numero: 1 }] }, equipeB: { id: 2, nome: 'Beta', jogadores: [] },
  sets: [{ numero: 1, pontosA: 5, pontosB: 2 }], escala: [{ cargo: 'PRIMEIRO', arbitro: { nome: 'Juiz Um' } }], ocorrencias: [],
}
const semLog = montarSumulaImpressa(reg)!
assert.equal(semLog.motor, null)
assert.deepEqual(semLog.eventosNaoAplicados, [])
assert.equal(semLog.assinaturas.length, 6)
assert.equal(semLog.equipeA.atletas[0].nomeImpresso, 'CARLOS S.')
const comLog = montarSumulaImpressa(reg, log)!
assert.ok(comLog.motor)
assert.equal(comLog.motor!.sets[0].pontos.length, 7)
// com o log, contadores e horários do quadro de resultados vêm do motor
assert.deepEqual([comLog.sets[0].tempoA, comLog.sets[0].substB], [1, 1])
assert.equal(comLog.sets[0].inicio, '14:00')
assert.equal(comLog.sets[0].duracaoMin, 25)
assert.equal(comLog.duracaoTotalMin, 25)
// log ilegível não derruba o documento
assert.equal(montarSumulaImpressa(reg, [{ seq: 1 } as unknown as SumulaEvento])!.sets.length, 1)

// sem PII: o modelo do motor só carrega números, nomes de equipe e textos do próprio log
const json = JSON.stringify(comLog.motor)
for (const proibido of ['cpf', 'nascimento', 'telefone', 'email', 'documento']) assert.ok(!json.toLowerCase().includes(proibido), proibido)

console.log('sumula-impressa-motor: ok')
