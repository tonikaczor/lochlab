'use strict';
/* Tonfunk Plan-Lab: Zeichnungen (Lab-Kennung 'bmk'). Reine Funktionen, die SVG-Text liefern (ohne DOM, testbar mit node quelle/bmk/test_bmkviz.js).
   Wird in bmklab.html VOR bmkui.js geladen und fügt sein CSS einmal in die Seite ein.
   Bilder: Schaltzeichen, Stromlaufplan der Übungsanlage (Strompfade, Kontakte, Kontaktspiegel, Stromfluss), Referenzkennzeichen als Bausteine,
   Klemmenplan als Klemmleiste, Kontaktspiegel einer Relaisspule.
   Schrift im Bild mindestens 12 px bei 380 px Breite (auf dem iPhone mit 390 px Breite gut 11 px). Farben nur über die CSS-Variablen der Seite
   (Ausnahme: Aderfarben, sie sind Teil der Aussage). Bewegung nur bei prefers-reduced-motion: no-preference, jedes Bild ist ohne Bewegung vollständig.
   Verdeckte Antworten: Bilder in Aufgaben zeigen nie Namen oder Ergebnis, nach denen gefragt wird. */
(function (root) {
  const C = root.BMK_CORE || (typeof require === 'function' ? require('./bmkcore.js') : null);
  const q = v => Math.round(v * 10) / 10;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const T = (x, y, t, cls, extra) => `<text class="${cls || ''}" x="${q(x)}" y="${q(y)}"${extra || ''}>${esc(t)}</text>`;
  const RC = (x, y, w, h, cls, rx) => `<rect class="${cls || ''}" x="${q(x)}" y="${q(y)}" width="${q(w)}" height="${q(h)}"${rx ? ' rx="' + rx + '"' : ''}/>`;
  const svg = (vw, vh, label, body, cls) => `<svg class="bmv${cls ? ' ' + cls : ''}" viewBox="0 0 ${vw} ${vh}" role="img" aria-label="${esc(label)}">${body}</svg>`;
  /* Leitung; mit Strom bekommt sie eine zweite, bewegte Linie darüber (Richtung: von (x1,y1) nach (x2,y2)) */
  function W(x1, y1, x2, y2, on) {
    const a = `x1="${q(x1)}" y1="${q(y1)}" x2="${q(x2)}" y2="${q(y2)}"`;
    return `<line class="w${on ? ' on' : ''}" ${a}/>` + (on ? `<line class="wf" ${a}/>` : '');
  }

  /* ============================================================ Schaltzeichen: Zeichnung im Feld 100 x 100, Anschlüsse oben und unten */
  const P = d => `<path class="sl" d="${d}"/>`;
  function symBody(k) {
    switch (k) {
      case 'schliesser': return P('M50 0V30M50 100V70M50 70L32 34');
      case 'oeffner': return P('M50 0V30H34M50 100V70M50 70L34 30');
      case 'taster': return P('M50 0V30M50 100V70M50 70L32 34') + '<path class="sl sd" d="M41 52H20"/>' + P('M20 42V62M20 52H8');
      case 'spule': return '<rect class="sl sf" x="30" y="26" width="40" height="48" rx="2"/>' + P('M50 0V26M50 74V100');
      case 'motor': return '<circle class="sl sf" cx="50" cy="58" r="28"/>' + P('M32 0V37M50 0V30M68 0V37') + '<text class="symt big mid" x="50" y="58">M</text><text class="symt mid" x="50" y="76">3~</text>';
      case 'sicherung': return '<rect class="sl sf" x="38" y="26" width="24" height="48"/>' + P('M50 0V100');
      case 'leuchte': return '<circle class="sl sf" cx="50" cy="50" r="24"/>' + P('M33 33L67 67M67 33L33 67M50 0V26M50 74V100');
      case 'widerstand': return '<rect class="sl sf" x="36" y="28" width="28" height="44"/>' + P('M50 0V28M50 72V100');
      case 'kondensator': return P('M28 42H72M28 58H72M50 0V42M50 58V100');
      case 'diode': return '<path class="sl sf" d="M32 28H68L50 64Z"/>' + P('M30 64H70M50 0V28M50 64V100');
      case 'hauptk3': return [20, 50, 80].map(x => P(`M${x} 0V26M${x} 100V74M${x} 74L${x - 14} 34`)).join('') + '<path class="sl sd" d="M13 54H73"/>';
      case 'trafo': return '<circle class="sl" cx="38" cy="50" r="17"/><circle class="sl" cx="62" cy="50" r="17"/>' + P('M38 0V33M38 67V100M62 0V33M62 67V100');
      case 'batterie': return P('M26 40H74M50 0V40M50 54V100') + '<path class="sl" style="stroke-width:5" d="M38 54H62"/><text class="symt mid" x="34" y="32">+</text>';
      case 'klemme': return '<circle class="sl sf" cx="50" cy="56" r="9"/>' + P('M50 0V47');
      default: return '';
    }
  }
  /* klein (Karten) ohne Beschriftung im Zeichen, oder groß als Aufgabenbild */
  const symSvg = k => { const s = C.symOf(k); return s ? svg(100, 100, s.n, symBody(k), 'sm') : ''; };
  const symBig = k => svg(360, 150, 'Schaltzeichen', `<g transform="translate(115 10) scale(1.3)">${symBody(k)}</g>`);

  /* ============================================================ Stromlaufplan der Übungsanlage */
  const XS = { 1: 40, 2: 112, 3: 164, 4: 218, 5: 270, 6: 322 }, TOP = 36, BOT = 290, POLE = [22, 40, 58];
  /* Kontakt von (cx,y) bis (cx,y+44): Anschlüsse oben und unten, Schaltstück darin. closed = Kontakt geschlossen, on = es fließt Strom, btn = Handbetätigung (Taster) */
  function contact(cx, y, typ, closed, on, btn) {
    const sg = (x1, y1, x2, y2) => `<line class="sl${on ? ' on' : ''}" x1="${q(x1)}" y1="${q(y1)}" x2="${q(x2)}" y2="${q(y2)}"/>`;
    let b = W(cx, y, cx, y + 14, on) + W(cx, y + 30, cx, y + 44, on);
    if (typ === 'S') b += closed ? sg(cx, y + 30, cx, y + 14) : sg(cx, y + 30, cx - 11, y + 16);
    else b += sg(cx, y + 14, cx - 10, y + 14) + (closed ? sg(cx, y + 30, cx - 10, y + 14) : sg(cx, y + 30, cx + 11, y + 17));
    if (btn) b += `<line class="sl sd" x1="${cx - 5}" y1="${y + 22}" x2="${cx - 20}" y2="${y + 22}"/><line class="sl" x1="${cx - 20}" y1="${y + 15}" x2="${cx - 20}" y2="${y + 29}"/>`;
    return b;
  }
  const dv = (dev, sel, hb, body) => `<g class="dv${sel === dev ? ' sel' : ''}" data-dev="${dev}">${RC(hb[0], hb[1], hb[2], hb[3], 'hlr', 6)}${body}</g>`;
  const lab = (x, y, a, b) => T(x, y, a, '') + (b ? T(x, y + 14, b, '') : '');

  /* opts: mode = 'ruhe' | 'lauf' | 'ueberlast' (Stromfluss) oder null (Plan unbetätigt, ohne Stromfluss, für Aufgaben), sel = 'K1' | 'F2' | null */
  function planSvg(opts) {
    const o = opts || {}, neutral = !o.mode, s = C.state(neutral ? 'ruhe' : o.mode), live = new Set(neutral ? [] : s.live), sel = o.sel || null;
    const L = n => live.has(n), cl = (dev, id) => s.closed[dev + ':' + id], coilOn = !neutral && s.k1, trip = !neutral && s.f2;
    let b = '';
    /* Schienen: Strom läuft von links bis zum letzten Strompfad, der Strom braucht; unten zurück (Richtung von rechts nach links) */
    const rx = [96, XS[2], XS[4], XS[5], XS[6]], need = [[2, 3, 4, 5, 6], [4, 5, 6], [5, 6], [6]];
    for (let i = 0; i < 4; i++) {
      const on = need[i].some(L);
      b += W(rx[i], TOP, rx[i + 1], TOP, on) + W(rx[i + 1], BOT, rx[i], BOT, on);
    }
    b += T(374, 28, '+24 V', 'end') + T(374, 283, '0 V', 'end');
    /* Strompfad 1: Hauptstromkreis (Hauptkontakte K1, Überlastrelais F2, Motor M1) */
    b += ['L1', 'L2', 'L3'].map((n, i) => T(POLE[i], 28, n, 'mid')).join('');
    const hk = POLE.map((x, i) => W(x, TOP, x, 56, L(1)) + contact(x, 56, 'S', cl('K1', '1-2'), L(1), false) + T(x + 4, 67, String(1 + 2 * i)) + T(x + 4, 97, String(2 + 2 * i))).join('') + `<line class="sl sd" x1="${cl('K1', '1-2') ? 22 : 17}" y1="78.5" x2="${cl('K1', '1-2') ? 58 : 53}" y2="78.5"/>`;
    b += dv('K1', sel, [8, 50, 84, 56], hk + lab(66, 80, '-K1'));
    const th = POLE.map(x => W(x, 100, x, 118, L(1)) + `<rect class="th${trip ? ' trip' : ''}" x="${x - 7}" y="118" width="14" height="22" rx="2"/>` + W(x, 140, x, x === 40 ? 208 : 215, L(1))).join('');
    b += dv('F2', sel, [8, 112, 84, 34], th + lab(66, 134, '-F2'));
    b += `<circle class="mot" cx="40" cy="234" r="26"/>` + (L(1) ? '<circle class="mon" cx="40" cy="234" r="26"/>' : '') + T(40, 241, 'M', 'mid big') + T(40, 256, '3~', 'mid') + T(40, 281, '-M1', 'mid');
    /* Strompfad 2: Aus-Taster S1, Überlastkontakt F2 95-96, Ein-Taster S2, Spule K1 */
    const x2 = XS[2], x3 = XS[3];
    b += W(x2, TOP, x2, 46, L(2)) + contact(x2, 46, 'O', true, L(2), true) + lab(x2 + 10, 65, '-S1', '11-12');
    b += dv('F2', sel, [x2 - 18, 90, 62, 52], contact(x2, 94, 'O', cl('F2', '95-96'), L(2)) + lab(x2 + 10, 113, '-F2', '95-96'));
    b += contact(x2, 138, 'S', false, false, true) + lab(x2 + 10, 157, '-S2', '13-14');
    b += W(x2, 138, x3, 138, L(3)) + W(x3, 182, x2, 182, L(3)) + `<circle class="jn${L(3) ? ' on' : ''}" cx="${x2}" cy="138" r="3.5"/><circle class="jn${L(3) ? ' on' : ''}" cx="${x2}" cy="182" r="3.5"/>`;
    b += dv('K1', sel, [x3 - 18, 134, 62, 52], contact(x3, 138, 'S', cl('K1', '13-14'), L(3)) + lab(x3 + 10, 157, '-K1', '13-14'));
    b += dv('K1', sel, [x2 - 20, 202, 40, 46], W(x2, 182, x2, 206, L(2)) + `<rect class="cl${coilOn ? ' on' : ''}" x="${x2 - 17}" y="206" width="34" height="38" rx="2"/>` + T(x2, 230, 'K1', 'mid b') + W(x2, 244, x2, BOT, L(2)));
    /* Strompfade 4 bis 6: Meldeleuchten */
    const row = [[4, 'K1', '21-22', 'O', 'P1', 'Bereit'], [5, 'K1', '33-34', 'S', 'P2', 'Läuft'], [6, 'F2', '97-98', 'S', 'P3', 'Störung']];
    row.forEach(r => {
      const x = XS[r[0]], on = L(r[0]);
      b += W(x, TOP, x, 60, on) + `<circle class="jn${on ? ' on' : ''}" cx="${x}" cy="${TOP}" r="3.5"/>`;
      b += dv(r[1], sel, [x - 18, 56, 60, 52], contact(x, 60, r[3], cl(r[1], r[2]), on) + lab(x + 10, 79, '-' + r[1], r[2]));
      b += W(x, 104, x, 191, on) + (on ? `<circle class="lh" cx="${x}" cy="206" r="23"/>` : '') + `<circle class="lp${on ? ' on' : ''}" cx="${x}" cy="206" r="15"/>`;
      b += `<path class="sl" d="M${x - 7} 199L${x + 7} 213M${x + 7} 199L${x - 7} 213"/>` + W(x, 221, x, BOT, on) + `<circle class="jn${on ? ' on' : ''}" cx="${x}" cy="${BOT}" r="3.5"/>`;
      b += T(x + 6, 244, '-' + r[4]) + T(x + 6, 259, r[5], 'mu');
    });
    /* Strompfadnummern und Kontaktspiegel */
    for (let n = 1; n <= C.PFADE; n++) b += `<circle class="nr" cx="${XS[n]}" cy="316" r="11"/>` + T(XS[n], 320.5, String(n), 'mid b');
    const box = (dev, x, w) => {
      const sp = C.spiegel(dev);
      return dv(dev, sel, [x, 336, w, 62], RC(x, 336, w, 62, 'bx', 6) + T(x + 8, 353, '-' + dev, 'b') + T(x + 8, 371, 'Schließer') + T(x + 84, 371, sp.S.join(' '), 'b') + T(x + 8, 389, 'Öffner') + T(x + 84, 389, sp.O.join(' '), 'b'));
    };
    b += box('F2', 2, 100) + box('K1', 108, 190);
    return svg(380, 406, 'Stromlaufplan der Schützsteuerung mit Kontaktspiegel', b, 'plan');
  }

  /* ============================================================ Referenzkennzeichen als Bausteine */
  const PC = { Funktion: 'var(--accent)', Ort: 'var(--ok)', Produkt: 'var(--hi)', Anschluss: 'var(--warn)' };
  function kzSvg(o) {
    const parts = C.describeKz(o);
    if (!parts.length) return svg(380, 70, 'Noch kein Kennzeichen', T(190, 40, 'Wähle Teile aus, dann entsteht das Kennzeichen', 'mid mu'));
    const cw = 15.5, pad = 11, gap = 5, widths = parts.map(p => p.zeichen.length * cw + 2 * pad), total = widths.reduce((a, c) => a + c, 0) + gap * (parts.length - 1);
    let x = (380 - total) / 2, b = '';
    parts.forEach((p, i) => {
      b += `<rect class="kzc" x="${q(x)}" y="12" width="${q(widths[i])}" height="46" rx="9" style="stroke:${PC[p.teil]};fill:${PC[p.teil]}"/>` + T(x + pad, 45, p.zeichen, 'kzt', ` textLength="${q(p.zeichen.length * cw)}" lengthAdjust="spacingAndGlyphs"`);
      x += widths[i] + gap;
    });
    parts.forEach((p, i) => {
      const y = 92 + i * 27;
      b += `<circle cx="22" cy="${y - 4.5}" r="6" style="fill:${PC[p.teil]}"/>` + T(36, y, p.teil, 'b') + T(112, y, p.zeichen, 'b', ` style="fill:${PC[p.teil]}"`) + T(168, y, p.text);
    });
    return svg(380, 96 + parts.length * 27, 'Referenzkennzeichen ' + C.buildKz(o), b);
  }

  /* ============================================================ Klemmenplan als Klemmleiste -X1 */
  const WIRE = { schwarz: '#23272b', rot: '#d6372c', blau: '#2b6fd8', braun: '#7a4a24', grau: '#8a9099', 'grün-gelb': '#2f9e4f' };
  /* opts: sel = Klemmennummer (markiert), hide = { n: 'innen' | 'aussen' } (statt des Textes ein Fragezeichen) */
  function klemmenSvg(opts) {
    const o = opts || {}, hide = o.hide || {};
    let b = T(104, 20, 'Innen (Schrank)', 'end b') + T(190, 20, 'Klemme -X1', 'mid b') + T(276, 20, 'Außen (Feld)', 'b');
    C.KLEMMEN.forEach((k, i) => {
      const y = 50 + i * 28, wire = (xa, xb) => `<line class="wu" x1="${xa}" y1="${y}" x2="${xb}" y2="${y}"/><line class="wc" x1="${xa}" y1="${y}" x2="${xb}" y2="${y}" style="stroke:${WIRE[k.f] || '#888'}"/>` + (k.f === 'grün-gelb' ? `<line class="wc wy" x1="${xa}" y1="${y}" x2="${xb}" y2="${y}"/>` : '');
      const txt = (side, x, anchor) => hide[k.n] === side ? RC(anchor ? x - 52 : x - 4, y - 12, 56, 24, 'qh', 5) + T(anchor ? x - 24 : x + 24, y + 5, '?', 'mid b') : T(x, y + 4.5, k[side], anchor ? 'end' : '');
      b += `<g class="dv${o.sel === k.n ? ' sel' : ''}" data-kl="${k.n}">` + RC(6, y - 14, 368, 28, 'hlr', 6) + wire(112, 160) + wire(220, 268) + RC(156, y - 12, 68, 24, 'tb', 4)
        + `<circle class="sl" cx="165" cy="${y}" r="3"/><circle class="sl" cx="215" cy="${y}" r="3"/>` + T(190, y + 5, String(k.n), 'mid b') + txt('innen', 104, true) + txt('aussen', 276, false) + '</g>';
    });
    return svg(380, 50 + C.KLEMMEN.length * 28, 'Klemmleiste -X1 mit Quellen und Zielen', b, 'klem');
  }

  /* ============================================================ Kontaktspiegel einer Relaisspule: o = { name, pfad, S: [Strompfade], O: [Strompfade] } */
  function spiegelSvg(o) {
    const chips = (arr, x0) => arr.map((n, i) => RC(x0 + i * 31, 134, 27, 24, 'nr', 5) + T(x0 + i * 31 + 13.5, 151, String(n), 'mid b')).join('');
    let b = P('M60 4V18M60 58V76') + RC(36, 18, 48, 40, 'cl', 3) + T(60, 43, o.name, 'mid b');
    b += T(104, 33, 'Spule im Strompfad') + RC(104, 40, 40, 24, 'nr', 5) + T(124, 57, String(o.pfad), 'mid b');
    b += RC(8, 84, 364, 80, 'bx', 8) + T(20, 104, 'Kontaktspiegel', 'b') + T(20, 124, 'Schließer') + T(208, 124, 'Öffner') + `<line class="bx" x1="196" y1="110" x2="196" y2="156"/>` + chips(o.S, 20) + chips(o.O, 208);
    return svg(380, 172, 'Kontaktspiegel der Spule ' + o.name, b);
  }

  /* Bild einer Aufgabe: { kind: 'sym', key } | { kind: 'spiegel', name, pfad, S, O } | { kind: 'plan' } */
  function taskImg(i) {
    if (!i) return '';
    if (i.kind === 'sym') return symBig(i.key);
    if (i.kind === 'spiegel') return spiegelSvg(i);
    if (i.kind === 'plan') return planSvg({ mode: null });
    return '';
  }

  /* ============================================================ CSS */
  const CSS = `.bmv{display:block;width:100%;height:auto;max-width:600px;margin:0 auto}
@media(max-width:480px){.bmv:not(.sm){width:calc(100% + 20px);max-width:none;margin:0 -10px}}
.bmv text{font-family:system-ui,sans-serif;font-size:13.4px;fill:var(--fg);-webkit-user-select:none;user-select:none}
.bmv .mid{text-anchor:middle}.bmv .end{text-anchor:end}.bmv .b{font-weight:700}.bmv .mu{fill:var(--mute)}.bmv .big{font-size:20px;font-weight:700}.bmv .kzt{font-size:26px;font-weight:700}
.bmv .sl{fill:none;stroke:var(--fg);stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}.bmv .sl.on{stroke:var(--hi);stroke-width:3.2}.bmv .sf{fill:var(--panel2)}.bmv .sd{stroke-dasharray:4 4}
.bmv .w{stroke:var(--mute);stroke-width:2.2;stroke-linecap:round}.bmv .w.on{stroke:var(--hi);stroke-width:3.4}
.bmv .wf{stroke:var(--bg);stroke-width:1.4;stroke-linecap:round;stroke-dasharray:2 10;opacity:0}
.bmv .hlr{fill:var(--work);stroke:var(--accent);stroke-width:1.5;opacity:0}.bmv .dv{cursor:pointer}.bmv .dv.sel .hlr{opacity:1}
.bmv .jn{fill:var(--mute)}.bmv .jn.on{fill:var(--hi)}
.bmv .cl{fill:var(--panel2);stroke:var(--fg);stroke-width:2.4}.bmv .cl.on{fill:var(--hi);fill-opacity:.4}
.bmv .th{fill:var(--panel2);stroke:var(--fg);stroke-width:2.2}.bmv .th.trip{fill:var(--danger);fill-opacity:.5}
.bmv .lp{fill:var(--panel2);stroke:var(--fg);stroke-width:2.4}.bmv .lp.on{fill:var(--hi);fill-opacity:.85}.bmv .lh{fill:var(--hi);opacity:.3}
.bmv .mot{fill:var(--panel2);stroke:var(--fg);stroke-width:2.4}.bmv .mon{fill:none;stroke:var(--hi);stroke-width:3.4;stroke-dasharray:12 9}
.bmv .nr{fill:var(--panel2);stroke:var(--mute);stroke-width:1.5}.bmv .bx{fill:none;stroke:var(--mute);stroke-width:1.5}
.bmv .kzc{fill-opacity:.16;stroke-width:2}.bmv .tb{fill:var(--panel2);stroke:var(--mute);stroke-width:1.5}.bmv .qh{fill:none;stroke:var(--accent);stroke-width:2;stroke-dasharray:4 3}
.bmv .wu{stroke:var(--mute);stroke-width:6.5;stroke-linecap:round}.bmv .wc{stroke-width:3.6;stroke-linecap:round}.bmv .wy{stroke:#e8d400!important;stroke-dasharray:6 6}
.bmv.sm text.symt{display:none}
@media(prefers-reduced-motion:no-preference){
.bmv .wf{opacity:1;animation:bmkFlow .9s linear infinite}@keyframes bmkFlow{to{stroke-dashoffset:-24}}
.bmv .mon{transform-box:fill-box;transform-origin:center;animation:bmkRot 2.4s linear infinite}@keyframes bmkRot{to{transform:rotate(360deg)}}
.bmv .dv.sel .hlr{animation:bmkPuls 1.6s ease-in-out infinite}@keyframes bmkPuls{50%{opacity:.55}}}`;

  const API = { symSvg, planSvg, kzSvg, klemmenSvg, spiegelSvg, taskImg, CSS };
  root.BMK_VIZ = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof document !== 'undefined' && document.head && !document.getElementById('bmkviz-css')) { try { const st = document.createElement('style'); st.id = 'bmkviz-css'; st.textContent = CSS; document.head.appendChild(st); } catch (e) {} }
})(typeof window !== 'undefined' ? window : globalThis);
