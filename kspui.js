'use strict';
/* Tonfunk Kleinsteuerungs-Lab: Oberfläche (Lab-Kennung 'ksp').
   ALLE Zahlen (Spannungen, Ströme, Zeiten, Schaltabstände, Reduktionsfaktoren) sind ÜBUNGSWERTE für die Ausbildung, nicht für die Praxis.
   Reiter: Selbsthaltung (Stromlaufplan zum Bedienen), Funktionsplan (Bausteine mit Zeitdiagramm), Elektropneumatik (Zylinder mit 5/2-Ventil), Sensor (Eingang mit Hysterese und Fehlern),
           Aufgaben, Trainer, Hilfe.
   Module: kspcore.js (KSP_CORE, Rechenlogik), kspdata.js (KSP_DATA, KSP_TASKS, KSP_LAB), kspviz.js (KSP_VIZ, Bilder).
   Speicher (Präfix lm4.ksp.): tab, sh, fup, ep, sen, done ({id:true} nur gelöste), prog ({id:Prozent}), hints, ctipps (nur Prüfmodus), exam ('1'), rt (Trainer).
   Tipp-Abzug (25 % je Stufe, höchstens 2 Stufen) gibt es nur im Prüfmodus; beim normalen Üben kosten Tipps nichts.
   Aufruf: ksplab.html?aufgabe=ksp1 öffnet die Aufgabe. */
