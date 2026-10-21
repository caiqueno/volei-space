'use client'

import { Aviso, cartao } from '@/components/meu-time/ui'
import type { Atleta } from '@/lib/meu-time-ui/tipos'
import { elencoCompleto, exigenciasDaRegra, pendenciasDoElenco, rotuloAtalhoAtleta, textoPendencia } from '@/lib/meu-time-elenco-ui/prontidao'

type Props = {
  atletas: Atleta[]
  /** `documentosExigidos` da regra de elenco da categoria. */
  documentosExigidos?: string[]
  /** Abre o cadastro do atleta para completar. Sem ele (sem permissão), a lista é só leitura. */
  aoAbrirAtleta?: (atletaId: string) => void
}

/** "X atletas sem documento / sem foto / sem CPF", conforme o que a categoria exige, com atalho para cada atleta. */
export function PendenciasElenco({ atletas, documentosExigidos, aoAbrirAtleta }: Props) {
  const exigencias = exigenciasDaRegra(documentosExigidos)
  if (exigencias.length === 0 || atletas.length === 0) return null
  const pendencias = pendenciasDoElenco(atletas.map((a) => ({ id: a.id, nome: a.nome, temDocumento: a.temDocumento, temFoto: a.temFoto, cpf: a.cpf })), exigencias)

  return (
    <section aria-labelledby="pendencias-elenco-titulo" className={`${cartao} flex flex-col gap-3`}>
      <h2 id="pendencias-elenco-titulo" className="text-lg font-black">O que a categoria exige</h2>
      {elencoCompleto(pendencias) && <Aviso tom="is-success">Todos os atletas estão com o que a categoria exige.</Aviso>}
      {pendencias.filter((p) => p.atletas.length > 0).map((p) => (
        <details key={p.exigencia} className="rounded-xl border border-[var(--vs-border)] p-3" open={pendencias.filter((x) => x.atletas.length > 0).length === 1}>
          <summary className="min-h-[44px] cursor-pointer py-2 font-bold">{textoPendencia(p.exigencia, p.atletas.length)}</summary>
          <ul className="mt-2 flex flex-col gap-2">
            {p.atletas.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3">
                <span>{a.nome}</span>
                {aoAbrirAtleta && (
                  <button
                    type="button" onClick={() => aoAbrirAtleta(a.id)} aria-label={`${rotuloAtalhoAtleta(p.exigencia)} de ${a.nome}`}
                    className="min-h-[44px] shrink-0 rounded-xl bg-[var(--vs-gold)] px-4 text-sm font-black text-[var(--vs-on-gold)]"
                  >
                    {rotuloAtalhoAtleta(p.exigencia)}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </details>
      ))}
    </section>
  )
}
