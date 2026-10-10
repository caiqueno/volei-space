// Cobre a decisão de senha do importador Winners com chamadas falsas.
// Não abre rede nem banco.

import assert from 'node:assert/strict'
import {
  aplicarSenhaOrganizador,
  decidirSenhaOrganizador,
  flagResetSenha,
} from './import-winners.mjs'

assert.equal(decidirSenhaOrganizador(null, false), 'criar')
assert.equal(decidirSenhaOrganizador(undefined, true), 'criar')
assert.equal(decidirSenhaOrganizador({ status: 'ATIVA' }, false), 'manter')
assert.equal(decidirSenhaOrganizador({ status: ' ativa ' }, false), 'manter')
assert.equal(decidirSenhaOrganizador({ status: 'ATIVA' }, true), 'redefinir')
assert.equal(decidirSenhaOrganizador({ status: 'PENDENTE' }, false), 'recusar')
assert.equal(decidirSenhaOrganizador({ status: 'PENDENTE' }, true), 'redefinir')
assert.equal(decidirSenhaOrganizador({ status: '' }, false), 'recusar')

assert.equal(flagResetSenha(['node', 'scripts/import-winners.mjs', '--reset-senha']), true)
assert.equal(flagResetSenha(['node', 'scripts/import-winners.mjs']), false)
assert.equal(flagResetSenha(['node', 'scripts/import-winners.mjs', '--reset-senha=1']), false)

const CREDENCIAIS = {
  adminEmail: 'admin@volei.test',
  adminSenha: 'admin-senha',
  email: 'org@winners.test',
  nome: 'Organizador Winners',
  senha: 'senha-definitiva-8',
  senhaTemp: 'temporaria-8',
}

function cenario(contas, { falharLoginOrganizador = false } = {}) {
  const chamadas = []
  const entrar = async (email, senha, perfil) => {
    chamadas.push({ tipo: 'login', email, senha, perfil: perfil ?? null })
    if (falharLoginOrganizador && email === CREDENCIAIS.email) {
      throw new Error('POST /api/auth -> 401 Usuário ou senha não conferem.')
    }
    return { jar: { id: `${email}:${perfil ?? 'admin'}` }, data: { user: { candidaturaId: 'org-1' } } }
  }
  const chamar = async (jar, method, pathname, body) => {
    chamadas.push({ tipo: 'call', method, pathname, body: body ?? null, jar: jar.id })
    if (method === 'GET' && pathname === '/api/admin/organizadores') return contas
    if (method === 'POST' && pathname === '/api/admin/organizadores') return { id: 'org-1' }
    if (method === 'POST' && pathname === '/api/auth/trocar-senha') return { ok: true }
    throw new Error(`chamada inesperada ${method} ${pathname}`)
  }
  return { chamadas, entrar, chamar }
}

function postsDeSenha(chamadas) {
  return chamadas.filter((item) => item.method === 'POST' && item.pathname === '/api/admin/organizadores')
}

const ativo = cenario([{ id: 'org-1', email: 'Org@Winners.test', status: 'ATIVA' }])
const mantido = await aplicarSenhaOrganizador({
  login: ativo.entrar,
  call: ativo.chamar,
  ...CREDENCIAIS,
  resetSenha: false,
})
assert.equal(mantido.acao, 'manter')
assert.equal(mantido.organizadorId, 'org-1')
assert.equal(postsDeSenha(ativo.chamadas).length, 0)
assert.equal(ativo.chamadas.some((item) => item.pathname === '/api/auth/trocar-senha'), false)
assert.ok(ativo.chamadas.some((item) => item.tipo === 'login' && item.email === CREDENCIAIS.email && item.senha === CREDENCIAIS.senha && item.perfil === 'organizador'))
assert.equal(ativo.chamadas.some((item) => JSON.stringify(item.body ?? '').includes(CREDENCIAIS.senhaTemp)), false)

