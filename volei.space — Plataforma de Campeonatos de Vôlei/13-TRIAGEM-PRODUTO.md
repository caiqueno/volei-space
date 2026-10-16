---
title: >-
  Triagem do produto
category: area
tags: [produto, roadmap, debitos]
sources: [repo:athrios/volei-space]
summary: >-
  O que corrigir, o que atualizar e o que tirar do fluxo do volei.space em 4 de outubro de 2026.
status: implementado
created: 2026-10-04
updated: 2026-10-10
---

# Triagem do produto

Leitura do código e das notas em 4 de outubro de 2026, depois do acesso de organizador, do painel Ao vivo e da separação de banco. A `main` está no commit `6f9c8f6`.

O produto que vale manter é o organizador operando o próprio campeonato, com súmula, classificação e portal público. Súmula, classificação, mata-mata, isolamento do organizador e o painel Ao vivo ficam.

O roadmap ainda marca súmula e categorias como pendentes. A súmula já pede a origem do ponto, e `CategoriaCampeonato` já existe. O débito real é outro: três portas de cadastro e a série Ouro/Prata ainda no caminho do organizador.

## Corrigir

Falhas ou promessas quebradas no que já está publicado.

| Item | O que acontece hoje | Correção |
| --- | --- | --- |
| Três cadastros de organizador | Seja membro grava `CandidaturaOrganizador`. A home grava `Interessado`. `/cadastro` ainda pede um formulário longo. | Uma porta só: nome, e-mail e telefone, visível para o administrador. |
| Senha temporária | A senha aparece uma vez na tela do administrador. Se a tela fecha, o organizador fica sem acesso. | Reenviar acesso, com nova senha e troca obrigatória no primeiro login. |
| Leitura aberta de elenco | Criar, editar e excluir equipe, jogador e partida já exige o dono. Listar equipe e jogador ainda devolve o conjunto inteiro. | A consulta do painel devolve só o campeonato daquele organizador. |
| Ativação de campeonato | Sem `PAGAMENTO_HABILITADO`, o pagamento simulado permanece. `false` na Vercel tira o botão e segue para os grupos. O código da InfinitePay permanece. | Definir `false` para não cobrar, ou `true` só quando o checkout real estiver pronto. |
| Súmula incompleta | Substituição fica em 6 e some ao recarregar; o requisito é 8 por equipe e set. Encerrar ainda não obriga o MVP. | Gravar substituição e exigir MVP antes de oficializar. |
| Massa no portal | A nota do banco registra a massa `TOURNAMENT-SEED-2026` nos dois projetos. O Ao vivo lista toda partida `EM_ANDAMENTO`. | Conferir a produção e tirar campeonato de teste do placar público. |

## Bom update

O próximo incremento, depois das correções. Não abre frente nova.

### Convite da equipe

O organizador gera o link da categoria. O líder cadastra a equipe e entra direto, sem aprovação. Inscrição rápida, candidatura e o link do campeonato deixam de competir.

### Categoria isolada

Masculino e feminino do mesmo campeonato não compartilham tabela, jogos nem elenco. O id da categoria já existe; falta usá-lo em toda consulta no lugar do texto e da série.

### Ao vivo no ritmo da súmula

O painel hoje relê a cada 8 segundos. O ponto lançado na súmula deve aparecer no portal sem espera, filtrado por campeonato, sem partida de teste no meio.

## Descartar

Sair do fluxo. O histórico pode ficar no repositório, sem tela nem regra nova.

| Peça | Por que sai |
| --- | --- |
| `/cadastro` longo do organizador | Repete Seja membro e ainda pede senha e código de acesso. |
| Formulário Interessado da home | Grava outra tabela, com cidade e WhatsApp, e não libera o organizador. |
| `/ficha` | Só redireciona para o cadastro antigo. |
| Série Ouro e Prata | Divisão da LUVA. O volei.space separa por categoria do campeonato. |
| Aprovação manual de equipe | Regra antiga. No fluxo atual o líder entra pelo link e a equipe já nasce cadastrada. |

Fonte: código em `teste-integrado` e `main` `6f9c8f6`, notas [[07-SEGURANCA]], [[06-BANCO-DE-DADOS]], [[10-ROADMAP]], [[12-BUGS-E-DEBITOS-TECNICOS]], [[modulos/INSCRICOES]] e [[modulos/SUMULA-DIGITAL]].

## Aplicado em 4 de outubro de 2026

A triagem entrou na `main` em 4 de outubro de 2026.

- Organizador novo passa por `/seja-membro`. A home deixa de gravar `Interessado`. `/cadastro` sem perfil de equipe, árbitro ou quadra e `/ficha` abrem Seja membro.
- O administrador pode reenviar o acesso de um organizador já liberado. A senha nova aparece uma vez e o próximo login exige troca.
- Com sessão de organizador, listar equipe ou jogador devolve só os campeonatos dele.
- A tela de ativação não mostra Pix pago. O botão libera a configuração sem registrar cobrança.
- A súmula aceita 8 substituições por equipe e set, recupera a contagem e o par ao recarregar, e só oficializa com MVP da equipe vencedora.
- Ao vivo, jogos e portal público ignoram campeonato de teste. O placar público relê a cada 2 segundos.
- O organizador gera um link por categoria. A equipe entra direto, com status `APROVADA`. `/inscricao-rapida` sem token de rascunho não abre mais outro formulário.
- Partida nova grava `categoriaCampeonatoId`. Série Ouro/Prata saiu do cadastro de equipe e de partida no admin.

O convite exclusivo de uma equipe apontada, antes de existir `Equipe`, continua a regra de `docs/requisitos/INSCRICOES-POR-EQUIPE.md` e ainda não substitui o link da categoria. Consultas antigas que já filtram por `categoriaCampeonatoId` permanecem; o texto da categoria ainda existe no banco.
