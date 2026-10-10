// Importa os campeonatos Winners pelo fluxo HTTP do app (idempotente).
//
// O script fala com o Next em APP_URL. Ele não escolhe o banco: o processo
// do app precisa já estar no alvo, com as migrations aplicadas — inclusive
// supabase/migrations/202610090004_partida_atualizado_em_default.sql.
// O prefixo 202610090001 já pertence à revogação de EXECUTE. Não reutilize.
//
// Variáveis:
//   APP_URL                 base do Next (ex.: http://127.0.0.1:3000)
//   ADMIN_EMAIL             e-mail de um Admin que já existe nesse banco
//   ADMIN_SENHA             senha desse Admin
//   ORGANIZADOR_EMAIL       conta que vai ser dona dos três campeonatos
//   ORGANIZADOR_NOME        nome exibido (padrão: Organizador Winners)
//   ORGANIZADOR_SENHA       senha definitiva, mínimo 8, diferente da temporária
//   ORGANIZADOR_SENHA_TEMP  só na criação da conta, ou com --reset-senha
//   WINNERS_TEAMS_JSON      caminho do JSON (padrão: scripts/data/winners-teams.json)
//
// Se o servidor define ADMIN_EMAIL, o login de admin só aceita esse e-mail.
// Senha do organizador (POST /api/admin/organizadores troca a senha se a conta
// já existe — o script evita essa chamada):
//   - Conta nova: grava ORGANIZADOR_SENHA_TEMP e troca para ORGANIZADOR_SENHA.
//   - Conta já ATIVA: não chama o POST. Entra com ORGANIZADOR_SENHA e mantém
//     a senha atual. Se esse login falhar, o script para sem alterar a senha.
//   - Conta existente que não está ATIVA: não troca a senha. O script para.
//   - --reset-senha: força o POST e a troca, mesmo com a conta já existente.
//
// Ordem para rodar no alvo (inclusive produção, de propósito):
//   1. Backup do banco. Confira o ledger de supabase_migrations.
//   2. Se o ledger ainda não tiver, aplique nesta ordem, sem reaplicar a pasta:
//      202610090001_revogar_execute_public_default.sql,
//      202610090002_indices_chaves_estrangeiras.sql,
//      202610090003_classificacao_entrada_unica_por_liga.sql,
//      202610090004_partida_atualizado_em_default.sql
//      (default now() em "Partida"."atualizadoEm").
//   3. Publique antes o código que grava categoriaCampeonatoId e deixa serie nula.
//   4. Aponte APP_URL para esse deploy e rode o script.
//      Repetir a importação não troca a senha de um organizador já ativo.
//   5. Winners Oficial e Winner QA ficam só com elenco. Winners Teste é jogado
//      até a final e só então finalizado. Confira a tabela antes das semis.
//
// Uso: node scripts/import-winners.mjs [--reset-senha]

import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'node:url'

const APP = (process.env.APP_URL || 'http://127.0.0.1:3000').replace(/\/$/, '')
const ORGANIZADOR_NOME = process.env.ORGANIZADOR_NOME || 'Organizador Winners'
const TEAMS_PATH = process.env.WINNERS_TEAMS_JSON
  || path.join(path.dirname(new URL(import.meta.url).pathname), 'data', 'winners-teams.json')

let ADMIN_EMAIL
let ADMIN_SENHA
let ORGANIZADOR_EMAIL
let ORGANIZADOR_SENHA
let RESET_SENHA = false

const CAMPEONATOS = [
  { slug: 'winners-oficial', nome: 'Winners Oficial', jogar: false },
  { slug: 'winners-teste', nome: 'Winners Teste', jogar: true },
  { slug: 'winner-qa', nome: 'Winner QA', jogar: false },
]

const CODIGO_ARBITRO = 'winners-jogo'
const FORMULARIO = {
  equipe: { nome: 'required', nomeAbreviado: 'disabled', logo: 'optional', cidade: 'disabled', instagram: 'optional' },
  lider: { nomeCompleto: 'optional', cpf: 'disabled', dataNascimento: 'disabled', whatsapp: 'optional', email: 'optional', documento: 'disabled', foto: 'disabled' },
  atleta: { nomeCompleto: 'required', cpf: 'optional', rg: 'disabled', dataNascimento: 'optional', foto: 'optional', numeroCamisa: 'optional', posicao: 'optional', altura: 'disabled', instagram: 'disabled', documento: 'optional' },
}

