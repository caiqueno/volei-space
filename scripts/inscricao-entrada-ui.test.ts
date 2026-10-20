import assert from 'node:assert/strict'
import { criarClienteCampeonatos } from '../src/components/meu-time-campeonatos/cliente'
import {
  conviteParaCategoria,
  destinoCapitao,
  destinoPosLogin,
  estadoDaPorta,
  guardarEntrada,
  hrefCadastro,
  hrefContinuacao,
  hrefLogin,
  inscricaoViaMeuTimeAtiva,
  lerEntradaDaUrl,
  lerEntradaGuardada,
  limparEntradaGuardada,
  mesclarOfertas,
  montarReturnTo,
  normalizarEntrada,
  ofertasDaEntrada,
  proximosPassos,
  returnToSeguro,
  textoPeriodo,
} from '../src/lib/inscricao-entrada-ui/regras'

// flag
assert.equal(inscricaoViaMeuTimeAtiva('1'), true)
assert.equal(inscricaoViaMeuTimeAtiva('0'), false)
assert.equal(inscricaoViaMeuTimeAtiva(undefined), false)

// returnTo
assert.equal(montarReturnTo('tok123', 'c9'), '/meu-time/campeonatos?categoria=c9&entrada=tok123')
assert.equal(montarReturnTo('tok123'), '/meu-time/campeonatos?entrada=tok123')
assert.equal(hrefContinuacao('t', 'c1'), '/meu-time/campeonatos?categoria=c1&entrada=t')
assert.equal(hrefLogin('/meu-time/campeonatos?entrada=t'), '/login?modo=membro&returnTo=%2Fmeu-time%2Fcampeonatos%3Fentrada%3Dt')
assert.ok(hrefCadastro('/meu-time/novo').startsWith('/cadastro?perfil=equipe&returnTo='))
assert.equal(returnToSeguro('/meu-time/campeonatos?entrada=t'), '/meu-time/campeonatos?entrada=t')
assert.equal(returnToSeguro('/inscricao/categoria/abc'), '/inscricao/categoria/abc')
for (const ruim of ['https://evil.com', '//evil.com', '/\\evil.com', '/admin', '/meu-timex', '', null, undefined, '/meu-time/%2F%2Fx\\', 'javascript:alert(1)', '%2F%2Fevil.com']) {
  assert.equal(returnToSeguro(ruim as string | null | undefined), null, String(ruim))
}
assert.equal(returnToSeguro('%E0%A4%A'), null)

// destino pós-login
assert.equal(destinoPosLogin(true, '/meu-time/campeonatos?entrada=t', '/capitao'), '/meu-time/campeonatos?entrada=t')
assert.equal(destinoPosLogin(true, 'https://evil.com', '/capitao'), '/capitao')
assert.equal(destinoPosLogin(false, '/meu-time/campeonatos?entrada=t', '/capitao'), '/capitao')

// leitura da URL
const p = new URLSearchParams('categoria=c9&entrada=tok-123_x')
assert.deepEqual(lerEntradaDaUrl((k) => p.get(k)), { categoria: 'c9', entrada: 'tok-123_x' })
assert.deepEqual(lerEntradaDaUrl(() => null), { categoria: undefined, entrada: undefined })
assert.deepEqual(lerEntradaDaUrl((k) => (k === 'entrada' ? '<script>' : ' c1 ')), { categoria: 'c1', entrada: undefined })
assert.equal(lerEntradaDaUrl((k) => (k === 'entrada' ? 'a'.repeat(201) : null)).entrada, undefined)

