; Roda no fim da instalacao (inclusive a silenciosa): baixa o agente do Segundo Cerebro e faz um TESTE de verdade (uma conversa com o agente).
; Se o teste falhar a instalacao NAO e abortada: o app termina de preparar o assistente sozinho quando abre (com aviso na tela e nova tentativa)
; e a falha ja foi enviada a equipe (relatorio-instalacao.js). Abortar aqui deixava o cliente sem o app por causa de um passo que o proprio app refaz.
!macro customInstall
  DetailPrint "Preparando e testando o assistente (baixa os componentes; leva alguns minutos, uma vez so)..."
  ExecWait '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --preparar-agente' $0
  ${If} $0 == 0
    DetailPrint "Assistente pronto e testado."
  ${Else}
    DetailPrint "O assistente sera preparado quando o aplicativo abrir (codigo $0)."
  ${EndIf}
!macroend
