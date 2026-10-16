import fs from 'fs'
import path from 'path'
import { expect, test, type Page } from '@playwright/test'

const ATIVO = process.env.WINNER_QA_E2E === '1'
const ARTEFATOS = process.env.WINNER_QA_ARTEFATOS || '/opt/cursor/artifacts/winner-qa'
const EMAIL = process.env.ORGANIZADOR_EMAIL || 'organizador.winners@volei.space'
const SENHA = process.env.ORGANIZADOR_SENHA || 'OrgWinners@2026'
const TIMES_PATH = process.env.WINNERS_TEAMS_JSON || path.join(__dirname, 'fixtures', 'winners-teams.json')
const FOTO_JOGADOR = path.join(__dirname, 'fixtures', 'jogador.png')

type Time = { nome: string; responsavel: string; jogadores: string[] }
type Falha = { etapa: string; erro: string; screenshot?: string }

function limparNome(valor: unknown) {
  return String(valor ?? '').replace(/[\u200B-\u200D\u2060\uFEFF]/g, '').replace(/\s+/g, ' ').trim()
}

function lerTimes(): Time[] {
  const bruto = JSON.parse(fs.readFileSync(TIMES_PATH, 'utf8')) as Array<Record<string, unknown>>
  return bruto.map((time) => ({
    nome: limparNome(time.nome),
    responsavel: limparNome(time.responsavel) || 'Responsável da equipe',
    jogadores: ((time.jogadores as unknown[]) ?? []).map(limparNome).filter(Boolean),
  }))
}

test.skip(!ATIVO, 'Winner QA só roda com o app local já no Postgres local (WINNER_QA_E2E=1).')

