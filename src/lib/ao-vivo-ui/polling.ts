/** Regras PURAS do polling das telas ao vivo (sem React, sem rede). */

export const INTERVALO_AO_VIVO_MS = 3000
export const INTERVALO_MAXIMO_MS = 30_000

/** Intervalo até a próxima consulta: base quando tudo vai bem; recuo exponencial (teto `maxMs`) após falhas seguidas. */
export function intervaloComRecuo(falhasSeguidas: number, baseMs = INTERVALO_AO_VIVO_MS, maxMs = INTERVALO_MAXIMO_MS): number {
  if (!(falhasSeguidas > 0)) return baseMs
  return Math.min(maxMs, baseMs * 2 ** Math.min(falhasSeguidas, 10))
}

/** Só consulta com a aba visível; offline conhecido também pausa (volta pelo evento `online`). */
export function devePausar(estado: { visivel: boolean; online: boolean }): boolean {
  return !estado.visivel || !estado.online
}

/** "14:05" no fuso do aparelho. */
export function horaCurta(ms: number): string {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function rotuloAtualizado(ms: number | null): string {
  return ms == null ? 'Aguardando a primeira atualização' : `Atualizado às ${horaCurta(ms)}`
}

/** Id de partida da URL: só inteiro positivo (evita montar URL de API com lixo). */
export function partidaIdValido(valor: string | undefined | null): number | null {
  if (!valor || !/^\d{1,12}$/.test(valor)) return null
  const n = Number(valor)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

/** Só o valor exato '1' liga o placar ao vivo público. */
export function aoVivoAtivo(valor: string | undefined | null): boolean {
  return valor === '1'
}
