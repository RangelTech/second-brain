# Spec: Hermes resiliente + pop-up de transcrição + scroll do chat + indicador no rodapé + stream morto

Status: rascunho, não implementado. Cinco itens independentes.

## 1. O Hermes não pode morrer: retomar sozinho, por baixo dos panos

### Problema hoje

Quando o processo do Hermes (`hermes-acp`) sai inesperadamente enquanto há um turno em andamento, `agent.js` reage assim (`Sessao.subir()`):

```js
filho.on('exit', (codigo, sinal) => {
  registrar(this.app, 'agente saiu codigo=' + codigo + ' sinal=' + sinal + ' bin=' + this.bin)
  if (this.filho !== filho) return
  for (const p of this.pendentes.values()) p.rej(new Error('O agente encerrou.'))
  this.pendentes.clear()
  this.morto = true
})
```

Toda promessa pendente (a chamada `session/prompt` em curso) é rejeitada com `'O agente encerrou.'`. Essa rejeição sobe até `responder()` em `main.js`, que propaga o erro para a UI via `ctx.onDelta`/`aoFim`, e o cliente vê a mensagem genérica — a tarefa é dada como perdida do ponto de vista do produto, mesmo que ela estivesse quase terminando.

Não há tentativa de:
- relançar o processo automaticamente;
- recuperar o estado da sessão ACP (`sessionId`) do lado do Hermes, se ele ainda existir em disco;
- repetir o último `session/prompt` sozinho antes de desistir e avisar o cliente.

O único relançamento automático que existe hoje é dentro de `iniciar()` (linha ~430), e só cobre a fase de *inicialização* da sessão (`initialize` + `session/new`), com até 3–5 tentativas — não cobre uma morte *no meio* de um `session/prompt` já em andamento.

### Duas camadas que não podem ser confundidas

- **Falha de ferramenta dentro da sessão** (ex.: um comando falha porque falta um pacote): o processo do Hermes continua vivo, o modelo vê o erro da ferramenta no próprio turno e decide o que fazer (reinstalar, tentar outro caminho, etc.). Isso já é o funcionamento normal de um agente e **não depende de nada desta spec** — não há código novo aqui para esse caso.
- **Morte do processo inteiro** (`hermes-acp` sai, por crash, falta de memória, SIGTERM externo, binário corrompido etc.): ninguém está vivo para decidir nada, porque o raciocínio que decidiria morreu junto com o processo. É só este segundo caso que a spec resolve: garantir que sempre nasça um processo novo que **retoma a tentativa de completar o que o cliente pediu**, para que o próprio modelo (já de pé de novo) possa, inclusive, ser quem resolve a causa da morte anterior se ela for descobrível (ex.: reconfigurar algo), exatamente como resolveria qualquer outro erro dentro de uma sessão viva.

### Comportamento esperado

O Hermes morrer no meio de uma tarefa não deve, por padrão, aparecer para o cliente como falha, e não deve nunca desistir sozinho. O app deve:

1. **Detectar a morte** (já existe: `filho.on('exit')`).
2. **Relançar o processo automaticamente**, reaproveitando o mesmo `HERMES_HOME` (o ambiente já está montado — não é a primeira subida).
3. **Retomar a sessão**: como o ACP não garante que o `sessionId` antigo sobrevive a um processo novo, a retomada é por `session/new` normal nesse `cwd`, seguida do reenvio do turno:
   - Guardar o texto do último `session/prompt` que estava em voo (e os anexos) antes de rejeitar as promessas.
   - **Descartar qualquer texto parcial** que já tinha sido emitido antes da morte (`agent_message_chunk` recebidos até então) — não tenta emendar. Esse pedaço fecha como está (como um card de "pensamento" encerrado) e a resposta recomeça **num card novo**, do zero, com o mesmo pedido original.
   - Reenviar o mesmo prompt automaticamente ao processo novo, **sem notificar o cliente que algo quebrou** — do ponto de vista dele, a resposta demorou mais e apareceu um novo bloco de atividade, só isso.
4. **Sem limite de tentativas e sem teto de tempo.** O app insiste até o Hermes conseguir completar o turno. A única forma de interromper é o cliente clicar em **Parar** (o botão que já existe para cancelar uma resposta em andamento) — isso vale tanto para "está demorando" quanto para "está morrendo e relançando repetidamente". Cada nova tentativa é visível para o cliente como mais um card de atividade, então ele sempre pode decidir que já esperou demais e parar por conta própria; o produto nunca decide isso por ele.
5. **Registro**: cada morte e cada relançamento automático continuam indo para `agente.log` (já temos código+sinal gravados), para que o suporte veja o padrão — inclusive casos em que o Hermes morreu e relançou dezenas de vezes seguidas sem o cliente nunca ter percebido nada além de demora.

