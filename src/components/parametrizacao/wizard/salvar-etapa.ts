import { proximaSecao, type SetupCardKey } from '@/lib/championship-setup-status'

export async function salvarEAvancarEtapa(options: {
  persist: () => Promise<{ ok: boolean; message: string | null }>
  goTo: (index: number) => void
  proximoIndice: number
  setCompletionIssues: (messages: string[]) => void
}) {
  const salvo = await options.persist()
  if (!salvo.ok) {
    options.setCompletionIssues([salvo.message || 'Não foi possível salvar. Os dados desta etapa continuam na tela.'])
    return false
  }
  options.goTo(options.proximoIndice)
  return true
}

export function abrirProximaSecao(options: {
  atual: SetupCardKey
  formato?: string | null
  ligaId: number
  noPainel: boolean
  abrir: ((section: string) => void) | null
  router: { push: (href: string) => void }
  categoriaId?: string | null
}) {
  const proxima = proximaSecao(options.atual, options.formato)
  if (!proxima) {
    if (!options.noPainel) options.router.push(`/painel/parametrizacao?ligaId=${options.ligaId}`)
    return
  }
  if (options.abrir) {
    options.abrir(proxima)
    return
  }
  const categoria = options.categoriaId && proxima !== 'informacoes'
    ? `&categoriaCampeonatoId=${encodeURIComponent(options.categoriaId)}`
    : ''
  options.router.push(`/painel/parametrizacao/${proxima}?ligaId=${options.ligaId}${categoria}`)
}
