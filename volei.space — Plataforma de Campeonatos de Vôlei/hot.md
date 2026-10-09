---
title: >-
  Hot cache da sessão
category: area
tags: [hot, llm-wiki]
sources: [repo:athrios/volei-space]
summary: >-
  Sessão, webhook e leitura de atleta passam a falhar fechado. O link da inscrição deixa de valer ao concluir.
status: implementado
created: 2026-09-25
updated: 2026-10-09
---

# Hot

## Foco atual

Endurecimento de autenticação em 9 de outubro de 2026. O JWT de recuperação não carrega mais a `senhaHash`. Admin, sessão pública, recuperação e ativação têm audiência e tipo próprios. Sem `ADMIN_EMAIL` não há sessão de administrador. Login e recuperação de senha limitam tentativas e não devolvem o token nem a mensagem interna. O logout limpa `luva_token` com os mesmos atributos do cookie. O webhook InfinitePay exige segredo, assinatura do mesmo tamanho, processamento único e `external_id` compatível com o `Pagamento`. A massa de QA exige sessão de administrador. Quadras do organizador ficam restritas aos campeonatos dele. Súmula e árbitro não leem CPF, documento, telefone nem QR do atleta. O GET da inscrição rápida mascara CPF e nascimento, e concluir a inscrição troca o token. Partida nova ou editada só aceita equipes da própria liga, e o PUT grava uma lista fechada de campos. Rotas de liga não devolvem `err.message`. Fonte: [[07-SEGURANCA]].

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
