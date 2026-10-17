# 22. Baseline do schema, ensaio local e checklist por migration (Rodada 2)

Data: 2026-10-16. Agente: banco de dados, Rodada 2, branch `feat/r2-banco-pendentes` (a partir de `teste-integrado`).
**Nenhum SQL foi executado em banco algum e nenhum segredo foi usado.** Tudo aqui foi escrito e revisado por leitura; o SQL nunca passou por um parser do Postgres. Marcação: **[claro]** vem dos arquivos; **[a verificar]** depende do banco real ou de um primeiro ensaio.

Continua os arquivos `07-revisao-banco-de-dados.md`, `16-plano-aplicacao-migrations.md` e `19-qa-integracao.md`. Arquivos desta rodada: `supabase/pendentes/**` (revisadas), `supabase/seed.sql`, `supabase/config.toml`, `scripts/migracoes-pendentes.test.ts` (`npm run test:migracoes-pendentes`).

## 1. Decisão de produto aplicada: inscrição automática

`Inscricao.status` agora aceita exatamente `RASCUNHO`, `CONFIRMADA`, `CONFIRMADA_COM_PENDENCIAS`, `AJUSTE_PEDIDO`, `REMOVIDA` (`202610170026`). Saíram `ENVIADA`, `EM_ANALISE`, `PENDENCIA`, `APROVADA`, `RECUSADA`, `LISTA_ESPERA`, `CANCELADA` e a constraint que exigia motivo na recusa. Foi acrescentada `Inscricao.avisos jsonb not null default '[]'` (CHECK: array), também por `add column if not exists`. Nenhuma tabela ou coluna foi renomeada: `decididaEm`, `motivoDecisao`, `comentarioPendencia`, `enviadaEm`, `equipeLegadoId`, `inscricaoCampeonatoLegadoId` mantêm o nome (o backend e o frontend estão sendo escritos contra eles). Mudou só o significado, documentado no cabeçalho: remoção ou pedido de ajuste.

Efeitos derivados: o índice único `Inscricao_categoria_time_key` e o espelho `InscricaoAtleta.inscricaoAtiva` passam a usar `status <> 'REMOVIDA'` (trigger `inscricao_propaga_estado` idem); remover uma inscrição libera o time e os atletas na categoria.

Sobras que continuam existindo e que o dono deve conhecer [claro]:
- `PedidoTroca.status` (`PENDENTE/APROVADO/RECUSADO/CANCELADO`) permanece: é a troca de atleta depois do prazo, outra decisão. Se a troca também for automática, trocar por `REGISTRADO/CANCELADO`.
- Legado: `Liga.inscricaoAprovacaoAutomatica` (default false) e `InscricaoCampeonato.status` (`SOLICITADA/APROVADA/REJEITADA`) ainda existem e alimentam o achado M3 do `19-qa-integracao.md`. O CHECK `inscricao_campeonato_status_chk` (0018) continua aceitando esses valores de propósito: é a tabela antiga. Ligar o default dessa flag para `true` (ou ignorá-la no backend) é decisão de backend, não desta migration.

## 2. Revisão das migrations pendentes: o que foi achado e corrigido

