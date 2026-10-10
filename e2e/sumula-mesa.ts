import { expect, type Page } from '@playwright/test'

const TOKEN = '/sumula/token-demo-1-luv2026/lancar'

export async function abrirPontuacaoDemo(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(TOKEN)
  await expect(page.getByRole('heading', { name: 'Set Point vs Líbero FC' })).toBeVisible()
  await page.getByRole('button', { name: 'Confirmar equipes', exact: true }).click()
  await page.getByRole('button', { name: 'Próximo passo' }).click()
  const selects = page.locator('.official-preflow-setup-grid select')
  await selects.nth(0).selectOption('1')
  await selects.nth(1).selectOption('1')
  await page.getByRole('button', { name: 'Set Point Inicia sacando no set 1' }).click()
  await page.getByRole('button', { name: 'Ir para escalação' }).click()
  await expect(page.getByRole('heading', { name: /Papeleta de distribuição tática - Set 1/ })).toBeVisible()

  await escalarTime(page, '8')
  await page.getByRole('button', { name: 'Confirmar Set Point' }).click()
  await page.getByRole('tab', { name: /líbero fc/i }).click()
  await escalarTime(page, '8')
  await page.getByRole('button', { name: 'Confirmar Líbero FC' }).click()
  await page.getByRole('button', { name: 'Iniciar partida' }).click()
  await expect(page.getByRole('button', { name: 'ACE para Set Point' })).toBeVisible()
  await page.getByRole('button', { name: '2D' }).click()
  await expect(page.getByRole('button', { name: 'Ponto de ataque do atleta 2' }).first()).toBeVisible()
}

async function escalarTime(page: Page, libero: string) {
  const vagas = page.locator('.official-court [role="button"]')
  await expect(vagas).toHaveCount(6)
  const numeros = (await vagas.locator('strong').allTextContents()).map((item) => item.trim())
  const sugerida = numeros.join(',') === '#1,#2,#3,#4,#5,#6'
  const vazia = numeros.every((item) => item === 'Sem atleta')
  expect(sugerida || vazia, `escalação inesperada: ${numeros.join(' | ')}`).toBe(true)
  if (vazia) {
    for (const numero of ['1', '2', '3', '4', '5', '6']) {
      const vaga = page.locator('.official-court [role="button"]', { hasText: 'Sem atleta' }).first()
      await vaga.click()
      await page.getByRole('dialog', { name: 'Escalar atleta' }).getByRole('button', { name: `#${numero} - Jogador ${numero}` }).click()
    }
  }
  await page.locator('.official-libero-start select').selectOption(libero)
}
