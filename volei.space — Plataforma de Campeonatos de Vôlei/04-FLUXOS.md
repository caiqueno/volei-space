# Fluxos do produto

## Jornada do organizador

Conta e perfil/organização → criação do campeonato → parametrização → estrutura e inscrições → equipes e atletas → calendário e confrontos → operação das partidas → classificação, rankings e área pública. As seções de parametrização têm dependências e validações; ver [[modulos/PARAMETRIZACAO]].

## Inscrição de equipe — aprovado, pendente

Categoria criada → organizador aponta equipe a convidar → link exclusivo por convite → líder informa dados da equipe e jogadores, salva e retoma → conclui → equipe entra diretamente no campeonato **sem aprovação manual**. Gerar link não deve produzir partidas ou classificação. O código atual ainda deve ser comparado a [[modulos/INSCRICOES]].

## Partida — aprovado, pendente

Pré-jogo e escalação → pontuação por set segundo regras do campeonato → substituições/tempos/scouts → apuração do vencedor → seleção obrigatória do MVP da vencedora → oficialização atômica → recálculo de classificação e exibição pública → janela de correção de 30 minutos pelo link; depois, somente organizador. Ver [[modulos/SUMULA-DIGITAL]].

## Área pública

Rotas de campeonatos, equipes, jogos, classificação, rankings, mata-mata e acompanhamento ao vivo existem no código. Disponibilidade e dados expostos dependem do estado do campeonato. Ver [[05-MODULOS]].