| # | Arquivo | Achado | Gravidade | Correção feita |
|---|---|---|---|---|
| 1 | 0005, 0007, 0008, 0010, 0011, 0012, 0015, 0016 | Os 8 índices têm o mesmo nome e as mesmas colunas de `supabase/migrations/202610090002_indices_chaves_estrangeiras.sql`. As migrations são no-op (`if not exists`). | Baixa | Aviso no cabeçalho de cada uma; podem ser descartadas na promoção. |
| 2 | rollback dos mesmos 8 | O `drop index concurrently` da reversão **derrubaria o índice da migration oficial** (mesmo nome). | **Alta** (reversão destrutiva) | Reversão virou no-op explicado (`select 1;`). O teste proíbe `drop index` quando o nome existe nas oficiais. |
| 3 | 0018 | O CHECK de `Partida.status` não aceitava `PENDENTE_APROVACAO` (usado por `src/app/admin/page.tsx` e `admin/partidas/page.tsx`) nem `FINISHED` (tolerado por `classificacao_*`). Qualquer UPDATE de súmula submetida falharia com 23514. | **Alta** (quebra a súmula) | Os dois valores entraram na lista. Rodar Q9/P5 antes mesmo assim. |
| 4 | 0003 (view `jogador_publico`) | A view expunha jogadores de campeonato de simulação/privado (`Liga.simulacao = true`) a `anon`. | Média (privacidade, menores) | Acrescentado `coalesce(l.simulacao,false) = false`. |
| 5 | 0026 | Status de aprovação manual e lista de espera (ver seção 1). | Decisão do dono | Reescrito. |
| 6 | todas | Cabeçalhos apontavam `supabase/rollback/`; o caminho real é `supabase/pendentes/rollback/`. | Baixa | Corrigido em todas. |
| 7 | 0003 | Passo 5 troca o `grant select` de `Partida` por lista fixa de colunas lida **no momento da execução**. Coluna criada depois não é concedida a anon. | Média, a verificar | Nenhuma mudança; acrescentar a coluna ao grant quando uma migration futura criar coluna pública em `Partida`. |
| 8 | 0020 | A FK `Partida_vencedorId_fkey` usa `NO ACTION` (as outras FKs de `Partida` usam `on delete restrict`). Efeito prático igual; trocar para `on update cascade on delete restrict` se se quiser uniformidade. | Baixa | Mantido. |

Verificado sem problema [claro]: sintaxe aparente de todas as funções PL/pgSQL (`rate_limit_hit`, `registrar_evento_sumula`, `purgar_eventos_simulacao`, triggers de `Inscricao`); tipos das FKs (`Partida.id/Equipe.id/Jogador.id` inteiros, `InscricaoCampeonato.id` text, `CategoriaCampeonato(id uuid, ligaId)` com `unique (id, ligaId)` em `202609220001`); nenhuma tabela, função ou view nova colide com `supabase/migrations`; versões `202610170001..26` sequenciais e posteriores à maior oficial (`20261011025731`); colunas da tabela `RateLimit` batem com `src/lib/rate-limit.ts` (`chave, contagem, expiraEm`).

### Dependências de ordem [claro]
- 0025 depende de 0024 (`Clube`); 0026 depende de 0024 e 0025 (`TimeClube`, `Atleta`) e de `202609220001` (`CategoriaCampeonato` única por `(id, ligaId)`); 0023 depende de `Liga.simulacao` (`202609290002`). 0019 só depois de 0018; 0021 só depois de 0020.
- 0003 e 0004 não dependem de nenhuma pendente, mas dependem do **deploy do código sem client anon e com upload assinado** (não é migration).

### Riscos de lock e de trigger [claro, a confirmar em ensaio]
- `touch_category_operation` (`202609220003`) roda por linha em `Equipe`, `Jogador`, `Partida`, `SetPartida`, `SumulaPresenca` etc., pega `pg_advisory_xact_lock` por categoria e incrementa `CategoriaCampeonato.revisaoOperacional`. **Nenhuma pendente faz UPDATE/INSERT nessas tabelas.** A etapa 2 do M2 (reescrita de URLs em `Jogador`) faria; por isso é em lotes pequenos e fora de rodada (`16`, seção 6).
- 0002, 0003, 0018 a 0026: `begin; set local lock_timeout = '5s'`. Se estourar, nada é aplicado e se repete depois. `ADD CONSTRAINT ... FOREIGN KEY` (0020, 0023, 0024, 0026) pega `SHARE ROW EXCLUSIVE` nas duas tabelas por instantes; `VALIDATE` (0019, 0021) só `SHARE UPDATE EXCLUSIVE`, não bloqueia escrita.
- 0022 reescreve `Pagamento` com `ACCESS EXCLUSIVE`: DESTRUTIVO, janela própria, backup antes.
- 0005 a 0017: um comando cada, sem transação (`create index concurrently`). Não pode haver `begin` no arquivo; o teste garante.
- 0023 impede `DELETE`/`UPDATE`/`TRUNCATE` em `SumulaEvento` (inclusive de `service_role`). Depois que houver evento, apagar `Partida`, `Equipe` ou `Jogador` referenciados falha por FK `restrict`; a limpeza de simulação precisa chamar `purgar_eventos_simulacao(ligaId)` antes.
- 0003 liga RLS em **toda** tabela de `public` que ainda não tem. Qualquer rota que ainda use a chave anon, e qualquer extensão que crie tabela em `public`, é afetada [a verificar com Q1].

