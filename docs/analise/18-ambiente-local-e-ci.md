# 18. Ambiente local, CI, branches e ambientes (volei.space)

Autor: agente `devops-infra`. Data: 2026-10-16.
Fontes lidas: `docs/PROMPT-volei-space.md` (seção "Fluxo de correções e publicações"), `docs/analise/01-diagnostico-volei-space.md`, `package.json`, `.env.example`, `setup-db.mjs`, `vercel.json`, `supabase/migrations/`, `COMO-TESTAR.txt`, `src/lib/supabase-env.ts`, `src/lib/supabase-admin.ts`, `src/lib/admin-access.ts`.
Nada foi instalado, executado ou conectado a Supabase/Vercel. Nenhuma ação em produção. Todo comando abaixo é proposta para aprovação.

## 0. Achados que mudam o plano

1. **O app recusa Supabase local hoje.** `src/lib/supabase-env.ts` exige `https:` e host terminando em `.supabase.co`. O `supabase start` expõe `http://127.0.0.1:54321`, então o app responderia "NEXT_PUBLIC_SUPABASE_URL inválida". Precisa de uma exceção pequena e segura (ver 1.4). Sem ela, o banco local não funciona.
2. **Não existe baseline.** As tabelas base (`Liga`, `Equipe`, `Partida`, `Jogador`, `Admin`...) vieram de `prisma db push` histórico. Só 14 dos 52 arquivos em `supabase/migrations/` têm `create table`, e as migrations `2026...` dependem de `"Liga"` já existir. Os 35 arquivos `supabase-*.sql` não têm prefixo de data, então a ordem de aplicação é desconhecida.
3. `package.json` aponta `prisma.seed` para `prisma/seed.ts`, que não existe. O runtime não usa Prisma (diagnóstico, item 1.1).
4. `.env.example` está incompleto e com valores enganosos (lista em 1.5).
5. Os scripts `test:*` usam `set VAR=...&&` (cmd.exe do Windows) e **não rodam no runner Linux do CI**. É preciso trocar por `cross-env` antes de o CI ficar verde (ver 1.7 e 2.1).
6. Não há `.github/`, `.nvmrc`, `engines`, `docker-compose.yml`, `supabase/config.toml`, `CHANGELOG.md` nem tags de versão.
7. `setup-db.mjs` (SQLite da LUVA, caminho `C:/Users/willm/...`) e `COMO-TESTAR.txt` (admin `admin@luv.com.br`, `prisma migrate dev`, caminho sem acento) estão obsoletos e perigosos: sair do fluxo (ver 1.6).

## 1. `setup` e `dev` com um comando

### 1.1 Escolha técnica
Supabase local via **Supabase CLI + Docker** (`supabase start`). Entrega Postgres, PostgREST, Auth, Storage, Studio e Mailpit, compatíveis com o `@supabase/supabase-js` que o app já usa. Alternativa descartada: `docker-compose` com Postgres puro, porque o app depende de PostgREST, Storage e RLS. O `test:categorias` hoje usa um Postgres Docker ad hoc (porta 55439, não versionado); o CI da seção 2 o substitui.

Pré-requisitos fixos: Node 20 LTS (`.nvmrc` com `20` e `engines.node` `>=20 <21` no `package.json`; a máquina atual tem Node 24, que provavelmente roda, mas Next 14.2 é validado em 18/20), Docker Desktop e Supabase CLI (como devDependency `supabase`, sem instalação global).

### 1.2 Arquivos a criar (todos novos)

| Arquivo | Conteúdo |
|---|---|
| `.nvmrc` | `20` |
| `supabase/config.toml` | gerado por `npx supabase init`; `project_id = "volei-space-local"`; `[db.seed] sql_paths = ["./seed.sql"]` |
| `supabase/seed.sql` | seed idempotente (1.6) |
| `scripts/setup.mjs` | orquestra o setup (1.7) |
| `scripts/gen-env-local.mjs` | lê `npx supabase status -o env` e grava `.env.local` com as chaves locais (não são segredos reais) |
| `scripts/reset-db.mjs` | `supabase db reset` com mensagem |

