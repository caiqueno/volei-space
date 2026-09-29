/** Domain test for the revised selecionar_categorias_campeonato RPC:
 * custom categories, stable UUID identity, soft-remove on deselect
 * (never deletes without operational data), normalized uniqueness,
 * size/count limits. Local Docker test database only. */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { sql } from './category-test-database'

const owner = `category-selection-${randomUUID()}`

function rpc(ligaId: number, categorias: unknown): { ok: true; rows: any[] } | { ok: false; error: string } {
  const payload = JSON.stringify(categorias).replace(/'/g, "''")
  try {
    const out = sql(`select json_agg(row_to_json(t)) from selecionar_categorias_campeonato(${ligaId}, '${payload}'::jsonb, '${owner}') t;`)
    return { ok: true, rows: JSON.parse(out.trim() || '[]') ?? [] }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const match = message.match(/ERROR:\s+([^\n]+)/)
    return { ok: false, error: match ? match[1] : message }
  }
}

function main() {
  const liga = Number(sql(`insert into "Liga"(slug,nome,"organizadorId","atualizadoEm") values('${owner}','Category selection test','${owner}',now()) returning id;`).trim().split(/\r?\n/)[0])
  assert.ok(Number.isSafeInteger(liga))

  try {
    // 1) Catálogo fixo continua funcionando como antes.
    const catalog = rpc(liga, [{ codigo: 'FEMININO' }, { codigo: 'MISTO' }])
    assert.ok(catalog.ok, JSON.stringify(catalog))
    if (!catalog.ok) throw new Error('unreachable')
    assert.equal(catalog.rows.length, 2)
    const feminino = catalog.rows.find((r) => r.codigo === 'FEMININO')
    assert.equal(feminino.nome, 'Feminino')

    // 2) Categoria personalizada nova — nome vira código/slug, não "Misto".
    const custom = rpc(liga, [{ codigo: 'FEMININO' }, { nome: 'Sub-30 Livre' }])
    assert.ok(custom.ok, JSON.stringify(custom))
    if (!custom.ok) throw new Error('unreachable')
    const created = custom.rows.find((r) => r.nome === 'Sub-30 Livre')
    assert.ok(created, 'custom category must be created')
    assert.notEqual(created.codigo, 'MISTO', 'custom category must not fall back to Misto')
    assert.match(created.codigo, /^SUB-30/)
    const customId = created.id as string

    // 3) Reenviar referenciando por id preserva a identidade — não duplica,
    // não recria com código diferente.
    const resend = rpc(liga, [{ codigo: 'FEMININO' }, { id: customId }])
    assert.ok(resend.ok, JSON.stringify(resend))
    if (!resend.ok) throw new Error('unreachable')
    assert.equal(resend.rows.filter((r) => r.nome === 'Sub-30 Livre').length, 1)
    assert.equal(resend.rows.find((r) => r.nome === 'Sub-30 Livre').id, customId)

    // 4) Desmarcar sem dado operacional: soft-remove, não apaga a linha.
    const deselect = rpc(liga, [{ codigo: 'FEMININO' }])
    assert.ok(deselect.ok, JSON.stringify(deselect))
    if (!deselect.ok) throw new Error('unreachable')
    assert.equal(deselect.rows.length, 1, 'deselected category must not appear as active')
    const stillThere = sql(`select "removidaEm" is not null as removida, "categoriaCampeonatoId" is not null as tem_config from "CategoriaCampeonato" c left join "CategoriaConfiguracao" cc on cc."categoriaCampeonatoId"=c.id where c.id='${customId}';`).trim()
    assert.match(stillThere, /^t\|t$/, `row and config must survive soft-remove, got: ${stillThere}`)

    // 5) Reselecionar por id restaura — mesma config, mesmo id.
    const reselect = rpc(liga, [{ codigo: 'FEMININO' }, { id: customId }])
    assert.ok(reselect.ok, JSON.stringify(reselect))
    if (!reselect.ok) throw new Error('unreachable')
    assert.equal(reselect.rows.find((r) => r.id === customId)?.nome, 'Sub-30 Livre')

    // 6) Nome duplicado (variando maiúscula/espaço) é rejeitado.
    const dup = rpc(liga, [{ codigo: 'FEMININO' }, { id: customId }, { nome: '  sub-30 LIVRE  ' }])
    assert.equal(dup.ok, false, 'normalized duplicate name must be rejected')

    // 7) Nome fora dos limites de tamanho.
    const tooShort = rpc(liga, [{ nome: 'A' }])
    assert.equal(tooShort.ok, false, 'name shorter than 2 chars must be rejected')
    const tooLong = rpc(liga, [{ nome: 'A'.repeat(41) }])
    assert.equal(tooLong.ok, false, 'name longer than 40 chars must be rejected')

    // 8) Mais que o máximo de categorias.
    const tooMany = rpc(liga, Array.from({ length: 21 }, (_, i) => ({ nome: `Categoria ${i}` })))
    assert.equal(tooMany.ok, false, 'more than 20 categories must be rejected')

    // 9) Desmarcar categoria com dado operacional continua bloqueado.
    const withOps = rpc(liga, [{ nome: 'Com Equipe' }])
    assert.ok(withOps.ok, JSON.stringify(withOps))
    if (!withOps.ok) throw new Error('unreachable')
    const opsId = withOps.rows.find((r) => r.nome === 'Com Equipe')!.id
    sql(`insert into "Equipe"(nome,"ligaId","categoriaCampeonatoId","statusEquipe") values('Equipe fixture',${liga},'${opsId}','ATIVA');`)
    const blockedDeselect = rpc(liga, [{ id: customId }])
    assert.equal(blockedDeselect.ok, false, 'deselecting a category with a team must be blocked')

    console.log('category-selection: OK — personalizada com identidade estável, soft-remove preserva config, unicidade normalizada e limites aplicados')
  } finally {
    sql(`delete from "Equipe" where "ligaId"=${liga};
      delete from "CategoriaSetupSecao" where "ligaId"=${liga};
      delete from "CategoriaConfiguracao" where "ligaId"=${liga};
      delete from "CategoriaCampeonato" where "ligaId"=${liga};
      delete from "Liga" where id=${liga};`)
  }
}

main()
