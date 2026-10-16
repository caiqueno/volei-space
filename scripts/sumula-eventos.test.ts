import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import {
  configDaPartida,
  lerEstado,
  linhasParaLog,
  loteSchema,
  processarLote,
  sumulaEventosAtivo,
  validarNovoEvento,
  type EntradaPartida,
  type ResultadoLote,
} from '../src/lib/sumula-eventos'
import { derivarPlacar, validarPlacarFinalSet } from '../src/lib/regras-volei'
import { criarBancoEventos, inserirLinhaDeOutroApontador } from './helpers/fake-supabase-eventos'

const PARTIDA = { id: 7, equipeAId: 100, equipeBId: 200 }
const ORIGEM = { autorTipo: 'ARBITRO' as const, autorRef: '5' }

function entrada(regras: Parameters<typeof configDaPartida>[0] = { setsPorPartida: 3, pontosPorSet: 25, tieBreakUltimoSet: true, pontosUltimoSet: 15 }): EntradaPartida {
  return {
    partida: PARTIDA,
    config: configDaPartida(regras),
    contexto: { elenco: { A: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], B: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20] } },
  }
}

type Ev = { clientEventId: string; tipo: string; payload: Record<string, unknown>; desfazId?: number }
const ev = (tipo: string, payload: Record<string, unknown> = {}, extra: Partial<Ev> = {}): Ev => ({
  clientEventId: randomUUID(),
  tipo,
  payload,
  ...extra,
})
const inicioSet = (numeroSet = 1, saqueInicial = 'A') =>
  ev('SET_INICIADO', {
    numeroSet,
    formacaoA: [1, 2, 3, 4, 5, 6],
    formacaoB: [11, 12, 13, 14, 15, 16],
    saqueInicial,
    ...(numeroSet === 1 ? { liberosA: [10], liberosB: [20] } : {}),
  })
const ponto = (equipe: 'A' | 'B') => ev('PONTO', { equipe })

function lote(eventos: Ev[], seqEsperado?: number) {
  const r = loteSchema.safeParse({ eventos, ...(seqEsperado === undefined ? {} : { seqEsperado }) })
  if (!r.success) throw new Error(JSON.stringify(r.error.flatten()))
  return r.data
}

function processado(r: ResultadoLote) {
  assert.equal(r.tipo, 'PROCESSADO', JSON.stringify(r))
  return r as Extract<ResultadoLote, { tipo: 'PROCESSADO' }>
}

let total = 0
const falhas: string[] = []
async function caso(nome: string, fn: () => Promise<void> | void) {
  total += 1
  try {
    await fn()
    console.log(`  ok  ${nome}`)
  } catch (e) {
    falhas.push(nome)
    console.error(`  FALHOU  ${nome}\n${e instanceof Error ? e.stack : e}`)
  }
}

function novoBanco(extra: Partial<Parameters<typeof criarBancoEventos>[0]> = {}) {
  return criarBancoEventos({ partidaId: PARTIDA.id, equipeAId: PARTIDA.equipeAId, equipeBId: PARTIDA.equipeBId, ...extra })
}

