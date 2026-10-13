# Avaliação funcional da busca de locais

Busca implementada por zona, seção, código do local e trecho do nome/endereço. Filtros combináveis, zeros iniciais aceitos e normalização de acentos na API. O nome de um local com metadados divergentes é pesquisável pelas variantes preservadas, sem escolher uma delas como nome oficial.

## Navegação e leitura

- O formulário aparece antes dos resultados e das explicações metodológicas extensas.
- Campos têm labels, teclado numérico para identificadores, erros marcados e mensagem de validação.
- Formulário GET funciona sem JavaScript e mantém buscas compartilháveis por URL.
- Nova busca, limpeza e troca de turno reiniciam a paginação; links de página preservam todos os filtros.
- Contagem e intervalo de itens ficam visíveis, com paginação antes e depois dos locais.
- Buscas sem correspondência, páginas fora do intervalo e indisponibilidade são estados distintos.
- Seções de cada local podem ser abertas e clicadas; a seção pesquisada fica destacada.
- A interface informa que a busca por seção localiza o local e que os totais exibidos são do local inteiro.
- Layout adaptado em CSS para telas menores, controles com altura mínima de 44 px e texto de entrada a 16 px.

## Verificação

12 testes automatizados aprovados; build local e builds Docker aprovados. Smoke do piloto e smoke específico dos locais executados nos serviços locais com dados reais. O smoke de locais realizou 40 requisições para validar os dois turnos, busca exata, filtros combinados, lista de seções sem duplicação, acentos e caixa, nomes variantes, texto literal, paginação, validação e HTML dos estados da interface.

Na primeira execução local, as requisições levaram até 236 ms no conjunto observado; as consultas de zona/seção à API levaram 143 ms e 18 ms. Esses tempos são amostras de desenvolvimento, não garantia de produção ou teste de carga. Um índice de seção foi aplicado ao banco e incluído no esquema de novas importações.

## Limites da avaliação

A ferramenta de navegador não apresentou superfícies disponíveis nesta sessão. Portanto, não houve inspeção visual no navegador, teste real de leitor de tela ou auditoria completa de acessibilidade. Responsividade, navegação e semântica foram avaliadas pelo código, testes de navegação e HTML servido. Não há resultados isolados por seção nesta tela; a seção atua como localizador.
