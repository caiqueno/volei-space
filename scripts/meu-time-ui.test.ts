import assert from 'node:assert/strict'
import { criarClienteHttp, criarClienteMemoria, ErroMeuTime } from '../src/components/meu-time/cliente'
import { classificarFalha, descreverStatusInscricao } from '../src/lib/meu-time-ui/respostas'
import {
  alternarAtleta,
  avaliarElegibilidade,
  avisosDeEnvio,
  dataNascimentoValida,
  definirCapitao,
  definirLibero,
  definirNumero,
  lerRegras,
  montarInscricao,
  problemasDeEnvio,
  REGRAS_PADRAO,
  resumirSelecao,
  type Escolha,
} from '../src/lib/meu-time-ui/selecao'
import {
  guardarRascunho,
  carregarRascunho,
  lerRascunho,
  reconciliarRascunho,
  rascunhoVazio,
  serializarRascunho,
} from '../src/lib/meu-time-ui/rascunho'
import { prepararLista } from '../src/lib/meu-time-ui/lista-colada'
import type { Atleta } from '../src/lib/meu-time-ui/tipos'

const atleta = (id: string, nome: string, extra: Partial<Atleta> = {}): Atleta => ({
  id, nome, dataNascimento: '2000-05-10', numeroPreferido: null, posicao: null, temDocumento: true, ...extra,
})

