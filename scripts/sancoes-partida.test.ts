import assert from 'node:assert/strict'
import { configurarAmbienteSupabase, instalarPostgrestFalso } from './helpers/postgrest-falso'
import { suspensaoAutomatica } from '../src/lib/sancoes'

configurarAmbienteSupabase()

const san = (sancao: string) => `10:00 | 1x0 | [Cartão vermelho] A - B: x [[SAN:A:J.7:GROSSEIRA:${sancao}:1]]`

async function main() {
  const { historicoDeSancoes, mensagemDeSuspensao } = await import('../src/lib/sancoes-partida')
  const suspende = (ocorrencias: Array<{ jogadorId: number; tipo: string; descricao?: string | null }>) =>
    suspensaoAutomatica(historicoDeSancoes([{ id: 1, ocorrencias }], 7)).suspenso

  // Nota antiga sem marcador: cartão vermelho segue como expulsão (suspende).
  assert.equal(suspende([{ jogadorId: 7, tipo: 'CARTAO_VERMELHO' }]), true)
  assert.equal(suspende([{ jogadorId: 7, tipo: 'CARTAO_VERMELHO', descricao: 'Cartão vermelho A - B: sem marcador' }]), true)
  assert.equal(suspende([{ jogadorId: 7, tipo: 'CARTAO_VERMELHO', descricao: null }]), true)
  // Marcador que não é penalidade/expulsão/desqualificação mantém o comportamento antigo.
  assert.equal(suspende([{ jogadorId: 7, tipo: 'CARTAO_VERMELHO', descricao: san('ATRASO') }]), true)

  // Marcador de penalidade: não suspende (a tela grava como CARTAO_VERMELHO).
  assert.equal(suspende([{ jogadorId: 7, tipo: 'CARTAO_VERMELHO', descricao: san('PENALIDADE') }]), false)
  // Marcador de expulsão e desqualificação: suspende.
  assert.equal(suspende([{ jogadorId: 7, tipo: 'CARTAO_VERMELHO', descricao: san('EXPULSAO') }]), true)
  assert.equal(suspende([{ jogadorId: 7, tipo: 'CARTAO_VERMELHO', descricao: san('DESQUALIFICACAO') }]), true)
  // Tipos explícitos não mudam.
  assert.equal(suspende([{ jogadorId: 7, tipo: 'EXPULSAO' }]), true)
  assert.equal(suspende([{ jogadorId: 7, tipo: 'PENALIDADE' }]), false)
  assert.equal(suspende([{ jogadorId: 7, tipo: 'CARTAO_AMARELO' }, { jogadorId: 7, tipo: 'CARTAO_AMARELO' }]), true)
  // Só conta o atleta pedido e ignora tipo desconhecido.
  assert.equal(suspende([{ jogadorId: 8, tipo: 'CARTAO_VERMELHO' }]), false)
  assert.deepEqual(historicoDeSancoes([{ id: 1, ocorrencias: [{ jogadorId: 7, tipo: 'PONTO' }] }], 7), [])

  // A consulta do histórico precisa trazer a descrição (onde está o marcador).
  const rede = instalarPostgrestFalso({
    Partida: [{ id: 5, categoriaCampeonatoId: 'cat-1', dataHora: '2026-10-01T10:00:00Z' }],
  })
  try {
    const aviso = await mensagemDeSuspensao({ id: 5, categoriaCampeonatoId: 'cat-1' }, [{ jogadorId: 7, presente: true }])
    assert.equal(aviso, null)
    const consulta = rede.chamadas.find((chamada) => chamada.tabela === 'Partida')
    assert.ok(consulta, 'consultou Partida')
    assert.match(decodeURIComponent(consulta!.select), /OcorrenciaPartida\(jogadorId,tipo,descricao\)/)
  } finally {
    rede.restaurar()
  }

  console.log('sancoes-partida: ok')
}

main().catch((erro) => {
  console.error(erro)
  process.exit(1)
})
