import assert from 'node:assert/strict'
import {
  botaoEnviarPapeleta,
  botaoPedido,
  partidaEncerrada,
  podeCancelarPedido,
  usoDeLimites,
  validarSubstituicaoLocal,
} from '../src/lib/banco-ui/botoes'
import { classificarFalha, extrairViolacoes, formatarPlacar, MENSAGEM_LIMITE, mensagemDeErro, nomeDoLado, TEXTO_TELA } from '../src/lib/banco-ui/falhas'
import {
  admiteSegundoLibero,
  agruparViolacoes,
  camisasRepetidas,
  colocarJogador,
  corpoDaPapeleta,
  definirCapitao,
  definirLibero,
  definirLibero2,
  formacaoCompleta,
  motivoNaoPodeEnviar,
  rascunhoDaPapeleta,
  rascunhoVazio,
  validarFormacaoLocal,
} from '../src/lib/banco-ui/formacao'
import { formatarHora, intervaloPolling, semConexao, textoAtualizado } from '../src/lib/banco-ui/polling'
import { setPadrao, setsDisponiveis } from '../src/lib/banco-ui/sets'
import { chaveRascunho, gravarRascunho, interpretarRascunho, lerRascunho } from '../src/lib/banco-ui/rascunho-local'
import type { JogadorBanco, PedidoBanco, VisaoBanco } from '../src/lib/banco-ui/tipos'

let total = 0
function caso(nome: string, fn: () => void) {
  total += 1
  try {
    fn()
    console.log(`  ok  ${nome}`)
  } catch (e) {
    console.error(`  FALHOU  ${nome}`)
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 1
  }
}

const elenco: JogadorBanco[] = Array.from({ length: 9 }, (_, i) => ({ jogadorId: 100 + i, nome: `Atleta ${i + 1}`, numero: i + 1 }))

function completo() {
  let r = rascunhoVazio()
  for (let p = 1; p <= 6; p += 1) r = colocarJogador(r, p, 100 + p - 1)
  return r
}

caso('formação vazia lista as 6 posições faltando e não está pronta', () => {
  const v = validarFormacaoLocal(rascunhoVazio(), elenco)
  assert.equal(v.pronta, false)
  assert.deepEqual(v.faltando, [1, 2, 3, 4, 5, 6])
  assert.match(motivoNaoPodeEnviar(v) ?? '', /Faltam as posições/)
})

caso('formação completa e válida está pronta', () => {
  const v = validarFormacaoLocal(definirCapitao(definirLibero(completo(), 107), 100), elenco)
  assert.equal(v.pronta, true)
  assert.equal(motivoNaoPodeEnviar(v), null)
})

caso('colocar jogador já escalado em outra posição troca as duas', () => {
  const r = colocarJogador(completo(), 1, 101)
  assert.equal(r.slots[1], 101)
  assert.equal(r.slots[2], 100)
  assert.equal(formacaoCompleta(r), true)
})

caso('escalar o líbero como titular remove a marca de líbero', () => {
  const r = colocarJogador(definirLibero(completo(), 107), 1, 107)
  assert.equal(r.liberoId, null)
})

caso('líbero entre os titulares é violação explicada', () => {
  const v = validarFormacaoLocal(definirLibero(completo(), 100), elenco)
  assert.equal(v.pronta, false)
  assert.equal(v.violacoes[0]?.codigo, 'RG-LIB-003')
  assert.match(v.violacoes[0]!.mensagem, /líbero/)
})

caso('capitão líbero e jogador fora do elenco são violações', () => {
  const a = validarFormacaoLocal(definirCapitao(definirLibero(completo(), 107), 107), elenco)
  assert.equal(a.pronta, false)
  const b = validarFormacaoLocal(definirCapitao(completo(), 999), elenco)
  assert.equal(b.violacoes[0]?.codigo, 'RG-ELE-005')
  const c = validarFormacaoLocal(colocarJogador(completo(), 3, 999), elenco)
  assert.ok(c.violacoes.some((x) => /elenco/.test(x.mensagem)))
})

caso('jogador repetido (estado adulterado) é violação', () => {
  const r = completo()
  r.slots[2] = r.slots[1] ?? null
  const v = validarFormacaoLocal(r, elenco)
  assert.equal(v.violacoes[0]?.codigo, 'RG-FOR-005')
})

