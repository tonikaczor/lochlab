/* elsrig-netz.js - ELS-Lab (WP2a): Pruefstand 2 `netz` - Netzform und Fehlerschleife (SPEC 5.2).
 * Die gemeinsame Huelle liegt in elsrig-base.js: Diese Datei im Browser NACH elsrig-base.js laden (in Node holt sie sich die Basis per require).
 * Gerechnet wird NUR im Kern (ELS_CORE.grid.fault / loop / condition / tt / it / maxLength / zsMax, prot.curve, limit); hier steht keine zweite Formel.
 * Alle Anlagenwerte sind Uebungswerte (Uebungsanlage, Netzimpedanz F20); Grenzwerte nur aus ELS_CORE.limits. Simulation, kein Hinweis fuer Arbeiten an Netzspannung.
 * Steuerwerte: form, q, qpe (mm2), l (m, log), zv (Ohm), dev, In (A), kreis, ra, rb (Ohm, nur TT), rcd (0 = aus, 30, 300 mA), fehler (ohne, koerperschluss, pe-unterbrochen),
 *   cleck (nF, nur IT), haut, rv (Beruehrung), Taste fire (loest den Koerperschluss aus).
 * Messgeraete (bei Koerperschluss; bei PE unterbrochen der tatsaechliche Zustand): zs (Ohm), zsMax (Ohm, TT: R_A,max; 0 = kein Grenzwert), ifehler (A), ub (V), tab (s, 0 = keine Abschaltung),
 *   reserve (Faktor Grenzwert zu Istwert, 0 = keine). Ampel nach SPEC 4.10 (Reserve 1,2 und 40 V sind Lehrfaustwerte). Wirft nie.
 */
