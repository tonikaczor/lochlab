'use strict';
/* Tonfunk Messgeräte-Frontplatten (geraete.js, Phase 1: Multimeter).
   Gemeinsames Modul für die Labs: stellt einen fertigen Messwert wie ein Digitalmultimeter dar (7-Segment-LCD, AUTO, Bereichstext, Drehschalter-Ikone, Buchsen).
   REINE DARSTELLUNG: Das Modul rechnet nichts und rundet nichts. Zahl, Einheit und Nachkommastellen (meters[].digits) kommen vom Lab (Pflichtquelle),
   Texte (meters[].texts, "∞") ebenso. Es werden so viele Ziffernfelder gezeigt, wie die Nachkommastellen des Prüfstands verlangen (mindestens vier, höchstens sieben;
   darüber als Text). Das echte 3½-stellige Maximum 1999 gilt nicht als Grenze: Wer 2,140 mA zeigen muss, bekommt fünf statt vier Felder (handle.over und fn.format().conform melden das).
   Kein Verrat: keine Sollwerte, keine Ampel, keine Toleranz, kein Fehlername auf dem Gerät; ein Warnrahmen erscheint nur, wenn das Lab state.warn setzt (die Labs tun es auf der Frontplatte nicht).
   Schnittstelle: window.GERAETE = { renderMultimeter(el, state, opts) -> { el, update(state), flush(), destroy(), over }, fn: { format, autoRange, seg7, rangeText, modeOf, RANGES } }.
   state: { value, unit, digits, label, help, ol, inf, infText, text, none, warn, range, ranges }.   opts: { compact: true|false|'auto', ariaLive: false, id }.
   Die reinen Funktionen (ohne DOM) hängen unter fn und werden von quelle/geraete/test_geraete_fn.js geprüft.
   Aktualisierung: update() merkt nur den letzten Zustand und schreibt einmal je Bild (requestAnimationFrame, mit Zeitgeber als Rückfall); gleicher Zustand = kein DOM-Zugriff.
   Vorlesetext (class sr) wird höchstens alle 600 ms und nur bei geändertem Text geschrieben. */
