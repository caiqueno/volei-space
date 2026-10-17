import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { error } from '@/lib/api-response'
import { requireSumulaLeitura, requireSumulaTokenAccess } from '@/lib/sumula-access'
import { regrasEfetivasDaPartida } from '@/lib/regras-da-partida'
import { configDaPartida, contextoDaPartida, type ClienteEventos } from '@/lib/sumula-eventos'
import { carregarAcoesScout, exportarCsv, exportarJson, lerResumoScout, scoutAtivo, VERSAO_ESQUEMA_CSV, VERSAO_ESQUEMA_JSON } from '@/lib/scout'

/**
 * Exportação do scout: `?formato=csv|json` (padrão csv). Desligada sem `SCOUT_ATIVO=1` (404).
 * CSV em UTF-8 com BOM, separador `;`. O formato .dvw NÃO existe aqui (layout não confirmado).
 */
export const dynamic = 'force-dynamic'

const partidaDoScout = (p: any) => ({ id: Number(p.id), equipeAId: p.equipeAId ?? null, equipeBId: p.equipeBId ?? null })
const cliente = supabaseAdmin as unknown as ClienteEventos

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  if (!scoutAtivo()) return error('Recurso não encontrado.', 404)
  const { token } = await params

  const formato = (new URL(req.url).searchParams.get('formato') ?? 'csv').toLowerCase()
  if (formato !== 'csv' && formato !== 'json') return error('Formato inválido. Use csv ou json.', 400)

  const access = await requireSumulaTokenAccess(token)
  if (access instanceof Response) return access
  const leitura = await requireSumulaLeitura(req, access.partida)
  if (leitura) return leitura

  try {
    const regras = await regrasEfetivasDaPartida(access.partida)
    const manuais = await carregarAcoesScout(cliente, partidaDoScout(access.partida))
    if (!manuais.ok) return error(manuais.mensagem, 500)
    const r = await lerResumoScout(cliente, {
      partidaId: Number(access.partida.id),
      config: configDaPartida(regras),
      contexto: contextoDaPartida(access.partida),
      acoes: manuais.acoes,
    })
    if (r.tipo === 'ERRO') return error(r.mensagem, 500)

    const nome = `scout-partida-${r.resumo.partidaId}`
    const comuns = { 'Cache-Control': 'no-store', 'X-Scout-Esquema': formato === 'csv' ? VERSAO_ESQUEMA_CSV : VERSAO_ESQUEMA_JSON }
    if (formato === 'json') {
      return new NextResponse(exportarJson(r.resumo), {
        status: 200,
        headers: { ...comuns, 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="${nome}.json"` },
      })
    }
    return new NextResponse(exportarCsv(r.resumo), {
      status: 200,
      headers: { ...comuns, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${nome}.csv"` },
    })
  } catch {
    return error('Não foi possível exportar o scout da partida.', 500)
  }
}
