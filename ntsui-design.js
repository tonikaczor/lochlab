'use strict';
/* Tonfunk Netzteil-Lab: Tab "Auslegen" (WP3c, SPEC 6.3).
   Assistent in vier Schritten, jeder mit Häkchen: (1) Verbraucher (U_aus, I_aus), (2) Netzteiltyp (Linear mit Trafo, Gleichrichter, C und Regler gegen Schaltregler;
   Vorschlag aus topology), (3) Bauteile (U2, C, R2 beziehungsweise L und C), (4) Ergebnis (Ampel, Verlustvergleich Linear gegen Schalt, Hinweis Kühlung/EMV).
   ALLE Rechnungen und Texte kommen aus NTS_CORE (design.linear, design.buck, design.stringText, topology, lin.loss/eta, loss.vsLinear, TEXTS, limit);
   hier steht keine zweite Formelimplementierung (SPEC Regel 7). Die Zeilen der Auslegung (design.*.text) werden nur auf die Schritte verteilt.
   Rundungsregeln der Auslegung (U2 auf volle Volt, C und L aus E6, Brumm 10 % von Û, Kleinstlast 10 %) sind Übungsregeln (F42), das zeigt die Oberfläche an.
   Fehlt der Kern oder eine Funktion, erscheint ein deutscher Hinweis statt Zahlen.
   Speichern: lsSet('nts.design', { v, st, step }); getState()/setState(o) für Speichern, Teilen und Aufgaben (applyTaskDesign in ntsui.js).
   Schnittstelle (VERTRAG 6.4): window.NTS_UI_EXT.design.render(host, api). Die Rechenfunktionen (ohne DOM) hängen unter NTS_UI_EXT.design.fn
   und werden von quelle/ntslab/test_ntsui_ext2.js geprüft. */
