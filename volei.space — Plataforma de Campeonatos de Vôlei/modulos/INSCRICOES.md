---
title: >-
  Inscrições
category: modulo
tags: [inscricoes]
sources: [repo:athrios/volei-space/docs/requisitos/INSCRICOES-POR-EQUIPE.md]
summary: >-
  O mesmo atleta não entra em duas equipes da categoria. A conferência usa documento ou nome e nascimento. Sem migration.
status: misto
created: 2026-09-20
updated: 2026-10-10
---
# Inscrições por equipe

**Conferência de 10 de outubro de 2026, atleta único:** salvar o atleta e concluir a inscrição recusam a mesma pessoa em outra equipe da categoria. Com `documentoNumero`, a comparação ignora pontuação e caixa. Sem documento, entram nome e data de nascimento, os dois preenchidos. Acento e espaços não separam o nome. A equipe que já tem o atleta pode editá-lo. O aviso cita o nome da outra equipe. Rascunho ainda sem equipe também entra na conferência. Se a leitura falhar, a inscrição segue. Não houve migration.

**Conferência de 10 de outubro de 2026, gênero e idade:** a aba Inscrições mostra gênero e faixa etária só quando `CategoriaConfiguracao` já devolve a coluna `genero`. Masculino, feminino, misto ou vazio. A idade mínima e a máxima ficam em branco para não restringir. O formulário público pede o sexo, como opcional, só quando o gênero da categoria está preenchido. A categoria masculina ou feminina recusa o sexo informado diferente. Misto aceita os dois. Sem sexo, a inscrição passa. A idade só é conferida quando o atleta tem data de nascimento e a categoria tem mínimo ou máximo. Nascimento ilegível não bloqueia. Gênero e idade não vão para `Liga` nem para `salvar_configuracao_categoria`. Se a coluna não existir, a leitura fica desligada por dez minutos e o restante do salvamento continua. `20261010139700_elegibilidade_categoria.sql` não foi aplicada. O prefixo fica depois de `20261010139500` e antes de `20261010140000`.

**Conferência de 10 de outubro de 2026, parametrização do formulário:** `/inscricao-rapida/{token}`, o link da vaga e o link da categoria leem `CategoriaConfiguracao.formularioInscricaoConfig` da categoria do rascunho. O JSON da liga só entra quando a categoria não gravou o formulário. Campeonato com uma categoria também copia esse JSON para `Liga` ao salvar a aba Inscrições. Data de nascimento e documento do atleta seguem os três estados: `disabled` esconde o campo e não grava; `optional` mostra «(opcional)» e aceita vazio; `required` exige o valor ao salvar o atleta e ao concluir. Sem a chave, os dois continuam opcionais. A foto segue opcional na inscrição, mesmo se o JSON disser `required`, e some só em `disabled`. O capitão permanece com nascimento e documento opcionais. `20261010138500_formulario_inscricao_categoria.sql` faz a função de conclusão usar a categoria e recusar o vazio só quando o campo está `required`. Não foi aplicada. O prefixo fica depois de `20261010138000` e antes de `20261010139000`. Enquanto a função instalada for a anterior a `20261010135000`, concluir ainda pode responder «Data de nascimento e obrigatoria.» ou «Documento do jogador e obrigatorio.».

**Conferência de 10 de outubro de 2026, foto do atleta:** a foto é opcional no link da vaga, no rascunho, na inscrição rápida e no painel do capitão. O rótulo é «Foto (opcional)». Salvar e concluir seguem sem imagem. Se a imagem for enviada, `fotoUrl` e `fotoRostoUrl` continuam gravados. O campo some só quando a configuração está `disabled`. O padrão do wizard e o QR ainda podem gravar `atleta.foto = required`; a inscrição ignora essa exigência. `20261010130000_foto_atleta_opcional.sql` recria `finalizar_inscricao_equipe_rascunho` e `validar_jogador_formulario_categoria` sem recusar foto ausente e ainda não foi aplicada. Até lá, o SQL já instalado pode responder «Foto do jogador e obrigatoria.» na conclusão.

**Conferência de 10 de outubro de 2026:** `POST /api/inscricoes-campeonato` grava `APROVADA` só quando `Liga.inscricaoAprovacaoAutomatica` é verdadeiro. Caso contrário a inscrição fica `SOLICITADA`, e a vaga só é contada na aprovação. Uma linha que já está `APROVADA` não é rebaixada. O JavaScript do rascunho não força mais `APROVADA` por cima do retorno da função. A função instalada em `202610060002` ainda grava `APROVADA` sempre. `202610100002_fechar_leitura_publica_placar.sql` devolve o `case` da flag e ainda não foi aplicada: até lá, concluir pelo link continua nascendo `APROVADA` no banco.

**Conferência de 6 de outubro de 2026, pelo formulário:** salvar o atleta sem foto mostra «Foto do jogador é obrigatória.» quando o formulário exige a foto. Recarregar a página mostra os atletas já gravados. O líder obrigatório vazio não é gravado por cima de um nome já salvo. Concluir uma inscrição que já tem `categoriaCampeonatoId` não pede a série histórica. A função grava a equipe na categoria, com série nula. A logo opcional ainda não sobe no desenvolvimento: o bucket `equipe-emblemas` não está criado nesse banco.