(function (root) {
  const G = root.GERAETE = root.GERAETE || {};
  const fin = v => typeof v === 'number' && isFinite(v);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const MINC = 4, MAXC = 7;

  /* ============================================================ reine Funktionen (ohne DOM) */
  /* Segmente je Zeichen (a oben, b rechts oben, c rechts unten, d unten, e links unten, f links oben, g Mitte) */
  const SEG = { '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd', '6': 'afgedc', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', '-': 'g', 'L': 'def', 'O': 'abcdef', ' ': '' };
  /* seg7('OL') -> ['abcdef', 'def']; unbekanntes Zeichen -> leer */
  function seg7(str) { return String(str == null ? '' : str).split('').map(ch => (SEG[ch] != null ? SEG[ch] : '')); }

  /* Bereichsreihe 2 / 20 / 200 / 2000 ... (Vollausschlag in der Einheit des Messgeräts), 2e-6 bis 2e12 */
  const RANGES = []; for (let k = -6; k <= 12; k++) RANGES.push(Number('2e' + k));
  /* kleinster Bereich mit |value| <= Bereich; ueber dem größten: ol = true */
  function autoRange(value, ranges) {
    const rs = Array.isArray(ranges) && ranges.length ? ranges : RANGES;
    if (!fin(value)) return { range: rs[0], index: 0, ol: false };
    const a = Math.abs(value);
    for (let i = 0; i < rs.length; i++) if (a <= rs[i]) return { range: rs[i], index: i, ol: false };
    return { range: rs[rs.length - 1], index: rs.length - 1, ol: true };
  }
  const numText = v => String(Number((+v).toPrecision(6))).replace('.', ',');
  function rangeText(r, unit) { return fin(r) ? numText(r) + (unit ? ' ' + unit : '') : ''; }
  /* Drehschalterstellung aus der Einheit (nur Familie, mit oder ohne SI-Vorsatz): 0 V, 1 A, 2 Ω, 3 Hz, 4 Sonstiges */
  function modeOf(unit) {
    const u = String(unit == null ? '' : unit), m = /^[pnµumkMG]?(V|A|Ω|Hz)$/.exec(u);
    if (!m) return { mode: '', pos: 4 };
    return { mode: m[1], pos: { V: 0, A: 1, 'Ω': 2, Hz: 3 }[m[1]] };
  }

  /* Anzeige eines Messwerts. o = { digits, ol, inf, infText, text, none }
     -> { kind: 'num'|'ol'|'text'|'none', cells: [{ch, dp}], n, neg, unit, text, count, conform }
     text = Klartext mit Dezimalkomma (wie meterText der Labs), count = Ziffernzahl als ganze Zahl (|Wert| * 10^digits), conform = passt in 3½ Stellen (count <= 1999, vier Felder). */
  function format(value, unit, o) {
    o = o || {}; unit = unit == null ? '' : String(unit);
    const textRes = t => ({ kind: 'text', cells: [], n: MINC, neg: false, unit: '', text: String(t), count: null, conform: true });
    const noneRes = () => ({ kind: 'none', cells: [0, 1, 2, 3].map(() => ({ ch: '-', dp: false })), n: MINC, neg: false, unit: '', text: '–', count: null, conform: true });
    const olRes = () => ({ kind: 'ol', cells: [{ ch: ' ', dp: false }, { ch: ' ', dp: false }, { ch: 'O', dp: false }, { ch: 'L', dp: false }], n: MINC, neg: false, unit, text: 'OL', count: null, conform: true });
    try {
      if (o.none) return noneRes();
      if (o.text != null && o.text !== '') return textRes(o.text);
      if (!fin(value)) return noneRes();
      if (o.ol || o.inf || Math.abs(value) >= 1e21) return o.infText && !o.ol ? textRes(o.infText) : unit === '' && !o.ol ? textRes('∞') : olRes();
      let d = o.digits == null ? 1 : Math.round(+o.digits); if (!fin(d) || d < 0) d = 0; if (d > 8) d = 8;
      const a = Math.abs(value), s = a.toFixed(d), ip = s.indexOf('.') < 0 ? s.length : s.indexOf('.'), ds = s.replace('.', '');
      const neg = value < 0 && /[1-9]/.test(ds), text = (neg ? '-' : '') + s.replace('.', ',');
      if (ds.length > MAXC) return textRes(text);
      const n = Math.max(MINC, ds.length), pad = n - ds.length, cells = [];
      for (let i = 0; i < n; i++) cells.push({ ch: i < pad ? ' ' : ds[i - pad], dp: d > 0 && i - pad === ip - 1 });
      const count = parseInt(ds, 10);
      return { kind: 'num', cells, n, neg, unit, text, count, conform: ds.length <= MINC && count <= 1999 };
    } catch (e) { return noneRes(); }
  }

  /* ============================================================ DOM */
  const HAS_DOM = typeof document !== 'undefined' && typeof document.createElement === 'function';
  const SEGP = { a: '4,0 16,0 17,1 15,3 5,3 3,1', b: '18,3 19,4 19,16.5 18,17.5 16,15.5 16,5', c: '18,19 19,20 19,32.5 18,33.5 16,31.5 16,21', d: '4,36 16,36 17,35 15,33 5,33 3,35',
    e: '2,19 1,20 1,32.5 2,33.5 4,31.5 4,21', f: '2,3 1,4 1,16.5 2,17.5 4,15.5 4,5', g: '4,18 6,16.5 14,16.5 16,18 14,19.5 6,19.5' };
  const PITCH = 24, H0 = 14;
  const digitSvg = i => '<g class="dg" transform="translate(' + (H0 + i * PITCH) + ' 4)">' + Object.keys(SEGP).map(k => '<polygon class="seg off ' + k + '" points="' + SEGP[k] + '"/>').join('') + '<circle class="seg off dp" cx="21.8" cy="34.5" r="1.9"/></g>';
  function lcdSvg(kind, n, unit) {
    const uw = unit ? 6 + 9 * unit.length : 6, W = H0 + (kind === 'text' ? MINC : n) * PITCH + uw;
    let inner = '';
    if (kind === 'text') inner = '<text class="txt" x="' + (W / 2) + '" y="30" text-anchor="middle"></text>';
    else {
      inner = '<polygon class="seg off sgn" points="2,20.5 11,20.5 11,23.5 2,23.5"/>';
      for (let i = 0; i < n; i++) inner += digitSvg(i);
      inner += '<text class="unit" x="' + (H0 + n * PITCH) + '" y="38">' + esc(unit) + '</text>';
    }
    return '<svg class="gd-svg" viewBox="0 0 ' + W + ' 44" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">' + inner + '</svg>';
  }
  const baseSvg = pos => '<svg class="gd-base" viewBox="0 0 150 34" aria-hidden="true" focusable="false"><circle cx="17" cy="17" r="15" class="dial"/>'
    + [0, 1, 2, 3, 4].map(p => { const a = (-90 + p * 45) * Math.PI / 180; return '<line class="tick" x1="' + (17 + Math.sin(a) * 11).toFixed(1) + '" y1="' + (17 - Math.cos(a) * 11).toFixed(1) + '" x2="' + (17 + Math.sin(a) * 14).toFixed(1) + '" y2="' + (17 - Math.cos(a) * 14).toFixed(1) + '"/>'; }).join('')
    + '<g class="knob" transform="rotate(' + (-90 + pos * 45) + ' 17 17)"><circle cx="17" cy="17" r="8" class="kn"/><rect x="15.5" y="6" width="3" height="9" rx="1.5" class="ptr"/></g>'
    + '<circle cx="86" cy="17" r="7" class="jack black"/><circle cx="110" cy="17" r="7" class="jack red"/><circle cx="134" cy="17" r="7" class="jack red"/></svg>';

  /* gemeinsame Beobachtung der Querformat-Bedingung für compact:'auto' (gleiche Bedingung wie design.css, Punkt 1, dazu Handybreite bis 600 px) */
  const MQ = '(orientation:landscape) and (max-height:900px) and (min-width:900px), (max-width:600px)', autos = new Set(); let mq = null;
  const applyAuto = () => { const on = !!(mq && mq.matches); autos.forEach(h => h.el.classList.toggle('compact', on)); };
  function watchAuto(h) {
    if (!mq && typeof root.matchMedia === 'function') { try { mq = root.matchMedia(MQ); (mq.addEventListener ? mq.addEventListener('change', applyAuto) : mq.addListener && mq.addListener(applyAuto)); } catch (e) { mq = null; } }
    autos.add(h); h.el.classList.toggle('compact', !!(mq && mq.matches));
  }

  function renderMultimeter(el, state, opts) {
    opts = opts || {}; state = state || {};
    const H = { el: null, over: false, update() {}, flush() {}, destroy() {} };
    if (!HAS_DOM || !el) return H;
    try {
      const st0 = state, root0 = document.createElement('div'); root0.className = 'ger-dmm' + (opts.compact === true ? ' compact' : '');
      root0.setAttribute('role', 'group');
      root0.innerHTML = '<div class="gd-lbl"></div><div class="gd-lcd"><div class="gd-box"></div><div class="gd-flags"><span class="gd-auto"></span><span class="gd-rng"></span></div></div><div class="gd-bw"></div><span class="sr" aria-live="' + (opts.ariaLive ? 'polite' : 'off') + '"></span>';
      el.appendChild(root0); H.el = root0;
      const q = s => root0.querySelector(s), lbl = q('.gd-lbl'), box = q('.gd-box'), auto = q('.gd-auto'), rng = q('.gd-rng'), bw = q('.gd-bw'), sr = q('.sr');
      let layout = '', cells = [], sgn = null, unitEl = null, txtEl = null, lastLbl = null, lastHelp = null, lastWarn = null, lastMode = -1, lastSrT = '', srAt = 0, srTimer = 0, pend = null, lastKey = null, raf = 0, tmo = 0, dead = false;
      const setCls = (node, on) => { node.setAttribute('class', node.getAttribute('class').replace(/ ?\boff\b/, '') + (on ? '' : ' off')); };
      function writeSr(t) { sr.textContent = t; srAt = Date.now(); lastSrT = t; srTimer = 0; }
      function srText(t) {
        if (t === lastSrT) return; const now = Date.now();
        if (now - srAt >= 600 || /: –$/.test(lastSrT) || lastSrT === '') { if (srTimer) { clearTimeout(srTimer); srTimer = 0; } writeSr(t); } else { pend = t; if (!srTimer) srTimer = setTimeout(() => { if (!dead && pend != null) writeSr(pend); }, 600 - (now - srAt) + 5); }
      }
      function apply(s) {
        if (dead) return; s = s || {};
        const f = format(s.value, s.unit, { digits: s.digits, ol: s.ol, inf: s.inf, infText: s.infText, text: s.text, none: s.none });
        H.over = !f.conform;
        const lay = f.kind === 'text' ? 'T|' + f.n + '|' : f.n + '|' + f.unit;
        if (lay !== layout) {
          layout = lay; box.innerHTML = lcdSvg(f.kind === 'text' ? 'text' : 'num', f.n, f.unit);
          if (f.kind === 'text') { txtEl = box.querySelector('.txt'); cells = []; sgn = null; unitEl = null; }
          else { txtEl = null; sgn = box.querySelector('.sgn'); unitEl = box.querySelector('.unit'); cells = [].slice.call(box.querySelectorAll('.dg')).map(g => ({ k: null, segs: {}, dp: g.querySelector('.dp'), g })); cells.forEach(c => { ['a', 'b', 'c', 'd', 'e', 'f', 'g'].forEach(k => { c.segs[k] = c.g.querySelector('.' + k); }); }); }
          sgn && (sgn.__on = null);
        }
        if (f.kind === 'text') {
          const t = f.text.length > 18 ? f.text.slice(0, 17) + '…' : f.text, fs = t.length > 12 ? 12 : t.length > 8 ? 15 : 20;
          if (txtEl.textContent !== t) txtEl.textContent = t; if (txtEl.getAttribute('font-size') !== String(fs)) txtEl.setAttribute('font-size', String(fs));
        } else {
          const on = f.neg; if (sgn.__on !== on) { sgn.__on = on; setCls(sgn, on); }
          f.cells.forEach((c, i) => {
            const cc = cells[i]; if (!cc) return; const k = c.ch + (c.dp ? '.' : ''); if (cc.k === k) return; cc.k = k;
            const m = SEG[c.ch] || ''; for (const sk in cc.segs) setCls(cc.segs[sk], m.indexOf(sk) >= 0); setCls(cc.dp, c.dp);
          });
        }
        /* Bereichsanzeige: nur aus dem Wert selbst abgeleitet, wie jedes Handmultimeter */
        const isNum = f.kind === 'num', rtx = isNum ? rangeText(autoRange(s.value, s.ranges).range, s.unit) : '', atx = f.kind === 'none' ? '' : 'AUTO';
        if (auto.textContent !== atx) auto.textContent = atx; if (rng.textContent !== rtx) rng.textContent = rtx;
        const lb = s.label == null ? '' : String(s.label); if (lb !== lastLbl) { lastLbl = lb; lbl.textContent = lb; root0.setAttribute('aria-label', 'Multimeter ' + lb); }
        const hp = s.help == null ? '' : String(s.help); if (hp !== lastHelp) { lastHelp = hp; if (hp) root0.setAttribute('title', hp); else root0.removeAttribute('title'); }
        const wn = !!s.warn; if (wn !== lastWarn) { lastWarn = wn; root0.classList.toggle('warn', wn); }
        const md = modeOf(s.unit).pos; if (md !== lastMode) { lastMode = md; bw.innerHTML = baseSvg(md); }
        srText(lb + ': ' + (f.kind === 'ol' ? 'Überlauf, OL' : f.text) + (f.kind === 'num' || f.kind === 'ol' ? (s.unit ? ' ' + s.unit : '') : ''));
      }
      function flush() { if (raf) { try { root.cancelAnimationFrame && root.cancelAnimationFrame(raf); } catch (e) {} raf = 0; } if (tmo) { clearTimeout(tmo); tmo = 0; } if (pendS) { const s = pendS; pendS = null; apply(s); } }
      let pendS = null;
      H.update = function (s) {
        if (dead) return; s = s || {};
        const k = s.value + '|' + s.unit + '|' + s.digits + '|' + (s.ol ? 1 : 0) + (s.inf ? 1 : 0) + (s.none ? 1 : 0) + (s.warn ? 1 : 0) + '|' + s.text + '|' + s.label + '|' + s.help + '|' + s.infText + '|' + (s.ranges ? s.ranges.length : '');
        if (k === lastKey) return; lastKey = k; pendS = s;
        if (!raf && !tmo) {
          if (typeof root.requestAnimationFrame === 'function') raf = root.requestAnimationFrame(() => { raf = 0; flush(); }); else { flush(); return; }
          tmo = setTimeout(() => { tmo = 0; flush(); }, 120);
        }
      };
      H.flush = flush;
      H.destroy = function () { dead = true; autos.delete(H); if (raf) { try { root.cancelAnimationFrame && root.cancelAnimationFrame(raf); } catch (e) {} } if (tmo) clearTimeout(tmo); if (srTimer) clearTimeout(srTimer); if (root0.parentNode) root0.parentNode.removeChild(root0); };
      H.update(st0); H.flush();
      if (opts.compact === 'auto' || opts.compact == null) watchAuto(H);
    } catch (e) { try { console.error(e); } catch (x) {} }
    return H;
  }

  G.renderMultimeter = renderMultimeter;
  G.fn = { format, autoRange, seg7, rangeText, modeOf, RANGES, SEG, MINC, MAXC };
  if (typeof module !== 'undefined' && module.exports) module.exports = G;
})(typeof window !== 'undefined' ? window : globalThis);
