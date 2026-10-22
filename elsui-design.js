'use strict';
/* Tonfunk Sicherheits-Lab: Tab "Auslegen" (WP3c, SPEC 6.4).
   Assistent in vier Schritten, jeder mit Häkchen: (1) Verbraucher (Leistung -> Betriebsstrom Ib), (2) Leitung (Querschnitt, Länge -> Iz, R_L),
   (3) Schutz (Netzform, Schutzorgan, In -> Abschaltbedingung mit Zs, Ia, t_ab, U_B), (4) Zusatzschutz und Ergebnis (RCD, Ampel, design.circuit-Texte, kleinster Querschnitt über design.minCross).
   ALLE Rechnungen und Texte kommen aus ELS_CORE (formulas.ibNenn/rLeiter, prot.cable, design.circuit, design.minCross, design.stringText); hier steht keine zweite Formelimplementierung
   (SPEC Regel 7). Fehlt der Kern oder eine Funktion, erscheint ein deutscher Hinweis statt Zahlen. Die Leistungen der Geräteliste sind Übungswerte (A), keine Messwerte.
   Speichern: lsSet('els.design', { v, st, step }); getState()/setState(o) für Speichern und Teilen.
   Schnittstelle (VERTRAG 6.5): window.ELS_UI_EXT.design.render(host, api). Die Rechenfunktionen (ohne DOM) hängen unter ELS_UI_EXT.design.fn und werden von test_elsui_ext2.js geprüft. */
