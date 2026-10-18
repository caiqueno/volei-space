import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// Teste estático das migrations pendentes (supabase/pendentes) e do seed.
// Não executa SQL e não fala com banco: só lê os arquivos .sql.

const raiz = process.cwd()
const dirPendentes = path.join(raiz, 'supabase', 'pendentes', 'migrations')
const dirRollback = path.join(raiz, 'supabase', 'pendentes', 'rollback')
const dirOficiais = path.join(raiz, 'supabase', 'migrations')
const arquivoSeed = path.join(raiz, 'supabase', 'seed.sql')

function sqlSemComentario(fonte: string): string {
  return fonte
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((linha) => !linha.trim().startsWith('--'))
    .join('\n')
}

function listarSql(dir: string): string[] {
  return fs.readdirSync(dir).filter((nome) => nome.endsWith('.sql')).sort()
}

function ler(dir: string, nome: string): string {
  return fs.readFileSync(path.join(dir, nome), 'utf8')
}

const pendentes = listarSql(dirPendentes)
const rollbacks = listarSql(dirRollback)
assert.ok(pendentes.length >= 34, 'esperava ao menos 34 migrations pendentes')

// 1) Cada migration tem reversão de mesmo nome e vice-versa.
assert.deepEqual(rollbacks, pendentes, 'cada migration pendente precisa de rollback de mesmo nome')

// 2) Nomes sequenciais, sem colisão entre si nem com as migrations oficiais.
const versoes = pendentes.map((nome) => {
  const m = /^(\d{12})_[a-zA-Z0-9_]+\.sql$/.exec(nome)
  assert.ok(m, `nome fora do padrão AAAAMMDDNNNN_nome.sql: ${nome}`)
  return m![1]
})
assert.equal(new Set(versoes).size, versoes.length, 'versão duplicada entre pendentes')
versoes.forEach((versao, indice) => {
  assert.equal(versao, `20261017${String(indice + 1).padStart(4, '0')}`, `sequência quebrada em ${versao}`)
})
const oficiais = listarSql(dirOficiais)
const versoesOficiais = new Set(oficiais.map((nome) => nome.split('_')[0]))
for (const versao of versoes) assert.ok(!versoesOficiais.has(versao), `versão ${versao} colide com supabase/migrations`)
const maiorOficial = [...versoesOficiais].map((v) => v.padEnd(14, '0')).sort().pop()!
assert.ok(versoes[0].padEnd(14, '0') > maiorOficial, 'pendentes devem ordenar depois das migrations oficiais')

// Objetos criados pelas pendentes não podem repetir nome de tabela/função/view das oficiais.
const sqlOficial = oficiais.map((nome) => sqlSemComentario(ler(dirOficiais, nome))).join('\n')
const sqlPendente: Record<string, string> = {}
for (const nome of pendentes) sqlPendente[nome] = sqlSemComentario(ler(dirPendentes, nome))

const tabelasCriadas: { arquivo: string; tabela: string }[] = []
for (const [arquivo, sql] of Object.entries(sqlPendente)) {
  for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"([A-Za-z_][A-Za-z0-9_]*)"/gi)) {
    tabelasCriadas.push({ arquivo, tabela: m[1] })
  }
}
assert.ok(tabelasCriadas.length >= 12, 'esperava ao menos 12 tabelas novas nas pendentes')
for (const { tabela } of tabelasCriadas) {
  const re = new RegExp(`create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?(?:public\\.)?"${tabela}"`, 'i')
  assert.ok(!re.test(sqlOficial), `tabela ${tabela} já é criada em supabase/migrations`)
}
for (const [arquivo, sql] of Object.entries(sqlPendente)) {
  for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z_]+)\s*\(/gi)) {
    const re = new RegExp(`function\\s+(?:public\\.)?${m[1]}\\s*\\(`, 'i')
    assert.ok(!re.test(sqlOficial), `função ${m[1]} (${arquivo}) já existe em supabase/migrations`)
  }
}

// 3) RLS ligada em toda tabela criada (direto ou pelo laço com array de nomes na mesma migration).
for (const { arquivo, tabela } of tabelasCriadas) {
  const sql = sqlPendente[arquivo]
  const direto = new RegExp(`alter\\s+table\\s+(?:public\\.)?"${tabela}"\\s+enable\\s+row\\s+level\\s+security`, 'i').test(sql)
  let porLaco = false
  for (const m of sql.matchAll(/array\s*\[([^\]]*)\]/gi)) {
    if (m[1].includes(`'${tabela}'`)) porLaco = true
  }
  porLaco = porLaco && /enable\s+row\s+level\s+security/i.test(sql)
  assert.ok(direto || porLaco, `${arquivo}: tabela ${tabela} sem enable row level security`)
}

// 4) Nenhum grant para anon/authenticated em tabela nova.
for (const [arquivo, sql] of Object.entries(sqlPendente)) {
  for (const m of sql.matchAll(/grant\s+[^;]*?\s+to\s+([^;]*);/gi)) {
    const trecho = m[0]
    const destino = m[1].toLowerCase()
    if (!/\b(anon|authenticated|public)\b/.test(destino)) continue
    // Exceções conhecidas e revisadas: a view jogador_publico e o select por colunas em Partida (tabela antiga).
    const permitido = /jogador_publico/.test(trecho) || /"Partida"/.test(trecho)
    assert.ok(permitido, `${arquivo}: grant para anon/authenticated fora da lista permitida: ${trecho.replace(/\s+/g, ' ').slice(0, 120)}`)
  }
  for (const { arquivo: arquivoTabela, tabela } of tabelasCriadas) {
    if (arquivoTabela !== arquivo) continue
    assert.ok(
      new RegExp(`revoke\\s+all\\s+on\\s+table\\s+(?:public\\.)?"${tabela}"\\s+from`, 'i').test(sql) || /revoke\s+all\s+on\s+table\s+public\.%I\s+from/i.test(sql),
      `${arquivo}: tabela ${tabela} sem revoke explícito`,
    )
  }
}

