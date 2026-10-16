# 07 - Revisão de banco de dados: schema atual x modelo de referência

Agente: banco-de-dados. Data: 2026-10-16. Nada foi executado em banco; tudo que depende do banco real está marcado "a verificar". O `schema.prisma` está defasado (faltam `Partida.categoriaCampeonatoId`, `fase`, `seedKey`, `Equipe.categoriaCampeonatoId`, `seedKey`, `LinkInscricaoEvento`, `AcessoArbitroEvento`, `LigaLocal`); a comparação usa o DDL de `supabase/migrations/`. A nota `06-BANCO-DE-DADOS.md` do vault **não foi lida**.

## 1. Segurança e LGPD (a verificar no banco real)

- **C1. Leitura pública `using (true)`.** `supabase-producao-elenco-sumula-rls.sql:63-111` cria `public_read_*` para anon/authenticated em `Jogador`, `Equipe`, `Liga`, `Partida`, `SetPartida`, `SumulaPresenca`, `OcorrenciaPartida`, `DestaquesPartida`, `ClassificacaoEntrada`, `InscricaoCampeonato`. `supabase-rls-producao-permissoes-campeonatos.sql` cria políticas mais restritas (`luv_public_select_*`) mas nunca remove as `public_read_*`; políticas permissivas somam (OR), então as abertas anulam as restritas. Sem `revoke` de coluna em `Jogador`: com a chave anon seria possível ler `cpf`, `documentoNumero`, `dataNascimento`, `telefone`, `telefoneEmergencia`, `documentosUrls`, `fotoRostoUrl`, `qrCodeToken`, inclusive de menores. Confirmar com `select policyname, tablename, qual from pg_policies where schemaname='public'`.
- **C2. Bucket `atleta-arquivos` público com upload e update anônimos** (`supabase-producao-elenco-sumula-rls.sql:14-48`): documentos e fotos legíveis sem autenticação e sobrescrevíveis.
- **C3. RLS desabilitado** em `CandidaturaEquipe`, `CandidaturaArbitro`, `CandidaturaQuadra` (`supabase-cadastro-contatos-unicos.sql:15-17`, `supabase-fix-cadastro-rls.sql:4-6`). Contêm `senhaHash`, e-mail e telefone; `Pagamento` guarda `webhookPayload`.
- **C4. Sem RLS (a verificar):** `ContaPublico`, `Interessado`, `CodigoAcessoOrganizador`, `ConviteEquipe`, `LigaLocal`, `ClassificacaoEliminatoria`, `GrupoCampeonato` (só SELECT público). `CandidaturaOrganizador`: conferir se as políticas vazam `senhaHash`. `categoria_publica` em `CategoriaCampeonato` é `using(true)` e expõe categorias removidas.
- **C5. Isolamento entre organizadores só na aplicação.** Quase tudo usa `service_role` + JWT próprio; `Liga.organizadorId` é texto livre, sem FK nem tabela `Organizador`; sem RLS por organizador.

## 2. Lacunas de schema vs. modelo de referência

| Entidade | Estado atual | Lacuna |
|---|---|---|
| `Usuario` | Não existe; `Admin`, `ContaPublico` e três `senhaHash` separados | Identidade única com perfis múltiplos; login sem senha obrigatória |
| `Clube` | Não existe (T09, Fase 2) | `Clube` e `Equipe.clubeId` nulo |
| `Equipe` | Presa a `Liga` (`ligaId` NOT NULL, `@@unique(nome,ligaId,categoria,serie)`) | Separar `Equipe` permanente de `Inscricao`; faltam `cidade`, `naipe`, `cnpj`; `categoria` e `serie` texto livre |
| `MembroEquipe` | Só `lider`/`tecnico` como texto | Tabela `usuarioId, equipeId, papel` (base da RLS por time) |
| `Atleta` | `Jogador.equipeId` NOT NULL; sem banco por time/clube | `Atleta`, `VinculoAtletaClube`; PII em tabela restrita |
| `Organizador` / `MembroOrganizador` | Só `Liga.organizadorId` (texto) | Tabelas e FK |
| `Competicao` | `Liga` + `CategoriaCampeonato` | Faltam `visibilidade`, `modalidade`, `valorInscricao`, `vagas` |
| `RegraElenco` | Dispersa em `Liga.elencoQuantidadeMinima/Maxima` e `prazoAlteracaoElencoDias` | Tabela por categoria (modelos FIVB/CBV/Amador) |
| `Inscricao (status)` | `InscricaoCampeonato` só SOLICITADA/APROVADA/REJEITADA; rascunho em `InscricaoEquipeRascunho`; vaga em `ConviteVagaEquipe` | Estados completos, `motivo`, `comentarioPendencia`, `aceiteRegulamentoEm`, `categoriaCampeonatoId`; unificar rascunho e inscrição |
| `InscricaoAtleta` | Não existe | Snapshot com `numero`, `capitao`, `libero`; único `(inscricaoId, numero)`; no máx. 1 capitão; atleta em 1 time por competição |
| `InscricaoComissao` | Não existe | Tabela com papel e limite |
| `PedidoTroca` | Não existe (T15) | Tabela com tipo, atletas, status, decisão |
| `Notificacao` | Não existe | Exigida pelo PROMPT |

