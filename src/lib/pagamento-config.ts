// Liga ou desliga a cobrança da ativação do campeonato.
// Ausente, vazia ou com valor desconhecido, a variável mantém o comportamento
// de hoje: o checkout simulado continua, a estrutura não responde 402 e
// `pagamentoConfirmadoEm` não é gravado. Só `false` (e os sinônimos abaixo)
// desliga a cobrança. Só `true` (e os sinônimos) passa a exigir confirmação
// antes dos grupos. No navegador `process.env.PAGAMENTO_HABILITADO` não existe;
// a interface lê o booleano que a API devolve.

const VALORES_LIGADOS = new Set(['1', 'true', 'sim', 'yes', 'on'])
const VALORES_DESLIGADOS = new Set(['0', 'false', 'nao', 'não', 'off', 'no'])

function valorDaFlag(env: NodeJS.ProcessEnv): string {
  return env.PAGAMENTO_HABILITADO?.trim().toLowerCase() ?? ''
}

/** Checkout simulado permanece, salvo quando a cobrança foi desligada de propósito. */
export function pagamentoHabilitado(env: NodeJS.ProcessEnv = process.env): boolean {
  return !VALORES_DESLIGADOS.has(valorDaFlag(env))
}

/** 402 na estrutura só com a cobrança ligada de propósito e sem confirmação. */
export function estruturaExigePagamentoConfirmado(
  pagamentoConfirmadoEm: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return VALORES_LIGADOS.has(valorDaFlag(env)) && !pagamentoConfirmadoEm
}
