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
updated: 2026-10-11
---
# Integrações e serviços

| Serviço | Papel encontrado | Estado a verificar |
| --- | --- | --- |
| Supabase/PostgreSQL | Dados, migrations, RLS e storage | Comparar schema do git com ambiente efetivo |
| InfinitePay | Código de webhook e utilitários | O checkout de ativação continua simulado enquanto `PAGAMENTO_HABILITADO` não for `false`. Ausente, a variável não desliga a cobrança nem grava `pagamentoConfirmadoEm`. Com `false`, a prévia não cobra e a estrutura libera o campeonato sem migration. Com `true`, a estrutura exige essa data. A confirmação manual fica desligada sem `ALLOW_SIMULATED_PAYMENT_CONFIRMATION`. Fora do `next dev` local o webhook só aceita corpo assinado com `INFINITEPAY_WEBHOOK_SECRET`, exige assinatura do mesmo tamanho, confere valor e só conclui o `Pagamento` vinculado |
| Vercel | Hospedagem da aplicação. Produção deve ler `volei-space-producao`; Preview deve ler `caiqueno's Project` | A produção publica a partir da `main`. `NEXT_PUBLIC_SUPABASE_ALVO` é `producao` na Production e `desenvolvimento` no Preview. O build é `npm run build` (`prisma generate` e em seguida `next build`), com Node.js 22.x. O CI está em `.github/workflows/ci.yml`. O CDN guarda por 30s, com mais 60s em `stale-while-revalidate`, só o `GET /api/ligas` público e o `GET /api/categorias` com sucesso. A lista `?organizadorId=` não entra nesse cache. |
| E-mail | Comunicação em `src/lib/email.ts` | Variáveis e entregabilidade dependem do ambiente |
| Google Search Console e DNS | Descoberta do site/domínio | Gestão fora do código principal |

Ao integrar pagamento, correlacione campeonato, pedido e confirmação autenticada; retorno de navegador não substitui confirmação confiável. Documente variáveis sem valores secretos, webhooks, reprocessamento e comportamento em falha. Ver [[modulos/PAGAMENTOS]].

**Auditoria 25/09/2026:** neste ambiente não existe `.env`. `GET /api/ping` responde `database: not_configured`. SMTP, InfinitePay e Postgres real não foram exercitados. Detalhe em [[synthesis/PRONTIDAO-E-APIS]].
