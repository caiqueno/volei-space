// Ponte TimeClube (uuid, Meu Time) -> "Equipe" legada (inteiro, a que as partidas usam).
// "Inscricao"."equipeLegadoId" liga as duas pontas: o banco por sessão e GET /api/meu-time/jogos dependem dele.
//
// garantirEquipeLegada(inscricaoId) é idempotente: reaproveita a Equipe (mesmo nome + campeonato + categoria) ou cria,
// grava o vínculo e copia o elenco para "Jogador" (a papeleta do banco lê "Jogador"). Nunca lança: qualquer falha
// (coluna/tabela ausente, conflito) devolve null e a inscrição segue; o reparo preguiçoso tenta de novo ao listar jogos.
import { supabaseAdmin } from '@/lib/supabase-admin'
import { colunaAusente } from '@/lib/coluna-ausente'
import { inscricaoViva } from '@/lib/meu-time/regras'

const db = supabaseAdmin as any

/** Quantas inscrições sem vínculo o reparo corrige por chamada. */
export const LIMITE_REPARO = 10

function registrar(onde: string, erro: { code?: string | null; message?: string | null } | null | undefined) {
  console.error(`[equipe-legada] ${onde}`, erro?.code ?? '', erro?.message ?? '')
}

async function copiarElenco(inscricaoId: string, equipeId: number) {
  const r = await db
    .from('InscricaoAtleta')
    .select('id,nomeSnapshot,numero,posicao,dataNascimentoSnapshot,jogadorLegadoId')
    .eq('inscricaoId', inscricaoId)
    .eq('ativo', true)
  if (r.error) return registrar('ler elenco da inscrição', r.error)
  for (const atleta of (r.data ?? []) as any[]) {
    if (atleta.jogadorLegadoId != null) continue
    const criado = await db
      .from('Jogador')
      .insert({
        equipeId,
        nome: atleta.nomeSnapshot,
        numero: atleta.numero ?? null,
        posicao: atleta.posicao ?? null,
        dataNascimento: atleta.dataNascimentoSnapshot ?? null,
      })
      .select('id')
      .single()
    if (criado.error || !criado.data) {
      registrar('criar jogador legado', criado.error)
      continue
    }
    const ligado = await db.from('InscricaoAtleta').update({ jogadorLegadoId: criado.data.id }).eq('id', atleta.id)
    if (ligado.error) registrar('vincular jogador legado', ligado.error)
  }
}

/** Devolve o id da Equipe legada da inscrição (criando/vinculando se preciso) ou null se não foi possível. */
export async function garantirEquipeLegada(inscricaoId: string): Promise<number | null> {
  try {
    const lida = await db
      .from('Inscricao')
      .select('id,ligaId,categoriaCampeonatoId,timeId,status,equipeLegadoId')
      .eq('id', inscricaoId)
      .maybeSingle()
    if (lida.error) {
      if (!colunaAusente(lida.error, ['equipeLegadoId']) && lida.error.code !== '42P01') registrar('ler inscrição', lida.error)
      return null
    }
    const inscricao = lida.data as any
    if (!inscricao || !inscricaoViva(String(inscricao.status))) return null

    if (inscricao.equipeLegadoId != null) {
      const atual = await db.from('Equipe').select('id').eq('id', inscricao.equipeLegadoId).maybeSingle()
      if (!atual.error && atual.data) {
        await copiarElenco(inscricao.id, Number(inscricao.equipeLegadoId))
        return Number(inscricao.equipeLegadoId)
      }
    }

    const [time, categoria] = await Promise.all([
      db.from('TimeClube').select('id,nome,escudoUrl').eq('id', inscricao.timeId).maybeSingle(),
      db.from('CategoriaCampeonato').select('id,codigo').eq('id', inscricao.categoriaCampeonatoId).maybeSingle(),
    ])
    if (time.error || categoria.error || !time.data || !categoria.data) {
      registrar('ler time/categoria', time.error ?? categoria.error)
      return null
    }
    const nome = String(time.data.nome ?? '').trim()
    if (!nome) return null

    const procurar = async () => {
      const r = await db
        .from('Equipe')
        .select('id')
        .eq('ligaId', inscricao.ligaId)
        .eq('categoriaCampeonatoId', inscricao.categoriaCampeonatoId)
        .eq('nome', nome)
        .maybeSingle()
      return r.error ? null : ((r.data as { id: number } | null)?.id ?? null)
    }
    let equipeId = await procurar()
    if (equipeId != null) {
      // Equipe do mesmo nome já ligada a OUTRO time do Meu Time: não sequestra.
      const donos = await db.from('Inscricao').select('id,timeId,status').eq('equipeLegadoId', equipeId)
      const outro = ((donos.data ?? []) as any[]).some((d) => d.timeId !== inscricao.timeId && inscricaoViva(String(d.status)))
      if (outro) return null
    } else {
      const criada = await db
        .from('Equipe')
        .insert({
          nome,
          categoria: categoria.data.codigo,
          categoriaCampeonatoId: inscricao.categoriaCampeonatoId,
          ligaId: inscricao.ligaId,
          serie: null,
          logoUrl: time.data.escudoUrl ?? null,
          statusEquipe: 'ATIVA',
        })
        .select('id')
        .single()
      if (criada.error) {
        // Corrida: outra requisição criou a mesma equipe; relê.
        if (criada.error.code === '23505') equipeId = await procurar()
        else registrar('criar equipe legada', criada.error)
      } else {
        equipeId = (criada.data as { id: number } | null)?.id ?? null
      }
      if (equipeId == null) return null
    }

    const vinculo = await db.from('Inscricao').update({ equipeLegadoId: equipeId }).eq('id', inscricao.id)
    if (vinculo.error) {
      registrar('gravar vínculo', vinculo.error)
      return null
    }
    await copiarElenco(inscricao.id, equipeId)
    return equipeId
  } catch (erro) {
    console.error('[equipe-legada] falha inesperada', erro instanceof Error ? erro.message : 'desconhecido')
    return null
  }
}

/** Reparo preguiçoso: vincula as inscrições vivas do time que ainda não têm Equipe legada (no máximo `limite`). */
export async function repararVinculosDoTime(timeId: string, limite = LIMITE_REPARO): Promise<number> {
  try {
    const r = await db.from('Inscricao').select('id,status').eq('timeId', timeId).is('equipeLegadoId', null)
    if (r.error) return 0
    const pendentes = ((r.data ?? []) as any[]).filter((item) => inscricaoViva(String(item.status))).slice(0, limite)
    let corrigidas = 0
    for (const item of pendentes) if ((await garantirEquipeLegada(item.id)) != null) corrigidas += 1
    return corrigidas
  } catch {
    return 0
  }
}

/** Calendário/chaveamento: garante a Equipe legada de todas as inscrições vivas da categoria (ou do campeonato). */
export async function garantirEquipesLegadasDaLiga(ligaId: number, categoriaCampeonatoId?: string | null, limite = 200): Promise<number> {
  try {
    let consulta = db.from('Inscricao').select('id,status').eq('ligaId', ligaId).is('equipeLegadoId', null)
    if (categoriaCampeonatoId) consulta = consulta.eq('categoriaCampeonatoId', categoriaCampeonatoId)
    const r = await consulta
    if (r.error) return 0
    const pendentes = ((r.data ?? []) as any[]).filter((item) => inscricaoViva(String(item.status))).slice(0, limite)
    let corrigidas = 0
    for (const item of pendentes) if ((await garantirEquipeLegada(item.id)) != null) corrigidas += 1
    return corrigidas
  } catch {
    return 0
  }
}
