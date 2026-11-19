// EXEMPLO de filme escrito com o kit (história de terror, ~21 s). Serve de modelo para a IA.
// Cada plano: SHOTS.push({ start, end, tr, draw(ctx, lt, t, dur) { ... } })  — lt = tempo dentro do plano, t = tempo do filme.
// Regras: um acontecimento por plano; a ação cai na palavra; câmera se move em todo plano; nada de cartão de texto.
const SHOTS = [];

// 1) gancho: "Toda noite, às 3 da manhã, a porta do armário do Lucas abria sozinha."
SHOTS.push({ start: 0, end: 4.2, tr: 'whip', draw(ctx, lt, t, dur) {
  const cam = camera(lt, dur, { tipo: 'empurra', foco: [400, 980] });
  cenario('quarto_noite', ctx, t, cam, { armario: kf(lt, [[1.6, 0], [3.2, .9]]), abajur: 0, olhosArmario: lt > 3.0 });
  ator(ctx, t, lt, { quem: 'heroi', x: 560, y: CHAO - 230, s: 380, acao: 'deitado', humor: 'normal' });
  relogio(ctx, 905, CHAO - 270, 40, 3, 0, '#ffe9a0');
  vinheta(ctx, .55);
} });
// 2) "Ele pegou a lanterna e foi ver de perto."
SHOTS.push({ start: 4.2, end: 7.6, tr: 'cut', draw(ctx, lt, t, dur) {
  const cam = camera(lt, dur, { tipo: 'pan', de: 700, para: 420, foco: [540, 960] });
  cenario('quarto_noite', ctx, t, cam, { armario: .9, abajur: 0 });
  darkness(ctx, .45); applyCam(ctx, cam, 1);
  ator(ctx, t, lt, { quem: 'heroi', acao: 'andar', x0: 820, x1: 470, de: 0, ate: 2.6, segura: 'lanterna', humor: 'medo' });
  vinheta(ctx, .6);
} });
// 3) "Lá dentro, dois olhos amarelos olhavam pra ele."
SHOTS.push({ start: 7.6, end: 10.4, tr: 'cut', draw(ctx, lt, t, dur) {
  const cam = camera(lt, dur, { tipo: 'zoom_rapido', foco: [200, 640], zoom: 1.6 });
  cenario('quarto_noite', ctx, t, cam, { armario: 1, abajur: 0, olhosArmario: true });
  darkness(ctx, .35); vinheta(ctx, .8);
} });
// 4) susto: "Ele gritou..." — tremor, flash vermelho, ator assustado
SHOTS.push({ start: 10.4, end: 13.0, tr: 'whip', draw(ctx, lt, t, dur) {
  const cam = camera(lt, dur, { tipo: 'treme', foco: [540, 960], forca: 30 });
  cenario('quarto_noite', ctx, t, cam, { armario: 1, abajur: 0 });
  ator(ctx, t, lt, { quem: 'heroi', x: 600, acao: 'assustado', de: .1, segura: 'lanterna', dir: -1 });
  flash(ctx, lt, 0, '200,20,20', .35); vinheta(ctx, .6);
} });
// 5) virada: "...e o gato saiu de lá, todo bravo, com a cara cheia de poeira."
SHOTS.push({ start: 13.0, end: 17.0, tr: 'cut', draw(ctx, lt, t, dur) {
  const cam = camera(lt, dur, { tipo: 'afasta', foco: [540, 1000] });
  cenario('quarto_noite', ctx, t, cam, { armario: 1, abajur: 1 });
  // gato desenhado na hora (corpo + orelhas + rabo), andando para a direita
  const gx = lerp(220, 640, clamp(lt / 3)), gy = CHAO - 40;
  ctx.save(); ctx.translate(gx, gy);
  ellipse(ctx, 0, -60, 90, 55); fillStroke(ctx, '#4a4a52', 6);
  circle(ctx, 80, -120, 48); fillStroke(ctx, '#4a4a52', 6);
  path(ctx, [[50, -155], [62, -205], [85, -165]]); fillStroke(ctx, '#4a4a52', 5); path(ctx, [[95, -165], [115, -205], [120, -150]]); fillStroke(ctx, '#4a4a52', 5);
  ellipse(ctx, 68, -125, 8, 10); ctx.fillStyle = '#ffe04a'; ctx.fill(); ellipse(ctx, 96, -125, 8, 10); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-85, -70); ctx.quadraticCurveTo(-160, -150 + Math.sin(t * 6) * 20, -120, -200); ctx.lineWidth = 14; ctx.strokeStyle = '#4a4a52'; ctx.stroke();
  for (const lx of [-50, -10, 30, 60]) line(ctx, lx, -20, lx + Math.sin(t * 10 + lx) * 8, 10, 12, '#4a4a52');
  ctx.restore();
  puff(ctx, gx + 80, gy - 150, 50, t, '#c9c2b4', 4, clamp(1 - lt / 1.2));
  ator(ctx, t, lt, { quem: 'heroi', x: 860, acao: 'parado', humor: 'desconfiado', dir: -1 });
} });
// 6) final: "Desde então, o Lucas dorme de porta fechada. Você também?"
SHOTS.push({ start: 17.0, end: 21.0, tr: 'fade', draw(ctx, lt, t, dur) {
  const cam = camera(lt, dur, { tipo: 'empurra', foco: [560, 1000] });
  cenario('quarto_noite', ctx, t, cam, { armario: kf(lt, [[0, 1], [1.2, 0]]), abajur: 1 });
  ator(ctx, t, lt, { quem: 'heroi', x: 560, y: CHAO - 230, s: 380, acao: 'deitado', humor: 'feliz' });
  vinheta(ctx, .5);
} });
