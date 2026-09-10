import assert from 'node:assert/strict'
import {
  ACTIVATION_PRICE_CENTS,
  MATCH_PRICE_CENTS,
  QR_CODE_PRICE_CENTS,
  SCORESHEET_SCOUTS_PRICE_CENTS,
  calculateChampionshipPrice,
  estimateMatchCount,
  getVolumeDiscountPercent,
} from '../src/lib/pricing'

// --- Valores oficiais -----------------------------------------------------
assert.equal(ACTIVATION_PRICE_CENTS, 4900, 'ativação = R$ 49,00')
assert.equal(MATCH_PRICE_CENTS, 390, 'gestão básica = R$ 3,90/partida')
assert.equal(SCORESHEET_SCOUTS_PRICE_CENTS, 990, 'súmula + scouts = R$ 9,90/partida')
assert.equal(QR_CODE_PRICE_CENTS, 150, 'QR Code = R$ 1,50/partida')

// --- Faixas de desconto por volume ---------------------------------------
assert.equal(getVolumeDiscountPercent(1), 0)
assert.equal(getVolumeDiscountPercent(20), 0)
assert.equal(getVolumeDiscountPercent(21), 0.05)
assert.equal(getVolumeDiscountPercent(40), 0.05)
assert.equal(getVolumeDiscountPercent(41), 0.08)
assert.equal(getVolumeDiscountPercent(80), 0.08)
assert.equal(getVolumeDiscountPercent(81), 0.12)
assert.equal(getVolumeDiscountPercent(150), 0.12)
assert.equal(getVolumeDiscountPercent(151), 0.15)
assert.equal(getVolumeDiscountPercent(0), 0, 'sem partidas não há faixa de desconto')

// --- Cálculo do preço -----------------------------------------------------
// 25 partidas, só gestão básica: 25 × 3,90 = 97,50; faixa 21-40 = 5% -> 4,88
const basico = calculateChampionshipPrice({ matchCount: 25 })
assert.equal(basico.matchUnitCents, 390)
assert.equal(basico.subtotalCents, 9750)
assert.equal(basico.discountPercent, 0.05)
assert.equal(basico.discountCents, 488, 'desconto arredondado em centavos (9750 × 0,05 = 487,5 -> 488)')
assert.equal(basico.totalCents, 4900 + 9750 - 488)

// Sem desconto na faixa inicial, com os dois recursos ligados:
// valor_partida = 3,90 + 9,90 + 1,50 = 15,30; 10 partidas = 153,00; total = 202,00
const completo = calculateChampionshipPrice({ matchCount: 10, sumulaScoutsEnabled: true, qrCodeEnabled: true })
assert.equal(completo.matchUnitCents, 1530)
assert.equal(completo.subtotalCents, 15300)
assert.equal(completo.discountCents, 0)
assert.equal(completo.totalCents, 20200)

// A ativação nunca recebe desconto: com 200 partidas (15%), o desconto
// incide só sobre o subtotal variável.
const volumoso = calculateChampionshipPrice({ matchCount: 200 })
assert.equal(volumoso.subtotalCents, 200 * 390)
assert.equal(volumoso.discountCents, Math.round(200 * 390 * 0.15))
assert.equal(volumoso.totalCents, 4900 + volumoso.subtotalCents - volumoso.discountCents)
assert.equal(volumoso.activationCents, 4900, 'ativação inteira, sem desconto')

// Campeonato sem partidas: só a ativação.
const zerado = calculateChampionshipPrice({ matchCount: 0, sumulaScoutsEnabled: true })
assert.equal(zerado.subtotalCents, 0)
assert.equal(zerado.totalCents, 4900)

// Linhas desligadas aparecem zeradas (a UI mostra "R$ 0,00", não some).
const semRecursos = calculateChampionshipPrice({ matchCount: 12 })
assert.equal(semRecursos.items.find((i) => i.key === 'sumulaScouts')?.totalCents, 0)
assert.equal(semRecursos.items.find((i) => i.key === 'qrCode')?.totalCents, 0)

