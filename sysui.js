'use strict';
/* Tonfunk IT-Systeme-Lab: Oberfläche (Lab-Kennung 'sys').
   ALLE Zahlen (Adressbreiten, Speichergrößen, Taktraten) sind ÜBUNGSWERTE für die Ausbildung, nicht für die Auswahl echter Bauteile.
   Reiter: Systeme (EVA, Geräteklassen, Konfigurator), Bus & Speicher (Adressraum, Buszyklus, Datenrate), Zahlen & Flags (Dual/Hex/Dezimal, 8-Bit-Rechnen),
   Mikroprozessor (Adressdecoder und Speicherplan), Aufgaben, Trainer, Beispiele, Hilfe.
   Module: syscore.js (SYS_CORE, Rechenlogik), sysdata.js (SYS_DATA, SYS_TASKS: Aufgaben, Beispiele).
   Speicher (Präfix lm4.sys.): tab, sys, bus, zs, rech, mps, done ({id:true} nur gelöste), prog ({id:Prozent}), hints, ctipps (nur Prüfmodus), exam ('1'), rt (Trainer).
   Tipp-Abzug (25 % je Stufe, höchstens 2 Stufen) gibt es nur im Prüfmodus; beim normalen Üben kosten Tipps nichts.
   Bedienung ohne Hover, Zielflächen mindestens 44 px (iPad). Aufruf: syslab.html?aufgabe=sys1 öffnet die Aufgabe, syslab.html?bsp öffnet die Beispiele (?bsp=adr1 springt zu einem Beispiel). */
