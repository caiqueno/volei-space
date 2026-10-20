# 16. Plano de aplicação das migrations da Fase 0 (banco de dados)

Data: 2026-10-16. Agente: banco-de-dados. Branch: `feat/banco-migrations-fase0` (a partir de `teste-integrado`).
**Nenhum SQL foi executado em banco algum (nem local, nem remoto); nenhuma credencial foi usada.** Os arquivos abaixo só foram escritos e revisados por leitura. Nada foi parseado por um Postgres: o primeiro ensaio (banco local ou preview) é obrigatório e pode revelar erro de sintaxe.

Fontes: `07-revisao-banco-de-dados.md` (M1 a M7), `13-revisao-seguranca.md` (C1, C2), `14-banco-de-dados.md`, `PLANO-FASE-0-PARA-APROVACAO.md` (seção 5), `DECISOES-FASE-0.md` (D3, D4b, D5, D7).

Legenda: **[claro]** vem do SQL versionado · **[a verificar]** depende do banco real.

## 1. Inventário das migrations novas

Convenção: `20261017NNNN_nome.sql` em `supabase/migrations/`, reversão de mesmo nome em `supabase/rollback/`. Todas idempotentes, com cabeçalho (objetivo, pré-requisitos, quebra de rotas, backup, janela). Ordem de segurança primeiro.

