// Consentimento do responsável legal de atleta menor e anonimização por pedido de exclusão.
// Sempre service_role. O contato do responsável é gravado CIFRADO e NUNCA sai deste módulo em claro:
// nenhuma função aqui lê a coluna de contato de volta.
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { colunaAusente } from '@/lib/coluna-ausente'
import { ErroMeuTime, lerDados, tabelaAusente, violacaoUnica } from '@/lib/meu-time/acesso'
import { cifrarContato, VERSAO_CHAVE } from '@/lib/lgpd/cifra'
import { TERMO_VERSAO } from '@/lib/lgpd/termo'
import { limparDadosDeElenco } from '@/lib/lgpd/anonimizar-elenco'

export type EntradaResponsavel = { nome: string; contato: string }

export type EstadoConsentimento = {
  atletaId: string
  estado: 'PENDENTE' | 'REGISTRADO'
  versaoTermo: string | null
  aceitoEm: string | null
  responsavelNome: string | null
  /** O aceite foi dado numa versão do termo anterior à vigente. */
  termoDesatualizado: boolean
}

type LinhaConsentimento = {
  atletaId: string
  versaoTermo: string
  aceitoEm: string
  responsavelNome: string | null
}

/**
 * Atletas (entre `atletaIds`) com consentimento ativo (não revogado). Tolerante: se a tabela da migration
 * pendente ainda não existe, ninguém tem consentimento e todo menor aparece como pendente.
 */
export async function consentimentosAtivos(atletaIds: string[]): Promise<Map<string, LinhaConsentimento>> {
  const mapa = new Map<string, LinhaConsentimento>()
  if (atletaIds.length === 0) return mapa
  const resposta = await supabase
    .from('AtletaConsentimento')
    .select('atletaId,versaoTermo,aceitoEm,responsavelNome')
    .in('atletaId', atletaIds)
    .is('revogadoEm', null)
  if (resposta.error) {
    if (tabelaAusente(resposta.error)) return mapa
    lerDados(resposta, 'consentimentos ativos')
  }
  for (const linha of (resposta.data ?? []) as LinhaConsentimento[]) mapa.set(linha.atletaId, linha)
  return mapa
}

export function paraEstado(atletaId: string, linha: LinhaConsentimento | undefined): EstadoConsentimento {
  if (!linha) {
    return { atletaId, estado: 'PENDENTE', versaoTermo: null, aceitoEm: null, responsavelNome: null, termoDesatualizado: false }
  }
  return {
    atletaId,
    estado: 'REGISTRADO',
    versaoTermo: linha.versaoTermo,
    aceitoEm: linha.aceitoEm,
    responsavelNome: linha.responsavelNome ?? null,
    termoDesatualizado: linha.versaoTermo !== TERMO_VERSAO,
  }
}

/**
 * Registra o aceite. Se já havia consentimento ativo, ele é revogado e substituído (novo aceite, nova versão).
 * Sem transação no cliente: se a gravação do novo falhar, o anterior é reativado.
 */
export async function registrarConsentimento(usuarioId: string, atletaId: string, responsavel: EntradaResponsavel): Promise<EstadoConsentimento> {
  const contatoCifrado = cifrarContato(responsavel.contato) // 503 sem chave, antes de tocar no banco
  const agora = new Date().toISOString()
  const anteriores = lerDados(
    await supabase.from('AtletaConsentimento').update({ revogadoEm: agora, revogadoPor: usuarioId }).eq('atletaId', atletaId).is('revogadoEm', null).select('id'),
    'revogar consentimento anterior',
  ) as Array<{ id: string }> | null
  const gravado = await supabase
    .from('AtletaConsentimento')
    .insert({
      atletaId,
      versaoTermo: TERMO_VERSAO,
      aceitoEm: agora,
      registradoPor: usuarioId,
      responsavelNome: responsavel.nome,
      responsavelContatoCifrado: contatoCifrado,
      chaveVersao: VERSAO_CHAVE,
    })
    .select('atletaId,versaoTermo,aceitoEm,responsavelNome')
    .single()
  if (gravado.error) {
    if ((anteriores ?? []).length > 0) {
      await supabase.from('AtletaConsentimento').update({ revogadoEm: null, revogadoPor: null }).in('id', (anteriores ?? []).map((item) => item.id))
    }
    if (violacaoUnica(gravado.error)) throw new ErroMeuTime('Outro registro de autorização foi feito ao mesmo tempo. Tente novamente.', 409, 'CONSENTIMENTO_CONFLITO')
    lerDados(gravado, 'registrar consentimento')
  }
  return paraEstado(atletaId, gravado.data as LinhaConsentimento)
}

/** Revoga o consentimento ativo (o menor volta a "pendente"). Idempotente. */
export async function revogarConsentimento(usuarioId: string, atletaId: string) {
  lerDados(
    await supabase.from('AtletaConsentimento').update({ revogadoEm: new Date().toISOString(), revogadoPor: usuarioId }).eq('atletaId', atletaId).is('revogadoEm', null).select('id'),
    'revogar consentimento',
  )
}

