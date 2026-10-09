---
title: >-
  Integrações
category: area
tags: [integracoes]
sources: [repo:athrios/volei-space]
summary: >-
  Serviços externos.
status: implementado
created: 2026-09-20
updated: 2026-10-09
---
# Integrações e serviços

| Serviço | Papel encontrado | Estado a verificar |
| --- | --- | --- |
| Supabase/PostgreSQL | Dados, migrations, RLS e storage | Comparar schema do git com ambiente efetivo |
| InfinitePay | Código de webhook e utilitários | O checkout de ativação do campeonato em `src/app/api/organizador/ligas/[id]/pagamento` está marcado como **simulado**; não afirmar ativação real sem conferir. O webhook, quando usado, falha fechado sem `INFINITEPAY_WEBHOOK_SECRET`, exige assinatura do mesmo tamanho e só conclui o `Pagamento` cujo `external_id` confere |
| Vercel | Hospedagem da aplicação. Produção deve ler `volei-space-producao`; Preview deve ler `caiqueno's Project` | A produção publica a partir da `main`. `NEXT_PUBLIC_SUPABASE_ALVO` é `producao` na Production e `desenvolvimento` no Preview. |
| E-mail | Comunicação em `src/lib/email.ts` | Variáveis e entregabilidade dependem do ambiente |
| Google Search Console e DNS | Descoberta do site/domínio | Gestão fora do código principal |

Ao integrar pagamento, correlacione campeonato, pedido e confirmação autenticada; retorno de navegador não substitui confirmação confiável. Documente variáveis sem valores secretos, webhooks, reprocessamento e comportamento em falha. Ver [[modulos/PAGAMENTOS]].

**Auditoria 25/09/2026:** neste ambiente não existe `.env`. `GET /api/ping` responde `database: not_configured`. SMTP, InfinitePay e Postgres real não foram exercitados. Detalhe em [[synthesis/PRONTIDAO-E-APIS]].
