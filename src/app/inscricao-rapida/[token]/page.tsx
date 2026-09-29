export const dynamic = 'force-dynamic'

import { EstadoVazio } from '@/components/ui/EstadoVazio'
import { FormularioInscricaoRapida } from '@/components/inscricao-rapida/FormularioInscricaoRapida'
import { resolveFormularioRapidaConfig, resolveInscricaoCategoria } from '@/lib/inscricao-rapida'
import { getRegistrationDraftByToken, RegistrationDraftError } from '@/lib/team-registration-draft'

type PageProps = { params: Promise<{ token: string }> }

export default async function InscricaoRapidaTokenPage({ params }: PageProps) {
  const { token } = await params
  try {
    const context = await getRegistrationDraftByToken(token)
    const config = resolveFormularioRapidaConfig(context.liga.formularioInscricaoConfig)
    const { categoriaFixa, categoriaOptions } = resolveInscricaoCategoria(context.liga)

    return (
      <FormularioInscricaoRapida
        ligaId={context.liga.id}
        nomeCampeonato={context.liga.nome}
        config={config}
        categoriaFixa={categoriaFixa}
        categoriaOptions={categoriaOptions}
        token={token}
        initialData={{
          nomeEquipe: context.draft.nomeEquipe,
          logoUrl: context.draft.logoUrl,
          lider: context.draft.lider,
          tecnico: context.draft.tecnico,
          categoria: context.draft.categoria,
          serie: context.draft.serie,
          status: context.draft.status === 'CONCLUIDO' || context.draft.status === 'ENVIADA' ? 'ENVIADA' : 'RASCUNHO',
          jogadores: context.players,
        }}
        canEdit={context.canEdit}
        canEditRoster={context.canEditRoster}
        readOnlyReason={context.readOnlyReason}
        registrationStatus={context.registrationStatus}
      />
    )
  } catch (err) {
    const description = err instanceof RegistrationDraftError ? err.message : 'Não foi possível carregar esta inscrição agora.'
    return <main className="luva-shell min-h-screen px-4 py-12"><EstadoVazio titulo="Inscrição não encontrada" descricao={description} /></main>
  }
}
