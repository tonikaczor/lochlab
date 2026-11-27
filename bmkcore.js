'use strict';
/* Tonfunk Plan-Lab: reine Logik (Kennung 'bmk'). window.BMK_CORE bzw. module.exports.
   Themen: Plantypen, Kennbuchstaben der Betriebsmittel, Referenzkennzeichen, Strompfade und Kontaktspiegel, Anschluss- und Klemmenbezeichnung, Schaltzeichen.
   Alles ist in eigenen Worten und für den Unterricht gemeint: Normen werden genannt, nie wörtlich zitiert oder als Tabelle nachgebaut.
   Die Kennbuchstaben folgen der heute üblichen Belegung; ältere Pläne weichen teils ab (siehe KB_ALT). Anlage, Orte, Klemmenplan und Zahlen sind frei erfundene Übungswerte.
   Ungültige Eingaben liefern NaN bzw. null, nie Infinity. */
(function (root) {
  const fin = Number.isFinite, NAN = NaN;
  const rd = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f + (v >= 0 ? 1e-9 : -1e-9)) / f; };

  /* ---------- Zahlen deutsch ---------- */
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NAN;
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/(pfad|klemmen|klemme|stück|stk|mal|zeile|adern|ader|kontakte|kontakt|anschlüsse|pole|pol|leuchten|ziffer)$/i, '');
    if (/^[+\-−]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '');
    s = s.replace(',', '.');
    if (!/^[+\-−]?\d+(\.\d+)?$|^[+\-−]?\.\d+$/.test(s)) return NAN;
    return parseFloat(s.replace('−', '-'));
  }
  function fmtN(v, dec, group) {
    if (!fin(v)) return '-';
    dec = dec == null ? 2 : dec; let s = rd(v, dec).toFixed(dec);
    if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
    let [i, fr] = s.split('.'); const neg = i[0] === '-'; if (neg) i = i.slice(1);
    if (group && i.length > 4) i = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    s = (neg ? '-' : '') + i + (fr ? ',' + fr : '');
    return s.indexOf(',') >= 0 ? s.replace(/0+$/, '').replace(/,$/, '') : s;
  }

  /* ---------- Zufall (seed-fähig) ---------- */
  function hashStr(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    let a = (typeof seed === 'number' ? seed >>> 0 : hashStr(seed)) || 1;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const ri = (R, a, b) => a + Math.floor(R() * (b - a + 1));
  const pick = (R, arr) => arr[Math.floor(R() * arr.length)];
  function shuffle(R, arr) { const o = arr.slice(); for (let j = o.length - 1; j > 0; j--) { const k = Math.floor(R() * (j + 1)); [o[j], o[k]] = [o[k], o[j]]; } return o; }

  /* ============================================================ Schaltzeichen (eigene Zeichnungen in bmkviz.js)
     k = Schlüssel, n = Name, kb = Kennbuchstabe des Betriebsmittels (oder null), pins = Anschlusspunkte des gezeichneten Zeichens */
  const SYMS = [
    { k: 'schliesser', n: 'Schließer', kb: null, pins: 2 }, { k: 'oeffner', n: 'Öffner', kb: null, pins: 2 }, { k: 'taster', n: 'Taster (Schließer)', kb: 'S', pins: 2 },
    { k: 'spule', n: 'Schützspule', kb: 'K', pins: 2 }, { k: 'motor', n: 'Drehstrommotor', kb: 'M', pins: 3 }, { k: 'sicherung', n: 'Sicherung', kb: 'F', pins: 2 },
    { k: 'leuchte', n: 'Meldeleuchte', kb: 'P', pins: 2 }, { k: 'widerstand', n: 'Widerstand', kb: 'R', pins: 2 }, { k: 'kondensator', n: 'Kondensator', kb: 'C', pins: 2 },
    { k: 'diode', n: 'Diode', kb: null, pins: 2 }, { k: 'hauptk3', n: 'Hauptkontakte (dreipolig)', kb: 'Q', pins: 6 }, { k: 'trafo', n: 'Transformator', kb: 'T', pins: 4 },
    { k: 'batterie', n: 'Batterie', kb: 'G', pins: 2 }, { k: 'klemme', n: 'Klemme', kb: 'X', pins: 1 }
  ];
  const symOf = k => SYMS.find(s => s.k === k) || null;

  /* ============================================================ Kennbuchstaben (heute übliche Belegung nach DIN EN IEC 81346-2, in eigenen Worten)
     n = Aufgabe des Betriebsmittels, ex = Beispiele, sym = Schaltzeichen-Schlüssel (oder null) */
  const KB = [
    { k: 'Q', n: 'Energiefluss schalten', ex: ['Leistungsschalter', 'Trennschalter', 'Leistungsschütz im Hauptstromkreis'], sym: 'hauptk3' },
    { k: 'K', n: 'Signale verarbeiten', ex: ['Relais', 'Hilfsschütz', 'Zeitrelais', 'Koppelrelais'], sym: 'spule' },
    { k: 'F', n: 'Schützen', ex: ['Überlastrelais', 'Schmelzsicherung', 'Leitungsschutzschalter'], sym: 'sicherung' },
    { k: 'S', n: 'Von Hand eingeben', ex: ['Taster', 'Wahlschalter', 'Not-Halt-Taster'], sym: 'taster' },
    { k: 'B', n: 'Messgröße in ein Signal umwandeln', ex: ['Näherungsschalter', 'Temperaturfühler', 'Lichtschranke', 'Drucksensor'], sym: null },
    { k: 'M', n: 'Bewegung erzeugen (Antrieb)', ex: ['Drehstrommotor', 'Gleichstrommotor', 'Stellantrieb'], sym: 'motor' },
    { k: 'P', n: 'Information darstellen', ex: ['Meldeleuchte', 'Anzeige', 'Messgerät', 'Summer'], sym: 'leuchte' },
    { k: 'X', n: 'Leitungen verbinden', ex: ['Reihenklemme', 'Klemmleiste', 'Steckverbinder'], sym: 'klemme' },
    { k: 'T', n: 'Energie umformen, Energieart bleibt', ex: ['Transformator', 'Gleichrichter', 'Frequenzumrichter'], sym: 'trafo' },
    { k: 'G', n: 'Energie erzeugen oder bereitstellen', ex: ['Generator', 'Batterie', 'Netzgerät'], sym: 'batterie' },
    { k: 'E', n: 'Licht oder Wärme abgeben', ex: ['Beleuchtung', 'Heizelement'], sym: null },
    { k: 'R', n: 'Fluss begrenzen', ex: ['Widerstand', 'Drossel', 'Vorwiderstand'], sym: 'widerstand' },
    { k: 'C', n: 'Speichern', ex: ['Kondensator', 'Speicherbaustein'], sym: 'kondensator' }
  ];
  const kbOf = k => KB.find(x => x.k === k) || null;
  /* Ältere Pläne (Vorgängerbelegung) weichen bei einzelnen Betriebsmitteln ab */
  const KB_ALT = [{ teil: 'Meldeleuchte', alt: 'H', neu: 'P' }, { teil: 'Endschalter (mechanisch)', alt: 'S', neu: 'B' }];

  /* ============================================================ Referenzkennzeichen (Aufbau nach DIN EN IEC 81346-1)
     Vorzeichen: = Funktion, + Ort, - Produkt (Betriebsmittel), : Anschluss. Codes von Funktion und Ort sind in der Übungsanlage frei vergeben. */
  const VORZ = { f: '=', o: '+', p: '-', a: ':' };
  const TEILE = [['f', 'Funktion', 'was die Einrichtung in der Anlage tut'], ['o', 'Ort', 'wo sie eingebaut ist'], ['p', 'Produkt', 'das Betriebsmittel selbst: Kennbuchstabe und Zählnummer'], ['a', 'Anschluss', 'der Anschlusspunkt am Betriebsmittel']];
  const FUNKT = [{ c: 'A1', n: 'Förderband' }, { c: 'A2', n: 'Lüftung' }, { c: 'A3', n: 'Pumpe' }];
  const ORTE = [{ c: 'S1', n: 'Schaltschrank' }, { c: 'S2', n: 'Bedienpult' }, { c: 'M1', n: 'Maschine' }];
  /* Anschlüsse, die zu einem Kennbuchstaben passen (nur wo sinnvoll) */
  const ANSCHL = { K: ['A1', 'A2', '13', '14', '21', '22'], S: ['11', '12', '13', '14'], M: ['U1', 'V1', 'W1', 'PE'], P: ['X1', 'X2'], Q: ['1', '2', '3', '4', '5', '6'], F: ['95', '96', '97', '98'], X: ['1', '2', '3', '4'] };
  const funktOf = c => FUNKT.find(x => x.c === c) || null, ortOf = c => ORTE.find(x => x.c === c) || null;
  /* o = { f:'A1', o:'S1', k:'K', nr:3, a:'13' }; Teile dürfen fehlen, ein Anschluss braucht ein Produkt */
  function buildKz(o) {
    if (!o || (o.a && !(o.k && o.nr >= 1))) return '';
    return (o.f ? VORZ.f + o.f : '') + (o.o ? VORZ.o + o.o : '') + (o.k && o.nr >= 1 ? VORZ.p + o.k + o.nr : '') + (o.a ? VORZ.a + o.a : '');
  }
  function parseKz(s) {
    const m = /^(?:=([A-Z]\d+))?(?:\+([A-Z]\d+))?(?:-([A-Z])(\d+))?(?::([A-Z0-9]+))?$/.exec(String(s == null ? '' : s).trim().replace(/[−–]/g, '-'));
    if (!m || !m[0] || (m[5] && !m[3])) return null;
    return { f: m[1] || '', o: m[2] || '', k: m[3] || '', nr: m[4] ? +m[4] : 0, a: m[5] || '' };
  }
  /* Zerlegung in lesbare Teile: [{ teil, zeichen, text }] */
  function describeKz(o) {
    if (!o) return [];
    const out = [];
    if (o.f) out.push({ teil: 'Funktion', zeichen: VORZ.f + o.f, text: (funktOf(o.f) || { n: 'Funktion ' + o.f }).n });
    if (o.o) out.push({ teil: 'Ort', zeichen: VORZ.o + o.o, text: (ortOf(o.o) || { n: 'Ort ' + o.o }).n });
    if (o.k && o.nr) out.push({ teil: 'Produkt', zeichen: VORZ.p + o.k + o.nr, text: (kbOf(o.k) ? kbOf(o.k).ex[0] : 'Betriebsmittel') + ' Nr. ' + o.nr });
    if (o.a) out.push({ teil: 'Anschluss', zeichen: VORZ.a + o.a, text: 'Anschluss ' + o.a });
    return out;
  }

  /* ============================================================ Anschlussbezeichnungen von Schaltgeräten
     Zweistellige Hilfskontakte: erste Ziffer = Ordnungsziffer (der wievielte Kontakt), letzte Ziffer = Funktionsziffer (1-2 Öffner, 3-4 Schließer). */
  function decodeContact(code) {
    const m = /^(\d)([1-4])-(\d)([1-4])$/.exec(String(code == null ? '' : code).trim());
    if (!m || m[1] !== m[3] || +m[4] !== +m[2] + 1 || (m[2] !== '1' && m[2] !== '3')) return null;
    return { ord: +m[1], typ: m[2] === '1' ? 'O' : 'S', fz: m[2] + '-' + m[4] };
  }
  const CTYP = { S: 'Schließer', O: 'Öffner' };
  /* Leiterkennzeichen und Farben (Installationsleitungen, DIN EN 60445) */
  const LEITER = [{ k: 'L1', f: 'braun' }, { k: 'L2', f: 'schwarz' }, { k: 'L3', f: 'grau' }, { k: 'N', f: 'blau' }, { k: 'PE', f: 'grün-gelb' }];

  /* ============================================================ Übungsanlage: Schützsteuerung (Förderband-Antrieb)
     Strompfade von links nach rechts: 1 Hauptstromkreis (Hauptkontakte K1, Überlastrelais F2, Motor M1), 2 Spule K1 mit Aus-Taster S1, Ein-Taster S2 und F2 95-96,
     3 Selbsthaltung K1 13-14, 4 Leuchte P1 über K1 21-22 (Bereit), 5 Leuchte P2 über K1 33-34 (Läuft), 6 Leuchte P3 über F2 97-98 (Störung). */
  const CONTACTS = [
    { dev: 'K1', id: '1-2', typ: 'S', pfad: 1 }, { dev: 'K1', id: '3-4', typ: 'S', pfad: 1 }, { dev: 'K1', id: '5-6', typ: 'S', pfad: 1 },
    { dev: 'K1', id: '13-14', typ: 'S', pfad: 3 }, { dev: 'K1', id: '21-22', typ: 'O', pfad: 4 }, { dev: 'K1', id: '33-34', typ: 'S', pfad: 5 },
    { dev: 'F2', id: '95-96', typ: 'O', pfad: 2 }, { dev: 'F2', id: '97-98', typ: 'S', pfad: 6 }
  ];
  const PFADE = 6;
  const LAMPS = [{ id: 'P1', pfad: 4, n: 'Bereit', via: 'K1:21-22' }, { id: 'P2', pfad: 5, n: 'Läuft', via: 'K1:33-34' }, { id: 'P3', pfad: 6, n: 'Störung', via: 'F2:97-98' }];
  const MODES = [['ruhe', 'Ruhelage (Plan)'], ['lauf', 'Motor läuft'], ['ueberlast', 'Überlast']];
  /* Kontaktspiegel eines Geräts: Strompfade seiner Schließer und Öffner in der Reihenfolge der Kontakte */
  function spiegel(dev) {
    const own = CONTACTS.filter(c => c.dev === dev);
    return { S: own.filter(c => c.typ === 'S').map(c => c.pfad), O: own.filter(c => c.typ === 'O').map(c => c.pfad) };
  }
  /* Zustand: Ruhelage = spannungslos wie im Plan gezeichnet, Motor läuft = K1 angezogen, Überlast = F2 hat ausgelöst (K1 fällt ab) */
  function state(mode) {
    const m = MODES.some(x => x[0] === mode) ? mode : 'ruhe', k1 = m === 'lauf', f2 = m === 'ueberlast', closed = {};
    CONTACTS.forEach(c => { const on = c.dev === 'K1' ? k1 : f2; closed[c.dev + ':' + c.id] = c.typ === 'S' ? on : !on; });
    const lamps = { P1: closed['K1:21-22'], P2: closed['K1:33-34'], P3: closed['F2:97-98'] };
    const live = [k1, k1, k1, lamps.P1, lamps.P2, lamps.P3].map((on, i) => (on ? i + 1 : 0)).filter(Boolean);
    return { mode: m, k1, f2, closed, lamps, live, motor: k1 };
  }
  const litLamps = mode => { const s = state(mode); return LAMPS.filter(l => s.lamps[l.id]).map(l => l.id); };

  /* ============================================================ Klemmenplan der Übungsanlage (Klemmleiste -X1)
     innen = Quelle im Schaltschrank, aussen = Ziel im Feld, f = Aderfarbe, q = Querschnitt in mm² (Übungswerte) */
  const KLEMMEN = [
    { n: 1, innen: '-F2:2', aussen: '-M1:U1', f: 'schwarz', q: '1,5' }, { n: 2, innen: '-F2:4', aussen: '-M1:V1', f: 'schwarz', q: '1,5' },
    { n: 3, innen: '-F2:6', aussen: '-M1:W1', f: 'schwarz', q: '1,5' }, { n: 4, innen: 'PE-Schiene', aussen: '-M1:PE', f: 'grün-gelb', q: '1,5' },
    { n: 5, innen: '+24 V-Schiene', aussen: '-S1:11', f: 'rot', q: '0,75' }, { n: 6, innen: '-K1:13', aussen: '-S2:13', f: 'rot', q: '0,75' },
    { n: 7, innen: '-K1:14', aussen: '-S2:14', f: 'rot', q: '0,75' }, { n: 8, innen: '-K1:22', aussen: '-P1:X1', f: 'rot', q: '0,75' },
    { n: 9, innen: '-K1:34', aussen: '-P2:X1', f: 'rot', q: '0,75' }, { n: 10, innen: '0 V-Schiene', aussen: '-P1:X2', f: 'blau', q: '0,75' },
    { n: 11, innen: '-F2:98', aussen: '-P3:X1', f: 'rot', q: '0,75' }
  ];
  /* Verdrahtungsliste des Schaltschranks: eine Zeile je Ader von der Quelle zur Klemme */
  const verdrahtung = () => KLEMMEN.map(k => ({ nr: k.n, von: k.innen, nach: '-X1:' + k.n, farbe: k.f, q: k.q }));
  /* Übung zum Klemmenplan: n Klemmen, bei jeder fehlt entweder die Quelle (innen) oder das Ziel (aussen) */
  function klemmenUebung(R, n) {
    const ks = shuffle(R, KLEMMEN).slice(0, n).sort((a, b) => a.n - b.n);
    return ks.map(k => ({ n: k.n, fehlt: R() < 0.5 ? 'innen' : 'aussen' }));
  }
  const klemmeOf = n => KLEMMEN.find(k => k.n === n) || null;
  const klemmenOptionen = side => KLEMMEN.map(k => k[side]);

  const API = { parseDe, fmtN, rng, ri, pick, shuffle,
    SYMS, symOf, KB, kbOf, KB_ALT, TEILE, FUNKT, ORTE, ANSCHL, funktOf, ortOf, buildKz, parseKz, describeKz, decodeContact, CTYP, LEITER,
    CONTACTS, PFADE, LAMPS, MODES, spiegel, state, litLamps, KLEMMEN, verdrahtung, klemmenUebung, klemmeOf, klemmenOptionen };
  root.BMK_CORE = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