(function (root) {
  const C = root.SYS_CORE, D = root.SYS_DATA;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.sys.';
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
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>IT-Systeme-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">syscore.js oder sysdata.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks;

  /* ============================================================ Zustand */
  const TABS = [['sys', '🧭', 'Systeme'], ['bus', '🚌', 'Bus & Speicher'], ['zs', '🔢', 'Zahlen & Flags'], ['mps', '🧠', 'Mikroprozessor'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['bsp', '📖', 'Beispiele'], ['help', '📘', 'Hilfe']];
  const MAPTYPES = [['ROM', 'ROM (Festwertspeicher)'], ['RAM', 'RAM (Schreib-Lese-Speicher)'], ['E/A', 'Ein-/Ausgabe'], ['frei', 'frei (nicht belegt)']];
  const S = {
    tab: lsGet('tab', 'sys'),
    sys: Object.assign({ req: [] }, lsGet('sys', {})),
    bus: Object.assign({ n: '16', d: '8', rev: '32', rU: 'KiB', w: '16', mhz: '100', sig: 'IOW', addr: '5B', data: '0E', bits: 8 }, lsGet('bus', {})),
    zs: Object.assign({ v: '91' }, lsGet('zs', {})),
    rech: Object.assign({ a: 'C6', b: '61', op: '+' }, lsGet('rech', {})),
    mps: Object.assign({ k: 2, map: ['ROM', 'RAM', 'E/A', 'frei'], addr: '5A00' }, lsGet('mps', {})),
    task: null, tq: null, tAns: {}, tRes: null,
    tr: { q: null, ans: {}, res: null, level: 0 },
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {}))
  };
  if (!Array.isArray(S.sys.req)) S.sys.req = []; S.sys.req = S.sys.req.filter(r => C.REQS.some(q => q.id === r));
  if (![8, 16].includes(S.bus.bits)) S.bus.bits = 8; if (!['IOW', 'IOR', 'MEMW', 'MEMR'].includes(S.bus.sig)) S.bus.sig = 'IOW'; if (!['Byte', 'KiB', 'MiB'].includes(S.bus.rU)) S.bus.rU = 'KiB';
  if (![1, 2, 3].includes(S.mps.k)) S.mps.k = 2;
  if (!Array.isArray(S.mps.map) || S.mps.map.length !== C.pow2(S.mps.k) || S.mps.map.some(t => !MAPTYPES.some(x => x[0] === t))) S.mps.map = Array.from({ length: C.pow2(S.mps.k) }, (_, i) => ['ROM', 'RAM', 'E/A', 'frei'][i] || 'frei');
  const R0 = (() => { const m = /[?&]seed=([^&]+)/.exec(location.search); return C.rng(m ? decodeURIComponent(m[1]) : String(Math.random()) + Date.now()); })();

  /* ============================================================ Bausteine */
  const box = (t, fm, res, cls) => `<div class="rdout ${cls || ''}"><span class="st">${esc(t)}</span>${fm ? esc(fm) + ' = ' : ''}<b>${esc(res)}</b></div>`;
  const note = (t, cls) => `<div class="rdout ${cls || 'warn'}">${esc(t)}</div>`;
  const inp = (k, label, val, unit, attr, mode) => `<label class="f"><span>${esc(label)}${unit ? ' (' + esc(unit) + ')' : ''}</span><input ${attr || 'data-k'}="${k}" inputmode="${mode || 'decimal'}" autocomplete="off" autocapitalize="none" spellcheck="false" value="${esc(val)}"></label>`;
  const UEB = 'Alle Zahlen in diesem Lab (Adressbreiten, Speichergrößen, Taktraten) sind Übungswerte für die Ausbildung, nicht für die Auswahl echter Bauteile. Maßgebend sind die Datenblätter und die Vorgaben deines Betriebs.';
  const ueb = () => `<div class="rdout warn">⚠ ${esc(UEB)}</div>`;
  const seg = (attr, opts, cur) => `<div class="seg">${opts.map(o => `<button ${attr}="${esc(o[0])}" class="${String(cur) === String(o[0]) ? 'on' : ''}">${esc(o[1])}</button>`).join('')}</div>`;
  const hexIn = (s, max) => { const v = C.fromBase(s, 16); return C.isInt(v) && v >= 0 && v <= max ? v : NaN; };
  const tri = (x, y, d) => `<path d="M${x} ${y - 5} L${x + 9 * d} ${y} L${x} ${y + 5}Z" fill="currentColor"/>`;
  const sb = (x, y, w, h, lab, cls, sub) => `<g class="sy-n ${cls || ''}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6"/><text class="g-lab" x="${x + w / 2}" y="${y + h / 2 + (sub ? -2 : 4)}" text-anchor="middle">${esc(lab)}</text>${sub ? `<text class="g-lab m" x="${x + w / 2}" y="${y + h / 2 + 12}" text-anchor="middle" style="font-size:10.5px">${esc(sub)}</text>` : ''}</g>`;

  /* ============================================================ Systeme */
  function evaSvg() {
    let s = `<rect x="6" y="6" width="628" height="150" rx="10" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="6 4"/><text class="g-lab m" x="320" y="24" text-anchor="middle">Einfaches IT-System: alle Geräte stehen unmittelbar beim Rechner (Stand-alone-Betrieb)</text>`;
    const col = [['Eingabe', 'Tastatur, Maus, Scanner,', 'Sensoren, Mikrofon'], ['Verarbeitung', 'Prozessor und Speicher', 'führen das Programm aus'], ['Ausgabe', 'Monitor, Drucker,', 'Lautsprecher, Leuchten']];
    col.forEach((c, i) => { const x = 24 + i * 208; s += `<g class="sy-n"><rect x="${x}" y="46" width="170" height="86" rx="8"/><text class="g-lab" x="${x + 85}" y="74" text-anchor="middle" style="font-size:15px;font-weight:700">${c[0]}</text><text class="g-lab m" x="${x + 85}" y="96" text-anchor="middle">${esc(c[1])}</text><text class="g-lab m" x="${x + 85}" y="112" text-anchor="middle">${esc(c[2])}</text></g>`; if (i < 2) s += `<g style="color:var(--accent)"><path d="M${x + 174} 89 H${x + 202}" stroke="currentColor" stroke-width="2.5"/>${tri(x + 202, 89, 1)}</g>`; });
    return `<svg viewBox="0 0 640 162" role="img" aria-label="EVA-Prinzip: Eingabe, Verarbeitung, Ausgabe">${s}</svg>`;
  }
  function sysOut(reqs) {
    if (!reqs.length) return note('Tippe oben die Anforderungen an, die dein Gerät erfüllen soll. Darunter siehst du, welche Geräteklasse passt.', 'warn');
    const r = C.rank(reqs), fit = r.filter(x => x.all);
    let h = fit.length ? box('Passende Geräteklasse', '', fit.map(x => x.n).join(' oder '), 'ok') : note('Kein einzelnes Gerät erfüllt alle gewählten Anforderungen. Prüfe, ob eine Anforderung wegfallen kann, oder kombiniere Geräte (zum Beispiel ein Notebook mit Dockingstation).', 'bad');
    h += `<div class="tw"><table class="tt"><tr><th>Gerät</th><th class="n">erfüllt</th><th>Nicht erfüllt</th></tr>${r.map(x => `<tr><td>${x.all ? '✓ ' : ''}<b>${esc(x.n)}</b></td><td class="n">${x.met.length} von ${reqs.length}</td><td>${x.miss.length ? esc(x.miss.map(id => C.REQS.find(q => q.id === id).t.split(' (')[0].split(',')[0]).join('; ')) : '–'}</td></tr>`).join('')}</table></div>`;
    if (fit.length === 1) h += note(C.DEVICES.find(d => d.n === fit[0].n).d, 'ok');
    return h;
  }
  function renderSys() {
    const s = S.sys;
    $('#sysView').innerHTML = ueb() + `<div class="card pl"><h4>EVA-Prinzip</h4><div class="inst">${evaSvg()}</div><p class="hint2">Ein IT-System nimmt Informationen entgegen (Eingabe), verarbeitet sie und gibt sie aus. In einem <b>einfachen IT-System</b> stehen alle Ein- und Ausgabegeräte in unmittelbarer Nähe der verarbeitenden Komponente. Bei einem <b>vernetzten IT-System</b> sind mehrere Geräte über ein Netz verbunden.</p></div>
      <div class="card pl"><h4>System konfigurieren: Anforderungen wählen</h4><div class="opts" id="rqList">${C.REQS.map(q => `<button data-rq="${q.id}" aria-pressed="${s.req.includes(q.id)}" class="${s.req.includes(q.id) ? 'on' : ''}">${s.req.includes(q.id) ? '☑' : '☐'} ${esc(q.t)}</button>`).join('')}</div><div class="btns"><button class="btn" data-rqa="clear">Auswahl löschen</button></div><div id="sysOut"></div></div>
      <div class="card pl"><h4>Geräteklassen im Überblick</h4><div class="dt">${C.DEVICES.map(d => `<details><summary>${esc(d.n)}</summary><div class="hb2">${esc(d.d)}</div></details>`).join('')}</div></div>`;
    updateSys();
  }
  function updateSys() { const o = $('#sysOut'); if (o) o.innerHTML = sysOut(S.sys.req); }
  $('#sysView').addEventListener('click', e => {
    const b = e.target.closest('[data-rq]'), c = e.target.closest('[data-rqa]');
    if (b) { const id = b.dataset.rq, i = S.sys.req.indexOf(id); if (i >= 0) S.sys.req.splice(i, 1); else S.sys.req.push(id); lsSet('sys', S.sys); renderSys(); }
    else if (c) { S.sys.req = []; lsSet('sys', S.sys); renderSys(); }
  });

  /* ============================================================ Bus und Speicher */
  const RU = { Byte: 1, KiB: 1024, MiB: 1048576 };
  function adrOut(s) {
    const n = P(s.n), d = P(s.d);
    if (!(C.isInt(n) && n >= 1 && n <= 32 && C.isInt(d) && d >= 1 && d <= 64)) return note('Gib für die Adressleitungen eine ganze Zahl von 1 bis 32 und für die Datenleitungen eine ganze Zahl von 1 bis 64 ein.');
    const cnt = C.addrCount(n), bits = C.memBits(n, d), dig = Math.ceil(n / 4);
    return box('1. Zahl der Adressen', '2^' + n, f(cnt, 0) + ' Adressen') + box('2. Adressbereich (die erste Adresse ist 0)', f(cnt, 0) + ' − 1 = letzte Adresse', C.hex(cnt - 1, dig) + ' hex = ' + C.bin(cnt - 1, n)) +
      box('3. Speicherkapazität', '2^' + n + ' · ' + d + ' Bit', f(bits, 0) + ' Bit = ' + (d % 8 === 0 ? C.sizeText(bits / 8) : f(bits / 8, 2) + ' Byte')) +
      `<div class="inst">${busSvg({ n, d })}</div>` + (d !== 8 ? '' : note('Bei 8 Datenleitungen liegt an jeder Adresse 1 Byte. Dann entspricht die Zahl der Adressen der Speichergröße in Byte.', 'ok'));
  }
  function revOut(bytes) {
    if (!(bytes >= 1) || !Number.isFinite(bytes) || bytes > Math.pow(2, 32)) return note('Gib eine Speichergröße zwischen 1 Byte und 4 GiB ein.');
    if (!C.isInt(bytes)) return note('Die Speichergröße muss eine ganze Zahl von Byte ergeben.');
    const n = C.addrLines(bytes), pw = C.isPow2(bytes);
    return box('Adressleitungen für ' + C.sizeText(bytes) + ' (1 Byte je Adresse)', pw ? f(bytes, 0) + ' Byte = 2^' + n : '2^' + (n - 1) + ' < ' + f(bytes, 0) + ' ≤ 2^' + n, n + ' Adressleitungen') + (pw ? '' : note('Die Größe ist keine Zweierpotenz. Mit ' + n + ' Leitungen sind ' + f(C.pow2(n), 0) + ' Adressen möglich, ein Teil bleibt ungenutzt.'));
  }
  function rateOut(s) {
    const w = P(s.w), m = P(s.mhz);
    if (!(C.isInt(w) && w >= 1 && w <= 256 && m > 0)) return note('Gib eine Busbreite in Bit (ganze Zahl bis 256) und einen Takt in MHz (größer 0) ein.');
    const v = C.busMBs(w, m);
    return box('Höchste Datenrate (eine Übertragung je Takt, ohne Wartezeiten)', f(w, 0) + ' Bit / 8 · ' + f(m, 2) + ' MHz', f(v, 2) + ' MB/s');
  }
  function busSvg(o) {
    const W = 640, n = o.n, d = o.d, cyc = o.sig ? o : null, ad = cyc ? Math.ceil(o.bits / 4) : 0;
    let s = sb(10, 20, 100, 110, 'CPU', '') + sb(500, 20, 130, 110, 'Bausteine', '', 'ROM, RAM, E/A');
    const L = [[45, 'Adressbus: ' + n + ' Leitungen (A0 bis A' + (n - 1) + ')', cyc ? C.hex(o.addrV, ad) + ' hex = ' + C.bin(o.addrV, o.bits) : '', 1], [75, 'Datenbus: ' + d + ' Leitungen (D0 bis D' + (d - 1) + ')', cyc && o.dataV != null ? C.hex(o.dataV, 2) + ' hex = ' + C.bin(o.dataV, 8) : '', 0], [105, 'Steuerbus (meist von der CPU, einzelne zur CPU)', cyc ? o.sig : '', 2]];
    L.forEach(l => { s += `<g style="color:var(--mute)"><path d="M112 ${l[0]} H498" stroke="currentColor" stroke-width="2.5"/>${l[3] ? tri(489, l[0], 1) : tri(489, l[0], 1) + tri(121, l[0], -1)}${l[3] === 2 ? `<path d="M498 ${l[0] + 6} H112" stroke="currentColor" stroke-width="1.2" stroke-dasharray="4 3"/>` + tri(121, l[0] + 6, -1) : ''}</g><text class="g-lab m" x="122" y="${l[0] - 7}" style="font-size:11px">${esc(l[1])}</text>${l[2] ? `<text class="g-lab" x="${300}" y="${l[0] + (l[3] === 2 ? 22 : 17)}" text-anchor="middle" style="fill:var(--accent);font-weight:700">${esc(l[2])}</text>` : ''}`; });
    return `<svg viewBox="0 0 ${W} 142" role="img" aria-label="Blockbild: CPU und Bausteine, verbunden über Adressbus, Datenbus und Steuerbus">${s}</svg>`;
  }
  function cycOut(s) {
    const bits = s.bits, a = hexIn(s.addr, C.maxVal(bits)), dv = hexIn(s.data, 255);
    if (!C.isInt(a)) return note('Gib die Adresse hexadezimal ein, höchstens ' + C.hex(C.maxVal(bits), bits / 4) + ' bei ' + bits + ' Adressleitungen (Ziffern 0 bis 9 und A bis F).');
    if (!C.isInt(dv)) return note('Gib das Datenwort hexadezimal ein, höchstens FF (8 Datenleitungen).');
    const cy = C.busCycle(s.sig, a, dv, bits), c = C.CTRL[s.sig];
    return `<ol class="tl" style="list-style:decimal inside">${cy.steps.map(x => `<li><b>${esc(x.bus)}:</b> ${esc(x.t)}</li>`).join('')}</ol><div class="rdout ok"><span class="st">${esc(c.n)} = ${esc(c.t)}</span>${esc(c.d)}</div><div class="inst">${busSvg({ n: bits, d: 8, sig: s.sig, addrV: a, dataV: dv, bits })}</div>`;
  }
  function renderBus() {
    const s = S.bus;
    $('#busView').innerHTML = ueb() + `<div class="card pl"><h4>Adressraum und Speichergröße</h4><div class="dsrow">${inp('n', 'Adressleitungen', s.n, 'Anzahl')}${inp('d', 'Datenleitungen', s.d, 'Anzahl')}</div><div id="adrOut"></div></div>
      <div class="card pl"><h4>Umgekehrt: Speichergröße → Adressleitungen</h4><div class="dsrow">${inp('rev', 'Speichergröße', s.rev, '')}<label class="f"><span>Einheit</span>${seg('data-ru', [['Byte', 'Byte'], ['KiB', 'KiB'], ['MiB', 'MiB']], s.rU)}</label></div><div id="revOut"></div></div>
      <div class="card pl"><h4>Datenrate des Busses</h4><div class="dsrow">${inp('w', 'Busbreite', s.w, 'Bit')}${inp('mhz', 'Bustakt', s.mhz, 'MHz')}</div><div id="rateOut"></div></div>
      <div class="card pl"><h4>Ein Buszugriff, Schritt für Schritt</h4><div class="fbar"><span style="font-size:12px;color:var(--mute)">STEUERSIGNAL</span>${seg('data-bs', [['IOW', 'IOW'], ['IOR', 'IOR'], ['MEMW', 'MEMW'], ['MEMR', 'MEMR']], s.sig)}<span style="font-size:12px;color:var(--mute)">ADRESSLEITUNGEN</span>${seg('data-bb', [['8', '8'], ['16', '16']], s.bits)}</div><div class="dsrow">${inp('addr', 'Adresse', s.addr, 'hex', 'data-k', 'text')}${inp('data', 'Datenwort', s.data, 'hex', 'data-k', 'text')}</div><div id="cycOut"></div></div>`;
    updateBus();
  }
  function updateBus() {
    const s = S.bus, set = (id, h) => { const o = $(id); if (o) o.innerHTML = h; };
    set('#adrOut', adrOut(s)); set('#revOut', revOut(P(s.rev) * RU[s.rU])); set('#rateOut', rateOut(s)); set('#cycOut', cycOut(s));
  }
  $('#busView').addEventListener('input', e => { const k = e.target.dataset.k; if (!k) return; S.bus[k] = e.target.value; lsSet('bus', S.bus); updateBus(); });
  $('#busView').addEventListener('click', e => {
    const a = e.target.closest('[data-ru]'), b = e.target.closest('[data-bs]'), c = e.target.closest('[data-bb]');
    if (a) S.bus.rU = a.dataset.ru; else if (b) S.bus.sig = b.dataset.bs; else if (c) S.bus.bits = +c.dataset.bb; else return;
    lsSet('bus', S.bus); renderBus();
  });

  /* ============================================================ Zahlen und Flags */
  function zsOut(v, live) {
    if (!(C.isInt(v) && v >= 0 && v <= 65535)) return note('Gib eine Zahl von 0 bis 65.535 (dezimal), 0 bis FFFF (hex) oder bis zu 16 Dualstellen ein.');
    const bits = v > 255 ? 16 : 8;
    let h = box('Dezimal', '', f(v, 0)) + box('Hexadezimal', '', C.hex(v, bits / 4) + ' hex') + box('Dual', '', C.bin(v, bits));
    h += box('Als Zahl mit Vorzeichen (Zweierkomplement, ' + bits + ' Bit)', 'Bit ' + (bits - 1) + ' ist das Vorzeichen', f(C.signedOf(v, bits), 0));
    h += box('Zweierkomplement von ' + f(v, 0) + ' (so steht −' + f(v, 0) + ' im Rechner)', '2^' + bits + ' − ' + f(v, 0), C.hex(C.twos(v, bits), bits / 4) + ' hex = ' + C.bin(C.twos(v, bits), bits));
    if (bits === 8) { const bs = C.binRaw(v, 8).split(''); h += `<div class="tw"><table class="tt"><tr><th>Stelle</th>${bs.map((_, i) => `<th class="n">${7 - i}</th>`).join('')}</tr><tr><td>Wert</td>${bs.map((_, i) => `<td class="n">${C.pow2(7 - i)}</td>`).join('')}</tr><tr><td>Bit</td>${bs.map(b => `<td class="n"><b>${b}</b></td>`).join('')}</tr></table></div>`; }
    return h;
  }
  function bitsHtml(v) {
    if (!(C.isInt(v) && v >= 0 && v <= 255)) return '<p class="hint2">Die Bit-Schalter gibt es für Zahlen von 0 bis 255 (8 Bit).</p>';
    const bs = C.binRaw(v, 8).split('');
    return `<div class="bits">${bs.map((b, i) => `<button data-bit="${7 - i}" class="bitb ${b === '1' ? 'on' : ''}" aria-pressed="${b === '1'}" aria-label="Bit ${7 - i} ${b === '1' ? 'ist 1' : 'ist 0'}"><small>${C.pow2(7 - i)}</small>${b}</button>`).join('')}</div>`;
  }
  function rechOut(s) {
    const a = hexIn(s.a, 255), b = hexIn(s.b, 255);
    if (!C.isInt(a) || !C.isInt(b)) return note('Gib beide Werte hexadezimal ein (00 bis FF, Ziffern 0 bis 9 und A bis F).');
    const add = s.op === '+', r = add ? C.add8(a, b) : C.sub8(a, b), h8 = x => C.hex(x, 2) + ' hex';
    let h = box('Rechnung (8 Bit)', h8(a) + (add ? ' + ' : ' − ') + h8(b) + ' = ' + f(a, 0) + (add ? ' + ' : ' − ') + f(b, 0), h8(r.r) + ' = ' + C.bin(r.r, 8));
    if (!add) h += note('Subtraktion über das Zweierkomplement: A − B = A + (Zweierkomplement von B) = ' + C.bin(a, 8) + ' + ' + C.bin(C.twos(b, 8), 8) + '. ' + (a < b ? 'Das Ergebnis ist negativ und steht als Zweierkomplement im Akkumulator: ' + f(C.signedOf(r.r, 8), 0) + '.' : 'Das Ergebnis ist nicht negativ.'), 'ok');
    const rows = add ? [['CY', r.cy, 'Übertrag aus Bit 7 (Summe größer als 255)'], ['AC', r.ac, 'Übertrag von Bit 3 nach Bit 4 (untere Hälften zusammen über 15)'], ['Z', r.z, 'Ergebnis ist 0'], ['S', r.s, 'Bit 7 des Ergebnisses (Vorzeichen)'], ['P', r.p, 'Anzahl der Einsen im Ergebnis ist gerade (' + C.ones(r.r) + ' Einsen)']]
      : [['CY', r.cy, 'Entleihung (Borrow): A ist kleiner als B'], ['Z', r.z, 'Ergebnis ist 0'], ['S', r.s, 'Bit 7 des Ergebnisses (Vorzeichen)'], ['P', r.p, 'Anzahl der Einsen im Ergebnis ist gerade (' + C.ones(r.r) + ' Einsen)']];
    h += `<div class="tw"><table class="tt"><tr><th>Flag</th><th class="n">Wert</th><th>Bedeutung</th></tr>${rows.map(x => `<tr><td><b>${x[0]}</b></td><td class="n"><b>${x[1]}</b></td><td>${esc(x[2])}</td></tr>`).join('')}</table></div>`;
    return h;
  }
  function renderZs() {
    const s = S.rech;
    $('#zsView').innerHTML = ueb() + `<div class="card pl"><h4>Dezimal, Dual und Hexadezimal</h4><div class="dsrow">${inp('d', 'Dezimal', S.zs.v, '', 'data-zs', 'numeric')}${inp('h', 'Hexadezimal', C.hex(P(S.zs.v), 2), 'hex', 'data-zs', 'text')}${inp('b', 'Dual', C.binRaw(P(S.zs.v), 8), 'bin', 'data-zs', 'numeric')}</div><div id="zsBits"></div><div id="zsOut"></div></div>
      <div class="card pl"><h4>Rechnen im Akkumulator (8 Bit) mit Flags</h4><div class="fbar">${seg('data-ro', [['+', 'A + B (Addition)'], ['-', 'A − B (Subtraktion)']], s.op)}</div><div class="dsrow">${inp('a', 'Wert A', s.a, 'hex', 'data-rk', 'text')}${inp('b', 'Wert B', s.b, 'hex', 'data-rk', 'text')}</div><div id="rechOut"></div></div>`;
    updateZs(); updateRech();
  }
  function updateZs(except) {
    const v = P(S.zs.v), set = (id, h) => { const o = $(id); if (o) o.innerHTML = h; };
    set('#zsOut', zsOut(v)); set('#zsBits', bitsHtml(v));
    if (C.isInt(v) && v >= 0 && v <= 65535) {
      const m = { d: String(v), h: C.hex(v, v > 255 ? 4 : 2), b: C.binRaw(v, v > 255 ? 16 : 8) };
      ['d', 'h', 'b'].forEach(k => { if (k !== except) { const el = $('[data-zs="' + k + '"]'); if (el) el.value = m[k]; } });
    }
  }
  function updateRech() { const o = $('#rechOut'); if (o) o.innerHTML = rechOut(S.rech); }
  $('#zsView').addEventListener('input', e => {
    const z = e.target.dataset.zs, r = e.target.dataset.rk;
    if (z) { const raw = e.target.value, v = z === 'd' ? P(raw) : C.fromBase(raw, z === 'h' ? 16 : 2); S.zs.v = C.isInt(v) ? String(v) : String(raw); lsSet('zs', S.zs); updateZs(C.isInt(v) ? z : null); }
    else if (r) { S.rech[r] = e.target.value; lsSet('rech', S.rech); updateRech(); }
  });
  $('#zsView').addEventListener('click', e => {
    const b = e.target.closest('[data-bit]'), o = e.target.closest('[data-ro]');
    if (b) { const v = P(S.zs.v); if (C.isInt(v) && v >= 0 && v <= 255) { S.zs.v = String(v ^ (1 << +b.dataset.bit)); lsSet('zs', S.zs); updateZs(); } }
    else if (o) { S.rech.op = o.dataset.ro; lsSet('rech', S.rech); renderZs(); }
  });

  /* ============================================================ Mikroprozessor: Adressdecoder und Speicherplan */
  /* PRUEFEN P14: Im Lab sind immer 16 Adressleitungen (64 KiB) angenommen; die k höchsten Adressbits gehen an einen 1-aus-2^k-Decoder (k = 1 bis 3). Echte 8085-Systeme haben dafür oft zusätzlich IO/M-Signal und Decoder-Bausteine mit low-aktiven Ausgängen. Soll das im Lab so vereinfacht bleiben? */
  const TLAB = Object.fromEntries(MAPTYPES);
  function mpsSvg(m, z) {
    const n = m.map.length, W = 640, colW = 600 / n;
    let s = sb(20, 8, 150, 44, 'CPU', '') + sb(450, 8, 170, 44, 'Adressdecoder', z != null ? 'A15 bis A' + (16 - m.k) + ' → Z' + z : '');
    [[80, 'Adressbus A0 bis A15'], [100, 'Datenbus D0 bis D7'], [120, 'Steuerbus']].forEach((l, i) => { s += `<g style="color:var(--mute)"><path d="M30 ${l[0]} H620" stroke="currentColor" stroke-width="2.5"/></g><text class="g-lab m" x="36" y="${l[0] - 5}" style="font-size:10.5px">${l[1]}</text>`; });
    s += `<g style="color:var(--mute)"><path d="M60 52 V120" stroke="currentColor" stroke-width="2.5"/></g><g style="color:var(--hi)"><path d="M520 80 V52" stroke="currentColor" stroke-width="2.5"/><path d="M535 52 V140 H${20 + colW / 2}" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3" fill="none"/></g>`;
    for (let i = 0; i < n; i++) {
      const x = 20 + i * colW, on = i === z, t = m.map[i];
      s += `<g class="sy-n ${on ? 'sel' : ''}"><rect x="${x + 3}" y="170" width="${colW - 6}" height="58" rx="6"/><text class="g-lab" x="${x + colW / 2}" y="190" text-anchor="middle" style="font-weight:700">Z${i}</text><text class="g-lab${t === 'frei' ? ' m' : ''}" x="${x + colW / 2}" y="208" text-anchor="middle">${esc(t)}</text></g>`;
      s += `<g style="color:${on ? 'var(--accent)' : 'var(--hi)'}"><path d="M${x + 12} 140 V170" stroke="currentColor" stroke-width="${on ? 3.5 : 1.5}"/></g><g style="color:var(--mute)"><path d="M${x + colW / 2} 80 V170" stroke="currentColor" stroke-width="1" opacity=".55"/></g>`;
    }
    return `<svg viewBox="0 0 ${W} 240" role="img" aria-label="Blockbild: CPU, Adressdecoder und ${n} Speicherblöcke an den Bussen">${s}</svg>`;
  }
  function mpsOut(m) {
    const k = m.k, n = C.pow2(k), size = C.blockSize(16, k), a = hexIn(m.addr, 65535);
    let h = `<div class="tw"><table class="tt"><tr><th>Ausgang</th><th>von</th><th>bis</th><th class="n">Größe</th><th>Belegung</th></tr>${m.map.map((t, i) => `<tr><td><b>Z${i}</b></td><td>${C.hex(C.blockStart(i, 16, k), 4)}</td><td>${C.hex(C.blockStart(i, 16, k) + size - 1, 4)}</td><td class="n">${esc(C.sizeText(size))}</td><td>${esc(TLAB[t])}</td></tr>`).join('')}</table></div>`;
    if (!C.isInt(a)) return note('Gib die Adresse hexadezimal ein (0000 bis FFFF, Ziffern 0 bis 9 und A bis F).') + h + `<div class="inst">${mpsSvg(m, null)}</div>`;
    const z = C.blockOf(a, 16, k), bn = C.binRaw(a, 16);
    h = box('Adresse', C.hex(a, 4) + ' hex', bn.slice(0, 4) + ' ' + bn.slice(4, 8) + ' ' + bn.slice(8, 12) + ' ' + bn.slice(12)) +
      box('Decoder-Eingänge A15 bis A' + (16 - k) + ' (die obersten ' + k + ' Bit)', bn.slice(0, k) + ' = ' + z, 'Ausgang Z' + z + ' ist aktiv') +
      box('Angesprochener Baustein', 'Z' + z, TLAB[m.map[z]], m.map[z] === 'frei' ? 'bad' : 'ok') + box('Adresse innerhalb des Bausteins (die unteren ' + (16 - k) + ' Bit)', C.hex(a, 4) + ' − ' + C.hex(C.blockStart(z, 16, k), 4), C.hex(a - C.blockStart(z, 16, k), Math.ceil((16 - k) / 4)) + ' hex') +
      (m.map[z] === 'frei' ? note('Auf diese Adresse antwortet kein Baustein. Ein Lesezugriff liefert keinen definierten Wert (der Datenbus bleibt hochohmig).', 'bad') : '') + h + `<div class="inst">${mpsSvg(m, z)}</div>`;
    return h;
  }
  function renderMps() {
    const m = S.mps;
    $('#mpsView').innerHTML = ueb() + `<div class="card pl"><h4>Adressdecoder und Speicherplan</h4><p class="hint2" style="margin:0 0 8px">Der Adressbus hat 16 Leitungen (64 KiB). Die obersten Adressleitungen gehen an den Decoder und wählen einen Block aus. Weise jedem Block einen Baustein zu und gib eine Adresse ein.</p>
      <div class="fbar"><span style="font-size:12px;color:var(--mute)">LEITUNGEN AM DECODER</span>${seg('data-mk', [['1', '1 (2 Blöcke)'], ['2', '2 (4 Blöcke)'], ['3', '3 (8 Blöcke)']], m.k)}</div>
      <div class="dsrow">${m.map.map((t, i) => `<label class="f"><span>Z${i}: ${C.hex(C.blockStart(i, 16, m.k), 4)} bis ${C.hex(C.blockStart(i, 16, m.k) + C.blockSize(16, m.k) - 1, 4)}</span><select data-mpm="${i}">${MAPTYPES.map(o => `<option value="${o[0]}"${t === o[0] ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select></label>`).join('')}</div>
      ${inp('addr', 'Adresse der CPU', m.addr, 'hex', 'data-k', 'text')}</div><div id="mpsOut"></div>`;
    updateMps();
  }
  function updateMps() { const o = $('#mpsOut'); if (o) o.innerHTML = mpsOut(S.mps); }
  $('#mpsView').addEventListener('input', e => { if (e.target.dataset.k === 'addr') { S.mps.addr = e.target.value; lsSet('mps', S.mps); updateMps(); } });
  $('#mpsView').addEventListener('change', e => { const i = e.target.dataset && e.target.dataset.mpm; if (i != null && MAPTYPES.some(x => x[0] === e.target.value)) { S.mps.map[+i] = e.target.value; lsSet('mps', S.mps); updateMps(); } });
  $('#mpsView').addEventListener('click', e => {
    const b = e.target.closest('[data-mk]'); if (!b) return; const k = +b.dataset.mk, n = C.pow2(k);
    S.mps.k = k; S.mps.map = Array.from({ length: n }, (_, i) => S.mps.map[i] || ['ROM', 'RAM', 'E/A', 'frei'][i] || 'frei'); lsSet('mps', S.mps); renderMps();
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
  const baseTxt = (v, a) => (a.base === 16 ? C.hex(v, Math.ceil(a.bits / 4)) + ' hex' : C.bin(v, a.bits) + ' dual');
  const solText = q => { const a = q.ask; return a.type === 'choice' ? a.choices[a.correct] : a.type === 'base' ? baseTxt(q.value, a) : a.type === 'match' ? a.items.map((t, i) => t + ' → ' + a.cats[a.correct[i]]).join('; ') : a.type === 'order' ? a.correct.map((ix, k) => (k + 1) + '. ' + a.items[ix]).join(' ') : f(q.value, 2) + (a.unit ? ' ' + a.unit : ''); };
  const qText = t => `<p style="margin:8px 0;white-space:pre-line">${esc(t)}</p>`;
  function qBody(q, a, r, pre) {
    const A = q.ask, locked = r && (r.ok || pre === 'rt');
    if (A.type === 'choice') return `<div class="opts">${A.choices.map((c, i) => `<button data-tc="${i}" ${locked ? 'disabled' : ''} class="${r && i === A.correct && locked ? 'ok' : a.c === i ? (r && !r.ok ? 'bad' : 'on') : ''}">${esc(c)}</button>`).join('')}</div>`;
    if (A.type === 'match') return `<div class="mlist">${A.items.map((t, i) => { const cur = locked ? A.correct[i] : (a.m && a.m[i] != null ? a.m[i] : ''); return `<div class="mrow"><div class="mt">${esc(t)}</div><select data-tm="${i}" aria-label="Zuordnung für Zeile ${i + 1}" ${locked ? 'disabled' : ''}><option value="">– wählen –</option>${A.cats.map((c, j) => `<option value="${j}"${String(cur) === String(j) ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select></div>`; }).join('')}</div>`;
    if (A.type === 'order') { const o = locked ? A.correct : (a.o || []); return `<div class="opts">${A.items.map((t, i) => { const p = o.indexOf(i); return `<button data-to="${i}" ${locked ? 'disabled' : ''} class="${p >= 0 ? (locked ? 'ok' : 'on') : ''}">${p >= 0 ? '<b>' + (p + 1) + '.</b> ' : '○ '}${esc(t)}</button>`; }).join('')}</div>${locked ? '' : '<div class="btns"><button class="btn" data-tor="1">Reihenfolge zurücksetzen</button></div>'}`; }
    const inm = A.type === 'base' ? (A.base === 16 ? 'text' : 'numeric') : 'decimal';
    return `<label class="f"><span>${esc(A.label)}${A.unit ? ' (' + esc(A.unit) + ')' : ''}</span><div class="qin"><input data-in="1" inputmode="${inm}" autocomplete="off" autocapitalize="none" spellcheck="false" value="${esc(a.v || '')}" ${locked ? 'disabled' : ''}><span class="u">${esc(A.unit)}</span></div></label>`;
  }
  function evalQ(q, a) {
    const A = q.ask;
    if (A.type === 'choice') { if (a.c == null) { toast('Wähle zuerst eine Antwort.'); return null; } return { ok: a.c === A.correct, given: A.choices[a.c] }; }
    if (A.type === 'match') { const m = a.m || []; if (A.items.some((_, i) => m[i] == null)) { toast('Ordne zuerst jeder Zeile eine Gruppe zu.'); return null; } const ok = A.correct.every((c, i) => m[i] === c); return { ok, given: 'alle Zeilen richtig zugeordnet', msg: 'Mindestens eine Zuordnung stimmt nicht.' }; }
    if (A.type === 'order') { const o = a.o || []; if (o.length < A.items.length) { toast('Tippe zuerst alle Schritte an, in der Reihenfolge, die du für richtig hältst.'); return null; } const ok = A.correct.every((c, k) => o[k] === c); return { ok, given: 'Reihenfolge stimmt', msg: 'Die Reihenfolge stimmt noch nicht.' }; }
    if (A.type === 'base') { const v = C.fromBase(a.v, A.base); if (!Number.isFinite(v)) { toast(A.base === 16 ? 'Bitte gib eine Hexadezimalzahl ein (Ziffern 0 bis 9 und A bis F).' : 'Bitte gib eine Dualzahl ein (nur 0 und 1).'); return null; } return { ok: v === q.value, given: baseTxt(v, A) }; }
    const v = P(a.v); if (!Number.isFinite(v)) { toast('Bitte gib eine Zahl ein (mit Komma oder Punkt).'); return null; }
    return { ok: Math.abs(v - q.value) <= q.tol + 1e-9, given: f(v, 2) + (A.unit ? ' ' + A.unit : '') };
  }
  const resBlock = (q, r, showExpl) => `<ul class="tl"><li class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓ Richtig: ' + esc(r.given) : r.msg ? '✗ ' + esc(r.msg) : '✗ Deine Antwort „' + esc(r.given) + '“ stimmt nicht.'}</li>${q.ask.type === 'num' && q.tol > 0.011 ? `<li>ℹ Erlaubte Abweichung: ±${esc(f(q.tol, 2))} ${esc(q.ask.unit)} (wegen Rundung).</li>` : ''}</ul>` +
    (showExpl ? `<div class="rdout ${r.ok ? 'ok' : 'bad'}"><b>Lösung:</b> ${esc(solText(q))}<br><br><b>Lösungsweg:</b> ${esc(q.expl)}</div>` : '<div class="rdout bad">🎓 Prüfmodus: Den Lösungsweg gibt es erst, wenn die Aufgabe richtig gelöst ist. Nutze einen Tipp oder versuche es noch einmal.</div>');

  function renderTasks(top) {
    const V = $('#taskView'), d = done(), prog = lsGet('prog', {}), t = curTask(), n100 = TASKS.filter(x => d[x.id]).length; let h = '';
    if (t) {
      const q = S.tq, r = S.tRes && S.tRes.id === t.id ? S.tRes : null, a = S.tAns[t.id] || {};
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv">${dots(t.level)}</div>${qText(q.text)}${qBody(q, a, r, 'tk')}`;
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
    S.tRes = { id: t.id, ok: e.ok, given: e.given, msg: e.msg, pct };
    if (e.ok) { markSolved(t.id, pct); const F = fx(); if (F && F.pass) try { F.pass(pct); } catch (er) {} else ding(); toast(exam() && pct < 100 ? pct + ' % (Tipps abgezogen)' : '🎉 Geschafft!'); } else { sad(); toast('Noch nicht richtig. Lies den Lösungsweg und versuche es noch einmal.'); }
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
  /* gemeinsame Eingabe-Behandlung für Aufgaben und Trainer: a = Antwortobjekt */
  function answerInput(e, a) { if (e.target.dataset.in) a.v = e.target.value; }
  function answerChange(e, a) { const i = e.target.dataset && e.target.dataset.tm; if (i != null) { a.m = a.m || []; a.m[+i] = e.target.value === '' ? null : +e.target.value; } }
  function answerClick(e, a, q) {
    const to = e.target.closest('[data-to]'), tor = e.target.closest('[data-tor]');
    if (to) { a.o = a.o || []; const i = +to.dataset.to, p = a.o.indexOf(i); if (p >= 0) a.o.splice(p, 1); else a.o.push(i); return true; }
    if (tor) { a.o = []; return true; }
    return false;
  }
  const tv = $('#taskView');
  tv.addEventListener('input', e => { const t = curTask(); if (t) answerInput(e, S.tAns[t.id] = S.tAns[t.id] || {}); });
  tv.addEventListener('change', e => { const t = curTask(); if (t) answerChange(e, S.tAns[t.id] = S.tAns[t.id] || {}); });
  tv.addEventListener('keydown', e => { const t = curTask(); if (t && e.key === 'Enter' && e.target.dataset.in) { e.preventDefault(); checkTask(t); } });
  tv.addEventListener('click', e => {
    const t = curTask(), tc = e.target.closest('[data-tc]'), ta = e.target.closest('[data-ta]'), row = e.target.closest('.row[data-t]');
    if (tc && t) { (S.tAns[t.id] = S.tAns[t.id] || {}).c = +tc.dataset.tc; if (S.tRes && !S.tRes.ok) S.tRes = null; renderTasks(false); return; }
    if (t && !(S.tRes && S.tRes.ok) && answerClick(e, S.tAns[t.id] = S.tAns[t.id] || {}, S.tq)) { if (S.tRes && !S.tRes.ok) S.tRes = null; renderTasks(false); return; }
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
      <div class="card pl"><h4>${esc(q.cat)} · <span class="lv">${dots(q.level)}</span></h4><div class="big">${esc(q.title)}</div>${qText(q.text)}${qBody(q, T.ans, T.res, 'rt')}
      <div class="btns"><button class="btn pri" data-ra="chk" ${T.res ? 'disabled' : ''}>✓ Prüfen</button><button class="btn" data-ra="hint" ${T.res ? 'disabled' : ''}>💡 Tipp</button><button class="btn" data-ra="next">${T.res ? 'Nächste Frage' : 'Überspringen'}</button></div>
      ${T.res ? resBlock(q, T.res, true) : ''}</div>`;
  }
  const rv = $('#rtView');
  rv.addEventListener('input', e => answerInput(e, S.tr.ans));
  rv.addEventListener('change', e => answerChange(e, S.tr.ans));
  rv.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.in) { e.preventDefault(); trainerCheck(); } });
  rv.addEventListener('click', e => {
    const T = S.tr, tc = e.target.closest('[data-tc]'), ra = e.target.closest('[data-ra]'), lv = e.target.closest('[data-lv]');
    if (lv) { T.level = +lv.dataset.lv; newTrainer(); return; }
    if (tc && !T.res) { T.ans.c = +tc.dataset.tc; renderTrainer(); return; }
    if (!T.res && answerClick(e, T.ans, T.q)) { renderTrainer(); return; }
    if (ra) { const a = ra.dataset.ra; if (a === 'chk') trainerCheck(); else if (a === 'hint') hintFor(T.q, 'rt'); else { if (!T.res && S.rt.streak) { S.rt.streak = 0; lsSet('rt', S.rt); } newTrainer(); updatePal(); } }
  });
  function trainerCheck() {
    const T = S.tr; if (T.res) return; const e = evalQ(T.q, T.ans); if (!e) return;
    T.res = { ok: e.ok, given: e.given, msg: e.msg }; S.rt.n++; if (e.ok) { S.rt.ok++; S.rt.streak++; S.rt.best = Math.max(S.rt.best, S.rt.streak); ding(); } else { S.rt.streak = 0; sad(); }
    lsSet('rt', S.rt); renderTrainer(); updatePal();
  }

  /* ============================================================ Beispiele */
  function exBody(e) {
    const p = e.p;
    if (e.tab === 'sys') return sysOut(p.req);
    if (e.tab === 'bus') return p.sig ? cycOut({ sig: p.sig, addr: p.addr, data: p.data, bits: p.bits }) : p.rev ? revOut(p.rev) + adrOut({ n: String(p.n), d: String(p.d) }) : adrOut({ n: String(p.n), d: String(p.d) });
    if (e.tab === 'zs') return p.a ? rechOut(p) : zsOut(p.v);
    return mpsOut({ k: p.k, map: p.map, addr: p.addr });
  }
  function renderBsp() {
    $('#bspView').innerHTML = `<p class="hint2" style="margin:0 0 8px">Fertig durchgerechnete Beispiele (Übungswerte). Mit „In den Rechner laden“ öffnest du die Zahlen im passenden Reiter und kannst sie verändern.</p>` + D.examples.map(e => `<div class="card pl" id="ex_${e.id}"><h4>Beispiel</h4><div class="big">${esc(e.title)}</div><p style="margin:4px 0 8px">${esc(e.text)}</p>${exBody(e)}<div class="btns"><button class="btn pri" data-ex="${e.id}">In den Rechner laden</button></div></div>`).join('');
  }
  function loadExample(x) {
    const p = x.p;
    if (x.tab === 'sys') { S.sys.req = p.req.slice(); lsSet('sys', S.sys); }
    else if (x.tab === 'bus') {
      if (p.sig) { S.bus = Object.assign({}, S.bus, { sig: p.sig, addr: p.addr, data: p.data, bits: p.bits }); }
      else { S.bus = Object.assign({}, S.bus, { n: String(p.n), d: String(p.d) }); if (p.rev) { S.bus.rev = String(p.rev); S.bus.rU = 'Byte'; } }
      lsSet('bus', S.bus);
    }
    else if (x.tab === 'zs') { if (p.a) { S.rech = { a: p.a, b: p.b, op: p.op }; lsSet('rech', S.rech); } else { S.zs = { v: String(p.v) }; lsSet('zs', S.zs); } }
    else { S.mps = { k: p.k, map: p.map.slice(), addr: p.addr }; lsSet('mps', S.mps); }
    setTab(x.tab);
  }
  $('#bspView').addEventListener('click', e => {
    const b = e.target.closest('[data-ex]'); if (!b) return; const x = D.examples.find(z => z.id === b.dataset.ex); if (!x) return;
    loadExample(x); toast('Beispiel geladen: ' + x.title);
  });

  /* ============================================================ Hilfe */
  function renderHelp() {
    const sec = (t, b, open) => `<details${open ? ' open' : ''}><summary>${t}</summary><div class="hb2">${b}</div></details>`;
    $('#helpView').innerHTML =
      `<div class="rdout warn">⚠ ${esc(UEB)}</div>` +
      sec('IT-Systeme und EVA-Prinzip', `<p>Ein <b>technisches System</b>, in das Informationen <b>eingegeben</b>, dort <b>verarbeitet</b> und <b>ausgegeben</b> werden, nennt man IT-System (EVA-Prinzip). Beim <b>einfachen IT-System</b> stehen alle Ein- und Ausgabegeräte in unmittelbarer Nähe der verarbeitenden Komponente: Stand-alone-Betrieb. Ein <b>vernetztes IT-System</b> verbindet mehrere Geräte über ein Netz.</p>`, true) +
      sec('Geräteklassen', `<table><tr><th>Klasse</th><th>Kennzeichen</th></tr>${C.DEVICES.map(d => `<tr><td>${esc(d.n)}</td><td>${esc(d.d)}</td></tr>`).join('')}</table><p><b>Netbook:</b> deutlich weniger Ausstattung und Rechenleistung als ein Notebook. <b>Smartphone-Ausstattung:</b> Kommunikation (Telefon, SMS, E-Mail), Datenverbindung (Bluetooth, WLAN, USB, 5G), Sensoren (Geschwindigkeit, Wärme, Licht, Bewegung, Fingerabdruck), Organizer (Kalender, Uhr, Office, Kontakte), Navigation (GPS).</p><p><b>Industrie-PC:</b> Temperatur-, Schock- und Wasserfestigkeit, EMV-Schutz, Ausfallsicherheit, Langzeitverfügbarkeit.</p>`) +
      sec('Aufbau eines Mikroprozessorsystems', `<p><b>CPU</b> (verarbeitet Befehle aus dem Programmspeicher), <b>ROM</b> (Festwertspeicher), <b>RAM</b> (Schreib-Lese-Speicher), <b>Ein-/Ausgabe</b> (I/O, Austausch mit peripheren Geräten) und <b>Busse</b> als Leitungsbündel, an dem alle Funktionseinheiten parallel hängen. Der <b>Adressdecoder</b> wählt anhand der hohen Adressleitungen genau einen Baustein aus.</p><table><tr><th>Bus</th><th>Richtung</th><th>Inhalt</th></tr><tr><td>Adressbus</td><td>eine Richtung</td><td>Adresse einer Speicherzelle oder Ein-/Ausgabeschaltung</td></tr><tr><td>Datenbus</td><td>beide Richtungen</td><td>Datenwörter (Tri-State-Ausgänge)</td></tr><tr><td>Steuerbus</td><td>überwiegend von der CPU, einzelne Leitungen zur CPU</td><td>MEMR, MEMW, IOR, IOW (von der CPU); READY, HOLD, INTR (zur CPU)</td></tr></table><p>Vorteil der Bus-Technik: wenige Leitungen für viele Bausteine. Nachteil: Der Austausch geschieht nur nacheinander (sequenziell).</p><span class="eq">Datenrate = Busbreite in Byte · Takt (eine Übertragung je Takt)</span>`) +
      sec('Speicherarten', `<table><tr><th>Gruppe</th><th>Arten</th></tr><tr><td>Schreib-Lese-Speicher (RAM)</td><td>statischer RAM (SRAM), dynamischer RAM (DRAM)</td></tr><tr><td>Festwertspeicher, einmal programmiert (ROM ab Werk, PROM vom Anwender)</td><td>ROM, PROM</td></tr><tr><td>Festwertspeicher, mehrfach programmierbar</td><td>EPROM, EEPROM</td></tr></table><p><b>Stapelspeicher (Stack):</b> Das zuletzt Eingeschriebene wird zuerst gelesen (LIFO), der Stackpointer zeigt auf die aktuelle Stelle. <b>FIFO:</b> Das zuerst Eingeschriebene wird zuerst gelesen. <b>Kennwerte</b> eines Speichers: Speicherkapazität und Zugriffszeit.</p>`) +
      sec('Adressraum und Speichergröße', `<span class="eq">Adressen = 2^n bei n Adressleitungen</span><span class="eq">Kapazität in Bit = 2^n · Zahl der Datenleitungen</span><span class="eq">letzte Adresse = Anfang + Größe − 1</span><table><tr><th>Leitungen</th><th>Adressen</th></tr><tr><td>8</td><td>256</td></tr><tr><td>10</td><td>1.024 = 1 KiB</td></tr><tr><td>12</td><td>4.096 = 4 KiB</td></tr><tr><td>16</td><td>65.536 = 64 KiB</td></tr><tr><td>20</td><td>1.048.576 = 1 MiB</td></tr></table><p>1 KiB = 1.024 Byte (binär), 1 kB = 1.000 Byte (dezimal). Jede zusätzliche Adressleitung verdoppelt den Adressraum.</p>`) +
      sec('Zahlensysteme im Rechner', `<table><tr><th>Dezimal</th><th>Dual</th><th>Hex</th></tr><tr><td>10</td><td>1010</td><td>A</td></tr><tr><td>11</td><td>1011</td><td>B</td></tr><tr><td>14</td><td>1110</td><td>E</td></tr><tr><td>15</td><td>1111</td><td>F</td></tr></table><p>Dual-Stellenwerte: 128, 64, 32, 16, 8, 4, 2, 1. Eine Hex-Ziffer entspricht vier Bit (0 bis 9, A = 10 bis F = 15). Beispiel: 5B hex = 0101 1011 = 91. <b>Zweierkomplement:</b> Das negative Ergebnis einer Subtraktion steht als Zweierkomplement im Akkumulator (8 Bit: 256 − Betrag). A − B = A + Zweierkomplement von B.</p>`) +
      sec('Prozessor und 8085-Begriffe', `<p>Der klassische Prozessor besteht aus: <b>ALU</b> (arithmetische, logische und Schiebeoperationen, Akkumulator als Arbeitsregister), <b>Steuerwerk</b>, <b>Registersatz</b>, <b>Adresswerk</b> und <b>Systembusschnittstelle</b>. Dazu der <b>Stapelzeiger</b> (Stack Pointer), der auf die oberste Stelle des Stapels im RAM zeigt.</p><table><tr><th>Flag</th><th>Bedeutung</th></tr><tr><td>CY</td><td>Übertrag über Bit 7 hinaus (Carry)</td></tr><tr><td>AC</td><td>Übertrag von Bit 3 nach Bit 4 (Hilfscarry)</td></tr><tr><td>Z</td><td>Ergebnis ist 0 (Zero)</td></tr><tr><td>S</td><td>Vorzeichen: 1 = negativ (Signum)</td></tr><tr><td>P</td><td>gerade Zahl von Einsen im Ergebnis (Parity)</td></tr></table><table><tr><th>Befehlsgruppe</th><th>Beispiele</th></tr><tr><td>Datentransport</td><td>MOV r1, r2; MVI A, 00</td></tr><tr><td>Arithmetik</td><td>ADD r; INR r; DCR r</td></tr><tr><td>Logik</td><td>ANA r; ORA r; CMA</td></tr><tr><td>Schieben</td><td>RAL; RLC</td></tr><tr><td>Sprung</td><td>JMP adresse; JZ adresse</td></tr><tr><td>Ein-/Ausgabe</td><td>IN adresse; OUT adresse</td></tr><tr><td>Sonstiges</td><td>NOP; HLT</td></tr></table><p><b>Adressierungsarten:</b> unmittelbar (die Daten folgen dem Befehl, z. B. MVI A, 00), direkt (die Adresse steht im Befehl, z. B. LDA 1312), indirekt (die Adresse steht in einem Registerpaar, nach LXI H), implizit (ein Byte, die Register stecken im Befehl, z. B. MOV A, B). <b>Zeiten:</b> Befehlszyklus (ganzer Befehl) besteht aus Maschinenzyklen (ein Schreib- oder Lesevorgang), diese aus Taktzyklen (eine Periode des Takts). CISC hat einen umfangreichen, RISC einen einfachen Befehlssatz.</p>`) +
      `<p class="hint2">Zahlen und Begriffe stammen aus der Mitschrift Lernfeld 7.1 und aus Übungswerten; Unsicheres ist im Quelltext mit PRUEFEN markiert.</p>`;
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'sys'; S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    ({ sys: renderSys, bus: renderBus, zs: renderZs, mps: renderMps, tasks: renderTasks, rt: renderTrainer, bsp: renderBsp, help: renderHelp })[t]();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'IT-Systeme-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = 'IT-Systeme-Lab: ' + T[2];
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
  $('#title').onclick = () => setTab('sys');
  $('#bMenu').onclick = () => {
    const rows = [['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung und Tipps'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Aufgaben mit Serien-Zähler'], ['bsp', 'Beispiele', 'Fertig durchgerechnete Beispiele zum Laden'], ['help', 'Hilfe und Formeln', 'Systeme, Busse, Speicher, Zahlensysteme, Prozessor'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben und Trainer-Serie auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
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
  root.SYS_LAB = { id: 'sys', title: 'IT-Systeme-Lab', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.SYS_TASKS };

  /* Rauchtest für quelle/sys/test_syscore.js (läuft nur, wenn der Test window.__SYS_TEST setzt) */
  const rightAns = q => { const A = q.ask; return A.type === 'choice' ? { c: A.correct } : A.type === 'match' ? { m: A.correct.slice() } : A.type === 'order' ? { o: A.correct.slice() } : A.type === 'base' ? { v: A.base === 16 ? C.hex(q.value, Math.ceil(A.bits / 4)) : C.binRaw(q.value, A.bits) } : { v: String(+q.value.toFixed(6)).replace('.', ',') }; };
  const wrongAns = q => { const A = q.ask; return A.type === 'choice' ? { c: (A.correct + 1) % A.choices.length } : A.type === 'match' ? { m: A.correct.map(c => (c + 1) % A.cats.length) } : A.type === 'order' ? { o: A.correct.slice().reverse() } : { v: A.type === 'base' ? 'zz' : '-12345' }; };
  root.SYS_UI = {
    smoke: function () {
      if (!root.__SYS_TEST) return 'nur im Test';
      try {
        TABS.forEach(t => setTab(t[0]));
        TASKS.forEach(t => {
          setTab('tasks'); startTask(t.id); const q = S.tq;
          S.tAns[t.id] = {}; checkTask(t);
          S.tAns[t.id] = wrongAns(q); checkTask(t); renderTasks(false);
          S.tAns[t.id] = rightAns(q); S.tRes = null; checkTask(t);
          if (!S.tRes || !S.tRes.ok) throw new Error('Aufgabe ' + t.id + ': Musterlösung wird in der Oberfläche nicht akzeptiert');
          renderTasks(false); hintFor(q, t.id);
        });
        S.tr.level = 0; for (let k = 0; k < 60; k++) { newTrainer(); const q = S.tr.q; S.tr.ans = wrongAns(q); trainerCheck(); renderTrainer(); newTrainer(); S.tr.ans = rightAns(S.tr.q); trainerCheck(); renderTrainer(); }
        D.examples.forEach(e => { loadExample(e); if (!exBody(e)) throw new Error('Beispiel ' + e.id + ' leer'); });
        S.sys.req = ['mob', 'tast']; updateSys(); S.sys.req = ['ind', 'mob']; updateSys(); S.sys.req = [];  updateSys();
        S.bus.n = '0'; updateBus(); S.bus.n = '40'; updateBus(); S.bus.n = '16'; S.bus.d = 'x'; updateBus(); S.bus.d = '8'; S.bus.rev = '3'; updateBus(); S.bus.rev = '0,5'; updateBus(); S.bus.addr = 'ZZ'; updateBus(); S.bus.addr = 'FFFFF'; updateBus(); S.bus.w = '-4'; updateBus();
        ['IOW', 'IOR', 'MEMW', 'MEMR'].forEach(g => { S.bus.sig = g; S.bus.addr = '5B'; S.bus.data = '0E'; S.bus.bits = 16; updateBus(); S.bus.bits = 8; updateBus(); });
        ['', 'abc', '70000', '300', '255', '0'].forEach(v => { S.zs.v = v; updateZs(); }); S.rech = { a: 'FF', b: 'FF', op: '+' }; updateRech(); S.rech.op = '-'; updateRech(); S.rech.a = 'x'; updateRech();
        [1, 2, 3].forEach(k => { S.mps.k = k; S.mps.map = Array.from({ length: C.pow2(k) }, (_, i) => ['ROM', 'RAM', 'E/A', 'frei'][i % 4]); ['0000', '5A00', 'FFFF', 'xyz', '10000'].forEach(a => { S.mps.addr = a; updateMps(); }); });
        setTab('bsp'); setTab('help'); return 'ok';
      } catch (e) { return e && e.stack ? e.stack : String(e); }
    }
  };

  buildTabs(); updatePal(); setTab(TABS.some(x => x[0] === S.tab) ? S.tab : 'sys');
  /* Aufruf ?aufgabe=sys1 (Startseite, Lernhefte) öffnet die Aufgabe, ?bsp die Beispiele (?bsp=adr1 springt zu einem Beispiel) */
  root.LabGoto = id => { try { if (TASKS.some(t => t.id === id)) { setTab('tasks'); startTask(id); return true; } } catch (e) {} return false; };
  try {
    const qp = new URLSearchParams(location.search), qa = qp.get('aufgabe');
    if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); }
    else if (qp.has('bsp')) { setTab('bsp'); const el = $('#ex_' + (qp.get('bsp') || '').replace(/[^a-z0-9_]/gi, '')); if (el) el.scrollIntoView(); }
  } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
