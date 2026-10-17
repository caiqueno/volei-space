/** Flag da tela de scout. Módulo PURO. Só liga com NEXT_PUBLIC_SCOUT_ATIVO exatamente '1'. */
export function scoutAtivo(valor: string | undefined | null): boolean {
  return valor === '1'
}
