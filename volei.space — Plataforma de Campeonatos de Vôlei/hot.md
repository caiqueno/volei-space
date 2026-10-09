---
title: >-
  Hot cache da sessão
category: area
tags: [hot, llm-wiki]
sources: [repo:athrios/volei-space]
summary: >-
  Sessão admin, reset, webhook e súmula ficaram mais fechados. Transação e idempotência ainda pedem banco.
status: implementado
created: 2026-09-25
updated: 2026-10-09
---

# Hot

## Foco atual

Correção de segurança no back-end, sem UI nem migration. O JWT de administrador agora tem `scope: admin`; token com `purpose` (reset, ativação) não abre sessão. O reset guarda fingerprint da senha, não o hash bcrypt. `ADMIN_EMAIL` passou a ser obrigatório em produção e no preview. Login e esqueci-senha usam a mesma frase de falha e um limite em memória por instância. O corpo do login admin não devolve mais o JWT. `ILIKE` de e-mail escapa `%` e `_`. O webhook InfinitePay recusa chamada sem segredo fora do dev local, confere valor e vínculo com `Pagamento` e não transforma erro de banco em 200. A súmula tenta restaurar o conteúdo se a gravação quebra no meio; a transação única continua pendente no banco. `?consulta=1` segue público de propósito. Tokens demo da súmula não respondem em produção. Fonte: [[07-SEGURANCA]], [[modulos/PAGAMENTOS]], [[modulos/SUMULA-DIGITAL]].

## Key Takeaways

- A triagem de 4 de outubro de 2026 está na `main`. O portal por campeonato, a galeria e o botão Finalizar só em campeonato ativo entram na `main` em 5 de outubro.
- Em 5 de outubro a produção ganhou a função `selecionar_categorias_campeonato`, as políticas de upload e a coluna `Midia.thumbUrl`.
- A parametrização por categoria ativa e a comparação da replicação entram na `main` junto com o portal e a galeria.
- Produção, no commit `6f9c8f6`, responde `GET /api/ping` com alvo `producao`.
- Cada vaga parametrizada tem um link em `ConviteVagaEquipe`. O painel de jogos lê o `ligaId` da URL.
- O ao vivo do operador abre no painel (`/painel?secao=aovivo`). A súmula pública é só o registro; o lançamento fica em `/sumula/{token}/lancar`.

## Abrir primeiro

1. [[synthesis/PRONTIDAO-E-APIS]]
2. [[00-INICIO]]
3. [[modulos/INSCRICOES]] se a tarefa for inscrição
