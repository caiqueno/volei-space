# Decisões do produto

| Data | Decisão | Consequência |
| --- | --- | --- |
| 2026-09 | volei.space é SaaS para múltiplos organizadores, não a liga LUVA | Linguagem e documentação centradas no produto |
| 2026-09-20 | Cérebro novo em Markdown com índice, áreas permanentes, módulos e histórico | Obsidian separado da operação da antiga liga |
| 2026-09-21 | Convite por categoria e equipe precede o cadastro da equipe | Não exigir `Equipe` preexistente ou aprovada |
| 2026-09-21 | Equipe entra diretamente pelo link após conclusão | Sem etapa manual de aprovação da LUVA |
| 2026-09-21 | Cada categoria da `Liga` é uma competição interna independente, com entidade própria `CategoriaCampeonato` | Modelo-alvo usa `categoriaCampeonatoId`; isolamento operacional e migração ainda pendentes. Ver [[docs/requisitos/CATEGORIAS-COMO-COMPETICOES]] |
| 2026-09-21 | volei.space não utiliza séries; Ouro/Prata pertencem à LUVA | Valores legados podem ser preservados na migração, sem aparecer ou reger novos fluxos |
| 2026-09 | Sets, último set e terceiro obrigatório são configuráveis | Súmula e servidor dependem da parametrização |
| 2026-09 | Classificação por margem de 1 ou 2+ sets, pontos do vencedor e perdedor | 2×0 e 3×0 usam a mesma faixa |
| 2026-09 | 8 substituições por equipe/set; líbero informativo | Par fica vinculado apenas no set |
| 2026-09 | MVP obrigatório da vencedora; correção por link por 30 minutos | Destaque público e atualização dos dados derivados |

**Fonte normativa detalhada:** [[docs/requisitos/CATEGORIAS-COMO-COMPETICOES|categorias]], [[docs/requisitos/INSCRICOES-POR-EQUIPE|inscrições]] e [[docs/requisitos/SUMULA-DIGITAL-E-CLASSIFICACAO|súmula]]. Decisões antigas da LUVA são [[historico/LEGADO-LUVA|histórico]], não substituem esta tabela.
