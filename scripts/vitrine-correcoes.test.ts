import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { agendaDaPartida } from '../src/lib/format-partida'
import { normalizarNomeEquipe } from '../src/lib/nome-equipe'
import { montarConfrontos, type ConfrontoGerado } from '../src/lib/rodadas'
import { equipeSchema } from '../src/lib/schemas'

type Time = { id: number }
type Jogo = ConfrontoGerado<Time>

function times(...ids: number[]): Time[] {
  return ids.map((id) => ({ id }))
}

function semRepetirNaRodada(jogos: Array<{ aId: number; bId: number; rodada: number }>) {
  const ocupacao = new Map<number, Set<number>>()
  for (const jogo of jogos) {
    const timesDaRodada = ocupacao.get(jogo.rodada) ?? new Set<number>()
    assert.equal(timesDaRodada.has(jogo.aId), false, `equipe ${jogo.aId} repetida na rodada ${jogo.rodada}`)
    assert.equal(timesDaRodada.has(jogo.bId), false, `equipe ${jogo.bId} repetida na rodada ${jogo.rodada}`)
    timesDaRodada.add(jogo.aId)
    timesDaRodada.add(jogo.bId)
    ocupacao.set(jogo.rodada, timesDaRodada)
  }
}

function comoExistentes(jogos: Jogo[]) {
  return jogos.map((jogo) => ({ aId: jogo.a.id, bId: jogo.b.id, rodada: jogo.rodada }))
}

const quatro = times(266, 267, 268, 269)
const turno = montarConfrontos(quatro)
assert.equal(turno.length, 6)
assert.deepEqual(Array.from(new Set(turno.map((jogo) => jogo.rodada))).sort((a, b) => a - b), [1, 2, 3])
for (const rodada of [1, 2, 3]) {
  assert.equal(turno.filter((jogo) => jogo.rodada === rodada).length, 2)
}
semRepetirNaRodada(comoExistentes(turno))
assert.equal(turno.some((jogo) => jogo.rodada >= 4), false)

const cinco = montarConfrontos(times(1, 2, 3, 4, 5))
assert.equal(cinco.length, 10)
assert.equal(Math.max(...cinco.map((jogo) => jogo.rodada)), 5)
semRepetirNaRodada(comoExistentes(cinco))

const tres = montarConfrontos(times(266, 267, 268))
assert.equal(tres.length, 3)
assert.deepEqual(tres.map((jogo) => jogo.rodada), [1, 2, 3])

const returno = montarConfrontos(quatro, [], true)
assert.equal(returno.length, 12)
assert.equal(Math.max(...returno.map((jogo) => jogo.rodada)), 6)
semRepetirNaRodada(comoExistentes(returno))
const chavesReturno = returno.map((jogo) => `${jogo.a.id}>${jogo.b.id}`)
assert.equal(Array.from(new Set(chavesReturno)).length, 12)

const novos = montarConfrontos(quatro, comoExistentes(tres))
const targetRs = novos.find((jogo) => jogo.a.id === 268 && jogo.b.id === 269)
assert.ok(targetRs)
assert.equal(targetRs.rodada === 6, false)
const completo = comoExistentes(tres).concat(comoExistentes(novos))
assert.equal(completo.length, 6)
assert.equal(Math.max(...completo.map((jogo) => jogo.rodada)), 3)
semRepetirNaRodada(completo)

const producao = [
  { aId: 266, bId: 267, rodada: 1 },
  { aId: 266, bId: 268, rodada: 2 },
  { aId: 267, bId: 268, rodada: 3 },
  { aId: 266, bId: 269, rodada: 3 },
  { aId: 267, bId: 269, rodada: 5 },
  { aId: 268, bId: 269, rodada: 6 },
]
assert.deepEqual(montarConfrontos(quatro, producao), [])

const finalEncerrada = agendaDaPartida({
  status: 'ENCERRADA',
  fase: 'FINAL',
  rodada: 1,
  dataHora: null,
  localNome: 'A definir',
})
assert.equal(finalEncerrada.rotulo, 'Final')
assert.equal(finalEncerrada.data, null)
assert.equal(finalEncerrada.local, null)

const terceiro = agendaDaPartida({ status: 'AGENDADA', fase: 'TERCEIRO_LUGAR', rodada: 1, dataHora: null, localNome: null })
assert.equal(terceiro.rotulo, '3º lugar')
assert.equal(terceiro.data, 'A definir')
assert.equal(terceiro.local, null)

const grupo = agendaDaPartida({ status: 'AGENDADA', fase: 'GERAL', rodada: 2, dataHora: null, localNome: 'Ginásio' })
assert.equal(grupo.rotulo, 'Rodada 2')
assert.equal(grupo.data, 'A definir')
assert.equal(grupo.local, 'Ginásio')

assert.equal(normalizarNomeEquipe('  são paulo fc  '), 'SÃO PAULO FC')
assert.equal(equipeSchema.parse({ nome: 'Angels', ligaId: 60, categoria: 'MASCULINO' }).nome, 'ANGELS')

const css = readFileSync('src/app/globals.css', 'utf8')
const variaveis: Record<string, string> = {}
const variavel = /--(vs-elevated|vs-text|vs-gold):\s*(#[0-9A-Fa-f]{6})/g
let encontrado = variavel.exec(css)
while (encontrado) {
  variaveis[encontrado[1]] = encontrado[2]
  encontrado = variavel.exec(css)
}
assert.equal(variaveis['vs-elevated'], '#16243D')
assert.equal(variaveis['vs-text'], '#F5F7FB')
assert.equal(variaveis['vs-gold'], '#FFB331')
assert.match(css, /html body \.luva-card \.match-meta[\s\S]*background:\s*var\(--vs-elevated\)/)
assert.match(css, /html body \.luva-card \.match-meta :is\(p, span\)[\s\S]*color:\s*var\(--vs-text\)/)
assert.match(css, /html body \.luva-card \.match-meta svg[\s\S]*color:\s*var\(--vs-gold\)/)
assert.ok(contraste(variaveis['vs-text'], variaveis['vs-elevated']) >= 4.5)
assert.ok(contraste(variaveis['vs-gold'], variaveis['vs-elevated']) >= 3)

const card = readFileSync('src/components/partidas/PartidaCard.tsx', 'utf8')
assert.match(card, /className="match-meta mt-auto/)
assert.equal(card.includes('bg-slate-50'), false)
const aoVivo = readFileSync('src/app/partidas/[id]/ao-vivo/LiveMatchView.tsx', 'utf8')
assert.equal(aoVivo.includes('Rodada {match.rodada}'), false)
assert.match(aoVivo, /agendaDaPartida/)

function contraste(frente: string, fundo: string) {
  const [claro, escuro] = [luminancia(frente), luminancia(fundo)].sort((a, b) => b - a)
  return (claro + 0.05) / (escuro + 0.05)
}

function luminancia(hex: string) {
  const canais = [0, 2, 4].map((indice) => {
    const canal = parseInt(hex.slice(indice + 1, indice + 3), 16) / 255
    return canal <= 0.03928 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * canais[0] + 0.7152 * canais[1] + 0.0722 * canais[2]
}

console.log('vitrine-correcoes: ok')