| N | Arquivo | Tema | Natureza | Risco | Quebra rotas |
|---|---|---|---|---|---|
| 0001 | `202610170001_rate_limit.sql` | Tabela `RateLimit` (D3) + `rate_limit_hit`/`rate_limit_limpar` | Aditiva | Baixo | Não |
| 0002 | `202610170002_liga_pagamento_origem.sql` | `Liga.pagamentoOrigem` + CHECK (D4b) | Aditiva | Baixo | Não |
| 0003 | `202610170003_fechar_leitura_publica_pii.sql` | M1: RLS, drop `public_read_*`, revoke, view `jogador_publico` | Fecha acesso | **Alto** | **Sim** (lista no cabeçalho) |
| 0004 | `202610170004_bucket_atleta_privado.sql` | M2 etapa 1: bucket privado, `jogador-fotos-rosto`, colunas `*Legado` | Fecha acesso | **Alto** | **Sim** (uploads e URLs) |
| 0005 a 0017 | `2026101700NN_idx_*.sql` (13 arquivos) | M6: um `create index concurrently if not exists` por arquivo | Aditiva | Baixo | Não |
| 0018 | `202610170018_checks_estado_not_valid.sql` | M7 etapa 1: CHECKs `not valid` | Restritiva | Médio | Pode rejeitar escrita |
| 0019 | `202610170019_checks_estado_validate.sql` | M7 etapa 2: `validate` | Varre tabelas | Baixo/Médio | Não |
| 0020 | `202610170020_partida_vencedor_fk_not_valid.sql` | M7 etapa 3: FK `Partida.vencedorId` `not valid` | Restritiva | Médio | Pode rejeitar escrita |
| 0021 | `202610170021_partida_vencedor_fk_validate.sql` | M7 etapa 4: `validate` | Varre tabela | Baixo | Não |
| 0022 | `202610170022_pagamento_valor_numeric_DESTRUTIVO.sql` | M7: `Pagamento.valor` para `numeric(12,2)` | **DESTRUTIVO** | **Alto** | Sim (tipo no driver) |
| 0023 | `202610170023_sumula_evento_append_only.sql` | M5: `SumulaEvento`, triggers, RLS, RPC `registrar_evento_sumula` | Aditiva | Médio | Não |
| 0024 | `202610170024_meu_time_organizador_clube.sql` | M3: `Organizador`, `MembroOrganizador`, `Clube`, `TimeClube`, `MembroEquipe`, `Liga.organizadorUuid` | Aditiva | Baixo | Não |
| 0025 | `202610170025_meu_time_atleta.sql` | M4a: `Atleta`, `AtletaDocumento`, `VinculoAtletaClube` | Aditiva | Baixo | Não |
| 0026 | `202610170026_meu_time_inscricao.sql` | M4b: `RegraElenco`, `Inscricao`, `InscricaoAtleta`, `InscricaoComissao`, `PedidoTroca` | Aditiva | Baixo | Não |
| 0027 | `202610170027_meu_time_comissao_time.sql` | R3: `ComissaoTime` e `InscricaoComissao.comissaoTimeId` | Aditiva | Baixo | Não |
| 0028 | `202610170028_meu_time_atleta_lote_posicao.sql` | R3: `Atleta.posicao`, `numeroPreferido`, origem `LOTE` | Afrouxa CHECK | Baixo | Não |
| 0029 | `202610170029_sumula_evento_tipos_motor.sql` | R3: CHECK de tipo de `SumulaEvento` com os tipos do motor | Afrouxa CHECK | Baixo | Não |
| 0030 | `202610170030_liga_visibilidade.sql` | R6: `Liga.visibilidade` (`PUBLICA` padrão, `PRIVADA`) com CHECK; competição privada só por link e exige convite | Coluna not null com default constante | Baixo | Não |
| 0031 | `202610170031_rls_visibilidade_publica.sql` | R7: `alter policy` das leituras públicas (`Liga`, `CategoriaCampeonato`, `Equipe`, `Partida` e filhas) e da view `jogador_publico` para excluir `visibilidade = 'PRIVADA'`; sem grant, sem policy nova | Restritiva (só para anon/authenticated) | Médio | Não (o anon só é usado em Realtime e Storage) |
| 0032 | `202610170032_lgpd_menores_consentimento.sql` | R8: `AtletaConsentimento` (aceite do responsável de menor, contato cifrado no app, versão do termo, revogação), `AtletaExclusaoPedido` (auditoria de exclusão) e `Atleta.anonimizadoEm`; RLS ligada, sem grant para anon/authenticated | Aditiva | Baixo | Não (sem ela todo menor aparece como pendente e o DELETE só desativa o vínculo) |
| 0033 | `202610170033_banco_acesso.sql` | R9: `BancoAcesso` (acesso do banco por link; só `tokenHash` único, expiração e revogação); RLS ligada, sem grant para anon/authenticated | Aditiva | Baixo | Não (sem ela o app de banco não emite acesso) |
| 0034 | `202610170034_papeleta.sql` | R9: `Papeleta` (formação jsonb de 6, líbero, capitão, estados RASCUNHO/ENVIADA/ACEITA, única por partida+equipe+set) e trigger `papeleta_imutavel_trg` (RG-FOR-006: sem alterar formação/líbero/capitão depois de ENVIADA/ACEITA); segundo líbero opcional `libero2Id` (FK `Jogador`, set null; CHECK diferente de `liberoId`; também imutável após ENVIADA/ACEITA); RLS ligada, sem grant | Aditiva | Baixo | Não (sem ela a papeleta digital não grava) |
| 0035 | `202610170035_pedido_banco.sql` | R9: `PedidoBanco` (TEMPO, SUBSTITUICAO, DESAFIO; PENDENTE/ACEITO/RECUSADO/CANCELADO; índice por partida+estado); RLS ligada, sem grant | Aditiva | Baixo | Não (sem ela o banco não envia pedidos) |
| 0036 | `202610170036_convite_atleta.sql` | R10: `ConviteAtleta` (só `tokenHash` único, `contatoCifrado` opcional e reservado ao contato do atleta convidado, sem uso na leitura e nunca devolvido por rota, estados por carimbos (`revogadoEm`, `usadoEm`)`expiraEm`, `atletaId`); `equipeId` aponta para `TimeClube`; `cienciaLgpdEm` e `cienciaVersao` (registro da ciência do aviso de privacidade no aceite); RLS ligada, sem grant | Aditiva | Baixo | Não (sem ela não há convite ao atleta) |
| 0037 | `202610170037_importacao_atletas.sql` | R10: `ImportacaoAtletas` (prévia da planilha em `linhas` jsonb até o líder confirmar; RASCUNHO/CONFIRMADA/DESCARTADA); contém PII; inclui `expiraEm` (padrão agora + 72 h, índice próprio): a prévia expira em 72 h e uma rotina deve apagá-las; retenção do que for confirmado: definir com o jurídico; RLS ligada, sem grant | Aditiva | Baixo | Não |
| 0038 | `202610170038_clube_equipe.sql` | R10: `ClubeEquipe` (clube com várias equipes, única por clube+equipe) e coluna `Clube.donoUserId` (nullable). **`Clube` já nasce na 0024 e não é recriada.** **NÃO APLICAR: redundante com `TimeClube.clubeId`, o backend não a usa; mantida só como referência.** RLS ligada, sem grant | Aditiva | Baixo | Não |
| 0039 | `202610170039_notificacao.sql` | R10: `Notificacao` (usuarioId texto, tipo, titulo, mensagem, dados objeto, `lidaEm`; índice `(usuarioId, lidaEm)`); retenção a definir com o jurídico; RLS ligada, sem grant | Aditiva | Baixo | Não |
| 0040 | `202610170040_scout_acao.sql` | R11: `ScoutAcao` (ação de scout de quadra: fundamento, resultado, zonas 1..9, rotação 1..6, placar no momento, `anuladoEm`); única por `(partidaId, clientEventId)` para reenvio offline; índice `(partidaId, setNumero)`; RLS ligada, sem grant | Aditiva | Baixo | Não |
| 0041 | `202610170041_desafio_video.sql` | R11: `DesafioVideo` (SOLICITADO, EM_ANALISE, MANTIDA, REVERTIDA, INCONCLUSIVA, CANCELADO; estado final exige `decididoEm`; `motivo` e `linkVideo` até 500; FK opcional para `PedidoBanco`, set null); índice `(partidaId, setNumero, equipeId)`; RLS ligada, sem grant | Aditiva | Baixo | Não |
| 0042 | `202610170042_expurgo_previas_importacao.sql` | R13: função `public.expurgar_previas_importacao()` (security definer, `search_path = public`) que apaga de `ImportacaoAtletas` as prévias `PREVIA` com `expiraEm` vencido e devolve a contagem; execute revogado de public/anon/authenticated e concedido só a `service_role`; NÃO agenda nada (agendar por pg_cron ou rota de cron da Vercel via service role, decisão à parte) | Aditiva (só função) | Baixo | Não (sem ela as prévias vencidas só somem por rotina externa) |
| 0043 | `202610170043_solicitacao_inscricao.sql` | R14: coluna `CategoriaCampeonato.modoInscricao` (`AUTOMATICA` padrão ou `APROVACAO`; fica na categoria porque a `Inscricao` é por categoria) e tabela `SolicitacaoInscricao` (`timeId` -> `TimeClube` cascade; `categoriaId`+`ligaId` -> `CategoriaCampeonato`; `PENDENTE`/`APROVADA`/`RECUSADA`/`CANCELADA`; `mensagem` e `motivoRecusa` até 500; `decididoEm` obrigatório em `APROVADA`/`RECUSADA`; `inscricaoId` -> `Inscricao` set null; único parcial `(timeId, categoriaId)` onde `PENDENTE`; índices `(categoriaId, estado)` e `(timeId, estado)`); `Notificacao` (0039) não muda, o organizador usa a mesma tabela por `usuarioId`; RLS ligada, só `service_role`. Aborta se faltar `TimeClube`, `Inscricao` ou `CategoriaCampeonato` | Aditiva | Baixo | Não (sem ela o líder não solicita participação) |
| 0044 | `202610170044_solicitacao_atletas_escolhidos.sql` | R14b: coluna `SolicitacaoInscricao.atletasEscolhidos uuid[]` (nula = seleção automática do banco do time); guarda a escolha do líder até o organizador aprovar. A ponte `Inscricao.equipeLegadoId` (0026) não muda de forma: o servidor passa a preenchê-la. Aborta se faltar `SolicitacaoInscricao` (0043); RLS e grants da tabela inalterados (só `service_role`) | Aditiva | Baixo | Não (sem ela o campo `atletas` em categoria com aprovação responde 503; em categoria automática funciona sem a coluna) |

