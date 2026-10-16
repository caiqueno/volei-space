---
title: >-
  Pagamentos
category: modulo
tags: [pagamentos]
sources: [repo:athrios/volei-space]
summary: >-
  Sem PAGAMENTO_HABILITADO o checkout simulado fica. false desliga a cobrança. true exige confirmação.
status: misto
created: 2026-09-20
updated: 2026-10-16
---
# Preço e pagamentos

**Implementado:** a variável de servidor `PAGAMENTO_HABILITADO` só muda a produção quando vem explícita. Ausente, vazia ou com valor desconhecido, o checkout simulado permanece, a estrutura não responde 402 e `pagamentoConfirmadoEm` não é gravado. `false`, `0`, `nao`, `não`, `off` e `no` desligam a cobrança: a prévia não mostra preço nem botão, o organizador segue para `/painel/estrutura`, e o `GET` e o `POST` de grupos gravam `pagamentoConfirmadoEm` se ainda estiver vazio, sem linha em `Pagamento` e sem InfinitePay. `true`, `1`, `sim`, `yes` e `on` exigem essa data antes dos grupos (`PAGAMENTO_PENDENTE`). Na Vercel, para desligar a cobrança, o valor é `PAGAMENTO_HABILITADO=false`. O checkout lê `pricing.categories` quando `pricing.items` não existe. `src/lib/infinitepay.ts` e o webhook continuam no repositório. Sem migration.

Motor de preço por campeonato e estimativa de partidas em `src/lib/pricing`; cupom e componentes opcionais no código. Há `src/lib/infinitepay.ts` e webhook `src/app/api/webhooks/infinitepay`. O webhook só aceita evento `paid` com assinatura, `Pagamento` vinculado e valor compatível. Fora do desenvolvimento local, ausência de `INFINITEPAY_WEBHOOK_SECRET` recusa a chamada. Repetição da equipe não cria outra linha quando `equipeId` já existe. Não há transação nem chave de idempotência própria do evento: isso continua pendente no banco. Nenhuma rota grava `Pagamento`, então o webhook não ativa candidatura enquanto essa linha não existir. `CandidaturaArbitro` não tem `pagamentoId`. `parseExternalId` confere o formato `equipe:` ou `arbitro:` e não substitui o schema da rota.

**Limite confirmado:** `src/app/api/organizador/ligas/[id]/pagamento/route.ts` descreve o checkout de ativação como **simulado**. A confirmação em `pagamento/confirmar` também é simulada e, desde 9 de outubro de 2026, fica fechada por padrão: o administrador pode gravar `pagamentoConfirmadoEm`; o organizador só consegue quando `ALLOW_SIMULATED_PAYMENT_CONFIRMATION` é `true`. Não rotule esse caminho como pagamento real. O webhook exige `INFINITEPAY_WEBHOOK_SECRET` fora do `next dev` local, confere o valor em reais ou em centavos desse valor (sem o caminho inverso) e o vínculo do `Pagamento` com a candidatura de equipe, e responde 5xx em falha de banco. A candidatura de árbitro não tem `pagamentoId`: o evento só ativa se já existe `Pagamento` com o mesmo `infinitePayId`, o valor confere e esse pagamento não é de uma equipe. Desde 16 de outubro de 2026, `PAGAMENTO_PENDENTE` só volta quando `PAGAMENTO_HABILITADO` é `true` e `pagamentoConfirmadoEm` está vazio. Sem a variável, a estrutura não responde 402 e não grava essa data.

A precificação definida no produto é por partida, com opção de súmula/scouts; confira valores no código ou decisão comercial vigente antes de publicá-los. Pagamento só libera o que estiver efetivamente confirmado pelo provedor e associado ao campeonato certo. Ver [[08-INTEGRACOES]] e [[modulos/PARAMETRIZACAO]].
