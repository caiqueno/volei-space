# Divergências e débitos conhecidos

**Esta nota não é uma lista de falhas confirmadas no deploy.** São divergências observadas no código ou pendências que exigem nova verificação após cada merge.

| Área | Verificação necessária |
| --- | --- |
| Categorias | Schema e fluxos atuais usam `categoriasConfig`/strings em vez da entidade-alvo `CategoriaCampeonato` e de `categoriaCampeonatoId`. Isso pode misturar competições em estrutura, partidas, classificação e consultas. Planejar migração e validar isolamento antes de declarar o requisito concluído. Ver [[docs/requisitos/CATEGORIAS-COMO-COMPETICOES]]. |
| PR #1 e categorias | Revisar antes do merge: convite e inscrição podem depender do nome textual da categoria. O vínculo aprovado é `ligaId` + `categoriaCampeonatoId` no servidor, sem troca pelo líder. O PR não foi alterado por esta documentação. Ver [[modulos/INSCRICOES]]. |
| Inscrições | PR #1, na revisão inicial, exigia equipe já aprovada; o requisito atual cria equipe pelo link e elimina aprovação. Ver [[modulos/INSCRICOES]]. |
| Súmula | API aceitava encerramento com set insuficiente; UI encerrava melhor de 3 no 2×0 sem considerar terceiro obrigatório; MVP podia faltar. Ver [[modulos/SUMULA-DIGITAL]]. |
| Substituições | Limite encontrado de 6 e vínculo de pares mantido em estado de tela; requisito é 8 por equipe/set e restauração após reload. |
| Classificação | Regras configuradas por placar exato podem não aplicar a mesma faixa a 2×0 e 3×0. |
| Correções | Súmula encerrada era bloqueada integralmente, divergindo da janela aprovada de 30 minutos. |
| Pagamentos | Rota de ativação simulada, apesar da existência de código InfinitePay. |
| Documentação da raiz | `README.md` e `BACKLOG-DESENVOLVIMENTO.md` ainda contêm fases LUVA; `SKILL.md` já aponta para requisitos novos. |
| Segurança | Migrations de RLS devem ser comparadas ao banco efetivo; não deduzir proteção somente pelo SQL versionado. |

Registrar aqui reprodução, impacto e revisão de cada item quando a implementação mudar. O histórico não substitui testes atualizados.
