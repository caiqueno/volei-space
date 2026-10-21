import assert from 'node:assert/strict'
import {
  acoesAgora,
  destinoFinal,
  destinoPosLoginSeguro,
  emailValido,
  ESTADO_INICIAL,
  itemNavLiderAtual,
  lerConfirmar,
  loginSemSenhaAtivo,
  loginWhatsappAtivo,
  mensagemErro,
  NAV_LIDER,
  normalizarCodigo,
  normalizarTelefone,
  rotuloReenvio,
  segundosRestantes,
  telefoneValido,
  transicaoLogin,
  type EstadoLogin,
  type Perfil,
} from '../src/lib/login-sem-senha-ui/regras'

// flags
assert.equal(loginSemSenhaAtivo('1'), true)
assert.equal(loginSemSenhaAtivo('0'), false)
assert.equal(loginSemSenhaAtivo(undefined), false)
assert.equal(loginWhatsappAtivo('1', true), true)
assert.equal(loginWhatsappAtivo('1', false), false)
assert.equal(loginWhatsappAtivo(undefined, true), false)

// entradas
assert.equal(emailValido('a@b.co'), true)
assert.equal(emailValido('a@b'), false)
assert.equal(normalizarCodigo('123 456 789'), '123456')
assert.equal(normalizarCodigo('12-34ab'), '1234')
assert.equal(normalizarTelefone('+55 (11) 91234-5678'), '11912345678')
assert.equal(telefoneValido('11912345678'), true)
assert.equal(telefoneValido('1234'), false)

// reenvio
assert.equal(segundosRestantes(1000, 31000), 30)
assert.equal(segundosRestantes(31000, 31000), 0)
assert.equal(segundosRestantes(99000, 31000), 0)
assert.equal(rotuloReenvio(12), 'Reenviar código em 12 s')
assert.equal(rotuloReenvio(0), 'Reenviar código')

// mensagens
assert.match(mensagemErro(429, undefined, 'confirmar'), /Muitas tentativas/)
assert.match(mensagemErro(429, undefined, 'solicitar'), /Muitos pedidos/)
assert.match(mensagemErro(401, 'CODIGO_INVALIDO', 'confirmar'), /incorreto/)
assert.match(mensagemErro(410, undefined, 'confirmar'), /expirou/)
assert.match(mensagemErro(400, 'CODIGO_EXPIRADO', 'confirmar'), /expirou/)
assert.match(mensagemErro(404, undefined, 'solicitar'), /senha/)
assert.match(mensagemErro(503, undefined, 'solicitar'), /senha/)
assert.match(mensagemErro(0, undefined, 'solicitar'), /conexão/)
assert.match(mensagemErro(500, undefined, 'confirmar', 'detalhe interno'), /Tente de novo/)

// destino seguro
assert.equal(destinoPosLoginSeguro('/meu-time/novo'), '/meu-time/novo')
assert.equal(destinoPosLoginSeguro('/painel'), '/painel')
assert.equal(destinoPosLoginSeguro('/inscricao/abc?x=1'), '/inscricao/abc?x=1')
for (const ruim of ['https://evil.com', '//evil.com', '/\\evil.com', '/admin', '/meu-timex', '/login', '', null, undefined, '/meu-time/%0d%0a', '%2F%2Fevil.com', '/inscricao-rapida']) {
  assert.equal(destinoPosLoginSeguro(ruim as string | null | undefined), null, String(ruim))
}
assert.equal(destinoFinal('LIDER', null), '/meu-time')
assert.equal(destinoFinal('ORGANIZADOR', null), '/painel')
assert.equal(destinoFinal('LIDER', '/meu-time/campeonatos'), '/meu-time/campeonatos')
assert.equal(destinoFinal('LIDER', '/painel'), '/meu-time')
assert.equal(destinoFinal('ORGANIZADOR', '/inscricao/x'), '/inscricao/x')
assert.equal(destinoFinal('LIDER', 'https://evil.com'), '/meu-time')

// resposta de confirmar
const lider: Perfil = { perfil: 'LIDER', referenciaId: 'u1', rotulo: 'Time Alfa' }
const org: Perfil = { perfil: 'ORGANIZADOR', referenciaId: 'o1', rotulo: 'Liga Beta' }
assert.deepEqual(lerConfirmar({ data: { novaConta: true } }), { tipo: 'novaConta' })
assert.equal(lerConfirmar({ data: { perfis: [] } }), null)
assert.equal(lerConfirmar(null), null)
assert.equal(lerConfirmar({ data: { perfis: [{ perfil: 'X', referenciaId: '1', rotulo: 'a' }] } }), null)
const um = lerConfirmar({ data: { perfis: [lider, lider], perfilAtivo: lider } })
assert.ok(um && um.tipo === 'perfis' && um.perfis.length === 1 && um.perfilAtivo?.perfil === 'LIDER')
const dois = lerConfirmar({ data: { perfis: [lider, org], perfilAtivo: 'ORGANIZADOR' } })
assert.ok(dois && dois.tipo === 'perfis' && dois.perfilAtivo?.referenciaId === 'o1')

