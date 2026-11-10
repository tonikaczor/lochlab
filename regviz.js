'use strict';
/* Tonfunk Regelungstechnik-Lab: Visualisierungen (Lab-Kennung 'reg'), window.REG_VIZ, per Node testbar (module.exports).
   Reine SVG-/HTML-Funktionen plus eine kleine DOM-Anbindung, die ohne Änderung an regui.js auskommt (liest nur window.REG_UI.S):
   - Karte "Regelkreis live" im Reiter Prüfstand: Blockschaltbild (Vergleichsstelle, Regler, Stellglied, Strecke, Messglied) als scharfes SVG,
     das mit dem laufenden Versuch mitleuchtet: Signalpfeile und Kästen werden je nach Größe des Signals kräftiger, bei laufender Simulation
     wandern Striche in Wirkrichtung, ein Sollwertsprung blitzt kurz auf, im Handbetrieb ist der Kreis sichtbar aufgetrennt.
     Darunter eine Wertetafel (Sollwert w, Istwert x, Regeldifferenz e, Stellgröße y, Störgröße z) in großer Schrift für das Handy.
   - Farbschlüssel (Legende) unter der Werkzeugleiste jedes Messschreibers.
   Einheitlicher Farbcode im ganzen Lab (wie Messschreiber, Lernen und Wirkungsplan): w Sollwert orange gestrichelt, x Istwert blau,
   y Stellgröße grün, z Störgröße rot, e Regeldifferenz violett.
   Aufgabenintegrität: Die Karte zeigt nur, was auch die Messinstrumente zeigen (Werte, Betriebsart, Reglerart). Keine Diagnose, keine Meldungen,
   keine Kennwerte der Strecke. In Aufgaben und Trainer ändert sich nichts.
   Farben nur über CSS-Variablen. Bewegung dezent und bei prefers-reduced-motion aus. Keine Bibliotheken, keine Markennamen. */
