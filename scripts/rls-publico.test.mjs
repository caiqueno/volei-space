import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const raiz = process.cwd()
const dir = path.join(raiz, 'supabase', 'migrations')
const arquivoNovo = '20261010140000_habilitar_rls_tabelas_publicas.sql'
const colunasPartida = [
  'id',
  'ligaId',
  'equipeAId',
  'equipeBId',
  'categoria',
  'rodada',
  'status',
  'dataHora',
  'localNome',
  'setsPorA',
  'setsPorB',
  'pontosPorA',
  'pontosPorB',
  'vencedorId',
]

function sqlSemComentario(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
}

function arquivosSql() {
  return fs.readdirSync(dir).filter((name) => name.endsWith('.sql')).sort()
}

function modelosPrisma() {
  const schema = fs.readFileSync(path.join(raiz, 'prisma', 'schema.prisma'), 'utf8')
  return [...schema.matchAll(/^model\s+(\w+)/gm)].map((match) => match[1])
}

function tabelasPublicas(files) {
  const tabelas = new Set(modelosPrisma())
  const modelos = new Set(tabelas)
  for (const name of files) {
    const sql = sqlSemComentario(fs.readFileSync(path.join(dir, name), 'utf8'))
    for (const match of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"([A-Za-z_][A-Za-z0-9_]*)"/gi)) {
      tabelas.add(match[1])
    }
    for (const match of sql.matchAll(/drop\s+table\s+(?:if\s+exists\s+)?(?:public\.)?"?([A-Za-z_][A-Za-z0-9_]*)"?/gi)) {
      if (!modelos.has(match[1])) tabelas.delete(match[1])
    }
  }
  return [...tabelas].sort()
}

function aplicarRlsDireto(sql, estado) {
  for (const match of sql.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:public\.)?"([A-Za-z_][A-Za-z0-9_]*)"\s+(enable|disable)\s+row\s+level\s+security/gi)) {
    estado.set(match[1], match[2].toLowerCase() === 'enable')
  }
  for (const block of sql.split(/do\s+\$\$/i).slice(1)) {
    if (!/enable row level security/i.test(block)) continue
    const lista = block.match(/array\s*\[([^\]]+)\]/i)
    if (!lista) continue
    for (const nome of lista[1].matchAll(/'([^']+)'/g)) estado.set(nome[1], true)
  }
  const listaNova = sql.match(/tabelas\s+text\[\]\s*:=\s*array\[([\s\S]*?)\]/i)
  if (listaNova && /enable row level security/i.test(sql)) {
    for (const nome of listaNova[1].matchAll(/'([^']+)'/g)) estado.set(nome[1], true)
  }
}

function simularRls(files) {
  const estado = new Map(tabelasPublicas(files).map((nome) => [nome, false]))
  for (const name of files) {
    const sql = sqlSemComentario(fs.readFileSync(path.join(dir, name), 'utf8'))
    aplicarRlsDireto(sql, estado)
  }
  return estado
}

function nomesDaLista(sql) {
  const lista = sql.match(/tabelas\s+text\[\]\s*:=\s*array\[([\s\S]*?)\]/i)
  assert.ok(lista, 'a migration nova não declara o array tabelas')
  return [...lista[1].matchAll(/'([^']+)'/g)].map((match) => match[1])
}

function historicoSemRlsNoComentario(source) {
  const linhas = source.split('\n')
  const inicio = linhas.findIndex((linha) => linha.includes('Historico anterior sem RLS:'))
  assert.ok(inicio >= 0, 'comentário do histórico sem RLS ausente')
  const nomes = []
  for (const linha of linhas.slice(inicio + 1)) {
    const match = linha.match(/^--\s+([A-Za-z][A-Za-z0-9_]*)$/)
    if (!match) break
    nomes.push(match[1])
  }
  return nomes
}

function aplicarGrant(entry, privilegios) {
  const texto = privilegios.toLowerCase()
  if (/\ball\b/.test(texto)) {
    entry.select = 'table'
    entry.columns = null
    entry.insert = true
    entry.update = true
    entry.delete = true
    return
  }
  if (/\bselect\b/.test(texto)) {
    entry.select = 'table'
    entry.columns = null
  }
  if (/\binsert\b/.test(texto)) entry.insert = true
  if (/\bupdate\b/.test(texto)) entry.update = true
  if (/\bdelete\b/.test(texto)) entry.delete = true
}

