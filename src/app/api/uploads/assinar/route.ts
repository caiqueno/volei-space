import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { success, error } from '@/lib/api-response'
import { semCacheCompartilhado } from '@/lib/cache-publico'
import { consumirLimite, ipDaRequisicao } from '@/lib/rate-limit'
import { carregarEquipeAlvo, exigirAtorDaEquipe } from '@/lib/uploads/acesso-equipe'
import { assinarEnvio } from '@/lib/uploads/assinatura'
import { montarCaminhoUpload } from '@/lib/uploads/caminho'
import { TIPOS_UPLOAD, tipoDeUploadValido } from '@/lib/uploads/config'
import { validarSolicitacaoUpload } from '@/lib/uploads/validacao'

const corpoSchema = z.object({
  tipo: z.string().refine(tipoDeUploadValido, 'Tipo de envio inválido.'),
  equipeId: z.number().int().positive(),
  mime: z.string().trim().min(1).max(100),
  tamanho: z.number().int().positive(),
})

/**
 * Gera a URL assinada de envio de um arquivo da equipe. Só o organizador dono do
 * campeonato ou o capitão da equipe. O tipo MIME e o tamanho são validados aqui e
 * o caminho nasce no servidor, amarrado ao campeonato e à equipe.
 */
export async function POST(req: NextRequest) {
  const limite = consumirLimite(`upload-assinar:${ipDaRequisicao(req)}`, 60, 10 * 60 * 1000)
  if (!limite.ok) {
    const resposta = error('Muitos envios em pouco tempo. Aguarde e tente de novo.', 429)
    resposta.headers.set('Retry-After', String(limite.retryAfterSeconds))
    return semCacheCompartilhado(resposta)
  }

  const parsed = corpoSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return semCacheCompartilhado(error('Dados inválidos', 422))
  const tipo = parsed.data.tipo as keyof typeof TIPOS_UPLOAD

  const validacao = validarSolicitacaoUpload({ tipo, mime: parsed.data.mime, tamanho: parsed.data.tamanho })
  if (!validacao.ok) return semCacheCompartilhado(error(validacao.erro, validacao.status))

  const equipe = await carregarEquipeAlvo(parsed.data.equipeId)
  if (!equipe) return semCacheCompartilhado(error('Equipe não encontrada.', 404))

  const ator = await exigirAtorDaEquipe(req, equipe, ['organizador', 'capitao'])
  if (ator instanceof NextResponse) return semCacheCompartilhado(ator)

  try {
    const caminho = montarCaminhoUpload({ tipo, ligaId: equipe.ligaId, equipeId: equipe.id, extensao: validacao.extensao })
    const envio = await assinarEnvio(tipo, caminho)
    return semCacheCompartilhado(success({
      ...envio,
      mime: parsed.data.mime,
      tamanhoMaximo: validacao.config.maxBytes,
    }, 201))
  } catch (err) {
    console.error('[uploads] erro ao assinar envio', err)
    return semCacheCompartilhado(error('Não foi possível preparar o envio.', 500))
  }
}
