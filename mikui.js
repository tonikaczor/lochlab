'use strict';
/* Tonfunk Mikrocontroller-Lab: Oberfläche (Lab-Kennung 'mik').
   ALLE Zahlen (Takt, Vorteiler, Spannungen, Ströme, Zeiten) sind ÜBUNGSWERTE für die Ausbildung, nicht für die Praxis.
   Reiter: Timer (Sägezahn, Vergleichswert), AD-Wandler (Treppenstufen), Zustandsautomat (Ampel mit millis, Überlauf), Schlafmodus (mittlerer Strom), Aufgaben, Trainer, Hilfe.
   Module: mikcore.js (MIK_CORE), mikdata.js (MIK_DATA, MIK_TASKS), mikviz.js (MIK_VIZ, wird davor geladen).
   Speicher (Präfix lm4.mik.): tab, tim, adc, zus, slp, done ({id:true} nur gelöste), prog ({id:Prozent}), hints, ctipps (nur Prüfmodus), exam ('1'), rt (Trainer).
   Tipp-Abzug (25 % je Stufe, höchstens 2 Stufen) gibt es nur im Prüfmodus; beim normalen Üben kosten Tipps nichts.
   Aufruf: miklab.html?aufgabe=mik1 öffnet die Aufgabe. */
(function (root) {
  const C = root.MIK_CORE, D = root.MIK_DATA, V = root.MIK_VIZ;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.mik.';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(LS + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} };
  const f = (v, d) => C.fmtN(v, d == null ? 2 : d, true), P = s => C.parseDe(s);
  const tage = v => f(v, 1) + (Math.abs(v - 1) < 0.05 ? ' Tag' : ' Tage');
  const fv = v => f(v, Math.abs(v) < 1 ? 4 : 2);
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
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>Mikrocontroller-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">mikcore.js, mikdata.js oder mikviz.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks;

  /* ============================================================ Zustand */
  const TABS = [['tim', '⏱️', 'Timer'], ['adc', '📈', 'AD-Wandler'], ['zus', '🚦', 'Zustandsautomat'], ['slp', '🔋', 'Schlafmodus'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['help', '📘', 'Hilfe']];
  const S = {
    tab: lsGet('tab', 'tim'),
    tim: Object.assign({ fi: 3, pi: 2, bits: 8, mode: 'ctc', ocr: '249', fz: '1000' }, lsGet('tim', {})),
    adc: Object.assign({ ri: 3, n: 10, u: '2,5' }, lsGet('adc', {})),
    zus: Object.assign({ d: [4000, 1000, 5000, 2000], ltz: '4294966996', jtz: '4294967100', iv: '1000' }, lsGet('zus', {})),
    slp: Object.assign({ ia: '10000', ta: '20', is: '10', T: '1000', cap: '240' }, lsGet('slp', {})),
    task: null, tq: null, tAns: {}, tRes: null, tFehl: {},
    tr: { q: null, ans: {}, res: null, level: 0 },
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {}))
  };
  /* Gespeicherte Zustände prüfen */
  const T0 = S.tim, A0 = S.adc, Z0 = S.zus;
  if (!(T0.fi >= 0 && T0.fi < C.FCPU.length)) T0.fi = 3;
  if (!(T0.pi >= 0 && T0.pi < C.PRES.length)) T0.pi = 2;
  if (![8, 16].includes(T0.bits)) T0.bits = 8;
  if (!['ctc', 'pwm'].includes(T0.mode)) T0.mode = 'ctc';
  if (!(A0.ri >= 0 && A0.ri < C.REFS.length)) A0.ri = 3;
  if (![8, 10, 12].includes(A0.n)) A0.n = 10;
  if (!Array.isArray(Z0.d) || Z0.d.length !== 4 || !Z0.d.every(v => v >= 200 && v <= 10000)) Z0.d = [4000, 1000, 5000, 2000];
  const R0 = (() => { const m = /[?&]seed=([^&]+)/.exec(location.search); return C.rng(m ? decodeURIComponent(m[1]) : String(Math.random()) + Date.now()); })();

  /* ============================================================ Bausteine */
  const box = (t, fm, res, cls) => `<div class="rdout ${cls || ''}"><span class="st">${esc(t)}</span>${fm ? esc(fm) + ' = ' : ''}<b>${esc(res)}</b></div>`;
  const note = (t, cls) => `<div class="rdout ${cls || 'warn'}">${esc(t)}</div>`;
  const inp = (k, label, val, unit) => `<label class="f"><span>${esc(label)}${unit ? ' (' + esc(unit) + ')' : ''}</span><input data-k="${k}" inputmode="decimal" autocomplete="off" value="${esc(val)}"></label>`;
  const UEB = 'Alle Zahlen in diesem Lab (Takt, Vorteiler, Spannungen, Ströme, Zeiten) sind Übungswerte für die Ausbildung, nicht für die Praxis. Maßgebend sind immer das Datenblatt des Bauteils und die Vorgaben deines Betriebs.';
  const ueb = () => `<div class="rdout warn">⚠ ${esc(UEB)}</div>`;
  const seg = (attr, opts, cur) => `<div class="seg">${opts.map(o => `<button ${attr}="${esc(o[0])}" class="${String(cur) === String(o[0]) ? 'on' : ''}">${esc(o[1])}</button>`).join('')}</div>`;
  const lbl = t => `<span style="font-size:14px;color:var(--mute)">${esc(t)}</span>`;
  const stage = (id, vz) => `<div class="vzstage" id="${id}"><div class="vzbox" id="${vz}"></div></div>`;
  const draw = (id, svg) => { const b = $(id); if (!b) return; b.innerHTML = svg; V.run(b); };
  const onSeg = (e, attr) => { const b = e.target.closest('.seg button[' + attr + ']'); if (!b) return null; $$('button', b.parentNode).forEach(x => x.classList.toggle('on', x === b)); return b.getAttribute(attr); };

  /* ============================================================ Timer */
  const tfreq = () => C.FCPU[S.tim.fi], tpre = () => C.PRES[S.tim.pi], tmax = () => C.pow2(S.tim.bits) - 1;
  function renderTim() {
    const s = S.tim;
    $('#timView').innerHTML = stage('stTim', 'vzTim') + ueb() + `<div class="card pl"><h4>Zähler und Vergleichswert</h4>
      <div class="fbar">${lbl('TAKT')}${seg('data-tf', C.FCPU.map((v, i) => [i, C.fmtHz(v)]), s.fi)}</div>
      <div class="fbar">${lbl('VORTEILER')}${seg('data-tp', C.PRES.map((v, i) => [i, v]), s.pi)}</div>
      <div class="fbar">${lbl('BREITE')}${seg('data-tb', [[8, '8 Bit'], [16, '16 Bit']], s.bits)}${lbl('MODUS')}${seg('data-tm', [['ctc', 'CTC'], ['pwm', 'Fast-PWM']], s.mode)}</div>
      <label class="f"><span>Vergleichswert OCR (0 bis <b id="timMax">${tmax()}</b>)</span><input type="range" id="timR" min="0" max="${tmax()}" step="1" value="${esc(P(s.ocr) >= 0 ? Math.min(P(s.ocr), tmax()) : 0)}"></label>
      ${inp('ocr', 'OCR als Zahl', s.ocr, '')}<div id="timOut"></div>
      <p class="hint2">CTC: Der Zähler läuft von 0 bis OCR, dann zurück auf 0 (das sind OCR + 1 Schritte), der Ausgang kippt bei jedem Treffer. Fast-PWM: Der Zähler läuft immer bis ${tmax()}, der Ausgang ist High, solange der Zähler unter OCR liegt.</p></div>
      <div class="card pl"><h4>Vergleichswert aus der Zielfrequenz</h4>${inp('fz', 'Gewünschte Trefferfrequenz', s.fz, 'Hz')}<div id="timCalc"></div></div>`;
    updateTim();
  }
  function updateTim() {
    const s = S.tim, ocr = P(s.ocr), N = tpre(), F = tfreq(), max = tmax(), ok = Number.isInteger(ocr) && ocr >= 0 && ocr <= max;
    let h = box('Zählschritt', f(N, 0) + ' / ' + C.fmtHz(F), C.fmtTime(C.tick(F, N))) + box('Überlauf nach 0 bis ' + max, f(N, 0) + ' · ' + f(max + 1, 0) + ' / ' + C.fmtHz(F), C.fmtTime(C.overflow(F, N, s.bits)));
    if (!ok) h = note('Gib den Vergleichswert als ganze Zahl von 0 bis ' + max + ' ein.') + h;
    else if (s.mode === 'ctc') h += box('Treffer je Sekunde', 'Takt / (Vorteiler · (OCR + 1))', C.fmtHz(C.cmpHz(F, N, ocr))) + box('Rechteck am Ausgang (kippt bei jedem Treffer)', 'Treffer / 2', C.fmtHz(C.toggleHz(F, N, ocr)));
    else h += box('PWM-Frequenz', 'Takt / (Vorteiler · ' + f(max + 1, 0) + ')', C.fmtHz(C.pwmHz(F, N, s.bits))) + box('Tastgrad', 'OCR / ' + f(max, 0), f(C.duty(ocr, s.bits) * 100, 1) + ' %') + box('Mittelwert bei 5 V', 'Tastgrad · 5 V', f(C.meanV(C.duty(ocr, s.bits), 5), 2) + ' V');
    $('#timOut').innerHTML = h;
    if (ok) draw('#vzTim', V.timerSvg({ f: F, N, bits: s.bits, ocr, mode: s.mode }));
    updateCalc();
  }
  function updateCalc() {
    const s = S.tim, fz = P(s.fz), F = tfreq(), N = tpre(); let h;
    if (!(fz > 0)) h = note('Gib die Frequenz als positive Zahl in Hz ein.');
    else {
      const r = C.ocrCalc(F, N, fz, s.bits);
      h = box('Idealer Vergleichswert', 'Takt / (Vorteiler · Frequenz) − 1', f(r.ideal, 2));
      if (r.fits) h += box('Gerundet, tatsächliche Frequenz', 'OCR = ' + f(r.ocr, 0), C.fmtHz(r.fReal) + ' (Abweichung ' + f(r.errPct, 2) + ' %)', r.errPct > 1 ? 'warn' : 'ok') + `<div class="btns"><button class="btn pri" data-calc="1">OCR = ${f(r.ocr, 0)} übernehmen</button></div>`;
      else {
        const bp = C.bestPre(F, fz, s.bits);
        h += note('OCR = ' + f(r.ocr, 0) + ' passt nicht in ' + s.bits + ' Bit (höchstens ' + f(r.max, 0) + '). ' + (Number.isFinite(bp) ? 'Mit Vorteiler ' + f(bp, 0) + ' passt es.' : 'Auch mit Vorteiler 1024 passt es nicht, nimm 16 Bit oder einen kleineren Takt.'), 'bad');
      }
    }
    $('#timCalc').innerHTML = h;
  }
  $('#timView').addEventListener('click', e => {
    const tf = onSeg(e, 'data-tf'), tp = onSeg(e, 'data-tp'), tb = onSeg(e, 'data-tb'), tm = onSeg(e, 'data-tm'), s = S.tim;
    if (tf != null) s.fi = +tf; else if (tp != null) s.pi = +tp; else if (tm != null) s.mode = tm;
    else if (tb != null) { s.bits = +tb; const m = tmax(); if (!(P(s.ocr) <= m)) s.ocr = String(m); const r = $('#timR'); r.max = m; r.value = P(s.ocr); $('#timMax').textContent = m; $('[data-k=ocr]', $('#timView')).value = s.ocr; }
    else if (e.target.closest('[data-calc]')) { const r = C.ocrCalc(tfreq(), tpre(), P(s.fz), s.bits); s.ocr = String(r.ocr); $('#timR').value = r.ocr; $('[data-k=ocr]', $('#timView')).value = s.ocr; }
    else return;
    lsSet('tim', s); updateTim();
  });
  $('#timView').addEventListener('input', e => {
    const t = e.target, s = S.tim;
    if (t.id === 'timR') { s.ocr = t.value; $('[data-k=ocr]', $('#timView')).value = t.value; }
    else if (t.dataset.k === 'ocr') { s.ocr = t.value; const v = P(t.value); if (v >= 0 && v <= tmax()) $('#timR').value = v; }
    else if (t.dataset.k === 'fz') s.fz = t.value; else return;
    lsSet('tim', s); updateTim();
  });

  /* ============================================================ AD-Wandler */
  function renderAdc() {
    const s = S.adc, ur = C.REFS[s.ri];
    $('#adcView').innerHTML = stage('stAdc', 'vzAdc') + ueb() + `<div class="card pl"><h4>Messen mit dem AD-Wandler</h4>
      <div class="fbar">${lbl('REFERENZ')}${seg('data-ar', C.REFS.map((v, i) => [i, f(v, 2) + ' V']), s.ri)}</div>
      <div class="fbar">${lbl('AUFLÖSUNG')}${seg('data-ab', [[8, '8 Bit'], [10, '10 Bit'], [12, '12 Bit']], s.n)}</div>
      <label class="f"><span>Eingangsspannung (0 bis <b id="adcMax">${f(ur, 2)}</b> V)</span><input type="range" id="adcR" min="0" max="${ur}" step="0.005" value="${esc(Math.min(P(s.u) >= 0 ? P(s.u) : 0, ur))}"></label>
      ${inp('u', 'Spannung als Zahl', s.u, 'V')}<div id="adcOut"></div>
      <p class="hint2">Der Wandler schneidet ab: Er meldet die Stufe, in der die Spannung liegt. Zurückgerechnet bekommst du deshalb den unteren Rand der Stufe, nie mehr als der Eingang.</p></div>`;
    updateAdc();
  }
  function updateAdc() {
    const s = S.adc, ur = C.REFS[s.ri], u = P(s.u), n = s.n;
    let h;
    if (!(u >= 0 && u <= ur)) h = note('Gib die Spannung als Zahl von 0 bis ' + f(ur, 2) + ' V ein.');
    else {
      const raw = C.rawOf(u, ur, n), back = C.uOf(raw, ur, n);
      h = box('Stufen', '2 hoch ' + n, f(C.steps(n), 0)) + box('1 LSB (Spannung je Digit)', f(ur, 2) + ' V / ' + f(C.steps(n), 0), f(C.lsb(ur, n) * 1000, 3) + ' mV') +
        box('Rohwert', 'Eingang / Referenz · ' + f(C.steps(n), 0) + ', abgeschnitten', f(raw, 0) + ' = ' + C.binStr(raw, n) + ' (binär)') +
        box('Zurückgerechnet', 'Rohwert · 1 LSB', f(back, 3) + ' V') + box('Abstand zum Eingang', 'Eingang − zurückgerechnet', f((u - back) * 1000, 2) + ' mV (höchstens 1 LSB)');
      draw('#vzAdc', V.adcSvg({ u, uref: ur, n }));
    }
    $('#adcOut').innerHTML = h;
  }
  $('#adcView').addEventListener('click', e => {
    const s = S.adc, ar = onSeg(e, 'data-ar'), ab = onSeg(e, 'data-ab');
    if (ar != null) { s.ri = +ar; const ur = C.REFS[s.ri]; if (!(P(s.u) <= ur)) s.u = String(ur).replace('.', ','); const r = $('#adcR'); r.max = ur; r.value = P(s.u); $('#adcMax').textContent = f(ur, 2); $('[data-k=u]', $('#adcView')).value = s.u; }
    else if (ab != null) s.n = +ab; else return;
    lsSet('adc', s); updateAdc();
  });
  $('#adcView').addEventListener('input', e => {
    const t = e.target, s = S.adc;
    if (t.id === 'adcR') { s.u = String(t.value).replace('.', ','); $('[data-k=u]', $('#adcView')).value = s.u; }
    else if (t.dataset.k === 'u') { s.u = t.value; const v = P(t.value); if (v >= 0 && v <= C.REFS[s.ri]) $('#adcR').value = v; } else return;
    lsSet('adc', s); updateAdc();
  });

  /* ============================================================ Zustandsautomat */
  const zusCode = d => `const unsigned long DAUER[4] = { ${d.join(', ')} };   // ms\nunsigned long tLast = 0;\nbyte zustand = ROT;\n\nvoid loop() {\n  if (millis() - tLast >= DAUER[zustand]) {\n    tLast = millis();\n    zustand = (zustand + 1) % 4;   // ROT, ROTGELB, GRUEN, GELB\n    ampelSchalten(zustand);\n  }\n}`;
  function renderZus() {
    const s = S.zus;
    $('#zusView').innerHTML = stage('stZus', 'vzZus') + ueb() + `<div class="card pl"><h4>Ampel mit millis()</h4>
      ${C.AMPEL.map((a, i) => `<label class="f"><span>${a.n}: <b id="zd${i}">${f(s.d[i], 0)}</b> ms</span><input type="range" data-zd="${i}" min="200" max="10000" step="100" value="${s.d[i]}"></label>`).join('')}
      <div id="zusOut"></div><pre class="code" id="zusCode"></pre>
      <p class="hint2">Die Ampel wartet nicht, sie fragt nur: Ist die Zeit des Zustands schon um? So kann der Controller zwischendurch anderes tun.</p></div>
      <div class="card pl"><h4>millis() läuft über</h4><p class="hint2" style="margin:0 0 8px">Der Zähler millis() ist eine 32-Bit-Zahl ohne Vorzeichen (unsigned long) und springt nach 4294967295 auf 0. Gleiche die zwei Schreibweisen ab. Die Startwerte liegen kurz vor dem Sprung.</p>
      ${inp('ltz', 'Letzter Schaltzeitpunkt tLast', s.ltz, 'ms')}${inp('jtz', 'Jetzt: millis()', s.jtz, 'ms')}${inp('iv', 'Intervall', s.iv, 'ms')}<div id="ovOut"></div></div>`;
    updateZus();
  }
  function updateZus() {
    const s = S.zus, cy = C.cycle(s.d);
    $('#zusOut').innerHTML = box('Ein Durchlauf', s.d.map(v => f(v, 0)).join(' + '), C.fmtTime(cy / 1000)) + box('Anteil GRUEN am Durchlauf', f(s.d[2], 0) + ' / ' + f(cy, 0), f(s.d[2] / cy * 100, 1) + ' %');
    $('#zusCode').textContent = zusCode(s.d);
    draw('#vzZus', V.fsmSvg({ d: s.d, active: 0 }));
    const ok = v => Number.isInteger(v) && v >= 0 && v < C.U32, l = P(s.ltz), j = P(s.jtz), iv = P(s.iv);
    $('#ovOut').innerHTML = !(ok(l) && ok(j) && ok(iv)) ? note('Gib drei ganze Zahlen von 0 bis 4294967295 ein.') :
      box('Richtig: Zeit seit tLast', 'jetzt − tLast (32 Bit, ohne Vorzeichen)', f(C.u32diff(j, l), 0) + ' ms') + box('Richtig: ist das Intervall um?', 'jetzt − tLast ≥ Intervall', C.u32diff(j, l) >= iv ? 'ja' : 'nein') +
      box('Falsch: Summe tLast + Intervall (läuft über)', f(l, 0) + ' + ' + f(iv, 0), f((l + iv) % C.U32, 0)) + box('Falsch: ist das Intervall um?', 'jetzt ≥ tLast + Intervall', j >= (l + iv) % C.U32 ? 'ja' : 'nein') +
      ((C.u32diff(j, l) >= iv) !== (j >= (l + iv) % C.U32) ? note('Die zwei Schreibweisen sind sich nicht einig. Die Form mit der Differenz stimmt immer, die mit der Summe löst am Überlauf falsch aus.', 'bad') : '');
  }
  $('#zusView').addEventListener('input', e => {
    const t = e.target, s = S.zus;
    if (t.dataset.zd != null) { s.d[+t.dataset.zd] = +t.value; $('#zd' + t.dataset.zd).textContent = f(+t.value, 0); }
    else if (['ltz', 'jtz', 'iv'].includes(t.dataset.k)) s[t.dataset.k] = t.value; else return;
    lsSet('zus', s); updateZus();
  });

  /* ============================================================ Schlafmodus */
  function renderSlp() {
    const s = S.slp;
    $('#slpView').innerHTML = stage('stSlp', 'vzSlp') + ueb() + `<div class="card pl"><h4>Mittlerer Strom und Laufzeit</h4><div class="dsrow">${inp('ia', 'Strom aktiv Ia', s.ia, 'µA')}${inp('ta', 'Aktivzeit ta', s.ta, 'ms')}</div><div class="dsrow">${inp('is', 'Strom im Schlaf Is', s.is, 'µA')}${inp('T', 'Periode T (aktiv + Schlaf)', s.T, 'ms')}</div>${inp('cap', 'Batterie', s.cap, 'mAh')}<div id="slpOut"></div>
      <p class="hint2">Das Gerät wacht alle T auf, misst ta lang und schläft den Rest. „Ohne Schlaf“ heißt: Es bleibt dauernd aktiv.</p></div>`;
    updateSlp();
  }
  function updateSlp() {
    const s = S.slp, o = { ia: P(s.ia), ta: P(s.ta), is: P(s.is), T: P(s.T), cap: P(s.cap) }, avg = C.avgI(o.ia, o.ta, o.is, o.T);
    if (!(Number.isFinite(avg) && o.ia > 0 && o.cap > 0 && avg > 0)) { $('#slpOut').innerHTML = note('Gib alle Werte als positive Zahlen ein. Die Aktivzeit darf nicht länger sein als die Periode.'); return; }
    $('#slpOut').innerHTML = box('Mittlerer Strom', '(Ia · ta + Is · (T − ta)) / T', f(avg, 1) + ' µA') + box('Anteil der Ladung in der Aktivphase', 'Ia · ta / (Ia · ta + Is · (T − ta))', f(C.shareActive(o.ia, o.ta, o.is, o.T), 1) + ' %') +
      box('Laufzeit mit Schlaf', 'Kapazität / mittlerer Strom', tage(C.runDays(o.cap, avg))) + box('Laufzeit ohne Schlaf (dauernd aktiv)', 'Kapazität / Ia', tage(C.runDays(o.cap, o.ia)));
    draw('#vzSlp', V.sleepSvg(o));
  }
  $('#slpView').addEventListener('input', e => { const k = e.target.dataset.k; if (!['ia', 'ta', 'is', 'T', 'cap'].includes(k)) return; S.slp[k] = e.target.value; lsSet('slp', S.slp); updateSlp(); });

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
  const solText = q => (q.ask.type === 'choice' ? q.ask.choices[q.ask.correct] : fv(q.value) + ' ' + q.ask.unit);
  const eingabeHinweis = q => q.ask.type === 'num' ? `<p class="lr-hinweis hint2">Zahl in ${esc(q.ask.unit)}.${q.tol > 0.011 ? ' ±' + esc(f(q.tol, 2)) + ' ' + esc(q.ask.unit) + ' gelten als richtig (wegen Rundung).' : ''}</p>` : '';
  const stufeFuer = (ok, fehl, ex) => ok ? 'ok' : ex ? 'pruef' : fehl >= 2 ? 'loes' : 'tipp';
  const zeigFb = el => { try { const x = el && el.querySelector('.lr-fb'); if (x && root.LabRahmen) root.LabRahmen.zeig(x); } catch (e) {} };
  /* Programmauszug und "So gehst du vor" stehen vor der Eingabe */
  const vorHTML = q => `${q.code ? `<pre class="code">${esc(q.code)}</pre>` : ''}<div class="vor"><b>So gehst du vor</b><ol>${q.vor.map(s => `<li>${esc(s)}</li>`).join('')}</ol></div>`;
  function qBody(q, a, r) {
    const lock = r && (r.ok || r.stufe === 'loes');
    if (q.ask.type === 'choice') return `<div class="opts">${q.ask.choices.map((c, i) => `<button data-tc="${i}" ${lock ? 'disabled' : ''} class="${lock && i === q.ask.correct ? 'ok' : a.c === i ? (r && !r.ok && r.given === c ? 'bad' : 'on') : ''}">${esc(c)}</button>`).join('')}</div>`;
    return `<label class="f"><span>${esc(q.ask.label)} (${esc(q.ask.unit)})</span><div class="qin"><input data-in="1" inputmode="decimal" autocomplete="off" value="${esc(a.v || '')}" ${lock ? 'disabled' : ''}><span class="u">${esc(q.ask.unit)}</span></div>${eingabeHinweis(q)}</label>`;
  }
  function evalQ(q, a) {
    if (q.ask.type === 'choice') { if (a.c == null) { toast('Wähle zuerst eine Antwort.'); return null; } return { ok: a.c === q.ask.correct, given: q.ask.choices[a.c] }; }
    const v = P(a.v); if (!Number.isFinite(v)) { toast('Bitte gib eine Zahl ein (mit Komma oder Punkt).'); return null; }
    return { ok: Math.abs(v - q.value) <= q.tol + 1e-9, given: fv(v) + ' ' + q.ask.unit };
  }
  function fbHTML(q, r) {
    if (r.stufe === 'ok') return `<div class="lr-fb ok fb"><p><strong>✓ Richtig:</strong> ${esc(r.given)}</p><p><strong>Lösungsweg:</strong> ${esc(q.expl)}</p></div>`;
    const ist = '<strong>Noch nicht:</strong> Deine Antwort „' + esc(r.given) + '“ stimmt nicht.';
    if (r.stufe === 'tipp') return `<div class="lr-fb tipp fb"><p>${ist}</p><p><strong>Tipp:</strong> ${esc(q.tips[0])} Du hast einen zweiten Versuch.</p></div>`;
    if (r.stufe === 'loes') return `<div class="lr-fb loes fb"><p>${ist}</p><p><strong>Lösung:</strong> ${esc(solText(q))}</p><p><strong>Lösungsweg:</strong> ${esc(q.expl)}</p></div>`;
    return `<div class="lr-fb tipp fb"><p>${ist}</p><p>🎓 Prüfmodus: Den Lösungsweg gibt es erst, wenn die Aufgabe richtig gelöst ist. Nutze einen Tipp (kostet 25 %) oder versuche es noch einmal.</p></div>`;
  }

  function renderTasks(top) {
    const Vw = $('#taskView'), d = done(), prog = lsGet('prog', {}), t = curTask(), n100 = TASKS.filter(x => d[x.id]).length; let h = '';
    if (t) {
      const q = S.tq, r = S.tRes && S.tRes.id === t.id ? S.tRes : null, a = S.tAns[t.id] || {};
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv">${dots(t.level)}</div><p style="margin:8px 0">${esc(q.text)}</p>${vorHTML(q)}${qBody(q, a, r)}`;
      if (r) h += fbHTML(q, r);
      h += `<div class="btns"><button class="btn pri" data-ta="chk"${r && (r.ok || r.stufe === 'loes') ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" data-ta="hint">💡 Tipp</button><button class="btn" data-ta="close">Schließen</button></div>`;
      if (exam()) h += '<p class="hint2" style="color:var(--warn)">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>';
      if (r && (r.ok || r.stufe === 'loes')) h += '<div class="btns"><button class="btn pri" data-ta="next">Nächste Aufgabe</button></div>';
      h += '</div>';
    }
    h += `<p class="hint2" style="margin:4px 0 0">${n100} von ${TASKS.length} Aufgaben gelöst. ${exam() ? '🎓 Prüfmodus ist an.' : 'Tipp: Im Prüfmodus (🎓 oben) zählen Tipps als Abzug.'}</p><p class="hint2" style="margin:4px 0 0">⚠ ${esc(UEB)}</p>`;
    let last = '';
    TASKS.forEach(x => { if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; } const p = prog[x.id]; h += `<button class="row" data-t="${esc(x.id)}"><span class="dot ${d[x.id] ? 'g' : ''}">${d[x.id] ? '✓' : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${dots(x.level)}</span>${p != null && p < 100 ? ' · bisher ' + p + ' %' : ''}</small></div></button>`; });
    Vw.innerHTML = h; if (top !== false) $('#pgTasks').scrollTop = 0;
  }
  function checkTask(t) {
    const a = S.tAns[t.id] || {}, e = evalQ(S.tq, a); if (!e) return; const pct = e.ok ? pctFor(t.id) : 0;
    const fehl = e.ok ? 0 : (S.tFehl[t.id] = (S.tFehl[t.id] || 0) + 1); S.tRes = { id: t.id, ok: e.ok, given: e.given, pct, stufe: stufeFuer(e.ok, fehl, exam()) };
    if (e.ok) { markSolved(t.id, pct); const F = fx(); if (F && F.pass) try { F.pass(pct); } catch (er) {} else ding(); toast(exam() && pct < 100 ? pct + ' % (Tipps abgezogen)' : '🎉 Geschafft!'); } else { sad(); toast(S.tRes.stufe === 'loes' ? 'Lösung und Lösungsweg stehen unter der Aufgabe.' : 'Noch nicht richtig. Lies den Tipp und versuche es noch einmal.'); }
    renderTasks(false); zeigFb($('#taskView'));
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
    S.task = id; S.tq = D.makeTask(t); S.tAns = {}; S.tRes = null; S.tFehl[id] = 0;
    const h = lsGet('hints', {}), c = lsGet('ctipps', {}); if (h[id]) { delete h[id]; lsSet('hints', h); } if (c[id]) { delete c[id]; lsSet('ctipps', c); }
    renderTasks();
  }
  const tv = $('#taskView');
  tv.addEventListener('input', e => { const t = curTask(); if (t && e.target.dataset.in) (S.tAns[t.id] = S.tAns[t.id] || {}).v = e.target.value; });
  tv.addEventListener('keydown', e => { const t = curTask(); if (t && e.key === 'Enter' && e.target.dataset.in) { e.preventDefault(); checkTask(t); } });
  tv.addEventListener('click', e => {
    const t = curTask(), tc = e.target.closest('[data-tc]'), ta = e.target.closest('[data-ta]'), row = e.target.closest('.row[data-t]');
    if (tc && t) { (S.tAns[t.id] = S.tAns[t.id] || {}).c = +tc.dataset.tc; renderTasks(false); return; }
    if (ta && t) { const a = ta.dataset.ta; if (a === 'chk') checkTask(t); else if (a === 'hint') hintFor(S.tq, t.id); else if (a === 'close') { S.task = null; S.tRes = null; renderTasks(); } else if (a === 'next') { const i = TASKS.findIndex(x => x.id === t.id), nx = TASKS.slice(i + 1).find(x => !done()[x.id]) || TASKS[(i + 1) % TASKS.length]; startTask(nx.id); } return; }
    if (row) startTask(row.dataset.t);
  });

  /* Zufalls-Trainer (Tipps kosten hier nie etwas) */
  function newTrainer() { const T = S.tr; T.q = D.randomQ(R0, T.level); T.ans = {}; T.res = null; T.fehl = 0; renderTrainer(); }
  function renderTrainer() {
    const T = S.tr; if (!T.q) { newTrainer(); return; }
    const q = T.q;
    $('#rtView').innerHTML = `<div class="stats"><div class="bx"><b>${S.rt.n}</b>Fragen</div><div class="bx"><b>${S.rt.ok}</b>richtig</div><div class="bx"><b>${S.rt.streak}</b>Serie</div><div class="bx"><b>${S.rt.best}</b>Beste Serie</div></div>
      <div class="fbar"><span class="lbl2" style="font-size:14px;color:var(--mute)">STUFE</span><div class="seg">${[[0, 'Alle'], [1, '1'], [2, '2'], [3, '3']].map(l => `<button data-lv="${l[0]}" class="${T.level === l[0] ? 'on' : ''}">${l[1]}</button>`).join('')}</div></div>
      <div class="card pl"><h4>${esc(q.cat)} · <span class="lv">${dots(q.level)}</span></h4><div class="big">${esc(q.title)}</div><p style="margin:8px 0">${esc(q.text)}</p>${vorHTML(q)}${qBody(q, T.ans, T.res)}${T.res ? fbHTML(q, T.res) : ''}
      <div class="btns"><button class="btn pri" data-ra="chk" ${T.res && T.res.stufe !== 'tipp' ? 'disabled' : ''}>✓ Prüfen</button><button class="btn" data-ra="hint" ${T.res && T.res.stufe !== 'tipp' ? 'disabled' : ''}>💡 Tipp</button><button class="btn" data-ra="next">${T.res && T.res.stufe !== 'tipp' ? 'Nächste Frage' : 'Überspringen'}</button></div></div>`;
    if (T.res) zeigFb($('#rtView'));
  }
  const rv = $('#rtView');
  rv.addEventListener('input', e => { if (e.target.dataset.in) S.tr.ans.v = e.target.value; });
  rv.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.in) { e.preventDefault(); trainerCheck(); } });
  rv.addEventListener('click', e => {
    const T = S.tr, tc = e.target.closest('[data-tc]'), ra = e.target.closest('[data-ra]'), lv = e.target.closest('[data-lv]');
    if (lv) { T.level = +lv.dataset.lv; newTrainer(); return; }
    if (tc && (!T.res || T.res.stufe === 'tipp')) { T.ans.c = +tc.dataset.tc; renderTrainer(); return; }
    if (ra) { const a = ra.dataset.ra; if (a === 'chk') trainerCheck(); else if (a === 'hint') hintFor(T.q, 'rt'); else { if ((!T.res || T.res.stufe === 'tipp') && S.rt.streak) { S.rt.streak = 0; lsSet('rt', S.rt); } newTrainer(); updatePal(); } }
  });
  function trainerCheck() {
    const T = S.tr; if (T.res && T.res.stufe !== 'tipp') return; const e = evalQ(T.q, T.ans); if (!e) return;
    if (!e.ok && !T.fehl) { T.fehl = 1; T.res = { ok: false, given: e.given, stufe: 'tipp' }; sad(); renderTrainer(); return; }
    T.res = { ok: e.ok, given: e.given, stufe: e.ok ? 'ok' : 'loes' }; S.rt.n++; if (e.ok) { S.rt.ok++; S.rt.streak++; S.rt.best = Math.max(S.rt.best, S.rt.streak); ding(); } else { S.rt.streak = 0; sad(); }
    lsSet('rt', S.rt); renderTrainer(); updatePal();
  }

  /* ============================================================ Hilfe */
  function renderHelp() {
    const sec = (t, b, open) => `<details${open ? ' open' : ''}><summary>${t}</summary><div class="hb2">${b}</div></details>`;
    $('#helpView').innerHTML =
      `<div class="rdout warn">⚠ ${esc(UEB)}</div>` +
      sec('Timer und Vorteiler', `<span class="eq">Zählschritt = Vorteiler / Takt</span><span class="eq">Überlauf nach = Vorteiler · 2 hoch Bits / Takt</span><span class="eq">CTC: Treffer je s = Takt / (Vorteiler · (OCR + 1))</span><span class="eq">OCR = Takt / (Vorteiler · Frequenz) − 1</span><p>Der Vorteiler teilt den Takt, damit der Zähler langsamer läuft. Der Vergleichswert muss in das Register passen: 8 Bit bis 255, 16 Bit bis 65535. Ein Ausgang, der bei jedem Treffer kippt, schwingt mit der halben Trefferfrequenz.</p><p class="hint2">Registernamen wie TCCR0B, OCR0A und TIMSK0 gehören zu einem üblichen 8-Bit-Controller, die Bits für den Vorteiler stehen im Datenblatt.</p>`, true) +
      sec('PWM und Mittelwert', `<span class="eq">Tastgrad = OCR / 255 (8 Bit)</span><span class="eq">PWM-Frequenz = Takt / (Vorteiler · 256)</span><span class="eq">Mittelwert = Tastgrad · Betriebsspannung</span><p>Bei PWM schaltet der Ausgang schnell zwischen Low und High. Ein Tiefpass, eine LED oder ein Motor mittelt das Signal. Ist die Frequenz zu klein, flackert die LED sichtbar.</p>`) +
      sec('AD-Wandler', `<span class="eq">Stufen = 2 hoch Bits</span><span class="eq">1 LSB = Referenz / Stufen</span><span class="eq">Rohwert = Eingang / 1 LSB, abgeschnitten</span><span class="eq">Spannung = Rohwert · 1 LSB</span><p>Die Referenz bestimmt den Messbereich. Wähle die kleinste Referenz, die den größten Messwert noch abdeckt, dann ist ein Digit am kleinsten. Größere Spannungen teilst du vor dem Eingang mit einem Spannungsteiler herunter. Beim Rechnen im Programm zuerst multiplizieren, dann teilen, und einen Datentyp wählen, der groß genug ist.</p>`) +
      sec('Interrupts und ISR', `<span class="eq">Drehzahl = Impulse / Impulse je Umdrehung / Zeit · 60</span><span class="eq">Last der ISR = Dauer der ISR · Aufrufe je Sekunde</span><p>Ein Interrupt unterbricht das Hauptprogramm. Damit er ankommt, muss das Freigabe-Bit gesetzt und mit sei() global freigegeben sein. Die ISR bleibt kurz: Flag setzen, Wert holen, fertig. Variablen, die ISR und loop() teilen, bekommen volatile. Prellen eines Tasters fängst du mit einer Sperrzeit ab: Nur eine Flanke, die mehr als die Sperrzeit nach der letzten gezählten kommt, zählt.</p>`) +
      sec('millis() und Zustandsautomat', `<span class="eq">if (millis() − tLast ≥ Dauer) { tLast = millis(); ... }</span><span class="eq">Zustand zur Zeit t = Abschnitt von (t mod Durchlauf)</span><p>delay() hält das ganze Programm an, millis() nicht. Der Zähler ist 32 Bit breit und springt nach etwa 49,7 Tagen auf 0. Die Differenz jetzt − tLast bleibt dank der Rechnung ohne Vorzeichen (unsigned long) auch über den Sprung richtig. Die Form jetzt ≥ tLast + Intervall macht dort Fehler.</p>`) +
      sec('Energiesparen', `<span class="eq">mittlerer Strom = (Ia · ta + Is · (T − ta)) / T</span><span class="eq">Laufzeit in h = Kapazität in µAh / mittlerer Strom in µA</span><p>Meist verbraucht die kurze Aktivphase den größten Teil der Ladung, auch wenn sie nur kurz dauert. Prüfe immer beide Wege: die Aktivzeit verkürzen oder den Schlafstrom senken, und rechne nach, welcher mehr bringt.</p>`) +
      `<p class="hint2">Alle Zahlen sind Übungswerte.</p>`;
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  const RENDER = { tim: renderTim, adc: renderAdc, zus: renderZus, slp: renderSlp, tasks: renderTasks, rt: renderTrainer, help: renderHelp };
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'tim'; S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    RENDER[t]();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'Mikrocontroller-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = 'Mikrocontroller-Lab: ' + T[2];
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
  $('#title').onclick = () => setTab('tim');
  $('#bMenu').onclick = () => {
    const rows = [['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung und Tipps'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Aufgaben mit Serien-Zähler'], ['help', 'Hilfe und Formeln', 'Timer, PWM, AD-Wandler, Interrupts, millis, Energiesparen'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben und Trainer-Serie auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
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
  root.MIK_LAB = { id: 'mik', title: 'Mikrocontroller-Lab', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.MIK_TASKS };

  buildTabs(); updatePal(); setTab(TABS.some(x => x[0] === S.tab) ? S.tab : 'tim');
  /* Aufruf ?aufgabe=mik1 (Startseite, Lernhefte) öffnet die Aufgabe */
  root.LabGoto = id => { try { if (TASKS.some(t => t.id === id)) { setTab('tasks'); startTask(id); return true; } } catch (e) {} return false; };
  try { const qa = new URLSearchParams(location.search).get('aufgabe'); if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); } } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
