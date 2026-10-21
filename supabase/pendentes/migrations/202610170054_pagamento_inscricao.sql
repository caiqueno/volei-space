-- 202610170054_pagamento_inscricao.sql   (Rodada 19, inscrição por campeonato: pagamento por PIX MANUAL com COMPROVANTE)
--
-- OBJETIVO
--   Decisão de segurança do projeto: o gateway (webhook InfinitePay) está DESLIGADO. Quando a categoria
--   cobra inscrição, o líder paga por PIX fora da plataforma, envia o COMPROVANTE (bucket privado
--   "comprovante-pagamento", pendente 0055) e o ORGANIZADOR confirma ou recusa. Nada aqui chama gateway.
--   (a) "CategoriaConfiguracao" (aditivo, add column if not exists). Lugar escolhido: a configuração da
--       categoria, chave "categoriaCampeonatoId" (uuid, PRIMARY KEY, 1 linha por categoria), que já guarda
--       vagas, prazo e regras de inscrição (docs/analise/22). Colunas:
--         "pagamentoModo"          text not null default 'NENHUM' CHECK in ('NENHUM','COMPROVANTE');
--         "valorInscricaoCentavos" integer null CHECK >= 0 (moeda em centavos inteiros, sem float);
--         "pixChave"               text null (<= 140);
--         "pixBeneficiario"        text null (<= 100);
--         "pagamentoInstrucoes"    text null (<= 500).
--       O default 'NENHUM' mantém todas as categorias existentes sem cobrança. "CategoriaConfiguracao" é
--       só do servidor (RLS ligada, sem grant para anon/authenticated, 202609220001): a chave Pix NÃO fica
--       pública; o servidor a mostra apenas ao líder que está inscrevendo/inscrito naquela categoria.
--   (b) Tabela "PagamentoInscricao": no máximo um registro por "Inscricao" (UNIQUE em "inscricaoId", FK
--       on delete cascade). "valorCentavos" é a FOTO do valor no momento da inscrição (a categoria pode
--       mudar o preço depois). "estado": PENDENTE -> COMPROVANTE_ENVIADO -> CONFIRMADO | RECUSADO;
--       ISENTO para inscrição sem cobrança por decisão do organizador. "comprovantePath" é o CAMINHO
--       dentro do bucket (nunca URL; CHECK sem esquema de URL, sem "/" inicial e sem ".."); a leitura é só
--       por URL assinada curta emitida pelo servidor. "decididoPor" guarda o id da conta que decidiu
--       (text, sem FK, mesmo padrão de "Notificacao"."usuarioId"); CHECK exige "decididoEm" quando o
--       estado é CONFIRMADO, RECUSADO ou ISENTO. "motivoRecusa" <= 300, sem dado pessoal.
--
--   RELAÇÃO COM O FLUXO LEGADO (nada é alterado aqui)
--   * "Pagamento" (cobrança InfinitePay da inscrição de CandidaturaEquipe; prisma: status AGUARDANDO/
--     PAGO, valor Float, infinitePayId, webhookPayload) segue como está, com o webhook desligado. Não há
--     FK entre "Pagamento" e "PagamentoInscricao"; as tabelas são independentes.
--   * A rota GET organizador/ligas/[id]/categorias/preco (getCategoriesPricing ->
--     calculateCategoriesPrice) calcula o preço do ORGANIZADOR (taxa da plataforma sobre o campeonato)
--     a partir de "CategoriaConfiguracao"; NÃO é o preço da inscrição da equipe. As colunas novas têm
--     nomes próprios ("valorInscricaoCentavos", "pagamento*", "pix*") e não colidem com o que a rota lê.
--     A rota usa select('*') em "CategoriaConfiguracao": o backend deve conferir que
--     calculateCategoriesPrice ignora colunas desconhecidas (a verificar no código, fora desta migration).
--
--   Segurança: RLS ligada, sem policy e sem grant para anon/authenticated. Só service_role. O isolamento
--   A x B (o organizador só decide pagamentos de inscrições das suas ligas) é do servidor, via
--   "Inscricao"."ligaId"; o líder só vê o pagamento do próprio time. Chave Pix e comprovante são dados
--   sensíveis: não registrar em log.
--
-- PRÉ-REQUISITOS
--   * 202610170026 aplicada ("Inscricao" uuid) e "CategoriaConfiguracao" existente (202609220001).
--   A migration aborta com mensagem clara se faltar uma delas. A 0055 (bucket) é independente.
--
-- QUEBRA DE ROTAS
--   Nenhuma (colunas com default/nulas e tabela nova; nenhum código atual as usa).
--
-- BACKUP NECESSÁRIO
--   Nenhum (aditiva). Colunas com default constante ou nulas não reescrevem a tabela.
--
-- JANELA SEGURA
--   Fora de rodada por prudência: add column pega lock curto em "CategoriaConfiguracao" (lock_timeout 5 s;
--   se estourar, nada é aplicado e se repete depois).
--
-- REVERSÃO
--   supabase/pendentes/rollback/202610170054_pagamento_inscricao.sql (drop da tabela e das colunas novas;
--   registros de pagamento e a configuração de Pix se perdem; os arquivos do bucket não são tocados).

