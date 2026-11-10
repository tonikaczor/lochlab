'use strict';
/* Tonfunk MessLab: Visualisierung (Lab-Kennung 'mess'). Datei wird in messlab.html NACH messplus.js geladen.
   Hängt sich an die Karten der Werkbank (Multimeter, Oszilloskop) und zeigt dazu Bilder, ohne mess.js oder die Aufgaben zu verändern:
     Multimeter:    Frontplatte mit Zeigerinstrument (Skala passend zum Messbereich), Drehschalter in der gewählten Stellung
                    und den Buchsen COM, VΩ, mA, 10 A mit der gewählten roten Buchse. Das Bild zeigt nur, was am Gerät eingestellt ist
                    und was die Anzeige zeigt (Zahl wird aus dem Anzeigetext gelesen). Kein Urteil, kein Hinweis auf richtige Buchse oder richtigen Bereich.
     Oszilloskop:   Tastkopf mit Spitze, Masseklemme und Schalter in der eingestellten Stellung (nur Darstellung der Einstellung).
   Der Bildschirm des Oszilloskops (Glühen der Spuren, Kanalbeschriftung mit Teilung je Kanal) wird in mess.js gezeichnet.
   Reine Funktionen (liefern SVG-Text, ohne DOM) sind mit node quelle/mess/test_messviz.js prüfbar.
   Farben: Text, Linien, Flächen über CSS-Variablen der Seite; Bewegung: keine Animation, die Anzeige wird 5-mal je Sekunde aufgefrischt. */
