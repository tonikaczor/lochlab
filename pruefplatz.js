/* Tonfunk SimLab: Prüfplatz nach DIN VDE 0701 (nach Instandsetzung) und DIN VDE 0702 (wiederkehrend) zur Prüfungsvorbereitung.
   Prüflinge mit versteckten Mängeln, Prüfablauf mit simulierten Messwerten, Auswertung nach den Grenzwerten, Prüfprotokoll zum Drucken und Prüfungsfragen.
   Die Grenzwerte stehen unten in LIM; bei Normänderungen nur dort anpassen. */
(function () {
'use strict';
const UI = window.LabUI; if (!UI) return;
const { sheet, esc, toast, userName } = UI;

/* ---------- Grenzwerte ---------- */
const LIM = {
  pe: len => (len <= 5 ? 0.3 : Math.min(1, 0.3 + 0.1 * Math.ceil((len - 5) / 7.5))),            // Ω: 0,3 Ω bis 5 m, je weitere 7,5 m +0,1 Ω, höchstens 1 Ω
  iso: d => (d.sk === 1 ? (d.heater && d.pw >= 3500 ? 0.3 : 1) : d.sk === 2 ? 2 : 0.25),          // MΩ
  ab: d => (d.sk === 1 ? (d.heater && d.pw >= 3500 ? Math.min(10, d.pw / 1000) : 3.5) : 0.5),     // mA
};
const SK_TXT = { 1: 'Schutzklasse I (Schutzleiter)', 2: 'Schutzklasse II (Schutzisolierung, Symbol: Doppelquadrat)', 3: 'Schutzklasse III (Schutzkleinspannung)' };
const VIS_ITEMS = ['Gehäuse', 'Anschlussleitung und Stecker', 'Zugentlastung und Knickschutz', 'Schalter und Bedienelemente', 'Lüftungsöffnungen und Verschmutzung', 'Kennzeichnung (Typenschild)'];
const ok6 = ['Unbeschädigt, fest verschraubt.', 'Mantel, Adern und Stecker unbeschädigt.', 'Zugentlastung sitzt fest.', 'Funktionieren, nichts locker.', 'Frei und sauber.', 'Lesbar, Leistung und Spannung stehen darauf.'];
const mk = (over) => { const v = ok6.map(t => [t, false]); Object.entries(over || {}).forEach(([i, t]) => { v[+i] = [t, true]; }); return v; };

/* ---------- Prüflinge ---------- */
const DEVS = [
  { id: 'bohr', name: 'Schlagbohrmaschine 750 W', sk: 1, pw: 750, len: 3, heater: false, vis: mk(), pe: 0.14, iso: 25, ab: 1.2, func: ['Läuft ruhig, Drehzahlregelung funktioniert.', true] },
  { id: 'kocher', name: 'Wasserkocher 2200 W', sk: 1, pw: 2200, len: 1, heater: true, vis: mk(), pe: 0.09, iso: 0.6, ab: 1.4, func: ['Heizt, schaltet selbstständig ab.', true] },
  { id: 'fön', name: 'Haartrockner 1800 W', sk: 2, pw: 1800, len: 2, heater: true, vis: mk(), pe: null, iso: 1.4, ab: 0.2, func: ['Beide Stufen laufen.', true] },
  { id: 'trommel', name: 'Kabeltrommel 25 m', sk: 1, pw: 0, len: 25, heater: false, vis: mk(), pe: 0.62, iso: 12, ab: 0.1, func: ['Alle Steckdosen führen Spannung, Schutzkontakt vorhanden.', true] },
  { id: 'verl', name: 'Verlängerungskabel 10 m', sk: 1, pw: 0, len: 10, heater: false, vis: mk(), pe: 0.33, iso: 40, ab: 0.1, func: ['Durchgang an allen Adern.', true] },
  { id: 'steh', name: 'Stehlampe 60 W', sk: 2, pw: 60, len: 1.8, heater: false, vis: mk({ 1: 'Mantel der Anschlussleitung ist eingeschnitten, die blaue Ader ist sichtbar.' }), pe: null, iso: 9, ab: 0.05, func: ['Leuchtet.', true] },
  { id: 'hlüfter', name: 'Heizlüfter 2000 W', sk: 1, pw: 2000, len: 2, heater: true, vis: mk(), pe: 1.8, iso: 3.1, ab: 2.2, func: ['Heizt und lüftet.', true] },
  { id: 'lader', name: 'Handy-Ladegerät 10 W', sk: 2, pw: 10, len: 1.5, heater: false, vis: mk(), pe: null, iso: 8, ab: 0.7, func: ['Lädt.', true] },
  { id: 'kuma', name: 'Küchenmaschine 1000 W', sk: 1, pw: 1000, len: 1.5, heater: false, vis: mk(), pe: 0.11, iso: 6, ab: 4.1, func: ['Alle Drehzahlen funktionieren.', true] },
  { id: 'sauger', name: 'Staubsauger 1400 W', sk: 2, pw: 1400, len: 6, heater: false, vis: mk(), pe: null, iso: 5.5, ab: 0.2, func: ['Saugt, Kabelaufrollung funktioniert.', true] },
  { id: 'gebl', name: 'Heißluftgebläse 3600 W (Baustelle)', sk: 1, pw: 3600, len: 3, heater: true, vis: mk(), pe: 0.2, iso: 0.5, ab: 3.4, func: ['Heizt in beiden Stufen.', true] },
  { id: 'bügel', name: 'Bügeleisen 2400 W', sk: 1, pw: 2400, len: 2, heater: true, vis: mk({ 1: 'Der Stecker hat ein gebrochenes Gehäuse, der Schutzkontakt wackelt.' }), pe: 0.15, iso: 2.5, ab: 3.0, func: ['Heizt, Thermostat schaltet.', true] },
  { id: 'radio', name: 'Küchenradio', sk: 2, pw: 25, len: 1.2, heater: false, vis: mk(), pe: null, iso: 7, ab: 0.2, func: ['Das Gerät brummt laut, das Netzteil riecht verbrannt.', false] },
  { id: 'led', name: 'Schreibtischlampe (LED) 12 W', sk: 2, pw: 12, len: 1.6, heater: false, vis: mk(), pe: null, iso: 15, ab: 0.1, func: ['Dimmen funktioniert.', true] },
  { id: 'tisch', name: 'Tischlüfter', sk: 1, pw: 40, len: 1.5, heater: false, vis: mk(), pe: 99, iso: 20, ab: 0.4, func: ['Dreht in allen Stufen.', true] },
  { id: 'spielz', name: 'Spielzeug-Transformator 12 V', sk: 3, pw: 30, len: 1.5, heater: false, vis: mk(), pe: null, iso: 4, ab: 0.1, func: ['Gibt 12 V aus.', true] },
];
const fmt = (v, dec) => String(+v.toFixed(dec == null ? 2 : dec)).replace('.', ',');
function evalDev(d) {
  const r = { vis: d.vis.map(([t, bad], i) => ({ item: VIS_ITEMS[i], text: t, ok: !bad })) };
  r.visOk = r.vis.every(x => x.ok);
  r.peLim = LIM.pe(d.len); r.peOk = d.sk === 1 ? d.pe <= r.peLim : null;
  r.isoLim = LIM.iso(d); r.isoOk = d.iso >= r.isoLim;
  r.abLim = LIM.ab(d); r.abOk = d.sk === 3 ? null : d.ab <= r.abLim;
  r.funcOk = d.func[1];
  r.pass = r.visOk && r.peOk !== false && r.isoOk && r.abOk !== false && r.funcOk;
  return r;
}

/* ---------- Prüfungsfragen ---------- */
const Q = [
  ['Welche Norm gilt für die Prüfung elektrischer Geräte nach Instandsetzung, bevor sie wieder benutzt werden?', ['DIN VDE 0100-600', 'DIN VDE 0701', 'DIN VDE 0702', 'DIN VDE 0105-100'], 1, 'DIN VDE 0701 gilt nach Instandsetzung und Änderung. DIN VDE 0702 gilt für die wiederkehrende Prüfung. DIN VDE 0100-600 ist die Erstprüfung von Anlagen.'],
  ['Welche Norm gilt für die wiederkehrende Prüfung ortsveränderlicher elektrischer Geräte?', ['DIN VDE 0701', 'DIN VDE 0702', 'DIN VDE 0113', 'DIN VDE 0298'], 1, 'DIN VDE 0702 regelt die Prüfung in festgelegten Fristen (zum Beispiel jährlich oder alle 6 Monate, je nach Einsatz).'],
  ['In welcher Reihenfolge wird geprüft?', ['Messen, Sichtprüfung, Funktionsprüfung', 'Sichtprüfung, Messen, Funktionsprüfung', 'Funktionsprüfung, Sichtprüfung, Messen', 'Messen, Funktionsprüfung, Sichtprüfung'], 1, 'Zuerst die Sichtprüfung (Mängel sofort erkennen), dann die Messungen, zuletzt die Funktionsprüfung am Netz. Eine beschädigte Leitung gehört nicht an Spannung.'],
  ['Welcher Grenzwert gilt für den Schutzleiterwiderstand bei einer Anschlussleitung bis 5 m?', ['0,1 Ω', '0,3 Ω', '1 Ω', '3,5 Ω'], 1, 'Bis 5 m Leitungslänge höchstens 0,3 Ω. Für jede weiteren 7,5 m kommen 0,1 Ω dazu, insgesamt höchstens 1 Ω.'],
  ['Eine Kabeltrommel hat 25 m Leitung. Wie hoch darf der Schutzleiterwiderstand höchstens sein?', ['0,3 Ω', '0,4 Ω', '0,6 Ω', '1,0 Ω'], 2, '0,3 Ω + 0,1 Ω für jede angefangenen weiteren 7,5 m: 25 m − 5 m = 20 m, das sind 3 Schritte, also 0,3 + 0,3 = 0,6 Ω.'],
  ['Mit welcher Prüfspannung wird der Isolationswiderstand gemessen?', ['230 V AC', '500 V DC', '24 V DC', '1000 V AC'], 1, 'Die Isolationsmessung erfolgt mit 500 V Gleichspannung (bei Schutzklasse III mit 250 V).'],
  ['Welchen Isolationswiderstand muss ein Gerät der Schutzklasse I (ohne große Heizleistung) mindestens haben?', ['0,25 MΩ', '0,3 MΩ', '1 MΩ', '2 MΩ'], 2, 'Schutzklasse I: mindestens 1 MΩ.'],
  ['Welchen Isolationswiderstand muss ein Gerät der Schutzklasse II mindestens haben?', ['0,25 MΩ', '1 MΩ', '2 MΩ', '5 MΩ'], 2, 'Schutzklasse II: mindestens 2 MΩ.'],
  ['Welchen Isolationswiderstand muss ein Gerät der Schutzklasse III (Kleinspannung) mindestens haben?', ['0,25 MΩ', '1 MΩ', '2 MΩ', '10 MΩ'], 0, 'Schutzklasse III: mindestens 0,25 MΩ, gemessen mit 250 V.'],
  ['Für Geräte der Schutzklasse I mit Heizelementen ab 3,5 kW darf der Isolationswiderstand niedriger sein. Wie niedrig?', ['0,1 MΩ', '0,3 MΩ', '0,5 MΩ', '1 MΩ'], 1, 'Bei Schutzklasse I mit Heizelementen (Gesamtleistung ab 3,5 kW) genügen 0,3 MΩ.'],
  ['Wie hoch darf der Schutzleiterstrom bei einem Gerät der Schutzklasse I höchstens sein?', ['0,5 mA', '3,5 mA', '10 mA', '30 mA'], 1, 'Schutzleiterstrom (und Ersatz-Ableitstrom) bei Schutzklasse I: höchstens 3,5 mA. Mit Heizelementen ab 3,5 kW gilt 1 mA je kW, höchstens 10 mA.'],
  ['Wie hoch darf der Berührungsstrom bei einem Gerät der Schutzklasse II höchstens sein?', ['0,25 mA', '0,5 mA', '3,5 mA', '5 mA'], 1, 'Berührungsstrom bei Schutzklasse II: höchstens 0,5 mA.'],
  ['Wie wird der Schutzleiterwiderstand gemessen?', ['Zwischen Außenleiter und Neutralleiter', 'Zwischen Schutzkontakt des Steckers und berührbaren leitfähigen Gehäuseteilen, dabei die Leitung bewegen', 'Zwischen Gehäuse und Fußboden', 'Nur im eingeschalteten Zustand'], 1, 'Von den Schutzkontakten des Steckers zu allen berührbaren leitfähigen Teilen. Dabei die Anschlussleitung bewegen, um Wackelkontakte zu finden.'],
  ['Mit welchem Prüfstrom wird der Schutzleiterwiderstand mindestens gemessen?', ['20 mA', '50 mA', '200 mA', '1 A'], 2, 'Der Prüfstrom beträgt mindestens 200 mA, die Leerlaufspannung 4 V bis 24 V.'],
  ['Was passiert mit einem Gerät, das die Prüfung nicht besteht?', ['Es bekommt trotzdem die Plakette', 'Es wird gekennzeichnet und gesperrt, bis der Mangel behoben ist', 'Es darf nur im Freien benutzt werden', 'Es wird nur im Protokoll vermerkt'], 1, 'Nicht bestandene Geräte werden deutlich gekennzeichnet („nicht benutzen“) und gesperrt, bis sie repariert und neu geprüft sind.'],
  ['Wer darf Prüfungen nach DIN VDE 0701/0702 durchführen?', ['Jeder', 'Eine Elektrofachkraft (oder eine elektrotechnisch unterwiesene Person unter deren Leitung und Aufsicht)', 'Nur der Hersteller', 'Nur der TÜV'], 1, 'Die Prüfung führt eine Elektrofachkraft durch. Unterwiesene Personen dürfen nur unter Leitung und Aufsicht einer Elektrofachkraft mit geeigneten Prüfgeräten prüfen.'],
  ['Woran erkennt man ein Gerät der Schutzklasse II?', ['Am Erdungssymbol', 'Am Symbol mit zwei ineinander liegenden Quadraten', 'Am dreipoligen Stecker', 'An einem roten Gehäuse'], 1, 'Das Doppelquadrat kennzeichnet Schutzisolierung. Der Stecker hat dann keinen Schutzkontakt (Eurostecker).'],
  ['Was gehört in das Prüfprotokoll?', ['Nur „bestanden“', 'Prüfer, Datum, Gerät, Messwerte, Ergebnis und Prüfverfahren', 'Nur der Name des Geräts', 'Nur die Seriennummer'], 1, 'Das Protokoll dokumentiert Prüfer, Datum, Gerät, Prüfverfahren, Messwerte und das Ergebnis nachvollziehbar.'],
  ['Warum steht die Funktionsprüfung am Ende?', ['Sie ist unwichtig', 'Damit ein Gerät mit Mängeln nicht unter Spannung gesetzt wird', 'Weil sie am längsten dauert', 'Weil der Prüfer dann müde ist'], 1, 'Erst wenn Sichtprüfung und Messungen bestanden sind, darf das Gerät am Netz betrieben werden.'],
  ['Bei einer Erstprüfung einer Anlage nach DIN VDE 0100-600: Welche Reihenfolge gilt?', ['Messen, Erproben, Besichtigen', 'Besichtigen, Erproben, Messen', 'Erproben, Messen, Besichtigen', 'Messen, Besichtigen, Erproben'], 1, 'Besichtigen, Erproben und Messen. Zuerst schauen, dann funktionell erproben, zuletzt messen.'],
  ['Wie hoch ist der Mindest-Isolationswiderstand bei Anlagen bis 500 V Nennspannung nach DIN VDE 0100-600?', ['0,25 MΩ', '0,5 MΩ', '1 MΩ', '10 MΩ'], 2, 'Bei Nennspannung bis 500 V: Prüfspannung 500 V DC, Mindestwert 1 MΩ.'],
  ['Ein Stromkreis ist mit B16 abgesichert. Welche Schleifenimpedanz darf höchstens gemessen werden (230 V, Auslösestrom 5 · In)?', ['0,5 Ω', '1,5 Ω', '2,9 Ω', '10 Ω'], 2, 'Zs ≤ U0 / Ia = 230 V / (5 · 16 A) = 2,875 Ω, also gerundet 2,9 Ω. Ist Zs kleiner, löst der Automat im Fehlerfall schnell genug aus.'],
  ['Wie schnell muss ein FI (RCD) mit Bemessungsdifferenzstrom bei dem Prüfstrom IΔn auslösen?', ['Innerhalb 1 ms', 'Innerhalb 300 ms', 'Innerhalb 5 s', 'Gar nicht'], 1, 'Bei IΔn muss der FI innerhalb von 300 ms auslösen, bei 5 · IΔn innerhalb von 40 ms. Die Berührungsspannung darf dabei höchstens 50 V betragen.'],
];

/* ---------- Zustand und Oberfläche ---------- */
const ST = { mode: '0702', dev: null, step: 0, ans: {}, meas: {}, help: false, qs: null, qi: 0, qok: 0 };
const store = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const who = () => (typeof userName === 'function' ? userName() : '');
const STEPS = ['Prüfling', 'Sichtprüfung', 'Schutzleiter', 'Isolation', 'Ableitstrom', 'Funktion', 'Ergebnis'];
let body = null;
const css = `
.pp .st{display:flex;gap:4px;margin:0 0 10px;flex-wrap:wrap}.pp .st span{padding:3px 8px;border-radius:99px;background:var(--panel2,#2c343e);font-size:12px;color:var(--mute,#8d99a6)}.pp .st .on{background:var(--accent,#3b9eff);color:#fff}.pp .st .dn{color:#4cd964}
.pp .box{border:1px solid var(--line,#38424d);border-radius:10px;padding:10px 12px;margin:8px 0}.pp .big{font:700 22px/1.2 monospace}
.pp .r{display:flex;gap:8px;margin:6px 0;align-items:center;flex-wrap:wrap}.pp .r label{display:inline-flex;gap:6px;align-items:center;padding:7px 12px;border:1px solid var(--line,#38424d);border-radius:9px;cursor:pointer}
.pp .r input:checked+span{font-weight:700}.pp .ok{color:#4cd964}.pp .no{color:#ff6a5a}.pp small,.pp .mu{color:var(--mute,#8d99a6)}
.pp .btns{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}.pp .btns button{height:42px;padding:0 16px;border-radius:11px;background:var(--panel2,#2c343e);border:1px solid var(--line,#38424d);font-weight:600}.pp .btns .pri{background:var(--accent,#3b9eff);border-color:var(--accent,#3b9eff);color:#fff}
.pp table{width:100%;border-collapse:collapse;font-size:13px}.pp td,.pp th{padding:4px 6px;border-bottom:1px solid var(--line,#38424d);text-align:left}
#ppPrint{display:none}@media print{body.ppPrinting>*:not(#ppPrint){display:none!important}body.ppPrinting #ppPrint{display:block;background:#fff;color:#111;font:12px/1.45 sans-serif;padding:10mm}#ppPrint table{border-collapse:collapse;width:100%}#ppPrint td,#ppPrint th{border:1px solid #888;padding:3px 6px;text-align:left}#ppPrint h2{margin:0 0 4mm}}`;
(function () { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); })();

function open() {
  sheet('Prüfplatz nach DIN VDE 0701 / 0702', (b, close) => { body = b; b.classList.add('pp'); b.dataset.close = '1'; ST.close = close; render(); });
}
const stepBar = () => `<div class="st">${STEPS.map((s, i) => `<span class="${i === ST.step ? 'on' : (i < ST.step ? 'dn' : '')}">${i + 1}. ${s}</span>`).join('')}</div>`;
function radios(name, cur) { return `<div class="r"><label><input type="radio" name="${name}" value="ok" ${cur === 'ok' ? 'checked' : ''}><span>✓ In Ordnung</span></label><label><input type="radio" name="${name}" value="bad" ${cur === 'bad' ? 'checked' : ''}><span>✗ Mangel</span></label></div>`; }
function render() {
  if (!body) return;
  if (ST.view === 'quiz') return renderQuiz();
  const d = ST.dev;
  if (!d) {
    body.innerHTML = `<p style="margin-top:0">Hier übst du die Prüfung ortsveränderlicher Geräte wie in der Prüfung: Sichtprüfung, Schutzleiterwiderstand, Isolationswiderstand, Ableitstrom, Funktionsprüfung, Protokoll. Jedes Gerät hat versteckte Mängel. Du entscheidest bei jedem Schritt, ob der Wert in Ordnung ist.</p>
      <div class="box"><b>Prüfart</b><div class="r"><label><input type="radio" name="md" value="0701" ${ST.mode === '0701' ? 'checked' : ''}><span>DIN VDE 0701 · nach Instandsetzung</span></label><label><input type="radio" name="md" value="0702" ${ST.mode === '0702' ? 'checked' : ''}><span>DIN VDE 0702 · wiederkehrend</span></label></div><small>Der Ablauf und die Grenzwerte sind gleich. Bei 0701 war das Gerät in Reparatur, bei 0702 ist es im Einsatz.</small></div>
      <div class="btns"><button class="pri" data-a="rnd">🎲 Zufälliges Gerät</button><button data-a="quiz">❓ Prüfungsfragen</button><button data-a="hist">📋 Bisherige Ergebnisse</button></div>
      <p class="mu" style="margin-bottom:4px">oder ein bestimmtes Gerät wählen:</p><div class="btns" style="margin-top:0">${DEVS.map((x, i) => `<button data-a="dev" data-i="${i}">${esc(x.name)}</button>`).join('')}</div>`;
  } else if (ST.step === 0) {
    body.innerHTML = stepBar() + `<div class="box"><b>${esc(d.name)}</b><br>${esc(SK_TXT[d.sk])}<br>Nennleistung ${d.pw} W · Anschlussleitung ${fmt(d.len, 1)} m${d.heater ? ' · mit Heizelementen' : ''}<br><small>${ST.mode === '0701' ? 'Das Gerät wurde repariert und soll wieder in Betrieb gehen.' : 'Das Gerät ist im Einsatz und wird turnusmäßig geprüft.'}</small></div>
      <p class="mu">Prüfe in dieser Reihenfolge: Sichtprüfung → Schutzleiterwiderstand (nur Schutzklasse I) → Isolationswiderstand → Ableitstrom → Funktionsprüfung. Bei jedem Schritt entscheidest du, ob er bestanden ist.</p>
      <label class="mu" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-a="help" ${ST.help ? 'checked' : ''}> Grenzwerte als Hilfe einblenden (nicht in der Prüfung)</label>
      <div class="btns"><button class="pri" data-a="next">Prüfung beginnen</button><button data-a="back">Anderes Gerät</button></div>`;
  } else if (ST.step === 1) {
    const ev = evalDev(d);
    body.innerHTML = stepBar() + `<p style="margin-top:0"><b>Sichtprüfung</b>: Schau dir das Gerät genau an. Jede Zeile beschreibt, was du siehst.</p>` + ev.vis.map((v, i) => `<div class="box"><b>${esc(v.item)}</b><br>${esc(v.text)}${radios('v' + i, (ST.ans.vis || {})[i])}</div>`).join('') + `<div class="btns"><button class="pri" data-a="next">Weiter</button></div>`;
  } else if (ST.step === 2) {
    if (d.sk !== 1) { body.innerHTML = stepBar() + `<div class="box"><b>Schutzleiterwiderstand</b><br>Das Gerät hat keinen Schutzleiter (${d.sk === 2 ? 'Schutzklasse II' : 'Schutzklasse III'}). Dieser Schritt entfällt.</div><div class="btns"><button class="pri" data-a="next">Weiter</button></div>`; }
    else { const m = ST.meas.pe; body.innerHTML = stepBar() + `<p style="margin-top:0"><b>Schutzleiterwiderstand</b>: Messung zwischen dem Schutzkontakt des Steckers und dem berührbaren Metallteil, die Leitung wird dabei bewegt. Prüfstrom 200 mA.</p><div class="box"><div class="big">${m == null ? '– – –' : (d.pe >= 10 ? '> 10 Ω' : fmt(d.pe, 2) + ' Ω')}</div>${ST.help ? `<small>Grenzwert für ${fmt(d.len, 1)} m Leitung: ${fmt(LIM.pe(d.len), 1)} Ω</small>` : ''}</div><div class="btns"><button data-a="meas" data-k="pe">${m == null ? 'Messen' : 'Nochmal messen'}</button></div>${m != null ? '<p><b>Ist der Wert in Ordnung?</b></p>' + radios('pe', (ST.ans.pe)) + '<div class="btns"><button class="pri" data-a="next">Weiter</button></div>' : ''}`; }
  } else if (ST.step === 3) {
    const m = ST.meas.iso; body.innerHTML = stepBar() + `<p style="margin-top:0"><b>Isolationswiderstand</b>: Prüfspannung ${d.sk === 3 ? '250 V' : '500 V'} DC, Schalter des Geräts eingeschaltet, Netzstecker gezogen.</p><div class="box"><div class="big">${m == null ? '– – –' : fmt(d.iso, d.iso < 1 ? 2 : 1) + ' MΩ'}</div>${ST.help ? `<small>Grenzwert: mindestens ${fmt(LIM.iso(d), 2)} MΩ</small>` : ''}</div><div class="btns"><button data-a="meas" data-k="iso">${m == null ? 'Messen' : 'Nochmal messen'}</button></div>${m != null ? '<p><b>Ist der Wert in Ordnung?</b></p>' + radios('iso', ST.ans.iso) + '<div class="btns"><button class="pri" data-a="next">Weiter</button></div>' : ''}`;
  } else if (ST.step === 4) {
    if (d.sk === 3) { body.innerHTML = stepBar() + `<div class="box"><b>Ableitstrom</b><br>Bei Schutzklasse III (Schutzkleinspannung) wird kein Ableitstrom gemessen. Der Schritt entfällt.</div><div class="btns"><button class="pri" data-a="next">Weiter</button></div>`; }
    else { const m = ST.meas.ab, nm = d.sk === 1 ? 'Schutzleiterstrom' : 'Berührungsstrom'; body.innerHTML = stepBar() + `<p style="margin-top:0"><b>${nm}</b> (Ersatz-Ableitstrom-Messung): ${d.sk === 1 ? 'Strom über den Schutzleiter' : 'Strom über berührbare leitfähige Teile'}.</p><div class="box"><div class="big">${m == null ? '– – –' : fmt(d.ab, 2) + ' mA'}</div>${ST.help ? `<small>Grenzwert: höchstens ${fmt(LIM.ab(d), 1)} mA</small>` : ''}</div><div class="btns"><button data-a="meas" data-k="ab">${m == null ? 'Messen' : 'Nochmal messen'}</button></div>${m != null ? '<p><b>Ist der Wert in Ordnung?</b></p>' + radios('ab', ST.ans.ab) + '<div class="btns"><button class="pri" data-a="next">Weiter</button></div>' : ''}`; }
  } else if (ST.step === 5) {
    body.innerHTML = stepBar() + `<p style="margin-top:0"><b>Funktionsprüfung</b>: Das Gerät ist am Netz angeschlossen und wird eingeschaltet.</p><div class="box">${esc(d.func[0])}${radios('func', ST.ans.func)}</div><div class="btns"><button class="pri" data-a="next">Weiter</button></div>`;
  } else { renderResult(); }
}
function renderResult() {
  const d = ST.dev, ev = evalDev(d), a = ST.ans, scoreLines = [];
  const chk = (label, user, truth, note) => scoreLines.push({ label, user, truth, ok: truth == null ? true : (user === (truth ? 'ok' : 'bad')), note });
  const visUser = Object.keys(a.vis || {}).length === 6 ? (Object.values(a.vis).some(v => v === 'bad') ? 'bad' : 'ok') : 'ok';
  chk('Sichtprüfung', visUser, ev.visOk, ev.visOk ? 'Keine Mängel.' : 'Mangel: ' + ev.vis.filter(x => !x.ok).map(x => x.item + ' (' + x.text + ')').join('; '));
  if (d.sk === 1) chk('Schutzleiterwiderstand', a.pe, ev.peOk, `${d.pe >= 10 ? '> 10 Ω' : fmt(d.pe, 2) + ' Ω'} bei Grenzwert ${fmt(ev.peLim, 1)} Ω (${fmt(d.len, 1)} m Leitung: 0,3 Ω bis 5 m, +0,1 Ω je weitere 7,5 m, höchstens 1 Ω).`);
  chk('Isolationswiderstand', a.iso, ev.isoOk, `${fmt(d.iso, d.iso < 1 ? 2 : 1)} MΩ bei Grenzwert mindestens ${fmt(ev.isoLim, 2)} MΩ (${d.sk === 1 ? (d.heater && d.pw >= 3500 ? 'Schutzklasse I mit Heizleistung ab 3,5 kW: 0,3 MΩ' : 'Schutzklasse I: 1 MΩ') : d.sk === 2 ? 'Schutzklasse II: 2 MΩ' : 'Schutzklasse III: 0,25 MΩ'}).`);
  if (d.sk !== 3) chk(d.sk === 1 ? 'Schutzleiterstrom' : 'Berührungsstrom', a.ab, ev.abOk, `${fmt(d.ab, 2)} mA bei Grenzwert höchstens ${fmt(ev.abLim, 1)} mA.`);
  chk('Funktionsprüfung', a.func, ev.funcOk, ev.funcOk ? 'Funktion in Ordnung.' : d.func[0]);
  const right = scoreLines.filter(l => l.ok).length, fin = ST.fin, finOk = fin != null && ((fin === 'pass') === ev.pass);
  const total = scoreLines.length + 1, pts = right + (finOk ? 1 : 0), pct = Math.round(100 * pts / total);
  body.innerHTML = stepBar() + (fin == null
    ? `<p style="margin-top:0"><b>Gesamtergebnis</b>: Wie lautet dein Urteil für das Gerät?</p><div class="r"><label><input type="radio" name="fin" value="pass"><span>✓ Bestanden: Prüfplakette</span></label><label><input type="radio" name="fin" value="fail"><span>✗ Nicht bestanden: sperren</span></label></div><div class="btns"><button class="pri" data-a="finish">Auswerten</button></div>`
    : `<div class="box"><div class="big ${pct === 100 ? 'ok' : 'no'}">${pct} % richtig</div><b>${esc(d.name)}</b>: ${ev.pass ? 'bestanden' : 'nicht bestanden'}. Dein Urteil: ${fin === 'pass' ? 'bestanden' : 'nicht bestanden'} ${finOk ? '✓' : '✗'}</div>
    <table>${scoreLines.map(l => `<tr><td>${l.ok ? '<span class="ok">✓</span>' : '<span class="no">✗</span>'}</td><td><b>${l.label}</b><br><small>${esc(l.note)}</small></td></tr>`).join('')}</table>
    <div class="btns"><button class="pri" data-a="proto">🖨 Prüfprotokoll drucken</button><button data-a="rnd">Nächstes Gerät</button><button data-a="back">Geräteauswahl</button></div>`);
  if (fin != null && !ST.saved) { ST.saved = true; const h = store('sim.pp') || []; h.push({ t: Date.now(), name: who(), dev: d.name, mode: ST.mode, pct }); store('sim.pp', h.slice(-60)); }
  ST.last = { scoreLines, ev, pct };
}
function protocolHtml() {
  const d = ST.dev, ev = evalDev(d), a = ST.ans;
  const row = (t, v, l, ok) => `<tr><td>${t}</td><td>${v}</td><td>${l}</td><td>${ok == null ? '–' : (ok ? 'bestanden' : 'nicht bestanden')}</td></tr>`;
  return `<h2>Prüfprotokoll nach DIN VDE ${ST.mode}</h2><p>Prüfer: ${esc(who() || '______________')} · Datum: ${new Date().toLocaleDateString('de-DE')} · Prüfart: ${ST.mode === '0701' ? 'nach Instandsetzung' : 'wiederkehrende Prüfung'}</p>
  <table><tr><th>Gerät</th><td>${esc(d.name)}</td><th>Schutzklasse</th><td>${d.sk}</td></tr><tr><th>Nennleistung</th><td>${d.pw} W</td><th>Anschlussleitung</th><td>${fmt(d.len, 1)} m</td></tr></table>
  <table style="margin-top:4mm"><tr><th>Prüfung</th><th>Messwert / Befund</th><th>Grenzwert</th><th>Ergebnis</th></tr>
  ${row('Sichtprüfung', ev.visOk ? 'ohne Mängel' : esc(ev.vis.filter(x => !x.ok).map(x => x.item + ': ' + x.text).join('; ')), 'keine Mängel', ev.visOk)}
  ${d.sk === 1 ? row('Schutzleiterwiderstand', d.pe >= 10 ? '> 10 Ω' : fmt(d.pe, 2) + ' Ω', '≤ ' + fmt(ev.peLim, 1) + ' Ω', ev.peOk) : ''}
  ${row('Isolationswiderstand', fmt(d.iso, d.iso < 1 ? 2 : 1) + ' MΩ', '≥ ' + fmt(ev.isoLim, 2) + ' MΩ', ev.isoOk)}
  ${d.sk !== 3 ? row(d.sk === 1 ? 'Schutzleiterstrom' : 'Berührungsstrom', fmt(d.ab, 2) + ' mA', '≤ ' + fmt(ev.abLim, 1) + ' mA', ev.abOk) : ''}
  ${row('Funktionsprüfung', esc(d.func[0]), 'Funktion in Ordnung', ev.funcOk)}</table>
  <p style="margin-top:6mm"><b>Gesamtergebnis: ${ev.pass ? 'bestanden, Prüfplakette' : 'NICHT bestanden, Gerät sperren und kennzeichnen'}</b></p><p style="margin-top:12mm">Unterschrift: ______________________</p>`;
}
function printProto() {
  let p = document.getElementById('ppPrint'); if (!p) { p = document.createElement('div'); p.id = 'ppPrint'; document.body.appendChild(p); }
  p.innerHTML = protocolHtml(); document.body.classList.add('ppPrinting');
  const done = () => { document.body.classList.remove('ppPrinting'); window.removeEventListener('afterprint', done); }; window.addEventListener('afterprint', done); setTimeout(() => window.print(), 50);
}
function renderQuiz() {
  if (!ST.qs) { ST.qs = Q.map((q, i) => i).sort(() => Math.random() - 0.5).slice(0, 10); ST.qi = 0; ST.qok = 0; ST.qans = null; }
  if (ST.qi >= ST.qs.length) { body.innerHTML = `<div class="box"><div class="big ${ST.qok >= 8 ? 'ok' : 'no'}">${ST.qok} von ${ST.qs.length} richtig</div><p>${ST.qok >= 8 ? 'Sehr gut, das sitzt.' : 'Wiederhole die Grenzwerte und versuche es nochmal.'}</p></div><div class="btns"><button class="pri" data-a="quiz2">Neue Runde</button><button data-a="back">Zurück</button></div>`; const h = store('sim.ppq') || []; if (!ST.qsaved) { ST.qsaved = true; h.push({ t: Date.now(), name: who(), ok: ST.qok, of: ST.qs.length }); store('sim.ppq', h.slice(-40)); } return; }
  const q = Q[ST.qs[ST.qi]], A = ST.qans;
  body.innerHTML = `<p class="mu" style="margin-top:0">Frage ${ST.qi + 1} von ${ST.qs.length}</p><p><b>${esc(q[0])}</b></p>` + q[1].map((o, i) => `<button class="row" data-a="qa" data-i="${i}" style="${A != null ? (i === q[2] ? 'color:#4cd964;font-weight:700' : (i === A ? 'color:#ff6a5a' : '')) : ''}"><div class="grow">${esc(o)}</div></button>`).join('') + (A != null ? `<div class="box"><b>${A === q[2] ? '✓ Richtig' : '✗ Leider falsch'}</b><br>${esc(q[3])}</div><div class="btns"><button class="pri" data-a="qn">${ST.qi + 1 >= ST.qs.length ? 'Ergebnis' : 'Nächste Frage'}</button></div>` : '') + `<div class="btns"><button data-a="back">Beenden</button></div>`;
}
function history() {
  const h = (store('sim.pp') || []).slice().reverse(), q = (store('sim.ppq') || []).slice().reverse();
  body.innerHTML = `<p style="margin-top:0"><b>Prüfungen von Geräten</b></p>` + (h.length ? `<table>${h.map(x => `<tr><td>${new Date(x.t).toLocaleDateString('de-DE')}</td><td>${esc(x.dev)}</td><td>${x.mode}</td><td>${x.pct} %</td></tr>`).join('')}</table>` : '<p class="mu">Noch keine Prüfung.</p>') + `<p><b>Prüfungsfragen</b></p>` + (q.length ? `<table>${q.map(x => `<tr><td>${new Date(x.t).toLocaleDateString('de-DE')}</td><td>${x.ok} von ${x.of} richtig</td></tr>`).join('')}</table>` : '<p class="mu">Noch keine Runde.</p>') + `<div class="btns"><button class="pri" data-a="back">Zurück</button></div>`;
}
function newDev(d) { ST.dev = d; ST.step = 0; ST.ans = {}; ST.meas = {}; ST.fin = null; ST.saved = false; ST.view = null; }
function collect() {                                                                                    // Auswahl der Schaltflächen des aktuellen Schritts übernehmen
  body.querySelectorAll('input[type=radio]').forEach(r => { if (!r.checked) return; const n = r.name; if (/^v\d$/.test(n)) { (ST.ans.vis = ST.ans.vis || {})[+n.slice(1)] = r.value; } else if (n === 'md') ST.mode = r.value; else if (n === 'fin') ST.fin = r.value; else ST.ans[n] = r.value; });
}
function onClick(e) {
  const t = e.target.closest('[data-a]'); if (!t) return; const a = t.dataset.a; collect();
  if (a === 'rnd') { newDev(DEVS[Math.floor(Math.random() * DEVS.length)]); }
  else if (a === 'dev') newDev(DEVS[+t.dataset.i]);
  else if (a === 'back') { ST.dev = null; ST.view = null; ST.qs = null; }
  else if (a === 'quiz' || a === 'quiz2') { ST.view = 'quiz'; ST.qs = null; ST.qsaved = false; }
  else if (a === 'qa') { if (ST.qans == null) { ST.qans = +t.dataset.i; if (ST.qans === Q[ST.qs[ST.qi]][2]) ST.qok++; } }
  else if (a === 'qn') { ST.qi++; ST.qans = null; }
  else if (a === 'hist') { history(); return; }
  else if (a === 'help') ST.help = t.checked;
  else if (a === 'meas') { ST.meas[t.dataset.k] = 1; }
  else if (a === 'next') {
    if (ST.step === 1 && Object.keys(ST.ans.vis || {}).length < 6) { toast('Bitte jede Zeile der Sichtprüfung bewerten'); return; }
    const need = { 2: 'pe', 3: 'iso', 4: 'ab', 5: 'func' }[ST.step];
    if (need && !(ST.step === 2 && ST.dev.sk !== 1) && !(ST.step === 4 && ST.dev.sk === 3) && !ST.ans[need]) { toast('Bitte beurteilen: in Ordnung oder Mangel'); return; }
    ST.step++;
  }
  else if (a === 'finish') { if (!ST.fin) { toast('Bitte ein Gesamturteil wählen'); return; } ST.fin = ST.fin; }
  else if (a === 'proto') { printProto(); return; }
  render();
}
function init() { document.addEventListener('click', e => { if (body && body.isConnected && body.contains(e.target)) onClick(e); }); document.addEventListener('change', e => { if (body && body.isConnected && body.contains(e.target) && e.target.dataset && e.target.dataset.a === 'help') onClick(e); }); }
init();
window.Pruefplatz = { open, DEVS, LIM, Q, evalDev };
})();
