import type { Naipe } from '@/lib/meu-time-ui/tipos'

export const NAIPE_ROTULO: Record<Naipe, string> = {
  FEMININO: 'Feminino',
  MASCULINO: 'Masculino',
  MISTO: 'Misto',
}

export const POSICOES = ['Levantador', 'Ponteiro', 'Oposto', 'Central', 'Líbero'] as const

export const FUNCOES_COMISSAO = ['Técnico', 'Auxiliar técnico', 'Preparador físico', 'Fisioterapeuta', 'Massagista', 'Outro'] as const

/** Data AAAA-MM-DD para DD/MM/AAAA, sem passar por fuso horário. */
export function formatarData(data: string | null | undefined) {
  const m = typeof data === 'string' ? data.match(/^(\d{4})-(\d{2})-(\d{2})/) : null
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}