begin;
set local lock_timeout = '5s';

do $v$
begin
  if to_regclass('public."Inscricao"') is null then
    raise exception 'Aplique antes a 202610170026 (Inscricao)';
  end if;
  if to_regclass('public."CategoriaConfiguracao"') is null then
    raise exception 'Falta "CategoriaConfiguracao" (202609220001)';
  end if;
end
$v$;

alter table public."CategoriaConfiguracao"
  add column if not exists "pagamentoModo" text not null default 'NENHUM'
    check ("pagamentoModo" in ('NENHUM', 'COMPROVANTE')),
  add column if not exists "valorInscricaoCentavos" integer
    check ("valorInscricaoCentavos" is null or "valorInscricaoCentavos" >= 0),
  add column if not exists "pixChave" text
    check ("pixChave" is null or char_length("pixChave") <= 140),
  add column if not exists "pixBeneficiario" text
    check ("pixBeneficiario" is null or char_length("pixBeneficiario") <= 100),
  add column if not exists "pagamentoInstrucoes" text
    check ("pagamentoInstrucoes" is null or char_length("pagamentoInstrucoes") <= 500);

create table if not exists public."PagamentoInscricao" (
  id                      uuid primary key default gen_random_uuid(),
  "inscricaoId"           uuid not null unique references public."Inscricao"(id) on delete cascade,
  "valorCentavos"         integer not null check ("valorCentavos" >= 0),
  estado                  text not null default 'PENDENTE'
    check (estado in ('PENDENTE', 'COMPROVANTE_ENVIADO', 'CONFIRMADO', 'RECUSADO', 'ISENTO')),
  "comprovantePath"       text
    check ("comprovantePath" is null or (
      char_length("comprovantePath") <= 300
      and "comprovantePath" !~ '^[A-Za-z][A-Za-z0-9+.-]*:'
      and "comprovantePath" !~ '^[/\\]'
      and "comprovantePath" not like '%..%'
    )),
  "comprovanteEnviadoEm"  timestamptz,
  "decididoPor"           text check ("decididoPor" is null or char_length("decididoPor") <= 100),
  "decididoEm"            timestamptz,
  "motivoRecusa"          text check ("motivoRecusa" is null or char_length("motivoRecusa") <= 300),
  "criadoEm"              timestamptz not null default now(),
  "atualizadoEm"          timestamptz not null default now(),
  constraint "PagamentoInscricao_decisao_check"
    check (estado not in ('CONFIRMADO', 'RECUSADO', 'ISENTO') or "decididoEm" is not null)
);
create index if not exists "PagamentoInscricao_estado_idx"
  on public."PagamentoInscricao" (estado);

alter table public."PagamentoInscricao" enable row level security;
revoke all on table public."PagamentoInscricao" from public, anon, authenticated;
grant select, insert, update, delete on table public."PagamentoInscricao" to service_role;

commit;
