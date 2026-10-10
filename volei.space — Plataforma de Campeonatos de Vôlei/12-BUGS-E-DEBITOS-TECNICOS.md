---
title: >-
  Bugs e débitos
category: area
tags: [debitos]
sources: [repo:athrios/volei-space]
summary: >-
  Problemas conhecidos e débitos.
status: implementado
created: 2026-09-20
updated: 2026-10-09
---
# Divergências e débitos conhecidos

**Esta nota não é uma lista de falhas confirmadas no deploy.** São divergências observadas no código ou pendências que exigem nova verificação após cada merge.

| Área | Verificação necessária |
| --- | --- |
| Categorias | Schema e fluxos atuais usam `categoriasConfig`/strings em vez da entidade-alvo `CategoriaCampeonato` e de `categoriaCampeonatoId`. Isso pode misturar competições em estrutura, partidas, classificação e consultas. Planejar migração e validar isolamento antes de declarar o requisito concluído. Ver [[references/CATEGORIAS-COMO-COMPETICOES]]. |
| PR #1 e categorias | Revisar antes do merge: convite e inscrição podem depender do nome textual da categoria. O vínculo aprovado é `ligaId` + `categoriaCampeonatoId` no servidor, sem troca pelo líder. O PR não foi alterado por esta documentação. Ver [[modulos/INSCRICOES]]. |
| Inscrições | PR #1, na revisão inicial, exigia equipe já aprovada; o requisito atual cria equipe pelo link e elimina aprovação. Ver [[modulos/INSCRICOES]]. |
| Súmula | API aceitava encerramento com set insuficiente; UI encerrava melhor de 3 no 2×0 sem considerar terceiro obrigatório; MVP podia faltar. Ver [[modulos/SUMULA-DIGITAL]]. |
| Substituições | Limite encontrado de 6 e vínculo de pares mantido em estado de tela; requisito é 8 por equipe/set e restauração após reload. |
| Classificação | Regras configuradas por placar exato podem não aplicar a mesma faixa a 2×0 e 3×0. Inscrever uma equipe nova zerava a tabela inteira, porque o cadastro regravava todas as linhas com zero ponto. Isso foi corrigido em 25/09/2026: a linha nova entra sem apagar o que já foi jogado. Em 27/09/2026 a página deixou de recalcular cada campeonato ao abrir: isso segurava a tela por vários segundos. |
| Abertura de páginas | O painel do organizador e o portal percorriam cada equipe antes de responder, e o login consultava as contas uma a uma. Em 27/09/2026 a leitura só sincroniza equipe que ainda não existe, e o login consulta as contas ao mesmo tempo. |
| Correções | Súmula encerrada era bloqueada integralmente, divergindo da janela aprovada de 30 minutos. |
| Pagamentos | Rota de ativação simulada, apesar da existência de código InfinitePay. Em 25/09/2026 o fluxo local percorreu cadastro, parametrização, Pix simulado e inscrição até a equipe aprovada. A cotação do Pix responde 200 mesmo com o campeonato ainda vazio: a validação aponta contradição, não seção em branco. Em 09/10/2026 o webhook passou a exigir pagamento vinculado e valor compatível. Nenhuma rota grava `Pagamento`, então ele não ativa candidatura enquanto essa linha não existir. A confirmação manual do organizador continua desligada sem `ALLOW_SIMULATED_PAYMENT_CONFIRMATION`. |
| Banco | O schema Prisma estava atrás das colunas que a parametrização grava (`quantidadeGrupos`, `pagamentoConfirmadoEm`, `ClassificacaoEntrada.ligaId`, líder/técnico da equipe). Sem elas o campeonato quebrava no meio. Migrations aditivas foram aplicadas no projeto Supabase já existente. Em 27/09/2026 o cadastro «quero me cadastrar» falhava porque `Interessado.id` era obrigatório no Postgres e o `@default(uuid())` do Prisma não cria default no banco. A API passa a enviar o id, e a migration `202609270006_ids-sem-default.sql` completa o default das colunas `id` de texto ou uuid que ainda estavam sem ele. Em 09/10/2026 o Prisma passou a espelhar a unicidade `(ligaId, equipeId)` da classificação, os índices de chave estrangeira e as colunas que as migrations já tinham criado. A aplicação no banco continua só pelas migrations novas; nada foi executado no Postgres a partir desta revisão. |
| Documentação da raiz | `README.md` e `BACKLOG-DESENVOLVIMENTO.md` ainda contêm fases LUVA; `SKILL.md` já aponta para requisitos novos. |
| Segurança | Migrations de RLS devem ser comparadas ao banco efetivo; não deduzir proteção somente pelo SQL versionado. Em 09/10/2026 o código passou a separar sessão e reset, a exigir `ADMIN_EMAIL` em produção/preview e a recusar webhook sem segredo fora do dev local. Ainda falta no banco: transação única da súmula, chave de idempotência do webhook e coluna ligando `Pagamento` a `CandidaturaArbitro`. O limite de login é por instância. |

Registrar aqui reprodução, impacto e revisão de cada item quando a implementação mudar. O histórico não substitui testes atualizados.
