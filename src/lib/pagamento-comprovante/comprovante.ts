// Upload do comprovante de pagamento (R19), reaproveitando as rotas /api/meu-time/uploads/assinar e /confirmar
// com tipo 'COMPROVANTE'. O servidor decide tudo: dono (a inscrição da equipe do usuário, conferida pelo banco),
// MIME, tamanho e o CAMINHO (<inscricaoId>/<uuid>.<ext>, uuid gerado aqui). O caminho só é gravado depois de o objeto
// existir no Storage com tamanho e MIME reais dentro do limite. O caminho nunca volta nas respostas.
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isCampeonatoFinalizado, MENSAGEM_CAMPEONATO_FINALIZADO } from '@/lib/championship-finalization'
import { ErroMeuTime } from '@/lib/meu-time/acesso'
import { exigirEquipe } from '@/lib/meu-time/dados'
import {
  ErroStorageMeuTime,
  assinarEnvioMeuTime,
  caminhoPertenceAoDono,
  conferirObjetoReal,
  extensaoDoCaminhoPermitida,
  lerObjetoReal,
  montarCaminhoMeuTime,
  removerObjeto,
  validarEnvioMeuTime,
} from '@/lib/uploads/meu-time'
import { indisponivelPagamento, lerPagamentoDb, pagamentoComprovanteAtivo } from './config'
import { podeReceberComprovante, rotuloEstado } from './regras'
import {
  avisarComprovanteEnviado,
  garantirPagamentoPendente,
  inscricaoNaoEncontrada,
  lerConfigDaCategoria,
  lerInscricaoParaPagamento,
  lerLinhaPagamento,
  type InscricaoParaPagamento,
  type LinhaPagamento,
} from './servico'

const db = supabaseAdmin as any

type EntradaComum = { equipeId: string; inscricaoId?: string }

function erroDeStorage(erro: unknown): never {
  if (erro instanceof ErroStorageMeuTime) {
    if (erro.bucketAusente) throw indisponivelPagamento()
    throw new ErroMeuTime('Não foi possível falar com o armazenamento de arquivos. Tente novamente.', 502, 'STORAGE_INDISPONIVEL')
  }
  throw erro
}

/** Inscrição da equipe do usuário (líder/técnico) que ainda pode receber comprovante, com a linha de pagamento. */
async function resolverInscricao(usuarioId: string, entrada: EntradaComum): Promise<{ inscricao: InscricaoParaPagamento; linha: LinhaPagamento }> {
  if (!pagamentoComprovanteAtivo()) throw new ErroMeuTime('Não encontrado.', 404)
  if (!entrada.inscricaoId) throw new ErroMeuTime('Informe "inscricaoId" para este envio.', 422, 'DADOS_INVALIDOS')
  const { equipe } = await exigirEquipe(usuarioId, entrada.equipeId, 'escrita')
  const inscricao = await lerInscricaoParaPagamento(entrada.inscricaoId)
  // Inscrição de outra equipe "não existe" para quem pede.
  if (!inscricao || inscricao.timeId !== equipe.id) throw inscricaoNaoEncontrada()
  if (inscricao.status === 'REMOVIDA') throw new ErroMeuTime('Esta inscrição foi recusada ou removida.', 409, 'TRANSICAO_INVALIDA')
  const liga = await db.from('Liga').select('status').eq('id', inscricao.ligaId).maybeSingle()
  if (isCampeonatoFinalizado(liga.data?.status)) throw new ErroMeuTime(MENSAGEM_CAMPEONATO_FINALIZADO, 409, 'CAMPEONATO_FINALIZADO')

  // Leituras estritas: coluna ou tabela ausente = 503 (o envio de comprovante só existe com as migrations aplicadas).
  const config = await lerConfigDaCategoria(inscricao.categoriaCampeonatoId)
  const linha = (await lerLinhaPagamento(inscricao.id)) ?? (await garantirPagamentoPendente(inscricao, config))
  if (!linha) throw new ErroMeuTime('Esta categoria não exige comprovante de pagamento.', 409, 'SEM_COBRANCA')
  if (!podeReceberComprovante(linha.estado)) {
    throw new ErroMeuTime(`O pagamento desta inscrição já está ${rotuloEstado(linha.estado)}.`, 409, 'PAGAMENTO_JA_DECIDIDO')
  }
  return { inscricao, linha }
}

