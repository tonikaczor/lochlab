'use strict';
/* Tonfunk Rechen-Lab: Oberfläche (Lab-Kennung 'mat').
   Reiter: Einheiten, Dreisatz, Prozent, Umstellen, Geometrie, Messwerte, Beispiele, Aufgaben, Trainer, Hilfe.
   Module: matcore.js (MAT_CORE, Logik), matdata.js (MAT_DATA, MAT_TASKS).
   Speicher (Präfix lm4.mat.): tab, done ({id:true} nur gelöste), prog ({id:Prozent}), hints ({id:höchste Stufe}), ctipps ({id:Stufe} nur im Prüfmodus),
   exam ('1' = Prüfmodus), rt (Trainer: n, ok, streak, best).
   Tipp-Abzug (25 % je Stufe) gibt es nur im Prüfmodus; beim normalen Üben kosten Tipps nichts. */
(function (root) {
  const C = root.MAT_CORE, D = root.MAT_DATA;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.mat.';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(LS + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} };
  const dots = l => '●'.repeat(l || 1) + '○'.repeat(3 - (l || 1));
  const fx = () => root.LochFX || null;
  const ding = () => { const F = fx(); if (F && F.sound) try { F.sound('ding', 0.6); } catch (e) {} };
  const sad = () => { const F = fx(); if (F && F.sound) try { F.sound('sad', 0.5); } catch (e) {} };
  const fmt = C && C.fmt;

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
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>Rechen-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">matcore.js oder matdata.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks;

  /* ============================================================ Zustand */
  const TABS = [['einh', '📏', 'Einheiten'], ['drei', '⚖️', 'Dreisatz'], ['proz', '％', 'Prozent'], ['umst', '🔁', 'Umstellen'], ['geo', '📐', 'Geometrie'], ['mess', '📊', 'Messwerte'], ['bsp', '💡', 'Beispiele'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['help', '📘', 'Hilfe']];
  const S = {
    tab: lsGet('tab', 'einh'),
    einh: { fam: 'laenge', v: '4,7', from: 'mm', to: 'm', sv: '0,000047' },
    drei: { typ: 'direkt', a: '5', b: '3,5', x: '12', la: 'Stück', lb: '€', mr: '1:9', mt: '10', ms: '1:50', ml: '36' },
    proz: { k: 'pw', x: '250', y: '18', z: '90' },
    umst: { f: 'ohm', t: 'R', mode: 'zeig', step: 0, err: 0, vals: {} },
    geo: { sub: 'tri', known: 'ab', v1: '3', v2: '4', shape: 'zylinder', unit: 'mm', p: {}, rho: '' },
    mess: { txt: '25,02 24,98 25,01 25,03 24,96', rv: '0,0123456', rn: '3', sc: '0,0250' },
    task: null, tAns: {}, tRes: null, seeds: {}, inst: {},
    tr: { cat: 'alle', level: 0, p: null, ans: '', res: null },
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {}))
  };

  /* ============================================================ kleine HTML-Bausteine */
  const stp = (steps, last) => '<ol class="stp">' + steps.map((s, i) => `<li${last && i === steps.length - 1 ? ' class="res"' : ''}>${esc(s)}</li>`).join('') + '</ol>';
  const inp = (key, label, val, extra) => `<label class="f"><span>${esc(label)}</span><input inputmode="decimal" autocomplete="off" data-s="${key}" value="${esc(val)}" ${extra || ''}></label>`;
  const txt = (key, label, val) => `<label class="f"><span>${esc(label)}</span><input autocomplete="off" data-s="${key}" value="${esc(val)}"></label>`;
  const seg = (key, items, cur) => `<div class="seg" role="group">${items.map(([k, l]) => `<button data-seg="${key}" data-v="${k}" class="${String(cur) === String(k) ? 'on' : ''}" aria-pressed="${String(cur) === String(k)}">${l}</button>`).join('')}</div>`;
  const sel = (key, opts, cur, re) => `<select data-s="${key}"${re ? ' data-r="1"' : ''}>${opts.map(o => `<option value="${esc(o[0])}"${o[0] === cur ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
  const hint = m => `<p class="hint2">${esc(m)}</p>`;
  const num = s => C.parseDe(s);

  /* ============================================================ SVG */
  /* Rechtwinkliges Dreieck: lab = {a, b, c, al, be} (Texte; "?" wird hervorgehoben); angle = Winkel α für die Form */
  function svgTri(lab, angle) {
    const al = Math.min(70, Math.max(18, angle || 35)), W = 240, h = Math.min(150, Math.max(50, W * Math.tan(al * Math.PI / 180))), ax = 50, ay = 190, cx = ax + W, by = ay - h;
    const L = (k, v) => !v ? k : new RegExp('^' + k + '( |$)').test(String(v)) ? String(v) : k + ' = ' + v;
    const T = (x, y, s, anchor, cls) => s ? `<text x="${x}" y="${y}" text-anchor="${anchor || 'middle'}" font-size="15"${cls || (String(s).indexOf('?') >= 0 ? ' class="sv-q"' : '')}>${esc(s)}</text>` : '';
    return `<svg viewBox="0 0 340 225" width="360" role="img" aria-label="Rechtwinkliges Dreieck mit Seiten a, b, c und Winkel α">
      <polygon points="${ax},${ay} ${cx},${ay} ${cx},${by}" class="sv-f"/><polygon points="${ax},${ay} ${cx},${ay} ${cx},${by}" class="sv-a"/>
      <path d="M${cx - 14},${ay} v-14 h14" class="sv-k"/><path d="M${ax + 38},${ay} A38 38 0 0 0 ${ax + 38 * Math.cos(al * Math.PI / 180)},${ay - 38 * Math.sin(al * Math.PI / 180)}" class="sv-k"/>
      ${T(cx + 8, (ay + by) / 2 + 5, L('a', lab.a), 'start')}${T((ax + cx) / 2, ay + 22, L('b', lab.b))}${T((ax + cx) / 2 - 22, (ay + by) / 2 - 10, L('c', lab.c), 'end')}
      ${T(ax + 50, ay - 8, lab.al, 'start')}${lab.be ? T(cx - 6, by - 8, lab.be, 'end') : ''}
      <text x="${cx - 24}" y="${ay - 6}" font-size="12" text-anchor="end" class="sv-m">90°</text>
      <text x="${ax - 4}" y="${ay + 16}" font-size="13" text-anchor="end" class="sv-m">A</text><text x="${cx + 6}" y="${ay + 16}" font-size="13" class="sv-m">C</text><text x="${cx + 6}" y="${by - 4}" font-size="13" class="sv-m">B</text></svg>`;
  }
  /* Zahlenstrahl der Zehnerpotenzen (Vorsätze p ... G); Markierung bei 10^e */
  function svgLine(e, label) {
    const x0 = 30, x1 = 610, X = v => x0 + (v + 12) / 21 * (x1 - x0), pe = Math.max(-12, Math.min(9, e)), mx = X(pe), names = { '-12': 'p', '-9': 'n', '-6': 'µ', '-3': 'm', '0': '1', '3': 'k', '6': 'M', '9': 'G' };
    let g = ''; for (let v = -12; v <= 9; v++) { const big = v % 3 === 0; g += `<line x1="${X(v)}" x2="${X(v)}" y1="${big ? 44 : 50}" y2="58" class="sv-k"/>`; if (big) g += `<text x="${X(v)}" y="76" text-anchor="middle" font-size="14" font-weight="700">${names[v]}</text><text x="${X(v)}" y="92" text-anchor="middle" font-size="11" class="sv-m">10${C.sup(v)}</text>`; }
    const anc = mx < 120 ? 'start' : mx > 520 ? 'end' : 'middle';
    return `<div class="svbox"><svg viewBox="0 0 640 100" width="640" role="img" aria-label="Zahlenstrahl der Zehnerpotenzen"><line x1="${x0}" x2="${x1}" y1="58" y2="58" class="sv-k"/>${g}<path d="M${mx - 7},26 L${mx + 7},26 L${mx},42 Z" fill="var(--hi)"/><text x="${mx}" y="18" text-anchor="${anc}" font-size="13" class="sv-q">${esc(label)}</text></svg></div>`;
  }

  /* ============================================================ Reiter: Einheiten */
  const DEF = { laenge: ['mm', 'm'], flaeche: ['m²', 'cm²'], volumen: ['dm³', 'l'], masse: ['g', 'kg'], zeit: ['min', 's'], geschw: ['km/h', 'm/s'], druck: ['bar', 'Pa'], leistung: ['kW', 'W'], spannung: ['mV', 'V'], strom: ['mA', 'A'], widerstand: ['kΩ', 'Ω'] };
  function renderEinh() {
    const E = S.einh, F = C.FAM[E.fam], us = Object.keys(F.u); if (!F.u.hasOwnProperty(E.from)) E.from = us[0]; if (!F.u.hasOwnProperty(E.to)) E.to = us[us.length > 1 ? 1 : 0];
    const o = u => us.map(x => [x, x]);
    $('#v_einh').innerHTML = `<div class="card pl"><h4>Einheiten umrechnen</h4><div class="cf">${Object.keys(C.FAM).map(k => `<button class="chip${k === E.fam ? ' on' : ''}" data-fam="${k}">${esc(C.FAM[k].name)}</button>`).join('')}</div>
      <div class="three">${inp('einh.v', 'Wert', E.v)}<label class="f"><span>von</span>${sel('einh.from', o(), E.from)}</label><label class="f"><span>nach</span>${sel('einh.to', o(), E.to)}</label></div>
      <div class="btns" style="margin-top:0"><button class="btn" data-act="swap">⇄ Einheiten tauschen</button></div><div id="eOut"></div></div>
      <div class="card pl"><h4>Zehnerpotenzen und Vorsätze</h4>${inp('einh.sv', 'Zahl (z. B. 0,000047 oder 12500000)', E.sv)}<div id="sOut"></div></div>`;
    updEinh();
  }
  function updEinh() {
    const E = S.einh, v = num(E.v), F = C.FAM[E.fam], c = C.convert(v, E.from, E.to); let h;
    if (!isFinite(v)) h = hint('Bitte gib eine Zahl ein (mit Komma oder Punkt).');
    else {
      h = `<div class="big2">${fmt(v, 10)} ${esc(E.from)} = ${fmt(c.value, 10)} ${esc(E.to)}</div>${stp(c.steps)}<p class="hint2">Wissenschaftlich: ${esc(C.fmtSci(c.value))} ${esc(E.to)}</p>`;
      if (F.lb && v !== 0) { const e = Math.log10(Math.abs(v) * F.u[E.from] / F.lb), bu = Object.keys(F.u).find(u => F.u[u] === F.lb); h += `<p class="hint2" style="margin-bottom:0">Zahlenstrahl-Gefühl: ${fmt(v, 10)} ${esc(E.from)} liegt bei etwa 10${C.sup(Math.round(e))} ${esc(bu)} (Größenordnung).</p>${svgLine(e, C.fmtSci(Math.abs(v) * F.u[E.from] / F.lb) + ' ' + bu)}`; }
    }
    $('#eOut').innerHTML = h;
    const x = num(E.sv), so = $('#sOut'); if (!so) return;
    if (!isFinite(x)) { so.innerHTML = hint('Bitte gib eine Zahl ein.'); return; }
    const sc = C.sci(x), en = C.eng(x);
    so.innerHTML = `<div class="big2">${esc(C.fmtSci(x))}</div><div class="rdout"><b>Wissenschaftlich:</b> m · 10ⁿ mit 1 ≤ m &lt; 10: ${esc(fmt(sc.m, 10))} · 10${C.sup(sc.e)} (Exponent n = ${sc.e}).<br><b>Technisch</b> (Exponent durch 3 teilbar, Vorsatz): ${esc(fmt(en.m, 10))} · 10${C.sup(en.e3)}${en.prefix ? ' = ' + esc(fmt(en.m, 10)) + ' ' + esc(en.prefix) + '… (Vorsatz ' + esc(en.prefix) + ')' : ''}.</div>${x !== 0 ? svgLine(sc.e, C.fmtSci(x)) : ''}`;
  }

  /* ============================================================ Reiter: Dreisatz */
  function renderDrei() {
    const E = S.drei;
    $('#v_drei').innerHTML = `<div class="card pl"><h4>Dreisatz im Schema</h4>${seg('drei.typ', [['direkt', 'Je mehr, desto mehr (direkt)'], ['indirekt', 'Je mehr, desto weniger (indirekt)']], E.typ)}
      <p class="hint2">Gegeben: <b>a</b> der ersten Größe gehört zu <b>b</b> der zweiten. Gesucht: Was gehört zu <b>x</b>?</p>
      <div class="three">${inp('drei.a', 'a (erste Größe)', E.a)}${inp('drei.b', 'b (zweite Größe)', E.b)}${inp('drei.x', 'x (neue erste Größe)', E.x)}</div>
      <div class="two">${txt('drei.la', 'Einheit der ersten Größe', E.la)}${txt('drei.lb', 'Einheit der zweiten Größe', E.lb)}</div><div id="dOut"></div></div>
      <div class="card pl"><h4>Mischungsverhältnis</h4><div class="two">${txt('drei.mr', 'Verhältnis (z. B. 1:9 oder 2:3:5)', E.mr)}${inp('drei.mt', 'Gesamtmenge', E.mt)}</div><div id="mOut"></div></div>
      <div class="card pl"><h4>Maßstab</h4><div class="two">${txt('drei.ms', 'Maßstab (1:50 oder 5:1)', E.ms)}${inp('drei.ml', 'Länge auf der Zeichnung', E.ml)}</div><div id="sOut2"></div></div>`;
    updDrei();
  }
  function updDrei() {
    const E = S.drei, a = num(E.a), b = num(E.b), x = num(E.x), d = C.dreisatz(E.typ, a, b, x, E.la.trim(), E.lb.trim()); let h;
    if (!d) h = hint(![a, b, x].every(isFinite) ? 'Bitte gib drei Zahlen ein.' : E.typ === 'indirekt' ? 'a und x dürfen nicht 0 sein.' : 'a darf nicht 0 sein (Division durch 0).');
    else {
      const U = (n, u) => esc(fmt(n) + (u.trim() ? ' ' + u.trim() : '')), r = d.schema;
      h = `<table class="sch"><tr><td>${U(r[0][0], E.la)}</td><td class="ar">→</td><td>${U(r[0][1], E.lb)}</td></tr><tr><td>${U(1, E.la)}</td><td class="ar">→</td><td>${U(r[1][1], E.lb)}</td></tr><tr class="key"><td>${U(r[2][0], E.la)}</td><td class="ar">→</td><td>${U(r[2][1], E.lb)}</td></tr></table>${stp(d.steps)}<div class="big2">Ergebnis: ${U(d.value, E.lb)}</div>`;
    }
    $('#dOut').innerHTML = h;
    const parts = E.mr.split(':').map(s => num(s)), t = C.teilung(parts, num(E.mt)), mo = $('#mOut');
    mo.innerHTML = t && parts.length >= 2 ? stp(t.steps) + `<div class="big2">${t.shares.map(s => esc(fmt(s))).join(' : ')} <small>(Summe ${esc(fmt(num(E.mt)))})</small></div>` : hint('Schreibe das Verhältnis mit Doppelpunkt (z. B. 1:4) und die Gesamtmenge als Zahl.');
    const mp = E.ms.split(':').map(s => num(s)), m = mp.length === 2 ? C.massstab(mp[0], mp[1], num(E.ml)) : null;
    $('#sOut2').innerHTML = m ? stp(m.steps) + `<div class="big2">${esc(fmt(m.value))} <small>wirkliche Länge (gleiche Einheit wie die Zeichnung)</small></div>` : hint('Maßstab als 1:50 (verkleinert) oder 5:1 (vergrößert) eingeben, Länge als Zahl.');
  }

  /* ============================================================ Reiter: Prozent */
  const PK = [['pw', 'Prozentwert gesucht', 'Grundwert G', 'Prozentsatz p (%)'], ['ps', 'Prozentsatz gesucht', 'Grundwert G', 'Prozentwert W'], ['gw', 'Grundwert gesucht', 'Prozentwert W', 'Prozentsatz p (%)'],
    ['mehr', 'Vermehrter Grundwert (Aufschlag)', 'Grundwert', 'Aufschlag p (%)'], ['minder', 'Verminderter Grundwert (Rabatt)', 'Grundwert', 'Abschlag p (%)'], ['gwMehr', 'Grundwert aus vermehrtem Wert', 'vermehrter Wert', 'Aufschlag p (%)'], ['gwMinder', 'Grundwert aus vermindertem Wert', 'verminderter Wert', 'Abschlag p (%)'],
    ['mwst', 'Mehrwertsteuer: Netto → Brutto', 'Nettobetrag', 'MwSt-Satz (19 oder 7 %)'], ['netto', 'Mehrwertsteuer: Brutto → Netto', 'Bruttobetrag', 'MwSt-Satz (19 oder 7 %)'], ['skonto', 'Skonto: Zahlbetrag', 'Rechnungsbetrag', 'Skonto (%)'],
    ['zins', 'Einfache Zinsen', 'Kapital K', 'Zinssatz p (%)', 'Tage t'], ['promille', 'Promille', 'Grundwert', 'Promille (‰)'], ['toleranz', 'Toleranz in Prozent', 'Nennmaß', 'Toleranz (± Abmaß)']];
  function renderProz() {
    const E = S.proz, k = PK.find(p => p[0] === E.k) || PK[0];
    $('#v_proz').innerHTML = `<div class="card pl"><h4>Prozent, Promille, Zinsen</h4><label class="f"><span>Was ist gesucht?</span>${sel('proz.k', PK.map(p => [p[0], p[1]]), E.k, true)}</label>
      <div class="${k[4] ? 'three' : 'two'}">${inp('proz.x', k[2], E.x)}${inp('proz.y', k[3], E.y)}${k[4] ? inp('proz.z', k[4], E.z) : ''}</div><div id="pOut"></div></div>`;
    updProz();
  }
  function updProz() {
    const E = S.proz, x = num(E.x), y = num(E.y), r = C.proz(E.k, x, y, num(E.z));
    $('#pOut').innerHTML = r ? `<div class="big2">Ergebnis: ${esc(fmt(r.value, 4))}${['ps', 'toleranz'].includes(E.k) ? ' %' : ''}</div>${stp(r.steps)}` : hint(![x, y].every(isFinite) ? 'Bitte gib die Zahlen ein.' : 'Mit diesen Werten ist keine Rechnung möglich (Division durch 0?).');
  }

  /* ============================================================ Reiter: Formeln umstellen */
  const targetsOf = f => Object.keys(f.vars).filter(v => f.sol[v]);
  function renderUmst() {
    const E = S.umst; let f = C.formel(E.f) || C.FORMELN[0]; if (!f.sol[E.t]) { E.t = targetsOf(f)[0]; E.step = 0; E.err = 0; }
    const u = C.umformung(f.id, E.t);
    let h = `<div class="card pl"><h4>Formel umstellen</h4><label class="f"><span>Formel</span>${sel('umst.f', C.FORMELN.map(x => [x.id, x.name + ':  ' + C.pretty(x.eq)]), f.id, true)}</label>
      <div class="cf"><span style="align-self:center;font-size:13px;color:var(--mute)">Gesucht:</span>${targetsOf(f).map(v => `<button class="chip${v === E.t ? ' on' : ''}" data-ut="${v}">${esc(C.pretty(v))} (${esc(f.vars[v][0])})</button>`).join('')}</div>
      ${seg('umst.mode', [['zeig', 'Lösungsweg zeigen'], ['ueb', 'Selbst üben']], E.mode)}`;
    if (E.mode === 'zeig') {
      h += `<div class="mono">${esc(C.pretty(u.start))}</div><ol class="stp">${u.steps.map(s => `<li><b>${esc(s.op)}</b>${'\n'}${esc(C.pretty(s.eq))}</li>`).join('')}</ol>
        <p class="hint2">Regel: Was du auf einer Seite der Gleichung tust, tust du auch auf der anderen (Äquivalenzumformung). Immer die Umkehrung nehmen: Mal ↔ Geteilt, Plus ↔ Minus, Quadrat ↔ Wurzel.</p>
        <div class="rdout ok"><b>Ergebnis:</b> ${esc(C.pretty(u.result))}</div><h4 style="margin:12px 0 4px;font-size:12px;color:var(--mute);text-transform:uppercase">Zahlen einsetzen</h4><div class="three">${C.idsOf(u.expr).map(v => inp('umst.vals.' + v, `${C.pretty(v)} in ${f.vars[v] ? f.vars[v][1] : ''}`, E.vals[v] == null ? '' : E.vals[v])).join('')}</div><div id="uOut"></div>`;
    } else {
      const done = E.step >= u.steps.length;
      h += `<div class="mono">${esc(C.pretty(u.start))}</div>${E.step ? `<ol class="stp">${u.steps.slice(0, E.step).map(s => `<li><b>${esc(s.op)}</b>${'\n'}${esc(C.pretty(s.eq))}</li>`).join('')}</ol>` : ''}`;
      if (done) h += `<div class="rdout ok"><b>Geschafft!</b> ${esc(C.pretty(u.result))}<br>Fehlversuche: ${E.err}</div><div class="btns"><button class="btn pri" data-act="uagain">Nochmal üben</button></div>`;
      else {
        const st = u.steps[E.step], R = C.rng(f.id + E.t + E.step), pad = ['beide Seiten · 2', 'beide Seiten − 1', 'beide Seiten + 1'], o = [st.op].concat(st.bad);
        for (const p of pad) if (o.length < 3 && !o.includes(p)) o.push(p);
        h += `<p style="margin:10px 0 0"><b>Schritt ${E.step + 1} von ${u.steps.length}:</b> Was machst du als Nächstes?</p><div class="opts ops">${C.shuffle(R, o).map((op, i) => `<button data-uop="${esc(op)}">${esc(op)}</button>`).join('')}</div>`;
      }
      h += `<p class="hint2">Fehlversuche: ${E.err}</p>`;
    }
    $('#v_umst').innerHTML = h + '</div>'; if (E.mode === 'zeig') updUmst();
  }
  function updUmst() {
    const E = S.umst, f = C.formel(E.f), u = C.umformung(f.id, E.t), o = $('#uOut'); if (!o) return;
    const env = {}; let ok = true; C.idsOf(u.expr).forEach(v => { const n = num(E.vals[v]); if (isFinite(n)) env[v] = n; else ok = false; });
    const r = ok ? C.solveFor(f.id, E.t, env) : null;
    o.innerHTML = !ok ? hint('Trage die Zahlen ein, dann wird mit der umgestellten Formel gerechnet.') : r == null ? hint('Mit diesen Werten geht es nicht (Division durch 0 oder Wurzel aus einer negativen Zahl).') : `<div class="mono">${esc(C.calcLine(E.t, u.expr, env, null, f.vars[E.t][1]))}</div>`;
  }

  /* ============================================================ Reiter: Geometrie */
  const KN = { ab: ['a', 'b', 'Katheten a und b'], ac: ['a', 'c', 'Kathete a und Hypotenuse c'], bc: ['b', 'c', 'Kathete b und Hypotenuse c'], aal: ['a', 'alpha', 'Gegenkathete a und Winkel α'], bal: ['b', 'alpha', 'Ankathete b und Winkel α'], cal: ['c', 'alpha', 'Hypotenuse c und Winkel α'] };
  const DEFP = { rechteck: ['30', '20'], kreis: ['20'], dreieck: ['30', '20'], trapez: ['40', '20', '15'], ring: ['30', '12'], quader: ['40', '30', '20'], zylinder: ['20', '50'], kegel: ['20', '30'], kugel: ['40'] };
  function renderGeo() {
    const E = S.geo; let h = `<div class="card pl"><h4>Geometrie</h4>${seg('geo.sub', [['tri', 'Dreieck: Pythagoras, sin, cos, tan'], ['form', 'Flächen und Körper']], E.sub)}`;
    if (E.sub === 'tri') {
      const k = KN[E.known] || KN.ab, lab = n => n === 'alpha' ? 'Winkel α (°)' : 'Seite ' + n;
      h += `<label class="f" style="margin-top:8px"><span>Was ist bekannt?</span>${sel('geo.known', Object.keys(KN).map(x => [x, KN[x][2]]), E.known, true)}</label><div class="two">${inp('geo.v1', lab(k[0]), E.v1)}${inp('geo.v2', lab(k[1]), E.v2)}</div><div id="gOut"></div></div>`;
    } else {
      const S0 = C.SHAPES[E.shape] || C.SHAPES.kreis; S0.p.forEach(([k], i) => { if (E.p[E.shape + k] == null) E.p[E.shape + k] = (DEFP[E.shape] || [])[i] || '10'; });
      h += `<div class="two" style="margin-top:8px"><label class="f"><span>Form</span>${sel('geo.shape', Object.keys(C.SHAPES).map(x => [x, C.SHAPES[x].name]), E.shape, true)}</label><label class="f"><span>Längeneinheit</span>${sel('geo.unit', ['mm', 'cm', 'm', 'dm'].map(x => [x, x]), E.unit, true)}</label></div>
        <div class="three">${S0.p.map(([k, n]) => inp('geo.p.' + E.shape + k, `${k} (${n})`, E.p[E.shape + k])).join('')}</div>${S0.o.some(o => o[3] === 3) ? inp('geo.rho', 'Dichte ρ in g/cm³ (optional, nur mit Einheit cm: Masse)', E.rho) : ''}<div id="gOut"></div></div>`;
    }
    $('#v_geo').innerHTML = h; updGeo();
  }
  function updGeo() {
    const E = S.geo, o = $('#gOut'); if (!o) return;
    if (E.sub === 'tri') {
      const k = KN[E.known] || KN.ab, in_ = {}; in_[k[0]] = num(E.v1); in_[k[1]] = num(E.v2);
      const t = C.solveTri(in_);
      if (!t) { o.innerHTML = hint('Mit diesen Angaben gibt es kein Dreieck: Seiten müssen größer als 0 sein, die Hypotenuse c ist die längste Seite, der Winkel liegt zwischen 0° und 90°.'); return; }
      const f = v => fmt(C.rd(v, 3), 3), fa = v => fmt(C.rd(v, 2), 2) + '°';
      o.innerHTML = `<div class="svbox">${svgTri({ a: f(t.a), b: f(t.b), c: f(t.c), al: 'α = ' + fa(t.alpha), be: 'β = ' + fa(t.beta) }, t.alpha)}</div>${stp(t.steps)}<div class="rdout ok"><b>Ergebnis:</b> a = ${esc(f(t.a))}, b = ${esc(f(t.b))}, c = ${esc(f(t.c))}, α = ${esc(fa(t.alpha))}, β = ${esc(fa(t.beta))}</div>
        <p class="hint2">Taschenrechner auf Grad (DEG) stellen. Gegenkathete a liegt α gegenüber, Ankathete b liegt an α an.</p>`;
    } else {
      const S0 = C.SHAPES[E.shape], env = {}; let ok = true; S0.p.forEach(([k]) => { const n = num(E.p[E.shape + k]); if (isFinite(n)) env[k] = n; else ok = false; });
      const g = ok ? C.geo(E.shape, env, E.unit, 2) : null;
      if (!g) { o.innerHTML = hint(ok ? 'Alle Maße müssen größer als 0 sein (beim Kreisring: Innen-Ø kleiner als Außen-Ø).' : 'Trage alle Maße als Zahl ein.'); return; }
      let h = g.results.map(r => `<div class="mono">${esc(r.name)}: ${esc(r.line)}</div>`).join('');
      const V = g.results.find(r => r.pow === 3), rho = num(E.rho);
      if (V && isFinite(rho) && rho > 0) h += E.unit === 'cm' ? `<div class="mono">${esc(C.calcLine('m', 'rho*V', { rho, V: V.value }, 2, 'g'))}  =  ${esc(C.fmtDe(rho * V.value / 1000, 3))} kg</div>` : hint('Für die Masse bitte die Längeneinheit cm wählen (Dichte in g/cm³).');
      o.innerHTML = h;
    }
  }

  /* ============================================================ Reiter: Messwerte */
  function renderMess() {
    const E = S.mess;
    $('#v_mess').innerHTML = `<div class="card pl"><h4>Mittelwert, Median, Streuung</h4><label class="f"><span>Messwerte (Trennung mit Leerzeichen, Semikolon oder Zeilenumbruch)</span><textarea rows="3" data-s="mess.txt">${esc(E.txt)}</textarea></label><div id="tOut"></div></div>
      <div class="card pl"><h4>Sinnvoll runden und signifikante Stellen</h4><div class="two">${inp('mess.rv', 'Zahl', E.rv)}<label class="f"><span>auf … signifikante Stellen</span>${sel('mess.rn', [1, 2, 3, 4, 5].map(n => [String(n), String(n)]), E.rn)}</label></div>${txt('mess.sc', 'Wie viele signifikante Stellen hat diese Zahl?', E.sc)}<div id="rOut"></div></div>
      <div class="card pl"><h4>Faustregeln</h4><p class="hint2" style="margin:0;line-height:1.5"><b>Runden:</b> Das Ergebnis nie genauer angeben als die ungenaueste Messung. Zwischenergebnisse mit 1 bis 2 Stellen mehr rechnen, erst das Endergebnis runden. Ab 5 wird aufgerundet.<br><b>Fehlerfortpflanzung (Faustregel):</b> Beim Malnehmen und Teilen addieren sich die Prozent-Fehler (a ± 1 % und b ± 2 % ergibt a·b ± 3 %). Bei der Potenz ² verdoppelt sich der Prozent-Fehler. Bei Summen und Differenzen addieren sich die absoluten Fehler (in mm).</p></div>`;
    updMess();
  }
  function updMess() {
    const E = S.mess, a = C.parseList(E.txt), s = C.stats(a, 3), o = $('#tOut');
    o.innerHTML = s ? `<table class="tt"><tr><td>Anzahl n</td><td class="n">${s.n}</td></tr><tr><td>Mittelwert x̄</td><td class="n">${esc(fmt(s.mean, 5))}</td></tr><tr><td>Median</td><td class="n">${esc(fmt(s.median, 5))}</td></tr><tr><td>Spannweite R</td><td class="n">${esc(fmt(s.range, 5))}</td></tr><tr><td>Standardabweichung s</td><td class="n">${s.stdev == null ? '–' : esc(fmt(s.stdev, 5))}</td></tr></table>${stp(s.steps)}` : hint('Bitte gib mindestens eine Zahl ein. Dezimalzahlen mit Komma, Trennung mit Leerzeichen.');
    const v = num(E.rv), n = +E.rn, r = isFinite(v) && v !== 0 ? C.roundSig(v, n) : NaN, sd = C.sigDigits(E.sc);
    $('#rOut').innerHTML = (isFinite(r) ? `<div class="rdout"><b>${esc(fmt(v, 10))}</b> auf ${n} signifikante Stellen: <b>${esc(fmt(r, 10))}</b></div>` : hint('Zahl (nicht 0) eingeben.')) + (isFinite(sd) ? `<div class="rdout"><b>${esc(E.sc)}</b> hat <b>${sd}</b> signifikante Stellen (führende Nullen zählen nicht, Nullen nach dem Komma zählen).</div>` : hint('Zahl zum Abzählen eingeben.'));
  }

  /* ============================================================ Beispiele (Aufruf ?bsp) */
  const BSP = D.beispiele;
  function renderBsp() {
    $('#v_bsp').innerHTML = '<div class="card pl"><h4>Beispiele</h4><p class="hint2" style="margin:0">Fertig durchgerechnete Beispiele, Schritt für Schritt. „Ausprobieren“ lädt die Zahlen in den passenden Reiter, dort kannst du sie ändern.</p></div>' +
      BSP.map((b, i) => `<div class="card pl"><h4>${esc(b.titel)}</h4><p style="margin:0 0 4px;line-height:1.45"><b>Aufgabe:</b> ${esc(b.aufgabe)}</p>${stp(b.steps)}<div class="rdout ok"><b>${esc(b.ergebnis)}</b></div><div class="btns"><button class="btn pri" data-bsp="${i}">Ausprobieren</button></div></div>`).join('');
  }
  function loadBsp(b) {
    const set = b.set, k = b.tab, tgt = S[k];
    if (k === 'umst') Object.assign(S.umst, { f: set.f, t: set.t, mode: 'zeig', step: 0, err: 0, vals: {} });
    else if (k === 'geo') Object.assign(S.geo, set, { sub: set.sub });
    else Object.assign(tgt, set);
    setTab(k); toast('Beispiel geladen: ' + b.titel);
  }

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
  const instOf = t => { const sd = S.seeds[t.id] || 0, i = S.inst[t.id]; if (i && i.seed === sd) return i; return (S.inst[t.id] = D.build(t, sd)); };
  const solText = p => fmt(p.value, Math.max(p.dec, 0)) + (p.unit ? ' ' + p.unit : '');
  const rdOf = (p, ok) => `<div class="rdout ${ok ? 'ok' : 'bad'}"><b>Lösungsweg</b>${stp(p.steps, true)}</div>`;

  /* Aufgabe + Eingabe (für Aufgaben und Trainer) */
  function probHTML(p, ans, res, ns) {
    const solved = !!(res && res.ok);
    return `<div class="lv">${dots(p.level)}</div><p style="margin:8px 0">${esc(p.text)}</p>${p.svg ? `<div class="svbox">${svgTri(p.svg)}</div>` : ''}
      <label class="f"><span>${esc(p.label)}${p.unit ? ' (' + esc(p.unit) + ')' : ''}</span><div class="qin"><input id="${ns}In" data-ans="${ns}" inputmode="decimal" autocomplete="off" value="${esc(ans || '')}" ${solved ? 'disabled' : ''}><span class="u">${esc(p.unit)}</span></div></label>`;
  }
  function givenText(p, v) { return fmt(v, 6) + (p.unit ? ' ' + p.unit : ''); }
  function checkTask(t) {
    const p = instOf(t), a = (S.tAns[t.id] || ''), v = C.parseDe(a); if (!isFinite(v)) { toast('Bitte gib eine Zahl ein (mit Komma oder Punkt).'); return; }
    const ok = Math.abs(v - p.value) <= p.tol + 1e-9, pct = ok ? pctFor(t.id) : 0, ex = exam();
    S.tRes = { id: t.id, ok, pct, text: ok ? 'Richtig: ' + givenText(p, v) : 'Deine Antwort „' + givenText(p, v) + '“ stimmt nicht.' };
    if (ok) { markSolved(t.id, pct); if (pct === 0) toast('Mit angezeigter Lösung zählt die Aufgabe im Prüfmodus nicht.'); else { const F = fx(); if (F && F.pass) try { F.pass(pct); } catch (e) {} else ding(); toast(ex && pct < 100 ? pct + ' % (Tipps abgezogen)' : '🎉 Geschafft!'); } } else { sad(); toast('Noch nicht richtig. Lies den Lösungsweg und versuche es noch einmal.'); }
    renderTasks(false);
  }
  function hintTask(t) {
    const p = instOf(t), h = lsGet('hints', {}), n = Math.min(3, (h[t.id] || 0) + 1), ex = exam();
    h[t.id] = Math.max(h[t.id] || 0, n); lsSet('hints', h);
    if (ex) { const c = lsGet('ctipps', {}); c[t.id] = Math.max(c[t.id] || 0, n); lsSet('ctipps', c); }
    sheet('Tipp, Stufe ' + n + ' von 3', b => {
      let x = `<p style="margin-top:0"><b>Stufe 1:</b> ${esc(p.tips[0])}</p>`;
      if (n >= 2) x += `<p><b>Stufe 2:</b> ${esc(p.tips[1])}</p>`;
      if (n >= 3) x += `<p><b>Stufe 3:</b> Die Lösung lautet <b>${esc(solText(p))}</b>.</p>`; else x += '<p class="hint2">Noch mehr Hilfe? Tippe noch einmal auf „Tipp“ für die nächste Stufe.</p>';
      x += ex ? '<p class="hint2" style="color:var(--warn)">Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte. Mit Stufe 3 zählt die Aufgabe nicht mehr.</p>' : '<p class="hint2">Beim normalen Üben kosten Tipps nichts. Im Prüfmodus (🎓) zählen sie.</p>';
      b.innerHTML = x;
    });
  }
  function renderTasks(top) {
    const V = $('#v_tasks'), d = done(), prog = lsGet('prog', {}), t = curTask(), n100 = TASKS.filter(x => d[x.id]).length; let h = '';
    if (t) {
      const p = instOf(t), r = S.tRes && S.tRes.id === t.id ? S.tRes : null;
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div>${probHTML(p, S.tAns[t.id], r, 'tk')}`;
      h += `<div class="btns"><button class="btn pri" data-ta="chk"${r && r.ok ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" data-ta="hint">💡 Tipp</button><button class="btn" data-ta="new">🔀 Neue Zahlen</button><button class="btn" data-ta="close">Schließen</button></div>`;
      if (exam()) h += '<p class="hint2" style="color:var(--warn)">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>';
      if (r) {
        h += `<ul class="tl"><li class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓' : '✗'} ${esc(r.text)}</li>${p.exact ? '' : `<li>ℹ Erlaubte Abweichung: ±${esc(fmt(p.tol, 6))} (Rundung).</li>`}</ul>`;
        if (r.ok || !exam()) h += (r.ok ? '' : `<div class="rdout bad"><b>Richtig wäre:</b> ${esc(solText(p))}</div>`) + rdOf(p, r.ok);
        else h += '<div class="rdout bad">🎓 Prüfmodus: Den Lösungsweg gibt es erst, wenn die Aufgabe richtig gelöst ist. Nutze einen Tipp oder versuche es noch einmal.</div>';
        if (r.ok) h += '<div class="btns"><button class="btn pri" data-ta="next">Nächste Aufgabe</button></div>';
      }
      h += '</div>';
    }
    h += `<p class="hint2" style="margin:4px 0 0">${n100} von ${TASKS.length} Aufgaben gelöst. ${exam() ? '🎓 Prüfmodus ist an.' : 'Tipp: Im Prüfmodus (🎓 oben) zählen Tipps als Abzug.'}</p>`;
    let last = '';
    D.cats.reduce((a, c) => a.concat(TASKS.filter(y => y.cat === c)), []).forEach(x => { if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; } const p = prog[x.id]; h += `<button class="row" data-t="${esc(x.id)}"><span class="dot ${d[x.id] ? 'g' : p > 0 ? 'p' : ''}">${d[x.id] ? '✓' : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${dots(x.level)}</span>${p != null && !d[x.id] ? ' · bisher ' + p + ' %' : ''}</small></div></button>`; });
    V.innerHTML = h; if (top !== false) $('#pg_tasks').scrollTop = 0;
  }
  function resetTipps(id) { const h = lsGet('hints', {}), c = lsGet('ctipps', {}); if (h[id]) { delete h[id]; lsSet('hints', h); } if (c[id]) { delete c[id]; lsSet('ctipps', c); } }
  function startTask(id, fresh) {
    S.task = id; S.tRes = null; S.tAns[id] = ''; if (fresh) S.seeds[id] = Math.floor(Math.random() * 1e9); resetTipps(id); renderTasks();
  }

  /* ============================================================ Zufalls-Trainer */
  function newTrainer() {
    const T = S.tr; let pool = TASKS.filter(t => (T.cat === 'alle' || t.cat === T.cat) && (!T.level || t.level === T.level)); if (!pool.length) pool = TASKS;
    const t = pool[Math.floor(Math.random() * pool.length)]; T.p = D.build(t, Math.floor(Math.random() * 1e9)); T.ans = ''; T.res = null; renderTrainer();
  }
  function renderTrainer() {
    const T = S.tr, V = $('#v_rt'); if (!T.p) { newTrainer(); return; }
    const st = S.rt, p = T.p, r = T.res;
    let h = `<div class="card pl"><h4>Zufalls-Trainer: unendlich viele Aufgaben</h4><div class="fbar">${seg('tr.cat', [['alle', 'Alle']].concat(D.cats.map(c => [c, c])), T.cat)}</div><div class="fbar">${seg('tr.level', [[0, 'alle Stufen'], [1, 'leicht'], [2, 'mittel'], [3, 'schwer']], T.level)}</div>
      <div class="stats"><div class="bx"><b>${st.streak}</b>Serie</div><div class="bx"><b>${st.best}</b>Beste Serie</div><div class="bx"><b>${st.ok}/${st.n}</b>Richtig</div></div>
      <div class="hint2" style="margin:0">${esc(p.cat)} · ${esc(p.title)}</div>${probHTML(p, T.ans, r, 'rt')}`;
    h += r ? '<div class="btns"><button class="btn pri" data-r="next">Nächste Aufgabe</button></div>' : '<div class="btns"><button class="btn pri" data-r="chk">✓ Prüfen</button><button class="btn" data-r="show">Lösung zeigen</button></div>';
    if (r) h += `<div class="fb ${r.ok ? 'ok' : 'bad'}"><span class="v">${r.shown ? 'Lösung: ' + esc(solText(p)) + ' (zählt als Fehler, Serie beginnt neu)' : r.ok ? '✓ Richtig! Serie: ' + st.streak : '✗ Nicht ganz. Richtig ist: ' + esc(solText(p))}</span></div>${rdOf(p, r.ok)}`;
    V.innerHTML = h + '</div>';
  }
  function trainerResult(ok, shown) {
    const T = S.tr, st = S.rt; st.n++; if (ok && !shown) { st.ok++; st.streak++; st.best = Math.max(st.best, st.streak); } else st.streak = 0; lsSet('rt', st);
    T.res = { ok: ok && !shown, shown }; if (ok && !shown) ding(); else sad(); renderTrainer(); updatePal();
    if (ok && !shown && st.streak > 0 && st.streak % 5 === 0) { toast('🔥 ' + st.streak + ' richtige in Folge!'); const F = fx(); if (F && F.pass) try { F.pass(100); } catch (e) {} }
  }
  function checkTrainer() { const T = S.tr, v = C.parseDe(T.ans); if (!isFinite(v)) { toast('Bitte gib eine Zahl ein.'); return; } trainerResult(Math.abs(v - T.p.value) <= T.p.tol + 1e-9, false); }

  /* ============================================================ Hilfe */
  function renderHelp() {
    const mk = (o) => '<table><tr><th>Vorsatz</th><th>Zeichen</th><th>Faktor</th></tr>' + o.map(p => `<tr><td>${esc(p.n)}</td><td><b>${esc(p.s)}</b></td><td>10${C.sup(p.e)} = ${esc(fmt(Math.pow(10, p.e), 12))}</td></tr>`).join('') + '</table>';
    const sh = Object.keys(C.SHAPES).map(k => { const s = C.SHAPES[k]; return `<tr><td>${esc(s.name)}</td><td>${s.o.map(o => `${esc(o[0])} = ${esc(C.pretty(o[2]))}`).join('<br>')}</td></tr>`; }).join('');
    $('#v_help').innerHTML = `
    <details open><summary>🔢 Vorsätze und Zehnerpotenzen</summary><div class="hb2">${mk(C.PREFIX)}
      <p>Größere Einheit → kleinere Einheit: Zahl wird <b>größer</b> (mal Umrechnungszahl). Kleinere → größere Einheit: Zahl wird <b>kleiner</b> (geteilt).</p>
      <table><tr><th>Größe</th><th>Umrechnungszahlen</th></tr><tr><td>Länge</td><td>1 km = 1000 m, 1 m = 100 cm = 1000 mm, 1 mm = 1000 µm</td></tr><tr><td>Fläche</td><td>1 m² = 100 dm² = 10 000 cm² = 1 000 000 mm² (je Stufe 100)</td></tr><tr><td>Volumen</td><td>1 m³ = 1000 dm³, 1 dm³ = 1 l = 1000 cm³, 1 cm³ = 1 ml (je Stufe 1000)</td></tr><tr><td>Masse</td><td>1 t = 1000 kg, 1 kg = 1000 g, 1 g = 1000 mg</td></tr><tr><td>Zeit</td><td>1 h = 60 min = 3600 s</td></tr><tr><td>Geschwindigkeit</td><td>1 m/s = 3,6 km/h</td></tr><tr><td>Druck</td><td>1 bar = 100 000 Pa = 10 N/cm², 1 N/mm² = 1 MPa = 10 bar</td></tr><tr><td>Leistung</td><td>1 kW = 1000 W, 1 MW = 1000 kW</td></tr></table>
      <span class="eq">x = m · 10ⁿ mit 1 ≤ m &lt; 10 (wissenschaftlich)</span></div></details>
    <details><summary>⚖️ Dreisatz, Verhältnis, Maßstab</summary><div class="hb2"><p><b>Direkt</b> (je mehr, desto mehr): auf 1 schließen mit <b>÷</b>, dann hochrechnen mit <b>·</b>.</p><p><b>Indirekt</b> (je mehr, desto weniger): auf 1 schließen mit <b>·</b>, dann aufteilen mit <b>÷</b>.</p>
      <table class="sch"><tr><td>a Stück</td><td class="ar">→</td><td>b Euro</td></tr><tr><td>1 Stück</td><td class="ar">→</td><td>b ÷ a</td></tr><tr class="key"><td>x Stück</td><td class="ar">→</td><td>b ÷ a · x</td></tr></table>
      <p>Mischung 1 : 4 = 5 Teile insgesamt. Maßstab 1 : 50: Wirklichkeit = Zeichnung · 50. Maßstab 5 : 1: Wirklichkeit = Zeichnung ÷ 5.</p></div></details>
    <details><summary>％ Prozent, Promille, Zinsen</summary><div class="hb2"><span class="eq">W = G · p / 100  ·  p = W / G · 100 %  ·  G = W · 100 / p</span><span class="eq">vermehrt: G · (1 + p/100)  ·  vermindert: G · (1 − p/100)</span><span class="eq">Brutto = Netto · 1,19 (19 %) bzw. · 1,07 (7 %)  ·  Netto = Brutto / 1,19</span><span class="eq">Skonto: Zahlbetrag = Rechnung · (1 − p/100)  ·  Promille: 1 ‰ = 1/1000</span><span class="eq">Zinsen Z = K · p/100 · t/360 (t in Tagen)</span><p>Ein vermehrter Wert ist 100 % + p %, dieser Wert wird durch (1 + p/100) geteilt, nicht um p % gekürzt.</p></div></details>
    <details><summary>🔁 Formeln umstellen</summary><div class="hb2"><p>Auf beiden Seiten das Gleiche tun. Mit der Umkehrung auflösen: Mal ↔ Geteilt, Plus ↔ Minus, Quadrat ↔ Wurzel. Zuerst nach der gesuchten Größe umstellen, dann Zahlen einsetzen.</p>
      <table><tr><th>Formel</th><th>Name</th></tr>${C.FORMELN.map(f => `<tr><td>${esc(C.pretty(f.eq))}</td><td>${esc(f.name)}: ${Object.keys(f.vars).map(v => esc(C.pretty(v)) + ' ' + esc(f.vars[v][0]) + ' [' + esc(f.vars[v][1]) + ']').join(', ')}</td></tr>`).join('')}</table></div></details>
    <details><summary>📐 Geometrie</summary><div class="hb2"><table><tr><th>Form</th><th>Formeln</th></tr>${sh}</table><span class="eq">Masse m = Dichte ρ · Volumen V</span><span class="eq">Pythagoras: a² + b² = c²  (c = Hypotenuse, gegenüber vom rechten Winkel)</span></div></details>
    <details><summary>📐 Winkelfunktionen (sin, cos, tan)</summary><div class="hb2"><div class="svbox">${svgTri({ a: 'a Gegenkathete', b: 'b Ankathete', c: 'c Hypotenuse', al: 'α' }, 35)}</div>
      <span class="eq">sin α = Gegenkathete / Hypotenuse = a / c</span><span class="eq">cos α = Ankathete / Hypotenuse = b / c</span><span class="eq">tan α = Gegenkathete / Ankathete = a / b</span><p>Winkel gesucht: Umkehrfunktion (sin⁻¹, cos⁻¹, tan⁻¹ am Taschenrechner). Winkelsumme: α + β + 90° = 180°. Taschenrechner auf <b>DEG</b> (Grad) stellen.</p></div></details>
    <details><summary>📊 Messwerte und Runden</summary><div class="hb2"><span class="eq">Mittelwert x̄ = Summe / n</span><span class="eq">Median = mittlerer Wert der sortierten Liste</span><span class="eq">Spannweite R = x(max) − x(min)</span><span class="eq">s = √( Σ(x − x̄)² / (n − 1) )</span><p>Signifikante Stellen: alle Ziffern ab der ersten, die nicht 0 ist (0,0250 hat 3). Bei Malnehmen und Teilen addieren sich die Prozent-Fehler (Faustregel).</p></div></details>`;
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  const RENDER = { einh: renderEinh, drei: renderDrei, proz: renderProz, umst: renderUmst, geo: renderGeo, mess: renderMess, bsp: renderBsp, tasks: renderTasks, rt: renderTrainer, help: renderHelp };
  const UPD = { einh: updEinh, drei: updDrei, proz: updProz, umst: updUmst, geo: updGeo, mess: updMess };
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'einh'; S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.pg').forEach(p => { p.style.display = p.dataset.tab === t ? 'flex' : 'none'; });
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    RENDER[t](); const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'Rechen-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = 'Rechen-Lab: ' + T[2];
  }
  function setExam(on) { lsSet('exam', on ? '1' : '0'); palSig = ''; updatePal(); $('#bExam').classList.toggle('on', on); $('#bExam').setAttribute('aria-pressed', on); toast(on ? '🎓 Prüfmodus an: Tipps kosten 25 % je Stufe.' : 'Prüfmodus aus: Tipps kosten nichts.'); if (S.tab === 'tasks') renderTasks(false); }
  let palSig = '';
  function updatePal() {
    const F = !!fx(), fxOn = F && !fx().isMuted(), n = Object.keys(done()).filter(k => TASKS.some(t => t.id === k)).length, sig = [F, fxOn, exam(), n, S.rt.streak, S.rt.best].join('|'); if (sig === palSig) return; palSig = sig;
    $('#pal').innerHTML = `${F ? `<button class="chip ${fxOn ? 'on' : ''}" data-a="fx" aria-pressed="${fxOn}" title="Effekte und Ton">${fxOn ? '🎉' : '🔇'} Effekte</button>` : ''}<button class="chip ${exam() ? 'on' : ''}" data-a="exam" aria-pressed="${exam()}" title="Prüfmodus: Tipps zählen als Abzug">🎓 Prüfmodus</button><button class="chip" data-a="rand" title="Zufällige Aufgabe im Trainer">🎲 Zufallsaufgabe</button>
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
  $('#title').onclick = () => setTab('einh');
  $('#bMenu').onclick = () => {
    const rows = [['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung, Lösungsweg und Tipps'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Aufgaben mit Serien-Zähler'], ['bsp', 'Beispiele', 'Durchgerechnete Beispiele zum Nachvollziehen'], ['help', 'Hilfe und Spickzettel', 'Vorsätze, Formeln, Dreisatz, Winkelfunktionen'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben und Trainer-Serie auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
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
      b.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (!x) return; if (x.dataset.x === 'yes') { ['done', 'prog', 'hints', 'ctipps', 'rt'].forEach(k => { try { localStorage.removeItem(LS + k); } catch (er) {} }); S.rt = { n: 0, ok: 0, streak: 0, best: 0 }; S.task = null; S.tRes = null; palSig = ''; updatePal(); updateBadge(); if (S.tab === 'tasks') renderTasks(); toast('Fortschritt gelöscht'); } close(); });
    });
  }

  /* ============================================================ Ereignisse (alle Reiter) */
  function setPath(key, val) { const p = key.split('.'); let o = S[p[0]]; for (let i = 1; i < p.length - 1; i++) o = o[p[i]]; o[p[p.length - 1]] = val; }
  function onField(e) {
    const el = e.target;
    if (el.dataset.ans) { if (el.dataset.ans === 'tk') { const t = curTask(); if (t) S.tAns[t.id] = el.value; } else S.tr.ans = el.value; return; }
    const k = el.dataset.s; if (!k) return; setPath(k, el.value);
    const g = k.split('.')[0]; if (el.dataset.r) { if (g === 'umst') { S.umst.step = 0; S.umst.err = 0; S.umst.vals = {}; if (k === 'umst.f') S.umst.t = ''; } RENDER[g](); } else if (UPD[g]) UPD[g]();
  }
  document.addEventListener('input', onField); document.addEventListener('change', e => { if (e.target.tagName === 'SELECT') onField(e); });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || !e.target.dataset || !e.target.dataset.ans) return; e.preventDefault();
    if (e.target.dataset.ans === 'tk') { const t = curTask(); if (t && !(S.tRes && S.tRes.id === t.id && S.tRes.ok)) checkTask(t); } else if (S.tr.res) newTrainer(); else checkTrainer();
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.closest('#tabs,#pal,header,.backdrop')) return; const ds = b.dataset;
    if (ds.seg) { const [g, f] = ds.seg.split('.'); S[g][f] = f === 'level' ? +ds.v : ds.v; if (g === 'umst') { S.umst.step = 0; S.umst.err = 0; } if (g === 'tr') { newTrainer(); return; } RENDER[g](); return; }
    if (ds.fam) { S.einh.fam = ds.fam; [S.einh.from, S.einh.to] = DEF[ds.fam]; renderEinh(); return; }
    if (ds.act === 'swap') { const E = S.einh; [E.from, E.to] = [E.to, E.from]; renderEinh(); return; }
    if (ds.ut) { S.umst.t = ds.ut; S.umst.step = 0; S.umst.err = 0; S.umst.vals = {}; renderUmst(); return; }
    if (ds.uop != null) { const u = C.umformung(S.umst.f, S.umst.t), st = u.steps[S.umst.step]; if (ds.uop === st.op) { S.umst.step++; ding(); } else { S.umst.err++; sad(); toast('Das ist nicht die passende Umkehrung. Was hebt die Rechenart auf?'); } renderUmst(); return; }
    if (ds.act === 'uagain') { S.umst.step = 0; S.umst.err = 0; renderUmst(); return; }
    if (ds.bsp != null && BSP[+ds.bsp]) { loadBsp(BSP[+ds.bsp]); return; }
    if (ds.r) { if (ds.r === 'chk') checkTrainer(); else if (ds.r === 'show') trainerResult(false, true); else if (ds.r === 'next') newTrainer(); return; }
    const t = curTask();
    if (ds.ta && t) { const a = ds.ta; if (a === 'chk') checkTask(t); else if (a === 'hint') hintTask(t); else if (a === 'new') startTask(t.id, true); else if (a === 'close') { S.task = null; S.tRes = null; renderTasks(); } else if (a === 'next') { const i = TASKS.findIndex(x => x.id === t.id), nx = TASKS.slice(i + 1).find(x => !done()[x.id]) || TASKS[(i + 1) % TASKS.length]; startTask(nx.id); } return; }
    const row = b.closest('.row[data-t]'); if (row && S.tab === 'tasks') startTask(row.dataset.t);
  });

  /* Schnittstelle für Karriere/Lernpfad */
  root.MAT_LAB = { id: 'mat', title: 'Rechen-Lab', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.MAT_TASKS };

  buildTabs(); updatePal();
  /* Aufruf ?aufgabe=mat1 (Startseite, Lernhefte): Aufgabe gleich öffnen; ?bsp: Beispielauswahl zeigen */
  let start = S.tab, openId = null;
  try { const q = new URLSearchParams(location.search), qa = q.get('aufgabe'); if (qa && TASKS.some(t => t.id === qa)) { start = 'tasks'; openId = qa; } else if (q.has('bsp')) start = 'bsp'; } catch (e) {}
  setTab(start); if (openId) startTask(openId);
})(typeof window !== 'undefined' ? window : globalThis);
