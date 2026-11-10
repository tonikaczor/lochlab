'use strict';
/* Tonfunk Maschinenelemente-Lab: Oberfläche (Lab-Kennung 'mas').
   ALLE Zahlen, Wirkungsgrade, Werkstoffwerte und Zuordnungen sind ÜBUNGSWERTE für die Ausbildung, nicht für die Auslegung echter Antriebe.
   Reiter: Übersetzung (Getriebe mit laufenden Zahnrädern), Zahnradmaße, Riemen und Kette, Federn, Lager und Wellen (Kurzzeichen im Schnitt, Lagerung, Gleitlager, Lebensdauer), Aufgaben, Trainer, Beispiele, Hilfe.
   Module: mascore.js (MAS_CORE, Rechenlogik), masdata.js (MAS_DATA, MAS_TASKS: Aufgaben, Beispiele), masviz.js (MAS_VIZ: Grafiken und Bewegung), vor diesem Skript geladen.
   Speicher (Präfix lm4.mas.): tab, uebs, zahn, riem, fed, lag, done ({id:true} nur gelöste), prog ({id:Prozent}), hints, ctipps (nur Prüfmodus), exam ('1'), rt (Trainer), mot (Bewegung '1'/'0').
   Tipp-Abzug (25 % je Stufe, höchstens 2 Stufen) gibt es nur im Prüfmodus; beim normalen Üben kosten Tipps nichts.
   Feste IDs für die zentrale Tour: Reiter #tab-<name> (data-tab), Eingaben #in-<reiter>-<feld>, Ausgabe #out-<reiter>, Grafik #viz-<reiter>, Aufgaben #taskView / #task-<id>, Trainer #rtView, Beispiele #ex_<id>, Kopfzeile #bTasks #bExam #bHelp #bMenu, Bedienleiste #pal.
   Aufruf: maslab.html?aufgabe=mas1 öffnet die Aufgabe, maslab.html?bsp öffnet die Beispiele (?bsp=uebs1 springt zu einem Beispiel). */
