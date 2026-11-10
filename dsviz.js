'use strict';
/* Tonfunk Datenblatt-Lab: Darstellungs-Ergaenzung (dsviz.js, window.DS_VIZ bzw. module.exports). Reine Anzeige, inline-SVG, offline, keine Bibliothek.
   - Karte "Bauformen im Massstab" im Reiter Lernen: TO-220, TO-92, SOT-23, SOIC-8 und DIP-8 (Draufsicht bzw. Ansicht auf die Beschriftungsseite) mit einem
     gemeinsamen Massstab und Massstabsbalken, dazu Axial-Widerstaende nach Nennleistung (0,125 W bis 2 W) im selben Massstab. Die Masse sind Nennwerte
     (Gehaeusekoerper), die Widerstandsmasse typische Werte: je Hersteller weichen sie um einige Zehntel Millimeter ab.
   Es werden keine Aufgaben, Loesungen oder Pruefwerte angezeigt; Aufgaben-, Trainer- und Pruefbereiche bleiben unberuehrt.
   Farben nur ueber CSS-Variablen der Seite (Klassen), keine Animation. Haengt sich per MutationObserver an den Reiter Lernen (#helpView). */
(function (root) {
  const f = v => String(Math.round(v * 100) / 100);
  const dec = v => String(v).replace('.', ',');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* Nennmasse in mm. bw x bh = Koerper in der gezeichneten Ansicht, pitch = Rastermass der Anschluesse, span = Gesamtbreite ueber die Anschlussspitzen */
  const PKGS = [
    { id: 'TO-220', note: 'Kühlfahne mit Loch (Ø ca. 3,8 mm)', bw: 10.0, bh: 15.0, pitch: 2.54, lead: 13.0, pins: 3 },
    { id: 'TO-92', note: 'Kunststoff, flache Seite beschriftet', bw: 4.7, bh: 4.5, pitch: 1.27, lead: 12.7, pins: 3 },
    { id: 'SOT-23', note: 'SMD, Draufsicht', bw: 2.9, bh: 1.3, pitch: 0.95, span: 2.4, pins: 3 },
    { id: 'SOIC-8', note: 'SMD, Draufsicht', bw: 3.9, bh: 4.9, pitch: 1.27, span: 6.0, pins: 8 },
    { id: 'DIP-8', note: 'steckbar, Draufsicht', bw: 6.35, bh: 9.8, pitch: 2.54, span: 7.62, pins: 8 }
  ];
  /* Axial-Widerstaende: Nennleistung in W, Koerperlaenge L und Durchmesser D in mm (typische Werte) */
  const RES = [
    { w: 0.125, L: 3.2, D: 1.8 }, { w: 0.25, L: 6.3, D: 2.4 }, { w: 0.5, L: 9.0, D: 3.3 }, { w: 1, L: 11.0, D: 4.0 }, { w: 2, L: 15.0, D: 5.0 }
  ];
  const S = 5, SR = 7, W = 340;

  function pkgDraw(p, cx, y0) {
    let s = ''; const bw = p.bw * S, bh = p.bh * S, x = cx - bw / 2;
    if (p.id === 'TO-220') {
      s += `<rect class="dv-b" x="${f(x)}" y="${f(y0)}" width="${f(bw)}" height="${f(bh)}" rx="2"/><rect class="dv-t" x="${f(x)}" y="${f(y0)}" width="${f(bw)}" height="${f(6 * S)}" rx="2"/><circle class="dv-h" cx="${f(cx)}" cy="${f(y0 + 2.4 * S)}" r="${f(1.9 * S)}"/>`;
      for (let i = -1; i <= 1; i++) s += `<rect class="dv-l" x="${f(cx + i * p.pitch * S - 0.4 * S)}" y="${f(y0 + bh)}" width="${f(0.8 * S)}" height="${f(p.lead * S)}"/>`;
    } else if (p.id === 'TO-92') {
      s += `<path class="dv-b" d="M${f(x)} ${f(y0 + bh)}V${f(y0 + bw / 2)}A${f(bw / 2)} ${f(bw / 2)} 0 0 1 ${f(x + bw)} ${f(y0 + bw / 2)}V${f(y0 + bh)}Z"/>`;
      for (let i = -1; i <= 1; i++) s += `<rect class="dv-l" x="${f(cx + i * p.pitch * S - 0.25 * S)}" y="${f(y0 + bh)}" width="${f(0.5 * S)}" height="${f(p.lead * S)}"/>`;
    } else if (p.id === 'SOT-23') {
      const sp = p.span * S, ym = y0 + (sp - bh) / 2, lh = (sp - bh) / 2;
      s += `<rect class="dv-l" x="${f(cx - 0.2 * S)}" y="${f(y0)}" width="${f(0.4 * S)}" height="${f(lh)}"/>`;
      [-1, 1].forEach(k => { s += `<rect class="dv-l" x="${f(cx + k * p.pitch * S - 0.2 * S)}" y="${f(ym + bh)}" width="${f(0.4 * S)}" height="${f(lh)}"/>`; });
      s += `<rect class="dv-b" x="${f(x)}" y="${f(ym)}" width="${f(bw)}" height="${f(bh)}" rx="1"/>`;
    } else {
      const n = p.pins / 2, sp = p.span * S, lw = (sp - bw) / 2, th = (p.id === 'DIP-8' ? 0.5 : 0.4) * S;
      s += `<rect class="dv-b" x="${f(x)}" y="${f(y0)}" width="${f(bw)}" height="${f(bh)}" rx="2"/>`;
      for (let i = 0; i < n; i++) {
        const yy = y0 + bh / 2 + (i - (n - 1) / 2) * p.pitch * S;
        s += `<rect class="dv-l" x="${f(cx - sp / 2)}" y="${f(yy - th / 2)}" width="${f(lw)}" height="${f(th)}"/><rect class="dv-l" x="${f(cx + bw / 2)}" y="${f(yy - th / 2)}" width="${f(lw)}" height="${f(th)}"/>`;
      }
      s += `<circle class="dv-d" cx="${f(x + 4)}" cy="${f(y0 + 4)}" r="1.6"/>`;
    }
    return s;
  }
  const pkgHeight = p => (p.id === 'TO-220' || p.id === 'TO-92') ? (p.bh + p.lead) * S : p.id === 'SOT-23' ? p.span * S : p.bh * S;
  const CX = [34, 82, 128, 178, 236];
  function scaleSvg() {
    const y0 = 16; let hmax = 0, s = '';
    PKGS.forEach((p, i) => { s += pkgDraw(p, CX[i], y0); hmax = Math.max(hmax, pkgHeight(p)); });
    const yl = y0 + hmax + 16;
    PKGS.forEach((p, i) => { s += `<text class="dv-tx dv-b2" x="${CX[i]}" y="${f(yl)}" text-anchor="middle">${esc(p.id)}</text>`; });
    const bx = 276, by = y0 + hmax - 4;
    s += `<path class="dv-ax" d="M${bx} ${by}h${10 * S}M${bx} ${by - 4}v8M${bx + 10 * S} ${by - 4}v8"/><text class="dv-tx dv-m" x="${bx + 5 * S}" y="${by - 8}" text-anchor="middle">10 mm</text>`;
    return `<svg class="dv-svg" viewBox="0 0 ${W} ${f(yl + 8)}" role="img" aria-label="Gehäuseformen TO-220, TO-92, SOT-23, SOIC-8 und DIP-8 im gleichen Maßstab mit Maßstabsbalken 10 Millimeter">${s}</svg>`;
  }
  function resistorSvg() {
    let s = '', y = 6; const rowH = 34, xb = 96, ls = 4 * SR;
    RES.forEach(r => {
      const L = r.L * SR, D = r.D * SR, cy = y + rowH / 2;
      s += `<text class="dv-tx dv-b2" x="8" y="${f(cy + 4)}">${dec(r.w)} W</text><rect class="dv-l" x="${xb - ls}" y="${f(cy - 0.3 * SR)}" width="${f(L + 2 * ls)}" height="${f(0.6 * SR)}"/>`;
      s += `<rect class="dv-r" x="${xb}" y="${f(cy - D / 2)}" width="${f(L)}" height="${f(D)}" rx="${f(Math.min(D / 2, 4))}"/>`;
      s += `<text class="dv-tx dv-m" x="${f(xb + L + ls + 10)}" y="${f(cy + 4)}">ca. ${dec(r.L)} × ${dec(r.D)} mm</text>`; y += rowH;
    });
    return `<svg class="dv-svg" viewBox="0 0 ${W} ${y + 2}" role="img" aria-label="Axial-Widerstände nach Nennleistung 0,125 bis 2 Watt im gleichen Maßstab: größere Nennleistung, größerer Körper">${s}</svg>`;
  }
  function tableHtml() {
    const rows = PKGS.map(p => `<tr><td><b>${esc(p.id)}</b></td><td>${dec(p.bw)} × ${dec(p.bh)} mm</td><td>${dec(p.pitch)} mm</td><td>${esc(p.note)}</td></tr>`).join('');
    return `<table><thead><tr><th>Bauform</th><th>Körper (B × H)</th><th>Raster</th><th>Merkmal</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  function cardHtml() {
    return `<summary>Bauformen im Maßstab</summary><div class="hb2"><p>Alle Gehäuse sind im selben Maßstab gezeichnet (Balken rechts: 10 mm). So siehst du, wie klein ein SMD-Bauteil gegenüber einem steckbaren ist.</p>${scaleSvg()}${tableHtml()}<p>Widerstände: Je mehr Leistung der Widerstand dauerhaft in Wärme umsetzen darf, desto größer ist sein Körper, denn er braucht mehr Oberfläche, um die Wärme abzugeben. Die Maße sind typische Werte und weichen je Hersteller etwas ab.</p>${resistorSvg()}</div>`;
  }
  const CSS = `.dv-svg{display:block;width:100%;max-width:520px;height:auto;margin:6px auto}
.dv-b{fill:var(--panel2);stroke:var(--mute);stroke-width:1.2}.dv-t{fill:var(--line);stroke:var(--mute);stroke-width:1.2}.dv-h{fill:var(--bg);stroke:var(--mute);stroke-width:1}
.dv-l{fill:var(--mute);stroke:none}.dv-d{fill:var(--fg)}.dv-r{fill:var(--warn);fill-opacity:.55;stroke:var(--warn);stroke-width:1.2}
.dv-ax{fill:none;stroke:var(--accent);stroke-width:1.6}.dv-tx{fill:var(--fg);font:11px system-ui,-apple-system,"Segoe UI",sans-serif}.dv-b2{font-weight:700}.dv-m{fill:var(--mute)}`;
  function inject() { if (typeof document === 'undefined' || document.getElementById('dvCss')) return; const s = document.createElement('style'); s.id = 'dvCss'; s.textContent = CSS; document.head.appendChild(s); }
  function mount() {
    const V = document.getElementById('helpView'); if (!V || !V.children.length || V.querySelector('#dvScale')) return;
    const d = document.createElement('details'); d.id = 'dvScale'; d.innerHTML = cardHtml();
    const first = V.querySelector('details'); if (first && first.nextSibling) V.insertBefore(d, first.nextSibling); else V.appendChild(d);
  }
  function init() {
    if (typeof document === 'undefined') return; inject(); mount();
    const V = document.getElementById('helpView'); if (V && typeof MutationObserver !== 'undefined') new MutationObserver(mount).observe(V, { childList: true });
  }
  const API = { PKGS, RES, scaleSvg, resistorSvg, tableHtml, cardHtml, CSS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.DS_VIZ = API;
  if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init(); }
})(typeof globalThis !== 'undefined' ? globalThis : this);
