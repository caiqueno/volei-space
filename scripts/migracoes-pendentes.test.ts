import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// Teste estático das migrations pendentes (supabase/pendentes) e do seed.
// Não executa SQL e não fala com banco: só lê os arquivos .sql.

const raiz = process.cwd()
const dirPendentes = path.join(raiz, 'supabase', 'pendentes', 'migrations')
const dirRollback = path.join(raiz, 'supabase', 'pendentes', 'rollback')
const dirOficiais = path.join(raiz, 'supabase', 'migrations')
const arquivoSeed = path.join(raiz, 'supabase', 'seed.sql')

function sqlSemComentario(fonte: string): string {
  return fonte
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((linha) => !linha.trim().startsWith('--'))
    .join('\n')
}

function listarSql(dir: string): string[] {
  return fs.readdirSync(dir).filter((nome) => nome.endsWith('.sql')).sort()
}

function ler(dir: string, nome: string): string {
  return fs.readFileSync(path.join(dir, nome), 'utf8')
}

const pendentes = listarSql(dirPendentes)
const rollbacks = listarSql(dirRollback)
assert.ok(pendentes.length >= 26, 'esperava ao menos 26 migrations pendentes')

// 1) Cada migration tem reversão de mesmo nome e vice-versa.
assert.deepEqual(rollbacks, pendentes, 'cada migration pendente precisa de rollback de mesmo nome')

// 2) Nomes sequenciais, sem colisão entre si nem com as migrations oficiais.
const versoes = pendentes.map((nome) => {
  const m = /^(\d{12})_[a-zA-Z0-9_]+\.sql$/.exec(nome)
  assert.ok(m, `nome fora do padrão AAAAMMDDNNNN_nome.sql: ${nome}`)
  return m![1]
})
assert.equal(new Set(versoes).size, versoes.length, 'versão duplicada entre pendentes')
versoes.forEach((versao, indice) => {
  assert.equal(versao, `20261017${String(indice + 1).padStart(4, '0')}`, `sequência quebrada em ${versao}`)
})
const oficiais = listarSql(dirOficiais)
const versoesOficiais = new Set(oficiais.map((nome) => nome.split('_')[0]))
for (const versao of versoes) assert.ok(!versoesOficiais.has(versao), `versão ${versao} colide com supabase/migrations`)
const maiorOficial = [...versoesOficiais].map((v) => v.padEnd(14, '0')).sort().pop()!
assert.ok(versoes[0].padEnd(14, '0') > maiorOficial, 'pendentes devem ordenar depois das migrations oficiais')

// Objetos criados pelas pendentes não podem repetir nome de tabela/função/view das oficiais.
const sqlOficial = oficiais.map((nome) => sqlSemComentario(ler(dirOficiais, nome))).join('\n')
const sqlPendente: Record<string, string> = {}
for (const nome of pendentes) sqlPendente[nome] = sqlSemComentario(ler(dirPendentes, nome))

const tabelasCriadas: { arquivo: string; tabela: string }[] = []
for (const [arquivo, sql] of Object.entries(sqlPendente)) {
  for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"([A-Za-z_][A-Za-z0-9_]*)"/gi)) {
    tabelasCriadas.push({ arquivo, tabela: m[1] })
  }
}
assert.ok(tabelasCriadas.length >= 12, 'esperava ao menos 12 tabelas novas nas pendentes')
for (const { tabela } of tabelasCriadas) {
  const re = new RegExp(`create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?(?:public\\.)?"${tabela}"`, 'i')
  assert.ok(!re.test(sqlOficial), `tabela ${tabela} já é criada em supabase/migrations`)
}
for (const [arquivo, sql] of Object.entries(sqlPendente)) {
  for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z_]+)\s*\(/gi)) {
    const re = new RegExp(`function\\s+(?:public\\.)?${m[1]}\\s*\\(`, 'i')
    assert.ok(!re.test(sqlOficial), `função ${m[1]} (${arquivo}) já existe em supabase/migrations`)
  }
}

// 3) RLS ligada em toda tabela criada (direto ou pelo laço com array de nomes na mesma migration).
for (const { arquivo, tabela } of tabelasCriadas) {
  const sql = sqlPendente[arquivo]
  const direto = new RegExp(`alter\\s+table\\s+(?:public\\.)?"${tabela}"\\s+enable\\s+row\\s+level\\s+security`, 'i').test(sql)
  let porLaco = false
  for (const m of sql.matchAll(/array\s*\[([^\]]*)\]/gi)) {
    if (m[1].includes(`'${tabela}'`)) porLaco = true
  }
  porLaco = porLaco && /enable\s+row\s+level\s+security/i.test(sql)
  assert.ok(direto || porLaco, `${arquivo}: tabela ${tabela} sem enable row level security`)
}

// 4) Nenhum grant para anon/authenticated em tabela nova.
for (const [arquivo, sql] of Object.entries(sqlPendente)) {
  for (const m of sql.matchAll(/grant\s+[^;]*?\s+to\s+([^;]*);/gi)) {
    const trecho = m[0]
    const destino = m[1].toLowerCase()
    if (!/\b(anon|authenticated|public)\b/.test(destino)) continue
    // Exceções conhecidas e revisadas: a view jogador_publico e o select por colunas em Partida (tabela antiga).
    const permitido = /jogador_publico/.test(trecho) || /"Partida"/.test(trecho)
    assert.ok(permitido, `${arquivo}: grant para anon/authenticated fora da lista permitida: ${trecho.replace(/\s+/g, ' ').slice(0, 120)}`)
  }
  for (const { arquivo: arquivoTabela, tabela } of tabelasCriadas) {
    if (arquivoTabela !== arquivo) continue
    assert.ok(
      new RegExp(`revoke\\s+all\\s+on\\s+table\\s+(?:public\\.)?"${tabela}"\\s+from`, 'i').test(sql) || /revoke\s+all\s+on\s+table\s+public\.%I\s+from/i.test(sql),
      `${arquivo}: tabela ${tabela} sem revoke explícito`,
    )
  }
}

