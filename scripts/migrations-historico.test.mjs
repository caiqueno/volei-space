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
const leituraRealtime = '20261010141000_leitura_publica_sets_classificacao.sql'
for (const name of files) {
  if (versionOf(name) <= fechamento) continue
  if (name === leituraRealtime) continue
  const sql = sqlSemComentario(fs.readFileSync(path.join(dir, name), 'utf8'))
  assert.doesNotMatch(sql, /\bgrant\b[^;]*\bto\s+anon\b/i, `${name} concede a anon depois do fechamento`)
  assert.doesNotMatch(sql, /\bgrant\b[^;]*\bto\s+authenticated\b/i, `${name} concede a authenticated depois do fechamento`)
}

const arquivoWo = '20261010139000_wo_configuravel.sql'
const arquivoSancoes = '20261010139500_sancoes_suspensao.sql'
assert.ok(files.includes(arquivoWo), 'migration do W.O. ausente')
assert.ok(files.includes(arquivoSancoes), 'migration de sanções ausente')
assert.equal(files.some((name) => name.startsWith('20261010150000')), false)
const ordem = [arquivoWo, arquivoSancoes, '20261010140000_habilitar_rls_tabelas_publicas.sql', leituraRealtime].map((name) => files.indexOf(name))
assert.ok(ordem.every((index) => index >= 0))
assert.deepEqual(ordem, [...ordem].sort((a, b) => a - b))

const leituraSql = sqlSemComentario(fs.readFileSync(path.join(dir, leituraRealtime), 'utf8'))
const concessoesLeitura = [...leituraSql.matchAll(/grant\s+[^;']+/gi)].map((match) => match[0].replace(/\s+/g, ' ').trim())
assert.deepEqual(concessoesLeitura, [
  'grant select on table public."SetPartida" to anon, authenticated',
  'grant select on table public."ClassificacaoEntrada" to anon, authenticated',
])
assert.doesNotMatch(leituraSql, /sumulaToken/)
assert.doesNotMatch(leituraSql, /grant\s[^;]*\bon\s+(?:table\s+)?(?:public\.)?"Partida"/i)

const placar = fs.readFileSync(path.join(dir, '202610100002_fechar_leitura_publica_placar.sql'), 'utf8')
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

const numeroPartida = fs.readFileSync(path.join(dir, '202610100001_sumula_presenca_presente_nulo.sql'), 'utf8')
assert.match(numeroPartida, /alter column presente drop not null/i)
assert.doesNotMatch(numeroPartida, /\b(delete|truncate|drop table)\b/i)

const consultas = fs.readFileSync(path.join(dir, '20261010015632_indices_consultas_quentes.sql'), 'utf8')
const indicesQuentes = [
  '"Liga_publica_criadoEm_idx"',
  '"Liga_publica_status_criadoEm_idx"',
  '"Liga_organizadorId_criadoEm_idx"',
  '"CategoriaCampeonato_ligaId_ordem_idx"',
  '"Equipe_ligaId_statusEquipe_nome_idx"',
  '"GrupoEquipeCampeonato_equipeId_idx"',
  '"Jogador_equipeId_numero_nome_idx"',
  '"Jogador_equipeId_banido_criadoEm_idx"',
  '"Partida_grupoId_idx"',
  '"Partida_ligaId_fase_rodada_idx"',
  '"Partida_ligaId_status_dataHora_idx"',
  '"Partida_status_dataHora_idx"',
  '"Partida_ligaId_rodada_dataHora_idx"',
  '"OcorrenciaPartida_partidaId_set_idx"',
  '"OcorrenciaPartida_partidaId_tipo_idx"',
]
for (const nome of indicesQuentes) {
  assert.ok(consultas.includes(`CREATE INDEX IF NOT EXISTS ${nome}`), `índice ausente: ${nome}`)
}
const consultasSql = sqlSemComentario(consultas)
assert.equal((consultasSql.match(/CREATE INDEX IF NOT EXISTS/g) ?? []).length, indicesQuentes.length)
assert.doesNotMatch(consultasSql, /\b(delete|truncate|drop|alter table)\b/i)
assert.match(consultas, /WHERE simulacao = false/)

const schema = fs.readFileSync(path.join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8')
for (const trecho of [
  '@@index([organizadorId, criadoEm])',
  '@@index([ligaId, ordem])',
  '@@index([ligaId, statusEquipe, nome])',
  '@@index([equipeId, numero, nome])',
  '@@index([equipeId, banido, criadoEm])',
  '@@index([grupoId])',
  '@@index([ligaId, fase, rodada])',
  '@@index([ligaId, status, dataHora])',
  '@@index([status, dataHora])',
  '@@index([ligaId, rodada, dataHora])',
  '@@index([partidaId, set])',
  '@@index([partidaId, tipo])',
]) {
  assert.ok(schema.includes(trecho), `Prisma sem ${trecho}`)
}
assert.doesNotMatch(schema, /WHERE simulacao = false/)

assert.equal(fs.existsSync(path.join(process.cwd(), 'setup-db.mjs')), false)

console.log(`migrations ok: ${files.length} arquivos versionados`)
