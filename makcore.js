'use strict';
/* Tonfunk Maschinen-Lab: reine Rechenlogik und Maschinenmodell (Kennung 'mak'). window.MAK_CORE bzw. module.exports.
   Die Maschinen heißen neutral (keine Hersteller). Alle Drehzahlen sind von den Werkstatt-Fotos abgelesen; Unsicheres steht in quelle/mak/PRUEFEN.md (Markierung PRUEFEN Pn im Quelltext).
   Alle Richtwerte (Schnittgeschwindigkeit, Vorschub, Zeiten) sind ÜBUNGSWERTE; maßgebend sind Maschinentafel, Tabellenbuch, Werkzeughersteller und die Betriebsanweisung der Werkstatt.
   Konventionen: d in mm, n in min^-1, vc in m/min, f in mm/U, vf in mm/min, Zeit in min bzw. s. Ungültige Eingaben liefern NaN, nie Infinity.
   Eigenständig: keine Abhängigkeit von zercore.js; der Test vergleicht die Formeln und Richtwerte mit dem Zerspan-Lab. */
(function (root) {
  const fin = Number.isFinite, NAN = NaN;
  const rd = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f + (v >= 0 ? 1e-9 : -1e-9)) / f; };
  const num = v => (typeof v === 'number' && fin(v) ? v : NAN);
  const pos = v => fin(v) && v > 0;

  /* ---------- Zahlen deutsch ---------- */
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NAN;
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/(min\^?-1|min⁻¹|u\/min|1\/min|mm\/min|mm\/u|m\/min|rpm|mm|min|sek|s|%|°)$/i, '');
    if (/^[+\-−]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '');
    s = s.replace(',', '.');
    if (!/^[+\-−]?\d+(\.\d+)?$|^[+\-−]?\.\d+$/.test(s)) return NAN;
    return parseFloat(s.replace('−', '-'));
  }
  function fmtDe(v, dec, group) {
    if (!fin(v)) return '–';
    dec = dec == null ? 2 : dec; let s = rd(v, dec).toFixed(dec);
    if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
    let [i, f] = s.split('.'); const neg = i[0] === '-'; if (neg) i = i.slice(1);
    if (group && i.length > 4) i = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '−' : '') + i + (f ? ',' + f : '');
  }
  function fmtN(v, dec, group) {
    if (!fin(v)) return '–'; dec = dec == null ? 2 : dec;
    let s = fmtDe(rd(v, dec), dec, group);
    if (s.indexOf(',') >= 0) s = s.replace(/0+$/, '').replace(/,$/, '');
    return s;
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

  /* ============================================================ Schnittgeschwindigkeit und Drehzahl */
  /* n = vc · 1000 / (π · d),  vc = π · d · n / 1000,  d = vc · 1000 / (π · n) */
  const nFromVc = (vc, d) => (num(vc) >= 0 && pos(d) ? vc * 1000 / (Math.PI * d) : NAN);
  const vcFromN = (d, n) => (num(d) >= 0 && num(n) >= 0 ? Math.PI * d * n / 1000 : NAN);
  const dFromVcN = (vc, n) => (num(vc) >= 0 && pos(n) ? vc * 1000 / (Math.PI * n) : NAN);
  /* Vorschubgeschwindigkeit vf = f · n; Bohr- und Drehzeit t = L / (f · n) in min (grob: L ist der Gesamtweg inklusive An- und Überlauf) */
  const vfOf = (f, n) => (num(f) >= 0 && num(n) >= 0 ? f * n : NAN);
  const timeMin = (L, f, n) => (num(L) >= 0 && pos(f) && pos(n) ? L / (f * n) : NAN);
  const millTimeMin = (L, vf) => (num(L) >= 0 && pos(vf) ? L / vf : NAN);
  /* PRUEFEN P16: Stufenwahl an Maschinen mit festen Drehzahlen: Es wird die nächstkleinere Stufe der Tafel genommen (lieber etwas langsamer als zu schnell: weniger Hitze und Verschleiß). Liegt sogar die kleinste Stufe über dem Sollwert, gilt sie als „zu hoch“. Wird bei euch so gelehrt, oder die nächstliegende Stufe? */
  const lowerStage = (series, nSoll) => { if (!Array.isArray(series) || !pos(nSoll)) return NAN; let b = NAN; series.forEach(s => { if (s <= nSoll + 1e-9 && (isNaN(b) || s > b)) b = s; }); return b; };
  const nearestStage = (series, nSoll) => { if (!Array.isArray(series) || !pos(nSoll)) return NAN; let b = NAN; series.forEach(s => { if (isNaN(b) || Math.abs(s - nSoll) < Math.abs(b - nSoll)) b = s; }); return b; };
  const stagesInWindow = (series, d, lo, hi) => (Array.isArray(series) && pos(d) ? series.filter(s => { const v = vcFromN(d, s); return v >= lo - 1e-9 && v <= hi + 1e-9; }) : []);

  /* PRUEFEN P14: Richtwerte für die Schnittgeschwindigkeit vc (Fenster in m/min) für Schnellarbeitsstahl (HSS) und Hartmetall (HM); gerundete Mittelwerte aus üblichen Herstellertafeln, hier gleich wie im Zerspan-Lab. Beim Bohren nur HSS. */
  const GRUPPEN = [['stahl', 'Stahl (Baustahl)'], ['alu', 'Aluminium'], ['messing', 'Messing'], ['guss', 'Grauguss']];
  const VC_TAB = {
    dreh: { stahl: { hss: [20, 35], hm: [120, 220] }, alu: { hss: [100, 180], hm: [250, 500] }, messing: { hss: [60, 100], hm: [150, 300] }, guss: { hss: [15, 25], hm: [80, 150] } },
    fraes: { stahl: { hss: [20, 30], hm: [100, 200] }, alu: { hss: [100, 200], hm: [250, 500] }, messing: { hss: [60, 100], hm: [150, 250] }, guss: { hss: [15, 25], hm: [70, 120] } },
    bohr: { stahl: { hss: [20, 30], hm: null }, alu: { hss: [60, 100], hm: null }, messing: { hss: [40, 70], hm: null }, guss: { hss: [15, 25], hm: null } }
  };
  const PROCS = { bohr: 'Bohren', dreh: 'Drehen', fraes: 'Fräsen' };
  const vcWindow = (proc, grp, cut) => { const p = VC_TAB[proc]; if (!p || !p[grp]) return null; const w = p[grp][cut || 'hss']; return w ? w.slice() : null; };
  const vcStatus = (v, w) => { if (!fin(v) || !w) return ''; if (v < w[0] - 1e-9) return 'niedrig'; if (v > w[1] + 1e-9) return 'hoch'; return 'ok'; };
  /* PRUEFEN P15: Vorschub beim Bohren in Stahl grob 0,01 bis 0,03 · d in mm/U (eigene Faustregel für die Fehlersuche, keine Tafelwerte). Stimmt die Größenordnung mit eurer Praxis (Stahl, HSS-Bohrer)? */
  const FEED_BOHR = { lo: 0.01, hi: 0.03 };
  const feedWindow = d => (pos(d) ? [rd(FEED_BOHR.lo * d, 3), rd(FEED_BOHR.hi * d, 3)] : null);

  /* ============================================================ Maschinen: Drehzahlen, Hebel, Bauteile */
  /* Auswahl-Hebel einer Maschine: sel = [{id, label, opts}], Drehzahl je Stellung über f(picks) (picks = Indizes der gewählten Optionen). cont = stufenlos (Bereiche). */
  const S3 = (id, label, opts, ab) => ({ id, label, opts, ab: ab == null ? '' : ab });
  /* PRUEFEN P1: Tischbohrmaschine 2-stufig: Tafel „U/min“, Stufe 1: 1400 und 355, Stufe 2: 2800 und 710 (vom Foto). Gedeutet als Polumschaltung (Schalter am Sockel „1“ und „2“, Faktor 2) und zwei Riemenlagen (a: 1400/2800, b: 355/710, Faktor etwa 4). Stimmt diese Deutung, und wie heißen die beiden Spalten der Tafel in der Werkstatt? */
  const TB2 = [[1400, 355], [2800, 710]];
  /* PRUEFEN P2: Ständerbohrmaschine A: Drehzahltafel „U/min“ mit Spalten A/B/C und Zeilen 63/90/125, 180/250/355, 500/710/1000 (vom Foto, gut lesbar). Gedeutet: ein Hebel wählt den Buchstaben A/B/C (Spalte), ein zweiter Hebel die Zeile 1 bis 3. Stimmt die Zuordnung der beiden Hebel? */
  const SBA = [[63, 90, 125], [180, 250, 355], [500, 710, 1000]];
  /* PRUEFEN P3: Vorschubtafel der Ständerbohrmaschine A in mm/U (vom Foto, klein gedruckt): 0,08 0,22 0,63 / 0,11 0,32 0,90 / 0,16 0,45 1,25 mit den Spalten I, II, III. Sind die Zahlen richtig gelesen (Stufung etwa Faktor 1,4), und welcher Hebel wählt Zeile und Spalte? */
  const FEED_SBA = [[0.08, 0.22, 0.63], [0.11, 0.32, 0.90], [0.16, 0.45, 1.25]];
  /* PRUEFEN P6: Drehmaschine mit Gruppenschaltung: Tafel mit den Gruppen A/B/C und je drei Drehzahlen 60/95/145, 225/355/535, 835/1320/2000 (vom Foto). Am Spindelstock sitzen ein Knopf mit A/B/C und ein Knopf mit I/II; hier gedeutet als Gruppe (A/B/C) und Stufe 1 bis 3. Wie heißen die Knöpfe, und wie ist die Stufe I/II/(III) wirklich verteilt? */
  const DGR = [[60, 95, 145], [225, 355, 535], [835, 1320, 2000]];
  /* PRUEFEN P7: Bohr-Fräsmaschine: Tafel „Spindeldrehzahl“ mit Stufe 2 / Stufe 1: L-1 150/75, L-2 360/180, L-3 560/280, H-1 1200/600, H-2 2000/1000, H-3 3200/1600 (vom Foto, klein; Stufe 2 ist genau das Doppelte von Stufe 1). Ablesung richtig? Hebel L/H und 1/2/3 und „Stufe“ (Motor, Polumschaltung?) wie gedeutet? Der Hinweis „Motor und Hauptspindel ausschalten, bevor die Getriebestufe geändert wird“ steht so auf der Maschine. */
  const BFR = { L: [[75, 180, 280], [150, 360, 560]], H: [[600, 1000, 1600], [1200, 2000, 3200]] };
  /* PRUEFEN P8: Fräsmaschine mit Digitalanzeige: Typenschild mit den Drehzahlen 145, 290, 580, 725, 1450, 2900 (vom Foto). Gedeutet als zwei Gruppen (im Lab Gruppe 1: 145/290/580, Gruppe 2: 725/1450/2900) mit je drei Stufen; wie sind Hebel und Gruppen wirklich beschriftet? Die kleine Vorschubtafel (mm/U) war nicht sicher lesbar und wurde nicht übernommen. */
  const FRD = [[145, 290, 580], [725, 1450, 2900]];

  const MACHINES = {
    /* PRUEFEN P4: Tischbohrmaschine klein (älteres Modell mit Handhebel und Typenschild): Das Typenschild und die Drehzahlen waren auf dem Foto nicht lesbar und stehen nicht im Lab. Bitte Drehzahlen und Typ (Bohrdurchmesser höchstens) nachliefern, wenn die Maschine gerechnet werden soll. */
    tb1: {
      id: 'tb1', abbr: 'TB-1', name: 'Tischbohrmaschine klein', kind: 'bohr', none: 'Die Drehzahlen stehen auf dem Typenschild am Bohrkopf; auf dem Foto sind sie nicht lesbar.',
      blurb: 'Ältere Tischbohrmaschine mit Handhebel für kleine Bohrungen. Der Riemenantrieb im Bohrkopf wird nach der Tafel umgelegt.',
      hot: [
        { id: 'kopf', name: 'Bohrkopf mit Antrieb', text: 'Im Bohrkopf sitzen Motor und Riemenantrieb. Die Drehzahl wird über die Riemenlage nach der Tafel eingestellt, immer im Stillstand.' },
        { id: 'handhebel', name: 'Vorschubhebel (Handhebel)', text: 'Mit dem Handhebel wird die Spindel abgesenkt (Handvorschub). Gefühlvoll vorschieben und vor dem Durchbruch Druck wegnehmen.' },
        { id: 'schild', name: 'Typenschild', text: 'Auf dem Typenschild stehen Leistung, Drehzahlen und Baujahr. Hier liest du die einstellbaren Drehzahlen ab.' },
        { id: 'schalter', name: 'Schalter mit Zuleitung', text: 'Der Schalter schaltet den Motor ein und aus. Er sitzt so, dass du ihn mit der freien Hand erreichst.' },
        { id: 'futter', name: 'Bohrfutter', text: 'Das Bohrfutter spannt den Bohrer. Nach dem Spannen den Futterschlüssel sofort abziehen.' },
        { id: 'tisch', name: 'Bohrtisch', text: 'Auf dem Tisch wird das Werkstück gespannt (Schraubstock oder Spannelement). Nie mit der Hand festhalten.' }
      ]
    },
    tb2: {
      id: 'tb2', abbr: 'TB-2', name: 'Tischbohrmaschine 2-stufig', kind: 'bohr', blurb: 'Tischbohrmaschine mit Polumschaltung: Der Schalter am Sockel wählt Stufe 1 oder 2, die Riemenlage im Kopf die Spalte der Tafel.',
      sel: [S3('pol', 'Schalter am Sockel', ['Stufe 1', 'Stufe 2']), S3('riem', 'Riemenlage', ['a', 'b'], 'Lage')], f: p => TB2[p[0]][p[1]],
      hot: [
        { id: 'tafel', name: 'Drehzahltafel', text: 'Die Tafel zeigt vier Drehzahlen in min⁻¹: Stufe 1 gibt 1400 oder 355, Stufe 2 gibt 2800 oder 710. Welche der beiden Zahlen gilt, hängt von der Riemenlage ab.' },
        { id: 'schalter', name: 'Stufenschalter am Sockel', text: 'Der Schalter am Sockel wählt Stufe 1 oder Stufe 2 (Umschaltung der Motordrehzahl) und schaltet aus. Stufenwechsel nur im Stillstand.' },
        { id: 'notaus', name: 'Not-Aus', text: 'Der große rote Pilztaster stoppt die Maschine sofort. Er ist nicht zum normalen Ausschalten da. Danach erst die Ursache klären, dann entriegeln.' },
        { id: 'vorschub', name: 'Vorschubhebel', text: 'Mit dem Hebel wird die Spindel mit Handkraft abgesenkt. Der Vorschub je Umdrehung hängt von deiner Handkraft und der Drehzahl ab.' },
        { id: 'futter', name: 'Bohrfutter', text: 'Das Bohrfutter nimmt Bohrer bis zu seiner Spannweite. Bohrer zentrisch spannen, Schlüssel abziehen.' },
        { id: 'tisch', name: 'Bohrtisch mit Nut', text: 'Der Tisch trägt das Werkstück. Spannelemente (Schraubstock, Pratzen) gehören immer dazwischen, nie das Werkstück frei in der Hand.' }
      ]
    },
    tba: {
      id: 'tba', abbr: 'TB-A', name: 'Tischbohrmaschine mit Drehzahlanzeige', kind: 'bohr', cont: { ranges: [{ id: 'S', lo: NAN, hi: NAN }], note: true },
      /* PRUEFEN P9: Tischbohrmaschine mit Drehzahlanzeige (digital, rpm), Not-Aus, Drehknopf und Spannelementen (Kniehebelspannern): Der Drehzahlbereich steht nicht auf dem Foto und wird daher nicht genannt. Welcher Bereich gilt, und gilt die Anzeige in min⁻¹ als Sollwert? */
      blurb: 'Tischbohrmaschine mit stufenloser Drehzahl: Die Anzeige zeigt die Drehzahl, ein Drehknopf stellt sie ein. Der Bereich der Maschine steht in der Werkstatt-Anleitung.',
      hot: [
        { id: 'anzeige', name: 'Drehzahlanzeige', text: 'Die Anzeige zeigt die eingestellte Drehzahl in min⁻¹ (rpm). Du stellst nach der Rechnung ein und liest hier nur noch ab.' },
        { id: 'notaus', name: 'Not-Aus', text: 'Roter Pilztaster oben am Gehäuse: stoppt die Maschine sofort. Zum Entriegeln nach dem Hinweis auf dem Taster drehen oder ziehen, erst nach Klärung der Ursache.' },
        { id: 'knopf', name: 'Drehknopf Drehzahl', text: 'Der Drehknopf stellt die Drehzahl stufenlos ein. Kleine Bohrer brauchen hohe, große Bohrer niedrige Drehzahlen.' },
        { id: 'vorschub', name: 'Vorschubhebel', text: 'Der Hebel senkt die Spindel ab. Mit Gefühl vorschieben, besonders beim Austritt des Bohrers.' },
        { id: 'futter', name: 'Schnellspannfutter', text: 'Das Futter spannt den Bohrer ohne Schlüssel von Hand. Fest anziehen und prüfen, dass der Bohrer rund läuft.' },
        { id: 'tisch', name: 'Bohrtisch', text: 'Der Tisch hat Nuten für Spannelemente. Das Werkstück wird immer gespannt, nie gehalten.' },
        { id: 'spanner', name: 'Spannelement', text: 'Kniehebelspanner halten das Werkstück schnell und sicher. Sie müssen so stehen, dass der Bohrer sie nicht erreicht.' }
      ]
    },
    sbA: {
      id: 'sbA', abbr: 'SB-A', name: 'Ständerbohrmaschine A', kind: 'bohr', blurb: 'Grüne Ständerbohrmaschine mit Drehzahltafel (A/B/C, drei Zeilen) und Vorschubtafel in mm je Umdrehung. Für größere Bohrungen und niedrige Drehzahlen.',
      sel: [S3('zeile', 'Hebel Zeile', ['1', '2', '3'], 'Zeile'), S3('spalte', 'Hebel Buchstabe', ['A', 'B', 'C'], 'Spalte')], f: p => SBA[p[0]][p[1]],
      feed: { sel: [S3('zf', 'Vorschub Zeile', ['1', '2', '3'], 'Zeile'), S3('sf', 'Vorschub Spalte', ['I', 'II', 'III'], 'Spalte')], f: p => FEED_SBA[p[0]][p[1]] },
      hot: [
        { id: 'tafel', name: 'Drehzahltafel', text: 'Neun Drehzahlen in min⁻¹: Spalten A, B, C und drei Zeilen (63, 90, 125 / 180, 250, 355 / 500, 710, 1000). Zwei Hebel legen Zeile und Buchstabe fest.' },
        { id: 'hebelA', name: 'Hebel Buchstabe A/B/C', text: 'Dieser Hebel läuft in einer Kulisse mit A, B und C. Er wählt die Spalte der Drehzahltafel. Nur im Stillstand verstellen.' },
        { id: 'hebelZ', name: 'Hebel Zeile', text: 'Dieser Hebel wählt die Zeile der Drehzahltafel (1 bis 3). Er rastet in der Kulisse ein; Drehzahl nur bei stehender Spindel wechseln.' },
        { id: 'vorschubtafel', name: 'Vorschubtafel', text: 'Die Tafel zeigt den Maschinenvorschub in mm je Umdrehung, wenn der Selbstvorschub benutzt wird. Zeile und Spalte werden am Vorschubhebel gewählt.' },
        { id: 'handhebel', name: 'Handhebel (Bohrhebel)', text: 'Der Hebel mit dem schwarzen Griff schiebt die Spindel von Hand nach unten. Er dient für Handvorschub und zum Zurückfahren.' },
        { id: 'spindel', name: 'Bohrspindel mit Aufnahme', text: 'Die Spindel nimmt das Werkzeug mit Kegel (Morsekegel) oder Bohrfutter auf. Beim Werkzeugwechsel Spindel stillsetzen.' },
        { id: 'tisch', name: 'Tisch mit T-Nuten', text: 'Der große Tisch hat T-Nuten für Pratzen und Schraubstock. Er ist in der Höhe und seitlich verstellbar.' },
        /* PRUEFEN P10: Die Richtwerte-Tafel der Ständerbohrmaschine A (Schnellarbeitsstahl-Bohrer, Werkstoffgruppen, Bohrdurchmesser) ist auf dem Foto zu klein, um Zahlen sicher zu lesen; sie ist nicht im Lab. Dürfen die Werte der Tafel ins Lab, oder genügt der Hinweis? */
        { id: 'richtwerte', name: 'Richtwerte-Tafel', text: 'Eine Tafel mit Richtwerten für Bohrer aus Schnellarbeitsstahl. Dieses Lab rechnet mit eigenen Übungswerten, die Maschinentafel ist maßgebend.' }
      ]
    },
    sbB: {
      id: 'sbB', abbr: 'SB-B', name: 'Ständerbohrmaschine B', kind: 'bohr', none: 'Die Drehzahltafel dieser Maschine war auf dem Foto nicht lesbar (siehe Maschinentafel in der Werkstatt).',
      /* PRUEFEN P11: Ständerbohrmaschine B (Ein/Aus-Taster grün/rot, gelber Not-Aus-Kasten, zwei Handhebel): Drehzahlen und Vorschübe waren auf dem Foto nicht lesbar und sind nicht im Lab. Bitte die Tafel nachliefern, wenn die Maschine im Lab stufenweise gerechnet werden soll. */
      blurb: 'Ständerbohrmaschine mit Ein/Aus-Taster, Not-Aus und zwei Handhebeln. Hier geht es um die Bauteile und die Bedienung.',
      hot: [
        { id: 'taster', name: 'Ein/Aus-Taster', text: 'Grün schaltet den Motor ein, rot schaltet ihn aus (normales Ausschalten). Der Taster steht so, dass du nicht in den Arbeitsbereich greifen musst.' },
        { id: 'notaus', name: 'Not-Aus', text: 'Der rote Pilz auf gelbem Grund stoppt die Maschine in Gefahr. Nach dem Auslösen wird erst die Ursache beseitigt, dann entriegelt.' },
        { id: 'handhebel', name: 'Handhebel', text: 'Mit den Hebeln wird die Spindel abgesenkt und angehoben. Zwei Griffe verteilen die Handkraft.' },
        { id: 'spindel', name: 'Pinole mit Bohrfutter', text: 'Die Pinole ist das Rohr, das sich mit der Spindel auf und ab bewegt. Unten sitzt das Bohrfutter mit dem Bohrer.' },
        { id: 'tisch', name: 'Tisch mit Nuten', text: 'Auf dem Tisch wird das Werkstück gespannt. Pinsel und Spänehaken liegen am Rand, nie mit den Fingern in die Späne.' },
        { id: 'kurbel', name: 'Tischverstellung', text: 'Mit dem Hebel wird der Tisch in der Höhe verstellt und geklemmt. Erst klemmen, dann bohren.' }
      ]
    },
    vbs: {
      id: 'vbs', abbr: 'VBS', name: 'Vertikalbandsäge', kind: 'saege', none: 'Bandgeschwindigkeit und Vorschub werden über Kompass, Drehschalter und Hydraulik nach der Anleitung der Maschine eingestellt.',
      /* PRUEFEN P12: Vertikalbandsäge: Kompass-Scheibe (Sägen / Feilen / Polieren), zwei runde Anzeigen (Vorschub und Druck, Manometer), Drehschalter für Antrieb, Hydraulik und Kühlung, hydraulischer Vorschub. Die Beschriftungen waren auf dem Foto nur teilweise lesbar; Zahlen (Bandgeschwindigkeiten, Drücke) stehen nicht im Lab. Stimmen Name und Aufgabe der drei Schalter und der Anzeigen? */
      blurb: 'Vertikalbandsäge mit Kompass-Scheibe zur Bandgeschwindigkeit, Manometer, hydraulischem Vorschub und Drehschaltern. Das Band läuft senkrecht, der Tisch trägt das Werkstück.',
      hot: [
        { id: 'kompass', name: 'Kompass-Scheibe', text: 'Die Scheibe ordnet Werkstoff und Arbeit (Sägen, Feilen, Polieren) der passenden Bandgeschwindigkeit zu. Je härter der Werkstoff, desto langsamer läuft das Band; weiche Werkstoffe vertragen mehr.' },
        { id: 'manometer', name: 'Manometer', text: 'Das Manometer zeigt den Druck der Hydraulik, die den Vorschub macht. Zu hoher Vorschubdruck belastet das Band.' },
        { id: 'schalter', name: 'Drehschalter', text: 'Mit den Drehschaltern werden Antrieb, Hydraulik und weitere Funktionen geschaltet. Die Lampen daneben zeigen den Zustand.' },
        { id: 'band', name: 'Sägeband', text: 'Das Sägeband läuft als Schleife über zwei Rollen. Gefahr: offene Zähne im Arbeitsbereich; Hände immer weit weg von der Schnittstelle halten.' },
        { id: 'tisch', name: 'Tisch mit Anschlag', text: 'Der Tisch trägt das Werkstück, ein Anschlag hilft beim Führen. Das Werkstück sicher auflegen und festhalten, nie lange Teile frei führen.' },
        { id: 'taster', name: 'Taster-Kasten', text: 'Der kleine Kasten am Tisch enthält die Ein-/Aus-Taster, in Reichweite der Bedienperson.' }
      ]
    },
    dsl: {
      id: 'dsl', abbr: 'DM-S', name: 'Drehmaschine stufenlos', kind: 'dreh',
      /* PRUEFEN P5: Drehmaschine stufenlos: Hebel mit H (hohe Drehzahlreihe 200 bis 2500 min⁻¹), N (neutral) und L (niedrige Reihe 35 bis 440 min⁻¹), Zahlenanzeige, Hinweis „nur im Stillstand schalten“. Im Überschneidungsbereich 200 bis 440 min⁻¹ gehen beide Reihen; hier gilt: unter 200 niedrige, über 440 hohe Reihe, dazwischen frei wählbar (niedrige Reihe: mehr Drehmoment). Passt das zu euren Vorgaben? */
      cont: { ranges: [{ id: 'L', lo: 35, hi: 440 }, { id: 'H', lo: 200, hi: 2500 }] },
      blurb: 'Drehmaschine mit stufenloser Drehzahlregelung in zwei Reihen (niedrig 35 bis 440, hoch 200 bis 2500 min⁻¹), Zahlenanzeige, Futterschutz, Revolver-Stahlhalter und Reitstock.',
      hot: [
        { id: 'bereich', name: 'Hebel Drehzahlreihe H/N/L', text: 'Der Hebel wählt die hohe (H) oder niedrige (L) Drehzahlreihe, N ist neutral. Nur im Stillstand schalten, danach die Drehzahl stufenlos einstellen.' },
        { id: 'anzeige', name: 'Drehzahlanzeige', text: 'Die Zahlenanzeige zeigt die eingestellte Spindeldrehzahl in min⁻¹. Der Regler wird so lange gedreht, bis der Sollwert steht.' },
        { id: 'futterschutz', name: 'Futterschutz', text: 'Die gelbe Haube schützt vor dem drehenden Futter und vor Spänen. Die Maschine läuft nur bei geschlossenem Schutz. Nie überbrücken.' },
        { id: 'futter', name: 'Dreibackenfutter', text: 'Das Futter spannt das Werkstück zentrisch. Die zulässige Futterdrehzahl darf nie überschritten werden. Futterschlüssel sofort abziehen.' },
        { id: 'stahlhalter', name: 'Revolver-Stahlhalter', text: 'Der Stahlhalter nimmt mehrere Drehmeißel auf und wird durch Drehen in die gewünschte Stellung gebracht und geklemmt.' },
        { id: 'support', name: 'Support', text: 'Der Support besteht aus Bettschlitten, Planschlitten (quer) und Oberschlitten. Er trägt den Stahlhalter und führt ihn am Werkstück entlang.' },
        { id: 'reitstock', name: 'Reitstock', text: 'Der Reitstock stützt lange Werkstücke mit der Körnerspitze oder nimmt Bohrer im Bohrfutter auf. Er wird auf dem Bett verschoben und geklemmt.' },
        { id: 'bett', name: 'Bett', text: 'Das Bett ist die stabile Führungsbahn für Support und Reitstock. Es muss frei von Spänen und Werkzeugen bleiben.' },
        { id: 'notaus', name: 'Not-Aus', text: 'Der rote Pilz auf gelbem Gehäuse stoppt die Maschine in Gefahr. Er ist nicht für den normalen Betrieb gedacht.' }
      ]
    },
    dgr: {
      id: 'dgr', abbr: 'DM-G', name: 'Drehmaschine mit Gruppenschaltung', kind: 'dreh', blurb: 'Drehmaschine mit Stufenschaltung: Gruppe A, B oder C und drei Stufen, dazu Leit- und Zugspindel, Dreibackenfutter und Reitstock.',
      sel: [S3('gruppe', 'Gruppe', ['A', 'B', 'C'], 'Gruppe'), S3('stufe', 'Stufe', ['1', '2', '3'], 'Stufe')], f: p => DGR[p[0]][p[1]],
      hot: [
        { id: 'gruppe', name: 'Knopf Gruppe A/B/C', text: 'Der Knopf wählt eine der drei Gruppen (Zeilen der Tafel). Nur bei stehender Spindel drehen; wenn es hakt, die Spindel von Hand ein Stück weiterdrehen.' },
        { id: 'stufe', name: 'Knopf Stufe', text: 'Der zweite Knopf wählt die Stufe innerhalb der Gruppe (Spalte der Tafel). Gruppe und Stufe zusammen ergeben eine der neun Drehzahlen.' },
        { id: 'tafel', name: 'Drehzahltafel', text: 'Die Tafel nennt neun Drehzahlen in min⁻¹: Gruppe A 60, 95, 145; Gruppe B 225, 355, 535; Gruppe C 835, 1320, 2000.' },
        { id: 'futter', name: 'Dreibackenfutter', text: 'Das Dreibackenfutter spannt runde und sechskantige Werkstücke von selbst zentrisch. Die Spannbacken nur mit dem Schlüssel verstellen, den Schlüssel danach abziehen.' },
        { id: 'stahlhalter', name: 'Stahlhalter', text: 'Der Stahlhalter hält den Drehmeißel. Der Meißel steht auf Mitte und möglichst kurz eingespannt.' },
        { id: 'support', name: 'Support', text: 'Der Support mit Bett-, Plan- und Oberschlitten trägt den Stahlhalter. Handräder und Selbstgang bewegen ihn.' },
        { id: 'reitstock', name: 'Reitstock', text: 'Der Reitstock mit Pinole und Handrad stützt lange Werkstücke oder hält Bohrer und Körner. Klemmung nach dem Verschieben anziehen.' },
        { id: 'leitspindel', name: 'Leit- und Zugspindel', text: 'Die Leitspindel (Gewinde) dient dem Gewindedrehen, die Zugspindel (glatt) dem Längs- und Plan-Selbstgang. Beide laufen unter dem Support am Bett.' },
        { id: 'notaus', name: 'Not-Aus', text: 'Der rote Pilz am Schaltkasten stoppt die Maschine sofort. Nur in Gefahr benutzen, nicht zum normalen Ausschalten.' },
        { id: 'bett', name: 'Bett', text: 'Das Bett trägt alle beweglichen Teile. Späne und Werkzeug haben dort nichts zu suchen.' }
      ]
    },
    bfr: {
      id: 'bfr', abbr: 'BF', name: 'Bohr-Fräsmaschine', kind: 'fraes', blurb: 'Kleine Bohr-Fräsmaschine mit Spindeldrehzahlen in Stufe L oder H, drei Gängen und zwei Motorstufen, Rundtisch, Digitalanzeige und Späneabsaugung.',
      sel: [S3('bereich', 'Bereich', ['L', 'H']), S3('gang', 'Hebel', ['1', '2', '3']), S3('motor', 'Motorstufe', ['Stufe 1', 'Stufe 2'])], f: p => BFR[['L', 'H'][p[0]]][p[2]][p[1]],
      hot: [
        { id: 'tafel', name: 'Tafel Spindeldrehzahl', text: 'Zwölf Drehzahlen: Bereich L oder H, Hebelstellung 1 bis 3 und Motorstufe 1 oder 2. Beispiel: Bereich H, Hebel 2, Stufe 2 gibt 2000 min⁻¹.' },
        { id: 'bereich', name: 'Hebel L/H', text: 'Der Hebel schaltet das Getriebe zwischen niedrigem (L) und hohem (H) Bereich. Vorher Motor und Hauptspindel ausschalten, wie auf der Maschine steht.' },
        { id: 'gang', name: 'Hebel 1/2/3', text: 'Dieser Hebel wählt die Getriebestufe 1, 2 oder 3. Auch er wird nur im Stillstand verstellt.' },
        { id: 'bedienfeld', name: 'Bedienfeld', text: 'Tasten für Stop und Power, Bohren, Gewindeschneiden, Fräsen, Start/Stop sowie Up und Down (Pinole) und der Not-Aus.' },
        { id: 'notaus', name: 'Not-Aus', text: 'Der große rote Pilztaster am Bedienfeld stoppt die Maschine sofort. Erst Ursache klären, dann entriegeln und neu starten.' },
        { id: 'anzeige', name: 'Digitalanzeige', text: 'Die Anzeigen zeigen die Positionen der Achsen (X, Y, Z) und helfen beim Anfahren von Maßen. Beim Nullsetzen auf den richtigen Bezugspunkt achten.' },
        { id: 'spindel', name: 'Frässpindel', text: 'Die Spindel trägt Fräser oder Bohrer. Sie wird durch die Pinole abgesenkt. Werkzeug nur bei stehender Spindel wechseln.' },
        { id: 'rundtisch', name: 'Rundtisch', text: 'Der Rundtisch dreht das Werkstück in Winkelschritten, etwa für Bohrbilder auf dem Kreis. Fest spannen und klemmen.' },
        { id: 'absaugung', name: 'Späneabsaugung', text: 'Der Schlauch saugt Späne und Staub am Werkzeug ab. Bei staubenden Werkstoffen wie Hartgewebe und Kunststoff ist die Absaugung Pflicht.' }
      ]
    },
    frd: {
      id: 'frd', abbr: 'FM-D', name: 'Fräsmaschine mit Digitalanzeige', kind: 'fraes', blurb: 'Senkrechte Fräsmaschine mit sechs Spindeldrehzahlen (145 bis 2900), Digitalanzeige für X und Y, Handrädern und Kühlmittelschlauch.',
      sel: [S3('gruppe', 'Gruppe', ['1', '2'], 'Gruppe'), S3('stufe', 'Stufe', ['1', '2', '3'], 'Stufe')], f: p => FRD[p[0]][p[1]],
      hot: [
        { id: 'tafel', name: 'Drehzahlschild', text: 'Sechs Drehzahlen in min⁻¹: 145, 290, 580, 725, 1450 und 2900. Zwei Hebel am Kopf legen die Stufe fest.' },
        { id: 'gruppe', name: 'Hebel Gruppe', text: 'Der Hebel schaltet zwischen den beiden Gruppen (niedrig und hoch). Nur bei stehender Spindel.' },
        { id: 'stufe', name: 'Hebel Stufe', text: 'Der zweite Hebel wählt die Stufe innerhalb der Gruppe. Gruppe und Stufe zusammen ergeben die Drehzahl.' },
        { id: 'anzeige', name: 'Digitalanzeige X/Y', text: 'Die beiden Anzeigen zeigen die Tischposition in X und Y. Der Nullpunkt wird am Werkstück gesetzt, die Maße der Zeichnung beziehen sich darauf.' },
        { id: 'handrad', name: 'Handräder', text: 'Mit den Handrädern werden Tisch (längs, quer) und Höhe bewegt. Bei Maßen immer von einer Seite an die Position fahren (Umkehrspiel).' },
        { id: 'tisch', name: 'Frästisch mit T-Nuten', text: 'Der Tisch hat T-Nuten für Pratzen und Schraubstock. Fräsen übt große Kräfte aus: besonders fest spannen.' },
        { id: 'spindel', name: 'Frässpindel', text: 'Die Spindel nimmt Fräser über Aufnahme oder Futter. Der Fräser läuft gegen die Vorschubrichtung (Gegenlauf) oder mit ihr (Gleichlauf).' },
        { id: 'kuehl', name: 'Kühlmittelschlauch', text: 'Der flexible Schlauch bringt Kühlschmierstoff an die Schneide. Er wird so gerichtet, dass er nicht mit dem Fräser kollidiert.' }
      ]
    },
    srv: {
      id: 'srv', abbr: 'SF', name: 'Servo-Fräsmaschine', kind: 'fraes', none: 'Die Spindeldrehzahl wird über die Steuerung eingestellt; ein Zahlenfeld stand auf dem Foto nicht zur Verfügung.',
      /* PRUEFEN P13: Servo-Fräsmaschine (Servoantrieb, Schutz, Spannpratzen auf dem Tisch): Drehzahlen, Verfahrwege und Bedienung der Steuerung sind nicht im Lab, nur Bauteile und Sicherheit. Soll die Maschine mit Tafel und CNC-Bedienung ergänzt werden? */
      blurb: 'Fräsmaschine mit Servoantrieb in den Achsen, durchsichtigem Schutz um die Spindel und Spannpratzen auf dem Tisch.',
      hot: [
        { id: 'schutz', name: 'Schutz', text: 'Der durchsichtige Schutz hält Späne und Kühlmittel zurück und verhindert den Griff in den Fräser. Er bleibt beim Fräsen geschlossen.' },
        { id: 'spindel', name: 'Frässpindel mit Fräser', text: 'Die Spindel trägt den Fräser. Die Drehzahl hängt vom Fräserdurchmesser und Werkstoff ab: n = vc · 1000 / (π · d).' },
        { id: 'pratzen', name: 'Spannpratzen', text: 'Die Pratzen drücken das Werkstück auf den Tisch. Jede Pratze hat einen Stützbock; die Schraube sitzt nahe am Werkstück.' },
        { id: 'tisch', name: 'Tisch mit T-Nuten', text: 'Der Tisch führt das Werkstück in X und Y. Die T-Nuten nehmen Nutensteine für die Pratzenschrauben auf.' },
        { id: 'antrieb', name: 'Servoantrieb', text: 'Servomotoren bewegen die Achsen genau und regelbar. Der Antrieb wird über die Steuerung bedient, nicht mit Handrädern.' },
        { id: 'kuehl', name: 'Kühlmittelschlauch', text: 'Der Kühlmittelschlauch bringt Kühlschmierstoff zur Schneide. Spritzschutz und Absaugung nutzen.' }
      ]
    },
    cncf: {
      id: 'cncf', abbr: 'CNC', name: 'CNC-Fräsmaschine', kind: 'cnc', none: 'Die Drehzahl steht im Programm (S-Wort); sie wird nicht an einer Tafel gewählt.',
      blurb: 'CNC-Fräsmaschine mit Schutzhaube und Türen, Palette mit Spannelementen und Handbediengerät. Gesteuert wird sie über das Bedienfeld.',
      hot: [
        { id: 'haube', name: 'Schutzhaube', text: 'Die Haube hält Späne, Kühlmittel und Teile zurück. Die Maschine fährt nur bei geschlossener Haube im Automatikbetrieb; Verriegelungen nie überbrücken.' },
        { id: 'spindel', name: 'Frässpindel', text: 'Die Spindel trägt das Werkzeug. Drehzahl und Vorschub stehen im Programm (S und F). Werkzeugwechsel nach Anleitung.' },
        { id: 'palette', name: 'Palette mit Aufspannung', text: 'Auf der Palette sitzen Werkstück und Spannelemente. Die Palette wird außerhalb der Maschine gerüstet, damit die Maschine weiterarbeiten kann.' },
        { id: 'spanner', name: 'Spannelemente', text: 'Kniehebelspanner und Spannleisten halten das Werkstück. Vor dem Start prüfen: fest, richtige Lage, nichts im Verfahrweg.' },
        { id: 'handbedien', name: 'Handbediengerät', text: 'Am Handgerät fährst du die Achsen von Hand (Einrichten). Es hat eigene Tasten und einen Handradaufsatz.' },
        { id: 'notaus', name: 'Not-Aus am Handgerät', text: 'Der rote Pilz am Handbediengerät stoppt alle Bewegungen. Er muss jederzeit erreichbar sein, auch beim Einrichten.' }
      ]
    }
  };
  /* PRUEFEN P26: Maschinenbezeichnungen und Abkürzungen (TB-1, TB-2, TB-A, SB-A, SB-B, VBS, DM-S, DM-G, BF, FM-D, SF, CNC) sind neutral und frei gewählt, ohne Hersteller und Werkstatt-Nummern. Welche Bezeichnungen oder Inventarnummern sollen stattdessen stehen? */
  /* PRUEFEN P29: Zuordnung der 15 Fotos: Das zweite Foto einer Fräsmaschine mit Digitalanzeige und Kühlmittelschlauch hat keine lesbare Drehzahltafel und ist in „Fräsmaschine mit Digitalanzeige“ (FM-D, Tafel vom ersten Foto) aufgegangen; das Foto der CNC-Fräsmaschine mit Haube und das Foto des Bedienfelds gehören zur selben Maschine (CNC). Stimmt die Zuordnung, oder sind es zwei verschiedene Fräsmaschinen? */
  const MACHINE_IDS = ['tb1', 'tb2', 'tba', 'sbA', 'sbB', 'vbs', 'dsl', 'dgr', 'bfr', 'frd', 'srv', 'cncf'];
  const machine = id => MACHINES[id] || null;
  const hasTable = m => !!(m && m.sel && m.f);
  const isCont = m => !!(m && m.cont);
  const picksAll = m => { let out = [[]]; m.sel.forEach(s => { const n = []; out.forEach(p => s.opts.forEach((_, i) => n.push(p.concat(i)))); out = n; }); return out; };
  /* alle Stufen einer Tafel-Maschine: [{ n, p }] sortiert nach Drehzahl */
  const stages = m => (hasTable(m) ? picksAll(m).map(p => ({ n: m.f(p), p })).sort((a, b) => a.n - b.n || a.p.join().localeCompare(b.p.join())) : []);
  const series = m => stages(m).map(s => s.n);
  const speedAt = (m, p) => (hasTable(m) && Array.isArray(p) && p.length === m.sel.length && p.every((v, i) => Number.isInteger(v) && v >= 0 && v < m.sel[i].opts.length) ? m.f(p) : NAN);
  const pickLabel = (m, p) => m.sel.map((s, i) => s.label + ' ' + s.opts[p[i]]).join(', ');
  const pickFor = (m, n) => { const s = stages(m).find(x => x.n === n); return s ? s.p : null; };
  /* Tafel als Gitter: Zeilen, Spalten, Werte (zwei Hebel: Zeile = erster, Spalte = zweiter; drei Hebel: Zeile = Bereich × Gang, Spalte = Motorstufe) */
  function gridOf(m) {
    if (!hasTable(m)) return null;
    if (m.sel.length === 2) {
      const rows = m.sel[0].opts.map((o, i) => ({ label: m.sel[0].label + ' ' + o, short: o, pick: [i] })), cols = m.sel[1].opts.map((o, j) => ({ label: o, pick: [j] }));
      return { rows, cols, vals: m.sel[0].opts.map((_, i) => m.sel[1].opts.map((__, j) => m.f([i, j]))), cell: p => [p[0], p[1]] };
    }
    const rows = [], vals = [];
    m.sel[0].opts.forEach((a, i) => m.sel[1].opts.forEach((b, j) => { rows.push({ label: a + '-' + b, short: a + '-' + b, pick: [i, j] }); vals.push(m.sel[2].opts.map((_, k) => m.f([i, j, k]))); }));
    return { rows, cols: m.sel[2].opts.map((o, k) => ({ label: o, pick: [k] })), vals, cell: p => [p[0] * m.sel[1].opts.length + p[1], p[2]] };
  }
  /* Stufenwahl der Maschine zu einer Solldrehzahl.
     Tafel: nächstkleinere Stufe (P16); zu hoch, wenn selbst die kleinste Stufe darüber liegt; zu niedrig, wenn die größte Stufe noch unter dem Sollwert liegt.
     Stufenlos: Bereich, der den Sollwert enthält (bei Überschneidung die niedrige Reihe); außerhalb auf die Grenze gesetzt. */
  function stageFor(m, nSoll) {
    if (!m || !pos(nSoll)) return null;
    if (hasTable(m)) {
      const st = stages(m), low = st[0], pk = st.filter(s => s.n <= nSoll + 1e-9).pop();
      if (!pk) return { n: low.n, p: low.p, status: 'zuhoch', cont: false };
      if (nSoll > st[st.length - 1].n + 1e-9) return { n: pk.n, p: pk.p, status: 'zuniedrig', cont: false };
      return { n: pk.n, p: pk.p, status: pk.n === nSoll ? 'exakt' : 'ok', cont: false };
    }
    if (isCont(m) && fin(m.cont.ranges[0].lo)) {
      const rs = m.cont.ranges, lo = Math.min.apply(null, rs.map(r => r.lo)), hi = Math.max.apply(null, rs.map(r => r.hi));
      if (nSoll < lo) return { n: lo, range: rs[0].id, status: 'zuniedrig', cont: true };
      if (nSoll > hi) return { n: hi, range: rs[rs.length - 1].id, status: 'zuhoch', cont: true };
      const r = rs.find(x => nSoll >= x.lo - 1e-9 && nSoll <= x.hi + 1e-9);
      return { n: nSoll, range: r.id, status: 'ok', cont: true };
    }
    return null;
  }
  /* Welche Drehzahlreihe der stufenlosen Drehmaschine liefert n (Überschneidung: beide) */
  const rangesFor = (m, n) => (isCont(m) && fin(m.cont.ranges[0].lo) ? m.cont.ranges.filter(r => n >= r.lo - 1e-9 && n <= r.hi + 1e-9).map(r => r.id) : []);
  /* Relative Drehgeschwindigkeit 0..1 für die Bewegung der Zeichnung (logarithmisch, nicht maßstäblich) */
  const spinRel = (m, n) => { if (!fin(n) || n <= 0) return 0; const lo = Math.log(30), hi = Math.log(3200); return Math.max(0.05, Math.min(1, (Math.log(Math.max(n, 30)) - lo) / (hi - lo))); };

  /* ============================================================ CNC-Bedienfeld (Modell) */
  /* PRUEFEN P21: Tasten des Bedienfelds und ihre Aufgaben (nach dem Foto der Steuerung): Betriebsarten MANUAL, AUTO, SINGLE, TEACH IN; Achstasten −X +X −Y +Y −Z +Z; Schrittweite 1, 10, 100, 1000; Vorschub-Override 0 %, 100 %, kleiner, größer; Start, Stop, Rücksetzen; NOT-AUS, MACHINE ON, CLAMPING ROTARY TABLE, MEMORY LOCK. Passen die Erklärungen zu eurer Steuerung (v. a. TEACH IN, Rücksetzen, Schrittweite in µm)? */
  const KEYS = {
    manual: { l: 'MANUAL', g: 'Betriebsart', t: 'Handbetrieb: Die Achsen werden mit den Achstasten (oder dem Handrad) von Hand verfahren. Hier richtest du die Maschine ein.' },
    auto: { l: 'AUTO', g: 'Betriebsart', t: 'Automatikbetrieb: Das Programm läuft nach Start Satz für Satz selbstständig durch. Nur mit geschlossener Schutzhaube und geprüftem Programm.' },
    single: { l: 'SINGLE', g: 'Betriebsart', t: 'Einzelsatz: Nach jedem Satz hält die Maschine an, mit Start wird der nächste Satz ausgeführt. Ideal zum ersten Probelauf.' },
    teach: { l: 'TEACH IN', g: 'Betriebsart', t: 'Teach-in: Positionen werden von Hand angefahren und in das Programm übernommen. So entsteht ein Programm ohne Zahleneingabe.' },
    xm: { l: '−X', g: 'Achse', t: 'Fährt die X-Achse in negative Richtung, solange die Taste gedrückt ist (nur in MANUAL).' },
    xp: { l: '+X', g: 'Achse', t: 'Fährt die X-Achse in positive Richtung (nur in MANUAL).' },
    ym: { l: '−Y', g: 'Achse', t: 'Fährt die Y-Achse in negative Richtung (nur in MANUAL).' },
    yp: { l: '+Y', g: 'Achse', t: 'Fährt die Y-Achse in positive Richtung (nur in MANUAL).' },
    zm: { l: '−Z', g: 'Achse', t: 'Fährt die Z-Achse nach unten, also zum Werkstück hin. Vorsicht: Kollisionsgefahr, immer das Werkzeug beobachten.' },
    zp: { l: '+Z', g: 'Achse', t: 'Fährt die Z-Achse nach oben, vom Werkstück weg. Erst Z nach oben, dann in X und Y verfahren.' },
    s1: { l: '1', g: 'Schrittweite', t: 'Kleinste Schrittweite (im Modell 1 µm = 0,001 mm je Tastendruck) für feines Anfahren.' },
    s10: { l: '10', g: 'Schrittweite', t: 'Schrittweite 10 (im Modell 0,01 mm je Tastendruck).' },
    s100: { l: '100', g: 'Schrittweite', t: 'Schrittweite 100 (im Modell 0,1 mm je Tastendruck).' },
    s1000: { l: '1000', g: 'Schrittweite', t: 'Größte Schrittweite (im Modell 1 mm je Tastendruck) für grobes Verfahren.' },
    ovr0: { l: '0 %', g: 'Override', t: 'Setzt den Vorschub-Override auf 0 %: Die Maschine verfährt nicht, das Programm bleibt aber stehen und kann fortgesetzt werden.' },
    ovr100: { l: '100 %', g: 'Override', t: 'Setzt den Vorschub-Override auf 100 %: Es gilt der programmierte Vorschub F.' },
    ovrmin: { l: '− %', g: 'Override', t: 'Verringert den Vorschub-Override schrittweise (im Modell um 10 Prozentpunkte). Ist = F · Override / 100.' },
    ovrplus: { l: '+ %', g: 'Override', t: 'Erhöht den Vorschub-Override schrittweise (im Modell um 10, höchstens 120 %).' },
    start: { l: 'START', g: 'Ablauf', t: 'Startet das Programm (AUTO) oder führt den nächsten Satz aus (SINGLE). Vorher prüfen: Haube zu, Werkstück gespannt, Nullpunkt gesetzt.' },
    stop: { l: 'STOP', g: 'Ablauf', t: 'Hält den Programmablauf an. Das ist kein Not-Aus: Spindel und Maschine bleiben eingeschaltet.' },
    reset: { l: 'RESET', g: 'Ablauf', t: 'Setzt das Programm auf den Anfang zurück und beendet den Ablauf. Danach beginnt ein neuer Lauf mit dem ersten Satz.' },
    notaus: { l: 'NOT-AUS', g: 'Sicherheit', t: 'Roter Pilztaster: stoppt sofort alle Bewegungen und schaltet die Maschine ab. Erst Ursache beseitigen, dann entriegeln und die Maschine wieder einschalten.' },
    mason: { l: 'MACHINE ON', g: 'Sicherheit', t: 'Schaltet die Maschine (Antriebe, Hydraulik) ein, wenn der Not-Aus entriegelt ist. Danach in der Regel Referenzfahrt.' },
    klemm: { l: 'CLAMPING ROTARY TABLE', g: 'Funktion', t: 'Klemmt den Rundtisch oder löst die Klemmung. Vor dem Fräsen klemmen, vor dem Drehen des Tisches lösen.' },
    memlock: { l: 'MEMORY LOCK', g: 'Sicherheit', t: 'Sperrt den Programmspeicher gegen versehentliches Ändern oder Löschen. Zum Bearbeiten des Programms entsperren.' }
  };
  const KEY_ORDER = ['auto', 'single', 'manual', 'teach', 'start', 'stop', 'xm', 'xp', 'ym', 'yp', 'zm', 'zp', 's1', 's10', 's100', 's1000', 'ovr0', 'ovr100', 'ovrmin', 'ovrplus', 'reset', 'notaus', 'mason', 'klemm', 'memlock'];
  /* Satz lesen: Wörter (Buchstabe + Zahl) zerlegen und erklären. G/M-Funktionen, die nicht in der Tabelle stehen, gelten als steuerungsabhängig (siehe Handbuch). */
  /* PRUEFEN P22: Programmsatz-Beispiele nach der Norm (G0 Eilgang, G1 Linear mit Vorschub, G90 Absolut, G91 Kettenmaß, M3/M5 Spindel, M30 Programmende, M8/M9 Kühlmittel, T Werkzeug, S Drehzahl, F Vorschub). Auf dem Foto stehen „N1 G18 T10 M66 / N2 G52 / N3 G0 X5 Y100 Z50“: G18 (Ebene), M66 und G52 sind steuerungsabhängig und werden nicht erklärt. Welche G/M-Funktionen kennt eure Steuerung, und sollen sie ergänzt werden? */
  const GM = { G0: 'Eilgang: schnellste Bewegung ohne Bearbeitung, nur im freien Raum', G1: 'Geradeninterpolation: Bearbeitung auf einer Geraden mit Vorschub F', G90: 'Maße absolut (vom Nullpunkt aus)', G91: 'Maße als Kettenmaß (vom letzten Punkt aus)', M3: 'Spindel ein, Rechtslauf', M5: 'Spindel aus', M8: 'Kühlmittel ein', M9: 'Kühlmittel aus', M30: 'Programmende, Rücksprung zum Anfang' };
  function parseBlock(str) {
    const out = [], re = /([NGMTSFXYZ])\s*(-?\d+(?:[.,]\d+)?)/gi; let m;
    while ((m = re.exec(String(str == null ? '' : str)))) {
      const L = m[1].toUpperCase(), v = parseFloat(m[2].replace(',', '.')), w = L + (L === 'G' || L === 'M' ? String(Math.round(v)) : String(v)), o = { w, L, v };
      if (L === 'N') o.t = 'Satznummer ' + v; else if (L === 'T') o.t = 'Werkzeug Nummer ' + v; else if (L === 'S') o.t = 'Spindeldrehzahl ' + fmtN(v, 0) + ' min⁻¹'; else if (L === 'F') o.t = 'Vorschub ' + fmtN(v, 3) + ' (mm/min bzw. mm/U nach Einstellung)';
      else if ('XYZ'.indexOf(L) >= 0) o.t = 'Zielposition ' + L + ' = ' + fmtN(v, 3) + ' mm'; else o.t = GM[w] || 'steuerungsabhängig, siehe Handbuch der Maschine';
      o.known = L === 'N' || 'TSFXYZ'.indexOf(L) >= 0 || !!GM[w]; out.push(o);
    }
    return out;
  }
  /* Zielposition eines Satzes aus den Koordinatenwörtern (fehlende bleiben wie bisher) */
  const targetOf = (str, from) => { const p = Object.assign({ x: 0, y: 0, z: 0 }, from || {}); parseBlock(str).forEach(o => { if ('XYZ'.indexOf(o.L) >= 0) p[o.L.toLowerCase()] = o.v; }); return p; };
  const restweg = (soll, ist) => (num(soll) === soll && num(ist) === ist ? soll - ist : NAN);
  const overrideFeed = (F, pct) => (num(F) >= 0 && num(pct) >= 0 ? F * pct / 100 : NAN);
  const PROG0 = ['N1 G90 G0 X0 Y0 Z50', 'N2 G0 X20 Y30 Z5', 'N3 G1 Z-3 F200', 'N4 G0 Z50', 'N5 M30'];
  const cncNew = () => ({ on: false, estop: false, mode: 'MANUAL', step: 1, ovr: 100, run: false, blk: 0, pos: { x: 0, y: 0, z: 50 }, clamp: false, lock: false, prog: PROG0.slice() });
  /* Bedienung des Modells: Taste → neuer Zustand und Meldung (reine Funktion, ändert den übergebenen Zustand nicht) */
  const STEPS = { s1: 0.001, s10: 0.01, s100: 0.1, s1000: 1 };
  function cncPress(st, key) {
    const s = JSON.parse(JSON.stringify(st)); let msg = '';
    if (!KEYS[key]) return { st: s, msg: 'Unbekannte Taste.' };
    if (key === 'notaus') {
      if (!s.estop) { s.estop = true; s.on = false; s.run = false; msg = 'NOT-AUS ausgelöst: alle Bewegungen gestoppt, Maschine aus. Erst Ursache beseitigen, dann Not-Aus entriegeln (nochmal drücken im Modell) und MACHINE ON.'; }
      else { s.estop = false; msg = 'Not-Aus entriegelt. Die Maschine ist noch aus: MACHINE ON drücken.'; }
      return { st: s, msg };
    }
    if (s.estop) return { st: s, msg: 'Not-Aus ist gedrückt. Erst entriegeln, dann MACHINE ON.' };
    if (key === 'mason') { s.on = true; msg = 'Maschine eingeschaltet.'; return { st: s, msg }; }
    if (key === 'memlock') { s.lock = !s.lock; return { st: s, msg: s.lock ? 'Programmspeicher gesperrt.' : 'Programmspeicher freigegeben.' }; }
    if (!s.on) return { st: s, msg: 'Die Maschine ist aus. Erst MACHINE ON drücken.' };
    if (key === 'klemm') { s.clamp = !s.clamp; return { st: s, msg: s.clamp ? 'Rundtisch geklemmt.' : 'Rundtisch gelöst.' }; }
    if (key === 'manual' || key === 'auto' || key === 'single' || key === 'teach') { s.mode = KEYS[key].l; s.run = false; return { st: s, msg: 'Betriebsart ' + s.mode + '.' }; }
    if (STEPS[key] != null) { s.step = STEPS[key]; return { st: s, msg: 'Schrittweite ' + fmtN(s.step, 3) + ' mm.' }; }
    /* PRUEFEN P23: Vorschub-Override: Tasten 0 %, 100 %, kleiner und größer; im Modell Schritte von 10 Prozentpunkten und höchstens 120 %. Auf dem Foto steht „F-OVR 80 %“. Gilt bei eurer Steuerung dieser Bereich und diese Schrittweite? */
    if (key === 'ovr0') { s.ovr = 0; return { st: s, msg: 'Override 0 %: kein Vorschub.' }; }
    if (key === 'ovr100') { s.ovr = 100; return { st: s, msg: 'Override 100 %.' }; }
    if (key === 'ovrmin') { s.ovr = Math.max(0, s.ovr - 10); return { st: s, msg: 'Override ' + s.ovr + ' %.' }; }
    if (key === 'ovrplus') { s.ovr = Math.min(120, s.ovr + 10); return { st: s, msg: 'Override ' + s.ovr + ' %.' }; }
    if ('xm xp ym yp zm zp'.indexOf(key) >= 0) {
      if (s.mode !== 'MANUAL') return { st: s, msg: 'Die Achstasten wirken nur in MANUAL.' };
      const ax = key[0], dir = key[1] === 'p' ? 1 : -1; s.pos[ax] = rd(s.pos[ax] + dir * s.step, 3); return { st: s, msg: ax.toUpperCase() + ' = ' + fmtN(s.pos[ax], 3) + ' mm.' };
    }
    if (key === 'stop') { s.run = false; return { st: s, msg: 'Programm angehalten (STOP).' }; }
    if (key === 'reset') { s.run = false; s.blk = 0; return { st: s, msg: 'Programm auf den ersten Satz zurückgesetzt.' }; }
    if (key === 'start') {
      if (s.mode !== 'AUTO' && s.mode !== 'SINGLE') return { st: s, msg: 'START wirkt nur in AUTO oder SINGLE.' };
      if (s.blk >= s.prog.length) return { st: s, msg: 'Programmende erreicht: RESET drücken.' };
      const last = s.mode === 'SINGLE' ? s.blk + 1 : s.prog.length;
      for (let i = s.blk; i < last; i++) s.pos = targetOf(s.prog[i], s.pos);
      s.blk = last; s.run = s.mode === 'AUTO' && s.blk < s.prog.length; return { st: s, msg: s.mode === 'SINGLE' ? 'Ein Satz ausgeführt.' : 'Programm abgearbeitet.' };
    }
    return { st: s, msg: '' };
  }

  /* ============================================================ Zusatzdaten für Aufgaben */
  const api = {
    fin, rd, num, parseDe, fmtDe, fmtN, hashStr, rng, ri, pick, shuffle,
    nFromVc, vcFromN, dFromVcN, vfOf, timeMin, millTimeMin, lowerStage, nearestStage, stagesInWindow,
    GRUPPEN, VC_TAB, PROCS, vcWindow, vcStatus, FEED_BOHR, feedWindow, FEED_SBA,
    MACHINES, MACHINE_IDS, machine, hasTable, isCont, picksAll, stages, series, speedAt, pickLabel, pickFor, gridOf, stageFor, rangesFor, spinRel,
    KEYS, KEY_ORDER, GM, parseBlock, targetOf, restweg, overrideFeed, PROG0, cncNew, cncPress, STEPS
  };
  root.MAK_CORE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
