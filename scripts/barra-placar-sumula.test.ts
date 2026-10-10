import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const tela = fs.readFileSync(path.join(process.cwd(), 'src/app/sumula/[token]/lancar/page.tsx'), 'utf8')
const css = fs.readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8')

assert.ok(tela.includes('className="official-score-bar"'))
assert.ok(tela.includes('className="official-score-bar-halves"'))
assert.ok(tela.includes('SET {currentSet} · {currentScore[leftTeamId]} x {currentScore[rightTeamId]}'))
assert.ok(tela.includes('aria-label="Últimos pontos"'))
assert.ok(tela.includes('Registrar +1 para ${team.name} sem atribuir jogador'))
assert.ok(tela.includes('Corrigir Último ponto do ${team.name}'))
assert.ok(tela.includes('ACE para ${team.name}'))
assert.ok(tela.includes('Tempo {timeoutsUsed}/{limite}'))
assert.ok(tela.includes('onPoint={() => props.onPoint(leftTeamId)}') === false)
assert.ok(tela.includes('onUndoTeamPoint={props.onUndoTeamPoint}'))
assert.ok(css.includes('.official-score-bar-halves'))
assert.ok(css.includes('grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)'))
assert.ok(css.includes('@media (max-width: 640px)'))

console.log('barra-placar-sumula: ok')
