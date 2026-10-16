import { colunaAusente } from '@/lib/coluna-ausente'
import { supabaseAdmin } from '@/lib/supabase-admin'

type ErroColuna = { message?: string | null; code?: string | null; details?: string | null } | null | undefined
type Resposta = { data: any; error: ErroColuna }

let colunasAtivas: boolean | null = null
let conferidoEm = 0
const REVER_AUSENCIA_MS = 60_000

export function erroColunaDeVagaAusente(erro: ErroColuna) {
  if (!erro) return false
  return colunaAusente(erro, ['origemVagaA', 'origemVagaB'])
}

/** A vaga a definir só liga quando a migration já criou as colunas. Sem elas, a leitura segue como hoje. */
export async function colunasDeVagaAtivas() {
  if (colunasAtivas === true) return true
  if (colunasAtivas === false && Date.now() - conferidoEm < REVER_AUSENCIA_MS) return false
  const { error } = await supabaseAdmin.from('Partida').select('origemVagaA').limit(1)
  conferidoEm = Date.now()
  if (!error) {
    colunasAtivas = true
    return true
  }
  colunasAtivas = false
  return false
}

export async function consultarComVaga(
  base: string,
  executar: (colunas: string) => PromiseLike<Resposta>,
): Promise<Resposta> {
  if (!(await colunasDeVagaAtivas())) return executar(base)
  const com = await executar(`${base},origemVagaA,origemVagaB`)
  if (!erroColunaDeVagaAusente(com.error)) return com
  colunasAtivas = false
  conferidoEm = Date.now()
  return executar(base)
}