### Onde mexer (mapa, não implementação)

- `agent.js`, classe `Sessao`:
  - `subir()`: o handler de `exit` precisa, quando há um turno em voo (`this.turno` não nulo), guardar o prompt original (e os anexos) em vez de só rejeitar, descartar o texto parcial acumulado, e disparar a rotina de relançamento em vez de marcar `this.morto = true` incondicionalmente.
  - `perguntar()`: precisa saber reemitir a mesma chamada depois de um relançamento bem-sucedido, reaproveitando `emitir`/`pedirPermissao` da chamada original (hoje eles já são reatribuídos a cada mensagem em `main.js`, então isso deve ser direto). Cada reenvio abre um novo "card de atividade" na UI (o mecanismo de `montarVivo`/`respostas` já existente serve, desde que o reenvio seja tratado como uma repetição do mesmo turno lógico e não como mensagem nova do usuário).
  - O laço de relançamento não tem contador máximo nem prazo total — só o cancelamento explícito (`sessao.cancelar()` / `window.sb.parar(id)`, já existentes) deve interromper o laço.
- `main.js`, `sessaoDoChat()`/`responder()`: confirmar que nada ali assume que uma rejeição de `perguntar()` é definitiva (deve já estar ok, já que quem decide "desistir ou não" passa a ser inteiramente o próprio `agent.js`, e a única saída é o cancelamento pedido pelo cliente).

### Fora de escopo desta spec

- Recuperar execução de ferramenta que estava em andamento no meio (ex.: um comando de terminal rodando) — ao relançar o processo, essa execução se perde de qualquer forma, porque é o próprio processo do Hermes que a hospeda. O prompt reenviado, ao rodar num processo novo, decide por conta própria se repete essa ação, tenta outra coisa, ou corrige o que causou o problema — isso é raciocínio do modelo, não lógica desta spec.
- Qualquer mensagem de "desistência" ao cliente: como não há mais desistência automática, o único jeito de a resposta terminar sem sucesso é o próprio cliente parar. Não há texto de erro a desenhar para esse caso.

---

## 2. Pop-up "Transcrevendo o áudio…" some antes da transcrição terminar

### Problema hoje

`renderer/app.js`, dentro de `transcreverAudio`:

```js
async function transcreverAudio(audio) {
  transcrevendo = true
  pintarMic('transcrevendo')
  aviso('Transcrevendo o áudio…')
  let r
  try {
    r = await window.sb.ditadoServidor(audio.bytes, audio.mime)
  } ...
```

E a função genérica de aviso:

```js
function aviso(txt) {
  const a = $('aviso-geral')
  a.textContent = txt
  a.hidden = !txt
  if (txt) setTimeout(() => (a.hidden = true), 6000)
}
```

Qualquer chamada a `aviso(txt)` esconde o aviso sozinha depois de **6 segundos fixos**, pensada para avisos curtos e informativos (ex.: erros). A transcrição real demora ~9–10s (Whisper no servidor) mais o tempo de rede/fila, então o pop-up some aos 6s enquanto a chamada ao servidor ainda está em voo — e quando ela de fato termina (sucesso ou erro), não sobra nenhum indicador na tela além do texto aparecer (ou não) na caixa.

### Comportamento esperado

O aviso "Transcrevendo o áudio…" deve ficar visível **enquanto a chamada ao servidor estiver pendente**, e só sumir quando:
- a transcrição retornar com sucesso (o texto já aparece na caixa — redundante manter o aviso, então soma-se nesse momento), **ou**
- der erro (nesse caso o aviso deve trocar de mensagem, para o erro, e aí sim seguir a regra normal de sumir sozinho depois de alguns segundos).

### Onde mexer (mapa, não implementação)

Duas abordagens possíveis, para decidir na implementação:

**A. Aviso sem timeout automático, limpo manualmente.**
Adicionar uma variante (ex. `avisoPersistente(txt)`) que seta o texto sem agendar o `setTimeout`, e chamar `aviso('')` (que já existe no fim de `transcreverAudio`, nos três ramos) para encerrar. Simples, mas precisa auditar os outros chamadores de `aviso()` para não quebrar o comportamento deles.