### 1.3 Baseline do schema a partir das migrations
Problema: as migrations atuais não sobem do zero. Plano em etapas; a etapa 1 toca um projeto Supabase real (somente leitura de DDL) e **exige aprovação**:

1. **Gerar o baseline do schema do projeto de desenvolvimento** (`caiqueno's Project`, nunca produção), só DDL, sem dados:
   `npx supabase db dump --schema public,storage --linked -f supabase/migrations/20260101000000_baseline.sql`
   Precisa de `supabase link` ao projeto de desenvolvimento e da senha do banco, que só o usuário fornece. Risco: baixo (leitura). Verificar: o arquivo contém `Liga`, `Equipe`, `Partida`, `Jogador`, `Admin`, políticas RLS e as funções `recalcular_classificacao_liga` e `finalizar_inscricao_equipe_rascunho`. Desfazer: apagar o arquivo.
   Alternativa sem acesso ao banco: `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`. Gera só as tabelas base e **defasadas** (faltam `categoriaCampeonatoId`, `AcessoArbitroJogo`, `tokenInscricao`); serve de rascunho, com risco de erro de ordem.
2. **Ordem determinística**: os 17 arquivos `2026MMDDnnnn_*.sql` precisam de prefixo de 14 dígitos exigido pela CLI (por exemplo `20260922000100_...`). Os 35 `supabase-*.sql` já estão refletidos no dump e saem da pasta ativa para `supabase/migrations-legado/` (histórico, não executam). Para saber quais datados o dump já inclui, comparar com a tabela `supabase_migrations.schema_migrations` do projeto de desenvolvimento (leitura, com aprovação) ou usar a data do dump como corte.
3. **Critério de aceite**: `npx supabase db reset` termina sem erro em Docker limpo e `npm run test:db` (testes que exigem banco) passa.
4. **Produção não é tocada.** Produção já tem esse schema; o baseline serve a local e CI. Qualquer `supabase migration repair` ou comparação de schema com produção só com aprovação explícita e backup confirmado.

### 1.4 Ajuste de código necessário (outro agente, PR para `teste-integrado`)
Em `src/lib/supabase-env.ts`, aceitar `http://127.0.0.1:54321` e `http://localhost:54321` **somente** quando `alvo === 'desenvolvimento'` e `deploy !== 'production'`. Manter `https` e `.supabase.co` para todo o resto. Acrescentar casos em `scripts/supabase-env.test.ts`: local aceito em desenvolvimento; recusado com `alvo=producao` e com `VERCEL_ENV=production`. Isso preserva a trava que impede a preview de usar o banco de produção.

### 1.5 `.env.example` completo e corrigido
O que falta ou está errado hoje:

| Item | Situação atual | Correção |
|---|---|---|
| `ADMIN_EMAIL` | **ausente**; lido em `src/lib/admin-access.ts:8` e `src/lib/auth.ts:7`. Se vazio, qualquer e-mail de admin é aceito | incluir; obrigatório em preview e produção |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3001`, mas `next dev` sobe na **3000** (sem `-p`) | padronizar: `http://localhost:3000`, ou fixar `next dev -p 3001`. As duas pontas precisam coincidir. Afeta links de QR, e-mails e webhook (`qrcode.ts:9`, `infinitepay/route.ts:91`) |
| `DATABASE_URL`, `DIRECT_URL` | pedidos, mas o runtime não usa Prisma | remover (ou marcar "só `prisma db pull` manual") |
| `SUPABASE_SERVICE_ROLE_KEY` | vazio, sem orientação local | comentar que `npm run setup` preenche com a chave local; nunca `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_SUPABASE_URL` | só formato `https://xxxxx.supabase.co` | exemplo local `http://127.0.0.1:54321` (depende de 1.4) |
| `GOOGLE_SITE_VERIFICATION` | usada em `layout.tsx:51`, ausente | incluir, opcional |
| `EMAIL_FROM` | "LUVA Liga <contato@seudominio...>" | `volei.space <contato@seudominio>` |
| `VERCEL_ENV`, `NEXT_PUBLIC_VERCEL_ENV` | lidas por `supabase-env.ts`, ausentes | documentar: a Vercel injeta; local fica vazio |
| `NODE_ENV` | listado | remover (o Next define) |
| `JWT_SECRET` | placeholder | instrução para gerar valor aleatório de 48+ caracteres; local: valor de teste |
| SMTP | Resend | local: Mailpit do `supabase start` ou vazio |
| InfinitePay | vazias | manter vazias no local; confirmar que o webhook rejeita quando o segredo está vazio (risco S10 do diagnóstico) |

