'use strict';
/* Tonfunk SimLab und DigiLab: Bauform-Bilder und Zeigerinstrument (window.SIM_VIZ bzw. module.exports). Reine Anzeige, inline-SVG, keine Bibliothek, offline.
   - resistorSvg(wert):  Widerstand in den vier üblichen Bauformen 0,25 / 0,5 / 1 / 2 W im gleichen Maßstab, mit Farbringen des eingegebenen Werts
   - ledSvg(farbe):      LED 3 mm und 5 mm (Anode = langes Bein, Kathode = Abflachung und kurzes Bein), Flussspannung wie im Simulator (LochSim.LEDVF)
   - capSvg(wert, elko): Keramik-, Folien- und Elektrolytkondensator in typischer Größe, Elko mit Minusstreifen
   - dipSvg(katalog):    DIP-Gehäuse maßstäblich (Rastermaß 2,54 mm, Reihenabstand 7,62 mm), Pin 1 an der Kerbe, mit Pinnamen
   - fuseSvg(wert):      Feinsicherung 5 x 20 mm
   - gaugeSvg(text):     Zeigerinstrument zum Multimeter: Messbereich in 1-2-5-Stufen, Zeiger folgt der Anzeige
   Das Modul hängt sich per MutationObserver an die Seitenleiste (#side): unter der Bauteilkarte erscheint das Bild, unter dem Multimeter der Zeiger.
   Nichts hier berechnet Aufgabenlösungen: Bei offener Aufgabe (Karte .task) und im Prüfmodus bleibt die Seitenleiste unverändert.
   Farben nur über die CSS-Variablen der Seite. Ausnahme: die genormten Farbringe und die Bauteilfarben (Gehäuse, LED-Farbe), das sind physische Eigenschaften. */
