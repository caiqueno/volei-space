-- 202610170018_checks_estado_not_valid.sql   (M7, etapa 1 de 4: CHECK NOT VALID)
--
-- OBJETIVO
--   Colunas de estado hoje são text livre. Adiciona CHECK ... NOT VALID (vale para escritas novas e
--   para UPDATE de qualquer linha; não varre as linhas antigas) em:
--     Liga.status, Partida.status, InscricaoCampeonato.status, Equipe.categoria, Equipe.serie,
--     Equipe.statusEquipe.
--   A validação das linhas antigas é a etapa seguinte (202610170019), separada de propósito.
--
--   Listas de valores (superconjunto do que o código escreve; apertar depois da Q9):
--     Liga.status ............. RASCUNHO, EM_BREVE, ATIVA, ENCERRADA, FINALIZADO, CANCELADA
--     Partida.status .......... AGENDADA, EM_ANDAMENTO, ENCERRADA, CANCELADA, WO, mais FINALIZADA e APROVADA
--                               (citados na RPC de 202609220003:132; tirar se a Q9 não os encontrar)
--     InscricaoCampeonato.status SOLICITADA, PENDENTE, PENDENTE_APROVACAO, APROVADA, REJEITADA, CANCELADA
--     Equipe.statusEquipe ..... PENDENTE, ATIVA, INATIVA
--     Equipe.serie ............ NULL, OURO, PRATA (serie virou nullable em 202609220001)
--     Equipe.categoria ........ formato (1 a 40 caracteres), NÃO lista fixa: 202609230008 abriu
--                               categorias personalizadas além das 5 do catálogo.
--
-- PRÉ-REQUISITOS
--   a. Q7 (constraints existentes) e Q9 (valores distintos em uso) rodadas. Se Q9 mostrar valor fora
--      das listas acima, AJUSTAR este arquivo antes de aplicar (senão qualquer UPDATE em linha com
--      aquele valor passa a falhar, mesmo com NOT VALID).
--   b. Base do banco com as colunas "Equipe"."serie" e "statusEquipe" (a verificar via Q7/Q9).
--
-- QUEBRA DE ROTAS
--   Rejeita escritas com grafia de status diferente. Conferir: api/partidas, api/ligas,
--   api/inscricoes-campeonato, api/candidaturas/equipes, api/organizador/ligas/[id]/*,
--   src/lib/championship-*.ts e as RPCs finalizar_inscricao_equipe_rascunho e
--   recalcular_classificacao_*. Erro SQLSTATE 23514.
--
-- BACKUP NECESSÁRIO
--   Dump de Q7 (constraints atuais). Sem dado alterado.
--
-- JANELA SEGURA
--   Fora de rodada. ADD CONSTRAINT NOT VALID pega lock exclusivo curto por tabela; lock_timeout 5 s
--   aborta sem efeito se houver transação longa. Partida tem triggers pesados, mas CHECK não os dispara.
--
-- REVERSÃO
--   supabase/rollback/202610170018_checks_estado_not_valid.sql

begin;
set local lock_timeout = '5s';

do $m7$
declare
  item record;
begin
  for item in
    select * from (values
      ('Liga', 'liga_status_chk',
        $c$ status in ('RASCUNHO','EM_BREVE','ATIVA','ENCERRADA','FINALIZADO','CANCELADA') $c$),
      ('Partida', 'partida_status_chk',
        $c$ status in ('AGENDADA','EM_ANDAMENTO','ENCERRADA','CANCELADA','WO','FINALIZADA','APROVADA') $c$),
      ('InscricaoCampeonato', 'inscricao_campeonato_status_chk',
        $c$ status in ('SOLICITADA','PENDENTE','PENDENTE_APROVACAO','APROVADA','REJEITADA','CANCELADA') $c$),
      ('Equipe', 'equipe_categoria_formato_chk',
        $c$ char_length(btrim(categoria)) between 1 and 40 $c$),
      ('Equipe', 'equipe_serie_chk',
        $c$ serie is null or serie in ('OURO','PRATA') $c$),
      ('Equipe', 'equipe_status_equipe_chk',
        $c$ "statusEquipe" in ('PENDENTE','ATIVA','INATIVA') $c$)
    ) as v(tabela, nome, expressao)
  loop
    if to_regclass(format('public.%I', item.tabela)) is null then
      raise notice 'tabela % inexistente, constraint % ignorada (a verificar)', item.tabela, item.nome;
    elsif not exists (
      select 1 from pg_constraint
      where conrelid = format('public.%I', item.tabela)::regclass and conname = item.nome
    ) then
      execute format('alter table public.%I add constraint %I check (%s) not valid',
                     item.tabela, item.nome, item.expressao);
    end if;
  end loop;
end
$m7$;

commit;
