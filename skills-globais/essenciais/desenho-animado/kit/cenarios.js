// ---------- cenários prontos (Viralizaí) ----------
// Mundo 1080x1920. Chão padrão CHAO = 1250 (pés dos personagens). Legenda mora na faixa y 1340-1460: nada importante ali.
// Todo cenário: cenario('nome', ctx, t, cam, opcoes). Desenha o fundo inteiro com paralaxe (applyCam com profundidade)
// e deixa a câmera aplicada no plano dos atores (profundidade 1) ao terminar.
const CHAO = 1250;
const CAM0 = () => ({ x: 540, y: 960, z: 1, r: 0 });

function lua(ctx, x, y, r, t, cor = '#f4f1dc') {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, r * .5, x, y, r * 4); g.addColorStop(0, 'rgba(220,230,255,.35)'); g.addColorStop(1, 'rgba(200,210,255,0)');
  ctx.fillStyle = g; ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8); ctx.restore();
  circle(ctx, x, y, r); ctx.fillStyle = cor; ctx.fill();
  ctx.fillStyle = 'rgba(160,160,140,.35)'; circle(ctx, x - r * .3, y - r * .2, r * .18); ctx.fill(); circle(ctx, x + r * .25, y + r * .3, r * .12); ctx.fill(); circle(ctx, x + r * .35, y - r * .35, r * .08); ctx.fill();
}
function estrelas(ctx, n, seed, y1 = 1000, t = 0) {
  const R = rng(seed);
  for (let i = 0; i < n; i++) { const x = R() * 1600 - 260, y = R() * (y1 + 400) - 400, r = 1.5 + R() * 2.5, pis = .5 + .5 * Math.sin(t * (1 + R() * 3) + i);
    ctx.globalAlpha = .4 + .6 * pis; circle(ctx, x, y, r); ctx.fillStyle = '#fff'; ctx.fill(); }
  ctx.globalAlpha = 1;
}
function chaoPerspectiva(ctx, y, cor, linhas, n = 14, x0 = -800, x1 = 1880, fundo = 2600) {
  ctx.fillStyle = cor; ctx.fillRect(x0, y, x1 - x0, fundo - y);
  for (let i = 0; i < n; i++) { const bx = x0 + i * (x1 - x0) / (n - 1); line(ctx, 540 + (bx - 540) * .25, y, bx, fundo, 3, linhas); }
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x0, y, x1 - x0, 16);
}
function predio(ctx, x, base, w, h, cor, janelas, seed, acesas = .35) {
  rrect(ctx, x, base - h, w, h + 4, 4); fillStroke(ctx, cor, 4);
  const R = rng(seed);
  for (let yy = base - h + 30; yy < base - 40; yy += 56) for (let xx = x + 18; xx < x + w - 30; xx += 46) {
    const on = R() < acesas; rrect(ctx, xx, yy, 24, 32, 3); ctx.fillStyle = on ? janelas : 'rgba(0,0,0,.35)'; ctx.fill();
  }
}
function arvoreSilhueta(ctx, x, base, h, cor, seed) {
  const R = rng(seed); ctx.fillStyle = cor;
  ctx.beginPath(); ctx.moveTo(x - h * .04, base); ctx.lineTo(x - h * .02, base - h * .55); ctx.lineTo(x + h * .02, base - h * .55); ctx.lineTo(x + h * .04, base); ctx.fill();
  for (let i = 0; i < 6; i++) { const yy = base - h * (.45 + i * .1), ww = h * (.32 - i * .045); ctx.beginPath(); ctx.moveTo(x - ww, yy + h * .08); ctx.lineTo(x, yy - h * .12); ctx.lineTo(x + ww, yy + h * .08); ctx.closePath(); ctx.fill(); }
  // galhos tortos
  ctx.strokeStyle = cor; ctx.lineWidth = h * .012; ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) { const yy = base - h * (.3 + R() * .3); ctx.beginPath(); ctx.moveTo(x, yy); ctx.quadraticCurveTo(x + (R() - .5) * h * .5, yy - h * .05, x + (R() - .5) * h * .6, yy - h * .12); ctx.stroke(); }
}
function arvoreGalhos(ctx, x, base, h, cor, seed) {
  // árvore seca de terror: tronco e galhos retorcidos
  const R = rng(seed); ctx.strokeStyle = cor; ctx.lineCap = 'round';
  const galho = (x0, y0, ang, len, w, d) => {
    if (d > 5 || len < 8) return;
    const x1 = x0 + Math.sin(ang) * len, y1 = y0 - Math.cos(ang) * len;
    ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2 + (R() - .5) * len * .3, (y0 + y1) / 2, x1, y1); ctx.stroke();
    galho(x1, y1, ang - .35 - R() * .4, len * (.62 + R() * .15), w * .62, d + 1);
    galho(x1, y1, ang + .3 + R() * .4, len * (.6 + R() * .15), w * .62, d + 1);
  };
  galho(x, base, (R() - .5) * .15, h * .38, h * .06, 0);
}
function cerca(ctx, y, cor, x0 = -300, x1 = 1400) {
  for (let x = x0; x < x1; x += 46) { path(ctx, [[x, y], [x + 8, y - 120], [x + 16, y]]); ctx.fillStyle = cor; ctx.fill(); }
  ctx.fillStyle = cor; ctx.fillRect(x0, y - 90, x1 - x0, 8); ctx.fillRect(x0, y - 40, x1 - x0, 8);
}
function lapide(ctx, x, y, s, cor = '#7d8290', texto = 'RIP', inclina = 0) {
  s = (typeof _s === 'function') ? _s(s) : s;
  ctx.save(); ctx.translate(x, y); ctx.rotate(inclina); ctx.scale(s, s);
  ctx.beginPath(); ctx.moveTo(-60, 0); ctx.lineTo(-60, -110); ctx.arc(0, -110, 60, Math.PI, 0); ctx.lineTo(60, 0); ctx.closePath(); fillStroke(ctx, cor, 6);
  ctx.save(); ctx.clip(); ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(20, -200, 60, 220); ctx.restore();
  text(ctx, texto, 0, -105, 30, 'rgba(30,30,40,.7)', null, 0, 'Poppins', 700);
  line(ctx, -36, -70, 36, -70, 4, 'rgba(30,30,40,.4)');
  ellipse(ctx, 0, 4, 80, 12); ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fill();
  ctx.restore();
}
function janela(ctx, x, y, w, h, ceu, t, o = {}) {
  // janela com moldura, vidro com o céu, cortinas opcionais
  ctx.save(); rrect(ctx, x, y, w, h, 6); ctx.clip();
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, ceu[0]); g.addColorStop(1, ceu[1]); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  if (o.lua) lua(ctx, x + w * .68, y + h * .3, w * .12, t);
  if (o.sombra) { ctx.globalAlpha = o.sombra; drawStick(ctx, { x: x + w * .4 + Math.sin(t) * 6, y: y + h * 1.05, s: h * .9, sil: '#05060a', shadow: false, eyesGlow: true, face: { eyes: 'normal' } }); ctx.globalAlpha = 1; }
  if (o.chuva) { ctx.strokeStyle = 'rgba(200,220,255,.4)'; ctx.lineWidth = 2; const R = rng(3); for (let i = 0; i < 25; i++) { const xx = x + R() * w, yy = y + ((R() * h + t * 900) % h); line(ctx, xx, yy, xx - 6, yy + 26, 2, 'rgba(200,220,255,.45)'); } }
  ctx.restore();
  rrect(ctx, x, y, w, h, 6); fillStroke(ctx, null, 10, o.moldura || '#3a2a22');
  line(ctx, x + w / 2, y, x + w / 2, y + h, 8, o.moldura || '#3a2a22'); line(ctx, x, y + h / 2, x + w, y + h / 2, 8, o.moldura || '#3a2a22');
  if (o.cortina) { for (const lado of [-1, 1]) { const cx = lado < 0 ? x - 30 : x + w + 30; ctx.beginPath(); ctx.moveTo(cx - 50 * lado * -1, y - 40); ctx.quadraticCurveTo(cx + 40 * lado * -1, y + h * .5, cx - 10 * lado * -1, y + h + 50); ctx.lineTo(cx - 70 * lado * -1, y + h + 50); ctx.lineTo(cx - 80 * lado * -1, y - 40); ctx.closePath(); fillStroke(ctx, o.cortina, 5); } }
}

