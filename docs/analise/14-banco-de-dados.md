# 14. Banco de dados: auditoria, modelo "Meu Time", log da súmula e seed local

Agente: `banco-de-dados`. Somente leitura de `supabase/migrations` (52 arquivos), `prisma/schema.prisma`, `setup-db.mjs`, `package.json`, `scripts/seed-*.sql` e `src` (chamadas `.from()` e `.rpc()`). Nenhuma conexão com banco, nenhuma migration criada ou aplicada, nenhum SQL executado. Todo o SQL abaixo é **proposta de documento**: não foi parseado nem testado em Postgres. Deve ser ensaiado primeiro em banco local ou de preview restaurado de backup e só então virar arquivo em `supabase/migrations`, quando o usuário pedir.

Legenda: **[claro]** vem do SQL versionado e vale mesmo sem o banco · **[a verificar]** depende do que foi realmente aplicado (o repositório não prova o que rodou no SQL Editor; `06-BANCO-DE-DADOS.md` manda conferir) · **[proposta]** não existe hoje.

Fontes: `docs/analise/01-diagnostico-volei-space.md`, `docs/PROMPT-volei-space.md` (seções "Experiência prioritária" e "Modelo de dados de referência"), `06-BANCO-DE-DADOS.md`, `CLAUDE.md`. N+1 e consultas lentas reais não foram medidos (exige `pg_stat_statements` do banco real).

## Resumo executivo

1. O DDL do banco **não é reproduzível**: faltam os `CREATE TABLE` do núcleo (vieram de `prisma db push`) e a ordem alfabética dos arquivos roda o lote `2026…` antes dos `supabase-*.sql` dos quais ele depende.
2. As migrations se contradizem sobre RLS e grants de `anon`. Há quatro riscos P0 que só o banco real confirma (D1 a D4): escrita anônima em `Liga/Equipe/Partida`, leitura anônima de hash de senha e de CPF/documentos de atletas (inclusive menores), bucket de documentos público com escrita anônima.
3. O Prisma está defasado em 9 tabelas e dezenas de colunas; a fonte de verdade é o SQL, mas o SQL também está incompleto (seção 2).
4. Não existe "atleta" como identidade: `Jogador` pertence a uma `Equipe`, que pertence a uma `Liga` e a uma categoria. O mesmo atleta é recriado a cada inscrição. A seção 3 propõe `atleta`, `clube`, `time_clube`, `inscricao` com cópia da lista, consentimento de responsável, auditoria e RLS, **sem alterar nenhuma tabela legada** (tabelas-ponte), o que garante migração sem perda.
5. A súmula não tem log de eventos (`delete`+`insert` em 5 tabelas). A seção 4 propõe `partida_evento` append-only com RPC idempotente e controle de versão.

---

## 1. Auditoria do schema real

### 1.1 Inventário (o que o código realmente usa)

O runtime usa só `@supabase/supabase-js`: `.from()` em 41 tabelas e `.rpc()` em 5 funções. **[claro]**

| Grupo | Tabelas | Onde o DDL nasce |
|---|---|---|
| Núcleo | `Liga`, `Equipe`, `Jogador`, `Partida`, `SetPartida`, `SumulaPresenca`, `OcorrenciaPartida`, `DestaquesPartida`, `VotoMVP`, `ClassificacaoEntrada`, `ClassificacaoEliminatoria`, `Premiacao`, `Midia`, `Mensagem`, `InscricaoCampeonato`, `Arbitro`, `EscalaArbitro`, `Admin`, `Pagamento`, `Interessado` | **Nenhuma migration faz `CREATE TABLE`**. Vieram do `prisma db push` histórico (baseline fora do repositório). |
| Contas e candidaturas | `CandidaturaOrganizador` (`supabase-candidaturas-organizadores.sql`), `CandidaturaEquipe`, `CandidaturaArbitro` (baseline), `CandidaturaQuadra`, `CodigoAcessoOrganizador`, `ContaPublico` | misto |
| Categorias (lote 2026-09/10) | `CategoriaCampeonato`, `CategoriaConfiguracao`, `CategoriaSetupSecao`, `CategoriaReplicacaoAuditoria`, `ConviteVagaEquipe` | `2026*.sql` |
| Inscrição | `InscricaoEquipeRascunho`, `InscricaoEquipeJogadorRascunho`, `LinkInscricaoCampeonato`, `LinkInscricaoEvento`, `ConviteEquipe` (esta **sem `CREATE TABLE` em lugar nenhum**: só no Prisma e em 8 chamadas do código) | `supabase-*.sql` |
| Estrutura | `GrupoCampeonato`, `GrupoEquipeCampeonato`, `LigaLocal`, `LigaSetupSecao` | `supabase-*.sql` |
| Acesso a jogo | `AcessoArbitroJogo`, `AcessoArbitroEvento`, `CandidaturaPartidaArbitro` | `supabase-acesso-arbitro-jogo.sql` |
| Outras | `AdminAcaoHistorico` (existe no SQL, sem `.from()` no `src`), `category_sources_backfill` (tabela de trabalho que ficou no schema `public`, sem RLS) | |

RPCs chamadas pelo app: `finalizar_inscricao_equipe_rascunho`, `recalcular_classificacao_liga`, `selecionar_categorias_campeonato`, `salvar_configuracao_categoria`, `replicar_configuracao_categorias`. Existem ainda no SQL: `criar_formulario_categoria`, `editar_formulario_categoria`, `classificados_categoria`, `substituir_estrutura_categoria`, `criar_confronto_categoria`, `classificar_equipe_categoria`, `atualizar_calendario_categoria`, `recalcular_classificacao_categoria`.

### 1.2 Achados por prioridade

**P0, segurança.** Todos dependem do estado real do banco **[a verificar]**, mas o SQL versionado já basta para exigir a checagem imediata (consultas na seção 1.5).

| # | Achado | Evidência | Impacto | Correção sugerida |
|---|---|---|---|---|
| D1 | **Migrations contraditórias sobre RLS e grants de `anon`, sem ordem declarada.** `supabase-organizador-campeonatos.sql:15-34` faz `DISABLE ROW LEVEL SECURITY` em `Liga`, `Equipe`, `Partida`, `InscricaoCampeonato`, `ClassificacaoEntrada` e **concede `INSERT, UPDATE` a `anon` e `authenticated`** (mais `USAGE` nas sequences). `supabase-producao-elenco-sumula-rls.sql:52-61` e `supabase-rls-producao-permissoes-campeonatos.sql:7-28` voltam a habilitar RLS, mas **nenhum arquivo revoga** esses `INSERT/UPDATE`. `supabase-campeonato-finalizado.sql:17` diz em comentário: "neste banco `Liga` está sem row level security". | arquivos citados; `supabase-fix-cadastro-rls.sql:4-6` e `supabase-cadastro-contatos-unicos.sql:12-14` também desligam RLS de `CandidaturaEquipe/Arbitro/Quadra` | Com RLS desligada, a chave `anon` (pública no navegador) permite **alterar placar, trocar `organizadorId` de campeonato e reescrever equipes e partidas** via PostgREST. Com RLS ligada o risco some, mas só por acaso de ordem de execução. | Consultas A1 e A2. Correção: migration única e idempotente que, para cada tabela de negócio, faça `ENABLE ROW LEVEL SECURITY`, `REVOKE ALL FROM anon, authenticated` e devolva apenas `SELECT` com política. |
| D2 | **Hash de senha e contatos legíveis por `anon`.** `supabase-candidaturas-organizadores.sql:150-170` concede `SELECT, INSERT, UPDATE` a `anon` e cria a política "Organizador consulta proprio cadastro" com `using (true)`. A tabela tem `senhaHash`, e-mail e telefone (`schema.prisma:563`). Em `CandidaturaEquipe/Arbitro/Quadra` o RLS foi desligado (D1) e existe `senhaHash`. | `supabase-candidaturas-organizadores.sql:149-169` | A chave anon lê hashes bcrypt, e-mails e telefones de organizadores (e, com RLS desligada, de equipes e árbitros): ataque offline de senha e coleta de contatos. | `REVOKE SELECT ON "CandidaturaOrganizador" FROM anon, authenticated` e remover a política `using (true)`; cadastro público só por rota de servidor. Se houver evidência de leitura, rotacionar e forçar `trocarSenha`. |
| D3 | **`Jogador` legível por `anon` com PII completa, incluindo menores.** `supabase-producao-elenco-sumula-rls.sql:73-76` cria `public_read_jogadores` com `using (true)`. Políticas `FOR SELECT` somam por OR, então ela **anula** a política restritiva `luv_public_select_jogador` (`supabase-rls-producao-permissoes-campeonatos.sql:50-62`). Colunas expostas: `cpf`, `documentoNumero`, `dataNascimento`, `telefone`, `telefoneEmergencia`, `fotoRostoUrl`, `documentosUrls`, `qrCodeToken`. O diagnóstico 01 (S1) já aponta leitura anônima também pela API. O mesmo padrão `public_read_*` com `using (true)` vale para `Liga` (inclui `organizadorId`, config e campeonatos fora dos status públicos), `Equipe`, `Partida`, `SetPartida`, `SumulaPresenca`, `OcorrenciaPartida`, `DestaquesPartida`, `ClassificacaoEntrada` e `InscricaoCampeonato` (observações e status de todas as inscrições). | `supabase-producao-elenco-sumula-rls.sql:63-111` | Vazamento de CPF e documento de atletas e de menores (LGPD, art. 14). `qrCodeToken` legível permite falsificar identidade de atleta na súmula. | Remover as políticas `public_read_*` e manter só as de `luv_public_select_*`. Para o público, **view com colunas mínimas** (`id`, `nome`, `numero`, `posicao`, `equipeId`, `fotoUrl`) ou `REVOKE SELECT (cpf, ...) ON "Jogador" FROM anon`. |
| D4 | **Bucket de documentos de atletas é público e aceita escrita anônima.** `supabase-producao-elenco-sumula-rls.sql:15-47`: bucket `atleta-arquivos` com `public = true`, leitura aberta e **`INSERT` e `UPDATE` para `anon`** (a própria política se chama "temporario"). Fotos de rosto e PDFs de documentos ficam acessíveis por URL e sobrescrevíveis por qualquer pessoa. Os buckets de `supabase-storage-uploads-elenco-quadras.sql:17-37` e `supabase-admin-uploads-portal.sql:39-58` seguem o mesmo padrão. | arquivos citados | Documento de menor exposto; arquivo de outro atleta pode ser substituído. | Bucket **privado**, URL assinada de curta duração, upload via servidor ou política restrita ao caminho do usuário, sem `UPDATE` anônimo. |
| D5 | **`Partida.sumulaToken` e `Jogador.qrCodeToken` são colunas legíveis por `anon`** (via `public_read_partidas` e D3). O token é a credencial de `/sumula/[token]`. | `supabase-producao-elenco-sumula-rls.sql:78-81` | Qualquer pessoa obtém o token de qualquer partida pela API pública. A escrita ainda exige papel de árbitro (diagnóstico 01), mas a leitura de elenco e escala fica aberta. | Já existe `AcessoArbitroJogo.token` com RLS sem política (**[claro]**): parar de usar `Partida.sumulaToken` ou `REVOKE SELECT ("sumulaToken") ON "Partida" FROM anon, authenticated`. |
| D6 | **Funções `SECURITY DEFINER` antigas sem `REVOKE`.** `recalcular_classificacao_liga` é definer em `supabase-recalcular-classificacao-liga-atomico.sql:7-12`, `supabase-fix-pontuacao-classificacao.sql`, `supabase-fix-classificacao-exclui-mata-mata.sql` e `supabase-parametrizacao-campeonato.sql:225`, e **não revoga `EXECUTE` de `PUBLIC`**. O `REVOKE` só aparece em `202609220003_category_operations.sql:146`, do lote que `202609230007` (linhas 8-10) diz **não aplicado à produção**. | arquivos citados | Se o lote de categorias não foi aplicado, `anon` pode chamar `rpc/recalcular_classificacao_liga` para qualquer liga (escrita em `ClassificacaoEntrada`, custo de CPU). | Consulta A3; `REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon, authenticated` e `GRANT EXECUTE ... TO service_role` em toda função definer. |
| D7 | **Estado de produção incerto: lote de categorias possivelmente não aplicado.** `202609230007_category_elenco_sempre_vinculado.sql:8-10` diz que `202609220001..202609230006` seguem "pendentes de ensaio contra dados de produção sanitizados". Já `202610060002_finalizar_inscricao_sem_serie.sql` (posterior) depende de `categoriaCampeonatoId` e `ConviteVagaEquipe`. `06-BANCO-DE-DADOS.md` registra ainda que a produção tem "8 ligas sem `seedKey`" e as massas `TOURNAMENT-SEED-2026` e `LINK-FLOW-2026` **"nos dois bancos"**; cita `npm run seed:test`, que **não existe** em `package.json`. | arquivos citados | Código novo pode estar rodando contra banco sem as colunas (erro 500) ou a documentação está velha. Massa de teste em produção polui portal, ranking e classificação. | Consultas A4 e A5; registrar o resultado nas notas. |

**P1, integridade e operação.**

