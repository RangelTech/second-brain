// Valida um filme do motor cinema SEM navegador: roda motor + planos num canvas falso, quadro a quadro (a cada 0,25 s),
// e imprime JSON {ok, erros, dur, planos}. Uso: node valida.js <filme.js completo (motor+planos+main)>
const fs = require('fs');
const vm = require('vm');
const codigo = fs.readFileSync(process.argv[2], 'utf8');

const nada = () => {};
const grad = { addColorStop: nada };
function ctxFalso() {
  const alvo = {
    canvas: { width: 1080, height: 1920 },
    createLinearGradient: () => grad, createRadialGradient: () => grad, createConicGradient: () => grad,
    createPattern: () => ({}), measureText: (s) => ({ width: String(s).length * 30 }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    isPointInPath: () => false, getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }), getLineDash: () => [],
  };
  return new Proxy(alvo, {
    get(o, k) { if (k in o) return o[k]; return nada; },
    set(o, k, v) { o[k] = v; return true; },
  });
}
function canvasFalso() { const c = { width: 1080, height: 1920, getContext: () => ctxFalso(), toDataURL: () => '' }; return c; }
const window = {};
const sandbox = {
  window, console, Math, Date, JSON, Array, Object, Number, String, Boolean, Uint8ClampedArray, Proxy, Error, Map, Set,
  document: { createElement: () => canvasFalso(), fonts: { load: async () => {} } },
  Image: class { constructor() { this.width = 800; this.height = 600; } },
  WORDS: [], IMG: new Proxy({}, { get: () => ({ width: 800, height: 600 }) }), OPCOES: { legenda: true },
};
sandbox.globalThis = sandbox;
const erros = [];
let info = {};
try {
  vm.createContext(sandbox);
  vm.runInContext(codigo + '\n;globalThis.__montar = montar; globalThis.__SHOTS = SHOTS;', sandbox, { timeout: 20000 });
  const SHOTS = sandbox.__SHOTS;
  if (!Array.isArray(SHOTS) || !SHOTS.length) throw new Error('SHOTS vazio');
  SHOTS.forEach((s, i) => {
    if (typeof s.draw !== 'function') erros.push(`plano ${i}: sem draw()`);
    if (!(s.end > s.start)) erros.push(`plano ${i}: end (${s.end}) <= start (${s.start})`);
    if (i && Math.abs(s.start - SHOTS[i - 1].end) > .05) erros.push(`plano ${i}: buraco/sobreposição no tempo (${SHOTS[i - 1].end} -> ${s.start})`);
  });
  const filme = sandbox.__montar(canvasFalso());
  for (let f = 0; f < filme.TOTAL_FRAMES; f += 8) {
    filme.renderFrame(f);
    if (window.__ERRO_CENA) { erros.push(window.__ERRO_CENA); break; }
  }
  info = { dur: filme.DUR, planos: SHOTS.length };
} catch (e) {
  const onde = e && e.stack ? (e.stack.split('\n').find((l) => /evalmachine/.test(l)) || '') : '';
  erros.push(`${e && e.name ? e.name : 'Erro'}: ${e && e.message ? e.message : e}${onde ? ' (' + onde.trim().slice(0, 80) + ')' : ''}`);
}
console.log(JSON.stringify({ ok: !erros.length, erros, ...info }));