## 3. Decisões pendentes do relatório anterior (resolvidas)

1. **`TimeClube` e `MembroEquipe.timeId`: manter os dois nomes.** A `Equipe` legada está presa a `Liga` (`ligaId not null`) e é a equipe *inscrita numa competição*; o time permanente do responsável é outra coisa. Reaproveitar o nome `Equipe` colidiria com a tabela e com o código atual; `timeId` é o nome que o backend em escrita já usa. Também é coerente com `Inscricao."timeId"`. A ponte com o legado é `Inscricao.equipeLegadoId`.
2. **`usuarioId text` sem FK: manter.** Não existe tabela `Usuario`; as identidades hoje são `ContaPublico.id`, `Candidatura*.id` (todos `text`) e o `userId` do JWT próprio. Uma FK uuid para `auth.users` seria falsa. Há índice em `usuarioId` para a RLS futura. Revisitar quando houver tabela de identidade única (item de `07`, seção 2); a migração será `ADD COLUMN` + backfill, sem renomear.
3. **Atleta em um time por categoria (não por campeonato): manter.** A inscrição, a `RegraElenco` e as constraints de `Equipe` já são por categoria, e é comum o mesmo atleta jogar categorias diferentes (adulto e livre, por exemplo) no mesmo campeonato. A regra "uma categoria só" fica no banco (`InscricaoAtleta_exclusividade_key`). Se o dono quiser por campeonato, troca-se só o índice para `("ligaId","atletaId")` (o `ligaId` já está na tabela), sem mexer em dado.
4. **`jogador_publico`: só `ATIVA`, `ENCERRADA`, `FINALIZADO`, sem simulação.** Elenco de campeonato `EM_BREVE` fica fora: é fase de montagem, inclui menores e a equipe ainda pode mudar. O portal continua mostrando equipes (via rota de servidor); se o produto quiser jogadores em "em breve", acrescentar `'EM_BREVE'` ao `where` da view (um `create or replace view`). A view roda com os privilégios do dono, de propósito: é o único caminho público para `Jogador` (o advisor do Supabase pode alertar "security definer view"; é esperado, manter lista fixa de colunas).

## 4. Como gerar a baseline do schema

Por que é necessário [claro]: `supabase/migrations` **não tem** `CREATE TABLE` de `Liga`, `Equipe`, `Jogador`, `Partida`, `SetPartida`, `Pagamento` etc. (nasceram nos antigos `supabase-*.sql` e no Prisma). Um `supabase db reset` num banco vazio falha na primeira migration que referencia `"Liga"`. `prisma/schema.prisma` está defasado e não serve de fonte.

Regras: nunca dump da produção ao vivo; sem senha na linha de comando nem no repositório; só estrutura (sem dados).

1. **Obter um banco de origem seguro.** Restaurar o backup (ou PITR) da produção para um projeto Supabase descartável de restore, ou clonar o preview (D7: o projeto de desenvolvimento). Confirmar que é o mesmo schema de produção comparando as contagens de Q1, Q6 e Q7 (`16`, seção 3) entre os dois.
2. **Guardar a string de conexão do restore numa variável de ambiente da sessão** (`DB_URL_RESTORE`), sem escrever em arquivo versionado nem histórico compartilhado.
3. **Dump só da estrutura**, com a CLI do Supabase (Node e Docker já são decisão D8):
   - schema `public`: `supabase db dump --db-url "$DB_URL_RESTORE" --schema public -f baseline-public.sql`
   - confirmar que o arquivo não tem `INSERT`/`COPY` (`grep -c "^COPY\|^INSERT" baseline-public.sql` deve dar 0).
4. **Objetos que o dump de `public` não traz:**
   - Buckets e policies de Storage: Q4 e Q5. Transcrever como `insert into storage.buckets ... on conflict do nothing` e `create policy` idempotentes, **já no estado final desejado** (bucket `atleta-arquivos` privado, `jogador-fotos-rosto` público; ver 0004).
   - Extensões usadas (`pgcrypto`, `uuid-ossp`, o que Q10 listar): `create extension if not exists`.
   - Grants de `anon`, `authenticated`, `service_role`: já saem no dump; revisar contra o estado esperado da seção 5.
