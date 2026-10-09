import { expect, test } from '@playwright/test'
import { assinarCorpo, webhookPago } from './assinatura'
import { candidaturaDoRoteiro, jogadorDoRoteiro } from './env'

test('o servidor de teste abre o login', async ({ page }) => {
  const resposta = await page.goto('/login')
  expect(resposta?.status()).toBeLessThan(400)
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
})

test('visitante em /admin é enviado ao login', async ({ page }) => {
  await page.goto('/admin/candidaturas')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
})

test('etapa A — candidatura de equipe responde 201 com id', async ({ request }) => {
  test.fail(true, 'COMO-TESTAR.txt espera 201 com id. O corpo do roteiro não tem senha; a rota responde 422 porque candidaturaEquipeSchema exige senha.')
  const resposta = await request.post('/api/candidaturas/equipes', { data: candidaturaDoRoteiro })
  expect(resposta.status()).toBe(201)
  const json = await resposta.json()
  expect(json.data?.id ?? json.id).toBeTruthy()
})

test('etapa B — admin vê Volei Touchet pendente', async ({ page }) => {
  test.fail(true, 'O roteiro entra em /admin/login com admin@luv.com.br e LuvAdmin@2026 e espera a candidatura PENDENTE. /admin/login redireciona para /login; o admin não é essa senha fixa (vem da tabela Admin); GET /api/admin/candidaturas?tipo=equipe devolve lista vazia.')
  await page.goto('/admin/login')
  await page.getByRole('button', { name: 'Membro' }).click()
  await page.getByLabel('E-mail').fill('admin@luv.com.br')
  await page.getByLabel('Senha').fill('LuvAdmin@2026')
  await page.getByRole('button', { name: 'Entrar' }).click()
  const candidaturas = page.getByRole('link', { name: 'Candidaturas' })
  await expect(candidaturas).toBeVisible({ timeout: 8_000 })
  await candidaturas.click()
  await expect(page.getByText('Volei Touchet')).toBeVisible({ timeout: 8_000 })
  await expect(page.getByText('PENDENTE')).toBeVisible({ timeout: 8_000 })
})

test('etapa C — aprovar a candidatura da equipe', async ({ page }) => {
  test.fail(true, 'Não há botão de aprovar equipe. A tela só lista árbitro, quadra e organizador, e POST /api/admin/candidaturas/[id]/aprovar rejeita tipo equipe com 422.')
  await page.goto('/admin/candidaturas')
  await expect(page.getByRole('button', { name: /Aprovar/ }).first()).toBeVisible({ timeout: 8_000 })
  await expect(page.getByText('Volei Touchet')).toBeVisible({ timeout: 8_000 })
  await page.getByRole('button', { name: /Aprovar/ }).first().click()
  await expect(page.getByText('APROVADA')).toBeVisible({ timeout: 8_000 })
})

test('etapa D — webhook assinado confirma o pagamento', async ({ request }) => {
  test.fail(true, 'O webhook assinado de status paid responde { received: true }. O roteiro espera { data: { received: true } } e a criação da equipe. O erro de persistência também é engolido com 200.')
  const raw = JSON.stringify(webhookPago())
  const resposta = await request.post('/api/webhooks/infinitepay', {
    headers: {
      'content-type': 'application/json',
      'x-infinitepay-signature': assinarCorpo(raw),
    },
    data: raw,
  })
  expect(resposta.status()).toBe(200)
  expect(await resposta.json()).toEqual({ data: { received: true } })
})

test('etapa E — a equipe Volei Touchet existe com slug', async ({ request }) => {
  test.fail(true, 'GET /api/equipes não encontra Volei Touchet com slug volei-touchet: a etapa A não cria a candidatura e o webhook não grava Equipe quando o Supabase está ausente.')
  const resposta = await request.get('/api/equipes')
  expect(resposta.ok()).toBe(true)
  const json = await resposta.json()
  const equipe = (json.data ?? json).find((item: { nome?: string }) => item.nome === 'Volei Touchet')
  expect(equipe?.slug).toBe('volei-touchet')
})

test('etapa F — inscrição do atleta exibe o QR Code', async ({ page }) => {
  test.fail(true, '/inscricao/[slug] não tem formulário. Sem equipe mostra "Equipe não encontrada"; com equipe mostra "Cadastro pelo convite" e orienta o link do organizador. Não há botão "Concluir cadastro e gerar QR Code".')
  await page.goto('/inscricao/volei-touchet')
  await expect(page.getByText('Volei Touchet')).toBeVisible({ timeout: 8_000 })
  await page.getByLabel(/Nome completo/i).fill(jogadorDoRoteiro.nome)
  await page.getByLabel(/Data de nascimento/i).fill('2000-04-12')
  await page.getByLabel('CPF').fill(jogadorDoRoteiro.cpf)
  await page.getByLabel(/E-mail/i).fill(jogadorDoRoteiro.email)
  await page.getByLabel('Celular').fill(jogadorDoRoteiro.celular)
  await page.getByLabel(/emergência/i).fill(jogadorDoRoteiro.telefoneEmergencia)
  await page.getByRole('button', { name: 'Concluir cadastro e gerar QR Code' }).click()
  await expect(page.getByText(/QR Code/i)).toBeVisible({ timeout: 8_000 })
})

test('etapa G — o QR Code devolve jogador, equipe e foto', async ({ request }) => {
  test.fail(true, 'Não há token emitido pela etapa F. O GET implementado, quando o token existe, devolve só nomeCompleto, fotoUrl e qrCodeGeradoEm, sem a equipe. O roteiro espera dados do jogador + equipe + foto.')
  const resposta = await request.get('/api/jogadores/qr/token-da-etapa-f')
  expect(resposta.ok()).toBe(true)
  const json = await resposta.json()
  const dados = json.data ?? json
  expect(dados.nome ?? dados.nomeCompleto).toBeTruthy()
  expect(dados.equipe ?? dados.equipeNome).toBeTruthy()
  expect(dados).toHaveProperty('foto')
})
