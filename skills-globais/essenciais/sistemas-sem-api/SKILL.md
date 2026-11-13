---
name: sistemas-sem-api
description: |
  Fazer o agente operar um sistema do cliente que não tem API nem linha de comando: ERP antigo (Delphi, VB6, Clipper, Access), sistema de nota fiscal, programa de clínica, de estoque, de contabilidade, software desktop fechado ou de código aberto. Método inspirado no CLI-Anything (HKUDS, Apache 2.0): achar o caminho mais seguro (API, exportação, banco de dados, automação da tela), mapear, e transformar o fluxo num comando reutilizável com conferência. Use quando o usuário pedir "lança uma nota no meu sistema", "pega os dados do meu ERP", "acessa o programa X", "aprende a usar o meu sistema", "acha o banco de dados do sistema".
---

# Sistemas sem API (ERP antigo, programa fechado)

Objetivo: o agente aprende a usar o sistema do cliente **uma vez** e depois executa pedidos ("lança a nota 123 para o cliente Fulano") com um comando só, conferindo o resultado.

## Regra de ouro
**Ler é livre, escrever exige caminho oficial.** Para consultar, o banco de dados resolve. Para **gravar** (lançar nota, baixar estoque, cadastrar cliente), use o caminho que o próprio sistema usa (a tela ou uma importação do sistema): ele aplica as regras de negócio, os impostos, a numeração e a integração com a SEFAZ. Gravar direto no banco pode corromper o sistema ou gerar problema fiscal. Só grave no banco se o usuário pedir explicitamente, sabendo do risco, e depois de um backup.

## 1. Descobrir (sempre nesta ordem, pare no primeiro que servir)
1. **Tem API, webservice ou integração?** Procure na pasta do sistema arquivos `*.wsdl`, `swagger`, menus "Integração", "Webservice", "API". Pergunte ao usuário se o fornecedor oferece.
2. **Tem importação ou exportação de arquivo?** Muitos ERPs importam XML, CSV ou TXT em layout próprio (pedidos, notas, cadastros). É o caminho mais seguro para gravar em lote.
3. **Banco de dados (para ler e entender):**
   - Ache o executável e a pasta: processo em execução (`tasklist /v` ou `Get-Process | Select Path`), atalho na Área de Trabalho, `C:\Program Files*`, `C:\<NomeDoSistema>`.
   - Procure a conexão: arquivos `*.ini`, `*.cfg`, `*.conf`, `*.udl`, `*.xml` na pasta do sistema; chaves do Registro do fornecedor (`HKCU\Software\<Fornecedor>`, `HKLM\SOFTWARE\WOW6432Node\<Fornecedor>`).
   - Reconheça o banco: `.fdb`/`.gdb` + `gds32.dll`/`fbclient.dll` = **Firebird/InterBase** (muito comum em Delphi); `MSSQL`/`SQLOLEDB`/`Data Source=` = **SQL Server**; `.mdb`/`.accdb` = **Access**; `.db`/`.px` = **Paradox**; `.dbf` = **dBase/Clipper**; porta 3306 = **MySQL**, 5432 = **PostgreSQL**.
   - Conecte **somente leitura** (usuário de leitura, ou transação que nunca faz commit). Firebird: usuário padrão costuma ser SYSDBA (peça a senha ao usuário; nunca adivinhe por força bruta). Python: `firebird-driver`, `pyodbc`, `pymysql`, `psycopg`, `dbfread`, `pypyodbc` para Access.
   - Mapeie: liste tabelas, colunas e quantidade de linhas; ache as tabelas do assunto (NOTA, NF, PEDIDO, CLIENTE, PRODUTO, ESTOQUE...) e as chaves entre elas. Salve o mapa em `<pasta desta skill>/sistemas/<nome-do-sistema>/MAPA.md`.
4. **Automação da tela (para gravar pelo caminho oficial):** o sistema é a fonte da verdade.
   - Windows: `pywinauto` (backend `uia`; para Delphi antigo tente também `win32`) lê janelas, campos e botões pelo nome. Se o campo não tiver nome, use a ordem dos campos ou a posição relativa à janela.
   - Sempre que der, use o teclado (Tab, atalhos, Enter): é o que mais funciona em ERP Delphi.
   - Em último caso, visão: print da janela (`vision_analyze`) e clique por coordenada relativa à janela.
   - Peça ao usuário para mostrar o caminho uma vez ("me diz os passos que você faz para lançar uma nota") e transforme em macro.

## 2. Transformar em comando (o jeito CLI-Anything)
Para cada tarefa repetida, crie um script em `<pasta desta skill>/sistemas/<sistema>/` com:
- **Parâmetros** claros (`--cliente`, `--produto`, `--quantidade`, `--valor`).
- **Pré-condições**: o sistema está aberto? logado? na tela certa? Se não, prepare ou avise.
- **Passos** da macro (tela) ou da importação (arquivo).
- **Pós-condições**: confira que gravou (consulta de leitura no banco, ou o número da nota na tela). Sem conferência, não diga que deu certo.
- **Saída JSON**: `{ "ok": true, "nota": 123, "conferido": "nota 123 encontrada na tabela NF" }`.
- Uma linha no `MAPA.md` explicando o comando. Na próxima vez, use o comando direto.
Referências completas: `referencias/HARNESS-cli-anything.md` (método para software de código aberto: CLI com JSON, testes, uso do backend real) e `referencias/MACROCLI.md` (macros parametrizadas para programas fechados, com pré e pós-condições).

## 3. Conversa com o usuário
- Explique em uma frase o plano ("vou achar onde o sistema guarda os dados, só para ler, e aprender a tela de nota com você").
- Antes de gravar qualquer coisa, mostre o que vai ser lançado e espere o "pode".
- Faça a primeira vez **junto** (ele vendo a tela). Depois de conferido, ofereça transformar em workflow.
- Senhas que ele passar: guarde só na skill `logins-salvos`, no computador dele.

## Licença
Método adaptado do CLI-Anything (HKUDS), licença Apache 2.0 (ver `referencias/LICENSE-cli-anything-apache2.txt`).
