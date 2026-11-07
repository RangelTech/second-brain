# Spec: contexto menor e geração mais rápida no agente

Data: 07/11/2026. **Só especificação: nada foi implementado nem alterado em produção.**

## 0. Regras de ouro (decisões do Lucas)

1. **Sempre melhorar, nunca piorar.** Qualidade, velocidade e fila só andam para frente. Toda mudança passa pelo portão de não regressão (seção 3) antes de ir para produção. Mudança que piora qualquer métrica de qualidade volta atrás.
2. **O MTP continua ligado** (mediu +50% de tok/s em contexto curto). Desligar o MTP só entra como medição de diagnóstico, nunca como solução.
3. **Nenhum gasto extra.** Nada de alugar máquina. Os testes rodam na **própria GPU de produção** (a 2×3090 `hold-cz-25792`), numa **janela contínua de 2 horas** com a produção parada, e depois volta o deploy do que funcionou (seção 4). **Regra dura: a instância da Vast NUNCA é destruída, parada nem recriada** (perderíamos a máquina barata e o aluguel até 28/11). Mexemos só em processos dentro dela (vLLM, venvs, arquivos); nenhum comando `stop`/`destroy` da Vast e nenhuma troca de imagem.
4. **Os benchmarks existem para melhorar a nossa GPU** (modelo, parâmetros do vLLM, fila, contexto do agente).
5. **Tudo em 2 horas, começando agora.** A produção está sem ninguém online (o Juca está esperando), então a janela é **contínua**, e cada fase tem tempo máximo (seção 4). O que não passar no portão dentro das 2 h não vai para produção; a produção volta como está.
6. **Melhor custo-benefício:** entre as opções que passam no portão, vale a que dá mais ganho nas métricas primárias por menos risco e complexidade. Se não houver alternativa melhor, aceitamos o que dá.
7. **Guardar todos os valores** em JSON/CSV na pasta de benchmarks, inclusive resultados ruins, porque viram artigo (seção 3d).

## 1. Problema

O agente (Hermes) manda cerca de 25 mil tokens de contexto a cada passo. Com esse contexto:
- a geração cai de ~107 tok/s (contexto curto, com MTP) para ~33 tok/s (observado no log do vLLM, 1 requisição ativa);
- o prefill anda a ~1,7 mil tok/s, então vários usuários em modo agente se enfileiram;
- a cota de 5 M tokens de sessão dura cerca de 200 passos.

Resultado: tarefa grande leva de 10 a 35 min (site do currículo: 36 passos, 35 min).

## 2. O que já sabemos (e o que não sabemos)

| Fato | Origem | Confiança |
|---|---|---|
| ~19,6 mil tokens já no 1º passo, subindo para 27 mil e até 52 mil em sessões longas | log `usage_update` do Hermes (QA de 06 e 07/11) | alta |
| O Hermes reenvia a cada turno um prompt de sistema que costuma passar de 20 mil tokens incluindo as definições de ferramentas | documentação de integração de terceiros (Requesty) | média: bate com o nosso 19,6 mil |
| Definições de ferramentas pesam de ~2 mil a ~15 mil tokens conforme os toolsets ligados | issue #4379 do Hermes, citada em fórum | média |
| Hermes já adia 4 ferramentas (~2 mil tokens) e deixa 16 visíveis | `agent.log` do Hermes | alta |
| Compressão do Hermes: padrão em 50% da janela; camada de gateway em 85%; as duas não podem ser iguais | documentação oficial | alta |
| Taxa de acerto do cache de prefixo ~78% (70% a 83%) | log do vLLM | alta |
| Prefill ~1,7 mil tok/s a frio | teste de carga 06/11 | alta |
| Geração ~33 tok/s com contexto longo | 1 amostra do log do vLLM, não controlada | **baixa** |
| MTP piora em contexto longo (>10 mil) nos híbridos Qwen3.5/3.6 | notas de um fork de terceiros | **média/baixa**: não reproduzido por nós |
| Saídas de ferramentas dominam o contexto de agentes (~84% no SWE-agent) | estudo da JetBrains (arXiv 2508.21433) | média: outro agente |
| O prompt do app tem data e hora com segundos no início (`contextoDeSistema` em `agent.js`) | código | alta; efeito no cache a medir |