// sessionStorage (com e sem armazenamento)
const mem = new Map<string, string>()
const armazem = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) }
guardarEntrada({ entrada: 'tok', categoria: 'c1' }, armazem)
assert.deepEqual(lerEntradaGuardada(armazem), { entrada: 'tok', categoria: 'c1' })
limparEntradaGuardada(armazem)
assert.deepEqual(lerEntradaGuardada(armazem), {})
guardarEntrada({ categoria: 'c1' }, armazem)
assert.equal(mem.size, 0)
const quebrado = { getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') }, removeItem: () => { throw new Error('x') } }
guardarEntrada({ entrada: 'tok' }, quebrado)
assert.deepEqual(lerEntradaGuardada(quebrado), {})
limparEntradaGuardada(quebrado)
assert.deepEqual(lerEntradaGuardada(null), {})

// normalização e estados da porta
const bruto = {
  tipo: 'CAMPEONATO',
  campeonato: 'Copa Teste',
  ligaId: 7,
  privada: true,
  conviteTokenParaApi: 'conv',
  categorias: [
    { categoriaId: 'c1', nome: 'Adulto', naipe: 'FEMININO', modoInscricao: 'AUTOMATICA', periodo: { abre: '2026-01-01T00:00:00Z', fecha: '2026-12-31T00:00:00Z' }, situacao: 'ABERTA' },
    { categoriaId: 'c2', nome: 'Sub-17', modoInscricao: 'qualquer', periodo: {}, situacao: 'ENCERRADA' },
    { categoriaId: '', nome: 'sem id' },
    null,
  ],
}
const entrada = normalizarEntrada(bruto)!
assert.equal(entrada.categorias.length, 2)
assert.equal(entrada.categorias[0].modo, 'AUTOMATICA')
assert.equal(entrada.categorias[1].modo, 'APROVACAO')
assert.equal(entrada.privada, true)
assert.equal(normalizarEntrada(null), null)
assert.equal(normalizarEntrada({ tipo: 'X', campeonato: 'a' }), null)

assert.equal(estadoDaPorta(false, { status: 200, entrada }).estado, 'desligada')
assert.equal(estadoDaPorta(true, null).estado, 'carregando')
assert.equal(estadoDaPorta(true, { status: 404, entrada: null }).estado, 'invalido')
assert.equal(estadoDaPorta(true, { status: 410, entrada: null }).estado, 'invalido')
assert.equal(estadoDaPorta(true, { status: 500, entrada: null }).estado, 'indisponivel')
assert.equal(estadoDaPorta(true, { status: 200, entrada: null }).estado, 'indisponivel')
const aberta = estadoDaPorta(true, { status: 200, entrada })
assert.equal(aberta.estado, 'aberta')
assert.equal(aberta.estado === 'aberta' && aberta.abertas.length, 1)
const soFechada = { ...entrada, categorias: [{ ...entrada.categorias[0], situacao: 'FECHADA' as const }] }
assert.equal(estadoDaPorta(true, { status: 200, entrada: soFechada }).estado, 'ainda-nao')
const soEncerrada = { ...entrada, categorias: [entrada.categorias[1]] }
assert.equal(estadoDaPorta(true, { status: 200, entrada: soEncerrada }).estado, 'encerrada')

assert.equal(textoPeriodo({ abre: 'a', fecha: 'b' }, (x) => x.toUpperCase()), 'De A até B')
assert.equal(textoPeriodo({ abre: null, fecha: 'b' }, (x) => x), 'Até b')
assert.equal(textoPeriodo({ abre: null, fecha: null }), 'Sem prazo definido')

// ofertas do convite
const daEntrada = ofertasDaEntrada(entrada)
assert.equal(daEntrada[0].situacao, 'DISPONIVEL')
assert.equal(daEntrada[1].situacao, 'ENCERRADA')
assert.equal(ofertasDaEntrada(entrada, 'c1').length, 1)
const doServidor = [{ ...daEntrada[0], situacao: 'INSCRITA' as const }, { ...daEntrada[0], categoriaId: 'zz', categoria: 'Outra' }]
const mesclado = mesclarOfertas(doServidor, ofertasDaEntrada(entrada, 'c1'))
assert.equal(mesclado.length, 2)
assert.equal(mesclado[0].situacao, 'INSCRITA')
assert.equal(mesclarOfertas(doServidor, []), doServidor)
assert.equal(mesclarOfertas([], ofertasDaEntrada(entrada, 'c1')).length, 1)

// convite no POST
assert.equal(conviteParaCategoria(entrada, 'tok', 'c1'), 'conv')
assert.equal(conviteParaCategoria({ ...entrada, conviteTokenParaApi: undefined }, 'tok', 'c1'), 'tok')
assert.equal(conviteParaCategoria(entrada, 'tok', 'outra'), undefined)
assert.equal(conviteParaCategoria(null, 'tok', 'c1'), undefined)
assert.equal(conviteParaCategoria(entrada, undefined, 'c1'), undefined)

// próximos passos e /capitao
assert.equal(proximosPassos('e 1')[0].href, '/meu-time/e%201')
assert.equal(destinoCapitao(true), '/meu-time?de=capitao')
assert.ok(destinoCapitao(false).startsWith('/login?modo=membro&de=capitao'))

// cliente: POST leva `convite` só quando houver
async function clienteConvite() {
  const corpos: unknown[] = []
  const fake = (async (_url: unknown, init?: RequestInit) => {
    corpos.push(init?.body ? JSON.parse(String(init.body)) : null)
    return new Response(JSON.stringify({ data: { estado: 'INSCRITA', id: 1 } }), { status: 200 })
  }) as typeof fetch
  const c = criarClienteCampeonatos(fake)
  await c.solicitar('e1', 'c1', undefined, undefined, 'conv')
  await c.solicitar('e1', 'c1')
  assert.deepEqual(corpos[0], { equipeId: 'e1', categoriaId: 'c1', convite: 'conv' })
  assert.deepEqual(corpos[1], { equipeId: 'e1', categoriaId: 'c1' })
}
void clienteConvite().then(() => console.log('inscricao-entrada-ui cliente: ok'))

console.log('inscricao-entrada-ui: ok')
