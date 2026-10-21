import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { error } from '@/lib/api-response'
import { requireSumulaTokenAccess } from '@/lib/sumula-access'
import { anexarNumerosHerdados } from '@/lib/numero-herdado-leitura'
import { sumulaParaConsulta } from '@/lib/sumula-consulta'
import { consumirLimiteAsync, ipDaRequisicao } from '@/lib/rate-limit'
import { regrasEfetivasDaPartida } from '@/lib/regras-da-partida'
import { configDaPartida, contextoDaPartida, lerEstado, sumulaEventosAtivo, type ClienteEventos } from '@/lib/sumula-eventos'
import type { SumulaEvento } from '@/lib/regras-volei'
import { montarSumulaImpressa } from '@/lib/sumula-impressa/montar'
import type { RegistroSumula } from '@/lib/sumula-impressa/tipos'
import { gerarPdfDaSumula, nomeDoArquivoSumula } from '@/lib/sumula-pdf/montar-pdf'

/**
 * PDF da súmula oficial, gerado no servidor sem dependência. Desligado por padrão: responde 404 sem
 * `SUMULA_PDF_ATIVO=1`. Mesma credencial e mesma projeção (sem dados pessoais) da página /sumula/{token}/imprimir:
 * o sumulaToken opaco; Partida.id numérico responde 404.
 */
export const dynamic = 'force-dynamic'

const cliente = supabaseAdmin as unknown as ClienteEventos

function sumulaPdfAtivo(env: Record<string, string | undefined> = process.env) {
  return env.SUMULA_PDF_ATIVO === '1'
}

/** Log do motor é opcional (como na página): qualquer falha deixa a súmula só com as ocorrências. */
async function eventosDoMotor(partida: any): Promise<SumulaEvento[] | null> {
  if (!sumulaEventosAtivo()) return null
  try {
    const regras = await regrasEfetivasDaPartida(partida)
    const resultado = await lerEstado(
      cliente,
      {
        partida: { id: Number(partida.id), equipeAId: partida.equipeAId ?? null, equipeBId: partida.equipeBId ?? null },
        config: configDaPartida(regras),
        contexto: contextoDaPartida(partida),
      },
      0,
    )
    return resultado.tipo === 'OK' ? (resultado.eventos as SumulaEvento[]) : null
  } catch {
    return null
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  if (!sumulaPdfAtivo()) return error('Recurso não encontrado.', 404)
  const { token } = await params

  const cota = await consumirLimiteAsync(`sumula-pdf:ip:${ipDaRequisicao(req)}`, 20, 10 * 60 * 1000, 'ABERTO')
  if (!cota.ok) {
    const limitada = error('Muitas solicitações. Aguarde e tente de novo.', 429)
    limitada.headers.set('Retry-After', String(cota.retryAfterSeconds))
    return limitada
  }

  const access = await requireSumulaTokenAccess(token)
  if (access instanceof Response) return access

  try {
    await anexarNumerosHerdados(access.partida)
    const registro = sumulaParaConsulta(access.partida) as unknown as RegistroSumula
    const modelo = montarSumulaImpressa(registro, await eventosDoMotor(access.partida))
    if (!modelo) return error('A súmula ainda não tem as duas equipes definidas.', 422)
    const pdf = gerarPdfDaSumula(modelo)
    const nome = nomeDoArquivoSumula(registro.id, registro.dataHora)
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${nome}"`,
        'Content-Length': String(pdf.length),
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return error('Não foi possível gerar o PDF da súmula.', 500)
  }
}