// --- Estimativa de partidas ----------------------------------------------
// 12 equipes em 3 grupos = 3 grupos de 4 = 3 × C(4,2) = 18
const grupos = estimateMatchCount({ formato: 'PONTOS_CORRIDOS', quantidadeEquipes: 12, quantidadeGrupos: 3 })
assert.equal(grupos.disponivel, true)
assert.equal(grupos.faseDeGrupos, 18)
assert.equal(grupos.eliminatorias, 0)
assert.equal(grupos.total, 18)

// Turno e returno dobra a fase de grupos.
const idaEVolta = estimateMatchCount({ formato: 'PONTOS_CORRIDOS', quantidadeEquipes: 12, quantidadeGrupos: 3, turnoReturno: true })
assert.equal(idaEVolta.faseDeGrupos, 36)

// Distribuição desigual: 10 equipes em 3 grupos = 4+3+3 = 6+3+3 = 12
const desigual = estimateMatchCount({ formato: 'PONTOS_CORRIDOS', quantidadeEquipes: 10, quantidadeGrupos: 3 })
assert.equal(desigual.faseDeGrupos, 12)

// Grupos + mata-mata: 8 equipes em 2 grupos (2 × C(4,2) = 12) + quartas
// (8-1 = 7) + disputa de 3º = 20
const completoEstrutura = estimateMatchCount({
  formato: 'GRUPOS_MATA_MATA',
  quantidadeEquipes: 8,
  quantidadeGrupos: 2,
  faseEliminatoria: 'QUARTAS',
  disputaTerceiroLugar: true,
})
assert.equal(completoEstrutura.faseDeGrupos, 12)
assert.equal(completoEstrutura.eliminatorias, 8)
assert.equal(completoEstrutura.total, 20)

// Sem disputa de 3º, uma a menos.
const semTerceiro = estimateMatchCount({
  formato: 'GRUPOS_MATA_MATA',
  quantidadeEquipes: 8,
  quantidadeGrupos: 2,
  faseEliminatoria: 'QUARTAS',
  disputaTerceiroLugar: false,
})
assert.equal(semTerceiro.eliminatorias, 7)

// Final (2 equipes) não gera disputa de 3º, mesmo com o flag ligado.
const soFinal = estimateMatchCount({ formato: 'MATA_MATA', faseEliminatoria: 'FINAL', disputaTerceiroLugar: true })
assert.equal(soFinal.eliminatorias, 1, 'final é 1 jogo e não tem disputa de terceiro')

// Borda: mata-mata puro NÃO tem fase de grupos.
const mataMataPuro = estimateMatchCount({ formato: 'MATA_MATA', quantidadeEquipes: 8, quantidadeGrupos: 2, faseEliminatoria: 'QUARTAS' })
assert.equal(mataMataPuro.faseDeGrupos, 0, 'mata-mata puro não gera partidas de grupo')
assert.equal(mataMataPuro.total, 7)

// Borda: sem formato definido, a estimativa é indisponível (nunca 0, senão
// a UI cotaria só a ativação para um campeonato inteiro).
const semFormato = estimateMatchCount({ formato: null, quantidadeEquipes: 12 })
assert.equal(semFormato.disponivel, false)
assert.equal(semFormato.total, 0)

// Borda: formato com grupos mas sem equipes suficientes.
const semEquipes = estimateMatchCount({ formato: 'PONTOS_CORRIDOS', quantidadeEquipes: 1 })
assert.equal(semEquipes.disponivel, false)

// Borda: ida e volta NÃO dobra as eliminatórias (não há gerador de jogo de
// volta hoje — cobrar dobrado seria cobrar por partida inexistente).
const eliminatoriaIdaVolta = estimateMatchCount({ formato: 'MATA_MATA', faseEliminatoria: 'SEMIFINAL', disputaTerceiroLugar: false })
assert.equal(eliminatoriaIdaVolta.eliminatorias, 3)

console.log('Pricing Engine validada: valores oficiais, faixas de desconto, cálculo e estimativa de partidas.')