function simularGrantsAnon(files) {
  const grants = new Map()
  const padroes = [
    {
      re: /revoke\s+all\s+on\s+all\s+tables\s+in\s+schema\s+public\s+from\s+[^;]*\banon\b/gi,
      aplicar(_match, estado) {
        estado.clear()
      },
    },
    {
      re: /revoke\s+insert\s*,\s*update\s*,\s*delete\s+on\s+(?:table\s+)?(?:public\.)?"([A-Za-z_][A-Za-z0-9_]*)"\s+from\s+[^;]*\banon\b/gi,
      aplicar(match, estado) {
        const entry = estado.get(match[1])
        if (!entry) return
        entry.insert = false
        entry.update = false
        entry.delete = false
      },
    },
    {
      re: /revoke\s+all\s+on\s+(?:table\s+)?(?:public\.)?"([A-Za-z_][A-Za-z0-9_]*)"\s+from\s+[^;]*\banon\b/gi,
      aplicar(match, estado) {
        estado.delete(match[1])
      },
    },
    {
      re: /grant\s+select\s*\(([^)]*)\)\s+on\s+table\s+(?:public\.)?"([A-Za-z_][A-Za-z0-9_]*)"\s+to\s+[^;]*\banon\b/gi,
      aplicar(match, estado) {
        const colunas = [...match[1].matchAll(/"([^"]+)"/g)].map((coluna) => coluna[1])
        estado.set(match[2], { select: 'columns', columns: colunas, insert: false, update: false, delete: false })
      },
    },
    {
      re: /grant\s+([a-z\s,]+)\s+on\s+(?:table\s+)?(?:public\.)?"([A-Za-z_][A-Za-z0-9_]*)"\s+to\s+[^;]*\banon\b/gi,
      aplicar(match, estado) {
        const entry = estado.get(match[2]) ?? { select: false, columns: null, insert: false, update: false, delete: false }
        aplicarGrant(entry, match[1])
        estado.set(match[2], entry)
      },
    },
  ]

  for (const name of files) {
    const bruto = fs.readFileSync(path.join(dir, name), 'utf8')
    const sql = sqlSemComentario(bruto)
    if (name === arquivoNovo) {
      for (const tabela of nomesDaLista(sql)) {
        if (tabela !== 'Partida') grants.delete(tabela)
      }
      continue
    }
    const eventos = []
    for (const padrao of padroes) {
      for (const match of sql.matchAll(padrao.re)) {
        eventos.push({ index: match.index, aplicar: () => padrao.aplicar(match, grants) })
      }
    }
    const dinamico = /foreach\s+t\s+in\s+array\s+array\[([^\]]+)\][\s\S]{0,600}?revoke all on %I from anon/gi
    for (const match of sql.matchAll(dinamico)) {
      const nomes = [...match[1].matchAll(/'([^']+)'/g)].map((nome) => nome[1])
      eventos.push({
        index: match.index,
        aplicar: () => {
          for (const nome of nomes) grants.delete(nome)
        },
      })
    }
    eventos.sort((a, b) => a.index - b.index)
    for (const evento of eventos) evento.aplicar()
  }
  return grants
}

const files = arquivosSql()
assert.ok(files.includes(arquivoNovo), 'migration de RLS ausente')
assert.equal(files.filter((name) => name.startsWith('20261010140000')).length, 1)
assert.ok(files.at(-1) === arquivoNovo, 'a migration de RLS precisa ser a última pelo prefixo')

const anteriores = files.filter((name) => name !== arquivoNovo)
const inventario = tabelasPublicas(anteriores)
const migration = fs.readFileSync(path.join(dir, arquivoNovo), 'utf8')
const sqlNovo = sqlSemComentario(migration)
const lista = nomesDaLista(sqlNovo)
assert.deepEqual(lista, inventario, 'o array da migration não cobre o schema public')
assert.match(sqlNovo, /alter table if exists public\.%I enable row level security/i)
assert.match(sqlNovo, /to_regclass\(format\('public\.%I', tabela\)\) is null/)
assert.doesNotMatch(sqlNovo, /\bforce\s+row\s+level\s+security\b/i)
assert.doesNotMatch(sqlNovo, /\bdisable\s+row\s+level\s+security\b/i)
assert.doesNotMatch(sqlNovo, /\bservice_role\b/i)
assert.doesNotMatch(sqlNovo, /\bgrant\b/i)
assert.doesNotMatch(sqlNovo, /sumulaToken/)
assert.match(sqlNovo, /tabela <> 'Partida'/)
assert.match(sqlNovo, /revoke all on table public\.%I from anon/i)
assert.match(sqlNovo, /revoke all on table public\.%I from authenticated/i)
assert.match(sqlNovo, /revoke all on table public\.%I from public/i)
assert.doesNotMatch(sqlNovo, /revoke all on table public\."Partida" from anon/i)
assert.equal((sqlNovo.match(/create policy/gi) ?? []).length, 1)
assert.match(sqlNovo, /create policy "public_read_partidas"\s+on public\."Partida"\s+for select\s+to anon, authenticated\s+using \(true\)/i)
assert.match(sqlNovo, /policyname = 'public_read_partidas'/)

