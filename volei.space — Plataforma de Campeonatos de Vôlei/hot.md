---
title: >-
  Hot cache da sessão
category: area
tags: [hot, llm-wiki]
sources: [repo:athrios/volei-space]
summary: >-
  A migration 202610100001 fecha a leitura pública de sets e classificação. Ela ainda não foi aplicada.
status: misto
created: 2026-09-25
updated: 2026-10-10
---

# Hot

## Foco atual

Em 10 de outubro de 2026 a leitura pública de `SetPartida` e `ClassificacaoEntrada` fecha na migration `202610100001_fechar_leitura_publica_placar.sql`, ainda não aplicada. Ela liga o RLS, remove as policies `USING (true)`, revoga `anon` e `authenticated` e repete o revoke dos default privileges para `postgres` e, se o papel puder, para `supabase_admin`. Placar e tabela continuam nas APIs com `service_role`. O navegador consulta essas APIs a cada 4 segundos. O aviso do Realtime nessas duas tabelas para quando a migration entrar. `Partida` segue com SELECT das colunas de placar. A função `finalizar_inscricao_equipe_rascunho` volta a ler `inscricaoAprovacaoAutomatica` só depois dessa migration. Até lá o SQL já instalado grava `APROVADA`. O `POST /api/inscricoes-campeonato` já respeita a flag, e o rascunho não força mais `APROVADA` por cima do retorno.

`GET /api/equipes` e `GET /api/rankings` montam liga, elenco e votos no servidor. O embed quebrava porque o histórico não cria `Equipe_ligaId_fkey` nem `VotoMVP_jogadorId_fkey`. A lista anônima de equipes fica nos campeonatos públicos, fora de simulação. `GET /api/ligas` e `GET /api/ligas/[slug]` devolvem colunas explícitas, sem `organizadorId` nem `seedKey`. Erros de inscrição rápida, rascunho, setup, calendário, estrutura e mata-mata ficam no log. O id numérico da partida não abre a operação do árbitro sem o cookie do link exclusivo. `ADMIN_EMAIL` já era obrigatório em produção e no preview; o exemplo deixa de tratá-la como opcional.

As migrations `202610090001` a `202610090004` e a `202610100001` continuam fora dos bancos. Nada deste lote foi executado em produção. Fonte: [[07-SEGURANCA]], [[06-BANCO-DE-DADOS]], [[modulos/INSCRICOES]].

## Key Takeaways

- Publique o código antes da migration. Faça backup de `SetPartida` e `ClassificacaoEntrada` e aplique só `202610100001`.
- A inscrição pelo `POST` nasce `SOLICITADA` quando a aprovação automática está desligada. Uma inscrição já `APROVADA` não volta para trás.
- O árbitro entra pelo token de `AcessoArbitroJogo`. A conta escalada usa o `sumulaToken`.

## Abrir primeiro

1. [[07-SEGURANCA]]
2. [[06-BANCO-DE-DADOS]]
3. [[modulos/INSCRICOES]]

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
