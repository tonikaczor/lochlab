'use strict';
/* Tonfunk Werkstoff-Lab: Oberfläche (Lab-Kennung 'wer').
   Reiter: Zugversuch, Härteprüfung, Bezeichnungen, Fe-C-Diagramm, Wärmebehandlung, Werkstoffwahl, Aufgaben, Trainer, Hilfe.
   Module: wercore.js (WER_CORE, Logik), werdata.js (WER_DATA, WER_TASKS).
   Speicher (Präfix lm4.wer.): tab, zug (Werkstoff, Rechner), haerte, fec, wb, wahl, name, quiz ({Schlüssel:{n,ok}}),
   done ({id:true} nur gelöste), prog ({id:Prozent}), hints, ctipps (nur Prüfmodus), exam ('1'), rt (Trainer: n, ok, streak, best).
   Tipp-Abzug (25 % je Stufe) gibt es nur im Prüfmodus; beim normalen Üben kosten Tipps nichts.
   Alle Werkstoffkennwerte sind Übungswerte; das Eisen-Kohlenstoff-Diagramm ist ein vereinfachtes Lehrmodell. */
(function (root) {
  const C = root.WER_CORE, D = root.WER_DATA;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.wer.';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(LS + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} };
  const nd = C.nd, fx2 = v => C.fmtDe(v, 2), fx1 = v => C.fmtDe(v, 1), fx0 = v => C.fmtDe(v, 0);
  const decs = v => { const p = String(Math.round(v * 1e6) / 1e6).split('.'); return p[1] ? p[1].length : 0; };
  const fAny = v => C.fmtDe(v, Math.max(0, Math.min(4, decs(v))));
  const dots = l => '●'.repeat(l || 1) + '○'.repeat(3 - (l || 1));
  const fx = () => root.LochFX || null;
  const ding = () => { const F = fx(); if (F && F.sound) try { F.sound('ding', 0.6); } catch (e) {} };
  const sad = () => { const F = fx(); if (F && F.sound) try { F.sound('sad', 0.5); } catch (e) {} };
  const reduced = () => { try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function toast(m) { const t = $('#toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), Math.max(2200, m.length * 55)); }
  function sheet(title, build) {
    const bd = document.createElement('div'); bd.className = 'backdrop';
    bd.innerHTML = `<div class="sheet" role="dialog" aria-label="${esc(title)}"><div class="sh-h"><b>${esc(title)}</b><button class="x" aria-label="Schließen">✕</button></div><div class="sh-b"></div></div>`;
    document.body.appendChild(bd);
    const close = () => bd.remove();
    bd.addEventListener('pointerdown', e => { if (e.target === bd) close(); });
    $('.x', bd).onclick = close; build($('.sh-b', bd), close); return close;
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { const b = $$('.backdrop'); if (b.length) b[b.length - 1].remove(); } });

  if (!C || !D) {
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>Werkstoff-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">wercore.js oder werdata.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks, MATS = D.materials, mat = id => MATS.find(m => m.id === id) || MATS[0];

  /* ============================================================ Zustand */
  const TABS = [['zug', '📈', 'Zugversuch'], ['haerte', '🔨', 'Härteprüfung'], ['name', '🏷️', 'Bezeichnungen'], ['fec', '🌡️', 'Fe-C-Diagramm'], ['wb', '🔥', 'Wärmebehandlung'], ['wahl', '🧰', 'Werkstoffwahl'], ['bsp', '💡', 'Beispiele'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['help', '📘', 'Hilfe']];
  const ZC0 = { d: '10', F: '20', L0: '50', dL: '0,35', L0b: '80', Lu: '98,4', E: '210000', eps: '0,1' };
  const S = {
    tab: lsGet('tab', 'zug'),
    zug: Object.assign({ mat: 's235', eps: 0, show: false, off: false, calc: Object.assign({}, ZC0) }, lsGet('zug', {})),
    haerte: Object.assign({ m: 'hb', p: 1, D: 10, X: 30, d: '4,0', hvF: 98.07, d1: '0,25', d2: '0,25', h: '0,090', hb: '200' }, lsGet('haerte', {})),
    name: Object.assign({ v: 'S235JR' }, lsGet('name', {})),
    fec: Object.assign({ C: 0.45, T: 20 }, lsGet('fec', {})),
    wb: Object.assign({ id: 'haerten', Ta: 300 }, lsGet('wb', {})),
    wahl: Object.assign({ w: { fest: 2, zaeh: 1 } }, lsGet('wahl', {})),
    q: {},
    task: null, tAns: {}, tRes: null, tc: null, toff: false,
    tr: { kind: 'mixed', task: null, res: null, ans: '', tc: null, off: false },
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {}))
  };
  S.zug.eps = 0; S.zug.calc = Object.assign({}, ZC0, S.zug.calc);
  if (!MATS.some(m => m.id === S.zug.mat)) S.zug.mat = 's235';
  if (!['hb', 'hv', 'hrc'].includes(S.haerte.m)) S.haerte.m = 'hb';
  S.haerte.p = 1;
  if (!D.heat.some(h => h.id === S.wb.id)) S.wb.id = 'haerten';
  S.fec.C = clamp(+S.fec.C || 0, 0, C.FEC.CMAX); S.fec.T = clamp(+S.fec.T || 20, 20, 1000);
  S.wb.Ta = clamp(+S.wb.Ta || 300, 100, 700);
  const R0 = (() => { const m = /[?&]seed=([^&]+)/.exec(location.search); return C.rng(m ? decodeURIComponent(m[1]) : String(Math.random()) + Date.now()); })();
  const segHTML = (data, items, cur) => `<div class="seg" role="group">${items.map(([k, l]) => `<button data-${data}="${k}" class="${String(cur) === String(k) ? 'on' : ''}" aria-pressed="${String(cur) === String(k)}">${l}</button>`).join('')}</div>`;
  const chipHTML = (data, items, cur) => items.map(([k, l]) => `<button class="chip s${String(cur) === String(k) ? ' on' : ''}" data-${data}="${k}" aria-pressed="${String(cur) === String(k)}">${l}</button>`).join('');

  /* Tween für Animationen (eine laufende je Schlüssel) */
  const TW = {};
  function tween(key, from, to, ms, fn, done) {
    if (TW[key]) cancelAnimationFrame(TW[key]); if (reduced()) { fn(to); if (done) done(); return; }
    const t0 = performance.now(), step = now => { const f = clamp((now - t0) / ms, 0, 1); fn(from + (to - from) * f); if (f < 1) TW[key] = requestAnimationFrame(step); else { TW[key] = 0; if (done) done(); } };
    TW[key] = requestAnimationFrame(step);
  }
  const stopTween = key => { if (TW[key]) { cancelAnimationFrame(TW[key]); TW[key] = 0; } };

  /* ============================================================ SVG: Spannungs-Dehnungs-Diagramm */
  const CH = { L: 54, R: 372, T: 14, B: 236 };
  const geom = m => ({ x: e => CH.L + e / m.ax.xmax * (CH.R - CH.L), y: s => CH.B - s / m.ax.ymax * (CH.B - CH.T) });
  function curvePath(m, g, upto) {
    const p = C.curve(m); let d = '', lastE = -1;
    for (const q of p) { if (q[0] > upto) break; d += (d ? 'L' : 'M') + g.x(q[0]).toFixed(1) + ' ' + g.y(q[1]).toFixed(1); lastE = q[0]; }
    if (upto > lastE && upto <= m.A + 1e-12) d += (d ? 'L' : 'M') + g.x(upto).toFixed(1) + ' ' + g.y(C.sigmaAt(m, upto)).toFixed(1);
    return d;
  }
  /* o: {eps (Marker/Fortschritt), full (ganze Kurve fest), kv (Kennwerte), off (Parallele 0,2 %), cur (Ablesemarke)} */
  function svgChart(m, o) {
    o = o || {}; const g = geom(m); let s = '';
    for (let i = 0; i * m.ax.ystep <= m.ax.ymax + 1e-9; i++) { const v = i * m.ax.ystep, y = g.y(v); s += `<line x1="${CH.L}" x2="${CH.R}" y1="${y}" y2="${y}" class="c-grid"/><text x="${CH.L - 6}" y="${y + 3.5}" class="c-txt" text-anchor="end">${nd(v, 0)}</text>`; }
    for (let i = 0; i * m.ax.xstep <= m.ax.xmax + 1e-9; i++) { const v = i * m.ax.xstep, x = g.x(v); s += `<line x1="${x}" x2="${x}" y1="${CH.T}" y2="${CH.B}" class="c-grid"/><text x="${x}" y="${CH.B + 14}" class="c-txt" text-anchor="middle">${nd(v, 2)}</text>`; }
    s += `<line x1="${CH.L}" x2="${CH.R}" y1="${CH.B}" y2="${CH.B}" class="c-ax"/><line x1="${CH.L}" x2="${CH.L}" y1="${CH.T}" y2="${CH.B}" class="c-ax"/>`;
    s += `<text x="${(CH.L + CH.R) / 2}" y="268" class="c-txt" text-anchor="middle" style="font-size:11px">Dehnung ε in %</text><text transform="translate(12 ${(CH.T + CH.B) / 2}) rotate(-90)" class="c-txt" text-anchor="middle" style="font-size:11px">Spannung σ in N/mm²</text>`;
    const upto = o.full ? m.A : (o.eps || 0);
    if (!o.full) s += `<path d="${curvePath(m, g, m.A)}" class="c-curve0"/>`;
    if (upto > 0) s += `<path d="${curvePath(m, g, upto)}" class="c-curve"/>`;
    if (o.kv) {
      const key = m.type === 're' ? ['Re', m.Re, 'Re'] : m.type === 'rp' ? ['Rp0,2', m.Rp, 'Rp0,2'] : null;
      if (key) { const y = g.y(key[1]); s += `<line x1="${CH.L}" x2="${CH.R}" y1="${y}" y2="${y}" class="c-kv"/><text x="${CH.R - 2}" y="${y + 12}" class="c-kt" text-anchor="end">${key[0]} = ${nd(key[1], 0)}</text>`; }
      if (m.type === 'rp' && o.off) { const e1 = 0.2 + m.Rp * 1.25 / m.E * 100; s += `<line x1="${g.x(0.2)}" y1="${g.y(0)}" x2="${g.x(e1)}" y2="${g.y(m.Rp * 1.25)}" class="c-off"/><circle cx="${g.x(0.2 + m.Rp / m.E * 100)}" cy="${g.y(m.Rp)}" r="3.6" class="c-dot"/><text x="${g.x(0.2) + 4}" y="${g.y(0) - 5}" class="c-kt" style="font-size:9.5px">0,2 %</text>`; }
      const yR = g.y(m.Rm); s += `<line x1="${CH.L}" x2="${CH.R}" y1="${yR}" y2="${yR}" class="c-kv"/><text x="${CH.R - 2}" y="${yR - 4}" class="c-kt" text-anchor="end">Rm = ${nd(m.Rm, 0)}</text><circle cx="${g.x(m.Ag)}" cy="${yR}" r="3.6" class="c-dot"/>`;
      const xA = g.x(m.A); s += `<line x1="${xA}" x2="${xA}" y1="${CH.T}" y2="${CH.B}" class="c-kv"/><text x="${xA - 4}" y="${CH.B - 6}" class="c-kt" text-anchor="end">A = ${nd(m.A, m.A < 1 ? 2 : 0)} %</text>`;
    }
    if (o.eps != null && (o.eps > 0 || o.cur) && o.eps <= m.A + 1e-9) { const sg = C.sigmaAt(m, Math.min(o.eps, m.A)), cx = g.x(o.eps), cy = g.y(sg); if (o.cur) s += `<line x1="${cx}" x2="${cx}" y1="${cy}" y2="${CH.B}" class="c-cur"/><line x1="${CH.L}" x2="${cx}" y1="${cy}" y2="${cy}" class="c-cur"/>`; s += `<circle cx="${cx}" cy="${cy}" r="5" class="c-mark"/>`; }
    return `<svg viewBox="0 0 380 274" class="chart" data-chart="1" role="img" aria-label="Spannungs-Dehnungs-Diagramm ${esc(m.name)}">${s}<rect x="${CH.L}" y="${CH.T}" width="${CH.R - CH.L}" height="${CH.B - CH.T}" fill="transparent" data-hit="1"/></svg>`;
  }
  const niceZ = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.8, 1];
  const zoomMax = m => { const b = m.type === 'sprod' ? m.A : (m.Re || m.Rp) / m.E * 100 * 1.4; return niceZ.find(v => v >= b - 1e-9) || 1; };
  function svgElastic(m) {
    const zx = zoomMax(m); let ym = 0; for (let i = 0; i <= 40; i++) ym = Math.max(ym, C.sigmaAt(m, Math.min(zx, m.A) * i / 40));
    const step = [10, 20, 25, 50, 100].find(v => ym * 1.15 / v <= 6) || 100, yt = Math.ceil(ym * 1.15 / step) * step;
    const L = 54, R = 372, T = 14, B = 196, X = e => L + e / zx * (R - L), Y = v => B - v / yt * (B - T);
    let s = '';
    for (let v = 0; v <= yt + 1e-9; v += step) s += `<line x1="${L}" x2="${R}" y1="${Y(v)}" y2="${Y(v)}" class="c-grid"/><text x="${L - 6}" y="${Y(v) + 3.5}" class="c-txt" text-anchor="end">${nd(v, 0)}</text>`;
    const xs = zx <= 0.1 ? 0.02 : zx <= 0.3 ? 0.05 : 0.1;
    for (let i = 0; i * xs <= zx + 1e-9; i++) { const v = i * xs; s += `<line x1="${X(v)}" x2="${X(v)}" y1="${T}" y2="${B}" class="c-grid"/><text x="${X(v)}" y="${B + 14}" class="c-txt" text-anchor="middle">${nd(v, 2)}</text>`; }
    s += `<line x1="${L}" x2="${R}" y1="${B}" y2="${B}" class="c-ax"/><line x1="${L}" x2="${L}" y1="${T}" y2="${B}" class="c-ax"/>`;
    s += `<text x="${(L + R) / 2}" y="224" class="c-txt" text-anchor="middle" style="font-size:11px">Dehnung ε in % (stark vergrößert)</text><text transform="translate(12 ${(T + B) / 2}) rotate(-90)" class="c-txt" text-anchor="middle" style="font-size:11px">σ in N/mm²</text>`;
    const eEnd = Math.min(zx, m.A), n = 80; let d = ''; for (let i = 0; i <= n; i++) { const e = eEnd * i / n; d += (i ? 'L' : 'M') + X(e).toFixed(1) + ' ' + Y(C.sigmaAt(m, e)).toFixed(1); }
    const eh = Math.min(zx, yt / m.E * 100);
    s += `<line x1="${X(0)}" y1="${Y(0)}" x2="${X(eh)}" y2="${Y(eh * m.E / 100)}" class="c-off"/><path d="${d}" class="c-curve"/>`;
    const e2 = zx * 0.4, s2 = m.E * e2 / 100;
    s += `<polyline points="${X(0)},${Y(0)} ${X(e2)},${Y(0)} ${X(e2)},${Y(s2)}" class="c-kv" style="stroke-dasharray:none"/><text x="${X(e2 / 2)}" y="${Y(0) - 5}" class="c-kt" text-anchor="middle">Δε = ${nd(e2, 3)} %</text><text x="${X(e2) + 5}" y="${(Y(0) + Y(s2)) / 2}" class="c-kt">Δσ = ${nd(s2, 0)}</text>`;
    return { svg: `<svg viewBox="0 0 380 230" class="chart" role="img" aria-label="Anfangsbereich des Diagramms mit Steigungsdreieck für ${esc(m.name)}">${s}</svg>`, e2, s2 };
  }

  /* ============================================================ SVG: Zugprobe */
  function svgProbe(m, eps) {
    const g = Math.max(1, 12 / m.A), ev = eps * g / 100, xA = 72, L0 = 170, L = L0 * (1 + ev), cy = 56, rh = 25, r0 = 15;
    const broke = eps >= m.A - 1e-9, n = (m.type !== 'sprod' && eps > m.Ag) ? Math.min(1, (eps - m.Ag) / (m.A - m.Ag)) : 0;
    const xc = xA + L * 0.5, ru = r0 / Math.sqrt(1 + ev * 0.8), gap = broke ? 16 : 0;
    const rAt = x => { if (x <= xA - 18) return rh; if (x < xA) return rh - (rh - ru) * (x - (xA - 18)) / 18; if (x <= xA + L) return n > 0 ? ru * (1 - 0.62 * Math.pow(n, 0.7) * Math.exp(-Math.pow((x - xc) / 16, 2))) : ru; if (x < xA + L + 18) return ru + (rh - ru) * (x - (xA + L)) / 18; return rh; };
    /* Schulter rechts getrennt berechnen (übersichtlicher als eine Formel) */
    const prof = rAt;
    const poly = (x0, x1, shift) => { const top = [], bot = []; for (let x = x0; x <= x1 + 0.01; x += 3) { const r = prof(x - shift); top.push([x, cy - r]); bot.push([x, cy + r]); } bot.reverse(); return top.concat(bot).map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' '); };
    const xEnd = xA + L + 18 + 22;
    let s = '';
    if (!broke) s += `<polygon points="${poly(42, xEnd, 0)}" class="sv-steel"/>`;
    else s += `<polygon points="${poly(42, xc, 0)}" class="sv-steel"/><polygon points="${poly(xc + gap, xEnd + gap, gap)}" class="sv-steel"/>`;
    const xr = xEnd + (broke ? gap : 0);
    s += `<rect x="8" y="${cy - 34}" width="34" height="68" rx="3" class="sv-steel2"/><rect x="${xr}" y="${cy - 34}" width="34" height="68" rx="3" class="sv-steel2"/>`;
    s += `<line x1="16" y1="${cy - 34}" x2="16" y2="${cy + 34}" class="sv-edge"/><line x1="${xr + 26}" y1="${cy - 34}" x2="${xr + 26}" y2="${cy + 34}" class="sv-edge"/>`;
    const xB = xA + L + gap, yL = cy + rh + 16;
    s += `<line x1="${xA}" y1="${cy - rh - 6}" x2="${xA}" y2="${yL + 4}" class="c-guide"/><line x1="${xB}" y1="${cy - rh - 6}" x2="${xB}" y2="${yL + 4}" class="c-guide"/><line x1="${xA}" y1="${yL}" x2="${xB}" y2="${yL}" class="c-guide2"/>`;
    s += `<text x="${(xA + xB) / 2}" y="${yL + 13}" class="c-txt" text-anchor="middle" style="font-size:11px">Messlänge ${broke ? 'Lᵤ (nach dem Bruch zusammengelegt)' : 'L'}</text>`;
    s += `<text x="4" y="${cy + 49}" class="c-txt" style="font-size:12px">◀ F</text><text x="${xr + 38}" y="${cy + 49}" class="c-txt" text-anchor="end" style="font-size:12px">F ▶</text>`;
    return `<svg viewBox="0 0 420 120" class="probe" role="img" aria-label="Zugprobe, ${broke ? 'gebrochen' : n > 0 ? 'mit Einschnürung' : 'gedehnt'}">${s}</svg>${g > 1.05 ? '<div class="hint2" style="text-align:center;margin:0">Dehnung in der Zeichnung übertrieben dargestellt.</div>' : ''}`;
  }
  const PHASE = { ruhe: 'Probe unbelastet', elastisch: 'Elastischer Bereich: Es gilt Hooke (σ = E·ε). Entlastet, geht die Probe zurück.', fliessen: 'Fließen: Die Probe dehnt sich bei fast gleicher Spannung plastisch (bleibend).', verfestigung: 'Verfestigung: Die plastische Dehnung ist gleichmäßig, die Spannung steigt bis Rm.', einschnuerung: 'Einschnürung: Der Querschnitt wird an einer Stelle schnell kleiner, die technische Spannung fällt.', bruch: 'Bruch! Die Probe ist gerissen.' };

  /* ============================================================ Reiter Zugversuch */
  const curMat = () => mat(S.zug.mat);
  const S0Z = C.circleArea(10);
  function renderZug() {
    const m = curMat(), z = S.zug, c = z.calc;
    let h = `<div class="card pl"><h4>Zugversuch: Probe ziehen</h4>
      <div class="fbar">${MATS.map(x => `<button class="chip${x.id === m.id ? ' on' : ''}" data-zmat="${x.id}" aria-pressed="${x.id === m.id}">${esc(x.name)}</button>`).join('')}</div>
      <p class="hint2" style="margin:0 0 8px">${esc(m.info)}</p>
      <div class="cols"><div><div id="zChart"></div><div class="ctl"><button class="chip s${z.show ? ' on' : ''}" data-zshow="1" aria-pressed="${z.show}">Kennwerte zeigen</button>${m.type === 'rp' ? `<button class="chip s${z.off ? ' on' : ''}" data-zoff="1" aria-pressed="${z.off}">Parallele 0,2 %</button>` : ''}</div></div>
      <div><div id="zProbe"></div>
      <div class="ctl"><button class="chip" id="zPlay">▶ Probe ziehen</button><button class="chip" data-zreset="1">⟲ Neu einspannen</button></div>
      <input type="range" id="zSl" min="0" max="1000" step="1" value="0" aria-label="Dehnung einstellen"><div id="zRead"></div></div></div>
      <p class="hint2">Tippe oder ziehe im Diagramm, um die Dehnung selbst einzustellen. Probe: d₀ = 10 mm (S₀ = 78,5 mm²), Messlänge L₀ = 50 mm.</p></div>`;
    h += '<div id="zKv"></div>';
    h += '<div class="card pl"><h4>Anstieg der Hookeschen Geraden: Elastizitätsmodul E</h4><div id="zEl"></div></div>';
    h += `<div class="card pl"><h4>Rechner: Spannung, Dehnung, Bruchdehnung, Hooke</h4><div class="ctl"><button class="chip s" data-zrand="1">🎲 Zufallswerte</button><button class="chip s" data-zreset2="1">Beispielwerte</button></div><div class="cols">
      <div class="rdout" style="border-color:var(--accent)"><b>Spannung σ = F / S₀</b><div class="dsrow" style="margin-top:6px"><label class="f"><span>Durchmesser d₀ (mm)</span><input data-zc="d" inputmode="decimal" autocomplete="off" value="${esc(c.d)}"></label><label class="f"><span>Kraft F (kN)</span><input data-zc="F" inputmode="decimal" autocomplete="off" value="${esc(c.F)}"></label></div><div id="zc1"></div></div>
      <div class="rdout" style="border-color:var(--accent)"><b>Dehnung ε = ΔL / L₀</b><div class="dsrow" style="margin-top:6px"><label class="f"><span>Messlänge L₀ (mm)</span><input data-zc="L0" inputmode="decimal" autocomplete="off" value="${esc(c.L0)}"></label><label class="f"><span>Längenänderung ΔL (mm)</span><input data-zc="dL" inputmode="decimal" autocomplete="off" value="${esc(c.dL)}"></label></div><div id="zc2"></div></div>
      <div class="rdout" style="border-color:var(--accent)"><b>Bruchdehnung A = (Lᵤ − L₀) / L₀</b><div class="dsrow" style="margin-top:6px"><label class="f"><span>Anfangs-Messlänge L₀ (mm)</span><input data-zc="L0b" inputmode="decimal" autocomplete="off" value="${esc(c.L0b)}"></label><label class="f"><span>Messlänge nach Bruch Lᵤ (mm)</span><input data-zc="Lu" inputmode="decimal" autocomplete="off" value="${esc(c.Lu)}"></label></div><div id="zc3"></div></div>
      <div class="rdout" style="border-color:var(--accent)"><b>Hooke σ = E · ε</b><div class="dsrow" style="margin-top:6px"><label class="f"><span>E-Modul (N/mm²)</span><input data-zc="E" inputmode="decimal" autocomplete="off" value="${esc(c.E)}"></label><label class="f"><span>Dehnung ε (%)</span><input data-zc="eps" inputmode="decimal" autocomplete="off" value="${esc(c.eps)}"></label></div><div id="zc4"></div></div>
      </div></div>`;
    $('#zugView').innerHTML = h; updateZug(); updateZCalc();
    const sl = $('#zSl'); if (sl) sl.value = Math.round(z.eps / m.A * 1000);
  }
  function updateZug() {
    const m = curMat(), z = S.zug, e = clamp(z.eps, 0, m.A), ch = $('#zChart'); if (!ch) return;
    ch.innerHTML = svgChart(m, { eps: e, kv: z.show, off: z.off && z.show, cur: false });
    $('#zProbe').innerHTML = svgProbe(m, e);
    const sg = e > 0 ? C.sigmaAt(m, e) : 0, ph = C.phaseAt(m, e), sl = $('#zSl'); if (sl && document.activeElement !== sl) sl.value = Math.round(e / m.A * 1000);
    $('#zRead').innerHTML = `<div class="rdout ${ph === 'bruch' ? 'bad' : ''}"><b>ε = ${nd(e, e < 1 ? 3 : 1)} %</b> · <b>σ = ${nd(sg, 0)} N/mm²</b> · F = ${nd(sg * S0Z / 1000, 1)} kN<br>Messlänge L = ${nd(50 * (1 + e / 100), 2)} mm (ΔL = ${nd(50 * e / 100, 2)} mm)<br>${esc(PHASE[ph])}</div>`;
    const pb = $('#zPlay'); if (pb) pb.textContent = TW.zug ? '⏸ Anhalten' : (e >= m.A - 1e-9 ? '⟲ Nochmal ziehen' : '▶ Probe ziehen');
    renderZKv(m); const el = $('#zEl'); if (el && !el.dataset.m || (el && el.dataset.m !== m.id)) { const r = svgElastic(m); el.dataset.m = m.id; el.innerHTML = r.svg + `<div class="rdout"><b>E = Δσ / Δε</b> = ${nd(r.s2, 0)} N/mm² / ${nd(r.e2, 3)} % = ${nd(r.s2, 0)} / ${nd(r.e2 / 100, 5)} = <b>${nd(m.E, 0)} N/mm²</b>${m.type === 'sprod' ? '<br>Bei Grauguss ist die Kurve von Anfang an gekrümmt: Hier gilt der E-Modul nur als Anfangssteigung (Tangente), er ist je nach Gussqualität sehr verschieden.' : '<br>Die Gerade im elastischen Bereich ist steil. Je größer E, desto steifer der Werkstoff (Stahl ≈ 210 000, Kupfer ≈ 120 000, Aluminium ≈ 70 000 N/mm²).'}</div>`; }
  }
  function renderZKv(m) {
    const h = $('#zKv'); if (!h) return; const z = S.zug; const sig = `${z.show}|${m.id}`; if (h.dataset.sig === sig) return; h.dataset.sig = sig;
    if (!z.show) { h.innerHTML = ''; return; }
    const re = m.type === 're' ? ['Obere Streckgrenze Re (ReH)', m.Re, 'Gipfel der Kurve vor dem Fließen'] : m.type === 'rp' ? ['Dehngrenze Rp0,2', m.Rp, 'Parallele zur Hookeschen Geraden bei ε = 0,2 %, Schnittpunkt mit der Kurve'] : null;
    h.innerHTML = `<div class="card pl"><h4>Kennwerte aus dem Diagramm (Übungswerte)</h4><table class="tt"><tr><th>Kennwert</th><th class="n">Wert</th><th>So liest du ab</th></tr>
      ${re ? `<tr><td>${re[0]}</td><td class="n"><b>${nd(re[1], 0)} N/mm²</b></td><td>${esc(re[2])}</td></tr>` : '<tr><td>Streckgrenze</td><td class="n">keine</td><td>Spröder Bruch: Es gibt kein Fließen.</td></tr>'}
      <tr><td>Zugfestigkeit Rm</td><td class="n"><b>${nd(m.Rm, 0)} N/mm²</b></td><td>Höchster Punkt der Kurve (Höchstkraft / S₀)</td></tr>
      <tr><td>Bruchdehnung A</td><td class="n"><b>${nd(m.A, m.A < 1 ? 2 : 0)} %</b></td><td>Dehnung beim Bruch (hier ohne Rückfederung)</td></tr>
      <tr><td>E-Modul E</td><td class="n"><b>${nd(m.E, 0)} N/mm²</b></td><td>Steigung der Anfangsgeraden</td></tr></table></div>`;
  }
  /* Ablesen/Ziehen im Diagramm */
  function chartEps(m, svg, ev) { const r = svg.getBoundingClientRect(), xv = (ev.clientX - r.left) / r.width * 380; return clamp((xv - CH.L) / (CH.R - CH.L) * m.ax.xmax, 0, m.A); }
  let zDrag = false;
  $('#zugView').addEventListener('pointerdown', e => { const sv = e.target.closest('svg[data-chart]'); if (!sv || !sv.closest('#zChart')) return; zDrag = true; stopTween('zug'); S.zug.eps = chartEps(curMat(), sv, e); updateZug(); try { sv.setPointerCapture(e.pointerId); } catch (x) {} });
  $('#zugView').addEventListener('pointermove', e => { if (!zDrag) return; const sv = $('#zChart svg'); if (sv) { S.zug.eps = chartEps(curMat(), sv, e); updateZug(); } });
  ['pointerup', 'pointercancel'].forEach(ev => $('#zugView').addEventListener(ev, () => { zDrag = false; }));
  function zugPlay() {
    const m = curMat(); if (TW.zug) { stopTween('zug'); updateZug(); return; }
    if (S.zug.eps >= m.A - 1e-9) S.zug.eps = 0;
    const f0 = Math.pow(S.zug.eps / m.A, 1 / 1.6);
    tween('zug', f0, 1, 6500 * (1 - f0) + 300, f => { S.zug.eps = m.A * Math.pow(f, 1.6); updateZug(); }, () => { S.zug.eps = m.A; updateZug(); if (S.zug.eps >= m.A) { const F = fx(); if (F && F.sound) try { F.sound('sad', 0.3); } catch (x) {} } });
    updateZug();
  }
  $('#zugView').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const z = S.zug;
    if (b.dataset.zmat) { stopTween('zug'); z.mat = b.dataset.zmat; z.eps = 0; lsSet('zug', { mat: z.mat, calc: z.calc }); renderZug(); }
    else if (b.dataset.zshow) { z.show = !z.show; renderZug(); }
    else if (b.dataset.zoff) { z.off = !z.off; if (z.off) z.show = true; renderZug(); }
    else if (b.id === 'zPlay') zugPlay();
    else if (b.dataset.zreset) { stopTween('zug'); z.eps = 0; updateZug(); }
    else if (b.dataset.zrand) { const R = C.rng(String(R0()) + Math.random()), pk = a => C.pick(R, a); Object.assign(z.calc, { d: String(pk([6, 8, 10, 12, 16, 20])), F: nd(C.ri(R, 6, 90) / 2, 1), L0: String(pk([50, 80, 100])), dL: nd(C.ri(R, 5, 80) / 20, 2), L0b: String(pk([50, 80, 100])), Lu: '', E: String(pk([210000, 120000, 70000])), eps: nd(C.ri(R, 1, 20) / 20, 2) }); z.calc.Lu = nd(+z.calc.L0b * (1 + C.ri(R, 8, 40) / 100), 1); lsSet('zug', { mat: z.mat, calc: z.calc }); renderZug(); }
    else if (b.dataset.zreset2) { z.calc = Object.assign({}, ZC0); lsSet('zug', { mat: z.mat, calc: z.calc }); renderZug(); }
  });
  $('#zugView').addEventListener('input', e => {
    if (e.target.id === 'zSl') { stopTween('zug'); const m = curMat(); S.zug.eps = +e.target.value / 1000 * m.A; updateZug(); return; }
    const k = e.target.dataset.zc; if (k) { S.zug.calc[k] = e.target.value; lsSet('zug', { mat: S.zug.mat, calc: S.zug.calc }); updateZCalc(); }
  });
  function updateZCalc() {
    const c = S.zug.calc, P = C.parseDe, bad = '<span class="hint2">Bitte Zahlen eingeben (Komma ist erlaubt).</span>', set = (id, h) => { const el = $('#' + id); if (el) el.innerHTML = h; };
    const d = P(c.d), F = P(c.F), L0 = P(c.L0), dL = P(c.dL), L0b = P(c.L0b), Lu = P(c.Lu), E = P(c.E), ep = P(c.eps), ok = a => a.every(v => isFinite(v));
    set('zc1', ok([d, F]) && d > 0 ? `S₀ = π·d²/4 = <b>${nd(C.circleArea(d), 2)} mm²</b><br>σ = ${nd(F * 1000, 0)} N / ${nd(C.circleArea(d), 2)} mm² = <b>${nd(C.stress(F * 1000, C.circleArea(d)), 1)} N/mm²</b>` : bad);
    set('zc2', ok([L0, dL]) && L0 > 0 ? `ε = ${nd(dL, 3)} / ${nd(L0, 2)} · 100 % = <b>${nd(C.strainPct(dL, L0), 3)} %</b>` : bad);
    set('zc3', ok([L0b, Lu]) && L0b > 0 ? `A = (${nd(Lu, 2)} − ${nd(L0b, 2)}) / ${nd(L0b, 2)} · 100 % = <b>${nd(C.elongationA(L0b, Lu), 2)} %</b>` : bad);
    set('zc4', ok([E, ep]) && E > 0 ? `σ = ${nd(E, 0)} · ${nd(ep / 100, 5)} = <b>${nd(C.hookeStress(E, ep), 1)} N/mm²</b><br><span class="hint2">Nur im elastischen Bereich gültig (σ unter Re bzw. Rp0,2).</span>` : bad);
  }

  /* ============================================================ SVG: Härteprüfung */
  const parse = C.parseDe;
  function hbVals() { const h = S.haerte, d = parse(h.d), Dd = h.D, F = C.brinellForce(h.X, Dd); return { D: Dd, X: h.X, d, F, hb: isFinite(d) ? C.hbw(Dd, F, d) : NaN, valid: isFinite(d) && C.brinellValid(Dd, d) }; }
  function svgIndent(kind, p) {
    const h = S.haerte; let s = '', sy = 118; const wp = `<rect x="14" y="${sy}" width="372" height="72" class="sv-steel"/><line x1="14" y1="${sy}" x2="386" y2="${sy}" class="sv-edge"/>`;
    let cap = '';
    if (kind === 'hb') {
      const v = hbVals(), k = 92 / v.D, R = 46, ok = isFinite(v.d) && v.d > 0 && v.d < v.D, t = ok ? (v.D - Math.sqrt(v.D * v.D - v.d * v.d)) / 2 * k : 4, cx = 130;
      let dd = 0, cyb; if (p < 0.4) { cyb = sy - R - 46 * (1 - p / 0.4); } else if (p < 0.7) { dd = t * (p - 0.4) / 0.3; cyb = sy - R + dd; } else { dd = t; cyb = sy - R + t - 40 * (p - 0.7) / 0.3; }
      const cw = dd > 0 ? 2 * Math.sqrt(Math.max(0, 2 * R * dd - dd * dd)) : 0;
      s += wp; if (dd > 0.2) s += `<path d="M${cx - cw / 2} ${sy} A${R} ${R} 0 0 0 ${cx + cw / 2} ${sy}Z" class="sv-dent"/>`;
      s += `<circle cx="${cx}" cy="${cyb}" r="${R}" class="sv-ball"/><text x="${cx}" y="${cyb + 4}" class="sv-txt" text-anchor="middle">D = ${nd(v.D, 1)} mm</text>`;
      if (p >= 0.4 && p < 0.7) s += `<text x="${cx + R + 8}" y="${cyb - 22}" class="c-txt" style="font-size:13px;fill:var(--hi)">▼ F</text>`;
      const dp = ok ? v.d * k : 0; s += `<text x="300" y="30" class="c-txt" text-anchor="middle" style="font-size:11px">Draufsicht auf den Eindruck</text>`;
      if (p >= 0.7 && ok) s += `<circle cx="300" cy="72" r="${dp / 2}" class="sv-dent"/><line x1="${300 - dp / 2}" y1="72" x2="${300 + dp / 2}" y2="72" class="c-kv" style="stroke-dasharray:none"/><text x="300" y="${72 + dp / 2 + 14}" class="c-kt" text-anchor="middle">d = ${nd(v.d, 2)} mm</text>`;
      cap = p < 0.4 ? 'Kugel nähert sich der Probe.' : p < 0.7 ? 'Prüfkraft F wirkt (ca. 10 bis 15 s).' : 'Entlastet: Der bleibende Eindruck wird mit dem Messmikroskop ausgemessen.';
    } else if (kind === 'hv') {
      const d1 = parse(h.d1), d2 = parse(h.d2), dm = (d1 + d2) / 2, ok = isFinite(dm) && dm > 0, dp = ok ? clamp(dm * 190, 24, 96) : 40, cx = 130, tdep = dp / 7;
      let dd = 0, apex; if (p < 0.4) apex = sy - 4 - 46 * (1 - p / 0.4); else if (p < 0.7) { dd = tdep * (p - 0.4) / 0.3; apex = sy + dd; } else { dd = tdep; apex = sy + tdep - 40 * (p - 0.7) / 0.3; }
      s += wp; const hw = Math.max(1, (apex - sy) > 0 ? 0 : 0);
      if (dd > 0.3) s += `<polygon points="${cx - dd * 2.47},${sy} ${cx},${sy + dd} ${cx + dd * 2.47},${sy}" class="sv-dent"/>`;
      s += `<polygon points="${cx},${apex} ${cx - 40},${apex - 16} ${cx - 40},${apex - 56} ${cx + 40},${apex - 56} ${cx + 40},${apex - 16}" class="sv-ball"/><text x="${cx}" y="${apex - 34}" class="sv-txt" text-anchor="middle">136°</text>`;
      if (p >= 0.4 && p < 0.7) s += `<text x="${cx + 48}" y="${apex - 36}" class="c-txt" style="font-size:13px;fill:var(--hi)">▼ F</text>`;
      s += `<text x="300" y="30" class="c-txt" text-anchor="middle" style="font-size:11px">Draufsicht auf den Eindruck</text>`;
      if (p >= 0.7 && ok) s += `<polygon points="${300 - dp / 2},72 300,${72 - dp / 2} ${300 + dp / 2},72 300,${72 + dp / 2}" class="sv-dent"/><line x1="${300 - dp / 2}" y1="72" x2="${300 + dp / 2}" y2="72" class="c-kv" style="stroke-dasharray:none"/><line x1="300" y1="${72 - dp / 2}" x2="300" y2="${72 + dp / 2}" class="c-kv" style="stroke-dasharray:none"/><text x="${300 + dp / 2 + 5}" y="${72 - 4}" class="c-kt">d₁</text><text x="304" y="${72 - dp / 2 - 4}" class="c-kt">d₂</text>`;
      cap = p < 0.4 ? 'Diamantpyramide (136°) nähert sich.' : p < 0.7 ? 'Prüfkraft F wirkt (10 bis 15 s).' : 'Entlastet: Beide Diagonalen d₁ und d₂ des quadratischen Eindrucks werden gemessen.';
    } else {
      const hh = parse(h.h), ok = isFinite(hh) && hh > 0 && hh < 0.2, hp = ok ? hh * 450 : 30, h0 = 10, el = 8, cx = 130;
      let depth, ph; if (p < 0.34) { depth = h0 * p / 0.34; ph = 1; } else if (p < 0.67) { depth = h0 + (hp + el) * (p - 0.34) / 0.33; ph = 2; } else { depth = h0 + hp + el * (1 - (p - 0.67) / 0.33); ph = 3; }
      const ap = sy + depth - (p < 0.34 ? 0 : 0), apex = p === 0 ? sy - 30 : ap;
      s += wp;
      if (p >= 0.34) s += `<polygon points="${cx - (h0 + hp) * 1.73},${sy} ${cx},${sy + h0 + hp} ${cx + (h0 + hp) * 1.73},${sy}" class="sv-dent"/>`;
      s += `<line x1="40" y1="${sy + h0}" x2="${cx + 150}" y2="${sy + h0}" class="c-guide2"/><text x="${cx + 154}" y="${sy + h0 + 4}" class="c-txt">Nullebene</text>`;
      s += `<polygon points="${cx},${apex} ${cx - 42},${apex - 24} ${cx - 42},${apex - 60} ${cx + 42},${apex - 60} ${cx + 42},${apex - 24}" class="sv-ball"/><text x="${cx}" y="${apex - 40}" class="sv-txt" text-anchor="middle">120°</text>`;
      if (p >= 0.67) s += `<line x1="${cx + 70}" y1="${sy + h0}" x2="${cx + 70}" y2="${sy + h0 + hp}" class="c-kv" style="stroke-dasharray:none"/><text x="${cx + 76}" y="${sy + h0 + hp / 2 + 4}" class="c-kt">h = ${nd(ok ? hh : 0, 3)} mm</text>`;
      cap = ph === 1 ? '① Vorkraft F₀ = 98 N: Das ist die Nullebene für die Tiefenmessung.' : ph === 2 ? '② Gesamtkraft F = 1471 N (Vorkraft + 1373 N Zusatzkraft): Der Kegel dringt tiefer ein.' : '③ Zusatzkraft weg, Vorkraft bleibt: Die bleibende Tiefe h wird angezeigt. Kleine Tiefe = hart.';
    }
    return `<svg viewBox="0 0 400 200" class="probe" role="img" aria-label="Animation Härteprüfung">${s}</svg><div class="hint2" style="text-align:center;margin:0 0 4px" id="hCap">${esc(cap)}</div>`;
  }
  function renderHaerte() {
    const hh = S.haerte, m = hh.m, info = D.hardness.find(x => x.id === m);
    let h = `<div class="card pl"><h4>Härteprüfverfahren</h4><div class="fbar">${segHTML('hm', [['hb', 'Brinell'], ['hv', 'Vickers'], ['hrc', 'Rockwell C']], m)}</div>
      <div id="hSvg"></div><div class="ctl"><button class="chip" id="hPlay">▶ Eindringen zeigen</button></div><input type="range" id="hSl" min="0" max="1000" value="${Math.round(hh.p * 1000)}" aria-label="Ablauf der Prüfung">
      <div class="rdout" style="margin-top:8px"><b>${esc(info.name)}</b><br>Eindringkörper: ${esc(info.body)}<br>Gemessen wird: ${esc(info.measure)}<br><b>Geeignet für:</b> ${esc(info.good)}<br><b>Grenzen:</b> ${esc(info.limit)}</div></div>`;
    h += '<div class="card pl"><h4>Härte berechnen</h4><div id="hCalc"></div></div>';
    h += `<div class="card pl"><h4>Zugfestigkeit aus der Härte schätzen</h4><label class="f" style="max-width:240px"><span>Brinellhärte in HB</span><input id="hbIn" inputmode="decimal" autocomplete="off" value="${esc(hh.hb)}"></label><div id="hRm"></div>
      <p class="hint2"><b>Nur ein Richtwert:</b> Die Faustformel Rm ≈ 3,5 · HB gilt nur für unlegierte und niedrig legierte Stähle (etwa bis 400 HB). Für Guss, Aluminium, Kupfer oder gehärtete Stähle stimmt sie nicht. Sie ersetzt keinen Zugversuch.</p></div>`;
    h += `<div class="card pl"><h4>Näherung HRC ↔ HV (gerundete Richtwerte)</h4><table class="tt"><tr><th>HRC</th>${C.HRC_HV.map(r => `<td class="n"><b>${r[0]}</b></td>`).join('')}</tr><tr><th>≈ HV</th>${C.HRC_HV.map(r => `<td class="n">${r[1]}</td>`).join('')}</tr></table><p class="hint2">Umwertung nach Tabellenbuch (zum Beispiel DIN EN ISO 18265). Die Werte gelten nur für Stahl und sind grob. Im Tabellenbuch gegenprüfen.</p></div>`;
    h += '<div id="qzH"></div>';
    $('#haerteView').innerHTML = h; updateHSvg(); updateHCalc(); updateHRm(); renderQuiz('haerte');
  }
  const updateHSvg = () => { const el = $('#hSvg'); if (el) el.innerHTML = svgIndent(S.haerte.m, S.haerte.p); };
  function updateHCalc(outOnly) {
    const hh = S.haerte, m = hh.m, host = $('#hCalc'); if (!host) return; lsSet('haerte', hh);
    let x = '';
    if (m === 'hb') {
      const v = hbVals();
      x = `<div class="fbar"><span class="lbl">Kugel D (mm)</span>${segHTML('hdia', [[10, '10'], [5, '5'], [2.5, '2,5']], hh.D)}<span class="lbl">Prüfkraft-Kennzahl X</span>${segHTML('hxx', [[30, '30 (Stahl)'], [10, '10'], [5, '5'], [2.5, '2,5']], hh.X)}</div>
        <label class="f" style="max-width:260px"><span>Eindruckdurchmesser d (mm)</span><input id="hd" inputmode="decimal" autocomplete="off" value="${esc(hh.d)}"></label>
        <div class="rdout"><b>Prüfkraft:</b> F = X · D² · 9,807 = ${nd(v.X, 1)} · ${nd(v.D * v.D, 2)} · 9,807 = ${nd(v.F, 0)} N<br>`;
      if (!isFinite(v.d) || v.d <= 0) x += 'Bitte einen Durchmesser eingeben.';
      else if (v.d >= v.D) x += 'Der Eindruck kann nicht größer sein als die Kugel.';
      else { const s = Math.sqrt(v.D * v.D - v.d * v.d); x += `√(D² − d²) = ${nd(s, 3)} mm<br><b>HBW = 0,102 · 2F / (π · D · (D − √(D² − d²))) = ${nd(v.hb, 1)}</b><br>Angabe: <b>${nd(v.hb, 0)} HBW ${nd(v.D, 1)}/${nd(v.X * v.D * v.D, 0)}</b>`; if (!v.valid) x += `<br><span style="color:var(--warn)">Gültig ist nur d zwischen 0,24 · D und 0,6 · D (${nd(0.24 * v.D, 2)} bis ${nd(0.6 * v.D, 2)} mm). Wähle X oder D passend zum Werkstoff.</span>`; }
      x += '</div>';
    } else if (m === 'hv') {
      const F = hh.hvF, d1 = parse(hh.d1), d2 = parse(hh.d2), dm = (d1 + d2) / 2;
      x = `<div class="fbar"><span class="lbl">Prüfkraft</span>${segHTML('hfor', [[9.807, 'HV 1'], [49.03, 'HV 5'], [98.07, 'HV 10'], [294.2, 'HV 30']], hh.hvF)}</div>
        <div class="dsrow"><label class="f"><span>Diagonale d₁ (mm)</span><input id="hd1" inputmode="decimal" autocomplete="off" value="${esc(hh.d1)}"></label><label class="f"><span>Diagonale d₂ (mm)</span><input id="hd2" inputmode="decimal" autocomplete="off" value="${esc(hh.d2)}"></label></div><div class="rdout">`;
      if (!isFinite(dm) || dm <= 0) x += 'Bitte beide Diagonalen eingeben.';
      else { const v = C.hv(F, dm); x += `Mittelwert d = (d₁ + d₂)/2 = ${nd(dm, 4)} mm<br><b>HV = 0,1891 · F / d² = 0,1891 · ${nd(F, 2)} N / ${nd(dm * dm, 4)} mm² = ${nd(v, 1)}</b><br>Angabe: <b>${nd(v, 0)} HV ${F < 20 ? 1 : F < 70 ? 5 : F < 200 ? 10 : 30}</b>`; }
      x += '</div>';
    } else {
      const hv_ = parse(hh.h);
      x = `<label class="f" style="max-width:260px"><span>Bleibende Eindringtiefe h (mm)</span><input id="hh" inputmode="decimal" autocomplete="off" value="${esc(hh.h)}"></label><div class="rdout">`;
      if (!isFinite(hv_) || hv_ <= 0) x += 'Bitte eine Tiefe eingeben.';
      else { const c = C.hrc(hv_), ap = C.hrcToHv(c); x += `Skalenteile = h / 0,002 mm = ${nd(hv_ / 0.002, 1)}<br><b>HRC = 100 − h / 0,002 mm = ${nd(c, 1)}</b>`; if (c < 20 || c > 70) x += '<br><span style="color:var(--warn)">HRC ist nur etwa zwischen 20 und 70 sinnvoll (darunter Rockwell B).</span>'; else if (isFinite(ap)) x += `<br>Ungefähr ${nd(ap, 0)} HV (Näherung).`; }
      x += '</div>';
    }
    if (outOnly) { const tmp = document.createElement('div'); tmp.innerHTML = x; const o = tmp.querySelector('.rdout:last-child'), cur = host.querySelector('.rdout:last-child'); if (o && cur) { cur.innerHTML = o.innerHTML; return; } }
    host.innerHTML = x;
  }
  function updateHRm() { const el = $('#hRm'); if (!el) return; const hb = parse(S.haerte.hb); lsSet('haerte', S.haerte); el.innerHTML = isFinite(hb) && hb > 0 ? `<div class="rdout">Rm ≈ 3,5 · HB = 3,5 · ${nd(hb, 0)} = <b>${nd(C.rmFromHB(hb), 0)} N/mm²</b> <span class="hint2">(Richtwert)</span></div>` : '<div class="rdout bad">Bitte eine Zahl eingeben.</div>'; }
  $('#haerteView').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const hh = S.haerte;
    if (b.dataset.hm) { stopTween('h'); hh.m = b.dataset.hm; hh.p = 1; lsSet('haerte', hh); renderHaerte(); }
    else if (b.id === 'hPlay') { if (TW.h) { stopTween('h'); return; } hh.p = 0; updateHSvg(); tween('h', 0, 1, 4200, p => { hh.p = p; updateHSvg(); const sl = $('#hSl'); if (sl) sl.value = Math.round(p * 1000); }); }
    else if (b.dataset.hdia) { hh.D = +b.dataset.hdia; updateHCalc(); updateHSvg(); }
    else if (b.dataset.hxx) { hh.X = +b.dataset.hxx; updateHCalc(); }
    else if (b.dataset.hfor) { hh.hvF = +b.dataset.hfor; updateHCalc(); }
  });
  $('#haerteView').addEventListener('input', e => {
    const hh = S.haerte, id = e.target.id;
    if (id === 'hSl') { stopTween('h'); hh.p = +e.target.value / 1000; updateHSvg(); return; }
    if (id === 'hd') hh.d = e.target.value; else if (id === 'hd1') hh.d1 = e.target.value; else if (id === 'hd2') hh.d2 = e.target.value; else if (id === 'hh') hh.h = e.target.value; else if (id === 'hbIn') { hh.hb = e.target.value; updateHRm(); return; } else return;
    lsSet('haerte', hh); updateHCalc(true); if (hh.p >= 0.7) updateHSvg();
  });

  /* ============================================================ Generisches Quiz (Auswahl, Zähler) */
  const QZ = {
    haerte: { host: '#qzH', title: 'Welches Verfahren passt?', items: () => D.hardUses.map(u => ({ title: u.title, text: u.text, options: D.hardOptions, correct: D.hardOptions.indexOf(u.correct), why: u.why })) },
    wb: { host: '#qzW', title: 'Welche Behandlung für welches Ziel?', items: () => D.heatGoals.map(u => ({ title: u.title, text: u.text, options: D.heatOptions, correct: D.heatOptions.indexOf(u.correct), why: u.why })) },
    wahl: { host: '#qzK', title: 'Welche Werkstoffgruppe passt?', items: () => D.wahlCases.map((c, i) => { const R = C.rng('wc' + i), rest = D.groups.filter(g => g.id !== c.correct).map(g => [R(), g]).sort((a, b) => a[0] - b[0]).slice(0, 3).map(x => x[1]), opts = [D.groups.find(g => g.id === c.correct)].concat(rest), rk = C.rank(D.groups, c.w); return { title: c.title, text: c.text + ' Anforderungen: ' + C.PROPS.filter(p => c.w[p]).map(p => D.propLabels[p] + (c.w[p] > 1 ? ' (sehr wichtig)' : '')).join(', ') + '.', options: opts.map(g => g.name), correct: 0, why: 'Beste Punktzahl: ' + D.groups.find(g => g.id === rk.best[0]).name + ' mit ' + rk.max + ' Punkten. ' + D.groups.find(g => g.id === c.correct).note + '.' }; }) },
    name: { host: '#qzN', title: 'Zu welcher Gruppe gehört der Name?', items: () => D.nameQuizList.map((n, i) => { const r = C.decode(n), R = C.rng('nq' + i), keys = Object.keys(SHORTG), rest = keys.filter(k => k !== r.group).map(k => [R(), k]).sort((a, b) => a[0] - b[0]).slice(0, 3).map(x => x[1]); return { title: n, text: 'Zu welcher Werkstoffgruppe gehört dieser Kurzname?', options: [r.group].concat(rest).map(k => SHORTG[k]), correct: 0, why: r.groupLabel + '. ' + r.parts.map(p => p.t + ' = ' + p.txt).join('; ') + '.' }; }) }
  };
  const SHORTG = { bau: 'Baustahl (unlegiert)', unleg: 'Unlegierter Stahl nach C-Gehalt', nied: 'Niedrig legierter Stahl', hoch: 'Hoch legierter Stahl', auto: 'Automatenstahl', guss: 'Gusseisen', alu: 'Aluminium-Knetlegierung' };
  const qOrder = (key, i, n) => { const R = C.rng('qo' + key + i), o = [...Array(n).keys()]; for (let j = n - 1; j > 0; j--) { const k = Math.floor(R() * (j + 1)); [o[j], o[k]] = [o[k], o[j]]; } return o; };
  function renderQuiz(key) {
    const q = QZ[key], host = $(q.host); if (!host) return;
    const items = q.items(), st = S.q[key] || (S.q[key] = { i: 0, sel: -1, res: null }), stat = lsGet('quiz', {})[key] || { n: 0, ok: 0 }, idx = st.i % items.length, it = items[idx], ord = qOrder(key, idx, it.options.length);
    let h = `<div class="card pl"><h4>${esc(q.title)} (${idx + 1}/${items.length}) · richtig: ${stat.ok} von ${stat.n}</h4><div class="big">${esc(it.title)}</div><p style="margin:4px 0 8px">${esc(it.text)}</p>
      <div class="opts">${ord.map((o, i) => `<button data-qk="${key}" data-qo="${i}" ${st.res ? 'disabled' : ''} class="${st.res ? (o === it.correct ? 'ok' : i === st.sel ? 'bad' : '') : i === st.sel ? 'on' : ''}">${esc(it.options[o])}</button>`).join('')}</div>`;
    if (st.res) h += `<div class="fb ${st.res.ok ? 'ok' : 'bad'}"><span class="v">${st.res.ok ? '✓ Richtig!' : '✗ Leider nicht.'}</span> Richtig ist: ${esc(it.options[it.correct])}. ${esc(it.why)}</div><div class="btns"><button class="btn pri" data-qk="${key}" data-qn="next">Nächster Fall</button></div>`;
    else h += `<div class="btns"><button class="btn pri" data-qk="${key}" data-qn="chk"${st.sel >= 0 ? '' : ' disabled'}>✓ Prüfen</button></div>`;
    host.innerHTML = h + '</div>';
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-qk]'); if (!b) return; const key = b.dataset.qk, q = QZ[key]; if (!q) return; const st = S.q[key] || (S.q[key] = { i: 0, sel: -1, res: null }), items = q.items(), idx = st.i % items.length;
    if (b.dataset.qo != null) { if (st.res) return; st.sel = +b.dataset.qo; renderQuiz(key); }
    else if (b.dataset.qn === 'chk') { const ord = qOrder(key, idx, items[idx].options.length), ok = ord[st.sel] === items[idx].correct, all = lsGet('quiz', {}), s = all[key] || { n: 0, ok: 0 }; s.n++; if (ok) s.ok++; all[key] = s; lsSet('quiz', all); st.res = { ok }; renderQuiz(key); if (ok) ding(); else sad(); }
    else if (b.dataset.qn === 'next') { st.i++; st.sel = -1; st.res = null; renderQuiz(key); }
  });

  /* ============================================================ Reiter Bezeichnungen */
  const PAL = ['#9ad0ff', '#ffd29a', '#b5e8a5', '#f3b3e6', '#ffe38a', '#b9c4ff', '#ffb0a8'];
  function renderName() {
    const v = S.name.v;
    let h = `<div class="card pl"><h4>Kurznamen entschlüsseln (DIN EN 10027-1)</h4>
      <label class="f"><span>Kurzname eingeben (Groß- und Kleinschreibung beachten)</span><input id="nmIn" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(v)}" placeholder="z. B. 42CrMo4"></label>
      <div class="ctl">${D.nameExamples.map(n => `<button class="chip s" data-nm="${esc(n)}">${esc(n)}</button>`).join('')}</div><div id="nmRes"></div></div>`;
    h += `<div class="card pl"><h4>Merkregeln</h4><table class="tt"><tr><th>Anfang des Namens</th><th>Gruppe</th><th>Beispiel</th></tr>
      <tr><td>S, E oder P + 3 Ziffern</td><td>Baustahl nach Verwendung: Ziffern = Mindest-Streckgrenze in N/mm²</td><td>S235JR, E295</td></tr>
      <tr><td>C + Zahl</td><td>unlegierter Stahl: Zahl / 100 = % C</td><td>C45 = 0,45 % C</td></tr>
      <tr><td>Zahl + Elemente + Kennzahlen</td><td>niedrig legiert (alle Elemente unter 5 %): Zahl / 100 = % C, Kennzahl / Faktor = % des ersten Elements</td><td>42CrMo4, 16MnCr5</td></tr>
      <tr><td>X + Zahl + Elemente + Prozente</td><td>hoch legiert (mind. ein Element ≥ 5 %): Gehalte direkt in %</td><td>X5CrNi18-10</td></tr>
      <tr><td>EN-GJL / EN-GJS</td><td>Gusseisen mit Lamellen-/Kugelgraphit, danach Rm (und A)</td><td>EN-GJL-200</td></tr>
      <tr><td>EN AW-</td><td>Aluminium-Knetlegierung, erste Ziffer = Legierungsgruppe</td><td>EN AW-6082</td></tr></table>
      <p class="hint2"><b>Faktoren für die Kennzahl:</b> Cr, Co, Mn, Ni, Si, W: 4 · Al, Cu, Mo, Nb, Ti, V, Zr: 10 · C, N, P, S: 100 · B: 1000. Beispiel 42CrMo4: Cr 4 / 4 = 1 %.</p></div><div id="qzN"></div>`;
    $('#nameView').innerHTML = h; updateName(); renderQuiz('name');
  }
  function updateName() {
    const host = $('#nmRes'); if (!host) return; const r = C.decode(S.name.v); lsSet('name', S.name);
    if (!r.ok) { host.innerHTML = `<div class="rdout bad">${esc(r.error)}</div>`; return; }
    const info = D.nameInfo[r.name.replace(/\s+/g, ' ')];
    host.innerHTML = `<div style="margin:6px 0">${r.parts.map((p, i) => `<span class="np" style="background:${PAL[i % PAL.length]}">${esc(p.t)}</span>`).join('')}</div>
      <table class="tt">${r.parts.map((p, i) => `<tr><td style="width:1%"><span class="np" style="background:${PAL[i % PAL.length]};font-size:13px">${esc(p.t)}</span></td><td>${esc(p.txt)}</td></tr>`).join('')}</table>
      <div class="rdout ok"><b>Gruppe:</b> ${esc(r.groupLabel)}${info ? '<br><b>Typisch:</b> ' + esc(info) : ''}</div>`;
  }
  $('#nameView').addEventListener('input', e => { if (e.target.id === 'nmIn') { S.name.v = e.target.value; updateName(); } });
  $('#nameView').addEventListener('click', e => { const b = e.target.closest('[data-nm]'); if (b) { S.name.v = b.dataset.nm; const i = $('#nmIn'); if (i) i.value = S.name.v; updateName(); } });

  /* ============================================================ SVG: Eisen-Kohlenstoff-Diagramm */
  const FG = { L: 50, R: 392, T: 14, B: 276, cmax: 2.2, tmax: 1000 };
  const fcx = c => FG.L + c / FG.cmax * (FG.R - FG.L), fcy = t => FG.B - t / FG.tmax * (FG.B - FG.T);
  function svgFec(Cc, T) {
    const E = C.FEC, pt = a => a.map(p => fcx(p[0]).toFixed(1) + ',' + fcy(p[1]).toFixed(1)).join(' '), c1000 = E.CS + (1000 - E.A1) / ((E.ACM_MAX - E.A1) / (E.CMAX - E.CS));
    let s = '';
    s += `<polygon points="${pt([[0, 0], [E.CS, 0], [E.CS, E.A1], [0, E.A1]])}" class="fe-fp"/><polygon points="${pt([[E.CS, 0], [E.CMAX, 0], [E.CMAX, E.A1], [E.CS, E.A1]])}" class="fe-pz"/>`;
    s += `<polygon points="${pt([[0, E.A1], [E.CS, E.A1], [0, E.A3_0]])}" class="fe-ga"/><polygon points="${pt([[E.CS, E.A1], [E.CMAX, E.A1], [E.CMAX, 1000], [c1000, 1000]])}" class="fe-gz"/><polygon points="${pt([[0, E.A3_0], [E.CS, E.A1], [c1000, 1000], [0, 1000]])}" class="fe-g"/>`;
    s += `<rect x="${fcx(E.CMAX)}" y="${FG.T}" width="${FG.R - fcx(E.CMAX)}" height="${FG.B - FG.T}" class="fe-no"/>`;
    for (let t = 0; t <= 1000; t += 200) s += `<line x1="${FG.L}" x2="${FG.R}" y1="${fcy(t)}" y2="${fcy(t)}" class="c-grid"/><text x="${FG.L - 6}" y="${fcy(t) + 3.5}" class="c-txt" text-anchor="end">${t}</text>`;
    for (let c = 0; c <= 2.0001; c += 0.4) s += `<line x1="${fcx(c)}" x2="${fcx(c)}" y1="${FG.T}" y2="${FG.B}" class="c-grid"/><text x="${fcx(c)}" y="${FG.B + 14}" class="c-txt" text-anchor="middle">${nd(c, 1)}</text>`;
    /* Härtebereich */
    const hb = [], hb2 = []; for (let c = 0.2; c <= 0.8001; c += 0.1) { hb.push([c, C.a3(c) + 50]); hb2.push([c, C.a3(c) + 30]); } hb.push([E.CS, E.A1 + 50]); hb2.push([E.CS, E.A1 + 30]); hb.push([E.CMAX, E.A1 + 50]); hb2.push([E.CMAX, E.A1 + 30]);
    s += `<polygon points="${pt(hb.concat(hb2.reverse()))}" class="fe-h"/>`;
    s += `<polyline points="${pt([[0, E.A3_0], [E.CS, E.A1], [c1000, 1000]])}" class="fe-line"/><line x1="${fcx(0)}" x2="${fcx(E.CMAX)}" y1="${fcy(E.A1)}" y2="${fcy(E.A1)}" class="fe-line"/>`;
    s += `<line x1="${fcx(E.CS)}" x2="${fcx(E.CS)}" y1="${fcy(0)}" y2="${fcy(E.A1)}" class="c-guide2"/><circle cx="${fcx(E.CS)}" cy="${fcy(E.A1)}" r="3.6" class="c-dot"/>`;
    const L = (c, t, txt, a) => `<text x="${fcx(c)}" y="${fcy(t)}" class="fe-t" text-anchor="${a || 'middle'}">${txt}</text>`;
    s += L(0.4, 400, 'Ferrit + Perlit') + L(1.43, 400, 'Perlit + Zementit') + L(0.95, 880, 'Austenit γ') + L(0.25, 790, 'γ+α') + L(1.7, 840, 'γ + Zementit') + L(0.82, 0, '') ;
    s += `<text x="${fcx(0.01) + 4}" y="${fcy(E.A3_0) - 5}" class="c-kt" style="font-size:9.5px">A₃ 911 °C</text><text x="${fcx(1.0)}" y="${fcy(E.A1) + 11}" class="c-kt" style="font-size:9.5px">A₁ 723 °C</text><text x="${fcx(E.CS) + 6}" y="${fcy(E.A1) - 6}" class="c-kt" style="font-size:9.5px">S 0,8 % C</text><text x="${fcx(1.45)}" y="${fcy(900)}" class="c-kt" style="font-size:9.5px" transform="rotate(-38 ${fcx(1.45)} ${fcy(900)})">A_cm</text>`;
    s += `<text x="${fcx(E.CMAX) + 4}" y="${fcy(520)}" class="c-txt" style="font-size:9px" transform="rotate(-90 ${fcx(E.CMAX) + 12} ${fcy(520)})">Gusseisen: nicht betrachtet</text>`;
    s += `<text x="${fcx(0.44)}" y="${fcy(1000) + 11}" class="c-kt" style="font-size:9.5px;fill:var(--hi)">Härtebereich (30 bis 50 °C über A₃ bzw. A₁)</text>`;
    s += `<line x1="${FG.L}" x2="${FG.R}" y1="${FG.B}" y2="${FG.B}" class="c-ax"/><line x1="${FG.L}" x2="${FG.L}" y1="${FG.T}" y2="${FG.B}" class="c-ax"/>`;
    s += `<text x="${(FG.L + FG.R) / 2}" y="${FG.B + 30}" class="c-txt" text-anchor="middle" style="font-size:11px">Kohlenstoffgehalt in % (Massenanteil)</text><text transform="translate(12 ${(FG.T + FG.B) / 2}) rotate(-90)" class="c-txt" text-anchor="middle" style="font-size:11px">Temperatur in °C</text>`;
    const px = fcx(Cc), py = fcy(T); s += `<line x1="${px}" x2="${px}" y1="${py}" y2="${FG.B}" class="c-cur"/><line x1="${FG.L}" x2="${px}" y1="${py}" y2="${py}" class="c-cur"/><circle cx="${px}" cy="${py}" r="6" class="c-mark"/>`;
    return `<svg viewBox="0 0 400 312" class="chart" data-fec="1" role="img" aria-label="Vereinfachtes Eisen-Kohlenstoff-Diagramm, Stahlseite">${s}<rect x="${FG.L}" y="${FG.T}" width="${fcx(E.CMAX) - FG.L}" height="${FG.B - FG.T}" fill="transparent" data-hit="1"/></svg>`;
  }
  /* Schliffbild (schematisch): Körner aus versetztem Gitter */
  function svgGrain(st, Cc) {
    const nx = 9, ny = 7, w = 340 / nx, hgt = 220 / ny, G = C.rng('grain'), V = []; for (let j = 0; j <= ny; j++) { V[j] = []; for (let i = 0; i <= nx; i++) V[j][i] = [i * w + (i > 0 && i < nx ? (G() - 0.5) * w * 0.7 : 0), j * hgt + (j > 0 && j < ny ? (G() - 0.5) * hgt * 0.7 : 0)]; }
    const col = { ferrit: '#eef0f3', perlit: 'url(#pearl)', gamma: '#c7ccd6' }; let cells = '', lw = 1.2, lc = '#6b7480';
    const zem = st.key === 'perlit_zem' ? 1 + (st.parts[1].p / 21.5) * 4 : st.key === 'gamma_zem' ? 1 + (st.share || 0) * 3.5 : 0;
    const pp = st.key === 'ferrit_perlit' ? Cc / 0.8 : st.key === 'perlit' || st.key === 'perlit_zem' ? 1 : 0, ap = st.key === 'gamma_alpha' ? clamp(0.15 + 0.8 * (st.share || 0), 0, 0.95) : 0;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const r = G(); let f;
      if (st.key === 'ferrit') f = col.ferrit; else if (st.key === 'perlit' || st.key === 'perlit_zem') f = col.perlit; else if (st.key === 'ferrit_perlit') f = r < pp ? col.perlit : col.ferrit; else if (st.key === 'gamma_alpha') f = r < ap ? col.ferrit : col.gamma; else f = col.gamma;
      const q = [V[j][i], V[j][i + 1], V[j + 1][i + 1], V[j + 1][i]]; cells += `<polygon points="${q.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')}" fill="${f}" stroke="${zem ? '#fff' : lc}" stroke-width="${zem ? zem : lw}" stroke-linejoin="round"/>`;
    }
    return `<svg viewBox="-4 -4 348 228" class="grain" role="img" aria-label="Schematisches Schliffbild: ${esc(st.name)}"><defs><pattern id="pearl" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="6" height="6" fill="#f0f1f4"/><rect width="6" height="2.2" fill="#4b5360"/></pattern></defs>${cells}</svg>`;
  }
  const FEDESC = { ferrit: 'Ferrit: weich und zäh, wenig Kohlenstoff gelöst (max. 0,02 %).', perlit: 'Perlit: feines Lamellengemisch aus Ferrit und Zementit, bei 0,8 % C.', zem: 'Zementit (Fe₃C): 6,67 % C, sehr hart und spröde. Hier als Netz an den Korngrenzen.', gamma: 'Austenit γ: bei Temperaturen oberhalb A₁/A₃ vorhanden, gut umformbar (Schmieden), unmagnetisch. Aus ihm entsteht beim Abschrecken der harte Martensit.' };
  function renderFec() {
    const f = S.fec;
    $('#fecView').innerHTML = `<div class="card pl"><h4>Eisen-Kohlenstoff-Diagramm (vereinfachtes Lehrmodell)</h4>
      <div class="rdout" style="border-color:var(--warn)"><b>Vereinfachtes Lehrmodell:</b> nur die Stahlseite bis 2,06 % C, gerade Linien, ohne Schmelze und δ-Gebiet, ohne Löslichkeit von C im Ferrit, Abkühlung sehr langsam (Gleichgewicht). Nicht für Berechnungen im Betrieb verwenden.</div>
      <div class="cols"><div><div id="fSvg"></div>
        <label class="f"><span>Kohlenstoffgehalt: <b id="fCv"></b> % C</span><input type="range" id="fC" min="0" max="206" step="1" value="${Math.round(f.C * 100)}"></label>
        <div class="ctl">${[[0, 'Reineisen'], [0.15, 'C15'], [0.45, 'C45'], [0.8, 'Eutektoid'], [1.2, 'Werkzeugstahl']].map(([c, n]) => `<button class="chip s${Math.abs(f.C - c) < 0.005 ? ' on' : ''}" data-fc="${c}">${n} ${c ? nd(c, 2) + ' %' : '0 %'}</button>`).join('')}</div>
        <label class="f"><span>Temperatur: <b id="fTv"></b> °C</span><input type="range" id="fT" min="20" max="1000" step="5" value="${f.T}"></label>
        <div class="ctl"><button class="chip s" data-ft="20">20 °C</button><button class="chip s" data-ft="723">A₁ (723 °C)</button><button class="chip s" data-ft="hard">Härtetemperatur</button></div></div>
      <div><div id="fInfo"></div></div></div>
      <p class="hint2">Tippe oder ziehe im Diagramm, um Kohlenstoffgehalt und Temperatur zu wählen.</p></div>`;
    updateFec();
  }
  function updateFec() {
    const f = S.fec, svg = $('#fSvg'); if (!svg) return; lsSet('fec', f); const st = C.structure(f.C, f.T), ht = C.hardenTemp(f.C);
    svg.innerHTML = svgFec(f.C, f.T); $('#fCv').textContent = nd(f.C, 2); $('#fTv').textContent = nd(f.T, 0);
    const sl = $('#fC'); if (sl && document.activeElement !== sl) sl.value = Math.round(f.C * 100); const sl2 = $('#fT'); if (sl2 && document.activeElement !== sl2) sl2.value = f.T;
    $$('[data-fc]').forEach(b => b.classList.toggle('on', Math.abs(f.C - +b.dataset.fc) < 0.005));
    let h = `<div class="big" style="margin-bottom:2px">${esc(st.name)}</div><div class="hint2" style="margin:0 0 6px">${nd(f.C, 2)} % C bei ${nd(f.T, 0)} °C</div>${svgGrain(st, f.C)}<div class="hint2" style="margin:2px 0 8px">Schliffbild schematisch (nicht maßstäblich).</div>`;
    if (st.parts.length) h += st.parts.map(p => `<div style="margin:4px 0;font-size:14px">${esc(p.n)}: <b>${nd(p.p, 1)} %</b><div class="bar"><i style="width:${p.p}%"></i></div></div>`).join('') + '<div class="hint2">Anteile nach dem Hebelgesetz, vereinfacht (Ferrit 0 % C, Perlit 0,8 % C, Zementit 6,67 % C).</div>';
    const A3 = f.C <= C.FEC.CS ? C.a3(f.C) : null;
    h += '<div class="rdout">';
    if (st.key === 'ferrit_perlit') h += FEDESC.ferrit + ' ' + FEDESC.perlit;
    else if (st.key === 'ferrit') h += FEDESC.ferrit;
    else if (st.key === 'perlit') h += FEDESC.perlit;
    else if (st.key === 'perlit_zem') h += FEDESC.perlit + ' ' + FEDESC.zem;
    else if (st.key === 'gamma') h += FEDESC.gamma + ' Umwandlung abgeschlossen: Jetzt wäre die richtige Temperatur zum Härten erreicht, wenn der Stahl genug Kohlenstoff hat.';
    else if (st.key === 'gamma_alpha') h += 'Austenit mit restlichem Ferrit. Erst oberhalb A₃ (' + nd(A3, 0) + ' °C bei ' + nd(f.C, 2) + ' % C) ist alles Austenit.';
    else h += 'Austenit mit Zementit. Erst oberhalb A_cm (' + nd(C.acm(f.C), 0) + ' °C bei ' + nd(f.C, 2) + ' % C) ist der Zementit gelöst. Übereutektoide Stähle härtet man bewusst in diesem Gebiet (Zementit bleibt als harte Phase).';
    h += '</div>';
    if (ht && ht.ok) h += `<div class="rdout ok"><b>Härten:</b> ${ht.ref === 'A3' ? 'A₃' : 'A₁'} = ${nd(ht.refT, 0)} °C, Härtetemperatur 30 bis 50 °C darüber: <b>${nd(Math.round(ht.lo / 5) * 5, 0)} bis ${nd(Math.round(ht.hi / 5) * 5, 0)} °C</b>. Danach schnell abschrecken: Austenit wird zu Martensit (hart, spröde).</div>`;
    else if (ht) h += `<div class="rdout bad">${esc(ht.why)}</div>`;
    $('#fInfo').innerHTML = h;
  }
  let fDrag = false;
  const fecFrom = (sv, ev) => { const r = sv.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width * 400, y = (ev.clientY - r.top) / r.height * 312; S.fec.C = clamp(Math.round((x - FG.L) / (FG.R - FG.L) * FG.cmax * 100) / 100, 0, C.FEC.CMAX); S.fec.T = clamp(Math.round((FG.B - y) / (FG.B - FG.T) * FG.tmax / 5) * 5, 20, 1000); updateFec(); };
  $('#fecView').addEventListener('pointerdown', e => { const sv = e.target.closest('svg[data-fec]'); if (!sv) return; fDrag = true; fecFrom(sv, e); try { sv.setPointerCapture(e.pointerId); } catch (x) {} });
  $('#fecView').addEventListener('pointermove', e => { if (!fDrag) return; const sv = $('#fSvg svg'); if (sv) fecFrom(sv, e); });
  ['pointerup', 'pointercancel'].forEach(ev => $('#fecView').addEventListener(ev, () => { fDrag = false; }));
  $('#fecView').addEventListener('input', e => { if (e.target.id === 'fC') { S.fec.C = +e.target.value / 100; updateFec(); } else if (e.target.id === 'fT') { S.fec.T = +e.target.value; updateFec(); } });
  $('#fecView').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.fc != null) { S.fec.C = +b.dataset.fc; updateFec(); }
    else if (b.dataset.ft) { if (b.dataset.ft === 'hard') { const h = C.hardenTemp(S.fec.C); if (h && h.ok) S.fec.T = Math.round((h.lo + h.hi) / 2 / 5) * 5; else { toast('Unter 0,2 % C ist kein Härten sinnvoll.'); return; } } else S.fec.T = +b.dataset.ft; updateFec(); }
  });

  /* ============================================================ Wärmebehandlung */
  function svgTT(h) {
    const L = 46, R = 388, T = 14, B = 180, X = t => L + t / 100 * (R - L), Y = v => B - v / 1000 * (B - T); let s = '';
    for (let v = 0; v <= 1000; v += 200) s += `<line x1="${L}" x2="${R}" y1="${Y(v)}" y2="${Y(v)}" class="c-grid"/><text x="${L - 6}" y="${Y(v) + 3.5}" class="c-txt" text-anchor="end">${v}</text>`;
    s += `<line x1="${L}" x2="${R}" y1="${Y(723)}" y2="${Y(723)}" class="c-kv"/><text x="${R - 2}" y="${Y(723) - 4}" class="c-kt" text-anchor="end">A₁ = 723 °C</text>`;
    s += `<line x1="${L}" x2="${R}" y1="${B}" y2="${B}" class="c-ax"/><line x1="${L}" x2="${L}" y1="${T}" y2="${B}" class="c-ax"/><polyline points="${h.steps.map(p => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ')}" class="c-curve" style="stroke-linejoin:round"/>`;
    const mx = h.steps.reduce((a, p) => p[1] > a[1] ? p : a, h.steps[0]); s += `<text x="${X(mx[0]) + 6}" y="${Y(mx[1]) - 6}" class="c-kt">${mx[1]} °C (Beispiel)</text>`;
    s += `<text x="${(L + R) / 2}" y="206" class="c-txt" text-anchor="middle" style="font-size:11px">Zeit (schematisch) · Abkühlung: ${esc(h.coolText)}</text><text transform="translate(12 ${(T + B) / 2}) rotate(-90)" class="c-txt" text-anchor="middle" style="font-size:11px">Temperatur in °C</text>`;
    return `<svg viewBox="0 0 400 214" class="chart" role="img" aria-label="Temperatur-Zeit-Verlauf ${esc(h.name)}">${s}</svg>`;
  }
  function svgTemper(Ta) {
    const L = 46, R = 388, T = 14, B = 190, X = t => L + (t - 100) / 600 * (R - L), Y = v => B - v / 100 * (B - T); let s = '';
    [[150, 250, 'niedrig', 'Werkzeuge'], [350, 450, 'mittel', 'Federn'], [500, 650, 'hoch', 'Vergüten']].forEach(z => { s += `<rect x="${X(z[0])}" y="${T}" width="${X(z[1]) - X(z[0])}" height="${B - T}" class="fe-h"/><text x="${(X(z[0]) + X(z[1])) / 2}" y="${T + 11}" class="c-kt" text-anchor="middle" style="font-size:9.5px">${z[2]}</text><text x="${(X(z[0]) + X(z[1])) / 2}" y="${T + 22}" class="c-txt" text-anchor="middle" style="font-size:9px">${z[3]}</text>`; });
    for (let v = 0; v <= 100; v += 25) s += `<line x1="${L}" x2="${R}" y1="${Y(v)}" y2="${Y(v)}" class="c-grid"/><text x="${L - 6}" y="${Y(v) + 3.5}" class="c-txt" text-anchor="end">${v}</text>`;
    for (let t = 100; t <= 700; t += 100) s += `<text x="${X(t)}" y="${B + 14}" class="c-txt" text-anchor="middle">${t}</text>`;
    const ph = [], pt_ = []; for (let t = 100; t <= 700; t += 20) { const r = C.temper(t); ph.push(X(t).toFixed(1) + ',' + Y(r.hard).toFixed(1)); pt_.push(X(t).toFixed(1) + ',' + Y(r.tough).toFixed(1)); }
    s += `<line x1="${L}" x2="${R}" y1="${B}" y2="${B}" class="c-ax"/><line x1="${L}" x2="${L}" y1="${T}" y2="${B}" class="c-ax"/><polyline points="${ph.join(' ')}" class="c-hard"/><polyline points="${pt_.join(' ')}" class="c-tough"/>`;
    const r = C.temper(Ta); s += `<line x1="${X(Ta)}" x2="${X(Ta)}" y1="${T}" y2="${B}" class="c-cur"/><circle cx="${X(Ta)}" cy="${Y(r.hard)}" r="4.5" class="c-hard" style="fill:#ff6b6b"/><circle cx="${X(Ta)}" cy="${Y(r.tough)}" r="4.5" class="c-tough" style="fill:#4dabf7"/>`;
    s += `<text x="${X(130)}" y="${Y(100) + 14}" class="c-kt" style="fill:#ff6b6b">Härte</text><text x="${X(640)}" y="${Y(94) - 2}" class="c-kt" style="fill:#4dabf7">Zähigkeit</text>`;
    s += `<text x="${(L + R) / 2}" y="222" class="c-txt" text-anchor="middle" style="font-size:11px">Anlasstemperatur in °C</text><text transform="translate(12 ${(T + B) / 2}) rotate(-90)" class="c-txt" text-anchor="middle" style="font-size:11px">relativ in % (qualitativ)</text>`;
    return `<svg viewBox="0 0 400 230" class="chart" role="img" aria-label="Anlassdiagramm: Härte fällt, Zähigkeit steigt mit der Anlasstemperatur (qualitativ)">${s}</svg>`;
  }
  function renderWb() {
    const w = S.wb;
    $('#wbView').innerHTML = `<div class="card pl"><h4>Wärmebehandlung im Überblick</h4><div class="fbar">${D.heat.map(x => `<button class="chip${x.id === w.id ? ' on' : ''}" data-wh="${x.id}" aria-pressed="${x.id === w.id}">${esc(x.name)}</button>`).join('')}</div><div id="wbInfo"></div></div>
      <div class="card pl"><h4>Anlassen: Härte und Zähigkeit (qualitatives Schaubild)</h4><div id="wbTemper"></div>
      <label class="f"><span>Anlasstemperatur: <b id="wbTv"></b> °C</span><input type="range" id="wbTa" min="100" max="700" step="10" value="${w.Ta}"></label><div id="wbTr"></div>
      <p class="hint2"><b>Qualitativ:</b> Es zählt der Verlauf (Härte fällt, Zähigkeit steigt), nicht die Zahlen. Echte Anlasskurven hängen vom Stahl ab (Tabellenbuch oder Werkstoffblatt). Faustregel der Anlassfarben: Gelb, Braun, Violett, Blau bei etwa 200 bis 300 °C.</p></div><div id="qzW"></div>`;
    updateWb(); renderQuiz('wb');
  }
  function updateWb() {
    const w = S.wb, h = D.heat.find(x => x.id === w.id); lsSet('wb', w);
    $$('[data-wh]').forEach(b => { const on = b.dataset.wh === w.id; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    $('#wbInfo').innerHTML = `${svgTT(h)}<table class="tt"><tr><td style="width:30%"><b>Ziel</b></td><td>${esc(h.goal)}</td></tr><tr><td><b>Temperatur</b></td><td>${esc(h.temp)}</td></tr><tr><td><b>Abkühlung</b></td><td>${esc(h.cool)}</td></tr><tr><td><b>Wirkung</b></td><td>${esc(h.effect)}</td></tr><tr><td><b>Anwendung</b></td><td>${esc(h.use)}</td></tr></table>`;
    const r = C.temper(w.Ta), zone = w.Ta < 300 ? 'niedriges Anlassen: viel Härte bleibt (Werkzeuge, Schneiden)' : w.Ta < 500 ? 'mittleres Anlassen: elastisch und zäh (Federn)' : 'hohes Anlassen: hohe Zähigkeit bei guter Festigkeit (Vergüten)';
    $('#wbTemper').innerHTML = svgTemper(w.Ta); $('#wbTv').textContent = w.Ta;
    $('#wbTr').innerHTML = `<div class="rdout">Bei ${w.Ta} °C: Härte ≈ <b>${nd(r.hard, 0)} %</b> des Härtezustands, Zähigkeit ≈ <b>${nd(r.tough, 0)} %</b> (relativ). ${esc(zone)}.</div>`;
  }
  $('#wbView').addEventListener('click', e => { const b = e.target.closest('[data-wh]'); if (b) { S.wb.id = b.dataset.wh; updateWb(); } });
  $('#wbView').addEventListener('input', e => { if (e.target.id === 'wbTa') { S.wb.Ta = +e.target.value; const r = C.temper(S.wb.Ta); $('#wbTemper').innerHTML = svgTemper(S.wb.Ta); $('#wbTv').textContent = S.wb.Ta; lsSet('wb', S.wb); updateWbR(r); } });
  function updateWbR() { const w = S.wb, r = C.temper(w.Ta), zone = w.Ta < 300 ? 'niedriges Anlassen: viel Härte bleibt (Werkzeuge, Schneiden)' : w.Ta < 500 ? 'mittleres Anlassen: elastisch und zäh (Federn)' : 'hohes Anlassen: hohe Zähigkeit bei guter Festigkeit (Vergüten)'; $('#wbTr').innerHTML = `<div class="rdout">Bei ${w.Ta} °C: Härte ≈ <b>${nd(r.hard, 0)} %</b> des Härtezustands, Zähigkeit ≈ <b>${nd(r.tough, 0)} %</b> (relativ). ${esc(zone)}.</div>`; }

  /* ============================================================ Werkstoffwahl */
  function renderWahl() {
    const w = S.wahl.w;
    let h = `<div class="card pl"><h4>Anforderungsprofil</h4><p class="hint2" style="margin:0 0 6px">Stelle ein, was dein Bauteil können muss. Der Rechner bewertet acht Werkstoffgruppen mit Übungspunkten (1 bis 5).</p>
      ${C.PROPS.map(p => `<div class="fbar"><span class="lbl" style="min-width:150px;font-size:13px;text-transform:none;color:var(--fg)">${esc(D.propLabels[p])}</span>${segHTML('wp-' + p, [[0, 'egal'], [1, 'wichtig'], [2, 'sehr wichtig']], w[p] || 0)}</div>`).join('')}</div><div id="wRes"></div>
      <div class="card pl"><h4>Bewertungstabelle (Übungswerte, 5 = sehr gut)</h4><div style="overflow-x:auto"><table class="tt"><tr><th>Gruppe</th>${C.PROPS.map(p => `<th class="n">${esc(D.propLabels[p].replace(' (schlagfest)', '').replace('korrosionsbeständig', 'korrosions-bestdg.'))}</th>`).join('')}</tr>${D.groups.map(g => `<tr><td>${esc(g.name)}</td>${C.PROPS.map(p => `<td class="n">${g.r[p]}</td>`).join('')}</tr>`).join('')}</table></div><p class="hint2">Grobe Einordnung zum Üben, keine Werkstoffdaten. Für echte Auswahl gelten Datenblätter, Kosten, Verfügbarkeit und Normen.</p></div><div id="qzK"></div>`;
    $('#wahlView').innerHTML = h; updateWahl(); renderQuiz('wahl');
  }
  function updateWahl() {
    const w = S.wahl.w, host = $('#wRes'); if (!host) return; lsSet('wahl', S.wahl); const rk = C.rank(D.groups, w), sel = C.PROPS.filter(p => w[p]);
    if (!sel.length) { host.innerHTML = '<div class="card pl"><h4>Ergebnis</h4><div class="rdout">Wähle mindestens eine Anforderung aus.</div></div>'; return; }
    const maxPossible = sel.reduce((s, p) => s + 5 * w[p], 0), best = D.groups.find(g => g.id === rk.best[0]);
    host.innerHTML = `<div class="card pl"><h4>Ergebnis</h4>${rk.list.map(x => { const g = D.groups.find(k => k.id === x.id); return `<div style="margin:6px 0"><div style="display:flex;justify-content:space-between;gap:8px;font-size:14px"><span>${rk.best.includes(x.id) ? '★ <b>' + esc(g.name) + '</b>' : esc(g.name)}</span><span>${x.score} / ${maxPossible}</span></div><div class="bar"><i style="width:${x.score / maxPossible * 100}%;${rk.best.includes(x.id) ? '' : 'opacity:.55'}"></i></div></div>`; }).join('')}
      <div class="rdout ok"><b>Begründung:</b> ${rk.best.length > 1 ? 'Mehrere Gruppen sind gleich gut: ' + rk.best.map(id => D.groups.find(g => g.id === id).name).join(' und ') + '. Entscheide nach Kosten, Verfügbarkeit und weiteren Eigenschaften.' : `<b>${esc(best.name)}</b> passt am besten: ${sel.map(p => `${esc(D.propLabels[p])} ${best.r[p]} von 5`).join(', ')}. ${esc(best.note)}.`}</div></div>`;
  }
  $('#wahlView').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const at = [...b.attributes].find(x => x.name.startsWith('data-wp-')); if (!at) return;
    S.wahl.w[at.name.slice(8)] = +at.value; $$('button', b.parentNode).forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); }); updateWahl();
  });

  /* ============================================================ Aufgaben */
  const done = () => lsGet('done', {});
  const exam = () => lsGet('exam', '0') === '1';
  function pctFor(id) { if (!exam()) return 100; const st = lsGet('ctipps', {})[id] || 0; return st >= 3 ? 0 : 100 - 25 * st; }
  function markSolved(id, pct) {
    const p = lsGet('prog', {}); if ((p[id] || 0) < pct) p[id] = pct; lsSet('prog', p);
    if (pct > 0) { const d = done(); d[id] = true; lsSet('done', d); }
    updateBadge(); updatePal();
  }
  function updateBadge() { const b = $('#tkBd'); if (!b) return; const n = Object.keys(done()).filter(k => TASKS.some(t => t.id === k)).length; b.textContent = n + '/' + TASKS.length; }
  const curTask = () => S.task && TASKS.find(t => t.id === S.task);
  function solutionText(t) { const s = t.solve(C); if (t.ask.type === 'choice') return t.ask.choices[t.ask.correct]; if (t.ask.type === 'match') return t.ask.rows.map(r => r[0] + ' → ' + t.ask.options[r[1]]).join('; '); return fAny(s.value) + ' ' + (t.ask.unit || ''); }
  function checkTask(t) {
    const a = S.tAns[t.id] || {}, s = t.solve(C); let ok = false, given = '', lines = [];
    if (t.ask.type === 'choice') { if (a.c == null) { toast('Wähle zuerst eine Antwort.'); return; } ok = a.c === s.correct; given = t.ask.choices[a.c]; }
    else if (t.ask.type === 'match') {
      const m = a.m || {}; if (t.ask.rows.some((r, i) => m[i] == null)) { toast('Ordne zuerst alle Zeilen zu.'); return; }
      ok = t.ask.rows.every((r, i) => m[i] === r[1]); given = t.ask.rows.map((r, i) => r[0] + ' → ' + t.ask.options[m[i]]).join('; ');
      t.ask.rows.forEach((r, i) => lines.push({ ok: m[i] === r[1], text: r[0] + ' → ' + t.ask.options[m[i]] + (m[i] === r[1] ? '' : ' (richtig: ' + t.ask.options[r[1]] + ')') }));
    } else { const v = C.parseDe(a.v); if (!isFinite(v)) { toast('Bitte gib eine Zahl ein (mit Komma oder Punkt).'); return; } ok = Math.abs(v - s.value) <= s.tol + 1e-9; given = fAny(v) + ' ' + t.ask.unit; }
    const pct = ok ? pctFor(t.id) : 0, ex = exam();
    if (t.ask.type !== 'match') lines.push({ ok, text: ok ? 'Richtig: ' + given : 'Deine Antwort „' + given + '“ stimmt nicht.' });
    if (t.ask.type === 'num' && ok && s.tol >= 0.5) lines.push({ ok: true, info: true, text: 'Erlaubte Abweichung: ±' + fAny(s.tol) + ' ' + t.ask.unit + (t.chart ? ' (Lesetoleranz im Diagramm)' : '') + '.' });
    S.tRes = { id: t.id, ok, pct, lines, sol: solutionText(t) };
    if (ok) { markSolved(t.id, pct); if (pct === 0) toast('Mit angezeigter Lösung zählt die Aufgabe im Prüfmodus nicht.'); else { const F = fx(); if (F && F.pass) try { F.pass(pct); } catch (e) {} else ding(); toast(ex && pct < 100 ? pct + ' % (Tipps abgezogen)' : '🎉 Geschafft!'); } } else { sad(); toast('Noch nicht richtig. Lies die Erklärung und versuche es noch einmal.'); }
    renderTasks(false);
  }
  function hintTask(t) {
    const h = lsGet('hints', {}), n = Math.min(3, (h[t.id] || 0) + 1), ex = exam();
    h[t.id] = Math.max(h[t.id] || 0, n); lsSet('hints', h);
    if (ex) { const c = lsGet('ctipps', {}); c[t.id] = Math.max(c[t.id] || 0, n); lsSet('ctipps', c); }
    sheet('Tipp, Stufe ' + n + ' von 3', b => {
      let x = `<p style="margin-top:0"><b>Stufe 1:</b> ${esc(t.tips[0])}</p>`;
      if (n >= 2) x += `<p><b>Stufe 2:</b> ${esc(t.tips[1])}</p>`;
      if (n >= 3) x += `<p><b>Stufe 3:</b> Die Lösung lautet <b>${esc(solutionText(t))}</b>.</p>`;
      else x += '<p class="hint2">Noch mehr Hilfe? Tippe noch einmal auf „Tipp“ für die nächste Stufe.</p>';
      x += ex ? '<p class="hint2" style="color:var(--warn)">Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte. Mit Stufe 3 zählt die Aufgabe nicht mehr.</p>' : '<p class="hint2">Beim normalen Üben kosten Tipps nichts. Im Prüfmodus (🎓) zählen sie.</p>';
      b.innerHTML = x;
    });
  }
  function chartBlock(m, eps, off, id) {
    const sg = eps != null ? C.sigmaAt(m, eps) : NaN;
    return `<div id="${id}">${svgChart(m, { full: true, eps: eps == null ? null : eps, cur: eps != null, off, kv: off })}<div class="ctl">${m.type === 'rp' ? `<button class="chip s${off ? ' on' : ''}" data-coff="${id}" aria-pressed="${off}">Parallele 0,2 %</button>` : ''}<span class="hint2" style="align-self:center;margin:0">${eps != null ? 'Ablesemarke: ε = ' + nd(eps, m.A < 1 ? 3 : 2) + ' %, σ ≈ ' + nd(Math.round(sg / 5) * 5, 0) + ' N/mm²' : 'Tippe ins Diagramm, um eine Ablesemarke zu setzen.'}</span></div></div>`;
  }
  function renderTasks(top) {
    const V = $('#taskView'), d = done(), prog = lsGet('prog', {}), t = curTask(), n100 = TASKS.filter(x => d[x.id]).length; let h = '';
    if (t) {
      const r = S.tRes && S.tRes.id === t.id ? S.tRes : null, a = S.tAns[t.id] || {};
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv">${dots(t.level)}</div><p style="margin:8px 0">${esc(t.text)}</p>`;
      if (t.chart) h += chartBlock(mat(t.chart), S.tc, S.toff, 'tkChart');
      if (t.ask.type === 'choice') h += `<div class="opts" id="tkOpts">${t.ask.choices.map((c, i) => `<button data-tc="${i}" ${r && r.ok ? 'disabled' : ''} class="${r && r.ok && i === t.ask.correct ? 'ok' : a.c === i ? (r && !r.ok ? 'bad' : 'on') : ''}">${esc(c)}</button>`).join('')}</div>`;
      else if (t.ask.type === 'match') h += `<div id="tkMatch">${t.ask.rows.map((row, i) => `<label class="f"><span>${esc(row[0])}</span><select data-tm="${i}" ${r && r.ok ? 'disabled' : ''}><option value="">– wählen –</option>${t.ask.options.map((o, j) => `<option value="${j}"${a.m && a.m[i] === j ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`).join('')}</div>`;
      else h += `<label class="f"><span>${esc(t.ask.label || 'Dein Ergebnis')} (${esc(t.ask.unit)})</span><div class="qin"><input id="tkIn" inputmode="decimal" autocomplete="off" value="${esc(a.v || '')}" ${r && r.ok ? 'disabled' : ''}><span class="u">${esc(t.ask.unit)}</span></div></label>`;
      h += `<div class="btns"><button class="btn pri" data-ta="chk"${r && r.ok ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" data-ta="hint">💡 Tipp</button><button class="btn" data-ta="close">Schließen</button></div>`;
      if (exam()) h += '<p class="hint2" style="color:var(--warn)">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>';
      if (r) {
        h += `<ul class="tl">${r.lines.map(l => `<li class="${l.info ? '' : l.ok ? 'ok' : 'bad'}">${l.info ? 'ℹ' : l.ok ? '✓' : '✗'} ${esc(l.text)}</li>`).join('')}</ul>`;
        if (r.ok || !exam()) h += `<div class="rdout ${r.ok ? 'ok' : 'bad'}"><b>Lösung:</b> ${esc(r.sol)}<br>${esc(t.expl)}</div>`;
        else h += '<div class="rdout bad">🎓 Prüfmodus: Die Erklärung gibt es erst, wenn die Aufgabe richtig gelöst ist. Nutze einen Tipp oder versuche es noch einmal.</div>';
        if (r.ok) h += `<div class="btns"><button class="btn pri" data-ta="next">Nächste Aufgabe</button></div>`;
      }
      h += '</div>';
    }
    h += `<p class="hint2" style="margin:4px 0 0">${n100} von ${TASKS.length} Aufgaben gelöst. ${exam() ? '🎓 Prüfmodus ist an.' : 'Tipp: Im Prüfmodus (🎓 oben) zählen Tipps als Abzug.'}</p>`;
    let last = '';
    TASKS.forEach(x => { if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; } const p = prog[x.id]; h += `<button class="row" data-t="${esc(x.id)}"><span class="dot ${d[x.id] ? 'g' : p > 0 ? 'p' : ''}">${d[x.id] ? '✓' : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${dots(x.level)}</span>${p != null && !d[x.id] ? ' · bisher ' + p + ' %' : ''}</small></div></button>`; });
    V.innerHTML = h; if (top !== false) $('#pgTasks').scrollTop = 0;
  }
  let tDrag = false;
  function setTc(ev, svg) { const t = curTask(), m = t && t.chart && mat(t.chart); if (!m) return; S.tc = chartEps(m, svg, ev); const host = $('#tkChart'); if (host) host.outerHTML = chartBlock(m, S.tc, S.toff, 'tkChart'); }
  $('#taskView').addEventListener('pointerdown', e => { const sv = e.target.closest('#tkChart svg[data-chart]'); if (!sv) return; tDrag = true; setTc(e, sv); const n = $('#tkChart svg'); try { n.setPointerCapture(e.pointerId); } catch (x) {} });
  $('#taskView').addEventListener('pointermove', e => { if (!tDrag) return; const sv = $('#tkChart svg'); if (sv) setTc(e, sv); });
  ['pointerup', 'pointercancel'].forEach(ev => $('#taskView').addEventListener(ev, () => { tDrag = false; }));
  $('#taskView').addEventListener('input', e => { const t = curTask(); if (t && e.target.id === 'tkIn') (S.tAns[t.id] = S.tAns[t.id] || {}).v = e.target.value; });
  $('#taskView').addEventListener('change', e => { const t = curTask(); if (t && e.target.dataset.tm != null) { const a = (S.tAns[t.id] = S.tAns[t.id] || {}); a.m = a.m || {}; a.m[+e.target.dataset.tm] = e.target.value === '' ? null : +e.target.value; if (S.tRes && !S.tRes.ok) S.tRes = null; } });
  $('#taskView').addEventListener('keydown', e => { const t = curTask(); if (t && e.key === 'Enter' && e.target.id === 'tkIn') { e.preventDefault(); checkTask(t); } });
  $('#taskView').addEventListener('click', e => {
    const t = curTask(), tc = e.target.closest('[data-tc]'), ta = e.target.closest('[data-ta]'), co = e.target.closest('[data-coff]'), row = e.target.closest('.row[data-t]');
    if (co) { S.toff = !S.toff; const m = t && t.chart && mat(t.chart); if (m) $('#tkChart').outerHTML = chartBlock(m, S.tc, S.toff, 'tkChart'); return; }
    if (tc && t) { (S.tAns[t.id] = S.tAns[t.id] || {}).c = +tc.dataset.tc; if (S.tRes && !S.tRes.ok) S.tRes = null; renderTasks(false); return; }
    if (ta && t) { const a = ta.dataset.ta; if (a === 'chk') checkTask(t); else if (a === 'hint') hintTask(t); else if (a === 'close') { S.task = null; S.tRes = null; renderTasks(); } else if (a === 'next') { const i = TASKS.findIndex(x => x.id === t.id), nx = TASKS.slice(i + 1).find(x => !done()[x.id]) || TASKS[(i + 1) % TASKS.length]; startTask(nx.id); } return; }
    if (row) startTask(row.dataset.t);
  });
  function startTask(id) {
    S.task = id; S.tAns = {}; S.tRes = null; S.tc = null; S.toff = false;
    const h = lsGet('hints', {}), c = lsGet('ctipps', {}); if (h[id]) { delete h[id]; lsSet('hints', h); } if (c[id]) { delete c[id]; lsSet('ctipps', c); }
    renderTasks();
  }

  /* ============================================================ Zufalls-Trainer */
  function newTrainer() { const T = S.tr; T.task = C.genTask(R0, { kind: T.kind }, D); T.res = null; T.ans = ''; T.tc = null; T.off = false; renderTrainer(); }
  function renderTrainer() {
    const T = S.tr, V = $('#rtView'); if (!T.task) { newTrainer(); return; }
    const st = S.rt, x = T.task; let h = `<div class="card pl"><h4>Zufalls-Trainer: unendlich viele Rechenaufgaben</h4>
      <div class="fbar">${segHTML('rkind', [['mixed', 'Gemischt'], ['zug', 'Zugversuch'], ['haerte', 'Härte'], ['name', 'Bezeichnung'], ['gefuege', 'Gefüge']], T.kind)}</div>
      <div class="stats"><div class="bx"><b>${st.streak}</b>Serie</div><div class="bx"><b>${st.best}</b>Beste Serie</div><div class="bx"><b>${st.ok}/${st.n}</b>Richtig</div></div>
      <p style="margin:6px 0">${esc(x.text)}</p>`;
    if (x.chart) h += chartBlock(mat(x.chart), T.tc, T.off, 'rtChart');
    h += `<label class="f"><span>Dein Ergebnis in ${esc(x.unit)}</span><div class="qin"><input id="rtIn" inputmode="decimal" autocomplete="off" value="${esc(T.ans)}" ${T.res ? 'disabled' : ''}><span class="u">${esc(x.unit)}</span></div></label>`;
    h += T.res ? `<div class="btns"><button class="btn pri" data-r="next">Nächste Aufgabe</button></div>` : `<div class="btns"><button class="btn pri" data-r="chk">✓ Prüfen</button><button class="btn" data-r="show">Lösung zeigen</button></div>`;
    if (T.res) { const r = T.res; h += `<div class="fb ${r.ok ? 'ok' : 'bad'}"><span class="v">${r.shown ? 'Lösung: ' + fAny(Math.round(x.value * 1000) / 1000) + ' ' + x.unit + ' (zählt als Fehler, Serie beginnt neu)' : r.ok ? '✓ Richtig! Serie: ' + st.streak : '✗ Nicht ganz: richtig sind ' + fAny(Math.round(x.value * 1000) / 1000) + ' ' + x.unit + '. Serie beginnt neu.'}</span></div><div class="rdout ${r.ok ? 'ok' : 'bad'}">${esc(x.expl)}</div>`; }
    V.innerHTML = h + '</div>';
  }
  function trainerResult(res, shown) {
    const T = S.tr, st = S.rt; st.n++; if (res.ok && !shown) { st.ok++; st.streak++; st.best = Math.max(st.best, st.streak); } else st.streak = 0; lsSet('rt', st);
    T.res = Object.assign({}, res, { shown }); if (res.ok && !shown) ding(); else sad(); renderTrainer(); updatePal();
    if (res.ok && !shown && st.streak > 0 && st.streak % 5 === 0) { toast('🔥 ' + st.streak + ' richtige in Folge!'); const F = fx(); if (F && F.pass) try { F.pass(100); } catch (e) {} }
  }
  const trCheck = () => { const r = C.checkNumber(S.tr.ans, S.tr.task); if (r.empty) toast('Bitte gib eine Zahl ein.'); else trainerResult(r, false); };
  $('#rtView').addEventListener('input', e => { if (e.target.id === 'rtIn') S.tr.ans = e.target.value; });
  $('#rtView').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'rtIn') { e.preventDefault(); if (S.tr.res) newTrainer(); else trCheck(); } });
  let rDrag = false;
  function setRc(ev, svg) { const x = S.tr.task, m = x && x.chart && mat(x.chart); if (!m) return; S.tr.tc = chartEps(m, svg, ev); const host = $('#rtChart'); if (host) host.outerHTML = chartBlock(m, S.tr.tc, S.tr.off, 'rtChart'); }
  $('#rtView').addEventListener('pointerdown', e => { const sv = e.target.closest('#rtChart svg[data-chart]'); if (!sv) return; rDrag = true; setRc(e, sv); const n = $('#rtChart svg'); try { n.setPointerCapture(e.pointerId); } catch (x) {} });
  $('#rtView').addEventListener('pointermove', e => { if (!rDrag) return; const sv = $('#rtChart svg'); if (sv) setRc(e, sv); });
  ['pointerup', 'pointercancel'].forEach(ev => $('#rtView').addEventListener(ev, () => { rDrag = false; }));
  $('#rtView').addEventListener('click', e => {
    const co = e.target.closest('[data-coff]'); if (co) { S.tr.off = !S.tr.off; const x = S.tr.task; $('#rtChart').outerHTML = chartBlock(mat(x.chart), S.tr.tc, S.tr.off, 'rtChart'); return; }
    const b = e.target.closest('button'); if (!b) return; const T = S.tr;
    if (b.dataset.rkind) { T.kind = b.dataset.rkind; newTrainer(); }
    else if (b.dataset.r === 'chk') trCheck();
    else if (b.dataset.r === 'show') trainerResult({ ok: false }, true);
    else if (b.dataset.r === 'next') newTrainer();
  });

  /* ============================================================ Hilfe */
  function renderHelp() {
    const m1 = mat('s235'), m2 = mat('c45'), elS = svgElastic(mat('al'));
    $('#helpView').innerHTML = `
    <details open><summary>⚠️ Übungswerte und Vereinfachungen</summary><div class="hb2">
      <p>Alle Werkstoffkennwerte in diesem Lab sind <b>gerundete Übungswerte</b> in typischer Größenordnung, keine garantierten Werkstoffdaten. Für echte Konstruktion gelten Normen, Werkstoffblätter und das Tabellenbuch.</p>
      <p>Das Eisen-Kohlenstoff-Diagramm ist ein <b>vereinfachtes Lehrmodell</b> (nur Stahlseite, gerade Linien, Gleichgewicht). Das Anlassdiagramm zeigt nur den Verlauf (qualitativ). Die Härte-Faustformel ist ein <b>Richtwert</b>.</p></div></details>
    <details><summary>📈 Zugversuch und Kennwerte</summary><div class="hb2">
      <p>Die Probe wird gezogen. Aufgezeichnet werden die Kraft F und die Verlängerung ΔL, daraus das Spannungs-Dehnungs-Diagramm (technische Spannung, bezogen auf den Anfangsquerschnitt S₀).</p>
      <table><tr><th>Kennwert</th><th>Bedeutung</th></tr><tr><td>E (Elastizitätsmodul)</td><td>Steigung der Hookeschen Geraden: σ = E · ε</td></tr><tr><td>Re (ReH)</td><td>Streckgrenze: ab hier fließt der Werkstoff plastisch (nur bei ausgeprägter Streckgrenze)</td></tr><tr><td>Rp0,2</td><td>0,2 %-Dehngrenze: Ersatz, wenn die Kurve fließend übergeht</td></tr><tr><td>Rm</td><td>Zugfestigkeit: Höchstkraft / S₀</td></tr><tr><td>A</td><td>Bruchdehnung: bleibende Verlängerung nach dem Bruch in %</td></tr></table>
      <table><tr><th>Werkstoff (Übungswerte)</th><th>E in N/mm²</th><th>Re / Rp0,2</th><th>Rm</th><th>A in %</th></tr>${MATS.map(m => `<tr><td>${esc(m.kurz)}</td><td>${nd(m.E, 0)}</td><td>${m.type === 're' ? 'Re ' + m.Re : m.type === 'rp' ? 'Rp0,2 ' + m.Rp : '–'}</td><td>${m.Rm}</td><td>${nd(m.A, m.A < 1 ? 2 : 0)}</td></tr>`).join('')}</table>
      <div class="inst" style="padding:6px">${svgChart(m1, { full: true, kv: true })}</div><div class="inst" style="padding:6px">${svgChart(m2, { full: true, kv: true, off: true })}</div></div></details>
    <details><summary>🧮 Formeln und Einheiten</summary><div class="hb2">
      <span class="eq">S₀ = π · d₀² / 4  (Rundprobe)</span><span class="eq">σ = F / S₀   in N/mm²</span><span class="eq">ε = ΔL / L₀ · 100 %</span><span class="eq">A = (Lᵤ − L₀) / L₀ · 100 %</span><span class="eq">Hooke: σ = E · ε   (ε als Verhältnis, nicht in %)</span><span class="eq">Fm = Rm · S₀</span><span class="eq">σzul = Re / S  (Sicherheit S)</span>
      <span class="eq">HBW = 0,102 · 2F / (π · D · (D − √(D² − d²)))</span><span class="eq">HV = 0,1891 · F / d²   (d = Mittel der Diagonalen)</span><span class="eq">HRC = 100 − h / 0,002 mm</span><span class="eq">Rm ≈ 3,5 · HB   (Richtwert für Stahl)</span>
      <p><b>Einheiten:</b> 1 N/mm² = 1 MPa. 1 kN = 1000 N. 1 mm² = 10⁻⁶ m². Dehnung in % = Verhältnis · 100. 1 µm = 0,001 mm.</p></div></details>
    <details><summary>🔨 Härteprüfung</summary><div class="hb2"><table><tr><th>Verfahren</th><th>Eindringkörper</th><th>Geeignet für</th></tr>${D.hardness.map(x => `<tr><td>${esc(x.name)}</td><td>${esc(x.body)}</td><td>${esc(x.good)}</td></tr>`).join('')}</table>
      <p>Brinell: d muss zwischen 0,24·D und 0,6·D liegen. Angabe zum Beispiel 229 HBW 10/3000. Vickers: 450 HV 10 heißt HV mit 98,07 N. Rockwell: Vorkraft 98 N, Gesamtkraft 1471 N.</p></div></details>
    <details><summary>🏷️ Bezeichnungssystem (DIN EN 10027-1)</summary><div class="hb2"><table><tr><th>Name</th><th>Bedeutung</th></tr>
      <tr><td>S235JR</td><td>S = Stahlbau, 235 = Mindest-Streckgrenze, JR = 27 J bei +20 °C</td></tr><tr><td>E295</td><td>E = Maschinenbau, 295 = Mindest-Streckgrenze</td></tr><tr><td>C45</td><td>unlegiert, 45/100 = 0,45 % C</td></tr><tr><td>16MnCr5</td><td>0,16 % C, Mn und Cr, Kennzahl 5/4 = 1,25 % Mn (niedrig legiert, Einsatzstahl)</td></tr><tr><td>42CrMo4</td><td>0,42 % C, Cr 4/4 = 1 %, Mo (niedrig legiert, Vergütungsstahl)</td></tr><tr><td>X5CrNi18-10</td><td>X = hoch legiert, 0,05 % C, 18 % Cr, 10 % Ni</td></tr><tr><td>EN-GJL-200</td><td>Gusseisen mit Lamellengraphit, Rm min. 200 N/mm²</td></tr><tr><td>EN-GJS-400-15</td><td>Kugelgraphit, Rm min. 400 N/mm², A min. 15 %</td></tr><tr><td>EN AW-6082</td><td>Aluminium-Knetlegierung (AlMgSi)</td></tr></table>
      <p>Faktoren: Cr, Co, Mn, Ni, Si, W = 4 · Al, Cu, Mo, Nb, Ti, V, Zr = 10 · C, N, P, S = 100 · B = 1000.</p></div></details>
    <details><summary>🌡️ Gefüge im Stahl</summary><div class="hb2"><table><tr><th>Gefüge</th><th>Eigenschaft</th></tr><tr><td>Ferrit</td><td>weich, zäh, fast kohlenstofffrei</td></tr><tr><td>Zementit Fe₃C</td><td>sehr hart, spröde, 6,67 % C</td></tr><tr><td>Perlit</td><td>Lamellen aus Ferrit und Zementit, 0,8 % C, fest und zäh</td></tr><tr><td>Austenit</td><td>über A₁/A₃, gut umformbar</td></tr><tr><td>Martensit</td><td>entsteht beim Abschrecken aus dem Austenit, sehr hart und spröde</td></tr></table>
      <span class="eq">A₃ = 911 − 235 · C   (C bis 0,8 %, Lehrmodell)</span><span class="eq">Perlitanteil = C / 0,8 · 100 %   (C unter 0,8 %)</span><span class="eq">Zementitanteil = (C − 0,8) / 5,87 · 100 %   (C über 0,8 %)</span><p>Härtetemperatur: 30 bis 50 °C über A₃ (bis 0,8 % C), über A₁ (über 0,8 % C). Unter etwa 0,2 % C kaum härtbar.</p></div></details>
    <details><summary>🔥 Wärmebehandlung</summary><div class="hb2"><table><tr><th>Verfahren</th><th>Ziel</th><th>Temperatur</th></tr>${D.heat.map(x => `<tr><td>${esc(x.name)}</td><td>${esc(x.goal)}</td><td>${esc(x.temp)}</td></tr>`).join('')}</table></div></details>
    <details><summary>🧰 Werkstoffwahl</summary><div class="hb2"><p>Lege zuerst die Anforderungen fest (fest, zäh, korrosionsbeständig, zerspanbar, leicht, leitfähig), bewerte dann die Werkstoffgruppen und begründe die Wahl. Weitere Gesichtspunkte: Kosten, Verfügbarkeit, Schweißbarkeit, Umweltbedingungen.</p></div></details>`;
    void elS;
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'zug'; stopTween('zug'); stopTween('h'); S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    if (t === 'zug') renderZug(); else if (t === 'haerte') renderHaerte(); else if (t === 'name') renderName(); else if (t === 'fec') renderFec(); else if (t === 'wb') renderWb(); else if (t === 'wahl') renderWahl();
    else if (t === 'bsp') renderBsp(); else if (t === 'tasks') renderTasks(); else if (t === 'rt') renderTrainer(); else if (t === 'help') renderHelp();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'Werkstoff-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = 'Werkstoff-Lab: ' + T[2];
  }
  function setExam(on) { lsSet('exam', on ? '1' : '0'); updatePal(); $('#bExam').classList.toggle('on', on); $('#bExam').setAttribute('aria-pressed', on); toast(on ? '🎓 Prüfmodus an: Tipps kosten 25 % je Stufe.' : 'Prüfmodus aus: Tipps kosten nichts.'); if (S.tab === 'tasks') renderTasks(false); }
  let palSig = '';
  function updatePal() {
    const F = !!fx(), fxOn = F && !fx().isMuted(), n = Object.keys(done()).filter(k => TASKS.some(t => t.id === k)).length, sig = [F, fxOn, exam(), n, S.rt.streak, S.rt.best].join('|'); if (sig === palSig) return; palSig = sig;
    $('#pal').innerHTML = `${F ? `<button class="chip ${fxOn ? 'on' : ''}" data-a="fx" aria-pressed="${fxOn}" title="Effekte und Ton">${fxOn ? '🎉' : '🔇'} Effekte</button>` : ''}<button class="chip ${exam() ? 'on' : ''}" data-a="exam" aria-pressed="${exam()}" title="Prüfmodus: Tipps zählen als Abzug">🎓 Prüfmodus</button><button class="chip" data-a="rand" title="Zufällige Rechenaufgabe im Trainer">🎲 Zufallsaufgabe</button>
      <span id="stat">Aufgaben gelöst <b>${n}/${TASKS.length}</b> · Serie <b>${S.rt.streak}</b> · Beste Serie <b>${S.rt.best}</b></span>`;
    $('#bExam').classList.toggle('on', exam());
  }
  $('#pal').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.a === 'fx') { const F = fx(); if (F) { F.setMuted(!F.isMuted()); palSig = ''; updatePal(); if (!F.isMuted()) ding(); } }
    else if (b.dataset.a === 'exam') setExam(!exam());
    else if (b.dataset.a === 'rand') { setTab('rt'); newTrainer(); }
  });
  $('#bTasks').onclick = () => setTab('tasks'); $('#bHelp').onclick = () => setTab('help'); $('#bExam').onclick = () => setExam(!exam());
  $('#title').onclick = () => setTab('zug');
  $('#bMenu').onclick = () => {
    const rows = [['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung und Tipps'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Rechenaufgaben mit Serien-Zähler'], ['help', 'Hilfe und Spickzettel', 'Kennwerte, Formeln, Bezeichnungssystem, Einheiten'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben und Trainer-Serie auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
    sheet('Menü', (b, close) => {
      b.innerHTML = rows.map(r => `<button class="row" data-m="${r[0]}"><div class="grow"><b>${esc(r[1])}</b><small>${esc(r[2])}</small></div></button>`).join('');
      b.addEventListener('click', e => {
        const r = e.target.closest('.row'); if (!r) return; close(); const m = r.dataset.m;
        if (m === 'home') location.href = 'index.html'; else if (m === 'exam') setExam(!exam()); else if (m === 'reset') resetAll(); else setTab(m);
      });
    });
  };
  function resetAll() {
    sheet('Fortschritt zurücksetzen?', (b, close) => {
      b.innerHTML = '<p style="margin-top:0">Alle gelösten Aufgaben, Tipps, Quiz-Zähler und die Trainer-Serie dieses Labs werden auf diesem Gerät gelöscht. Das kann nicht rückgängig gemacht werden.</p><div class="btns"><button class="btn" data-x="no">Abbrechen</button><button class="btn danger" data-x="yes">Löschen</button></div>';
      b.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (!x) return; if (x.dataset.x === 'yes') { ['done', 'prog', 'hints', 'ctipps', 'rt', 'quiz'].forEach(k => { try { localStorage.removeItem(LS + k); } catch (er) {} }); S.rt = { n: 0, ok: 0, streak: 0, best: 0 }; S.q = {}; S.task = null; S.tRes = null; palSig = ''; updatePal(); updateBadge(); if (S.tab === 'tasks') renderTasks(); toast('Fortschritt gelöscht'); } close(); });
    });
  }

  /* Schnittstelle für Karriere/Lernpfad */
  root.WER_LAB = { id: 'wer', title: 'Werkstoff-Lab', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.WER_TASKS };

  /* ============================================================ Beispiele (Reiter "Beispiele", Aufruf ?bsp) */
  const BSP = D.beispiele || [], BSP_INTRO = "Fertige Beispiele zum Anschauen und Weiterspielen. „Laden“ öffnet das Beispiel im passenden Reiter.", BSP_BTN = 'Laden';
  function renderBsp() {
    const V = $('#bspView'); if (!V) return;
    V.innerHTML = '<div class="card pl"><h4>Beispiele</h4><p class="hint2" style="margin:0">' + BSP_INTRO + '</p></div>' +
      BSP.map((b, i) => '<div class="card pl"><h4>' + esc(b.titel) + '</h4><p style="margin:0 0 4px;line-height:1.45">' + esc(b.text) + '</p>' + '<p class="hint2" style="margin:0 0 4px">Öffnet: ' + esc((TABS.find(t => t[0] === b.tab) || [0, 0, ''])[2]) + '</p>' + '<div class="btns"><button class="btn pri" data-bsp="' + i + '" style="min-height:44px">' + BSP_BTN + '</button></div></div>').join('');
    V.onclick = e => { const x = e.target.closest('[data-bsp]'); if (x && BSP[+x.dataset.bsp]) loadBsp(BSP[+x.dataset.bsp]); };
  }
  function loadBsp(b) {
    const s = b.set;
    if (b.tab === 'zug') { Object.assign(S.zug, { mat: s.mat, show: !!s.show, off: !!s.off, eps: 0 }); lsSet('zug', { mat: S.zug.mat, calc: S.zug.calc }); }
    else if (b.tab === 'haerte') { Object.assign(S.haerte, s, { p: 1 }); lsSet('haerte', S.haerte); }
    else if (b.tab === 'name') { S.name.v = s.v; lsSet('name', S.name); }
    else if (b.tab === 'wb') { Object.assign(S.wb, s); lsSet('wb', S.wb); }
    setTab(b.tab); toast('Beispiel geladen: ' + b.titel);
  }

  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (S.tab === 'tasks' && curTask() && !$('#tkIn:focus')) { /* Diagramme skalieren per CSS */ } }, 150); });
  buildTabs(); updatePal(); setTab(S.tab);
  /* Aufruf ?aufgabe=wer1 (Startseite, Lernhefte): Aufgabe gleich öffnen */
  root.LabGoto = id => { try { if (TASKS.some(t => t.id === id)) { setTab('tasks'); startTask(id); return true; } } catch (e) {} return false; };
  try { const qa = new URLSearchParams(location.search).get('aufgabe'); if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); } } catch (e) {}
  /* Aufruf ?bsp: gleich die Beispielauswahl zeigen */
  try { const qb = new URLSearchParams(location.search); if (qb.has('bsp') && !qb.get('aufgabe')) { setTab('bsp'); } } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
