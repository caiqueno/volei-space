import { expect, test } from '@playwright/test'

const rotasPublicas = [
  '/api/portal/classificacao',
  '/api/portal/jogos',
  '/api/portal/rankings',
  '/api/portal/rankings/jogadores',
  '/api/categorias',
]

test.describe('isolamento por categoria', () => {
  for (const rota of rotasPublicas) {
    test(`${rota} sem campeonato responde 422`, async ({ request }) => {
      const resposta = await request.get(rota)
      expect(resposta.status()).toBe(422)
    })

    test(`${rota} com categoria inválida responde 422 antes do banco`, async ({ request }) => {
      const resposta = await request.get(`${rota}?ligaId=1&categoria=nao-e-uuid`)
      expect(resposta.status()).toBe(422)
    })
  }

  test('gerar grupos sem sessão responde 401', async ({ request }) => {
    const resposta = await request.post('/api/organizador/ligas/1/estrutura', {
      data: { categoriaCampeonatoId: '11111111-1111-4111-8111-111111111111' },
    })
    expect(resposta.status()).toBe(401)
  })

  test('calendário sem sessão responde 401', async ({ request }) => {
    const resposta = await request.patch('/api/organizador/ligas/1/calendario', {
      data: { categoriaCampeonatoId: '11111111-1111-4111-8111-111111111111', partidas: [{ id: 1 }] },
    })
    expect(resposta.status()).toBe(401)
  })
})