Observação sobre a ordem pedida pelo plano (5.2: M1, M2, M6, M7) e a numeração: M5 (0023) e M3/M4 (0024 a 0026) vêm depois de M7 por serem aditivas e sem urgência de segurança. M5 e M3/M4 não dependem de M6/M7 e podem ser aplicadas antes delas em preview.

Decisões pendentes que mudam estes arquivos (nada foi presumido em silêncio):

1. **`TimeClube` (equipe permanente).** A lista pedida não tem a equipe permanente do responsável e a `Equipe` legada está presa a `Liga`. Criei `TimeClube`; `MembroEquipe` usa a coluna `timeId` (o texto do 07 diz `equipeId`). Confirmar o nome.
2. **`usuarioId` é `text` sem FK** em `MembroOrganizador`, `MembroEquipe`, `Atleta.usuarioId` etc., porque não existe tabela `Usuario` e os ids legados (`ContaPublico`, `Candidatura*`) são texto.
3. **D-1** exclusividade do atleta por categoria (como está) ou por campeonato (14, seção 3.1).
4. **`jogador_publico` só mostra ligas ATIVA/ENCERRADA/FINALIZADO** (07, M1). A policy antiga `luv_public_select_jogador` também incluía EM_BREVE: o elenco de um campeonato "em breve" deixa de aparecer no portal. Se o produto quiser mostrar, acrescentar `'EM_BREVE'` no `where` da view (arquivo 0003, passo 6).
5. **CHECKs de 0018 são superconjuntos** do que o código escreve. Apertar depois de Q9. `Equipe.categoria` usa checagem de formato porque `202609230008` abriu categorias personalizadas (uma lista fixa de 5 valores quebraria escritas legítimas).
6. **Equipe e InscricaoCampeonato fechadas por completo** em 0003 (o gate da Fase 0 exige que a chave anon leia 0 linhas). Liga, Partida (sem `sumulaToken`), Mensagem, Premiacao, Midia continuam com leitura anon limitada às policies `luv_public_select_*`. Fechar o resto exige o código sair do client anon também para essas tabelas.

## 2. Divergência importante: `teste-integrado` x `main`

A branch `teste-integrado` (base desta entrega) tem **52** migrations e termina em `202610060002`. A `main` (commit `c365d8a`, "Consolida as PRs") tem **mais 30** migrations que **não estão** em `teste-integrado`, entre elas:

- `202610060004_fechar_acesso_anonimo`, `202610060005_fechar_rpc_anonimo`, `202610090001_revogar_execute_public_default`, `202610100002_fechar_leitura_publica_placar`, `20261010140000_habilitar_rls_tabelas_publicas`, `20261010141000_leitura_publica_sets_classificacao`: já fazem parte do que M1 faz (revoke total, RLS, funções).
- `202610090002_indices_chaves_estrangeiras`, `20261010015632_indices_consultas_quentes`, `20261011025731_indices_fks_sem_cobertura`: criam vários índices do M6 (mesmos nomes onde coincidem, ver arquivos 0005 a 0017).
- `20261010137000_sumula_transacional` e outras: tocam a súmula (verificar sobreposição com M5 antes de adotar a RPC).

Consequências para a aplicação:

- **Q10 decide.** `select * from supabase_migrations.schema_migrations` diz quais dessas rodaram em produção. As migrations desta entrega são **idempotentes e compatíveis** com ambos os cenários (repetem revokes sem efeito colateral, `if not exists` por nome). Os índices de 0005 a 0017 que têm o mesmo nome dos da main viram no-op; os demais (`Equipe_ligaId_categoriaCampeonatoId_idx`, `Partida_ligaId_categoriaCampeonatoId_status_dataHora_idx`, `VotoMVP_categoria_serie_idx`, `Mensagem_ligaId_aprovada_idx`, `CandidaturaEquipe_ligaId_status_idx`) são novos. `OcorrenciaPartida_partidaId_idx` e `Jogador_equipeId_idx` ficam redundantes se existirem índices compostos com o mesmo prefixo (`OcorrenciaPartida_partidaId_set_idx`, `Jogador_equipeId_numero_nome_idx` da main): conferir em Q6 e pular o arquivo se for o caso.
- Todas as versões `20261017NNNN` ordenam depois de qualquer migration da main (`20261011025731` é a maior), então o merge das duas linhas não reordena nada.
- O `revoke all ... on all tables` de `202610060004` e o fechamento de `202610100002` valem para o papel que rodou a migration; tabela nova criada por `supabase_admin` pode nascer concedida a `anon`. As migrations novas fazem `revoke` explícito em cada tabela que criam, por isso não dependem de default privileges.
- Decisão de merge (humana): integrar `main` em `teste-integrado` antes de aplicar M1, para a pasta refletir o que roda em produção.

