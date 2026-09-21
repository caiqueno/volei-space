# Arquitetura atual

**Fonte:** `package.json`, `src/app`, `src/lib`, `prisma/schema.prisma` e `supabase/migrations` em `athrios/volei-space`. Conferir versões no `package.json` antes de uma mudança técnica.

- Aplicação web: Next.js App Router, React, TypeScript e Tailwind.
- Persistência: PostgreSQL no Supabase; schema Prisma, cliente Supabase, cliente administrativo e migrations SQL convivem no repositório.
- Entradas: páginas em `src/app`, Route Handlers em `src/app/api`, lógica de domínio em `src/lib`.
- Autenticação, escopo e autorização: verificar `src/lib/auth.ts`, `src/lib/championship-setup-access.ts`, `src/lib/league-scope.ts` e policies SQL antes de criar endpoint.
- Cálculo derivado: classificação, scouts, estrutura e estado do campeonato dependem de eventos e resultados gravados.

## Regra de manutenção

Não deduza o comportamento atual de `README.md` ou do backlog legados. Leia a implementação, os testes pertinentes e [[11-DECISOES]]. Uma migration presente no git não comprova que tenha sido aplicada ao banco consultado. Alterações de resultado precisam tratar a persistência e o recálculo como uma operação coerente.

Veja [[06-BANCO-DE-DADOS]], [[07-SEGURANCA]] e [[08-INTEGRACOES]].