| # | Achado | Evidência | Correção |
|---|---|---|---|
| D8 | **Não é possível recriar o banco do zero.** (i) Nenhum `CREATE TABLE` para as tabelas do núcleo (seção 1.1). (ii) Ordem lexicográfica: `2026…` (`2` < `s`) roda **antes** de `supabase-*.sql`; `202609220001_category_foundation.sql:91-95` faz `ALTER TABLE "InscricaoEquipeRascunho"` e `"GrupoCampeonato"`, tabelas criadas por `supabase-inscricao-equipe-rascunho.sql` e `supabase-bloco4-grupos-tabela.sql`, que ordenam depois. (iii) Os arquivos de categoria não são idempotentes (`create table` sem `if not exists`, `add constraint` sem guarda, `begin;` próprio). (iv) `Partida.fase` é usada em `202609230004:4` e não tem `ADD COLUMN` nem campo no Prisma; `Partida.grupoId` é adicionada por `supabase-bloco4-grupos-tabela.sql:26-29` e também falta no Prisma. | Gerar baseline com `pg_dump --schema-only` de um **restore de backup**, nunca da produção ao vivo, versionar como `supabase/migrations/20261001000000_baseline.sql` e renomear as demais para timestamps ordenados. Pré-requisito do seed local (seção 5). |
| D9 | **Índices únicos conflitantes em `Jogador`.** `supabase-blocos-1-3-integridade.sql:5-7` cria `Jogador_equipeId_numero_key` em `("equipeId", numero) where numero is not null`. `supabase-jogador-numero-unico.sql:16-19` cria `Jogador_equipe_numero_ativo_unique` com `coalesce(banido,false)=false`, justamente para permitir reutilizar o número de atleta banido. O primeiro, se existir, impede esse reuso. | arquivos citados | Consulta A6. Se ambos existem, dropar o primeiro. |
| D10 | **Unicidade de equipe enfraquecida por NULL.** O Prisma declara `@@unique([nome, ligaId, categoria, serie])` (`schema.prisma:123`). `202609220001:104` torna `serie` nula; em Postgres NULL é distinto de NULL, então esse índice (se existir) **não barra mais** duas equipes de mesmo nome na mesma categoria. O substituto correto, `equipe_category_name_unique("categoriaCampeonatoId", nome)` (`202609220002:111`), só existe se o lote foi aplicado (D7) e é sensível a caixa e acento. | `schema.prisma:123`, `202609220002:111` | Verificar e propor índice em `("categoriaCampeonatoId", lower(btrim(nome)))`. |
| D11 | **Colunas de estado sem `CHECK`.** `Partida.status`, `Equipe.statusEquipe`, `InscricaoCampeonato.status`, `OcorrenciaPartida.tipo`, `Liga.status` são `text` livre no Prisma. Só `InscricaoEquipeRascunho.status`, `CategoriaCampeonato` e `CategoriaConfiguracao` têm `CHECK` (**[claro]**). | `schema.prisma:69,126-139,289` | `ADD CONSTRAINT ... CHECK (...) NOT VALID` seguido de `VALIDATE CONSTRAINT` fora de horário. |
| D12 | **FKs sem índice de apoio (prováveis).** O baseline vem de `prisma db push`, que só cria os `@@index` declarados. Pelo Prisma e pelas migrations não há índice para: `Partida("equipeAId")`, `Partida("equipeBId")`, `Jogador("equipeId")` isolado (existe só o índice parcial por número), `SumulaPresenca("jogadorId")` e `("equipeId")`, `OcorrenciaPartida("partidaId")` e `("jogadorId")`, `EscalaArbitro("arbitroId")`, `Midia("ligaId")`, `Mensagem("ligaId")`. O índice `(ligaId, categoriaCampeonatoId)` em 11 tabelas existe **só se o lote de categorias foi aplicado** (`202609220001:94`). Efeito: o `DELETE`+`INSERT` da súmula (`api/sumula/[token]/route.ts:92-114`) e os `ON DELETE CASCADE` varrem tabela inteira; o placar ao vivo relê a cada 2 s (diagnóstico 01). | Seção 1.4 (SQL) e consulta A7 para confirmar o que falta de fato. |
| D13 | **PII em texto puro e sem identidade única.** `Jogador.cpf`, `documentoNumero`, `telefone`, `telefoneEmergencia` e as cópias em `InscricaoEquipeJogadorRascunho` sem criptografia, retenção ou marca de menor. CPF não é único: `finalizar_inscricao_equipe_rascunho` faz `INSERT INTO "Jogador"` sempre novo (`202610060002:107-122`). | | Seção 3. |
| D14 | **Triggers criam efeitos colaterais em qualquer escrita.** `touch_category_operation` (`202609220003:10-30`) dispara em `INSERT/UPDATE/DELETE` de 13 tabelas, toma `pg_advisory_xact_lock` por categoria, **incrementa `revisaoOperacional`** e lança exceção sem categoria. `guard_player_team` (`:3-9`) proíbe alterar `Jogador.equipeId`. Os `trg_bloquear_*` de `supabase-campeonato-finalizado.sql:118-191` recusam escrita em filhos de campeonato `FINALIZADO`. | | **Regra para a migração (3.7): não escrever em `Equipe`, `Jogador` nem `Partida` durante backfill.** Usar tabelas-ponte novas. |
| D15 | **Funções de trigger sem `search_path` fixo** (`campeonato_esta_finalizado`, `bloquear_*`, `normalize_cadastro_phone`, `guard_unique_cadastro_contact`): risco baixo, alerta do linter do Supabase. | `supabase-campeonato-finalizado.sql:27-100` | `ALTER FUNCTION ... SET search_path = public`. |
| D16 | **Escrita não atômica da súmula e sem log** (diagnóstico 01, 4.1 itens 5 e 8). `Partida` não tem coluna de versão. | | Seção 4. |
| D17 | **Legado e tipos de chave misturados.** `category_sources_backfill` sem RLS; `AdminAcaoHistorico` sem uso; série Ouro/Prata ainda nas tabelas; PKs `integer`, `text` (`gen_random_uuid()::text`, `supabase-ids-sem-default.sql`) e `uuid`. `organizadorId` é `text` **sem FK** (`Liga`, `ConviteEquipe`, `ClassificacaoEliminatoria`, `CandidaturaArbitro`): nada impede uma liga apontar para organizador inexistente. | | Tabela `organizador` na seção 3; dropar `category_sources_backfill`. |

**Claro (independe do banco):** lista de tabelas, colunas e `CHECK` dos `2026*.sql`; todas as RPCs do lote de categorias fazem `REVOKE ... FROM public, anon, authenticated` e `GRANT ... TO service_role`; `ConviteVagaEquipe`, `AcessoArbitro*`, `Link*Inscricao*`, `InscricaoEquipe*Rascunho` e `Categoria{Configuracao,SetupSecao,ReplicacaoAuditoria}` têm RLS e `REVOKE ALL` de `anon`; `supabase-partidas-chaves-estrangeiras.sql` usa `ON DELETE CASCADE` de `Partida` para `SetPartida`, `SumulaPresenca`, `OcorrenciaPartida`, `DestaquesPartida` (e `RESTRICT` para `Equipe`/`Jogador`); `serie` virou nula.

**A verificar (precisa do banco real):** D1 a D7, a existência dos índices de D9, D10 e D12, as policies em `pg_policies`, os `GRANT` a `anon` (o Supabase concede privilégios padrão a `anon` e `authenticated` em tabelas novas do schema `public` via `ALTER DEFAULT PRIVILEGES`), os buckets e políticas de Storage ativos, se `Partida`/`SetPartida` estão na publicação Realtime (a nota diz que não) e a lista de migrations de fato aplicadas.

### 1.3 RLS, grants e RPCs: resumo por tabela (o que o SQL versionado declara)

| Tabela | RLS pelo SQL | Políticas para `anon`/`authenticated` | Observação |
|---|---|---|---|
| `Liga` | liga/desliga conflitante (D1) | `public_read_ligas using(true)` + `luv_public_select_liga` por status | a primeira anula a segunda; `INSERT/UPDATE` concedidos a anon sem revogação |
| `Equipe`, `Partida`, `InscricaoCampeonato`, `ClassificacaoEntrada` | idem | `public_read_*` `using(true)` + `luv_public_select_*` | idem |
| `Jogador` | ligada | `public_read_jogadores using(true)` | D3 |
| `SetPartida`, `SumulaPresenca`, `OcorrenciaPartida`, `DestaquesPartida` | ligada | `public_read_*` `using(true)` | leitura total |
| `VotoMVP`, `Admin`, `Pagamento`, `Arbitro`, `EscalaArbitro`, `Premiacao`, `Midia`, `Mensagem` | ligada | `Premiacao`, `Midia`, `Mensagem` com política por status; demais sem política (nega) | correto se os grants de tabela não forem usados |
| `CandidaturaEquipe/Arbitro/Quadra` | desligada por `supabase-fix-cadastro-rls.sql` e religada por `rls-producao` (ordem) | nenhuma | D1/D2 |
| `CandidaturaOrganizador` | ligada | select `using(true)`, insert com check | D2 |
| `CodigoAcessoOrganizador`, `ContaPublico` | **sem `ENABLE RLS` no SQL** (`supabase-acessos-organizador-publico.sql`) | nenhuma | `ContaPublico` guarda `senhaHash`; depende de default privileges e de RLS aplicada fora do repo. **A verificar** |
| `GrupoCampeonato`, `GrupoEquipeCampeonato`, `LigaLocal`, `LigaSetupSecao` | ligada | select público, escrita revogada | ok |
| `Categoria*`, `ConviteVagaEquipe`, `AcessoArbitro*`, `Link*Inscricao*`, `InscricaoEquipe*Rascunho` | ligada, `REVOKE ALL` | só `CategoriaCampeonato` tem select público | ok; só `service_role` escreve |
| `ClassificacaoEliminatoria` | **sem `ENABLE RLS` no SQL** | nenhuma | verificar |
| `AdminAcaoHistorico` | ligada | política só para `service_role` | ok |
| `category_sources_backfill` | sem RLS | | dropar |

Como o app usa `service_role` em dezenas de rotas (diagnóstico 01, S6), a RLS é defesa em profundidade para a chave `anon`, não o controle principal. O controle principal está nas rotas (`exigirOrganizadorDa*`). Por isso o modelo da seção 3 nasce com RLS fechada por padrão e o isolamento entre organizadores é validado também no banco.

### 1.4 Índices e constraints propostos para o legado (proposta, não aplicar sem ensaio)

Rodar cada `CREATE INDEX CONCURRENTLY` separadamente (não pode estar em transação). Conferir com A7 antes; `IF NOT EXISTS` evita duplicidade por nome, não por definição.

```sql
-- Hot path da súmula e do placar ao vivo
create index concurrently if not exists "OcorrenciaPartida_partida_set_idx" on "OcorrenciaPartida" ("partidaId", "set");
create index concurrently if not exists "OcorrenciaPartida_jogador_idx"     on "OcorrenciaPartida" ("jogadorId") where "jogadorId" is not null;
create index concurrently if not exists "SumulaPresenca_jogador_idx"        on "SumulaPresenca" ("jogadorId");
create index concurrently if not exists "SumulaPresenca_equipe_idx"         on "SumulaPresenca" ("equipeId");
-- Agenda e portal
create index concurrently if not exists "Partida_equipeAId_idx"             on "Partida" ("equipeAId");
create index concurrently if not exists "Partida_equipeBId_idx"             on "Partida" ("equipeBId");
create index concurrently if not exists "Partida_liga_cat_status_idx"       on "Partida" ("ligaId", "categoriaCampeonatoId", status);
-- Elenco
create index concurrently if not exists "Jogador_equipeId_idx"              on "Jogador" ("equipeId");
create index concurrently if not exists "EscalaArbitro_arbitroId_idx"       on "EscalaArbitro" ("arbitroId");
create index concurrently if not exists "Midia_ligaId_idx"                  on "Midia" ("ligaId");
create index concurrently if not exists "Mensagem_ligaId_idx"               on "Mensagem" ("ligaId");
-- Unicidade de nome por categoria sem diferença de caixa (D10). Antes: checar duplicatas.
-- create unique index concurrently "Equipe_categoria_nome_ci_uq" on "Equipe" ("categoriaCampeonatoId", lower(btrim(nome)));
-- Remoção do índice redundante (D9), só se A6 confirmar os dois:
-- drop index concurrently if exists "Jogador_equipeId_numero_key";
```

Constraints de estado (D11), em duas etapas e fora de horário de rodada, com reversão `ALTER TABLE ... DROP CONSTRAINT`:

```sql
alter table "Partida" add constraint partida_status_chk check (status in ('AGENDADA','EM_ANDAMENTO','ENCERRADA','CANCELADA','WO')) not valid;
-- alter table "Partida" validate constraint partida_status_chk;   -- depois de conferir os valores existentes com A8
```

### 1.5 Consultas de diagnóstico (somente leitura, para rodar em preview ou em réplica)

Não devolvem dado pessoal; as que contam linhas devolvem só números.

```sql
-- A1: RLS por tabela
select c.relname, c.relrowsecurity as rls, c.relforcerowsecurity as forcada
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' order by 1;

-- A2: privilégios de tabela e de coluna para anon/authenticated
select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type) as privilegios
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon','authenticated') group by 1,2 order by 1,2;
select table_name, column_name, grantee, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and grantee in ('anon','authenticated') and table_name in ('Jogador','CandidaturaOrganizador','ContaPublico');

-- A3: funções expostas (definer e executáveis por anon)
select p.proname, p.prosecdef as definer, has_function_privilege('anon', p.oid, 'execute') as anon_executa
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f' order by anon_executa desc, definer desc, 1;

-- A4: migrations aplicadas e presença do lote de categorias
select version, name from supabase_migrations.schema_migrations order by 1;
select table_name, column_name from information_schema.columns
where table_schema = 'public' and column_name = 'categoriaCampeonatoId' order by 1;

-- A5: contaminação por massa de teste (só contagens)
select count(*) filter (where "seedKey" is not null) as ligas_seed, count(*) as ligas_total from "Liga";

-- A6: índices de Jogador e Equipe
select tablename, indexname, indexdef from pg_indexes where schemaname = 'public' and tablename in ('Jogador','Equipe') order by 1,2;

-- A7: FKs sem índice cobrindo a primeira coluna
select c.conrelid::regclass as tabela, c.conname, a.attname as coluna
from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
where c.contype = 'f' and c.connamespace = 'public'::regnamespace
  and not exists (select 1 from pg_index i where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1])
order by 1,2;

-- A8: valores de estado em uso
select status, count(*) from "Partida" group by 1;
select status, count(*) from "InscricaoCampeonato" group by 1;

-- A9: políticas e buckets
select schemaname, tablename, policyname, cmd, roles, qual from pg_policies where schemaname in ('public','storage') order by 1,2,3;
select id, public, allowed_mime_types from storage.buckets;

-- A10: duplicidades que bloqueiam o plano de migração (3.7), só contagens
select count(*) as cpfs_repetidos from (
  select regexp_replace(cpf,'\D','','g') c from "Jogador" where cpf is not null
  group by 1 having count(*) > 1 and length(regexp_replace(cpf,'\D','','g')) = 11) x;
select count(*) as jogadores_sem_nascimento from "Jogador" where "dataNascimento" is null;
select count(*) as menores_de_18 from "Jogador" where "dataNascimento" > (current_date - interval '18 years');
select count(*) as ligas_sem_organizador_cadastrado
from "Liga" l where l."organizadorId" is not null
  and not exists (select 1 from "CandidaturaOrganizador" o where o.id = l."organizadorId");
```

