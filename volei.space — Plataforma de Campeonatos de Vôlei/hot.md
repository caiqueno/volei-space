---
title: >-
  Hot cache da sessão
category: area
tags: [hot, llm-wiki]
sources: [repo:athrios/volei-space]
summary: >-
  Grupos e mata-mata gravam a categoria. A importação Winners usa o HTTP do app. A simulação chega ao campeão.
status: misto
created: 2026-09-25
updated: 2026-10-09
---

# Hot

## Foco atual

A geração de grupos, o mata-mata e o calendário automático passam a gravar `categoriaCampeonatoId` e `serie` nula. Sem isso o gatilho recusa a partida. `Partida.atualizadoEm` ganha default `now()` na migration `202610090004_partida_atualizado_em_default.sql`, ainda não aplicada em produção. O prefixo `202610090001` continua sendo a revogação de EXECUTE. O `GET` da estrutura devolve `sumulaToken`. O script `scripts/import-winners.mjs` cria Winners Oficial, Winners Teste e Winner QA pelo HTTP do app: inscrição aprovada, grupos, súmula e mata-mata em jogo único. A confirmação simulada de pagamento sai da sessão de administrador, porque o organizador não confirma com o gateway desligado. No Winners Teste o campeão sai da final, e finalizar exige essa final e o 3º lugar. A tabela continua só com a fase de grupos. O script não foi executado neste merge. Fonte: [[modulos/GRUPOS]], [[modulos/MATA-MATA]], [[modulos/PARTIDAS]].

Em 9 de outubro de 2026 a lógica de servidor do campeonato foi revista até o campeão, sem UI, sem Prisma e sem migration. `recalculateLeagueClassification` grava `src/lib/classificacao.ts`: faixa de 1 set ou de 2 ou mais, fase de grupos apenas, set já fechado no saldo dos dois lados e WO. A RPC `recalcular_classificacao_liga` da migration atômica ficou de fora porque ainda usa 4/3/1/0 e mistura o mata-mata; o banco precisa repetir essa regra dentro do `pg_advisory_xact_lock`. Os classificados do chaveamento legado incluem os melhores gerais, e a final (e o 3º lugar, quando ligado) precisa estar decidida para `POST .../finalizar`. A súmula oficial aceita correção por 30 minutos, sem renovar `sumulaAprovadaEm`, recusa a 9ª substituição e, se a gravação quebra, tenta restaurar o conteúdo anterior. A simulação em `scripts/campeonato-completo.test.ts` cria grupos, joga, classifica, avança a chave e aponta o campeão. Não houve chamada a produção. Fonte: [[modulos/CLASSIFICACAO]], [[modulos/MATA-MATA]], [[modulos/SUMULA-DIGITAL]].

A suíte de 10 de outubro de 2026 cobre o contrato da API e o Playwright sem banco remoto. Os scripts usam `scripts/with-ts-node.mjs`. O CI de testes sobe Postgres 16 só no job e gera o client Prisma antes de `npm test`.