// --- Exclusão / anonimização -------------------------------------------------

export type ResultadoExclusao = { removido: true; anonimizado: boolean }

const BUCKET_ARQUIVOS = 'atleta-arquivos'

/**
 * Pedido de exclusão: registra a auditoria mínima (quem, quando, motivo), anonimiza a PII do atleta
 * (cpf, documento, foto, arquivos, contato do responsável) e tira o atleta do banco do time.
 * O histórico de jogos fica: Atleta.id, nome e as cópias em InscricaoAtleta/súmula não são apagados.
 * Se o atleta ainda está ativo em OUTRO clube, só o vínculo deste clube é removido (a identidade é compartilhada).
 * Idempotente: a anonimização roda antes de desativar o vínculo, então repetir após falha parcial é seguro.
 * Sem a migration (tabela de pedidos ausente) cai no comportamento antigo: só desativa o vínculo, `anonimizado: false`.
 */
export async function anonimizarAtleta(
  usuarioId: string,
  clubeId: string,
  atletaId: string,
  motivo: string | null,
): Promise<ResultadoExclusao> {
  const desativarVinculo = async () => {
    lerDados(
      await supabase
        .from('VinculoAtletaClube')
        .update({ status: 'INATIVO', ate: new Date().toISOString().slice(0, 10) })
        .eq('clubeId', clubeId)
        .eq('atletaId', atletaId)
        .select('atletaId'),
      'remover atleta do time',
    )
  }

  const outros = lerDados(
    await supabase.from('VinculoAtletaClube').select('clubeId').eq('atletaId', atletaId).eq('status', 'ATIVO').neq('clubeId', clubeId),
    'outros vínculos do atleta',
  ) as Array<{ clubeId: string }> | null
  const compartilhado = (outros ?? []).length > 0

  const pedido = await supabase
    .from('AtletaExclusaoPedido')
    .insert({ atletaId, clubeId, solicitadoPor: usuarioId, motivo, escopo: compartilhado ? 'VINCULO' : 'ANONIMIZACAO' })
    .select('id')
    .single()
  if (pedido.error) {
    if (tabelaAusente(pedido.error)) {
      await desativarVinculo()
      return { removido: true, anonimizado: false }
    }
    lerDados(pedido, 'registrar pedido de exclusão')
  }
  const pedidoId = (pedido.data as { id: string } | null)?.id

  if (!compartilhado) {
    const agora = new Date().toISOString()
    const documento = await supabase.from('AtletaDocumento').select('documentosPaths').eq('atletaId', atletaId).maybeSingle()
    if (documento.error && !tabelaAusente(documento.error)) lerDados(documento, 'documentos do atleta')
    const caminhos = ((documento.data as { documentosPaths?: string[] } | null)?.documentosPaths ?? []).filter(Boolean)

    const campos = { cpfHash: null, documentoTipo: null, documentoHash: null, fotoUrl: null, atualizadoEm: agora }
    let atleta = await supabase.from('Atleta').update({ ...campos, anonimizadoEm: agora }).eq('id', atletaId).select('id')
    if (atleta.error && colunaAusente(atleta.error, ['anonimizadoEm'])) {
      atleta = await supabase.from('Atleta').update(campos).eq('id', atletaId).select('id')
    }
    lerDados(atleta, 'anonimizar atleta')

    // R17: colunas novas de elenco (CPF/documento/telefones cifrados, foto e documento) e os arquivos dos buckets.
    await limparDadosDeElenco(atletaId)

    // Dados de AtletaDocumento (cpf, documento, telefones, caminhos, responsável legado): a linha inteira sai.
    const apagado = await supabase.from('AtletaDocumento').delete().eq('atletaId', atletaId).select('atletaId')
    if (apagado.error && !tabelaAusente(apagado.error)) lerDados(apagado, 'apagar documentos do atleta')

    // Consentimento: mantém a prova do aceite (versão, data, quem), apaga nome e contato do responsável.
    lerDados(
      await supabase
        .from('AtletaConsentimento')
        .update({ responsavelNome: null, responsavelContatoCifrado: null, revogadoEm: agora, revogadoPor: usuarioId })
        .eq('atletaId', atletaId)
        .select('id'),
      'apagar contato do responsável',
    )

    if (caminhos.length > 0) {
      try {
        await supabase.storage.from(BUCKET_ARQUIVOS).remove(caminhos)
      } catch {
        console.error('[lgpd] falha ao apagar arquivos do atleta; remover manualmente', caminhos.length)
      }
    }
  }

  await desativarVinculo()
  if (pedidoId) {
    const concluido = await supabase.from('AtletaExclusaoPedido').update({ concluidoEm: new Date().toISOString() }).eq('id', pedidoId)
    if (concluido.error) console.error('[lgpd] pedido de exclusão não marcado como concluído', concluido.error.code ?? '')
  }
  return { removido: true, anonimizado: !compartilhado }
}
