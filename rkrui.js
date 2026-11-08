'use strict';
/* Tonfunk Regelkreis-Lab: Oberfläche (Lab-Kennung 'rkr').
   ALLE Zahlenwerte sind ÜBUNGSWERTE für die Ausbildung, keine echte Anlage.
   Reiter: Regelkreis (Simulation mit Sprungantwort-Diagramm), Regler (Reglerkennlinien), Aufgaben, Trainer, Beispiele, Hilfe.
   Module: rkrcore.js (RKR_CORE, Rechenlogik und Simulation), rkrdata.js (RKR_DATA, RKR_TASKS: Aufgaben und Beispiele).
   Speicher (Präfix lm4.rkr.): tab, sim, reg, done ({id:true} nur gelöste), prog ({id:Prozent}), hints, ctipps (nur Prüfmodus), exam ('1'), rt (Trainer).
   Tipp-Abzug (25 % je Stufe, höchstens 2 Stufen) gibt es nur im Prüfmodus; beim normalen Üben kosten Tipps nichts.
   Aufruf: rkrlab.html?aufgabe=rkr1 öffnet die Aufgabe, rkrlab.html?bsp öffnet die Beispiele (?bsp=p1 springt zu einem Beispiel). */
(function (root) {
  const C = root.RKR_CORE, D = root.RKR_DATA;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.rkr.';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(LS + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} };
  const f = (v, d) => C.fmtN(v, d == null ? 2 : d, true), P = s => C.parseDe(s);
  const dots = l => '●'.repeat(l || 1) + '○'.repeat(3 - (l || 1));
  const fx = () => root.LochFX || null;
  const ding = () => { const F = fx(); if (F && F.sound) try { F.sound('ding', 0.6); } catch (e) {} };
  const sad = () => { const F = fx(); if (F && F.sound) try { F.sound('sad', 0.5); } catch (e) {} };
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
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>Regelkreis-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">rkrcore.js oder rkrdata.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks;

  /* ============================================================ Zustand */
  const TABS = [['sim', '🎛️', 'Regelkreis'], ['reg', '📈', 'Regler'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['bsp', '📖', 'Beispiele'], ['help', '📘', 'Hilfe']];
  /* Schieber: [min, max, Schritt, Einheit, Beschriftung] */
  const SL = { Kp: [0.1, 10, 0.1, '', 'Verstärkung Kp'], Tn: [0.5, 20, 0.1, 's', 'Nachstellzeit Tn'], Tv: [0, 5, 0.1, 's', 'Vorhaltezeit Tv'], h: [1, 20, 0.5, 'K', 'Schaltdifferenz'], Ks: [0.2, 4, 0.1, '', 'Übertragungsbeiwert Ks'], T1: [0.5, 20, 0.5, 's', 'Zeitkonstante T1'], T2: [0.5, 10, 0.5, 's', 'Zeitkonstante T2'], Tt: [0, 5, 0.1, 's', 'Totzeit Tt'], w: [10, 100, 5, '%', 'Sollwert w'], z: [-30, 30, 1, '%', 'Störgröße z (Sprung am Streckeneingang)'], tz: [0, 100, 1, 's', 'Zeitpunkt der Störung'], tEnd: [10, 120, 5, 's', 'Anzeigedauer'], e0: [0.5, 5, 0.5, '%', 'Sprunghöhe der Regelabweichung e'] };
  const SIMDEF = { reg: 'PI', str: 'PT1', Kp: 1, Tn: 3, Tv: 1, h: 4, Ks: 1.5, T1: 3, T2: 1.5, Tt: 0, w: 60, z: 0, tz: 20, tEnd: 40 };
  const REGDEF = { typ: 'PID', Kp: 2, Tn: 4, Tv: 1, e0: 1 };
  const clean = (o, def) => { const r = Object.assign({}, def, o || {}); Object.keys(def).forEach(k => { if (typeof def[k] === 'number') { const v = +r[k]; r[k] = Number.isFinite(v) ? v : def[k]; } }); return r; };
  const S = {
    tab: lsGet('tab', 'sim'),
    sim: clean(lsGet('sim', {}), SIMDEF), reg: clean(lsGet('reg', {}), REGDEF),
    task: null, tq: null, tAns: {}, tRes: null,
    tr: { q: null, ans: {}, res: null, level: 0 },
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {}))
  };
  if (!['offen', 'P', 'I', 'PI', 'PID', '2P'].includes(S.sim.reg)) S.sim.reg = 'PI';
  if (!['PT1', 'PT2', 'I'].includes(S.sim.str)) S.sim.str = 'PT1';
  if (!['P', 'I', 'PI', 'PID'].includes(S.reg.typ)) S.reg.typ = 'PID';
  const R0 = (() => { const m = /[?&]seed=([^&]+)/.exec(location.search); return C.rng(m ? decodeURIComponent(m[1]) : String(Math.random()) + Date.now()); })();

  /* ============================================================ Bausteine */
  const note = (t, cls) => `<div class="rdout ${cls || 'warn'}">${esc(t)}</div>`;
  const UEB = 'Alle Zahlenwerte in diesem Lab sind Übungswerte für die Ausbildung und gehören zu keiner echten Anlage. Maßgebend sind immer die Unterlagen und die Vorgaben deines Betriebs.';
  const ueb = () => `<div class="rdout warn">⚠ ${esc(UEB)}</div>`;
  const seg = (attr, opts, cur) => `<div class="seg">${opts.map(o => `<button ${attr}="${esc(o[0])}" class="${String(cur) === String(o[0]) ? 'on' : ''}">${esc(o[1])}</button>`).join('')}</div>`;
  const slider = (key, val, label) => { const s = SL[key]; return `<div class="sl"><label>${esc(label || s[4])}</label><output>${esc(f(val, 2))}${s[3] ? ' ' + esc(s[3]) : ''}</output><input type="range" data-s="${key}" min="${s[0]}" max="${s[1]}" step="${s[2]}" value="${val}" aria-label="${esc(label || s[4])}"></div>`; };
  const kv = (label, val, cls) => `<div class="${cls || ''}">${esc(label)}<b>${esc(val)}</b></div>`;

  /* ============================================================ Diagramm (SVG) */
  let uid = 0;
  const niceStep = (r, n) => { const raw = Math.max(r, 1e-9) / n, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; };
  /* o: {series:[{pts:[[t,v]..], cls}], tMax, yLab, clip, band:[lo,hi], vline:{t,label}, label} */
  function plot(o) {
    const W = 640, H = 250, L = 46, Rr = 14, Tp = 14, B = 34, pw = W - L - Rr, ph = H - Tp - B, tMax = o.tMax;
    let lo = 0, hi = 0; o.series.forEach(s => s.pts.forEach(p => { if (Number.isFinite(p[1])) { if (p[1] < lo) lo = p[1]; if (p[1] > hi) hi = p[1]; } }));
    if (o.clip) { hi = Math.min(hi, o.clip); lo = Math.max(lo, -o.clip * 0.6); }
    if (hi - lo < 1e-9) hi = lo + 1;
    const st = niceStep(hi - lo, 5), yMax = Math.ceil(hi / st - 1e-9) * st, yMin = Math.floor(lo / st + 1e-9) * st, sx = t => L + t / tMax * pw, sy = v => Tp + ph - (v - yMin) / (yMax - yMin) * ph;
    const id = 'pc' + (++uid), fx2 = v => v.toFixed(1);
    let g = '', xs = niceStep(tMax, 6);
    for (let v = yMin; v <= yMax + st / 2; v += st) g += `<line class="p-gr" x1="${L}" x2="${W - Rr}" y1="${fx2(sy(v))}" y2="${fx2(sy(v))}"/><text class="p-tx" x="${L - 5}" y="${fx2(sy(v) + 4)}" text-anchor="end">${esc(f(v, 2))}</text>`;
    for (let t = 0; t <= tMax + 1e-9; t += xs) g += `<line class="p-gr" x1="${fx2(sx(t))}" x2="${fx2(sx(t))}" y1="${Tp}" y2="${Tp + ph}"/><text class="p-tx" x="${fx2(sx(t))}" y="${Tp + ph + 15}" text-anchor="middle">${esc(f(t, 1))}</text>`;
    g += `<line class="p-ax" x1="${L}" x2="${L}" y1="${Tp}" y2="${Tp + ph}"/><line class="p-ax" x1="${L}" x2="${W - Rr}" y1="${fx2(sy(0))}" y2="${fx2(sy(0))}"/>`;
    g += `<text class="p-tx" x="${W - Rr}" y="${H - 6}" text-anchor="end">t in s</text><text class="p-tx" x="${L + 4}" y="${Tp + 10}">${esc(o.yLab || '')}</text>`;
    let body = '';
    if (o.band) body += `<rect class="p-band" x="${L}" width="${pw}" y="${fx2(sy(o.band[1]))}" height="${fx2(Math.max(1, sy(o.band[0]) - sy(o.band[1])))}"/>`;
    if (o.vline) body += `<line class="p-bl" x1="${fx2(sx(o.vline.t))}" x2="${fx2(sx(o.vline.t))}" y1="${Tp}" y2="${Tp + ph}"/><text class="p-tx" x="${fx2(sx(o.vline.t) + 4)}" y="${Tp + 22}">${esc(o.vline.label)}</text>`;
    o.series.forEach(s => { const step = Math.max(1, Math.floor(s.pts.length / 500)); let d = ''; for (let i = 0; i < s.pts.length; i += step) d += (d ? 'L' : 'M') + fx2(sx(s.pts[i][0])) + ' ' + fx2(sy(s.pts[i][1])); const last = s.pts[s.pts.length - 1]; if ((s.pts.length - 1) % step) d += 'L' + fx2(sx(last[0])) + ' ' + fx2(sy(last[1])); body += `<path class="${s.cls}" d="${d}"/>`; });
    const leg = o.series.filter(s => s.name).map((s, i) => `<text class="p-lb" x="${L + 8 + i * 150}" y="${H - 6}" style="${s.cls === 'p-x' ? 'fill:var(--accent)' : s.cls === 'p-w' ? 'fill:var(--hi)' : 'fill:var(--ok)'}">${esc(s.name)}</text>`).join('');
    return `<div class="plot inst">${o.label ? `<div class="pl-cap">${esc(o.label)}</div>` : ''}<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc((o.label ? o.label + ': ' : '') + 'Diagramm ' + (o.yLab || '') + ' über der Zeit')}"><clipPath id="${id}"><rect x="${L}" y="${Tp}" width="${pw}" height="${ph}"/></clipPath>${g}<g clip-path="url(#${id})">${body}</g>${leg}</svg></div>`;
  }
  const pts = (S0, key) => S0.t.map((t, i) => [t, S0[key][i]]);
  /* Zeichnet eine Simulation aus Aufgaben, Beispielen und Reglerreiter: sim = {kind, cfg, label, band, clip} */
  function drawSim(sim, opt) {
    opt = opt || {}; const c = sim.cfg;
    if (sim.kind === 'ctrl') {
      const n = 400, a = []; for (let i = 0; i <= n; i++) { const t = c.tEnd * i / n; a.push([t, i === 0 ? 0 : C.ctrlStep(c.typ, c.Kp, c.Tn, c.Tv, t, c.e0)]); }
      if (c.typ === 'PID') { const Tf = c.Tv / C.NDF; for (let i = 0; i < 40; i++) { const t = Tf * 0.15 * i; if (t < c.tEnd) a.push([t, C.ctrlStep(c.typ, c.Kp, c.Tn, c.Tv, t, c.e0)]); } a.sort((p, q) => p[0] - q[0]); }
      const e = [[0, 0], [0, c.e0], [c.tEnd, c.e0]];
      return plot({ label: sim.label, tMax: c.tEnd, yLab: 'in %', series: [{ pts: e, cls: 'p-w', name: 'Regelabweichung e' }, { pts: a, cls: 'p-x', name: 'Stellgröße y' }] });
    }
    const Sm = C.simulate(c), w = c.w, series = [{ pts: pts(Sm, 'x'), cls: 'p-x', name: 'Regelgröße x' }, { pts: [[0, w], [c.tEnd, w]], cls: 'p-w', name: sim.kind === 'open' ? 'Sprung am Eingang' : 'Sollwert w' }];
    const o = { label: sim.label, tMax: c.tEnd, yLab: 'in %', series, clip: sim.clip ? 3 * Math.abs(w) : 0 };
    if (sim.band) o.band = [w * 0.98, w * 1.02];
    if (opt.vline && c.z) o.vline = { t: c.tz, label: 'Störung' };
    return plot(o);
  }

  /* ============================================================ Kennwerte */
  function simKV(c) {
    const Sm = C.simulate(c);
    if (c.reg === 'offen') {
      let h = '<div class="kv">';
      if (c.str === 'I') h += kv('Steigung von x', f(c.Ks * c.w, 2) + ' %/s') + kv('Endwert', 'steigt weiter (ohne Ausgleich)', 'warn');
      else { const xe = c.Ks * c.w; h += kv('Endwert x', f(xe, 2) + ' %') + kv('Ks = x / Sprung', f(c.Ks, 2)) + (c.str === 'PT1' ? kv('63 % des Endwerts bei', f(c.Tt + c.T1, 2) + ' s') + kv('95 % des Endwerts bei', f(c.Tt + 3 * c.T1, 2) + ' s') : ''); }
      return { html: h + '</div>', note: '' };
    }
    if (c.reg === '2P') {
      const a = C.analyse2P(Sm), z = C.zweipunkt(c.w, c.h, c.Ks * c.yh, c.xa, c.T1, c.Tt);
      if (!Number.isFinite(z.swing)) return { html: '', note: note('Der Endwert bei EIN (Ks · 100 %) muss über der oberen Schaltschwelle liegen, sonst schaltet der Regler nie aus.', 'bad') };
      return { html: `<div class="kv">${kv('Schwankung (Spitze–Spitze)', f(a.swing, 1) + ' K')}${kv('Mittelwert', f(a.mean, 1) + ' %')}${kv('Periodendauer', f(a.period, 1) + ' s')}${kv('Einschaltdauer', f(a.duty * 100, 0) + ' %')}</div>`, note: note('Zum Vergleich gerechnet: Schwankung ' + f(z.swing, 1) + ' K, Periodendauer ' + f(z.period, 1) + ' s. Die Schwankung ist ' + (c.Tt > 0 ? 'größer als die Schaltdifferenz (' + f(c.h, 1) + ' K), weil die Totzeit die Wirkung verspätet.' : 'gleich der Schaltdifferenz (' + f(c.h, 1) + ' K), weil keine Totzeit im Kreis ist.'), 'ok') };
    }
    const a = C.analyse(Sm), stCls = a.stab === 'stabil' ? 'ok' : a.stab === 'grenzstabil' ? 'warn' : 'bad';
    let h = '<div class="kv">';
    if (a.stab === 'instabil') h += kv('Verhalten', 'instabil', 'bad') + kv('Aufklingverhältnis', f(a.ratio, 2) + ' je 2 Spitzen', 'bad');
    else {
      h += kv('Endwert x', f(a.xend, 2) + ' %') + kv('bleibende Regelabweichung', f(a.ebl, 2) + ' %', Math.abs(a.ebl) > 0.02 * Math.abs(c.w) ? 'warn' : 'ok') + kv('Überschwingweite ü', f(a.ueb, 1) + ' %') + kv('Anregelzeit', a.tan == null ? '–' : f(a.tan, 1) + ' s') + kv('Ausregelzeit (±2 %)', a.taus == null ? 'nicht erreicht' : f(a.taus, 1) + ' s') + kv('Verhalten', a.stab, stCls);
    }
    h += '</div>';
    let n = '';
    if (a.stab === 'instabil') n = note('Der Kreis ist instabil: Die Schwingung schaukelt sich auf. Verkleinere die Verstärkung oder den I-Anteil (größeres Tn), oder nimm die Totzeit heraus.', 'bad');
    else if (a.stab === 'grenzstabil') n = note('Grenzstabil: Dauerschwingung mit gleichbleibender Amplitude. Schon eine kleine Änderung kippt den Kreis in Richtung instabil.', 'warn');
    else if (Math.abs(a.ebl) > 0.02 * Math.abs(c.w) && (c.reg === 'P')) n = note('Der P-Regler lässt eine bleibende Regelabweichung übrig: e = w / (1 + Kp · Ks). Nur ein I-Anteil (PI oder I) gleicht sie ganz aus.', 'warn');
    return { html: h, note: n };
  }

  /* ============================================================ Reiter Regelkreis */
  /* PRUEFEN P19: Zweipunktregler-Heizung ist normiert: Endwert bei EIN = Ks · 100 %, Umgebungswert (AUS) = 0, Anzeige in % statt °C. Soll die Aufgabenwelt echte Temperaturen (Umgebung 20 °C) verwenden? */
  const simCfg = s => ({ reg: s.reg, str: s.str, Kp: s.Kp, Tn: s.Tn, Tv: s.Tv, h: s.h, yh: 100, xa: 0, Ks: s.Ks, T1: s.T1, T2: s.T2, Tt: s.Tt, w: s.w, z: s.reg === 'offen' ? 0 : s.z, tz: s.tz, tEnd: s.tEnd, dt: s.tEnd > 60 ? 0.02 : 0.01 });
  const REGSEG = [['offen', 'ohne Regler'], ['P', 'P'], ['I', 'I'], ['PI', 'PI'], ['PID', 'PID'], ['2P', 'Zweipunkt']];
  const STRSEG = [['PT1', 'PT1 (1 Speicher)'], ['PT2', 'PT2 (2 Speicher)'], ['I', 'ohne Ausgleich']];
  function renderSim() {
    const s = S.sim, r = s.reg;
    const reglerSl = r === 'P' ? ['Kp'] : r === 'I' ? ['Tn'] : r === 'PI' ? ['Kp', 'Tn'] : r === 'PID' ? ['Kp', 'Tn', 'Tv'] : r === '2P' ? ['h'] : [];
    const strSl = s.str === 'PT2' ? ['Ks', 'T1', 'T2', 'Tt'] : s.str === 'I' ? ['Ks', 'Tt'] : ['Ks', 'T1', 'Tt'];
    const wl = r === 'offen' ? 'Sprung der Stellgröße' : 'Sollwert w';
    $('#simView').innerHTML = ueb() + `<div class="card pl"><h4>Regelkreis aufbauen</h4>
      <div class="fbar"><span style="font-size:12px;color:var(--mute)">REGLER</span>${seg('data-reg', REGSEG, r)}</div>
      <div class="fbar"><span style="font-size:12px;color:var(--mute)">STRECKE</span>${seg('data-str', STRSEG, s.str)}</div>
      <div class="sgrid"><div>${reglerSl.map(k => slider(k, s[k], k === 'Tn' && r === 'I' ? 'Integrierzeit Ti' : null)).join('')}${slider('w', s.w, wl)}${r === 'offen' ? '' : slider('z', s.z) + (s.z ? slider('tz', s.tz) : '')}</div><div>${strSl.map(k => slider(k, s[k], k === 'Ks' && s.str === 'I' ? 'Übertragungsbeiwert Ks (1/s)' : null)).join('')}${slider('tEnd', s.tEnd)}</div></div>
      <div class="btns"><button class="btn" data-sa="reset">Zurücksetzen</button></div></div><div id="simOut"></div>`;
    updateSim();
  }
  function updateSim() {
    const c = simCfg(S.sim), Sm = C.simulate(c), k = simKV(c), o = $('#simOut'); if (!o) return;
    const unstable = c.reg !== '2P' && c.reg !== 'offen' && C.analyse(Sm).stab === 'instabil';
    let h = k.note + k.html;
    h += `<div class="plots${c.reg === 'offen' ? '' : ' two'}">` + drawSim({ kind: c.reg === 'offen' ? 'open' : 'closed', cfg: c, label: 'Regelgröße x (Sprungantwort)', clip: unstable }, { vline: true });
    if (c.reg !== 'offen') h += plot({ label: 'Stellgröße y', tMax: c.tEnd, yLab: 'in %', clip: unstable ? 3 * Math.abs(c.w) : 0, series: [{ pts: pts(Sm, 'y'), cls: 'p-y', name: 'Stellgröße y' }], vline: c.z ? { t: c.tz, label: 'Störung' } : null });
    o.innerHTML = h + '</div>';
  }
  $('#simView').addEventListener('input', e => {
    const k = e.target.dataset && e.target.dataset.s; if (!k) return; const v = +e.target.value; if (!Number.isFinite(v)) return;
    S.sim[k] = v; lsSet('sim', S.sim); const out = e.target.parentNode && e.target.parentNode.querySelector('output'); if (out) out.textContent = f(v, 2) + (SL[k][3] ? ' ' + SL[k][3] : '');
    if (k === 'z' && ((v === 0) !== !$('input[data-s=tz]'))) { renderSim(); return; }
    updateSim();
  });
  $('#simView').addEventListener('click', e => {
    const a = e.target.closest('[data-reg]'), b = e.target.closest('[data-str]'), r = e.target.closest('[data-sa]');
    if (a) { S.sim.reg = a.dataset.reg; if (S.sim.reg === '2P') { S.sim.str = 'PT1'; if (S.sim.T1 < 10) S.sim.T1 = 20; if (S.sim.Ks < 0.6) S.sim.Ks = 1; if (S.sim.w > 80) S.sim.w = 50; if (S.sim.tEnd < 60) S.sim.tEnd = 100; } } else if (b) S.sim.str = b.dataset.str; else if (r) S.sim = clean({}, SIMDEF); else return;
    lsSet('sim', S.sim); renderSim();
  });

  /* ============================================================ Reiter Regler */
  const REGEQ = { P: 'y = Kp · e', I: 'y = 1/Ti · ∫ e dt', PI: 'y = Kp · (e + 1/Tn · ∫ e dt)', PID: 'y = Kp · (e + 1/Tn · ∫ e dt + Tv · de/dt)' };
  function renderReg() {
    const s = S.reg, t = s.typ;
    $('#regView').innerHTML = ueb() + `<div class="card pl"><h4>Reglerkennlinie: Sprung der Regelabweichung</h4>
      <div class="fbar"><span style="font-size:12px;color:var(--mute)">REGLERART</span>${seg('data-rt', [['P', 'P'], ['I', 'I'], ['PI', 'PI'], ['PID', 'PID']], t)}</div>
      <div class="rdout"><b>${esc(C.REGLER[t])}</b>: <span class="eq" style="display:inline">${esc(REGEQ[t])}</span></div>
      <div class="sgrid"><div>${t === 'I' ? '' : slider('Kp', s.Kp)}${t === 'P' ? '' : slider('Tn', s.Tn, t === 'I' ? 'Integrierzeit Ti' : null)}${t === 'PID' ? slider('Tv', s.Tv) : ''}</div><div>${slider('e0', s.e0)}</div></div></div><div id="regOut"></div>`;
    updateReg();
  }
  function updateReg() {
    const s = S.reg, t = s.typ, o = $('#regOut'); if (!o) return; const y0 = t === 'I' ? 0 : s.Kp * s.e0;
    let h = '<div class="kv">';
    if (t !== 'I') h += kv('Sprung am Anfang (P-Anteil)', f(y0, 2) + ' %');
    if (t === 'PI' || t === 'PID') h += kv('Verdopplung nach Tn', f(s.Tn, 1) + ' s'), h += kv('y bei t = Tn', f(C.ctrlStep(t, s.Kp, s.Tn, s.Tv, s.Tn, s.e0), 2) + ' %');
    if (t === 'I') h += kv('Anstieg je Sekunde', f(s.e0 / s.Tn, 2) + ' %/s');
    if (t === 'PID') h += kv('D-Spitze (gefiltert) ca.', f(s.Kp * s.e0 * (1 + C.NDF), 1) + ' %');
    h += '</div>' + drawSim({ kind: 'ctrl', cfg: { typ: t, Kp: s.Kp, Tn: s.Tn, Tv: s.Tv, e0: s.e0, tEnd: t === 'I' ? s.Tn * 4 : Math.max(s.Tn * 3, 6) }, label: 'Stellgröße y nach einem Sprung von e' });
    o.innerHTML = h + `<p class="hint2">Der D-Anteil wird im Lab durch ein Verzögerungsglied (Tf = Tv/${C.NDF}) begrenzt, sonst wäre die Spitze unendlich hoch.</p>`;
  }
  $('#regView').addEventListener('input', e => {
    const k = e.target.dataset && e.target.dataset.s; if (!k) return; const v = +e.target.value; if (!Number.isFinite(v)) return;
    S.reg[k] = v; lsSet('reg', S.reg); const out = e.target.parentNode && e.target.parentNode.querySelector('output'); if (out) out.textContent = f(v, 2) + (SL[k][3] ? ' ' + SL[k][3] : '');
    updateReg();
  });
  $('#regView').addEventListener('click', e => { const b = e.target.closest('[data-rt]'); if (!b) return; S.reg.typ = b.dataset.rt; lsSet('reg', S.reg); renderReg(); });

  /* ============================================================ Aufgaben und Trainer */
  const done = () => lsGet('done', {});
  const exam = () => lsGet('exam', '0') === '1';
  function pctFor(id) { if (!exam()) return 100; return 100 - 25 * Math.min(2, lsGet('ctipps', {})[id] || 0); }
  function markSolved(id, pct) {
    const p = lsGet('prog', {}); if ((p[id] || 0) < pct) p[id] = pct; lsSet('prog', p);
    const d = done(); d[id] = true; lsSet('done', d); updateBadge(); updatePal();
  }
  function updateBadge() { const b = $('#tkBd'); if (b) b.textContent = Object.keys(done()).filter(k => TASKS.some(t => t.id === k)).length + '/' + TASKS.length; }
  const curTask = () => S.task && TASKS.find(t => t.id === S.task);
  const unit = q => (q.ask.unit ? ' ' + q.ask.unit : '');
  const solText = q => (q.ask.type === 'choice' ? q.ask.choices[q.ask.correct] : f(q.value, 2) + unit(q));
  const diagrams = q => (q.sims && q.sims.length ? `<div class="plots${q.sims.length > 1 ? ' two' : ''}">${q.sims.map(x => drawSim(x)).join('')}</div>` : '');
  function qBody(q, a, r, pre) {
    if (q.ask.type === 'choice') return `<div class="opts">${q.ask.choices.map((c, i) => `<button data-tc="${i}" ${r && (r.ok || pre === 'rt') ? 'disabled' : ''} class="${r && i === q.ask.correct && (r.ok || pre === 'rt') ? 'ok' : a.c === i ? (r && !r.ok ? 'bad' : 'on') : ''}">${esc(c)}</button>`).join('')}</div>`;
    return `<label class="f"><span>${esc(q.ask.label)}${q.ask.unit ? ' (' + esc(q.ask.unit) + ')' : ''}</span><div class="qin"><input data-in="1" inputmode="decimal" autocomplete="off" value="${esc(a.v || '')}" ${r && (r.ok || pre === 'rt') ? 'disabled' : ''}><span class="u">${esc(q.ask.unit)}</span></div></label>`;
  }
  function evalQ(q, a) {
    if (q.ask.type === 'choice') { if (a.c == null) { toast('Wähle zuerst eine Antwort.'); return null; } return { ok: a.c === q.ask.correct, given: q.ask.choices[a.c] }; }
    const v = P(a.v); if (!Number.isFinite(v)) { toast('Bitte gib eine Zahl ein (mit Komma oder Punkt).'); return null; }
    return { ok: Math.abs(v - q.value) <= q.tol + 1e-9, given: f(v, 2) + unit(q) };
  }
  const resBlock = (q, r, showExpl) => `<ul class="tl"><li class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓ Richtig: ' + esc(r.given) : '✗ Deine Antwort „' + esc(r.given) + '“ stimmt nicht.'}</li>${q.ask.type === 'num' && q.tol > 0.011 ? `<li>ℹ Erlaubte Abweichung: ±${esc(f(q.tol, 2))}${esc(unit(q))} (Ablesen und Rundung).</li>` : ''}</ul>` +
    (showExpl ? `<div class="rdout ${r.ok ? 'ok' : 'bad'}"><b>Lösung:</b> ${esc(solText(q))}<br><br><b>Lösungsweg:</b> ${esc(q.expl)}</div>` : '<div class="rdout bad">🎓 Prüfmodus: Den Lösungsweg gibt es erst, wenn die Aufgabe richtig gelöst ist. Nutze einen Tipp oder versuche es noch einmal.</div>');

  function renderTasks(top) {
    const V = $('#taskView'), d = done(), prog = lsGet('prog', {}), t = curTask(), n100 = TASKS.filter(x => d[x.id]).length; let h = '';
    if (t) {
      const q = S.tq, r = S.tRes && S.tRes.id === t.id ? S.tRes : null, a = S.tAns[t.id] || {};
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv">${dots(t.level)}</div><p style="margin:8px 0">${esc(q.text)}</p>${diagrams(q)}${qBody(q, a, r, 'tk')}`;
      h += `<div class="btns"><button class="btn pri" data-ta="chk"${r && r.ok ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" data-ta="hint">💡 Tipp</button><button class="btn" data-ta="close">Schließen</button></div>`;
      if (exam()) h += '<p class="hint2" style="color:var(--warn)">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>';
      if (r) { h += resBlock(q, r, r.ok || !exam()); if (r.ok) h += `<div class="btns"><button class="btn pri" data-ta="next">Nächste Aufgabe</button></div>`; }
      h += '</div>';
    }
    h += `<p class="hint2" style="margin:4px 0 0">${n100} von ${TASKS.length} Aufgaben gelöst. ${exam() ? '🎓 Prüfmodus ist an.' : 'Tipp: Im Prüfmodus (🎓 oben) zählen Tipps als Abzug.'}</p><p class="hint2" style="margin:4px 0 0">⚠ ${esc(UEB)}</p>`;
    let last = '';
    TASKS.forEach(x => { if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; } const p = prog[x.id]; h += `<button class="row" data-t="${esc(x.id)}"><span class="dot ${d[x.id] ? 'g' : ''}">${d[x.id] ? '✓' : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${dots(x.level)}</span>${p != null && p < 100 ? ' · bisher ' + p + ' %' : ''}</small></div></button>`; });
    V.innerHTML = h; if (top !== false) $('#pgTasks').scrollTop = 0;
  }
  function checkTask(t) {
    const a = S.tAns[t.id] || {}, e = evalQ(S.tq, a); if (!e) return; const pct = e.ok ? pctFor(t.id) : 0;
    S.tRes = { id: t.id, ok: e.ok, given: e.given, pct };
    if (e.ok) { markSolved(t.id, pct); const F = fx(); if (F && F.pass) try { F.pass(pct); } catch (er) {} else ding(); toast(exam() && pct < 100 ? pct + ' % (Tipps abgezogen)' : '🎉 Geschafft!'); } else { sad(); toast('Noch nicht richtig. Lies die Lösung und versuche es noch einmal.'); }
    renderTasks(false);
  }
  function hintFor(q, id) {
    const h = lsGet('hints', {}), n = Math.min(2, (h[id] || 0) + 1), ex = exam(); h[id] = Math.max(h[id] || 0, n); lsSet('hints', h);
    if (ex) { const c = lsGet('ctipps', {}); c[id] = Math.max(c[id] || 0, n); lsSet('ctipps', c); }
    sheet('Tipp, Stufe ' + n + ' von 2', b => {
      let x = `<p style="margin-top:0"><b>Stufe 1:</b> ${esc(q.tips[0])}</p>`; if (n >= 2) x += `<p><b>Stufe 2:</b> ${esc(q.tips[1])}</p>`;
      x += n >= 2 ? '<p class="hint2">Mehr Tipps gibt es nicht. Den Lösungsweg siehst du nach dem Prüfen.</p>' : '<p class="hint2">Noch mehr Hilfe? Tippe noch einmal auf „Tipp“.</p>';
      x += ex ? '<p class="hint2" style="color:var(--warn)">Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>' : '<p class="hint2">Beim normalen Üben kosten Tipps nichts. Im Prüfmodus (🎓) zählen sie.</p>';
      b.innerHTML = x;
    });
  }
  function startTask(id) {
    const t = TASKS.find(x => x.id === id); if (!t) return;
    S.task = id; S.tq = D.makeTask(t); S.tAns = {}; S.tRes = null;
    const h = lsGet('hints', {}), c = lsGet('ctipps', {}); if (h[id]) { delete h[id]; lsSet('hints', h); } if (c[id]) { delete c[id]; lsSet('ctipps', c); }
    renderTasks();
  }
  const tv = $('#taskView');
  tv.addEventListener('input', e => { const t = curTask(); if (t && e.target.dataset.in) (S.tAns[t.id] = S.tAns[t.id] || {}).v = e.target.value; });
  tv.addEventListener('keydown', e => { const t = curTask(); if (t && e.key === 'Enter' && e.target.dataset.in) { e.preventDefault(); checkTask(t); } });
  tv.addEventListener('click', e => {
    const t = curTask(), tc = e.target.closest('[data-tc]'), ta = e.target.closest('[data-ta]'), row = e.target.closest('.row[data-t]');
    if (tc && t) { (S.tAns[t.id] = S.tAns[t.id] || {}).c = +tc.dataset.tc; if (S.tRes && !S.tRes.ok) S.tRes = null; renderTasks(false); return; }
    if (ta && t) { const a = ta.dataset.ta; if (a === 'chk') checkTask(t); else if (a === 'hint') hintFor(S.tq, t.id); else if (a === 'close') { S.task = null; S.tRes = null; renderTasks(); } else if (a === 'next') { const i = TASKS.findIndex(x => x.id === t.id), nx = TASKS.slice(i + 1).find(x => !done()[x.id]) || TASKS[(i + 1) % TASKS.length]; startTask(nx.id); } return; }
    if (row) startTask(row.dataset.t);
  });

  /* Zufalls-Trainer (Tipps kosten hier nie etwas) */
  function newTrainer() { const T = S.tr; T.q = D.randomQ(R0, T.level); T.ans = {}; T.res = null; renderTrainer(); }
  function renderTrainer() {
    const T = S.tr; if (!T.q) { newTrainer(); return; }
    const q = T.q;
    $('#rtView').innerHTML = `<div class="stats"><div class="bx"><b>${S.rt.n}</b>Fragen</div><div class="bx"><b>${S.rt.ok}</b>richtig</div><div class="bx"><b>${S.rt.streak}</b>Serie</div><div class="bx"><b>${S.rt.best}</b>Beste Serie</div></div>
      <div class="fbar"><span class="lbl" style="font-size:12px;color:var(--mute)">STUFE</span><div class="seg">${[[0, 'Alle'], [1, '1'], [2, '2'], [3, '3']].map(l => `<button data-lv="${l[0]}" class="${T.level === l[0] ? 'on' : ''}">${l[1]}</button>`).join('')}</div></div>
      <div class="card pl"><h4>${esc(q.cat)} · <span class="lv">${dots(q.level)}</span></h4><div class="big">${esc(q.title)}</div><p style="margin:8px 0">${esc(q.text)}</p>${diagrams(q)}${qBody(q, T.ans, T.res, 'rt')}
      <div class="btns"><button class="btn pri" data-ra="chk" ${T.res ? 'disabled' : ''}>✓ Prüfen</button><button class="btn" data-ra="hint" ${T.res ? 'disabled' : ''}>💡 Tipp</button><button class="btn" data-ra="next">${T.res ? 'Nächste Frage' : 'Überspringen'}</button></div>
      ${T.res ? resBlock(q, T.res, true) : ''}</div>`;
  }
  const rv = $('#rtView');
  rv.addEventListener('input', e => { if (e.target.dataset.in) S.tr.ans.v = e.target.value; });
  rv.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.in) { e.preventDefault(); trainerCheck(); } });
  rv.addEventListener('click', e => {
    const T = S.tr, tc = e.target.closest('[data-tc]'), ra = e.target.closest('[data-ra]'), lv = e.target.closest('[data-lv]');
    if (lv) { T.level = +lv.dataset.lv; newTrainer(); return; }
    if (tc && !T.res) { T.ans.c = +tc.dataset.tc; renderTrainer(); return; }
    if (ra) { const a = ra.dataset.ra; if (a === 'chk') trainerCheck(); else if (a === 'hint') hintFor(T.q, 'rt'); else { if (!T.res && S.rt.streak) { S.rt.streak = 0; lsSet('rt', S.rt); } newTrainer(); updatePal(); } }
  });
  function trainerCheck() {
    const T = S.tr; if (T.res) return; const e = evalQ(T.q, T.ans); if (!e) return;
    T.res = { ok: e.ok, given: e.given }; S.rt.n++; if (e.ok) { S.rt.ok++; S.rt.streak++; S.rt.best = Math.max(S.rt.best, S.rt.streak); ding(); } else { S.rt.streak = 0; sad(); }
    lsSet('rt', S.rt); renderTrainer(); updatePal();
  }

  /* ============================================================ Beispiele */
  function exBody(e) {
    if (e.tab === 'reg') { const c = e.cfg; return `<div class="kv">${kv('Sprung am Anfang', f(c.Kp * c.e0, 2) + ' %')}${kv('Verdopplung nach Tn', f(c.Tn, 1) + ' s')}</div>` + drawSim({ kind: 'ctrl', cfg: c }); }
    const c = Object.assign({}, e.cfg, { dt: e.cfg.tEnd > 60 ? 0.02 : 0.01 }), k = simKV(c);
    return k.note + k.html + drawSim({ kind: c.reg === 'offen' ? 'open' : 'closed', cfg: c }, { vline: true });
  }
  function renderBsp() {
    $('#bspView').innerHTML = `<p class="hint2" style="margin:0 0 8px">Fertig durchgerechnete Beispiele (Übungswerte). Mit „In den Simulator laden“ öffnest du die Zahlen im passenden Reiter und kannst sie verändern.</p>` + D.examples.map(e => `<div class="card pl" id="ex_${e.id}"><h4>Beispiel</h4><div class="big">${esc(e.title)}</div><p style="margin:4px 0 8px">${esc(e.text)}</p>${exBody(e)}<div class="btns"><button class="btn pri" data-ex="${e.id}">In den Simulator laden</button></div></div>`).join('');
  }
  $('#bspView').addEventListener('click', e => {
    const b = e.target.closest('[data-ex]'); if (!b) return; const x = D.examples.find(z => z.id === b.dataset.ex), c = x.cfg;
    if (x.tab === 'reg') { S.reg = clean({ typ: c.typ, Kp: c.Kp, Tn: c.Tn, Tv: c.Tv, e0: c.e0 }, REGDEF); lsSet('reg', S.reg); }
    else { S.sim = clean({ reg: c.reg, str: c.str, Kp: c.Kp, Tn: c.Tn, Tv: c.Tv, h: c.h, Ks: c.Ks, T1: c.T1, T2: c.T2, Tt: c.Tt, w: c.w, z: c.z, tz: c.tz, tEnd: c.tEnd }, SIMDEF); lsSet('sim', S.sim); }
    setTab(x.tab); toast('Beispiel geladen: ' + x.title);
  });

  /* ============================================================ Hilfe */
  function renderHelp() {
    const sec = (t, b, open) => `<details${open ? ' open' : ''}><summary>${t}</summary><div class="hb2">${b}</div></details>`;
    $('#helpView').innerHTML =
      `<div class="rdout warn">⚠ ${esc(UEB)}</div>` +
      sec('Regelkreis und Begriffe', `<p><b>Regeln</b> heißt: Eine Größe (Regelgröße x) wird laufend gemessen, mit dem Sollwert (Führungsgröße w) verglichen und so beeinflusst, dass sie dem Sollwert folgt. Weil das Ergebnis auf den Eingang zurückwirkt, ist der Wirkungsablauf geschlossen (Regelkreis). Beim <b>Steuern</b> gibt es keine Rückmeldung.</p><table><tr><th>Größe</th><th>Bedeutung</th></tr><tr><td>x</td><td>Regelgröße (Istwert)</td></tr><tr><td>w</td><td>Führungsgröße (Sollwert)</td></tr><tr><td>y</td><td>Stellgröße (Ausgang des Reglers)</td></tr><tr><td>z</td><td>Störgröße (wirkt von außen)</td></tr><tr><td>e</td><td>Regelabweichung</td></tr></table><span class="eq">e = w − x</span><p>Teile des Kreises: Regler (vergleicht, bildet y), Stellglied (setzt y um), Regelstrecke (die Anlage), Messeinrichtung (meldet x zurück).</p>`, true) +
      sec('Regelstrecke und Sprungantwort', `<p>Die <b>Sprungantwort</b> zeigt, wie die Regelgröße auf einen Sprung der Stellgröße reagiert.</p><span class="eq">Ks = Δx / Δy (Übertragungsbeiwert)</span><span class="eq">PT1: x(t) = Ks · Δy · (1 − e^(−t/T))</span><p>Bei t = T sind 63 % des Endwerts erreicht, nach 3·T etwa 95 %. <b>Mit Ausgleich:</b> x läuft auf einen festen Wert (z. B. Temperatur). <b>Ohne Ausgleich:</b> x steigt weiter (z. B. Füllstand). Die <b>Ordnungszahl n</b> ist die Zahl der Energiespeicher: je größer n, desto träger. Die <b>Totzeit Tt</b> ist die Zeit, in der die Regelgröße noch nicht reagiert (z. B. Transportzeit Tt = Länge / Geschwindigkeit).</p><p><b>Regelbarkeit:</b> Verhältnis Tu / Tg (Verzugszeit durch Ausgleichszeit): unter 0,1 gut, 0,1 bis 0,3 mäßig, über 0,3 schlecht regelbar.</p>`) +
      sec('Regler', `<table><tr><th>Regler</th><th>Gleichung</th><th>Merkmal</th></tr><tr><td>P</td><td>y = Kp · e</td><td>schnell, bleibende Abweichung</td></tr><tr><td>I</td><td>y = 1/Ti · ∫ e dt</td><td>keine bleibende Abweichung, träge, Schwingneigung</td></tr><tr><td>PI</td><td>y = Kp · (e + 1/Tn · ∫ e dt)</td><td>schnell und genau</td></tr><tr><td>PID</td><td>y = Kp · (e + 1/Tn · ∫ e dt + Tv · de/dt)</td><td>D-Anteil bremst früh</td></tr></table><span class="eq">Proportionalbereich Xp = 100 % / Kp</span><span class="eq">P-Regler: bleibende Abweichung e = w / (1 + Kp · Ks)</span><p>Mit Störgröße am Streckeneingang: x = Ks · (Kp · w + z) / (1 + Ks · Kp). Der I-Anteil gleicht die Abweichung ganz aus.</p>`) +
      sec('Stabilität und Schwingen', `<p>Ein Regelkreis ist <b>stabil</b>, wenn Schwingungen abklingen, <b>grenzstabil</b> bei Dauerschwingung mit gleicher Amplitude und <b>instabil</b>, wenn sie sich aufschaukeln. Zu hohe Verstärkung, zu starker I-Anteil und Totzeit machen den Kreis schwingfreudig. <b>Überschwingweite</b> ü = (x_max − x_end) / x_end · 100 %. <b>Ausregelzeit:</b> Zeit, ab der x im Toleranzband (hier ±2 %) bleibt.</p><table><tr><th>Regler</th><th>Kp</th><th>Tn</th><th>Tv</th></tr><tr><td>P</td><td>0,5 · Kkrit</td><td>–</td><td>–</td></tr><tr><td>PI</td><td>0,45 · Kkrit</td><td>0,85 · Tkrit</td><td>–</td></tr><tr><td>PID</td><td>0,6 · Kkrit</td><td>0,5 · Tkrit</td><td>0,12 · Tkrit</td></tr></table><p class="hint2">Einstellregeln nach Ziegler und Nichols (Dauerschwingversuch). Kkrit ist die Verstärkung, bei der der Kreis mit reinem P-Regler dauernd schwingt, Tkrit die zugehörige Periodendauer.</p>`) +
      sec('Zweipunktregler', `<p>Die Stellgröße kennt nur <b>EIN</b> und <b>AUS</b>. Der Regler schaltet an den Schaltpunkten (um die <b>Schaltdifferenz</b> getrennt) um: unten ein, oben aus. Die Regelgröße pendelt dauernd um den Sollwert. Wirkt die Heizung verspätet (Totzeit, Verzugszeit), läuft die Temperatur nach dem Schalten noch ein Stück weiter, die Schwankung wird größer als die Schaltdifferenz.</p><span class="eq">obere Schwelle = w + h/2, untere Schwelle = w − h/2</span>`) +
      `<p class="hint2">Zahlen und Begriffe sind Lehrbuch- und Übungswerte; Unsicheres ist im Quelltext mit PRUEFEN markiert.</p>`;
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'sim'; S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    ({ sim: renderSim, reg: renderReg, tasks: renderTasks, rt: renderTrainer, bsp: renderBsp, help: renderHelp })[t]();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'Regelkreis-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = 'Regelkreis-Lab: ' + T[2];
  }
  function setExam(on) { lsSet('exam', on ? '1' : '0'); palSig = ''; updatePal(); toast(on ? '🎓 Prüfmodus an: Tipps kosten 25 % je Stufe.' : 'Prüfmodus aus: Tipps kosten nichts.'); if (S.tab === 'tasks') renderTasks(false); }
  let palSig = '';
  function updatePal() {
    const F = !!fx(), fxOn = F && !fx().isMuted(), n = Object.keys(done()).filter(k => TASKS.some(t => t.id === k)).length, sig = [F, fxOn, exam(), n, S.rt.streak, S.rt.best].join('|'); if (sig === palSig) return; palSig = sig;
    $('#pal').innerHTML = `${F ? `<button class="chip ${fxOn ? 'on' : ''}" data-a="fx" aria-pressed="${fxOn}" title="Effekte und Ton">${fxOn ? '🎉' : '🔇'} Effekte</button>` : ''}<button class="chip ${exam() ? 'on' : ''}" data-a="exam" aria-pressed="${exam()}" title="Prüfmodus: Tipps zählen als Abzug">🎓 Prüfmodus</button><button class="chip" data-a="rand" title="Zufällige Frage im Trainer">🎲 Zufallsaufgabe</button>
      <span id="stat">Aufgaben gelöst <b>${n}/${TASKS.length}</b> · Serie <b>${S.rt.streak}</b> · Beste Serie <b>${S.rt.best}</b></span>`;
    $('#bExam').classList.toggle('on', exam()); $('#bExam').setAttribute('aria-pressed', exam());
  }
  $('#pal').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.a === 'fx') { const F = fx(); if (F) { F.setMuted(!F.isMuted()); palSig = ''; updatePal(); if (!F.isMuted()) ding(); } }
    else if (b.dataset.a === 'exam') setExam(!exam());
    else if (b.dataset.a === 'rand') { setTab('rt'); newTrainer(); }
  });
  $('#bTasks').onclick = () => setTab('tasks'); $('#bHelp').onclick = () => setTab('help'); $('#bExam').onclick = () => setExam(!exam());
  $('#title').onclick = () => setTab('sim');
  $('#bMenu').onclick = () => {
    const rows = [['sim', 'Regelkreis-Simulation', 'Sprungantwort, Regler und Strecke einstellen'], ['reg', 'Reglerkennlinien', 'P, I, PI und PID im Vergleich'], ['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung und Tipps'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Aufgaben mit Serien-Zähler'], ['bsp', 'Beispiele', 'Fertig durchgerechnete Beispiele zum Laden'], ['help', 'Hilfe und Formeln', 'Begriffe, Regler, Stabilität'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben und Trainer-Serie auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
    sheet('Menü', (b, close) => {
      b.innerHTML = rows.map(r => `<button class="row" data-m="${r[0]}"><div class="grow"><b>${esc(r[1])}</b><small>${esc(r[2])}</small></div></button>`).join('');
      b.addEventListener('click', e => { const r = e.target.closest('.row'); if (!r) return; close(); const m = r.dataset.m; if (m === 'home') location.href = 'index.html'; else if (m === 'exam') setExam(!exam()); else if (m === 'reset') resetAll(); else setTab(m); });
    });
  };
  function resetAll() {
    sheet('Fortschritt zurücksetzen?', (b, close) => {
      b.innerHTML = '<p style="margin-top:0">Alle gelösten Aufgaben, Tipps und die Trainer-Serie dieses Labs werden auf diesem Gerät gelöscht. Das kann nicht rückgängig gemacht werden.</p><div class="btns"><button class="btn" data-x="no">Abbrechen</button><button class="btn danger" data-x="yes">Löschen</button></div>';
      b.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (!x) return; if (x.dataset.x === 'yes') { ['done', 'prog', 'hints', 'ctipps', 'rt'].forEach(k => { try { localStorage.removeItem(LS + k); } catch (er) {} }); S.rt = { n: 0, ok: 0, streak: 0, best: 0 }; S.task = null; S.tRes = null; palSig = ''; updatePal(); updateBadge(); if (S.tab === 'tasks') renderTasks(); toast('Fortschritt gelöscht'); } close(); });
    });
  }

  /* Schnittstelle für Karriere/Lernpfad */
  root.RKR_LAB = { id: 'rkr', title: 'Regelkreis-Lab', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.RKR_TASKS };

  buildTabs(); updatePal(); setTab(TABS.some(x => x[0] === S.tab) ? S.tab : 'sim');
  /* Aufruf ?aufgabe=rkr1 (Startseite, Lernhefte) öffnet die Aufgabe, ?bsp die Beispiele (?bsp=p1 springt zu einem Beispiel) */
  try {
    const qp = new URLSearchParams(location.search), qa = qp.get('aufgabe');
    if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); }
    else if (qp.has('bsp')) { setTab('bsp'); const el = $('#ex_' + (qp.get('bsp') || '').replace(/[^a-z0-9_]/gi, '')); if (el) el.scrollIntoView(); }
  } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
