-- Gênero e faixa de idade da categoria, e sexo opcional do atleta.
-- Tudo nasce nulo. Sem esses dados, a inscrição não muda.
-- Não apaga linha. Não concede a anon nem a authenticated. Não foi aplicada.
-- O prefixo fica depois de 20261010139500 e antes de 20261010140000.
-- O aplicativo grava estes campos direto na tabela. Não entram no RPC
-- salvar_configuracao_categoria, para o salvamento atual continuar válido
-- enquanto esta migration não existir.

alter table public."CategoriaConfiguracao"
  add column if not exists "genero" text,
  add column if not exists "idadeMinima" integer,
  add column if not exists "idadeMaxima" integer;

alter table public."Jogador"
  add column if not exists "sexo" text;

alter table public."InscricaoEquipeJogadorRascunho"
  add column if not exists "sexo" text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'CategoriaConfiguracao_genero_check') then
    alter table public."CategoriaConfiguracao"
      add constraint "CategoriaConfiguracao_genero_check"
      check ("genero" is null or "genero" in ('MASCULINO', 'FEMININO', 'MISTO'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'CategoriaConfiguracao_idade_check') then
    alter table public."CategoriaConfiguracao"
      add constraint "CategoriaConfiguracao_idade_check"
      check (
        ("idadeMinima" is null or "idadeMinima" between 0 and 120)
        and ("idadeMaxima" is null or "idadeMaxima" between 0 and 120)
        and ("idadeMinima" is null or "idadeMaxima" is null or "idadeMinima" <= "idadeMaxima")
      );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'Jogador_sexo_check') then
    alter table public."Jogador"
      add constraint "Jogador_sexo_check"
      check ("sexo" is null or "sexo" in ('MASCULINO', 'FEMININO'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'InscricaoEquipeJogadorRascunho_sexo_check') then
    alter table public."InscricaoEquipeJogadorRascunho"
      add constraint "InscricaoEquipeJogadorRascunho_sexo_check"
      check ("sexo" is null or "sexo" in ('MASCULINO', 'FEMININO'));
  end if;
end $$;
