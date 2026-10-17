import assert from 'node:assert/strict'
import { faseDoisAtiva } from '../src/lib/meu-time-fase2-ui/flag'
import { MODELO_CSV, podeConfirmar, resumoEmFrase, textoCsvValido, textoDeErroLinha, validarArquivoCsv } from '../src/lib/meu-time-fase2-ui/csv'
import { EXPLICACAO_PUBLICA, ehMenorDeIdade, idadeEm, linkWhatsApp, normalizarEstado, podeRevogar, validarFormAtleta } from '../src/lib/meu-time-fase2-ui/convites'
import { contarNaoLidas, rotuloSino, textoContador, tituloNotificacao } from '../src/lib/meu-time-fase2-ui/notificacoes'
import { itemAtual, itensVisiveis, ITENS_NAV } from '../src/lib/meu-time-fase2-ui/navegacao'
import { criarClienteFase2 } from '../src/components/meu-time-fase2/cliente'

async function main() {
  // flag
  assert.equal(faseDoisAtiva('1'), true)
  assert.equal(faseDoisAtiva('0'), false)
  assert.equal(faseDoisAtiva(undefined), false)
  assert.equal(faseDoisAtiva('true'), false)

  // csv
  assert.ok(MODELO_CSV.startsWith('nome,data_nascimento,camisa,posicao\n'))
  assert.equal(textoCsvValido(''), 'Cole as linhas da planilha ou escolha um arquivo.')
  assert.ok(textoCsvValido('nome,data_nascimento'))
  assert.equal(textoCsvValido(MODELO_CSV), null)
  assert.ok(validarArquivoCsv({ name: 'x.xlsx', size: 10 }))
  assert.ok(validarArquivoCsv({ name: 'x.csv', size: 0 }))
  assert.ok(validarArquivoCsv({ name: 'x.csv', size: 10_000_000 }))
  assert.equal(validarArquivoCsv({ name: 'X.CSV', size: 100 }), null)
  assert.match(textoDeErroLinha('NASCIMENTO_INVALIDO'), /data de nascimento/)
  assert.equal(textoDeErroLinha('Camisa repetida na linha 3.'), 'Camisa repetida na linha 3.')
  assert.equal(textoDeErroLinha('XPTO_DESCONHECIDO'), 'Esta linha tem um problema. Confira os dados.')
  assert.equal(textoDeErroLinha({ codigo: 'NOME_OBRIGATORIO' }), 'Falta o nome do atleta.')
  assert.equal(resumoEmFrase({ validas: 1, comAviso: 0, invalidas: 2 }), '1 linha pronta, 0 com avisos, 2 com erros.')
  assert.equal(podeConfirmar({ validas: 0, comAviso: 0 }), false)
  assert.equal(podeConfirmar({ validas: 0, comAviso: 1 }), true)

  // convites
  assert.equal(normalizarEstado('ATIVO'), 'ativo')
  assert.equal(normalizarEstado('EXPIRADO'), 'expirado')
  assert.equal(normalizarEstado('USADO'), 'usado')
  assert.equal(normalizarEstado('REVOGADO'), 'revogado')
  assert.equal(normalizarEstado('qualquer'), 'invalido')
  assert.equal(normalizarEstado(undefined), 'invalido')
  assert.equal(podeRevogar('ativo'), true)
  assert.equal(podeRevogar('usado'), false)
  for (const e of ['expirado', 'usado', 'revogado', 'invalido'] as const) assert.ok(EXPLICACAO_PUBLICA[e].texto)
  assert.ok(linkWhatsApp('https://x.y/convite-atleta/abc?a=1', 'Time A').startsWith('https://wa.me/?text='))
  assert.ok(linkWhatsApp('https://x.y/a b').includes(encodeURIComponent('https://x.y/a b')))
  const hoje = new Date(2026, 5, 15)
  assert.equal(idadeEm('2008-06-15', hoje), 18)
  assert.equal(idadeEm('2008-06-16', hoje), 17)
  assert.equal(ehMenorDeIdade('2010-01-01', hoje), true)
  assert.equal(ehMenorDeIdade('2000-01-01', hoje), false)
  assert.equal(ehMenorDeIdade('', hoje), false)
  assert.equal(idadeEm('2027-01-01', hoje), null)
  assert.equal(idadeEm('2001-02-30', hoje), null)
  assert.deepEqual(validarFormAtleta({ nome: 'Ana Lima', dataNascimento: '2000-01-01', camisa: '' }, hoje), {})
  const e = validarFormAtleta({ nome: '', dataNascimento: 'x', camisa: '100' }, hoje)
  assert.ok(e.nome && e.dataNascimento && e.camisa)

  // notificações
  const lista = [
    { id: '1', tipo: 'CONVITE_USADO', payload: { nome: 'Ana' }, lidaEm: null, criadoEm: '' },
    { id: '2', tipo: 'X', payload: {}, lidaEm: 'agora', criadoEm: '' },
  ]
  assert.equal(contarNaoLidas(lista), 1)
  assert.equal(textoContador(12), '9+')
  assert.equal(textoContador(3), '3')
  assert.equal(rotuloSino(0), 'Notificações, nenhuma nova')
  assert.equal(rotuloSino(1), 'Notificações, 1 nova')
  assert.equal(rotuloSino(4), 'Notificações, 4 novas')
  assert.equal(tituloNotificacao(lista[0]), 'Um atleta preencheu o convite: Ana')
  assert.equal(tituloNotificacao(lista[1]), 'Novidade no seu time')

  // navegação
  assert.equal(itensVisiveis(false).length, 2)
  assert.equal(itensVisiveis(true).length, ITENS_NAV.length)
  const por = (r: string) => ITENS_NAV.find((i) => i.rotulo === r)!
  assert.equal(itemAtual('/meu-time/convites', por('Convites')), true)
  assert.equal(itemAtual('/meu-time/convites', por('Minhas equipes')), false)
  assert.equal(itemAtual('/meu-time/abc', por('Minhas equipes')), true)
  assert.equal(itemAtual('/meu-time', por('Atletas')), false)

  // cliente HTTP
  const chamadas: Array<{ url: string; metodo: string; corpo?: string }> = []
  const resp = (status: number, corpo: unknown) => ({ ok: status < 400, status, json: async () => corpo }) as Response
  const api = criarClienteFase2((async (url: string, init?: RequestInit) => {
    chamadas.push({ url, metodo: init?.method ?? 'GET', corpo: init?.body as string | undefined })
    if (url.includes('/api/meu-time/convites?')) return resp(200, { data: [{ id: 'c1', estado: 'ATIVO', criadoEm: 'a', expiraEm: 'b' }] })
    if (url.includes('/convite-atleta/ruim')) return resp(404, { error: 'Convite inválido.', codigo: 'CONVITE_INVALIDO' })
    if (url.includes('/convite-atleta/')) return resp(200, { data: { equipe: 'Time A', categoria: 'Sub-17', estado: 'EXPIRADO' } })
    if (url.endsWith('/importacao')) return resp(200, { data: { id: 'i1', resumo: { validas: 1, comAviso: 0, invalidas: 1 }, linhas: [{ n: 1, status: 'OK', erros: [], dados: { nome: 'A' } }, { n: 2, status: 'ERRO', erros: ['NOME_OBRIGATORIO'], dados: {} }] } })
    if (url.endsWith('/clube')) return resp(200, { data: null })
    if (url.endsWith('/lida')) return resp(404, { error: 'Não encontrado.' })
    return resp(200, { data: {} })
  }) as typeof fetch)
  const convites = await api.listarConvites('e 1')
  assert.equal(convites[0].estado, 'ativo')
  assert.ok(chamadas[0].url.endsWith('equipeId=e%201'))
  assert.equal((await api.lerConvitePublico('t')).estado, 'expirado')
  await assert.rejects(() => api.lerConvitePublico('ruim'), (err: { falha?: { tipo: string } }) => err.falha?.tipo === 'nao-encontrado')
  const previa = await api.enviarPlanilha('e', 'csv')
  assert.equal(previa.linhas[1].status, 'ERRO')
  assert.equal(previa.resumo.invalidas, 1)
  assert.equal(await api.obterClube(), null)
  await assert.rejects(() => api.marcarLida('n1'), (err: { falha?: { tipo: string } }) => err.falha?.tipo === 'nao-habilitado')
  await api.revogarConvite('c/1')
  assert.equal(chamadas.at(-1)?.metodo, 'DELETE')
  assert.ok(chamadas.at(-1)?.url.endsWith('/c%2F1'))
  const rede = criarClienteFase2((async () => { throw new Error('x') }) as typeof fetch)
  await assert.rejects(() => rede.listarNotificacoes(), (err: { falha?: { tipo: string } }) => err.falha?.tipo === 'rede')

  console.log('meu-time-fase2-ui: ok')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
