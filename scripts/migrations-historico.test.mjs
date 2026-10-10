import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const dir = path.join(process.cwd(), 'supabase', 'migrations')
const files = fs.readdirSync(dir).filter((name) => name.endsWith('.sql')).sort()

assert.ok(files.length > 0, 'pasta de migrations vazia')

for (const name of files) {
  assert.match(name, /^\d{12,}_.+\.sql$/, `${name} precisa do prefixo numérico que a CLI do Supabase aplica`)
}

function versionOf(name) {
  return name.slice(0, name.indexOf('_'))
}

const versions = files.map(versionOf)
const repetidos = versions.filter((version, index) => versions.indexOf(version) !== index)
assert.deepEqual(repetidos, [], `prefixo de migration repetido: ${[...new Set(repetidos)].join(', ')}`)

function sqlSemComentario(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
}

const fechamento = '202610060005'
for (const name of files) {
  if (versionOf(name) <= fechamento) continue
  const sql = sqlSemComentario(fs.readFileSync(path.join(dir, name), 'utf8'))
  assert.doesNotMatch(sql, /\bgrant\b[^;]*\bto\s+anon\b/i, `${name} concede a anon depois do fechamento`)
  assert.doesNotMatch(sql, /\bgrant\b[^;]*\bto\s+authenticated\b/i, `${name} concede a authenticated depois do fechamento`)
}

const placar = fs.readFileSync(path.join(dir, '202610100001_fechar_leitura_publica_placar.sql'), 'utf8')
assert.match(placar, /enable row level security/i)
assert.match(placar, /revoke all on table public\."SetPartida" from anon, authenticated/i)
assert.match(placar, /revoke all on table public\."ClassificacaoEntrada" from anon, authenticated/i)
assert.match(placar, /inscricaoAprovacaoAutomatica/)
assert.doesNotMatch(sqlSemComentario(placar), /\bgrant\b[^;]*\bto\s+anon\b/i)

const defaults = fs.readFileSync(path.join(dir, '202610090001_revogar_execute_public_default.sql'), 'utf8')
assert.match(defaults, /alter default privileges for role postgres\s+revoke execute on functions from public/i)
assert.doesNotMatch(defaults, /in schema public\s+revoke execute on functions from public/i)

const unicidade = fs.readFileSync(path.join(dir, '202610090003_classificacao_entrada_unica_por_liga.sql'), 'utf8')
assert.match(unicidade, /ClassificacaoEntrada_ligaId_equipeId_unique/)
assert.doesNotMatch(unicidade, /\bdelete\s+from\b/i)
assert.doesNotMatch(unicidade, /\btruncate\b/i)

const indices = fs.readFileSync(path.join(dir, '202610090002_indices_chaves_estrangeiras.sql'), 'utf8')
for (const coluna of [
  '"Equipe" ("ligaId")',
  '"Jogador" ("equipeId")',
  '"Partida" ("equipeAId")',
  '"Partida" ("equipeBId")',
  '"SumulaPresenca" ("jogadorId")',
  '"SumulaPresenca" ("equipeId")',
  '"OcorrenciaPartida" ("partidaId")',
  '"DestaquesPartida" ("jogadorId")',
  '"EscalaArbitro" ("arbitroId")',
  '"Premiacao" ("ligaId")',
  '"Midia" ("ligaId")',
  '"Mensagem" ("ligaId")',
  '"CandidaturaEquipe" ("ligaId")',
  '"ClassificacaoEntrada" ("ligaId")',
]) {
  assert.ok(indices.includes(coluna), `índice ausente para ${coluna}`)
}
assert.match(indices, /SetPartida\.partidaId não ganha índice novo/)

const realtime = [
  '202609200020_producao-elenco-sumula-rls.sql',
  '202609200021_rls-producao-permissoes-campeonatos.sql',
  '202610060003_classificacao_ao_vivo.sql',
  '202610060004_fechar_acesso_anonimo.sql',
].map((name) => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n')

assert.match(realtime, /public_read_classificacao|luv_public_select_classificacao/)
assert.match(realtime, /public_read_sets|luv_public_select_set_partida/)
assert.match(realtime, /public_read_partidas|luv_public_select_partida/)
const grantPartida = fs.readFileSync(path.join(dir, '202610060004_fechar_acesso_anonimo.sql'), 'utf8')
const colunasPartida = grantPartida.match(/grant select \([\s\S]*?\) on table public\."Partida"/i)
assert.ok(colunasPartida, 'grant de colunas da Partida ausente')
assert.doesNotMatch(colunasPartida[0], /sumulaToken/)
assert.match(
  fs.readFileSync(path.join(dir, '202610060003_classificacao_ao_vivo.sql'), 'utf8'),
  /add table public\."Partida"/,
)

assert.equal(fs.existsSync(path.join(process.cwd(), 'setup-db.mjs')), false)

console.log(`migrations ok: ${files.length} arquivos versionados`)
