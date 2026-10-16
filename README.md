# volei.space

Plataforma SaaS de campeonatos de vôlei: inscrição de equipes por link de categoria, tabela, súmula digital, classificação e portal público. Atende vários organizadores independentes. `Liga`, `ligaId` e LUVA são nomes legados do código e não definem a identidade do produto.

## Antes de mexer no código

Leia `CLAUDE.md` e a nota do módulo em `volei.space — Plataforma de Campeonatos de Vôlei/`. Os relatórios de análise e o plano de evolução estão em `docs/analise/`.

## Stack

Next.js 14 (App Router), TypeScript, Tailwind CSS, Supabase (Postgres, Storage), Prisma (apenas tipos e validação), JWT com cookie httpOnly (`jose`), Zod.

## Como rodar

Requisitos: Node.js 22 (`.nvmrc`).

```bash
npm run setup                # confere o Node, instala, cria o .env.local e gera o Prisma Client
# preencha o .env.local com os valores do projeto Supabase de DESENVOLVIMENTO
npm run dev                  # http://localhost:3000
```

Roteiro de teste manual: `docs/COMO-TESTAR.md`.

Nunca use as credenciais de produção em ambiente local. A trava em `src/lib/supabase-env.ts` recusa combinar o alvo errado.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run setup` | Prepara o ambiente local (Node, dependências, `.env.local`, Prisma) |
| `npm run reset-db` | Recria o banco **local** (Docker + Supabase CLI); recusa qualquer alvo remoto |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run lint` | ESLint |
| `npm run typecheck` | Conferência de tipos |
| `npm run test:unit` | Todos os testes de `scripts/` |
| `npm run build` | Build de produção local |

## Administrador

Não há credencial padrão. O administrador é a conta da tabela `Admin` do seu ambiente e `ADMIN_EMAIL` precisa estar definido; sem ele ninguém entra como admin.

## Fluxo de trabalho

`fix/…`, `feat/…` ou `docs/…` → PR para `teste-integrado` → teste integrado local → PR para `main`. A `main` publica direto em produção na Vercel: nada entra nela sem aprovação, e nunca durante uma rodada com jogos em andamento.

## Banco de dados

As migrations aplicáveis ficam em `supabase/migrations/`. As da Fase 0 ainda não aplicadas, com a reversão de cada uma, ficam em `supabase/pendentes/` (ver o `LEIA-ME.md` de lá e `docs/analise/16-plano-aplicacao-migrations.md`).