export async function assinarComprovante(usuarioId: string, entrada: EntradaComum & { nomeArquivo: string; contentType: string; tamanho: number }) {
  if (!pagamentoComprovanteAtivo()) throw new ErroMeuTime('Não encontrado.', 404)
  const validacao = validarEnvioMeuTime({ tipo: 'COMPROVANTE', nomeArquivo: entrada.nomeArquivo, contentType: entrada.contentType, tamanho: entrada.tamanho })
  if (!validacao.ok) throw new ErroMeuTime(validacao.erro, validacao.status, 'ARQUIVO_INVALIDO')
  const { inscricao } = await resolverInscricao(usuarioId, entrada)
  const caminho = montarCaminhoMeuTime(inscricao.id, validacao.extensao)
  try {
    return await assinarEnvioMeuTime('COMPROVANTE', caminho)
  } catch (erro) {
    return erroDeStorage(erro)
  }
}

export async function confirmarComprovante(usuarioId: string, entrada: EntradaComum & { path: string }) {
  if (!pagamentoComprovanteAtivo()) throw new ErroMeuTime('Não encontrado.', 404)
  const { inscricao, linha } = await resolverInscricao(usuarioId, entrada)
  if (!caminhoPertenceAoDono(entrada.path, inscricao.id) || !extensaoDoCaminhoPermitida('COMPROVANTE', entrada.path)) {
    throw new ErroMeuTime('Caminho do arquivo inválido para este envio.', 422, 'CAMINHO_INVALIDO')
  }
  const resposta = (enviadoEm: string | null) => ({ tipo: 'COMPROVANTE' as const, estado: 'COMPROVANTE_ENVIADO' as const, enviadoEm })
  // Idempotente: confirmar de novo o mesmo arquivo não muda nada nem avisa o organizador outra vez.
  if (linha.estado === 'COMPROVANTE_ENVIADO' && linha.comprovantePath === entrada.path) return resposta(linha.comprovanteEnviadoEm)

  let real
  try {
    real = await lerObjetoReal('COMPROVANTE', entrada.path)
  } catch (erro) {
    return erroDeStorage(erro)
  }
  if (!real) throw new ErroMeuTime('O arquivo ainda não foi enviado.', 409, 'ARQUIVO_NAO_ENVIADO')
  const conferencia = conferirObjetoReal('COMPROVANTE', entrada.path, real)
  if (!conferencia.ok) {
    // Arquivo fora da regra não fica no bucket: apaga e não grava nada.
    if (entrada.path !== linha.comprovantePath) await removerObjeto('COMPROVANTE', entrada.path)
    throw new ErroMeuTime(conferencia.erro, conferencia.status, 'ARQUIVO_INVALIDO')
  }

  const enviadoEm = new Date().toISOString()
  // Reenvio depois de RECUSADO volta a COMPROVANTE_ENVIADO e limpa a decisão anterior. Compara o estado lido.
  const gravada = lerPagamentoDb(
    await db
      .from('PagamentoInscricao')
      .update({
        comprovantePath: entrada.path,
        comprovanteEnviadoEm: enviadoEm,
        estado: 'COMPROVANTE_ENVIADO',
        decididoPor: null,
        decididoEm: null,
        motivoRecusa: null,
        atualizadoEm: enviadoEm,
      })
      .eq('id', linha.id)
      .eq('estado', linha.estado)
      .select('id'),
    'gravar comprovante',
  ) as any[] | null
  if (!gravada || gravada.length === 0) {
    const depois = await lerLinhaPagamento(inscricao.id)
    if (depois && depois.estado === 'COMPROVANTE_ENVIADO' && depois.comprovantePath === entrada.path) return resposta(depois.comprovanteEnviadoEm)
    throw new ErroMeuTime('O pagamento desta inscrição acabou de ser alterado. Atualize a tela e tente de novo.', 409, 'CONFLITO')
  }
  if (linha.comprovantePath && linha.comprovantePath !== entrada.path) await removerObjeto('COMPROVANTE', linha.comprovantePath)
  await avisarComprovanteEnviado(inscricao)
  return resposta(enviadoEm)
}
