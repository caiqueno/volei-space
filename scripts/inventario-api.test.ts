import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// Inventário das rotas de src/app/api (docs/analise/32-inventario-api.md).
// Uso: sem argumento, FALHA se existir rota em src/app/api ausente do documento (ou o contrário).
//      com --gerar, imprime as linhas da tabela a partir da varredura dos route.ts.
// Não executa SQL, não chama rede, não lê segredo.

const raiz = process.cwd()
const baseApi = path.join(raiz, 'src', 'app', 'api')
const arquivoDoc = path.join(raiz, 'docs', 'analise', '32-inventario-api.md')
const METODOS = /export\s+(?:async\s+function|const)\s+(GET|POST|PUT|PATCH|DELETE)\b/g

const achar = (d: string): string[] => fs.readdirSync(d).flatMap((n) => (fs.statSync(path.join(d, n)).isDirectory() ? achar(path.join(d, n)) : n === 'route.ts' ? [path.join(d, n)] : []))
const rotaDe = (f: string) => '/api/' + path.relative(baseApi, path.dirname(f)).split(path.sep).join('/')
const relativo = (f: string) => path.relative(raiz, f).split(path.sep).join('/')
const metodosDe = (t: string) => [...t.matchAll(METODOS)].map((m) => m[1])
const unicos = (a: string[]) => [...new Set(a)]

const arquivos = achar(baseApi).sort()
const varredura = arquivos.flatMap((f) => metodosDe(fs.readFileSync(f, 'utf8')).map((m) => m + ' ' + rotaDe(f)))

