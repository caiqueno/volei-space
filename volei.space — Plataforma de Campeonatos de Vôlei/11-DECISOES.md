---
title: >-
  Decisões
category: area
tags: [decisoes]
sources: [repo:athrios/volei-space]
summary: >-
  Decisões registradas do produto.
status: implementado
created: 2026-09-20
updated: 2026-10-10
---
# Decisões do produto

| Data | Decisão | Consequência |
| --- | --- | --- |
| 2026-09-25 | Lint LLM Wiki: uma página de prontidão; skills fora do vault; links de requisito só em `references/` | [[synthesis/PRONTIDAO-E-APIS]]. App sobe, mas sem `.env` não está pronto para uso |
| 2026-09-25 | Ingerir gist canônico LLM Wiki (Karpathy) como fonte bruta + destilação | [[raw/LLM-WIKI-KARPATHY]], [[references/LLM-WIKI-KARPATHY]], [[synthesis/LLM-WIKI-NO-VOLEI-SPACE]]; schema em [[AGENTS]] |
| 2026-09 | volei.space é SaaS para múltiplos organizadores, não a liga LUVA | Linguagem e documentação centradas no produto |
| 2026-09-20 | Cérebro novo em Markdown com índice, áreas permanentes, módulos e histórico | Obsidian separado da operação da antiga liga |
| 2026-09-21 | Convite por categoria e equipe precede o cadastro da equipe | Não exigir `Equipe` preexistente ou aprovada |
| 2026-09-21 | Equipe entra diretamente pelo link após conclusão | Sem etapa manual de aprovação da LUVA |
| 2026-09-21 | Cada categoria da `Liga` é uma competição interna independente, com entidade própria `CategoriaCampeonato` | Modelo-alvo usa `categoriaCampeonatoId`; isolamento operacional e migração ainda pendentes. Ver [[references/CATEGORIAS-COMO-COMPETICOES]] |
| 2026-09-21 | volei.space não utiliza séries; Ouro/Prata pertencem à LUVA | Valores legados podem ser preservados na migração, sem aparecer ou reger novos fluxos |
| 2026-09 | Sets, último set e terceiro obrigatório são configuráveis | Súmula e servidor dependem da parametrização |
| 2026-09 | Classificação por margem de 1 ou 2+ sets, pontos do vencedor e perdedor | 2×0 e 3×0 usam a mesma faixa |
| 2026-09 | 8 substituições por equipe/set; líbero informativo | Par fica vinculado apenas no set |
| 2026-10-10 | Depois que o titular volta, o par fecha no set | #5 e #9 não se substituem de novo naquele set. O modal lista só reservas elegíveis. Líbero não conta. Sem substituição excepcional |
| 2026-09 | MVP obrigatório da vencedora; correção por link por 30 minutos | Destaque público e atualização dos dados derivados |
| 2026-09-27 | Organizador recebe usuário e senha do administrador; criar conta é só do público | Organizador gerencia o evento. Público acompanha portal, jogos e tabela, sem painel de gestão |
| 2026-09-27 | Administrador reseta a senha do organizador; a senha recebida é substituída na entrada seguinte | `/admin/acessos` define a senha temporária. `/trocar-senha` bloqueia o painel até a troca |

**Fonte normativa detalhada:** [[references/CATEGORIAS-COMO-COMPETICOES|categorias]], [[references/INSCRICOES-POR-EQUIPE|inscrições]] e [[references/SUMULA-DIGITAL-E-CLASSIFICACAO|súmula]]. Decisões antigas da LUVA são [[historico/LEGADO-LUVA|histórico]], não substituem esta tabela.
