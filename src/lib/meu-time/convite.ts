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
// `privada` vem de Liga.visibilidade = 'PRIVADA' (migration pendente 202610170030). Sem a coluna,
// a visibilidade chega indefinida e o comportamento é o de sempre. Competição privada sem nenhum
// token emitido não aceita inscrição (CONVITE_INVALIDO) até o organizador gerar o link.
import { timingSafeEqual } from 'node:crypto'

/** Para o organizador (painel de links): o que fazer quando a privada ainda não tem link. */
export const MENSAGEM_PRIVADA_SEM_LINK = 'Competição privada: gere o link de inscrição desta categoria. Sem ele ninguém consegue inscrever equipes.'
/** Para quem tenta se inscrever numa privada que ainda não emitiu link. */
export const MENSAGEM_PRIVADA_SEM_LINK_PUBLICA = 'Esta competição é privada e o organizador ainda não emitiu o link de inscrição desta categoria. Peça o link ao organizador.'

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
  /** Liga.visibilidade crua; 'PRIVADA' equivale a privada. Ausente/nula = pública. */
  visibilidade?: string | null
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
  const privada = Boolean(estado.privada) || String(estado.visibilidade ?? '').trim().toUpperCase() === 'PRIVADA'
  const exigido = privada || aceitos.length > 0
  if (!exigido) return { ok: true, exigido: false }
  // Privada sem nenhum link emitido: os códigos de sempre, mas a mensagem diz o que está faltando.
  const semLinkEmitido = privada && aceitos.length === 0

  const informado = (convite ?? '').trim()
  if (!informado) {
    return { ok: false, status: 403, codigo: 'CONVITE_OBRIGATORIO', mensagem: semLinkEmitido ? MENSAGEM_PRIVADA_SEM_LINK_PUBLICA : 'Esta categoria exige o link de inscrição enviado pelo organizador.' }
  }
  if (!aceitos.some((token) => iguais(token, informado))) {
    return { ok: false, status: 403, codigo: 'CONVITE_INVALIDO', mensagem: semLinkEmitido ? MENSAGEM_PRIVADA_SEM_LINK_PUBLICA : 'O link de inscrição não confere com esta categoria.' }
  }
  return { ok: true, exigido: true }
}
