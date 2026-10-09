---
title: >-
  Hot cache da sessão
category: area
tags: [hot, llm-wiki]
sources: [repo:athrios/volei-space]
summary: >-
  A API fecha pagamento simulado, webhook e listagem pública. Build, seed e migrations seguem na main.
status: implementado
created: 2026-09-25
updated: 2026-10-09
---

# Hot

## Foco atual

A camada de API fechou confirmação simulada de pagamento, webhook sem segredo, login que revelava administrador e consultas públicas de equipe com `select` aberto.

O script idempotente `scripts/seed-torneio-jogadores-2026.sql` descreve o elenco da massa `TOURNAMENT-SEED-2026` (12 jogadores por equipe e presença na súmula). Essa carga já tinha sido aplicada em produção antes deste merge; o SQL não foi executado de novo. Fonte: [[06-BANCO-DE-DADOS]].

Auditoria de deploy em 9 de outubro de 2026: o build é `prisma generate && next build`, o Node na Vercel fica em 22.x, e o CI cobre install, generate, validate, lint, typecheck e build. `npm run db:migrate` só aceita `DIRECT_URL` na porta 5432. Não há `prisma/migrations`; nada disso reaplica `supabase/migrations` em produção.

Correções só de interface, sem API nem banco. O cabeçalho e o rodapé mostram «volei.space». Fora da home, o cabeçalho reserva 72px até ler a sessão. Nova partida trata falha de rede e resposta que não é JSON, mostra erro e carregamento de campeonatos e equipes, busca as equipes uma vez e lista as categorias em `GET /api/categorias?ligaId=`. A inscrição da equipe não deixa o botão preso se a rede cair, avisa quando a sessão não tem equipe e separa erro de sucesso. Sair no admin reutiliza `encerrarSessaoPublica()`. Aprovar súmula não chama falha de conexão quando o corpo não é JSON.

O histórico SQL ficou ordenado para a CLI. Trinta e cinco arquivos `supabase-*.sql` receberam prefixo anterior a `202610060004` e `202610060005`, então nenhum grant a `anon` ou `authenticated` corre depois do fechamento. Produção e desenvolvimento já receberam esse SQL à mão: `supabase migration repair --status applied` é obrigatório antes de `db push`. Três migrations novas ainda não foram aplicadas: `202610090001` tira o EXECUTE global de `PUBLIC` dos default privileges de `postgres` (o revoke dentro do schema não faz isso) e deixa `service_role`; `202610090002` cria os índices de chave estrangeira que faltavam; `202610090003` garante a unicidade `(ligaId, equipeId)` em `ClassificacaoEntrada` sem apagar linha. A mesma equipe joga em mais de uma liga. `SetPartida.partidaId` já é a primeira coluna da unicidade `(partidaId, numero)`. As policies de leitura do Realtime estão nos arquivos agora versionados `202609200020` e `202609200021`; o `GRANT` de `202610060004` limita as colunas de `Partida` e não inclui `sumulaToken`. `prisma/schema.prisma` descreve esse banco. Não há `prisma/migrations`. `setup-db.mjs` saiu. Nada foi executado em banco real. Fonte: [[06-BANCO-DE-DADOS]].

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
