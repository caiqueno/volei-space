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
updated: 2026-10-10
---
# Divergências e débitos conhecidos

**Esta nota não é uma lista de falhas confirmadas no deploy.** São divergências observadas no código ou pendências que exigem nova verificação após cada merge.

| Área | Verificação necessária |
| --- | --- |
| Categorias | Schema e fluxos atuais usam `categoriasConfig`/strings em vez da entidade-alvo `CategoriaCampeonato` e de `categoriaCampeonatoId`. Isso pode misturar competições em estrutura, partidas, classificação e consultas. Planejar migração e validar isolamento antes de declarar o requisito concluído. Ver [[references/CATEGORIAS-COMO-COMPETICOES]]. |
| PR #1 e categorias | Revisar antes do merge: convite e inscrição podem depender do nome textual da categoria. O vínculo aprovado é `ligaId` + `categoriaCampeonatoId` no servidor, sem troca pelo líder. O PR não foi alterado por esta documentação. Ver [[modulos/INSCRICOES]]. |
| Inscrições | PR #1, na revisão inicial, exigia equipe já aprovada; o requisito atual cria equipe pelo link e elimina aprovação. Ver [[modulos/INSCRICOES]]. |
| Súmula | Em 10/10/2026 a tela e o andamento passaram a exigir o terceiro set quando a categoria marca isso. A API já recusava o placar incompleto. A gravação transacional está em `20261010137000`, ainda não aplicada. No mesmo dia o placar ao vivo deixou de gravar: ocorrência com `id` explícito atrasava a sequence e `gravar_sumula_partida` respondia 23505. O código omite o `id` e enfileira o salvamento, sem migration. Ainda nesse dia, corrigir o último ponto na partida 1095 voltava ao 2x0 porque um `PUT` atrasado regravava o corpo antigo. A versão fica no registro e a reserva antiga responde 409. Na partida 1035, corrigir um ponto do set 2 copiou o 23×13 do set 1 porque o histórico não zerava na troca. A correção fica restrita ao set em andamento. Na partida 1036 a anotação de MVP não gravou o destaque: a camisa 10 da súmula não era a do cadastro, e a partida ficou `EM_ANDAMENTO` com os sets fechados. A escolha agora grava o mesmo MVP da oficialização. O seletor de líbero listava o número do cadastro enquanto o banco mostrava a camisa da súmula. A camisa repetida deixa de bloquear: quem tinha o número fica sem camisa nesta partida e o editado recebe o número. A papeleta abre vazia. Ver [[modulos/SUMULA-DIGITAL]]. |
| Substituições | Limite encontrado de 6 e vínculo de pares mantido em estado de tela; requisito é 8 por equipe/set e restauração após reload. |
| Classificação | Em 09/10/2026 o servidor passou a calcular a faixa de margem em `src/lib/classificacao.ts` e deixou de confiar na RPC. A função SQL antiga continua com 4/3/1/0 e não foi recriada. Em 10/10/2026 a gravação das linhas calculadas ganhou `gravar_classificacao_calculada`, com a mesma trava da súmula, na migration ainda não aplicada. Inscrever uma equipe nova não zera mais a tabela desde 25/09/2026. |
| Abertura de páginas | O painel do organizador e o portal percorriam cada equipe antes de responder, e o login consultava as contas uma a uma. Em 27/09/2026 a leitura só sincroniza equipe que ainda não existe, e o login consulta as contas ao mesmo tempo. |
| Correções | Súmula encerrada era bloqueada integralmente, divergindo da janela aprovada de 30 minutos. |
| Pagamentos | Rota de ativação simulada, apesar da existência de código InfinitePay. Em 25/09/2026 o fluxo local percorreu cadastro, parametrização, Pix simulado e inscrição até a equipe aprovada. A cotação do Pix responde 200 mesmo com o campeonato ainda vazio: a validação aponta contradição, não seção em branco. Em 09/10/2026 o webhook passou a exigir pagamento vinculado e valor compatível. Nenhuma rota grava `Pagamento`, então ele não ativa candidatura enquanto essa linha não existir. A confirmação manual do organizador continua desligada sem `ALLOW_SIMULATED_PAYMENT_CONFIRMATION`. |
| Banco | O schema Prisma estava atrás das colunas que a parametrização grava (`quantidadeGrupos`, `pagamentoConfirmadoEm`, `ClassificacaoEntrada.ligaId`, líder/técnico da equipe). Sem elas o campeonato quebrava no meio. Migrations aditivas foram aplicadas no projeto Supabase já existente. Em 27/09/2026 o cadastro «quero me cadastrar» falhava porque `Interessado.id` era obrigatório no Postgres e o `@default(uuid())` do Prisma não cria default no banco. A API passa a enviar o id, e a migration `202609270006_ids-sem-default.sql` completa o default das colunas `id` de texto ou uuid que ainda estavam sem ele. Em 09/10/2026 o Prisma passou a espelhar a unicidade `(ligaId, equipeId)` da classificação, os índices de chave estrangeira e as colunas que as migrations já tinham criado. A aplicação no banco continua só pelas migrations novas; nada foi executado no Postgres a partir desta revisão. |
| Documentação da raiz | `README.md` e `BACKLOG-DESENVOLVIMENTO.md` ainda contêm fases LUVA; `SKILL.md` já aponta para requisitos novos. |
| Segurança | Migrations de RLS devem ser comparadas ao banco efetivo; não deduzir proteção somente pelo SQL versionado. Em 09/10/2026 o código passou a separar sessão e reset, a exigir `ADMIN_EMAIL` em produção/preview e a recusar webhook sem segredo fora do dev local. Ainda falta no banco, porque `20261010137000` não foi aplicada: a transação única da súmula. Também faltam a chave de idempotência do webhook e a coluna ligando `Pagamento` a `CandidaturaArbitro`. O limite de login é por instância. |

Registrar aqui reprodução, impacto e revisão de cada item quando a implementação mudar. O histórico não substitui testes atualizados.
