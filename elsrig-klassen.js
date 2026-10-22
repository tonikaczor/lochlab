/* elsrig-klassen.js - ELS-Lab (WP2c): Pruefstand 5 `klassen` - Schutzklassen und Schutzart (SPEC 5.5).
 * Die gemeinsame Huelle (Steuerwerte, Cache, Ampel, Vorher/Nachher, Partikel, Zeichenhuelle) liegt in elsrig-base.js: Diese Datei im Browser NACH elsrig-base.js laden
 * (in Node holt sie sich die Basis per require). Gerechnet wird NUR im Kern (ELS_CORE.cls, ip, grid.fault, body.touch/zone, rcd.person/trip, limit);
 * hier steht keine zweite Formel. Alle Anlagenwerte sind Uebungswerte (Uebungsanlage, F17/F20/F29/F30). Simulation, kein Hinweis fuer Arbeiten an Netzspannung.
 * Steuerwerte: sk (I/II/III), pe (Schutzleiter am Geraet, nur SK I), fehler (ohne/Koerperschluss), ipa (1. Ziffer 0..6), ipb (2. Ziffer 0..8),
 *   umgebung (Wohnraum/Bad/Werkstatt/Aussen: Uebungsanforderung an die Schutzart, Haut trocken/nass), quelle (Netz/SELV/PELV), zusatz (0 = aus, 30 = RCD 30 mA), Taste fire.
 * Messgeraete: ub (V), ik (mA), tab (ms, 0 = keine Abschaltung), status (0 grau, 1 gruen, 2 gelb, 3 rot; der Text steht in state().statusText), ipok (1 = Schutzart ausreichend).
 * Netz bei SK I: Uebungsnetz wie im Pruefstand `netz` (TN-S, 2,5 mm2, 20 m, LS B16); PE am Geraet getrennt = grid.fault(pe-unterbrochen). Wirft nie.
 */
