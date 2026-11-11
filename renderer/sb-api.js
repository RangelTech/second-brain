// Mapa único entre a interface e o app (window.sb). O app instalado liga isto ao IPC do Electron (preload.js); a versão web
// (renderer/sb-web.js) liga ao WebSocket da ponte. Assim a interface é a mesma nos dois lugares.
// `invoke(canal, ...args)` devolve uma promessa; `on(canal, fn)` registra um ouvinte de evento (fn recebe só os dados).
;(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica()
  else raiz.criarSb = fabrica()
})(typeof self !== 'undefined' ? self : this, function () {
  return function criarSb(invoke, on, extras = {}) {
    return {
      cfg: () => invoke('cfg:get'),
      salvarCfg: (c) => invoke('cfg:set', c),
      chats: () => invoke('chats:get'),
      salvarChats: (c, apagados) => invoke('chats:set', c, apagados || []),
      aoChatsMudou: (fn) => on('chats:mudou', fn),
      escolherPasta: () => invoke('pasta:escolher'),
      enviar: (p) => invoke('chat:enviar', p),
      aquecer: (p) => invoke('agente:aquecer', p),
      direcionar: (p) => invoke('agente:direcionar', p),
      parar: (id) => invoke('chat:parar', id),
      aoDelta: (fn) => on('chat:delta', fn),
      aoMidiaPronta: (fn) => on('midia:pronta', fn),
      aoFim: (fn) => on('chat:fim', fn),
      aoPreparando: (fn) => on('hermes:preparando', fn), // texto da preparação do agente na primeira abertura ('' = pronto)
      aoRetomar: (fn) => on('conexao:retomada', fn), // só a versão web emite: a conexão caiu e voltou
      routerEstado: () => invoke('router:estado'),
      api: (metodo, rota, corpo) => invoke('router:api', { metodo, rota, corpo }),
      modelos: () => invoke('modelos:listar'),
      abrirExterno: (url) => (extras.abrirExterno ? extras.abrirExterno(url) : invoke('externo:abrir', url)),
      oauthJanela: extras.abrirExterno ? null : (p) => invoke('oauth:janela', p), // app instalado: o login abre numa janela do app
      oauthExtensao: (p) => invoke('oauth:extensao', p), // web (e app com Chrome conectado): o login abre no Chrome do usuário, pela extensão
      extensao: {
        estado: () => invoke('extensao:estado'),
        conectar: () => (extras.abrirExterno ? Promise.resolve({ ok: false, erro: 'Use o aplicativo ou o site do remoto para conectar.' }) : invoke('extensao:conectar')),
        aoEstado: (fn) => on('extensao:estado', fn),
      },
      anexar: (p) => invoke('anexo:salvar', p),
      anexoInicio: (p) => invoke('anexo:inicio', p),
      anexoPedaco: (p) => invoke('anexo:pedaco', p),
      anexoFim: (p) => invoke('anexo:fim', p),
      lerArquivoPedaco: (p) => invoke('arquivo:lerPedaco', p),
      caminhoDe: (arquivo) => (extras.caminhoDe ? extras.caminhoDe(arquivo) : ''),
      abrirArquivo: (p) => invoke('arquivo:abrir', p),
      mostrarArquivo: (p) => invoke('arquivo:mostrar', p),
      lerArquivo: (p) => invoke('arquivo:ler', p),
      abrirLogs: () => invoke('logs:abrir'),
      info: () => invoke('app:info'),
      atualizacao: {
        estado: () => invoke('atualizacao:estado'),
        conferir: () => invoke('atualizacao:conferir'),
        baixar: () => invoke('atualizacao:baixar'),
        instalar: () => invoke('atualizacao:instalar'),
        aoMudar: (fn) => on('atualizacao:estado', fn),
      },
      responderPermissao: (req, resposta) => invoke('chat:permissao-resp', { req, resposta }),
      aoPermissao: (fn) => on('chat:permissao', fn),
      skills: {
        listar: () => invoke('skills:listar'),
        ler: (r) => invoke('skills:ler', r),
        gravar: (r, c) => invoke('skills:gravar', r, c),
        criar: (n, c) => invoke('skills:criar', n, c),
        apagar: (r) => invoke('skills:apagar', r),
        renomear: (r, n) => invoke('skills:renomear', r, n),
        copiar: (r) => invoke('skills:copiar', r),
        buscar: (t) => invoke('skills:buscar', t),
        historico: (r) => invoke('skills:historico', r),
        versao: (r, h) => invoke('skills:versao', r, h),
        aoMudar: (fn) => on('skills:mudou', fn),
        repo: {
          estado: () => invoke('skillsrepo:estado'),
          vincular: (url, tok) => invoke('skillsrepo:vincular', url, tok),
          desvincular: () => invoke('skillsrepo:desvincular'),
          loginDisponivel: () => invoke('skillsrepo:login-disponivel'),
          loginIniciar: () => invoke('skillsrepo:login-iniciar'),
          loginAguardar: (o) => invoke('skillsrepo:login-aguardar', o),
          criar: (n) => invoke('skillsrepo:criar', n),
          sincronizar: (o) => invoke('skillsrepo:sincronizar', o),
        },
      },
      // acesso web: estado e liga/desliga (a interface web não mostra isto)
      acessoWeb: {
        estado: () => invoke('acessoweb:estado'),
        ativar: (sim) => invoke('acessoweb:ativar', sim),
        renomear: (nome) => invoke('acessoweb:renomear', nome),
        aoEstado: (fn) => on('acessoweb:estado', fn),
      },
      exportarDados: () => invoke('dados:exportar'),
      importarDados: () => invoke('dados:importar'),
      unlimitedEstado: () => invoke('unlimited:estado'),
      unlimitedRecusar: () => invoke('unlimited:recusar'),
      unlimitedEntrar: (email, senha) => invoke('unlimited:entrar', { email, senha }),
      unlimitedEsqueci: (email) => invoke('unlimited:esqueci', email),
      creditos: () => invoke('creditos:opcoes'), // saldos, pacotes de crédito e próximo plano (pop-up de limite estourado)
      contaUso: () => invoke('conta:uso'),
      unlimitedSair: () => invoke('unlimited:sair'),
      aoUnlimited: (fn) => on('unlimited:estado', fn),
      ditadoServidor: (dados, mime) => invoke('ditado:servidor', dados, mime),
      ditadoWhisperPronto: () => invoke('ditado:whisper-pronto'),
      ditadoWhisperAquecer: () => invoke('ditado:whisper-aquecer'),
      ditadoWhisper: (pcm) => invoke('ditado:whisper', pcm),
      ditadoEmbutido: () => invoke('ditado:embutido'),
      ditadoModelo: () => invoke('ditado:modelo'),
      navegador: {
        limites: (l) => invoke('navegador:limites', l),
        mostrar: (sim) => invoke('navegador:mostrar', sim),
        esconderTemp: (sim) => invoke('navegador:esconder-temp', sim),
        acao: (acao, url) => invoke('navegador:acao', { acao, url }),
        estado: () => invoke('navegador:estado'),
        captura: () => invoke('navegador:captura'),
        clique: (x, y) => invoke('navegador:clique', x, y),
        digitarTexto: (t) => invoke('navegador:digitar-texto', t),
        tecla: (k) => invoke('navegador:tecla', k),
        rolarPonto: (dy, x, y) => invoke('navegador:rolar-ponto', dy, x, y),
        favoritos: () => invoke('navegador:favoritos'),
        importarFavoritos: () => invoke('navegador:importar-favoritos'),
        favoritar: (f) => invoke('navegador:favoritar', f),
        aoEstado: (fn) => on('navegador:estado', fn),
        aoAbrirPainel: (fn) => on('navegador:abrir-painel', () => fn()),
      },
      aoErro: (fn) => on('chat:erro', fn),
    }
  }
})
