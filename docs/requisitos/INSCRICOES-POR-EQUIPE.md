# Requisito aprovado: inscrição por categoria e link por equipe

**Estado:** decisão de produto aprovada; implementação pendente. Este documento descreve o comportamento desejado e não afirma que o código atual já o cumpre.

## Contexto

volei.space é a plataforma SaaS. Cada organizador cria campeonatos e define suas categorias. O fluxo antigo de inscrição rápida por link não é a experiência final desejada. A implementação existente de rascunhos, tokens e finalização pode ser reaproveitada após análise.

## Regras

1. Em cada categoria de um campeonato, o organizador pode apontar equipes. O apontamento é opcional: uma categoria pode ficar sem equipes apontadas.
2. Para cada equipe apontada, o organizador gera um link exclusivo do vínculo **campeonato + categoria + equipe** e o envia ao líder responsável pelo elenco.
3. O líder usa o link para cadastrar, revisar e salvar os jogadores daquela equipe. Dados salvos persistem após atualização ou fechamento da página.
4. O mesmo link permite retomar e editar o cadastro quando o estado da inscrição e a configuração do campeonato permitirem. Enviar ou concluir uma etapa não pode invalidar automaticamente um acesso que ainda deva permitir edição.
5. O token deve autorizar no servidor somente a equipe, a categoria e o campeonato correspondentes. Um slug público não autoriza edição de elenco.
6. Gerar novamente o acesso, salvar repetidamente ou repetir a finalização não pode duplicar equipes, inscrições ou jogadores.
7. O organizador acompanha as equipes apontadas, os links gerados e o andamento dos elencos dentro de cada categoria.
8. Revogação e prazo de validade de links ainda não foram definidos como regras de produto. Não os inclua por pressuposição.

## Fluxo esperado

Organizador cria categoria → aponta equipe, se houver → gera o link daquela equipe → envia ao líder → líder salva jogadores em etapas → pode retornar pelo mesmo link → conclui a inscrição → organizador acompanha a equipe na categoria correta.

## Verificação de aceitação

- Uma categoria sem equipe apontada pode ser salva.
- Duas equipes da mesma categoria recebem links independentes; equipes em categorias diferentes também ficam isoladas.
- Após cadastrar parte do elenco e recarregar, o líder vê os dados persistidos.
- Acesso a um link não permite ler, editar nem concluir inscrição de outra equipe.
- Salvamento, geração de link e finalização repetidos não criam duplicatas.
- A edição após envio segue a configuração real do campeonato.
- A interface do organizador mostra o estado do cadastro por equipe e categoria.

## Fontes para implementação

Inspecionar as rotas e páginas `inscricao-rapida`, `src/lib/team-registration-draft.ts`, `src/lib/championship-registration-sync.ts`, os modelos `Equipe`, `InscricaoCampeonato`, `InscricaoEquipeRascunho` e `InscricaoEquipeJogadorRascunho`, além das migrations relevantes. O sistema está em validação: migrações de dados anteriores são aceitáveis, mas devem ser explícitas e verificadas.
