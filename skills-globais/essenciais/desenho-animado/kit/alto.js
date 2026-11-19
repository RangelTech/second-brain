// ---------- camada de alto nível em português (Viralizaí) ----------
// O que o roteirista/IA usa para escrever cada plano: ator(), camera(), efeitos. Tudo determinístico (só depende do tempo).

// ciclo de caminhada (pernas e braços) compartilhado: sem pé deslizando
const walkLegs = (t, sp = 9, amp = .55) => ({ L: [Math.sin(t * sp) * amp + .05, -Math.max(0, Math.sin(t * sp + 1)) * .7], R: [-Math.sin(t * sp) * amp + .05, -Math.max(0, -Math.sin(t * sp + 1)) * .7] });
const walkArms = (t, sp = 9, amp = .6) => ({ L: [.3 - Math.sin(t * sp) * amp, -.3], R: [.3 + Math.sin(t * sp) * amp, -.3] });

// ===== personagens =====
// Cada personagem = uma cor de roupa + um detalhe (chapéu/cabelo). Use os nomes abaixo ou passe um objeto próprio.
const PERSONAGENS = {
  heroi: { cols: ['#e0392f', '#f6f1e8'], hat: 'cabelo', cabelo: '#2b1d14' },
  heroina: { cols: ['#7a4bc4', '#7a4bc4'], hat: 'coque', cabelo: '#5a2e16' },
  amigo: { cols: ['#2f63c9', '#f6f1e8'], hat: 'bone', boneCor: '#f2b52a' },
  amiga: { cols: ['#3fa35b', '#3fa35b'], hat: 'coque', cabelo: '#e8c04a' },
  idoso: { cols: ['#8a8f99', '#8a8f99'], hat: 'careca' },
  crianca: { cols: ['#f2b52a', '#f2b52a'], hat: 'cabelo', cabelo: '#6b4026' },
  policial: { cols: ['#2a3f8f', '#2a3f8f'], hat: 'captain' },
  medico: { cols: ['#f4f4f2', '#f4f4f2'], hat: 'cabelo', cabelo: '#222' },
  chefe: { cols: ['#2b2230', '#2b2230'], hat: 'cabelo', cabelo: '#111' },
  pirata: { cols: ['#e0392f', '#f6f1e8'], hat: 'bandana', hatCol: '#d8312b', dotCol: '#fff' },
  marinheiro: { cols: ['#2f63c9', '#f6f1e8'], hat: 'sailor' },
};
const HUMOR = {
  normal: { eyes: 'normal', mouth: 'smile' },
  feliz: { eyes: 'happy', mouth: 'grin' },
  triste: { eyes: 'normal', mouth: 'frown', browAng: -.35, look: [0, .5] },
  medo: { eyes: 'wide', mouth: 'o', browUp: 1, browAng: -.3 },
  raiva: { eyes: 'normal', mouth: 'teeth', browAng: .45 },
  surpreso: { eyes: 'wide', mouth: 'o', browUp: 1.2 },
  desconfiado: { eyes: 'half', mouth: 'smirk', browOne: 1 },
  serio: { eyes: 'normal', mouth: 'flat' },
  tonto: { eyes: 'spiral', mouth: 'flat' },
  morto: { eyes: 'x', mouth: 'flat' },
};

