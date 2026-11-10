'use strict';
/* Tonfunk EMV-Lab: Visualisierungen (Lab-Kennung 'emv'), window.EMV_VIZ, per Node testbar (module.exports).
   Reine SVG-/HTML-Funktionen plus eine kleine DOM-Anbindung, die ohne Änderung an emvui.js auskommt (liest nur window.EMV_UI.S):
   - Karte "Bauteile im Filter" im Prüfstand Netzfilter: Die gewählten Bauteile erscheinen in ihrer echten Bauform
     (X-Kondensator als Folienbecher, Y-Kondensator als Keramikscheibe, Gleichtaktdrossel als Ringkern mit zwei Wicklungen,
     Ferrit als Hülse um das Netzkabel). Die Größe wächst mit dem Wert, die Anschlussdrähte folgen der gewählten Anschlusslänge.
     Bauteile, die in der gewählten Topologie nicht vorkommen oder auf "ohne" stehen, erscheinen gestrichelt.
   Aufgabenintegrität: Die Karte zeigt nur die Einstellungen, die auch im Bedienpult stehen. Sie bewertet nichts und nennt keine Fehler.
   Größen sind Bauformen, nicht maßstäblich (steht auf der Karte). Farben nur über CSS-Variablen. Keine Animation, kein Hover.
   Keine Bibliotheken, keine Markennamen. */
