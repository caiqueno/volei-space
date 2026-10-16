// Banco falso em memória com escrita, para testar as rotas do Meu Time.
// Complementa fake-supabase.ts (que só lê/atualiza): aqui há insert, in, neq, unicidade e ids gerados.
// Tabela que não existe no objeto responde com o erro 42P01, como o banco real sem as migrations.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from 'node:crypto'

export type LinhaEscrita = Record<string, any>

export type OpcoesEscrita = {
  /** Conjuntos de colunas que não podem repetir entre linhas da tabela (erro 23505). */
  unicos?: Record<string, string[][]>
  /** Valores padrão de coluna por tabela (o `default` do SQL), aplicados em todo insert. */
  padroes?: Record<string, LinhaEscrita>
  /** Colunas que o banco "não conhece": qualquer escrita ou leitura delas dá 42703. */
  colunasAusentes?: Record<string, string[]>
}

export function criarBancoEscrita(tabelas: Record<string, LinhaEscrita[]>, opcoes: OpcoesEscrita = {}) {
  const from = (nome: string) => {
    const filtros: Array<(linha: LinhaEscrita) => boolean> = []
    let operacao: 'select' | 'insert' | 'update' | 'delete' = 'select'
    let valores: any = null
    let ordem: { coluna: string; asc: boolean } | null = null
    let limite: number | null = null

    const executar = (): { data: any; error: any } => {
      const tabela = tabelas[nome]
      if (!tabela) return { data: null, error: { code: '42P01', message: `relation "public.${nome}" does not exist` } }
      const ausentes = opcoes.colunasAusentes?.[nome] ?? []
      const citadas: string[] = operacao === 'insert'
        ? (Array.isArray(valores) ? valores : [valores]).flatMap((v: any) => Object.keys(v))
        : operacao === 'update' ? Object.keys(valores ?? {}) : []
      const ausente = ausentes.find((coluna) => citadas.includes(coluna))
      if (ausente) return { data: null, error: { code: '42703', message: `column "${ausente}" of relation "${nome}" does not exist` } }

      if (operacao === 'insert') {
        const novas = (Array.isArray(valores) ? valores : [valores]).map((v: any) => ({ id: randomUUID(), ...(opcoes.padroes?.[nome] ?? {}), ...v }))
        for (const regra of opcoes.unicos?.[nome] ?? []) {
          const vistas = new Set(tabela.map((l) => regra.map((c) => String(l[c])).join('|')))
          for (const nova of novas) {
            const chave = regra.map((c) => String(nova[c])).join('|')
            if (vistas.has(chave)) return { data: null, error: { code: '23505', message: `duplicate key value violates unique constraint on ${nome}` } }
            vistas.add(chave)
          }
        }
        tabela.push(...novas)
        return { data: novas.map((l: any) => ({ ...l })), error: null }
      }
      const alvo = tabela.filter((l) => filtros.every((f) => f(l)))
      if (operacao === 'delete') {
        tabelas[nome] = tabela.filter((l) => !alvo.includes(l))
        return { data: alvo.map((l) => ({ ...l })), error: null }
      }
      if (operacao === 'update') {
        alvo.forEach((l) => Object.assign(l, valores))
        return { data: alvo.map((l) => ({ ...l })), error: null }
      }
      let saida = alvo.map((l) => ({ ...l }))
      if (ordem) {
        const { coluna, asc } = ordem
        saida = saida.sort((a, b) => (String(a[coluna] ?? '') < String(b[coluna] ?? '') ? -1 : 1) * (asc ? 1 : -1))
      }
      if (limite != null) saida = saida.slice(0, limite)
      return { data: saida, error: null }
    }

    const unica = () => {
      const r = executar()
      if (r.error) return r
      const lista = r.data as LinhaEscrita[]
      return { data: lista[0] ?? null, error: null }
    }

    const b: any = {
      select() { return b },
      insert(v: any) { operacao = 'insert'; valores = v; return b },
      update(v: any) { operacao = 'update'; valores = v; return b },
      delete() { operacao = 'delete'; return b },
      eq(c: string, v: unknown) { filtros.push((l) => l[c] === v); return b },
      neq(c: string, v: unknown) { filtros.push((l) => l[c] !== v); return b },
      in(c: string, v: unknown[]) { filtros.push((l) => v.includes(l[c])); return b },
      is(c: string, v: unknown) { filtros.push((l) => (v === null ? l[c] == null : l[c] === v)); return b },
      ilike(c: string, v: string) { filtros.push((l) => String(l[c] ?? '').toLowerCase() === v.replace(/\\/g, '').toLowerCase()); return b },
      order(coluna: string, o?: { ascending?: boolean }) { ordem = { coluna, asc: o?.ascending !== false }; return b },
      limit(n: number) { limite = n; return b },
      maybeSingle() { return Promise.resolve(unica()) },
      single() { return Promise.resolve(unica()) },
      then(res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) { return Promise.resolve(executar()).then(res, rej) },
    }
    return b
  }
  return { from }
}