5. **Limpar o arquivo:** remover `OWNER TO`, `ALTER DEFAULT PRIVILEGES` que não sejam do projeto, comentários com nomes de pessoas e qualquer coisa de `Jogador`, `Pagamento` ou `Admin` que não seja DDL. Ele não pode conter dado pessoal nem segredo.
6. **Decidir o ponto da baseline** (decisão do dono, `16` seção 7.6):
   - **Opção A (recomendada):** baseline = estado **atual** da produção. Salvar como `supabase/migrations/202609010000_baseline.sql` e mover as migrations `2026092000xx` ... `20261011025731` para `supabase/legacy/` (a CLI só lê a pasta `migrations`). Motivo: várias dessas migrations **não são idempotentes** (por exemplo `create trigger` sem `drop` em `202609220003`) e quebrariam se repetidas por cima de uma baseline que já as contém. Em produção só se registra: `supabase migration repair --status applied 202609010000` (apenas escreve em `supabase_migrations.schema_migrations`).
   - **Opção B:** baseline = estado anterior a `202609200001`. Só é possível se existir um backup antigo; preserva a pasta atual. [a verificar] se há backup nessa data.
7. **Prova de equivalência** (local): `supabase start`, aplicar a baseline num banco vazio, depois `supabase db diff` contra o dump do restore: deve sair vazio. Qualquer diferença é objeto faltando na baseline.
8. Só depois disso as pendentes podem ser promovidas (seção 6).

## 5. Ensaio local, passo a passo (nada em produção)

Pré-requisitos (D8): Node 22, Docker Desktop e Supabase CLI instalados. Nada disso foi testado nesta rodada.

1. Na raiz: `supabase start` (o `supabase/config.toml` desta rodada é o esqueleto mínimo; `major_version = 15` precisa ser conferido com a versão do projeto remoto [a verificar]). Anotar as chaves locais que a CLI imprimir; **não** copiá-las para arquivo versionado.
2. Banco limpo com a baseline: `supabase db reset` (aplica `migrations/` e depois `seed.sql`). Se a baseline ainda não existir, o reset falha; o seed não pode ser validado antes dela.
3. Antes de promover qualquer pendente, rodar `npm run test:migracoes-pendentes` (estático, não precisa de banco).
4. Promover **uma** pendente por vez: copiar de `supabase/pendentes/migrations/` para `supabase/migrations/`, `supabase db reset` (ou `supabase migration up`), ler o erro. Qualquer erro de sintaxe volta ao autor do arquivo.
   - O teste `scripts/rls-publico.test.mjs` proíbe migrations novas que criem tabela ou concedam leitura a `anon` depois da migration de RLS. As pendentes criam tabelas (RLS ligada, sem grant) e 0003 concede `select` na view `jogador_publico`: ajustar o teste junto com a promoção, com decisão consciente (já anotado em `supabase/pendentes/LEIA-ME.md`).
   - 0005 a 0017: se a CLI embrulhar o arquivo em transação, `create index concurrently` falha com "cannot run inside a transaction block" [a verificar]. Aplicar por `psql` e registrar com `supabase migration repair --status applied <versão>`.
5. Para 0003: rodar nos dois cenários da seção 2 do `16` (com e sem as migrations da main).
6. Conferir com a chave **anon local** (HTTP) os testes de contrato de cada migration (`16`, seção 5). Conferir a view: `GET /rest/v1/jogador_publico?select=*` só devolve `id,nome,numero,posicao,fotoUrl,equipeId`, e **nenhum** jogador da competição `seed-r2-copa-privada`.
7. Rollback: aplicar o arquivo de `supabase/pendentes/rollback/` correspondente e conferir que o estado volta (as reversões de 0003, 0004, 0022 e 0023 são parciais ou destrutivas; ler o cabeçalho de cada uma).
8. Preview compartilhado (projeto de desenvolvimento, D7) só depois do local verde. Produção só com aprovação do dono, backup e janela (`16`, seções 4 e 9).

