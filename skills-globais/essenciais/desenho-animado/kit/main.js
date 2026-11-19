// ---------- compositor do filme (Viralizaí) ----------
// Base: compositor do template stick-figure (MIT). Recebe do host: SHOTS (do roteiro), WORDS [{w,s,e}] (fala com tempo),
// IMG {chave: HTMLImageElement}, OPCOES {legenda: true}. montar(canvasSaida) devolve {renderFrame(f), TOTAL_FRAMES, DUR}.
function montar(saida) {
  const out = saida.getContext('2d');
  const quadro = document.createElement('canvas'); quadro.width = W; quadro.height = H; const qctx = quadro.getContext('2d');
  const buf = document.createElement('canvas'); buf.width = W; buf.height = H; const bctx = buf.getContext('2d');
  const DUR = SHOTS[SHOTS.length - 1].end;
  const TOTAL_FRAMES = Math.round(DUR * FPS);
  const grains = [];
  for (let k = 0; k < 4; k++) { const g = document.createElement('canvas'); g.width = g.height = 256; const gc = g.getContext('2d'); const id = gc.createImageData(256, 256); const R = rng(k + 11); for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (R() - .5) * 120; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } gc.putImageData(id, 0, 0); grains.push(g); }
  // legenda: 1 a 3 palavras por vez, quebra em pontuação e pausa
  const CHUNKS = (() => {
    const ch = []; let cur = null;
    (WORDS || []).forEach((w, i) => {
      const prev = WORDS[i - 1];
      const brk = !cur || cur.words.length >= 3 || (cur.text + ' ' + w.w).length > 16 || /[.,?!;:]$/.test(prev ? prev.w : '') || (prev && w.s - prev.e > .35);
      if (brk) { cur = { words: [w], text: w.w, s: w.s, e: w.e }; ch.push(cur); } else { cur.words.push(w); cur.text += ' ' + w.w; cur.e = w.e; }
    });
    ch.forEach((c, i) => { const n = ch[i + 1]; c.e = n && n.s - c.e < .5 ? n.s : c.e + .25; });
    return ch;
  })();
  const capText = s => s.replace(/[-–—]/g, ' ').replace(/[^\p{L}\p{N}%!? ]/gu, '').replace(/\s+/g, ' ').trim().toUpperCase();
  function drawCaption(ctx, t) {
    if (OPCOES.legenda === false) return;
    const c = CHUNKS.find(c => t >= c.s && t < c.e); if (!c) return;
    const k = clamp((t - c.s) / .1); const sc = .82 + .18 * backOut(k);
    // palavra falada agora em amarelo
    const atual = c.words.findIndex(w => t >= w.s && t < w.e + .05);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.translate(540, 1400); ctx.scale(sc, sc);
    ctx.font = '700 74px Poppins'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    const ws = c.words.map(w => capText(w.w)).filter(Boolean); const esp = 20;
    const larg = ws.reduce((a, w) => a + ctx.measureText(w).width, 0) + esp * (ws.length - 1); let x = -larg / 2;
    ws.forEach((w, i) => {
      ctx.lineJoin = 'round'; ctx.lineWidth = 15; ctx.strokeStyle = '#111'; ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 5; ctx.strokeText(w, x, 0);
      ctx.shadowColor = 'transparent'; ctx.fillStyle = i === atual ? '#ffe600' : '#fff'; ctx.fillText(w, x, 0); x += ctx.measureText(w).width + esp;
    });
    ctx.restore();
  }
  function renderShot(ctx, i, t) {
    const s = SHOTS[i];
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.save();
    try { s.draw(ctx, t - s.start, t, s.end - s.start); } catch (e) { if (!window.__ERRO_CENA) window.__ERRO_CENA = `plano ${i}: ${e && e.message}`; }
    ctx.restore();
  }
  function blit(src, dx, blur) {
    const n = blur > 2 ? 9 : 1;
    qctx.save(); qctx.setTransform(1, 0, 0, 1, 0, 0);
    for (let k = 0; k < n; k++) { const off = n > 1 ? (k / (n - 1) - .5) * blur : 0; qctx.globalAlpha = 1 / (k + 1); const x = dx + off; qctx.drawImage(src, x, 0); if (x > 0) qctx.drawImage(src, x - W, 0); if (x < 0) qctx.drawImage(src, x + W, 0); }
    qctx.restore();
  }
  function renderFrame(f) {
    const t = Math.min(f / FPS, DUR - 1e-3);
    let i = SHOTS.findIndex(s => t >= s.start && t < s.end); if (i < 0) i = SHOTS.length - 1;
    const s = SHOTS[i], WT = .2;
    qctx.setTransform(1, 0, 0, 1, 0, 0); qctx.fillStyle = '#000'; qctx.fillRect(0, 0, W, H);
    let dx = 0, blur = 0;
    if (s.tr === 'whip' && i < SHOTS.length - 1 && t > s.end - WT) { const p = easeIn((t - (s.end - WT)) / WT); dx = -p * 420; blur = p * 260; }
    const prev = SHOTS[i - 1];
    if (prev && prev.tr === 'whip' && t < s.start + WT) { const p = 1 - easeOut((t - s.start) / WT); dx = p * 420; blur = p * 260; }
    renderShot(bctx, i, t);
    blit(buf, dx, blur);
    // escurecida rápida entre planos marcados com tr:'fade' (e no começo/fim do filme)
    let preto = 0;
    if (s.tr === 'fade' && t > s.end - .25) preto = (t - (s.end - .25)) / .25;
    if (prev && prev.tr === 'fade' && t < s.start + .25) preto = Math.max(preto, 1 - (t - s.start) / .25);
    if (t < .3) preto = Math.max(preto, 1 - t / .3);
    if (t > DUR - .5) preto = Math.max(preto, (t - (DUR - .5)) / .5);
    qctx.save(); qctx.setTransform(1, 0, 0, 1, 0, 0);
    const g = qctx.createRadialGradient(540, 900, 500, 540, 960, 1250); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(10,5,20,.32)'); qctx.fillStyle = g; qctx.fillRect(0, 0, W, H);
    qctx.globalCompositeOperation = 'overlay'; qctx.globalAlpha = .07; const pat = qctx.createPattern(grains[f % 4], 'repeat'); qctx.fillStyle = pat; qctx.translate((f * 37) % 256, (f * 91) % 256); qctx.fillRect(-256, -256, W + 512, H + 512);
    qctx.restore();
    if (preto > 0) { qctx.save(); qctx.setTransform(1, 0, 0, 1, 0, 0); qctx.fillStyle = `rgba(0,0,0,${clamp(preto)})`; qctx.fillRect(0, 0, W, H); qctx.restore(); }
    drawCaption(qctx, t);
    out.setTransform(1, 0, 0, 1, 0, 0); out.drawImage(quadro, 0, 0, saida.width, saida.height);
  }
  return { renderFrame, TOTAL_FRAMES, DUR };
}
