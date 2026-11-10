'use strict';
/* Tonfunk HausLab: Bilder für die Seitenleiste (window.HAUS_VIZ bzw. module.exports). Reine Anzeige, inline-SVG, keine Bibliothek, offline.
   - switchSvg(art, an):      Schaltzeichen und Kontaktbild von Ausschalter, Wechselschalter, Kreuzschalter, Taster und Stromstoßschalter in der aktuellen Stellung
   - socketSvg(art):          Schutzkontakt-Steckdose (Schuko) und CEE-Steckdose 400 V mit Kontaktbelegung
   - cableSvg(dreh):          Querschnitt der Mantelleitung (NYM-J 3-adrig oder 5-adrig) mit den genormten Aderfarben
   - circuitsSvg(zeilen):     Stromkreis-Übersicht des Verteilers: Last je Abgang gegen den Nennstrom des Automaten, Phase und FI
   - side(ctx):               HTML für die Seitenleiste (Karte nach der Objekt-, Leitungs- oder Haus-Karte); leer, wenn eine Aufgabe offen ist
   Aderfarben nach DIN VDE 0293-308: L1 braun, L2 schwarz, L3 grau, N blau, PE grün-gelb. Das sind genormte Farben (Ausnahme vom Theme).
   Nichts hier berechnet Aufgabenlösungen: keine Adernzahlen einer Schaltung, keine Schaltpläne, nur das einzelne Bauteil. Keine Animation. */
