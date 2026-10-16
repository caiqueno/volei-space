import type { SnapshotFila } from './tipos'

/** Texto curto e acessível do estado da conexão. Rota desligada (modo local) não vira alarme. */
export function textoDoIndicador(s: Pick<SnapshotFila, 'status' | 'pendentes' | 'enviando' | 'erro' | 'modoLocal'>): string {
  const plural = (n: number) => (n === 1 ? '1 evento' : `${n} eventos`)
  switch (s.status) {
    case 'sincronizando':
      return `Sincronizando ${plural(s.enviando || s.pendentes)}`
    case 'pendente':
      return s.modoLocal ? `Salvo neste aparelho (${plural(s.pendentes)})` : `${plural(s.pendentes)} pendente${s.pendentes === 1 ? '' : 's'}`
    case 'offline':
      return s.pendentes > 0 ? `Sem conexão: ${plural(s.pendentes)} guardado${s.pendentes === 1 ? '' : 's'}` : 'Sem conexão'
    case 'erro':
      return s.erro ?? 'Erro ao sincronizar'
    default:
      return 'Online'
  }
}
