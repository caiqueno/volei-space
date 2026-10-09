import assert from 'node:assert/strict'
import { validateCategoryResult, type CategoryMatchRules } from '../src/lib/category-match-rules'
import { calcularClassificacao, FAIXAS_PADRAO, pontosDaMargem, type PartidaClassificacao } from '../src/lib/classificacao'
import { selecionarClassificados } from '../src/lib/classificados'
import { avaliarFinalizacao } from '../src/lib/finalizacao-regras'
import { perdedoresDasSemifinais, vencedorDaPartida, vencedoresDosAlimentadores } from '../src/lib/resultado-partida'
import { correcaoPeloLinkPermitida, JANELA_CORRECAO_SUMULA_MS, validarSubstituicoes } from '../src/lib/sumula-regras'

const CATEGORIA = 'winners-teste'
const REGRAS_SET: CategoryMatchRules = {
  setsPorPartida: 3,
  pontosPorSet: 21,
  tieBreakUltimoSet: true,
  pontosUltimoSet: 15,
}

const times = [1, 2, 3, 4, 5, 6, 7, 8].map((equipeId) => ({
  equipeId,
  categoriaCampeonatoId: CATEGORIA,
  categoria: 'MISTO',
}))

function partidaGrupos(
  equipeAId: number,
  equipeBId: number,
  sets: number[][],
  extra: Partial<PartidaClassificacao> = {},
): PartidaClassificacao {
  const placar = sets.map(([pontosA, pontosB], indice) => ({ numero: indice + 1, pontosA, pontosB }))
  assert.equal(validateCategoryResult(placar, REGRAS_SET), null, `${equipeAId} x ${equipeBId} precisa ser um placar válido`)
  let setsPorA = 0
  let setsPorB = 0
  let pontosPorA = 0
  let pontosPorB = 0
  for (const set of placar) {
    pontosPorA += set.pontosA
    pontosPorB += set.pontosB
    if (set.pontosA > set.pontosB) setsPorA += 1
    else setsPorB += 1
  }
  return {
    equipeAId,
    equipeBId,
    fase: 'GRUPOS',
    status: 'ENCERRADA',
    categoriaCampeonatoId: CATEGORIA,
    setsPorA,
    setsPorB,
    pontosPorA,
    pontosPorB,
    vencedorId: setsPorA > setsPorB ? equipeAId : equipeBId,
    sets: placar,
    ...extra,
  }
}

const folga = (aVence: boolean): number[][] => (aVence ? [[21, 15], [21, 12]] : [[15, 21], [12, 21]])
const apertada = (aVence: boolean): number[][] => (aVence ? [[21, 19], [18, 21], [15, 10]] : [[19, 21], [21, 18], [10, 15]])

const gruposA = [
  partidaGrupos(1, 2, folga(true)),
  partidaGrupos(1, 3, apertada(true)),
  partidaGrupos(1, 4, folga(true)),
  partidaGrupos(2, 3, folga(true)),
  partidaGrupos(2, 4, apertada(true)),
  partidaGrupos(3, 4, folga(true)),
]
const gruposB = [
  partidaGrupos(5, 6, folga(true)),
  partidaGrupos(5, 7, apertada(true)),
  partidaGrupos(5, 8, folga(true)),
  partidaGrupos(6, 7, folga(true)),
  partidaGrupos(6, 8, apertada(true)),
  partidaGrupos(7, 8, folga(true)),
]

assert.equal(pontosDaMargem(2, 0, FAIXAS_PADRAO), pontosDaMargem(3, 0, FAIXAS_PADRAO), '2x0 e 3x0 usam a mesma faixa')
assert.equal(pontosDaMargem(3, 1, FAIXAS_PADRAO), pontosDaMargem(2, 0, FAIXAS_PADRAO), '3x1 também é margem de 2 ou mais')
assert.equal(pontosDaMargem(2, 1, FAIXAS_PADRAO), pontosDaMargem(3, 2, FAIXAS_PADRAO), '2x1 e 3x2 usam a faixa de 1 set')
assert.notEqual(pontosDaMargem(2, 0, FAIXAS_PADRAO), pontosDaMargem(2, 1, FAIXAS_PADRAO))
assert.equal(pontosDaMargem(2, 0, FAIXAS_PADRAO), 3)
assert.equal(pontosDaMargem(2, 1, FAIXAS_PADRAO), 2)

const regras = {
  [CATEGORIA]: {
    faixas: FAIXAS_PADRAO,
    criterios: ['PONTOS', 'VITORIAS', 'SALDO_SETS', 'SALDO_PONTOS'],
    set: { setsPorPartida: 3, pontosPorSet: 21, tieBreakUltimoSet: true, pontosUltimoSet: 15, diferencaMinimaSet: 2 },
  },
}