test('Winner QA do começo ao pódio, clicando na interface', async ({ page }) => {
  test.setTimeout(50 * 60 * 1000)
  fs.mkdirSync(ARTEFATOS, { recursive: true })
  const times = lerTimes()
  const atletas = times.reduce((total, time) => total + time.jogadores.length, 0)
  expect(times).toHaveLength(10)
  expect(atletas).toBe(140)

  const falhas: Falha[] = []
  let travado = false
  const relatorio: Record<string, unknown> = {
    campeonato: 'Winner QA',
    formato: 'Grupos + mata-mata, melhor de 3 sets de 25 (tie-break de 15 no último set). Sem 5º set neste formato.',
    times: times.map((time) => ({ nome: time.nome, jogadores: time.jogadores.length })),
    atletas,
  }

  async function etapa(nome: string, fn: () => Promise<void>, depende = true) {
    if (depende && travado) {
      falhas.push({ etapa: nome, erro: 'Não executada: uma etapa anterior, da qual esta depende, falhou.' })
      return
    }
    console.log(`ETAPA ${nome}`)
    try {
      await fn()
    } catch (error) {
      const arquivo = path.join(ARTEFATOS, `${String(falhas.length + 1).padStart(2, '0')}-${nome.replace(/[^\w]+/g, '-').slice(0, 80)}.png`)
      await page.screenshot({ path: arquivo, fullPage: true }).catch(() => undefined)
      falhas.push({
        etapa: nome,
        erro: error instanceof Error ? error.message : String(error),
        screenshot: arquivo,
      })
      if (depende) travado = true
      console.log(`FALHA ${nome}: ${falhas.at(-1)?.erro}`)
    }
  }

  let linkCategoria = ''
  let ligaId = ''

  await etapa('login do organizador', async () => {
    await page.goto('/login')
    await page.waitForFunction(() => {
      const botao = document.querySelector('button.admin-login-button')
      return Boolean(botao && Object.keys(botao).some((chave) => chave.startsWith('__reactProps')))
    })
    await page.getByRole('button', { name: /membro/i }).click()
    await page.getByLabel('E-mail').fill(EMAIL)
    await page.getByLabel('Senha').fill(SENHA)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page).toHaveURL(/\/painel/, { timeout: 20_000 })
  })

  await etapa('cadastro da organização', async () => {
    await page.goto('/painel?secao=parametrizacao')
    const titulo = page.getByRole('heading', { name: 'Complete sua organização' })
    const novo = page.getByRole('button', { name: /novo campeonato/i })
    await expect(titulo.or(novo)).toBeVisible()
    if (!(await titulo.isVisible().catch(() => false))) return
    await page.getByPlaceholder('Ex: Liga, assessoria ou clube').fill('Organizadores Winner QA')
    await page.getByPlaceholder('Cidade de atuação').fill('São Paulo')
    await page.getByRole('button', { name: 'Finalizar' }).click()
    await expect(novo).toBeVisible()
  })

  await etapa('criar o campeonato Winner QA', async () => {
    await page.goto('/painel?secao=parametrizacao')
    await page.getByRole('button', { name: 'Novo Campeonato' }).click()
    await page.getByLabel('Nome do campeonato').fill('Winner QA')
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByLabel('Categoria').fill('Masculino')
    await page.getByRole('button', { name: 'Criar e gerar link' }).click()
    const link = page.getByText(/\/inscricao\/categoria\//)
    await expect(link).toBeVisible()
    linkCategoria = (await link.innerText()).trim()
    relatorio.linkCategoria = linkCategoria
  })

  await etapa('parametrizar grupos, sets e mata-mata', async () => {
    await page.goto('/painel?secao=parametrizacao')
    await page.getByLabel('Selecione o seu campeonato').selectOption({ label: 'Winner QA' })
    await page.getByRole('tab', { name: 'Estrutura da competição' }).click()
    await page.getByRole('button', { name: 'Grupos + mata-mata', exact: true }).click()
    await preencherSeExistir(page.getByLabel('Quantidade de Equipes'), '10')
    await concluirSecao(page, async () => {
      await preencherSeExistir(page.getByLabel('Quantidade de grupos'), '2')
      await preencherSeExistir(page.getByLabel('Pontos por set'), '25')
      await preencherSeExistir(page.getByLabel('Sets por partida'), '3')
      const tieBreak = page.getByLabel('Usar tie-break no último set')
      if (await controleVisivel(tieBreak) && !(await tieBreak.isChecked().catch(() => true))) {
        await tieBreak.check({ force: true, timeout: 3_000 })
      }
      await preencherSeExistir(page.getByLabel('Pontos do tie-break'), '15')
    })

    await page.getByRole('tab', { name: 'Classificação' }).click()
    await concluirSecao(page, async () => {
      await preencherSeExistir(page.getByLabel('Classificados por grupo'), '2')
      await preencherSeExistir(page.getByLabel('Melhores classificados gerais'), '0')
    })

    await page.getByRole('tab', { name: 'Eliminatórias' }).click()
    await expect(page.getByText(/Semifinal/)).toBeVisible()
    await concluirSecao(page, async () => {
      const terceiro = page.getByLabel('Disputa de 3º lugar')
      if (await terceiro.isVisible().catch(() => false) && !(await terceiro.isChecked().catch(() => true))) {
        await terceiro.check()
      }
    })

    await page.getByRole('tab', { name: 'Calendário e local' }).click()
    await concluirSecao(page, async () => {
      const inicio = page.getByLabel('Data de início')
      if (await controleVisivel(inicio)) {
        await inicio.fill('01/10/2026', { force: true, timeout: 3_000 })
        await inicio.evaluate((elemento) => elemento.blur()).catch(() => undefined)
      }
      const fim = page.getByLabel('Data de término')
      if (await controleVisivel(fim)) {
        await fim.fill('20/12/2026', { force: true, timeout: 3_000 })
        await fim.evaluate((elemento) => elemento.blur()).catch(() => undefined)
      }
    })

    await page.getByRole('tab', { name: 'Classificação' }).click()
    await concluirSecao(page)
  })

  await etapa('liberar o formulário da inscrição', async () => {
    await page.goto('/painel?secao=parametrizacao')
    await page.getByLabel('Selecione o seu campeonato').selectOption({ label: 'Winner QA' })
    await page.getByRole('tab', { name: 'Inscrições' }).click()
    await clicarWizard(page, 'Salvar')
    await page.getByLabel('Máximo de atletas').fill('20')
    await clicarWizard(page, 'Salvar')
    await expect(page.getByText('Dados dos atletas')).toBeVisible()
    await opcionalNaSecao(page, 'Dados dos atletas', 'Data de nascimento')
    await opcionalNaSecao(page, 'Dados dos atletas', 'Documento')
    await clicarWizard(page, 'Salvar')
    await page.getByRole('button', { name: 'Não usar QR Code' }).evaluate((botao) => (botao as HTMLButtonElement).click())
    await page.getByRole('button', { name: 'Formulário' }).evaluate((botao) => (botao as HTMLButtonElement).click())
    await opcionalNaSecao(page, 'Dados dos atletas', 'Foto')
    await concluirSecao(page)
    relatorio.formulario = 'QR desligado e foto, nascimento e documento do atleta opcionais no assistente. O formulário público ainda lê o padrão da liga e pede nascimento, documento e foto.'
  })

  await etapa('liberar a estrutura sem cobrança', async () => {
    await page.goto('/painel?secao=parametrizacao')
    await page.getByLabel('Selecione o seu campeonato').selectOption({ label: 'Winner QA' })
    await page.getByRole('tab', { name: 'Prévia' }).click()
    const realizar = page.getByRole('button', { name: 'Realizar pagamento' })
    const jaLiberado = page.getByRole('link', { name: 'Ir para criação de grupos' })
    if (await jaLiberado.isVisible().catch(() => false)) {
      await jaLiberado.click()
    } else {
      await expect(realizar).toBeVisible()
      if (!(await realizar.isEnabled())) throw new Error((await page.locator('main').innerText()).slice(0, 1500))
      await realizar.evaluate((botao) => (botao as HTMLButtonElement).click())
      await expect(page).toHaveURL(/\/pagamento/)
      const continuar = page.getByRole('button', { name: 'Continuar sem cobrança' })
      const falha = page.getByText(/Conclua a estrutura|Não foi possível|pendências/)
      let pronto = await continuar.waitFor({ state: 'visible', timeout: 60_000 }).then(() => true).catch(() => false)
      if (!pronto && await falha.isVisible().catch(() => false)) {
        await page.reload()
        pronto = await continuar.waitFor({ state: 'visible', timeout: 30_000 }).then(() => true).catch(() => false)
      }
      if (!pronto) throw new Error((await page.locator('main').innerText()).slice(0, 1500))
      await continuar.evaluate((botao) => (botao as HTMLButtonElement).click())
    }
    const liberou = await page.waitForURL(/\/painel\/estrutura/, { timeout: 25_000 }).then(() => true).catch(() => false)
    if (!liberou) throw new Error((await page.locator('main').innerText()).slice(0, 1500))
    ligaId = new URL(page.url()).searchParams.get('ligaId') ?? ''
    if (!ligaId) throw new Error('A estrutura abriu sem o identificador do campeonato.')
    await expect(page.getByRole('heading', { name: 'Winner QA' })).toBeVisible()
  }, false)

  await etapa('cadastrar 10 times e 140 jogadores', async () => {
    if (!linkCategoria) throw new Error('O link da categoria não apareceu.')
    for (const time of times) {
      console.log(`TIME ${time.nome} (${time.jogadores.length})`)
      await page.goto(linkCategoria)
      await page.getByLabel('Nome da equipe').fill(time.nome)
      const lider = page.getByLabel('Líder da equipe')
      if (await lider.isVisible().catch(() => false)) await lider.fill(time.responsavel)
      await page.getByRole('button', { name: 'Iniciar e salvar cadastro' }).click()
      await expect(page.getByRole('heading', { name: /Cadastre sua equipe/ })).toBeVisible()
      const liderDepois = page.getByLabel('Líder da equipe')
      if (await liderDepois.isVisible().catch(() => false) && !(await liderDepois.inputValue())) {
        await liderDepois.fill(time.responsavel)
      }
      for (let indice = 0; indice < time.jogadores.length; indice += 1) {
        const nome = time.jogadores[indice]
        await page.getByRole('button', { name: 'Novo jogador' }).click()
        await page.getByLabel('Nome completo').fill(nome)
        const numero = page.locator('#jogadorNumero')
        if (await numero.isVisible().catch(() => false)) await numero.fill(String(indice + 1))
        const nascimento = page.locator('#jogadorNascimento')
        if (await nascimento.isVisible().catch(() => false)) await nascimento.fill('1995-01-15')
        const documento = page.locator('#jogadorDocNumero')
        if (await documento.isVisible().catch(() => false)) await documento.fill(String(80000000000 + indice))
        const posicao = page.locator('#jogadorPosicao')
        if (indice === time.jogadores.length - 1 && await posicao.isVisible().catch(() => false)) {
          await posicao.selectOption({ label: 'Líbero' }).catch(() => undefined)
        }
        const foto = page.locator('input[type="file"]').last()
        if (await foto.count()) {
          const envio = page.waitForResponse((resposta) => resposta.url().includes('/storage/') && resposta.ok())
          await foto.setInputFiles(FOTO_JOGADOR)
          await envio
        }
        await page.getByRole('button', { name: 'Salvar jogador' }).click()
        await expect(page.getByText(nome, { exact: false }).first()).toBeVisible()
      }
      const concluir = page.getByRole('button', { name: 'Concluir inscrição' })
      await expect(concluir).toBeVisible()
      await concluir.click()
      await expect(page.getByRole('heading', { name: 'Inscrição enviada' })).toBeVisible()
    }
    relatorio.inscricoes = `${times.length} equipes e ${atletas} jogadores enviados pela interface`
  })

  await etapa('sortear grupos e gerar os jogos', async () => {
    await page.goto(`/painel/estrutura?ligaId=${ligaId}`)
    await expect(page.getByRole('heading', { name: 'Winner QA' })).toBeVisible()
    await expect(page.getByText(times[0].nome).first()).toBeVisible()
    await preencherSeExistir(page.getByLabel('Quantidade de grupos'), '2')
    await preencherSeExistir(page.getByLabel('Classificados por grupo'), '2')
    await page.getByRole('button', { name: 'Sortear' }).first().click()
    await page.getByRole('button', { name: /Confirmar e gerar confrontos|Recriar confrontos de grupos/ }).click()
    await expect(page.getByText(/confronto\(s\) gerado\(s\)|Estrutura salva/)).toBeVisible()
  })

  await etapa('jogar a fase de grupos', async () => {
    const hrefs = await listarSumulas(page)
    if (hrefs.length === 0) throw new Error('Nenhuma súmula apareceu em Jogos.')
    relatorio.partidasDeGrupos = hrefs.length
    for (let indice = 0; indice < hrefs.length; indice += 1) {
      try {
        await jogarPartida(page, hrefs[indice], indice === 0)
      } catch (error) {
        const mensagem = error instanceof Error ? error.message : String(error)
        throw new Error(`Partida de grupos ${indice + 1}/${hrefs.length} (${hrefs[indice]}): ${mensagem}`)
      }
    }
  })

  await etapa('criar e jogar o mata-mata', async () => {
    const jogadas = new Set((await listarSumulas(page)).map(normalizarSumula))
    let rodadas = 0
    for (let volta = 0; volta < 4; volta += 1) {
      const criou = await criarConfrontos(page, ligaId)
      if (volta === 0 && !criou) {
        throw new Error(`Nenhum confronto de mata-mata pôde ser criado. ${(await page.locator('main').innerText()).slice(0, 800)}`)
      }
      const hrefs = await listarSumulas(page)
      const novas = hrefs.filter((href) => !jogadas.has(normalizarSumula(href)))
      if (novas.length === 0) {
        if (!criou) break
        continue
      }
      for (const href of novas) {
        try {
          await jogarPartida(page, href, false)
        } catch (error) {
          const mensagem = error instanceof Error ? error.message : String(error)
          throw new Error(`Mata-mata ${href}: ${mensagem}`)
        }
        jogadas.add(normalizarSumula(href))
        rodadas += 1
      }
    }
    relatorio.partidasDeMataMata = rodadas
    relatorio.sumulasJogadas = jogadas.size
    if (rodadas < 4) throw new Error(`O mata-mata jogou ${rodadas} partidas. O formato pede duas semifinais, a final e a disputa de 3º.`)
  })

  await etapa('ler classificação e pódio', async () => {
    await page.goto('/painel?secao=tabela')
    const seletor = page.locator('select').filter({ has: page.locator('option', { hasText: 'Winner QA' }) }).first()
    if (await seletor.isVisible().catch(() => false)) await seletor.selectOption({ label: 'Winner QA' })
    await expect(page.getByText('Carregando classificação...')).toHaveCount(0)
    relatorio.classificacaoTexto = (await page.locator('main').innerText()).slice(0, 4000)
    await page.screenshot({ path: path.join(ARTEFATOS, 'classificacao-winner-qa.png'), fullPage: true })

    if (ligaId) {
      const organizadorId = await idDoOrganizador(page)
      await page.goto(`/fase-mata-mata?organizador=${encodeURIComponent(organizadorId)}&ligaId=${ligaId}`)
      await expect(page.getByRole('heading', { name: /Chaveamento/ })).toBeVisible()
      relatorio.chaveTexto = (await page.locator('main').innerText()).slice(0, 5000)
      await page.screenshot({ path: path.join(ARTEFATOS, 'chave-winner-qa.png'), fullPage: true })
      const campeao = page.locator('div').filter({ has: page.getByText('Campeão', { exact: true }) }).last()
      if (await campeao.isVisible().catch(() => false)) relatorio.campeao = (await campeao.innerText()).replace(/\s+/g, ' ').trim()
    }

    await page.goto('/painel?secao=parametrizacao')
    await page.getByLabel('Selecione o seu campeonato').selectOption({ label: 'Winner QA' })
    const finalizar = page.getByRole('button', { name: 'Finalizar campeonato' })
    if (await finalizar.isVisible().catch(() => false)) {
      await finalizar.click()
      await page.getByRole('button', { name: 'Confirmar finalização' }).click()
      await expect(page.getByText(/Campeonato finalizado/i).first()).toBeVisible()
      relatorio.finalizacao = 'Campeonato finalizado pela interface.'
    } else {
      relatorio.finalizacao = 'O botão Finalizar campeonato não apareceu. Ele só é exibido com status ATIVA; a última súmula leva o campeonato a ENCERRADA.'
    }

    await page.goto('/painel?secao=campeonatos')
    const linha = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Winner QA', exact: true }) })
    const ver = linha.getByRole('link', { name: 'Ver campeonato' })
    if (await ver.isVisible().catch(() => false)) {
      await ver.click()
      await expect(page.getByRole('heading', { name: 'Winner QA' })).toBeVisible()
      relatorio.paginaPublica = (await page.locator('main').innerText()).slice(0, 4000)
      await page.screenshot({ path: path.join(ARTEFATOS, 'podio-winner-qa.png'), fullPage: true })
      const podio = page.getByRole('list', { name: 'Pódio final do campeonato' })
      if (await podio.isVisible().catch(() => false)) relatorio.podioTexto = (await podio.innerText()).replace(/\s+/g, ' ').trim()
    }
  }, false)

  fs.writeFileSync(path.join(ARTEFATOS, 'relatorio-winner-qa.json'), JSON.stringify({ ...relatorio, falhas }, null, 2))
  if (falhas.length > 0) {
    throw new Error(falhas.map((falha) => `${falha.etapa}: ${falha.erro}${falha.screenshot ? ` (${falha.screenshot})` : ''}`).join('\n'))
  }
})