// máquina de estados
let e: EstadoLogin = ESTADO_INICIAL
e = transicaoLogin(e, { tipo: 'enviar', email: 'ruim' })
assert.equal(e.passo, 'email')
assert.ok('erro' in e && e.erro)
e = transicaoLogin(e, { tipo: 'enviar', email: ' a@b.com ' })
assert.deepEqual(e, { passo: 'enviando', email: 'a@b.com' })
e = transicaoLogin(e, { tipo: 'falhaEnvio', mensagem: 'x' })
assert.equal(e.passo, 'email')
e = transicaoLogin({ passo: 'enviando', email: 'a@b.com' }, { tipo: 'enviado', agora: 1000 })
assert.deepEqual(e, { passo: 'codigo', email: 'a@b.com', liberaReenvioEm: 31000 })
// reenvio bloqueado durante a contagem, liberado depois
assert.equal(transicaoLogin(e, { tipo: 'reenviar', agora: 5000 }), e)
assert.deepEqual(transicaoLogin(e, { tipo: 'reenviar', agora: 31000 }), { passo: 'enviando', email: 'a@b.com', reenvio: true })
// erro de código mantém na tela do código
let c = transicaoLogin(e, { tipo: 'confirmar' })
assert.equal(c.passo, 'confirmando')
c = transicaoLogin(c, { tipo: 'falhaConfirmar', mensagem: 'Código incorreto.' })
assert.equal(c.passo, 'codigo')
// um perfil entra direto
c = transicaoLogin(transicaoLogin(e, { tipo: 'confirmar' }), { tipo: 'confirmado', resultado: { tipo: 'perfis', perfis: [org], perfilAtivo: org } })
assert.deepEqual(c, { passo: 'concluido', destino: '/painel' })
// continuação segura
c = transicaoLogin(transicaoLogin(e, { tipo: 'confirmar' }), { tipo: 'confirmado', resultado: { tipo: 'perfis', perfis: [lider], perfilAtivo: lider }, continuar: '/meu-time/novo' })
assert.deepEqual(c, { passo: 'concluido', destino: '/meu-time/novo' })
// vários perfis: escolher
c = transicaoLogin(transicaoLogin(e, { tipo: 'confirmar' }), { tipo: 'confirmado', resultado: { tipo: 'perfis', perfis: [lider, org], perfilAtivo: lider } })
assert.equal(c.passo, 'perfil')
assert.deepEqual(transicaoLogin(c, { tipo: 'escolheu', perfil: org }), { passo: 'concluido', destino: '/painel' })
assert.deepEqual(transicaoLogin(c, { tipo: 'escolheu', perfil: lider, continuar: '//evil.com' }), { passo: 'concluido', destino: '/meu-time' })
// conta nova: onboarding
c = transicaoLogin(transicaoLogin(e, { tipo: 'confirmar' }), { tipo: 'confirmado', resultado: { tipo: 'novaConta' } })
assert.deepEqual(c, { passo: 'onboarding' })
// eventos fora de hora não mudam nada
assert.equal(transicaoLogin(ESTADO_INICIAL, { tipo: 'confirmado', resultado: { tipo: 'novaConta' } }), ESTADO_INICIAL)
assert.equal(transicaoLogin(ESTADO_INICIAL, { tipo: 'escolheu', perfil: lider }), ESTADO_INICIAL)
assert.deepEqual(transicaoLogin(e, { tipo: 'trocarEmail' }), { passo: 'email' })

// navegação do líder
assert.deepEqual(NAV_LIDER.map((i) => i.rotulo), ['Início', 'Meu Time', 'Competições', 'Jogos', 'Perfil'])
const item = (r: string) => NAV_LIDER.find((i) => i.rotulo === r)!
assert.equal(itemNavLiderAtual('/meu-time', item('Meu Time')), true)
assert.equal(itemNavLiderAtual('/meu-time/abc', item('Meu Time')), true)
assert.equal(itemNavLiderAtual('/meu-time/inicio', item('Meu Time')), false)
assert.equal(itemNavLiderAtual('/meu-time/inicio', item('Início')), true)
assert.equal(itemNavLiderAtual('/meu-time/campeonatos', item('Competições')), true)
assert.equal(itemNavLiderAtual('/meu-time/perfil', item('Perfil')), true)

// o que fazer agora
assert.deepEqual(acoesAgora({ proximosJogos: 0, atletasPendentes: 0, papeletasPendentes: 0 }, false), [{ texto: 'Cadastrar meu time', href: '/meu-time/novo' }])
assert.equal(acoesAgora({ proximosJogos: 1, atletasPendentes: 2, papeletasPendentes: 1 }, true).length, 2)
assert.equal(acoesAgora({ proximosJogos: 0, atletasPendentes: 0, papeletasPendentes: 0 }, true)[0].href, '/meu-time/campeonatos')

console.log('login-sem-senha-ui: ok')
