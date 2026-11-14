'use strict';
/* Tonfunk Lab "Signale und Systeme": Oberfläche (Lab-Kennung 'sig').
   Reiter: Signale, Spektrum, Abtastung, Filter, Faltung, Modulation (je Erklärung + Visualisierung), Aufgaben (?aufgabe=sig1), Hilfe.
   Module: sigcore.js (SIG_CORE), sigdata.js (SIG_DATA, SIG_TASKS), sigviz.js (SIG_VIZ: Zeichnen und Modelle).
   Speicher (Präfix lm4.sig.): tab, lab (Reglerstände), done ({id:true}), prog ({id:Prozent}), hints ({id:höchste Stufe}),
   ctipps ({id:Stufe} nur im Prüfmodus), exam ('1' = Prüfmodus), filter (Aufgabenfilter).
   Tipps: drei Stufen; im Prüfmodus kostet jede Stufe 25 % der Punkte, sonst nichts.
   Die HTML-Bausteine (window.SIG_UIX) sind reine Funktionen und werden von quelle/sig/test_sigui.js ohne Browser geprüft. */
(function (root) {
  const C = root.SIG_CORE || (typeof require === 'function' ? require('./sigcore.js') : null);
  const D = root.SIG_DATA || (typeof require === 'function' ? require('./sigdata.js') : null);
  const V = root.SIG_VIZ || (typeof require === 'function' ? require('./sigviz.js') : null);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.sig.';
  const hasDoc = typeof document !== 'undefined' && document.querySelector;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(LS + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} };
  const dots = l => '●'.repeat(l || 1) + '○'.repeat(3 - (l || 1));
  const reduced = () => { try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } };

  /* ============================================================ Zustand (Voreinstellungen) */
  const defaults = () => ({
    kenn: { w: 'sin', a: 5, dc: 0, d: 0.5 },
    spek: { fs: 1024, N: 512, win: 'rect', db: false, noise: 0, comps: [{ on: true, w: 'sin', a: 1, f: 100 }, { on: true, w: 'sin', a: 0.5, f: 250 }, { on: false, w: 'sin', a: 0.3, f: 60 }] },
    abt: { f: 13, fs: 40, rec: 'sinc' },
    fil: { type: 'lp', order: 1, f0: 1000, Q: 0.71, fu: 100, fo: 5000, fm: 2000 },
    fal: { xs: '1 2 3 2 1', hs: '1/3 1/3 1/3', n: 2 },
    mod: { kind: 'am', fc: 1000, fm: 100, m: 0.6, df: 200, env: false }
  });
  const S = { tab: 'kenn', lab: defaults(), t: null, filter: '', play: null };
  const TABS = [['kenn', '〰️', 'Signale'], ['spek', '📊', 'Spektrum'], ['abt', '⏱️', 'Abtastung'], ['fil', '🎚️', 'Filter'], ['fal', '🧮', 'Faltung'], ['mod', '📡', 'Modulation'], ['tasks', '📝', 'Aufgaben'], ['help', '📘', 'Hilfe']];
  const LABTABS = ['kenn', 'spek', 'abt', 'fil', 'fal', 'mod'];
  const BLOCK = id => D.blocks.find(b => b.id === id);

  /* ============================================================ Bausteine für Bedienelemente */
  const rg = (id, label, min, max, step, val, disp, extra) => `<label class="rg" for="${id}"><span class="lb">${esc(label)}</span><output class="vl" id="${id}_o" for="${id}">${esc(disp)}</output><input type="range" id="${id}" data-rg="${id}" min="${min}" max="${max}" step="${step}" value="${val}"${extra || ''}></label>`;
  const seg = (name, label, items, cur) => `<div class="seg" role="group" aria-label="${esc(label)}" data-seg="${name}">${items.map(([k, l]) => `<button type="button" class="${String(cur) === String(k) ? 'on' : ''}" data-k="${esc(k)}" aria-pressed="${String(cur) === String(k)}">${esc(l)}</button>`).join('')}</div>`;
  const chips = (label, items) => `<div class="chiprow" role="group" aria-label="${esc(label)}">${items.map(([k, l]) => `<button type="button" class="chip" data-chip="${esc(k)}">${esc(l)}</button>`).join('')}</div>`;
  const cvs = (key, label, pri) => `<canvas id="cv_${key}" class="cv${pri ? ' pri' : ''}" role="img" aria-label="${esc(label)}"></canvas>`;
  const STATUS = '<div id="status" class="status" hidden></div>', RO = '<div id="readout"></div>';
  const hz = f => C.fmtHz(f, 3);
  /* Frequenzregler logarithmisch: Wert = log10(f) */
  const lg = f => Math.log10(f).toFixed(3);
  const fromLg = v => { const f = Math.pow(10, +v), e = Math.pow(10, Math.floor(Math.log10(f)) - 2); return Math.round(f / e) * e; };

  /* ============================================================ Reiter-Beschreibungen */
  const TAB = {};

  /* ---- 1 Signale ---- */
  TAB.kenn = {
    cv: ['time'],
    html: s => ({ ctl: `<div class="ctlbox">${seg('w', 'Kurvenform', [['sin', 'Sinus'], ['rect', 'Rechteck'], ['tri', 'Dreieck'], ['saw', 'Sägezahn']], s.w)}
      ${rg('kA', 'Scheitelwert û', 0.5, 10, 0.5, s.a, C.fmt(s.a) + ' V')}${rg('kDc', 'Gleichanteil (Offset)', -5, 5, 0.5, s.dc, C.fmt(s.dc) + ' V')}
      ${s.w === 'rect' ? rg('kD', 'Tastgrad D', 10, 90, 5, Math.round(s.d * 100), Math.round(s.d * 100) + ' %') : ''}</div>`,
      plots: `${cvs('time', 'Signalverlauf mit Mittelwert und Effektivwert', 1)}${RO}` }),
    ranges: { kA: (s, v) => { s.a = +v; return C.fmt(s.a) + ' V'; }, kDc: (s, v) => { s.dc = +v; return C.fmt(s.dc) + ' V'; }, kD: (s, v) => { s.d = +v / 100; return Math.round(s.d * 100) + ' %'; } },
    segs: { w: (s, k) => { s.w = k; return true; } },
    model: s => V.MODELS.kenn(s)
  };

  /* ---- 2 Spektrum ---- */
  const SPEKP = {
    raster: { name: 'Auf dem Raster', win: 'rect', N: 512, noise: 0, comps: [[1, 100, 'sin'], [0.5, 250, 'sin'], null] },
    leck: { name: 'Leckeffekt', win: 'rect', N: 512, noise: 0, comps: [[1, 101, 'sin'], null, null] },
    hann: { name: 'Leck mit Hann', win: 'hann', N: 512, noise: 0, comps: [[1, 101, 'sin'], null, null] },
    rechteck: { name: 'Rechteck-Spektrum', win: 'rect', N: 1024, noise: 0, comps: [[1, 20, 'rect'], null, null] },
    rausch: { name: 'Töne im Rauschen', win: 'hann', N: 1024, noise: 0.6, comps: [[1, 120, 'sin'], [0.3, 300, 'sin'], null] }
  };
  TAB.spek = {
    cv: ['time', 'spec'],
    html: s => ({ ctl: `<div class="ctlbox">${chips('Beispiele', Object.keys(SPEKP).map(k => [k, SPEKP[k].name]))}
      <div class="row2"><div><div class="mini">Fenster</div>${seg('win', 'Fenster', [['rect', 'Rechteck'], ['hann', 'Hann']], s.win)}</div><div><div class="mini">Länge N (f_s = ${s.fs} Hz)</div>${seg('N', 'Länge N', [[128, '128'], [256, '256'], [512, '512'], [1024, '1024']], s.N)}</div><div><div class="mini">Achse</div>${seg('db', 'Achse', [['0', 'linear'], ['1', 'dB']], s.db ? '1' : '0')}</div></div>
      ${s.comps.map((c, i) => `<fieldset class="sigrow"><legend>Signal ${i + 1}</legend>${seg('cw' + i, 'Signal ' + (i + 1) + ' Form', [['off', 'Aus'], ['sin', 'Sinus'], ['rect', 'Rechteck'], ['tri', 'Dreieck']], c.on ? c.w : 'off')}
        ${c.on ? rg('sA' + i, 'Amplitude', 0.1, 2, 0.1, c.a, C.fmt(c.a) + ' V') + rg('sF' + i, 'Frequenz', 2, 500, 0.5, c.f, C.fmt(c.f) + ' Hz') : ''}</fieldset>`).join('')}
      ${rg('sNz', 'Rauschen (Effektivwert)', 0, 1, 0.05, s.noise, C.fmt(s.noise) + ' V')}</div>`,
      plots: `${cvs('spec', 'Amplitudenspektrum', 1)}${STATUS}${cvs('time', 'Zeitverlauf der Abtastwerte')}${RO}` }),
    ranges: (() => { const r = { sNz: (s, v) => { s.noise = +v; return C.fmt(s.noise) + ' V'; } }; for (let i = 0; i < 3; i++) { r['sA' + i] = ((i) => (s, v) => { s.comps[i].a = +v; return C.fmt(+v) + ' V'; })(i); r['sF' + i] = ((i) => (s, v) => { s.comps[i].f = +v; return C.fmt(+v) + ' Hz'; })(i); } return r; })(),
    segs: (() => { const g = { win: (s, k) => { s.win = k; return false; }, N: (s, k) => { s.N = +k; return false; }, db: (s, k) => { s.db = k === '1'; return false; } }; for (let i = 0; i < 3; i++) g['cw' + i] = ((i) => (s, k) => { if (k === 'off') s.comps[i].on = false; else { s.comps[i].on = true; s.comps[i].w = k; } return true; })(i); return g; })(),
    chips: (s, k) => { const p = SPEKP[k]; if (!p) return false; s.win = p.win; s.N = p.N; s.noise = p.noise; p.comps.forEach((c, i) => { if (!c) s.comps[i].on = false; else { s.comps[i] = { on: true, a: c[0], f: c[1], w: c[2] }; } }); return true; },
    model: s => V.MODELS.spek(s),
    status: (m, s) => { const df = s.fs / s.N, lines = s.comps.filter(c => c.on && c.w === 'sin'); if (!lines.length && !s.comps.some(c => c.on)) return { cls: 'info', text: 'Schalte mindestens ein Signal ein.' };
      if (m.leak) return { cls: 'warn', icon: '⚠', text: `Leckeffekt: Mindestens eine Frequenz liegt nicht auf dem ${C.fmt(df)}-Hz-Raster.` + (m.loss != null && m.loss > 0.05 ? ` Die Linie des ersten Sinus ist um ${C.fmt(m.loss, 3)} dB zu niedrig und breit.` : '') + (s.win === 'rect' ? ' Probiere das Hann-Fenster.' : '') };
      return { cls: 'ok', icon: '✓', text: `Alle Frequenzen liegen genau auf dem Raster (Vielfache von ${C.fmt(df)} Hz): saubere, schmale Linien.` }; }
  };

  /* ---- 3 Abtastung ---- */
  const ABTP = { ok: ['Richtig abgetastet', 0.25], grenz: ['An der Grenze', 0.5], alias: ['Aliasing', 0.8], gleich: ['f = f_s', 1.0], viel: ['Weit darüber', 1.3] };
  TAB.abt = {
    cv: ['time', 'spec'],
    html: s => ({ ctl: `<div class="ctlbox">${chips('Beispiele', Object.keys(ABTP).map(k => [k, ABTP[k][0]]))}
      ${rg('aFs', 'Abtastfrequenz f_s', 10, 100, 1, s.fs, s.fs + ' Hz')}${rg('aF', 'Signalfrequenz f', 1, Math.round(2.5 * s.fs), 0.5, s.f, C.fmt(s.f) + ' Hz')}
      <div class="mini">Rekonstruktion</div>${seg('rec', 'Rekonstruktion', [['sinc', 'Ideal (sinc)'], ['zoh', 'Treppe'], ['none', 'Keine']], s.rec)}</div>`,
      plots: `${cvs('time', 'Signal, Abtastwerte und Rekonstruktion', 1)}${STATUS}${cvs('spec', 'Spektrum der Abtastwerte mit Spiegelungen')}${RO}` }),
    ranges: { aFs: (s, v) => { s.fs = +v; const mx = Math.round(2.5 * s.fs), el = hasDoc && $('#aF'); if (el) { el.max = mx; if (s.f > mx) s.f = mx; el.value = s.f; const o = $('#aF_o'); if (o) o.textContent = C.fmt(s.f) + ' Hz'; } else if (s.f > mx) s.f = mx; return s.fs + ' Hz'; }, aF: (s, v) => { s.f = +v; return C.fmt(s.f) + ' Hz'; } },
    segs: { rec: (s, k) => { s.rec = k; return false; } },
    chips: (s, k) => { const p = ABTP[k]; if (!p) return false; s.f = Math.round(p[1] * s.fs * 2) / 2; return true; },
    model: s => V.MODELS.abt(s),
    status: (m, s) => Math.abs(s.f - s.fs / 2) < 1e-9 ? { cls: 'bad', icon: '⚠', text: `Grenzfall: f = ${C.fmt(s.f)} Hz liegt genau auf f_s/2 = ${C.fmt(s.fs / 2)} Hz. Die Abtastwerte hängen von der Phase ab, das Abtasttheorem ist nicht erfüllt.` } : m.aliasing ? { cls: 'bad', icon: '⚠', text: `Aliasing: f = ${C.fmt(s.f)} Hz liegt über f_s/2 = ${C.fmt(s.fs / 2)} Hz. Im Spektrum erscheint eine Scheinfrequenz von ${C.fmt(m.fa, 4)} Hz, die Rekonstruktion zeigt diese falsche Schwingung.` } : { cls: 'ok', icon: '✓', text: `Kein Aliasing: f = ${C.fmt(s.f)} Hz liegt unter f_s/2 = ${C.fmt(s.fs / 2)} Hz.${s.f / s.fs > 0.45 ? ' Knapp unter der Grenze braucht die Rekonstruktion viele Abtastwerte.' : ''}` }
  };

  /* ---- 4 Filter ---- */
  const FILP = { rc: ['RC-Tiefpass 1 kHz', { type: 'lp', order: 1, f0: 1000 }], bw: ['Butterworth 2. Ordnung', { type: 'lp', order: 2, f0: 1000, Q: 0.71 }], swing: ['Tiefpass mit Überschwingen', { type: 'lp', order: 2, f0: 1000, Q: 3 }], hp: ['Hochpass 100 Hz', { type: 'hp', order: 1, f0: 100 }], bp: ['Schwingkreis Q = 5', { type: 'bp', order: 2, f0: 2000, Q: 5 }], bp1: ['Bandpass aus HP und TP', { type: 'bp', order: 1, fu: 200, fo: 4000 }] };
  TAB.fil = {
    cv: ['mag', 'pha', 'step'],
    html: s => {
      const bp1 = s.type === 'bp' && s.order === 1;
      return { ctl: `<div class="ctlbox">${chips('Beispiele', Object.keys(FILP).map(k => [k, FILP[k][0]]))}
      <div class="row2"><div><div class="mini">Filtertyp</div>${seg('type', 'Filtertyp', [['lp', 'Tiefpass'], ['hp', 'Hochpass'], ['bp', 'Bandpass']], s.type)}</div><div><div class="mini">${s.type === 'bp' ? 'Bauform' : 'Ordnung'}</div>${s.type === 'bp' ? seg('order', 'Bauform', [[1, 'HP + TP (breit)'], [2, 'Schwingkreis (Q)']], s.order) : seg('order', 'Ordnung', [[1, '1.'], [2, '2.']], s.order)}</div></div>
      ${bp1 ? rg('fFu', 'Untere Grenze f_u (Hochpass)', 1.3, 4.3, 0.01, lg(s.fu), hz(s.fu)) + rg('fFo', 'Obere Grenze f_o (Tiefpass)', 1.3, 4.3, 0.01, lg(s.fo), hz(s.fo)) : rg('fF0', s.type === 'bp' ? 'Mittenfrequenz f₀' : s.order === 1 ? 'Grenzfrequenz f_g' : 'Eckfrequenz f₀', 1.3, 4.3, 0.01, lg(s.f0), hz(s.f0))}
      ${s.order === 2 && !bp1 ? rg('fQ', 'Güte Q' + (Math.abs(s.Q - Math.SQRT1_2) < 0.03 ? ' (Butterworth)' : ''), 0.3, 10, 0.05, s.Q, C.fmt(s.Q, 3)) : ''}
      ${rg('fFm', 'Messfrequenz (auch durch Ziehen im Diagramm)', 1, 5, 0.01, lg(s.fm), hz(s.fm))}</div>`,
      plots: `${cvs('mag', 'Bode-Diagramm Betrag in dB', 1)}${cvs('pha', 'Bode-Diagramm Phase in Grad')}${cvs('step', 'Sprungantwort')}${RO}` };
    },
    ranges: { fF0: (s, v) => { s.f0 = fromLg(v); return hz(s.f0); }, fFu: (s, v) => { s.fu = fromLg(v); if (s.fo < 1.5 * s.fu) { s.fo = 1.5 * s.fu; const e = hasDoc && $('#fFo'); if (e) { e.value = lg(s.fo); $('#fFo_o').textContent = hz(s.fo); } } return hz(s.fu); }, fFo: (s, v) => { s.fo = fromLg(v); if (s.fu > s.fo / 1.5) { s.fu = s.fo / 1.5; const e = hasDoc && $('#fFu'); if (e) { e.value = lg(s.fu); $('#fFu_o').textContent = hz(s.fu); } } return hz(s.fo); }, fQ: (s, v) => { s.Q = +v; return C.fmt(s.Q, 3); }, fFm: (s, v) => { s.fm = fromLg(v); return hz(s.fm); } },
    segs: { type: (s, k) => { s.type = k; if (k === 'bp' && s.order === 1) { /* ok */ } return true; }, order: (s, k) => { s.order = +k; return true; } },
    chips: (s, k) => { const p = FILP[k]; if (!p) return false; Object.assign(s, { f0: 1000, Q: 0.71 }, p[1]); return true; },
    model: s => V.MODELS.fil(s)
  };

  /* ---- 5 Faltung ---- */
  function parseList(str) {
    const toks = String(str).replace(/;/g, ' ').trim().split(/\s+/).filter(Boolean);
    if (!toks.length || toks.length > 12) return null;
    const out = [];
    for (const t of toks) { let v; const m = /^([+\-−]?[\d.,]+)\/([\d.,]+)$/.exec(t); if (m) v = C.parseDe(m[1]) / C.parseDe(m[2]); else v = C.parseDe(t); if (!isFinite(v) || Math.abs(v) > 99) return null; out.push(v); }
    return out;
  }
  const rseq = (seed, n) => { const R = C.rng(seed); return Array.from({ length: n }, () => C.ri(R, -2, 4)).join(' '); };
  const FALX = { imp: ['Impuls', '1 0 0 0 0 0'], sprung: ['Sprung', '1 1 1 1 1 1 1 1'], rechteck: ['Rechteck', '1 1 1 1 0 0'], dreieck: ['Dreieck', '1 2 3 2 1'], zufall: ['Zufall', rseq('fal', 7)] };
  const FALH = { mittel: ['Mittelwert', '1/3 1/3 1/3'], diff: ['Differenz', '1 -1'], echo: ['Echo', '1 0 0 0,5'], abkl: ['Abklingend', [0, 1, 2, 3].map(k => C.fmt(Math.pow(0.6, k), 3)).join(' ')], imp: ['Impuls (Identität)', '1'] };
  function falData(s) { const x = parseList(s.xs), h = parseList(s.hs); return { x, h, ok: !!(x && h) }; }
  TAB.fal = {
    cv: ['px', 'ph', 'pp', 'py'], ctlfirst: true,
    html: s => { const d = falData(s), L = d.ok ? d.x.length + d.h.length - 1 : 1;
      return { ctl: `<div class="ctlbox"><div class="mini">Eingangssignal x[k] (Zahlen mit Leerzeichen trennen, Brüche wie 1/3 erlaubt)</div>
      <input type="text" id="fX" data-in="xs" value="${esc(s.xs)}" inputmode="text" autocomplete="off" aria-label="Eingangssignal x" spellcheck="false">${chips('Eingang', Object.keys(FALX).map(k => ['x:' + k, FALX[k][0]]))}
      <div class="mini">Impulsantwort h[k]</div><input type="text" id="fH" data-in="hs" value="${esc(s.hs)}" inputmode="text" autocomplete="off" aria-label="Impulsantwort h" spellcheck="false">${chips('Impulsantwort', Object.keys(FALH).map(k => ['h:' + k, FALH[k][0]]))}
      <div id="faErr" class="status bad" role="alert" hidden></div>
      <div class="nrow"><button type="button" class="btn" data-act="prev" aria-label="n kleiner">−</button>${rg('fN', 'Ausgabeindex n', 0, Math.max(0, L - 1), 1, s.n, 'n = ' + s.n)}<button type="button" class="btn" data-act="next" aria-label="n größer">+</button>${reduced() ? '' : '<button type="button" class="btn" data-act="play" id="faPlay">▶ Abspielen</button>'}</div></div>`,
      plots: `${cvs('px', 'Eingangssignal x')}${cvs('ph', 'Gespiegelte Impulsantwort')}${cvs('pp', 'Produkte')}${cvs('py', 'Ausgangssignal y')}${RO}` }; },
    ranges: { fN: (s, v) => { s.n = +v; return 'n = ' + s.n; } },
    segs: {},
    chips: (s, k) => { const [a, b] = k.split(':'); if (a === 'x' && FALX[b]) { s.xs = FALX[b][1]; } else if (a === 'h' && FALH[b]) { s.hs = FALH[b][1]; } else return false; const d = falData(s); s.n = Math.min(s.n, d.ok ? d.x.length + d.h.length - 2 : 0); return true; },
    model: s => { const d = falData(s); if (!d.ok) return null; return V.MODELS.fal({ x: d.x, h: d.h, n: s.n }); }
  };

  /* ---- 6 Modulation ---- */
  const dfMax = fc => Math.min(800, Math.max(10, Math.floor(0.4 * fc / 10) * 10));   /* Hub höchstens 40 % des Trägers: Momentanfrequenz bleibt positiv */
  TAB.mod = {
    cv: ['time', 'spec'],
    html: s => { const dm = dfMax(s.fc); if (s.df > dm) s.df = dm; return { ctl: `<div class="ctlbox">${seg('kind', 'Modulationsart', [['am', 'AM (Amplitude)'], ['fm', 'FM (Frequenz)']], s.kind)}
      ${rg('mFc', 'Trägerfrequenz f_T', 500, 2000, 100, s.fc, s.fc + ' Hz')}${rg('mFm', 'Modulationsfrequenz f_m', 50, 300, 10, s.fm, s.fm + ' Hz')}
      ${s.kind === 'am' ? rg('mM', 'Modulationsgrad m', 0, 150, 5, Math.round(s.m * 100), Math.round(s.m * 100) + ' %') + `<div class="mini">Demodulation</div>${seg('env', 'Hüllkurvendemodulator', [['0', 'Aus'], ['1', 'Hüllkurve zeigen']], s.env ? '1' : '0')}` : rg('mDf', 'Frequenzhub Δf (höchstens 40 % von f_T)', 10, dm, 10, s.df, s.df + ' Hz')}</div>`,
      plots: `${cvs('time', 'Modulierte Schwingung im Zeitbereich', 1)}${STATUS}${cvs('spec', 'Spektrum der modulierten Schwingung')}${RO}` }; },
    ranges: { mFc: (s, v) => { s.fc = +v; const mx = dfMax(s.fc), el = hasDoc && $('#mDf'); if (s.df > mx) s.df = mx; if (el) { el.max = mx; el.value = s.df; const o = $('#mDf_o'); if (o) o.textContent = s.df + ' Hz'; } return s.fc + ' Hz'; }, mFm: (s, v) => { s.fm = +v; return s.fm + ' Hz'; }, mM: (s, v) => { s.m = +v / 100; return Math.round(s.m * 100) + ' %'; }, mDf: (s, v) => { s.df = Math.min(+v, dfMax(s.fc)); return s.df + ' Hz'; } },
    segs: { kind: (s, k) => { s.kind = k; return true; }, env: (s, k) => { s.env = k === '1'; return false; } },
    model: s => V.MODELS.mod(s),
    status: (m, s) => s.kind === 'am' ? (s.m > 1 ? { cls: 'bad', icon: '⚠', text: 'Übermodulation (m über 100 %): Die Hüllkurve geht durch null und wird verzerrt. Ein Hüllkurvendemodulator liefert dann ein falsches Signal.' } : { cls: 'ok', icon: '✓', text: 'Keine Übermodulation: Die Hüllkurve folgt unverzerrt dem Nachrichtensignal.' }) : { cls: 'info', text: `β = ${C.fmt(s.df / s.fm, 3)}: ${s.df / s.fm < 0.5 ? 'Schmalband-FM, im Spektrum fast wie AM (Träger und zwei Seitenlinien).' : 'Breitband-FM, viele Seitenlinien im Abstand f_m. Die Linien folgen den Besselfunktionen.'}` }
  };

  /* ============================================================ Anzeige: Messwerte und Erklärung */
  function fv(m) {
    const one = v => v == null || !isFinite(v) ? '–' : m.u === 'Hz' ? C.fmtHz(v, 4) : m.u === 's' ? C.fmtS(v, 3) : C.fmt(v, 4) + (m.u ? ' ' + m.u : '');
    return Array.isArray(m.v) ? m.v.map(one).join(' und ') : one(m.v);
  }
  const readout = metrics => `<div class="mets" role="list">${metrics.map(m => `<div class="met" role="listitem"><span class="k">${esc(m.k)}</span><b class="v">${esc(fv(m))}</b>${m.f ? `<small>${esc(m.f)}</small>` : ''}</div>`).join('')}</div>`;
  const more = b => `<details class="more"><summary>Erklärung: ${esc(b.title)}</summary><div class="mb">${b.more.map(([h, t]) => `<h4>${esc(h)}</h4><p>${esc(t)}</p>`).join('')}</div></details>`;
  const intro = b => `<div class="card pl intro"><h2 class="big">${esc(b.icon)} ${esc(b.title)}</h2><p>${esc(b.intro)}</p></div>`;
  function labHTML(tab, lab) {
    const b = BLOCK(tab), T = TAB[tab], s = lab[tab];
    const n = D.tasks.filter(t => t.cat === b.cat).length;
    const h = T.html(s);
    return `${intro(b)}<div class="card viz"><div class="vz${T.ctlfirst ? ' ctlfirst' : ''}"><div class="plots">${h.plots}</div><div class="ctl">${h.ctl}</div></div></div>${more(b)}<div class="btns"><button type="button" class="btn pri" data-act="goTasks">📝 ${n} Aufgaben zu diesem Block</button></div>`;
  }

  /* ============================================================ Aufgaben (HTML-Bausteine) */
  const exam = () => lsGet('exam', '0') === '1';
  const done = () => lsGet('done', {});
  const nDone = () => Object.keys(done()).filter(k => D.tasks.some(t => t.id === k)).length;
  function taskHTML(ctx, solved) {
    const q = ctx.q, r = ctx.res, locked = !!(r && (r.ok || r.shown));
    let h = `<p class="qtext">${esc(q.text)}</p>`;
    h += `<label class="f"><span>${esc(q.label)}${q.unit ? ' in ' + esc(q.unit) : ''}</span><div class="qin"><input data-v id="tkIn" inputmode="decimal" autocomplete="off" value="${esc(ctx.ans || '')}"${locked ? ' disabled' : ''} aria-describedby="tkRule"><span class="u">${esc(q.unit)}</span></div></label>`;
    h += `<p class="hint2" id="tkRule">Komma oder Punkt als Dezimalzeichen. Erlaubte Abweichung: ±${esc(C.fmt(q.tol, 2))}${q.unit ? ' ' + esc(q.unit) : ''}. Tausenderpunkte sind bei der Eingabe nicht nötig.</p>`;
    h += `<div class="btns"><button type="button" class="btn pri" data-a="chk"${locked ? ' disabled' : ''}>✓ Prüfen</button><button type="button" class="btn" data-a="hint"${locked ? ' disabled' : ''}>💡 Tipp</button></div>`;
    if (r && !r.empty) {
      const msg = r.shown ? 'Lösung angezeigt (zählt nicht als gelöst).' : r.ok ? 'Richtig: ' + C.fmt(r.x, 5) + (q.unit ? ' ' + q.unit : '') : 'Deine Antwort „' + C.fmt(r.x, 5) + (q.unit ? ' ' + q.unit : '') + '“ stimmt nicht.';
      h += `<ul class="tl"><li class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓' : '✗'} ${esc(msg)}</li></ul>`;
      if (r.ok || r.shown) h += solutionHTML(q);
      else if (exam()) h += '<div class="rdout bad">🎓 Prüfmodus: Die Musterlösung gibt es erst nach richtiger Lösung. Nutze einen Tipp oder versuche es noch einmal.</div>';
    }
    if (!locked && !exam()) h += `<div class="btns"><button type="button" class="btn" data-a="show">👁 Musterlösung ansehen</button></div>`;
    return h;
  }
  function solutionHTML(q) { return `<div class="rdout ok"><b>Musterlösung mit Rechenweg</b><ol class="steps">${q.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol><p class="res">Ergebnis: <b>${esc(C.fmt(q.value, 5))}${q.unit ? ' ' + esc(q.unit) : ''}</b></p></div>`; }
  function tipHTML(q, n) {
    let x = '';
    for (let i = 0; i < n; i++) x += `<p><b>Stufe ${i + 1}${['', ' (Formel)', ' (eingesetzt)'][i]}:</b> ${esc(q.tips[i])}</p>`;
    x += n < 3 ? `<p class="hint2">Noch mehr Hilfe? Tippe noch einmal auf „Tipp“ für Stufe ${n + 1} von 3.</p>` : '';
    x += exam() ? '<p class="hint2 warn">Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>' : '<p class="hint2">Beim normalen Üben kosten Tipps nichts. Im Prüfmodus (🎓) zählen sie.</p>';
    return x;
  }
  function taskListHTML(filter, d, prog) {
    let h = `<div class="chiprow filt" role="group" aria-label="Block wählen">${[['', 'Alle']].concat(D.CATS.map(c => [c, c])).map(([k, l]) => `<button type="button" class="chip${filter === k ? ' on' : ''}" data-f="${esc(k)}" aria-pressed="${filter === k}">${esc(l)}</button>`).join('')}</div>`;
    let last = '';
    D.tasks.filter(t => !filter || t.cat === filter).forEach(x => { if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; } const p = prog[x.id]; h += `<button type="button" class="row" data-t="${esc(x.id)}"><span class="dot ${d[x.id] ? 'g' : p > 0 ? 'p' : ''}" aria-hidden="true">${d[x.id] ? '✓' : ''}</span><span class="grow"><b>${esc(x.title)}</b><small><span class="lv" aria-label="Stufe ${x.level} von 3">${dots(x.level)}</span>${p != null && !d[x.id] ? ' · bisher ' + p + ' %' : ''}${d[x.id] ? ' · gelöst' : ''}</small></span></button>`; });
    return h;
  }
  /* ============================================================ Hilfe */
  function helpHTML() {
    const rows = ['sin', 'rect', 'tri', 'saw'].map(w => { const st = C.statWave(w, 1, { d: 0.5 }); return `<tr><th>${esc(V.WNAME[w])}</th><td>${esc(C.fmt(st.mean, 4))}</td><td>${esc(C.fmt(st.abs, 4))}</td><td>${esc(C.fmt(st.rms, 4))}</td><td>${esc(C.fmt(st.crest, 4))}</td><td>${esc(C.fmt(st.form, 4))}</td></tr>`; }).join('');
    return `<div class="card pl"><h2 class="big">📘 Hilfe und Spickzettel</h2>
      <p>Alle sechs Blöcke haben eine Visualisierung zum Ausprobieren und Aufgaben mit Musterlösung. Bedienung: Regler ziehen oder mit den Pfeiltasten verstellen, Beispiele per Antippen laden, das Diagramm im Reiter Filter durch Ziehen zum Messen benutzen.</p></div>
      <details class="more" open><summary>Kenngrößen für Einheitsamplitude û = 1 (Rechteck: D = 50 %, ohne Offset)</summary><div class="mb tw"><table class="h"><thead><tr><th>Form</th><th>Mittelwert</th><th>Gleichricht­wert</th><th>Effektiv­wert</th><th>Crest</th><th>Form­faktor</th></tr></thead><tbody>${rows}</tbody></table><p class="hint2">Die Zahlen stammen aus der Rechnung des Labs (sigcore.js).</p></div></details>
      <details class="more"><summary>Formeln im Überblick</summary><div class="mb"><ul class="fl">
        <li>Effektivwert mehrerer Frequenzen: U_eff² = U₀² + Σ û_i²/2</li><li>Crest-Faktor = Scheitelwert / Effektivwert; Formfaktor = Effektivwert / Gleichrichtwert</li>
        <li>DFT: X[k] = Σ x[n]·e^(−j·2π·k·n/N); Raster Δf = f_s/N; Linie des Sinus A: |X| = N·A/2</li><li>Fensterkorrektur: A = 2·|X| / (N·cg); Hann: cg = 0,5</li>
        <li>Abtasttheorem: f_s &gt; 2·f_max; Scheinfrequenz f_A = |f − n·f_s|; SNR (ideal) = 6,02·N + 1,76 dB</li>
        <li>RC-Glied: f_g = 1/(2πRC); Tiefpass 1. Ordnung: |H| = 1/√(1 + (f/f_g)²), φ = −arctan(f/f_g)</li><li>2. Ordnung: Q = 1/√2 Butterworth; Bandpass: Q = f₀/B; Überschwingen exp(−πζ/√(1−ζ²)), ζ = 1/(2Q)</li>
        <li>Faltung: y[n] = Σ x[k]·h[n−k], Länge M + K − 1; Σy = Σx·Σh</li><li>AM: m = Â_m/Â_T, Seitenlinien m·Â_T/2, B = 2 f_m, Seitenbandanteil m²/(2+m²)</li><li>FM: β = Δf/f_m, Carson-Bandbreite B ≈ 2·(Δf + f_m)</li></ul></div></details>
      <details class="more"><summary>Hinweise zu den Aufgaben</summary><div class="mb"><p>Die Zahlen jeder Aufgabe werden zufällig gewürfelt („Neue Zahlen“). Die Musterlösung kommt aus der Rechnung des Labs, nicht aus einer festen Tabelle. Tipps haben drei Stufen: Denkanstoß, Formel, Formel mit Zahlen. Im Prüfmodus zählen Tipps 25 % Abzug je Stufe.</p><p>Eingabe: Dezimalkomma oder Punkt; eine Zahl mit genau drei Nachkommastellen wie 1.539 wird auch als Tausenderschreibweise (1539) gelesen. Winkel in Grad, Pegel in dB (negativ = Dämpfung).</p></div></details>`;
  }
  const UIX = { defaults, TAB, TABS, labHTML, taskHTML, tipHTML, solutionHTML, taskListHTML, helpHTML, readout, parseList, fv, falData };
  root.SIG_UIX = UIX;
  if (typeof module !== 'undefined' && module.exports) module.exports = UIX;
  if (!hasDoc || !$('#mid')) return;

  /* ============================================================ DOM: Rahmen */
  const fx = () => root.LochFX || null;
  const ding = () => { const F = fx(); if (F && F.sound) try { F.sound('ding', 0.6); } catch (e) {} };
  const sad = () => { const F = fx(); if (F && F.sound) try { F.sound('sad', 0.5); } catch (e) {} };
  function toast(m) { const t = $('#toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), Math.max(2200, m.length * 55)); }
  function sheet(title, build) {
    const prev = document.activeElement, bd = document.createElement('div'); bd.className = 'backdrop';
    bd.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="sh-h"><b>${esc(title)}</b><button type="button" class="x" aria-label="Schließen">✕</button></div><div class="sh-b"></div></div>`;
    document.body.appendChild(bd);
    const close = () => { bd.remove(); if (prev && prev.focus) try { prev.focus(); } catch (e) {} };
    bd.addEventListener('pointerdown', e => { if (e.target === bd) close(); });
    $('.x', bd).onclick = close; build($('.sh-b', bd), close); try { $('.x', bd).focus(); } catch (e) {}
    return close;
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { const b = $$('.backdrop'); if (b.length) b[b.length - 1].remove(); } });

  /* ============================================================ DOM: Lab-Reiter */
  const labView = $('#labView');
  const CVH = { mag: w => Math.max(230, Math.min(330, w * 0.62)), pha: w => Math.max(200, Math.min(260, w * 0.5)), step: w => Math.max(200, Math.min(270, w * 0.42)), px: () => 136, ph: () => 136, pp: () => 136, py: () => 144 };
  const cvH = (k, w) => Math.round((CVH[k] || (ww => Math.max(210, Math.min(300, ww * 0.52))))(w));
  let axes = {}, raf = 0, lastModel = null;
  function saveLab() { lsSet('lab', S.lab); }
  function loadLab() {
    const st = lsGet('lab', null), d = defaults();
    if (st && typeof st === 'object') for (const k of Object.keys(d)) if (st[k] && typeof st[k] === 'object') { if (k === 'spek' && Array.isArray(st[k].comps) && st[k].comps.length === 3) d[k] = Object.assign(d[k], st[k]); else if (k !== 'spek') d[k] = Object.assign(d[k], st[k]); }
    S.lab = d;
    const f = S.lab.fil; if (!(f.f0 > 0) || !(f.fm > 0) || !(f.fu > 0) || !(f.fo > 0) || !(f.Q > 0)) S.lab.fil = defaults().fil;
    const a = S.lab.abt; if (!(a.fs >= 10 && a.fs <= 100) || !(a.f > 0) || a.f > 2.5 * a.fs) S.lab.abt = defaults().abt;
    const m = S.lab.mod; if (!(m.fc >= 500 && m.fc <= 2000) || !(m.fm >= 50 && m.fm <= 300) || !(m.df >= 10 && m.df <= 800) || !(m.m >= 0 && m.m <= 1.5)) S.lab.mod = defaults().mod;
    const k = S.lab.kenn; if (!(k.a >= 0.5 && k.a <= 10) || !(k.d >= 0.1 && k.d <= 0.9)) S.lab.kenn = defaults().kenn;
    const sp = S.lab.spek; if (![128, 256, 512, 1024].includes(sp.N) || !(sp.noise >= 0 && sp.noise <= 1) || sp.comps.some(c => !(c.f >= 2 && c.f <= 500) || !(c.a >= 0.1 && c.a <= 2))) S.lab.spek = defaults().spek;
  }
  function renderLab(tab) {
    stopPlay();
    labView.innerHTML = labHTML(tab, S.lab);
    wirePointer(); schedule();
  }
  function schedule() { if (raf) return; raf = (root.requestAnimationFrame || (f => setTimeout(f, 16)))(() => { raf = 0; update(); }); }
  function update() {
    if (!LABTABS.includes(S.tab)) return;
    const T = TAB[S.tab], s = S.lab[S.tab], m = T.model(s);
    const st = $('#status'), ro = $('#readout');
    if (!m) { const er = $('#faErr'); if (er) { er.hidden = false; er.textContent = 'Bitte nur Zahlen eingeben (höchstens 12 Werte, Beträge bis 99), getrennt durch Leerzeichen.'; } $$('canvas.cv').forEach(c => { c.style.visibility = 'hidden'; }); if (ro) ro.innerHTML = ''; return; }
    const er = $('#faErr'); if (er) er.hidden = true;
    lastModel = m; axes = {};
    for (const key of T.cv) {
      const cv = $('#cv_' + key); if (!cv || !m.plots[key]) continue;
      cv.style.visibility = ''; axes[key] = V.draw(cv, m.plots[key], cvH(key, cv.clientWidth || cv.parentNode.clientWidth || 320));
    }
    if (ro) ro.innerHTML = S.tab === 'fal' ? falReadout(m) : readout(m.metrics);
    if (st && T.status) { const r = T.status(m, s); st.hidden = false; st.className = 'status ' + r.cls; st.innerHTML = (r.icon ? `<span class="ic" aria-hidden="true">${r.icon}</span>` : '') + `<span>${esc(r.text)}</span>`; }
    const first = $('#cv_' + T.cv[0]); if (first && m.aria) first.setAttribute('aria-label', m.aria);
  }
  function falReadout(m) {
    const t = m.terms, line = t.length ? t.map(q => `<span class="tm">${esc(C.fmt(q.x, 3))}·${esc(C.fmt(q.h, 3))}</span>`).join(' + ') + ` = <b>${esc(C.fmt(m.value, 4))}</b>` : 'Für dieses n überdecken sich x und h nicht: y[n] = 0.';
    return `<div class="rdout"><b>y[${m.n}] = Σ x[k]·h[${m.n} − k]</b><div class="sum">${line}</div></div>` + readout(m.metrics.slice(1));
  }
  /* Reglerereignisse */
  labView.addEventListener('input', e => {
    const el = e.target, id = el.dataset && el.dataset.rg, s = S.lab[S.tab], T = TAB[S.tab];
    if (el.dataset && el.dataset.in) { s[el.dataset.in] = el.value; if (S.tab === 'fal') { const d = falData(s), mx = d.ok ? d.x.length + d.h.length - 2 : 0; if (s.n > mx) s.n = mx; const sl = $('#fN'); if (sl && d.ok) { sl.max = mx; sl.value = s.n; $('#fN_o').textContent = 'n = ' + s.n; } } saveLab(); schedule(); return; }
    if (!id || !T.ranges[id]) return;
    const disp = T.ranges[id](s, el.value); const o = $('#' + id + '_o'); if (o) o.textContent = disp;
    if (S.tab === 'fil' && id === 'fQ') { const lb = el.closest('label').querySelector('.lb'); if (lb) lb.textContent = 'Güte Q' + (Math.abs(s.Q - Math.SQRT1_2) < 0.03 ? ' (Butterworth)' : ''); }
    saveLab(); schedule();
  });
  labView.addEventListener('click', e => {
    const T = TAB[S.tab], s = S.lab[S.tab];
    const sg = e.target.closest('[data-seg] button');
    if (sg && T.segs) { const f = T.segs[sg.parentNode.dataset.seg]; if (f) { const rb = f(s, sg.dataset.k); saveLab(); if (rb) renderLab(S.tab); else { $$('button', sg.parentNode).forEach(b => { const on = b === sg; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }); schedule(); } } return; }
    const ch = e.target.closest('[data-chip]');
    if (ch && T.chips) { if (T.chips(s, ch.dataset.chip)) { saveLab(); renderLab(S.tab); } return; }
    const ac = e.target.closest('[data-act]');
    if (ac) { const a = ac.dataset.act; if (a === 'goTasks') { S.filter = BLOCK(S.tab).cat; lsSet('filter', S.filter); setTab('tasks'); } else if (S.tab === 'fal') falAct(a); }
  });
  /* Faltung: Schrittbedienung */
  function stopPlay() { if (S.play) { clearTimeout(S.play); S.play = null; const b = $('#faPlay'); if (b) b.textContent = '▶ Abspielen'; } }
  function falAct(a) {
    const s = S.lab.fal, d = falData(s); if (!d.ok) return; const mx = d.x.length + d.h.length - 2;
    const setN = n => { s.n = Math.max(0, Math.min(mx, n)); const sl = $('#fN'); if (sl) { sl.value = s.n; $('#fN_o').textContent = 'n = ' + s.n; } saveLab(); schedule(); };
    if (a === 'prev') { stopPlay(); setN(s.n - 1); } else if (a === 'next') { stopPlay(); setN(s.n + 1); }
    else if (a === 'play') { if (S.play) { stopPlay(); return; } if (reduced()) return; const b = $('#faPlay'); if (b) b.textContent = '⏸ Anhalten'; if (s.n >= mx) setN(0); const step = () => { if (S.tab !== 'fal') { S.play = null; return; } if (s.n >= mx) { stopPlay(); return; } setN(s.n + 1); S.play = setTimeout(step, 700); }; S.play = setTimeout(step, 700); }
  }
  /* Zeigerbedienung im Bode-Diagramm: Messfrequenz ziehen */
  function wirePointer() {
    if (S.tab !== 'fil') return;
    ['mag', 'pha'].forEach(key => {
      const cv = $('#cv_' + key); if (!cv) return; let down = false;
      const move = ev => { const a = axes[key]; if (!a) return; const r = cv.getBoundingClientRect(), f = Math.min(V.FMAX, Math.max(V.FMIN, a.invX(ev.clientX - r.left))); const s = S.lab.fil; s.fm = Math.round(f / Math.pow(10, Math.floor(Math.log10(f)) - 2)) * Math.pow(10, Math.floor(Math.log10(f)) - 2); const sl = $('#fFm'); if (sl) { sl.value = lg(s.fm); $('#fFm_o').textContent = hz(s.fm); } schedule(); };
      cv.addEventListener('pointerdown', ev => { down = true; try { cv.setPointerCapture(ev.pointerId); } catch (e) {} move(ev); });
      cv.addEventListener('pointermove', ev => { if (down) move(ev); });
      const up = () => { if (down) { down = false; saveLab(); } };
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    });
  }

  /* ============================================================ DOM: Aufgaben */
  const taskView = $('#taskView');
  function pctFor(id) { if (!exam()) return 100; const st = lsGet('ctipps', {})[id] || 0; return Math.max(0, 100 - 25 * st); }
  function markSolved(id, pct) { const p = lsGet('prog', {}); if ((p[id] || 0) < pct) p[id] = pct; lsSet('prog', p); if (pct > 0) { const d = done(); d[id] = true; lsSet('done', d); } updateBadge(); updatePal(); }
  function updateBadge() { const b = $('#tkBd'); if (b) b.textContent = nDone() + '/' + D.tasks.length; }
  function startTask(id, variant) {
    const t = D.tasks.find(x => x.id === id); if (!t) return;
    S.tv = S.tv || {}; S.tv[id] = variant || 0;
    S.t = { id, q: t.make(C.rng(id + '#' + S.tv[id]), C), ans: '', res: null, tip: 0 };
    const h = lsGet('hints', {}), c = lsGet('ctipps', {}); if (h[id]) { delete h[id]; lsSet('hints', h); } if (c[id]) { delete c[id]; lsSet('ctipps', c); }
    renderTasks();
    const inp = $('#tkIn'); if (inp) try { inp.scrollIntoView({ block: 'center' }); } catch (e) {}
  }
  function renderTasks(top) {
    const ctx = S.t, t = ctx && D.tasks.find(x => x.id === ctx.id); let h = '';
    if (t) {
      h += `<div class="card pl taskcard"><h3 class="gh2">Aufgabe · ${esc(t.cat)} <span class="lv" aria-label="Stufe ${t.level} von 3">${dots(t.level)}</span></h3><div class="big">${esc(t.title)}</div>${taskHTML(ctx)}`;
      if (exam()) h += '<p class="hint2 warn">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>';
      h += `<div class="btns"><button type="button" class="btn" data-a="neu">🎲 Neue Zahlen</button>${ctx.res && (ctx.res.ok || ctx.res.shown) ? '<button type="button" class="btn pri" data-a="next">Nächste Aufgabe</button>' : ''}<button type="button" class="btn" data-a="close">Schließen</button></div></div>`;
    }
    h += `<p class="hint2" style="margin:4px 0 8px">${nDone()} von ${D.tasks.length} Aufgaben gelöst. ${exam() ? '🎓 Prüfmodus ist an.' : 'Im Prüfmodus (🎓) zählen Tipps als Abzug.'}</p>`;
    h += taskListHTML(S.filter, done(), lsGet('prog', {}));
    const keep = $('#tkIn') && document.activeElement === $('#tkIn');
    taskView.innerHTML = h; if (top !== false) $('#pgTasks').scrollTop = 0; if (keep && $('#tkIn')) $('#tkIn').focus();
  }
  function checkTask() {
    const ctx = S.t; if (!ctx) return; const q = ctx.q, c = C.checkNum(ctx.ans, q.value, q.tol, q.unit);
    if (c.empty) { toast('Trage zuerst ein Ergebnis ein.'); return; }
    if (c.nan) { toast('Bitte gib eine Zahl ein (mit Komma oder Punkt).'); return; }
    ctx.res = { ok: c.ok, x: c.x }; const pct = c.ok ? pctFor(ctx.id) : 0;
    if (c.ok) { markSolved(ctx.id, pct); const F = fx(); if (F && F.pass) try { F.pass(pct); } catch (e) { ding(); } else ding(); toast(exam() && pct < 100 ? pct + ' % (Tipps abgezogen)' : '🎉 Geschafft!'); }
    else { sad(); toast('Noch nicht richtig. Lies den Tipp und versuche es noch einmal.'); }
    renderTasks(false);
  }
  function hintTask() {
    const ctx = S.t; if (!ctx) return; const id = ctx.id, h = lsGet('hints', {}), n = Math.min(3, (h[id] || 0) + 1);
    h[id] = n; lsSet('hints', h); ctx.tip = n;
    if (exam()) { const c = lsGet('ctipps', {}); c[id] = Math.max(c[id] || 0, n); lsSet('ctipps', c); }
    sheet('Tipp, Stufe ' + n + ' von 3', b => { b.innerHTML = tipHTML(ctx.q, n); });
  }
  taskView.addEventListener('input', e => { if (e.target.matches('[data-v]') && S.t) S.t.ans = e.target.value; });
  taskView.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[data-v]')) { e.preventDefault(); if (S.t && !(S.t.res && (S.t.res.ok || S.t.res.shown))) checkTask(); } });
  taskView.addEventListener('click', e => {
    const f = e.target.closest('[data-f]'); if (f) { S.filter = f.dataset.f; lsSet('filter', S.filter); renderTasks(false); return; }
    const row = e.target.closest('.row[data-t]'); if (row) { startTask(row.dataset.t); return; }
    const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
    if (a === 'chk') checkTask(); else if (a === 'hint') hintTask();
    else if (a === 'show') { if (S.t) { S.t.res = { ok: false, shown: true, x: NaN }; renderTasks(false); } }
    else if (a === 'neu') { if (S.t) startTask(S.t.id, (S.tv[S.t.id] || 0) + 1); }
    else if (a === 'close') { S.t = null; renderTasks(); }
    else if (a === 'next') { const list = D.tasks.filter(x => !S.filter || x.cat === S.filter), i = list.findIndex(x => x.id === S.t.id), nx = list.slice(i + 1).find(x => !done()[x.id]) || list[(i + 1) % list.length]; startTask(nx.id); }
  });

  /* ============================================================ DOM: Reiter, Kopfzeile, Leiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button type="button" class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'kenn'; stopPlay(); S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); if (on) { try { b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {} } });
    if (LABTABS.includes(t)) renderLab(t); else if (t === 'tasks') renderTasks(); else $('#helpView').innerHTML = helpHTML();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'Signale und Systeme<small>' + esc(T[2]) + '</small>'; document.title = 'Signale und Systeme: ' + T[2];
    const sc = $(LABTABS.includes(t) ? '#pgLab' : t === 'tasks' ? '#pgTasks' : '#pgHelp'); if (sc) sc.scrollTop = 0;
  }
  function setExam(on) { lsSet('exam', on ? '1' : '0'); updatePal(); $('#bExam').classList.toggle('on', on); $('#bExam').setAttribute('aria-pressed', on); toast(on ? '🎓 Prüfmodus an: Tipps kosten 25 % je Stufe.' : 'Prüfmodus aus: Tipps kosten nichts.'); if (S.tab === 'tasks') renderTasks(false); }
  let palSig = '';
  function updatePal() {
    const F = !!fx(), fxOn = F && !fx().isMuted(), sig = [F, fxOn, exam(), nDone()].join('|'); if (sig === palSig) return; palSig = sig;
    $('#pal').innerHTML = `${F ? `<button type="button" class="chip ${fxOn ? 'on' : ''}" data-a="fx" aria-pressed="${fxOn}" title="Effekte und Ton">${fxOn ? '🎉' : '🔇'} Effekte</button>` : ''}<button type="button" class="chip ${exam() ? 'on' : ''}" data-a="exam" aria-pressed="${exam()}" title="Prüfmodus: Tipps zählen als Abzug">🎓 Prüfmodus</button><button type="button" class="chip" data-a="rand" title="Zufällige offene Aufgabe">🎲 Zufallsaufgabe</button><span id="stat">Aufgaben gelöst <b>${nDone()}/${D.tasks.length}</b></span>`;
    $('#bExam').classList.toggle('on', exam());
  }
  $('#pal').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.a === 'fx') { const F = fx(); if (F) { F.setMuted(!F.isMuted()); palSig = ''; updatePal(); if (!F.isMuted()) ding(); } }
    else if (b.dataset.a === 'exam') setExam(!exam());
    else if (b.dataset.a === 'rand') { const open = D.tasks.filter(t => !done()[t.id]), pool = open.length ? open : D.tasks, t = pool[Math.floor(Math.random() * pool.length)]; S.filter = ''; setTab('tasks'); startTask(t.id, Math.floor(Math.random() * 1000)); }
  });
  $('#bTasks').onclick = () => setTab('tasks'); $('#bHelp').onclick = () => setTab('help'); $('#bExam').onclick = () => setExam(!exam());
  $('#title').onclick = () => setTab('kenn');
  $('#bMenu').onclick = () => {
    const rows = TABS.map(([k, i, n]) => [k, i + ' ' + n, k === 'tasks' ? D.tasks.length + ' Aufgaben mit Tipps und Musterlösung' : k === 'help' ? 'Spickzettel und Hinweise' : BLOCK(k).intro.split('. ')[0] + '.']).concat([['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']]);
    sheet('Menü', (b, close) => {
      b.innerHTML = rows.map(r => `<button type="button" class="row" data-m="${esc(r[0])}"><span class="grow"><b>${esc(r[1])}</b><small>${esc(r[2])}</small></span></button>`).join('');
      b.addEventListener('click', e => { const r = e.target.closest('.row'); if (!r) return; close(); const m = r.dataset.m; if (m === 'home') location.href = 'index.html'; else if (m === 'exam') setExam(!exam()); else if (m === 'reset') resetAll(); else setTab(m); });
    });
  };
  function resetAll() {
    sheet('Fortschritt zurücksetzen?', (b, close) => {
      b.innerHTML = '<p style="margin-top:0">Alle gelösten Aufgaben und Tipps dieses Labs werden auf diesem Gerät gelöscht. Das kann nicht rückgängig gemacht werden.</p><div class="btns"><button type="button" class="btn" data-x="no">Abbrechen</button><button type="button" class="btn danger" data-x="yes">Löschen</button></div>';
      b.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (!x) return; if (x.dataset.x === 'yes') { ['done', 'prog', 'hints', 'ctipps'].forEach(k => { try { localStorage.removeItem(LS + k); } catch (er) {} }); S.t = null; palSig = ''; updatePal(); updateBadge(); if (S.tab === 'tasks') renderTasks(); toast('Fortschritt gelöscht'); } close(); });
    });
  }

  /* Neuzeichnen bei Größen- und Themenwechsel */
  root.addEventListener('resize', schedule);
  try { if (root.ResizeObserver) new root.ResizeObserver(schedule).observe(labView); } catch (e) {}
  try { const mq = root.matchMedia('(prefers-color-scheme: dark)'); (mq.addEventListener ? mq.addEventListener('change', schedule) : mq.addListener && mq.addListener(schedule)); } catch (e) {}
  try { new MutationObserver(schedule).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); } catch (e) {}

  /* Schnittstelle für Karriere/Lernpfad */
  root.SIG_LAB = { id: 'sig', title: 'Signale und Systeme', stufe: D.meta.stufe, doneKey: LS + 'done', progKey: LS + 'prog', total: D.tasks.length, done: () => Object.keys(done()).filter(k => D.tasks.some(t => t.id === k)), tasks: root.SIG_TASKS };
  root.LabGoto = id => { try { if (D.tasks.some(t => t.id === id)) { setTab('tasks'); startTask(id); return true; } } catch (e) {} return false; };

  loadLab(); S.filter = lsGet('filter', '') || ''; if (S.filter && !D.CATS.includes(S.filter)) S.filter = '';
  const st0 = lsGet('tab', 'kenn'); S.tab = TABS.some(x => x[0] === st0) ? st0 : 'kenn';
  buildTabs(); updatePal(); setTab(S.tab);
  try {
    const qs = new URLSearchParams(location.search), qa = qs.get('aufgabe'), qt = qs.get('tab');
    if (qa && D.tasks.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); } else if (qt && TABS.some(x => x[0] === qt)) setTab(qt);
  } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