function required(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Defina ${name}.`)
  return value
}

function carregarAmbiente() {
  ADMIN_EMAIL = required('ADMIN_EMAIL')
  ADMIN_SENHA = required('ADMIN_SENHA')
  ORGANIZADOR_EMAIL = required('ORGANIZADOR_EMAIL')
  ORGANIZADOR_SENHA = required('ORGANIZADOR_SENHA')
  RESET_SENHA = flagResetSenha()
}

export function flagResetSenha(argv = process.argv) {
  return argv.includes('--reset-senha')
}

function emailsIguais(esquerda, direita) {
  return String(esquerda ?? '').trim().toLowerCase() === String(direita ?? '').trim().toLowerCase()
}

export function decidirSenhaOrganizador(conta, resetSenha) {
  if (!conta) return 'criar'
  if (resetSenha) return 'redefinir'
  if (String(conta.status ?? '').trim().toUpperCase() === 'ATIVA') return 'manter'
  return 'recusar'
}

function acharOrganizador(lista, email) {
  const contas = Array.isArray(lista) ? lista : []
  return contas.find((item) => emailsIguais(item?.email, email)) ?? null
}

function causaCurta(error) {
  const texto = error instanceof Error ? error.message : String(error ?? '')
  return texto.split('\n')[0].slice(0, 240)
}

export async function aplicarSenhaOrganizador({
  login: entrar,
  call: chamar,
  adminEmail,
  adminSenha,
  email,
  nome,
  senha,
  senhaTemp,
  resetSenha = false,
}) {
  const admin = await entrar(adminEmail, adminSenha)
  const lista = await chamar(admin.jar, 'GET', '/api/admin/organizadores')
  if (!Array.isArray(lista)) {
    throw new Error('A lista de organizadores não veio em formato de lista. A senha não foi alterada.')
  }
  const conta = acharOrganizador(lista, email)
  const acao = decidirSenhaOrganizador(conta, resetSenha)

  if (acao === 'recusar') {
    throw new Error(`O organizador ${email} já existe com status ${conta.status}. A senha não foi alterada. Use --reset-senha para forçar a troca.`)
  }

  if (acao === 'manter') {
    let sessao
    try {
      sessao = await entrar(email, senha, 'organizador')
    } catch (error) {
      throw new Error(`O organizador ${email} já está ativo. A senha atual foi mantida e o login com ORGANIZADOR_SENHA falhou (${causaCurta(error)}). Use --reset-senha somente para substituí-la.`)
    }
    const organizadorId = sessao.data?.user?.candidaturaId
    if (!organizadorId) throw new Error('A sessão do organizador não devolveu o id.')
    return { jar: sessao.jar, organizadorId, adminJar: admin.jar, acao }
  }

  const temporaria = String(senhaTemp ?? '').trim()
  if (!temporaria) {
    throw new Error('Defina ORGANIZADOR_SENHA_TEMP para criar a conta ou para usar --reset-senha.')
  }
  await chamar(admin.jar, 'POST', '/api/admin/organizadores', {
    nome,
    email,
    senha: temporaria,
  })
  const temporario = await entrar(email, temporaria, 'organizador')
  await chamar(temporario.jar, 'POST', '/api/auth/trocar-senha', {
    senha,
    confirmarSenha: senha,
  })
  const sessao = await entrar(email, senha, 'organizador')
  const organizadorId = sessao.data?.user?.candidaturaId
  if (!organizadorId) throw new Error('A sessão do organizador não devolveu o id.')
  return { jar: sessao.jar, organizadorId, adminJar: admin.jar, acao }
}

function limparNome(valor) {
  return String(valor ?? '').replace(/[\u200B-\u200D\u2060\uFEFF]/g, '').replace(/\s+/g, ' ').trim()
}

function forca(nome) {
  let hash = 7
  for (const char of nome) hash = (hash * 31 + char.codePointAt(0)) % 1000
  return hash
}

class Jar {
  constructor() { this.cookies = new Map() }
  header() { return [...this.cookies].map(([key, value]) => `${key}=${value}`).join('; ') }
  absorb(response) {
    const lines = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : []
    for (const line of lines) {
      const pair = line.split(';')[0]
      const index = pair.indexOf('=')
      if (index > 0) this.cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim())
    }
  }
}

async function call(jar, method, pathname, body, expectHtml = false) {
  const response = await fetch(`${APP}${pathname}`, {
    method,
    headers: {
      accept: expectHtml ? 'text/html' : 'application/json',
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(jar.header() ? { cookie: jar.header() } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'follow',
  })
  jar.absorb(response)
  const text = await response.text()
  if (expectHtml) {
    if (!response.ok) throw new Error(`${method} ${pathname} -> ${response.status} ${text.slice(0, 240)}`)
    return text
  }
  let json = null
  try { json = text ? JSON.parse(text) : null } catch { json = null }
  if (!response.ok) {
    const error = new Error(`${method} ${pathname} -> ${response.status} ${json?.error || text.slice(0, 300)}`)
    error.status = response.status
    error.body = json
    throw error
  }
  return json?.data ?? json
}

async function login(email, senha, perfil) {
  const jar = new Jar()
  const data = await call(jar, 'POST', '/api/auth', { email, senha, ...(perfil ? { perfil } : {}) })
  return { jar, data }
}

async function garantirOrganizador() {
  const resultado = await aplicarSenhaOrganizador({
    login,
    call,
    adminEmail: ADMIN_EMAIL,
    adminSenha: ADMIN_SENHA,
    email: ORGANIZADOR_EMAIL,
    nome: ORGANIZADOR_NOME,
    senha: ORGANIZADOR_SENHA,
    senhaTemp: process.env.ORGANIZADOR_SENHA_TEMP,
    resetSenha: RESET_SENHA,
  })
  if (resultado.acao === 'manter') {
    console.log(`Organizador ${ORGANIZADOR_EMAIL} já está ativo. Senha mantida.`)
  } else if (resultado.acao === 'redefinir') {
    console.log(`Organizador ${ORGANIZADOR_EMAIL}: senha redefinida (--reset-senha).`)
  } else {
    console.log(`Organizador ${ORGANIZADOR_EMAIL} criado.`)
  }
  return resultado
}

function corpoLiga(item, organizadorId) {
  return {
    nome: item.nome,
    slug: item.slug,
    organizadorId,
    descricao: "COPA WINNER'S",
    status: 'ATIVA',
    formato: 'GRUPOS_MATA_MATA',
    quantidadeEquipes: 10,
    quantidadeGrupos: 2,
    classificadosPorGrupo: 2,
    melhoresClassificadosGerais: 0,
    faseEliminatoria: 'SEMIFINAL',
    metodoChaveamento: 'MANUAL',
    eliminatoriaIdaVolta: false,
    disputaTerceiroLugar: true,
    setsFormato: 'MELHOR_DE',
    setsPorPartida: 3,
    pontosPorSet: 25,
    diferencaMinimaSet: 2,
    tieBreakUltimoSet: true,
    pontosUltimoSet: 15,
    turnoReturno: false,
    criteriosClassificacao: '["PONTOS","VITORIAS","SALDO_SETS","SALDO_PONTOS"]',
    inscricoesAbertas: true,
    qrCodeEnabled: false,
    formularioInscricaoConfig: FORMULARIO,
    dataInicio: '2026-10-01T12:00:00.000Z',
    dataFim: '2026-12-20T12:00:00.000Z',
  }
}

async function garantirLiga(jar, item, organizadorId) {
  const lista = await call(jar, 'GET', `/api/ligas?organizadorId=${encodeURIComponent(organizadorId)}`)
  const existente = (lista ?? []).find((liga) => liga.slug === item.slug)
  if (existente) return existente
  return call(jar, 'POST', '/api/ligas', corpoLiga(item, organizadorId))
}

async function configurarCategoria(jar, liga, adminJar) {
  let categorias = await call(jar, 'GET', `/api/organizador/ligas/${liga.id}/categorias`)
  let categoria = (categorias ?? []).find((item) => item.codigo === 'MASCULINO' && !item.removidaEm)
  if (!categoria) {
    await call(jar, 'PUT', `/api/organizador/ligas/${liga.id}/categorias`, {
      categorias: [{ codigo: 'MASCULINO' }],
    })
    categorias = await call(jar, 'GET', `/api/organizador/ligas/${liga.id}/categorias`)
    categoria = (categorias ?? []).find((item) => item.codigo === 'MASCULINO' && !item.removidaEm)
  }
  if (!categoria?.id) throw new Error(`${liga.nome}: categoria Masculino não foi criada.`)
  const base = `/api/organizador/ligas/${liga.id}/setup`
  const categoriaQuery = `categoriaCampeonatoId=${categoria.id}`
  const atual = await call(jar, 'GET', `${base}/estrutura?${categoriaQuery}`)
  const secoes = [
    ['estrutura', {
      formato: 'GRUPOS_MATA_MATA',
      quantidadeEquipes: 10,
      quantidadeGrupos: 2,
      turnoReturno: false,
      setsFormato: 'MELHOR_DE',
      setsPorPartida: 3,
      pontosPorSet: 25,
      diferencaMinimaSet: 2,
      tieBreakUltimoSet: true,
      pontosUltimoSet: 15,
      sumulaScoutsEnabled: false,
    }],
    ['classificacao', {
      criteriosClassificacao: '["PONTOS","VITORIAS","SALDO_SETS","SALDO_PONTOS"]',
      classificadosPorGrupo: 2,
      melhoresClassificadosGerais: 0,
    }],
    ['eliminatorias', {
      faseEliminatoria: 'SEMIFINAL',
      metodoChaveamento: 'MANUAL',
      eliminatoriaIdaVolta: false,
      disputaTerceiroLugar: true,
      goldenSet: false,
    }],
    ['calendario', {
      dataInicio: '2026-10-01T12:00:00.000Z',
      dataFim: '2026-12-20T12:00:00.000Z',
    }],
    ['inscricoes', {
      inscricoesAbertas: true,
      qrCodeEnabled: false,
      elencoCadastroDuranteInscricao: true,
      formularioInscricaoConfig: FORMULARIO,
    }],
  ]
  const jaConfigurada = atual?.formato === 'GRUPOS_MATA_MATA' && Number(atual.quantidadeEquipes) === 10 && Number(atual.classificadosPorGrupo) === 2 && atual.faseEliminatoria === 'SEMIFINAL'
  if (!jaConfigurada) {
    for (const [secao, corpo] of secoes) {
      await call(jar, 'PATCH', `${base}/${secao}?${categoriaQuery}`, corpo)
    }
    for (const [secao, corpo] of secoes) {
      await call(jar, 'PATCH', `${base}/${secao}?${categoriaQuery}&intent=complete`, corpo)
    }
  }
  if (liga.status !== 'FINALIZADO' && !liga.pagamentoConfirmadoEm) {
    await call(adminJar, 'POST', `/api/organizador/ligas/${liga.id}/pagamento/confirmar`, {})
  }
  return categoria
}

function tokenDoCaminho(caminho) {
  const match = String(caminho ?? '').match(/([0-9a-f]{32}|[0-9a-f-]{36})$/i)
  if (!match) throw new Error(`Caminho sem token: ${caminho}`)
  return match[1]
}

async function inscreverTimes(jar, liga, categoria, times) {
  for (let index = 0; index < times.length; index += 1) {
    const time = times[index]
    const vaga = index + 1
    const link = await call(jar, 'POST', `/api/organizador/ligas/${liga.id}/vagas-inscricao`, {
      categoriaCampeonatoId: categoria.id,
      vaga,
    })
    const tokenVaga = tokenDoCaminho(link.caminho)
    const html = await call(new Jar(), 'GET', `/inscricao/vaga/${tokenVaga}`, undefined, true)
    const uuids = [...html.matchAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi)].map((item) => item[0])
    const tokenRascunho = uuids.find((token) => token.toLowerCase() !== tokenVaga.toLowerCase())
    if (!tokenRascunho) throw new Error(`${liga.nome}: rascunho da vaga ${vaga} (${time.nome}) não abriu.`)
    const rascunho = await call(jar, 'GET', `/api/inscricao-rapida/${tokenRascunho}`)
    const status = String(rascunho?.draft?.status ?? '')
    if (status === 'CONCLUIDO' || status === 'ENVIADA') continue
    await call(jar, 'PATCH', `/api/inscricao-rapida/${tokenRascunho}`, {
      nomeEquipe: time.nome,
      lider: time.responsavel || 'Responsável da equipe',
    })
    const presentes = new Set((rascunho.players ?? []).map((jogador) => limparNome(jogador.nome).toLocaleLowerCase('pt-BR')))
    let numero = (rascunho.players ?? []).reduce((maior, jogador) => Math.max(maior, Number(jogador.numero) || 0), 0)
    for (const nome of time.jogadores) {
      const limpo = limparNome(nome)
      if (!limpo || presentes.has(limpo.toLocaleLowerCase('pt-BR'))) continue
      numero += 1
      await call(jar, 'POST', `/api/inscricao-rapida/${tokenRascunho}/jogadores`, { nome: limpo, numero })
      presentes.add(limpo.toLocaleLowerCase('pt-BR'))
    }
    await call(jar, 'POST', `/api/inscricao-rapida/${tokenRascunho}/finalizar`, {})
  }
}

function placar(nomeA, nomeB, rodada) {
  const aVence = forca(nomeA) + (rodada % 5) >= forca(nomeB)
  const tresSets = (forca(nomeA) + forca(nomeB) + rodada) % 3 === 0
  const sets = tresSets
    ? (aVence ? [[25, 21], [22, 25], [15, 11]] : [[21, 25], [25, 22], [11, 15]])
    : (aVence ? [[25, 19], [25, 22]] : [[19, 25], [22, 25]])
  return { aVence, sets: sets.map(([pontosA, pontosB], index) => ({ numero: index + 1, pontosA, pontosB })) }
}

async function jogarPartida(organizador, partida, equipesPorId) {
  if (['ENCERRADA', 'WO'].includes(String(partida.status))) return
  let acesso
  try {
    acesso = await call(organizador, 'POST', `/api/organizador/partidas/${partida.id}/acesso-arbitro`, {
      acao: 'gerar', codigo: CODIGO_ARBITRO, confirmar: CODIGO_ARBITRO,
    })
  } catch (error) {
    if (error.status !== 409) throw error
    acesso = await call(organizador, 'POST', `/api/organizador/partidas/${partida.id}/acesso-arbitro`, {
      acao: 'regenerar', codigo: CODIGO_ARBITRO, confirmar: CODIGO_ARBITRO,
    })
  }
  const tokenAcesso = tokenDoCaminho(acesso.caminho)
  const arbitro = new Jar()
  await call(arbitro, 'POST', `/api/arbitro/jogo/${tokenAcesso}`, { codigo: CODIGO_ARBITRO })
  const equipeA = equipesPorId.get(Number(partida.equipeAId))
  const equipeB = equipesPorId.get(Number(partida.equipeBId))
  const resultado = placar(equipeA.nome, equipeB.nome, Number(partida.rodada))
  const presentes = (equipe, equipeId) => (equipe.jogadores ?? []).filter((jogador) => !jogador.banido).slice(0, 6).map((jogador) => ({
    jogadorId: jogador.id, equipeId, presente: true, numero: jogador.numero ?? null,
  }))
  const presencas = [...presentes(equipeA, equipeA.id), ...presentes(equipeB, equipeB.id)]
  if (presencas.length < 12) throw new Error(`Elenco curto em ${equipeA.nome} x ${equipeB.nome}.`)
  const vencedora = resultado.aVence ? equipeA : equipeB
  const mvp = (vencedora.jogadores ?? []).find((jogador) => !jogador.banido)
  await call(arbitro, 'POST', `/api/sumula/${partida.sumulaToken}`, {
    presencas,
    sets: resultado.sets,
    ocorrencias: [],
    destaques: [{ jogadorId: mvp.id, tipo: 'MVP' }],
  })
}

async function classificar(ligaId) {
  const dados = await call(new Jar(), 'GET', `/api/portal/classificacao?ligaId=${ligaId}`)
  return dados.linhas ?? []
}

function assinatura(linhas) {
  return linhas.map((linha) => `${linha.equipeId}:${linha.pontos}:${linha.jogos}:${linha.vitorias}`).join('|')
}

async function lerEstrutura(jar, ligaId) {
  return call(jar, 'GET', `/api/organizador/ligas/${ligaId}/estrutura`)
}

async function garantirGrupos(jar, liga) {
  const estrutura = await lerEstrutura(jar, liga.id)
  const deGrupos = (estrutura.partidas ?? []).filter((partida) => partida.fase === 'GRUPOS' || partida.grupoId)
  if (deGrupos.length > 0) return estrutura
  await call(jar, 'POST', `/api/organizador/ligas/${liga.id}/estrutura`, {
    quantidadeGrupos: 2,
    classificadosPorGrupo: 2,
    nomesGrupos: ['Grupo A', 'Grupo B'],
    turnoReturno: false,
    dataInicial: '2026-10-11',
    horarioPadrao: '19:00',
    localPadrao: 'Quadra 01',
  })
  return lerEstrutura(jar, liga.id)
}

function confrontoNovo(partidas, fase, rodada) {
  return (partidas ?? []).find((partida) => partida.fase === fase && Number(partida.rodada) === rodada)
}

async function criarMataMata(jar, ligaId, fase, rodada, equipeAId, equipeBId) {
  const estrutura = await lerEstrutura(jar, ligaId)
  const existente = confrontoNovo(estrutura.partidas, fase, rodada)
  if (existente) return existente
  return call(jar, 'POST', `/api/organizador/ligas/${ligaId}/mata-mata`, { fase, rodada, equipeAId, equipeBId })
}

function classificadosDoGrupo(grupo, linhas) {
  const ordem = new Map(linhas.map((linha) => [Number(linha.equipeId), linha]))
  return [...(grupo.equipes ?? [])]
    .map((vinculo) => vinculo.equipe)
    .filter(Boolean)
    .sort((a, b) => {
      const esquerda = ordem.get(a.id)
      const direita = ordem.get(b.id)
      return (esquerda?.posicao ?? 99) - (direita?.posicao ?? 99)
    })
}

async function jogarFase(organizador, ligaId, fase) {
  let estrutura = await lerEstrutura(organizador, ligaId)
  const equipesPorId = new Map((estrutura.equipes ?? []).map((equipe) => [equipe.id, equipe]))
  const pendentes = (estrutura.partidas ?? []).filter((partida) => partida.fase === fase && !['ENCERRADA', 'WO'].includes(partida.status))
  for (const partida of pendentes) await jogarPartida(organizador, partida, equipesPorId)
  estrutura = await lerEstrutura(organizador, ligaId)
  return estrutura
}

function vencedor(partida, equipesPorId) {
  if (!['ENCERRADA', 'WO'].includes(String(partida.status))) return null
  const setsA = Number(partida.setsPorA ?? 0)
  const setsB = Number(partida.setsPorB ?? 0)
  if (setsA === setsB) return null
  const id = setsA > setsB ? Number(partida.equipeAId) : Number(partida.equipeBId)
  return equipesPorId.get(id) ?? { id, nome: String(id) }
}

function executadoDireto() {
  const entry = process.argv[1]
  if (!entry) return false
  return import.meta.url === pathToFileURL(path.resolve(entry)).href
}

async function main() {
  carregarAmbiente()
  const times = JSON.parse(fs.readFileSync(TEAMS_PATH, 'utf8')).map((time) => ({
    ...time,
    nome: limparNome(time.nome),
    responsavel: limparNome(time.responsavel),
    jogadores: (time.jogadores ?? []).map(limparNome).filter(Boolean),
  }))
  const atletas = times.reduce((total, time) => total + time.jogadores.length, 0)
  if (times.length !== 10 || atletas !== 140) {
    throw new Error(`O JSON precisa ter 10 times e 140 jogadores. Veio ${times.length} times e ${atletas} jogadores.`)
  }

  const { jar: organizador, organizadorId, adminJar } = await garantirOrganizador()

  let campeao = null
  for (const item of CAMPEONATOS) {
    const liga = await garantirLiga(organizador, item, organizadorId)
    const categoria = await configurarCategoria(organizador, liga, adminJar)
    await inscreverTimes(organizador, liga, categoria, times)
    const estruturaElenco = await lerEstrutura(organizador, liga.id)
    const jogadores = (estruturaElenco.equipes ?? []).reduce((total, equipe) => total + (equipe.jogadores?.length ?? 0), 0)
    if ((estruturaElenco.equipes ?? []).length !== 10 || jogadores !== 140) {
      throw new Error(`${item.nome}: esperava 10 equipes e 140 jogadores aprovados, veio ${(estruturaElenco.equipes ?? []).length} e ${jogadores}.`)
    }
    if (!item.jogar) {
      console.log(`${item.nome}: 10 equipes, ${jogadores} jogadores, sem partidas.`)
      continue
    }

    let estrutura = await garantirGrupos(organizador, liga)
    const equipesPorId = new Map((estrutura.equipes ?? []).map((equipe) => [equipe.id, equipe]))
    for (const partida of (estrutura.partidas ?? []).filter((jogo) => jogo.fase === 'GRUPOS')) {
      await jogarPartida(organizador, partida, equipesPorId)
    }
    const antes = await classificar(liga.id)
    console.log(`${item.nome}: classificação dos grupos`)
    for (const linha of antes) console.log(`  ${linha.posicao}. ${linha.equipe} — ${linha.pontos} pts, ${linha.vitorias}V ${linha.derrotas}D`)

    estrutura = await lerEstrutura(organizador, liga.id)
    const grupos = [...(estrutura.grupos ?? [])].sort((a, b) => a.ordem - b.ordem)
    if (grupos.length !== 2) throw new Error(`${item.nome}: a fase de grupos não ficou com 2 grupos.`)
    const [grupoA, grupoB] = grupos.map((grupo) => classificadosDoGrupo(grupo, antes))
    if (grupoA.length < 2 || grupoB.length < 2) throw new Error(`${item.nome}: um grupo não tem dois classificados.`)

    await criarMataMata(organizador, liga.id, 'SEMIFINAL', 1, grupoA[0].id, grupoB[1].id)
    await criarMataMata(organizador, liga.id, 'SEMIFINAL', 2, grupoB[0].id, grupoA[1].id)
    await jogarFase(organizador, liga.id, 'SEMIFINAL')
    const depois = await classificar(liga.id)
    if (assinatura(antes) !== assinatura(depois)) {
      throw new Error(`${item.nome}: a semifinal alterou a classificação dos grupos. O mata-mata não pode entrar na tabela.`)
    }

    estrutura = await lerEstrutura(organizador, liga.id)
    const mapa = new Map((estrutura.equipes ?? []).map((equipe) => [equipe.id, equipe]))
    const semi1 = confrontoNovo(estrutura.partidas, 'SEMIFINAL', 1)
    const semi2 = confrontoNovo(estrutura.partidas, 'SEMIFINAL', 2)
    const finalistaA = vencedor(semi1, mapa)
    const finalistaB = vencedor(semi2, mapa)
    if (!finalistaA || !finalistaB) throw new Error(`${item.nome}: a semifinal não teve vencedor.`)
    await criarMataMata(organizador, liga.id, 'FINAL', 1, finalistaA.id, finalistaB.id)
    await jogarFase(organizador, liga.id, 'FINAL')

    estrutura = await lerEstrutura(organizador, liga.id)
    const mapaFinal = new Map((estrutura.equipes ?? []).map((equipe) => [equipe.id, equipe]))
    const final = confrontoNovo(estrutura.partidas, 'FINAL', 1)
    campeao = vencedor(final, mapaFinal)
    if (!campeao) throw new Error(`${item.nome}: a final não definiu campeão.`)

    const perdedor = (partida, ganhador) => {
      const id = Number(partida.equipeAId) === ganhador.id ? Number(partida.equipeBId) : Number(partida.equipeAId)
      return mapaFinal.get(id)
    }
    const terceiroA = perdedor(semi1, finalistaA)
    const terceiroB = perdedor(semi2, finalistaB)
    await criarMataMata(organizador, liga.id, 'TERCEIRO_LUGAR', 1, terceiroA.id, terceiroB.id)
    await jogarFase(organizador, liga.id, 'TERCEIRO_LUGAR')

    const atualizada = await call(organizador, 'GET', `/api/ligas/${liga.slug}`)
    if (atualizada.status !== 'FINALIZADO') {
      await call(organizador, 'POST', `/api/organizador/ligas/${liga.id}/finalizar`, {})
    }
    console.log(`${item.nome}: campeão = ${campeao.nome}`)
  }

  const publicas = await call(new Jar(), 'GET', '/api/ligas')
  const nomes = new Set((publicas ?? []).map((liga) => liga.nome))
  for (const item of CAMPEONATOS) {
    if (!nomes.has(item.nome)) throw new Error(`${item.nome} não apareceu na listagem pública.`)
  }
  console.log(campeao ? `ok campeão=${campeao.nome}` : 'ok')
}

if (executadoDireto()) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
