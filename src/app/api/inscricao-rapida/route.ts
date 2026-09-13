import { NextRequest } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { inscricaoRapidaSchema } from '@/lib/schemas'
import { resolveFormularioRapidaConfig, isFieldEnabled as isEnabled, isFieldRequired as isRequired, parseCategoriaSerieOptions, buildFallbackCategoriaSerieOptions } from '@/lib/inscricao-rapida'
import { slugifyUnique } from '@/utils/slug'
import { countApprovedRegistrations, ensureClassificationAndCalendar } from '@/lib/championship-operations'
import { errorDetail } from '@/lib/error-detail'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = inscricaoRapidaSchema.safeParse(body)
    if (!parsed.success) return error('Dados inválidos', 422, parsed.error.flatten())
    const { ligaId, nomeEquipe, logoUrl, lider, tecnico, categoria, serie, jogadores } = parsed.data

    const { data: liga, error: ligaErr } = await supabase
      .from('Liga')
      .select('id,nome,status,inscricoesAbertas,quantidadeEquipes,formularioInscricaoConfig,categoriasConfig')
      .eq('id', ligaId)
      .maybeSingle()
    if (ligaErr) throw ligaErr
    if (!liga) return error('Campeonato não encontrado.', 404)
    if (!['EM_BREVE', 'ATIVA'].includes(liga.status)) return error('Campeonato não está aberto para inscrição.', 400)
    if (liga.inscricoesAbertas === false) return error('As inscrições deste campeonato estão fechadas.', 400)

    const aprovadas = await countApprovedRegistrations(ligaId)
    if (liga.quantidadeEquipes && aprovadas >= liga.quantidadeEquipes) {
      return error('O limite de equipes aprovadas deste campeonato já foi atingido.', 400)
    }

    const config = resolveFormularioRapidaConfig(liga.formularioInscricaoConfig)

    const parametrizedOptions = parseCategoriaSerieOptions(liga.categoriasConfig)
    let resolvedCategoria: string
    let resolvedSerie: string
    if (parametrizedOptions.length === 1) {
      resolvedCategoria = parametrizedOptions[0].categoria
      resolvedSerie = parametrizedOptions[0].serie
    } else {
      const allowedOptions = parametrizedOptions.length > 1 ? parametrizedOptions : buildFallbackCategoriaSerieOptions()
      const match = allowedOptions.find((option) => option.categoria === categoria && option.serie === serie)
      if (!match) return error('Selecione uma categoria válida para este campeonato.', 422)
      resolvedCategoria = match.categoria
      resolvedSerie = match.serie
    }

    const issues: string[] = []
    if (isRequired(config.equipe.logo) && !logoUrl) issues.push('Logo da equipe é obrigatório.')
    if (isRequired(config.lider.nomeCompleto) && !lider) issues.push('Nome do líder é obrigatório.')
    jogadores.forEach((jogador, index) => {
      const label = `Jogador ${index + 1} (${jogador.nome || 'sem nome'})`
      if (isRequired(config.atleta.numeroCamisa) && jogador.numero == null) issues.push(`${label}: número da camisa é obrigatório.`)
      if (isRequired(config.atleta.posicao) && !jogador.posicao) issues.push(`${label}: posição é obrigatória.`)
      if (isRequired(config.atleta.foto) && !jogador.fotoUrl) issues.push(`${label}: foto é obrigatória.`)
      if (isRequired(config.atleta.cpf) && !jogador.cpf) issues.push(`${label}: CPF é obrigatório.`)
      if (isRequired(config.atleta.dataNascimento) && !jogador.dataNascimento) issues.push(`${label}: data de nascimento é obrigatória.`)
      if (isRequired(config.atleta.documento) && (!jogador.documentoTipo || !jogador.documentoNumero)) issues.push(`${label}: documento é obrigatório.`)
    })
    if (issues.length > 0) return error('Não foi possível concluir o cadastro.', 422, issues)

    const slug = await slugifyUnique(nomeEquipe)
    const { data: equipe, error: equipeErr } = await supabase
      .from('Equipe')
      .insert({
        nome: nomeEquipe,
        ligaId,
        categoria: resolvedCategoria,
        serie: resolvedSerie,
        slug,
        statusEquipe: 'ATIVA',
        inscricaoAtiva: true,
        logoUrl: isEnabled(config.equipe.logo) ? (logoUrl || null) : null,
        lider: isEnabled(config.lider.nomeCompleto) ? (lider || null) : null,
        tecnico: tecnico || null,
      })
      .select()
      .single()

    if (equipeErr) {
      if ((equipeErr as { code?: string }).code === '23505') {
        return error('Já existe uma equipe cadastrada com esse nome nesta categoria/série.', 409)
      }
      throw equipeErr
    }

    const jogadoresPayload = jogadores.map((jogador) => ({
      nome: jogador.nome,
      equipeId: equipe.id,
      numero: isEnabled(config.atleta.numeroCamisa) ? jogador.numero ?? null : null,
      posicao: isEnabled(config.atleta.posicao) ? jogador.posicao || null : null,
      fotoUrl: isEnabled(config.atleta.foto) ? jogador.fotoUrl || null : null,
      cpf: isEnabled(config.atleta.cpf) ? jogador.cpf || null : null,
      dataNascimento: isEnabled(config.atleta.dataNascimento) ? jogador.dataNascimento || null : null,
      documentoTipo: isEnabled(config.atleta.documento) ? jogador.documentoTipo || null : null,
      documentoNumero: isEnabled(config.atleta.documento) ? jogador.documentoNumero || null : null,
      autoRegistrado: true,
    }))
    const { error: jogadoresErr } = await supabase.from('Jogador').insert(jogadoresPayload)
    if (jogadoresErr) throw jogadoresErr

    const { data: inscricao, error: inscricaoErr } = await supabase
      .from('InscricaoCampeonato')
      .upsert({
        ligaId,
        equipeId: equipe.id,
        status: 'APROVADA',
        observacao: 'Cadastro rápido via link (sem aprovação manual)',
      }, { onConflict: 'ligaId,equipeId' })
      .select('id,ligaId,equipeId,liga:Liga(id,quantidadeEquipes,formato,quantidadeGrupos),equipe:Equipe(id,categoria,serie,nome)')
      .single()
    if (inscricaoErr) throw inscricaoErr
    await ensureClassificationAndCalendar(inscricao)

    return success({ equipeId: equipe.id, nome: equipe.nome }, 201)
  } catch (err) {
    console.error('[inscricao-rapida] erro ao registrar equipe', err)
    return error(`Erro ao registrar equipe: ${errorDetail(err)}`, 500)
  }
}
