/** Destino depois da configuração. O cupom só entra quando o checkout está ligado. */
export function hrefDepoisDaConfiguracao(ligaId: number, habilitado: boolean, cupom = ''): string {
  if (!habilitado) return `/painel/estrutura?ligaId=${ligaId}`
  return `/painel/parametrizacao/pagamento?ligaId=${ligaId}&cupom=${encodeURIComponent(cupom)}`
}
