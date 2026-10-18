import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { instalarSupabaseFalso } from './helpers/fake-supabase'

const banco = instalarSupabaseFalso(require.resolve('../src/lib/supabase-admin'))

type Linha = Record<string, any>
let ligas: Linha[] = []
let partidas: Linha[] = []

function construtor(nome: string) {
  const filtros: Array<(l: Linha) => boolean> = []
  const b: any = {}
  const encadeia = () => b
  b.select = encadeia
  b.order = encadeia
  b.limit = encadeia
  b.range = encadeia
  b.eq = (c: string, v: unknown) => { filtros.push((l) => l[c] === v); return b }
  b.not = (c: string, _op: string, lista: string) => {
    const ids = lista.replace(/[()]/g, '').split(',').map(Number)
    filtros.push((l) => !ids.includes(Number(l[c])))
    return b
  }
  const executar = () => {
    const base = nome === 'Liga' ? ligas : nome === 'Partida' ? partidas.map((p) => ({ ...p, liga: ligas.find((x) => x.id === p.ligaId) ?? null })) : []
    return { data: base.filter((l) => filtros.every((f) => f(l))), error: null }
  }
  b.maybeSingle = () => Promise.resolve({ data: (executar().data as Linha[])[0] ?? null, error: null })
  b.then = (res: any, rej: any) => Promise.resolve(executar()).then(res, rej)
  return b
}

let ipSeq = 1
const get = async (rota: any, consulta = '') =>
  rota.GET(new NextRequest(`http://127.0.0.1:3001/api/ao-vivo${consulta}`, { headers: { 'x-forwarded-for': `10.2.0.${ipSeq++}` } }))

async function main() {
  banco.atual = { from: construtor } as any
  const rota = await import('../src/app/api/ao-vivo/route')
  const { reiniciarCotas } = await import('../src/lib/rate-limit')
  const { limparCacheCompeticoesPrivadas } = await import('../src/lib/visibilidade-competicao')
  limparCacheCompeticoesPrivadas()

  const partida = (id: number, ligaId: number) => ({ id, ligaId, status: 'EM_ANDAMENTO', rodada: 1, equipeA: { id: 1, nome: 'A' }, equipeB: { id: 2, nome: 'B' }, setsPorA: 0, setsPorB: 0, pontosPorA: 0, pontosPorB: 0 })
  ligas = [
    { id: 1, nome: 'Publica', slug: 'publica', status: 'ATIVA', simulacao: false, visibilidade: 'PUBLICA' },
    { id: 2, nome: 'Privada', slug: 'privada', status: 'ATIVA', simulacao: false, visibilidade: 'PRIVADA' },
    { id: 3, nome: 'Rascunho', slug: 'rascunho', status: 'RASCUNHO', simulacao: false, visibilidade: 'PUBLICA' },
  ]
  partidas = [partida(10, 1), partida(20, 2), partida(30, 3)]

  // Flag desligada: 404
  delete process.env.AO_VIVO_ATIVO
  assert.equal((await get(rota)).status, 404)
  process.env.AO_VIVO_ATIVO = '1'

  const ids = async (consulta: string) => (((await (await get(rota, consulta)).json()) as any).data.partidas as Array<{ id: number }>).map((p) => p.id)
  // Com ligaId: privada e rascunho viram lista vazia; publicada lista normalmente
  assert.deepEqual(await ids('?ligaId=2'), [], 'privada por ligaId')
  assert.deepEqual(await ids('?ligaId=3'), [], 'rascunho por ligaId')
  assert.deepEqual(await ids('?ligaId=999'), [], 'inexistente por ligaId')
  assert.deepEqual(await ids('?ligaId=1'), [10])
  // Sem ligaId: nunca privada nem rascunho
  assert.ok(!(await ids('')).includes(20))
  assert.ok(!(await ids('')).includes(30))

  // Mesmo limite por IP do detalhe
  reiniciarCotas()
  const req = () => rota.GET(new NextRequest('http://127.0.0.1:3001/api/ao-vivo', { headers: { 'x-forwarded-for': '10.3.3.3' } }))
  for (let i = 0; i < 120; i += 1) assert.equal((await req()).status, 200)
  const limitado = await req()
  assert.equal(limitado.status, 429)
  assert.equal(limitado.headers.get('cache-control'), 'no-store')

  console.log('ao-vivo-lista.test.ts: ok.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
