'use strict';
/* Tonfunk Regelungstechnik-Lab: Tab "Lernen" (WP3b).
   14 ausklappbare Abschnitte mit SVG-Zeichnungen und "Probier es aus"-Knopf. Tabellen, Zahlen und Kurven kommen aus dem Kern (REG_CORE) und den Tabellen des Labs:
   Einstellregeln aus rules (über apply abgefragt, also immer gleich wie der Rechner), Glossar aus glossary, Tastenkürzel aus KEYS (regui.js), Skalierung aus scale, Schaltspiele aus twoPoint,
   Kurven aus stepResponse, ultimate, fitStep, stepMetrics und den Kern-Bausteinen plant/controller. Es gibt keine zweite Pflege von Formeln oder Tabellen (SPEC Regel 5 und 7).
   Schnittstelle (SPEC 6.8): window.REG_UI_EXT.help.render(host, api); api.KEYS (Erweiterung) liefert die Tastenkürzel-Tabelle, sonst window.REG_KEYS. */
(function (root) {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fin = v => typeof v === 'number' && isFinite(v);
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const CORE = () => root.REG_CORE;
  const fnum = (v, d) => (fin(v) ? (+v).toFixed(d == null ? 1 : d).replace('.', ',') : '–');
  const adig = v => { v = Math.abs(v); return v >= 100 ? 0 : v >= 10 ? 1 : v >= 1 ? 2 : v >= 0.1 ? 3 : 4; };
  const fauto = v => (fin(v) ? fnum(v, adig(v)) : '–');
  const NOZ = '<p class="hint2" style="color:var(--warn)">Die Zahlen folgen, sobald der Rechenkern (regcore.js) geladen ist.</p>';
  const pick = (o, keys) => { if (typeof o === 'number') return o; if (!o || typeof o !== 'object') return NaN; for (const k of keys) if (fin(o[k])) return o[k]; return NaN; };

  /* ============================================================ SVG-Helfer */
  const SV = (inner, label, vb) => `<svg class="dr" viewBox="${vb || '0 0 360 200'}" role="img" aria-label="${esc(label)}">${inner}</svg>`;
  const TX = (x, y, t, o) => `<text x="${x}" y="${y}" fill="${(o && o.c) || '#e8ecf0'}" font-size="${(o && o.s) || 12}" text-anchor="${(o && o.a) || 'middle'}" font-family="system-ui"${o && o.w ? ' font-weight="700"' : ''}>${esc(t)}</text>`;
  function niceTick(range, n) { n = n || 8; const raw = range / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag; return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag; }
  function plot(o) {
    const E = root.REG_UI_EXT; if (E && typeof E.svgPlot === 'function') return E.svgPlot(o);
    const W = 360, H = o.h || 170, L = 38, R = 10, T = 10, B = 26, pw = W - L - R, ph = H - T - B, X = v => L + pw * (v - o.xMin) / (o.xMax - o.xMin), Y = v => T + ph * (1 - (v - o.yMin) / (o.yMax - o.yMin));
    let g = `<rect x="${L}" y="${T}" width="${pw}" height="${ph}" fill="none" stroke="#4a5663"/>`;
    (o.hlines || []).forEach(l => { g += `<line x1="${L}" y1="${Y(l.y).toFixed(1)}" x2="${L + pw}" y2="${Y(l.y).toFixed(1)}" stroke="${l.color || '#ffb340'}" stroke-dasharray="5 4"/>`; });
    (o.series || []).forEach(s => { g += `<polyline points="${s.pts.filter(p => fin(p[0]) && fin(p[1])).map(p => X(p[0]).toFixed(1) + ',' + clamp(Y(p[1]), T - 4, T + ph + 4).toFixed(1)).join(' ')}" fill="none" stroke="${s.color || '#3b9eff'}" stroke-width="2.2"${s.dash ? ` stroke-dasharray="${s.dash}"` : ''}/>`; });
    g += TX(L + pw / 2, H - 4, o.xLabel || '', { s: 10, c: '#8d99a6' });
    return SV(g, o.label || 'Diagramm', `0 0 ${W} ${H}`);
  }
  const dn = (pts, k) => pts.filter((_, i) => i % k === 0);

  /* ============================================================ Rechnungen für Zeichnungen und Zahlen (alle über den Kern) */
  function response(blocks, tEnd) { const C = CORE(); if (!C || typeof C.stepResponse !== 'function') return null; let r; try { r = C.stepResponse(blocks, tEnd, tEnd / 1200); } catch (e) { r = null; } return r && Array.isArray(r.t) && r.t.length > 5 ? r : null; }
  function fitOf(r) { const C = CORE(); if (!r || !C || typeof C.fitStep !== 'function') return null; let f; try { f = C.fitStep(r.t, r.x, 1, {}); } catch (e) { f = null; } return f && f.ok !== false ? f : null; }
  function ctrlResp(type, v) {
    const C = CORE(); if (!C || typeof C.controller !== 'function') return null; const h = v.tEnd / 300;
    let c; try { c = C.controller({ type, Kp: v.Kp, Tn: v.Tn || 10, Tv: v.Tv || 0, N: 10, Ta: h, u0: 0, ymin: -1e9, ymax: 1e9, aw: 'aus', dOn: 'e', dir: 'direkt' }, h); } catch (e) { return null; }
    if (!c || c.ok === false || typeof c.step !== 'function') return null; const t = [], y = []; for (let k = 0; k <= 300; k++) { t.push(k * h); y.push(c.step(k === 0 ? 0 : v.e, 0)); } return { t, y, h };
  }
  /* Regelkreis mit Kern-Strecke und Kern-Regler; seq: Sollwertsprung bei t0 (und Störung am Streckeneingang bei tz) */
  function loop(blocks, ctrl, o) {
    const C = CORE(); if (!C || typeof C.plant !== 'function' || typeof C.controller !== 'function') return null; const h = o.T / 1500, t = [], x = [], y = [];
    let P, K; try { P = C.plant({ blocks, op: { y: 50, x: 50 }, zIn: 1 }, h); K = C.controller(Object.assign({ Ta: h, u0: 50, ymin: 0, ymax: 100, N: 10, dOn: 'x', aw: 'klemmen', dir: 'direkt', Tn: 10, Tv: 0 }, ctrl), h); } catch (e) { return null; }
    if (!P || !K || K.ok === false || typeof K.step !== 'function') return null; let xx = 50;
    for (let k = 0; k <= 1500; k++) { const tt = k * h, w = tt >= o.t0 ? 50 + (o.dw || 0) : 50, z = o.tz != null && tt >= o.tz ? o.dz : 0, yy = K.step(w, xx); xx = P.step(yy, z); t.push(tt); x.push(xx); y.push(yy); }
    return { t, x, y, h };
  }
  const PT3 = [{ t: 'K', K: 1 }, { t: 'PT1', T: 10 }, { t: 'PT1', T: 5 }, { t: 'PT1', T: 2 }];
  const PT1 = (K, T) => [{ t: 'K', K }, { t: 'PT1', T }];
  const RAWMAX = 27648, MA_BAD = 3.5;
  const nz = v => String(+(+v).toPrecision(6)).replace('.', ',');
  const tList = bl => { const a = bl.filter(b => b.t === 'PT1').map(b => nz(b.T) + ' s'); return a.slice(0, -1).join(', ') + ' und ' + a[a.length - 1]; };
  const ksOf = bl => bl.filter(b => b.t === 'K').reduce((p, b) => p * b.K, 1);

  /* ---- Einstellregeln: Faktoren je Methode und Reglerart, über rules.apply mit Einheitswerten abgefragt (gleiche Quelle wie der Rechner) ---- */
  const MTHD = [['zn-schwing', 'Ziegler-Nichols (Schwingversuch)'], ['zn-sprung', 'Ziegler-Nichols (Sprungantwort)'], ['chr-fuehr-0', 'CHR Führung, aperiodisch'], ['chr-fuehr-20', 'CHR Führung, 20 % Überschwingen'], ['chr-stoer-0', 'CHR Störung, aperiodisch'], ['chr-stoer-20', 'CHR Störung, 20 % Überschwingen'], ['tsumme', 'T-Summe (Betragsoptimum)']];
  const BASES = { 'zn-schwing': ['Kkrit', 'Tkrit', 'Tkrit'], 'zn-sprung': ['Tg/(Ks·Tu)', 'Tu', 'Tu'], 'chr-fuehr-0': ['Tg/(Ks·Tu)', 'Tg', 'Tu'], 'chr-fuehr-20': ['Tg/(Ks·Tu)', 'Tg', 'Tu'], 'chr-stoer-0': ['Tg/(Ks·Tu)', 'Tu', 'Tu'], 'chr-stoer-20': ['Tg/(Ks·Tu)', 'Tu', 'Tu'], tsumme: ['T1/(Ks·TΣk)', 'T1', 'T2'] };
  function methodName(id) { const C = CORE(), t = C && C.rules && C.rules.table, e = Array.isArray(t) ? t.find(x => x && x.id === id) : (t && t[id]); return (e && (e.name || e.title)) || (MTHD.find(m => m[0] === id) || [])[1] || id; }
  function applyK(id, k, type) { const C = CORE(); try { return C.rules.apply(id, k, type); } catch (e) { return { ok: false }; } }
  function factorTable() {
    const C = CORE(); if (!C || !C.rules || typeof C.rules.apply !== 'function') return null; const out = [];
    MTHD.forEach(([id]) => {
      const rows = [];
      ['P', 'PI', 'PID'].forEach(type => {
        const isT = id === 'tsumme', pidT = isT && type === 'PID';
        /* zwei Abfragen mit verschiedenen Kennwerten: stimmen die Faktoren überein, ist die Bezugsgröße bestätigt */
        const k1 = isT ? { Ks: 1, T1: 1, TsumKlein: pidT ? 1.2 : 1, T2: pidT ? 0.2 : undefined, Tu: undefined } : { Ks: 1, Tu: 1, Tg: 2, Kkrit: 1, Tkrit: 1 };
        const k2 = isT ? { Ks: 2, T1: 3, TsumKlein: pidT ? 2.4 : 2, T2: pidT ? 0.4 : undefined } : { Ks: 2, Tu: 1.5, Tg: 6, Kkrit: 2, Tkrit: 3 };
        const r1 = applyK(id, k1, type), r2 = applyK(id, k2, type);
        if (!r1 || !r1.ok || !r2 || !r2.ok) { rows.push({ type, ok: false, why: (r1 && r1.why) || '' }); return; }
        const base = (k, kk) => { if (id === 'zn-schwing') return [k.Kkrit, k.Tkrit, k.Tkrit]; if (isT) return [k.T1 / (k.Ks * (pidT ? k.TsumKlein - k.T2 : k.TsumKlein)), k.T1, k.T2]; const kpb = k.Tg / (k.Ks * k.Tu); const B = BASES[id]; return [kpb, B[1] === 'Tg' ? k.Tg : k.Tu, B[2] === 'Tg' ? k.Tg : k.Tu]; };
        const b1 = base(k1), b2 = base(k2), f = (v, b) => (v == null ? null : v / b), same = (a, b) => (a == null && b == null) || (a != null && b != null && Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a)));
        const kp = [f(r1.Kp, b1[0]), f(r2.Kp, b2[0])], tn = [f(r1.Tn, b1[1]), f(r2.Tn, b2[1])], tv = [f(r1.Tv, b1[2]), f(r2.Tv, b2[2])];
        rows.push({ type, ok: true, kp: kp[0], tn: tn[0], tv: tv[0], kpOk: same(kp[0], kp[1]), tnOk: same(tn[0], tn[1]), tvOk: same(tv[0], tv[1]) });
      });
      out.push({ id, name: methodName(id), bases: BASES[id], rows });
    });
    return out;
  }
  const fac = (f, b, okf) => (f == null ? '–' : okf === false ? 'siehe Rechner' : (Math.abs(f - 1) < 1e-9 ? '' : fnum(f, Math.abs(f * 100 - Math.round(f * 100)) < 1e-6 ? 2 : 3) + ' · ') + b);
  /* Tabelle der Einstellregeln direkt aus REG_CORE.rules.table lesen: [{id,name,rows:{P:{Kp:{k,of,label?,alt?},Tn,Tv},…}}]; Zelltext über rules.expr(cell) */
  const isCell = c => c && typeof c === 'object' && fin(c.k) && typeof c.of === 'string';
  function tableFromCore() {
    const C = CORE(), T = C && C.rules && C.rules.table; if (!Array.isArray(T)) return null; const out = [];
    for (const m of T) {
      if (!m || !m.rows || typeof m.rows !== 'object') return null; const rows = [];
      for (const type of ['P', 'PI', 'PID']) { const r = m.rows[type]; if (!r) continue; if (!(isCell(r.Kp)) || (r.Tn != null && !isCell(r.Tn)) || (r.Tv != null && !isCell(r.Tv))) return null; rows.push({ type, kp: r.Kp, tn: r.Tn || null, tv: r.Tv || null }); }
      out.push({ id: m.id, name: m.name || methodName(m.id), rows });
    }
    return out;
  }
  function cellText(c) {
    if (!c) return '–'; const C = CORE(); let t = ''; if (C && C.rules && typeof C.rules.expr === 'function') { try { t = C.rules.expr(c); } catch (e) { t = ''; } }
    if (typeof t === 'string' && t) return t; return (Math.abs(c.k - 1) < 1e-9 ? '' : fnum(c.k, Math.abs(c.k * 100 - Math.round(c.k * 100)) < 1e-6 ? 2 : 3) + ' · ') + c.of;
  }
  function rulesTableHtml() {
    const T = tableFromCore();
    if (T) return '<table><tr><th>Methode</th><th>Regler</th><th>Kp</th><th>Tn</th><th>Tv</th></tr>' + T.map(m => m.rows.map((r, i) => '<tr>' + (i === 0 ? '<td rowspan="' + m.rows.length + '"><b>' + esc(m.name) + '</b></td>' : '') + '<td>' + r.type + '</td><td>' + esc(cellText(r.kp)) + '</td><td>' + esc(cellText(r.tn)) + '</td><td>' + esc(cellText(r.tv)) + '</td></tr>').join('')).join('') + '</table>';
    const F = factorTable(); if (!F) return NOZ;
    return '<table><tr><th>Methode</th><th>Regler</th><th>Kp</th><th>Tn</th><th>Tv</th></tr>' + F.map(m => m.rows.map((r, i) => '<tr>' + (i === 0 ? '<td rowspan="' + m.rows.length + '"><b>' + esc(m.name) + '</b></td>' : '') + '<td>' + r.type + '</td>' + (r.ok ? '<td>' + esc(fac(r.kp, m.bases[0], r.kpOk)) + '</td><td>' + esc(fac(r.tn, m.bases[1], r.tnOk)) + '</td><td>' + esc(fac(r.tv, m.bases[2], r.tvOk)) + '</td>' : '<td colspan="3" class="hint2">gibt es nicht</td>') + '</tr>').join('')).join('') + '</table>';
  }
  /* ============================================================ Abschnitte */
  function svgPlan() {
    const bx = (x, y, w, h, t, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="#2c343e" stroke="${c || '#8d99a6'}" stroke-width="1.8"/>${TX(x + w / 2, y + h / 2 + 4, t, { s: 11.5 })}`;
    return SV(`<g stroke="#8d99a6" stroke-width="2" fill="none"><path d="M14 80H46M74 80H96M158 80H178M240 80H258M312 80H346M330 80V150H152M152 150V104M60 44V66M60 66"/></g>
      <circle cx="60" cy="80" r="14" fill="#222830" stroke="#8d99a6" stroke-width="2"/>${TX(60, 84, 'Σ', { s: 14, w: 1 })}${TX(70, 62, '+', { s: 12, c: '#4cd964', a: 'start' })}${TX(70, 108, '−', { s: 14, c: '#ff8a7a', a: 'start' })}
      ${bx(96, 58, 62, 44, 'Regler', '#3b9eff')}${bx(178, 58, 62, 44, 'Stellglied')}${bx(258, 58, 54, 44, 'Strecke', '#ffb340')}${bx(116, 120, 72, 30, 'Messglied')}
      ${TX(30, 72, 'w', { s: 15, w: 1, c: '#ffb340' })}${TX(84, 72, 'e', { s: 13, w: 1 })}${TX(168, 72, 'y', { s: 13, w: 1 })}${TX(338, 72, 'x', { s: 15, w: 1, c: '#7fbaff' })}${TX(285, 36, 'z', { s: 15, w: 1, c: '#ff8a7a' })}<path d="M285 40V58" stroke="#ff8a7a" stroke-width="2" fill="none"/>${TX(180, 190, 'geschlossener Wirkungskreis: x wird zurückgeführt und mit w verglichen', { s: 10, c: '#8d99a6' })}`, 'Wirkungsplan eines Regelkreises mit w, e, y, z und x');
  }
  /* Glossar: REG_CORE.glossary = { items:[{id,symbol,term,article,alt,unit,text}] } (oder Feld/Wörterbuch) */
  function glItems() { const g = CORE() && CORE().glossary; if (!g) return null; const a = Array.isArray(g) ? g : Array.isArray(g.items) ? g.items : Object.keys(g).filter(k => g[k] && typeof g[k] === 'object' && !Array.isArray(g[k])).map(k => Object.assign({ id: k }, g[k])); return a.filter(e => e && typeof e === 'object'); }
  const gl = id => { const a = glItems(); return a ? a.find(e => e.id === id || e.symbol === id) || null : null; };
  function glossaryRows() {
    const a = glItems(); if (!a) return null;
    return a.map(e => ({ symbol: e.symbol || e.sym || e.id || '', name: (e.article ? e.article + ' ' : '') + (e.term || e.name || e.begriff || '') + (e.alt ? ' (' + e.alt + ')' : ''), unit: e.unit || e.einheit || '', text: e.text || e.explain || e.erklaerung || e.desc || '' }));
  }
  const entry = (id) => { const e = gl(id); return e ? `<tr><td><b>${esc(e.symbol || id)}</b></td><td>${esc((e.article ? e.article + ' ' : '') + (e.term || e.name || ''))}${e.alt ? ' (' + esc(e.alt) + ')' : ''}</td></tr>` : ''; };

  function secPlants() {
    const C = CORE(); if (!C) return NOZ;
    const defs = [['Mit Ausgleich (P-Strecke)', [{ t: 'K', K: 1.5 }, { t: 'PT1', T: 10 }], 60, '#3b9eff'], ['Ohne Ausgleich (I-Strecke)', [{ t: 'I', Ki: 0.05 }], 60, '#4cd964'], ['Mit Totzeit', [{ t: 'K', K: 1 }, { t: 'PT1', T: 10 }, { t: 'Tt', Tt: 8 }], 60, '#ffb340']];
    let h = '', note = '';
    defs.forEach(([nm, bl, T, col]) => { const r = response(bl, T); if (!r) return; const hi = Math.max(...r.x) * 1.08; h += `<div class="fig"><b>${esc(nm)}</b>${plot({ series: [{ pts: dn(r.t.map((t, i) => [t, r.x[i]]), 4), color: col }], xMin: 0, xMax: T, yMin: 0, yMax: hi, xLabel: 'Zeit in s nach dem Sprung der Stellgröße um 1 %', yLabel: 'x', h: 130, label: 'Sprungantwort: ' + nm })}</div>`; });
    const r1 = response([{ t: 'K', K: 1 }, { t: 'PT1', T: 10 }], 60);
    if (r1) { const TT = 10, i = Math.max(1, r1.t.findIndex(t => t >= TT - 1e-9)), f = (TT - r1.t[i - 1]) / (r1.t[i] - r1.t[i - 1]), vT = r1.x[i - 1] + f * (r1.x[i] - r1.x[i - 1]), fr = vT / r1.x[r1.x.length - 1]; note = `<p>Bei einer Strecke mit einem Speicher (PT1) erreicht die Sprungantwort nach einer Zeitkonstante T (hier T = ${TT} s) <b>${fnum(fr * 100, 0)} %</b> des Endwerts (Endwert nach ${fnum(r1.t[r1.t.length - 1], 0)} s).</p>`; }
    return `<p>Die <b>Regelstrecke</b> ist der Teil der Anlage, in dem die Regelgröße entsteht. Wie sie auf eine Änderung der Stellgröße antwortet, zeigt die <b>Sprungantwort</b>. Alle Zeiten stehen hier in Prozess-Sekunden.</p>${h}${note}
      <ul><li><b>Mit Ausgleich (P-Strecke):</b> Die Regelgröße läuft auf einen festen Endwert zu. Das Verhältnis <b>Ks = Δx / Δy</b> (Streckenverstärkung, beide in % des Bereichs) beschreibt ihn. Beispiele: Temperatur, Füllstand mit Auslauf, Drehzahl.</li>
      <li><b>Ohne Ausgleich (I-Strecke):</b> Die Regelgröße steigt dauernd weiter, solange die Stellgröße anliegt. Beispiele: Position einer Spindelachse, ein Tank ohne Abfluss.</li>
      <li><b>Verzögerung (PT1, PT2, PTn):</b> Jeder Speicher (Wärme, Masse, Volumen) verzögert die Antwort. Mehrere Speicher hintereinander ergeben eine S-förmige Kurve.</li>
      <li><b>Totzeit Tt:</b> Eine Strecke antwortet erst nach einer Wartezeit, zum Beispiel weil das Heizwasser durchs Rohr fließen muss. Totzeit macht das Regeln schwer.</li>
      <li><b>Arbeitspunkt:</b> Viele Strecken sind nicht linear. Beim Tank mit Düse ändert sich Ks mit dem Füllstand, beim gleichprozentigen Ventil mit dem Hub. Ks gilt deshalb nur in der Nähe des Arbeitspunkts.</li>
      <li><b>Stellglied:</b> Es kann nicht mehr als 100 % liefern (Sättigung). Dann hilft auch ein größerer Reglerausgang nicht.</li></ul>`;
  }
  function secStep() {
    const r = response(PT3, 80), f = fitOf(r); if (!r) return NOZ;
    let fig = '', txt = '<p class="hint2">Die automatische Auswertung ist nicht verfügbar.</p>';
    if (f && fin(f.Tu) && fin(f.Tg) && f.art !== 'I') {
      const Ks = fin(f.Ks) ? f.Ks : r.x[r.x.length - 1];
      fig = plot({ series: [{ pts: dn(r.t.map((t, i) => [t, r.x[i]]), 3), color: '#3b9eff' }, { pts: [[f.Tu, 0], [f.Tu + f.Tg, Ks]], color: '#c77dff', dash: '5 4' }], hlines: [{ y: Ks, color: '#8d99a6' }], xMin: 0, xMax: 80, yMin: 0, yMax: Ks * 1.15, xLabel: 'Zeit in s (Strecke mit drei Zeitkonstanten, Sprung der Stellgröße um 1 %)', yLabel: 'x', label: 'Sprungantwort mit Wendetangente, Verzugszeit Tu und Ausgleichszeit Tg' });
      txt = `<p>Für dieses Beispiel (drei Speicher mit ${tList(PT3)}) liefert die Wendetangente: <b>Ks = ${fauto(Ks)}</b>, <b>Tu = ${fauto(f.Tu)} s</b>, <b>Tg = ${fauto(f.Tg)} s</b>, also <b>Tg/Tu = ${fnum(f.Tg / f.Tu, 1)}</b>${f.urteil ? ' (' + esc(f.urteil) + ')' : ''}.</p>`;
    }
    return `<p>So vermisst du eine Strecke mit Ausgleich: Stelle die Stellgröße in Hand um einen Sprung Δy, zeichne die Antwort auf und lege an der <b>steilsten Stelle (Wendepunkt)</b> eine Tangente an.</p>${fig}
      <ul><li><b>Tu</b> (Verzugszeit): Zeit vom Sprung bis zum Schnitt der Tangente mit dem Anfangswert.</li><li><b>Tg</b> (Ausgleichszeit): Zeit zwischen den Schnitten der Tangente mit dem Anfangswert und dem Endwert.</li><li><b>Ks</b>: Änderung der Regelgröße im Endzustand geteilt durch den Sprung der Stellgröße, beide in %.</li></ul>${txt}
      <p>Das Verhältnis <b>Tg/Tu</b> sagt, wie gut sich die Strecke regeln lässt: Je größer, desto leichter. Im Tab „Strecke messen“ legst du die Tangente selbst an und vergleichst mit der automatischen Auswertung.</p>`;
  }
  function secParts() {
    const C = CORE(); if (!C) return NOZ; const Kp = 2, e = 10, Tn = 10, Tv = 5;
    const defs = [['P-Anteil', 'P', { Kp, e }, '#3b9eff', 20], ['I-Anteil (PI)', 'PI', { Kp, e, Tn }, '#4cd964', 30], ['D-Anteil (PD)', 'PD', { Kp, e, Tv }, '#ffb340', 30]];
    let h = '', ratio = '';
    defs.forEach(([nm, tp, v, col, tEnd]) => { const r = ctrlResp(tp, Object.assign({ tEnd }, v)); if (!r) return; h += `<div class="fig"><b>${esc(nm)}</b>${plot({ series: [{ pts: dn(r.t.map((t, i) => [t, r.y[i]]), 2), color: col }], xMin: 0, xMax: tEnd, yMin: 0, yMax: Math.max(1, ...r.y) * 1.1, xLabel: 'Zeit in s nach dem Sprung der Regeldifferenz von 0 auf ' + e + ' %', yLabel: 'y in %', h: 125, label: 'Sprungantwort des Reglers: ' + nm })}</div>`; if (tp === 'PI') { const i = r.t.findIndex(t => t >= Tn - 1e-9); if (i > 0) ratio = `<p>Beim PI-Regler wächst y gleichmäßig an. Nach der Nachstellzeit Tn (hier ${Tn} s) ist y <b>${fnum(r.y[i] / r.y[1], 1)}-mal</b> so groß wie unmittelbar nach dem Sprung: Der I-Anteil hat den P-Anteil <b>einmal wiederholt</b>. Daher der Name „Nachstellzeit“.</p>`; } });
    const f = formulaOf('xp', Kp); const xpTxt = f ? `<p>Der <b>Proportionalbereich Xp = 100 % / Kp</b> ist der Bereich der Regeldifferenz, in dem die Stellgröße von 0 auf 100 % läuft. Bei Kp = ${Kp} ist Xp = <b>${fauto(f)} %</b>.</p>` : '';
    return `<p>Ein Regler besteht aus drei Anteilen, die einzeln oder gemeinsam wirken. Die Bilder zeigen die Stellgröße y, wenn die Regeldifferenz e plötzlich von 0 auf ${e} % springt (Kp = ${Kp}).</p>${h}${xpTxt}${ratio}
      <table><tr><th>Anteil</th><th>Wirkung</th><th>Nachteil</th></tr><tr><td><b>P</b> (Kp, Xp)</td><td>schnell: y folgt e sofort</td><td>bleibende Regelabweichung; zu großes Kp lässt den Kreis schwingen</td></tr><tr><td><b>I</b> (Tn)</td><td>genau: regelt die Abweichung ganz weg</td><td>langsamer, Schwingneigung, Windup bei Begrenzung der Stellgröße</td></tr><tr><td><b>D</b> (Tv)</td><td>dämpfend: reagiert auf die Änderung von x</td><td>verstärkt Messrauschen; hilft bei großer Totzeit kaum</td></tr></table>`;
  }
  /* Formeln des Kerns: formulas.<id>.fn(...Werte), Werte positionell in der Reihenfolge von formulas.<id>.args */
  function formulaOf(id) { const C = CORE(), f = C && C.formulas && (Array.isArray(C.formulas) ? C.formulas.find(x => x && x.id === id) : C.formulas[id]); if (!f || typeof f.fn !== 'function') return NaN; try { return pick(f.fn(...[].slice.call(arguments, 1)), ['value', 'v', 'result', 'y']); } catch (e) { return NaN; } }
  function secPID() {
    const C = CORE(); if (!C) return NOZ; const v = { Kp: 3, e: 10, Tn: 20, Tv: 5, tEnd: 60 }, r = ctrlResp('PID', v);
    const fig = r ? plot({ series: [{ pts: dn(r.t.map((t, i) => [t, r.y[i]]), 2), color: '#c77dff' }], xMin: 0, xMax: v.tEnd, yMin: 0, yMax: Math.max(...r.y) * 1.1, xLabel: 'Zeit in s nach dem Sprung der Regeldifferenz von 0 auf ' + v.e + ' %', yLabel: 'y in %', label: 'Sprungantwort eines PID-Reglers' }) : '';
    return `<p>Der <b>PID-Regler</b> addiert die drei Anteile. Er ist schnell (P), genau (I) und gedämpft (D). Die Bauform in diesem Lab: y = u0 + Kp · ( e + 1/Tn · ∫e dt + Tv · de/dt ), wobei der D-Anteil gefiltert wird und auf die Messgröße wirkt. Das Bild zeigt y für Kp = ${v.Kp}, Tn = ${v.Tn} s und Tv = ${v.Tv} s.</p>${fig}
      <ul><li><b>Wirkungssinn:</b> Ein Heizregler wirkt <i>direkt</i> (zu kalt: mehr Heizleistung), ein Kühlregler <i>invers</i>. Der falsche Wirkungssinn schaukelt jeden Kreis auf.</li><li><b>Anti-Windup:</b> Steht die Stellgröße am Anschlag, darf der I-Anteil nicht weiter anwachsen, sonst überschwingt die Regelgröße danach stark.</li><li><b>Hand und Automatik:</b> Beim Umschalten soll die Stellgröße nicht springen (stoßfrei).</li><li><b>Abtastzeit Ta:</b> Digitale Regler rechnen nur alle Ta, dazwischen bleibt y stehen.</li></ul>`;
  }
  function secStab() {
    const C = CORE(); if (!C || typeof C.ultimate !== 'function') return NOZ; let u; try { u = C.ultimate(PT3); } catch (e) { u = null; } if (!u || u.ok === false) return `<p class="hint2">${esc((u && u.why) || '')}</p>`;
    const T = 6 * u.Tkrit + 100, cols = ['#4cd964', '#ffb340', '#ff5c5c'], fs = [0.5, 1, 1.3], ser = [];
    fs.forEach((f, i) => { const L = loop(PT3, { type: 'P', Kp: f * u.Kkrit }, { T: Math.max(T, 120), t0: 5, dw: 10 }); if (L) ser.push({ pts: dn(L.t.map((t, k) => [t, L.x[k]]), 3), color: cols[i] }); });
    const fig = ser.length ? plot({ series: ser, xMin: 0, xMax: Math.max(T, 120), yMin: 20, yMax: 90, xLabel: 'Zeit in s: grün Kp = ' + fauto(fs[0]) + ' · Kkrit, orange Kp = Kkrit, rot Kp = ' + fauto(fs[2]) + ' · Kkrit', yLabel: 'x in %', label: 'Sprungantwort eines Regelkreises bei drei verschiedenen Kp' }) : '';
    return `<p>Ein Regelkreis <b>schwingt</b>, wenn die Rückführung die Abweichung zu spät und zu stark zurückgibt: Jeder Speicher und jede Totzeit verzögert das Signal. Dreht sich die Verzögerung bis zur Gegenkopplung in eine Mitkopplung, wächst jede Schwingung an.</p>
      <p>Die <b>Kreisverstärkung V0 = Kp · Ks</b> entscheidet. Für die Beispielstrecke mit drei Speichern (${tList(PT3)} und Ks = ${nz(ksOf(PT3))}) schwingt der Kreis mit einem P-Regler bei der <b>kritischen Verstärkung Kkrit = ${fauto(u.Kkrit)}</b> dauernd, mit der Periode <b>Tkrit = ${fauto(u.Tkrit)} s</b>.</p>${fig}
      <ul><li>Kp unter Kkrit: Die Schwingung klingt ab, desto langsamer, je näher Kp an Kkrit liegt.</li><li>Kp = Kkrit: Dauerschwingung.</li><li>Kp über Kkrit: Die Schwingung wird immer größer, bis die Stellgröße anschlägt.</li></ul>
      <p>Mehr Totzeit oder mehr Speicher machen Kkrit kleiner. Im Tab „Regler einstellen“ gibt es unter „Stabilität“ als Vertiefung das Bode-Diagramm mit Phasen- und Amplitudenreserve. Als Richtwerte gelten etwa 45° Phasenreserve und 6 dB Amplitudenreserve als gut gedämpft.</p>`;
  }
  function secFuehr() {
    const C = CORE(); if (!C) return NOZ; const P = { K: 1, T: 10 }, R = { Kp: 2, Tn: 10 }, w0 = 50, dw = 20, t0 = 5, tz = 70, dz = 10, w1 = w0 + dw, T = 120;
    const L = loop(PT1(P.K, P.T), { type: 'PI', Kp: R.Kp, Tn: R.Tn }, { T, t0, dw, tz, dz });
    if (!L) return NOZ; let m = null, d = null; try { m = C.stepMetrics(L.t, L.x, { w0, w1, t0, tol: 0.02 }); } catch (e) { m = null; } try { d = C.disturbMetrics(L.t, L.x, { w: w1, tz, band: 2 }); } catch (e) { d = null; }
    const fig = plot({ series: [{ pts: dn(L.t.map((t, i) => [t, L.x[i]]), 3), color: '#3b9eff' }], hlines: [{ y: w1, color: '#ffb340' }], xMin: 0, xMax: T, yMin: 45, yMax: 75, xLabel: 'Zeit in s: Sollwertsprung bei ' + t0 + ' s, Störung bei ' + tz + ' s', yLabel: 'x in %', label: 'Führungsverhalten und Störverhalten eines PI-Regelkreises' });
    const t1 = m && m.ok !== false ? `<p>Dieser PI-Kreis (Kp = ${R.Kp}, Tn = ${R.Tn} s an einer Strecke mit Ks = ${P.K} und T = ${P.T} s) hat nach dem Sollwertsprung von ${w0} auf ${w1} % eine <b>Anregelzeit von ${fauto(m.tAn)} s</b>, eine <b>Ausregelzeit (2 %) von ${fauto(m.tAus2)} s</b> und eine <b>Überschwingweite von ${fnum(m.ueberPct, 1)} %</b>.</p>` : '';
    const t2 = d && d.ok !== false ? `<p>Springt bei ${tz} s die Störgröße am Streckeneingang um ${dz} %, weicht x höchstens um <b>${fnum(Math.abs(d.xdMax), 1)} %</b> vom Sollwert ab und ist nach <b>${fin(d.tAus) ? fauto(d.tAus) + ' s' : 'nicht'}</b> wieder im Band von ±2 %.</p>` : '';
    return `<p><b>Führungsverhalten</b> heißt: Der Sollwert ändert sich, der Regler soll die Regelgröße nachführen. <b>Störverhalten</b> heißt: Der Sollwert bleibt, eine Störgröße wirkt, der Regler soll die Abweichung ausregeln.</p>${fig}${t1}${t2}
      <table><tr><th>Kenngröße</th><th>Bedeutung</th></tr><tr><td><b>Anregelzeit</b></td><td>vom Sprung bis zum ersten Eintritt der Regelgröße ins Toleranzband (hier ±2 % des Sprungs)</td></tr><tr><td><b>Ausregelzeit</b></td><td>vom Sprung bis zu dem Zeitpunkt, ab dem die Regelgröße dauerhaft im Band bleibt</td></tr><tr><td><b>Überschwingweite</b></td><td>größte Abweichung über den Sollwert hinaus, in % des Sollwertsprungs</td></tr><tr><td><b>Bleibende Regelabweichung</b></td><td>Sollwert minus Endwert nach dem Einschwingen</td></tr></table><p class="hint2">Die Schul-Definitionen unterscheiden sich leicht (Band 2 % oder 5 %, Bezug des Überschwingens). Das Lab zeigt beide Bänder.</p>`;
  }
  function secRules() {
    const C = CORE(); let warnTxt = '';
    if (C && C.rules && typeof C.rules.validity === 'function') {
      const fw = k => { try { const v = C.rules.validity('zn-sprung', k); return Array.isArray(v) ? v : (v && v.warn) || []; } catch (e) { return []; } };
      const w = fw({ Ks: 1, Tu: 6, Tg: 10 }); if (w.length) warnTxt = `<p>Beispiel: Bei Tu = 6 s und Tg = 10 s meldet der Kern: <i>${esc(w[0])}</i>.</p>`;
    }
    return `<p>Einstellregeln liefern aus wenigen Kennwerten der Strecke gute Startwerte für Kp, Tn und Tv. Die Werte sind <b>Näherungen</b>: Danach wird von Hand nachgestellt. Die Faktoren in der Tabelle holt dieses Lab aus derselben Quelle wie der Rechner.</p>
      <ul><li><b>Ziegler-Nichols, Schwingversuch:</b> Du brauchst Kkrit und Tkrit aus dem Schwingversuch (nur für Strecken, die schwingen können).</li><li><b>Ziegler-Nichols, Sprungantwort:</b> Du brauchst Ks, Tu und Tg aus der Wendetangente. Die Einstellung ist ziemlich scharf.</li><li><b>CHR:</b> Chien, Hrones und Reswick unterscheiden Führung und Störung und zwei Ziele: aperiodisch oder 20 % Überschwingen.</li><li><b>T-Summe (Betragsoptimum):</b> Aus der größten Zeitkonstante T1 und der Summe der kleinen Zeitkonstanten TΣk. Beim PID-Regler gilt TΣk′ = TΣk − T2: Die Vorhaltzeit Tv = T2 kompensiert die zweitgrößte Zeitkonstante.</li></ul>
      ${rulesTableHtml()}<p class="hint2">Tabellenbücher runden die Faktoren unterschiedlich. Im Rechner und bei den Aufgaben werden deshalb die üblichen Varianten akzeptiert. Alle Faktoren gelten nur in ihrem Gültigkeitsbereich (Tu/Tg).</p>${warnTxt}`;
  }
  const HEAT = { Ph: 1000, R: 0.2, C: 1500, thetaA: 25, w: 150 };
  function twoRows() {
    const C = CORE(); if (!C || !C.twoPoint || typeof C.twoPoint.period !== 'function') return null;
    return [4, 10, 20].map(hyst => { let r; try { r = C.twoPoint.period(Object.assign({ hyst }, HEAT)); } catch (e) { r = null; } return { hyst, r }; });
  }
  function svgHyst() {
    return SV(`<path d="M40 160H320M180 20V170" stroke="#8d99a6" stroke-width="1.5" fill="none"/><path d="M120 150H220V50M220 50H300M220 50V50M240 50H120V150" stroke="none" fill="none"/>
      <path d="M60 150H215V50H300" stroke="#3b9eff" stroke-width="2.6" fill="none"/><path d="M300 50H145V150H60" stroke="#ffb340" stroke-width="2.6" fill="none"/>
      <path d="M145 168H215" stroke="#4cd964" stroke-width="2"/>${TX(180, 184, 'Schaltdifferenz Δ', { s: 11, c: '#4cd964' })}${TX(150, 70, 'aus bei e < −Δ/2', { s: 10, a: 'end', c: '#ffb340' })}${TX(222, 138, 'ein bei e > +Δ/2', { s: 10, a: 'start', c: '#7fbaff' })}${TX(310, 160, 'e', { s: 13, w: 1, a: 'end' })}${TX(190, 22, 'y', { s: 13, w: 1, a: 'start' })}${TX(300, 40, 'EIN', { s: 11, a: 'end' })}${TX(60, 143, 'AUS', { s: 11, a: 'start' })}`, 'Schaltkennlinie eines Zweipunktreglers mit Schaltdifferenz');
  }
  function secTwo() {
    const rows = twoRows(); let tab = NOZ;
    if (rows) tab = '<table><tr><th>Schaltdifferenz Δ</th><th>Periode T</th><th>Schaltspiele pro Stunde</th><th>Einschaltdauer ED</th></tr>' + rows.map(x => x.r && x.r.ok !== false ? `<tr><td>${fnum(x.hyst, 0)} K</td><td>${fauto(x.r.T)} s</td><td>${fnum(fin(x.r.fPerH) ? x.r.fPerH : 3600 / x.r.T, 0)}</td><td>${fnum(x.r.ED, 0)} %</td></tr>` : `<tr><td>${fnum(x.hyst, 0)} K</td><td colspan="3" class="hint2">${esc((x.r && x.r.why) || '')}</td></tr>`).join('') + '</table>';
    return `<p>Ein <b>Zweipunktregler</b> kennt nur EIN und AUS (zum Beispiel Bügeleisen, Kühlschrank, Raumthermostat). Er schaltet ein, wenn die Regeldifferenz größer als +Δ/2 ist, und aus, wenn sie kleiner als −Δ/2 ist. Dazwischen bleibt er im letzten Zustand.</p>${svgHyst()}
      <p>Die Temperatur pendelt dadurch immer um den Sollwert. Je <b>kleiner die Schaltdifferenz Δ</b>, desto kleiner die Schwankung, aber desto häufiger schaltet das Gerät. Für die Übungsanlage „Bügeleisensohle“ (${HEAT.Ph} W Heizleistung, Sollwert ${HEAT.w} °C, Umgebung ${HEAT.thetaA} °C) rechnet der Kern:</p>${tab}
      <ul><li><b>Schaltdifferenz ≠ Schwankungsbreite:</b> Ein träger Fühler (Bimetall) schaltet zu spät, die Temperatur schwankt dann mehr als Δ.</li><li><b>Bimetall:</b> Zwei Metallstreifen mit verschiedener Wärmedehnung biegen sich bei Erwärmung und öffnen den Schaltkontakt.</li><li><b>Wirkungssinn:</b> Der Kühlschrank schaltet bei zu warm <i>ein</i> (invers), das Bügeleisen bei zu kalt.</li><li><b>Dreipunktregler:</b> Er kennt zusätzlich eine Totzone, damit nie gleichzeitig geheizt und gekühlt wird.</li><li>Sehr viele Schaltspiele verschleißen Schalter und Verdichter. Die zulässige Zahl steht im Datenblatt des Bauteils.</li></ul>`;
  }
  function spsRows() {
    const C = CORE(); if (!C || !C.scale) return null; const f = (fn, ...a) => { try { const r = C.scale[fn](...a); return pick(r, ['value', 'pct', 'p', 'eng', 'raw', 'mA', 'ma']); } catch (e) { return NaN; } };
    return [0, 1, 2, 3, 4].map(i => i * RAWMAX / 4).map(raw => { const pct = f('rawToPct', raw, RAWMAX); return { raw, pct, mA: f('pctToMa', pct) }; });
  }
  function secSPS() {
    const C = CORE(), rows = spsRows(); let tab = NOZ, drat = '', tk = '';
    if (rows) tab = '<table><tr><th>Rohwert</th><th>Prozent</th><th>Strom</th></tr>' + rows.map(r => `<tr><td>${r.raw}</td><td>${fnum(r.pct, 0)} %</td><td>${fnum(r.mA, 1)} mA</td></tr>`).join('') + '</table>';
    if (C && C.scale && typeof C.scale.maInfo === 'function') { try { const r = C.scale.maInfo(MA_BAD); if (r && r.fault) drat = `<p>Ein Strom unter der Live-Zero-Grenze (zum Beispiel ${fauto(MA_BAD)} mA) zeigt einen Fehler: <i>${esc(r.text || r.fault)}</i></p>`; } catch (e) {} }
    const v = formulaOf('abtastVerlust', 0.5, 1); if (fin(v)) tk = `<p>Beispiel: Bei einer Kreisfrequenz von 0,5 rad/s kostet eine Abtastzeit von 1 s etwa <b>${fauto(v)}°</b> Phasenreserve (Näherung: Halteglied wie eine Totzeit Ta/2). Wähle Ta also deutlich kleiner als die Zeitkonstanten der Strecke.</p>`;
    return `<p>In der SPS ist der Regler ein <b>Baustein</b> im Programm (zum Beispiel PID_Compact bei Siemens). Er rechnet zyklisch mit einer <b>Abtastzeit Ta</b> und bekommt die Regelgröße als Analogwert. Bausteinparameter heißen oft <b>GAIN</b> (= Kp), <b>TI</b> (= Tn) und <b>TD</b> (= Tv), je nach Baustein und Version anders.</p>
      <p>Ein Siemens-Analogeingang liefert den Rohwert <b>0 bis ${RAWMAX}</b> für 0 bis 100 % des Messbereichs. Ein 4-bis-20-mA-Signal liefert 4 mA für 0 % und 20 mA für 100 %.</p>${tab}${drat}${tk}
      <ul><li><b>Hand/Automatik</b> und <b>Anti-Windup</b> gibt es im Baustein wie in diesem Lab.</li><li>Werte über 100 % (Übersteuerungsbereich) werden nicht still abgeschnitten, sondern gemeldet.</li><li>Wie du Programme in KOP und FUP schreibst, lernst du im <a href="spslab.html" style="color:var(--accent)">SPS-Lab</a>.</li></ul>`;
  }
  function secPraxis() {
    const R = root.REG_RIGS; if (!R || !R.defs) return NOZ.replace('Rechenkern (regcore.js)', 'Prüfstände');
    const rows = ['fuellstand', 'durchfluss', 'raumtemp', 'thermostat', 'drehzahl', 'position', 'baukasten'].map(id => {
      const d = R.defs[id]; if (!d) return ''; let rg = null, tu = '', ts = null; try { const r = d.create({ seed: 1 }); rg = r.range; tu = r.tUnit; ts = r.timeScale; } catch (e) {}
      return `<tr><td>${esc(d.icon || '')} <b>${esc(d.name)}</b></td><td>${esc(d.info || '')}</td><td>${rg ? esc(fnum(rg.lo, rg.digits == null ? 1 : rg.digits)) + ' bis ' + esc(fnum(rg.hi, rg.digits == null ? 1 : rg.digits)) + ' ' + esc(rg.unit || '') : '–'}</td><td>${tu ? esc(tu) + (ts && ts !== 1 ? ' (1 s Echtzeit = ' + fauto(ts) + ' s Prozesszeit)' : '') : '–'}</td></tr>`;
    }).join('');
    return `<p>Die sieben Prüfstände sind Übungsanlagen: Die Zahlen sind plausibel gewählt, aber nicht die einer bestimmten echten Anlage.</p><table><tr><th>Prüfstand</th><th>Was wird geregelt?</th><th>Bereich der Regelgröße</th><th>Zeitmaßstab</th></tr>${rows}</table>
      <ul><li><b>Heizung und Raumtemperatur:</b> Heizkörper und Raum sind träge, dazu kommt Totzeit. Ein offenes Fenster ändert Ks und T zugleich.</li><li><b>Füllstand:</b> Der Auslauf durch die Düse ist nicht linear: Ks hängt vom Füllstand ab. Die Entnahme ist die Störgröße.</li><li><b>Drehzahl:</b> Der Motor ist schnell, die Last (Bremse) wirkt als Störgröße. Die Stromgrenze begrenzt die Stellgröße.</li><li><b>Lage:</b> Die Achse ist eine I-Strecke. Haftreibung und Lose lassen mit I-Anteil einen Grenzzyklus entstehen.</li></ul>`;
  }
  function secSafety() {
    return `<p>Ein Regler ist <b>keine Sicherheitseinrichtung</b>. Fällt er aus oder ist falsch eingestellt, darf die Anlage nicht gefährlich werden. Dafür gibt es unabhängige Einrichtungen:</p>
      <ul><li><b>Sicherheitstemperaturbegrenzer (STB)</b> bei Heizungen: Er schaltet unabhängig vom Regler ab.</li><li><b>Überlaufschutz</b> und Grenzwertschalter bei Tanks (eigener Schalter, nicht der Füllstandsregler).</li><li><b>Not-Halt</b> und Schutzeinrichtungen bei Antrieben und Achsen: Endschalter, Drehzahlwächter, Stromgrenze.</li></ul>
      <ul><li>Eine Anlage mit Regelung muss auch bei Stromausfall, Drahtbruch (Live-Zero) und Fühlerausfall in einen sicheren Zustand fallen.</li><li>Im Schaltschrank gelten die fünf Sicherheitsregeln: freischalten, gegen Wiedereinschalten sichern, Spannungsfreiheit feststellen, erden und kurzschließen, benachbarte Teile abdecken.</li><li>Teste Regler erst bei kleiner Stellgröße und mit Begrenzung, bevor du ihn scharf stellst.</li></ul>`;
  }
  function secGlossary() {
    const g = glossaryRows(); if (!g) return NOZ; return '<table><tr><th>Symbol</th><th>Begriff</th><th>Einheit</th><th>Erklärung</th></tr>' + g.map(e => `<tr><td><b>${esc(e.symbol)}</b></td><td>${esc(e.name)}</td><td>${esc(e.unit)}</td><td>${esc(e.text)}</td></tr>`).join('') + '</table>';
  }
  function keysRows(api) { const K = (api && api.KEYS) || root.REG_KEYS; return Array.isArray(K) ? K.map(k => ({ keys: (k.keys || []).slice(), t: k.t })) : null; }
  function secKeys(api) {
    const K = keysRows(api); if (!K) return '<p class="hint2">Die Tastenkürzel sind noch nicht geladen.</p>';
    return '<table>' + K.map(k => `<tr><td style="white-space:nowrap">${k.keys.map(x => `<code>${esc(x)}</code>`).join(' oder ')}</td><td>${esc(k.t)}</td></tr>`).join('') + '</table><p class="hint2">Die Kürzel gelten nicht, solange ein Eingabefeld oder ein Fenster offen ist.</p>';
  }
  const SEC = [
    { t: 'Regeln statt Steuern', exT: 'Füllstand von Hand ansehen', ex: { id: 'rgx1', fb: { name: 'Füllstand von Hand', rig: 'fuellstand', controls: { mode: 'hand' } } }, open: true,
      h: () => `<p>Eine <b>Steuerung</b> arbeitet im offenen Wirkungsablauf: Die Steuerung stellt etwas ein und kontrolliert nicht, was dabei herauskommt. Eine <b>Regelung</b> misst die Ergebnisgröße dauernd, vergleicht sie mit dem Wunsch und greift ein. Der Wirkungsweg ist ein <b>geschlossener Kreis</b>.</p>${svgPlan()}<table><tr><th>Symbol</th><th>Begriff</th></tr>${['w', 'x', 'y', 'z', 'e'].map(entry).join('')}</table><p>Die <b>Regelstrecke</b> ist die Anlage, der <b>Regler</b> bildet aus e die Stellgröße y, das <b>Stellglied</b> setzt y in der Anlage um, das <b>Messglied</b> erfasst x. Ein Regelkreis hat immer eine Rückführung; ohne sie gibt es nur eine Steuerung.</p>` },
    { t: 'Regelstrecken: P, I, Verzögerung, Totzeit', exT: 'Sprungantwort ansehen', ex: { id: 'rgx8', fb: { name: 'Raumtemperatur: Sprungantwort', rig: 'raumtemp', controls: { mode: 'hand' } } }, h: secPlants },
    { t: 'Die Sprungantwort lesen: Tu, Tg, Ks', exT: 'Strecke messen', ex: { tab: 'meas' }, h: secStep },
    { t: 'Die Reglerarten: P, I und D', exT: 'P-Regler am Füllstand', ex: { id: 'rgx2', fb: { name: 'Füllstand P-Regler', rig: 'fuellstand', controls: { mode: 'auto', ctrl: 'P' } } }, h: secParts },
    { t: 'PID zusammen', exT: 'Regler einstellen', ex: { tab: 'tune' }, h: secPID },
    { t: 'Stabilität und Schwingen', exT: 'Baukasten: Schwingversuch', ex: { id: 'rgx21', fb: { name: 'Baukasten: Schwingversuch', rig: 'baukasten', controls: { mode: 'auto', ctrl: 'P' } } }, h: secStab },
    { t: 'Führungsverhalten und Störverhalten', exT: 'Füllstand: Entnahme als Störung', ex: { id: 'rgx4', fb: { name: 'Füllstand: Entnahme als Störung', rig: 'fuellstand', controls: { mode: 'auto', ctrl: 'PI' } } }, h: secFuehr },
    { t: 'Einstellregeln', exT: 'Einstellregeln im Rechner', ex: { tab: 'calc' }, h: secRules },
    { t: 'Zweipunktregler und Thermostat', exT: 'Bügeleisen ansehen', ex: { id: 'rgx12', fb: { name: 'Bügeleisen: Zweipunktregler', rig: 'thermostat', controls: { ctrl: '2P' } } }, h: secTwo },
    { t: 'Regler im SPS-Programm', exT: 'Skalierung im Rechner', ex: { tab: 'calc' }, h: secSPS },
    { t: 'Praxis: Heizung, Füllstand, Drehzahl, Lage', exT: 'Raumtemperatur ausprobieren', ex: { id: 'rgx9', fb: { name: 'Raumtemperatur: PI', rig: 'raumtemp', controls: { mode: 'auto', ctrl: 'PI' } } }, h: secPraxis },
    { t: 'Sicherheit', exT: 'Drehzahl: Stromgrenze und Windup', ex: { id: 'rgx17', fb: { name: 'Drehzahl: Windup', rig: 'drehzahl', controls: { mode: 'auto', ctrl: 'PI', ymax: 60, aw: 'aus' } } }, h: secSafety },
    { t: 'Glossar', exT: 'Prüfstand öffnen', ex: { tab: 'rig' }, h: secGlossary },
    { t: 'Tastenkürzel', exT: 'Prüfstand öffnen', ex: { tab: 'rig' }, h: null, keys: true }
  ];
  function sectionHtml(s, i, api) {
    let body; try { body = s.keys ? secKeys(api) : s.h(); } catch (e) { console.error('Lernabschnitt ' + (i + 1) + ':', e); body = '<p class="hint2">Dieser Abschnitt konnte nicht aufgebaut werden.</p>'; }
    return `<details${s.open ? ' open' : ''}><summary>${i + 1} · ${esc(s.t)}</summary><div class="hb2">${body}<div class="tryit"><button class="chip s on" data-lx="${i}">▶ ${esc(s.exT)}</button></div></div></details>`;
  }
  function html(api) { return `<p class="big">Lernen und Hilfe</p><p class="hint2" style="margin:0 0 12px">Kurz erklärt, was du zur Regelungstechnik wissen musst. Mit „Probier es aus“ landest du direkt am passenden Prüfstand.</p>` + SEC.map((s, i) => sectionHtml(s, i, api)).join(''); }
  function onClick(e, api) {
    const b = e.target && e.target.closest && e.target.closest('[data-lx]'); if (!b) return; const s = SEC[+b.dataset.lx]; if (!s) return; const x = s.ex || {};
    if (x.tab) { api.setTab(x.tab); return; }
    if (x.id && api.loadExample(x.id)) return; if (x.fb) api.loadExample(x.fb);
  }
  function render(host, api) {
    host.innerHTML = html(api);
    if (typeof host.addEventListener === 'function' && !host._regHelp) { host._regHelp = true; host.addEventListener('click', e => onClick(e, host._regHelpApi)); }
    host._regHelpApi = api;
  }
  root.REG_UI_EXT = root.REG_UI_EXT || {};
  root.REG_UI_EXT.help = { render, html, SEC, fn: { factorTable, tableFromCore, cellText, glItems, rulesTableHtml, glossaryRows, keysRows, spsRows, twoRows, HEAT, MTHD, BASES, response, fitOf, loop, ctrlResp, onClick } };
  if (typeof module !== 'undefined') module.exports = root.REG_UI_EXT.help;
})(typeof window !== 'undefined' ? window : globalThis);