// 5) Status de Inscricao: exatamente os cinco estados da inscrição automática.
const sqlInscricao = sqlPendente['202610170026_meu_time_inscricao.sql']
const blocoStatus = /create\s+table\s+if\s+not\s+exists\s+public\."Inscricao"\s*\([\s\S]*?status\s+text\s+not\s+null\s+default\s+'RASCUNHO'\s+check\s*\(status\s+in\s*\(([^)]*)\)\)/i.exec(sqlInscricao)
assert.ok(blocoStatus, 'CHECK de Inscricao.status não encontrado')
const estados = [...blocoStatus![1].matchAll(/'([A-Z_]+)'/g)].map((m) => m[1])
assert.deepEqual(estados, ['RASCUNHO', 'CONFIRMADA', 'CONFIRMADA_COM_PENDENCIAS', 'AJUSTE_PEDIDO', 'REMOVIDA'])
const textoInscricao = ler(dirPendentes, '202610170026_meu_time_inscricao.sql') + ler(dirRollback, '202610170026_meu_time_inscricao.sql')
for (const proibido of ['EM_ANALISE', 'PENDENCIA\'', 'LISTA_ESPERA', 'RECUSADA']) {
  assert.ok(!textoInscricao.includes(proibido), `Inscricao ainda cita ${proibido}`)
}
assert.ok(!/'APROVADA'/.test(sqlInscricao), 'Inscricao ainda aceita APROVADA')
assert.match(sqlInscricao, /avisos\s+jsonb/i, 'Inscricao.avisos jsonb ausente')
assert.ok(!/RENAME\s+(TO|COLUMN)/i.test(Object.values(sqlPendente).join('\n')), 'pendentes não devem renomear tabelas nem colunas')

// 5b) Rodada 3 (Meu Time): ComissaoTime, Atleta de lote, tipos do motor e função experimental.
const sqlComissao = sqlPendente['202610170027_meu_time_comissao_time.sql']
assert.match(sqlComissao, /create\s+table\s+if\s+not\s+exists\s+public\."ComissaoTime"/i)
assert.match(sqlComissao, /"timeId"\s+uuid\s+not\s+null\s+references\s+public\."TimeClube"\(id\)\s+on\s+delete\s+cascade/i)
for (const funcao of ['TECNICO', 'ASSISTENTE', 'PREPARADOR_FISICO', 'FISIOTERAPEUTA', 'MEDICO']) {
  assert.ok(sqlComissao.includes(`'${funcao}'`), `ComissaoTime sem função ${funcao}`)
}
assert.match(sqlComissao, /alter\s+table\s+public\."ComissaoTime"\s+enable\s+row\s+level\s+security/i)
assert.match(sqlComissao, /revoke\s+all\s+on\s+table\s+public\."ComissaoTime"\s+from\s+public,\s*anon,\s*authenticated/i)
assert.match(sqlComissao, /index\s+if\s+not\s+exists\s+"ComissaoTime_timeId_idx"/i)
assert.match(sqlComissao, /add\s+column\s+if\s+not\s+exists\s+"comissaoTimeId"\s+uuid\s+references\s+public\."ComissaoTime"/i)
assert.ok(!/"comissaoTimeId"\s+uuid\s+not\s+null/i.test(sqlComissao), 'comissaoTimeId precisa ser nullable')
assert.match(sqlPendente['202610170028_meu_time_atleta_lote_posicao.sql'], /'LOTE'/)
const sqlLote = sqlPendente['202610170028_meu_time_atleta_lote_posicao.sql']
assert.match(sqlLote, /add\s+column\s+if\s+not\s+exists\s+posicao\s+text/i)
assert.match(sqlLote, /add\s+column\s+if\s+not\s+exists\s+"numeroPreferido"\s+integer/i)
assert.match(sqlLote, /"numeroPreferido"\s+between\s+0\s+and\s+99/i)
assert.match(sqlLote, /origem\s+in\s*\('MIGRACAO',\s*'LOTE'\)\s+or\s+"dataNascimento"\s+is\s+not\s+null/i)
const sqlTipos = sqlPendente['202610170029_sumula_evento_tipos_motor.sql']
const motor = fs.readFileSync(path.join(raiz, 'src', 'lib', 'regras-volei', 'eventos.ts'), 'utf8').replace(/\r\n/g, '\n')
const blocoPayload = /export interface PayloadPorTipo \{([\s\S]*?)\n\}\n\nexport type SumulaEventoTipo/.exec(motor)
assert.ok(blocoPayload, 'PayloadPorTipo não encontrado em eventos.ts')
const tiposMotor = [...blocoPayload![1].matchAll(/^ {2}([A-Z_]+):/gm)].map((m) => m[1])
assert.ok(tiposMotor.length >= 15, 'esperava ao menos 15 tipos no motor')
for (const tipo of tiposMotor) assert.ok(sqlTipos.includes(`'${tipo}'`), `CHECK de SumulaEvento sem o tipo do motor ${tipo}`)
assert.match(sqlTipos, /comment\s+on\s+column\s+public\."SumulaEvento"\.payload/i)
const experimental = fs.readFileSync(path.join(raiz, 'supabase', 'pendentes', 'experimental', 'registrar_inscricao_meu_time.sql'), 'utf8')
assert.match(experimental, /EXPERIMENTAL/)
assert.match(experimental, /revoke\s+all\s+on\s+function\s+public\.registrar_inscricao_meu_time\(jsonb\)\s+from\s+public,\s*anon,\s*authenticated/i)
assert.ok(!/grant\s+execute[^;]*\sto\s+[^;]*\b(anon|authenticated|public)\b/i.test(sqlSemComentario(experimental)), 'função experimental não pode ter execute para anon/authenticated')

// 5c) Rodada 6: Liga.visibilidade (competição privada).
const sqlVisibilidade = sqlPendente['202610170030_liga_visibilidade.sql']
assert.match(sqlVisibilidade, /add\s+column\s+if\s+not\s+exists\s+"visibilidade"\s+text\s+not\s+null\s+default\s+'PUBLICA'/i)
assert.match(sqlVisibilidade, /"visibilidade"\s+in\s*\('PUBLICA',\s*'PRIVADA'\)/i)
assert.ok(!/\bgrant\b/i.test(sqlVisibilidade), 'visibilidade não pode conceder nada a anon')
assert.ok(!/\bupdate\s+public\."Liga"/i.test(sqlVisibilidade), 'sem UPDATE em Liga (triggers de campeonato finalizado)')
assert.match(sqlSemComentario(ler(dirRollback, '202610170030_liga_visibilidade.sql')), /drop\s+column\s+if\s+exists\s+"visibilidade"/i)

