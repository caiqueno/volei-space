import fs from 'node:fs'
import assert from 'node:assert/strict'

for (const linha of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const separado = linha.match(/^([A-Z0-9_]+)=(.*)$/)
  if (!separado || process.env[separado[1]]) continue
  process.env[separado[1]] = separado[2].trim().replace(/^['"]|['"]$/g, '')
}

const slugTemporario = `fluxo-cadastro-ui-${Date.now()}`

async function json(resposta: Response) {
  const texto = await resposta.text()
  try {
    return JSON.parse(texto) as { data?: any; error?: string }
  } catch {
    throw new Error(`Resposta ${resposta.status} sem JSON: ${texto.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 180)}`)
  }
}

async function main() {
  const { createClient } = await import('@supabase/supabase-js')
  const { signPublicToken } = await import('../src/lib/auth')
  const base = 'http://127.0.0.1:3001'

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '', {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const ligaClass = await db.from('Liga').select('id,organizadorId,formato').eq('seedKey', 'FLUXO-CADASTRO-CLASS').single()
  const ligaMata = await db.from('Liga').select('id,formato,criteriosClassificacao').eq('seedKey', 'FLUXO-CADASTRO-MATA').single()
  assert.equal(ligaClass.error, null, ligaClass.error?.message)
  assert.equal(ligaMata.error, null, ligaMata.error?.message)
  assert.equal(ligaMata.data?.formato, 'MATA_MATA')
  assert.equal(ligaMata.data?.criteriosClassificacao, null)

  const organizador = await db.from('CandidaturaOrganizador').select('id,email,nome,status').eq('id', ligaClass.data!.organizadorId).single()
  assert.equal(organizador.error, null, organizador.error?.message)
  const token = await signPublicToken({
    userId: String(organizador.data!.id),
    email: organizador.data!.email,
    nome: organizador.data!.nome,
    tipo: 'organizador',
    status: organizador.data!.status,
    trocarSenha: false,
  })

  async function chamar(caminho: string, method: string, body?: unknown) {
    const resposta = await fetch(`${base}${caminho}`, {
      method,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const corpo = await json(resposta)
    return { status: resposta.status, ...corpo }
  }

  const criado = await chamar('/api/ligas', 'POST', {
    nome: 'Campeonato Teste Fluxo UI',
    slug: slugTemporario,
    organizadorId: String(organizador.data!.id),
    descricao: 'DADOS DE TESTE FLUXO-CADASTRO-2026',
    status: 'EM_BREVE',
    formato: 'GRUPOS_MATA_MATA',
    quantidadeEquipes: 8,
    faseEliminatoria: 'QUARTAS',
  })
  assert.equal(criado.error, undefined, criado.error)
  const ligaId = Number(criado.data.id)
  assert.ok(ligaId > 0, 'campeonato temporário criado')

  try {
    const nomeOriginal = criado.data.nome as string
    const falha = await chamar(`/api/organizador/ligas/${ligaId}/setup/informacoes`, 'PATCH', {
      nome: nomeOriginal,
      nomeCurto: 'NOME CURTO DEMAIS PARA O LIMITE',
    })
    assert.equal(falha.status, 422, falha.error || 'esperava rejeitar nome curto longo')
    const depoisDaFalha = await chamar(`/api/organizador/ligas/${ligaId}/setup/informacoes`, 'GET')
    assert.equal(depoisDaFalha.data.nome, nomeOriginal, 'falha de salvamento não grava o dado inválido')

    const salvo = await chamar(`/api/organizador/ligas/${ligaId}/setup/informacoes`, 'PATCH', {
      nome: 'Campeonato Teste Fluxo UI',
      nomeCurto: 'Fluxo UI',
      descricao: 'DADOS DE TESTE FLUXO-CADASTRO-2026',
      status: 'EM_BREVE',
    })
    assert.equal(salvo.error, undefined, salvo.error)
    assert.equal(salvo.data.nomeCurto, 'Fluxo UI')

    const categorias = await chamar(`/api/organizador/ligas/${ligaId}/categorias`, 'PUT', {
      categorias: [{ codigo: 'MASCULINO', nome: 'Masculino' }],
    })
    assert.equal(categorias.error, undefined, categorias.error)
    const categoriasLidas = await chamar(`/api/organizador/ligas/${ligaId}/categorias`, 'GET')
    const nomes = (categoriasLidas.data as Array<{ nome: string; removidaEm?: string | null }>).filter((item) => !item.removidaEm).map((item) => item.nome)
    assert.deepEqual(nomes, ['Masculino'], 'categoria persistida na 5ª etapa')

    const categoriaId = (categorias.data as Array<{ id: string }>)[0]?.id
    assert.ok(categoriaId, 'categoria criada para a parametrização')
    const mata = await chamar(`/api/organizador/ligas/${ligaId}/setup/estrutura?categoriaCampeonatoId=${categoriaId}`, 'PATCH', { formato: 'MATA_MATA', quantidadeEquipes: 8 })
    assert.equal(mata.error, undefined, mata.error)
    const setupMata = await chamar(`/api/organizador/ligas/${ligaId}/setup?categoriaCampeonatoId=${categoriaId}`, 'GET')
    const chavesMata = (setupMata.data.cards as Array<{ key: string }>).map((card) => card.key)
    assert.equal(chavesMata.includes('classificacao'), false, 'mata-mata não oferece a etapa de classificação')
    assert.equal(setupMata.data.progress.totalSections, 5)

    const grupos = await chamar(`/api/organizador/ligas/${ligaId}/setup/estrutura?categoriaCampeonatoId=${categoriaId}`, 'PATCH', {
      formato: 'GRUPOS_MATA_MATA',
      quantidadeEquipes: 8,
      quantidadeGrupos: 2,
    })
    assert.equal(grupos.error, undefined, grupos.error)
    const setupGrupos = await chamar(`/api/organizador/ligas/${ligaId}/setup`, 'GET')
    const chavesGrupos = (setupGrupos.data.cards as Array<{ key: string }>).map((card) => card.key)
    assert.equal(chavesGrupos.includes('classificacao'), true, 'formato com classificação devolve a etapa')

    const setupSemente = await chamar(`/api/organizador/ligas/${ligaMata.data!.id}/setup`, 'GET')
    const chavesSemente = (setupSemente.data.cards as Array<{ key: string }>).map((card) => card.key)
    assert.equal(chavesSemente.includes('classificacao'), false, 'campeonato de teste mata-mata segue sem classificação')

    const tabelaMata = await db.from('ClassificacaoEntrada').select('id', { count: 'exact', head: true }).eq('ligaId', ligaMata.data!.id)
    assert.equal(tabelaMata.count, 0, 'mata-mata de teste não tem tabela de classificação')
    console.log('Fluxo de cadastro validado: categorias, falha sem avanço, mata-mata sem classificação e retorno da etapa.')
  } finally {
    await db.from('CategoriaConfiguracao').delete().eq('ligaId', ligaId)
    await db.from('CategoriaSetupSecao').delete().eq('ligaId', ligaId)
    await db.from('CategoriaCampeonato').delete().eq('ligaId', ligaId)
    await db.from('LigaSetupSecao').delete().eq('ligaId', ligaId)
    const apagou = await db.from('Liga').delete().eq('id', ligaId).eq('slug', slugTemporario)
    if (apagou.error) throw new Error(apagou.error.message)
  }
}

main().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : 'Falha no teste do fluxo.')
  process.exit(1)
})
