---
name: taipy
description: |
  Framework Python para painéis e apps de dados (gráficos, tabelas, pipelines). Já usamos Metabase e Power BI; serve só se o cliente quiser um app de dados próprio na máquina virtual.
  Use quando o cliente disser: "quero um painel de dados em Python"; "app web com gráficos e tabelas do pandas"; "dashboard simples na minha máquina virtual".
---

# Taipy

> **Validada na bancada (parcial):** instalação ok, mas o servidor não subiu no PC de teste (Windows com caminho longo): `Invalid async_mode specified`, depois de o gevent falhar ao carregar DLL. Não testado em Linux.

## Quando usar
Cliente com dados em Python/pandas quer um painel web simples hospedado na máquina virtual dele.

## Quando NÃO usar
Para BI corporativo (Metabase/Power BI). Não é para quem não programa.

## Combina com
`site-na-maquina-virtual`, `drawdb`.

## Receita validada na bancada (parcial)
```bash
python -m venv v && v/bin/pip install taipy       # 2 min, taipy 4.1.1, ~70 pacotes
```
```python
from taipy.gui import Gui
Gui("# Painel\n<|{df}|chart|x=mes|y=vendas|type=bar|>").run(host="127.0.0.1", port=3931, run_browser=False)
```
A falha foi do ambiente de teste (gevent com caminho de pasta longo no Windows). Na VM Linux deve subir, mas isso NÃO foi comprovado.

## Armadilhas
- No Windows com caminho profundo, o `gevent` não carrega a DLL; instale o venv em pasta curta (ex.: `C:\venv`).
- `pip install taipy` traz muitas dependências (2 min).
- Não valida segurança: não exponha sem autenticação.

## Tempo e recursos medidos
pip install 2 min.
