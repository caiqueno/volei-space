import assert from 'node:assert/strict'
import {
  bancoAppAtivo, divergenciasPapeleta, formacaoAplicavel, idsPorIndice, lerEnvelope, linksAtivos, linkWhatsapp, mensagemFalhaDecisao,
  normalizarLinksBanco, papeletaJaAceita, papeletasParaExibir, podeAceitar,
  papeletasEnviadas, pedidosPendentes, textoPedido, type PapeletaBanco, type PedidoBanco,
} from '../src/lib/sumula-banco-ui'

const rot = (id: number) => (id === 7 ? '#7' : id === 12 ? '#12' : null)
const base: PedidoBanco = { id: 'a', equipeId: 1, tipo: 'TEMPO', estado: 'PENDENTE' }

async function main() {
  assert.equal(bancoAppAtivo('1'), true)
  for (const v of [undefined, null, '', '0', 'true']) assert.equal(bancoAppAtivo(v), false, `flag ${String(v)}`)

  assert.equal(textoPedido(base, 'Time A'), 'Time A pede tempo')
  assert.equal(textoPedido({ ...base, tipo: 'DESAFIO' }, 'Time B'), 'Time B pede desafio')
  assert.equal(textoPedido({ ...base, tipo: 'SUBSTITUICAO', payload: { sai: 7, entra: 12 } }, 'Time B', rot), 'Time B pede troca: sai #7, entra #12')
  assert.equal(textoPedido({ ...base, tipo: 'SUBSTITUICAO', payload: { sai: 7, entra: 99 } }, 'Time B', rot), 'Time B pede troca: sai #7, entra atleta 99')
  assert.equal(textoPedido({ ...base, tipo: 'SUBSTITUICAO' }, 'Time B'), 'Time B pede troca')

  assert.deepEqual(podeAceitar(base, { partidaEmAndamento: true }), { ok: true })
  assert.equal(podeAceitar(base, { partidaEmAndamento: false }).ok, false)
  assert.equal(podeAceitar({ ...base, tipo: 'DESAFIO' }, { partidaEmAndamento: false }).ok, true)
  assert.equal(podeAceitar({ ...base, estado: 'ACEITO' }, { partidaEmAndamento: true }).ok, false)
  assert.equal(podeAceitar(base, { partidaEmAndamento: true, decidindo: true }).ok, false)
  assert.equal(podeAceitar({ ...base, tipo: 'SUBSTITUICAO', payload: { sai: 7 } }, { partidaEmAndamento: true }).ok, false)
  assert.equal(podeAceitar({ ...base, tipo: 'SUBSTITUICAO', payload: { sai: 7, entra: 12 } }, { partidaEmAndamento: true }).ok, true)
  assert.equal(pedidosPendentes([base, { ...base, id: 'b', estado: 'RECUSADO' }]).length, 1)

  const formacao = [1, 2, 3, 4, 5, 6].map((posicao) => ({ posicao, jogadorId: 100 + posicao }))
  const tela = { formacao: formacao.map((f) => ({ ...f })), liberoId: 50 }
  assert.deepEqual(divergenciasPapeleta({ formacao, liberoId: 50 }, tela), [])
  assert.deepEqual(divergenciasPapeleta({ formacao, liberoId: 50 }, null), [])
  tela.formacao[2] = { posicao: 3, jogadorId: 999 }
  const d = divergenciasPapeleta({ formacao, liberoId: 51 }, tela)
  assert.equal(d.length, 2)
  assert.deepEqual(d[0], { tipo: 'POSICAO', posicao: 3, papeleta: 103, escalacao: 999 })
  assert.equal(d[1].tipo, 'LIBERO')
  assert.deepEqual(divergenciasPapeleta({ formacao, liberoId: null }, { formacao: [null], liberoId: null }), [])

  assert.equal(formacaoAplicavel(formacao), true)
  assert.equal(formacaoAplicavel(formacao.slice(1)), false)
  assert.equal(formacaoAplicavel(formacao.map((f) => ({ ...f, jogadorId: 1 }))), false)
  assert.equal(formacaoAplicavel(formacao.map((f) => ({ ...f, posicao: 1 }))), false)
  assert.deepEqual(idsPorIndice(formacao), [101, 102, 103, 104, 105, 106])

  const env = (estado: string) => ({ equipeId: 1, estado, formacao, liberoId: null, capitaoId: null })
  assert.equal(papeletasEnviadas([env('RASCUNHO'), env('ENVIADA')]).length, 1)
  assert.ok(linkWhatsapp('https://x/y?a=1', 'Time A').startsWith('https://wa.me/?text=Banco%20de%20reservas'))

  const resp = (status: number, corpo: unknown) => ({ ok: status < 300, status, json: async () => corpo })
  assert.deepEqual(await lerEnvelope(resp(404, {})), { tipo: 'desligado' })
  assert.deepEqual(await lerEnvelope(resp(503, {})), { tipo: 'desligado' })
  assert.deepEqual(await lerEnvelope(resp(200, { data: { x: 1 } })), { tipo: 'ok', data: { x: 1 } })
  assert.deepEqual(await lerEnvelope(resp(400, { error: 'Ruim' })), { tipo: 'erro', mensagem: 'Ruim', status: 400 })
  assert.equal((await lerEnvelope(resp(500, null))).tipo, 'erro')
  // 404/503 COM codigo do servidor: erro real, com a mensagem; sem codigo: desligado
  assert.deepEqual(await lerEnvelope(resp(404, { error: 'Pedido não encontrado.', codigo: 'PEDIDO_NAO_ENCONTRADO' })), {
    tipo: 'erro', mensagem: 'Pedido não encontrado.', status: 404, codigo: 'PEDIDO_NAO_ENCONTRADO',
  })
  assert.deepEqual(await lerEnvelope(resp(503, { error: 'Banco ainda não habilitado neste ambiente.', codigo: 'BANCO_INDISPONIVEL' })), {
    tipo: 'erro', mensagem: 'Banco ainda não habilitado neste ambiente.', status: 503, codigo: 'BANCO_INDISPONIVEL',
  })
  assert.deepEqual(await lerEnvelope(resp(404, { error: 'Recurso não encontrado.' })), { tipo: 'desligado' })

  // mensagem após decisão recusada pelo servidor
  assert.doesNotMatch(mensagemFalhaDecisao({ decisao: 'ACEITO', tipo: 'DESAFIO', status: 503, mensagem: 'x' }), /registrado na súmula/)
  assert.match(mensagemFalhaDecisao({ decisao: 'ACEITO', tipo: 'TEMPO', status: 422, mensagem: 'Limite' }), /tempo já foi registrado na súmula.*recusou/i)
  assert.match(mensagemFalhaDecisao({ decisao: 'ACEITO', tipo: 'SUBSTITUICAO', status: 422, mensagem: 'Limite' }), /A troca já foi registrada na súmula/)
  assert.match(mensagemFalhaDecisao({ decisao: 'RECUSADO', tipo: 'TEMPO', status: 500, mensagem: 'Falhou' }), /recusa: Falhou/)

  // papeletas aceitas continuam visíveis
  const pap = (estado: string, n = 6): PapeletaBanco => ({ equipeId: 1, estado, liberoId: null, capitaoId: null, formacao: Array.from({ length: n }, (_, i) => ({ posicao: i + 1, jogadorId: i + 10 })) })
  assert.equal(papeletasParaExibir([pap('ENVIADA'), pap('ACEITA'), pap('RASCUNHO'), pap('ACEITA', 0)]).length, 2)
  assert.equal(papeletaJaAceita(pap('ACEITA')), true)
  assert.equal(papeletaJaAceita(pap('ENVIADA')), false)

  // links do banco
  const lista = normalizarLinksBanco([
    { acessoId: 'a1', equipeId: 1, criadoEm: '2026-01-01T10:00:00Z', expiraEm: '2999-01-01T00:00:00Z', revogadoEm: null },
    { acessoId: 'a2', equipeId: 1, criadoEm: '2026-01-02T10:00:00Z', expiraEm: '2999-01-01T00:00:00Z', revogadoEm: '2026-01-03T00:00:00Z' },
    { acessoId: 'a3', equipeId: 2, criadoEm: '2026-01-02T10:00:00Z', expiraEm: '2020-01-01T00:00:00Z', revogadoEm: null },
    { acessoId: 'a4', equipeId: 2, criadoEm: '2026-01-04T10:00:00Z', expiraEm: null, revogadoEm: null },
    { lixo: true },
    null,
  ])
  assert.equal(lista.length, 4)
  assert.deepEqual(linksAtivos(lista, Date.parse('2026-06-01T00:00:00Z')).map((l) => l.acessoId), ['a4', 'a1'])
  assert.deepEqual(normalizarLinksBanco('x'), [])
  console.log('sumula-banco-ui: ok')
}

main().catch((e) => { console.error(e); process.exit(1) })
