export function loginDestination(tipo: string, trocarSenha: boolean) {
  if (trocarSenha && (tipo === 'organizador' || tipo === 'arbitro')) return '/trocar-senha'
  if (tipo === 'organizador' || tipo === 'arbitro' || tipo === 'quadra') return '/painel'
  if (tipo === 'equipe') return '/capitao'
  return '/portal'
}
