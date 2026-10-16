# 12 - Guia de ambiente local e publicação (volei.space)

Agente: devops-infra. Data: 2026-10-16. Guia proposto: vários comandos abaixo **ainda não existem** no repositório (ver checklist na seção 7).

## 1. Pré-requisitos

- Node.js fixado em `.nvmrc` (sugestão 22 LTS; a máquina usa 24.19.0, confirmar que compila antes de fixar).
- Git, conta Vercel e Supabase, Docker Desktop se adotado o Supabase CLI local.
- O `COMO-TESTAR.txt` afirma que acento no caminho quebra o Next no Windows. O caminho atual contém "Cláudia": validar com `npm run dev`; se quebrar, mover para caminho ASCII (ex.: `C:\dev\volei-space`).

## 2. Comandos padronizados: exigido vs. existente

| Comando | Existe hoje | Proposta |
|---|---|---|
| `setup` | Não | `"setup": "node scripts/setup.mjs"` |
| `dev` | `next dev` | `"dev": "next dev -p 3001"` |
| `test` | Não (10 scripts soltos) | `scripts/run-tests.mjs` ou encadeamento |
| `lint` | `next lint` | `next lint && tsc --noEmit` (ou `typecheck` separado) |
| `build` | `next build` | manter |
| `reset-db` | Não | `supabase db reset` |

Ajustes: trocar `set VAR=...&&` por `cross-env`; agrupar os `test:*` incluindo `supabase-env`, `category-selection` e `category-setup-state`; remover a seção `prisma.seed` ou criar `prisma/seed.ts`; remover/arquivar `setup-db.mjs`.

## 3. O que o `setup` deve fazer

1. Conferir Node contra `.nvmrc`.
2. `npm ci`.
3. Copiar `.env.example` para `.env` se não existir, sem sobrescrever nem imprimir valores.
4. `npx prisma generate`.
5. `supabase start` e `supabase db reset` (migrations + seed).
6. Imprimir a próxima ação: `npm run dev`.

## 4. Seed

Exigido: 2 organizadores, 3 competições (aberta, privada, encerrada), 4 times com atletas, 1 partida em andamento. Hoje há apenas SQLs parciais (`seed-fluxo-cadastro-2026.sql`, `seed-link-flow-2026.sql`, `seed-torneio-2026.sql`, `recriar-simulacao.ts`, `massa-*.ts`). Falta um `supabase/seed.sql` único e idempotente, que só rode com alvo `desenvolvimento` e host local. Nunca contra `volei-space-producao`.

## 5. Fluxo diário

1. `git checkout teste-integrado && git pull`.
2. `git checkout -b fix/<descricao>` (ou `feat/`, `docs/`).
3. Implementar com teste que falhava e passa.
4. `npm run lint`, `npm test`, `npm run build` verdes.
5. Conferir a tela afetada no navegador, incluindo celular.
6. Commit Conventional Commits.
7. PR para `teste-integrado` (o que mudou, por quê, como testar, prints).
8. Merge só com CI verde e revisão.
9. Na `teste-integrado`: `npm run reset-db`, `npm run dev`, `npm test`. Sem `reset-db` e seed isso não é executável hoje; registrar no PR quais dados foram usados.

## 6. Publicar uma versão (SemVer)

Cada passo que toca produção exige aprovação explícita, a cada vez.

1. Escolher a versão e atualizar `package.json` (hoje `0.1.0`, nome `luva-platform`).
2. Atualizar `CHANGELOG.md` (Novidades, Correções, Mudanças importantes).
3. Na `teste-integrado`: build e fluxos críticos (primeiro acesso, cadastro de time, inscrição, papeleta, súmula completa).
4. PR `teste-integrado` → `main`. Pode disparar deploy; confirmar a configuração da Vercel antes.
5. `git tag -a vX.Y.Z -m "..."` e `git push origin vX.Y.Z`.
6. Migrations de produção: confirmar backup, confirmar que não há jogos em andamento, aprovação do usuário, `supabase db push`, verificar contagens e `/api/ping`.
7. Homologação, depois produção; verificar `GET /api/ping` (`alvo: producao`) e roteiro de fumaça.
8. Reverter: ver seção 7 do relatório 11.

Regra de ouro: nunca publicar com jogos em andamento.

## 7. Checklist de pendências

- [ ] `.nvmrc`
- [ ] Normalizar `supabase/migrations/` com timestamps e testar `supabase db reset` do zero (**bloqueador**)
- [ ] `supabase/seed.sql` único e idempotente
- [ ] Scripts `setup`, `test`, `typecheck`, `reset-db`, `dev -p 3001`, `cross-env`
- [ ] `.github/workflows/ci.yml` e proteção de branches
- [ ] `CHANGELOG.md` e renomear o pacote para `volei-space`
- [ ] Atualizar `README.md` e `COMO-TESTAR.txt` (hoje da LUVA)
- [ ] Backup e restauração testados, com data
- [ ] Ensaio de rollback cronometrado
- [ ] Monitor de uptime e Sentry
- [ ] Decisão sobre homologação
- [ ] Remover `setup-db.mjs`
- [ ] Decisão sobre `docker-compose.yml` (relatório 11, seção 3)
