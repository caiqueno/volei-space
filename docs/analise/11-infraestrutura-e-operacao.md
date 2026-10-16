# 11 - Infraestrutura e operação (volei.space)

Agente: devops-infra. Data: 2026-10-16. Somente leitura; nada foi alterado nem executado.

## 1. Estado real vs. exigido

Verificado em `volei-space/` (branch local `teste-integrado`, também em `origin`).

| Item exigido (PROMPT) | Estado real | Situação |
|---|---|---|
| Versão de Node fixada | Não existe `.nvmrc`. Máquina: Node 24.19.0; `setup-db.mjs` pede 22+ | Falta |
| `.env.example` completo | Existe (Supabase, JWT, app, InfinitePay, SMTP) | Parcial |
| `docker-compose.yml` | Não existe; banco é Supabase hospedado | Falta (decisão em 3) |
| `setup` | Não existe | Falta |
| `dev` | `next dev` na porta 3000; `.env.example` e `COMO-TESTAR.txt` assumem 3001 | Divergente |
| `test` (agregado) | 10 scripts `test:*` soltos | Falta |
| `lint` | `next lint`; sem `tsc --noEmit` | Parcial |
| `build` | `next build` | OK |
| `reset-db` | Não existe | Falta |
| Seed (2 org., 3 competições, 4 times, 1 partida) | `package.json` aponta `prisma/seed.ts`, que não existe; há SQLs soltos em `scripts/` | Quebrado |
| CI | Sem `.github/` | Falta |
| `CHANGELOG.md` / SemVer | Não existem; `package.json` em `0.1.0`, nome `luva-platform` | Falta |
| Branches `main` e `teste-integrado` | Existem | OK |
| Plano de volta < 10 min | Não documentado | Falta |
| Observabilidade | Só `GET /api/ping` | Mínima |

Inconsistências por risco:
1. **Migrations fora de ordem.** 52 arquivos em `supabase/migrations/`: 17 com prefixo `2026MMDDNNNN_` e ~35 `supabase-*.sql` sem timestamp. O Supabase CLI rejeita nomes sem timestamp; não há como recriar o schema do zero de forma determinística. Maior obstáculo para `reset-db` e rollback.
2. **Dupla fonte de schema.** `prisma/schema.prisma` sem pasta `migrations/` convive com SQL do Supabase; o código usa `supabase-js`. Recomendação: `supabase/migrations/` como fonte da verdade.
3. **Scripts de teste só no Windows** (`set VAR=...&&`); falta `cross-env`.
4. **Testes sem alias:** `category-selection`, `category-setup-state`, `supabase-env`.
5. **`setup-db.mjs` é legado** (SQLite em caminho de outra pessoa); remover ou arquivar.
6. **`COMO-TESTAR.txt` e `README.md` são da LUVA.** O caminho com acento ("Cláudia") supostamente quebra o Next; revalidar.
7. **`vercel.json` mínimo**; configuração de ambientes só no painel da Vercel.
8. **Segredos:** `.gitignore` cobre `.env*` exceto o exemplo; falta scan de segredos no CI.
9. **`.env.example`** ainda usa `EMAIL_FROM="LUVA Liga <...>"`.

## 2. Ambientes

| Ambiente | Onde | Banco | `NEXT_PUBLIC_SUPABASE_ALVO` | Gatilho |
|---|---|---|---|---|
| Local | `npm run dev` | desenvolvimento | `desenvolvimento` | manual |
| Teste integrado | local, branch `teste-integrado` | desenvolvimento | `desenvolvimento` | PR |
| Preview (Vercel) | URL por PR | desenvolvimento | `desenvolvimento` | todo PR |
| Homologação | **a definir** (hoje usa o banco de desenvolvimento) | ideal: projeto próprio | `desenvolvimento` | tag na `main` |
| Produção | Vercel Production (`main`) | `volei-space-producao` | `producao` | promoção aprovada, nunca durante rodada |

Trava existente em `src/lib/supabase-env.ts` (`lerConfiguracaoSupabase`): só aceita `producao` ou `desenvolvimento`, exige URL `https://*.supabase.co`, em `VERCEL_ENV=production` só `producao`, bloqueia `SUPABASE_HOSTS_PROIBIDOS`; teste em `scripts/supabase-env.test.ts`.

**Lacuna:** a trava só cobre a chave pública. `DATABASE_URL`, `DIRECT_URL` e `SUPABASE_SERVICE_ROLE_KEY` não são validadas; uma variável de produção em Preview passaria. Proposta: validar o host de `DATABASE_URL` contra `NEXT_PUBLIC_SUPABASE_URL`.

Variáveis (só nomes): `DATABASE_URL`/`DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_ALVO`, `SUPABASE_SERVICE_ROLE_KEY` (só servidor), `SUPABASE_HOSTS_PROIBIDOS`, `JWT_SECRET`/`JWT_EXPIRES_IN` (um segredo distinto por ambiente), `NEXT_PUBLIC_APP_URL`, `INFINITEPAY_*`, `SMTP_*`/`EMAIL_FROM`. Alterar variável de produção exige aprovação explícita a cada vez.

## 3. Banco local e docker-compose

