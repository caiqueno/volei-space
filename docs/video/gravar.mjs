// Grava o vídeo de demonstração do volei.space (conceito + protótipo navegável) com narração.
// Passos: 1) node docs/video/gerar-audio.mjs   2) app rodando em BASE_URL (build com NEXT_PUBLIC_PROTOTIPO_ATIVO=1)
//         3) node docs/video/gravar.mjs         4) node docs/video/montar.mjs (junta áudio e vídeo em .mp4)
// Não usa banco nem rede externa. Saídas: docs/video/_gravacao/video.webm e _gravacao/linha-do-tempo.json
import { chromium } from 'playwright-core'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
const BASE = process.env.BASE_URL ?? 'http://localhost:3111'
const tmp = join(aqui, '_gravacao')
const pausa = (ms) => new Promise((r) => setTimeout(r, ms))
const dur = JSON.parse(readFileSync(join(aqui, '_audio', 'duracoes.json'), 'utf8'))

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync)
if (!CHROME) throw new Error('Chrome/Edge não encontrado')
if (existsSync(tmp)) rmSync(tmp, { recursive: true, force: true })
mkdirSync(tmp, { recursive: true })

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: tmp, size: { width: 1280, height: 720 } }, locale: 'pt-BR' })
const page = await context.newPage()
const t0 = Date.now()
const linha = []

// Fala `id` (começa agora), executa `acoes` em paralelo e só segue quando a fala terminou.
async function cena(id, acoes, minimoMs = 0) {
  const inicio = Date.now() - t0
  linha.push({ id, inicioMs: inicio })
  const fim = Date.now() + Math.max(dur[id] * 1000 + 900, minimoMs)
  if (acoes) await acoes()
  const resta = fim - Date.now()
  if (resta > 0) await pausa(resta)
}

async function legenda(texto) {
  await page.evaluate((t) => {
    let el = document.getElementById('__legenda')
    if (!el) {
      el = document.createElement('div')
      el.id = '__legenda'
      el.setAttribute('aria-hidden', 'true')
      el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:18px;max-width:92%;z-index:2147483647;background:rgba(6,20,38,.92);color:#f2f6fb;border:2px solid #f5b82e;border-radius:12px;padding:10px 20px;font:600 21px "Segoe UI",system-ui,sans-serif;text-align:center;pointer-events:none'
      document.body.appendChild(el)
    }
    el.textContent = t
    el.style.display = t ? 'block' : 'none'
  }, texto).catch(() => {})
}

async function clicar(nome, vezes = 1, espera = 800) {
  for (let i = 0; i < vezes; i++) {
    const b = page.getByRole('button', { name: nome }).first()
    if (!(await b.count())) return
    await b.click({ timeout: 2000 }).catch(() => {})
    await pausa(espera)
  }
}
async function proximo() {
  const p = page.getByRole('link', { name: /próximo/i }).or(page.getByRole('button', { name: /próximo/i })).first()
  if (!(await p.count()) || (await p.isDisabled().catch(() => false))) return false
  await p.click({ timeout: 2500 }).catch(() => {})
  await page.waitForLoadState('networkidle').catch(() => {})
  return true
}
async function ir(caminho) {
  await page.goto(`${BASE}${caminho}`, { waitUntil: 'networkidle' })
}

// 1) Conceito
await page.goto(pathToFileURL(resolve(aqui, 'conceito.html')).href)
const visualMin = { c0: 6000, c1: 8000, c2: 8000, c3: 8000, c4: 8000, c5: 4500 }
for (const id of ['c0', 'c1', 'c2', 'c3', 'c4', 'c5']) {
  await page.evaluate((n) => window.mostrar(n), Number(id.slice(1)))
  await cena(id, null, visualMin[id])
}
await page.evaluate(() => window.esconder())
await pausa(500)

// 2) Protótipo
await ir('/prototipo')
await legenda('Protótipo navegável: dados de exemplo, nada é gravado')
await pausa(2500)

// Líder
await ir('/prototipo/lider/cadastrar-time')
await legenda('Líder do time')
await cena('lider', async () => {
  for (let i = 0; i < 3; i++) { await pausa(1800); if (!(await proximo())) break }
})

// Atleta
await ir('/prototipo/atleta/convite')
await legenda('Atleta convidado')
await cena('atleta', async () => {
  for (let i = 0; i < 2; i++) { await pausa(2000); if (!(await proximo())) break }
})

// Apontador: pontos, rotação, tempos, pedido do banco, desafio e fechamento
await ir('/prototipo/apontador/placar')
await legenda('Apontador: um toque por ponto')
await cena('apontador1', async () => {
  const seq = [/ponto.*exemplo a/i, /ponto.*exemplo a/i, /ponto.*exemplo b/i, /ponto.*exemplo a/i, /ponto.*exemplo b/i]
  for (const s of seq) await clicar(s, 1, 900)
})
await proximo()
await legenda('Rotação: o time que ganha o saque gira uma posição')
await cena('apontador2', async () => {
  await pausa(1500)
  await clicar(/dar ponto ao time que recebe/i, 4, 1700)
})
await proximo()
await legenda('Tempos e substituições, com limites por set')
await cena('apontador3', async () => {
  await pausa(900)
  await clicar(/pedir tempo/i, 1, 1200)
  await clicar(/substitui/i, 1, 1200)
})
await proximo()
await legenda('Pedido do banco: aceitar ou recusar')
await cena('apontador4', async () => {
  await pausa(900)
  await clicar(/simular pedido/i, 1, 1500)
  await clicar(/^aceitar$/i, 1, 1200)
})
await proximo()
await legenda('Desafio de vídeo e fechamento da súmula')
await cena('apontador5', async () => {
  await pausa(1800)
  await proximo()
  await pausa(1800)
})

// Banco
await ir('/prototipo/banco/papeleta')
await legenda('Banco da equipe, no celular')
await cena('banco', async () => {
  for (let i = 0; i < 2; i++) { await pausa(2300); if (!(await proximo())) break }
})

// Árbitro
await ir('/prototipo/arbitro/consulta')
await legenda('Árbitro: consulta ao vivo')
await cena('arbitro', null, 4500)

// Organizador
await ir('/prototipo/organizador/competicao')
await legenda('Organizador')
await cena('organizador', async () => {
  for (let i = 0; i < 3; i++) { await pausa(1300); if (!(await proximo())) break }
})

// Espectador
await ir('/prototipo/espectador/ao-vivo')
await legenda('Espectador: placar ao vivo')
await cena('espectador', null, 3800)

// 3) Encerramento
await legenda('')
await page.goto(pathToFileURL(resolve(aqui, 'conceito.html')).href)
await page.evaluate(() => window.mostrar(6))
await cena('c6', null, 9000)
await pausa(800)

const arquivo = await page.video().path()
await context.close()
await browser.close()
renameSync(arquivo, join(tmp, 'video.webm'))
writeFileSync(join(tmp, 'linha-do-tempo.json'), JSON.stringify(linha, null, 2))
console.log('Gravado:', join(tmp, 'video.webm'), '—', linha.length, 'falas')