**Conclusão provisória:** a maior parte dos ~19,6 mil do 1º passo parece ser o **piso fixo do próprio Hermes** (prompt + ferramentas + índice de skills), não histórico. Se for isso, mascarar saídas antigas (E4) não derruba o piso; o que derruba é reduzir toolsets, prefixo estável e delegação (E5 a E7). **A medição E0 decide.**

Não sabemos ainda: a composição exata dos 25 mil, e se a nossa vLLM 0.30.0 já traz a correção do fork.

## 2b. Duas trilhas independentes

São duas melhorias diferentes, medidas e implantadas separadamente, para saber exatamente o que causou cada ganho. **Uma mudança por vez** dentro de cada trilha.

| | Trilha A: Hermes (o agente) | Trilha B: LLM (o servidor) |
|---|---|---|
| O que é | o que o app manda ao modelo: prompt, ferramentas, histórico, compressão, subagentes | como o modelo roda: vLLM, MTP, fork, cache de prefixo, fila |
| Experimentos | E4, E5 parte 1, E6, E7, E8 | E1, E2, E3, E5 parte 2, fila de 20 |
| Alvo | tokens por passo, passos por tarefa, tempo da T6 | tok/s a 25k, 1º token, fila de 20 |
| Como vai ao ar | nova versão do app (e do atualizador das VMs); a medição limpa usa a janela | `start_vllm.sh` na `hold`, só em janela, com rollback |
| Dono do risco | agente perder informação ou ferramenta | regressão de qualidade ou de velocidade do modelo |

A **subagentes (E7)** é a melhoria mais promissora da trilha A para o problema do contexto: a tarefa longa roda num subagente com contexto isolado e o contexto principal fica pequeno. É melhoria do Hermes, não do modelo. As duas trilhas se somam: contexto menor (A) deixa o modelo mais rápido (B) e a fila mais curta.

Medição: cada trilha tem a sua linha de base e o seu portão (seção 3); depois do deploy das duas, uma medição conjunta confirma que os ganhos se somam.

## 3. Métricas e portão de não regressão

### 3a. Métricas
Por passo do agente: tokens de entrada, tokens em cache, 1º token, tok/s de geração, tokens de saída.
Por tarefa: passos, tokens totais, tempo total, **sucesso** (checagem objetiva).