(function (root) {
  const fin = Number.isFinite;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f1 = v => (fin(v) ? String(Math.round(v * 10) / 10) : '0');
  const dec = (v, d) => (fin(v) ? (Math.round(v * Math.pow(10, d == null ? 1 : d)) / Math.pow(10, d == null ? 1 : d)).toString().replace('.', ',') : '0');

  /* ---------- Werte lesen: 4k7, 4.7k, 330, 1M, 100R, 4u7, 100n, 10p ---------- */
  const SI = { p: 1e-12, n: 1e-9, u: 1e-6, 'µ': 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, G: 1e9, R: 1, r: 1 };
  function parseVal(s) {
    if (s == null) return NaN;
    let t = String(s).trim().replace(',', '.').replace(/\s+/g, '').replace(/(Ω|ohm|F|H)$/i, '');
    const m = t.match(/^(\d*\.?\d*)([pnuµmkKMGRr]?)(\d*)$/);
    if (!m || (m[1] === '' && m[3] === '')) return NaN;
    let num = m[3] ? parseFloat((m[1] || '0') + '.' + m[3]) : parseFloat(m[1]);
    if (!fin(num)) return NaN;
    return num * (m[2] ? SI[m[2]] : 1);
  }

  /* ---------- Farbringe (genormt: IEC 60062) ---------- */
  const RING = [['schwarz', '#1b1b1b'], ['braun', '#8b4a14'], ['rot', '#d62d20'], ['orange', '#f08a12'], ['gelb', '#f2d21a'], ['grün', '#2e9e44'], ['blau', '#2f62c8'], ['violett', '#8a3fb4'], ['grau', '#8d8f93'], ['weiß', '#f4f4f4']];
  const GOLD = ['gold', '#c9a227'], SILVER = ['silber', '#b9bcc2'];
  /* liefert Ringe [[name, farbe], ...] oder null, wenn der Wert nicht als Ring darstellbar ist */
  function bands(ohm) {
    if (!fin(ohm) || ohm < 0) return null;
    if (ohm === 0) return [RING[0]];
    const e = ohm.toExponential(2).split('e'), mant = e[0].replace('.', ''), ex = parseInt(e[1], 10);   // "d.dd" -> "ddd"
    const d = mant.split('').map(Number), five = d[2] !== 0, mx = five ? ex - 2 : ex - 1, dig = five ? d.slice(0, 3) : d.slice(0, 2);
    const mult = mx === -1 ? GOLD : mx === -2 ? SILVER : (mx >= 0 && mx <= 9 ? RING[mx] : null);
    if (!mult) return null;
    return dig.map(x => RING[x]).concat([mult, five ? RING[1] : GOLD]);
  }
  const bandText = b => (b ? b.map(x => x[0]).join(' · ') : '');

  /* ---------- gemeinsames Gerüst ---------- */
  const CSS = `.vzc .vzs{display:block;width:100%;max-width:340px;height:auto;margin:0 auto}
.vzc svg text{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;fill:var(--fg,#e8ecf0);font-size:11px}
.vzc svg .m{fill:var(--mute,#8d99a6)}.vzc svg .b{font-weight:700}
.vzc svg .ln{stroke:var(--mute,#8d99a6);stroke-width:1.2;fill:none}.vzc svg .lead{stroke:var(--vz-lead,#b9bec6);stroke-width:2;stroke-linecap:round}
.vzc svg .ok{fill:var(--vz-ok,#5ee27d)}.vzc svg .okl{stroke:var(--vz-ok,#5ee27d);stroke-width:2;fill:none}
.vzc svg .hi{stroke:var(--accent,#3b9eff);stroke-width:2;fill:none}.vzc svg .hif{fill:var(--accent,#3b9eff)}
.vzc svg .bg{fill:var(--bg,#14181c)}.vzc svg .pn{fill:var(--panel,#222830);stroke:var(--line,#38424d);stroke-width:1}
.vzg .vzs{max-width:200px;margin-top:6px}
.vzc .vzn{margin:6px 0 0;font-size:12.5px;color:var(--mute,#8d99a6);line-height:1.4}
.vzc .vzn b{color:var(--fg,#e8ecf0)}
.vzc{--vz-ok:#5ee27d;--vz-lead:#b9bec6}
@media(prefers-color-scheme:light){:root:not([data-theme=dark]) .vzc{--vz-ok:#1f8a3b;--vz-lead:#6b7480}}
:root[data-theme=light] .vzc{--vz-ok:#1f8a3b;--vz-lead:#6b7480}`;
  const svg = (w, h, body, label) => `<svg class="vzs" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label || '')}" focusable="false">${body}</svg>`;

  /* ---------- Widerstand ---------- */
  /* typische Maße axialer Metallschichtwiderstände (Hersteller weichen etwas ab): Nennleistung W, Körperlänge mm, Durchmesser mm, Drahtdicke mm */
  const RSIZE = [[0.25, 6.3, 2.5, 0.55], [0.5, 8.5, 3.2, 0.6], [1, 11, 4.2, 0.8], [2, 15, 5.2, 0.9]];
  const wTxt = w => (w < 1 ? dec(w, 2) : String(w)) + ' W';
  function resistorSvg(value, opt) {
    opt = opt || {}; const ohm = parseVal(value), bd = bands(ohm), S = 12, W = 340, x0 = 30, lead = 40 / S;
    let y = 10, body = '';
    RSIZE.forEach(([pw, L, D, wd]) => {
      const bl = L * S, bh = D * S, cx = W / 2, xb = cx - bl / 2, cy = y + bh / 2 + 4, ok = opt.watt != null && fin(opt.watt) && opt.watt * 2 <= pw;
      body += `<line class="lead" x1="${f1(x0)}" y1="${f1(cy)}" x2="${f1(W - x0)}" y2="${f1(cy)}" style="stroke-width:${f1(Math.max(1.5, wd * S * 0.6))}"/>`;
      body += `<rect x="${f1(xb)}" y="${f1(cy - bh / 2)}" width="${f1(bl)}" height="${f1(bh)}" rx="${f1(bh * 0.35)}" fill="#d9c9a3" stroke="#8a7a55" stroke-width="1"/>`;
      if (bd) {
        const n = bd.length, bw = Math.max(2.2, bl * 0.075), span = bl * 0.78, st = xb + bl * 0.11;
        bd.forEach((b, i) => {
          const gap = i === n - 1 ? bl * 0.08 : 0, bx = st + (span - bw) * (i / (n - 1)) + gap;
          body += `<rect x="${f1(bx)}" y="${f1(cy - bh / 2 + 0.6)}" width="${f1(bw)}" height="${f1(bh - 1.2)}" fill="${b[1]}"/>`;
        });
      }
      body += `<text class="b" x="${f1(x0 - 24)}" y="${f1(cy + 4)}">${wTxt(pw)}</text><text class="m" x="${W - 6}" y="${f1(cy - 6)}" text-anchor="end">${dec(L)} × ${dec(D)} mm</text>`;
      if (ok) body += `<text class="ok" x="${W - 6}" y="${f1(cy + 10)}" text-anchor="end">✓ Faustregel erfüllt</text>`;
      y += bh + 18;
    });
    const H = y + 14;
    body += `<line class="ln" x1="${x0}" y1="${f1(H - 12)}" x2="${f1(x0 + 5 * S)}" y2="${f1(H - 12)}"/><line class="ln" x1="${x0}" y1="${f1(H - 15)}" x2="${x0}" y2="${f1(H - 9)}"/><line class="ln" x1="${f1(x0 + 5 * S)}" y1="${f1(H - 15)}" x2="${f1(x0 + 5 * S)}" y2="${f1(H - 9)}"/><text class="m" x="${f1(x0 + 5 * S + 6)}" y="${f1(H - 8)}">5 mm (Maßstab)</text>`;
    return svg(W, H + 4, body, 'Widerstand in vier Bauformen von 0,25 bis 2 Watt');
  }

  /* ---------- LED ---------- */
  const LEDCOL = { rot: '#e5382e', grün: '#2fb344', gelb: '#f0c419', blau: '#2f6fe0', weiß: '#eef1f4', orange: '#f28a1c' };
  const ledKey = v => { const s = String(v == null ? '' : v).toLowerCase(); return /^gr[uü]n|gruen/.test(s) ? 'grün' : /^wei/.test(s) ? 'weiß' : LEDCOL[s] ? s : (['rot', 'gelb', 'blau', 'orange'].find(k => s.indexOf(k) === 0) || 'rot'); };
  /* Gehäuse: Durchmesser, Randdurchmesser, Höhe über dem Rand in mm (typisch) */
  const LEDSIZE = [['3 mm', 3, 3.8, 4.4], ['5 mm', 5, 5.8, 8.6]];
  function ledSvg(color, vf) {
    const k = ledKey(color), col = LEDCOL[k], S = 15, W = 340; let x = 62, body = '';
    LEDSIZE.forEach(([nm, d, fl, hh]) => {
      const cx = x + (d === 3 ? 20 : 30), top = 18, r = d * S / 2, fw = fl * S, hgt = hh * S, y0 = top + r;           // Kuppel oben
      const bot = top + hgt + 0, ey = bot + 4;
      const body0 = `M${f1(cx - r)} ${f1(y0)} A${f1(r)} ${f1(r)} 0 0 1 ${f1(cx + r)} ${f1(y0)} L${f1(cx + r)} ${f1(bot - 4)} L${f1(cx - r)} ${f1(bot - 4)} Z`;
      body += `<path d="${body0}" fill="${col}" fill-opacity=".55" stroke="${col}" stroke-width="1.6"/>`;
      // Rand mit Abflachung rechts (Kathode)
      body += `<path d="M${f1(cx - fw / 2)} ${f1(bot - 4)} L${f1(cx + fw / 2 - 5)} ${f1(bot - 4)} L${f1(cx + fw / 2 - 5)} ${f1(bot)} L${f1(cx - fw / 2)} ${f1(bot)} Z" fill="${col}" fill-opacity=".8" stroke="${col}" stroke-width="1.2"/>`;
      // Innenleben: Amboss (Kathode, breit) und Fädchen
      body += `<path d="M${f1(cx - r * .55)} ${f1(bot - 4)} V${f1(y0 + 4)} H${f1(cx + r * .1)} V${f1(bot - 4)}" fill="none" stroke="var(--mute,#8d99a6)" stroke-width="1.2"/>`;
      body += `<line x1="${f1(cx + r * .45)}" y1="${f1(bot - 4)}" x2="${f1(cx + r * .45)}" y2="${f1(y0 - 2)}" stroke="var(--mute,#8d99a6)" stroke-width="1.2"/>`;
      // Beine: Anode (links, länger), Kathode (rechts)
      body += `<line class="lead" x1="${f1(cx - r * .5)}" y1="${f1(bot)}" x2="${f1(cx - r * .5)}" y2="${f1(bot + 62)}"/><line class="lead" x1="${f1(cx + r * .5)}" y1="${f1(bot)}" x2="${f1(cx + r * .5)}" y2="${f1(bot + 46)}"/>`;
      body += `<text class="b" x="${f1(cx)}" y="${f1(top - 6)}" text-anchor="middle">${nm}</text><text class="m" x="${f1(cx - r * .5)}" y="${f1(bot + 76)}" text-anchor="middle">A +</text><text class="m" x="${f1(cx + r * .5)}" y="${f1(bot + 60)}" text-anchor="middle">K −</text>`;
      x += d === 3 ? 100 : 130;
    });
    // Schaltzeichen rechts
    const sx = 262, sy = 120;
    body += `<line class="ln" x1="${sx - 36}" y1="${sy}" x2="${sx - 10}" y2="${sy}"/><path class="ln" d="M${sx - 10} ${sy - 12} L${sx - 10} ${sy + 12} L${sx + 12} ${sy} Z"/><line class="ln" x1="${sx + 12}" y1="${sy - 12}" x2="${sx + 12}" y2="${sy + 12}"/><line class="ln" x1="${sx + 12}" y1="${sy}" x2="${sx + 38}" y2="${sy}"/>`;
    body += `<path class="ln" d="M${sx - 2} ${sy - 16} l8 -9 m-3 0 h3 v3 M${sx + 8} ${sy - 12} l8 -9 m-3 0 h3 v3"/><text class="m" x="${sx - 34}" y="${sy + 28}">A</text><text class="m" x="${sx + 28}" y="${sy + 28}">K</text>`;
    return svg(W, 215, body, 'LED in den Bauformen 3 mm und 5 mm mit Anode und Kathode');
  }

  /* ---------- Kondensator ---------- */
  function capSize(F) {                                  // Elko: Durchmesser x Höhe in mm (typisch, 16 bis 25 V)
    const u = F * 1e6;
    return u <= 4.7 ? [4, 7] : u <= 10 ? [5, 11] : u <= 100 ? [6.3, 11] : u <= 470 ? [8, 12] : u <= 1000 ? [10, 16] : [16, 25];
  }
  function capSvg(value, elko) {
    const F = parseVal(value), W = 340; let body = '';
    if (elko) {
      const [d, hh] = capSize(fin(F) ? F : 1e-4), S = 8, bw = d * S, bh = hh * S, cx = 110, top = 20;
      body += `<rect x="${f1(cx - bw / 2)}" y="${top}" width="${f1(bw)}" height="${f1(bh)}" rx="4" fill="#25334f" stroke="var(--line,#38424d)"/><rect x="${f1(cx - bw / 2)}" y="${top}" width="${f1(bw * 0.22)}" height="${f1(bh)}" rx="2" fill="#c9ced6"/>`;
      for (let i = 0; i < 4; i++) body += `<text x="${f1(cx - bw / 2 + bw * 0.11)}" y="${f1(top + bh * (0.18 + i * 0.2))}" text-anchor="middle" style="fill:#25334f;font-weight:700;font-size:12px">−</text>`;
      body += `<path d="M${f1(cx - bw / 2)} ${top + 3} Q${cx} ${top - 5} ${f1(cx + bw / 2)} ${top + 3}" fill="none" stroke="var(--line,#38424d)"/>`;
      const lx1 = cx - bw * 0.18, lx2 = cx + bw * 0.18, by = top + bh;
      body += `<line class="lead" x1="${f1(lx1)}" y1="${by}" x2="${f1(lx1)}" y2="${by + 22}"/><line class="lead" x1="${f1(lx2)}" y1="${by}" x2="${f1(lx2)}" y2="${by + 46}"/>`;
      body += `<text class="m" x="${f1(lx1)}" y="${by + 38}" text-anchor="middle">−</text><text class="b" x="${f1(lx2 + 8)}" y="${by + 54}" text-anchor="middle">+ (länger)</text>`;
      body += `<text class="b" x="${f1(cx + bw / 2 + 20)}" y="${top + 16}">Elko</text><text class="m" x="${f1(cx + bw / 2 + 20)}" y="${top + 32}">≈ ${dec(d)} × ${dec(hh)} mm</text><text class="m" x="${f1(cx + bw / 2 + 20)}" y="${top + 47}">gepolt</text>`;
      // Schaltzeichen
      const sx = 285, sy = top + 50;
      body += `<line class="ln" x1="${sx}" y1="${sy - 40}" x2="${sx}" y2="${sy - 7}"/><line class="ln" x1="${sx - 14}" y1="${sy - 7}" x2="${sx + 14}" y2="${sy - 7}"/><path class="ln" d="M${sx - 14} ${sy + 7} Q${sx} ${sy + 2} ${sx + 14} ${sy + 7}"/><line class="ln" x1="${sx}" y1="${sy + 4}" x2="${sx}" y2="${sy + 40}"/><text class="b" x="${sx - 22}" y="${sy - 12}">+</text>`;
      return svg(W, Math.max(top + bh + 66, 150), body, 'Elektrolytkondensator mit Polung');
    }
    // Keramikscheibe und Folienkondensator
    const cx1 = 90, cx2 = 235, top = 24;
    body += `<ellipse cx="${cx1}" cy="${top + 38}" rx="22" ry="27" fill="#d98b2b" stroke="#8a5313"/><text x="${cx1}" y="${top + 43}" text-anchor="middle" style="fill:#4a2d08;font-weight:700;font-size:13px">${esc(String(value || '').slice(0, 6))}</text>`;
    body += `<line class="lead" x1="${cx1 - 6}" y1="${top + 64}" x2="${cx1 - 6}" y2="${top + 112}"/><line class="lead" x1="${cx1 + 6}" y1="${top + 64}" x2="${cx1 + 6}" y2="${top + 112}"/>`;
    body += `<text class="b" x="${cx1}" y="${top - 6}" text-anchor="middle">Keramik</text><text class="m" x="${cx1}" y="${top + 128}" text-anchor="middle">ungepolt · pF bis 100 nF</text>`;
    body += `<rect x="${cx2 - 24}" y="${top + 12}" width="48" height="52" rx="4" fill="#2a6fbf" stroke="#17406f"/><line x1="${cx2 - 24}" y1="${top + 30}" x2="${cx2 + 24}" y2="${top + 30}" stroke="#17406f" stroke-opacity=".5"/><text x="${cx2}" y="${top + 50}" text-anchor="middle" style="fill:#f1f5fa;font-weight:700;font-size:13px">${esc(String(value || '').slice(0, 6))}</text>`;
    body += `<line class="lead" x1="${cx2 - 12}" y1="${top + 64}" x2="${cx2 - 12}" y2="${top + 112}"/><line class="lead" x1="${cx2 + 12}" y1="${top + 64}" x2="${cx2 + 12}" y2="${top + 112}"/>`;
    body += `<text class="b" x="${cx2}" y="${top - 6}" text-anchor="middle">Folie</text><text class="m" x="${cx2}" y="${top + 128}" text-anchor="middle">ungepolt · nF bis einige µF</text>`;
    return svg(W, 190, body, 'Keramik- und Folienkondensator');
  }

  /* ---------- DIP-Gehäuse ---------- */
  function dipSvg(cat, name) {
    const np = cat && cat.np ? cat.np : 8, lab = (cat && cat.labels) || [], half = np / 2, W = 340;
    const S = Math.min(10, 200 / (half * 2.54)), pitch = 2.54 * S, bw = 6.35 * S, rowW = 7.62 * S, cx = W / 2, top = 28, bh = half * pitch, left = cx - bw / 2, right = cx + bw / 2;
    let body = `<rect x="${f1(left)}" y="${top}" width="${f1(bw)}" height="${f1(bh)}" rx="2" fill="#2b2f36" stroke="var(--line,#38424d)"/>`;
    body += `<path d="M${f1(cx - 6)} ${top} A6 6 0 0 0 ${f1(cx + 6)} ${top}" fill="var(--bg,#14181c)" stroke="var(--line,#38424d)"/><circle cx="${f1(left + 7)}" cy="${f1(top + 11)}" r="2.6" fill="#4b525c"/>`;
    for (let i = 0; i < half; i++) {
      const y = top + pitch * (i + 0.5), j = np - 1 - i;
      body += `<rect x="${f1(left - 9)}" y="${f1(y - 2)}" width="9" height="4" fill="#b9bec6"/><rect x="${f1(right)}" y="${f1(y - 2)}" width="9" height="4" fill="#b9bec6"/>`;
      const fs = Math.min(11, Math.max(8, pitch - 1));
      body += `<text class="${i === 0 ? 'b' : ''}" x="${f1(left - 14)}" y="${f1(y + fs / 3)}" text-anchor="end" style="font-size:${f1(fs)}px">${i + 1}${lab[i] ? ' ' + esc(lab[i]) : ''}</text>`;
      body += `<text x="${f1(right + 14)}" y="${f1(y + fs / 3)}" style="font-size:${f1(fs)}px">${esc(lab[j] ? lab[j] + ' ' : '')}${j + 1}</text>`;
    }
    body += `<text class="m" x="${cx}" y="${f1(top + bh + 20)}" text-anchor="middle">${np} Pins · Rastermaß 2,54 mm · Reihenabstand 7,62 mm</text>`;
    body += `<text class="m" x="${cx}" y="${f1(top - 10)}" text-anchor="middle">Kerbe oben: von oben links gegen den Uhrzeigersinn zählen</text>`;
    return svg(W, top + bh + 30, body, 'DIP-Gehäuse ' + np + ' Pins' + (name ? ' ' + name : ''));
  }

  /* ---------- Feinsicherung 5 x 20 mm ---------- */
  function fuseSvg(value) {
    const S = 11, L = 20 * S, D = 5 * S, x = (340 - L) / 2, y = 34; let b = '';
    b += `<rect x="${f1(x + 14)}" y="${y}" width="${f1(L - 28)}" height="${D}" rx="3" fill="var(--vz-glass,#aeb8c2)" fill-opacity=".25" stroke="var(--mute,#8d99a6)"/>`;
    b += `<path d="M${f1(x + 22)} ${y + D / 2} q${f1((L - 44) / 8)} -10 ${f1((L - 44) / 4)} 0 t${f1((L - 44) / 4)} 0 t${f1((L - 44) / 4)} 0 t${f1((L - 44) / 4)} 0" fill="none" stroke="var(--fg,#e8ecf0)" stroke-width="1"/>`;
    b += `<rect x="${f1(x)}" y="${y - 2}" width="18" height="${D + 4}" rx="3" fill="#c3c8cf" stroke="#7d8590"/><rect x="${f1(x + L - 18)}" y="${y - 2}" width="18" height="${D + 4}" rx="3" fill="#c3c8cf" stroke="#7d8590"/>`;
    b += `<text class="b" x="170" y="${y - 12}" text-anchor="middle">Feinsicherung 5 × 20 mm${value ? ' · ' + esc(String(value).slice(0, 10)) : ''}</text>`;
    b += `<text class="m" x="170" y="${y + D + 22}" text-anchor="middle">Schmelzdraht im Glasrohr: schmilzt bei Überstrom</text>`;
    return svg(340, y + D + 34, b, 'Feinsicherung');
  }

  /* ---------- Zeigerinstrument ---------- */
  const STEPS = [1, 2, 5];
  function rangeFor(v) {                                // kleinste 1-2-5-Stufe, die den Betrag fasst
    const a = Math.abs(v); if (!fin(a) || a === 0) return 1;
    const e = Math.floor(Math.log10(a));
    for (let k = e - 1; k <= e + 1; k++) for (const s of STEPS) { const r = s * Math.pow(10, k); if (r >= a * 0.999999) return r; }
    return Math.pow(10, e + 1);
  }
  function parseMeter(txt) {                            // "−4,50 mV", "12,5 mA", "330 Ω", "--" -> { v, unit } oder null
    const m = String(txt || '').replace(/−/g, '-').trim().match(/^(-?\d+(?:[.,]\d+)?)\s*([pnuµmkM]?)\s*(V|A|W|Ω|Ohm|Hz|F)\b/);
    if (!m) return null;
    return { v: parseFloat(m[1].replace(',', '.')) * (m[2] ? SI[m[2]] : 1), unit: m[3] === 'Ohm' ? 'Ω' : m[3], shown: parseFloat(m[1].replace(',', '.')), pre: m[2] };
  }
  const prefOf = r => { const a = Math.abs(r); return a >= 1e6 ? ['M', 1e6] : a >= 1e3 ? ['k', 1e3] : a >= 1 ? ['', 1] : a >= 1e-3 ? ['m', 1e-3] : a >= 1e-6 ? ['µ', 1e-6] : ['n', 1e-9]; };
  function gaugeSvg(txt) {
    const m = parseMeter(txt), W = 220, H = 118, cx = 110, cy = 100, R = 82;
    if (!m) return svg(W, 30, `<text class="m" x="${cx}" y="18" text-anchor="middle">Zeiger: keine Messung</text>`, 'Zeigerinstrument ohne Messwert');
    const rg = rangeFor(m.v), pf = prefOf(rg), neg = m.v < 0, frac = Math.max(-1, Math.min(1, m.v / rg)), ang = Math.PI * (1 - (frac + 1) / 2);   // pi (links) .. 0 (rechts)
    const P = (a, r) => [cx + Math.cos(a) * r, cy - Math.sin(a) * r];
    let b = '';
    // Skalenbogen und Teilstriche (zehn Teile je Seite: zwanzig Striche)
    const a0 = P(Math.PI, R), a1 = P(0, R);
    b += `<path class="ln" d="M${f1(a0[0])} ${f1(a0[1])} A${R} ${R} 0 0 1 ${f1(a1[0])} ${f1(a1[1])}"/>`;
    for (let i = 0; i <= 20; i++) {
      const a = Math.PI * (1 - i / 20), big = i % 5 === 0, p1 = P(a, R), p2 = P(a, R - (big ? 10 : 5));
      b += `<line class="ln" x1="${f1(p1[0])}" y1="${f1(p1[1])}" x2="${f1(p2[0])}" y2="${f1(p2[1])}"/>`;
      if (big) { const tp = P(a, R - 20), val = (i - 10) / 10 * rg / pf[1]; b += `<text class="m" x="${f1(tp[0])}" y="${f1(tp[1] + 3)}" text-anchor="middle" style="font-size:9.5px">${dec(val, 2)}</text>`; }
    }
    const t = P(ang, R - 8);
    b += `<line class="hi" x1="${cx}" y1="${cy}" x2="${f1(t[0])}" y2="${f1(t[1])}" style="stroke-width:2.4;stroke-linecap:round"/><circle class="hif" cx="${cx}" cy="${cy}" r="5"/>`;
    b += `<text class="b" x="${cx}" y="${cy - 26}" text-anchor="middle" style="font-size:13px">${pf[0]}${m.unit}</text>`;
    if (neg) b += `<text class="m" x="${cx}" y="${cy - 40}" text-anchor="middle" style="font-size:10px">Zeiger links von Null: Polung vertauscht</text>`;
    return svg(W, H, b, 'Zeigerinstrument, Endausschlag ' + dec(rg / pf[1], 2) + ' ' + pf[0] + m.unit);
  }

  const noTask = side => !side.querySelector('.card.task');
  const card = (title, html, note) => `<div class="card vzc" data-vz="1"><h4>${esc(title)}</h4>${html}${note ? `<p class="vzn">${note}</p>` : ''}</div>`;

  /* ---------- Bildbausteine je Bauteilart (Eingabe: Art, Wert, Zusatz) ---------- */
  function partCard(kind, v, o) {
    o = o || {};
    if (kind === 'R') {
      const bd = bands(parseVal(v)), watt = o.watt;
      const note = bd ? `Farbringe für <b>${esc(String(v))}</b>: ${esc(bandText(bd))}. Je größer die Nennleistung, desto größer der Körper.` + (watt != null && fin(watt) ? ` Im Betrieb: ${dec(watt * 1000, 1)} mW (Faustregel: Dauerleistung höchstens die halbe Nennleistung).` : ' Typische Größen, Hersteller weichen etwas ab.') : 'Typische Größen axialer Widerstände, Hersteller weichen etwas ab.';
      return card('Bauform: Widerstand', resistorSvg(v, o), note);
    }
    if (kind === 'LED') {
      const lv = root.LochSim && root.LochSim.LEDVF, vf = lv ? lv[ledKey(v)] : null;
      return card('Bauform: LED', ledSvg(v), `Langes Bein = Anode (+), Abflachung am Rand und kurzes Bein = Kathode (−).` + (vf ? ` Flussspannung im Simulator: <b>${dec(vf, 1)} V</b>.` : ''));
    }
    if (kind === 'C') return card('Bauform: Kondensator', capSvg(v, false), 'Kleine Kapazitäten sind Keramik, mittlere Folie. Beide haben keine Polung.');
    if (kind === 'CE') return card('Bauform: Elko', capSvg(v, true), 'Der Elko ist gepolt: Der Streifen am Gehäuse markiert den Minuspol. Falsch herum eingebaut kann er platzen. Typische Größe, sie hängt von Kapazität und Spannung ab.');
    if (kind === 'FUSE') return card('Bauform: Sicherung', fuseSvg(v), 'Die Aufschrift nennt den Nennstrom, träge (T) oder flink (F) steht dahinter.');
    if (kind === 'ICX' || kind === 'IC') {
      const cat = o.cat; if (!cat) return '';
      return card('Bauform: DIP-Gehäuse', dipSvg(cat, o.name), 'Die Kerbe zeigt nach oben, Pin 1 liegt links daneben. Gezählt wird gegen den Uhrzeigersinn.');
    }
    return '';
  }

  const api = { parseVal, bands, bandText, resistorSvg, ledSvg, capSvg, dipSvg, fuseSvg, gaugeSvg, parseMeter, rangeFor, partCard, ledKey, RSIZE, CSS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SIM_VIZ = api;

  /* ---------- Einhängen in die Seitenleiste (nur im Browser) ---------- */
  if (typeof document === 'undefined' || !root.MutationObserver) return;
  let busy = false;
  const SIG = { fig: '', gau: '' };
  function enhance() {
    const side = document.getElementById('side'); if (!side || busy) return;
    busy = true;
    try {
      if (!document.getElementById('vzCss')) { const st = document.createElement('style'); st.id = 'vzCss'; st.textContent = CSS; document.head.appendChild(st); }
      // Bauteilkarte
      const h4 = side.querySelector('.card h4[data-wk]'), old = side.querySelector('.vzc[data-vz="fig"]');
      if (!h4 || !noTask(side)) { if (old) old.remove(); SIG.fig = ''; }
      else {
        const crd = h4.closest('.card'), kind = h4.getAttribute('data-wk');
        let v = ''; const vi = crd.querySelector('input[data-p="v"],select[data-p="v"]'); if (vi) v = vi.value;
        const o = {};
        if (kind === 'ICX') { const ic = crd.querySelector('select[data-ic]'), key = ic ? ic.value : '', cat = root.LochSimICs && root.LochSimICs.CATALOG && root.LochSimICs.CATALOG[key]; o.cat = cat; o.name = cat && cat.name; }
        if (kind === 'R') { const live = side.querySelector('#live'); if (live) { const rows = [...live.querySelectorAll('.kv')].filter(r => /Leistung/.test(r.textContent)); if (rows[0]) { const pm = parseMeter(rows[0].querySelector('b').textContent); if (pm && pm.unit === 'W') o.watt = pm.v; } } }
        const sig = kind + '|' + v + '|' + (o.cat ? o.cat.np : '') + '|' + (o.watt != null ? Math.round(o.watt * 1e4) : '');
        if (sig !== SIG.fig || !old || !crd.nextElementSibling || crd.nextElementSibling !== old) {
          if (old) old.remove();
          const html = partCard(kind, v, o);
          if (html) { crd.insertAdjacentHTML('afterend', html.replace('data-vz="1"', 'data-vz="fig"')); SIG.fig = sig; } else SIG.fig = '';
        }
      }
      // Zeigerinstrument unter dem Multimeter
      const lcd = side.querySelector('#mmVal'), g = side.querySelector('.vzg');
      if (lcd && noTask(side)) {
        const txt = lcd.textContent;
        if (!g) { lcd.insertAdjacentHTML('afterend', '<div class="vzc vzg"></div>'); SIG.gau = ''; }
        const gg = side.querySelector('.vzg');
        if (txt !== SIG.gau) { gg.innerHTML = gaugeSvg(txt); SIG.gau = txt; }
      } else if (g) { g.remove(); SIG.gau = ''; }
    } catch (e) { /* Anzeige ist Zugabe: Fehler dürfen das Lab nie stören */ }
    busy = false;
  }
  function start() {
    const side = document.getElementById('side'); if (!side) return;
    let tm = 0;
    new MutationObserver(() => { if (busy) return; if (tm) return; tm = setTimeout(() => { tm = 0; enhance(); }, 30); }).observe(side, { childList: true, subtree: true, characterData: true });
    enhance();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})(typeof window !== 'undefined' ? window : globalThis);
