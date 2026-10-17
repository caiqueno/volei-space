/**
 * Adaptador tela -> fila (modo sombra): uma tradução por tipo de ocorrência, validação com o schema do servidor,
 * DESFAZ por referência, flag liga/desliga e descarte seguro (nunca lança).
 */
import assert from 'node:assert/strict'
import { eventoRecebidoSchema } from '../src/lib/sumula-eventos/esquema'
import {
  espelharOcorrencia,
  filaAtivaNoBuild,
  filaDaSumulaAtiva,
  LivroEspelho,
  traduzirOcorrencia,
  type Ocorrencia,
} from '../src/lib/sumula-ui/fila-adaptador'
import type { EventoNovo } from '../src/lib/sumula-offline/tipos'

let n = 0
const gerarId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`
const um = (o: Ocorrencia, livro = new LivroEspelho()) => {
  const t = traduzirOcorrencia(o, livro, gerarId)
  assert.ok(t.ok, t.ok ? '' : t.motivo)
  return t.ok ? t.eventos : []
}
const seis = [1, 2, 3, 4, 5, 6]
const seisB = [11, 12, 13, 14, 15, 16]

// Flag: só '1' liga
assert.equal(filaDaSumulaAtiva('1'), true)
for (const v of [undefined, null, '', '0', 'true', 'on', ' 1', '11']) assert.equal(filaDaSumulaAtiva(v as string | undefined), false, String(v))
const anterior = process.env.NEXT_PUBLIC_SUMULA_EVENTOS_ATIVO
delete process.env.NEXT_PUBLIC_SUMULA_EVENTOS_ATIVO
assert.equal(filaAtivaNoBuild(), false, 'padrão desligado')
process.env.NEXT_PUBLIC_SUMULA_EVENTOS_ATIVO = '1'
assert.equal(filaAtivaNoBuild(), true)
process.env.NEXT_PUBLIC_SUMULA_EVENTOS_ATIVO = '0'
assert.equal(filaAtivaNoBuild(), false)
if (anterior === undefined) delete process.env.NEXT_PUBLIC_SUMULA_EVENTOS_ATIVO
else process.env.NEXT_PUBLIC_SUMULA_EVENTOS_ATIVO = anterior

// PONTO (com e sem sacador)
{
  const [e] = um({ tipo: 'PONTO', telaId: 'a', equipe: 'teamB', sacadorId: 7 })
  assert.equal(e.tipo, 'PONTO')
  assert.deepEqual(e.payload, { equipe: 'B', sacador: 7 })
  const [s] = um({ tipo: 'PONTO', telaId: 'b', equipe: 'teamA', sacadorId: null })
  assert.deepEqual(s.payload, { equipe: 'A' })
}

// SET_INICIADO
{
  const [e] = um({ tipo: 'SET_INICIADO', numeroSet: 1, formacaoA: seis, formacaoB: seisB, saqueInicial: 'teamA', liberosA: [20], liberosB: [undefined] })
  assert.deepEqual(e.payload, { numeroSet: 1, formacaoA: seis, formacaoB: seisB, saqueInicial: 'A', liberosA: [20] })
  const ruim = traduzirOcorrencia({ tipo: 'SET_INICIADO', numeroSet: 1, formacaoA: [1, 2, 3, 4, 5, null], formacaoB: seisB, saqueInicial: 'teamA' }, new LivroEspelho(), gerarId)
  assert.equal(ruim.ok, false)
  const curta = traduzirOcorrencia({ tipo: 'SET_INICIADO', numeroSet: 1, formacaoA: [1, 2, 3], formacaoB: seisB, saqueInicial: 'teamA' }, new LivroEspelho(), gerarId)
  assert.equal(curta.ok, false)
}

// TEMPO, SUBSTITUICAO (normal e excepcional), TROCA_LIBERO
assert.deepEqual(um({ tipo: 'TEMPO', equipe: 'teamB' })[0].payload, { equipe: 'B' })
assert.deepEqual(um({ tipo: 'SUBSTITUICAO', telaId: 's', equipe: 'teamA', saiId: 3, entraId: 9 })[0].payload, { equipe: 'A', sai: 3, entra: 9 })
assert.deepEqual(
  um({ tipo: 'SUBSTITUICAO', telaId: 's2', equipe: 'teamA', saiId: 3, entraId: 9, excepcional: true, motivo: 'LESAO' })[0].payload,
  { equipe: 'A', sai: 3, entra: 9, excepcional: true, motivo: 'LESAO' },
)
assert.equal(traduzirOcorrencia({ tipo: 'SUBSTITUICAO', telaId: 'x', equipe: 'teamA', saiId: null, entraId: 9 }, new LivroEspelho(), gerarId).ok, false)
assert.deepEqual(um({ tipo: 'TROCA_LIBERO', telaId: 'l', equipe: 'teamB', saiId: 4, entraId: 20 })[0].payload, { equipe: 'B', sai: 4, entra: 20 })
assert.equal(traduzirOcorrencia({ tipo: 'TROCA_LIBERO', telaId: 'l', equipe: 'teamB', saiId: 4, entraId: undefined }, new LivroEspelho(), gerarId).ok, false)

// SANCAO (jogador, técnico, equipe, atraso)
assert.deepEqual(um({ tipo: 'SANCAO', telaId: 'c1', equipe: 'teamA', categoria: 'MENOR', jogadorId: 8, membro: 'EQUIPE' })[0].payload, { equipe: 'A', membro: 'J:8', categoria: 'MENOR' })
assert.deepEqual(um({ tipo: 'SANCAO', telaId: 'c2', equipe: 'teamB', categoria: 'GROSSEIRA', membro: 'TECNICO' })[0].payload, { equipe: 'B', membro: 'TECNICO', categoria: 'GROSSEIRA' })
assert.deepEqual(um({ tipo: 'SANCAO', telaId: 'c3', equipe: 'teamB', categoria: 'ATRASO', membro: 'EQUIPE' })[0].payload, { equipe: 'B', membro: 'EQUIPE', categoria: 'ATRASO' })

// TROCA_LADO, WO, SET_ANULADO, OBSERVACAO
assert.deepEqual(um({ tipo: 'TROCA_LADO' })[0].payload, {})
assert.deepEqual(um({ tipo: 'WO', ausente: 'teamA' })[0].payload, { ausente: 'A' })
assert.deepEqual(um({ tipo: 'WO', ausente: 'AMBAS' })[0].payload, { ausente: 'AMBAS' })
assert.deepEqual(um({ tipo: 'SET_ANULADO' })[0].payload, {})
assert.deepEqual(um({ tipo: 'OBSERVACAO', texto: '  bola furou ' })[0].payload, { texto: 'bola furou' })
assert.equal(traduzirOcorrencia({ tipo: 'OBSERVACAO', texto: '   ' }, new LivroEspelho(), gerarId).ok, false)

// Todo evento traduzido passa no envelope do servidor (uuid, tipo, payload)
{
  const livro = new LivroEspelho()
  const amostras: Ocorrencia[] = [
    { tipo: 'PONTO', telaId: 'p', equipe: 'teamA' },
    { tipo: 'TEMPO', equipe: 'teamA' },
    { tipo: 'WO', ausente: 'teamB' },
    { tipo: 'TROCA_LADO' },
  ]
  for (const o of amostras) {
    for (const e of um(o, livro)) assert.ok(eventoRecebidoSchema.safeParse({ ...e, ocorridoEm: undefined }).success, o.tipo)
  }
}

// DESFAZ: ordem inversa, só do que foi espelhado, referência por clientEventId e sem repetir
{
  const livro = new LivroEspelho()
  const enviados: EventoNovo[] = []
  const destino = { enfileirar: async (e: EventoNovo) => void enviados.push(e) }
  const motivos: string[] = []
  const log = (m: string) => motivos.push(m)
  assert.equal(espelharOcorrencia(destino, livro, { tipo: 'PONTO', telaId: 't1', equipe: 'teamA' }, log, gerarId), true)
  assert.equal(espelharOcorrencia(destino, livro, { tipo: 'SUBSTITUICAO', telaId: 't2', equipe: 'teamA', saiId: 1, entraId: 9 }, log, gerarId), true)
  assert.equal(espelharOcorrencia(destino, livro, { tipo: 'PONTO', telaId: 't3', equipe: 'teamB' }, log, gerarId), true)
  assert.equal(enviados.length, 3)
  // 't0' (ex.: anotação de troca de saque) nunca foi espelhado: é ignorado
  assert.equal(espelharOcorrencia(destino, livro, { tipo: 'DESFAZ', telaIds: ['t1', 't0', 't3'] }, log, gerarId), true)
  const desfazes = enviados.slice(3)
  assert.equal(desfazes.length, 2)
  assert.ok(desfazes.every((d) => d.tipo === 'DESFAZ'))
  assert.equal(desfazes[0].desfazClientEventId, enviados[2].clientEventId, 'o mais novo primeiro')
  assert.equal(desfazes[1].desfazClientEventId, enviados[0].clientEventId)
  assert.notEqual(desfazes[0].clientEventId, desfazes[1].clientEventId)
  assert.equal(livro.tamanho, 1, 'só t2 continua no livro')
  // desfazer de novo o mesmo registro: nada a fazer, descartado sem erro
  assert.equal(espelharOcorrencia(destino, livro, { tipo: 'DESFAZ', telaIds: ['t1'] }, log, gerarId), false)
  assert.equal(enviados.length, 5)
  assert.equal(motivos.length, 1)
  assert.ok(desfazes.every((d) => eventoRecebidoSchema.safeParse({ ...d }).success))
}

// Descarte seguro: tradução inválida, fila que lança, fila que rejeita, log que lança
{
  const livro = new LivroEspelho()
  const motivos: string[] = []
  const destinoOk = { enfileirar: async () => undefined }
  assert.equal(espelharOcorrencia(destinoOk, livro, { tipo: 'SUBSTITUICAO', telaId: 'x', equipe: 'teamA', saiId: null, entraId: null }, (m) => motivos.push(m), gerarId), false)
  assert.equal(motivos.length, 1)
  assert.equal(livro.tamanho, 0, 'descartado não entra no livro')

  const quebrado = { enfileirar: () => { throw new Error('IndexedDB caiu') } }
  assert.doesNotThrow(() => espelharOcorrencia(quebrado, livro, { tipo: 'PONTO', telaId: 'y', equipe: 'teamA' }, (m) => motivos.push(m), gerarId))
  assert.ok(motivos.some((m) => m.includes('IndexedDB caiu')))

  const rejeita = { enfileirar: () => Promise.reject(new Error('cheio')) }
  assert.doesNotThrow(() => espelharOcorrencia(rejeita, livro, { tipo: 'PONTO', telaId: 'z', equipe: 'teamA' }, (m) => motivos.push(m), gerarId))

  const logQueLanca = () => {
    throw new Error('log quebrou')
  }
  assert.doesNotThrow(() => espelharOcorrencia(quebrado, livro, { tipo: 'PONTO', telaId: 'w', equipe: 'teamA' }, logQueLanca, gerarId))
  assert.doesNotThrow(() => espelharOcorrencia(destinoOk, livro, { tipo: 'PONTO', telaId: 'v', equipe: 'teamA' }, logQueLanca, () => { throw new Error('sem uuid') }))
  // entrada absurda vinda da tela
  assert.doesNotThrow(() => espelharOcorrencia(destinoOk, livro, { tipo: 'NAO_EXISTE' } as unknown as Ocorrencia, logQueLanca, gerarId))
  assert.equal(traduzirOcorrencia({ tipo: 'NAO_EXISTE' } as unknown as Ocorrencia, livro, gerarId).ok, false)
}

setTimeout(() => console.log('sumula-fila-adaptador: ok'), 20)