Proposta de arquivo (valores locais não são segredos reais; chaves preenchidas pelo `setup`):

```dotenv
# ---- Supabase (app Next.js; nao use VITE_*) ----
NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"
NEXT_PUBLIC_SUPABASE_ANON_KEY=""        # preenchido por npm run setup
SUPABASE_SERVICE_ROLE_KEY=""            # so servidor; preenchido por npm run setup
NEXT_PUBLIC_SUPABASE_ALVO="desenvolvimento"   # producao SOMENTE no deploy da main
SUPABASE_HOSTS_PROIBIDOS=""             # em preview: host do banco de producao

# ---- Auth ----
JWT_SECRET="dev-only-troque-em-preview-e-producao-32chars+"
JWT_EXPIRES_IN="8h"
ADMIN_EMAIL="admin@local.test"          # obrigatorio fora do local

# ---- App ----
NEXT_PUBLIC_APP_URL="http://localhost:3000"
GOOGLE_SITE_VERIFICATION=""

# ---- Pagamento (vazio no local) ----
INFINITEPAY_API_KEY=""
INFINITEPAY_WEBHOOK_SECRET=""

# ---- E-mail (local: Mailpit do Supabase) ----
SMTP_HOST="127.0.0.1"
SMTP_PORT="54325"
SMTP_USER=""
SMTP_PASS=""
EMAIL_FROM="volei.space <contato@local.test>"
```

### 1.6 Seed (`prisma/seed.ts` inexistente)
Decisão: **não criar `prisma/seed.ts`**; o runtime é Supabase, não Prisma. Remover o bloco `"prisma": { "seed": ... }` do `package.json`. Aposentar a pasta `prisma/` inteira é decisão do arquiteto e do agente de banco; não bloqueia o resto.
Seed real: `supabase/seed.sql`, idempotente (`on conflict do nothing`), seguindo o PROMPT: 2 organizadores, 3 campeonatos (aberto, privado, encerrado), 4 equipes com atletas e 1 partida em andamento, mais:
- 1 admin (tabela `Admin`, hash bcrypt) com e-mail igual ao `ADMIN_EMAIL` local, e 1 organizador já ativado (sem `trocarSenha`), para pular a aprovação manual do fluxo real;
- reaproveitar `scripts/seed-torneio-2026.sql`, `seed-link-flow-2026.sql`, `seed-fluxo-cadastro-2026.sql` e `npm run seed:simulacao` como ponto de partida (verificar se rodam sobre o baseline);
- marcar tudo com `simulacao = true` (migration `supabase-simulacao.sql`) para nunca aparecer em listagem pública.
Credenciais de teste vivem só no `seed.sql` e no README local; não usar as do README LUVA (`admin@luv.com.br`, risco S3 do diagnóstico) nem repeti-las em chat. Em PR separado (`docs/`): remover `setup-db.mjs`, `COMO-TESTAR.txt` e as credenciais do `README.md`.

### 1.7 Comandos padronizados (`package.json`)
Trocar `set VAR=...&&` por `cross-env` (devDependency) para rodar em Windows, Linux e CI.

