/* enrrig-regler.js - Energie-Lab: Pruefstand `regler` (Laderegler mit Akku, SPEC 5.3.3)
 * Modul, Laderegler (PWM, MPPT, direkt), Akku (Blei, Lithium) und Gleichstromlast. Die Physik liegt im Kern (ENR_CORE.sys.create, 4.12);
 * dieser Pruefstand fuehrt nur Bedienpult, Zeitschritt, Messschreiber, Tagesgang, Meldungen und die Szene (Sonne, Modul, Regler, Akku, Last,
 * Energieflusspfeile) aus. Zugriff auf den Kern nur ueber den Anschluss `sim()` weiter unten (Feldnamen als Alternativlisten `pk`).
 * Ohne ENR_CORE laeuft der Pruefstand mit Nullwerten und zeigt einen Hinweistext (wirft nie).
 * Zeichnen: eigene Szene in Pixelkoordinaten (Welt 1000 x 640 quer, 560 x 900 hoch), Pfeile ueber ENR_DRAW.flow, falls vorhanden.
 * Schnittstelle der Zeichnung wie regrig: draw(ctx, cw, ch, tms), hitTest(x, y, cw, ch) -> { key, kind:'switch', to, value } | { key, kind:'info', title, text }.
 */
(function (root) {
  'use strict';
  const R = root.ENR_RIGS = root.ENR_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };

  // ---------------------------------------------------------------- Hilfen
  const fin = v => typeof v === 'number' && isFinite(v);
  const num = (v, d) => (fin(v) ? v : (d === undefined ? 0 : d));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  function core() {
    if (root.ENR_CORE && root.ENR_CORE.sys) return root.ENR_CORE;
    if (typeof require === 'function') { try { require('./enrcore.js'); require('./enrsys.js'); } catch (e) { /* Kern fehlt */ } }
    return root.ENR_CORE || null;
  }
  function fm(x, d) { x = num(x, 0); d = d === undefined ? 1 : d; const C = root.ENR_CORE; if (C && typeof C.fmt === 'function') { try { const s = C.fmt(x, d); if (typeof s === 'string' && s) return s; } catch (e) { /* weiter */ } } return x.toFixed(d).replace('.', ','); }
  const fn = (x, d) => fm(x, d === undefined ? 0 : d);
  const wtxt = p => { p = num(p, 0); return Math.abs(p) >= 1000 ? fm(p / 1000, 2) + ' kW' : fm(p, 0) + ' W'; };
  // Wert aus einem Zustandsobjekt nach Alternativnamen (auch eine Ebene tiefer)
  const NEST = ['regler', 'ctrl', 'akku', 'batt', 'pv', 'sun', 'last', 'load', 'meters'];
  function pk(s, names, d) {
    if (!s || typeof s !== 'object') return d;
    for (const n of names) if (fin(s[n])) return s[n];
    for (const g of NEST) { const o = s[g]; if (o && typeof o === 'object') for (const n of names) if (fin(o[n])) return o[n]; }
    return d;
  }
  function pkAny(s, names) {
    if (!s || typeof s !== 'object') return undefined;
    for (const n of names) if (s[n] !== undefined && s[n] !== null) return s[n];
    for (const g of NEST) { const o = s[g]; if (o && typeof o === 'object') for (const n of names) if (o[n] !== undefined && o[n] !== null) return o[n]; }
    return undefined;
  }
  const reduced = () => { try { return !!(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } };

  // ---------------------------------------------------------------- Konstanten
  const KAPPA = 56;                       // Kupfer, m/(Ohm mm2) (SPEC 4.13)
  const H = 30;                           // Kernschritt, s
  const SAMPLE_S = 60;                    // Abtastung Schreiber und Tagesgang, s
  const PAR = { kappa: KAPPA, h: H, neigung: 35, azimut: 0, sampleS: SAMPLE_S, uBlatt: 1.15, ugasBlei: 14.8, absDelta: 0.8, schwellePwm: 0.8, kabelGrenze: 0.03 };
  const WX = { klar: { c: 0 }, heiter: { c: 0.25 }, wolkig: { c: 0.625 }, bedeckt: { c: 1 }, wechselhaft: { c: 0.5, zug: true } };
  const DATUM = { sommer: 172, fruehling: 80, winter: 355 };
  const LAT = { mitte: 51.7, sued: 37.4, nord: 60, pol: 70 };               // Notfallwerte, sonst ENR_CORE.sun.sites
  const LAUF = { aus: 600, langsam: 300, normal: 600, schnell: 1800 };      // Prozess-Sekunden je Echt-Sekunde
  const STAGE_TXT = ['aus', 'Bulk', 'Absorption', 'Float'];
  const BDEF = { blei: { abs: 14.4, flt: 13.6, lvd: 11.1, peukert: 1.2, ri: 0.009 }, lifepo4: { abs: 14.2, flt: 13.5, lvd: 11.2, peukert: 1.03, ri: 0.005 } };   // Notfall (SPEC 4.9), sonst ENR_CORE.batt.defaults
  const STRUCT = ['modul', 'ns', 'np', 'ctrl', 'chem', 'usys', 'cap', 'quelle', 'ort', 'wetter', 'wolken', 'seed', 'imax', 'uocMax'];   // Aenderung baut die Anlage neu auf, alles andere geht ueber sim.update
  const IZ = { 1.5: 18, 2.5: 24, 4: 32, 6: 41, 10: 57, 16: 76, 25: 101 };    // Belastbarkeit Kupferleitung in A (A), nur fuer die Meldung kabel-ueberlast
  const rLeit = (L, A) => 2 * num(L, 0) / (KAPPA * Math.max(num(A, 1), 0.1));

  function battDef(chem, usys) {
    const k = usys / 12, C = core(), f = BDEF[chem] || BDEF.blei, out = { abs: f.abs * k, flt: f.flt * k, lvd: f.lvd * k, peukert: f.peukert, ri: f.ri * k };       // ri: Innenwiderstand bei 100 Ah und dieser Systemspannung
    try {
      if (C && C.batt && typeof C.batt.defaults === 'function') {
        const d = C.batt.defaults(chem, usys);
        if (d && d.ok !== false) {
          out.abs = pk(d, ['uAbs', 'Uabs', 'U_abs', 'abs'], out.abs); out.flt = pk(d, ['uFloat', 'Ufloat', 'U_float', 'float', 'flt'], out.flt);
          out.lvd = pk(d, ['uLvd', 'Ulvd', 'U_lvd', 'lvdU', 'lvd'], out.lvd); out.peukert = pk(d, ['peukert', 'k', 'kPeukert'], out.peukert); out.ri = pk(d, ['ri', 'Ri', 'ri100'], out.ri);
        }
      }
    } catch (e) { /* Notfallwerte */ }
    return out;
  }

  // ---------------------------------------------------------------- Bedienpult
  const G_ANL = 'Anlage', G_REG = 'Laderegler', G_AKKU = 'Akku', G_LAST = 'Last und Schutz', G_LTG = 'Leitungen', G_SON = 'Sonne und Wetter';
  const opts = arr => arr.map(v => (Array.isArray(v) ? { value: v[0], label: v[1] } : { value: v, label: String(v) }));
  const CONTROLS = [
    { key: 'modul', label: 'Solarmodul', type: 'select', value: 'si36', options: [{ value: 'si36', label: '36 Zellen (12-V-Modul)' }, { value: 'si60', label: '60 Zellen' }], group: G_ANL, help: 'Übungsmodul. Das 36-Zellen-Modul passt zur 12-V-Anlage, das 60-Zellen-Modul hat eine viel höhere Spannung.' },
    { key: 'ns', label: 'Module in Reihe', type: 'slider', scale: 'lin', min: 1, max: 2, step: 1, unit: '', value: 1, group: G_ANL, help: 'Module in Reihe: Die Spannungen addieren sich, der Strom bleibt gleich.' },
    { key: 'np', label: 'Stränge parallel', type: 'slider', scale: 'lin', min: 1, max: 3, step: 1, unit: '', value: 1, group: G_ANL, help: 'Stränge parallel: Die Ströme addieren sich, die Spannung bleibt gleich.' },
    { key: 'ctrl', label: 'Reglertyp', type: 'select', value: 'pwm', options: [{ value: 'pwm', label: 'PWM' }, { value: 'mppt', label: 'MPPT' }, { value: 'direkt', label: 'direkt (ohne Regler)' }], group: G_REG, help: 'PWM schaltet das Modul auf die Akkuspannung. MPPT wandelt die Spannung und holt die volle Leistung heraus. Direkt ist der Fehlerfall: Das Modul hängt ohne Regler am Akku.' },
    { key: 'imax', label: 'Maximaler Ladestrom', type: 'select', value: 20, options: opts([[10, '10 A'], [20, '20 A'], [30, '30 A'], [40, '40 A']]), group: G_REG, help: 'Ausgangsstrom des Reglers. Mehr Strom wird abgeregelt: Das Feld arbeitet dann neben dem Punkt maximaler Leistung.' },
    { key: 'uocMax', label: 'Eingangsspannung maximal', type: 'select', value: 100, options: opts([[50, '50 V'], [100, '100 V'], [150, '150 V']]), group: G_REG, visible: s => s.ctrl === 'mppt', help: 'Höchste Leerlaufspannung des Feldes, die der MPPT-Regler verträgt. Bei Kälte steigt die Leerlaufspannung: Wird sie überschritten, ist der Regler zerstört.' },
    { key: 'tempComp', label: 'Temperaturkompensation', type: 'switch', value: true, group: G_REG, visible: s => s.chem === 'blei', help: 'Verschiebt Ladeschluss- und Erhaltungsspannung bei Blei mit der Akkutemperatur. Lithium wird nicht kompensiert.' },
    { key: 'chem', label: 'Akkuart', type: 'select', value: 'blei', options: [{ value: 'blei', label: 'Blei (AGM/Gel)' }, { value: 'lifepo4', label: 'Li-Ion (LiFePO4)' }], group: G_AKKU, help: 'Blei oder Lithium-Eisenphosphat. Beide Akkus brauchen andere Ladespannungen und verhalten sich bei Kälte und Tiefentladung verschieden.' },
    { key: 'usys', label: 'Systemspannung', type: 'select', value: 12, options: opts([[12, '12 V'], [24, '24 V']]), group: G_AKKU, help: 'Nennspannung der Anlage. Alle Ladespannungen und Schwellen skalieren damit.' },
    { key: 'cap', label: 'Kapazität', type: 'slider', scale: 'lin', min: 20, max: 400, step: 10, unit: 'Ah', value: 100, group: G_AKKU, help: 'Nennkapazität des Akkus in Amperestunden. Mal Systemspannung ergibt die gespeicherte Energie in Wh.' },
    { key: 'soc0', label: 'Ladezustand zu Beginn', type: 'slider', scale: 'lin', unit: '%', unitKind: 'pct', min: 5, max: 100, step: 5, value: 50, group: G_AKKU, help: 'Ladezustand (SoC) nach einem Reset. Während des Laufs ändert sich der Ladezustand von selbst.' },
    { key: 'tbat', label: 'Akkutemperatur', type: 'slider', scale: 'lin', min: -10, max: 45, step: 1, unit: '°C', value: 25, group: G_AKKU, help: 'Temperatur des Akkus: Die Temperatur ändert die nutzbare Kapazität und, bei Blei mit Kompensation, die Ladeschlussspannung. Lithium wird unter 0 °C nicht geladen.' },
    { key: 'uAbs', label: 'Ladeschlussspannung', type: 'slider', scale: 'lin', min: 12.5, max: 16.5, step: 0.1, unit: 'V', value: 14.4, dyn: true, group: G_REG, help: 'Spannung, auf der der Regler in der Absorptionsphase hält. Zu niedrig: Der Akku wird nicht voll. Zu hoch: Der Akku gast. Die Grenzen hängen von Akkuart und Systemspannung ab.' },
    { key: 'uFloat', label: 'Erhaltungsspannung', type: 'slider', scale: 'lin', min: 12.5, max: 15, step: 0.1, unit: 'V', value: 13.6, dyn: true, group: G_REG, help: 'Spannung der Erhaltungsladung (Float), wenn der Akku voll ist.' },
    { key: 'lvdU', label: 'Abschaltspannung Tiefentladeschutz', type: 'slider', scale: 'lin', min: 10, max: 12.5, step: 0.1, unit: 'V', value: 11.1, dyn: true, group: G_LAST, help: 'Unter dieser Akkuspannung trennt der Regler die Last. Zu niedrig eingestellt schützt er den Akku nicht mehr.' },
    { key: 'load', label: 'Last', type: 'slider', scale: 'lin', min: 0, max: 300, step: 5, unit: 'W', value: 40, group: G_LAST, help: 'Gleichstromlast am Lastausgang des Reglers.' },
    { key: 'lvd', label: 'Tiefentladeschutz', type: 'switch', value: true, group: G_LAST, help: 'Trennt die Last bei zu tiefer Akkuspannung und schaltet erst bei höherer Spannung wieder zu. Ohne Schutz wird der Akku tiefentladen.' },
    { key: 'lPv', label: 'Länge Modulleitung', type: 'slider', scale: 'lin', min: 0, max: 20, step: 0.5, unit: 'm', value: 2, group: G_LTG, help: 'Einfache Länge der Leitung vom Modul zum Regler. Hin- und Rückleiter zählen in der Rechnung zusammen.' },
    { key: 'aPv', label: 'Querschnitt Modulleitung', type: 'select', value: 4, options: opts([[1.5, '1,5 mm²'], [2.5, '2,5 mm²'], [4, '4 mm²'], [6, '6 mm²'], [10, '10 mm²']]), group: G_LTG, help: 'Querschnitt der Modulleitung. Ein dünnes Kabel verliert Spannung und Leistung und wird warm.' },
    { key: 'lBat', label: 'Länge Akkuleitung', type: 'slider', scale: 'lin', min: 0, max: 10, step: 0.5, unit: 'm', value: 1, group: G_LTG, help: 'Einfache Länge der Leitung zwischen Regler und Akku.' },
    { key: 'aBat', label: 'Querschnitt Akkuleitung', type: 'select', value: 10, options: opts([[4, '4 mm²'], [6, '6 mm²'], [10, '10 mm²'], [16, '16 mm²'], [25, '25 mm²']]), group: G_LTG, help: 'Querschnitt der Akkuleitung. Der Regler misst an seinen Klemmen: Beim Laden liest er wegen des Spannungsfalls eine zu hohe Akkuspannung.' },
    { key: 'quelle', label: 'Einstrahlung', type: 'select', value: 'konstant', options: [{ value: 'konstant', label: 'konstant' }, { value: 'tagesgang', label: 'Tagesgang der Sonne' }], group: G_SON, help: 'Konstant: Du stellst die Einstrahlung von Hand ein. Tagesgang: Die Sonne wandert, die Einstrahlung folgt Ort, Jahreszeit und Wetter.' },
    { key: 'G', label: 'Einstrahlung', type: 'slider', scale: 'lin', min: 0, max: 1200, step: 10, unit: 'W/m²', value: 800, visible: s => s.quelle === 'konstant', group: G_SON, help: 'Bestrahlungsstärke in der Modulebene. 1000 W/m² ist der Normwert bei klarem Himmel.' },
    { key: 'ta', label: 'Umgebungstemperatur', type: 'slider', scale: 'lin', min: -20, max: 40, step: 1, unit: '°C', value: 20, group: G_SON, help: 'Lufttemperatur. Daraus folgt die Zelltemperatur des Moduls (Erwärmung durch die Einstrahlung).' },
    { key: 'ort', label: 'Standort', type: 'select', value: 'mitte', options: [{ value: 'mitte', label: 'Mitte (51,7 °N)' }, { value: 'sued', label: 'Süd (37,4 °N)' }, { value: 'nord', label: 'Nord (60 °N)' }, { value: 'pol', label: 'Polarkreis (70 °N)' }], visible: s => s.quelle === 'tagesgang', group: G_SON, help: 'Breitengrad bestimmt die Höhe der Sonne. Bei 70 °N geht die Sonne im Dezember nicht auf (Polarnacht).' },
    { key: 'datum', label: 'Jahreszeit', type: 'select', value: 'sommer', options: [{ value: 'sommer', label: 'Sommer (21.6.)' }, { value: 'fruehling', label: 'Frühling (21.3.)' }, { value: 'winter', label: 'Winter (21.12.)' }, { value: 'frei', label: 'frei (Tag wählen)' }], visible: s => s.quelle === 'tagesgang', group: G_SON, help: 'Tag des Jahres. Im Winter steht die Sonne tief und der Tag ist kurz.' },
    { key: 'tag', label: 'Tag des Jahres', type: 'slider', scale: 'lin', min: 1, max: 365, step: 1, unit: '', value: 172, visible: s => s.quelle === 'tagesgang' && s.datum === 'frei', group: G_SON, help: 'Tag im Jahr von 1 bis 365.' },
    { key: 'uhr', label: 'Uhrzeit (Sonnenzeit)', type: 'slider', scale: 'lin', unitKind: 'clock', min: 0, max: 24, step: 0.25, unit: 'h', value: 8, visible: s => s.quelle === 'tagesgang', group: G_SON, help: 'Sonnenzeit, nicht die Uhrzeit an der Wand: Mittag ist, wenn die Sonne am höchsten steht. Setzen springt zur gewählten Zeit.' },
    { key: 'wetter', label: 'Wetter', type: 'select', value: 'klar', options: [{ value: 'klar', label: 'klar' }, { value: 'heiter', label: 'heiter' }, { value: 'wolkig', label: 'wolkig' }, { value: 'bedeckt', label: 'bedeckt' }, { value: 'wechselhaft', label: 'wechselhaft (Wolkenzug)' }, { value: 'frei', label: 'frei (Wolken wählen)' }], visible: s => s.quelle === 'tagesgang', group: G_SON, help: 'Bewölkung. Bei bedecktem Himmel liefert das Modul nur einen kleinen Teil des klaren Tages.' },
    { key: 'wolken', label: 'Bewölkung', type: 'slider', scale: 'lin', unitKind: 'pct', min: 0, max: 100, step: 5, unit: '%', value: 0, visible: s => s.quelle === 'tagesgang' && s.wetter === 'frei', group: G_SON, help: 'Bewölkungsgrad von klar (0 %) bis bedeckt (100 %).' },
    { key: 'seed', label: 'Muster des Wolkenzugs', type: 'slider', scale: 'lin', min: 1, max: 99, step: 1, unit: '', value: 1, visible: s => s.quelle === 'tagesgang', group: G_SON, help: 'Startwert des Zufalls: Gleicher Wert, gleicher Wolkenzug.' },
    { key: 'lauf', label: 'Zeitlauf', type: 'select', value: 'normal', options: [{ value: 'aus', label: 'Sonne steht still' }, { value: 'langsam', label: 'langsam (5 Minuten je Sekunde)' }, { value: 'normal', label: 'normal (10 Minuten je Sekunde)' }, { value: 'schnell', label: 'schnell (30 Minuten je Sekunde)' }], visible: s => s.quelle === 'tagesgang', group: G_SON, help: 'Wie schnell die Prozesszeit läuft. „Sonne steht still“ hält die Tageszeit fest, der Akku läuft weiter.' }
  ];
  const CKEY = CONTROLS.map(c => c.key);
  const CDEF = {}; CONTROLS.forEach(c => { CDEF[c.key] = c; });
  const mm = (key, label, unit, digits, min, max, extra) => Object.assign({ key, label, unit, digits, min, max }, extra || {});
  const METERS = [
    mm('uPv', 'Modulspannung', 'V', 1, 0, 60), mm('iPv', 'Modulstrom', 'A', 2, 0, 30), mm('pPv', 'Modulleistung', 'W', 0, 0, 800), mm('pMpp', 'Mögliche Leistung (MPP)', 'W', 0, 0, 800),
    mm('uBat', 'Akkuspannung', 'V', 2, 8, 18), mm('iBat', 'Akkustrom (laden positiv)', 'A', 2, -40, 40), mm('soc', 'Ladezustand', '%', 0, 0, 100, { warnBelow: 20 }),
    mm('pLoad', 'Lastleistung', 'W', 0, 0, 400), mm('stage', 'Ladephase', '', 0, 0, 3, { texts: STAGE_TXT }), mm('etaCtrl', 'Wirkungsgrad Regler', '%', 0, 0, 100),
    mm('ahDay', 'Heute geladen', 'Ah', 1, 0, 400), mm('tBat', 'Akkutemperatur', '°C', 0, -10, 60), mm('gasAh', 'Gasung (Verlust)', 'Ah', 2, 0, 20, { warnAbove: 0.01 }), mm('damage', 'Lebensdauer verbraucht (grob)', '%', 1, 0, 100, { warnAbove: 5 })
  ];

  // Voreinstellungen (Zahlen aus Konstanten bzw. Kern, nicht von Hand)
  function mkPreset(id, name, params, extra) { return Object.assign({ id, name, params }, extra || {}); }
  const PRESETS = (function () {
    const b12 = battDef('blei', 12), li12 = battDef('lifepo4', 12), dA = PAR.absDelta;
    return [
      mkPreset('sonnig-leer', 'Sonniger Tag, leerer Akku', { soc0: 30, quelle: 'konstant', G: 800, modul: 'si36', ctrl: 'pwm', load: 40 }),
      mkPreset('pwm-mppt', 'PWM gegen MPPT (60-Zellen-Modul, PWM)', { modul: 'si60', ctrl: 'pwm', quelle: 'konstant', G: 800, load: 0, soc0: 50 }),
      mkPreset('mppt-pwm', 'MPPT gegen PWM (60-Zellen-Modul, MPPT)', { modul: 'si60', ctrl: 'mppt', quelle: 'konstant', G: 800, load: 0, soc0: 50 }),
      mkPreset('ladeschluss-falsch', 'Ladeschluss falsch (+' + fm(dA, 1) + ' V gegen Standard)', { chem: 'blei', usys: 12, uAbs: b12.abs + dA, soc0: 70, quelle: 'konstant', G: 800, load: 0, tempComp: false }),
      mkPreset('ohne-regler', 'Ohne Regler (Modul direkt am Akku)', { ctrl: 'direkt', modul: 'si36', np: 2, soc0: 95, quelle: 'konstant', G: 1000, load: 0 }),
      mkPreset('tiefentladung', 'Tiefentladung (Schutz aus, Last 150 W, Nacht)', { lvd: false, load: 150, quelle: 'tagesgang', datum: 'winter', uhr: 18, wetter: 'klar', soc0: 40, lauf: 'normal' }),
      mkPreset('duennes-kabel', 'Dünnes Kabel (1,5 mm², 20 m)', { aPv: 1.5, lPv: 20, modul: 'si36', np: 2, quelle: 'konstant', G: 800, load: 0, soc0: 50 }),
      mkPreset('li-mit-blei', 'Li-Ion mit Blei-Einstellung (Ladeschluss ' + fm(b12.abs, 1) + ' V statt ' + fm(li12.abs, 1) + ' V)', { chem: 'lifepo4', uAbs: b12.abs, uFloat: b12.flt, soc0: 60, quelle: 'konstant', G: 800, load: 0 })
    ];
  })();

  // Meldungstexte (SPEC 4.15), Zahlen aus den uebergebenen Messwerten
  const TX = {
    nacht: () => 'Nacht: Das Modul liefert nichts. Der Akku muss alles allein tragen.',
    'pwm-verlust': v => 'Der PWM-Regler zwingt das Modul auf die Akkuspannung (' + fm(v.uPv, 1) + ' V statt Umpp = ' + fm(v.uMpp, 1) + ' V): ' + fm(v.loss, 0) + ' W gehen verloren.',
    'mppt-start': v => 'Die Modulspannung (' + fm(v.uMpp, 1) + ' V) liegt zu nahe an der Akkuspannung: Der MPPT-Wandler arbeitet nicht richtig.',
    'regler-strom': v => 'Der Regler begrenzt den Strom auf ' + fn(v.imax, 0) + ' A. Das Feld könnte ' + fm(v.pot, 0) + ' W liefern, es werden nur ' + fm(v.used, 0) + ' W genutzt.',
    'regler-tot': v => 'Der Regler ist zerstört: Die Leerlaufspannung (' + fm(v.uoc, 1) + ' V) war höher als sein Eingang (' + fm(v.limit, 0) + ' V).',
    ladeschluss: v => 'Ladephase: ' + STAGE_TXT[v.stage] + ' (Spannung ' + fm(v.uBat, 2) + ' V, Strom ' + fm(v.iBat, 1) + ' A).',
    ueberladung: v => 'Der Akku gast (Spannung ' + fm(v.uBat, 2) + ' V): Wasser geht verloren, bei Blei entsteht Knallgas. Hier fehlt die Laderegelung.',
    'bms-aus': () => 'Das Batteriemanagement hat abgeschaltet: Spannung oder Temperatur außerhalb des erlaubten Bereichs.',
    tiefentladung: v => 'Tiefentladung: Der Akku nimmt dauerhaft Schaden (Ladezustand ' + fm(v.soc * 100, 0) + ' %).',
    'lvd-aus': v => 'Tiefentladeschutz: Last getrennt bei ' + fm(v.uBat, 2) + ' V.',
    'lvd-wieder': v => 'Last wieder zugeschaltet bei ' + fm(v.uBat, 2) + ' V.',
    'kabel-spannungsfall': v => 'Auf der Leitung gehen ' + fm(v.dU, 2) + ' V (' + fm(v.pct, 1) + ' %) verloren: ' + fm(v.pLoss, 1) + ' W Verlustleistung. Nimm mehr Querschnitt.',
    'kabel-ueberlast': v => 'Die Leitung führt ' + fm(v.i, 1) + ' A, erlaubt sind ' + fm(v.iz, 0) + ' A. Sie erwärmt sich zu stark.',
    zeitraffer: () => 'Zeitraffer gedrosselt: Der Prüfstand rechnet nicht schneller.'
  };
  const SHORT = { nacht: 'Nacht', 'pwm-verlust': 'PWM verliert Leistung', 'mppt-start': 'Spannung zu nah am Akku', 'regler-strom': 'Strom begrenzt', 'regler-tot': 'Regler zerstört', ueberladung: 'Akku gast', 'bms-aus': 'BMS aus', tiefentladung: 'Tiefentladung', 'lvd-aus': 'Last getrennt', 'kabel-spannungsfall': 'Spannungsfall auf Leitung', 'kabel-ueberlast': 'Leitung überlastet' };
  const KIND = { nacht: 'info', 'pwm-verlust': 'warn', 'mppt-start': 'warn', 'regler-strom': 'info', 'regler-tot': 'error', ladeschluss: 'info', ueberladung: 'error', 'bms-aus': 'warn', tiefentladung: 'error', 'lvd-aus': 'warn', 'lvd-wieder': 'info', 'kabel-spannungsfall': 'warn', 'kabel-ueberlast': 'error', zeitraffer: 'warn' };
  const FX = { 'regler-tot': 'crash', ueberladung: 'bubbles', 'lvd-aus': 'buzz', tiefentladung: 'alarm' };

  // ---------------------------------------------------------------- Szene (Zeichnen)
  function skyStops() {
    return [{ a: -12, top: [10, 16, 48], hor: [16, 26, 64] }, { a: -6, top: [40, 36, 96], hor: [110, 62, 100] }, { a: 0, top: [74, 74, 154], hor: [217, 118, 74] },
      { a: 6, top: [111, 143, 216], hor: [255, 154, 85] }, { a: 20, top: [90, 160, 240], hor: [255, 216, 144] }, { a: 35, top: [74, 163, 255], hor: [191, 227, 255] }];
  }
  function skyColors(alt) {
    const S = skyStops(); alt = num(alt, 45);
    if (alt <= S[0].a) return { top: S[0].top, hor: S[0].hor };
    if (alt >= S[S.length - 1].a) return { top: S[S.length - 1].top, hor: S[S.length - 1].hor };
    let i = 0; while (i < S.length - 2 && alt > S[i + 1].a) i++;
    const u = (alt - S[i].a) / (S[i + 1].a - S[i].a), mix = (p, q) => p.map((v, k) => v + (q[k] - v) * u);
    return { top: mix(S[i].top, S[i + 1].top), hor: mix(S[i].hor, S[i + 1].hor) };
  }
  const rgb = c => 'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')';
  const COL = { gold: '#f5b800', laden: '#38c172', entl: '#22c4d8', last: '#a56cf0', verl: '#9aa5b1', panel: '#1b2229', panel2: '#232d36', line: '#46525e', fg: '#e8ecf0', mute: '#9aa5b1', ok: '#38c172', warn: '#ffb340', bad: '#ff5d5d' };
  function rr(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath(); }
  function mulberry(seed) { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // ---------------------------------------------------------------- Pruefstand
  function create(o) {
    o = o || {};
    const params = Object.assign({}, PAR, o.params || {});
    const noDraw = !!o.noDraw;
    const cvals = {}, initCtl = {};
    CONTROLS.forEach(c => { cvals[c.key] = c.value; });
    cvals.uAbs = null; cvals.uFloat = null; cvals.lvdU = null;       // null = Standard der Akkuart
    if (o.controls) Object.keys(o.controls).forEach(k => { if (k in cvals) cvals[k] = o.controls[k]; });
    CKEY.forEach(k => { initCtl[k] = cvals[k]; });

    let sim = null, simErr = '', dirty = true, steps = 0, acc = 0, throttled = false, detail = !!o.detail;
    let N0 = DATUM.sommer, tS0 = 8, stepsClk = 0, dayKey = 0, lastTbat = 25;
    let carry = { soc: null }, gasOff = 0, dmgOff = 0;
    let last = null, evs = [], buf = [], marks = [], dayArr = [], day = null, tally = null, prevStage = -1, prevLvd = false, prevDead = false, tOver = 0, evT = {}, prevAct = {};
    const events = [];
    const hist = [];                       // letzte Zustaende fuer die Szene (Wattangabe)
    const memoEta = { key: '', val: null };

    // ---- Steuerwerte
    const info = key => {
      const c = CDEF[key]; if (!c) return null;
      if (key === 'uAbs' || key === 'uFloat' || key === 'lvdU') {
        const k = cvals.usys / 12, d = battDef(cvals.chem, cvals.usys), val = cvals[key] === null ? (key === 'uAbs' ? d.abs : key === 'uFloat' ? d.flt : d.lvd) : cvals[key];
        const lim = key === 'uAbs' ? [12.5, 16.5] : key === 'uFloat' ? [12.5, 15] : [10, 12.5];
        return { min: +(lim[0] * k).toFixed(2), max: +(lim[1] * k).toFixed(2), step: +(0.1 * k).toFixed(2), value: val, unit: 'V', default: key === 'uAbs' ? d.abs : key === 'uFloat' ? d.flt : d.lvd };
      }
      return { min: c.min, max: c.max, step: c.step, value: cvals[key] };
    };
    function ctlNow(key) {
      if (key === 'uhr') return clockNow().tS;
      if (key === 'tag') return clockNow().N;
      if (key === 'datum') { const N = clockNow().N, f = Object.keys(DATUM).find(k => DATUM[k] === N); return cvals.datum === 'frei' ? 'frei' : (f || 'frei'); }
      if (key === 'uAbs' || key === 'uFloat' || key === 'lvdU') return info(key).value;
      return cvals[key];
    }
    const getControl = key => (key in cvals ? ctlNow(key) : undefined);
    function warn(text) { pushEv('warnung-' + text.slice(0, 12), text, 'warn', {}, true); }
    function setControl(key, v) {
      const c = CDEF[key];
      if (!c) { warn('Schlüssel „' + String(key) + '“ gibt es an dieser Anlage nicht.'); return false; }
      let nv;
      if (c.type === 'switch') { if (v === true || v === 1 || v === 'true') nv = true; else if (v === false || v === 0 || v === 'false') nv = false; else { warn('Der Schalter „' + c.label + '“ nimmt nur an oder aus.'); return false; } }
      else if (c.type === 'select') { const op = c.options.find(p => String(p.value) === String(v)); if (!op || v === null || v === undefined || (typeof v === 'object')) { warn('Für „' + c.label + '“ ist dieser Wert nicht erlaubt.'); return false; } nv = op.value; }
      else {
        const x = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v.replace(',', '.')) : NaN);
        if (!fin(x)) { warn('„' + c.label + '“ braucht eine Zahl.'); return false; }
        const ii = info(key); nv = clamp(x, ii.min, ii.max);
      }
      if (key === 'uhr') { setClock(clockNow().N, nv); return true; }
      if (key === 'tag') { cvals.datum = 'frei'; setClock(Math.round(nv), clockNow().tS); return true; }
      if (key === 'datum') { cvals.datum = nv; if (nv !== 'frei') setClock(DATUM[nv], clockNow().tS); return true; }
      if (key === 'wetter' && nv === 'frei' && cvals.wetter !== 'frei') cvals.wolken = Math.round(100 * (WX[cvals.wetter] || { c: 0 }).c);
      if ((key === 'chem' || key === 'usys') && cvals[key] !== nv) { cvals.uAbs = null; cvals.uFloat = null; cvals.lvdU = null; }
      if (key === 'load' && nv > 0) loadMem = nv;
      if (STRUCT.indexOf(key) >= 0) hardChange = true;
      cvals[key] = nv; dirty = true;
      if (key === 'soc0' && steps === 0) resetState();   // vor dem ersten Schritt gilt der Wert sofort, danach bei restart()/reset()
      return true;
    }
    let loadMem = cvals.load > 0 ? cvals.load : 40;

    // ---- Uhr (Sonnenzeit)
    function clockNow() { const hrs = tS0 + stepsClk * H / 3600, d = Math.floor(hrs / 24 + 1e-12); return { N: ((N0 - 1 + d) % 365 + 365) % 365 + 1, tS: hrs - d * 24 }; }
    function setClock(N, tS) {
      N = clamp(Math.round(num(N, 172)), 1, 365); tS = clamp(num(tS, 8), 0, 24); if (tS >= 24) tS = 0;
      const cur = sim && last ? last : null; carry.soc = cur ? cur.soc : carry.soc;
      N0 = N; tS0 = tS; stepsClk = 0; dayKey = 0; newDay();
      let done = false; if (sim && typeof sim.setClock === 'function' && !dirty) { try { const r2 = sim.setClock(N, tS); done = !(r2 && r2.ok === false); } catch (e) { done = false; } }
      if (!done) dirty = true;
    }
    function newDay() { day = { t: [], g: [], gClear: [], pv: [], load: [], bat: [], soc: [] }; tally = { eSolar: 0, eLast: 0, eLadung: 0, eEntl: 0, ahDay: 0, ePot: 0 }; }
    newDay();

    // ---- Anschluss an den Kern
    function fieldKeys(G, Tc) {
      const C = core(); if (!C || !C.pv) return null;
      try {
        let sp = C.pv.spec ? C.pv.spec(cvals.modul) : null; if (!sp || sp.ok === false) sp = C.pv.presets && C.pv.presets[cvals.modul];
        if (!sp) return null; const k = C.pv.keys(sp, { G, Tc });
        if (!k || k.ok === false) return null;
        const ns = cvals.ns, np = cvals.np;
        return { Uoc: ns * k.Uoc, Isc: np * k.Isc, Umpp: ns * k.Umpp, Impp: np * k.Impp, Pmpp: ns * np * k.Pmpp };
      } catch (e) { return null; }
    }
    function latOf() { const C = core(); const s = C && C.sun && C.sun.sites && C.sun.sites[cvals.ort]; return pk(s, ['lat', 'phi', 'breite'], LAT[cvals.ort] || 51.7); }
    function buildCfg(soc0) {
      const wx = cvals.wetter === 'frei' ? { c: clamp(cvals.wolken / 100, 0, 1), preset: 'frei', seed: cvals.seed, zug: false } : { c: WX[cvals.wetter].c, preset: cvals.wetter, seed: cvals.seed, zug: !!WX[cvals.wetter].zug };
      const cl = clockNow(), d = battDef(cvals.chem, cvals.usys), un = cvals.quelle === 'konstant';
      return {
        typ: 'insel', ort: cvals.ort, N: cl.N, tS: cl.tS, tage: 1, neigung: params.neigung, azimut: params.azimut, wetter: wx,
        feld: { spec: cvals.modul, ns: cvals.ns, np: cvals.np },
        regler: { typ: cvals.ctrl, Imax: cvals.imax, Uocmax: cvals.uocMax, tempComp: !!cvals.tempComp, lvd: !!cvals.lvd, Uabs: ctlNow('uAbs'), Ufloat: ctlNow('uFloat'), lvdU: ctlNow('lvdU'), lLeitung: cvals.lPv, qLeitung: cvals.aPv },
        leitung: { pv: { l: cvals.lPv, q: cvals.aPv }, bat: { l: cvals.lBat, q: cvals.aBat }, kappa: KAPPA },
        akku: { chem: cvals.chem, Usys: cvals.usys, C: cvals.cap, soc0: soc0 === undefined ? cvals.soc0 / 100 : soc0, T: cvals.tbat },
        wr: { modell: 'kein' }, last: { profil: 'frei', faktor: 1, pFrei: cvals.load }, netz: { ok: true },
        quelle: un ? 'konstant' : 'tagesgang', G: cvals.G, ta: cvals.ta, uhrFest: !un && cvals.lauf === 'aus', h: H, defaults: d
      };
    }
    function makeSim(soc0) {
      const C = core(); simErr = '';
      if (!C || !C.sys || typeof C.sys.create !== 'function') { simErr = 'Der Rechenkern (ENR_CORE.sys) fehlt.'; return null; }
      try { const s = C.sys.create(buildCfg(soc0)); if (!s || s.ok === false || typeof s.step !== 'function') { simErr = (s && s.why) || 'Die Anlage konnte nicht aufgebaut werden.'; return null; } return s; } catch (e) { simErr = String(e && e.message || e); return null; }
    }
    function ensureSim() {
      if (!dirty && (sim || simErr)) return;
      if (sim && typeof sim.update === 'function' && !hardChange) { try { const pc = buildCfg(); delete pc.akku.soc0; delete pc.N; delete pc.tS; const rr2 = sim.update(pc); if (!(rr2 && rr2.ok === false)) { dirty = false; return; } } catch (e) { /* neu aufbauen */ } }
      if (sim && last) { carry.soc = last.soc; gasOff += last.gasRaw; dmgOff += last.dmgRaw; }
      const keepSoc = carry.soc;
      sim = makeSim(keepSoc === null ? undefined : keepSoc); dirty = false; hardChange = false; carry.soc = null;
      if (sim) last = readSim(); else last = readSim();
    }
    let hardChange = false;

    function readSim() {
      let s = null; if (sim) { try { s = sim.state(); } catch (e) { s = null; simErr = String(e && e.message || e); } }
      s = s || {};
      const cl = clockNow(), socRaw = pk(s, ['soc', 'SoC', 'ladezustand'], cvals.soc0 / 100), stg = pkAny(s, ['stage', 'phase', 'stufe']);
      let stage = 0;
      if (typeof stg === 'number') stage = clamp(Math.round(stg), 0, 3); else if (typeof stg === 'string') stage = { bulk: 1, abs: 2, absorption: 2, float: 3, nacht: 0, aus: 0 }[stg.toLowerCase()] || 0;
      const o2 = {
        sim: !!sim, tS: cl.tS, N: cl.N,
        elev: pk(s, ['elev', 'alt', 'sonnenhoehe'], 45), azim: pk(s, ['azim', 'az', 'gamma'], 0), gPoa: Math.max(0, pk(s, ['gPoa', 'G', 'g', 'poa'], cvals.quelle === 'konstant' ? cvals.G : 0)),
        tcell: pk(s, ['tcell', 'Tc', 'tc'], cvals.ta), uPv: pk(s, ['uPv', 'upv', 'Upv'], 0), iPv: pk(s, ['iPv', 'ipv'], 0), pPv: pk(s, ['pPv', 'ppv'], 0),
        pMpp: pk(s, ['pMpp', 'pmpp', 'pPotenzial', 'pPot'], NaN), uMpp: pk(s, ['uMpp', 'umpp'], NaN), uBat: pk(s, ['uBat', 'Ub', 'ub', 'uTerm'], 0), iBat: pk(s, ['iBat', 'ib', 'Ibat'], 0),
        soc: clamp(socRaw > 1.5 ? socRaw / 100 : socRaw, 0, 1), pLoad: Math.max(0, pk(s, ['pLoad', 'pLast', 'pl'], 0)), stage, tBat: pk(s, ['tBat', 'T'], cvals.tbat),
        gasRaw: Math.max(0, pk(s, ['gasAh'], 0)), dmgRaw: Math.max(0, pk(s, ['damage', 'schaden'], 0)), etaRaw: pk(s, ['etaCtrl', 'etaReg', 'eta'], NaN),
        curtail: Math.max(0, pk(s, ['curtail', 'curtailW', 'pCurtail'], 0)), dead: !!pkAny(s, ['dead', 'tot', 'ctrlDead']), lvdOff: !!pkAny(s, ['lvdAktiv', 'lvdAus', 'lastGetrennt', 'lvdOff']), bms: !!pkAny(s, ['bmsAus', 'bms']),
        uoc: pk(s, ['uoc', 'Uoc'], NaN), duty: pk(s, ['duty', 'tastgrad'], NaN)
      };
      if (!fin(o2.pMpp) || !fin(o2.uMpp)) {      // Potenzial aus dem Kern (pv.keys), falls die Anlage es nicht meldet
        const k = fieldKeys(o2.gPoa, o2.tcell);
        if (!fin(o2.pMpp)) o2.pMpp = k ? k.Pmpp : 0;
        if (!fin(o2.uMpp)) o2.uMpp = k && o2.gPoa >= 1 ? k.Umpp : 0;
        if (!fin(o2.uoc)) o2.uoc = k ? k.Uoc : 0;
      }
      if (!fin(o2.uoc)) { const k = fieldKeys(o2.gPoa, o2.tcell); o2.uoc = k ? k.Uoc : 0; }
      if (!fin(o2.pPv) || (o2.pPv === 0 && o2.uPv * o2.iPv > 0)) o2.pPv = o2.uPv * o2.iPv;
      o2.pBat = o2.uBat * o2.iBat;
      o2.etaCtrl = fin(o2.etaRaw) ? clamp(o2.etaRaw > 1.5 ? o2.etaRaw / 100 : o2.etaRaw, 0, 1) * 100 : (o2.pPv > 1 ? clamp((o2.pBat + o2.pLoad) / o2.pPv, 0, 1) * 100 : 0);
      o2.gasAh = gasOff + o2.gasRaw; o2.damage = clamp(dmgOff + o2.dmgRaw, 0, 1) * 100;
      return o2;
    }

    // ---- Meldungen
    function pushEv(id, text, kind, extra, force) {
      const t = steps * H, prev = evT[id];
      if (!force && prev !== undefined && t - prev < 600) return;
      evT[id] = t; const e = Object.assign({ t, text, kind: kind || 'info', id }, extra || {});
      events.push(e); if (events.length > 300) events.splice(0, events.length - 300);
    }
    function cableInfo(st) {
      const rPv = rLeit(cvals.lPv, cvals.aPv), rBat = rLeit(cvals.lBat, cvals.aBat), ub = Math.max(st.uBat, 1);
      const dUpv = st.iPv * rPv, dUbat = Math.abs(st.iBat) * rBat;
      return { rPv, rBat, dUpv, dUbat, pPvLoss: st.iPv * st.iPv * rPv, pBatLoss: st.iBat * st.iBat * rBat, pctPv: dUpv / ub, pctBat: dUbat / ub, iz: IZ[cvals.aPv] || 0, izBat: IZ[cvals.aBat] || 0 };
    }
    function diagnoseOf(st) {
      const out = [], add = (id, v, fx) => { const e = { id, kind: KIND[id] || 'info', text: TX[id](v) }; if (fx || FX[id]) e.fx = fx || FX[id]; out.push(e); };
      if (!st) return out;
      const ub = st.uBat, cab = cableInfo(st);
      if (st.gPoa < 1) add('nacht', {});
      if (cvals.ctrl === 'pwm' && st.stage === 1 && st.pMpp >= 5 && st.pPv < params.schwellePwm * st.pMpp && st.uMpp > st.uPv + 0.1 && st.gPoa >= 1) add('pwm-verlust', { uPv: st.uPv, uMpp: st.uMpp, loss: st.pMpp - st.pPv });
      if (cvals.ctrl === 'mppt' && st.gPoa >= 1 && st.uMpp > 0 && st.uMpp < ub + 5 && !st.dead) add('mppt-start', { uMpp: st.uMpp });
      if (st.curtail > 0.5 && !st.dead) add('regler-strom', { imax: cvals.imax, pot: st.pMpp, used: Math.max(0, st.pMpp - st.curtail) });
      if (st.dead) add('regler-tot', { uoc: st.uoc, limit: cvals.uocMax });
      if (cvals.chem === 'blei' && ub > params.ugasBlei * cvals.usys / 12 && tOver >= 600) add('ueberladung', { uBat: ub });
      if (cvals.chem === 'lifepo4' && st.bms) add('bms-aus', {});
      if ((st.soc < 0.10 && st.sim) || (!cvals.lvd && st.sim && ub > 0 && ub < ctlNow('lvdU') && st.pLoad > 0)) add('tiefentladung', { soc: st.soc });
      if (st.lvdOff) add('lvd-aus', { uBat: ub });
      if (st.iPv > 0.1 && cab.pctPv > params.kabelGrenze) add('kabel-spannungsfall', { dU: cab.dUpv, pct: cab.pctPv * 100, pLoss: cab.pPvLoss });
      else if (Math.abs(st.iBat) > 0.1 && cab.pctBat > params.kabelGrenze) add('kabel-spannungsfall', { dU: cab.dUbat, pct: cab.pctBat * 100, pLoss: cab.pBatLoss });
      if (cab.iz > 0 && st.iPv > cab.iz) add('kabel-ueberlast', { i: st.iPv, iz: cab.iz });
      else if (cab.izBat > 0 && Math.abs(st.iBat) > cab.izBat) add('kabel-ueberlast', { i: Math.abs(st.iBat), iz: cab.izBat });
      return out;
    }
    function transitions(st) {
      const dead = st.dead;
      if (st.sim && st.stage !== prevStage && st.gPoa >= 1 && prevStage !== -1) { pushEv('ladeschluss', TX.ladeschluss({ stage: st.stage, uBat: st.uBat, iBat: st.iBat }), 'info', {}, true); }
      if (prevStage !== st.stage) { marks.push({ t: steps * H, stage: st.stage, text: STAGE_TXT[st.stage] }); if (marks.length > 200) marks.shift(); }
      if (st.lvdOff && !prevLvd) pushEv('lvd-aus', TX['lvd-aus']({ uBat: st.uBat }), 'warn', { fx: 'buzz' }, true);
      if (!st.lvdOff && prevLvd) pushEv('lvd-wieder', TX['lvd-wieder']({ uBat: st.uBat }), 'info', {}, true);
      if (dead && !prevDead) pushEv('regler-tot', TX['regler-tot']({ uoc: st.uoc, limit: cvals.uocMax }), 'error', { fx: 'crash' }, true);
      prevStage = st.stage; prevLvd = st.lvdOff; prevDead = dead;
      const ds = diagnoseOf(st);
      const act = {}; ds.forEach(d => { act[d.id] = true; if (d.id === 'lvd-aus' || d.id === 'regler-tot' || prevAct[d.id]) return; pushEv(d.id, d.text, d.kind, d.fx ? { fx: d.fx } : {}); });
      prevAct = act;
      return ds;
    }

    // ---- Zeitschritt
    function oneStep() {
      if (sim) { try { sim.step(H); } catch (e) { simErr = String(e && e.message || e); sim = null; } }
      steps++; if (!(cvals.quelle === 'tagesgang' && cvals.lauf === 'aus')) stepsClk++;
      const st = readSim(); last = st; lastTbat = st.tBat;
      const hrs = tS0 + stepsClk * H / 3600, dk = Math.floor(hrs / 24 + 1e-12);
      if (dk !== dayKey) { dayKey = dk; newDay(); evT = {}; }
      const dtH = H / 3600;
      tally.eSolar += st.pPv * dtH; tally.ePot += st.pMpp * dtH; tally.eLast += st.pLoad * dtH;
      if (st.iBat > 0) { tally.eLadung += st.pBat * dtH; tally.ahDay += st.iBat * dtH; } else tally.eEntl += -st.pBat * dtH;
      tOver = (cvals.chem === 'blei' && st.uBat > params.ugasBlei * cvals.usys / 12) ? tOver + H : 0;
      const ds = transitions(st); st.faults = ds.map(d => d.id); hist.push(st); if (hist.length > 4) hist.shift();
      if (steps % Math.max(1, Math.round(SAMPLE_S / H)) === 0) sample(st);
    }
    function gClearNow(cl) {
      const C = core(); if (cvals.quelle === 'konstant') return 1000;
      try { if (C && C.sun && typeof C.sun.poa === 'function') { const r = C.sun.poa({ N: cl.N, tS: cl.tS, lat: latOf(), beta: params.neigung, gam: params.azimut, c: 0 }); const g = r && r.g; return fin(g) ? Math.max(0, g) : 0; } } catch (e) { /* ohne Potenzial */ }
      return 0;
    }
    function sample(st) {
      const cl = clockNow(), gc = gClearNow(cl), t = steps * H;
      buf.push({ t, tS: cl.tS, uPv: st.uPv, iPv: st.iPv, pPv: st.pPv, pMpp: st.pMpp, uBat: st.uBat, iBat: st.iBat, soc: st.soc * 100, pLoad: st.pLoad, stage: st.stage, g: st.gPoa });
      if (buf.length > 5000) buf.splice(0, buf.length - 5000);
      if (day.t.length < 1500) { day.t.push(cl.tS); day.g.push(st.gPoa); day.gClear.push(gc); day.pv.push(st.pPv); day.load.push(st.pLoad); day.bat.push(st.pBat); day.soc.push(st.soc * 100); }
    }
    function stepProcess(dtS) {
      dtS = num(dtS, 0); if (!(dtS > 0)) return;
      ensureSim();
      acc += dtS; let n = Math.floor(acc / H + 1e-9); acc -= n * H; if (acc < 1e-9) acc = 0;
      for (let i = 0; i < n; i++) oneStep();
    }
    function step(dtMs) {
      dtMs = clamp(num(dtMs, 0), 0, 1e6); let dtS = dtMs / 1000 * timeScaleNow();
      const cap = 2000 * H;
      if (dtS > cap) { dtS = cap; throttled = true; pushEv('zeitraffer', TX.zeitraffer(), 'warn'); } else throttled = false;
      stepProcess(dtS);
    }
    const timeScaleNow = () => LAUF[cvals.lauf] || 600;

    // ---- Abfragen
    function meters() {
      ensureSim(); const s = last || readSim(), e = tally, ah = e.ahDay;
      return { uPv: s.uPv, iPv: s.iPv, pPv: s.pPv, pMpp: s.pMpp, uBat: s.uBat, iBat: s.iBat, soc: s.soc * 100, pLoad: s.pLoad, stage: s.stage, etaCtrl: s.etaCtrl, ahDay: ah, tBat: s.tBat, gasAh: s.gasAh, damage: s.damage };
    }
    function readMeters() { const m = meters(), r = {}; Object.keys(m).forEach(k => { r[k] = num(m[k], 0); }); return r; }
    function state() {
      ensureSim(); const s = last || readSim(), cl = clockNow(), m = readMeters(), o2 = {};
      CKEY.forEach(k => { o2[k] = ctlNow(k); });
      Object.assign(o2, m, { t: steps * H, N: cl.N, tS: cl.tS, tag: cl.N, stageText: STAGE_TXT[s.stage], faults: (s.faults || []).slice(), elev: num(s.elev), azim: num(s.azim), gPoa: num(s.gPoa), tcell: num(s.tcell), uMpp: num(s.uMpp), uoc: num(s.uoc), curtail: num(s.curtail), dead: !!s.dead, lvdAktiv: !!s.lvdOff, throttled, kern: !!sim, kernFehler: simErr, pBat: num(s.pBat), ctlOk: !!sim });
      o2.tag = cl.N; o2.uhr = cl.tS; return o2;
    }
    function diagnose() { ensureSim(); return diagnoseOf(last); }
    function resetState() {
      steps = 0; acc = 0; gasOff = 0; dmgOff = 0; carry.soc = null; buf = []; marks = []; events.length = 0; evT = {}; hist.length = 0; tOver = 0; prevAct = {}; throttled = false; prevStage = -1; prevLvd = false; prevDead = false;
      N0 = cvals.datum === 'frei' ? clamp(Math.round(num(cvals.tag, 172)), 1, 365) : (DATUM[cvals.datum] || 172); tS0 = clamp(num(cvals.uhr, 8), 0, 23.999); stepsClk = 0; dayKey = 0; newDay();
      sim = null; dirty = true; hardChange = true; simErr = ''; memoEta.key = '';
      ensureSim(); last = readSim(); last.faults = []; if (last.sim) { prevStage = last.stage; marks.push({ t: 0, stage: last.stage, text: STAGE_TXT[last.stage] }); }
    }
    function restart() { loadMem = cvals.load > 0 ? cvals.load : 40; resetState(); }
    function reset() { CKEY.forEach(k => { cvals[k] = initCtl[k]; }); loadMem = cvals.load > 0 ? cvals.load : 40; resetState(); }
    function applyPreset(id) {
      const p = PRESETS.find(q => q.id === id); if (!p) return false;
      CKEY.forEach(k => { cvals[k] = initCtl[k]; });
      Object.keys(p.params).forEach(k => { if (k in cvals) cvals[k] = p.params[k]; });
      if (p.params.wetter === 'frei' && p.params.wolken === undefined) cvals.wolken = 0;
      loadMem = cvals.load > 0 ? cvals.load : 40; resetState(); return true;
    }
    function trace(spanS) {
      spanS = clamp(num(spanS, 3600), 60, 7 * 86400); const t1 = steps * H, t0 = t1 - spanS, a = buf.filter(b => b.t >= t0);
      const k = Math.max(1, Math.ceil(a.length / 599)), pts = a.filter((b, i) => i % k === 0 || i === a.length - 1), series = {};
      ['uPv', 'iPv', 'pPv', 'pMpp', 'uBat', 'iBat', 'soc', 'pLoad', 'stage', 'g'].forEach(key => { series[key] = pts.map(b => b[key]); });
      return { t: pts.map(b => b.t), series, marks: marks.filter(m => m.t >= t0).map(m => ({ t: m.t, stage: m.stage, text: m.text })) };
    }
    function dayTrace() {
      const cl = clockNow(), d = day, zero = { t: [], g: [], gClear: [], pv: [], load: [], bat: [], soc: [], netz: [], now: cl.tS };
      if (!d) return zero; const k = Math.max(1, Math.ceil(d.t.length / 1440));
      const pick2 = arr => arr.filter((v, i) => i % k === 0);
      return { t: pick2(d.t), g: pick2(d.g), gClear: pick2(d.gClear), pv: pick2(d.pv), load: pick2(d.load), bat: pick2(d.bat), soc: pick2(d.soc), netz: pick2(d.t).map(() => 0), now: cl.tS };
    }
    function balance() {
      ensureSim(); let b = null; if (sim && typeof sim.balance === 'function') { try { b = sim.balance(); } catch (e) { b = null; } }
      const own = { eSolar: tally.eSolar, ePotenzial: tally.ePot, eLast: tally.eLast, eLadung: tally.eLadung, eEntladung: tally.eEntl, ahGeladen: tally.ahDay };
      return b && typeof b === 'object' ? Object.assign({}, own, { kern: b }) : own;
    }
    function analysis() {
      ensureSim(); const s = last || readSim(), cab = cableInfo(s), kk = fieldKeys(s.gPoa, s.tcell);
      const ok = s.pMpp > 1;
      return { ok: !!s.sim, why: s.sim ? '' : (simErr || 'Der Rechenkern fehlt.'), ctrl: cvals.ctrl, stage: s.stage, stageText: STAGE_TXT[s.stage], pPv: s.pPv, pMpp: s.pMpp, uPv: s.uPv, uMpp: s.uMpp, anteil: ok ? s.pPv / s.pMpp : null, verlustW: ok ? Math.max(0, s.pMpp - s.pPv) : 0, uoc: s.uoc, feld: kk, kabel: { pv: { dU: cab.dUpv, pct: cab.pctPv * 100, pVerlust: cab.pPvLoss, r: cab.rPv }, akku: { dU: cab.dUbat, pct: cab.pctBat * 100, pVerlust: cab.pBatLoss, r: cab.rBat } }, soc: s.soc, uBat: s.uBat, gasAh: s.gasAh, damage: s.damage, faults: (s.faults || []).slice() };
    }

    // ---- Kennlinien
    function curveEta() {
      const key = [cvals.modul, cvals.ns, cvals.np, cvals.usys, cvals.chem, Math.round(cvals.soc0 / 10), cvals.ta, cvals.lPv, cvals.aPv].join('|');
      if (memoEta.key === key && memoEta.val) return memoEta.val;
      const C = core(), res = { pwm: [], mppt: [] }, Gs = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200];
      if (C && C.sys && typeof C.sys.create === 'function') {
        ['pwm', 'mppt'].forEach(tp => {
          Gs.forEach(g => {
            try {
              const cfg = buildCfg(0.5); cfg.quelle = 'konstant'; cfg.G = g; cfg.regler.typ = tp; cfg.regler.Imax = 40; cfg.regler.Uocmax = 150; cfg.last.pFrei = 0; cfg.regler.lvd = true; cfg.uhrFest = true;
              const s = C.sys.create(cfg); if (!s || typeof s.step !== 'function') return;
              for (let i = 0; i < 40; i++) s.step(H);
              const st = s.state(), pp = pk(st, ['pPv', 'ppv'], 0), pm = pk(st, ['pMpp', 'pmpp'], NaN), pot = fin(pm) ? pm : (fieldKeys(g, cvals.ta + 25) || { Pmpp: 0 }).Pmpp;
              if (pot > 0) res[tp].push([g, +(100 * pp / pot).toFixed(2)]);
            } catch (e) { /* Punkt fehlt */ }
          });
        });
      }
      memoEta.key = key; memoEta.val = res; return res;
    }
    function curves() {
      ensureSim(); const s = last || readSim(), out = [], d = { blei: battDef('blei', cvals.usys), lifepo4: battDef('lifepo4', cvals.usys) }, C = core();
      // 1 Ladekennlinie
      const tr = trace(6 * 3600), t0 = tr.t.length ? tr.t[0] : 0, hrs = tr.t.map(v => +((v - t0) / 3600).toFixed(3));
      out.push({ id: 'lade', title: 'Ladekennlinie: Spannung, Strom und Ladezustand', xLabel: 'Prozesszeit', xUnit: 'h', yLabel: 'Akkuspannung / Akkustrom', yUnit: 'V / A', yLabel2: 'Ladezustand', yUnit2: '%',
        series: [{ name: 'Akkuspannung (V)', unit: 'V', axis: 'left', points: hrs.map((x, i) => [x, tr.series.uBat[i]]), style: 'solid', current: true }, { name: 'Akkustrom (A, laden positiv)', unit: 'A', axis: 'left', points: hrs.map((x, i) => [x, tr.series.iBat[i]]), style: 'dashed' }, { name: 'Ladezustand (%)', unit: '%', axis: 'right', points: hrs.map((x, i) => [x, tr.series.soc[i]]), style: 'dotted' }],
        bands: tr.marks.map((m, i) => ({ from: +((m.t - t0) / 3600).toFixed(3), to: i + 1 < tr.marks.length ? +((tr.marks[i + 1].t - t0) / 3600).toFixed(3) : +(((steps * H) - t0) / 3600).toFixed(3), stage: m.stage, label: m.text })), marker: { x: hrs.length ? hrs[hrs.length - 1] : 0, y: s.uBat } });
      // 2 Ruhespannung ueber Ladezustand
      const ocvOf = (chem, soc) => { try { if (C && C.batt && typeof C.batt.create === 'function') { const b = C.batt.create({ chem, Usys: cvals.usys, C: cvals.cap, T: cvals.tbat }); if (b && typeof b.ocv === 'function') { const v = b.ocv(soc); if (fin(v)) return v; } } } catch (e) { /* weiter */ } return NaN; };
      const so = []; for (let i = 0; i <= 20; i++) so.push(i / 20);
      const oc = chem => so.map(x => [+(x * 100).toFixed(0), ocvOf(chem, x)]).filter(p => fin(p[1]));
      out.push({ id: 'ocv', title: 'Ruhespannung über Ladezustand', xLabel: 'Ladezustand', xUnit: '%', yLabel: 'Ruhespannung', yUnit: 'V', series: [{ name: 'Blei' + (cvals.chem === 'blei' ? ' (aktuell)' : ''), points: oc('blei'), current: cvals.chem === 'blei', style: 'solid' }, { name: 'Li-Ion (LiFePO4)' + (cvals.chem === 'lifepo4' ? ' (aktuell)' : ''), points: oc('lifepo4'), current: cvals.chem === 'lifepo4', style: 'dashed' }], marker: { x: s.soc * 100, y: ocvOf(cvals.chem, s.soc) } });
      // 3 Kapazitaet ueber Entladestrom (Peukert)
      const capOf = (chem, I) => { try { if (C && C.batt && typeof C.batt.capacity === 'function') { const v = C.batt.capacity({ chem, Usys: cvals.usys, C: cvals.cap, T: cvals.tbat }, I); if (fin(v) && v > 0) return 100 * v / cvals.cap; } } catch (e) { /* Rueckfall */ } return NaN; };
      const pc = chem => { const k = d[chem].peukert, Iref = cvals.cap / 20, pts = []; for (let f = 0.02; f <= 1.0001; f *= 1.25) { const I = f * cvals.cap, v = capOf(chem, I); pts.push([+I.toFixed(2), +(fin(v) ? v : 100 * Math.pow(Iref / I, k - 1)).toFixed(2)]); } return pts; };
      const iNow = s.uBat > 1 ? s.pLoad / s.uBat : 0, kC = d[cvals.chem].peukert;
      out.push({ id: 'peukert', title: 'Nutzbare Kapazität über Entladestrom (Peukert)', xLabel: 'Entladestrom', xUnit: 'A', yLabel: 'Kapazität (100 % = Nennkapazität bei C/20)', yUnit: '%', series: [{ name: 'Blei' + (cvals.chem === 'blei' ? ' (aktuell)' : ''), points: pc('blei'), current: cvals.chem === 'blei', style: 'solid' }, { name: 'Li-Ion (LiFePO4)' + (cvals.chem === 'lifepo4' ? ' (aktuell)' : ''), points: pc('lifepo4'), current: cvals.chem === 'lifepo4', style: 'dashed' }], marker: iNow > 0 ? { x: +iNow.toFixed(2), y: +(fin(capOf(cvals.chem, iNow)) ? capOf(cvals.chem, iNow) : 100 * Math.pow((cvals.cap / 20) / iNow, kC - 1)).toFixed(2) } : null });
      // 4 Akkuspannung unter Last ueber Ladezustand
      const dis = cr => {
        const I = cr * cvals.cap;
        try { if (C && C.batt && typeof C.batt.dischargeCurve === 'function') { const r = C.batt.dischargeCurve({ chem: cvals.chem, Usys: cvals.usys, C: cvals.cap, T: cvals.tbat }, I, 21); if (r && r.ok !== false && r.soc && r.u) { const pts = r.soc.map((x, i) => [+(x * 100).toFixed(0), r.u[i]]).filter(p => fin(p[1])).sort((p, q) => p[0] - q[0]); if (pts.length >= 3) return pts; } } } catch (e) { /* Rueckfall */ }
        const ri = d[cvals.chem].ri * (100 / cvals.cap); return so.map(x => [+(x * 100).toFixed(0), +(ocvOf(cvals.chem, x) - I * ri).toFixed(3)]).filter(p => fin(p[1]));
      };
      out.push({ id: 'entlade', title: 'Akkuspannung unter Last über Ladezustand', xLabel: 'Ladezustand', xUnit: '%', yLabel: 'Akkuspannung', yUnit: 'V', series: [{ name: '0,1 C', points: dis(0.1), style: 'solid' }, { name: '0,3 C', points: dis(0.3), style: 'dashed' }, { name: '1 C', points: dis(1), style: 'dotted' }], marker: { x: s.soc * 100, y: s.uBat } });
      // 5 Wirkungsgrad PWM gegen MPPT
      const ce = curveEta();
      out.push({ id: 'eta', title: 'Genutzte Leistung gegen mögliche Leistung (PWM gegen MPPT)', xLabel: 'Einstrahlung', xUnit: 'W/m²', yLabel: 'Betriebsleistung / Pmpp', yUnit: '%', series: [{ name: 'PWM' + (cvals.ctrl === 'pwm' ? ' (aktuell)' : ''), points: ce.pwm, current: cvals.ctrl === 'pwm', style: 'solid' }, { name: 'MPPT' + (cvals.ctrl === 'mppt' ? ' (aktuell)' : ''), points: ce.mppt, current: cvals.ctrl === 'mppt', style: 'dashed' }], marker: s.pMpp > 1 ? { x: s.gPoa, y: +(100 * s.pPv / s.pMpp).toFixed(2) } : null });
      return out;
    }

    // ---- Zeichnen
    const vis = { t: -1, ph: 0, rot: 0, blink: 0 };
    function layoutOf(w, h) {
      const portrait = w / h < 0.9;
      const W = portrait ? 560 : 1000, Hh = portrait ? 900 : 640, s = Math.min(w / W, h / Hh), ox = (w - W * s) / 2, oy = (h - Hh * s) / 2;
      const Lt = portrait
        ? { W, H: Hh, s, ox, oy, portrait, sky: { x: 0, y: 0, w: W, h: 300 }, mod: { x: 28, y: 150, w: 280, h: 120 }, reg: { x: 28, y: 340, w: 262, h: 210 }, bat: { x: 360, y: 340, w: 160, h: 200 }, lamp: { x: 340, y: 600, w: 190, h: 150 }, legY: 790, info: { x: 14, y: 20 } }
        : { W, H: Hh, s, ox, oy, portrait, sky: { x: 0, y: 0, w: W, h: 300 }, mod: { x: 40, y: 150, w: 280, h: 125 }, reg: { x: 330, y: 360, w: 250, h: 210 }, bat: { x: 660, y: 360, w: 150, h: 190 }, lamp: { x: 860, y: 380, w: 110, h: 170 }, legY: 596, info: { x: 14, y: 22 } };
      return Lt;
    }
    function drawText(ctx, str, x, y, o2) {
      o2 = o2 || {}; ctx.font = (o2.bold ? '600 ' : '') + o2.size + 'px system-ui, sans-serif'; ctx.textAlign = o2.align || 'left'; ctx.textBaseline = 'alphabetic';
      if (o2.outline) { ctx.lineWidth = 3; ctx.strokeStyle = o2.outline; ctx.lineJoin = 'round'; ctx.strokeText(str, x, y); }
      ctx.fillStyle = o2.color || COL.fg; ctx.fillText(str, x, y);
    }
    function sunPos(L, st) {
      if (cvals.quelle === 'konstant') return { x: L.sky.w * 0.72, y: 70, vis: st.gPoa >= 1 };
      const x = L.sky.w * (0.5 + clamp(st.azim, -120, 120) / 240), up = st.elev > 0, y = 290 - clamp(st.elev, 0, 90) / 90 * 235;
      return { x, y, vis: up };
    }
    function flowLocal(ctx, pts, P, kind, label, tms, Pref, fs, reducedMo) {
      P = num(P, 0); if (Math.abs(P) < 1) return false;
      const st = { solar: [COL.gold, [], ''], laden: [COL.laden, [], '+'], entladen: [COL.entl, [10, 7], '−'], last: [COL.last, [], ''], verlust: [COL.verl, [2, 6], ''] }[kind] || [COL.gold, [], ''];
      const wd = 1.5 + 14.5 * Math.sqrt(clamp(Math.abs(P) / Math.max(Pref, 1), 0, 1));
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = st[0]; ctx.lineWidth = wd; ctx.setLineDash(st[1].map(v => v * Math.max(1, wd / 4)));
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke(); ctx.setLineDash([]);
      // Pfeilspitze
      const a = pts[pts.length - 2], b = pts[pts.length - 1], an = Math.atan2(b[1] - a[1], b[0] - a[0]), hs = Math.max(8, wd * 1.4);
      ctx.fillStyle = st[0]; ctx.beginPath(); ctx.moveTo(b[0] + Math.cos(an) * hs * 0.6, b[1] + Math.sin(an) * hs * 0.6); ctx.lineTo(b[0] - Math.cos(an - 0.5) * hs, b[1] - Math.sin(an - 0.5) * hs); ctx.lineTo(b[0] - Math.cos(an + 0.5) * hs, b[1] - Math.sin(an + 0.5) * hs); ctx.closePath(); ctx.fill();
      // laufende Punkte
      let tot = 0; const seg = []; for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); tot += l; }
      const nd = Math.min(10, Math.ceil(3 + 6 * Math.sqrt(clamp(Math.abs(P) / Math.max(Pref, 1), 0, 1)))), sp = reducedMo ? 0.00002 : 0.00018; ctx.fillStyle = '#10161c';
      for (let i = 0; i < nd; i++) {
        let u = ((tms * sp + i / nd) % 1 + 1) % 1, dd = u * tot, k = 0; while (k < seg.length - 1 && dd > seg[k]) { dd -= seg[k]; k++; }
        const f = seg[k] > 0 ? dd / seg[k] : 0; ctx.beginPath(); ctx.arc(pts[k][0] + (pts[k + 1][0] - pts[k][0]) * f, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * f, Math.max(1.5, wd * 0.28), 0, 6.2832); ctx.fill();
      }
      ctx.restore();
      // Textschild mit Wattangabe
      const mid = pts.length === 2 ? [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2] : pts[1], txt = label + ' ' + (st[2] ? st[2] + ' ' : '') + wtxt(Math.abs(P));
      ctx.font = '600 ' + fs + 'px system-ui, sans-serif'; const tw = Math.max(40, fs * txt.length * 0.56);
      ctx.fillStyle = 'rgba(16,22,28,0.82)'; rr(ctx, mid[0] - tw / 2, mid[1] - fs - 4, tw, fs + 8, 6); ctx.fill(); ctx.strokeStyle = st[0]; ctx.lineWidth = 1.5; ctx.stroke();
      drawText(ctx, txt, mid[0], mid[1] - 2, { size: fs, bold: true, align: 'center', color: COL.fg });
      return true;
    }
    function draw(ctx, w, h, tms) {
      if (!ctx || !fin(w) || !fin(h) || w < 20 || h < 20 || w > 20000 || h > 20000) return;
      tms = num(tms, 0); const dt = (vis.t < 0 || tms < vis.t) ? 0 : clamp(tms - vis.t, 0, 100); vis.t = tms;
      try {
        ensureSim(); const st = last || readSim(), L = layoutOf(w, h), s = L.s, F = base => Math.max(11 / s, base), rd = reduced(), D = noDraw ? null : root.ENR_DRAW;
        ctx.save(); ctx.fillStyle = '#10161c'; ctx.fillRect(0, 0, w, h);
        ctx.translate(L.ox, L.oy); ctx.scale(s, s); ctx.beginPath(); ctx.rect(0, 0, L.W, L.H); ctx.clip();
        if (!st.sim) { drawText(ctx, 'Der Rechenkern (ENR_CORE) wird geladen …', L.W / 2, L.H / 2, { size: F(18), align: 'center', color: COL.mute }); if (simErr) drawText(ctx, simErr, L.W / 2, L.H / 2 + 30, { size: F(13), align: 'center', color: COL.warn }); ctx.restore(); return; }
        const alt = cvals.quelle === 'konstant' ? 45 : st.elev, sc = skyColors(alt), sk = L.sky;
        // ---- Himmel
        let g = ctx.createLinearGradient(0, sk.y, 0, sk.y + sk.h); g.addColorStop(0, rgb(sc.top)); g.addColorStop(1, rgb(sc.hor)); ctx.fillStyle = g; ctx.fillRect(sk.x, sk.y, sk.w, sk.h);
        if (alt < -6) { const r = mulberry(7), a2 = clamp((-6 - alt) / 6, 0, 1); for (let i = 0; i < 28; i++) { const x = r() * sk.w, y = r() * 230, tw = rd ? 0.8 : 0.6 + 0.4 * Math.sin(tms / 400 + i * 1.7); ctx.fillStyle = 'rgba(255,255,255,' + (a2 * tw).toFixed(2) + ')'; ctx.fillRect(x, y, 2, 2); } }
        const sp = sunPos(L, st), cfac = cvals.wetter === 'frei' ? clamp(cvals.wolken / 100, 0, 1) : (WX[cvals.wetter] || { c: 0 }).c, cloudy = cvals.quelle === 'tagesgang' ? cfac : 0;
        const inten = clamp(st.gPoa / 1000, 0, 1.2);
        if (sp.vis) {
          const r = (26 + (alt < 15 ? (15 - Math.max(alt, 0)) * 0.6 : 0)) * (cvals.quelle === 'konstant' ? 0.6 + 0.4 * inten : 1), rg = ctx.createRadialGradient(sp.x, sp.y, r * 0.3, sp.x, sp.y, r * 3);
          rg.addColorStop(0, 'rgba(255,230,140,' + (0.85 * Math.max(0.25, 1 - cloudy * 0.6)).toFixed(2) + ')'); rg.addColorStop(1, 'rgba(255,200,80,0)'); ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(sp.x, sp.y, r * 3, 0, 6.2832); ctx.fill();
          ctx.strokeStyle = 'rgba(255,214,90,0.55)'; ctx.lineWidth = 3; for (let i = 0; i < 12; i++) { const an = i * 0.5236 + (rd ? 0 : tms / 6000); ctx.beginPath(); ctx.moveTo(sp.x + Math.cos(an) * r * 1.25, sp.y + Math.sin(an) * r * 1.25); ctx.lineTo(sp.x + Math.cos(an) * r * 1.7, sp.y + Math.sin(an) * r * 1.7); ctx.stroke(); }
          ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.arc(sp.x, sp.y, r, 0, 6.2832); ctx.fill();
        }
        // ---- Wolken
        if (cloudy > 0.02) { const r = mulberry(cvals.seed * 31 + 5), n = Math.round(2 + cloudy * 7), drift = rd ? 0 : tms / 90; ctx.fillStyle = 'rgba(' + (alt < 0 ? '120,125,150' : '245,247,250') + ',' + (0.55 + 0.35 * cloudy).toFixed(2) + ')'; for (let i = 0; i < n; i++) { const bx = ((r() * sk.w + drift * (0.4 + r() * 0.6)) % (sk.w + 160)) - 80, by = 40 + r() * 120; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.ellipse(bx + k * 26 - 26, by + (k === 1 ? -9 : 0), 34, 17, 0, 0, 6.2832); ctx.fill(); } } }
        // ---- Boden
        g = ctx.createLinearGradient(0, 296, 0, 340); g.addColorStop(0, alt > 0 ? '#4d7a45' : '#25332a'); g.addColorStop(1, '#2d4a2a'); ctx.fillStyle = g; ctx.fillRect(0, 296, L.W, 44);
        // ---- Modul auf Gestell
        const m = L.mod, ns = cvals.ns, np = cvals.np, nmod = ns * np, mw = Math.min(110, (m.w - 10 * (nmod - 1)) / nmod), tc = clamp((st.tcell + 10) / 80, 0, 1);
        ctx.save(); ctx.translate(m.x + m.w / 2, m.y + m.h / 2 + 10); ctx.rotate(-0.22);
        const totW = nmod * mw + (nmod - 1) * 8, cols = cvals.modul === 'si60' ? 6 : 4, rows = cvals.modul === 'si60' ? 10 : 9;
        for (let i = 0; i < nmod; i++) {
          const x0 = -totW / 2 + i * (mw + 8), y0 = -m.h / 2 + 8, hh = m.h - 24; ctx.fillStyle = '#c3ccd5'; ctx.fillRect(x0 - 3, y0 - 3, mw + 6, hh + 6);
          const cr = Math.round(40 + 190 * tc), cb = Math.round(150 - 110 * tc); ctx.fillStyle = 'rgb(' + cr + ',70,' + cb + ')'; ctx.fillRect(x0, y0, mw, hh);
          ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.8; ctx.beginPath(); for (let c = 1; c < cols; c++) { ctx.moveTo(x0 + mw * c / cols, y0); ctx.lineTo(x0 + mw * c / cols, y0 + hh); } for (let r2 = 1; r2 < rows; r2++) { ctx.moveTo(x0, y0 + hh * r2 / rows); ctx.lineTo(x0 + mw, y0 + hh * r2 / rows); } ctx.stroke();
          const gl = rd ? 0.3 : (tms / 2500) % 1; ctx.fillStyle = 'rgba(255,255,255,' + (0.12 * clamp(inten, 0, 1)).toFixed(2) + ')'; ctx.fillRect(x0 + (mw + 20) * gl - 10, y0, 10, hh);
        }
        ctx.restore();
        ctx.strokeStyle = '#8d99a6'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(m.x + m.w / 2 - 28, m.y + m.h + 18); ctx.lineTo(m.x + m.w / 2 - 28, 318); ctx.moveTo(m.x + m.w / 2 + 28, m.y + m.h + 14); ctx.lineTo(m.x + m.w / 2 + 28, 318); ctx.stroke();
        // ---- Strahlen
        if (sp.vis && st.gPoa >= 1) {
          const tx = m.x + m.w / 2, ty = m.y + m.h / 2 + 4, nr = 5 + Math.round(4 * clamp(inten, 0, 1)), lw = 1 + 6 * Math.sqrt(clamp(st.gPoa / 1000, 0, 1)); ctx.save(); ctx.strokeStyle = 'rgba(255,225,110,0.65)'; ctx.lineWidth = lw; ctx.setLineDash([14, 10]); ctx.lineDashOffset = rd ? 0 : -(tms / 40) % 24;
          for (let i = 0; i < nr; i++) { const f = (i - (nr - 1) / 2) / Math.max(1, nr - 1), ex = tx + f * m.w * 0.85, ey = ty - 8 + f * 10; ctx.beginPath(); ctx.moveTo(sp.x + f * 22, sp.y + 24); ctx.lineTo(ex, ey); ctx.stroke(); }
          ctx.restore();
        }
        // ---- Info oben links
        const ln = [], cl = clockNow();
        if (cvals.quelle === 'tagesgang') { const hh = Math.floor(cl.tS), mi = Math.floor((cl.tS - hh) * 60); ln.push('Tag ' + cl.N + ', ' + (hh < 10 ? '0' : '') + hh + ':' + (mi < 10 ? '0' : '') + mi + ' Sonnenzeit'); ln.push('Sonnenhöhe ' + fm(st.elev, 0) + '°' + (st.elev <= 0 ? ' (Nacht)' : '')); }
        ln.push('Einstrahlung ' + fm(st.gPoa, 0) + ' W/m²'); ln.push('Zelltemperatur ' + fm(st.tcell, 0) + ' °C');
        ln.forEach((t, i) => drawText(ctx, t, L.info.x, L.info.y + i * F(17) * 1.15, { size: F(13), bold: i === 0, outline: 'rgba(8,12,20,0.8)', color: '#fff' }));
        drawText(ctx, 'Strichstärke ~ √Leistung', L.W - 14, 22, { size: F(12), align: 'right', color: '#fff', outline: 'rgba(8,12,20,0.8)' });
        // ---- Technikraum
        ctx.fillStyle = COL.panel; ctx.fillRect(0, 340, L.W, L.H - 340); ctx.fillStyle = COL.panel2; ctx.fillRect(0, 340, L.W, 3);
        const rg = L.reg, ba = L.bat, la = L.lamp, fs = F(12);
        // Regler
        ctx.fillStyle = COL.panel2; rr(ctx, rg.x, rg.y, rg.w, rg.h, 12); ctx.fill(); ctx.strokeStyle = st.dead ? COL.bad : COL.line; ctx.lineWidth = 2.5; ctx.stroke();
        drawText(ctx, 'Laderegler ' + (cvals.ctrl === 'pwm' ? 'PWM' : cvals.ctrl === 'mppt' ? 'MPPT' : '(fehlt: direkt)'), rg.x + 12, rg.y + 22, { size: F(15), bold: true });
        ctx.fillStyle = '#0b1218'; rr(ctx, rg.x + 12, rg.y + 34, rg.w - 24, 72, 6); ctx.fill();
        drawText(ctx, st.dead ? 'DEFEKT' : 'Ub ' + fm(st.uBat, 2) + ' V   Ipv ' + fm(st.iPv, 1) + ' A', rg.x + 20, rg.y + 56, { size: F(13), bold: true, color: st.dead ? COL.bad : '#7ee787' });
        drawText(ctx, 'Phase: ' + STAGE_TXT[st.stage] + (st.lvdOff ? ' | Last getrennt' : ''), rg.x + 20, rg.y + 76, { size: F(12), color: '#cfe8ff' });
        drawText(ctx, 'Uoc Feld ' + fm(st.uoc, 1) + ' V' + (cvals.ctrl === 'mppt' ? ' (max. ' + cvals.uocMax + ' V)' : ''), rg.x + 20, rg.y + 96, { size: F(11), color: COL.mute });
        // LEDs mit Text
        const leds = [[st.stage === 1 || st.stage === 2, COL.ok, 'Laden'], [st.stage === 3, '#4aa3ff', 'Float'], [st.dead || st.lvdOff, COL.bad, st.dead ? 'Fehler' : 'Schutz']];
        leds.forEach((l, i) => { const lx = rg.x + 24 + i * 78, ly = rg.y + 122; ctx.fillStyle = l[0] ? l[1] : '#2c3640'; ctx.beginPath(); ctx.arc(lx, ly, 7, 0, 6.2832); ctx.fill(); if (l[0] && !rd) { ctx.strokeStyle = l[1]; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(lx, ly, 10 + 2 * Math.sin(tms / 250), 0, 6.2832); ctx.stroke(); } drawText(ctx, l[2], lx + 12, ly + 4, { size: F(11), color: l[0] ? COL.fg : COL.mute }); });
        // PWM-Signalform bzw. MPPT-Kennlinie
        const sx = rg.x + 14, sy = rg.y + 140, sw = rg.w - 28, sh = 46; ctx.fillStyle = '#0b1218'; rr(ctx, sx, sy, sw, sh + 8, 6); ctx.fill();
        if (cvals.ctrl === 'pwm') {
          const duty = fin(st.duty) ? clamp(st.duty, 0, 1) : (st.pPv + st.curtail > 1 ? clamp(st.pPv / (st.pPv + st.curtail), 0.05, 1) : 0), per = sw / 5; ctx.strokeStyle = COL.gold; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx + 4, sy + sh);
          for (let i = 0; i < 5; i++) { const x0 = sx + 4 + i * (sw - 8) / 5, pw = (sw - 8) / 5; ctx.lineTo(x0, sy + sh); ctx.lineTo(x0, sy + 8); ctx.lineTo(x0 + pw * duty, sy + 8); ctx.lineTo(x0 + pw * duty, sy + sh); ctx.lineTo(x0 + pw, sy + sh); } ctx.stroke(); void per;
          drawText(ctx, 'Schalter: Tastgrad ' + fm(duty * 100, 0) + ' % (Anschauung)', sx + 6, sy + sh + 22, { size: F(11), color: COL.mute });
        } else if (cvals.ctrl === 'mppt') {
          ctx.strokeStyle = COL.gold; ctx.lineWidth = 2; ctx.beginPath(); const pm = Math.max(st.uoc, 1); for (let i = 0; i <= 24; i++) { const u = i / 24, p = u * (1 - Math.pow(u, 6)) * 1.35; const px = sx + 8 + (sw - 16) * u, py = sy + sh - (sh - 6) * clamp(p, 0, 1); if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); } ctx.stroke(); void pm;
          const um = st.uoc > 0 ? clamp(st.uMpp / st.uoc, 0, 1) : 0.8, pu = um, pp2 = pu * (1 - Math.pow(pu, 6)) * 1.35; ctx.fillStyle = COL.ok; ctx.beginPath(); ctx.arc(sx + 8 + (sw - 16) * pu, sy + sh - (sh - 6) * clamp(pp2, 0, 1) + (rd ? 0 : Math.sin(tms / 300) * 1.5), 5, 0, 6.2832); ctx.fill();
          drawText(ctx, 'Wandler: Punkt maximaler Leistung', sx + 6, sy + sh + 22, { size: F(11), color: COL.mute });
        } else drawText(ctx, 'ohne Regler: Modul direkt am Akku', sx + 8, sy + 28, { size: F(12), color: COL.warn });
        // Akku
        ctx.fillStyle = COL.panel2; rr(ctx, ba.x, ba.y, ba.w, ba.h, 10); ctx.fill(); const warnB = st.lvdOff || st.soc < 0.1 || st.bms, blink = warnB && !rd && Math.floor(tms / 400) % 2 === 0; ctx.strokeStyle = blink ? COL.bad : COL.line; ctx.lineWidth = 2.5; ctx.stroke();
        drawText(ctx, 'Akku ' + cvals.usys + ' V ' + (cvals.chem === 'blei' ? 'Blei' : 'Li-Ion') + ', ' + cvals.cap + ' Ah', ba.x + ba.w / 2, ba.y + 20, { size: F(12), bold: true, align: 'center' });
        const fx0 = ba.x + 14, fy0 = ba.y + 34, fw = ba.w - 28, fh = ba.h - 90, cellN = cvals.chem === 'blei' ? 6 : 4, fl = fh * st.soc, fc = st.soc > 0.5 ? COL.ok : st.soc > 0.2 ? COL.warn : COL.bad;
        ctx.fillStyle = '#0b1218'; ctx.fillRect(fx0, fy0, fw, fh); ctx.fillStyle = fc; ctx.fillRect(fx0, fy0 + fh - fl, fw, fl); ctx.strokeStyle = COL.panel2; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 1; i < cellN; i++) { ctx.moveTo(fx0 + fw * i / cellN, fy0); ctx.lineTo(fx0 + fw * i / cellN, fy0 + fh); } ctx.stroke(); ctx.strokeStyle = COL.line; ctx.strokeRect(fx0, fy0, fw, fh);
        if (st.gasAh > 0 && last && last.uBat > params.ugasBlei * cvals.usys / 12 && cvals.chem === 'blei') { for (let i = 0; i < 6; i++) { const ph = ((tms / 900) + i / 6) % 1; ctx.fillStyle = 'rgba(220,240,255,0.7)'; ctx.beginPath(); ctx.arc(fx0 + 8 + (fw - 16) * ((i * 37 % 10) / 10), fy0 + fh - fl - ph * 26, 3, 0, 6.2832); ctx.fill(); } drawText(ctx, 'gast', ba.x + ba.w / 2, fy0 + 14, { size: F(12), bold: true, align: 'center', color: COL.bad, outline: 'rgba(0,0,0,0.6)' }); }
        drawText(ctx, 'Ladezustand ' + fm(st.soc * 100, 0) + ' %', ba.x + ba.w / 2, fy0 + fh + 18, { size: F(12), bold: true, align: 'center' });
        drawText(ctx, fm(st.uBat, 2) + ' V, ' + fm(st.tBat, 0) + ' °C', ba.x + ba.w / 2, fy0 + fh + 34, { size: F(11), align: 'center', color: COL.mute });
        // Last
        ctx.fillStyle = COL.panel2; rr(ctx, la.x, la.y, la.w, la.h, 10); ctx.fill(); ctx.strokeStyle = COL.line; ctx.lineWidth = 2; ctx.stroke();
        const on = st.pLoad > 0.5, lv = clamp(st.pLoad / 300, 0, 1), lcx = la.x + la.w / 2, lcy = la.y + 56;
        if (on) { const rg2 = ctx.createRadialGradient(lcx, lcy, 4, lcx, lcy, 30 + 40 * lv); rg2.addColorStop(0, 'rgba(255,230,120,' + (0.55 + 0.4 * lv).toFixed(2) + ')'); rg2.addColorStop(1, 'rgba(255,230,120,0)'); ctx.fillStyle = rg2; ctx.beginPath(); ctx.arc(lcx, lcy, 30 + 40 * lv, 0, 6.2832); ctx.fill(); }
        ctx.fillStyle = on ? '#ffe27a' : '#3a444e'; ctx.beginPath(); ctx.arc(lcx, lcy, 20, 0, 6.2832); ctx.fill(); ctx.strokeStyle = COL.line; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#8d99a6'; ctx.fillRect(lcx - 9, lcy + 20, 18, 10);
        drawText(ctx, 'Last', lcx, la.y + 108, { size: F(13), bold: true, align: 'center' }); drawText(ctx, st.lvdOff ? 'getrennt (Schutz)' : on ? wtxt(st.pLoad) : 'aus', lcx, la.y + 126, { size: F(12), align: 'center', color: st.lvdOff ? COL.bad : COL.fg }); drawText(ctx, '(antippen: ein/aus)', lcx, la.y + 144, { size: F(11), align: 'center', color: COL.mute });
        // ---- Energieflusspfeile
        const Pref = 1.2 * Math.max(60, (fieldKeys(1000, 25) || { Pmpp: 300 }).Pmpp), mb = { x: m.x + m.w / 2, y: m.y + m.h + 18 };
        const fl1 = [[mb.x, 322], [mb.x, rg.y + 40], [rg.x, rg.y + 40]], pBat = st.pBat;
        const batPts = L.portrait ? [[rg.x + rg.w, rg.y + 80], [ba.x, rg.y + 80]] : [[rg.x + rg.w, rg.y + 80], [ba.x, rg.y + 80]];
        const lastPts = L.portrait ? [[rg.x + rg.w * 0.5, rg.y + rg.h], [rg.x + rg.w * 0.5, la.y + 70], [la.x, la.y + 70]] : [[rg.x + rg.w * 0.6, rg.y + rg.h], [rg.x + rg.w * 0.6, rg.y + rg.h + 24], [la.x + la.w / 2, rg.y + rg.h + 24], [la.x + la.w / 2, la.y + la.h]];
        const pool = (pts, P, kind, label) => { let ok = false; if (D && typeof D.flow === 'function') { try { ok = D.flow(ctx, pts, P, { kind, label, Pref, t: tms, detail, reduced: rd }) === true; } catch (e) { ok = false; } } if (!ok) flowLocal(ctx, pts, P, kind, label, tms, Pref, F(12), rd); };
        pool(fl1, st.pPv, 'solar', 'Solar');
        if (pBat > 1) pool(batPts, pBat, 'laden', 'lädt'); else if (pBat < -1) pool([batPts[1], batPts[0]], -pBat, 'entladen', 'entlädt');
        if (st.pLoad > 1) pool(lastPts, st.pLoad, 'last', 'Last');
        if (detail) { const lossC = Math.max(0, st.pMpp - st.pPv), lossR = Math.max(0, st.pPv - st.pBat - st.pLoad); if (lossC >= 1) pool([[mb.x + 30, 330], [mb.x + 60, 350]], lossC, 'verlust', 'ungenutzt'); if (lossR >= 1) pool([[rg.x + 30, rg.y + rg.h], [rg.x + 30, rg.y + rg.h + 26]], lossR, 'verlust', 'Verlust'); }
        // ---- Legende
        const ly = L.legY, lx0 = 14, items = [['Solar', COL.gold, []], ['Laden (+)', COL.laden, []], ['Entladen (−)', COL.entl, [8, 5]], ['Last', COL.last, []]];
        items.forEach((it, i) => { const x0 = lx0 + (L.portrait ? (i % 2) * 150 : i * 130), y0 = ly + (L.portrait ? Math.floor(i / 2) * 22 : 0); ctx.save(); ctx.strokeStyle = it[1]; ctx.lineWidth = 4; ctx.setLineDash(it[2]); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + 28, y0); ctx.stroke(); ctx.restore(); drawText(ctx, it[0], x0 + 34, y0 + 4, { size: F(12), color: COL.fg }); });
        drawText(ctx, 'Prozesszeit ' + fm(steps * H / 3600, 1) + ' h (Zeitraffer ×' + fm(timeScaleNow() / 60, 0) + ' Minuten je Sekunde)', lx0, L.H - 12, { size: F(11), color: COL.mute });
        let fy = L.H - 34; (st.faults || []).slice(0, 2).forEach(id => { drawText(ctx, 'Meldung: ' + (SHORT[id] || id), L.W - 14, fy, { size: F(11), align: 'right', color: COL.warn }); fy -= 16; });
        ctx.restore();
        if (!rd) { vis.ph += dt; }
      } catch (e) { try { ctx.restore(); } catch (e2) { /* Zustand weg */ } }
    }

    function hitTest(px, py, cw, ch) {
      if (!fin(px) || !fin(py) || !fin(cw) || !fin(ch) || cw < 20 || ch < 20) return null;
      const L = layoutOf(cw, ch), x = (px - L.ox) / L.s, y = (py - L.oy) / L.s;
      const inR = r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
      if (inR(L.reg)) { const ops = CDEF.ctrl.options.map(p => p.value), nx = ops[(ops.indexOf(cvals.ctrl) + 1) % ops.length]; return { key: 'ctrl', kind: 'switch', to: nx, value: nx }; }
      if (inR(L.lamp)) { const nx = cvals.load > 0 ? 0 : (loadMem > 0 ? loadMem : 40); return { key: 'load', kind: 'switch', to: nx, value: nx }; }
      if (inR(L.bat)) { const s = last || readSim(); return { key: 'info:akku', kind: 'info', title: 'Akku', text: 'Spannung ' + fm(s.uBat, 2) + ' V, Strom ' + fm(s.iBat, 1) + ' A (laden positiv), Ladezustand ' + fm(s.soc * 100, 0) + ' %, Temperatur ' + fm(s.tBat, 0) + ' °C, Lebensdauer verbraucht ungefähr ' + fm(s.damage, 1) + ' % (grob).' }; }
      return null;
    }

    const rig = {
      id: 'regler', h: H, tUnit: 'h', params, events, presets: PRESETS, controls: CONTROLS, meters: METERS,
      get timeScale() { return timeScaleNow(); },
      setControl, getControl, controlInfo: info, step, stepProcess, setClock, readMeters, state, draw, hitTest, curves, reset, worldSize(cw) { return cw > 0 && cw < 600 ? { w: 560, h: 900 } : { w: 1000, h: 640 }; },
      analysis, trace, dayTrace, balance, diagnose, applyPreset, restart, setDetail(b) { detail = !!b; }, getDetail() { return detail; }
    };
    reset();
    return rig;
  }

  R.register({
    id: 'regler', name: 'Laderegler und Akku', icon: '🔋',
    info: 'Solarmodul, Laderegler (PWM oder MPPT) und Akku mit Gleichstromlast. Du siehst die Dreistufenladung, den Tiefentladeschutz, den Spannungsfall auf den Leitungen und was ohne Regler mit dem Akku passiert. Der Akku ist ein Lehrmodell mit Größenordnungen, das Datenblatt des Herstellers gilt.',
    controls: CONTROLS, meters: METERS, presets: PRESETS, create
  });
  if (typeof module !== 'undefined') module.exports = R;
})(typeof window !== 'undefined' ? window : globalThis);