## 3. Consultas somente leitura a rodar ANTES (Q1 a Q13)

Rodar no SQL Editor do Supabase, uma por vez. Retornam metadados ou contagens; **não colar linhas de `Jogador` nem de `Pagamento`**. Guardar o resultado de Q2, Q3, Q3b e Q5 **fora do repositório** como ponto de reversão. Em produção só com aprovação do dono. Q9 e Q13 assumem nomes de coluna vistos nos docs; se falharem, ajustar ao DDL real.

```sql
-- Q1. RLS por tabela
select c.relname as tabela, c.relrowsecurity as rls_ligado, c.relforcerowsecurity as rls_forcado
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' order by c.relrowsecurity, c.relname;

-- Q2. Policies do schema public
select tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public' order by tablename, cmd, policyname;

-- Q2b. Só as permissivas abertas
select tablename, policyname, roles, cmd, qual from pg_policies
where schemaname = 'public' and (qual = 'true' or with_check = 'true') order by tablename;

-- Q3. Grants de tabela para anon/authenticated
select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as privilegios
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated')
group by table_name, grantee order by grantee, table_name;

-- Q3b. Grants por coluna para anon
select table_name, column_name, grantee, privilege_type
from information_schema.role_column_grants
where table_schema = 'public' and grantee = 'anon' order by table_name, column_name;

-- Q3c. Funções expostas
select routine_name, grantee, privilege_type from information_schema.role_routine_grants
where routine_schema = 'public' and grantee in ('anon', 'authenticated', 'public') order by routine_name;

-- Q4. Buckets
select id, name, public, file_size_limit, allowed_mime_types from storage.buckets order by id;

-- Q5. Policies do Storage
select policyname, cmd, roles, qual, with_check from pg_policies
where schemaname = 'storage' and tablename = 'objects' order by policyname;

-- Q5b. Volume por bucket (sem nomes)
select bucket_id, count(*) as objetos from storage.objects group by bucket_id order by 2 desc;

-- Q6. Índices existentes
select tablename, indexname, indexdef from pg_indexes where schemaname = 'public' order by tablename, indexname;

-- Q6b. Índices nunca usados e tamanho
select relname as tabela, indexrelname as indice, idx_scan, pg_size_pretty(pg_relation_size(indexrelid)) as tamanho
from pg_stat_user_indexes where schemaname = 'public' order by idx_scan, relname;

-- Q7. Constraints CHECK e FK
select conrelid::regclass as tabela, conname, contype, pg_get_constraintdef(oid) as def
from pg_constraint where connamespace = 'public'::regnamespace and contype in ('c','f') order by 1, 2;

-- Q8. Tipo de Pagamento.valor e resto de centavos
select data_type, numeric_precision, numeric_scale from information_schema.columns
where table_schema='public' and table_name='Pagamento' and column_name='valor';
select count(*) as linhas, max(abs(valor*100 - round(valor*100))) as maior_resto_centavos from "Pagamento";

-- Q9. Valores distintos de status (para os CHECK de 0018)
select 'Liga' t, status::text v, count(*) from "Liga" group by 2
union all select 'Partida', status::text, count(*) from "Partida" group by 2
union all select 'InscricaoCampeonato', status::text, count(*) from "InscricaoCampeonato" group by 2
union all select 'Equipe.statusEquipe', "statusEquipe"::text, count(*) from "Equipe" group by 2
union all select 'Equipe.serie', coalesce(serie::text, '(nulo)'), count(*) from "Equipe" group by 2
union all select 'Equipe.categoria (tamanho fora de 1..40)', categoria::text, count(*) from "Equipe"
  where char_length(btrim(categoria)) not between 1 and 40 or categoria is null group by 2
order by 1, 2;

-- Q10. Migrations registradas e extensões
select * from supabase_migrations.schema_migrations order by 1;
select extname from pg_extension order by 1;

-- Q11. Triggers e funções
select event_object_table, trigger_name, action_timing, event_manipulation
from information_schema.triggers where trigger_schema='public' order by 1,2;
select proname, prosecdef as security_definer, proconfig
from pg_proc where pronamespace = 'public'::regnamespace and prokind = 'f' order by 1;

-- Q12. Consultas lentas (se pg_stat_statements existir)
select calls, round(mean_exec_time::numeric,1) as ms_medio, left(query,120) as query
from pg_stat_statements order by total_exec_time desc limit 20;

-- Q13. Dados sensíveis presentes (só contagem)
select count(*) filter (where "cpf" is not null) as com_cpf,
       count(*) filter (where "dataNascimento" is not null) as com_nascimento,
       count(*) filter (where "documentosUrls" is not null) as com_documentos
from "Jogador";
```

Consultas de apoio por migration (também somente leitura):

