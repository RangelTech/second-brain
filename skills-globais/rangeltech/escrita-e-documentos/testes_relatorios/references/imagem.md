# QA de imagem: gráficos e diagramas gerados

O `relatorio` desenha PNG com matplotlib por código, sem preview. Ninguém olha o resultado antes de ele entrar no DOCX, e é aí que chega na mesa do cliente com seta atravessando caixa.

Não existe script para isso. O verificador é a própria leitura da imagem: **abra o PNG com a ferramenta de leitura de arquivo e olhe**. Passada mental não conta, e conferir o código que gerou também não, porque o código pode estar certo e o resultado sobreposto mesmo assim, já que matplotlib posiciona por coordenada e não por layout.

## Como rodar

Para cada PNG que vai entrar no documento:

1. Leia a imagem.
2. Percorra as duas listas abaixo, na ordem. Bloqueante primeiro.
3. Para cada defeito, **cite onde**: "a seta de Ingestão para RAW passa por cima do rótulo da banda de Governança".
4. Corrija no script gerador e **gere de novo**. Nunca edite o PNG.
5. Leia de novo. Correção de sobreposição costuma criar outra sobreposição em outro lugar.

Relate as contagens, não "revisei". Um defeito é corrigido ou justificado explicitamente.

## Bloqueante: sai errado no documento

**Sobreposição.** Seta cruzando caixa ou rótulo; caixas encavaladas; legenda em cima de dado; rótulo de fatia de pizza sobre outra fatia; anotação sobre a linha que anota. É o defeito mais comum em diagrama de arquitetura desenhado por coordenada fixa.

**Texto vazando.** String maior que a caixa que a contém. Sintoma clássico é o corte no fim, tipo `...+ Gua`. Se cortou, o texto é longo demais para a fonte: encurte a string ou reduza a fonte, e não aumente a caixa até quebrar o alinhamento das outras.

**Rótulo faltando.** Eixo sem nome, eixo sem unidade, série sem legenda quando há mais de uma, fatia sem identificação. Número sem unidade não é dado, é enfeite. Diga qual é: R$, %, unidades, registros, dias.

**Idioma trocado.** Rótulo em inglês num relatório em português, ou o contrário. Vem do nome da coluna do dataframe indo direto pro eixo. Nome técnico de tabela e de campo **fica como está** (`z04_analytics_spe._rd.conta` não vira "conta"), mas rótulo de eixo e de legenda são texto do documento e seguem o idioma dele.

**Número ilegível ou errado.** Eixo em notação científica onde cabia mil ou milhão; separador decimal em padrão inglês num texto em português (`1,234.56` em vez de `1.234,56`); rótulo de valor sobrepondo a barra.

**Categoria perdida.** O gráfico mostra 5 barras e a tabela tem 7 linhas. Toda vez que o gráfico agrega ou corta, o texto tem que dizer isso.

## Inspecionar: pode ser decisão consciente

**Eixo de barra não começa em zero.** Em gráfico de barras isso exagera diferença e é engano visual. Em linha, é legítimo. Se não começa em zero numa barra, tem que haver motivo declarado.

**Cor indistinguível.** Duas séries em tons próximos do mesmo matiz, ou paleta que some em daltonismo vermelho-verde, ou o documento vai ser impresso em preto e branco. Prefira diferença de luminosidade além do matiz.

**Fonte pequena demais.** Abaixo de ~8pt no PNG em DPI 200, dentro de uma imagem que entra com 6,3 polegadas de largura, vira mancha. Teste: você consegue ler no zoom de 100%?

**Grade dominando o dado.** Linha de grade mais forte que a série. Grade é referência, não conteúdo.

**Marca de escala amontoada.** Rótulos de data ou categoria colidindo no eixo x. Gire, alterne ou reduza a quantidade.

**Densidade errada.** Pizza com mais de 6 fatias, ou barra empilhada com tantas camadas que nenhuma é comparável.

**Legenda redundante.** Série única com legenda, ou legenda repetindo o que o título já disse.

## O que confere com o texto, não com a imagem

Estes só aparecem lendo o PNG e o parágrafo juntos:

- O número citado no texto aparece no gráfico e é o mesmo. Divergência aqui é erro grave e silencioso.
- A legenda da figura diz o que a figura mostra, e o leitor entende sem voltar ao corpo.
- O texto referencia a figura, e não só a menciona de passagem.
- O período do gráfico é o período que o texto afirma.
- Se o texto diz "cresceu", o gráfico mostra crescimento na direção que o olho lê.

## Formato

DPI 200, `savefig(bbox_inches="tight", facecolor="white")`, e no DOCX `Inches(6.3)` a `Inches(6.5)`, que é a largura útil de A4. Fundo transparente vira cinza em alguns visualizadores de Word, então fixe branco.
