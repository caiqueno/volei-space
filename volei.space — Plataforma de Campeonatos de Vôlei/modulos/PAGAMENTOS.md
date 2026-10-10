---
title: >-
  Pagamentos
category: modulo
tags: [pagamentos]
sources: [repo:athrios/volei-space]
summary: >-
  Fluxos de pagamento.
status: misto
created: 2026-09-20
updated: 2026-10-09
---
# Preço e pagamentos

**Implementado:** motor de preço por campeonato e estimativa de partidas em `src/lib/pricing`; cupom e componentes opcionais no código. Há `src/lib/infinitepay.ts` e webhook `src/app/api/webhooks/infinitepay`. O webhook só aceita evento `paid` com assinatura, `Pagamento` vinculado e valor compatível. Fora do desenvolvimento local, ausência de `INFINITEPAY_WEBHOOK_SECRET` recusa a chamada. Repetição da equipe não cria outra linha quando `equipeId` já existe. Não há transação nem chave de idempotência própria do evento: isso continua pendente no banco. Nenhuma rota grava `Pagamento`, então o webhook não ativa candidatura enquanto essa linha não existir. `CandidaturaArbitro` não tem `pagamentoId`. `parseExternalId` confere o formato `equipe:` ou `arbitro:` e não substitui o schema da rota.

**Limite confirmado:** `src/app/api/organizador/ligas/[id]/pagamento/route.ts` descreve o checkout de ativação como **simulado**. A confirmação em `pagamento/confirmar` também é simulada e, desde 9 de outubro de 2026, fica fechada por padrão: o administrador pode gravar `pagamentoConfirmadoEm`; o organizador só consegue quando `ALLOW_SIMULATED_PAYMENT_CONFIRMATION` é `true`. Não rotule esse caminho como pagamento real. O webhook exige `INFINITEPAY_WEBHOOK_SECRET` fora do `next dev` local, confere o valor em reais ou em centavos desse valor (sem o caminho inverso) e o vínculo do `Pagamento` com a candidatura de equipe, e responde 5xx em falha de banco. A candidatura de árbitro não tem `pagamentoId`: o evento só ativa se já existe `Pagamento` com o mesmo `infinitePayId`, o valor confere e esse pagamento não é de uma equipe. Desde 5 de outubro de 2026, a estrutura do campeonato não responde mais `PAGAMENTO_PENDENTE`: o primeiro campeonato segue nome, categoria e link, e grupos podem ser configurados depois. A tela de pagamento continua disponível e não cobra.

A precificação definida no produto é por partida, com opção de súmula/scouts; confira valores no código ou decisão comercial vigente antes de publicá-los. Pagamento só libera o que estiver efetivamente confirmado pelo provedor e associado ao campeonato certo. Ver [[08-INTEGRACOES]] e [[modulos/PARAMETRIZACAO]].
