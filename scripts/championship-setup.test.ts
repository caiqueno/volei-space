import assert from 'node:assert/strict'
import {
  computeAllEffectiveStatuses,
  computeEffectiveSectionStatus,
  getMissingSectionFields,
  resolveStoredSectionStatus,
  SECTION_ORDER,
  type SetupSection,
  type StoredSectionStatus,
} from '../src/lib/championship-setup-status'
import {
  validateEliminatoryCapacity,
  validateClassificacaoEliminatoriaMatch,
  validateQrPhotoNameDependency,
  validateDateRange,
  validateElencoRange,
} from '../src/lib/championship-validation'
import { getAggregateTwoLegWinnerId } from '../src/lib/mata-mata'

// --- Status por sessão ---------------------------------------------------

assert.equal(
  computeEffectiveSectionStatus({ section: 'informacoes', storedStatus: 'not-started', effectiveStatusBySection: {}, hasValidationErrors: false }),
  'not-started',
  'sessão nunca salva deve ser not-started',
)

assert.equal(
  computeEffectiveSectionStatus({ section: 'informacoes', storedStatus: 'in-progress', effectiveStatusBySection: {}, hasValidationErrors: false }),
  'in-progress',
  'sessão parcialmente preenchida deve ser in-progress',
)

assert.equal(
  computeEffectiveSectionStatus({ section: 'informacoes', storedStatus: 'completed', effectiveStatusBySection: {}, hasValidationErrors: false }),
  'completed',
  'sessão válida deve ser completed',
)

assert.equal(
  computeEffectiveSectionStatus({
    section: 'eliminatorias',
    storedStatus: 'completed',
    effectiveStatusBySection: { estrutura: 'completed', classificacao: 'completed' },
    hasValidationErrors: true,
  }),
  'attention-required',
  'sessão completed cuja dependência mudou e gerou erro cruzado deve virar attention-required',
)

assert.equal(
  computeEffectiveSectionStatus({
    section: 'estrutura',
    storedStatus: 'not-started',
    effectiveStatusBySection: { informacoes: 'not-started' },
    hasValidationErrors: false,
  }),
  'blocked',
  'sessão cuja dependência ainda não existe deve ser blocked',
)

// Cadeia completa (grafo de dependências real) — Calendário/Inscrições só
// dependem de Informações/Estrutura, não de Classificação/Eliminatórias.
const noErrors = Object.fromEntries(SECTION_ORDER.map((section) => [section, false])) as Record<SetupSection, boolean>

const storedAllReady: Record<SetupSection, StoredSectionStatus> = {
  informacoes: 'completed',
  estrutura: 'completed',
  classificacao: 'completed',
  eliminatorias: 'completed',
  calendario: 'not-started',
  inscricoes: 'not-started',
}
const effectiveReady = computeAllEffectiveStatuses(storedAllReady, noErrors)
assert.equal(effectiveReady.calendario, 'not-started', 'calendário depende só de informações (completed) — fica not-started, não blocked')
assert.equal(effectiveReady.inscricoes, 'not-started', 'inscrições dependem só de estrutura (completed) — fica not-started, não blocked')

const storedNothingYet: Record<SetupSection, StoredSectionStatus> = {
  informacoes: 'not-started',
  estrutura: 'not-started',
  classificacao: 'not-started',
  eliminatorias: 'not-started',
  calendario: 'not-started',
  inscricoes: 'not-started',
}
const effectiveBlocked = computeAllEffectiveStatuses(storedNothingYet, noErrors)
assert.equal(effectiveBlocked.estrutura, 'blocked', 'estrutura deve ficar blocked se informações não estiver completed')
assert.equal(effectiveBlocked.classificacao, 'blocked', 'classificação deve ficar blocked se estrutura não estiver completed')
assert.equal(effectiveBlocked.eliminatorias, 'blocked', 'eliminatórias devem ficar blocked se estrutura/classificação não estiverem completed')
assert.equal(effectiveBlocked.inscricoes, 'blocked', 'inscrições devem ficar blocked se estrutura não estiver completed')

// --- Classificação x Eliminatórias (validação cruzada central da spec) ----
// 3 grupos, 2 classificados por grupo = 6 classificados, mas Quartas de
// Final exige exatamente 8 -> deve gerar erro explícito, sem correção
// silenciosa (não classifica terceiros automaticamente).
const quartasError = validateClassificacaoEliminatoriaMatch({
  faseEliminatoria: 'QUARTAS',
  totalClassificados: 3 * 2,
})
assert.ok(quartasError, '3 grupos x 2 classificados (=6) vs Quartas (exige 8) deve gerar erro')
assert.match(quartasError, /8/, 'mensagem de erro deve citar a quantidade exigida pela fase')

const quartasOk = validateClassificacaoEliminatoriaMatch({
  faseEliminatoria: 'QUARTAS',
  totalClassificados: 4 * 2,
})
assert.equal(quartasOk, '', '4 grupos x 2 classificados (=8) vs Quartas (exige 8) deve ser compatível')

// validateEliminatoryCapacity (usada pelas rotas legadas de Liga/estrutura)
// continua permissiva para SUBdimensionamento — só barra excesso, já que o
// restante pode ser preenchido por classificação manual (ClassificacaoEliminatoria).
const legacyUnderfill = validateEliminatoryCapacity({
  faseEliminatoria: 'QUARTAS',
  quantidadeGrupos: 3,
  classificadosPorGrupo: 2,
})
assert.equal(legacyUnderfill, '', 'validateEliminatoryCapacity não bloqueia sub-dimensionamento, só excesso')

const legacyOverfill = validateEliminatoryCapacity({
  faseEliminatoria: 'QUARTAS',
  quantidadeGrupos: 5,
  classificadosPorGrupo: 2,
})
assert.ok(legacyOverfill, 'validateEliminatoryCapacity deve bloquear excesso (5x2=10 > 8)')

