import assert from 'node:assert/strict'
import { classeFeedbackPonto } from '../src/lib/feedback-ponto'

assert.equal(classeFeedbackPonto('ace'), 'sumula-flash sumula-flash-ace')
assert.equal(classeFeedbackPonto('attack'), 'sumula-flash sumula-flash-toque')
assert.equal(classeFeedbackPonto('block'), 'sumula-flash sumula-flash-bloqueio')
assert.equal(classeFeedbackPonto(null), '')
assert.equal(classeFeedbackPonto(undefined), '')

console.log('Feedback do ponto: ACE, toque e bloqueio têm pulso próprio; o +1 sem jogador não pulsa.')
