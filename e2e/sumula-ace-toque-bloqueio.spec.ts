import { expect, test } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { abrirPontuacaoDemo } from './sumula-mesa'

test('ACE, toque e bloqueio gravam o atleta e pulsam', async ({ page }) => {
  await abrirPontuacaoDemo(page)

  await page.getByRole('button', { name: 'ACE para Set Point' }).click()
  await expect(page.locator('.sumula-flash-ace').first()).toBeVisible()
  await expect(page.locator('.official-point-history li').first()).toContainText('+1 Ponto de Saque')
  await expect(page.locator('.official-point-history li').first()).toContainText('Jogador 6')

  const mesa = page.locator('.official-facing-court .official-mini-panel').first()
  const carta = mesa.getByRole('button', { name: 'Ponto de ataque do atleta 2' })
  await carta.focus()
  await carta.press('Enter')
  await expect(mesa.locator('.sumula-flash-toque')).toBeVisible()
  await expect(page.locator('.official-point-history li').first()).toContainText('+1 Ponto de Ataque')
  await expect(page.locator('.official-point-history li').first()).toContainText('Jogador 2')

  await mesa.getByRole('button', { name: 'Bloqueio do atleta 1' }).evaluate((botao) => {
    (botao as HTMLButtonElement).click()
  })
  await expect(page.locator('.official-point-history li').first()).toContainText('+1 Ponto de Bloqueio')
  await expect(page.locator('.official-point-history li').first()).toContainText('Jogador 1')
  await expect(mesa.locator('.sumula-flash-bloqueio')).toBeVisible()

  await page.getByRole('button', { name: 'Registrar +1 para Set Point sem atribuir jogador' }).click()
  await expect(page.locator('.official-point-history li').first()).toContainText('Sem jogador')

  mkdirSync('/opt/cursor/artifacts/screenshots', { recursive: true })
  await page.screenshot({
    path: '/opt/cursor/artifacts/screenshots/sumula-ace-toque-bloqueio-390.png',
    fullPage: true,
  })
})

test('prefers-reduced-motion desliga o pulso do ponto', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await abrirPontuacaoDemo(page)
  await page.getByRole('button', { name: 'ACE para Set Point' }).click()
  const pulso = page.locator('.sumula-flash-ace').first()
  await expect(pulso).toBeVisible()
  const animationName = await pulso.evaluate((elemento) => getComputedStyle(elemento).animationName)
  expect(animationName).toBe('none')
})