// Mata-mata puro (sem fase de grupos): quem entra na chave são as próprias
// equipes inscritas — cobrar "classificados por grupo" tornaria o formato
// impossível de concluir no wizard.
assert.equal(
  validateClassificacaoEliminatoriaMatch({ formato: 'MATA_MATA', faseEliminatoria: 'QUARTAS', totalClassificados: 0, quantidadeEquipes: 8, temGrupos: false }),
  '',
  'mata-mata puro com 8 equipes é compatível com quartas',
)

assert.ok(
  validateClassificacaoEliminatoriaMatch({ formato: 'MATA_MATA', faseEliminatoria: 'QUARTAS', totalClassificados: 0, quantidadeEquipes: 6, temGrupos: false }),
  'mata-mata puro com 6 equipes não fecha uma chave de quartas',
)

assert.ok(
  validateClassificacaoEliminatoriaMatch({ formato: 'GRUPOS_MATA_MATA', faseEliminatoria: 'QUARTAS', totalClassificados: 6, quantidadeEquipes: 12, temGrupos: true }),
  'com grupos configurados, a regra continua sendo a dos classificados',
)

// --- Autosave (draft) x "Salvar e concluir" (complete) -------------------
// Sem esta distinção, o autosave marcaria a seção como concluída no primeiro
// keystroke (vários campos-âncora têm DEFAULT no banco).
const ligaInformacoesOk = { nome: 'Copa Teste' }

assert.equal(
  resolveStoredSectionStatus({ section: 'informacoes', intent: 'draft', currentStored: 'not-started', ligaAfterPatch: ligaInformacoesOk }),
  'in-progress',
  'autosave numa seção nunca tocada deixa em andamento, não concluída',
)

assert.equal(
  resolveStoredSectionStatus({ section: 'informacoes', intent: 'complete', currentStored: 'in-progress', ligaAfterPatch: ligaInformacoesOk }),
  'completed',
  '"Salvar e concluir" com dados válidos conclui a seção',
)

assert.equal(
  resolveStoredSectionStatus({ section: 'informacoes', intent: 'draft', currentStored: 'completed', ligaAfterPatch: ligaInformacoesOk }),
  'completed',
  'autosave numa seção já concluída, com dados ainda completos, mantém concluída',
)

assert.equal(
  resolveStoredSectionStatus({ section: 'calendario', intent: 'draft', currentStored: 'completed', ligaAfterPatch: { dataInicio: '2026-06-01T00:00:00.000Z', dataFim: null } }),
  'in-progress',
  'seção concluída que perde um campo obrigatório volta para em andamento',
)

assert.equal(
  resolveStoredSectionStatus({ section: 'calendario', intent: 'complete', currentStored: 'in-progress', ligaAfterPatch: { dataInicio: '2026-06-01T00:00:00.000Z', dataFim: null } }),
  'in-progress',
  'concluir sem os dados-âncora nunca grava concluída (a rota rejeita com 422 antes)',
)

assert.deepEqual(
  getMissingSectionFields('calendario', { dataInicio: '2026-06-01T00:00:00.000Z', dataFim: null }),
  ['Data de término'],
  'a mensagem de 422 sabe exatamente qual campo falta',
)

// --- QR Code: dependência obrigatória nome+foto --------------------------
const qrFail = validateQrPhotoNameDependency(true, { nomeCompleto: 'required', foto: 'optional' })
assert.ok(qrFail.length > 0, 'QR=true com foto=optional deve falhar')

const qrPass = validateQrPhotoNameDependency(true, { nomeCompleto: 'required', foto: 'required' })
assert.equal(qrPass.length, 0, 'QR=true com nome e foto required deve passar')

const qrDisabled = validateQrPhotoNameDependency(false, { nomeCompleto: 'optional', foto: 'disabled' })
assert.equal(qrDisabled.length, 0, 'QR desligado não exige nada sobre nome/foto')

// --- Calendário -----------------------------------------------------------
assert.ok(validateDateRange('2026-06-10T00:00:00.000Z', '2026-06-01T00:00:00.000Z'), 'data final anterior à inicial deve falhar')
assert.equal(validateDateRange('2026-06-01T00:00:00.000Z', '2026-06-10T00:00:00.000Z'), '', 'datas coerentes devem passar')

// --- Elenco -----------------------------------------------------------
assert.ok(validateElencoRange(10, 5), 'quantidade mínima maior que a máxima deve falhar')
assert.equal(validateElencoRange(5, 10), '', 'mínimo menor ou igual ao máximo deve passar')

// --- Mata-mata ida e volta (vencedor agregado) -----------------------------
const idaVoltaVencedor = getAggregateTwoLegWinnerId(
  { status: 'ENCERRADA', equipeAId: 1, equipeBId: 2, setsPorA: 3, setsPorB: 1 },
  { status: 'ENCERRADA', equipeAId: 2, equipeBId: 1, setsPorA: 1, setsPorB: 3 },
)
assert.equal(idaVoltaVencedor, 1, 'equipe 1 vence o agregado (6 sets a 2)')

const idaVoltaEmpate = getAggregateTwoLegWinnerId(
  { status: 'ENCERRADA', equipeAId: 1, equipeBId: 2, setsPorA: 3, setsPorB: 1 },
  { status: 'ENCERRADA', equipeAId: 2, equipeBId: 1, setsPorA: 3, setsPorB: 1 },
)
assert.equal(idaVoltaEmpate, null, 'agregado empatado (4x4) deve retornar null (indefinido, decisão manual)')

console.log('Central de Parametrização validada: status por sessão, validação cruzada, QR, calendário, elenco e ida-e-volta.')