Teste de contrato da chave anon (em **local ou preview**, nunca em produção): `GET /rest/v1/Jogador?select=cpf&limit=1`, `GET /rest/v1/CandidaturaOrganizador?select=senhaHash&limit=1` e `PATCH /rest/v1/Liga?id=eq.<id>` com a chave anon. O esperado é 401/403 ou lista vazia; qualquer 200 com linhas confirma D1 a D3.

---

## 2. Divergência Prisma × migrations

`prisma/schema.prisma` (699 linhas, 37 `model`) não é usado em runtime e **não é a verdade**; o SQL também não é completo (D8). Comparação por leitura:

| Item | No Prisma | No SQL/código | Efeito |
|---|---|---|---|
| Tabelas ausentes do Prisma | | `AcessoArbitroJogo`, `AcessoArbitroEvento`, `AdminAcaoHistorico`, `LigaLocal`, `LigaSetupSecao`, `GrupoCampeonato`, `GrupoEquipeCampeonato`, `LinkInscricaoCampeonato`, `LinkInscricaoEvento` (9 tabelas, 6 delas com `.from()` no `src`) | `prisma generate` não as conhece |
| Tabela só no Prisma, sem DDL | `ConviteEquipe` | usada em 8 chamadas | origem desconhecida: baseline ou tabela inexistente. **A verificar** |
| `categoriaCampeonatoId` (+ `ligaId` NOT NULL) | só em `ConviteVagaEquipe`, `CategoriaConfiguracao`, `CategoriaSetupSecao` (`:644,665,677`) | adicionada a `Equipe`, `InscricaoEquipeRascunho`, `InscricaoCampeonato`, `GrupoCampeonato`, `GrupoEquipeCampeonato`, `Partida`, `ClassificacaoEntrada`, `ClassificacaoEliminatoria`, `Premiacao`, `VotoMVP` (+`ligaId`), `CandidaturaEquipe` e tornada NOT NULL (`202609220001:91-96`, `202609220002:108`) | principal causa do desvio; o código já a usa (`api/equipes/route.ts:30`) |
| `seedKey` | ausente | `Liga`, `Partida` (`supabase-acesso-arbitro-jogo.sql:5-8`), `Equipe`, `Jogador` (`supabase-link-inscricao-campeonato.sql:30-33`) | seeds idempotentes dependem dela |
| `CategoriaCampeonato.tokenInscricao` | ausente | `202610040004` | |
| `Partida.fase`, `Partida.grupoId` | ausentes | índice `Partida_categoria_fase_slot_key` (`202609230004:4`) e FKs de grupo | colunas sem DDL no repo (D8) |
| `Equipe.serie`, `Partida.serie` | `String @default("PRATA")` NOT NULL | `drop not null` e sem default (`202609220001:104`) | Prisma recriaria a obrigatoriedade |
| `InscricaoEquipeRascunho.nomeEquipe` | `String` obrigatório | `drop not null` (`202609220001:98`) | idem |
| `InscricaoEquipeRascunho.status` | default `"RASCUNHO"` | `CHECK` com `NAO_INICIADO/EM_PREENCHIMENTO/CONCLUIDO` (`202609220003:64`) | valores novos |
| `@@unique([nome, ligaId, categoria, serie])` em `Equipe` | presente | substituído por `equipe_category_name_unique` (`202609220002:111`) | D10 |
| `Jogador` | índice `qrCodeToken` único | dois índices únicos de número (D9), `guard_player_team` | |
| Datas | `DateTime` (baseline `timestamp(3)` sem fuso) | tabelas novas usam `timestamptz` | mistura de fusos; cuidado em `inscricoesEncerramentoEm`, `bloqueadoAte` |
| Defaults de id | `@default(cuid())`/`uuid()` (aplicados só pelo Prisma Client) | `supabase-ids-sem-default.sql` cria `gen_random_uuid()` no banco | sem isso, `.insert()` do supabase-js falha |
| `package.json` | `prisma.seed` → `prisma/seed.ts` | arquivo inexistente; `setup-db.mjs` cria SQLite da LUVA com caminho fixo `C:/Users/willm/luva-dev.db` | seed e setup herdados não funcionam |

**Recomendação.** Tratar o Postgres real como verdade: gerar baseline via `pg_dump --schema-only` de restore de backup (D8), então (a) remover o Prisma do repositório ou (b) regenerar com `prisma db pull`, marcado como somente leitura. Enquanto isso, `prisma/schema.prisma` deve ter um cabeçalho "defasado, não usar" e `setup-db.mjs` deve ser removido ou isolado em `legado/`.

---

## 3. Modelo de dados do Meu Time (proposta)

### 3.1 Princípios e decisões

1. **Aditivo e sem tocar no legado.** Nenhuma coluna nem trigger de `Equipe`, `Jogador`, `Partida` muda (D14). A ligação entre o mundo novo e o legado fica em **tabelas-ponte** (`time_equipe_legado`, `atleta_jogador_legado`) e em FKs *do novo para o legado*. Isso garante migração sem perda por construção: o histórico de súmula continua apontando para `Jogador.id`.
2. **Nomes.** `Equipe` hoje é a "equipe inscrita numa categoria de um campeonato". O time permanente do responsável vira **`time_clube`** (evita colidir com `Equipe` e com o tipo `time`). O banco de atletas é do **clube**; cada time usa os atletas que precisar (PROMPT, "Clube com várias equipes").
3. **Identidade única do atleta** por `cpf_hash` (HMAC-SHA256 com *pepper* do servidor, só dígitos) ou, sem CPF, por `(documento_tipo, documento_hash)`. Menores costumam não ter CPF, por isso o documento alternativo. Nome + nascimento **nunca** unificam sozinhos: viram sugestão de fusão revisada por humano.
4. **Dados sensíveis separados** em `atleta_sensivel` (cifrados no app, chave fora do banco), com política própria. O organizador só lê o necessário.
5. **Inscrição com cópia da lista** (`inscricao_atleta` guarda *snapshot* imutável de nome e nascimento, número, capitão, líbero). Mudança no banco do time não altera inscrição enviada; depois do prazo, a troca vira `pedido_troca`.
6. **Menores:** `consentimento_responsavel` com finalidade, versão do termo, evidência (hash) e estado. Atleta migrado nunca recebe consentimento fabricado: nasce `LEGADO_NAO_COLETADO`.
7. **Privacidade entre organizadores:** organizador lê um atleta só se ele estiver em inscrição **ativa** de liga sua (`eh_organizador_do_atleta`); nunca o banco do clube.
8. **RLS fechada por padrão.** O app hoje autentica com JWT próprio e usa `service_role`; portanto a fase A só nega a `anon`/`authenticated`. As políticas da fase B pressupõem uma *claim* `app_usuario_id` no JWT (ponte para o Supabase Auth, decisão do arquiteto-backend).

**Decisões em aberto (precisam de resposta de produto):**
- **D-1 Escopo de exclusividade do atleta.** O PROMPT diz "mesma competição". Como no código a unidade operacional é a categoria (`CategoriaCampeonato`) e uma `Liga` tem várias, a proposta usa **categoria** (um atleta pode jogar o Feminino e o Misto do mesmo campeonato, mas não dois times da mesma categoria). Para exigir por campeonato inteiro, trocar o índice `inscricao_atleta_exclusividade_uq` para `(liga_id, atleta_id)`; o plano de migração precisa então checar a consulta A11 (seção 3.7).
- **D-2** Atleta autônomo (perfil que o próprio atleta reivindica, `atleta.usuario_id`) entra no MVP? A tabela suporta; a política de edição pelo atleta fica desligada.
- **D-3** Exigência de `sexo` do atleta para o selo de naipe (a proposta guarda `sexo` opcional).

### 3.2 Mapa de entidades

```
usuario ──< usuario_legado        (ORGANIZADOR|EQUIPE|ARBITRO|QUADRA|PUBLICO|ADMIN -> id legado)
usuario ──< organizador_membro >── organizador ──(legado_id)── "Liga"."organizadorId"
usuario ──< clube_membro >── clube ──< time_clube ──< time_membro >── usuario
                              │            └──< time_comissao
                              └──< vinculo_atleta_clube >── atleta ──1:1── atleta_sensivel
                                         └─ time_atleta (time x atleta do clube)
atleta ──< consentimento_responsavel
"Liga"/"CategoriaCampeonato" ──< inscricao >── time_clube
inscricao ──< inscricao_atleta (cópia)  ──> atleta, consentimento, "Jogador" (criado na aprovação)
inscricao ──< inscricao_comissao ; ──< pedido_troca ; ──< inscricao_historico
auditoria_evento (append-only)  |  time_equipe_legado, atleta_jogador_legado, atleta_fusao_pendente (migração)
```

### 3.3 DDL proposto

> Proposta. Executar em local/preview. Reversão na seção 3.8. Tipos: `uuid` para o que é novo; `integer` onde referencia o legado (`Liga.id`, `Equipe.id`, `Jogador.id`, `Partida.id`); `text` para `InscricaoCampeonato.id`.