caso('corpo do PUT só existe com 6 posições e inclui líbero e capitão', () => {
  assert.equal(corpoDaPapeleta(rascunhoVazio()), null)
  const corpo = corpoDaPapeleta(definirCapitao(definirLibero(completo(), 107), 100))
  assert.equal(corpo?.formacao.length, 6)
  assert.equal(corpo?.liberoId, 107)
  assert.equal(corpo?.capitaoId, 100)
})

caso('rascunho nasce da papeleta do servidor', () => {
  const r = rascunhoDaPapeleta({
    setNumero: 1,
    estado: 'RASCUNHO',
    formacao: [{ posicao: 4, jogadorId: 100 }],
    liberoId: 107,
    capitaoId: null,
  })
  assert.equal(r.slots[4], 100)
  assert.equal(r.slots[1], null)
  assert.equal(r.liberoId, 107)
})

caso('papeleta devolvida com libero2Id repopula o segundo libero e volta no corpo do PUT', () => {
  const r = rascunhoDaPapeleta({
    setNumero: 1,
    estado: 'RASCUNHO',
    formacao: [1, 2, 3, 4, 5, 6].map((posicao) => ({ posicao, jogadorId: 100 + posicao })),
    liberoId: 107,
    libero2Id: 108,
    capitaoId: null,
  })
  assert.equal(r.libero2Id, 108)
  assert.equal(corpoDaPapeleta(r)?.libero2Id, 108)
  const sem = rascunhoDaPapeleta({ setNumero: 1, estado: 'RASCUNHO', formacao: [], liberoId: 107, capitaoId: null })
  assert.equal(sem.libero2Id, null)
  assert.equal(corpoDaPapeleta({ ...r, libero2Id: null })?.libero2Id, undefined)
})

const pedido = (p: Partial<PedidoBanco>): PedidoBanco => ({ id: 1, tipo: 'TEMPO', estado: 'PENDENTE', payload: null, criadoEm: '', ...p })
const visao = (pedidos: PedidoBanco[], status = 'EM_ANDAMENTO'): Pick<VisaoBanco, 'pedidos' | 'limites' | 'partida'> => ({
  pedidos,
  limites: { tempos: 2, substituicoes: 6 },
  partida: { id: 1, equipeA: 'A', equipeB: 'B', status, placar: null },
})

caso('botão de tempo: livre, pendente, limite e partida encerrada', () => {
  const base = { tipo: 'TEMPO' as const, enviando: false, semConexao: false }
  assert.equal(botaoPedido({ ...base, visao: visao([]) }).habilitado, true)
  assert.match(botaoPedido({ ...base, visao: visao([pedido({})]) }).motivo ?? '', /aguardando/)
  // limite é por set e fica no servidor: a tela não bloqueia pelo total da partida
  assert.equal(botaoPedido({ ...base, visao: visao([pedido({ id: 1, estado: 'ACEITO' }), pedido({ id: 2, estado: 'ACEITO' })]) }).habilitado, true)
  assert.equal(botaoPedido({ ...base, visao: visao([], 'ENCERRADA') }).habilitado, false)
  assert.equal(botaoPedido({ ...base, visao: visao([]), semConexao: true }).habilitado, false)
})

caso('pedidos recusados e cancelados não contam no limite', () => {
  const uso = usoDeLimites([pedido({ estado: 'RECUSADO' }), pedido({ id: 2, estado: 'CANCELADO' }), pedido({ id: 3, tipo: 'SUBSTITUICAO', estado: 'ACEITO' })])
  assert.deepEqual(uso, { tempos: 0, substituicoes: 1 })
})

caso('só pedido pendente pode ser cancelado', () => {
  assert.equal(podeCancelarPedido(pedido({})), true)
  assert.equal(podeCancelarPedido(pedido({ estado: 'ACEITO' })), false)
})

caso('substituição exige quem sai, quem entra e jogadores diferentes', () => {
  assert.equal(validarSubstituicaoLocal(null, 1), 'Escolha quem sai.')
  assert.equal(validarSubstituicaoLocal(1, null), 'Escolha quem entra.')
  assert.match(validarSubstituicaoLocal(1, 1) ?? '', /diferentes/)
  assert.equal(validarSubstituicaoLocal(1, 2), null)
})

caso('botão enviar papeleta: travado depois de enviada, aceita, offline, incompleta', () => {
  const base = { estado: 'RASCUNHO' as const, pronta: true, motivoPendencia: null, enviando: false, encerrada: false, semConexao: false }
  assert.equal(botaoEnviarPapeleta(base).habilitado, true)
  assert.match(botaoEnviarPapeleta({ ...base, estado: 'ENVIADA' }).motivo ?? '', /não muda/)
  assert.match(botaoEnviarPapeleta({ ...base, estado: 'ACEITA' }).motivo ?? '', /aceita/)
  assert.equal(botaoEnviarPapeleta({ ...base, semConexao: true }).habilitado, false)
  assert.equal(botaoEnviarPapeleta({ ...base, pronta: false, motivoPendencia: 'Falta X' }).motivo, 'Falta X')
})