| Script | Comando |
|---|---|
| `setup` | `node scripts/setup.mjs`: checa Node e Docker, `npm ci`, copia `.env.example` para `.env.local` se não existir, `supabase start`, `supabase db reset` (baseline + migrations + seed), `gen-env-local`, imprime URLs |
| `dev` | `next dev -p 3000` (porta igual à de `NEXT_PUBLIC_APP_URL`) |
| `db:start` / `db:stop` | `supabase start` / `supabase stop` |
| `reset-db` | `supabase db reset` |
| `test` | encadeia todos os `test:*` sem banco, com `cross-env` (hoje não existe `npm test`) |
| `test:db` | `test:categorias` e os testes `category-selection` e `category-setup-state` contra o Supabase local |
| `lint` | `next lint && tsc --noEmit` |
| `build` | `next build` |

Meta do PROMPT: pessoa nova roda `npm run setup` e `npm run dev` em menos de 15 minutos. A primeira execução baixa as imagens Docker do Supabase (alguns GB); medir isso no teste de aceite.
Ressalva: o repositório está em caminho com acento (`Cláudia`). O `COMO-TESTAR.txt` diz que isso quebra o Next no Windows; validar no primeiro `setup` e, se quebrar, documentar clone em caminho ASCII.

## 2. CI (lint, test, build em todo PR)

### 2.1 Pré-requisitos para o CI ficar verde
1. `cross-env` nos scripts e `npm test` agregado (1.7).
2. Existir `.eslintrc.json` (confirmar; `eslint-config-next` já está instalado). Se não existir, criar com `next/core-web-vitals`.
3. Testes que exigem Postgres (`category-selection`, `category-setup-state`) rodam só no job `db-tests`.
4. O `build` recebe variáveis fictícias (não segredos); nenhuma conexão a banco real.

### 2.2 Workflow (`.github/workflows/ci.yml`)

```yaml
name: CI

on:
  pull_request:
    branches: [teste-integrado, main]
  push:
    branches: [teste-integrado]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

env:
  NODE_VERSION: "20"
  # Valores FICTICIOS so para compilar. Nenhum segredo real no CI.
  NEXT_PUBLIC_SUPABASE_URL: "https://ci-placeholder.supabase.co"
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "ci-anon-placeholder"
  NEXT_PUBLIC_SUPABASE_ALVO: "desenvolvimento"
  JWT_SECRET: "ci-only-jwt-secret-with-at-least-32-chars"
  ADMIN_EMAIL: "admin@ci.test"
  NEXT_PUBLIC_APP_URL: "http://localhost:3000"

jobs:
  lint-test-build:
    name: lint, test, build
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - name: Lint e tipos
        run: npm run lint
      - name: Testes (sem banco)
        run: npm test
      - name: Build
        run: npm run build
      - name: Auditoria de dependencias (informativa)
        run: npm audit --omit=dev --audit-level=high
        continue-on-error: true

  db-tests:
    name: migrations e testes com banco
    runs-on: ubuntu-latest
    timeout-minutes: 20
    # Ligar somente depois do baseline (secao 1.3); ate la, if: false
    if: false
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - uses: supabase/setup-cli@v1
        with:
          version: latest   # fixar versao exata apos o primeiro teste local
      - name: Subir Supabase local
        run: supabase start -x studio,imgproxy,edge-runtime,logflare,vector
      - name: Provar que o schema sobe do zero
        run: supabase db reset
      - name: Testes que exigem banco
        run: npm run test:db
      - if: always()
        run: supabase stop --no-backup
```

Regras de merge (ação do usuário em GitHub > Settings > Branches): exigir os checks `lint, test, build` (e `migrations e testes com banco` quando ligado), 1 aprovação, sem push direto em `main` e `teste-integrado`. Secrets: nenhum necessário; não colocar `SUPABASE_SERVICE_ROLE_KEY` real no CI.

## 3. Branches, SemVer, CHANGELOG e plano de volta