```sql
-- P1 (0003): quem ainda lê o quê com a chave anon (esperado após a migration: nenhuma linha para PII)
select table_name, privilege_type from information_schema.role_table_grants
where table_schema='public' and grantee='anon' order by 1,2;

-- P2 (0004): jogadores com URL de atleta-arquivos gravada (só contagem; define o tamanho da etapa 2)
select count(*) filter (where "fotoUrl" like '%/atleta-arquivos/%') as foto,
       count(*) filter (where "fotoRostoUrl" like '%/atleta-arquivos/%') as rosto,
       count(*) filter (where "documentosUrls" like '%/atleta-arquivos/%') as docs
from "Jogador";

-- P3 (0004, etapa 2): Jogador sem categoria na Equipe (UPDATE em lote falharia no trigger de categoria)
select count(*) from "Jogador" j join "Equipe" e on e.id = j."equipeId"
where e."categoriaCampeonatoId" is null;

-- P4 (0005 a 0017): índices equivalentes já existentes (comparar com Q6 por tabela/colunas)
select tablename, indexname, indexdef from pg_indexes
where schemaname='public' and tablename in
 ('Jogador','Equipe','Partida','SumulaPresenca','OcorrenciaPartida','VotoMVP','Mensagem','Midia','Premiacao','CandidaturaEquipe')
order by tablename, indexname;

-- P5 (0019): violações por CHECK (esperado 0 em todas)
select count(*) from "Liga" where status not in ('RASCUNHO','EM_BREVE','ATIVA','ENCERRADA','FINALIZADO','CANCELADA') or status is null;
select count(*) from "Partida" where status not in ('AGENDADA','EM_ANDAMENTO','ENCERRADA','CANCELADA','WO','FINALIZADA','APROVADA') or status is null;
select count(*) from "InscricaoCampeonato" where status not in ('SOLICITADA','PENDENTE','PENDENTE_APROVACAO','APROVADA','REJEITADA','CANCELADA') or status is null;
select count(*) from "Equipe" where "statusEquipe" not in ('PENDENTE','ATIVA','INATIVA') or "statusEquipe" is null;
select count(*) from "Equipe" where serie is not null and serie not in ('OURO','PRATA');

-- P6 (0021): órfãos em Partida.vencedorId (esperado 0)
select count(*) from "Partida" p
where p."vencedorId" is not null and not exists (select 1 from "Equipe" e where e.id = p."vencedorId");

-- P7 (0022): pagamentos em andamento (esperado 0) e checksum para o backup
select count(*) filter (where status = 'AGUARDANDO') as aguardando, count(*) as total from "Pagamento";
```

## 4. Ordem de aplicação

Pré-passo A (uma vez): rodar Q1 a Q13 e guardar Q2, Q3, Q3b, Q5 fora do repositório. Confirmar plano e backup diário/PITR do Supabase de produção.
Pré-passo B: ensaiar **tudo** em banco local (Supabase CLI) e em preview (projeto de dev, D7), nesta ordem, com os testes da seção 5.

Ordem em produção (cada linha só com aprovação explícita, fora de rodada):