const tabelaGrupos = calcularClassificacao({ times, partidas: [...gruposA, ...gruposB], regras })
const porId = new Map(tabelaGrupos.map((linha) => [linha.equipeId, linha]))
assert.equal(porId.get(1)?.pontos, 8)
assert.equal(porId.get(5)?.pontos, 8)
assert.equal(porId.get(2)?.pontos, 5)
assert.equal(porId.get(6)?.pontos, 5)
assert.equal(porId.get(3)?.pontos, 4)
assert.equal(porId.get(4)?.pontos, 1)
assert.deepEqual(
  tabelaGrupos.filter((linha) => linha.posicao <= 2).map((linha) => linha.equipeId).sort((a, b) => a - b),
  [1, 5],
  'os dois líderes de grupo empatados em pontos ocupam as duas primeiras posições gerais',
)

const comMataMata = calcularClassificacao({
  times,
  partidas: [
    ...gruposA,
    ...gruposB,
    { ...partidaGrupos(1, 5, folga(true)), fase: 'SEMIFINAL', setsPorA: 2, setsPorB: 0, pontosPorA: 80, pontosPorB: 10 },
  ],
  regras,
})
assert.equal(comMataMata.find((linha) => linha.equipeId === 1)?.pontos, 8, 'jogo de mata-mata não entra na tabela')
assert.equal(comMataMata.find((linha) => linha.equipeId === 5)?.derrotas, porId.get(5)?.derrotas)

const aoVivo = calcularClassificacao({
  times: [{ equipeId: 3, categoriaCampeonatoId: CATEGORIA, categoria: 'MISTO' }, { equipeId: 4, categoriaCampeonatoId: CATEGORIA, categoria: 'MISTO' }],
  partidas: [{
    equipeAId: 3,
    equipeBId: 4,
    fase: 'GRUPOS',
    status: 'EM_ANDAMENTO',
    categoriaCampeonatoId: CATEGORIA,
    sets: [{ numero: 1, pontosA: 21, pontosB: 19 }, { numero: 2, pontosA: 8, pontosB: 6 }],
  }],
  regras,
})
const vivo3 = aoVivo.find((linha) => linha.equipeId === 3)
const vivo4 = aoVivo.find((linha) => linha.equipeId === 4)
assert.equal(vivo3?.jogos, 0)
assert.equal(vivo3?.pontos, 0)
assert.equal(vivo3?.setsPro, 1)
assert.equal(vivo3?.setsContra, 0)
assert.equal(vivo3?.pontosPro, 21)
assert.equal(vivo4?.setsContra, 1)
assert.equal(vivo4?.pontosPro, 19)
assert.equal(vivo4?.jogos, 0, 'set aberto não vira vitória')

const saldo = calcularClassificacao({
  times: [
    { equipeId: 11, categoriaCampeonatoId: CATEGORIA, categoria: 'MISTO' },
    { equipeId: 12, categoriaCampeonatoId: CATEGORIA, categoria: 'MISTO' },
    { equipeId: 19, categoriaCampeonatoId: CATEGORIA, categoria: 'MISTO' },
    { equipeId: 20, categoriaCampeonatoId: CATEGORIA, categoria: 'MISTO' },
  ],
  partidas: [
    partidaGrupos(11, 19, [[25, 10], [25, 8]]),
    partidaGrupos(12, 20, [[21, 19], [22, 20]]),
  ],
  regras,
})
assert.equal(saldo.find((linha) => linha.equipeId === 11)?.pontos, saldo.find((linha) => linha.equipeId === 12)?.pontos)
assert.equal(saldo.find((linha) => linha.equipeId === 11)?.posicao, 1, 'saldo de pontos desempata depois dos sets')
assert.ok((saldo.find((linha) => linha.equipeId === 12)?.posicao ?? 0) > 1)

