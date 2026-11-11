; Roda no fim da instalacao (inclusive a silenciosa). So faz a LIMPEZA abaixo; o preparo do agente acontece no app, em segundo plano.
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
  ; O agente NAO e preparado aqui (11/11/2026): esperar o preparo deixava a instalacao em 10 a 30 min. O instalador so copia o app (1 a 2 min) e
  ; termina; o app abre e prepara o agente em SEGUNDO PLANO (cartao com a barra no canto), com o chat ja liberado para perguntas comuns.
  DetailPrint "Pronto. O assistente termina de se preparar sozinho quando o aplicativo abrir."
!macroend
