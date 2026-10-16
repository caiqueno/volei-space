# Plano de reparo do histórico de migrations

Nada neste arquivo autoriza aplicar SQL, rodar `supabase db push` ou executar `supabase migration repair`. A produção está com campeonato ao vivo. Os nove índices de `20261011025731` já estão em produção. O repair do livro continua sem executar.

A CLI do Supabase compara só o prefixo numérico do arquivo (a `version`) com `supabase_migrations.schema_migrations`. O texto depois do `_` não entra na comparação. Produção registra versões de 14 dígitos com nomes diferentes dos arquivos daqui, que usam 12 ou 14 dígitos. Um `db push` da pasta inteira trata cada prefixo local ausente no livro como migration nova e reexecuta o SQL. Vários desses arquivos não são idempotentes.

Leitura de 10 de outubro de 2026 no projeto `mqbkwbqpnhsqaemavive`: o livro parava em `20261010083821`. Esse número não é o prefixo de nenhum arquivo do repositório. Confirme de novo com a consulta abaixo antes de qualquer repair. O schema vivo e o livro já divergiram uma vez.

## O que não fazer

- Não renomear arquivo cuja versão já está no livro. A versão aplicada fica para sempre. Correção nova ganha timestamp novo, maior que o último do `main`.
- Não marcar como `applied` um arquivo cujo efeito ainda não está no banco. O repair não executa o SQL; ele só insere a linha. O `db push` seguinte pula o arquivo e o banco fica sem o efeito.
- Não marcar como `reverted` uma versão que tem arquivo local, a menos que a intenção seja o próximo `db push` executar esse arquivo. `reverted` apaga a linha do livro e não desfaz o SQL.
- Não usar `db push` da pasta para “só aplicar o que falta” enquanto o livro e os arquivos não coincidirem.
- Não reaplicar `20261011025731_indices_fks_sem_cobertura.sql`. Os nove índices já estão em produção. O arquivo só tem `CREATE INDEX IF NOT EXISTS`. Esta entrega não executa SQL.
- Não renomear `20261010139000_wo_configuravel.sql`. Essa versão já foi aplicada. O nome `20261010137000` continua sendo a súmula transacional.

`supabase migration repair` só mexe no livro. `applied` insere a versão. `reverted` apaga a versão. Nenhum dos dois roda o arquivo nem volta o schema.

## Procedimento, quando houver aprovação

1. Ligar o projeto certo (`supabase link --project-ref <ref>`) e não misturar produção com desenvolvimento.
2. Consultar o livro, sem escrever nada. O arquivo `scripts/consultar-historico-migrations.sql` só tem `SELECT`. A primeira consulta lista as colunas reais. A segunda pede `version` e `name`. Se `name` não existir, fique na primeira e leia `version`.
3. Listar os arquivos locais, também sem banco:

   ```bash
   node scripts/listar-migrations-locais.mjs
   ```

   Cada linha traz a versão, quantos dígitos ela tem (12 ou 14), o nome do arquivo e a primeira frase do comentário, que resume o efeito.
4. Mapear cada arquivo para o banco, não para o prefixo. Para cada versão local:
   - Se o livro já tem essa mesma versão, o arquivo está registrado. Não faça repair e não renomeie.
   - Se o livro não tem essa versão, olhe o efeito no schema (coluna, função, índice, policy). Efeito já presente: `supabase migration repair --status applied <versão>`. Efeito ausente: deixe pendente. Não marque `applied`.
5. Para cada versão do livro que não existe como prefixo de arquivo local, `supabase migration repair --status reverted <versão>`. Isso tira o registro órfão. Não desfaz o que aquele SQL fez no passado.
6. Conferir com `supabase migration list`. A coluna remote deve repetir a local, exceto nas versões que o passo 4 deixou pendentes de propósito. Se aparecer remote sem local, ainda há órfão. Se aparecer local sem remote fora da lista pendente, o `applied` ficou faltando.
7. Só então, e com outra aprovação, aplicar o que ficou pendente. Um arquivo por vez, na ordem do prefixo, nunca a pasta inteira num `db push` enquanto houver dúvida. `20261010140000` e `20261010141000` andam juntas: a primeira sozinha revoga a leitura de sets e classificação.

O bloco antigo em `volei.space — Plataforma de Campeonatos de Vôlei/06-BANCO-DE-DADOS.md` que marca `202609200001`–`202610010003` como `applied` e em seguida manda um `db push` não fecha este caso. Aqueles prefixos não são as versões de 14 dígitos que a produção gravou. Marcar só essa lista e dar push reaplicaria o resto.

## Pendentes conhecidas no main

Estas ainda não foram aplicadas em produção. Não as marque como `applied`. Os nomes são os arquivos reais:

| Pedido | Arquivo | Efeito, em uma linha |
| --- | --- | --- |
| 139700 | `20261010139700_elegibilidade_categoria.sql` | `genero`, `idadeMinima` e `idadeMaxima` na categoria; `sexo` no atleta e no rascunho |
| 139800 | `20261010139800_quociente_classificacao.sql` | a checagem de critérios passa a aceitar média de sets e média de pontos |
| 139950 | `20261010139950_limite_substituicoes.sql` | `limiteSubstituicoesPorSet` na liga e na categoria |
| 139960 | `20261010139960_alerta_rodizio.sql` | `alertaRodizioIlegal` na liga e na categoria |
| 139970 | `20261010139970_tempos_sumula.sql` | `limiteTemposPorSet` e `separarTempos` na liga e na categoria |
| 139980 | `20261010139980_lesao_sumula.sql` | `tempoMedico` e `substituicaoPorLesao` na liga e na categoria |
| 139990 | `20261010139990_libero_sumula.sql` | `exigirLiberoInicial` e `quantidadeLiberos` na liga e na categoria |
| 100002 | `202610100002_fechar_leitura_publica_placar.sql` | tira a leitura pública de `SetPartida` e `ClassificacaoEntrada` e reescreve `finalizar_inscricao_equipe_rascunho` |