caso('polling: 3 s, recuo dobrando até 30 s e sem conexão a partir de 2 falhas', () => {
  assert.equal(intervaloPolling(0), 3000)
  assert.equal(intervaloPolling(1), 6000)
  assert.equal(intervaloPolling(2), 12000)
  assert.equal(intervaloPolling(3), 24000)
  assert.equal(intervaloPolling(4), 30000)
  assert.equal(intervaloPolling(99), 30000)
  assert.equal(intervaloPolling(-5), 3000)
  assert.equal(semConexao(1), false)
  assert.equal(semConexao(2), true)
})

caso('texto "atualizado às hh:mm"', () => {
  assert.equal(formatarHora(new Date(2026, 0, 1, 9, 5)), '09:05')
  assert.equal(textoAtualizado(new Date(2026, 0, 1, 21, 30)), 'atualizado às 21:30')
  assert.equal(textoAtualizado(null), 'atualizando...')
})

caso('classificação de falhas: 404, 503, 410, 401 e rede', () => {
  assert.equal(classificarFalha(404), 'desligado')
  assert.equal(classificarFalha(503), 'nao-habilitado')
  assert.equal(classificarFalha(410), 'expirado')
  assert.equal(classificarFalha(401), 'token-invalido')
  assert.equal(classificarFalha(null), 'rede')
  assert.equal(classificarFalha(500), 'erro')
})

caso('violações e mensagens de erro em formatos diferentes de envelope', () => {
  assert.deepEqual(extrairViolacoes({ violacoes: [{ codigo: 'RG-X-1', mensagem: 'm' }] }), [{ codigo: 'RG-X-1', mensagem: 'm' }])
  assert.equal(extrairViolacoes({ data: { violacoes: [{ mensagem: 'm' }] } })[0]?.mensagem, 'm')
  assert.deepEqual(extrairViolacoes(null), [])
  assert.equal(mensagemDeErro({ error: 'falhou' }, 'padrão'), 'falhou')
  assert.equal(mensagemDeErro({}, 'padrão'), 'padrão')
})

caso('placar e nome do lado tolerantes ao formato', () => {
  assert.equal(nomeDoLado({ nome: 'Time' }), 'Time')
  assert.equal(nomeDoLado('Time'), 'Time')
  assert.deepEqual(formatarPlacar({ setsA: 1, setsB: 0, pontosA: 12, pontosB: 9 }), { sets: '1 x 0', pontos: '12 x 9' })
  assert.deepEqual(formatarPlacar({ a: 3, b: 2 }), { sets: null, pontos: '3 x 2' })
  assert.equal(formatarPlacar(null), null)
  assert.equal(formatarPlacar({ x: 1 }), null)
})

caso('rascunho local: grava, lê, ignora lixo e sobrevive a storage que lança', () => {
  const mem: Record<string, string> = {}
  const storage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => void (mem[k] = v) }
  const r = definirLibero(completo(), 107)
  assert.equal(gravarRascunho('tok', 2, r, storage), true)
  assert.ok(mem[chaveRascunho('tok', 2)])
  assert.deepEqual(lerRascunho('tok', 2, storage), r)
  assert.equal(lerRascunho('tok', 3, storage), null)
  assert.equal(interpretarRascunho('{quebrado'), null)
  assert.equal(interpretarRascunho('{"slots":{"1":"x"}}')?.slots[1], null)
  const explode = {
    getItem: () => {
      throw new Error('negado')
    },
    setItem: () => {
      throw new Error('cota')
    },
  }
  assert.equal(lerRascunho('tok', 1, explode), null)
  assert.equal(gravarRascunho('tok', 1, r, explode), false)
})

caso('sets: mostra os existentes mais o próximo e abre o primeiro não aceito', () => {
  const p = (setNumero: number, estado: 'RASCUNHO' | 'ENVIADA' | 'ACEITA') => ({ setNumero, estado, formacao: [], liberoId: null, capitaoId: null })
  assert.deepEqual(setsDisponiveis([]), [1])
  assert.equal(setPadrao([]), 1)
  assert.deepEqual(setsDisponiveis([p(1, 'ACEITA')]), [1, 2])
  assert.equal(setPadrao([p(1, 'ACEITA')]), 2)
  assert.equal(setPadrao([p(1, 'ACEITA'), p(2, 'RASCUNHO')]), 2)
  assert.deepEqual(setsDisponiveis([p(5, 'ACEITA')]), [5])
})

