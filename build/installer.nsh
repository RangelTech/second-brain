; Roda no fim da instalacao (inclusive a silenciosa): baixa e prepara o agente do Segundo Cerebro, para que o cliente so converse
; depois de instalar. Se faltar internet o instalador termina normal e o app tenta de novo ao abrir.
!macro customInstall
  DetailPrint "Preparando o assistente (baixa os componentes; leva alguns minutos, uma vez so)..."
  ExecWait '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --preparar-agente' $0
  DetailPrint "Preparo do assistente terminou (codigo $0)."
!macroend