(function (root) {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fin = v => typeof v === 'number' && isFinite(v);
  const CORE = () => root.NTS_CORE;
  const tryf = (f, d) => { try { const r = f(); return r === undefined ? d : r; } catch (e) { return d; } };
  const fm = (v, d) => { const C = CORE(); if (C && typeof C.fmt === 'function') return tryf(() => C.fmt(v, d), '–'); return fin(v) ? (+v).toFixed(d == null ? 2 : d).replace('.', ',') : '–'; };
  const eng = (v, u) => { const C = CORE(); if (C && typeof C.fmtEng === 'function') return tryf(() => C.fmtEng(v, u), '–'); return fin(v) ? fm(v, 3) + (u ? ' ' + u : '') : '–'; };
  const NOCORE = 'Der Rechenkern ist nicht geladen (ntscore.js, ntscore-sw.js und ntscore-diag.js fehlen). Ohne ihn gibt es hier keine Zahlen.';
  const NOFN = n => 'Dem Rechenkern fehlt die Funktion ' + n + ' (ntscore-diag.js ist nicht vollständig geladen). Dieser Assistent liefert deshalb keine Zahlen.';
  const textOf = id => { const C = CORE(), t = C && C.TEXTS ? C.TEXTS[id] : null; return typeof t === 'string' ? t : ''; };
  const limV = id => { const C = CORE(); const l = C && typeof C.limit === 'function' ? tryf(() => C.limit(id), null) : null; return l && fin(l.value) ? l.value : NaN; };
  const dnum = x => (fin(x) ? fm(Number(Number(x).toPrecision(6)), 6).replace(/,?0+$/, '') : '');
  let A = null; /* api der Seite (nur Oberfläche, nie Rechnung) */

  /* ============================================================ Eingaben */
  const TYPES = [['linear', 'Linearnetzteil: Trafo, Gleichrichter, Ladekondensator, Linearregler'], ['buck', 'Schaltregler: Tiefsetzsteller aus einer Gleichspannung']];
  const STEPS = [[1, '🔌', 'Verbraucher'], [2, '🧭', 'Netzteiltyp'], [3, '🔧', 'Bauteile'], [4, '✅', 'Ergebnis']];
  const TITLES = ['Verbraucher: Was soll versorgt werden?', 'Netzteiltyp: Linear oder Schaltregler?', 'Bauteile: Was wird gebraucht?', 'Ergebnis und Vergleich'];
  const SEL = {
    topo: [['bruecke', 'Brückengleichrichter'], ['einweg', 'Einweggleichrichter']],
    regler: [['auto', 'Regler passend wählen (7805, 7812 oder LM317)'], ['7805', '7805 (nur 5 V)'], ['7812', '7812 (nur 12 V)'], ['lm317', 'LM317 (einstellbar)']]
  };
  /* Felder je Schritt: key, Beschriftung, Anzeigeeinheit, Skalierung auf SI, Grundeinheit (für Einheitenzusatz), Vorgabe (Übungswert) oder select */
  const FIELDS = () => ({
    verbr: [{ key: 'uaus', label: 'Ausgangsspannung U_aus', unit: 'V', base: 'V', scale: 1, def: '5' }, { key: 'i', label: 'Laststrom I_aus', unit: 'A', base: 'A', scale: 1, def: '0,5' }],
    typ: [{ key: 'typ', label: 'Netzteiltyp', select: TYPES, def: 'linear' }, { key: 'uin', label: 'Eingangsspannung (Gleichspannung, für den Vorschlag und den Schaltregler)', unit: 'V', base: 'V', scale: 1, def: '12' }],
    lin: [{ key: 'topo', label: 'Gleichrichter', select: SEL.topo, def: 'bruecke' }, { key: 'regler', label: 'Regler', select: SEL.regler, def: 'auto' }, { key: 'r1', label: 'R1 des LM317 (nur beim LM317)', unit: 'Ω', base: 'Ω', scale: 1, def: '240' }],
    buck: [{ key: 'f', label: 'Schaltfrequenz f', unit: 'kHz', base: 'Hz', scale: 1e3, def: '100' }, { key: 'esr', label: 'ESR des Ausgangskondensators', unit: 'mΩ', base: 'Ω', scale: 1e-3, def: '50' }]
  });
  function defaults() { const st = { typ: 'linear', uin: '12' }; const F = FIELDS(); ['verbr', 'lin', 'buck'].forEach(g => { st[g] = {}; F[g].forEach(f => { st[g][f.key] = f.def; }); }); return st; }
  const ST = { st: defaults(), step: 1 };
  const PREFIX = { '': 1, p: 1e-12, n: 1e-9, 'µ': 1e-6, u: 1e-6, m: 1e-3, k: 1e3, M: 1e6, G: 1e9 };
  /* Text -> SI-Zahl: ohne Einheit gilt die Anzeigeeinheit des Feldes, mit Einheit (zum Beispiel "300 mA") Vorsatz plus Grundeinheit des Feldes */
  function readNum(txt, f) {
    const C = CORE(), sc = (f && f.scale) || 1, base = (f && f.base) || '';
    if (typeof txt === 'number') return fin(txt) ? txt * sc : NaN;
    const t = String(txt == null ? '' : txt).trim(); if (!t) return NaN;
    const q = C && typeof C.parseUnit === 'function' ? tryf(() => C.parseUnit(t), null) : null;
    let v, unit;
    if (q && fin(q.value)) { v = q.value; unit = String(q.unit || ''); }
    else { const m = /^([+-]?\d+(?:[.,]\d+)?(?:[eE][+-]?\d+)?)\s*(\S*)$/.exec(t); if (!m) return NaN; v = Number(m[1].replace(',', '.')); unit = m[2] || ''; }
    if (!fin(v)) return NaN;
    if (unit === '') return v * sc;
    if (unit === 'Ohm' || unit === 'ohm') unit = 'Ω';
    if (!base || unit.length < base.length || !unit.endsWith(base)) return NaN;
    const p = unit.slice(0, unit.length - base.length);
    if (!Object.prototype.hasOwnProperty.call(PREFIX, p)) return NaN;
    const r = v * PREFIX[p]; return fin(r) ? r : NaN;
  }
  /* Vorgaben lesen: { v:{key:Zahl|Text}, bad:[Labels] } (Typ steht in st.typ, Verbraucher in st.verbr, Rest je Typ) */
  function read(st) {
    const F = FIELDS(), v = {}, bad = [];
    const take = (g, src) => F[g].forEach(f => {
      const raw = src && src[f.key] != null ? src[f.key] : f.def;
      if (f.select) { if (!f.select.some(o => o[0] === String(raw))) bad.push(f.label); v[f.key] = String(raw); return; }
      const x = readNum(raw, f); if (!fin(x)) bad.push(f.label); v[f.key] = x;
    });
    take('verbr', st.verbr);
    const uin = readNum(st.uin != null ? st.uin : '12', F.typ[1]); if (!fin(uin)) bad.push(F.typ[1].label); v.uin = uin;
    if (st.typ === 'linear') {
      take('lin', st.lin); if (v.regler !== 'lm317') { const k = bad.indexOf(F.lin[2].label); if (k >= 0) bad.splice(k, 1); }
    } else take('buck', st.buck);
    return { v, bad };
  }

  /* ============================================================ Rechnung (alle Zahlen und Zeilen vom Kern) */
  const need = (C, path) => { const p = path.split('.'); let o = C; for (let i = 0; i < p.length; i++) o = o && o[p[i]]; return typeof o === 'function' ? null : NOFN(path); };
  const okr = r => r && r.ok !== false;
  const why = r => (r && r.why) || 'Mit diesen Werten gibt es kein Ergebnis.';
  const SYM = { gruen: '●', gelb: '▲', rot: '■', grau: '○' };
  const ampName = a => ({ gruen: 'grün', gelb: 'gelb', rot: 'rot', grau: 'grau' }[a] || 'grau');
  const E = (lines, extra) => Object.assign({ ok: true, lines: lines || [] }, extra || {});
  const NE = (w, lines) => ({ ok: false, lines: lines || [], why: w || '' });
  /* Vorschlag und Hinweis aus topology (Kern); nur Texte */
  function vorschlag(C, v) {
    const lines = [], t = tryf(() => C.topology({ Uin: v.uin, Uout: v.uaus, Iout: v.i }), null);
    if (okr(t) && t.name) {
      lines.push('Vorschlag des Kerns für ' + eng(v.uin, 'V') + ' auf ' + eng(v.uaus, 'V') + ' bei ' + eng(v.i, 'A') + ': ' + t.name + '. ' + (t.grund || ''));
      (t.alternativen || []).forEach(a => { if (a && a.text) lines.push(a.name + ': ' + a.text); });
      return { lines, topo: t.topo, name: t.name };
    }
    if (t && t.why) lines.push('Kein Vorschlag: ' + t.why);
    return { lines, topo: null };
  }
  /* Verlustvergleich: Linearregler gegen Schaltregler am selben Arbeitspunkt (Kern: loss.vsLinear) */
  function vergleich(C, Uin, Uout, I, etaSchalt) {
    if (!fin(etaSchalt)) return { ok: false, why: 'Für den Vergleich fehlt der Wirkungsgrad des Schaltreglers.' };
    const r = tryf(() => C.loss.vsLinear({ Uin, Uout, Iout: I, etaSchalt }), null);
    if (!okr(r)) return { ok: false, why: why(r) };
    return { ok: true, PvLin: r.PvLin, PvSchalt: r.PvSchalt, diff: r.diff, etaLin: r.etaLin, etaSchalt: r.etaSchalt, Pab: r.Pab, Uin,
      lines: ['Bei ' + eng(Uin, 'V') + ' Eingang, ' + eng(Uout, 'V') + ' und ' + eng(I, 'A') + ': Linearregler P_V = ' + eng(r.PvLin, 'W') + ' (η = ' + fm(r.etaLin * 100, 1) + ' %), Schaltregler P_V = ' + eng(r.PvSchalt, 'W') + ' (η = ' + fm(r.etaSchalt * 100, 1) + ' %): Unterschied ' + eng(r.diff, 'W') + '.', r.text].filter(t => t) };
  }
  const linAmpel = r => {
    if (r.ampel === 'gruen') return 'Reserve ' + eng(r.reserve, 'V') + ': U_min = ' + eng(r.Umin, 'V') + ' liegt über dem Mindesteingang ' + eng(r.UeinMin, 'V') + '.';
    if (r.ampel === 'rot') return 'U_min = ' + eng(r.Umin, 'V') + ' liegt unter dem Mindesteingang ' + eng(r.UeinMin, 'V') + ': Der Regler fällt aus der Regelung (Dropout).';
    return (r.diag || []).map(d => d.text).filter(t => t).join(' ') || 'Die Auslegung trägt, aber nicht alle Lehrfaustwerte sind erfüllt.';
  };
  const BADTXT = {
    lueckt: r => 'Die Drossel lückt bei Nennlast (I_krit = ' + eng(r.Ikrit, 'A') + ').',
    dil: r => 'ΔI_L = ' + eng(r.dIL, 'A') + ' liegt über ' + fm(limV('dil_max'), 2) + ' · I_aus (Lehrfaustwert).',
    eta: r => 'Der Wirkungsgrad η = ' + fm(r.eta * 100, 1) + ' % liegt unter ' + fm(limV('eta_ok'), 0) + ' % (Lehrfaustwert).',
    d: r => 'Das Tastverhältnis D = ' + fm(r.D * 100, 1) + ' % liegt außerhalb von ' + fm(limV('d_min'), 0) + ' bis ' + fm(limV('d_max'), 0) + ' %.'
  };
  const buckAmpel = r => {
    if (r.ampel === 'gruen') return 'ΔI_L = ' + eng(r.dIL, 'A') + ', ΔU = ' + eng(r.dU, 'V') + ', η = ' + fm(r.eta * 100, 1) + ' %, D = ' + fm(r.D * 100, 1) + ' %: Alle geprüften Lehrfaustwerte sind erfüllt.';
    return (r.bad || []).map(b => (BADTXT[b] ? BADTXT[b](r) : '')).filter(t => t).join(' ');
  };

  /* Verteilung der Kernzeilen (design.*.text) auf die Schritte nach der Nummer am Zeilenanfang ("3. U2 = ..."), nicht nach der Lage im Feld.
     Gruppen: Nummern je Schritt. Zeilen ohne Nummer zählen mit ihrer Lage im Feld (i + 1); Zeilen mit unbekannter Nummer landen im letzten Schritt, damit keine verloren geht. */
  function byNr(t, groups) {
    const nr = (x, i) => { const m = /^([0-9]+)[.][ ]/.exec(String(x)); return m ? +m[1] : i + 1; }, out = groups.map(() => []);
    t.forEach((x, i) => { if (!x) return; let g = groups.findIndex(gr => gr.indexOf(nr(x, i)) >= 0); if (g < 0) g = groups.length - 1; out[g].push(x); });
    return out;
  }
  function evalLinear(C, v) {
    const m = ['design.linear', 'design.stringText', 'topology', 'lin.loss', 'loss.vsLinear'].map(p => need(C, p)).find(x => x); if (m) return { ok: false, why: m };
    const cfg = { Uaus: v.uaus, I: v.i, topo: v.topo }; if (v.regler !== 'auto') cfg.typ = v.regler; if (v.regler === 'lm317') cfg.R1 = v.r1;
    const r = tryf(() => C.design.linear(cfg), null), vs = vorschlag(C, v);
    if (!okr(r)) return { ok: true, task: 'linear', steps: [E(), NE(why(r), vs.lines), NE(''), NE('')], hint: vs.lines };
    const g = byNr(r.text || [], [[1], [2, 3, 4].concat(r.typ === 'lm317' ? [7] : []), [5, 6]]);
    const s2 = E(vs.lines.concat(g[0])), s3 = E(g[1]), s4 = E(g[2]);
    /* Vergleich: Schaltregler aus dem mittleren Eingang des Linearreglers */
    let vg = { ok: false, why: '' };
    const bk = tryf(() => C.design.buck({ Uin: r.Umittel, Uout: v.uaus, Iout: v.i }), null);
    if (okr(bk)) vg = vergleich(C, r.Umittel, v.uaus, v.i, bk.eta); else vg = { ok: false, why: why(bk) };
    const hints = [];
    (r.diag || []).forEach(d => { if (d && d.text) hints.push({ text: d.text, link: d.link || '' }); });
    return { ok: true, task: 'linear', steps: [E(), s2, s3, s4], ampel: r.ampel, atext: linAmpel(r), res: r, vergleich: vg, hints, links: r.therm ? [['thmlab.html', 'Kühlung im Thermik-Lab']] : [],
      exakt: r.Cmin, wert: r.C, rig: 'gleich', rigCtl: { u2: r.U2gerundet, topo: r.topo, c: r.C, iLast: v.i }, einheit: 'µF' };
  }
  function evalBuck(C, v) {
    const m = ['design.buck', 'design.stringText', 'topology', 'lin.loss', 'lin.eta', 'loss.vsLinear'].map(p => need(C, p)).find(x => x); if (m) return { ok: false, why: m };
    const vs = vorschlag(C, v);
    const r = tryf(() => C.design.buck({ Uin: v.uin, Uout: v.uaus, Iout: v.i, f: v.f, esr: v.esr }), null);
    if (!okr(r)) return { ok: true, task: 'buck', steps: [E(), NE(why(r), vs.lines), NE(''), NE('')], hint: vs.lines };
    const g = byNr(r.text || [], [[1], [2, 3, 4], [5, 6]]);
    const s2 = E(vs.lines.concat(g[0])), s3 = E(g[1]), s4 = E(g[2]);
    const vg = vergleich(C, v.uin, v.uaus, v.i, r.eta);
    const hints = [];
    (r.diag || []).forEach(d => { if (d && d.text) hints.push({ text: d.text, link: d.link || '' }); });
    return { ok: true, task: 'buck', steps: [E(), s2, s3, s4], ampel: r.ampel, atext: buckAmpel(r), res: r, vergleich: vg, hints, links: [['emvlab.html', 'Entstörung im EMV-Lab']],
      exakt: r.L0, wert: r.L, rig: 'buck', rigCtl: { uin: v.uin, uout: v.uaus, iout: v.i, f: v.f / 1e3, l: r.L * 1e6, c: r.C * 1e6, esr: v.esr * 1e3 }, einheit: 'µH' };
  }
  /* Gesamtauswertung des Zustands: { ok, why? , steps[4], ampel, atext, res, vergleich, rigCtl, ... } */
  function evaluate(st) {
    const C = CORE(); if (!C) return { ok: false, why: NOCORE };
    if (!st || (st.typ !== 'linear' && st.typ !== 'buck')) return { ok: false, why: 'Diesen Netzteiltyp gibt es nicht.' };
    const rd = read(st);
    if (rd.bad.length) return { ok: true, task: st.typ, blank: true, ampel: 'grau', atext: '', steps: [NE('Bitte in diese Felder Zahlen eintragen (Komma oder Punkt, Einheit nur passend zum Feld): ' + rd.bad.join(', ') + '.'), NE(''), NE(''), NE('')] };
    let r = null;
    try { r = st.typ === 'linear' ? evalLinear(C, rd.v) : evalBuck(C, rd.v); } catch (e) { r = { ok: false, why: 'Mit diesen Werten gibt es kein Ergebnis.' }; }
    if (!r) return { ok: false, why: 'Mit diesen Werten gibt es kein Ergebnis.' };
    if (r.ok === false) return { ok: false, why: r.why };
    r.steps[0] = E(['Verbraucher: ' + eng(rd.v.uaus, 'V') + ' bei ' + eng(rd.v.i, 'A') + ' (Übungswerte).']);
    if (!r.ampel) { r.ampel = 'grau'; r.atext = ''; r.blank = true; }
    return Object.assign({ symbol: SYM[r.ampel] || '' }, r);
  }
  /* Werte für den Prüfstand (Schlüssel wie controls der Rigs) */
  function rigControls(st) { const e = evaluate(st); return e && e.rigCtl ? { rig: e.rig, controls: Object.assign({}, e.rigCtl) } : null; }
  function getState() { return { v: 1, st: JSON.parse(JSON.stringify(ST.st)), step: ST.step }; }
  function setState(o) {
    if (!o || typeof o !== 'object' || !o.st || typeof o.st !== 'object') return false;
    const d = defaults(), s = o.st;
    if (s.typ === 'linear' || s.typ === 'buck') d.typ = s.typ;
    if (typeof s.uin === 'string' || typeof s.uin === 'number') d.uin = String(s.uin);
    ['verbr', 'lin', 'buck'].forEach(g => { if (s[g] && typeof s[g] === 'object') Object.keys(d[g]).forEach(k => { if (s[g][k] != null && (typeof s[g][k] === 'string' || typeof s[g][k] === 'number')) d[g][k] = String(s[g][k]); }); });
    ST.st = d; ST.step = Math.min(4, Math.max(1, Math.floor(Number(o.step)) || 1)); return true;
  }

  /* ============================================================ Oberfläche */
  const CSS = '<style>.nd-bar{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.nd-bar button{flex:1 1 120px;min-height:44px;border:1px solid var(--line);border-radius:10px;background:var(--panel);color:inherit;font:inherit}.nd-bar button.on{border-color:var(--accent);font-weight:600}.nd-bar button.ok{border-color:var(--ok)}.nd-g{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}.nd-g label{flex:1 1 170px;min-width:140px;font-size:12.5px;color:var(--mute)}.nd-g input,.nd-g select{margin-top:3px;min-height:42px}.nd-res{margin-top:10px}.nd-why{color:var(--danger);font-size:13.5px;margin:6px 0 0}</style>';
  function fieldHtml(g, f, val) {
    const id = 'nd_' + g + '_' + f.key, lbl = esc(f.label) + (f.unit ? ' in ' + esc(f.unit) : '');
    if (f.select) return `<label for="${id}">${lbl}<select id="${id}" data-g="${g}" data-k="${esc(f.key)}">${f.select.map(o => `<option value="${esc(o[0])}"${String(o[0]) === String(val) ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select></label>`;
    return `<label for="${id}">${lbl}<input id="${id}" data-g="${g}" data-k="${esc(f.key)}" inputmode="decimal" autocomplete="off" value="${esc(val)}"></label>`;
  }
  const valOf = (st, g, f) => { if (g === 'top') return st[f.key] != null ? st[f.key] : f.def; return st[g] && st[g][f.key] != null ? st[g][f.key] : f.def; };
  function stepFields(n, st) {
    const F = FIELDS(); let h = '';
    if (n === 1) return `<div class="nd-g">${F.verbr.map(f => fieldHtml('verbr', f, valOf(st, 'verbr', f))).join('')}</div><p class="hint2">Alle Vorgaben sind Übungswerte. Auslegungsregeln: Übungsregeln (F42), vom Ausbilder abzugleichen.</p>`;
    if (n === 2) {
      h = `<div class="nd-g">${F.typ.map(f => fieldHtml('top', f, valOf(st, 'top', f))).join('')}`;
      if (st.typ === 'linear') h += [F.lin[0], F.lin[1]].map(f => fieldHtml('lin', f, valOf(st, 'lin', f))).join('');
      return h + '</div>';
    }
    if (n === 3) {
      if (st.typ === 'linear') return st.lin && st.lin.regler === 'lm317' ? `<div class="nd-g">${fieldHtml('lin', F.lin[2], valOf(st, 'lin', F.lin[2]))}</div>` : '';
      return `<div class="nd-g">${F.buck.map(f => fieldHtml('buck', f, valOf(st, 'buck', f))).join('')}</div>`;
    }
    return '';
  }
  function resHtml(ev, n) {
    if (ev.ok === false) return `<p class="nd-why" role="status">${esc(ev.why)}</p>`;
    const s = ev.steps[n - 1] || { lines: [] };
    let h = '';
    if (s.lines.length) h += `<ol>${s.lines.map(t => `<li>${esc(t)}</li>`).join('')}</ol>`;
    if (s.why) h += `<p class="nd-why" role="status">${esc(s.why)}</p>`;
    if (n === 4 && ev.ampel && !ev.blank) {
      const k = { gruen: 'ok', gelb: 'warnc', rot: 'bad', grau: '' }[ev.ampel] || '';
      h = `<div class="amprow ${k}" role="status"><span class="asym" aria-hidden="true">${esc(SYM[ev.ampel] || '')}</span><div class="atx"><b>Ampel: ${esc(ampName(ev.ampel))}</b><small>${esc(ev.atext)}</small><small class="nt">${esc(textOf('ampelHinweis'))}</small></div></div>` + h;
      if (ev.vergleich) h += ev.vergleich.ok ? `<h5 style="margin:10px 0 2px">Verlustvergleich Linear gegen Schalt</h5><ol>${ev.vergleich.lines.map(t => `<li>${esc(t)}</li>`).join('')}</ol>` : `<p class="hint2">Verlustvergleich nicht möglich: ${esc(ev.vergleich.why)}</p>`;
      (ev.hints || []).forEach(x => { h += `<p class="hint2">${esc(x.text)}</p>`; });
      (ev.links || []).forEach(x => { h += `<p class="hint2"><a href="${esc(x[0])}">${esc(x[1])}</a></p>`; });
      h += `<p class="hint2">${esc(textOf('datenblatt'))} ${esc(textOf('lernenHinweis'))}</p>`;
    }
    return h;
  }
  function barHtml(ev) {
    return STEPS.map(([n, ic, name]) => { const ok = ev.steps && ev.steps[n - 1] && ev.steps[n - 1].ok && !ev.blank; return `<button data-step="${n}" class="${ST.step === n ? 'on' : ''}${ok ? ' ok' : ''}" aria-label="Schritt ${n} ${name}${ok ? ', geprüft' : ', noch nicht geprüft'}"${ST.step === n ? ' aria-current="step"' : ''}>${ok ? '✓' : ic} ${n} ${name}</button>`; }).join('');
  }
  function panelHtml(ev) {
    const n = ST.step, st = ST.st;
    const nav = `<div class="btns">${n > 1 ? '<button class="btn" data-nav="-1">Zurück</button>' : ''}${n < 4 ? '<button class="btn pri" data-nav="1">Weiter</button>' : '<button class="btn pri" data-act="rig">Im Prüfstand ansehen</button><button class="btn" data-act="reset">Neu beginnen</button>'}</div>`;
    return `<div class="card pl"><h4>Schritt ${n} von 4</h4><p class="big">${esc(TITLES[n - 1])}</p>${stepFields(n, st)}<div class="nd-res" data-dres aria-live="polite">${resHtml(ev, n)}</div>${nav}</div>`;
  }
  function renderAll() {
    const C = CORE(), ev = evaluate(ST.st);
    const top = `<div class="card pl"><h4>Auslegen</h4><p class="big">Netzteil auslegen in vier Schritten</p><p class="hint2" style="margin:0">Jeder Schritt rechnet mit demselben Kern wie die Prüfstände. Die Vorgaben sind Übungswerte, die Auslegungsregeln Übungsregeln (F42). Übungsschaltung, keine Anleitung für Arbeiten an Netzspannung. ${esc(C ? textOf('simOnly') : '')}</p></div>`;
    if (!C) return CSS + top + `<div class="card pl"><p class="nd-why">${esc(NOCORE)}</p></div>`;
    if (ev.ok === false) return CSS + top + `<div class="card pl"><p class="nd-why">${esc(ev.why)}</p></div>`;
    return CSS + top + `<div class="nd-bar" data-dbar role="group" aria-label="Schritte">${barHtml(ev)}</div><div data-dpanel>${panelHtml(ev)}</div>`;
  }
  function save() { try { if (A && typeof A.lsSet === 'function') A.lsSet('nts.design', getState()); } catch (e) {} }
  function stat() { try { if (A && typeof A.stat === 'function') A.stat('ntsdesign', 1); } catch (e) {} }
  function redraw(host) { host.innerHTML = renderAll(); }
  function reached(ev) { return ev && ev.steps && ev.steps[3] && ev.steps[3].ok && !ev.blank; }
  function onInput(host, e) {
    const t = e && e.target; if (!t || !t.dataset || !t.dataset.k) return;
    const k = t.dataset.k, g = t.dataset.g;
    if (g === 'top') {
      if (k === 'typ') { if (t.value === 'linear' || t.value === 'buck') ST.st.typ = t.value; save(); redraw(host); return; }
      ST.st[k] = String(t.value);
    } else if (g === 'lin' && k === 'regler') { ST.st.lin.regler = String(t.value); save(); redraw(host); return; }
    else if (ST.st[g] && Object.prototype.hasOwnProperty.call(ST.st[g], k)) ST.st[g][k] = String(t.value);
    else return;
    save();
    const ev = evaluate(ST.st), r = host.querySelector('[data-dres]'), b = host.querySelector('[data-dbar]');
    if (r) r.innerHTML = resHtml(ev, ST.step); if (b) b.innerHTML = barHtml(ev);
    if (e.type === 'change' && ST.step === 4 && reached(ev)) stat();
  }
  function onClick(host, e) {
    const t = e && e.target && e.target.closest ? e.target : null; if (!t) return;
    const sb = t.closest('[data-step]'), nb = t.closest('[data-nav]'), ab = t.closest('[data-act]');
    const go = n => { ST.step = Math.min(4, Math.max(1, n)); save(); redraw(host); if (ST.step === 4 && reached(evaluate(ST.st))) stat(); };
    if (sb) go(+sb.dataset.step);
    else if (nb) go(ST.step + (+nb.dataset.nav));
    else if (ab && ab.dataset.act === 'reset') { ST.st = defaults(); ST.step = 1; save(); redraw(host); }
    else if (ab && ab.dataset.act === 'rig') {
      const rc = rigControls(ST.st); if (!rc) { if (A && A.toast) A.toast('Erst eine gültige Auslegung eingeben.'); return; }
      if (A && typeof A.loadRig === 'function') A.loadRig({ rig: rc.rig, name: 'Auslegung', controls: rc.controls, toast: 'Die Auslegung steht im Prüfstand ' + (A.rigName ? A.rigName(rc.rig) : rc.rig) });
      else if (A && typeof A.setTab === 'function') A.setTab('rig');
    }
  }
  function render(host, api) {
    A = api || A;
    if (!ST.A) { ST.A = true; const o = A && typeof A.lsGet === 'function' ? tryf(() => A.lsGet('nts.design', null), null) : null; if (o) setState(o); }
    host.innerHTML = renderAll();
    if (!host._ntsDesign) { host._ntsDesign = true; host.addEventListener('input', e => onInput(host, e)); host.addEventListener('change', e => onInput(host, e)); host.addEventListener('click', e => onClick(host, e)); }
  }

  const API = { render, getState, setState, fn: { defaults, evaluate, rigControls, read, readNum, fields: FIELDS, types: TYPES }, _st: ST };
  root.NTS_UI_EXT = root.NTS_UI_EXT || {}; root.NTS_UI_EXT.design = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