```sql
-- ===== 14-A. Meu Time: identidade, clube, time, atleta, inscrição =====
begin;
create extension if not exists pgcrypto;

-- 1) Usuário e papéis ----------------------------------------------------------
create table if not exists public.usuario (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  email         text,
  telefone      text,
  auth_user_id  uuid unique,                       -- futuro: auth.users.id
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em   timestamptz
);
create unique index if not exists usuario_email_uq
  on public.usuario (lower(email)) where email is not null and excluido_em is null;

-- uma pessoa pode ter várias contas legadas (organizador e equipe com o mesmo e-mail)
create table if not exists public.usuario_legado (
  usuario_id uuid not null references public.usuario(id) on delete cascade,
  tipo       text not null check (tipo in ('ORGANIZADOR','EQUIPE','ARBITRO','QUADRA','PUBLICO','ADMIN')),
  legado_id  text not null,
  primary key (tipo, legado_id)
);
create index if not exists usuario_legado_usuario_idx on public.usuario_legado (usuario_id);

create table if not exists public.organizador (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  legado_id  text unique,                          -- = "Liga"."organizadorId" = "CandidaturaOrganizador".id
  criado_em  timestamptz not null default now()
);
create table if not exists public.organizador_membro (
  organizador_id uuid not null references public.organizador(id) on delete cascade,
  usuario_id     uuid not null references public.usuario(id) on delete cascade,
  papel          text not null check (papel in ('ADMINISTRADOR','FINANCEIRO','ARBITRAGEM')),
  criado_em      timestamptz not null default now(),
  primary key (organizador_id, usuario_id)
);

-- 2) Clube e time ----------------------------------------------------------------
create table if not exists public.clube (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  cnpj           text,
  cidade         text,
  uf             char(2),
  origem         text not null default 'APP' check (origem in ('APP','MIGRACAO')),
  reivindicado_em timestamptz,                     -- migrados nascem sem responsável até alguém reivindicar
  criado_por     uuid references public.usuario(id),
  criado_em      timestamptz not null default now(),
  arquivado_em   timestamptz
);
create table if not exists public.clube_membro (
  clube_id   uuid not null references public.clube(id) on delete cascade,
  usuario_id uuid not null references public.usuario(id) on delete cascade,
  papel      text not null check (papel in ('RESPONSAVEL','DIRIGENTE','TECNICO','CAPITAO')),
  criado_em  timestamptz not null default now(),
  primary key (clube_id, usuario_id)
);

create table if not exists public.time_clube (
  id           uuid primary key default gen_random_uuid(),
  clube_id     uuid not null references public.clube(id),
  nome         text not null,
  cidade       text,
  naipe        text not null check (naipe in ('FEMININO','MASCULINO','MISTO')),
  escudo_url   text,
  cores        jsonb not null default '{}'::jsonb,
  contato      jsonb not null default '{}'::jsonb,
  criado_em    timestamptz not null default now(),
  arquivado_em timestamptz,
  unique (id, clube_id)
);
create unique index if not exists time_clube_nome_uq
  on public.time_clube (clube_id, lower(btrim(nome)), naipe) where arquivado_em is null;

create table if not exists public.time_membro (
  time_id    uuid not null references public.time_clube(id) on delete cascade,
  usuario_id uuid not null references public.usuario(id) on delete cascade,
  papel      text not null check (papel in ('RESPONSAVEL','TECNICO','ASSISTENTE','DIRIGENTE','CAPITAO')),
  criado_em  timestamptz not null default now(),
  primary key (time_id, usuario_id)
);
create table if not exists public.time_comissao (
  id            uuid primary key default gen_random_uuid(),
  time_id       uuid not null references public.time_clube(id) on delete cascade,
  nome          text not null,
  funcao        text not null check (funcao in ('TECNICO','ASSISTENTE','PREPARADOR_FISICO','FISIOTERAPEUTA','MEDICO')),
  documento_ref text,                              -- caminho em bucket privado, nunca o número em claro
  contato       jsonb not null default '{}'::jsonb,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now()
);

-- 3) Atleta com identidade única -------------------------------------------------
create table if not exists public.atleta (
  id                  uuid primary key default gen_random_uuid(),
  nome                text not null,
  nome_normalizado    text generated always as (lower(btrim(nome))) stored,
  data_nascimento     date,                        -- obrigatório para origem APP/CONVITE (check abaixo)
  sexo                text check (sexo in ('F','M')),
  foto_url            text,
  cpf_hash            text,                        -- HMAC-SHA256(pepper, só dígitos), calculado no servidor
  documento_tipo      text,
  documento_hash      text,
  origem              text not null default 'APP' check (origem in ('APP','CONVITE','MIGRACAO')),
  usuario_id          uuid unique references public.usuario(id),   -- atleta que reivindicou o perfil
  mesclado_para_id    uuid references public.atleta(id),
  mesclado_em         timestamptz,
  criado_por          uuid references public.usuario(id),
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  constraint atleta_nascimento_chk check (origem = 'MIGRACAO' or data_nascimento is not null),
  constraint atleta_nascimento_faixa_chk check (data_nascimento is null or data_nascimento >= date '1920-01-01'),
  constraint atleta_doc_par_chk check ((documento_tipo is null) = (documento_hash is null))
);
create unique index if not exists atleta_cpf_uq on public.atleta (cpf_hash)
  where cpf_hash is not null and mesclado_para_id is null;
create unique index if not exists atleta_doc_uq on public.atleta (documento_tipo, documento_hash)
  where documento_hash is not null and mesclado_para_id is null;
create index if not exists atleta_nome_nasc_idx on public.atleta (nome_normalizado, data_nascimento);

-- cifrado no aplicativo (AES-GCM, chave em KMS/variável de ambiente); o banco só guarda bytea
create table if not exists public.atleta_sensivel (
  atleta_id                    uuid primary key references public.atleta(id) on delete cascade,
  cpf_cifrado                  bytea,
  documento_numero_cifrado     bytea,
  telefone_cifrado             bytea,
  telefone_emergencia_cifrado  bytea,
  documentos_paths             text[] not null default '{}',   -- bucket PRIVADO (D4)
  chave_versao                 smallint not null default 1,
  atualizado_em                timestamptz not null default now()
);

create or replace function public.atleta_e_menor(p_nasc date, p_ref date default current_date)
returns boolean language sql immutable as $$
  select p_nasc is not null and p_nasc > (p_ref - interval '18 years')::date
$$;

-- 4) Vínculo atleta-clube e atleta-time ------------------------------------------
create table if not exists public.vinculo_atleta_clube (
  id        uuid primary key default gen_random_uuid(),
  clube_id  uuid not null references public.clube(id) on delete cascade,
  atleta_id uuid not null references public.atleta(id),
  status    text not null default 'ATIVO' check (status in ('CONVIDADO','ATIVO','INATIVO')),
  desde     date not null default current_date,
  ate       date,
  criado_em timestamptz not null default now(),
  unique (clube_id, atleta_id)
);
create index if not exists vinculo_atleta_idx on public.vinculo_atleta_clube (atleta_id);

create table if not exists public.time_atleta (
  time_id           uuid not null,
  clube_id          uuid not null,
  atleta_id         uuid not null,
  numero_preferido  smallint check (numero_preferido between 0 and 99),
  posicao_preferida text,                          -- mesmos códigos do legado (ex.: 'LB' = líbero)
  ativo             boolean not null default true,
  criado_em         timestamptz not null default now(),
  primary key (time_id, atleta_id),
  foreign key (time_id, clube_id)    references public.time_clube(id, clube_id) on delete cascade,
  foreign key (clube_id, atleta_id)  references public.vinculo_atleta_clube(clube_id, atleta_id)
);

create table if not exists public.convite_atleta (   -- link para o atleta preencher os próprios dados
  id          uuid primary key default gen_random_uuid(),
  token_hash  text not null unique,                -- só o hash; o token vai por link
  clube_id    uuid not null references public.clube(id) on delete cascade,
  time_id     uuid references public.time_clube(id) on delete cascade,
  atleta_id   uuid references public.atleta(id),
  expira_em   timestamptz not null,
  usado_em    timestamptz,
  criado_por  uuid references public.usuario(id),
  criado_em   timestamptz not null default now()
);

-- 5) Consentimento de responsável por menor --------------------------------------
create table if not exists public.consentimento_responsavel (
  id                       uuid primary key default gen_random_uuid(),
  atleta_id                uuid not null references public.atleta(id),
  clube_id                 uuid references public.clube(id),       -- quem trata os dados
  finalidade               text not null check (finalidade in ('CADASTRO_E_PARTICIPACAO','DOCUMENTOS','IMAGEM')),
  responsavel_nome         text,
  responsavel_parentesco   text,
  responsavel_cpf_hash     text,
  responsavel_contato_cifrado bytea,
  versao_termo             text not null,
  status                   text not null default 'PENDENTE'
    check (status in ('PENDENTE','CONCEDIDO','REVOGADO','EXPIRADO','LEGADO_NAO_COLETADO')),
  token_hash               text unique,            -- link enviado ao responsável
  solicitado_por           uuid references public.usuario(id),
  solicitado_em            timestamptz not null default now(),
  concedido_em             timestamptz,
  expira_em                timestamptz,
  revogado_em              timestamptz,
  evidencia_hash           text,                   -- hash do registro do aceite (texto, versão, instante)
  ip_hash                  text,
  user_agent_hash          text,
  constraint consent_concedido_chk check (status <> 'CONCEDIDO'
    or (concedido_em is not null and responsavel_nome is not null and evidencia_hash is not null)),
  constraint consent_revogado_chk check (status <> 'REVOGADO' or revogado_em is not null)
);
create unique index if not exists consent_vigente_uq on public.consentimento_responsavel
  (atleta_id, coalesce(clube_id, '00000000-0000-0000-0000-000000000000'::uuid), finalidade)
  where status in ('PENDENTE','CONCEDIDO');

-- 6) Regras de elenco por categoria (estende CategoriaConfiguracao) --------------
create table if not exists public.regra_elenco (
  categoria_campeonato_id uuid primary key,
  liga_id                 integer not null,
  modelo                  text check (modelo in ('FIVB','CBV','AMADOR_LIVRE','PERSONALIZADO')),
  atletas_min             smallint,                -- vazio = usar CategoriaConfiguracao.elencoQuantidadeMinima
  atletas_max             smallint,
  liberos_max             smallint not null default 2,
  nascimento_de           date,                    -- faixa de idade como datas-limite
  nascimento_ate          date,
  documentos_exigidos     text[] not null default '{}',
  comissao_max            smallint,
  prazo_troca_em          timestamptz,
  exige_consentimento_menor boolean not null default true,
  foreign key (categoria_campeonato_id, liga_id) references public."CategoriaCampeonato"(id, "ligaId"),
  check (atletas_min is null or atletas_max is null or atletas_min <= atletas_max)
);

-- 7) Inscrição --------------------------------------------------------------------
create table if not exists public.inscricao (
  id                       uuid primary key default gen_random_uuid(),
  liga_id                  integer not null,
  categoria_campeonato_id  uuid not null,
  time_id                  uuid not null references public.time_clube(id),
  equipe_id                integer references public."Equipe"(id) on delete set null,   -- criada na aprovação
  legado_inscricao_campeonato_id text unique references public."InscricaoCampeonato"(id) on delete set null,
  status                   text not null default 'RASCUNHO' check (status in
    ('RASCUNHO','ENVIADA','EM_ANALISE','PENDENCIA','APROVADA','RECUSADA','LISTA_ESPERA','CANCELADA')),
  versao                   integer not null default 1,
  enviada_em               timestamptz,
  decidida_em              timestamptz,
  motivo_decisao           text,
  aceite_regulamento_em    timestamptz,
  aceite_regulamento_versao text,
  aceite_por               uuid references public.usuario(id),
  prazo_edicao_em          timestamptz,
  criado_por               uuid references public.usuario(id),
  criado_em                timestamptz not null default now(),
  atualizado_em            timestamptz not null default now(),
  foreign key (categoria_campeonato_id, liga_id) references public."CategoriaCampeonato"(id, "ligaId"),
  unique (id, liga_id, categoria_campeonato_id)
);
create unique index if not exists inscricao_time_categoria_uq on public.inscricao (categoria_campeonato_id, time_id)
  where status not in ('RECUSADA','CANCELADA');
create index if not exists inscricao_liga_status_idx on public.inscricao (liga_id, status);
create index if not exists inscricao_time_idx on public.inscricao (time_id);

create table if not exists public.inscricao_atleta (
  id                       uuid primary key default gen_random_uuid(),
  inscricao_id             uuid not null,
  liga_id                  integer not null,
  categoria_campeonato_id  uuid not null,
  atleta_id                uuid not null references public.atleta(id),
  jogador_id               integer references public."Jogador"(id) on delete set null,  -- linha legada criada na aprovação
  nome_snapshot            text not null,
  data_nascimento_snapshot date,
  numero                   smallint check (numero between 0 and 99),
  posicao                  text,
  capitao                  boolean not null default false,
  libero                   boolean not null default false,
  documentos_ok            boolean not null default false,
  consentimento_id         uuid references public.consentimento_responsavel(id),
  ativo                    boolean not null default true,
  adicionado_em            timestamptz not null default now(),
  removido_em              timestamptz,
  foreign key (inscricao_id, liga_id, categoria_campeonato_id)
    references public.inscricao(id, liga_id, categoria_campeonato_id) on delete cascade
);
-- um atleta não joga em dois times da mesma categoria (D-1)
create unique index if not exists inscricao_atleta_exclusividade_uq
  on public.inscricao_atleta (categoria_campeonato_id, atleta_id) where ativo;
create unique index if not exists inscricao_atleta_numero_uq
  on public.inscricao_atleta (inscricao_id, numero) where ativo and numero is not null;
create unique index if not exists inscricao_atleta_capitao_uq
  on public.inscricao_atleta (inscricao_id) where ativo and capitao;
create index if not exists inscricao_atleta_inscricao_idx on public.inscricao_atleta (inscricao_id);
create index if not exists inscricao_atleta_atleta_idx on public.inscricao_atleta (atleta_id);

create table if not exists public.inscricao_comissao (
  id               uuid primary key default gen_random_uuid(),
  inscricao_id     uuid not null references public.inscricao(id) on delete cascade,
  time_comissao_id uuid references public.time_comissao(id) on delete set null,
  nome_snapshot    text not null,
  funcao_snapshot  text not null,
  no_banco         boolean not null default true
);

create table if not exists public.pedido_troca (
  id               uuid primary key default gen_random_uuid(),
  inscricao_id     uuid not null references public.inscricao(id) on delete cascade,
  tipo             text not null check (tipo in ('ADICIONAR','REMOVER','SUBSTITUIR')),
  atleta_sai_id    uuid references public.atleta(id),
  atleta_entra_id  uuid references public.atleta(id),
  numero_novo      smallint,
  justificativa    text,
  status           text not null default 'PENDENTE' check (status in ('PENDENTE','APROVADO','RECUSADO','CANCELADO')),
  solicitado_por   uuid references public.usuario(id),
  solicitado_em    timestamptz not null default now(),
  decidido_por     uuid references public.usuario(id),
  decidido_em      timestamptz,
  motivo_decisao   text,
  check (tipo <> 'SUBSTITUIR' or (atleta_sai_id is not null and atleta_entra_id is not null)),
  check (tipo <> 'ADICIONAR'  or atleta_entra_id is not null),
  check (tipo <> 'REMOVER'    or atleta_sai_id is not null)
);

create table if not exists public.inscricao_historico (
  id            bigint generated always as identity primary key,
  inscricao_id  uuid not null references public.inscricao(id) on delete cascade,
  de_status     text,
  para_status   text not null,
  comentario    text,                              -- "Pendência": pedido de correção do organizador
  ator_usuario_id uuid references public.usuario(id),
  criado_em     timestamptz not null default now()
);
create index if not exists inscricao_historico_idx on public.inscricao_historico (inscricao_id, id);

-- 8) Auditoria (append-only) ------------------------------------------------------
create table if not exists public.auditoria_evento (
  id              bigint generated always as identity primary key,
  ocorrido_em     timestamptz not null default now(),
  ator_usuario_id uuid,
  ator_tipo       text not null default 'USUARIO' check (ator_tipo in ('USUARIO','ORGANIZADOR','SISTEMA','MIGRACAO','ADMIN')),
  acao            text not null,                   -- INSERT|UPDATE|DELETE|LEITURA_SENSIVEL|EXPORTACAO|...
  entidade        text not null,
  entidade_id     text,
  antes           jsonb,
  depois          jsonb,                           -- nunca contém valor de atleta_sensivel (só nomes de colunas)
  ip_hash         text,
  lote_migracao   uuid
);
create index if not exists auditoria_entidade_idx on public.auditoria_evento (entidade, entidade_id, id);
create index if not exists auditoria_ator_idx on public.auditoria_evento (ator_usuario_id, id);

create or replace function public.imutavel() returns trigger language plpgsql set search_path = public as $$
begin
  raise exception '% e append-only', tg_table_name using errcode = '42501';
end $$;
create trigger auditoria_imutavel before update or delete on public.auditoria_evento
  for each row execute function public.imutavel();
create trigger auditoria_sem_truncate before truncate on public.auditoria_evento
  for each statement execute function public.imutavel();

create or replace function public.auditar_mudanca() returns trigger language plpgsql
security definer set search_path = public as $$
declare v_antes jsonb; v_depois jsonb; v_id text;
begin
  if tg_op in ('UPDATE','DELETE') then v_antes := to_jsonb(old); end if;
  if tg_op in ('INSERT','UPDATE') then v_depois := to_jsonb(new); end if;
  if tg_table_name = 'atleta_sensivel' then       -- sem valores, só quais colunas existem
    v_antes  := (select jsonb_object_agg(k, '***') from jsonb_object_keys(coalesce(v_antes,'{}'::jsonb)) k);
    v_depois := (select jsonb_object_agg(k, '***') from jsonb_object_keys(coalesce(v_depois,'{}'::jsonb)) k);
  end if;
  v_id := coalesce(v_depois->>'id', v_antes->>'id', v_depois->>'atleta_id', v_antes->>'atleta_id');
  insert into auditoria_evento(ator_usuario_id, acao, entidade, entidade_id, antes, depois)
  values (coalesce(public.app_usuario_id(), nullif(current_setting('app.ator_usuario_id', true), '')::uuid),
          tg_op, tg_table_name, v_id, v_antes, v_depois);
  return coalesce(new, old);
end $$;
-- (app_usuario_id é criada em 3.4; criar antes deste bloco ao aplicar)

do $$ declare t text; begin
  foreach t in array array['atleta','atleta_sensivel','consentimento_responsavel','inscricao',
                           'inscricao_atleta','pedido_troca','clube_membro','time_membro','vinculo_atleta_clube'] loop
    execute format('create trigger %I after insert or update or delete on public.%I
                    for each row execute function public.auditar_mudanca()', t||'_auditoria', t);
  end loop;
end $$;

-- 9) Pontes com o legado (preenchidas só pelo backfill, seção 3.7) -----------------
create table if not exists public.time_equipe_legado (
  equipe_id  integer primary key references public."Equipe"(id) on delete cascade,
  time_id    uuid not null references public.time_clube(id),
  metodo     text not null check (metodo in ('MESMO_RESPONSAVEL_NOME_NAIPE','UNICO','REVISAO_MANUAL')),
  lote       uuid not null,
  criado_em  timestamptz not null default now()
);
create table if not exists public.atleta_jogador_legado (
  jogador_id integer primary key references public."Jogador"(id) on delete cascade,
  atleta_id  uuid not null references public.atleta(id),
  metodo     text not null check (metodo in ('CPF','DOCUMENTO','MESMO_TIME','REVISAO_MANUAL','NOVO')),
  lote       uuid not null,
  criado_em  timestamptz not null default now()
);
create index if not exists atleta_jogador_legado_atleta_idx on public.atleta_jogador_legado (atleta_id);
create table if not exists public.atleta_fusao_pendente (
  id         uuid primary key default gen_random_uuid(),
  atleta_a   uuid not null references public.atleta(id),
  atleta_b   uuid not null references public.atleta(id),
  motivo     text not null check (motivo in ('NOME_NASCIMENTO_IGUAIS','CPF_NASCIMENTO_DIVERGENTE','CPF_NOME_DIVERGENTE')),
  status     text not null default 'ABERTA' check (status in ('ABERTA','MESCLADA','DESCARTADA')),
  decidido_por uuid references public.usuario(id),
  decidido_em  timestamptz,
  check (atleta_a < atleta_b),
  unique (atleta_a, atleta_b)
);
commit;
```

