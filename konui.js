'use strict';
/* Tonfunk Konstruktions-Lab: Oberfläche (Lab-Kennung 'kon').
   ALLE Tabellenwerte und Normangaben sind ÜBUNGSWERTE für die Ausbildung, keine Konstruktionsvorgabe.
   Reiter: Schrauben (Kernloch-Rechner, Nachschlagetabelle, Schraubenlänge), Toleranzrahmen (Leser mit SVG), Stückliste (Editor), Lager & Federn, Aufgaben, Trainer, Beispiele, Hilfe.
   Module: koncore.js (KON_CORE, Rechenlogik), kondata.js (KON_DATA, KON_TASKS: Aufgaben, Beispiele).
   Speicher (Präfix lm4.kon.): tab, schr, tol, stk, lag, done ({id:true} nur gelöste), prog ({id:Prozent}), hints, ctipps (nur Prüfmodus), exam ('1'), rt (Trainer).
   Tipp-Abzug (25 % je Stufe, höchstens 2 Stufen) gibt es nur im Prüfmodus; beim normalen Üben kosten Tipps nichts.
   Aufruf: konlab.html?aufgabe=kon1 öffnet die Aufgabe, konlab.html?bsp öffnet die Beispiele (?bsp=kern1 springt zu einem Beispiel). */