const semAntes = [...simularRls(anteriores).entries()].filter(([, ligado]) => !ligado).map(([nome]) => nome).sort()
assert.deepEqual(semAntes, [
  'CandidaturaArbitro',
  'CandidaturaEquipe',
  'CandidaturaPartidaArbitro',
  'CandidaturaQuadra',
  'ClassificacaoEliminatoria',
  'CodigoAcessoOrganizador',
  'ContaPublico',
  'ConviteEquipe',
  'Interessado',
])
assert.deepEqual(historicoSemRlsNoComentario(migration), semAntes)

const semDepois = [...simularRls(files).entries()].filter(([, ligado]) => !ligado).map(([nome]) => nome)
assert.deepEqual(semDepois, [], `tabelas public ainda sem RLS: ${semDepois.join(', ')}`)

const grants = simularGrantsAnon(files)
assert.deepEqual([...grants.keys()], ['Partida'])
const partida = grants.get('Partida')
assert.equal(partida.select, 'columns')
assert.deepEqual(partida.columns, colunasPartida)
assert.equal(partida.insert, false)
assert.equal(partida.update, false)
assert.equal(partida.delete, false)
assert.ok(!partida.columns.includes('sumulaToken'))

const placar = fs.readFileSync(path.join(dir, '202610100002_fechar_leitura_publica_placar.sql'), 'utf8')
assert.match(placar, /revoke all on table public\."SetPartida" from anon, authenticated/i)
assert.match(placar, /create or replace function public\.finalizar_inscricao_equipe_rascunho/)