### 3.1 Branches
`fix|feat|docs/...` → PR → `teste-integrado` (integração e teste local) → PR → `main` (estável). O status do repositório mostra `HEAD` destacado: a branch `teste-integrado` precisa ser criada a partir de `main` (`git branch teste-integrado main`, depois `git push -u origin teste-integrado`, com aprovação do usuário). Ambas protegidas; merge em `main` só por PR com CI verde. Hotfix urgente: `fix/...` a partir de `main`, PR para `main` (com aprovação) e merge de volta em `teste-integrado` para não divergir.
Vercel: `teste-integrado` e PRs geram **preview** (banco de desenvolvimento); `main` gera **produção**. Homologação = preview de `teste-integrado` (ou 3º projeto Supabase, ver seção 4).

### 3.2 SemVer
`package.json` ainda é `luva-platform 0.1.0`; renomear para `volei-space`. Ficar em `0.x` enquanto o produto muda muito; `1.0.0` quando inscrição e súmula estiverem estáveis. MAJOR = quebra de API ou de dados (migration destrutiva); MINOR = funcionalidade; PATCH = correção. Tag anotada na `main` depois do merge (`v0.2.0`). Conventional Commits permitem automatizar depois (opcional).

### 3.3 CHANGELOG
`CHANGELOG.md` na raiz, formato Keep a Changelog em linguagem simples: `Novidades`, `Correções`, `Mudanças importantes` (inclui "exige migration"). Cada PR para `teste-integrado` acrescenta uma linha em `[Não lançado]`; o PR `teste-integrado` para `main` fecha a versão com data. Linha com migration traz o nome do arquivo e o do SQL de reversão.

### 3.4 Plano de volta (meta: menos de 10 minutos)
Regra de projeto que viabiliza a meta: **migrations expand/contract**. Toda migration é aditiva e retrocompatível com a versão anterior do código (coluna nula, tabela nova); nada de renomear ou apagar na mesma versão. Remoções só na versão seguinte. Cada migration traz `supabase/rollback/<id>.sql`, testado em local.

Cada passo em produção exige aprovação explícita, e nunca durante rodada com jogos em andamento.

| # | Passo | Comando / ação | Tempo | Como verificar |
|---|---|---|---|---|
| 1 | Congelar publicações | pausar merges em `main` | 1 min | n/a |
| 2 | Voltar o código | Vercel > Deployments > deploy anterior > Promote to Production (ou `vercel rollback <url>`), sem rebuild | 1 min | abrir `/`, `/login`, 1 campeonato |
| 3 | Banco, se a migration era aditiva | **não reverter**; o código antigo funciona | 0 | testes de fumaça |
| 4 | Migration quebrou algo | aplicar `supabase/rollback/<id>.sql` em produção (preparar o comando, não executar sem aprovação) | 3 min | contagem das tabelas afetadas |
| 5 | Dados corrompidos | restaurar backup (PITR no Pro; backup diário) | 15+ min | **fora da meta**; por isso backup confirmado antes de toda migration |
| 6 | Corrigir o repositório | `git revert <merge>` em PR para `main` (nunca `reset --force`), nova tag `v0.2.1` | 5 min | CI verde |

Pré-condição de toda publicação com migration: **backup confirmado**. Sem PITR no plano Free, o backup é manual (`supabase db dump --linked`), guardado fora do repositório. Ensaiar a restauração em banco local a cada trimestre.

## 4. Produção, preview e variáveis por ambiente

### 4.1 Separação

| Ambiente | Origem | Supabase | `NEXT_PUBLIC_SUPABASE_ALVO` | Domínio |
|---|---|---|---|---|
| Local | máquina do dev | Supabase CLI/Docker | `desenvolvimento` | `localhost:3000` |
| Preview (teste integrado) | PRs e `teste-integrado` | projeto `caiqueno's Project` (desenvolvimento), dados de seed | `desenvolvimento` | `*.vercel.app`, com Vercel Authentication |
| Homologação (opcional) | release candidate | idealmente 3º projeto `volei-space-homologacao`; o código hoje só conhece 2 alvos (`producao` e `desenvolvimento`), então até lá homologa-se na preview | `desenvolvimento` | opcional `homolog.volei.space` |
| Produção | `main` | `volei-space-producao` | `producao` | `volei.space` |

