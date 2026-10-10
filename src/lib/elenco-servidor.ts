import { supabaseAdmin } from '@/lib/supabase-admin'
import type { LinhaElenco } from '@/lib/grupos-fase'

type JogadorElenco = { id: number; nome: string; numero?: number | null; banido?: boolean | null }
type EquipeElenco = { id: number; nome: string; categoriaCampeonatoId?: string | null; jogadores?: JogadorElenco[] | null }

export async function listarElenco(ligaId: number, categoriaId?: string | null): Promise<LinhaElenco[]> {
  let gruposQuery = supabaseAdmin
    .from('GrupoCampeonato')
    .select('id,nome,ordem')
    .eq('ligaId', ligaId)
    .order('ordem', { ascending: true })
  let vinculosQuery = supabaseAdmin
    .from('GrupoEquipeCampeonato')
    .select('grupoId,equipeId')
    .eq('ligaId', ligaId)
  let inscricoesQuery = supabaseAdmin
    .from('InscricaoCampeonato')
    .select('equipe:Equipe(id,nome,categoriaCampeonatoId,jogadores:Jogador(id,nome,numero,banido))')
    .eq('ligaId', ligaId)
    .eq('status', 'APROVADA')
  if (categoriaId) {
    gruposQuery = gruposQuery.eq('categoriaCampeonatoId', categoriaId)
    vinculosQuery = vinculosQuery.eq('categoriaCampeonatoId', categoriaId)
  }

  const [gruposResposta, vinculosResposta, inscricoesResposta] = await Promise.all([gruposQuery, vinculosQuery, inscricoesQuery])
  if (gruposResposta.error) throw gruposResposta.error
  if (vinculosResposta.error) throw vinculosResposta.error
  if (inscricoesResposta.error) throw inscricoesResposta.error

  const nomeDoGrupo = new Map((gruposResposta.data ?? []).map((grupo) => [Number(grupo.id), String(grupo.nome)]))
  const grupoDaEquipe = new Map<number, string>()
  for (const vinculo of vinculosResposta.data ?? []) {
    const nome = nomeDoGrupo.get(Number(vinculo.grupoId))
    if (nome) grupoDaEquipe.set(Number(vinculo.equipeId), nome)
  }

  const linhas: LinhaElenco[] = []
  for (const inscricao of inscricoesResposta.data ?? []) {
    const equipe = (Array.isArray(inscricao.equipe) ? inscricao.equipe[0] : inscricao.equipe) as EquipeElenco | null
    if (!equipe) continue
    if (categoriaId && equipe.categoriaCampeonatoId !== categoriaId) continue
    const jogadores = (equipe.jogadores ?? [])
      .filter((jogador) => !jogador.banido)
      .sort((a, b) => {
        const numeroA = Number.isInteger(a.numero) ? Number(a.numero) : Number.MAX_SAFE_INTEGER
        const numeroB = Number.isInteger(b.numero) ? Number(b.numero) : Number.MAX_SAFE_INTEGER
        return numeroA - numeroB || a.nome.localeCompare(b.nome, 'pt-BR')
      })
    for (const jogador of jogadores) {
      linhas.push({
        equipeId: equipe.id,
        equipe: equipe.nome,
        grupo: grupoDaEquipe.get(equipe.id) ?? null,
        jogadorId: jogador.id,
        jogador: jogador.nome,
        numero: Number.isInteger(jogador.numero) ? Number(jogador.numero) : null,
      })
    }
  }
  return linhas.sort((a, b) => (
    (a.grupo ?? '').localeCompare(b.grupo ?? '', 'pt-BR')
    || a.equipe.localeCompare(b.equipe, 'pt-BR')
    || a.jogador.localeCompare(b.jogador, 'pt-BR')
  ))
}
