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

**Implementado:** motor de preço por campeonato e estimativa de partidas em `src/lib/pricing`; cupom e componentes opcionais no código. Há `src/lib/infinitepay.ts` e webhook `src/app/api/webhooks/infinitepay`. O webhook só aceita evento `paid` com assinatura, `Pagamento` vinculado e valor compatível. Fora do desenvolvimento local, ausência de `INFINITEPAY_WEBHOOK_SECRET` recusa a chamada. Repetição da equipe não cria outra linha quando `equipeId` já existe. Não há transação nem chave de idempotência própria do evento: isso continua pendente no banco. Nenhuma rota grava `Pagamento`, então o webhook não ativa candidatura enquanto essa linha não existir. `CandidaturaArbitro` não tem `pagamentoId`.

**Limite confirmado:** `src/app/api/organizador/ligas/[id]/pagamento/route.ts` descreve o checkout de ativação como **simulado**; a confirmação também é simulada. Não rotule esse caminho como pagamento real só porque existe webhook para outra finalidade. Desde 5 de outubro de 2026, a estrutura do campeonato não responde mais `PAGAMENTO_PENDENTE`: o primeiro campeonato segue nome, categoria e link, e grupos podem ser configurados depois. A tela de pagamento continua disponível e não cobra.

A precificação definida no produto é por partida, com opção de súmula/scouts; confira valores no código ou decisão comercial vigente antes de publicá-los. Pagamento só libera o que estiver efetivamente confirmado pelo provedor e associado ao campeonato certo. Ver [[08-INTEGRACOES]] e [[modulos/PARAMETRIZACAO]].