(function (root) {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fin = v => typeof v === 'number' && isFinite(v);
  const CORE = () => root.ELS_CORE;
  const tryf = (f, d) => { try { const r = f(); return r === undefined ? d : r; } catch (e) { return d; } };
  const fm = (v, d) => { const C = CORE(); if (C && typeof C.fmt === 'function') return tryf(() => C.fmt(v, d), '–'); return fin(v) ? (+v).toFixed(d == null ? 2 : d).replace('.', ',') : '–'; };
  const eng = (v, u) => { const C = CORE(); if (C && typeof C.fmtEng === 'function') return tryf(() => C.fmtEng(v, u), '–'); return fin(v) ? fm(v, 3) + (u ? ' ' + u : '') : '–'; };
  const NOCORE = 'Der Rechenkern ist nicht geladen (elscore.js und elscore-pruef.js fehlen). Ohne ihn gibt es hier keine Zahlen.';
  const NOFN = n => 'Dem Rechenkern fehlt die Funktion ' + n + ' (elscore-pruef.js ist nicht vollständig geladen). Die Auslegung liefert deshalb keine Zahlen.';
  const has = (...path) => { let o = CORE(); for (const k of path) { if (!o) return false; o = o[k]; } return typeof o === 'function'; };
  let A = null; /* api der Seite (nur Oberfläche, nie Rechnung) */

  /* ============================================================ Eingaben */
  function num(txt) {
    if (typeof txt === 'number') return fin(txt) ? txt : NaN;
    const C = CORE(), t = String(txt == null ? '' : txt).trim(); if (!t) return NaN;
    const v = C && typeof C.parseNum === 'function' ? tryf(() => C.parseNum(t), NaN) : parseFloat(t.replace(/\s/g, '').replace(',', '.'));
    return fin(v) ? v : NaN;
  }
  /* Übungswerte (A): Leistungen der Beispielgeräte, keine Messwerte */
  const DEVICES = [['frei', 'Eigene Leistung eingeben', null], ['leuchte', 'Leuchte (Übungswert)', 60], ['werkstatt', 'Werkstattgerät (Übungswert)', 1000], ['kocher', 'Wasserkocher (Übungswert)', 2000], ['waschm', 'Waschmaschine (Übungswert)', 2300], ['backofen', 'Backofen (Übungswert)', 3500]];
  const QS = ['1,5', '2,5', '4', '6'];
  const INS = ['10', '13', '16', '20', '25', '32'];
  const FORMS = [['TN-S', 'TN-S'], ['TN-C-S', 'TN-C-S'], ['TT', 'TT'], ['IT', 'IT']];
  const DEVS = [['LS-B', 'LS-Schalter B'], ['LS-C', 'LS-Schalter C'], ['LS-D', 'LS-Schalter D'], ['gG', 'Sicherung gG']];
  const RCDS = [['0', 'kein RCD'], ['30', 'RCD 30 mA'], ['300', 'RCD 300 mA']];
  const RTYPES = [['A', 'Typ A'], ['AC', 'Typ AC'], ['F', 'Typ F'], ['B', 'Typ B']];
  const defaults = () => ({ geraet: 'kocher', P: '2000', q: '2,5', l: '20', form: 'TN-S', dev: 'LS-B', In: '16', zv: '0,4', ra: '50', rb: '2', rcd: '0', rtype: 'A' });
  const STEPS = [[1, '🔌', 'Verbraucher'], [2, '📏', 'Leitung'], [3, '🛡️', 'Schutz'], [4, '✅', 'Ergebnis']];

  /* Auslegung -> Konfiguration für ELS_CORE.design.circuit (Kern prüft jede Zahl selbst) */
  function cfgOf(st) {
    st = Object.assign(defaults(), st || {});
    const P = num(st.P), q = num(st.q), l = num(st.l), In = num(st.In), zv = num(st.zv), ra = num(st.ra), rb = num(st.rb), rcd = num(st.rcd);
    if (!fin(P) || P < 0) return { ok: false, why: 'Bitte die Leistung als Zahl größer oder gleich 0 eintragen (Komma oder Punkt).' };
    if (!fin(q)) return { ok: false, why: 'Bitte einen Querschnitt wählen.' };
    if (!fin(l) || l <= 0) return { ok: false, why: 'Bitte die Leitungslänge als Zahl größer als 0 eintragen.' };
    if (!fin(In) || In <= 0) return { ok: false, why: 'Bitte einen Nennstrom wählen.' };
    if (!fin(zv) || zv < 0) return { ok: false, why: 'Bitte die Netzimpedanz Zv als Zahl größer oder gleich 0 eintragen.' };
    const cfg = { P, q, qpe: q, l, form: String(st.form), dev: String(st.dev), In, zv, rcd: { on: fin(rcd) && rcd > 0, idn: fin(rcd) && rcd > 0 ? rcd : 30, type: String(st.rtype || 'A') } };
    if (cfg.form === 'TT') { if (!fin(ra) || ra <= 0) return { ok: false, why: 'Im TT-System braucht die Auslegung den Erdungswiderstand R_A als Zahl größer als 0.' }; cfg.ra = ra; cfg.rb = fin(rb) && rb >= 0 ? rb : 0; }
    return { ok: true, cfg };
  }
  function rcdOf(st) { const r = num((st || {}).rcd); return fin(r) && r > 0 ? r : 0; }
  /* Prüfstand-Steuerwerte (Netz): nur Durchreichen der eigenen Eingaben */
  function rigControls(st) {
    st = Object.assign(defaults(), st || {});
    const c = { form: String(st.form), q: num(st.q), qpe: num(st.q), l: num(st.l), zv: num(st.zv), dev: String(st.dev), In: num(st.In), kreis: 'end', rcd: rcdOf(st), fehler: 'koerperschluss' };
    if (st.form === 'TT') { c.ra = num(st.ra); c.rb = num(st.rb); }
    Object.keys(c).forEach(k => { if (typeof c[k] === 'number' && !fin(c[k])) delete c[k]; });
    return c;
  }

  /* ============================================================ reine Auslegung (alles aus ELS_CORE) */
  function evaluate(st) {
    const C = CORE(); if (!C) return { ok: false, why: NOCORE, steps: [1, 2, 3, 4].map(n => ({ n, ok: false, lines: [], why: NOCORE })) };
    if (!has('design', 'circuit') || !has('design', 'minCross') || !has('prot', 'cable') || !C.formulas || !C.formulas.ibNenn || !C.formulas.rLeiter) {
      const w = NOFN('design.circuit / design.minCross / prot.cable / formulas'); return { ok: false, why: w, steps: [1, 2, 3, 4].map(n => ({ n, ok: false, lines: [], why: w })) };
    }
    st = Object.assign(defaults(), st || {});
    const out = { ok: true, steps: [], st };
    const P = num(st.P), q = num(st.q), l = num(st.l), U0 = C.const && fin(C.const.U0) ? C.const.U0 : 230;
    /* Schritt 1: Verbraucher */
    const s1 = { n: 1, ok: false, lines: [], why: '' };
    if (!fin(P) || P < 0) s1.why = 'Bitte die Leistung als Zahl größer oder gleich 0 eintragen (Komma oder Punkt).';
    else { const e = C.formulas.ibNenn.explain(P, U0, 1); if (e && e.ok && fin(e.value)) { s1.ok = e.value > 0; s1.ib = e.value; s1.lines.push('Ib = P / (U · cos φ) = ' + e.text + ' (cos φ = 1 als Rechenwert).'); if (!s1.ok) s1.why = 'Bei 0 W fließt kein Betriebsstrom: Trage eine Leistung größer als 0 ein.'; } else s1.why = (e && e.why) || 'Mit diesen Werten gibt es kein Ergebnis.'; }
    out.steps.push(s1);
    /* Schritt 2: Leitung */
    const s2 = { n: 2, ok: false, lines: [], why: '' };
    const cab = tryf(() => C.prot.cable(q), null);
    if (!cab || cab.ok === false) s2.why = (cab && cab.why) || 'Bitte einen Querschnitt aus der Liste wählen.';
    else if (!fin(l) || l <= 0) s2.why = 'Bitte die Leitungslänge als Zahl größer als 0 eintragen.';
    else {
      const rho = C.const && fin(C.const.rho) ? C.const.rho : 0.0178, e = C.formulas.rLeiter.explain(l, q, rho);
      s2.iz = cab.iz; s2.ok = !!(e && e.ok);
      s2.lines.push('Iz = ' + eng(cab.iz, 'A') + ' (' + cab.text + ')');
      if (e && e.ok) { s2.rl = e.value; s2.lines.push('R_L = ρ · l / q = ' + e.text + ' je Leiter (Hin- und Rückleiter, Außenleiter und Schutzleiter, zählen beide zur Schleife).'); } else s2.why = (e && e.why) || 'Mit diesen Werten gibt es kein Ergebnis.';
    }
    out.steps.push(s2);
    /* Schritte 3 und 4: Kern-Auslegung mit einer Rechnung */
    const cf = cfgOf(st), s3 = { n: 3, ok: false, lines: [], why: '' }, s4 = { n: 4, ok: false, lines: [], why: '' };
    if (!cf.ok) { s3.why = cf.why; s4.why = cf.why; out.steps.push(s3, s4); out.circuit = null; out.min = null; return out; }
    const ci = C.design.circuit(cf.cfg); out.cfg = cf.cfg;
    if (!ci || ci.ok === false) { const w = (ci && ci.why) || 'Mit diesen Werten gibt es kein Ergebnis.'; s3.why = w; s4.why = w; out.steps.push(s3, s4); out.circuit = null; out.min = null; return out; }
    out.circuit = ci;
    s3.lines.push(ci.check && ci.check.text ? ci.check.text : '');
    const f = ci.fault || {};
    s3.lines.push(ci.text[2] || '');
    if (f.form !== 'IT' && fin(ci.tAb)) s3.lines.push('Abschaltzeit t_ab = ' + eng(ci.tAb, 's') + ' (höchstens ' + eng(f.grenze, 's') + (ci.tOK ? ': eingehalten' : ': nicht eingehalten') + ').');
    s3.lines = s3.lines.filter(Boolean);
    s3.ok = !!(ci.ibOk && ci.izOk && ci.zsOk !== false);
    if (!s3.ok) s3.why = !ci.ibOk ? 'Der Betriebsstrom ist größer als der Nennstrom des Schutzorgans.' : !ci.izOk ? 'Der Nennstrom ist größer als die Strombelastbarkeit der Leitung.' : 'Die Abschaltbedingung ist nicht erfüllt.';
    out.steps.push(s3);
    s4.lines.push(ci.text[3] || '');
    s4.lines.push('Ampel: ' + ci.sym + ' ' + ({ gruen: 'grün', gelb: 'gelb', rot: 'rot', grau: 'grau' }[ci.ampel] || ci.ampel) + '.');
    const mc = tryf(() => { const c2 = Object.assign({}, cf.cfg); delete c2.q; delete c2.qpe; return C.design.minCross(c2); }, null);
    out.min = mc;
    if (mc) s4.lines.push(mc.ok === false ? (mc.why || '') : mc.text);
    s4.lines = s4.lines.filter(Boolean);
    s4.ok = ci.ampel !== 'rot' && ci.ampel !== 'grau';
    if (!s4.ok) s4.why = 'Die Ampel ist ' + (ci.ampel === 'rot' ? 'rot' : 'grau') + ': Ändere in den Schritten davor etwas.';
    out.ampel = ci.ampel; out.sym = ci.sym;
    out.steps.push(s4);
    return out;
  }
  const stringText = r => { const C = CORE(); return C && C.design && typeof C.design.stringText === 'function' && r && r.circuit ? tryf(() => C.design.stringText(r.circuit), '') : ''; };

  /* ============================================================ Zustand */
  const ST = { st: defaults(), step: 1, A: null };
  const getState = () => JSON.parse(JSON.stringify({ v: 1, st: ST.st, step: ST.step }));
  function setState(o) {
    if (!o || typeof o !== 'object' || !o.st || typeof o.st !== 'object') return false;
    const d = defaults(), st = {}; Object.keys(d).forEach(k => { st[k] = o.st[k] != null ? String(o.st[k]) : d[k]; });
    ST.st = st; ST.step = Math.min(4, Math.max(1, Math.floor(Number(o.step)) || 1)); return true;
  }
  function save() { try { if (A && typeof A.lsSet === 'function') A.lsSet('els.design', getState()); } catch (e) {} }

  /* ============================================================ Oberfläche */
  const CSS = '<style>.ed-bar{display:flex;gap:6px;margin:0 0 10px;flex-wrap:wrap}.ed-bar button{flex:1 1 120px;min-height:44px;border-radius:12px;border:2px solid var(--line);background:var(--panel);color:var(--fg);font:inherit;font-weight:600;cursor:pointer}.ed-bar button.on{border-color:var(--accent)}.ed-bar button.ok{border-color:var(--amp-ok)}.ed-g{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}.ed-g label{flex:1 1 170px;min-width:140px;font-size:12.5px;color:var(--mute)}.ed-g input,.ed-g select{margin-top:3px;min-height:42px}.ed-res{margin-top:10px}.ed-res li{margin:3px 0}.ed-why{color:var(--danger);font-size:13.5px;margin:6px 0 0}</style>';
  function opt(list, v) { return list.map(o => `<option value="${esc(o[0])}"${String(o[0]) === String(v) ? ' selected' : ''}>${esc(o[1])}</option>`).join(''); }
  const fld = (k, label, inner) => `<label for="ed_${k}">${esc(label)}${inner}</label>`;
  const inp = (k, v) => `<input id="ed_${k}" data-k="${k}" inputmode="decimal" autocomplete="off" value="${esc(v)}">`;
  const sel = (k, list, v) => `<select id="ed_${k}" data-k="${k}">${opt(list, v)}</select>`;
  function stepFields(n, st) {
    if (n === 1) return `<div class="ed-g">${fld('geraet', 'Gerät (Leistung ist ein Übungswert)', sel('geraet', DEVICES.map(d => [d[0], d[1] + (d[2] ? ', ' + d[2] + ' W' : '')]), st.geraet))}${fld('P', 'Leistung P in W', inp('P', st.P))}</div>`;
    if (n === 2) return `<div class="ed-g">${fld('q', 'Querschnitt in mm² (Außen- und Schutzleiter)', sel('q', QS.map(x => [x, x + ' mm²']), st.q))}${fld('l', 'Leitungslänge l in m', inp('l', st.l))}</div>`;
    if (n === 3) return `<div class="ed-g">${fld('form', 'Netzform', sel('form', FORMS, st.form))}${fld('dev', 'Schutzorgan', sel('dev', DEVS, st.dev))}${fld('In', 'Nennstrom In in A', sel('In', INS.map(x => [x, x + ' A']), st.In))}${fld('zv', 'Netzimpedanz Zv in Ω (Übungswert)', inp('zv', st.zv))}${st.form === 'TT' ? fld('ra', 'Anlagenerder R_A in Ω', inp('ra', st.ra)) + fld('rb', 'Betriebserder R_B in Ω', inp('rb', st.rb)) : ''}</div>`;
    return `<div class="ed-g">${fld('rcd', 'Zusatzschutz', sel('rcd', RCDS, st.rcd))}${fld('rtype', 'RCD-Typ', sel('rtype', RTYPES, st.rtype))}</div>`;
  }
  function resHtml(ev, n) {
    const s = ev.steps[n - 1]; if (!s) return '';
    let h = '';
    if (s.lines.length) h += `<ol>${s.lines.map(t => `<li>${esc(t)}</li>`).join('')}</ol>`;
    if (s.why) h += `<p class="ed-why" role="status">${esc(s.why)}</p>`;
    if (n === 4 && ev.circuit) {
      const k = { gruen: 'ok', gelb: 'warnc', rot: 'bad', grau: '' }[ev.ampel] || '';
      h = `<div class="amprow ${k}" role="status"><span class="asym" aria-hidden="true">${esc(ev.sym)}</span><div class="atx"><b>Ampel: ${esc({ gruen: 'grün', gelb: 'gelb', rot: 'rot', grau: 'grau' }[ev.ampel] || '')}</b><small>${esc(stringText(ev))}</small><small class="nt">${esc(CORE() && CORE().TEXTS ? CORE().TEXTS.ampelHinweis : '')}</small></div></div>` + h;
    }
    return h;
  }
  function barHtml(ev) {
    return STEPS.map(([n, ic, name]) => { const ok = ev.steps[n - 1] && ev.steps[n - 1].ok; return `<button data-step="${n}" class="${ST.step === n ? 'on' : ''}${ok ? ' ok' : ''}" aria-label="Schritt ${n} ${name}${ok ? ', geprüft' : ', noch nicht geprüft'}"${ST.step === n ? ' aria-current="step"' : ''}>${ok ? '✓' : ic} ${n} ${name}</button>`; }).join('');
  }
  const TITLES = ['Verbraucher: Wie viel Strom fließt im Betrieb?', 'Leitung: Was hält sie aus, wie groß ist ihr Widerstand?', 'Schutz: Schaltet das Schutzorgan im Fehlerfall rechtzeitig ab?', 'Zusatzschutz und Ergebnis'];
  function panelHtml(ev) {
    const n = ST.step, st = ST.st;
    const nav = `<div class="btns">${n > 1 ? '<button class="btn" data-nav="-1">Zurück</button>' : ''}${n < 4 ? '<button class="btn pri" data-nav="1">Weiter</button>' : '<button class="btn pri" data-act="rig">Im Prüfstand ansehen</button><button class="btn" data-act="reset">Neu beginnen</button>'}</div>`;
    return `<div class="card pl"><h4>Schritt ${n} von 4</h4><p class="big">${esc(TITLES[n - 1])}</p>${stepFields(n, st)}<div class="ed-res" data-dres aria-live="polite">${resHtml(ev, n)}</div>${nav}</div>`;
  }
  function renderAll() {
    const C = CORE(), ev = evaluate(ST.st);
    const top = `<div class="card pl"><h4>Auslegen</h4><p class="big">Stromkreis auslegen in vier Schritten</p><p class="hint2" style="margin:0">Jeder Schritt rechnet mit demselben Kern wie die Prüfstände. Die Vorgaben sind Übungswerte, die Norm und die Angaben des Herstellers sind maßgeblich. Übungsanlage, keine Anleitung für Arbeiten an Netzspannung. ${esc(C && C.TEXTS ? C.TEXTS.simOnly : '')}</p></div>`;
    if (!C) return CSS + top + `<div class="card pl"><p class="ed-why">${esc(NOCORE)}</p></div>`;
    if (ev.ok === false) return CSS + top + `<div class="card pl"><p class="ed-why">${esc(ev.why)}</p></div>`;
    return CSS + top + `<div class="ed-bar" data-dbar role="group" aria-label="Schritte">${barHtml(ev)}</div><div data-dpanel>${panelHtml(ev)}</div>`;
  }
  function stat() { try { if (A && typeof A.stat === 'function') A.stat('elsdesign', 1); } catch (e) {} }
  function redraw(host) { host.innerHTML = renderAll(); }
  function onInput(host, e) {
    const t = e && e.target; if (!t || !t.dataset || !t.dataset.k) return;
    const k = t.dataset.k; ST.st[k] = String(t.value);
    if (k === 'geraet') { const d = DEVICES.find(x => x[0] === t.value); if (d && d[2] != null) ST.st.P = String(d[2]); else if (d && d[2] == null) { /* frei: Leistung bleibt */ } }
    if (k === 'P') { const d = DEVICES.find(x => x[0] === ST.st.geraet); if (d && d[2] != null && String(d[2]) !== String(t.value)) ST.st.geraet = 'frei'; }
    save();
    if (k === 'form' || k === 'geraet' || k === 'P') { if (e.type === 'change' || k !== 'P') { redraw(host); return; } }
    const ev = evaluate(ST.st), r = host.querySelector('[data-dres]'), b = host.querySelector('[data-dbar]');
    if (r) r.innerHTML = resHtml(ev, ST.step); if (b) b.innerHTML = barHtml(ev);
    if (e.type === 'change' && ST.step === 4 && ev.steps[3] && ev.steps[3].ok) stat();
  }
  function onClick(host, e) {
    const t = e && e.target && e.target.closest ? e.target : null; if (!t) return;
    const sb = t.closest('[data-step]'), nb = t.closest('[data-nav]'), ab = t.closest('[data-act]');
    if (sb) { ST.step = Math.min(4, Math.max(1, +sb.dataset.step)); save(); redraw(host); if (ST.step === 4) { const ev = evaluate(ST.st); if (ev.steps[3] && ev.steps[3].ok) stat(); } }
    else if (nb) { ST.step = Math.min(4, Math.max(1, ST.step + (+nb.dataset.nav))); save(); redraw(host); if (ST.step === 4) { const ev = evaluate(ST.st); if (ev.steps[3] && ev.steps[3].ok) stat(); } }
    else if (ab && ab.dataset.act === 'reset') { ST.st = defaults(); ST.step = 1; save(); redraw(host); }
    else if (ab && ab.dataset.act === 'rig') {
      const ev = evaluate(ST.st); if (!ev.circuit) { if (A && A.toast) A.toast('Erst eine gültige Auslegung eingeben.'); return; }
      if (A && typeof A.loadRig === 'function') A.loadRig({ rig: 'netz', name: 'Auslegung', controls: rigControls(ST.st), toast: 'Die Auslegung steht im Prüfstand Netzform' });
      else if (A && typeof A.setTab === 'function') A.setTab('rig');
    }
  }
  function render(host, api) {
    A = api || A;
    if (!ST.A) { ST.A = true; const o = A && typeof A.lsGet === 'function' ? tryf(() => A.lsGet('els.design', null), null) : null; if (o) setState(o); }
    host.innerHTML = renderAll();
    if (!host._elsDesign) { host._elsDesign = true; host.addEventListener('input', e => onInput(host, e)); host.addEventListener('change', e => onInput(host, e)); host.addEventListener('click', e => onClick(host, e)); }
  }

  const API = { render, getState, setState, fn: { defaults, cfgOf, evaluate, rigControls, stringText, num, devices: DEVICES }, _st: ST };
  root.ELS_UI_EXT = root.ELS_UI_EXT || {}; root.ELS_UI_EXT.design = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