const novo = cenario([])
const criado = await aplicarSenhaOrganizador({
  login: novo.entrar,
  call: novo.chamar,
  ...CREDENCIAIS,
  resetSenha: false,
})
assert.equal(criado.acao, 'criar')
const postCriar = postsDeSenha(novo.chamadas)
assert.equal(postCriar.length, 1)
assert.equal(postCriar[0].body.senha, CREDENCIAIS.senhaTemp)
assert.equal(postCriar[0].body.email, CREDENCIAIS.email)
const troca = novo.chamadas.find((item) => item.pathname === '/api/auth/trocar-senha')
assert.equal(troca.body.senha, CREDENCIAIS.senha)
assert.equal(troca.body.confirmarSenha, CREDENCIAIS.senha)
const ordem = novo.chamadas.map((item) => (
  item.tipo === 'login' ? `login:${item.senha}:${item.perfil}` : `call:${item.method}:${item.pathname}`
))
const indicePost = ordem.indexOf('call:POST:/api/admin/organizadores')
const indiceTemp = ordem.indexOf(`login:${CREDENCIAIS.senhaTemp}:organizador`)
const indiceTroca = ordem.indexOf('call:POST:/api/auth/trocar-senha')
const indiceDefinitivo = ordem.indexOf(`login:${CREDENCIAIS.senha}:organizador`)
assert.ok(indicePost < indiceTemp && indiceTemp < indiceTroca && indiceTroca < indiceDefinitivo)

const reset = cenario([{ id: 'org-1', email: 'org@winners.test', status: 'ATIVA' }])
const redefinido = await aplicarSenhaOrganizador({
  login: reset.entrar,
  call: reset.chamar,
  ...CREDENCIAIS,
  resetSenha: true,
})
assert.equal(redefinido.acao, 'redefinir')
assert.equal(postsDeSenha(reset.chamadas).length, 1)
assert.equal(postsDeSenha(reset.chamadas)[0].body.senha, CREDENCIAIS.senhaTemp)

const pendente = cenario([{ id: 'org-1', email: 'org@winners.test', status: 'PENDENTE' }])
await assert.rejects(
  () => aplicarSenhaOrganizador({
    login: pendente.entrar,
    call: pendente.chamar,
    ...CREDENCIAIS,
    resetSenha: false,
  }),
  /senha não foi alterada/,
)
assert.equal(postsDeSenha(pendente.chamadas).length, 0)
assert.equal(pendente.chamadas.some((item) => item.pathname === '/api/auth/trocar-senha'), false)

const pendenteForcado = cenario([{ id: 'org-1', email: 'org@winners.test', status: 'PENDENTE' }])
const ativado = await aplicarSenhaOrganizador({
  login: pendenteForcado.entrar,
  call: pendenteForcado.chamar,
  ...CREDENCIAIS,
  resetSenha: true,
})
assert.equal(ativado.acao, 'redefinir')
assert.equal(postsDeSenha(pendenteForcado.chamadas).length, 1)

const semTemporaria = cenario([])
await assert.rejects(
  () => aplicarSenhaOrganizador({
    login: semTemporaria.entrar,
    call: semTemporaria.chamar,
    ...CREDENCIAIS,
    senhaTemp: '   ',
    resetSenha: false,
  }),
  /ORGANIZADOR_SENHA_TEMP/,
)
assert.equal(postsDeSenha(semTemporaria.chamadas).length, 0)

const loginRecusado = cenario(
  [{ id: 'org-1', email: 'org@winners.test', status: 'ATIVA' }],
  { falharLoginOrganizador: true },
)
await assert.rejects(
  () => aplicarSenhaOrganizador({
    login: loginRecusado.entrar,
    call: loginRecusado.chamar,
    ...CREDENCIAIS,
    resetSenha: false,
  }),
  /senha atual foi mantida/,
)
assert.equal(postsDeSenha(loginRecusado.chamadas).length, 0)

const listaInvalida = cenario({ data: null })
await assert.rejects(
  () => aplicarSenhaOrganizador({
    login: listaInvalida.entrar,
    call: listaInvalida.chamar,
    ...CREDENCIAIS,
    resetSenha: false,
  }),
  /não veio em formato de lista/,
)
assert.equal(postsDeSenha(listaInvalida.chamadas).length, 0)

const outroEmail = cenario([{ id: 'outro', email: 'outra@volei.test', status: 'ATIVA' }])
const criadoAoLado = await aplicarSenhaOrganizador({
  login: outroEmail.entrar,
  call: outroEmail.chamar,
  ...CREDENCIAIS,
  resetSenha: false,
})
assert.equal(criadoAoLado.acao, 'criar')
assert.equal(postsDeSenha(outroEmail.chamadas)[0].body.email, CREDENCIAIS.email)

console.log('import-winners: senha do organizador ok')
