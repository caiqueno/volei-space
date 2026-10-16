import assert from 'node:assert/strict'
import { colunaAusente, type ErroDeColuna } from '../src/lib/coluna-ausente'
import { colunaElegibilidadeAusente } from '../src/lib/elegibilidade-categoria'
import { colunaDeLiberoAusente } from '../src/lib/libero-sumula'
import { colunaDeLesaoAusente } from '../src/lib/lesao-sumula'
import { colunaDeTemposAusente } from '../src/lib/tempos-sumula'
import { colunaDeAlertaRodizioAusente } from '../src/lib/rodizio-sumula'
import { colunaDeLimiteSubstituicoesAusente } from '../src/lib/sumula-regras'
import { colunaDeSetsQuartasOitavasAusente } from '../src/lib/sets-por-fase'
import { erroColunaDeVagaAusente } from '../src/lib/consulta-vaga'

type Campos = 'code' | 'message' | 'details'

function textoDe(erro: ErroDeColuna, campos: Campos[]) {
  return campos.map((campo) => erro?.[campo] ?? '').join(' ')
}

function antigo(erro: ErroDeColuna, padrao: RegExp, campos: Campos[] = ['code', 'message', 'details']) {
  return padrao.test(textoDe(erro, campos))
}

const NOMES_FASE = [
  'setsPorPartidaFinal',
  'setsPorPartidaSemifinal',
  'setsPorPartidaQuartas',
  'setsPorPartidaOitavas',
  'setsPorPartidaTerceiroLugar',
] as const

const NOMES_SUMULA = [
  ...NOMES_FASE,
  'limiteSubstituicoesPorSet',
  'alertaRodizioIlegal',
  'limiteTemposPorSet',
  'separarTempos',
  'tempoMedico',
  'substituicaoPorLesao',
  'exigirLiberoInicial',
  'quantidadeLiberos',
] as const

const CODIGOS = ['PGRST204', '42703'] as const

const PADRAO_ELEGIBILIDADE = /genero|idadeMinima|idadeMaxima|\bsexo\b|42703|PGRST204/i
const PADRAO_MASSA = /setsPorPartida(Final|Semifinal|Quartas|Oitavas|TerceiroLugar)|woSetsVencedor|woPunicaoPontos|PGRST204|42703/i
const PADRAO_FASE = /setsPorPartida(Final|Semifinal|Quartas|Oitavas|TerceiroLugar)|limiteSubstituicoesPorSet|alertaRodizioIlegal|limiteTemposPorSet|separarTempos|tempoMedico|substituicaoPorLesao|exigirLiberoInicial|quantidadeLiberos|PGRST204|42703/i
const PADRAO_RASCUNHO = /formularioInscricaoConfig|42703|PGRST204/i
const PADRAO_CODIGOS = /42703|PGRST204/i
const PADRAO_AUTH = /does not exist|schema cache/i
const PADRAO_QUARTAS = /setsPorPartidaQuartas|setsPorPartidaOitavas/i
const PADRAO_LIBERO = /exigirLiberoInicial|quantidadeLiberos/i
const PADRAO_LESAO = /tempoMedico|substituicaoPorLesao/i
const PADRAO_TEMPOS = /limiteTemposPorSet|separarTempos/i
const PADRAO_RODIZIO = /alertaRodizioIlegal/i
const PADRAO_LIMITE = /limiteSubstituicoesPorSet/i
const PADRAO_VAGA = /origemVaga[AB]/i

