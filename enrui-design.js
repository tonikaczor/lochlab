'use strict';
/* Tonfunk Energie-Lab: Tab "Auslegen" (WP4b, SPEC 6.4).
   (1) Inselanlage-Assistent in sechs Schritten (Verbraucher, Standort/Jahreszeit/Wetter, Systemspannung und Akku, Modul und Regler, Leitungen und Sicherungen, Ergebnis mit Rechenweg,
       Prüfampel, "Simulation prüfen" = design.verify, "In den Prüfstand laden" = api.loadDesign), (2) Strang prüfen (design.stringCheck), (3) Leitung und Sicherung (design.cable, design.fuse).
   ALLE Rechnungen kommen aus ENR_CORE.design und ENR_CORE.pv/sun/calc (Regel 7); hier steht keine zweite Formelimplementierung. Fehlt eine Kernfunktion, erscheint ein deutscher Hinweis.
   Schnittstelle (SPEC 6.7): window.ENR_UI_EXT.design.render(host, api), api = { S, rig, setTab, loadExample, startTask, toast, esc, stat, lsGet, lsSet, loadDesign, ENR_CORE, ENR_CHART }.
   Auslegungen stehen unter lsGet/lsSet('enr.design') und über ENR_UI_EXT.design.getState()/setState(o) für Speichern/Teilen bereit.
   Die Rechenfunktionen (ohne DOM) hängen unter ENR_UI_EXT.design.fn und werden von test_enrui_ext.js geprüft. */