// Flag que liga a rota: por importação do módulo que a verifica, mais qualquer nome literal *_ATIVO no arquivo.
const POR_IMPORT: Array<[RegExp, string]> = [
  [/lib\/notificacoes-canais/, 'NOTIFICACOES_MULTICANAL_ATIVO'],
  [/lib\/painel-inscricoes/, 'PAINEL_INSCRICOES_ATIVO'],
  [/lib\/explorar-competicoes/, 'EXPLORAR_COMPETICOES_ATIVO'],
  [/lib\/login-sem-senha/, 'LOGIN_SEM_SENHA_ATIVO'],
  [/lib\/meu-time-fase2|rotaFase2/, 'MEU_TIME_FASE2_ATIVO'],
  [/lib\/inscricoes-solicitacao/, 'INSCRICAO_SOLICITACAO_ATIVO'],
  [/lib\/inscricao-entrada/, 'INSCRICAO_VIA_MEU_TIME_ATIVO'],
  [/lib\/banco\/sessao/, 'BANCO_SESSAO_ATIVO'],
  [/lib\/banco\//, 'BANCO_APP_ATIVO'],
  [/lib\/ao-vivo/, 'AO_VIVO_ATIVO'],
  [/lib\/desafio/, 'DESAFIO_ATIVO'],
  [/lib\/scout/, 'SCOUT_ATIVO'],
  [/lib\/sumula-eventos/, 'SUMULA_EVENTOS_ATIVO'],
  [/lib\/regras-elenco|lib\/pedido-troca|lib\/uploads\/acesso-equipe|elencoCompletoAtivo/, 'ELENCO_COMPLETO_ATIVO'],
  [/lib\/meu-time\/|lib\/meu-time-fase2|lib\/lgpd|rotaMeuTime|rotaLider/, 'MEU_TIME_ATIVO'],
  [/pagamento-config|pagamentoHabilitado/, 'PAGAMENTO_HABILITADO'],
]
const importsDa = (rota: string) => (rota.startsWith('/api/organizador/ligas') ? POR_IMPORT.filter((p) => p[1] === 'PAGAMENTO_HABILITADO') : POR_IMPORT)
const flagsDe = (t: string, rota = '') => unicos([...importsDa(rota).filter((p) => p[0].test(t)).map((p) => p[1]), ...[...t.matchAll(/(?<![A-Z0-9_])([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*_ATIVO)(?![A-Z0-9_])/g)].map((m) => m[1])])

// Quem acessa, em ordem de força. Heurística por padrões de chamada; a coluna é conferida por humano.
const ACESSOS: Array<[RegExp, string]> = [
  [/rotaCron|CRON_SECRET/, 'cron (segredo no cabeçalho)'],
  [/requireAuth\(|requireAdmin|admin-access/, 'admin'],
  [/requireOrganiz|exigirOrganizador|requireOwnedLigaForSetup|rotaOrganizador|rotaPainel|rotaElencoOrganizador|ligaDoOrganizador|organizador-isolamento|requirePublicRole\(req, \['organizador'\]/, 'organizador'],
  [/rotaMeuTime|rotaFase2|exigirEquipe|rotaLider|rotaElencoLider|exigirAtorDaEquipe|rotaExplorar|rotaNotificacoes|requirePublicRole\(req, \['equipe'\]/, 'líder ou técnico (sessão)'],
  [/login-sem-senha\/sessao/, 'sessão do login por código'],
  [/requireSumulaTokenAccess|requireSumulaLeitura|requireArbitroPartidaAccess|banco\/acesso|sumula-token|acesso-arbitro-jogo/, 'token (súmula, árbitro ou banco)'],
]
const porCaminho = (a: string, rota: string) => (a === 'admin' && rota.startsWith('/api/admin')) || (a === 'organizador' && rota.startsWith('/api/organizador/')) || (a.startsWith('cron') && rota.startsWith('/api/cron'))
const achadosDe = (t: string, rota: string) => ACESSOS.filter((a) => a[0].test(t) || porCaminho(a[1], rota)).map((a) => a[1])
const comTokenDe = (achados: string[], rota: string) => (rota.includes('[token]') && !achados.some((a) => a.startsWith('token')) ? [...achados, 'token (no caminho)'] : achados)
// Ajustes manuais onde a varredura não enxerga (auth por método, helpers próprios). Conferidos lendo o arquivo.
const GET_PUBLICO = 'GET público (filtrado pela sessão, se houver); escrita: organizador (ou admin)'
const ACESSO_MANUAL = new Map<string, string>([
  ['/api/candidaturas/[tipo]/[id]', 'dono do cadastro (sessão de equipe, árbitro ou quadra liberada)'],
  ['/api/webhooks/infinitepay', 'webhook externo desativado (responde 410 a qualquer evento)'],
  ['/api/equipes', GET_PUBLICO],
  ['/api/equipes/[id]', GET_PUBLICO],
  ['/api/jogadores', 'GET público (sem PII); escrita: organizador'],
  ['/api/jogadores/[id]', 'escrita: organizador'],
  ['/api/partidas', GET_PUBLICO],
  ['/api/partidas/[id]', GET_PUBLICO],
  ['/api/galeria', GET_PUBLICO],
  ['/api/resultados-manuais', 'organizador'],
  ['/api/ligas', 'GET público (filtrado pela sessão); escrita: organizador ou admin'],
  ['/api/ligas/[slug]', 'GET público (filtrado pela sessão); escrita: organizador ou admin'],
  ['/api/auth', 'público (login e logout; a senha é conferida no servidor)'],
  ['/api/auth/codigo/solicitar', 'público (inicia a sessão)'],
  ['/api/auth/codigo/confirmar', 'público (inicia a sessão)'],
  ['/api/auth/google/inicio', 'público (inicia a sessão)'],
  ['/api/auth/google/retorno', 'público (inicia a sessão)'],
  ['/api/auth/perfis', 'sessão aberta (qualquer perfil)'],
  ['/api/auth/perfil/trocar', 'sessão aberta (qualquer perfil)'],
  ['/api/auth/sessao', 'sessão aberta (cookie); sem sessão responde vazio'],
  ['/api/auth/atividade', 'sessão aberta (cookie)'],
  ['/api/auth/trocar-senha', 'sessão aberta (cookie)'],
  ['/api/organizador/ligas/[id]/estrutura', 'organizador'],
  ['/api/organizador/ligas/[id]/mata-mata', 'organizador'],
  ['/api/organizador/ligas/[id]/mata-mata/gerar', 'organizador'],
  ['/api/organizador/ligas/[id]/mata-mata/vagas', 'organizador'],
  ['/api/organizador/ligas/[id]/link-inscricao', 'organizador'],
  ['/api/organizador/ligas/[id]/links-categoria', 'organizador'],
  ['/api/organizador/ligas/[id]/vagas-inscricao', 'organizador'],
  ['/api/organizador/ligas/[id]/categoria-inicial', 'organizador'],
  ['/api/organizador/partidas/[id]/acesso-arbitro', 'organizador'],
  ['/api/partidas/[id]/ao-vivo', 'público (acompanhamento; o token de árbitro, se enviado, só amplia)'],
  ['/api/banco/links', 'organizador'],
  ['/api/inscricoes-campeonato', 'organizador ou líder, conforme o método'],
  ['/api/uploads/assinar', 'organizador ou líder'],
])
const FLAG_MANUAL = new Map<string, string>([
  ['/api/organizador/ligas/[id]/estrutura', 'nenhuma'],
  ['/api/organizador/ligas/[id]/links-categoria', 'nenhuma'],
  ['/api/organizador/ligas/[id]/pagamento', 'PAGAMENTO_HABILITADO (desligada: responde pagamento desativado, não 404)'],
  ['/api/organizador/ligas/[id]/setup/previa', 'PAGAMENTO_HABILITADO (só muda o preço mostrado)'],
])
const acessoDe = (t: string, rota: string) => ACESSO_MANUAL.get(rota) ?? (rota.startsWith('/api/webhooks') ? 'webhook externo (segredo ou assinatura)' : comTokenDe(achadosDe(t, rota), rota).join(' ou ') || 'público')
const ARQUIVO = /new Response\(|text\/csv|application\/pdf|text\/calendar|text\/event-stream/
const PADRAO_SUCESSO = /\bsuccess\(|\berror\(/
const PADRAO_SUCESSO_MT = /\bsucesso\(|\bfalha\(|rotaMeuTime|rotaFase2|rotaPainel|rotaNotificacoes|rotaLider|rotaExplorar|rotaOrganizador/
const envelopeDe = (t: string) => (ARQUIVO.test(t) ? 'arquivo ou fluxo' : PADRAO_SUCESSO.test(t) && /api-response/.test(t) ? '{ data } / { error, details }' : PADRAO_SUCESSO_MT.test(t) ? '{ data } / { error, codigo? }' : /NextResponse\.json\(/.test(t) ? 'JSON próprio' : 'via helper')
const flagTexto = (t: string, rota: string) => FLAG_MANUAL.get(rota) ?? (flagsDe(t, rota).join(' + ') || 'nenhuma')
const linhaDe = (f: string) => '| ' + metodosDe(fs.readFileSync(f, 'utf8')).join(', ') + ' | `' + rotaDe(f) + '` | ' + flagTexto(fs.readFileSync(f, 'utf8'), rotaDe(f)) + ' | ' + acessoDe(fs.readFileSync(f, 'utf8'), rotaDe(f)) + ' | ' + envelopeDe(fs.readFileSync(f, 'utf8')) + ' | `' + relativo(f) + '` |'

if (process.argv.includes('--gerar')) { arquivos.forEach((f) => console.log(linhaDe(f))); process.exit(0) }

assert.ok(fs.existsSync(arquivoDoc), 'falta docs/analise/32-inventario-api.md (gere as linhas com --gerar)')
const linhasDoc = fs.readFileSync(arquivoDoc, 'utf8').split('\n').filter((l) => /^\|\s*(GET|POST|PUT|PATCH|DELETE)\b/.test(l))
const documentadas = linhasDoc.flatMap((l) => l.split('|')[1].split(',').map((m) => m.trim() + ' ' + l.split('|')[2].trim().replace(/`/g, '')))
const faltando = varredura.filter((r) => !documentadas.includes(r))
const sobrando = documentadas.filter((r) => !varredura.includes(r))
assert.deepEqual(faltando, [], 'rotas de src/app/api ausentes do inventário (rode com --gerar e atualize o documento): ' + faltando.join('; '))
assert.deepEqual(sobrando, [], 'rotas do inventário que não existem mais em src/app/api: ' + sobrando.join('; '))
assert.equal(new Set(documentadas).size, documentadas.length, 'rota duplicada no inventário')
const semMetodo = arquivos.filter((f) => metodosDe(fs.readFileSync(f, 'utf8')).length === 0).map(relativo)
assert.deepEqual(semMetodo, [], 'route.ts sem método exportado reconhecido: ' + semMetodo.join('; '))
console.log('inventario-api: ' + arquivos.length + ' arquivos, ' + varredura.length + ' métodos, inventário em dia')
