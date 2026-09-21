# Requisito aprovado: inscrição por categoria e link por equipe

**Estado:** decisão de produto aprovada; implementação pendente. Este documento descreve o comportamento desejado e não afirma que o código atual já o cumpre.

## Contexto

volei.space é a plataforma SaaS para diferentes organizadores. A aprovação manual de equipes pertence ao fluxo histórico da LUVA e **não é uma etapa de inscrição no volei.space**. O link rápido genérico não é a experiência final desejada. Rascunhos, tokens e finalização existentes podem ser reaproveitados após análise.

## Regras

1. Em cada categoria criada no campeonato, o organizador pode apontar uma equipe a convidar. O apontamento é opcional: uma categoria pode ficar sem equipe. O apontamento **não exige uma entidade `Equipe` previamente cadastrada ou aprovada**.
2. O organizador gera um link exclusivo para cada equipe apontada, vinculado no servidor ao **campeonato + categoria + convite daquela equipe**, e o envia ao líder. O convite deve existir antes de o líder cadastrar a equipe; não se pode exigir `equipeId` de uma equipe já existente como pré-requisito para criar o link.
3. Pelo link, o líder informa os dados da equipe e cadastra os jogadores. Ao concluir, a equipe e sua inscrição são criadas diretamente no campeonato e na categoria do convite, **sem fila nem ação manual de aprovação**. A inscrição concluída passa ao estado operacional necessário para participar do campeonato.
4. Nome da equipe e jogadores já salvos persistem após atualização ou fechamento da página. O mesmo link permite retomar o cadastro e editar quando a configuração de inscrições do campeonato permitir. Enviar uma etapa não inutiliza automaticamente um link que ainda deva permitir edição.
5. O token autoriza no servidor apenas o convite, a equipe resultante, a categoria e o campeonato correspondentes. O líder não pode alterar a categoria vinculada ao convite nem acessar ou modificar outra equipe. Um slug público não autoriza edição.
6. Gerar novamente o acesso, salvar repetidamente e repetir a finalização não duplicam convite, equipe, inscrição ou jogadores. A criação da equipe e da inscrição na conclusão deve ser atômica.
7. O organizador acompanha, em cada categoria, as equipes apontadas, seus links, o andamento do cadastro e as equipes concluídas. Equipes só devem entrar nos efeitos de operação da competição quando o cadastro estiver concluído; gerar um link não deve disparar calendário, confrontos ou classificação.
8. Revogação e prazo de validade de links não foram definidos como regras de produto. Não os inclua por pressuposição.

## Fluxo esperado

Organizador cria categoria → aponta equipe a convidar, se houver → gera link exclusivo → envia ao líder → líder salva dados da equipe e dos jogadores em etapas → pode retornar pelo mesmo link → conclui cadastro → equipe passa a integrar o campeonato sem aprovação manual → organizador acompanha o resultado na categoria correta.

## Verificação de aceitação

- Uma categoria sem equipes apontadas pode ser salva.
- É possível gerar o link antes de existir registro `Equipe` ou aprovação de qualquer equipe.
- Dois convites na mesma categoria produzem links independentes; convites em categorias diferentes também ficam isolados.
- Após cadastrar parte do elenco e recarregar, o líder encontra dados persistidos.
- O líder não altera a categoria do convite nem lê ou edita dados de outra equipe.
- A conclusão cria a equipe e a inscrição diretamente, sem etapa de aprovação; repetir o envio não cria duplicatas.
- A edição após envio segue a configuração do campeonato e o organizador vê o estado do cadastro por categoria.
- Gerar o link, sem concluir o cadastro, não cria partida ou classificação.

## Fontes para implementação

Inspecionar rotas e páginas `inscricao-rapida`, `src/lib/team-registration-draft.ts`, `src/lib/championship-registration-sync.ts`, modelos `Equipe`, `InscricaoCampeonato`, `InscricaoEquipeRascunho` e `InscricaoEquipeJogadorRascunho`, além das migrations relevantes. O sistema está em validação: migrações de dados anteriores são aceitáveis, mas devem ser explícitas e verificadas. Não transportar o requisito legado de aprovação manual para o fluxo novo.