**B. Cancelar/resetar o timer anterior a cada chamada de `aviso()`.**
Guardar o `setTimeout` em uma variável de módulo e limpar com `clearTimeout` sempre que `aviso()` for chamado de novo. Isso já resolveria o caso de "transcrevendo" → "erro" → "sumiu" meio automaticamente, mas ainda precisa que o *início* da transcrição não dispare o timer de 6s, ou passar um parâmetro para pular o timeout quando o chamador sabe que vai limpar manualmente (caso da transcrição).

Recomendado: opção A, por ser mais explícita e não arriscar efeito colateral nos ~15+ outros lugares que já chamam `aviso()` hoje para mensagens curtas (esses continuam com o comportamento atual de sumir em 6s).

### Fora de escopo desta spec

- Qualquer mudança no tempo de resposta do servidor de transcrição.
- Mudar o texto ou design visual do aviso.

---

## 3. Scroll do chat: rolar pra cima não "gruda", e falta botão de voltar ao fim

### Problema hoje

Em `renderer/app.js`, toda vez que chega um pedaço novo da resposta (texto, ferramenta, raciocínio, pedido de permissão), o chat força a rolagem para o fim, sem checar se o cliente tinha rolado para cima de propósito para ler algo antigo:

```js
// no handler de cada delta (texto/ferramenta):
if (visivel(r)) {
  renderPartes(r.el.querySelector('.partes'), r.partes)
  $('conversa').scrollTop = $('conversa').scrollHeight     // <- sempre força pro fim
}
```

```js
// no handler de pedido de permissão:
if (visivel(r)) {
  r.el.appendChild(cartaoPermissao(r, p))
  $('conversa').scrollTop = $('conversa').scrollHeight     // <- idem
}
```

Essas duas chamadas (e as outras em `#('conversa').scrollTop = ...` espalhadas pelo arquivo) não verificam a posição atual do scroll — é sempre um "voltar pro fim" incondicional, a cada pedacinho de texto que chega. Como uma resposta longa emite muitos pedaços por segundo, o cliente que rola para cima para reler algo é puxado de volta ao fim a cada novo pedaço, tornando a rolagem manual praticamente inutilizável durante uma resposta em andamento.

Já existe, no próprio arquivo, o padrão correto sendo usado em outro componente — o painel de atividade (`pintarLog`, por volta da linha 836):

```js
const perto = box.scrollHeight - box.scrollTop - box.clientHeight < 40
box.innerHTML = linhas || '...'
if (perto) box.scrollTop = box.scrollHeight   // só rola se já estava perto do fim
```

Esse padrão não foi aplicado ao scroll principal da conversa (`#conversa`), só ao painel pequeno de atividade.

### Comportamento esperado

**3a. Auto-scroll só quando o cliente já está perto do fim.**
Antes de cada `$('conversa').scrollTop = $('conversa').scrollHeight`, checar se a distância entre o fim do conteúdo e a posição atual de scroll é pequena (mesmo cálculo já usado em `pintarLog`: `scrollHeight - scrollTop - clientHeight < limiar`, com um limiar generoso o bastante pra não exigir estar exatamente no pixel final). Só rola automaticamente se essa condição for verdadeira. Se o cliente rolou pra cima de propósito, nenhuma chegada de texto novo deve mexer na posição dele.

**3b. Botão flutuante "ir para o fim" (padrão ChatGPT/Codex) quando rolado pra cima.**
Quando o cliente está rolado para cima (fora do limiar acima) **e** há uma resposta sendo gerada (ou just chegou algo novo que ficou fora da vista), mostrar um botão flutuante com seta para baixo sobre a área da conversa, ancorado perto do fim visível da lista (ex.: acima da caixa de digitação, centralizado). Clicar nele rola suavemente até o fim e some.
- O botão aparece/some reagindo à posição de scroll do cliente (mostra quando ele sai da zona "perto do fim"; some quando ele volta pra lá, seja rolando manualmente ou clicando no botão).
- Não precisa de contador de mensagens não vistas — só a seta, como no exemplo do Codex/ChatGPT da captura.

### Onde mexer (mapa, não implementação)

