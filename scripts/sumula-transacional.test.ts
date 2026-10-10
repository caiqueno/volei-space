/** Postgres local apenas. Não abre Supabase de produção. */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { migration, sql } from './category-test-database'

const owner = `sumula-tx-${randomUUID()}`
const url = process.env.DATABASE_URL!.trim()

function coluna(tabela: string, nome: string) {
  return sql(`select count(*) from information_schema.columns where table_schema='public' and table_name='${tabela}' and column_name='${nome}';`).trim()
}

function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function travaDaLiga(liga: number) {
  const fim = Date.now() + 3000
  while (Date.now() < fim) {
    const n = Number(sql(`select count(*) from pg_locks where locktype='advisory' and granted and objsubid=1 and classid=0 and objid=${liga};`).trim())
    if (n >= 1) return true
    await esperar(40)
  }
  return false
}

async function main() {
migration('20261010137000_sumula_transacional.sql')

assert.equal(coluna('Liga', 'terceiroSetObrigatorio'), '0', 'Liga não tem terceiroSetObrigatorio')
assert.equal(coluna('CategoriaConfiguracao', 'terceiroSetObrigatorio'), '1')
const defaults = sql(`select table_name || '=' || column_default from information_schema.columns where table_schema='public' and column_name='tieBreakUltimoSet' and table_name in ('Liga','CategoriaConfiguracao') order by table_name;`).trim().split(/\r?\n/)
assert.ok(defaults.some((linha) => linha.startsWith('CategoriaConfiguracao=') && /true/.test(linha)), defaults.join(' | '))
assert.ok(defaults.some((linha) => linha.startsWith('Liga=') && /false/.test(linha)), defaults.join(' | '))

const liga = Number(sql(`insert into "Liga"(slug,nome,"organizadorId","atualizadoEm","setsPorPartida","pontosPorSet","tieBreakUltimoSet") values('${owner}','Súmula transacional','${owner}',now(),5,25,false) returning id;`).trim().split(/\r?\n/)[0])
assert.ok(Number.isSafeInteger(liga))

const categoriaId = sql(`select id::text from selecionar_categorias_campeonato(${liga}, '[{"codigo":"MISTO"}]'::jsonb, '${owner}');`).trim().split(/\r?\n/)[0]
assert.match(categoriaId, /^[0-9a-f-]{36}$/i)

sql(`update "CategoriaConfiguracao" set "setsPorPartida"=3, "pontosPorSet"=21, "tieBreakUltimoSet"=true, "pontosUltimoSet"=15, "terceiroSetObrigatorio"=true, "setsFormato"='MELHOR_DE' where "categoriaCampeonatoId"='${categoriaId}' and "ligaId"=${liga};`)

let partida = 0
let holder: ReturnType<typeof spawn> | null = null

try {
  const equipeA = Number(sql(`insert into "Equipe"(nome,"ligaId","categoriaCampeonatoId","statusEquipe") values('Time A',${liga},'${categoriaId}','ATIVA') returning id;`).trim().split(/\r?\n/)[0])
  const equipeB = Number(sql(`insert into "Equipe"(nome,"ligaId","categoriaCampeonatoId","statusEquipe") values('Time B',${liga},'${categoriaId}','ATIVA') returning id;`).trim().split(/\r?\n/)[0])
  const jogador = Number(sql(`insert into "Jogador"(nome,"equipeId",numero) values('Atleta A',${equipeA},7) returning id;`).trim().split(/\r?\n/)[0])
  partida = Number(sql(`insert into "Partida"("ligaId","equipeAId","equipeBId",categoria,serie,"categoriaCampeonatoId",rodada,status,"sumulaToken","atualizadoEm") values(${liga},${equipeA},${equipeB},'MISTO',null,'${categoriaId}',1,'AGENDADA','${owner}',now()) returning id;`).trim().split(/\r?\n/)[0])

  sql(`insert into "SetPartida"("partidaId",numero,"pontosA","pontosB") values(${partida},1,1,0);
    insert into "OcorrenciaPartida"("partidaId",tipo,descricao) values(${partida},'OBSERVACAO','Registro de placar antigo');
    insert into "OcorrenciaPartida"("partidaId",tipo,descricao) values(${partida},'anotacao','evento que sai');`)

  const registro = 'Registro de placar pelo árbitro 4 em 2026-10-10T12:00:00.000Z: 1:21-19, 2:21-17, 3:15-10'
  const payload = {
    sets: [{ numero: 1, pontosA: 21, pontosB: 19 }, { numero: 2, pontosA: 21, pontosB: 17 }, { numero: 3, pontosA: 15, pontosB: 10 }],
    presencas: [{ jogadorId: jogador, equipeId: equipeA, presente: true, numero: 9 }],
    ocorrencias: [{ tipo: 'anotacao', descricao: 'Escalação conferida.', set: 1, jogadorId: jogador }],
    destaques: [{ jogadorId: jogador, tipo: 'MVP' }],
    partida: {
      status: 'ENCERRADA',
      setsPorA: 3,
      setsPorB: 0,
      pontosPorA: 57,
      pontosPorB: 46,
      vencedorId: equipeA,
      sumulaSubmetidaEm: '2026-10-10T12:00:00.000Z',
      sumulaAprovadaEm: '2026-10-10T12:00:00.000Z',
    },
  }
  const json = (valor: unknown) => JSON.stringify(valor).replace(/'/g, "''")
  sql(`select public.gravar_sumula_partida(${partida}, '${json(payload.sets)}'::jsonb, '${json(payload.presencas)}'::jsonb, '${json(payload.ocorrencias)}'::jsonb, '${json(payload.destaques)}'::jsonb, '${json(payload.partida)}'::jsonb, '${registro.replace(/'/g, "''")}');`)

  const sets = sql(`select numero || ':' || "pontosA" || '-' || "pontosB" from "SetPartida" where "partidaId"=${partida} order by numero;`).trim().split(/\r?\n/)
  assert.deepEqual(sets, ['1:21-19', '2:21-17', '3:15-10'])
  const placar = sql(`select status || '|' || "setsPorA" || '-' || "setsPorB" || '|' || "vencedorId" from "Partida" where id=${partida};`).trim()
  assert.equal(placar, `ENCERRADA|3-0|${equipeA}`)
  const presenca = sql(`select presente::text || '|' || numero from "SumulaPresenca" where "partidaId"=${partida};`).trim()
  assert.equal(presenca, 'true|9')
  const ocorrencias = sql(`select descricao from "OcorrenciaPartida" where "partidaId"=${partida} order by id;`).trim().split(/\r?\n/)
  assert.deepEqual(ocorrencias, ['Registro de placar antigo', 'Escalação conferida.', registro])
  assert.equal(sql(`select count(*) from "DestaquesPartida" where "partidaId"=${partida} and tipo='MVP' and "jogadorId"=${jogador};`).trim(), '1')

  let falhou = false
  try {
    sql(`select public.gravar_sumula_partida(${partida}, '[{"numero":9,"pontosA":1,"pontosB":0}]'::jsonb, '[{"jogadorId":-1,"equipeId":${equipeA},"presente":true}]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{"status":"EM_ANDAMENTO","setsPorA":0,"setsPorB":0,"pontosPorA":1,"pontosPorB":0}'::jsonb, 'Registro de placar que não pode ficar');`)
  } catch {
    falhou = true
  }
  assert.equal(falhou, true, 'jogador inexistente precisa abortar a gravação')
  assert.deepEqual(
    sql(`select numero || ':' || "pontosA" || '-' || "pontosB" from "SetPartida" where "partidaId"=${partida} order by numero;`).trim().split(/\r?\n/),
    ['1:21-19', '2:21-17', '3:15-10'],
    'a falha no meio não pode trocar os sets já gravados',
  )
  assert.equal(sql(`select status from "Partida" where id=${partida};`).trim(), 'ENCERRADA')
  assert.equal(sql(`select count(*) from "OcorrenciaPartida" where "partidaId"=${partida} and descricao like 'Registro de placar que não pode%';`).trim(), '0')

  sql(`select public.gravar_classificacao_calculada(${liga}, '[{"equipeId":${equipeA},"categoriaCampeonatoId":"${categoriaId}","categoria":"Misto","posicao":1,"pontos":3,"jogos":1,"vitorias":1,"derrotas":0,"setsPro":3,"setsContra":0,"pontosPro":57,"pontosContra":46,"punicoes":0},{"equipeId":${equipeB},"categoriaCampeonatoId":"${categoriaId}","categoria":"Misto","posicao":2,"pontos":0,"jogos":1,"vitorias":0,"derrotas":1,"setsPro":0,"setsContra":3,"pontosPro":46,"pontosContra":57,"punicoes":2}]'::jsonb);`)
  const tabela = sql(`select "equipeId" || ':' || pontos || ':' || vitorias || ':' || punicoes from "ClassificacaoEntrada" where "ligaId"=${liga} order by "equipeId";`).trim().split(/\r?\n/)
  assert.deepEqual(tabela, [`${equipeA}:3:1:0`, `${equipeB}:0:1:2`])

  holder = spawn('psql', [url, '-v', 'ON_ERROR_STOP=1'], { stdio: ['pipe', 'pipe', 'pipe'] })
  if (!holder.stdin) throw new Error('Não foi possível abrir a sessão que segura a trava.')
  holder.stdin.write(`begin; select pg_advisory_xact_lock(${liga}); select pg_sleep(8); commit;\n`)
  holder.stdin.end()
  assert.equal(await travaDaLiga(liga), true, 'a trava da liga precisa aparecer antes do segundo escritor')
  let bloqueou = false
  try {
    sql(`set statement_timeout = '400ms'; select public.gravar_classificacao_calculada(${liga}, '[{"equipeId":${equipeA},"categoriaCampeonatoId":"${categoriaId}","categoria":"Misto","posicao":1,"pontos":9,"jogos":1,"vitorias":1,"derrotas":0,"setsPro":1,"setsContra":0,"pontosPro":1,"pontosContra":0}]'::jsonb);`)
  } catch (erro) {
    const texto = erro instanceof Error ? erro.message : String(erro)
    bloqueou = /lock|timeout|cancel/i.test(texto)
    if (!bloqueou) throw erro
  }
  assert.equal(bloqueou, true, 'a classificação espera a mesma trava da liga')
  assert.equal(sql(`select pontos from "ClassificacaoEntrada" where "ligaId"=${liga} and "equipeId"=${equipeA};`).trim(), '3')
  console.log('sumula transacional ok')
} finally {
  holder?.kill()
  if (partida) {
    sql(`delete from "DestaquesPartida" where "partidaId"=${partida};
      delete from "OcorrenciaPartida" where "partidaId"=${partida};
      delete from "SumulaPresenca" where "partidaId"=${partida};
      delete from "SetPartida" where "partidaId"=${partida};
      delete from "Partida" where id=${partida};`)
  }
  sql(`delete from "ClassificacaoEntrada" where "ligaId"=${liga};
    delete from "Jogador" where "equipeId" in (select id from "Equipe" where "ligaId"=${liga});
    delete from "Equipe" where "ligaId"=${liga};
    delete from "CategoriaSetupSecao" where "ligaId"=${liga};
    delete from "CategoriaConfiguracao" where "ligaId"=${liga};
    delete from "CategoriaCampeonato" where "ligaId"=${liga};
    delete from "Liga" where id=${liga};`)
}
}

main().catch((erro) => {
  console.error(erro)
  process.exit(1)
})