// ===== ator =====
// ator(ctx, t, lt, { quem, x, y, s, dir, acao, humor, olhar, segura, de, ate, x0, x1, alpha, silhueta })
//   t = tempo do filme, lt = tempo dentro do plano (s). acao: parado | andar | correr | assustado | tremer | apontar | acenar |
//   pensar | comemorar | cair | sentado | deitado | celular | falar | esconder | empurrar | segurar
//   andar/correr: vai de x0 até x1 entre os segundos de..ate do plano. dir = 1 olha para a direita, -1 para a esquerda.
//   segura: 'lanterna' | 'celular' | 'vela' | 'papel' | 'faca' | 'dinheiro' | função(ctx,k,mao,ang,lado)
function ator(ctx, t, lt, o) {
  const base = typeof o.quem === 'object' ? o.quem : (PERSONAGENS[o.quem] || PERSONAGENS.heroi);
  const s = o.s || 520, acao = o.acao || 'parado';
  let x = o.x ?? 540, y = o.y ?? CHAO, dir = o.dir || 1;
  const hum = Object.assign({}, HUMOR[o.humor || (acao === 'assustado' || acao === 'tremer' ? 'medo' : 'normal')] || HUMOR.normal);
  const piscar = ((t * 30 + (o.semente || 0) * 41) % 110) < 4 ? 1 : 0;
  const face = Object.assign({ blink: piscar, look: o.olhar || hum.look || [0, 0] }, hum);
  let arms = { L: [.3, -.1], R: [.3, -.1] }, legs = { L: [.1, -.04], R: [.1, -.04] }, lean = 0, bob = Math.sin(t * 2.2) * .004, squash = 1, headTilt = 0, extra = {};
  const de = o.de ?? 0, ate = o.ate ?? (o.dur ?? 3);
  if (acao === 'andar' || acao === 'correr') {
    const v = acao === 'correr' ? 15 : 8.5, k = clamp((lt - de) / Math.max(.1, ate - de));
    if (o.x0 != null && o.x1 != null) { x = lerp(o.x0, o.x1, k); dir = o.x1 >= o.x0 ? 1 : -1; }
    const andando = lt >= de && lt <= ate;
    if (andando) { legs = walkLegs(t, v, acao === 'correr' ? .8 : .55); arms = walkArms(t, v, acao === 'correr' ? 1.0 : .6); bob = Math.abs(Math.sin(t * v)) * -.012; lean = acao === 'correr' ? .12 : .03; }
  } else if (acao === 'assustado') {
    const p = clamp((lt - de) / .25); arms = { L: [lerp(.3, 2.4, p), lerp(-.1, .5, p)], R: [lerp(.3, 2.4, p), lerp(-.1, .5, p)] };
    lean = -.12 * p; x += -dir * 60 * backOut(p); squash = 1 + Math.sin(clamp((lt - de) / .3) * Math.PI) * .06; extra.sweat = 1;
    const sh = shake(t, 4 * p); x += sh[0]; y += sh[1] * .5;
  } else if (acao === 'tremer') {
    const sh = shake(t * 3, 5); x += sh[0]; arms = { L: [.5, -1.6], R: [.5, -1.6] }; extra.sweat = 1; headTilt = Math.sin(t * 30) * .02;
  } else if (acao === 'apontar') {
    const p = backOut(clamp((lt - de) / .3)); arms = { L: [.3, -.1], R: [lerp(.3, 1.55, p), lerp(-.1, 0, p)] };
  } else if (acao === 'acenar') {
    arms = { L: [.3, -.1], R: [2.6 + Math.sin(t * 9) * .3, .2] };
  } else if (acao === 'pensar') {
    arms = { L: [.5, -1.9], R: [.9, -2.5] }; headTilt = -.08; face.look = [.6, -.6];
  } else if (acao === 'comemorar') {
    const pul = Math.abs(Math.sin(t * 6)); y -= pul * 60; arms = { L: [2.7, .2], R: [2.7, .2] }; face.eyes = 'happy'; face.mouth = 'grin';
  } else if (acao === 'cair') {
    const p = easeIn(clamp((lt - de) / .5)); lean = -dir * 1.45 * p; y += p * 40; arms = { L: [lerp(.3, 2.2, p), .3], R: [lerp(.3, 2.6, p), .3] }; face.eyes = p > .9 ? 'spiral' : 'wide';
  } else if (acao === 'sentado') {
    y += s * .12; legs = { L: [1.5, -1.5], R: [1.5, -1.5] }; arms = { L: [.5, -.6], R: [.5, -.6] };
  } else if (acao === 'deitado') {
    lean = -Math.PI / 2 * dir; y -= s * .12;
  } else if (acao === 'celular') {
    arms = { L: [.6, -1.9], R: [.6, -1.9] }; face.look = [0, .7]; headTilt = .1;
    extra.prop = (c, k, h) => { if (k === 'R') { c.save(); c.translate(h[0] - .05, h[1] - .02); rrect(c, -.03, -.055, .06, .11, .01); fillStroke(c, '#1d1f26', .008); c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(140,200,255,.6)'; c.fillRect(-.024, -.048, .048, .096); c.restore(); } };
  } else if (acao === 'falar') {
    face.mouth = Math.sin(t * 18) > 0 ? 'o' : 'flat'; arms = { L: [.3, -.1], R: [.9 + Math.sin(t * 4) * .3, -.6] };
  } else if (acao === 'esconder') {
    y += s * .18; squash = .8; arms = { L: [1.6, -2.4], R: [1.6, -2.4] }; face.eyes = 'wide'; extra.sweat = 1;
  } else if (acao === 'empurrar') {
    lean = .2 * dir; arms = { L: [1.5, -.2], R: [1.5, -.2] }; legs = { L: [-.3, -.1], R: [.4, -.1] };
  } else if (acao === 'segurar') {
    arms = { L: [.3, -.1], R: [1.1, -.9] };
  }
  if (o.segura) {
    const seg = o.segura;
    if (typeof seg === 'function') extra.prop = seg;
    else extra.prop = (c, k, h, a, side) => { if (k !== 'R') return; c.save(); c.translate(h[0], h[1]);
      if (seg === 'lanterna') { rrect(c, -.014, -.01, .028, .075, .008); fillStroke(c, '#3a3d48', .009); }
      else if (seg === 'vela') { rrect(c, -.012, -.07, .024, .07, .005); fillStroke(c, '#f2ecd8', .007); c.beginPath(); c.ellipse(0, -.085, .012, .02, 0, 0, TAU); c.fillStyle = '#ffd36a'; c.fill(); }
      else if (seg === 'papel') { rrect(c, -.04, -.06, .08, .1, .004); fillStroke(c, '#fff', .007); }
      else if (seg === 'dinheiro') { rrect(c, -.05, -.03, .1, .05, .004); fillStroke(c, '#7cc76a', .007); }
      else if (seg === 'faca') { path(c, [[0, 0], [.012, -.11], [-.004, -.11]]); fillStroke(c, '#d8dde6', .006); }
      else if (seg === 'celular') { rrect(c, -.03, -.055, .06, .11, .01); fillStroke(c, '#1d1f26', .008); }
      c.restore(); };
    if (seg === 'lanterna' && acao !== 'andar' && acao !== 'correr') arms.R = [1.45, -.15];
  }
  // luz da lanterna/vela que o ator segura (no mundo, para fora do boneco)
  if (o.segura === 'lanterna') {
    const hx = x + dir * s * .3, hy = y - s * .55; coneLuz(ctx, hx, hy, dir > 0 ? .08 : Math.PI - .08, 1000, .28, o.luz ?? 1);
  }
  if (o.segura === 'vela') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(x + dir * s * .25, y - s * .6, 10, x + dir * s * .25, y - s * .6, s * 1.1); g.addColorStop(0, 'rgba(255,190,90,.45)'); g.addColorStop(1, 'rgba(255,150,60,0)'); ctx.fillStyle = g; ctx.fillRect(x - s * 1.5, y - s * 2, s * 3, s * 2.4); ctx.restore(); }
  const cfg = Object.assign({}, base, {
    x, y, s, flip: dir, arms, legs, lean, bob, squash, headTilt: headTilt + (o.inclina || 0), face, t,
    sil: o.silhueta ? (o.silhueta === true ? '#05060a' : o.silhueta) : undefined, eyesGlow: !!o.silhueta, alpha: o.alpha,
    prop: extra.prop, shadow: o.sombra !== false,
  });
  drawStick(ctx, cfg);
  if (extra.sweat && !o.silhueta) sweat(ctx, x + dir * s * .2, y - s * .92, s * .05, .9);
  return { x, y };
}

// ===== câmera =====
// camera(lt, dur, {tipo, foco:[x,y], de, para, zoom, forca}) -> objeto cam para cenario()/applyCam
// tipos: fixa (só leve mão) | empurra (aproxima devagar) | afasta | pan (x de→para) | sobe | desce | treme (impacto) | zoom_rapido (susto)
function camera(lt, dur, o = {}) {
  const tipo = o.tipo || 'empurra', p = ease(clamp(lt / Math.max(.1, dur))), hh = shake(lt * .35, o.mao ?? 3, 1, 2);
  const f = o.foco || [540, 960]; let x = f[0], y = f[1], z = o.zoom || 1, r = 0;
  if (tipo === 'empurra') z = lerp(o.zoom || 1, (o.zoom || 1) * 1.12, p);
  else if (tipo === 'afasta') z = lerp((o.zoom || 1) * 1.15, o.zoom || 1, p);
  else if (tipo === 'pan') x = lerp((o.de ?? 340), (o.para ?? 740), p);
  else if (tipo === 'sobe') y = lerp(f[1] + 300, f[1], p);
  else if (tipo === 'desce') y = lerp(f[1] - 300, f[1], p);
  else if (tipo === 'treme') { const k = Math.exp(-lt * 3) * (o.forca || 26); const sh = shake(lt * 4, k); x += sh[0]; y += sh[1]; z = (o.zoom || 1) * 1.04; }
  else if (tipo === 'zoom_rapido') z = lerp(o.zoom || 1, (o.zoom || 1) * 1.45, easeOut(clamp(lt / .35)));
  return { x: x + hh[0], y: y + hh[1], z, r };
}

// ===== efeitos =====
function chuva(ctx, t, forca = 1) {
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); const R = rng(9);
  for (let i = 0; i < 160 * forca; i++) { const x = R() * 1300 - 100, sp = 1400 + R() * 800, y = ((R() * 2200 + t * sp) % 2200) - 200, l = 30 + R() * 40;
    line(ctx, x, y, x - l * .25, y + l, 2 + R() * 1.5, `rgba(200,215,255,${.25 + R() * .35})`); }
  ctx.restore();
}
function raio(ctx, t, quando, dur = .25) {
  const k = t - quando; if (k < 0 || k > dur) return 0;
  const a = (k < .06 || (k > .1 && k < .15)) ? .85 : .25;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(210,225,255,${a})`; ctx.fillRect(0, 0, W, H); ctx.restore();
  return a;
}
function flash(ctx, t, quando, cor = '255,255,255', dur = .3) {
  const k = t - quando; if (k < 0 || k > dur) return;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = `rgba(${cor},${(1 - k / dur) * .8})`; ctx.fillRect(0, 0, W, H); ctx.restore();
}
function poeira(ctx, t, n = 40, cor = '255,240,210') {
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); const R = rng(14);
  for (let i = 0; i < n; i++) { const x = (R() * 1200 + Math.sin(t * .4 + i) * 40) % 1100, y = (R() * 1900 - t * (10 + R() * 20)) % 1920; circle(ctx, x, (y + 1920) % 1920, 1.5 + R() * 2.5); ctx.fillStyle = `rgba(${cor},${.15 + R() * .3})`; ctx.fill(); }
  ctx.restore();
}
function vinheta(ctx, forca = .5, cor = '10,5,20') {
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); const g = ctx.createRadialGradient(540, 900, 380, 540, 960, 1250); g.addColorStop(0, `rgba(${cor},0)`); g.addColorStop(1, `rgba(${cor},${forca})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
}
function escurecer(ctx, a) { darkness(ctx, a); }
// tinta da cena (ex.: 'vermelho' susto, 'azul' noite, 'sepia' passado)
function tinta(ctx, tipo, a = .3) {
  const cores = { vermelho: '160,0,0', azul: '20,40,120', sepia: '120,80,30', verde: '20,90,40', roxo: '70,20,110' };
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgba(${cores[tipo] || tipo},${a})`; ctx.fillRect(0, 0, W, H); ctx.restore();
}
// letreiro dentro da cena (curto, num objeto): placa, papel, tela. NÃO usar como cartão de texto solto.
function placa(ctx, x, y, textoPlaca, w = 360, cor = '#f4e7c4', ang = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); rrect(ctx, -w / 2, -60, w, 120, 10); fillStroke(ctx, cor, 6);
  quebraTexto(ctx, textoPlaca, 0, 0, w - 40, 44, INK); ctx.restore();
}
