/** Intervalo e estado de conexão do polling de 3 s com recuo em falha. Módulo PURO. */

export const INTERVALO_BASE_MS = 3000
export const INTERVALO_MAX_MS = 30000
/** Falhas seguidas para avisar "sem conexão" (uma falha isolada não alarma). */
export const FALHAS_PARA_SEM_CONEXAO = 2

/** 3 s sem falhas; dobra a cada falha seguida até o teto de 30 s. */
export function intervaloPolling(falhasSeguidas: number, base = INTERVALO_BASE_MS, teto = INTERVALO_MAX_MS): number {
  const n = Math.max(0, Math.floor(falhasSeguidas))
  return Math.min(teto, base * 2 ** Math.min(n, 10))
}

export function semConexao(falhasSeguidas: number): boolean {
  return falhasSeguidas >= FALHAS_PARA_SEM_CONEXAO
}

export function formatarHora(d: Date): string {
  const dois = (n: number) => String(n).padStart(2, '0')
  return `${dois(d.getHours())}:${dois(d.getMinutes())}`
}

export function textoAtualizado(ultima: Date | null): string {
  return ultima ? `atualizado às ${formatarHora(ultima)}` : 'atualizando...'
}