async function main() {
  await caso('flag: a rota só liga com SUMULA_EVENTOS_ATIVO=1', () => {
    assert.equal(sumulaEventosAtivo({}), false)
    assert.equal(sumulaEventosAtivo({ SUMULA_EVENTOS_ATIVO: '0' }), false)
    assert.equal(sumulaEventosAtivo({ SUMULA_EVENTOS_ATIVO: 'true' }), false)
    assert.equal(sumulaEventosAtivo({ SUMULA_EVENTOS_ATIVO: '1' }), true)
  })

  await caso('grava início de set e pontos e devolve o estado derivado', async () => {
    const banco = novoBanco()
    const r = processado(await processarLote(banco.cliente, entrada(), lote([inicioSet(), ponto('A'), ponto('B'), ponto('B')], 0), ORIGEM))
    assert.equal(r.rejeitados.length, 0)
    assert.deepEqual(r.aceitos.map((a) => a.seq), [1, 2, 3, 4])
    assert.deepEqual(r.estado.placar, { a: 1, b: 2 })
    assert.equal(r.estado.saca, 'B')
    assert.deepEqual(r.estado.rotacao.B, [12, 13, 14, 15, 16, 11])
    assert.equal(r.estado.ultimoSeq, 4)
    assert.equal(banco.linhas.length, 4)
    assert.equal(banco.linhas[0]!.tipo, 'INICIO_SET')
    assert.equal(banco.linhas[1]!.equipeId, 100)
    assert.equal(banco.linhas[2]!.equipeId, 200)
    assert.equal(banco.linhas[1]!.payload._motor, 'PONTO')
    assert.equal(banco.linhas[1]!.autorTipo, 'ARBITRO')
  })

  await caso('idempotência: reenviar o mesmo lote não regrava nada', async () => {
    const banco = novoBanco()
    const l = lote([inicioSet(), ponto('A'), ponto('A')], 0)
    processado(await processarLote(banco.cliente, entrada(), l, ORIGEM))
    const chamadas = banco.estado.chamadasRpc
    const r = processado(await processarLote(banco.cliente, entrada(), l, ORIGEM))
    assert.equal(banco.linhas.length, 3)
    assert.equal(banco.estado.chamadasRpc, chamadas, 'duplicados nem chegam ao RPC')
    assert.ok(r.aceitos.every((a) => a.duplicado))
    assert.deepEqual(r.aceitos.map((a) => a.seq), [1, 2, 3])
    assert.deepEqual(r.estado.placar, { a: 2, b: 0 })
  })

  await caso('idempotência: lote reenviado com parte já gravada grava só o que falta, sem 409', async () => {
    const banco = novoBanco()
    const todos = [inicioSet(), ponto('A'), ponto('B'), ponto('A')]
    processado(await processarLote(banco.cliente, entrada(), lote(todos.slice(0, 2), 0), ORIGEM))
    const r = processado(await processarLote(banco.cliente, entrada(), lote(todos, 0), ORIGEM))
    assert.deepEqual(r.aceitos.map((a) => [a.seq, a.duplicado]), [[1, true], [2, true], [3, false], [4, false]])
    assert.equal(banco.linhas.length, 4)
  })

  await caso('conflito: seqEsperado desatualizado devolve 409 com o estado atual e não grava', async () => {
    const banco = novoBanco()
    processado(await processarLote(banco.cliente, entrada(), lote([inicioSet(), ponto('A')], 0), ORIGEM))
    const r = await processarLote(banco.cliente, entrada(), lote([ponto('B')], 1), ORIGEM)
    assert.equal(r.tipo, 'CONFLITO')
    if (r.tipo === 'CONFLITO') {
      assert.equal(r.seqAtual, 2)
      assert.deepEqual(r.estado.placar, { a: 1, b: 0 })
    }
    assert.equal(banco.linhas.length, 2)
  })

  await caso('conflito: outro apontador grava entre a leitura e o RPC', async () => {
    const banco = novoBanco()
    processado(await processarLote(banco.cliente, entrada(), lote([inicioSet()], 0), ORIGEM))
    banco.estado.antesDoRpc = () => {
      banco.estado.antesDoRpc = null
      inserirLinhaDeOutroApontador(banco, PARTIDA.id, randomUUID())
    }
    const r = await processarLote(banco.cliente, entrada(), lote([ponto('A')], 1), ORIGEM)
    assert.equal(r.tipo, 'CONFLITO')
    if (r.tipo === 'CONFLITO') assert.equal(r.seqAtual, 2)
    assert.equal(banco.linhas.length, 2, 'o ponto não foi gravado')
    // Com o estado novo, o cliente reenvia e passa.
    const ok = processado(await processarLote(banco.cliente, entrada(), lote([ponto('A')], 2), ORIGEM))
    assert.equal(ok.aceitos[0]!.seq, 3)
  })

  await caso('regra: ponto sem set em andamento é rejeitado com código e mensagem', async () => {
    const banco = novoBanco()
    const r = processado(await processarLote(banco.cliente, entrada(), lote([ponto('A')]), ORIGEM))
    assert.equal(r.aceitos.length, 0)
    assert.equal(r.rejeitados[0]!.codigo, 'RG-SET-001')
    assert.match(r.rejeitados[0]!.mensagem, /set em andamento/)
    assert.equal(banco.linhas.length, 0)
  })

  await caso('regra: o primeiro rejeitado interrompe o lote (RG-LOG-009 nos seguintes)', async () => {
    const banco = novoBanco()
    const r = processado(
      await processarLote(
        banco.cliente,
        entrada(),
        lote([inicioSet(), ev('SUBSTITUICAO', { equipe: 'A', sai: 1, entra: 99 }), ponto('A'), ponto('A')]),
        ORIGEM,
      ),
    )
    assert.deepEqual(r.aceitos.map((a) => a.seq), [1])
    assert.equal(r.rejeitados[0]!.codigo, 'RG-FOR-009')
    assert.deepEqual(r.rejeitados.slice(1).map((x) => x.codigo), ['RG-LOG-009', 'RG-LOG-009'])
    assert.equal(banco.linhas.length, 1)
  })

  await caso('regra: saque fora da ordem (RG-ROT-001) e líbero sacando (RG-LIB-004)', async () => {
    const banco = novoBanco()
    processado(await processarLote(banco.cliente, entrada(), lote([inicioSet()]), ORIGEM))
    const fora = processado(await processarLote(banco.cliente, entrada(), lote([ev('PONTO', { equipe: 'A', sacador: 2 })]), ORIGEM))
    assert.equal(fora.rejeitados[0]!.codigo, 'RG-ROT-001')
    const certo = processado(await processarLote(banco.cliente, entrada(), lote([ev('PONTO', { equipe: 'A', sacador: 1 })]), ORIGEM))
    assert.equal(certo.aceitos.length, 1)
  })

  await caso('regra: líbero não faz duas trocas sem rally nem troca com a bola em jogo', async () => {
    const banco = novoBanco()
    processado(await processarLote(banco.cliente, entrada(), lote([inicioSet()]), ORIGEM))
    const emJogo = processado(
      await processarLote(banco.cliente, entrada(), lote([ev('TROCA_LIBERO', { equipe: 'A', sai: 6, entra: 10, momento: 'EM_JOGO' })]), ORIGEM),
    )
    assert.equal(emJogo.rejeitados[0]!.codigo, 'RG-LIB-008')
    processado(await processarLote(banco.cliente, entrada(), lote([ev('TROCA_LIBERO', { equipe: 'A', sai: 6, entra: 10 })]), ORIGEM))
    const duas = processado(await processarLote(banco.cliente, entrada(), lote([ev('TROCA_LIBERO', { equipe: 'A', sai: 10, entra: 6 })]), ORIGEM))
    assert.equal(duas.rejeitados[0]!.codigo, 'RG-LIB-005')
    const frente = processado(await processarLote(banco.cliente, entrada(), lote([ev('TROCA_LIBERO', { equipe: 'B', sai: 13, entra: 20 })]), ORIGEM))
    assert.equal(frente.rejeitados[0]!.codigo, 'RG-LIB-003')
  })

  await caso('regra: terceiro tempo do set é rejeitado (RG-TMP-001)', async () => {
    const banco = novoBanco()
    processado(await processarLote(banco.cliente, entrada(), lote([inicioSet(), ev('TEMPO', { equipe: 'A' }), ev('TEMPO', { equipe: 'A' })]), ORIGEM))
    const r = processado(await processarLote(banco.cliente, entrada(), lote([ev('TEMPO', { equipe: 'A' })]), ORIGEM))
    assert.equal(r.rejeitados[0]!.codigo, 'RG-TMP-001')
    const b = processado(await processarLote(banco.cliente, entrada(), lote([ev('TEMPO', { equipe: 'B' })]), ORIGEM))
    assert.equal(b.aceitos.length, 1)
  })

  await caso('regra: substituição acima do limite e de jogador em quadra (RG-SUB-001/006)', async () => {
    const banco = novoBanco()
    const e = entrada({ setsPorPartida: 3, pontosPorSet: 25, limiteSubstituicoesPorSet: 1 })
    processado(await processarLote(banco.cliente, e, lote([inicioSet(), ev('SUBSTITUICAO', { equipe: 'A', sai: 1, entra: 7 }), ponto('B')]), ORIGEM))
    const r = processado(await processarLote(banco.cliente, e, lote([ev('SUBSTITUICAO', { equipe: 'A', sai: 2, entra: 8 })]), ORIGEM))
    assert.equal(r.rejeitados[0]!.codigo, 'RG-SUB-001')
    const q = processado(await processarLote(banco.cliente, e, lote([ev('SUBSTITUICAO', { equipe: 'B', sai: 11, entra: 12 })]), ORIGEM))
    assert.equal(q.rejeitados[0]!.codigo, 'RG-SUB-006')
  })

  await caso('regra: o servidor calcula a sanção (cliente não escolhe penalidade nem ponto)', async () => {
    const banco = novoBanco()
    processado(await processarLote(banco.cliente, entrada(), lote([inicioSet()]), ORIGEM))
    const r = processado(
      await processarLote(
        banco.cliente,
        entrada(),
        // Campos sancao/pontoParaAdversario enviados pelo cliente são ignorados.
        lote([ev('SANCAO', { equipe: 'A', membro: 'J:3', categoria: 'GROSSEIRA', sancao: 'ADVERTENCIA_VERBAL', pontoParaAdversario: false })]),
        ORIGEM,
      ),
    )
    assert.equal(r.aceitos.length, 1)
    assert.equal(banco.linhas[1]!.payload.sancao, 'PENALIDADE')
    assert.equal(banco.linhas[1]!.payload.pontoParaAdversario, true)
    assert.deepEqual(r.estado.placar, { a: 0, b: 1 })
    // A 2ª grosseira do mesmo membro é expulsão; a 3ª, desqualificação; depois disso nada mais.
    processado(await processarLote(banco.cliente, entrada(), lote([ev('SANCAO', { equipe: 'A', membro: 'J:3', categoria: 'GROSSEIRA' })]), ORIGEM))
    const bloqueada = processado(await processarLote(banco.cliente, entrada(), lote([ev('SANCAO', { equipe: 'A', membro: 'J:3', categoria: 'MENOR' })]), ORIGEM))
    assert.equal(bloqueada.rejeitados[0]!.codigo, 'RG-SAN-007')
    const naoEhDoTime = processado(await processarLote(banco.cliente, entrada(), lote([ev('SANCAO', { equipe: 'A', membro: 'J:15', categoria: 'MENOR' })]), ORIGEM))
    assert.equal(naoEhDoTime.rejeitados[0]!.codigo, 'RG-FOR-009')
  })

  await caso('desfazer: DESFAZ anula o ponto, não se desfaz duas vezes e respeita a ordem', async () => {
    const banco = novoBanco()
    processado(await processarLote(banco.cliente, entrada(), lote([inicioSet(), ponto('A'), ponto('A')]), ORIGEM))
    const d = processado(await processarLote(banco.cliente, entrada(), lote([ev('DESFAZ', {}, { desfazId: 3 })]), ORIGEM))
    assert.deepEqual(d.estado.placar, { a: 1, b: 0 })
    assert.equal(banco.linhas[3]!.tipo, 'DESFAZ')
    assert.equal(banco.linhas[3]!.desfazId, banco.linhas[2]!.id, 'a tabela guarda o id da linha, não o seq')
    const dupla = processado(await processarLote(banco.cliente, entrada(), lote([ev('DESFAZ', {}, { desfazId: 3 })]), ORIGEM))
    assert.equal(dupla.rejeitados[0]!.codigo, 'RG-LOG-003')
    const deDesfaz = processado(await processarLote(banco.cliente, entrada(), lote([ev('DESFAZ', {}, { desfazId: 4 })]), ORIGEM))
    assert.equal(deDesfaz.rejeitados[0]!.codigo, 'RG-LOG-003')
    const inexistente = processado(await processarLote(banco.cliente, entrada(), lote([ev('DESFAZ', {}, { desfazId: 99 })]), ORIGEM))
    assert.equal(inexistente.rejeitados[0]!.codigo, 'RG-LOG-002')
    // Desfazer o início do set com ponto depois dele deixaria o log inconsistente.
    const ordem = processado(await processarLote(banco.cliente, entrada(), lote([ev('DESFAZ', {}, { desfazId: 1 })]), ORIGEM))
    assert.equal(ordem.rejeitados[0]!.codigo, 'RG-LOG-007')
    // Desfazer na ordem inversa funciona, e o ponto desfeito pode ser lançado de novo.
    processado(await processarLote(banco.cliente, entrada(), lote([ev('DESFAZ', {}, { desfazId: 2 })]), ORIGEM))
    const reenvio = processado(await processarLote(banco.cliente, entrada(), lote([ponto('B')]), ORIGEM))
    assert.deepEqual(reenvio.estado.placar, { a: 0, b: 1 })
  })

  await caso('desfazer: DESFAZ de substituição devolve o jogador e o saldo de trocas', async () => {
    const banco = novoBanco()
    processado(await processarLote(banco.cliente, entrada(), lote([inicioSet(), ev('SUBSTITUICAO', { equipe: 'A', sai: 1, entra: 7 })]), ORIGEM))
    const r = processado(await processarLote(banco.cliente, entrada(), lote([ev('DESFAZ', {}, { desfazId: 2 })]), ORIGEM))
    assert.deepEqual(r.estado.rotacao.A, [1, 2, 3, 4, 5, 6])
    assert.equal(r.estado.contadores.A!.substituicoesRegulares, 0)
  })

  await caso('WO: encerra a partida e bloqueia novos lances (menos observação e desfazer)', async () => {
    const banco = novoBanco()
    processado(await processarLote(banco.cliente, entrada(), lote([inicioSet(), ponto('A')]), ORIGEM))
    const r = processado(await processarLote(banco.cliente, entrada(), lote([ev('WO', { ausente: 'B' })]), ORIGEM))
    assert.equal(r.estado.status, 'WO')
    assert.equal(r.estado.vencedor, 'A')
    const depois = processado(await processarLote(banco.cliente, entrada(), lote([ponto('A')]), ORIGEM))
    assert.equal(depois.rejeitados[0]!.codigo, 'RG-WO-001')
    const obs = processado(await processarLote(banco.cliente, entrada(), lote([ev('OBSERVACAO', { texto: 'Equipe B ausente' })]), ORIGEM))
    assert.equal(obs.aceitos.length, 1)
    const volta = processado(await processarLote(banco.cliente, entrada(), lote([ev('DESFAZ', {}, { desfazId: 3 })]), ORIGEM))
    assert.equal(volta.estado.status, 'EM_ANDAMENTO')
  })

  await caso('interrupção: acumula minutos e exige repetir a partida acima de 4 horas', async () => {
    const banco = novoBanco()
    processado(await processarLote(banco.cliente, entrada(), lote([inicioSet(), ponto('A')]), ORIGEM))
    const a = processado(await processarLote(banco.cliente, entrada(), lote([ev('INTERRUPCAO', { minutos: 120, motivo: 'falta de energia', acao: 'CONTINUAR_SET' })]), ORIGEM))
    assert.equal(a.aceitos.length, 1)
    const b = processado(await processarLote(banco.cliente, entrada(), lote([ev('INTERRUPCAO', { minutos: 130, motivo: 'goteira', acao: 'CONTINUAR_SET' })]), ORIGEM))
    assert.equal(b.rejeitados[0]!.codigo, 'RG-INT-005')
    const c = processado(await processarLote(banco.cliente, entrada(), lote([ev('INTERRUPCAO', { minutos: 130, motivo: 'goteira', acao: 'REPETIR_PARTIDA' })]), ORIGEM))
    assert.equal(c.estado.status, 'A_REPETIR')
  })

  await caso('interrupção: set só é anulado depois de interrupção com essa decisão', async () => {
    const banco = novoBanco()
    processado(await processarLote(banco.cliente, entrada(), lote([inicioSet(), ponto('A')]), ORIGEM))
    const sem = processado(await processarLote(banco.cliente, entrada(), lote([ev('SET_ANULADO', {})]), ORIGEM))
    assert.equal(sem.rejeitados[0]!.codigo, 'RG-INT-004')
    const r = processado(
      await processarLote(
        banco.cliente,
        entrada(),
        lote([ev('INTERRUPCAO', { minutos: 30, motivo: 'outra quadra', acao: 'ANULAR_SET_E_REJOGAR' }), ev('SET_ANULADO', {}), inicioSet(1, 'A')]),
        ORIGEM,
      ),
    )
    assert.equal(r.aceitos.length, 3, JSON.stringify(r.rejeitados))
    assert.deepEqual(r.estado.placar, { a: 0, b: 0 })
  })

  await caso('payload inválido vira rejeição RG-LOG-011; DESFAZ sem desfazId vira RG-LOG-002', async () => {
    const banco = novoBanco()
    const r = processado(
      await processarLote(banco.cliente, entrada(), lote([ev('PONTO', { equipe: 'C' }), ev('PONTO', { equipe: 'A' })]), ORIGEM),
    )
    assert.equal(r.rejeitados[0]!.codigo, 'RG-LOG-011')
    assert.equal(r.rejeitados[1]!.codigo, 'RG-LOG-009')
    const d = processado(await processarLote(banco.cliente, entrada(), lote([ev('DESFAZ', {})]), ORIGEM))
    assert.equal(d.rejeitados[0]!.codigo, 'RG-LOG-002')
    assert.equal(loteSchema.safeParse({ eventos: [] }).success, false)
    assert.equal(loteSchema.safeParse({ eventos: [{ clientEventId: 'x', tipo: 'PONTO', payload: {} }] }).success, false)
    assert.equal(loteSchema.safeParse({ eventos: [{ clientEventId: randomUUID(), tipo: 'INVENTADO', payload: {} }] }).success, false)
  })

  await caso('banco: tabela ou RPC ausentes devolvem indisponível (503), sem erro cru', async () => {
    const semTabela = novoBanco({ tabelaExiste: false })
    const a = await processarLote(semTabela.cliente, entrada(), lote([inicioSet()]), ORIGEM)
    assert.equal(a.tipo, 'INDISPONIVEL')
    const l = await lerEstado(semTabela.cliente, entrada())
    assert.equal(l.tipo, 'INDISPONIVEL')
    const semRpc = novoBanco({ rpcExiste: false })
    const b = await processarLote(semRpc.cliente, entrada(), lote([inicioSet()]), ORIGEM)
    assert.equal(b.tipo, 'INDISPONIVEL')
    if (b.tipo === 'INDISPONIVEL') assert.match(b.mensagem, /migration/)
  })

  await caso('banco: súmula oficializada recusa novos eventos (RG-LOG-008)', async () => {
    const banco = novoBanco({ oficializada: true })
    const r = processado(await processarLote(banco.cliente, entrada(), lote([inicioSet()]), ORIGEM))
    assert.equal(r.rejeitados[0]!.codigo, 'RG-LOG-008')
  })

  await caso('leitura: estado vazio e leitura a partir de um seq', async () => {
    const banco = novoBanco()
    const vazio = await lerEstado(banco.cliente, entrada())
    assert.equal(vazio.tipo, 'OK')
    if (vazio.tipo === 'OK') {
      assert.equal(vazio.estado.status, 'NAO_INICIADA')
      assert.equal(vazio.estado.ultimoSeq, 0)
    }
    processado(await processarLote(banco.cliente, entrada(), lote([inicioSet(), ponto('A'), ponto('A')]), ORIGEM))
    const parcial = await lerEstado(banco.cliente, entrada(), 2)
    if (parcial.tipo !== 'OK') throw new Error('esperava OK')
    assert.deepEqual(parcial.eventos.map((e) => e.seq), [3])
    assert.equal(parcial.estado.limites.substituicoesPorSet, 8)
    assert.equal(parcial.estado.limites.temposPorSet, 2)
  })

  await caso('simulação: 100 partidas completas pelo serviço (reenvios, rejeições e desfazer)', async () => {
    let semente = 20260417
    const rnd = () => {
      semente = (semente * 1664525 + 1013904223) % 4294967296
      return semente / 4294967296
    }
    let rejeicoes = 0
    let duplicados = 0
    let desfeitos = 0
    for (let n = 0; n < 100; n += 1) {
      const banco = novoBanco()
      const e = entrada()
      let seq = 0
      const enviar = async (eventos: Ev[], reenviar = false) => {
        let r = processado(await processarLote(banco.cliente, e, lote(eventos, seq), ORIGEM))
        if (reenviar) {
          const r2 = processado(await processarLote(banco.cliente, e, lote(eventos, seq), ORIGEM))
          duplicados += r2.aceitos.filter((a) => a.duplicado).length
          r = r2
        }
        rejeicoes += r.rejeitados.length
        seq = r.estado.ultimoSeq
        return r
      }
      let primeiroDoSet: 'A' | 'B' = rnd() < 0.5 ? 'A' : 'B'
      let numero = 1
      let ultimo = await enviar([inicioSet(1, primeiroDoSet)])
      while (ultimo.estado.status === 'EM_ANDAMENTO') {
        if (ultimo.estado.setAtual!.encerrado) {
          numero += 1
          primeiroDoSet = numero < 3 ? (primeiroDoSet === 'A' ? 'B' : 'A') : rnd() < 0.5 ? 'A' : 'B'
          ultimo = await enviar([inicioSet(numero, primeiroDoSet)])
          continue
        }
        const forte = rnd() < 0.5 ? 'A' : 'B'
        const lance = rnd()
        const pontos = Array.from({ length: 1 + Math.floor(rnd() * 4) }, () => ponto(rnd() < 0.7 ? forte : forte === 'A' ? 'B' : 'A'))
        const extras: Ev[] = []
        if (lance < 0.1) extras.push(ev('TEMPO', { equipe: rnd() < 0.5 ? 'A' : 'B' }))
        else if (lance < 0.2) extras.push(ev('SUBSTITUICAO', { equipe: 'A', sai: 1 + Math.floor(rnd() * 6), entra: 7 + Math.floor(rnd() * 3) }))
        const eventos = [...extras, ...pontos]
        let r = await enviar(eventos, lance > 0.9)
        // Pontos extras além do fim do set voltam rejeitados (RG-SET-001): esperado.
        for (const x of r.rejeitados) assert.match(x.codigo, /^RG-[A-Z]+-\d+$/)
        if (lance > 0.97 && r.estado.setAtual && !r.estado.setAtual.encerrado && r.estado.ultimoSeq > 3) {
          // Desfaz o último evento do log se ele for um ponto (ordem inversa é sempre permitida).
          const leitura = await lerEstado(banco.cliente, e)
          if (leitura.tipo === 'OK') {
            const ultimoEv = leitura.eventos[leitura.eventos.length - 1]!
            if (ultimoEv.tipo === 'PONTO') {
              const d = await enviar([ev('DESFAZ', {}, { desfazId: ultimoEv.seq })])
              assert.equal(d.rejeitados.length, 0, JSON.stringify(d.rejeitados))
              desfeitos += 1
              r = d
            }
          }
        }
        ultimo = r
      }
      assert.equal(ultimo.estado.status, 'ENCERRADA', `partida ${n}`)
      assert.ok([ultimo.estado.setsGanhos.a, ultimo.estado.setsGanhos.b].includes(2))
      assert.equal(ultimo.estado.inconsistencias.length, 0, `partida ${n}: ${JSON.stringify(ultimo.estado.inconsistencias)}`)
      // O log gravado reconstrói o mesmo estado e cada set fechou num placar legal.
      const { log } = linhasParaLog(banco.linhas.map((l) => ({ ...l })) as never)
      assert.deepEqual(log.map((x) => x.seq), log.map((_, i) => i + 1))
      const p = derivarPlacar(log, e.config, e.contexto)
      assert.equal(p.status, 'ENCERRADA')
      for (const s of p.sets) {
        const alvo = s.numero === 3 ? 15 : 25
        assert.equal(validarPlacarFinalSet(s.placar, alvo).ok, true, `partida ${n} set ${s.numero} ${JSON.stringify(s.placar)}`)
      }
    }
    assert.ok(duplicados > 0, 'a simulação exercitou reenvios')
    assert.ok(desfeitos > 0, 'a simulação exercitou desfazer')
    assert.ok(rejeicoes > 0, 'a simulação exercitou rejeições')
  })

  await caso('RG-SUB-007: o servidor aceita trocas[] num pedido e conta uma por jogador; as duas formas juntas são recusadas', async () => {
    const banco = novoBanco()
    const r = processado(
      await processarLote(
        banco.cliente,
        entrada(),
        lote([inicioSet(), ev('SUBSTITUICAO', { equipe: 'A', trocas: [{ sai: 1, entra: 7 }, { sai: 2, entra: 8 }] })], 0),
        ORIGEM,
      ),
    )
    assert.equal(r.rejeitados.length, 0, JSON.stringify(r.rejeitados))
    assert.equal(r.estado.contadores.A?.substituicoesRegulares, 2)
    assert.deepEqual(r.estado.rotacao.A, [7, 8, 3, 4, 5, 6])
    const duas = processado(
      await processarLote(banco.cliente, entrada(), lote([ev('SUBSTITUICAO', { equipe: 'A', sai: 3, entra: 9, trocas: [{ sai: 4, entra: 10 }] })]), ORIGEM),
    )
    assert.equal(duas.rejeitados[0]?.codigo, 'RG-LOG-011', 'o payload é conferido evento a evento')
    const r2 = processado(await processarLote(banco.cliente, entrada(), lote([ev('SUBSTITUICAO', { equipe: 'A' })]), ORIGEM))
    assert.equal(r2.rejeitados[0]?.codigo, 'RG-LOG-011')
  })

  await caso('RG-SUB-007: lote com uma troca inválida é recusado inteiro e nada é gravado', async () => {
    const banco = novoBanco()
    processado(await processarLote(banco.cliente, entrada(), lote([inicioSet()], 0), ORIGEM))
    const r = processado(
      await processarLote(banco.cliente, entrada(), lote([ev('SUBSTITUICAO', { equipe: 'A', trocas: [{ sai: 1, entra: 7 }, { sai: 2, entra: 99 }] })]), ORIGEM),
    )
    assert.equal(r.aceitos.length, 0)
    assert.equal(r.rejeitados[0]?.codigo, 'RG-FOR-009')
    assert.equal(banco.linhas.length, 1)
  })

  await caso('RG-FOR-008: o servidor aplica a discrepância de papeleta e devolve a rotação refeita', async () => {
    const banco = novoBanco()
    const r = processado(
      await processarLote(
        banco.cliente,
        entrada(),
        lote([inicioSet(), ponto('B'), ponto('A'), ev('DISCREPANCIA_PAPELETA', { equipe: 'A', fase: 'DEPOIS_DO_INICIO', causa: 'POSICAO', momentoSeq: 3 })], 0),
        ORIGEM,
      ),
    )
    assert.equal(r.rejeitados.length, 0, JSON.stringify(r.rejeitados))
    assert.deepEqual(r.estado.rotacao.A, [1, 2, 3, 4, 5, 6])
    assert.equal(r.estado.saca, 'B')
  })

  await caso('RG-PRO-002: depois do WO o servidor ainda aceita o registro do protesto, mas não pontos', async () => {
    const banco = novoBanco()
    const r = processado(
      await processarLote(
        banco.cliente,
        entrada(),
        lote([inicioSet(), ev('PROTESTO_ANUNCIADO', { equipe: 'B' }), ev('WO', { ausente: 'B' }), ev('PROTESTO_REGISTRADO', { equipe: 'B', relato: 'Discordo.' }), ponto('A')], 0),
        ORIGEM,
      ),
    )
    assert.deepEqual(r.aceitos.map((a) => a.seq), [1, 2, 3, 4])
    assert.equal(r.rejeitados[0]?.codigo, 'RG-WO-001')
  })

  await caso('RG-WO-002: com horário previsto e horário atual o servidor confere a tolerância do regulamento', () => {
    const config = { ...configDaPartida({ setsPorPartida: 3 }), toleranciaWOMinutos: 20 }
    const contexto = { elenco: entrada().contexto.elenco, horarioPrevisto: '2026-10-16T19:00:00.000Z' }
    const wo = { clientEventId: randomUUID(), tipo: 'WO' as const, payload: { ausente: 'B' } }
    const cedo = validarNovoEvento([], config, contexto, wo, '2026-10-16T19:10:00.000Z')
    assert.equal(cedo.ok, false)
    if (!cedo.ok) assert.equal(cedo.codigo, 'RG-WO-002')
    assert.equal(validarNovoEvento([], config, contexto, wo, '2026-10-16T19:25:00.000Z').ok, true)
    assert.equal(validarNovoEvento([], config, contexto, wo).ok, true, 'sem horário atual a conferência não é feita')
  })

  if (falhas.length > 0) {
    console.error(`\nsumula-eventos.test.ts: ${falhas.length} de ${total} casos falharam.`)
    process.exit(1)
  }
  console.log(`\nsumula-eventos.test.ts: ${total} casos ok.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