(function (root) {
  const C = root.MAS_CORE, D = root.MAS_DATA, V = root.MAS_VIZ;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.mas.';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(LS + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} };
  const f = (v, d) => C.fmtN(v, d == null ? 2 : d, true), P = s => C.parseDe(s);
  const dots = l => '●'.repeat(l || 1) + '○'.repeat(3 - (l || 1));
  const fin = Number.isFinite;
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
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>Maschinenelemente-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">mascore.js, masdata.js oder masviz.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks;

  /* ============================================================ Zustand */
  const TABS = [['uebs', '⚙️', 'Übersetzung'], ['zahn', '🔩', 'Zahnradmaße'], ['riem', '🔗', 'Riemen & Kette'], ['fed', '🌀', 'Federn'], ['lag', '⭕', 'Lager & Wellen'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['bsp', '📖', 'Beispiele'], ['help', '📘', 'Hilfe']];
  const VIEWID = { uebs: 'uebsView', zahn: 'zahnView', riem: 'riemView', fed: 'fedView', lag: 'lagView', tasks: 'taskView', rt: 'rtView', bsp: 'bspView', help: 'helpView' };
  const DEF = {
    uebs: { st: '1', z1: '20', z2: '60', z3: '20', z4: '40', n: '1500', M: '20', eta: '0,97' },
    zahn: { m: '2', m2: '2', z1: '24', z2: '48', a: '' },
    riem: { type: 'keil', d1: '100', d2: '250', a: '500', n: '1450', z1: '19', z2: '38', p: '12,7' },
    fed: { mode: 'reihe', c1: '6', c2: '3', c3: '', s: '12', G: '81000', d: '3', D: '24', nw: '8' },
    lag: { view: 'kz', code: '6205-2RS', dT: '30', L: '400', mode: 'festlos', v: '40', C: '14', P: '3,5', n: '1500', kind: 'kugel' }
  };
  const ENUM = { uebs: { st: ['1', '2'] }, riem: { type: ['keil', 'zahn', 'kette'] }, fed: { mode: ['einzel', 'reihe', 'par', 'geom'] }, lag: { view: ['kz', 'fl', 'gl', 'lh'], mode: ['festlos', 'angestellt', 'schwimmend'], kind: ['kugel', 'rolle'] } };
  const S = { tab: lsGet('tab', 'uebs'), task: null, tq: null, tAns: {}, tRes: null, tr: { q: null, ans: {}, res: null, level: 0 }, rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {})) };
  function norm(tab) {
    const o = S[tab]; Object.keys(DEF[tab]).forEach(k => { if (typeof o[k] !== 'string') o[k] = String(o[k] == null ? DEF[tab][k] : o[k]); });
    Object.keys(ENUM[tab] || {}).forEach(k => { if (ENUM[tab][k].indexOf(o[k]) < 0) o[k] = DEF[tab][k]; });
  }
  Object.keys(DEF).forEach(t => { S[t] = Object.assign({}, DEF[t], lsGet(t, {})); norm(t); });
  S.mot = lsGet('mot', '1') !== '0';
  const R0 = (() => { const m = /[?&]seed=([^&]+)/.exec(location.search); return C.rng(m ? decodeURIComponent(m[1]) : String(Math.random()) + Date.now()); })();

  /* ============================================================ Bausteine */
  const box = (t, fm, res, cls) => `<div class="rdout ${cls || ''}"><span class="st">${esc(t)}</span>${fm ? esc(fm) + ' = ' : ''}<b>${esc(res)}</b></div>`;
  const note = (t, cls) => `<div class="rdout ${cls || 'warn'}">${esc(t)}</div>`;
  const inp = (tab, k, label, val, unit) => `<label class="f"><span>${esc(label)}${unit ? ' (' + esc(unit) + ')' : ''}</span><input id="in-${tab}-${k}" data-k="${k}" inputmode="decimal" autocomplete="off" value="${esc(val)}"></label>`;
  const UEB = 'Alle Zahlen, Wirkungsgrade und Werkstoffwerte in diesem Lab sind Übungswerte für die Ausbildung, nicht für die Auslegung echter Antriebe. Maßgebend sind Herstellerkataloge, Normen und die Vorgaben deines Betriebs.';
  const ueb = () => `<div class="rdout warn">⚠ ${esc(UEB)}</div>`;
  const seg = (k, opts, cur) => `<div class="seg" role="group">${opts.map(o => `<button data-sk="${k}" data-sv="${esc(o[0])}" class="${String(cur) === String(o[0]) ? 'on' : ''}" aria-pressed="${String(cur) === String(o[0])}">${esc(o[1])}</button>`).join('')}</div>`;
  const viz = (tab, svg, cap) => `<!--V--><div class="inst" id="viz-${tab}">${svg}</div>${cap ? `<p class="hint2">${cap}</p>` : ''}<!--/V-->`;
  const motNote = '<!--V--><p class="hint2">Die Bewegung zeigt die Verhältnisse der Drehzahlen, nicht die echte Geschwindigkeit. Mit „Bewegung“ in der Leiste unten lässt sie sich anhalten.</p><!--/V-->';
  const intIn = (z, lo, hi) => Number.isInteger(z) && z >= lo && z <= hi;

  /* ============================================================ Übersetzung */
  function uebsOut(p) {
    const st = String(p.st) === '2' ? 2 : 1, keys = ['z1', 'z2', 'z3', 'z4'].slice(0, st * 2), zs = keys.map(k => P(p[k]));
    if (zs.some(z => !intIn(z, 6, 120))) return note('Bitte ganze Zähnezahlen zwischen 6 und 120 eingeben.');
    const n = P(p.n), M = P(p.M), e0 = P(p.eta), eta = e0 > 0 && e0 <= 1 ? e0 : 1, stages = [[zs[0], zs[1]]]; if (st === 2) stages.push([zs[2], zs[3]]);
    const ig = C.trainRatio(stages); let h = viz('uebs', V.gearTrain({ n1: n, stages: stages.map(s => ({ m1: 2, z1: s[0], m2: 2, z2: s[1] })) })) + motNote;
    h += box('1. Übersetzung der Stufe 1', 'z2 / z1 = ' + zs[1] + ' / ' + zs[0], f(zs[1] / zs[0], 3));
    if (st === 2) { h += box('2. Übersetzung der Stufe 2', 'z4 / z3 = ' + zs[3] + ' / ' + zs[2], f(zs[3] / zs[2], 3)); h += box('3. Gesamtübersetzung', 'i = i1 · i2', f(ig, 3)); }
    const base = st === 2 ? 4 : 2;
    if (n >= 0) h += box(base + '. Abtriebsdrehzahl', 'n2 = n1 / i = ' + f(n, 0) + ' / ' + f(ig, 3), f(C.nOut(n, ig), 1) + ' 1/min');
    h += box((base + 1) + '. Drehrichtung', st + (st === 1 ? ' Eingriff' : ' Eingriffe'), C.dirSame(st) ? 'Abtrieb dreht gleichsinnig wie der Antrieb' : 'Abtrieb dreht entgegengesetzt zum Antrieb');
    if (M >= 0) { const et = C.etaTot(eta, st), M2 = C.mOut(M, ig, et), P1 = C.power(M, n); h += box((base + 2) + '. Moment am Abtrieb', 'M2 = M1 · i · η^' + st + ' = ' + f(M, 1) + ' · ' + f(ig, 3) + ' · ' + f(et, 4), f(M2, 2) + ' Nm'); if (fin(P1)) h += box((base + 3) + '. Leistung (Eingang → Ausgang)', 'P = M · n / 9550; P2 = P1 · η^' + st, f(P1, 2) + ' kW → ' + f(P1 * et, 2) + ' kW'); }
    h += note(ig > 1.0001 ? 'Ins Langsame übersetzt (i > 1): Die Drehzahl sinkt, das Moment steigt. Die Leistung bleibt bis auf die Verluste gleich.' : ig < 0.9999 ? 'Ins Schnelle übersetzt (i < 1): Die Drehzahl steigt, das Moment sinkt. Die Leistung bleibt bis auf die Verluste gleich.' : 'Übersetzung 1: Drehzahl und Moment bleiben, nur die Drehrichtung kehrt sich um.', 'ok');
    return h;
  }
  function renderUebs() {
    const s = S.uebs;
    $('#uebsView').innerHTML = `<div id="vizwrap-uebs"></div><div class="card pl"><h4>Getriebe</h4><div class="fbar"><span class="lbl">STUFEN</span>${seg('st', [['1', 'einstufig'], ['2', 'zweistufig']], s.st)}</div>
      <div class="dsrow">${inp('uebs', 'z1', 'Zähne z1 (treibend, Stufe 1)', s.z1, '')}${inp('uebs', 'z2', 'Zähne z2 (getrieben, Stufe 1)', s.z2, '')}</div>
      ${s.st === '2' ? `<div class="dsrow">${inp('uebs', 'z3', 'Zähne z3 (treibend, Stufe 2)', s.z3, '')}${inp('uebs', 'z4', 'Zähne z4 (getrieben, Stufe 2)', s.z4, '')}</div>` : ''}
      <div class="dsrow">${inp('uebs', 'n', 'Antriebsdrehzahl', s.n, '1/min')}${inp('uebs', 'M', 'Antriebsmoment', s.M, 'Nm')}${inp('uebs', 'eta', 'Wirkungsgrad je Stufe (0 bis 1)', s.eta, '')}</div>
      <p class="hint2">Zahlen mit Komma oder Punkt. Das treibende Rad (z1) sitzt links, das Antriebsrad der zweiten Stufe sitzt auf derselben Welle wie das getriebene Rad der ersten.</p></div><div id="out-uebs"></div>${ueb()}`;
    updateCalc('uebs');
  }
  /* ============================================================ Zahnradmaße */
  function zahnOut(p) {
    const m1 = P(p.m), m2 = p.m2 === '' ? m1 : P(p.m2), z1 = P(p.z1), z2 = P(p.z2);
    if (!(m1 > 0 && m2 > 0)) return note('Bitte einen Modul größer 0 eingeben (z. B. 2 oder 2,5).');
    if (!intIn(z1, 6, 200) || !intIn(z2, 6, 200)) return note('Bitte ganze Zähnezahlen zwischen 6 und 200 eingeben.');
    const same = Math.abs(m1 - m2) < 1e-9, a = (C.gD(m1, z1) + C.gD(m2, z2)) / 2;
    let h = viz('zahn', V.gearTrain({ dims: true, n1: 600, stages: [{ m1, z1, m2, z2 }] })) + motNote;
    h += (same ? '' : note('Die beiden Räder haben verschiedene Module (' + f(m1, 2) + ' mm und ' + f(m2, 2) + ' mm). Ihre Zähne sind verschieden groß und passen nicht ineinander: Die Räder kämmen nicht.', 'bad'));
    h += `<table class="tt"><tr><th></th><th>Rad 1</th><th>Rad 2</th></tr><tr><td>Modul m</td><td>${f(m1, 2)} mm</td><td>${f(m2, 2)} mm</td></tr><tr><td>Zähnezahl z</td><td>${z1}</td><td>${z2}</td></tr><tr><td>Teilkreis d = m · z</td><td>${f(C.gD(m1, z1), 2)} mm</td><td>${f(C.gD(m2, z2), 2)} mm</td></tr><tr><td>Kopfkreis da = d + 2m</td><td>${f(C.gDa(m1, z1), 2)} mm</td><td>${f(C.gDa(m2, z2), 2)} mm</td></tr><tr><td>Fußkreis df = d − 2,5m</td><td>${f(C.gDf(m1, z1), 2)} mm</td><td>${f(C.gDf(m2, z2), 2)} mm</td></tr><tr><td>Teilung p = π · m</td><td>${f(C.gP(m1), 2)} mm</td><td>${f(C.gP(m2), 2)} mm</td></tr><tr><td>Zahnhöhe h = 2,25m</td><td>${f(C.gH(m1), 2)} mm</td><td>${f(C.gH(m2), 2)} mm</td></tr></table>`;
    h += box('Achsabstand', 'a = (d1 + d2) / 2', f(a, 2) + ' mm') + box('Übersetzung', 'i = z2 / z1 = ' + z2 + ' / ' + z1, f(z2 / z1, 3));
    const at = P(p.a);
    if (at > 0 && same) {
      const sum = C.zSum(at, m1), zz = sum - z1, ok = Math.abs(sum - Math.round(sum)) < 1e-6;
      h += box('Soll-Achsabstand ' + f(at, 2) + ' mm: Zähnezahl-Summe', 'z1 + z2 = 2a / m = 2 · ' + f(at, 2) + ' / ' + f(m1, 2), f(sum, 2));
      h += ok && zz >= 6 ? box('Zweites Rad bei z1 = ' + z1, 'z2 = ' + f(sum, 0) + ' − ' + z1, f(zz, 0) + ' Zähne', 'ok') : note(ok ? 'Mit diesem z1 bleibt für das zweite Rad keine sinnvolle Zähnezahl übrig.' : 'Die Summe ist keine ganze Zahl: Bei diesem Modul passt der Achsabstand nicht ohne Profilverschiebung. Ändere Modul oder Achsabstand.', 'bad');
    }
    return h;
  }
  function renderZahn() {
    const s = S.zahn;
    $('#zahnView').innerHTML = `<div id="vizwrap-zahn"></div><div class="card pl"><h4>Zahnradpaar (Stirnräder)</h4><div class="dsrow">${inp('zahn', 'm', 'Modul Rad 1', s.m, 'mm')}${inp('zahn', 'm2', 'Modul Rad 2', s.m2, 'mm')}</div><div class="dsrow">${inp('zahn', 'z1', 'Zähne z1', s.z1, '')}${inp('zahn', 'z2', 'Zähne z2', s.z2, '')}${inp('zahn', 'a', 'Soll-Achsabstand (optional)', s.a, 'mm')}</div>
      <p class="hint2">Zwei Räder greifen nur ineinander, wenn ihr Modul gleich ist. Ändere den Modul von Rad 2 und sieh, was passiert. Mit dem Soll-Achsabstand berechnet das Lab die passende Zähnezahl des zweiten Rades.</p></div><div id="out-zahn"></div>${ueb()}`;
    updateCalc('zahn');
  }
  /* ============================================================ Riemen und Kette */
  function riemOut(p) {
    const ty = ['keil', 'zahn', 'kette'].includes(p.type) ? p.type : 'keil', n = P(p.n), a = P(p.a); let h = '';
    if (ty === 'kette') {
      const z1 = P(p.z1), z2 = P(p.z2), pp = P(p.p);
      if (!intIn(z1, 6, 150) || !intIn(z2, 6, 150) || !(pp > 0) || !(a > 0)) return note('Bitte Zähnezahlen (6 bis 150), Teilung und Achsabstand als Zahlen eingeben.');
      const r1 = C.chainR(z1, pp), r2 = C.chainR(z2, pp), X = C.chainX(z1, z2, pp, a), Xe = C.chainXEven(X), i = z2 / z1;
      h += viz('riem', V.beltDrive({ kind: 'kette', z1, z2, p: pp, a, n1: n })) + motNote;
      if (a < r1 + r2 + 0.5 * pp) h += note('Der Achsabstand ist zu klein: Die Kettenräder würden sich berühren oder zu wenig Platz lassen.', 'bad');
      h += box('1. Übersetzung', 'z2 / z1 = ' + z2 + ' / ' + z1, f(i, 3)) + (n >= 0 ? box('2. Drehzahl Kettenrad 2', 'n2 = n1 / i', f(n / i, 1) + ' 1/min') + box('3. Kettengeschwindigkeit', 'v = z1 · p · n1 / 60000', f(C.chainV(z1, pp, n), 2) + ' m/s') : '');
      h += box('4. Kettenglieder (rechnerisch)', 'X = 2a/p + (z1+z2)/2 + ((z2−z1)/2π)² · p/a', f(X, 2)) + box('5. Gliederzahl (aufgerundet auf gerade Zahl)', '', f(Xe, 0) + ' Glieder', 'ok');
      h += note('Die Kette läuft formschlüssig, es gibt keinen Schlupf. Sie braucht regelmäßig Schmierung. Die gerade Gliederzahl vermeidet ein Kropfglied (schwächeres Verbindungsglied).', 'ok');
      return h;
    }
    const d1 = P(p.d1), d2 = P(p.d2);
    if (!(d1 > 0) || !(d2 > 0) || !(a > 0)) return note('Bitte Scheibendurchmesser und Achsabstand als Zahlen größer 0 eingeben.');
    if (Math.abs(d2 - d1) >= 2 * a) return note('Der Achsabstand ist für diese Scheiben viel zu klein: Der Riemen würde nicht mehr um beide Scheiben passen.', 'bad');
    const i = d2 / d1;
    h += viz('riem', V.beltDrive({ kind: ty, d1, d2, a, n1: n })) + motNote;
    if (a < (d1 + d2) / 2) h += note('Der Achsabstand ist kleiner als die Hälfte der Scheibensumme: Die Scheiben würden sich berühren.', 'bad');
    h += box('1. Übersetzung', 'i = d2 / d1 = ' + f(d2, 0) + ' / ' + f(d1, 0), f(i, 3));
    if (n >= 0) h += box('2. Drehzahl der zweiten Scheibe', 'n2 = n1 / i = ' + f(n, 0) + ' / ' + f(i, 3), f(n / i, 1) + ' 1/min') + box('3. Riemengeschwindigkeit', 'v = π · d1 · n1 / 60', f(C.beltV(d1, n), 2) + ' m/s');
    h += box('4. Riemenlänge (Näherung)', 'L = 2a + π/2 · (d1 + d2) + (d2 − d1)² / 4a', f(C.beltLen(d1, d2, a), 0) + ' mm') + box('5. Umschlingungswinkel der kleinen Scheibe', 'β = 180° − 2 · arcsin(|d2 − d1| / 2a)', f(C.wrap(d1, d2, a), 1) + '°');
    h += note(ty === 'zahn' ? 'Der Zahnriemen greift formschlüssig in die Zähne der Scheiben: kein Schlupf, die Übersetzung stimmt genau, er läuft trocken und braucht keine Schmierung.' : 'Der Keilriemen überträgt das Moment durch Reibung. Dabei tritt ein wenig Schlupf auf, die wirkliche Abtriebsdrehzahl liegt etwas unter dem berechneten Wert. Bei Überlast kann er durchrutschen. Er muss richtig gespannt sein.', 'ok');
    return h;
  }
  function renderRiem() {
    const s = S.riem, ch = s.type === 'kette';
    $('#riemView').innerHTML = `<div id="vizwrap-riem"></div><div class="card pl"><h4>Trieb</h4><div class="fbar"><span class="lbl">ART</span>${seg('type', [['keil', 'Keilriemen'], ['zahn', 'Zahnriemen'], ['kette', 'Kette']], s.type)}</div>
      <div class="dsrow">${ch ? inp('riem', 'z1', 'Zähne Ritzel z1', s.z1, '') + inp('riem', 'z2', 'Zähne Kettenrad z2', s.z2, '') + inp('riem', 'p', 'Kettenteilung p', s.p, 'mm') : inp('riem', 'd1', 'Durchmesser kleine Scheibe d1', s.d1, 'mm') + inp('riem', 'd2', 'Durchmesser große Scheibe d2', s.d2, 'mm')}</div>
      <div class="dsrow">${inp('riem', 'a', 'Achsabstand a', s.a, 'mm')}${inp('riem', 'n', 'Antriebsdrehzahl n1', s.n, '1/min')}</div></div><div id="out-riem"></div>${ueb()}`;
    updateCalc('riem');
  }
  /* ============================================================ Federn */
  function fedOut(p) {
    const mode = ['einzel', 'reihe', 'par', 'geom'].includes(p.mode) ? p.mode : 'reihe', s = P(p.s); let h = '';
    if (mode === 'geom') {
      const G = P(p.G), d = P(p.d), Dm = P(p.D), nw = P(p.nw), c = C.sGeom(G, d, Dm, nw);
      if (!fin(c)) return note('Bitte G, Drahtdurchmesser, Windungsdurchmesser und Windungszahl als Zahlen größer 0 eingeben.');
      h += viz('fed', V.springCircuit('einzel', [c])) + viz('fedc', V.springChart([{ c, label: 'c = ' + f(c, 2) + ' N/mm' }], s >= 0 ? { s, F: c * s } : null));
      h += box('1. Federrate der Druckfeder', 'c = G · d⁴ / (8 · D³ · n) = ' + f(G, 0) + ' · ' + f(d, 2) + '⁴ / (8 · ' + f(Dm, 1) + '³ · ' + f(nw, 1) + ')', f(c, 2) + ' N/mm');
      if (s >= 0) h += box('2. Kraft bei Weg s = ' + f(s, 1) + ' mm', 'F = c · s', f(c * s, 1) + ' N') + box('3. Federarbeit', 'W = ½ · c · s²', f(C.sW(c, s), 0) + ' N·mm');
      h += note('Dickerer Draht macht die Feder sehr viel steifer (Durchmesser in der 4. Potenz), ein größerer Windungsdurchmesser oder mehr Windungen machen sie weicher.', 'ok');
      return h;
    }
    const cs = [P(p.c1), P(p.c2), P(p.c3)].filter(x => fin(x)).slice(0, 3), use = mode === 'einzel' ? cs.slice(0, 1) : cs;
    if (!use.length || use.some(c => !(c > 0)) || (mode !== 'einzel' && use.length < 2)) return note(mode === 'einzel' ? 'Bitte die Federrate c1 als Zahl größer 0 eingeben.' : 'Bitte mindestens zwei Federraten größer 0 eingeben (die dritte ist optional).');
    const cg = mode === 'reihe' ? C.sSer(use) : mode === 'par' ? C.sPar(use) : use[0], lines = [{ c: cg, label: 'gesamt ' + f(cg, 2), w: 4, col: 'accent' }].concat(mode === 'einzel' ? [] : use.map((c, k) => ({ c, label: 'c' + (k + 1) + ' = ' + f(c, 1), w: 1.8, col: ['hi', 'ok', 'warn'][k] })));
    h += viz('fed', V.springCircuit(mode, use)) + viz('fedc', V.springChart(lines, s >= 0 ? { s, F: cg * s } : null));
    h += box('1. Gesamtfederrate', mode === 'reihe' ? '1/c = ' + use.map(c => '1/' + f(c, 1)).join(' + ') : mode === 'par' ? 'c = ' + use.map(c => f(c, 1)).join(' + ') : 'c = c1', f(cg, 3) + ' N/mm');
    if (s >= 0) {
      h += box('2. Gesamtweg s und Kraft', 'F = c · s = ' + f(cg, 2) + ' · ' + f(s, 1), f(cg * s, 1) + ' N');
      if (mode === 'reihe') h += `<div class="rdout"><span class="st">3. Jede Feder trägt die volle Kraft, die Wege addieren sich</span>${use.map((c, k) => 'Feder ' + (k + 1) + ': s = F / c = ' + f(cg * s / c, 2) + ' mm').join('<br>')}</div>`;
      if (mode === 'par') h += `<div class="rdout"><span class="st">3. Jede Feder hat denselben Weg, die Kräfte addieren sich</span>${use.map((c, k) => 'Feder ' + (k + 1) + ': F = c · s = ' + f(c * s, 1) + ' N').join('<br>')}</div>`;
      h += box('4. Federarbeit', 'W = ½ · c · s²', f(C.sW(cg, s), 0) + ' N·mm');
    }
    h += note(mode === 'reihe' ? 'Reihenschaltung: weicher als die weichste Einzelfeder. Parallelschaltung: steifer als jede einzelne.' : mode === 'par' ? 'Parallelschaltung: steifer als jede Einzelfeder, die Federraten addieren sich.' : 'Die Kennlinie ist eine Gerade durch den Nullpunkt: Doppelter Weg bedeutet doppelte Kraft.', 'ok');
    return h;
  }
  function renderFed() {
    const s = S.fed, g = s.mode === 'geom';
    $('#fedView').innerHTML = `<div id="vizwrap-fed"></div><div class="card pl"><h4>Federn</h4><div class="fbar"><span class="lbl">SCHALTUNG</span>${seg('mode', [['einzel', 'einzeln'], ['reihe', 'Reihe'], ['par', 'parallel'], ['geom', 'aus Maßen']], s.mode)}</div>
      <div class="dsrow">${g ? inp('fed', 'G', 'Schubmodul G', s.G, 'N/mm²') + inp('fed', 'd', 'Drahtdurchmesser d', s.d, 'mm') + inp('fed', 'D', 'mittl. Windungsdurchmesser D', s.D, 'mm') + inp('fed', 'nw', 'federnde Windungen n', s.nw, '') : inp('fed', 'c1', 'Federrate c1', s.c1, 'N/mm') + (s.mode === 'einzel' ? '' : inp('fed', 'c2', 'Federrate c2', s.c2, 'N/mm') + inp('fed', 'c3', 'Federrate c3 (optional)', s.c3, 'N/mm'))}${inp('fed', 's', 'Federweg s', s.s, 'mm')}</div></div><div id="out-fed"></div>${ueb()}`;
    updateCalc('fed');
  }
  /* ============================================================ Lager und Wellen */
  const CODES = ['6205-2RS', '6310', 'NU208', '7205', '30208', '51108', '22210'];
  function lagOut(p) {
    const vw = ['kz', 'fl', 'gl', 'lh'].includes(p.view) ? p.view : 'kz';
    if (vw === 'kz') {
      const pb = C.parseBearing(p.code); let h = viz('lag', V.bearingSection(pb));
      if (!pb.ok) return h + note(pb.err, 'bad');
      h += `<table class="tt"><tr><td>Bauform</td><td><b>${esc(pb.name)}</b></td></tr><tr><td>Bohrung (Wellendurchmesser)</td><td><b>${pb.d} mm</b></td></tr><tr><td>Reihe (Kräftigkeit)</td><td>${esc(pb.series)} (Ziffer ${pb.rank})</td></tr><tr><td>Radiale Belastbarkeit</td><td>${esc(pb.info.rad)}</td></tr><tr><td>Axiale Belastbarkeit</td><td>${esc(pb.info.ax)}</td></tr><tr><td>Typische Verwendung</td><td>${esc(pb.info.use)}</td></tr>${pb.suffix.map(s => `<tr><td>Zusatz ${esc(s[0])}</td><td>${esc(s[1])}</td></tr>`).join('')}${pb.unknown.length ? `<tr><td>Weitere Zusätze</td><td>${esc(pb.unknown.join(', '))}: im Katalog des Herstellers nachsehen</td></tr>` : ''}</table>`;
      return h + note('Das Kurzzeichen ist nur grob gelesen: Bauform und Bohrung sagen noch nichts über Außendurchmesser, Breite und Tragzahl. Die stehen im Katalog.', 'ok');
    }
    if (vw === 'fl') {
      const L = P(p.L), dT = P(p.dT), dL = C.dLen(L, dT), md = p.mode;
      let h = viz('lag', V.lagerung(md, dL));
      h += box('Wärmedehnung der Welle', 'ΔL = α · L · ΔT = 12·10⁻⁶ · ' + f(L, 0) + ' mm · ' + f(dT, 0) + ' K', fin(dL) ? f(dL, 3) + ' mm' : '–');
      h += note(md === 'festlos' ? 'Fest-Los-Lagerung: Das Festlager führt die Welle axial, das Loslager lässt die Längenänderung zu. Die Zeichnung übertreibt die Verschiebung.' : md === 'angestellt' ? 'Angestellte Lagerung: Zwei Lager (z. B. Kegelrollenlager) halten die Welle gegeneinander. Das Axialspiel wird beim Einbau eingestellt und ändert sich mit der Wärmedehnung, deshalb gelten die Herstellervorgaben.' : 'Schwimmende Lagerung: Die Welle hat beidseitig Axialspiel und wird von einer anderen Stelle (z. B. Zahnrad) geführt. Sie ist nicht selbst axial festgelegt.', 'ok');
      return h;
    }
    if (vw === 'gl') {
      const v = Math.max(0, Math.min(100, P(p.v) || 0));
      return viz('lag', V.stribeck(v / 100)) + note(v < 20 ? 'Festkörperreibung: Beim Anfahren liegt die Welle noch auf der Lagerschale, es gibt Verschleiß.' : v < 35 ? 'Mischreibung: Ein Teil der Last trägt schon der Schmierfilm, es gibt noch Kontakt.' : 'Flüssigkeitsreibung: Der Schmierfilm trägt die Welle, die Flächen berühren sich nicht und verschleißen kaum.', v < 20 ? 'bad' : v < 35 ? 'warn' : 'ok') + '<p class="hint2">Gleitlager sind unempfindlich gegen Stöße und laufen leise, brauchen aber einen sicheren Schmierfilm. Häufiges Anfahren unter Last verschleißt sie.</p>';
    }
    const Cn = P(p.C), Pn = P(p.P), n = P(p.n), ball = p.kind !== 'rolle', L10 = C.L10(Cn, Pn, ball), L10h = C.L10h(Cn, Pn, n, ball);
    if (!fin(L10)) return note('Bitte C und P (in gleicher Einheit, z. B. kN) als Zahlen größer 0 eingeben.');
    let h = box('1. Verhältnis C / P', 'C / P = ' + f(Cn, 2) + ' / ' + f(Pn, 2), f(Cn / Pn, 2)) + box('2. Lebensdauer in Umdrehungen', 'L10 = (C / P)^' + (ball ? '3' : '10/3'), f(L10, 1) + ' Mio. Umdrehungen');
    if (fin(L10h)) h += box('3. Lebensdauer in Stunden', 'L10h = L10 · 10⁶ / (60 · n) = ' + f(L10, 1) + ' · 10⁶ / (60 · ' + f(n, 0) + ')', f(L10h, 0) + ' h');
    /* PRUEFEN P24: Hinweistexte im Rechner (L10 = von 90 % der Lager erreicht oder übertroffen, nur Grundgleichung ohne Korrekturfaktoren; Keilriemen mit etwas Schlupf; Kette gerade Gliederzahl). Reichen diese Hinweise, oder sollen Korrekturfaktoren (a1, a_ISO) und Schlupfwerte geübt werden? */
    return h + note('Die nominelle Lebensdauer L10 wird von 90 % der Lager einer Gruppe erreicht oder übertroffen. Sie gilt bei guter Schmierung und Sauberkeit. Katalogwerte C und P liefert der Hersteller; im Lab gilt nur die Grundgleichung.', 'ok');
  }
  function renderLag() {
    const s = S.lag, vw = s.view;
    let body = '';
    if (vw === 'kz') body = `<div class="dsrow">${inp('lag', 'code', 'Kurzzeichen (z. B. 6205-2RS, NU208, 30208)', s.code, '')}</div><div class="tray">${CODES.map(c => `<button class="chip" data-sk="code" data-sv="${esc(c)}" aria-pressed="${s.code === c}">${esc(c)}</button>`).join('')}</div>`;
    else if (vw === 'fl') body = `<div class="fbar"><span class="lbl">LAGERUNG</span>${seg('mode', [['festlos', 'Fest-Los'], ['angestellt', 'Angestellt'], ['schwimmend', 'Schwimmend']], s.mode)}</div><div class="dsrow">${inp('lag', 'L', 'Wellenlänge zwischen den Lagern', s.L, 'mm')}<label class="f"><span>Erwärmung ΔT: <b>${esc(s.dT)}</b> K</span><input id="in-lag-dT" data-k="dT" type="range" min="0" max="80" step="1" value="${esc(s.dT)}"></label></div>`;
    else if (vw === 'gl') body = `<label class="f"><span>Geschwindigkeit vom Anlauf bis zum Betrieb</span><input id="in-lag-v" data-k="v" type="range" min="0" max="100" step="1" value="${esc(s.v)}"></label>`;
    else body = `<div class="fbar"><span class="lbl">LAGERART</span>${seg('kind', [['kugel', 'Kugellager'], ['rolle', 'Rollenlager']], s.kind)}</div><div class="dsrow">${inp('lag', 'C', 'Dynamische Tragzahl C', s.C, 'kN')}${inp('lag', 'P', 'Äquivalente Last P', s.P, 'kN')}${inp('lag', 'n', 'Drehzahl n', s.n, '1/min')}</div>`;
    $('#lagView').innerHTML = `<div id="vizwrap-lag"></div><div class="card pl"><h4>Lager und Wellen</h4><div class="fbar">${seg('view', [['kz', 'Kurzzeichen'], ['fl', 'Lagerung'], ['gl', 'Gleitlager'], ['lh', 'Lebensdauer']], vw)}</div>${body}</div><div id="out-lag"></div>${ueb()}`;
    updateCalc('lag');
  }
  const RENDER = { uebs: renderUebs, zahn: renderZahn, riem: renderRiem, fed: renderFed, lag: renderLag };
  const OUT = { uebs: uebsOut, zahn: zahnOut, riem: riemOut, fed: fedOut, lag: lagOut };
  function updateCalc(tab) {
    const o = $('#out-' + tab), w = $('#vizwrap-' + tab), parts = [], rest = OUT[tab](S[tab]).replace(/<!--V-->([\s\S]*?)<!--\/V-->/g, (m, a) => { parts.push(a); return ''; });
    if (w) w.innerHTML = parts.join(''); if (o) o.innerHTML = rest; if (V.scan) V.scan();
  }
  Object.keys(RENDER).forEach(tab => {
    const el = $('#' + VIEWID[tab]);
    const setv = e => { const k = e.target.dataset && e.target.dataset.k; if (!k) return; S[tab][k] = e.target.value; lsSet(tab, S[tab]); if (e.target.type === 'range') { const l = e.target.parentNode && e.target.parentNode.querySelector && e.target.parentNode.querySelector('span b'); if (l) l.textContent = e.target.value; } updateCalc(tab); };
    el.addEventListener('input', setv); el.addEventListener('change', setv);
    el.addEventListener('click', e => {
      const b = e.target.closest('button[data-sk]'); if (!b) return;
      S[tab][b.dataset.sk] = b.dataset.sv; norm(tab); lsSet(tab, S[tab]);
      if (tab === 'riem' && b.dataset.sk === 'type' && b.dataset.sv === 'zahn' && P(S.riem.d1) > 0 && P(S.riem.d2) > 0) { /* Maße bleiben */ }
      RENDER[tab]();
    });
  });

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
  const qText = t => `<p style="margin:8px 0;white-space:pre-line">${esc(t)}</p>`;
  function qBody(q, a, r, pre) {
    const dn = r && (r.ok || pre === 'rt'), as = q.ask; let h = '';
    if (as.type === 'choice') h += `<div class="opts">${as.choices.map((c, i) => `<button data-tc="${i}" ${dn ? 'disabled' : ''} class="${r && i === as.correct && dn ? 'ok' : a.c === i ? (r && !r.ok ? 'bad' : 'on') : ''}">${esc(c)}</button>`).join('')}</div>`;
    else if (as.type === 'num') h += `<label class="f"><span>${esc(as.label)}${as.unit ? ' (' + esc(as.unit) + ')' : ''}</span><div class="qin"><input id="in-${pre}-val" data-in="1" inputmode="decimal" autocomplete="off" value="${esc(a.v || '')}" ${dn ? 'disabled' : ''}><span class="u">${esc(as.unit)}</span></div></label>`;
    else if (as.type === 'order') { const o = a.o || []; h += `<p class="hint2" style="margin:4px 0">Tippe die Einträge in der richtigen Reihenfolge an. Nochmal tippen nimmt einen Eintrag zurück.</p><div class="opts">${as.items.map((t, i) => { const k = o.indexOf(i); return `<button data-to="${i}" ${dn ? 'disabled' : ''} class="${k >= 0 ? 'on' : ''}"><span class="no">${k >= 0 ? k + 1 : '·'}</span> ${esc(t)}</button>`; }).join('')}</div><div class="btns"><button class="btn" data-oc="1" ${dn ? 'disabled' : ''}>↺ Reihenfolge zurücksetzen</button></div>`; }
    else if (as.type === 'match') { const m = a.m || []; h += `<div class="mrows">${as.rows.map((t, i) => `<label class="mrow"><span>${esc(t)}</span><select data-mr="${i}" ${dn ? 'disabled' : ''}><option value="">– wählen –</option>${as.options.map((op, j) => `<option value="${j}"${m[i] === j ? ' selected' : ''}>${esc(op)}</option>`).join('')}</select></label>`).join('')}</div>`; }
    return h;
  }
  function evalQ(q, a) { const e = D.evaluate(q, a); if (e.err) { toast(e.err); return null; } return e; }
  const resBlock = (q, r, showExpl) => `<ul class="tl"><li class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓ Richtig: ' + esc(r.given) : '✗ Deine Antwort „' + esc(r.given) + '“ stimmt nicht.'}</li>${q.ask.type === 'num' && q.tol > 0.011 ? `<li>ℹ Erlaubte Abweichung: ±${esc(f(q.tol, 2))} ${esc(q.ask.unit)} (wegen Rundung).</li>` : ''}</ul>` +
    (showExpl ? `<div class="rdout ${r.ok ? 'ok' : 'bad'}"><b>Lösung:</b> ${esc(D.solText(q))}<br><br><b>Lösungsweg:</b> ${esc(q.expl)}</div>` : '<div class="rdout bad">🎓 Prüfmodus: Den Lösungsweg gibt es erst, wenn die Aufgabe richtig gelöst ist. Nutze einen Tipp oder versuche es noch einmal.</div>');

  function renderTasks(top) {
    const Vw = $('#taskView'), d = done(), prog = lsGet('prog', {}), t = curTask(), n100 = TASKS.filter(x => d[x.id]).length; let h = '';
    if (t) {
      const q = S.tq, r = S.tRes && S.tRes.id === t.id ? S.tRes : null, a = S.tAns[t.id] || (S.tAns[t.id] = {});
      h += `<div class="card pl" id="task-open" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv">${dots(t.level)}</div>${qText(q.text)}${qBody(q, a, r, 'tk')}`;
      h += `<div class="btns"><button class="btn pri" id="btn-task-chk" data-ta="chk"${r && r.ok ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" id="btn-task-hint" data-ta="hint">💡 Tipp</button><button class="btn" data-ta="close">Schließen</button></div>`;
      if (exam()) h += '<p class="hint2" style="color:var(--warn)">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>';
      if (r) { h += resBlock(q, r, r.ok || !exam()); if (r.ok) h += `<div class="btns"><button class="btn pri" data-ta="next">Nächste Aufgabe</button></div>`; }
      h += '</div>';
    }
    h += `<p class="hint2" style="margin:4px 0 0">${n100} von ${TASKS.length} Aufgaben gelöst. ${exam() ? '🎓 Prüfmodus ist an.' : 'Tipp: Im Prüfmodus (🎓 oben) zählen Tipps als Abzug.'}</p><p class="hint2" style="margin:4px 0 0">⚠ ${esc(UEB)}</p>`;
    let last = '';
    TASKS.forEach(x => { if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; } const p = prog[x.id]; h += `<button class="row" id="task-${esc(x.id)}" data-t="${esc(x.id)}"><span class="dot ${d[x.id] ? 'g' : ''}">${d[x.id] ? '✓' : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${dots(x.level)}</span>${p != null && p < 100 ? ' · bisher ' + p + ' %' : ''}</small></div></button>`; });
    Vw.innerHTML = h; if (top !== false) $('#pgTasks').scrollTop = 0;
  }
  function checkTask(t) {
    const a = S.tAns[t.id] || {}, e = evalQ(S.tq, a); if (!e) return; const pct = e.ok ? pctFor(t.id) : 0;
    S.tRes = { id: t.id, ok: e.ok, given: e.given, pct };
    if (e.ok) { markSolved(t.id, pct); const F = fx(); if (F && F.pass) try { F.pass(pct); } catch (er) {} else ding(); toast(exam() && pct < 100 ? pct + ' % (Tipps abgezogen)' : '🎉 Geschafft!'); } else { sad(); toast('Noch nicht richtig. Lies die Hinweise und versuche es noch einmal.'); }
    renderTasks(false);
  }
  function hintFor(q, id) {
    const h = lsGet('hints', {}), n = Math.min(2, (h[id] || 0) + 1), ex = exam(); h[id] = Math.max(h[id] || 0, n); lsSet('hints', h);
    if (ex && id !== 'rt') { const c = lsGet('ctipps', {}); c[id] = Math.max(c[id] || 0, n); lsSet('ctipps', c); }
    sheet('Tipp, Stufe ' + n + ' von 2', b => {
      let x = `<p style="margin-top:0"><b>Stufe 1:</b> ${esc(q.tips[0])}</p>`; if (n >= 2) x += `<p><b>Stufe 2:</b> ${esc(q.tips[1])}</p>`;
      x += n >= 2 ? '<p class="hint2">Mehr Tipps gibt es nicht. Den Lösungsweg siehst du nach dem Prüfen.</p>' : '<p class="hint2">Noch mehr Hilfe? Tippe noch einmal auf „Tipp“.</p>';
      x += ex && id !== 'rt' ? '<p class="hint2" style="color:var(--warn)">Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>' : '<p class="hint2">Beim normalen Üben kosten Tipps nichts. Im Prüfmodus (🎓) zählen sie.</p>';
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
  tv.addEventListener('change', e => { const t = curTask(), mr = e.target.dataset && e.target.dataset.mr; if (t && mr != null) { const a = S.tAns[t.id] = S.tAns[t.id] || {}; a.m = a.m || []; a.m[+mr] = e.target.value === '' ? null : +e.target.value; if (S.tRes && !S.tRes.ok) { S.tRes = null; renderTasks(false); } } });
  tv.addEventListener('keydown', e => { const t = curTask(); if (t && e.key === 'Enter' && e.target.dataset.in) { e.preventDefault(); checkTask(t); } });
  tv.addEventListener('click', e => {
    const t = curTask(), tc = e.target.closest('[data-tc]'), ta = e.target.closest('[data-ta]'), row = e.target.closest('.row[data-t]'), to = e.target.closest('[data-to]'), oc = e.target.closest('[data-oc]');
    if (tc && t) { (S.tAns[t.id] = S.tAns[t.id] || {}).c = +tc.dataset.tc; if (S.tRes && !S.tRes.ok) S.tRes = null; renderTasks(false); return; }
    if (to && t) { const a = S.tAns[t.id] = S.tAns[t.id] || {}, o = a.o = a.o || [], i = +to.dataset.to, k = o.indexOf(i); if (k >= 0) o.splice(k, 1); else o.push(i); if (S.tRes && !S.tRes.ok) S.tRes = null; renderTasks(false); return; }
    if (oc && t) { (S.tAns[t.id] = S.tAns[t.id] || {}).o = []; if (S.tRes && !S.tRes.ok) S.tRes = null; renderTasks(false); return; }
    if (ta && t) { const a = ta.dataset.ta; if (a === 'chk') checkTask(t); else if (a === 'hint') hintFor(S.tq, t.id); else if (a === 'close') { S.task = null; S.tRes = null; renderTasks(); } else if (a === 'next') { const i = TASKS.findIndex(x => x.id === t.id), nx = TASKS.slice(i + 1).find(x => !done()[x.id]) || TASKS[(i + 1) % TASKS.length]; startTask(nx.id); } return; }
    if (row) startTask(row.dataset.t);
  });

  /* Zufalls-Trainer (Tipps kosten hier nie etwas) */
  function newTrainer() { const T = S.tr; T.q = D.randomQ(R0, T.level); T.ans = {}; T.res = null; renderTrainer(); }
  function renderTrainer() {
    const T = S.tr; if (!T.q) { newTrainer(); return; }
    const q = T.q;
    $('#rtView').innerHTML = `<div class="stats"><div class="bx"><b>${S.rt.n}</b>Fragen</div><div class="bx"><b>${S.rt.ok}</b>richtig</div><div class="bx"><b>${S.rt.streak}</b>Serie</div><div class="bx"><b>${S.rt.best}</b>Beste Serie</div></div>
      <div class="fbar"><span class="lbl">STUFE</span><div class="seg">${[[0, 'Alle'], [1, '1'], [2, '2'], [3, '3']].map(l => `<button data-lv="${l[0]}" class="${T.level === l[0] ? 'on' : ''}">${l[1]}</button>`).join('')}</div></div>
      <div class="card pl"><h4>${esc(q.cat)} · <span class="lv">${dots(q.level)}</span></h4><div class="big">${esc(q.title)}</div>${qText(q.text)}${qBody(q, T.ans, T.res, 'rt')}
      <div class="btns"><button class="btn pri" id="btn-rt-chk" data-ra="chk" ${T.res ? 'disabled' : ''}>✓ Prüfen</button><button class="btn" id="btn-rt-hint" data-ra="hint" ${T.res ? 'disabled' : ''}>💡 Tipp</button><button class="btn" id="btn-rt-next" data-ra="next">${T.res ? 'Nächste Frage' : 'Überspringen'}</button></div>
      ${T.res ? resBlock(q, T.res, true) : ''}</div>`;
  }
  const rv = $('#rtView');
  rv.addEventListener('input', e => { if (e.target.dataset.in) S.tr.ans.v = e.target.value; });
  rv.addEventListener('change', e => { const mr = e.target.dataset && e.target.dataset.mr; if (mr != null && !S.tr.res) { const a = S.tr.ans; a.m = a.m || []; a.m[+mr] = e.target.value === '' ? null : +e.target.value; } });
  rv.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.in) { e.preventDefault(); trainerCheck(); } });
  rv.addEventListener('click', e => {
    const T = S.tr, tc = e.target.closest('[data-tc]'), ra = e.target.closest('[data-ra]'), lv = e.target.closest('[data-lv]'), to = e.target.closest('[data-to]'), oc = e.target.closest('[data-oc]');
    if (lv) { T.level = +lv.dataset.lv; newTrainer(); return; }
    if (tc && !T.res) { T.ans.c = +tc.dataset.tc; renderTrainer(); return; }
    if (to && !T.res) { const o = T.ans.o = T.ans.o || [], i = +to.dataset.to, k = o.indexOf(i); if (k >= 0) o.splice(k, 1); else o.push(i); renderTrainer(); return; }
    if (oc && !T.res) { T.ans.o = []; renderTrainer(); return; }
    if (ra) { const a = ra.dataset.ra; if (a === 'chk') trainerCheck(); else if (a === 'hint') hintFor(T.q, 'rt'); else { if (!T.res && S.rt.streak) { S.rt.streak = 0; lsSet('rt', S.rt); } newTrainer(); updatePal(); } }
  });
  function trainerCheck() {
    const T = S.tr; if (T.res) return; const e = evalQ(T.q, T.ans); if (!e) return;
    T.res = { ok: e.ok, given: e.given }; S.rt.n++; if (e.ok) { S.rt.ok++; S.rt.streak++; S.rt.best = Math.max(S.rt.best, S.rt.streak); ding(); } else { S.rt.streak = 0; sad(); }
    lsSet('rt', S.rt); renderTrainer(); updatePal();
  }

  /* ============================================================ Beispiele */
  function renderBsp() {
    $('#bspView').innerHTML = `<p class="hint2" style="margin:0 0 8px">Fertig durchgerechnete Beispiele (Übungswerte). Mit „In den Rechner laden“ öffnest du die Zahlen im passenden Reiter und kannst sie verändern.</p>` + D.examples.map(e => `<div class="card pl" id="ex_${e.id}"><h4>Beispiel</h4><div class="big">${esc(e.title)}</div><p style="margin:4px 0 8px">${esc(e.text)}</p>${exBody(e)}<div class="btns"><button class="btn pri" id="ex-load-${e.id}" data-ex="${e.id}">In den Rechner laden</button></div></div>`).join('');
    if (V.scan) V.scan();
  }
  const exBody = e => OUT[e.tab](Object.assign({}, DEF[e.tab], e.p)).replace(/ id="viz-/g, ' data-viz="');
  function loadExample(x) { S[x.tab] = Object.assign({}, DEF[x.tab], x.p); norm(x.tab); lsSet(x.tab, S[x.tab]); setTab(x.tab); }
  $('#bspView').addEventListener('click', e => {
    const b = e.target.closest('[data-ex]'); if (!b) return; const x = D.examples.find(z => z.id === b.dataset.ex); if (!x) return;
    loadExample(x); toast('Beispiel geladen: ' + x.title);
  });

  /* ============================================================ Hilfe */
  function renderHelp() {
    const sec = (t, b, open) => `<details${open ? ' open' : ''}><summary>${t}</summary><div class="hb2">${b}</div></details>`, B = C.BEAR;
    $('#helpView').innerHTML =
      `<div class="rdout warn">⚠ ${esc(UEB)}</div>` +
      sec('Zahnräder und Übersetzung', `<span class="eq">Teilkreis d = m · z</span><span class="eq">Kopfkreis da = d + 2m · Fußkreis df = d − 2,5m</span><span class="eq">Teilung p = π · m · Zahnhöhe h = 2,25 m</span><span class="eq">Achsabstand a = m · (z1 + z2) / 2</span><span class="eq">Übersetzung i = z2 / z1 = n1 / n2</span><p>Der <b>Modul m</b> in Millimetern legt die Zahngröße fest. Zwei Räder greifen nur ineinander, wenn ihr Modul gleich ist. Bei <b>i &gt; 1</b> wird ins Langsame übersetzt: Die Drehzahl sinkt, das Moment steigt. Mehrstufig multiplizieren sich die Übersetzungen. Jeder Eingriff außenverzahnter Räder kehrt die Drehrichtung um; ein Zwischenrad ändert nur die Richtung.</p>`, true) +
      sec('Drehzahl, Moment und Leistung', `<span class="eq">M2 = M1 · i · η (η = Wirkungsgrad, bei mehreren Stufen das Produkt)</span><span class="eq">P in kW = M in Nm · n in 1/min / 9550</span><p>Die Leistung ändert sich im Getriebe nur durch die Verluste: Was an Drehzahl gewonnen wird, geht am Moment verloren und umgekehrt. Im Lab gilt je Stirnradstufe der Übungswert η = ${C.ETA_STAGE}.</p>`) +
      sec('Riemen- und Kettentriebe', `<span class="eq">Übersetzung i = d2 / d1 (Kette: z2 / z1)</span><span class="eq">Geschwindigkeit v = π · d · n / 60</span><span class="eq">Umschlingungswinkel β = 180° − 2 · arcsin((d2 − d1) / 2a)</span><span class="eq">Kettenglieder X = 2a/p + (z1+z2)/2 + ((z2−z1)/2π)² · p/a (aufrunden auf gerade Zahl)</span><table><tr><th>Trieb</th><th>Kraftübertragung</th><th>Merkmale</th></tr><tr><td>Keilriemen</td><td>Reibung (kraftschlüssig)</td><td>etwas Schlupf, rutscht bei Überlast, richtig spannen</td></tr><tr><td>Zahnriemen</td><td>Formschluss</td><td>kein Schlupf, trocken, genaue Übersetzung</td></tr><tr><td>Kette</td><td>Formschluss</td><td>kein Schlupf, braucht Schmierung, verträgt hohe Kräfte</td></tr></table>`) +
      sec('Wellen, Passfeder und Welle-Nabe (kurz)', `<span class="eq">Torsion: Wp = π · d³ / 16, τ = M / Wp</span><span class="eq">Wärmedehnung: ΔL = α · L · ΔT (Stahl α ≈ 12·10⁻⁶ 1/K)</span><p>Eine Welle überträgt Drehmoment und wird dabei auf Torsion belastet. Die <b>Passfeder</b> verbindet Welle und Nabe formschlüssig und überträgt das Moment mit ihren Seitenflächen; gegen Längsverschiebung braucht die Nabe zusätzlich einen Anschlag oder Sicherungsring. Wie Verbindungen im Einzelnen gefügt werden (Pressverband, Klemmen, Kleben), zeigt das Lab Fügen.</p>`) +
      sec('Wälzlager: Kurzzeichen und Bauformen', `<p>Die <b>letzten zwei Ziffern</b> (Bohrungskennzahl) geben den Wellendurchmesser: 00 = 10 mm, 01 = 12 mm, 02 = 15 mm, 03 = 17 mm, ab 04 mal 5 (6205: 25 mm). Die Ziffer davor gibt die Reihe (0 bis 4 von extraleicht bis schwer). <b>Zusätze:</b> 2RS = beidseitig berührende Dichtscheiben, 2Z = beidseitig Deckscheiben, C3 = größeres Lagerspiel.</p><table><tr><th>Bauform</th><th>Radial</th><th>Axial</th></tr>${Object.keys(B).map(k => `<tr><td>${esc(B[k].n)}</td><td>${esc(B[k].rad)}</td><td>${esc(B[k].ax)}</td></tr>`).join('')}</table><span class="eq">Lebensdauer L10 = (C / P)^p in Mio. Umdrehungen (Kugel p = 3, Rolle p = 10/3)</span><span class="eq">L10h = L10 · 10⁶ / (60 · n)</span>`) +
      sec('Lagerung: fest und los', `<p>Das <b>Festlager</b> führt die Welle axial in beide Richtungen und trägt zugleich radial. Das <b>Loslager</b> trägt nur radial und lässt die Längenänderung durch Wärme zu (z. B. NU-Zylinderrollenlager). Zwei beidseitig festgelegte Lager verspannen bei Erwärmung. Alternativ werden zwei Schräg- oder Kegelrollenlager <b>angestellt</b>; Pendelrollenlager gleichen Fluchtungsfehler aus.</p>`) +
      sec('Gleitlager und Schmierung', `<p>Im Gleitlager gleitet die Welle auf einer Lagerschale. Bei Stillstand und Anlauf herrscht Festkörper- bzw. Mischreibung (Verschleiß), erst bei ausreichender Geschwindigkeit trägt ein Schmierfilm (Flüssigkeitsreibung). Wälzlager werden mit Fett (wartungsarm, einfach abzudichten) oder Öl (hohe Drehzahlen, Wärmeabfuhr) geschmiert; zu viel Fett erwärmt das Lager, verschiedene Fette nicht ohne Herstellerangabe mischen.</p><div class="inst">${V.stribeck(0.55)}</div>`) +
      sec('Kupplungen und Bremsen', `<table><tr><th>Kupplung</th><th>Kennzeichen</th></tr><tr><td>starr</td><td>verbindet fluchtende Wellen fest, gleicht nichts aus</td></tr><tr><td>elastisch (Ausgleich)</td><td>nimmt Versatz auf, dämpft Stöße (z. B. Klauen mit Zahnkranz)</td></tr><tr><td>schaltbar</td><td>zum Ein- und Auskuppeln im Betrieb (z. B. Lamellenkupplung)</td></tr><tr><td>Rutsch-/Sicherheitskupplung</td><td>begrenzt das Moment bei Überlast</td></tr><tr><td>Freilauf</td><td>überträgt nur in einer Drehrichtung</td></tr></table><p><b>Bremsen</b> wandeln Bewegungsenergie durch Reibung in Wärme um und verschleißen. Die <b>Federdruckbremse</b> bremst durch Federkraft und wird elektrisch oder hydraulisch gelüftet: Ohne Energie ist sie geschlossen. Eine <b>Haltebremse</b> hält im Stillstand und ist nicht fürs ständige Abbremsen gedacht. Öl auf den Belägen senkt die Bremswirkung.</p>`) +
      sec('Dichtungen', `<p><b>Radial-Wellendichtring:</b> Die Dichtlippe zeigt zur abzudichtenden Seite, eine Feder drückt sie an die Welle, die Staublippe hält Schmutz fern. Vor dem Einbau Lippe benetzen und scharfe Kanten (Nut, Gewinde) mit Hülse oder Folie schützen. Eine eingelaufene Wellenlauffläche ist eine häufige Leckageursache.</p><div class="inst">${V.sealSketch('wdr')}</div><p><b>O-Ring:</b> Er liegt in einer Nut und wird leicht verpresst; der Druck verstärkt die Dichtwirkung. Die Nut wird nicht ganz gefüllt, der Werkstoff richtet sich nach Medium und Temperatur, bei hohem Druck sitzt ein Stützring auf der Niederdruckseite.</p><div class="inst">${V.sealSketch('oring')}</div>`) +
      sec('Federn', `<span class="eq">Kennlinie F = c · s (c in N/mm)</span><span class="eq">Reihe: 1/c = 1/c1 + 1/c2 + … (weicher)</span><span class="eq">Parallel: c = c1 + c2 + … (steifer)</span><span class="eq">Federarbeit W = ½ · c · s²</span><span class="eq">Druckfeder: c = G · d⁴ / (8 · D³ · n), G = ${C.SPR_G} N/mm² (Übungswert)</span>`) +
      `<p class="hint2">Zahlen und Begriffe sind Lehrbuch- und Übungswerte; Unsicheres ist im Quelltext mit PRUEFEN markiert.</p>`;
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" id="tab-${k}" data-t="${k}" data-tab="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'uebs'; S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    /* Beim Wechsel die Grafiken der anderen Reiter verwerfen, damit nur sichtbare Bilder bewegt werden */
    ['uebs', 'zahn', 'riem', 'fed', 'lag', 'bsp', 'help'].forEach(k => { if (k !== t) { const el = $('#' + VIEWID[k]); if (el) el.innerHTML = ''; } });
    (Object.assign({ tasks: renderTasks, rt: renderTrainer, bsp: renderBsp, help: renderHelp }, RENDER))[t]();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'Maschinenelemente-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = 'Maschinenelemente-Lab: ' + T[2];
    if (V.scan) V.scan();
  }
  function setExam(on) { lsSet('exam', on ? '1' : '0'); palSig = ''; updatePal(); toast(on ? '🎓 Prüfmodus an: Tipps kosten 25 % je Stufe.' : 'Prüfmodus aus: Tipps kosten nichts.'); if (S.tab === 'tasks') renderTasks(false); }
  function setMot(on) { S.mot = !!on; lsSet('mot', on ? '1' : '0'); V.motion(S.mot); palSig = ''; updatePal(); }
  let palSig = '';
  function updatePal() {
    const F = !!fx(), fxOn = F && !fx().isMuted(), n = Object.keys(done()).filter(k => TASKS.some(t => t.id === k)).length, red = V.reduced(), mot = S.mot && !red, sig = [F, fxOn, exam(), n, S.rt.streak, S.rt.best, mot, red].join('|'); if (sig === palSig) return; palSig = sig;
    $('#pal').innerHTML = `${F ? `<button class="chip ${fxOn ? 'on' : ''}" data-a="fx" aria-pressed="${fxOn}" title="Effekte und Ton">${fxOn ? '🎉' : '🔇'} Effekte</button>` : ''}<button class="chip ${mot ? 'on' : ''}" id="btn-mot" data-a="mot" aria-pressed="${mot}" ${red ? 'disabled title="Die Systemeinstellung „Bewegung reduzieren“ ist aktiv"' : 'title="Zahnräder und Riemen laufen oder stehen"'}>${mot ? '⏸ Bewegung' : '▶ Bewegung'}</button><button class="chip ${exam() ? 'on' : ''}" data-a="exam" aria-pressed="${exam()}" title="Prüfmodus: Tipps zählen als Abzug">🎓 Prüfmodus</button><button class="chip" data-a="rand" title="Zufällige Frage im Trainer">🎲 Zufallsaufgabe</button>
      <span id="stat">Aufgaben gelöst <b>${n}/${TASKS.length}</b> · Serie <b>${S.rt.streak}</b> · Beste Serie <b>${S.rt.best}</b></span>`;
    $('#bExam').classList.toggle('on', exam()); $('#bExam').setAttribute('aria-pressed', exam());
  }
  $('#pal').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.a === 'fx') { const F = fx(); if (F) { F.setMuted(!F.isMuted()); palSig = ''; updatePal(); if (!F.isMuted()) ding(); } }
    else if (b.dataset.a === 'exam') setExam(!exam());
    else if (b.dataset.a === 'mot') setMot(!S.mot);
    else if (b.dataset.a === 'rand') { setTab('rt'); newTrainer(); }
  });
  $('#bTasks').onclick = () => setTab('tasks'); $('#bHelp').onclick = () => setTab('help'); $('#bExam').onclick = () => setExam(!exam());
  $('#title').onclick = () => setTab('uebs');
  $('#bMenu').onclick = () => {
    const rows = [['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung und Tipps'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Aufgaben mit Serien-Zähler'], ['bsp', 'Beispiele', 'Fertig durchgerechnete Beispiele zum Laden'], ['help', 'Hilfe und Formeln', 'Zahnräder, Riemen, Lager, Kupplungen, Dichtungen, Federn'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben und Trainer-Serie auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
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
  root.MAS_LAB = { id: 'mas', title: 'Maschinenelemente-Lab', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.MAS_TASKS };

  /* Rauchtest für quelle/mas/test_mascore.js (läuft nur, wenn der Test window.__MAS_TEST setzt) */
  root.MAS_UI = {
    smoke: function () {
      if (!root.__MAS_TEST) return 'nur im Test';
      try {
        TABS.forEach(t => setTab(t[0]));
        TASKS.forEach(t => {
          setTab('tasks'); startTask(t.id); const q = S.tq;
          S.tAns[t.id] = {}; checkTask(t);
          S.tAns[t.id] = D.wrongAns(q); checkTask(t); renderTasks(false);
          S.tAns[t.id] = D.solAns(q); S.tRes = null; checkTask(t);
          if (!S.tRes || !S.tRes.ok) throw new Error('Aufgabe ' + t.id + ': Musterlösung wird in der Oberfläche nicht akzeptiert');
          renderTasks(false); hintFor(q, t.id);
        });
        S.tr.level = 0; for (let k = 0; k < 60; k++) { newTrainer(); const q = S.tr.q; S.tr.ans = D.solAns(q); trainerCheck(); renderTrainer(); }
        D.examples.forEach(e => { loadExample(e); if (!exBody(e)) throw new Error('Beispiel ' + e.id + ' leer'); });
        const tryS = (tab, ch) => { Object.assign(S[tab], ch); updateCalc(tab); };
        setTab('uebs'); tryS('uebs', { st: '2', z1: 'x' }); tryS('uebs', { z1: '17', z2: '19', z3: '120', z4: '6', n: '0', M: '-1', eta: '2' }); tryS('uebs', { st: '1', n: '' });
        setTab('zahn'); tryS('zahn', { m: '0' }); tryS('zahn', { m: '2', m2: '', z1: '20', z2: '31', a: '90' }); tryS('zahn', { a: '1000' }); tryS('zahn', { m2: '3' });
        setTab('riem'); ['keil', 'zahn', 'kette'].forEach(ty => { tryS('riem', { type: ty, d1: '100', d2: '1000', a: '10' }); tryS('riem', { d1: 'a', z1: '2' }); tryS('riem', { d1: '100', d2: '250', a: '500', z1: '19', z2: '38', n: '' }); });
        setTab('fed'); ['einzel', 'reihe', 'par', 'geom'].forEach(m => { tryS('fed', { mode: m, c1: '0', c2: '-1' }); tryS('fed', { c1: '6', c2: '3', c3: '10', s: '' }); tryS('fed', { s: '12', d: '0' }); tryS('fed', { d: '3' }); });
        setTab('lag'); ['kz', 'fl', 'gl', 'lh'].forEach(v => { S.lag.view = v; ['', 'abc', '6205-2RS', 'NU208', 'N3', '99999', '6200', '60099', '3020 8'].forEach(c => { tryS('lag', { code: c }); }); ['festlos', 'angestellt', 'schwimmend'].forEach(m => { tryS('lag', { mode: m, L: '0', dT: '80' }); tryS('lag', { L: '400', dT: '30' }); }); tryS('lag', { v: '0', C: '0', kind: 'rolle' }); tryS('lag', { v: '100', C: '14', kind: 'kugel' }); });
        S.mot = true; setMot(false); setMot(true); setTab('bsp'); setTab('help'); return 'ok';
      } catch (e) { return e && e.stack ? e.stack : String(e); }
    }
  };

  buildTabs(); updatePal(); setTab(TABS.some(x => x[0] === S.tab) ? S.tab : 'uebs'); V.motion(S.mot);
  /* Aufruf ?aufgabe=mas1 (Startseite, Lernhefte) öffnet die Aufgabe, ?bsp die Beispiele (?bsp=uebs1 springt zu einem Beispiel) */
  try {
    const qp = new URLSearchParams(location.search), qa = qp.get('aufgabe');
    if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); }
    else if (qp.has('bsp')) { setTab('bsp'); const el = $('#ex_' + (qp.get('bsp') || '').replace(/[^a-z0-9_]/gi, '')); if (el) el.scrollIntoView(); }
  } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
