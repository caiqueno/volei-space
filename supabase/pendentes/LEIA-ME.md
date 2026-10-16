# Migrations pendentes (não aplicadas)

Esta pasta guarda as migrations da Fase 0 escritas pelo agente de banco, com a reversão de cada uma em `rollback/`. Elas **não** estão em `supabase/migrations/` de propósito:

- Nenhuma delas foi executada em banco algum, nem parseada por um Postgres. O primeiro ensaio pode achar erro de sintaxe.
- O teste `scripts/rls-publico.test.mjs` da equipe proíbe migrations novas que criem tabela ou concedam leitura a `anon` depois da migration de RLS. Várias destas criam tabelas (com RLS ligada, sem grant) e uma concede `select` na view `jogador_publico`. Elas só devem entrar na pasta oficial junto com uma decisão consciente sobre essa regra.
- Cada aplicação exige aprovação do dono, backup e janela fora de rodada.

Rodada 2: a inscrição passou a ser automática (`Inscricao.status` = RASCUNHO, CONFIRMADA, CONFIRMADA_COM_PENDENCIAS, AJUSTE_PEDIDO, REMOVIDA, mais `avisos jsonb`) e as migrations foram revisadas; oito índices (0005, 0007, 0008, 0010, 0011, 0012, 0015, 0016) duplicam `supabase/migrations/202610090002` e podem ser descartados. Detalhes, baseline e checklist em `docs/analise/22-baseline-e-aplicacao.md`. Teste estático: `npm run test:migracoes-pendentes`.

Para aplicar uma delas: siga a ordem e as verificações de `docs/analise/16-plano-aplicacao-migrations.md`, rode antes as consultas de leitura Q1 a Q13, mova o arquivo para `supabase/migrations/` e ajuste o teste se necessário.
