#!/usr/bin/env node
/**
 * Aplica o histórico do Prisma Migrate usando DIRECT_URL.
 *
 * O runtime do volei.space fala com o Postgres pela API do Supabase, não pelo
 * Prisma Client. DATABASE_URL é a conexão pooled (porta 6543, pgbouncer=true)
 * e não serve para migration. DIRECT_URL é a conexão direta ou o pooler de
 * sessão (porta 5432, sem pgbouncer=true): é ela que o `prisma migrate deploy`
 * usa, porque o schema declara directUrl.
 *
 * Este repositório não tem prisma/migrations. O SQL aplicado nos projetos
 * Supabase está em supabase/migrations e não é um ledger do Prisma. O script
 * não reexecuta essa pasta: vários arquivos já estão em produção e não são
 * idempotentes. Não existe `db push` aqui de propósito.
 *
 * Quando prisma/migrations passar a existir, um host que não seja loopback
 * só recebe `prisma migrate deploy` com VOLEI_MIGRATE_CONFIRM=aplicar.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const raiz = process.cwd()

function falhar(mensagem) {
  console.error(mensagem)
  process.exit(1)
}

function lerUrl(nome) {
  const valor = process.env[nome]?.trim()
  if (!valor) return null
  let url
  try {
    url = new URL(valor)
  } catch {
    falhar(`${nome} não é uma URL válida. Não cole a senha no log; corrija o valor no ambiente.`)
  }
  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    falhar(`${nome} precisa usar o protocolo postgresql:.`)
  }
  const porta = url.port || '5432'
  const pgbouncer = (url.searchParams.get('pgbouncer') || '').toLowerCase() === 'true'
  return {
    nome,
    porta,
    pgbouncer,
    transacao: porta === '6543' || pgbouncer,
    host: url.hostname,
    loopback: url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1',
  }
}

function descrever(info) {
  return `${info.nome} host=${info.host} porta=${info.porta} pgbouncer=${info.pgbouncer ? 'true' : 'false'}`
}

const direta = lerUrl('DIRECT_URL')
const pooled = lerUrl('DATABASE_URL')

if (!direta) {
  falhar(
    'DIRECT_URL ausente. Migrations usam a conexão direta ou o pooler de sessão do Supabase (porta 5432), nunca DATABASE_URL.',
  )
}
if (!pooled) {
  falhar('DATABASE_URL ausente. O schema Prisma exige as duas variáveis, mesmo quando a migration usa só DIRECT_URL.')
}

console.log(descrever(direta))
console.log(descrever(pooled))

if (direta.transacao) {
  falhar(
    'DIRECT_URL aponta para o pooler de transação (porta 6543 ou pgbouncer=true). `prisma migrate deploy` não deve usar essa URL. Troque por porta 5432, sem pgbouncer=true.',
  )
}

if (!pooled.transacao) {
  console.warn(
    'Aviso: DATABASE_URL não está no pooler de transação (porta 6543 e pgbouncer=true, com connection_limit=1). O app atual não abre Prisma Client na Vercel; se passar a abrir, essa URL esgota conexões.',
  )
}

const pasta = path.join(raiz, 'prisma', 'migrations')
const historico = fs.existsSync(pasta)
  ? fs.readdirSync(pasta).filter((entrada) => {
      const migration = path.join(pasta, entrada, 'migration.sql')
      return fs.existsSync(migration)
    })
  : []

if (historico.length === 0) {
  console.log(
    'Nenhuma migration em prisma/migrations. Nada a aplicar com Prisma Migrate. Não rode `prisma db push` em produção. O SQL histórico fica em supabase/migrations e só entra no banco de produção depois de conferir o que já foi aplicado, pela DIRECT_URL, um arquivo por vez.',
  )
  process.exit(0)
}

if (!direta.loopback && process.env.VOLEI_MIGRATE_CONFIRM !== 'aplicar') {
  falhar(
    'Há migrations Prisma e DIRECT_URL não é loopback. Defina VOLEI_MIGRATE_CONFIRM=aplicar depois do backup do projeto Supabase de produção.',
  )
}

const resultado = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  cwd: raiz,
  stdio: 'inherit',
  env: process.env,
})

process.exit(resultado.status ?? 1)