- `renderer/app.js`: criar um helper único (ex. `rolarSeEstivaPerto()` ou similar) que encapsula o cálculo de "está perto do fim" + a decisão de rolar, e trocar as chamadas incondicionais de `$('conversa').scrollTop = $('conversa').scrollHeight` por esse helper — são pelo menos as duas ocorrências em `window.sb.aoDelta`/`aoPermissao` citadas acima, e conferir as demais linhas com `scrollTop = scrollHeight` nesse arquivo (ex. abertura inicial de uma conversa) para decidir quais devem continuar incondicionais (ex.: ao *abrir* a conversa pela primeira vez, faz sentido ir direto pro fim, sem checar nada) e quais devem usar o helper (qualquer atualização que chega *depois* de a conversa já estar na tela).
- Novo elemento de UI: botão flutuante com ícone de seta para baixo, escondido por padrão (`hidden`), mostrado/escondido por um listener de `scroll` no elemento `#conversa` que reavalia a mesma condição "perto do fim".
- CSS: posicionamento `position: sticky` ou `position: absolute` sobre a área de conversa, acima da caixa de digitação, com a mesma linguagem visual dos outros botões flutuantes já existentes no app (ex. o botão de atualização ou o aviso de preparo, que já usam esse padrão de elemento flutuante sobre a tela).

### Fora de escopo desta spec

- Contador de "N mensagens novas" no botão — só o ícone de seta, sem número.
- Mudar o comportamento de scroll em qualquer outro painel que já implementa a lógica correta (ex. o painel de atividade já descrito, que serve de referência).

---

## 4. Tarefa longa parece travada: o único sinal de atividade fica lá em cima, longe do rodapé

### Problema hoje

Enquanto o agente trabalha numa tarefa longa, o único lugar que mostra "está vivo, só demorando" é o card de atividade dentro da própria mensagem (`montarVivo`, o bloco com o ponto pulsante, "Trabalhando numa etapa longa…" e o relógio) — que fica **no meio da conversa**, na posição onde aquela resposta está sendo escrita. Se o cliente rolou a tela pra cima pra ler algo antigo (inclusive o próprio problema descrito no item 3 desta spec, onde a tela "gruda" e ele perde a posição), ou se a conversa é longa e aquele card já ficou fora da área visível, o cliente não vê **nenhum** sinal de atividade.

No rodapé (`footer.entrada`, onde fica a caixa de digitar), o único indicador que existe hoje é o botão de enviar virando um ícone de "parar" (`alternarBotao`, em `app.js`):

```js
function alternarBotao(parar) {
  const b = $('enviar')
  ...
  b.innerHTML = parar ? IC.stop : IC.arrowUp
  b.classList.toggle('parar', parar)
  b.setAttribute('aria-label', parar ? 'Parar' : 'Enviar')
}
```

É só a troca de um ícone pequeno, sem texto, sem tempo decorrido — fácil de não notar, principalmente para quem não está olhando o botão de enviar o tempo todo. Resultado: o cliente acha que o app travou, mesmo com o agente processando normalmente.

### Comportamento esperado

Enquanto houver uma resposta em andamento (`respostas.has(atual)`), o rodapé deve mostrar um indicador de atividade **sempre visível**, independente de onde o cliente rolou a conversa — algo na linha "● Trabalhando… 1 min 20 s" próximo da caixa de digitar (acima dela, ou substituindo/complementando a área do `aviso-geral`), usando a mesma fase e o mesmo relógio que já alimentam o card lá em cima (`r.fase`, `fmtTempo(Date.now() - r.inicio)` — o dado já existe e já é atualizado a cada segundo pelo `tiquetaque()`/`relogio`; só falta um segundo lugar na tela que o exiba).

- Deve aparecer/sumir junto com o card principal (mesma fonte de verdade: existe resposta pendente para a conversa que está na tela).
- Clicar nele poderia rolar até o card de atividade correspondente (reaproveitando a ideia do botão "ir para o fim" do item 3, ou um atalho equivalente) — desejável, não obrigatório para a primeira versão.
- Não deve duplicar o botão de parar que já existe no rodapé (`#enviar.parar`) — o indicador é só informativo; parar continua sendo pelo mesmo botão.

### Onde mexer (mapa, não implementação)

- `renderer/index.html`: novo elemento dentro ou próximo de `footer.entrada`/`#compositor`, hidden por padrão.
- `renderer/app.js`: o `tiquetaque()` que já atualiza `.tempo`/`.atv-txt` do card em `montarVivo` (ver item 3 e o painel de atividade do item da seta) precisa, no mesmo laço, atualizar também este novo elemento do rodapé sempre que a resposta pertencer à conversa atualmente aberta (`visivel(r)` ou equivalente). Mostrar/esconder deve seguir a mesma condição que já liga/desliga o botão de parar em `alternarBotao`.