| Passo | Migrations | Condição para liberar |
|---|---|---|
| 1 | 0001, 0002 | Aprovação. Podem ir juntas, antes ou depois do código B2/B5; aditivas. |
| 2 | **Deploy do código** sem client anon (rotas da seção "Quebra de rotas" do cabeçalho de 0003) e rota de upload/URL assinada (M2) | `SUPABASE_SERVICE_ROLE_KEY` confirmada na Vercel; estável por um ciclo. Não é migration. |
| 3 | 0003 (M1) | Passo 2 estável; Q2/Q3 guardadas; janela de madrugada em dia sem jogos. |
| 4 | 0004 (M2 etapa 1) | Backup dos objetos de `atleta-arquivos` conferido; código de upload/URL assinada no ar; janela separada de M1. |
| 5 | M2 etapa 2 (reescrita de URLs, seção 6) | Só depois de 0004 estável; item destrutivo. |
| 6 | 0005 a 0017 (M6), um arquivo por vez | Baixa carga; P4 conferido; pular os redundantes. |
| 7 | 0018, depois 0019 | Q7 e Q9 conferidas; P5 = 0. Espaçar 0018 e 0019 por pelo menos um dia de operação. |
| 8 | 0020, depois 0021 | P6 = 0. |
| 9 | 0022 (DESTRUTIVO) | Backup de `Pagamento`/`Partida` com contagem e checksum; P7 sem pagamento em andamento; Q8; decisão sobre arredondamento; código tolerante a `numeric`. Janela própria. |
| 10 | 0023 (M5) | Ensaio dos testes de imutabilidade e da RPC em preview. O backend só adota a RPC depois. |
| 11 | 0024, 0025, 0026 (M3, M4) | Ensaio em preview; decisões pendentes da seção 1 respondidas. |
| 12 | 0027, 0028, 0029 (Rodada 3) | Depois de 0026, 0025 e 0023 respectivamente; conferir os nomes reais dos CHECKs em preview. |
| 13 | 0030 (Rodada 6) | Qualquer momento fora de rodada; o código tolera a coluna ausente. Decidir à parte se a policy pública de `Liga` passa a filtrar `visibilidade = 'PUBLICA'`. |
| 14 | 0031 (Rodada 7) | Depois de 0030 e de 0003 (aborta se faltar). Fora de rodada, com o resultado de `pg_policies` e `pg_get_viewdef('public.jogador_publico')` guardado. Ensaiar em preview com uma liga `PRIVADA`: anon não lê `Liga`, `CategoriaCampeonato`, `Partida`; a rota por slug (service_role) segue abrindo. |
| 15 | 0032 (Rodada 8) | Depois de 0025. Definir `LGPD_CHAVE_CIFRA` (32 bytes em base64, fora do banco) no ambiente ANTES de liberar o cadastro de responsável; sem a chave a API responde 503 ao gravar. Ensaiar em preview: aceite, revogação, DELETE de atleta com anonimização. Texto do termo e retenção dependem do jurídico (ver 25). |
| 16 | 0033, 0034, 0035 (Rodada 9) | Depois das tabelas `Partida`, `Equipe` e `Jogador` (já existem); independentes entre si; fora de rodada. Ensaiar em preview: papeleta ENVIADA recusa `update` de `formacao`/`liberoId`/`capitaoId` e `delete`; `BancoAcesso` com mesmo `tokenHash` falha; anon não lê nenhuma das três. O backend grava só o hash do token. |
| 17 | 0036 a 0039 (Rodada 10) | 0036 e 0037 depois de 0024 e 0025 (`TimeClube`, `Atleta`); 0038 depois de 0024; 0039 independente. Fora de rodada. Decisões pendentes: `equipeId` é `TimeClube` (uuid), não a `Equipe` legada; `ClubeEquipe` é N:N e redundante com `TimeClube.clubeId` se o produto só quiser 1:N (dispensar 0038 nesse caso). Ensaiar em preview: `tokenHash` repetido falha; anon não lê nenhuma das quatro; reversão da 0038 não derruba `Clube`. |
| 18 | 0040, 0041 (Rodada 11) | Depois de `Partida`, `Equipe` e `Jogador` (já existem); 0041 também depois da 0035 (`PedidoBanco`; aborta se faltar). Fora de rodada. Ensaiar em preview: `clientEventId` repetido na mesma partida falha, em outra partida passa; zona 10 e rotação 7 falham; `MANTIDA` sem `decididoEm` falha; apagar o `PedidoBanco` deixa `pedidoBancoId` nulo; anon não lê nenhuma das duas; a reversão da 0041 não derruba `PedidoBanco`. |
| 19 | 0042 (Rodada 13) | Depois da 0037 (`ImportacaoAtletas`; aborta se faltar). Fora de rodada. Ensaiar em preview: com uma prévia vencida e outra válida, a função apaga só a vencida e devolve 1; `CONFIRMADA` vencida não é tocada; anon e authenticated recebem permission denied ao chamar. Agendar só depois do ensaio. |
| 20 | 0043 (Rodada 14) | Depois de 0024, 0026 e 0039 (0039 não é exigida pelo SQL, mas é o canal de aviso; as outras duas abortam se faltarem). Fora de rodada. Ensaiar em preview: categorias existentes ficam `AUTOMATICA`; `modoInscricao` inválido falha; segunda solicitação `PENDENTE` do mesmo time na mesma categoria falha, mas passa se a primeira for `CANCELADA`/`RECUSADA`; `APROVADA` sem `decididoEm` falha; mensagem de 501 caracteres falha; anon e authenticated não leem nem escrevem; a reversão não derruba `Inscricao`. Decisão de produto: o CLAUDE.md descreve a inscrição nova como direta e sem aprovação; `APROVACAO` é opcional por categoria. |
| 21 | 0044 (Rodada 14b) | Depois da 0043 (aborta se faltar). Fora de rodada. Ensaiar em preview: solicitação antiga fica com `atletasEscolhidos` nulo; gravar uma lista de uuids e aprovar usa só esses atletas; a reversão apenas remove a coluna. Sem a 0044 o código segue: solicitação sem `atletas` não depende da coluna. |

Regras de segurança do runner:
- 0005 a 0017 são **um comando sem transação** (`create index concurrently`). Se a CLI embrulhar o arquivo em transação (a verificar em preview), aplicar cada comando pelo SQL Editor ou `psql` e registrar com `supabase migration repair --status applied <versão>`. Índice que falhou no meio fica `INVALID`: `select indexrelid::regclass from pg_index where not indisvalid;` e `drop index concurrently` antes de refazer.
- Nenhuma migration usa `begin/commit` aninhado com outra; as demais têm `begin; set local lock_timeout = '5s'; ... commit;`. Se o `lock_timeout` estourar, a migration falha sem efeito: repetir em horário mais calmo.
- **Nunca reaplicar** os `supabase-*.sql` antigos depois de 0003/0004: `supabase-admin-uploads-portal.sql` e `supabase-storage-uploads-elenco-quadras.sql` recriam `public = true` no bucket e as policies abertas; `supabase-organizador-campeonatos.sql` desliga a RLS e concede escrita a `anon`.

## 5. Verificações de aceite por migration

Em **preview/local** os testes de contrato usam a chave anon por HTTP. Em **produção** só as consultas SQL de leitura.

**0001 RateLimit.** `select relrowsecurity from pg_class where oid = 'public."RateLimit"'::regclass` = true; `has_table_privilege('anon','public."RateLimit"','SELECT')` = false (idem `authenticated`); `has_function_privilege('anon','public.rate_limit_hit(text,integer)','EXECUTE')` = false. Preview: duas chamadas seguidas de `rate_limit_hit('teste',60)` devolvem contagem 1 e 2; chamada de `anon` via REST falha.

**0002 pagamentoOrigem.** Coluna existe e é nullable; `insert`/`update` com valor fora de `simulado`/`gateway` falha (preview); `valid` em `pg_constraint` = true.