async function main() {
  // --- contador
  let escolhas: Escolha[] = []
  const atletas = Array.from({ length: 10 }, (_, i) => atleta(`a${i}`, `Atleta ${i}`, { numeroPreferido: i + 1 }))
  for (const a of atletas) escolhas = alternarAtleta(escolhas, a)
  escolhas = definirLibero(escolhas, 'a0')
  assert.equal(resumirSelecao(escolhas, REGRAS_PADRAO).texto, '10 selecionados · mínimo 6 · máximo 14 · líberos 1 de 2')
  assert.equal(resumirSelecao([], REGRAS_PADRAO).situacao, 'abaixo')
  assert.equal(resumirSelecao(escolhas, { ...REGRAS_PADRAO, maximo: 8 }).situacao, 'acima')
  assert.equal(resumirSelecao(escolhas.slice(0, 1), REGRAS_PADRAO).texto.startsWith('1 selecionado ·'), true)

  // --- camisa sugerida do banco e desmarcar
  assert.equal(escolhas[3].numero, '4')
  assert.equal(alternarAtleta(escolhas, atletas[3]).length, 9)
  const repetida = alternarAtleta([{ atletaId: 'x', numero: '5', capitao: false, libero: false }], atleta('y', 'Y', { numeroPreferido: 5 }))
  assert.equal(repetida[1].numero, '')

  // --- capitão único e número só com dígitos
  escolhas = definirCapitao(escolhas, 'a1')
  escolhas = definirCapitao(escolhas, 'a2')
  assert.deepEqual(escolhas.filter((e) => e.capitao).map((e) => e.atletaId), ['a2'])
  assert.equal(definirCapitao(escolhas, 'a2').some((e) => e.capitao), false)
  assert.equal(definirNumero(escolhas, 'a0', '1x2').find((e) => e.atletaId === 'a0')?.numero, '12')

  // --- problemas de envio
  assert.deepEqual(problemasDeEnvio(escolhas, atletas, REGRAS_PADRAO), [])
  const poucos = problemasDeEnvio(escolhas.slice(0, 4), atletas, REGRAS_PADRAO)
  assert.match(poucos[0].mensagem, /Faltam 2 atletas\. Esta categoria precisa de pelo menos 6\./)
  const muitos = problemasDeEnvio(escolhas, atletas, { ...REGRAS_PADRAO, maximo: 8 })
  assert.match(muitos[0].mensagem, /Você marcou 10\. O máximo é 8\. Desmarque 2\./)
  const liberos = definirLibero(definirLibero(escolhas, 'a1'), 'a3')
  assert.ok(problemasDeEnvio(liberos, atletas, REGRAS_PADRAO).some((p) => /3 líberos.*aceita 2/.test(p.mensagem)))
  const dup = definirNumero(escolhas, 'a1', '1')
  assert.ok(problemasDeEnvio(dup, atletas, REGRAS_PADRAO).some((p) => p.atletaId === 'a1' && /A camisa 1 já está com Atleta 0/.test(p.mensagem)))
  const semNumero = definirNumero(escolhas, 'a5', '')
  assert.ok(problemasDeEnvio(semNumero, atletas, REGRAS_PADRAO).some((p) => p.atletaId === 'a5' && /Falta a camisa/.test(p.mensagem)))
  const liberoCapitao = definirLibero(definirCapitao(escolhas, 'a4'), 'a4')
  assert.ok(problemasDeEnvio(liberoCapitao, atletas, REGRAS_PADRAO).some((p) => /líbero e não pode ser capitão/.test(p.mensagem)))
  assert.deepEqual(problemasDeEnvio(definirNumero(escolhas, 'a1', '0'), atletas, REGRAS_PADRAO).map((p) => p.atletaId), ['a1'])

  // --- avisos e elegibilidade
  assert.ok(avisosDeEnvio(escolhas, atletas, REGRAS_PADRAO).length === 0)
  assert.ok(avisosDeEnvio(escolhas.map((e) => ({ ...e, capitao: false })), atletas, REGRAS_PADRAO)[0].startsWith('Nenhum capitão'))
  const sub17 = { ...REGRAS_PADRAO, anoMinimo: 2008, anoMaximo: 2012 }
  assert.deepEqual(avaliarElegibilidade(atleta('z', 'Zé', { dataNascimento: '2010-01-01' }), sub17), { elegivel: true })
  const velho = avaliarElegibilidade(atleta('z', 'Zé', { dataNascimento: '2000-01-01' }), sub17)
  assert.equal(velho.elegivel, false)
  assert.match(velho.elegivel ? '' : velho.motivo, /Zé nasceu em 2000\. Nesta categoria só podem jogar atletas nascidos de 2008 a 2012\./)
  const semData = avaliarElegibilidade(atleta('z', 'Zé', { dataNascimento: null }), sub17)
  assert.match(semData.elegivel ? '' : semData.motivo, /Falta a data de nascimento de Zé/)
  assert.deepEqual(avaliarElegibilidade(atleta('z', 'Zé', { dataNascimento: null }), REGRAS_PADRAO), { elegivel: true })

  // --- regras da URL e datas
  assert.deepEqual(lerRegras(() => null), { ...REGRAS_PADRAO, anoMinimo: undefined, anoMaximo: undefined })
  const params: Record<string, string> = { min: '4', max: '12', liberos: '1', anoMin: '2008' }
  assert.deepEqual(lerRegras((c) => params[c]), { minimo: 4, maximo: 12, maxLiberos: 1, anoMinimo: 2008, anoMaximo: undefined })
  assert.equal(lerRegras((c) => ({ min: '9', max: '3' } as Record<string, string>)[c]).maximo, 9)
  assert.equal(dataNascimentoValida('2000-02-30'), false)
  assert.equal(dataNascimentoValida('2000-02-29'), true)
  assert.equal(dataNascimentoValida('2999-01-01'), false)
  assert.equal(dataNascimentoValida('10/05/2000'), false)

  // --- payload
  const corpo = montarInscricao('cat1', definirCapitao(escolhas.slice(0, 2), 'a1'), ['cm1'])
  assert.deepEqual(corpo, {
    categoriaCampeonatoId: 'cat1',
    atletas: [{ atletaId: 'a0', numero: 1, libero: true }, { atletaId: 'a1', numero: 2, capitao: true }],
    comissao: ['cm1'],
  })
  assert.equal('comissao' in montarInscricao('c', escolhas, []), false)

  // --- rascunho
  const rascunho = { ...rascunhoVazio(), passo: 2 as const, escolhas: escolhas.slice(0, 2), comissao: ['cm1', 'cm9'] }
  assert.deepEqual(lerRascunho(serializarRascunho(rascunho)), rascunho)
  assert.equal(lerRascunho('{lixo'), null)
  assert.equal(lerRascunho(JSON.stringify({ versao: 2 })), null)
  assert.equal(lerRascunho(JSON.stringify({ versao: 1, passo: 9, escolhas: [], comissao: [] })), null)
  assert.equal(lerRascunho(JSON.stringify({ versao: 1, passo: 1, escolhas: [{ atletaId: 1 }], comissao: [] })), null)
  const limpo = reconciliarRascunho(rascunho, [atletas[0]], [{ id: 'cm1', nome: 'T', funcao: 'Técnico' }])
  assert.deepEqual(limpo.escolhas.map((e) => e.atletaId), ['a0'])
  assert.deepEqual(limpo.comissao, ['cm1'])
  const memoria = new Map<string, string>()
  const loja = { getItem: (k: string) => memoria.get(k) ?? null, setItem: (k: string, v: string) => void memoria.set(k, v), removeItem: (k: string) => void memoria.delete(k) }
  assert.equal(guardarRascunho('k', rascunho, loja), true)
  assert.deepEqual(carregarRascunho('k', loja), rascunho)
  const quebrada = { getItem: () => { throw new Error('bloqueado') }, setItem: () => { throw new Error('cheio') }, removeItem: () => { throw new Error('x') } }
  assert.equal(guardarRascunho('k', rascunho, quebrada), false)
  assert.equal(carregarRascunho('k', quebrada), null)
  assert.equal(guardarRascunho('k', rascunho, null), false)

  // --- lista colada
  const existentes = [atleta('e1', 'João Silva', { numeroPreferido: 7 })]
  const preparo = prepararLista('João Silva, 7\nMaria Souza, 10\nAna Lima\nPedro 7\n???', existentes)
  assert.deepEqual(preparo.payload, [{ nome: 'Maria Souza', numero: 10 }, { nome: 'Ana Lima' }])
  assert.equal(preparo.semNumero, 1)
  assert.deepEqual(preparo.repetidos.map((r) => r.motivo), ['Já está no elenco', 'Camisa 7 já usada'])
  assert.equal(preparo.ignoradas.length, 1)

  // --- respostas
  assert.equal(classificarFalha(503, { error: 'Meu Time ainda não habilitado' }).tipo, 'nao-habilitado')
  assert.match(classificarFalha(503, null).mensagem, /ainda não está habilitado/)
  assert.equal(classificarFalha(401, null).tipo, 'sem-sessao')
  assert.equal(classificarFalha(422, { error: 'Informe o nome do time.' }).mensagem, 'Informe o nome do time.')
  assert.doesNotMatch(classificarFalha(422, { error: 'Prisma error: bucket' }).mensagem, /Prisma|bucket/)
  assert.doesNotMatch(classificarFalha(500, { error: 'Erro interno SQL' }).mensagem, /SQL/)
  assert.equal(descreverStatusInscricao('CONFIRMADA').rotulo, 'Inscrição confirmada')
  assert.equal(descreverStatusInscricao('REMOVIDA').tom, 'erro')

  // --- cliente HTTP com fetch falso
  const chamadas: Array<{ url: string; metodo?: string; corpo?: string }> = []
  const resposta = (status: number, json: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => json }) as Response
  const http = criarClienteHttp(async (url, init) => {
    chamadas.push({ url: String(url), metodo: init?.method, corpo: init?.body as string | undefined })
    if (String(url) === '/api/meu-time') return resposta(200, { data: { equipes: [] } })
    if (String(url).endsWith('/inscricoes')) return resposta(201, { data: { id: 'i1', categoriaCampeonatoId: 'c', status: 'CONFIRMADA', totalAtletas: 6 }, avisos: ['Atenção'] })
    if (String(url).endsWith('/lote')) return resposta(200, { data: { criados: 1, ignorados: [] } })
    if (String(url).includes('/ruim')) return resposta(503, { error: 'Meu Time ainda não habilitado' })
    if (String(url).includes('/lixo')) return resposta(200, { semData: true })
    throw new TypeError('Failed to fetch')
  })
  assert.deepEqual(await http.listarEquipes(), [])
  const insc = await http.inscrever('e 1', { categoriaCampeonatoId: 'c', atletas: [{ atletaId: 'a', numero: 1 }] })
  assert.deepEqual(insc.avisos, ['Atenção'])
  assert.equal(chamadas.at(-1)?.url, '/api/meu-time/equipes/e%201/inscricoes')
  assert.equal(chamadas.at(-1)?.metodo, 'POST')
  await http.adicionarAtletasEmLote('e1', [{ nome: 'Ana' }])
  assert.equal(chamadas.at(-1)?.corpo, JSON.stringify({ atletas: [{ nome: 'Ana' }] }))
  await assert.rejects(http.obterEquipe('ruim'), (e) => e instanceof ErroMeuTime && e.falha.tipo === 'nao-habilitado')
  await assert.rejects(http.obterEquipe('lixo'), (e) => e instanceof ErroMeuTime && e.falha.tipo === 'outro')
  await assert.rejects(http.obterEquipe('x'), (e) => e instanceof ErroMeuTime && e.falha.tipo === 'rede')

  // --- cliente em memória
  const mem = criarClienteMemoria()
  const time = await mem.criarEquipe({ nome: 'Vôlei Norte', cidade: 'Manaus', naipe: 'MISTO' })
  await mem.adicionarAtleta(time.id, { nome: 'Ana', dataNascimento: '2000-01-01' })
  await mem.adicionarAtletasEmLote(time.id, [{ nome: 'Bia', numero: 3 }, { nome: 'ana' }])
  const detalhe = await mem.obterEquipe(time.id)
  assert.equal(detalhe.atletas.length, 2)
  assert.equal(detalhe.prontidao.mensagem, 'Seu time tem 2 atletas. 2 estão sem documento.')
  assert.equal((await mem.listarEquipes())[0].totalAtletas, 2)
  await assert.rejects(criarClienteMemoria({ naoHabilitado: true }).listarEquipes(), (e) => e instanceof ErroMeuTime && e.falha.status === 503)
  await assert.rejects(mem.obterEquipe('nada'), (e) => e instanceof ErroMeuTime && e.falha.tipo === 'nao-encontrado')

  console.log('meu-time-ui: ok')
}

main().catch((erro) => {
  console.error(erro)
  process.exit(1)
})
