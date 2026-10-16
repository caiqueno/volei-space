// Convite na inscrição do Meu Time (M7). Função pura, sem banco.
//
// Regra:
//  - O convite é EXIGIDO quando a competição é privada (`privada`), quando a categoria tem link de
//    inscrição (CategoriaCampeonato.tokenInscricao) ou quando o campeonato tem
//    LinkInscricaoCampeonato ativo, não revogado e não expirado.
//  - Nesses casos vale o token da categoria ou o token do link do campeonato. Sem convite: 403
//    CONVITE_OBRIGATORIO; convite que não confere: 403 CONVITE_INVALIDO.
//  - Nos demais casos (sem link nenhum e competição não privada) o campo `convite` é opcional e
//    ignorado: a categoria é aberta.
// Hoje o schema não tem coluna de "campeonato privado"; `privada` fica pronto para quando existir.
import { timingSafeEqual } from 'node:crypto'

export type LinkCampeonato = {
  token: string
  ativo: boolean | null
  revogadoEm?: string | null
  expiraEm?: string | null
}

export type EstadoConvite = {
  tokenCategoria: string | null
  linkCampeonato: LinkCampeonato | null
  privada?: boolean
}

export type DecisaoConvite =
  | { ok: true; exigido: boolean }
  | { ok: false; status: 403; codigo: 'CONVITE_OBRIGATORIO' | 'CONVITE_INVALIDO'; mensagem: string }

function iguais(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export function linkVigente(link: LinkCampeonato | null, agora = Date.now()): link is LinkCampeonato {
  if (!link || !link.token || !link.ativo || link.revogadoEm) return false
  if (link.expiraEm) {
    const expira = new Date(link.expiraEm).getTime()
    if (!Number.isNaN(expira) && expira <= agora) return false
  }
  return true
}

export function avaliarConvite(convite: string | undefined | null, estado: EstadoConvite, agora = Date.now()): DecisaoConvite {
  const aceitos: string[] = []
  if (estado.tokenCategoria) aceitos.push(estado.tokenCategoria)
  if (linkVigente(estado.linkCampeonato, agora)) aceitos.push(estado.linkCampeonato.token)
  const exigido = Boolean(estado.privada) || aceitos.length > 0
  if (!exigido) return { ok: true, exigido: false }

  const informado = (convite ?? '').trim()
  if (!informado) {
    return { ok: false, status: 403, codigo: 'CONVITE_OBRIGATORIO', mensagem: 'Esta categoria exige o link de inscrição enviado pelo organizador.' }
  }
  if (!aceitos.some((token) => iguais(token, informado))) {
    return { ok: false, status: 403, codigo: 'CONVITE_INVALIDO', mensagem: 'O link de inscrição não confere com esta categoria.' }
  }
  return { ok: true, exigido: true }
}