**0003 M1.** Q1: nenhuma linha com `rls_ligado = false`. Q2: nenhuma policy `public_read_%`. `has_table_privilege('anon', ..., 'SELECT')` = false para Jogador, Equipe, InscricaoCampeonato, CandidaturaEquipe/Arbitro/Quadra/Organizador, Pagamento, Admin, ContaPublico, Interessado, CodigoAcessoOrganizador, ConviteEquipe, Arbitro. `has_column_privilege('anon','public."Partida"','sumulaToken','SELECT')` = false. P1 sem escrita para anon. Preview, chave anon: `GET /rest/v1/Jogador?select=cpf&limit=1`, `/CandidaturaOrganizador?select=senhaHash&limit=1`, `/Equipe?select=id&limit=1`, `/InscricaoCampeonato?select=id&limit=1` devolvem 401/403 ou `[]`; `PATCH /rest/v1/Liga?id=eq.<id>` falha; `GET /rest/v1/jogador_publico?select=*` devolve só `id,nome,numero,posicao,fotoUrl,equipeId`. **Aceite global da Fase 0:** a chave anon lê 0 linhas de Jogador, Equipe e InscricaoCampeonato. Teste funcional: portal, página de equipe, súmula e painel carregam em preview com o código novo.

**0004 M2.** Q4: `atleta-arquivos` com `public = false`; `jogador-fotos-rosto` com `public = true`. Q5: nenhuma policy de `anon`/`authenticated` cita `atleta-arquivos`; não existe policy de UPDATE para anon. Preview: GET da URL pública antiga de um arquivo de teste devolve 400/404; upload anônimo em `atleta-arquivos` e em `jogador-fotos-rosto` é negado; upload anônimo em `equipe-emblemas` (transitório) ainda funciona; URL assinada gerada pelo servidor abre o arquivo e expira. Q5b: contagem de objetos igual à anterior (nada foi movido). Colunas `*Legado` existem e estão vazias.

**0005 a 0017 M6.** Para cada um: `select indisvalid from pg_index where indexrelid = 'public."<nome>"'::regclass` = true; `explain (analyze off)` de uma consulta típica mostra o índice (ex.: `select * from "Partida" where "equipeAId" = 1`); Q6b acompanhado por uma semana. Nenhum índice `INVALID` restante.

**0018 / 0019 M7 CHECKs.** Q7: as 6 constraints existem; após 0019 `convalidated = true` para todas. Preview: `update "Partida" set status = 'XYZ' where id = <teste>` falha com 23514; fluxos de partida, liga, inscrição e equipe passam nos testes `npm run test:*` existentes.

**0020 / 0021 FK.** `Partida_vencedorId_fkey` existe e `convalidated = true` após 0021; preview: `update "Partida" set "vencedorId" = 999999` falha com 23503; encerrar uma partida de teste grava o vencedor normalmente.

**0022 Pagamento.valor.** Q8: `data_type = 'numeric'`, `numeric_precision = 12`, `numeric_scale = 2`; `select count(*), sum(valor) from "Pagamento"` igual ao backup (diferença só por arredondamento aceito); fluxo de pagamento simulado em preview concluído; webhook (se ainda ativo) lê `valor` sem erro.

**0023 M5.** Preview: `update`/`delete` direto em `SumulaEvento` falham com 42501 (inclusive como `service_role`); `truncate` falha; `select registrar_evento_sumula(<partida>, <uuid>, 'INICIO_SET', ...)` devolve `seq = 1`; repetir o mesmo `clientEventId` devolve `duplicado = true` sem novo `seq`; `p_seq_esperado` errado dá 40001; `DESFAZ` de evento inexistente dá 23503 e desfazer o mesmo evento duas vezes viola `SumulaEvento_desfazId_key`; partida com `sumulaAprovadaEm` preenchido recusa evento (23514); duas sessões simultâneas na mesma partida geram `seq` consecutivos sem lacuna. `has_function_privilege('anon', ..., 'EXECUTE')` = false.

**0024 a 0026 M3/M4.** Para cada tabela nova: `relrowsecurity = true` e `has_table_privilege('anon'|'authenticated', ..., 'SELECT'|'INSERT')` = false (consulta em Q1/Q3). Preview: inserir inscrição duplicada na mesma categoria/time (não recusada) falha; dois atletas com o mesmo número na mesma inscrição falham; segundo capitão falha; o mesmo atleta em duas inscrições vivas da mesma categoria falha, mas passa se a primeira for `RECUSADA`; mudar `Inscricao.status` para `RECUSADA` libera o atleta (trigger).

## 6. M2 etapa 2: reescrita de URLs (fora da migration, destrutiva, só com aprovação)

Não está num arquivo de migration de propósito. Roteiro, em janela própria, depois de 0004 estável:

