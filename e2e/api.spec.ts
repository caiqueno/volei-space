import { expect, test } from '@playwright/test'
import { assinarCorpo, webhookPago } from './assinatura'
import { candidaturaDoRoteiro, jogadorDoRoteiro } from './env'

const rotasAdmin = [
  ['GET', '/api/admin/candidaturas'],
  ['POST', '/api/admin/candidaturas/inexistente/aprovar'],
  ['POST', '/api/admin/candidaturas/inexistente/rejeitar'],
  ['POST', '/api/admin/candidaturas/inexistente/reenviar'],
  ['GET', '/api/admin/organizadores'],
  ['POST', '/api/admin/organizadores'],
  ['PATCH', '/api/admin/organizadores'],
  ['GET', '/api/admin/codigos-acesso'],
  ['POST', '/api/admin/codigos-acesso'],
  ['GET', '/api/admin/simulacoes'],
  ['POST', '/api/admin/simulacoes'],
  ['POST', '/api/admin/partidas-candidaturas/inexistente/aprovar'],
] as const

test.describe('API no servidor local', () => {
  test('webhook com assinatura inválida de mesmo tamanho responde 401', async ({ request }) => {
    const raw = JSON.stringify(webhookPago())
    const resposta = await request.post('/api/webhooks/infinitepay', {
      headers: {
        'content-type': 'application/json',
        'x-infinitepay-signature': 'f'.repeat(64),
      },
      data: raw,
    })
    expect(resposta.status()).toBe(401)
    expect(await resposta.json()).toMatchObject({ error: 'Assinatura inválida' })
  })

  test('webhook sem o header x-infinitepay-signature responde 401', async ({ request }) => {
    const resposta = await request.post('/api/webhooks/infinitepay', {
      headers: { 'content-type': 'application/json' },
      data: webhookPago(),
    })
    expect(resposta.status()).toBe(401)
    expect(await resposta.json()).toMatchObject({ error: 'Assinatura inválida' })
  })

  test('assinatura curta inválida responde 401', async ({ request }) => {
    test.fail(true, 'validateWebhookSignature compara os buffers com timingSafeEqual sem igualar o tamanho. Uma assinatura curta lança ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH e o Next responde 500, em vez de 401 Assinatura inválida.')
    const resposta = await request.post('/api/webhooks/infinitepay', {
      headers: {
        'content-type': 'application/json',
        'x-infinitepay-signature': 'curta',
      },
      data: webhookPago(),
    })
    expect(resposta.status()).toBe(401)
    expect(await resposta.json()).toMatchObject({ error: 'Assinatura inválida' })
  })

  test('status diferente de paid é acusado com 200', async ({ request }) => {
    for (const status of ['pending', 'cancelled', 'expired']) {
      const corpo = { ...webhookPago(), status }
      const raw = JSON.stringify(corpo)
      const resposta = await request.post('/api/webhooks/infinitepay', {
        headers: {
          'content-type': 'application/json',
          'x-infinitepay-signature': assinarCorpo(raw),
        },
        data: raw,
      })
      expect(resposta.status(), status).toBe(200)
      const json = await resposta.json()
      expect(json.received ?? json.data?.received, status).toBe(true)
    }
  })

  test('webhook pago segue o envelope do roteiro', async ({ request }) => {
    test.fail(true, 'COMO-TESTAR.txt espera { data: { received: true } }. A rota responde { received: true } sem o envelope data.')
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

  test('falha ao processar pagamento pago não é engolida com 200', async ({ request }) => {
    test.fail(true, 'Candidatura inexistente faz o Supabase lançar. O catch da rota registra o erro e mesmo assim responde 200 { received: true }, então o InfinitePay não repete e a equipe não é criada.')
    const raw = JSON.stringify(webhookPago('id-que-nao-existe'))
    const resposta = await request.post('/api/webhooks/infinitepay', {
      headers: {
        'content-type': 'application/json',
        'x-infinitepay-signature': assinarCorpo(raw),
      },
      data: raw,
    })
    expect(resposta.status()).not.toBe(200)
  })

  test('webhook pago repetido não duplica a equipe', async () => {
    test.skip(true, 'Sem banco de teste a rota não persiste Equipe: o erro do Supabase é engolido com 200. Não dá para contar linhas e provar a ausência de duplicata, e o Supabase de produção está fora deste fluxo. O guarda candidatura.status === ATIVA existe no handler, mas não é observável aqui.')
  })

  test('POST /api/candidaturas/equipes com o corpo do roteiro responde 201', async ({ request }) => {
    test.fail(true, 'O corpo de COMO-TESTAR.txt não envia senha. candidaturaEquipeSchema exige senha de 8 caracteres e a rota responde 422 Dados inválidos, não 201 com id.')
    const resposta = await request.post('/api/candidaturas/equipes', { data: candidaturaDoRoteiro })
    expect(resposta.status()).toBe(201)
    const json = await resposta.json()
    expect(json.data?.id ?? json.id).toBeTruthy()
  })

  test('POST /api/candidaturas/equipes inválido responde 400', async ({ request }) => {
    test.fail(true, 'Corpo vazio é rejeitado com 422 Dados inválidos. O contrato pedido para este teste é 400.')
    const resposta = await request.post('/api/candidaturas/equipes', { data: {} })
    expect(resposta.status()).toBe(400)
  })

  test('CPF repetido no cadastro público do atleta é recusado', async ({ request }) => {
    test.fail(true, 'POST /api/inscricao/[slug]/jogadores responde 403 para qualquer corpo: o slug público não cadastra atleta. O formulário de /inscricao/[slug] também não existe mais, então o CPF duplicado do roteiro não é validado. Jogador.cpf não tem unicidade no schema.')
    const primeira = await request.post('/api/inscricao/volei-touchet/jogadores', { data: jogadorDoRoteiro })
    expect(primeira.status()).toBe(201)
    const segunda = await request.post('/api/inscricao/volei-touchet/jogadores', { data: jogadorDoRoteiro })
    expect(segunda.status()).toBeGreaterThanOrEqual(400)
    expect(segunda.status()).not.toBe(201)
    const json = await segunda.json()
    expect(JSON.stringify(json)).toMatch(/cpf/i)
  })

  test('GET /api/jogadores/qr com token inválido responde 404', async ({ request }) => {
    test.fail(true, 'Sem Supabase configurado o client indisponível lança ao consultar Jogador, e a rota não captura o erro. O Next responde 500. Com banco, o próprio handler devolveria 404 QR Code inválido ou jogador não encontrado.')
    const resposta = await request.get('/api/jogadores/qr/token-inexistente')
    expect(resposta.status()).toBe(404)
    const json = await resposta.json()
    expect(json.error).toMatch(/inválido|não encontrado/i)
  })

  test('GET /api/jogadores/qr com token válido devolve jogador, equipe e foto', async () => {
    test.skip(true, 'Não há linha de Jogador neste ambiente e o Supabase de produção não entra no teste. O handler implementado seleciona só nome, fotoRostoUrl, fotoUrl e qrCodeGeradoEm e responde { data: { nomeCompleto, fotoUrl, qrCodeGeradoEm } }. O roteiro espera dados do jogador + equipe + foto.')
  })

  for (const [method, path] of rotasAdmin) {
    test(`${method} ${path} sem autenticação é negado`, async ({ request }) => {
      const resposta = await request.fetch(path, {
        method,
        headers: { 'content-type': 'application/json' },
        data: method === 'GET' ? undefined : {},
      })
      expect(resposta.status(), path).toBe(401)
      expect(await resposta.json()).toMatchObject({ error: 'Não autorizado' })
    })
  }

  test('Bearer inválido em /api/admin/candidaturas é negado', async ({ request }) => {
    const resposta = await request.get('/api/admin/candidaturas', {
      headers: { authorization: 'Bearer nao-e-um-jwt' },
    })
    expect(resposta.status()).toBe(401)
    expect(await resposta.json()).toMatchObject({ error: 'Não autorizado' })
  })
})
