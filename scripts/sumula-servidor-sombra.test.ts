/**
 * Revalidação em modo sombra (PUT /api/sumula/[token]): ocorrências no formato REAL da tela
 * ("<hora> | <placar> | <texto>", mais novo primeiro), geradas com os módulos puros da própria tela.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { textoPonto, textoPontoSemJogador } from '../src/lib/ponto-sumula'
import { marcarSaqueInicial } from '../src/lib/saque-inicial'
import { textoLiberoInicial } from '../src/lib/libero-sumula'
import { textoTempo } from '../src/lib/sumula-ui/tempos'
import { marcadorExcepcional, marcadorSancao } from '../src/lib/sumula-ui/estado'
import { avaliarCartao, descreverEfeito, equipeDoMotor } from '../src/lib/sumula-ui/sancao'
import type { SancaoRegistrada } from '../src/lib/regras-volei'
import { anexarOverride } from '../src/lib/sumula-ui/override'
import { revalidarEmSombra, sombraAtiva, type EntradaSombra } from '../src/lib/sumula-servidor/sombra'

const ALFA = 'ALFA'
const BETA = 'BETA'
const jogadores = (base: number) => Array.from({ length: 12 }, (_, i) => ({ id: base + i + 1, numero: i + 1 }))
const equipeA = { nome: ALFA, jogadores: jogadores(100) } // ids 101..112, camisas 1..12
const equipeB = { nome: BETA, jogadores: jogadores(200) } // ids 201..212, camisas 1..12
const camisaA = (n: number) => 100 + n
const lineupA = ['4', '3', '2', '5', '6', '1'] // ordem da tela [P4,P3,P2,P5,P6,P1]
const lineupB = ['4', '3', '2', '5', '6', '1']

type Linha = { tipo: string; descricao: string; set: number; jogadorId: number | null }
const gravadas: Linha[] = [] // cronológico; a tela envia do mais novo para o mais antigo
let relogio = 1_700_000_000_000
const rot = (saque: 'teamA' | 'teamB', a = lineupA, b = lineupB) => ` [[ROT:${++relogio}:${saque}:${a.join(',')}:${b.join(',')}]]`
const grava = (tipo: string, texto: string, set = 1, score = '0 x 0', jogadorId: number | null = null) =>
  gravadas.push({ tipo, descricao: `19:00 | ${score} | ${texto}`, set, jogadorId })
const enviadas = () => [...gravadas].reverse()
const limpar = () => { gravadas.length = 0 }

function iniciarSet(numero: number, saque: 'teamA' | 'teamB' = 'teamA') {
  grava('set_start', `Papeleta do set ${numero} confirmada para os dois times. Líberos iniciais: ${ALFA} ${textoLiberoInicial('')} e ${BETA} ${textoLiberoInicial('')}. Saque inicial: ${saque === 'teamA' ? ALFA : BETA} começa sacando. ${marcarSaqueInicial(saque)}${rot(saque)}`, numero)
}
const pontoA = () => grava('point', textoPontoSemJogador(ALFA))
const pontoB = () => grava('point', textoPontoSemJogador(BETA))
const ataqueB = () => grava('attack', textoPonto('attack', BETA, '3', 'Fulano'), 1, '0 x 1', 203)

const regras = { setsPorPartida: 3, pontosPorSet: 25, pontosUltimoSet: 15, tieBreakUltimoSet: true, limiteSubstituicoesPorSet: 6, limiteTemposPorSet: 2 }
const entrada = (sets: Array<[number, number, number]>, ocorrencias = enviadas()): EntradaSombra => ({
  equipeAId: 1,
  equipeBId: 2,
  equipeA,
  equipeB,
  presencas: [],
  ocorrencias,
  sets: sets.map(([numero, pontosA, pontosB]) => ({ numero, pontosA, pontosB })),
  regras: regras as EntradaSombra['regras'],
})
const rodar = (e: EntradaSombra, logs: string[] = []) => revalidarEmSombra(() => e, { ativa: true, partidaId: 9, registrar: (m) => logs.push(m) })

// 1) Partida consistente: sem avisos, sem divergência
{
  limpar()
  iniciarSet(1)
  pontoA(); pontoA(); pontoB(); pontoA(); ataqueB(); pontoA()
  grava('timeout', textoTempo(BETA, 1, 1, 2))
  pontoB()
  const logs: string[] = []
  const r = rodar(entrada([[1, 4, 3]]), logs)
  assert.ok(r)
  assert.deepEqual(r.avisosMotor, [], JSON.stringify(r.avisosMotor))
  assert.equal(r.divergenciaPlacar, undefined)
  assert.equal(logs.length, 1)
  assert.match(logs[0], /^\[sumula-sombra\] \{"partidaId":9,"avisos":0,"erros":0,"divergenciaPlacar":0,"codigos":\{\}\}$/)
  assert.ok(!/ALFA|BETA|Fulano/.test(logs[0]), 'o log não leva nomes')
}

// 2) Substituições dentro do limite e 7ª troca regular de uma equipe (limite 6): o motor recusa a 7ª
{
  limpar()
  iniciarSet(1)
  const par = (sai: number, entra: number) => `Substituição ${ALFA}: sai #${sai} Titular, entra #${entra} Reserva.`
  const trocas: Array<[number, number]> = [[1, 7], [2, 8], [3, 9], [4, 10], [5, 11], [6, 12]]
  let placarB = 0
  for (const [sai, entra] of trocas) {
    pontoB(); placarB += 1 // um rally entre os pedidos
    grava('substitution', par(sai, entra) + rot('teamB'), 1, `0 x ${placarB}`)
  }
  const seis = rodar(entrada([[1, 0, placarB]]))
  assert.ok(seis)
  assert.deepEqual(seis.avisosMotor.filter((a) => a.severidade === 'erro'), [], JSON.stringify(seis.avisosMotor))

  pontoB(); placarB += 1
  grava('substitution', par(7, 1) + rot('teamB'), 1, `0 x ${placarB}`)
  const sete = rodar(entrada([[1, 0, placarB]]))
  assert.ok(sete)
  const erros = sete.avisosMotor.filter((a) => a.severidade === 'erro')
  assert.equal(erros.length, 1, JSON.stringify(sete.avisosMotor))
  assert.match(erros[0].codigo, /^RG-SUB-/)
  assert.equal(sete.divergenciaPlacar, undefined, 'o placar continua conferindo')
}

// 3) Sanção com marcador valida; sanção sem marcador vira aviso
{
  limpar()
  iniciarSet(1)
  pontoB()
  const avaliado = avaliarCartao([], { equipe: equipeDoMotor('teamA'), membro: `J:${camisaA(3)}`, categoria: 'MENOR', set: 1 }, 'Cartão amarelo')
  assert.ok(avaliado.ok)
  if (avaliado.ok) {
    const texto = `[Cartão amarelo] ${ALFA} - Fulano: Conduta. ${descreverEfeito(avaliado.avaliada, BETA)}${marcadorSancao('A', avaliado.registro)}`
    grava('CARTAO_AMARELO', texto, 1, '0 x 1')
    const comMarcador = rodar(entrada([[1, 0, 1]]))
    assert.ok(comMarcador)
    assert.deepEqual(comMarcador.avisosMotor.filter((a) => a.codigo === 'SOMBRA-SANCAO-SEM-MARCADOR'), [])
    assert.deepEqual(comMarcador.avisosMotor.filter((a) => a.severidade === 'erro'), [], JSON.stringify(comMarcador.avisosMotor))
  }
  limpar()
  iniciarSet(1)
  pontoB()
  grava('CARTAO_AMARELO', `[Cartão amarelo] ${ALFA} - Fulano: Conduta antidesportiva.`, 1, '0 x 1')
  const semMarcador = rodar(entrada([[1, 0, 1]]))
  assert.ok(semMarcador)
  const aviso = semMarcador.avisosMotor.find((a) => a.codigo === 'SOMBRA-SANCAO-SEM-MARCADOR')
  assert.ok(aviso)
  assert.equal(aviso.severidade, 'aviso')
  assert.equal(semMarcador.divergenciaPlacar, undefined)
}

// 4) Ponto divergente: o placar gravado tem um ponto a mais do que as ocorrências provam
{
  limpar()
  iniciarSet(1)
  pontoA(); pontoA(); pontoB()
  const logs: string[] = []
  const r = rodar(entrada([[1, 3, 1]]), logs)
  assert.ok(r)
  assert.deepEqual(r.divergenciaPlacar, { sets: [{ numero: 1, gravado: { a: 3, b: 1 }, derivado: { a: 2, b: 1 } }] })
  assert.ok(r.avisosMotor.some((a) => a.codigo === 'SOMBRA-PLACAR-DIVERGENTE' && a.severidade === 'aviso'))
  assert.match(logs[0], /"divergenciaPlacar":1/)
}

// 3b) Sanção que dá ponto ao adversário: o ponto de penalidade não conta duas vezes
{
  limpar()
  iniciarSet(1)
  pontoA()
  const historico: SancaoRegistrada[] = []
  let placarB = 0
  for (let vez = 0; vez < 3; vez += 1) {
    const a = avaliarCartao(historico, { equipe: 'A', membro: 'EQUIPE', categoria: 'ATRASO', set: 1 })
    assert.ok(a.ok)
    if (!a.ok) break
    historico.push(a.registro)
    grava('anotacao', `[Cartão] ${ALFA} - Fulano: Conduta. ${descreverEfeito(a.avaliada, BETA)}${marcadorSancao('A', a.registro)}`, 1, `1 x ${placarB}`)
    if (a.avaliada.pontoParaAdversario) {
      placarB += 1
      grava('point', `Ponto e saque para ${BETA} por penalidade aplicada a Fulano.`, 1, `1 x ${placarB}`)
    }
  }
  assert.ok(placarB >= 1, 'a sequência de sanções precisa render pelo menos uma penalidade')
  const r = rodar(entrada([[1, 1, placarB]]))
  assert.ok(r)
  assert.equal(r.divergenciaPlacar, undefined, JSON.stringify(r))
  assert.deepEqual(r.avisosMotor.filter((a) => a.severidade === 'erro'), [], JSON.stringify(r.avisosMotor))
}

// 5) Excepcional por lesão e decisão do árbitro (override) viram no máximo 'info'
{
  limpar()
  iniciarSet(1)
  pontoA()
  grava('lesao', `Substituição excepcional (lesão) ${ALFA}: sai #1 Titular, entra #7 Reserva.${marcadorExcepcional('LESAO')}${rot('teamA')}`, 1, '1 x 0')
  const r = rodar(entrada([[1, 1, 0]]))
  assert.ok(r)
  // Com substituição regular possível, o motor recusa a excepcional (RG-SUB-011): prova que a troca foi traduzida e avaliada.
  assert.deepEqual(r.avisosMotor.map((a) => a.codigo), ['RG-SUB-011'], JSON.stringify(r.avisosMotor))
  const comOverride = anexarOverride('Tempo solicitado.', { codigo: 'RG-TMP-001', justificativa: 'Tempo concedido pelo árbitro principal' })
  limpar()
  iniciarSet(1)
  pontoA()
  grava('timeout', textoTempo(ALFA, 1, 1, 2), 1, '1 x 0')
  grava('timeout', textoTempo(ALFA, 2, 1, 2), 1, '1 x 0')
  grava('timeout', `${textoTempo(ALFA, 3, 1, 2)} ${comOverride}`, 1, '1 x 0')
  const t = rodar(entrada([[1, 1, 0]]))
  assert.ok(t)
  const tmp = t.avisosMotor.filter((a) => a.codigo === 'RG-TMP-001')
  assert.equal(tmp.length, 1, JSON.stringify(t.avisosMotor))
  assert.equal(tmp[0].severidade, 'info', 'bloqueio já justificado pelo árbitro não conta como erro')
}

// 6) Flag desligada: nada é computado e a resposta não ganha campos
{
  assert.equal(sombraAtiva(undefined), false)
  for (const v of ['', '0', 'true', 'on', ' 1']) assert.equal(sombraAtiva(v), false, v)
  assert.equal(sombraAtiva('1'), true)
  let chamado = false
  const r = revalidarEmSombra(() => { chamado = true; throw new Error('não podia rodar') }, { ativa: false })
  assert.equal(r, null)
  assert.equal(chamado, false, 'nenhuma computação extra com a flag desligada')
  const antes = process.env.SUMULA_SERVIDOR_SOMBRA
  delete process.env.SUMULA_SERVIDOR_SOMBRA
  assert.equal(revalidarEmSombra(() => { throw new Error('x') }), null, 'padrão desligado')
  if (antes !== undefined) process.env.SUMULA_SERVIDOR_SOMBRA = antes
}

// 7) Erro interno: vira aviso 'info', nunca exceção
{
  const logs: string[] = []
  const r = revalidarEmSombra(() => { throw new Error('falha com dado sensível Fulano') }, { ativa: true, partidaId: 5, registrar: (m) => logs.push(m) })
  assert.ok(r)
  assert.equal(r.avisosMotor.length, 1)
  assert.equal(r.avisosMotor[0].codigo, 'SOMBRA-ERRO-INTERNO')
  assert.equal(r.avisosMotor[0].severidade, 'info')
  assert.ok(!logs.join(' ').includes('Fulano'), 'o log não repete a mensagem do erro')
  // lista de ocorrências malformada também não derruba
  const m = revalidarEmSombra(() => ({ ...entrada([[1, 1, 0]]), ocorrencias: [{ tipo: 'point', descricao: null as unknown as string }, null as never] }), { ativa: true, registrar: () => undefined })
  assert.ok(m && Array.isArray(m.avisosMotor))
}

// 8) A rota só soma campos aditivos depois de gravar e não depende do resultado para o status
{
  const fonte = fs.readFileSync(path.resolve('src/app/api/sumula/[token]/route.ts'), 'utf8')
  const put = fonte.slice(fonte.indexOf('export async function PUT'))
  assert.ok(put.indexOf('gravarSumulaComRestauracao') < put.indexOf('revalidarEmSombra('), 'a sombra roda depois de gravar')
  assert.ok(put.includes("return success({ salva: true, oficial: false, status: 'EM_ANDAMENTO', ...(sombra ?? {}) })"))
}

console.log('sumula-servidor-sombra: ok')
