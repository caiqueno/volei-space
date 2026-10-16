# Decisões da Fase 0 (respondidas em 2026-10-16)

Referência: `PLANO-FASE-0-PARA-APROVACAO.md`. Respostas dadas pelo dono do produto.

| # | Decisão | Resposta | Efeito |
|---|---|---|---|
| D1 | Sessões de admin antigas | Exigir novo login | B1 emite `scope:'admin'` e rejeita token sem scope |
| D2 | `ADMIN_EMAIL` na Vercel | Está definido (produção e preview) | `adminEmailAllowed` passa a falhar fechado sem a variável |
| D3 | Store do rate limit | Tabela no Supabase | B2 precisa de migration (só aplicar com aprovação) |
| D4 | Webhook InfinitePay | Legado: desligar | Rota responde 410 |
| D4b | Pagamento simulado em produção | Manter e marcar como simulado | Coluna `pagamentoOrigem` (migration com aprovação) |
| D5 | Fotos de atletas | Espaço público separado só para foto de rosto | M2: documentos privados, foto de rosto em bucket público próprio |
| D6 | Deploy da `main` | **Publica direto em produção** | Todo merge na `main` conta como deploy e exige aprovação; avaliar travar a promoção para manual |
| D7 | Homologação | Usar o projeto de desenvolvimento | Ensaio de migrations menos fiel; atenção redobrada antes de RLS/storage em produção |
| D8 | Ferramentas locais | Instalar Node 22, Docker, Supabase CLI | Habilita `reset-db` e `setup` (G06 parte 2) |
| D9 | Iframe | Só o próprio site | `frame-ancestors 'self'` |
| D10 | Reescrever histórico | Não | Rotacionar a senha da conta admin basta |
| D11 | Revisor na `main` | PR + testes verdes, sem revisor obrigatório | Proteção de branch sem aprovação obrigatória |
| D12 | Caminho com acento | Funciona | Projeto fica onde está |

Pendências que continuam do dono: conferir e trocar a senha da conta de admin legada nos ambientes (G03 passos 1 a 5) e instalar Docker e Supabase CLI.
