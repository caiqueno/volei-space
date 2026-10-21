// Pagamento por comprovante (R19): flag, detecção de recurso ausente e leitura segura do banco.
// Flag própria: PAGAMENTO_COMPROVANTE_ATIVO=1. Desligada, as rotas NOVAS respondem 404 como se não existissem e o
// painel, o explorar e o upload se comportam exatamente como antes.
// Coluna, tabela ou bucket das migrations pendentes ausente = 503 "Recurso ainda não habilitado neste ambiente.", nunca 500.
import { colunaAusente } from '@/lib/coluna-ausente'
import { ErroMeuTime, tabelaAusente } from '@/lib/meu-time/acesso'

export const MENSAGEM_PAGAMENTO_NAO_HABILITADO = 'Recurso ainda não habilitado neste ambiente.'

export function pagamentoComprovanteAtivo(env: Record<string, string | undefined> = process.env) {
  return env.PAGAMENTO_COMPROVANTE_ATIVO === '1'
}

type ErroBanco = { code?: string | null; message?: string | null; details?: string | null } | null | undefined

/** Colunas e tabela criadas pelas migrations 0054 e 0055. Se alguma faltar no banco real, o erro vira 503. */
export const COLUNAS_PAGAMENTO = [
  'pagamentoModo',
  'valorInscricaoCentavos',
  'pixChave',
  'pixBeneficiario',
  'pagamentoInstrucoes',
  'PagamentoInscricao',
  'comprovantePath',
  'comprovanteEnviadoEm',
] as const

export function recursoPagamentoAusente(erro: ErroBanco) {
  if (!erro) return false
  if (tabelaAusente(erro)) return true
  return erro.code === '42703' || erro.code === 'PGRST204' || colunaAusente(erro, COLUNAS_PAGAMENTO)
}

export function indisponivelPagamento() {
  return new ErroMeuTime(MENSAGEM_PAGAMENTO_NAO_HABILITADO, 503, 'RECURSO_NAO_HABILITADO')
}

/** Devolve os dados ou interrompe a rota: 503 se o recurso não existe neste banco, 500 genérico nos demais erros. */
export function lerPagamentoDb<T>(resultado: { data: T | null; error: ErroBanco }, onde: string): T | null {
  if (!resultado.error) return resultado.data
  if (recursoPagamentoAusente(resultado.error)) throw indisponivelPagamento()
  // Só o código: nada de mensagem do banco, que pode carregar valores da linha.
  console.error(`[pagamento-comprovante] ${onde}`, resultado.error.code ?? '')
  throw new ErroMeuTime('Não foi possível concluir a operação. Tente novamente.', 500)
}

export const BUCKET_COMPROVANTE = 'comprovante-pagamento'
