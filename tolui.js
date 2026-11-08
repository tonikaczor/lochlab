'use strict';
/* Tonfunk Toleranz-Lab: Oberfläche (Lab-Kennung 'tol').
   Reiter: Messschieber, Bügelmessschraube, Toleranz-Rechner, Passungen, Aufgaben, Trainer, Hilfe.
   Module: tolcore.js (TOL_CORE, Logik), toldata.js (TOL_ISO, TOL_DATA, TOL_TASKS).
   Speicher (Präfix lm4.tol.): tab, cal, mic, calc, fit, pick, done ({id:true} nur gelöste), prog ({id:Prozent}), hints ({id:höchste Stufe}),
   ctipps ({id:Stufe} nur im Prüfmodus), exam ('1' = Prüfmodus), rt (Trainer: n, ok, streak, best).
   Tipp-Abzug (25 % je Stufe) gibt es nur im Prüfmodus; beim normalen Üben kosten Tipps nichts. */
(function (root) {
  const C = root.TOL_CORE, D = root.TOL_DATA;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.tol.';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(LS + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} };
  const f2 = v => C.fmtDe(v, 2);
  const decs = v => { const p = String(Math.round(v * 1e6) / 1e6).split('.'); return p[1] ? p[1].length : 0; };
  const fAny = v => C.fmtDe(v, Math.max(2, decs(v)));
  const sg = v => (v > 0 ? '+' : v < 0 ? '−' : '') + String(Math.abs(v)).replace('.', ',');   /* µm mit Vorzeichen */
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

  if (!C || !D || !root.TOL_ISO) {
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>Toleranz-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">tolcore.js oder toldata.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks, ISO = root.TOL_ISO;

  /* ============================================================ Zustand */
  const TABS = [['cal', '📏', 'Messschieber'], ['mic', '🔩', 'Bügelmessschraube'], ['calc', '🧮', 'Toleranz-Rechner'], ['fit', '🎯', 'Passungen'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['help', '📘', 'Hilfe']];
  const S = {
    tab: lsGet('tab', 'cal'),
    cal: Object.assign({ den: 20, mode: 'erkl', v: 23.35, zoom: 1, guide: false, shown: false, res: null, ans: '' }, lsGet('cal', {})),
    mic: Object.assign({ base: 0, mode: 'erkl', v: 7.38, shown: false, res: null, ans: '' }, lsGet('mic', {})),
    calc: Object.assign({ part: 'welle', N: '30', hi: '-0,010', lo: '-0,030', unit: 'mm', m: '29,992' }, lsGet('calc', {})),
    fit: Object.assign({ hole: 'H7', shaft: 'f7', N: '25' }, lsGet('fit', {})),
    pick: { i: 0, sel: -1, res: null }, pickStat: Object.assign({ n: 0, ok: 0 }, lsGet('pick', {})),
    task: null, tAns: {}, tRes: null, tz: 1,
    tr: { kind: 'mixed', level: 2, inst: null, res: null, ans: '', zoom: 1, shown: false },
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {}))
  };
  S.cal.mode = ['erkl', 'selbst', 'zufall'].includes(S.cal.mode) ? S.cal.mode : 'erkl';
  S.mic.mode = ['erkl', 'selbst', 'zufall'].includes(S.mic.mode) ? S.mic.mode : 'erkl';
  if (![10, 20, 50].includes(S.cal.den)) S.cal.den = 20;
  if (![1, 2, 3].includes(S.cal.zoom)) S.cal.zoom = 1;
  if (!C.MICRO_BASES.includes(S.mic.base)) S.mic.base = 0;
  /* gespeicherte Werte prüfen, damit ein kaputter Speicher nichts zerstört */
  if (!C.readCaliper(S.cal.v, S.cal.den)) S.cal.v = 23.35;
  if (!C.readMicrometer(S.mic.v, S.mic.base)) S.mic.v = S.mic.base + 7.38;
  const R0 = (() => { const m = /[?&]seed=([^&]+)/.exec(location.search); return C.rng(m ? decodeURIComponent(m[1]) : String(Math.random()) + Date.now()); })();

  /* ============================================================ SVG: Messschieber */
  const PM = { 10: 30, 20: 18, 50: 16 };   /* größte Pixel je mm bei Lupe ×1; auf schmalen Bildschirmen kleiner, damit der ganze Nonius passt */
  const availW = () => Math.max(260, Math.min(document.documentElement.clientWidth - 52, 1052));
  function svgCaliper(den, v, o) {
    o = o || {}; const N = C.NONIUS[den], z = o.zoom || 1, LM = 5, pad = 14, pm = Math.min(PM[den], (availW() - 2 * pad) / (LM + N.span + 3)) * z, sp = N.span / N.n * pm;
    const zx = pad + LM * pm, W = Math.ceil(zx + (N.span + 3) * pm + pad), H = 176, x0 = zx - v * pm, rd = o.hi ? C.readCaliper(v, den) : null;
    const bx = Math.max(0, x0); let s = '';
    s += `<rect x="${bx}" y="12" width="${Math.max(0, W - bx)}" height="68" class="sv-steel"/>`;
    if (v > 0) s += `<rect x="${bx}" y="114" width="${Math.max(0, zx - bx)}" height="42" class="sv-work"/>`;
    if (x0 > -18) s += `<rect x="${x0 - 16}" y="12" width="16" height="144" rx="2" class="sv-steel2"/>`;
    s += `<rect x="${zx}" y="80" width="${N.span * pm + 30}" height="50" class="sv-slider"/><rect x="${zx}" y="130" width="24" height="26" class="sv-slider"/>`;
    s += `<line x1="${bx}" y1="80" x2="${W}" y2="80" class="sv-edge"/>`;
    const m0 = Math.max(0, Math.ceil(v - LM - 0.001)), m1 = Math.min(C.CALIPER_MAX, Math.floor(v - LM + W / pm));
    for (let m = m0; m <= m1; m++) {
      const x = zx + (m - v) * pm, len = m % 10 === 0 ? 24 : m % 5 === 0 ? 16 : 10;
      s += `<line x1="${x}" y1="80" x2="${x}" y2="${80 - len}" class="sv-tick"/>`;
      if (m % 10 === 0) s += `<text x="${x}" y="${80 - len - 4}" class="sv-txt">${m / 10}</text>`;
    }
    if (o.guide) for (let i = 0; i <= N.n; i++) { const x = zx + i * sp; s += `<line x1="${x}" y1="12" x2="${x}" y2="80" class="sv-guide"/>`; }
    for (let i = 0; i <= N.n; i++) {
      const x = zx + i * sp, lab = den === 10 ? true : den === 20 ? i % 2 === 0 : i % 5 === 0, len = lab ? 22 : (den === 50 ? 11 : 13);
      s += `<line x1="${x}" y1="80" x2="${x}" y2="${80 + len}" class="sv-tick"/>`;
      if (lab) s += `<text x="${x}" y="${80 + len + 12}" class="sv-txt2">${den === 10 ? i : den === 20 ? i / 2 : i / 5}</text>`;
    }
    if (rd) {
      const hx = zx + rd.mark * sp, mx = zx - (v - rd.main) * pm;
      s += `<line x1="${mx}" y1="52" x2="${mx}" y2="80" class="sv-hi2"/><text x="${mx}" y="46" class="sv-txt" style="fill:#1c7ed6;font-weight:700">${rd.main} mm</text>`;
      s += `<line x1="${hx}" y1="8" x2="${hx}" y2="116" class="sv-hi"/><text x="${hx}" y="${126}" class="sv-txt" style="fill:#e8590c;font-weight:700">Strich ${rd.mark}</text>`;
    }
    s += `<text x="${zx + 34}" y="${H - 8}" class="sv-note" style="font-size:11px;fill:var(--mute)">Nonius ${N.name}</text>`;
    if (o.drag) s += `<rect x="${zx}" y="80" width="${N.span * pm + 30}" height="76" class="sv-drag" data-drag="cal"/>`;
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" data-pm="${pm}" role="img" aria-label="Messschieber mit Nonius ${N.name}">${s}</svg>`;
  }
  function svgCaliperOverview(v) {
    const w = 400, k = 380 / C.CALIPER_MAX, xa = 10, xb = 10 + v * k; let s = '';
    s += `<rect x="${xa}" y="10" width="380" height="12" rx="3" class="sv-steel"/><rect x="${xa - 6}" y="6" width="6" height="30" class="sv-steel2"/><rect x="${xb}" y="12" width="30" height="24" rx="3" class="sv-slider"/>`;
    s += `<rect x="${xa}" y="26" width="${Math.max(0, xb - xa)}" height="10" class="sv-work"/>`;
    for (let m = 0; m <= 150; m += 10) s += `<line x1="${xa + m * k}" y1="10" x2="${xa + m * k}" y2="${m % 50 === 0 ? 4 : 7}" class="sv-tick"/>`;
    s += `<text x="${xa}" y="50" class="sv-note" style="font-size:10px" fill="currentColor">0</text><text x="${xa + 380}" y="50" class="sv-note" style="font-size:10px;text-anchor:end">150 mm</text>`;
    return `<svg width="100%" viewBox="0 0 ${w} 54" style="max-width:520px;display:block;margin:0 auto" role="img" aria-label="Überblick: Öffnung des Messschiebers von 0 bis 150 mm">${s}</svg>`;
  }

  /* ============================================================ SVG: Bügelmessschraube */
  function svgMicro(base, v, o) {
    o = o || {}; const rd = C.readMicrometer(v, base), r = rd.value - base, pm = 11, x0 = 26, by = 104, X = x0 + r * pm, t = rd.thimble, pitch = 9, W = 440, H = 210; let s = '';
    s += `<rect x="0" y="${by - 8}" width="${x0 + 4}" height="16" rx="2" class="sv-steel2"/>`;
    s += `<rect x="${x0 - 8}" y="78" width="${25 * pm + 18}" height="52" rx="3" class="sv-steel"/>`;
    s += `<line x1="${x0 - 8}" y1="${by}" x2="${x0 + 25 * pm + 10}" y2="${by}" class="sv-edge"/>`;
    for (let j = 0; j <= 25; j++) {
      const x = x0 + j * pm, len = j % 5 === 0 ? 17 : 11;
      s += `<line x1="${x}" y1="${by}" x2="${x}" y2="${by - len}" class="sv-tick"/>`;
      if (j % 5 === 0) s += `<text x="${x}" y="${by - len - 3}" class="sv-txt2">${j}</text>`;
      if (j < 25) s += `<line x1="${x + pm / 2}" y1="${by}" x2="${x + pm / 2}" y2="${by + 9}" class="sv-tick"/>`;
    }
    if (o.hi) {
      const rel = rd.sleeve + rd.half, hx = x0 + rel * pm;
      s += rd.half ? `<line x1="${hx}" y1="${by}" x2="${hx}" y2="${by + 18}" class="sv-hi2"/>` : `<line x1="${hx}" y1="${by}" x2="${hx}" y2="${by - 26}" class="sv-hi2"/>`;
    }
    s += `<rect x="${X}" y="34" width="92" height="140" rx="10" class="sv-drum"/><rect x="${X}" y="34" width="9" height="140" class="sv-bevel"/>`;
    s += `<rect x="${X + 92}" y="64" width="34" height="80" rx="8" class="sv-steel2"/>`;
    for (let d = -7; d <= 7; d++) {
      const idx = (t + d + 50) % 50, y = by + d * pitch, big = idx % 5 === 0;
      s += `<line x1="${X + 9}" y1="${y}" x2="${X + 9 + (big ? 24 : 14)}" y2="${y}" class="sv-tick"/>`;
      if (big) s += `<text x="${X + 48}" y="${y + 4}" class="sv-txt">${idx}</text>`;
    }
    s += `<line x1="${X - 14}" y1="${by}" x2="${X + 9}" y2="${by}" class="sv-edge"/>`;
    if (o.hi) s += `<line x1="${X + 9}" y1="${by}" x2="${X + 60}" y2="${by}" class="sv-hi"/><polygon points="${X - 4},${by - 6} ${X + 6},${by} ${X - 4},${by + 6}" fill="#e8590c"/>`;
    if (o.drag) s += `<rect x="${X}" y="34" width="126" height="140" class="sv-drag" data-drag="mic"/>`;
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Bügelmessschraube, Messbereich ${base} bis ${base + 25} Millimeter">${s}</svg>`;
  }
  const svgInst = (inst, o) => inst.t === 'caliper' ? svgCaliper(inst.den, inst.v, o) : svgMicro(inst.base, inst.v, o);
  const instWrap = (inst, o) => `<div class="inst${inst.t === 'micro' ? ' fit' : ''}" data-w>${svgInst(inst, o)}</div>${inst.t === 'caliper' ? svgCaliperOverview(inst.v) : ''}`;

  /* ============================================================ SVG: Passung und Toleranzstreifen */
  function nudge(ys, gap) { const o = ys.map((y, i) => [y, i]).sort((a, b) => a[0] - b[0]), r = []; let prev = -1e9; o.forEach(p => { const y = Math.max(p[0], prev + gap); r[p[1]] = y; prev = y; }); return r; }
  function svgFit(f) {
    const vals = [f.hole.ES, f.hole.EI, f.shaft.es, f.shaft.ei, 0]; let hi = Math.max.apply(null, vals), lo = Math.min.apply(null, vals);
    const pad = Math.max(8, (hi - lo) * 0.2); hi += pad; lo -= pad;
    const top = 40, bot = 250, y = v => top + (hi - v) * (bot - top) / (hi - lo);
    const bl = nudge([y(f.hole.ES) + 4, y(f.hole.EI) + 4], 14), sl = nudge([y(f.shaft.es) + 4, y(f.shaft.ei) + 4], 14);
    let s = `<line x1="14" y1="${y(0)}" x2="346" y2="${y(0)}" class="sv-zero"/>`;
    [f.hole.ES, f.hole.EI, f.shaft.es, f.shaft.ei].forEach(v => { s += `<line x1="70" y1="${y(v)}" x2="290" y2="${y(v)}" class="sv-grid"/>`; });
    const hh = Math.max(2, y(f.hole.EI) - y(f.hole.ES)), sh = Math.max(2, y(f.shaft.ei) - y(f.shaft.es));
    s += `<rect x="86" y="${y(f.hole.ES)}" width="70" height="${hh}" class="sv-bore"/><rect x="204" y="${y(f.shaft.es)}" width="70" height="${sh}" class="sv-shaft"/>`;
    s += `<text x="121" y="22" class="sv-lab" text-anchor="middle" style="font-weight:700">Bohrung ${f.hole.code}</text><text x="239" y="22" class="sv-lab" text-anchor="middle" style="font-weight:700">Welle ${f.shaft.code}</text>`;
    s += `<text x="80" y="${bl[0]}" class="sv-lab" text-anchor="end">ES ${sg(f.hole.ES)}</text><text x="80" y="${bl[1]}" class="sv-lab" text-anchor="end">EI ${sg(f.hole.EI)}</text>`;
    s += `<text x="282" y="${sl[0]}" class="sv-lab">es ${sg(f.shaft.es)}</text><text x="282" y="${sl[1]}" class="sv-lab">ei ${sg(f.shaft.ei)}</text>`;
    s += `<text x="14" y="${bot + 24}" class="sv-lab m" style="font-size:11px">Gestrichelt: Nulllinie = Nennmaß ${C.fmtDe(f.N, f.N % 1 ? 1 : 0)} mm · Maße in µm</text>`;
    return `<svg viewBox="0 0 360 ${bot + 30}" style="width:100%;max-width:440px;height:auto;display:block;margin:0 auto" role="img" aria-label="Toleranzfeld-Diagramm ${esc(f.code)}">${s}</svg>`;
  }
  function svgStrip(d, m, part) {
    const T = Math.max(d.T, 0.002); let lo = d.Gu - 0.8 * T, hi = d.Go + 0.8 * T; if (m != null && isFinite(m)) { lo = Math.min(lo, m - 0.15 * T); hi = Math.max(hi, m + 0.15 * T); }
    const x = v => 20 + (v - lo) / (hi - lo) * 320, welle = part !== 'bohrung', xa = x(d.Gu), xb = x(d.Go);
    let s = `<rect x="20" y="22" width="${xa - 20}" height="26" class="${welle ? 'sv-bad' : 'sv-redo'}"/><rect x="${xa}" y="22" width="${Math.max(xb - xa, 2)}" height="26" class="sv-good"/><rect x="${Math.max(xb, xa + 2)}" y="22" width="${340 - Math.max(xb, xa + 2)}" height="26" class="${welle ? 'sv-redo' : 'sv-bad'}"/>`;
    s += `<text x="${xa}" y="66" class="sv-lab" text-anchor="${xb - xa < 70 ? 'end' : 'middle'}" style="font-size:11px">Mindestmaß ${C.fmtDe(d.Gu, 3)}</text><text x="${xb}" y="${xb - xa < 70 ? 66 : 66}" class="sv-lab" text-anchor="${xb - xa < 70 ? 'start' : 'middle'}" style="font-size:11px">Höchstmaß ${C.fmtDe(d.Go, 3)}</text>`;
    s += `<text x="26" y="14" class="sv-lab m" style="font-size:10.5px">${welle ? 'Ausschuss' : 'Nacharbeit'}</text><text x="334" y="14" class="sv-lab m" text-anchor="end" style="font-size:10.5px">${welle ? 'Nacharbeit' : 'Ausschuss'}</text><text x="${(xa + xb) / 2}" y="14" class="sv-lab m" text-anchor="middle" style="font-size:10.5px">Gut</text>`;
    if (m != null && isFinite(m)) { const mx = x(m); s += `<polygon points="${mx - 6},20 ${mx + 6},20 ${mx},34" fill="var(--hi)"/><line x1="${mx}" y1="34" x2="${mx}" y2="48" stroke="var(--hi)" stroke-width="2"/><text x="${mx}" y="84" class="sv-lab" text-anchor="middle" style="fill:var(--hi);font-weight:700">gemessen ${C.fmtDe(m, 3)}</text>`; }
    return `<svg viewBox="0 0 360 92" style="width:100%;max-width:520px;height:auto;display:block;margin:8px auto 0" role="img" aria-label="Toleranzbereich mit Messwert">${s}</svg>`;
  }

  /* ============================================================ Messgeräte-Reiter (Messschieber und Bügelmessschraube) */
    const instOf = key => key === 'cal' ? { t: 'caliper', den: S.cal.den, v: S.cal.v } : { t: 'micro', base: S.mic.base, v: S.mic.v };
  const maxK = key => key === 'cal' ? C.CALIPER_MAX * S.cal.den : 2500;
  const curK = key => key === 'cal' ? C.caliperUnits(S.cal.v, S.cal.den) : Math.round((S.mic.v - S.mic.base) * 100);
  function setK(key, k) {
    k = Math.max(0, Math.min(maxK(key), Math.round(k)));
    if (key === 'cal') S.cal.v = C.readCaliper(k / S.cal.den, S.cal.den).value; else S.mic.v = C.readMicrometer(S.mic.base + k / 100, S.mic.base).value;
    const s = S[key]; s.shown = false; s.res = null; saveInst(key);
    const sl = $('#' + key + 'Sl'); if (sl) sl.value = k;
    updateInst(key);
  }
  const saveInst = key => { const s = S[key]; lsSet(key, key === 'cal' ? { den: s.den, mode: s.mode, v: s.v, zoom: s.zoom, guide: s.guide } : { base: s.base, mode: s.mode, v: s.v }); };
  function randomValue(key) {
    const R = C.rng(String(R0()) + Math.random());
    if (key === 'cal') { const den = S.cal.den; let k = 1 + Math.floor(R() * (100 * den - 1)); if (R() < 0.3) k = Math.floor(R() * 99 + 1) * den + (R() < 0.5 ? den - 1 : 0); return k; }
    let rk = 1 + Math.floor(R() * 2498); if (R() < 0.3) { const mm = Math.floor(R() * 25), p = R(); rk = Math.min(2499, mm * 100 + (p < 0.34 ? 50 : p < 0.67 ? 49 : 99)); } return rk;
  }
  function newRandom(key) { const s = S[key], k = randomValue(key); s.shown = false; s.res = null; s.ans = ''; if (key === 'cal') s.v = k / s.den; else s.v = S.mic.base + k / 100; s.v = key === 'cal' ? C.readCaliper(s.v, s.den).value : C.readMicrometer(s.v, s.base).value; saveInst(key); }
  const segHTML = (data, items, cur) => `<div class="seg" role="group">${items.map(([k, l]) => `<button data-${data}="${k}" class="${String(cur) === String(k) ? 'on' : ''}" aria-pressed="${String(cur) === String(k)}">${l}</button>`).join('')}</div>`;
  function renderInst(key) {
    const s = S[key], cal = key === 'cal', V = $('#' + key + 'View'), mode = s.mode, r = C.reading(instOf(key));
    let h = `<div class="card pl"><h4>${cal ? 'Messschieber (Nonius)' : 'Bügelmessschraube (0,01 mm)'}</h4>`;
    h += `<div class="fbar">${cal ? segHTML('den', [[10, '1/10'], [20, '1/20'], [50, '1/50']], s.den) : segHTML('base', C.MICRO_BASES.map(b => [b, b + '–' + (b + 25)]), s.base)}${segHTML('mode', [['erkl', 'Erklärt'], ['selbst', 'Selbst einstellen'], ['zufall', 'Zufallswert']], mode)}</div>`;
    h += `<div id="${key}Svg"></div>`;
    if (cal) h += `<div class="ctl"><span class="lbl" style="align-self:center;font-size:12px;color:var(--mute)">Lupe</span>${[1, 2, 3].map(z => `<button class="chip s${s.zoom === z ? ' on' : ''}" data-zoom="${z}">×${String(z).replace('.', ',')}</button>`).join('')}<button class="chip s${s.guide ? ' on' : ''}" data-guide="1" aria-pressed="${!!s.guide}">Hilfslinien</button></div>`;
    if (mode !== 'zufall') {
      h += `<input type="range" id="${key}Sl" min="0" max="${maxK(key)}" step="1" value="${curK(key)}" aria-label="Messwert einstellen">`;
      h += cal
        ? `<div class="ctl">${[[-10 * s.den, '◀ 10 mm'], [-s.den, '◀ 1 mm'], [-1, '◂ Teilstrich'], [1, 'Teilstrich ▸'], [s.den, '1 mm ▶'], [10 * s.den, '10 mm ▶']].map(b => `<button class="chip" data-step="${b[0]}">${b[1]}</button>`).join('')}</div>`
        : `<div class="ctl">${[[-100, '◀ 1 mm'], [-50, '◀ 0,5'], [-1, '◂ 0,01'], [1, '0,01 ▸'], [50, '0,5 ▶'], [100, '1 mm ▶']].map(b => `<button class="chip" data-step="${b[0]}">${b[1]}</button>`).join('')}</div>`;
      h += `<p class="hint2">${cal ? 'Schiebe den Messschieber mit dem Regler, den Tasten oder direkt an der Skala (ziehen). Mit Lupe (×2, ×3) und Hilfslinien erkennst du den deckenden Strich besser; die Skala lässt sich seitlich wischen.' : 'Stelle die Trommel mit dem Regler, den Tasten oder durch Ziehen an der Trommel ein.'}</p>`;
    }
    h += `<div id="${key}Read"></div>`;
    if (mode !== 'erkl') {
      h += `<div id="${key}Ans" style="margin-top:8px"><label class="f"><span>Dein Messwert in mm</span><input id="${key}In" inputmode="decimal" autocomplete="off" placeholder="z. B. ${cal ? '23,35' : '7,38'}" value="${esc(s.ans)}"></label>
        <div class="btns" style="margin-top:0"><button class="btn pri" data-a="chk">✓ Prüfen</button><button class="btn" data-a="show">Lösung zeigen</button>${mode === 'zufall' ? '<button class="btn" data-a="new">Neuer Wert</button>' : ''}</div><div id="${key}Fb" class="fb"></div></div>`;
    }
    h += '</div>';
    V.innerHTML = h; updateInst(key);
  }
  function updateInst(key) {
    const s = S[key], cal = key === 'cal', inst = instOf(key), mode = s.mode, hi = mode === 'erkl' || s.shown, hostSvg = $('#' + key + 'Svg'); if (!hostSvg) return;
    const sc = hostSvg.querySelector('.inst'), keep = sc ? sc.scrollLeft : 0;
    hostSvg.innerHTML = instWrap(inst, { zoom: cal ? s.zoom : 1, guide: cal && s.guide, hi, drag: mode !== 'zufall' });
    const sc2 = hostSvg.querySelector('.inst'); if (sc2 && keep) sc2.scrollLeft = keep;
    const rd = $('#' + key + 'Read'); if (rd) rd.innerHTML = hi ? `<div class="rdout"><b>Ablesung:</b> ${esc(C.describe(inst))}</div>` : '';
  }
  function checkInst(key) {
    const s = S[key], inst = instOf(key), inp = $('#' + key + 'In'); s.ans = inp ? inp.value : s.ans;
    const res = C.checkReading(inst, s.ans), fb = $('#' + key + 'Fb'); s.res = res;
    if (res.empty) { fb.className = 'fb bad'; fb.innerHTML = '<span class="v">Bitte gib eine Zahl ein.</span> Du kannst auch mit Komma schreiben, zum Beispiel 23,35.'; return; }
    s.shown = true; updateInst(key);
    const un = key === 'cal' ? C.NONIUS[S.cal.den].rtext : '0,01 mm';
    fb.className = 'fb ' + (res.ok ? 'ok' : 'bad');
    fb.innerHTML = res.ok
      ? `<span class="v">✓ Richtig!</span> ${res.exact ? 'Genau getroffen.' : 'Innerhalb von ±1 Teilstrich (' + un + ').'} Richtig sind ${fAny(res.truth)} mm.`
      : `<span class="v">✗ Nicht ganz.</span> Du hast ${fAny(C.parseDe(s.ans))} mm, richtig sind ${fAny(res.truth)} mm (Abweichung ${C.fmtDe(Math.abs(res.diff), 2)} mm, erlaubt sind ±${un}). Die Erklärung steht oben.`;
    if (res.ok) ding(); else sad();
  }
  function bindInst(key) {
    const V = $('#' + key + 'View'), s = S[key];
    V.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.den) { s.den = +b.dataset.den; const k = curK('cal'); s.v = C.readCaliper(s.v, s.den).value; s.shown = false; s.res = null; if (s.mode === 'zufall') newRandom('cal'); saveInst(key); renderInst(key); }
      else if (b.dataset.base) { s.base = +b.dataset.base; s.v = C.readMicrometer(s.base + Math.min(25, Math.max(0, s.v % 25)), s.base).value; s.shown = false; s.res = null; if (s.mode === 'zufall') newRandom('mic'); saveInst(key); renderInst(key); }
      else if (b.dataset.mode) { s.mode = b.dataset.mode; s.shown = false; s.res = null; s.ans = ''; if (s.mode === 'zufall') newRandom(key); saveInst(key); renderInst(key); }
      else if (b.dataset.zoom) { s.zoom = +b.dataset.zoom; saveInst(key); $$('[data-zoom]', V).forEach(x => x.classList.toggle('on', +x.dataset.zoom === s.zoom)); updateInst(key); }
      else if (b.dataset.guide) { s.guide = !s.guide; saveInst(key); b.classList.toggle('on', s.guide); b.setAttribute('aria-pressed', s.guide); updateInst(key); }
      else if (b.dataset.step) setK(key, curK(key) + (+b.dataset.step));
      else if (b.dataset.a === 'chk') checkInst(key);
      else if (b.dataset.a === 'show') { s.shown = true; updateInst(key); const fb = $('#' + key + 'Fb'); if (fb) { fb.className = 'fb'; fb.innerHTML = `Lösung: <b>${fAny(C.truth(instOf(key)))} mm</b>`; } }
      else if (b.dataset.a === 'new') { newRandom(key); renderInst(key); }
    });
    V.addEventListener('input', e => {
      if (e.target.id === key + 'Sl') setK(key, +e.target.value);
      else if (e.target.id === key + 'In') s.ans = e.target.value;
    });
    V.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === key + 'In') { e.preventDefault(); checkInst(key); } });
    /* Ziehen am Schieber bzw. an der Trommel */
    let drag = null;
    V.addEventListener('pointerdown', e => {
      const d = e.target.closest('[data-drag]'); if (!d || s.mode === 'zufall') return;
      const svg = d.ownerSVGElement, vb = svg.viewBox.baseVal, scale = svg.getBoundingClientRect().width / vb.width || 1;
      drag = { x: e.clientX, y: e.clientY, k: curK(key), scale, pm: +svg.dataset.pm || 18, id: e.pointerId }; try { V.setPointerCapture(e.pointerId); } catch (x) {} e.preventDefault();
    });
    V.addEventListener('pointermove', e => {
      if (!drag) return; const dx = (e.clientX - drag.x) / drag.scale, dy = (e.clientY - drag.y) / drag.scale;
      if (key === 'cal') setK(key, drag.k + dx / drag.pm * s.den);
      else setK(key, drag.k + dx / 11 * 100 - dy / 9);
    });
    const end = () => { drag = null; };
    V.addEventListener('pointerup', end); V.addEventListener('pointercancel', end);
  }
  bindInst('cal'); bindInst('mic');

  /* ============================================================ Toleranz-Rechner */
  function renderCalc() {
    const c = S.calc;
    $('#calcView').innerHTML = `<div class="card pl"><h4>Toleranz-Rechner: Höchstmaß, Mindestmaß, Toleranz</h4>
      <div class="fbar">${segHTML('cpart', [['welle', 'Welle'], ['bohrung', 'Bohrung']], c.part)}${segHTML('cunit', [['mm', 'Abmaße in mm'], ['um', 'Abmaße in µm']], c.unit)}</div>
      <div class="dsrow"><label class="f"><span>Nennmaß in mm</span><input id="cN" inputmode="decimal" autocomplete="off" value="${esc(c.N)}"></label>
      <label class="f"><span>Oberes Abmaß (${c.part === 'welle' ? 'es' : 'ES'}) in ${c.unit === 'mm' ? 'mm' : 'µm'}</span><input id="cHi" inputmode="decimal" autocomplete="off" value="${esc(c.hi)}"></label>
      <label class="f"><span>Unteres Abmaß (${c.part === 'welle' ? 'ei' : 'EI'}) in ${c.unit === 'mm' ? 'mm' : 'µm'}</span><input id="cLo" inputmode="decimal" autocomplete="off" value="${esc(c.lo)}"></label>
      <label class="f"><span>Gemessenes Maß in mm (optional)</span><input id="cM" inputmode="decimal" autocomplete="off" value="${esc(c.m)}"></label></div>
      <div class="ctl"><span style="align-self:center;font-size:12px;color:var(--mute)">Beispiele</span><button class="chip s" data-cex="1">Welle Ø30 −0,010/−0,030</button><button class="chip s" data-cex="2">Bohrung Ø20 +0,021/0</button><button class="chip s" data-cex="3">Welle Ø25 f7 (µm)</button></div>
      <div id="cRes"></div></div>`;
    updateCalc();
  }
  function updateCalc() {
    const c = S.calc, N = C.parseDe(c.N), hi = C.parseDe(c.hi), lo = C.parseDe(c.lo), m = String(c.m).trim() === '' ? null : C.parseDe(c.m), host = $('#cRes'); if (!host) return;
    lsSet('calc', c);
    const d = C.dimensions(N, hi, lo, c.unit);
    if (!d.ok) { host.innerHTML = `<div class="rdout bad">${esc(d.error)}</div>`; return; }
    const g = c.part === 'welle' ? ['es', 'ei'] : ['ES', 'EI'];
    let h = `<table class="tt"><tr><th>Größe</th><th class="n">mm</th><th class="n">µm</th></tr>
      <tr><td>Höchstmaß G<sub>o</sub> = N + ${g[0]}</td><td class="n"><b>${C.fmtDe(d.Go, 3)}</b></td><td class="n">${C.fmtDe(d.Go * 1000, 0)}</td></tr>
      <tr><td>Mindestmaß G<sub>u</sub> = N + ${g[1]}</td><td class="n"><b>${C.fmtDe(d.Gu, 3)}</b></td><td class="n">${C.fmtDe(d.Gu * 1000, 0)}</td></tr>
      <tr><td>Toleranz T = ${g[0]} − ${g[1]}</td><td class="n"><b>${C.fmtDe(d.T, 3)}</b></td><td class="n">${C.fmtDe(d.T_um, 1).replace(/,0$/, '')}</td></tr>
      <tr><td>Mittenmaß</td><td class="n">${C.fmtDe(d.C, 4).replace(/0$/, '')}</td><td class="n"></td></tr></table>`;
    if (d.T === 0) h += '<p class="hint2">Toleranz 0: Grenzmaße sind gleich. Das ist technisch kaum zu fertigen, prüfe die Abmaße.</p>';
    if (m != null) {
      if (!isFinite(m)) h += '<div class="rdout bad">Das gemessene Maß ist keine gültige Zahl.</div>';
      else {
        const k = C.classify(c.part, m, d), why = k.state === 'gut' ? `Das Maß liegt zwischen Mindestmaß und Höchstmaß (Grenzmaße gehören noch dazu).`
          : k.side === 'ueber' ? `Das Maß liegt ${C.fmtDe(k.dev_um, 1).replace(/,0$/, '')} µm über dem Höchstmaß. ${c.part === 'welle' ? 'Die Welle ist zu dick: Material kann noch abgetragen werden (nachdrehen oder schleifen).' : 'Die Bohrung ist zu groß: Es fehlt Material, das sich nicht ersetzen lässt.'}`
            : `Das Maß liegt ${C.fmtDe(k.dev_um, 1).replace(/,0$/, '')} µm unter dem Mindestmaß. ${c.part === 'welle' ? 'Die Welle ist zu dünn: Es fehlt Material, das sich nicht ersetzen lässt.' : 'Die Bohrung ist zu klein: Material kann noch weggenommen werden (aufbohren, aufreiben).'}`;
        h += `<div class="rdout ${k.state === 'gut' ? 'ok' : k.state === 'ausschuss' ? 'bad' : ''}"><span class="badge ${k.state}">${C.STATE_TEXT[k.state]}</span> ${esc(why)}</div>`;
        h += svgStrip(d, m, c.part);
      }
    } else h += svgStrip(d, null, c.part);
    h += '<p class="hint2">Regel: Zu viel Material (Welle zu dick, Bohrung zu klein) ist meist Nacharbeit. Zu wenig Material (Welle zu dünn, Bohrung zu groß) ist Ausschuss.</p>';
    host.innerHTML = h;
  }
  $('#calcView').addEventListener('input', e => {
    const c = S.calc, id = e.target.id; if (id === 'cN') c.N = e.target.value; else if (id === 'cHi') c.hi = e.target.value; else if (id === 'cLo') c.lo = e.target.value; else if (id === 'cM') c.m = e.target.value; else return; updateCalc();
  });
  $('#calcView').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const c = S.calc;
    if (b.dataset.cpart) { c.part = b.dataset.cpart; renderCalc(); }
    else if (b.dataset.cunit) { if (c.unit !== b.dataset.cunit) { const f = b.dataset.cunit === 'um' ? 1000 : 0.001, cv = x => { const n = C.parseDe(x); return isFinite(n) ? C.fmtDe(Math.round(n * f * 1e6) / 1e6, 4).replace(/,?0+$/, '') || '0' : x; }; c.hi = cv(c.hi); c.lo = cv(c.lo); } c.unit = b.dataset.cunit; renderCalc(); }
    else if (b.dataset.cex) { Object.assign(c, { 1: { part: 'welle', N: '30', hi: '-0,010', lo: '-0,030', unit: 'mm', m: '29,992' }, 2: { part: 'bohrung', N: '20', hi: '0,021', lo: '0', unit: 'mm', m: '19,998' }, 3: { part: 'welle', N: '25', hi: '-20', lo: '-41', unit: 'um', m: '24,97' } }[b.dataset.cex]); renderCalc(); }
  });

  /* ============================================================ Passungs-Lab */
  const fitN = () => C.parseDe(S.fit.N);
  function renderFit() {
    const f0 = S.fit, N = fitN(), F = C.fit(f0.hole, f0.shaft, N);
    let h = `<div class="card pl"><h4>Passung berechnen (Einheitsbohrung)</h4>
      <div class="fbar"><span class="lbl">Bohrung</span>${segHTML('fhole', ISO.holes.map(x => [x, x]), f0.hole)}</div>
      <div class="fbar"><span class="lbl">Welle</span><div class="seg" style="flex-wrap:wrap;border-radius:20px">${ISO.shaftList.map(x => `<button data-fshaft="${x}" class="${x === f0.shaft ? 'on' : ''}">${x}</button>`).join('')}</div></div>
      <div class="dsrow"><label class="f" style="flex:0 1 200px"><span>Nennmaß in mm (über 6 bis 50)</span><input id="fN" inputmode="decimal" autocomplete="off" value="${esc(f0.N)}"></label></div><div id="fRes"></div></div>`;
    h += '<div id="fCmp"></div><div id="fPick"></div>';
    $('#fitView').innerHTML = h; updateFit(); renderPick();
  }
  function updateFit() {
    const f0 = S.fit, N = fitN(), F = C.fit(f0.hole, f0.shaft, N), host = $('#fRes'); if (!host) return; lsSet('fit', f0);
    if (!F) { host.innerHTML = `<div class="rdout bad">Die Tabelle gilt für Nennmaße über 6 bis 50 mm (Bereiche: über 6 bis 10, über 10 bis 18, über 18 bis 30, über 30 bis 50 mm). Bitte ein Nennmaß in diesem Bereich eingeben.</div>`; $('#fCmp').innerHTML = ''; return; }
    const lines = C.fitLines(F);
    let h = `<p class="hint2" style="margin:0 0 6px">Nennmaßbereich: <b>${esc(C.rangeLabel(F.range))}</b> · Passung <b>Ø${esc(String(f0.N).trim())} ${esc(F.code)}</b></p>`;
    h += svgFit(F);
    h += `<table class="tt"><tr><th></th><th class="n">oben</th><th class="n">unten</th><th class="n">Höchstmaß</th><th class="n">Mindestmaß</th></tr>
      <tr><td><b>Bohrung ${esc(F.hole.code)}</b></td><td class="n">ES ${sg(F.hole.ES)} µm</td><td class="n">EI ${sg(F.hole.EI)} µm</td><td class="n">${C.fmtDe(F.holeGo, 3)} mm</td><td class="n">${C.fmtDe(F.holeGu, 3)} mm</td></tr>
      <tr><td><b>Welle ${esc(F.shaft.code)}</b></td><td class="n">es ${sg(F.shaft.es)} µm</td><td class="n">ei ${sg(F.shaft.ei)} µm</td><td class="n">${C.fmtDe(F.shaftGo, 3)} mm</td><td class="n">${C.fmtDe(F.shaftGu, 3)} mm</td></tr></table>
      <table class="tt">${lines.map(l => `<tr><td>${l[0]}</td><td class="n"><b>${l[1]} µm</b></td></tr>`).join('')}</table>
      <div class="rdout ${F.art === 'spiel' ? 'ok' : F.art === 'press' ? 'bad' : ''}"><span class="badge ${F.art}">${esc(F.artText)}</span> ${F.art === 'spiel' ? 'Das Mindestspiel ist nicht negativ: Die Welle ist immer kleiner oder gleich der Bohrung.' : F.art === 'press' ? 'Das Höchstspiel ist nicht positiv: Die Welle ist immer größer oder gleich der Bohrung, es entsteht immer ein Übermaß.' : 'Je nach Istmaßen kann Spiel oder Übermaß entstehen.'}</div>`;
    host.innerHTML = h;
    /* Vergleich aller Wellen */
    let t = `<div class="card pl"><h4>Alle Wellen mit ${esc(f0.hole)} im Vergleich (Ø${esc(f0.N)} mm)</h4><table class="tt"><tr><th>Passung</th><th>Art</th><th class="n">Höchstspiel</th><th class="n">Mindestspiel</th></tr>`;
    ISO.shaftList.forEach(sh => { const x = C.fit(f0.hole, sh, N); t += `<tr class="pk${sh === f0.shaft ? ' sel' : ''}" data-fshaft="${sh}"><td><b>${f0.hole}/${sh}</b></td><td><span class="badge ${x.art}" style="font-size:12px;padding:1px 8px">${x.art === 'spiel' ? 'Spiel' : x.art === 'press' ? 'Übermaß' : 'Übergang'}</span></td><td class="n">${sg(x.Pso)} µm</td><td class="n">${sg(x.Psu)} µm</td></tr>`; });
    $('#fCmp').innerHTML = t + '</table><p class="hint2">Negatives Spiel bedeutet Übermaß. Tippe auf eine Zeile, um die Passung oben anzuzeigen.</p></div>';
  }
  function pickOptions(i) { const R = C.rng('pick' + i), o = D.useOptions.slice(); for (let j = o.length - 1; j > 0; j--) { const k = Math.floor(R() * (j + 1)); [o[j], o[k]] = [o[k], o[j]]; } return o; }
  function renderPick() {
    const host = $('#fPick'); if (!host) return; const u = D.uses[S.pick.i % D.uses.length], opts = pickOptions(S.pick.i % D.uses.length), p = S.pick;
    let h = `<div class="card pl"><h4>Welche Passung passt? (${p.i % D.uses.length + 1}/${D.uses.length}) · richtig gewählt: ${S.pickStat.ok} von ${S.pickStat.n}</h4><div class="big">${esc(u.title)}</div><p style="margin:4px 0 8px">${esc(u.text)}</p>
      <div class="opts" id="pkOpts">${opts.map((o, i) => `<button data-po="${i}" ${p.res ? 'disabled' : ''} class="${p.res ? (o === u.correct ? 'ok' : i === p.sel ? 'bad' : '') : i === p.sel ? 'on' : ''}">${esc(o)}</button>`).join('')}</div>`;
    if (p.res) {
      const code = u.correct.split('/')[1], F = C.fit('H7', code, 25), L = C.fitLines(F);
      h += `<div class="fb ${p.res.ok ? 'ok' : 'bad'}"><span class="v">${p.res.ok ? '✓ Richtig!' : '✗ Leider nicht.'}</span> Passend ist ${esc(u.correct)}. ${esc(u.why)}<br><span class="hint2">Beispiel Ø25: ${esc(F.artText)}, ${L.map(l => l[0] + ' ' + l[1] + ' µm').join(', ')}.</span></div><div class="btns"><button class="btn pri" data-pn="next">Nächster Fall</button></div>`;
    } else h += `<div class="btns"><button class="btn pri" data-pn="chk"${p.sel >= 0 ? '' : ' disabled'}>✓ Prüfen</button></div>`;
    host.innerHTML = h + '</div>';
  }
  $('#fitView').addEventListener('input', e => { if (e.target.id === 'fN') { S.fit.N = e.target.value; updateFit(); } });
  $('#fitView').addEventListener('click', e => {
    const b = e.target.closest('[data-fhole],[data-fshaft],[data-po],[data-pn]'); if (!b) return;
    if (b.dataset.fhole) { S.fit.hole = b.dataset.fhole; renderFit(); }
    else if (b.dataset.fshaft) { S.fit.shaft = b.dataset.fshaft; renderFit(); }
    else if (b.dataset.po != null) { S.pick.sel = +b.dataset.po; renderPick(); }
    else if (b.dataset.pn === 'chk') {
      const u = D.uses[S.pick.i % D.uses.length], o = pickOptions(S.pick.i % D.uses.length), ok = o[S.pick.sel] === u.correct;
      S.pick.res = { ok }; S.pickStat.n++; if (ok) S.pickStat.ok++; lsSet('pick', S.pickStat); renderPick(); updatePal(); if (ok) ding(); else sad();
    } else if (b.dataset.pn === 'next') { S.pick.i++; S.pick.sel = -1; S.pick.res = null; renderPick(); }
  });

  /* ============================================================ Aufgaben */
  const done = () => lsGet('done', {});
  const exam = () => lsGet('exam', '0') === '1';
  function pctFor(id) { if (!exam()) return 100; const st = lsGet('ctipps', {})[id] || 0; return st >= 3 ? 0 : 100 - 25 * st; }   /* Stufe 3 verrät die Lösung: 0 % */
  function markSolved(id, pct) {
    const p = lsGet('prog', {}); if ((p[id] || 0) < pct) p[id] = pct; lsSet('prog', p);
    if (pct > 0) { const d = done(); d[id] = true; lsSet('done', d); }
    updateBadge(); updatePal();
  }
  function updateBadge() { const b = $('#tkBd'); if (!b) return; const n = Object.keys(done()).filter(k => TASKS.some(t => t.id === k)).length; b.textContent = n + '/' + TASKS.length; }
  const curTask = () => S.task && TASKS.find(t => t.id === S.task);
  function solutionText(t) { const s = t.solve(C); return t.ask.type === 'choice' ? t.ask.choices[t.ask.correct] : fAny(s.value) + ' ' + (t.ask.unit || ''); }
  function checkTask(t) {
    const a = S.tAns[t.id] || {}, s = t.solve(C); let ok = false, given = '', lines = [];
    if (t.ask.type === 'choice') { if (a.c == null) { toast('Wähle zuerst eine Antwort.'); return; } ok = a.c === s.correct; given = t.ask.choices[a.c]; }
    else { const v = C.parseDe(a.v); if (!isFinite(v)) { toast('Bitte gib eine Zahl ein (mit Komma oder Punkt).'); return; } ok = Math.abs(v - s.value) <= s.tol + 1e-9; given = fAny(v) + ' ' + t.ask.unit; }
    const pct = ok ? pctFor(t.id) : 0, ex = exam();
    lines.push({ ok, text: ok ? 'Richtig: ' + given : 'Deine Antwort „' + given + '“ stimmt nicht.' });
    if (t.inst) lines.push({ ok: true, info: true, text: 'Erlaubt ist eine Abweichung von ±1 Teilstrich (±' + fAny(s.tol) + ' mm).' });
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
      if (n >= 2) {
        let extra = ''; if (t.inst) { const r = C.reading(t.inst); extra = r.t === 'caliper' ? ' Auf der Hauptskala steht ' + r.main + ' mm.' : ' Die Hülse zeigt ' + f2(r.sleeveTotal - r.base) + ' mm' + (r.base ? ' (dazu kommen ' + r.base + ' mm Messbereichsanfang)' : '') + '.'; }
        x += `<p><b>Stufe 2:</b> ${esc(t.tips[1])}${esc(extra)}</p>`;
      }
      if (n >= 3) x += `<p><b>Stufe 3:</b> Die Lösung lautet <b>${esc(solutionText(t))}</b>.</p>`;
      else x += '<p class="hint2">Noch mehr Hilfe? Tippe noch einmal auf „Tipp“ für die nächste Stufe.</p>';
      x += ex ? '<p class="hint2" style="color:var(--warn)">Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte. Mit Stufe 3 zählt die Aufgabe nicht mehr.</p>' : '<p class="hint2">Beim normalen Üben kosten Tipps nichts. Im Prüfmodus (🎓) zählen sie.</p>';
      b.innerHTML = x;
    });
  }
  function renderTasks(top) {
    const V = $('#taskView'), d = done(), prog = lsGet('prog', {}), t = curTask(), n100 = TASKS.filter(x => d[x.id]).length; let h = '';
    if (t) {
      const r = S.tRes && S.tRes.id === t.id ? S.tRes : null, a = S.tAns[t.id] || {};
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv">${dots(t.level)}</div><p style="margin:8px 0">${esc(t.text)}</p>`;
      if (t.inst) {
        h += `<div id="tkInst">${instWrap(t.inst, { zoom: S.tz, hi: !!(r && r.ok) })}</div>`;
        if (t.inst.t === 'caliper') h += `<div class="ctl"><span style="align-self:center;font-size:12px;color:var(--mute)">Lupe</span>${[1, 2, 3].map(z => `<button class="chip s${S.tz === z ? ' on' : ''}" data-tz="${z}">×${String(z).replace('.', ',')}</button>`).join('')}</div>`;
      }
      if (t.ask.type === 'choice') h += `<div class="opts" id="tkOpts">${t.ask.choices.map((c, i) => `<button data-tc="${i}" ${r && r.ok ? 'disabled' : ''} class="${r && r.ok && i === t.ask.correct ? 'ok' : a.c === i ? (r && !r.ok ? 'bad' : 'on') : ''}">${esc(c)}</button>`).join('')}</div>`;
      else h += `<label class="f"><span>${esc(t.ask.label || 'Dein Ergebnis')} (${esc(t.ask.unit)})</span><div class="qin"><input id="tkIn" inputmode="decimal" autocomplete="off" value="${esc(a.v || '')}" ${r && r.ok ? 'disabled' : ''}><span class="u">${esc(t.ask.unit)}</span></div></label>`;
      h += `<div class="btns"><button class="btn pri" data-ta="chk"${r && r.ok ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" data-ta="hint">💡 Tipp</button><button class="btn" data-ta="close">Schließen</button></div>`;
      if (exam()) h += '<p class="hint2" style="color:var(--warn)">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>';
      if (r) {
        h += `<ul class="tl">${r.lines.map(l => `<li class="${l.info ? '' : l.ok ? 'ok' : 'bad'}">${l.info ? 'ℹ' : l.ok ? '✓' : '✗'} ${esc(l.text)}</li>`).join('')}</ul>`;
        if (r.ok || !exam()) h += `<div class="rdout ${r.ok ? 'ok' : 'bad'}"><b>Lösung:</b> ${esc(r.sol)}<br>${esc(t.expl)}${t.inst ? '<br><br><b>Ablesung:</b> ' + esc(C.describe(t.inst)) : ''}</div>`;
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
  $('#taskView').addEventListener('input', e => { const t = curTask(); if (t && e.target.id === 'tkIn') (S.tAns[t.id] = S.tAns[t.id] || {}).v = e.target.value; });
  $('#taskView').addEventListener('keydown', e => { const t = curTask(); if (t && e.key === 'Enter' && e.target.id === 'tkIn') { e.preventDefault(); checkTask(t); } });
  $('#taskView').addEventListener('click', e => {
    const t = curTask(), tc = e.target.closest('[data-tc]'), ta = e.target.closest('[data-ta]'), tz = e.target.closest('[data-tz]'), row = e.target.closest('.row[data-t]');
    if (tc && t) { (S.tAns[t.id] = S.tAns[t.id] || {}).c = +tc.dataset.tc; if (S.tRes && !S.tRes.ok) S.tRes = null; renderTasks(false); return; }
    if (tz) { S.tz = +tz.dataset.tz; renderTasks(false); return; }
    if (ta && t) { const a = ta.dataset.ta; if (a === 'chk') checkTask(t); else if (a === 'hint') hintTask(t); else if (a === 'close') { S.task = null; S.tRes = null; renderTasks(); } else if (a === 'next') { const i = TASKS.findIndex(x => x.id === t.id), nx = TASKS.slice(i + 1).find(x => !done()[x.id]) || TASKS[(i + 1) % TASKS.length]; startTask(nx.id); } return; }
    if (row) startTask(row.dataset.t);
  });
  function startTask(id) {
    S.task = id; S.tAns = {}; S.tRes = null; S.tz = 1;
    const h = lsGet('hints', {}), c = lsGet('ctipps', {}); if (h[id]) { delete h[id]; lsSet('hints', h); } if (c[id]) { delete c[id]; lsSet('ctipps', c); }
    renderTasks();
  }

  /* ============================================================ Zufalls-Trainer */
  function newTrainer() { const T = S.tr; T.inst = C.genReading(R0, { kind: T.kind, level: T.level }); T.res = null; T.ans = ''; T.shown = false; renderTrainer(); }
  function renderTrainer() {
    const T = S.tr, V = $('#rtView'); if (!T.inst) { newTrainer(); return; }
    const st = S.rt; let h = `<div class="card pl"><h4>Zufalls-Trainer: unendlich viele Ablesungen</h4>
      <div class="fbar">${segHTML('rkind', [['caliper', 'Messschieber'], ['micro', 'Bügelmessschraube'], ['mixed', 'Gemischt']], T.kind)}${segHTML('rlevel', [[1, 'leicht'], [2, 'mittel'], [3, 'schwer']], T.level)}</div>
      <div class="stats"><div class="bx"><b>${st.streak}</b>Serie</div><div class="bx"><b>${st.best}</b>Beste Serie</div><div class="bx"><b>${st.ok}/${st.n}</b>Richtig</div></div>`;
    h += `<div id="rtInst">${instWrap(T.inst, { zoom: T.zoom, hi: T.shown })}</div>`;
    if (T.inst.t === 'caliper') h += `<div class="ctl"><span style="align-self:center;font-size:12px;color:var(--mute)">Lupe</span>${[1, 2, 3].map(z => `<button class="chip s${T.zoom === z ? ' on' : ''}" data-rz="${z}">×${String(z).replace('.', ',')}</button>`).join('')}</div>`;
    h += `<p class="hint2" style="margin:2px 0 6px">${T.inst.t === 'caliper' ? 'Messschieber mit Nonius ' + C.NONIUS[T.inst.den].name + ' (Ablesung ' + C.NONIUS[T.inst.den].rtext + ')' : 'Bügelmessschraube, Messbereich ' + T.inst.base + '–' + (T.inst.base + 25) + ' mm (Ablesung 0,01 mm)'}. Erlaubt ist ±1 Teilstrich.</p>`;
    h += `<label class="f"><span>Dein Messwert in mm</span><div class="qin"><input id="rtIn" inputmode="decimal" autocomplete="off" value="${esc(T.ans)}" ${T.res ? 'disabled' : ''}><span class="u">mm</span></div></label>`;
    h += T.res ? `<div class="btns"><button class="btn pri" data-r="next">Nächste Aufgabe</button></div>` : `<div class="btns"><button class="btn pri" data-r="chk">✓ Prüfen</button><button class="btn" data-r="show">Lösung zeigen</button></div>`;
    if (T.res) {
      const r = T.res; h += `<div class="fb ${r.ok ? 'ok' : 'bad'}"><span class="v">${r.shown ? 'Lösung: ' + fAny(r.truth) + ' mm (zählt als Fehler, Serie beginnt neu)' : r.ok ? '✓ Richtig! Serie: ' + st.streak : '✗ Nicht ganz: richtig sind ' + fAny(r.truth) + ' mm. Serie beginnt neu.'}</span></div><div class="rdout ${r.ok ? 'ok' : 'bad'}">${esc(C.describe(T.inst))}</div>`;
    }
    V.innerHTML = h + '</div>';
  }
  function trainerResult(res, shown) {
    const T = S.tr, st = S.rt; st.n++; if (res.ok && !shown) { st.ok++; st.streak++; st.best = Math.max(st.best, st.streak); } else st.streak = 0; lsSet('rt', st);
    T.res = Object.assign({}, res, { shown }); T.shown = true; if (res.ok && !shown) ding(); else sad(); renderTrainer(); updatePal();
    if (res.ok && !shown && st.streak > 0 && st.streak % 5 === 0) { toast('🔥 ' + st.streak + ' richtige in Folge!'); const F = fx(); if (F && F.pass) try { F.pass(100); } catch (e) {} }
  }
  $('#rtView').addEventListener('input', e => { if (e.target.id === 'rtIn') S.tr.ans = e.target.value; });
  $('#rtView').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'rtIn') { e.preventDefault(); if (S.tr.res) newTrainer(); else { const r = C.checkReading(S.tr.inst, S.tr.ans); if (r.empty) toast('Bitte gib eine Zahl ein.'); else trainerResult(r, false); } } });
  $('#rtView').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const T = S.tr;
    if (b.dataset.rkind) { T.kind = b.dataset.rkind; newTrainer(); }
    else if (b.dataset.rlevel) { T.level = +b.dataset.rlevel; newTrainer(); }
    else if (b.dataset.rz) { T.zoom = +b.dataset.rz; renderTrainer(); }
    else if (b.dataset.r === 'chk') { const r = C.checkReading(T.inst, T.ans); if (r.empty) toast('Bitte gib eine Zahl ein.'); else trainerResult(r, false); }
    else if (b.dataset.r === 'show') trainerResult(C.checkReading(T.inst, ''), true);
    else if (b.dataset.r === 'next') newTrainer();
  });

  /* ============================================================ Hilfe */
  function renderHelp() {
    const ex1 = { t: 'caliper', den: 20, v: 23.35 }, ex2 = { t: 'micro', base: 0, v: 7.38 }, F1 = C.fit('H7', 'f7', 25), F2 = C.fit('H7', 'j6', 25), F3 = C.fit('H7', 's6', 25);
    $('#helpView').innerHTML = `
    <details open><summary>📏 Nonius ablesen (Messschieber)</summary><div class="hb2">
      <p><b>1. Hauptskala:</b> Lies die ganzen Millimeter links vom Nullstrich des Nonius ab. Die Zahlen auf der Hauptskala sind Zentimeter.</p>
      <p><b>2. Nonius:</b> Suche den einen Strich des Nonius, der genau mit einem Strich der Hauptskala in einer Linie liegt. Sein Wert ist die Nachkommastelle.</p>
      <table><tr><th>Nonius</th><th>Ablesung</th><th>Aufbau</th></tr><tr><td>1/10</td><td>0,1 mm</td><td>10 Teile auf 9 mm</td></tr><tr><td>1/20</td><td>0,05 mm</td><td>20 Teile auf 39 mm</td></tr><tr><td>1/50</td><td>0,02 mm</td><td>50 Teile auf 49 mm</td></tr></table>
      <p>Die Zahlen am Nonius zeigen Zehntel Millimeter. Bei 1/20 und 1/50 liegen kleine Striche zwischen den Zahlen.</p>
      <p>Beispiel: Hauptskala 23 mm, der 7. Strich des 1/20-Nonius deckt sich: 7 × 0,05 = 0,35 mm. Messwert <b>23,35 mm</b>.</p>
      <div class="inst">${svgCaliper(20, 23.35, { zoom: 1, hi: true })}</div>
      <p>Außenmaße misst du mit den großen Schenkeln, Innenmaße mit den kleinen oberen Schnäbeln, Tiefen mit dem Tiefenmessstab. Schau senkrecht auf die Skala, sonst liest du falsch (Parallaxe).</p></div></details>
    <details><summary>🔩 Bügelmessschraube ablesen</summary><div class="hb2">
      <p><b>1. Hülse:</b> Lies die ganzen Millimeter ab. Ist der Halbmillimeterstrich (unter der Linie) neben der Trommelkante frei, kommen <b>0,5 mm</b> dazu.</p>
      <p><b>2. Trommel:</b> Lies die Zahl ab, die an der Linie der Hülse steht. Ein Strich ist 0,01 mm. Eine Umdrehung der Trommel sind 0,5 mm.</p>
      <p><b>3. Messbereich:</b> Bei Bügelmessschrauben 25–50, 50–75, 75–100 mm kommt der Beginn des Messbereichs dazu.</p>
      <p>Beispiel (Messbereich 0–25): Hülse 7 mm, Halbmillimeter verdeckt, Trommel 38 = 0,38 mm. Messwert <b>7,38 mm</b>.</p>
      <div class="inst fit">${svgMicro(0, 7.38, { hi: true })}</div>
      <p>Die Knarre sorgt für immer gleichen Messdruck: Dreh nur an der Knarre, bis sie knackt.</p></div></details>
    <details><summary>📐 Toleranzbegriffe</summary><div class="hb2">
      <table><tr><th>Begriff</th><th>Bedeutung</th></tr>
      <tr><td>Nennmaß N</td><td>Maß an der Zeichnung, auf das sich die Abmaße beziehen</td></tr>
      <tr><td>Abmaße</td><td>Oberes Abmaß ES (Bohrung) bzw. es (Welle), unteres Abmaß EI bzw. ei. Großbuchstaben für Innenmaße, Kleinbuchstaben für Außenmaße.</td></tr>
      <tr><td>Höchstmaß G<sub>o</sub></td><td>größtes erlaubtes Maß = Nennmaß + oberes Abmaß</td></tr>
      <tr><td>Mindestmaß G<sub>u</sub></td><td>kleinstes erlaubtes Maß = Nennmaß + unteres Abmaß</td></tr>
      <tr><td>Toleranz T</td><td>Höchstmaß − Mindestmaß = oberes − unteres Abmaß</td></tr>
      <tr><td>Mittenmaß</td><td>(Höchstmaß + Mindestmaß) / 2</td></tr></table>
      <p><b>Gut, Nacharbeit, Ausschuss:</b> Liegt das Istmaß zwischen den Grenzmaßen (Grenzen eingeschlossen), ist das Teil gut. Bei einer <b>Welle</b> ist zu groß = Nacharbeit (abtragen), zu klein = Ausschuss. Bei einer <b>Bohrung</b> ist zu klein = Nacharbeit (aufbohren, aufreiben), zu groß = Ausschuss.</p>
      <p><b>Faustregel zur Messmittelwahl:</b> Der Skalenteilungswert (Ablesung) des Messmittels soll höchstens 1/10 der Toleranz sein.</p></div></details>
    <details><summary>🎯 Passungsarten</summary><div class="hb2">
      <p>Passung = Zusammenspiel von Bohrung und Welle mit gleichem Nennmaß. Im System <b>Einheitsbohrung</b> hat die Bohrung immer H (unteres Abmaß 0), die Welle wechselt je nach gewünschter Passung.</p>
      <table><tr><th>Art</th><th>Merkmal</th><th>Beispiele</th></tr>
      <tr><td><span class="badge spiel" style="font-size:12px">Spielpassung</span></td><td>Mindestspiel ≥ 0, die Welle ist nie größer als die Bohrung</td><td>H7/f7 Gleitlager, H7/g6, H7/h6</td></tr>
      <tr><td><span class="badge uebergang" style="font-size:12px">Übergangspassung</span></td><td>je nach Istmaßen Spiel oder Übermaß</td><td>H7/j6 Zentrierung, H7/k6, H7/m6, H7/n6</td></tr>
      <tr><td><span class="badge press" style="font-size:12px">Übermaßpassung</span></td><td>Höchstspiel ≤ 0, die Welle ist nie kleiner als die Bohrung</td><td>H7/p6, H7/s6 Presssitz</td></tr></table>
      <p>Toleranzfeld-Diagramme für Ø25: H7/f7 (Spiel), H7/j6 (Übergang), H7/s6 (Übermaß).</p>
      <div class="cols l3"><div>${svgFit(F1)}</div><div>${svgFit(F2)}</div></div><div style="max-width:440px;margin:0 auto">${svgFit(F3)}</div></div></details>
    <details><summary>🧮 Formeln</summary><div class="hb2">
      <span class="eq">Höchstmaß G_o = N + ES (Bohrung) bzw. N + es (Welle)</span>
      <span class="eq">Mindestmaß G_u = N + EI (Bohrung) bzw. N + ei (Welle)</span>
      <span class="eq">Toleranz T = G_o − G_u = ES − EI</span>
      <span class="eq">Höchstspiel P_Smax = G_o(Bohrung) − G_u(Welle) = ES − ei</span>
      <span class="eq">Mindestspiel P_Smin = G_u(Bohrung) − G_o(Welle) = EI − es</span>
      <span class="eq">Höchstübermaß P_Ümax = es − EI  (= −Mindestspiel)</span>
      <span class="eq">Mindestübermaß P_Ümin = ei − ES  (= −Höchstspiel)</span>
      <span class="eq">Passungstoleranz = P_Smax − P_Smin = T_Bohrung + T_Welle</span>
      <p>Spielpassung: P_Smin ≥ 0. Übermaßpassung: P_Smax ≤ 0. Sonst Übergangspassung. 1 µm = 0,001 mm.</p></div></details>
    <details><summary>📋 ISO-Abmaße im Überblick (µm)</summary><div class="hb2">
      <p>Aus der Tabelle des Labs (ISO 286-1, Einheitsbohrung). Bitte im Tabellenbuch gegenprüfen.</p>
      ${isoTable()}</div></details>
    <details><summary>🧰 Messmittel wählen</summary><div class="hb2">
      <table><tr><th>Messmittel</th><th>Ablesung</th></tr>${D.devices.map(x => `<tr><td>${esc(x.name)}</td><td>${C.fmtDe(x.r, x.r < 0.01 ? 3 : 2)} mm</td></tr>`).join('')}</table>
      <p>Rechne: erlaubte Ablesung = Toleranz / 10. Wähle das einfachste Messmittel, dessen Ablesung höchstens so groß ist.</p></div></details>`;
  }
  function isoTable() {
    let h = '<table><tr><th>Bereich (mm)</th>' + ISO.holes.concat(ISO.shaftList).map(x => `<th>${x}</th>`).join('') + '</tr>';
    ISO.ranges.forEach((r, i) => { h += `<tr><td>${r[0]}–${r[1]}</td>` + ISO.holes.map(x => { const d = C.holeDev(x, r[1]); return `<td>${sg(d.ES)}/${sg(d.EI)}</td>`; }).join('') + ISO.shaftList.map(x => { const d = C.shaftDev(x, r[1]); return `<td>${sg(d.es)}/${sg(d.ei)}</td>`; }).join('') + '</tr>'; });
    return '<div style="overflow-x:auto">' + h + '</table></div>';
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'cal'; S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    if (t === 'cal') renderInst('cal'); else if (t === 'mic') renderInst('mic'); else if (t === 'calc') renderCalc(); else if (t === 'fit') renderFit();
    else if (t === 'tasks') renderTasks(); else if (t === 'rt') renderTrainer(); else if (t === 'help') renderHelp();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'Toleranz-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = 'Toleranz-Lab: ' + T[2];
  }
  function setExam(on) { lsSet('exam', on ? '1' : '0'); updatePal(); $('#bExam').classList.toggle('on', on); $('#bExam').setAttribute('aria-pressed', on); toast(on ? '🎓 Prüfmodus an: Tipps kosten 25 % je Stufe.' : 'Prüfmodus aus: Tipps kosten nichts.'); if (S.tab === 'tasks') renderTasks(false); }
  let palSig = '';
  function updatePal() {
    const F = !!fx(), fxOn = F && !fx().isMuted(), n = Object.keys(done()).filter(k => TASKS.some(t => t.id === k)).length, sig = [F, fxOn, exam(), n, S.rt.streak, S.rt.best].join('|'); if (sig === palSig) return; palSig = sig;
    $('#pal').innerHTML = `${F ? `<button class="chip ${fxOn ? 'on' : ''}" data-a="fx" aria-pressed="${fxOn}" title="Effekte und Ton">${fxOn ? '🎉' : '🔇'} Effekte</button>` : ''}<button class="chip ${exam() ? 'on' : ''}" data-a="exam" aria-pressed="${exam()}" title="Prüfmodus: Tipps zählen als Abzug">🎓 Prüfmodus</button><button class="chip" data-a="rand" title="Zufällige Ablesung im Trainer">🎲 Zufallsaufgabe</button>
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
  $('#title').onclick = () => setTab('cal');
  $('#bMenu').onclick = () => {
    const rows = [['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung und Tipps'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Ablesungen mit Serien-Zähler'], ['help', 'Hilfe und Spickzettel', 'Nonius, Toleranzbegriffe, Passungen, Formeln'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben und Trainer-Serie auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
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
      b.innerHTML = '<p style="margin-top:0">Alle gelösten Aufgaben, Tipps und die Trainer-Serie dieses Labs werden auf diesem Gerät gelöscht. Das kann nicht rückgängig gemacht werden.</p><div class="btns"><button class="btn" data-x="no">Abbrechen</button><button class="btn danger" data-x="yes">Löschen</button></div>';
      b.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (!x) return; if (x.dataset.x === 'yes') { ['done', 'prog', 'hints', 'ctipps', 'rt', 'pick'].forEach(k => { try { localStorage.removeItem(LS + k); } catch (er) {} }); S.rt = { n: 0, ok: 0, streak: 0, best: 0 }; S.pickStat = { n: 0, ok: 0 }; S.task = null; S.tRes = null; palSig = ''; updatePal(); updateBadge(); if (S.tab === 'tasks') renderTasks(); toast('Fortschritt gelöscht'); } close(); });
    });
  }

  /* Schnittstelle für Karriere/Lernpfad */
  root.TOL_LAB = { id: 'tol', title: 'Toleranz-Lab', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.TOL_TASKS };

  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (S.tab === 'cal' || S.tab === 'mic') updateInst(S.tab); else if (S.tab === 'tasks' && curTask()) renderTasks(false); else if (S.tab === 'rt') renderTrainer(); }, 150); });
  buildTabs(); updatePal(); setTab(S.tab);
  /* Aufruf ?aufgabe=tol1 (Startseite, Lernhefte): Aufgabe gleich öffnen */
  try { const qa = new URLSearchParams(location.search).get('aufgabe'); if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); } } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
