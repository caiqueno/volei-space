'use client'

import { LinhaGrupoTabela, NUMEROS_GRUPO } from '@/components/classificacao/LinhaGrupoTabela'
import estilos from '@/components/classificacao/tabela-grupo.module.css'
import { BotaoStoriesInstagram } from '@/components/stories/BotaoStoriesInstagram'
import type { LinhaGrupo } from '@/lib/quadro-publico'
import { cartazClassificacao } from '@/lib/stories-cartaz'

export function TabelaGrupos({ nome, linhas, vagas, campeonato, logoCampeonato }: { nome: string; linhas: LinhaGrupo[]; vagas: number; campeonato?: string; logoCampeonato?: string | null }) {
  const id = `grupo-${nome.replace(/\s+/g, '-')}`
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-vs-border bg-vs-surface">
      <header className="flex items-center justify-between gap-3 border-b border-vs-border px-4 py-4">
        <h3 id={id} className="min-w-0 truncate font-display text-xl font-bold text-vs-text">{nome}</h3>
        <BotaoStoriesInstagram
          titulo={nome}
          versao={linhas.length}
          montar={({ link }) => cartazClassificacao([{ nome, linhas, vagas }], link, null, nome, campeonato, logoCampeonato)}
        />
      </header>
      <div className={estilos.rolagem}>
        <table className={estilos.tabela}>
          <caption className="sr-only">Classificação de {nome}</caption>
          <thead>
            <tr>
              <th scope="col" className={estilos.fixa}>Equipe</th>
              {NUMEROS_GRUPO.map((coluna) => (
                <th key={coluna} scope="col" className={estilos.numero}>{coluna}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha, indice) => (
              <LinhaGrupoTabela key={`${nome}-${linha.equipe}`} linha={linha} indice={indice} vagas={vagas} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
