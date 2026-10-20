import { PortaEntrada } from '@/components/inscricao-entrada/PortaEntrada'
import { inscricaoViaMeuTimeAtiva } from '@/lib/inscricao-entrada-ui/regras'
import { EstadoVazio } from '@/components/ui/EstadoVazio'
import { FormularioInscricaoRapida } from '@/components/inscricao-rapida/FormularioInscricaoRapida'
import { resolveFormularioRapidaConfig, resolveInscricaoCategoria } from '@/lib/inscricao-rapida'
import { carregarInscricaoPorToken, periodoInscricao, registrarEventoInscricao } from '@/lib/link-inscricao-campeonato'

export const dynamic = 'force-dynamic'

export default async function InscricaoCampeonatoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (inscricaoViaMeuTimeAtiva()) return <PortaEntrada token={token} />
  const contexto = await carregarInscricaoPorToken(token)
  if (contexto.falha || !contexto.link || !contexto.liga || contexto.liga.simulacao === true) {
    return (
      <main className="luva-shell min-h-screen px-4 py-12 text-white">
        <EstadoVazio titulo="Link de inscrição inválido" descricao="Peça ao organizador o link de inscrição deste campeonato." />
      </main>
    )
  }
  if (!contexto.link.ativo || contexto.link.revogadoEm) {
    return (
      <main className="luva-shell flex min-h-screen items-center justify-center px-4 text-white">
        <section className="max-w-lg">
          <h1 className="font-display text-4xl font-black">Inscrições indisponíveis</h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-white/75">As inscrições para este campeonato estão encerradas ou temporariamente indisponíveis.</p>
        </section>
      </main>
    )
  }

  const periodo = periodoInscricao(contexto.liga)
  if (periodo === 'antes') {
    return (
      <main className="luva-shell flex min-h-screen items-center justify-center px-4 text-white">
        <section className="max-w-lg">
          <h1 className="font-display text-4xl font-black">Inscrições ainda não abertas</h1>
          <p className="mt-3 text-sm font-semibold text-white/75">{contexto.liga.nome}</p>
        </section>
      </main>
    )
  }
  if (periodo !== 'aberto') {
    return (
      <main className="luva-shell flex min-h-screen items-center justify-center px-4 text-white">
        <section className="max-w-lg">
          <h1 className="font-display text-4xl font-black">Inscrições encerradas</h1>
          <p className="mt-3 text-sm font-semibold text-white/75">{contexto.liga.nome}</p>
        </section>
      </main>
    )
  }

  await registrarEventoInscricao({ ligaId: contexto.liga.id, linkId: contexto.link.id, tipo: 'LINK_INSCRICAO_ACESSADO', resultado: 'ok' })
  const config = resolveFormularioRapidaConfig(contexto.liga.formularioInscricaoConfig)
  const { categoriaFixa, categoriaOptions } = resolveInscricaoCategoria(contexto.liga)

  return (
    <main className="luva-shell min-h-screen px-4 py-10 text-white">
      <section className="mx-auto mb-6 max-w-3xl">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-luva-amber">Inscrição de equipe</p>
        <h1 className="mt-2 font-display text-4xl font-black">{contexto.liga.nome}</h1>
        <p className="mt-2 text-sm font-semibold text-white/70">Vôlei</p>
      </section>
      <FormularioInscricaoRapida
        ligaId={contexto.liga.id}
        linkToken={token}
        nomeCampeonato={contexto.liga.nome}
        config={config}
        categoriaFixa={categoriaFixa}
        categoriaOptions={categoriaOptions}
      />
    </main>
  )
}
