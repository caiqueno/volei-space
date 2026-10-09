---
title: >-
  Banco de dados
category: area
tags: [dados]
sources: [repo:athrios/volei-space]
summary: >-
  Entidades e relações.
status: implementado
created: 2026-09-20
updated: 2026-10-09
---
# Modelo de dados

`prisma/schema.prisma` descreve entidades; `supabase/migrations` documenta mudanças SQL e políticas. Confira o estado aplicado ao banco antes de concluir que uma coluna ou policy está ativa. Não há pasta `prisma/migrations`. `npm run db:migrate` confere `DIRECT_URL` (porta 5432, sem `pgbouncer=true`) e não reexecuta o SQL histórico. `DATABASE_URL` é o pooler de transação (porta 6543) e não aplica migration. `prisma db push` não faz parte do fluxo de produção.

O projeto `volei-space-producao` é a base de produção e só pode ser usado no deploy da branch `main`. Local, preview e qualquer outra branch usam o projeto `caiqueno's Project`. A ligação é feita pelas variáveis do ambiente, não por endereço fixo no código. No Next.js elas são `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_ALVO` (`producao` ou `desenvolvimento`) e, só no servidor, `SUPABASE_SERVICE_ROLE_KEY`. `SUPABASE_HOSTS_PROIBIDOS` lista hosts que aquele ambiente recusa. Se a configuração faltar ou misturar os alvos, as operações de banco não iniciam. O navegador recebe apenas a chave publicável. Várias tabelas seguem sem RLS nos dois projetos; ligar RLS sem política bloqueia o cliente público. `AcessoArbitroJogo` e `AcessoArbitroEvento` têm RLS ligada e nenhuma política para `anon` ou `authenticated`. Só o papel `service_role` lê e grava essas tabelas.

A migration `202610060004_fechar_acesso_anonimo.sql` tira de `anon` e `authenticated` todo acesso ao schema `public`, inclusive nos objetos criados depois, e devolve apenas três leituras: `ClassificacaoEntrada` inteira, `SetPartida` inteira e as colunas de placar de `Partida` (sem `sumulaToken` e sem `sumulaTokenExpira`). É o mínimo que o Realtime do placar e da classificação precisa. Antes dela a chave publicável lia `Partida.sumulaToken`, lia `Jogador` inteiro e era aceita em `PATCH /rest/v1/Partida`. Todo acesso de servidor passou a usar `supabaseAdmin`; no navegador sobraram o Realtime e os uploads de storage.

`revoke ... from anon, authenticated` não alcança a concessão que o Postgres dá a `PUBLIC` quando a função é criada. Por isso a chave publicável continuava chamando `/rest/v1/rpc/recalcular_classificacao_liga` e recalculando a tabela de qualquer campeonato sem sessão. A migration `202610060005_fechar_rpc_anonimo.sql` percorre as funções do schema `public` que não pertencem a extensão, revoga de `public`, `anon` e `authenticated`, e concede `execute` ao `service_role`. Função de gatilho não perde nada: o `EXECUTE` é conferido na criação do gatilho, não a cada disparo.

As três migrations estão aplicadas nos dois bancos. Em produção, depois delas: `sumulaToken`, `Jogador` e `Equipe` respondem 401 à chave publicável, `PATCH` em `Partida` responde 401, as RPC respondem 401, e `Partida` (colunas de placar), `SetPartida` e `ClassificacaoEntrada` seguem legíveis para o Realtime.

`LinkInscricaoCampeonato` e `LinkInscricaoEvento` guardam o token de inscrição e a auditoria. As duas tabelas têm RLS ligada, sem política para `anon` ou `authenticated`, e só `service_role` as lê. `Equipe.seedKey` e `Jogador.seedKey` identificam a massa de teste.

A massa `LINK-FLOW-2026` está nos dois bancos, sem reutilizar `SEED-CHAMP` nem `SEED-GAME`: 10 campeonatos `LINK-FLOW-CHAMP-01` a `10`, 100 equipes, 1.200 jogadores `TESTE-LINK-2026-CH##-EQ##-J###` e 400 partidas `LINK-FLOW-GAME-##-###` (100 encerradas, 200 em andamento, 100 agendadas). O campeonato 03 tem o link desativado, o 04 registra regeneração, o 05 abre as inscrições daqui a 10 dias e o 06 já encerrou o período. O campeonato 02 também tem 10 equipes, porque a massa de jogadores pede elenco em todos. O script `scripts/seed-link-flow-2026.sql` só insere `seedKey` ausente. Em produção continuam 8 ligas sem `seedKey` e a massa `TOURNAMENT-SEED-2026`.

A massa `VOLEI_SPACE_TEST_SEED_2026` fica só no banco de desenvolvimento. O comando `npm run seed:test` recusa a branch `main` e qualquer URL de produção. Os campeonatos dessa massa usam a descrição `VOLEI_SPACE_TEST_SEED_2026` e o slug `seed-2026-`. A massa `TOURNAMENT-SEED-2026` está nos dois bancos: 10 campeonatos `SEED-CHAMP-01` a `SEED-CHAMP-10` e 400 partidas `SEED-GAME-01-001` a `SEED-GAME-10-040`, com 100 encerradas, 200 em andamento e 100 agendadas. O script `scripts/seed-torneio-2026.sql` só insere o que ainda não tem `seedKey` e não apaga campeonatos reais. As duas massas deixam `simulacao` desligado, porque o portal público esconde campeonato simulado. `npm run seed:test:clean` apaga só a massa antiga e mantém `joao@teste.com.br`. O placar e a classificação públicos escutam o Realtime de `Partida`, `SetPartida` e `ClassificacaoEntrada`. A publicação de `Partida` não inclui `sumulaToken`. A identidade de réplica dessa tabela é o índice de `id` e `ligaId`, para o placar atualizar sem publicar o token. `Jogador`, presença e ocorrência ficam fora dessa publicação.

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
