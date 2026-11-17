'use strict';
/* matnotiz.js - Werkzeuge für das Rechen-Duell (Wunsch der Azubis, 17.11.2026): Notizfeld für Nebenrechnungen und wissenschaftlicher Taschenrechner.
   Aufruf: MatNotiz.einbau(host, { ziel: 'rdIn' }) hängt zwei Knöpfe und die beiden Felder an host an. matduellui.js ruft das bei jeder Aufgabe neu auf,
   dadurch ist das Notizfeld bei jeder Aufgabe leer. Der Rechner behält Anzeige, Ans und Grad/Bogenmaß über die Aufgaben hinweg.
   Notizfeld: Zeichenfläche (Apple Pencil, Finger, Maus; Druck des Stifts macht die Linie dicker) und darunter ein Textfeld für die Tastatur.
   Rechner: eigener Rechenkern MatNotiz.rechne(tokens, { deg, ans }) ohne eval; Punkt vor Strich, Klammern, Potenz, Wurzel, sin/cos/tan, log, ln, π, e, EXP.
   Speicher: lm4.mat.werkz { notiz: 0|1, rechner: 0|1, deg: 0|1 } (welche Felder offen sind). Notizen werden nie gespeichert. */
(function (root) {
  const doc = root.document;
  const LS = 'lm4.mat.werkz';
  const lade = () => { try { return Object.assign({ notiz: 0, rechner: 0, deg: 1 }, JSON.parse(localStorage.getItem(LS) || '{}')); } catch (e) { return { notiz: 0, rechner: 0, deg: 1 }; } };
  const W = doc ? lade() : { notiz: 0, rechner: 0, deg: 1 };
  const merke = () => { try { localStorage.setItem(LS, JSON.stringify({ notiz: W.notiz, rechner: W.rechner, deg: W.deg })); } catch (e) {} };

  /* ---------- Rechenkern ---------- */
  const FN = { 'sin(': 1, 'cos(': 1, 'tan(': 1, 'asin(': 1, 'acos(': 1, 'atan(': 1, 'log(': 1, 'ln(': 1, '√(': 1 };
  const ZAHL = /^(\d+(,\d*)?|,\d+)(E[+−-]?\d+)?$/;
  function rechne(tok, o) {
    o = o || {}; const deg = o.deg !== 0 && o.deg !== false, L = []; let i = 0;
    while (i < tok.length) {
      const t = tok[i];
      if (/^[0-9,]$/.test(t)) {
        let s = '';
        while (i < tok.length && (/^[0-9,E]$/.test(tok[i]) || ((tok[i] === '−' || tok[i] === '+') && s.slice(-1) === 'E'))) s += tok[i++];
        if (!ZAHL.test(s)) throw new Error('Diese Zahl verstehe ich nicht: ' + s);
        L.push({ n: parseFloat(s.replace(',', '.').replace('−', '-').replace('E', 'e')) });
      } else { if (t === 'E') throw new Error('EXP steht direkt nach einer Zahl, zum Beispiel 4,7 EXP 3.'); L.push(t); i++; }
    }
    let p = 0;
    const pk = () => L[p];
    const wert = t => t !== undefined && (typeof t === 'object' || t === '(' || t === 'π' || t === 'e' || t === 'Ans' || FN[t] === 1);
    const zu = () => { if (pk() === ')') p++; else if (pk() !== undefined) throw new Error('Hier fehlt eine Klammer zu.'); };
    const trig = v => Math.abs(v) < 1e-15 ? 0 : v;
    function fn(f, a) {
      const r = deg ? a * Math.PI / 180 : a, g = v => deg ? v * 180 / Math.PI : v; let v;
      if (f === 'sin(') v = trig(Math.sin(r));
      else if (f === 'cos(') v = trig(Math.cos(r));
      else if (f === 'tan(') { if (Math.abs(Math.cos(r)) < 1e-15) throw new Error('Der Tangens ist hier nicht definiert.'); v = trig(Math.tan(r)); }
      else if (f === 'asin(') v = g(Math.asin(a));
      else if (f === 'acos(') v = g(Math.acos(a));
      else if (f === 'atan(') v = g(Math.atan(a));
      else if (f === 'log(') v = a > 0 ? Math.log10(a) : NaN;
      else if (f === 'ln(') v = a > 0 ? Math.log(a) : NaN;
      else v = a >= 0 ? Math.sqrt(a) : NaN;
      if (!isFinite(v)) throw new Error(f === '√(' ? 'Die Wurzel aus einer negativen Zahl gibt es hier nicht.' : 'Das ist für diese Zahl nicht definiert.');
      return v;
    }
    function primary() {
      const t = L[p++];
      if (t === undefined) throw new Error('Die Rechnung ist noch nicht fertig.');
      if (typeof t === 'object') return t.n;
      if (t === 'π') return Math.PI;
      if (t === 'e') return Math.E;
      if (t === 'Ans') return +o.ans || 0;
      if (t === '(') { const v = expr(); zu(); return v; }
      if (FN[t] === 1) { const a = expr(); zu(); return fn(t, a); }
      throw new Error('Das Zeichen ' + t + ' steht an der falschen Stelle.');
    }
    function postfix() { let v = primary(); while (pk() === '²') { p++; v = v * v; } return v; }
    function power() { const b = postfix(); if (pk() === '^') { p++; return Math.pow(b, unary()); } return b; }
    function unary() { if (pk() === '−') { p++; return -unary(); } if (pk() === '+') { p++; return unary(); } return power(); }
    function term() {
      let v = unary();
      for (;;) {
        const t = pk();
        if (t === '×') { p++; v *= unary(); }
        else if (t === '÷') { p++; const d = unary(); if (d === 0) throw new Error('Durch null kann man nicht teilen.'); v /= d; }
        else if (wert(t)) v *= unary();
        else break;
      }
      return v;
    }
    function expr() { let v = term(); for (;;) { const t = pk(); if (t === '+') { p++; v += term(); } else if (t === '−') { p++; v -= term(); } else break; } return v; }
    const v = expr();
    if (p < L.length) throw new Error(L[p] === ')' ? 'Hier ist eine Klammer zu viel.' : 'Das Zeichen ' + L[p] + ' steht an der falschen Stelle.');
    if (!isFinite(v)) throw new Error('Das Ergebnis ist zu groß oder nicht definiert.');
    return v;
  }
  /* Anzeige: höchstens 10 gültige Stellen, Komma, sehr große und sehr kleine Zahlen mit E */
  function fmt(v) {
    if (!isFinite(v)) return '';
    if (v === 0) return '0';
    const a = Math.abs(v); let s;
    if (a >= 1e10 || a < 1e-6) { const m = v.toExponential(9).split('e'); s = String(parseFloat(m[0])) + 'E' + String(+m[1]); }
    else s = String(Number(v.toPrecision(10)));
    return s.replace('.', ',').replace(/-/g, '−');
  }
  /* Zahl für das Antwortfeld: ohne E, mit Komma */
  function plain(v) {
    let s = String(Number(v.toPrecision(10)));
    if (/e/i.test(s)) s = Number(v).toFixed(12).replace(/0+$/, '').replace(/\.$/, '');
    return s.replace('.', ',');
  }
  const ZEIG = { 'asin(': 'sin⁻¹(', 'acos(': 'cos⁻¹(', 'atan(': 'tan⁻¹(', '×': ' × ', '÷': ' ÷ ', '+': ' + ', '−': ' − ' };
  const zeig = tok => tok.map((t, i) => (t === '−' || t === '+') && (i === 0 || tok[i - 1] === 'E' || tok[i - 1] === '(' || FN[tok[i - 1]] === 1 || /^[×÷+−^]$/.test(tok[i - 1])) ? t : (ZEIG[t] || t)).join('');

  /* Zustand des Rechners (bleibt über die Aufgaben hinweg) */
  const R = { tok: [], ans: 0, fertig: false, res: '', err: '', inv: false, wert: null };
  function taste(k) {
    R.err = '';
    if (k === 'DEG') { W.deg = W.deg ? 0 : 1; merke(); return; }
    if (k === 'INV') { R.inv = !R.inv; return; }
    if (k === 'C') { R.tok = []; R.fertig = false; R.res = ''; return; }
    if (k === '⌫') { if (R.fertig) { R.tok = []; R.fertig = false; R.res = ''; } else R.tok.pop(); return; }
    if (k === '=') {
      if (!R.tok.length || R.fertig) return;
      try { const v = rechne(R.tok, { deg: W.deg, ans: R.ans }); R.ans = v; R.wert = v; R.res = fmt(v); R.fertig = true; } catch (e) { R.err = e.message; }
      return;
    }
    let neu = [k];
    if (k === 'sin' || k === 'cos' || k === 'tan') neu = [(R.inv ? 'a' : '') + k + '('];
    else if (k === 'log') neu = R.inv ? ['1', '0', '^', '('] : ['log('];
    else if (k === 'ln') neu = R.inv ? ['e', '^', '('] : ['ln('];
    else if (k === '√') neu = ['√('];
    R.inv = false;
    if (R.fertig) { R.tok = /^[+−×÷^²]$/.test(k) ? ['Ans'] : []; R.fertig = false; R.res = ''; }
    if (R.tok.length + neu.length > 80) { R.err = 'Die Rechnung ist zu lang.'; return; }
    R.tok = R.tok.concat(neu);
  }

  /* ---------- Oberfläche ---------- */
  const CSS = `.mn-kn{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;padding-top:12px;border-top:1px solid var(--line)}.mn-kn .btn{flex:1;min-width:140px}.mn-kn .btn[aria-expanded=true]{border-color:var(--accent);color:var(--accent)}
.mn-feld{margin-top:10px;border:1px solid var(--line);border-radius:12px;padding:10px;background:var(--bg)}.mn-feld h5{margin:0 0 8px;font-size:13px;color:var(--mute);font-weight:600}
.mn-bar{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}.mn-bar button{min-height:40px;padding:0 12px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);color:var(--fg);font-size:14px}.mn-bar button.on{background:var(--accent-bg,#1a6fd4);border-color:var(--accent-bg,#1a6fd4);color:#fff;font-weight:600}
.mn-cv{display:block;width:100%;height:260px;border:1px dashed var(--line);border-radius:10px;background:var(--panel);color:var(--fg);touch-action:none;cursor:crosshair;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
.mn-ta{display:block;width:100%;box-sizing:border-box;margin-top:8px;min-height:64px;padding:9px 10px;border-radius:10px;border:1px solid var(--line);background:var(--panel);color:var(--fg);font:16px/1.4 ui-monospace,Menlo,Consolas,monospace;resize:vertical}
.mn-hin{font-size:12px;color:var(--mute);margin:6px 0 0}
.mn-anz{border:1px solid var(--line);border-radius:10px;background:var(--panel);padding:8px 10px;margin-bottom:8px;min-width:0}.mn-anz:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.mn-o{min-height:18px;font-size:13px;color:var(--mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right}.mn-o.err{color:var(--danger);white-space:normal;text-align:left}
.mn-u{font:700 24px/1.3 ui-monospace,Menlo,Consolas,monospace;text-align:right;white-space:nowrap;overflow-x:auto;scrollbar-width:none}
.mn-k{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;max-width:460px;margin:0 auto}.mn-k button{min-height:46px;border-radius:10px;border:1px solid var(--line);background:var(--panel);color:var(--fg);font-size:17px;padding:0;min-width:0}
.mn-k button.f{background:var(--panel2);font-size:15px}.mn-k button.op{background:var(--panel2);font-weight:700}.mn-k button.gl{background:var(--accent-bg,#1a6fd4);border-color:var(--accent-bg,#1a6fd4);color:#fff;font-weight:700;grid-row:span 2}.mn-k button.nul{grid-column:span 2}.mn-k button.on{border-color:var(--accent);color:var(--accent);font-weight:700}.mn-k button.del{color:var(--danger)}
.mn-ue{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;justify-content:center}.mn-ue .btn{min-height:40px;font-size:14px}
@media(max-width:480px){.mn-cv{height:210px}.mn-k button{min-height:44px;font-size:16px}.mn-k button.f{font-size:14px}}`;
  function css() { if (doc.getElementById('mnCss')) return; const s = doc.createElement('style'); s.id = 'mnCss'; s.textContent = CSS; doc.head.appendChild(s); }

  /* Zeichenfläche */
  function flaeche(cv, bar) {
    const S = { strokes: [], akt: null, rad: false, stift: false, w: 0, h: 0 };
    const ctx = cv.getContext('2d');
    const seg = (st, a, b) => {
      ctx.globalCompositeOperation = st.r ? 'destination-out' : 'source-over';
      ctx.lineWidth = st.r ? 24 : (b[2] > 0 ? 1.2 + 2.6 * b[2] : 2.2);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    };
    const malen = () => {
      const d = root.devicePixelRatio || 1; S.w = cv.clientWidth; S.h = cv.clientHeight; if (!S.w || !S.h) return;
      cv.width = Math.round(S.w * d); cv.height = Math.round(S.h * d);
      ctx.setTransform(d, 0, 0, d, 0, 0); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      let f = '#e8ecf0'; try { f = root.getComputedStyle(cv).color || f; } catch (e) {} ctx.strokeStyle = f;
      S.strokes.forEach(st => { if (st.pts.length === 1) seg(st, st.pts[0], [st.pts[0][0] + 0.01, st.pts[0][1], st.pts[0][2]]); for (let i = 1; i < st.pts.length; i++) seg(st, st.pts[i - 1], st.pts[i]); });
    };
    const pt = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top, e.pointerType === 'pen' ? (e.pressure || 0) : 0]; };
    cv.addEventListener('pointerdown', e => {
      if (e.pointerType === 'pen') S.stift = true;
      if (S.stift && e.pointerType === 'touch') return;                 /* Handballen liegt auf: nur der Stift schreibt */
      if (e.button > 0) return;
      e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (x) {}
      if (!S.w) malen();
      S.akt = { r: S.rad, id: e.pointerId, pts: [pt(e)] }; S.strokes.push(S.akt); seg(S.akt, S.akt.pts[0], [S.akt.pts[0][0] + 0.01, S.akt.pts[0][1], S.akt.pts[0][2]]);
    });
    cv.addEventListener('pointermove', e => {
      const a = S.akt; if (!a || a.id !== e.pointerId) return; e.preventDefault();
      const ev = e.getCoalescedEvents ? e.getCoalescedEvents() : []; (ev.length ? ev : [e]).forEach(x => { const q = pt(x), l = a.pts[a.pts.length - 1]; if (Math.abs(q[0] - l[0]) + Math.abs(q[1] - l[1]) < 0.4) return; a.pts.push(q); seg(a, l, q); });
    });
    const aus = e => { if (S.akt && S.akt.id === e.pointerId) S.akt = null; };
    cv.addEventListener('pointerup', aus); cv.addEventListener('pointercancel', aus);
    cv.addEventListener('contextmenu', e => e.preventDefault());
    const knopf = () => bar.querySelectorAll('button').forEach(b => { if (b.dataset.mnz === 'stift') b.classList.toggle('on', !S.rad); if (b.dataset.mnz === 'rad') b.classList.toggle('on', S.rad); if (b.dataset.mnz === 'stift' || b.dataset.mnz === 'rad') b.setAttribute('aria-pressed', String(b.classList.contains('on'))); });
    bar.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return; const a = b.dataset.mnz;
      if (a === 'stift') S.rad = false; else if (a === 'rad') S.rad = true; else if (a === 'undo') { S.strokes.pop(); malen(); } else if (a === 'leer') { S.strokes = []; malen(); const ta = cv.parentNode.querySelector('.mn-ta'); if (ta) ta.value = ''; }
      knopf();
    });
    if (root.ResizeObserver) try { new root.ResizeObserver(() => { if (cv.clientWidth && (cv.clientWidth !== S.w || cv.clientHeight !== S.h)) malen(); }).observe(cv); } catch (e) {}
    knopf(); malen();
    return { malen, zustand: S };
  }

  const TASTEN = [
    ['DEG', 'f', 'Winkel in Grad oder Bogenmaß'], ['INV', 'f', 'Umkehrfunktion'], ['(', 'f'], [')', 'f'], ['⌫', 'f del', 'letztes Zeichen löschen'],
    ['sin', 'f'], ['cos', 'f'], ['tan', 'f'], ['√', 'f', 'Wurzel'], ['²', 'f', 'Quadrat'],
    ['log', 'f'], ['ln', 'f'], ['^', 'f', 'hoch'], ['π', 'f', 'Pi'], ['E', 'f', 'mal zehn hoch'],
    ['7'], ['8'], ['9'], ['÷', 'op', 'geteilt'], ['C', 'f del', 'alles löschen'],
    ['4'], ['5'], ['6'], ['×', 'op', 'mal'], ['Ans', 'f', 'letztes Ergebnis'],
    ['1'], ['2'], ['3'], ['−', 'op', 'minus'], ['=', 'gl', 'ist gleich'],
    ['0', 'nul'], [','], ['+', 'op', 'plus']
  ];
  const BESCHR = k => k === 'DEG' ? (W.deg ? 'DEG' : 'RAD') : k === '²' ? 'x²' : k === '^' ? 'xʸ' : k === 'E' ? 'EXP' : R.inv && (k === 'sin' || k === 'cos' || k === 'tan') ? k + '⁻¹' : R.inv && k === 'log' ? '10ˣ' : R.inv && k === 'ln' ? 'eˣ' : k;
  function rechner(feld, ziel) {
    const anz = feld.querySelector('.mn-anz'), o = feld.querySelector('.mn-o'), u = feld.querySelector('.mn-u'), k = feld.querySelector('.mn-k'), ueb = feld.querySelector('[data-mnr=ueb]');
    const zeichne = () => {
      o.className = 'mn-o' + (R.err ? ' err' : ''); o.textContent = R.err || (R.fertig ? zeig(R.tok) + ' =' : (W.deg ? 'Grad (DEG)' : 'Bogenmaß (RAD)'));
      u.textContent = R.fertig ? R.res : (zeig(R.tok) || '0'); u.scrollLeft = u.scrollWidth;
      k.querySelectorAll('button').forEach(b => { const t = b.dataset.mnk; b.textContent = BESCHR(t); if (t === 'INV') { b.classList.toggle('on', R.inv); b.setAttribute('aria-pressed', String(R.inv)); } });
      if (ueb) ueb.disabled = !(R.fertig && R.wert != null);
    };
    k.innerHTML = TASTEN.map(t => `<button type="button" data-mnk="${t[0]}" class="${t[1] || ''}"${t[2] ? ` title="${t[2]}" aria-label="${t[2]}"` : ''}></button>`).join('');
    k.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; taste(b.dataset.mnk); zeichne(); });
    const KEY = { '*': '×', '/': '÷', '-': '−', '+': '+', '.': ',', ',': ',', '(': '(', ')': ')', '^': '^', Enter: '=', '=': '=', Backspace: '⌫', Delete: 'C', Escape: 'C', p: 'π', e: 'E', E: 'E' };
    feld.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return; const t = /^[0-9]$/.test(e.key) ? e.key : KEY[e.key]; if (!t) return;
      e.preventDefault(); e.stopPropagation(); taste(t); zeichne();
    });
    if (ueb) ueb.addEventListener('click', () => { const z = ziel && doc.getElementById(ziel); if (!z || R.wert == null) return; z.value = plain(R.wert); try { z.dispatchEvent(new Event('input', { bubbles: true })); z.focus({ preventScroll: true }); } catch (e) {} });
    zeichne();
    return { zeichne, anz };
  }

  function einbau(host, opt) {
    if (!doc || !host) return null; opt = opt || {}; css();
    const box = doc.createElement('div'); box.className = 'mn';
    box.innerHTML = `<div class="mn-kn"><button type="button" class="btn" data-mn="notiz" aria-expanded="false" aria-controls="mnNotiz">✏️ Notizfeld</button><button type="button" class="btn" data-mn="rechner" aria-expanded="false" aria-controls="mnRechner">🧮 Taschenrechner</button></div>
      <div class="mn-feld" id="mnNotiz" hidden><h5>Notizfeld für Nebenrechnungen</h5>
        <div class="mn-bar" role="group" aria-label="Werkzeuge für das Notizfeld"><button type="button" data-mnz="stift">✏️ Stift</button><button type="button" data-mnz="rad">Radierer</button><button type="button" data-mnz="undo">↶ Zurück</button><button type="button" data-mnz="leer">Leeren</button></div>
        <canvas class="mn-cv" aria-label="Zeichenfläche für Nebenrechnungen mit Stift oder Finger"></canvas>
        <textarea class="mn-ta" rows="2" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Oder hier mit der Tastatur schreiben" aria-label="Notizen mit der Tastatur"></textarea>
        <p class="mn-hin">Schreib mit dem Stift, dem Finger oder der Tastatur. Das Notizfeld wird bei jeder neuen Aufgabe geleert und zählt nicht zur Wertung.</p></div>
      <div class="mn-feld" id="mnRechner" hidden><h5>Taschenrechner</h5>
        <div class="mn-anz" tabindex="0" role="group" aria-label="Anzeige des Taschenrechners"><div class="mn-o"></div><div class="mn-u" aria-live="polite"></div></div>
        <div class="mn-k"></div>
        <div class="mn-ue">${opt.ziel ? '<button type="button" class="btn" data-mnr="ueb">Ergebnis ins Antwortfeld</button>' : ''}</div>
        <p class="mn-hin">Punkt vor Strich und Klammern werden beachtet. EXP heißt „mal zehn hoch“: 4,7 EXP 3 ist 4700. INV schaltet auf sin⁻¹, cos⁻¹, tan⁻¹, 10ˣ und eˣ um.</p></div>`;
    host.appendChild(box);
    const fn = box.querySelector('#mnNotiz'), fr = box.querySelector('#mnRechner'), kn = box.querySelectorAll('[data-mn]');
    const F = flaeche(fn.querySelector('.mn-cv'), fn.querySelector('.mn-bar')), RR = rechner(fr, opt.ziel);
    const zeige = () => { fn.hidden = !W.notiz; fr.hidden = !W.rechner; kn.forEach(b => b.setAttribute('aria-expanded', String(!!W[b.dataset.mn]))); if (W.notiz) F.malen(); };
    box.querySelector('.mn-kn').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const a = b.dataset.mn; W[a] = W[a] ? 0 : 1; merke(); zeige(); if (W[a]) try { (a === 'notiz' ? fn : fr).scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (x) {} });
    zeige();
    return { box, flaeche: F, rechner: RR };
  }

  const api = { einbau, rechne, fmt, plain, taste, zeig, zustand: () => R, offen: () => W };
  root.MatNotiz = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
