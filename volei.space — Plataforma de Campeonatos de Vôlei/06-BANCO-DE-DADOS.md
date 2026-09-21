# Modelo de dados

`prisma/schema.prisma` descreve entidades; `supabase/migrations` documenta mudanças SQL e políticas. Confira o estado aplicado ao banco antes de concluir que uma coluna ou policy está ativa.

## Relações centrais

- Organizador → campeonatos (`Liga` no código).
- Campeonato → configuração de categorias, inscrições, partidas e estrutura competitiva.
- Inscrição → equipe (`Equipe`) → atletas (`Jogador`).
- Partida → sets (`SetPartida`), presenças (`SumulaPresenca`), ocorrências/scouts (`OcorrenciaPartida`) e destaques (`DestaquesPartida`).
- Campeonato → entradas da classificação calculada e grupos/chaveamentos.

`categoriasConfig` é configuração do campeonato; não presuma que «categoria» já corresponde a tabela própria. O requisito de convites por categoria exige escopo persistente mesmo antes da criação da equipe. Ver [[modulos/INSCRICOES]].

## Invariantes

Uma equipe, inscrição, partida ou token deve ser verificado no campeonato correto. Resultado alterado exige recálculo de classificação e scouts relacionados. Para a súmula corrigível, preservar histórico e atomicidade da gravação; ver [[07-SEGURANCA]] e [[modulos/SUMULA-DIGITAL]].
