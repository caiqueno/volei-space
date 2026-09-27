---
title: >-
  volei.space — início
category: area
tags: [produto, navegacao]
sources: [repo:athrios/volei-space]
summary: >-
  Porta de entrada do vault: mapa do produto, estados e ponte LLM-WIKI.
status: implementado
created: 2026-09-20
updated: 2026-09-25
---
	
# volei.space — início

> [!important] Fonte do produto
> **volei.space é a plataforma SaaS**, não uma liga. Cada organizador cria e opera seus próprios campeonatos. Este vault documenta o produto, enquanto `athrios/volei-space` contém o código.

## Mentalidade LLM Wiki (Karpathy)

Padrão: [gist Karpathy](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) · [[references/LLM-WIKI-KARPATHY]] · [[synthesis/LLM-WIKI-NO-VOLEI-SPACE]].

Este cofre é conhecimento **compilado** (não RAG descartável a cada pergunta):

| Camada | Conteúdo |
| --- | --- |
| Fontes brutas | `docs/requisitos/`, código, `raw/` |
| Wiki | notas deste vault |
| Schema | [[AGENTS]] |

Catálogo: [[index]] · Sessão: [[hot]] · Log: [[log]] · Inbox: `_raw/` · Fonte do padrão: [[raw/LLM-WIKI-KARPATHY]]

## Como ler

- **Implementado**: comportamento confirmado em rotas, modelos ou migrations, ainda sujeito a validação no ambiente em uso.
- **Aprovado, pendente**: regra definida pelo dono do produto; não presuma que já funciona.
- **Histórico**: decisão ou fluxo antigo, sem força normativa para o produto atual.

Quando código e requisito divergirem, registre a divergência; não apresente o requisito como funcionalidade pronta nem restaure uma regra antiga por engano.

## Mapa

| Assunto | Nota |
| --- | --- |
| Visão, usuários e vocabulário | [[01-PRODUTO]] |
| Código e serviços | [[02-ARQUITETURA]] |
| Regras aprovadas | [[03-REGRAS-DE-NEGOCIO]] |
| Jornadas ponta a ponta | [[04-FLUXOS]] |
| Inventário funcional | [[05-MODULOS]] |
| Entidades e relações | [[06-BANCO-DE-DADOS]] |
| Acesso e dados pessoais | [[07-SEGURANCA]] |
| Serviços externos | [[08-INTEGRACOES]] |
| Interface | [[09-UI-UX]] |
| Sequência de trabalho | [[10-ROADMAP]] |
| Decisões registradas | [[11-DECISOES]] |
| Categorias como competições isoladas — requisito aprovado, pendente | [[references/CATEGORIAS-COMO-COMPETICOES]] |
| Problemas conhecidos | [[12-BUGS-E-DEBITOS-TECNICOS]] |
| Notas específicas | [[modulos/PARAMETRIZACAO]], [[modulos/INSCRICOES]], [[modulos/SUMULA-DIGITAL]] e [[05-MODULOS]] |
| Origem LUVA | [[historico/LEGADO-LUVA]] |

**Fontes primárias:** [repositório da aplicação](https://github.com/athrios/volei-space), [[references/CATEGORIAS-COMO-COMPETICOES|requisito de categorias]], [[references/INSCRICOES-POR-EQUIPE|requisito de inscrições]] e [[references/SUMULA-DIGITAL-E-CLASSIFICACAO|requisito de súmula]]. Atualizado em 25/09/2026.
