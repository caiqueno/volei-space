// Flag da interface da fase 2 do Meu Time. Desligada = nada novo aparece.
export function faseDoisAtiva(valor: string | undefined = process.env.NEXT_PUBLIC_MEU_TIME_FASE2_ATIVO): boolean {
  return valor === '1'
}