(function (root) {
  const fin = Number.isFinite;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f1 = v => (fin(v) ? String(Math.round(v * 10) / 10) : '0');
  const num = (v, d) => (fin(v) ? v : 0).toFixed(d == null ? 1 : d).replace('.', ',');
  const COL = { L1: '#7a4a1e', L2: '#1b1b1b', L3: '#8d8f93', N: '#2f62c8', PE1: '#2e9e44', PE2: '#f2d21a' };
  const svg = (w, h, body, label) => `<svg class="hvs" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label || '')}" focusable="false">${body}</svg>`;
  const CSS = `.hv .hvs{display:block;width:100%;max-width:340px;height:auto;margin:4px auto}
.hv svg text{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;fill:var(--fg,#e8ecf0);font-size:11px}
.hv svg .m{fill:var(--mute,#8d99a6)}.hv svg .b{font-weight:700}
.hv svg .ln{stroke:var(--fg,#e8ecf0);stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round}.hv svg .th{stroke:var(--mute,#8d99a6);stroke-width:1.2;fill:none}
.hv svg .on{stroke:var(--hv-ok,#5ee27d);stroke-width:3.2;fill:none;stroke-linecap:round}.hv svg .dot{fill:var(--fg,#e8ecf0)}
.hv svg .pl{fill:var(--panel,#222830);stroke:var(--line,#38424d);stroke-width:1.4}
.hv svg .bar{fill:var(--accent,#3b9eff)}.hv svg .barw{fill:var(--hv-warn,#ffb340)}.hv svg .bart{fill:var(--line,#38424d)}
.hv{--hv-ok:#5ee27d;--hv-warn:#ffb340}
@media(prefers-color-scheme:light){:root:not([data-theme=dark]) .hv{--hv-ok:#1f8a3b;--hv-warn:#b86a00}}
:root[data-theme=light] .hv{--hv-ok:#1f8a3b;--hv-warn:#b86a00}
.hv .hn{margin:6px 0 0;font-size:12.5px;color:var(--mute,#8d99a6);line-height:1.4}.hv .hn b{color:var(--fg,#e8ecf0)}`;
  const T = (x, y, t, c, a) => `<text class="${c || ''}" x="${f1(x)}" y="${f1(y)}"${a ? ` text-anchor="${a}"` : ''}>${esc(t)}</text>`;
  const term = (x, y, n) => `<circle class="pl" cx="${f1(x)}" cy="${f1(y)}" r="4"/>` + (n ? T(x, y - 8, n, 'm', 'middle') : '');

  /* ---------- Schalter ---------- */
  function switchSvg(art, on) {
    on = on ? 1 : 0; let b = '', note = '';
    if (art === 'swi') {                       // Ausschalter: zwei Klemmen, ein Kontakt
      b += term(60, 50, '1') + term(220, 50, '2') + `<line class="th" x1="20" y1="50" x2="56" y2="50"/><line class="th" x1="224" y1="50" x2="260" y2="50"/>`;
      b += on ? `<line class="on" x1="60" y1="50" x2="220" y2="50"/>` : `<line class="ln" x1="60" y1="50" x2="196" y2="22"/>`;
      b += T(140, 86, on ? 'Kontakt geschlossen: Strom fließt' : 'Kontakt offen: Stromkreis unterbrochen', 'm', 'middle'); note = 'Ausschalter';
    } else if (art === 'swc') {                // Wechselschalter: Wurzel und zwei Kontakte
      b += term(50, 50, '1') + term(220, 28, '2') + term(220, 72, '3') + `<line class="th" x1="14" y1="50" x2="46" y2="50"/><line class="th" x1="224" y1="28" x2="262" y2="28"/><line class="th" x1="224" y1="72" x2="262" y2="72"/>`;
      b += on ? `<line class="on" x1="50" y1="50" x2="220" y2="72"/>` : `<line class="on" x1="50" y1="50" x2="220" y2="28"/>`;
      b += T(140, 96, 'Wurzel (1) verbindet sich mit 2 oder mit 3', 'm', 'middle'); note = 'Wechselschalter';
    } else if (art === 'swk') {                // Kreuzschalter: durchgehend oder gekreuzt
      b += term(60, 28, '1') + term(60, 72, '2') + term(220, 28, '3') + term(220, 72, '4');
      b += on ? `<line class="on" x1="60" y1="28" x2="220" y2="72"/><line class="on" x1="60" y1="72" x2="220" y2="28"/>` : `<line class="on" x1="60" y1="28" x2="220" y2="28"/><line class="on" x1="60" y1="72" x2="220" y2="72"/>`;
      b += T(140, 96, on ? 'Stellung gekreuzt' : 'Stellung durchgehend', 'm', 'middle'); note = 'Kreuzschalter';
    } else if (art === 'tast') {               // Taster: Schließer, federt zurück
      b += term(60, 50, '1') + term(220, 50, '2') + `<line class="th" x1="20" y1="50" x2="56" y2="50"/><line class="th" x1="224" y1="50" x2="260" y2="50"/><line class="ln" x1="60" y1="50" x2="196" y2="26"/><path class="th" d="M128 28 v-12 h-6 m6 0 h6"/><line class="th" x1="128" y1="18" x2="128" y2="38" style="stroke-dasharray:3 3"/>`;
      b += T(140, 86, 'Schließer: nur solange gedrückt, geschlossen', 'm', 'middle'); note = 'Taster';
    } else if (art === 'imp') {                // Stromstoßschalter: Spule steuert Rastkontakt
      b += `<rect class="pl" x="40" y="22" width="56" height="28" rx="3"/>` + T(68, 40, 'A1 A2', 'b', 'middle') + term(180, 36, '') + term(240, 36, '') + `<line class="th" x1="150" y1="36" x2="176" y2="36"/><line class="th" x1="244" y1="36" x2="268" y2="36"/><line class="ln" x1="180" y1="36" x2="228" y2="12"/><path class="th" d="M96 36 H126 M126 36 L176 20" style="stroke-dasharray:3 3"/>`;
      b += T(140, 86, 'Jeder Impuls an der Spule schaltet den Kontakt um', 'm', 'middle'); note = 'Stromstoßschalter';
    } else return '';
    return svg(280, 104, b, note + ' als Prinzipbild');
  }

  /* ---------- Steckdosen ---------- */
  function socketSvg(art) {
    if (art === 'sock3') {                     // CEE 5-polig 400 V (rot): L1, L2, L3, N, PE
      let b = `<circle cx="100" cy="64" r="52" fill="#c0392b" stroke="#7d2318" stroke-width="2"/><circle cx="100" cy="64" r="38" fill="#e8e3dc" stroke="#7d2318"/>`;
      const pts = [['L1', 100, 36], ['L2', 128, 52], ['L3', 117, 84], ['N', 83, 84], ['PE', 72, 52]];
      pts.forEach(([n, x, y]) => { b += `<circle cx="${x}" cy="${y}" r="5" fill="#3a3a3a"/>`; });
      b += `<rect x="94" y="102" width="12" height="9" fill="#e8e3dc" stroke="#7d2318" opacity="0"/>`;
      b += T(176, 30, 'L1 braun', 'b') + T(176, 46, 'L2 schwarz', 'b') + T(176, 62, 'L3 grau', 'b') + T(176, 78, 'N blau', 'b') + T(176, 94, 'PE grün-gelb', 'b');
      b += T(176, 112, 'rot = 400 V Drehstrom', 'm');
      return svg(300, 128, b, 'CEE-Steckdose 5-polig mit Kontaktbelegung');
    }
    let b = `<rect x="38" y="10" width="104" height="104" rx="14" fill="#f2f4f6" stroke="#7d8590" stroke-width="2"/><circle cx="90" cy="62" r="40" fill="#e6e9ed" stroke="#7d8590"/>`;
    b += `<circle cx="72" cy="62" r="6" fill="#3a3a3a"/><circle cx="108" cy="62" r="6" fill="#3a3a3a"/><rect x="85" y="18" width="10" height="8" fill="#b9bec6" stroke="#7d8590"/><rect x="85" y="98" width="10" height="8" fill="#b9bec6" stroke="#7d8590"/>`;
    b += T(160, 36, 'zwei runde Kontakte:', 'm') + T(160, 52, 'L braun, N blau', 'b') + T(160, 74, 'Schutzkontakte am Rand:', 'm') + T(160, 90, 'PE grün-gelb', 'b') + T(160, 110, '230 V Wechselstrom', 'm');
    return svg(300, 124, b, 'Schutzkontakt-Steckdose mit Kontaktbelegung');
  }

  /* ---------- Mantelleitung ---------- */
  function core(x, y, r, c) {
    if (c === 'PE') return `<circle cx="${f1(x)}" cy="${f1(y)}" r="${r}" fill="${COL.PE2}" stroke="#555" stroke-width=".8"/><path d="M${f1(x - r * .7)} ${f1(y - r * .7)} A${r} ${r} 0 0 1 ${f1(x + r * .7)} ${f1(y + r * .7)} L${f1(x + r * .35)} ${f1(y + r * .95)} A${r} ${r} 0 0 0 ${f1(x - r * .95)} ${f1(y - r * .35)} Z" fill="${COL.PE1}" opacity=".9"/><circle cx="${f1(x)}" cy="${f1(y)}" r="${r}" fill="none" stroke="#555" stroke-width=".8"/>`;
    return `<circle cx="${f1(x)}" cy="${f1(y)}" r="${r}" fill="${COL[c]}" stroke="#555" stroke-width=".8"/>`;
  }
  function cableSvg(dreh) {
    const names = dreh ? ['PE', 'N', 'L1', 'L2', 'L3'] : ['PE', 'N', 'L1'], R = 13, cx = 64, cy = 64;
    let b = `<circle cx="${cx}" cy="${cy}" r="52" fill="#d7d9dc" stroke="#8a9098" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="45" fill="#e9eaec" stroke="#b9bec6"/>`;
    const pos = dreh ? [[cx, cy - 26], [cx + 25, cy - 8], [cx + 15, cy + 21], [cx - 15, cy + 21], [cx - 25, cy - 8]] : [[cx - 16, cy + 8], [cx + 16, cy + 8], [cx, cy - 20]];
    names.forEach((n, i) => { b += core(pos[i][0], pos[i][1], R, n); });
    const lab = { PE: 'PE grün-gelb', N: 'N blau', L1: 'L1 braun', L2: 'L2 schwarz', L3: 'L3 grau' };
    names.forEach((n, i) => { b += T(140, 26 + i * 18, lab[n], 'b'); b += `<circle cx="132" cy="${23 + i * 18}" r="4" fill="${n === 'PE' ? COL.PE2 : COL[n]}" stroke="#555" stroke-width=".6"/>`; });
    b += T(140, 26 + names.length * 18 + 8, dreh ? 'NYM-J 5-adrig (Drehstrom)' : 'NYM-J 3-adrig (Wechselstrom)', 'm');
    return svg(300, 132, b, 'Querschnitt einer Mantelleitung mit den Aderfarben');
  }

  /* ---------- Stromkreis-Übersicht ---------- */
  /* zeilen: [{ n, ls: 'B16', ph: 1, p3: bool, fi: 1, a: Last in A }] */
  function circuitsSvg(rows) {
    const W = 320, rh = 26, top = 8, H = top + rows.length * rh + 30; let b = '';
    rows.forEach((r, i) => {
      const y = top + i * rh, inn = parseFloat(String(r.ls || '').replace(/^[A-Za-z]+/, '')) || 16, fr = Math.max(0, r.a / inn), w = Math.min(1.25, fr) / 1.25 * 130;
      b += T(6, y + 15, String(r.n), 'b');
      b += T(24, y + 15, (r.p3 ? '3× ' : '') + r.ls, 'm');
      b += `<rect class="bart" x="86" y="${y + 4}" width="130" height="14" rx="3"/><rect class="${fr > 1 ? 'barw' : 'bar'}" x="86" y="${y + 4}" width="${f1(w)}" height="14" rx="3"/>`;
      b += `<line x1="${f1(86 + 130 / 1.25)}" y1="${y + 1}" x2="${f1(86 + 130 / 1.25)}" y2="${y + 21}" stroke="var(--mute,#8d99a6)" stroke-width="1"/>`;
      b += T(222, y + 15, num(r.a, 1) + ' A', fr > 1 ? 'b' : '');
      b += T(314, y + 15, (r.p3 ? 'L1-3' : r.ph ? 'L' + r.ph : '–') + (r.fi ? ' · FI' + r.fi : ''), 'm', 'end');
    });
    b += T(86 + 130 / 1.25, H - 6, '= Nennstrom', 'm', 'middle');
    return svg(W, H, b, 'Last je Stromkreis im Vergleich zum Nennstrom des Automaten');
  }

  const card = (t, inner, note) => `<div class="card hv"><h4>${esc(t)}</h4>${inner}${note ? `<p class="hn">${note}</p>` : ''}</div>`;
  /* ctx: { o: Objekt | null, c: Kabel | null, r: Raum | null, h: Haus, sim, slots: [{ ls, ph, p3, fi, a }] } */
  function side(ctx) {
    if (!ctx || ctx.task) return '';
    const o = ctx.o, c = ctx.c; let h = '';
    if (o) {
      if (['swi', 'swc', 'swk', 'tast', 'imp'].includes(o.t)) {
        const nm = { swi: 'Ausschalter', swc: 'Wechselschalter', swk: 'Kreuzschalter', tast: 'Taster', imp: 'Stromstoßschalter' }[o.t];
        h = card('Prinzipbild: ' + nm, switchSvg(o.t, o.on), o.t === 'swc' ? 'Der Wechselschalter hat <b>drei Klemmen</b>: eine Wurzel und zwei Wechsler-Kontakte.' : o.t === 'swk' ? 'Der Kreuzschalter vertauscht zwei Leiter: durchgehend oder gekreuzt.' : o.t === 'swi' ? 'Der Ausschalter öffnet oder schließt den Leiter. Er gehört in den Außenleiter, nie in N oder PE.' : o.t === 'tast' ? 'Der Taster schließt nur, solange du ihn drückst.' : 'Der Stromstoßschalter sitzt im Verteiler und wird von Tastern gesteuert.');
      } else if (o.t === 'sock' || o.t === 'sock3') h = card(o.t === 'sock3' ? 'Bild: CEE-Steckdose' : 'Bild: Steckdose', socketSvg(o.t), o.t === 'sock3' ? 'Die rote CEE-Steckdose hat fünf Kontakte für Drehstrom.' : 'Die Schutzkontakt-Steckdose (Schuko) verbindet den PE über die Kontakte am Rand.');
    } else if (c) {
      h = card('Bild: Leitung und Aderfarben', cableSvg(!!c.ph3), 'Die Farben der Adern sind genormt. Grün-gelb ist immer der Schutzleiter, blau immer der Neutralleiter.');
    } else if (ctx.slots && ctx.slots.length) {
      h = card('Stromkreise im Überblick', circuitsSvg(ctx.slots), 'Der Balken zeigt die Last (alle eingeschalteten Geräte und alle Lampen) im Vergleich zum Nennstrom des Automaten.');
    }
    return h;
  }

  const api = { switchSvg, socketSvg, cableSvg, circuitsSvg, side, CSS, COL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.HAUS_VIZ = api;
  if (typeof document !== 'undefined' && !document.getElementById('hvCss')) { const st = document.createElement('style'); st.id = 'hvCss'; st.textContent = CSS; (document.head || document.documentElement).appendChild(st); }
})(typeof window !== 'undefined' ? window : globalThis);