(function (root) {
  const C = root.KSP_CORE, D = root.KSP_DATA, V = root.KSP_VIZ;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.ksp.';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(LS + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} };
  const f = (v, d) => C.fmtN(v, d == null ? 2 : d, true), P = s => C.parseDe(s);
  const dots = l => '●'.repeat(l || 1) + '○'.repeat(3 - (l || 1));
  const fx = () => root.LochFX || null;
  const ding = () => { const F = fx(); if (F && F.sound) try { F.sound('ding', 0.6); } catch (e) {} };
  const sad = () => { const F = fx(); if (F && F.sound) try { F.sound('sad', 0.5); } catch (e) {} };
  const calm = () => { try { return root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
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
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>Kleinsteuerungs-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">kspcore.js, kspdata.js oder kspviz.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks;

  /* ============================================================ Zustand */
  const TABS = [['sh', '🔌', 'Selbsthaltung'], ['fup', '🧩', 'Funktionsplan'], ['ep', '🛠️', 'Elektropneumatik'], ['sen', '📡', 'Sensor'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['help', '📘', 'Hilfe']];
  const SLOTS = 6, SLOT_S = 3, T_END = SLOTS * SLOT_S;
  const PRESET = {
    und: { a: [0, 1, 1, 0, 1, 1], b: [0, 0, 1, 1, 1, 0] }, oder: { a: [0, 1, 1, 0, 1, 1], b: [0, 0, 1, 1, 1, 0] },
    sr: { a: [1, 0, 0, 0, 1, 0], b: [0, 0, 0, 1, 1, 0] },
    ton: { T: 4, a: [0, 1, 0, 1, 1, 0], b: [0, 0, 0, 0, 0, 0] }, tof: { T: 3, a: [0, 1, 0, 1, 0, 0], b: [0, 0, 0, 0, 0, 0] }, wisch: { T: 4, a: [0, 1, 1, 0, 1, 0], b: [0, 0, 0, 0, 0, 0] },
    zaehl: { S: 3, mode: 'auf', a: [1, 0, 1, 0, 1, 0], b: [0, 0, 0, 0, 0, 1] }
  };
  const PROGS = [['und', 'UND'], ['oder', 'ODER'], ['sr', 'RS'], ['ton', 'TON'], ['tof', 'TOF'], ['wisch', 'Wischer'], ['zaehl', 'Zähler']];
  const PEXPL = {
    und: 'UND: Q ist nur 1, wenn I1 und I2 beide 1 sind.', oder: 'ODER: Q ist 1, wenn mindestens ein Eingang 1 ist.',
    sr: 'RS-Speicher: I1 setzt Q, I2 setzt zurück. Sind beide 1, gewinnt das Rücksetzen.',
    ton: 'TON (Einschaltverzögerung): Q wird erst 1, wenn I1 die ganze Zeit T lang 1 war. Ein kürzerer Impuls bewirkt nichts.',
    tof: 'TOF (Ausschaltverzögerung): Q wird sofort 1 und bleibt nach dem Abfall von I1 noch die Zeit T an.',
    wisch: 'Wischer: Eine steigende Flanke an I1 startet einen Impuls fester Länge T. Während er läuft, ändert nichts etwas.',
    zaehl: 'Zähler: Jede steigende Flanke an I1 zählt. I2 setzt zurück. Q ist 1, wenn der Sollwert erreicht ist (Aufwärts) bzw. 0 erreicht ist (Abwärts).'
  };
  const S = {
    tab: lsGet('tab', 'sh'),
    sh: Object.assign({ mode: 'sh', vorrang: 'aus', verr: true, netz: true }, lsGet('sh', {})),
    fup: Object.assign({ prog: 'ton' }, lsGet('fup', {})),
    ep: Object.assign({ ventil: 'mono', T: 2, mode: 'hand', imp: 0.5 }, lsGet('ep', {})),
    sen: Object.assign({ prinz: 'ind', mat: 'stahl', typ: 'pnp', fkt: 's', d: '12', fehler: 'keiner' }, lsGet('sen', {})),
    task: null, tq: null, tAns: {}, tRes: null, tFehl: {},
    tr: { q: null, ans: {}, res: null, level: 0 },
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {}))
  };
  /* gespeicherte Werte prüfen */
  const oneOf = (v, a, d) => (a.includes(v) ? v : d);
  S.sh.mode = oneOf(S.sh.mode, ['sh', 'wende'], 'sh'); S.sh.vorrang = oneOf(S.sh.vorrang, ['aus', 'ein'], 'aus'); S.sh.verr = S.sh.verr !== false; S.sh.netz = S.sh.netz !== false;
  S.fup.prog = oneOf(S.fup.prog, PROGS.map(p => p[0]), 'ton');
  const okSl = a => Array.isArray(a) && a.length === SLOTS && a.every(v => v === 0 || v === 1);
  function fupLoad(prog) { const p = PRESET[prog]; Object.assign(S.fup, { prog, T: p.T || 3, S: p.S || 3, mode: p.mode || 'auf', a: p.a.slice(), b: p.b.slice() }); }
  if (!okSl(S.fup.a) || !okSl(S.fup.b) || !(S.fup.T > 0) || !(S.fup.S >= 1)) fupLoad(S.fup.prog);
  S.fup.mode = oneOf(S.fup.mode, ['auf', 'ab'], 'auf');
  S.ep.ventil = oneOf(S.ep.ventil, ['mono', 'bi'], 'mono'); S.ep.mode = oneOf(S.ep.mode, ['hand', 'auto'], 'hand'); S.ep.T = oneOf(S.ep.T, [1, 2, 3], 2); S.ep.imp = oneOf(S.ep.imp, [0.3, 0.5, 1], 0.5);
  S.sen.prinz = oneOf(S.sen.prinz, ['ind', 'kap'], 'ind'); S.sen.mat = oneOf(S.sen.mat, ['stahl', 'alu', 'kunst'], 'stahl'); S.sen.typ = oneOf(S.sen.typ, ['pnp', 'npn'], 'pnp'); S.sen.fkt = oneOf(S.sen.fkt, ['s', 'o'], 's');
  S.sen.fehler = oneOf(S.sen.fehler, ['keiner', 'braun', 'blau', 'schwarz'], 'keiner'); if (!(P(S.sen.d) >= 0 && P(S.sen.d) <= 20)) S.sen.d = '12';
  const R0 = (() => { const m = /[?&]seed=([^&]+)/.exec(location.search); return C.rng(m ? decodeURIComponent(m[1]) : String(Math.random()) + Date.now()); })();

  /* ============================================================ Bausteine */
  const box = (t, fm, res, cls) => `<div class="rdout ${cls || ''}"><span class="st">${esc(t)}</span>${fm ? esc(fm) + ' = ' : ''}<b>${esc(res)}</b></div>`;
  const note = (t, cls) => `<div class="rdout ${cls || 'warn'}">${esc(t)}</div>`;
  const UEB = 'Alle Zahlen in diesem Lab (Spannungen, Ströme, Zeiten, Schaltabstände, Reduktionsfaktoren) sind Übungswerte für die Ausbildung, nicht für die Praxis. Maßgebend sind immer Datenblatt, Schaltplan und Betriebsanweisung deines Betriebs.';
  const ueb = () => `<div class="rdout warn">⚠ ${esc(UEB)}</div>`;
  const seg = (attr, opts, cur) => `<div class="seg">${opts.map(o => `<button ${attr}="${esc(o[0])}" class="${String(cur) === String(o[0]) ? 'on' : ''}">${esc(o[1])}</button>`).join('')}</div>`;
  const lbl = t => `<span class="lbl2">${esc(t)}</span>`;
  const fbar = (t, s) => `<div class="fbar">${lbl(t)}${s}</div>`;
  const sc = v => String(v).replace('.', ',');

  /* ============================================================ Selbsthaltung */
  const shS = { k1: false, k2: false, s1: false, s2: false, s3: false };
  const shCfg = () => ({ mode: S.sh.mode, vorrang: S.sh.vorrang, verr: S.sh.verr, netz: S.sh.netz });
  function shDraw() {
    const r = C.shSettle(shCfg(), { k1: shS.k1, k2: shS.k2 }, shS); shS.k1 = r.k1; shS.k2 = r.k2;
    const p = Object.assign({}, shCfg(), shS), w = p.mode === 'wende';
    $('#shSvg').innerHTML = V.sh(p);
    let h = box('Schütz K1', '', shS.k1 ? 'angezogen' : 'abgefallen', shS.k1 ? 'ok' : '') + (w ? box('Schütz K2', '', shS.k2 ? 'angezogen' : 'abgefallen', shS.k2 ? 'ok' : '') : '');
    if (w && shS.k1 && shS.k2) h += note('K1 und K2 sind zugleich angezogen: Zwei Phasen sind über die Kontakte verbunden, das ist ein Kurzschluss. Genau das verhindert die Verriegelung mit den Öffnern 21/22.', 'bad');
    else if (!S.sh.netz && !shS.k1 && !shS.k2) h += note('Ohne Spannung fallen die Schütze ab. Wenn die Spannung zurückkommt, bleiben sie aus, bis jemand wieder einschaltet. Das ist die Nullspannungssicherheit.', 'ok');
    else if (!w && shS.k1 && !shS.s1) h += note('S1 ist losgelassen und K1 bleibt trotzdem an: Der Selbsthaltekontakt 13/14 hält die Spule.', 'ok');
    else if (w && !S.sh.verr && !(shS.k1 && shS.k2)) h += note('Ohne Verriegelung: Drücke S1 und S3 zugleich und achte auf K1 und K2.', 'warn');
    $('#shOut').innerHTML = h;
  }
  function renderSh() {
    const s = S.sh, w = s.mode === 'wende';
    $('#shView').innerHTML = `<div id="shSvg" class="inst ks"></div><div class="card pl"><h4>Schaltung bedienen</h4>
      <p class="hint2" style="margin:0 0 8px">Halte einen Taster gedrückt und lass ihn wieder los. Blaue Leitungen führen Strom.</p>
      <div class="tks"><button class="tk" data-tk="s1">${w ? 'S1 Rechts' : 'S1 Ein'}</button><button class="tk" data-tk="s2">S2 Aus</button>${w ? '<button class="tk" data-tk="s3">S3 Links</button>' : ''}</div>
      ${fbar('SCHALTUNG', seg('data-sm', [['sh', 'Selbsthaltung'], ['wende', 'Wendeschaltung']], s.mode))}
      ${w ? fbar('VERRIEGELUNG', seg('data-sv', [['1', 'mit Öffnern'], ['0', 'ohne']], s.verr ? '1' : '0')) : fbar('VORRANG', seg('data-sr', [['aus', 'Aus zuerst'], ['ein', 'Ein zuerst']], s.vorrang))}
      ${fbar('SPANNUNG', seg('data-sn', [['1', 'an'], ['0', 'aus']], s.netz ? '1' : '0'))}
      <div id="shOut"></div></div>` + ueb();
    shDraw();
  }
  const shHeld = new Set();
  function shPress(k, on) { if (on) shHeld.add(k); else shHeld.delete(k); shS[k] = on; const b = $('[data-tk="' + k + '"]'); if (b) b.classList.toggle('on', on); shDraw(); }
  function shRelease() { [...shHeld].forEach(k => shPress(k, false)); }
  $('#shView').addEventListener('pointerdown', e => { const b = e.target.closest('[data-tk]'); if (b) { e.preventDefault(); shPress(b.dataset.tk, true); } });
  ['pointerup', 'pointercancel'].forEach(n => document.addEventListener(n, shRelease));
  $('#shView').addEventListener('keydown', e => { const b = e.target.closest('[data-tk]'); if (b && (e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); shPress(b.dataset.tk, true); } });
  $('#shView').addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') shRelease(); });
  $('#shView').addEventListener('click', e => {
    const m = e.target.closest('[data-sm]'), v = e.target.closest('[data-sv]'), r = e.target.closest('[data-sr]'), n = e.target.closest('[data-sn]'); if (!(m || v || r || n)) return;
    if (m) { S.sh.mode = m.dataset.sm; shS.k1 = shS.k2 = false; } else if (v) S.sh.verr = v.dataset.sv === '1'; else if (r) S.sh.vorrang = r.dataset.sr; else S.sh.netz = n.dataset.sn === '1';
    lsSet('sh', S.sh); renderSh();
  });

  /* ============================================================ Funktionsplan */
  let fupTimer = 0, fupNow = T_END;
  const fupEv = () => S.fup.a.map((v, i) => ({ t: i * SLOT_S, i1: v, i2: S.fup.b[i] }));
  const fupP = () => ({ prog: S.fup.prog, T: S.fup.T, S: S.fup.S, mode: S.fup.mode, ev: fupEv(), tEnd: T_END, tNow: fupNow });
  function fupDraw() {
    const p = fupP(), tr = C.fupTrace(p.prog, p, p.ev, T_END), tm = fupNow;
    $('#fupSvg').innerHTML = V.fup(p);
    const last = tr.t.length - 1, k = Math.min(last, Math.round(tm / tr.dt));
    let h = `<div class="rdout">${esc(PEXPL[p.prog])}</div>`;
    h += box('Q war insgesamt eingeschaltet', '', f(C.onTime({ q: tr.q.slice(0, k + 1), dt: tr.dt }), 2) + ' s');
    if (p.prog === 'zaehl') h += box('Zählerstand jetzt', '', String(tr.z[k]) + ' von ' + p.S, tr.q[k] ? 'ok' : '');
    $('#fupOut').innerHTML = h;
    const r = $('#fupNow'); if (r && document.activeElement !== r) r.value = String(tm);
  }
  function fupStop() { clearInterval(fupTimer); fupTimer = 0; const b = $('[data-fk="play"]'); if (b) b.textContent = '▶ Ablauf abspielen'; }
  function renderFup() {
    const s = S.fup, two = !['ton', 'tof', 'wisch'].includes(s.prog), tim = ['ton', 'tof', 'wisch'].includes(s.prog), cells = (k, a) => a.map((v, i) => `<button class="sl${v ? ' on' : ''}" data-sl="${k}:${i}" aria-label="${k === 'a' ? 'I1' : 'I2'} im Zeitfeld ${i + 1}, ${v ? 'an' : 'aus'}">${v}</button>`).join('');
    $('#fupView').innerHTML = `<div id="fupSvg" class="inst ks"></div><div class="card pl"><h4>Baustein und Eingänge</h4>
      ${fbar('BAUSTEIN', seg('data-fp', PROGS, s.prog))}
      ${tim ? fbar('ZEIT T', seg('data-ft', [1, 2, 3, 4, 5].map(x => [x, x + ' s']), s.T)) : ''}
      ${s.prog === 'zaehl' ? fbar('SOLLWERT', seg('data-fs', [2, 3, 4].map(x => [x, String(x)]), s.S)) + fbar('ZÄHLART', seg('data-fm', [['auf', 'aufwärts'], ['ab', 'abwärts']], s.mode)) : ''}
      <p class="hint2" style="margin:6px 0">Jedes Kästchen steht für ${SLOT_S} Sekunden. Tippe darauf, um 0 oder 1 zu wechseln.</p>
      <div class="slr"><b>I1</b>${cells('a', s.a)}</div>${two ? `<div class="slr"><b>I2</b>${cells('b', s.b)}</div>` : ''}
      <div class="btns"><button class="btn pri" data-fk="play">▶ Ablauf abspielen</button><button class="btn" data-fk="reset">Beispiel laden</button></div>
      <label class="f"><span>Zeitpunkt im Ablauf (s)</span><input id="fupNow" data-fk="now" type="range" min="0" max="${T_END}" step="0.05" value="${fupNow}"></label>
      <div id="fupOut"></div></div>` + ueb();
    fupDraw();
  }
  $('#fupView').addEventListener('click', e => {
    const p = e.target.closest('[data-fp]'), t = e.target.closest('[data-ft]'), z = e.target.closest('[data-fs]'), m = e.target.closest('[data-fm]'), sl = e.target.closest('[data-sl]'), fk = e.target.closest('button[data-fk]');
    if (!(p || t || z || m || sl || fk)) return;
    if (p) { fupLoad(p.dataset.fp); fupNow = T_END; fupStop(); }
    else if (t) S.fup.T = +t.dataset.ft; else if (z) S.fup.S = +z.dataset.fs; else if (m) S.fup.mode = m.dataset.fm;
    else if (sl) { const [k, i] = sl.dataset.sl.split(':'), a = S.fup[k]; a[+i] = a[+i] ? 0 : 1; fupNow = T_END; fupStop(); }
    else if (fk.dataset.fk === 'reset') { fupLoad(S.fup.prog); fupNow = T_END; fupStop(); }
    else if (fk.dataset.fk === 'play') {
      if (fupTimer) { fupStop(); return; }
      if (calm()) { fupNow = T_END; fupDraw(); return; }
      fupNow = 0; fk.textContent = '■ Anhalten';
      fupTimer = setInterval(() => { fupNow = Math.min(T_END, Math.round((fupNow + 0.18) * 100) / 100); fupDraw(); if (fupNow >= T_END) fupStop(); }, 60);
    }
    lsSet('fup', S.fup); renderFup();
  });
  $('#fupView').addEventListener('input', e => { if (e.target.dataset.fk !== 'now') return; fupStop(); fupNow = +e.target.value; fupDraw(); });

  /* ============================================================ Elektropneumatik */
  const ep = { x: 0, lat: 0, dir: 0, y1: false, y2: false, ph: 0, start: false, sig: '' };
  const epCfg = () => ({ ventil: S.ep.ventil, T: S.ep.T });
  function epDraw(force) {
    const p = { x: ep.x, dir: ep.dir, ventil: S.ep.ventil, y1: ep.y1, y2: ep.y2 }, sig = [ep.x.toFixed(3), ep.dir, ep.lat, ep.y1, ep.y2, S.ep.ventil].join('|');
    if (!force && sig === ep.sig) return; ep.sig = sig;
    $('#epSvg').innerHTML = V.ep(p);
    const cfg = epCfg(), bi = cfg.ventil === 'bi';
    let h = box('Kolben', '', f(ep.x * 100, 0) + ' % des Hubs');
    h += box('Rückmeldung', '', 'B1 ' + (C.epB1(ep.x) ? 'an (hinten)' : 'aus') + ', B2 ' + (C.epB2(ep.x) ? 'an (vorn)' : 'aus'), C.epB1(ep.x) || C.epB2(ep.x) ? 'ok' : '');
    h += box('Wenn die Steuerspannung jetzt ausfällt', 'Kolben steht danach bei', f(C.epPowerLoss(cfg, ep.x, ep.lat), 0) + ' % des Hubs');
    if (ep.y1 && ep.y2) h += note(bi ? 'Beide Spulen sind bestromt: In diesem Übungsmodell bleibt das Ventil in der letzten Stellung. Im echten Aufbau ist das ein Fehler, den du vermeiden musst.' : 'Y2 gibt es nur beim bistabilen Ventil.');
    $('#epOut').innerHTML = h;
    const ph = $('#epPh'); if (ph) ph.textContent = S.ep.mode === 'auto' ? (ep.ph === 0 ? 'Ruhe, bereit für den Start' : ep.ph === 1 ? 'Phase A+: Zylinder fährt aus' : 'Phase A-: Zylinder fährt ein') : '';
  }
  function epTick() {
    if (S.tab !== 'ep' || !$('#epSvg')) return;
    const cfg = epCfg();
    if (S.ep.mode === 'auto') { const a = C.epAuto(cfg, ep.ph, ep.start, ep.x); ep.ph = a.ph; ep.y1 = a.y1; ep.y2 = a.y2; ep.start = false; }
    const r = C.epStep(cfg, { x: ep.x, lat: ep.lat }, ep.y1, ep.y2 && cfg.ventil === 'bi', calm() ? cfg.T : 0.05);
    ep.x = r.x; ep.lat = r.lat; ep.dir = r.dir; epDraw(false);
  }
  setInterval(epTick, 50);
  function renderEp() {
    const s = S.ep, bi = s.ventil === 'bi', imp = C.epPulse({ ventil: s.ventil, T: s.T }, s.imp, 0);
    if (ep.dir === undefined) ep.dir = 0;
    $('#epView').innerHTML = `<div id="epSvg" class="inst ks"></div><div class="card pl"><h4>Zylinder ansteuern</h4>
      ${fbar('VENTIL', seg('data-ev', [['mono', 'monostabil'], ['bi', 'bistabil']], s.ventil))}
      ${fbar('HUBZEIT', seg('data-et', [1, 2, 3].map(x => [x, x + ' s']), s.T))}
      ${fbar('BETRIEB', seg('data-em', [['hand', 'von Hand'], ['auto', 'Ablauf A+ A-']], s.mode))}
      ${s.mode === 'hand' ? `<div class="tks"><button class="tg${ep.y1 ? ' on' : ''}" data-ey="y1" aria-pressed="${ep.y1}">Y1 Ausfahren ${ep.y1 ? 'an' : 'aus'}</button>${bi ? `<button class="tg${ep.y2 ? ' on' : ''}" data-ey="y2" aria-pressed="${ep.y2}">Y2 Einfahren ${ep.y2 ? 'an' : 'aus'}</button>` : ''}</div>` : `<div class="btns"><button class="btn pri" data-ea="start">▶ Start</button></div><p class="hint2" id="epPh"></p>`}
      <div id="epOut"></div></div>
      <div class="card pl"><h4>Kurzer Impuls auf Y1</h4><p class="hint2" style="margin:0 0 6px">Y1 wird nur kurz bestromt, danach ist die Spule wieder stromlos. Wie weit kommt der Kolben aus der hinteren Endlage?</p>
      ${fbar('IMPULSLÄNGE', seg('data-ei', [0.3, 0.5, 1].map(x => [x, sc(x) + ' s']), s.imp))}
      ${box('Y1 für ' + sc(s.imp) + ' s bei Hubzeit ' + s.T + ' s', 'größte Ausfahrt', f(imp.max, 0) + ' % des Hubs')}${box('Stellung am Ende', bi ? 'bistabil' : 'monostabil', f(imp.end, 0) + ' % des Hubs')}</div>` + ueb();
    epDraw(true);
  }
  $('#epView').addEventListener('click', e => {
    const v = e.target.closest('[data-ev]'), t = e.target.closest('[data-et]'), m = e.target.closest('[data-em]'), y = e.target.closest('[data-ey]'), a = e.target.closest('[data-ea]'), i = e.target.closest('[data-ei]');
    if (!(v || t || m || y || a || i)) return;
    if (v) { S.ep.ventil = v.dataset.ev; ep.lat = 0; ep.y2 = false; } else if (t) S.ep.T = +t.dataset.et; else if (i) S.ep.imp = +i.dataset.ei;
    else if (m) { S.ep.mode = m.dataset.em; ep.y1 = ep.y2 = false; ep.ph = 0; }
    else if (y) ep[y.dataset.ey] = !ep[y.dataset.ey]; else if (a) { ep.start = true; return; }
    lsSet('ep', S.ep); renderEp();
  });

  /* ============================================================ Sensor */
  let senAkt = false;
  const SEN_KURZ = { braun: '+24 V ab', blau: '0 V ab', schwarz: 'Signal ab' };
  function senP() { return { prinz: S.sen.prinz, mat: S.sen.mat, d: P(S.sen.d), typ: S.sen.typ, fkt: S.sen.fkt, aktiv: senAkt, fehler: S.sen.fehler }; }
  function senDraw() {
    const p = senP(), sr = C.srOf(p.prinz, p.mat), pr = C.PRINZ[p.prinz];
    senAkt = C.senState(senAkt, p.d, sr); p.aktiv = senAkt;
    $('#senSvg').innerHTML = V.sen(p);
    const s2 = C.sensorSim(p);
    let h = box('Nenn-Schaltabstand Sn', '', f(pr.sn, 0) + ' mm') + box('Reduzierter Schaltabstand Sr für ' + C.MAT[p.mat], f(pr.sn, 0) + ' mm · ' + sc(pr.mat[p.mat]), sr > 0 ? f(sr, 1) + ' mm' : 'wird nicht erkannt');
    if (sr > 0) h += box('Empfohlener Arbeitsabstand (80 % von Sr)', '0,8 · ' + f(sr, 1), f(0.8 * sr, 1) + ' mm') + box('Wieder aus ab (Hysterese ' + f(C.HYST * 100, 0) + ' %)', f(sr, 1) + ' · ' + sc(1 + C.HYST), f(sr * (1 + C.HYST), 1) + ' mm');
    h += box('Spannung am Eingang E1', '', f(s2.eingang, 0) + ' V', s2.eingangLed ? 'ok' : '');
    h += note(s2.wert === 1 ? 'Eingang E1 liest eine 1.' : 'Eingang E1 liest eine 0.', s2.wert === 1 ? 'ok' : 'warn');
    const fe = C.SEN_FEHLER.find(x => x.p.fehler === p.fehler); if (fe) h += note('Fehlerbild: ' + fe.n + '. Miss die Spannungen im Bild nach: Hier liegt der Fehler.', 'bad');
    if (p.typ === 'npn' && p.fehler === 'keiner') h += note('Ein NPN-Sensor schaltet 0 V. Der Eingang dieser Kleinsteuerung erwartet +24 V für eine 1. Darum bleibt E1 immer 0.', 'bad');
    $('#senOut').innerHTML = h;
  }
  function renderSen() {
    const s = S.sen, sr = C.srOf(s.prinz, s.mat);
    $('#senView').innerHTML = `<div id="senSvg" class="inst ks"></div><div class="card pl"><h4>Sensor einstellen</h4>
      <label class="f"><span>Abstand des Werkstücks (mm)</span><input id="senD" data-nk="d" type="range" min="0" max="20" step="0.5" value="${esc(s.d)}"></label>
      ${fbar('PRINZIP', seg('data-np', [['ind', 'induktiv'], ['kap', 'kapazitiv']], s.prinz))}
      ${fbar('WERKSTOFF', seg('data-nm', Object.keys(C.MAT).map(k => [k, C.MAT[k]]), s.mat))}
      ${fbar('SCHALTART', seg('data-nt', [['pnp', 'PNP'], ['npn', 'NPN']], s.typ) + seg('data-nf', [['s', 'Schließer'], ['o', 'Öffner']], s.fkt))}
      ${fbar('LEITUNGSFEHLER', seg('data-ne', [['keiner', 'keiner']].concat(C.SEN_FEHLER.filter(x => x.p.fehler !== 'keiner').map(x => [x.k, SEN_KURZ[x.k]])), s.fehler))}
      ${sr > 0 ? '' : note('Dieser Werkstoff wird von diesem Sensor nicht erkannt. Der Reduktionsfaktor ist 0.')}
      <div id="senOut"></div></div>` + ueb();
    senDraw();
  }
  $('#senView').addEventListener('click', e => {
    const m = [['np', 'prinz'], ['nm', 'mat'], ['nt', 'typ'], ['nf', 'fkt'], ['ne', 'fehler']].find(x => e.target.closest('[data-' + x[0] + ']')); if (!m) return;
    S.sen[m[1]] = e.target.closest('[data-' + m[0] + ']').dataset[m[0]]; lsSet('sen', S.sen); renderSen();
  });
  $('#senView').addEventListener('input', e => { if (e.target.dataset.nk !== 'd') return; S.sen.d = e.target.value; lsSet('sen', S.sen); senDraw(); });

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
  const solText = q => (q.ask.type === 'choice' ? q.ask.choices[q.ask.correct] : f(q.value, 2) + ' ' + q.ask.unit);
  const eingabeHinweis = q => q.ask.type === 'num' ? `<p class="lr-hinweis hint2">Zahl in ${esc(q.ask.unit)}.${q.tol > 0.011 ? ' ±' + esc(f(q.tol, 2)) + ' ' + esc(q.ask.unit) + ' gelten als richtig (wegen Rundung).' : ''}</p>` : '';
  const stufeFuer = (ok, fehl, ex) => ok ? 'ok' : ex ? 'pruef' : fehl >= 2 ? 'loes' : 'tipp';
  const zeigFb = el => { try { const x = el && el.querySelector('.lr-fb'); if (x && root.LabRahmen) root.LabRahmen.zeig(x); } catch (e) {} };
  /* "So gehst du vor": die Schritte der Aufgabe in Kurzform, jeder Schritt eine Zeile */
  const goHTML = q => q.go ? `<div class="dt go"><details open><summary>So gehst du vor</summary><div class="hb2">${esc(q.go).split(/\s(?=\d\.\s)/).map(x => '<p>' + x + '</p>').join('')}</div></details></div>` : '';
  function qBody(q, a, r) {
    const lock = r && (r.ok || r.stufe === 'loes');
    if (q.ask.type === 'choice') return `<div class="opts">${q.ask.choices.map((c, i) => `<button data-tc="${i}" ${lock ? 'disabled' : ''} class="${lock && i === q.ask.correct ? 'ok' : a.c === i ? (r && !r.ok && r.given === c ? 'bad' : 'on') : ''}">${esc(c)}</button>`).join('')}</div>`;
    return `<label class="f"><span>${esc(q.ask.label)} (${esc(q.ask.unit)})</span><div class="qin"><input data-in="1" inputmode="decimal" autocomplete="off" value="${esc(a.v || '')}" ${lock ? 'disabled' : ''}><span class="u">${esc(q.ask.unit)}</span></div>${eingabeHinweis(q)}</label>`;
  }
  function evalQ(q, a) {
    if (q.ask.type === 'choice') { if (a.c == null) { toast('Wähle zuerst eine Antwort.'); return null; } return { ok: a.c === q.ask.correct, given: q.ask.choices[a.c] }; }
    const v = P(a.v); if (!Number.isFinite(v)) { toast('Bitte gib eine Zahl ein (mit Komma oder Punkt).'); return null; }
    return { ok: Math.abs(v - q.value) <= q.tol + 1e-9, given: f(v, 2) + ' ' + q.ask.unit };
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
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv">${dots(t.level)}</div><p style="margin:8px 0">${esc(q.text)}</p>${goHTML(q)}${qBody(q, a, r)}`;
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
      <div class="fbar"><span class="lbl2">STUFE</span><div class="seg">${[[0, 'Alle'], [1, '1'], [2, '2'], [3, '3']].map(l => `<button data-lv="${l[0]}" class="${T.level === l[0] ? 'on' : ''}">${l[1]}</button>`).join('')}</div></div>
      <div class="card pl"><h4>${esc(q.cat)} · <span class="lv">${dots(q.level)}</span></h4><div class="big">${esc(q.title)}</div><p style="margin:8px 0">${esc(q.text)}</p>${goHTML(q)}${qBody(q, T.ans, T.res)}${T.res ? fbHTML(q, T.res) : ''}
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
      sec('Relais, Schütz, Selbsthaltung', `<p>Ein <b>Schütz</b> schaltet große Ströme, ein <b>Relais</b> kleine. Beide haben eine Spule und Kontakte. Zieht die Spule an, schließen die Schließer und öffnen die Öffner.</p><table><tr><th>Klemme</th><th>Bedeutung</th></tr><tr><td>A1, A2</td><td>Spule</td></tr><tr><td>1/2, 3/4, 5/6</td><td>Hauptkontakte (Strompfade)</td></tr><tr><td>13/14</td><td>Hilfskontakt, Schließer</td></tr><tr><td>21/22</td><td>Hilfskontakt, Öffner</td></tr></table><span class="eq">Spulenstrom I = U / R</span><span class="eq">Spulenleistung P = U · I</span><p><b>Selbsthaltung:</b> Der Schließer 13/14 liegt parallel zu S1 (Ein). S2 (Aus) ist ein Öffner. Liegt S2 vor der Parallelschaltung, hat Aus Vorrang. Liegt er nur im Zweig des Selbsthaltekontakts, hat Ein Vorrang.</p><p><b>Wendeschaltung:</b> Der Öffner 21/22 des einen Schützes liegt vor der Spule des anderen. Das verriegelt: Beide können nie zugleich anziehen.</p><p>Fällt die Spannung aus, fällt die Selbsthaltung ab und bleibt aus (Nullspannungssicherheit).</p>`, true) +
      sec('Kleinsteuerung als Gerät', `<span class="eq">Gesamtstrom = Summe der Ströme aller Verbraucher</span><span class="eq">Netzteil: Gesamtstrom + 20 % Reserve, dann das nächstgrößere</span><p>Es gibt <b>Relaisausgänge</b> (potentialfrei, schalten auch größere Lasten, sind langsamer) und <b>Transistorausgänge</b> (schnell, verschleißfrei, schalten nur +24 V mit kleinem Strom).</p><table><tr><th>Ader</th><th>Farbe</th></tr><tr><td>+24 V</td><td>braun</td></tr><tr><td>0 V</td><td>blau</td></tr><tr><td>Signal</td><td>schwarz</td></tr></table><table><tr><th>Spannung am Eingang</th><th>Pegel</th></tr><tr><td>bis 5 V</td><td>0</td></tr><tr><td>ab 15 V</td><td>1</td></tr><tr><td>dazwischen</td><td>nicht definiert, vermeiden</td></tr></table>`) +
      sec('Funktionsplan, Zeiten, Zähler', `<table><tr><th>Baustein</th><th>Verhalten</th></tr><tr><td>UND</td><td>Q = 1, wenn alle Eingänge 1 sind</td></tr><tr><td>ODER</td><td>Q = 1, wenn mindestens ein Eingang 1 ist</td></tr><tr><td>RS</td><td>I1 setzt, I2 setzt zurück (Rücksetzen vorrangig)</td></tr><tr><td>TON</td><td>Q kommt erst nach T</td></tr><tr><td>TOF</td><td>Q bleibt nach dem Abfall noch T</td></tr><tr><td>Wischer</td><td>Impuls fester Länge bei steigender Flanke</td></tr><tr><td>Zähler</td><td>zählt steigende Flanken</td></tr></table><p>Die Zeiten und Sollwerte stellst du im Reiter „Funktionsplan“ selbst ein und siehst sofort das Zeitdiagramm.</p>`) +
      sec('Elektropneumatik', `<p>Ein <b>5/2-Ventil</b> hat fünf Anschlüsse und zwei Stellungen. Beim Zylinder gilt: Spule Y1 (Anschluss 14) verbindet 1 mit 4 und fährt aus. Spule Y2 (Anschluss 12) verbindet 1 mit 2 und fährt ein.</p><table><tr><th>Ventil</th><th>Verhalten</th></tr><tr><td>monostabil</td><td>Eine Spule und eine Feder. Ohne Strom stellt die Feder zurück.</td></tr><tr><td>bistabil</td><td>Zwei Spulen. Es merkt sich die letzte Stellung, auch ohne Strom.</td></tr></table><p>Die Rückmeldung kommt von den Sensoren B1 (hinten) und B2 (vorn). Ein Ablauf A+ A- wartet immer auf die Rückmeldung, nie auf eine Zeit.</p><span class="eq">Takte je Minute = 60 / (Zeit für Aus + Zeit für Ein)</span>`) +
      sec('Sensorik an der Steuerung', `<span class="eq">Sr = Sn · Reduktionsfaktor</span><span class="eq">Arbeitsabstand = 80 % von Sr</span><p>Induktive Sensoren erkennen Metall. Aluminium wirkt schwächer als Stahl, Kunststoff erkennen sie nicht. Kapazitive Sensoren erkennen auch Kunststoff und Flüssigkeiten.</p><p><b>Hysterese:</b> Der Sensor schaltet bei Sr ein und erst ein Stück weiter weg wieder aus. So flackert der Ausgang nicht.</p><p><b>PNP</b> schaltet +24 V auf den Ausgang, <b>NPN</b> schaltet 0 V. Ein Eingang für +24 V braucht PNP. Endziffern an Kontakten: 1 und 2 sind Öffner, 3 und 4 sind Schließer.</p>`) +
      sec('Fehlersuche an Ein- und Ausgängen', `<p>Gehe immer in dieser Reihenfolge vor: <b>1. Status-LED</b> lesen, <b>2. Spannung</b> messen, <b>3. Leitung</b> prüfen, <b>4. Programm</b> prüfen.</p><span class="eq">Leitungswiderstand R = l / (28 · A) für Hin- und Rückleitung (l in m, A in mm²)</span><span class="eq">Spannungsabfall U = R · I</span><p>Bricht die 0-V-Leitung einer Spule, ist an der Spule fast die ganze Spannung zu messen, aber es fließt kein Strom. Miss darum immer gegen die richtige Bezugsstelle. Vor dem Messen: Spannung messen, nicht raten, und die Sicherheitsregeln deines Betriebs beachten.</p>`) +
      '<p class="hint2">Zahlen und Begriffe sind Lehrbuch- und Übungswerte.</p>';
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'sh'; fupStop(); S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    ({ sh: renderSh, fup: renderFup, ep: renderEp, sen: renderSen, tasks: renderTasks, rt: renderTrainer, help: renderHelp })[t]();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'Kleinsteuerungs-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = 'Kleinsteuerungs-Lab: ' + T[2];
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
  $('#title').onclick = () => setTab('sh');
  $('#bMenu').onclick = () => {
    const rows = [['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung und Tipps'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Aufgaben mit Serien-Zähler'], ['help', 'Hilfe und Formeln', 'Schütz, Kleinsteuerung, Funktionsplan, Elektropneumatik, Sensorik, Fehlersuche'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben und Trainer-Serie auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
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

  buildTabs(); updatePal(); setTab(TABS.some(x => x[0] === S.tab) ? S.tab : 'sh');
  /* Aufruf ?aufgabe=ksp1 (Startseite, Lernhefte) öffnet die Aufgabe */
  root.LabGoto = id => { try { if (TASKS.some(t => t.id === id)) { setTab('tasks'); startTask(id); return true; } } catch (e) {} return false; };
  try { const qa = new URLSearchParams(location.search).get('aufgabe'); if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); } } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