Seed (`supabase/seed.sql`) [claro]: 2 organizadores (`CandidaturaOrganizador`, sem senha), 3 competições (aberta, privada com `simulacao = true` e `LinkInscricaoCampeonato`, encerrada), 4 equipes, 24 atletas, 1 partida `EM_ANDAMENTO` (mais 1 agendada e 1 encerrada). Idempotente por `seedKey`/id fixo (`SEED-R2-*`). Dados fictícios: CPF `000.000.000-0X` (inválido), e-mail `@seed.invalid`, telefone `0000000000X`. Fora do seed, por incerteza: tabelas das pendentes, campos de inscrição de `Liga` cujo DDL não está no repositório, presença de súmula e código de árbitro (usar `scripts/massa-acesso-arbitro.ts`). Cuidado: `seedKey` existe em `Liga`, `Partida`, `Equipe` e `Jogador` (`202610010002`, `202610010003`); nunca rodar o seed em produção (`07`, seção 5).

## 6. Checklist por migration

Marcar cada linha só quando o ensaio local passar. "Gate" é a condição extra antes de produção. Risco e janela completos estão no cabeçalho de cada arquivo.

| N | Arquivo | Ensaio local | Gate de produção | Reversão |
|---|---|---|---|---|
| 0001 | `rate_limit` | [ ] RLS ligada; `anon` sem SELECT/EXECUTE; `rate_limit_hit` devolve 1 e 2 | Aprovação; aditiva | Apaga contadores (sem valor); backend volta ao store em memória antes |
| 0002 | `liga_pagamento_origem` | [ ] coluna nullable; CHECK recusa valor fora de `simulado/gateway` | Aprovação; fora de rodada | Drop da coluna e do CHECK |
| 0003 | `fechar_leitura_publica_pii` | [ ] asserções finais passam; `anon` lê 0 linhas de `Jogador`, `Equipe`, `InscricaoCampeonato`; view sem jogador de simulação | Código sem client anon no ar e estável; Q2/Q3 guardadas; janela de madrugada | Parcial (parte A); fiel só com dump de Q2/Q3 |
| 0004 | `bucket_atleta_privado` | [ ] `atleta-arquivos` privado; `jogador-fotos-rosto` público; sem policy anon citando `atleta-arquivos` | Backup dos objetos; rota de upload/URL assinada no ar; janela própria | Reabre documentos: só emergência |
| 0005, 0007, 0008, 0010, 0011, 0012, 0015, 0016 | índices duplicados da oficial | [ ] no-op (nada criado) | **Descartar** na promoção | No-op |
| 0006, 0009, 0013, 0014, 0017 | índices novos | [ ] `indisvalid = true`; `explain` usa o índice; sem índice INVALID | Baixa carga; P4 conferido | `drop index concurrently` |
| 0018 | `checks_estado_not_valid` | [ ] 6 constraints existem; `Partida` aceita `PENDENTE_APROVACAO` | Q7 e Q9 sem valor fora das listas | `drop constraint` |
| 0019 | `checks_estado_validate` | [ ] `convalidated = true` | P5 = 0; um dia depois de 0018 | Já coberta pela reversão de 0018 |
| 0020 | `partida_vencedor_fk_not_valid` | [ ] FK existe, não validada | Aprovação | `drop constraint` |
| 0021 | `partida_vencedor_fk_validate` | [ ] validada | P6 = 0 | Coberta pela reversão de 0020 |
| 0022 | `pagamento_valor_numeric_DESTRUTIVO` | [ ] tipo `numeric(12,2)`; soma igual | **Backup com contagem e checksum**; P7; decisão sobre arredondamento; confirmação explícita; janela própria | Volta a `double precision`, sem recuperar precisão perdida |
| 0023 | `sumula_evento_append_only` | [ ] UPDATE/DELETE/TRUNCATE falham (42501); RPC idempotente; `seq` sem lacuna | Ensaio em preview; backend só adota depois | Apaga eventos: só antes de haver evento real |
| 0024 | `meu_time_organizador_clube` | [ ] 5 tabelas com RLS e sem grant | Aprovação; fora de rodada | Drop (dados novos se perdem) |
| 0025 | `meu_time_atleta` | [ ] PII só em `AtletaDocumento`; índices únicos de hash | Idem; LGPD de menores revisada | Drop |
| 0026 | `meu_time_inscricao` | [ ] status só os 5 novos; unique ignora `REMOVIDA`; remover inscrição libera atleta (trigger); 2 capitães / número repetido falham | Idem | Drop das 5 tabelas e 2 funções |
| 0027 | `meu_time_comissao_time` (Rodada 3) | [ ] `ComissaoTime` com RLS e sem grant para anon/authenticated; função restrita aos 5 valores; `InscricaoComissao.comissaoTimeId` nullable com FK `set null` | Depois de 0024 e 0026 | Drop da coluna e da tabela (dados novos se perdem) |
| 0028 | `meu_time_atleta_lote_posicao` (Rodada 3) | [ ] `Atleta.posicao`, `numeroPreferido` (0..99); origem `LOTE` aceita; nascimento nulo só com `LOTE`/`MIGRACAO`; conferir o nome real do CHECK de origem (`Atleta_origem_check`) | Depois de 0025 | Recusa se houver atleta `LOTE`; apaga as 2 colunas |
| 0029 | `sumula_evento_tipos_motor` (Rodada 3) | [ ] CHECK `SumulaEvento_tipo_check` aceita os tipos de `src/lib/regras-volei/eventos.ts` e os da 0023; `payload` documentado | Depois de 0023; conferir o nome real do CHECK | Recusa se houver tipo novo gravado (tabela append-only) |
| 0030 | `liga_visibilidade` (Rodada 6) | [ ] `Liga.visibilidade` not null default `PUBLICA`, CHECK `Liga_visibilidade_check`; linhas antigas ficam `PUBLICA`; sem grant novo para anon; marcar uma liga de teste `PRIVADA` e conferir que some das listas públicas e exige convite na inscrição | Fora de rodada; código tolera a coluna ausente | Apaga a coluna (privadas voltam a ser públicas) |
| 0031 | `rls_visibilidade_publica` (Rodada 7) | [ ] `pg_policies.qual` de `luv_public_select_*` e `categoria_publica` cita `visibilidade`; policies ausentes (SetPartida, ClassificacaoEntrada) continuam ausentes; sem grant novo; com chave anon, liga `PRIVADA` não aparece em `Liga`, `CategoriaCampeonato`, `Partida`, `jogador_publico`; pela rota do servidor (slug) ainda abre; `explain` das leituras anon sem seq scan em `Liga` | Depois de 0030 e 0003 (aborta se faltar); fora de rodada; guardar `pg_policies` e `pg_get_viewdef` antes | Devolve as expressões originais (privadas voltam a ser legíveis por anon) |
| 0032 | `lgpd_menores_consentimento` (Rodada 8) | [ ] `AtletaConsentimento` e `AtletaExclusaoPedido` com RLS e sem grant para anon/authenticated; índice único parcial de consentimento ativo por atleta; `responsavelContatoCifrado` é `bytea`; `Atleta.anonimizadoEm` nullable; nenhuma linha antiga alterada | Depois de 0025; `LGPD_CHAVE_CIFRA` definida no ambiente; texto do termo validado pelo jurídico | Drop das 2 tabelas e da coluna (DESTRUTIVO: apaga prova de aceite e de exclusão; exportar antes) |
| 0033 | `banco_acesso` (Rodada 9) | [ ] `BancoAcesso` com RLS e sem grant para anon/authenticated; `tokenHash` único e not null (nenhuma coluna de token em claro); FKs para `Partida` e `Equipe` | `Partida` e `Equipe` existentes; fora de rodada | Drop da tabela (links emitidos deixam de valer) |
| 0034 | `papeleta` (Rodada 9) | [ ] `Papeleta` com RLS e sem grant; única por partida+equipe+set; `formacao` com 6 itens; trigger `papeleta_imutavel_trg`: `update` de `formacao`/`liberoId`/`capitaoId` em ENVIADA/ACEITA falha, `delete` fora de RASCUNHO falha, ACEITA não muda de estado | `Partida`, `Equipe`, `Jogador` existentes; fora de rodada | Drop do trigger, da tabela e da função (DESTRUTIVO se houver papeletas; exportar antes) |
| 0035 | `pedido_banco` (Rodada 9) | [ ] `PedidoBanco` com RLS e sem grant; `tipo` e `estado` restritos; `payload` objeto jsonb; índice `(partidaId, estado)` | `Partida` e `Equipe` existentes | Drop da tabela (histórico de pedidos) |
| 0036 | `convite_atleta` (Rodada 10) | [ ] `ConviteAtleta` com RLS e sem grant; `tokenHash` único e not null (sem coluna de token em claro); `estado` restrito; FK `equipeId` para `TimeClube` e `atletaId` para `Atleta` | 0024 e 0025 aplicadas; fora de rodada | Drop da tabela (convites emitidos deixam de valer) |
| 0037 | `importacao_atletas` (Rodada 10) | [ ] `ImportacaoAtletas` com RLS e sem grant; `estado` restrito; `linhas` jsonb array not null | 0024 aplicada | Drop da tabela (perde prévias não confirmadas) |
| 0038 | `clube_equipe` (Rodada 10) | [ ] `ClubeEquipe` única por clube+equipe, RLS e sem grant; `Clube.donoUserId` existe e é nullable; `Clube` NÃO recriada | 0024 aplicada | Drop de `ClubeEquipe` e da coluna `donoUserId` (não toca `Clube`) |
| 0039 | `notificacao` (Rodada 10) | [ ] `Notificacao` com RLS e sem grant; índice `(destinatarioUserId, lidaEm)`; `payload` objeto jsonb | nenhum | Drop da tabela |

