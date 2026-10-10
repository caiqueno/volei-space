export function rpcAusente(erro: { code?: string; message?: string; details?: string } | null | undefined) {
  const texto = `${erro?.code ?? ''} ${erro?.message ?? ''} ${erro?.details ?? ''}`
  return /PGRST202|42883|does not exist|Could not find the function/i.test(texto)
}