A nota de banco registra outros arquivos como não aplicados (foto opcional, sets por fase, súmula transacional, RLS, W.O., vaga, entre outros). A vaga `20261010142000` é exceção: foi aplicada em 10 de outubro de 2026. A lista desta tabela é a das pendentes conhecidas deste plano. O passo 4 é quem decide o resto, olhando o efeito, não o prefixo.

## Migration de índices, já aplicada em produção

`supabase/migrations/20261011025731_indices_fks_sem_cobertura.sql` é posterior a `20261010142000`, o maior prefixo do `main` na data deste plano. Ela só cria índice, se o nome ainda não existir, nas chaves que a produção mostrou sem cobertura:

- `Partida` (`ligaId`)
- `SetPartida` (`partidaId`)
- `SumulaPresenca` (`partidaId`)
- `EscalaArbitro` (`partidaId`)
- `DestaquesPartida` (`partidaId`)
- `ClassificacaoEntrada` (`categoriaCampeonatoId`)
- `InscricaoCampeonato` (`ligaId`), (`equipeId`) e (`categoriaCampeonatoId`)

Os nomes de tabela e coluna são os do `prisma/schema.prisma` e do SQL versionado. O `@@index` correspondente está no Prisma. `InscricaoCampeonato.equipeId` já tinha `@@index` no schema e não tinha `CREATE INDEX` na pasta; a migration cria o índice no banco.

Compostos do repositório não foram tomados como cobertura:

- `Partida_liga_grupo_idx` e `Partida_categoria_idx` começam em `ligaId`, e `Partida_categoria_fase_slot_key` é parcial. A produção ainda viu `Partida.ligaId` sem índice. Os compostos de `20261010015632` não estão aplicados.
- `SetPartida (partidaId, numero)`, `SumulaPresenca (partidaId, jogadorId)`, `EscalaArbitro (partidaId, cargo)` e `DestaquesPartida (partidaId, tipo)` estão no Prisma. Nenhum `CREATE UNIQUE` da pasta os cria. O comentário de `202610090002` que pulava `SetPartida.partidaId` partia dessa unicidade.
- `ClassificacaoEntrada_categoria_idx` e `InscricaoCampeonato_categoria_idx` são `(ligaId, categoriaCampeonatoId)`. `categoriaCampeonatoId` não é a primeira coluna. A FK de categoria em `202609220001` é `("categoriaCampeonatoId", "ligaId")`, a ordem inversa.
- `InscricaoCampeonato_ligaId_equipeId_key` começa em `ligaId` e não indexa `equipeId` nem `categoriaCampeonatoId`.

`CREATE INDEX` sem `CONCURRENTLY` trava a escrita da tabela até o índice ficar pronto. Esses nove índices já foram criados em produção. Esta entrega só versiona o arquivo idempotente e não o executa de novo.

`CONCURRENTLY` não está no arquivo. O `db push` e o `migration up` aplicam o arquivo dentro de uma transação, e o Postgres recusa `CREATE INDEX CONCURRENTLY` nesse modo (`SQLSTATE 25001`). Os índices já existem em produção. Se o livro ainda não tiver a versão `20261011025731`, o `IF NOT EXISTS` torna uma repetição inofensiva, mas esta entrega não roda o arquivo nem faz repair.

## Backlog de integridade

Só registro. Não há migration para estes itens.

**Unicidade `SetPartida (partidaId, numero)`.** O Prisma declara `@@unique`. Nenhum SQL da pasta cria essa constraint. A produção viu `partidaId` sem índice, o que combina com a ausência dela. Criá-la pode falhar se já houver set repetido. A consulta de duplicata está no script de leitura. Não apaga linha.

**Unicidade `InscricaoCampeonato (ligaId, equipeId, categoriaCampeonatoId)`.** O que existe no Prisma e em `202609200021` é `(ligaId, equipeId)`, sem a categoria. Há também o único `(id, categoriaCampeonatoId, ligaId)` em `202609220002`. O trio pedido não está declarado. A consulta de duplicata do trio está no script de leitura.

**FK `Partida.vencedorId`.** A coluna existe. O Prisma não declara relação e nenhuma migration cria `foreign key` de `vencedorId` para `Equipe`. Incluir a FK pode falhar se o id não apontar para uma equipe.

**CHECKs `equipeAId <> equipeBId` e vencedor em `(equipeAId, equipeBId)`.** O texto já está em `202609220002_category_backfill.sql`. Se aquele arquivo entrou à mão, as checagens podem já existir; se não entrou, faltam. Não se cria outra migration para repetir. `20261010142000` deixou os dois lados anuláveis: em SQL, `NULL <> x` não reprova o `CHECK`. Confirme com `pg_constraint` na consulta de leitura antes de escrever DDL.

**`search_path` fixo.** A observação de produção fala em 6 funções. A definição mais nova de cada função na pasta deixa 9 sem `SET search_path`: `touchAtualizadaEm` (o `CREATE` não qualifica o schema; arquivo `202609200004`), `bloquear_filho_equipe_finalizada`, `bloquear_filho_liga_finalizada`, `bloquear_filho_partida_finalizada`, `bloquear_liga_finalizada`, `calcular_pontos_resultado`, `campeonato_esta_finalizado`, `guard_unique_cadastro_contact` e `normalize_cadastro_phone`. A lista de 6 é a do banco, não a deste parágrafo. A consulta de `pg_proc` no script de leitura fecha os nomes. Nenhum `ALTER FUNCTION` entra aqui.