Outras lacunas:
- `Pagamento.valor` é `Float` (deveria ser `numeric(12,2)` ou centavos).
- Status e categorias como `String` sem CHECK/enum.
- JSON/arrays como texto: `Equipe.diasDisponiveis`, `horarios`, `quadraInfo`, `Jogador.documentosUrls`, `CandidaturaQuadra.fotosUrls`, `Liga.categoriasConfig`.
- Três estruturas de categoria coexistem (texto, `CategoriaCampeonato` uuid, `Liga.categoriasConfig`); backfill de `categoriaCampeonatoId` cobre só campeonatos com 1 categoria.
- Faltam FKs: `Partida.vencedorId`, `ClassificacaoEntrada.ligaId`, `Liga.organizadorId`, `ClassificacaoEliminatoria.organizadorId`, `CandidaturaArbitro.organizadorId`, `ConviteEquipe.organizadorId`.
- `ClassificacaoEntrada.equipeId` único: impede equipe em duas competições.
- Sem política de retenção/anonimização/consentimento (`Interessado`, `ConviteEquipe.email`, `CandidaturaEquipe.email`).
- Menor de idade: faltam `responsavelLegalId` e `autorizacaoResponsavelEm`.
- `Jogador.banido` e `qrCodeToken` na mesma tabela de PII.

## 3. Súmula e log de eventos imutável (J02)

Hoje: delete + insert sem transação em `SetPartida`, `SumulaPresenca`, `OcorrenciaPartida`, `DestaquesPartida` (`src/app/api/sumula/[token]/route.ts:91-114,155-175`); desfazer em memória (`lancar/page.tsx:477`); `OcorrenciaPartida` sem autor, relógio, ordem nem rally; sem tabela de eventos nem para substituição, tempo, rotação, líbero, desafio ou sanção; placar gravado direto. **`sumulaToken` previsível**: `supabase-sumula-numero-partida-scouts.sql` o define como `'partida-' || id` e dá acesso de escrita (achado alto; a verificar se foi usado em produção).

Faltam: `SumulaEvento` append-only com trigger que bloqueia UPDATE/DELETE; desfazer como evento compensatório; placar derivado por projeção; RPC atômica; idempotência por dispositivo (`clientEventId`); ordem por `seq` com `UNIQUE(partidaId, seq)`.

## 4. Migrations propostas (somente texto; não executar)

Regras: nome `YYYYMMDDNNNN_*.sql`, idempotente, em branch `feat/…` a partir de `teste-integrado`, aplicar primeiro em banco local/preview, plano de reversão em cada uma, nenhum DDL em produção sem backup e confirmação.