const CENARIOS = {
  // quarto à noite: cama, janela com lua, guarda-roupa, abajur
  quarto_noite(ctx, t, cam, o) {
    applyCam(ctx, cam, .9);
    ctx.fillStyle = o.parede || '#2b3350'; ctx.fillRect(-900, -600, 2900, 2000);
    ctx.strokeStyle = 'rgba(255,255,255,.04)'; for (let x = -900; x < 2000; x += 90) line(ctx, x, -600, x, CHAO - 260, 3, 'rgba(255,255,255,.035)');
    janela(ctx, 600, 420, 320, 380, ['#0b1030', '#26305c'], t, { lua: true, cortina: '#5a3b6e', sombra: o.sombraJanela || 0, chuva: o.chuva });
    // guarda-roupa
    rrect(ctx, -60, 360, 330, CHAO - 360 - 40, 8); fillStroke(ctx, '#4a3222', 6);
    const abre = o.armario || 0;
    ctx.save(); ctx.translate(105, 360); rrect(ctx, 0, 0, 160 * (1 - abre * .8), CHAO - 400, 6); fillStroke(ctx, '#5c3e2a', 5); ctx.restore();
    if (abre > 0) { rrect(ctx, 105 + 160 * (1 - abre * .8), 360, 160 * abre * .8, CHAO - 400, 0); ctx.fillStyle = '#05050a'; ctx.fill();
      if (o.olhosArmario) { const p = .6 + .4 * Math.sin(t * 2.4); for (const dx of [-14, 14]) { ellipse(ctx, 105 + 160 - 50 + dx, 640, 9, 6 * p); ctx.fillStyle = '#ffe04a'; ctx.fill(); } } }
    circle(ctx, 245 - abre * 120, 760, 8); ctx.fillStyle = '#e8c04a'; ctx.fill();
    chaoPerspectiva(ctx, CHAO - 40, '#3a2b2a', 'rgba(0,0,0,.25)');
    // abajur + criado-mudo
    rrect(ctx, 820, CHAO - 210, 170, 180, 8); fillStroke(ctx, '#5a3a28', 5);
    const aceso = o.abajur == null ? 1 : o.abajur;
    line(ctx, 905, CHAO - 210, 905, CHAO - 320, 6);
    path(ctx, [[855, CHAO - 400], [955, CHAO - 400], [985, CHAO - 320], [825, CHAO - 320]]); fillStroke(ctx, aceso ? '#ffd780' : '#6b5a40', 5);
    if (aceso) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(905, CHAO - 330, 20, 905, CHAO - 330, 520); g.addColorStop(0, `rgba(255,200,110,${.42 * aceso})`); g.addColorStop(1, 'rgba(255,170,80,0)'); ctx.fillStyle = g; ctx.fillRect(300, CHAO - 900, 1200, 1200); ctx.restore(); }
    // cama
    rrect(ctx, 300, CHAO - 250, 470, 210, 18); fillStroke(ctx, '#6b4630', 6);
    rrect(ctx, 290, CHAO - 330, 60, 290, 10); fillStroke(ctx, '#5c3a26', 6);
    rrect(ctx, 330, CHAO - 270, 430, 70, 24); fillStroke(ctx, '#d9d4ea', 5);
    rrect(ctx, 360, CHAO - 300, 120, 50, 20); fillStroke(ctx, '#f4f0fb', 5);
    applyCam(ctx, cam, 1);
  },
  // corredor de casa assombrada: perspectiva, portas, quadros tortos, luz piscando
  corredor_escuro(ctx, t, cam, o) {
    applyCam(ctx, cam, .85);
    const pisca = o.pisca ? (Math.sin(t * 31) > .7 || Math.sin(t * 7.3) > .92 ? .25 : 1) : 1;
    ctx.fillStyle = '#1d1716'; ctx.fillRect(-900, -600, 2900, 2600);
    const vx = 540, vy = 820;
    // paredes em fuga
    path(ctx, [[-900, -600], [vx - 150, vy - 260], [vx - 150, vy + 200], [-900, 2400]]); ctx.fillStyle = '#3d2c26'; ctx.fill();
    path(ctx, [[1980, -600], [vx + 150, vy - 260], [vx + 150, vy + 200], [1980, 2400]]); ctx.fillStyle = '#35261f'; ctx.fill();
    path(ctx, [[-900, 2400], [vx - 150, vy + 200], [vx + 150, vy + 200], [1980, 2400]]); ctx.fillStyle = '#2a1d17'; ctx.fill();
    for (let i = 0; i < 12; i++) { const bx = -900 + i * 260; line(ctx, vx + (bx - vx) * .1, vy + 200, bx, 2400, 3, 'rgba(0,0,0,.35)'); }
    // fundo: porta no fim do corredor
    rrect(ctx, vx - 150, vy - 260, 300, 460, 0); ctx.fillStyle = '#120d0c'; ctx.fill();
    rrect(ctx, vx - 55, vy - 70, 110, 270, 4); fillStroke(ctx, o.portaFundoAberta ? '#050304' : '#4a2e22', 4);
    if (o.portaFundoAberta) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(180,200,255,.25)'; ctx.fillRect(vx - 55, vy - 70, 110, 270); ctx.restore(); }
    // portas laterais e quadros
    for (const [lado, k] of [[-1, 0], [-1, 1], [1, 0], [1, 1]]) {
      const d = k ? .55 : 1, cx = vx + lado * (150 + 520 * d), top = vy - 260 - 420 * d, h = 900 * d, w = 150 * d;
      path(ctx, [[cx, top + 160 * d], [cx + lado * -w, top + 210 * d], [cx + lado * -w, top + h - 40 * d], [cx, top + h]]); ctx.fillStyle = '#4c3024'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
      ctx.save(); ctx.translate(cx + lado * 160 * d, top + 120 * d); ctx.rotate(lado * .08 + Math.sin(t * .7 + k) * .01); rrect(ctx, -60 * d, -40 * d, 120 * d, 90 * d, 4); fillStroke(ctx, '#2c2a36', 5);
      ctx.fillStyle = '#6e5a4a'; circle(ctx, 0, 0, 20 * d); ctx.fill(); ctx.restore();
    }
    // lustre
    line(ctx, vx, -600, vx, 230, 4, '#222'); ellipse(ctx, vx, 250, 70, 22); fillStroke(ctx, '#6b5a3a', 4);
    if (pisca > .5) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(vx, 260, 10, vx, 600, 900); g.addColorStop(0, 'rgba(255,190,110,.35)'); g.addColorStop(1, 'rgba(255,170,80,0)'); ctx.fillStyle = g; ctx.fillRect(-400, -200, 1900, 1900); ctx.restore(); }
    darkness(ctx, (1 - pisca) * .6);
    applyCam(ctx, cam, 1);
  },
  // rua de cidade à noite: prédios, poste com cone de luz, calçada molhada
  rua_noite(ctx, t, cam, o) {
    applyCam(ctx, cam, .1); drawSky(ctx, '#070a1c', '#22284a', -500, 1100); estrelas(ctx, 60, 4, 700, t);
    applyCam(ctx, cam, .12); lua(ctx, 820, 260, 60, t);
    applyCam(ctx, cam, .35);
    for (let i = 0; i < 8; i++) predio(ctx, -300 + i * 210, 1060, 190, 380 + (i * 137) % 300, '#1a1d33', '#f6d27a', 10 + i, .25);
    applyCam(ctx, cam, .7);
    for (let i = 0; i < 5; i++) predio(ctx, -400 + i * 380, 1150, 330, 560 + (i * 211) % 260, '#262a45', '#ffd98a', 30 + i, .4);
    applyCam(ctx, cam, 1);
    ctx.fillStyle = '#22232d'; ctx.fillRect(-900, CHAO - 60, 2900, 1400);
    ctx.fillStyle = '#3a3b46'; ctx.fillRect(-900, CHAO - 60, 2900, 40);
    for (let x = -900; x < 2000; x += 240) line(ctx, x, CHAO + 120, x + 120, CHAO + 120, 10, '#d9c36a');
    // poste
    const px = o.posteX ?? 820;
    rrect(ctx, px - 12, CHAO - 640, 24, 600, 6); fillStroke(ctx, '#2c2f3a', 4);
    ctx.beginPath(); ctx.moveTo(px, CHAO - 640); ctx.quadraticCurveTo(px - 10, CHAO - 700, px - 90, CHAO - 690); ctx.lineWidth = 14; ctx.strokeStyle = '#2c2f3a'; ctx.stroke();
    const luz = o.posteLuz == null ? 1 : o.posteLuz;
    ellipse(ctx, px - 100, CHAO - 680, 40, 14); fillStroke(ctx, luz > .3 ? '#fff2c0' : '#555', 4);
    if (luz > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createLinearGradient(0, CHAO - 680, 0, CHAO); g.addColorStop(0, `rgba(255,230,160,${.45 * luz})`); g.addColorStop(1, `rgba(255,220,150,${.08 * luz})`);
      path(ctx, [[px - 130, CHAO - 680], [px - 70, CHAO - 680], [px + 150, CHAO + 40], [px - 350, CHAO + 40]]); ctx.fillStyle = g; ctx.fill();
      ellipse(ctx, px - 100, CHAO + 20, 260, 40); ctx.fillStyle = `rgba(255,220,150,${.18 * luz})`; ctx.fill(); ctx.restore(); }
    if (o.chuva) poça(ctx, 300, CHAO + 40, t);
  },
  // floresta à noite com neblina e lua
  floresta_noite(ctx, t, cam, o) {
    applyCam(ctx, cam, .1); drawSky(ctx, '#05070f', '#1b2a33', -500, 1100); estrelas(ctx, 50, 9, 600, t);
    applyCam(ctx, cam, .12); lua(ctx, 300, 300, 70, t, '#e9f0d8');
    applyCam(ctx, cam, .3); for (let i = 0; i < 10; i++) arvoreSilhueta(ctx, -300 + i * 180, 1100, 520 + (i % 3) * 90, '#0f1a1c', i + 1);
    neblina(ctx, t, 1000, .35, cam);
    applyCam(ctx, cam, .65); for (let i = 0; i < 6; i++) arvoreGalhos(ctx, -200 + i * 300 + (i % 2) * 60, 1200, 800 + (i % 3) * 120, '#0a1012', i + 20);
    applyCam(ctx, cam, 1);
    ctx.fillStyle = '#0d1714'; ctx.fillRect(-900, CHAO - 30, 2900, 1400);
    const R = rng(5); for (let i = 0; i < 60; i++) { const x = R() * 2400 - 700, y = CHAO - 20 + R() * 40; line(ctx, x, y, x + (R() - .5) * 20, y - 20 - R() * 30, 4, '#16261f'); }
    neblina(ctx, t, CHAO, .45, cam);
  },
  // cemitério: lápides, cerca, árvore seca, neblina rasteira
  cemiterio(ctx, t, cam, o) {
    applyCam(ctx, cam, .1); drawSky(ctx, '#0a0d1a', '#2c3550', -500, 1100); estrelas(ctx, 40, 12, 600, t);
    applyCam(ctx, cam, .12); lua(ctx, 780, 330, 95, t);
    applyCam(ctx, cam, .4); ctx.fillStyle = '#141a26'; ctx.beginPath(); ctx.moveTo(-600, 1100); ctx.quadraticCurveTo(300, 920, 1700, 1080); ctx.lineTo(1700, 1500); ctx.lineTo(-600, 1500); ctx.fill();
    arvoreGalhos(ctx, 180, 1020, 820, '#090c14', 7); cerca(ctx, 1080, '#0c0f18');
    applyCam(ctx, cam, .75); for (let i = 0; i < 6; i++) lapide(ctx, -150 + i * 260, 1180, .7, '#4a5060', ['RIP', '1897', 'R.I.P', '†', 'RIP', '1902'][i], (i % 3 - 1) * .06);
    applyCam(ctx, cam, 1);
    ctx.fillStyle = '#121a1a'; ctx.fillRect(-900, CHAO - 30, 2900, 1400);
    lapide(ctx, 120, CHAO + 10, 1.25, '#6d7383', o.nomeLapide || 'RIP', -.04); lapide(ctx, 960, CHAO + 30, 1.1, '#646a7a', '1931', .05);
    neblina(ctx, t, CHAO, .55, cam);
  },
  // sala de aula de dia
  sala_aula(ctx, t, cam, o) {
    applyCam(ctx, cam, .9);
    ctx.fillStyle = '#f1e3c8'; ctx.fillRect(-900, -600, 2900, 2000); ctx.fillStyle = '#d9c6a2'; ctx.fillRect(-900, CHAO - 300, 2900, 260);
    rrect(ctx, 120, 300, 840, 460, 10); fillStroke(ctx, '#2f5a45', 10, '#6b4a2a');
    if (o.lousa) text(ctx, o.lousa, 540, 530, 64, 'rgba(255,255,255,.9)', null, 0, 'Poppins', 700);
    rrect(ctx, 120, 760, 840, 20, 4); fillStroke(ctx, '#7a5634', 4);
    // relógio
    circle(ctx, 960, 210, 60); fillStroke(ctx, '#fff', 6); line(ctx, 960, 210, 960 + Math.sin(t) * 40, 210 - Math.cos(t) * 40, 5); line(ctx, 960, 210, 990, 220, 6);
    chaoPerspectiva(ctx, CHAO - 40, '#b98d5a', 'rgba(90,50,20,.25)');
    for (const x of [100, 760]) { rrect(ctx, x, CHAO - 170, 260, 30, 6); fillStroke(ctx, '#c88b52', 5); line(ctx, x + 30, CHAO - 140, x + 30, CHAO - 30, 8); line(ctx, x + 230, CHAO - 140, x + 230, CHAO - 30, 8); }
    applyCam(ctx, cam, 1);
  },
  // escritório: mesa, computador, janela com a cidade
  escritorio(ctx, t, cam, o) {
    applyCam(ctx, cam, .9);
    ctx.fillStyle = '#dfe6ee'; ctx.fillRect(-900, -600, 2900, 2000);
    janela(ctx, 520, 260, 460, 520, ['#7ec3ff', '#d7eeff'], t, { moldura: '#8a96a8' });
    ctx.save(); rrect(ctx, 520, 260, 460, 520, 6); ctx.clip(); for (let i = 0; i < 5; i++) predio(ctx, 520 + i * 100, 780, 90, 200 + (i * 73) % 220, '#9fb1c8', '#e8f2ff', 50 + i, .5); ctx.restore();
    rrect(ctx, 80, 300, 300, 200, 8); fillStroke(ctx, '#fff', 5); text(ctx, o.quadro || 'METAS', 230, 360, 34, '#2a3f8f', null, 0, 'Poppins', 700);
    line(ctx, 120, 460, 200, 420, 6, '#e0392f'); line(ctx, 200, 420, 260, 440, 6, '#e0392f'); line(ctx, 260, 440, 340, 380, 6, '#e0392f');
    chaoPerspectiva(ctx, CHAO - 40, '#9aa4b2', 'rgba(40,50,70,.2)');
    rrect(ctx, 520, CHAO - 260, 520, 34, 8); fillStroke(ctx, '#e8e2d8', 5); line(ctx, 560, CHAO - 226, 560, CHAO - 30, 10); line(ctx, 1000, CHAO - 226, 1000, CHAO - 30, 10);
    rrect(ctx, 640, CHAO - 470, 260, 170, 10); fillStroke(ctx, '#2a2f3a', 6); rrect(ctx, 655, CHAO - 455, 230, 140, 6); ctx.fillStyle = o.tela || '#3ea6ee'; ctx.fill();
    line(ctx, 770, CHAO - 300, 770, CHAO - 262, 12);
    applyCam(ctx, cam, 1);
  },
  // campo de dia: céu, morros, árvore, sol
  campo_dia(ctx, t, cam, o) {
    applyCam(ctx, cam, .08); drawSky(ctx, '#3ea6ee', '#c9ecfb', -400, 1100);
    applyCam(ctx, cam, .1); drawSun(ctx, 850, 260, 80, t, .9);
    applyCam(ctx, cam, .15); drawCloud(ctx, 160 + t * 6, 300, 110, 1); drawCloud(ctx, 760 + t * 4, 200, 80, 2);
    applyCam(ctx, cam, .35); ctx.fillStyle = '#8fd27a'; ctx.beginPath(); ctx.moveTo(-600, 1050); ctx.quadraticCurveTo(200, 860, 800, 1010); ctx.quadraticCurveTo(1300, 1120, 1800, 980); ctx.lineTo(1800, 1500); ctx.lineTo(-600, 1500); ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
    applyCam(ctx, cam, .6); ctx.fillStyle = '#6cbf5a'; ctx.beginPath(); ctx.moveTo(-600, 1160); ctx.quadraticCurveTo(500, 1040, 1800, 1170); ctx.lineTo(1800, 1600); ctx.lineTo(-600, 1600); ctx.fill(); ctx.stroke();
    // árvore
    rrect(ctx, 840, 820, 50, 340, 10); fillStroke(ctx, '#8a5a2c', 5);
    for (const [dx, dy, r] of [[-60, -10, 110], [60, -40, 120], [0, -120, 130], [-110, -100, 90], [110, -130, 90]]) { circle(ctx, 865 + dx, 820 + dy, r); fillStroke(ctx, '#3fa35b', 5); }
    applyCam(ctx, cam, 1);
    ctx.fillStyle = '#5aa84c'; ctx.fillRect(-900, CHAO - 30, 2900, 1400); line(ctx, -900, CHAO - 30, 2000, CHAO - 30, 5);
    const R = rng(2); for (let i = 0; i < 40; i++) { const x = R() * 2200 - 600, y = CHAO + R() * 60; line(ctx, x, y, x + 5, y - 22, 4, '#3d8a36'); }
  },
  // cidade de dia
  cidade_dia(ctx, t, cam, o) {
    applyCam(ctx, cam, .08); drawSky(ctx, '#58b4f0', '#d8f0ff', -400, 1100);
    applyCam(ctx, cam, .15); drawCloud(ctx, 200 + t * 6, 260, 100, 3); drawCloud(ctx, 850 + t * 4, 180, 80, 4);
    applyCam(ctx, cam, .4); for (let i = 0; i < 8; i++) predio(ctx, -300 + i * 210, 1070, 190, 420 + (i * 151) % 330, ['#9fb6d6', '#b9c8de', '#8aa3c8'][i % 3], '#dff0ff', 70 + i, .6);
    applyCam(ctx, cam, .75); for (let i = 0; i < 5; i++) predio(ctx, -400 + i * 380, 1170, 330, 600 + (i * 211) % 260, ['#e9a86a', '#d9786a', '#f0c27a'][i % 3], '#fff6d8', 90 + i, .5);
    applyCam(ctx, cam, 1);
    ctx.fillStyle = '#c9c4bb'; ctx.fillRect(-900, CHAO - 60, 2900, 70); ctx.fillStyle = '#55565e'; ctx.fillRect(-900, CHAO + 10, 2900, 1400);
    for (let x = -900; x < 2000; x += 240) line(ctx, x, CHAO + 150, x + 120, CHAO + 150, 10, '#f2f2f2');
  },
  // cozinha
  cozinha(ctx, t, cam, o) {
    applyCam(ctx, cam, .9);
    ctx.fillStyle = '#f7ead2'; ctx.fillRect(-900, -600, 2900, 2000);
    for (let y = 520; y < 900; y += 60) for (let x = -200; x < 1300; x += 60) { rrect(ctx, x, y, 56, 56, 4); ctx.fillStyle = (x / 60 + y / 60) % 2 ? '#e8f3f2' : '#d6ebea'; ctx.fill(); }
    rrect(ctx, 760, 360, 260, CHAO - 400, 18); fillStroke(ctx, '#e9eef2', 6); line(ctx, 760, 700, 1020, 700, 5); rrect(ctx, 790, 560, 18, 100, 6); fillStroke(ctx, '#9aa4b2', 4);
    rrect(ctx, -100, CHAO - 330, 840, 300, 8); fillStroke(ctx, '#c58a54', 6); rrect(ctx, -110, CHAO - 350, 860, 34, 6); fillStroke(ctx, '#ececec', 5);
    for (let x = 20; x < 700; x += 240) { rrect(ctx, x, CHAO - 290, 200, 220, 6); fillStroke(ctx, '#d39a62', 4); circle(ctx, x + 170, CHAO - 180, 8); ctx.fillStyle = INK; ctx.fill(); }
    chaoPerspectiva(ctx, CHAO - 30, '#c9b79a', 'rgba(90,60,30,.2)');
    applyCam(ctx, cam, 1);
  },
  // estrada à noite (perspectiva, faixas, faróis)
  estrada_noite(ctx, t, cam, o) {
    applyCam(ctx, cam, .1); drawSky(ctx, '#05070f', '#1d2440', -500, 1100); estrelas(ctx, 80, 21, 800, t);
    applyCam(ctx, cam, .3); ctx.fillStyle = '#0c1018'; ctx.beginPath(); ctx.moveTo(-600, 1000); ctx.lineTo(200, 880); ctx.lineTo(500, 960); ctx.lineTo(900, 860); ctx.lineTo(1700, 1000); ctx.lineTo(1700, 1500); ctx.lineTo(-600, 1500); ctx.fill();
    applyCam(ctx, cam, 1);
    ctx.fillStyle = '#10131a'; ctx.fillRect(-900, 980, 2900, 1600);
    path(ctx, [[480, 980], [600, 980], [1500, 2000], [-420, 2000]]); ctx.fillStyle = '#2a2c33'; ctx.fill();
    const fase = (t * 2.2) % 1;
    for (let i = 0; i < 8; i++) { const k = (i + fase) / 8, y = 980 + k * k * 1000, w = 6 + k * 40, h = 20 + k * 120; rrect(ctx, 540 - w / 2, y, w, h, 3); ctx.fillStyle = '#e8d06a'; ctx.fill(); }
    if (o.farois) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const dx of [-90, 90]) { const g = ctx.createRadialGradient(540 + dx, 1500, 10, 540 + dx, 1500, 420); g.addColorStop(0, `rgba(255,250,220,${.6 * o.farois})`); g.addColorStop(1, 'rgba(255,250,220,0)'); ctx.fillStyle = g; ctx.fillRect(0, 1000, 1080, 1000); } ctx.restore(); }
  },
  // espaço sideral
  espaco(ctx, t, cam, o) {
    applyCam(ctx, cam, .05); ctx.fillStyle = '#04030c'; ctx.fillRect(-2000, -2000, 5000, 6000); estrelas(ctx, 220, 31, 1900, t);
    applyCam(ctx, cam, .2); const g = ctx.createRadialGradient(300, 600, 30, 300, 600, 700); g.addColorStop(0, 'rgba(120,60,180,.35)'); g.addColorStop(1, 'rgba(60,20,120,0)'); ctx.fillStyle = g; ctx.fillRect(-500, -200, 1600, 1600);
    applyCam(ctx, cam, .4); circle(ctx, 780, 1500, 520); fillStroke(ctx, '#3a7bd5', 6); ctx.save(); circle(ctx, 780, 1500, 520); ctx.clip();
    for (const [x, y, r] of [[600, 1150, 160], [900, 1300, 200], [700, 1600, 180]]) { circle(ctx, x, y, r); ctx.fillStyle = '#4fa36a'; ctx.fill(); }
    ctx.fillStyle = 'rgba(0,0,30,.35)'; ctx.fillRect(900, 900, 600, 1200); ctx.restore();
    applyCam(ctx, cam, 1);
  },
  // praia de dia
  praia(ctx, t, cam, o) {
    applyCam(ctx, cam, .08); drawSky(ctx, '#3ea6ee', '#fbe9c4', -400, 1000);
    applyCam(ctx, cam, .1); drawSun(ctx, 800, 330, 85, t, 1);
    applyCam(ctx, cam, .5); drawSea(ctx, 980, t);
    applyCam(ctx, cam, 1);
    ctx.fillStyle = '#f2d59a'; ctx.beginPath(); ctx.moveTo(-900, CHAO - 120); ctx.quadraticCurveTo(540, CHAO - 180, 2000, CHAO - 110); ctx.lineTo(2000, 2600); ctx.lineTo(-900, 2600); ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
  },
  // estúdio / palco: fundo escuro com holofote (genérico, para explicar coisas)
  palco(ctx, t, cam, o) {
    applyCam(ctx, cam, .9);
    ctx.fillStyle = o.fundo || '#1b1a2a'; ctx.fillRect(-900, -600, 2900, 2600);
    for (let x = -900; x < 2000; x += 120) { ctx.fillStyle = x / 120 % 2 ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.08)'; ctx.fillRect(x, -600, 60, CHAO - 400); }
    ctx.fillStyle = o.chao || '#2c2436'; ctx.fillRect(-900, CHAO - 40, 2900, 1400);
    lightShaft(ctx, o.holofoteX ?? 540, -200, 160, 760, CHAO + 200, .9);
    ellipse(ctx, o.holofoteX ?? 540, CHAO + 10, 330, 50); ctx.fillStyle = 'rgba(255,236,190,.18)'; ctx.fill();
    applyCam(ctx, cam, 1);
  },
};

