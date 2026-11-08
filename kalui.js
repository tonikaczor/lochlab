'use strict';
/* Tonfunk Kalkulations-Lab: Oberfläche (Lab-Kennung 'kal').
   Reiter: Rechner (7 Schemata), Beispiele (?bsp), Aufgaben (?aufgabe=kal1), Trainer, Hilfe.
   Module: kalcore.js (KAL_CORE, Logik), kaldata.js (KAL_DATA, KAL_TASKS).
   Speicher (Präfix lm4.kal.): tab, calc (Rechner-Eingaben), done ({id:true} nur gelöste), prog ({id:Prozent}), hints ({id:höchste Stufe}),
   ctipps ({id:Stufe} nur im Prüfmodus), exam ('1' = Prüfmodus), rt (Trainer: n, ok, streak, best).
   Tipp-Abzug (25 % je Stufe, zwei Stufen) gibt es nur im Prüfmodus; beim normalen Üben kosten Tipps nichts. */
(function (root) {
  const C = root.KAL_CORE, D = root.KAL_DATA;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.kal.';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(LS + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} };
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
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>Kalkulations-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">kalcore.js oder kaldata.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks;

  /* ============================================================ Rechner: Felder je Schema */
  const N = (k, l, u, show) => ({ k, l, u, show });
  const SEG = (k, l, o, show) => ({ k, l, o, show });
  const MODES = [['bezug', 'Bezug'], ['sk', 'Selbstkosten'], ['ang', 'Angebot'], ['rueck', 'Rückwärts'], ['diff', 'Differenz'], ['sp', 'Spanne / Faktor'], ['db', 'Break-even']];
  const MTITLE = { bezug: 'Bezugskalkulation', sk: 'Selbstkostenkalkulation (Industrie)', ang: 'Angebotskalkulation vorwärts', rueck: 'Rückwärtskalkulation', diff: 'Differenzkalkulation', sp: 'Handelsspanne, Zuschlag, Faktor', db: 'Deckungsbeitrag und Break-even' };
  const FIELDS = {
    bezug: { def: { lep: '2400', rab: '15', sko: '2', bk: '120' }, f: [N('lep', 'Listeneinkaufspreis', '€'), N('rab', 'Liefererrabatt', '%'), N('sko', 'Liefererskonto', '%'), N('bk', 'Bezugskosten', '€')] },
    sk: { def: { mek: '4000', mgk: '20', fl: '3000', fgk: '180', vwgk: '8', vtgk: '4' }, f: [N('mek', 'Materialeinzelkosten', '€'), N('mgk', 'MGK-Zuschlag (auf MEK)', '%'), N('fl', 'Fertigungslöhne', '€'), N('fgk', 'FGK-Zuschlag (auf Löhne)', '%'), N('vwgk', 'VwGK-Zuschlag (auf HK)', '%'), N('vtgk', 'VtGK-Zuschlag (auf HK)', '%')] },
    ang: { def: { src: 'sk', sk: '14784', bzp: '12', hk: '25', gew: '10', sko: '2', prov: '8', rab: '10', ust: '19' }, f: [SEG('src', 'Start bei', [['sk', 'Selbstkosten'], ['handel', 'Bezugspreis (Handel)']]), N('sk', 'Selbstkosten', '€', v => v.src === 'sk'), N('bzp', 'Bezugspreis', '€', v => v.src === 'handel'), N('hk', 'Handlungskosten-Zuschlag', '%', v => v.src === 'handel'), N('gew', 'Gewinn (auf Selbstkosten)', '%'), N('sko', 'Kundenskonto (i. H.)', '%'), N('prov', 'Vertreterprovision (i. H.)', '%'), N('rab', 'Kundenrabatt (i. H.)', '%'), SEG('ust', 'Umsatzsteuer', [['19', '19 %'], ['7', '7 %']])] },
    rueck: { def: { art: 'brutto', preis: '595', ust: '19', rab: '10', sko: '2', prov: '3', gew: '25', hk: '20', bk: '40', lsko: '2', lrab: '20' }, f: [SEG('art', 'Marktpreis ist', [['brutto', 'brutto'], ['netto', 'netto']]), N('preis', 'Marktpreis', '€'), SEG('ust', 'Umsatzsteuer', [['19', '19 %'], ['7', '7 %']], v => v.art === 'brutto'), N('rab', 'Kundenrabatt', '%'), N('sko', 'Kundenskonto', '%'), N('prov', 'Provision', '%'), N('gew', 'Gewinn (auf SK)', '%'), N('hk', 'Handlungskosten (auf BZP)', '%'), N('bk', 'Bezugskosten', '€'), N('lsko', 'Liefererskonto', '%'), N('lrab', 'Liefererrabatt', '%')] },
    diff: { def: { lvp: '1000', rab: '20', sko: '2', prov: '4', sk: '800' }, f: [N('lvp', 'Marktpreis (Listenverkaufspreis netto)', '€'), N('rab', 'Kundenrabatt', '%'), N('sko', 'Kundenskonto', '%'), N('prov', 'Provision', '%'), N('sk', 'Selbstkosten', '€')] },
    sp: { def: { g: 'pp', bzp: '8', vp: '12', wert: '50' }, f: [SEG('g', 'Gegeben', [['pp', 'Preise'], ['z', 'Zuschlag'], ['s', 'Spanne'], ['f', 'Faktor']]), N('bzp', v => v.g === 'pp' ? 'Bezugspreis' : 'Bezugspreis (freiwillig)', '€'), N('vp', 'Verkaufspreis (netto)', '€', v => v.g === 'pp'), N('wert', v => ({ z: 'Kalkulationszuschlag', s: 'Handelsspanne', f: 'Kalkulationsfaktor' }[v.g]), v => v.g === 'f' ? '' : '%', v => v.g !== 'pp')] },
    db: { def: { p: '25', kv: '15', kfix: '12000', x: '1500' }, f: [N('p', 'Verkaufspreis je Stück', '€'), N('kv', 'Variable Stückkosten', '€'), N('kfix', 'Fixkosten je Periode', '€'), N('x', 'Absatzmenge', 'Stück')] }
  };
  const S = {
    tab: lsGet('tab', 'calc'),
    calc: { mode: 'bezug', weg: true, v: {} },
    t: null, tv: {}, r: null, rc: { cat: '', level: 0 },
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {}))
  };
  (() => { const sc = lsGet('calc', {}); S.calc.mode = FIELDS[sc.mode] ? sc.mode : 'bezug'; S.calc.weg = sc.weg !== false; Object.keys(FIELDS).forEach(m => { S.calc.v[m] = Object.assign({}, FIELDS[m].def, (sc.v || {})[m] || {}); }); })();
  const saveCalc = () => lsSet('calc', S.calc);
  const lab = (f, v) => typeof f.l === 'function' ? f.l(v) : f.l;
  const unitOf = (f, v) => typeof f.u === 'function' ? f.u(v) : f.u;

  function compute(mode, v) {
    const n = k => C.parseDe(v[k]);
    switch (mode) {
      case 'bezug': return C.bezug({ lep: n('lep'), rab: n('rab'), sko: n('sko'), bk: n('bk') });
      case 'sk': return C.selbstkosten({ mek: n('mek'), mgk: n('mgk'), fl: n('fl'), fgk: n('fgk'), vwgk: n('vwgk'), vtgk: n('vtgk') });
      case 'ang': {
        const p = { gew: n('gew'), sko: n('sko'), prov: n('prov'), rab: n('rab'), ust: +v.ust };
        if (v.src === 'handel') { const h = C.handelSk({ bzp: n('bzp'), hk: n('hk') }); if (!h.ok) return h; const a = C.angebot(Object.assign(p, { sk: h.val.sk })); return a.ok ? { ok: true, rows: h.rows.concat(a.rows.slice(1)), val: a.val } : a; }
        p.sk = n('sk'); return C.angebot(p);
      }
      case 'rueck': return C.rueckwaerts({ art: v.art, preis: n('preis'), ust: v.art === 'brutto' ? +v.ust : 0, rab: n('rab'), sko: n('sko'), prov: n('prov'), gew: n('gew'), hk: n('hk'), bk: n('bk'), lsko: n('lsko'), lrab: n('lrab') });
      case 'diff': return C.differenz({ lvp: n('lvp'), rab: n('rab'), sko: n('sko'), prov: n('prov'), sk: n('sk') });
      case 'sp': return v.g === 'pp' ? C.spanne({ bzp: n('bzp'), vp: n('vp') }) : C.spFrom({ g: v.g, wert: n('wert'), bzp: n('bzp') });
      case 'db': return C.db({ p: n('p'), kv: n('kv'), kfix: n('kfix'), x: n('x') });
    }
    return { ok: false, err: 'Unbekanntes Schema.' };
  }

  /* ============================================================ Schema-Tabelle */
  function schemaTable(rows, o) {
    o = o || {}; const fill = o.fill || null, ans = o.ans || {};
    let h = '<table class="sch"><tbody>';
    rows.forEach(r => {
      if (r.head) { h += `<tr class="hd"><td colspan="4">${esc(r.head)}</td></tr>`; return; }
      const isIn = !!fill && fill.includes(r.k), st = isIn && o.res ? o.res[r.k] : '';
      const cls = [r.sum ? 'sum' : '', o.hi === r.k ? 'hi' : '', st || '', fill && !isIn ? 'gv' : ''].filter(Boolean).join(' ');
      const calc = o.calc && r.calc ? `<small>${esc(r.calc)} = ${esc(C.fmtRow(r))}</small>` : '';
      let cell;
      if (isIn) cell = `<input data-k="${esc(r.k)}" inputmode="decimal" autocomplete="off" aria-label="${esc(r.label)}" placeholder="${esc(r.u || '')}" value="${esc(ans[r.k] || '')}"${o.disabled ? ' disabled' : ''}>${st ? `<span class="mk ${st}">${st === 'ok' ? '✓' : '✗'}</span>` : ''}`;
      else cell = esc(C.fmtRow(r));
      h += `<tr class="${cls}"><td class="op">${esc(r.op || '')}</td><td>${esc(r.label)}${r.bas && !isIn ? `<small>${esc(r.bas)}</small>` : ''}${calc}</td><td class="pc">${r.pct != null ? esc(C.fmtP(r.pct)) + ' %' : ''}</td><td class="v">${cell}</td></tr>`;
    });
    return h + '</tbody></table>';
  }

  /* ============================================================ Break-even-Grafik (SVG) */
  function niceStep(max, n) { const raw = max / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), r = raw / mag; return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * mag; }
  function chartDB(p) {
    if (![p.p, p.kv, p.kfix, p.x].every(isFinite) || p.p <= 0 || p.x < 0 || p.kfix < 0 || p.kv < 0) return '';
    const dbs = p.p - p.kv, bep = dbs > 0 ? p.kfix / dbs : null;
    let xmax = Math.max(p.x, bep ? bep * 1.6 : 0, 10) * 1.1; const sx0 = niceStep(xmax, 5); xmax = Math.ceil(xmax / sx0) * sx0;
    const K = x => p.kfix + p.kv * x, E = x => p.p * x; let ymax = Math.max(E(xmax), K(xmax), 1); const sy0 = niceStep(ymax, 4); ymax = Math.ceil(ymax / sy0) * sy0;
    const W = 420, H = 260, L = 58, Rr = 14, T = 16, B = 38, sx = x => L + (W - L - Rr) * x / xmax, sy = y => H - B - (H - B - T) * y / ymax, f0 = v => C.fmtDe(v, 0);
    let s = '';
    for (let y = 0; y <= ymax + 1e-9; y += sy0) s += `<line class="gr" x1="${L}" x2="${W - Rr}" y1="${sy(y)}" y2="${sy(y)}"/><text x="${L - 5}" y="${sy(y) + 4}" text-anchor="end">${f0(y)}</text>`;
    for (let x = 0; x <= xmax + 1e-9; x += sx0) s += `<line class="gr" x1="${sx(x)}" x2="${sx(x)}" y1="${T}" y2="${H - B}"/><text x="${sx(x)}" y="${H - B + 14}" text-anchor="middle">${f0(x)}</text>`;
    if (bep) {
      s += `<polygon class="zl" points="${sx(0)},${sy(0)} ${sx(bep)},${sy(E(bep))} ${sx(0)},${sy(p.kfix)}"/>`;
      s += `<polygon class="zg" points="${sx(bep)},${sy(E(bep))} ${sx(xmax)},${sy(E(xmax))} ${sx(xmax)},${sy(K(xmax))}"/>`;
    }
    s += `<path class="ax" d="M${L} ${T}V${H - B}H${W - Rr}"/>`;
    s += `<line class="fx" x1="${sx(0)}" y1="${sy(p.kfix)}" x2="${sx(xmax)}" y2="${sy(p.kfix)}"/>`;
    s += `<line class="k" x1="${sx(0)}" y1="${sy(K(0))}" x2="${sx(xmax)}" y2="${sy(K(xmax))}"/><line class="e" x1="${sx(0)}" y1="${sy(0)}" x2="${sx(xmax)}" y2="${sy(E(xmax))}"/>`;
    if (bep) { const bx = sx(bep), by = sy(E(bep)); s += `<circle class="bp" cx="${bx}" cy="${by}" r="5.5"/><text x="${Math.min(bx + 8, W - 112)}" y="${Math.min(by + 18, H - B - 6)}" style="font-weight:700">BEP ${f0(Math.ceil(bep - 1e-9))} Stück</text>`; }
    s += `<text x="${(L + W - Rr) / 2}" y="${H - 6}" text-anchor="middle" style="fill:var(--mute)">Menge (Stück)</text><text x="12" y="${(T + H - B) / 2}" text-anchor="middle" transform="rotate(-90 12 ${(T + H - B) / 2})" style="fill:var(--mute)">Euro</text>`;
    const alt = 'Kosten- und Erlösgerade' + (bep ? ', Break-even bei ' + f0(Math.ceil(bep - 1e-9)) + ' Stück' : ', kein Break-even (Stückdeckungsbeitrag nicht positiv)');
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(alt)}">${s}</svg><div class="legend"><span><i style="background:var(--accent)"></i>Erlös E = p · x</span><span><i style="background:var(--warn)"></i>Gesamtkosten K = Kfix + kv · x</span><span><i style="background:var(--mute)"></i>Fixkosten</span></div></div>`;
  }
  const chartFromVals = v => chartDB({ p: C.parseDe(v.p), kv: C.parseDe(v.kv), kfix: C.parseDe(v.kfix), x: C.parseDe(v.x) });

  /* ============================================================ Rechner */
  function calcOut() {
    const m = S.calc.mode, v = S.calc.v[m], res = compute(m, v); let h = '';
    if (!res.ok) return `<div class="rdout warn">${esc(res.err)}</div>`;
    h += schemaTable(res.rows, { calc: S.calc.weg });
    if (m === 'db') {
      if (res.val.bepMenge == null) h += '<div class="rdout bad">Der Stückdeckungsbeitrag ist nicht positiv: Der Preis deckt nicht einmal die variablen Kosten. Es gibt keine Gewinnschwelle.</div>';
      else h += `<div class="rdout ok">Gewinnschwelle ab <b>${C.fmtDe(res.val.bepStueck, 0)} Stück</b> (Umsatz ${C.eur(res.val.bepUmsatz)}). Darunter Verlust, darüber Gewinn.</div>`;
      h += chartFromVals(v);
    }
    if (m === 'ang' || m === 'rueck') h += '<p class="hint2">Skonto, Provision und Rabatt sind „im Hundert“, der Gewinn wird „auf Hundert“ aufgeschlagen (siehe Hilfe).</p>';
    return h + '<p class="hint2">Jedes Zwischenergebnis wird kaufmännisch auf Cent gerundet.</p>';
  }
  function renderCalc() {
    const m = S.calc.mode, v = S.calc.v[m], F = FIELDS[m];
    let h = `<div class="msel" role="tablist">${MODES.map(x => `<button class="chip${x[0] === m ? ' on' : ''}" data-mode="${x[0]}" role="tab" aria-selected="${x[0] === m}">${esc(x[1])}</button>`).join('')}</div>`;
    h += `<div class="card pl"><h4>${esc(MTITLE[m])}</h4><div class="fld">`;
    F.f.forEach(f => {
      if (f.show && !f.show(v)) return;
      if (f.o) h += `<div class="f w2"><span style="display:block;font-size:12px;color:var(--mute);margin-bottom:3px">${esc(lab(f, v))}</span><div class="seg">${f.o.map(o => `<button data-seg="${f.k}" data-val="${o[0]}" class="${v[f.k] === o[0] ? 'on' : ''}" aria-pressed="${v[f.k] === o[0]}">${esc(o[1])}</button>`).join('')}</div></div>`;
      else h += `<label class="f"><span>${esc(lab(f, v))}</span><div class="qin"><input data-f="${f.k}" inputmode="decimal" autocomplete="off" value="${esc(v[f.k])}"><span class="u">${esc(unitOf(f, v))}</span></div></label>`;
    });
    h += `</div><div class="ctl"><button class="chip s${S.calc.weg ? ' on' : ''}" data-weg="1" aria-pressed="${S.calc.weg}">Rechenweg anzeigen</button><button class="chip s" data-reset="1">Standardwerte</button></div></div><div class="card pl" id="calcOut">${calcOut()}</div>`;
    $('#calcView').innerHTML = h;
  }
  $('#calcView').addEventListener('input', e => { const k = e.target.dataset.f; if (!k) return; S.calc.v[S.calc.mode][k] = e.target.value; saveCalc(); $('#calcOut').innerHTML = calcOut(); });
  $('#calcView').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.mode) { S.calc.mode = b.dataset.mode; saveCalc(); renderCalc(); }
    else if (b.dataset.seg) { S.calc.v[S.calc.mode][b.dataset.seg] = b.dataset.val; saveCalc(); renderCalc(); }
    else if (b.dataset.weg) { S.calc.weg = !S.calc.weg; saveCalc(); renderCalc(); }
    else if (b.dataset.reset) { S.calc.v[S.calc.mode] = Object.assign({}, FIELDS[S.calc.mode].def); saveCalc(); renderCalc(); toast('Standardwerte eingesetzt (Beispiel aus dem Reiter Beispiele).'); }
  });

  /* ============================================================ Beispiele */
  function renderBsp() {
    let h = '<div class="card pl"><h4>Fertige Beispiele</h4><p class="hint2" style="margin:0">Jedes Beispiel ist komplett durchgerechnet. Mit „In den Rechner laden“ kannst du die Zahlen ändern und selbst probieren.</p></div>';
    D.examples.forEach((e, i) => {
      const m = e.mode, v = Object.assign({}, FIELDS[m].def, e.params), res = compute(m, v), kr = res.ok && res.rows.find(r => r.k === e.key[0]);
      h += `<div class="card pl"><h4>${esc(MTITLE[m])}</h4><div class="big">${esc(e.title)}</div><p style="margin:6px 0">${esc(e.text)}</p>`;
      if (res.ok) {
        h += `<details${i === 0 ? ' open' : ''}><summary style="min-height:44px;display:flex;align-items:center;cursor:pointer;font-weight:600">Rechenweg anzeigen</summary>${schemaTable(res.rows, { calc: true, hi: e.key[0] })}${m === 'db' ? chartFromVals(v) : ''}</details>`;
        h += `<div class="rdout ok exr">Ergebnis: ${esc(kr.label)} = ${esc(C.fmtRow(kr))}</div>`;
      } else h += `<div class="rdout bad">${esc(res.err)}</div>`;
      h += `<p class="hint2">${esc(e.note)}</p><div class="btns"><button class="btn pri" data-ex="${esc(e.id)}">In den Rechner laden</button></div></div>`;
    });
    $('#bspView').innerHTML = h;
  }
  $('#bspView').addEventListener('click', e => {
    const b = e.target.closest('[data-ex]'); if (!b) return; const ex = D.examples.find(x => x.id === b.dataset.ex); if (!ex) return;
    S.calc.mode = ex.mode; S.calc.v[ex.mode] = Object.assign({}, FIELDS[ex.mode].def, ex.params); saveCalc(); setTab('calc'); toast('Beispiel geladen: ' + ex.title);
  });

  /* ============================================================ Aufgaben (gemeinsam für Aufgaben und Trainer) */
  const done = () => lsGet('done', {});
  const exam = () => lsGet('exam', '0') === '1';
  function pctFor(id) { if (!exam()) return 100; const st = lsGet('ctipps', {})[id] || 0; return Math.max(0, 100 - 25 * st); }   /* zwei Stufen: 75 % bzw. 50 % */
  function markSolved(id, pct) {
    const p = lsGet('prog', {}); if ((p[id] || 0) < pct) p[id] = pct; lsSet('prog', p);
    if (pct > 0) { const d = done(); d[id] = true; lsSet('done', d); }
    updateBadge(); updatePal();
  }
  const nDone = () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)).length;
  function updateBadge() { const b = $('#tkBd'); if (b) b.textContent = nDone() + '/' + TASKS.length; }
  const ruleText = q => q.ask ? 'Rundung: jedes Zwischenergebnis kaufmännisch auf Cent. Erlaubt ist ' + (q.ask.unit === '%' ? '±0,1 %-Punkt' : q.ask.unit === '€' ? '±0,01 €' : '±0,01') + ' Abweichung.' : 'Rundung: jedes Zwischenergebnis kaufmännisch auf Cent. Je Zeile ist ±0,01 € (bei Prozenten ±0,1 %-Punkt) erlaubt. Die Zeilen werden einzeln geprüft.';
  function evalQ(q, ans) {
    if (q.ask) { const c = C.checkNum(ans.v, q.ask.value, q.ask.tol); if (c.empty) return { empty: true }; if (c.nan) return { nan: true }; return { ok: c.ok, x: c.x }; }
    const rows = {}; let ok = true, filled = 0, right = 0, nan = false;
    q.fill.forEach(k => { const row = q.rows.find(r => r.k === k), c = C.checkNum(ans[k], row.v, C.tolOf(row.u)); if (c.empty) { ok = false; return; } filled++; if (c.nan) { nan = true; ok = false; rows[k] = 'bad'; return; } rows[k] = c.ok ? 'ok' : 'bad'; if (c.ok) right++; else ok = false; });
    return { ok, rows, filled, right, total: q.fill.length, nan, empty: filled === 0 };
  }
  function exHTML(ctx, pre, tipBtn) {
    const q = ctx.q, r = ctx.res, locked = !!(r && r.ok); let h = `<p style="margin:8px 0">${esc(q.text)}</p>`;
    if (q.fill) h += schemaTable(q.rows, { fill: q.fill, ans: ctx.ans, res: r && r.rows, disabled: locked });
    else h += `<label class="f"><span>${esc(q.ask.label)} (${esc(q.ask.unit || 'Zahl')})</span><div class="qin"><input data-v id="${pre}In" inputmode="decimal" autocomplete="off" value="${esc(ctx.ans.v || '')}"${locked ? ' disabled' : ''}><span class="u">${esc(q.ask.unit)}</span></div></label>`;
    h += `<p class="hint2">${esc(ruleText(q))}</p>`;
    h += `<div class="btns"><button class="btn pri" data-a="chk"${locked ? ' disabled' : ''}>✓ Prüfen</button>${tipBtn}</div>`;
    if (r && !r.empty) {
      const lines = [];
      if (r.shown) lines.push({ ok: false, text: 'Lösung angezeigt (zählt als Fehler).' });
      else if (q.ask) lines.push({ ok: r.ok, text: r.ok ? 'Richtig: ' + C.fmtDe(r.x, 2) + ' ' + q.ask.unit : 'Deine Antwort „' + C.fmtDe(r.x, 2) + ' ' + q.ask.unit + '“ stimmt nicht.' });
      else lines.push({ ok: r.ok, text: r.ok ? 'Alle ' + r.total + ' Zeilen stimmen.' : r.right + ' von ' + r.total + ' Zeilen richtig' + (r.filled < r.total ? ', ' + (r.total - r.filled) + ' noch leer.' : '.') });
      h += `<ul class="tl">${lines.map(l => `<li class="${l.ok ? 'ok' : 'bad'}">${l.ok ? '✓' : '✗'} ${esc(l.text)}</li>`).join('')}</ul>`;
      if (r.ok || r.shown || !exam() || pre === 'rt') h += `<div class="rdout ${r.ok ? 'ok' : 'bad'}"><b>Lösungsweg mit Schema</b>${schemaTable(q.rows, { calc: true, hi: q.ask && q.ask.key })}<p style="margin:6px 0 0">${esc(q.expl)}</p></div>`;
      else h += '<div class="rdout bad">🎓 Prüfmodus: Den Lösungsweg gibt es erst, wenn die Aufgabe richtig gelöst ist. Nutze einen Tipp oder versuche es noch einmal.</div>';
    }
    return h;
  }
  function tipSheet(q, n) {
    const fr = (q.fill ? q.rows.filter(x => q.fill.includes(x.k)) : q.rows).find(x => x.calc);
    sheet('Tipp, Stufe ' + n + ' von 2', b => {
      let x = `<p style="margin-top:0"><b>Stufe 1:</b> ${esc(q.tips[0])}</p>`;
      if (n >= 2) x += `<p><b>Stufe 2:</b> Rechenansatz${fr ? ' für „' + esc(fr.label) + '“: <b>' + esc(fr.calc) + '</b>' : ''}. Rechne damit weiter, Zeile für Zeile.</p>`; else x += '<p class="hint2">Noch mehr Hilfe? Tippe noch einmal auf „Tipp“ für Stufe 2.</p>';
      x += exam() ? '<p class="hint2" style="color:var(--warn)">Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>' : '<p class="hint2">Beim normalen Üben kosten Tipps nichts. Im Prüfmodus (🎓) zählen sie.</p>';
      b.innerHTML = x;
    });
  }
  function wire(V, get, A) {
    V.addEventListener('input', e => { const c = get(); if (!c) return; if (e.target.dataset.k) c.ans[e.target.dataset.k] = e.target.value; else if (e.target.dataset.v !== undefined) c.ans.v = e.target.value; });
    V.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('input[data-k],input[data-v]')) { e.preventDefault(); const c = get(); if (c && !(c.res && c.res.ok)) A.chk(); } });
    V.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b && A[b.dataset.a]) A[b.dataset.a](); else if (A.other) A.other(e); });
  }

  /* ---- Aufgabenliste ---- */
  function startTask(id, variant) {
    const t = TASKS.find(x => x.id === id); if (!t) return;
    S.tv[id] = variant || 0;
    S.t = { id, q: t.make(C.rng(id + '#' + S.tv[id]), C), ans: {}, res: null };
    const h = lsGet('hints', {}), c = lsGet('ctipps', {}); if (h[id]) { delete h[id]; lsSet('hints', h); } if (c[id]) { delete c[id]; lsSet('ctipps', c); }
    renderTasks();
  }
  function checkTask() {
    const ctx = S.t; if (!ctx) return; const r = evalQ(ctx.q, ctx.ans);
    if (r.empty) { toast('Trage zuerst ein Ergebnis ein.'); return; }
    if (r.nan && ctx.q.ask) { toast('Bitte gib eine Zahl ein (mit Komma oder Punkt).'); return; }
    ctx.res = r; const pct = r.ok ? pctFor(ctx.id) : 0;
    if (r.ok) { markSolved(ctx.id, pct); const F = fx(); if (F && F.pass) try { F.pass(pct); } catch (e) { ding(); } else ding(); toast(exam() && pct < 100 ? pct + ' % (Tipps abgezogen)' : '🎉 Geschafft!'); }
    else { sad(); toast(r.filled != null && r.right > 0 ? 'Fast: ' + r.right + ' von ' + r.total + ' Zeilen stimmen.' : 'Noch nicht richtig. Lies den Tipp und versuche es noch einmal.'); }
    renderTasks(false);
  }
  function hintTask() {
    const ctx = S.t; if (!ctx) return; const id = ctx.id, h = lsGet('hints', {}), n = Math.min(2, (h[id] || 0) + 1);
    h[id] = Math.max(h[id] || 0, n); lsSet('hints', h);
    if (exam()) { const c = lsGet('ctipps', {}); c[id] = Math.max(c[id] || 0, n); lsSet('ctipps', c); }
    tipSheet(ctx.q, n);
  }
  function renderTasks(top) {
    const V = $('#taskView'), d = done(), prog = lsGet('prog', {}), ctx = S.t, t = ctx && TASKS.find(x => x.id === ctx.id); let h = '';
    if (t) {
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv">${dots(t.level)}</div>`;
      h += exHTML(ctx, 'tk', '<button class="btn" data-a="hint">💡 Tipp</button>');
      if (exam()) h += '<p class="hint2" style="color:var(--warn)">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>';
      h += `<div class="btns"><button class="btn" data-a="neu">🎲 Neue Zahlen</button>${ctx.res && ctx.res.ok ? '<button class="btn pri" data-a="next">Nächste Aufgabe</button>' : ''}<button class="btn" data-a="close">Schließen</button></div></div>`;
    }
    h += `<p class="hint2" style="margin:4px 0 0">${nDone()} von ${TASKS.length} Aufgaben gelöst. ${exam() ? '🎓 Prüfmodus ist an.' : 'Tipp: Im Prüfmodus (🎓 oben) zählen Tipps als Abzug.'}</p>`;
    let last = '';
    TASKS.forEach(x => { if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; } const p = prog[x.id]; h += `<button class="row" data-t="${esc(x.id)}"><span class="dot ${d[x.id] ? 'g' : p > 0 ? 'p' : ''}">${d[x.id] ? '✓' : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${dots(x.level)}</span>${p != null && !d[x.id] ? ' · bisher ' + p + ' %' : ''}</small></div></button>`; });
    V.innerHTML = h; if (top !== false) $('#pgTasks').scrollTop = 0;
  }
  wire($('#taskView'), () => S.t, {
    chk: checkTask, hint: hintTask,
    neu: () => { if (S.t) startTask(S.t.id, (S.tv[S.t.id] || 0) + 1); },
    close: () => { S.t = null; renderTasks(); },
    next: () => { const i = TASKS.findIndex(x => x.id === S.t.id), nx = TASKS.slice(i + 1).find(x => !done()[x.id]) || TASKS[(i + 1) % TASKS.length]; startTask(nx.id); },
    other: e => { const row = e.target.closest('.row[data-t]'); if (row) startTask(row.dataset.t); }
  });

  /* ---- Zufalls-Trainer ---- */
  function newTrainer() {
    const pool = TASKS.filter(t => (!S.rc.cat || t.cat === S.rc.cat) && (!S.rc.level || t.level === S.rc.level)), t = pool[Math.floor(Math.random() * pool.length)] || TASKS[0];
    S.r = { id: t.id, t, q: t.make(C.rng(t.id + '~' + Math.random() + Date.now()), C), ans: {}, res: null }; renderTrainer();
  }
  function trainerResult(r, shown) {
    const ctx = S.r, st = S.rt; ctx.res = Object.assign({}, r, { shown }); st.n++;
    if (r.ok && !shown) { st.ok++; st.streak++; st.best = Math.max(st.best, st.streak); ding(); } else { st.streak = 0; sad(); }
    lsSet('rt', st); renderTrainer(); updatePal();
    if (r.ok && !shown && st.streak % 5 === 0) { toast('🔥 ' + st.streak + ' richtige in Folge!'); const F = fx(); if (F && F.pass) try { F.pass(100); } catch (e) {} }
  }
  function renderTrainer() {
    if (!S.r) { newTrainer(); return; }
    const ctx = S.r, st = S.rt, seg = (a, items, cur) => `<div class="seg">${items.map(i => `<button data-${a}="${esc(i[0])}" class="${String(cur) === String(i[0]) ? 'on' : ''}">${esc(i[1])}</button>`).join('')}</div>`;
    let h = `<div class="card pl"><h4>Zufalls-Trainer: unendlich viele Aufgaben</h4><div class="fbar">${seg('rc', [['', 'Alle']].concat(D.CATS.map(c => [c, c])), S.rc.cat)}</div><div class="fbar">${seg('rl', [[0, 'Alle Stufen'], [1, 'leicht'], [2, 'mittel'], [3, 'schwer']], S.rc.level)}</div>`;
    h += `<div class="stats"><div class="bx"><b>${st.streak}</b>Serie</div><div class="bx"><b>${st.best}</b>Beste Serie</div><div class="bx"><b>${st.ok}/${st.n}</b>Richtig</div></div>`;
    h += `<div class="big" style="font-size:17px">${esc(ctx.t.title)} <span class="lv">${dots(ctx.t.level)}</span></div>`;
    h += exHTML(ctx, 'rt', '<button class="btn" data-a="hint">💡 Tipp</button>');
    h += ctx.res ? `<div class="btns"><button class="btn pri" data-a="next">Nächste Aufgabe</button></div>` : '<div class="btns"><button class="btn" data-a="show">Lösung zeigen (Serie beginnt neu)</button></div>';
    if (ctx.res && !ctx.res.ok && !ctx.res.shown) h += '<p class="hint2">Falsch beantwortet: Die Serie beginnt neu.</p>';
    $('#rtView').innerHTML = h + '</div>';
  }
  wire($('#rtView'), () => S.r, {
    chk: () => { const ctx = S.r, r = evalQ(ctx.q, ctx.ans); if (r.empty) { toast('Trage zuerst ein Ergebnis ein.'); return; } if (r.nan && ctx.q.ask) { toast('Bitte gib eine Zahl ein.'); return; } trainerResult(r, false); },
    hint: () => { const c = S.r; c.tipn = Math.min(2, (c.tipn || 0) + 1); tipSheet(c.q, c.tipn); },
    show: () => { const ctx = S.r, r = evalQ(ctx.q, ctx.ans); trainerResult(Object.assign({}, r, { ok: false, empty: false }), true); },
    next: newTrainer,
    other: e => { const c = e.target.closest('[data-rc]'), l = e.target.closest('[data-rl]'); if (c) { S.rc.cat = c.dataset.rc; newTrainer(); } else if (l) { S.rc.level = +l.dataset.rl; newTrainer(); } }
  });

  /* ============================================================ Hilfe */
  function renderHelp() {
    const ex = id => D.examples.find(e => e.id === id), tab = id => { const e = ex(id), r = compute(e.mode, Object.assign({}, FIELDS[e.mode].def, e.params)); return schemaTable(r.rows, { calc: true }); };
    $('#helpView').innerHTML = `
    <details open><summary>📦 Bezugskalkulation (Einkauf)</summary><div class="hb2">
      <p>Ziel: der <b>Bezugspreis (Einstandspreis)</b>, also das, was die Ware am Ende wirklich kostet. Rabatt und Skonto sind Abzüge, Bezugskosten ein Zuschlag.</p>
      <span class="eq">Listeneinkaufspreis − Liefererrabatt = Zieleinkaufspreis</span><span class="eq">Zieleinkaufspreis − Liefererskonto = Bareinkaufspreis</span><span class="eq">Bareinkaufspreis + Bezugskosten = Bezugspreis</span>
      ${tab('b1')}<p>Rabatt rechnest du vom Listenpreis, Skonto erst danach vom Zieleinkaufspreis. Bezugskosten (Fracht, Verpackung, Zoll) kommen nach dem Skonto dazu, weil darauf kein Skonto gewährt wird.</p></div></details>
    <details><summary>🏭 Selbstkosten im Industriebetrieb</summary><div class="hb2">
      <p>Einzelkosten kennt man direkt. Gemeinkosten kommen über <b>Zuschlagssätze</b> dazu: Material und Fertigung auf ihre Einzelkosten, Verwaltung und Vertrieb auf die Herstellkosten.</p>
      <span class="eq">Materialkosten = Materialeinzelkosten + Materialgemeinkosten</span><span class="eq">Fertigungskosten = Fertigungslöhne + Fertigungsgemeinkosten</span><span class="eq">Herstellkosten = Materialkosten + Fertigungskosten</span><span class="eq">Selbstkosten = Herstellkosten + Verwaltungs- + Vertriebsgemeinkosten</span>
      <span class="eq">Zuschlagssatz = Gemeinkosten : Einzelkosten × 100</span>
      ${tab('b2')}<p class="hint2">Hinweis für Ausbilder: Sondereinzelkosten der Fertigung und des Vertriebs sowie Bestandsveränderungen sind in diesem Lab nicht enthalten. Der Betrieb kann ein erweitertes Schema nutzen.</p></div></details>
    <details><summary>🧾 Angebotskalkulation vorwärts</summary><div class="hb2">
      <p>Von den Selbstkosten zum Preis, den der Kunde zahlt.</p>
      <span class="eq">Selbstkosten + Gewinn = Barverkaufspreis</span><span class="eq">Barverkaufspreis + Kundenskonto + Vertreterprovision = Zielverkaufspreis</span><span class="eq">Zielverkaufspreis + Kundenrabatt = Listenverkaufspreis (netto)</span><span class="eq">Listenverkaufspreis + Umsatzsteuer = Bruttoverkaufspreis</span>
      ${tab('b3')}<p>Umsatzsteuer: 19 % (Regelsatz) oder 7 % (ermäßigt, z. B. Bücher, viele Lebensmittel). Im Handel startet die Kalkulation beim Bezugspreis: Bezugspreis + Handlungskosten = Selbstkosten.</p></div></details>
    <details><summary>📐 „Im Hundert“ und „auf Hundert“</summary><div class="hb2">
      <p>Entscheidend ist, welcher Wert die <b>100 %</b> sind (die Bezugsgröße).</p>
      <table class="h"><tr><th>Art</th><th>100 % sind …</th><th>Beispiele</th></tr>
      <tr><td><b>Auf Hundert</b> (Aufschlag)</td><td>der kleinere Ausgangswert</td><td>Gewinn auf Selbstkosten, Handlungskosten auf Bezugspreis, Umsatzsteuer auf Netto</td></tr>
      <tr><td><b>Im Hundert</b></td><td>der größere Endwert</td><td>Skonto und Provision vom Zielverkaufspreis, Rabatt vom Listenverkaufspreis</td></tr></table>
      <p>Beispiel: Skonto 2 % und Provision 8 % im Hundert. Der Barverkaufspreis ist dann 100 − 2 − 8 = <b>90 %</b> des Zielverkaufspreises.</p>
      <span class="eq">Zielverkaufspreis = Barverkaufspreis × 100 : (100 − Skonto − Provision)</span><span class="eq">Listenverkaufspreis = Zielverkaufspreis × 100 : (100 − Rabatt)</span>
      <p>Falsch wäre: Barverkaufspreis × 1,10. Das wäre „auf Hundert“ und ergibt einen zu niedrigen Preis, weil der Kunde 10 % vom höheren Zielverkaufspreis abzieht.</p></div></details>
    <details><summary>↩️ Rückwärts- und Differenzkalkulation</summary><div class="hb2">
      <p><b>Rückwärts:</b> Der Markt gibt den Preis vor. Du drehst das Schema um und erhältst die höchsten Selbstkosten bzw. den höchsten Einkaufspreis. Beim Umdrehen gilt: „auf Hundert“ (Gewinn, Handlungskosten, USt) heißt durch (100 + %) teilen, „im Hundert“ (Skonto, Provision, Rabatt) heißt durch (100 − %) teilen.</p>
      ${tab('b5')}
      <p><b>Differenz:</b> Marktpreis nach unten rechnen bis zum Barverkaufspreis und die Selbstkosten abziehen. Positiv = Gewinn, negativ = Verlust.</p>
      <span class="eq">Differenz = Barverkaufspreis − Selbstkosten</span><span class="eq">Gewinn in % = Differenz : Selbstkosten × 100</span>${tab('b6')}</div></details>
    <details><summary>🔀 Handelsspanne, Kalkulationszuschlag, Kalkulationsfaktor</summary><div class="hb2">
      <span class="eq">Aufschlag = Verkaufspreis − Bezugspreis</span><span class="eq">Kalkulationszuschlag = Aufschlag : Bezugspreis × 100</span><span class="eq">Handelsspanne = Aufschlag : Verkaufspreis × 100</span><span class="eq">Kalkulationsfaktor = Verkaufspreis : Bezugspreis</span>
      <span class="eq">Spanne = Zuschlag : (100 + Zuschlag) × 100</span><span class="eq">Zuschlag = Spanne : (100 − Spanne) × 100</span><span class="eq">Faktor = 1 + Zuschlag : 100 = 100 : (100 − Spanne)</span>
      ${tab('b7')}<p>Die Spanne ist immer kleiner als der Zuschlag, weil ihre Bezugsgröße (der Verkaufspreis) größer ist. Beide Kennzahlen enthalten Handlungskosten und Gewinn.</p></div></details>
    <details><summary>📈 Deckungsbeitrag und Break-even</summary><div class="hb2">
      <span class="eq">Stückdeckungsbeitrag db = Preis p − variable Stückkosten kv</span><span class="eq">Gewinn = db × Menge − Fixkosten</span><span class="eq">Break-even-Menge = Fixkosten : db (aufrunden)</span><span class="eq">Break-even-Umsatz = Break-even-Menge × Preis</span>
      <span class="eq">Kurzfristige Preisuntergrenze = variable Stückkosten</span><span class="eq">Langfristige Preisuntergrenze = Stückkosten = kv + Kfix : Menge</span>
      ${tab('b8')}${chartDB({ p: 25, kv: 15, kfix: 12000, x: 1500 })}
      <p>Links vom Schnittpunkt der Geraden arbeitet der Betrieb mit Verlust, rechts mit Gewinn. Ist db ≤ 0, gibt es keinen Break-even.</p></div></details>
    <details><summary>🎯 Rundung, Eingabe, Prüfmodus</summary><div class="hb2">
      <p>Jedes Zwischenergebnis wird kaufmännisch auf Cent gerundet (ab 0,005 wird aufgerundet). Die Aufgaben nehmen Abweichungen bis ±0,01 € bzw. ±0,1 %-Punkt an.</p>
      <p>Zahlen schreibst du mit Komma (12,5) oder Punkt (12.5). Einheiten wie „€“ oder „%“ am Ende dürfen dabei stehen.</p>
      <p>Die Prozentsätze in den Aufgaben sind frei gewählte Übungswerte, keine Branchenwerte. Die Schemata folgen der üblichen Lehrbuch-Systematik; Betriebe und Lehrbücher können abweichen (Hinweis für Ausbilder: bitte mit dem eigenen Lehrbuch abgleichen).</p>
      <p>Im <b>Prüfmodus</b> (🎓) kostet jede der zwei Tipp-Stufen 25 % der Punkte.</p></div></details>`;
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  const TABS = [['calc', '🧮', 'Rechner'], ['bsp', '📚', 'Beispiele'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['help', '📘', 'Hilfe']];
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'calc'; S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    if (t === 'calc') renderCalc(); else if (t === 'bsp') renderBsp(); else if (t === 'tasks') renderTasks(); else if (t === 'rt') renderTrainer(); else if (t === 'help') renderHelp();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'Kalkulations-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = 'Kalkulations-Lab: ' + T[2];
    const sc = $('#pg' + { calc: 'Calc', bsp: 'Bsp', tasks: 'Tasks', rt: 'Rt', help: 'Help' }[t]); if (sc) sc.scrollTop = 0;
  }
  function setExam(on) { lsSet('exam', on ? '1' : '0'); updatePal(); $('#bExam').classList.toggle('on', on); $('#bExam').setAttribute('aria-pressed', on); toast(on ? '🎓 Prüfmodus an: Tipps kosten 25 % je Stufe.' : 'Prüfmodus aus: Tipps kosten nichts.'); if (S.tab === 'tasks') renderTasks(false); }
  let palSig = '';
  function updatePal() {
    const F = !!fx(), fxOn = F && !fx().isMuted(), sig = [F, fxOn, exam(), nDone(), S.rt.streak, S.rt.best].join('|'); if (sig === palSig) return; palSig = sig;
    $('#pal').innerHTML = `${F ? `<button class="chip ${fxOn ? 'on' : ''}" data-a="fx" aria-pressed="${fxOn}" title="Effekte und Ton">${fxOn ? '🎉' : '🔇'} Effekte</button>` : ''}<button class="chip ${exam() ? 'on' : ''}" data-a="exam" aria-pressed="${exam()}" title="Prüfmodus: Tipps zählen als Abzug">🎓 Prüfmodus</button><button class="chip" data-a="rand" title="Zufällige Aufgabe im Trainer">🎲 Zufallsaufgabe</button>
      <span id="stat">Aufgaben gelöst <b>${nDone()}/${TASKS.length}</b> · Serie <b>${S.rt.streak}</b> · Beste Serie <b>${S.rt.best}</b></span>`;
    $('#bExam').classList.toggle('on', exam());
  }
  $('#pal').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.a === 'fx') { const F = fx(); if (F) { F.setMuted(!F.isMuted()); palSig = ''; updatePal(); if (!F.isMuted()) ding(); } }
    else if (b.dataset.a === 'exam') setExam(!exam());
    else if (b.dataset.a === 'rand') { setTab('rt'); newTrainer(); }
  });
  $('#bTasks').onclick = () => setTab('tasks'); $('#bHelp').onclick = () => setTab('help'); $('#bExam').onclick = () => setExam(!exam());
  $('#title').onclick = () => setTab('calc');
  $('#bMenu').onclick = () => {
    const rows = [['calc', 'Rechner', 'Sieben Kalkulationsschemata mit Rechenweg'], ['bsp', 'Beispiele', D.examples.length + ' fertig durchgerechnete Beispiele'], ['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung und Tipps'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Aufgaben mit Serien-Zähler'], ['help', 'Hilfe und Spickzettel', 'Schemata, im/auf Hundert, Formeln'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben und Trainer-Serie auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
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
      b.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (!x) return; if (x.dataset.x === 'yes') { ['done', 'prog', 'hints', 'ctipps', 'rt'].forEach(k => { try { localStorage.removeItem(LS + k); } catch (er) {} }); S.rt = { n: 0, ok: 0, streak: 0, best: 0 }; S.t = null; palSig = ''; updatePal(); updateBadge(); if (S.tab === 'tasks') renderTasks(); toast('Fortschritt gelöscht'); } close(); });
    });
  }

  /* Schnittstelle für Karriere/Lernpfad */
  root.KAL_LAB = { id: 'kal', title: 'Kalkulations-Lab', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.KAL_TASKS };

  buildTabs(); updatePal(); setTab(S.tab);
  /* Aufruf ?aufgabe=kal1 (Startseite, Lernhefte): Aufgabe gleich öffnen; ?bsp: Beispielauswahl */
  try {
    const qs = new URLSearchParams(location.search), qa = qs.get('aufgabe');
    if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); } else if (qs.has('bsp')) setTab('bsp');
  } catch (e) {}
})(window);
