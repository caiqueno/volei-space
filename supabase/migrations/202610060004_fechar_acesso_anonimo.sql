-- O navegador só precisa da chave pública para o Realtime. Toda leitura e toda escrita
-- do produto passam pelo service role dentro das rotas do Next, que validam a sessão.
-- Sem isto a chave pública lê Partida.sumulaToken, o CPF do Jogador e aceita UPDATE.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

-- O Realtime avalia a visibilidade da linha com o papel que assinou o canal.
-- Só o placar e a tabela ficam legíveis, e a Partida sem as colunas do link da súmula.
grant select on table public."ClassificacaoEntrada" to anon, authenticated;
grant select on table public."SetPartida" to anon, authenticated;
grant select (
  "id",
  "ligaId",
  "equipeAId",
  "equipeBId",
  "categoria",
  "rodada",
  "status",
  "dataHora",
  "localNome",
  "setsPorA",
  "setsPorB",
  "pontosPorA",
  "pontosPorB",
  "vencedorId"
) on table public."Partida" to anon, authenticated;
