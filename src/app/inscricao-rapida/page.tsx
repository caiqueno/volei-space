export const dynamic = 'force-dynamic'

import { EstadoVazio } from '@/components/ui/EstadoVazio'
import { FormularioInscricaoRapida } from '@/components/inscricao-rapida/FormularioInscricaoRapida'
import { resolveFormularioRapidaConfig, parseCategoriaSerieOptions, buildFallbackCategoriaSerieOptions } from '@/lib/inscricao-rapida'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

type PageProps = {
  searchParams: Promise<{ ligaId?: string }>
}

export default async function InscricaoRapidaPage({ searchParams }: PageProps) {
  const { ligaId: ligaIdParam } = await searchParams
  const ligaId = Number(ligaIdParam)

  if (!isSupabaseConfigured || !ligaId || Number.isNaN(ligaId)) {
    return (
      <main className="luva-shell min-h-screen px-4 py-12">
        <EstadoVazio titulo="Link inválido" descricao="Peça ao organizador o link de cadastro correto para o seu campeonato." />
      </main>
    )
  }

  const { data: liga } = await supabase
    .from('Liga')
    .select('id,nome,status,inscricoesAbertas,inscricoesAberturaEm,inscricoesEncerramentoEm,formularioInscricaoConfig,categoriasConfig')
    .eq('id', ligaId)
    .maybeSingle()

  if (!liga || !['EM_BREVE', 'ATIVA'].includes(liga.status)) {
    return (
      <main className="luva-shell min-h-screen px-4 py-12">
        <EstadoVazio titulo="Campeonato não encontrado" descricao="Peça ao organizador o link de cadastro correto para o seu campeonato." />
      </main>
    )
  }

  const now = new Date()
  const beforeOpening = liga.inscricoesAberturaEm && now < new Date(liga.inscricoesAberturaEm)
  const afterClosing = liga.inscricoesEncerramentoEm && now > new Date(liga.inscricoesEncerramentoEm)
  if (liga.inscricoesAbertas === false || beforeOpening || afterClosing) {
    return (
      <main className="luva-shell min-h-screen px-4 py-12">
        <EstadoVazio titulo="Inscrições encerradas" descricao={`As inscrições para ${liga.nome} não estão abertas no momento.`} />
      </main>
    )
  }

  const config = resolveFormularioRapidaConfig(liga.formularioInscricaoConfig)

  const parametrizedOptions = parseCategoriaSerieOptions(liga.categoriasConfig)
  const categoriaFixa = parametrizedOptions.length === 1 ? parametrizedOptions[0] : null
  const categoriaOptions = parametrizedOptions.length > 1 ? parametrizedOptions : buildFallbackCategoriaSerieOptions()

  return (
    <FormularioInscricaoRapida
      ligaId={liga.id}
      nomeCampeonato={liga.nome}
      config={config}
      categoriaFixa={categoriaFixa}
      categoriaOptions={categoriaOptions}
    />
  )
}
