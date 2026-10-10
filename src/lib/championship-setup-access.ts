import { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { requirePublicRole } from '@/lib/auth'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { error } from '@/lib/api-response'
import {
  SECTION_ORDER,
  type SetupSection,
  type SetupIntent,
  type StoredSectionStatus,
  getMissingSectionFields,
  resolveStoredSectionStatus,
  SECTION_REQUIRED_FIELDS,
} from '@/lib/championship-setup-status'
import type { ValidationIssue } from '@/lib/championship-validation'
import { validateChampionshipSetup } from '@/lib/championship-setup-engine'
import { isCampeonatoFinalizado, rejectIfCampeonatoFinalizado } from '@/lib/championship-finalization'

// Extrai o padrão de autenticação/ownership hoje só existente (copiado) em
// src/app/api/organizador/ligas/[id]/estrutura/route.ts::getOwnedLiga, para
// ser reaproveitado pelas rotas novas de setup/* sem recriar a duplicação.
export async function requireOwnedLigaForSetup(
  req: NextRequest,
  ligaId: number,
  columns = '*',
): Promise<{ organizadorId: string; [key: string]: unknown } | NextResponse> {
  const auth = await requirePublicRole(req, ['organizador'], { releasedOnly: true })
  if (auth instanceof NextResponse) return auth

  if (!Number.isInteger(ligaId)) return error('Campeonato inválido.', 400)

  // organizadorId é sempre incluído no select, independente do que o
  // chamador pediu — a checagem de ownership abaixo depende dele, e um
  // esquecimento no `columns` de um call site não pode virar um bypass
  // silencioso (liga.organizadorId undefined !== auth.userId sempre nega,
  // então o risco real é falso-negativo, não falso-positivo, mas ainda
  // assim é um bug fácil de evitar aqui uma única vez).
  const effectiveColumns = columns === '*' || columns.split(',').map((c) => c.trim()).includes('organizadorId')
    ? columns
    : `${columns},organizadorId`

  const { data, error: ligaErr } = await supabase
    .from('Liga')
    .select(effectiveColumns)
    .eq('id', ligaId)
    .single()

  if (ligaErr || !data) {
    if (ligaErr) console.error('[setup] campeonato não encontrado', ligaErr)
    return error('Campeonato não encontrado.', 404)
  }
  const liga = data as unknown as { organizadorId: string; [key: string]: unknown }
  if (liga.organizadorId !== auth.userId) return error('Acesso negado para este campeonato.', 403)
  return liga
}

// Lê a intenção de salvamento da query string: `?intent=complete` é a ação
// explícita "Salvar e concluir"; qualquer outro valor (ou ausência) é
// autosave/rascunho. Fica fora dos schemas Zod de propósito — é metadado da
// requisição, não um campo do campeonato.
export function readSetupIntent(req: NextRequest): SetupIntent {
  return new URL(req.url).searchParams.get('intent') === 'complete' ? 'complete' : 'draft'
}

// Lê o body JSON sem derrubar a rota quando o corpo é inválido/ausente:
// `await req.json()` cru lança e vira um 500 não tratado.
export async function readJsonBody(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json()
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export async function getStoredSectionStatus(ligaId: number, section: SetupSection): Promise<StoredSectionStatus> {
  const { data } = await supabase
    .from('LigaSetupSecao')
    .select('status')
    .eq('ligaId', ligaId)
    .eq('secao', section)
    .maybeSingle()
  return ((data as { status?: StoredSectionStatus } | null)?.status) ?? 'not-started'
}

// Traduz erros do Postgres que hoje viram 500 opaco em respostas úteis.
// 23514 = CHECK constraint (ex.: Liga_datas_check quando o autosave grava
// dataInicio isolada com uma dataFim anterior já persistida).
export function mapDatabaseError(err: unknown, fallbackMessage: string) {
  const code = (err as { code?: string } | null)?.code
  if (code === '23514') {
    console.error('[setup] restrição de campeonato', err)
    return error('Combinação de valores inválida para este campeonato. Revise as datas e os limites informados.', 422)
  }
  const message = String((err as { message?: string } | null)?.message ?? '')
  if (code === 'P0001' || message.includes('somente consulta')) {
    console.error('[setup] campeonato finalizado', err)
    return error('Este campeonato está finalizado e disponível apenas para consulta.', 409)
  }
  if (code === '42501') {
    return error('Não foi possível gravar esta seção. A conexão do servidor não tem permissão de escrita.', 500)
  }
  return error(fallbackMessage, 500)
}

// Upsert de status como efeito colateral de um PATCH bem-sucedido de seção.
// Nunca grava 'not-started' (ausência de linha já significa isso) nem
// 'attention-required'/'blocked' (sempre sobrepostos em tempo de leitura por
// computeAllEffectiveStatuses — ver championship-setup-status.ts).
export async function upsertSetupSectionStatus(
  ligaId: number,
  section: SetupSection,
  ligaAfterPatch: Record<string, unknown>,
  intent: SetupIntent = 'draft',
) {
  const currentStored = await getStoredSectionStatus(ligaId, section)
  const status = resolveStoredSectionStatus({ section, intent, currentStored, ligaAfterPatch })
  const { error: upsertErr } = await supabase
    .from('LigaSetupSecao')
    .upsert(
      {
        ligaId,
        secao: section,
        status,
        atualizadoEm: new Date().toISOString(),
        concluidoEm: status === 'completed' ? new Date().toISOString() : null,
      },
      { onConflict: 'ligaId,secao' },
    )
  if (upsertErr) throw upsertErr
  return status
}

// Campos que continuam editáveis depois que o campeonato começou.
// Reproduz a regra que só existia no modal de /painel (`ligaJaIniciada` +
// `EDITABLE_AFTER_START_FIELDS` em api/ligas/[slug]): com jogos rolando, as
// decisões estruturais ficam travadas, mas regra de pontuação, data de
// término e contratação de recursos continuam liberadas.
// Seções ausentes deste mapa não têm restrição.
const EDITABLE_AFTER_START: Partial<Record<SetupSection, string[]>> = {
  estrutura: [
    'setsFormato',
    'setsPorPartida',
    'pontosPorSet',
    'diferencaMinimaSet',
    'tieBreakUltimoSet',
    'pontosUltimoSet',
    'limiteSubstituicoesPorSet',
    'alertaRodizioIlegal',
    'limiteTemposPorSet',
    'separarTempos',
    'tempoMedico',
    'substituicaoPorLesao',
    'exigirLiberoInicial',
    'quantidadeLiberos',
    'sumulaScoutsEnabled',
  ],
  classificacao: [],
  eliminatorias: ['setsPorPartidaFinal', 'setsPorPartidaSemifinal', 'setsPorPartidaQuartas', 'setsPorPartidaOitavas', 'setsPorPartidaTerceiroLugar'],
  calendario: ['dataFim'],
}

// Trava a estrutura quando já existe partida iniciada ou encerrada, ou quando
// o campeonato foi encerrado. Status ATIVA sozinho não trava: o organizador
// ainda está na parametrização e precisa gravar formato e quantidade de equipes.
export async function isLigaEmAndamento(ligaId: number, ligaStatus?: string | null): Promise<boolean> {
  if (ligaStatus === 'ENCERRADA' || isCampeonatoFinalizado(ligaStatus)) return true

  const { count } = await supabase
    .from('Partida')
    .select('id', { count: 'exact', head: true })
    .eq('ligaId', ligaId)
    .in('status', ['EM_ANDAMENTO', 'ENCERRADA'])

  return Number(count ?? 0) > 0
}

// Rejeita explicitamente (409) alterações estruturais num campeonato que já
// começou. O wizard também renderiza esses campos em read-only, então no
// caminho feliz isto nunca dispara — é a rede de proteção da API.
export function rejectLockedFields(section: SetupSection, data: Record<string, unknown>): NextResponse | null {
  const allowed = EDITABLE_AFTER_START[section]
  if (!allowed) return null

  const blocked = Object.keys(data).filter((key) => !allowed.includes(key))
  if (blocked.length === 0) return null

  return error(
    'Campeonato já em andamento — esta configuração não pode mais ser alterada.',
    409,
    { blocked },
  )
}

// Aplica o UPDATE de uma seção com o guard de "concluir sem dados" rodando
// ANTES da escrita — não depois. Um `.update({})` do Supabase com payload
// vazio (ex.: "Salvar e concluir" clicado sem nada digitado) devolve 0
// linhas e `.single()` estoura PGRST116, virando 500 opaco; checar a
// completude sobre a visão mesclada (liga atual + patch) evita chegar lá.
export async function applySectionPatch(params: {
  ligaId: number
  section: SetupSection
  intent: SetupIntent
  liga: Record<string, unknown>
  patch: Record<string, unknown>
  columns: string
  errorMessage: string
}): Promise<{ data: Record<string, unknown> } | NextResponse> {
  const { ligaId, section, intent, liga, patch, columns, errorMessage } = params

  const bloqueio = await rejectIfCampeonatoFinalizado(ligaId)
  if (bloqueio) return bloqueio

  if (intent === 'complete') {
    const merged = { ...liga, ...patch }
    const missing = getMissingSectionFields(section, merged)
    if (missing.length > 0) {
      const fields = (SECTION_REQUIRED_FIELDS[section] ?? [])
        .filter((field) => {
          const value = merged[field.key]
          if (value == null || value === '') return true
          if (typeof value === 'string' && (value.trim() === '' || value.trim() === '[]')) return true
          return Array.isArray(value) && value.length === 0
        })
        .map((field) => field.key)
      return error(`Para concluir esta seção, preencha: ${missing.join(', ')}.`, 422, { missing, fields })
    }
  }

  if (Object.keys(patch).length === 0) {
    // Nada para gravar (autosave vazio, ou "concluir" já satisfeito pelos
    // dados existentes) — evita o update vazio problemático do Supabase.
    return { data: liga }
  }

  const { data, error: updateErr } = await supabase
    .from('Liga')
    .update(patch)
    .eq('id', ligaId)
    .select(columns)
    .single()
  if (updateErr) return mapDatabaseError(updateErr, errorMessage)

  // `columns` é uma string dinâmica (cada rota monta a sua), então o
  // supabase-js não consegue inferir o shape da linha — cast explícito via
  // `unknown` (o mesmo padrão já usado nas rotas antes desta extração).
  return { data: data as unknown as Record<string, unknown> }
}

// Fecha um PATCH de seção já escrito: grava o status e — quando é "Salvar e
// concluir" — roda o motor de validação para o wizard poder mostrar na hora
// por que a seção ficou pendente (em vez de o organizador só descobrir ao
// voltar para a Central e ver o card laranja). A rejeição por dados
// faltantes já aconteceu em applySectionPatch, antes da escrita.
export async function finalizeSectionPatch(params: {
  ligaId: number
  section: SetupSection
  intent: SetupIntent
  ligaAfterPatch: Record<string, unknown>
}): Promise<{ setupStatus: StoredSectionStatus; issues: ValidationIssue[] } | Response> {
  const { ligaId, section, intent, ligaAfterPatch } = params

  try {
    const setupStatus = await upsertSetupSectionStatus(ligaId, section, ligaAfterPatch, intent)

    if (intent !== 'complete') return { setupStatus, issues: [] }

    const validation = await validateChampionshipSetup(ligaId)
    return { setupStatus, issues: validation.perSecao[section] ?? [] }
  } catch (err) {
    return mapDatabaseError(err, 'Não foi possível atualizar o status desta seção.')
  }
}

// Lê o status armazenado (LigaSetupSecao) de todas as 6 seções de uma liga.
// Ausência de linha para uma seção = 'not-started' (cobre tanto campeonatos
// novos quanto a janela de deploy entre a migration e estas rotas existirem).
export async function getStoredSectionStatuses(ligaId: number): Promise<Record<SetupSection, StoredSectionStatus>> {
  const { data } = await supabase.from('LigaSetupSecao').select('secao,status').eq('ligaId', ligaId)
  const byStatus = new Map((data ?? []).map((row: any) => [row.secao as SetupSection, row.status as StoredSectionStatus]))
  const result = {} as Record<SetupSection, StoredSectionStatus>
  for (const section of SECTION_ORDER) {
    result[section] = byStatus.get(section) ?? 'not-started'
  }
  return result
}