// 5d) Rodada 7: RLS pública sem competição PRIVADA (0031).
const nome31 = '202610170031_rls_visibilidade_publica.sql'
assert.ok(pendentes.includes(nome31), 'falta a 0031')
assert.ok(versoes.indexOf('202610170030') < versoes.indexOf('202610170031'), '0031 deve vir depois da 0030')
const sql31 = sqlPendente[nome31]
const bruto31 = ler(dirPendentes, nome31)
assert.match(bruto31, /PRÉ-REQUISITOS[\s\S]*202610170030[\s\S]*202610170003/, 'cabeçalho da 0031 precisa citar 0030 e 0003')
for (const secao of ['QUEBRA DE ROTAS', 'BACKUP NECESSÁRIO', 'JANELA SEGURA', 'REVERSÃO', 'DESEMPENHO']) {
  assert.ok(bruto31.includes(secao), `0031 sem seção ${secao}`)
}
assert.match(sql31, /^\s*begin;\s*set\s+local\s+lock_timeout/i, '0031 deve abrir com begin + lock_timeout')
assert.match(sql31, /commit;\s*$/i)
assert.ok(!/\bgrant\b/i.test(sql31), '0031 não pode conceder nada (nem a anon)')
assert.ok(!/\bcreate\s+policy\b/i.test(sql31), '0031 só reescreve policies existentes (alter policy), nunca recria')
assert.match(sql31, /alter\s+policy\s+%I\s+on\s+public\.%I\s+using/i)
assert.ok(!/\b(update|delete|truncate|drop)\b/i.test(sql31), '0031 não altera dados nem derruba objetos')
for (const [tabela, politica] of [
  ['Liga', 'luv_public_select_liga'], ['CategoriaCampeonato', 'categoria_publica'], ['Equipe', 'luv_public_select_equipe'],
  ['Partida', 'luv_public_select_partida'], ['ClassificacaoEntrada', 'luv_public_select_classificacao'],
]) {
  assert.ok(sql31.includes(`'${tabela}', '${politica}'`), `0031 sem a policy ${politica} de ${tabela}`)
}
const filtros31 = sql31.match(/coalesce\([^)]*"visibilidade",\s*'PUBLICA'\)\s*<>\s*'PRIVADA'/g) ?? []
assert.ok(filtros31.length >= 11, 'esperava o filtro de visibilidade nas 10 policies e na view')
assert.match(sql31, /public\.jogador_publico/)
const rb31 = sqlSemComentario(ler(dirRollback, nome31))
assert.ok(!/\bgrant\b/i.test(rb31), 'reversão da 0031 não pode conceder nada')
assert.ok(!/\bcreate\s+policy\b/i.test(rb31), 'reversão da 0031 não recria policy')
assert.ok(!/visibilidade/i.test(rb31), 'reversão deve devolver as expressões originais, sem visibilidade')
assert.match(rb31, /'categoria_publica',\s*\$e\$\s*true\s*\$e\$/i)
assert.match(rb31, /begin;\s*set\s+local\s+lock_timeout/i)

// 5e) Rodada 8: LGPD de menores (0032): consentimento do responsável e auditoria de exclusão.
const nome32 = '202610170032_lgpd_menores_consentimento.sql'
assert.ok(pendentes.includes(nome32), 'falta a 0032')
const bruto32 = ler(dirPendentes, nome32)
const sql32 = sqlPendente[nome32]
assert.match(bruto32, /PRÉ-REQUISITOS[\s\S]*202610170025/, 'cabeçalho da 0032 precisa citar a 0025')
for (const secao of ['OBJETIVO', 'QUEBRA DE ROTAS', 'BACKUP NECESSÁRIO', 'JANELA SEGURA', 'REVERSÃO']) {
  assert.ok(bruto32.includes(secao), `0032 sem seção ${secao}`)
}
assert.match(sql32, /^\s*begin;\s*set\s+local\s+lock_timeout/i)
assert.match(sql32, /commit;\s*$/i)
for (const tabela of ['AtletaConsentimento', 'AtletaExclusaoPedido']) {
  assert.match(sql32, new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+public\\."${tabela}"`, 'i'))
  assert.ok(sql32.includes(`'${tabela}'`), `0032 sem RLS/revoke no laço para ${tabela}`)
}
assert.match(sql32, /enable\s+row\s+level\s+security/i)
assert.match(sql32, /revoke\s+all\s+on\s+table\s+public\.%I\s+from\s+public,\s*anon,\s*authenticated/i)
assert.match(sql32, /grant\s+select,\s*insert,\s*update,\s*delete\s+on\s+table\s+public\.%I\s+to\s+service_role/i)
assert.ok(!/\bto\s+(anon|authenticated|public)\b/i.test(sql32), '0032 não pode conceder nada a anon/authenticated')
assert.match(sql32, /"responsavelContatoCifrado"\s+bytea/i, 'contato do responsável deve ser cifrado (bytea)')
assert.match(sql32, /"revogadoEm"/)
assert.match(sql32, /unique\s+index\s+if\s+not\s+exists\s+"AtletaConsentimento_ativo_key"[\s\S]*where\s+"revogadoEm"\s+is\s+null/i)
assert.match(sql32, /add\s+column\s+if\s+not\s+exists\s+"anonimizadoEm"/i)
assert.ok(!/\b(update|delete|truncate)\b\s+(from\s+)?public/i.test(sql32), '0032 não altera dados')
const rb32 = sqlSemComentario(ler(dirRollback, nome32))
assert.ok(!/\bgrant\b/i.test(rb32), 'reversão da 0032 não concede nada')
assert.match(rb32, /drop\s+table\s+if\s+exists\s+public\."AtletaConsentimento"/i)
assert.match(rb32, /begin;\s*set\s+local\s+lock_timeout/i)
for (const politica of ['luv_public_select_liga', 'luv_public_select_equipe', 'luv_public_select_partida', 'categoria_publica']) {
  assert.ok(sqlOficial.includes(politica), `policy ${politica} não existe em supabase/migrations`)
}

// 5f) Rodada 9: app de banco e papeleta digital (0033 BancoAcesso, 0034 Papeleta, 0035 PedidoBanco).
const r9 = {
  '202610170033_banco_acesso.sql': 'BancoAcesso',
  '202610170034_papeleta.sql': 'Papeleta',
  '202610170035_pedido_banco.sql': 'PedidoBanco',
} as const
for (const [nome, tabela] of Object.entries(r9)) {
  assert.ok(pendentes.includes(nome), `falta ${nome}`)
  const bruto = ler(dirPendentes, nome)
  const sql = sqlPendente[nome]
  for (const secao of ['OBJETIVO', 'PRÉ-REQUISITOS', 'QUEBRA DE ROTAS', 'BACKUP NECESSÁRIO', 'JANELA SEGURA', 'REVERSÃO']) {
    assert.ok(bruto.includes(secao), `${nome} sem seção ${secao}`)
  }
  assert.match(bruto, /"Partida"[\s\S]*"Equipe"/, `${nome}: cabeçalho deve citar Partida e Equipe como pré-requisito`)
  assert.match(bruto, /Nenhuma/, `${nome}: QUEBRA DE ROTAS deve declarar nenhuma`)
  assert.match(sql, /^\s*begin;\s*set\s+local\s+lock_timeout/i, `${nome}: begin + lock_timeout`)
  assert.match(sql, /commit;\s*$/i)
  assert.match(sql, new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+public\\."${tabela}"`, 'i'))
  assert.match(sql, new RegExp(`alter\\s+table\\s+public\\."${tabela}"\\s+enable\\s+row\\s+level\\s+security`, 'i'))
  assert.match(sql, new RegExp(`revoke\\s+all\\s+on\\s+table\\s+public\\."${tabela}"\\s+from\\s+public,\\s*anon,\\s*authenticated`, 'i'))
  assert.match(sql, new RegExp(`grant\\s+[a-z, ]+\\s+on\\s+table\\s+public\\."${tabela}"\\s+to\\s+service_role`, 'i'))
  assert.ok(!/\bto\s+(anon|authenticated|public)\b/i.test(sql), `${nome}: sem grant para anon/authenticated`)
  assert.ok(!/\bcreate\s+policy\b/i.test(sql), `${nome}: sem policy (acesso só por service_role)`)
  assert.match(sql, /"partidaId"\s+integer\s+not\s+null\s+references\s+public\."Partida"\(id\)/i)
  assert.match(sql, /"equipeId"\s+integer\s+not\s+null\s+references\s+public\."Equipe"\(id\)/i)
  assert.match(sql, /id\s+uuid\s+primary\s+key/i)
  const rb = sqlSemComentario(ler(dirRollback, nome))
  assert.match(rb, new RegExp(`drop\\s+table\\s+if\\s+exists\\s+public\\."${tabela}"`, 'i'), `${nome}: reversão sem drop da tabela`)
  assert.ok(!/\bgrant\b/i.test(rb), `${nome}: reversão não concede nada`)
}
const sqlBanco = sqlPendente['202610170033_banco_acesso.sql']
assert.match(sqlBanco, /"tokenHash"\s+text\s+not\s+null/i)
assert.match(sqlBanco, /"BancoAcesso_tokenHash_key"\s+unique\s*\("tokenHash"\)/i, 'tokenHash deve ser único')
assert.ok(!/\btoken\s+text\b/i.test(sqlBanco), 'BancoAcesso nunca guarda o token em claro')
for (const col of ['expiraEm', 'revogadoEm', 'criadoPor']) assert.ok(sqlBanco.includes(`"${col}"`), `BancoAcesso sem ${col}`)
const sqlPap = sqlPendente['202610170034_papeleta.sql']
assert.match(sqlPap, /formacao\s+jsonb\s+not\s+null/i)
assert.match(sqlPap, /jsonb_array_length\(formacao\)\s*=\s*6/i)
assert.match(sqlPap, /estado\s+in\s*\('RASCUNHO',\s*'ENVIADA',\s*'ACEITA'\)/i)
assert.match(sqlPap, /unique\s*\("partidaId",\s*"equipeId",\s*"setNumero"\)/i)
assert.match(sqlPap, /create\s+trigger\s+papeleta_imutavel_trg\s+before\s+update\s+or\s+delete\s+on\s+public\."Papeleta"/i, 'trigger de imutabilidade ausente')
const fnPap = /create\s+or\s+replace\s+function\s+public\.papeleta_imutavel\(\)[\s\S]*?\$fn\$;/i.exec(sqlPap)
assert.ok(fnPap, 'função papeleta_imutavel ausente')
for (const campo of ['formacao', '"liberoId"', '"capitaoId"']) {
  assert.ok(new RegExp(`new\\.${campo}\\s+is\\s+distinct\\s+from\\s+old\\.${campo}`, 'i').test(fnPap![0]), `trigger não protege ${campo}`)
}
assert.match(fnPap![0], /old\.estado\s+in\s*\('ENVIADA',\s*'ACEITA'\)/i)
assert.match(fnPap![0], /raise\s+exception/i)
assert.match(sqlPap, /revoke\s+all\s+on\s+function\s+public\.papeleta_imutavel\(\)\s+from\s+public,\s*anon,\s*authenticated/i)
assert.match(sqlSemComentario(ler(dirRollback, '202610170034_papeleta.sql')), /drop\s+trigger\s+if\s+exists\s+papeleta_imutavel_trg/i)
const sqlPed = sqlPendente['202610170035_pedido_banco.sql']
assert.match(sqlPed, /tipo\s+in\s*\('TEMPO',\s*'SUBSTITUICAO',\s*'DESAFIO'\)/i)
assert.match(sqlPed, /estado\s+in\s*\('PENDENTE',\s*'ACEITO',\s*'RECUSADO',\s*'CANCELADO'\)/i)
assert.match(sqlPed, /payload\s+jsonb\s+not\s+null\s+default\s+'\{\}'/i)
assert.match(sqlPed, /index\s+if\s+not\s+exists\s+"PedidoBanco_partidaId_estado_idx"\s+on\s+public\."PedidoBanco"\s*\("partidaId",\s*estado\)/i)

