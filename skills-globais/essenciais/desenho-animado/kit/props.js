// ---------- objetos de cena (Viralizaí) ----------
// trava de escala: a IA às vezes passa a escala em pixels (ex.: 380). Acima de 4 vira pixels/400; sempre entre .2 e 3.
function _s(s, natural = 400) { s = Number(s); if (!isFinite(s) || s <= 0) return 1; if (s > 4) s = s / natural; return clamp(s, .2, 3); }
// Todos em coordenadas do mundo (1080x1920), x,y = base do objeto no chão (ou centro, quando dito). s = escala (1 = tamanho natural).

function porta(ctx, x, y, s = 1, abre = 0, cor = '#6b4026', escuroAtras = true, luzAtras = 0) {
  s = _s(s);
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const w = 220, h = 440;
  rrect(ctx, -w / 2 - 20, -h - 20, w + 40, h + 20, 6); fillStroke(ctx, '#3a2418', 6);
  rrect(ctx, -w / 2, -h, w, h, 4); ctx.fillStyle = escuroAtras ? '#06050a' : '#e8e0c8'; ctx.fill();
  if (luzAtras > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,220,150,${.6 * luzAtras})`; ctx.fillRect(-w / 2, -h, w, h); ctx.restore(); }
  const aw = w * Math.cos(clamp(abre) * 1.3);
  rrect(ctx, -w / 2, -h, aw, h, 4); fillStroke(ctx, cor, 6);
  if (aw > 40) { rrect(ctx, -w / 2 + aw * .15, -h + 40, aw * .7, 150, 4); fillStroke(ctx, null, 4, 'rgba(0,0,0,.35)'); rrect(ctx, -w / 2 + aw * .15, -h + 230, aw * .7, 170, 4); fillStroke(ctx, null, 4, 'rgba(0,0,0,.35)');
    circle(ctx, -w / 2 + aw - 24, -h / 2, 11); ctx.fillStyle = '#e8c04a'; ctx.fill(); }
  ctx.restore();
}
function cama(ctx, x, y, s = 1, cor = '#d9d4ea') {
  s = _s(s);
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  rrect(ctx, -240, -210, 480, 190, 16); fillStroke(ctx, '#6b4630', 6); rrect(ctx, -250, -300, 60, 300, 10); fillStroke(ctx, '#5c3a26', 6);
  rrect(ctx, -210, -235, 440, 70, 24); fillStroke(ctx, cor, 5); rrect(ctx, -185, -265, 120, 50, 20); fillStroke(ctx, '#f4f0fb', 5);
  ctx.restore();
}
function mesa(ctx, x, y, w = 420, cor = '#a8703e') {
  rrect(ctx, x - w / 2, y - 220, w, 32, 8); fillStroke(ctx, cor, 5); line(ctx, x - w / 2 + 30, y - 188, x - w / 2 + 30, y, 12); line(ctx, x + w / 2 - 30, y - 188, x + w / 2 - 30, y, 12);
}
function cadeira(ctx, x, y, s = 1, cor = '#8a5a2c') {
  s = _s(s);
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  rrect(ctx, -70, -150, 140, 24, 6); fillStroke(ctx, cor, 5); rrect(ctx, 50, -330, 22, 200, 6); fillStroke(ctx, cor, 5);
  line(ctx, -60, -126, -60, 0, 9); line(ctx, 60, -126, 60, 0, 9); ctx.restore();
}
function vela(ctx, x, y, s = 1, t = 0, acesa = 1) {
  s = _s(s);
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  rrect(ctx, -16, -90, 32, 90, 6); fillStroke(ctx, '#f2ecd8', 4);
  if (acesa > 0) { const fl = 1 + Math.sin(t * 19) * .08 + Math.sin(t * 7) * .06;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(0, -110, 4, 0, -110, 360); g.addColorStop(0, `rgba(255,190,90,${.55 * acesa})`); g.addColorStop(1, 'rgba(255,150,60,0)'); ctx.fillStyle = g; ctx.fillRect(-400, -500, 800, 800); ctx.restore();
    ctx.beginPath(); ctx.moveTo(0, -140 * fl); ctx.quadraticCurveTo(14, -105, 0, -92); ctx.quadraticCurveTo(-14, -105, 0, -140 * fl); ctx.fillStyle = '#ffd36a'; ctx.fill(); }
  ctx.restore();
}
// lanterna na mão: use como prop do ator (segura: 'lanterna') ou solta. O cone vai na direção ang (rad, 0 = para a direita).
function coneLuz(ctx, x, y, ang, alcance = 900, abertura = .32, a = 1, cor = '255,240,200') {
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(x, y); ctx.rotate(ang);
  const g = ctx.createLinearGradient(0, 0, alcance, 0); g.addColorStop(0, `rgba(${cor},${.55 * a})`); g.addColorStop(1, `rgba(${cor},0)`);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(alcance, -alcance * abertura); ctx.lineTo(alcance, alcance * abertura); ctx.closePath(); ctx.fillStyle = g; ctx.fill(); ctx.restore();
}
function lanternaMao(ctx, k, h, ang, side) {
  // desenhada no espaço do boneco (unidade = altura); usar via ator({segura:'lanterna'})
  ctx.save(); ctx.translate(h[0], h[1]); ctx.rotate(-Math.PI / 2 + .3);
  rrect(ctx, -.012, -.01, .024, .07, .008); fillStroke(ctx, '#3a3d48', .01); rrect(ctx, -.018, .055, .036, .03, .006); fillStroke(ctx, '#ffe9a0', .008); ctx.restore();
}
function celular(ctx, x, y, s = 1, tela = '#3ea6ee', conteudo = null, ang = 0) {
  s = _s(s);
  // conteudo: {texto:'...'} ou {img:IMG.chave} ou função(ctx,w,h)
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s);
  rrect(ctx, -90, -180, 180, 360, 26); fillStroke(ctx, '#1d1f26', 6);
  ctx.save(); rrect(ctx, -78, -164, 156, 328, 16); ctx.clip(); ctx.fillStyle = tela; ctx.fillRect(-80, -170, 160, 340);
  if (conteudo && conteudo.img) imagemCobre(ctx, conteudo.img, -78, -164, 156, 328);
  else if (conteudo && conteudo.texto) { rrect(ctx, -66, -40, 132, 80, 14); ctx.fillStyle = '#fff'; ctx.fill(); quebraTexto(ctx, conteudo.texto, 0, 0, 120, 20, '#222'); }
  else if (typeof conteudo === 'function') conteudo(ctx, 156, 328);
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(0, 0, 40, 0, 0, 420); g.addColorStop(0, 'rgba(140,190,255,.22)'); g.addColorStop(1, 'rgba(140,190,255,0)'); ctx.fillStyle = g; ctx.fillRect(-450, -450, 900, 900); ctx.restore();
  ctx.restore();
}
function tv(ctx, x, y, s = 1, img = null, ligada = 1, t = 0) {
  s = _s(s);
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  rrect(ctx, -230, -330, 460, 300, 18); fillStroke(ctx, '#222630', 8);
  ctx.save(); rrect(ctx, -205, -305, 410, 250, 8); ctx.clip();
  if (!ligada) { ctx.fillStyle = '#0a0b0e'; ctx.fillRect(-210, -310, 420, 260); }
  else if (img) imagemCobre(ctx, img, -205, -305, 410, 250);
  else { const R = rng(Math.floor(t * 24)); for (let i = 0; i < 900; i++) { ctx.fillStyle = R() > .5 ? '#ddd' : '#333'; ctx.fillRect(-205 + R() * 410, -305 + R() * 250, 6, 4); } }
  ctx.fillStyle = 'rgba(255,255,255,.06)'; for (let yy = -305; yy < -55; yy += 6) ctx.fillRect(-205, yy, 410, 2);
  ctx.restore();
  line(ctx, -80, -30, -120, 0, 10); line(ctx, 80, -30, 120, 0, 10);
  ctx.restore();
}
// foto real (raspada da web) num porta-retrato / polaroide / quadro. img = IMG.chave
function fotoQuadro(ctx, x, y, w, h, img, estilo = 'polaroide', ang = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  if (estilo === 'polaroide') { rrect(ctx, -w / 2 - 18, -h / 2 - 18, w + 36, h + 80, 6); fillStroke(ctx, '#f7f5ee', 5); }
  else { rrect(ctx, -w / 2 - 26, -h / 2 - 26, w + 52, h + 52, 8); fillStroke(ctx, '#7a4f2c', 6); }
  ctx.save(); rrect(ctx, -w / 2, -h / 2, w, h, 3); ctx.clip(); if (img) imagemCobre(ctx, img, -w / 2, -h / 2, w, h); else { ctx.fillStyle = '#556'; ctx.fillRect(-w / 2, -h / 2, w, h); } ctx.restore();
  ctx.lineWidth = 3; ctx.strokeStyle = INK; rrect(ctx, -w / 2, -h / 2, w, h, 3); ctx.stroke();
  ctx.restore();
}
function imagemCobre(ctx, img, x, y, w, h) {
  if (!img || !img.width) { ctx.fillStyle = '#556'; ctx.fillRect(x, y, w, h); return; }
  const k = Math.max(w / img.width, h / img.height), iw = img.width * k, ih = img.height * k;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}
function quebraTexto(ctx, s, x, y, larg, tam, cor = '#fff', fonte = 'Poppins') {
  ctx.font = `700 ${tam}px ${fonte}`; const ps = String(s).split(' '); const linhas = []; let l = '';
  for (const p of ps) { const n = l ? l + ' ' + p : p; if (ctx.measureText(n).width > larg && l) { linhas.push(l); l = p; } else l = n; }
  if (l) linhas.push(l);
  linhas.forEach((ln, i) => text(ctx, ln, x, y + (i - (linhas.length - 1) / 2) * tam * 1.2, tam, cor, null, 0, fonte, 700));
}
function carro(ctx, x, y, s = 1, cor = '#e0392f', t = 0, farol = 0, flip = 1) {
  s = _s(s);
  ctx.save(); ctx.translate(x, y); ctx.scale(s * flip, s);
  const rod = (rx) => { ctx.save(); ctx.translate(rx, -40); ctx.rotate(t * 8); circle(ctx, 0, 0, 44); fillStroke(ctx, '#222', 6); circle(ctx, 0, 0, 18); fillStroke(ctx, '#bbb', 4); line(ctx, -18, 0, 18, 0, 4, '#777'); ctx.restore(); };
  ctx.beginPath(); ctx.moveTo(-250, -40); ctx.lineTo(-250, -120); ctx.quadraticCurveTo(-240, -150, -180, -155); ctx.lineTo(-110, -230); ctx.lineTo(110, -230); ctx.lineTo(180, -155); ctx.quadraticCurveTo(250, -150, 260, -110); ctx.lineTo(260, -40); ctx.closePath(); fillStroke(ctx, cor, 6);
  path(ctx, [[-95, -215], [-10, -215], [-10, -160], [-150, -160]]); fillStroke(ctx, '#a8d8f0', 4); path(ctx, [[10, -215], [100, -215], [160, -160], [10, -160]]); fillStroke(ctx, '#a8d8f0', 4);
  rod(-150); rod(160);
  rrect(ctx, 236, -128, 26, 22, 6); fillStroke(ctx, '#fff6c0', 4);
  if (farol > 0) coneLuz(ctx, 262, -116, 0, 900, .18, farol);
  ctx.restore();
}
function arvore(ctx, x, y, s = 1, cor = '#3fa35b') {
  s = _s(s);
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  rrect(ctx, -25, -340, 50, 340, 10); fillStroke(ctx, '#8a5a2c', 5);
  for (const [dx, dy, r] of [[-60, -330, 110], [60, -360, 120], [0, -440, 130], [-110, -420, 90], [110, -450, 90]]) { circle(ctx, dx, dy, r); fillStroke(ctx, cor, 5); }
  ctx.restore();
}
function relogio(ctx, x, y, r = 80, horas = 3, minutos = 0, cor = '#fff') {
  circle(ctx, x, y, r); fillStroke(ctx, cor, 6);
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; line(ctx, x + Math.sin(a) * r * .8, y - Math.cos(a) * r * .8, x + Math.sin(a) * r * .9, y - Math.cos(a) * r * .9, 4); }
  const am = minutos / 60 * TAU, ah = (horas % 12 + minutos / 60) / 12 * TAU;
  line(ctx, x, y, x + Math.sin(ah) * r * .5, y - Math.cos(ah) * r * .5, 8); line(ctx, x, y, x + Math.sin(am) * r * .75, y - Math.cos(am) * r * .75, 5);
}
function dinheiro(ctx, x, y, maços = 5, s = 1) {
  s = _s(s);
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  for (let i = 0; i < maços; i++) { rrect(ctx, -90 + (i % 2) * 6, -30 - i * 26, 180, 30, 4); fillStroke(ctx, '#7cc76a', 4); rrect(ctx, -20 + (i % 2) * 6, -30 - i * 26, 40, 30, 2); ctx.fillStyle = '#e8d06a'; ctx.fill(); }
  ctx.restore();
}
function caixa(ctx, x, y, w = 200, h = 160, cor = '#c28a4e', rotulo = '') { drawCrate(ctx, x, y, w, h, 0, rotulo); }
function livro(ctx, x, y, s = 1, cor = '#7a4bc4', aberto = 0) {
  s = _s(s);
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  if (aberto) { path(ctx, [[-120, -10], [0, 0], [0, -150], [-120, -160]]); fillStroke(ctx, '#f6f1e2', 5); path(ctx, [[120, -10], [0, 0], [0, -150], [120, -160]]); fillStroke(ctx, '#f6f1e2', 5);
    for (let i = 0; i < 5; i++) { line(ctx, -100, -130 + i * 22, -20, -124 + i * 22, 3, '#888'); line(ctx, 20, -124 + i * 22, 100, -130 + i * 22, 3, '#888'); } }
  else { rrect(ctx, -90, -40, 180, 40, 6); fillStroke(ctx, cor, 5); ctx.fillStyle = '#f6f1e2'; ctx.fillRect(-84, -10, 168, 8); }
  ctx.restore();
}
// silhueta misteriosa (vulto) com olhos brilhando
function vulto(ctx, x, y, s = 500, a = 1, t = 0, olhos = '#ff3b3b') {
  ctx.save(); ctx.globalAlpha = a;
  drawStick(ctx, { x, y, s, sil: '#030305', shadow: false, eyesGlow: true, face: { eyes: 'normal' }, headTilt: Math.sin(t * .8) * .05, arms: { L: [.15, -.05], R: [.15, -.05] } });
  ctx.globalCompositeOperation = 'lighter';
  for (const dx of [-.072, .072]) { const g = ctx.createRadialGradient(x + dx * s, y - .77 * s, 2, x + dx * s, y - .77 * s, s * .09); g.addColorStop(0, olhos); g.addColorStop(1, 'rgba(255,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x + dx * s - s * .1, y - .87 * s, s * .2, s * .2); }
  ctx.restore();
}
function fantasma(ctx, x, y, s = 1, t = 0, a = .85) {
  s = _s(s);
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y + Math.sin(t * 2) * 18); ctx.scale(s, s);
  ctx.beginPath(); ctx.moveTo(-120, 0); ctx.lineTo(-120, -200); ctx.arc(0, -200, 120, Math.PI, 0);
  ctx.lineTo(120, 0); for (let i = 0; i < 5; i++) { const xx = 120 - (i + 1) * 48; ctx.quadraticCurveTo(xx + 24, 30 + Math.sin(t * 6 + i) * 14, xx, 0); }
  ctx.closePath(); ctx.fillStyle = '#f1f3f8'; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke();
  ellipse(ctx, -42, -210, 18, 28); ctx.fillStyle = INK; ctx.fill(); ellipse(ctx, 42, -210, 18, 28); ctx.fill(); ellipse(ctx, 0, -140, 22, 30); ctx.fill();
  ctx.restore();
}
function balao(ctx, x, y, texto, w = 420, lado = 1) {
  // balão de fala/pensamento curto (use pouco: a animação conta a história)
  rrect(ctx, x - w / 2, y - 80, w, 120, 30); fillStroke(ctx, '#fff', 6);
  path(ctx, [[x - 30 * lado, y + 38], [x - 80 * lado, y + 100], [x + 10 * lado, y + 38]]); fillStroke(ctx, '#fff', 6);
  ctx.fillStyle = '#fff'; ctx.fillRect(x - 40, y + 30, 70, 14);
  quebraTexto(ctx, texto, x, y - 20, w - 50, 40, INK);
}
