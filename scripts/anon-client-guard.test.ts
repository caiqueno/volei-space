import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// Teste-guarda: o client anon (src/lib/supabase.ts) não pode voltar para rota nem lib de servidor.
// Motivo: a migration 202610170003 revoga o acesso de anon às tabelas; código que ainda lê ou
// grava por esse client quebra no dia em que ela rodar (docs/analise/PLANO-FASE-0, seção 5.3).
// Para servidor: supabaseAdmin (src/lib/supabase-admin.ts) com colunas explícitas e checagem
// de sessão/dono. Para saber só se o ambiente está configurado: src/lib/supabase-config.ts.

const raiz = process.cwd()

/**
 * EXCEÇÕES DOCUMENTADAS. Todo importador do client anon precisa estar aqui, com o motivo.
 * Adicionar um arquivo novo à lista exige justificativa em revisão; arquivos de src/app/api
 * não entram na lista.
 */
const EXCECOES: Record<string, string> = {
  // Hook de navegador (realtime). Fica enquanto não houver canal servidor -> cliente.
  'src/lib/use-banco-ao-vivo.ts': 'hook de cliente (realtime)',
  // Uploads diretos do navegador. Saem quando migrarem para /api/uploads/assinar (docs/analise/21).
  'src/app/cadastro/page.tsx': 'cliente: upload direto',
  'src/components/candidate/CandidateEditForm.tsx': 'cliente: upload direto',
  'src/components/galeria/GaleriaOrganizador.tsx': 'cliente: upload direto',
  'src/components/inscricao-rapida/FormularioInscricaoRapida.tsx': 'cliente: upload direto',
  'src/components/painel/organizador/OrganizacaoForm.tsx': 'cliente: upload direto',
  'src/components/parametrizacao/sections/informacoes/InformacoesWizard.tsx': 'cliente: upload direto',
  // (Páginas que só liam isSupabaseConfigured já usam supabase-config e saíram da lista.)
}

/** Área de servidor: rotas de API, libs, utilitários, middleware, route.ts e sitemap. */
function ehServidor(relativo: string) {
  return relativo.startsWith('src/app/api/')
    || relativo.startsWith('src/lib/')
    || relativo.startsWith('src/utils/')
    || relativo === 'src/middleware.ts'
    || relativo === 'src/app/sitemap.ts'
    || /\/route\.ts$/.test(relativo)
}

function arquivosFonte(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const completo = path.join(dir, entrada.name)
    if (entrada.isDirectory()) return arquivosFonte(completo)
    return /\.(ts|tsx|mjs|js)$/.test(entrada.name) ? [completo] : []
  })
}

/** Especificadores que apontam para src/lib/supabase.ts (e não supabase-admin, -env ou -config). */
function importaClientAnon(fonte: string, relativo: string) {
  const sem = fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const especificadores = Array.from(sem.matchAll(/(?:from|import\s*\(|require\s*\()\s*['"]([^'"]+)['"]/g)).map((m) => m[1])
  return especificadores.some((spec) => {
    if (spec === '@/lib/supabase') return true
    if (!spec.startsWith('.')) return false
    const resolvido = path.posix.normalize(path.posix.join(path.posix.dirname(relativo), spec))
    return resolvido === 'src/lib/supabase'
  })
}

// Auto-teste do detector, para o guarda não virar um falso verde.
assert.equal(importaClientAnon("import { supabase } from '@/lib/supabase'", 'src/app/api/x/route.ts'), true)
assert.equal(importaClientAnon('import { isSupabaseConfigured } from "@/lib/supabase"', 'src/app/api/x/route.ts'), true)
assert.equal(importaClientAnon("const m = await import('@/lib/supabase')", 'src/app/api/x/route.ts'), true)
assert.equal(importaClientAnon("import { supabase } from '../../lib/supabase'", 'src/app/api/route.ts'), true)
assert.equal(importaClientAnon("import { supabase } from './supabase'", 'src/lib/x.ts'), true)
assert.equal(importaClientAnon("import { supabaseAdmin } from '@/lib/supabase-admin'", 'src/app/api/x/route.ts'), false)
assert.equal(importaClientAnon("import { isSupabaseConfigured } from '@/lib/supabase-config'", 'src/app/api/x/route.ts'), false)
assert.equal(importaClientAnon("import { x } from '@/lib/supabase-env'", 'src/lib/y.ts'), false)
assert.equal(importaClientAnon("// import { supabase } from '@/lib/supabase'", 'src/lib/y.ts'), false)

const encontrados = arquivosFonte(path.join(raiz, 'src'))
  .map((arquivo) => path.relative(raiz, arquivo).split(path.sep).join('/'))
  .filter((relativo) => relativo !== 'src/lib/supabase.ts')
  .filter((relativo) => importaClientAnon(fs.readFileSync(path.join(raiz, relativo), 'utf8'), relativo))

const naoPermitidos = encontrados.filter((relativo) => !(relativo in EXCECOES))
assert.deepEqual(naoPermitidos, [], `importam o client anon fora da lista de exceções: ${naoPermitidos.join(', ')}`)

const servidorComAnon = encontrados.filter((relativo) => ehServidor(relativo) && relativo !== 'src/lib/use-banco-ao-vivo.ts')
assert.deepEqual(servidorComAnon, [], `rota ou lib de servidor importa o client anon: ${servidorComAnon.join(', ')}`)

const apiComAnon = encontrados.filter((relativo) => relativo.startsWith('src/app/api/'))
assert.deepEqual(apiComAnon, [], `src/app/api importa o client anon: ${apiComAnon.join(', ')}`)

// Exceção que não importa mais o client anon é lixo na lista: aviso para limpar (não reprova).
const obsoletas = Object.keys(EXCECOES).filter((relativo) => !encontrados.includes(relativo))
if (obsoletas.length) console.warn(`anon-client-guard: exceções que já não importam o client anon (remova da lista): ${obsoletas.join(', ')}`)

console.log(`anon-client-guard: ok (${encontrados.length} exceções documentadas, 0 em servidor)`)