(function (root) {
  'use strict';
  const R = root.ELS_RIGS = root.ELS_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };
  if (typeof module !== 'undefined') module.exports = R;
  if (!R.base && typeof require === 'function') { try { require('./elsrig-base.js'); } catch (e) { /* Basis fehlt */ } }
  const B = R.base;
  if (!B) { if (typeof console !== 'undefined') console.warn('elsrig-netz.js: Die Basis elsrig-base.js fehlt (bitte davor laden).'); return; }
  const { clamp, num, fm, isNum, eng } = B;

  const RESERVE_MIN = 1.2, UB_NAH = 40;                  // Lehrfaustwerte (SPEC 4.10, F19), im Text so gekennzeichnet
  const G_N = 'Netz und Leitung', G_S = 'Schutzorgan und RCD', G_F = 'Fehler und Berührung';
  const opt = arr => arr.map(a => ({ value: a[0], label: a[1] }));
  const QS = [1.5, 2.5, 4, 6, 10, 16];
  const INS = [6, 10, 13, 16, 20, 25, 32, 40, 50, 63];
  const isTT = c => c.form === 'TT';
  const CONTROLS = [
    { key: 'form', label: 'Netzform', type: 'select', value: 'TN-S', options: opt([['TN-S', 'TN-S'], ['TN-C-S', 'TN-C-S'], ['TT', 'TT'], ['IT', 'IT']]), ebene: 'fehler', group: G_N,
      help: 'Netzform der Anlage: TN-S, TN-C-S, TT oder IT. Die Netzform legt fest, über welchen Weg der Fehlerstrom zurückfließt und wie abgeschaltet wird. TN-C wird nur als Begriff erklärt (F18).' },
    { key: 'q', label: 'Querschnitt Außenleiter', type: 'select', value: 2.5, options: QS.map(v => ({ value: v, label: String(v).replace('.', ',') + ' mm²' })), unitKind: 'area', ebene: 'fehler', group: G_N,
      help: 'Querschnitt des Außenleiters. Mehr Querschnitt bedeutet weniger Leitungswiderstand und damit kleineres Zs.' },
    { key: 'qpe', label: 'Querschnitt Schutzleiter', type: 'select', value: 2.5, options: QS.map(v => ({ value: v, label: String(v).replace('.', ',') + ' mm²' })), unitKind: 'area', ebene: 'fehler', group: G_N,
      help: 'Querschnitt des Schutzleiters (PE). Mehr Querschnitt bedeutet weniger Widerstand im Fehlerweg.' },
    { key: 'l', label: 'Leitungslänge', type: 'slider', scale: 'log', min: 1, max: 200, step: 0.5, unit: 'm', unitKind: 'len', value: 20, ebene: 'fehler', group: G_N,
      help: 'Länge der Leitung bis zum Gerät. Eine längere Leitung erhöht Zs und senkt den Fehlerstrom; die Abschaltbedingung kann dadurch verletzt werden.' },
    { key: 'zv', label: 'Netzimpedanz Zv', type: 'slider', scale: 'lin', min: 0.05, max: 2, step: 0.05, unit: 'Ω', unitKind: 'res', value: 0.4, ebene: 'fehler', group: G_N,
      help: 'Impedanz des Netzes bis zur Einspeisung (Übungswert, F20). Bei TN-C-S steckt der PEN-Teil des Netzes darin.' },
    { key: 'dev', label: 'Schutzorgan', type: 'select', value: 'LS-B', options: opt([['LS-B', 'LS-Schalter B'], ['LS-C', 'LS-Schalter C'], ['LS-D', 'LS-Schalter D'], ['gG', 'Sicherung gG']]), ebene: 'fehler', group: G_S,
      help: 'Schutzorgan im Stromkreis. Typ B löst früh aus (3 bis 5 · In), C später, D noch später. Das ändert den Auslösestrom Ia und damit Zs_max.' },
    { key: 'In', label: 'Nennstrom', type: 'select', value: 16, options: INS.map(v => ({ value: v, label: v + ' A' })), unitKind: 'amp', ebene: 'fehler', group: G_S,
      help: 'Nennstrom In des Schutzorgans. Ein größerer Nennstrom erhöht den Auslösestrom Ia und senkt Zs_max.' },
    { key: 'kreis', label: 'Stromkreisart', type: 'select', value: 'end', options: opt([['end', 'Endstromkreis'], ['verteil', 'Verteilerstromkreis']]), ebene: null, group: G_S,
      help: 'Endstromkreis (bis 32 A) oder Verteilerstromkreis: Davon hängt die höchste Abschaltzeit ab (Grenzwerte aus ELS_CORE.limits).' },
    { key: 'ra', label: 'Anlagenerder R_A', type: 'slider', scale: 'log', min: 1, max: 2000, step: 1, unit: 'Ω', unitKind: 'res', value: 50, ebene: 'fehler', group: G_N, visible: s => s.form === 'TT',
      help: 'Erdungswiderstand der Anlage (nur TT). Er muss klein genug sein: R_A ≤ 50 V / IΔn (50 V gelten für trockene Bedingungen).' },
    { key: 'rb', label: 'Betriebserder R_B', type: 'slider', scale: 'log', min: 1, max: 100, step: 1, unit: 'Ω', unitKind: 'res', value: 2, ebene: 'fehler', group: G_N, visible: s => s.form === 'TT',
      help: 'Erdungswiderstand des Betriebserders am Trafo (nur TT). Er liegt mit R_A in der Fehlerschleife.' },
    { key: 'rcd', label: 'RCD', type: 'select', value: 0, options: [{ value: 0, label: 'aus' }, { value: 30, label: '30 mA' }, { value: 300, label: '300 mA' }], ebene: 'zusatz', group: G_S,
      help: 'Fehlerstrom-Schutzeinrichtung (RCD). Im TT-System schaltet meist der RCD ab; mit 30 mA ist er auch Zusatzschutz. Der Zusatzschutz ersetzt den Schutzleiter nicht.' },
    { key: 'fehler', label: 'Fehler', type: 'select', value: 'ohne', options: opt([['ohne', 'ohne Fehler'], ['koerperschluss', 'Körperschluss'], ['pe-unterbrochen', 'Schutzleiter unterbrochen']]), ebene: null, group: G_F,
      help: 'Fehlerbild der Simulation: Körperschluss (Außenleiter berührt das Gehäuse) oder unterbrochener Schutzleiter. Das sind Fehlerbilder zum Erklären, keine Vorgehensweise.' },
    { key: 'cleck', label: 'Leitungskapazität', type: 'slider', scale: 'log', min: 1, max: 1000, step: 1, unit: 'nF', unitKind: 'cap', value: 50, ebene: null, group: G_N, visible: s => s.form === 'IT',
      help: 'Ableitkapazität des Netzes gegen Erde (nur IT, Lehrmodell). Die Kapazität bestimmt den kleinen Strom beim ersten Fehler.' },
    { key: 'haut', label: 'Haut', type: 'select', value: 'nass', options: opt([['trocken', 'trocken'], ['feucht', 'feucht'], ['nass', 'nass']]), ebene: null, group: G_F,
      help: 'Hautzustand einer Person, die das Gehäuse berührt (Körperwiderstand, Übungswerte F11).' },
    { key: 'rv', label: 'Boden und Schuhe', type: 'slider', scale: 'log', logZero: true, min: 0, max: 100000, step: 1, unit: 'Ω', unitKind: 'res', value: 0, ebene: 'basis', group: G_F,
      help: 'Übergangswiderstand von Boden und Schuhen einer Person am Gehäuse. Mehr Widerstand bedeutet weniger Körperstrom.' },
    { key: 'fire', label: 'Körperschluss auslösen', type: 'button', ebene: null, group: G_F, help: 'Löst den Körperschluss aus: Die Fehlerschleife wird sichtbar, das Schutzorgan schaltet (wenn es kann), das Gehäusepotential steht als Balken im Bild.' }
  ];
  const METERS = [
    { key: 'zs', label: 'Schleifenimpedanz Zs', unit: 'Ω', digits: 3, min: 0, max: 60, help: 'Gesamtwiderstand der Fehlerschleife aus Netzimpedanz und Leitungswiderständen (TT: mit Erdern).' },
    { key: 'zsMax', label: 'Zs_max (TT: R_A,max)', unit: 'Ω', digits: 3, min: 0, max: 2000, zeroIsNone: true, help: 'Höchste zulässige Schleifenimpedanz aus U0 / Ia; im TT-System der Höchstwert von R_A (nur mit RCD). 0 heißt: kein Grenzwert.' },
    { key: 'ifehler', label: 'Fehlerstrom I_F', unit: 'A', digits: 1, min: 0, max: 2000, help: 'Strom an der Fehlerstelle bei Körperschluss.' },
    { key: 'ub', label: 'Berührungsspannung U_B', unit: 'V', digits: 1, min: 0, max: 250, warnAbove: 50, help: 'Spannung am Gehäuse gegen Erde. Die dauernd zulässige Grenze steht in ELS_CORE.limits.' },
    { key: 'tab', label: 'Abschaltzeit t_ab', unit: 's', digits: 3, min: 0, max: 5, zeroIsNone: true, help: 'Höchste Abschaltzeit des Schutzorgans bei diesem Fehlerstrom; 0 heißt: keine Abschaltung.' },
    { key: 'reserve', label: 'Reserve', unit: '', digits: 2, min: 0, max: 10, zeroIsNone: true, help: 'Grenzwert geteilt durch Istwert (TN: Zs_max / Zs, TT: R_A,max / R_A). Reserve 1,2 ist ein Lehrfaustwert, kein Normwert.' }
  ];
  const PRESETS = [
    { id: 'tns-ok', name: 'TN-S in Ordnung', info: 'Kurze Leitung mit 4 mm²: Abschaltbedingung erfüllt, Reserve und Berührungsspannung im grünen Bereich.', params: { form: 'TN-S', q: 4, qpe: 4, l: 20, zv: 0.4, dev: 'LS-B', In: 16, kreis: 'end', rcd: 0, fehler: 'koerperschluss' } },
    { id: 'tns-zulang', name: 'TN-S, Leitung zu lang', info: 'Lange Leitung mit LS-C: Zs wird größer als Zs_max, die Auslösung ist nicht sicher.', params: { form: 'TN-S', q: 2.5, qpe: 2.5, l: 200, zv: 0.4, dev: 'LS-C', In: 16, kreis: 'end', rcd: 0, fehler: 'koerperschluss' } },
    { id: 'tns-pe-bruch', name: 'TN-S, Schutzleiter unterbrochen', info: 'Fehlerbild: Ohne Schutzleiter fließt kein Schleifenstrom, der Leitungsschutz bleibt stumm.', params: { form: 'TN-S', q: 2.5, qpe: 2.5, l: 20, dev: 'LS-B', In: 16, rcd: 0, fehler: 'pe-unterbrochen' } },
    { id: 'tt-rcd', name: 'TT mit RCD 30 mA', info: 'TT: Der RCD schaltet ab, R_A liegt unter dem Höchstwert.', params: { form: 'TT', q: 2.5, qpe: 2.5, l: 20, ra: 50, rb: 2, dev: 'LS-B', In: 16, rcd: 30, fehler: 'koerperschluss' } },
    { id: 'it-fehler1', name: 'IT, erster Fehler', info: 'IT: Der erste Fehler schaltet nicht ab, die Isolationsüberwachung meldet.', params: { form: 'IT', q: 2.5, qpe: 2.5, l: 20, cleck: 50, dev: 'LS-B', In: 16, rcd: 0, fehler: 'koerperschluss' } },
    { id: 'bcd-vergleich', name: 'LS-Typ C bei langer Leitung', info: 'Typ C braucht mehr Strom zum Auslösen als Typ B: Bei gleicher Leitung wird die Reserve kleiner.', params: { form: 'TN-S', q: 2.5, qpe: 2.5, l: 60, zv: 0.4, dev: 'LS-C', In: 16, kreis: 'end', rcd: 0, fehler: 'koerperschluss' } }
  ];
  const PFAD = { fehler: 'Körperschluss: Außenleiter berührt das Gehäuse', weg: 'Außenleiter – Gehäuse – Schutzleiter – Netz (Fehlerschleife)', schutz: 'Abschaltung durch LS oder Sicherung, Potentialausgleich, RCD', art: 'indirekt' };
  const PARAMS = { rho: 0.0178, dispMs: 2600 };

  function plant(P0) {
    const CORE = P0.CORE;
    let fireT = -1;
    const ulAc = () => { try { const l = CORE.limit('ul_ac'); return l && isNum(l.value) ? l.value : 50; } catch (e) { return 50; } };
    const cfgOf = (ctl, params, fehler) => ({ form: ctl.form, U0: 230, zv: ctl.zv, q: ctl.q, qpe: ctl.qpe, l: ctl.l, rho: params.rho, dev: ctl.dev, In: ctl.In, kreis: ctl.kreis, ra: ctl.ra, rb: ctl.rb,
      rcd: { on: ctl.rcd > 0, idn: ctl.rcd > 0 ? ctl.rcd : 30, type: 'A' }, fehler, cleck: ctl.cleck, haut: ctl.haut, pfad: 'hand-fuss', rv: ctl.rv });

    function compute(ctl, params) {
      const cfg = cfgOf(ctl, params, ctl.fehler), cfgD = cfgOf(ctl, params, 'koerperschluss');
      const loop = CORE.grid.loop(cfg), design = CORE.grid.fault(cfgD), act = ctl.fehler === 'koerperschluss' ? design : CORE.grid.fault(cfg);
      if (!loop || loop.ok === false) return { ok: false, text: (loop && loop.why) || CORE.TEXTS.eingabe };
      if (!design || design.ok === false) return { ok: false, text: (design && design.why) || CORE.TEXTS.eingabe };
      if (!act || act.ok === false) return { ok: false, text: (act && act.why) || CORE.TEXTS.eingabe };
      const tn = ctl.form === 'TN-S' || ctl.form === 'TN-C-S';
      const r = { ok: true, cfg, cfgD, loop, design, act, tn, tt: null, it: null, maxLen: null, ctl };
      if (ctl.form === 'TT') { r.tt = CORE.grid.tt(cfgD); if (!r.tt || r.tt.ok === false) return { ok: false, text: (r.tt && r.tt.why) || CORE.TEXTS.eingabe }; }
      if (ctl.form === 'IT') r.it = CORE.grid.it(cfgD);
      if (tn || ctl.form === 'IT') r.maxLen = CORE.grid.maxLength(cfgD);
      r.eff = ctl.fehler === 'pe-unterbrochen' ? act : design;                       // Anzeige: tatsaechlicher Zustand bei unterbrochenem PE, sonst Auslegung bei Koerperschluss
      r.zs = isNum(loop.zs) ? loop.zs : 0;
      if (tn) { r.limit = design.zsMax; r.reserve = design.reserve; }
      else if (ctl.form === 'TT' && ctl.rcd > 0) { r.limit = r.tt.raMax; r.reserve = r.tt.raMax / ctl.ra; }
      else if (ctl.form === 'IT') { r.limit = design.zsMax; r.reserve = 0; }
      else { r.limit = 0; r.reserve = 0; }
      r.ul = ulAc();
      return r;
    }
    function meters(r) {
      if (!r || r.ok === false) return { zs: 0, zsMax: 0, ifehler: 0, ub: 0, tab: 0, reserve: 0 };
      const e = r.eff;
      return { zs: r.zs, zsMax: isNum(r.limit) ? r.limit : 0, ifehler: isNum(e.iF) ? e.iF : 0, ub: isNum(e.uB) ? e.uB : 0, tab: isNum(e.tAb) ? e.tAb : 0, reserve: isNum(r.reserve) && r.ctl.fehler !== 'pe-unterbrochen' ? r.reserve : 0 };
    }
    const resTxt = r => (isNum(r.reserve) && r.reserve > 0 ? ' Reserve ' + fm(r.reserve, 2) + ' (Lehrfaustwert ' + fm(RESERVE_MIN, 1) + ', kein Normwert).' : '');
    function assess(r, ctl) {
      if (!r || r.ok === false) return { ok: false, ampel: 'grau', text: (r && r.text) || CORE.TEXTS.eingabe };
      const d = r.design, a = r.act, pre = ctl.fehler === 'ohne' ? 'Auslegung geprüft (Körperschluss angenommen): ' : '';
      let ampel, text, margin;
      if (ctl.fehler === 'pe-unterbrochen') {
        if (a.zusatz && a.ausgeloest) { ampel = 'gelb'; text = a.text; }
        else { ampel = 'rot'; text = a.text; }
        return { ok: ampel !== 'rot', ampel, text, zusatz: a.rcd ? a.rcd.text : null };
      }
      if (ctl.form === 'IT') {
        ampel = ctl.fehler === 'ohne' ? 'gruen' : 'gelb';
        text = ctl.fehler === 'ohne' ? 'Kein Fehler im IT-System. ' + (r.it && r.it.text ? r.it.text : '') : d.text;
        return { ok: true, ampel, text };
      }
      if (ctl.form === 'TT') {
        if (!(ctl.rcd > 0)) return { ok: false, ampel: 'rot', text: pre + d.text };
        const rs = r.tt.raMax / ctl.ra;
        ampel = !r.tt.erfuellt ? 'rot' : rs < RESERVE_MIN ? 'gelb' : 'gruen';
        text = pre + r.tt.text + ' ' + (d.rcd ? d.rcd.text : '') + resTxt(r);
        return { ok: ampel !== 'rot', ampel, text, margin: rs, zusatz: ctl.rcd === 30 ? 'Zusatzschutz 30 mA vorhanden.' : null };
      }
      // TN-S und TN-C-S
      if (!d.bedingung) ampel = 'rot';
      else if (d.reserve < RESERVE_MIN || d.uB >= UB_NAH || d.uB > r.ul) ampel = 'gelb';
      else ampel = 'gruen';
      text = pre + d.text + resTxt(r);
      if (ampel === 'gelb' && d.bedingung && d.uB >= UB_NAH) text += ' Berührungsspannung ' + fm(d.uB, 1) + ' V ab ' + fm(UB_NAH, 0) + ' V (Lehrfaustwert) nahe an der Grenze von ' + fm(r.ul, 0) + ' V.';
      margin = d.reserve;
      return { ok: ampel !== 'rot', ampel, text, margin };
    }
    function diag(r, ctl) {
      const out = [];
      if (!r || r.ok === false) return out;
      const d = r.design, a = r.act;
      if (ctl.fehler === 'pe-unterbrochen') {
        out.push({ id: 'pe-unterbr', kind: 'error', text: (a.warn && a.warn[0]) || a.text });
        if (a.zusatz) out.push({ id: 'zusatz-ersetzt-nicht', kind: 'warn', text: CORE.TEXTS.zusatzErsetztNicht + ' ' + (a.rcd ? a.rcd.text : '') });
        return out;
      }
      if (r.tn) {
        if (d.zs > d.zsMax) out.push({ id: 'zs-zu-gross', kind: 'error', text: 'Zs = ' + fm(d.zs, 4) + ' Ω ist größer als Zs_max = ' + fm(d.zsMax, 4) + ' Ω: Die Abschaltbedingung ist verletzt.' });
        if (r.maxLen && r.maxLen.valid && ctl.l > r.maxLen.lMax) out.push({ id: 'leitung-zu-lang', kind: 'error', text: 'Die Leitung mit l = ' + fm(ctl.l, 1) + ' m ist länger als die höchste Länge l_max = ' + fm(r.maxLen.lMax, 1) + ' m.' });
        if (d.trip && d.trip.bereich === 'unsicher') out.push({ id: 'unsicher', kind: 'warn', text: d.trip.text });
        if (isNum(d.tAb) && d.tOK === false && d.zs <= d.zsMax) out.push({ id: 'tab-lang', kind: 'warn', text: 'Die Abschaltzeit ' + fm(d.tAb, 3) + ' s liegt über ' + fm(d.grenze, 1) + ' s.' });
      }
      if (d.uB > r.ul && !(ctl.form === 'TT' && d.ausgeloest)) out.push({ id: 'ub-gross', kind: 'warn', text: 'Die Berührungsspannung U_B = ' + fm(d.uB, 1) + ' V liegt über ' + fm(r.ul, 0) + ' V.' });
      if (ctl.form === 'TT') {
        if (!(ctl.rcd > 0)) out.push({ id: 'tt-ohne-rcd', kind: 'error', text: (d.warn && d.warn[0]) || d.text });
        else if (!r.tt.erfuellt) out.push({ id: 'tt-ra-gross', kind: 'error', text: 'R_A = ' + fm(ctl.ra, 1) + ' Ω ist größer als R_A,max = ' + fm(r.tt.raMax, 1) + ' Ω.' });
      }
      if (ctl.form === 'IT' && ctl.fehler === 'koerperschluss') out.push({ id: 'it-meldung', kind: 'info', text: d.meldung || d.text });
      return out;
    }
    function curves(r, ctl, params) {
      if (!r || r.ok === false) return [];
      const zs = [], zm = [];
      for (let k = 0; k <= 30; k++) {
        const l = Math.pow(200, k / 30);
        const lp = CORE.grid.loop(Object.assign({}, r.cfg, { l }));
        if (lp && lp.ok !== false && isNum(lp.zs)) zs.push([l, lp.zs]);
        if (isNum(r.limit) && r.limit > 0 && r.tn) zm.push([l, r.limit]);
      }
      const c1 = { id: 'zs-laenge', title: 'Schleifenimpedanz über der Leitungslänge', xLabel: 'Leitungslänge', xUnit: 'm', xScale: 'log', yLabel: 'Schleifenimpedanz Zs', yUnit: 'Ω', yScale: 'lin',
        series: [{ name: 'Zs', points: zs }].concat(zm.length ? [{ name: 'Zs_max', points: zm }] : []), marker: { x: ctl.l, y: r.zs, label: 'Zs = ' + fm(r.zs, 3) + ' Ω' } };
      if (r.tn && isNum(r.limit) && r.limit > 0) c1.limit = { y: r.limit, label: 'Zs_max = ' + fm(r.limit, 3) + ' Ω' };
      const band = CORE.prot.curve(ctl.dev, ctl.In) || [];
      const tmin = [], tmax = [];
      band.forEach(p => { if (p && isNum(p[0]) && isNum(p[1]) && p[1] > 0) tmin.push([p[0], p[1]]); if (p && isNum(p[0]) && isNum(p[2]) && p[2] > 0) tmax.push([p[0], p[2]]); });
      const c2 = { id: 'ausloesung', title: 'Auslösebereich des Schutzorgans (Lehrmodell)', xLabel: 'Strom als Vielfaches von In', xUnit: '× In', xScale: 'log', yLabel: 'Auslösezeit', yUnit: 's', yScale: 'log',
        series: [{ name: 'früheste Auslösung', points: tmin }, { name: 'späteste Auslösung', points: tmax }] };
      const e = r.design;
      if (isNum(e.iF) && e.iF > 0 && e.trip && isNum(e.trip.x)) { const ty = isNum(e.trip.tMax) ? e.trip.tMax : e.trip.tMin; if (isNum(ty) && ty > 0) c2.marker = { x: e.trip.x, y: ty, label: 'I_F = ' + fm(e.iF, 1) + ' A' }; }
      return [c1, c2];
    }
    // ---- Animation: Fehlerschleife, Abschaltung ----
    const tripAt = r => (r && r.eff && r.eff.ausgeloest ? (isNum(r.eff.tAb) && r.eff.tAb > 1 ? 2200 : 900) : Infinity);
    function draw(ctx, w, h, t, view, sc) {
      const R0 = sc.rect, pal = sc.pal, g = sc.gfx, r = view.res, fs = sc.fs, D = sc.D, ctl = view.ctl;
      if (!R0 || !(R0.w >= 240 && R0.h >= 170) || !r || r.ok === false) {
        if (R0 && r && r.ok === false) g.text(ctx, r.text || '', R0.x + 8, R0.y + 20, { size: fs, color: pal.rot, max: R0.w - 16 });
        return;
      }
      const narrow = R0.w < 640, chipH = 32, rows = R0.w < 480 ? 2 : 1;
      const botH = rows * (chipH + 6) + 44, top = { x: R0.x, y: R0.y, w: R0.w, h: R0.h - botH - 4 };
      const started = fireT >= 0, f = started ? (sc.reduced ? 1 : fireT) : 0;
      const e = r.eff, tAt = tripAt(r), tripped = started && f >= tAt;
      const hasLoop = ctl.fehler === 'koerperschluss' || (ctl.fehler === 'ohne' && started);
      const flowing = started && hasLoop && !tripped && isNum(e.iF) && e.iF > 0 && ctl.fehler !== 'pe-unterbrochen';
      const rate = flowing ? clamp(Math.log10(1 + e.iF) / Math.log10(1001), 0.12, 1) : 0;
      // ---- oben: Schleife und Kennlinienband ----
      const loopR = narrow ? { x: top.x, y: top.y, w: top.w, h: top.h >= 330 ? Math.round(top.h * 0.58) : top.h } : { x: top.x, y: top.y, w: Math.round(top.w * 0.6), h: top.h };
      const bandR = narrow ? (top.h >= 330 ? { x: top.x, y: top.y + loopR.h + 6, w: top.w, h: top.h - loopR.h - 6 } : null) : { x: top.x + loopR.w + 8, y: top.y, w: top.w - loopR.w - 8, h: top.h };
      let done = false;
      const st = { form: ctl.form, fault: ctl.fehler === 'ohne' && started ? 'koerperschluss' : ctl.fehler, rate, zs: r.zs, ul: r.ul, tripped };
      if (started) { st.ub = tripped ? 0 : (isNum(e.uB) ? e.uB : 0); if (isNum(e.iF)) st.iF = tripped ? 0 : e.iF; }
      if (D && typeof D.loopScene === 'function') {
        try {
          let ps = null;
          if (typeof D.loopPaths === 'function') { ps = sc.ps('schleife', D.loopPaths(loopR, { rate }).map(p => Object.assign({}, p, { color: p.color || pal.fehler, rate })), { speed: 110 }); }
          done = !!D.loopScene(ctx, loopR, st, { theme: sc.theme, particles: ps });
        } catch (er) { done = false; }
      }
      if (!done) {
        g.panel(ctx, loopR.x, loopR.y, loopR.w, loopR.h, pal.panel, pal.line, 8);
        g.text(ctx, ctl.form + ' · Zs ' + fm(r.zs, 3) + ' Ω · I_F ' + fm(e.iF, 1) + ' A', loopR.x + 10, loopR.y + 22, { size: fs, color: pal.fg, max: loopR.w - 20 });
      }
      sc.hit('fire', loopR.x, loopR.y, loopR.w, loopR.h);
      if (bandR && bandR.w >= 200 && bandR.h >= 140) {
        let ok2 = false;
        if (D && typeof D.tripBand === 'function') {
          try {
            const band = CORE.prot.curve(ctl.dev, ctl.In) || [];
            const o2 = { theme: sc.theme, name: ctl.dev + ' ' + ctl.In + ' A' };
            const dd = r.design;
            if (dd && isNum(dd.iF) && dd.iF > 0 && dd.trip && isNum(dd.trip.x) && dd.trip.x > 0) { const ty = isNum(dd.trip.tMax) ? dd.trip.tMax : dd.trip.tMin; o2.point = isNum(ty) && ty > 0 ? { x: dd.trip.x, t: ty } : { x: dd.trip.x }; }
            if (isNum(dd.ia) && dd.ia > 0) o2.xa = dd.ia / ctl.In;
            ok2 = !!D.tripBand(ctx, bandR, band, o2);
          } catch (er) { ok2 = false; }
        }
        if (!ok2) { g.panel(ctx, bandR.x, bandR.y, bandR.w, bandR.h, pal.panel, pal.line, 8); g.text(ctx, 'Auslösebereich ' + ctl.dev + ' ' + ctl.In + ' A', bandR.x + 10, bandR.y + 22, { size: fs, color: pal.mute, max: bandR.w - 20 }); }
      }
      // ---- unten: Tasten und Zeitbalken ----
      const by = R0.y + R0.h - botH, n = rows === 2 ? 2 : 4, cwid = Math.floor((R0.w - (n - 1) * 8) / n);
      const chips = [['Form ', ctl.form, 'form', B.ebeneColor('fehler', pal)], ['RCD ', ctl.rcd > 0 ? ctl.rcd + ' mA' : 'aus', 'rcd', B.ebeneColor('zusatz', pal)],
        ['', ctl.fehler === 'ohne' ? 'ohne Fehler' : ctl.fehler === 'koerperschluss' ? 'Körperschluss' : 'PE unterbrochen', 'fehler', pal.fehler], ['', 'Auslösen', 'fire', pal.fehler]];
      chips.forEach((c, i) => {
        const cx = R0.x + (i % n) * (cwid + 8), cy = by + Math.floor(i / n) * (chipH + 6);
        g.chip(ctx, c[0], c[1], cx, cy, cwid, chipH, pal, { color: c[3], on: c[2] === 'fire' && started, size: fs });
        sc.hit(c[2], cx, cy, cwid, chipH);
      });
      const bby = by + rows * (chipH + 6) + 14, lim = r.design.grenze;
      const tab = isNum(e.tAb) ? e.tAb : 0;
      const lab = tab > 0 ? 'Abschaltzeit ' + fm(tab, 3) + ' s (Grenze ' + fm(lim, 1) + ' s)' : 'keine Abschaltung durch das Schutzorgan';
      g.text(ctx, lab, R0.x, bby - 4, { size: fs, color: pal.mute, max: R0.w });
      g.bar(ctx, R0.x, bby, R0.w, 14, tab > 0 ? tab : 0, Math.max(lim * 2, tab), tab > lim || tab === 0 ? pal.rot : pal.gruen, pal, lim);
    }
    return {
      compute, meters, assess, diag, curves: (r, ctl) => curves(r, ctl), draw,
      phaseHz: () => 0.4,
      step(dtMs) { if (fireT >= 0 && fireT < PARAMS.dispMs + 400) fireT += dtMs; },
      fire() {
        const c = P0.ctl;
        if (c.fehler === 'ohne') P0.setCtl('fehler', 'koerperschluss');
        fireT = 0;
        const rr = compute(P0.ctl, P0.params), e = rr && rr.eff;
        if (rr && rr.ok && e) {
          P0.say('Körperschluss ausgelöst: ' + e.text, e.ausgeloest ? 'info' : 'warn');
        }
        return true;
      },
      onControl() { fireT = -1; },
      reset() { fireT = -1; },
      state(r) { return { zs: r && r.ok ? r.zs : 0, iF: r && r.ok && isNum(r.eff.iF) ? r.eff.iF : 0, uB: r && r.ok && isNum(r.eff.uB) ? r.eff.uB : 0, ausgeloest: !!(r && r.ok && r.eff.ausgeloest), gestartet: fireT >= 0 }; }
    };
  }

  const INFO = 'Fehlerschleife und Abschaltbedingung in TN-S, TN-C-S, TT und IT: Zs aus Leitungswiderständen, Fehlerstrom, Berührungsspannung und Abschaltzeit (Übungswerte). Simulation, kein Hinweis für Arbeiten an Netzspannung.';
  R.register({ id: 'netz', name: 'Netzform und Fehlerschleife', icon: '🔁', info: INFO, controls: CONTROLS, meters: METERS, presets: PRESETS,
    create(opts) { return B.makeRig({ id: 'netz', name: 'Netzform und Fehlerschleife', icon: '🔁', info: INFO, world: { w: 960, h: 600 }, pfad: PFAD, controls: CONTROLS, meters: METERS, presets: PRESETS, params: PARAMS, plant }, opts); } });
})(typeof window !== 'undefined' ? window : globalThis);