### 3.4 Funções de apoio, transições e travas (proposta)

```sql
begin;
-- Claim do JWT próprio do app (fase B). Sem JWT => null => nega tudo.
create or replace function public.app_usuario_id() returns uuid
language sql stable set search_path = public as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'app_usuario_id', '')::uuid
$$;

create or replace function public.eh_membro_clube(p_clube uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from clube_membro where clube_id = p_clube and usuario_id = app_usuario_id())
$$;
create or replace function public.eh_gestor_clube(p_clube uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from clube_membro where clube_id = p_clube and usuario_id = app_usuario_id()
                 and papel in ('RESPONSAVEL','DIRIGENTE'))
$$;
create or replace function public.eh_gestor_time(p_time uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from time_clube t where t.id = p_time and public.eh_gestor_clube(t.clube_id))
      or exists (select 1 from time_membro m where m.time_id = p_time and m.usuario_id = app_usuario_id()
                 and m.papel in ('RESPONSAVEL','TECNICO','DIRIGENTE'))
$$;
create or replace function public.eh_organizador_da_liga(p_liga integer) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from "Liga" l
    join organizador o on o.legado_id = l."organizadorId"
    join organizador_membro m on m.organizador_id = o.id
    where l.id = p_liga and m.usuario_id = app_usuario_id())
$$;
create or replace function public.eh_organizador_do_time(p_time uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from inscricao i where i.time_id = p_time and public.eh_organizador_da_liga(i.liga_id))
$$;
create or replace function public.eh_organizador_do_atleta(p_atleta uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from inscricao_atleta ia
                 where ia.atleta_id = p_atleta and ia.ativo and public.eh_organizador_da_liga(ia.liga_id))
$$;
create or replace function public.eh_gestor_do_atleta(p_atleta uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from vinculo_atleta_clube v
                 where v.atleta_id = p_atleta and public.eh_gestor_clube(v.clube_id))
$$;
create or replace function public.atleta_no_meu_clube(p_atleta uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from vinculo_atleta_clube v
                 where v.atleta_id = p_atleta and public.eh_membro_clube(v.clube_id))
$$;
revoke all on function public.eh_membro_clube(uuid), public.eh_gestor_clube(uuid), public.eh_gestor_time(uuid),
  public.eh_organizador_da_liga(integer), public.eh_organizador_do_time(uuid), public.eh_organizador_do_atleta(uuid),
  public.eh_gestor_do_atleta(uuid), public.atleta_no_meu_clube(uuid) from public, anon;
grant execute on function public.eh_membro_clube(uuid), public.eh_gestor_clube(uuid), public.eh_gestor_time(uuid),
  public.eh_organizador_da_liga(integer), public.eh_organizador_do_time(uuid), public.eh_organizador_do_atleta(uuid),
  public.eh_gestor_do_atleta(uuid), public.atleta_no_meu_clube(uuid), public.app_usuario_id()
  to authenticated, service_role;

-- Transições de status da inscrição + espelho do histórico + liberação dos atletas
create or replace function public.inscricao_transicao() returns trigger language plpgsql
set search_path = public as $$
declare v_ok jsonb := '{
  "RASCUNHO":["ENVIADA","CANCELADA"],
  "ENVIADA":["EM_ANALISE","PENDENCIA","APROVADA","RECUSADA","LISTA_ESPERA","CANCELADA"],
  "EM_ANALISE":["PENDENCIA","APROVADA","RECUSADA","LISTA_ESPERA","CANCELADA"],
  "PENDENCIA":["ENVIADA","RECUSADA","CANCELADA"],
  "LISTA_ESPERA":["APROVADA","RECUSADA","CANCELADA"],
  "APROVADA":["CANCELADA"],
  "RECUSADA":[], "CANCELADA":[]}'::jsonb;
begin
  if new.status is distinct from old.status then
    if not (v_ok -> old.status) ? new.status then
      raise exception 'Transicao invalida: % -> %', old.status, new.status using errcode = '23514';
    end if;
    if new.status = 'ENVIADA' then perform public.inscricao_validar_envio(new.id); new.enviada_em := now(); end if;
    if new.status in ('APROVADA','RECUSADA') then new.decidida_em := now(); end if;
    if new.status in ('RECUSADA','CANCELADA') then
      update inscricao_atleta set ativo = false, removido_em = coalesce(removido_em, now())
      where inscricao_id = new.id and ativo;
    end if;
    insert into inscricao_historico(inscricao_id, de_status, para_status, comentario, ator_usuario_id)
    values (new.id, old.status, new.status, new.motivo_decisao, public.app_usuario_id());
  end if;
  new.versao := old.versao + 1; new.atualizado_em := now();
  return new;
end $$;
create trigger inscricao_transicao_trg before update on public.inscricao
  for each row execute function public.inscricao_transicao();

-- Regras de envio: elenco mínimo/máximo, líberos, faixa de idade e consentimento de menor
create or replace function public.inscricao_validar_envio(p_inscricao uuid) returns void
language plpgsql security definer set search_path = public as $$
declare i record; r record; n integer; nl integer; sem_consent integer; fora_faixa integer;
begin
  select * into strict i from inscricao where id = p_inscricao;
  select * into r from regra_elenco where categoria_campeonato_id = i.categoria_campeonato_id;
  select count(*), count(*) filter (where libero) into n, nl from inscricao_atleta where inscricao_id = p_inscricao and ativo;
  if r.atletas_min is not null and n < r.atletas_min then
    raise exception 'Elenco abaixo do minimo (% de %)', n, r.atletas_min using errcode = '23514'; end if;
  if r.atletas_max is not null and n > r.atletas_max then
    raise exception 'Elenco acima do maximo (% de %)', n, r.atletas_max using errcode = '23514'; end if;
  if r.liberos_max is not null and nl > r.liberos_max then
    raise exception 'Liberos acima do limite (% de %)', nl, r.liberos_max using errcode = '23514'; end if;
  select count(*) into fora_faixa from inscricao_atleta ia
   where ia.inscricao_id = p_inscricao and ia.ativo
     and (ia.data_nascimento_snapshot is null
          or (r.nascimento_de  is not null and ia.data_nascimento_snapshot < r.nascimento_de)
          or (r.nascimento_ate is not null and ia.data_nascimento_snapshot > r.nascimento_ate));
  if fora_faixa > 0 then raise exception '% atleta(s) sem nascimento ou fora da faixa de idade', fora_faixa using errcode = '23514'; end if;
  if coalesce(r.exige_consentimento_menor, true) then
    select count(*) into sem_consent from inscricao_atleta ia
     where ia.inscricao_id = p_inscricao and ia.ativo and public.atleta_e_menor(ia.data_nascimento_snapshot)
       and not exists (select 1 from consentimento_responsavel c
                       where c.id = ia.consentimento_id and c.status = 'CONCEDIDO'
                         and (c.expira_em is null or c.expira_em > now()));
    if sem_consent > 0 then raise exception '% menor(es) sem consentimento do responsavel', sem_consent using errcode = '23514'; end if;
  end if;
end $$;

-- Snapshot imutável e troca depois do prazo só via pedido aprovado
create or replace function public.inscricao_atleta_guarda() returns trigger language plpgsql
set search_path = public as $$
declare i record;
begin
  if tg_op = 'UPDATE' and (new.nome_snapshot is distinct from old.nome_snapshot
     or new.data_nascimento_snapshot is distinct from old.data_nascimento_snapshot
     or new.atleta_id <> old.atleta_id or new.inscricao_id <> old.inscricao_id) then
    raise exception 'Snapshot da inscricao e imutavel' using errcode = '23514';
  end if;
  select * into i from inscricao where id = new.inscricao_id;
  if i.status in ('ENVIADA','EM_ANALISE','APROVADA','LISTA_ESPERA')
     and i.prazo_edicao_em is not null and now() > i.prazo_edicao_em
     and coalesce(current_setting('app.aplicando_pedido_troca', true), '') <> 'on' then
    raise exception 'Prazo de edicao encerrado: abra um pedido de troca' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger inscricao_atleta_guarda_trg before insert or update on public.inscricao_atleta
  for each row execute function public.inscricao_atleta_guarda();
commit;
```

A RPC `aprovar_pedido_troca(p_pedido uuid)` (a escrever) faz `set_config('app.aplicando_pedido_troca','on', true)` dentro da própria transação antes de alterar `inscricao_atleta`. A criação da `Equipe`/`Jogador` legados na aprovação continua pela RPC `finalizar_inscricao_equipe_rascunho` (ou sua sucessora), que deve gravar também `inscricao.equipe_id` e `inscricao_atleta.jogador_id`: assim a súmula, a classificação e o portal seguem sem mudança.

### 3.5 RLS e grants

**Fase A (já útil hoje).** O app autentica com JWT próprio e acessa com `service_role`. Habilitar RLS sem política equivale a "negar tudo" para `anon` e `authenticated`:

```sql
do $$ declare t text; begin
  foreach t in array array['usuario','usuario_legado','organizador','organizador_membro','clube','clube_membro',
    'time_clube','time_membro','time_comissao','atleta','atleta_sensivel','vinculo_atleta_clube','time_atleta',
    'convite_atleta','consentimento_responsavel','regra_elenco','inscricao','inscricao_atleta','inscricao_comissao',
    'pedido_troca','inscricao_historico','auditoria_evento','time_equipe_legado','atleta_jogador_legado',
    'atleta_fusao_pendente'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;
```

**Fase B (quando houver a claim `app_usuario_id` no JWT ou o Supabase Auth).** Conceder o mínimo a `authenticated` e criar as políticas. `anon` continua sem acesso a qualquer tabela nova; páginas públicas leem por rota de servidor ou por views mínimas.

