/**
 * setup-db.mjs — Cria o banco SQLite e popula com seed usando node:sqlite (Node 22+)
 * Uso: node setup-db.mjs
 */
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'

const DB_PATH = 'C:/Users/willm/luva-dev.db'

console.log(`\n🗄️  Criando banco de dados: ${DB_PATH}\n`)
const db = new DatabaseSync(DB_PATH)

// ─── Schema ───────────────────────────────────────────────────────────────────
db.exec(`
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS Liga (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  subtitulo TEXT,
  descricao TEXT,
  logoUrl TEXT,
  capaUrl TEXT,
  corTematica TEXT NOT NULL DEFAULT '#0F2C52',
  status TEXT NOT NULL DEFAULT 'EM_BREVE',
  dataInicio TEXT,
  dataFim TEXT,
  criadoEm TEXT NOT NULL DEFAULT (datetime('now')),
  atualizadoEm TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS Equipe (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  logoUrl TEXT,
  corHex TEXT,
  categoria TEXT NOT NULL,
  serie TEXT NOT NULL DEFAULT 'PRATA',
  ligaId INTEGER NOT NULL,
  criadoEm TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (ligaId) REFERENCES Liga(id),
  UNIQUE (nome, ligaId, categoria, serie)
);

CREATE TABLE IF NOT EXISTS Jogador (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  fotoUrl TEXT,
  posicao TEXT,
  numero INTEGER,
  equipeId INTEGER NOT NULL,
  criadoEm TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (equipeId) REFERENCES Equipe(id)
);

CREATE TABLE IF NOT EXISTS Arbitro (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  telefone TEXT,
  cref TEXT,
  diplomaUrl TEXT,
  aprovado INTEGER NOT NULL DEFAULT 0,
  criadoEm TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS Partida (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ligaId INTEGER NOT NULL,
  equipeAId INTEGER NOT NULL,
  equipeBId INTEGER NOT NULL,
  categoria TEXT NOT NULL,
  serie TEXT NOT NULL,
  rodada INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'AGENDADA',
  dataHora TEXT,
  localNome TEXT,
  localEndereco TEXT,
  setsPorA INTEGER,
  setsPorB INTEGER,
  pontosPorA INTEGER,
  pontosPorB INTEGER,
  vencedorId INTEGER,
  sumulaToken TEXT UNIQUE,
  sumulaTokenExpira TEXT,
  sumulaSubmetidaEm TEXT,
  sumulaAprovadaEm TEXT,
  criadoEm TEXT NOT NULL DEFAULT (datetime('now')),
  atualizadoEm TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (ligaId) REFERENCES Liga(id),
  FOREIGN KEY (equipeAId) REFERENCES Equipe(id),
  FOREIGN KEY (equipeBId) REFERENCES Equipe(id)
);

CREATE INDEX IF NOT EXISTS idx_partida ON Partida(ligaId, categoria, serie, rodada);

CREATE TABLE IF NOT EXISTS SetPartida (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  partidaId INTEGER NOT NULL,
  numero INTEGER NOT NULL,
  pontosA INTEGER NOT NULL,
  pontosB INTEGER NOT NULL,
  FOREIGN KEY (partidaId) REFERENCES Partida(id) ON DELETE CASCADE,
  UNIQUE (partidaId, numero)
);

CREATE TABLE IF NOT EXISTS SumulaPresenca (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  partidaId INTEGER NOT NULL,
  jogadorId INTEGER NOT NULL,
  equipeId INTEGER NOT NULL,
  presente INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (partidaId) REFERENCES Partida(id) ON DELETE CASCADE,
  FOREIGN KEY (jogadorId) REFERENCES Jogador(id),
  FOREIGN KEY (equipeId) REFERENCES Equipe(id),
  UNIQUE (partidaId, jogadorId)
);

CREATE TABLE IF NOT EXISTS OcorrenciaPartida (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  partidaId INTEGER NOT NULL,
  tipo TEXT NOT NULL,
  descricao TEXT,
  "set" INTEGER,
  FOREIGN KEY (partidaId) REFERENCES Partida(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS DestaquesPartida (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  partidaId INTEGER NOT NULL,
  jogadorId INTEGER NOT NULL,
  tipo TEXT NOT NULL,
  FOREIGN KEY (partidaId) REFERENCES Partida(id) ON DELETE CASCADE,
  FOREIGN KEY (jogadorId) REFERENCES Jogador(id),
  UNIQUE (partidaId, tipo)
);

CREATE TABLE IF NOT EXISTS VotoMVP (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jogadorId INTEGER NOT NULL,
  categoria TEXT NOT NULL,
  serie TEXT NOT NULL,
  sessaoId TEXT NOT NULL,
  criadoEm TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (jogadorId) REFERENCES Jogador(id),
  UNIQUE (jogadorId, sessaoId)
);

CREATE TABLE IF NOT EXISTS ClassificacaoEntrada (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  equipeId INTEGER UNIQUE NOT NULL,
  categoria TEXT NOT NULL,
  serie TEXT NOT NULL,
  posicao INTEGER NOT NULL,
  pontos INTEGER NOT NULL DEFAULT 0,
  jogos INTEGER NOT NULL DEFAULT 0,
  vitorias INTEGER NOT NULL DEFAULT 0,
  derrotas INTEGER NOT NULL DEFAULT 0,
  setsPro INTEGER NOT NULL DEFAULT 0,
  setsContra INTEGER NOT NULL DEFAULT 0,
  pontosPro INTEGER NOT NULL DEFAULT 0,
  pontosContra INTEGER NOT NULL DEFAULT 0,
  punicoes INTEGER NOT NULL DEFAULT 0,
  atualizadoEm TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (equipeId) REFERENCES Equipe(id)
);

CREATE TABLE IF NOT EXISTS Premiacao (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ligaId INTEGER NOT NULL,
  categoria TEXT NOT NULL,
  serie TEXT NOT NULL,
  colocacao INTEGER NOT NULL,
  descricao TEXT NOT NULL,
  imagemUrl TEXT,
  FOREIGN KEY (ligaId) REFERENCES Liga(id)
);

CREATE TABLE IF NOT EXISTS Midia (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ligaId INTEGER NOT NULL,
  tipo TEXT NOT NULL,
  url TEXT NOT NULL,
  titulo TEXT,
  tag TEXT,
  criadoEm TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (ligaId) REFERENCES Liga(id)
);

CREATE TABLE IF NOT EXISTS Mensagem (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ligaId INTEGER NOT NULL,
  autor TEXT NOT NULL,
  texto TEXT NOT NULL,
  aprovada INTEGER NOT NULL DEFAULT 0,
  criadoEm TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (ligaId) REFERENCES Liga(id)
);

CREATE TABLE IF NOT EXISTS Admin (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  senhaHash TEXT NOT NULL,
  nome TEXT NOT NULL,
  criadoEm TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS EscalaArbitro (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  partidaId INTEGER NOT NULL,
  arbitroId INTEGER NOT NULL,
  cargo TEXT NOT NULL,
  FOREIGN KEY (partidaId) REFERENCES Partida(id),
  FOREIGN KEY (arbitroId) REFERENCES Arbitro(id),
  UNIQUE (partidaId, cargo)
);

-- Tabela de controle de migrations para Prisma reconhecer o DB
CREATE TABLE IF NOT EXISTS _prisma_migrations (
  id TEXT PRIMARY KEY,
  checksum TEXT NOT NULL,
  finished_at TEXT,
  migration_name TEXT NOT NULL,
  logs TEXT,
  rolled_back_at TEXT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  applied_steps_count INTEGER NOT NULL DEFAULT 0
);
`)

