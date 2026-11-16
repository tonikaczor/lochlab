'use strict';
/* Tonfunk Normen und Konformität: Oberfläche (Lab-Kennung 'nrm', Stufe 'studium').
   Reiter: CE und Richtlinien, Schutzarten, Maschinen, Prüfen, Qualität, Aufgaben, Trainer, Hilfe.
   Module: nrmcore.js (NRM_CORE), nrmdata.js (NRM_DATA, NRM_TASKS), nrmviz.js (NRM_VIZ).
   Speicher (Präfix lm4.nrm.): tab, ce, sk, ms, pf, qm, done ({id:true} nur gelöste), prog ({id:Prozent}), hints, ctipps (nur Prüfmodus), exam ('1'), rt (Trainer), ex_<thema>.
   Tipp-Abzug (25 % je Stufe, höchstens 3 Stufen) gibt es nur im Prüfmodus; beim normalen Üben kosten Tipps nichts.
   Alle Inhalte sind eigene Zusammenfassungen und vereinfachte Lernmodelle, keine Normtexte. Maßgeblich ist die aktuelle Normfassung.
   Aufruf: nrmlab.html?aufgabe=nrmce1 öffnet die Aufgabe. */
(function (root) {
  const C = root.NRM_CORE, D = root.NRM_DATA, V = root.NRM_VIZ;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.nrm.';
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
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>Normen und Konformität</h4><p class="big">Dateien fehlen</p><p class="hint2">nrmcore.js, nrmdata.js oder nrmviz.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks;

  /* ============================================================ Zustand */
  const TABS = [['ce', '✔', 'CE und Richtlinien'], ['sk', '⚡', 'Schutzarten'], ['ms', '🛑', 'Maschinen'], ['pf', '🔌', 'Prüfen'], ['qm', '📋', 'Qualität'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['help', '📘', 'Hilfe']];
  const DEVS = [
    { n: 'Bohrmaschine 750 W', sk: 1, pw: 750, len: 3, heater: false, pe: 0.14, iso: 25, leak: 1.2 }, { n: 'Wasserkocher 2200 W', sk: 1, pw: 2200, len: 1, heater: true, pe: 0.09, iso: 3.2, leak: 1.4 },
    { n: 'Warmwasserspeicher 4500 W', sk: 1, pw: 4500, len: 2, heater: true, pe: 0.12, iso: 0.6, leak: 3.1 }, { n: 'Kabeltrommel 25 m', sk: 1, pw: 0, len: 25, heater: false, pe: 0.45, iso: 40, leak: 0.1 },
    { n: 'Haartrockner 1800 W', sk: 2, pw: 1800, len: 2, heater: false, pe: 0.1, iso: 9, leak: 0.2 }, { n: 'Handlampe 12 V', sk: 3, pw: 20, len: 2, heater: false, pe: 0.1, iso: 8, leak: 0.0 }
  ];
  const BASE = '2027-01-01';
  const ITEMS0 = [{ name: 'Messschieber 150 mm', last: '2026-03-15', months: 12 }, { name: 'Bügelmessschraube', last: '2026-08-20', months: 6 }, { name: 'Digitalmultimeter', last: '2025-09-10', months: 24 }, { name: 'Isolationsmessgerät', last: '2026-01-10', months: 12 }, { name: 'Drehmomentschlüssel', last: '2026-10-05', months: 12 }];
  const DOCS0 = [{ rev: 1, status: 'zurueck', ab: '2026-01-15' }, { rev: 2, status: 'frei', ab: '2026-06-01' }, { rev: 3, status: 'frei', ab: '2027-02-15' }, { rev: 4, status: 'entwurf', ab: '2027-04-01' }];
  const S = {
    tab: lsGet('tab', 'ce'),
    ce: Object.assign({ prod: 'netzteil', ee: true, funktion: true, funk: false, maschine: false, vac: '230', vdc: '0', ausnahme: '', anhang: false, normen: true, done: [], a: '120', b: '150', sub: 'Pb', m: '250' }, lsGet('ce', {})),
    sk: Object.assign({ skSel: 1, ipA: 5, ipB: 4, req: 'IPX5', uln: 230, ucat: 3, cat: 3, uw: 250, pd: 2, cti: 250, rein: false, alt: 2000, aClr: 3, aCrp: 3 }, lsGet('sk', {})),
    ms: Object.assign({ S: 2, F: 1, P: 2, pfh: 4.5e-7, cat: '3', mttfd: '40', dc: '92', d: 30, t1: 20, t2: 80 }, lsGet('ms', {})),
    pf: Object.assign({ dev: 0, sk: 1, len: 3, pw: 750, heater: false, vis: true, func: true, pe: 0.14, iso: 25, leak: 1.2 }, lsGet('pf', {})),
    qm: Object.assign({ day: 60, items: ITEMS0, docs: DOCS0, phase: 'P', n: '20000', d: '7', y1: '98', y2: '95', y3: '99' }, lsGet('qm', {})),
    nh: C.nhInit(), nhLog: [],
    task: null, tq: null, tAns: {}, tRes: null, tTries: {},
    tr: { q: null, ans: {}, res: null, level: 0, topic: '' },
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {}))
  };
  if (!Array.isArray(S.qm.items) || !S.qm.items.length) S.qm.items = ITEMS0; if (!Array.isArray(S.qm.docs) || S.qm.docs.length !== 4) S.qm.docs = DOCS0; if (!Array.isArray(S.ce.done)) S.ce.done = [];
  const R0 = (() => { const m = /[?&]seed=([^&]+)/.exec(location.search); return C.rng(m ? decodeURIComponent(m[1]) : String(Math.random()) + Date.now()); })();

  /* ============================================================ Bausteine */
  const box = (t, fm, res, cls) => `<div class="rdout ${cls || ''}"><span class="st">${esc(t)}</span>${fm ? esc(fm) + ' = ' : ''}<b>${esc(res)}</b></div>`;
  const note = (t, cls) => `<div class="rdout ${cls || 'warn'}">${esc(t)}</div>`;
  const inp = (attr, label, val, unit, extra) => `<label class="f"><span>${esc(label)}${unit ? ' (' + esc(unit) + ')' : ''}</span><input ${attr} inputmode="decimal" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(val)}"${extra || ''}></label>`;
  const wOf = el => { const w = el && el.clientWidth; return w > 120 ? w : Math.max(280, Math.min(1076, (window.innerWidth || 360) - 24)); };
  const roundSig = (v, n) => { if (!isFinite(v) || v === 0) return v; const e = Math.floor(Math.log10(Math.abs(v))), m = Math.pow(10, n - 1 - e); return Math.round(v * m) / m; };
  const posOf = (v, min, max, log) => Math.round((log ? (Math.log(v / min) / Math.log(max / min)) : (v - min) / (max - min)) * 1000);
  const valOf = (pos, min, max, log) => roundSig(log ? min * Math.pow(max / min, pos / 1000) : min + (max - min) * pos / 1000, 3);
  const slider = (st, k, label, val, min, max, log, fmt) => `<label class="f"><span>${esc(label)}: <b data-sv="${st}.${k}">${esc(fmt(val))}</b></span><input type="range" data-sl="${st}.${k}" data-min="${min}" data-max="${max}" data-log="${log ? 1 : 0}" min="0" max="1000" step="1" value="${Math.min(1000, Math.max(0, posOf(val, min, max, log)))}" aria-label="${esc(label)}"></label>`;
  const chartDiv = (id, label) => `<div class="inst" id="${id}" aria-label="${esc(label)}"></div>`;
  const setSvg = (id, html, emptyText) => { const e = $('#' + id); if (!e) return; e.innerHTML = html || `<p class="hint2" style="padding:10px">${esc(emptyText || 'Für diese Werte gibt es kein Diagramm.')}</p>`; };
  const setHtml = (id, html) => { const e = $('#' + id); if (e) e.innerHTML = html; };
  const explain = k => `<details class="ex" ${lsGet('ex_' + k, false) ? 'open' : ''} data-ex="${k}"><summary>Erklärung</summary><div class="hb2">${D.explain[k]}</div></details>`;
  document.addEventListener('toggle', e => { const d = e.target; if (d && d.dataset && d.dataset.ex) lsSet('ex_' + d.dataset.ex, d.open); }, true);
  const sel = (label, attr, opts, cur) => `<label class="f"><span>${esc(label)}</span><select ${attr}>${opts.map(o => `<option value="${esc(o[0])}"${String(o[0]) === String(cur) ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select></label>`;
  const chips = (field, opts, cur, label) => `<div class="ctl" role="group" aria-label="${esc(label)}">${opts.map(o => `<button class="chip ${String(o[0]) === String(cur) ? 'on' : ''}" data-f="${esc(field)}" data-v="${esc(o[0])}" aria-pressed="${String(o[0]) === String(cur)}">${esc(o[1])}</button>`).join('')}</div>`;
  /* Auswahl-Chips: data-f = "zustand.feld", data-v = Wert ('x' = nicht angegeben). Gibt true zurück, wenn ein Chip des Zustands getroffen wurde. */
  function chipClick(e, st) {
    const c = e.target.closest('button[data-f]'); if (!c) return false; const [z, k] = c.dataset.f.split('.'); if (z !== st) return false;
    let v = c.dataset.v; v = v === 'x' ? null : (z === 'ms' && k === 'cat') || (z === 'qm' && k === 'phase') ? v : /^-?\d+(\.\d+)?$/.test(v) ? +v : v;
    S[z][k] = v; if (z === 'pf') S.pf.dev = 'x'; lsSet(z, S[z]); RENDER[z](); return true;
  }
  const tog = (attr, label, on) => `<button class="chip ${on ? 'on' : ''}" ${attr} aria-pressed="${!!on}">${on ? '✓ ' : ''}${esc(label)}</button>`;
  const warnLine = `<p class="hint2">${esc(D.NOTE)}</p>`;
  const UPD = {};
  document.addEventListener('input', e => {
    const el = e.target; if (!el.dataset || !el.dataset.sl) return;
    const [st, k] = el.dataset.sl.split('.'), v = valOf(+el.value, +el.dataset.min, +el.dataset.max, el.dataset.log === '1');
    S[st][k] = v; lsSet(st, S[st]); const lab = $(`[data-sv="${el.dataset.sl}"]`); if (lab) lab.textContent = SLF[el.dataset.sl] ? SLF[el.dataset.sl](v) : f(v, 3);
    UPD[st] && UPD[st]();
  });
  const SLF = {
    'sk.aClr': v => f(v, 2) + ' mm', 'sk.aCrp': v => f(v, 2) + ' mm', 'ms.pfh': v => C.fmtExp(v, 2) + ' 1/h', 'ms.t1': v => f(v, 0) + ' ms', 'ms.t2': v => f(v, 0) + ' ms',
    'pf.len': v => f(v, 1) + ' m', 'pf.pw': v => f(v, 0) + ' W', 'pf.pe': v => f(v, 2) + ' Ω', 'pf.iso': v => f(v, 2) + ' MΩ', 'pf.leak': v => f(v, 2) + ' mA'
  };

  /* ============================================================ 1. CE und Richtlinien */
  const cePrm = () => { const s = S.ce; return { ee: s.ee, funktion: s.funktion, funk: s.funk, maschine: s.maschine, vac: Math.max(0, P(s.vac) || 0), vdc: Math.max(0, P(s.vdc) || 0), ausnahme: s.ausnahme }; };
  function ceOut() {
    const p = cePrm(), d = C.directives(p), q = C.norm(p); let h = '';
    h += box('Geltende Rechtsvorschriften', '', d.list.map(id => C.DIR[id].name + ' (' + C.DIR[id].ref + ')').join(';  '), 'ok');
    h += box('CE-Kennzeichnung', '', d.ce ? 'ja, wegen: ' + d.ceList.map(id => C.DIR[id].name).join(', ') : 'nein (keine der CE-pflichtigen Vorschriften gilt)', d.ce ? 'ok' : 'warn');
    if (d.list.includes('MD') || d.list.includes('RED')) {
      h += '<div class="card pl"><h4>Konformitätsbewertungsverfahren (Lernmodell)</h4>' + (d.list.includes('MD') ? '<div class="ctl">' + tog('data-cet="anhang"', 'Maschine steht in der Liste der besonders gefährlichen Maschinen (Anhang IV der Maschinenrichtlinie; ab 20.01.2027 Anhang I der Maschinenverordnung)', S.ce.anhang) + '</div>' : '') + '<div class="ctl">' + tog('data-cet="normen"', 'Harmonisierte Normen vollständig angewandt', S.ce.normen) + '</div>';
      const vt = { intern: 'Der Hersteller bewertet allein (interne Fertigungskontrolle).', benannt: 'Eine Benannte Stelle muss mitwirken.', wahl: 'Der Hersteller darf wählen: allein oder mit Benannter Stelle.' };
      ['MD', 'RED'].filter(id => d.list.includes(id)).forEach(id => { h += box(C.DIR[id].name, '', vt[C.verfahren(id, { anhangIV: S.ce.anhang, normen: S.ce.normen })]); });
      h += '</div>';
    }
    if (q.ee && q.funk && q.maschine) h += note('Ein Funkgerät, das zugleich Maschine ist, braucht beide Vorschriften zusammen. Das Lernmodell zeigt diese Kombination nur grob; im Einzelfall entscheidet der Leitfaden zur jeweiligen Richtlinie.');
    return h;
  }
  function updateCe() { setSvg('ceTree', V.treeSvg(cePrm(), wOf($('#ceTree')))); setHtml('ceOut', ceOut()); updateCeSteps(); updateCeStoff(); }
  function updateCeSteps() {
    const done = S.ce.done, av = C.stepsAvailable(done);
    setSvg('ceChain', V.stepsSvg(done, wOf($('#ceChain'))));
    setHtml('ceSteps', C.STEPS.map((s, i) => { const d = done.includes(s.id), a = av.includes(s.id); return `<button data-cs="${s.id}" class="${d ? 'done' : a ? 'av' : ''}" ${!d && !a ? 'disabled' : ''} aria-pressed="${d}"><span class="nb">${d ? '✓' : i + 1}</span><span>${esc(s.name)}<small style="display:block;color:var(--mute)">${d ? 'erledigt (antippen zum Zurücknehmen)' : a ? 'jetzt möglich' : 'gesperrt: braucht ' + esc(s.after.filter(x => !done.includes(x)).map(x => C.STEP[x].name).join(', '))}</small></span></button>`; }).join(''));
  }
  function updateCeStoff() {
    const a = P(S.ce.a), b = P(S.ce.b), m = P(S.ce.m); let h = '';
    const sh = C.sharePct(a, b * 1000);
    h += Number.isFinite(sh) ? box('SVHC-Anteil im Erzeugnis', 'w = m(Stoff) / m(Erzeugnis)', f(sh, 3) + ' %', C.exceeds(sh, C.REACH_PCT) ? 'bad' : 'ok') + `<p class="hint2">${C.exceeds(sh, C.REACH_PCT) ? 'Über 0,1 %: Informationspflicht nach REACH Artikel 33 (Lernmodell).' : 'Höchstens 0,1 %: keine Informationspflicht. Genau 0,1 % löst sie noch nicht aus.'}</p>` : note('Bitte zwei positive Zahlen eingeben (Stoffmasse in mg, Erzeugnismasse in g).');
    setHtml('ceReach', h); h = '';
    const mx = C.rohsMaxMass(S.ce.sub, m * 1000);
    h += Number.isFinite(mx) && m > 0 ? box('Höchstmasse im homogenen Werkstoff', 'm_max = m(Werkstoff) · Grenzwert (' + f(C.rohsLimitPct(S.ce.sub), 2) + ' %)', f(mx, 3) + ' mg', 'ok') : note('Bitte eine positive Masse in g eingeben.');
    setHtml('ceRohs', h);
  }
  function renderCe() {
    const s = S.ce;
    $('#ceView').innerHTML = explain('ce') + `<div class="card pl"><h4>Welche Rechtsvorschrift gilt für das Produkt?</h4>
      ${sel('Beispielprodukt (oder eigene Angaben)', 'data-ce="prod"', C.PRODUCTS.map(x => [x.id, x.name]).concat([['custom', 'Eigene Angaben (selbst einstellen)']]), s.prod)}
      <span class="lbl2">Eigenschaften</span><div class="ctl">${tog('data-cet="ee"', 'Elektrisches Gerät', s.ee)}${tog('data-cet="funktion"', 'Eigene Funktion für Endnutzer', s.funktion)}${tog('data-cet="funk"', 'Absichtliche Funkfunktion', s.funk)}${tog('data-cet="maschine"', 'Maschine (angetrieben, bewegliche Teile)', s.maschine)}</div>
      <div class="dsrow">${inp('data-cv="vac"', 'Bemessungsspannung AC (Effektivwert)', s.vac, 'V')}${inp('data-cv="vdc"', 'Bemessungsspannung DC', s.vdc, 'V')}</div>
      ${sel('Ausnahme für RoHS und WEEE', 'data-ce="ausnahme"', [['', 'keine Ausnahme'], ['gross', C.EXC.gross], ['fahrzeug', C.EXC.fahrzeug], ['militaer', C.EXC.militaer]], s.ausnahme)}
      ${chartDiv('ceTree', 'Entscheidungsbaum der Rechtsvorschriften')}<div id="ceOut"></div></div>
      <div class="card pl"><h4>Ablauf der Konformitätsbewertung: Reihenfolge üben</h4><p class="hint2" style="margin-top:0">Tippe die Schritte der Reihe nach an. Ein Schritt wird erst frei, wenn seine Voraussetzungen erledigt sind. Ein erledigter Schritt lässt sich zurücknehmen; abhängige Schritte fallen dann mit weg.</p>${chartDiv('ceChain', 'Fortschritt der Konformitätsbewertung')}<div class="stp" id="ceSteps"></div><div class="btns"><button class="btn" data-cer="1">Zurücksetzen</button></div>
      <p class="hint2">Zur Konformitätsbewertung gehören die Risikobeurteilung, die technische Dokumentation (Beschreibung, Pläne, Berechnungen, Prüfberichte, Anleitung) und die EU-Konformitätserklärung. Die Unterlagen werden mindestens zehn Jahre aufbewahrt.</p></div>
      <div class="card pl"><h4>Stoffe: REACH und RoHS rechnen</h4><div class="cols"><div><span class="lbl2">REACH (Lernmodell, Schwelle 0,1 % je Erzeugnis)</span><div class="dsrow">${inp('data-cx="a"', 'Masse des SVHC im Erzeugnis', s.a, 'mg')}${inp('data-cx="b"', 'Masse des Erzeugnisses', s.b, 'g')}</div><div id="ceReach"></div></div>
      <div><span class="lbl2">RoHS (Grenzwert je homogenem Werkstoff)</span>${sel('Stoff', 'data-cx="sub"', C.ROHS_LIMITS.map(x => [x.id, x.name + ' – ' + f(x.pct, 2) + ' %']), s.sub)}${inp('data-cx="m"', 'Masse des Werkstoffs', s.m, 'g')}<div id="ceRohs"></div></div></div></div>${warnLine}`;
    updateCe();
  }
  UPD.ce = updateCe;
  $('#ceView').addEventListener('input', e => { const k = e.target.dataset.cv, x = e.target.dataset.cx; if (k) { S.ce[k] = e.target.value; S.ce.prod = 'custom'; const sl = $('[data-ce="prod"]'); if (sl) sl.value = 'custom'; lsSet('ce', S.ce); updateCe(); } else if (x) { S.ce[x] = e.target.value; lsSet('ce', S.ce); updateCeStoff(); } });
  $('#ceView').addEventListener('change', e => {
    const k = e.target.dataset.ce, x = e.target.dataset.cx;
    if (k === 'prod') { S.ce.prod = e.target.value; const pr = C.PRODUCTS.find(y => y.id === e.target.value); if (pr) { const q = C.norm(pr.p); Object.assign(S.ce, { ee: q.ee, funktion: q.funktion, funk: q.funk, maschine: q.maschine, vac: String(q.vac).replace('.', ','), vdc: String(q.vdc).replace('.', ','), ausnahme: q.ausnahme }); } lsSet('ce', S.ce); renderCe(); }
    else if (k === 'ausnahme') { S.ce.ausnahme = e.target.value; S.ce.prod = 'custom'; lsSet('ce', S.ce); renderCe(); }
    else if (x === 'sub') { S.ce.sub = e.target.value; lsSet('ce', S.ce); updateCeStoff(); }
  });
  $('#ceView').addEventListener('click', e => {
    const t = e.target.closest('[data-cet]'), cs = e.target.closest('[data-cs]'), rs = e.target.closest('[data-cer]');
    if (t) { const k = t.dataset.cet; S.ce[k] = !S.ce[k]; if (k !== 'anhang' && k !== 'normen') { S.ce.prod = 'custom'; if (k === 'funk' && S.ce.funk) S.ce.ee = true; } lsSet('ce', S.ce); renderCe(); }
    else if (cs) { const id = cs.dataset.cs, done = S.ce.done; if (done.includes(id)) { let nd = done.filter(x => x !== id), ch = true; while (ch) { ch = false; nd = nd.filter(x => { const ok = C.STEP[x].after.every(a => nd.includes(a)); if (!ok) ch = true; return ok; }); } S.ce.done = nd; } else if (C.stepsAvailable(done).includes(id)) done.push(id); lsSet('ce', S.ce); updateCeSteps(); }
    else if (rs) { S.ce.done = []; lsSet('ce', S.ce); updateCeSteps(); }
  });

  /* ============================================================ 2. Schutzarten */
  const ULN = [[50, '50 V (Kleinspannungsnetz)'], [120, '120 V (Netz 120/208 V)'], [150, '150 V'], [230, '230 V (Netz 230/400 V)'], [277, '277 V (Netz 277/480 V)'], [400, '400 V (Netz 400/690 V)'], [1000, '1000 V']];
  const CATN = [[1, 'I'], [2, 'II'], [3, 'III'], [4, 'IV']];
  const ISOP = () => { const s = S.sk; return { uLn: +s.uln, cat: +s.cat, uw: +s.uw, pd: +s.pd, cti: P(s.cti), reinforced: !!s.rein, altitude: +s.alt }; };
  function skIsoOut() {
    const s = S.sk, inp_ = ISOP(), r = C.isolation(inp_); if (!r.ok) { setSvg('skGap', ''); return note(r.err); }
    setSvg('skGap', V.gapSvg(r, s.aClr, s.aCrp, wOf($('#skGap'))));
    const ck = C.isolationCheck(r, s.aClr, s.aCrp);
    let h = box('Luftstrecke (gefordert)', '', f(r.clearance, 2) + ' mm', ck.clrOk ? 'ok' : 'bad') + box('Kriechstrecke (gefordert)', '', f(r.creepage, 2) + ' mm', ck.crpOk ? 'ok' : 'bad');
    h += `<details class="st"><summary>Rechenweg</summary><div class="hb2"><p>Stoßspannung: ${f(r.imp, 0)} V (Netz ${f(inp_.uLn, 0)} V, Kategorie ${['I', 'II', 'III', 'IV'][inp_.cat - 1]})${r.reinforced ? '; verstärkte Isolierung: eine Stufe höher = ' + f(r.impUsed, 0) + ' V' : ''}.</p><p>Luftstrecke: Tabellenwert ${f(r.tab, 2)} mm · Höhenfaktor ${f(r.af, 2)}, mindestens ${f(C.PD_MIN[inp_.pd], 2)} mm (Verschmutzungsgrad ${inp_.pd}) = ${f(r.clearance, 2)} mm.</p><p>Kriechstrecke: ${inp_.pd === 1 ? 'Verschmutzungsgrad 1: im Lernmodell wie die Luftstrecke' : 'Zeile ' + r.rowV + ' V, Werkstoffgruppe ' + r.group + ', Verschmutzungsgrad ' + inp_.pd + ': ' + f(r.crBasic, 2) + ' mm'}${r.reinforced ? ' · 2 (verstärkt)' : ''}${r.creepFromClr ? '; angehoben auf die Luftstrecke, weil die Kriechstrecke nie kleiner sein darf' : ''} = ${f(r.creepage, 2)} mm.</p></div></details>`;
    return h;
  }
  function skIpOut() {
    const s = S.sk, a = s.ipA, b = s.ipB, code = C.ipStr(a, b); setSvg('skIp', V.ipSvg(a, b, wOf($('#skIp'))));
    let h = box('Bedeutung der ersten Ziffer', a == null ? 'X' : String(a), a == null ? 'nicht angegeben' : C.IP1[a]) + box('Bedeutung der zweiten Ziffer', b == null ? 'X' : String(b), b == null ? 'nicht angegeben' : C.IP2[b]);
    const rq = C.ipParse(s.req), cv = C.ipCovers(s.req, code);
    h += `<div class="dsrow">${inp('data-ipr="1"', 'Geforderte Schutzart prüfen (z. B. IPX5 oder IP54)', s.req, '')}</div>`;
    const why = !rq || cv ? '' : (rq.a != null && (a == null || a < rq.a)) ? 'nein: die erste Ziffer ist zu niedrig oder nicht angegeben' : (rq.b != null && (b == null || b < rq.b)) ? 'nein: die zweite Ziffer ist zu niedrig oder nicht angegeben' : 'nein, nicht automatisch: 7 und 8 schließen Strahlwasser (5, 6) nicht ein, 9 schließt weder 5/6 noch 7/8 ein; nötig ist eine Doppelkennzeichnung oder eigene Prüfung';
    h += cv == null ? note('Eingabe nicht lesbar. Beispiele: IPX5, IP54, IP6X.') : cv ? box('Erfüllt ' + code + ' die Anforderung ' + s.req.toUpperCase() + '?', '', 'ja', 'ok') : box('Erfüllt ' + code + ' die Anforderung ' + s.req.toUpperCase() + '?', '', why, 'bad');
    return h;
  }
  function updateSk() {
    const s = S.sk; setHtml('skIpOut', skIpOut());
    setSvg('skCls', V.skSvg(s.skSel, wOf($('#skCls')))); const k = C.SK[s.skSel]; setHtml('skClsOut', box(k.name, '', k.kurz) + `<p class="hint2">Zeichen: ${esc(k.symbol)}.</p>`);
    const iv = C.impulseV(+s.uln, +s.ucat); setSvg('skCat', V.catSvg(+s.uln, +s.ucat, wOf($('#skCat')))); setHtml('skCatOut', box('Bemessungs-Stoßspannung', 'Netz ' + f(+s.uln, 0) + ' V, Kategorie ' + ['I', 'II', 'III', 'IV'][s.ucat - 1], f(iv / 1000, 2) + ' kV', 'ok') + `<p class="hint2">${esc(C.CAT_TEXT[s.ucat])}.</p>`);
    setHtml('skIsoOut', skIsoOut());
  }
  function renderSk() {
    const s = S.sk;
    const impT = '<div class="tw"><table class="pl"><tr><th>Netz Leiter–Neutral bis</th>' + [1, 2, 3, 4].map(c => '<th>Kat. ' + ['I', 'II', 'III', 'IV'][c - 1] + '</th>').join('') + '</tr>' + C.IMPULSE_ROWS.map(r => '<tr><td>' + r[0] + ' V</td>' + r[1].map(v => '<td>' + f(v / 1000, 2) + ' kV</td>').join('') + '</tr>').join('') + '</table></div>';
    const clr = '<div class="tw"><table class="pl"><tr><th>Stoßspannung</th><th>Luftstrecke (Tabellenwert)</th></tr>' + C.IMPULSE_SERIES.map(v => '<tr><td>' + f(v / 1000, 2) + ' kV</td><td>' + f(C.CLR[v], 2) + ' mm</td></tr>').join('') + '</table></div><p class="hint2">Mindestwerte nach Verschmutzungsgrad: 1 → 0 mm, 2 → 0,2 mm, 3 → 0,8 mm. Höhenfaktor: bis 2000 m 1,00; bis 3000 m 1,14; bis 4000 m 1,29; bis 5000 m 1,48.</p>';
    const crp = '<div class="tw"><table class="pl"><tr><th>Arbeitsspannung bis</th><th>PD 2, Gruppe I</th><th>PD 2, II</th><th>PD 2, III</th><th>PD 3, I</th><th>PD 3, II</th><th>PD 3, III</th></tr>' + C.CR_V.map((v, i) => '<tr><td>' + v + ' V</td>' + C.CR[2][i].concat(C.CR[3][i]).map(x => '<td>' + f(x, 2) + ' mm</td>').join('') + '</tr>').join('') + '</table></div><p class="hint2">Werkstoffgruppe aus dem CTI: I ab 600, II ab 400, IIIa ab 175, IIIb ab 100. Verschmutzungsgrad 1: wie die Luftstrecke. Verstärkte Isolierung: doppelte Kriechstrecke. Die Kriechstrecke ist nie kleiner als die Luftstrecke.</p>';
    $('#skView').innerHTML = explain('sk') + `<div class="card pl"><h4>Schutzklassen</h4>${chips('sk.skSel', [[1, 'Klasse I'], [2, 'Klasse II'], [3, 'Klasse III']], s.skSel, 'Schutzklasse')}${chartDiv('skCls', 'Schutzklassen mit Zeichen')}<div id="skClsOut"></div></div>
      <div class="card pl"><h4>IP-Code zusammenstellen</h4><span class="lbl2">Erste Ziffer (feste Körper, Staub)</span>${chips('sk.ipA', [['x', 'X']].concat([0, 1, 2, 3, 4, 5, 6].map(i => [i, String(i)])), s.ipA == null ? 'x' : s.ipA, 'Erste Ziffer')}<span class="lbl2">Zweite Ziffer (Wasser)</span>${chips('sk.ipB', [['x', 'X']].concat([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => [i, String(i)])), s.ipB == null ? 'x' : s.ipB, 'Zweite Ziffer')}${chartDiv('skIp', 'IP-Code als Skala')}<div id="skIpOut"></div></div>
      <div class="card pl"><h4>Überspannungskategorie und Stoßspannung</h4>${sel('Spannung Außenleiter gegen Neutralleiter', 'data-sk="uln"', ULN, s.uln)}<span class="lbl2">Kategorie</span>${chips('sk.ucat', CATN, s.ucat, 'Überspannungskategorie')}${chartDiv('skCat', 'Stoßspannung je Kategorie')}<div id="skCatOut"></div><details class="st"><summary>Tabelle der Bemessungs-Stoßspannung (Lernmodell)</summary><div class="hb2">${impT}</div></details></div>
      <div class="card pl"><h4>Luft- und Kriechstrecken (Lernbeispiel)</h4><p class="hint2" style="margin-top:0">Lernbeispiel: vereinfachte Tabellen, nicht die Normtabellen.</p>
      <div class="cols"><div>${sel('Netzspannung Leiter–Neutral', 'data-sk="uln2"', ULN, s.uln)}<span class="lbl2">Überspannungskategorie</span>${chips('sk.cat', CATN, s.cat, 'Kategorie')}${sel('Arbeitsspannung (Effektivwert, aufgerundet auf die Tabellenzeile)', 'data-sk="uw"', C.CR_V.map(v => [v, v + ' V']), s.uw)}<span class="lbl2">Verschmutzungsgrad</span>${chips('sk.pd', [[1, '1'], [2, '2'], [3, '3']], s.pd, 'Verschmutzungsgrad')}</div>
      <div>${inp('data-sk="cti"', 'CTI des Isolierstoffs (Vergleichszahl der Kriechstromfestigkeit)', s.cti, '')}${sel('Isolierung', 'data-sk="rein"', [['0', 'Basisisolierung'], ['1', 'Verstärkte Isolierung']], s.rein ? '1' : '0')}${sel('Aufstellhöhe', 'data-sk="alt"', [[2000, 'bis 2000 m'], [3000, 'bis 3000 m'], [4000, 'bis 4000 m'], [5000, 'bis 5000 m']], s.alt)}${slider('sk', 'aClr', 'Vorhandene Luftstrecke', s.aClr, 0.1, 20, true, SLF['sk.aClr'])}${slider('sk', 'aCrp', 'Vorhandene Kriechstrecke', s.aCrp, 0.1, 30, true, SLF['sk.aCrp'])}</div></div>
      ${chartDiv('skGap', 'Luftstrecke und Kriechstrecke')}<div id="skIsoOut"></div>
      <details class="st"><summary>Tabelle Luftstrecke (Lernmodell)</summary><div class="hb2">${clr}</div></details><details class="st"><summary>Tabelle Kriechstrecke (Lernmodell)</summary><div class="hb2">${crp}</div></details></div>${warnLine}`;
    updateSk();
  }
  UPD.sk = () => setHtml('skIsoOut', skIsoOut());
  $('#skView').addEventListener('click', e => { chipClick(e, 'sk'); });
  $('#skView').addEventListener('change', e => {
    const k = e.target.dataset.sk; if (!k) return;
    if (k === 'uln' || k === 'uln2') { S.sk.uln = +e.target.value; } else if (k === 'uw') S.sk.uw = +e.target.value; else if (k === 'rein') S.sk.rein = e.target.value === '1'; else if (k === 'alt') S.sk.alt = +e.target.value; else return;
    lsSet('sk', S.sk); renderSk();
  });
  $('#skView').addEventListener('input', e => {
    if (e.target.dataset.sk === 'cti') { S.sk.cti = e.target.value; lsSet('sk', S.sk); setHtml('skIsoOut', skIsoOut()); }
    else if (e.target.dataset.ipr) { S.sk.req = e.target.value; lsSet('sk', S.sk); setHtml('skIpOut', skIpOut()); }
  });

  /* ============================================================ 3. Maschinen */
  const NHE = C.NH_EVENTS;
  function nhPress(ev) {
    S.nh = C.nhStep(S.nh, ev); S.nhLog.push(C.NH_EV_TEXT[ev] + ' → ' + C.NH_TEXT[S.nh.st]); if (S.nhLog.length > 8) S.nhLog.shift(); renderNhPart();
  }
  function renderNhPart() {
    setSvg('msNh', V.nhSvg(S.nh, wOf($('#msNh'))));
    setHtml('msNhLog', S.nhLog.length ? `<ol class="nhlog">${S.nhLog.map(l => '<li>' + esc(l) + '</li>').join('')}</ol>` : '<p class="hint2">Noch keine Ereignisse. Beginne mit „Rücksetzen“, dann „Start“.</p>');
  }
  function msOut() {
    const s = S.ms, plr = C.riskGraph(s.S, s.F, s.P); let h = '';
    setSvg('msRisk', V.riskSvg(s.S, s.F, s.P, wOf($('#msRisk'))));
    h += box('Erforderlicher Performance Level', 'S' + s.S + ' · F' + s.F + ' · P' + s.P, 'PLr ' + plr, 'ok');
    setHtml('msRiskOut', h);
    /* PFH */
    const o = C.plFromPfh(s.pfh), so = C.silFromPfh(s.pfh); setSvg('msPfh', V.pfhSvg(s.pfh, wOf($('#msPfh'))));
    setHtml('msPfhOut', box('PFHd', '', C.fmtExp(s.pfh, 2) + ' 1/h') + box('Performance Level', '', o.none ? 'kein PL (PFHd ab 10⁻⁴ pro Stunde)' : 'PL ' + o.pl + (o.beyond ? ' (besser als das Band von PL e)' : ''), o.none ? 'bad' : 'ok') + box('SIL (nach IEC 62061)', '', so.sil ? 'SIL ' + so.sil + (so.beyond ? ' (höher als SIL 3 gibt es nicht)' : '') : 'kein SIL (PFH ab 10⁻⁵ pro Stunde)', so.sil ? 'ok' : 'warn'));
    /* Kategorie */
    const y = P(s.mttfd), dc = P(s.dc), mc = C.mttfdClass(y), dcl = C.dcClass(dc), plc = mc && dcl ? C.plFromCat(s.cat, mc, dcl) : null; let k = '';
    if (!mc) k += note('MTTFd muss mindestens 3 Jahre betragen (niedrig 3 bis unter 10, mittel 10 bis unter 30, hoch 30 bis 100 Jahre). Pro Kanal werden höchstens 100 Jahre angerechnet.');
    else if (!dcl) k += note('Bitte DCavg in Prozent angeben (0 bis 100).');
    else {
      k += box('MTTFd-Klasse', f(Math.min(y, 100), 1) + ' Jahre', mc) + box('DCavg-Klasse', f(dc, 1) + ' %', dcl);
      k += plc ? box('Erreichbarer PL (Lernmodell)', 'Kategorie ' + s.cat + ', MTTFd ' + mc + ', DC ' + dcl, 'PL ' + plc, C.plMeets(plc, plr) ? 'ok' : 'bad') + `<p class="hint2">${C.plMeets(plc, plr) ? '✓ PL ' + plc + ' reicht für PLr ' + plr + ' aus dem Risikographen oben.' : '✗ PL ' + plc + ' reicht nicht für PLr ' + plr + ': mehr Diagnose, höhere MTTFd oder höhere Kategorie nötig.'}</p>` : note('Diese Kombination aus Kategorie, MTTFd und DC kommt im Lernmodell nicht vor (zum Beispiel Kategorie 1 braucht hohe MTTFd ohne DC, Kategorie 4 hohe MTTFd und hohen DC).', 'bad');
    }
    const combos = [['B', 'keine'], ['1', 'keine'], ['2', 'niedrig'], ['2', 'mittel'], ['3', 'niedrig'], ['3', 'mittel'], ['4', 'hoch']];
    k += `<div class="tw"><table class="pl"><tr><th>MTTFd ↓ / Kategorie, DC →</th>${combos.map(c => `<th>Kat. ${c[0]}<br>DC ${c[1]}</th>`).join('')}</tr>${['hoch', 'mittel', 'niedrig'].map(m => `<tr><th>${m}</th>${combos.map(c => { const pl = C.plFromCat(c[0], m, c[1]), hit = mc === m && s.cat === c[0] && dcl === c[1]; return `<td class="${hit ? 'hit' : pl ? '' : 'no'}">${pl ? 'PL ' + pl : '–'}</td>`; }).join('')}</tr>`).join('')}</table></div><p class="hint2">„–“ = Kombination im Lernmodell nicht vorgesehen. Die Norm verlangt zusätzlich Maßnahmen gegen Ausfälle gemeinsamer Ursache, systematische Fehler und Software-Anforderungen.</p>`;
    setHtml('msCatOut', k);
    /* Sicherheitsabstand */
    const T_ = (s.t1 + s.t2) / 1000, sd = C.safetyDistance(+s.d, T_);
    setSvg('msDist', V.distSvg(+s.d, T_, wOf($('#msDist'))));
    setHtml('msDistOut', Number.isFinite(sd) ? box('Gesamtzeit', 'T = t₁ + t₂', f(T_ * 1000, 0) + ' ms') + box('Sicherheitsabstand', 'S = K·T + C', f(sd, 0) + ' mm', 'ok') + '<p class="hint2">S = K·T + C ist die Schreibweise der ISO 13855 von 2010. Die Ausgabe 2024 gliedert die Formel anders (S = K·T + DDS + Z). Maßgeblich ist die aktuelle Ausgabe.</p>' : note('Für diese Werte gibt es keinen Abstand im Lernmodell.'));
  }
  function renderMs() {
    const s = S.ms, stxt = { 1: 'S1 leicht', 2: 'S2 schwer' }, ftxt = { 1: 'F1 selten/kurz', 2: 'F2 häufig/lang' }, ptxt = { 1: 'P1 möglich', 2: 'P2 kaum möglich' };
    $('#msView').innerHTML = explain('ms') + `<div class="card pl"><h4>Risikograph: erforderlichen Performance Level bestimmen</h4><span class="lbl2">Schwere der Verletzung (S)</span>${chips('ms.S', [[1, stxt[1]], [2, stxt[2]]], s.S, 'Schwere')}<span class="lbl2">Häufigkeit und Dauer der Gefährdung (F)</span>${chips('ms.F', [[1, ftxt[1]], [2, ftxt[2]]], s.F, 'Häufigkeit')}<span class="lbl2">Möglichkeit, die Gefährdung zu vermeiden (P)</span>${chips('ms.P', [[1, ptxt[1]], [2, ptxt[2]]], s.P, 'Vermeidung')}${chartDiv('msRisk', 'Risikograph')}<div id="msRiskOut"></div></div>
      <div class="card pl"><h4>PFHd, PL und SIL</h4>${slider('ms', 'pfh', 'PFH bzw. PFHd je Stunde', s.pfh, 1e-9, 1e-3, true, SLF['ms.pfh'])}${chartDiv('msPfh', 'PFH-Skala')}<div id="msPfhOut"></div><p class="hint2">Reihenschaltung von Teilsystemen: PFHd addieren (Sensor + Auswertung + Aktor).</p></div>
      <div class="card pl"><h4>Kategorie, MTTFd und DCavg: erreichbarer PL (Lernmodell)</h4><span class="lbl2">Kategorie</span>${chips('ms.cat', C.CATS.map(c => [c, 'Kategorie ' + c]), s.cat, 'Kategorie')}<div class="dsrow">${inp('data-mi="mttfd"', 'MTTFd je Kanal', s.mttfd, 'Jahre')}${inp('data-mi="dc"', 'Diagnosedeckungsgrad DCavg', s.dc, '%')}</div><div id="msCatOut"></div></div>
      <div class="card pl"><h4>Not-Halt: zweikanalige Logik ausprobieren</h4><p class="hint2" style="margin-top:0">Tippe Ereignisse an und beobachte die Zustände. Not-Halt wirkt sofort; nach dem Entriegeln startet nichts von selbst.</p><div class="ctl">${NHE.map(e => `<button class="chip" data-nh="${e}">${esc(C.NH_EV_TEXT[e])}</button>`).join('')}</div><div class="btns"><button class="btn" data-nhr="1">Zurücksetzen (Anfangszustand)</button></div>${chartDiv('msNh', 'Zustände des Not-Halt')}<div id="msNhLog"></div></div>
      <div class="card pl"><h4>Sicherheitsabstand eines Lichtvorhangs</h4>${sel('Detektionsvermögen d des Lichtvorhangs', 'data-ms="d"', [[14, '14 mm (Finger)'], [20, '20 mm'], [30, '30 mm (Hand)'], [40, '40 mm'], [50, '50 mm'], [70, '70 mm']], s.d)}${slider('ms', 't1', 'Ansprechzeit des Lichtvorhangs t₁', s.t1, 5, 100, false, SLF['ms.t1'])}${slider('ms', 't2', 'Nachlaufzeit der Maschine t₂', s.t2, 10, 400, false, SLF['ms.t2'])}${chartDiv('msDist', 'Sicherheitsabstand')}<div id="msDistOut"></div></div>${warnLine}`;
    msOut(); renderNhPart();
  }
  UPD.ms = msOut;
  $('#msView').addEventListener('click', e => {
    if (chipClick(e, 'ms')) return;
    const n = e.target.closest('[data-nh]'), r = e.target.closest('[data-nhr]');
    if (n) nhPress(n.dataset.nh); else if (r) { S.nh = C.nhInit(); S.nhLog = []; renderNhPart(); }
  });
  $('#msView').addEventListener('input', e => { const k = e.target.dataset.mi; if (k) { S.ms[k] = e.target.value; lsSet('ms', S.ms); msOut(); } });
  $('#msView').addEventListener('change', e => { if (e.target.dataset.ms === 'd') { S.ms.d = +e.target.value; lsSet('ms', S.ms); msOut(); } });

  /* ============================================================ 4. Prüfen */
  function pfOut() {
    const s = S.pf, dev = { sk: +s.sk, len: +s.len, pw: +s.pw, heater: !!s.heater }, ev = C.evaluate(dev, { vis: !!s.vis, func: !!s.func, pe: s.pe, iso: s.iso, leak: s.leak });
    setSvg('pfSvg', V.pruefSvg(ev, wOf($('#pfSvg'))));
    const lim = [dev.sk === 1 ? 'Schutzleiterwiderstand höchstens ' + f(C.peLimit(dev.len), 1) + ' Ω' : '', 'Isolationswiderstand mindestens ' + f(C.isoLimit(dev.sk, dev.heater, dev.pw), 2) + ' MΩ', C.leakLimit(dev.sk, dev.heater, dev.pw) != null ? (dev.sk === 1 ? 'Schutzleiterstrom' : 'Berührungsstrom') + ' höchstens ' + f(C.leakLimit(dev.sk, dev.heater, dev.pw), 2) + ' mA' : ''].filter(Boolean);
    setHtml('pfOut', box('Grenzwerte für diesen Prüfling', '', lim.join(';  ')) + box('Prüfergebnis', '', ev.verdict, ev.verdict === 'bestanden' ? 'ok' : 'bad') + `<p class="hint2">${esc(ev.action)}</p>`);
  }
  function renderPf() {
    const s = S.pf;
    $('#pfView').innerHTML = explain('pf') + `<div class="card pl"><h4>Prüfling wählen</h4>${sel('Beispielgerät', 'data-pf="dev"', DEVS.map((d, i) => [i, d.n]).concat([['x', 'Eigene Angaben (selbst einstellen)']]), s.dev)}<span class="lbl2">Schutzklasse</span>${chips('pf.sk', [[1, 'Klasse I'], [2, 'Klasse II'], [3, 'Klasse III']], s.sk, 'Schutzklasse')}<div class="ctl">${tog('data-pft="heater"', 'Heizelement', s.heater)}${tog('data-pft="vis"', 'Sichtprüfung ohne Mangel', s.vis)}${tog('data-pft="func"', 'Funktion in Ordnung', s.func)}</div>${slider('pf', 'len', 'Länge der Anschlussleitung', s.len, 0.5, 80, true, SLF['pf.len'])}${slider('pf', 'pw', 'Leistung des Geräts', s.pw, 10, 10000, true, SLF['pf.pw'])}</div>
      <div class="card pl"><h4>Messwerte einstellen und beurteilen</h4>${slider('pf', 'pe', 'Schutzleiterwiderstand (nur Schutzklasse I)', s.pe, 0.01, 5, true, SLF['pf.pe'])}${slider('pf', 'iso', 'Isolationswiderstand', s.iso, 0.05, 200, true, SLF['pf.iso'])}${slider('pf', 'leak', 'Schutzleiter- bzw. Berührungsstrom', s.leak, 0.01, 15, true, SLF['pf.leak'])}${chartDiv('pfSvg', 'Prüfablauf mit Messwerten')}<div id="pfOut"></div></div>${warnLine}`;
    pfOut();
  }
  UPD.pf = pfOut;
  $('#pfView').addEventListener('click', e => {
    if (chipClick(e, 'pf')) return;
    const t = e.target.closest('[data-pft]');
    if (t) { const k = t.dataset.pft; S.pf[k] = !S.pf[k]; if (k === 'heater') S.pf.dev = 'x'; lsSet('pf', S.pf); renderPf(); }
  });
  $('#pfView').addEventListener('change', e => {
    if (e.target.dataset.pf !== 'dev') return; const v = e.target.value; S.pf.dev = v;
    if (v !== 'x') { const d = DEVS[+v]; if (d) Object.assign(S.pf, { sk: d.sk, pw: d.pw || 10, len: d.len, heater: d.heater, pe: d.pe, iso: d.iso, leak: Math.max(0.01, d.leak), vis: true, func: true }); }
    lsSet('pf', S.pf); renderPf();
  });

  /* ============================================================ 5. Qualität */
  const todayQ = () => C.isoFromDay(C.dayNum(BASE) + Math.round(S.qm.day));
  const STT = { entwurf: 'Entwurf', frei: 'freigegeben', zurueck: 'zurückgezogen' };
  function qmOut() {
    const s = S.qm, today = todayQ(); setSvg('qmCal', V.calSvg(s.items, today, wOf($('#qmCal'))));
    setHtml('qmCalBtn', '<div class="btns">' + s.items.map((it, i) => { const st = C.calStatus(it.last, it.months, today); return `<button class="btn" data-qc="${i}">${esc(it.name)}: ${C.CAL_TEXT[st.status]}, jetzt kalibrieren</button>`; }).join('') + '</div>');
    const valid = C.validDoc(s.docs, today);
    setHtml('qmDocs', s.docs.map((d, i) => `<div class="doc ${valid === d.rev ? 'valid' : ''}"><b>Revision ${d.rev}</b><span style="flex:1">${valid === d.rev ? '✓ gültig' : d.status === 'frei' ? (C.dayNum(d.ab) > C.dayNum(today) ? 'freigegeben, aber noch nicht gültig' : 'freigegeben, durch neuere Revision abgelöst') : STT[d.status] + ': nie gültig'}</span>${sel('Status', 'data-dq="status" data-i="' + i + '"', [['entwurf', 'Entwurf'], ['frei', 'freigegeben'], ['zurueck', 'zurückgezogen']], d.status)}<label class="f"><span>gültig ab</span><input type="date" data-dq="ab" data-i="${i}" value="${esc(d.ab)}"></label></div>`).join('') + `<p class="hint2">${valid == null ? 'Heute gilt keine Revision: Am Arbeitsplatz darf kein Stand benutzt werden.' : 'Am Arbeitsplatz liegt heute Revision ' + valid + '.'}</p>`);
    const n = P(s.n), d = P(s.d), pp = C.ppm(d, n), ys = [P(s.y1), P(s.y2), P(s.y3)], rt = C.rolled(ys);
    setHtml('qmKpi', (Number.isFinite(pp) ? box('Fehlerquote', 'ppm = Fehlerteile / alle Teile · 10⁶', f(pp, 1) + ' ppm') + box('Ausbeute', '', f(C.yieldPct(n - d, n), 3) + ' %') : note('Alle Teile > 0, fehlerhafte Teile zwischen 0 und alle Teile.')) + (Number.isFinite(rt) ? box('Gesamtausbeute der Kette', 'Y = Y₁ · Y₂ · Y₃', f(rt, 2) + ' %', 'ok') : note('Ausbeuten als Prozent zwischen 0 und 100 angeben.')));
    const cl = C.CLAUSES.filter(c => c.phase === s.phase); setSvg('qmPdca', V.pdcaSvg(s.phase, wOf($('#qmPdca')))); setHtml('qmPdcaOut', `<p>${cl.map(c => '<b>Abschnitt ' + esc(c.k) + '</b>: ' + esc(c.name)).join('<br>')}</p>`);
  }
  function renderQm() {
    const s = S.qm;
    $('#qmView').innerHTML = explain('qm') + `<div class="card pl"><h4>Prüfmittelüberwachung</h4><label class="f"><span>Heutiges Datum: <b id="qmToday">${esc(C.fmtDate(todayQ()))}</b></span><input type="range" data-qd="day" min="-90" max="420" step="1" value="${Math.round(s.day)}" aria-label="Heutiges Datum"></label>${chartDiv('qmCal', 'Zeitstrahl der Kalibrierung')}<div id="qmCalBtn"></div><p class="hint2">Gültig bis einschließlich Fälligkeitstag. Ab 30 Tagen vorher erscheint die Warnung, danach: sperren und kennzeichnen. Wird bei der Kalibrierung ein Fehler gefunden, müssen die früheren Messergebnisse bewertet werden.</p></div>
      <div class="card pl"><h4>Dokumentenlenkung: welche Revision gilt?</h4><p class="hint2" style="margin-top:0">Ändere Status und Gültigkeitsdatum und beobachte, welche Revision am Arbeitsplatz gilt. Das heutige Datum stellst du oben ein.</p><div id="qmDocs"></div></div>
      <div class="card pl"><h4>PDCA und ISO 9001</h4>${chips('qm.phase', [['P', 'Plan'], ['D', 'Do'], ['C', 'Check'], ['A', 'Act']], s.phase, 'PDCA-Phase')}${chartDiv('qmPdca', 'PDCA-Kreislauf')}<div id="qmPdcaOut"></div></div>
      <div class="card pl"><h4>Kennzahlen</h4><div class="dsrow">${inp('data-qk="n"', 'Teile im Los', s.n, '')}${inp('data-qk="d"', 'fehlerhafte Teile', s.d, '')}</div><div class="dsrow">${inp('data-qk="y1"', 'Ausbeute Schritt 1', s.y1, '%')}${inp('data-qk="y2"', 'Ausbeute Schritt 2', s.y2, '%')}${inp('data-qk="y3"', 'Ausbeute Schritt 3', s.y3, '%')}</div><div id="qmKpi"></div></div>${warnLine}`;
    qmOut();
  }
  UPD.qm = qmOut;
  $('#qmView').addEventListener('input', e => {
    const d = e.target.dataset;
    if (d.qd === 'day') { S.qm.day = +e.target.value; const l = $('#qmToday'); if (l) l.textContent = C.fmtDate(todayQ()); lsSet('qm', S.qm); qmOut(); }
    else if (d.qk) { S.qm[d.qk] = e.target.value; lsSet('qm', S.qm); qmOut(); }
    else if (d.dq === 'ab') { const v = e.target.value; if (C.parseIso(v)) { S.qm.docs[+d.i].ab = v; lsSet('qm', S.qm); qmOut(); } }
  });
  $('#qmView').addEventListener('change', e => { const d = e.target.dataset; if (d.dq === 'status') { S.qm.docs[+d.i].status = e.target.value; lsSet('qm', S.qm); qmOut(); } });
  $('#qmView').addEventListener('click', e => {
    if (chipClick(e, 'qm')) return;
    const c = e.target.closest('[data-qc]');
    if (c) { const it = S.qm.items[+c.dataset.qc]; it.last = todayQ(); lsSet('qm', S.qm); qmOut(); toast(it.name + ': kalibriert am ' + C.fmtDate(it.last)); }
  });

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
  const solText = q => (q.ask.type === 'choice' ? q.ask.choices[q.ask.correct] : f(q.value, 3) + (q.ask.unit ? ' ' + q.ask.unit : ''));
  function qBody(q, a, r, pre) {
    const locked = r && (r.ok || r.phase === 'loes' || (pre === 'rt' && r.final));
    if (q.ask.type === 'choice') return `<div class="opts" role="group" aria-label="Antwortmöglichkeiten">${q.ask.choices.map((c, i) => `<button data-tc="${i}" ${locked ? 'disabled' : ''} class="${locked && i === q.ask.correct ? 'ok' : a.c === i ? (r && !r.ok ? 'bad' : 'on') : ''}" aria-pressed="${a.c === i}">${esc(c)}</button>`).join('')}</div>`;
    return `<label class="f"><span>${esc(q.ask.label)}${q.ask.unit ? ' (' + esc(q.ask.unit) + ')' : ''}</span><div class="qin"><input data-in="1" inputmode="decimal" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(a.v || '')}" ${locked ? 'disabled' : ''}><span class="u">${esc(q.ask.unit)}</span></div></label><p class="lr-hinweis">Zahl${q.ask.unit ? ' in ' + esc(q.ask.unit) : ''}. ${q.tol > 0 ? 'Abweichung bis ±' + esc(f(q.tol, 3)) + (q.ask.unit ? ' ' + esc(q.ask.unit) : '') + ' gilt als richtig.' : 'Gerundet wie im Rechenweg.'}</p>`;
  }
  function evalQ(q, a) {
    if (q.ask.type === 'choice') { if (a.c == null) { toast('Wähle zuerst eine Antwort.'); return null; } return { ok: a.c === q.ask.correct, given: q.ask.choices[a.c] }; }
    const v = P(a.v); if (!Number.isFinite(v)) { toast('Bitte gib eine Zahl ein (mit Komma oder Punkt).'); return null; }
    return { ok: Math.abs(v - q.value) <= q.tol + 1e-9, given: f(v, 3) + (q.ask.unit ? ' ' + q.ask.unit : '') };
  }
  const stepsHtml = q => '<ol class="steps">' + q.expl.map(l => '<li>' + esc(l) + '</li>').join('') + '</ol>';
  const LOES = q => `<p><b>Lösung:</b> ${esc(solText(q))}</p><p><b>Musterlösung mit Rechenweg:</b></p>${stepsHtml(q)}<p class="hint2">${esc(D.NOTE)}</p>`;
  /* Rückmeldung nach "Prüfen": ok = richtig, tipp = Hinweis und zweiter Versuch, loes = Lösung mit Rechenweg (Prüfmodus: Lösung erst nach richtiger Antwort) */
  const resBlock = (q, r, showExpl) => {
    if (r.ok) return `<div class="lr-fb ok rdout ok" role="status"><p><strong>✓ Richtig:</strong> ${esc(r.given)}</p>${q.ask.type === 'num' && q.tol > 0.011 ? `<p class="hint2">Erlaubte Abweichung: ±${esc(f(q.tol, 3))} ${esc(q.ask.unit)} (wegen Rundung).</p>` : ''}${LOES(q)}</div>`;
    if (r.phase === 'tipp') return `<div class="lr-fb tipp rdout warn" role="status"><p><strong>Noch nicht.</strong> Deine Antwort „${esc(r.given)}“ stimmt nicht.</p><p><b>Tipp:</b> ${esc(q.tips[0])}</p><p>Du hast einen zweiten Versuch. Ändere die Antwort und tippe noch einmal auf „Prüfen“.</p></div>`;
    if (r.phase === 'loes') return `<div class="lr-fb loes rdout bad" role="status"><p><strong>Auch der zweite Versuch passt nicht.</strong> Deine Antwort: „${esc(r.given)}“.</p>${LOES(q)}</div>`;
    return `<div class="lr-fb tipp rdout bad" role="status"><p><strong>Noch nicht.</strong> Deine Antwort „${esc(r.given)}“ stimmt nicht.</p><p>🎓 Prüfmodus: Den Lösungsweg gibt es erst, wenn die Aufgabe richtig gelöst ist. Nutze einen Tipp oder versuche es noch einmal.</p></div>`;
  };
  const zeigFb = sel => { try { const el = $(sel + ' .lr-fb'); if (el && window.LabRahmen && LabRahmen.zeig) LabRahmen.zeig(el); } catch (e) {} };
  function renderTasks(top) {
    const V_ = $('#taskView'), d = done(), prog = lsGet('prog', {}), t = curTask(), n100 = TASKS.filter(x => d[x.id]).length; let h = '';
    if (t) {
      const q = S.tq, r = S.tRes && S.tRes.id === t.id ? S.tRes : null, a = S.tAns[t.id] || {};
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv" aria-label="Schwierigkeit ${t.level} von 3">${dots(t.level)}</div><p style="margin:8px 0">${esc(q.text)}</p>${qBody(q, a, r, 'tk')}`;
      h += `<div class="btns"><button class="btn pri" data-ta="chk"${r && r.ok ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" data-ta="hint">💡 Tipp</button><button class="btn" data-ta="close">Schließen</button></div>`;
      if (exam()) h += '<p class="hint2" style="color:var(--warn)">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>';
      if (r) { h += resBlock(q, r, r.ok || !exam()); if (r.ok || r.phase === 'loes') h += `<div class="btns"><button class="btn pri" data-ta="next">Nächste Aufgabe</button></div>`; }
      h += `<p class="hint2">${esc(D.NOTE)}</p></div>`;
    }
    h += `<p class="hint2" style="margin:4px 0 0">${n100} von ${TASKS.length} Aufgaben gelöst. ${exam() ? '🎓 Prüfmodus ist an.' : 'Tipp: Im Prüfmodus (🎓 oben) zählen Tipps als Abzug.'} Die Zahlen jeder Aufgabe sind fest; im Trainer entstehen immer neue.</p>`;
    let last = '';
    TASKS.forEach(x => { if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; } const p = prog[x.id]; h += `<button class="row" data-t="${esc(x.id)}"><span class="dot ${d[x.id] ? 'g' : ''}">${d[x.id] ? '✓' : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${dots(x.level)}</span>${p != null && p < 100 ? ' · bisher ' + p + ' %' : ''}</small></div></button>`; });
    V_.innerHTML = h; if (top !== false) $('#pgTasks').scrollTop = 0;
  }
  function checkTask(t) {
    const a = S.tAns[t.id] || {}, e = evalQ(S.tq, a); if (!e) return; const pct = e.ok ? pctFor(t.id) : 0;
    const tr = S.tTries[t.id] = (S.tTries[t.id] || 0) + 1;
    S.tRes = { id: t.id, ok: e.ok, given: e.given, pct, phase: e.ok || exam() ? null : (tr < 2 ? 'tipp' : 'loes') };
    if (e.ok) { markSolved(t.id, pct); const F = fx(); if (F && F.pass) try { F.pass(pct); } catch (er) {} else ding(); toast(exam() && pct < 100 ? pct + ' % (Tipps abgezogen)' : '🎉 Geschafft!'); } else { sad(); toast(S.tRes.phase === 'loes' ? 'Noch nicht richtig. Die Lösung steht unten.' : 'Noch nicht richtig. Lies den Tipp und versuche es noch einmal.'); }
    renderTasks(false); zeigFb('#taskView');
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
    S.task = id; S.tq = D.makeTask(t); S.tAns = {}; S.tRes = null; S.tTries[id] = 0;
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
  function newTrainer() { const T = S.tr; T.q = D.randomQ(R0, T.level, T.topic); T.ans = {}; T.res = null; T.tries = 0; renderTrainer(); }
  function renderTrainer() {
    const T = S.tr; if (!T.q) { newTrainer(); return; }
    const q = T.q;
    $('#rtView').innerHTML = `<div class="stats"><div class="bx"><b>${S.rt.n}</b>Fragen</div><div class="bx"><b>${S.rt.ok}</b>richtig</div><div class="bx"><b>${S.rt.streak}</b>Serie</div><div class="bx"><b>${S.rt.best}</b>Beste Serie</div></div>
      <div class="fbar"><span class="lbl">THEMA</span><div class="seg" role="group" aria-label="Thema">${[['', 'Alle']].concat(D.topics.map(t => [t.k, t.short])).map(l => `<button data-tp="${l[0]}" class="${T.topic === l[0] ? 'on' : ''}" aria-pressed="${T.topic === l[0]}">${esc(l[1])}</button>`).join('')}</div></div>
      <div class="fbar"><span class="lbl">STUFE</span><div class="seg" role="group" aria-label="Stufe">${[[0, 'Alle'], [1, '1'], [2, '2'], [3, '3']].map(l => `<button data-lv="${l[0]}" class="${T.level === l[0] ? 'on' : ''}" aria-pressed="${T.level === l[0]}">${l[1]}</button>`).join('')}</div></div>
      <div class="card pl"><h4>${esc(q.cat)} · <span class="lv">${dots(q.level)}</span></h4><div class="big">${esc(q.title)}</div><p style="margin:8px 0">${esc(q.text)}</p>${qBody(q, T.ans, T.res, 'rt')}
      <div class="btns"><button class="btn pri" data-ra="chk" ${T.res && T.res.final ? 'disabled' : ''}>✓ Prüfen</button><button class="btn" data-ra="hint" ${T.res && T.res.final ? 'disabled' : ''}>💡 Tipp</button><button class="btn" data-ra="next">${T.res && T.res.final ? 'Nächste Frage' : 'Überspringen'}</button></div>
      ${T.res ? resBlock(q, T.res, true) : ''}<p class="hint2">${esc(D.NOTE)}</p></div>`;
  }
  const rv = $('#rtView');
  rv.addEventListener('input', e => { if (e.target.dataset.in) S.tr.ans.v = e.target.value; });
  rv.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.in) { e.preventDefault(); trainerCheck(); } });
  rv.addEventListener('click', e => {
    const T = S.tr, tc = e.target.closest('[data-tc]'), ra = e.target.closest('[data-ra]'), lv = e.target.closest('[data-lv]'), tp = e.target.closest('[data-tp]');
    if (lv) { T.level = +lv.dataset.lv; newTrainer(); return; } if (tp) { T.topic = tp.dataset.tp; newTrainer(); return; }
    if (tc && !(T.res && T.res.final)) { T.ans.c = +tc.dataset.tc; if (T.res) T.res = null; renderTrainer(); return; }
    if (ra) { const a = ra.dataset.ra; if (a === 'chk') trainerCheck(); else if (a === 'hint') hintFor(T.q, 'rt'); else { if (!(T.res && T.res.final) && S.rt.streak) { S.rt.streak = 0; lsSet('rt', S.rt); } newTrainer(); updatePal(); } }
  });
  function trainerCheck() {
    const T = S.tr; if (T.res && T.res.final) return; const e = evalQ(T.q, T.ans); if (!e) return;
    T.tries = (T.tries || 0) + 1;
    if (!e.ok && T.tries < 2) { T.res = { ok: false, given: e.given, phase: 'tipp' }; sad(); renderTrainer(); zeigFb('#rtView'); return; }
    T.res = { ok: e.ok, given: e.given, final: true, phase: e.ok ? null : 'loes' }; S.rt.n++; if (e.ok) { S.rt.ok++; S.rt.streak++; S.rt.best = Math.max(S.rt.best, S.rt.streak); ding(); } else { S.rt.streak = 0; sad(); }
    lsSet('rt', S.rt); renderTrainer(); updatePal(); zeigFb('#rtView');
  }

  /* ============================================================ Hilfe */
  function renderHelp() {
    const sec = (t, b, open) => `<details${open ? ' open' : ''}><summary>${t}</summary><div class="hb2">${b}</div></details>`;
    $('#helpView').innerHTML =
      sec('Für wen ist dieses Lab?', `<p>Das Lab richtet sich an Techniker in der Weiterbildung, Studierende der Elektrotechnik und Wirtschaftsingenieure. Es erklärt in eigenen Worten, wie Produkte zu ihrer CE-Kennzeichnung kommen, wie Schutzarten und Isolationsabstände zusammenhängen, wie Maschinensicherheit bewertet wird, wie elektrische Geräte geprüft werden und wie ein Qualitätsmanagement Prüfmittel und Dokumente lenkt.</p><p class="rdout warn"><b>Wichtig:</b> Alles hier ist ein vereinfachtes Lernmodell mit eigenen Zusammenfassungen, kein Normtext. Maßgeblich ist immer die aktuelle Normfassung. Wo Tabellen vorkommen (Luft- und Kriechstrecken, Kategorien), sind es Lernbeispiele, die du vor jeder echten Anwendung mit der Norm abgleichen musst.</p>`, true) +
      sec('So arbeitest du', `<p>Jeder Themenreiter hat oben eine kurze <b>Erklärung</b>, darunter Regler, Schalter und Diagramme zum Ausprobieren. Unter <b>Aufgaben</b> findest du je Thema 10 bis 11 Aufgaben mit Musterlösung und Rechenweg. Der <b>Trainer</b> würfelt neue Zahlen und Fälle. Einen eigenen Beispiele-Reiter gibt es nicht: In jedem Themenreiter wählst du Beispielprodukte, Voreinstellungen und Werte selbst und siehst sofort die Folgen.</p><p><b>Tipps</b> gibt es in drei Stufen: Denkanstoß, Formel, erster Rechenschritt. Im Prüfmodus kostet jede Stufe 25 % der Punkte.</p>`) +
      sec('Zahlen eingeben', `<p>Dezimalkomma oder Punkt. Einheiten werden getrennt angezeigt, du tippst nur die Zahl. Bei Aufgaben mit Auswahl tippst du die Antwort an und dann auf „Prüfen“.</p>`) +
      sec('Wichtige Regeln auf einen Blick', `<table><tr><th>Thema</th><th>Merksatz</th></tr><tr><td>CE</td><td>Funk: RED statt LVD und EMV. Maschine: Maschinenrichtlinie plus EMV. REACH gilt immer. Das CE-Zeichen steht am Ende der Kette, nach der Konformitätserklärung.</td></tr><tr><td>Schutzarten</td><td>IP: erste Ziffer fest und Staub, zweite Wasser. 7, 8 und 9 sind eigene Zweige. Die Kriechstrecke ist nie kleiner als die Luftstrecke. Verstärkte Isolierung: eine Stufe höher bzw. doppelte Kriechstrecke.</td></tr><tr><td>Maschinen</td><td>Risikograph S, F, P gibt PLr. PFHd in Reihe addieren, 1/MTTFd in Reihe addieren. Not-Halt: Entriegeln startet nie von selbst.</td></tr><tr><td>Prüfen</td><td>Erst sehen, dann messen. Der Grenzwert selbst gilt noch als bestanden. Der erste verfehlte Schritt beendet die Prüfung.</td></tr><tr><td>Qualität</td><td>PDCA: 6 Plan, 7 und 8 Do, 9 Check, 10 Act. Überfälliges Prüfmittel sperren. Nur die höchste freigegebene, erreichte Revision gilt.</td></tr></table>`) +
      sec('Was nicht enthalten ist', `<p>Das Lab ersetzt keine Normen, Kommentare oder Schulungen. Nicht enthalten sind zum Beispiel die vollständigen Tabellen der Isolationskoordination, die Berechnung von Software-Anforderungen der Funktionalen Sicherheit, die Vorschriften für Medizinprodukte, Fahrzeuge und explosionsgefährdete Bereiche und rechtliche Besonderheiten einzelner Länder.</p>`) +
      sec('Normen und Rechtsvorschriften in diesem Lab (zur Gegenprüfung)', `<p>Diese Quellen liegen den Lernmodellen zugrunde. Prüfe Zahlen und Aussagen immer an der aktuellen Fassung.</p><table><tr><th>Quelle</th><th>Verwendet für</th></tr>${C.SOURCES.map(s => `<tr><td>${esc(s[0])}</td><td>${esc(s[1])}</td></tr>`).join('')}</table>`) +
      `<p class="hint2">Alle Zahlen in Beispielen, Aufgaben und Lösungen werden vom Rechenkern berechnet und im Test mit einem unabhängigen zweiten Rechenweg verglichen (anderer Rechenweg, Tabellenscan, Schleife, Formel statt Tabelle).</p>`;
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  const RENDER = { ce: renderCe, sk: renderSk, ms: renderMs, pf: renderPf, qm: renderQm, tasks: renderTasks, rt: renderTrainer, help: renderHelp };
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'ce'; S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    RENDER[t]();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'Normen und Konformität\n<small>' + esc(T[2]) + '</small>'; document.title = 'Normen und Konformität: ' + T[2];
  }
  /* Diagramme beim Drehen und Skalieren des Fensters neu zeichnen (1 SVG-Einheit = 1 Pixel, Schrift bleibt 14 px) */
  let rzT = 0, lastW = 0;
  const REDRAW = { ce: updateCe, sk: updateSk, ms: () => { msOut(); renderNhPart(); }, pf: pfOut, qm: qmOut };
  window.addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(() => { const w = window.innerWidth; if (w === lastW) return; lastW = w; if (REDRAW[S.tab]) REDRAW[S.tab](); }, 120); });
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
  $('#title').onclick = () => setTab('ce');
  $('#bMenu').onclick = () => {
    const rows = [['ce', 'CE und Richtlinien', 'Entscheidungsbaum, Konformitätsbewertung, REACH und RoHS'], ['sk', 'Schutzarten, Kategorien, Strecken', 'Schutzklassen, IP-Code, Überspannungskategorie, Luft- und Kriechstrecken'], ['ms', 'Sicherheit von Maschinen', 'Risikograph, PL und SIL, Kategorien, Not-Halt, Sicherheitsabstand'], ['pf', 'Prüfen elektrischer Geräte', 'Ablauf mit Messwerten und Grenzwert-Entscheidung'], ['qm', 'Qualität nach ISO 9001', 'Prüfmittelüberwachung, Dokumentenlenkung, PDCA, Kennzahlen'], ['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung, Tipps und Rechenweg'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Aufgaben mit Serien-Zähler'], ['help', 'Hilfe', 'Bedienung, Merksätze und Quellenliste'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben und Trainer-Serie auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
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
  root.NRM_LAB = { id: 'nrm', title: 'Normen und Konformität', stufe: 'studium', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.NRM_TASKS };

  buildTabs(); updatePal(); lastW = window.innerWidth; setTab(TABS.some(x => x[0] === S.tab) ? S.tab : 'ce');
  root.LabGoto = id => { try { if (TASKS.some(t => t.id === id)) { setTab('tasks'); startTask(id); return true; } } catch (e) {} return false; };
  try { const qa = new URLSearchParams(location.search).get('aufgabe'); if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); } } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