(function (root) {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fin = v => typeof v === 'number' && isFinite(v);
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const q = v => String(Math.round((fin(v) ? v : 0) * 10) / 10);
  const de = (v, d) => (fin(v) ? v.toFixed(d).replace('.', ',') : '–');
  /* Kapazität als Text: 10 nF, 2,2 nF, 1 µF */
  function capText(c) {
    if (!fin(c) || c <= 0) return 'ohne';
    if (c >= 1e-6) { const u = Math.round(c * 1e7) / 10; return de(u, u === Math.round(u) ? 0 : 1) + ' µF'; }
    const n = Math.round(c * 1e10) / 10; return de(n, n === Math.round(n) ? 0 : 1) + ' nF';
  }
  const lenText = m => (fin(m) ? de(m * 1000, 0) + ' mm' : '–');
  const DROSSEL = { d1: { mH: 1, txt: '1 mH' }, d3: { mH: 3.3, txt: '3,3 mH' }, d10: { mH: 10, txt: '10 mH' }, d22: { mH: 22, txt: '22 mH' } };

  /* Zustand der Bauteile aus den Reglerwerten des Filter-Prüfstands */
  function partsFrom(c) {
    c = c && typeof c === 'object' ? c : {}; const topo = ['kein', 'C', 'LC', 'pi'].indexOf(c.topo) >= 0 ? c.topo : 'pi';
    const cx = fin(+c.cx) ? +c.cx : 0, cy = fin(+c.cy) ? +c.cy : 0, dr = DROSSEL[c.drossel] || null, lead = fin(+c.lead) ? clamp(+c.lead, 0, 0.03) : 0.015;
    return {
      topo, lead, ferrit: !!c.ferrit,
      x: { inCircuit: topo !== 'kein' && cx > 0, c: cx, why: topo === 'kein' ? 'kein Querzweig' : cx > 0 ? '' : 'ohne' },
      y: { inCircuit: topo !== 'kein' && cy > 0, c: cy, why: topo === 'kein' ? 'kein Querzweig' : cy > 0 ? '' : 'ohne' },
      l: { inCircuit: topo !== 'C' && !!dr, mH: dr ? dr.mH : 0, txt: dr ? dr.txt : '', why: topo === 'C' ? 'in dieser Topologie nicht vorhanden' : dr ? '' : 'ohne' }
    };
  }

  /* ---------- Bauformen (je ein SVG, 120 x 84) ---------- */
  const wrap = (inner, label) => `<svg class="ev-pt" viewBox="0 0 120 84" role="img" aria-label="${esc(label)}">${inner}</svg>`;
  const lead = (x, y0, len, spread) => `<path class="ev-lead" d="M${q(x)} ${q(y0)}L${q(x + (spread || 0))} ${q(y0 + len)}"/>`;
  /* X-Kondensator: Folienkondensator im Kunststoffbecher, Breite wächst mit der Kapazität */
  function xCap(p) {
    const on = p.x.inCircuit, c = on ? p.x.c : 100e-9, bw = clamp(38 + 46 * Math.log10(Math.max(c, 1e-8) / 1e-8) / 2, 38, 84), x0 = (120 - bw) / 2, L = 5 + 24 * (p.lead / 0.03);
    let s = '';
    s += lead(x0 + 9, 52, L) + lead(x0 + bw - 9, 52, L);
    s += `<rect class="ev-body foil${on ? '' : ' off'}" x="${q(x0)}" y="10" width="${q(bw)}" height="42" rx="4"/>`;
    s += `<path class="ev-sh" d="M${q(x0 + 4)} 16H${q(x0 + bw - 4)}"/>`;
    s += `<text class="ev-tx" x="60" y="36" text-anchor="middle">X2</text>`;
    return wrap(s, on ? 'X-Kondensator als Folienkondensator im Kunststoffbecher' : 'X-Kondensator nicht vorhanden');
  }
  /* Y-Kondensator: Keramikscheibe, Durchmesser wächst mit der Kapazität */
  function yCap(p) {
    const on = p.y.inCircuit, c = on ? p.y.c : 2.2e-9, r = clamp(14 + 4 * Math.log10(Math.max(c, 1e-9) / 1e-9) / 0.67, 14, 19), L = 5 + 24 * (p.lead / 0.03);
    let s = '';
    s += lead(54, 10 + 2 * r - 4, L + 2, -1.5) + lead(66, 10 + 2 * r - 4, L + 2, 1.5);
    s += `<circle class="ev-body cer${on ? '' : ' off'}" cx="60" cy="${q(10 + r)}" r="${q(r)}"/>`;
    s += `<path class="ev-sh" d="M${q(60 - r * 0.6)} ${q(10 + r - r * 0.55)}A${q(r * 0.8)} ${q(r * 0.8)} 0 0 1 ${q(60 + r * 0.1)} ${q(10 + r - r * 0.85)}"/>`;
    s += `<text class="ev-tx" x="60" y="${q(10 + r + 4)}" text-anchor="middle">Y2</text>`;
    return wrap(s, on ? 'Y-Kondensator als Keramikscheibe' : 'Y-Kondensator nicht vorhanden');
  }
  /* Gleichtaktdrossel: Ringkern mit zwei Wicklungen (Windungszahl und Kerngröße wachsen mit L) */
  function choke(p) {
    const on = p.l.inCircuit, mH = on ? p.l.mH : 10, R = clamp(24 + 4.2 * Math.log10(Math.max(mH, 1)) * 1.6, 24, 36), r = R * 0.55, cx = 60, cy = 42, n = clamp(Math.round(4 + 1.5 * Math.log2(Math.max(mH, 1) + 1)), 5, 11);
    let s = `<path class="ev-core${on ? '' : ' off'}" fill-rule="evenodd" d="M${q(cx - R)} ${cy}a${q(R)} ${q(R)} 0 1 0 ${q(2 * R)} 0a${q(R)} ${q(R)} 0 1 0 ${q(-2 * R)} 0ZM${q(cx - r)} ${cy}a${q(r)} ${q(r)} 0 1 0 ${q(2 * r)} 0a${q(r)} ${q(r)} 0 1 0 ${q(-2 * r)} 0Z"/>`;
    if (on) {
      for (let h = 0; h < 2; h++) {
        const a0 = h === 0 ? 118 : -62, a1 = h === 0 ? 242 : 62;
        for (let i = 0; i < n; i++) {
          const a = (a0 + (a1 - a0) * (i + 0.5) / n) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), r0 = r - 3.5, r1 = R + 3.5;
          s += `<path class="ev-cu" d="M${q(cx + r0 * ca)} ${q(cy + r0 * sa)}L${q(cx + r1 * ca)} ${q(cy + r1 * sa)}"/>`;
        }
      }
    }
    return wrap(s, on ? 'Gleichtaktdrossel als Ringkern mit zwei Wicklungen' : 'Gleichtaktdrossel nicht vorhanden');
  }
  /* Ferrit: Klapp- oder Hülsenferrit um das Netzkabel */
  function ferrite(p) {
    const on = p.ferrit;
    let s = `<path class="ev-cable" d="M4 44H116"/>`;
    s += `<rect class="ev-fer${on ? '' : ' off'}" x="38" y="26" width="44" height="36" rx="5"/>`;
    if (on) s += `<path class="ev-sh" d="M42 32H78"/><path class="ev-seam" d="M60 26V62"/><rect class="ev-latch" x="58" y="40" width="4" height="8" rx="1.5"/>`;
    return wrap(s, on ? 'Ferrit als Hülse um das Netzkabel' : 'Kein Ferrit am Netzkabel');
  }
  function tile(svg, title, value, note, on) {
    return `<div class="ev-part${on ? '' : ' absent'}">${svg}<b>${esc(title)}</b><span class="ev-v">${esc(value)}</span><span class="ev-n">${esc(note)}</span></div>`;
  }
  function cardHtml(c) {
    const p = partsFrom(c);
    const t = [
      tile(xCap(p), 'X-Kondensator', p.x.inCircuit ? capText(p.x.c) : p.x.why, 'Folienbecher, zwischen den Leitern (Gegentakt), Anschlüsse ' + lenText(p.lead), p.x.inCircuit),
      tile(yCap(p), 'Y-Kondensator', p.y.inCircuit ? capText(p.y.c) + ' je Leiter' : p.y.why, 'Keramikscheibe, Leiter gegen Schutzleiter (Gleichtakt), Anschlüsse ' + lenText(p.lead), p.y.inCircuit),
      tile(choke(p), 'Gleichtaktdrossel', p.l.inCircuit ? p.l.txt : p.l.why, 'Ringkern, beide Leiter gleichsinnig gewickelt: Gleichtakt sieht die volle Induktivität, der Gegentakt hebt sich im Kern auf', p.l.inCircuit),
      tile(ferrite(p), 'Ferrit am Netzkabel', p.ferrit ? 'aufgesteckt' : 'ohne', 'Hülse um das Kabel, dämpft Gleichtakt durch Verluste im Ferrit', p.ferrit)
    ];
    return `<div class="ev-grid">${t.join('')}</div><p class="ev-note">Bauformen, nicht maßstäblich. Die Größe wächst mit dem Wert, die Drähte folgen der Anschlusslänge.</p>`;
  }

  /* ---------- DOM-Anbindung ---------- */
  const CSS = `
:root{--ev-foil:#d9a521;--ev-cer:#4a86d8;--ev-cu:#c4793a;--ev-core:#59616b;--ev-cable:#2b2f35;--ev-fer:#3b4048}
@media(prefers-color-scheme:light){:root:not([data-theme=dark]){--ev-foil:#e0ad2b;--ev-cer:#5a96e0;--ev-cu:#b8662a;--ev-core:#8b95a1;--ev-cable:#3a3f46;--ev-fer:#555b64}}
:root[data-theme=light]{--ev-foil:#e0ad2b;--ev-cer:#5a96e0;--ev-cu:#b8662a;--ev-core:#8b95a1;--ev-cable:#3a3f46;--ev-fer:#555b64}
.ev-card>summary{min-height:44px}.ev-card .cb{padding:0 10px 10px}
.ev-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}
.ev-part{display:flex;flex-direction:column;align-items:center;text-align:center;gap:3px;padding:8px 8px 10px;border-radius:12px;background:var(--panel2);border:1px solid var(--line)}
.ev-part.absent{opacity:.62}.ev-part.absent svg{opacity:.8}
.ev-pt{width:100%;max-width:130px;height:auto}
.ev-part b{font-size:14px}.ev-part .ev-v{font:700 14px system-ui,sans-serif;color:var(--accent)}.ev-part .ev-n{font-size:12.5px;line-height:1.35;color:var(--mute)}
.ev-body{stroke:var(--fg);stroke-width:1.2;stroke-opacity:.55}
.ev-body.foil{fill:var(--ev-foil)}.ev-body.cer{fill:var(--ev-cer)}
.ev-body.off,.ev-core.off,.ev-fer.off{fill:none;stroke:var(--mute);stroke-width:1.6;stroke-opacity:1;stroke-dasharray:5 4}
.ev-lead{stroke:var(--mute);stroke-width:2.2;stroke-linecap:round;fill:none}
.ev-sh{stroke:#fff;stroke-opacity:.45;stroke-width:2;fill:none;stroke-linecap:round}
.ev-tx{fill:#1a1d22;font:800 12px system-ui,sans-serif;opacity:.8}
.ev-core{fill:var(--ev-core);stroke:var(--fg);stroke-opacity:.45;stroke-width:1.1}.ev-cu{stroke:var(--ev-cu);stroke-width:3.4;stroke-linecap:round;fill:none}
.ev-cable{stroke:var(--ev-cable);stroke-width:7;stroke-linecap:round;fill:none}
.ev-fer{fill:var(--ev-fer);stroke:var(--fg);stroke-opacity:.5;stroke-width:1.2}.ev-seam{stroke:#000;stroke-opacity:.45;stroke-width:1.2;fill:none}.ev-latch{fill:var(--mute)}
.ev-note{font-size:12.5px;color:var(--mute);margin:8px 2px 0;line-height:1.4}
`;
  function start() {
    const doc = document; if (doc.getElementById('emvviz-css')) return;
    const st = doc.createElement('style'); st.id = 'emvviz-css'; st.textContent = CSS; doc.head.appendChild(st);
    const host = doc.getElementById('rigMain'); if (!host) return;
    const card = doc.createElement('details'); card.className = 'card ev-card'; card.id = 'evBauteile'; card.hidden = true;
    card.innerHTML = '<summary>Bauteile im Filter</summary><div class="cb"></div>';
    const anchor = doc.getElementById('meters');
    if (anchor && anchor.parentNode === host) host.insertBefore(card, anchor.nextSibling); else host.appendChild(card);
    let sv = null; try { sv = localStorage.getItem('lm4.emv.vzBauteile'); } catch (e) {} card.open = sv !== '0';
    card.addEventListener('toggle', () => { try { localStorage.setItem('lm4.emv.vzBauteile', card.open ? '1' : '0'); } catch (e) {} last = ''; tick(); });
    const cb = card.querySelector('.cb'); let last = '';
    function tick() {
      try {
        const U = root.EMV_UI, S = U && U.S, show = !!(S && S.rig && S.rigId === 'filter' && S.tab === 'rig');
        if (card.hidden === show) card.hidden = !show; if (!show || !card.open || doc.hidden) return;
        const c = S.rig.getControls ? S.rig.getControls() : null, sig = JSON.stringify([c && c.topo, c && c.cx, c && c.cy, c && c.drossel, c && c.lead, c && c.ferrit]);
        if (sig !== last) { last = sig; cb.innerHTML = cardHtml(c); }
      } catch (e) { /* Anzeige darf den Prüfstand nie stören */ }
    }
    setInterval(tick, 250); tick();
  }
  if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start(); }
  const API = { partsFrom, capText, xCap, yCap, choke, ferrite, cardHtml };
  root.EMV_VIZ = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
