import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { NextRequest } from 'next/server'
import { chavesDe, configurarAmbienteSupabase, instalarPostgrestFalso, type Tabelas } from './helpers/postgrest-falso'

configurarAmbienteSupabase()

const raiz = process.cwd()

function ler(relativo: string) {
  return fs.readFileSync(path.join(raiz, relativo), 'utf8')
}

function arquivosTs(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const completo = path.join(dir, entrada.name)
    if (entrada.isDirectory()) return arquivosTs(completo)
    return /\.ts$/.test(entrada.name) ? [completo] : []
  })
}

/** Seleções amplas: `.select()` vazio ou com `*` (exceto contagem com head: true). */
function selectsAmplos(fonte: string) {
  const achados: string[] = []
  for (const m of Array.from(fonte.matchAll(/\.select\(\s*(?:\)|(['"`])([^'"`]*)\1\s*(,\s*\{[^}]*\})?\s*\))/g))) {
    const colunas = m[2] ?? ''
    const soContagem = /head:\s*true/.test(m[3] ?? '')
    if (colunas.trim() === '' || (colunas.includes('*') && !soContagem)) achados.push(m[0])
  }
  return achados
}

function colunasDeConstante(valor: string) {
  return valor.split(/[\s,():!]+/).filter(Boolean)
}

async function main() {
  const proj = await import('../src/lib/projecoes-publicas')
  const { LIGA_COLUNAS_PUBLICAS, LIGA_CAMPOS_OCULTOS } = await import('../src/lib/liga-colunas')

  // 1. Constantes de seleção sem nomes proibidos nem `*`.
  const constantes = Object.entries(proj).filter(([nome, valor]) => nome.endsWith('_COLUNAS') && typeof valor === 'string') as Array<[string, string]>
  assert.ok(constantes.length >= 5, 'constantes de projeção')
  for (const [nome, valor] of [...constantes, ['LIGA_COLUNAS_PUBLICAS', LIGA_COLUNAS_PUBLICAS] as [string, string]]) {
    assert.equal(valor.includes('*'), false, `${nome} usa *`)
    const colunas = colunasDeConstante(valor)
    for (const proibida of proj.COLUNAS_PROIBIDAS) assert.equal(colunas.includes(proibida), false, `${nome} contém ${proibida}`)
  }
  for (const campo of LIGA_CAMPOS_OCULTOS) assert.equal(colunasDeConstante(LIGA_COLUNAS_PUBLICAS).includes(campo), false, campo)

  // 2. Rotas de equipes e ligas sem select amplo.
  const rotasM4 = [
    ...arquivosTs(path.join(raiz, 'src/app/api/equipes')),
    ...arquivosTs(path.join(raiz, 'src/app/api/ligas')),
  ]
  assert.ok(rotasM4.length >= 4)
  for (const arquivo of rotasM4) {
    assert.deepEqual(selectsAmplos(fs.readFileSync(arquivo, 'utf8')), [], `select amplo em ${arquivo}`)
  }
  assert.match(ler('src/app/api/equipes/[id]/route.ts'), /podeLerCampeonato/)
  assert.match(ler('src/app/api/ligas/[slug]/route.ts'), /podeLerCampeonato/)

  // 3. Comportamento: o banco devolve linhas cheias; a resposta só traz colunas públicas.
  const tabelas: Tabelas = {
    Liga: [
      { id: 7, slug: 'copa', nome: 'Copa', status: 'ATIVA', simulacao: false, organizadorId: 'org-A', seedKey: 'seed', pagamentoConfirmadoEm: 'x', nomeCurto: 'C' },
      { id: 8, slug: 'rascunho', nome: 'Rascunho', status: 'RASCUNHO', simulacao: false, organizadorId: 'org-B', seedKey: 's' },
      { id: 9, slug: 'simulada', nome: 'Simulada', status: 'ATIVA', simulacao: true, organizadorId: 'org-B' },
    ],
    Equipe: [
      { id: 1, nome: 'Time A', slug: 'time-a', ligaId: 7, categoria: 'ADULTO', categoriaCampeonatoId: 'c1', statusEquipe: 'ATIVA', lider: 'Maria', tecnico: 'Joao', seedKey: 's', quadraInfo: '{}' },
      { id: 2, nome: 'Time B', slug: 'time-b', ligaId: 8, categoria: 'ADULTO', categoriaCampeonatoId: 'c2', statusEquipe: 'ATIVA', lider: 'Ana' },
      { id: 3, nome: 'Time C', slug: 'time-c', ligaId: 9, categoria: 'ADULTO', categoriaCampeonatoId: 'c3', statusEquipe: 'ATIVA' },
    ],
    InscricaoCampeonato: [
      { equipeId: 1, ligaId: 7, status: 'APROVADA' },
      { equipeId: 2, ligaId: 8, status: 'APROVADA' },
      { equipeId: 3, ligaId: 9, status: 'APROVADA' },
    ],
    Jogador: [
      { id: 10, nome: 'Atleta', numero: 1, posicao: 'P', fotoUrl: 'f', fotoRostoUrl: 'r', equipeId: 1, banido: false, cpf: '1', documentoNumero: '2', dataNascimento: '2010-01-01', telefone: '3', telefoneEmergencia: '4', documentosUrls: '[]', qrCodeToken: 'qr' },
      { id: 11, nome: 'Banido', numero: 2, posicao: 'P', fotoUrl: null, fotoRostoUrl: null, equipeId: 1, banido: true },
      { id: 12, nome: 'Outro', numero: 3, posicao: 'P', fotoUrl: null, fotoRostoUrl: null, equipeId: 2, banido: false },
    ],
  }
  const falso = instalarPostgrestFalso(tabelas)
  try {
    const equipes = await import('../src/app/api/equipes/route')
    const equipePorId = await import('../src/app/api/equipes/[id]/route')
    const ligas = await import('../src/app/api/ligas/route')
    const ligaPorSlug = await import('../src/app/api/ligas/[slug]/route')
    const req = (url: string) => new NextRequest(`http://127.0.0.1:3001${url}`)
    const proibidos = [...proj.COLUNAS_PROIBIDAS, 'qrCodeToken', 'banido', 'quadraInfo']
    const semProibidos = (json: unknown, onde: string) => {
      const chaves = chavesDe(json)
      for (const proibido of proibidos) assert.equal(chaves.includes(proibido), false, `${onde}: ${proibido}`)
    }

    // /api/equipes anônimo: só equipes de campeonato publicado, sem contato do líder nem organizadorId.
    const lista = await equipes.GET(req('/api/equipes'))
    assert.equal(lista.status, 200)
    const listaJson = await lista.json()
    assert.deepEqual(listaJson.data.map((e: { id: number }) => e.id), [1])
    semProibidos(listaJson, 'GET /api/equipes')
    assert.deepEqual(listaJson.data[0].jogadores.map((j: { id: number }) => j.id), [10], 'atleta banido não aparece')

    // Campeonato de rascunho ou simulação: visitante recebe lista vazia.
    for (const ligaId of ['8', '9']) {
      const vazia = await equipes.GET(req(`/api/equipes?ligaId=${ligaId}`))
      assert.deepEqual((await vazia.json()).data, [], `ligaId ${ligaId}`)
    }
    const publicaPorLiga = await equipes.GET(req('/api/equipes?ligaId=7'))
    const publicaJson = await publicaPorLiga.json()
    assert.deepEqual(publicaJson.data.map((e: { id: number }) => e.id), [1])
    semProibidos(publicaJson, 'GET /api/equipes?ligaId')

    // /api/equipes/[id]: 404 para equipe de campeonato reservado, projeção mínima para o público.
    const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
    for (const id of ['2', '3', '999', 'abc']) {
      const resposta = await equipePorId.GET(req(`/api/equipes/${id}`), ctx(id))
      assert.equal(resposta.status, 404, `equipe ${id}`)
    }
    const equipeOk = await equipePorId.GET(req('/api/equipes/1'), ctx('1'))
    assert.equal(equipeOk.status, 200)
    const equipeJson = await equipeOk.json()
    semProibidos(equipeJson, 'GET /api/equipes/1')
    assert.deepEqual(equipeJson.data.jogadores.map((j: { id: number }) => j.id), [10])

    // /api/ligas anônimo: filtro de publicação vai na consulta e a resposta não traz campos internos.
    falso.chamadas.length = 0
    const listaLigas = await ligas.GET(req('/api/ligas'))
    assert.equal(listaLigas.status, 200)
    const consultaLigas = falso.chamadas.find((c) => c.tabela === 'Liga')
    assert.ok(consultaLigas)
    assert.match(decodeURIComponent(consultaLigas.search), /status=in\.\(EM_BREVE,ATIVA,ENCERRADA,FINALIZADO\)/)
    assert.match(consultaLigas.search, /simulacao=eq\.false/)
    semProibidos(await listaLigas.json(), 'GET /api/ligas')

    // /api/ligas/[slug]: rascunho e simulação viram 404; publicado sai sem organizadorId.
    const slugCtx = (slug: string) => ({ params: Promise.resolve({ slug }) })
    for (const slug of ['rascunho', 'simulada', 'nao-existe']) {
      const resposta = await ligaPorSlug.GET(req(`/api/ligas/${slug}`), slugCtx(slug))
      assert.equal(resposta.status, 404, slug)
    }
    const ligaOk = await ligaPorSlug.GET(req('/api/ligas/copa'), slugCtx('copa'))
    assert.equal(ligaOk.status, 200)
    const ligaJson = await ligaOk.json()
    assert.equal(ligaJson.data.nome, 'Copa')
    semProibidos(ligaJson, 'GET /api/ligas/copa')
  } finally {
    falso.restaurar()
  }

  // 4. M1: súmula e árbitro leem a partida com colunas explícitas, sem PII nem organizadorId.
  const arquivosM1 = [
    ...arquivosTs(path.join(raiz, 'src/app/api/arbitro')),
    path.join(raiz, 'src/lib/arbitro-access.ts'),
    path.join(raiz, 'src/lib/sumula-access.ts'),
    path.join(raiz, 'src/lib/partida-operacao.ts'),
    path.join(raiz, 'src/app/api/partidas/[id]/sumula-publica/route.ts'),
  ]
  for (const arquivo of arquivosM1) {
    assert.deepEqual(selectsAmplos(fs.readFileSync(arquivo, 'utf8')), [], `select amplo em ${arquivo}`)
  }
  const operacao = await import('../src/lib/partida-operacao')
  const { PARTIDA_CONSULTA_COLUNAS } = await import('../src/lib/sumula-consulta')
  for (const [nome, selecao] of [
    ['SELECAO_PARTIDA_OPERACAO', operacao.SELECAO_PARTIDA_OPERACAO],
    ['SELECAO_PARTIDA_SUMULA', operacao.SELECAO_PARTIDA_SUMULA],
    ['PARTIDA_CONSULTA_COLUNAS', PARTIDA_CONSULTA_COLUNAS],
  ] as Array<[string, string]>) {
    assert.equal(selecao.includes('*'), false, `${nome} usa *`)
    const colunas = colunasDeConstante(selecao)
    for (const proibida of proj.COLUNAS_PROIBIDAS) assert.equal(colunas.includes(proibida), false, `${nome} contém ${proibida}`)
    assert.equal(colunas.includes('qrCodeToken'), false, `${nome} contém qrCodeToken`)
  }
  for (const [nome, selecao] of Object.entries(proj)) {
    if (nome.endsWith('_EMBEDS')) {
      assert.equal(String(selecao).includes('*'), false, nome)
      for (const proibida of proj.COLUNAS_PROIBIDAS) assert.equal(colunasDeConstante(String(selecao)).includes(proibida), false, `${nome} contém ${proibida}`)
    }
  }

  const tabelasM1: Tabelas = {
    Liga: [{ id: 7, organizadorId: 'org-A', nome: 'Copa', status: 'ATIVA' }],
    Partida: [{ id: 5, ligaId: 7, sumulaToken: 'tok_abc_123', status: 'AGENDADA', liga: { id: 7, nome: 'Copa' } }],
  }
  const falsoM1 = instalarPostgrestFalso(tabelasM1)
  try {
    const leitura = await operacao.lerPartidaSumula({ coluna: 'sumulaToken', valor: 'tok_abc_123' })
    assert.equal(leitura.partida?.id, 5)
    const consultaPartida = falsoM1.chamadas.filter((c) => c.tabela === 'Partida').at(-1)
    assert.ok(consultaPartida)
    assert.equal(consultaPartida.select.includes('*'), false)
    assert.match(consultaPartida.search, /sumulaToken=eq\.tok_abc_123/)
    assert.equal(await operacao.organizadorDaLiga(7), 'org-A')
    assert.equal(await operacao.organizadorDaLiga(999), null)
  } finally {
    falsoM1.restaurar()
  }

  console.log('projecoes-publicas: ok')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
