// Banco falso em memória para testes de rota. Implementa só o que as rotas
// usam: select/eq/ilike/is/limit/order, update/delete/upsert e maybeSingle.
/* eslint-disable @typescript-eslint/no-explicit-any */
export type Linha = Record<string, unknown>

export type OpcoesBanco = {
  /** Colunas que o "banco" diz não existir quando aparecem num select. */
  colunasAusentes?: Record<string, string[]>
}

export function criarBanco(tabelas: Record<string, Linha[]>, opcoes: OpcoesBanco = {}) {
  const from = (nome: string) => {
    const filtros: Array<(l: Linha) => boolean> = []
    let operacao: 'select' | 'update' | 'delete' | 'upsert' = 'select'
    let valores: Linha = {}
    let retornaLinhas = false
    let colunasPedidas = ''
    const executar = () => {
      const tabela = tabelas[nome]
      if (!tabela) return { data: null, error: { code: '42P01', message: `relation "${nome}" does not exist` } }
      const citadas = operacao === 'select' ? colunasPedidas.split(',') : Object.keys(valores)
      const ausente = (opcoes.colunasAusentes?.[nome] ?? []).find((c) => citadas.includes(c))
      if (ausente) return { data: null, error: { code: '42703', message: `column ${nome}.${ausente} does not exist` } }
      const alvo = tabela.filter((l) => filtros.every((f) => f(l)))
      if (operacao === 'select') return { data: alvo, error: null }
      if (operacao === 'delete') {
        tabelas[nome] = tabela.filter((l) => !alvo.includes(l))
        return { data: null, error: null }
      }
      if (operacao === 'update') {
        alvo.forEach((l) => Object.assign(l, valores))
        return { data: retornaLinhas ? alvo : null, error: null }
      }
      const existente = tabela.find((l) => l.chave === valores.chave)
      if (existente) Object.assign(existente, valores)
      else tabela.push({ ...valores })
      return { data: null, error: null }
    }
    const b: any = {
      select(colunas?: string) {
        if (operacao === 'update') retornaLinhas = true
        else colunasPedidas = colunas ?? ''
        return b
      },
      ilike(coluna: string, valor: string) {
        filtros.push((l) => String(l[coluna] ?? '').toLowerCase() === valor.toLowerCase())
        return b
      },
      eq(coluna: string, valor: unknown) {
        filtros.push((l) => l[coluna] === valor)
        return b
      },
      is(coluna: string, valor: unknown) {
        filtros.push((l) => (valor === null ? l[coluna] == null : l[coluna] === valor))
        return b
      },
      limit() { return b },
      order() { return b },
      update(v: Linha) { operacao = 'update'; valores = v; return b },
      delete() { operacao = 'delete'; return b },
      upsert(v: Linha) { operacao = 'upsert'; valores = v; return b },
      maybeSingle() {
        const r = executar()
        return Promise.resolve(r.error ? r : { data: (r.data as Linha[])[0] ?? null, error: null })
      },
      single() {
        const r = executar()
        return Promise.resolve(r.error ? r : { data: (r.data as Linha[])[0] ?? null, error: null })
      },
      then(res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) {
        return Promise.resolve(executar()).then(res, rej)
      },
    }
    return b
  }
  return { from }
}

export type BancoFalso = ReturnType<typeof criarBanco>

/**
 * Troca o módulo `supabase-admin` por um cliente falso. Precisa rodar antes de
 * importar a rota. Devolve o ponteiro para trocar o banco entre os cenários.
 */
export function instalarSupabaseFalso(resolvido: string) {
  const banco: { atual: BancoFalso } = { atual: criarBanco({}) }
  const cliente = { from: (nome: string) => banco.atual.from(nome) }
  require.cache[resolvido] = {
    id: resolvido,
    filename: resolvido,
    loaded: true,
    exports: { supabaseAdmin: cliente, isSupabaseServiceConfigured: true },
  } as unknown as NodeJS.Module
  return banco
}