(function (root) {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fin = v => typeof v === 'number' && isFinite(v);
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const p1 = v => String(Math.round((fin(v) ? v : 0) * 10) / 10);
  /* Zahl deutsch mit echtem Minuszeichen; leer bei ungültigem Wert */
  const num = (v, d) => (fin(v) ? (v < 0 && Math.abs(v) >= Math.pow(10, -(d || 0)) / 2 ? '−' : '') + Math.abs(v).toFixed(d == null ? 1 : d).replace('.', ',') : '–');
  const adig = v => { v = Math.abs(v); return v >= 100 ? 0 : v >= 10 ? 1 : v >= 1 ? 2 : 3; };
  const auto = v => (fin(v) && Math.abs(v) < 1e-9 ? '0' : num(v, fin(v) ? adig(v) : 1));

  /* Kurznamen je Anlage (kurz genug für die Kästen im Blockschaltbild) */
  const NAMES = {
    fuellstand: { plant: 'Tank', stell: 'Pumpe', mess: 'Drucksensor' },
    durchfluss: { plant: 'Rohrstrecke', stell: 'Regelventil', mess: 'Durchflussmesser' },
    raumtemp: { plant: 'Raum', stell: 'Heizventil', mess: 'Raumfühler' },
    thermostat: { plant: 'Bügeleisen', stell: 'Heizwendel', mess: 'Bimetall' },
    drehzahl: { plant: 'Motor', stell: 'Steller', mess: 'Tachogenerator' },
    position: { plant: 'Schlitten', stell: 'Antrieb', mess: 'Wegmessung' },
    baukasten: { plant: 'Strecke', stell: 'Stellglied', mess: 'Messglied' }
  };
  const CTRL = { P: 'P-Regler', I: 'I-Regler', PI: 'PI-Regler', PD: 'PD-Regler', PID: 'PID-Regler', '2P': 'Zweipunktregler', '3P': 'Dreipunktregler' };
  const CTRL_SHORT = { P: 'P', I: 'I', PI: 'PI', PD: 'PD', PID: 'PID', '2P': 'Zweipunkt', '3P': 'Dreipunkt' };
  const SIGNALS = [
    { k: 'w', name: 'Sollwert', cls: 'w' }, { k: 'x', name: 'Istwert', cls: 'x' }, { k: 'e', name: 'Regeldifferenz', cls: 'e' },
    { k: 'y', name: 'Stellgröße', cls: 'y' }, { k: 'z', name: 'Störgröße', cls: 'z' }
  ];

  /* ---------- Modell aus dem Zustand des Labs (REG_UI.S) ---------- */
  function modelFrom(S) {
    const m = { ok: false, w: NaN, x: NaN, e: NaN, y: NaN, z: NaN, mode: 'auto', ctrl: 'P', dir: 'direkt', kp: NaN, unit: '', eUnit: '', zUnit: '', digits: 1, plant: 'Strecke', stell: 'Stellglied', mess: 'Messglied', act: { w: 0.5, x: 0.4, e: 0, y: 0.4, z: 0.1 }, running: false };
    if (!S || !S.st || !S.rig) return m;
    const st = S.st, r = S.rig, rg = r.range || {}, nm = NAMES[S.rigId] || {};
    m.ok = true; m.w = st.w; m.x = st.x; m.e = st.e; m.y = st.y; m.z = st.z;
    m.mode = st.mode === 'hand' ? 'hand' : 'auto'; m.ctrl = typeof st.ctrl === 'string' ? st.ctrl : 'P'; m.dir = st.dir === 'invers' ? 'invers' : 'direkt'; m.kp = st.kp;
    m.unit = typeof rg.unit === 'string' ? rg.unit : ''; m.eUnit = m.unit === '°C' ? 'K' : m.unit; m.digits = fin(rg.digits) ? clamp(rg.digits, 0, 3) : 1;
    m.plant = nm.plant || 'Strecke'; m.stell = nm.stell || 'Stellglied'; m.mess = nm.mess || 'Messglied';
    const zc = (r.controls || []).find(c => c && c.key === 'z'); m.zUnit = zc && typeof zc.unit === 'string' ? zc.unit : '';
    const zoff = zc && fin(+zc.value) ? +zc.value : 0, span = fin(rg.hi - rg.lo) && rg.hi > rg.lo ? rg.hi - rg.lo : 100;
    const zspan = zc && fin(zc.max - zc.min) && zc.max > zc.min ? zc.max - zc.min : 100;
    m.act = {
      w: 0.55,
      x: clamp(fin(m.x) ? (m.x - (rg.lo || 0)) / span : 0, 0, 1),
      e: clamp(fin(m.e) ? Math.abs(m.e) / (0.25 * span) : 0, 0, 1),
      y: clamp(fin(m.y) ? Math.abs(m.y) / 100 : 0, 0, 1),
      z: fin(m.z) && Math.abs(m.z - zoff) > 1e-9 ? clamp(0.45 + 0.55 * Math.abs(m.z - zoff) / (0.5 * zspan), 0.45, 1) : 0.12
    };
    m.running = !!S.running;
    return m;
  }

  /* ---------- Blockschaltbild ---------- */
  const SIGC = { w: 'var(--rv-w)', x: 'var(--rv-x)', y: 'var(--rv-y)', z: 'var(--rv-z)', e: 'var(--rv-e)' };
  const head = (x, y, d, col, op) => {
    const L = 7, B = 3.6, pts = d === 'r' ? [[x, y], [x - L, y - B], [x - L, y + B]] : d === 'l' ? [[x, y], [x + L, y - B], [x + L, y + B]] : d === 'u' ? [[x, y], [x - B, y + L], [x + B, y + L]] : [[x, y], [x - B, y - L], [x + B, y - L]];
    return `<polygon points="${pts.map(q => p1(q[0]) + ',' + p1(q[1])).join(' ')}" fill="${col}" opacity="${p1(op)}"/>`;
  };
  /* Linie mit Pfeilspitze: pts als Folge [x,y]; Spitze am letzten Punkt in Richtung des letzten Stücks */
  function wire(pts, key, act, o) {
    o = o || {}; const col = SIGC[key] || 'var(--mute)', a = clamp(fin(act) ? act : 0, 0, 1), off = !!o.off;
    const op = off ? 0.3 : 0.42 + 0.58 * a, wd = off ? 1.8 : 1.8 + 2.6 * a;
    const n = pts.length, [x1, y1] = pts[n - 1], [x0, y0] = pts[n - 2];
    const d = Math.abs(x1 - x0) >= Math.abs(y1 - y0) ? (x1 >= x0 ? 'r' : 'l') : (y1 >= y0 ? 'd' : 'u');
    const k = d === 'r' ? [x1 - 6, y1] : d === 'l' ? [x1 + 6, y1] : d === 'u' ? [x1, y1 + 6] : [x1, y1 - 6];
    const body = pts.slice(0, n - 1).concat([k]);
    const live = !off && a >= 0.14 && o.running;
    return `<path class="rv-ln${live ? ' live' : ''}${o.flash ? ' flash' : ''}${off ? ' off' : ''}" d="M${body.map(q => p1(q[0]) + ' ' + p1(q[1])).join('L')}" style="stroke:${col};stroke-width:${p1(wd)};opacity:${p1(op)}"${off ? ' stroke-dasharray="4 4"' : ''}/>` + head(x1, y1, d, col, off ? 0.3 : op);
  }
  const box = (x, y, w, h, title, sub, col, a, o) => {
    o = o || {}; const op = o.dim ? 0.35 : 0.3 + 0.7 * clamp(fin(a) ? a : 0, 0, 1), cx = x + w / 2;
    return `<g class="rv-bx${o.dim ? ' dim' : ''}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" class="rv-bg"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" class="rv-fr" style="stroke:${col};stroke-width:${p1(1.4 + 1.8 * (o.dim ? 0 : clamp(fin(a) ? a : 0, 0, 1)))};opacity:${p1(op)}"${o.dash ? ' stroke-dasharray="5 4"' : ''}/>`
      + `<text class="rv-t" x="${p1(cx)}" y="${p1(y + h / 2 - (sub ? 3 : -4))}" text-anchor="middle">${esc(title)}</text>${sub ? `<text class="rv-s" x="${p1(cx)}" y="${p1(y + h / 2 + 12)}" text-anchor="middle">${esc(sub)}</text>` : ''}</g>`;
  };
  function diagramSvg(m, o) {
    m = m || {}; o = o || {}; const act = m.act || {}, hand = m.mode === 'hand', run = !!m.running && o.motion !== false;
    const dirInv = m.dir === 'invers';
    const Y1 = 70, Y2 = 172, SX = 60;                                   /* Hauptzeile, Rückführung, Mitte der Vergleichsstelle */
    let s = '';
    /* Signalwege zuerst, die Kästen decken die Enden */
    s += wire([[8, Y1], [SX - 13, Y1]], 'w', act.w, { running: run, flash: !!o.flashW });
    s += wire([[SX + 13, Y1], [96, Y1]], 'e', act.e, { running: run, off: hand });
    s += wire([[162, Y1], [182, Y1]], 'y', act.y, { running: run });
    s += wire([[248, Y1], [268, Y1]], 'y', act.y, { running: run });
    s += wire([[301, 16], [301, 48]], 'z', act.z, { running: run });
    s += wire([[334, Y1], [356, Y1]], 'x', act.x, { running: run });
    s += wire([[346, Y1], [346, Y2], [262, Y2]], 'x', act.x, { running: run, off: hand });
    s += wire([[126, Y2], [SX, Y2], [SX, Y1 + 13]], 'x', act.x, { running: run, off: hand });
    s += `<circle cx="346" cy="${Y1}" r="2.6" fill="${SIGC.x}" opacity="${hand ? 0.3 : 0.9}"/>`;
    /* Vergleichsstelle */
    const ea = hand ? 0.1 : act.e;
    s += `<circle cx="${SX}" cy="${Y1}" r="13" class="rv-bg"/><circle cx="${SX}" cy="${Y1}" r="13" class="rv-fr" style="stroke:${SIGC.e};stroke-width:${p1(1.4 + 1.8 * clamp(fin(ea) ? ea : 0, 0, 1))};opacity:${p1(0.35 + 0.65 * clamp(fin(ea) ? ea : 0, 0, 1))}"/>`
      + `<path d="M${SX - 5.5} ${Y1 - 5.5}L${SX + 5.5} ${Y1 + 5.5}M${SX - 5.5} ${Y1 + 5.5}L${SX + 5.5} ${Y1 - 5.5}" class="rv-x"/>`;
    s += `<text class="rv-sg" x="${SX - 21}" y="${Y1 - 8}" text-anchor="middle">${dirInv ? '−' : '+'}</text><text class="rv-sg" x="${SX + 10}" y="${Y1 + 28}" text-anchor="middle">${dirInv ? '+' : '−'}</text>`;
    /* Kästen */
    const cn = CTRL_SHORT[m.ctrl] || '';
    s += box(96, 48, 66, 44, 'Regler', hand ? 'Hand' : cn, SIGC.y, hand ? 0 : act.y, { dim: hand, dash: hand });
    s += box(182, 48, 66, 44, 'Stellglied', m.stell || '', SIGC.y, act.y);
    s += box(268, 48, 66, 44, 'Strecke', m.plant || '', SIGC.x, act.x);
    s += box(126, Y2 - 22, 136, 44, 'Messglied', m.mess || '', SIGC.x, hand ? 0.1 : act.x, { dim: false });
    /* Signalnamen, farbig, über den Pfeilen */
    const lab = (t, x, y, key, anchor) => `<text class="rv-lb ${key}" x="${p1(x)}" y="${p1(y)}" text-anchor="${anchor || 'middle'}">${esc(t)}</text>`;
    s += lab('w', 26, Y1 - 10, 'w') + lab('e', 79, Y1 - 10, 'e') + lab('y', 172, Y1 - 10, 'y') + lab('y', 258, Y1 - 10, 'y');
    s += lab('z', 312, 34, 'z', 'start') + lab('x', 346, Y1 - 10, 'x') + lab('xm', 86, Y2 - 8, 'x');
    s += lab('Störgröße', 301, 11, 'z');
    return `<svg class="rv-svg" viewBox="0 0 362 206" role="img" aria-label="Regelkreis als Blockschaltbild: Sollwert w und Rückführung xm an der Vergleichsstelle, Regeldifferenz e zum Regler, Stellgröße y über das Stellglied zur Strecke, Störgröße z greift an der Strecke an, Istwert x wird gemessen und zurückgeführt${hand ? '. Handbetrieb: der Kreis ist aufgetrennt' : ''}">${s}</svg>`;
  }

  /* ---------- Wertetafel ---------- */
  function readoutHtml(m) {
    m = m || {}; const d = fin(m.digits) ? m.digits : 1, u = m.unit || '';
    const val = {
      w: num(m.w, d) + (u && fin(m.w) ? ' ' + u : ''), x: num(m.x, d) + (u && fin(m.x) ? ' ' + u : ''),
      e: num(m.e, d) + (m.eUnit && fin(m.e) ? ' ' + m.eUnit : ''), y: num(m.y, 1) + (fin(m.y) ? ' %' : ''),
      z: auto(m.z) + (m.zUnit && fin(m.z) ? ' ' + m.zUnit : '')
    };
    return SIGNALS.map(g => `<div class="rv-c ${g.cls}"><span class="rv-sym">${g.k}</span><span class="rv-nm">${esc(g.name)}</span><b>${esc(val[g.k])}</b></div>`).join('');
  }
  function noteText(m) {
    m = m || {};
    if (m.mode === 'hand') return 'Handbetrieb: Der Regelkreis ist aufgetrennt (gestrichelt). Die Stellgröße y bestimmst du selbst, der Regler folgt nur mit.';
    return 'Geschlossener Regelkreis: x wird gemessen, mit w verglichen, der Regler bildet aus e die Stellgröße y. Je kräftiger ein Pfeil, desto größer das Signal.';
  }
  function legendHtml() {
    return '<span class="rv-k w"><i></i>Sollwert w</span><span class="rv-k x"><i></i>Istwert x</span><span class="rv-k y"><i></i>Stellgröße y</span><span class="rv-k z"><i></i>Störung z</span>';
  }
  function cardHtml(m, o) {
    return `<div class="rv-fig">${diagramSvg(m, o)}</div><div class="rv-tab">${readoutHtml(m)}</div><p class="rv-note">${esc(noteText(m))}</p>`;
  }

  /* ---------- DOM-Anbindung ---------- */
  const CSS = `
:root{--rv-w:#ffb340;--rv-x:#3b9eff;--rv-y:#4cd964;--rv-z:#ff5c5c;--rv-e:#c792ea}
@media(prefers-color-scheme:light){:root:not([data-theme=dark]){--rv-w:#b86e00;--rv-x:#0a6fd6;--rv-y:#1f8a36;--rv-z:#d0312d;--rv-e:#8e44ad}}
:root[data-theme=light]{--rv-w:#b86e00;--rv-x:#0a6fd6;--rv-y:#1f8a36;--rv-z:#d0312d;--rv-e:#8e44ad}
.rv-card>summary{min-height:44px}.rv-card .cb{padding:0 10px 10px}
.rv-fig{background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:4px 2px;margin:0 0 8px}
.rv-svg{display:block;width:100%;max-width:560px;height:auto;margin:0 auto}
.rv-ln{fill:none;stroke-linecap:round;stroke-linejoin:round;transition:opacity .25s,stroke-width .25s}
.rv-ln.live{stroke-dasharray:8 5;animation:rv-flow 1.1s linear infinite}
.rv-ln.flash{filter:drop-shadow(0 0 3px var(--rv-w));animation:rv-pulse .9s ease-out 1}
@keyframes rv-flow{to{stroke-dashoffset:-13}}@keyframes rv-pulse{from{stroke-width:7}}
@media(prefers-reduced-motion:reduce){.rv-ln.live{animation:none;stroke-dasharray:none}.rv-ln.flash{animation:none}.rv-ln{transition:none}}
.rv-bg{fill:var(--panel2)}.rv-fr{fill:none}.rv-x{stroke:var(--mute);stroke-width:1.6;fill:none}
.rv-t{fill:var(--fg);font:700 12.5px system-ui,sans-serif}.rv-s{fill:var(--mute);font:600 11px system-ui,sans-serif}
.rv-bx.dim .rv-t{fill:var(--mute)}.rv-sg{fill:var(--fg);font:700 13px system-ui,sans-serif}
.rv-lb{font:800 13px system-ui,sans-serif}.rv-lb.w{fill:var(--rv-w)}.rv-lb.x{fill:var(--rv-x)}.rv-lb.y{fill:var(--rv-y)}.rv-lb.z{fill:var(--rv-z)}.rv-lb.e{fill:var(--rv-e)}
.rv-tab{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:6px}
.rv-c{display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto auto;column-gap:8px;align-items:center;min-height:46px;padding:5px 10px;border-radius:10px;background:var(--panel2);border-left:5px solid var(--mute)}
.rv-c.w{border-left-color:var(--rv-w)}.rv-c.x{border-left-color:var(--rv-x)}.rv-c.e{border-left-color:var(--rv-e)}.rv-c.y{border-left-color:var(--rv-y)}.rv-c.z{border-left-color:var(--rv-z)}
.rv-c .rv-sym{grid-row:1/3;font:800 20px system-ui,sans-serif;width:20px;text-align:center}
.rv-c.w .rv-sym{color:var(--rv-w)}.rv-c.x .rv-sym{color:var(--rv-x)}.rv-c.e .rv-sym{color:var(--rv-e)}.rv-c.y .rv-sym{color:var(--rv-y)}.rv-c.z .rv-sym{color:var(--rv-z)}
.rv-c .rv-nm{font-size:12px;color:var(--mute);line-height:1.1}.rv-c b{font:700 15px system-ui,sans-serif;font-variant-numeric:tabular-nums;line-height:1.2}
.rv-note{font-size:13px;line-height:1.45;color:var(--mute);margin:8px 2px 0}
.scope .rv-leg{grid-column:1/-1}
.rv-leg{display:flex;flex-wrap:wrap;gap:4px 14px;padding:2px 6px 6px;font-size:12.5px;color:var(--mute)}
.rv-k{display:inline-flex;align-items:center;gap:6px;min-height:22px}.rv-k i{display:inline-block;width:20px;height:0;border-top:3px solid}
.rv-k.w i{border-color:var(--rv-w);border-top-style:dashed}.rv-k.x i{border-color:var(--rv-x)}.rv-k.y i{border-color:var(--rv-y)}.rv-k.z i{border-color:var(--rv-z);border-top-width:5px;opacity:.8}
`;
  const KEY = 'lm4.reg.vzKreis';
  function lsGet() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function lsSet(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  function start() {
    const doc = document; if (doc.getElementById('regviz-css')) return;
    const st = doc.createElement('style'); st.id = 'regviz-css'; st.textContent = CSS; doc.head.appendChild(st);
    const host = doc.getElementById('rigMain'); if (!host) return;
    /* Karte unter dem Messschreiber; auf dem Handy zunächst zugeklappt, damit die Bedienelemente nicht nach unten rutschen */
    const sv = lsGet(), open = sv === '1' || (sv == null && (root.innerWidth || 1000) >= 700);
    const card = doc.createElement('details'); card.className = 'card rv-card'; card.id = 'rvKreis'; if (open) card.open = true;
    card.innerHTML = '<summary>Regelkreis live</summary><div class="cb"></div>';
    host.appendChild(card);
    const cb = card.querySelector('.cb'); let last = '', wPrev = NaN, flashUntil = 0;
    card.addEventListener('toggle', () => { lsSet(card.open ? '1' : '0'); last = ''; tick(); });
    function tick() {
      try {
        const U = root.REG_UI; if (!U || !U.S || !card.open || doc.hidden || U.S.tab !== 'rig' || card.offsetParent === null) return;
        const m = modelFrom(U.S), now = Date.now();
        if (fin(m.w) && fin(wPrev) && Math.abs(m.w - wPrev) > 1e-9 * (1 + Math.abs(wPrev))) flashUntil = now + 1400; wPrev = m.w;
        const flash = now < flashUntil;
        const sig = [m.ok, m.mode, m.ctrl, m.dir, m.running, flash, m.plant, num(m.w, 2), num(m.x, 2), num(m.e, 2), num(m.y, 1), num(m.z, 2), p1(m.act.x * 10), p1(m.act.e * 10), p1(m.act.y * 10), m.unit].join('|');
        if (sig !== last) { last = sig; cb.innerHTML = cardHtml(m, { flashW: flash }); }
      } catch (e) { /* Anzeige darf den Prüfstand nie stören */ }
    }
    setInterval(tick, 180); tick();
    /* Farbschlüssel in jedem Messschreiber */
    const addLeg = () => doc.querySelectorAll('.scope').forEach(b => { if (b.querySelector('.rv-leg')) return; const bar = b.querySelector('.scbar'); if (!bar) return; const d = doc.createElement('div'); d.className = 'rv-leg'; d.innerHTML = legendHtml(); bar.insertAdjacentElement('afterend', d); });
    addLeg();
    if (typeof MutationObserver !== 'undefined') new MutationObserver(addLeg).observe(doc.getElementById('app') || doc.body, { childList: true, subtree: true });
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  }
  const API = { modelFrom, diagramSvg, readoutHtml, noteText, legendHtml, cardHtml, NAMES, CTRL, SIGNALS, num };
  root.REG_VIZ = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