// 5g) Rodada 10 (Meu Time): 0036 ConviteAtleta, 0037 ImportacaoAtletas, 0038 ClubeEquipe, 0039 Notificacao.
const r10 = {
  '202610170036_convite_atleta.sql': 'ConviteAtleta',
  '202610170037_importacao_atletas.sql': 'ImportacaoAtletas',
  '202610170038_clube_equipe.sql': 'ClubeEquipe',
  '202610170039_notificacao.sql': 'Notificacao',
} as const
for (const [nome, tabela] of Object.entries(r10)) {
  assert.ok(pendentes.includes(nome), `falta ${nome}`)
  const bruto = ler(dirPendentes, nome)
  const sql = sqlPendente[nome]
  for (const secao of ['OBJETIVO', 'PRÉ-REQUISITOS', 'QUEBRA DE ROTAS', 'BACKUP NECESSÁRIO', 'JANELA SEGURA', 'REVERSÃO']) {
    assert.ok(bruto.includes(secao), `${nome} sem seção ${secao}`)
  }
  assert.match(sql, /^\s*begin;\s*set\s+local\s+lock_timeout/i, `${nome}: begin + lock_timeout`)
  assert.match(sql, /commit;\s*$/i)
  assert.match(sql, new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+public\\."${tabela}"`, 'i'))
  assert.match(sql, new RegExp(`alter\\s+table\\s+public\\."${tabela}"\\s+enable\\s+row\\s+level\\s+security`, 'i'))
  assert.match(sql, new RegExp(`revoke\\s+all\\s+on\\s+table\\s+public\\."${tabela}"\\s+from\\s+public,\\s*anon,\\s*authenticated`, 'i'))
  assert.match(sql, new RegExp(`grant\\s+[a-z, ]+\\s+on\\s+table\\s+public\\."${tabela}"\\s+to\\s+service_role`, 'i'))
  assert.ok(!/\bto\s+(anon|authenticated|public)\b/i.test(sql), `${nome}: sem grant para anon/authenticated`)
  assert.ok(!/\bcreate\s+policy\b/i.test(sql), `${nome}: sem policy (acesso só por service_role)`)
  assert.ok(!/\b(update|delete)\s+(from\s+)?public\./i.test(sql), `${nome}: não altera dados`)
  const rb = sqlSemComentario(ler(dirRollback, nome))
  assert.match(rb, new RegExp(`drop\\s+table\\s+if\\s+exists\\s+public\\."${tabela}"`, 'i'), `${nome}: reversão sem drop da tabela`)
  assert.match(rb, /begin;\s*set\s+local\s+lock_timeout/i)
  assert.ok(!/\bgrant\b/i.test(rb), `${nome}: reversão não concede nada`)
}
const sqlConvite = sqlPendente['202610170036_convite_atleta.sql']
assert.match(sqlConvite, /"tokenHash"\s+text\s+not\s+null/i)
assert.match(sqlConvite, /"ConviteAtleta_tokenHash_key"\s+unique\s*\("tokenHash"\)/i, 'tokenHash deve ser único')
assert.ok(!/\btoken\s+text\b/i.test(sqlConvite), 'ConviteAtleta nunca guarda o token em claro')
assert.match(sqlConvite, /"contatoCifrado"\s+bytea(?!\s+not\s+null)/i, 'contatoCifrado nullable')

assert.match(sqlConvite, /"timeId"\s+uuid\s+not\s+null\s+references\s+public\."TimeClube"\(id\)/i)
assert.match(sqlConvite, /"atletaId"\s+uuid\s+references\s+public\."Atleta"\(id\)/i)
for (const col of ['criadoPor', 'criadoEm', 'expiraEm', 'revogadoEm', 'usadoEm']) assert.ok(sqlConvite.includes(`"${col}"`), `ConviteAtleta sem ${col}`)
const sqlImp = sqlPendente['202610170037_importacao_atletas.sql']
assert.match(sqlImp, /status\s+in\s*\('PREVIA',\s*'CONFIRMADA'\)/i)
assert.match(sqlImp, /linhas\s+jsonb\s+not\s+null/i)
assert.match(sqlImp, /resumo\s+jsonb/i)
assert.match(sqlImp, /"timeId"\s+uuid\s+not\s+null\s+references\s+public\."TimeClube"\(id\)/i)
assert.match(sqlImp, /"expiraEm"\s+timestamptz\s+not\s+null\s+default\s+now\(\)\s*\+\s*interval\s+'72 hours'/i, 'prévia expira em 72 h')
assert.match(sqlImp, /index\s+if\s+not\s+exists\s+"ImportacaoAtletas_expiraEm_idx"\s+on\s+public\."ImportacaoAtletas"\s*\("expiraEm"\)/i)
assert.match(ler(dirPendentes, '202610170037_importacao_atletas.sql'), /RETENÇÃO[\s\S]*72 h/, 'cabeçalho da 0037 deve citar a retenção de 72 h')
assert.match(ler(dirPendentes, '202610170039_notificacao.sql'), /RETENÇÃO[\s\S]*jurídico/, 'cabeçalho da 0039 deve citar a retenção')
assert.match(ler(dirPendentes, '202610170036_convite_atleta.sql'), /USO DE "contatoCifrado"[\s\S]*NENHUMA rota/, 'cabeçalho da 0036 deve explicar contatoCifrado')
assert.match(ler(dirPendentes, '202610170038_clube_equipe.sql'), /NÃO APLICAR: redundante com TimeClube\.clubeId; mantida só como referência/, 'cabeçalho da 0038 deve marcar NÃO APLICAR')
const sqlClube = sqlPendente['202610170038_clube_equipe.sql']
assert.ok(!/create\s+table\s+(?:if\s+not\s+exists\s+)?public\."Clube"\s*\(/i.test(sqlClube), '"Clube" já é criada na 0024: a 0038 não pode recriá-la')
assert.match(sqlPendente['202610170024_meu_time_organizador_clube.sql'], /create\s+table\s+if\s+not\s+exists\s+public\."Clube"/i)
assert.match(sqlClube, /alter\s+table\s+public\."Clube"\s+add\s+column\s+if\s+not\s+exists\s+"donoUserId"\s+text\s*;/i, 'donoUserId deve ser nullable')
assert.match(sqlClube, /unique\s*\("clubeId",\s*"equipeId"\)/i)
assert.match(sqlClube, /"clubeId"\s+uuid\s+not\s+null\s+references\s+public\."Clube"\(id\)/i)
const rbClube = sqlSemComentario(ler(dirRollback, '202610170038_clube_equipe.sql'))
assert.ok(!/drop\s+table[^;]*"Clube"\s*;/i.test(rbClube), 'reversão da 0038 não pode derrubar "Clube" (pertence à 0024)')
assert.match(rbClube, /drop\s+column\s+if\s+exists\s+"donoUserId"/i)
const sqlNotif = sqlPendente['202610170039_notificacao.sql']
assert.match(sqlNotif, /"usuarioId"\s+text\s+not\s+null/i)
assert.match(sqlNotif, /titulo\s+text\s+not\s+null/i)
assert.match(sqlNotif, /index\s+if\s+not\s+exists\s+"Notificacao_usuarioId_lidaEm_idx"\s+on\s+public\."Notificacao"\s*\("usuarioId",\s*"lidaEm"\)/i)

// 5h) Rodada 11 (scout de quadra): 0040 ScoutAcao, 0041 DesafioVideo.
const r11 = {
  '202610170040_scout_acao.sql': 'ScoutAcao',
  '202610170041_desafio_video.sql': 'DesafioVideo',
} as const
for (const [nome, tabela] of Object.entries(r11)) {
  assert.ok(pendentes.includes(nome), `falta ${nome}`)
  const bruto = ler(dirPendentes, nome)
  const sql = sqlPendente[nome]
  for (const secao of ['OBJETIVO', 'PRÉ-REQUISITOS', 'QUEBRA DE ROTAS', 'BACKUP NECESSÁRIO', 'JANELA SEGURA', 'REVERSÃO']) {
    assert.ok(bruto.includes(secao), `${nome} sem seção ${secao}`)
  }
  assert.match(bruto, /"Partida"[\s\S]*"Equipe"/, `${nome}: cabeçalho deve citar Partida e Equipe`)
  assert.match(sql, /^\s*begin;\s*set\s+local\s+lock_timeout/i, `${nome}: begin + lock_timeout`)
  assert.match(sql, /commit;\s*$/i)
  assert.match(sql, new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+public\\."${tabela}"`, 'i'))
  assert.match(sql, new RegExp(`alter\\s+table\\s+public\\."${tabela}"\\s+enable\\s+row\\s+level\\s+security`, 'i'))
  assert.match(sql, new RegExp(`revoke\\s+all\\s+on\\s+table\\s+public\\."${tabela}"\\s+from\\s+public,\\s*anon,\\s*authenticated`, 'i'))
  assert.match(sql, new RegExp(`grant\\s+[a-z, ]+\\s+on\\s+table\\s+public\\."${tabela}"\\s+to\\s+service_role`, 'i'))
  assert.ok(!/\bto\s+(anon|authenticated|public)\b/i.test(sql), `${nome}: sem grant para anon/authenticated`)
  assert.ok(!/\bcreate\s+policy\b/i.test(sql), `${nome}: sem policy (acesso só por service_role)`)
  assert.ok(!/\b(update|delete)\s+(from\s+)?public\./i.test(sql), `${nome}: não altera dados`)
  assert.ok(!/praia/i.test(bruto), `${nome}: produto é só vôlei de quadra`)
  // ScoutAcao usa bigint identity (o backend trata o id como número); DesafioVideo usa uuid.
  assert.match(sql, tabela === 'ScoutAcao' ? /id\s+bigint\s+generated\s+always\s+as\s+identity\s+primary\s+key/i : /id\s+uuid\s+primary\s+key/i)
  assert.match(sql, /"partidaId"\s+integer\s+not\s+null\s+references\s+public\."Partida"\(id\)/i)
  assert.match(sql, /"setNumero"\s+integer\s+not\s+null/i)
  assert.match(sql, /"equipeId"\s+integer\s+not\s+null\s+references\s+public\."Equipe"\(id\)/i)
  const rb = sqlSemComentario(ler(dirRollback, nome))
  assert.match(rb, new RegExp(`drop\\s+table\\s+if\\s+exists\\s+public\\."${tabela}"`, 'i'), `${nome}: reversão sem drop da tabela`)
  assert.match(rb, /begin;\s*set\s+local\s+lock_timeout/i)
  assert.ok(!/\bgrant\b/i.test(rb), `${nome}: reversão não concede nada`)
}
const sqlScout = sqlPendente['202610170040_scout_acao.sql']
assert.match(sqlScout, /"jogadorId"\s+integer\s+references\s+public\."Jogador"\(id\)\s+on\s+delete\s+set\s+null/i, 'jogadorId nullable')
assert.match(sqlScout, /fundamento\s+text\s+not\s+null\s+check\s*\(fundamento\s+in\s*\('SAQUE',\s*'RECEPCAO',\s*'LEVANTAMENTO',\s*'ATAQUE',\s*'BLOQUEIO',\s*'DEFESA',\s*'CONTRA_ATAQUE'\)\)/i)
assert.match(sqlScout, /resultado\s+text\s+not\s+null\s+check\s*\(resultado\s+in\s*\('PONTO',\s*'ERRO',\s*'CONTINUA',\s*'NEUTRO'\)\)/i)
assert.match(sqlScout, /"zonaOrigem"\s+smallint\s+check\s*\("zonaOrigem"\s+between\s+1\s+and\s+9\)/i)
assert.match(sqlScout, /"zonaDestino"\s+smallint\s+check\s*\("zonaDestino"\s+between\s+1\s+and\s+9\)/i)
assert.match(sqlScout, /rotacao\s+smallint\s+check\s*\(rotacao\s+between\s+1\s+and\s+6\)/i)
assert.match(sqlScout, /"clientEventId"\s+text\s+not\s+null/i)
assert.match(sqlScout, /unique\s*\("partidaId",\s*"clientEventId"\)/i, 'idempotência por partida + clientEventId')
assert.match(sqlScout, /"anuladoEm"\s+timestamptz\s*,/i, 'anuladoEm nullable')
assert.match(sqlScout, /index\s+if\s+not\s+exists\s+"ScoutAcao_partidaId_setNumero_idx"\s+on\s+public\."ScoutAcao"\s*\("partidaId",\s*"setNumero"\)/i)
const sqlDes = sqlPendente['202610170041_desafio_video.sql']
assert.match(sqlDes, /estado\s+text\s+not\s+null\s+default\s+'SOLICITADO'\s+check\s*\(estado\s+in\s*\('SOLICITADO',\s*'EM_ANALISE',\s*'MANTIDA',\s*'REVERTIDA',\s*'INCONCLUSIVA',\s*'CANCELADO'\)\)/i)
assert.match(sqlDes, /motivo\s+text\s+check\s*\(motivo\s+is\s+null\s+or\s+char_length\(motivo\)\s*<=\s*500\)/i)
assert.match(sqlDes, /"linkVideo"\s+text\s+check\s*\("linkVideo"\s+is\s+null\s+or\s+char_length\("linkVideo"\)\s*<=\s*500\)/i)
assert.match(sqlDes, /"pedidoBancoId"\s+uuid\s+references\s+public\."PedidoBanco"\(id\)\s+on\s+delete\s+set\s+null/i)
assert.match(sqlDes, /check\s*\(estado\s+not\s+in\s*\('MANTIDA',\s*'REVERTIDA',\s*'INCONCLUSIVA',\s*'CANCELADO'\)\s+or\s+"decididoEm"\s+is\s+not\s+null\)/i)
assert.match(sqlDes, /index\s+if\s+not\s+exists\s+"DesafioVideo_partidaId_setNumero_equipeId_idx"\s+on\s+public\."DesafioVideo"\s*\("partidaId",\s*"setNumero",\s*"equipeId"\)/i)
assert.ok(versoes.indexOf('202610170035') < versoes.indexOf('202610170041'), '0041 deve vir depois da 0035 (PedidoBanco)')
assert.match(ler(dirPendentes, '202610170041_desafio_video.sql'), /PRÉ-REQUISITOS[\s\S]*202610170035/, 'cabeçalho da 0041 deve citar a 0035')

