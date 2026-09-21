# Preço e pagamentos

**Implementado:** motor de preço por campeonato e estimativa de partidas em `src/lib/pricing`; cupom e componentes opcionais no código. Há `src/lib/infinitepay.ts` e webhook `src/app/api/webhooks/infinitepay`.

**Limite confirmado:** `src/app/api/organizador/ligas/[id]/pagamento/route.ts` descreve o checkout de ativação como **simulado**; a confirmação também é simulada. Não rotule esse caminho como pagamento real só porque existe webhook para outra finalidade.

A precificação definida no produto é por partida, com opção de súmula/scouts; confira valores no código ou decisão comercial vigente antes de publicá-los. Pagamento só libera o que estiver efetivamente confirmado pelo provedor e associado ao campeonato certo. Ver [[08-INTEGRACOES]] e [[modulos/PARAMETRIZACAO]].
