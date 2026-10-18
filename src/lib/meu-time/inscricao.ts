// Inscrição de uma equipe do Meu Time em uma categoria. Automática: nunca cria fila de aprovação.
// A lista de atletas é uma CÓPIA (snapshot) gravada em "InscricaoAtleta".
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { normalizarElegibilidade, type ElegibilidadeCategoria } from '@/lib/elegibilidade-categoria'
import { registrationWindowDecision } from '@/lib/team-registration-draft'
import { ErroMeuTime, lerDados, tabelaAusente, violacaoUnica } from '@/lib/meu-time/acesso'
import { avaliarConvite, type LinkCampeonato } from '@/lib/meu-time/convite'
import { garantirEquipeLegada } from '@/lib/meu-time/equipe-legada'
import {
  idsComConsentimento,
  listarAtletasDoClube,
  listarComissao,
  paraAtletaDoBanco,
  type EquipeBanco,
} from '@/lib/meu-time/dados'
import {
  REGRA_ELENCO_PADRAO,
  inscricaoViva,
  mensagemNaipe,
  validarInscricao,
  type RegraElencoDados,
  type SelecaoAtleta,
} from '@/lib/meu-time/regras'

export type InscricaoResumo = {
  id: string
  categoriaCampeonatoId: string
  status: string
  totalAtletas: number
}

export type PedidoInscricao = {
  categoriaCampeonatoId: string
  atletas: SelecaoAtleta[]
  comissao?: string[]
  convite?: string
}

export function paraRegra(linha: any): RegraElencoDados {
  if (!linha) return { ...REGRA_ELENCO_PADRAO }
  return {
    atletasMin: linha.atletasMin ?? null,
    atletasMax: linha.atletasMax ?? null,
    liberosMax: linha.liberosMax ?? REGRA_ELENCO_PADRAO.liberosMax,
    nascimentoDe: linha.nascimentoDe ?? null,
    nascimentoAte: linha.nascimentoAte ?? null,
    comissaoMax: linha.comissaoMax ?? null,
    documentosExigidos: Array.isArray(linha.documentosExigidos) ? linha.documentosExigidos : [],
  }
}

async function lerElegibilidade(ligaId: number, categoriaCampeonatoId: string): Promise<ElegibilidadeCategoria | null> {
  const resposta = await supabase
    .from('CategoriaConfiguracao')
    .select('genero,idadeMinima,idadeMaxima')
    .eq('ligaId', ligaId)
    .eq('categoriaCampeonatoId', categoriaCampeonatoId)
    .maybeSingle()
  // Colunas de elegibilidade ainda ausentes: a regra fica desligada, como na inscrição rápida.
  if (resposta.error) return null
  return normalizarElegibilidade(resposta.data as Record<string, unknown> | null)
}

export async function contarAtletasPorInscricao(inscricaoIds: string[]) {
  const contagem = new Map<string, number>()
  if (inscricaoIds.length === 0) return contagem
  const linhas = (lerDados(
    await supabase.from('InscricaoAtleta').select('inscricaoId').in('inscricaoId', inscricaoIds).eq('ativo', true),
    'atletas das inscrições',
  ) as Array<{ inscricaoId: string }> | null) ?? []
  for (const linha of linhas) contagem.set(linha.inscricaoId, (contagem.get(linha.inscricaoId) ?? 0) + 1)
  return contagem
}

export async function listarInscricoesDaEquipe(timeId: string): Promise<InscricaoResumo[]> {
  const linhas = (lerDados(
    await supabase.from('Inscricao').select('id,categoriaCampeonatoId,status').eq('timeId', timeId).order('criadoEm', { ascending: false }),
    'inscrições da equipe',
  ) as any[] | null) ?? []
  const contagem = await contarAtletasPorInscricao(linhas.map((item) => item.id))
  return linhas.map((item) => ({
    id: item.id,
    categoriaCampeonatoId: item.categoriaCampeonatoId,
    status: item.status,
    totalAtletas: contagem.get(item.id) ?? 0,
  }))
}

