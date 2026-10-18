-- 202610170044_solicitacao_atletas_escolhidos.sql   (Rodada 14b, Meu Time: escolha dos atletas na solicitação)
--
-- OBJETIVO
--   Quando o banco de atletas do time passa do máximo da categoria, o líder escolhe quem entra. Em categoria
--   com APROVACAO a escolha precisa esperar a decisão do organizador: "SolicitacaoInscricao"."atletasEscolhidos"
--   guarda os ids dos atletas (uuid[]) escolhidos no pedido. Nulo = seleção automática do banco (comportamento
--   anterior). O servidor confere, ao solicitar e ao aprovar, que os ids ainda pertencem ao time.
--   A ponte "Inscricao"."equipeLegadoId" (0026) NÃO muda de forma: passa a ser preenchida pelo servidor.
--
-- PRÉ-REQUISITOS
--   * 202610170043 aplicada ("SolicitacaoInscricao"). Aborta com mensagem clara se faltar.
--
-- QUEBRA DE ROTAS
--   Nenhuma (coluna nula nova; RLS e grants da tabela não mudam: só service_role).
--
-- BACKUP NECESSÁRIO
--   Nenhum (aditiva, sem default, sem reescrita da tabela).
--
-- JANELA SEGURA
--   Fora de rodada por prudência (lock curto em "SolicitacaoInscricao"; lock_timeout 5 s).
--
-- REVERSÃO
--   supabase/pendentes/rollback/202610170044_solicitacao_atletas_escolhidos.sql (drop da coluna; as escolhas
--   das solicitações pendentes se perdem e a aprovação volta a usar a seleção automática).

begin;
set local lock_timeout = '5s';

do $$
begin
  if to_regclass('public."SolicitacaoInscricao"') is null then
    raise exception 'Aplique antes a 202610170043 (SolicitacaoInscricao)';
  end if;
end
$$;

alter table public."SolicitacaoInscricao"
  add column if not exists "atletasEscolhidos" uuid[];

commit;
