import {
  CONFIG_FIVB_MELHOR_DE_5,
  configMelhorDe3,
  conferirIntervalo,
  duracaoDoIntervalo,
  INTERVALO_LONGO_MAX_MINUTOS,
  INTERVALO_PADRAO_MINUTOS,
  validarConfigIntervalo,
} from '../src/lib/regras-volei'
import { assert, caso, encerrar } from './regras-volei-helper'

const c5 = CONFIG_FIVB_MELHOR_DE_5

caso('RG-SET-005: o intervalo entre sets dura 3 minutos, com troca de quadra e papeletas', () => {
  assert.equal(INTERVALO_PADRAO_MINUTOS, 3)
  for (const set of [1, 2, 3, 4]) {
    const i = duracaoDoIntervalo(c5, set)!
    assert.equal(i.minutos, 3)
    assert.equal(i.longo, false)
    assert.equal(i.trocamDeQuadra, true)
    assert.equal(i.entregamPapeletas, true)
  }
})

caso('RG-SET-005: não há intervalo depois do último set possível da partida', () => {
  assert.equal(duracaoDoIntervalo(c5, 5), null)
  assert.equal(duracaoDoIntervalo(configMelhorDe3(), 3), null)
  assert.equal(conferirIntervalo(c5, 5, 3).ok, false)
})

caso('RG-SET-005: entre o 2º e o 3º sets o organizador pode pedir até 10 minutos', () => {
  const config = { ...c5, intervaloLongoEntre2e3Minutos: 10 }
  assert.equal(INTERVALO_LONGO_MAX_MINUTOS, 10)
  assert.deepEqual(
    [1, 2, 3, 4].map((s) => duracaoDoIntervalo(config, s)!.minutos),
    [3, 10, 3, 3],
  )
  assert.equal(duracaoDoIntervalo(config, 2)!.longo, true)
  assert.equal(validarConfigIntervalo(config).ok, true)
})

caso('RG-SET-005: o intervalo longo fora de 3 a 10 minutos é recusado na configuração', () => {
  for (const v of [2, 11, 30, Number.NaN]) {
    const r = validarConfigIntervalo({ ...c5, intervaloLongoEntre2e3Minutos: v })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.codigo, 'RG-SET-005')
  }
  assert.equal(conferirIntervalo({ ...c5, intervaloLongoEntre2e3Minutos: 30 }, 2, 3).ok, false)
})

caso('RG-SET-005: passar do intervalo previsto avisa para lançar o horário real, sem invalidar a súmula', () => {
  const dentro = conferirIntervalo(c5, 1, 3)
  assert.equal(dentro.ok && dentro.avisos.length, 0)
  const passou = conferirIntervalo(c5, 1, 5)
  assert.equal(passou.ok, true)
  if (passou.ok) assert.equal(passou.avisos[0]?.codigo, 'RG-SET-005')
  const longoOk = conferirIntervalo({ ...c5, intervaloLongoEntre2e3Minutos: 10 }, 2, 10)
  assert.equal(longoOk.ok && longoOk.avisos.length, 0)
})

encerrar('regras-volei-intervalo')
