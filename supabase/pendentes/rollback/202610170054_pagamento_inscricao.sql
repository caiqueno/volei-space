-- Reversão de 202610170054. Apaga os pagamentos de inscrição e as colunas de Pix/valor de
-- "CategoriaConfiguracao" (perde a configuração de cobrança). Não toca "Pagamento" (legado) nem
-- "Inscricao". Os arquivos do bucket comprovante-pagamento permanecem (apagar só pelo painel, com backup).
begin;
set local lock_timeout = '5s';
drop table if exists public."PagamentoInscricao";
alter table public."CategoriaConfiguracao"
  drop column if exists "pagamentoInstrucoes",
  drop column if exists "pixBeneficiario",
  drop column if exists "pixChave",
  drop column if exists "valorInscricaoCentavos",
  drop column if exists "pagamentoModo";
commit;
