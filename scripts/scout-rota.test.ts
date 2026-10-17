import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { configMelhorDe3 } from '../src/lib/regras-volei'
import { TIPO_NA_TABELA } from '../src/lib/sumula-eventos'
import { lerResumoScout, MENSAGEM_EVENTOS_INDISPONIVEIS, scoutAtivo } from '../src/lib/scout'
import { GET as GET_RESUMO } from '../src/app/api/scout/[token]/resumo/route'
import { GET as GET_EXPORTAR } from '../src/app/api/scout/[token]/exportar/route'

const ctx = { params: Promise.resolve({ token: 'qualquer-token' }) }
const config = configMelhorDe3()

/** Banco falso: devolve as linhas (já no formato da tabela) ou um erro de tabela ausente. */
function banco(resposta: { data?: unknown[]; error?: { code?: string; message?: string } }) {
  const q: any = {
    select: () => q, eq: () => q, gt: () => q, order: () => q,
    limit: () => Promise.resolve({ data: resposta.data ?? [], error: resposta.error ?? null }),
  }
  return { from: () => q, rpc: () => Promise.resolve({ data: null, error: null }) } as any
}

function linha(seq: number, tipo: keyof typeof TIPO_NA_TABELA, payload: Record<string, unknown>) {
  return { id: seq, seq, clientEventId: `c-${seq}`, tipo: TIPO_NA_TABELA[tipo], setNumero: 1, equipeId: null, payload: { ...payload, _motor: tipo }, desfazId: null, criadoEm: null }
}

async function main() {
  // Flag do scout
  delete process.env.SCOUT_ATIVO
  assert.equal(scoutAtivo(), false)
  assert.equal((await GET_RESUMO(new NextRequest('http://localhost/api/scout/t/resumo'), ctx)).status, 404)
  assert.equal((await GET_EXPORTAR(new NextRequest('http://localhost/api/scout/t/exportar?formato=csv'), ctx)).status, 404)
  process.env.SCOUT_ATIVO = '0'
  assert.equal((await GET_RESUMO(new NextRequest('http://localhost/api/scout/t/resumo'), ctx)).status, 404, 'só "1" liga')

  // Formato inválido (com a flag ligada) é recusado antes de qualquer acesso a dados.
  process.env.SCOUT_ATIVO = '1'
  const ruim = await GET_EXPORTAR(new NextRequest('http://localhost/api/scout/t/exportar?formato=dvw'), ctx)
  assert.equal(ruim.status, 400)
  assert.equal(((await ruim.json()) as any).error, 'Formato inválido. Use csv ou json.')
  delete process.env.SCOUT_ATIVO

  const entrada = { partidaId: 9, config, geradoEm: '2026-10-17T12:00:00.000Z' }

  // Eventos desligados => 503
  const off = await lerResumoScout(banco({}), entrada, {})
  assert.deepEqual(off, { tipo: 'INDISPONIVEL', mensagem: 'Eventos da súmula ainda não habilitados neste ambiente.' })
  assert.equal(MENSAGEM_EVENTOS_INDISPONIVEIS, 'Eventos da súmula ainda não habilitados neste ambiente.')

  // Tabela ausente => 503
  const ausente = await lerResumoScout(banco({ error: { code: '42P01', message: 'relation "SumulaEvento" does not exist' } }), entrada, { SUMULA_EVENTOS_ATIVO: '1' })
  assert.equal(ausente.tipo, 'INDISPONIVEL')

  // Erro genérico => ERRO (500)
  const falha = await lerResumoScout(banco({ error: { code: 'XX000', message: 'boom' } }), entrada, { SUMULA_EVENTOS_ATIVO: '1' })
  assert.equal(falha.tipo, 'ERRO')

  // Caminho feliz com linhas da tabela
  const linhas = [
    linha(1, 'SET_INICIADO', { numeroSet: 1, formacaoA: [1, 2, 3, 4, 5, 6], formacaoB: [11, 12, 13, 14, 15, 16], saqueInicial: 'A' }),
    linha(2, 'PONTO', { equipe: 'A' }),
    linha(3, 'PONTO', { equipe: 'B' }),
  ]
  const ok = await lerResumoScout(banco({ data: linhas }), entrada, { SUMULA_EVENTOS_ATIVO: '1' })
  assert.equal(ok.tipo, 'OK')
  if (ok.tipo === 'OK') {
    assert.equal(ok.resumo.partidaId, 9)
    assert.equal(ok.resumo.derivado.pontos.length, 2)
    assert.deepEqual([ok.resumo.derivado.sets[0]!.pontosA, ok.resumo.derivado.sets[0]!.pontosB], [1, 1])
    assert.equal(ok.resumo.derivado.pontos[1]!.tipo, 'SIDE_OUT')
  }

  console.log('scout-rota.test.ts: 8 verificações ok.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