Endurecimento de autenticação em 9 de outubro de 2026, junto da correção de segurança do back-end, sem migration nova. O JWT de administrador tem `scope: admin`, `typ: admin` e audiência `volei-admin`. Recuperação, sessão pública e ativação têm audiência e tipo próprios. Token com `purpose` não abre sessão. O reset guarda fingerprint HMAC da senha, não o hash bcrypt. `ADMIN_EMAIL` é obrigatório em produção e no preview; no `next dev` local a tabela `Admin` continua valendo. O login usa «Usuário ou senha não conferem.» antes da senha conferir, limita 30 tentativas por IP e 8 por IP e e-mail, e não devolve o JWT. A recuperação limita 5 pedidos por IP e 3 por e-mail a cada hora. O logout limpa `luva_token` com os mesmos atributos do cookie. `ILIKE` de e-mail escapa `%` e `_`. O webhook InfinitePay recusa chamada sem segredo fora do dev local, confere valor (reais ou centavos do valor gravado, sem o caminho inverso) e vínculo com `Pagamento`, e não transforma erro de banco em 200. A massa de QA exige sessão de administrador. Quadras do organizador ficam restritas aos campeonatos dele. Súmula e árbitro não leem CPF, documento, telefone nem QR do atleta. O GET da inscrição rápida mascara CPF e nascimento, e concluir a inscrição troca o token. Partida nova ou editada só aceita equipes da própria liga, e o PUT grava uma lista fechada de campos e recalcula a categoria. Rotas de liga não devolvem `err.message`. A súmula tenta restaurar o conteúdo se a gravação quebra no meio; a transação única continua pendente no banco. `?consulta=1` segue público de propósito. Tokens demo da súmula não respondem em produção. A confirmação simulada de pagamento segue desligada por padrão. Fonte: [[07-SEGURANCA]], [[modulos/PAGAMENTOS]], [[modulos/SUMULA-DIGITAL]].

A camada de API fechou confirmação simulada de pagamento, webhook sem segredo, login que revelava administrador e consultas públicas de equipe com `select` aberto.

O script idempotente `scripts/seed-torneio-jogadores-2026.sql` descreve o elenco da massa `TOURNAMENT-SEED-2026` (12 jogadores por equipe e presença na súmula). Essa carga já tinha sido aplicada em produção antes deste merge; o SQL não foi executado de novo. Fonte: [[06-BANCO-DE-DADOS]].

Auditoria de deploy em 9 de outubro de 2026: o build é `prisma generate && next build`, o Node na Vercel fica em 22.x, e o CI cobre install, generate, validate, lint, typecheck e build. `npm run db:migrate` só aceita `DIRECT_URL` na porta 5432. Não há `prisma/migrations`; nada disso reaplica `supabase/migrations` em produção.

Correções só de interface, sem API nem banco. O cabeçalho e o rodapé mostram «volei.space». Fora da home, o cabeçalho reserva 72px até ler a sessão. Nova partida trata falha de rede e resposta que não é JSON, mostra erro e carregamento de campeonatos e equipes, busca as equipes uma vez e lista as categorias em `GET /api/categorias?ligaId=`. A inscrição da equipe não deixa o botão preso se a rede cair, avisa quando a sessão não tem equipe e separa erro de sucesso. Sair no admin reutiliza `encerrarSessaoPublica()`. Aprovar súmula não chama falha de conexão quando o corpo não é JSON.

O histórico SQL ficou ordenado para a CLI. Trinta e cinco arquivos `supabase-*.sql` receberam prefixo anterior a `202610060004` e `202610060005`, então nenhum grant a `anon` ou `authenticated` corre depois do fechamento. Produção e desenvolvimento já receberam esse SQL à mão: `supabase migration repair --status applied` é obrigatório antes de `db push`. Quatro migrations novas ainda não foram aplicadas, nesta ordem: `202610090001` tira o EXECUTE global de `PUBLIC` dos default privileges de `postgres` (o revoke dentro do schema não faz isso) e deixa `service_role`; `202610090002` cria os índices de chave estrangeira que faltavam; `202610090003` garante a unicidade `(ligaId, equipeId)` em `ClassificacaoEntrada` sem apagar linha; `202610090004` define `default now()` em `Partida.atualizadoEm`. A mesma equipe joga em mais de uma liga. `SetPartida.partidaId` já é a primeira coluna da unicidade `(partidaId, numero)`. As policies de leitura do Realtime estão nos arquivos agora versionados `202609200020` e `202609200021`; o `GRANT` de `202610060004` limita as colunas de `Partida` e não inclui `sumulaToken`. `prisma/schema.prisma` descreve esse banco. Não há `prisma/migrations`. `setup-db.mjs` saiu. Nada foi executado em banco real. Fonte: [[06-BANCO-DE-DADOS]].

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