caso('F6: capitão fora dos 6 titulares é aceito se estiver no elenco', () => {
  const v = validarFormacaoLocal(definirCapitao(completo(), 108), elenco)
  assert.equal(v.pronta, true)
})

caso('F6: camisa repetida entre participantes é problema de ELENCO', () => {
  const dup: JogadorBanco[] = elenco.map((j) => (j.jogadorId === 101 ? { ...j, numero: 1 } : j))
  const v = validarFormacaoLocal(completo(), dup)
  assert.equal(v.pronta, false)
  const cam = v.violacoes.find((x) => x.codigo === 'CAMISA_REPETIDA')
  assert.ok(cam)
  assert.equal(cam!.grupo, 'elenco')
  assert.match(cam!.mensagem, /camisa 1/)
  // camisa repetida de quem não participa não bloqueia
  const dupFora: JogadorBanco[] = elenco.map((j) => (j.jogadorId === 108 ? { ...j, numero: 8 } : j.jogadorId === 107 ? { ...j, numero: 8 } : j))
  assert.equal(validarFormacaoLocal(completo(), dupFora).pronta, true)
  assert.deepEqual(camisasRepetidas([100, 101], dup), [{ numero: 1, nomes: ['Atleta 1', 'Atleta 2'] }])
})

caso('F6: erros de elenco e de formação ficam separados', () => {
  const r = definirLibero(colocarJogador(completo(), 3, 999), 100)
  const g = agruparViolacoes(validarFormacaoLocal(r, elenco).violacoes)
  assert.ok(g.elenco.some((x) => /não consta no elenco/.test(x.mensagem)))
  assert.ok(g.formacao.some((x) => x.codigo === 'RG-LIB-003'))
  assert.equal(g.outras.length, 0)
  const servidor = agruparViolacoes([{ codigo: 'X', mensagem: 'do servidor' }])
  assert.equal(servidor.outras.length, 1)
})

caso('F6: segundo líbero só com elenco acima de 12', () => {
  assert.equal(admiteSegundoLibero(elenco), false)
  const grande: JogadorBanco[] = Array.from({ length: 14 }, (_, i) => ({ jogadorId: 100 + i, nome: `Atleta ${i + 1}`, numero: i + 1 }))
  assert.equal(admiteSegundoLibero(grande), true)
  const ok = validarFormacaoLocal(definirLibero2(definirLibero(completo(), 107), 108), grande)
  assert.equal(ok.pronta, true)
  assert.equal(corpoDaPapeleta(definirLibero2(definirLibero(completo(), 107), 108))?.libero2Id, 108)
  // elenco pequeno: recusa o segundo líbero
  assert.equal(validarFormacaoLocal(definirLibero2(definirLibero(completo(), 107), 108), elenco).pronta, false)
  // mesmo líbero duas vezes, ou segundo titular
  assert.equal(validarFormacaoLocal(definirLibero2(definirLibero(completo(), 107), 107), grande).pronta, false)
  assert.equal(validarFormacaoLocal(definirLibero2(definirLibero(completo(), 107), 100), grande).pronta, false)
  // opcional: sem segundo líbero não aparece no corpo
  assert.equal(corpoDaPapeleta(definirLibero(completo(), 107))?.libero2Id, undefined)
})

caso('F6: partida encerrada inclui WO, ENCERRADA e CANCELADA', () => {
  for (const s of ['WO', 'wo', 'ENCERRADA', 'CANCELADA', 'FINALIZADA']) assert.equal(partidaEncerrada(s), true, s)
  assert.equal(partidaEncerrada('EM_ANDAMENTO'), false)
})

caso('F11: 429 vira "Muitas consultas, aguardando" e não "Algo deu errado"', () => {
  assert.equal(classificarFalha(429), 'limite')
  assert.equal(TEXTO_TELA.limite.titulo, 'Muitas consultas, aguardando')
  assert.notEqual(TEXTO_TELA.limite.titulo, TEXTO_TELA.erro.titulo)
  assert.match(MENSAGEM_LIMITE, /Muitas consultas, aguardando/)
  // recuo crescente entre as tentativas
  assert.ok(intervaloPolling(3) > intervaloPolling(1))
})

console.log(`\nbanco-ui: ${total} casos executados.`)