const reordenado = calcularClassificacao({
  times: [
    { equipeId: 31, categoriaCampeonatoId: CATEGORIA, categoria: 'MISTO' },
    { equipeId: 32, categoriaCampeonatoId: CATEGORIA, categoria: 'MISTO' },
    { equipeId: 33, categoriaCampeonatoId: CATEGORIA, categoria: 'MISTO' },
  ],
  partidas: [
    { equipeAId: 33, equipeBId: 31, fase: 'GRUPOS', status: 'ENCERRADA', categoriaCampeonatoId: CATEGORIA, setsPorA: 2, setsPorB: 0, pontosPorA: 42, pontosPorB: 20, vencedorId: 33 },
    { equipeAId: 33, equipeBId: 31, fase: 'GRUPOS', status: 'ENCERRADA', categoriaCampeonatoId: CATEGORIA, setsPorA: 2, setsPorB: 1, pontosPorA: 50, pontosPorB: 45, vencedorId: 33 },
  ],
  regras: { [CATEGORIA]: { criterios: ['DERROTAS'], faixas: FAIXAS_PADRAO } },
})
assert.equal(reordenado[0].equipeId, 32, 'menos derrotas fica na frente quando esse é o critério')
assert.equal(reordenado[reordenado.length - 1].equipeId, 31)

const wo = calcularClassificacao({
  times: [
    { equipeId: 9, categoriaCampeonatoId: CATEGORIA, categoria: 'MISTO' },
    { equipeId: 10, categoriaCampeonatoId: CATEGORIA, categoria: 'MISTO' },
  ],
  partidas: [{
    equipeAId: 9,
    equipeBId: 10,
    fase: 'GRUPOS',
    status: 'WO',
    categoriaCampeonatoId: CATEGORIA,
    setsPorA: 0,
    setsPorB: 0,
    vencedorId: 9,
  }],
  regras,
})
assert.equal(wo.find((linha) => linha.equipeId === 9)?.vitorias, 1)
assert.equal(wo.find((linha) => linha.equipeId === 9)?.pontos, FAIXAS_PADRAO.pontosVencedorMargem2)
assert.equal(wo.find((linha) => linha.equipeId === 10)?.derrotas, 1)
assert.equal(wo.find((linha) => linha.equipeId === 9)?.setsPro, 0)

const outraCategoria = calcularClassificacao({
  times,
  partidas: [{ ...partidaGrupos(1, 2, folga(true)), categoriaCampeonatoId: 'outra' }],
  regras,
})
assert.equal(outraCategoria.find((linha) => linha.equipeId === 1)?.pontos, 0, 'partida de outra categoria não soma')

const ordenados = [...tabelaGrupos].sort((a, b) => a.posicao - b.posicao || a.equipeId - b.equipeId).map((linha) => linha.equipeId)
const classificados = selecionarClassificados({
  formato: 'GRUPOS_MATA_MATA',
  faseEliminatoria: 'SEMIFINAL',
  quantidadeGrupos: 2,
  classificadosPorGrupo: 2,
  melhoresClassificadosGerais: 0,
  ordenados,
  grupos: [{ id: 1, classificados: 2 }, { id: 2, classificados: 2 }],
  vinculos: [
    { grupoId: 1, equipeId: 1 }, { grupoId: 1, equipeId: 2 }, { grupoId: 1, equipeId: 3 }, { grupoId: 1, equipeId: 4 },
    { grupoId: 2, equipeId: 5 }, { grupoId: 2, equipeId: 6 }, { grupoId: 2, equipeId: 7 }, { grupoId: 2, equipeId: 8 },
  ],
})
assert.deepEqual(Array.from(classificados).sort((a, b) => a - b), [1, 2, 5, 6])

const comMelhorGeral = selecionarClassificados({
  formato: 'GRUPOS_MATA_MATA',
  faseEliminatoria: 'SEMIFINAL',
  melhoresClassificadosGerais: 1,
  ordenados: [1, 5, 2, 6, 3, 7, 4, 8],
  grupos: [{ id: 1, classificados: 1 }, { id: 2, classificados: 1 }],
  vinculos: [
    { grupoId: 1, equipeId: 1 }, { grupoId: 1, equipeId: 2 }, { grupoId: 1, equipeId: 3 }, { grupoId: 1, equipeId: 4 },
    { grupoId: 2, equipeId: 5 }, { grupoId: 2, equipeId: 6 }, { grupoId: 2, equipeId: 7 }, { grupoId: 2, equipeId: 8 },
  ],
})
assert.equal(comMelhorGeral.has(2), true, 'o melhor segundo colocado geral também avança')
assert.equal(comMelhorGeral.has(1) && comMelhorGeral.has(5), true)

const mataMataPuro = selecionarClassificados({
  formato: 'MATA_MATA',
  faseEliminatoria: 'SEMIFINAL',
  classificadosPorGrupo: 0,
  ordenados: [1, 2, 3, 4],
})
assert.deepEqual(Array.from(mataMataPuro).sort((a, b) => a - b), [1, 2, 3, 4])