**Regra em vigor desde 6 de outubro de 2026:** em Campeonatos, «Links das equipes» abre uma linha por vaga, na quantidade gravada em `CategoriaConfiguracao.quantidadeEquipes` (ou, se ela estiver vazia, em `Liga.quantidadeEquipes`). As colunas são nome, gerar link e link compartilhável. O token fica em `ConviteVagaEquipe` e não muda se o organizador gerar de novo. O endereço é `/inscricao/vaga/{token}`. Abrir o link cria ou recupera o rascunho em `InscricaoEquipeRascunho`, ligado àquela vaga, categoria e campeonato. Atualizar a página relê esse rascunho. O líder não troca a categoria. O link antigo `/inscricao/categoria/{token}` continua abrindo o formulário da categoria.

**Regra de 4 de outubro de 2026:** o organizador gerava um link por categoria. O endereço era `/inscricao/categoria/{token}`. O token ficava em `CategoriaCampeonato.tokenInscricao`. Naquele momento, ao concluir, a inscrição ficava `APROVADA` e a equipe entrava no campeonato. A partir de 10 de outubro o status segue `inscricaoAprovacaoAutomatica` no aplicativo; o SQL do link só acompanha a flag depois de `202610100001`. `/inscricao-rapida` sem rascunho já aberto pede um link. O link `/inscricao/campeonato/{token}` continua abrindo convites já enviados, mas o painel não oferece mais um link único do campeonato.

**Regra anterior:** o organizador gerava um link por campeonato. O endereço era `/inscricao/campeonato/{token}`. O token tem 32 caracteres hexadecimais e não é o id da liga. Um campeonato tem um registro em `LinkInscricaoCampeonato`. Gerar de novo devolve o mesmo token. Regenerar troca o token e o anterior deixa de abrir a página. Desativar mostra inscrições indisponíveis. O período (`inscricoesAberturaEm`, `inscricoesEncerramentoEm`, `inscricoesAbertas` e o status do campeonato) é conferido no servidor. A equipe usa o formulário já existente de inscrição rápida. Nome repetido na mesma liga responde que a equipe já está inscrita. A finalização continua no rascunho atual e não cria uma segunda fila de aprovação. O convite exclusivo por equipe, antes de `Equipe` existir, permanece a regra aprovada e pendente de `docs/requisitos/INSCRICOES-POR-EQUIPE.md`.

**Estado anterior:** requisito aprovado, implementação final pendente. Há rascunhos e tokens em `src/lib/team-registration-draft.ts`, rotas `src/app/api/inscricao-rapida` e migration `supabase/migrations/202609200015_inscricao-equipe-rascunho.sql`. Isso não equivale automaticamente ao fluxo aprovado. Desde 26/09/2026 o rascunho recusava, ao salvar o atleta, número de camisa repetido e ausência de foto, nascimento ou documento quando o formulário do campeonato exigia esses campos. Em 10/10/2026 foto, nascimento e documento deixaram de ser exigidos na inscrição; número de camisa repetido continua recusado.

**Histórico de 27/09/2026:** o painel mostrava `/inscricao-rapida?ligaId={id}`. Esse atalho saiu do fluxo em 4 de outubro de 2026. O rascunho já aberto em `/inscricao-rapida/{token}` continua editável.

## Regra do produto

Organizador cria categoria → aponta opcionalmente equipe a convidar → gera link exclusivo **antes de `Equipe` existir** → líder cadastra dados da equipe e jogadores com salvamento persistente → conclui → equipe e inscrição entram diretamente no campeonato, **sem aprovação manual**. Token é limitado ao campeonato, categoria e convite/equipe. Repetição não duplica registros. Gerar link não cria confronto ou classificação.

**Arquitetura:** `ConviteVagaEquipe` grava `ligaId`, `categoriaCampeonatoId` e a vaga antes de existir `Equipe`. O rascunho fica em `InscricaoEquipeRascunho`. O líder não troca a categoria. Série, Ouro e Prata saíram do cadastro novo de equipe e de partida. Ver [[references/CATEGORIAS-COMO-COMPETICOES]].

**Atenção ao PR #1:** revisão inicial identificou exigência de equipe já aprovada e documento divergente do `main`. Confirme novo estado do PR antes de considerar a correção entregue.

Revisar o PR #1 antes do merge também quanto à possível dependência da categoria como texto: o convite deve guardar `ligaId` + `categoriaCampeonatoId` no servidor. Esta nota não declara essa adaptação concluída nem altera o PR.

[Requisito completo e vigente](https://github.com/athrios/volei-space/blob/main/docs/requisitos/INSCRICOES-POR-EQUIPE.md). Relacionado: [[modulos/EQUIPES-E-ATLETAS]], [[07-SEGURANCA]], [[04-FLUXOS]].
