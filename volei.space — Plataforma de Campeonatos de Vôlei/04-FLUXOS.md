# Fluxos do produto

## Jornada do organizador

Conta e perfil/organização → criação do campeonato → parametrização → estrutura e inscrições → equipes e atletas → calendário e confrontos → operação das partidas → classificação, rankings e área pública. As seções de parametrização têm dependências e validações; ver [[modulos/PARAMETRIZACAO]].

**Aprovado, pendente:** na primeira etapa, o organizador informa a quantidade de categorias e nomeia cada competição interna. As categorias persistidas serão a fonte de verdade; os fluxos seguintes operam dentro da categoria selecionada. Ver [[docs/requisitos/CATEGORIAS-COMO-COMPETICOES]].

## Inscrição de equipe — aprovado, pendente

Categoria criada → organizador aponta equipe a convidar → link exclusivo por convite vinculado no servidor a `ligaId` + `categoriaCampeonatoId` → líder informa dados da equipe e jogadores, salva e retoma → conclui → equipe entra diretamente naquela categoria **sem aprovação manual**. O líder não troca a categoria do convite. Gerar link não deve produzir partidas ou classificação. O código atual ainda deve ser comparado a [[modulos/INSCRICOES]] e [[docs/requisitos/CATEGORIAS-COMO-COMPETICOES]].

## Partida — aprovado, pendente

Pré-jogo e escalação → pontuação por set segundo regras do campeonato → substituições/tempos/scouts → apuração do vencedor → seleção obrigatória do MVP da vencedora → oficialização atômica → recálculo de classificação e exibição pública → janela de correção de 30 minutos pelo link; depois, somente organizador. Ver [[modulos/SUMULA-DIGITAL]].

## Área pública

Rotas de campeonatos, equipes, jogos, classificação, rankings, mata-mata e acompanhamento ao vivo existem no código. Disponibilidade e dados expostos dependem do estado do campeonato. Ver [[05-MODULOS]].

**Aprovado, pendente:** permitir selecionar a categoria nas consultas públicas e limitar seus dados competitivos à categoria escolhida. O modelo atual baseado em strings pode misturá-las; ver [[docs/requisitos/CATEGORIAS-COMO-COMPETICOES]].
