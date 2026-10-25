'use strict';
/* Tonfunk Netzteil-Lab (NTS-Lab): Tab "Lernen" (WP3d, SPEC 6.4).
   Neunzehn ausklappbare Abschnitte mit SVG-Zeichnungen und "Probier es aus"-Knöpfen (lädt ein Beispiel ntx<n> oder die Voreinstellung des Prüfstands).
   Tabellen und Zahlen kommen AUS DEM KERN und den Tabellen der Oberfläche (SPEC Regel 1, 5, 7): Formelsammlung aus NTS_CORE.formulas, Glossar aus NTS_CORE.glossary,
   Tastenkürzel aus api.KEYS (sonst window.NTS_KEYS), Stufen (Farbe, Name, Buchstabe) aus NTS_RIGS.base.STUFEN, Grenzwerte NUR aus NTS_CORE.limits (Wert und Status),
   Beispielrechnungen über formulas[].run und die Kernfunktionen trafo, rect, zener, lin, buck, boost, bb, fly, topology, loss, gate, loop, lab, fault; Leistungsbilanz aus rig.bilanz().
   Es gibt keine zweite Formelimplementierung: fehlt eine Kernfunktion, steht ein Strich statt einer Zahl.
   Übungswerte (Status A) erscheinen immer mit "Übungswert (A), F<n>", belegte mit "✓ belegt"; Beispielrechnungen tragen "Pool <Id>" oder "Übungsschaltung (A)".
   Sicherheit (SPEC 9): keine Mess- oder Aufbauanleitung für Netzspannung; die Abschnitte 8, 10 und 15 tragen den Satz aus TEXTS.lernenHinweis; alle Messpunkte sind simuliert.
   Schnittstelle (VERTRAG 6.4): window.NTS_UI_EXT.help = { render(host, api), fn }. Die reinen Funktionen (ohne DOM) hängen unter NTS_UI_EXT.help.fn und werden von test_ntsui_help.js geprüft. */