console.log('✓ Schema criado')

// ─── Admin ────────────────────────────────────────────────────────────────────
// Senha: LuvAdmin@2026 — hash bcrypt pré-calculado (rounds=10)
const ADMIN_HASH = '$2a$10$PIugz/XtUFrpjMVyV9SVo.TtcC/Z8r70XNqVjjXpmzH7eC8Leg78G'

const existingAdmin = db.prepare('SELECT id FROM Admin WHERE email = ?').get('admin@luv.com.br')
if (!existingAdmin) {
  db.prepare("INSERT INTO Admin (email, senhaHash, nome) VALUES (?, ?, ?)").run(
    'admin@luv.com.br', ADMIN_HASH, 'Admin LUV'
  )
}
console.log('✓ Admin criado: admin@luv.com.br / LuvAdmin@2026')

// ─── Liga ─────────────────────────────────────────────────────────────────────
const existingLiga = db.prepare('SELECT id FROM Liga WHERE slug = ?').get('luva-2026')
if (!existingLiga) {
  db.prepare(`INSERT INTO Liga (slug, nome, subtitulo, descricao, corTematica, status, dataInicio, dataFim)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    'luva-2026',
    'LUVA 2026',
    '1ª Temporada Oficial',
    'A primeira temporada da Liga Única de Vôlei. Times da região disputam o título em 5 categorias.',
    '#0F2C52',
    'ATIVA',
    '2026-04-01T00:00:00.000Z',
    '2026-11-30T00:00:00.000Z'
  )
}
const liga = db.prepare('SELECT id FROM Liga WHERE slug = ?').get('luva-2026')
const ligaId = liga.id
console.log(`✓ Liga criada: LUVA 2026 (id=${ligaId})`)

// ─── Equipes ─────────────────────────────────────────────────────────────────
const nomesEquipes = [
  'Vôlei Ipiranga', 'Rede Quente', 'Bloco Forte', 'Ace Esportes',
  'Set Point', 'Líbero FC', 'Ataque Final', 'Spike United',
]
const coresEquipes = ['#1a3c6e','#8b0000','#006400','#4b0082','#8b4513','#2f4f4f','#800000','#191970']

const insEquipe = db.prepare(`INSERT OR IGNORE INTO Equipe (nome, ligaId, categoria, serie, corHex) VALUES (?, ?, ?, ?, ?)`)
for (let i = 0; i < nomesEquipes.length; i++) {
  insEquipe.run(nomesEquipes[i], ligaId, 'MASCULINO', 'OURO', coresEquipes[i])
}
const equipes = db.prepare('SELECT * FROM Equipe WHERE ligaId = ? AND categoria = ? AND serie = ? ORDER BY id').all(ligaId, 'MASCULINO', 'OURO')
console.log(`✓ ${equipes.length} equipes criadas`)

// ─── Jogadores ────────────────────────────────────────────────────────────────
const posicoes = ['Levantador', 'Oposto', 'Ponteiro', 'Ponteiro', 'Central', 'Libero']
const insJogador = db.prepare('INSERT OR IGNORE INTO Jogador (nome, equipeId, posicao, numero) VALUES (?, ?, ?, ?)')
for (const equipe of equipes) {
  for (let j = 0; j < 6; j++) {
    insJogador.run(`Jogador ${j+1} — ${equipe.nome.split(' ')[0]}`, equipe.id, posicoes[j], j + 1)
  }
}
console.log('✓ Jogadores criados (6 por equipe)')

// ─── Partidas encerradas ─────────────────────────────────────────────────────
const confrontos = [
  [0,1, [[25,18],[25,22]],          2,0],
  [0,2, [[25,20],[23,25],[15,12]],  2,1],
  [1,2, [[25,15],[25,18]],          2,0],
  [0,3, [[25,22],[22,25],[15,13]],  2,1],
  [1,3, [[25,19],[25,17]],          2,0],
  [2,3, [[25,21],[21,25],[15,10]],  2,1],
  [0,4, [[25,23],[25,20]],          2,0],
  [1,4, [[22,25],[25,23],[13,15]],  1,2],
  [2,4, [[25,18],[25,22]],          2,0],
  [3,4, [[25,20],[25,19]],          2,0],
]

const insPartida = db.prepare(`INSERT OR IGNORE INTO Partida
  (id, ligaId, equipeAId, equipeBId, categoria, serie, rodada, status, dataHora, localNome, setsPorA, setsPorB, pontosPorA, pontosPorB, vencedorId)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)

const insSet = db.prepare('INSERT OR IGNORE INTO SetPartida (partidaId, numero, pontosA, pontosB) VALUES (?, ?, ?, ?)')

const locais = ['Ginásio Municipal', 'Arena Esportiva', 'Centro Comunitário']

for (let i = 0; i < confrontos.length; i++) {
  const [iA, iB, sets, sA, sB] = confrontos[i]
  const eA = equipes[iA], eB = equipes[iB]
  const ppA = sets.reduce((s, [a]) => s + a, 0)
  const ppB = sets.reduce((s, [,b]) => s + b, 0)
  const vencedorId = sA > sB ? eA.id : eB.id
  const rodada = Math.floor(i / 2) + 1
  const mes = 4 + Math.floor(i / 4)
  const dia = 10 + i
  const dataHora = `2026-0${mes}-${dia < 10 ? '0'+dia : dia}T17:00:00.000Z`

  insPartida.run(i+1, ligaId, eA.id, eB.id, 'MASCULINO', 'OURO', rodada, 'ENCERRADA', dataHora, locais[i%3], sA, sB, ppA, ppB, vencedorId)
  for (let s = 0; s < sets.length; s++) {
    insSet.run(i+1, s+1, sets[s][0], sets[s][1])
  }
}
console.log('✓ 10 partidas encerradas criadas')

// ─── Partidas agendadas ───────────────────────────────────────────────────────
const agendadas = [[4,5,6],[5,6,7],[6,7,8]]
for (let i = 0; i < agendadas.length; i++) {
  const [rod, iA, iB] = agendadas[i]
  const eA = equipes[iA-1], eB = equipes[iB-1]
  const token = `token-demo-${i+1}-setup`
  const expira = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  const dataHora = `2026-08-${15+i}T17:00:00.000Z`
  db.prepare(`INSERT OR IGNORE INTO Partida
    (id, ligaId, equipeAId, equipeBId, categoria, serie, rodada, status, dataHora, localNome, sumulaToken, sumulaTokenExpira)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    100+i, ligaId, eA.id, eB.id, 'MASCULINO', 'OURO', rod, 'AGENDADA', dataHora, 'Ginásio Municipal', token, expira
  )
}
console.log('✓ 3 partidas agendadas criadas')

// ─── Premiações ───────────────────────────────────────────────────────────────
const premiacoes = [
  [1, 'Troféu + R$ 500,00 + medalha de ouro'],
  [2, 'Troféu + R$ 250,00 + medalha de prata'],
  [3, 'Troféu + medalha de bronze'],
]
for (const [colocacao, descricao] of premiacoes) {
  const ex = db.prepare('SELECT id FROM Premiacao WHERE ligaId = ? AND categoria = ? AND serie = ? AND colocacao = ?').get(ligaId, 'MASCULINO', 'OURO', colocacao)
  if (!ex) db.prepare('INSERT INTO Premiacao (ligaId, categoria, serie, colocacao, descricao) VALUES (?, ?, ?, ?, ?)').run(ligaId, 'MASCULINO', 'OURO', colocacao, descricao)
}
console.log('✓ Premiações criadas')

// ─── Mensagens de exemplo ────────────────────────────────────────────────────
const msgs = [
  ['João Silva', 'Vôlei Ipiranga vai longe! 🏐', 1],
  ['Maria Santos', 'Que partida incrível ontem! Parabéns a todos!', 1],
  ['Pedro Alves', 'Animado para a próxima rodada. LUVA 2026!', 1],
  ['Ana Costa', 'Vai Rede Quente! Força!', 0],
]
for (const [autor, texto, aprovada] of msgs) {
  const ex = db.prepare('SELECT id FROM Mensagem WHERE ligaId = ? AND autor = ? AND texto = ?').get(ligaId, autor, texto)
  if (!ex) db.prepare('INSERT INTO Mensagem (ligaId, autor, texto, aprovada) VALUES (?, ?, ?, ?)').run(ligaId, autor, texto, aprovada)
}
console.log('✓ Mensagens de exemplo criadas')

// ─── Classificação ────────────────────────────────────────────────────────────
const placar = {}
for (const e of equipes) {
  placar[e.id] = { p:0, j:0, v:0, d:0, sp:0, sc:0, pp:0, pc:0 }
}

const partidasEnc = db.prepare("SELECT * FROM Partida WHERE ligaId = ? AND status = 'ENCERRADA'").all(ligaId)
for (const pt of partidasEnc) {
  const a = placar[pt.equipeAId], b = placar[pt.equipeBId]
  if (!a || !b) continue
  a.j++; b.j++
  a.sp += pt.setsPorA; a.sc += pt.setsPorB
  b.sp += pt.setsPorB; b.sc += pt.setsPorA
  a.pp += pt.pontosPorA; a.pc += pt.pontosPorB
  b.pp += pt.pontosPorB; b.pc += pt.pontosPorA
  if (pt.vencedorId === pt.equipeAId) {
    a.v++; b.d++
    a.p += pt.setsPorB === 0 ? 3 : 2
    b.p += pt.setsPorA === 2 && pt.setsPorB === 1 ? 1 : 0
  } else {
    b.v++; a.d++
    b.p += pt.setsPorA === 0 ? 3 : 2
    a.p += pt.setsPorB === 2 && pt.setsPorA === 1 ? 1 : 0
  }
}

const ordenadas = Object.entries(placar)
  .map(([id, s]) => ({ equipeId: Number(id), ...s }))
  .sort((a, b) => b.p - a.p || b.v - a.v || (b.sp - b.sc) - (a.sp - a.sc))

for (let pos = 0; pos < ordenadas.length; pos++) {
  const e = ordenadas[pos]
  const ex = db.prepare('SELECT id FROM ClassificacaoEntrada WHERE equipeId = ?').get(e.equipeId)
  if (ex) {
    db.prepare(`UPDATE ClassificacaoEntrada SET posicao=?,pontos=?,jogos=?,vitorias=?,derrotas=?,setsPro=?,setsContra=?,pontosPro=?,pontosContra=?,atualizadoEm=datetime('now') WHERE equipeId=?`)
      .run(pos+1, e.p, e.j, e.v, e.d, e.sp, e.sc, e.pp, e.pc, e.equipeId)
  } else {
    db.prepare(`INSERT INTO ClassificacaoEntrada (equipeId, categoria, serie, posicao, pontos, jogos, vitorias, derrotas, setsPro, setsContra, pontosPro, pontosContra)
      VALUES (?, 'MASCULINO', 'OURO', ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(e.equipeId, pos+1, e.p, e.j, e.v, e.d, e.sp, e.sc, e.pp, e.pc)
  }
}
console.log('✓ Classificação calculada')

// ─── Registro de migration (para Prisma reconhecer) ──────────────────────────
db.prepare(`INSERT OR IGNORE INTO _prisma_migrations (id, checksum, migration_name, finished_at, applied_steps_count)
  VALUES ('setup-manual', 'manual', '0_init', datetime('now'), 1)`).run()

db.close()
console.log('\n🏐 Banco de dados pronto!')
console.log('   Admin: admin@luv.com.br / LuvAdmin@2026')
console.log('   Banco: prisma/dev.db\n')