// 5) Status de Inscricao: exatamente os cinco estados da inscrição automática.
const sqlInscricao = sqlPendente['202610170026_meu_time_inscricao.sql']
const blocoStatus = /create\s+table\s+if\s+not\s+exists\s+public\."Inscricao"\s*\([\s\S]*?status\s+text\s+not\s+null\s+default\s+'RASCUNHO'\s+check\s*\(status\s+in\s*\(([^)]*)\)\)/i.exec(sqlInscricao)
assert.ok(blocoStatus, 'CHECK de Inscricao.status não encontrado')
const estados = [...blocoStatus![1].matchAll(/'([A-Z_]+)'/g)].map((m) => m[1])
assert.deepEqual(estados, ['RASCUNHO', 'CONFIRMADA', 'CONFIRMADA_COM_PENDENCIAS', 'AJUSTE_PEDIDO', 'REMOVIDA'])
const textoInscricao = ler(dirPendentes, '202610170026_meu_time_inscricao.sql') + ler(dirRollback, '202610170026_meu_time_inscricao.sql')
for (const proibido of ['EM_ANALISE', 'PENDENCIA\'', 'LISTA_ESPERA', 'RECUSADA']) {
  assert.ok(!textoInscricao.includes(proibido), `Inscricao ainda cita ${proibido}`)
}
assert.ok(!/'APROVADA'/.test(sqlInscricao), 'Inscricao ainda aceita APROVADA')
assert.match(sqlInscricao, /avisos\s+jsonb/i, 'Inscricao.avisos jsonb ausente')
assert.ok(!/RENAME\s+(TO|COLUMN)/i.test(Object.values(sqlPendente).join('\n')), 'pendentes não devem renomear tabelas nem colunas')

// 6) Índices CONCURRENTLY: um comando, sem transação; reversões de índice duplicado não derrubam o índice oficial.
for (const arquivo of pendentes.filter((nome) => /_idx_/.test(nome))) {
  const sql = sqlPendente[arquivo]
  assert.ok(!/\b(begin|commit)\b/i.test(sql), `${arquivo}: CONCURRENTLY não pode ficar em transação`)
  assert.equal((sql.match(/;/g) ?? []).length, 1, `${arquivo}: deve conter um único comando`)
  const nomeIndice = /index\s+concurrently\s+if\s+not\s+exists\s+"([^"]+)"/i.exec(sql)?.[1]
  assert.ok(nomeIndice, `${arquivo}: índice não identificado`)
  if (new RegExp(`index\\s+if\\s+not\\s+exists\\s+"${nomeIndice}"`, 'i').test(sqlOficial)) {
    const rb = sqlSemComentario(ler(dirRollback, arquivo))
    assert.ok(!/drop\s+index/i.test(rb), `${arquivo}: reversão derrubaria índice que pertence a supabase/migrations`)
  }
}

// 7) Seed: existe, é idempotente e só tem dados fictícios.
const seed = fs.readFileSync(arquivoSeed, 'utf8')
const seedSql = sqlSemComentario(seed)
assert.ok(!/\b(delete|truncate|drop)\b/i.test(seedSql), 'seed não pode apagar dados')
assert.ok(!/senhaHash|passwordHash/i.test(seedSql), 'seed não deve gravar hash de senha')
assert.ok(!/\bupdate\s+"/i.test(seedSql), 'seed não deve atualizar dados existentes')
for (const m of seedSql.matchAll(/[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+)/g)) {
  assert.ok(/\.invalid$/.test(m[1]), `e-mail no seed fora do domínio reservado .invalid: ${m[0]}`)
}
for (const m of seedSql.matchAll(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g)) {
  assert.ok(m[0].startsWith('000.000.000-'), `CPF no seed não é de teste: ${m[0]}`)
}
for (const m of seedSql.matchAll(/'(\d{10,14})'/g)) {
  assert.ok(m[1].startsWith('0000000'), `número longo no seed (CPF/telefone) não é de teste: ${m[1]}`)
}
for (const chave of ['CandidaturaOrganizador', 'SEED-R2-LIGA-01', 'SEED-R2-LIGA-02', 'SEED-R2-LIGA-03', 'SEED-R2-GAME-01', "'EM_ANDAMENTO'", "'ENCERRADA'", 'simulacao']) {
  assert.ok(seedSql.includes(chave) || seedSql.includes(chave.replace(/'/g, '')), `seed sem ${chave}`)
}
assert.ok(/not\s+exists|on\s+conflict/i.test(seedSql), 'seed precisa de guarda de idempotência')
assert.ok(!/service_role|eyJ[A-Za-z0-9_-]{20,}|sbp_[A-Za-z0-9]+/.test(seed), 'seed não pode conter chave')

const config = fs.readFileSync(path.join(raiz, 'supabase', 'config.toml'), 'utf8')
assert.match(config, /sql_paths\s*=\s*\["\.\/seed\.sql"\]/)
assert.ok(!/(secret|key)\s*=\s*"[^"]{12,}"/i.test(config), 'config.toml não pode conter segredo')

console.log(`migracoes-pendentes: ${pendentes.length} migrations, ${tabelasCriadas.length} tabelas novas, seed e config OK`)
