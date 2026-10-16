import type { FuncaoComissao, Naipe, PapelAcesso, PosicaoCodigo } from '@/lib/meu-time-ui/tipos'

export const NAIPE_ROTULO: Record<Naipe, string> = {
  FEMININO: 'Feminino',
  MASCULINO: 'Masculino',
  MISTO: 'Misto',
}

export const POSICOES: ReadonlyArray<{ valor: PosicaoCodigo; rotulo: string }> = [
  { valor: 'LV', rotulo: 'Levantador' },
  { valor: 'PT', rotulo: 'Ponteiro' },
  { valor: 'OP', rotulo: 'Oposto' },
  { valor: 'CT', rotulo: 'Central' },
  { valor: 'LB', rotulo: 'Líbero' },
]

export const FUNCOES_COMISSAO: ReadonlyArray<{ valor: FuncaoComissao; rotulo: string }> = [
  { valor: 'TECNICO', rotulo: 'Técnico' },
  { valor: 'ASSISTENTE', rotulo: 'Assistente técnico' },
  { valor: 'PREPARADOR_FISICO', rotulo: 'Preparador físico' },
  { valor: 'FISIOTERAPEUTA', rotulo: 'Fisioterapeuta' },
  { valor: 'MEDICO', rotulo: 'Médico' },
]

export const PAPEIS_ACESSO: Record<PapelAcesso, string> = {
  RESPONSAVEL: 'Responsável',
  TECNICO: 'Técnico',
  ASSISTENTE: 'Assistente',
  CAPITAO: 'Capitão',
}

/** Nome legível da posição; se o código for desconhecido devolve o texto como veio. */
export function rotuloPosicao(codigo: string | null | undefined) {
  if (!codigo) return ''
  return POSICOES.find((p) => p.valor === codigo)?.rotulo ?? codigo
}

export function rotuloFuncao(codigo: string | null | undefined) {
  if (!codigo) return ''
  return FUNCOES_COMISSAO.find((f) => f.valor === codigo)?.rotulo ?? codigo
}

/** Data AAAA-MM-DD para DD/MM/AAAA, sem passar por fuso horário. */
export function formatarData(data: string | null | undefined) {
  const m = typeof data === 'string' ? data.match(/^(\d{4})-(\d{2})-(\d{2})/) : null
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}
