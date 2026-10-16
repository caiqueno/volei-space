import assert from 'node:assert/strict'
import { criarClienteHttp, criarClienteMemoria, ErroMeuTime } from '../src/components/meu-time/cliente'
import { classificarFalha, descreverStatusInscricao, normalizarRegrasCategoria } from '../src/lib/meu-time-ui/respostas'
import {
  alternarAtleta,
  avaliarElegibilidade,
  avisosDeEnvio,
  contarSemNascimento,
  faltaNascimento,
  regrasDeCategoria,
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
import { rotuloFuncao, rotuloPosicao } from '../src/components/meu-time/rotulos'
import { validarEdicaoTime, validarMembroComissao, validarNovoAcesso, validarNovoAtleta, validarNovoTime } from '../src/lib/meu-time-ui/formularios'
import { hrefInscricao } from '../src/lib/meu-time-ui/navegacao'
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

  // --- formulários e navegação
  assert.deepEqual(validarNovoTime({ nome: '  Vôlei   Norte ', cidade: ' Manaus ', naipe: 'MISTO', escudoUrl: '' }), { valido: true, dados: { nome: 'Vôlei Norte', naipe: 'MISTO', cidade: 'Manaus' }, erros: {} })
  const timeRuim = validarNovoTime({ nome: 'A', cidade: '', naipe: '', escudoUrl: 'javascript:alert(1)' })
  assert.equal(timeRuim.valido, false)
  assert.deepEqual(Object.keys(timeRuim.erros).sort(), ['escudoUrl', 'naipe', 'nome'])
  const atletaOk = validarNovoAtleta({ nome: 'Ana', dataNascimento: '2000-01-02', numero: '7', posicao: 'LB' })
  assert.deepEqual(atletaOk.valido && atletaOk.dados, { nome: 'Ana', dataNascimento: '2000-01-02', numeroPreferido: 7, posicao: 'LB' })
  assert.deepEqual(Object.keys(validarNovoAtleta({ nome: '', dataNascimento: '', numero: '100', posicao: '' }).erros).sort(), ['dataNascimento', 'nome', 'numero'])
  assert.equal(validarNovoAtleta({ nome: 'Ana', dataNascimento: '2000-01-02', numero: '0', posicao: '' }).valido, false)
  assert.equal(validarMembroComissao({ nome: 'Rui', funcao: '' }).valido, false)
  assert.equal(validarMembroComissao({ nome: 'Rui', funcao: 'TECNICO' }).valido, true)
  assert.equal(hrefInscricao('e 1', () => null), undefined)
  const convite: Record<string, string> = { categoria: 'c1', min: '6', lixo: 'x' }
  assert.equal(hrefInscricao('e 1', (c) => convite[c]), '/meu-time/e%201/inscrever?categoria=c1&min=6')
  assert.ok(problemasDeEnvio(dup, atletas, REGRAS_PADRAO).some((p) => p.codigo === 'repetida'))

  // --- R3: mensagens por status e código
  assert.match(classificarFalha(401, null).mensagem, /Entre na sua conta/)
  assert.match(classificarFalha(403, null).mensagem, /permissão/)
  assert.match(classificarFalha(404, { error: 'Não encontrado.' }).mensagem, /Não encontramos/)
  assert.match(classificarFalha(409, { codigo: 'EQUIPE_DUPLICADA', error: 'x' }).mensagem, /já tem um time com esse nome/)
  assert.match(classificarFalha(404, { codigo: 'CONTA_NAO_ENCONTRADA' }).mensagem, /criar a conta/)
  assert.match(classificarFalha(503, { codigo: 'EQUIPE_DUPLICADA' }).mensagem, /ainda não está habilitado/)
  const f422 = classificarFalha(422, { error: 'Corrija', erros: [{ mensagem: 'Faltam 2 atletas.' }, { mensagem: 'Erro SQL' }, { codigo: 'x' }] })
  assert.deepEqual(f422.detalhes, ['Faltam 2 atletas.'])

  // --- R3: formulários novos
  assert.deepEqual(validarEdicaoTime({ nome: ' Vôlei  Sul ', cidade: '  ', escudoUrl: '' }), { valido: true, dados: { nome: 'Vôlei Sul', cidade: null, escudoUrl: null }, erros: {} })
  assert.equal(validarEdicaoTime({ nome: 'A', cidade: '', escudoUrl: 'ftp://x' }).valido, false)
  assert.deepEqual(validarNovoAcesso({ email: ' Ana@Exemplo.com ', papel: 'TECNICO' }).valido && (validarNovoAcesso({ email: ' Ana@Exemplo.com ', papel: 'TECNICO' }) as { dados: unknown }).dados, { email: 'ana@exemplo.com', papel: 'TECNICO' })
  assert.deepEqual(Object.keys(validarNovoAcesso({ email: 'ana', papel: 'RESPONSAVEL' }).erros).sort(), ['email', 'papel'])
  assert.equal(validarMembroComissao({ nome: 'Rui', funcao: 'Massagista' }).valido, false)
  assert.equal(validarMembroComissao({ nome: 'Rui', funcao: 'FISIOTERAPEUTA' }).valido, true)
  assert.ok(validarNovoAtleta({ nome: 'Ana', dataNascimento: '2000-01-02', numero: '', posicao: 'Líbero' }).erros.posicao)

  // --- R3: regras da categoria
  const regrasServidor = normalizarRegrasCategoria({
    categoriaId: 'c1', nome: 'Sub-17', naipe: 'FEMININO', minimoAtletas: 6, maximoAtletas: 12, maximoLiberos: 1,
    maximoComissao: 3, anoNascimentoMinimo: 2008, anoNascimentoMaximo: null, inscricoesAbertas: false,
  })
  assert.ok(regrasServidor)
  const regrasTela = regrasDeCategoria(regrasServidor!)
  assert.deepEqual(regrasTela, { minimo: 6, maximo: 12, maxLiberos: 1, anoMinimo: 2008, maxComissao: 3, inscricoesAbertas: false, nomeCategoria: 'Sub-17' })
  assert.equal(normalizarRegrasCategoria({ minimoAtletas: 'x' }), null)
  assert.equal(normalizarRegrasCategoria({ minimoAtletas: 8, maximoAtletas: 6, maximoLiberos: 1 }), null)
  const comRegras = problemasDeEnvio(escolhas, atletas, regrasTela, 5)
  assert.ok(comRegras.some((p) => p.codigo === 'fechada'))
  assert.ok(comRegras.some((p) => p.codigo === 'comissao' && /máximo é 3\. Desmarque 2/.test(p.mensagem)))
  assert.equal(problemasDeEnvio(escolhas, atletas, REGRAS_PADRAO, 9).length, 0)

  // --- R3: pendência de nascimento
  assert.equal(faltaNascimento({ dataNascimento: null }), true)
  assert.equal(faltaNascimento({ dataNascimento: '2000-01-01' }), false)
  assert.equal(contarSemNascimento([{ dataNascimento: null }, { dataNascimento: '2001-02-03' }, { dataNascimento: null }]), 2)
  assert.equal(rotuloPosicao('LB'), 'Líbero')
  assert.equal(rotuloFuncao('PREPARADOR_FISICO'), 'Preparador físico')

  // --- R3: cliente HTTP com fetch falso (rotas novas)
  const chamadasR3: Array<{ url: string; metodo?: string; corpo?: string }> = []
  const httpR3 = criarClienteHttp(async (url, init) => {
    const u = String(url)
    chamadasR3.push({ url: u, metodo: init?.method, corpo: init?.body as string | undefined })
    if (u.endsWith('/comissao') && init?.method === 'POST') return resposta(201, { data: { id: 'm1', nome: 'Rui', funcao: 'TECNICO' } })
    if (u.includes('/comissao/')) return resposta(200, { data: { removido: true } })
    if (u.endsWith('/membros') && init?.method === 'GET') return resposta(200, { data: [{ id: 'u1', nome: 'Ana', papel: 'RESPONSAVEL' }] })
    if (u.endsWith('/membros')) return resposta(409, { error: 'dup', codigo: 'MEMBRO_DUPLICADO' })
    if (u.includes('/membros?')) return resposta(200, { data: { removido: true } })
    if (u.endsWith('/categorias/c%201/regras')) return resposta(200, { data: { categoriaId: 'c 1', nome: 'Livre', naipe: 'MISTO', minimoAtletas: 6, maximoAtletas: 14, maximoLiberos: 2, maximoComissao: null, anoNascimentoMinimo: null, anoNascimentoMaximo: null, inscricoesAbertas: true } })
    if (u.endsWith('/categorias/x/regras')) return resposta(404, { error: 'Não encontrado.' })
    if (u.endsWith('/equipes/e1') && init?.method === 'PATCH') return resposta(200, { data: { id: 'e1', nome: 'Novo', cidade: null, naipe: 'MISTO', escudoUrl: null } })
    if (u.endsWith('/lote')) return resposta(200, { data: { criados: [{ id: 'a1', nome: 'Ana', dataNascimento: null, numeroPreferido: null, posicao: null, temDocumento: false }], ignorados: [{ linha: 2, motivo: 'Repetido' }, { lixo: 1 }] } })
    throw new TypeError('Failed to fetch')
  })
  await httpR3.adicionarMembroComissao('e1', { nome: 'Rui', funcao: 'TECNICO' })
  assert.equal(chamadasR3.at(-1)?.url, '/api/meu-time/equipes/e1/comissao')
  assert.equal(chamadasR3.at(-1)?.corpo, JSON.stringify({ nome: 'Rui', funcao: 'TECNICO' }))
  await httpR3.removerMembroComissao('e1', 'm 1')
  assert.deepEqual([chamadasR3.at(-1)?.metodo, chamadasR3.at(-1)?.url], ['DELETE', '/api/meu-time/equipes/e1/comissao/m%201'])
  assert.equal((await httpR3.listarAcesso('e1'))[0].papel, 'RESPONSAVEL')
  await assert.rejects(httpR3.adicionarAcesso('e1', { email: 'a@b.co', papel: 'TECNICO' }), (e) => e instanceof ErroMeuTime && e.falha.tipo === 'conflito' && /já tem acesso/.test(e.falha.mensagem))
  await httpR3.removerAcesso('e1', 'u 2')
  assert.deepEqual([chamadasR3.at(-1)?.metodo, chamadasR3.at(-1)?.url], ['DELETE', '/api/meu-time/equipes/e1/membros?membroId=u%202'])
  assert.equal((await httpR3.obterRegrasCategoria('c 1')).maximoAtletas, 14)
  await assert.rejects(httpR3.obterRegrasCategoria('x'), (e) => e instanceof ErroMeuTime && e.falha.status === 404)
  const editada = await httpR3.atualizarEquipe('e1', { nome: 'Novo', cidade: null, escudoUrl: null })
  assert.equal(editada.nome, 'Novo')
  assert.equal(chamadasR3.at(-1)?.metodo, 'PATCH')
  assert.equal(chamadasR3.at(-1)?.corpo, JSON.stringify({ nome: 'Novo', cidade: null, escudoUrl: null }))
  const lote = await httpR3.adicionarAtletasEmLote('e1', [{ nome: 'Ana' }, { nome: 'Ana' }])
  assert.equal(lote.criados, 1)
  assert.equal(contarSemNascimento(lote.atletasCriados), 1)
  assert.deepEqual(lote.ignorados, [{ linha: 2, motivo: 'Repetido' }])

  // --- R3: cliente em memória (edição, acesso, regras)
  const memR3 = criarClienteMemoria({
    equipes: [{ id: 'q1', nome: 'Alfa', cidade: null, naipe: 'MISTO' }, { id: 'q2', nome: 'Beta', cidade: null, naipe: 'MISTO', meuPapel: 'TECNICO' }],
    contas: { 'rui@x.com': 'Rui' },
    regras: [regrasServidor!],
  })
  assert.equal((await memR3.atualizarEquipe('q1', { nome: 'Alfa 2', cidade: 'Rio', escudoUrl: null })).cidade, 'Rio')
  await assert.rejects(memR3.atualizarEquipe('q1', { nome: 'beta', cidade: null, escudoUrl: null }), (e) => e instanceof ErroMeuTime && e.falha.status === 409)
  await memR3.adicionarAcesso('q1', { email: 'rui@x.com', papel: 'ASSISTENTE' })
  await assert.rejects(memR3.adicionarAcesso('q1', { email: 'rui@x.com', papel: 'ASSISTENTE' }), (e) => e instanceof ErroMeuTime && e.falha.status === 409)
  await assert.rejects(memR3.adicionarAcesso('q1', { email: 'zz@x.com', papel: 'TECNICO' }), (e) => e instanceof ErroMeuTime && e.falha.status === 404)
  await assert.rejects(memR3.adicionarAcesso('q2', { email: 'rui@x.com', papel: 'TECNICO' }), (e) => e instanceof ErroMeuTime && e.falha.status === 403)
  await assert.rejects(memR3.removerAcesso('q1', 'voce'), (e) => e instanceof ErroMeuTime && e.falha.codigo === 'RESPONSAVEL_FIXO')
  assert.equal((await memR3.listarAcesso('q1')).length, 2)
  assert.equal((await memR3.obterRegrasCategoria('c1')).nome, 'Sub-17')
  await assert.rejects(memR3.obterRegrasCategoria('nada'), (e) => e instanceof ErroMeuTime && e.falha.status === 404)
  const detalheR3 = await memR3.obterEquipe('q2')
  assert.equal(detalheR3.meuPapel, 'TECNICO')
  const loteMem = await memR3.adicionarAtletasEmLote('q1', [{ nome: 'Lia' }])
  assert.equal(contarSemNascimento(loteMem.atletasCriados), 1)

  console.log('meu-time-ui: ok')
}

main().catch((erro) => {
  console.error(erro)
  process.exit(1)
})