(function (root) {
  'use strict';
  const R = root.ELS_RIGS = root.ELS_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };
  if (typeof module !== 'undefined') module.exports = R;
  if (!R.base && typeof require === 'function') { try { require('./elsrig-base.js'); } catch (e) { /* Basis fehlt */ } }
  const B = R.base;
  if (!B) { if (typeof console !== 'undefined') console.warn('elsrig-klassen.js: Die Basis elsrig-base.js fehlt (bitte davor laden).'); return; }
  const { clamp, num, fm, isNum, eng } = B;

  const G_G = 'Gerät und Schutzklasse', G_S = 'Schutzart und Umgebung', G_Q = 'Quelle und Zusatzschutz';
  const opt = (arr) => arr.map(a => ({ value: a[0], label: a[1] }));
  const digits = (n) => { const o = []; for (let i = 0; i <= n; i++) o.push([i, String(i)]); return opt(o); };
  const UMG = { wohnraum: 'Wohnraum', bad: 'Bad', werkstatt: 'Werkstatt', aussen: 'Außen' };
  const QUELLE = { netz: 'Netz', selv: 'SELV', pelv: 'PELV' };
  const CONTROLS = [
    { key: 'sk', label: 'Schutzklasse', type: 'select', value: 'I', options: opt([['I', 'Schutzklasse I (Schutzleiter)'], ['II', 'Schutzklasse II (Schutzisolierung)'], ['III', 'Schutzklasse III (Kleinspannung)']]), ebene: 'fehler', group: G_G,
      help: 'Die Schutzklasse sagt, wie das Gerät beim Körperschluss schützt: I über den Schutzleiter, II über die Schutzisolierung, III durch Kleinspannung bis 50 V Wechselspannung.' },
    { key: 'pe', label: 'Schutzleiter am Gerät', type: 'switch', value: true, ebene: 'fehler', group: G_G, visible: (st) => !st || st.sk === 'I',
      help: 'Nur Schutzklasse I hat einen Schutzleiter. Ist er am Gerät nicht angeschlossen, fehlt der Fehlerschutz: Ein Körperschluss setzt das Gehäuse unter Netzspannung. Simulation des Fehlers, keine Anleitung.' },
    { key: 'fehler', label: 'Isolationsfehler', type: 'select', value: 'ohne', options: opt([['ohne', 'ohne Fehler'], ['koerperschluss', 'Körperschluss']]), ebene: null, group: G_G,
      help: 'Körperschluss heißt: Ein spannungsführender Leiter berührt das Gehäuse. Die Taste „Fehler auslösen“ setzt ihn und startet die Anzeige.' },
    { key: 'ipa', label: 'IP, 1. Ziffer', type: 'select', value: 4, options: digits(6), ebene: 'basis', group: G_S,
      help: 'Erste Ziffer der Schutzart (0 bis 6): Schutz gegen Fremdkörper und gegen Berühren. Die Tabelle ist eine Übungstabelle, Norm maßgeblich (F17).' },
    { key: 'ipb', label: 'IP, 2. Ziffer', type: 'select', value: 4, options: digits(8), ebene: 'basis', group: G_S,
      help: 'Zweite Ziffer der Schutzart (0 bis 8): Schutz gegen Wasser, von senkrecht tropfend bis dauerndes Untertauchen. Die Tabelle ist eine Übungstabelle, Norm maßgeblich (F17).' },
    { key: 'umgebung', label: 'Umgebung', type: 'select', value: 'wohnraum', options: opt([['wohnraum', 'Wohnraum'], ['bad', 'Bad'], ['werkstatt', 'Werkstatt'], ['aussen', 'Außen']]), ebene: null, group: G_S,
      help: 'Die Umgebung bestimmt den Hautzustand (Übungswert, F30): Bad und Außen rechnen mit nasser Haut, Wohnraum und Werkstatt mit trockener Haut. In Bad und Außen gibt die zweite IP-Ziffer 0 (kein Wasserschutz) einen Hinweis (F29).' },
    { key: 'quelle', label: 'Quelle', type: 'select', value: 'netz', options: opt([['netz', 'Netz 230 V'], ['selv', 'SELV-Trafo'], ['pelv', 'PELV-Trafo']]), ebene: 'basis', group: G_Q,
      help: 'Aus dem Netz liegen 230 V an. Ein SELV- oder PELV-Transformator liefert Kleinspannung mit sicherer Trennung (Übungswert 24 V, F30). SELV ist ungeerdet, PELV geerdet. Schutzklasse III gehört an so eine Quelle.' },
    { key: 'zusatz', label: 'RCD (Zusatzschutz)', type: 'select', value: 0, options: [{ value: 0, label: 'aus' }, { value: 30, label: '30 mA' }], ebene: 'zusatz', group: G_Q,
      help: 'Zusatzschutz durch RCD mit 30 mA: Er verkürzt die Abschaltzeit beim Körperschluss. Er ersetzt den Schutzleiter nicht und macht die Berührung nicht ungefährlich.' },
    { key: 'fire', label: 'Fehler auslösen', type: 'button', ebene: null, group: G_G, help: 'Löst den Isolationsfehler (Körperschluss) aus und startet die Anzeige des Fehlerpfads. Das ist nur eine Simulation.' }
  ];
  const METERS = [
    { key: 'ub', label: 'Berührungsspannung U_B', unit: 'V', digits: 1, min: 0, max: 250, warnAbove: 50, help: 'Spannung am berührbaren Gehäuse beim Körperschluss. 0 V heißt: kein Fehler oder kein Spannungspfad am Gehäuse.' },
    { key: 'ik', label: 'Körperstrom I_K', unit: 'mA', digits: 2, min: 0, max: 1000, warnAbove: 10, help: 'Strom durch einen Menschen, der das Gehäuse berührt (Rechenwerte für die Haut, Übungswerte, F11).' },
    { key: 'tab', label: 'Abschaltzeit', unit: 'ms', digits: 0, min: 0, max: 400, zeroIsNone: true, help: 'Höchste Abschaltzeit des Schutzorgans oder des RCD beim Körperschluss; 0 heißt: keine sichere Abschaltung oder kein Fehler.' },
    { key: 'status', label: 'Status', unit: '', digits: 0, min: 0, max: 3, zeroIsNone: true, help: 'Ergebnis der Prüfung als Kennzahl: 1 grün, 2 gelb, 3 rot, 0 grau. Der Text steht in der Ampelzeile.' },
    { key: 'ipok', label: 'Schutzart ohne Hinweis', unit: '', digits: 0, min: 0, max: 1, help: '1 heißt: kein Hinweis zur Schutzart in dieser Umgebung, 0 heißt: zweite Ziffer 0 (kein Wasserschutz) in Bad oder Außen (F29).' }
  ];
  const PRESETS = [
    { id: 'sk1-fehler', name: 'Schutzklasse I mit Körperschluss', info: 'Der Fehlerstrom fließt über den Schutzleiter, das Schutzorgan schaltet ab.', params: { sk: 'I', pe: true, fehler: 'koerperschluss', ipa: 4, ipb: 4, umgebung: 'wohnraum', quelle: 'netz', zusatz: 0 } },
    { id: 'sk2-fehler', name: 'Schutzklasse II mit Isolationsfehler', info: 'Die Schutzisolierung hält die Spannung vom Gehäuse fern, es gibt keinen Schutzleiter.', params: { sk: 'II', pe: true, fehler: 'koerperschluss', ipa: 4, ipb: 4, umgebung: 'wohnraum', quelle: 'netz', zusatz: 0 } },
    { id: 'sk3', name: 'Schutzklasse III an SELV', info: 'Kleinspannung bis 50 V Wechselspannung: kein Schutzleiter, kein Netz am Gerät.', params: { sk: 'III', pe: true, fehler: 'koerperschluss', ipa: 5, ipb: 1, umgebung: 'werkstatt', quelle: 'selv', zusatz: 0 } },
    { id: 'selv-pelv', name: 'PELV-Quelle im Bad', info: 'Kleinspannung mit sicherer Trennung, geerdet: zulässig, bei nasser Haut bleibt die Gefährdung größer.', params: { sk: 'III', pe: true, fehler: 'koerperschluss', ipa: 4, ipb: 4, umgebung: 'bad', quelle: 'pelv', zusatz: 0 } },
    { id: 'ip44-ip65', name: 'IP65 im Außenbereich', info: 'IP65 gegen IP44: erste Ziffer 6 (staubdicht) gegen 4 (Fremdkörper über 1 mm), zweite Ziffer 5 (Strahlwasser) gegen 4 (Spritzwasser). Stelle IP44 ein und vergleiche.', params: { sk: 'II', pe: true, fehler: 'ohne', ipa: 6, ipb: 5, umgebung: 'aussen', quelle: 'netz', zusatz: 0 } }
  ];
  const PFAD = { fehler: 'Isolationsfehler im Gerät (Körperschluss am Gehäuse)', weg: 'Gehäuse – Schutzleiter (SK I), Schutzisolierung (SK II) oder Kleinspannung (SK III)', schutz: 'Schutzklasse, Schutzart (IP), Kleinspannung, RCD (Zusatzschutz)', art: 'indirekt' };
  const PARAMS = {
    rho: 0.0178, q: 2.5, qpe: 2.5, l: 20, zv: 0.4, dev: 'LS-B', In: 16,        // Uebungsnetz wie im Pruefstand netz (F20)
    uKlein: 24,                                                                 // Kleinspannung der SELV/PELV-Quelle (Uebungswert, F30)
    reserveMin: 1.2, ubNah: 40,                                                 // Lehrfaustwerte wie im Pruefstand netz
    ipMin: { wohnraum: [0, 0], bad: [0, 1], werkstatt: [0, 0], aussen: [0, 1] }, // Hinweis nur bei zweiter Ziffer 0 in Bad und Aussen, keine Ziffern-Grenze (F29, F17)
    dispMs: 2600, tripAtMs: 1300
  };
  const STATUS = { grau: 0, gruen: 1, gelb: 2, rot: 3 };

  function plant(P0) {
    const CORE = P0.CORE;
    let fireT = -1;                                      // ms seit "Fehler ausloesen", -1 = nicht gestartet
    const ipTxt = (a, b) => 'IP' + a + b;

    function compute(ctl, par) {
      const sk = ctl.sk, netz = ctl.quelle === 'netz', haut = (ctl.umgebung === 'bad' || ctl.umgebung === 'aussen') ? 'nass' : 'trocken';
      const info = CORE.cls.info(sk), ipc = CORE.ip.encode(ctl.ipa, ctl.ipb);
      if (!info || info.ok === false || !ipc || ipc.ok === false) return { ok: false, text: (info && info.why) || (ipc && ipc.why) || CORE.TEXTS.eingabe };
      const req = par.ipMin[ctl.umgebung] || [0, 0], ipOk = ctl.ipa >= req[0] && ctl.ipb >= req[1];
      const fault = ctl.fehler === 'koerperschluss', peOn = sk === 'I' && ctl.pe === true, rcdOn = ctl.zusatz > 0;
      const lim = CORE.limit('ul_ac'), ul = lim && isNum(lim.value) ? lim.value : 50;
      const eff = CORE.cls.effect(sk, fault ? 'koerperschluss' : 'ohne');
      const o = { ok: true, umg: ctl.umgebung, sk, netz, haut, info, ip: ipc, req, ipOk, fault, peOn, rcdOn, ul, eff, ub: 0, ik: 0, tabMs: 0, zone: null, kind: 'ok', g: null, flow: false, a: null, extra: null };
      const gridCfg = (fehler) => ({ form: 'TN-S', q: par.q, qpe: par.qpe, l: par.l, zv: par.zv, dev: par.dev, In: par.In, rho: par.rho, kreis: 'end', fehler, haut, rcd: { on: rcdOn, idn: 30, type: 'A' } });
      if (!netz) o.extra = CORE.cls.extra(ctl.quelle);
      if (!fault) {
        if (sk === 'III' && netz) { o.kind = 'sk3-netz'; o.a = { ampel: 'rot', text: 'Ein Gerät der Schutzklasse III darf nur an Kleinspannung aus einer SELV- oder PELV-Quelle betrieben werden, nicht am Netz mit 230 V. ' + info.merkmal }; }
        else if (sk === 'I' && !peOn && netz) { o.kind = 'pe-fehlt'; o.a = { ampel: 'gelb', text: 'Der Schutzleiter ist am Gerät der Schutzklasse I nicht angeschlossen: Der Fehlerschutz fehlt. Aktuell liegt kein Fehler vor, ein Körperschluss würde das Gehäuse aber unter Netzspannung setzen.' }; }
        else { o.a = { ampel: 'gruen', text: eff.text + (o.extra ? ' ' + o.extra.text : '') }; }
        return o;
      }
      const z = (zi) => zi && zi.zone !== undefined ? zi : null;
      if (!netz) {
        const U = par.uKlein, t = CORE.body.touch({ U, haut, tMs: 1000 });
        if (!t || t.ok === false) return { ok: false, text: (t && t.why) || CORE.TEXTS.eingabe };
        o.kind = 'klein'; o.ub = U; o.ik = t.iK * 1000; o.zone = z(t.zoneInfo);
        const ampel = !t.tOK ? 'rot' : haut === 'nass' ? 'gelb' : 'gruen';
        o.a = { ampel, text: ['Körperschluss an der Kleinspannungsquelle: höchstens ' + fm(U, 0) + ' V am Gehäuse (Übungswert), Körperstrom ' + eng(t.iK, 'A') + '.', o.zone ? o.zone.text : '',
          (t.tOK ? 'Die Spannung liegt unter der dauernd zulässigen Berührungsspannung von ' : 'Die Spannung liegt über der dauernd zulässigen Berührungsspannung von ') + fm(ul, 0) + ' V.', t.hinweis || '', o.extra.text].filter(Boolean).join(' ') };
        return o;
      }
      if (sk === 'III') {
        const U = 230, t = CORE.body.touch({ U, haut, tMs: 1000 });
        if (!t || t.ok === false) return { ok: false, text: (t && t.why) || CORE.TEXTS.eingabe };
        let person = null;
        if (rcdOn) { person = CORE.rcd.person({ U, idn: 30, type: 'A', on: true, haut }); if (person && person.ok === false) person = null; }
        const tripMs = person && person.trip && person.trip.tripped && isNum(person.trip.tTrip) ? person.trip.tTrip * 1000 : 0;
        o.zone = z(CORE.body.zone(t.iK, tripMs > 0 ? tripMs : 1000));
        o.kind = 'sk3-netz-fehler'; o.ub = U; o.ik = t.iK * 1000; o.tabMs = tripMs; o.person = person;
        o.a = { ampel: 'rot', text: 'Ein Gerät der Schutzklasse III am Netz: Das Gehäuse führt beim Körperschluss ' + fm(U, 0) + ' V, der Körperstrom beträgt ' + eng(t.iK, 'A') + '. ' + (o.zone ? o.zone.text : '') + (person ? ' ' + person.text : ''), zusatz: person ? person.text : null };
        return o;
      }
      if (sk === 'II') {
        o.kind = 'sk2'; o.a = { ampel: 'gruen', text: eff.text + ' Der Schutz gilt, solange die Schutzisolierung unbeschädigt ist; sie wird über den Isolationswiderstand geprüft.' };
        return o;
      }
      // Schutzklasse I
      const g = CORE.grid.fault(gridCfg(peOn ? 'koerperschluss' : 'pe-unterbrochen'));
      if (!g || g.ok === false) return { ok: false, text: (g && g.why) || CORE.TEXTS.eingabe };
      o.g = g; o.ub = g.uB; o.tabMs = isNum(g.tAb) && g.ausgeloest ? g.tAb * 1000 : 0;
      if (peOn) {
        const t = CORE.body.touch({ U: g.uB, haut, tMs: o.tabMs > 0 ? o.tabMs : 1000 });
        o.kind = 'sk1-pe'; o.ik = t && t.ok !== false ? t.iK * 1000 : 0; o.zone = t && t.ok !== false ? z(t.zoneInfo) : null; o.flow = true;
        const lage = !g.tOK ? 'rot' : (g.reserve < par.reserveMin || g.uB >= par.ubNah || g.uB > ul) ? 'gelb' : 'gruen';
        let text = g.text;
        if (lage === 'gelb' && g.tOK && g.uB >= par.ubNah) text += ' Berührungsspannung ' + fm(g.uB, 1) + ' V ab ' + fm(par.ubNah, 0) + ' V (Lehrfaustwert) nahe an der Grenze von ' + fm(ul, 0) + ' V.';
        o.a = { ampel: lage, text, margin: isNum(g.reserve) ? g.reserve : undefined, zusatz: rcdOn ? 'Zusatzschutz 30 mA vorhanden. ' + CORE.TEXTS.zusatzErsetztNicht : null };
      } else {
        o.kind = 'sk1-peu'; o.ik = isNum(g.iK) ? g.iK * 1000 : 0;
        o.zone = isNum(g.iK) && g.iK > 0 ? z(CORE.body.zone(g.iK, o.tabMs > 0 ? o.tabMs : 1000)) : null;
        const gelb = g.zusatz && g.ausgeloest;
        o.a = { ampel: gelb ? 'gelb' : 'rot', text: g.text + (o.zone ? ' ' + o.zone.text : ''), zusatz: g.rcd ? g.rcd.text : null };
      }
      return o;
    }
    function meters(r) {
      if (!r || r.ok === false) return { ub: 0, ik: 0, tab: 0, status: 0, ipok: 0 };
      const a = assess(r);
      return { ub: r.ub, ik: r.ik, tab: r.tabMs, status: STATUS[a.ampel] || 0, ipok: r.ipOk ? 1 : 0 };
    }
    function assess(r) {
      if (!r || r.ok === false) return { ok: false, ampel: 'grau', text: (r && r.text) || CORE.TEXTS.eingabe };
      const a = r.a;
      let ampel = a.ampel, text = a.text;
      if (!r.ipOk) {
        const note = 'Hinweis: Die Schutzart ' + ipTxt(r.ip.a, r.ip.b) + ' hat in ' + UMG[r.umg] + ' keinen Schutz gegen Wasser (zweite Ziffer 0); das Lab urteilt hier nur diesen Fall, Norm maßgeblich (F29).';
        if (ampel === 'gruen') ampel = 'gelb';
        text += ' ' + note;
      }
      const o = { ok: ampel !== 'rot', ampel, text };
      if (a.margin !== undefined) o.margin = a.margin;
      if (a.zusatz) o.zusatz = a.zusatz;
      return o;
    }
    function diag(r, ctl) {
      const out = [];
      if (!r || r.ok === false) return out;
      if (r.kind === 'sk3-netz' || r.kind === 'sk3-netz-fehler') out.push({ id: 'sk3-netz', kind: 'error', text: 'Schutzklasse III gehört an Kleinspannung (SELV oder PELV), nicht ans Netz mit 230 V.' });
      if (r.kind === 'pe-fehlt') out.push({ id: 'pe-fehlt', kind: 'warn', text: 'Der Schutzleiter fehlt am Gerät der Schutzklasse I: Der Fehlerschutz ist nicht wirksam.' });
      if (r.kind === 'sk1-peu') out.push({ id: 'pe-fehlt-fehler', kind: 'error', text: 'Körperschluss ohne Schutzleiter: Das Gehäuse führt Netzspannung (U_B = ' + fm(r.ub, 0) + ' V), das Schutzorgan löst nicht aus.' });
      if (r.kind === 'sk1-peu' && r.rcdOn) out.push({ id: 'zusatz-ersetzt-nicht', kind: 'warn', text: CORE.TEXTS.zusatzErsetztNicht });
      if (r.kind === 'sk1-pe' && r.ub > r.ul) out.push({ id: 'ub-gross', kind: 'warn', text: 'Die Berührungsspannung U_B = ' + fm(r.ub, 1) + ' V liegt über ' + fm(r.ul, 0) + ' V; sie ist nur wegen der schnellen Abschaltung zulässig.' });
      if (r.kind === 'sk2') out.push({ id: 'sk2-hinweis', kind: 'info', text: 'Schutzklasse II hat keinen Schutzleiter: Der Schutzleiterwiderstand wird nicht geprüft, der Isolationswiderstand schon.' });
      if (!r.ipOk) out.push({ id: 'ip-kein-wasserschutz', kind: 'warn', text: 'Die Schutzart ' + ipTxt(r.ip.a, r.ip.b) + ' hat keinen Schutz gegen Wasser (zweite Ziffer 0), in ' + UMG[ctl.umgebung] + ' ein Hinweis.' });
      if (r.extra) out.push({ id: 'quelle', kind: 'info', text: r.extra.text });
      return out;
    }
    function curves(r) {
      const z1 = [], z2 = [], fl = [];
      for (let k = 0; k <= 30; k++) {
        const t = Math.pow(10, 1 + 3 * k / 30), zc = CORE.body.zoneCurve(t);
        if (!zc || zc.ok === false) continue;
        z1.push([t, zc.z1 * 1000]); z2.push([t, zc.z2 * 1000]); fl.push([t, zc.flimmer * 1000]);
      }
      const c = { id: 'zonen', title: 'Körperstrom beim Körperschluss über der Einwirkdauer (Lehrdarstellung, Übungswerte)', xLabel: 'Einwirkdauer', xUnit: 'ms', xScale: 'log', yLabel: 'Körperstrom', yUnit: 'mA', yScale: 'log',
        series: [{ name: 'Zone 1 bis', points: z1 }, { name: 'Zone 2 bis', points: z2 }, { name: 'Flimmerkurve (Zone 3 bis)', points: fl }] };
      if (r && r.ok !== false && r.ik > 0) c.marker = { x: r.tabMs > 0 ? r.tabMs : 1000, y: Math.max(r.ik, 1e-3), label: 'Betriebspunkt ' + eng(r.ik / 1000, 'A') + ', ' + fm(r.tabMs > 0 ? r.tabMs : 1000, 0) + ' ms' };
      return [c];
    }
    // ---- Zeichnen ----
    const running = () => fireT >= 0;
    const progress = (reduced) => (fireT < 0 ? 0 : reduced ? 1 : clamp(fireT / PARAMS.dispMs, 0, 1));
    function wrap(ctx, g, s, x, y, w, size, color, maxLines, lh) {
      ctx.font = g.font(size, false);
      const words = String(s).split(' '), lines = []; let cur = '';
      words.forEach(wd => {
        const t = cur ? cur + ' ' + wd : wd;
        if (cur && ctx.measureText(t).width > w) { lines.push(cur); cur = wd; } else cur = t;
      });
      if (cur) lines.push(cur);
      if (lines.length > maxLines) { const rest = lines.slice(maxLines - 1).join(' '); lines.length = maxLines - 1; lines.push(rest); }
      lines.forEach((ln, i) => g.text(ctx, ln, x, y + i * lh, { size, color, max: w }));
      return y + lines.length * lh;
    }
    function draw(ctx, w, h, t, view, sc) {
      const R0 = sc.rect, pal = sc.pal, g = sc.gfx, r = view.res, fs = sc.fs, D = sc.D, ct = view.ctl;
      if (!R0 || !(R0.w >= 220 && R0.h >= 260) || !r) return;
      const wide = R0.w >= 600, cols = wide ? 4 : 2, chH = 32, gap = 6;
      const chips = [
        { key: 'fire', label: '', value: 'Fehler auslösen', color: pal.fehler, on: running() },
        { key: 'sk', label: 'Klasse ', value: ct.sk, color: B.ebeneColor('fehler', pal) },
        ct.sk === 'I' ? { key: 'pe', label: 'PE ', value: ct.pe ? 'ja' : 'nein', color: B.ebeneColor('fehler', pal), on: !ct.pe } : { key: null, label: 'PE ', value: 'entfällt' },
        { key: 'zusatz', label: 'RCD ', value: ct.zusatz > 0 ? ct.zusatz + ' mA' : 'aus', color: B.ebeneColor('zusatz', pal), on: ct.zusatz > 0 },
        { key: 'quelle', label: 'Quelle ', value: QUELLE[ct.quelle], color: B.ebeneColor('basis', pal), on: ct.quelle !== 'netz' },
        { key: 'umgebung', label: 'Ort ', value: UMG[ct.umgebung] },
        { key: 'ipa', label: 'IP-Ziffer 1 ', value: ct.ipa, color: B.ebeneColor('basis', pal) },
        { key: 'ipb', label: 'IP-Ziffer 2 ', value: ct.ipb, color: B.ebeneColor('basis', pal) }
      ];
      const rows = Math.ceil(chips.length / cols), barH = rows * (chH + gap);
      const top = { x: R0.x, y: R0.y, w: R0.w, h: R0.h - barH - 4 };
      const cw = (R0.w - (cols - 1) * gap) / cols;
      chips.forEach((c, i) => {
        const x = R0.x + (i % cols) * (cw + gap), y = R0.y + R0.h - barH + Math.floor(i / cols) * (chH + gap);
        g.chip(ctx, c.label, c.value, x, y, cw, chH, pal, { color: c.color, on: c.on, size: fs });
        if (c.key) sc.hit(c.key, x, y, cw, chH);
      });
      // ---- oben: Geraeteschnitt und Informationsflaeche ----
      const f = progress(sc.reduced), tripped = r.tabMs > 0 && fireT >= 0 && (sc.reduced || fireT >= PARAMS.tripAtMs);
      const flowing = r.flow && r.fault && fireT >= 0 && !tripped && f < 1;
      const cut = wide ? { x: top.x, y: top.y, w: Math.round(top.w * 0.46), h: top.h } : { x: top.x, y: top.y, w: top.w, h: Math.max(160, Math.round(top.h * 0.5)) };
      const inf = wide ? { x: cut.x + cut.w + 8, y: top.y, w: top.w - cut.w - 8, h: top.h } : { x: top.x, y: cut.y + cut.h + 6, w: top.w, h: top.h - cut.h - 6 };
      const stCut = { sk: r.sk, pe: r.peOn, fault: r.fault, rate: flowing ? 0.85 : 0, tripped };
      let done = false;
      if (D && typeof D.deviceCut === 'function' && cut.w >= 200 && cut.h >= 140) {
        try {
          let ps = null;
          if (typeof D.devicePaths === 'function') ps = sc.ps('fehler', D.devicePaths(cut, { rate: stCut.rate }).map(p => Object.assign({}, p, { color: p.color || pal.fehler, rate: stCut.rate })), { speed: 80 });
          done = !!D.deviceCut(ctx, cut, stCut, { theme: sc.theme, particles: ps });
        } catch (e) { done = false; }
      }
      if (!done) {
        g.panel(ctx, cut.x, cut.y, cut.w, cut.h, pal.panel, pal.line, 8);
        g.text(ctx, r.info.name + ' ' + r.info.zeichen, cut.x + 10, cut.y + 24, { size: fs + 1, bold: true, color: pal.fg, max: cut.w - 20 });
        g.text(ctx, r.fault ? 'Körperschluss' : 'ohne Fehler', cut.x + 10, cut.y + 46, { size: fs, color: r.fault ? pal.fehler : pal.mute, max: cut.w - 20 });
      }
      if (r.ub > 0 && cut.h >= 140) g.text(ctx, 'Gehäuse: U_B ' + fm(r.ub, r.ub < 100 ? 1 : 0) + ' V', cut.x + cut.w / 2, cut.y + 14, { size: fs, bold: true, color: pal.fg, bg: pal.panel, align: 'center', max: cut.w - 16 });
      sc.hit('fire', cut.x, cut.y, cut.w, cut.h);
      // Informationsflaeche
      g.panel(ctx, inf.x, inf.y, inf.w, inf.h, pal.panel, pal.line, 8);
      if (inf.h >= 60) {
        const lh = fs + 5, px = inf.x + 10, pw = inf.w - 20;
        let y = inf.y + fs + 8;
        g.text(ctx, r.info.name + ' (' + r.info.symbol + ')', px, y, { size: fs + 1, bold: true, color: pal.fg, max: pw }); y += lh + 2;
        const room = Math.max(0, Math.floor((inf.y + inf.h - y - 4) / lh));
        const lines = [];
        lines.push({ s: r.info.merkmal, c: pal.mute, n: wide ? 3 : 2 });
        const tab = r.tabMs > 0 ? ' · Abschaltung nach höchstens ' + fm(r.tabMs, 0) + ' ms' : '';
        lines.push({ s: 'U_B ' + fm(r.ub, 1) + ' V · I_K ' + eng(r.ik / 1000, 'A') + tab, c: pal.fg, n: 1, b: true });
        lines.push({ s: ipTxt(r.ip.a, r.ip.b) + ': ' + r.ip.textA + '; ' + r.ip.textB + '.', c: pal.mute, n: wide ? 3 : 2 });
        lines.push({ s: r.ipOk ? 'Schutzart: kein Hinweis für ' + UMG[ct.umgebung] : 'Hinweis: kein Wasserschutz in ' + UMG[ct.umgebung], c: r.ipOk ? pal.gruen : pal.gelb, n: 1, b: true });
        let used = 0;
        for (let i = 0; i < lines.length && used < room; i++) {
          const L = lines[i], n = Math.min(L.n, room - used);
          if (n <= 0) break;
          if (L.b) { g.text(ctx, L.s, px, y, { size: fs, bold: true, color: L.c, max: pw }); y += lh; used += 1; }
          else { y = wrap(ctx, g, L.s, px, y, pw, fs, L.c, n, lh); used += n; }
        }
      }
    }
    return {
      compute, meters, assess, diag, curves, draw,
      phaseHz: () => 0.4,
      step(dtMs) { if (fireT >= 0 && fireT < PARAMS.dispMs + 500) fireT += dtMs; },
      fire() {
        P0.setCtl('fehler', 'koerperschluss');
        fireT = 0;
        const r2 = compute(P0.ctl, P0.params), a = assess(r2);
        P0.say('Isolationsfehler ausgelöst: ' + a.text, a.ampel === 'rot' ? 'warn' : 'info');
        return true;
      },
      onControl() { fireT = -1; },
      reset() { fireT = -1; },
      state(r) {
        const a = r && r.ok !== false ? assess(r) : null;
        return { ub: r && r.ok !== false ? r.ub : 0, ik: r && r.ok !== false ? r.ik : 0, tab: r && r.ok !== false ? r.tabMs : 0, ipOk: !!(r && r.ipOk), statusText: a ? a.text : '', gestartet: fireT >= 0, fireT: Math.max(fireT, 0) };
      }
    };
  }

  R.register({ id: 'klassen', name: 'Schutzklassen und Schutzart', icon: '🛡️',
    info: 'Schutzklasse I, II und III beim Isolationsfehler und die Schutzart (IP-Code) der Umgebung (Übungswerte). Simulation, kein Hinweis für Arbeiten an Netzspannung.',
    controls: CONTROLS, meters: METERS, presets: PRESETS,
    create(opts) { return B.makeRig({ id: 'klassen', name: 'Schutzklassen und Schutzart', icon: '🛡️', info: '', world: { w: 960, h: 640 }, pfad: PFAD, controls: CONTROLS, meters: METERS, presets: PRESETS, params: PARAMS, plant }, opts); } });
})(typeof window !== 'undefined' ? window : globalThis);
