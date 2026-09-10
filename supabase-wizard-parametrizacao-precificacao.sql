-- Wizard visual de parametrização + Pricing Engine.
-- Aditivo: nenhuma linha existente é alterada por esta migration.

-- =========================================================================
-- 1. Recurso comercial "Súmula Digital + Scouts"
--    Tratado como UM único recurso (não separar súmula de scouts).
--    Nasce desligado: é um recurso pago (+R$ 9,90/partida), portanto opt-in.
--    Não existe equivalente hoje — a súmula/scouts sempre estiveram ligadas
--    para todos, sem flag; este campo passa a representar a contratação.
-- =========================================================================

alter table "Liga"
  add column if not exists "sumulaScoutsEnabled" boolean not null default false;

-- =========================================================================
-- 2. QR Code passa a ser recurso pago (+R$ 1,50/partida) -> novos
--    campeonatos contratam por opção.
--    IMPORTANTE: só o DEFAULT muda. As ligas existentes permanecem com
--    qrCodeEnabled = true (nenhum UPDATE), preservando o comportamento de
--    quem já usa QR hoje e a regra que exige nome+foto do atleta nelas.
-- =========================================================================

alter table "Liga" alter column "qrCodeEnabled" set default false;
