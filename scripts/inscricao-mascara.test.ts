import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { chavesDe, configurarAmbienteSupabase, instalarPostgrestFalso, type Tabelas } from './helpers/postgrest-falso'

configurarAmbienteSupabase()

const TOKEN = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'

async function main() {
  const rascunho = await import('../src/lib/team-registration-draft')

  // Máscaras: só os últimos dígitos aparecem.
  assert.equal(rascunho.mascararCpf('123.456.789-01'), '***.***.***-01')
  assert.equal(rascunho.mascararCpf(null), null)
  assert.equal(rascunho.mascararDocumento('MG-12.345.678'), '****78')
  assert.equal(rascunho.mascararDocumento('1234'), '****')
  assert.equal(rascunho.mascararDocumento('  '), null)
  assert.equal(rascunho.mascararDocumento(null), null)
  assert.equal(rascunho.mascararNascimento('2010-05-01'), '****-**-**')
  const atleta = rascunho.mascararAtletaInscricao({ cpf: '12345678901', dataNascimento: '2010-05-01', documentoNumero: 'MG1234567' })
  assert.deepEqual(atleta, { cpf: '***.***.***-01', dataNascimento: '****-**-**', documentoNumero: '****67' })

  // Valor mascarado devolvido pela tela de edição é descartado; valor novo passa.
  assert.deepEqual(
    rascunho.descartarCamposMascarados({ nome: 'Ana', cpf: '***.***.***-01', dataNascimento: '****-**-**', documentoNumero: '****67' }),
    { nome: 'Ana' },
  )
  assert.deepEqual(
    rascunho.descartarCamposMascarados({ cpf: '98765432100', dataNascimento: '2011-01-02', documentoNumero: 'SP7654321' }),
    { cpf: '98765432100', dataNascimento: '2011-01-02', documentoNumero: 'SP7654321' },
  )
  assert.equal(rascunho.descartarCamposMascarados(null), null)
  assert.deepEqual(rascunho.descartarCamposMascarados([1, 2]), [1, 2])

  const tabelas: Tabelas = {
    InscricaoEquipeRascunho: [{
      id: 'd1', token: TOKEN, ligaId: 7, nomeEquipe: 'Time', logoUrl: null, lider: null, tecnico: null,
      categoria: 'ADULTO', serie: null, categoriaCampeonatoId: 'c1', status: 'EM_PREENCHIMENTO',
      equipeId: null, inscricaoCampeonatoId: null, criadaEm: '2026-10-01', atualizadaEm: '2026-10-01', enviadaEm: null,
    }],
    Liga: [{
      id: 7, nome: 'Copa', status: 'ATIVA', inscricoesAbertas: true, inscricoesAberturaEm: null, inscricoesEncerramentoEm: null,
      elencoCadastroDuranteInscricao: true, inscricaoPermiteEdicaoAposEnvio: true,
    }],
    InscricaoEquipeJogadorRascunho: [{
      id: 'p1', inscricaoRascunhoId: 'd1', nome: 'Ana', numero: 7, posicao: null, fotoUrl: null,
      cpf: '12345678901', dataNascimento: '2010-05-01', documentoTipo: 'RG', documentoNumero: 'MG1234567',
    }],
  }
  const falso = instalarPostgrestFalso(tabelas)
  try {
    const rota = await import('../src/app/api/inscricao-rapida/[token]/route')
    const jogador = await import('../src/app/api/inscricao-rapida/[token]/jogadores/[jogadorId]/route')
    const ctx = { params: Promise.resolve({ token: TOKEN }) }
    const requisicao = (metodo: string, corpo?: unknown) => new NextRequest(`http://127.0.0.1:3001/api/inscricao-rapida/${TOKEN}`, {
      method: metodo,
      headers: { 'content-type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    })

    // GET: nenhum CPF, nascimento ou documento por extenso na resposta.
    const leitura = await rota.GET(requisicao('GET'), ctx)
    assert.equal(leitura.status, 200)
    const corpoLeitura = await leitura.json()
    const jogadores = corpoLeitura.data.players
    assert.equal(jogadores.length, 1)
    assert.deepEqual(
      { cpf: jogadores[0].cpf, dataNascimento: jogadores[0].dataNascimento, documentoNumero: jogadores[0].documentoNumero },
      { cpf: '***.***.***-01', dataNascimento: '****-**-**', documentoNumero: '****67' },
    )
    const texto = JSON.stringify(corpoLeitura)
    for (const cru of ['12345678901', '2010-05-01', 'MG1234567']) assert.equal(texto.includes(cru), false, cru)

    // Edição sem quebrar: a tela devolve tudo mascarado e só troca o nome.
    falso.chamadas.length = 0
    const edicao = await jogador.PATCH(
      requisicao('PATCH', { nome: 'Ana Maria', cpf: '***.***.***-01', dataNascimento: '****-**-**', documentoNumero: '****67' }),
      { params: Promise.resolve({ token: TOKEN, jogadorId: 'p1' }) },
    )
    assert.equal(edicao.status, 200, JSON.stringify(await edicao.clone().json()))
    const gravacoes = falso.chamadas.filter((c) => c.metodo === 'PATCH' && c.tabela === 'InscricaoEquipeJogadorRascunho')
    assert.equal(gravacoes.length, 1)
    const gravado = JSON.parse(gravacoes[0].corpo ?? '{}')
    assert.equal(gravado.nome, 'Ana Maria')
    for (const campo of ['cpf', 'dataNascimento', 'documentoNumero']) assert.equal(campo in gravado, false, `não grava ${campo} mascarado`)
    const respostaEdicao = JSON.stringify(await edicao.json())
    for (const cru of ['12345678901', '2010-05-01', 'MG1234567']) assert.equal(respostaEdicao.includes(cru), false, `PATCH devolveu ${cru}`)

    // Valor novo e verdadeiro continua sendo gravado.
    falso.chamadas.length = 0
    const troca = await jogador.PATCH(
      requisicao('PATCH', { cpf: '98765432100', documentoNumero: 'SP7654321' }),
      { params: Promise.resolve({ token: TOKEN, jogadorId: 'p1' }) },
    )
    assert.equal(troca.status, 200, JSON.stringify(await troca.clone().json()))
    const gravadoNovo = JSON.parse(falso.chamadas.find((c) => c.metodo === 'PATCH' && c.tabela === 'InscricaoEquipeJogadorRascunho')?.corpo ?? '{}')
    assert.equal(gravadoNovo.cpf, '98765432100')
    assert.equal(gravadoNovo.documentoNumero, 'SP7654321')
    const respostaTroca = JSON.stringify(await troca.json())
    assert.equal(respostaTroca.includes('98765432100'), false)
    assert.equal(chavesDe(JSON.parse(respostaTroca)).includes('cpf'), true)
  } finally {
    falso.restaurar()
  }

  console.log('inscricao-mascara: ok')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
