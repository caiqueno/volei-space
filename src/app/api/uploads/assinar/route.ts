import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { success, error } from '@/lib/api-response'
import { semCacheCompartilhado } from '@/lib/cache-publico'
import { consumirLimite, ipDaRequisicao } from '@/lib/rate-limit'
import { verifyPublicToken, isReleasedPublicStatus } from '@/lib/auth'
import { exigirOrganizadorDaLiga, requireOrganizador } from '@/lib/organizador-isolamento'
import { carregarEquipeAlvo, exigirAtorDaEquipe } from '@/lib/uploads/acesso-equipe'
import { MENSAGEM_CADASTRO_INCOMPLETO, candidaturaSemEquipe } from '@/lib/uploads/cadastro-incompleto'
import { assinarEnvio } from '@/lib/uploads/assinatura'
import { montarCaminhoDono, montarCaminhoUpload } from '@/lib/uploads/caminho'
import { TIPOS_UPLOAD, tipoDeUploadValido } from '@/lib/uploads/config'
import { validarSolicitacaoUpload } from '@/lib/uploads/validacao'

const corpoSchema = z.object({
  tipo: z.string().refine(tipoDeUploadValido, 'Tipo de envio inválido.'),
  equipeId: z.number().int().positive().optional(),
  ligaId: z.number().int().positive().optional(),
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

  let montar: () => string
  switch (validacao.config.escopo) {
    case 'equipe': {
      if (!parsed.data.equipeId) {
        // Capitão sem equipe vinculada não tem onde gravar: explica o motivo em vez de "dados inválidos".
        const sessaoCapitao = await verifyPublicToken(req)
        if (sessaoCapitao?.tipo === 'equipe' && isReleasedPublicStatus(sessaoCapitao.status) && (await candidaturaSemEquipe(String(sessaoCapitao.userId)))) {
          return semCacheCompartilhado(error(MENSAGEM_CADASTRO_INCOMPLETO, 409, { codigo: 'CADASTRO_INCOMPLETO' }))
        }
        return semCacheCompartilhado(error('Dados inválidos', 422))
      }
      const equipe = await carregarEquipeAlvo(parsed.data.equipeId)
      if (!equipe) return semCacheCompartilhado(error('Equipe não encontrada.', 404))
      const ator = await exigirAtorDaEquipe(req, equipe, ['organizador', 'capitao'])
      if (ator instanceof NextResponse) return semCacheCompartilhado(ator)
      montar = () => montarCaminhoUpload({ tipo, ligaId: equipe.ligaId, equipeId: equipe.id, extensao: validacao.extensao })
      break
    }
    case 'liga': {
      if (!parsed.data.ligaId) return semCacheCompartilhado(error('Dados inválidos', 422))
      const ligaId = parsed.data.ligaId
      const auth = await exigirOrganizadorDaLiga(req, ligaId)
      if (auth instanceof NextResponse) return semCacheCompartilhado(auth)
      montar = () => montarCaminhoDono({ tipo, ligaId, extensao: validacao.extensao })
      break
    }
    case 'organizador': {
      const auth = await requireOrganizador(req)
      if (auth instanceof Response) return semCacheCompartilhado(auth)
      montar = () => montarCaminhoDono({ tipo, organizadorId: auth.userId, extensao: validacao.extensao })
      break
    }
    default: {
      // Candidatura: o cadastro ainda não tem equipe nem sessão. Limite próprio por IP e caminho
      // temporário (anonimo/ ou usuario-<id>/ quando há sessão liberada), nunca escolhido pelo cliente.
      const limiteCadastro = consumirLimite(`upload-candidatura:${ipDaRequisicao(req)}`, 30, 60 * 60 * 1000)
      if (!limiteCadastro.ok) {
        const resposta = error('Muitos envios em pouco tempo. Aguarde e tente de novo.', 429)
        resposta.headers.set('Retry-After', String(limiteCadastro.retryAfterSeconds))
        return semCacheCompartilhado(resposta)
      }
      const sessao = await verifyPublicToken(req)
      const usuarioId = sessao && isReleasedPublicStatus(sessao.status) && /^[A-Za-z0-9_-]{1,64}$/.test(String(sessao.userId)) ? String(sessao.userId) : null
      montar = () => montarCaminhoDono({ tipo, usuarioId, extensao: validacao.extensao })
    }
  }

  try {
    const caminho = montar()
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