// 5i) .env.example documenta as flags das rodadas 9 a 12, comentadas (desligadas) e sem segredo.
const envExemplo = fs.readFileSync(path.join(raiz, '.env.example'), 'utf8')
for (const flag of ['BANCO_APP_ATIVO', 'SCOUT_ATIVO', 'DESAFIO_ATIVO', 'DESAFIO_LIMITE_POR_SET', 'AO_VIVO_ATIVO', 'MEU_TIME_ATIVO', 'MEU_TIME_FASE2_ATIVO', 'SUMULA_EVENTOS_ATIVO', 'SUMULA_SERVIDOR_SOMBRA', 'LGPD_CHAVE_CIFRA', 'NEXT_PUBLIC_BANCO_APP_ATIVO', 'NEXT_PUBLIC_SCOUT_ATIVO', 'NEXT_PUBLIC_DESAFIO_ATIVO', 'NEXT_PUBLIC_AO_VIVO_ATIVO', 'NEXT_PUBLIC_MEU_TIME_FASE2_ATIVO', 'NEXT_PUBLIC_SUMULA_EVENTOS_ATIVO', 'NEXT_PUBLIC_PROTOTIPO_ATIVO']) {
  assert.match(envExemplo, new RegExp(`^# ${flag}=`, 'm'), `.env.example: ${flag} deve estar documentada e comentada`)
  assert.ok(!new RegExp(`^${flag}=`, 'm').test(envExemplo), `.env.example: ${flag} deve vir desligada (comentada)`)
}
assert.ok(!/^\s*#?\s*NEXT_PUBLIC_LGPD/m.test(envExemplo), 'chave de cifra nunca usa NEXT_PUBLIC_')

// 6) Índices CONCURRENTLY: um comando, sem transação; reversões de índice duplicado não derrubam o índice oficial.
for (const arquivo of pendentes.filter((nome) => /_idx_/.test(nome))) {
  const sql = sqlPendente[arquivo]
  assert.ok(!/\b(begin|commit)\b/i.test(sql), `${arquivo}: CONCURRENTLY não pode ficar em transação`)
  assert.equal((sql.match(/;/g) ?? []).length, 1, `${arquivo}: deve conter um único comando`)
  const nomeIndice = /index\s+concurrently\s+if\s+not\s+exists\s+"([^"]+)"/i.exec(sql)?.[1]
  assert.ok(nomeIndice, `${arquivo}: índice não identificado`)
  if (new RegExp(`index\\s+if\\s+not\\s+exists\\s+"${nomeIndice}"`, 'i').test(sqlOficial)) {
    const rb = sqlSemComentario(ler(dirRollback, arquivo))
    assert.ok(!/drop\s+index/i.test(rb), `${arquivo}: reversão derrubaria índice que pertence a supabase/migrations`)
  }
}