(function (root) {
  const X = root.NTS_UI_EXT = root.NTS_UI_EXT || {};
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  /* Ereignisbehandler am Host nur einmal anhängen (der Host bleibt bei jedem render derselbe, sein Inhalt wird neu gesetzt) */
  const once = (host, name, ty, fn) => { host.__ntsl = host.__ntsl || {}; if (host.__ntsl[name + ty]) return; host.__ntsl[name + ty] = 1; host.addEventListener(ty, fn); };
  const fin = v => typeof v === 'number' && isFinite(v);
  const CORE = () => root.NTS_CORE;
  const RIGS = () => root.NTS_RIGS;
  const DASH = '–';
  /* Zahlenformat wie im Rechner: Dezimalkomma, Einheit mit Vorsatz */
  function fe(x, unit) {
    const C = CORE(); if (!fin(x)) return DASH;
    /* Werte von 0,1 bis unter 1 in V, A, Ω und W ohne Vorsatz ("0,4 Ω", "0,5 A", "0,273 W" wie im Pool), sonst Vorsatz wie im Rechner */
    if ((unit === 'V' || unit === 'A' || unit === 'Ω' || unit === 'W') && Math.abs(x) >= 0.1 && Math.abs(x) < 1) return String(+x.toPrecision(3)).replace('.', ',') + ' ' + unit;
    if (C && typeof C.fmtEng === 'function') { try { const t = C.fmtEng(x, unit || ''); if (typeof t === 'string' && t) return t; } catch (e) { /* Rückfall unten */ } }
    return String(+x.toPrecision(3)).replace('.', ',') + (unit ? ' ' + unit : '');
  }
  function ff(x, d) {
    const C = CORE(); if (!fin(x)) return DASH;
    if (C && typeof C.fmt === 'function') { try { const t = C.fmt(x, d == null ? 1 : d); if (typeof t === 'string' && t) return t; } catch (e) { /* Rückfall unten */ } }
    return (+x).toFixed(d == null ? 1 : d).replace('.', ',');
  }
  const fz = v => (fin(v) ? String(+v.toPrecision(5)).replace('.', ',') : DASH);
  const pc = (x, d) => (fin(x) ? ff(x * 100, d == null ? 1 : d) + ' %' : DASH);
  /* Funktionsaufruf im Kern über Pfad ("rect.fp"); null bei fehlender Funktion, Ausnahme oder Fehlerergebnis ohne Nutzen */
  const call = (path, ...args) => { const C = CORE(); let o = C, ctx = null; for (const k of path.split('.')) { ctx = o; o = o && o[k]; } if (typeof o !== 'function') return null; try { return o.apply(ctx, args); } catch (e) { return null; } };
  const okr = r => (r && r.ok !== false ? r : null);
  /* Formeln des Kerns: Tabelle formulas (Feld run rechnet in SI) */
  const FM = id => { const C = CORE(), l = C && Array.isArray(C.formulas) ? C.formulas : null; return l ? l.find(f => f && f.id === id) || null : null; };
  const FR = (id, ...a) => { const f = FM(id); if (!f || typeof f.run !== 'function') return NaN; try { const r = f.run.apply(null, a); return r && r.ok !== false && fin(r.value) ? r.value : NaN; } catch (e) { return NaN; } };
  const LV = id => { const C = CORE(); if (!C || typeof C.limitValue !== 'function') return NaN; try { const v = C.limitValue(id); return fin(v) ? v : NaN; } catch (e) { return NaN; } };
  const TX = k => { const C = CORE(), t = C && C.TEXTS && C.TEXTS[k]; return typeof t === 'string' ? t : ''; };
  const PFLICHT = () => TX('lernenHinweis') || 'Dieses Lab ersetzt keine Unterweisung. Arbeiten an Netzspannung nur durch Elektrofachkraft oder unterwiesene Person.';
  const ULAB = ' (Übungsschaltung (A))';
  const pool = id => ' (Pool ' + id + ')';

  /* ============================================================ Grenzwerte nur aus NTS_CORE.limits: Wert und Status getrennt, LT = beides */
  const SI = { V: 1, A: 1, 'Ω': 1, W: 1, Hz: 1, s: 1, F: 1, C: 1, H: 1 };
  function limOf(id) { const C = CORE(), l = C && Array.isArray(C.limits) ? C.limits : []; return l.find(x => x && x.id === id) || null; }
  function limVal(l) {
    if (!l || !fin(l.value)) return DASH; const u = l.unit || '', s = SI[u] ? fe(l.value, u) : fz(l.value) + (u ? ' ' + u : '');
    return (l.cmp === '<=' ? '≤ ' : l.cmp === '>=' ? '≥ ' : '') + s;
  }
  const limStat = l => (l ? (l.status === 'belegt' ? '✓ belegt' : 'Übungswert (A)' + (l.frage ? ', ' + l.frage : '')) : DASH);
  const LT = id => { const l = limOf(id); return l ? limVal(l) + ' (' + limStat(l) + ')' : DASH; };
  /* Kurzform in Aufzählungen von Übungswerten: Wert und Frage-Nummer */
  const LF = id => { const l = limOf(id); return l ? limVal(l) + (l.status === 'belegt' ? ' (✓ belegt)' : ' (' + (l.frage || 'A') + ')') : DASH; };

  /* ============================================================ Stufen (Farbe, Name, Buchstabe) aus der einen Tabelle des Prüfstands */
  const STUF_ORDER = ['trafo', 'gleich', 'sieb', 'regel', 'schalt', 'last'];
  const STUF_FALL = { trafo: { name: 'Transformator', sym: 'T', color: '#fbbf24' }, gleich: { name: 'Gleichrichtung', sym: 'G', color: '#2dd4bf' }, sieb: { name: 'Glättung', sym: 'C', color: '#38bdf8' }, regel: { name: 'Regelung', sym: 'R', color: '#c084fc' }, schalt: { name: 'Schalten', sym: 'S', color: '#f472b6' }, last: { name: 'Last', sym: 'L', color: '#a3e635' } };
  const STUF_TXT = { trafo: 'setzt die Netzspannung auf eine kleine Wechselspannung herab', gleich: 'macht aus Wechselspannung pulsierende Gleichspannung', sieb: 'der Ladekondensator glättet die pulsierende Gleichspannung', regel: 'Stabilisierung: hält die Ausgangsspannung konstant', schalt: 'Schalter, Drossel und Diode des Schaltreglers', last: 'der Verbraucher am Ausgang' };
  function stufen(api) {
    const R = RIGS(), S = (R && R.base && R.base.STUFEN) || {}, out = {};
    STUF_ORDER.forEach(k => {
      const s = S[k] || STUF_FALL[k]; let col = s.color || STUF_FALL[k].color;
      if (api && typeof api.stufeColor === 'function') { try { const c = api.stufeColor(k); if (typeof c === 'string' && c) col = c; } catch (e) { /* Standardfarbe */ } }
      out[k] = { key: k, name: s.name || STUF_FALL[k].name, sym: s.sym || STUF_FALL[k].sym, color: col, text: STUF_TXT[k] };
    });
    return out;
  }
  /* Leistungsbilanz aus dem Prüfstand (einzige Quelle, SPEC 5.0); null, wenn der Prüfstand fehlt */
  function rigBilanz(id, preset) {
    const R = RIGS(); if (!R || typeof R.create !== 'function') return null;
    try { const r = R.create(id); if (!r) return null; if (preset && typeof r.applyPreset === 'function') r.applyPreset(preset); const b = r.bilanz(); return b && fin(b.pzu) ? b : null; } catch (e) { return null; }
  }
  function presetControls(rig, preset) {
    const R = RIGS(), l = R && Array.isArray(R.list) ? R.list.find(r => r && r.id === rig) : null, p = l && Array.isArray(l.presets) ? l.presets.find(x => x && x.id === preset) : null;
    return p && p.params && typeof p.params === 'object' ? Object.assign({}, p.params) : null;
  }

  /* ============================================================ Beispielrechnungen: Argumente und Formelausdruck aus formulas, Wert aus run */
  const PCT = { etaLin: 1, dBuck: 2, dBoost: 2, dInvers: 2, dFlyback: 2, etaSchalt: 1 };
  const argTxt = (x, u) => (u ? fe(x, u) : fz(x));
  function exLine(id, args, labels, o) {
    const f = FM(id); if (!f) return DASH; o = o || {}; const v = FR.apply(null, [id].concat(args));
    const a = f.args.map((g, i) => (labels && labels[i] ? labels[i] : g.key) + ' = ' + argTxt(args[i], g.unit)).join(', ');
    const r = PCT[id] ? pc(v, PCT[id]) : (o.d != null ? (fin(v) ? ff(v, o.d) + (f.unit ? ' ' + f.unit : '') : DASH) : fe(v, f.unit));
    return a + ' ergibt ' + (f.symbol || f.name) + ' = ' + r;
  }
  const diag0 = r => (r && Array.isArray(r.diag) && r.diag[0] && typeof r.diag[0].text === 'string' ? r.diag[0].text : DASH);

  /* Zahlenblatt: jede Zahl im Fließtext, mit der Kernfunktion, aus der sie stammt (Test rechnet jede unabhängig nach) */
  const BUCK = () => ({ Uin: 12, Uout: 5, f: 1e5, L: 1e-4, C: 1e-4, Iout: 1 });
  const RCFG = () => ({ topo: 'bruecke', U2: 12, I: 0.5, C: 2200, f: 50 });
  const RS_EIN = 4.7;
  function nums() {
    const o = {}, C = CORE(); if (!C) return o;
    o.bil = rigBilanz('stabil', '7805-14v');
    o.fp1 = call('rect.fp', 'einweg'); o.fp2 = call('rect.fp', 'bruecke');
    o.ue = okr(call('trafo.ratio', { U1: LV('u_netz'), n1: 1150, n2: 69 }));
    o.load = okr(call('trafo.load', { U1: LV('u_netz'), n1: 1150, n2: 69, ri: LV('ri_trafo'), iLast: 2.5 }));
    o.dc = okr(call('trafo.dc', { U1: 12, n1: 1150, n2: 69 }));
    o.dec = okr(call('rect.decode', 'B80C1500'));
    o.wave = okr(call('rect.wave', RCFG(), 90)); o.rip = okr(call('rect.ripple', RCFG()));
    o.in0 = okr(call('rect.inrush', { U2: 12, topo: 'bruecke', ri: LV('ri_trafo'), rs: 0 })); o.in1 = okr(call('rect.inrush', { U2: 12, topo: 'bruecke', ri: LV('ri_trafo'), rs: RS_EIN }));
    o.st = okr(call('zener.stage', { Ue: 12, Uz: 5.1, Rv: 470, Rlast: 4700 })); o.st2 = okr(call('zener.stage', { Ue: 12, Uz: 5.1, Rv: 470, Rlast: 300 }));
    o.fx14 = okr(call('lin.fixed', { typ: '7805', type: '7805', Uein: 14, I: 0.6 })); o.fx6 = okr(call('lin.fixed', { typ: '7805', type: '7805', Uein: 6, I: 0.6 }));
    o.t2 = okr(call('lin.limitT2', { R3: 0.6, Uein: 14 }));
    o.vs = okr(call('loss.vsLinear', { Uin: 12, Uout: 5, Iout: 0.4, etaSchalt: 0.88 }));
    const b = BUCK();
    o.b1 = okr(call('buck.ccm', b)); o.b2 = okr(call('buck.ccm', Object.assign(BUCK(), { L: 1e-5, Iout: 0.1 })));
    o.w1 = okr(call('buck.wave', b, 60)); o.w2 = okr(call('buck.wave', Object.assign(BUCK(), { L: 1e-5, Iout: 0.1 }), 60));
    o.bo = okr(call('boost.ccm', { Uin: 5, Uout: 12, f: 1e5, L: 1e-4, C: 1e-4, Iout: 0.5 }));
    o.fly = okr(call('fly.ccm', { Uin: 12, Uout: 5, n: 1, f: 1e5, L: 2.2e-4, C: 1e-4, Iout: 0.5 }));
    o.tp1 = okr(call('topology', { Uin: 12, Uout: 5 })); o.tp2 = okr(call('topology', { Uin: 5, Uout: -12 })); o.tp3 = okr(call('topology', { Uin: 12, Uout: 5, getrennt: true }));
    o.lp = okr(call('loss.eta', { Uin: 12, Uout: 5, Iout: 1, f: 1e5, L: 1e-4, Rds: LV('rds_on'), Uf: LV('uf_schottky'), tsw: LV('tsw'), Qg: LV('qg'), UG: LV('ug'), RL: LV('rl_dr') }));
    o.g1 = okr(call('gate.drive', { UG: LV('ug'), Rg: LV('rg'), Qg: LV('qg') * 1e9, Qgd: LV('qgd') * 1e9, Uplat: LV('uplat') }));
    o.g2 = okr(call('gate.drive', { UG: LV('ug'), Rg: 47, Qg: LV('qg') * 1e9, Qgd: LV('qgd') * 1e9, Uplat: LV('uplat') }));
    o.gBad = call('gate.drive', { UG: 4, Rg: LV('rg'), Qg: LV('qg') * 1e9, Qgd: LV('qgd') * 1e9, Uplat: LV('uplat') });
    o.dt1 = okr(call('gate.deadtime', { tot: 50e-9, tOffHi: 100e-9 })); o.dt2 = okr(call('gate.deadtime', { tot: 150e-9, tOffHi: 100e-9 }));
    o.gsw = okr(call('gate.switching', { UG: LV('ug'), Rg: 10, Qgd: LV('qgd') * 1e9, Uplat: LV('uplat'), Uin: 12, I: 1, f: 1e5 }));
    o.dv = okr(call('loop.divider', { Uref: LV('uref_317'), R1: 1000, Uaus: 9 })); o.dvR1 = okr(call('loop.divider', { R1: 1000, R2: 6200, offen: 'R1' })); o.dvR2 = okr(call('loop.divider', { R1: 1000, R2: 6200, offen: 'R2' }));
    const lp = v => ({ Raus: LV('loop_raus'), C: LV('loop_c'), Vr: v, tau: LV('loop_tau'), dI: LV('loop_di') });
    o.stp1 = okr(call('loop.step', lp(LV('loop_vr')))); o.stp2 = okr(call('loop.step', lp(LV('loop_vr_schwing'))));
    o.cv = [20, 12, 8, 4].map(r => okr(call('lab.cvcc', { Uset: 12, Iset: 1, Rlast: r })));
    o.ilim = okr(call('lab.ilim', { Rs: 0.6 })); o.short = okr(call('lab.short', { Uin: 14, Iset: 1, Uset: 12 }));
    const cat = C.fault && Array.isArray(C.fault.catalog) ? C.fault.catalog : []; o.cat = cat;
    o.path = okr(call('fault.path', 'kein-ausgang'));
    o.syms = []; cat.forEach(f => (f.symptome || []).forEach(s => { if (o.syms.indexOf(s) < 0) o.syms.push(s); }));
    o.symInfo = o.syms.map(s => { const p = okr(call('fault.path', s)); return { id: s, name: p ? p.name : s, n: cat.filter(f => (f.symptome || []).indexOf(s) >= 0).length }; });
    o.cAus = cat.find(f => f.id === 'c-ausgetrocknet') || null;
    o.f0 = FR('grenzf', 220e-6, 100e-9);
    return o;
  }

  /* ============================================================ Zeichnungen (SVG, Breite 400, Schrift 14; Text bis zum Rand: Prüfung im Test) */
  const svg = (label, body, h) => `<svg class="dr" viewBox="0 0 400 ${h || 170}" role="img" aria-label="${esc(label)}" xmlns="http://www.w3.org/2000/svg" font-family="system-ui,sans-serif" font-size="14" fill="currentColor">${body}</svg>`;
  const T = (x, y, t, anchor, extra) => `<text x="${+(+x).toFixed(1)}" y="${+(+y).toFixed(1)}"${anchor ? ` text-anchor="${anchor}"` : ''}${extra ? ' ' + extra : ''}>${esc(t)}</text>`;
  const LN = (x1, y1, x2, y2, c, w, dash) => `<line x1="${+(+x1).toFixed(1)}" y1="${+(+y1).toFixed(1)}" x2="${+(+x2).toFixed(1)}" y2="${+(+y2).toFixed(1)}" stroke="${c || 'currentColor'}" stroke-width="${w || 2}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
  const RC = (x, y, w, h, c, fill, r) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r == null ? 8 : r}" fill="${fill || 'none'}" stroke="${c || 'currentColor'}" stroke-width="2"/>`;
  const ARR = (x1, y1, x2, y2, c) => { const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, col = c || 'currentColor'; return `<line x1="${x1}" y1="${y1}" x2="${+(x2 - ux * 6).toFixed(1)}" y2="${+(y2 - uy * 6).toFixed(1)}" stroke="${col}" stroke-width="2"/><polygon points="${x2},${y2} ${+(x2 - ux * 9 - uy * 4.5).toFixed(1)},${+(y2 - uy * 9 + ux * 4.5).toFixed(1)} ${+(x2 - ux * 9 + uy * 4.5).toFixed(1)},${+(y2 - uy * 9 - ux * 4.5).toFixed(1)}" fill="${col}"/>`; };
  const PL = (pts, c, w, dash) => `<polyline points="${pts.map(p => (+p[0].toFixed(1)) + ',' + (+p[1].toFixed(1))).join(' ')}" fill="none" stroke="${c || 'currentColor'}" stroke-width="${w || 2}"${dash ? ` stroke-dasharray="${dash}"` : ''} stroke-linejoin="round"/>`;
  const DOT = (x, y, r, c) => `<circle cx="${+(+x).toFixed(1)}" cy="${+(+y).toFixed(1)}" r="${r}" fill="${c || 'currentColor'}"/>`;
  const lin = (v, a, b, p, q) => p + (q - p) * (v - a) / ((b - a) || 1);
  /* Farben nach SPEC 7: Eingang orange, Ausgang grün, Verlust rot, Schaltknoten violett, Drosselstrom blau, Gate gelb; jede Farbe steht zusätzlich als Text */
  const COL = { ein: '#f59e0b', aus: '#22c55e', verlust: '#ef4444', schalt: '#a855f7', strom: '#3b82f6', gate: '#eab308' };
  /* Zeilenumbruch für SVG-Text (kein tspan, jede Zeile ein eigenes text-Element, damit die Prüfung jede Zeile misst) */
  function wrap(t, max) {
    const words = String(t == null ? '' : t).split(/\s+/).filter(Boolean), lines = []; let cur = '';
    words.forEach(w => { if (cur && (cur + ' ' + w).length > max) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; });
    if (cur) lines.push(cur); return lines.length ? lines : [''];
  }
  /* Senkrechte Schrittfolge (Prüfreihenfolge): Nummer, Kasten mit umbrochenem Text, Pfeil zum nächsten */
  function stepsSvg(label, items) {
    let y = 6, b = '';
    items.forEach((it, i) => {
      const lines = wrap(it, 38), h = 12 + 17 * lines.length;
      b += RC(46, y, 346, h, 'currentColor', 'none', 8) + `<circle cx="24" cy="${y + h / 2}" r="14" fill="none" stroke="currentColor" stroke-width="2"/>` + T(24, y + h / 2 + 5, String(i + 1), 'middle') + lines.map((s, k) => T(56, y + 22 + 17 * k, s)).join('');
      y += h; if (i < items.length - 1) { b += ARR(24, y + 1, 24, y + 9); y += 10; }
    });
    return svg(label, b, y + 8);
  }
  const diode = (cx, cy, dx, dy, c) => { const l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, px = -uy, py = ux, f = (a, b) => (cx + ux * a + px * b).toFixed(1) + ',' + (cy + uy * a + py * b).toFixed(1);
    return `<polygon points="${f(8, 0)} ${f(-7, 7)} ${f(-7, -7)}" fill="${c || 'currentColor'}"/>` + LN(cx + ux * 8 + px * 8, cy + uy * 8 + py * 8, cx + ux * 8 - px * 8, cy + uy * 8 - py * 8, c || 'currentColor', 2.5); };
  const zig = (x, y, w, c) => { const n = 6, d = w / n, p = [[x, y]]; for (let i = 0; i < n; i++) p.push([x + d * (i + 0.5), y + (i % 2 ? 7 : -7)]); p.push([x + w, y]); return PL(p, c, 2); };
  const coilH = (x, y, w, c) => { let d = `M${x} ${y}`; const n = 4, r = w / n / 2; for (let i = 0; i < n; i++) d += ` a${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${(2 * r).toFixed(1)} 0`; return `<path d="${d}" fill="none" stroke="${c || 'currentColor'}" stroke-width="2.5"/>`; };

  const DRAW = {
    block: n => {
      const S = n.stuf || {}, b = n.bil; let body = '';
      ['trafo', 'gleich', 'sieb', 'regel'].forEach((k, i) => {
        const y = 10 + i * 52, s = S[k] || STUF_FALL[k];
        body += `<rect x="10" y="${y}" width="190" height="38" rx="8" fill="${s.color}" fill-opacity=".22" style="stroke:${s.color}" stroke-width="2"/><circle cx="32" cy="${y + 19}" r="12" fill="none" style="stroke:${s.color}" stroke-width="2"/>` + T(32, y + 24, s.sym, 'middle', 'font-size="13" font-weight="700"') + T(52, y + 24, s.name);
        if (i < 3) body += ARR(105, y + 38, 105, y + 52);
      });
      body += ARR(105, 204, 105, 226) + T(105, 244, 'Last', 'middle');
      if (b && fin(b.pzu) && b.pzu > 0) {
        const rows = [{ l: 'P_zu ' + fe(b.pzu, 'W'), w: b.pzu, c: COL.ein }].concat((b.pv || []).map(x => ({ l: 'P_V ' + fe(x.w, 'W'), w: x.w, c: COL.verlust }))).concat([{ l: 'P_ab ' + fe(b.pab, 'W'), w: b.pab, c: COL.aus }]);
        body += T(220, 22, 'Leistungsbilanz', null, 'font-weight="700"');
        rows.forEach((r, i) => { const y = 54 + i * 44; body += T(220, y, r.l) + `<rect x="220" y="${y + 8}" width="${Math.max(2, +(165 * r.w / b.pzu).toFixed(1))}" height="14" rx="3" fill="${r.c}" fill-opacity=".8"/>`; });
        body += T(220, 54 + rows.length * 44 + 4, 'η = ' + pc(b.eta, 1));
      } else body += T(220, 60, 'Leistungsbilanz fehlt');
      return svg('Blockschaltbild des Netzteils: Transformator, Gleichrichtung, Glättung und Regelung hintereinander zur Last, daneben die Leistungsbilanz aus zugeführter, abgegebener und Verlustleistung', body, 252);
    },
    trafo: n => {
      const u = n.ue || {}, l = n.load || {}, coil = (x, c) => [0, 1, 2, 3, 4, 5].map(i => LN(x - 20, 52 + i * 12, x + 20, 52 + i * 12, c, 3)).join('');
      return svg('Transformator mit Eisenkern, Primärwicklung links und Sekundärwicklung rechts, Spannungen, Windungszahlen und Ströme', `<rect x="150" y="30" width="100" height="104" rx="4" fill="none" stroke="currentColor" stroke-width="12" opacity=".55"/>` + coil(150, COL.ein) + coil(250, COL.aus) +
        T(10, 40, 'U₁ ' + fe(u.U1, 'V')) + T(10, 60, 'N₁ ' + fz(u.n1)) + T(390, 40, 'U₂ ' + fe(u.U2_leer, 'V'), 'end') + T(390, 60, 'N₂ ' + fz(u.n2), 'end') +
        T(200, 154, 'ü = ' + ff(u.ue, 1), 'middle') + T(10, 112, 'I₁ ' + fe(l.I1, 'A')) + T(390, 112, 'I₂ ' + fe(l.I2, 'A'), 'end'), 170);
    },
    gleich: n => {
      const f = fin(n.fp1) ? n.fp1 : 50, fa = fin(n.fp1) ? n.fp1 : NaN, fb = fin(n.fp2) ? n.fp2 : NaN, N = 80, hump = (half, y0) => { const p = []; for (let i = 0; i <= N; i++) { const t = 0.04 * i / N, s = Math.sin(2 * Math.PI * f * t); p.push([200 + 190 * i / N, y0 - 40 * (half ? Math.max(0, s) : Math.abs(s))]); } return PL(p, COL.aus, 2.5); };
      const v = { L: [40, 84], T: [95, 29], R: [150, 84], B: [95, 139] }, edge = (a, b, hi) => LN(v[a][0], v[a][1], v[b][0], v[b][1], hi ? COL.ein : 'currentColor', hi ? 4.5 : 2.5);
      const mid = (a, b) => [(v[a][0] + v[b][0]) / 2, (v[a][1] + v[b][1]) / 2], dir = (a, b) => [v[b][0] - v[a][0], v[b][1] - v[a][1]];
      const dd = (a, b, hi) => { const m = mid(a, b), d = dir(a, b); return diode(m[0], m[1], d[0], d[1], hi ? COL.ein : 'currentColor'); };
      return svg('Brückengleichrichter mit vier Dioden, der Strompfad der positiven Halbwelle über zwei Dioden hervorgehoben, daneben die Pulse von Einweg- und Brückenschaltung', edge('L', 'T', 1) + edge('T', 'R') + edge('R', 'B', 1) + edge('B', 'L') +
        dd('L', 'T', 1) + dd('R', 'T') + dd('B', 'L') + dd('B', 'R', 1) + T(22, 90, '~', 'middle') + T(168, 90, '~', 'middle') + T(95, 20, '+', 'middle') + T(95, 158, '−', 'middle') + T(34, 52, 'D1') + T(138, 134, 'D3') + T(95, 178, 'Strompfad: 2 Dioden', 'middle') +
        T(200, 18, 'Einweg: ' + fe(fa, 'Hz')) + hump(true, 70) + LN(200, 70, 390, 70, 'currentColor', 1) + T(200, 100, 'Brücke: ' + fe(fb, 'Hz')) + hump(false, 152) + LN(200, 152, 390, 152, 'currentColor', 1), 190);
    },
    sieb: n => {
      const w = n.wave; if (!w || !Array.isArray(w.t) || !Array.isArray(w.uc) || w.t.length < 3) return svg('Verlauf der Kondensatorspannung nicht verfügbar', T(200, 60, 'Verlauf fehlt im Kern', 'middle'), 100);
      const umax = w.Umax, umin = w.Umin, du = umax - umin, y0 = umin - 0.6 * du, y1 = umax + 0.6 * du, t0 = w.t[0], t1 = w.t[w.t.length - 1];
      const X = t => lin(t, t0, t1, 70, 388), Y = u => lin(u, y0, y1, 140, 30), pts = w.t.map((t, i) => [X(t), Y(w.uc[i])]);
      return svg('Kondensatorspannung am Ausgang des Gleichrichters als Sägezahn zwischen Scheitelwert und Minimalwert, die Brummspannung als Abstand', LN(70, 30, 70, 140) + LN(70, 140, 390, 140) + LN(70, Y(umax), 390, Y(umax), COL.ein, 1, '5 4') + LN(70, Y(umin), 390, Y(umin), COL.verlust, 1, '5 4') + PL(pts, COL.aus, 2.5) +
        T(66, Y(umax) + 5, 'Û', 'end') + T(66, Y(umin) + 5, 'U_min', 'end') + T(388, Y(umax) - 6, fe(umax, 'V'), 'end') + T(388, Y(umin) + 16, fe(umin, 'V'), 'end') + T(230, 166, 'ΔU (Modell) = ' + fe(du, 'V'), 'middle') + T(230, 186, 'Zeit', 'middle', 'font-size="13"'), 196);
    },
    z: n => { const s = n.st || {};
      return svg('Z-Diode mit Vorwiderstand und Last: der Gesamtstrom teilt sich in den Strom durch die Z-Diode und den Laststrom', LN(20, 50, 70, 50) + RC(70, 40, 60, 20, 'currentColor', 'none', 2) + LN(130, 50, 380, 50) + LN(20, 130, 380, 130) + LN(20, 50, 20, 130) + T(26, 96, 'U_ein ' + fe(s.Ue, 'V')) +
        T(100, 78, 'R_V ' + fe(s.Rv, 'Ω'), 'middle') + LN(200, 50, 200, 80) + diode(200, 90, 0, 1, COL.aus) + LN(200, 100, 200, 130) + T(210, 94, 'U_Z ' + fe(s.Uz, 'V')) + LN(310, 50, 310, 78) + RC(300, 78, 20, 36, 'currentColor', 'none', 2) + LN(310, 114, 310, 130) + T(330, 92, 'R_last') + T(330, 110, fe(s.Rlast, 'Ω')) +
        T(26, 30, 'I_ges ' + fe(s.Iges, 'A'), null, 'font-size="13"') + T(205, 72, 'I_Z ' + fe(s.Iz, 'A'), null, 'font-size="13"') + T(250, 150, 'I_last ' + fe(s.Ilast, 'A'), null, 'font-size="13"') + ARR(30, 50, 62, 50, COL.ein), 166);
    },
    linear: n => { const f = n.fx14 || {};
      return svg('Linearregler als Längselement zwischen Eingang und Ausgang: die Differenzspannung mal Strom wird zu Verlustleistung und damit zu Wärme', RC(140, 40, 120, 56, 'currentColor') + T(200, 74, 'Regler', 'middle') + ARR(30, 68, 138, 68, COL.ein) + ARR(262, 68, 372, 68, COL.aus) + T(30, 54, 'U_ein ' + fe(f.Uein, 'V')) + T(372, 54, 'U_aus ' + fe(f.Uaus, 'V'), 'end') + T(30, 92, 'I ' + fe(f.I, 'A')) +
        ARR(200, 98, 200, 128, COL.verlust) + `<rect x="130" y="130" width="140" height="14" rx="3" fill="${COL.verlust}" fill-opacity=".8"/>` + T(200, 164, 'P_V ' + fe(f.P_V, 'W') + ' (Wärme)', 'middle'), 176);
    },
    lm317: n => { const l = n.lm || {};
      return svg('LM317 mit Spannungsteiler: R1 zwischen Ausgang und Adjust-Anschluss, R2 vom Adjust-Anschluss nach Masse', RC(90, 30, 100, 50, 'currentColor') + T(140, 60, 'LM317', 'middle') + ARR(20, 45, 88, 45, COL.ein) + LN(190, 45, 300, 45, COL.aus, 2) + T(24, 30, 'IN') + T(194, 38, 'OUT') + T(140, 98, 'ADJ', 'middle', 'font-size="13"') +
        LN(140, 80, 140, 112) + LN(140, 112, 300, 112) + LN(300, 45, 300, 62) + RC(290, 62, 20, 40, 'currentColor', 'none', 2) + LN(300, 102, 300, 112) + LN(300, 112, 300, 126) + RC(290, 126, 20, 40, 'currentColor', 'none', 2) + LN(300, 166, 300, 180) + LN(285, 180, 315, 180) +
        T(322, 86, 'R1 ' + fe(l.R1, 'Ω'), null, 'font-size="13"') + T(322, 150, 'R2 ' + fe(l.R2, 'Ω'), null, 'font-size="13"') + T(380, 30, 'U_aus ' + ff(l.Uaus, 3) + ' V', 'end'), 190);
    },
    therm: n => { const rows = n.thermRows || [], th = fin(n.thermLim) ? n.thermLim : NaN, mx = Math.max.apply(null, rows.map(r => r.v).concat([th, 1e-9]).filter(fin));
      if (!rows.length || !fin(mx) || !fin(th)) return svg('Vergleich der Verlustleistung mit der Hinweisschwelle nicht verfügbar', T(200, 40, 'Zahlen fehlen im Kern', 'middle'), 90);
      const X = v => 130 + 190 * v / mx; let b = T(130, 16, 'Schwelle ' + fe(th, 'W'), null, 'font-size="13"') + LN(X(th), 22, X(th), 22 + rows.length * 30 + 4, COL.verlust, 2, '5 4');
      rows.forEach((r, i) => { const y = 34 + i * 30; b += T(10, y + 13, r.l, null, 'font-size="13"') + `<rect x="130" y="${y}" width="${Math.max(2, +(X(r.v) - 130).toFixed(1))}" height="18" rx="3" fill="${r.v >= th ? COL.verlust : COL.aus}" fill-opacity=".8"/>` + T(X(r.v) + 6, y + 14, fe(r.v, 'W'), null, 'font-size="13"'); });
      return svg('Balken der Verlustleistung verschiedener Beispiele gegen die gestrichelte Hinweisschwelle für die Kühlung', b, 34 + rows.length * 30 + 8);
    },
    schalt: () => svg('Prinzip des Tiefsetzstellers: Schalter, Drossel, Freilaufdiode, Ladekondensator und Last; in der Einschaltphase fließt der Strom über Schalter und Drossel, in der Ausschaltphase über Diode und Drossel',
      LN(20, 50, 50, 50) + LN(50, 50, 90, 38) + DOT(50, 50, 3) + DOT(92, 50, 3) + LN(92, 50, 120, 50) + DOT(120, 50, 5, COL.schalt) + coilH(120, 50, 100, COL.strom) + LN(220, 50, 380, 50) + LN(120, 50, 120, 76) + diode(120, 90, 0, -1) + LN(120, 100, 120, 130) +
      LN(270, 50, 270, 84) + LN(258, 84, 282, 84) + LN(258, 92, 282, 92) + LN(270, 92, 270, 130) + LN(340, 50, 340, 76) + RC(330, 76, 20, 36, 'currentColor', 'none', 2) + LN(340, 112, 340, 130) + LN(20, 130, 380, 130) + LN(20, 50, 20, 130) +
      T(30, 94, 'U_ein') + T(70, 32, 'S', 'middle') + T(170, 32, 'L', 'middle') + T(134, 98, 'D') + T(246, 96, 'C', 'end') + T(358, 98, 'Last') + T(120, 24, 'Schaltknoten', 'middle', 'font-size="13"') +
      T(20, 156, 'Schalter an: Strom über S und L', null, 'font-size="13"') + T(20, 176, 'Schalter aus: Strom über D und L', null, 'font-size="13"'), 188),
    drossel: n => {
      const plot = (w, y0, title) => {
        if (!w || !Array.isArray(w.t)) return T(70, y0 + 40, 'Verlauf fehlt im Kern');
        const s = (w.series || []).find(x => x && x.name === 'i_L'); if (!s || !Array.isArray(s.y)) return T(70, y0 + 40, 'Verlauf fehlt im Kern');
        const t0 = w.t[0], t1 = w.t[w.t.length - 1], top = n.drTop, X = t => lin(t, t0, t1, 70, 388), Y = i => lin(i, 0, top, y0 + 70, y0 + 6);
        return T(70, y0 - 6, title, null, 'font-size="13"') + LN(70, y0 + 6, 70, y0 + 70) + LN(70, y0 + 70, 390, y0 + 70) + PL(w.t.map((t, i) => [X(t), Y(s.y[i])]), COL.strom, 2.5) + T(66, y0 + 74, '0 A', 'end', 'font-size="13"') + T(66, y0 + 10, fe(top, 'A'), 'end', 'font-size="13"');
      };
      const m = [n.w1, n.w2].map(w => (w && Array.isArray(w.series) ? Math.max.apply(null, (w.series.find(x => x.name === 'i_L') || { y: [] }).y.filter(fin)) : NaN)).filter(fin); n.drTop = m.length ? Math.max.apply(null, m) * 1.1 : 1;
      return svg('Drosselstrom des Tiefsetzstellers über der Zeit: oben nicht lückend als Dreieck um den Mittelwert, unten lückend mit Pausen bei 0 A', plot(n.w1, 28, 'nicht lückend (CCM): ' + fe((n.b1 || {}).ILmin, 'A') + ' bis ' + fe((n.b1 || {}).ILmax, 'A')) + plot(n.w2, 128, 'lückend (DCM): ' + fe((n.b2 || {}).ILmin, 'A') + ' bis ' + fe((n.b2 || {}).ILmax, 'A')), 214);
    },
    topos: n => {
      const R = n.topoRows || []; if (!R.length) return svg('Vergleich der Grundschaltungen nicht verfügbar', T(200, 40, 'Zahlen fehlen im Kern', 'middle'), 90);
      const mx = Math.max.apply(null, R.map(r => Math.max(Math.abs(r.uin), Math.abs(r.uout))).filter(fin).concat([1e-9])); let b = T(280, 14, 'U_ein', null, 'font-size="13"') + T(332, 14, 'U_aus', null, 'font-size="13"');
      R.forEach((r, i) => { const y = 22 + i * 62, base = y + 32, hi = a => 24 * Math.abs(a) / mx;
        b += T(10, y + 16, r.name + ': ' + r.v, null, 'font-weight="700"') + T(10, y + 34, r.expr, null, 'font-size="13"') + T(10, y + 52, 'D = ' + r.d, null, 'font-size="13"') + LN(272, base, 380, base, 'currentColor', 1) +
          `<rect x="284" y="${+(base - hi(r.uin)).toFixed(1)}" width="18" height="${+hi(r.uin).toFixed(1)}" fill="${COL.ein}" fill-opacity=".85"/>` + `<rect x="336" y="${r.uout < 0 ? base : +(base - hi(r.uout)).toFixed(1)}" width="18" height="${+hi(r.uout).toFixed(1)}" fill="${COL.aus}" fill-opacity=".85"/>`;
      });
      return svg('Vergleich der vier Grundschaltungen mit Formel und Tastverhältnis und je zwei Balken für Eingangs- und Ausgangsspannung, beim Inverswandler zeigt der Ausgangsbalken nach unten', b, 22 + R.length * 62 + 4);
    },
    verluste: n => {
      const p = n.lp && Array.isArray(n.lp.parts) ? n.lp.parts.filter(x => x && fin(x.w)) : []; if (!p.length) return svg('Verlustbalken nicht verfügbar', T(200, 40, 'Verluste fehlen im Kern', 'middle'), 90);
      const mx = Math.max.apply(null, p.map(x => x.w).concat([1e-12])); let b = '';
      p.forEach((x, i) => { const y = 8 + i * 26; b += T(8, y + 15, x.name, null, 'font-size="13"') + `<rect x="170" y="${y + 2}" width="${Math.max(1, +(130 * x.w / mx).toFixed(1))}" height="16" rx="3" fill="${COL.verlust}" fill-opacity=".8"/>` + T(392, y + 15, fe(x.w, 'W'), 'end', 'font-size="13"'); });
      return svg('Balken der Einzelverluste des Tiefsetzstellers: Leitverlust, Diodenverlust, Schaltverlust, Gate-Verlust, Drosselkupfer, Kondensator und Ruhestrom, jeder mit seinem Wert', b, 8 + p.length * 26 + 6);
    },
    gate: n => { const g = n.g1 || {}, UG = g.UG, Up = g.Uplat; if (!fin(UG) || !fin(Up) || UG <= 0) return svg('Verlauf der Gate-Spannung nicht verfügbar', T(200, 50, 'Zahlen fehlen im Kern', 'middle'), 100);
      const Y = v => 150 - 118 * v / UG, p = [[64, 150], [90, 150], [138, Y(Up)], [248, Y(Up) - 6], [300, Y(UG)], [390, Y(UG)]];
      return svg('Gate-Spannung beim Einschalten: Anstieg bis zum Miller-Plateau, Plateau während die Drain-Spannung fällt, danach Anstieg auf die Treiberspannung; Prinzipbild ohne Zeitmaßstab', LN(64, 30, 64, 154) + LN(64, 150, 392, 150) + LN(64, Y(UG), 392, Y(UG), COL.gate, 1, '5 4') + LN(64, Y(Up), 248, Y(Up), COL.gate, 1, '5 4') + PL(p, COL.gate, 3) +
        T(60, Y(UG) + 5, fe(UG, 'V'), 'end') + T(60, Y(Up) + 5, fe(Up, 'V'), 'end') + T(190, Y(Up) - 14, 'Miller-Plateau', 'middle') + T(190, Y(Up) + 26, 't_sw = ' + fe(g.t_sw * 1e-9, 's'), 'middle') + T(225, 176, 'Zeit (Prinzipbild)', 'middle', 'font-size="13"') + T(70, 24, 'u_GS', null, 'font-size="13"'), 188); },
    loop: n => { const d = n.dv || {};
      return svg('Regelkreis des Netzteils: Referenz und Rückführung treffen am Vergleich zusammen, der Fehlerverstärker steuert die PWM, die Leistungsstufe liefert die Ausgangsspannung, der Teiler R1 und R2 führt sie zurück',
        T(8, 44, 'U_ref', null, 'font-size="13"') + ARR(46, 38, 88, 38) + `<circle cx="100" cy="38" r="12" fill="none" stroke="currentColor" stroke-width="2"/>` + T(100, 43, 'Σ', 'middle', 'font-size="13"') + T(72, 30, '+', 'middle', 'font-size="13"') + T(112, 62, '−', null, 'font-size="13"') + ARR(112, 38, 128, 38) + RC(128, 18, 140, 40) + T(198, 43, 'Fehlerverstärker', 'middle', 'font-size="13"') +
        ARR(268, 38, 292, 38) + RC(292, 18, 70, 40) + T(327, 43, 'PWM', 'middle') + LN(327, 58, 327, 84) + ARR(327, 84, 327, 100) + RC(262, 100, 130, 40) + T(327, 125, 'Leistungsstufe', 'middle', 'font-size="13"') + LN(327, 140, 327, 168) + T(318, 160, 'U_aus ' + fe(d.Uaus, 'V'), 'end', 'font-size="13"') +
        LN(327, 168, 246, 168) + ARR(246, 168, 238, 168) + RC(112, 150, 126, 36) + T(175, 173, 'Teiler R1, R2', 'middle', 'font-size="13"') + LN(112, 168, 100, 168) + LN(100, 168, 100, 70) + ARR(100, 70, 100, 52), 198);
    },
    cvcc: n => { const P = (n.cvCurve || []).filter(p => p && fin(p.I) && fin(p.U)); if (P.length < 3) return svg('Kennlinie des Labornetzteils nicht verfügbar', T(200, 50, 'Kennlinie fehlt im Kern', 'middle'), 100);
      const us = n.cvSet, is = n.cvIset, ux = us * 1.2, ix = is * 1.2, X = i => lin(i, 0, ix, 64, 380), Y = u => lin(u, 0, ux, 150, 22), pts = P.map(p => [X(p.I), Y(p.U)]).sort((a, b) => a[0] - b[0] || b[1] - a[1]);
      const mk = (c, lab, dx, dy, an) => c ? DOT(X(c.Iout), Y(c.Uout), 5, COL.ein) + T(X(c.Iout) + dx, Y(c.Uout) + dy, lab + fe(c.Rlast, 'Ω'), an, 'font-size="13"') : '';
      return svg('Kennlinie des Labornetzteils: Ausgangsspannung über dem Ausgangsstrom, waagerecht im CV-Bereich, senkrecht im CC-Bereich, mit den Arbeitspunkten für 20 Ohm und 8 Ohm', LN(64, 22, 64, 150) + LN(64, 150, 384, 150) + PL(pts, COL.aus, 3) + LN(X(is), 150, X(is), 156, 'currentColor', 1.5) + T(X(is), 172, fe(is, 'A'), 'middle', 'font-size="13"') + T(60, Y(us) + 5, fe(us, 'V'), 'end', 'font-size="13"') + T(60, 154, '0', 'end', 'font-size="13"') +
        mk(n.cvPts && n.cvPts[0], 'CV ', 0, -10, 'middle') + mk(n.cvPts && n.cvPts[2], 'CC ', -10, -2, 'end') + T(390, 14, 'R_krit ' + fe(n.cvPts && n.cvPts[1] ? n.cvPts[1].Rkrit : NaN, 'Ω'), 'end', 'font-size="13"') + T(220, 186, 'Strom I', 'middle', 'font-size="13"'), 194); },
    baum: n => { const S = n.symInfo || []; if (!S.length) return svg('Fehlerbaum nicht verfügbar', T(200, 40, 'Fehlerkatalog fehlt im Kern', 'middle'), 90);
      const rows = Math.ceil(S.length / 2); let b = RC(110, 8, 180, 32) + T(200, 29, 'Netzteil fehlerhaft', 'middle') + LN(200, 40, 200, 66 + (rows - 1) * 56 + 23, 'currentColor', 1.5);
      S.forEach((s, i) => { const x = i % 2 ? 210 : 10, y = 66 + Math.floor(i / 2) * 56, ls = wrap(s.name + ' (' + s.n + ')', 20); b += LN(200, y + 23, i % 2 ? 210 : 190, y + 23, 'currentColor', 1.5) + RC(x, y, 180, 46, 'currentColor', 'none', 6) + ls.slice(0, 2).map((q, k) => T(x + 8, y + 19 + 17 * k, q, null, 'font-size="13"')).join(''); });
      return svg('Fehlerbaum nach Symptom: vom fehlerhaften Netzteil zu den Symptomen, in Klammern die Zahl der Fehler im Katalog', b, 66 + rows * 56 + 4); },
    emv: n => { const w = n.w1, s = w && Array.isArray(w.series) ? w.series.find(x => x && x.name === 'u_sw') : null; if (!s || !Array.isArray(s.y)) return svg('Schaltspannung nicht verfügbar', T(200, 50, 'Verlauf fehlt im Kern', 'middle'), 100);
      const t0 = w.t[0], t1 = w.t[w.t.length - 1], mx = Math.max.apply(null, s.y.filter(fin).concat([1e-9])), pts = w.t.map((t, i) => [lin(t, t0, t1, 24, 224), lin(s.y[i], 0, mx, 90, 26)]);
      return svg('Schaltspannung mit schnellen Flanken als Störquelle und LC-Tiefpass am Ausgang mit seiner Grenzfrequenz', T(24, 16, 'Schaltknoten u_sw', null, 'font-size="13"') + LN(24, 26, 24, 92, 'currentColor', 1) + LN(24, 90, 226, 90, 'currentColor', 1) + PL(pts, COL.schalt, 2.5) + T(238, 52, 'schnelle Flanken:', null, 'font-size="13"') + T(238, 70, 'Störquelle', null, 'font-size="13"') +
        ARR(130, 100, 130, 124) + LN(20, 150, 50, 150) + coilH(50, 150, 90, COL.strom) + LN(140, 150, 250, 150) + LN(100, 150, 100, 150) + LN(200, 150, 200, 162) + LN(188, 162, 212, 162) + LN(188, 170, 212, 170) + LN(200, 170, 200, 184) + LN(20, 184, 250, 184) +
        T(95, 136, 'L', 'middle', 'font-size="13"') + T(222, 172, 'C', null, 'font-size="13"') + T(262, 148, 'f₀ = ' + fe(n.f0, 'Hz'), null, 'font-size="13"'), 196); }
  };
  /* SVG-Texte: grobe Breitenschätzung (0,6 · Schriftgröße je Zeichen) gegen die Zeichenfläche. Bei 390 Pixel Seitenbreite wird die Zeichnung (Breite 400) auf etwa 334 Pixel verkleinert;
     SCALE390 = 334/400 ist der Verkleinerungsfaktor, die wirksame Schrift muss lesbar bleiben (Test: mindestens 10,5 Pixel). Der Browsertest misst zusätzlich mit getBBox. */
  const SCALE390 = (390 - 56) / 400;
  function svgTextCheck(markup, width) {
    const bad = [], vb = /viewBox="0 0 (\d+) (\d+)"/.exec(markup), W = vb ? +vb[1] : width || 400, root0 = /<svg[^>]*font-size="(\d+)"/.exec(markup), fs0 = root0 ? +root0[1] : 14, re = /<text\b([^>]*)>([^<]*)<\/text>/g; let m;
    while ((m = re.exec(markup))) {
      const at = k => { const q = new RegExp('(?:^|\\s)' + k + '="([^"]*)"').exec(m[1]); return q ? q[1] : null; }, x = +at('x'), fs = +(at('font-size') || fs0), t = m[2].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"'), w = t.length * fs * 0.6, anc = at('text-anchor') || 'start';
      const x0 = anc === 'middle' ? x - w / 2 : anc === 'end' ? x - w : x, x1 = x0 + w;
      if (x0 < -1 || x1 > W + 1) bad.push(t + ' (' + Math.round(x0) + '…' + Math.round(x1) + ' von ' + W + ')');
      if (fs * SCALE390 < 10.5) bad.push(t + ' (Schrift zu klein bei 390 px: ' + (fs * SCALE390).toFixed(1) + ')');
    }
    return bad;
  }

  /* ============================================================ Abschnitte */
  const P = t => `<p>${t}</p>`, LI = a => '<ul>' + a.map(x => `<li>${x}</li>`).join('') + '</ul>', OL = a => '<ol>' + a.map(x => `<li>${x}</li>`).join('') + '</ol>';
  const TB = (head, rows) => `<table class="rs"><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map((c, i) => `<td data-l="${esc(head[i] || '')}">${c}</td>`).join('')}</tr>`).join('')}</table>`;
  const KK = () => `<p class="kk"><b>${esc(PFLICHT())}</b></p>`;
  /* Auf dem Handy werden Tabellen zu Karten (Zeile = Karte, Spaltenkopf vor dem Inhalt), damit nichts seitlich abgeschnitten wird */
  const CSS = '@media(max-width:600px){.hl table.rs,.hl table.rs tbody{display:block;overflow:visible}.hl table.rs tr:first-child{display:none}.hl table.rs tr{display:block;padding:6px 0;border-top:1px solid var(--line)}.hl table.rs td{display:block;border:0;padding:2px 4px}.hl table.rs td::before{content:attr(data-l) ": ";color:var(--mute);font-size:12px;text-transform:uppercase;letter-spacing:.04em}.hl table.rs td:first-child::before{content:""}}.hl .kk{border-left:4px solid var(--accent);background:var(--well);padding:8px 12px;border-radius:6px;margin:8px 0}.hl ol,.hl ul{margin:.4em 0;padding-left:1.3em}';
  /* Probier es aus: Beispiel ntx<n> (sobald ntsdata.js geladen ist), sonst die Voreinstellung des Prüfstands (api.loadRig) */
  const TRY = [
    { ex: 'ntx13', rig: 'stabil', preset: '7805-14v', label: 'Leistungsbilanz im Prüfstand' },
    { ex: 'ntx1', rig: 'trafo', preset: 'belastet', label: 'Belasteter Transformator' }, { ex: 'ntx3', rig: 'trafo', preset: 'gleichstrom', label: 'Trafo an Gleichspannung' },
    { ex: 'ntx5', rig: 'gleich', preset: 'einweg-brueck', label: 'Einweg gegen Brücke' },
    { ex: 'ntx6', rig: 'gleich', preset: 'c-gross-klein', label: 'Ladekondensator größer' }, { ex: 'ntx8', rig: 'gleich', preset: 'einschaltstrom', label: 'Einschaltstrom begrenzen' },
    { ex: 'ntx10', rig: 'stabil', preset: 'z-5v1' },
    { ex: 'ntx13', rig: 'stabil', preset: '7805-14v', label: '7805 an 14 V' }, { ex: 'ntx15', rig: 'stabil', preset: 'lm317-9v', label: 'LM317 einstellen' }, { ex: 'ntx17', rig: 'stabil', preset: 'kurzschluss-t2', label: 'Strombegrenzung im Kurzschluss' },
    { ex: 'ntx13', rig: 'stabil', preset: '7805-14v', label: 'Verlustleistung ansehen' },
    { ex: 'ntx18', rig: 'buck', preset: '12v-5v', label: 'Linear gegen Schaltregler' },
    { ex: 'ntx21', rig: 'buck', preset: 'l-klein-lueckt', label: 'Kleine Drossel lückt' },
    { ex: 'ntx25', rig: 'topo', preset: 'boost-5-12', label: 'Hochsetzsteller' }, { ex: 'ntx26', rig: 'topo', preset: 'invers-12-m5', label: 'Inverswandler' }, { ex: 'ntx27', rig: 'topo', preset: 'sperr-n1', label: 'Sperrwandler' },
    { ex: 'ntx23', rig: 'buck', preset: 'f-hoch-eta', label: 'Hohe Schaltfrequenz' }, { ex: 'ntx24', rig: 'buck', preset: 'sync-gleichrichter', label: 'Synchrongleichrichter' },
    { ex: 'ntx29', rig: 'gate', preset: 'rg-klein-gross', label: 'Gate-Widerstand und Schaltzeit' }, { ex: 'ntx30', rig: 'gate', preset: 'ug-zu-klein', label: 'Gate-Spannung zu klein' },
    { ex: 'ntx32', rig: 'regel', preset: 'teiler-5v', label: 'Rückkopplungsteiler' },
    { ex: 'ntx33', rig: 'regel', preset: 'lab-cv', label: 'Labornetzteil CV' }, { ex: 'ntx33', rig: 'regel', preset: 'lab-cc', label: 'Labornetzteil CC' },
    { ex: 'ntx34', rig: 'fehler', preset: 'kein-ausgang', label: 'Netzteil ohne Ausgang' },
    { ex: 'ntx29', rig: 'gate', preset: 'rg-klein-gross', label: 'Gate-Widerstand und Störung' },
    { tab: 'calc', label: 'Zum Rechner' }
  ];
  const tryBtn = a => '<div class="tryit">' + a.map((i, k) => { const t = TRY[i]; return t ? `<button class="btn${k ? '' : ' pri'}" data-try="${i}">${t.tab ? '🧮' : '▶'} ${esc(t.label || 'Probier es aus')}</button>` : ''; }).join('') + '</div>';
  const faultStufe = (st, k) => (st[k] ? st[k].name : DASH);

  function limitRows() { const C = CORE(), l = C && Array.isArray(C.limits) ? C.limits : []; return l.map(x => ({ id: x.id, text: x.text || '', val: limVal(x), status: limStat(x), belegt: x.status === 'belegt', frage: x.frage || DASH })); }
  function limitTableHtml() { const r = limitRows(); if (!r.length) return P('Die Grenzwerte sind nicht geladen (ntscore.js fehlt).'); return `<div data-lim="1">` + TB(['Größe', 'Wert im Lab', 'Status', 'Frage'], r.map(x => [esc(x.text || x.id), '<b>' + esc(x.val) + '</b>', esc(x.belegt ? '✓ belegt' : 'Übungswert (A)'), esc(x.frage)])) + '</div>'; }
  function formulaRows() { const C = CORE(), l = C && Array.isArray(C.formulas) ? C.formulas : []; return l.filter(x => x && x.id).map(x => ({ id: x.id, name: x.name || x.id, symbol: x.symbol || '', expr: x.expr || '', unit: x.unit || '', explain: typeof x.explain === 'string' ? x.explain : '' })); }
  function formulaTableHtml() { const r = formulaRows(); if (!r.length) return P('Der Rechenkern ist nicht geladen (ntscore.js fehlt): Ohne ihn gibt es keine Formelsammlung.'); return P('Alle Formeln des Labs aus einer Tabelle. Im Tab „Rechnen“ setzt du Zahlen ein und siehst den Rechenweg.') + TB(['Größe', 'Formel', 'Einheit', 'Hinweis'], r.map(x => [esc(x.name), esc(x.expr), esc(x.unit || DASH), esc(x.explain)])); }
  function glossaryRows() { const C = CORE(), g = C && Array.isArray(C.glossary) ? C.glossary : []; return g.filter(x => x && (x.name || x.key)).map(x => ({ key: x.key, article: x.article || '', name: x.name || x.key, sym: x.sym || '', unit: x.unit || '', explain: x.explain || '', alt: x.alt || '' })); }
  function glossaryHtml() {
    const r = glossaryRows(); if (!r.length) return P('Das Glossar ist nicht geladen (ntscore.js fehlt).');
    return TB(['Begriff', 'Bedeutung'], r.map(x => [`<b>${esc((x.article ? x.article + ' ' : '') + x.name)}</b>${x.sym ? ' (' + esc(x.sym) + (x.unit ? ', ' + esc(x.unit) : '') + ')' : ''}`, esc(x.explain) + (x.alt ? ` <i>Auch: ${esc(x.alt)}</i>` : '')]));
  }
  function keyRows(api) { const K = (api && Array.isArray(api.KEYS) && api.KEYS) || (Array.isArray(root.NTS_KEYS) && root.NTS_KEYS) || []; return K.filter(k => k && typeof k === 'object').map(k => ({ keys: Array.isArray(k.keys) ? k.keys : [], t: k.t || '' })); }
  function keysTableHtml(api) { const r = keyRows(api); return r.length ? TB(['Taste', 'Wirkung'], r.map(k => [k.keys.map(x => `<code>${esc(x)}</code>`).join(' oder '), esc(k.t)])) + '<p class="hint2">Die Kürzel gelten nicht, solange ein Eingabefeld oder ein Fenster offen ist.</p>' : P('Die Tastenkürzel sind nicht geladen.'); }

  function sections(api) {
    const n = nums(), C = CORE(), st = stufen(api), out = [];
    n.stuf = st; n.lm = { R1: 240, R2: 970, Uaus: FR('lm317', 240, 970) }; n.thermLim = LV('pv_therm');
    n.thermRows = [{ l: '14 V, 0,6 A', v: FR('pvLin', 14, 5, 0.6), q: 'Pool H2026-20' }, { l: '15 V, 0,2 A', v: FR('pvLin', 15, 5, 0.2), q: 'Pool F2024-N23' }, { l: '9 V, 0,3 A', v: FR('pvLin', 9, 5, 0.3), q: 'Pool H2023-N06' }, { l: '7 V, 0,1 A', v: FR('pvLin', 7, 5, 0.1), q: 'Übungsschaltung (A)' }];
    const tr = (id, a) => { const f = FM(id); return f ? f.expr : DASH; };
    n.topoRows = [['Tiefsetzsteller', 'dBuck', [12, 5], 12, 5, '12 V → 5 V'], ['Hochsetzsteller', 'dBoost', [5, 12], 5, 12, '5 V → 12 V'], ['Inverswandler', 'dInvers', [12, 5], 12, -5, '12 V → −5 V'], ['Sperrwandler', 'dFlyback', [12, 5, 1], 12, 5, '12 V → 5 V, n = 1']].map(r => ({ name: r[0], id: r[1], expr: tr(r[1]), d: pc(FR.apply(null, [r[1]].concat(r[2])), 2), uin: r[3], uout: r[4], v: r[5] }));
    const cvR = [0.05, 1, 2, 4, 6, 8, 10, 11.9, 12.1, 15, 20, 40, 100];
    n.cvSet = 12; n.cvIset = 1; n.cvCurve = cvR.map(r => okr(call('lab.cvcc', { Uset: 12, Iset: 1, Rlast: r }))).filter(Boolean).map(r => ({ I: r.Iout, U: r.Uout }));
    n.cvPts = [20, 12, 8].map(r => okr(call('lab.cvcc', { Uset: 12, Iset: 1, Rlast: r })));
    const add = (id, title, html, tryIdx) => out.push({ id, title, html: html + (tryIdx && tryIdx.length ? tryBtn(tryIdx) : ''), tryIdx: tryIdx || null });
    const u = n.ue || {}, ld = n.load || {}, w = n.wave || {}, rp = n.rip || {}, s1 = n.st || {}, b1 = n.b1 || {}, b2 = n.b2 || {}, bil = n.bil || {};
    const pvStufe = bil.pv && bil.pv[0] ? bil.pv[0].stufe : null;
    /* 1 */
    add('block', '1 Blockschaltbild und Leistungsbilanz', DRAW.block(n) +
      P('Jedes Netzteil nimmt Leistung auf (P_zu), wandelt sie in Stufen und gibt sie ab (P_ab). In jeder Stufe geht ein Teil als <b>Verlustleistung</b> P_V verloren; der <b>Wirkungsgrad</b> ist <b>η = P_ab / P_zu</b> (Pool H2020-N04). Die vier Funktionsblöcke stehen immer in dieser Reihenfolge: Transformator, Gleichrichtung, Glättung, Stabilisierung (Pool H2023-N03). Jedes Bedienelement im Prüfstand gehört zu einer Stufe und trägt deren Farbe und Buchstaben:') +
      TB(['Stufe', 'Buchstabe', 'Aufgabe'], STUF_ORDER.map(k => ['<b style="color:' + esc(st[k].color) + '">■</b> ' + esc(st[k].name), esc(st[k].sym), esc(st[k].text)])) +
      P('Beispiel Linearregler (7805 an 14 V mit 0,6 A)' + ULAB + ': P_zu = ' + esc(fe(bil.pzu, 'W')) + ', P_ab = ' + esc(fe(bil.pab, 'W')) + ', Verlustleistung in der Stufe ' + esc(pvStufe && st[pvStufe] ? st[pvStufe].name : DASH) + ' ' + esc(fe(bil.pv && bil.pv[0] ? bil.pv[0].w : NaN, 'W')) + ', Wirkungsgrad η = ' + esc(pc(bil.eta, 1)) + '. Die Farben Orange (Eingang), Grün (Ausgang) und Rot (Verlust) stehen im Bild immer zusätzlich als Text.') +
      P(esc(TX('ampelHinweis'))), [0]);
    /* 2 */
    add('trafo', '2 Transformator', DRAW.trafo(n) +
      P('Ein <b>Transformator</b> (Trafo) setzt Wechselspannung herauf oder herab. Spannungen verhalten sich wie die Windungszahlen, Ströme umgekehrt: <b>U₁/U₂ = N₁/N₂</b> und <b>I₁/I₂ = N₂/N₁</b> (Pool H2022-N07, F2021-N04). Die Netzspannung ' + esc(LT('u_netz')) + ' ist hier nur eine Zahl im Beispiel.') +
      LI([esc(exLine('uebersetzung', [1150, 69], ['N₁', 'N₂'])) + '; Sekundärspannung im Leerlauf bei ' + esc(fe(u.U1, 'V')) + ': <b>' + esc(fe(u.U2_leer, 'V')) + '</b>' + esc(pool('F2021-N04')),
        esc(exLine('strom1', [2.5, 1150, 69], ['I₂', 'N₁', 'N₂'])) + esc(pool('F2021-N04')),
        'Mit dem Innenwiderstand R_i = ' + esc(LT('ri_trafo')) + ' sinkt die Klemmenspannung unter Last: ' + esc(exLine('uklemme', [u.U2_leer, LV('ri_trafo'), 2.5], ['U_leer', 'R_i', 'I'])) + '; Einbruch ' + esc(pc(ld.einbruch, 1)) + ', Verlustleistung ' + esc(fe(ld.Pv, 'W')) + ', Wirkungsgrad ' + esc(pc(ld.eta, 1)) + esc(ULAB) + '.',
        'Ampelgrenzen für den Einbruch im Lab: ' + esc(LT('trafo_gelb')) + ' grün, ' + esc(LT('trafo_rot')) + ' gelb, darüber rot.']) +
      P('<b>Trafo an Gleichspannung:</b> ' + esc(diag0(n.dc)) + ' Primärwiderstand im Beispiel ' + esc(LT('ri1_trafo')) + esc(pool('F2023-N17')) + '.') +
      P('Eisenverluste und Sättigung des Kerns rechnet das Lab nicht. Ein <b>Sicherheitstransformator</b> trennt Eingang und Ausgang sicher voneinander; mehr dazu im <a href="elslab.html">Sicherheits-Lab</a>.'), [1, 2]);
    /* 3 */
    add('gleich', '3 Gleichrichter: Einweg und Brücke', DRAW.gleich(n) +
      P('Ein <b>Gleichrichter</b> macht aus Wechselspannung pulsierende Gleichspannung. Der <b>Einweggleichrichter</b> nutzt nur eine Halbwelle: Die Pulsfrequenz f_p ist bei 50 Hz Netzfrequenz ' + esc(fe(n.fp1, 'Hz')) + ' (' + esc(limStat(limOf('fp_einweg'))) + ', Pool F2025-04). Die <b>Brückenschaltung</b> nutzt beide Halbwellen: f_p = ' + esc(fe(n.fp2, 'Hz')) + ' (' + esc(limStat(limOf('fp_brueck'))) + ', Pool H2024-09). In der Brücke fließt der Strom immer über zwei Dioden, an jeder fällt die Durchlassspannung ab (Pool H2025-05).') +
      TB(['Schaltung', 'Pulsfrequenz f_p', 'Dioden im Strompfad', 'Û bei U = 12 V (Pool F2020-N25)'], [['Einweg', esc(fe(n.fp1, 'Hz')), '1', esc(ff(FR('scheitel', 12, 1, LV('uf_si')), 2) + ' V')], ['Brücke', esc(fe(n.fp2, 'Hz')), '2', esc(ff(FR('scheitel', 12, 2, LV('uf_si')), 2) + ' V')]]) +
      P('<b>Scheitelwert: Û = U · √2 − n_D · U_F.</b> ' + esc(exLine('scheitel', [12, 2, LV('uf_si')], ['U', 'n_D', 'U_F'], { d: 2 })) + esc(pool('F2020-N25')) + '. Durchlassspannung der Silizium-Diode: ' + esc(LT('uf_si')) + '; Schottky-Diode als Beispiel: ' + esc(LT('uf_schottky')) + '.') +
      P('Die Bezeichnung <b>B80C1500</b> nennt: ' + esc(n.dec ? n.dec.text : DASH) + esc(pool('F2023-N09')) + '.') +
      P('Der Ladekondensator wird nur nachgeladen, solange die gleichgerichtete Spannung über seiner Spannung liegt. Es fließen kurze Stromimpulse: im Beispiel (Brücke, 12 V, 0,5 A, 2200 µF, Übungsschaltung (A)) Spitze ' + esc(fe(w.iPeak, 'A')) + ' bei einer Leitdauer von ' + esc(fe(w.tLeit, 's')) + ' je Impuls, der Mittelwert beträgt nur ' + esc(fe(w.iMean, 'A')) + ' (Modell des Labs).'), [3]);
    /* 4 */
    const ripGroesser = fin(rp.dU) && fin(w.dU) ? (rp.dU > w.dU ? 'über' : rp.dU < w.dU ? 'unter' : 'bei') : null;
    add('sieb', '4 Siebung und Brummspannung', DRAW.sieb(n) +
      P('Der <b>Ladekondensator</b> glättet die pulsierende Gleichspannung: Er wird in den Spannungsspitzen geladen und versorgt die Last in den Lücken. Dabei sinkt seine Spannung etwas: Das ist die <b>Brummspannung</b> ΔU (Spitze-Spitze).') +
      P('<b>ΔU = I / (f_p · C)</b> (Lehrnäherung für einen Sägezahn, Pool H2024-10, ' + esc(limStat(limOf('ripple_naeh'))) + '):') +
      LI(['Brücke: ' + esc(exLine('brumm', [0.5, 100, 0.0022], ['I', 'f_p', 'C'])), 'Einweg (f_p halbiert, ΔU doppelt): ' + esc(exLine('brumm', [0.5, 50, 0.0022], ['I', 'f_p', 'C'])), 'Last verdoppelt, ΔU verdoppelt sich: ' + esc(exLine('brumm', [1, 100, 0.0022], ['I', 'f_p', 'C'])), 'Ladekondensator verdoppelt, ΔU halbiert sich: ' + esc(exLine('brumm', [0.5, 100, 0.0044], ['I', 'f_p', 'C']))]) +
      P('Kleinster Ladekondensator für ΔU = 1 V' + esc(ULAB) + ': ' + esc(exLine('cmin', [0.5, 100, 1], ['I', 'f_p', 'ΔU'])) + '. Die Formel gilt nur, solange ΔU klein gegen Û bleibt: Grenze im Lab ΔU/Û ' + esc(LT('ripple_naeh')) + '; darüber meldet das Lab „Näherung versagt“. Der gezeichnete Verlauf kommt aus dem Modell des Labs (ΔU = ' + esc(fe(w.dU, 'V')) + '); die Formel (' + esc(fe(rp.dU, 'V')) + ') liegt hier ' + esc(ripGroesser || DASH) + ' dem Modellwert, sie ist eine Näherung.') +
      P('<b>Einschaltstrom:</b> Ein leerer Ladekondensator wirkt beim Einschalten wie ein Kurzschluss, nur die Widerstände im Weg begrenzen den Strom. Beispiel (Brücke, 12 V, Übungsschaltung (A)): ohne Vorwiderstand ' + esc(fe((n.in0 || {}).Imax, 'A')) + ', mit Vorwiderstand ' + esc(fe(RS_EIN, 'Ω')) + ' ' + esc(fe((n.in1 || {}).Imax, 'A')) + ' (Pool F2024-N07: Der Vorwiderstand begrenzt den Einschaltstrom).') +
      P('Ein <b>RC-Glied</b> hinter dem Ladekondensator verkleinert den Brumm weiter: ' + esc(exLine('rcSieb', [3, 470, 0.001, 100], ['U₁', 'R', 'C', 'f_p'])) + esc(pool('W2021-N44')) + '. Am Regler gehört zum Elko zusätzlich ein Keramikkondensator (Pool H2020-N21).') +
      P('Ein Elko altert: Er verliert Kapazität, die Brummspannung steigt im selben Verhältnis. ' + esc(TX('elkoHinweis'))), [4, 5]);
    /* 5 */
    add('zener', '5 Z-Diode', DRAW.z(n) +
      P('Eine <b>Z-Diode</b> hält in Sperrrichtung ihre Z-Spannung U_Z, solange genug Strom durch sie fließt. Der <b>Vorwiderstand</b> R_V begrenzt den Gesamtstrom I_ges = (U_ein − U_Z)/R_V. Die Last nimmt I_last = U_Z/R_last, der Rest fließt durch die Z-Diode: I_Z = I_ges − I_last.') +
      P(esc(exLine('zStrom', [12, 5.1, 470, 4700], ['U_ein', 'U_Z', 'R_V', 'R_last'])) + esc(pool('S2025-30')) + '. Gesamtstrom ' + esc(fe(s1.Iges, 'A')) + ', Laststrom ' + esc(fe(s1.Ilast, 'A')) + ', Verlustleistung der Z-Diode ' + esc(fe(s1.Pz, 'W')) + ', Wirkungsgrad nur ' + esc(pc(s1.eta, 1)) + ': Die Z-Diode eignet sich nur für kleine Ströme.') +
      P('<b>Kleinster Vorwiderstand</b> im Leerlauf, wenn die Z-Diode den ganzen Strom trägt: ' + esc(exLine('rvMin', [24, 12, 0.6], ['U_ein,max', 'U_Z', 'P_max'])) + esc(pool('F2020-N22')) + '. Zulässige Verlustleistung im Prüfstand: ' + esc(LT('pz_max')) + '.') +
      P('Fällt I_Z unter den Mindest-Z-Strom ' + esc(LT('iz_min')) + ', stabilisiert die Z-Diode nicht mehr. Beispiel mit R_last = ' + esc(fe(300, 'Ω')) + esc(ULAB) + ': ' + (n.st2 && n.st2.aktiv === false ? 'Der Laststrom (' + esc(fe(n.st2.Ilast, 'A')) + ') ist größer als der Gesamtstrom (' + esc(fe(n.st2.Iges, 'A')) + '), für die Z-Diode bleibt nichts übrig: Sie stabilisiert nicht mehr, die Ausgangsspannung bricht auf ' + esc(fe(n.st2.Uaus, 'V')) + ' ein.' : esc(DASH)) + ' Dynamischer Widerstand der Z-Diode: ' + esc(LT('rz')) + '.'), [6]);
    /* 6 */
    add('linear', '6 Linearregler: 7805, LM317, Verlustleistung', DRAW.linear(n) + DRAW.lm317(n) +
      P('Ein <b>Linearregler</b> hält die Ausgangsspannung konstant, indem er die überschüssige Spannung in Wärme umsetzt. Der <b>Festspannungsregler</b> 7805 liefert eine feste Ausgangsspannung (im Lab ' + esc(fe((n.fx14 || {}).Uaus, 'V')) + ', Datenblatt maßgeblich), der LM317 ist einstellbar.') +
      P('<b>Verlustleistung P_V = (U_ein − U_aus) · I:</b> ' + esc(exLine('pvLin', [14, 5, 0.6], ['U_ein', 'U_aus', 'I'])) + esc(pool('H2026-20')) + '. Wirkungsgrad: ' + esc(exLine('etaLin', [14, 5, 0.6], ['U_ein', 'U_aus', 'I'])) + ' (Ruhestrom vernachlässigt).') +
      P('<b>Dropout:</b> Der Regler braucht am Eingang mindestens die Ausgangsspannung plus den Dropout. Beim 7805 im Lab: Mindest-Eingangsspannung ' + esc(LT('umin_7805')) + ', Dropout ' + esc(LT('dropout_7805')) + '. Beispiel mit 6 V am Eingang' + esc(ULAB) + ': ' + esc(diag0(n.fx6))) +
      P('<b>LM317:</b> U_aus = 1,25 V · (1 + R2/R1) mit der Referenzspannung ' + esc(LT('uref_317')) + ' (Pool F2025-22, Adjust-Strom vernachlässigt). ' + esc(exLine('lm317', [240, 970], ['R1', 'R2'], { d: 3 })) + esc(pool('H2025-23')) + '.') +
      LI([esc(exLine('r2lm317', [9, 240], ['U_aus', 'R1'], { d: 0 })) + esc(pool('W2025-13')), '7805 durch LM317 ersetzen: ' + esc(exLine('r2lm317', [5, 240], ['U_aus', 'R1'], { d: 0 })) + esc(pool('W2025-B01')) + '. R1 liegt zwischen Ausgang und Adjust-Anschluss, R2 zwischen Adjust-Anschluss und Masse. Achtung: Beim LM317 liegt R1 oben (Ausgang → Adjust), beim Rückkopplungsteiler des Schaltreglers unten (nach Masse); die Formel bleibt gleich, nur die Lage von R1 und R2 ist vertauscht.', 'Mindestlaststrom ' + esc(LT('imin_317')) + ', Adjust-Strom ' + esc(LT('iadj_317')) + ', Dropout ' + esc(LT('dropout_317')) + '. ' + esc(TX('datenblatt'))]) +
      P('<b>Strombegrenzung</b> mit Messwiderstand und zweitem Transistor: Sobald die Spannung am Messwiderstand die Basis-Emitter-Schwelle ' + esc(LT('ube')) + ' erreicht, öffnet der zweite Transistor und nimmt dem Regler den Strom. ' + esc(exLine('strombegr', [0.6], ['R3'], { d: 2 })) + esc(pool('W2024-23')) + '. Im Kurzschluss fällt die ganze Eingangsspannung am Regler ab: P_V = ' + esc(fe((n.t2 || {}).PvKurz, 'W')) + ' bei ' + esc(fe(14, 'V')) + ' Eingang' + esc(ULAB) + '.'), [7, 8, 9]);
    /* 7 */
    add('kuehlung', '7 Wann Kühlung?', DRAW.therm(n) +
      P('Verlustleistung wird zu Wärme. Ab einer Schwelle weist das Lab auf die Kühlung hin: ' + esc(LT('pv_therm')) + '. Dieses Lab rechnet nur P_V und η. <b>Kühlkörper, Wärmewiderstand und Sperrschichttemperatur</b> rechnest du im Thermik-Lab. ' + esc(TX('datenblatt'))) +
      TB(['Beispiel (U_ein, I; U_aus = 5 V)', 'P_V', 'Quelle', 'Kühlungshinweis'], n.thermRows.map(r => [esc(r.l), '<b>' + esc(fe(r.v, 'W')) + '</b>', esc(r.q), fin(r.v) && fin(n.thermLim) ? (r.v >= n.thermLim ? 'ja: über der Schwelle' : 'nein: unter der Schwelle') : DASH])) +
      '<div class="tryit"><a class="btn" href="thmlab.html">🌡 Kühlung im Thermik-Lab</a></div>', [10]);
    /* 8 */
    add('schalt', '8 Schaltregler im Prinzip', KK() + DRAW.schalt() +
      P('Ein <b>Schaltregler</b> schaltet die Eingangsspannung schnell ein und aus. Eine <b>Drossel</b> speichert in der Einschaltphase Energie und gibt sie in der Ausschaltphase über die Freilaufdiode ab; der Ladekondensator glättet die Ausgangsspannung. Das <b>Tastverhältnis</b> D (Einschaltzeit durch Periodendauer) bestimmt die Ausgangsspannung.') +
      P('<b>Warum die Verluste klein sind:</b> Ein Schalter hat entweder fast keine Spannung (eingeschaltet) oder fast keinen Strom (ausgeschaltet). Dann ist das Produkt aus Spannung und Strom, also die Verlustleistung, klein. Ein Linearregler dagegen hat dauernd die Differenzspannung am Regler.') +
      P('Beispiel (12 V auf 5 V, 0,4 A): Linearregler ' + esc(exLine('pvLin', [12, 5, 0.4], ['U_ein', 'U_aus', 'I'])) + '; Schaltregler mit η = 88 %: ' + esc(exLine('pvSchalt', [12, 5, 0.4, 0.88], ['U_ein', 'U_aus', 'I', 'η'])) + '. Die Differenz beträgt ' + esc(fe((n.vs || {}).diff, 'W')) + esc(pool('W2023-09')) + '.') +
      P('Netzseitige Schaltnetzteile behandelt das Lab nur als Blockschaltbild und Begriff. Alle Prüfstände rechnen mit Gleichspannung am Eingang, Grenze ' + esc(LT('u_dc_max')) + '. ' + esc(TX('simOnly')) + ' ') + KK(), [11]);
    /* 9 */
    const dBuck = FR('dBuck', 12, 5);
    add('buck', '9 Tiefsetzsteller', DRAW.drossel(n) +
      P('Der <b>Tiefsetzsteller</b> erzeugt eine kleinere Ausgangsspannung: <b>D = U_aus / U_ein</b> (ideal, nicht lückend; im Pool nicht belegt, F17). ' + esc(exLine('dBuck', [12, 5], ['U_ein', 'U_aus'])) + esc(ULAB) + '.') +
      P('Der Drosselstrom ist ein Dreieck um den Mittelwert I_aus. Die <b>Drosselwelligkeit</b> <b>ΔI_L = (U_ein − U_aus) · D / (f · L)</b>: ' + esc(exLine('dIL', [12, 5, 1e5, 1e-4], ['U_ein', 'U_aus', 'f', 'L'])) + '. Bei I_aus = ' + esc(fe(b1.Iout, 'A')) + ' schwankt der Drosselstrom zwischen ' + esc(fe(b1.ILmin, 'A')) + ' und ' + esc(fe(b1.ILmax, 'A')) + '. Ausgangswelligkeit (Kapazitätsanteil): ' + esc(exLine('dUc', [12, 5, 1e5, 1e-4, 1e-4], ['U_ein', 'U_aus', 'f', 'L', 'C'])) + esc(ULAB) + '.') +
      P('Eine größere Drossel oder eine höhere Schaltfrequenz verkleinert ΔI_L. Kleinste Drossel für ΔI_L = 0,3 A: ' + esc(exLine('lMin', [12, 5, 1e5, 0.3], ['U_ein', 'U_aus', 'f', 'ΔI_L'])) + '. Als Lehrfaustwert legt das Lab die Drossel auf ΔI_L = ' + esc(LT('dil_ausleg')) + ' mal I_aus aus; die Ampel ist grün bis ΔI_L ' + esc(LT('dil_max')) + ' mal I_aus.') +
      P('<b>Lückbetrieb:</b> Unterhalb des Grenzstroms (' + esc(exLine('iKrit', [12, 5, 1e5, 1e-4], ['U_ein', 'U_aus', 'f', 'L'])) + ') fällt der Drosselstrom in jeder Periode auf 0 A, die Formel für D gilt dann nicht mehr (die Lückformel steht nur im Kern). Beispiel mit L = ' + esc(fe(1e-5, 'H')) + ' und I_aus = ' + esc(fe(b2.Iout, 'A')) + ': ' + esc(diag0(n.b2))) +
      TB(['Betrieb (12 V auf 5 V, 100 kHz, Übungsschaltung (A))', 'Drossel L', 'Ausgangsstrom', 'I_Lmin', 'I_Lmax'], [b1, b2].map(b => [b.ccm ? 'nicht lückend (CCM)' : 'lückend (DCM)', esc(fe(b.L, 'H')), esc(fe(b.Iout, 'A')), esc(fe(b.ILmin, 'A')), esc(fe(b.ILmax, 'A'))])), [11, 12]);
    /* 10 */
    const tpT = t => (t ? esc(t.grund) + ' ' + esc(t.gegenprobe || '') : DASH);
    add('topo', '10 Hochsetzsteller, Inverswandler, Sperrwandler', KK() + DRAW.topos(n) +
      P('Welche Grundschaltung du brauchst, hängt von der Aufgabe ab: <b>Tiefsetzsteller</b> (Ausgang kleiner), <b>Hochsetzsteller</b> (Ausgang größer), <b>Inverswandler</b> (umgekehrtes Vorzeichen) und <b>Sperrwandler</b> (Eingang und Ausgang getrennt). Alle Formeln gelten ideal und nicht lückend (im Pool nicht belegt, F17).') +
      TB(['Schaltung', 'Tastverhältnis', 'Beispiel (Übungsschaltung (A))'], n.topoRows.map(r => ['<b>' + esc(r.name) + '</b>', esc(r.expr), esc(r.v + ': D = ' + r.d)])) +
      P('Beim <b>Hochsetzsteller</b> ist der mittlere Drosselstrom größer als der Ausgangsstrom: I_L = I_aus/(1 − D) = ' + esc(fe((n.bo || {}).ILavg, 'A')) + ' bei I_aus = ' + esc(fe((n.bo || {}).Iout, 'A')) + ' und D = ' + esc(pc((n.bo || {}).D, 2)) + esc(ULAB) + '. ' + esc(diag0(n.bo))) +
      P('Beim <b>Inverswandler</b> ist die Ausgangsspannung negativ gegen Masse. Beispiel +5 V auf −12 V: D = ' + esc(pc((n.tp2 || {}).D, 2)) + esc(pool('W2024-09')) + '.') +
      P('Der <b>Sperrwandler</b> speichert die Energie im Übertrager mit Luftspalt und trennt Eingang und Ausgang galvanisch. Im Beispiel (Übersetzung n = N₂/N₁ = ' + esc(fz((n.fly || {}).n)) + ') gilt D = ' + esc(pc((n.fly || {}).D, 2)) + '. Netzseitige Sperrwandler zeigt das Lab nur als Blockschaltbild und Begriff. Die Streuinduktivität des Übertragers erzeugt Spannungsspitzen am Schalter (Dämpfungsglied, siehe EMV).') +
      P('<b>Welche Grundschaltung?</b> Der Kern begründet jede Wahl und prüft sie mit einer Gegenprobe:') + LI([tpT(n.tp1), tpT(n.tp2), tpT(n.tp3)]) + KK(), [13, 14, 15]);
    /* 11 */
    const lp = n.lp || {}, psw = (f) => FR('pSw', 12, 5, 1, f, 1e-4, LV('tsw'));
    add('verlust', '11 Wirkungsgrad und Schaltverluste', DRAW.verluste(n) +
      P('Der Wirkungsgrad folgt aus den Einzelverlusten: <b>η = P_ab / (P_ab + ΣP_V)</b>. Jede Verlustart hat ihre eigene Formel. Beispiel Tiefsetzsteller 12 V auf 5 V mit 1 A bei 100 kHz (Übungswerte (A): R_ds,on ' + esc(LF('rds_on')) + ', Schottky-Diode ' + esc(LF('uf_schottky')) + ', t_r + t_f ' + esc(LF('tsw')) + ', Q_g ' + esc(LF('qg')) + ', U_G ' + esc(LF('ug')) + ', R_L der Drossel ' + esc(LF('rl_dr')) + '):') +
      (Array.isArray(lp.parts) ? TB(['Verlustart', 'Formel', 'Wert (Übungswerte (A))', 'Hinweis'], lp.parts.map(x => ['<b>' + esc(x.name) + '</b>', esc(x.formel), esc(fe(x.w, 'W')), esc(x.text)]).concat([['<b>Summe ΣP_V</b>', 'η = P_ab / (P_ab + ΣP_V)', '<b>' + esc(fe(lp.sum, 'W')) + '</b>', 'Wirkungsgrad η = <b>' + esc(pc(lp.eta, 1)) + '</b>']])) : P('Die Verlustrechnung fehlt im Kern.')) +
      P('Der Schaltverlust wächst mit der Schaltfrequenz: bei ' + esc(fe(1e5, 'Hz')) + ' ist P_sw = ' + esc(fe(psw(1e5), 'W')) + ', bei ' + esc(fe(2e5, 'Hz')) + ' ' + esc(fe(psw(2e5), 'W')) + '. ' + esc(exLine('pGate', [LV('qg'), LV('ug'), 1e5], ['Q_g', 'U_G', 'f'])) + ': Der Gate-Verlust hängt nicht von der Last ab (Übungswerte (A)).') +
      P(fin(lp.etaSync) && fin(lp.etaDiode) ? 'Ersetzt du die Diode durch einen MOSFET (<b>Synchrongleichrichter</b>), ' + (lp.etaSync > lp.etaDiode ? 'steigt' : 'ändert sich') + ' der Wirkungsgrad von ' + esc(pc(lp.etaDiode, 1)) + ' auf ' + esc(pc(lp.etaSync, 1)) + ' (Rechnung des Labs, Übungswerte (A)).' : 'Der Vergleich mit dem Synchrongleichrichter fehlt im Kern.') +
      P('Zum Vergleich der Linearregler am selben Punkt: ' + esc(exLine('etaLin', [12, 5, 1], ['U_ein', 'U_aus', 'I'])) + ULAB + '.'), [16, 17]);
    /* 12 */
    const g1 = n.g1 || {}, g2 = n.g2 || {};
    add('gate', '12 Gate-Ansteuerung', DRAW.gate(n) +
      P('Ein <b>MOSFET</b> als Schalter wird über das Gate geschaltet. Die Treiberspannung U_G lädt die Gate-Kapazität über den Gate-Widerstand R_g. Beim Einschalten bleibt die Gate-Spannung eine Weile auf dem <b>Miller-Plateau</b>, während die Drain-Spannung fällt: Das dauert die Schaltzeit t_sw.') +
      P('Mit U_G = ' + esc(LT('ug')) + ', R_g = ' + esc(LT('rg')) + ' und Q_gd = ' + esc(LT('qgd')) + ' fließt zu Beginn ' + esc(fe(g1.Ig_peak, 'A')) + ', auf dem Plateau ' + esc(fe(g1.Ig_plateau, 'A')) + ', und die Schaltzeit beträgt t_sw = ' + esc(fe(g1.t_sw * 1e-9, 's')) + ' (Modell, Plateau ' + esc(LT('uplat')) + '). ' + esc(TX('datenblatt'))) +
      P('Mit R_g = ' + esc(fe(g2.Rg, 'Ω')) + ' schaltet der MOSFET ' + (fin(g2.t_sw) && fin(g1.t_sw) ? (g2.t_sw > g1.t_sw ? 'langsamer' : 'nicht langsamer') : DASH) + ': t_sw = ' + esc(fe(g2.t_sw * 1e-9, 's')) + ' (Übungswerte (A)). Das bringt weniger Störung, aber mehr Schaltverlust: ' + esc((n.gsw || {}).text || DASH)) +
      P('<b>Gate-Verlust:</b> ' + esc(exLine('pGate', [LV('qg'), LV('ug'), 1e5], ['Q_g', 'U_G', 'f'])) + ' (Übungswerte (A)).') +
      P('<b>Zu kleine Gate-Spannung</b> (Übungswerte (A)): ' + esc(diag0(n.gBad))) +
      P('<b>Halbbrücke</b> (Beispiel mit Übungswerten (A)): Beide Schalter dürfen nie gleichzeitig leiten, sonst entsteht ein Kurzschluss der Versorgung (Querstrom). Dazwischen liegt die <b>Totzeit</b>. ' + esc(diag0(n.dt1)) + (n.dt2 && n.dt2.querstrom === false ? ' Mit ' + esc(fe(n.dt2.tot, 's')) + ' Totzeit gibt es keine Überlappung mehr.' : '') + ' Bootstrap und High-Side-Treiber sind hier nur Begriffe.'), [18, 19]);
    /* 13 */
    const sp1 = n.stp1 || {}, sp2 = n.stp2 || {};
    add('regel', '13 Rückkopplung und Regelkreis', DRAW.loop(n) +
      P('Der Regelkreis hält die Ausgangsspannung konstant: Der Teiler R1, R2 bildet aus U_aus eine Messspannung, der Fehlerverstärker vergleicht sie mit der Referenz U_ref, und der Schaltregler stellt das Tastverhältnis nach (PWM). Im Gleichgewicht gilt <b>U_aus = U_ref · (1 + R2/R1)</b> (Pool W2023-07, Referenz ' + esc(LT('uref_317')) + ').') +
      P('Beispiel: R1 = ' + esc(fe((n.dv || {}).R1, 'Ω')) + ' (nach Masse) und U_aus = ' + esc(fe((n.dv || {}).Uaus, 'V')) + ' verlangen R2 = <b>' + esc(fe((n.dv || {}).R2, 'Ω')) + '</b> (R2 liegt zum Ausgang)' + esc(pool('W2023-07')) + '.') +
      P('<b>Achtung (Lehrmodell):</b> Beim LM317 liegt R1 oben (Ausgang → Adjust), beim Rückkopplungsteiler des Schaltreglers unten (nach Masse). Die Formel bleibt gleich, nur die Lage von R1 und R2 ist vertauscht.') +
      LI(['R1 offen: ' + esc(diag0(n.dvR1)), 'R2 offen: ' + esc(diag0(n.dvR2))]) +
      P('Bei einem Lastsprung bricht die Ausgangsspannung kurz ein, der Regler stellt sie nach. Das Lab zeigt das mit einem Lehrmodell (Übungswerte (A), F11, nur Ampelaussage): bei Verstärkung ' + esc(LT('loop_vr')) + ' beträgt das Überschwingen ' + esc(sp1.ueberText || DASH) + ', die Phasenreserve ' + esc(fin(sp1.pm) ? ff(sp1.pm, 0) + ' °' : DASH) + '. Mit Verstärkung ' + esc(LT('loop_vr_schwing')) + ' ohne Kompensation ' + (sp2.schwingt === true ? 'schwingt der Kreis (Phasenreserve ' + esc(fin(sp2.pm) ? ff(sp2.pm, 0) + ' °' : DASH) + ')' : sp2.schwingt === false ? 'schwingt der Kreis nicht' : esc(DASH)) + '.') +
      P('Begriffe wie Regelabweichung und Stellgröße erklärt das <a href="reglab.html">Regelungstechnik-Lab</a>; dieses Lab legt keine Regler aus.'), [20]);
    /* 14 */
    add('labor', '14 Labornetzteil, Strombegrenzung, CV und CC', DRAW.cvcc(n) +
      P('Ein <b>Labornetzteil</b> regelt wahlweise die Spannung (<b>CV</b>, Konstantspannung) oder den Strom (<b>CC</b>, Konstantstrom). Der Übergang liegt beim <b>Grenzwiderstand R_krit = U_set / I_set</b>: ' + esc(exLine('rKrit', [12, 1], ['U_set', 'I_set'])) + esc(ULAB) + '. Ab R_krit abwärts, bei kleinerem Lastwiderstand, arbeitet das Gerät im CC.') +
      TB(['Lastwiderstand', 'Betrieb', 'U_aus', 'I_aus (U_set 12 V, I_set 1 A, Übungsschaltung (A))'], n.cv.map(c => (c ? [esc(fe(c.Rlast, 'Ω')), '<b>' + esc(c.modus) + '</b>', esc(fe(c.Uout, 'V')), esc(fe(c.Iout, 'A'))] : [DASH, DASH, DASH, DASH]))) +
      P('Die Strombegrenzung im Linearteil arbeitet mit einem Messwiderstand: <b>I_lim = U_BE / R_s</b>, ' + esc(exLine('strombegr', [0.6], ['R_s'], { d: 2 })) + esc(pool('W2024-23')) + '; Leistung am Messwiderstand ' + esc(fe((n.ilim || {}).P, 'W')) + '.') +
      P('Im Kurzschluss arbeitet das Gerät im CC. Bei einem Linearregler im Leistungsteil wird dann P_V = U_ein · I_set zu Wärme: ' + esc(fe((n.short || {}).PvRegler, 'W')) + ' bei ' + esc(fe(14, 'V')) + ' Eingang und ' + esc(fe(1, 'A')) + ' Begrenzung' + esc(ULAB) + '. Die Kühlung rechnest du im Thermik-Lab.'), [21, 22]);
    /* 15 */
    const pathNames = n.path && Array.isArray(n.path.steps) ? n.path.steps : [];
    const cAus = n.cAus && Array.isArray(n.cAus.messpunkte) ? n.cAus.messpunkte.filter(p => p && p.sollText !== p.istText) : [];
    add('fehler', '15 Fehlersuche am Netzteil', KK() + DRAW.baum(n) +
      P('Bei der Fehlersuche gehst du nach Symptom und in fester Reihenfolge vor. Die Fehlersuche im Lab findet an einem <b>freigeschalteten</b> Gerät in der Simulation statt. Alle Messpunkte sind <b>simuliert</b>, sie liegen auf der Sekundär- und Gleichspannungsseite. Die fünf Sicherheitsregeln stehen im <a href="elslab.html">Sicherheits-Lab</a>.') +
      P('<b>Empfohlene Prüfreihenfolge</b> (eine falsche Reihenfolge erklärt das Lab, es verbietet sie nicht):') +
      (pathNames.length ? stepsSvg('Prüfreihenfolge der Fehlersuche: ' + pathNames.map(s => s.name).join(', '), pathNames.map(s => s.name + ': weil ' + s.warum)) : P('Die Prüfreihenfolge fehlt im Kern.')) +
      (n.cat.length ? TB(['Fehler im Katalog (Simulation)', 'Symptom', 'Stufe', 'Ursache im Modell'], n.cat.map(f => ['<b>' + esc(f.name) + '</b>', esc(f.symptom), esc(faultStufe(st, f.stufe)), esc(f.ursache)])) : P('Der Fehlerkatalog fehlt im Kern.')) +
      (n.cAus && cAus.length ? P('Beispiel „' + esc(n.cAus.name) + '“ (simuliert, Lehrmodell): ' + cAus.map(p => esc(p.name) + ' Soll ' + esc(p.sollText) + ', Ist ' + esc(p.istText)).join('; ') + '.') : '') +
      P(esc(TX('elkoHinweis')) + ' Das Lab ist keine Reparaturanleitung; es übt das Denken in Messpunkten und Ursachen.') + KK(), [23]);
    /* 16 */
    add('emv', '16 Schaltregler und EMV', DRAW.emv(n) +
      P('Ein Schaltregler schaltet Spannungen und Ströme in Nanosekunden. Die schnellen Flanken, die Schleifenfläche des Schaltstroms und das Streufeld der Drossel strahlen und leiten Störungen aus. Das Lab zeigt nur, <b>dass</b> das so ist.') +
      P('Ein LC-Tiefpass am Ausgang dämpft Störungen oberhalb seiner Grenzfrequenz: <b>f₀ = 1 / (2π · √(L · C))</b>, ' + esc(exLine('grenzf', [220e-6, 100e-9], ['L', 'C'])) + esc(pool('S2020-N26')) + '.') +
      P(esc((n.gsw || {}).text || DASH)) +
      P('Filterauslegung und Spektren gehören ins EMV-Lab.') + '<div class="tryit"><a class="btn" href="emvlab.html">📡 Entstörung im EMV-Lab</a></div>', [24]);
    add('formeln', '17 Formelsammlung und Grenzwerte', formulaTableHtml() + P('<b>Alle Grenzwerte und Übungswerte des Labs</b> aus einer Tabelle (✓ belegt: Quelle im Prüfungspool oder vom Ausbilder; Übungswert (A): Ausbilder gleicht ab). ' + esc(TX('datenblatt'))) + limitTableHtml(), [25]);
    add('glossar', '18 Glossar', glossaryHtml(), null);
    add('tasten', '19 Tastenkürzel', keysTableHtml(api), null);
    return out;
  }

  const exampleExists = id => { const d = root.NTS_DATA, a = d && d.examples; return !!(Array.isArray(a) && a.some(x => x && x.id === id)); };
  X.help = X.help || {};
  X.help.render = function (host, api) {
    if (!host) return; api = api || {}; host.__ntsApi = api;
    if (typeof document !== 'undefined' && document.getElementById && !document.getElementById('nts-help-css')) { const s = document.createElement('style'); s.id = 'nts-help-css'; s.textContent = CSS; document.head.appendChild(s); }
    if (!CORE()) { host.innerHTML = `<div class="card pl"><p class="big">Lernen wird geladen</p><p class="hint2">Der Rechenkern ist nicht geladen (ntscore.js fehlt). Ohne ihn gibt es hier keine Zahlen und Tabellen.</p><div class="btns"><button class="btn" data-retry>Erneut prüfen</button></div></div>`; return; }
    const secs = sections(api);
    host.innerHTML = `<div class="card pl"><h4>Lernen</h4><p class="hint2" style="margin:0">Netzteile und Schaltregler, kurz erklärt. Jeder Abschnitt mit Versuch hat einen Knopf „Probier es aus“, der den passenden Prüfstand lädt. Alle Zahlen stammen aus derselben Rechnung wie im Rechner; Übungswerte tragen das Zeichen „Übungswert (A)“. ${esc(TX('simOnly'))}</p></div><div class="hl">` +
      secs.map((s, i) => `<details${i === 0 ? ' open' : ''} data-sec="${esc(s.id)}"><summary>${esc(s.title)}</summary><div class="hb2">${s.html}</div></details>`).join('') + '</div>';
    /* Zähler ntslern1 (Abzeichen "ntsblock": Abschnitt 1 steht beim Aufruf des Tabs offen und wird damit angezeigt) */
    try { if (api.stat && secs[0] && /^1/.test(secs[0].title)) api.stat('ntslern1', 1, 'max'); } catch (e) { /* Zähler ist freiwillig */ }
    if (!host.addEventListener) return;
    once(host, 'help', 'click', e => {
      const b = e.target && e.target.closest && e.target.closest('[data-try]'); if (!b) return; const t = TRY[+b.dataset.try]; if (!t) return; const a = host.__ntsApi || {};
      if (t.tab) { if (a.setTab) a.setTab(t.tab); return; }
      let ok = false; if (t.ex && a.loadExample && exampleExists(t.ex)) ok = a.loadExample(t.ex) !== false;
      if (!ok && a.loadRig) a.loadRig({ rig: t.rig, controls: presetControls(t.rig, t.preset) || undefined, name: 'Probier es aus', toast: 'Geladen: ' + (t.label || t.rig) });
    });
  };
  X.help.fn = { nums, sections, FM, FR, LV, LT, TX, limOf, limVal, limStat, exLine, stufen, rigBilanz, presetControls, formulaRows, formulaTableHtml, glossaryRows, glossaryHtml, keyRows, keysTableHtml, limitRows, limitTableHtml, svgTextCheck, DRAW, TRY, wrap, stepsSvg, SCALE390, exampleExists, STUF_ORDER, PFLICHT };
  if (typeof module !== 'undefined') module.exports = X.help;
})(typeof window !== 'undefined' ? window : globalThis);