(function (root) {
  const fin = Number.isFinite, q = v => (fin(v) ? Math.round(v * 10) / 10 : 0);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const T = (x, y, t, cls, anchor) => `<text class="${cls || ''}" x="${q(x)}" y="${q(y)}"${anchor ? ' text-anchor="' + anchor + '"' : ''}>${esc(t)}</text>`;
  const svg = (W, H, label, body) => `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${body}</svg>`;
  const PRE = { p: 1e-12, n: 1e-9, 'µ': 1e-6, u: 1e-6, m: 1e-3, '': 1, k: 1e3, M: 1e6, G: 1e9 };
  const PFX = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']];
  const dec = (v, d) => (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toString().replace('.', ',');

  /* ============================================================ Anzeige lesen (rein) */
  /* "4,500 V" -> { kind: 'num', value: 4.5, unit: 'V', text } ; "OL"/"F ✗" -> ol ; "--" -> none ; "12,0 mA" -> 0,012 A */
  function parseReading(txt) {
    const s = String(txt == null ? '' : txt).trim();
    if (!s || /^[-–—]+$/.test(s) || s === '--') return { kind: 'none', value: NaN, unit: '', text: s };
    if (/^(OL|∞|F\s*✗)/i.test(s)) return { kind: 'ol', value: NaN, unit: '', text: s };
    const m = s.match(/^([-+−]?\s*\d+(?:[.,]\d+)?)\s*([pnuµmkMG]?)\s*(V|A|Ω)/);
    if (!m) return { kind: 'none', value: NaN, unit: '', text: s };
    const x = parseFloat(m[1].replace(/\s/g, '').replace('−', '-').replace(',', '.')), p = PRE[m[2]] == null ? 1 : PRE[m[2]];
    return fin(x) ? { kind: 'num', value: x * p, unit: m[3], text: s } : { kind: 'none', value: NaN, unit: '', text: s };
  }
  /* Messbereich wie bei Digitalmultimetern: 2 / 20 / 200 / 2000 ... (Vollausschlag in Grundeinheiten); Reihe 2e-6 bis 2e9 */
  function rangeFor(value) {
    const a = Math.abs(value); if (!fin(a)) return null; if (a === 0) return 2;
    for (let k = -6; k <= 9; k++) { const r = 2 * Math.pow(10, k); if (a <= r * (1 + 1e-9)) return r; }
    return 2e9;
  }
  /* 0,02 -> "20 m" (Vorsatz), Wert 20 -> "20 " */
  function engText(v, unit) {
    if (!fin(v)) return '';
    if (v === 0) return '0 ' + (unit || '');
    for (let i = 0; i < PFX.length; i++) if (Math.abs(v) >= PFX[i][0] * 0.999999) return dec(v / PFX[i][0], 3) + ' ' + PFX[i][1] + (unit || '');
    return dec(v / 1e-12, 3) + ' p' + (unit || '');
  }
  /* Zeigerwinkel (Grad von der Senkrechten) für Anteil frac (0..1); über Vollausschlag begrenzt auf 1,05 */
  const SWEEP = 50;
  function needleAngle(frac) { const f = Math.max(0, Math.min(1.05, fin(frac) ? frac : 0)); return -SWEEP + 2 * SWEEP * f; }

  /* ============================================================ Multimeter-Frontplatte (rein) */
  /* st: { dial: 'V='|'V~'|'A'|'R', jack: 'V'|'mA'|'10A', text } */
  const DIALS = [['V=', 'V⎓', -78], ['V~', 'V∿', -26], ['R', 'Ω', 26], ['A', 'A', 78]];
  const JACKS = [['COM', 'COM', 'com'], ['V', 'VΩ', 'v'], ['mA', 'mA', 'ma'], ['10A', '10 A', 'ta']];
  const UNIT = { 'V=': 'V', 'V~': 'V', A: 'A', R: 'Ω' };
  function dmmSvg(st) {
    st = st || {}; const dial = DIALS.some(d => d[0] === st.dial) ? st.dial : 'V=', jack = ['V', 'mA', '10A'].indexOf(st.jack) >= 0 ? st.jack : 'V', rd = parseReading(st.text), W = 280, H = 214;
    const unit = rd.kind === 'num' ? rd.unit : UNIT[dial], range = rd.kind === 'num' ? rangeFor(rd.value) : null, frac = rd.kind === 'num' && range ? Math.abs(rd.value) / range : (rd.kind === 'ol' ? 1.05 : 0);
    const cx = 140, cy = 112, R = 90, rr = (r, deg) => [cx + r * Math.sin(deg * Math.PI / 180), cy - r * Math.cos(deg * Math.PI / 180)];
    let s = `<rect class="pn" x="1" y="1" width="${W - 2}" height="${H - 2}" rx="12"/><rect class="face" x="14" y="12" width="${W - 28}" height="106" rx="8"/>`;
    // Skalenbogen und Teilung 0 bis 10
    const a0 = rr(R, -SWEEP), a1 = rr(R, SWEEP); s += `<path class="arc" d="M${q(a0[0])} ${q(a0[1])} A${R} ${R} 0 0 1 ${q(a1[0])} ${q(a1[1])}"/>`;
    for (let i = 0; i <= 10; i++) {
      const deg = -SWEEP + 2 * SWEEP * i / 10, p1 = rr(R, deg), p2 = rr(R - (i % 2 ? 6 : 10), deg);
      s += `<line class="${i % 2 ? 'tk1' : 'tk2'}" x1="${q(p1[0])}" y1="${q(p1[1])}" x2="${q(p2[0])}" y2="${q(p2[1])}"/>`;
      if (i % 2 === 0) { const pt = rr(R - 22, deg), v = range ? range * i / 10 : null; s += T(pt[0], pt[1] + 4, v == null ? String(i) : dec(v / (PFX.find(p => range >= p[0] * 0.999999) || [1])[0], 2), 'sc', 'middle'); }
    }
    // Einheit und Bereich auf dem Zifferblatt
    const pre = range ? (PFX.find(p => range >= p[0] * 0.999999) || [1, ''])[1] : '';
    s += T(cx, 84, pre + (unit || ''), 'un', 'middle');
    s += T(24, 32, rd.kind === 'num' && range ? 'Bereich ' + engText(range, unit) + ' (Auto)' : rd.kind === 'ol' ? 'Überlauf' : 'kein Messwert', 'rg');
    // Zeiger
    const ang = needleAngle(frac), tip = rr(R - 6, ang), over = rd.kind === 'ol' || frac > 1.0001;
    s += `<line class="nd${over ? ' bad' : ''}" x1="${cx}" y1="${cy}" x2="${q(tip[0])}" y2="${q(tip[1])}"/><circle class="pv" cx="${cx}" cy="${cy}" r="6"/>`;
    // Drehschalter
    const dx = 62, dy = 168, dr = 27; s += `<circle class="knob" cx="${dx}" cy="${dy}" r="${dr}"/>`;
    DIALS.forEach(d => {
      const on = d[0] === dial, p = rr(dr + 5, d[2]), pl = [dx + (dr + 15) * Math.sin(d[2] * Math.PI / 180), dy - (dr + 15) * Math.cos(d[2] * Math.PI / 180)];
      s += `<circle class="dt${on ? ' on' : ''}" cx="${q(dx + (dr + 5) * Math.sin(d[2] * Math.PI / 180))}" cy="${q(dy - (dr + 5) * Math.cos(d[2] * Math.PI / 180))}" r="${on ? 3.4 : 2.4}"/>` + T(pl[0], pl[1] + 4, d[1], on ? 'dl on' : 'dl', 'middle');
    });
    const dd = DIALS.find(d => d[0] === dial), tp = [dx + (dr - 4) * Math.sin(dd[2] * Math.PI / 180), dy - (dr - 4) * Math.cos(dd[2] * Math.PI / 180)];
    s += `<line class="ptr" x1="${dx}" y1="${dy}" x2="${q(tp[0])}" y2="${q(tp[1])}"/><circle class="ptc" cx="${dx}" cy="${dy}" r="5"/>`;
    // Buchsen
    const bx = [150, 184, 218, 252], by = 170;
    s += T(205, 142, 'Buchsen', 'lbm', 'middle');
    JACKS.forEach((j, i) => {
      const x = bx[i], red = j[0] !== 'COM', sel = red && j[0] === jack, com = j[0] === 'COM';
      s += `<circle class="jk ${com ? 'com' : 'rd'}${sel ? ' sel' : ''}" cx="${x}" cy="${by}" r="11"/><circle class="jh" cx="${x}" cy="${by}" r="4"/>` + (sel ? `<circle class="jr" cx="${x}" cy="${by}" r="15"/>` : '');
      s += T(x, by + 30, j[1], sel ? 'jl on' : 'jl', 'middle');
      if (com) s += `<line class="ld blk" x1="${x}" y1="${by + 11}" x2="${x}" y2="${by + 17}"/>`;
    });
    return svg(W, H, 'Multimeter-Frontplatte: Zeigerinstrument, Drehschalter auf ' + dd[1] + ', rote Buchse ' + (JACKS.find(j => j[0] === jack) || [0, 'VΩ'])[1], s);
  }

  /* ============================================================ Tastkopf (rein) */
  /* x10: Schalter steht auf ×10 (true) oder ×1 (false) */
  function probeSvg(x10) {
    const W = 360, H = 124, on = x10 ? 10 : 1;
    let s = `<path class="cab" d="M30 56 C70 56 80 64 118 64"/><rect class="bnc" x="8" y="46" width="26" height="20" rx="4"/><circle class="bnch" cx="21" cy="56" r="4"/>`;
    s += `<rect class="body" x="118" y="46" width="132" height="36" rx="12"/><rect class="grip" x="128" y="52" width="60" height="24" rx="6"/>`;
    // Schalter ×1 / ×10
    s += `<rect class="slot" x="196" y="52" width="44" height="14" rx="7"/><circle class="sw" cx="${on === 10 ? 232 : 204}" cy="59" r="6.5"/>`;
    s += T(204, 80, '×1', on === 1 ? 'sl on' : 'sl', 'middle') + T(232, 80, '×10', on === 10 ? 'sl on' : 'sl', 'middle');
    // Spitze mit Haken
    s += `<polygon class="tipm" points="250,58 286,63 250,70"/><path class="hook" d="M286 63 q 14 -2 14 8 q 0 8 -10 7"/>`;
    // Masseleitung mit Klemme
    s += `<path class="cab gnd" d="M150 82 C150 100 130 104 112 104"/><polygon class="clip" points="82,97 112,101 112,107 82,111"/><line class="jaw" x1="82" y1="104" x2="112" y2="104"/>`;
    s += T(68, 100, 'Masse', 'pl', 'end') + T(318, 100, 'Spitze', 'pl', 'middle') + T(204, 40, 'Schalter', 'pl', 'middle') + T(21, 82, 'BNC', 'pl', 'middle');
    return svg(W, H, 'Tastkopf mit Spitze, Masseklemme und Schalter auf ×' + on, s);
  }

  const API = { parseReading, rangeFor, engText, needleAngle, dmmSvg, probeSvg, DIALS, JACKS, SWEEP };
  root.MESS_VIZ = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;

  /* ============================================================ Einbau in die Seite (nur im Browser) */
  if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') return;
  const CSS = `.mvbox{background:var(--panel2);border:1px solid var(--line);border-radius:12px;overflow:hidden;margin:6px 0}
.mvbox svg{display:block;width:100%;height:auto}
.mvbox svg text{font-family:system-ui,sans-serif;font-size:12.5px;fill:var(--fg);-webkit-user-select:none;user-select:none}
.mvbox svg .sc{font-size:11.5px;fill:var(--mute)}.mvbox svg .un{font-size:26px;font-weight:700;fill:var(--mute);opacity:.55}.mvbox svg .rg{font-size:12.5px;font-weight:600;fill:var(--fg)}.mvbox svg .lbm{font-size:11.5px;fill:var(--mute)}
.mvbox svg .dl{font-size:12.5px;font-weight:600;fill:var(--mute)}.mvbox svg .dl.on{fill:var(--accent);font-weight:700}.mvbox svg .jl{font-size:12px;fill:var(--mute)}.mvbox svg .jl.on{fill:var(--danger);font-weight:700}
.mvbox svg .pl{font-size:12px;fill:var(--mute)}.mvbox svg .sl{font-size:12.5px;fill:var(--mute);font-weight:600}.mvbox svg .sl.on{fill:var(--accent);font-weight:700}
.mvbox svg .pn{fill:var(--panel);stroke:var(--line);stroke-width:1.5}.mvbox svg .face{fill:var(--bg);stroke:var(--line);stroke-width:1.5}
.mvbox svg .arc{fill:none;stroke:var(--fg);stroke-width:1.6}.mvbox svg .tk1{stroke:var(--mute);stroke-width:1.4}.mvbox svg .tk2{stroke:var(--fg);stroke-width:2}
.mvbox svg .nd{stroke:var(--danger);stroke-width:2.6;stroke-linecap:round}.mvbox svg .nd.bad{stroke-dasharray:none}.mvbox svg .pv{fill:var(--fg)}
.mvbox svg .knob{fill:var(--panel2);stroke:var(--fg);stroke-opacity:.6;stroke-width:2}.mvbox svg .dt{fill:var(--mute)}.mvbox svg .dt.on{fill:var(--accent)}
.mvbox svg .ptr{stroke:var(--accent);stroke-width:4;stroke-linecap:round}.mvbox svg .ptc{fill:var(--panel);stroke:var(--fg);stroke-opacity:.5;stroke-width:1.5}
.mvbox svg .jk{stroke:var(--fg);stroke-opacity:.55;stroke-width:1.5}.mvbox svg .jk.com{fill:var(--mute)}.mvbox svg .jk.rd{fill:var(--panel2)}.mvbox svg .jk.rd.sel{fill:var(--danger);fill-opacity:.55;stroke:var(--danger);stroke-opacity:1}
.mvbox svg .jh{fill:var(--bg)}.mvbox svg .jr{fill:none;stroke:var(--danger);stroke-width:2;stroke-dasharray:3 3}
.mvbox svg .ld{stroke:var(--mute);stroke-width:3}
.mvbox svg .cab{fill:none;stroke:var(--mute);stroke-width:4;stroke-linecap:round}.mvbox svg .cab.gnd{stroke-width:3}.mvbox svg .bnc{fill:var(--panel);stroke:var(--fg);stroke-opacity:.6;stroke-width:1.5}.mvbox svg .bnch{fill:var(--mute)}
.mvbox svg .body{fill:var(--panel);stroke:var(--fg);stroke-opacity:.6;stroke-width:1.5}.mvbox svg .grip{fill:var(--panel2);stroke:var(--line)}
.mvbox svg .slot{fill:var(--bg);stroke:var(--line)}.mvbox svg .sw{fill:var(--accent)}.mvbox svg .tipm{fill:var(--mute)}.mvbox svg .hook{fill:none;stroke:var(--mute);stroke-width:3;stroke-linecap:round}
.mvbox svg .clip{fill:var(--mute)}.mvbox svg .jaw{stroke:var(--bg);stroke-width:1.5}
.mvcap{margin:2px 2px 8px;font-size:12.5px;color:var(--mute)}
canvas[data-cv].mvscope{border:2px solid var(--line);box-shadow:inset 0 0 18px rgba(0,0,0,.55)}`;
  const st = document.createElement('style'); st.id = 'messviz-css'; st.textContent = CSS; document.head.appendChild(st);

  /* Multimeter-Karte: Zustand aus den Bedienknöpfen und dem Anzeigetext lesen */
  function dmmState(card) {
    const d = card.querySelector('[data-dials] .wbb.on'), j = card.querySelector('[data-jacks] .wbb.on'), v = card.querySelector('[data-v]');
    return { dial: d ? d.dataset.d : 'V=', jack: j ? j.dataset.j : 'V', text: v ? v.textContent : '' };
  }
  function syncDmm() {
    document.querySelectorAll('.wblcd[data-v]').forEach(lcd => {
      const card = lcd.parentNode; if (!card) return;
      let box = card.querySelector(':scope > .mvbox.mvdmm');
      if (!box) { box = document.createElement('div'); box.className = 'mvbox mvdmm'; card.insertBefore(box, card.firstChild); }
      const key = JSON.stringify(dmmState(card)); if (box.__k === key) return; box.__k = key;
      try { box.innerHTML = dmmSvg(dmmState(card)); } catch (e) {}
    });
  }
  function syncProbe() {
    document.querySelectorAll('[data-ctl2]').forEach(ctl => {
      const card = ctl.parentNode; if (!card || !card.querySelector('[data-cv]')) return;
      let box = card.querySelector(':scope > .mvbox.mvprobe');
      if (!box) { box = document.createElement('div'); box.className = 'mvbox mvprobe'; ctl.parentNode.insertBefore(box, ctl.nextSibling); const c = document.createElement('p'); c.className = 'mvcap'; c.textContent = 'Der Tastkopf verbindet die Schaltung mit dem Oszilloskop. Die Spitze greift das Signal ab, die Masseklemme kommt an Masse. Beim 10:1-Tastkopf liegt der Schalter auf ×10: Er teilt das Signal durch 10 und belastet die Schaltung weniger (Richtwert 10 MΩ parallel etwa 12 pF).'; box.__cap = c; box.after(c); }
      const px = ctl.querySelector('[data-px]'), x10 = !!px && /×\s*10/.test(px.textContent), key = String(x10); if (box.__k === key) return; box.__k = key;
      try { box.innerHTML = probeSvg(x10); } catch (e) {}
    });
    document.querySelectorAll('canvas[data-cv][width="600"]').forEach(c => c.classList.add('mvscope'));
  }
  function tick() { try { syncDmm(); syncProbe(); } catch (e) {} }
  function init() { tick(); setInterval(tick, 200); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : globalThis);