function poça(ctx, x, y, t) {
  ellipse(ctx, x, y, 160, 26); ctx.fillStyle = 'rgba(120,140,190,.25)'; ctx.fill();
  const k = (t * 1.3) % 1; ellipse(ctx, x, y, 40 + k * 120, 6 + k * 20); ctx.lineWidth = 3; ctx.strokeStyle = `rgba(200,220,255,${.5 * (1 - k)})`; ctx.stroke();
}
function neblina(ctx, t, y, a = .4, cam) {
  ctx.save(); const R = rng(77);
  for (let i = 0; i < 9; i++) { const x = ((R() * 2400 + t * (20 + i * 6)) % 2600) - 800, yy = y - 60 + R() * 120, rx = 380 + R() * 260;
    const g = ctx.createRadialGradient(x, yy, 10, x, yy, rx); g.addColorStop(0, `rgba(150,165,185,${clamp(a, 0, .6) * .32})`); g.addColorStop(1, 'rgba(150,165,185,0)'); ctx.fillStyle = g; ctx.fillRect(x - rx, yy - rx * .4, rx * 2, rx * .8); }
  ctx.restore();
}
function cenario(nome, ctx, t, cam, o = {}) {
  const f = CENARIOS[nome] || CENARIOS.palco;
  ctx.save(); f(ctx, t, cam || CAM0(), o); ctx.restore();
  applyCam(ctx, cam || CAM0(), 1);
}