export async function inscreverEquipe(usuarioId: string, equipe: EquipeBanco, pedido: PedidoInscricao) {
  // 1. Categoria e janela de inscrição do campeonato.
  const categoria = lerDados(
    await supabase.from('CategoriaCampeonato').select('id,ligaId,tokenInscricao').eq('id', pedido.categoriaCampeonatoId).is('removidaEm', null).maybeSingle(),
    'categoria',
  ) as { id: string; ligaId: number; tokenInscricao: string | null } | null
  if (!categoria) throw new ErroMeuTime('Categoria não encontrada.', 404, 'CATEGORIA_NAO_ENCONTRADA')
  // Convite (M7): exigido se a categoria tem link ou o campeonato tem link ativo; ver convite.ts.
  const resposta = await supabase
    .from('LinkInscricaoCampeonato')
    .select('token,ativo,revogadoEm,expiraEm')
    .eq('ligaId', categoria.ligaId)
    .maybeSingle()
  if (resposta.error && !tabelaAusente(resposta.error)) lerDados(resposta, 'link de inscrição do campeonato')
  // Visibilidade em consulta própria: se a coluna ainda não existe, o erro é ignorado (pública).
  const visibilidade = await supabase.from('Liga').select('visibilidade').eq('id', categoria.ligaId).maybeSingle()
  const decisao = avaliarConvite(pedido.convite, {
    visibilidade: visibilidade.error ? null : ((visibilidade.data as { visibilidade?: string | null } | null)?.visibilidade ?? null),
    tokenCategoria: categoria.tokenInscricao,
    linkCampeonato: resposta.error ? null : (resposta.data as LinkCampeonato | null),
  })
  if (!decisao.ok) throw new ErroMeuTime(decisao.mensagem, decisao.status, decisao.codigo)
  const liga = lerDados(
    await supabase.from('Liga').select('id,status,inscricoesAbertas,inscricoesAberturaEm,inscricoesEncerramentoEm').eq('id', categoria.ligaId).maybeSingle(),
    'campeonato',
  ) as any
  if (!liga) throw new ErroMeuTime('Campeonato não encontrado.', 404, 'CAMPEONATO_NAO_ENCONTRADO')
  const janela = registrationWindowDecision(liga)
  if (!janela.allowed) throw new ErroMeuTime(janela.reason || 'Inscrições indisponíveis.', 403, 'INSCRICOES_FECHADAS')

  // 2. Regras da categoria e naipe da equipe.
  const regra = paraRegra(lerDados(
    await supabase.from('RegraElenco').select('*').eq('categoriaCampeonatoId', categoria.id).maybeSingle(),
    'regra de elenco',
  ))
  const elegibilidade = await lerElegibilidade(categoria.ligaId, categoria.id)
  const naipe = mensagemNaipe(equipe.naipe, elegibilidade?.genero)
  if (naipe) throw new ErroMeuTime(naipe, 422, 'NAIPE_INCOMPATIVEL')

  // 3. Equipe ainda não inscrita nesta categoria.
  const viva = (lerDados(
    await supabase.from('Inscricao').select('id,status').eq('timeId', equipe.id).eq('categoriaCampeonatoId', categoria.id),
    'inscrição existente',
  ) as Array<{ id: string; status: string }> | null) ?? []
  if (viva.some((item) => inscricaoViva(item.status))) {
    throw new ErroMeuTime('Esta equipe já está inscrita nesta categoria.', 409, 'JA_INSCRITA')
  }

  // 4. Atletas escolhidos precisam estar no banco do time; ninguém pode estar em outro time da categoria.
  const linhasDoClube = await listarAtletasDoClube(equipe.clubeId)
  const comConsentimento = await idsComConsentimento(linhasDoClube)
  const banco = new Map(linhasDoClube.map((linha) => [linha.id as string, paraAtletaDoBanco(linha, comConsentimento)]))
  const ids = pedido.atletas.map((item) => item.atletaId)
  const ocupados = (lerDados(
    await supabase.from('InscricaoAtleta').select('atletaId').eq('categoriaCampeonatoId', categoria.id).in('atletaId', ids).eq('ativo', true).eq('inscricaoAtiva', true),
    'atletas já inscritos na categoria',
  ) as Array<{ atletaId: string }> | null) ?? []

  // 5. Comissão técnica: ids de "ComissaoTime" que pertencem a esta equipe (a tabela só é lida se vier comissão).
  const idsComissao = Array.from(new Set(pedido.comissao ?? []))
  const comissao = idsComissao.length === 0 ? [] : await listarComissao(equipe.id).then((todos) => idsComissao.map((membroId) => {
    const membro = todos.find((item) => item.id === membroId)
    if (!membro) throw new ErroMeuTime('Há membro da comissão que não faz parte desta equipe.', 422, 'MEMBRO_FORA_DA_EQUIPE')
    return membro
  }))

  const resultado = validarInscricao(pedido.atletas, {
    naipeEquipe: equipe.naipe,
    regra,
    elegibilidade,
    banco,
    jaInscritosNaCategoria: new Set(ocupados.map((item) => item.atletaId)),
    totalComissao: comissao.length,
  })
  if (resultado.erros.length > 0) {
    throw new ErroMeuTime(resultado.erros[0].mensagem, 422, resultado.erros[0].codigo, { erros: resultado.erros })
  }

  // 6. Grava inscrição + cópia dos atletas. Sem transação no cliente: se algo falhar, apaga o que criou.
  const agora = new Date().toISOString()
  const criada = await supabase
    .from('Inscricao')
    .insert({
      ligaId: categoria.ligaId,
      categoriaCampeonatoId: categoria.id,
      timeId: equipe.id,
      status: resultado.status,
      enviadaEm: agora,
      criadoPor: usuarioId,
    })
    .select('id,categoriaCampeonatoId,status')
    .single()
  if (violacaoUnica(criada.error)) throw new ErroMeuTime('Esta equipe já está inscrita nesta categoria.', 409, 'JA_INSCRITA')
  const inscricao = lerDados(criada, 'criar inscrição') as any
  if (!inscricao) throw new ErroMeuTime('Não foi possível concluir a inscrição.', 500)

  const desfazer = async () => { await supabase.from('Inscricao').delete().eq('id', inscricao.id) }
  const copia = pedido.atletas.map((item) => {
    const atleta = banco.get(item.atletaId)!
    return {
      inscricaoId: inscricao.id,
      ligaId: categoria.ligaId,
      categoriaCampeonatoId: categoria.id,
      atletaId: item.atletaId,
      nomeSnapshot: atleta.nome,
      dataNascimentoSnapshot: atleta.dataNascimento,
      numero: item.numero,
      capitao: Boolean(item.capitao),
      libero: Boolean(item.libero),
      documentosOk: atleta.temDocumento,
    }
  })
  const gravados = await supabase.from('InscricaoAtleta').insert(copia)
  if (gravados.error) {
    await desfazer()
    if (violacaoUnica(gravados.error)) {
      throw new ErroMeuTime('Algum atleta ou camisa acabou de ser usado em outra inscrição. Revise a lista.', 409, 'CONFLITO_DE_ELENCO')
    }
    lerDados(gravados, 'copiar atletas da inscrição')
  }
  if (comissao.length > 0) {
    const gravada = await supabase.from('InscricaoComissao').insert(
      comissao.map((membro) => ({ inscricaoId: inscricao.id, nomeSnapshot: membro.nome, funcao: membro.funcao, noBanco: true })),
    )
    if (gravada.error) {
      await desfazer()
      lerDados(gravada, 'copiar comissão da inscrição')
    }
  }

  // Ponte para a Equipe legada das partidas (idempotente; nunca falha a inscrição, o reparo tenta de novo depois).
  await garantirEquipeLegada(inscricao.id)

  const resumo: InscricaoResumo = {
    id: inscricao.id,
    categoriaCampeonatoId: inscricao.categoriaCampeonatoId,
    status: inscricao.status,
    totalAtletas: copia.length,
  }
  // `avisos` segue como lista de textos (compatível com a tela); as pendências de LGPD começam pelo código
  // ATLETA_MENOR_SEM_CONSENTIMENTO e também vêm estruturadas em `avisosDetalhe`.
  return { resumo, avisos: [...resultado.avisos, ...resultado.pendencias], avisosDetalhe: resultado.pendenciasDetalhe }
}