1. **Backup dos objetos** (cópia fora do projeto) e do dump das colunas de URL, ambos confirmados.
2. **Pré-checagem P3**: `Jogador` cujo `Equipe` não tem `categoriaCampeonatoId` fazem o trigger `touch_category_operation` lançar "Operational write requires a category" (`202609220003:20`). Tratar esses antes, ou excluí-los do lote.
3. **Preencher as colunas de apoio em lotes** (ex.: 200 linhas por execução, entre jogos, repetir até zerar): `update "Jogador" set "fotoUrlLegado" = "fotoUrl", "fotoRostoUrlLegado" = "fotoRostoUrl", "documentosUrlsLegado" = "documentosUrls" where id in (select id from "Jogador" where "fotoUrlLegado" is null and "fotoRostoUrlLegado" is null and "documentosUrlsLegado" is null and ("fotoUrl" is not null or "fotoRostoUrl" is not null or "documentosUrls" is not null) order by id limit 200);`. Cada UPDATE incrementa `revisaoOperacional` da categoria (linha quente): por isso lotes pequenos e fora de rodada.
4. **Conferir**: contagem de linhas com `*Legado` preenchido igual a P2.
5. **Migrar os arquivos**: fotos de rosto vão para `jogador-fotos-rosto` (copiar objeto, depois apontar `fotoUrl`/`fotoRostoUrl` para a nova URL pública); documentos ficam em `atleta-arquivos` com **caminho relativo** em `documentosUrls`, servidos por URL assinada. Script de servidor, idempotente, com log de contagens (sem imprimir nome de arquivo nem dado pessoal).
6. **Reversão**: `update "Jogador" set "fotoUrl" = "fotoUrlLegado", ...` a partir das colunas de apoio (em lotes), e `public = true` no bucket só em emergência (ver rollback de 0004).
7. Só remover as colunas `*Legado` depois de validação final e backup (decisão do dono).

## 7. Como gerar a baseline (não escrita aqui)

O DDL do banco não é reproduzível sem um dump do banco real (nenhum `CREATE TABLE` do núcleo no repositório; a ordem alfabética roda o lote `2026…` antes dos `supabase-*.sql` dos quais ele depende; `prisma/schema.prisma` está defasado). Portanto **não foi escrita baseline**; gerar assim:

1. Obter um **restore de backup** do projeto (ou um preview clonado). Não tirar o dump da produção ao vivo.
2. Com a Supabase CLI, apontando para esse banco por variável de ambiente (nunca digitar a senha na linha de comando nem commitar): `supabase db dump --db-url "$DB_URL_RESTORE" --schema public -f baseline-public.sql` (só estrutura; sem dados). Funções e triggers vêm junto.
3. Policies e buckets de Storage não vêm no dump de `public`: exportar com as consultas Q5 e Q4 e transcrever como `insert into storage.buckets ... on conflict do nothing` e `create policy` idempotentes, já no estado FINAL desejado (após 0004).
4. Revisar o arquivo: remover dados, segredos e `OWNER TO`; confirmar que não há linha de `Jogador`, `Pagamento` ou `Admin`.
5. Versionar como `supabase/migrations/202609010000_baseline.sql`. Mover os 35 `supabase-*.sql` para `supabase/legacy/` (fora da pasta que a CLI lê; fora do escopo desta entrega, que não renomeia nem apaga migrations).
6. Decisão pendente do dono (PLANO 5.2, item 3): a baseline representa o estado atual completo (as 17 migrations `2026…` viram "aplicadas", recomendado) ou o estado anterior a `202609220001`.
7. Em produção, só após aprovação: `supabase migration repair --status applied 202609010000` (grava só em `supabase_migrations.schema_migrations`; não altera o schema).
8. Prova: banco vazio local + baseline + migrations novas; `supabase db diff` contra o dump de preview deve dar vazio. Esta prova depende de a baseline existir e de as migrations de `20261017*` serem as últimas.

## 8. Ensaio local e em preview (sem produção)

1. Instalar Docker Desktop e Supabase CLI (D8). `supabase start` com a baseline aplicada.
2. Aplicar as migrations novas na ordem da seção 4, uma a uma, lendo os erros. Qualquer falha de sintaxe volta para o autor do arquivo: nada foi testado por Postgres até aqui.
3. Para 0003: rodar com e sem as migrations da main aplicadas (dois cenários da seção 2).
4. Rodar `npm run test:*` e o roteiro manual (portal, página da equipe, capitão, súmula, painel do organizador).
5. Preview compartilhado (projeto de dev, D7) só depois do local verde. D7 enfraquece o ensaio de M1/M2: atenção redobrada, e criar projeto de homologação próprio antes do primeiro piloto pagante.

## 9. O que exige aprovação explícita antes de tocar produção

- Rodar Q1 a Q13 em produção (leitura).
- Aplicar **qualquer** migration em produção: 0001 a 0026, uma aprovação por passo da seção 4.
- O deploy do código que sai do client anon (passo 2) e da rota de upload/URL assinada (pré-requisito de 0003 e 0004).
- 0003 (M1) e 0004 (M2): janela de madrugada em dia sem jogos, backup comprovado, aviso aos organizadores sobre links antigos de documentos.
- M2 etapa 2 (reescrita de URLs) e 0022 (`Pagamento.valor`): destrutivos; backup comprovado e confirmação explícita.
- `supabase migration repair` (baseline e índices aplicados fora do runner).
- Qualquer correção de dados exigida por P5 e P6.
- Decisões pendentes da seção 1 (TimeClube, `usuarioId` texto, D-1, EM_BREVE na view, listas de CHECK).

## Nota da rodada 14c: 0026 e a chave composta de CategoriaCampeonato
O dev real (e a produção, conforme leitura de índices) tem "CategoriaCampeonato" só com unique em id. A primeira tentativa da 0026 falhou com 42830. A 0026 passou a criar, de forma idempotente, a unique (id, "ligaId") antes das tabelas. Não altera dados; a 0043 depende dela; a reversão da 0026 não a remove.
Policies: a 0003 removeu as public_read_* de propósito. A 0031 não recria policy e não aborta por ausência (só reescreve as que existirem), então NÃO recriar policies.
