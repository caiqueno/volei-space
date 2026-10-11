'use client'

import { LinhaGrupoTabela } from '@/components/classificacao/LinhaGrupoTabela'
import { BotaoStoriesInstagram } from '@/components/stories/BotaoStoriesInstagram'
import type { LinhaGrupo } from '@/lib/quadro-publico'
import { cartazClassificacao } from '@/lib/stories-cartaz'

export function TabelaGrupos({ nome, linhas, vagas, campeonato }: { nome: string; linhas: LinhaGrupo[]; vagas: number; campeonato?: string }) {
  return (
    <section aria-labelledby={`grupo-${nome}`} className="rounded-2xl border border-vs-border bg-vs-surface">
      <header className="flex items-center justify-between gap-3 border-b border-vs-border px-4 py-4">
        <h3 id={`grupo-${nome}`} className="min-w-0 truncate font-display text-xl font-bold text-vs-text">{nome}</h3>
        <BotaoStoriesInstagram
          titulo={nome}
          versao={linhas.length}
          montar={({ link }) => cartazClassificacao([{ nome, linhas, vagas }], link, null, nome, campeonato)}
        />
      </header>
      <table data-stack className="w-full text-sm text-vs-text">
        <caption className="sr-only">Classificação de {nome}</caption>
        <thead className="max-md:hidden">
          <tr className="border-b border-vs-border text-left text-xs font-bold uppercase tracking-[0.08em] text-vs-muted">
            {['#', 'Equipe', 'P', 'J', 'V', 'D', 'SP', 'SC', 'DS', 'DP', 'PE'].map((coluna) => (
              <th key={coluna} className={`px-2 py-3 ${coluna === '#' || coluna === 'Equipe' ? '' : 'text-right'}`}>{coluna}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha, indice) => (
            <LinhaGrupoTabela key={`${nome}-${linha.equipe}`} linha={linha} indice={indice} classifica={vagas > 0 && indice < vagas} />
          ))}
        </tbody>
      </table>
    </section>
  )
}