(function (root) {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fin = v => typeof v === 'number' && isFinite(v);
  const CORE = () => root.ENR_CORE;
  const fnum = (v, d) => (fin(v) ? (+v).toFixed(d == null ? 1 : d).replace('.', ',') : '–');
  const adig = v => { v = Math.abs(v); if (v === 0) return 0; return v >= 100 ? 0 : v >= 10 ? 1 : v >= 1 ? 2 : v >= 0.1 ? 3 : 4; };
  const fa = v => (fin(v) ? (Number.isInteger(v) ? String(v) : fnum(v, adig(v))) : '–');
  const pn = s => {
    if (typeof s === 'number') return fin(s) ? s : NaN; const t = String(s == null ? '' : s), C = CORE();
    if (C && typeof C.parseNum === 'function') { const v = C.parseNum(t); return fin(v) ? v : NaN; }
    const v = parseFloat(t.replace(/\s/g, '').replace(',', '.')); return fin(v) ? v : NaN;
  };
  const pick = (o, keys) => { if (typeof o === 'number') return fin(o) ? o : NaN; if (!o || typeof o !== 'object') return NaN; for (const k of keys) if (fin(o[k])) return o[k]; return NaN; };
  const tryf = (f, d) => { try { const r = f(); return r === undefined ? d : r; } catch (e) { return d; } };
  const NOCORE = 'Der Rechenkern ist nicht geladen (enrcore.js fehlt). Ohne ihn gibt es hier keine Zahlen.';
  const NODESIGN = n => 'Dem Rechenkern fehlt die Funktion design.' + n + ' (enrsys.js ist noch nicht vollständig geladen). Die Auslegung liefert deshalb noch keine Zahlen.';
  const hasD = n => { const C = CORE(); return !!(C && C.design && typeof C.design[n] === 'function'); };
  let A = null;

  /* ============================================================ Tabellen und Voreinstellungen */
  const DAYS = [['21. Dezember', 355], ['21. März', 80], ['21. Juni', 172], ['23. September', 266]];
  const CM = { klar: 0, heiter: 0.25, wolkig: 0.625, bedeckt: 1 }; /* Bewölkung c (Achtel/8), SPEC 4.7 */
  const WEATHER = [['klar', 'klar'], ['heiter', 'heiter'], ['wolkig', 'wolkig'], ['bedeckt', 'bedeckt']];
  const MODULE_ORDER = ['si36', 'si60', 'si72'];
  /* Rückfall-Geräteliste (Eingabewerte aus SPEC 4.11), nur benutzt, wenn der Kern loads.profile nicht liefert; alle Summen rechnet der Kern */
  const FALLBACK = {
    gartenhaus: { name: 'Gartenhaus', Usys: 12, tage: 2, chem: 'blei', laenge: { pv: 5, akku: 1, wr: 1 }, geraete: [{ name: 'LED-Licht 2 × 5 W', P: 10, stunden: 4, typ: 'dc' }, { name: 'Pumpe', P: 60, stunden: 1, typ: 'dc' }, { name: 'Radio', P: 10, stunden: 3, typ: 'dc' }, { name: 'Handy und Laptop laden', P: 30, stunden: 2, typ: 'dc' }] },
    camper: { name: 'Camper', Usys: 24, tage: 2, chem: 'lifepo4', laenge: { pv: 5, akku: 1, wr: 1 }, geraete: [{ name: 'Kühlbox (Einschaltdauer 35 %)', P: 45, stunden: 8.4, typ: 'dc' }, { name: 'LED-Licht', P: 12, stunden: 4, typ: 'dc' }, { name: 'Laptop', P: 45, stunden: 3, typ: 'dc' }, { name: 'Wasserpumpe', P: 40, stunden: 0.25, typ: 'dc' }, { name: 'Handy', P: 10, stunden: 3, typ: 'dc' }] },
    pumpe: { name: 'Bewässerungspumpe', Usys: 24, tage: 1, chem: 'blei', laenge: { pv: 8, akku: 2, wr: 1 }, geraete: [{ name: 'Pumpe', P: 250, stunden: 2, typ: 'ac' }, { name: 'Steuerung', P: 2, stunden: 24, typ: 'dc' }] }
  };
  const PRESET_IDS = ['gartenhaus', 'camper', 'pumpe'];
  function winHours(d) {
    const w = d.windows || d.fenster || d.win || d.fenst; let h = 0;
    if (Array.isArray(w) && w.length) { w.forEach(x => { const a = Array.isArray(x) ? x : [x && x.von, x && x.bis]; if (fin(a[0]) && fin(a[1])) h += Math.max(0, a[1] - a[0]); }); }
    else if (fin(d.von) && fin(d.bis)) h = Math.max(0, d.bis - d.von);
    else if (fin(d.hours)) h = d.hours; else if (fin(d.stunden)) h = d.stunden; else if (fin(d.dauer)) h = d.dauer; else return NaN;
    return h * (fin(d.duty) && d.duty > 0 ? d.duty : 1);
  }
  /* Geräteliste einer Voreinstellung: aus loads.profile des Kerns; sonst Rückfall */
  function presetData(id) {
    const fb = FALLBACK[id]; if (!fb) return null; const C = CORE(); let geraete = null;
    if (C && C.loads && typeof C.loads.profile === 'function') {
      const p = tryf(() => C.loads.profile(id), null);
      if (p && Array.isArray(p.devices) && p.devices.length) {
        const g = p.devices.map(d => ({ name: String(d.name || d.id || 'Gerät'), P: fin(d.P) ? d.P : NaN, stunden: winHours(d), typ: (d.type || d.typ) === 'ac' ? 'ac' : 'dc' }));
        if (g.every(x => fin(x.P) && fin(x.stunden))) geraete = g;
      }
    }
    return { id, name: fb.name, Usys: fb.Usys, tage: fb.tage, chem: fb.chem, laenge: Object.assign({}, fb.laenge), geraete: geraete || fb.geraete.map(x => Object.assign({}, x)), fromCore: !!geraete };
  }
  function deviceChoices() {
    const C = CORE(), d = C && C.loads && C.loads.devices; if (!d) return [];
    const list = Array.isArray(d) ? d : Object.keys(d).map(k => Object.assign({ id: k }, d[k]));
    return list.filter(x => x && fin(x.P)).map(x => ({ value: x.id, label: (x.name || x.id) + ' (' + fa(x.P) + ' W)', P: x.P, typ: x.type === 'ac' || x.typ === 'ac' ? 'ac' : 'dc' }));
  }
  function moduleChoices() { const C = CORE(); if (!C || !C.pv || !C.pv.presets) return []; return MODULE_ORDER.filter(id => C.pv.presets[id]).map(id => ({ value: id, label: C.pv.presets[id].name || id })); }
  function siteChoices() { const C = CORE(); if (!C || !C.sun || !C.sun.sites) return []; return Object.keys(C.sun.sites).map(k => ({ value: k, label: C.sun.sites[k].name || k })); }
  const sumWh = g => (Array.isArray(g) ? g : []).reduce((s, x) => { const p = pn(x && x.P), h = pn(x && x.stunden); return s + (fin(p) && fin(h) ? p * h : 0); }, 0);

  /* ============================================================ reine Rechenfunktionen (alle rufen ENR_CORE.design) */
  const DEFAULT_WIZ = () => ({ step: 1, geraete: [], ort: 'mitte', tag: 355, wetter: 'wolkig', neigungAuto: true, neigung: 35, azimut: 0, Usys: 12, chem: 'blei', tage: 2, dodAuto: true, dod: 50, modul: 'si60', regler: 'mppt', laenge: { pv: 5, akku: 1, wr: 1 }, spannungsfall: 2, sparmodus: false, preset: '', done: {} });
  /* Eingabe für den Kern (SPEC 4.13) aus dem Zustand des Assistenten */
  function buildInp(w) {
    w = w || {}; const g = (Array.isArray(w.geraete) ? w.geraete : []).map(x => ({ name: String(x.name || 'Gerät'), P: pn(x.P), stunden: pn(x.stunden), typ: x.typ === 'ac' ? 'ac' : 'dc' }));
    const inp = { geraete: g, Usys: pn(w.Usys), tage: pn(w.tage), ort: w.ort || 'mitte', tag: Math.round(pn(w.tag)), wetter: w.wetter || 'wolkig', neigung: w.neigungAuto ? null : pn(w.neigung), azimut: pn(w.azimut), chem: w.chem === 'lifepo4' ? 'lifepo4' : 'blei', dod: w.dodAuto ? null : pn(w.dod) / 100, PR: 0.65, modul: w.modul || 'si60', regler: w.regler === 'pwm' ? 'pwm' : 'mppt', laenge: { pv: pn(w.laenge && w.laenge.pv), akku: pn(w.laenge && w.laenge.akku), wr: pn(w.laenge && w.laenge.wr) }, spannungsfall: pn(w.spannungsfall) / 100, wrSparmodus: !!w.sparmodus };
    return inp;
  }
  function checkInp(inp) {
    if (!inp.geraete.length) return 'Trage mindestens ein Gerät ein (Schritt 1).';
    if (inp.geraete.some(x => !fin(x.P) || x.P <= 0 || !fin(x.stunden) || x.stunden < 0 || x.stunden > 24)) return 'Leistung (größer 0) und Stunden je Tag (0 bis 24) müssen bei jedem Gerät Zahlen sein.';
    if (![12, 24, 48].includes(inp.Usys)) return 'Die Systemspannung ist 12, 24 oder 48 V.';
    if (!fin(inp.tage) || inp.tage < 0.5 || inp.tage > 14) return 'Die Autonomie liegt zwischen 0,5 und 14 Tagen.';
    if (!fin(inp.tag) || inp.tag < 1 || inp.tag > 365) return 'Der Auslegungstag liegt zwischen 1 und 365.';
    if (inp.neigung !== null && (!fin(inp.neigung) || inp.neigung < 0 || inp.neigung > 90)) return 'Die Neigung liegt zwischen 0 und 90 Grad.';
    if (!fin(inp.azimut) || Math.abs(inp.azimut) > 180) return 'Der Azimut liegt zwischen −180 und 180 Grad (0 = Süd).';
    if (inp.dod !== null && (!fin(inp.dod) || inp.dod <= 0 || inp.dod > 1)) return 'Die Entladetiefe liegt zwischen 1 und 100 %.';
    if (!['pv', 'akku', 'wr'].every(k => fin(inp.laenge[k]) && inp.laenge[k] > 0)) return 'Alle drei Leitungslängen müssen Zahlen größer 0 sein.';
    if (!fin(inp.spannungsfall) || inp.spannungsfall <= 0 || inp.spannungsfall > 0.2) return 'Der zulässige Spannungsfall liegt zwischen 0,1 und 20 %.';
    return '';
  }
  /* Auslegung: design.autoDesign */
  function designRun(w) {
    const C = CORE(); if (!C) return { ok: false, why: NOCORE }; if (!hasD('autoDesign')) return { ok: false, why: NODESIGN('autoDesign') };
    const inp = buildInp(w), bad = checkInp(inp); if (bad) return { ok: false, why: bad, inp };
    let r; try { r = C.design.autoDesign(inp); } catch (e) { r = null; }
    if (!r || r.ok === false) return { ok: false, why: (r && r.why) || 'Mit diesen Werten gibt es keine Auslegung.', inp };
    return { ok: true, inp, res: r };
  }
  /* Simulation prüfen: design.verify (drei Schlechtwettertage), Ladezustandskurve falls der Kern sie liefert */
  function seriesOf(v) {
    if (!v || typeof v !== 'object') return null;
    const pickArr = x => (Array.isArray(x) && x.length > 3 ? x : null);
    let a = pickArr(v.soc) || pickArr(v.socTrace) || pickArr(v.socSeries) || pickArr(v.trace) || pickArr(v.samples) || (v.series && (pickArr(v.series.soc) || pickArr(v.series)));
    if (!a) return null;
    const pts = a.map((e, i) => (fin(e) ? { x: i, y: e } : (e && fin(e.soc) ? { x: fin(e.t) ? e.t : i, y: e.soc } : null))).filter(Boolean);
    return pts.length > 3 ? pts : null;
  }
  function verifyRun(d) {
    const C = CORE(); if (!C) return { ok: false, why: NOCORE }; if (!hasD('verify')) return { ok: false, why: NODESIGN('verify') };
    if (!d || !d.ok) return { ok: false, why: 'Zuerst muss die Auslegung ein Ergebnis haben.' };
    let v; try { v = C.design.verify(d.inp, d.res); } catch (e) { v = null; }
    if (!v || v.ok === undefined && !fin(v.socMin)) return { ok: false, why: (v && v.why) || 'Die Simulation lässt sich nicht rechnen.' };
    const lv = pick(v, ['tLvdAt', 'tLvdStart', 'tLvdFirst', 'tLvd']);
    return { ok: true, pass: !!v.ok, socMin: pick(v, ['socMin']), tLvd: lv, tageUeberlebt: pick(v, ['tageUeberlebt']), checks: Array.isArray(v.checks) ? v.checks : [], series: seriesOf(v), core: v };
  }
  /* Strang prüfen */
  const REGLER_KLASSEN = [50, 100, 150];
  function deviceLimits() {
    const C = CORE(), out = []; const grid = C && C.inv && Array.isArray(C.inv.gridTable) ? C.inv.gridTable : [];
    grid.forEach(g => out.push({ value: 'wr' + g.Pn, label: g.name || ('Wechselrichter ' + g.Pn + ' W'), UdcMax: g.udcMax, mppMin: g.mppMin, mppMax: g.mppMax, IdcMax: g.iDcMax, kind: 'wr' }));
    REGLER_KLASSEN.forEach(u => out.push({ value: 'mppt' + u, label: 'MPPT-Laderegler bis ' + u + ' V Eingang (Übungswert)', UdcMax: u, mppMin: NaN, mppMax: u, IdcMax: 20, kind: 'regler' }));
    return out;
  }
  function limitsOf(id, Usys) {
    const l = deviceLimits().find(x => x.value === id); if (!l) return null; const o = Object.assign({}, l);
    if (l.kind === 'regler') { o.mppMin = (fin(Usys) ? Usys : 12) + 5; } /* Startbedingung des Wandlers: Umpp ≥ Ub + 5 V (SPEC 4.8) */
    return o;
  }
  function stringRun(v) {
    const C = CORE(); if (!C || !C.pv) return { ok: false, why: NOCORE }; v = v || {};
    const ns = Math.round(pn(v.ns)), np = Math.round(pn(v.np)), tmin = pn(v.tmin), tmax = pn(v.tmax), us = pn(v.Usys);
    if (!(ns >= 1) || !(np >= 1)) return { ok: false, why: 'Bitte Module in Reihe und Stränge parallel als ganze Zahlen ab 1 eintragen.' };
    if (!fin(tmin) || !fin(tmax) || tmax <= tmin) return { ok: false, why: 'Die höchste Temperatur muss über der tiefsten liegen (beide als Zahlen).' };
    const lim = limitsOf(v.device, us); if (!lim) return { ok: false, why: 'Dieses Gerät gibt es nicht.' };
    const inp = { spec: v.spec || 'si60', ns, np, TminC: tmin, TmaxC: tmax, UdcMax: lim.UdcMax, mppMin: lim.mppMin, mppMax: lim.mppMax, IdcMax: lim.IdcMax };
    if (hasD('stringCheck')) {
      let r; try { r = C.design.stringCheck(inp); } catch (e) { r = null; }
      if (!r || r.ok === false) return { ok: false, why: (r && r.why) || 'Mit diesen Werten lässt sich der Strang nicht prüfen.', inp, lim };
      return { ok: true, inp, lim, UocKalt: r.UocKalt, UmppHeiss: r.UmppHeiss, IscSumme: r.IscSumme, checks: Array.isArray(r.checks) ? r.checks : [], source: 'kern' };
    }
    /* Rückfall, bis design.stringCheck im Kern ist: Werte aus pv.keys bei den Grenztemperaturen (Regel 7), Vergleiche mit den Gerätegrenzen */
    if (!C.pv.keys) return { ok: false, why: NODESIGN('stringCheck') };
    const a = C.pv.keys(inp.spec, { G: 1000, Tc: tmin }), b = C.pv.keys(inp.spec, { G: 1000, Tc: tmax }), s = C.pv.keys(inp.spec, { G: 1000, Tc: 25 });
    if (!a || a.ok === false || !b || b.ok === false || !s || s.ok === false) return { ok: false, why: 'Mit diesen Werten lässt sich der Strang nicht prüfen.' };
    const uoc = ns * a.Uoc, umpp = ns * b.Umpp, isc = np * s.Isc;
    const checks = [{ id: 'uoc-max', ok: uoc <= lim.UdcMax, text: 'Leerlaufspannung bei ' + fa(tmin) + ' °C: ' + fa(uoc) + ' V; Grenze des Geräts: ' + fa(lim.UdcMax) + ' V. ' + (uoc <= lim.UdcMax ? 'In Ordnung.' : 'Zu hoch: Das Gerät kann zerstört werden. Weniger Module in Reihe.') },
      { id: 'mpp-fenster', ok: !fin(lim.mppMin) || umpp >= lim.mppMin, text: 'MPP-Spannung bei ' + fa(tmax) + ' °C: ' + fa(umpp) + ' V; unterste Grenze: ' + fa(lim.mppMin) + ' V. ' + (umpp >= lim.mppMin ? 'In Ordnung.' : 'Zu niedrig: Mehr Module in Reihe.') },
      { id: 'isc-max', ok: isc <= lim.IdcMax, text: 'Kurzschlussstrom aller Stränge: ' + fa(isc) + ' A; Grenze des Eingangs: ' + fa(lim.IdcMax) + ' A. ' + (isc <= lim.IdcMax ? 'In Ordnung.' : 'Zu hoch: Weniger Stränge parallel.') }];
    return { ok: true, inp, lim, UocKalt: uoc, UmppHeiss: umpp, IscSumme: isc, checks, source: 'oberflaeche' };
  }
  /* Leitung und Sicherung: design.cable / design.fuse; Rückfall über die Formeln des Kerns (querschnitt, leitungsverlust, spannungsfall) */
  function cableRun(v) {
    const C = CORE(); if (!C) return { ok: false, why: NOCORE }; v = v || {};
    const I = pn(v.I), L = pn(v.L), U = pn(v.U), fr = pn(v.fall) / 100, kappa = pn(v.kappa);
    if (![I, L, U, fr, kappa].every(fin) || !(I > 0) || !(L > 0) || !(U > 0) || !(fr > 0) || fr > 0.2 || !(kappa > 0)) return { ok: false, why: 'Bitte Strom, einfache Länge, Systemspannung, Spannungsfall (0,1 bis 20 %) und κ als Zahlen größer 0 eintragen.' };
    const inp = { I, strom: I, L, laenge: L, Usys: U, U, spannungsfall: fr, dUfrac: fr, kappa };
    let c = null, src = 'formeln'; if (hasD('cable')) { try { c = C.design.cable(inp); } catch (e) { c = null; } }
    let aMin = pick(c, ['aMin', 'Amin', 'min', 'amin']), aNorm = pick(c, ['aNorm', 'norm', 'A', 'a']), pV = pick(c, ['pV', 'pLoss', 'verlust', 'P']), steps = c && Array.isArray(c.steps) ? c.steps : [];
    if (c && c.ok !== false && fin(aMin)) src = 'kern';
    else {
      const F = C.calc && C.calc.formulas && C.calc.formulas.get ? C.calc.formulas : null; if (!F) return { ok: false, why: c && c.why ? c.why : NODESIGN('cable') };
      const q = F.get('querschnitt').explain(L, I, fr * U, kappa); if (!q || q.ok === false) return { ok: false, why: (q && q.why) || 'Mit diesen Werten gibt es kein Ergebnis.' };
      aMin = q.value; aNorm = q.extra && fin(q.extra.norm) ? q.extra.norm : NaN; steps = q.steps || [];
      if (fin(aNorm)) { const lv = F.get('leitungsverlust').explain(I, L, aNorm, kappa); pV = lv && lv.ok !== false ? lv.value : NaN; }
    }
    let fuse = null; const A0 = fin(aNorm) ? aNorm : NaN;
    if (hasD('fuse') && fin(A0)) { try { fuse = C.design.fuse({ I, Ib: I, strom: I, A: A0, aNorm: A0, L, Usys: U, kappa, kind: 'last' }); } catch (e) { fuse = null; } }
    const fuseOk = fuse && fuse.ok !== false, In = pick(fuse, ['In', 'nenn', 'Inenn', 'value', 'amps', 'A']);
    let ufall = NaN; if (fin(A0)) { const f2 = C.calc.formulas.get('spannungsfall').explain(L, I, A0, kappa, U); ufall = f2 && f2.ok !== false ? f2.value : NaN; }
    return { ok: true, src, inp, aMin, aNorm, pV, ufall, steps, fuse: fuse ? { ok: fuseOk, In, why: fuse.why || '', text: fuse.text || '', raw: fuse } : null, fuseMissing: !hasD('fuse') };
  }

  /* ============================================================ Oberfläche */
  const ST = { wiz: DEFAULT_WIZ(), res: null, ver: null, str: { spec: 'si60', ns: 11, np: 1, tmin: -10, tmax: 60, device: 'wr5000', Usys: 12 }, cab: { I: 20, L: 5, U: 12, fall: 2, kappa: 56 } };
  const fld = (key, label, unit, val, extra) => `<label class="f"><span>${esc(label)}${unit ? ' (' + esc(unit) + ')' : ''}</span><input data-f="${esc(key)}" inputmode="decimal" autocomplete="off" value="${esc(typeof val === 'number' ? fa(val) : (val == null ? '' : val))}"${extra || ''}></label>`;
  const sel = (key, label, opts, val) => `<label class="f"><span>${esc(label)}</span><select data-f="${esc(key)}">${opts.map(o => `<option value="${esc(o.value)}"${String(o.value) === String(val) ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>`;
  const chk = (key, label, on) => `<label class="chk"><input type="checkbox" data-f="${esc(key)}"${on ? ' checked' : ''}> ${esc(label)}</label>`;
  const stepsHtml = steps => (steps && steps.length ? `<ol>${steps.map(s => { if (typeof s === 'string') return `<li>${esc(s)}</li>`; const ls = Array.isArray(s && s.lines) ? s.lines : [(s && (s.text || s.formula)) || '']; return `<li>${s && s.title ? '<b>' + esc(s.title) + '</b><br>' : ''}${ls.map(esc).join('<br>')}</li>`; }).join('')}</ol>` : '');
  const warnHtml = (w, c) => `<p class="hint2" style="color:${c || 'var(--warn)'};margin:8px 0 0">${esc(w)}</p>`;
  const kv = (k, v) => `<div class="kvs"><span>${k}</span><b>${v}</b></div>`;
  const card = (id, title, body, open) => `<details class="fm" data-card="${id}"${open ? ' open' : ''}><summary>${title}</summary><div class="fmb">${body}</div></details>`;
  const setRes = (host, name, html) => { const el = host.querySelector('[data-res="' + name + '"]'); if (el) el.innerHTML = html; };
  /* Prüfampel: Symbol UND Text (nicht nur Farbe, Regel 10) */
  const ampel = checks => (checks && checks.length ? `<div class="rl" style="margin:8px 0 0">${checks.map(c => `<div class="ex ${c && c.ok ? 'ok' : 'bad'}"><b>${c && c.ok ? '✔ in Ordnung' : '✖ Prüfen'}</b> ${esc(c && c.text || (c && c.id) || '')}</div>`).join('')}</div>` : '');
  const used = () => { if (A && A.S) A.S.designed = true; if (A && typeof A.stat === 'function') A.stat('enrdesign', 1, 'max'); };

  /* ---- Ladezustandskurve (eingebettetes SVG, Beschriftung mit Einheiten) ---- */
  function socSvg(pts, socMin) {
    if (!pts || pts.length < 4) return '';
    const L = 44, T = 10, W = 290, H = 110, x0 = pts[0].x, x1 = pts[pts.length - 1].x, dx = x1 - x0 || 1, X = x => L + W * (x - x0) / dx, Y = y => T + H * (1 - Math.max(0, Math.min(1, y)));
    const line = pts.map(p => X(p.x).toFixed(1) + ',' + Y(p.y).toFixed(1)).join(' ');
    const tx = (x, y, t, a) => `<text x="${x}" y="${y}" text-anchor="${a || 'middle'}" font-size="12" style="fill:var(--mute)" font-family="system-ui">${esc(t)}</text>`;
    return `<svg class="dr" viewBox="0 0 360 160" role="img" aria-label="Ladezustand über drei Schlechtwettertage"><rect x="${L}" y="${T}" width="${W}" height="${H}" style="fill:none;stroke:var(--mute)"/><line x1="${L}" y1="${Y(0.2)}" x2="${L + W}" y2="${Y(0.2)}" style="stroke:var(--danger);stroke-width:1.2" stroke-dasharray="5 4"/><polyline points="${line}" style="fill:none;stroke:var(--accent);stroke-width:2.4"/>${tx(L - 4, Y(1) + 4, '100 %', 'end')}${tx(L - 4, Y(0.2) + 4, '20 %', 'end')}${tx(L - 4, Y(0) + 4, '0 %', 'end')}${tx(L + W / 2, T + H + 18, 'Zeit (drei Schlechtwettertage)')}${tx(L + W / 2, T + H + 34, 'gestrichelt: 20 % Ladezustand' + (fin(socMin) ? '; Minimum ' + fnum(100 * socMin, 0) + ' %' : ''))}</svg>`;
  }

  /* ---- Assistent ---- */
  const STEPS = ['Verbraucher', 'Standort und Wetter', 'Akku', 'Modul und Regler', 'Leitungen', 'Ergebnis'];
  function stepper(w) { return `<div class="chips" style="padding:0 0 8px">${STEPS.map((s, i) => `<button class="chip s${w.step === i + 1 ? ' on' : ''}" data-act="goto" data-n="${i + 1}">${w.done[i + 1] ? '✔ ' : ''}${i + 1} ${esc(s)}</button>`).join('')}</div>`; }
  function gRows(w) {
    return w.geraete.map((g, i) => `<div class="frm" data-row="${i}" style="margin-bottom:6px"><label class="f"><span>Gerät</span><input data-f="g:${i}:name" value="${esc(g.name)}" autocomplete="off"></label>${fld('g:' + i + ':P', 'Leistung', 'W', g.P)}${fld('g:' + i + ':stunden', 'Stunden je Tag', 'h', g.stunden)}${sel('g:' + i + ':typ', 'Strom', [{ value: 'dc', label: 'Gleichstrom' }, { value: 'ac', label: 'Wechselstrom' }], g.typ)}<div><button class="btn" data-act="grow-del" data-i="${i}" style="margin-top:0;min-height:40px">Gerät entfernen</button></div></div>`).join('');
  }
  const sumHtml = w => { const s = sumWh(w.geraete); return `<div class="res" style="margin-top:6px"><div class="big2">${fa(s)} Wh je Tag</div><p class="hint2" style="margin:2px 0 0">Summe aus Leistung mal Stunden. Der Wechselrichter-Eigenverbrauch kommt in der Auslegung (Schritt 6) dazu.</p></div>`; };
  function stepBody(w) {
    const n = w.step;
    if (n === 1) {
      const dc = deviceChoices();
      return `<p class="hint2" style="margin:0 0 8px">Sammle alle Verbraucher mit Leistung und Betriebsstunden je Tag. Du kannst mit einer Voreinstellung beginnen.</p><div class="chips" style="padding:0 0 6px">${PRESET_IDS.map(id => `<button class="chip s${w.preset === id ? ' on' : ''}" data-act="preset" data-id="${id}">${esc(FALLBACK[id].name)}</button>`).join('')}</div>
        <div data-res="grows">${gRows(w)}</div>${dc.length ? `<div class="frm" style="margin-top:6px">${sel('addDev', 'Gerät aus der Liste hinzufügen', [{ value: '', label: '– wählen –' }].concat(dc), '')}</div>` : ''}<div class="btns"><button class="btn" data-act="grow-add">+ Eigenes Gerät</button></div><div data-res="wsum">${sumHtml(w)}</div>`;
    }
    if (n === 2) return `<div class="frm">${sel('w:ort', 'Standort', siteChoices(), w.ort)}${sel('w:tag', 'Auslegungstag', DAYS.map(d => ({ value: d[1], label: d[0] })), w.tag)}${sel('w:wetter', 'Wetterlage', WEATHER.map(x => ({ value: x[0], label: x[1] })), w.wetter)}${fld('w:azimut', 'Ausrichtung (0 = Süd, West positiv)', '°', w.azimut)}</div>${chk('w:neigungAuto', 'Neigung automatisch (beste Neigung für den Auslegungstag)', w.neigungAuto)}${w.neigungAuto ? '' : `<div class="frm">${fld('w:neigung', 'Neigung (0 = waagerecht)', '°', w.neigung)}</div>`}<p class="hint2" style="margin:6px 0 0">Im Winter ist ein steiles Modul besser, im Sommer ein flaches. Für eine ganzjährige Inselanlage bemisst du für den schlechtesten Tag, meist den Dezember.</p><div data-res="sun">${sunView(w)}</div>`;
    if (n === 3) return `<div class="frm">${sel('w:Usys', 'Systemspannung', [{ value: 12, label: '12 V' }, { value: 24, label: '24 V' }, { value: 48, label: '48 V' }], w.Usys)}${sel('w:chem', 'Akku', [{ value: 'blei', label: 'Blei (AGM/Gel)' }, { value: 'lifepo4', label: 'Li-Ion (LiFePO4)' }], w.chem)}${fld('w:tage', 'Autonomietage ohne Sonne', 'Tage', w.tage)}</div>${chk('w:dodAuto', 'Entladetiefe nach Empfehlung der Akkuart', w.dodAuto)}${w.dodAuto ? '' : `<div class="frm">${fld('w:dod', 'Entladetiefe', '%', w.dod)}</div>`}<div data-res="akku">${akkuInfo(w)}</div>`;
    if (n === 4) return `<div class="frm">${sel('w:modul', 'Modultyp', moduleChoices(), w.modul)}${sel('w:regler', 'Reglertyp', [{ value: 'mppt', label: 'MPPT' }, { value: 'pwm', label: 'PWM' }], w.regler)}</div>${chk('w:sparmodus', 'Wechselrichter im Sparmodus (kleine Verbraucher unter 25 W werden nicht erkannt)', w.sparmodus)}<p class="hint2" style="margin:6px 0 0">Die Zahl der Module und die Strangbildung rechnet die Auslegung. Hier siehst du die Prüfungen dazu.</p><div data-res="s4">${resultPart(w, /uoc|start|strang|string|mpp/i)}</div>`;
    if (n === 5) return `<div class="frm">${fld('w:laenge:pv', 'Leitung Modul – Regler (einfach)', 'm', w.laenge.pv)}${fld('w:laenge:akku', 'Leitung Regler – Akku (einfach)', 'm', w.laenge.akku)}${fld('w:laenge:wr', 'Leitung Akku – Wechselrichter (einfach)', 'm', w.laenge.wr)}${fld('w:spannungsfall', 'Zulässiger Spannungsfall', '%', w.spannungsfall)}</div><p class="hint2" style="margin:6px 0 0">Gerechnet wird mit Hin- und Rückleitung. Je niedriger die Systemspannung, desto dicker muss das Kabel sein.</p><div data-res="s5">${resultPart(w, /kabel|sich|leit|fuse|cable/i)}</div>`;
    return `<div data-res="s6">${resultView()}</div>`;
  }
  function sunView(w) {
    const C = CORE(); if (!C || !C.sun || !C.sun.sites || !C.sun.sites[w.ort]) return '';
    const lat = C.sun.sites[w.ort].lat, N = Math.round(pn(w.tag)); if (!fin(N)) return '';
    const cm = CM[w.wetter] != null ? CM[w.wetter] : 0.625, gam = pn(w.azimut);
    const best = C.sun.bestTilt ? C.sun.bestTilt(N, lat, gam, cm) : NaN, tilt = w.neigungAuto ? best : pn(w.neigung);
    const e = C.sun.dayEnergy && fin(tilt) ? C.sun.dayEnergy({ N, lat, beta: tilt, gam, c: cm }) : NaN;
    const ss = C.sun.sunriseSunset ? C.sun.sunriseSunset(N, lat) : null;
    return `<div class="res">${kv('Beste Neigung für diesen Tag', fin(best) ? fa(best) + ' °' : '–')}${kv('Sonnenstunden (Volllaststunden) PSH', fin(e) ? fnum(e, 2) + ' h' : '–')}${ss && ss.polar === 'nacht' ? '<div class="big2">Polarnacht: Die Sonne geht nicht auf.</div>' : ''}<p class="hint2" style="margin:4px 0 0">Eine Stunde Volllaststunde heißt: 1 kWh Strahlung je Quadratmeter an diesem Tag in der Modulebene.</p></div>`;
  }
  function akkuInfo(w) {
    const C = CORE(); if (!C || !C.batt || !C.batt.defaults) return ''; const d = C.batt.defaults(w.chem, pn(w.Usys)); if (!d || d.ok === false) return '';
    return `<div class="res">${kv('Empfohlene größte Entladetiefe', fnum(100 * d.dodMax, 0) + ' %')}${kv('Ladeschlussspannung', fa(d.uAbs) + ' V')}${kv('Tiefentladeschutz bei', fa(d.uLvd) + ' V')}</div>`;
  }
  /* Teilergebnis in den Schritten 4 und 5: nur Prüfungen, die zum Schritt passen */
  function resultPart(w, re) {
    const d = (ST.res = designRun(w)); if (!d.ok) return warnHtml(d.why);
    const r = d.res, cs = (r.checks || []).filter(c => re.test(String(c.id || '') + ' ' + String(c.text || '')));
    let h = '<div class="res">';
    if (w.step === 4) h += kv('Modulleistung nötig', fin(r.pPv) ? fa(r.pPv) + ' W' : '–') + kv('Module gesamt', fin(r.nModule) ? String(r.nModule) : '–') + kv('Strangbildung', r.strang ? 'ns = ' + r.strang.ns + ' in Reihe, np = ' + r.strang.np + ' parallel' : '–') + kv('Laderegler', fin(r.reglerA) ? fa(r.reglerA) + ' A' : '–');
    else h += kabelRows(r);
    return h + '</div>' + ampel(cs);
  }
  const kabelRows = r => kv('Kabel Modul – Regler', r.kabel && fin(r.kabel.pv) ? fa(r.kabel.pv) + ' mm²' : '–') + kv('Kabel Regler – Akku', r.kabel && fin(r.kabel.akku) ? fa(r.kabel.akku) + ' mm²' : '–') + kv('Kabel Akku – Wechselrichter', r.kabel && fin(r.kabel.wr) ? fa(r.kabel.wr) + ' mm²' : '–') +
    kv('Sicherung Modul / Akku / Wechselrichter', r.sicherung ? [r.sicherung.pv, r.sicherung.akku, r.sicherung.wr].map(x => (fin(x) ? fa(x) + ' A' : '–')).join(' / ') : '–');
  function resultView() {
    const w = ST.wiz, d = (ST.res = designRun(w)); if (!d.ok) return warnHtml(d.why);
    const r = d.res; used(); w.done[6] = true;
    let h = `<div class="res"><div class="big2">${fin(r.pPv) ? fa(r.pPv) + ' W Modulleistung' : 'Auslegung'}</div>${kv('Tagesenergie (mit Wechselrichter-Eigenverbrauch)', fin(r.tagesWh) ? fa(r.tagesWh) + ' Wh' : '–')}${kv('Sonnenstunden PSH', fin(r.psh) ? fnum(r.psh, 2) + ' h' : '–')}${kv('Module', fin(r.nModule) ? r.nModule + (r.strang ? ' (ns = ' + r.strang.ns + ', np = ' + r.strang.np + ')' : '') : '–')}${kv('Akku', fin(r.akkuAh) ? fa(r.akkuAh) + ' Ah' + (fin(r.akkuKWh) ? ' (' + fnum(r.akkuKWh, 2) + ' kWh)' : '') : '–')}${kv('Laderegler', fin(r.reglerA) ? fa(r.reglerA) + ' A' : '–')}${kv('Wechselrichter', fin(r.wrVA) ? fa(r.wrVA) + ' VA' : '–')}${kabelRows(r)}</div>`;
    h += ampel(r.checks);
    h += `<details class="fm"><summary>Rechenweg Schritt für Schritt</summary><div class="fmb">${stepsHtml(r.steps) || '<p class="hint2">Der Kern liefert keinen Rechenweg.</p>'}</div></details>`;
    h += `<div class="btns"><button class="btn pri" data-act="verify">▶ Simulation prüfen</button><button class="btn" data-act="load">In den Prüfstand laden</button></div><div data-res="verify">${verifyView()}</div>`;
    return h;
  }
  function verifyView() {
    const v = ST.ver; if (!v) return '<p class="hint2">Die Simulation lässt drei Schlechtwettertage hintereinander laufen, der Akku beginnt voll.</p>'; if (!v.ok) return warnHtml(v.why);
    return `<div class="res"><div class="big2" style="color:${v.pass ? 'var(--ok)' : 'var(--danger)'}">${v.pass ? '✔ besteht' : '✖ fällt durch'}</div>${kv('Kleinster Ladezustand', fin(v.socMin) ? fnum(100 * v.socMin, 0) + ' %' : '–')}${fin(v.tLvd) && v.tLvd > 0 ? kv('Tiefentladeschutz hat getrennt (Zeitangabe des Kerns)', fa(v.tLvd) + ' h') : kv('Tiefentladeschutz', 'hat nicht getrennt')}${fin(v.tageUeberlebt) ? kv('Tage überstanden', fa(v.tageUeberlebt)) : ''}${socSvg(v.series, v.socMin)}${ampel(v.checks)}</div>`;
  }
  function wizBody() {
    const w = ST.wiz;
    return `<div data-res="stepper">${stepper(w)}</div><div data-res="wiz">${stepBody(w)}</div><div class="btns"><button class="btn" data-act="prev"${w.step <= 1 ? ' disabled' : ''}>◀ Zurück</button><button class="btn pri" data-act="next"${w.step >= 6 ? ' disabled' : ''}>Weiter ▶</button></div>`;
  }

  /* ---- Strang prüfen ---- */
  function strBody() {
    const s = ST.str;
    return `<div class="frm">${sel('s:spec', 'Modul', moduleChoices(), s.spec)}${fld('s:ns', 'Module in Reihe ns', '', s.ns)}${fld('s:np', 'Stränge parallel np', '', s.np)}${fld('s:tmin', 'Tiefste Zelltemperatur', '°C', s.tmin)}${fld('s:tmax', 'Höchste Zelltemperatur', '°C', s.tmax)}${sel('s:device', 'Gerät (Eingangsgrenzen)', deviceLimits().map(d => ({ value: d.value, label: d.label })), s.device)}${sel('s:Usys', 'Systemspannung (Regler)', [{ value: 12, label: '12 V' }, { value: 24, label: '24 V' }, { value: 48, label: '48 V' }], s.Usys)}</div><div data-res="str">${strView()}</div>`;
  }
  function strView() {
    const r = stringRun(ST.str); if (!r.ok) return warnHtml(r.why);
    return `<div class="res"><table class="kt"><tr><th>Größe</th><th class="n">Wert</th><th class="n">Grenze</th></tr><tr><td>Leerlaufspannung kalt Uoc</td><td class="n">${fa(r.UocKalt)} V</td><td class="n">≤ ${fa(r.lim.UdcMax)} V</td></tr><tr><td>MPP-Spannung heiß Umpp</td><td class="n">${fa(r.UmppHeiss)} V</td><td class="n">≥ ${fa(r.lim.mppMin)} V</td></tr><tr><td>Kurzschlussstrom Isc (alle Stränge)</td><td class="n">${fa(r.IscSumme)} A</td><td class="n">≤ ${fa(r.lim.IdcMax)} A</td></tr></table></div>${ampel(r.checks)}${r.source === 'oberflaeche' ? '<p class="hint2" style="margin:6px 0 0">Die Zahlen kommen aus pv.keys bei den Grenztemperaturen. Die ausführliche Prüfung des Kerns (design.stringCheck) ist noch nicht geladen.</p>' : ''}`;
  }

  /* ---- Leitung und Sicherung ---- */
  function cabBody() {
    const c = ST.cab; return `<div class="frm">${fld('c:I', 'Strom I', 'A', c.I)}${fld('c:L', 'Einfache Länge L', 'm', c.L)}${sel('c:U', 'Systemspannung', [{ value: 12, label: '12 V' }, { value: 24, label: '24 V' }, { value: 48, label: '48 V' }], c.U)}${fld('c:fall', 'Zulässiger Spannungsfall', '%', c.fall)}${fld('c:kappa', 'Leitwert κ', 'm/(Ω·mm²)', c.kappa)}</div><div data-res="cab">${cabView()}</div>`;
  }
  function cabView() {
    const r = cableRun(ST.cab); if (!r.ok) return warnHtml(r.why);
    let h = `<div class="res"><div class="big2">${fin(r.aNorm) ? fa(r.aNorm) + ' mm² (Normquerschnitt)' : fa(r.aMin) + ' mm²'}</div>${kv('Mindestquerschnitt', fa(r.aMin) + ' mm²')}${fin(r.ufall) ? kv('Spannungsfall mit dem Normquerschnitt', fa(r.ufall) + ' V = ' + fnum(100 * r.ufall / pn(ST.cab.U), 2) + ' %') : ''}${kv('Verlustleistung in der Leitung', fin(r.pV) ? fa(r.pV) + ' W' : '–')}${stepsHtml(r.steps)}</div>`;
    if (r.fuse && r.fuse.ok && fin(r.fuse.In)) h += `<div class="res">${kv('Sicherung (Gleichstromseite)', fa(r.fuse.In) + ' A')}${r.fuse.text ? `<p class="hint2" style="margin:4px 0 0">${esc(r.fuse.text)}</p>` : ''}</div>`;
    else if (r.fuse && r.fuse.ok === false) h += warnHtml(r.fuse.why || 'Keine Sicherung aus der Reihe passt: Querschnitt vergrößern.', 'var(--danger)');
    else if (r.fuseMissing) h += warnHtml('Die Sicherung wählt der Kern (design.fuse). Sie ist noch nicht geladen.');
    return h;
  }

  function renderAll() {
    return `<div class="card pl"><h4>Auslegen</h4><p class="big">Eine Anlage richtig bemessen und prüfen</p><p class="hint2" style="margin:0">Alle Zahlen kommen aus demselben Kern wie die Prüfstände und die Aufgaben. Der Assistent führt dich in sechs Schritten zur Stückliste mit Rechenweg und prüft sie in der Simulation.</p></div>` +
      card('wiz', '📐 1 Inselanlage-Assistent', wizBody(), true) + card('str', '🔌 2 Strang prüfen', strBody()) + card('cab', '📏 3 Leitung und Sicherung', cabBody());
  }

  /* ---- Zustand sichern und wiederherstellen ---- */
  function getState() { return { wiz: JSON.parse(JSON.stringify(ST.wiz)), str: Object.assign({}, ST.str), cab: Object.assign({}, ST.cab) }; }
  function setState(o) {
    if (!o || typeof o !== 'object') return false; const d = DEFAULT_WIZ();
    if (o.wiz && typeof o.wiz === 'object') { ST.wiz = Object.assign(d, o.wiz); ST.wiz.laenge = Object.assign(d.laenge, o.wiz.laenge || {}); ST.wiz.done = Object.assign({}, o.wiz.done || {}); if (!Array.isArray(ST.wiz.geraete)) ST.wiz.geraete = []; ST.wiz.step = Math.min(6, Math.max(1, Math.round(+ST.wiz.step) || 1)); }
    if (o.str && typeof o.str === 'object') Object.assign(ST.str, o.str); if (o.cab && typeof o.cab === 'object') Object.assign(ST.cab, o.cab);
    ST.res = null; ST.ver = null; return true;
  }
  function persist() { if (A && A.lsSet) { try { A.lsSet('enr.design', getState()); } catch (e) { /* Speicher voll oder gesperrt */ } } }
  function applyPreset(id) {
    const p = presetData(id); if (!p) return false; const w = ST.wiz;
    w.preset = id; w.geraete = p.geraete; w.Usys = p.Usys; w.tage = p.tage; w.chem = p.chem; w.laenge = p.laenge; w.sparmodus = false; w.done = {}; ST.res = null; ST.ver = null; return true;
  }

  /* ---- Ereignisse ---- */
  const coerceVal = el => (el.type === 'checkbox' ? el.checked : el.value);
  function showStep(host) { setRes(host, 'stepper', stepper(ST.wiz)); setRes(host, 'wiz', stepBody(ST.wiz)); const p = host.querySelector('[data-act="prev"]'), n = host.querySelector('[data-act="next"]'); if (p) p.disabled = ST.wiz.step <= 1; if (n) n.disabled = ST.wiz.step >= 6; }
  function setW(k, val) {
    const w = ST.wiz;
    if (k.indexOf('laenge:') === 0) w.laenge[k.slice(7)] = val; else w[k] = val;
    ST.res = null; ST.ver = null;
  }
  function onInput(host, e) {
    const el = e.target && e.target.closest ? e.target.closest('[data-f]') : null; if (!el) return; const k = el.dataset.f, val = coerceVal(el), w = ST.wiz;
    if (k === 'addDev') { const dv = deviceChoices().find(x => String(x.value) === String(val)); if (dv) { w.geraete.push({ name: dv.label.replace(/ \(.*$/, ''), P: dv.P, stunden: 1, typ: dv.typ }); w.preset = ''; ST.res = null; ST.ver = null; showStep(host); persist(); } return; }
    if (k.indexOf('g:') === 0) { const p = k.split(':'), g = w.geraete[+p[1]]; if (g) { g[p[2]] = val; ST.res = null; ST.ver = null; setRes(host, 'wsum', sumHtml(w)); persist(); } return; }
    if (k.indexOf('w:') === 0) {
      const key = k.slice(2); setW(key, val); persist();
      if (['neigungAuto', 'dodAuto', 'Usys', 'chem', 'ort', 'tag', 'wetter', 'neigung', 'azimut', 'tage', 'dod', 'modul', 'regler', 'sparmodus', 'laenge:pv', 'laenge:akku', 'laenge:wr', 'spannungsfall'].includes(key)) {
        if (key === 'neigungAuto' || key === 'dodAuto') showStep(host);
        else if (w.step === 2) setRes(host, 'sun', sunView(w)); else if (w.step === 3) setRes(host, 'akku', akkuInfo(w)); else if (w.step === 4) setRes(host, 's4', resultPart(w, /uoc|start|strang|string|mpp/i)); else if (w.step === 5) setRes(host, 's5', resultPart(w, /kabel|sich|leit|fuse|cable/i));
      }
      return;
    }
    if (k.indexOf('s:') === 0) { ST.str[k.slice(2)] = val; setRes(host, 'str', strView()); persist(); return; }
    if (k.indexOf('c:') === 0) { ST.cab[k.slice(2)] = val; setRes(host, 'cab', cabView()); persist(); }
  }
  function onClick(host, e) {
    const b = e.target && e.target.closest ? e.target.closest('[data-act]') : null; if (!b) return; const a = b.dataset.act, w = ST.wiz;
    if (a === 'goto') { w.step = Math.min(6, Math.max(1, +b.dataset.n)); showStep(host); persist(); }
    else if (a === 'next') { w.done[w.step] = true; w.step = Math.min(6, w.step + 1); showStep(host); persist(); }
    else if (a === 'prev') { w.step = Math.max(1, w.step - 1); showStep(host); persist(); }
    else if (a === 'preset') { if (applyPreset(b.dataset.id)) { showStep(host); persist(); } }
    else if (a === 'grow-add') { w.geraete.push({ name: 'Eigenes Gerät', P: 10, stunden: 1, typ: 'dc' }); w.preset = ''; ST.res = null; ST.ver = null; showStep(host); persist(); }
    else if (a === 'grow-del') { w.geraete.splice(+b.dataset.i, 1); w.preset = ''; ST.res = null; ST.ver = null; showStep(host); persist(); }
    else if (a === 'verify') { const d = ST.res && ST.res.ok ? ST.res : designRun(w); ST.ver = verifyRun(d); setRes(host, 'verify', verifyView()); }
    else if (a === 'load') {
      const d = ST.res && ST.res.ok ? ST.res : designRun(w); if (!d.ok) { if (A) A.toast('Die Auslegung hat noch kein Ergebnis: ' + d.why); return; } used(); persist();
      if (A && typeof A.loadDesign === 'function') A.loadDesign(d.inp, d.res); else if (A) A.toast('Der Prüfstand nimmt die Auslegung noch nicht an.');
    }
  }
  function render(host, api) {
    A = api; if (A && A.lsGet && !ST.restored) { ST.restored = true; const s = tryf(() => A.lsGet('enr.design', null), null); if (s && typeof s === 'object') setState(s); }
    if (!ST.wiz.geraete.length && !ST.wiz.preset) applyPreset('gartenhaus');
    host.innerHTML = renderAll();
    if (!host._enrDesign) { host._enrDesign = true; host.addEventListener('input', e => onInput(host, e)); host.addEventListener('change', e => onInput(host, e)); host.addEventListener('click', e => onClick(host, e)); }
  }
  const api0 = { render, getState, setState, fn: { buildInp, checkInp, designRun, verifyRun, seriesOf, stringRun, deviceLimits, limitsOf, cableRun, presetData, sumWh, deviceChoices, moduleChoices, siteChoices, winHours, socSvg }, ST, PRESET_IDS, DAYS };
  root.ENR_UI_EXT = root.ENR_UI_EXT || {}; root.ENR_UI_EXT.design = api0;
  if (typeof module !== 'undefined') module.exports = api0;
})(typeof window !== 'undefined' ? window : globalThis);
