; Roda no fim da instalacao (inclusive a silenciosa): baixa o agente do Segundo Cerebro e faz um TESTE de verdade (uma conversa com o agente).
; 1) LIMPEZA: o instalador troca os arquivos do programa, mas a pasta de dados do usuario (%APPDATA%\SegundoCerebro) nao e tocada, e e la que fica o
;    agente (Hermes). Uma instalacao anterior quebrada ou abortada deixava o Hermes pela metade e a nova instalacao herdava o defeito. Se o agente
;    NUNCA passou no teste (nao existe teste-instalacao.ok), apaga so o agente e o ambiente dele e instala do zero. Conversas, memoria e skills ficam.
; 2) Se o teste falhar a instalacao NAO e abortada: o app termina de preparar o assistente sozinho quando abre (com aviso na tela e nova tentativa)
;    e a falha ja foi enviada a equipe (relatorio-instalacao.js).
!macro customInstall
  ${IfNot} ${FileExists} "$APPDATA\SegundoCerebro\teste-instalacao.ok"
    DetailPrint "Removendo uma instalacao anterior do assistente que nao terminou..."
    RMDir /r "$APPDATA\SegundoCerebro\hermes"
    RMDir /r "$APPDATA\SegundoCerebro\hermes-home\installs"
    RMDir /r "$APPDATA\SegundoCerebro\hermes-home\environments"
    Delete "$APPDATA\SegundoCerebro\hermes-home\pronto.ok"
  ${EndIf}
  DetailPrint "Preparando e testando o assistente (baixa os componentes; leva alguns minutos, uma vez so)..."
  ExecWait '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --preparar-agente' $0
  ${If} $0 == 0
    DetailPrint "Assistente pronto e testado."
  ${Else}
    DetailPrint "O assistente sera preparado quando o aplicativo abrir (codigo $0)."
  ${EndIf}
!macroend