A trava de `supabase-env.ts` já impõe: deploy de produção só com alvo `producao`; o resto só `desenvolvimento`. Reforço: preencher `SUPABASE_HOSTS_PROIBIDOS` nos escopos Preview e Development da Vercel com o host do banco de produção, e definir cada variável por escopo (Production / Preview / Development), nunca "All Environments" para chaves do Supabase. A service role de produção fica só no escopo Production.

### 4.2 Checklist de variáveis (nomes, sem valores)
"Sens." = segredo (nunca `NEXT_PUBLIC_`, nunca em log). L = local, V = preview, P = produção.

| Variável | Sens. | L | V | P | Observação |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | não | sim (127.0.0.1) | sim (dev) | sim (prod) | par diferente por ambiente |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | não (publicável) | sim | sim | sim | a proteção é a RLS |
| `NEXT_PUBLIC_SUPABASE_ALVO` | não | `desenvolvimento` | `desenvolvimento` | `producao` | trava de segurança |
| `SUPABASE_SERVICE_ROLE_KEY` | **sim** | sim (local) | sim (dev) | sim (prod) | ignora RLS; só servidor |
| `SUPABASE_HOSTS_PROIBIDOS` | não | opcional | sim | opcional | host de produção |
| `JWT_SECRET` | **sim** | sim | sim, distinto | sim, distinto | rotacionar invalida sessões |
| `JWT_EXPIRES_IN` | não | sim | sim | sim | |
| `ADMIN_EMAIL` | média | sim | sim | sim | vazio libera qualquer admin; tornar obrigatório |
| `NEXT_PUBLIC_APP_URL` | não | localhost:3000 | URL da preview | URL de produção | links de QR e e-mail |
| `GOOGLE_SITE_VERIFICATION` | não | não | não | opcional | |
| `INFINITEPAY_API_KEY` | **sim** | vazio | vazio ou sandbox | sim | pagamento é simulado em produção hoje (diagnóstico, item 11) |
| `INFINITEPAY_WEBHOOK_SECRET` | **sim** | vazio | vazio ou sandbox | sim | confirmar rejeição quando vazio |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` | baixa | Mailpit | sandbox | sim | |
| `SMTP_PASS` | **sim** | vazio | chave restrita | sim | |
| `EMAIL_FROM` | não | sim | sim | sim | domínio verificado no Resend |
| `VERCEL_ENV`, `NEXT_PUBLIC_VERCEL_ENV` | não | vazio | automático | automático | lidas por `supabase-env.ts` |
| `DATABASE_URL`, `DIRECT_URL` | **sim** | não | não | não | não usadas pelo runtime; remover da Vercel se existirem |

Auditoria proposta: listar as variáveis hoje cadastradas na Vercel e comparar com esta tabela (leitura; mudança só com aprovação). Rotacionar `JWT_SECRET` e chaves caso algum valor já tenha aparecido em chat ou repositório.

## 5. Custos e riscos

### 5.1 Custos mensais
Valores de referência de planos públicos, de memória e sujeitos a mudança: confirmar nas páginas de preço antes de decidir.

| Item | Opção | Estimativa mensal | Limite que importa |
|---|---|---|---|
| Vercel | Hobby é para uso não comercial; produto com cobrança pede **Pro** | cerca de US$ 20 por usuário | banda e funções serverless; termos do Hobby |
| Supabase produção | Free (só teste) ou **Pro** | US$ 0 / cerca de US$ 25 | Free pausa por inatividade, sem backup diário nem PITR e banco de 500 MB; Pro tem backup diário |
| Supabase desenvolvimento | Free | US$ 0 | pausa por inatividade; limite de projetos Free |
| GitHub Actions | repositório privado: 2.000 min/mês no Free | US$ 0 | estimativa 8 a 12 min por PR; `db-tests` com Docker consome mais |
| Resend | Free | US$ 0 | cerca de 3.000 e-mails/mês, 100/dia |
| Domínio `.space` | anual | poucos dólares por mês equivalentes | renovação |
| 3º Supabase (homologação) | Free ou Pro | US$ 0 a 25 | só se justificar |
| **Total mínimo viável** | | **cerca de US$ 45 a 50 por mês** (Vercel Pro + Supabase Pro) | |

O custo é dominado pelo Supabase Pro e pelo Vercel Pro. Não usar Free em produção com dados de menores de idade (LGPD).

### 5.2 Riscos

| # | Risco | Prob. / Impacto | Mitigação |
|---|---|---|---|
| R1 | Baseline sai errado e local/CI divergem de produção | média / alta | gerar do banco de desenvolvimento; comparar com produção por `supabase db diff` (leitura, com aprovação); aceite = `db reset` limpo |
| R2 | Exceção de URL local em `supabase-env.ts` enfraquece a trava produção/preview | baixa / alta | só `127.0.0.1` e `localhost`, só com `alvo=desenvolvimento` e `VERCEL_ENV != production`, com teste automatizado |
| R3 | Preview apontando para banco de produção ou o inverso | baixa / crítica | trava existente, `SUPABASE_HOSTS_PROIBIDOS`, variáveis por escopo |
| R4 | Migration quebra produção sem volta rápida | média / alta | expand/contract, `rollback/<id>.sql` testado, backup antes, janela fora de rodada |
| R5 | Supabase Free pausa ou perde dados em produção | média / alta | Pro em produção; backup manual até lá |
| R6 | Scripts `set ...&&` falham no CI, macOS e Linux | certa / média | `cross-env` antes de ligar o CI |
| R7 | Credenciais LUVA (`admin@luv.com.br`) no repositório ainda válidas em algum ambiente | média / alta | verificar se a conta existe em produção, rotacionar, remover dos arquivos (S3 do diagnóstico) |
| R8 | `ADMIN_EMAIL` ausente libera qualquer e-mail de admin | média / média | exigir fora do local (falhar na inicialização) |
| R9 | Publicar durante rodada com jogos | baixa / alta | checar partidas `EM_ANDAMENTO` e `/ao-vivo` antes; deploy fora de janela de rodada |
| R10 | Docker/Supabase local pesado em máquina fraca; caminho com acento no Windows | média / baixa | documentar mínimo de RAM; validar no primeiro `setup`; fallback: preview |
| R11 | Pagamento simulado em produção pode ser confundido com cobrança real | média / média | fora da infra; sinalizar ao backend |
| R12 | Falso verde do CI (poucos testes; nenhum de autorização das rotas) | alta / média | CI é piso, não prova; ampliar testes (agente `qa`) |

## 6. Ordem sugerida (cada item é um PR pequeno para `teste-integrado`)

1. Criar `teste-integrado`, `.nvmrc`, `engines`, `cross-env`, `npm test` agregado, `.env.example` corrigido (nada depende de banco).
2. `ci.yml` só com o job `lint, test, build`; ligar proteção de branch.
3. `CHANGELOG.md` e renomear o pacote para `volei-space` (versão `0.2.0`).
4. `supabase init`, ajuste 1.4 em `supabase-env.ts` (com teste), scripts `setup` e `reset-db`.
5. Baseline (leitura do projeto de desenvolvimento, com aprovação), `seed.sql`, ligar `db-tests`.
6. Limpeza do legado: `setup-db.mjs`, `COMO-TESTAR.txt`, `prisma.seed`, credenciais LUVA no README.
7. Ensaiar o plano de volta numa preview (rollback de deploy + migration de teste) e registrar em `docs/analise/12-guia-ambiente-local-e-publicacao.md` (nome de entrega do PROMPT).

## 7. Aprovações que dependem do usuário

Criar e enviar a branch `teste-integrado`; proteção de branches no GitHub; vincular a CLI ao projeto de desenvolvimento e ler o schema (`db dump`); qualquer mudança em variáveis da Vercel; qualquer acesso ao Supabase de produção (inclusive comparar schema); decisão de aposentar o Prisma; compra ou upgrade de planos.