```sql
grant select, insert, update on public.clube, public.time_clube, public.time_comissao, public.atleta,
  public.atleta_sensivel, public.vinculo_atleta_clube, public.time_atleta, public.inscricao,
  public.inscricao_atleta, public.inscricao_comissao to authenticated;
grant select, insert on public.consentimento_responsavel, public.pedido_troca to authenticated;
grant select on public.usuario, public.clube_membro, public.time_membro, public.organizador,
  public.inscricao_historico, public.regra_elenco to authenticated;
grant update (nome, telefone) on public.usuario to authenticated;

-- usuario: cada um vê e edita o próprio
create policy usuario_self_sel on public.usuario for select to authenticated using (id = public.app_usuario_id());
create policy usuario_self_upd on public.usuario for update to authenticated
  using (id = public.app_usuario_id()) with check (id = public.app_usuario_id());

-- clube e equipe de trabalho: só membros; gestão por responsáveis
create policy clube_sel on public.clube for select to authenticated using (public.eh_membro_clube(id));
create policy clube_ins on public.clube for insert to authenticated with check (criado_por = public.app_usuario_id());
create policy clube_upd on public.clube for update to authenticated
  using (public.eh_gestor_clube(id)) with check (public.eh_gestor_clube(id));
create policy clube_membro_sel on public.clube_membro for select to authenticated using (public.eh_membro_clube(clube_id));
create policy time_sel on public.time_clube for select to authenticated
  using (public.eh_membro_clube(clube_id) or public.eh_organizador_do_time(id));
create policy time_ins on public.time_clube for insert to authenticated with check (public.eh_gestor_clube(clube_id));
create policy time_upd on public.time_clube for update to authenticated
  using (public.eh_gestor_time(id)) with check (public.eh_gestor_time(id));
create policy time_membro_sel on public.time_membro for select to authenticated using (public.eh_gestor_time(time_id));
create policy time_comissao_all on public.time_comissao for all to authenticated
  using (public.eh_gestor_time(time_id)) with check (public.eh_gestor_time(time_id));

-- atleta: identidade visível ao meu clube, ao próprio atleta e ao organizador onde ele está inscrito
create policy atleta_sel on public.atleta for select to authenticated
  using (public.atleta_no_meu_clube(id) or usuario_id = public.app_usuario_id() or public.eh_organizador_do_atleta(id));
create policy atleta_ins on public.atleta for insert to authenticated with check (criado_por = public.app_usuario_id());
create policy atleta_upd on public.atleta for update to authenticated
  using (public.eh_gestor_do_atleta(id)) with check (public.eh_gestor_do_atleta(id));
-- dados sensíveis: gestor do clube (lê e grava) e organizador onde há inscrição ativa (só lê)
create policy atleta_sens_sel on public.atleta_sensivel for select to authenticated
  using (public.eh_gestor_do_atleta(atleta_id) or public.eh_organizador_do_atleta(atleta_id));
create policy atleta_sens_ins on public.atleta_sensivel for insert to authenticated with check (public.eh_gestor_do_atleta(atleta_id));
create policy atleta_sens_upd on public.atleta_sensivel for update to authenticated
  using (public.eh_gestor_do_atleta(atleta_id)) with check (public.eh_gestor_do_atleta(atleta_id));
-- o organizador NUNCA lê o banco do clube
create policy vinculo_all on public.vinculo_atleta_clube for all to authenticated
  using (public.eh_gestor_clube(clube_id)) with check (public.eh_gestor_clube(clube_id));
create policy time_atleta_all on public.time_atleta for all to authenticated
  using (public.eh_gestor_time(time_id)) with check (public.eh_gestor_time(time_id));

-- consentimento: gestor do clube cria (PENDENTE) e consulta; quem concede é o responsável, por rota de servidor
create policy consent_sel on public.consentimento_responsavel for select to authenticated
  using (clube_id is not null and public.eh_gestor_clube(clube_id));
create policy consent_ins on public.consentimento_responsavel for insert to authenticated
  with check (status = 'PENDENTE' and clube_id is not null and public.eh_gestor_clube(clube_id));

-- inscrição: time edita rascunho/pendência; organizador lê e decide por RPC (security definer)
create policy inscricao_sel on public.inscricao for select to authenticated
  using (public.eh_gestor_time(time_id) or public.eh_organizador_da_liga(liga_id));
create policy inscricao_ins on public.inscricao for insert to authenticated
  with check (status = 'RASCUNHO' and public.eh_gestor_time(time_id));
create policy inscricao_upd on public.inscricao for update to authenticated
  using (public.eh_gestor_time(time_id) and status in ('RASCUNHO','PENDENCIA'))
  with check (public.eh_gestor_time(time_id) and status in ('RASCUNHO','ENVIADA','CANCELADA'));
create policy insc_atleta_sel on public.inscricao_atleta for select to authenticated
  using (public.eh_organizador_da_liga(liga_id) or exists
         (select 1 from inscricao i where i.id = inscricao_id and public.eh_gestor_time(i.time_id)));
create policy insc_atleta_wr on public.inscricao_atleta for all to authenticated
  using (exists (select 1 from inscricao i where i.id = inscricao_id and public.eh_gestor_time(i.time_id)
                 and i.status in ('RASCUNHO','PENDENCIA')))
  with check (exists (select 1 from inscricao i where i.id = inscricao_id and public.eh_gestor_time(i.time_id)
                 and i.status in ('RASCUNHO','PENDENCIA')));
create policy insc_com_sel on public.inscricao_comissao for select to authenticated
  using (exists (select 1 from inscricao i where i.id = inscricao_id
                 and (public.eh_gestor_time(i.time_id) or public.eh_organizador_da_liga(i.liga_id))));
create policy insc_hist_sel on public.inscricao_historico for select to authenticated
  using (exists (select 1 from inscricao i where i.id = inscricao_id
                 and (public.eh_gestor_time(i.time_id) or public.eh_organizador_da_liga(i.liga_id))));
create policy pedido_sel on public.pedido_troca for select to authenticated
  using (exists (select 1 from inscricao i where i.id = inscricao_id
                 and (public.eh_gestor_time(i.time_id) or public.eh_organizador_da_liga(i.liga_id))));
create policy pedido_ins on public.pedido_troca for insert to authenticated
  with check (status = 'PENDENTE' and exists (select 1 from inscricao i where i.id = inscricao_id and public.eh_gestor_time(i.time_id)));
create policy regra_sel on public.regra_elenco for select to authenticated using (true);  -- regra é pública da competição
-- auditoria, pontes e fusões: sem política => só service_role
```

Decisões do organizador (aprovar, recusar, pedir correção, aprovar troca) vão por RPCs `security definer` que conferem `eh_organizador_da_liga`, evitando conceder `UPDATE` direto (que não consegue limitar colunas por papel). Antes de ativar a fase B, testar com dois organizadores que um não lê nada do outro (seção 5, verificação V-ISO).

### 3.6 Selo de elegibilidade e consultas de leitura

O selo "Seu time pode participar" é consulta, não coluna: dado `time_clube` e `regra_elenco`, contar atletas do time (`time_atleta` ativos) com nascimento dentro da faixa, naipe compatível (`time_clube.naipe` ou `atleta.sexo` quando misto) e documentos presentes (`atleta_sensivel.documentos_paths`). Expor como função `elegibilidade_time(p_time uuid, p_categoria uuid) returns jsonb` (definer, devolve contagens e motivos, nunca CPF).

### 3.7 Plano de migração dos dados existentes, sem perda

**Garantia estrutural:** nenhuma etapa faz `UPDATE`, `DELETE` ou `ALTER` em `Equipe`, `Jogador`, `Partida`, `SetPartida`, `SumulaPresenca`, `OcorrenciaPartida`, `InscricaoCampeonato` ou `Liga`. Os dados novos são *derivados* e as pontes só *apontam* para o legado. Isso também evita os triggers de D14 (revisão por categoria, bloqueio de campeonato finalizado, `guard_player_team`).

Fases:

| Fase | O que acontece | Reversão |
|---|---|---|
| F0 Preparação | Backup comprovado (restore testado em preview). Rodar A1 a A10 em preview. Congelar uma janela de baixa carga. Definir o *pepper* do CPF e a chave de cifra fora do banco. | n/a |
| F1 DDL | Aplicar 3.3 e 3.4, e a fase A de 3.5. Tabelas vazias. | `drop` das tabelas novas (3.8) |
| F2 Backfill em lotes por `Liga` | Scripts abaixo, transação por liga, `lote uuid` único por execução, idempotentes (`on conflict do nothing`). Modo ensaio: o mesmo script em `begin; ... rollback;` com contagens. | apagar por `lote` |
| F3 Escrita dupla | A RPC de finalização da inscrição passa a gravar também `inscricao`, `inscricao_atleta`, `atleta` (migration futura, atrás de *feature flag*). Leituras ainda no legado. | desligar a flag |
| F4 Leitura nova | Telas "Meu Time" e inscrição leem as tabelas novas; `Equipe/Jogador` continuam sendo escritos na aprovação para a súmula. | religar leitura legada |
| F5 Higienização | Após N semanas e novo backup: cifrar/limpar `Jogador.cpf/documentoNumero/telefone*` e tornar privado o bucket `atleta-arquivos`, copiando antes os arquivos para o novo caminho. **Destrutivo: exige confirmação do usuário e backup comprovado.** | restaurar do backup |

**F2, passo 1: usuários e organizadores** (por e-mail normalizado; contas de mesma pessoa convergem em um `usuario`; senhas **não** migram nesta fase, continuam nas tabelas legadas até a decisão de autenticação):

```sql
-- usuário por e-mail, a partir de cada origem
insert into usuario(nome, email, telefone)
select distinct on (lower(btrim(c.email))) c.nome, lower(btrim(c.email)), c.telefone
from "CandidaturaOrganizador" c where nullif(btrim(c.email),'') is not null
on conflict do nothing;
-- idem para "CandidaturaEquipe" (responsavel, email), "CandidaturaArbitro", "CandidaturaQuadra", "ContaPublico"

insert into usuario_legado(usuario_id, tipo, legado_id)
select u.id, 'ORGANIZADOR', c.id from "CandidaturaOrganizador" c
join usuario u on lower(u.email) = lower(btrim(c.email)) on conflict do nothing;

insert into organizador(nome, legado_id)
select coalesce(nullif(btrim(c.organizacao),''), c.nome), c.id from "CandidaturaOrganizador" c
on conflict (legado_id) do nothing;
insert into organizador_membro(organizador_id, usuario_id, papel)
select o.id, ul.usuario_id, 'ADMINISTRADOR' from organizador o
join usuario_legado ul on ul.tipo = 'ORGANIZADOR' and ul.legado_id = o.legado_id on conflict do nothing;
-- Pendência: ligas cujo organizadorId não existe em CandidaturaOrganizador (consulta A10) vão para relatório, não para criação automática.
```

**F2, passo 2: clubes e times.** `Equipe` é por liga/categoria; o time permanente agrupa só quando há prova de que é o mesmo:

- Chave de agrupamento automática: **mesmo `usuario` responsável** (via `CandidaturaEquipe.equipeId` → e-mail) **+ nome normalizado + naipe**. Naipe vem do código da categoria (`FEMININO*` → FEMININO, `MASCULINO*` → MASCULINO, `MISTO` → MISTO). Categoria personalizada (`202609230008`) sem mapeamento vai para revisão manual, não recebe naipe por palpite.
- `Equipe` sem responsável identificável (o fluxo novo por link de categoria cria equipe sem conta, só com o texto `lider`): **um `time_clube` por `Equipe`**, num `clube` com `origem = 'MIGRACAO'` e `reivindicado_em` nulo. Nunca fundir por nome entre organizadores diferentes (times homônimos de clubes distintos são comuns). O responsável reivindica o clube pelo `InscricaoEquipeRascunho.token` que ele já recebeu (guardar só o hash em tabela de reivindicação) e, na reivindicação, o sistema **sugere** unir times homônimos.
- Cada `Equipe` ganha uma linha em `time_equipe_legado` com o método usado.

**F2, passo 3: atletas** (a parte de maior risco; ver 1.5/A10 antes). Hash do CPF calculado com o *pepper* passado pela sessão (`select set_config('app.cpf_pepper', :pepper, false)` na conexão do script, nunca em arquivo versionado):

```sql
create temp view v_jogador_norm as
select j.id as jogador_id, j."equipeId", j.nome, lower(btrim(j.nome)) as nome_norm, j."dataNascimento"::date as nasc,
  case when length(regexp_replace(j.cpf,'\D','','g')) = 11
        and regexp_replace(j.cpf,'\D','','g') !~ '^(\d)\1{10}$'
       then encode(hmac(regexp_replace(j.cpf,'\D','','g'), current_setting('app.cpf_pepper'), 'sha256'), 'hex') end as cpf_hash,
  nullif(upper(btrim(j."documentoTipo")),'') as doc_tipo,
  case when nullif(btrim(j."documentoNumero"),'') is not null
       then encode(hmac(upper(regexp_replace(j."documentoNumero",'[^0-9A-Za-z]','','g')),
                        current_setting('app.cpf_pepper'), 'sha256'), 'hex') end as doc_hash
from "Jogador" j;
```

Regras, em ordem, aplicadas pelo script:

1. **CPF válido igual** ⇒ mesmo `atleta` (T1). Se o mesmo `cpf_hash` aparece com `data_nascimento` ou nome muito diferentes ⇒ **não funde**, cria `atleta_fusao_pendente` com motivo `CPF_NASCIMENTO_DIVERGENTE`/`CPF_NOME_DIVERGENTE`.
2. **Documento (tipo + hash) igual e mesmo nascimento** ⇒ mesmo `atleta` (T2).
3. **Nome normalizado + nascimento iguais, sem CPF/documento, e as duas linhas pertencem a `Equipe` já mapeadas para o mesmo `time_clube`** ⇒ mesmo `atleta` (método `MESMO_TIME`).
4. **Nome + nascimento iguais em times diferentes sem outro identificador** ⇒ **não funde**; cria `atleta_fusao_pendente` (`NOME_NASCIMENTO_IGUAIS`) para revisão humana.
5. Os demais ⇒ `atleta` novo (`origem = 'MIGRACAO'`, método `NOVO`).

Sempre grava `atleta_jogador_legado`. Os dados sensíveis (CPF, documento, telefones) são copiados e **cifrados por script de aplicação** para `atleta_sensivel`; o legado em `Jogador` permanece intacto até a F5. `data_nascimento` nulo é aceito para `origem = 'MIGRACAO'`, mas o atleta fica barrado em novas inscrições até completar o dado (`inscricao_validar_envio` recusa nascimento nulo).

**F2, passo 4: vínculo, inscrição e cópia da lista.**

```sql
-- vínculo atleta-clube e atleta-time
insert into vinculo_atleta_clube(clube_id, atleta_id, status)
select distinct t.clube_id, ajl.atleta_id, case when j.banido then 'INATIVO' else 'ATIVO' end
from "Jogador" j
join atleta_jogador_legado ajl on ajl.jogador_id = j.id
join time_equipe_legado tel on tel.equipe_id = j."equipeId"
join time_clube t on t.id = tel.time_id
on conflict do nothing;

-- inscrição: status legado -> novo
insert into inscricao(liga_id, categoria_campeonato_id, time_id, equipe_id, legado_inscricao_campeonato_id,
                      status, enviada_em, decidida_em, motivo_decisao, criado_em)
select ic."ligaId", ic."categoriaCampeonatoId", tel.time_id, ic."equipeId", ic.id,
       case ic.status when 'SOLICITADA' then 'ENVIADA' when 'APROVADA' then 'APROVADA'
                      when 'REJEITADA' then 'RECUSADA' else 'ENVIADA' end,
       ic."criadaEm", case when ic.status in ('APROVADA','REJEITADA') then ic."atualizadaEm" end,
       ic.observacao, ic."criadaEm"
from "InscricaoCampeonato" ic
join time_equipe_legado tel on tel.equipe_id = ic."equipeId"
on conflict (legado_inscricao_campeonato_id) do nothing;
-- (insert direto no estado final: o trigger de transição só dispara em UPDATE, então o histórico antigo não é reexecutado)

-- cópia da lista: um snapshot por Jogador atual da Equipe (aproximação declarada: o elenco do momento da migração)
insert into inscricao_atleta(inscricao_id, liga_id, categoria_campeonato_id, atleta_id, jogador_id,
                             nome_snapshot, data_nascimento_snapshot, numero, posicao, libero, ativo)
select i.id, i.liga_id, i.categoria_campeonato_id, ajl.atleta_id, j.id,
       j.nome, j."dataNascimento"::date, j.numero, j.posicao, (j.posicao = 'LB'), not coalesce(j.banido, false)
from inscricao i
join "Jogador" j on j."equipeId" = i.equipe_id
join atleta_jogador_legado ajl on ajl.jogador_id = j.id
on conflict do nothing;
```

Um `atleta` que apareça ativo em duas inscrições da mesma categoria (duplicidade real do legado) viola `inscricao_atleta_exclusividade_uq`: o script deve contar antes (consulta A11 abaixo) e gravar a segunda linha com `ativo = false` e registro em `auditoria_evento` (`ator_tipo = 'MIGRACAO'`), nunca descartar.