const semi1 = { rodada: 1, status: 'ENCERRADA', equipeAId: 1, equipeBId: 6, setsPorA: 2, setsPorB: 0, vencedorId: 1 }
const semi2 = { rodada: 2, status: 'ENCERRADA', equipeAId: 5, equipeBId: 2, setsPorA: 2, setsPorB: 1, vencedorId: 5 }
assert.deepEqual(vencedoresDosAlimentadores([semi1, semi2], 1), [1, 5])
assert.equal(vencedoresDosAlimentadores([semi1, { ...semi2, status: 'AGENDADA', vencedorId: null, setsPorA: null, setsPorB: null }], 1), null)
assert.deepEqual(perdedoresDasSemifinais([semi1, semi2]), [6, 2])
assert.equal(vencedorDaPartida({ status: 'WO', equipeAId: 9, equipeBId: 10, setsPorA: 0, setsPorB: 0, vencedorId: 9 }), 9)
assert.equal(vencedorDaPartida({ status: 'ENCERRADA', equipeAId: 1, equipeBId: 5, setsPorA: 2, setsPorB: 0, vencedorId: null }), 1)

const baseFinal = {
  liga: { formato: 'GRUPOS_MATA_MATA', faseEliminatoria: 'SEMIFINAL', disputaTerceiroLugar: true },
  categorias: [{ categoriaCampeonatoId: CATEGORIA, formato: 'GRUPOS_MATA_MATA', faseEliminatoria: 'SEMIFINAL', disputaTerceiroLugar: true }],
  classificacao: tabelaGrupos.map((linha) => ({ equipeId: linha.equipeId, posicao: linha.posicao, jogos: linha.jogos, categoriaCampeonatoId: CATEGORIA })),
}

const partidasGrupo = [...gruposA, ...gruposB].map((partida) => ({
  ...partida,
  fase: 'GRUPOS',
  categoriaCampeonatoId: CATEGORIA,
}))
const semFinal = avaliarFinalizacao({
  ...baseFinal,
  partidas: [...partidasGrupo, { ...semi1, fase: 'SEMIFINAL', categoriaCampeonatoId: CATEGORIA }, { ...semi2, fase: 'SEMIFINAL', categoriaCampeonatoId: CATEGORIA }],
})
assert.equal(semFinal.ok, false)

const finalAgendada = avaliarFinalizacao({
  ...baseFinal,
  partidas: [
    ...partidasGrupo,
    { ...semi1, fase: 'SEMIFINAL', categoriaCampeonatoId: CATEGORIA },
    { ...semi2, fase: 'SEMIFINAL', categoriaCampeonatoId: CATEGORIA },
    { fase: 'FINAL', status: 'AGENDADA', equipeAId: 1, equipeBId: 5, setsPorA: null, setsPorB: null, vencedorId: null, categoriaCampeonatoId: CATEGORIA },
  ],
})
assert.equal(finalAgendada.ok, false)

const finalSemTerceiro = avaliarFinalizacao({
  ...baseFinal,
  partidas: [
    ...partidasGrupo,
    { ...semi1, fase: 'SEMIFINAL', categoriaCampeonatoId: CATEGORIA },
    { ...semi2, fase: 'SEMIFINAL', categoriaCampeonatoId: CATEGORIA },
    { fase: 'FINAL', status: 'ENCERRADA', equipeAId: 1, equipeBId: 5, setsPorA: 2, setsPorB: 0, vencedorId: 1, categoriaCampeonatoId: CATEGORIA },
  ],
})
assert.equal(finalSemTerceiro.ok, false)

const campeonato = avaliarFinalizacao({
  ...baseFinal,
  partidas: [
    ...partidasGrupo,
    { ...semi1, fase: 'SEMIFINAL', categoriaCampeonatoId: CATEGORIA },
    { ...semi2, fase: 'SEMIFINAL', categoriaCampeonatoId: CATEGORIA },
    { fase: 'FINAL', status: 'ENCERRADA', equipeAId: 1, equipeBId: 5, setsPorA: 2, setsPorB: 0, vencedorId: 1, categoriaCampeonatoId: CATEGORIA },
    { fase: 'TERCEIRO_LUGAR', status: 'ENCERRADA', equipeAId: 6, equipeBId: 2, setsPorA: 0, setsPorB: 2, vencedorId: 2, categoriaCampeonatoId: CATEGORIA },
  ],
})
assert.equal(campeonato.ok, true)
if (campeonato.ok) assert.equal(campeonato.campeoes[0]?.equipeId, 1)

