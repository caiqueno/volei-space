import assert from 'node:assert/strict'
import {
  agruparPorSet,
  desafioAtivo,
  lerRespostaDesafio,
  linkVideoSeguro,
  TEXTO_SISTEMA_VIDEO,
  textoDecisao,
  montarCorpoDesafio,
  normalizarDesafios,
  podeDecidir,
  podeRegistrar,
  saldoDesafios,
  textoEstadoDesafio,
  textoSaldo,
  validarLinkVideo,
  type Desafio,
} from '../src/lib/desafio-ui'

import { botaoDesafio } from '../src/lib/banco-ui/botoes'
import type { PedidoBanco } from '../src/lib/banco-ui/tipos'

let total = 0
async function caso(nome: string, fn: () => void | Promise<void>) {
  total += 1
  try {
    await fn()
  } catch (e) {
    console.error(`FALHOU: ${nome}`)
    throw e
  }
}

const d = (o: Partial<Desafio>): Desafio => ({
  id: 1,
  setNumero: 1,
  equipeId: 10,
  estado: 'SOLICITADO',
  motivo: null,
  linkVideo: null,
  solicitadoEm: '2026-01-01T10:00:00Z',
  decididoEm: null,
  ...o,
})

async function main() {
  await caso('flag', () => {
    assert.equal(desafioAtivo('1'), true)
    assert.equal(desafioAtivo('true'), false)
    assert.equal(desafioAtivo(undefined), false)
  })
  await caso('textos de estado', () => {
    assert.equal(textoEstadoDesafio('EM_ANALISE'), 'Em análise')
    assert.equal(textoEstadoDesafio('XYZ'), 'Estado desconhecido')
  })
  await caso('link', () => {
    assert.deepEqual(validarLinkVideo(''), { ok: true, link: null })
    assert.deepEqual(validarLinkVideo(' https://exemplo.com/v '), { ok: true, link: 'https://exemplo.com/v' })
    assert.equal(validarLinkVideo('javascript:alert(1)').ok, false)
    assert.equal(validarLinkVideo('ftp://x.com').ok, false)
    assert.equal(validarLinkVideo('sem protocolo').ok, false)
    assert.equal(validarLinkVideo('https://a.com/' + 'x'.repeat(600)).ok, false)
  })
  await caso('corpo', () => {
    assert.equal(montarCorpoDesafio({ setNumero: 1, equipeId: null, motivo: '', linkVideo: '' }).ok, false)
    const r = montarCorpoDesafio({ setNumero: 2, equipeId: 5, motivo: ' toque na rede ', linkVideo: '' })
    assert.deepEqual(r, { ok: true, corpo: { setNumero: 2, equipeId: 5, motivo: 'toque na rede' } })
    assert.equal(montarCorpoDesafio({ setNumero: 2, equipeId: 5, motivo: 'a'.repeat(201), linkVideo: '' }).ok, false)
    assert.equal(montarCorpoDesafio({ setNumero: 0, equipeId: 5, motivo: '', linkVideo: '' }).ok, false)
  })
  await caso('saldo', () => {
    const l = [d({ id: 1 }), d({ id: 2, estado: 'CANCELADO' }), d({ id: 3, equipeId: 11 }), d({ id: 4, setNumero: 2 })]
    assert.deepEqual(saldoDesafios(l, 10, 1, 2), { usados: 1, limite: 2, restantes: 1 })
    assert.deepEqual(saldoDesafios(l, 10, 1), { usados: 1, limite: null, restantes: null })
    assert.equal(saldoDesafios(l, 10, 1, 0).restantes, 0)
    assert.equal(textoSaldo({ usados: 1, limite: null, restantes: null }), '1 desafio usado neste set')
    assert.equal(textoSaldo({ usados: 1, limite: 2, restantes: 1 }), '1 de 2 usados neste set (restam 1)')
  })
  await caso('agrupar e decidir', () => {
    const g = agruparPorSet([d({ id: 1, setNumero: 2 }), d({ id: 2, setNumero: 1, solicitadoEm: '2026-01-01T09:00:00Z' }), d({ id: 3, setNumero: 1 })])
    assert.deepEqual(
      g.map((x) => x.setNumero),
      [1, 2],
    )
    assert.deepEqual(
      g[0]!.itens.map((x) => x.id),
      [3, 2],
    )
    assert.equal(podeDecidir(d({}), false), true)
    assert.equal(podeDecidir(d({}), true), false)
    assert.equal(podeDecidir(d({ estado: 'MANTIDA' }), false), false)
    assert.equal(podeRegistrar({ partidaEmAndamento: false, enviando: false }).ok, false)
    assert.equal(podeRegistrar({ partidaEmAndamento: true, enviando: false }).ok, true)
  })
  await caso('envelope', async () => {
    const mk = (status: number, corpo: unknown) => ({ ok: status < 400, status, json: async () => corpo })
    assert.deepEqual(await lerRespostaDesafio(mk(404, {})), { tipo: 'desligado' })
    assert.deepEqual(await lerRespostaDesafio(mk(503, {})), { tipo: 'desligado' })
    assert.deepEqual(await lerRespostaDesafio(mk(200, { data: [1] })), { tipo: 'ok', data: [1] })
    assert.deepEqual(await lerRespostaDesafio(mk(422, { error: 'Limite' })), { tipo: 'erro', mensagem: 'Limite', status: 422 })
  })
  await caso('envelope: 404/503 com codigo do servidor e erro real, sem codigo e desligado', async () => {
    const mk = (status: number, corpo: unknown) => ({ ok: status < 400, status, json: async () => corpo })
    assert.deepEqual(await lerRespostaDesafio(mk(503, { error: 'Recurso ainda não habilitado neste ambiente.', codigo: 'DESAFIO_INDISPONIVEL' })), {
      tipo: 'erro', mensagem: 'Recurso ainda não habilitado neste ambiente.', status: 503, codigo: 'DESAFIO_INDISPONIVEL',
    })
    assert.equal((await lerRespostaDesafio(mk(404, { error: 'Desafio não encontrado.', codigo: 'DESAFIO_NAO_ENCONTRADO' }))).tipo, 'erro')
    assert.deepEqual(await lerRespostaDesafio(mk(404, { error: 'Recurso não encontrado.' })), { tipo: 'desligado' })
  })
  await caso('inconclusiva, link seguro e texto do sistema de vídeo', () => {
    assert.equal(textoDecisao('INCONCLUSIVA').includes('não consome'), true)
    assert.equal(textoEstadoDesafio('INCONCLUSIVA'), 'Inconclusiva (não consome)')
    assert.equal(linkVideoSeguro('https://exemplo.com/v'), 'https://exemplo.com/v')
    assert.equal(linkVideoSeguro('javascript:alert(1)'), null)
    assert.equal(linkVideoSeguro('data:text/html,x'), null)
    assert.equal(linkVideoSeguro(null), null)
    assert.match(TEXTO_SISTEMA_VIDEO, /sistema de vídeo/)
  })
  await caso('normalizar', () => {
    assert.deepEqual(normalizarDesafios(null), [])
    assert.equal(normalizarDesafios([{ id: 1, setNumero: 1, equipeId: 2, estado: 'MANTIDA' }, { lixo: 1 }, null]).length, 1)
  })
  await caso('botao do banco', () => {
    const visao = { partida: { id: 1, equipeA: null, equipeB: null, status: 'EM_ANDAMENTO', placar: null }, pedidos: [] as PedidoBanco[] }
    assert.equal(botaoDesafio({ ativo: false, visao, enviando: false, semConexao: false }).habilitado, false)
    assert.equal(botaoDesafio({ ativo: true, visao, enviando: false, semConexao: false }).habilitado, true)
    assert.equal(botaoDesafio({ ativo: true, visao, enviando: false, semConexao: true }).habilitado, false)
    const pend: PedidoBanco = { id: 1, tipo: 'DESAFIO', estado: 'PENDENTE', payload: null, criadoEm: '' }
    assert.equal(botaoDesafio({ ativo: true, visao: { ...visao, pedidos: [pend] }, enviando: false, semConexao: false }).habilitado, false)
  })
  console.log(`desafio-ui: ${total} casos ok`)
}
void main()
