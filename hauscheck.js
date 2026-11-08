'use strict';
/* Tonfunk HausLab: Haus-Check.
   Prüft ein Haus-Modell (sch.haus) auf neun Punkte: Leitungsschutz, Spannungsfall, Schleifenimpedanz/Abschaltung, FI,
   Selektivität (vereinfacht), Phasenverteilung, Anschlusswert, Ausstattung (Richtwerte), Plausibilität.
   Verdeckte-Fehler-Prinzip: Der Check nennt, WAS nicht passt und WARUM, aber nicht die fertige Lösung.
   Die reine Prüflogik (run, CHECKS, NORM, AUSSTATTUNG) steht oben und ist per Node testbar (module.exports).
   Die Oberfläche (Sheet, Druck) steht unten und braucht window/document sowie root.HAUS und root.LabUI aus haus.js / schaltplan.js.
   Rechenwerte sind aus elscore.js übernommen (U0, spezifischer Widerstand, Abschaltzeiten, Auslösefaktor B). */
(function (root) {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const num = (x, d) => (isFinite(x) ? x : 0).toFixed(d == null ? 1 : d).replace('.', ',');

  /* ---------------- Normwerte und Richtwerte (alles hier soll ein Ausbilder gegenlesen) ---------------- */
  const NORM = {
    U0: 230,                 // V, TN-System (elscore.js: U0N)
    RHO: 0.0178,             // Ohm mm² / m, Kupfer (elscore.js: RHO_NEU), wie "Leitungen prüfen" mit Reserve je Leitung aus route()
    ZV: 0.4,                 // Ohm, Netzimpedanz am Hausanschluss: Übungswert (elscore.js: ZV_DEF) /* PRUEFEN: Ausbilder gegenlesen */
    T_END: 0.4,              // s, Abschaltzeit Endstromkreis bis 32 A, TN, 230 V (elscore.js: tab_033, belegt)
    T_VERT: 5,               // s, Verteilerstromkreis bzw. Stromkreis über 32 A (elscore.js: tab_5, belegt)
    IA: { B: 5, C: 10 },     // Auslösestrom Ia = Faktor · In; Faktor 5 für B belegt (elscore.js: faktor_b), 10 für C ist Übungswert /* PRUEFEN: Ausbilder gegenlesen */
    ZS_RESERVE: 0.8,         // ab 80 % von Zs_max: Hinweis (Messwert und Erwärmung der Leitung bringen Unsicherheit) /* PRUEFEN: Übungswert */
    DROP_MAX: 3,             // %, wie "Leitungen prüfen" in haus.js
    DROP_WARN: 2.4,          // %, 80 % des Grenzwertes: Hinweis /* PRUEFEN: Übungswert */
    RCD_IDN: '30mA',         // Zusatzschutz bei Steckdosen für Laien (elscore.js: idn_zusatz 30 mA, belegt)
    RCD_MAX_IN: 20,          // A, Steckdosenkreise bis 20 A /* PRUEFEN: Ausbilder gegenlesen */
    SELEK_MIN: 1.6,          // Hauptsicherung mindestens 1,6 · größter Abgangsnennstrom: vereinfachter Faustwert /* PRUEFEN: Ausbilder gegenlesen */
    SCHIEF_HINWEIS: 10,      // A Unterschied zwischen größter und kleinster Phase: Übungswert /* PRUEFEN: Ausbilder gegenlesen */
    SCHIEF_MANGEL: 20,       // A, entspricht etwa 4,6 kVA je Phase (Schieflastgrenze Netzbetreiber, Idee) /* PRUEFEN: Ausbilder gegenlesen */
    GLEICHZ: 0.6,            // Gleichzeitigkeitsfaktor als einfacher Richtwert fürs ganze Haus /* PRUEFEN: Ausbilder gegenlesen */
    AUSLAST_WARN: 0.8,       // ab 80 % Auslastung der Hauptsicherung: Hinweis (Übungswert)
    UB3: 400                 // V, Drehstrom
  };

  /* Ausstattung nach Wohnungsbau-Richtwerten (Idee DIN 18015-2). null = Richtwert nicht sicher bekannt: wird nicht geprüft.
     Die Steckdosen-Mindestzahlen sind absichtlich leer, bis ein Ausbilder sie bestätigt. */
  /* PRUEFEN: Ausbilder gegenlesen */
  const AUSSTATTUNG = {
    wohnen: { n: 'Wohnzimmer', licht: 1, steckdosen: null },
    schlafen: { n: 'Schlafzimmer', licht: 1, steckdosen: null },
    kinder: { n: 'Kinderzimmer', licht: 1, steckdosen: null },
    kueche: { n: 'Küche', licht: 1, steckdosen: null },
    bad: { n: 'Bad', licht: 1, steckdosen: null },
    flur: { n: 'Flur / Diele / Treppenhaus', licht: 1, steckdosen: null },
    hwr: { n: 'Hauswirtschaftsraum', licht: 1, steckdosen: null }
  };
  /* Raumart aus dem Raumnamen */
  const ART = [['kueche', /k(ü|ue)che/i], ['bad', /bad|dusch|wc|toilette/i], ['kinder', /kinder/i], ['schlafen', /schlaf/i], ['wohnen', /wohn|esszimmer|wohnküche/i], ['flur', /flur|diele|treppe|eingang|windfang/i], ['hwr', /hauswirtschaft|hwr|abstell|waschk/i]];
  /* Geräte, die einen eigenen Stromkreis bekommen sollen (Idee DIN 18015-2) */
  const EIGENKREIS = [['Herd / Backofen', /herd|backofen|ofen/i], ['Waschmaschine', /waschmaschine/i], ['Wäschetrockner', /trockner/i], ['Geschirrspüler', /geschirrsp|spülmaschine|spuelmaschine/i]];
  const BAD_RAUM = /bad|dusch|wc|toilette|sauna/i, AUSSEN_RAUM = /außen|aussen|garten|terrasse|balkon|carport|vordach|hof\b/i;

  /* Strombelastbarkeit je Querschnitt (Kopie der Übungstabelle aus simcore.js, Verlegeart B2), nächster Querschnitt */
  const CAB_IZ = [[0.75, 9], [1, 11], [1.5, 16.5], [2.5, 23], [4, 30], [6, 38], [10, 52], [16, 70], [25, 88]];
  function izOf(s) {
    if (root.LochSim && root.LochSim.cableOf) return root.LochSim.cableOf(s + 'mm2 10m').iz;
    let iz = CAB_IZ[0][1], best = 1e9; CAB_IZ.forEach(([a, i]) => { const d = Math.abs(Math.log(a / s)); if (d < best) { best = d; iz = i; } }); return iz;
  }
  const lsParse = ls => { const m = String(ls || '').match(/^([A-Za-z]+)\s*(\d+(?:[.,]\d+)?)/); return m ? { typ: m[1].toUpperCase(), In: parseFloat(m[2].replace(',', '.')) } : null; };
  const RANK = { ok: 0, hinweis: 1, mangel: 2 };
  const worst = d => d.reduce((w, x) => RANK[x.s] > RANK[w] ? x.s : w, 'ok');
  const D = (s, t) => ({ s, t });

  /* ---------------- Gemeinsame Auswertung des Hauses ---------------- */
  function context(h0, deps) {
    const HAUS = deps || root.HAUS; if (!HAUS) throw new Error('HAUS fehlt');
    const h = JSON.parse(JSON.stringify(h0));   // Kopie: calcLines schreibt Hilfswerte in die Leitungen
    h.hak = h.hak || { fuse: '', on: 1 };
    const room = id => h.rooms.find(r => r.id === id), obj = id => h.objs.find(o => o.id === id);
    const oname = o => o.n || (HAUS.TYPES[o.t] ? HAUS.TYPES[o.t].n : o.t);
    const panel = h.objs.find(o => o.t === 'panel');
    const adj = {}; h.cables.forEach(c => { (adj[c.a] = adj[c.a] || []).push(c); (adj[c.b] = adj[c.b] || []).push(c); });
    const other = (c, o) => obj(c.a === o.id ? c.b : c.a);
    const net = HAUS.buildNet(h);
    const calc = panel ? HAUS.calcLines(h) : [];
    /* Stromkreise: Baum ab Verteiler je Abgang, Leitungslängen aus dem Modell */
    const circ = {};
    if (panel) h.cables.filter(c => c.slot != null && (c.a === panel.id || c.b === panel.id)).forEach(c0 => {
      const k = c0.slot, s = h.panel.slots[k] || {}, ci = circ[k] || (circ[k] = { slot: k, ls: s.ls || '', fi: s.fi || 0, p3: !!s.p3, objs: [], rMax: 0, far: '', minS: 99, seen: new Set([panel.id]) });
      const first = other(c0, panel); if (!first || ci.seen.has(first.id)) return;
      const walk = (o, via, R, c) => {
        const r = HAUS.route(h, c); if (!r.ok) return;
        const R2 = R + 2 * NORM.RHO * r.len / c.s; ci.minS = Math.min(ci.minS, c.s);
        ci.seen.add(o.id); ci.objs.push(o); if (R2 > ci.rMax) { ci.rMax = R2; ci.far = oname(o); }
        (adj[o.id] || []).forEach(c2 => { if (c2 === via) return; const q = other(c2, o); if (!q || q.t === 'panel' || ci.seen.has(q.id)) return; walk(q, c2, R2, c2); });
      };
      walk(first, c0, 0, c0);
    });
    const circs = Object.values(circ).sort((a, b) => a.slot - b.slot);
    circs.forEach(ci => { const rs = [...new Set(ci.objs.map(o => (room(o.room) || {}).n).filter(Boolean))]; ci.rooms = rs; ci.name = 'Abgang ' + (ci.slot + 1) + ' (' + (ci.ls || 'ohne Automat') + (rs.length ? ', ' + rs.slice(0, 2).join(' und ') + (rs.length > 2 ? ' u. a.' : '') : '') + ')'; ci.ln = (lsParse(ci.ls) || {}).In || 0; });
    return { h, HAUS, room, obj, oname, panel, adj, other, net, calc, circs };
  }

  /* ---------------- Prüfpunkte ---------------- */
  const CHECKS = [];
  const add = (id, titel, warum, fn) => CHECKS.push({ id, titel, warum, fn });

  add('schutz', 'Leitungsschutz (Überlast)',
    'Ein Leitungsschutzschalter soll die Leitung dahinter schützen: Sein Nennstrom In darf nicht größer sein als die Strombelastbarkeit Iz der dünnsten Leitung im Stromkreis. Sonst fließt dauerhaft ein Strom, den der Automat noch toleriert, die Leitung aber schon zu heiß wird. Außerdem darf der Betriebsstrom aller Verbraucher den Nennstrom nicht übersteigen, sonst löst der Automat im normalen Betrieb aus. Gerechnet wird mit der Übungstabelle für die Belastbarkeit (Verlegeart B2) und den Nennleistungen der eingeschalteten Geräte.',
    c => {
      if (!c.circs.length) return { na: 'Noch keine Leitung vom Verteiler: nichts zu prüfen.' };
      const d = [];
      c.circs.forEach(ci => {
        const row = c.calc.find(r => r.slot === ci.slot), I = row ? row.I : 0, iz = izOf(ci.minS === 99 ? 1.5 : ci.minS);
        if (!ci.ln) d.push(D('mangel', ci.name + ': Die Leitung ist ohne Leitungsschutzschalter angeschlossen. Ein Kurzschluss oder eine Überlast würde nicht abgeschaltet.'));
        else if (ci.ln > iz + 1e-9) d.push(D('mangel', ci.name + ': Der Nennstrom des Automaten (' + num(ci.ln, 0) + ' A) ist größer als die Belastbarkeit der dünnsten Leitung (' + num(ci.minS, 1) + ' mm²: ' + num(iz, 1) + ' A). Der Automat schützt diese Leitung nicht vor Überlast.'));
        else if (I > ci.ln + 1e-9) d.push(D('mangel', ci.name + ': Die eingeschalteten Verbraucher ziehen zusammen ' + num(I, 1) + ' A, der Automat ist für ' + num(ci.ln, 0) + ' A ausgelegt. Der Stromkreis ist überlastet, der Automat löst im Betrieb aus.'));
        else if (I > 0.8 * ci.ln) d.push(D('hinweis', ci.name + ': Auslastung hoch (' + num(I, 1) + ' A von ' + num(ci.ln, 0) + ' A). Wenig Reserve für weitere Geräte.'));
        else d.push(D('ok', ci.name + ': Leitung geschützt (In ' + num(ci.ln, 0) + ' A, Belastbarkeit ' + num(iz, 1) + ' A), Betriebsstrom ' + num(I, 1) + ' A.'));
      });
      return { d };
    });

  add('fall', 'Spannungsfall je Stromkreis',
    'Auf der Leitung geht Spannung verloren: ΔU = 2 · I · ρ · l / A (bei Drehstrom mit Wurzel 3 statt 2). Je länger der Weg, je größer der Strom und je kleiner der Querschnitt, desto mehr. Hier gilt wie bei „Leitungen prüfen“ ein Richtwert von höchstens 3 % von der Zählerseite bis zum letzten Verbraucher; bei zu viel Spannungsfall laufen Geräte schlecht und Motoren erwärmen sich. Die Grenze ist ein Richtwert zum Üben.',
    c => {
      if (!c.calc.length) return { na: 'Noch keine Leitung vom Verteiler: nichts zu prüfen.' };
      const d = [];
      c.calc.forEach(r => {
        const ci = c.circs.find(x => x.slot === r.slot), nm = ci ? ci.name : 'Abgang ' + (r.slot + 1);
        if (r.drop > NORM.DROP_MAX + 1e-9) d.push(D('mangel', nm + ': Spannungsfall ' + num(r.drop, 1) + ' % bis ' + (r.dropAt || 'zum letzten Verbraucher') + ', erlaubt sind höchstens ' + num(NORM.DROP_MAX, 0) + ' %.'));
        else if (r.drop > NORM.DROP_WARN) d.push(D('hinweis', nm + ': Spannungsfall ' + num(r.drop, 1) + ' % bis ' + (r.dropAt || 'zum letzten Verbraucher') + ' liegt dicht an der Grenze von ' + num(NORM.DROP_MAX, 0) + ' %.'));
        else d.push(D('ok', nm + ': Spannungsfall ' + num(r.drop, 1) + ' %.'));
      });
      return { d };
    });

  add('schleife', 'Schleifenimpedanz und Abschaltbedingung',
    'Bei einem Körperschluss fließt der Fehlerstrom über Außenleiter und Schutzleiter zurück. Die Fehlerschleife hat den Widerstand Zs = Zv + R_L + R_PE (Netzimpedanz plus Hin- und Rückleiter). Damit der Automat sicher abschaltet, muss der Fehlerstrom mindestens so groß wie sein Auslösestrom Ia sein: Zs ≤ U0 / Ia (U0 = 230 V). Typ B löst sicher bei 5 · In aus, Typ C bei 10 · In (Übungswert). Im TN-System ist für Endstromkreise bis 32 A eine Abschaltzeit von höchstens 0,4 s gefordert, für Verteilerstromkreise 5 s. Rechenwerte aus dem Lehrmodell; die Netzimpedanz ist ein Übungswert, am echten Hausanschluss wird sie gemessen.',
    c => {
      if (!c.circs.length) return { na: 'Noch keine Leitung vom Verteiler: nichts zu prüfen.' };
      const d = [];
      c.circs.forEach(ci => {
        const p = lsParse(ci.ls);
        if (!p) { d.push(D('hinweis', ci.name + ': Ohne Automat lässt sich die Abschaltbedingung nicht bewerten.')); return; }
        const f = NORM.IA[p.typ]; if (!f) { d.push(D('hinweis', ci.name + ': Auslösecharakteristik ' + p.typ + ' ist im Check nicht hinterlegt.')); return; }
        const ia = f * p.In, zsMax = NORM.U0 / ia, zs = NORM.ZV + ci.rMax, tg = p.In > 32 ? NORM.T_VERT : NORM.T_END;
        const txt = 'Zs = ' + num(zs, 2) + ' Ω am entferntesten Punkt (' + ci.far + '), Zs_max = U0 / Ia = ' + num(zsMax, 2) + ' Ω (Ia = ' + num(ia, 0) + ' A), geforderte Abschaltzeit höchstens ' + num(tg, 1) + ' s.';
        if (zs > zsMax + 1e-9) d.push(D('mangel', ci.name + ': Abschaltbedingung nicht erfüllt. ' + txt + ' Der Fehlerstrom reicht nicht für eine sichere Auslösung in dieser Zeit.'));
        else if (zs > NORM.ZS_RESERVE * zsMax) d.push(D('hinweis', ci.name + ': Abschaltbedingung knapp erfüllt, wenig Reserve. ' + txt));
        else d.push(D('ok', ci.name + ': Abschaltbedingung erfüllt. ' + txt));
      });
      return { d };
    });

  const fiOk = (h, ci) => ci.fi > 0 && h.panel.fi[ci.fi - 1] && h.panel.fi[ci.fi - 1].type === NORM.RCD_IDN;
  add('fi', 'FI/RCD-Schutz (30 mA)',
    'Ein Fehlerstrom-Schutzschalter mit 30 mA Bemessungsdifferenzstrom schützt Menschen als Zusatzschutz: Er schaltet ab, wenn Strom über den Körper zur Erde fließt, lange bevor es gefährlich wird. Die Idee der VDE-0100-Bestimmungen (Teil 410, Schutz gegen elektrischen Schlag): Steckdosenkreise für den allgemeinen Gebrauch bis 20 A und Bereiche mit erhöhter Gefahr wie Bäder und Außenbereich bekommen diesen Zusatzschutz. Ein 300-mA-FI ist ein Brandschutz-FI und schützt Menschen nicht ausreichend. Das ist hier eine Prüfidee; welche Paragraphen und Ausnahmen im Einzelfall gelten, entscheidet die Elektrofachkraft.',
    c => {
      if (!c.circs.length) return { na: 'Noch keine Leitung vom Verteiler: nichts zu prüfen.' };
      const d = []; let n = 0;
      c.circs.forEach(ci => {
        const why = [];
        if (ci.objs.some(o => (o.t === 'sock' || o.t === 'sock3')) && (!ci.ln || ci.ln <= NORM.RCD_MAX_IN)) why.push('Steckdosen');
        if (ci.objs.some(o => { const r = c.room(o.room); return r && BAD_RAUM.test(r.n); }) || ci.objs.some(o => { const r = c.room(o.room); return r && c.h.objs.some(w => w.t === 'wet' && w.room === r.id); })) why.push('Bad');
        if (ci.objs.some(o => { const r = c.room(o.room); return r && AUSSEN_RAUM.test(r.n); })) why.push('Außenbereich');
        if (!why.length) return; n++;
        if (fiOk(c.h, ci)) d.push(D('ok', ci.name + ': Mit 30-mA-FI geschützt (' + why.join(', ') + ').'));
        else if (ci.fi > 0 && c.h.panel.fi[ci.fi - 1] && c.h.panel.fi[ci.fi - 1].type) d.push(D('mangel', ci.name + ': ' + why.join(', ') + ' sind nur über einen FI mit ' + c.h.panel.fi[ci.fi - 1].type.replace('mA', ' mA') + ' geführt. Das ist kein Personenschutz.'));
        else d.push(D('mangel', ci.name + ': ' + why.join(', ') + ' ohne FI-Schutzschalter. Bei einem Körperschluss schützt nur der Leitungsschutz, und der löst Menschen gegenüber zu spät oder gar nicht aus.'));
      });
      if (!n) return { d: [D('ok', 'Kein Stromkreis mit Steckdosen bis 20 A, Bad oder Außenbereich vorhanden.')] };
      return { d };
    });

  add('selektiv', 'Staffelung Hauptsicherung zu Abgängen (vereinfacht)',
    'Selektivität heißt: Bei einem Fehler löst nur das Schutzorgan aus, das dem Fehler am nächsten liegt, und nicht gleich die ganze Anlage. Dafür muss die vorgeschaltete Hauptsicherung deutlich größer sein als die Abgangsautomaten. Echte Selektivität hängt von den Kennlinien und der Durchlassenergie der Geräte ab (Herstellertabellen). Dieser Check ist vereinfacht und vergleicht nur die Nennströme als Plausibilitätsprüfung (Faustwert, nicht belegt).',
    c => {
      const hf = lsParse(c.h.hak.fuse); if (!hf) return { na: 'Keine Hauptsicherung im Haus eingebaut: Staffelung nicht geprüft.' };
      const ab = c.circs.filter(ci => ci.ln); if (!ab.length) return { na: 'Keine Abgangsautomaten verdrahtet: Staffelung nicht geprüft.' };
      const big = ab.reduce((m, ci) => ci.ln > m.ln ? ci : m, ab[0]), q = hf.In / big.ln;
      const t = 'Hauptsicherung ' + c.h.hak.fuse + ', größter Abgang ' + ci_(big) + ' (Verhältnis ' + num(q, 2) + ').';
      if (q <= 1 + 1e-9) return { d: [D('mangel', t + ' Die Hauptsicherung ist nicht größer als der Abgangsautomat: Bei einem Fehler im Abgang kann gleichzeitig die Hauptsicherung auslösen, und das ganze Haus fällt aus.')] };
      if (q < NORM.SELEK_MIN) return { d: [D('hinweis', t + ' Der Abstand ist klein (Richtwert mindestens ' + num(NORM.SELEK_MIN, 1) + '). Es ist fraglich, ob zuerst der Abgangsautomat auslöst. Vereinfachte Prüfung.')] };
      return { d: [D('ok', t + ' Der Abstand reicht für eine plausible Staffelung (vereinfachte Prüfung).')] };
    });
  const ci_ = ci => ci.ls + ' (Abgang ' + (ci.slot + 1) + ')';

  add('phasen', 'Phasenverteilung (Schieflast)',
    'Im Drehstromnetz sollen die drei Außenleiter L1, L2 und L3 möglichst gleichmäßig belastet werden. Hängt fast alles an einer Phase, fließt im Neutralleiter ein Strom, die Phase ist stärker belastet, und der Netzbetreiber begrenzt die Schieflast (Idee: etwa 4,6 kVA Unterschied, das sind rund 20 A). Gerechnet wird mit den Nennleistungen der eingeschalteten Geräte und allen Lampen.',
    c => {
      const L = c.HAUS.houseLoads(c.h), mx = Math.max(...L), mn = Math.min(...L), diff = mx - mn;
      if (mx < 0.05) return { na: 'Keine Last angeschlossen: Phasenverteilung nicht beurteilbar.' };
      const t = 'L1 ' + num(L[0], 1) + ' A, L2 ' + num(L[1], 1) + ' A, L3 ' + num(L[2], 1) + ' A, Unterschied ' + num(diff, 1) + ' A.';
      if (diff > NORM.SCHIEF_MANGEL) return { d: [D('mangel', t + ' Der Unterschied zwischen stärkster und schwächster Phase überschreitet die Schieflastgrenze von ' + num(NORM.SCHIEF_MANGEL, 0) + ' A.')] };
      if (diff > NORM.SCHIEF_HINWEIS) return { d: [D('hinweis', t + ' Die Phasen sind spürbar ungleich belastet (Übungsgrenze ' + num(NORM.SCHIEF_HINWEIS, 0) + ' A).')] };
      return { d: [D('ok', t + ' Gleichmäßig genug verteilt.')] };
    });

  add('anschluss', 'Anschlusswert und Gleichzeitigkeit',
    'Der Anschlusswert ist die Summe aller Nennleistungen im Haus. Weil nie alles gleichzeitig läuft, rechnet man mit einem Gleichzeitigkeitsfaktor g < 1. Der Strom, der dann an der stärksten Phase fließen kann, muss zur Hauptsicherung am Hausanschluss passen. Der Faktor g = 0,6 ist ein einfacher Richtwert für das ganze Haus; echte Planung unterscheidet nach Gerätearten.',
    c => {
      const cl = JSON.parse(JSON.stringify(c.h)); cl.objs.forEach(o => { if (o.t === 'sock' || o.t === 'dev' || o.t === 'sock3' || o.t === 'dev3') o.on = 1; });
      let P = 0; cl.objs.forEach(o => { if (o.t === 'lamp') P += o.w || 60; else if (['sock', 'dev', 'sock3', 'dev3'].includes(o.t)) P += o.w || 0; });
      if (P <= 0) return { na: 'Keine Verbraucher mit Leistung im Haus.' };
      const L = c.HAUS.houseLoads(cl), im = Math.max(...L) * NORM.GLEICHZ, hf = lsParse(c.h.hak.fuse);
      const t = 'Anschlusswert ' + num(P / 1000, 1) + ' kW, mit g = ' + num(NORM.GLEICHZ, 1) + ' etwa ' + num(P * NORM.GLEICHZ / 1000, 1) + ' kW; stärkste Phase dann ca. ' + num(im, 1) + ' A.';
      if (!hf) return { na: t + ' Keine Hauptsicherung eingebaut: Vergleich nicht möglich.' };
      const q = im / hf.In;
      if (q > 1 + 1e-9) return { d: [D('mangel', t + ' Die Hauptsicherung ' + c.h.hak.fuse + ' ist damit überlastet (' + num(q * 100, 0) + ' %).')] };
      if (q > NORM.AUSLAST_WARN) return { d: [D('hinweis', t + ' Die Hauptsicherung ' + c.h.hak.fuse + ' ist stark ausgelastet (' + num(q * 100, 0) + ' %), wenig Reserve.')] };
      return { d: [D('ok', t + ' Das passt zur Hauptsicherung ' + c.h.hak.fuse + ' (Auslastung ' + num(q * 100, 0) + ' %).')] };
    });

  add('ausstattung', 'Ausstattung nach Richtwerten',
    'Wohnungsbau-Richtwerte (Idee DIN 18015-2) legen fest, wie viele Lichtauslässe und Steckdosen ein Raum mindestens bekommen sollte und dass größere Geräte einen eigenen Stromkreis brauchen: Herd, Waschmaschine, Wäschetrockner und Geschirrspüler. Ein eigener Stromkreis verhindert, dass ein Gerät mit hoher Leistung alle Steckdosen daneben mitabschaltet. Die Werte stehen in der Tabelle AUSSTATTUNG; Richtwerte, die nicht sicher bekannt sind, sind dort leer und werden nicht geprüft.',
    c => {
      const d = []; let geprueft = 0, offen = false;
      c.h.rooms.forEach(r => {
        const a = ART.find(x => x[1].test(r.n)); if (!a) return; const t = AUSSTATTUNG[a[0]]; if (!t) return;
        const lamps = c.h.objs.filter(o => o.room === r.id && o.t === 'lamp').length, socks = c.h.objs.filter(o => o.room === r.id && (o.t === 'sock' || o.t === 'sock3')).length;
        if (t.licht != null) { geprueft++; if (lamps < t.licht) d.push(D('hinweis', r.n + ': ' + lamps + ' Lichtauslass, Richtwert mindestens ' + t.licht + '.')); }
        if (t.steckdosen != null) { geprueft++; if (socks < t.steckdosen) d.push(D('hinweis', r.n + ': ' + socks + ' Steckdosen, Richtwert mindestens ' + t.steckdosen + '.')); } else offen = true;
      });
      c.h.objs.forEach(o => {
        const g = EIGENKREIS.find(x => x[1].test(o.n || '')); if (!g) return;
        const s = c.net.slotOf[o.id]; if (s == null || s < 0) return; geprueft++;
        const teilen = c.h.objs.filter(q => q !== o && c.net.slotOf[q.id] === s && ['sock', 'dev', 'sock3', 'dev3', 'lamp'].includes(q.t));
        if (teilen.length) d.push(D('hinweis', (o.n || g[0]) + ' (' + g[0] + ') teilt sich Abgang ' + (s + 1) + ' mit ' + teilen.length + ' weiteren Verbrauchern. Richtwert: eigener Stromkreis.'));
      });
      if (!geprueft) return { na: 'Keine Raumart und kein Gerät mit hinterlegtem Richtwert gefunden: nicht geprüft.' };
      if (!d.length) d.push(D('ok', 'Geprüfte Richtwerte eingehalten (Lichtauslässe je Raum, eigene Stromkreise für Küchen- und Waschgeräte).'));
      if (offen) d.push(D('ok', 'Hinweis: Die Mindestanzahl der Steckdosen je Raum ist in der Tabelle AUSSTATTUNG noch nicht hinterlegt und wird nicht geprüft.'));
      return { d };
    });

  add('plausi', 'Plausibilität des Aufbaus',
    'Ein Haus „passt“ nur, wenn die Dinge auch zusammenarbeiten: Jeder Raum braucht Licht, ein Schalter braucht eine Lampe, die er schaltet, und jede Steckdose, jedes Gerät und jede Lampe braucht eine Zuleitung vom Verteiler mit Automaten. Sonst ist die Installation unvollständig oder ohne Funktion.',
    c => {
      const d = [], P = c.net.powered, h = c.h;
      /* ohne Zuleitung */
      const bad = h.objs.filter(o => !['panel', 'wet'].includes(o.t) && !P.has(o.id));
      bad.filter(o => ['sock', 'sock3', 'dev', 'dev3', 'lamp'].includes(o.t)).forEach(o => { const r = c.room(o.room); d.push(D('mangel', c.oname(o) + (r ? ' in ' + r.n : '') + ': Ohne Zuleitung vom Verteiler (oder ohne Automaten am Abgang). Das Gerät bekommt keine Spannung.')); });
      bad.filter(o => !['sock', 'sock3', 'dev', 'dev3', 'lamp'].includes(o.t)).forEach(o => { const r = c.room(o.room); d.push(D('hinweis', c.oname(o) + (r ? ' in ' + r.n : '') + ': Ohne Zuleitung vom Verteiler.')); });
      /* Räume ohne Licht */
      h.rooms.forEach(r => { if (!h.objs.some(o => o.room === r.id && o.t === 'lamp')) d.push(D('hinweis', r.n + ': Kein Lichtauslass im Raum.')); });
      /* Schalter ohne Lampe: Baum ab Verteiler, sonst Zusammenhangskomponente */
      const parent = {}, kids = {}; let q = c.panel ? [c.panel] : []; const seen = new Set(q.map(o => o.id));
      while (q.length) { const o = q.shift(); (c.adj[o.id] || []).forEach(cb => { const p = c.other(cb, o); if (!p || seen.has(p.id)) return; seen.add(p.id); parent[p.id] = o.id; (kids[o.id] = kids[o.id] || []).push(p); q.push(p); }); }
      const sub = (o, set) => { set.add(o); (kids[o.id] || []).forEach(k => sub(k, set)); return set; };
      const comp = o => { const s = new Set([o]), st = [o]; while (st.length) { const x = st.pop(); (c.adj[x.id] || []).forEach(cb => { const p = c.other(cb, x); if (p && !s.has(p)) { s.add(p); st.push(p); } }); } return s; };
      h.objs.filter(o => ['swi', 'swc', 'swk', 'imp', 'tast'].includes(o.t)).forEach(o => {
        const set = o.t === 'tast' || !seen.has(o.id) ? comp(o) : sub(o, new Set());
        if (![...set].some(x => x.t === 'lamp')) { const r = c.room(o.room); d.push(D('hinweis', c.oname(o) + (r ? ' in ' + r.n : '') + ': Schaltet keine Lampe. Hinter dem Schalter hängt kein Licht.')); }
      });
      /* Automat ohne Leitung */
      h.panel.slots.forEach((s, i) => { if (s && s.ls && !h.cables.some(cb => cb.slot === i)) d.push(D('hinweis', 'Abgang ' + (i + 1) + ' (' + s.ls + '): Automat eingebaut, aber keine Leitung angeschlossen.')); });
      if (!c.panel) d.push(D('mangel', 'Im Haus gibt es keinen Verteilerkasten.'));
      [...new Set(c.net.warn)].forEach(w => d.push(D('hinweis', w + '.')));
      if (!d.length) d.push(D('ok', 'Jeder Raum hat Licht, jeder Schalter eine Lampe, alle Verbraucher eine Zuleitung.'));
      return { d };
    });

  /* ---------------- Ausführen ---------------- */
  function run(h, opt) {
    opt = opt || {}; const off = opt.off || [], c = context(h, opt.deps);
    const results = CHECKS.map(ck => {
      const active = off.indexOf(ck.id) < 0, r = { id: ck.id, titel: ck.titel, warum: ck.warum, active, status: 'aus', d: [], kurz: '' };
      if (!active) { r.kurz = 'abgeschaltet'; return r; }
      let o; try { o = ck.fn(c); } catch (e) { o = { na: 'Prüfung nicht möglich (' + (e && e.message || e) + ').' }; }
      if (o.na) { r.status = 'na'; r.kurz = o.na; return r; }
      r.d = o.d; r.status = worst(o.d);
      const n = { ok: 0, hinweis: 0, mangel: 0 }; o.d.forEach(x => { n[x.s]++; });
      r.kurz = r.status === 'ok' ? 'in Ordnung' : (n.mangel ? n.mangel + (n.mangel > 1 ? ' Mängel' : ' Mangel') : '') + (n.mangel && n.hinweis ? ', ' : '') + (n.hinweis ? n.hinweis + ' Hinweis' + (n.hinweis > 1 ? 'e' : '') : '');
      return r;
    });
    const act = results.filter(r => r.active && r.status !== 'na'), ok = act.filter(r => r.status === 'ok').length;
    return { results, summary: { ok, total: act.length, aktiv: results.filter(r => r.active).length, nicht: results.filter(r => r.active && r.status === 'na').length, mangel: act.filter(r => r.status === 'mangel').length, hinweis: act.filter(r => r.status === 'hinweis').length } };
  }

  const API = { run, CHECKS, NORM, AUSSTATTUNG, context, lsParse, izOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.HausCheck = API;
  if (typeof document === 'undefined' || !document.body) return;

  /* ---------------- Oberfläche ---------------- */
  const LBL = { ok: 'in Ordnung', hinweis: 'Hinweis', mangel: 'Mangel', na: 'nicht geprüft', aus: 'aus' }, SYM = { ok: '✔', hinweis: '!', mangel: '✖', na: '–', aus: '' };
  const KEY = 'lm4.hauscheck.off';
  const loadOff = () => { try { const a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
  const saveOff = a => { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} };
  const NOTE = 'Richtwerte zur Orientierung, kein Ersatz für Planung und Abnahme durch eine Elektrofachkraft.';
  const CSS = '.hc{font-size:14px}.hc .hcs{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 8px}.hc .hcsum{font-size:17px;font-weight:700}.hc .hcpill{padding:2px 9px;border-radius:12px;font-size:12px;font-weight:700;border:1px solid var(--line)}'
    + '.hc .hci{border:1px solid var(--line);border-radius:12px;margin:0 0 8px;background:var(--panel2);overflow:hidden}.hc .hch{display:flex;align-items:stretch}.hc .hcon{flex:none;width:48px;display:flex;align-items:center;justify-content:center;cursor:pointer}.hc .hcon input{width:22px;height:22px;padding:0;margin:0}'
    + '.hc .hct{flex:1;min-width:0;display:flex;align-items:center;gap:8px;min-height:48px;padding:6px 10px 6px 0;text-align:left;background:none;border:0;color:inherit;font:inherit;cursor:pointer}.hc .hcn{flex:1;min-width:0;font-weight:600;overflow-wrap:anywhere}'
    + '.hc .hcd{flex:none;width:24px;height:24px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#10151a}.hc .hcl{flex:none;font-size:12px;color:var(--mute);text-align:right;max-width:92px}'
    + '.hc .s-ok .hcd,.hc .b-ok{background:#4cd964}.hc .s-hinweis .hcd,.hc .b-hinweis{background:#f0c24b}.hc .s-mangel .hcd,.hc .b-mangel{background:#ff7a6b}.hc .s-na .hcd,.hc .s-aus .hcd{background:#6b7682;color:#fff}.hc .s-aus .hcn{color:var(--mute)}'
    + '.hc .hcb{padding:2px 12px 12px 12px;border-top:1px solid var(--line)}.hc .hcb[hidden]{display:none}.hc ul{list-style:none;margin:8px 0;padding:0}.hc li{display:flex;gap:8px;margin:0 0 7px;align-items:flex-start}.hc li i{flex:none;width:20px;height:20px;border-radius:50%;font-style:normal;font-size:11px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;color:#10151a;margin-top:1px}.hc li span{min-width:0;overflow-wrap:anywhere}'
    + '.hc details{margin-top:6px}.hc summary{cursor:pointer;color:var(--accent);min-height:32px;display:flex;align-items:center}.hc details p{margin:4px 0 0;color:var(--mute)}'
    + '.hc .hcfoot{position:sticky;bottom:0;background:var(--panel);padding:8px 0 4px;margin-top:6px}'
    + '@media(max-width:420px){.hc .hcl{display:none}}';
  function printCss() {
    if (document.getElementById('hcPrintCss')) return; const s = document.createElement('style'); s.id = 'hcPrintCss';
    s.textContent = '#hcPrint{display:none}@media print{body.hcp #hcPrint{display:block!important}body.hcp #printArea{display:none!important}body.hcp{background:#fff}#hcPrint{font:12pt/1.4 Arial,sans-serif;color:#000;background:#fff;padding:0}#hcPrint h1{font-size:20pt;margin:0 0 4pt}#hcPrint h2{font-size:13pt;margin:12pt 0 4pt;border-bottom:1px solid #444;padding-bottom:2pt}#hcPrint .st{font-weight:700}#hcPrint ul{margin:4pt 0 4pt 16pt;padding:0}#hcPrint li{margin:0 0 3pt}#hcPrint .note{margin-top:14pt;border:1px solid #444;padding:6pt;font-size:10pt}#hcPrint .it{page-break-inside:avoid}}';
    document.head.appendChild(s);
  }
  function reportHtml(h, R) {
    const dt = new Date().toLocaleDateString('de-DE');
    let o = '<h1>Haus-Check: ' + esc(h.name || 'Haus') + '</h1><p>Stand ' + esc(dt) + ' · ' + R.summary.ok + ' von ' + R.summary.total + ' geprüften Punkten in Ordnung' + (R.summary.nicht ? ' · ' + R.summary.nicht + ' nicht geprüft' : '') + '</p>';
    R.results.filter(r => r.active).forEach((r, i) => {
      o += '<div class="it"><h2>' + esc(r.titel) + ': <span class="st">' + LBL[r.status] + '</span></h2>';
      if (r.status === 'na') o += '<p>' + esc(r.kurz) + '</p>'; else o += '<ul>' + r.d.map(x => '<li><b>' + LBL[x.s] + ':</b> ' + esc(x.t) + '</li>').join('') + '</ul>';
      o += '</div>';
    });
    return o + '<div class="note"><b>' + esc(NOTE) + '</b> Der Haus-Check ist eine Lernhilfe im Simulator.</div>';
  }
  function printReport(h, R) {
    printCss(); let el = document.getElementById('hcPrint'); if (!el) { el = document.createElement('div'); el.id = 'hcPrint'; document.body.appendChild(el); }
    el.innerHTML = reportHtml(h, R); document.body.classList.add('hcp');
    const done = () => { document.body.classList.remove('hcp'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done); try { window.print(); } catch (e) { done(); }
  }
  function open(h) {
    if (!h) return; const LabUI = root.LabUI; if (!LabUI || !LabUI.sheet) return;
    LabUI.sheet('Haus-Check', b => {
      let off = loadOff(), R = null; const openIds = new Set();
      const draw = () => {
        R = run(h, { off });
        const sm = R.summary, col = sm.mangel ? 'mangel' : sm.hinweis ? 'hinweis' : 'ok';
        b.innerHTML = '<div class="hc"><style>' + CSS + '</style>'
          + '<div class="hcs"><span class="hcsum" aria-live="polite">' + sm.ok + ' von ' + sm.total + ' in Ordnung</span>' + (sm.mangel ? '<span class="hcpill b-mangel" style="color:#10151a">' + sm.mangel + ' mit Mangel</span>' : '') + (sm.hinweis ? '<span class="hcpill b-hinweis" style="color:#10151a">' + sm.hinweis + ' mit Hinweis</span>' : '') + (sm.nicht ? '<span class="hcpill">' + sm.nicht + ' nicht geprüft</span>' : '') + '</div>'
          + '<p class="hint2" style="margin-top:0"><b>' + esc(NOTE) + '</b> Tippe auf einen Punkt für die Begründung. Mit dem Kästchen links schaltest du einen Punkt ab; er fehlt dann im Bericht.</p>'
          + R.results.map(r => '<div class="hci s-' + r.status + '" data-id="' + r.id + '"><div class="hch"><label class="hcon"><input type="checkbox" data-on="' + r.id + '" ' + (r.active ? 'checked' : '') + ' aria-label="' + esc(r.titel) + ' prüfen"></label>'
            + '<button class="hct" data-t="' + r.id + '" aria-expanded="' + (openIds.has(r.id) ? 'true' : 'false') + '"><span class="hcd" aria-hidden="true">' + SYM[r.status] + '</span><span class="hcn">' + esc(r.titel) + '</span><span class="hcl">' + LBL[r.status] + (r.status === 'ok' || r.status === 'aus' || r.status === 'na' ? '' : '<br>' + esc(r.kurz)) + '</span></button></div>'
            + '<div class="hcb" ' + (openIds.has(r.id) ? '' : 'hidden') + '>'
            + (r.status === 'aus' ? '<p class="hint2">Dieser Prüfpunkt ist abgeschaltet.</p>' : r.status === 'na' ? '<p>' + esc(r.kurz) + '</p>' : '<ul>' + r.d.map(x => '<li><i class="b-' + x.s + '" aria-hidden="true">' + SYM[x.s] + '</i><span><b>' + LBL[x.s] + ':</b> ' + esc(x.t) + '</span></li>').join('') + '</ul>')
            + '<details><summary>Warum wird das geprüft?</summary><p>' + esc(r.warum) + '</p></details></div></div>').join('')
          + '<div class="hcfoot"><div class="row2"><button class="btn pri" data-pr="1">🖨 Bericht drucken / als PDF</button></div><p class="hint2" style="margin:2px 0 0">' + esc(NOTE) + ' Der Bericht nennt, was nicht passt und warum. Die Lösung findest du selbst.</p></div></div>';
      };
      b.addEventListener('click', e => {
        const t = e.target.closest('[data-t]'); if (t) { const id = t.dataset.t, body = t.closest('.hci').querySelector('.hcb'); const o = body.hidden; body.hidden = !o; t.setAttribute('aria-expanded', o ? 'true' : 'false'); if (o) openIds.add(id); else openIds.delete(id); return; }
        if (e.target.closest('[data-pr]')) printReport(h, R);
      });
      b.addEventListener('change', e => { const c = e.target.closest('[data-on]'); if (!c) return; const id = c.dataset.on; off = off.filter(x => x !== id); if (!c.checked) off.push(id); saveOff(off); draw(); });
      draw();
    });
  }
  API.open = open; API.reportHtml = reportHtml;
})(typeof window !== 'undefined' ? window : globalThis);