const semDisputaDeTerceiro = avaliarFinalizacao({
  liga: { formato: 'GRUPOS_MATA_MATA', faseEliminatoria: 'SEMIFINAL', disputaTerceiroLugar: false },
  categorias: [{ categoriaCampeonatoId: CATEGORIA, formato: 'GRUPOS_MATA_MATA', faseEliminatoria: 'SEMIFINAL', disputaTerceiroLugar: false }],
  classificacao: baseFinal.classificacao,
  partidas: [
    ...partidasGrupo,
    { ...semi1, fase: 'SEMIFINAL', categoriaCampeonatoId: CATEGORIA },
    { ...semi2, fase: 'SEMIFINAL', categoriaCampeonatoId: CATEGORIA },
    { fase: 'FINAL', status: 'WO', equipeAId: 1, equipeBId: 5, setsPorA: 0, setsPorB: 0, vencedorId: 1, categoriaCampeonatoId: CATEGORIA },
  ],
})
assert.equal(semDisputaDeTerceiro.ok, true)
if (semDisputaDeTerceiro.ok) assert.equal(semDisputaDeTerceiro.campeoes[0]?.equipeId, 1)

const pontosCorridos = avaliarFinalizacao({
  liga: { formato: 'PONTOS_CORRIDOS', faseEliminatoria: 'NENHUMA' },
  partidas: gruposA.map((partida) => ({ ...partida, categoriaCampeonatoId: null })),
  classificacao: tabelaGrupos.filter((linha) => linha.equipeId <= 4).map((linha) => ({
    equipeId: linha.equipeId,
    posicao: linha.posicao,
    jogos: linha.jogos,
    categoriaCampeonatoId: null,
  })),
})
assert.equal(pontosCorridos.ok, true)
if (pontosCorridos.ok) assert.equal(pontosCorridos.campeoes[0]?.equipeId, 1)

const grupoAberto = avaliarFinalizacao({
  liga: { formato: 'PONTOS_CORRIDOS', faseEliminatoria: 'NENHUMA' },
  partidas: [{ fase: 'GRUPOS', status: 'AGENDADA', equipeAId: 1, equipeBId: 2, setsPorA: null, setsPorB: null, vencedorId: null }],
  classificacao: [{ equipeId: 1, posicao: 1, jogos: 1 }],
})
assert.equal(grupoAberto.ok, false)

const inicio = new Date('2026-10-09T12:00:00.000Z')
assert.equal(correcaoPeloLinkPermitida(null, inicio), true)
assert.equal(correcaoPeloLinkPermitida(inicio.toISOString(), new Date(inicio.getTime() + JANELA_CORRECAO_SUMULA_MS)), true)
assert.equal(correcaoPeloLinkPermitida(inicio.toISOString(), new Date(inicio.getTime() + JANELA_CORRECAO_SUMULA_MS + 1)), false)

const equipes = [{ id: 1, nome: 'Alpha' }, { id: 2, nome: 'Bravo' }]
const substituicao = (set: number, nome: string, saiu: number, entrou: number) => ({
  tipo: 'substitution',
  set,
  descricao: `Substituição ${nome}: sai #${saiu}, entra #${entrou}.`,
})
assert.equal(validarSubstituicoes({
  equipes,
  ocorrencias: Array.from({ length: 8 }, (_, indice) => substituicao(1, 'Alpha', indice + 1, indice + 11)),
}), null)
assert.match(validarSubstituicoes({
  equipes,
  ocorrencias: Array.from({ length: 9 }, (_, indice) => substituicao(1, 'Alpha', indice + 1, indice + 11)),
}) ?? '', /8 substituições/)
assert.equal(validarSubstituicoes({
  equipes,
  ocorrencias: [
    ...Array.from({ length: 8 }, (_, indice) => substituicao(1, 'Alpha', indice + 1, indice + 11)),
    { tipo: 'troca_libero', set: 1, descricao: 'Troca de líbero Alpha: sai #15, entra #16.' },
  ],
}), null, 'líbero não consome a cota')
assert.match(validarSubstituicoes({
  equipes,
  ocorrencias: [
    substituicao(1, 'Alpha', 4, 10),
    substituicao(1, 'Alpha', 4, 12),
  ],
}) ?? '', /par já formado/)
assert.equal(validarSubstituicoes({
  equipes,
  ocorrencias: [
    substituicao(1, 'Alpha', 4, 10),
    substituicao(1, 'Alpha', 10, 4),
    substituicao(2, 'Alpha', 4, 12),
  ],
}), null, 'o par reinicia no set seguinte e a reversão é permitida')

console.log('Campeonato completo passou: faixas de pontos, tabela, ao vivo, WO, classificados, chave, campeão e súmula.')