- **M1. Fechar leitura pública de PII (C1, C3, C4).** Dropar as `public_read_*`; `revoke all` em `Jogador` para anon/authenticated; criar `public.jogador_publico` (id, nome, fotoUrl, posicao, numero, equipeId; sem banidos; só ligas ATIVA/ENCERRADA/FINALIZADO) e dar `select` a anon; `enable row level security` e `revoke` em `CandidaturaEquipe/Arbitro/Quadra`, `Pagamento`, `Admin`. **Quebra qualquer rota que leia `Jogador` com a chave anon: mapear antes.** Reversão: recriar políticas (guardar `pg_policies` antes).
- **M2. Bucket privado (C2).** `update storage.buckets set public=false where id='atleta-arquivos'`; dropar as três políticas anônimas; acesso só por `service_role` com URL assinada de curta duração; reescrever URLs públicas gravadas em `Jogador.fotoUrl/documentosUrls/fotoRostoUrl` (destrutivo: só com backup).
- **M3. Identidade, organizador, times.** Criar `Organizador`, `MembroOrganizador (papel ADMIN/FINANCEIRO/ARBITRAGEM)`, `Clube`, `MembroEquipe (RESPONSAVEL/TECNICO/ASSISTENTE/CAPITAO)` com índices por `usuarioId`. `Liga.organizadorId` ganha coluna `organizadorUuid` com backfill; não mudar o tipo na hora.
- **M4. Atleta, inscrição e troca.** Criar `Atleta`, `AtletaDocumento` (PII isolada, sem acesso anon), `VinculoAtletaClube`, `RegraElenco`, `Inscricao` (status RASCUNHO/ENVIADA/EM_ANALISE/PENDENCIA/APROVADA/RECUSADA/LISTA_ESPERA; `unique(categoriaCampeonatoId, equipeId)`), `InscricaoAtleta` (snapshot; `unique(inscricaoId, numero)`; `unique(categoriaCampeonatoId, atletaId)`; índice parcial de 1 capitão), `InscricaoComissao`, `PedidoTroca`. O `UNIQUE` por competição deve valer só para inscrições não recusadas: usar índice parcial com `status` copiado para a linha ou trigger. Backfill de `Jogador` em lotes, rotas lendo as duas estruturas até a troca; `InscricaoCampeonato` fica legado. Reversão: `drop table` (tabelas novas).
- **M5. Log de eventos da súmula.** `SumulaEvento` (`seq`, `tipo` PONTO/SAQUE/SUBSTITUICAO/TEMPO/SANCAO/INICIO_SET/FIM_SET/LIBERO/DESAFIO/WO/FIM_PARTIDA/DESFAZ, `payload jsonb`, `desfazId`, autor, `clientEventId`, `ocorridoEm`, `criadoEm`; `unique(partidaId, seq)` e `unique(partidaId, clientEventId)`), triggers que bloqueiam UPDATE/DELETE/TRUNCATE, RLS com `revoke` para anon, `select, insert` só a `service_role`. Faltam: RPC atômica `registrar_evento_sumula` (security definer, `search_path` fixo, `for update` na partida), `recalcular_placar_partida`, evento `SNAPSHOT` para jogos antigos, e `sumulaToken` aleatório com expiração. Reversão: `drop table "SumulaEvento"`.
- **M6. Índices** (`create index concurrently`, fora de transação; conferir `pg_indexes` antes): `Jogador(equipeId)`, `Equipe(ligaId, categoriaCampeonatoId)`, `Partida(equipeAId)`, `Partida(equipeBId)`, `Partida(ligaId, categoriaCampeonatoId, status, dataHora)`, `SumulaPresenca(jogadorId)` e `(equipeId)`, `OcorrenciaPartida(partidaId)`, `VotoMVP(categoria, serie)`, `Mensagem(ligaId, aprovada)`, `Midia(ligaId)`, `Premiacao(ligaId)`, `CandidaturaEquipe(ligaId, status)`.
- **M7. Integridade.** `Pagamento.valor` para `numeric(12,2)` (exige backup); CHECKs `not valid` + `validate` em `Liga.status`, `Partida.status`, `InscricaoCampeonato.status`, `Equipe.categoria`, `serie`, `statusEquipe`; FK `Partida.vencedorId`; remover índices redundantes `convite_vaga_token_idx` e `liga_idx`.

## 5. Desempenho

- Sem índice em FKs de junção (ver M6); as políticas RLS atuais fazem `exists` com junção `Equipe`+`Liga` por linha (`luv_public_select_jogador`); a verificar com `EXPLAIN`.
- Subconsulta por linha na RLS: preferir a view pública (M1) ou coluna `ligaPublica` desnormalizada.
- Triggers pesados: `category_operational_revision` (`touch_category_operation`) roda por linha em várias tabelas e `guard_match_participant` em toda linha de `SumulaPresenca`, `OcorrenciaPartida`, `DestaquesPartida`; a súmula atual (delete+insert em 5 tabelas) dispara tudo, e cada `touch` atualiza a mesma linha de categoria (hot row sob rodadas simultâneas). Atualizar a revisão uma vez por transação.
- `recalcular_classificacao_*` recalcula sobre todas as partidas: ok em torneio pequeno; com o log, recalcular só a categoria afetada e só em `Partida` encerrada.
- N+1 provável (a verificar com `pg_stat_statements`): listas de equipes com jogadores; inscrição consultando `Jogador` por equipe.
- Log de eventos: `unique(partidaId, seq)` cobre a leitura; particionar só acima de dezenas de milhões de linhas; evitar `payload` grande.
- JSON sem GIN (`formularioInscricaoConfig`, `pontuacaoResultado`, `simulacaoRelogio`) só importa se houver filtro por chave.
- `seedKey` em `Equipe`, `Jogador`, `Partida` e `Liga.simulacao`: confirmar que seeds não rodam em produção e que o preview usa outro projeto Supabase (a verificar).

## 6. Ordem sugerida
1. M1, M2 e C3 (segurança e LGPD) antes de qualquer novo cadastro de menor; começar mapeando as rotas que usam a chave anon.
2. M6 e M7 (baixo risco).
3. M5 com RPC atômica e novo token de súmula.
4. M3 e M4 com backfill gradual.
5. Atualizar `schema.prisma` (ou removê-lo como fonte) e a nota `06-BANCO-DE-DADOS.md`.

## 7. Pendências e decisões
- Consultas somente leitura no banco real: `pg_policies`, `information_schema.role_table_grants` para `anon`, `pg_indexes`, `storage.buckets`, `pg_stat_statements`.
- Decidir se a inscrição tem aprovação manual (CLAUDE.md diz que não; PROMPT linha 209 prevê análise e pendência).
- Decidir se `Atleta` é do clube ou da equipe na Fase 1 (T09 deixa clube para a Fase 2).
