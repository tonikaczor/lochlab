'use strict';
/* Tonfunk Energie-Lab: Visualisierungen (Lab-Kennung 'enr'), window.ENR_VIZ, per Node testbar (module.exports).
   Reine SVG-Funktionen plus eine kleine DOM-Anbindung, die ohne Änderung an enrui.js auskommt (liest nur ENR_UI.S und rig.readMeters()):
   - Karte "Energiefluss (Sankey)" unter dem Bild der Prüfstände "Netz" und "Inselanlage": Die Bandbreite ist die Leistung in W.
     Netz: Solar (DC) -> Wechselrichter-Verlust, Haus, Speicher laden, Einspeisung; Netzbezug und Speicher-Entladung -> Haus.
     Inselanlage: Solar -> Last, Akku laden; Akku-Entladung -> Last.
   - Reiter "Auslegen", Leitung: Querschnittsbild der Ader im Größenverhältnis (Fläche proportional zu mm²), Vergleich mit den Normquerschnitten.
   Aufgabenintegrität: Die Karte erscheint nicht, solange eine Aufgabe läuft (ENR_UI.S.task) und nicht in Aufgaben-, Trainer- oder Prüfansichten.
   Farben nur über CSS-Variablen (Kupferfarbe der Ader ist ein Materialton). Keine Animation (Zahlen werden alle 0,4 s aufgefrischt, ohne Bewegung). */
