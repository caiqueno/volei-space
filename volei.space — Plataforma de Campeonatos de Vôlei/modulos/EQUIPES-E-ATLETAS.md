# Equipes e atletas

**Implementado:** entidades `Equipe` e `Jogador` em `prisma/schema.prisma`; APIs de equipes/jogadores, foto, QR e inscrição em `src/app/api`. Categorias/séries aparecem na equipe e na configuração do campeonato.

**Aprovado, pendente:** a equipe do fluxo novo é criada pelo líder a partir de um convite específico; não precisa existir nem ser aprovada antes de gerar o link. O organizador acompanha elenco e estado por categoria. Dados salvos sobrevivem ao reload e respeitam regras de edição do campeonato.

**Isolamento aprovado, pendente:** a equipe deverá pertencer a uma `CategoriaCampeonato` da `Liga` por `categoriaCampeonatoId` sempre que aplicável. A string `Equipe.categoria` e a série legada não garantem esse isolamento; equipes de categorias diferentes não podem compartilhar grupos, classificação ou confrontos. Ver [[docs/requisitos/CATEGORIAS-COMO-COMPETICOES]].

Atenção a jogadores banidos, números de camisa, presença e fotos exigidas quando o QR estiver habilitado. Não confunda cadastro de atletas com autorização de participação em outra equipe ou campeonato. Ver [[modulos/INSCRICOES]] e [[modulos/SUMULA-DIGITAL]].
