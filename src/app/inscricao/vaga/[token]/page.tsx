export const dynamic = 'force-dynamic'
export const revalidate = 0

import { unstable_noStore as noStore } from 'next/cache'
import { PortaEntrada } from '@/components/inscricao-entrada/PortaEntrada'
import { inscricaoViaMeuTimeAtiva } from '@/lib/inscricao-entrada-ui/regras'
import { EstadoVazio } from '@/components/ui/EstadoVazio'
import { FormularioInscricaoRapida } from '@/components/inscricao-rapida/FormularioInscricaoRapida'
import { resolveFormularioRapidaConfig } from '@/lib/inscricao-rapida'
import { RegistrationDraftError } from '@/lib/team-registration-draft'
import { abrirInscricaoDaVaga } from '@/lib/vaga-inscricao'

export default async function InscricaoVagaPage({ params }: { params: Promise<{ token: string }> }) {
  noStore()
  const { token } = await params
  if (inscricaoViaMeuTimeAtiva()) return <PortaEntrada token={token} />
  try {
    const contexto = await abrirInscricaoDaVaga(token)
    const config = resolveFormularioRapidaConfig(contexto.liga.formularioInscricaoConfig)
    return (
      <main className="luva-shell min-h-screen px-4 py-10 text-white">
        <section className="mx-auto mb-6 max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-luva-amber">Inscrição da equipe</p>
          <h1 className="mt-2 font-display text-4xl font-black">{contexto.liga.nome}</h1>
          <p className="mt-2 text-sm font-semibold text-white/70">{contexto.categoria.nome}</p>
        </section>
        <FormularioInscricaoRapida
          ligaId={contexto.liga.id}
          nomeCampeonato={contexto.liga.nome}
          config={config}
          categoriaFixa={{ categoria: contexto.categoria.codigo, serie: 'GERAL', label: contexto.categoria.nome }}
          categoriaOptions={[]}
          token={contexto.draft.token}
          initialData={{
            nomeEquipe: contexto.draft.nomeEquipe,
            logoUrl: contexto.draft.logoUrl,
            lider: contexto.draft.lider,
            tecnico: contexto.draft.tecnico,
            categoria: contexto.categoria.codigo,
            serie: 'GERAL',
            status: contexto.draft.status === 'CONCLUIDO' || contexto.draft.status === 'ENVIADA' ? 'ENVIADA' : 'RASCUNHO',
            jogadores: contexto.players,
          }}
          canEdit={contexto.canEdit}
          canEditRoster={contexto.canEditRoster}
          readOnlyReason={contexto.readOnlyReason}
          registrationStatus={contexto.registrationStatus}
          elegibilidade={contexto.elegibilidade}
        />
      </main>
    )
  } catch (falha) {
    const descricao = falha instanceof RegistrationDraftError ? falha.message : 'Não foi possível abrir esta inscrição agora.'
    return (
      <main className="luva-shell min-h-screen px-4 py-12 text-white">
        <EstadoVazio titulo="Link de inscrição indisponível" descricao={descricao} />
      </main>
    )
  }
}
