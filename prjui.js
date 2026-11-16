'use strict';
/* Tonfunk Projekt-und-Wirtschaftlichkeits-Lab: Oberfläche (Lab-Kennung 'prj', Präfix lm4.prj.).
   Reiter: sechs Blöcke (Lastenheft, Planung, Kosten, Wirtschaft, Risiko, Bericht) mit Erklärung und Werkstatt, Aufgaben (?aufgabe=prj1), Hilfe.
   Module: prjcore.js (PRJ_CORE), prjdata.js (PRJ_DATA, PRJ_TASKS), prjviz.js (PRJ_VIZ, SVG).
   Die Bausteine (PARTS, FIG, Aufgaben-HTML) sind reine Funktionen des Zustands und laufen auch in Node (quelle/prj/test_prjui.js); ohne document wird nur exportiert.
   Speicher (lm4.prj.): tab, tool (Werkstatt-Eingaben), done ({id:true}), prog ({id:Prozent}), hints, ctipps (nur Prüfmodus), exam ('1'), chk (Checkliste).
   Prüfmodus: jede der 3 Tipp-Stufen kostet 20 % der Punkte; beim normalen Üben kosten Tipps nichts. */
(function (root) {
  const C = root.PRJ_CORE, D = root.PRJ_DATA, V = root.PRJ_VIZ;
  const HAS_DOM = typeof document !== 'undefined' && !!document.getElementById && !!document.getElementById('app');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.prj.';
  const mem = {};
  const lsGet = (k, d) => { try { const v = JSON.parse((HAS_DOM ? localStorage.getItem(LS + k) : mem[k]) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { if (HAS_DOM) localStorage.setItem(LS + k, JSON.stringify(v)); else mem[k] = JSON.stringify(v); } catch (e) {} };
  const N = (v, d) => C.fmtN(v, d == null ? 2 : d), E = (v, d) => C.eur(v, d == null ? 2 : d);
  const dots = l => '●'.repeat(l || 1) + '○'.repeat(3 - (l || 1));
  const TABS = D.BLOCKS.map(b => [b.id, b.icon, b.short]).concat([['tasks', '📝', 'Aufgaben'], ['help', '📘', 'Hilfe']]);

  /* ============================================================ Zustand (Werkstatt) */
  const A0 = (a) => a.map(x => ({ id: x[0], name: x[1], d: String(x[2]), pre: x[3].join(', ') }));
  const DEF = () => ({
    lh: { txt: 'Das Gerät muss schnell starten.', filter: 'alle', av: '99.9' },
    np: { preset: 'geraet', acts: A0(D.NET_PRESETS[0].acts), view: 'netz' },
    ko: { be: { p: '25', kv: '15', kfix: '12000', x: '1500', gz: '3000' }, st: { jb: '48000', lnk: '22', soll: '1720', prod: '80', gk: '30', gw: '10' },
      ang: { pos: [{ n: 'Entwicklung', h: '100', s: '62' }, { n: 'Test', h: '40', s: '54' }, { n: 'Dokumentation', h: '20', s: '48' }], mat: '2000', fremd: '800', mgk: '10', wag: '5', gw: '8', sko: '2', ust: '19' },
      pert: [{ n: 'Entwurf', a: '3', m: '5', b: '9' }, { n: 'Aufbau', a: '4', m: '6', b: '12' }, { n: 'Test', a: '2', m: '3', b: '7' }] },
    iv: { mode: 'single', i: '6', A: { I: String(D.INV_PRESET.A.I), ue: String(D.INV_PRESET.A.ue), n: String(D.INV_PRESET.A.n), rest: String(D.INV_PRESET.A.rest) }, B: { I: String(D.INV_PRESET.B.I), ue: String(D.INV_PRESET.B.ue), n: String(D.INV_PRESET.B.n), rest: String(D.INV_PRESET.B.rest) }, own: '' },
    rq: { sub: 'matrix', risks: D.RISK_PRESET.map(r => ({ n: r.name, p: String(r.p), s: String(r.s) })), fmea: D.FMEA_PRESET.map(r => ({ n: r.name, b: String(r.b), a: String(r.a), e: String(r.e) })), gr: '100', par: D.PARETO_PRESET.map(r => ({ n: r.label, v: String(r.v) })), ew: [{ n: 'Lieferverzug', p: '20', l: '12000' }, { n: 'Prüfplatz fällt aus', p: '10', l: '8000' }, { n: 'Normänderung', p: '5', l: '40000' }] },
    pb: { total: '30', w: D.PB_CHAPTERS.map(c => String(c.w)), z: { quelle: 'Beispielinstitut', jahr: '2020', seite: '14', art: 'sinn', titel: 'Leitfaden Projektarbeit', ort: 'Berlin' } }
  });
  const merge = (d, s) => { if (s == null) return d; if (Array.isArray(d)) return Array.isArray(s) && s.length ? s : d; if (d && typeof d === 'object') { const o = {}; Object.keys(d).forEach(k => { o[k] = merge(d[k], s[k]); }); return o; } return typeof s === typeof d ? s : d; };
  const S = { tab: 'lh', tool: merge(DEF(), lsGet('tool', null)), t: null, tv: {}, chk: lsGet('chk', {}), rt: lsGet('rt', { n: 0, ok: 0 }) };
  const saveTool = () => lsSet('tool', S.tool);
  const getP = p => p.split('.').reduce((o, k) => (o == null ? o : o[k]), S.tool);
  const setP = (p, v) => { const a = p.split('.'); let o = S.tool; for (let i = 0; i < a.length - 1; i++) o = o[a[i]]; o[a[a.length - 1]] = v; };
  const P = p => C.parseDe(getP(p));

  /* ============================================================ Eingabebausteine */
  const inp = (path, label, unit, extra) => `<label class="f"><span>${esc(label)}</span><div class="qin"><input data-s="${path}" inputmode="decimal" autocomplete="off" value="${esc(getP(path))}"${extra || ''}><span class="u">${esc(unit || '')}</span></div></label>`;
  const slide = (path, label, unit, min, max, step) => `<div class="sl"><div class="slh"><span>${esc(label)}</span><div class="qin"><input data-s="${path}" inputmode="decimal" autocomplete="off" value="${esc(getP(path))}" aria-label="${esc(label)}"><span class="u">${esc(unit || '')}</span></div></div><input type="range" data-s="${path}" min="${min}" max="${max}" step="${step}" value="${esc(getP(path))}" aria-label="${esc(label)} (Regler)"></div>`;
  const chips = (path, list, cur) => `<div class="fbar" role="group">${list.map(([v, l]) => `<button class="chip${String(cur) === String(v) ? ' on' : ''}" data-a="set" data-s="${path}" data-v="${esc(v)}" aria-pressed="${String(cur) === String(v)}">${l}</button>`).join('')}</div>`;
  const kp = (label, val, cls) => `<div class="kp${cls ? ' ' + cls : ''}"><small>${esc(label)}</small><b>${val}</b></div>`;
  const rd = (cls, h) => `<div class="rdout${cls ? ' ' + cls : ''}">${h}</div>`;
  const bad = msg => rd('bad', '<b>Eingabe prüfen:</b> ' + esc(msg));
  const fig = (vz, extra) => `<div class="fig" data-vz="${vz}"${extra || ''}></div>`;
  const numsOK = (...a) => a.every(x => typeof x === 'number' && isFinite(x));

  /* ============================================================ Bausteine je Block (PARTS: html = ganzer Körper, out = nur der Ergebnisbereich) */
  const PARTS = {};
  const part = (id, title, html, out) => { PARTS[id] = { id, title, html, out }; };
  const body = (id, extra) => (extra || '') + '<div data-out>' + (PARTS[id].out ? PARTS[id].out() : '') + '</div>';

  /* ---------- Lastenheft ---------- */
  part('lhFlow', 'Vom Lastenheft zur Abnahme', () => fig('lhflow') + '<p class="hint2">Das Lastenheft sagt, <b>was</b> gebraucht wird. Das Pflichtenheft sagt, <b>wie</b> es umgesetzt wird. Am Ende wird gegen die Anforderungen geprüft.</p>');
  part('lhGl', 'Gliederung: was steht wo?', () => chips('lh.filter', [['alle', 'Alle'], ['LH', 'Lastenheft'], ['PH', 'Pflichtenheft'], ['beide', 'Beide']], S.tool.lh.filter) + '<div data-out>' + PARTS.lhGl.out() + '</div>', () => {
    const f = S.tool.lh.filter, L = D.LH_GLIED.filter(g => f === 'alle' || g.doc === f), nm = { LH: 'Lastenheft', PH: 'Pflichtenheft', beide: 'beide' };
    return L.map(g => `<div class="glr"><span class="badge ${g.doc}">${nm[g.doc]}</span><div><b>${esc(g.n)}</b><small>${esc(g.t)}</small></div></div>`).join('');
  });
  const LH_EX = [['Das Gerät muss schnell starten.', 'schlecht'], ['Das Gerät muss nach dem Einschalten in höchstens 3 s den ersten Messwert anzeigen.', 'gut'], ['Die Bedienung soll benutzerfreundlich sein.', 'schlecht'], ['Ein Testnutzer ohne Vorkenntnisse muss die Aufgabe „Messwert exportieren“ in höchstens 5 Schritten abschließen.', 'gut']];
  part('lhPr', 'Anforderungs-Prüfer', () => `<p class="hint2" style="margin-top:0">Schreibe eine Anforderung. Der Prüfer sucht nach unscharfen Wörtern, fehlender Verbindlichkeit und fehlenden Zahlen. Er arbeitet mit Faustregeln und ersetzt kein Gegenlesen.</p><label class="f"><span>Deine Anforderung</span><textarea data-s="lh.txt" rows="3" aria-label="Anforderung">${esc(S.tool.lh.txt)}</textarea></label><div class="fbar">${LH_EX.map((e, k) => `<button class="chip" data-a="lhex" data-i="${k}">${e[1] === 'gut' ? '✓ ' : '✗ '}Beispiel ${k + 1}</button>`).join('')}</div><div data-out>${PARTS.lhPr.out()}</div>`, () => {
    const a = C.analyseAnf(S.tool.lh.txt);
    if (a.empty) return rd('', 'Noch keine Anforderung eingegeben.');
    if (a.ok) return rd('ok', '<b>Sieht prüfbar aus.</b> Keine unscharfen Wörter, verbindliches Wort und Zahl sind vorhanden.' + a.flags.map(f => `<div class="flag"><b>Hinweis:</b><span>${esc(f.txt)}</span></div>`).join('') + '<p class="hint2">Prüfe selbst noch: Ist der Bezug klar (wovon, unter welcher Bedingung, womit gemessen)?</p>');
    return rd('bad', '<b>Noch nicht prüfbar.</b>' + a.flags.map(f => `<div class="flag"><b>${f.hard ? '✗' : '!'}</b><span>${esc(f.txt)}</span></div>`).join(''));
  });
  part('lhAv', 'Verfügbarkeit in Ausfallzeit umrechnen', () => `<p class="hint2" style="margin-top:0">„Hohe Verfügbarkeit“ ist keine Anforderung. Mit einer Zahl wird sie prüfbar: Ausfallzeit = (1 − V) · 8760 h.</p>${chips('lh.av', [['99', '99 %'], ['99.5', '99,5 %'], ['99.9', '99,9 %'], ['99.95', '99,95 %'], ['99.99', '99,99 %']], S.tool.lh.av)}<div data-out>${PARTS.lhAv.out()}</div>`, () => {
    const v = parseFloat(S.tool.lh.av), a = C.ausfall(v); if (!a.ok) return bad(a.err);
    return `<div class="kpis">${kp('Verfügbarkeit', N(v, 2) + ' %')}${kp('Ausfall je Jahr', N(a.hJahr, 2) + ' h', 'warn')}${kp('Ausfall je Monat', N(a.minMonat, 1) + ' min')}${kp('Ausfall je Jahr', N(a.minJahr, 0) + ' min')}</div>`;
  });

  /* ---------- Netzplan ---------- */
  const netActs = () => S.tool.np.acts.map(a => ({ id: a.id, name: a.name, d: C.parseDe(a.d), pre: C.splitPre(a.pre) }));
  const netView = [['netz', 'Netzplan'], ['gantt', 'Gantt'], ['wege', 'Wege'], ['tab', 'Tabelle']];
  function npOut() {
    const acts = netActs(), badD = acts.find(a => !isFinite(a.d) || a.d < 0);
    if (badD) return bad('Die Dauer von Vorgang ' + badD.id + ' muss eine Zahl ab 0 sein.');
    const res = C.cpm(acts); if (!res.ok) return bad(res.err);
    const ms = res.list.filter(o => o.d === 0).length, view = S.tool.np.view;
    let h = `<div class="kpis">${kp('Projektdauer', N(res.duration) + ' AT')}${kp('Kritische Vorgänge', res.critical.length + ' von ' + res.list.length, 'warn')}${kp('Kritischer Pfad', esc(res.paths.length ? res.paths.map(p => p.join('→')).join(' | ') + (res.pathsCapped ? ' …' : '') : '–'))}${kp('Meilensteine', String(ms))}</div>`;
    h += chips('np.view', netView, view);
    if (view === 'netz') h += `<div class="scrollx" tabindex="0" aria-label="Netzplan, seitlich scrollbar">${V.netzplan(res, { uid: 'np' }).svg}</div><div class="legend"><span>Oben: FAZ · Dauer · FEZ</span><span>Unten: SAZ · Gesamtpuffer · SEZ</span><span><i class="l-crit"></i>kritisch</span><span>◆ Meilenstein</span></div>`;
    else if (view === 'gantt') h += fig('gantt') + '<div class="legend"><span><i class="l-crit"></i>kritisch</span><span><i class="l-acc"></i>Vorgang</span><span><i class="l-buf"></i>Gesamtpuffer</span><span>◆ Meilenstein</span></div>';
    else if (view === 'wege') { const ap = C.allPaths(res); h += `<table class="t"><tr><th>Weg</th><th class="v">Länge</th></tr>${ap.paths.map(p => `<tr class="${Math.abs(p.len - res.duration) < 1e-9 ? 'crit' : ''}"><td>${esc(p.ids.join(' → '))}</td><td class="v">${N(p.len)} AT</td></tr>`).join('')}</table><p class="hint2">Der längste Weg ist der kritische Pfad.${ap.capped ? ' Es werden nur die ersten Wege angezeigt.' : ''}</p>`; }
    else h += `<div class="scrollx" tabindex="0"><table class="t"><tr><th>Vorgang</th><th class="v">Dauer</th><th class="v">FAZ</th><th class="v">FEZ</th><th class="v">SAZ</th><th class="v">SEZ</th><th class="v">GP</th><th class="v">FP</th></tr>${res.list.map(o => `<tr class="${o.crit ? 'crit' : ''}"><td>${esc(o.id)} ${esc(o.name)}</td><td class="v">${N(o.d)}</td><td class="v">${N(o.es)}</td><td class="v">${N(o.ef)}</td><td class="v">${N(o.ls)}</td><td class="v">${N(o.lf)}</td><td class="v">${N(o.gp)}</td><td class="v">${N(o.fp)}</td></tr>`).join('')}</table></div>`;
    return h;
  }
  const nextId = () => { const used = new Set(S.tool.np.acts.map(a => a.id)); for (const c of 'ABCDEFGHIJKL') if (!used.has(c)) return c; return null; };
  part('np', 'Netzplan-Werkstatt: Dauern ändern, Wirkung sehen', () => {
    const np = S.tool.np;
    return `<p class="hint2" style="margin-top:0">Wähle ein Beispielprojekt oder baue ein eigenes. Trage bei „Vorgänger“ die Kennungen ein (z. B. <b>A, B</b>). Dauer 0 ergibt einen Meilenstein. Ändere eine Dauer und beobachte den kritischen Pfad.</p>
    <div class="fbar">${D.NET_PRESETS.map(p => `<button class="chip${np.preset === p.id ? ' on' : ''}" data-a="nppre" data-v="${p.id}" aria-pressed="${np.preset === p.id}">${esc(p.name)}</button>`).join('')}</div>
    <div class="acts">${np.acts.map((a, i) => `<div class="act"><span class="aid">${esc(a.id)}</span><input class="aname" data-s="np.acts.${i}.name" value="${esc(a.name)}" aria-label="Name von Vorgang ${esc(a.id)}"><button class="ib2" data-a="npdel" data-i="${i}" aria-label="Vorgang ${esc(a.id)} löschen">✕</button>
      <div class="astep"><button class="ib2" data-a="npdm" data-i="${i}" data-d="-1" aria-label="Dauer von ${esc(a.id)} um 1 verringern">−</button><input data-s="np.acts.${i}.d" inputmode="decimal" value="${esc(a.d)}" aria-label="Dauer von ${esc(a.id)} in Arbeitstagen"><button class="ib2" data-a="npdm" data-i="${i}" data-d="1" aria-label="Dauer von ${esc(a.id)} um 1 erhöhen">+</button><span class="u">AT</span>
      <label class="apre"><span>Vorgänger</span><input data-s="np.acts.${i}.pre" value="${esc(a.pre)}" placeholder="z. B. A, B" aria-label="Vorgänger von ${esc(a.id)}"></label></div></div>`).join('')}</div>
    <div class="btns"><button class="btn" data-a="npadd"${nextId() ? '' : ' disabled'}>＋ Vorgang</button></div><div data-out>${npOut()}</div>`;
  }, npOut);

  /* ---------- Kosten ---------- */
  part('be', 'Break-even-Grafik', () => `${slide('ko.be.p', 'Preis je Stück', '€', 1, 200, 1)}${slide('ko.be.kv', 'Variable Kosten je Stück', '€', 0, 200, 1)}${slide('ko.be.kfix', 'Fixkosten', '€', 0, 100000, 500)}${slide('ko.be.x', 'Geplante Menge', 'Stück', 0, 10000, 50)}${slide('ko.be.gz', 'Zielgewinn (optional)', '€', 0, 50000, 500)}<div data-out>${PARTS.be.out()}</div>`, () => {
    const b = S.tool.ko.be, p = { p: C.parseDe(b.p), kv: C.parseDe(b.kv), kfix: C.parseDe(b.kfix), x: C.parseDe(b.x), gz: C.parseDe(b.gz) };
    if (!numsOK(p.p, p.kv, p.kfix, p.x, p.gz) || p.p < 0 || p.kv < 0 || p.kfix < 0 || p.x < 0) return bad('Alle Werte müssen Zahlen ab 0 sein.');
    const d = C.db(p);
    let h = `<div class="kpis">${kp('Deckungsbeitrag je Stück', E(d.dbs), d.dbs > 0 ? '' : 'bad')}${kp('DB-Quote', N(d.quote, 1) + ' %')}${d.noBE ? kp('Break-even', 'nicht erreichbar', 'bad') : kp('Break-even-Menge', N(d.be, 1) + ' Stück', 'ok') + kp('Break-even-Umsatz', E(d.beUmsatz, 0)) + kp('Menge für Zielgewinn', d.zielUp + ' Stück')}${kp('Gewinn bei Plan', E(d.gewinn, 0), d.gewinn >= 0 ? 'ok' : 'bad')}${d.noBE || !(d.x > 0) ? '' : kp('Sicherheitsabstand', N(d.sicher, 1) + ' %', d.sicher >= 0 ? '' : 'bad')}</div>`;
    h += fig('be') + '<div class="legend"><span><i class="l-acc"></i>Erlös</span><span><i class="l-crit"></i>Gesamtkosten</span><span>gestrichelt: Fixkosten</span></div>';
    if (d.noBE) h += rd('bad', 'Der Preis deckt die variablen Kosten nicht. Jedes verkaufte Stück vergrößert den Verlust: Senke die variablen Kosten oder erhöhe den Preis.');
    else h += rd('', 'Links vom Schnittpunkt (rote Fläche) macht das Produkt Verlust, rechts (grüne Fläche) Gewinn. Ein höherer Preis oder niedrigere variable Kosten verschieben den Schnittpunkt nach links, höhere Fixkosten nach rechts.');
    return h;
  });
  part('st', 'Stundensatz berechnen', () => `<div class="fld">${inp('ko.st.jb', 'Jahresbrutto', '€')}${inp('ko.st.lnk', 'Lohnnebenkosten', '%')}${inp('ko.st.soll', 'Sollstunden je Jahr', 'h')}${inp('ko.st.prod', 'Produktiver Anteil', '%')}${inp('ko.st.gk', 'Gemeinkostenzuschlag', '%')}${inp('ko.st.gw', 'Gewinnzuschlag', '%')}</div><div data-out>${PARTS.st.out()}</div>`, () => {
    const s = S.tool.ko.st, r = C.stundensatz({ jb: C.parseDe(s.jb), lnk: C.parseDe(s.lnk), soll: C.parseDe(s.soll), prod: C.parseDe(s.prod), gk: C.parseDe(s.gk), gw: C.parseDe(s.gw) }); if (!r.ok) return bad(r.err);
    return `<table class="t">${r.rows.map(x => `<tr class="${x.k === 'vs' ? 'sum' : ''}"><td>${esc(x.label)}<small>${esc(x.calc)}</small></td><td class="v">${x.u === '€' ? E(x.v) : N(x.v, x.u === 'h' ? 1 : 2) + ' ' + esc(x.u)}</td></tr>`).join('')}</table>`;
  });
  const angParams = () => { const a = S.tool.ko.ang; return { pos: a.pos.map(x => ({ label: x.n, h: C.parseDe(x.h), satz: C.parseDe(x.s) })), mat: C.parseDe(a.mat), fremd: C.parseDe(a.fremd), mgk: C.parseDe(a.mgk), wag: C.parseDe(a.wag), gw: C.parseDe(a.gw), sko: C.parseDe(a.sko), ust: C.parseDe(a.ust) }; };
  part('ang', 'Projektangebot kalkulieren', () => `${S.tool.ko.ang.pos.map((x, i) => `<div class="fld"><label class="f"><span>${esc(x.n)}: Stunden</span><div class="qin"><input data-s="ko.ang.pos.${i}.h" inputmode="decimal" value="${esc(x.h)}"><span class="u">h</span></div></label><label class="f"><span>${esc(x.n)}: Satz</span><div class="qin"><input data-s="ko.ang.pos.${i}.s" inputmode="decimal" value="${esc(x.s)}"><span class="u">€/h</span></div></label></div>`).join('')}<div class="fld">${inp('ko.ang.mat', 'Material', '€')}${inp('ko.ang.mgk', 'Materialgemeinkosten', '%')}${inp('ko.ang.fremd', 'Fremdleistungen', '€')}${inp('ko.ang.wag', 'Wagniszuschlag', '%')}${inp('ko.ang.gw', 'Gewinn auf Selbstkosten', '%')}${inp('ko.ang.sko', 'Kundenskonto (im Hundert)', '%')}${inp('ko.ang.ust', 'Umsatzsteuer', '%')}</div><div data-out>${PARTS.ang.out()}</div>`, () => {
    const r = C.angebot(angParams()); if (!r.ok) return bad(r.err);
    return `<table class="t">${r.rows.map(x => `<tr class="${x.sum ? 'sum' : ''}${x.k === 'netto' ? ' hi' : ''}"><td>${esc(x.label)}<small>${esc(x.calc)}</small></td><td class="v">${E(x.v)}</td></tr>`).join('')}</table>${fig('price')}`;
  });
  part('pert', 'Aufwand schätzen (Dreipunkt)', () => `<p class="hint2" style="margin-top:0">Schätze je Arbeitspaket drei Werte in Tagen: optimistisch ≤ wahrscheinlich ≤ pessimistisch.</p>${S.tool.ko.pert.map((x, i) => `<div class="rrow"><b>${esc(x.n)}</b><span></span><div class="sel"><label>optimistisch<input data-s="ko.pert.${i}.a" inputmode="decimal" value="${esc(x.a)}" aria-label="optimistisch ${esc(x.n)}"></label><label>wahrscheinlich<input data-s="ko.pert.${i}.m" inputmode="decimal" value="${esc(x.m)}" aria-label="wahrscheinlich ${esc(x.n)}"></label><label>pessimistisch<input data-s="ko.pert.${i}.b" inputmode="decimal" value="${esc(x.b)}" aria-label="pessimistisch ${esc(x.n)}"></label></div></div>`).join('')}<div data-out>${PARTS.pert.out()}</div>`, () => {
    const L = S.tool.ko.pert.map(x => [C.parseDe(x.a), C.parseDe(x.m), C.parseDe(x.b)]), r = C.pertSum(L); if (!r.ok) return bad(r.err);
    return `<table class="t"><tr><th>Paket</th><th class="v">E</th><th class="v">σ</th></tr>${r.items.map((x, i) => `<tr><td>${esc(S.tool.ko.pert[i].n)}</td><td class="v">${N(x.e, 2)}</td><td class="v">${N(x.sd, 2)}</td></tr>`).join('')}<tr class="sum"><td>Gesamt</td><td class="v">${N(r.e, 2)}</td><td class="v">${N(r.sd, 2)}</td></tr></table><div class="kpis">${kp('Erwartung', N(r.e, 1) + ' Tage')}${kp('E + 1 σ (ca. 84 %)', N(r.plus1, 1) + ' Tage')}${kp('E + 2 σ (ca. 98 %)', N(r.plus2, 1) + ' Tage', 'warn')}</div><p class="hint2">Erwartungswerte addieren sich, Streuungen über die Quadrate (Varianzen): σ gesamt = √(Σ σ²). Die Prozentangaben gelten näherungsweise für eine Normalverteilung.</p>`;
  });

  /* ---------- Wirtschaftlichkeit ---------- */
  const ivInv = k => { const x = S.tool.iv[k]; return { I: C.parseDe(x.I), ue: C.parseDe(x.ue), n: C.parseDe(x.n), rest: C.parseDe(x.rest) }; };
  const ivOwn = () => { const t = S.tool.iv.own.trim(); if (!t) return null; const a = t.split(/[;\s]+/).filter(Boolean).map(C.parseDe); return a.length >= 2 && a.every(isFinite) ? a : false; };
  const ivSingle = () => { const i = P('iv.i'), A = ivInv('A'), own = ivOwn(); if (own === false) return { err: 'Zahlungsreihe: mindestens zwei Zahlen, getrennt durch Semikolon oder Leerzeichen (z. B. −1000; 400; 400; 400).' }; if (!isFinite(i)) return { err: 'Zinssatz ist keine Zahl.' }; if (own) return { i, own, r: C.bewerte({ cf: own, i }) }; if (!numsOK(A.I, A.ue, A.n, A.rest) || A.n < 1 || A.n > 30 || A.n !== Math.floor(A.n)) return { err: 'Anschaffung, Überschuss, Restwert: Zahlen. Laufzeit: ganze Jahre von 1 bis 30.' }; return { i, A, r: C.bewerte(Object.assign({}, A, { i })) }; };
  function ivOut() {
    const mode = S.tool.iv.mode;
    if (mode === 'single') {
      const s = ivSingle(); if (s.err) return bad(s.err); const r = s.r; if (!r.ok) return bad(r.err);
      let h = `<div class="kpis">${kp('Kapitalwert', E(r.npv, 0), r.npv > 0 ? 'ok' : 'bad')}${kp('Interner Zinsfuß', isFinite(r.irr) ? N(r.irr, 2) + ' %' : 'keiner')}${kp('Amortisation (statisch)', isFinite(r.pbStat) ? N(r.pbStat, 2) + ' J.' : 'nie')}${kp('Amortisation (dynamisch)', isFinite(r.pbDyn) ? N(r.pbDyn, 2) + ' J.' : 'nie')}${kp('Annuität des Kapitalwerts', E(r.ann, 0) + '/J.')}</div>`;
      h += rd(r.npv > 0 ? 'ok' : 'bad', r.npv > 0 ? `<b>Vorteilhaft.</b> Der Kapitalwert ist positiv: Die Investition verdient mehr als die geforderten ${N(s.i, 1)} %${isFinite(r.irr) ? ' (interner Zinsfuß ' + N(r.irr, 2) + ' %)' : ''}.` : `<b>Nicht vorteilhaft.</b> Der Kapitalwert ist negativ: Die Investition verdient weniger als die geforderten ${N(s.i, 1)} %${isFinite(r.irr) ? ' (interner Zinsfuß ' + N(r.irr, 2) + ' %)' : ''}.`);
      if (r.irrAll && r.irrAll.multiple) h += rd('warn', '<b>Achtung:</b> Die Zahlungsreihe wechselt mehrfach das Vorzeichen. Es gibt mehrere interne Zinsfüße (' + r.irrAll.roots.map(x => N(x, 2) + ' %').join(', ') + '); der Zinsfuß ist dann nur mit Vorsicht aussagekräftig.');
      h += fig('npvc') + fig('cfb');
      if (s.A) h += '<h4 class="gh" style="padding-left:0">Sensitivität: Was verändert den Kapitalwert?</h4>' + fig('tor') + (() => { const k = C.kritisch(Object.assign({}, s.A, { i: s.i })); return `<table class="t"><tr><th>Kritischer Wert (Kapitalwert = 0)</th><th class="v">Wert</th></tr><tr><td>Überschuss je Jahr mindestens<small>geplant ${E(s.A.ue, 0)}</small></td><td class="v">${E(k.ue, 0)}</td></tr><tr><td>Anschaffung höchstens<small>geplant ${E(s.A.I, 0)}</small></td><td class="v">${E(k.I, 0)}</td></tr><tr><td>Laufzeit mindestens</td><td class="v">${k.n ? k.n + ' Jahre' : 'über 60 Jahre'}</td></tr><tr><td>Kalkulationszins höchstens (interner Zinsfuß)</td><td class="v">${isFinite(r.irr) ? N(r.irr, 2) + ' %' : '–'}</td></tr></table>`; })();
      return h;
    }
    const i = P('iv.i'), A = ivInv('A'), B = ivInv('B'); if (!isFinite(i) || !numsOK(A.I, A.ue, A.n, A.rest, B.I, B.ue, B.n, B.rest) || A.n < 1 || B.n < 1 || A.n > 30 || B.n > 30 || A.n !== Math.floor(A.n) || B.n !== Math.floor(B.n)) return bad('Alle Werte müssen Zahlen sein, Laufzeiten ganze Jahre von 1 bis 30.');
    const v = C.vergleich(A, B, i); if (!v.ok) return bad(v.err);
    const row = (l, f, cls) => `<tr><td>${l}</td><td class="v">${f(v.A)}</td><td class="v">${f(v.B)}</td></tr>`, yr = x => isFinite(x) ? N(x, 2) + ' J.' : 'nie';
    let h = `<table class="t"><tr><th></th><th class="v">Anlage A</th><th class="v">Anlage B</th></tr>${row('Laufzeit', x => x.n + ' J.')}${row('Kapitalwert', x => E(x.npv, 0))}${row('Interner Zinsfuß', x => isFinite(x.irr) ? N(x.irr, 2) + ' %' : '–')}${row('Amortisation statisch', x => yr(x.pbStat))}${row('Amortisation dynamisch', x => yr(x.pbDyn))}${row('Annuität des Kapitalwerts', x => E(x.ann, 0) + '/J.')}</table>`;
    h += rd(v.best === '=' ? '' : 'ok', v.byAnnuity ? `Die Laufzeiten sind verschieden. Bei wiederholter Anschaffung zählt die jährliche Annuität des Kapitalwerts: <b>${v.best === '=' ? 'Gleichstand' : 'Anlage ' + v.best + ' ist besser'}</b> (A ${E(v.A.ann, 0)}, B ${E(v.B.ann, 0)} je Jahr). Wird jede Anlage nur einmal angeschafft, entscheidet weiter der Kapitalwert (A ${E(v.A.npv, 0)}, B ${E(v.B.npv, 0)}).` : `Gleiche Laufzeit: Der höhere Kapitalwert entscheidet. <b>${v.best === '=' ? 'Gleichstand' : 'Anlage ' + v.best + ' ist besser'}</b> (A ${E(v.A.npv, 0)}, B ${E(v.B.npv, 0)}).`);
    if (isFinite(v.fisher) && v.fisher > 0) { const lo = C.vergleich(A, B, v.fisher / 2), hi = C.vergleich(A, B, v.fisher * 1.5 + 1); h += rd('', `Die Kapitalwertkurven schneiden sich bei <b>${N(v.fisher, 2)} %</b>. Bei kleinerem Zins ist ${lo.best === '=' ? 'keine' : 'Anlage ' + lo.best} im Vorteil, bei größerem Zins ${hi.best === '=' ? 'keine' : 'Anlage ' + hi.best}. Spätere Zahlungen verlieren bei hohem Zins stärker an Wert.`); }
    h += fig('npvc'); return h;
  }
  const ivBlock = k => `<div class="fld">${inp('iv.' + k + '.I', 'Anschaffung', '€')}${inp('iv.' + k + '.ue', 'Überschuss je Jahr', '€')}${inp('iv.' + k + '.n', 'Laufzeit', 'Jahre')}${inp('iv.' + k + '.rest', 'Restwert am Ende', '€')}</div>`;
  part('iv', 'Investitionsrechner', () => `${chips('iv.mode', [['single', 'Eine Investition'], ['cmp', 'Zwei vergleichen']], S.tool.iv.mode)}${slide('iv.i', 'Kalkulationszins', '%', 0, 30, 0.5)}<h4 class="gh" style="padding-left:0">${S.tool.iv.mode === 'single' ? 'Investition' : 'Anlage A'}</h4>${ivBlock('A')}${S.tool.iv.mode === 'cmp' ? '<h4 class="gh" style="padding-left:0">Anlage B</h4>' + ivBlock('B') : `<label class="f"><span>Eigene Zahlungsreihe statt der Werte oben (optional, z. B. −1000; 400; 400; 400)</span><input data-s="iv.own" value="${esc(S.tool.iv.own)}" aria-label="Eigene Zahlungsreihe"></label>`}<p class="hint2">Zahlungen am Jahresende, die Anschaffung steht bei Jahr 0.</p><div data-out>${ivOut()}</div>`, ivOut);

  /* ---------- Risiko ---------- */
  const rqSubs = [['matrix', 'Risikomatrix'], ['fmea', 'FMEA'], ['pareto', 'Pareto'], ['ew', 'Erwartungswert']];
  const sel = (path, from, to, cur, label) => `<select data-s="${path}" aria-label="${esc(label)}">${Array.from({ length: to - from + 1 }, (_, k) => from + k).map(v => `<option${String(v) === String(cur) ? ' selected' : ''}>${v}</option>`).join('')}</select>`;
  const rqRisks = () => S.tool.rq.risks.map(r => ({ name: r.n, p: parseInt(r.p, 10), s: parseInt(r.s, 10) }));
  function rqOut() {
    const sub = S.tool.rq.sub;
    if (sub === 'matrix') {
      const R = rqRisks();
      return fig('rk') + `<table class="t"><tr><th>Risiko</th><th class="v">P·S</th><th>Klasse</th></tr>${R.map((r, k) => { const z = C.riskScore(r.p, r.s), c = C.riskClass(z); return `<tr><td><b>${k + 1}</b> ${esc(r.name)}</td><td class="v">${isFinite(z) ? z : '–'}</td><td>${c ? `<span class="badge ${c.id}">${c.name}</span>` : '–'}</td></tr>`; }).join('')}</table><p class="hint2">Beispielgrenzen: gering ≤ 4, mittel 5 bis 9, hoch 10 bis 15, kritisch ≥ 16. Jeder Betrieb legt seine eigenen Grenzen fest.</p>`;
    }
    if (sub === 'fmea') {
      const g = P('rq.gr'); if (!isFinite(g)) return bad('Der Grenzwert muss eine Zahl sein.');
      const f = C.fmea(S.tool.rq.fmea.map(r => ({ name: r.n, b: parseInt(r.b, 10), a: parseInt(r.a, 10), e: parseInt(r.e, 10) })), g);
      return fig('rpz') + `<table class="t"><tr><th>Fehlerart</th><th class="v">B·A·E</th><th class="v">RPZ</th></tr>${f.map(x => `<tr class="${x.over ? 'crit' : ''}"><td>${esc(x.name)}${x.b >= 9 ? '<small>Bedeutung ≥ 9: unabhängig von der RPZ prüfen</small>' : ''}</td><td class="v">${x.b}·${x.a}·${x.e}</td><td class="v">${isFinite(x.rpz) ? x.rpz : '–'}${x.over ? ' ▲' : ''}</td></tr>`).join('')}</table><p class="hint2">▲ = RPZ ab Grenzwert: Maßnahme planen, dann neu bewerten. E = 10 heißt: kaum zu entdecken.</p>`;
    }
    if (sub === 'pareto') {
      const p = C.pareto(S.tool.rq.par.map(x => ({ label: x.n, v: C.parseDe(x.v) }))); if (!p.ok) return bad(p.err);
      return fig('par') + `<table class="t"><tr><th>#</th><th>Ursache</th><th class="v">Anzahl</th><th class="v">kumuliert</th><th>Kl.</th></tr>${p.items.map((x, k) => `<tr class="${x.cls === 'A' ? 'crit' : ''}"><td>${k + 1}</td><td>${esc(x.label)}</td><td class="v">${N(x.v, 1)}</td><td class="v">${N(x.cum, 1)} %</td><td>${x.cls}</td></tr>`).join('')}</table><p class="hint2">Klasse A: ${p.nA} von ${p.items.length} Ursachen erklären bis zu 80 % (die Ursache, die die 80 % überschreitet, zählt noch dazu).</p>`;
    }
    const L = S.tool.rq.ew.map(x => [C.parseDe(x.p), C.parseDe(x.l)]); if (L.some(x => !isFinite(C.erwartung(x[0], x[1])))) return bad('Wahrscheinlichkeit 0 bis 100 %, Schaden ab 0 €.');
    return `<table class="t"><tr><th>Risiko</th><th class="v">Erwartungswert</th></tr>${L.map((x, k) => `<tr><td>${esc(S.tool.rq.ew[k].n)}</td><td class="v">${E(C.erwartung(x[0], x[1]), 0)}</td></tr>`).join('')}<tr class="sum"><td>Reserve (Summe)</td><td class="v">${E(C.reserve(L), 0)}</td></tr></table><p class="hint2">Erwartungswert = Wahrscheinlichkeit · Schaden. Die Reserve deckt im Durchschnitt, nicht den schlimmsten Fall.</p>`;
  }
  function rqForm() {
    const R = S.tool.rq, sub = R.sub;
    if (sub === 'matrix') return R.risks.map((r, i) => `<div class="rrow"><input data-s="rq.risks.${i}.n" value="${esc(r.n)}" aria-label="Risiko ${i + 1}"><button class="ib2" data-a="rqdel" data-i="${i}" aria-label="Risiko ${i + 1} löschen">✕</button><div class="sel"><label>Wahrscheinlichkeit P ${sel('rq.risks.' + i + '.p', 1, 5, r.p, 'P ' + (i + 1))}</label><label>Schaden S ${sel('rq.risks.' + i + '.s', 1, 5, r.s, 'S ' + (i + 1))}</label></div></div>`).join('') + `<div class="btns"><button class="btn" data-a="rqadd"${R.risks.length >= 8 ? ' disabled' : ''}>＋ Risiko</button></div>`;
    if (sub === 'fmea') return slide('rq.gr', 'Grenzwert der RPZ', '', 20, 400, 10) + R.fmea.map((r, i) => `<div class="rrow"><input data-s="rq.fmea.${i}.n" value="${esc(r.n)}" aria-label="Fehlerart ${i + 1}"><button class="ib2" data-a="rqdel" data-i="${i}" aria-label="Fehlerart ${i + 1} löschen">✕</button><div class="sel"><label>B ${sel('rq.fmea.' + i + '.b', 1, 10, r.b, 'Bedeutung')}</label><label>A ${sel('rq.fmea.' + i + '.a', 1, 10, r.a, 'Auftreten')}</label><label>E ${sel('rq.fmea.' + i + '.e', 1, 10, r.e, 'Entdeckung')}</label></div></div>`).join('') + `<div class="btns"><button class="btn" data-a="rqadd"${R.fmea.length >= 8 ? ' disabled' : ''}>＋ Fehlerart</button></div>`;
    if (sub === 'pareto') return R.par.map((r, i) => `<div class="rrow"><input data-s="rq.par.${i}.n" value="${esc(r.n)}" aria-label="Ursache ${i + 1}"><button class="ib2" data-a="rqdel" data-i="${i}" aria-label="Ursache ${i + 1} löschen">✕</button><div class="sel"><label>Anzahl<input data-s="rq.par.${i}.v" inputmode="decimal" value="${esc(r.v)}" aria-label="Anzahl ${i + 1}"></label></div></div>`).join('') + `<div class="btns"><button class="btn" data-a="rqadd"${R.par.length >= 10 ? ' disabled' : ''}>＋ Ursache</button></div>`;
    return R.ew.map((r, i) => `<div class="rrow"><input data-s="rq.ew.${i}.n" value="${esc(r.n)}" aria-label="Risiko ${i + 1}"><button class="ib2" data-a="rqdel" data-i="${i}" aria-label="Risiko ${i + 1} löschen">✕</button><div class="sel"><label>P<input data-s="rq.ew.${i}.p" inputmode="decimal" value="${esc(r.p)}" aria-label="Wahrscheinlichkeit in Prozent"> %</label><label>Schaden<input class="w2" data-s="rq.ew.${i}.l" inputmode="decimal" value="${esc(r.l)}" aria-label="Schaden in Euro"> €</label></div></div>`).join('') + `<div class="btns"><button class="btn" data-a="rqadd"${R.ew.length >= 8 ? ' disabled' : ''}>＋ Risiko</button></div>`;
  }
  part('rq', 'Risiko-Werkstatt', () => `${chips('rq.sub', rqSubs, S.tool.rq.sub)}${rqForm()}<div data-out>${rqOut()}</div>`, rqOut);

  /* ---------- Praxisbericht ---------- */
  const pbW = () => S.tool.pb.w.map(x => C.parseDe(x));
  part('pbB', 'Seitenbudget planen', () => `${slide('pb.total', 'Umfang des Berichts (ohne Anhang)', 'Seiten', 8, 80, 1)}<p class="hint2">Anteile der Kapitel (Gewichte, die Summe muss nicht 100 sein):</p>${D.PB_CHAPTERS.map((c, i) => slide('pb.w.' + i, c.n, '%', 0, 50, 1)).join('')}<div data-out>${PARTS.pbB.out()}</div>`, () => {
    const total = P('pb.total'), w = pbW(), r = C.seiten(total, w); if (!r.ok) return bad(r.err);
    return fig('pages') + `<table class="t"><tr><th>Kapitel</th><th class="v">Anteil</th><th class="v">Seiten</th></tr>${D.PB_CHAPTERS.map((c, i) => `<tr><td>${esc(c.n)}</td><td class="v">${N(r.shares[i], 1)} %</td><td class="v"><b>${r.whole[i]}</b> <small>(${N(r.exact[i], 2)})</small></td></tr>`).join('')}<tr class="sum"><td>Summe</td><td class="v">100 %</td><td class="v">${r.whole.reduce((a, b) => a + b, 0)}</td></tr></table><p class="hint2">Ganze Seiten nach dem Verfahren des größten Rests: Die Summe stimmt immer. In Klammern der genaue Wert.</p>`;
  });
  const chkKey = (g, i) => g + '|' + i, chkTotal = () => D.PB_CHECK.reduce((s, g) => s + g.items.length, 0), chkDone = () => D.PB_CHECK.reduce((s, g, gi) => s + g.items.filter((_, i) => S.chk[chkKey(gi, i)]).length, 0);
  part('pbC', 'Abgabe-Checkliste', () => `<div class="prog" aria-hidden="true"><i style="width:${Math.round(chkDone() / chkTotal() * 100)}%"></i></div><p class="hint2" style="margin-top:0" data-chkp>${chkDone()} von ${chkTotal()} Punkten abgehakt (bleibt auf diesem Gerät gespeichert).</p>${D.PB_CHECK.map((g, gi) => `<div class="gh" style="padding-left:0">${esc(g.g)}</div>${g.items.map((t, i) => `<label class="chk"><input type="checkbox" data-a="chk" data-k="${chkKey(gi, i)}"${S.chk[chkKey(gi, i)] ? ' checked' : ''}><span>${esc(t)}</span></label>`).join('')}`).join('')}<div class="btns"><button class="btn" data-a="chkreset">Haken zurücksetzen</button></div>`);
  part('pbR', 'Regeln auf einen Blick', () => D.PB_RULES.map(r => `<details class="det"><summary>${esc(r.h)}</summary><div class="db"><ul>${r.t.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div></details>`).join('') + '<p class="hint2">Die Vorgaben deiner Schule oder Hochschule gehen diesen allgemeinen Regeln immer vor.</p>');
  part('pbZ', 'Zitat-Baukasten', () => `<p class="hint2" style="margin-top:0">Baue Kurzbeleg und Literaturzeile aus den Bausteinen. Nutze eine Institution oder einen Urheber deiner echten Quelle; die Form ist ein Vorschlag, das Zitierformat legt die Vorgabe fest.</p>${chips('pb.z.art', [['sinn', 'sinngemäß'], ['woertlich', 'wörtlich']], S.tool.pb.z.art)}<div class="fld"><label class="f"><span>Urheber (Person oder Institution)</span><input data-s="pb.z.quelle" value="${esc(S.tool.pb.z.quelle)}"></label><label class="f"><span>Jahr</span><input data-s="pb.z.jahr" inputmode="numeric" value="${esc(S.tool.pb.z.jahr)}"></label><label class="f"><span>Seite</span><input data-s="pb.z.seite" value="${esc(S.tool.pb.z.seite)}"></label><label class="f"><span>Titel</span><input data-s="pb.z.titel" value="${esc(S.tool.pb.z.titel)}"></label><label class="f"><span>Ort</span><input data-s="pb.z.ort" value="${esc(S.tool.pb.z.ort)}"></label></div><div data-out>${PARTS.pbZ.out()}</div>`, () => {
    const z = S.tool.pb.z, r = C.zitat(z); if (!r.ok) return bad(r.err);
    return rd('', `<p><b>Im Text:</b> ${esc(r.kurz)}</p><p><b>Im Quellenverzeichnis:</b> ${esc(r.voll)}</p>`) + (r.warn ? rd('warn', '<b>Hinweis:</b> ' + esc(r.warn)) : '');
  });
  const BLK = { lh: ['lhFlow', 'lhGl', 'lhPr', 'lhAv'], np: ['np'], ko: ['be', 'st', 'ang', 'pert'], iv: ['iv'], rq: ['rq'], pb: ['pbB', 'pbC', 'pbR', 'pbZ'] };

  /* ============================================================ Zeichnen der Abbildungen (Breite vom Container) */
  const FIG = {
    lhflow: w => V.lhFlow(w),
    gantt: w => { const res = C.cpm(netActs()); return res.ok ? V.gantt(res, w) : ''; },
    be: w => { const b = S.tool.ko.be, p = { p: C.parseDe(b.p), kv: C.parseDe(b.kv), kfix: C.parseDe(b.kfix), x: C.parseDe(b.x) }; return numsOK(p.p, p.kv, p.kfix, p.x) ? V.breakeven(p, w) : ''; },
    price: w => { const r = C.angebot(angParams()); return r.ok ? V.priceBar(r.val, w) : ''; },
    npvc: w => {
      if (S.tool.iv.mode === 'single') { const s = ivSingle(); return s.err || !s.r.ok ? '' : V.npvCurve([{ cf: s.r.cf }], { i: s.i }, w); }
      const i = P('iv.i'), A = ivInv('A'), B = ivInv('B'), v = C.vergleich(A, B, i); return v.ok ? V.npvCurve([{ cf: v.A.cf }, { cf: v.B.cf }], { i, fisher: v.fisher }, w) + '<div class="legend"><span><i class="l-acc"></i>Anlage A</span><span><i class="l-crit"></i>Anlage B</span><span>Punkt: Zins</span></div>' : '';
    },
    cfb: w => { const s = ivSingle(); return s.err || !s.r.ok ? '' : V.cfBars(s.r.cf, s.i, w) + '<div class="legend"><span>Balken: Zahlung je Jahr</span><span>Linie: kumulierter Barwert (bei Null ist das Geld zurück)</span></div>'; },
    tor: w => { const s = ivSingle(); if (s.err || !s.A || !s.r.ok) return ''; const p = Object.assign({}, s.A, { i: s.i }), it = [['ue', 10, 'Überschuss ±10 %'], ['I', 10, 'Anschaffung ±10 %'], ['i', 2, 'Zins ±2 Pkt.'], ['n', 1, 'Laufzeit ±1 Jahr']].map(([k, d, l]) => ({ label: l, lo: C.sens(p, k, -d), hi: C.sens(p, k, d) })); return V.tornado(it, s.r.npv, w); },
    rk: w => V.riskMatrix(rqRisks(), w),
    rpz: w => { const g = P('rq.gr'); return isFinite(g) ? V.rpzBars(C.fmea(S.tool.rq.fmea.map(r => ({ name: r.n, b: parseInt(r.b, 10), a: parseInt(r.a, 10), e: parseInt(r.e, 10) })), g), g, w) : ''; },
    par: w => { const p = C.pareto(S.tool.rq.par.map(x => ({ label: x.n, v: C.parseDe(x.v) }))); return p.ok ? V.paretoChart(p, w) + '<div class="legend"><span><i class="l-crit"></i>Klasse A</span><span>Linie: kumuliert, gestrichelt 80 %</span></div>' : ''; },
    pages: w => { const r = C.seiten(P('pb.total'), pbW()); return r.ok ? V.pagesBar(D.PB_CHAPTERS, r.whole, w) : ''; }
  };

  /* ============================================================ Aufgaben (Zustand, Auswertung, HTML) */
  const TASKS = D.tasks, nTasks = TASKS.length;
  const done = () => lsGet('done', {}), exam = () => lsGet('exam', '0') === '1';
  const pctFor = id => exam() ? Math.max(0, 100 - 20 * (lsGet('ctipps', {})[id] || 0)) : 100;
  const nDone = () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)).length;
  const blkDone = b => TASKS.filter(t => t.blk === b && done()[t.id]).length, blkAll = b => TASKS.filter(t => t.blk === b).length;
  const tolTxt = a => a.tol === 0 ? 'genau' : '±' + N(a.tol, a.tol < 1 ? 2 : 1);
  const ruleText = q => q.kind === 'num' ? 'Erlaubte Abweichung: ' + q.asks.map(a => (q.asks.length > 1 ? a.label + ' ' : '') + tolTxt(a) + (a.unit && a.tol !== 0 ? ' ' + a.unit : '')).join('; ') + '.' : 'Wähle je Zeile eine Antwort. Geprüft wird jede Zeile einzeln.';
  function evalQ(q, ans) {
    if (q.kind === 'num') {
      let ok = true, filled = 0, right = 0, nan = false; const rows = {};
      q.asks.forEach(a => { const c = C.checkNum(ans[a.key], a.value, a.tol); if (c.empty) { ok = false; return; } filled++; if (c.nan) { nan = true; ok = false; rows[a.key] = 'bad'; return; } rows[a.key] = c.ok ? 'ok' : 'bad'; if (c.ok) right++; else ok = false; });
      return { ok, rows, filled, right, total: q.asks.length, nan, empty: filled === 0 };
    }
    const rows = {}; let filled = 0, right = 0;
    q.items.forEach((it, k) => { const v = ans['i' + k]; if (v == null) return; filled++; rows[k] = v === it.a ? 'ok' : 'bad'; if (v === it.a) right++; });
    return { ok: right === q.items.length, rows, filled, right, total: q.items.length, empty: filled === 0 };
  }
  function figTask(q, solved) { if (!q.fig || q.fig.type !== 'net') return ''; const res = C.cpm(q.fig.acts); return res.ok ? `<div class="scrollx" tabindex="0" aria-label="Netzplan der Aufgabe, seitlich scrollbar">${V.netzplan(res, { hide: !solved, uid: 'tk' }).svg}</div><p class="hint2">${solved ? 'Netzplan mit allen Zeiten (orange: kritisch).' : 'Der Netzplan zeigt Vorgänge und Dauern. Die Zeiten rechnest du selbst.'}</p>` : ''; }
  function taskHTML(ctx, pre, tipBtn) {
    const q = ctx.q, r = ctx.res, locked = !!(r && (r.ok || r.shown)); let h = `<div class="qtext">${esc(q.text)}</div>` + figTask(q, locked);
    if (q.kind === 'num') h += q.asks.map(a => `<label class="ask"><span>${esc(a.label)}${a.unit ? ' (' + esc(a.unit) + ')' : ''}</span><div class="qin"><input data-v="${a.key}" inputmode="decimal" autocomplete="off" value="${esc(ctx.ans[a.key] || '')}"${locked ? ' disabled' : ''} class="${r && r.rows && r.rows[a.key] ? 'rs-' + r.rows[a.key] : ''}"><span class="u">${esc(a.unit)}</span></div></label>`).join('');
    else {
      const long = q.opts.some(o => o.length > 28);
      h += q.items.map((it, k) => `<fieldset class="pk"><legend>${esc(it.t)}</legend><div class="seg2${long ? ' stack' : ''}">${q.opts.map((o, j) => `<button data-a="pick" data-k="${k}" data-j="${j}" aria-pressed="${ctx.ans['i' + k] === j}" class="${r && r.rows && ctx.ans['i' + k] === j ? 'rs-' + r.rows[k] : ''}"${locked ? ' disabled' : ''}>${esc(o)}</button>`).join('')}</div></fieldset>`).join('');
    }
    h += `<p class="hint2 lr-hinweis">${esc(ruleText(q))}</p><div class="btns"><button class="btn pri" data-a="chk"${locked ? ' disabled' : ''}>✓ Prüfen</button>${tipBtn}</div>`;
    if (r && !r.empty || (r && r.shown)) {
      const lines = [];
      if (r.shown) lines.push({ ok: false, text: 'Lösung angezeigt (zählt als Fehler).' });
      else lines.push({ ok: r.ok, text: r.ok ? 'Richtig: ' + (r.total === 1 ? 'Die Antwort stimmt.' : q.kind === 'num' ? 'alle ' + r.total + ' Antworten stimmen.' : 'alle ' + r.total + ' Zeilen stimmen.') : r.right + ' von ' + r.total + ' richtig' + (r.filled < r.total ? ', ' + (r.total - r.filled) + ' noch leer.' : '.') });
      h += `<ul class="tl">${lines.map(l => `<li class="${l.ok ? 'ok' : 'bad'}">${l.ok ? '✓' : '✗'} ${esc(l.text)}</li>`).join('')}</ul>`;
      if (r.ok || r.shown) h += solution(q).replace('class="rdout"', 'class="rdout lr-fb ' + (r.ok ? 'ok' : 'loes') + '"');
      else if (!exam() && (ctx.tries || 0) < 2) h += `<div class="rdout lr-fb tipp"><b>Tipp</b><p>${esc(q.tips && q.tips[0] || 'Rechne noch einmal Schritt für Schritt.')}</p><p>Versuche es ein zweites Mal. Beim zweiten Fehler zeige ich dir die Lösung mit Rechenweg.</p></div>`;
      else if (!exam()) h += solution(q).replace('class="rdout"', 'class="rdout lr-fb loes"');
      else h += rd('bad', '🎓 Prüfmodus: Musterlösung und Rechenweg gibt es erst nach richtiger Lösung. Nutze einen Tipp oder versuche es noch einmal.');
    }
    return h;
  }
  function solution(q) {
    let h = '<b>Musterlösung mit Rechenweg</b>';
    if (q.kind === 'num') h += '<p>' + q.asks.map(a => esc(a.label) + ': <b>' + N(a.value, a.value >= 100 ? 2 : 3) + (a.unit ? ' ' + esc(a.unit) : '') + '</b>').join(' · ') + '</p>';
    else h += '<ul>' + q.items.map(it => `<li>${esc(it.t)} <b>${esc(q.opts[it.a])}</b>. ${esc(it.why)}</li>`).join('') + '</ul>';
    h += '<p>' + q.expl.map(esc).join('<br>') + '</p>';
    return rd('', h);
  }
  function tipSheetHTML(q, n) {
    let x = '';
    for (let k = 0; k < n; k++) x += `<p${k ? '' : ' style="margin-top:0"'}><b>Stufe ${k + 1}:</b> ${esc(q.tips[k])}</p>`;
    x += n < 3 ? '<p class="hint2">Noch mehr Hilfe? Tippe noch einmal auf „Tipp“ für Stufe ' + (n + 1) + ' von 3.</p>' : '';
    x += exam() ? '<p class="hint2" style="color:var(--hi)">Prüfmodus: Jede Tipp-Stufe kostet 20 % der Punkte.</p>' : '<p class="hint2">Beim normalen Üben kosten Tipps nichts. Im Prüfmodus (🎓) zählen sie.</p>';
    return x;
  }
  function tasksHTML(ctx) {
    const d = done(), prog = lsGet('prog', {}); let h = '';
    if (ctx) { const t = TASKS.find(x => x.id === ctx.id), b = D.BLOCKS.find(x => x.id === t.blk); h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(b.name)}</h4><div class="big">${esc(t.title)}</div><div class="lv" aria-label="Schwierigkeit ${t.level} von 3">${dots(t.level)}</div>` + taskHTML(ctx, 'tk', '<button class="btn" data-a="hint">💡 Tipp</button>') + (exam() ? '<p class="hint2" style="color:var(--hi)">🎓 Prüfmodus: Jede Tipp-Stufe kostet 20 % der Punkte.</p>' : '') + `<div class="btns"><button class="btn" data-a="neu">🎲 Neue Zahlen</button>${ctx.res && (ctx.res.ok || ctx.res.shown || (!exam() && (ctx.tries || 0) >= 2)) ? '<button class="btn pri" data-a="next">Nächste Aufgabe</button>' : '<button class="btn" data-a="show">Lösung zeigen</button>'}<button class="btn" data-a="close">Schließen</button></div></div>`; }
    h += `<p class="hint2" style="margin:4px 0 0">${nDone()} von ${nTasks} Aufgaben gelöst. ${exam() ? '🎓 Prüfmodus ist an.' : 'Tipp: Im Prüfmodus (🎓 oben) zählen Tipps als Abzug.'}</p>`;
    let last = '';
    TASKS.forEach(x => { if (x.blk !== last) { last = x.blk; const b = D.BLOCKS.find(y => y.id === x.blk); h += `<div class="gh">${b.icon} ${esc(b.name)} · ${blkDone(x.blk)}/${blkAll(x.blk)}</div>`; } const p = prog[x.id]; h += `<button class="row" data-t="${esc(x.id)}"><span class="dot ${d[x.id] ? 'g' : p > 0 ? 'p' : ''}">${d[x.id] ? '✓' : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${dots(x.level)}</span>${p != null && !d[x.id] ? ' · bisher ' + p + ' %' : ''}</small></div></button>`; });
    return h;
  }
  function blockHTML(id) {
    const b = D.BLOCKS.find(x => x.id === id);
    let h = `<div class="card pl"><h4>${b.icon} ${esc(b.name)}: kurz erklärt</h4>${D.EXPLAIN[id].map((s, k) => `<details class="det"${k === 0 ? ' open' : ''}><summary>${esc(s.h)}</summary><div class="db">${s.p}</div></details>`).join('')}</div>`;
    h += BLK[id].map(pid => `<section class="card pl" data-part="${pid}"><h4>${esc(PARTS[pid].title)}</h4><div data-body>${PARTS[pid].html()}</div></section>`).join('');
    h += `<div class="card pl"><h4>Aufgaben zu diesem Block</h4><p style="margin:0 0 6px">${blkDone(id)} von ${blkAll(id)} gelöst. Jede Aufgabe hat drei Tipp-Stufen und eine Musterlösung mit Rechenweg.</p><div class="btns"><button class="btn pri" data-a="goTask" data-b="${id}">📝 Aufgaben öffnen</button></div></div>`;
    return h;
  }
  const FORMELN = [
    ['Lastenheft', ['Ausfallzeit = (1 − V) · 8760 h']],
    ['Netzplan', ['FEZ = FAZ + D;  FAZ = größtes FEZ der Vorgänger', 'SAZ = SEZ − D;  SEZ = kleinstes SAZ der Nachfolger', 'GP = SAZ − FAZ;  FP = kleinstes FAZ der Nachfolger − FEZ', 'kritisch: GP = 0']],
    ['Kosten', ['Satz = Jahresbrutto · (1 + LNK) : (Sollstunden · produktiver Anteil)', 'Zielpreis = Barpreis : (1 − Skonto)', 'DB = Preis − variable Kosten;  Break-even = Fixkosten : DB', 'E = (a + 4m + b) : 6;  σ = (b − a) : 6;  σ gesamt = √(Σ σ²)']],
    ['Wirtschaftlichkeit', ['K = Σ Zₜ : (1+i)ᵗ', 'RBF = ((1+i)ⁿ − 1) : (i (1+i)ⁿ);  Annuität a = K · i (1+i)ⁿ : ((1+i)ⁿ − 1)', 'IRR: K(i) = 0;  Interpolation: i = i₁ − K₁ (i₂ − i₁) : (K₂ − K₁)', 'Amortisation: Jahre bis die (abgezinsten) Rückflüsse die Anschaffung decken']],
    ['Risiko', ['Risikozahl = P · S;  Erwartungswert = P · Schaden', 'RPZ = B · A · E;  Pareto: A, bis 80 % erreicht oder überschritten sind (die Ursache, die 80 % überschreitet, zählt mit); B bis 95 %']],
    ['Bericht', ['Seiten = Gesamtumfang · Anteil;  Anteil = Seiten : Gesamtumfang']]
  ];
  function helpHTML() {
    return `<div class="card pl"><h4>Hilfe und Hinweise</h4><details class="det" open><summary>Formeln</summary><div class="db">${FORMELN.map(f => `<p><b>${esc(f[0])}</b></p>${f[1].map(x => `<span class="eq">${esc(x)}</span>`).join('')}`).join('')}</div></details>
    <details class="det"><summary>Rechnen und Prüfen</summary><div class="db"><p>Rechne ohne Zwischenrundung und runde erst das Ergebnis. Jede Aufgabe nennt die erlaubte Abweichung. Zahlen werden mit Komma oder Punkt als Dezimalzeichen angenommen.</p><p>Alle Zahlen in Aufgaben sind frei gewählte Übungswerte, keine Branchenwerte. Zuschläge, Klassengrenzen und Beispielprojekte sind Beispiele: Betriebe und Lehrbücher können andere Schemata verwenden.</p><p>Zeitpunkte im Netzplan: Das Projekt startet bei 0, ein Vorgang von 0 bis 3 dauert 3 Tage. Zahlungen in der Investitionsrechnung fallen am Jahresende an, die Anschaffung bei Jahr 0.</p></div></details>
    <details class="det"><summary>Prüfmodus</summary><div class="db"><p>Im Prüfmodus (🎓) kostet jede der drei Tipp-Stufen 20 % der Punkte, und die Musterlösung gibt es erst nach richtiger Lösung. Beim normalen Üben kosten Tipps nichts.</p></div></details>
    <details class="det"><summary>Weiterlesen</summary><div class="db"><p>Zum Nachschlagen in Bibliothek oder Normenstelle der Schule (Ausgaben und Stand bitte selbst prüfen): Netzplantechnik und Projektmanagement (DIN 69900, DIN 69901), Lasten- und Pflichtenheft (VDI 2519), FMEA (DIN EN 60812), Investitionsrechnung (VDI 6025).</p></div></details>
    <details class="det"><summary>Version</summary><div class="db"><p>Tonfunk Lab ${esc(root.LAB_VERSION || '')} · Projekt-und-Wirtschaftlichkeits-Lab (Stufe: Studium).</p></div></details></div>`;
  }

  /* ============================================================ Exporte (auch für Node-Tests) */
  const TASKS_API = { evalQ, taskHTML, tasksHTML, blockHTML, helpHTML, tipSheetHTML, solution, pctFor };
  root.PRJ_UI = { S, DEF, PARTS, BLK, FIG, TABS, TASKS_API, merge, getP, setP, blockHTML, tasksHTML, helpHTML, taskHTML, evalQ, tipSheetHTML, newTask: (id, variant) => { const t = TASKS.find(x => x.id === id); return { id, q: t.make(C.rng(id + '#' + (variant || 0)), C), ans: {}, res: null }; } };
  root.PRJ_LAB = { id: 'prj', title: 'Projekt-und-Wirtschaftlichkeits-Lab', stufe: D.meta.stufe, doneKey: LS + 'done', progKey: LS + 'prog', total: nTasks, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.PRJ_TASKS };
  if (!HAS_DOM) return;

  /* ============================================================ Oberfläche (nur mit Seite) */
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const fx = () => root.LochFX || null;
  const ding = () => { const F = fx(); if (F && F.sound) try { F.sound('ding', 0.6); } catch (e) {} };
  const sad = () => { const F = fx(); if (F && F.sound) try { F.sound('sad', 0.5); } catch (e) {} };
  function toast(m) { const t = $('#toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), Math.max(2200, m.length * 55)); }
  function sheet(title, build) {
    const bd = document.createElement('div'); bd.className = 'backdrop';
    bd.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="sh-h"><b>${esc(title)}</b><button class="x" aria-label="Schließen">✕</button></div><div class="sh-b"></div></div>`;
    document.body.appendChild(bd);
    const close = () => bd.remove();
    bd.addEventListener('pointerdown', e => { if (e.target === bd) close(); });
    $('.x', bd).onclick = close; build($('.sh-b', bd), close); const xb = $('.x', bd); if (xb) xb.focus(); return close;
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { const b = $$('.backdrop'); if (b.length) b[b.length - 1].remove(); } });

  function drawFigs(rootEl) {
    $$('.fig[data-vz]', rootEl).forEach(el => { const w = Math.floor(el.clientWidth); if (w < 40) return; try { el.innerHTML = FIG[el.dataset.vz](Math.max(260, w)) || ''; } catch (e) { el.innerHTML = ''; } });
  }
  let rzT = 0; window.addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(() => { if ($('#mid').dataset.tab === 'blk') drawFigs($('#blkView')); }, 120); });
  function renderPart(pid) { const el = $('[data-part="' + pid + '"] [data-body]'); if (!el) return; el.innerHTML = PARTS[pid].html(); drawFigs(el); }
  function updOut(pid, partEl) { const o = $('[data-out]', partEl); if (!o || !PARTS[pid].out) return; o.innerHTML = PARTS[pid].out(); drawFigs(o); }

  /* ---- Block anzeigen ---- */
  function renderBlock(id) {
    const v = $('#blkView'); v.innerHTML = blockHTML(id); drawFigs(v);
  }
  /* Eingaben: alle Felder mit data-s (Pfad im Werkstatt-Zustand) */
  const blkView = $('#blkView');
  blkView.addEventListener('input', e => {
    const el = e.target; if (!el.dataset || !el.dataset.s) return;
    const path = el.dataset.s; setP(path, el.value); saveTool();
    $$('[data-s="' + path + '"]', blkView).forEach(o => { if (o === el) return; if (o.type === 'range') { const pv = C.parseDe(el.value); if (isFinite(pv)) o.value = String(pv); } else if (o.value !== el.value) o.value = el.value; });
    const pe = el.closest('[data-part]'); if (pe) updOut(pe.dataset.part, pe);
  });
  blkView.addEventListener('change', e => { const el = e.target; if (el.matches && el.matches('select[data-s]')) { setP(el.dataset.s, el.value); saveTool(); const pe = el.closest('[data-part]'); if (pe) updOut(pe.dataset.part, pe); } });
  const nextName = (list, base) => base + ' ' + (list.length + 1);
  blkView.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a, pe = b.closest('[data-part]'), pid = pe && pe.dataset.part, i = parseInt(b.dataset.i, 10);
    if (a === 'set') { setP(b.dataset.s, b.dataset.v); saveTool(); renderPart(pid); }
    else if (a === 'lhex') { S.tool.lh.txt = LH_EX[i][0]; saveTool(); renderPart('lhPr'); }
    else if (a === 'nppre') { const p = D.NET_PRESETS.find(x => x.id === b.dataset.v); S.tool.np.preset = p.id; S.tool.np.acts = A0(p.acts); saveTool(); renderPart('np'); }
    else if (a === 'npdel') { const np = S.tool.np, id = np.acts[i].id; if (np.acts.length <= 1) return toast('Mindestens ein Vorgang bleibt stehen.'); np.acts.splice(i, 1); np.acts.forEach(x => { x.pre = C.splitPre(x.pre).filter(p => p !== id).join(', '); }); np.preset = ''; saveTool(); renderPart('np'); }
    else if (a === 'npadd') { const id = nextId(); if (!id) return; S.tool.np.acts.push({ id, name: 'Vorgang ' + id, d: '1', pre: S.tool.np.acts.length ? S.tool.np.acts[S.tool.np.acts.length - 1].id : '' }); S.tool.np.preset = ''; saveTool(); renderPart('np'); }
    else if (a === 'npdm') { const act = S.tool.np.acts[i], v = Math.max(0, (C.parseDe(act.d) || 0) + parseFloat(b.dataset.d)); act.d = String(v); S.tool.np.preset = ''; const inpEl = $('[data-s="np.acts.' + i + '.d"]', blkView); if (inpEl) inpEl.value = act.d; saveTool(); updOut('np', pe); }
    else if (a === 'rqadd') { const R = S.tool.rq; if (R.sub === 'matrix') R.risks.push({ n: nextName(R.risks, 'Risiko'), p: '3', s: '3' }); else if (R.sub === 'fmea') R.fmea.push({ n: nextName(R.fmea, 'Fehlerart'), b: '5', a: '5', e: '5' }); else if (R.sub === 'pareto') R.par.push({ n: nextName(R.par, 'Ursache'), v: '3' }); else R.ew.push({ n: nextName(R.ew, 'Risiko'), p: '10', l: '5000' }); saveTool(); renderPart('rq'); }
    else if (a === 'rqdel') { const R = S.tool.rq, L = R.sub === 'matrix' ? R.risks : R.sub === 'fmea' ? R.fmea : R.sub === 'pareto' ? R.par : R.ew; if (L.length <= 1) return toast('Mindestens eine Zeile bleibt stehen.'); L.splice(i, 1); saveTool(); renderPart('rq'); }
    else if (a === 'chk') { S.chk[b.dataset.k] = b.checked; lsSet('chk', S.chk); const p = $('[data-chkp]', blkView), bar = $('.prog i', blkView); if (p) p.textContent = chkDone() + ' von ' + chkTotal() + ' Punkten abgehakt (bleibt auf diesem Gerät gespeichert).'; if (bar) bar.style.width = Math.round(chkDone() / chkTotal() * 100) + '%'; if (chkDone() === chkTotal()) toast('🎉 Alle Punkte abgehakt'); }
    else if (a === 'chkreset') { S.chk = {}; lsSet('chk', S.chk); renderPart('pbC'); }
    else if (a === 'goTask') { setTab('tasks'); const first = TASKS.find(t => t.blk === b.dataset.b && !done()[t.id]) || TASKS.find(t => t.blk === b.dataset.b); if (first) startTask(first.id); }
  });

  /* ---- Aufgaben ---- */
  function markSolved(id, pct) { const p = lsGet('prog', {}); if ((p[id] || 0) < pct) p[id] = pct; lsSet('prog', p); if (pct > 0) { const d = done(); d[id] = true; lsSet('done', d); } updateBadge(); updatePal(); }
  function updateBadge() { const b = $('#tkBd'); if (b) b.textContent = nDone() + '/' + nTasks; }
  function startTask(id, variant) {
    const t = TASKS.find(x => x.id === id); if (!t) return; S.tv[id] = variant || 0; S.t = root.PRJ_UI.newTask(id, S.tv[id]);
    const h = lsGet('hints', {}), c = lsGet('ctipps', {}); if (h[id]) { delete h[id]; lsSet('hints', h); } if (c[id]) { delete c[id]; lsSet('ctipps', c); }
    renderTasks();
  }
  function checkTask() {
    const ctx = S.t; if (!ctx) return; const r = evalQ(ctx.q, ctx.ans);
    if (r.empty) return toast(ctx.q.kind === 'num' ? 'Trage zuerst ein Ergebnis ein.' : 'Wähle zuerst eine Antwort.');
    if (r.nan) return toast('Bitte gib eine Zahl ein (mit Komma oder Punkt).');
    ctx.res = r; const pct = r.ok ? pctFor(ctx.id) : 0;
    if (r.ok) { markSolved(ctx.id, pct); const F = fx(); if (F && F.pass) try { F.pass(pct); } catch (e) { ding(); } else ding(); toast(exam() && pct < 100 ? pct + ' % (Tipps abgezogen)' : '🎉 Geschafft!'); }
    else { ctx.tries = (ctx.tries || 0) + 1; sad(); toast(r.right > 0 ? 'Fast: ' + r.right + ' von ' + r.total + ' stimmen.' : 'Noch nicht richtig. Lies den Tipp und versuche es noch einmal.'); }
    renderTasks(false); { const f = $('#taskView .lr-fb'); if (f && window.LabRahmen && LabRahmen.zeig) LabRahmen.zeig(f); }
  }
  function hintTask() {
    const ctx = S.t; if (!ctx) return; const id = ctx.id, h = lsGet('hints', {}), n = Math.min(3, (h[id] || 0) + 1);
    h[id] = Math.max(h[id] || 0, n); lsSet('hints', h);
    if (exam()) { const c = lsGet('ctipps', {}); c[id] = Math.max(c[id] || 0, n); lsSet('ctipps', c); }
    sheet('Tipp, Stufe ' + n + ' von 3', b => { b.innerHTML = tipSheetHTML(ctx.q, n); });
  }
  function renderTasks(top) {
    const V_ = $('#taskView'), keep = V_.querySelector('input:focus'), fk = keep && keep.dataset.v;
    V_.innerHTML = tasksHTML(S.t); if (top !== false) $('#pgTasks').scrollTop = 0;
    if (fk) { const n = V_.querySelector('input[data-v="' + fk + '"]'); if (n && !n.disabled) { n.focus(); } }
  }
  const taskView = $('#taskView');
  taskView.addEventListener('input', e => { const c = S.t; if (c && e.target.dataset && e.target.dataset.v !== undefined) c.ans[e.target.dataset.v] = e.target.value; });
  taskView.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('input[data-v]')) { e.preventDefault(); if (S.t && !(S.t.res && (S.t.res.ok || S.t.res.shown))) checkTask(); } });
  taskView.addEventListener('click', e => {
    const row = e.target.closest('.row[data-t]'); if (row) return startTask(row.dataset.t);
    const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a, c = S.t;
    if (a === 'pick' && c && !(c.res && (c.res.ok || c.res.shown))) { c.ans['i' + b.dataset.k] = parseInt(b.dataset.j, 10); c.res = null; renderTasks(false); const nb = $('[data-a="pick"][data-k="' + b.dataset.k + '"][data-j="' + b.dataset.j + '"]', taskView); if (nb) nb.focus(); }
    else if (a === 'chk') checkTask(); else if (a === 'hint') hintTask();
    else if (a === 'neu' && c) startTask(c.id, (S.tv[c.id] || 0) + 1);
    else if (a === 'close') { S.t = null; renderTasks(); }
    else if (a === 'show' && c) { c.res = Object.assign({}, c.res || {}, { shown: true, ok: false, empty: false }); renderTasks(false); }
    else if (a === 'next' && c) { const i = TASKS.findIndex(x => x.id === c.id), nx = TASKS.slice(i + 1).find(x => !done()[x.id]) || TASKS[(i + 1) % TASKS.length]; startTask(nx.id); }
  });

  /* ---- Tabs, Kopf, Menü ---- */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'lh'; S.tab = t; lsSet('tab', t);
    const isBlk = D.CATS.includes(t); $('#mid').dataset.tab = isBlk ? 'blk' : t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    if (isBlk) renderBlock(t); else if (t === 'tasks') renderTasks(); else if (t === 'help') $('#helpView').innerHTML = helpHTML();
    const T = TABS.find(x => x[0] === t), full = isBlk ? D.BLOCKS.find(x => x.id === t).name : T[2];
    $('#title').innerHTML = 'Projekt-Lab\n<small>' + esc(full) + '</small>'; document.title = 'Projekt-Lab: ' + full;
    const sc = $(isBlk ? '#pgBlk' : t === 'tasks' ? '#pgTasks' : '#pgHelp'); if (sc) sc.scrollTop = 0;
    const act = $('.tab.on'); if (act && act.scrollIntoView) try { act.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) {}
  }
  function setExam(on) { lsSet('exam', on ? '1' : '0'); palSig = ''; updatePal(); toast(on ? '🎓 Prüfmodus an: Tipps kosten 20 % je Stufe.' : 'Prüfmodus aus: Tipps kosten nichts.'); if (S.tab === 'tasks') renderTasks(false); }
  let palSig = '';
  function updatePal() {
    const F = !!fx(), fxOn = F && !fx().isMuted(), sig = [F, fxOn, exam(), nDone()].join('|'); if (sig === palSig) return; palSig = sig;
    $('#pal').innerHTML = `${F ? `<button class="chip ${fxOn ? 'on' : ''}" data-a="fx" aria-pressed="${fxOn}" title="Effekte und Ton">${fxOn ? '🎉' : '🔇'} Effekte</button>` : ''}<button class="chip ${exam() ? 'on' : ''}" data-a="exam" aria-pressed="${exam()}" title="Prüfmodus: Tipps zählen als Abzug">🎓 Prüfmodus</button><button class="chip" data-a="rand" title="Zufällige offene Aufgabe">🎲 Zufallsaufgabe</button><span id="stat">Aufgaben gelöst <b>${nDone()}/${nTasks}</b></span>`;
    $('#bExam').classList.toggle('on', exam()); $('#bExam').setAttribute('aria-pressed', exam());
  }
  $('#pal').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.a === 'fx') { const F = fx(); if (F) { F.setMuted(!F.isMuted()); palSig = ''; updatePal(); if (!F.isMuted()) ding(); } }
    else if (b.dataset.a === 'exam') setExam(!exam());
    else if (b.dataset.a === 'rand') { const open = TASKS.filter(t => !done()[t.id]), pool = open.length ? open : TASKS, t = pool[Math.floor(Math.random() * pool.length)]; setTab('tasks'); startTask(t.id, Math.floor(Math.random() * 1000)); }
  });
  $('#bTasks').onclick = () => setTab('tasks'); $('#bHelp').onclick = () => setTab('help'); $('#bExam').onclick = () => setExam(!exam()); $('#title').onclick = () => setTab('lh');
  $('#bMenu').onclick = () => {
    const rows = D.BLOCKS.map(b => [b.id, b.icon + ' ' + b.name, blkDone(b.id) + ' von ' + blkAll(b.id) + ' Aufgaben gelöst']).concat([['tasks', '📝 Aufgaben', nTasks + ' Aufgaben mit Prüfung, 3 Tipp-Stufen und Rechenweg'], ['help', '📘 Hilfe und Formeln', 'Formeln, Hinweise zum Rechnen'], ['exam', '🎓 Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 20 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben, Eingaben und Haken auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']]);
    sheet('Menü', (b, close) => {
      b.innerHTML = rows.map(r => `<button class="row" data-m="${r[0]}"><div class="grow"><b>${esc(r[1])}</b><small>${esc(r[2])}</small></div></button>`).join('');
      b.addEventListener('click', e => { const r = e.target.closest('.row'); if (!r) return; close(); const m = r.dataset.m; if (m === 'home') location.href = 'index.html'; else if (m === 'exam') setExam(!exam()); else if (m === 'reset') resetAll(); else setTab(m); });
    });
  };
  function resetAll() {
    sheet('Fortschritt zurücksetzen?', (b, close) => {
      b.innerHTML = '<p style="margin-top:0">Alle gelösten Aufgaben, Tipps, Werkstatt-Eingaben und Checklisten-Haken dieses Labs werden auf diesem Gerät gelöscht. Das kann nicht rückgängig gemacht werden.</p><div class="btns"><button class="btn" data-x="no">Abbrechen</button><button class="btn danger" data-x="yes">Löschen</button></div>';
      b.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (!x) return; if (x.dataset.x === 'yes') { ['done', 'prog', 'hints', 'ctipps', 'tool', 'chk', 'rt'].forEach(k => { try { localStorage.removeItem(LS + k); } catch (er) {} }); S.tool = DEF(); S.chk = {}; S.t = null; palSig = ''; updatePal(); updateBadge(); setTab(S.tab); toast('Fortschritt gelöscht'); } close(); });
    });
  }

  buildTabs(); updatePal(); S.tab = lsGet('tab', 'lh'); setTab(S.tab);
  root.LabGoto = id => { try { if (TASKS.some(t => t.id === id)) { setTab('tasks'); startTask(id); return true; } } catch (e) {} return false; };
  try {
    const qs = new URLSearchParams(location.search), qa = qs.get('aufgabe'), qb = qs.get('block');
    if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); } else if (qb && D.CATS.includes(qb)) setTab(qb);
  } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