**Tarefas fixas** (as do QA, conta de teste sem limite): T1 listar arquivos · T2 pesquisa de cotação na internet · T3 navegador integrado (G1) · T4 imagem detalhada · T5 Metabase em Docker (na VM do Juca, removido depois) · **T6' página única do currículo com limite de 12 passos** (o site completo de 35 min não cabe em 2 h). 2 repetições por tarefa; as métricas de velocidade e de fila, que são baratas, têm 3.
**Replay de sessão:** grava-se uma vez a sequência de requisições de uma sessão real (T6') e ela é reenviada ao servidor em cada configuração, sem executar ferramentas. Mede prefill, geração e fila de forma rápida e comparável.

### 3b. Suíte de não regressão (roda antes de qualquer deploy)
| Grupo | Verificação | Regra |
|---|---|---|
| Qualidade | sucesso nas 6 tarefas (2 repetições) | **igual ou melhor** que a base |
| Qualidade | 20 chamadas de ferramenta válidas (JSON correto, ferramenta certa) | 100% |
| Qualidade | 30 gerações de código com limite de 6 mil tokens: loops, estouros, código que não compila | 0 loops, 0 estouros, 100% compila |
| Qualidade | 20 perguntas de conversa com gabarito simples | acerto ≥ base |
| Velocidade | tok/s de geração a 2k, 10k e 25k de contexto, com 1 e 4 usuários | ≥ base − margem |
| Velocidade | 1º token do 1º passo e prefill (tok/s) | ≤ / ≥ base ± margem |
| Fila | benchmark da fila de 20 (3c) | ≥ base ± margem |
| Custo | tokens por tarefa | ≤ base |

**Margem de ruído (confirmada pelo Lucas):** o maior entre 5% e 2 desvios padrão da linha de base.
**Como decide:**
- Regressão em **Qualidade**: bloqueia, sem exceção, e volta ao estado anterior.
- Regressão em **Velocidade, Fila ou Custo**: só passa com troca explicitamente aprovada por você e registrada.
- Cada ciclo precisa **melhorar pelo menos uma métrica primária** (tokens por passo, tok/s a 25k, p95 da fila de 20, tempo da T6) fora da margem; senão não vira deploy e fica registrado como resultado negativo.
- A linha de base só é atualizada depois de um deploy aprovado.

### 3c. Benchmark da fila de 20
**O que o Lucas quer medir:** numa fila de 20 perguntas, **quanto tempo cada uma demora para começar a ser respondida**, isto é, até o **primeiro token** do stream. O usuário não pode ficar minutos sem receber nada.
- **Métrica principal (`espera_ate_1o_token`):** tempo desde o envio até o 1º token de conteúdo, raciocínio ou chamada de ferramenta. O comentário SSE `: acordando` que a fila manda para manter a conexão **não conta**, porque o usuário não vê resposta nenhuma. Registramos também o 1º byte de qualquer tipo, para saber quanto a conexão ficou calada.
- **Número que decide:** o **pior** dos 20 (máximo) e o p95. A "idade do pedido mais antigo ainda sem 1º token" é amostrada a cada 1 s para ver a curva da fila.
- **Limites do Lucas:** o ideal é o pior 1º token em **até 15 s** (meta de outubro); **mais de 3 min sem nenhum token é ruim e mais de 5 min é falha**. Se não houver alternativa melhor, aceita-se o que o custo-benefício permitir, mas nunca piorar em relação à linha de base.
- **Também medimos:** tempo total de cada resposta, tempo até esvaziar a fila (os 20 terminados), tok/s agregado e % de erro.
- **Caminho real:** llm-access → llm-queue → vLLM, com a chave de teste sem limite.
- **Formato:** rajada de 20 pedidos no mesmo instante; para a curva, 1, 4, 10 e 20 usuários virtuais (como no harness de outubro).
- **Mixes (por ordem de prioridade, dado o tempo):** **(D) reprodução de outubro: 20 chats simultâneos de ~13 a 17 mil tokens, a frio e a quente**; **(B) realista: 14 curtas + 4 de agente (~20k) + 2 médias (~10k)**; (A) 20 curtas; (C) 20 de agente (~20k). Nas 2 h, os candidatos rodam só D e B.
- **Linha de base de outubro** (skill `projetos`, `references/hermes_fila_llm.md`, 2×3090): fila de 20 quente em **42 a 55 s** no total (43 s com bf16 + `align`), a frio ~**104 s**; cliente isolado 4,5 s quente e 7,5 s frio; prefill de pico ~3,5 a 5,8 mil tok/s. A meta daquela campanha era o pior cliente em 15 s, que a 2×3090 não atingiu. O limite teórico de 20 chats quentes com cache perfeito naquele contexto é de ~27 s ou mais.
- **Por que a trilha A importa aqui:** a fila é limitada pelo prefill, proporcional ao contexto. Se o contexto do agente cair de ~25 mil para ~12 mil, o prefill da fila cai pela metade (estimativa, rótulo `calculated`); o mix D mede isso de verdade.
- O simulador `harness/eco/qsim.py` do repositório de benchmarks pode projetar capacidade a partir das curvas; esses números levam o rótulo `simulated`.

### 3d. Registro dos dados (para artigos)
Tudo em `new_ragente_private_stage/benchmarks/data/raw/segundo-cerebro/`, seguindo as convenções do repositório de outubro (bruto só de acréscimo, nunca regenerado):
- `RUNS.csv`: índice, uma linha por rodada.
- `achados.jsonl`: problemas e decisões, cada um com sintoma, causa, correção e evidência.
- `<run_id>/meta.json`: versão do app e do llm-queue, imagem e flags do vLLM, instância da GPU, parâmetros do teste.
- `<run_id>/requests.jsonl`: 1 linha por requisição, com os campos do harness de outubro (`request_id, level, kind, thinking, status, error, ttft_s, total_s, usage, n_chunks, chunk_times_s`) mais `ctx_tokens, cached_tokens, t_envio_s, t_fim_s, experimento, variante, repeticao`.
- `<run_id>/summary.csv`, `logs/` (trechos do vLLM e da ponte) e `evidencias/` (prints, vídeos, imagens).
- Nome da rodada: `<UTC>Z-<experimento>-<variante>-<6hex>`. Rótulos: `measured`, `calculated`, `simulated`, `external`, `not_tested`.
- Resultados negativos e falhas são guardados e valem artigo.
- Scripts de teste ficam em `harness/segundo-cerebro/` para reproduzir.
- Os dados já coletados em 06 e 07/11 (MTP, carga de usuários, penalidades, QA, mídia) entram como `seed-20261106_07`, com a confiabilidade de cada um marcada.
- Commit e push do repositório (privado) só com a sua ordem.

## 4. A janela de 2 horas na nossa GPU (sem gasto extra)

**Ninguém está online** (o Juca aguarda), então a produção pode ficar parada o tempo todo. Mesmo assim:
- Ligar `reserved` no llm-queue (`PUT /admin/api/gpu-config`) no início: o vigia **não religa** o vLLM sozinho e quem tentar usar recebe "GPU reservada" em vez de erro.
- **A instância da Vast fica sempre ligada.** Só o processo do vLLM para e volta, dentro dela. A máquina de mídia (`midia-gpu-4`) não é afetada.
- **Parada dura em 2:00.** Se qualquer coisa não estiver confirmada até 1:45, **a produção volta como está** (`start_vllm.sh` original, MTP n=2), com checagem de saúde, 1 conversa e 1 chamada de ferramenta, e `reserved` desligado.
- Enquanto a GPU mede, **eu escrevo as mudanças da trilha A** (o agente é um só e a GPU roda os testes em segundo plano).
- Os dados de cada fase são gravados na hora (seção 3d).

### 4a. Roteiro com tempo máximo por fase
| Tempo | Fase | O que acontece |
|---|---|---|
| 0:00 a 0:20 | **Preparação** | `reserved` ligado e testado; disco e wheel do fork conferidos; harness (fila, curva, replay, suíte rápida) e conjuntos de teste escritos; instrumentação do contexto (E0); gravar a sessão do replay |
| 0:20 a 0:50 | **Linha de base** (GPU limpa, em segundo plano) | suíte rápida, curva E1 só com MTP, fila de 20 (mix D frio e quente, e B), replay. Em paralelo: análise do E0, leitura do E2 e as mudanças E5 parte 1 e E6 |
| 0:50 a 1:20 | **Trilha B** (em segundo plano) | E1 sem MTP (um reinício do vLLM); se confirmar o problema e o E2 não achar a correção, **fork (E3) com limite de 25 min**; fila D e B no melhor candidato |
| 1:20 a 1:45 | **Trilha A** | com a configuração de produção do vLLM, medir as mudanças do Hermes (no máximo 2 variantes, uma por vez): suíte rápida e fila D |
| 1:45 a 2:00 | **Confirmação e deploy** | o que passou no portão vai à produção; teste final conjunto A+B se ambos passaram; checagem de saúde; `reserved` desligado; dados gravados |

### 4b. Se o tempo apertar, corta-se nesta ordem
1. E7 (subagentes), E8 e a parte 2 do E5 saem primeiro (viram a próxima rodada).
2. O fork (E3) só roda se o E1 mostrar o problema; a tentativa tem 25 min.
3. A trilha A fica com a variante de maior ganho esperado segundo o E0.
O que sempre fica: linha de base, E0, E1, fila D e B, restauração e dados gravados.

## 5. Experimentos, em ordem

### E0. Composição do contexto (sem parar nada) [ambas as trilhas]
- **Pergunta:** de que é feito o contexto do 1º passo e do passo 15?
- **Como:** na ponte (só em teste), somar tokens por parte: prompt do Hermes, definições de ferramentas, **índice de skills** (a lista `Skills e ferramentas:` que o app injeta), memória injetada, histórico do usuário, mensagens do assistente, saídas de ferramentas.
- **Decide:** a prioridade entre E4, E5, E6 e E7.

### E1. Curva de geração por contexto (0:20 a 1:20, linha de base e depois sem MTP) [Trilha B]
- **Pergunta:** a geração cai por causa do contexto em si ou por causa do MTP?
- **Como:** mesmo prompt, 2k, 10k, 25k e 50k tokens; 3 repetições; **com MTP (n=2) e com `NO_MTP`**; 1 usuário e 4.
- **Decisão:** se sem MTP ganhar acima de ~10 mil tokens, a hipótese do fork se confirma e a saída preferida é E3, **não** desligar o MTP.

### E2. A vLLM 0.30.0 já tem a correção? (sem parar nada) [Trilha B]
- Ler notas de versão e o código do backend de atenção atrás do caminho de verificação do MTP com divisão de KV (o fork usa `fwd_kvcache` com split-KV) e conferir se `vllm serve --help` lista `--prefix-match-unit`.
- Se já tem, o fork fica descartado.

### E3. Fork do vLLM, na nossa própria máquina (0:50 a 1:20, limite de 25 min; só se E1 mostrar o problema e E2 não achar a correção) [Trilha B]
- **O que é:** `avesed/vllm-ampere-optimized` v0.2, de terceiros, base vLLM **0.23.0**. Alega +60% (16k) e +106% (32k) de ganho do MTP no 27B com tensor parallel 2.
- **Como, sem trocar a imagem da instância:** instalar o wheel do release **numa venv separada** (`/venv/fork`), com o mesmo modelo AWQ em `/workspace/models/awq` e os mesmos parâmetros do `start_vllm.sh`. Alternativa: aplicar o patch `patches/fa2_kvcache_verify/` numa cópia da nossa vLLM. Cada tentativa com limite de 30 min; se não carregar, abandonar. A produção nunca é tocada.
- **Aprova se:** passa no portão (3b), geração a 25k ≥ 60 tok/s e sem regressão em contexto curto (≥ 100 tok/s).
- **Riscos:** base mais antiga que a nossa, mantido por uma pessoa só, wheel pode exigir outro torch (a venv isolada protege). Só vai à produção na confirmação final (1:45 a 2:00).

### E4. Compressão e poda de observações (1:20 a 1:45, só se o E0 mostrar histórico grande) [Trilha A]
- **Ideia:** manter a chamada da ferramenta e trocar a saída antiga por um marcador curto; grandes saídas viram arquivo e o contexto leva só o caminho.
- **O Hermes já faz parte disso:** a compressão dele primeiro poda resultados antigos sem chamar o modelo e só então resume o miolo. O limite padrão é 50% da janela (65 mil de 131 mil). O app tem `PODAR_EM` (~48 mil) e `COMPRIMIR_EM` (~72 mil) em `agent.js`; **verificar como esses valores chegam ao Hermes** antes de mexer.
- **Cuidados vindos da pesquisa:** a camada do gateway (85%) tem que ficar acima da do agente, senão comprime a todo turno; comprimir mais cedo é mais chamadas ao modelo, e aqui o modelo é a nossa única GPU.
- **Variantes:** (a) base; (b) limite menor de poda; (c) (b) + teto de 4 mil tokens por saída; (d) (c) + resumo ao passar de 30 mil.
- **Aprova se:** tokens por passo caem ≥ 40% e passa no portão (3b).

### E5. Prefixo estável e `--prefix-match-unit` [parte 1: Trilha A; parte 2: Trilha B]
- **Parte 1 (sem parar nada):** auditar o que muda a cada sessão no início do prompt (data e hora com segundos, memória injetada, ordem das ferramentas, índice de skills) e passar o volátil para o **fim**. Medir a taxa de acerto do cache antes e depois em 5 sessões novas seguidas. Lembrete da pesquisa: "cache suportado" não garante acerto, então medir.
- **Parte 2 (trilha B, só se E2 confirmar a opção):** `--prefix-match-unit 16` com `--mamba-cache-mode align`.
- **Aprova se:** taxa de acerto sobe ≥ 10 pontos ou o 1º token do 1º passo cai ≥ 30%, e passa no portão.

### E6. Toolsets e skills enxutos (maior ganho esperado no piso fixo) [Trilha A]
- **Ideia:** ligar só os toolsets que o fluxo usa e manter curto o índice de skills. Segundo a pesquisa, as ferramentas pesam de 2 a 15 mil tokens conforme os toolsets ligados.
- **Como:** com os números de E0, desligar toolsets não usados e podar o índice de skills; medir erro de escolha de ferramenta nas 6 tarefas. Não mexer no parser de ferramentas (`qwen3_xml`): 100% de acerto hoje, e trocá-lo só traria risco.
- **Aprova se:** o piso do 1º passo cai ≥ 30% sem perder ferramenta necessária.

### E7. Subagentes para isolar contexto (só se sobrar tempo) [Trilha A; a mais promissora para o contexto]
- **Ideia:** o Hermes tem a ferramenta `delegate_task`, que cria subagentes com contexto isolado e toolsets restritos (3 simultâneos por padrão). Tarefas longas como o site do currículo poderiam rodar num subagente, mantendo o contexto principal pequeno.
- **Teste:** a T6 com e sem delegação; medir tokens do agente principal, tempo e sucesso.
- **Cuidado:** subagentes em paralelo disputam a mesma GPU; começar com 1.

### E8. Higiene de memória e skills [Trilha A]
- A pesquisa recomenda memória pequena e curada e skills revisadas como código (as geradas sozinhas duplicam e envelhecem). Medir o tamanho da memória e do índice de skills em E0 e podar só o que o dado mostrar que pesa.

## 6. Ordem e prazos
Tudo dentro das **2 horas** da seção 4a. Lista de prioridade, se faltar tempo: linha de base, E0, E1, fila de 20, E6 e E5 parte 1, fork (E3), E4, E7, E8.

## 7. Metas
- Tokens por passo: de ~25 mil para **menos de 12 mil**.
- Geração a 25 mil de contexto: de ~33 para **60 tok/s ou mais**, mantendo o MTP.
- Tarefa T6' (página única do currículo): tempo e passos **menores** que a linha de base. O site completo de 35 min vira meta da rodada seguinte (**menos de 12 min**).
- Fila de 20: **nenhum usuário sem o 1º token por mais de 3 min** (limite duro; 5 min é falha) e o pior 1º token **melhor** que a linha de base, em todos os mixes. Para o mix D, a referência é 43 s quente e ~104 s frio no total (outubro) e o objetivo é o pior 1º token em **15 s**; a meta intermediária é fixada com a linha de base desta janela.
- Qualidade: **igual ou melhor** em tudo.

## 8. Regras
- Nada vai para produção sem passar no portão (3b) e sem o rollback descrito.
- Mudança de parâmetro ou de versão do vLLM só dentro da janela de 2 h, com o `start_vllm.sh` original e o `NO_MTP` como reversão rápida.
- **Custo extra zero.** Sem aluguel de GPU.
- Ao fim de cada experimento: tabela antes/depois, dados na pasta de benchmarks e nota na memória do projeto.

## 9. Pesquisa: o que o pessoal faz com o Hermes
- **Contexto grande é conhecido:** o prompt de sistema do Hermes passa de 20 mil tokens com ferramentas e é reenviado a cada turno; a mitigação principal é o cache de prompt. Itens voláteis devem ficar fora do prefixo em cache.
- **Cortar toolsets é uma alavanca direta** (2 a 15 mil tokens). Existe um plugin comunitário de roteamento de toolsets em teste que alega 60% a 80% menos, não verificado.
- **Compressão:** padrão em 50% da janela; gateway em 85%, nunca iguais; poda de resultados antigos antes do resumo. Resumo por modelo auxiliar mais barato é possível, mas aqui só temos um modelo.
- **Delegação** com contexto isolado e toolsets restritos; modelo caro no pai e barato nos filhos (relato anedótico).
- **Memória e skills:** curtas e revisadas; skills geradas sozinhas duplicam e envelhecem.
- **MCP:** cada servidor é uma fronteira de confiança; usar só os necessários.
- **Modelo local:** a documentação de terceiros recomenda no mínimo 32 mil tokens de contexto e 64 mil ou mais para raciocínio em vários passos (não confirmado na oficial). O parser de ferramentas deve casar com o modelo; para Qwen3 há guias com `hermes` e com `qwen3`, e o nosso `qwen3_xml` funciona.
- **Lacuna:** não achei nada sobre o modo ACP (que é o que usamos) nem casos de produção detalhados; confirmar nas páginas "Tips & Best Practices" e "Security" da documentação oficial.

## 10. Fontes
- Hermes, compressão e cache (oficial): https://hermes-agent.nousresearch.com/docs/developer-guide/context-compression-and-caching?full=true
- Hermes, montagem do prompt: https://hermesagent.org.cn/en/docs/developer-guide/prompt-assembly
- Integração Requesty com Hermes (prompt de 20 mil tokens): https://docs.requesty.ai/integrations/hermes
- mem0, compressão no Hermes e no Claude: https://mem0.ai/blog/how-hermes-and-claude-handle-context-compression-in-real-production-agents-(and-what-you-should-extract)
- Como a compactação funciona no Hermes: https://dev.to/john_lingi_f754bc63dd9ff1/how-compaction-works-in-hermes-agent-2m0m
- Hermes com modelos locais: https://fast.io/resources/hermes-agent-ollama-local-llm/
- Manus, engenharia de contexto: https://manus.im/en/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus
- Anthropic, gerenciamento de contexto: https://www.anthropic.com/news/context-management
- Anthropic, advanced tool use: https://anthropic.com/engineering/advanced-tool-use
- JetBrains, "The Complexity Trap": https://arxiv.org/pdf/2508.21433
- vLLM, receita Qwen3.5: https://docs.vllm.ai/projects/recipes/en/stable/Qwen/Qwen3.5.html
- Fork `avesed/vllm-ampere-optimized` v0.2: https://github.com/avesed/vllm-ampere-optimized/releases/tag/v0.2
- vLLM PR #46384 (`--prefix-match-unit`): https://github.com/vllm-project/vllm/pull/46384
- Prefix caching em modelos híbridos (LMCache): https://docs.lmcache.ai/mp/hybrid_models.html

## 11. Gravar na pasta de benchmarks tudo que já foi testado

Regra: **nada do que medimos se perde.** Todo teste de qualquer dia vai para `new_ragente_private_stage/benchmarks`, no formato da seção 3d, e a skill `projetos` aponta para essa pasta e conta o que foi testado em cada dia.

### 11a. Dias 06 e 07/11/2026 (já gravados em 07/11)
Pasta: `data/raw/segundo-cerebro/seed-20261106_07/`. Scripts em `harness/segundo-cerebro/`.

| Dado | Arquivo | Conteúdo |
|---|---|---|
| MTP | `mtp_ab.csv` | tok/s sem MTP e com MTP n=1, 2 e 3 (2×3090, contexto curto), aceitação média, divergência de texto |
| Carga de usuários | `carga_usuarios.csv` | 1, 3 e 10 usuários simultâneos, contexto de ~0,5k a ~21k tokens, antes e depois do limite de paralelismo 3 para 12 |
| Penalidades | `penalidades.csv` | efeito de `presence_penalty` e `repetition_penalty` em código por ferramenta e em conversa |
| QA geral | `qa_tempos.csv`, `qa_raw/`, `evidencias/qa_telas/` | tempo, passos e resultado de cada pedido, local e web, em cada versão do app |
| Mídia | `midia.csv`, `evidencias/midia/` | Flux, LTX, Wan 2.2 (5 s e 15 s) e troca de personagem (Openjutsu) |
| Achados | `achados.jsonl` | 13 problemas com sintoma, causa, correção e evidência |

### 11b. O que ainda falta gravar
1. **Dias anteriores:** varrer e registrar (com a data) o que foi testado e ainda não está na pasta. Fontes a percorrer: `second-brain/specs/TESTES_SKILLS_NOITE.md` e `HANDOFF_2026-11-06.md`; `qwen-abliterated-api/reports/` (`longctx`, `ops`, `quality`, `refusal`, `runs`), `docs/BENCHMARKS.md`, `docs/RESULTS.md` e `docs/DECISOES.md`; os testes em `qwen-abliterated-api/tests/`; e a memória do projeto (por exemplo, testes de 03 a 05/11: hub de mídia, 3090, skills, limites de clipe de vídeo). O que for da campanha de outubro já está na pasta e só precisa de índice.
2. **Daqui para frente:** cada experimento desta spec grava a sua rodada (3d) no mesmo dia.
3. **Conferir** que `RUNS.csv` tem uma linha por rodada e que cada rodada tem `meta.json`.

### 11c. Skill `projetos`
A skill `projetos` (catálogo da campanha de benchmark de GPU e IA) ganha uma seção "Segundo Cérebro, produção (nov/2026)" que, **por dia**, diz: o que foi testado, o que mediu e **onde estão os dados** (`benchmarks/data/raw/segundo-cerebro/...`). Atualizar essa seção a cada rodada nova. O `sync-skills` envia a skill para o repositório `personal-skills`.

## 12. Resultado da janela de 07/11/2026 (12:58 a 14:58 BRT)

Dados completos: repositório benchmarks, `data/raw/segundo-cerebro/20261107-janela2h/` (`meta.json`, `resultados_*.csv`, `runs/`).

**Decisão da trilha B (servidor): vLLM 0.30.0 oficial, SEM MTP, com `--prefix-match-unit 16`.** Está em produção na hold 58831117 (`/workspace/NO_MTP` + `start_vllm.sh`, backup `start_vllm.sh.bak_20261107`). O dono removeu a regra de manter o MTP ligado: vale a combinação mais rápida.

Decode, tok/s, 1 usuário:

| Contexto | MTP n=2 (antiga) | Sem MTP | Fork + MTP n=2 | MTP n=1 | MTP n=3 |
|---|---|---|---|---|---|
| 2 mil | 78,8 | 71,1 | n/m | 75,9 | 76,2 |
| 10 mil | 52,7 | 68,6 | 72,4 | 51,0 | 56,2 |
| 25 mil | 35,4 | 65,3 | 65,0 | 30,7 | 33,1 |
| 50 mil | 23,2 | 61,5 | 54,7 | n/m | n/m |

4 usuários a 25 mil tokens, tok/s por usuário: MTP n=2 18,4; MTP n=1 17,5; fork 11,8; sem MTP 27,0; **sem MTP + prefix-match-unit 16: 32,7**.

Fila de pedidos frios, pior espera até o 1º token: 20×15k frios 288 s → 234 s com prefix-match-unit; 20 com prefixo compartilhado 60,3 → 53,2 s; mix realista (14 curtas, 4 agentes de 20k, 2 de 10k) 23 s na baseline. Fila de 20 frios continua acima do limite de 180 s: só cai com prefixo compartilhado ou contexto menor.

Qualidade (portão): sem MTP empata ou supera a baseline (conversa 19/20 contra 17/20 com gabarito diferente, ferramentas 19/20 nas duas, código 25/30 nas duas, 0 estouros contra 2).

**Não testado (para a próxima janela):** trilha A com LLM real (tarefas A1 a A6 e a VM do Juca), mais de 4 usuários, ngram, KV fp8, `max-num-seqs`/`max-num-batched-tokens`, fila P com prefix-match-unit (rodada invalidada por reinício meu), qualidade do fork. Código da trilha A (E5.1 prefixo estável, knobs E4 e E6 por variável de ambiente) está commitado mas **sem nova versão do app**, porque não foi medido.