async function controleVisivel(campo: ReturnType<Page['getByLabel']>) {
  return campo.evaluate((elemento) => {
    const caixa = elemento.getBoundingClientRect()
    const estilo = getComputedStyle(elemento)
    return estilo.visibility !== 'hidden' && estilo.display !== 'none' && caixa.width > 0 && caixa.height > 0
  }).catch(() => false)
}

async function preencherSeExistir(campo: ReturnType<Page['getByLabel']>, valor: string) {
  if (!(await controleVisivel(campo))) return
  await campo.evaluate((elemento, numero) => {
    const input = elemento as HTMLInputElement
    const descritor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
    descritor?.set?.call(input, numero)
    const rastreador = (input as HTMLInputElement & { _valueTracker?: { setValue: (valor: string) => void } })._valueTracker
    rastreador?.setValue('')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, valor)
}

function normalizarSumula(href: string) {
  return href.replace(/\/lancar\/?$/, '').replace(/\/$/, '')
}

async function idDoOrganizador(page: Page) {
  const id = await page.evaluate(() => {
    try {
      const sessao = JSON.parse(localStorage.getItem('luva_session') ?? 'null') as { id?: string } | null
      return sessao?.id ?? ''
    } catch {
      return ''
    }
  })
  if (!id) throw new Error('A sessão do organizador não está no navegador.')
  return id
}

async function listarSumulas(page: Page) {
  await page.goto('/painel?secao=jogos')
  const seletor = page.locator('select').filter({ has: page.locator('option', { hasText: 'Winner QA' }) }).first()
  await expect(seletor).toBeVisible()
  const pedido = page.waitForResponse((resposta) => resposta.url().includes('/api/organizador/partidas') && resposta.request().method() === 'GET', { timeout: 20_000 }).catch(() => null)
  await seletor.selectOption({ label: 'Winner QA' })
  await pedido
  await expect(page.getByText('Carregando...')).toHaveCount(0)
  for (let pagina = 0; pagina < 4; pagina += 1) {
    const mais = page.getByRole('button', { name: 'Ver mais' })
    if (!(await mais.isVisible().catch(() => false))) break
    await mais.click()
    await expect(page.getByText('Carregando...')).toHaveCount(0)
  }
  await expect(page.getByRole('link', { name: 'Abrir súmula' }).first()).toBeVisible()
  return page.getByRole('link', { name: 'Abrir súmula' }).evaluateAll((ancoras) => ancoras.map((ancora) => (ancora as HTMLAnchorElement).href))
}

async function criarConfrontos(page: Page, ligaId: string) {
  const organizadorId = await idDoOrganizador(page)
  await page.goto(`/fase-mata-mata?organizador=${encodeURIComponent(organizadorId)}&ligaId=${ligaId}`)
  await expect(page.getByRole('heading', { name: /Chaveamento/ })).toBeVisible()
  let criou = false
  for (let tentativa = 0; tentativa < 6; tentativa += 1) {
    const botao = page.getByRole('button', { name: 'Criar confronto' }).first()
    if (!(await botao.isVisible().catch(() => false))) break
    const card = botao.locator('xpath=ancestor::div[.//select][1]')
    const selects = card.locator('select')
    await selects.nth(0).selectOption({ index: 1 })
    const escolhidoA = await selects.nth(0).inputValue()
    const opcoesB = selects.nth(1).locator('option')
    const totalB = await opcoesB.count()
    let valorB = ''
    for (let indice = 0; indice < totalB; indice += 1) {
      const candidato = await opcoesB.nth(indice).getAttribute('value')
      const desabilitado = await opcoesB.nth(indice).getAttribute('disabled')
      if (candidato && candidato !== escolhidoA && desabilitado === null) {
        valorB = candidato
        break
      }
    }
    if (!valorB) throw new Error('O confronto não ofereceu dois times diferentes.')
    await selects.nth(1).selectOption(valorB)
    const resposta = page.waitForResponse((resultado) => resultado.url().includes('/mata-mata') && resultado.request().method() === 'POST')
    await botao.click()
    const resultado = await resposta
    if (!resultado.ok()) throw new Error(`Criar confronto respondeu ${resultado.status()}: ${(await resultado.text()).slice(0, 400)}`)
    criou = true
    await expect(botao).toBeHidden()
  }
  return criou
}

async function clicarWizard(page: Page, nome: 'Salvar' | 'Salvar e concluir') {
  const botao = page.getByRole('button', { name: nome, exact: true })
  await expect(botao).toBeVisible({ timeout: 60_000 })
  const gravacao = page.waitForResponse((resposta) => resposta.url().includes('/setup/') && resposta.request().method() === 'PATCH', { timeout: 20_000 }).catch(() => null)
  await botao.evaluate((elemento) => (elemento as HTMLButtonElement).click())
  await gravacao
}

async function opcionalNaSecao(page: Page, secao: string, campo: string) {
  const bloco = page.locator('div').filter({ has: page.getByText(secao, { exact: true }) }).filter({ has: page.getByRole('button', { name: 'Opcional', exact: true }) }).last()
  const linha = bloco.locator('div').filter({ has: page.getByText(campo, { exact: true }) }).filter({ has: page.getByRole('button', { name: 'Opcional', exact: true }) }).last()
  await linha.getByRole('button', { name: 'Opcional', exact: true }).evaluate((botao) => (botao as HTMLButtonElement).click())
}

async function concluirSecao(page: Page, preparar?: () => Promise<void>) {
  for (let passo = 0; passo < 8; passo += 1) {
    if (preparar) await preparar()
    const salvar = page.getByRole('button', { name: 'Salvar', exact: true })
    const concluir = page.getByRole('button', { name: 'Salvar e concluir' })
    await expect(salvar.or(concluir)).toBeVisible({ timeout: 60_000 })
    if (await concluir.isVisible().catch(() => false)) {
      await clicarWizard(page, 'Salvar e concluir')
      await expect(page.getByText('Não foi possível concluir')).toHaveCount(0)
      return
    }
    await clicarWizard(page, 'Salvar')
  }
  throw new Error('A seção não chegou ao botão Salvar e concluir.')
}

async function jogarPartida(page: Page, href: string, detalhada: boolean) {
  const destino = href.endsWith('/lancar') ? href : `${href.replace(/\/$/, '')}/lancar`
  await page.goto(destino)
  await expect(page.locator('h1').first()).toBeVisible()
  const confirmarEquipes = page.getByRole('button', { name: 'Confirmar equipes', exact: true })
  if (await confirmarEquipes.isVisible().catch(() => false)) {
    await confirmarEquipes.click()
    await page.getByRole('button', { name: 'Próximo passo' }).click()
    const capitaes = page.locator('.official-preflow-setup-grid select')
    await expect(capitaes.first()).toBeVisible()
    await capitaes.nth(0).selectOption({ index: 1 })
    await capitaes.nth(1).selectOption({ index: 1 })
    await page.getByRole('button', { name: /Inicia sacando no set/ }).first().click()
    await page.getByRole('button', { name: 'Ir para escalação' }).click()
  }

  await confirmarPapeletas(page, detalhada)
  const iniciar = page.getByRole('button', { name: 'Iniciar partida' })
  if (await iniciar.isVisible().catch(() => false)) await iniciar.click()

  const nomes = await nomesDasEquipes(page)
  if (detalhada) await gestosDaPrimeiraPartida(page, nomes[0])
  await vencerPartida(page, nomes[0])
  const anotacoes = page.getByRole('button', { name: 'Anotações' })
  if (await anotacoes.isVisible().catch(() => false)) await anotacoes.click()
  const mvp = page.locator('select').filter({ hasText: 'MVP da equipe vencedora' }).first()
  if (await mvp.isVisible().catch(() => false)) {
    const valor = await mvp.locator('option').nth(1).getAttribute('value')
    if (valor) await mvp.selectOption(valor)
  }
  const oficializar = page.getByRole('button', { name: 'Oficializar súmula' })
  if (await oficializar.isEnabled().catch(() => false)) await oficializar.click()
  await expect(page.getByText(/Súmula oficializada|oficializada|Ver súmula pública/i).first()).toBeVisible({ timeout: 20_000 })
}

async function confirmarPapeletas(page: Page, editarNumero: boolean) {
  await expect(page.getByRole('heading', { name: /Papeleta de distribuição tática/ })).toBeVisible()
  const sorteio = page.getByRole('button', { name: 'Sortear no aplicativo' })
  if (await sorteio.isVisible().catch(() => false)) await sorteio.click()
  const nomes = await nomesDasEquipes(page)
  for (const nome of nomes) {
    const seletor = page.locator('.official-team-selector').getByRole('button', { name: nome, exact: false }).first()
    if (await seletor.isVisible().catch(() => false)) await seletor.click()
    await preencherVagasVazias(page)
    if (editarNumero) {
      const corrigir = page.getByRole('button', { name: /Corrigir número do atleta/ }).first()
      await expect(corrigir).toBeVisible()
      await corrigir.click()
      const campo = page.getByLabel(/Número do atleta na partida|Número de .+ nesta partida/).first()
      await campo.fill('99')
      await campo.press('Enter')
      editarNumero = false
    }
    const libero = page.locator('.official-libero-start select')
    if (await libero.isVisible().catch(() => false)) {
      const valor = await libero.locator('option').nth(1).getAttribute('value')
      if (valor) await libero.selectOption(valor)
    }
    const saque = page.getByRole('button', { name: `${nome} Inicia sacando no set`, exact: false }).first()
    if (await saque.isVisible().catch(() => false)) await saque.click()
    const confirmar = page.getByRole('button', { name: `Confirmar ${nome}` })
    if (await confirmar.isEnabled().catch(() => false)) await confirmar.click()
  }
}

async function preencherVagasVazias(page: Page) {
  for (let vaga = 0; vaga < 6; vaga += 1) {
    const vazia = page.locator('.official-court [role="button"]', { hasText: 'Sem atleta' }).first()
    if (!(await vazia.isVisible().catch(() => false))) return
    await vazia.click()
    const dialogo = page.getByRole('dialog', { name: 'Escalar atleta' })
    const atleta = dialogo.getByRole('button').filter({ hasNotText: 'Voltar' }).first()
    if (!(await atleta.isVisible().catch(() => false))) return
    await atleta.click()
  }
}

async function gestosDaPrimeiraPartida(page: Page, equipe: string) {
  const doisD = page.getByRole('button', { name: '2D', exact: true })
  if (await doisD.isVisible().catch(() => false)) await doisD.click()
  const ace = page.getByRole('button', { name: `ACE para ${equipe}` })
  await expect(ace).toBeVisible()
  await ace.click()
  const ataque = page.getByRole('button', { name: /Ponto de ataque do atleta/ }).first()
  await expect(ataque).toBeVisible()
  await ataque.click()
  const bloqueio = page.getByRole('button', { name: /Bloqueio do atleta/ }).first()
  if (await bloqueio.isVisible().catch(() => false)) await bloqueio.click()
  await page.getByRole('button', { name: `Registrar +1 para ${equipe} sem atribuir jogador` }).click()
  const substituir = page.getByRole('button', { name: /Substituir atleta/ }).first()
  if (await substituir.isVisible().catch(() => false)) {
    await substituir.click()
    const dialogo = page.getByRole('dialog', { name: 'Anotar substituição' })
    const reserva = dialogo.getByRole('button').filter({ hasNotText: 'Voltar' }).first()
    if (await reserva.isVisible().catch(() => false)) await reserva.click()
    if (await dialogo.isVisible().catch(() => false)) await dialogo.getByRole('button', { name: 'Voltar' }).click()
  }
}

async function vencerPartida(page: Page, equipe: string) {
  const semJogador = page.getByRole('button', { name: `Registrar +1 para ${equipe} sem atribuir jogador` })
  for (let set = 0; set < 5; set += 1) {
    if (await page.getByRole('button', { name: 'Oficializar súmula' }).isVisible().catch(() => false)) return
    if (await page.getByRole('heading', { name: /Papeleta de distribuição tática/ }).isVisible().catch(() => false)) {
      await confirmarPapeletas(page, false)
      const iniciar = page.getByRole('button', { name: 'Iniciar partida' })
      if (await iniciar.isVisible().catch(() => false)) await iniciar.click()
    }
    for (let ponto = 0; ponto < 45; ponto += 1) {
      const encerrar = page.getByRole('dialog').getByRole('button', { name: /Encerrar (set|partida)/ })
      if (await encerrar.isVisible().catch(() => false)) {
        await encerrar.click()
        break
      }
      const aviso = page.getByRole('button', { name: 'Encerrar set atual' })
      if (await aviso.isVisible().catch(() => false)) {
        await aviso.click()
        continue
      }
      if (!(await semJogador.isVisible().catch(() => false))) break
      await semJogador.click()
    }
  }
}

async function nomesDasEquipes(page: Page) {
  const titulo = await page.locator('h1').first().innerText()
  const partes = titulo.split(/\s+vs\s+/i).map((parte) => parte.replace(/\s+/g, ' ').trim()).filter(Boolean)
  return partes.length >= 2 ? partes : [titulo, titulo]
}