```sql
-- A11: atletas (já unificados no staging) que ficariam ativos em dois times da mesma categoria
select count(*) from (
  select i.categoria_campeonato_id, ajl.atleta_id
  from inscricao i join "Jogador" j on j."equipeId" = i.equipe_id
  join atleta_jogador_legado ajl on ajl.jogador_id = j.id
  where not coalesce(j.banido,false) and i.status not in ('RECUSADA','CANCELADA')
  group by 1,2 having count(distinct i.id) > 1) x;
```

**F2, passo 5: menores e consentimento.** Para todo atleta com `atleta_e_menor(data_nascimento)` presente em inscrição não recusada, criar `consentimento_responsavel` com `status = 'LEGADO_NAO_COLETADO'`, `versao_termo = 'LEGADO'`, **sem** `concedido_em`. Efeito: o histórico segue válido, nada é contado como autorizado, e o sistema pede a coleta antes de qualquer nova inscrição (`inscricao_validar_envio` só aceita `CONCEDIDO`). Atletas sem nascimento ficam em fila de verificação.

**F2, passo 6: auditoria.** Cada lote grava um `auditoria_evento` com `ator_tipo = 'MIGRACAO'` e `lote_migracao`, e as contagens de entrada e saída.

**Validação (todas devem fechar antes de F3):**

```sql
select (select count(*) from "Equipe")               as equipes,        (select count(*) from time_equipe_legado)    as equipes_ligadas;
select (select count(*) from "Jogador")              as jogadores,      (select count(*) from atleta_jogador_legado) as jogadores_ligados;
select (select count(*) from "InscricaoCampeonato")  as inscricoes_leg, (select count(*) from inscricao where legado_inscricao_campeonato_id is not null) as inscricoes_novas;
select count(*) as jogador_sem_ponte from "Jogador" j where not exists (select 1 from atleta_jogador_legado a where a.jogador_id = j.id);
select count(*) as menores_sem_consent from inscricao_atleta ia
 where ia.ativo and public.atleta_e_menor(ia.data_nascimento_snapshot)
   and not exists (select 1 from consentimento_responsavel c where c.id = ia.consentimento_id and c.status = 'CONCEDIDO');
-- o legado não mudou: comparar antes/depois
select count(*), coalesce(sum(id),0) from "Jogador";  select count(*), coalesce(sum(id),0) from "SumulaPresenca";
select count(*), coalesce(sum(id),0) from "Equipe";   select count(*), coalesce(sum(id),0) from "Partida";
```

`jogador_sem_ponte` deve ser 0; contagens de legado iguais antes e depois; `atleta_fusao_pendente` com itens é esperado e vira tarefa do suporte.

### 3.8 Reversão

Como o legado não foi alterado, reverter é remover o que é novo, em ordem inversa e depois de exportar as tabelas novas (`pg_dump -t` das tabelas `usuario`..`atleta_fusao_pendente`):

```sql
begin;
drop table if exists public.atleta_fusao_pendente, public.atleta_jogador_legado, public.time_equipe_legado,
  public.pedido_troca, public.inscricao_historico, public.inscricao_comissao, public.inscricao_atleta,
  public.inscricao, public.regra_elenco, public.consentimento_responsavel, public.convite_atleta,
  public.time_atleta, public.vinculo_atleta_clube, public.atleta_sensivel, public.atleta,
  public.time_comissao, public.time_membro, public.time_clube, public.clube_membro, public.clube,
  public.organizador_membro, public.organizador, public.usuario_legado, public.usuario cascade;
-- auditoria_evento é append-only: dropar só com autorização explícita, pois é a trilha da migração
drop function if exists public.inscricao_validar_envio(uuid), public.inscricao_transicao(),
  public.inscricao_atleta_guarda(), public.auditar_mudanca(), public.atleta_e_menor(date, date) cascade;
commit;
```

---

## 4. Log de eventos da súmula (`partida_evento`)

### 4.1 Motivação e coexistência

Hoje o estado é a `Partida` + `SetPartida` + `OcorrenciaPartida` reescritos por `delete`+`insert` (D16). O log append-only vira a fonte de verdade da partida *nova*; as tabelas legadas continuam como **projeção** (e como histórico das partidas já encerradas). Convivência: partidas sem evento seguem o fluxo antigo; ao abrir a súmula de uma partida, o servidor decide o modo (`modo_sumula` por partida, ver 4.4). Nenhuma coluna de `Partida` é alterada.

### 4.2 DDL proposto

```sql
begin;
create table if not exists public.partida_evento (
  id                 bigint generated always as identity primary key,
  partida_id         integer not null references public."Partida"(id) on delete restrict,
  seq                integer not null check (seq > 0),
  cliente_evento_id  uuid not null,                  -- gerado no dispositivo: idempotência e fila offline
  tipo               text not null check (tipo in (
    'PARTIDA_INICIADA','SORTEIO','PAPELETA_ENVIADA','PAPELETA_CONFIRMADA','SET_INICIADO',
    'PONTO','DESFAZ','SAQUE_TROCADO','ROTACAO','SUBSTITUICAO','TROCA_LIBERO','TEMPO','TEMPO_TECNICO',
    'SANCAO','LESAO','PROTESTO','OBSERVACAO','SET_ENCERRADO','PARTIDA_ENCERRADA','ASSINATURA','CORRECAO')),
  set_numero         smallint check (set_numero between 1 and 5),
  equipe_id          integer references public."Equipe"(id),
  jogador_id         integer references public."Jogador"(id),
  payload            jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  ator_tipo          text not null check (ator_tipo in ('APONTADOR','ARBITRO','ORGANIZADOR','TECNICO','SISTEMA')),
  ator_ref           text,                           -- id do AcessoArbitroJogo, do usuário ou do dispositivo
  dispositivo_id     text,
  ocorrido_cliente_em timestamptz,                   -- relógio do aparelho (pode estar errado)
  recebido_em        timestamptz not null default now(),   -- relógio do servidor (autoridade)
  desfaz_evento_id   bigint references public.partida_evento(id),
  motivo             text,                           -- obrigatório em DESFAZ e CORRECAO
  versao_regras      text,                           -- versão do motor de regras que validou o evento
  hash_anterior      bytea,
  hash               bytea not null,                 -- sha256 encadeado: detecta adulteração
  unique (partida_id, seq),
  unique (partida_id, cliente_evento_id),
  check (tipo <> 'DESFAZ' or (motivo is not null and desfaz_evento_id is not null)),
  check (tipo <> 'CORRECAO' or motivo is not null),
  check (tipo <> 'PONTO' or (equipe_id is not null and set_numero is not null)),
  check (tipo <> 'SUBSTITUICAO' or (equipe_id is not null and set_numero is not null))
);
create index if not exists partida_evento_set_idx on public.partida_evento (partida_id, set_numero, seq);
create index if not exists partida_evento_desfaz_idx on public.partida_evento (desfaz_evento_id) where desfaz_evento_id is not null;

-- imutável: nada de update, delete ou truncate (nem pelo service_role, exceto a purga de simulação)
create or replace function public.partida_evento_imutavel() returns trigger language plpgsql
set search_path = public as $$
begin
  if tg_op = 'DELETE' and coalesce(current_setting('app.purga_simulacao', true), '') = 'on' then return old; end if;
  raise exception 'partida_evento e append-only (% bloqueado)', tg_op using errcode = '42501';
end $$;
create trigger partida_evento_imutavel_row before update or delete on public.partida_evento
  for each row execute function public.partida_evento_imutavel();
create trigger partida_evento_imutavel_stmt before truncate on public.partida_evento
  for each statement execute function public.partida_evento_imutavel();

create table if not exists public.partida_assinatura (
  id            uuid primary key default gen_random_uuid(),
  partida_id    integer not null references public."Partida"(id) on delete restrict,
  papel         text not null check (papel in ('ARBITRO_1','ARBITRO_2','APONTADOR','CAPITAO_A','CAPITAO_B','TECNICO_A','TECNICO_B')),
  evento_id     bigint not null references public.partida_evento(id),   -- o evento ASSINATURA correspondente
  nome          text not null,
  hash_conteudo bytea not null,                      -- hash do estado final assinado
  assinado_em   timestamptz not null default now(),
  unique (partida_id, papel)
);

-- RPC única de escrita: lock por partida, versão otimista e idempotência
create or replace function public.registrar_eventos_partida(
  p_partida_id integer, p_seq_esperada integer, p_eventos jsonb,
  p_ator_tipo text, p_ator_ref text, p_dispositivo text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_atual integer; v_novos integer := 0; v_dup integer := 0; v_ev jsonb; v_seq integer; v_hash_ant bytea;
  v_hash bytea; v_aprovada timestamptz; v_cid uuid; v_tipo text;
begin
  if jsonb_typeof(p_eventos) <> 'array' or jsonb_array_length(p_eventos) = 0 or jsonb_array_length(p_eventos) > 200 then
    raise exception 'Lote de eventos invalido' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('partida_evento:' || p_partida_id, 0));

  select "sumulaAprovadaEm" into v_aprovada from "Partida" where id = p_partida_id;
  if not found then raise exception 'Partida inexistente' using errcode = 'P0002'; end if;

  select coalesce(max(seq), 0) into v_atual from partida_evento where partida_id = p_partida_id;
  select hash into v_hash_ant from partida_evento where partida_id = p_partida_id and seq = v_atual;

  -- reenvio idempotente (fila offline): conta quantos do lote já existem
  select count(*) into v_dup from jsonb_array_elements(p_eventos) e
   where exists (select 1 from partida_evento x where x.partida_id = p_partida_id
                 and x.cliente_evento_id = (e->>'cliente_evento_id')::uuid);
  if v_dup < jsonb_array_length(p_eventos) and p_seq_esperada is not null and p_seq_esperada <> v_atual then
    raise exception 'Conflito de versao da sumula' using errcode = '40001', detail = v_atual::text;
  end if;

  for v_ev in select value from jsonb_array_elements(p_eventos) loop
    v_cid := (v_ev->>'cliente_evento_id')::uuid; v_tipo := v_ev->>'tipo';
    continue when exists (select 1 from partida_evento where partida_id = p_partida_id and cliente_evento_id = v_cid);
    if v_aprovada is not null and v_tipo <> 'CORRECAO' then
      raise exception 'Sumula oficial: apenas CORRECAO e aceita' using errcode = '23514'; end if;
    v_seq := v_atual + v_novos + 1;
    v_hash := digest(coalesce(v_hash_ant, '\x') ||
              convert_to(p_partida_id || '|' || v_seq || '|' || v_tipo || '|' || coalesce(v_ev->'payload','{}'::jsonb)::text
                         || '|' || v_cid, 'UTF8'), 'sha256');
    insert into partida_evento(partida_id, seq, cliente_evento_id, tipo, set_numero, equipe_id, jogador_id, payload,
      ator_tipo, ator_ref, dispositivo_id, ocorrido_cliente_em, desfaz_evento_id, motivo, versao_regras, hash_anterior, hash)
    values (p_partida_id, v_seq, v_cid, v_tipo, (v_ev->>'set_numero')::smallint, (v_ev->>'equipe_id')::integer,
      (v_ev->>'jogador_id')::integer, coalesce(v_ev->'payload','{}'::jsonb), p_ator_tipo, p_ator_ref, p_dispositivo,
      (v_ev->>'ocorrido_cliente_em')::timestamptz, (v_ev->>'desfaz_evento_id')::bigint, v_ev->>'motivo',
      v_ev->>'versao_regras', v_hash_ant, v_hash);
    v_hash_ant := v_hash; v_novos := v_novos + 1;
  end loop;
  return jsonb_build_object('seq_atual', v_atual + v_novos, 'inseridos', v_novos, 'duplicados', v_dup);
end $$;
revoke all on function public.registrar_eventos_partida(integer, integer, jsonb, text, text, text) from public, anon, authenticated;
grant execute on function public.registrar_eventos_partida(integer, integer, jsonb, text, text, text) to service_role;

-- Projeção do placar por set (pontos válidos = PONTO não desfeito). Regras de set/partida ficam no motor de regras.
create or replace view public.vw_partida_pontos_por_set with (security_invoker = true) as
select p.id as partida_id, e.set_numero,
       count(*) filter (where e.equipe_id = p."equipeAId") as pontos_a,
       count(*) filter (where e.equipe_id = p."equipeBId") as pontos_b,
       max(e.seq) as ultimo_seq
from "Partida" p
join partida_evento e on e.partida_id = p.id and e.tipo = 'PONTO'
where not exists (select 1 from partida_evento d
                  where d.partida_id = e.partida_id and d.tipo = 'DESFAZ' and d.desfaz_evento_id = e.id)
group by p.id, e.set_numero;

-- Purga exclusiva de campeonato de simulação (a limpeza da central usa esta função, não DELETE direto)
create or replace function public.purgar_eventos_simulacao(p_liga_id integer) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not exists (select 1 from "Liga" where id = p_liga_id and simulacao = true) then
    raise exception 'Liga nao e de simulacao' using errcode = '42501'; end if;
  perform set_config('app.purga_simulacao', 'on', true);
  delete from partida_assinatura where partida_id in (select id from "Partida" where "ligaId" = p_liga_id);
  delete from partida_evento where partida_id in (select id from "Partida" where "ligaId" = p_liga_id);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.purgar_eventos_simulacao(integer) from public, anon, authenticated;
grant execute on function public.purgar_eventos_simulacao(integer) to service_role;

-- RLS: leitura só do organizador dono da liga; escrita só pela RPC (service_role)
alter table public.partida_evento enable row level security;
alter table public.partida_assinatura enable row level security;
revoke all on public.partida_evento, public.partida_assinatura from anon, authenticated;
grant all on public.partida_evento, public.partida_assinatura to service_role;
-- fase B (com claim no JWT):
-- grant select on public.partida_evento to authenticated;
-- create policy partida_evento_org_sel on public.partida_evento for select to authenticated
--   using (exists (select 1 from "Partida" p where p.id = partida_id and public.eh_organizador_da_liga(p."ligaId")));
commit;
```

### 4.3 Contrato mínimo do `payload` (o motor de regras valida, o banco só garante a forma)

