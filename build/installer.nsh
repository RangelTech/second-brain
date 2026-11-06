; Roda no fim da instalacao (inclusive a silenciosa): baixa o agente do Segundo Cerebro e faz um TESTE de verdade (uma conversa com o agente).
; A instalacao so termina se o teste passar: o cliente instala e ja conversa. Sem internet ou com falha, oferece tentar de novo.
!macro customInstall
  tentar_de_novo:
  DetailPrint "Preparando e testando o assistente (baixa os componentes; leva alguns minutos, uma vez so)..."
  ExecWait '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --preparar-agente' $0
  ${If} $0 == 0
    DetailPrint "Assistente pronto e testado."
  ${Else}
    DetailPrint "O teste do assistente falhou (codigo $0)."
    IfSilent falhou_silencioso
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "Nao foi possivel preparar o assistente neste computador.$\r$\n$\r$\nConfira a internet e tente de novo. Se continuar, envie o arquivo preparo.log (pasta %APPDATA%\SegundoCerebro) ao suporte." IDRETRY tentar_de_novo
    Abort "A instalacao nao terminou: o teste do assistente falhou."
    falhou_silencioso:
    SetErrorLevel 3
    Abort "A instalacao nao terminou: o teste do assistente falhou."
  ${EndIf}
!macroend
