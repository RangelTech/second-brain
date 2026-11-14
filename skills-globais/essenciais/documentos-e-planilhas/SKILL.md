---
name: documentos-e-planilhas
description: |
  Criar e editar arquivos de escritório para o usuário: documento Word (.docx), planilha Excel (.xlsx/.csv), apresentação PowerPoint (.pptx). Já vem tudo pronto no Cérebro Pro: ambiente Python com python-docx, openpyxl, XlsxWriter e python-pptx (pacote nosso) e o editor de documentos integrado (ONLYOFFICE), onde o usuário abre o arquivo com um clique em "Abrir no editor". Use quando pedirem "faz uma planilha", "monta um relatório em Word", "cria uma apresentação", "orçamento em Excel", "contrato em docx", "edita essa planilha".
---

# Documentos, planilhas e apresentações

## O que já vem pronto (não instale nada por fora)
- **Bibliotecas:** `scripts/ambiente_docs.py` desta skill monta (uma vez, ~1 min, ~150 MB) um Python 3.12 próprio com `python-docx`, `openpyxl`, `XlsxWriter`, `python-pptx`, `Pillow`, do pacote nosso (release `escritorio-v1`). Não use `pip install` no Python do usuário.
- **Python para rodar:** qualquer um; se o computador não tiver, use o do app: `SB_PYTHON` (Windows: `& $env:SB_PYTHON ...`; Linux/mac: `"$SB_PYTHON" ...`).
- **Editor:** o app abre .docx/.xlsx/.pptx/.csv/.odt no editor de documentos integrado. O usuário só clica em **Abrir no editor** ao lado do arquivo no chat. Você não precisa abrir nada.

## Passo a passo
1. Escreva o gerador num arquivo `.py` na pasta de trabalho (ex.: `Documentos/gerar_orcamento.py`) e salve a saída em `Documentos/` com nome claro (`orcamento-padaria-nov-2026.xlsx`).
2. Rode com o ambiente pronto: `python "<pasta da skill>/scripts/ambiente_docs.py" rodar Documentos/gerar_orcamento.py`
3. Confira o que saiu: abra o arquivo de novo pelo mesmo Python (ex.: `openpyxl.load_workbook` e leia as células; `docx.Document` e conte os parágrafos) antes de dizer que está pronto.
4. Entregue o **caminho completo numa linha própria** (vira link e ganha o botão "Abrir no editor"). Diga em uma frase o que tem dentro.

## Qualidade (o usuário é leigo: o arquivo tem que abrir bonito)
- **Planilha:** cabeçalho em negrito com fundo, largura de coluna ajustada, números como número (não texto), moeda `R$ #,##0.00`, datas como data, total com FÓRMULA (`=SOMA` vira `=SUM(B2:B10)` no openpyxl), congelar a primeira linha, uma aba por assunto.
- **Word:** título, subtítulos (Heading 1/2), parágrafos curtos, tabela com estilo (`Light Grid Accent 1`), margens normais, fonte legível (Calibri 11).
- **Apresentação:** 16:9, uma ideia por slide, título curto, no máximo 5 tópicos, imagem quando ajudar (gere com a ferramenta de imagem e insira), última página com próximo passo.
- **Editar arquivo do usuário:** copie antes (`nome-editado.xlsx`), mexa só no pedido e mantenha a formatação dele.
- CSV para quem vai abrir no Excel brasileiro: separador `;` e `encoding="utf-8-sig"`.
