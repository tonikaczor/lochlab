/* enrrig-netz.js - Energie-Lab (WP3c): Pruefstand 5 `netz` (Netzeinspeisung, Wechselrichter, Eigenverbrauch, Speicher, SPEC 5.3.5).
 * Die gemeinsame Basis der Tagespruefstaende (ENR_RIGS.baseC: Kernschritt, Uhr, Schreiber, Meldungen, Zeichnen, hitTest) liegt in enrrig-insel.js: Diese Datei im
 * Browser NACH enrrig-insel.js laden (in Node holt sie sich die Basis per require). Szene und Szenen-Vertrag (data) wie `insel` (ENR_DRAW.scene, gemeinsame Tageslandschaft).
 * Abhaengigkeiten: ENR_CORE (sun, pv, inv.gridTable/euroEta/eta, design.stringCheck, loads, sys, TEXTS). Preise (`bezug`, `verg`) sind Annahmen im Bedienpult.
 * Vorzeichen: Netz Einspeisung positiv, Bezug negativ; Speicher laden positiv. Zeit: Sonnenzeit, Festschritt 60 s. Wirft nie.
 */
(function (root) {
  'use strict';
  const R = root.ENR_RIGS = root.ENR_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };
  if (!R.baseC && typeof require === 'function') { try { require('./enrrig-insel.js'); } catch (e) { /* Basis fehlt */ } }
  const B = R.baseC;
  if (!B) { if (typeof console !== 'undefined') console.warn('enrrig-netz.js: Die Basis aus enrrig-insel.js fehlt (bitte davor laden).'); return; }
  const { clamp, num, fm, fin, isObj, TX, hhmm, LAT } = B;

  const PAR = { h: 60, tMinC: -10, tMaxC: 60, tBeginn: 6, schwelleW: 0.5 };
  // Rueckfallwerte der Wechselrichter-Typentabelle (SPEC 4.10), nur falls ENR_CORE.inv.gridTable nicht lesbar ist
  const GRID_FB = [{ Pn: 800, UdcMax: 60, mppMin: 28, mppMax: 48, start: 22, IdcMax: 25 }, { Pn: 1500, UdcMax: 600, mppMin: 120, mppMax: 500, start: 120, IdcMax: 12.5 }, { Pn: 3000, UdcMax: 600, mppMin: 150, mppMax: 500, start: 150, IdcMax: 12.5 },
    { Pn: 5000, UdcMax: 1000, mppMin: 150, mppMax: 800, start: 150, IdcMax: 12.5 }, { Pn: 8000, UdcMax: 1000, mppMin: 150, mppMax: 800, start: 150, IdcMax: 12.5 }];
  function gridRow(C, Pn) {
    let rows = null; try { rows = C.inv && C.inv.gridTable; } catch (e) { rows = null; }
    let r = null;
    if (Array.isArray(rows)) r = rows.find(x => x && num(x.Pn !== undefined ? x.Pn : x.pn, NaN) === Pn); else if (isObj(rows)) r = rows[Pn] || rows[String(Pn)];
    const pk = (o, a) => { for (let i = 0; i < a.length; i++) if (o && num(o[a[i]], NaN) === num(o[a[i]], NaN) && o[a[i]] !== undefined) return num(o[a[i]], NaN); return NaN; };
    const fb = GRID_FB.find(x => x.Pn === Pn) || GRID_FB[2];
    if (!r) return Object.assign({}, fb);
    let lo = pk(r, ['mppMin', 'mppLo', 'Umin', 'uMppMin']), hi = pk(r, ['mppMax', 'mppHi', 'Umax', 'uMppMax']);
    if ((!isFinite(lo) || !isFinite(hi)) && Array.isArray(r.mpp)) { lo = num(r.mpp[0], NaN); hi = num(r.mpp[1], NaN); }
    const o = { Pn: Pn, UdcMax: pk(r, ['UdcMax', 'Udc_max', 'udcMax', 'uDcMax']), mppMin: lo, mppMax: hi, start: pk(r, ['start', 'Ustart', 'uStart', 'startU']), IdcMax: pk(r, ['IdcMax', 'Idc_max', 'idcMax', 'iDcMax']) };
    Object.keys(o).forEach(k => { if (!isFinite(o[k])) o[k] = fb[k]; });
    return o;
  }

  const G_ANL = 'Anlage', G_WR = 'Wechselrichter und Netz', G_HAUS = 'Haus, Speicher, Preise';
  const CONTROLS = B.sunControls('Sonne und Wetter', 6, 'sommer').concat([
    { key: 'modul', label: 'Modultyp', type: 'select', value: 'si60', options: [{ value: 'si60', label: 'Modul 60 Zellen' }, { value: 'si72', label: 'Modul 72 Zellen' }], group: G_ANL, help: 'Übungsmodul mit 60 oder 72 Zellen. Mehr Zellen bedeuten mehr Spannung und mehr Leistung je Modul.' },
    { key: 'ns', label: 'Module je Strang', type: 'slider', scale: 'lin', min: 1, max: 20, step: 1, unit: '', value: 10, group: G_ANL, help: 'Module in Reihe: Die Spannungen addieren sich. Bei Kälte steigt die Leerlaufspannung, dann darf der Strang den Wechselrichter-Eingang nicht überspannen.' },
    { key: 'np', label: 'Stränge parallel', type: 'slider', scale: 'lin', min: 1, max: 3, step: 1, unit: '', value: 1, group: G_ANL, help: 'Stränge parallel: Die Ströme addieren sich. Der Eingangsstrom des Wechselrichters ist begrenzt.' },
    { key: 'neigung', label: 'Modulneigung', type: 'slider', scale: 'lin', min: 0, max: 90, step: 1, unit: '°', value: 35, group: G_ANL, help: 'Neigung gegen die Waagerechte (0° = flach). Im Winter ist es steil besser, im Sommer flach. Du kannst das Modul im Bild ziehen.' },
    { key: 'azimut', label: 'Modulausrichtung', type: 'slider', scale: 'lin', min: -90, max: 90, step: 5, unit: '°', value: 0, group: G_ANL, help: 'Ausrichtung des Dachs: 0° = genau nach Süden, negativ nach Osten, positiv nach Westen.' },
    { key: 'wrP', label: 'Wechselrichter-Nennleistung', type: 'select', value: 3000, options: [800, 1500, 3000, 5000, 8000].map(v => ({ value: v, label: v + ' W' })), group: G_WR, help: 'Nennleistung des Wechselrichters. Liefert das Feld mehr, wird begrenzt und Energie geht verloren (Clipping). Mit der Leistung ändern sich auch Spannungsfenster und Eingangsgrenzen.' },
    { key: 'wrTyp', label: 'Wechselrichter-Typ', type: 'select', value: 'standard', options: [{ value: 'standard', label: 'Standard' }, { value: 'einfach', label: 'einfach (billig)' }], group: G_WR, help: 'Der einfache Typ hat größere Verluste, vor allem im Teillastbereich. Der Europäische Wirkungsgrad fasst das in einer Zahl zusammen.' },
    { key: 'limit', label: 'Einspeisebegrenzung', type: 'slider', scale: 'lin', min: 30, max: 100, step: 5, unit: '%', value: 100, group: G_WR, help: 'Der Wechselrichter speist höchstens diesen Anteil seiner Nennleistung ein. Ob und wie weit das nötig ist, legt der Netzbetreiber fest.' },
    { key: 'netz', label: 'Netz vorhanden', type: 'switch', value: true, group: G_WR, help: 'Schaltet das Netz aus (Netzausfall). Der Wechselrichter schaltet dann ab und speist nicht ein, auch wenn die Sonne scheint. Du kannst auch den Mast im Bild antippen.' },
    { key: 'last', label: 'Hausverbrauch', type: 'select', value: 'haushalt', options: [{ value: 'haushalt', label: 'Haushalt' }, { value: 'haushalt-gross', label: 'großer Haushalt' }, { value: 'homeoffice', label: 'Homeoffice' }, { value: 'leer', label: 'Haus leer (Ferien)' }], group: G_HAUS, help: 'Tagesgang des Verbrauchs im Haus. Der Tagesverbrauch wird aus der Geräteliste gerechnet.' },
    { key: 'lastF', label: 'Verbrauchsfaktor', type: 'slider', scale: 'lin', min: 0.5, max: 2, step: 0.05, unit: '', value: 1, group: G_HAUS, help: 'Multipliziert den Verbrauch des gewählten Profils.' },
    { key: 'speicher', label: 'Speichergröße', type: 'slider', scale: 'lin', min: 0, max: 10, step: 0.5, unit: 'kWh', value: 0, group: G_HAUS, help: 'Nutzbare Speicherkapazität in Kilowattstunden. 0 = ohne Speicher. Der Speicher nimmt Überschuss auf und gibt ihn abends wieder ab, mit Verlusten in jede Richtung.' },
    { key: 'bezug', label: 'Strompreis (Annahme)', type: 'slider', scale: 'lin', min: 20, max: 60, step: 1, unit: 'ct/kWh', value: 35, group: G_HAUS, help: 'Annahme, bitte aktualisieren: Preis für Strom aus dem Netz. Er bestimmt, wie viel du mit Eigenverbrauch sparst.' },
    { key: 'verg', label: 'Vergütung (Annahme)', type: 'slider', scale: 'lin', min: 0, max: 15, step: 0.5, unit: 'ct/kWh', value: 8, group: G_HAUS, help: 'Annahme, bitte aktualisieren: Vergütung je eingespeister Kilowattstunde. Sie ist kein Fachwert, die aktuelle Höhe gibt der Ausbilder vor.' }
  ]);
  const METERS = [
    { key: 'pDc', label: 'Gleichstromleistung am Eingang', unit: 'W', digits: 0, min: 0, max: 9000 },
    { key: 'uDc', label: 'Strangspannung (Betrieb)', unit: 'V', digits: 0, min: 0, max: 1000 },
    { key: 'pAc', label: 'Wechselstromleistung', unit: 'W', digits: 0, min: 0, max: 8000 },
    { key: 'eta', label: 'Wirkungsgrad des Wechselrichters', unit: '%', digits: 1, min: 0, max: 100 },
    { key: 'pHaus', label: 'Hausverbrauch', unit: 'W', digits: 0, min: 0, max: 6000 },
    { key: 'pNetz', label: 'Netz (Einspeisung positiv, Bezug negativ)', unit: 'W', digits: 0, min: -6000, max: 8000 },
    { key: 'pSp', label: 'Speicher (laden positiv)', unit: 'W', digits: 0, min: -5000, max: 5000 },
    { key: 'socSp', label: 'Ladezustand des Speichers', unit: '%', digits: 0, min: 0, max: 100 },
    { key: 'eEigen', label: 'Eigenverbrauch heute (aus Solar)', unit: 'Wh', digits: 0, min: 0, max: 20000 },
    { key: 'eEinsp', label: 'Einspeisung heute', unit: 'Wh', digits: 0, min: 0, max: 40000 },
    { key: 'eBezug', label: 'Netzbezug heute', unit: 'Wh', digits: 0, min: 0, max: 20000 },
    { key: 'quote', label: 'Eigenverbrauchsquote', unit: '%', digits: 0, min: 0, max: 100 },
    { key: 'autarkie', label: 'Autarkiegrad', unit: '%', digits: 0, min: 0, max: 100 },
    { key: 'eurTag', label: 'Ersparnis plus Vergütung heute (Annahme)', unit: '€', digits: 2, min: 0, max: 20 },
    { key: 'uocKalt', label: 'Leerlaufspannung des Strangs bei −10 °C', unit: 'V', digits: 0, min: 0, max: 1200, warnAbove: 1000 },
    { key: 'euroEta', label: 'Europäischer Wirkungsgrad', unit: '%', digits: 1, min: 0, max: 100 }
  ];

  // ---- Strangpruefung (Spannungen aus pv.keys ueber design.stringCheck, nicht neu gerechnet) ----
  const scCache = {};
  function stringOf(C, ctl) {
    const g = gridRow(C, +ctl.wrP), key = [ctl.modul, ctl.ns, ctl.np, ctl.wrP].join('|'); if (scCache[key]) return scCache[key];
    let r = null; try { r = C.design.stringCheck({ spec: ctl.modul, ns: ctl.ns, np: ctl.np, TminC: PAR.tMinC, TmaxC: PAR.tMaxC, UdcMax: g.UdcMax, mppMin: g.mppMin, mppMax: g.mppMax, IdcMax: g.IdcMax }); } catch (e) { r = null; }
    r = isObj(r) ? r : {}; const o = { UocKalt: fin(r.UocKalt), UmppHeiss: fin(r.UmppHeiss), IscSumme: fin(r.IscSumme), grid: g, checks: Array.isArray(r.checks) ? r.checks : [] };
    const ks = Object.keys(scCache); if (ks.length > 40) delete scCache[ks[0]]; return (scCache[key] = o);
  }
  // Strang so lang, dass die Spannung unter den Bedingungen der Voreinstellung (Fruehjahrsmorgen, klar, kalt) den Eingang uebersteigt; Zahl aus dem Kern
  function nsZuLang() {
    try {
      const C = B.getCore(), g = gridRow(C, 3000), N = B.NDAT.fruehling, tS = 7.5, q = C.sun.poa({ N: N, tS: tS, lat: LAT.mitte, beta: 35, gam: 0, c: 0, m: 1 });
      const sp = C.pv.spec('si60'), tc = C.pv.cellTemp(C.sun.climate('mitte', N, tS), q.g, sp.NOCT), k = C.pv.keys('si60', { G: q.g, Tc: tc });
      if (!(k && k.Uoc > 0)) return 18; return clamp(Math.floor(g.UdcMax / k.Uoc) + 2, 2, 20);
    } catch (e) { return 18; }
  }
  const PRESETS = [
    { id: 'sommer', name: 'Sonniger Sommertag', params: { datum: 'sommer', wetter: 'klar', uhr: 6 } },
    { id: 'steckersolar', name: 'Steckersolargerät (800 VA, Stand der Regelung prüfen)', params: { modul: 'si60', ns: 1, np: 2, wrP: 800, wrTyp: 'standard', datum: 'sommer', wetter: 'klar', uhr: 6 } },
    { id: 'wr-zu-klein', name: 'Wechselrichter zu klein (Clipping)', params: { modul: 'si60', ns: 14, np: 1, wrP: 1500, datum: 'sommer', wetter: 'klar', uhr: 8 } },
    { id: 'netzausfall', name: 'Netzausfall mittags', params: { netz: false, datum: 'sommer', wetter: 'klar', uhr: 12 } },
    { id: 'speicher', name: 'Mit Speicher 5 kWh', params: { speicher: 5, datum: 'sommer', wetter: 'klar', uhr: 6 } },
    { id: 'winter-bedeckt', name: 'Winter bedeckt', params: { datum: 'winter', wetter: 'bedeckt', uhr: 8, lauf: 'schnell' } },
    { id: 'strang-zu-lang', name: 'Strang zu lang', params: { ns: nsZuLang(), wrP: 3000, datum: 'fruehling', wetter: 'klar', uhr: 7.5 } }
  ];

  function buildCfg(ctl, s, w) {
    return { typ: 'netz', ort: ctl.ort, N: s.N, tS: s.tS, tage: 365, neigung: ctl.neigung, azimut: ctl.azimut, wetter: w, feld: { spec: ctl.modul, ns: ctl.ns, np: ctl.np },
      wr: { modell: ctl.wrTyp, Pn: +ctl.wrP, limit: ctl.limit / 100 }, last: { profil: ctl.last, faktor: ctl.lastF }, netz: { ok: !!ctl.netz, limit: ctl.limit / 100, speicherKWh: ctl.speicher }, h: PAR.h };
  }
  // Leistungsaufteilung aus pAc, pHaus, pNetz, pSp (Haus = direkt + aus Speicher + Bezug; AC = direkt + in Speicher + Einspeisung)
  function split(st) {
    const inSp = Math.max(0, st.pSp), outSp = Math.max(0, -st.pSp), einsp = Math.max(0, st.pNetz), bezug = Math.max(0, -st.pNetz);
    return { inSp: inSp, outSp: outSp, einsp: einsp, bezug: bezug, direkt: Math.max(0, st.pAc - inSp - einsp) };
  }
  function integrate(E, st, dtH) {
    const s = split(st);
    E.eAc += st.pAc * dtH; E.eDirekt += s.direkt * dtH; E.eInSp += s.inSp * dtH; E.eAusSp += s.outSp * dtH; E.eEinsp += s.einsp * dtH; E.eBezug += s.bezug * dtH; E.eHaus += st.pHaus * dtH;
    E.ePv += st.pDc * dtH; E.ePot += st.pPot * dtH; E.eCurt += st.pCurt * dtH; E.eEigen = E.eDirekt + E.eAusSp;
  }
  function sample(st) {
    const s = split(st);
    return { pv: st.pDc, load: st.pHaus, bat: st.pSp, soc: st.socSp * 100, netz: st.pNetz, pot: st.pPot, haus: st.pHaus, ac: st.pAc, sp: st.pSp,
      tr: { g: st.gPoa, pDc: st.pDc, pAc: st.pAc, pHaus: st.pHaus, pNetz: st.pNetz, pSp: st.pSp, socSp: st.socSp * 100, direkt: s.direkt } };
  }
  function meters(c) {
    const st = c.st || B.norm(null), E = c.E || {}, ctl = c.ctl, sc = stringOf(c.C, ctl);
    let euro = NaN; try { euro = c.C.inv.euroEta(ctl.wrTyp) * 100; } catch (e) { euro = 0; }
    const quote = E.eAc > 0.001 ? (E.eDirekt + E.eInSp) / E.eAc * 100 : null, aut = E.eHaus > 0.001 ? (E.eDirekt + E.eAusSp) / E.eHaus * 100 : null;
    const eur = ((E.eEigen || 0) / 1000 * ctl.bezug + (E.eEinsp || 0) / 1000 * ctl.verg) / 100;
    return { pDc: st.pDc, uDc: st.uDc, pAc: st.pAc, eta: st.eta * (st.eta <= 1.5 ? 100 : 1), pHaus: st.pHaus, pNetz: st.pNetz, pSp: st.pSp, socSp: st.socSp * 100, eEigen: E.eEigen, eEinsp: E.eEinsp, eBezug: E.eBezug,
      quote: quote === null ? null : clamp(quote, 0, 100), autarkie: aut === null ? null : clamp(aut, 0, 100), eurTag: eur, uocKalt: sc.UocKalt, euroEta: euro };
  }

  // ---- Meldungen (jede nur bei geprueft erfuellter Bedingung, Texte aus ENR_CORE.TEXTS) ----
  function diag(c) {
    const st = c.st, ctl = c.ctl, C = c.C, E = c.E, out = []; if (!st) return out;
    const g = gridRow(C, +ctl.wrP), add = (id, kind, vars, fx) => { const d = { id: id, kind: kind, text: TX(C, id, vars) }; if (fx) d.fx = fx; out.push(d); };
    const pnLim = +ctl.wrP * ctl.limit / 100;
    if (st.gPoa < 1) add('nacht', 'info', {});
    if (c.sun.polar === 'nacht') add('polarnacht', 'info', {});
    if (!ctl.netz) add('netzausfall', 'warn', {});
    if (st.wrDead) { let uoc = st.uOc; if (!(uoc > 0)) { try { uoc = c.C.pv.keys(ctl.modul, { G: Math.max(st.gPoa, 1), Tc: st.tcell }).Uoc * ctl.ns; } catch (e) { uoc = 0; } } add('wr-zerstoert', 'error', { x: fm(uoc, 0), y: fm(g.UdcMax, 0) }, 'crash'); }
    else if (st.gPoa >= 50 && st.window === false && st.pDc > 0) add('wr-fenster', 'warn', { x: fm(st.uMpp > 0 ? st.uMpp : st.uDc, 0), y: fm(g.mppMin, 0), z: fm(g.mppMax, 0) });
    if (ctl.netz && !st.wrDead && st.pCurt > 1 && st.pAc >= 0.98 * pnLim && (+ctl.limit >= 100)) add('wr-clipping', 'warn', { x: fm(st.pAc, 0), y: fm(st.pPot, 0), z: fm(E.eCurt, 0) });
    if (ctl.netz && ctl.speicher > 0 && st.socSp >= 0.99 && st.pNetz > 1) add('speicher-voll', 'info', { x: fm(st.pNetz, 0) });
    if (ctl.netz && +ctl.limit < 100 && st.pAc >= pnLim - 1 && st.pCurt > 1) add('limit-aktiv', 'info', { x: fm(pnLim, 0) });
    return out;
  }
  function edges(c) {
    const st = c.st, p = c.prev, C = c.C, out = []; if (!st || !p) return out;
    const add = (id, kind, vars, fx) => { const d = { id: id, kind: kind, text: TX(C, id, vars), key: id }; if (fx) d.fx = fx; out.push(d); };
    if (p.elev <= 0 && st.elev > 0) add('sonnenaufgang', 'info', { x: hhmm(c.tS) }, 'ding');
    if (p.elev > 0 && st.elev <= 0) add('sonnenuntergang', 'info', { x: hhmm(c.tS) });
    if (p.pAc <= PAR.schwelleW && st.pAc > PAR.schwelleW) add('wr-start', 'info', {});
    if (p.pAc > PAR.schwelleW && st.pAc <= PAR.schwelleW && st.elev > 0) add('wr-stopp', 'info', {});
    return out;
  }

  // ---- Szene ----
  function scene(c, st) {
    const ctl = c.ctl, s = split(st), E = c.E || {}, pn = +ctl.wrP;
    const flows = [
      { id: 'pv', from: 'modul', to: 'wr', P: st.pDc, kind: 'solar', label: 'Solar' },
      { id: 'direkt', from: 'wr', to: 'haus', P: s.direkt, kind: 'last', label: 'Eigenverbrauch' },
      { id: 'sp-in', from: 'wr', to: 'speicher', P: s.inSp, kind: 'laden', label: 'Speicher lädt' },
      { id: 'sp-out', from: 'speicher', to: 'haus', P: s.outSp, kind: 'entladen', label: 'Speicher entlädt' },
      { id: 'einsp', from: 'wr', to: 'netz', P: s.einsp, kind: 'einspeisung', label: 'Einspeisung' },
      { id: 'bezug', from: 'netz', to: 'haus', P: s.bezug, kind: 'bezug', label: 'Netzbezug' },
      { id: 'verl-wr', from: 'wr', to: 'verlust', P: Math.max(0, st.pDc - st.pAc), kind: 'verlust', label: 'Wechselrichterverlust', loss: true }
    ];
    const led = st.wrDead || !ctl.netz ? 'rot' : (st.pAc > PAR.schwelleW ? 'gruen' : 'gelb');
    return { house: { kind: 'wohnhaus', lamps: st.pHaus > 1, pump: false, jet: false }, modules: { spec: ctl.modul, ns: ctl.ns, np: ctl.np, beta: ctl.neigung, gam: ctl.azimut, tc: st.tcell },
      flows: flows, tech: { inv: { on: !!st.wrOn, pDc: st.pDc, pAc: st.pAc, sn: pn, eta: st.eta, led: led, fan: st.pDc > 0.5 * pn, dead: st.wrDead },
        meter: { bezugWh: E.eBezug || 0, einspWh: E.eEinsp || 0, dir: st.pNetz > 0.5 ? 1 : (st.pNetz < -0.5 ? -1 : 0) }, grid: { ok: !!ctl.netz }, speicher: { soc: st.socSp, kWh: ctl.speicher, p: st.pSp } },
      labels: { status: !ctl.netz ? 'Netzausfall: Mast dunkel, Wechselrichter aus' : (st.gPoa < 1 ? 'Nacht: Das Haus bezieht alles aus dem Netz' : ''), bubble: !ctl.netz ? 'Netz weg – ich schalte ab!' : (st.pCurt > 1 && st.pAc >= 0.98 * pn * ctl.limit / 100 ? 'Zu viel Sonne!' : '') } };
  }
  function hit(k, c, st, u) {
    const ctl = c.ctl;
    if (k === 'wr') return { kind: 'info', id: 'wr', title: 'Wechselrichter', text: ctl.wrP + ' W, ' + (ctl.wrTyp === 'standard' ? 'Standard' : 'einfach') + ': Eingang ' + u.fm(st.pDc, 0) + ' W bei ' + u.fm(st.uDc, 0) + ' V, Ausgang ' + u.fm(st.pAc, 0) + ' W, Wirkungsgrad ' + u.fm(st.eta * (st.eta <= 1.5 ? 100 : 1), 1) + ' %.' };
    if (k === 'mast') return { key: 'netz', kind: 'switch', to: !ctl.netz };
    if (k === 'speicher') return ctl.speicher > 0 ? { kind: 'info', id: 'speicher', title: 'Speicher', text: u.fm(ctl.speicher, 1) + ' kWh: Ladezustand ' + u.fm(st.socSp * 100, 0) + ' %, Leistung ' + u.fm(st.pSp, 0) + ' W (laden positiv).' } : { key: 'speicher', kind: 'switch', to: 5 };
    if (k === 'zaehler') return { kind: 'info', id: 'zaehler', title: 'Zähler', text: 'Heute bezogen ' + u.fm(c.E.eBezug, 0) + ' Wh, eingespeist ' + u.fm(c.E.eEinsp, 0) + ' Wh. Netz jetzt ' + u.fm(st.pNetz, 0) + ' W (Einspeisung positiv, Bezug negativ).' };
    return null;
  }

  // ---- Kennlinien ----
  function curves(c, x) {
    const st = c.st || B.norm(null), E = c.E, ctl = c.ctl, C = c.C, dt = x.dayTrace(), sc = stringOf(C, ctl), g = sc.grid, pn = +ctl.wrP;
    let euro = 0, etaPts = [], eurPts = []; const W = [[0.05, 0.03], [0.10, 0.06], [0.20, 0.13], [0.30, 0.10], [0.50, 0.48], [1.0, 0.20]];
    try { euro = C.inv.euroEta(ctl.wrTyp) * 100; for (let p = 1; p <= 100; p++) etaPts.push([p, +(C.inv.eta(ctl.wrTyp, p / 100) * 100).toFixed(3)]); W.forEach(w => eurPts.push({ p: w[0] * 100, eta: +(C.inv.eta(ctl.wrTyp, w[0]) * 100).toFixed(3), weight: w[1] })); } catch (e) { euro = 0; }
    const sp = dt.t.map((tt, i) => { const a = Math.max(0, dt.sp[i]), o = Math.max(0, -dt.sp[i]), en = Math.max(0, dt.netz[i]), bz = Math.max(0, -dt.netz[i]); return { t: tt, direkt: Math.max(0, dt.ac[i] - a - en), sp: a, einsp: en, bezug: bz, haus: dt.haus[i], out: o }; });
    const zip = f => sp.map(r => [r.t, +f(r).toFixed(2)]);
    const pEur = (wh, ct) => +(wh / 1000 * ct / 100).toFixed(3);
    return [
      { id: 'eta', kind: 'eta', title: 'Wirkungsgrad über der Last', xLabel: 'Last bezogen auf die Nennleistung', xUnit: '%', yLabel: 'Wirkungsgrad', yUnit: '%', series: [{ name: ctl.wrTyp === 'standard' ? 'Standard' : 'einfach', points: etaPts, line: 'solid' }],
        euroPoints: eurPts, euroEta: euro, marker: { x: pn > 0 ? st.pAc / pn * 100 : 0, y: st.eta * (st.eta <= 1.5 ? 100 : 1) } },
      { id: 'tagesgang', kind: 'stack', title: 'Tagesgang gestapelt', xLabel: 'Sonnenzeit', xUnit: 'h', yLabel: 'Leistung', yUnit: 'W', now: dt.now, night: { rise: dt.rise, set: dt.set, polar: dt.polar },
        stack: [{ name: 'Eigenverbrauch direkt', points: zip(r => r.direkt), line: 'solid' }, { name: 'Speicher lädt', points: zip(r => r.sp), line: 'dash' }, { name: 'Einspeisung', points: zip(r => r.einsp), line: 'dashdot' }],
        series: [{ name: 'Netzbezug', points: zip(r => -r.bezug), line: 'dotdash' }, { name: 'Hausverbrauch', points: zip(r => r.haus), line: 'solid' }], marker: { x: dt.now, y: st.pAc } },
      { id: 'strang', kind: 'bars', title: 'Strangprüfung', yUnit: 'V', bars: [{ id: 'uoc-kalt', label: 'Leerlaufspannung bei −10 °C', value: +sc.UocKalt.toFixed(1), unit: 'V', limit: g.UdcMax, ok: sc.UocKalt <= g.UdcMax },
        { id: 'umpp-heiss', label: 'MPP-Spannung bei 60 °C', value: +sc.UmppHeiss.toFixed(1), unit: 'V', limit: g.mppMin, ok: sc.UmppHeiss >= g.mppMin && sc.UmppHeiss <= g.mppMax }, { id: 'udc-max', label: 'Höchste Eingangsspannung', value: g.UdcMax, unit: 'V' },
        { id: 'mpp-min', label: 'MPP-Fenster von', value: g.mppMin, unit: 'V' }, { id: 'mpp-max', label: 'MPP-Fenster bis', value: g.mppMax, unit: 'V' }], iscSumme: +sc.IscSumme.toFixed(2), idcMax: g.IdcMax },
      { id: 'clipping', kind: 'line', title: 'Clipping: Feldleistung gegen Wechselrichter', xLabel: 'Sonnenzeit', xUnit: 'h', yLabel: 'Leistung', yUnit: 'W', now: dt.now, night: { rise: dt.rise, set: dt.set, polar: dt.polar },
        series: [{ name: 'Feldleistung (Potenzial)', points: dt.t.map((tt, i) => [tt, +dt.pot[i].toFixed(1)]), line: 'solid' }, { name: 'Wechselrichter-Nennleistung', points: [[0, pn], [24, pn]], line: 'dash' },
          { name: 'Einspeisung (Wechselstrom)', points: dt.t.map((tt, i) => [tt, +dt.ac[i].toFixed(1)]), line: 'dot' }], lostWh: +E.eCurt.toFixed(1), marker: { x: dt.now, y: st.pPot } },
      { id: 'bilanz', kind: 'bars', title: 'Tagesbilanz', yUnit: 'Wh', note: 'Preise sind Annahmen, bitte aktualisieren.',
        bars: [{ id: 'ac', label: 'Solar (Wechselstrom)', value: +E.eAc.toFixed(1), unit: 'Wh' }, { id: 'direkt', label: 'Eigenverbrauch direkt', value: +E.eDirekt.toFixed(1), unit: 'Wh' }, { id: 'in-sp', label: 'In den Speicher', value: +E.eInSp.toFixed(1), unit: 'Wh' },
          { id: 'einsp', label: 'Eingespeist', value: +E.eEinsp.toFixed(1), unit: 'Wh' }, { id: 'bezug', label: 'Aus dem Netz bezogen', value: +E.eBezug.toFixed(1), unit: 'Wh' }, { id: 'haus', label: 'Hausverbrauch', value: +E.eHaus.toFixed(1), unit: 'Wh' }],
        euro: [{ id: 'gespart', label: 'Eigenverbrauch (gespart)', value: pEur(E.eEigen, ctl.bezug), unit: '€' }, { id: 'verg', label: 'Einspeisung (Vergütung)', value: pEur(E.eEinsp, ctl.verg), unit: '€' }, { id: 'kosten', label: 'Netzbezug (kostet)', value: pEur(E.eBezug, ctl.bezug), unit: '€' }] }
    ];
  }
  function analysis(c, st) {
    const ctl = c.ctl, C = c.C, sc = stringOf(C, ctl), E = c.E; let euro = 0; try { euro = C.inv.euroEta(ctl.wrTyp) * 100; } catch (e) { euro = 0; }
    let prof = null; try { prof = C.loads.profile(ctl.last, {}); } catch (e) { prof = null; }
    return { ok: true, state: st, string: { UocKalt: sc.UocKalt, UmppHeiss: sc.UmppHeiss, IscSumme: sc.IscSumme, UdcMax: sc.grid.UdcMax, mppMin: sc.grid.mppMin, mppMax: sc.grid.mppMax, IdcMax: sc.grid.IdcMax, checks: sc.checks },
      euroEta: euro, tagesWh: prof ? fin(prof.energyWh) * ctl.lastF : 0, bilanz: Object.assign({}, E) };
  }

  R.register({
    id: 'netz', name: 'Netzeinspeisung und Eigenverbrauch', icon: '\u{1F50C}',
    info: 'Netzgekoppelte Anlage mit Wohnhaus: Strangauslegung gegen das Spannungsfenster des Wechselrichters, Wirkungsgradkurve, Clipping, Netzausfall, Eigenverbrauch, Autarkie und Speicher. Preise und Vergütung sind Annahmen, die du ändern kannst.',
    controls: CONTROLS, meters: METERS, presets: PRESETS,
    create(opts) {
      return B.makeDayRig({ id: 'netz', h: PAR.h, params: PAR, controls: CONTROLS, meters: METERS, presets: PRESETS, world: { w: 1000, h: 640 }, uhr0: PAR.tBeginn,
        beta: ctl => ctl.neigung, gam: ctl => ctl.azimut, buildCfg: buildCfg, integrate: integrate, sample: sample, meterFn: meters, diag: diag, edges: edges, scene: scene, hit: hit,
        hitOrder: ['wr', 'mast', 'speicher', 'zaehler'], curves: curves, analysis: analysis, live: ['bezug', 'verg'] }, opts);
    }
  });

  if (typeof module !== 'undefined') module.exports = R;
})(typeof window !== 'undefined' ? window : globalThis);
