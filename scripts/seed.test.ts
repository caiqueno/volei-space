import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// Teste estático do supabase/seed.sql (Rodada 19). Não executa SQL e não fala com banco.
// Confere: cabeçalho de "só desenvolvimento", id explícito nas tabelas de id inteiro,
// ordem das chaves estrangeiras, idempotência, dados fictícios e tabelas conhecidas.

const raiz = process.cwd()
const bruto = fs.readFileSync(path.join(raiz, 'supabase', 'seed.sql'), 'utf8')
const sql = bruto
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((linha) => !linha.trim().startsWith('--'))
  .join('\n')

// 1) Cabeçalho avisa que é só para desenvolvimento.
const cabecalho = bruto.split('\n').slice(0, 12).join('\n')
assert.match(cabecalho, /SOMENTE PARA DESENVOLVIMENTO/i, 'cabeçalho sem aviso de uso somente em desenvolvimento')
assert.match(cabecalho, /NUNCA rodar em produ/i, 'cabeçalho sem aviso contra produção')

// 2) Tabelas com id inteiro e sem default no schema (autoincrement do Prisma não vira default no banco).
const prisma = fs.readFileSync(path.join(raiz, 'prisma', 'schema.prisma'), 'utf8')
const modelos = [...prisma.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)]
const idInteiro = /^\s*id\s+(Int|BigInt)\s+@id\s+@default\(autoincrement\(\)\)/m
const tabelasIdInteiro = new Set<string>(modelos.filter((m) => idInteiro.test(m[2])).map((m) => m[1]))
for (const obrigatoria of ['Liga', 'Equipe', 'Jogador', 'Partida', 'SetPartida']) assert.ok(tabelasIdInteiro.has(obrigatoria), 'schema.prisma deveria ter ' + obrigatoria + ' com id inteiro')

// 3) Cada INSERT: lista de colunas explícita, id informado onde o id é inteiro, idempotente.
const inserts = [...sql.matchAll(/insert\s+into\s+"(\w+)"\s*\(([\s\S]*?)\)\s*(?:values|select)\b([\s\S]*?);/gi)]
assert.ok(inserts.length >= 8, 'seed com poucos INSERTs (' + inserts.length + ')')
const ordem: string[] = inserts.map((m) => m[1])
const colunasDe = (m: RegExpMatchArray) => m[2].split(',').map((c) => c.trim().replace(/"/g, ''))
for (const m of inserts) assert.match(m[3], /on\s+conflict\b/i, 'INSERT em "' + m[1] + '" sem on conflict')
for (const m of inserts.filter((i) => tabelasIdInteiro.has(i[1]))) assert.ok(colunasDe(m).includes('id'), 'INSERT em "' + m[1] + '" sem id explícito (id inteiro sem default)')
assert.ok(!/insert\s+into\s+"?\w+"?\s+values/i.test(sql), 'INSERT sem lista de colunas')

// 4) Ordem das chaves estrangeiras (pai antes do filho).
const antes: Array<[string, string]> = [
  ['CandidaturaOrganizador', 'Liga'],
  ['Liga', 'CategoriaCampeonato'],
  ['CategoriaCampeonato', 'CategoriaConfiguracao'],
  ['CategoriaCampeonato', 'Equipe'],
  ['Equipe', 'Jogador'],
  ['Equipe', 'Partida'],
  ['Partida', 'SetPartida'],
]
for (const par of antes) assert.ok(ordem.includes(par[0]) && ordem.includes(par[1]) && ordem.indexOf(par[0]) < ordem.indexOf(par[1]), par[0] + ' precisa existir e ser inserido antes de ' + par[1])

// 5) Não apaga nem altera nada e não grava hash de senha.
assert.ok(!/\b(delete|truncate|drop|update)\b/i.test(sql), 'seed não pode apagar nem atualizar dados')
assert.ok(!/senhaHash|passwordHash/i.test(sql), 'seed não deve gravar hash de senha')

// 6) Dados fictícios: e-mail só no domínio reservado .invalid; sem CPF, telefone ou documento.
for (const m of sql.matchAll(/[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+)/g)) assert.ok(/\.invalid$/.test(m[1]), 'e-mail fora do domínio reservado .invalid: ' + m[0])
assert.ok(!/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/.test(sql), 'seed não deve ter nada com formato de CPF')
assert.ok(!/\b\d{10,14}\b/.test(sql), 'número longo no seed (CPF/telefone)')
const todasColunas = inserts.map((i) => colunasDe(i).join(' ')).join(' ')
for (const coluna of ['cpf', 'telefone', 'telefoneEmergencia', 'documentoNumero', 'dataNascimento', 'fotoUrl']) assert.ok(!todasColunas.split(' ').includes(coluna), 'seed não deve preencher ' + coluna)

// 7) Volume prometido: 1 liga, 2 categorias, 6 equipes, 6 jogos, 8 jogadores por equipe.
const bloco = (tabela: string) => inserts.filter((i) => i[1] === tabela).map((i) => i[3]).join('\n')
const contar = (tabela: string, padrao: RegExp) => [...bloco(tabela).matchAll(padrao)].length
assert.ok(/\b9001\b/.test(bloco('Liga')), 'liga 9001 ausente')
assert.equal(contar('CategoriaCampeonato', /^\s*\('00000000-/gm), 2, 'esperava 2 categorias')
assert.equal(contar('Equipe', /^\s*\(91\d\d,/gm), 6, 'esperava 6 equipes')
assert.equal(contar('Partida', /^\s*\(92\d\d,/gm), 6, 'esperava 6 jogos')
assert.match(bloco('Jogador'), /generate_series\(1,\s*8\)/, 'esperava 8 jogadores por equipe')
assert.equal(contar('Jogador', /^\s*\(91\d\d,\s*'/gm), 6, 'esperava 6 equipes com jogadores')
for (const estado of ['ENCERRADA', 'EM_ANDAMENTO', 'AGENDADA']) assert.ok(bloco('Partida').includes("'" + estado + "'"), 'nenhum jogo ' + estado)

// 8) Toda tabela citada existe nas migrations (criada ou referenciada) e no schema.prisma.
const dirMigrations = path.join(raiz, 'supabase', 'migrations')
const arquivosSql = fs.readdirSync(dirMigrations).filter((n) => n.endsWith('.sql'))
const textoMigrations = arquivosSql.map((n) => fs.readFileSync(path.join(dirMigrations, n), 'utf8')).join('\n')
for (const tabela of new Set(ordem)) assert.ok(textoMigrations.includes('"' + tabela + '"'), 'tabela "' + tabela + '" do seed não aparece em nenhuma migration de supabase/migrations')
const nomesModelos = new Set<string>(modelos.map((m) => m[1]))
for (const tabela of new Set(ordem)) assert.ok(nomesModelos.has(tabela), 'tabela "' + tabela + '" do seed não existe no schema.prisma')

console.log('seed: ' + inserts.length + ' INSERTs, ' + new Set(ordem).size + ' tabelas, ids explícitos, idempotente, dados fictícios OK')