function arquivosComClienteAnon() {
  const encontrados = []
  function visitar(diretorio) {
    for (const entrada of fs.readdirSync(diretorio, { withFileTypes: true })) {
      const caminho = path.join(diretorio, entrada.name)
      if (entrada.isDirectory()) {
        if (entrada.name === 'node_modules' || entrada.name === '.next') continue
        visitar(caminho)
        continue
      }
      if (!/\.(ts|tsx)$/.test(entrada.name)) continue
      const texto = fs.readFileSync(caminho, 'utf8')
      const importaCliente = [...texto.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]@\/lib\/supabase['"]/g)]
        .some((match) => /\bsupabase\b/.test(match[1]))
      if (importaCliente) encontrados.push(path.relative(raiz, caminho))
    }
  }
  visitar(path.join(raiz, 'src'))
  return encontrados.sort()
}

const clientesAnon = arquivosComClienteAnon()
assert.ok(clientesAnon.includes('src/lib/use-banco-ao-vivo.ts'))
const realtime = fs.readFileSync(path.join(raiz, 'src/lib/use-banco-ao-vivo.ts'), 'utf8')
assert.match(realtime, /tabela: 'ClassificacaoEntrada' \| 'Partida' \| 'SetPartida'/)
assert.doesNotMatch(realtime, /\.from\(/)
for (const arquivo of clientesAnon) {
  if (arquivo === 'src/lib/use-banco-ao-vivo.ts') continue
  const texto = fs.readFileSync(path.join(raiz, arquivo), 'utf8')
  assert.doesNotMatch(texto, /supabase\.from\(/, `${arquivo} consulta tabela com a chave publicável`)
  assert.doesNotMatch(texto, /supabase\.rpc\(/, `${arquivo} chama RPC com a chave publicável`)
  assert.doesNotMatch(texto, /supabase\.channel\(/, `${arquivo} assina Realtime além de useBancoAoVivo`)
}

function urlLocal(valor) {
  if (!valor) return null
  let url
  try {
    url = new URL(valor)
  } catch {
    return null
  }
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname)) return null
  return url
}

function provarNoPostgres() {
  const url = urlLocal(process.env.DATABASE_URL?.trim())
  if (!url) {
    console.log('SKIP rls-publico postgres: DATABASE_URL local ausente')
    return
  }
  const psql = spawnSync('psql', ['--version'], { encoding: 'utf8' })
  if (psql.error || psql.status !== 0) {
    console.log('SKIP rls-publico postgres: cliente psql ausente')
    return
  }
  const base = url.toString()
  const nomeBanco = `volei_rls_${process.pid}`
  const alvo = new URL(base)
  alvo.pathname = `/${nomeBanco}`
  const papelAnonExistia = consultaExiste(base, "select 1 from pg_roles where rolname = 'anon'")
  const papelAuthenticatedExistia = consultaExiste(base, "select 1 from pg_roles where rolname = 'authenticated'")

  executar(base, `drop database if exists ${nomeBanco}`)
  executar(base, `create database ${nomeBanco}`)
  try {
    if (!papelAnonExistia) executar(base, 'create role anon nologin')
    if (!papelAuthenticatedExistia) executar(base, 'create role authenticated nologin')
    executar(base, 'grant anon to current_user')
    executar(base, 'grant authenticated to current_user')
    const setup = lista
      .filter((tabela) => tabela !== 'Interessado')
      .map((tabela) => {
        if (tabela === 'Partida') {
          return 'create table public."Partida" (id integer, "sumulaToken" text);'
        }
        return `create table public."${tabela}" (id integer);`
      })
      .join('\n')
    const arquivoSetup = path.join(os.tmpdir(), `volei-rls-setup-${process.pid}.sql`)
    fs.writeFileSync(arquivoSetup, `
${setup}
grant select on table public."Liga" to anon;
grant select on table public."Liga" to public;
grant select (id) on table public."Partida" to anon;
grant select ("sumulaToken") on table public."Partida" to public;
grant select on table public."SetPartida" to anon;
`)
    executarArquivo(alvo.toString(), arquivoSetup)
    executarArquivo(alvo.toString(), path.join(dir, arquivoNovo))
    fs.unlinkSync(arquivoSetup)

    const flags = executar(alvo.toString(), `
      select c.relname || '|' || c.relrowsecurity::text || '|' || c.relforcerowsecurity::text
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
      order by 1
    `).trim().split('\n').filter(Boolean)
    const criadas = lista.filter((tabela) => tabela !== 'Interessado')
    assert.equal(flags.length, criadas.length)
    for (const linha of flags) {
      const [nome, rls, force] = linha.split('|')
      assert.equal(rls, 'true', `${nome} sem RLS no Postgres local`)
      assert.equal(force, 'false', `${nome} está com FORCE RLS`)
    }
    assert.equal(executar(alvo.toString(), `select to_regclass('public."Interessado"')`).trim(), '', 'tabela ausente não deveria ser criada')
    assert.equal(executar(alvo.toString(), `select has_table_privilege('anon', 'public."Liga"', 'select')`).trim(), 'f')
    assert.equal(executar(alvo.toString(), `select has_table_privilege('anon', 'public."SetPartida"', 'select')`).trim(), 'f')
    assert.equal(executar(alvo.toString(), `select has_table_privilege('anon', 'public."Partida"', 'select')`).trim(), 'f', 'anon não pode ter SELECT da tabela inteira de Partida')
    assert.equal(executar(alvo.toString(), `select has_column_privilege('anon', 'public."Partida"', 'id', 'select')`).trim(), 't')
    assert.equal(executar(alvo.toString(), `select has_column_privilege('anon', 'public."Partida"', 'sumulaToken', 'select')`).trim(), 'f')
    assert.equal(executar(alvo.toString(), `select has_table_privilege('public', 'public."Partida"', 'select')`).trim(), 'f')
    assert.equal(executar(alvo.toString(), `
      select count(*) from pg_policies
      where schemaname = 'public' and tablename = 'Partida' and policyname = 'public_read_partidas'
    `).trim(), '1')
    assert.equal(executar(alvo.toString(), `
      select count(*) from pg_policies where schemaname = 'public' and tablename <> 'Partida'
    `).trim(), '0')

    executar(alvo.toString(), `insert into public."Partida" (id, "sumulaToken") values (7, 'secreto')`)
    assert.throws(() => executar(alvo.toString(), 'begin; set local role anon; select * from public."Liga"; commit;'))
    const placarAnon = executar(alvo.toString(), 'begin; set local role anon; select id::text from public."Partida"; commit;')
    assert.match(placarAnon, /^7$/m)
    assert.throws(() => executar(alvo.toString(), 'begin; set local role anon; select "sumulaToken" from public."Partida"; commit;'))
    console.log(`rls-publico postgres ok: ${criadas.length} tabelas`)
  } finally {
    executar(base, `drop database if exists ${nomeBanco} with (force)`)
    executar(base, 'revoke anon from current_user')
    executar(base, 'revoke authenticated from current_user')
    if (!papelAnonExistia) executar(base, 'drop role if exists anon')
    if (!papelAuthenticatedExistia) executar(base, 'drop role if exists authenticated')
  }
}

function executar(url, sql) {
  return execFileSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-t', '-A', '-c', sql], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function executarArquivo(url, arquivo) {
  return execFileSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-f', arquivo], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function consultaExiste(url, sql) {
  try {
    return executar(url, sql).trim() === '1'
  } catch {
    return false
  }
}

provarNoPostgres()
console.log(`rls-publico ok: ${inventario.length} tabelas, ${semAntes.length} sem RLS no histórico anterior`)
