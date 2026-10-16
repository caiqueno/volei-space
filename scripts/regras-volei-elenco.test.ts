import {
  capitaoEmJogo,
  configMelhorDe3,
  opcoesElencoDoPerfil,
  PERFIL_AMADOR,
  PERFIL_FIVB_CBV,
  PERFIL_FIVB_COMPETICAO,
  validarElenco,
  validarRegistroDeLiberos,
  type JogadorElenco,
} from '../src/lib/regras-volei'
import { validarNovoEvento } from '../src/lib/sumula-eventos'
import { assert, caso, encerrar } from './regras-volei-helper'

const elencoDe = (n: number): JogadorElenco[] => Array.from({ length: n }, (_, i) => ({ id: i + 1, camisa: i + 1 }))

caso('RG-ELE-001: até 12 jogadores por padrão; o 13º é recusado', () => {
  assert.equal(validarElenco(elencoDe(12), []).ok, true)
  const r = validarElenco(elencoDe(13), [])
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.codigo, 'RG-ELE-001')
})

caso('RG-ELE-001: 14 jogadores só com a opção de FIVB/World/Oficiais Adulto', () => {
  assert.equal(validarElenco(elencoDe(14), [13, 14], { maxJogadores: 14 }).ok, true)
  assert.equal(validarElenco(elencoDe(15), [13, 14], { maxJogadores: 14 }).ok, false)
  assert.equal(validarElenco(elencoDe(14), [13, 14]).ok, false)
})

caso('RG-ELE-001: comissão técnica de no máximo 1 técnico, 2 assistentes e 2 da área médica', () => {
  assert.equal(validarElenco(elencoDe(12), [], { comissao: { tecnicos: 1, assistentes: 2, areaMedica: 2 } }).ok, true)
  assert.equal(validarElenco(elencoDe(12), [], { comissao: { tecnicos: 2, assistentes: 0, areaMedica: 0 } }).ok, false)
  assert.equal(validarElenco(elencoDe(12), [], { comissao: { tecnicos: 1, assistentes: 3, areaMedica: 0 } }).ok, false)
  assert.equal(validarElenco(elencoDe(12), [], { comissao: { tecnicos: 1, assistentes: 0, areaMedica: 3 } }).ok, false)
})

caso('RG-ELE-004: camisas únicas, de 1 a 20 (limite configurável)', () => {
  const repetida = validarElenco([{ id: 1, camisa: 5 }, { id: 2, camisa: 5 }], [])
  assert.equal(repetida.ok, false)
  if (!repetida.ok) assert.equal(repetida.codigo, 'RG-ELE-004')
  assert.equal(validarElenco([{ id: 1, camisa: 0 }], []).ok, false)
  assert.equal(validarElenco([{ id: 1, camisa: 21 }], []).ok, false)
  assert.equal(validarElenco([{ id: 1, camisa: 21 }], [], { camisaMaxima: 30 }).ok, true)
  assert.equal(validarElenco([{ id: 1, camisa: 7.5 }], []).ok, false)
})

caso('RG-LIB-001: até 2 líberos, da relação nominal e sem repetir', () => {
  assert.equal(validarElenco(elencoDe(12), [11, 12]).ok, true)
  assert.equal(validarElenco(elencoDe(12), []).ok, true, 'líbero não é obrigatório na regra geral')
  assert.equal(validarElenco(elencoDe(12), [10, 11, 12]).ok, false)
  assert.equal(validarElenco(elencoDe(12), [99]).ok, false)
  assert.equal(validarRegistroDeLiberos([3, 3], [1, 2, 3]).ok, false)
})

caso('RG-LIB-001: com mais de 12 jogadores, 2 líberos são obrigatórios se o perfil pedir', () => {
  const opcoes = opcoesElencoDoPerfil(PERFIL_FIVB_COMPETICAO)
  assert.equal(opcoes.maxJogadores, 14)
  const um = validarElenco(elencoDe(14), [14], opcoes)
  assert.equal(um.ok, false)
  if (!um.ok) assert.equal(um.codigo, 'RG-LIB-001')
  assert.equal(validarElenco(elencoDe(14), [], opcoes).ok, false)
  assert.equal(validarElenco(elencoDe(14), [13, 14], opcoes).ok, true)
  assert.equal(validarElenco(elencoDe(12), [], opcoes).ok, true, 'até 12 não obriga')
  // Perfis sem a opção não obrigam.
  assert.equal(opcoesElencoDoPerfil(PERFIL_FIVB_CBV).exigeDoisLiberosAcimaDe12, false)
  assert.equal(opcoesElencoDoPerfil(PERFIL_AMADOR).maxJogadores, undefined)
})

caso('RG-ELE-005: capitaoEmJogo prefere o capitão em quadra, depois o designado em quadra', () => {
  assert.equal(capitaoEmJogo({ capitao: 1, designado: 2, emQuadra: [1, 2, 3, 4, 5, 6] }), 1)
  assert.equal(capitaoEmJogo({ capitao: 9, designado: 2, emQuadra: [1, 2, 3, 4, 5, 6] }), 2)
  assert.equal(capitaoEmJogo({ capitao: 9, designado: 8, emQuadra: [1, 2, 3, 4, 5, 6] }), null)
  assert.equal(capitaoEmJogo({ capitao: null, designado: null, emQuadra: [1, 2, 3, 4, 5, 6] }), null)
})

/* ---- integração: o servidor aplica a opção do perfil ao iniciar o 1º set ---- */

const inicio = (liberosA?: number[], liberosB?: number[]) => ({
  clientEventId: '11111111-1111-4111-8111-111111111111',
  tipo: 'SET_INICIADO' as const,
  payload: {
    numeroSet: 1,
    formacaoA: [1, 2, 3, 4, 5, 6],
    formacaoB: [21, 22, 23, 24, 25, 26],
    saqueInicial: 'A',
    ...(liberosA ? { liberosA } : {}),
    ...(liberosB ? { liberosB } : {}),
  },
})
const elenco14 = { A: Array.from({ length: 14 }, (_, i) => i + 1), B: Array.from({ length: 14 }, (_, i) => i + 21) }

caso('RG-ELE-001: SET_INICIADO recusa elenco acima do máximo do perfil (opt-in)', () => {
  const config = configMelhorDe3({ perfil: { ...PERFIL_FIVB_CBV, maxJogadoresElenco: 12 } })
  const r = validarNovoEvento([], config, { elenco: elenco14 }, inicio())
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.codigo, 'RG-ELE-001')
})

caso('RG-ELE-001: sem o campo no perfil o servidor não limita o tamanho do elenco', () => {
  const r = validarNovoEvento([], configMelhorDe3(), { elenco: elenco14 }, inicio())
  assert.equal(r.ok, true)
})

caso('RG-LIB-001: SET_INICIADO em competição FIVB exige 2 líberos com mais de 12 jogadores', () => {
  const config = configMelhorDe3({ perfil: PERFIL_FIVB_COMPETICAO })
  const sem = validarNovoEvento([], config, { elenco: elenco14 }, inicio([13]))
  assert.equal(sem.ok, false)
  if (!sem.ok) assert.equal(sem.codigo, 'RG-LIB-001')
  const com = validarNovoEvento([], config, { elenco: elenco14 }, inicio([13, 14], [33, 34]))
  assert.equal(com.ok, true)
})

encerrar('regras-volei-elenco')