Rascunho EXPERIMENTAL, fora da sequência e do teste de numeração: `supabase/pendentes/experimental/registrar_inscricao_meu_time.sql` (função `registrar_inscricao_meu_time(p_payload jsonb)`, cria `Inscricao`, `InscricaoAtleta` e `InscricaoComissao` numa transação; não revalida regras de negócio; execute só para `service_role`). Nunca executada: ensaiar em preview antes de o backend trocar a compensação por ela. As regras de elenco continuam no servidor.

## 7. Isolamento entre organizadores e exposição de dados pessoais (pontos a decidir)

- As tabelas novas são fechadas por RLS sem policy: só `service_role` acessa. O isolamento A x B continua sendo do servidor; `Inscricao` tem `ligaId` e `categoriaCampeonatoId` para a policy por organizador da fase B [claro]. `Liga.organizadorUuid` (0024) ainda não é usado pela RLS.
- `Liga`, `Partida` (menos `sumulaToken`), `Mensagem`, `Premiacao`, `Midia` continuam legíveis por `anon` nos campeonatos publicados (policies `luv_public_select_*`). Campeonato privado só fica oculto se o filtro `simulacao = false`/`ativo` for respeitado em toda consulta pública [a verificar com Q2]: a policy de `Liga` não o aplica sozinha.
- `CategoriaCampeonato` tem a policy `categoria_publica using (true)`: lê categorias de qualquer campeonato, inclusive privado. [a verificar]; sugestão: restringir pela mesma regra de `Liga`. Resolvido na pendente 0031 (Rodada 7), que também filtra `Liga`, `Partida`, `Equipe`, `Premiacao`, `Midia`, `Mensagem` e a view `jogador_publico`.
- Menores: `Atleta.dataNascimento` fica na tabela principal; CPF, documento, telefone e responsável ficam cifrados em `AtletaDocumento` [claro]. A chave de cifra fica no aplicativo, fora do banco.

## 8. Ambiente e limites desta rodada

- O worktree não tinha `node_modules` e **não foi possível criar a junção** (o ambiente bloqueou `mklink`/`New-Item -Junction` e `ln -s` sem privilégio). O teste foi executado com `node --experimental-strip-types scripts/migracoes-pendentes.test.ts` (Node 24) e passou, e foi checado com `tsc --noEmit --strict`. O comando oficial `npm run test:migracoes-pendentes` usa `with-ts-node.mjs`, que exige `node_modules` no diretório atual: rodar no checkout principal depois do merge.
- Falhas anteriores e conhecidas, não tocadas: `category-selection`, `category-setup-state`, `rls-publico.test.mjs`, `sumula-transacional`.
- O SQL (migrations, rollbacks e seed) nunca foi parseado por um Postgres.