- **A (recomendada):** Supabase CLI local (`supabase start`, usa Docker). Reproduz Postgres, Auth, Storage e RLS. Exige corrigir a ordem das migrations. `supabase-env.ts` precisa de exceção restrita (`NODE_ENV=development` e host `127.0.0.1`/`localhost`).
- **B:** Postgres puro em `docker-compose.yml`. Não reproduz RLS, Storage nem PostgREST. Não recomendado.
- **C (atual):** todos no projeto Supabase de desenvolvimento. `reset-db` apagaria dados compartilhados.

## 4. CI/CD

Proposta de `.github/workflows/ci.yml` em todo PR para `teste-integrado` e `main`: checkout; setup-node com `.nvmrc`; `npm ci`; `npx prisma generate`; `lint` e `typecheck`; `npm test`; `npm run build` com variáveis dummy; gitleaks e `npm audit --omit=dev`; proteção de branch (CI verde e 1 revisão, sem push direto; configuração no GitHub, requer aprovação).

Fluxo: `fix/feat/docs` → PR `teste-integrado` → teste local → PR `main` → tag `vX.Y.Z` → homologação → produção. Promoção para produção manual. **Verificar no painel se o deploy da `main` hoje vai direto para produção**; se sim, merge na `main` equivale a deploy e exige aprovação antes. Migrations nunca rodam automaticamente: só por comando aprovado, com backup confirmado.

## 5. Backups

Sem procedimento documentado hoje.
- Supabase Free não tem backup diário utilizável; Pro tem 7 dias; PITR é add-on. Confirmar o plano de `volei-space-producao`.
- Complemento: `pg_dump "$DIRECT_URL" --format=custom --no-owner -f backup-AAAAMMDD-HHMM.dump` (semanal e antes de cada migration), mais exportação do Storage (o dump não inclui arquivos).
- Backup só conta se restaurado: teste mensal em projeto de desenvolvimento, com data registrada.
- Nunca migrar produção sem backup confirmado.

## 6. Correções em `.env.example`

Trocar `EMAIL_FROM` para volei.space; padronizar porta (`next dev -p 3001`); documentar pooler vs. direto; bloco "local com Supabase CLI" (`127.0.0.1:54321`, nunca chaves reais); documentar `NEXT_PUBLIC_VERCEL_ENV` injetada por `next.config.mjs`.

## 7. Plano de volta em menos de 10 minutos

Premissas: migrations aditivas (expand/contract); cada migration em produção com script `down` revisado; backup confirmado antes.

**Código (~2 min):** achar o último deploy bom (`vercel ls --prod`); `vercel rollback <url>` ou Instant Rollback; verificar `GET /api/ping` (`ok:true`, `alvo:"producao"`) e home; criar `git revert` e tag de correção, senão o próximo deploy reaplica a versão ruim.

**Banco (3 a 6 min, só se a migration quebrar):** parar escritas e confirmar que não há jogos em andamento; executar `down` em transação via `psql` (testado antes em dev); sem `down` ou dados corrompidos, restaurar backup (PITR ou `pg_restore`); conferir contagens de `Equipe`, `Liga`, `Partida`.

Gatilho: 5xx acima do normal, falha de login ou inscrição, ou `/api/ping` falhando por mais de 2 min. Quem decide é o usuário. Ensaiar uma vez em Preview/dev e cronometrar; sem ensaio, 10 minutos é meta, não garantia.

## 8. Observabilidade

Hoje: `/api/ping` e logs padrão; 37 arquivos usam `console.error`. `/api/ping` expõe a URL do Supabase e o erro bruto do banco; não devolver a mensagem de erro ao público.

Proposta: (1) monitor de uptime externo em `/api/ping` a cada 5 min; (2) Sentry com `release` = tag SemVer e `environment` = `VERCEL_ENV`; (3) log próprio dos webhooks da InfinitePay para reprocessar; (4) Supabase Reports e advisors semanais; (5) vigiar latência da súmula e do placar ao vivo em rodada; (6) SLOs: 99,5% em horário de jogo, p95 de leitura pública < 1 s, nenhum erro de gravação de súmula sem retentativa.

## 9. Custos mensais estimados

US$ aproximados, **não verificados em tempo real**; câmbio de referência R$ 5,50 (premissa).

| Item | Plano | US$/mês |
|---|---|---|
| Vercel | Pro (Hobby é proibido para uso comercial) | ~20 por assento |
| Supabase produção | Pro (PITR extra ~100) | ~25 |
| Supabase desenvolvimento | Free | 0 |
| Supabase homologação (opcional) | Pro | ~25 |
| E-mail (Resend) | Free ou Pro | 0 a ~20 |
| Domínio `.space` | anual | ~1 a 3 |
| Sentry, uptime | Free | 0 |
| InfinitePay | taxa por transação (confirmar contrato) | 0 fixo |
| **Total sem homologação** | | **~45 a 65** (R$ 250 a 360) |
| **Total com homologação** | | **~70 a 90** (R$ 385 a 495) |

Vigiar: conexões do pooler, egress, armazenamento de mídia, invocações e banda da Vercel.

## 10. Questões abertas

1. Homologação com projeto Supabase próprio (~US$ 25/mês) ou usar o de desenvolvimento?
2. O merge na `main` dispara deploy automático em produção? Travar a promoção para manual?
3. Qual o plano atual do Supabase de produção; há backup/PITR?
4. Autoriza padronizar o banco local com Supabase CLI e renomear migrations para timestamps (conferindo contra o histórico aplicado em produção)?