(function (root) {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fin = (v, d) => (typeof v === 'number' && isFinite(v)) ? v : (d || 0);
  const p1 = v => fin(v).toFixed(1);
  const de = (v, d) => fin(v).toFixed(d == null ? 0 : d).replace('.', ',');
  const pos = v => Math.max(0, fin(v));

  /* ---------- Sankey ---------- */
  /* spec: { left: [{id,label,v,col}], right: [...], links: [{a,b,v,col?}], unit }  Farben als CSS-Wert (var(--x)) */
  function sankeySvg(spec, o) {
    o = o || {}; const W = 360, unit = spec.unit || 'W', minV = o.minV == null ? 1 : o.minV;
    const L = (spec.left || []).filter(n => fin(n.v) >= minV).map(n => Object.assign({}, n)), R = (spec.right || []).filter(n => fin(n.v) >= minV).map(n => Object.assign({}, n));
    const tot = Math.max(L.reduce((s, n) => s + n.v, 0), R.reduce((s, n) => s + n.v, 0));
    const label = o.label || 'Energieflussdiagramm';
    if (!(tot > 0)) return `<svg viewBox="0 0 ${W} 70" role="img" aria-label="${esc(label)}: im Moment fließt keine Leistung"><text class="ev-t" x="180" y="40" text-anchor="middle">Im Moment fließt keine Leistung.</text></svg>`;
    const GAP = 10, AV = o.h || 160, gaps = Math.max(L.length, R.length) - 1;
    const k = (AV - Math.max(0, gaps) * GAP) / tot;
    const hOf = n => Math.max(3, n.v * k);
    const colH = c => c.reduce((s, n) => s + hOf(n), 0) + Math.max(0, c.length - 1) * GAP;
    let H = Math.max(colH(L), colH(R), 27 * Math.max(L.length, R.length) + 4) + 20;
    const XL = 98, XR = 250, BW = 12;
    const place = (c, x) => { let y = 10 + (H - 20 - colH(c)) / 2; c.forEach(n => { n.x = x; n.y = y; n.h = hOf(n); n.oy = 0; y += n.h + GAP; }); };
    place(L, XL); place(R, XR);
    const byId = (c, id) => c.find(n => n.id === id);
    let s = '', lab = '';
    (spec.links || []).forEach(l => {
      const a = byId(L, l.a), b = byId(R, l.b), v = fin(l.v); if (!a || !b || v < minV) return;
      const h = Math.max(1.5, v * k), y0 = a.y + a.oy, y1 = b.y + b.oy; a.oy += h; b.oy += h;
      const x0 = XL + BW, x1 = XR, xm = (x0 + x1) / 2;
      s += `<path class="ev-lk" d="M${p1(x0)} ${p1(y0)}C${p1(xm)} ${p1(y0)} ${p1(xm)} ${p1(y1)} ${p1(x1)} ${p1(y1)}L${p1(x1)} ${p1(y1 + h)}C${p1(xm)} ${p1(y1 + h)} ${p1(xm)} ${p1(y0 + h)} ${p1(x0)} ${p1(y0 + h)}Z" fill="${l.col || a.col}"><title>${esc(a.label)} nach ${esc(b.label)}: ${de(v)} ${unit}</title></path>`;
    });
    /* Beschriftungen: Mindestabstand 27 px, damit kleine Bänder lesbar bleiben */
    const spread = c => { let last = -1e9; c.forEach(n => { n.ly = Math.max(n.y + n.h / 2, last + 27); last = n.ly; }); };
    spread(L); spread(R);
    H = Math.max(H, Math.max(...L.map(n => n.ly), ...R.map(n => n.ly)) + 22);
    const node = (n, left) => {
      s += `<rect class="ev-nd" x="${n.x}" y="${p1(n.y)}" width="${BW}" height="${p1(n.h)}" rx="2" fill="${n.col}"/>`;
      const cy = n.ly, tx = left ? n.x - 6 : n.x + BW + 6, an = left ? 'end' : 'start';
      lab += `<text class="ev-t" x="${tx}" y="${p1(cy - 1)}" text-anchor="${an}">${esc(n.label)}</text><text class="ev-v" x="${tx}" y="${p1(cy + 12)}" text-anchor="${an}">${de(n.v)} ${unit}</text>`;
    };
    L.forEach(n => node(n, true)); R.forEach(n => node(n, false));
    const txt = L.map(n => n.label + ' ' + de(n.v) + ' ' + unit).join(', ') + ' fließen zu ' + R.map(n => n.label + ' ' + de(n.v) + ' ' + unit).join(', ');
    return `<svg viewBox="0 0 ${W} ${p1(H)}" role="img" aria-label="${esc(label)}: ${esc(txt)}">${s}${lab}</svg>`;
  }

  /* Netz-Prüfstand: m = readMeters() mit pDc, pAc, pHaus, pNetz (Einspeisung positiv), pSp (Laden positiv) */
  function netzSpec(m) {
    m = m || {};
    const pDc = pos(m.pDc), pAc = Math.min(pos(m.pAc), pDc || pos(m.pAc)), verl = Math.max(0, pDc - pAc), haus = pos(m.pHaus);
    const chg = pos(m.pSp), dis = pos(-fin(m.pSp)), einsp = pos(m.pNetz), bezug = pos(-fin(m.pNetz));
    let sol = pAc; const s2h = Math.min(sol, haus); sol -= s2h;
    const s2b = Math.min(chg, sol); sol -= s2b; const s2n = Math.min(einsp, sol);
    let rem = Math.max(0, haus - s2h); const b2h = Math.min(dis, rem); rem -= b2h; const n2h = Math.min(bezug, rem);
    const n2b = Math.max(0, Math.min(bezug - n2h, chg - s2b));
    return {
      unit: 'W',
      left: [{ id: 'sol', label: 'Solar (DC)', v: pDc, col: 'var(--warn)' }, { id: 'net', label: 'Netzbezug', v: bezug, col: 'var(--accent)' }, { id: 'bat', label: 'Speicher entlädt', v: dis, col: 'var(--ok)' }],
      right: [{ id: 'haus', label: 'Haus', v: s2h + b2h + n2h, col: 'var(--fg)' }, { id: 'ein', label: 'Einspeisung', v: s2n, col: 'var(--accent)' }, { id: 'lad', label: 'Speicher lädt', v: s2b + n2b, col: 'var(--ok)' }, { id: 'ver', label: 'Verlust im WR', v: verl, col: 'var(--danger)' }],
      links: [{ a: 'sol', b: 'haus', v: s2h }, { a: 'sol', b: 'lad', v: s2b }, { a: 'sol', b: 'ein', v: s2n }, { a: 'sol', b: 'ver', v: verl },
        { a: 'bat', b: 'haus', v: b2h }, { a: 'net', b: 'haus', v: n2h }, { a: 'net', b: 'lad', v: n2b }]
    };
  }
  /* Inselanlage: pPv (genutzt), pLoad, pBat (laden positiv) */
  function inselSpec(m) {
    m = m || {};
    const pv = pos(m.pPv), load = pos(m.pLoad), chg = pos(m.pBat), dis = pos(-fin(m.pBat));
    const s2l = Math.min(pv, load), s2b = Math.min(chg, Math.max(0, pv - s2l)), b2l = Math.min(dis, Math.max(0, load - s2l)), verl = Math.max(0, pv - s2l - s2b);
    return {
      unit: 'W',
      left: [{ id: 'sol', label: 'Solar', v: pv, col: 'var(--warn)' }, { id: 'bat', label: 'Akku entlädt', v: dis, col: 'var(--ok)' }],
      right: [{ id: 'last', label: 'Last', v: s2l + b2l, col: 'var(--fg)' }, { id: 'lad', label: 'Akku lädt', v: s2b, col: 'var(--ok)' }, { id: 'ver', label: 'Verluste', v: verl, col: 'var(--danger)' }],
      links: [{ a: 'sol', b: 'last', v: s2l }, { a: 'sol', b: 'lad', v: s2b }, { a: 'sol', b: 'ver', v: verl }, { a: 'bat', b: 'last', v: b2l }]
    };
  }
  const SANKEY_KEYS = {
    netz: { spec: netzSpec, title: 'Energiefluss im Haus (Leistung in W)', note: 'Bandbreite = Leistung. Der Wechselrichter-Verlust ist die Differenz zwischen Gleich- und Wechselstromleistung. Zeitpunkt: jetzt, Übungswerte.' },
    insel: { spec: inselSpec, title: 'Energiefluss der Inselanlage (Leistung in W)', note: 'Bandbreite = Leistung. Der Akku lädt aus dem Überschuss und liefert bei zu wenig Sonne. Zeitpunkt: jetzt, Übungswerte.' }
  };

  /* ---------- Aderquerschnitt ---------- */
  const NORM = [0.75, 1.5, 2.5, 4, 6, 10, 16, 25, 35];
  /* Kreisfläche proportional zu mm²: r = K * sqrt(A / PI) */
  function querschnittSvg(a) {
    const A = fin(a), W = 360, K = 8.5;
    if (!(A > 0)) return `<svg viewBox="0 0 ${W} 40" role="img" aria-label="Querschnitt"><text class="ev-t" x="180" y="24" text-anchor="middle">Kein Querschnitt.</text></svg>`;
    const r = K * Math.sqrt(A / Math.PI), cx = 62, ro = r + 7, H = Math.max(124, ro * 2 + 36), cy = H / 2 - 8;
    let s = `<rect class="ev-bg" width="${W}" height="${p1(H)}" rx="8"/>`;
    s += `<circle cx="${cx}" cy="${p1(cy)}" r="${p1(ro)}" class="ev-iso"/><circle cx="${cx}" cy="${p1(cy)}" r="${p1(r)}" class="ev-cu on"/>`;
    s += `<text class="ev-t" x="${cx}" y="${p1(cy + ro + 15)}" text-anchor="middle">${de(A, A % 1 ? 1 : 0)} mm²</text>`;
    let x = 128; const by = 78;
    NORM.slice(0, 8).forEach(q => {
      const rq = K * Math.sqrt(q / Math.PI), on = Math.abs(q - A) < 1e-9;
      s += `<circle cx="${p1(x + rq)}" cy="${by}" r="${p1(rq)}" class="ev-cu${on ? ' on' : ''}"${on ? '' : ' fill-opacity=".55"'}/>`;
      s += `<text class="ev-s${on ? ' on' : ''}" x="${p1(x + rq)}" y="${by + 36}" text-anchor="middle">${de(q, q === 0.75 ? 2 : q % 1 ? 1 : 0)}</text>`;
      x += rq * 2 + 4;
    });
    s += `<text class="ev-s" x="128" y="24">Normquerschnitte im Größenvergleich (mm²)</text>`;
    return `<svg viewBox="0 0 ${W} ${p1(H)}" role="img" aria-label="Kupferquerschnitt ${de(A, 1)} Quadratmillimeter im Größenvergleich mit den Normquerschnitten">${s}</svg>`;
  }

  /* ---------- DOM-Anbindung ---------- */
  const CSS = `
.ev-t{fill:var(--fg);font:600 11.5px system-ui,sans-serif}.ev-v{fill:var(--mute);font:11.5px system-ui,sans-serif}.ev-s{fill:var(--mute);font:11px system-ui,sans-serif}.ev-s.on{fill:var(--fg);font-weight:700}
.ev-lk{fill-opacity:.42;stroke:none}.ev-nd{stroke:var(--line);stroke-width:.6}.ev-bg{fill:var(--panel2)}
.ev-iso{fill:var(--line)}.ev-cu{fill:#c9763a;stroke:var(--line);stroke-width:.8}.ev-cu.on{stroke:var(--fg);stroke-width:1.6}
.ev-fig{background:var(--panel2);border:1px solid var(--line);border-radius:12px;overflow:hidden;margin:6px 0;padding:4px 0}.ev-fig svg{display:block;width:100%;max-width:560px;height:auto;margin:0 auto}
.ev-note{font-size:13px;color:var(--mute);line-height:1.45;margin:6px 2px 0}.ev-card{margin:8px 0}.ev-cb{padding:2px 10px 10px}
.ev-qs{margin:8px 0 2px}
`;
  function injectCss() { if (document.getElementById('enrviz-css')) return; const st = document.createElement('style'); st.id = 'enrviz-css'; st.textContent = CSS; document.head.appendChild(st); }
  const UI = () => root.ENR_UI;
  let sig = '';
  function sankeyTick() {
    const U = UI(), host = document.getElementById('diagHost'); if (!U || !U.S || !host) return;
    const S = U.S, cfg = SANKEY_KEYS[S.rigId]; let card = document.getElementById('evSankey');
    if (!cfg || S.task || S.tab !== 'rig' || !S.rig) { if (card) card.hidden = true; return; }
    let m = null; try { m = S.rig.readMeters(); } catch (e) { m = null; } if (!m) return;
    injectCss();
    if (!card) { card = document.createElement('details'); card.className = 'card ev-card'; card.id = 'evSankey'; card.open = true; card.innerHTML = '<summary>Energiefluss (Sankey)</summary><div class="ev-cb"><div class="ev-fig" data-evf></div><p class="ev-note" data-evn></p></div>'; host.parentNode.insertBefore(card, host); }
    card.hidden = false;
    const sp = cfg.spec(m), key = S.rigId + JSON.stringify(sp.links.map(l => Math.round(l.v))) + JSON.stringify(sp.left.map(n => Math.round(n.v)));
    if (key === sig && card.dataset.rig === S.rigId) return; sig = key; card.dataset.rig = S.rigId;
    card.querySelector('[data-evf]').innerHTML = sankeySvg(sp, { label: cfg.title }); card.querySelector('[data-evn]').textContent = cfg.note;
  }
  function designTick() {
    const host = document.getElementById('designView'); if (!host) return;
    const big = [...host.querySelectorAll('.big2')].find(e => /mm²/.test(e.textContent)); if (!big) return;
    const mm = /([\d.,]+)\s*mm²\s*\(Normquerschnitt\)/.exec(big.textContent), res = big.parentNode;
    let box = res.querySelector('.ev-qs');
    if (!mm) { if (box) box.remove(); return; }
    const a = parseFloat(mm[1].replace(',', '.')); if (!isFinite(a)) return;
    injectCss();
    if (!box) { box = document.createElement('div'); box.className = 'ev-qs ev-fig'; big.insertAdjacentElement('afterend', box); }
    if (box.dataset.a !== String(a)) { box.dataset.a = String(a); box.innerHTML = querschnittSvg(a); }
  }
  function start() { setInterval(() => { try { sankeyTick(); designTick(); } catch (e) { /* Anzeige ist nur Zugabe */ } }, 400); }
  if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start(); }
  const api = { sankeySvg, netzSpec, inselSpec, querschnittSvg, NORM, SANKEY_KEYS, CSS, VERSION: '1.0' };
  root.ENR_VIZ = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
