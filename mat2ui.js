'use strict';
/* Tonfunk Mathe-Brücke: Oberfläche (Lab-Kennung 'mat2', Stufe 'studium').
   Reiter: Komplex, Matrizen, DGL, Laplace, Fourier, Aufgaben, Trainer, Hilfe.
   Module: mat2core.js (MAT2_CORE), mat2data.js (MAT2_DATA, MAT2_TASKS), mat2viz.js (MAT2_VIZ).
   Speicher (Präfix lm4.mat2.): tab, cx, mx, de, lp, fo, done ({id:true} nur gelöste), prog ({id:Prozent}), hints, ctipps (nur Prüfmodus), exam ('1'), rt (Trainer).
   Tipp-Abzug (25 % je Stufe, höchstens 3 Stufen) gibt es nur im Prüfmodus; beim normalen Üben kosten Tipps nichts.
   Aufruf: mat2lab.html?aufgabe=mat2cx1 öffnet die Aufgabe. */
(function (root) {
  const C = root.MAT2_CORE, D = root.MAT2_DATA, V = root.MAT2_VIZ;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.mat2.';
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
  if (!C || !D || !V) {
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>Mathe-Brücke</h4><p class="big">Dateien fehlen</p><p class="hint2">mat2core.js, mat2data.js oder mat2viz.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks;

  /* ============================================================ Zustand */
  const TABS = [['cx', '∠', 'Komplex'], ['mx', '▦', 'Matrizen'], ['de', '∫', 'DGL'], ['lp', 'ℒ', 'Laplace'], ['fo', '∿', 'Fourier'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['help', '📘', 'Hilfe']];
  const NETP = {}; Object.keys(V.NETS).forEach(k => { NETP[k] = {}; V.NETS[k].params.forEach(a => { NETP[k][a[0]] = String(a[3]).replace('.', ','); }); });
  const S = {
    tab: lsGet('tab', 'cx'),
    cx: Object.assign({ R: 47, L: 0.01, C: 1e-6, f: 1500, U: 10, a: '3 + j4', b: '1 − j2', op: 'mul' }, lsGet('cx', {})),
    mx: Object.assign({ net: 'div2', p: NETP, gn: 3, g: [['2', '1', '0'], ['1', '3', '1'], ['0', '1', '2']], gb: ['5', '10', '7'] }, lsGet('mx', {})),
    de: Object.assign({ mode: 'rlc', R: 20, L: 0.01, C: 1e-6, U: 10, Rr: 1000, Cr: 1e-6, Lr: 0.1, Rl: 100 }, lsGet('de', {})),
    lp: Object.assign({ pre: 'pt2', K: '1', T: '2', w0: '10', D: '0,3', num: '1', den: '1 2 100', cs: 'expsin', ca: '2', cw: '3', cs0: '2' }, lsGet('lp', {})),
    fo: Object.assign({ kind: 'square', A: 5, N: 9 }, lsGet('fo', {})),
    task: null, tq: null, tAns: {}, tRes: null,
    tr: { q: null, ans: {}, res: null, level: 0, topic: '' },
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {}))
  };
  /* gespeicherte Netzparameter ergänzen (neue Voreinstellungen, geänderte Struktur) */
  Object.keys(NETP).forEach(k => { S.mx.p[k] = Object.assign({}, NETP[k], S.mx.p[k] || {}); });
  if (!V.NETS[S.mx.net]) S.mx.net = 'div2';
  if (!Array.isArray(S.mx.g) || S.mx.g.length !== 3) { S.mx.g = [['2', '1', '0'], ['1', '3', '1'], ['0', '1', '2']]; S.mx.gb = ['5', '10', '7']; }
  const R0 = (() => { const m = /[?&]seed=([^&]+)/.exec(location.search); return C.rng(m ? decodeURIComponent(m[1]) : String(Math.random()) + Date.now()); })();

  /* ============================================================ Bausteine */
  const box = (t, fm, res, cls) => `<div class="rdout ${cls || ''}"><span class="st">${esc(t)}</span>${fm ? esc(fm) + ' = ' : ''}<b>${esc(res)}</b></div>`;
  const note = (t, cls) => `<div class="rdout ${cls || 'warn'}">${esc(t)}</div>`;
  const inp = (attr, label, val, unit, extra) => `<label class="f"><span>${esc(label)}${unit ? ' (' + esc(unit) + ')' : ''}</span><input ${attr} inputmode="decimal" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(val)}"${extra || ''}></label>`;
  const wOf = el => { const w = el && el.clientWidth; return w > 120 ? w : Math.max(280, Math.min(1076, (window.innerWidth || 360) - 24)); };
  const roundSig = (v, n) => { if (!isFinite(v) || v === 0) return v; const e = Math.floor(Math.log10(Math.abs(v))); const m = Math.pow(10, n - 1 - e); return Math.round(v * m) / m; };
  /* Regler (linear oder logarithmisch), der Wert liegt im Zustand; Position 0 bis 1000 */
  const posOf = (v, min, max, log) => Math.round((log ? (Math.log(v / min) / Math.log(max / min)) : (v - min) / (max - min)) * 1000);
  const valOf = (pos, min, max, log) => roundSig(log ? min * Math.pow(max / min, pos / 1000) : min + (max - min) * pos / 1000, 3);
  const slider = (st, k, label, val, min, max, log, fmt) => `<label class="f"><span>${esc(label)}: <b data-sv="${st}.${k}">${esc(fmt(val))}</b></span><input type="range" data-sl="${st}.${k}" data-min="${min}" data-max="${max}" data-log="${log ? 1 : 0}" min="0" max="1000" step="1" value="${Math.min(1000, Math.max(0, posOf(val, min, max, log)))}" aria-label="${esc(label)}"></label>`;
  const eng = (v, u) => D.eng(v, u);
  const sub = s => s;
  const matHtml = (A, b, hl) => `<table class="mat"><tbody>${A.map((r, i) => `<tr>${r.map((v, j) => `<td class="${hl && hl[0] === i && hl[1] === j ? 'hl' : ''}">${esc(f(v, 4))}</td>`).join('')}${b ? `<td class="sep">|</td><td>${esc(f(b[i], 4))}</td>` : ''}</tr>`).join('')}</tbody></table>`;
  const chartDiv = (id, label) => `<div class="inst" id="${id}" aria-label="${esc(label)}"></div>`;
  const setSvg = (id, html, emptyText) => { const e = $('#' + id); if (!e) return; e.innerHTML = html || `<p class="hint2" style="padding:10px">${esc(emptyText || 'Für diese Werte gibt es kein Diagramm.')}</p>`; };
  const explain = k => `<details class="ex" ${lsGet('ex_' + k, true) ? 'open' : ''} data-ex="${k}"><summary>Erklärung</summary><div class="hb2">${D.explain[k]}</div></details>`;
  document.addEventListener('toggle', e => { const d = e.target; if (d && d.dataset && d.dataset.ex) lsSet('ex_' + d.dataset.ex, d.open); }, true);

  /* gemeinsamer Regler-Handler für alle Reiter */
  document.addEventListener('input', e => {
    const el = e.target; if (!el.dataset || !el.dataset.sl) return;
    const [st, k] = el.dataset.sl.split('.'), v = valOf(+el.value, +el.dataset.min, +el.dataset.max, el.dataset.log === '1');
    S[st][k] = v; lsSet(st, S[st]); const lab = $(`[data-sv="${el.dataset.sl}"]`); if (lab) lab.textContent = SLF[el.dataset.sl] ? SLF[el.dataset.sl](v) : f(v, 3);
    UPD[st] && UPD[st]();
  });
  const UPD = {};
  const SLF = {
    'cx.R': v => f(v, 2) + ' Ω', 'cx.L': v => eng(v, 'H'), 'cx.C': v => eng(v, 'F'), 'cx.f': v => eng(v, 'Hz'), 'cx.U': v => f(v, 2) + ' V',
    'de.R': v => f(v, 2) + ' Ω', 'de.L': v => eng(v, 'H'), 'de.C': v => eng(v, 'F'), 'de.U': v => f(v, 2) + ' V', 'de.Rr': v => eng(v, 'Ω'), 'de.Cr': v => eng(v, 'F'), 'de.Lr': v => eng(v, 'H'), 'de.Rl': v => eng(v, 'Ω'),
    'fo.A': v => f(v, 2) + ' V', 'fo.N': v => f(v, 0)
  };

  /* ============================================================ Komplex */
  function cxCalc() {
    const a = C.parseComplex(S.cx.a), b = C.parseComplex(S.cx.b), op = S.cx.op, bad = z => !Number.isFinite(z.re) || !Number.isFinite(z.im);
    const show = (n, z) => `<tr><td>${n}</td><td>${esc(C.fmtCart(z, 3))}</td><td>${esc(C.fmtPolar(z, 3))}</td></tr>`;
    const unary = op === 'conj' || op === 'inv';
    if (bad(a)) return note('Eingabe a nicht lesbar. Beispiele: 3 + j4, −2,5 − j1, 10∠30 (polar mit ∠ oder <).');
    if (!unary && bad(b)) return note('Eingabe b nicht lesbar. Beispiele: 3 + j4, −2,5 − j1, 10∠30 (polar mit ∠ oder <).');
    let r, steps = [], name;
    const pa = C.fmtPolar(a, 3), pb = C.fmtPolar(b, 3);
    if (op === 'add') { r = C.cadd(a, b); name = 'a + b'; steps = ['Real- und Imaginärteile getrennt addieren.', `Re: ${f(a.re, 3)} + ${f(b.re, 3)} = ${f(r.re, 3)}`, `Im: ${f(a.im, 3)} + ${f(b.im, 3)} = ${f(r.im, 3)}`]; }
    else if (op === 'sub') { r = C.csub(a, b); name = 'a − b'; steps = ['Real- und Imaginärteile getrennt subtrahieren.', `Re: ${f(a.re, 3)} − ${f(b.re, 3)} = ${f(r.re, 3)}`, `Im: ${f(a.im, 3)} − ${f(b.im, 3)} = ${f(r.im, 3)}`]; }
    else if (op === 'mul') {
      r = C.cmul(a, b); name = 'a · b';
      steps = ['Polar: Beträge multiplizieren, Winkel addieren.', `|a|·|b| = ${f(C.cabs(a), 4)} · ${f(C.cabs(b), 4)} = ${f(C.cabs(r), 4)}`, `φa + φb = ${f(C.carg(a), 3)}° + ${f(C.carg(b), 3)}° = ${f(C.carg(a) + C.carg(b), 3)}° (≙ ${f(C.wrap180(C.carg(a) + C.carg(b)), 3)}°)`, `Kartesisch gerechnet: (${f(a.re, 3)}·${f(b.re, 3)} − ${f(a.im, 3)}·${f(b.im, 3)}) + j(${f(a.re, 3)}·${f(b.im, 3)} + ${f(a.im, 3)}·${f(b.re, 3)}) = ${f(r.re, 3)} + j${f(r.im, 3)}`];
    } else if (op === 'div') {
      if (C.cabs(b) === 0) return note('Durch 0 kann nicht geteilt werden (b = 0).', 'bad');
      r = C.cdiv(a, b); name = 'a / b';
      steps = ['Polar: Beträge dividieren, Winkel subtrahieren.', `|a|/|b| = ${f(C.cabs(a), 4)} / ${f(C.cabs(b), 4)} = ${f(C.cabs(r), 4)}`, `φa − φb = ${f(C.carg(a), 3)}° − ${f(C.carg(b), 3)}° = ${f(C.carg(a) - C.carg(b), 3)}° (≙ ${f(C.wrap180(C.carg(a) - C.carg(b)), 3)}°)`, `Kartesisch: mit dem konjugierten Nenner erweitern, Nenner |b|² = ${f(C.cabs(b) ** 2, 4)}.`];
    } else if (op === 'conj') { r = C.cconj(a); name = 'a*'; steps = ['Konjugiert komplex: das Vorzeichen des Imaginärteils (bzw. des Winkels) wechselt.']; }
    else { if (C.cabs(a) === 0) return note('Der Kehrwert von 0 existiert nicht.', 'bad'); r = C.cinv(a); name = '1 / a'; steps = ['Kehrwert: Betrag 1/|a|, Winkel −φa. Das ist die Admittanz zu einer Impedanz.', `1/|a| = ${f(1 / C.cabs(a), 5)}, −φa = ${f(-C.carg(a), 3)}°`]; }
    return `<div class="tw"><table class="tt"><tr><th>Größe</th><th>kartesisch</th><th>polar</th></tr>${show('a', a)}${unary ? '' : show('b', b)}${show('<b>' + name + '</b>', r)}</table></div><div class="rdout ok"><span class="st">Rechenweg</span>${steps.map(s => esc(s)).join('<br>')}</div>`;
  }
  function renderCx() {
    const s = S.cx;
    $('#cxView').innerHTML = explain('cx') + `<div class="card pl"><h4>Zeigerdiagramm und Resonanz (Reihenschaltung R, L, C)</h4>
      <div class="cols"><div>${slider('cx', 'R', 'Widerstand R', s.R, 1, 1000, true, SLF['cx.R'])}${slider('cx', 'L', 'Induktivität L', s.L, 1e-4, 1, true, SLF['cx.L'])}${slider('cx', 'C', 'Kapazität C', s.C, 1e-8, 1e-5, true, SLF['cx.C'])}${slider('cx', 'f', 'Frequenz f', s.f, 10, 20000, true, SLF['cx.f'])}${slider('cx', 'U', 'Spannung U (Effektivwert)', s.U, 1, 230, true, SLF['cx.U'])}
      <div class="btns"><button class="btn" data-cx="f0">Auf Resonanz stellen (f = f₀)</button></div></div>
      <div id="cxOut"></div></div></div>
      <div class="card pl"><h4>Zeigerdiagramm</h4>${chartDiv('cxPh', 'Zeigerdiagramm')}<p class="hint2">Der Strom ist die waagerechte Bezugsrichtung. Die Spannung an der Spule eilt ihm um 90° vor (nach oben), die am Kondensator um 90° nach (nach unten); beide wirken gegeneinander.</p></div>
      <div class="card pl"><h4>Resonanzkurve</h4>${chartDiv('cxRes', 'Resonanzkurve')}<p class="hint2">Der Strom ist bei f₀ am größten. Die waagerechte Linie bei I_max/√2 begrenzt die Bandbreite.</p></div>
      <div class="card pl"><h4>Rechner: kartesisch und polar</h4><div class="dsrow">${inp('data-cc="a"', 'a (z. B. 3 + j4 oder 5∠53,13)', s.a, '')}${inp('data-cc="b"', 'b', s.b, '')}</div>
      <div class="fbar"><div class="seg" role="group" aria-label="Rechenart">${[['add', 'a + b'], ['sub', 'a − b'], ['mul', 'a · b'], ['div', 'a / b'], ['conj', 'a*'], ['inv', '1/a']].map(o => `<button data-op="${o[0]}" class="${s.op === o[0] ? 'on' : ''}" aria-pressed="${s.op === o[0]}">${o[1]}</button>`).join('')}</div></div><div id="cxCalc"></div>
      <p class="hint2">Eingabe kartesisch (3 + j4, 3−4j, j2) oder polar (5∠53,13 oder 5&lt;53,13); Dezimalkomma oder Punkt. Winkel in Grad.</p></div>`;
    updateCx(); $('#cxCalc').innerHTML = cxCalc();
  }
  function updateCx() {
    const s = S.cx, z = C.zSeries(s.R, s.L, s.C, s.f), I = s.U / C.cabs(z), f0 = C.f0(s.L, s.C), Q = C.qSeries(s.R, s.L, s.C), xl = C.XL(s.f, s.L), xc = C.XC(s.f, s.C);
    const kind = Math.abs(z.im) < 1e-6 * Math.max(1, z.re) ? 'Resonanz: rein ohmsch' : z.im > 0 ? 'induktiv (Strom eilt nach)' : 'kapazitiv (Strom eilt vor)';
    if ($('#cxOut')) $('#cxOut').innerHTML = box('Blindwiderstände', 'X_L = 2π·f·L,  X_C = 1/(2π·f·C)', f(xl, 2) + ' Ω  und  ' + f(xc, 2) + ' Ω') + box('Gesamtimpedanz', 'Z = R + j(X_L − X_C)', C.fmtCart(z, 2) + ' Ω  =  ' + C.fmtPolar(z, 2).replace('∠', '∠') + ' Ω', 'ok') + box('Strom (Effektivwert)', 'I = U / |Z|', f(I * 1000, 2) + ' mA  (' + kind + ')') + box('Resonanz', 'f₀ = 1/(2π√(LC)),  Q = (1/R)·√(L/C),  B = f₀/Q', f(f0, 1) + ' Hz,  Q = ' + f(Q, 2) + ',  B = ' + f(C.bandwidth(f0, Q), 1) + ' Hz');
    setSvg('cxPh', V.phasorSvg({ R: s.R, L: s.L, C: s.C, f: s.f, U: s.U }, wOf($('#cxPh'))));
    setSvg('cxRes', V.resonanceSvg({ R: s.R, L: s.L, C: s.C, f: s.f, U: s.U }, wOf($('#cxRes'))));
  }
  UPD.cx = updateCx;
  $('#cxView').addEventListener('input', e => { const k = e.target.dataset.cc; if (!k) return; S.cx[k] = e.target.value; lsSet('cx', S.cx); $('#cxCalc').innerHTML = cxCalc(); });
  $('#cxView').addEventListener('click', e => {
    const o = e.target.closest('[data-op]'), b = e.target.closest('[data-cx]');
    if (o) { S.cx.op = o.dataset.op; lsSet('cx', S.cx); $$('[data-op]').forEach(x => { x.classList.toggle('on', x === o); x.setAttribute('aria-pressed', x === o); }); $('#cxCalc').innerHTML = cxCalc(); }
    else if (b && b.dataset.cx === 'f0') { const f0 = C.f0(S.cx.L, S.cx.C); if (f0 >= 10 && f0 <= 20000) { S.cx.f = roundSig(f0, 4); lsSet('cx', S.cx); renderCx(); } else toast('Die Resonanzfrequenz (' + f(f0, 0) + ' Hz) liegt außerhalb des Reglerbereichs 10 Hz bis 20 kHz. Ändere L oder C.'); }
  });

  /* ============================================================ Matrizen */
  const NU = { kΩ: 'kΩ' };
  function mxNet() {
    const pre = V.NETS[S.mx.net], raw = S.mx.p[pre.k], p = {}; let bad = '';
    pre.params.forEach(a => { const v = P(raw[a[0]]); if (!Number.isFinite(v)) bad = 'Bitte alle Werte als Zahlen eingeben.'; else if (a[0] !== 'E' && a[0] !== 'U' && a[0] !== 'I' && !(v > 0)) bad = 'Widerstände müssen größer als 0 sein.'; p[a[0]] = v; });
    return { pre, p, bad };
  }
  const SUB = ['', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];
  function mxOut() {
    const { pre, p, bad } = mxNet(); if (bad) { setSvg('mxSvg', ''); return note(bad); }
    const net = pre.build(p); let sol, fixedTxt = '';
    if (pre.fixed) { sol = C.nodalFixed(net, pre.fixed.node, p[pre.fixed.key]); fixedTxt = `Knoten ${pre.fixed.node} ist durch die Quelle festgelegt: V${SUB[pre.fixed.node]} = ${f(p[pre.fixed.key], 3)} V. Nur die übrigen Knoten sind Unbekannte.`; }
    else sol = C.nodalSolve(net);
    if (!sol.ok) { setSvg('mxSvg', V.netSvg(pre, p, null, wOf($('#mxSvg')))); return note('Das System ist nicht lösbar (die Leitwertmatrix ist singulär, zum Beispiel weil ein Teilnetz keine Verbindung zum Bezugsknoten hat).', 'bad'); }
    const fullSol = { ok: true, V: sol.V, Ibr: sol.Ibr }; setSvg('mxSvg', V.netSvg(pre, p, fullSol, wOf($('#mxSvg'))));
    const idx = pre.fixed ? sol.idx : [...Array(net.n).keys()], names = idx.map(i => 'V' + SUB[i + 1]);
    const sys = sol.sys, g = sol.gauss;
    let h = '';
    h += `<details class="st" open><summary>1. Knoten wählen, Leitwerte bestimmen</summary><div class="hb2"><p>Der Bezugsknoten 0 (Masse) hat 0 V. ${esc(fixedTxt)}</p><p>Leitwerte in mS (1/kΩ): ${net.br.map((z, i) => `G${SUB[i + 1]} = 1/${f(z.R, 3)} kΩ = ${f(1 / z.R, 4)} mS`).join('; ')}.</p>${net.br.some(z => z.E) ? '<p>Eine Quelle E mit Reihenwiderstand R wird zur Stromquelle I = E/R = ' + net.br.filter(z => z.E).map(z => f(z.E, 2) + ' V / ' + f(z.R, 3) + ' kΩ = ' + f(z.E / z.R, 4) + ' mA').join('; ') + ' (Pfeil in den Knoten) mit parallelem Leitwert 1/R.</p>' : ''}</div></details>`;
    h += `<details class="st" open><summary>2. Gleichungssystem G · V = I aufstellen</summary><div class="hb2"><p>Hauptdiagonale: Summe der Leitwerte am Knoten. Nebendiagonale: negativer Leitwert zwischen den beiden Knoten. Rechte Seite: Quellenströme in den Knoten.</p>${matHtml(sys.G, sys.I)}<p class="hint2">Unbekannte: ${esc(names.join(', '))} (Matrix in mS, rechte Seite in mA).</p></div></details>`;
    h += `<details class="st"><summary>3. Gauss-Eliminierung (Schritt für Schritt)</summary><div class="hb2">${g.steps.map(st => `<p><b>${esc(st.text)}</b></p>${matHtml(st.A, st.b)}`).join('')}<p>Rückwärts einsetzen: ${esc(names.map((n, i) => n + ' = ' + f(g.x[i], 4) + ' V').reverse().join(',  '))}.</p></div></details>`;
    h += `<details class="st" open><summary>4. Ergebnis</summary><div class="hb2">${net.n ? [...Array(net.n).keys()].map(i => box('Potenzial Knoten ' + (i + 1), '', f(sol.V[i], 4) + ' V', 'ok')).join('') : ''}${net.br.map((z, i) => `<div class="rdout"><span class="st">Zweig ${esc(pre.names.br[i])}: I = (V<sub>a</sub> − V<sub>b</sub> ${z.E ? '− E' : ''}) / R</span><b>${esc(f(sol.Ibr[i], 4))} mA</b> von Knoten ${z.a} nach Knoten ${z.b}</div>`).join('')}</div></details>`;
    const ck = C.nodalChecks(net, pre.fixed ? { ok: true, V: sol.V, Ibr: sol.Ibr } : sol);
    let kc = 0; if (pre.fixed) { const res = new Array(net.n).fill(0), add = (k, v) => { if (k > 0) res[k - 1] += v; }; net.br.forEach((z, i) => { add(z.a, -sol.Ibr[i]); add(z.b, sol.Ibr[i]); }); kc = Math.max.apply(null, res.filter((_, i) => i + 1 !== pre.fixed.node).map(Math.abs)); } else kc = ck.kcl;
    h += `<details class="st"><summary>5. Kontrolle</summary><div class="hb2"><p>Knotenregel: größter Reststrom an einem Knoten (ohne die Quelle) = ${esc(C.fmtSig(kc, 2))} mA, soll 0 sein.</p>${pre.fixed ? `<p>Die Quelle gibt ${esc(f(p[pre.fixed.key] * C.sourceCurrent(net, sol, pre.fixed.node), 4))} mW ab; die Widerstände setzen ${esc(f(net.br.reduce((s, z, i) => s + sol.Ibr[i] * sol.Ibr[i] * z.R, 0), 4))} mW um.</p>` : `<p>Leistungsbilanz: Quellen geben ${esc(f(ck.pSrc, 4))} mW ab, Widerstände setzen ${esc(f(ck.pDiss, 4))} mW um.</p>`}</div></details>`;
    return h;
  }
  function lgsOut() {
    const n = S.mx.gn, A = [], b = []; let bad = false;
    for (let i = 0; i < n; i++) { A.push([]); for (let j = 0; j < n; j++) { const v = P(S.mx.g[i][j]); if (!Number.isFinite(v)) bad = true; A[i].push(v); } const w = P(S.mx.gb[i]); if (!Number.isFinite(w)) bad = true; b.push(w); }
    if (bad) return note('Bitte alle Felder als Zahlen ausfüllen.');
    const d = C.det(A), g = C.gauss(A, b); let h = box('Determinante', 'det A', f(d, 4), Math.abs(d) < 1e-9 ? 'bad' : 'ok');
    if (!g.ok) return h + note('det A = 0 (oder fast 0): Das System hat keine eindeutige Lösung. Die Zeilen sind linear abhängig oder widersprechen sich.', 'bad');
    h += `<div class="rdout ok"><span class="st">Lösung (Gauss)</span>${g.x.map((x, i) => `x${SUB[i + 1]} = <b>${esc(f(x, 5))}</b>`).join(',&nbsp; ')}</div>`;
    const cr = C.cramer(A, b); if (cr.length) h += `<p class="hint2">Kontrolle mit der Cramerschen Regel: ${esc(cr.map((x, i) => 'x' + SUB[i + 1] + ' = ' + f(x, 5)).join(', '))}.</p>`;
    h += `<details class="st"><summary>Eliminierungsschritte</summary><div class="hb2">${g.steps.map(st => `<p><b>${esc(st.text)}</b></p>${matHtml(st.A, st.b)}`).join('')}</div></details>`;
    return h;
  }
  function renderMx() {
    const s = S.mx, pre = V.NETS[s.net], pv = s.p[pre.k];
    $('#mxView').innerHTML = explain('mx') + `<div class="card pl"><h4>Knotenpotenzialverfahren mit Schrittrechnung</h4>
      <div class="fbar"><div class="seg" role="group" aria-label="Netzwerk">${Object.keys(V.NETS).map(k => `<button data-net="${k}" class="${s.net === k ? 'on' : ''}" aria-pressed="${s.net === k}">${esc(V.NETS[k].name.split(' (')[0])}</button>`).join('')}</div></div>
      <p class="hint2" style="margin-top:0">${esc(pre.name)}. Alle Widerstände in kΩ, Ströme in mA, Spannungen in V.</p>
      <div class="dsrow">${pre.params.map(a => inp(`data-np="${a[0]}"`, a[1], pv[a[0]], a[2])).join('')}</div>${chartDiv('mxSvg', 'Schaltbild')}</div><div id="mxOut"></div>
      <div class="card pl"><h4>Gleichungssystem lösen (Gauss, Cramer)</h4><div class="fbar"><div class="seg" role="group" aria-label="Größe">${[2, 3].map(n => `<button data-gn="${n}" class="${s.gn === n ? 'on' : ''}" aria-pressed="${s.gn === n}">${n} × ${n}</button>`).join('')}</div></div>
      <div class="lgs">${[...Array(s.gn).keys()].map(i => `<div class="lgsr">${[...Array(s.gn).keys()].map(j => `<input data-g="${i},${j}" inputmode="decimal" autocomplete="off" aria-label="a${i + 1}${j + 1}" value="${esc(s.g[i][j])}">`).join('')}<span class="eqs">=</span><input data-gb="${i}" inputmode="decimal" autocomplete="off" aria-label="b${i + 1}" value="${esc(s.gb[i])}"></div>`).join('')}</div><div id="lgsOut"></div></div>`;
    updateMx(); $('#lgsOut').innerHTML = lgsOut();
  }
  function updateMx() { $('#mxOut').innerHTML = mxOut(); }
  UPD.mx = updateMx;
  $('#mxView').addEventListener('input', e => {
    const np = e.target.dataset.np, g = e.target.dataset.g, gb = e.target.dataset.gb;
    if (np) { S.mx.p[S.mx.net][np] = e.target.value; lsSet('mx', S.mx); updateMx(); }
    else if (g) { const [i, j] = g.split(',').map(Number); S.mx.g[i][j] = e.target.value; lsSet('mx', S.mx); $('#lgsOut').innerHTML = lgsOut(); }
    else if (gb != null) { S.mx.gb[+gb] = e.target.value; lsSet('mx', S.mx); $('#lgsOut').innerHTML = lgsOut(); }
  });
  $('#mxView').addEventListener('click', e => {
    const n = e.target.closest('[data-net]'), g = e.target.closest('[data-gn]');
    if (n) { S.mx.net = n.dataset.net; lsSet('mx', S.mx); renderMx(); } else if (g) { S.mx.gn = +g.dataset.gn; lsSet('mx', S.mx); renderMx(); }
  });

  /* ============================================================ DGL */
  function deParams() { const s = S.de; return s.mode === 'rc' ? { R: s.Rr, C: s.Cr, U: s.U, L: 1 } : s.mode === 'rl' ? { R: s.Rl, L: s.Lr, U: s.U, C: 1 } : { R: s.R, L: s.L, C: s.C, U: s.U }; }
  function deOut() {
    const s = S.de, p = deParams(); let h = '';
    if (s.mode === 'rc') { const tau = C.tauRC(p.R, p.C); h += box('Zeitkonstante', 'τ = R·C', f(tau * 1000, 3) + ' ms', 'ok') + box('Zeit bis 63,2 % / 90 % / 99 %', 't = −τ·ln(1 − p)', f(tau * 1000, 3) + ' ms / ' + f(C.timeTo(0.9, tau) * 1000, 3) + ' ms / ' + f(C.timeTo(0.99, tau) * 1000, 3) + ' ms') + box('Ladestrom am Anfang', 'i(0) = U/R', f(p.U / p.R * 1000, 3) + ' mA') + `<p class="hint2">Lösung der DGL RC·u′ + u = U mit u(0) = 0: u(t) = U·(1 − e<sup>−t/τ</sup>). Nach 5·τ = ${esc(f(5 * tau * 1000, 2))} ms ist der Kondensator praktisch voll.</p>`; }
    else if (s.mode === 'rl') { const tau = C.tauRL(p.R, p.L); h += box('Zeitkonstante', 'τ = L/R', f(tau * 1000, 3) + ' ms', 'ok') + box('Endwert des Stroms', 'I∞ = U/R', f(p.U / p.R * 1000, 3) + ' mA') + box('Zeit bis 63,2 % / 99 %', 't = −τ·ln(1 − p)', f(tau * 1000, 3) + ' ms / ' + f(C.timeTo(0.99, tau) * 1000, 3) + ' ms') + `<p class="hint2">Lösung von (L/R)·i′ + i = U/R mit i(0) = 0: i(t) = (U/R)·(1 − e<sup>−t/τ</sup>).</p>`; }
    else {
      const I = C.rlcInfo(p.R, p.L, p.C), cs = { schwing: 'Schwingfall (D < 1)', grenz: 'Aperiodischer Grenzfall (D = 1)', kriech: 'Kriechfall (D > 1)' };
      h += box('Kenngrößen', 'α = R/(2L),  ω₀ = 1/√(LC),  D = α/ω₀', 'α = ' + f(I.alpha, 2) + ' 1/s,  ω₀ = ' + f(I.w0, 2) + ' 1/s,  D = ' + f(I.zeta, 3), 'ok') + box('Fall', 'D < 1 schwingt, D = 1 Grenzfall, D > 1 kriecht', cs[I.case]);
      if (I.case === 'schwing') h += box('Gedämpfte Schwingung', 'ω_d = √(ω₀² − α²)', f(I.wd, 1) + ' 1/s  (f_d = ' + f(I.fd, 1) + ' Hz, f₀ = ' + f(I.f0, 1) + ' Hz)') + box('Überschwingweite', 'ü = e^(−πD/√(1−D²))', f(I.overshoot, 2) + ' %  (Maximum nach ' + f(I.tpeak * 1000, 3) + ' ms)') + box('Wurzeln s₁,₂', 's = −α ± jω_d', '−' + f(I.alpha, 1) + ' ± j' + f(I.wd, 1) + ' 1/s');
      else h += box('Wurzeln', 's₁,₂ = −α ± √(α² − ω₀²)', f(I.s1.re, 2) + ' 1/s  und  ' + f(I.s2.re, 2) + ' 1/s');
      h += box('Kritischer Widerstand', 'R_krit = 2·√(L/C)', f(I.Rkrit, 2) + ' Ω  (aktuell R = ' + f(p.R, 2) + ' Ω)');
    }
    return h;
  }
  function renderDe() {
    const s = S.de;
    $('#deView').innerHTML = explain('de') + `<div class="card pl"><h4>Sprungantwort: Glied wählen und Werte einstellen</h4>
      <div class="fbar"><div class="seg" role="group" aria-label="Schaltung">${[['rc', 'RC-Glied'], ['rl', 'RL-Glied'], ['rlc', 'RLC-Kreis']].map(m => `<button data-dm="${m[0]}" class="${s.mode === m[0] ? 'on' : ''}" aria-pressed="${s.mode === m[0]}">${m[1]}</button>`).join('')}</div></div>
      <div class="cols"><div>${s.mode === 'rc' ? slider('de', 'Rr', 'Widerstand R', s.Rr, 100, 100000, true, SLF['de.Rr']) + slider('de', 'Cr', 'Kapazität C', s.Cr, 1e-7, 1e-4, true, SLF['de.Cr']) : s.mode === 'rl' ? slider('de', 'Rl', 'Widerstand R', s.Rl, 10, 10000, true, SLF['de.Rl']) + slider('de', 'Lr', 'Induktivität L', s.Lr, 1e-3, 1, true, SLF['de.Lr']) : slider('de', 'R', 'Widerstand R', s.R, 1, 2000, true, SLF['de.R']) + slider('de', 'L', 'Induktivität L', s.L, 1e-3, 0.1, true, SLF['de.L']) + slider('de', 'C', 'Kapazität C', s.C, 1e-7, 1e-5, true, SLF['de.C'])}
      ${slider('de', 'U', 'Sprunghöhe U', s.U, 1, 24, false, SLF['de.U'])}</div><div id="deOut"></div></div></div>
      <div class="card pl"><h4>${s.mode === 'rlc' ? 'Kondensatorspannung u_C(t)' : s.mode === 'rc' ? 'Kondensatorspannung u_C(t) beim Aufladen' : 'Strom i(t) nach dem Einschalten'}</h4>${chartDiv('deSvg', 'Kurvenplot')}${s.mode === 'rlc' ? '<p class="hint2">Gestrichelt: Hüllkurve des Abklingens. Beim Schwingfall steigt die Spannung über den Endwert; beim Kriechfall und im Grenzfall bleibt sie darunter.</p>' : '<p class="hint2">Waagerechte Linie: 63,2 % des Endwerts, senkrecht: τ. Nach 5·τ ist der Endwert praktisch erreicht.</p>'}</div>`;
    updateDe();
  }
  function updateDe() { $('#deOut').innerHTML = deOut(); setSvg('deSvg', V.deSvg(S.de.mode, deParams(), wOf($('#deSvg')))); }
  UPD.de = updateDe;
  $('#deView').addEventListener('click', e => { const m = e.target.closest('[data-dm]'); if (m) { S.de.mode = m.dataset.dm; lsSet('de', S.de); renderDe(); } });

  /* ============================================================ Laplace */
  const LPRE = {
    pt1: { name: 'PT1 (Verzögerung)', fields: ['K', 'T'] }, pt2: { name: 'PT2 (Schwingungsglied)', fields: ['K', 'w0', 'D'] }, free: { name: 'Eigene Funktion', fields: ['num', 'den'] }
  };
  const LPL = { K: ['Verstärkung K', ''], T: ['Zeitkonstante T', 's'], w0: ['Eigenkreisfrequenz ω₀', 'rad/s'], D: ['Dämpfungsgrad D', ''], num: ['Zählerkoeffizienten (höchste Potenz zuerst)', ''], den: ['Nennerkoeffizienten (höchste Potenz zuerst)', ''] };
  function lpTf() {
    const s = S.lp;
    if (s.pre === 'pt1') { const K = P(s.K), T = P(s.T); if (!Number.isFinite(K) || !(T > 0)) return { err: 'K muss eine Zahl und T größer als 0 sein.' }; return { tf: { num: [K], den: [T, 1] }, txt: `H(s) = ${f(K, 3)} / (1 + ${f(T, 3)}·s)` }; }
    if (s.pre === 'pt2') { const K = P(s.K), w = P(s.w0), D = P(s.D); if (!Number.isFinite(K) || !(w > 0) || !(D >= 0)) return { err: 'K muss eine Zahl sein, ω₀ größer als 0 und D nicht negativ.' }; return { tf: { num: [K * w * w], den: [1, 2 * D * w, w * w] }, txt: `H(s) = ${f(K * w * w, 3)} / (s² + ${f(2 * D * w, 3)}·s + ${f(w * w, 3)})` }; }
    const nn = String(s.num).split(/[\s;]+/).filter(Boolean).map(P), dd = String(s.den).split(/[\s;]+/).filter(Boolean).map(P);
    if (!nn.length || !dd.length || nn.concat(dd).some(v => !Number.isFinite(v))) return { err: 'Koeffizienten durch Leerzeichen trennen, zum Beispiel 100 für den Zähler und 1 2 100 für s² + 2s + 100.' };
    if (dd.length > 5 || nn.length > dd.length) return { err: 'Der Nenner darf höchstens Grad 4 haben, der Zähler nicht mehr Glieder als der Nenner.' };
    const t = C.trimP(dd); if (t[0] === 0 || (t.length === 1)) return { err: 'Der Nenner braucht mindestens eine Potenz von s (Grad 1 oder höher).' };
    const term = (c, k) => (c === 0 ? '' : (c < 0 ? ' − ' : ' + ') + (Math.abs(c) === 1 && k > 0 ? '' : f(Math.abs(c), 3)) + (k === 0 ? '' : k === 1 ? 's' : 's^' + k));
    const poly = a => { const n = a.length - 1; return a.map((c, i) => term(c, n - i)).join('').replace(/^ \+ /, '').replace(/^ − /, '−') || '0'; };
    return { tf: { num: nn, den: dd }, txt: `H(s) = (${poly(nn)}) / (${poly(dd)})` };
  }
  function lpOut() {
    const r = lpTf(); if (r.err) { ['lpPz', 'lpStep', 'lpBode'].forEach(i => setSvg(i, '')); return note(r.err); }
    const tf = r.tf, P_ = C.tfPoles(tf), Z = C.tfZeros(tf), st = C.stability(P_), cz = z => (z.im === 0 ? f(z.re, 3) : f(z.re, 3) + (z.im > 0 ? ' + j' : ' − j') + f(Math.abs(z.im), 3));
    let h = `<div class="rdout ok"><span class="st">Übertragungsfunktion</span><b>${esc(r.txt)}</b></div>`;
    h += box('Pole (Nullstellen des Nenners)', '', P_.length ? P_.map(cz).join('   ;   ') + ' 1/s' : 'keine');
    h += box('Nullstellen (des Zählers)', '', Z.length ? Z.map(cz).join('   ;   ') + ' 1/s' : 'keine');
    h += box('Stabilität', 'alle Pole links der imaginären Achse?', { stabil: 'stabil', grenzstabil: P_.some(p => p.im !== 0 && Math.abs(p.re) < 1e-9) ? 'grenzstabil (Dauerschwingung)' : 'grenzstabil', instabil: 'instabil' }[st], st === 'stabil' ? 'ok' : st === 'instabil' ? 'bad' : 'warn');
    const dc = C.tfDC(tf); h += box('Verstärkung bei s = 0 (Endwert der Sprungantwort)', 'H(0)', st === 'stabil' && Number.isFinite(dc) ? f(dc, 4) : (Number.isFinite(dc) ? f(dc, 4) + ' (Endwertsatz gilt nur bei stabilen Systemen)' : 'nicht definiert'));
    if (P_.length === 2 && P_[0].im !== 0) { const w0 = Math.hypot(P_[0].re, P_[0].im); h += box('Schwingungsglied', 'D = −Re(s)/|s|,  ω₀ = |s|', 'D = ' + f(-P_[0].re / w0, 3) + ',  ω₀ = ' + f(w0, 3) + ' rad/s'); }
    setSvg('lpPz', V.polesSvg(tf, wOf($('#lpPz')))); setSvg('lpStep', V.stepSvg(tf, wOf($('#lpStep')))); setSvg('lpBode', V.bodeSvg(tf, wOf($('#lpBode'))));
    return h;
  }
  function tabRow(e, i) { return `<tr data-ti="${i}" class="${S.lp.cs === e.id ? 'sel' : ''}" tabindex="0" role="button" aria-label="Zahlenprobe für ${esc(e.f)}"><td>${esc(e.f)}</td><td>${esc(e.F)}</td></tr>`; }
  function lpProbe() {
    const e = C.TABLE.find(x => x.id === S.lp.cs); if (!e || !e.fn) return '<p class="hint2">Wähle eine Zeile der Tabelle (der Impuls δ(t) lässt sich nicht numerisch integrieren).</p>';
    const p = { a: P(S.lp.ca), w: P(S.lp.cw), b: P(S.lp.ca) + 3 }, s0 = P(S.lp.cs0);
    if (!(p.a > 0) || !(p.w > 0) || !(s0 > 0)) return note('a, ω und s müssen positive Zahlen sein.');
    const T = 100 / s0 + 20, tab = C.tableValue(e.id, s0, p), num = C.laplaceNumeric(t => e.fn(t, p), s0, T, 80000);
    return box('Tabelle: F(s) mit a = ' + f(p.a, 3) + ', ω = ' + f(p.w, 3) + ', s = ' + f(s0, 3), e.F, f(tab, 6), 'ok') + box('Zahlenprobe: Integral ∫ f(t)·e^(−s·t) dt (numerisch, Simpson)', '', f(num, 6)) + `<p class="hint2">Beide Werte stimmen überein: Die Tabellenformel ist das Ergebnis des Integrals. (Reelles s > 0 gewählt, damit das Integral sicher konvergiert.)</p>`;
  }
  function renderLp() {
    const s = S.lp, pre = LPRE[s.pre];
    $('#lpView').innerHTML = explain('lp') + `<div class="card pl"><h4>Korrespondenztabelle mit Zahlenprobe</h4><div class="tw"><table class="tt tabl"><tr><th>f(t), t ≥ 0</th><th>F(s)</th></tr>${C.TABLE.map(tabRow).join('')}</table></div>
      <p class="hint2">Tippe auf eine Zeile: Die Tabellenformel wird mit dem numerisch berechneten Integral verglichen.</p>
      <div class="dsrow">${inp('data-lc="ca"', 'a', s.ca, '1/s')}${inp('data-lc="cw"', 'ω', s.cw, 'rad/s')}${inp('data-lc="cs0"', 's (reell, > 0)', s.cs0, '1/s')}</div><div id="lpProbe"></div></div>
      <div class="card pl"><h4>Übertragungsfunktion, Pole und Nullstellen</h4><div class="fbar"><div class="seg" role="group" aria-label="Typ">${Object.keys(LPRE).map(k => `<button data-lp="${k}" class="${s.pre === k ? 'on' : ''}" aria-pressed="${s.pre === k}">${esc(LPRE[k].name)}</button>`).join('')}</div></div>
      <div class="dsrow">${pre.fields.map(k => inp(`data-lf="${k}"`, LPL[k][0], s[k] === undefined ? '' : s[k], LPL[k][1], k === 'num' || k === 'den' ? ' inputmode="text"' : '')).join('')}</div><div id="lpOut"></div></div>
      <div class="card pl"><h4>Pole und Nullstellen in der s-Ebene</h4>${chartDiv('lpPz', 'Pol-Nullstellen-Plan')}<p class="hint2">Kreuz = Pol, Kreis = Nullstelle. Links der imaginären Achse ist der stabile Bereich.</p></div>
      <div class="card pl"><h4>Sprungantwort</h4>${chartDiv('lpStep', 'Sprungantwort')}</div>
      <div class="card pl"><h4>Betragsgang |H(jω)|</h4>${chartDiv('lpBode', 'Betragsgang')}<p class="hint2">Eingesetzt wird s = jω. Der Knick liegt bei ω = Betrag des Pols.</p></div>`;
    updateLp(); $('#lpProbe').innerHTML = lpProbe();
  }
  function updateLp() { $('#lpOut').innerHTML = lpOut(); }
  UPD.lp = updateLp;
  $('#lpView').addEventListener('input', e => {
    const k = e.target.dataset.lf, c = e.target.dataset.lc;
    if (k) { S.lp[k] = e.target.value; lsSet('lp', S.lp); updateLp(); } else if (c) { S.lp[c] = e.target.value; lsSet('lp', S.lp); $('#lpProbe').innerHTML = lpProbe(); }
  });
  function lpSelect(tr) { const e = C.TABLE[+tr.dataset.ti]; if (!e) return; S.lp.cs = e.id; lsSet('lp', S.lp); $$('#lpView tr[data-ti]').forEach(r => r.classList.toggle('sel', r === tr)); $('#lpProbe').innerHTML = lpProbe(); }
  $('#lpView').addEventListener('click', e => {
    const tr = e.target.closest('tr[data-ti]'), b = e.target.closest('[data-lp]');
    if (tr) lpSelect(tr); else if (b) {
      S.lp.pre = b.dataset.lp; if (S.lp.pre === 'free' && (S.lp.num === undefined || S.lp.num === '')) { S.lp.num = '1'; S.lp.den = '1 2 100'; } lsSet('lp', S.lp); renderLp();
    }
  });
  $('#lpView').addEventListener('keydown', e => { const tr = e.target.closest && e.target.closest('tr[data-ti]'); if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); lpSelect(tr); } });

  /* ============================================================ Fourier */
  function foOut() {
    const s = S.fo, k = s.kind, A = s.A, N = Math.round(s.N), thd = C.thd(k, N), kl = C.klirr(k, N), rp = C.rmsPartial(k, A, N), rt = C.rmsTotal(k, A);
    let pk = -Infinity; for (let i = 0; i <= 3000; i++) { const x = Math.PI * i / 3000 * (k === 'saw' ? 1 : 0.5); pk = Math.max(pk, C.partial(k, A, N, x)); }
    const hs = C.harmonics(k, Math.min(N, 12));
    let h = box('Glieder der Teilsumme', '', 'Harmonische bis n = ' + N + (k === 'saw' ? ' (alle Ordnungen)' : ' (nur ungerade Ordnungen)'), 'ok');
    h += box('Effektivwert der Teilsumme / des idealen Signals', 'U_eff² = Σ b_n²/2', f(rp, 4) + ' V  /  ' + f(rt, 4) + ' V');
    h += box('Oberschwingungsgehalt (THD)', 'THD = √(Σ b_n², n ≥ 2) / b₁', N >= 2 ? f(thd * 100, 2) + ' %  (n → ∞: ' + f(C.thdInf(k) * 100, 2) + ' %)' : '0 % (nur die Grundschwingung)');
    h += box('Klirrfaktor k', 'k = √(Σ b_n², n ≥ 2) / √(Σ b_n², n ≥ 1)', N >= 2 ? f(kl * 100, 2) + ' %  (n → ∞: ' + f(C.klirrInf(k) * 100, 2) + ' %)' : '0 %');
    if (k !== 'triangle') h += box('Größter Wert der Teilsumme (Gibbs)', '', f(pk, 3) + ' V  (Überschwinger über ' + f(A, 2) + ' V: ' + f(Math.max(0, pk - A), 3) + ' V = ' + f((pk - A) / (2 * A) * 100, 1) + ' % des Sprungs; Grenzwert ' + f(C.gibbsPercentOfJump(), 2) + ' %)', 'warn'); else h += box('Größter Wert der Teilsumme', '', f(pk, 3) + ' V  (Dreieck ist stetig: kein Gibbs-Überschwinger)');
    h += `<div class="tw"><table class="tt"><tr><th class="n">n</th><th class="n">b<sub>n</sub> in V</th><th class="n">b<sub>n</sub>/b₁</th></tr>${hs.map(n => `<tr><td class="n">${n}</td><td class="n">${esc(f(C.bn(k, A, n), 4))}</td><td class="n">${esc(f(C.bn(k, A, n) / C.bn(k, A, 1), 4))}</td></tr>`).join('')}</table></div>`;
    return h;
  }
  function renderFo() {
    const s = S.fo;
    $('#foView').innerHTML = explain('fo') + `<div class="card pl"><h4>Partialsumme der Fourier-Reihe</h4>
      <div class="fbar"><div class="seg" role="group" aria-label="Signalform">${Object.keys(C.SHAPES).map(k => `<button data-fk="${k}" class="${s.kind === k ? 'on' : ''}" aria-pressed="${s.kind === k}">${C.SHAPES[k]}</button>`).join('')}</div></div>
      <div class="cols"><div>${slider('fo', 'A', 'Spitzenwert A', s.A, 1, 20, false, SLF['fo.A'])}${slider('fo', 'N', 'Anzahl der Glieder (bis Ordnung n =)', s.N, 1, 99, false, SLF['fo.N'])}</div><div></div></div>
      ${V.legend([['c1', 'Teilsumme'], ['c2 dash', 'ideales Signal']])}${chartDiv('foSvg', 'Zeitverlauf')}<p class="hint2">Zwei Perioden. Je mehr Glieder, desto steiler die Flanken; an Sprungstellen bleibt der Überschwinger (Gibbs).</p></div>
      <div class="card pl"><h4>Amplitudenspektrum</h4>${chartDiv('foSp', 'Amplitudenspektrum')}</div><div id="foOut"></div>`;
    updateFo();
  }
  function updateFo() {
    const s = S.fo, W = wOf($('#foSvg')); s.N = Math.round(s.N);
    setSvg('foSvg', V.fourierSvg(s.kind, s.A, s.N, W)); setSvg('foSp', V.spectrumSvg(s.kind, s.A, s.N, W)); $('#foOut').innerHTML = `<div class="card pl"><h4>Kennzahlen</h4>${foOut()}</div>`;
  }
  UPD.fo = updateFo;
  $('#foView').addEventListener('click', e => { const b = e.target.closest('[data-fk]'); if (b) { S.fo.kind = b.dataset.fk; lsSet('fo', S.fo); renderFo(); } });

  /* ============================================================ Aufgaben und Trainer */
  const done = () => lsGet('done', {});
  const exam = () => lsGet('exam', '0') === '1';
  function pctFor(id) { if (!exam()) return 100; return 100 - 25 * Math.min(3, lsGet('ctipps', {})[id] || 0); }
  function markSolved(id, pct) {
    const p = lsGet('prog', {}); if ((p[id] || 0) < pct) p[id] = pct; lsSet('prog', p);
    const d = done(); d[id] = true; lsSet('done', d); updateBadge(); updatePal();
  }
  function updateBadge() { const b = $('#tkBd'); if (b) b.textContent = Object.keys(done()).filter(k => TASKS.some(t => t.id === k)).length + '/' + TASKS.length; }
  const curTask = () => S.task && TASKS.find(t => t.id === S.task);
  const solText = q => (q.ask.type === 'choice' ? q.ask.choices[q.ask.correct] : C.fmtSig(q.value, 4) + (q.ask.unit ? ' ' + q.ask.unit : ''));
  function qBody(q, a, r, pre) {
    const locked = r && (r.ok || pre === 'rt');
    if (q.ask.type === 'choice') return `<div class="opts" role="group" aria-label="Antwortmöglichkeiten">${q.ask.choices.map((c, i) => `<button data-tc="${i}" ${locked ? 'disabled' : ''} class="${locked && i === q.ask.correct ? 'ok' : a.c === i ? (r && !r.ok ? 'bad' : 'on') : ''}" aria-pressed="${a.c === i}">${esc(c)}</button>`).join('')}</div>`;
    return `<label class="f"><span>${esc(q.ask.label)}${q.ask.unit ? ' (' + esc(q.ask.unit) + ')' : ''}</span><div class="qin"><input data-in="1" inputmode="decimal" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(a.v || '')}" ${locked ? 'disabled' : ''}><span class="u">${esc(q.ask.unit)}</span></div></label>`;
  }
  function evalQ(q, a) {
    if (q.ask.type === 'choice') { if (a.c == null) { toast('Wähle zuerst eine Antwort.'); return null; } return { ok: a.c === q.ask.correct, given: q.ask.choices[a.c] }; }
    const cands = C.parseDeAll(a.v); if (!cands.length) { toast('Bitte gib eine Zahl ein (mit Komma oder Punkt).'); return null; }
    const hit = x => (q.mod360 ? C.angDiff(x, q.value) <= q.tol + 1e-9 : Math.abs(x - q.value) <= q.tol + 1e-9), good = cands.find(hit), ok = good !== undefined, v = ok ? good : cands[cands.length - 1];
    return { ok, given: C.fmtSig(v, 4) + (q.ask.unit ? ' ' + q.ask.unit : '') };
  }
  const stepsHtml = q => '<ol class="steps">' + q.expl.map(l => '<li>' + esc(l) + '</li>').join('') + '</ol>';
  const resBlock = (q, r, showExpl) => `<ul class="tl"><li class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓ Richtig: ' + esc(r.given) : '✗ Deine Antwort „' + esc(r.given) + '“ stimmt nicht.'}</li>${q.ask.type === 'num' && q.tol > 0.011 ? `<li>ℹ Erlaubte Abweichung: ±${esc(f(q.tol, 3))} ${esc(q.ask.unit)} (wegen Rundung).</li>` : ''}</ul>` +
    (showExpl ? `<div class="rdout ${r.ok ? 'ok' : 'bad'}"><b>Lösung:</b> ${esc(solText(q))}<br><br><b>Musterlösung mit Rechenweg:</b>${stepsHtml(q)}</div>` : '<div class="rdout bad">🎓 Prüfmodus: Den Lösungsweg gibt es erst, wenn die Aufgabe richtig gelöst ist. Nutze einen Tipp oder versuche es noch einmal.</div>');
  function renderTasks(top) {
    const V_ = $('#taskView'), d = done(), prog = lsGet('prog', {}), t = curTask(), n100 = TASKS.filter(x => d[x.id]).length; let h = '';
    if (t) {
      const q = S.tq, r = S.tRes && S.tRes.id === t.id ? S.tRes : null, a = S.tAns[t.id] || {};
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv" aria-label="Schwierigkeit ${t.level} von 3">${dots(t.level)}</div><p style="margin:8px 0">${esc(q.text)}</p>${qBody(q, a, r, 'tk')}`;
      h += `<div class="btns"><button class="btn pri" data-ta="chk"${r && r.ok ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" data-ta="hint">💡 Tipp</button><button class="btn" data-ta="close">Schließen</button></div>`;
      if (exam()) h += '<p class="hint2" style="color:var(--warn)">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>';
      if (r) { h += resBlock(q, r, r.ok || !exam()); if (r.ok) h += `<div class="btns"><button class="btn pri" data-ta="next">Nächste Aufgabe</button></div>`; }
      h += '</div>';
    }
    h += `<p class="hint2" style="margin:4px 0 0">${n100} von ${TASKS.length} Aufgaben gelöst. ${exam() ? '🎓 Prüfmodus ist an.' : 'Tipp: Im Prüfmodus (🎓 oben) zählen Tipps als Abzug.'} Die Zahlen jeder Aufgabe sind fest; im Trainer entstehen immer neue.</p>`;
    let last = '';
    TASKS.forEach(x => { if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; } const p = prog[x.id]; h += `<button class="row" data-t="${esc(x.id)}"><span class="dot ${d[x.id] ? 'g' : ''}">${d[x.id] ? '✓' : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${dots(x.level)}</span>${p != null && p < 100 ? ' · bisher ' + p + ' %' : ''}</small></div></button>`; });
    V_.innerHTML = h; if (top !== false) $('#pgTasks').scrollTop = 0;
  }
  function checkTask(t) {
    const a = S.tAns[t.id] || {}, e = evalQ(S.tq, a); if (!e) return; const pct = e.ok ? pctFor(t.id) : 0;
    S.tRes = { id: t.id, ok: e.ok, given: e.given, pct };
    if (e.ok) { markSolved(t.id, pct); const F = fx(); if (F && F.pass) try { F.pass(pct); } catch (er) {} else ding(); toast(exam() && pct < 100 ? pct + ' % (Tipps abgezogen)' : '🎉 Geschafft!'); } else { sad(); toast('Noch nicht richtig. Lies den Tipp oder versuche es noch einmal.'); }
    renderTasks(false);
  }
  /* Tipps in 3 Stufen: 1 Denkanstoß, 2 Formel, 3 erster Rechenschritt */
  function hintFor(q, id) {
    const h = lsGet('hints', {}), n = Math.min(3, (h[id] || 0) + 1), ex = exam(); h[id] = Math.max(h[id] || 0, n); lsSet('hints', h);
    if (ex) { const c = lsGet('ctipps', {}); c[id] = Math.max(c[id] || 0, n); lsSet('ctipps', c); }
    sheet('Tipp, Stufe ' + n + ' von 3', b => {
      const lab = ['Denkanstoß', 'Formel', 'Erster Rechenschritt']; let x = '';
      for (let i = 0; i < n; i++) x += `<p${i ? '' : ' style="margin-top:0"'}><b>Stufe ${i + 1} (${lab[i]}):</b> ${esc(q.tips[i])}</p>`;
      x += n >= 3 ? '<p class="hint2">Mehr Tipps gibt es nicht. Den Lösungsweg siehst du nach dem Prüfen.</p>' : '<p class="hint2">Noch mehr Hilfe? Tippe noch einmal auf „Tipp“.</p>';
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

  /* Zufalls-Trainer */
  function newTrainer() { const T = S.tr; T.q = D.randomQ(R0, T.level, T.topic); T.ans = {}; T.res = null; renderTrainer(); }
  function renderTrainer() {
    const T = S.tr; if (!T.q) { newTrainer(); return; }
    const q = T.q;
    $('#rtView').innerHTML = `<div class="stats"><div class="bx"><b>${S.rt.n}</b>Fragen</div><div class="bx"><b>${S.rt.ok}</b>richtig</div><div class="bx"><b>${S.rt.streak}</b>Serie</div><div class="bx"><b>${S.rt.best}</b>Beste Serie</div></div>
      <div class="fbar"><span class="lbl">THEMA</span><div class="seg" role="group" aria-label="Thema">${[['', 'Alle']].concat(D.topics.map(t => [t.k, t.short])).map(l => `<button data-tp="${l[0]}" class="${T.topic === l[0] ? 'on' : ''}" aria-pressed="${T.topic === l[0]}">${esc(l[1])}</button>`).join('')}</div></div>
      <div class="fbar"><span class="lbl">STUFE</span><div class="seg" role="group" aria-label="Stufe">${[[0, 'Alle'], [1, '1'], [2, '2'], [3, '3']].map(l => `<button data-lv="${l[0]}" class="${T.level === l[0] ? 'on' : ''}" aria-pressed="${T.level === l[0]}">${l[1]}</button>`).join('')}</div></div>
      <div class="card pl"><h4>${esc(q.cat)} · <span class="lv">${dots(q.level)}</span></h4><div class="big">${esc(q.title)}</div><p style="margin:8px 0">${esc(q.text)}</p>${qBody(q, T.ans, T.res, 'rt')}
      <div class="btns"><button class="btn pri" data-ra="chk" ${T.res ? 'disabled' : ''}>✓ Prüfen</button><button class="btn" data-ra="hint" ${T.res ? 'disabled' : ''}>💡 Tipp</button><button class="btn" data-ra="next">${T.res ? 'Nächste Frage' : 'Überspringen'}</button></div>
      ${T.res ? resBlock(q, T.res, true) : ''}</div>`;
  }
  const rv = $('#rtView');
  rv.addEventListener('input', e => { if (e.target.dataset.in) S.tr.ans.v = e.target.value; });
  rv.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.in) { e.preventDefault(); trainerCheck(); } });
  rv.addEventListener('click', e => {
    const T = S.tr, tc = e.target.closest('[data-tc]'), ra = e.target.closest('[data-ra]'), lv = e.target.closest('[data-lv]'), tp = e.target.closest('[data-tp]');
    if (lv) { T.level = +lv.dataset.lv; newTrainer(); return; } if (tp) { T.topic = tp.dataset.tp; newTrainer(); return; }
    if (tc && !T.res) { T.ans.c = +tc.dataset.tc; renderTrainer(); return; }
    if (ra) { const a = ra.dataset.ra; if (a === 'chk') trainerCheck(); else if (a === 'hint') hintFor(T.q, 'rt'); else { if (!T.res && S.rt.streak) { S.rt.streak = 0; lsSet('rt', S.rt); } newTrainer(); updatePal(); } }
  });
  function trainerCheck() {
    const T = S.tr; if (T.res) return; const e = evalQ(T.q, T.ans); if (!e) return;
    T.res = { ok: e.ok, given: e.given }; S.rt.n++; if (e.ok) { S.rt.ok++; S.rt.streak++; S.rt.best = Math.max(S.rt.best, S.rt.streak); ding(); } else { S.rt.streak = 0; sad(); }
    lsSet('rt', S.rt); renderTrainer(); updatePal();
  }

  /* ============================================================ Hilfe */
  function renderHelp() {
    const sec = (t, b, open) => `<details${open ? ' open' : ''}><summary>${t}</summary><div class="hb2">${b}</div></details>`;
    $('#helpView').innerHTML =
      sec('Für wen ist dieses Lab?', `<p>Die Mathe-Brücke verbindet die Elektrotechnik mit der Mathematik, die in der Weiterbildung zum Techniker, im dualen Studium und im Wirtschaftsingenieurwesen gebraucht wird. Sie liegt über dem Niveau der Ausbildung. Vorausgesetzt werden Ohmsches Gesetz, Wechselstromgrundlagen (Effektivwert, Frequenz) und Bruchrechnen mit Potenzen.</p>`, true) +
      sec('So arbeitest du', `<p>Jeder Themenreiter (Komplex, Matrizen, DGL, Laplace, Fourier) hat oben eine kurze <b>Erklärung</b>, darunter Regler und Rechner mit Diagrammen. Drehe an den Reglern und beobachte, wie sich Kurven und Kennzahlen ändern. Unter <b>Aufgaben</b> findest du je Thema 10 bis 12 Aufgaben mit Musterlösung und Rechenweg. Der <b>Trainer</b> würfelt neue Zahlen.</p><p><b>Tipps</b> gibt es in drei Stufen: Denkanstoß, Formel, erster Rechenschritt. Im Prüfmodus kostet jede Stufe 25 % der Punkte.</p>`) +
      sec('Zahlen eingeben', `<p>Dezimalkomma oder Punkt. Eine Zahl wie 1.539 wird als 1,539 und als 1539 geprüft. Einheiten werden getrennt angezeigt, du tippst nur die Zahl. Komplexe Zahlen im Rechner: <b>3 + j4</b>, <b>3−4j</b>, <b>j2</b> oder polar <b>5∠53,13</b> (Winkel in Grad).</p>`) +
      sec('Wichtige Regeln auf einen Blick', `<table><tr><th>Thema</th><th>Merksatz</th></tr><tr><td>Komplex</td><td>Reihe: Impedanzen addieren. Parallel: Admittanzen addieren. Multiplizieren und Dividieren polar.</td></tr><tr><td>Matrizen</td><td>Knotenpotenzial: G·V = I; Diagonale Summe der Leitwerte, Nebendiagonale negativer Leitwert.</td></tr><tr><td>DGL</td><td>τ = RC bzw. L/R; D = (R/2)·√(C/L) entscheidet zwischen Schwingen und Kriechen.</td></tr><tr><td>Laplace</td><td>Pole links der imaginären Achse: stabil. Endwertsatz: y(∞) = lim s·Y(s).</td></tr><tr><td>Fourier</td><td>Ungerade Signale haben nur Sinusglieder; Halbwellensymmetrie nur ungerade Ordnungen; THD und Klirrfaktor unterscheiden sich im Bezug.</td></tr></table>`) +
      sec('Was nicht enthalten ist', `<p>Netzwerke mit gesteuerten Quellen, die Maschenstromanalyse mit Matrizen, Differenzialgleichungen höherer Ordnung als 2, die inverse Laplace-Transformation mit mehrfachen Polen als Rechner, die Fourier-Transformation (nicht periodischer Signale) und die Z-Transformation. Das Lab ersetzt keine Vorlesung, es stellt die Brücke von der Schaltung zur Rechnung her.</p>`) +
      `<p class="hint2">Alle Zahlen in Beispielen, Aufgaben und Lösungen werden vom Rechenkern berechnet und im Test mit einem unabhängigen zweiten Rechenweg verglichen (numerisch, über die Admittanz, per Bisektion oder Runge-Kutta).</p>`;
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  const RENDER = { cx: renderCx, mx: renderMx, de: renderDe, lp: renderLp, fo: renderFo, tasks: renderTasks, rt: renderTrainer, help: renderHelp };
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'cx'; S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    RENDER[t]();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'Mathe-Brücke\n<small>' + esc(T[2]) + '</small>'; document.title = 'Mathe-Brücke: ' + T[2];
  }
  /* Diagramme beim Drehen und Skalieren des Fensters neu zeichnen (1 SVG-Einheit = 1 Pixel, Schrift bleibt 14 px) */
  let rzT = 0, lastW = 0;
  window.addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(() => { const w = window.innerWidth; if (w === lastW) return; lastW = w; if (UPD[S.tab]) UPD[S.tab](); }, 120); });
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
  $('#title').onclick = () => setTab('cx');
  $('#bMenu').onclick = () => {
    const rows = [['cx', 'Komplexe Wechselstromrechnung', 'Zeiger, Impedanz, Resonanz, Rechner'], ['mx', 'Matrizen und Knotenpotenzial', 'Gauss, Cramer, Netzwerke mit Schrittrechnung'], ['de', 'Differenzialgleichungen', 'RC, RL und RLC mit Kurvenplot'], ['lp', 'Laplace-Einstieg', 'Tabelle, Übertragungsfunktion, Pole'], ['fo', 'Fourier-Reihe', 'Rechteck, Dreieck, Sägezahn, THD, Gibbs'], ['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung, Tipps und Rechenweg'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Aufgaben mit Serien-Zähler'], ['help', 'Hilfe', 'Bedienung und Merksätze'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben und Trainer-Serie auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
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
  root.MAT2_LAB = { id: 'mat2', title: 'Mathe-Brücke', stufe: 'studium', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.MAT2_TASKS };

  buildTabs(); updatePal(); lastW = window.innerWidth; setTab(TABS.some(x => x[0] === S.tab) ? S.tab : 'cx');
  root.LabGoto = id => { try { if (TASKS.some(t => t.id === id)) { setTab('tasks'); startTask(id); return true; } } catch (e) {} return false; };
  try { const qa = new URLSearchParams(location.search).get('aufgabe'); if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); } } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
