-- O número da camisa desta partida já fica em SumulaPresenca.numero.
-- Para gravá-lo antes da confirmação, a linha pode existir com a presença
-- ainda pendente. presente nulo não é ausência e não é confirmação.
--
-- O default continua true: quem insere a presença sem a coluna segue
-- confirmando o atleta. Esta migration não apaga linha e não mexe em número.

alter table public."SumulaPresenca"
  alter column presente drop not null;
