import { EstadoVazio } from '@/components/ui/EstadoVazio'
import { FormularioInscricaoRapida } from '@/components/inscricao-rapida/FormularioInscricaoRapida'
import { formularioDaInscricao, resolveFormularioRapidaConfig } from '@/lib/inscricao-rapida'
import { periodoInscricao } from '@/lib/link-inscricao-campeonato'
import { lerFormularioDaCategoria } from '@/lib/team-registration-draft'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const LIGA_PUBLICA = 'id,nome,nomeCurto,status,simulacao,inscricoesAbertas,inscricoesAberturaEm,inscricoesEncerramentoEm,formularioInscricaoConfig'

export default async function InscricaoCategoriaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const { data: categoria } = await supabaseAdmin
    .from('CategoriaCampeonato')
    .select('id,ligaId,codigo,nome,tokenInscricao')
    .eq('tokenInscricao', token)
    .is('removidaEm', null)
    .maybeSingle()

  if (!categoria) {
    return (
      <main className="luva-shell min-h-screen px-4 py-12 text-white">
        <EstadoVazio titulo="Link de categoria inválido" descricao="Peça ao organizador o link da categoria em que a equipe vai jogar." />
      </main>
    )
  }

  const { data: liga } = await supabaseAdmin.from('Liga').select(LIGA_PUBLICA).eq('id', categoria.ligaId).maybeSingle()
  if (!liga || liga.simulacao === true) {
    return (
      <main className="luva-shell min-h-screen px-4 py-12 text-white">
        <EstadoVazio titulo="Campeonato não encontrado" descricao="Peça ao organizador o link da categoria em que a equipe vai jogar." />
      </main>
    )
  }

  const periodo = periodoInscricao(liga)
  if (periodo !== 'aberto') {
    const titulo = periodo === 'antes' ? 'Inscrições ainda não abertas' : 'Inscrições encerradas'
    return (
      <main className="luva-shell flex min-h-screen items-center justify-center px-4 text-white">
        <section className="max-w-lg">
          <h1 className="font-display text-4xl font-black">{titulo}</h1>
          <p className="mt-3 text-sm font-semibold text-white/75">{liga.nome} · {categoria.nome}</p>
        </section>
      </main>
    )
  }

  const daCategoria = await lerFormularioDaCategoria(liga.id, categoria.id)
  const config = resolveFormularioRapidaConfig(formularioDaInscricao(liga.formularioInscricaoConfig, daCategoria))
  return (
    <main className="luva-shell min-h-screen px-4 py-10 text-white">
      <section className="mx-auto mb-6 max-w-3xl">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-luva-amber">Inscrição de equipe</p>
        <h1 className="mt-2 font-display text-4xl font-black">{liga.nome}</h1>
        <p className="mt-2 text-sm font-semibold text-white/70">{categoria.nome}</p>
      </section>
      <FormularioInscricaoRapida
        ligaId={liga.id}
        nomeCampeonato={liga.nome}
        config={config}
        categoriaFixa={{ categoria: categoria.codigo, serie: 'GERAL', label: categoria.nome }}
        categoriaOptions={[]}
        tokenCategoria={token}
      />
    </main>
  )
}