(function (root) {
  const C = root.KON_CORE, D = root.KON_DATA;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.kon.';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(LS + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} };
  const f = (v, d) => C.fmtN(v, d == null ? 2 : d, true), P = s => C.parseDe(s), sc = v => String(v).replace('.', ',');
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
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>Konstruktions-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">koncore.js oder kondata.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks;

  /* ============================================================ Zustand */
  const TABS = [['schr', '🔩', 'Schrauben'], ['tol', '📐', 'Toleranzrahmen'], ['stk', '📋', 'Stückliste'], ['lag', '⚙️', 'Lager & Federn'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['bsp', '📖', 'Beispiele'], ['help', '📘', 'Hilfe']];
  const STK0 = [{ pos: 1, qty: 1, ben: 'Konsole', bez: 'S235JR' }, { pos: 2, qty: 6, ben: 'Sechskantschraube', bez: 'ISO 4017 M10x40-10.9' }, { pos: 3, qty: 6, ben: 'Scheibe', bez: 'ISO 7089 - 10 - 200 HV' }, { pos: 4, qty: 6, ben: 'Sechskantmutter', bez: 'ISO 4032 M10-8' }];
  const S = {
    tab: lsGet('tab', 'schr'),
    schr: Object.assign({ d: '8', fk: '8.8', t1: '12', t2: '10', w: '1' }, lsGet('schr', {})),
    tol: Object.assign({ sym: 'rundl', tol: '0,03', dia: false, d1: 'A', d2: '' }, lsGet('tol', {})),
    stk: Object.assign({ rows: STK0 }, lsGet('stk', {})),
    lag: Object.assign({ code: '6204', r1: '12', r2: '4', F: '120' }, lsGet('lag', {})),
    task: null, tq: null, tAns: {}, tRes: null,
    tr: { q: null, ans: {}, res: null, level: 0 },
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {}))
  };
  if (!C.thread(P(S.schr.d))) S.schr.d = '8';
  if (!C.fkParse(S.schr.fk)) S.schr.fk = '8.8';
  if (!['0', '1', '2'].includes(String(S.schr.w))) S.schr.w = '1';
  if (!C.symOf(S.tol.sym)) S.tol.sym = 'rundl';
  if (!Array.isArray(S.stk.rows)) S.stk.rows = STK0;
  S.stk.rows = S.stk.rows.filter(r => r && typeof r === 'object').slice(0, 30).map(r => ({ pos: r.pos == null ? '' : r.pos, qty: r.qty == null ? '' : r.qty, ben: String(r.ben || ''), bez: String(r.bez || '') }));
  const R0 = (() => { const m = /[?&]seed=([^&]+)/.exec(location.search); return C.rng(m ? decodeURIComponent(m[1]) : String(Math.random()) + Date.now()); })();

  /* ============================================================ Bausteine */
  const box = (t, fm, res, cls) => `<div class="rdout ${cls || ''}"><span class="st">${esc(t)}</span>${fm ? esc(fm) + ' = ' : ''}<b>${esc(res)}</b></div>`;
  const note = (t, cls) => `<div class="rdout ${cls || 'warn'}">${esc(t)}</div>`;
  const inp = (k, label, val, unit, attr) => `<label class="f"><span>${esc(label)}${unit ? ' (' + esc(unit) + ')' : ''}</span><input ${attr || 'data-k'}="${k}" inputmode="decimal" autocomplete="off" value="${esc(val)}"></label>`;
  const UEB = 'Alle Tabellenwerte und Normangaben in diesem Lab sind Übungswerte für die Ausbildung, keine Konstruktionsvorgabe. Maßgebend sind Tabellenbuch, Norm und die Vorgaben deines Betriebs.';
  const ueb = () => `<div class="rdout warn">⚠ ${esc(UEB)}</div>`;
  const seg = (attr, opts, cur) => `<div class="seg">${opts.map(o => `<button ${attr}="${esc(o[0])}" class="${String(cur) === String(o[0]) ? 'on' : ''}">${esc(o[1])}</button>`).join('')}</div>`;
  const tableHtml = t => (t ? `<div class="tw"><table class="tt"><tr>${t.head.map((h, i) => `<th${i === 1 ? ' class="n"' : ''}>${esc(h)}</th>`).join('')}</tr>${t.rows.map(r => `<tr>${r.map((c, i) => `<td${i === 1 ? ' class="n"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('')}</table></div>` : '');

  /* ============================================================ SVG: Symbole, Toleranzrahmen, Bearbeitungszeichen */
  /* PRUEFEN P23: Die Symbole der Toleranzarten sind vereinfacht selbst gezeichnet (Linienzeichen in einem 20 x 20 Raster) und weichen vom Schriftbild der Norm leicht ab (z. B. Zylinderform, Rundlauf). Erkennt man sie trotzdem eindeutig? */
  const GL = {
    gerad: '<path d="M3 10H17"/>',
    eben: '<path d="M6 6H17L14 14H3Z"/>',
    rund: '<circle cx="10" cy="10" r="6.5"/>',
    zyl: '<circle cx="10" cy="10" r="4"/><path d="M3.5 15.5L8 4.5M12 15.5L16.5 4.5"/>',
    par: '<path d="M5 17L10 3M11 17L16 3"/>',
    recht: '<path d="M3 16H17M10 16V3"/>',
    koax: '<circle cx="10" cy="10" r="3.5"/><circle cx="10" cy="10" r="7"/>',
    pos: '<circle cx="10" cy="10" r="4.5"/><path d="M10 2V18M2 10H18"/>',
    rundl: '<path d="M4 16L15 5M15 5H9M15 5V11"/>'
  };
  const glyph = (id, x, y, k) => `<g class="tf-g" transform="translate(${x} ${y}) scale(${k})">${GL[id] || ''}</g>`;
  const symSvg = (id, size) => `<svg class="symi" viewBox="0 0 20 20" width="${size || 26}" height="${size || 26}" role="img" aria-label="${esc((C.symOf(id) || {}).n || '')}"><g class="tf-g">${GL[id] || ''}</g></svg>`;
  function frameSvg(fr) {
    const cells = C.frameCells(fr); if (!cells.length) return '';
    let x = 30, s = '';
    const W = cells.reduce((a, c) => a + (c.k === 'tol' ? Math.max(64, c.text.length * 12 + 24) : 40), 0), y0 = 12, h = 38;
    s += `<rect class="tf-b" x="30" y="${y0}" width="${W}" height="${h}"/>`;
    cells.forEach((c, i) => {
      const w = c.k === 'tol' ? Math.max(64, c.text.length * 12 + 24) : 40;
      if (i > 0) s += `<line class="tf-b" x1="${x}" x2="${x}" y1="${y0}" y2="${y0 + h}"/>`;
      if (c.k === 'sym') s += glyph(c.id, x + 6, y0 + 4, 1.4); else s += `<text class="tf-t" x="${x + w / 2}" y="${y0 + 25}" text-anchor="middle">${esc(c.text)}</text>`;
      x += w;
    });
    s += `<path class="tf-b" d="M${30 + 20} ${y0 + h}V74"/><path class="tf-a" d="M${50 - 5} 66L50 78L${50 + 5} 66Z"/><path class="tf-b" d="M10 80H${W + 50}"/>`;
    for (let k = 14; k < W + 50; k += 9) s += `<path class="tf-h" d="M${k} 80l-5 7"/>`;
    return `<svg class="frsvg" viewBox="0 0 ${W + 60} 92" role="img" aria-label="Toleranzrahmen: ${esc(C.frameText(fr))}">${s}</svg>`;
  }
  const symBig = id => `<svg class="frsvg" viewBox="0 0 110 62" role="img" aria-label="Toleranzrahmen mit einem Symbol"><rect class="tf-b" x="35" y="8" width="40" height="40"/>${glyph(id, 40, 13, 1.5)}</svg>`;
  function roughSvg(kind, ra) {
    let s = '';
    if (kind === 'kein') s += `<path class="tf-b" d="M26 34L40 58L70 6H150"/><circle class="tf-b" cx="40" cy="38" r="11"/>`;
    else if (kind === 'abtrag') s += `<path class="tf-b" d="M24 30L40 58L70 6H150M24 30H56.2"/>`;
    else s += `<path class="tf-b" d="M26 34L40 58L70 6H150"/>`;
    if (ra != null) s += `<text class="tf-t" x="76" y="26" style="font-size:16px">Ra ${esc(f(ra, 1))}</text>`;
    return `<svg class="frsvg" viewBox="0 0 160 70" role="img" aria-label="Bearbeitungszeichen">${s}</svg>`;
  }
  const drawHtml = d => (d ? `<div class="inst">${d.t === 'sym' ? symBig(d.id) : d.t === 'frame' ? frameSvg(d.f) : roughSvg(d.kind, d.ra)}</div>` : '');

  /* ============================================================ Schrauben */
  const schrParams = s => ({ d: P(s.d), fk: s.fk, t1: P(s.t1), t2: P(s.t2), w: +s.w });
  function schrOut(p) {
    const t = C.thread(p.d); if (!t) return note('Wähle ein Gewinde aus der Liste.');
    let h = box('1. Steigung (Regelgewinde)', '', 'P = ' + f(t.P, 2) + ' mm');
    h += box('2. Kernlochbohrer', 'Tabelle (Faustformel d − P = ' + f(p.d, 0) + ' − ' + f(t.P, 2) + ' = ' + f(C.kernFaust(p.d), 2) + ' mm)', f(t.kern, 1) + ' mm');
    h += box('3. Durchgangsloch "mittel" für die Schraube', '', f(t.dg, 1) + ' mm');
    h += box('4. Schlüsselweite · Mutterhöhe · Scheibendicke', '', 'SW ' + f(t.sw, 1) + ' mm · m ' + f(t.m, 1) + ' mm · s ' + f(t.s, 1) + ' mm');
    if (C.fkParse(p.fk)) {
      h += box('5. Festigkeitsklasse ' + p.fk, 'Rm = ' + f(C.fkParse(p.fk).a, 0) + ' · 100; Re = ' + f(C.fkParse(p.fk).a, 0) + ' · ' + f(C.fkParse(p.fk).b, 0) + ' · 10', 'Rm ' + f(C.fkRm(p.fk), 0) + ' N/mm² · Re ' + f(C.fkRe(p.fk), 0) + ' N/mm²');
      h += box('6. Zugkraft an der Streckgrenze', 'Re · As = ' + f(C.fkRe(p.fk), 0) + ' N/mm² · ' + f(t.As, 1) + ' mm²', f(C.forceYield(p.fk, p.d) / 1000, 2) + ' kN');
      h += box('7. Passende Mutter', '', C.bez.mutter(p.d, C.fkNut(p.fk)) + ' (Klasse mindestens ' + C.fkNut(p.fk) + ')');
    }
    if (p.t1 > 0 && p.t2 > 0) {
      const r = C.screwLen(p.t1 + p.t2, p.d, p.w);
      h += box('8. Schraubenlänge', f(p.t1, 1) + ' + ' + f(p.t2, 1) + ' + ' + p.w + ' · ' + f(t.s, 1) + ' (Scheibe) + ' + f(t.m, 1) + ' (Mutter) + ' + f(2 * t.P, 2) + ' (Überstand 2 · P) = ' + f(r.min, 2) + ' mm, aufgerundet auf Normlänge', Number.isFinite(r.norm) ? r.norm + ' mm' : 'über 150 mm');
      if (Number.isFinite(r.norm)) h += note('Bestellung: ' + C.bez.schraube('4017', p.d, r.norm, p.fk) + ' mit ' + C.bez.mutter(p.d, C.fkNut(p.fk)) + (p.w > 0 ? ' und ' + C.bez.scheibe(p.d) : ''), 'ok');
    } else h += note('Gib die Dicken beider Teile (mm) ein, dann siehst du die passende Schraubenlänge.');
    return h;
  }
  function thTable() { return `<div class="tw"><table class="tt"><tr><th>Gewinde</th><th class="n">P</th><th class="n">Kernloch</th><th class="n">Durchgang</th><th class="n">SW</th><th class="n">Mutter m</th><th class="n">Scheibe s</th><th class="n">As mm²</th></tr>${C.TH.map(t => `<tr><td>M${t.d}</td><td class="n">${esc(f(t.P, 2))}</td><td class="n">${esc(f(t.kern, 1))}</td><td class="n">${esc(f(t.dg, 1))}</td><td class="n">${esc(f(t.sw, 1))}</td><td class="n">${esc(f(t.m, 1))}</td><td class="n">${esc(f(t.s, 1))}</td><td class="n">${esc(f(t.As, 1))}</td></tr>`).join('')}</table></div>`; }
  function renderSchr() {
    const s = S.schr;
    $('#schrView').innerHTML = ueb() + `<div class="card pl"><h4>Schraubverbindung planen</h4>
      <div class="dsrow"><label class="f"><span>Gewinde (Regelgewinde)</span><select data-k="d">${C.TH.map(t => `<option value="${t.d}"${String(t.d) === String(s.d) ? ' selected' : ''}>M${t.d}</option>`).join('')}</select></label>
      <label class="f"><span>Festigkeitsklasse</span><select data-k="fk">${C.FKS.map(k => `<option${k === s.fk ? ' selected' : ''}>${k}</option>`).join('')}</select></label></div>
      <div class="dsrow">${inp('t1', 'Dicke Teil 1', s.t1, 'mm')}${inp('t2', 'Dicke Teil 2', s.t2, 'mm')}</div>
      <div class="fbar"><span style="font-size:12px;color:var(--mute)">SCHEIBEN UNTER DER MUTTER</span>${seg('data-w', [['0', 'keine'], ['1', 'eine'], ['2', 'zwei']], s.w)}</div>
      <p class="hint2">Zahlen mit Komma oder Punkt eingeben. Das Gewinde bestimmt Kernloch und Durchgangsloch, die Klasse die Festigkeit.</p></div><div id="schrOut"></div>
      <div class="card pl"><h4>Nachschlagetabelle Regelgewinde</h4>${thTable()}<p class="hint2">P = Steigung, Kernloch = Bohrerdurchmesser, Durchgang = Durchgangsloch "mittel", SW = Schlüsselweite, m = Mutterhöhe, s = Scheibendicke, As = Spannungsquerschnitt.</p></div>`;
    updateSchr();
  }
  function updateSchr() { $('#schrOut').innerHTML = schrOut(schrParams(S.schr)); }
  $('#schrView').addEventListener('input', e => { const k = e.target.dataset.k; if (!k) return; S.schr[k] = e.target.value; lsSet('schr', S.schr); updateSchr(); });
  $('#schrView').addEventListener('click', e => { const b = e.target.closest('[data-w]'); if (b) { S.schr.w = b.dataset.w; lsSet('schr', S.schr); renderSchr(); } });

  /* ============================================================ Toleranzrahmen */
  const tolFrame = s => ({ sym: s.sym, tol: P(s.tol), dia: !!s.dia, datums: [s.d1, s.d2].map(x => String(x || '').trim().toUpperCase().slice(0, 1)).filter(Boolean) });
  function tolOut(fr) {
    const s = C.symOf(fr.sym), probs = C.frameValid(fr); let h = `<div class="inst">${frameSvg(fr)}</div>`;
    if (!(fr.tol > 0)) return h + note('Gib den Toleranzwert als Zahl größer als 0 ein.');
    h += box('Lesart des Rahmens', '', C.frameText(fr));
    h += box('Einteilung', '', s.n + ' = ' + s.cls + 'toleranz, ' + (s.dat ? 'mit Bezug' : 'ohne Bezug'));
    h += box('Toleranzzone', '', fr.dia ? 'Zylinder bzw. Kreis mit ⌀ ' + f(fr.tol, 3) + ' mm' : 'Abstand ' + f(fr.tol, 3) + ' mm');
    if (fr.sym === 'pos' && fr.dia) h += box('Größte Abweichung der Achse vom Sollort', 'Toleranz / 2', f(fr.tol / 2, 3) + ' mm');
    h += probs.length ? probs.map(x => note(x, 'bad')).join('') : note('Der Rahmen ist vollständig und stimmig.', 'ok');
    return h;
  }
  function renderTol() {
    const s = S.tol;
    $('#tolView').innerHTML = ueb() + `<div class="card pl"><h4>Toleranzrahmen zusammenstellen und lesen</h4>
      <div class="dsrow"><label class="f"><span>Toleranzart</span><select data-k="sym">${C.SYMS.map(x => `<option value="${x.id}"${x.id === s.sym ? ' selected' : ''}>${esc(x.n)} (${esc(x.cls)})</option>`).join('')}</select></label>
      ${inp('tol', 'Toleranzwert', s.tol, 'mm')}</div>
      <div class="fbar"><span style="font-size:12px;color:var(--mute)">VOR DEM WERT</span>${seg('data-dia', [['0', 'ohne ⌀'], ['1', 'mit ⌀']], s.dia ? '1' : '0')}</div>
      <div class="dsrow"><label class="f"><span>Bezug 1 (Buchstabe)</span><input data-k="d1" maxlength="1" autocomplete="off" value="${esc(s.d1)}"></label><label class="f"><span>Bezug 2 (optional)</span><input data-k="d2" maxlength="1" autocomplete="off" value="${esc(s.d2)}"></label></div></div><div id="tolOut"></div>
      <div class="card pl"><h4>Symbole im Überblick</h4><div class="tw"><table class="tt"><tr><th>Symbol</th><th>Toleranzart</th><th>Einteilung</th><th>Bezug</th></tr>${C.SYMS.map(x => `<tr><td>${symSvg(x.id, 30)}</td><td>${esc(x.n)}</td><td>${esc(x.cls)}</td><td>${x.dat ? 'ja' : 'nein'}</td></tr>`).join('')}</table></div></div>`;
    updateTol();
  }
  function updateTol() { $('#tolOut').innerHTML = tolOut(tolFrame(S.tol)); }
  $('#tolView').addEventListener('input', e => { const k = e.target.dataset.k; if (!k) return; S.tol[k] = k === 'd1' || k === 'd2' ? e.target.value.toUpperCase() : e.target.value; lsSet('tol', S.tol); updateTol(); });
  $('#tolView').addEventListener('click', e => { const b = e.target.closest('[data-dia]'); if (b) { S.tol.dia = b.dataset.dia === '1'; lsSet('tol', S.tol); renderTol(); } });

  /* ============================================================ Stückliste */
  function stkOut(rows) {
    const tot = C.bomTotals(rows), iss = C.bomIssues(rows);
    let h = `<div class="tw"><table class="tt"><tr><th>Pos.</th><th class="n">Menge</th><th>Bedeutung der Bezeichnung</th></tr>${rows.map(r => { const p = C.parseBez(r.bez); return `<tr><td>${esc(r.pos)}</td><td class="n">${esc(r.qty)}</td><td>${esc(p ? C.describeBez(p) : (r.bez ? 'Bauteil oder Werkstoff: ' + r.bez + ' (keine Normteil-Bezeichnung erkannt)' : 'Keine Bezeichnung eingetragen.'))}${p && p.warn.length ? '<br><span style="color:var(--warn)">' + esc(p.warn.join(' ')) + '</span>' : ''}</td></tr>`; }).join('')}</table></div>`;
    h += box('Positionen · Normteile (Stück)', '', rows.length + ' Positionen · ' + tot.normteile + ' Normteile');
    h += box('Davon Schrauben · Muttern · Scheiben · Stifte · Passfedern', '', tot.schraube + ' · ' + tot.mutter + ' · ' + tot.scheibe + ' · ' + tot.stift + ' · ' + tot.passfeder);
    if (!rows.some(r => C.rowKind(r) === 'schraube')) h += note('Es ist keine Schraube in der Liste. Der Passungs-Check (Mutter und Scheibe zur Schraube) braucht eine Schraube.');
    else h += iss.length ? iss.map(x => note('Position ' + x.pos + ': ' + x.msg, 'bad')).join('') : note('Mutter und Scheibe passen zur Schraube (Gewinde, Klasse, Menge).', 'ok');
    return h;
  }
  const stkRowsHtml = () => S.stk.rows.map((r, i) => `<tr><td><input data-r="${i}" data-f="pos" inputmode="numeric" value="${esc(r.pos)}" style="min-width:52px"></td><td><input data-r="${i}" data-f="qty" inputmode="numeric" value="${esc(r.qty)}" style="min-width:60px"></td><td><input data-r="${i}" data-f="ben" value="${esc(r.ben)}" style="min-width:150px"></td><td><input data-r="${i}" data-f="bez" value="${esc(r.bez)}" style="min-width:200px"></td><td><button class="btn" data-del="${i}" aria-label="Zeile löschen">✕</button></td></tr>`).join('');
  function renderStk() {
    $('#stkView').innerHTML = ueb() + `<div class="card pl"><h4>Stücklisten-Editor</h4><p class="hint2" style="margin-top:0">Trage Bezeichnungen ein, zum Beispiel <b>ISO 4017 M8x30-8.8</b>, <b>ISO 4032 M8-8</b>, <b>ISO 7089 - 8 - 200 HV</b>, <b>ISO 2338 6m6x30</b> oder <b>DIN 6885 A 8x7x32</b>. Der Editor liest die Bezeichnung, zählt die Teile und prüft, ob Mutter und Scheibe zur Schraube passen.</p>
      <div class="tw"><table class="tt"><tr><th>Pos.</th><th>Menge</th><th>Benennung</th><th>Norm-Bezeichnung / Werkstoff</th><th></th></tr><tbody id="stkRows">${stkRowsHtml()}</tbody></table></div>
      <div class="btns"><button class="btn" data-sa="add">+ Zeile</button><button class="btn" data-sa="clear">Liste leeren</button><button class="btn" data-sa="demo">Beispielliste laden</button></div></div><div id="stkOut"></div>`;
    updateStk();
  }
  function updateStk() { $('#stkOut').innerHTML = `<div class="card pl"><h4>Auswertung</h4>${stkOut(S.stk.rows)}</div>`; }
  $('#stkView').addEventListener('input', e => { const r = e.target.dataset.r, k = e.target.dataset.f; if (r == null || !k || !S.stk.rows[+r]) return; S.stk.rows[+r][k] = e.target.value; lsSet('stk', S.stk); updateStk(); });
  $('#stkView').addEventListener('click', e => {
    const d = e.target.closest('[data-del]'), a = e.target.closest('[data-sa]'); let ch = false;
    if (d) { S.stk.rows.splice(+d.dataset.del, 1); ch = true; }
    else if (a) { const k = a.dataset.sa; if (k === 'add' && S.stk.rows.length < 30) S.stk.rows.push({ pos: S.stk.rows.length + 1, qty: 1, ben: '', bez: '' }); else if (k === 'clear') S.stk.rows = []; else if (k === 'demo') S.stk.rows = STK0.map(x => Object.assign({}, x)); ch = true; }
    if (ch) { lsSet('stk', S.stk); renderStk(); }
  });

  /* ============================================================ Lager und Federn */
  function lagOut(code) {
    const i = C.brgInfo(code); if (!i) return note('Das Kurzzeichen wird nicht erkannt. Beispiele: 6204, 6305-2RS, 30208, NU 208, 51108, 7208, 22208.', 'bad');
    let h = box('1. Lagerart', 'Kurzzeichen ' + i.code, i.type);
    h += box('2. Bohrung (Wellendurchmesser)', 'Kennzahl ' + i.digits.slice(-2) + (i.bore > 17 ? ' · 5' : ''), Number.isFinite(i.bore) ? f(i.bore, 0) + ' mm' : 'außerhalb der Übungstabelle');
    if (i.series != null) h += box('3. Durchmesserreihe', 'zweite Ziffer ' + i.series, C.SERIES_N[i.series] || '–');
    if (i.D) h += box('4. Außendurchmesser · Breite (Maßtabelle)', '', '⌀ ' + f(i.D, 0) + ' mm · ' + f(i.B, 0) + ' mm breit');
    else if (i.type === 'Rillenkugellager') h += note('Für diese Bohrung steht kein Wert in der Übungstabelle.');
    if (i.suffix) h += box('5. Nachsetzzeichen ' + i.suffix, '', i.suffixText);
    return h;
  }
  function fedOut(r1, r2, F) {
    if (!(r1 > 0 && r2 > 0)) return note('Gib beide Federraten (N/mm) größer als 0 ein.');
    const par = C.springParallel([r1, r2]), ser = C.springSeries([r1, r2]);
    let h = box('Parallelschaltung (nebeneinander)', 'R1 + R2 = ' + f(r1, 2) + ' + ' + f(r2, 2), f(par, 2) + ' N/mm');
    h += box('Reihenschaltung (hintereinander)', '1 / (1/R1 + 1/R2) = 1 / (1/' + f(r1, 2) + ' + 1/' + f(r2, 2) + ')', f(ser, 2) + ' N/mm');
    if (F > 0) {
      h += box('Federweg bei ' + f(F, 1) + ' N parallel', 'F / R', f(C.springPath(F, par), 2) + ' mm (Arbeit ' + f(C.springWork(F, C.springPath(F, par)), 3) + ' J)');
      h += box('Federweg bei ' + f(F, 1) + ' N in Reihe', 'F / R', f(C.springPath(F, ser), 2) + ' mm (Arbeit ' + f(C.springWork(F, C.springPath(F, ser)), 3) + ' J)');
    }
    return h + note('Parallel wird die Kombination härter (Raten addieren sich), in Reihe weicher als jede Einzelfeder.', 'ok');
  }
  function renderLag() {
    const s = S.lag;
    $('#lagView').innerHTML = ueb() + `<div class="card pl"><h4>Wälzlager-Kurzzeichen lesen</h4><label class="f"><span>Kurzzeichen (z. B. 6204, 6305-2RS, 30208, NU 208)</span><input data-k="code" autocomplete="off" value="${esc(s.code)}"></label><div id="lagOut"></div></div>
      <div class="card pl"><h4>Zwei Federn kombinieren</h4><div class="dsrow">${inp('r1', 'Federrate R1', s.r1, 'N/mm')}${inp('r2', 'Federrate R2', s.r2, 'N/mm')}${inp('F', 'Kraft F (optional)', s.F, 'N')}</div><div id="fedOut"></div></div>`;
    updateLag();
  }
  function updateLag() { $('#lagOut').innerHTML = lagOut(S.lag.code); $('#fedOut').innerHTML = fedOut(P(S.lag.r1), P(S.lag.r2), P(S.lag.F)); }
  $('#lagView').addEventListener('input', e => { const k = e.target.dataset.k; if (!k) return; S.lag[k] = e.target.value; lsSet('lag', S.lag); updateLag(); });

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
  const extras = q => drawHtml(q.draw) + tableHtml(q.table);
  function qBody(q, a, r, pre) {
    if (q.ask.type === 'choice') return `<div class="opts">${q.ask.choices.map((c, i) => `<button data-tc="${i}" ${r && (r.ok || pre === 'rt') ? 'disabled' : ''} class="${r && i === q.ask.correct && (r.ok || pre === 'rt') ? 'ok' : a.c === i ? (r && !r.ok ? 'bad' : 'on') : ''}">${esc(c)}</button>`).join('')}</div>`;
    return `<label class="f"><span>${esc(q.ask.label)} (${esc(q.ask.unit)})</span><div class="qin"><input data-in="1" inputmode="decimal" autocomplete="off" value="${esc(a.v || '')}" ${r && (r.ok || pre === 'rt') ? 'disabled' : ''}><span class="u">${esc(q.ask.unit)}</span></div></label>`;
  }
  function evalQ(q, a) {
    if (q.ask.type === 'choice') { if (a.c == null) { toast('Wähle zuerst eine Antwort.'); return null; } return { ok: a.c === q.ask.correct, given: q.ask.choices[a.c] }; }
    const v = P(a.v); if (!Number.isFinite(v)) { toast('Bitte gib eine Zahl ein (mit Komma oder Punkt).'); return null; }
    return { ok: Math.abs(v - q.value) <= q.tol + 1e-9, given: f(v, 2) + ' ' + q.ask.unit };
  }
  const resBlock = (q, r, showExpl) => `<ul class="tl"><li class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓ Richtig: ' + esc(r.given) : '✗ Deine Antwort „' + esc(r.given) + '“ stimmt nicht.'}</li>${q.ask.type === 'num' && q.tol > 0.011 ? `<li>ℹ Erlaubte Abweichung: ±${esc(f(q.tol, 2))} ${esc(q.ask.unit)} (wegen Rundung).</li>` : ''}</ul>` +
    (showExpl ? `<div class="rdout ${r.ok ? 'ok' : 'bad'}"><b>Lösung:</b> ${esc(solText(q))}<br><br><b>Lösungsweg:</b> ${esc(q.expl)}</div>` : '<div class="rdout bad">🎓 Prüfmodus: Den Lösungsweg gibt es erst, wenn die Aufgabe richtig gelöst ist. Nutze einen Tipp oder versuche es noch einmal.</div>');

  function renderTasks(top) {
    const V = $('#taskView'), d = done(), prog = lsGet('prog', {}), t = curTask(), n100 = TASKS.filter(x => d[x.id]).length; let h = '';
    if (t) {
      const q = S.tq, r = S.tRes && S.tRes.id === t.id ? S.tRes : null, a = S.tAns[t.id] || {};
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv">${dots(t.level)}</div><p style="margin:8px 0">${esc(q.text)}</p>${extras(q)}${qBody(q, a, r, 'tk')}`;
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
    if (e.ok) { markSolved(t.id, pct); const F = fx(); if (F && F.pass) try { F.pass(pct); } catch (er) {} else ding(); toast(exam() && pct < 100 ? pct + ' % (Tipps abgezogen)' : '🎉 Geschafft!'); } else { sad(); toast('Noch nicht richtig. Lies den Lösungsweg und versuche es noch einmal.'); }
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
      <div class="card pl"><h4>${esc(q.cat)} · <span class="lv">${dots(q.level)}</span></h4><div class="big">${esc(q.title)}</div><p style="margin:8px 0">${esc(q.text)}</p>${extras(q)}${qBody(q, T.ans, T.res, 'rt')}
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
  const exFrame = p => ({ sym: p.sym, tol: P(p.tol), dia: !!p.dia, datums: [p.d1, p.d2].filter(Boolean) });
  function exBody(e) {
    const p = e.p;
    if (e.tab === 'schr') return schrOut(p);
    if (e.tab === 'tol') return tolOut(exFrame(p));
    if (e.tab === 'stk') return `<div class="card pl" style="margin-bottom:0">${stkOut(p.rows)}</div>`;
    return p.focus === 'lager' ? lagOut(p.code) : fedOut(P(p.r1), P(p.r2), P(p.F));
  }
  function renderBsp() {
    $('#bspView').innerHTML = `<p class="hint2" style="margin:0 0 8px">Fertig durchgerechnete Beispiele (Übungswerte). Mit „In den Rechner laden“ öffnest du die Zahlen im passenden Reiter und kannst sie verändern.</p>` + D.examples.map(e => `<div class="card pl" id="ex_${e.id}"><h4>Beispiel</h4><div class="big">${esc(e.title)}</div><p style="margin:4px 0 8px">${esc(e.text)}</p>${exBody(e)}<div class="btns"><button class="btn pri" data-ex="${e.id}">In den Rechner laden</button></div></div>`).join('');
  }
  $('#bspView').addEventListener('click', e => {
    const b = e.target.closest('[data-ex]'); if (!b) return; const x = D.examples.find(z => z.id === b.dataset.ex), p = x.p;
    if (x.tab === 'schr') { S.schr = { d: sc(p.d), fk: p.fk, t1: sc(p.t1), t2: sc(p.t2), w: String(p.w) }; lsSet('schr', S.schr); }
    else if (x.tab === 'tol') { S.tol = { sym: p.sym, tol: p.tol, dia: !!p.dia, d1: p.d1 || '', d2: p.d2 || '' }; lsSet('tol', S.tol); }
    else if (x.tab === 'stk') { S.stk = { rows: p.rows.map(r => Object.assign({}, r)) }; lsSet('stk', S.stk); }
    else { S.lag = { code: p.code, r1: p.r1, r2: p.r2, F: p.F }; lsSet('lag', S.lag); }
    setTab(x.tab); toast('Beispiel geladen: ' + x.title);
  });

  /* ============================================================ Hilfe */
  function renderHelp() {
    const sec = (t, b, open) => `<details${open ? ' open' : ''}><summary>${t}</summary><div class="hb2">${b}</div></details>`;
    $('#helpView').innerHTML =
      `<div class="rdout warn">⚠ ${esc(UEB)}</div>` +
      sec('Schrauben und Gewinde', `<span class="eq">Bezeichnung: ISO 4017 M8x30-8.8 = Norm, Gewinde, Länge in mm, Festigkeitsklasse</span><span class="eq">Festigkeitsklasse a.b: Rm = a · 100 N/mm², Re = a · b · 10 N/mm²</span><span class="eq">Kernlochdurchmesser ≈ Nenndurchmesser − Steigung</span><span class="eq">Zugkraft an der Streckgrenze F = Re · As</span><span class="eq">Schraubenlänge ≥ Teile + Scheibe + Mutterhöhe + 2 · P, dann auf Normlänge aufrunden</span><span class="eq">Mutter-Klasse mindestens Zahl vor dem Punkt (8.8 → 8)</span>${thTable()}<p class="hint2">Schraubensicherung: hohe Vorspannung, formschlüssig (Kronenmutter mit Splint), stoffschlüssig (flüssiges Sicherungsmittel), Kontern. Federringe und Zahnscheiben wirken bei hochfesten Schrauben kaum.</p>`, true) +
      sec('Normteile und Stückliste', `<table><tr><th>Norm</th><th>Normteil</th></tr>${Object.keys(C.NORMS).map(k => `<tr><td>${esc((k === '6885' ? 'DIN ' : 'ISO ') + k)}</td><td>${esc(C.NORMS[k].n)}</td></tr>`).join('')}</table><p>Stückliste: Position, Menge, Benennung, Bezeichnung oder Werkstoff. Mutter und Scheibe müssen zum Gewinde der Schraube passen; die Menge der Muttern entspricht der der Schrauben.</p>`) +
      sec('Welle-Nabe-Verbindungen', `<p><b>Formschluss:</b> Passfeder (Drehmoment über die Seitenflächen). <b>Kraftschluss:</b> Pressverband (Reibung). <b>Stoffschluss:</b> Kleben, Löten, Schweißen. Die Passfeder sichert nicht gegen axiales Verschieben.</p><table><tr><th>Wellendurchmesser über … bis …</th><th>b × h</th><th>Nuttiefe t1</th></tr>${C.PF.map(p => `<tr><td>${p.from} bis ${p.to} mm</td><td>${p.b} × ${p.h}</td><td>${esc(f(p.t1, 1))} mm</td></tr>`).join('')}</table><span class="eq">Umfangskraft Fu = 2 · M / d (M in N·mm)</span><span class="eq">Tragende Länge: Form A (rund) l − b, Form B (eckig) l</span><span class="eq">Fügen im Pressverband: ΔT = Δd / (α · d), α(Stahl) = 12 · 10⁻⁶ 1/K</span>`) +
      sec('Wälzlager', `<p>Kurzzeichen 6204: <b>6</b> = Rillenkugellager, <b>2</b> = Durchmesserreihe, <b>04</b> = Bohrungskennzahl (04 · 5 = 20 mm). Kennzahlen 00, 01, 02, 03 stehen für 10, 12, 15, 17 mm.</p><table><tr><th>Anfang</th><th>Lagerart</th></tr><tr><td>6</td><td>Rillenkugellager</td></tr><tr><td>7</td><td>Schrägkugellager</td></tr><tr><td>30, 32</td><td>Kegelrollenlager</td></tr><tr><td>NU</td><td>Zylinderrollenlager</td></tr><tr><td>51</td><td>Axial-Rillenkugellager</td></tr><tr><td>22</td><td>Pendelrollenlager</td></tr></table><p>Nachsetzzeichen: 2RS = beidseitig berührende Dichtscheiben, ZZ = Deckscheiben, C3 = größere Lagerluft.</p><table><tr><th>Bohrung</th><th>Reihe 0 (D × B)</th><th>Reihe 2 (D × B)</th><th>Reihe 3 (D × B)</th></tr>${[10, 12, 15, 17, 20, 25, 30, 35, 40].map(b => `<tr><td>${b} mm</td>${['0', '2', '3'].map(s => `<td>${C.BRDIM[s][b][0]} × ${C.BRDIM[s][b][1]}</td>`).join('')}</tr>`).join('')}</table>`) +
      sec('Federn', `<span class="eq">Federrate R = F / s (N/mm)</span><span class="eq">Parallel: R = R1 + R2 (härter)</span><span class="eq">Reihe: 1/R = 1/R1 + 1/R2 (weicher)</span><span class="eq">Federarbeit W = ½ · F · s</span>`) +
      sec('Form- und Lagetoleranzen (ISO 1101)', `<p>Der Toleranzrahmen wird von links nach rechts gelesen: Symbol, Toleranzwert (mit ⌀ bei zylindrischer Zone), Bezugsbuchstaben.</p><table><tr><th>Symbol</th><th>Toleranzart</th><th>Einteilung</th><th>Bezug</th></tr>${C.SYMS.map(x => `<tr><td>${symSvg(x.id, 26)}</td><td>${esc(x.n)}</td><td>${esc(x.cls)}</td><td>${x.dat ? 'ja' : 'nein'}</td></tr>`).join('')}</table><p>Position mit ⌀ t: Die Achse darf höchstens t/2 vom Sollort entfernt liegen (Abstand mit Pythagoras bestimmen, nicht x und y einzeln prüfen).</p>`) +
      sec('Oberflächenangaben', `<p><b>Ra</b> = arithmetischer Mittenrauwert in µm, <b>Rz</b> = gemittelte Rautiefe. Kleiner Wert = glatter und meist teurer.</p><table><tr><th>Verfahren (Übungswert)</th><th>Ra in µm</th></tr>${C.RA_PROC.map(p => `<tr><td>${esc(p.n)}</td><td>${esc(f(p.ra, 1))}</td></tr>`).join('')}</table><p>Bearbeitungszeichen: offenes V = Verfahren beliebig; V mit Strich = spanend bearbeiten; V mit Kreis = Anlieferzustand, kein Abtrag.</p>`) +
      sec('Fertigungsgerecht konstruieren', `<ul><li>Gussteile: Gussschrägen (etwa 1° bis 3°), gleichmäßige Wanddicken, Radien statt scharfer Kanten, keine Hinterschneidungen.</li><li>Gussschräge: Δ = h · tan α.</li><li>Gewinde: Freistich vor Schultern, Kernloch im Sackloch tiefer als das Gewinde.</li><li>Fräsen: Innenecken mit Radius (mindestens Fräserradius).</li><li>Bohrungen: Abstand zum Rand, ebene Ansatzfläche.</li><li>Spannflächen vorsehen; bearbeitete Flächen klein halten.</li></ul><p>Werkstoffe als Anwendung: EN-GJL-200 für Gehäuse (gießbar, dämpfend, spröde), C45 für vergütete Wellen, S235JR für geschweißte Rahmen. Was die Kurzzeichen bedeuten, steht im Werkstoff-Lab.</p>`) +
      `<p class="hint2">Zahlen und Begriffe sind Lehrbuch- und Übungswerte; Unsicheres ist im Quelltext mit PRUEFEN markiert. Passungen und Messmittel findest du im Toleranzen-Lab, Ansichten und Bemaßung im Zeichnungs-Lab.</p>`;
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'schr'; S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    ({ schr: renderSchr, tol: renderTol, stk: renderStk, lag: renderLag, tasks: renderTasks, rt: renderTrainer, bsp: renderBsp, help: renderHelp })[t]();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'Konstruktions-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = 'Konstruktions-Lab: ' + T[2];
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
  $('#title').onclick = () => setTab('schr');
  $('#bMenu').onclick = () => {
    const rows = [['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung und Tipps'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Aufgaben mit Serien-Zähler'], ['bsp', 'Beispiele', 'Fertig durchgerechnete Beispiele zum Laden'], ['help', 'Hilfe und Tabellen', 'Schrauben, Passfedern, Lager, Toleranzen, Rauheit'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben und Trainer-Serie auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
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
  root.KON_LAB = { id: 'kon', title: 'Konstruktions-Lab', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.KON_TASKS };

  buildTabs(); updatePal(); setTab(TABS.some(x => x[0] === S.tab) ? S.tab : 'schr');
  /* Aufruf ?aufgabe=kon1 (Startseite, Lernhefte) öffnet die Aufgabe, ?bsp die Beispiele (?bsp=kern1 springt zu einem Beispiel) */
  try {
    const qp = new URLSearchParams(location.search), qa = qp.get('aufgabe');
    if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); }
    else if (qp.has('bsp')) { setTab('bsp'); const el = $('#ex_' + (qp.get('bsp') || '').replace(/[^a-z0-9_]/gi, '')); if (el) el.scrollIntoView(); }
  } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
