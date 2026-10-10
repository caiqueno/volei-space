import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { mensagemAtletaDuplicado, type AtletaComparavel } from '@/lib/atleta-duplicado'

type Entrada = AtletaComparavel & {
  ligaId?: number | null
  categoriaCampeonatoId?: string | null
}

/**
 * Lê atletas já gravados na categoria. Se a consulta falhar, a inscrição segue:
 * a regra não pode derrubar o campeonato por coluna ou leitura indisponível.
 */
export async function mensagemDuplicataNaCategoria(entrada: Entrada) {
  try {
    const contexto = await contextoDaEquipe(entrada)
    if (!contexto.ligaId || !contexto.categoriaCampeonatoId) return null
    const outros = await listarOutrasEquipes(contexto.ligaId, contexto.categoriaCampeonatoId, entrada)
    return mensagemAtletaDuplicado(entrada, outros)
  } catch (erro) {
    console.error('[atleta-duplicado] consulta indisponível; a inscrição segue', erro)
    return null
  }
}

async function contextoDaEquipe(entrada: Entrada) {
  if (entrada.ligaId && entrada.categoriaCampeonatoId) {
    return { ligaId: entrada.ligaId, categoriaCampeonatoId: entrada.categoriaCampeonatoId }
  }
  if (entrada.equipeId == null) return { ligaId: entrada.ligaId ?? null, categoriaCampeonatoId: entrada.categoriaCampeonatoId ?? null }
  const { data, error } = await supabase.from('Equipe').select('ligaId,categoriaCampeonatoId').eq('id', entrada.equipeId).maybeSingle()
  if (error || !data) return { ligaId: null, categoriaCampeonatoId: null }
  return { ligaId: Number(data.ligaId), categoriaCampeonatoId: data.categoriaCampeonatoId as string }
}

async function listarOutrasEquipes(ligaId: number, categoriaCampeonatoId: string, entrada: Entrada) {
  const outros: AtletaComparavel[] = []
  const { data: equipes, error: equipesErro } = await supabase
    .from('Equipe')
    .select('id,nome')
    .eq('ligaId', ligaId)
    .eq('categoriaCampeonatoId', categoriaCampeonatoId)
  if (equipesErro) throw new Error(equipesErro.message)
  const nomes = new Map((equipes ?? []).map((equipe) => [Number(equipe.id), String(equipe.nome ?? '')]))
  const ids = Array.from(nomes.keys()).filter((id) => entrada.equipeId == null || id !== Number(entrada.equipeId))
  if (ids.length > 0) {
    const { data, error } = await supabase
      .from('Jogador')
      .select('id,nome,dataNascimento,documentoNumero,equipeId')
      .in('equipeId', ids)
      .eq('banido', false)
    if (error) throw new Error(error.message)
    for (const atleta of data ?? []) {
      outros.push({
        id: atleta.id,
        equipeId: atleta.equipeId,
        nomeEquipe: nomes.get(Number(atleta.equipeId)) ?? null,
        nome: atleta.nome,
        dataNascimento: atleta.dataNascimento,
        documentoNumero: atleta.documentoNumero,
      })
    }
  }

  const { data: rascunhos, error: rascunhosErro } = await supabase
    .from('InscricaoEquipeRascunho')
    .select('id,nomeEquipe,equipeId')
    .eq('ligaId', ligaId)
    .eq('categoriaCampeonatoId', categoriaCampeonatoId)
    .is('equipeId', null)
  if (rascunhosErro) throw new Error(rascunhosErro.message)
  const abertos = (rascunhos ?? []).filter((rascunho) => rascunho.id !== entrada.rascunhoId)
  if (abertos.length === 0) return outros
  const porRascunho = new Map(abertos.map((rascunho) => [String(rascunho.id), String(rascunho.nomeEquipe ?? '')]))
  const { data: atletas, error: atletasErro } = await supabase
    .from('InscricaoEquipeJogadorRascunho')
    .select('id,nome,dataNascimento,documentoNumero,inscricaoRascunhoId')
    .in('inscricaoRascunhoId', Array.from(porRascunho.keys()))
  if (atletasErro) throw new Error(atletasErro.message)
  for (const atleta of atletas ?? []) {
    outros.push({
      id: atleta.id,
      rascunhoId: atleta.inscricaoRascunhoId,
      nomeEquipe: porRascunho.get(String(atleta.inscricaoRascunhoId)) ?? null,
      nome: atleta.nome,
      dataNascimento: atleta.dataNascimento,
      documentoNumero: atleta.documentoNumero,
    })
  }
  return outros
}
