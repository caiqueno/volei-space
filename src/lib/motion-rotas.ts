// Rotas que este PR não anima: súmula, páginas públicas, pódio
// (classificação), painel e telas de autenticação.
const PREFIXOS_SEM_MOTION = [
  '/sumula',
  '/arbitro',
  '/painel',
  '/portal',
  '/jogos',
  '/classificacao',
  '/rankings',
  '/galeria',
  '/campeonatos',
  '/ao-vivo',
  '/partidas',
  '/equipes',
  '/fase-mata-mata',
  '/login',
  '/cadastro',
  '/resetar-senha',
  '/trocar-senha',
  '/ativar-conta',
  '/admin/login',
]

export function rotaSemMicroInteracao(pathname: string) {
  if (pathname === '/') return true
  return PREFIXOS_SEM_MOTION.some((prefixo) => pathname === prefixo || pathname.startsWith(`${prefixo}/`))
}
