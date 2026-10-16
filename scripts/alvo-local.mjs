// Trava de segurança dos comandos locais (setup e reset-db): só aceitam banco LOCAL.
// Recusa qualquer URL que não seja 127.0.0.1 ou localhost, em especial *.supabase.co e
// *.supabase.com (inclui o pooler). As mensagens citam só o NOME da variável: nunca
// imprimem URL, usuário nem senha.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const VARIAVEIS_DE_BANCO = ['NEXT_PUBLIC_SUPABASE_URL', 'DATABASE_URL', 'DIRECT_URL']
const HOSTS_LOCAIS = ['127.0.0.1', 'localhost']

/** Confere uma URL. Devolve { ok: true } ou { ok: false, motivo } sem expor o valor. */
export function verificarAlvoLocal(url) {
  const texto = typeof url === 'string' ? url.trim() : ''
  if (!texto) return { ok: false, motivo: 'valor vazio' }
  let host = ''
  try {
    host = new URL(texto).hostname.toLowerCase()
  } catch {
    return { ok: false, motivo: 'valor ilegível' }
  }
  if (HOSTS_LOCAIS.includes(host)) return { ok: true }
  if (host.endsWith('.supabase.co') || host.endsWith('.supabase.com')) {
    return { ok: false, motivo: 'aponta para um projeto Supabase remoto' }
  }
  return { ok: false, motivo: 'não é um host local (127.0.0.1 ou localhost)' }
}

/** Lê um arquivo .env simples (CHAVE=valor) sem executar nada. */
export function lerArquivoEnv(caminho) {
  if (!fs.existsSync(caminho)) return {}
  const valores = {}
  for (const linha of fs.readFileSync(caminho, 'utf8').split(/\r?\n/)) {
    const encontrada = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linha)
    if (!encontrada) continue
    valores[encontrada[1]] = encontrada[2].replace(/^["']|["']$/g, '')
  }
  return valores
}

/** Variáveis de banco vindas do .env.local e do ambiente (o ambiente vence). */
export function lerAlvosDoAmbiente(env = process.env, raiz = process.cwd()) {
  const doArquivo = lerArquivoEnv(path.join(raiz, '.env.local'))
  const alvos = {}
  for (const nome of VARIAVEIS_DE_BANCO) {
    const valor = env[nome] ?? doArquivo[nome]
    if (valor !== undefined && String(valor).trim() !== '') alvos[nome] = String(valor)
  }
  return alvos
}

/** Lista de problemas (só nomes de variável e motivo). Vazia = tudo local. */
export function verificarAlvos(alvos) {
  const problemas = []
  for (const [nome, valor] of Object.entries(alvos)) {
    const resultado = verificarAlvoLocal(valor)
    if (!resultado.ok) problemas.push(`${nome}: ${resultado.motivo}`)
  }
  return problemas
}

/** Encerra o processo com erro se algum alvo configurado não for local. */
export function exigirAlvoLocal(env = process.env, raiz = process.cwd()) {
  const problemas = verificarAlvos(lerAlvosDoAmbiente(env, raiz))
  if (problemas.length === 0) return
  console.error('Recusado: este comando só roda contra banco LOCAL.')
  for (const problema of problemas) console.error(`  - ${problema}`)
  console.error('Ajuste o .env.local para o Supabase local (127.0.0.1) ou remova essas variáveis.')
  process.exit(1)
}

// Modo linha de comando: `node scripts/alvo-local.mjs [url...]`.
// Sem argumentos confere o ambiente e o .env.local. Saída 0 = ok, 1 = recusado.
const executadoDireto = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (executadoDireto) {
  const argumentos = process.argv.slice(2)
  if (argumentos.length === 0) {
    exigirAlvoLocal()
    console.log('ok: nenhum alvo remoto configurado')
  } else {
    const problemas = verificarAlvos(Object.fromEntries(argumentos.map((valor, indice) => [`argumento ${indice + 1}`, valor])))
    if (problemas.length > 0) {
      for (const problema of problemas) console.error(`Recusado: ${problema}`)
      process.exit(1)
    }
    console.log('ok')
  }
}
