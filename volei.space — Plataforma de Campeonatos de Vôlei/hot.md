---
title: >-
  Hot cache da sessão
category: area
tags: [hot, llm-wiki]
sources: [repo:athrios/volei-space]
summary: >-
  A simulação de servidor chega ao campeão. A tabela não usa mais a RPC antiga.
status: misto
created: 2026-09-25
updated: 2026-10-09
---

# Hot

## Foco atual

Em 9 de outubro de 2026 a lógica de servidor do campeonato foi revista até o campeão, sem UI, sem Prisma e sem migration. `recalculateLeagueClassification` grava `src/lib/classificacao.ts`: faixa de 1 set ou de 2 ou mais, fase de grupos apenas, set já fechado no saldo dos dois lados e WO. A RPC `recalcular_classificacao_liga` da migration atômica ficou de fora porque ainda usa 4/3/1/0 e mistura o mata-mata; o banco precisa repetir essa regra dentro do `pg_advisory_xact_lock`. Os classificados do chaveamento legado incluem os melhores gerais, e a final (e o 3º lugar, quando ligado) precisa estar decidida para `POST .../finalizar`. A súmula oficial aceita correção por 30 minutos e recusa a 9ª substituição. A simulação em `scripts/campeonato-completo.test.ts` cria grupos, joga, classifica, avança a chave e aponta o campeão. Não houve chamada a produção. Fonte: [[modulos/CLASSIFICACAO]], [[modulos/MATA-MATA]], [[modulos/SUMULA-DIGITAL]].

## Key Takeaways

- A triagem de 4 de outubro de 2026 está na `main`. O portal por campeonato, a galeria e o botão Finalizar só em campeonato ativo entram na `main` em 5 de outubro.
- Em 5 de outubro a produção ganhou a função `selecionar_categorias_campeonato`, as políticas de upload e a coluna `Midia.thumbUrl`.
- A parametrização por categoria ativa e a comparação da replicação entram na `main` junto com o portal e a galeria.
- Produção, no commit `6f9c8f6`, responde `GET /api/ping` com alvo `producao`.
- Cada vaga parametrizada tem um link em `ConviteVagaEquipe`. O painel de jogos lê o `ligaId` da URL.
- O ao vivo do operador abre no painel (`/painel?secao=aovivo`). A súmula pública é só o registro; o lançamento fica em `/sumula/{token}/lancar`.

## Abrir primeiro

1. [[synthesis/PRONTIDAO-E-APIS]]
2. [[00-INICIO]]
3. [[modulos/INSCRICOES]] se a tarefa for inscrição
