---
title: >-
  Banco de dados
category: area
tags: [dados]
sources: [repo:athrios/volei-space]
summary: >-
  TOURNAMENT-SEED em produção tem 960 jogadores e presença na súmula.
status: implementado
created: 2026-09-20
updated: 2026-10-02
---
# Modelo de dados

`prisma/schema.prisma` descreve entidades; `supabase/migrations` documenta mudanças SQL e políticas. Confira o estado aplicado ao banco antes de concluir que uma coluna ou policy está ativa.

O projeto `volei-space-producao` é a base de produção e só pode ser usado no deploy da branch `main`. Local, preview e qualquer outra branch usam o projeto `caiqueno's Project`. A ligação é feita pelas variáveis do ambiente, não por endereço fixo no código. No Next.js elas são `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_ALVO` (`producao` ou `desenvolvimento`) e, só no servidor, `SUPABASE_SERVICE_ROLE_KEY`. `SUPABASE_HOSTS_PROIBIDOS` lista hosts que aquele ambiente recusa. Se a configuração faltar ou misturar os alvos, as operações de banco não iniciam. O navegador recebe apenas a chave publicável. Várias tabelas seguem sem RLS nos dois projetos; ligar RLS sem política bloqueia o cliente público. `AcessoArbitroJogo` e `AcessoArbitroEvento` têm RLS ligada e nenhuma política para `anon` ou `authenticated`. Só o papel `service_role` lê e grava essas tabelas.

`LinkInscricaoCampeonato` e `LinkInscricaoEvento` guardam o token de inscrição e a auditoria. As duas tabelas têm RLS ligada, sem política para `anon` ou `authenticated`, e só `service_role` as lê. `Equipe.seedKey` e `Jogador.seedKey` identificam a massa de teste.

A massa `LINK-FLOW-2026` está nos dois bancos, sem reutilizar `SEED-CHAMP` nem `SEED-GAME`: 10 campeonatos `LINK-FLOW-CHAMP-01` a `10`, 100 equipes, 1.200 jogadores `TESTE-LINK-2026-CH##-EQ##-J###` e 400 partidas `LINK-FLOW-GAME-##-###` (100 encerradas, 200 em andamento, 100 agendadas). O campeonato 03 tem o link desativado, o 04 registra regeneração, o 05 abre as inscrições daqui a 10 dias e o 06 já encerrou o período. O campeonato 02 também tem 10 equipes, porque a massa de jogadores pede elenco em todos. O script `scripts/seed-link-flow-2026.sql` só insere `seedKey` ausente. Em produção continuam 8 ligas sem `seedKey` e a massa `TOURNAMENT-SEED-2026`.

A massa `VOLEI_SPACE_TEST_SEED_2026` fica só no banco de desenvolvimento. O comando `npm run seed:test` recusa a branch `main` e qualquer URL de produção. Os campeonatos dessa massa usam a descrição `VOLEI_SPACE_TEST_SEED_2026` e o slug `seed-2026-`. A massa `TOURNAMENT-SEED-2026` está nos dois bancos: 10 campeonatos `SEED-CHAMP-01` a `SEED-CHAMP-10`, 80 equipes com `seedKey` `SEED-CHAMP-##-EQ##`, 960 jogadores `TESTE-SEED-2026-CH##-EQ##-J###` e 400 partidas `SEED-GAME-01-001` a `SEED-GAME-10-040`, com 100 encerradas, 200 em andamento e 100 agendadas. O script `scripts/seed-torneio-2026.sql` só insere o que ainda não tem `seedKey` e não apaga campeonatos reais. O elenco e a presença da súmula vêm de `scripts/seed-torneio-jogadores-2026.sql`, também idempotente. Em produção, essa carga de jogadores e presenças já foi aplicada. As duas massas deixam `simulacao` desligado, porque o portal público esconde campeonato simulado. `npm run seed:test:clean` apaga só a massa antiga e mantém `joao@teste.com.br`. O placar ao vivo do portal é relido por consulta periódica; `Partida` e `SetPartida` não estão na publicação Realtime.

## Relações centrais

- Organizador → campeonatos (`Liga` no código).
- Campeonato → configuração de categorias, inscrições, partidas e estrutura competitiva.
- Inscrição → equipe (`Equipe`) → atletas (`Jogador`).
- Partida → sets (`SetPartida`), presenças (`SumulaPresenca`), ocorrências/scouts (`OcorrenciaPartida`) e destaques (`DestaquesPartida`).
- Campeonato → entradas da classificação calculada e grupos/chaveamentos.

`categoriasConfig` é configuração do campeonato; não presuma que «categoria» já corresponde a tabela própria. O requisito de convites por categoria exige escopo persistente mesmo antes da criação da equipe. Ver [[modulos/INSCRICOES]].

## Modelo-alvo de categorias — aprovado, pendente

`Liga` deverá conter registros próprios de `CategoriaCampeonato`. A quantidade declarada na parametrização precisa corresponder aos registros persistidos, que são a fonte de verdade. Convites e inscrições devem guardar no servidor o par `ligaId` + `categoriaCampeonatoId`; equipes, grupos, rodadas, partidas, classificação, classificados, chaveamento, scouts, rankings e resultados devem relacionar-se por `categoriaCampeonatoId` sempre que aplicável. Nenhuma dessas relações é aqui declarada existente. Campos textuais atuais de categoria e série exigem migração explícita e podem causar mistura entre categorias. Ver [[references/CATEGORIAS-COMO-COMPETICOES]].

## Invariantes

Uma equipe, inscrição, partida ou token deve ser verificado no campeonato correto. Resultado alterado exige recálculo de classificação e scouts relacionados. Para a súmula corrigível, preservar histórico e atomicidade da gravação; ver [[07-SEGURANCA]] e [[modulos/SUMULA-DIGITAL]].

No modelo-alvo, validar também a categoria persistida em toda leitura, gravação e recálculo competitivo; a integridade do campeonato isoladamente não garante isolamento entre categorias.
