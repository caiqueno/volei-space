---
title: >-
  Prontidão, APIs e conexões
category: synthesis
tags: [apis, lint, prontidao]
sources: [repo:athrios/volei-space]
summary: >-
  Auditoria LLM Wiki: o que está pronto, o que falta de ambiente e quais rotas não são duplicata.
status: misto
created: 2026-09-25
updated: 2026-10-09
---

# Prontidão, APIs e conexões

> [!warning] Não está pronto para uso real
> O app sobe, mas **não há `.env`**. Sem Supabase, JWT, SMTP e InfinitePay o produto não persiste dados nem envia e-mail/pagamento. Copie `.env.example` para `.env` e preencha os valores antes de operar.

> [!tldr] Decisão (LLM Wiki)
> Uma fonte por assunto. Skills de agente ficam só em `.agents/skills` e `.cursor/skills`. A cópia dentro do vault foi removida para não poluir o gráfico. Requisitos continuam em `docs/requisitos/`; a wiki aponta para [[references/CATEGORIAS-COMO-COMPETICOES]], [[references/INSCRICOES-POR-EQUIPE]] e [[references/SUMULA-DIGITAL-E-CLASSIFICACAO]].

## O que foi testado em 25/09/2026

| Verificação | Resultado |
| --- | --- |
| `npm run test:pricing` | ok |
| `npm run test:team-sync` | ok |
| `npm run test:championship-setup` | ok |
| `npm run test:organizer-flow` | ok |
| `npm run test:registration-draft` | ok depois de apontar o teste para `supabase/migrations/202609200015_inscricao-equipe-rascunho.sql` (o arquivo na raiz não existia — era referência duplicada/errada) |
| `GET /api/ping` em `localhost:3001` | `200` — `database: not_configured` |
| Rotas que leem banco (`/api/ligas`, classificação, rankings, partidas, equipes, galeria) | `500` — fetch ao Supabase placeholder falha. Esperado sem `.env` |
| `GET /api/auth` e `GET /api/inscricao-rapida` e `GET /api/webhooks/infinitepay` | `405` — a rota existe; o método certo é POST |
| `GET /api/convites-equipe` | `401` — exige organizador autenticado |
| `GET /api/inscricoes-campeonato` | `400` — falta `candidaturaId` |
| Rota inexistente | `404` |

Conexões **não exercitadas** (sem credencial): PostgreSQL/Supabase real, SMTP/Resend, InfinitePay, Vercel. Ver [[08-INTEGRACOES]].

## Rotas que parecem repetidas e não são

| Par | Papel |
| --- | --- |
| `/api/organizador/ligas/[id]/calendario` | Datas/horários das **partidas** |
| `/api/organizador/ligas/[id]/setup/calendario` | Só `dataInicio`/`dataFim` do campeonato e locais |
| `src/lib/supabase.ts` | Cliente público (anon) |
| `src/lib/supabase-admin.ts` | Cliente de serviço (servidor) |

## Inscrições — três fluxos vivos (não apagar às cegas)

| Rota | Quem usa | Papel |
| --- | --- | --- |
| `/api/inscricao-rapida` | formulário de inscrição rápida | Rascunho por token; equipe nasce na finalização. Alvo do requisito, ainda pendente de fechar o fluxo. [[modulos/INSCRICOES]] |
| `/api/inscricoes-campeonato` | painel, capitão, ações do campeonato | Lista e aprovação. O setup de inscrições ainda reaproveita este fluxo |
| `/api/candidaturas/equipes` | página de cadastro | Candidatura antiga (aprovação). Histórico LUVA ainda ligado na UI |
| `/api/inscricao/[slug]/jogadores` | página pública `/inscricao/[slug]` | Jogadores por slug |
| `/api/convites-equipe` | **nenhuma tela** chama esta URL | API de convite por e-mail existe; a UI não a usa. Órfã de interface — não é cópia da inscrição rápida |

> [!todo] Próximo passo de produto
> Unificar inscrição no convite por categoria ([[references/INSCRICOES-POR-EQUIPE]]) e só então aposentar candidatura/aprovação. Isso é regra **aprovada, pendente**, não está feito.

## Para deixar utilizável

1. Criar `.env` a partir de `.env.example` (Supabase, `JWT_SECRET`, `NEXT_PUBLIC_APP_URL`).
2. Aplicar migrations em `supabase/migrations/` no projeto Supabase.
3. `npm run dev` e abrir `http://localhost:3001`.
4. Conferir `GET /api/ping` com `database` diferente de `not_configured`.

O servidor de teste desta auditoria foi encerrado.
