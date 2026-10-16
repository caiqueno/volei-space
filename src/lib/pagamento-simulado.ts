import { colunaAusente } from '@/lib/coluna-ausente'

export const PAGAMENTO_ORIGEM_SIMULADO = 'simulado'

type ClienteLiga = {
  from(tabela: string): any
}

/**
 * Grava a confirmação de pagamento SIMULADA do campeonato (não há gateway) e
 * marca `Liga.pagamentoOrigem = 'simulado'`. Enquanto a coluna não existir no
 * banco, repete a gravação sem ela para não travar a liberação do campeonato.
 */
export async function gravarPagamentoSimulado(cliente: ClienteLiga, ligaId: number, pagamentoConfirmadoEm: string) {
  const gravar = (campos: Record<string, unknown>) => cliente.from('Liga').update(campos).eq('id', ligaId)
  const completo = await gravar({ pagamentoConfirmadoEm, pagamentoOrigem: PAGAMENTO_ORIGEM_SIMULADO })
  if (completo.error && colunaAusente(completo.error, ['pagamentoOrigem'])) {
    console.warn('[pagamento/confirmar] coluna Liga.pagamentoOrigem ausente; gravando sem a origem')
    return gravar({ pagamentoConfirmadoEm })
  }
  return completo as { error: { message?: string } | null }
}