// 7) Seed: existe, é idempotente e só tem dados fictícios.
const seed = fs.readFileSync(arquivoSeed, 'utf8')
const seedSql = sqlSemComentario(seed)
assert.ok(!/\b(delete|truncate|drop)\b/i.test(seedSql), 'seed não pode apagar dados')
assert.ok(!/senhaHash|passwordHash/i.test(seedSql), 'seed não deve gravar hash de senha')
assert.ok(!/\bupdate\s+"/i.test(seedSql), 'seed não deve atualizar dados existentes')
for (const m of seedSql.matchAll(/[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+)/g)) {
  assert.ok(/\.invalid$/.test(m[1]), `e-mail no seed fora do domínio reservado .invalid: ${m[0]}`)
}
for (const m of seedSql.matchAll(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g)) {
  assert.ok(m[0].startsWith('000.000.000-'), `CPF no seed não é de teste: ${m[0]}`)
}
for (const m of seedSql.matchAll(/'(\d{10,14})'/g)) {
  assert.ok(m[1].startsWith('0000000'), `número longo no seed (CPF/telefone) não é de teste: ${m[1]}`)
}
for (const chave of ['CandidaturaOrganizador', 'SEED-R2-LIGA-01', 'SEED-R2-LIGA-02', 'SEED-R2-LIGA-03', 'SEED-R2-GAME-01', "'EM_ANDAMENTO'", "'ENCERRADA'", 'simulacao']) {
  assert.ok(seedSql.includes(chave) || seedSql.includes(chave.replace(/'/g, '')), `seed sem ${chave}`)
}
assert.ok(/not\s+exists|on\s+conflict/i.test(seedSql), 'seed precisa de guarda de idempotência')
assert.ok(!/service_role|eyJ[A-Za-z0-9_-]{20,}|sbp_[A-Za-z0-9]+/.test(seed), 'seed não pode conter chave')

// 5h) Rodada 13: libero2Id (0034), ciência LGPD (0036) e expurgo de prévias (0042).
assert.match(sqlPap, /"libero2Id"\s+integer\s+references\s+public\."Jogador"\(id\)\s+on\s+delete\s+set\s+null/i, 'Papeleta.libero2Id ausente ou sem set null')
assert.ok(!/"libero2Id"\s+integer\s+not\s+null/i.test(sqlPap), 'libero2Id precisa ser nullable')
assert.match(sqlPap, /check\s*\(\s*"liberoId"\s+is\s+null\s+or\s+"libero2Id"\s+is\s+null\s+or\s+"liberoId"\s+<>\s+"libero2Id"\s*\)/i, 'CHECK liberoId <> libero2Id ausente')
assert.match(fnPap![0], /new\."libero2Id"\s+is\s+distinct\s+from\s+old\."libero2Id"/i, 'trigger não protege libero2Id')
assert.match(sqlConvite, /"cienciaLgpdEm"\s+timestamptz\s*,/i, 'ConviteAtleta.cienciaLgpdEm ausente')
assert.match(sqlConvite, /"cienciaVersao"\s+text/i, 'ConviteAtleta.cienciaVersao ausente')
assert.ok(!/"cienciaLgpdEm"\s+timestamptz\s+not\s+null/i.test(sqlConvite), 'cienciaLgpdEm precisa ser nullable')
const nome42 = '202610170042_expurgo_previas_importacao.sql'
assert.ok(pendentes.includes(nome42), 'falta a 0042')
assert.ok(versoes.indexOf('202610170037') < versoes.indexOf('202610170042'), '0042 deve vir depois da 0037')
const bruto42 = ler(dirPendentes, nome42)
const sql42 = sqlPendente[nome42]
for (const secao of ['OBJETIVO', 'COMO AGENDAR', 'PRÉ-REQUISITOS', 'QUEBRA DE ROTAS', 'BACKUP NECESSÁRIO', 'JANELA SEGURA', 'REVERSÃO']) {
  assert.ok(bruto42.includes(secao), `0042 sem seção ${secao}`)
}
assert.match(bruto42, /pg_cron[\s\S]*Vercel/i, 'cabeçalho da 0042 deve explicar pg_cron e cron da Vercel')
assert.ok(!/cron\.schedule/i.test(sql42), '0042 não pode agendar nada')
const fn42 = /create\s+or\s+replace\s+function\s+public\.expurgar_previas_importacao\(\)[\s\S]*?\$fn\$;/i.exec(sql42)
assert.ok(fn42, 'função expurgar_previas_importacao ausente')
assert.match(fn42![0], /security\s+definer/i)
assert.match(fn42![0], /set\s+search_path\s*=\s*public/i, 'security definer sem search_path fixo')
assert.match(fn42![0], /delete\s+from\s+public\."ImportacaoAtletas"[\s\S]*status\s*=\s*'PREVIA'[\s\S]*"expiraEm"\s*<\s*now\(\)/i)
assert.match(sql42, /revoke\s+all\s+on\s+function\s+public\.expurgar_previas_importacao\(\)\s+from\s+public,\s*anon,\s*authenticated/i)
assert.match(sql42, /grant\s+execute\s+on\s+function\s+public\.expurgar_previas_importacao\(\)\s+to\s+service_role\s*;/i)
assert.ok(!/grant\s+[^;]*\bto\s+[^;]*\b(anon|authenticated|public)\b/i.test(sql42), '0042 não pode conceder a anon/authenticated/public')
assert.match(sqlSemComentario(ler(dirRollback, nome42)), /drop\s+function\s+if\s+exists\s+public\.expurgar_previas_importacao\(\)/i)

// 5j) Rodada 14: modoInscricao na categoria e SolicitacaoInscricao (0043).
const nome43 = '202610170043_solicitacao_inscricao.sql'
assert.ok(pendentes.includes(nome43), 'falta a 0043')
for (const dep of ['202610170024', '202610170026', '202610170039']) {
  assert.ok(versoes.indexOf(dep) < versoes.indexOf('202610170043'), `0043 deve vir depois da ${dep}`)
}
const bruto43 = ler(dirPendentes, nome43)
const sql43 = sqlPendente[nome43]
for (const secao of ['OBJETIVO', 'PRÉ-REQUISITOS', 'QUEBRA DE ROTAS', 'BACKUP NECESSÁRIO', 'JANELA SEGURA', 'REVERSÃO']) {
  assert.ok(bruto43.includes(secao), `0043 sem seção ${secao}`)
}
assert.match(sql43, /add\s+column\s+if\s+not\s+exists\s+"modoInscricao"\s+text\s+not\s+null\s+default\s+'AUTOMATICA'/i)
assert.match(sql43, /check\s*\("modoInscricao"\s+in\s*\('AUTOMATICA',\s*'APROVACAO'\)\)/i)
assert.match(sql43, /create\s+table\s+if\s+not\s+exists\s+public\."SolicitacaoInscricao"/i)
assert.match(sql43, /"timeId"\s+uuid\s+not\s+null\s+references\s+public\."TimeClube"\(id\)\s+on\s+delete\s+cascade/i)
assert.match(sql43, /"categoriaId"\s+uuid\s+not\s+null/i)
assert.match(sql43, /foreign\s+key\s*\("categoriaId",\s*"ligaId"\)\s+references\s+public\."CategoriaCampeonato"\(id,\s*"ligaId"\)/i)
assert.match(sql43, /estado\s+text\s+not\s+null\s+default\s+'PENDENTE'\s+check\s*\(estado\s+in\s*\('PENDENTE',\s*'APROVADA',\s*'RECUSADA',\s*'CANCELADA'\)\)/i)
assert.match(sql43, /mensagem\s+text\s+check\s*\(mensagem\s+is\s+null\s+or\s+char_length\(mensagem\)\s*<=\s*500\)/i)
assert.match(sql43, /"motivoRecusa"\s+text\s+check\s*\("motivoRecusa"\s+is\s+null\s+or\s+char_length\("motivoRecusa"\)\s*<=\s*500\)/i)
assert.match(sql43, /"solicitadoPor"\s+text\s+not\s+null/i)
assert.match(sql43, /"decididoPor"\s+text\s*,/i)
assert.match(sql43, /"inscricaoId"\s+uuid\s+references\s+public\."Inscricao"\(id\)\s+on\s+delete\s+set\s+null/i)
assert.match(sql43, /check\s*\(estado\s+not\s+in\s*\('APROVADA',\s*'RECUSADA'\)\s+or\s+"decididoEm"\s+is\s+not\s+null\)/i)
assert.match(sql43, /create\s+unique\s+index\s+if\s+not\s+exists\s+"SolicitacaoInscricao_pendente_key"\s+on\s+public\."SolicitacaoInscricao"\s*\("timeId",\s*"categoriaId"\)\s+where\s+estado\s*=\s*'PENDENTE'/i)
assert.match(sql43, /index\s+if\s+not\s+exists\s+"SolicitacaoInscricao_categoriaId_estado_idx"\s+on\s+public\."SolicitacaoInscricao"\s*\("categoriaId",\s*estado\)/i)
assert.match(sql43, /index\s+if\s+not\s+exists\s+"SolicitacaoInscricao_timeId_estado_idx"\s+on\s+public\."SolicitacaoInscricao"\s*\("timeId",\s*estado\)/i)
assert.match(sql43, /alter\s+table\s+public\."SolicitacaoInscricao"\s+enable\s+row\s+level\s+security/i)
assert.match(sql43, /revoke\s+all\s+on\s+table\s+public\."SolicitacaoInscricao"\s+from\s+public,\s*anon,\s*authenticated/i)
assert.match(sql43, /grant\s+select,\s*insert,\s*update,\s*delete\s+on\s+table\s+public\."SolicitacaoInscricao"\s+to\s+service_role/i)
assert.ok(!/create\s+policy/i.test(sql43), '0043 não cria policy (só service_role)')
assert.ok(!/alter\s+table\s+public\."Notificacao"/i.test(sql43), '0043 não altera Notificacao')
const rb43 = sqlSemComentario(ler(dirRollback, nome43))
assert.match(rb43, /drop\s+table\s+if\s+exists\s+public\."SolicitacaoInscricao"/i)
assert.match(rb43, /drop\s+column\s+if\s+exists\s+"modoInscricao"/i)
assert.ok(!/drop\s+table[^;]*"(Inscricao|TimeClube|Notificacao|CategoriaCampeonato)"/i.test(rb43), 'reversão da 0043 não derruba tabelas de outras migrations')

// 5k) Rodada 14b: atletas escolhidos na solicitação (0044).
const nome44 = '202610170044_solicitacao_atletas_escolhidos.sql'
assert.ok(pendentes.includes(nome44), 'falta a 0044')
assert.ok(versoes.indexOf('202610170043') < versoes.indexOf('202610170044'), '0044 deve vir depois da 0043')
const bruto44 = ler(dirPendentes, nome44)
const sql44 = sqlPendente[nome44]
for (const secao of ['OBJETIVO', 'PRÉ-REQUISITOS', 'QUEBRA DE ROTAS', 'BACKUP NECESSÁRIO', 'JANELA SEGURA', 'REVERSÃO']) {
  assert.ok(bruto44.includes(secao), `0044 sem seção ${secao}`)
}
assert.match(sql44, /add\s+column\s+if\s+not\s+exists\s+"atletasEscolhidos"\s+uuid\[\]/i)
assert.match(sql44, /to_regclass\('public\."SolicitacaoInscricao"'\)\s+is\s+null/i)
assert.ok(!/create\s+policy/i.test(sql44) && !/grant\s/i.test(sql44), '0044 não cria policy nem concede acesso')
assert.match(sqlSemComentario(ler(dirRollback, nome44)), /drop\s+column\s+if\s+exists\s+"atletasEscolhidos"/i)

const config = fs.readFileSync(path.join(raiz, 'supabase', 'config.toml'), 'utf8')
assert.match(config, /sql_paths\s*=\s*\["\.\/seed\.sql"\]/)
assert.ok(!/(secret|key)\s*=\s*"[^"]{12,}"/i.test(config), 'config.toml não pode conter segredo')

console.log(`migracoes-pendentes: ${pendentes.length} migrations, ${tabelasCriadas.length} tabelas novas, seed e config OK`)