| `tipo` | Colunas | `payload` |
|---|---|---|
| `PONTO` | `equipe_id`, `set_numero`, `jogador_id?` | `{"origem":"ACE|ATAQUE|BLOQUEIO|ERRO_ADV|SANCAO","placar_apos":[a,b],"saque_equipe_id":n}` |
| `DESFAZ` | `desfaz_evento_id`, `motivo` | `{}` |
| `SUBSTITUICAO` | `equipe_id`, `set_numero` | `{"sai":jogador_id,"entra":jogador_id,"excepcional":false,"posicao":1}` |
| `TROCA_LIBERO` | `equipe_id`, `set_numero` | `{"libero":id,"substituido":id,"posicao":5}` (não consome cota de substituições) |
| `TEMPO` / `TEMPO_TECNICO` | `equipe_id`, `set_numero` | `{"placar_apos":[a,b]}` |
| `PAPELETA_ENVIADA` / `_CONFIRMADA` | `equipe_id`, `set_numero` | `{"posicoes":[id x6],"libero":id,"capitao":id,"saque_inicial":bool}` |
| `SANCAO` | `equipe_id`, `jogador_id?` | `{"nivel":"AMARELO|VERMELHO|DESQUALIFICACAO","motivo":"..."}` |
| `PROTESTO` / `OBSERVACAO` | `equipe_id?` | `{"texto":"..."}` |
| `CORRECAO` | `desfaz_evento_id?`, `motivo` | `{"campo":"...","antes":...,"depois":...,"aprovado_por":"ORGANIZADOR"}` |
| `ASSINATURA` | | `{"papel":"ARBITRO_1","hash_conteudo":"..."}` |

### 4.4 Plano de adoção

1. Criar a tabela, a RPC e a view em preview; testes de concorrência (dois dispositivos, mesma partida: o segundo recebe `40001` e relê) e de idempotência (reenviar o mesmo lote devolve `duplicados` = N).
2. `api/sumula/[token]` passa a chamar `registrar_eventos_partida` para partidas marcadas como novo modo (flag por `Liga`/`Partida` no servidor, sem coluna nova em `Partida`: usar a existência de eventos como marcador).
3. Ao encerrar, o servidor materializa a projeção em `SetPartida`/`Partida` **dentro da mesma transação** de uma RPC de encerramento (resolve D16) e chama `recalcular_classificacao_liga`.
4. Partidas antigas não são retroconvertidas; o histórico legado continua válido. Para auditoria cruzada, opcionalmente importar sets antigos como um único evento `OBSERVACAO` de origem `LEGADO` (decisão de produto).
5. A janela de correção de 30 minutos (requisito aprovado e pendente, `SUMULA-DIGITAL-E-CLASSIFICACAO.md`) é regra do servidor sobre `CORRECAO`; o banco já impede qualquer outra alteração depois da oficialização.
6. Ponto de atenção: a purga por `FK ... on delete restrict` significa que apagar `Partida` com eventos falha; a limpeza da central de simulação deve chamar `purgar_eventos_simulacao` antes (alterar `src/lib/simulacao*.ts`, fora do escopo deste agente).

---

## 5. Plano de seed para ambiente local

### 5.1 Pré-requisitos e travas

- **Banco local apenas** (Postgres/Supabase local), nunca preview compartilhado nem produção. O script `scripts/seed-local.ts` (a criar, não existe) aborta se: o host de `NEXT_PUBLIC_SUPABASE_URL` não for `localhost`/`127.0.0.1`/`[::1]`, se a URL contiver `supabase.co`, se a branch for `main`, ou se `select count(*) from "Liga" where "seedKey" is null` for maior que zero sem `--permitir-dados-existentes`.
- **Baseline aplicado antes** (D8). Sem baseline o seed não roda; é a mesma dependência do `docs/analise/18-ambiente-local-e-ci.md` (ambiente local e CI).
- `package.json` já cita `prisma/seed.ts` inexistente e a nota cita `npm run seed:test` inexistente; ambos devem ser trocados por `npm run seed:local` (cross-platform, sem `set VAR=...&&`).
- **Credenciais:** nada fixo no repositório. A senha dos usuários de teste vem de `SEED_SENHA` em `.env.local` (ignorado pelo git) e o hash bcrypt é gerado pelo script na hora. E-mails no domínio reservado `.test`. Os valores não devem ser repetidos em documentos nem em respostas.
- **Dados pessoais fictícios:** nomes sintéticos com prefixo `Seed`. CPF só em 4 atletas, necessários para testar identidade única e fusão, gerados de forma determinística com dígito verificador válido, guardados em `scripts/seed-local.fixtures.json`. Não são pessoas reais, mas um CPF válido pode coincidir com um real por acaso: nunca usar fora do banco local.
- **Idempotência:** `seedKey` com prefixo `SEEDLOCAL-` nas tabelas legadas que já têm a coluna e índice único (`Liga`, `Equipe`, `Jogador`, `Partida`); nas tabelas novas, ids determinísticos `md5('seedlocal:<tabela>:<chave>')::uuid` com `on conflict (id) do nothing`.
- **Reset:** recriar o volume do banco local (`supabase db reset` ou recriar o container) em vez de apagar linhas, pois `partida_evento` e `auditoria_evento` são append-only.

### 5.2 Massa

| Item | Quantidade | Detalhe |
|---|---|---|
| Organizadores | 2 | **Org Alfa** e **Org Beta** (`CandidaturaOrganizador` com `status = 'ATIVA'`, `trocarSenha = false`, e-mails `.test`) + espelho em `usuario`/`organizador`/`organizador_membro` |
| Competições | 3 | **C1** Alfa, `ATIVA`, categorias FEMININO e MISTO, melhor de 3 sets, 25 pontos e 15 no tie-break, pontos corridos · **C2** Alfa, `EM_BREVE`, inscrições abertas, categoria MASCULINO, `tokenInscricao` e link de inscrição ativo · **C3** Beta, `ATIVA`, categoria FEMININO (mesmo código de C1 para provar isolamento entre organizadores) |
| Clubes / times | 3 / 4 | **K1** (Seed Águias FEM e Seed Jaguares FEM, clube com 2 times) · **K2** Seed Tubarões FEM · **K3** Seed Falcões MASC |
| Inscrições | 4 | Águias e Tubarões em C1/FEMININO `APROVADA` · Falcões em C2/MASCULINO `PENDENCIA` (com comentário do organizador) · Jaguares em C3/FEMININO `ENVIADA` |
| Atletas | 32 | Águias 10 e Tubarões 10 · Falcões 8 (**1 menor de 16 anos com consentimento `PENDENTE`**, para provar o bloqueio de envio) · Jaguares 4 novos + **6 reaproveitados das Águias** (mesma identidade em dois organizadores) · 4 deles com CPF fictício para teste de unicidade; 1 líbero por time (`posicao = 'LB'`) |
| Partida em andamento | 1 | C1/FEMININO: Águias x Tubarões, `EM_ANDAMENTO`, árbitro com `AcessoArbitroJogo` (token e código gerados pelo script, só o hash do código no banco). Eventos: sorteio, papeletas dos dois lados, **set 1 encerrado 25 x 21** e **set 2 em andamento 12 x 10**, 1 substituição, 1 troca de líbero, 1 tempo, 1 `DESFAZ` de um ponto |
| Outras partidas | 2 | uma `AGENDADA` (volta Tubarões x Águias) e uma `ENCERRADA` da mesma categoria com `SetPartida` legado (para exercitar a projeção legada e a classificação) |

### 5.3 Ordem de carga

1. `usuario`, `usuario_legado`, `CandidaturaOrganizador` (2), `organizador`, `organizador_membro`.
2. `Liga` (3, com `seedKey`, `simulacao = false`, `organizadorId = CandidaturaOrganizador.id`) → `selecionar_categorias_campeonato(p_liga_id, p_categorias jsonb, p_organizador_id text)` com `[{"codigo":"FEMININO"},{"codigo":"MISTO"}]` etc. (assinatura de `202609230008:33`) → `salvar_configuracao_categoria` para formato e regras de set.
3. `regra_elenco` por categoria (mínimo 6, máximo 14, líberos 2, faixa de idade por data).
4. `clube`, `clube_membro`, `time_clube`, `time_membro`, `atleta`, `atleta_sensivel` (cifrado pelo script com chave local de teste), `vinculo_atleta_clube`, `time_atleta`, `consentimento_responsavel`.
5. `inscricao` e `inscricao_atleta` em `RASCUNHO`, depois `UPDATE` de status pelas transições válidas (assim o seed também exercita `inscricao_transicao` e `inscricao_validar_envio`; o menor sem consentimento deve **falhar** no envio e ficar em `PENDENCIA`/`RASCUNHO` por desenho do teste).
6. Para as aprovadas, criar `Equipe`, `Jogador` e `InscricaoCampeonato` legados (`seedKey`, `categoriaCampeonatoId` obrigatório para não acionar o erro de `touch_category_operation`) e gravar `inscricao.equipe_id` e `inscricao_atleta.jogador_id`.
7. `Partida` (3) com `seedKey`, `AcessoArbitroJogo`, `SumulaPresenca` dos presentes, e eventos pela RPC:

```sql
-- esboço do passo de eventos (executado pelo script como service_role; gera ids determinísticos)
do $$
declare v_partida integer; v_a integer; v_b integer; v_lote jsonb := '[]'::jsonb; i integer; n integer := 0;
begin
  select id, "equipeAId", "equipeBId" into v_partida, v_a, v_b from "Partida" where "seedKey" = 'SEEDLOCAL-PARTIDA-01';
  v_lote := v_lote || jsonb_build_object('cliente_evento_id', md5('seedlocal:ev:0')::uuid, 'tipo','PARTIDA_INICIADA');
  v_lote := v_lote || jsonb_build_object('cliente_evento_id', md5('seedlocal:ev:1')::uuid, 'tipo','SET_INICIADO','set_numero',1);
  -- set 1: 25 x 21 intercalado
  for i in 1..46 loop
    n := n + 1;
    v_lote := v_lote || jsonb_build_object('cliente_evento_id', md5('seedlocal:s1:'||i)::uuid, 'tipo','PONTO',
      'set_numero',1,'equipe_id', case when i % 2 = 1 and i <= 42 then v_a when i <= 42 then v_b
                                        when i <= 46 then v_a end,
      'payload', jsonb_build_object('origem','ATAQUE'));
  end loop;
  -- ... SET_ENCERRADO(1), SET_INICIADO(2), 22 pontos (12 x 10), SUBSTITUICAO, TROCA_LIBERO, TEMPO, DESFAZ
  perform registrar_eventos_partida(v_partida, 0, v_lote, 'SISTEMA', 'seed-local', 'seed');
end $$;
```

(Os pontos acima são ilustrativos: o script deve produzir exatamente 25 x 21 e 12 x 10, e o teste de seed confere pela view `vw_partida_pontos_por_set`.)

### 5.4 Verificações do seed (viram testes do agente de QA)

| Id | Verificação | Esperado |
|---|---|---|
| V-IDEM | rodar o seed duas vezes | contagens idênticas, nenhuma exceção, `seedKey` sem duplicata |
| V-PLACAR | `vw_partida_pontos_por_set` da partida em andamento | set 1 = 25 x 21, set 2 = 12 x 10 (o `DESFAZ` removeu um ponto e o placar já o desconta) |
| V-ISO | com um JWT de Org Alfa (fase B) e no servidor com a regra `exigirOrganizadorDa*`: listar inscrições, times e atletas | Alfa vê Águias, Tubarões e Falcões; **não** vê Jaguares nem atletas de C3; Beta vê só Jaguares e os 6 atletas em comum, **sem** o restante do banco do clube K1 |
| V-ID | atleta com CPF em Águias e Jaguares | uma única linha em `atleta`; duas linhas em `inscricao_atleta` em categorias de organizadores distintos |
| V-EXCL | tentar inscrever um atleta já ativo numa segunda equipe da mesma categoria | erro de `inscricao_atleta_exclusividade_uq` |
| V-MENOR | enviar a inscrição dos Falcões com o menor sem consentimento | `inscricao_validar_envio` recusa; com consentimento `CONCEDIDO` passa |
| V-APPEND | `update`/`delete` em `partida_evento` | falha com `42501` |
| V-CONC | duas chamadas simultâneas de `registrar_eventos_partida` com a mesma `seq_esperada` | uma conclui, a outra recebe `40001` |
| V-ANON | com a chave `anon` local: `Jogador`, `CandidaturaOrganizador`, `atleta`, `partida_evento` | nenhuma linha sensível devolvida (confirma a correção de D1 a D3 no ambiente local) |

### 5.5 Ligação com os seeds existentes

`scripts/seed-torneio-2026.sql`, `seed-link-flow-2026.sql` e `seed-fluxo-cadastro-2026.sql` já são idempotentes por `seedKey` e geram 10 campeonatos e 400 partidas; são úteis para carga e paginação, mas não cobrem o novo modelo nem têm usuários prontos para login. O `seed-local` proposto é **pequeno e legível** (3 competições, 4 times) e roda por cima do baseline; os seeds grandes ficam como opção `--massa`. Os três dependem de `supabase-acesso-arbitro-jogo.sql` já aplicado (comentário no próprio arquivo), então só funcionam após o baseline.

---

## 6. Próximos passos recomendados (ordem)

1. **Hoje, sem alterar nada:** rodar A1 a A10 em preview restaurado de backup e o teste de contrato da chave anon; registrar o resultado. Isso decide a urgência de D1 a D7.
2. Migration única de contenção de segurança (D1 a D6) depois do ensaio, com reversão; por pedido do usuário e com backup.
3. Baseline do schema (D8) e renomeação das migrations; sem isso não há ambiente local nem CI reprodutíveis.
4. Aplicar 3.3 a 3.5 (fase A) e 4.2 em preview; decidir D-1 a D-3.
5. Backfill F2 em preview com dados sanitizados; revisar `atleta_fusao_pendente`.
6. Só então mudar o código (`finalizar_inscricao_equipe_rascunho`, `api/sumula/[token]`, limpeza de simulação) atrás de *feature flag*.

Notas consultadas: `CLAUDE.md`, `06-BANCO-DE-DADOS.md`, `docs/analise/01-diagnostico-volei-space.md`, `docs/PROMPT-volei-space.md`. Nada foi commitado, nenhuma migration foi criada em `supabase/migrations` e nenhum banco foi acessado.