const amostras: ErroDeColuna[] = [
  null,
  undefined,
  {},
  { code: null, message: null, details: null },
  { code: 'PGRST204', message: 'Could not find the genero column' },
  { code: '23514', message: 'outro erro' },
  { code: 'PGRST204', message: 'setsPorPartidaQuartas' },
  { code: '42703', message: 'setsPorPartidaFinal' },
  { message: 'sexo' },
  { message: 'SEXO' },
  { message: 'o sexo do atleta' },
  { message: 'assexo' },
  { message: 'sexual' },
  { message: 'generosidade' },
  { details: 'quantidadeLiberos' },
  { code: 'exigirLiberoInicial' },
  { message: 'LIMITE DE TEMPOS' },
  { message: 'limiteTemposPorSet' },
  { message: 'separarTempos' },
  { message: 'AlertaRodizioIlegal' },
  { message: 'tempoMedico' },
  { message: 'substituicaoPorLesao' },
  { message: 'ok', details: '42703 hidden' },
  { code: '42703', message: 'unrelated', details: 'ignored' },
  { message: 'Schema Cache' },
  { message: 'DOES NOT EXIST' },
  { code: '42703', message: 'formularioInscricaoConfig' },
  { message: 'column setsPorPartidaSemifinal does not exist' },
  { message: 'setsPorPartida' },
  { message: 'woSetsVencedor' },
  { message: 'woPunicaoPontos' },
  { message: 'woSetsPerdedor' },
  { message: 'origemVagaA' },
  { message: 'origemVagaB' },
  { message: 'origemVaga' },
  { message: 'ORIGEMVAGAA' },
  { code: 'PGRST204', message: 'Could not find the metodoChaveamento column of Liga in the schema cache' },
  { code: '42703', message: 'column Equipe.diasDisponiveis does not exist' },
  { message: 'coluna genero ausente' },
  { details: 'idadeMaxima' },
]

function igual(rotulo: string, obtido: boolean, esperado: boolean, erro: ErroDeColuna) {
  assert.equal(obtido, esperado, `${rotulo} divergiu em ${JSON.stringify(erro)}`)
}

for (const erro of amostras) {
  igual('elegibilidade', colunaElegibilidadeAusente(erro), antigo(erro, PADRAO_ELEGIBILIDADE), erro)
  igual('libero', colunaDeLiberoAusente(erro), antigo(erro, PADRAO_LIBERO), erro)
  igual('lesao', colunaDeLesaoAusente(erro), antigo(erro, PADRAO_LESAO), erro)
  igual('tempos', colunaDeTemposAusente(erro), antigo(erro, PADRAO_TEMPOS), erro)
  igual('rodizio', colunaDeAlertaRodizioAusente(erro), antigo(erro, PADRAO_RODIZIO), erro)
  igual('limite', colunaDeLimiteSubstituicoesAusente(erro), antigo(erro, PADRAO_LIMITE), erro)
  igual('quartas', colunaDeSetsQuartasOitavasAusente(erro), antigo(erro, PADRAO_QUARTAS), erro)
  igual('vaga', erroColunaDeVagaAusente(erro), antigo(erro, PADRAO_VAGA), erro)
  igual(
    'massa',
    colunaAusente(erro, [...NOMES_FASE, 'woSetsVencedor', 'woPunicaoPontos', ...CODIGOS]),
    antigo(erro, PADRAO_MASSA),
    erro,
  )
  igual(
    'fase',
    colunaAusente(erro, [...NOMES_SUMULA, ...CODIGOS]),
    antigo(erro, PADRAO_FASE),
    erro,
  )
  const semDetalhe = { code: erro?.code, message: erro?.message }
  igual(
    'rascunho',
    colunaAusente(semDetalhe, ['formularioInscricaoConfig', ...CODIGOS]),
    antigo(erro, PADRAO_RASCUNHO, ['code', 'message']),
    erro,
  )
  igual(
    'codigos',
    colunaAusente(semDetalhe, [...CODIGOS]),
    antigo(erro, PADRAO_CODIGOS, ['code', 'message']),
    erro,
  )
  igual(
    'auth',
    colunaAusente({ message: erro?.message }, ['does not exist', 'schema cache']),
    antigo(erro, PADRAO_AUTH, ['message']),
    erro,
  )
}

assert.equal(colunaAusente(null, ['genero']), false)
assert.equal(colunaAusente({ message: 'assexo' }, [/\bsexo\b/i]), false)
assert.equal(colunaAusente({ message: 'assexo' }, ['sexo']), true)
assert.equal(colunaAusente({ details: 'quantidadeLiberos' }, ['quantidadeLiberos']), true)
assert.equal(colunaAusente({ message: 'ok', details: '42703' }, ['42703']), true)
assert.equal(colunaAusente({ code: '23505', message: 'ok' }, ['42703', 'PGRST204']), false)
assert.equal(colunaAusente({ message: '' }, ['']), false)

console.log('colunaAusente passou: mesma detecção dos probes antigos.')
