import { expect, test } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { abrirPontuacaoDemo } from './sumula-mesa'

async function encerrarPrimeiroSet(page: import('@playwright/test').Page) {
  const mais = page.getByRole('button', { name: 'Registrar +1 para Set Point sem atribuir jogador' })
  for (let ponto = 0; ponto < 21; ponto += 1) {
    await mais.evaluate((botao) => {
      (botao as HTMLButtonElement).click()
    })
  }
  const dialogo = page.getByRole('dialog')
  await expect(dialogo.getByRole('heading', { name: /set point venceu por 21 x 0/i })).toBeVisible()
  await dialogo.getByRole('button', { name: 'Encerrar set' }).click()
}

test('encerrar o set troca o lado e entrega o saque ao outro time', async ({ page }) => {
  await abrirPontuacaoDemo(page)
  await encerrarPrimeiroSet(page)

  await expect(page.getByRole('heading', { name: 'Líbero FC vs Set Point' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Papeleta de distribuição tática - Set 2/ })).toBeVisible()
  await expect(page.getByText('Alternância obrigatória')).toBeVisible()
  await expect(page.getByText(/líbero fc começa sacando neste set porque não sacou no set 1\./i)).toBeVisible()
  const pulso = page.locator('h3.sumula-micro-set')
  await expect(pulso).toBeVisible()
  const animationName = await pulso.evaluate((elemento) => getComputedStyle(elemento).animationName)
  expect(animationName).toBe('sumula-micro-set')

  mkdirSync('/opt/cursor/artifacts/screenshots', { recursive: true })
  await page.screenshot({
    path: '/opt/cursor/artifacts/screenshots/sumula-troca-set-390.png',
    fullPage: true,
  })
})

test('prefers-reduced-motion desliga o pulso da troca de set', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await abrirPontuacaoDemo(page)
  await encerrarPrimeiroSet(page)
  const pulso = page.locator('h3.sumula-micro-set')
  await expect(pulso).toBeVisible()
  const animationName = await pulso.evaluate((elemento) => getComputedStyle(elemento).animationName)
  expect(animationName).toBe('none')
})
