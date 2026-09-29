import assert from 'node:assert/strict'
import { assertReplicationPreviewCurrent, createReplicationSnapshot, getReplicationBlockReasons, previewCategoryReplication, type CategoryReplicationState } from '../src/lib/category-replication'

function state(id: number): CategoryReplicationState {
  return {
    id: '00000000-0000-4000-8000-' + String(id).padStart(12, '0'), ligaId: 1, organizadorId: 'organizer', configVersion: 1, operationVersion: 0, hasSavedConfiguration: false,
    configuration: {}, operations: { publishedForms: 0, teams: 0, occupiedGroups: 0, matches: 0, startedScoresheets: 0, inProgress: false },
  }
}
const source = state(1)
source.hasSavedConfiguration = true
source.configuration = { id: 1, nome: 'Origem', serie: 'PRATA', inscricoesAbertas: true, quantidadeEquipes: 8, formato: 'MATA_MATA', formularioInscricaoConfig: { atleta: { nomeCompleto: 'required', foto: 'required' } } }
const target = state(2)
target.configuration = { id: 2, nome: 'Destino', quantidadeEquipes: 4, formato: 'MATA_MATA', faseEliminatoria: 'QUARTAS' }
const snapshot = createReplicationSnapshot(source.configuration, ['estrutura', 'inscricoes'])
assert.ok(!('id' in snapshot.estrutura!))
assert.ok(!('nome' in snapshot.estrutura!))
assert.ok(!('serie' in snapshot.estrutura!))
assert.ok(!('inscricoesAbertas' in snapshot.inscricoes!))
snapshot.inscricoes!.formularioInscricaoConfig!.atleta!.foto = 'disabled'
assert.equal((source.configuration.formularioInscricaoConfig as any).atleta.foto, 'required', 'JSON copy independent')
assert.throws(() => createReplicationSnapshot({ formularioInscricaoConfig: { atleta: { token: 'secret' } } }, ['inscricoes']), /unrecognized_keys/)
assert.throws(() => createReplicationSnapshot(source.configuration, ['estrutura', 'estrutura']))
assert.throws(() => createReplicationSnapshot({ ...source.configuration, quantidadeEquipes: -1 }, ['estrutura']))

// Inscrição sempre vinculada ao elenco: replicar uma origem legada com
// elencoCadastroDuranteInscricao=false nunca pode levar false a um destino.
const legacySnapshot = createReplicationSnapshot({ elencoCadastroDuranteInscricao: false }, ['inscricoes'])
assert.equal(legacySnapshot.inscricoes!.elencoCadastroDuranteInscricao, true, 'replication never propagates false')

const original = JSON.stringify(target)
const preview = previewCategoryReplication(source, [target], ['estrutura'], 'replace-sections')
assert.equal(preview.targets[0].status, 'copied-review')
assert.equal(preview.targets[0].configuration.nome, 'Destino')
assert.equal(preview.targets[0].configuration.id, 2)
assert.ok(!('id' in preview.targets[0].patch), 'write patch excludes destination identity too')
assert.equal(preview.targets[0].configuration.quantidadeEquipes, 8)
assert.equal(JSON.stringify(target), original)
assert.equal(assertReplicationPreviewCurrent(preview, source, [target]).targets[0].configuration.quantidadeEquipes, 8)
assert.throws(() => assertReplicationPreviewCurrent(preview, { ...source, configVersion: 2 }, [target]), /Conflito/)
assert.throws(() => assertReplicationPreviewCurrent(preview, source, [{ ...target, operationVersion: 1 }]), /Conflito/)
assert.throws(() => assertReplicationPreviewCurrent(preview, source, [{ ...target, operations: { ...target.operations, publishedForms: 1 } }]), /Conflito/)
assert.throws(() => previewCategoryReplication(source, [{ ...target, ligaId: 2 }], ['estrutura'], 'replace-sections'), /mesmo campeonato/)
assert.throws(() => previewCategoryReplication(source, [{ ...target, organizadorId: 'other' }], ['estrutura'], 'replace-sections'), /mesmo campeonato/)
assert.throws(() => previewCategoryReplication(source, [source], ['estrutura'], 'replace-sections'))
assert.equal(previewCategoryReplication(source, [{ ...target, hasSavedConfiguration: true }], ['estrutura'], 'empty-only').targets[0].status, 'blocked')
for (const key of ['publishedForms', 'teams', 'occupiedGroups', 'matches', 'startedScoresheets'] as const) {
  assert.equal(getReplicationBlockReasons({ ...target.operations, [key]: 1 }).length, 1)
}
assert.equal(getReplicationBlockReasons({ ...target.operations, inProgress: true }).length, 1)

const incompatible = previewCategoryReplication(source, [{ ...target, configuration: { ...target.configuration, faseEliminatoria: 'FINAL' } }], ['estrutura'], 'replace-sections')
assert.equal(incompatible.targets[0].status, 'attention-required')
const qr = previewCategoryReplication({ ...source, configuration: { qrCodeEnabled: true } }, [target], ['recursos'], 'replace-sections')
assert.equal(qr.targets[0].status, 'attention-required', 'target validation includes sections not copied')
const tampered = structuredClone(preview)
tampered.targets[0].configuration.id = 999
assert.equal(assertReplicationPreviewCurrent(tampered, source, [target]).targets[0].configuration.id, 2, 'confirmation rebuilds data instead of trusting client')
console.log('category-replication: OK')
