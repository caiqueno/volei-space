import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { semCacheCompartilhado } from '@/lib/cache-publico'
import { consumirLimite, ipDaRequisicao } from '@/lib/rate-limit'
import { carregarEquipeAlvo, exigirAtorDaEquipe } from '@/lib/uploads/acesso-equipe'
import { assinarLeitura } from '@/lib/uploads/assinatura'
import { caminhoDoValorArmazenado, lerCaminhoUpload } from '@/lib/uploads/caminho'
import { TIPOS_UPLOAD } from '@/lib/uploads/config'
import { documentoPertenceAEquipe } from '@/lib/uploads/documentos'

const BUCKET_PRIVADO = TIPOS_UPLOAD['atleta-documento'].bucket

const consultaSchema = z.union([
  z.object({ caminho: z.string().min(1).max(200) }),
  z.object({ jogadorId: z.coerce.number().int().positive(), indice: z.coerce.number().int().min(0).max(7) }),
])

/**
 * URL assinada de leitura (120 s) de um documento de atleta no bucket privado.
 * Só o organizador dono do campeonato, o capitão da equipe ou o árbitro escalado
 * para um jogo da equipe. Dois modos:
 *  - ?caminho=... caminho no formato novo; a equipe está no próprio caminho.
 *  - ?jogadorId=N&indice=K documento K de Jogador.documentosUrls (URL antiga ou caminho).
 * Qualquer falha de caminho ou de posse responde sem revelar se o arquivo existe.
 */
export async function GET(req: NextRequest) {
  const limite = consumirLimite(`upload-ler:${ipDaRequisicao(req)}`, 120, 10 * 60 * 1000)
  if (!limite.ok) {
    const resposta = error('Muitas consultas em pouco tempo. Aguarde e tente de novo.', 429)
    resposta.headers.set('Retry-After', String(limite.retryAfterSeconds))
    return semCacheCompartilhado(resposta)
  }

  const parsed = consultaSchema.safeParse(Object.fromEntries(new URL(req.url).searchParams))
  if (!parsed.success) return semCacheCompartilhado(error('Dados inválidos', 422))

  const alvo = await resolverAlvo(parsed.data)
  if (!alvo) return semCacheCompartilhado(error('Documento não encontrado.', 404))

  const equipe = await carregarEquipeAlvo(alvo.equipeId)
  if (!equipe) return semCacheCompartilhado(error('Documento não encontrado.', 404))

  // O caminho (da consulta ou gravado no atleta) tem de pertencer à equipe e à liga que autorizam a leitura.
  if (!documentoPertenceAEquipe(alvo.caminho, equipe)) return semCacheCompartilhado(error('Documento não encontrado.', 404))

  const ator = await exigirAtorDaEquipe(req, equipe, ['organizador', 'capitao', 'arbitro'])
  if (ator instanceof NextResponse) return semCacheCompartilhado(ator)

  const assinada = await assinarLeitura(BUCKET_PRIVADO, alvo.caminho)
  if (!assinada) return semCacheCompartilhado(error('Documento não encontrado.', 404))
  return semCacheCompartilhado(success(assinada))
}

async function resolverAlvo(consulta: z.infer<typeof consultaSchema>): Promise<{ equipeId: number; caminho: string } | null> {
  if ('caminho' in consulta) {
    const lido = lerCaminhoUpload(consulta.caminho)
    // Só documento no formato novo; foto de rosto e emblema são públicos e não passam por aqui.
    if (!lido || lido.tipo !== 'atleta-documento') return null
    return { equipeId: lido.equipeId, caminho: consulta.caminho }
  }
  const { data } = await supabase.from('Jogador').select('id,equipeId,documentosUrls').eq('id', consulta.jogadorId).maybeSingle()
  if (!data) return null
  const caminho = caminhoDoValorArmazenado(listaDeDocumentos(data.documentosUrls)[consulta.indice], BUCKET_PRIVADO)
  return caminho ? { equipeId: Number(data.equipeId), caminho } : null
}

function listaDeDocumentos(valor: unknown): unknown[] {
  if (Array.isArray(valor)) return valor
  if (typeof valor !== 'string' || !valor.trim()) return []
  try {
    const lida = JSON.parse(valor)
    return Array.isArray(lida) ? lida : []
  } catch {
    return []
  }
}