### Fora de escopo desta spec

- Qualquer notificação fora da janela (barra de tarefas, som) quando a tarefa termina — isso é outro pedido, não coberto aqui.

---

## 5. Conexão com o modelo morre em silêncio e o Hermes demora 15 minutos pra perceber

### Problema, com caso real medido (06/11/2026, log interno do Hermes)

Diferente do item 1 (processo inteiro do `hermes-acp` morrendo), este é um caso onde o **processo continua vivo o tempo todo**, mas a conexão de rede entre o Hermes e o modelo trava de um jeito específico: a conexão parece aberta, mas **para de entregar qualquer token**, sem erro nenhum na hora. Caso real, hoje:

- `16:21:53` — uma chamada ao modelo começa a receber resposta, e a entrega de tokens para no meio, sem avisar nada.
- `16:36:53` (**900 segundos, 15 minutos depois**) — o próprio Hermes detecta sozinho: `"Stream stale for 900s (threshold 900s) — no chunks received"`. Ele já tem um vigia interno pra esse tipo específico de falha ("stream parado"), só que o prazo dele é fixo em 900 segundos.
- Na sequência ele mata a conexão morta à força (`stale_stream_kill`, `tcp_force_closed=1`), abre uma nova, e **consegue continuar sozinho** — a chamada seguinte (`API call #72`) deu certo.

Ou seja: o Hermes **já tem** um mecanismo de autoconserto pra esse caso específico — o problema não é a falta de recuperação, é o **prazo de 15 minutos** antes dele agir. Do ponto de vista de quem está na frente da tela, são 15 minutos de silêncio total e indistinguível de "travou de vez", porque nada nessa janela de tempo (nem o card de atividade, nem o rodapé do item 4) diz "isto aqui é uma categoria diferente de espera, o vigia já está de olho, vai resolver sozinho em breve".

### Comportamento esperado

Não precisa reimplementar a recuperação (ela já existe e já funciona) — o alvo é **não deixar o cliente 15 minutos no escuro**:

1. **Investigar se o prazo de 900s é configurável** no Hermes (variável de ambiente, config no `SOUL.md`/`config.yaml`, ou parâmetro de linha de comando) antes de decidir mexer em qualquer coisa. Se for configurável, considerar um valor bem menor (ex. 60-120s) — stream realmente parado por mais de 1-2 minutos já é sinal forte de problema, não precisa esperar 15.
2. **Se não for configurável** (comportamento fixo do Hermes, projeto de terceiros): o app pode ter o seu próprio vigia, mais agressivo, que não mata o processo nem a conexão (isso é tarefa do Hermes), mas **avisa a tela** quando a última atividade (`r.ultimo`, já usado em `sinal()`) passar de um tempo bem menor que 15 minutos — algo como "O modelo está demorando mais que o normal; se isso continuar, o sistema vai tentar se recuperar sozinho em alguns minutos", em vez do atual "Trabalhando numa etapa longa…" genérico que não distingue "demorado mas normal" de "provavelmente travado, aguardando o vigia interno agir".
3. Qualquer um dos dois caminhos (reduzir o prazo real do Hermes, ou só avisar melhor na nossa tela enquanto o prazo dele corre) resolve a reclamação de fundo: **o cliente nunca mais deveria ficar 15 minutos sem nenhuma pista do que está acontecendo.**

### Onde mexer (mapa, não implementação)

- Pesquisar a documentação/código do Hermes (`hermes_cli`, módulo `agent.chat_completion_helpers`/`agent.stream_diag`, onde o log mostrou o texto "Stream stale for Xs (threshold Xs)") atrás de alguma variável de ambiente tipo `HERMES_STREAM_STALE_TIMEOUT` ou equivalente em `config.yaml`.
- Se não houver, o ponto de entrada no nosso lado é o mesmo `sinal()`/`tiquetaque()` do item 4: já sabemos quando `r.ultimo` não muda há N segundos; só falta uma segunda faixa de tempo (ex. "mais de 3 minutos sem nenhum chunk" → mensagem diferenciada) além da que já existe hoje ("mais de 45 segundos" → "Trabalhando numa etapa longa…").

### Fora de escopo desta spec

- Mudar o mecanismo de recuperação em si (matar+reabrir a conexão) — isso já existe e já funciona, não é o que está quebrado.
- Qualquer alteração em como o Hermes decide que um stream está "stale" — só o prazo até ele decidir isso é o alvo, e só depois de confirmar se é configurável.
