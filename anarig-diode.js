/* anarig-diode.js - ANA-Lab (WP2a): Pruefstand 1 `diode` - Dioden, LED und Z-Diode mit Vorwiderstand (SPEC 5.1).
 * Die gemeinsame Huelle (Steuerwerte, Cache, Ampel, Vorher/Nachher, Zeitlupe, Zeichenhuelle, verdeckter Fehler) liegt in anarig-base.js: Diese Datei im Browser NACH anarig-base.js laden
 * (in Node holt sie sich die Basis per require). Gerechnet wird NUR im Kern (ANA_CORE.diode.operating / curve / rvFor); hier steht keine zweite Formel.
 * Alle Zahlen sind Uebungswerte. Simulation fuer Kleinspannung, kein Hinweis fuer Arbeiten an Netzspannung.
 * Modell: Exponentialkennlinie oder konstante Flussspannung, keine Sperrverzoegerung, Gleichgroessen (Beharrungszustand).
 * Steuerwerte: typ, modell, uq (V), rv (Ohm, log), uz (V, nur Z-Diode), rlast (Ohm, nur Z-Diode, oberer Anschlag = Leerlauf), temp (Grad C), fehler, ziel (A, Vorgabe Strom, 0 = keine).
 * Messgeraete: ud (V), id (mA), ur (V), pr (mW), pd (mW), rd (Ohm), us (V, Schwellspannung), iz (mA).
 * Fehlerfall-Umsetzung (vor dem Kernaufruf): verpolt -> uq := -|uq|; diode offen -> Bauteil als nie leitend (Z-Diode mit sehr hoher Z-Spannung, uq := |uq|), kein Strom im Bauteil;
 *   diode kurz -> konstantes Modell mit U_Z = 0,1 V (Z-Diode mit U_Z = 0,1 V fuer alle Bauteile, Konstante UZ_KURZ; ABWEICHUNGEN WP2a Nr. 1), den Strom bestimmt der Vorwiderstand; rv offen -> I = 0 (Messwerte des offenen Strompfads, ABWEICHUNGEN WP2a Nr. 3).
 * fire(): Spannungsdurchlauf, die Quellenspannung steigt von 0 V bis zum eingestellten Wert (Zeitlupe beachtet).
 */
(function (root) {
  'use strict';
  const R = root.ANA_RIGS = root.ANA_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };
  if (typeof module !== 'undefined') module.exports = R;
  if (!R.base && typeof require === 'function') { try { require('./anarig-base.js'); } catch (e) { /* Basis fehlt */ } }
  const B = R.base;
  if (!B) { if (typeof console !== 'undefined') console.warn('anarig-diode.js: Die Basis anarig-base.js fehlt (bitte davor laden).'); return; }
  const { clamp, num, fm, isNum, eng, val } = B;

  let C0 = null; try { C0 = B.core(); } catch (e) { C0 = null; }
  const K = fn => { try { return C0 ? fn(C0) : ''; } catch (e) { return ''; } };
  const LT = id => K(c => c.limitText(id));
  const MODELL = 'Modell: ' + (((C0 && C0.TEXTS && C0.TEXTS.modellDiode) || 'Exponentialkennlinie oder konstante Flussspannung.').replace(/^Lehrmodell [^:]*: /, '')) + ' Keine Sperrverzögerung, alle Werte sind Übungswerte (F1, F2, F3).';
  const OFFEN = K(c => c.R_OFFEN) || 1e12;
  const UZ_OFFEN = 1000;      // Z-Spannung, die nie erreicht wird: Bauteil sperrt immer (Fehlerfall "diode offen")
  const UZ_KURZ = 0.1;        // Spannung am Bauteil im Fehlerfall "diode kurz" (Z-Diode mit U_Z = 0,1 V, konstantes Modell)

  const opt = arr => arr.map(a => ({ value: a[0], label: a[1] }));
  const TYPEN = [['si', 'Silizium-Diode'], ['schottky', 'Schottky-Diode'], ['led_rot', 'LED rot'], ['led_gelb', 'LED gelb'], ['led_gruen', 'LED grün'], ['led_blau', 'LED blau'], ['z', 'Z-Diode']];
  const CONTROLS = B.fillControls([
    { key: 'typ', label: 'Bauteil', type: 'select', value: 'led_rot', options: opt(TYPEN), gruppe: 'bauteile', sicht: 'kennlinie',
      help: 'Das Bauteil: Silizium-Diode, Schottky-Diode, vier LED-Farben oder Z-Diode. Die Flussspannungen sind Übungswerte (' + LT('uf_si') + ' belegt für Silizium; Schottky, LED: Übungswerte, F2). Die Z-Diode arbeitet in Sperrrichtung im Durchbruch.' },
    { key: 'modell', label: 'Kennlinienmodell', type: 'select', value: 'kennlinie', options: opt([['kennlinie', 'Exponentialkennlinie'], ['konstant', 'konstante Flussspannung']]), gruppe: 'ziel', sicht: 'kennlinie',
      help: 'Exponentialkennlinie: I = I_S · (e^(U/(n · U_T)) − 1), die Flussspannung hängt leicht vom Strom ab. Konstante Flussspannung: Die Diode leitet ideal mit festem U_F, so rechnen die Prüfungsaufgaben. Beide Modelle sind Lehrmodelle (F1).' },
    { key: 'uq', label: 'Quellenspannung U_q', type: 'slider', scale: 'lin', min: -30, max: 30, step: 0.1, unit: 'V', unitKind: 'V', value: 5, gruppe: 'quelle', sicht: 'formel',
      help: 'Spannung der Quelle in Zählrichtung der Schaltung. Negative Werte heißen verpolt: Die Spannung liegt dann gegen die Betriebsrichtung. Kleinspannung (' + LT('u_klein') + '). Übungswert.' },
    { key: 'rv', label: 'Vorwiderstand R_V', type: 'slider', scale: 'log', min: 1, max: 1e6, step: 1, unit: 'Ω', unitKind: 'Ω', value: 330, gruppe: 'bauteile', sicht: 'formel',
      help: 'Der Vorwiderstand begrenzt den Strom: R_V = (U_q − U_F) / I_F. Ein größerer Vorwiderstand ergibt einen kleineren Strom. Ohne ausreichenden Vorwiderstand ist die LED überlastet (nur Simulation, Übungswert).' },
    { key: 'uz', label: 'Z-Spannung U_Z', type: 'slider', scale: 'lin', min: 2.4, max: 30, step: 0.1, unit: 'V', unitKind: 'V', value: 5.1, gruppe: 'bauteile', sicht: 'kennlinie', visible: s => s.typ === 'z',
      help: 'Durchbruchspannung der Z-Diode in Sperrrichtung. Die Voreinstellung ' + LT('uz_std') + ' ist ein Übungswert (F20). Erst über dieser Spannung fließt ein Strom in Sperrrichtung.' },
    { key: 'rlast', label: 'Lastwiderstand R_L (oberer Anschlag = Leerlauf)', type: 'slider', scale: 'log', min: 10, max: 1e6, step: 1, unit: 'Ω', unitKind: 'Ω', value: 1e6, gruppe: 'last', sicht: 'formel', visible: s => s.typ === 'z',
      help: 'Last parallel zur Z-Diode. Am oberen Anschlag (1 MΩ) gilt die Anlage als unbelastet. Mit Last teilt sich der Strom: I_q = I_Z + I_L.' },
    { key: 'temp', label: 'Temperatur', type: 'slider', scale: 'lin', min: -20, max: 120, step: 1, unit: '°C', unitKind: '°C', value: 27, gruppe: 'quelle', sicht: 'kennlinie',
      help: 'Temperatur des Bauteils. Die Flussspannung sinkt mit steigender Temperatur (' + LT('tk_uf') + ', F3); bezogen auf ' + LT('temp_ref') + '. Die Z-Diode im Durchbruch bleibt in diesem Modell unverändert.' },
    { key: 'fehler', label: 'Fehlerfall', type: 'select', value: 'keiner', options: opt([['keiner', 'kein Fehler'], ['verpolt', 'Diode verpolt'], ['diode offen', 'Diode offen'], ['diode kurz', 'Diode Kurzschluss'], ['rv offen', 'Vorwiderstand offen']]), gruppe: 'fehler', sicht: 'formel',
      help: 'Fehlerfall für die Fehlersuche (nur Simulation): verpolt, Diode offen, Diode mit Kurzschluss oder Vorwiderstand offen. Die Messwerte zeigen den Fehler sofort; erkläre ihn aus U_D, I_D und U_R.' },
    { key: 'ziel', label: 'Vorgabe Strom I (0 = keine)', type: 'slider', scale: 'lin', min: 0, max: 0.1, step: 0.0001, unit: 'A', unitKind: 'A', value: 0, gruppe: 'ziel', sicht: 'formel',
      help: 'Vorgabe für den Strom durch das Bauteil (Z-Diode: Strom im Durchbruch). Bei 0 A ist keine Vorgabe gesetzt und die Ampel bleibt grau. Die Ampelfenster sind Lehrfaustwerte (Übungswerte, F16).' }
  ]);
  const METERS = [
    { key: 'ud', label: 'Spannung am Bauteil U_D', unit: 'V', digits: 3, min: -30, max: 30, help: 'Spannung am Bauteil in Betriebsrichtung (Z-Diode: Sperrrichtung). Negativ heißt: Das Bauteil liegt gegen seine Betriebsrichtung.' },
    { key: 'id', label: 'Strom I_D', unit: 'mA', digits: 3, min: -100, max: 100, warnAbove: 20, help: 'Strom durch das Bauteil in Betriebsrichtung (Z-Diode: Strom im Durchbruch). Die Warnmarke ist der zulässige LED-Strom (Übungswert).' },
    { key: 'ur', label: 'Spannung am Vorwiderstand U_R', unit: 'V', digits: 3, min: -30, max: 30, help: 'Spannung am Vorwiderstand: U_R = U_q − U_D. Bei offenem Vorwiderstand fällt die ganze Spannung hier ab.' },
    { key: 'pr', label: 'Verlustleistung R_V', unit: 'mW', digits: 2, min: 0, max: 1000, help: 'Leistung im Vorwiderstand, P_R = U_R · I. Prüfe, ob der Widerstand sie verträgt.' },
    { key: 'pd', label: 'Verlustleistung Bauteil', unit: 'mW', digits: 2, min: 0, max: 1000, help: 'Leistung im Bauteil, P_D = U_D · I. Bei der Z-Diode gibt es einen Grenzwert (Übungswert, F2).' },
    { key: 'rd', label: 'Dynamischer Widerstand r_d', unit: 'Ω', digits: 2, min: 0, max: 1e5, infAbove: 1e11, help: 'Steigung der Kennlinie im Arbeitspunkt, dU/dI. Beim konstanten Modell ist er 0; sperrt das Bauteil, gibt es keinen Wert (Anzeige 0).' },
    { key: 'us', label: 'Schwellspannung U_S', unit: 'V', digits: 3, min: 0, max: 30, help: 'Schnittpunkt der Tangente im Arbeitspunkt mit der Spannungsachse, U_S = U_D − I · r_d. Eine Näherung zur Veranschaulichung; beim konstanten Modell gleich der Flussspannung.' },
    { key: 'iz', label: 'Strom im Durchbruch I_Z', unit: 'mA', digits: 3, min: -100, max: 100, help: 'Strom der Z-Diode im Durchbruch (nur beim Bauteil Z-Diode ungleich 0).' }
  ];
  const PRESETS = [
    { id: 'led-24v', name: 'LED an 24 V',
      info: K(c => { const r = c.diode.operating({ typ: 'led_rot', modell: 'konstant', uq: 24, rv: 3300 }); return 'Übungsschaltung: LED mit U_F = ' + val(r.uf, 'V') + ' an 24 V mit 3,3 kΩ ergibt I = ' + val(r.id * 1000, 'mA') + '.'; }),
      controls: { typ: 'led_rot', modell: 'konstant', uq: 24, rv: 3300 } },
    { id: 'si-1k', name: 'Silizium-Diode 5 V mit 1 kΩ',
      info: K(c => { const r = c.diode.operating({ typ: 'si', modell: 'kennlinie', uq: 5, rv: 1000 }); return 'Kennlinienmodell: U_D = ' + val(r.ud, 'V') + ', I = ' + val(r.id * 1000, 'mA') + ', r_d = ' + val(r.rd, 'Ω') + '.'; }),
      controls: { typ: 'si', modell: 'kennlinie', uq: 5, rv: 1000 } },
    { id: 'schottky', name: 'Schottky-Diode',
      info: K(c => { const r = c.diode.operating({ typ: 'schottky', modell: 'kennlinie', uq: 5, rv: 1000 }); return 'Die Schottky-Diode hat die kleinere Flussspannung: U_D = ' + val(r.ud, 'V') + ', I = ' + val(r.id * 1000, 'mA') + ' (Übungswerte).'; }),
      controls: { typ: 'schottky', modell: 'kennlinie', uq: 5, rv: 1000 } },
    { id: 'z-12v', name: 'Z-Diode an 12 V',
      info: K(c => { const r = c.diode.operating({ typ: 'z', modell: 'konstant', uq: 12, rv: 470, uz: 5.1, rlast: 4700 }); return 'Übungsschaltung: Z-Diode ' + val(5.1, 'V') + ' an 12 V mit 470 Ω und Last 4,7 kΩ ergibt I_Z = ' + val(r.iz * 1000, 'mA') + '.'; }),
      controls: { typ: 'z', modell: 'konstant', uq: 12, rv: 470, uz: 5.1, rlast: 4700 } },
    { id: 'led-ohne-rv', name: 'LED mit viel zu kleinem Vorwiderstand (Fehlerbild)',
      info: K(c => { const r = c.diode.operating({ typ: 'led_rot', modell: 'kennlinie', uq: 5, rv: 1 }); return 'Fehlerbild, nur Simulation: Bei R_V = 1 Ω fließt I = ' + val(r.id, 'A') + ' durch die LED, zulässig sind ' + c.limitText('led_imax') + '. Das ist eine Überlast.'; }),
      controls: { typ: 'led_rot', modell: 'kennlinie', uq: 5, rv: 1 } },
    { id: 'verpolt', name: 'Diode verpolt (Fehlerbild)',
      info: K(c => { const r = c.diode.operating({ typ: 'led_rot', modell: 'kennlinie', uq: -5, rv: 330 }); return 'Fehlerbild, nur Simulation: Die Spannung liegt in Sperrrichtung (U_D = ' + val(r.ud, 'V') + '), es fließt kein Strom (I = ' + val(r.id * 1000, 'mA') + ').'; }),
      controls: { typ: 'led_rot', modell: 'kennlinie', uq: -5, rv: 330 } }
  ];
  const SICHT = { kennlinie: 'Kennlinie I(U) mit Widerstandsgerade und Arbeitspunkt', signal: 'Strom und Spannungen im Arbeitspunkt (Gleichgrößen)', formel: 'R_V = (U_q − U_F) / I_F' };
  const INFO = 'Dioden, LED und Z-Diode mit Vorwiderstand. Der Arbeitspunkt ist der Schnittpunkt von Kennlinie und Widerstandsgerade. Kennlinie, Schaltbild und Rechenweg zeigen dieselbe Schaltung. ' + MODELL;
  const FEHLER_TEXT = { 'verpolt': 'Diode verpolt', 'diode offen': 'Diode offen', 'diode kurz': 'Diode Kurzschluss', 'rv offen': 'Vorwiderstand offen' };

  function plant(P0) {
    const CORE = P0.CORE;
    let sweepP = 1, sweeping = false;
    const fmt = (x, d) => { try { return CORE.fmt(x, d); } catch (e) { return fm(x, d); } };
    const engF = (x, u) => { try { return CORE.fmtEng(x, u); } catch (e) { return eng(x, u); } };
    const lim = id => B.limV(CORE, id, NaN);
    const isLed = t => /^led_/.test(t);
    const mA = x => val(x * 1000, 'mA');
    const LV = (id, k, u) => val(lim(id) * k, u) + ' (Übungswert)';

    /** Fehlerfall -> Kern-Eingaben; liefert { cfg, flags }. */
    function build(ctl) {
      const uqEff = ctl.uq * sweepP;
      const cfg = { typ: ctl.typ, modell: ctl.modell, uq: uqEff, rv: ctl.rv, temp: ctl.temp };
      const fl = { offen: false, kurz: false, rvOffen: false, verpolt: false, sign: 1 };
      if (ctl.typ === 'z') { cfg.uz = ctl.uz; cfg.rlast = ctl.rlast; }
      switch (ctl.fehler) {
        case 'verpolt': cfg.uq = -Math.abs(uqEff); fl.verpolt = true; break;
        case 'rv offen': cfg.rv = OFFEN; fl.rvOffen = true; break;
        case 'diode kurz':
          fl.kurz = true; fl.sign = uqEff < 0 ? -1 : 1;
          cfg.typ = 'z'; cfg.modell = 'konstant'; cfg.uz = UZ_KURZ; cfg.uq = Math.abs(uqEff);
          if (ctl.typ !== 'z') delete cfg.rlast; else cfg.rlast = ctl.rlast;
          break;
        case 'diode offen':
          fl.offen = true; fl.sign = uqEff < 0 ? -1 : 1;
          cfg.typ = 'z'; cfg.uz = UZ_OFFEN; cfg.uq = Math.abs(uqEff);
          if (ctl.typ !== 'z') delete cfg.rlast;
          break;
        default: break;
      }
      return { cfg, fl };
    }

    function compute(ctl) {
      const b = build(ctl), cfg = b.cfg, fl = b.fl;
      const r = CORE.diode.operating(cfg);
      if (!r || r.ok === false) return { ok: false, why: (r && r.why) || CORE.TEXTS.eingabe || 'Die Eingaben sind ungültig.' };
      const o = Object.assign({}, r);
      o.fl = fl; o.cfg = cfg;
      if ((fl.offen || fl.kurz) && fl.sign < 0) { o.ud = -o.ud; o.ur = -o.ur; o.iq = -o.iq; o.ilast = -o.ilast; o.id = -o.id; o.iz = -o.iz; }
      o.typ = ctl.typ;
      o.zustand = fl.offen || fl.rvOffen ? 'offen' : r.zustand;
      if (fl.offen) { o.id = 0; o.iz = 0; o.pd = 0; o.rd = NaN; o.us = NaN; o.ueberlast = false; }
      // Offener Vorwiderstand: kein Strompfad, das Bauteil liegt auf 0 V, am Widerstand steht die ganze Quellenspannung (der Kern kennt "offen" nur als sehr grossen Widerstand)
      if (fl.rvOffen) { o.ud = 0; o.id = 0; o.iz = 0; o.iq = 0; o.ilast = 0; o.ur = ctl.uq * sweepP; o.pr = 0; o.pd = 0; o.rd = NaN; o.us = NaN; o.ueberlast = false; }
      if (fl.kurz) o.ueberlast = false;
      o.istI = ctl.typ === 'z' ? (fl.offen || fl.rvOffen ? 0 : o.iz) : o.id;
      if (!fl.offen && !fl.rvOffen && ctl.typ === 'z' && r.zustand === 'verpolt') o.istI = o.id;
      o.uqEff = ctl.uq * sweepP;
      o.r27 = null;
      if (Math.abs(ctl.temp - lim('temp_ref')) > 1e-9 && !fl.offen && !fl.kurz) {
        const c2 = Object.assign({}, cfg, { temp: lim('temp_ref') });
        const q = CORE.diode.operating(c2); if (q && q.ok !== false) o.r27 = q;
      }
      o.rvSoll = NaN;
      if (ctl.ziel > 0 && !fl.offen) {
        const uf = ctl.typ === 'z' ? ctl.uz : r.ud, iSum = ctl.ziel + (ctl.typ === 'z' ? r.ilast : 0);
        const q = CORE.diode.rvFor({ uq: Math.abs(ctl.uq), uf, i: iSum });
        if (isNum(q)) o.rvSoll = q; else if (q && isNum(q.rv)) o.rvSoll = q.rv;
      }
      return Object.assign({ ok: true }, o);
    }

    function meters(r) {
      if (!r.ok) return { ud: 0, id: 0, ur: 0, pr: 0, pd: 0, rd: 0, us: 0, iz: 0 };
      return { ud: r.ud, id: r.id * 1000, ur: r.ur, pr: r.pr * 1000, pd: r.pd * 1000, rd: isNum(r.rd) ? r.rd : 0, us: isNum(r.us) ? r.us : 0, iz: r.typ === 'z' ? r.iz * 1000 : 0 };
    }

    function assess(r, ctl, o) {
      if (!r.ok) return { ok: false, ampel: 'rot', text: r.why };
      const soll = ctl.ziel, ist = r.istI, pct = Math.abs(ist - soll) / soll * 100, verd = !!(o && o.verdeckt);
      const base = B.devText(r.typ === 'z' ? 'Strom im Durchbruch' : 'Strom', ist, soll, 'A', pct, CORE);
      const zi = { text: 'Strom ' + val(soll, 'A'), soll, ist, unit: 'A' };
      if (r.ueberlast) {
        return { ok: false, ampel: 'rot', text: 'Überlast: ' + (r.typ === 'z' ? 'Die Verlustleistung des Bauteils (' + val(r.pd * 1000, 'mW') + ') liegt über dem Grenzwert' : 'Der Strom (' + mA(r.id) + ') liegt über dem zulässigen LED-Strom') + ' (' + (r.typ === 'z' ? LV('pz_max', 1000, 'mW') : LV('led_imax', 1000, 'mA')) + '). ' + base, margin: pct, ziel: zi };
      }
      if (r.zustand === 'sperrt' || r.zustand === 'offen' || r.zustand === 'verpolt' || !(ist > 0)) {
        return { ok: false, ampel: 'rot', text: verd ? base + ' Es fließt kein Strom in Betriebsrichtung.' : (r.zustand === 'verpolt' ? 'Die Spannung liegt gegen die Betriebsrichtung, es fließt kein Strom in Betriebsrichtung. ' : 'Das Bauteil leitet nicht: I = ' + mA(Math.abs(ist)) + '. ') + base, margin: pct, ziel: zi };
      }
      const amp = B.devAmpel(pct, CORE);
      let text = base;
      if (amp === 'gruen') text += ' Die Vorgabe ist erreicht.';
      else text += ist < soll ? ' Der Strom ist zu klein.' : ' Der Strom ist zu groß.';
      if (isNum(r.rvSoll) && amp !== 'gruen') text += ' Für die Vorgabe passt R_V = ' + engF(r.rvSoll, 'Ω') + '.';
      return { ok: amp === 'gruen', ampel: amp, text, margin: pct, ziel: zi };
    }

    function diag(r, ctl) {
      const out = [];
      if (!r.ok) { out.push({ id: 'ungueltig', kind: 'error', text: r.why }); return out; }
      const f = ctl.fehler, led = isLed(ctl.typ);
      if (led && r.cfg.rv <= 10 && !r.fl.rvOffen && !r.fl.offen) out.push({ id: 'led-ohne-rv', kind: 'error', text: 'Der Vorwiderstand ist nur R_V = ' + engF(r.cfg.rv, 'Ω') + ': Den Strom begrenzt fast nur noch die Kennlinie. I_D = ' + val(r.id, 'A') + ', P_D = ' + val(r.pd, 'W') + ': Überlast für die LED (nur Simulation).' });
      if (led && r.ueberlast && !r.fl.offen) out.push({ id: 'led-ueberstrom', kind: 'warn', text: 'Der Strom I_D = ' + mA(r.id) + ' liegt über dem zulässigen LED-Strom von ' + LV('led_imax', 1000, 'mA') + ': Überlast für das Bauteil.', verraet: false });
      if (r.zustand === 'verpolt' && !r.fl.offen) {
        if (ctl.typ === 'z') out.push({ id: 'diode-verpolt', kind: 'warn', text: 'Die Z-Diode liegt in Durchlassrichtung (U_D = ' + val(r.ud, 'V') + ', I = ' + mA(r.id) + '): kein Durchbruch, sondern Durchlass wie bei einer Silizium-Diode.', verraet: f === 'verpolt' });
        else out.push({ id: 'diode-verpolt', kind: 'warn', text: 'Die Spannung liegt in Sperrrichtung (U_D = ' + val(r.ud, 'V') + '): Es fließt kein Strom (I_D = ' + mA(r.id) + '). Die Diode ist verpolt.', verraet: f === 'verpolt' });
      }
      if (ctl.typ === 'z' && r.zustand === 'sperrt' && !r.fl.rvOffen && !r.fl.offen && !r.fl.kurz) out.push({ id: 'z-unter-uz', kind: 'info', text: 'Die Spannung am Bauteil (U_D = ' + val(r.ud, 'V') + ') liegt unter U_Z = ' + val(ctl.uz, 'V') + ': Die Z-Diode bricht nicht durch, es fließt kein Strom in Sperrrichtung.' });
      if (ctl.typ === 'z' && r.ueberlast && !r.fl.offen) out.push({ id: 'z-ueberlast', kind: 'warn', text: 'Die Verlustleistung der Z-Diode P_Z = ' + val(r.pd * 1000, 'mW') + ' liegt über dem Grenzwert ' + LV('pz_max', 1000, 'mW') + ': Überlast für das Bauteil.' });
      if (r.r27 && isNum(r.r27.ud)) {
        const dU = (r.ud - r.r27.ud) * 1000;
        if (Math.abs(dU) >= 0.1) out.push({ id: 'uf-temp', kind: 'info', text: 'Bei ' + val(ctl.temp, '°C') + ' statt ' + LT('temp_ref') + ' ist die Spannung am Bauteil um ' + val(dU, 'mV') + ' verschoben (' + LT('tk_uf') + ', F3).' });
      }
      if (f === 'rv offen') out.push({ id: 'rv-offen', kind: 'error', text: 'Der Strom ist null (I_D = ' + mA(r.id) + '): Der Vorwiderstand ist offen, an ihm fällt die Quellenspannung U_R = ' + val(r.ur, 'V') + ' ab.', verraet: true });
      if (f === 'diode offen') out.push({ id: 'diode-offen', kind: 'error', text: 'Der Strom ist null, an der Diode liegt die Quellenspannung (U_D = ' + val(r.ud, 'V') + '): Die Diode ist offen.', verraet: true });
      if (f === 'diode kurz') out.push({ id: 'diode-kurz', kind: 'error', text: 'An der Diode liegen nur noch U_D = ' + val(r.ud * 1000, 'mV') + ': Die Diode hat einen Kurzschluss, den Strom (I = ' + mA(r.id) + ') bestimmt nur noch der Vorwiderstand.', verraet: true });
      return out;
    }
    function befund(r) {
      if (!r.ok) return [];
      return [{ id: 'befund', kind: 'info', text: 'Messbefund: U_D = ' + val(r.ud, 'V') + ', I_D = ' + mA(r.id) + ', U_R = ' + val(r.ur, 'V') + '.' }];
    }

    // ---- Kennlinie ----
    function lin(a, b, n) { const o = []; for (let k = 0; k < n; k++) o.push(a + (b - a) * k / (n - 1)); return o; }
    function ranges(r, ctl) {
      const z = ctl.typ === 'z';
      const ymaxA = Math.abs(r.istI) > 1e-6 ? Math.abs(r.istI) * 1.7 : clamp(Math.abs(r.uqEff) / Math.max(r.cfg.rv, 1), 1e-3, 0.02);
      let x0 = 0, x1;
      if (r.ud < 0) { x0 = r.ud * 1.2; x1 = z ? 1 : 1; } else x1 = Math.max(r.ud * 1.35, z ? ctl.uz * 1.3 : 0.5);
      if (r.fl.offen) { x0 = Math.min(0, r.ud * 1.1); x1 = Math.max(Math.abs(r.ud) * 1.1, 1); if (ctl.typ === 'z') x1 = Math.max(x1, ctl.uz * 1.3); }
      if (!(x1 > x0)) x1 = x0 + 1;
      return { x0, x1, y1: ymaxA * 1000 };
    }
    function curves(r, ctl) {
      if (!r.ok) return [];
      const rg = ranges(r, ctl), cfgC = Object.assign({}, r.cfg);
      let us = lin(rg.x0, rg.x1, 150); us.push(r.ud);
      us = us.filter(isNum).sort((a, b) => a - b).filter((v, i, a) => i === 0 || v !== a[i - 1]);
      const clip = (arr, iArr) => {
        const lim = rg.y1 * 1.15, pts = [];
        for (let k = 0; k < arr.length; k++) {
          const y = iArr[k] * 1000; if (!isNum(y)) continue;
          if (y <= lim) pts.push([arr[k], y]);
          else { if (k > 0 && iArr[k - 1] * 1000 <= lim) { const y0 = iArr[k - 1] * 1000, f = (lim - y0) / (y - y0); pts.push([arr[k - 1] + (arr[k] - arr[k - 1]) * f, lim]); } break; }
        }
        return pts;
      };
      const cv = CORE.diode.curve(cfgC, us);
      const series = [];
      const main = cv && cv.ok !== false ? clip(cv.u, cv.i) : [];
      if (main.length >= 2) series.push({ name: ctl.typ === 'z' ? 'Kennlinie der Z-Diode' : 'Kennlinie', points: main, kind: 'i' });
      // Widerstandsgerade I = (U_q - U) / R_V (bei Last: Teilung im Z-Zweig), nur fuer positive Quellenspannung
      const uq = r.uqEff, rv = r.cfg.rv, rl = ctl.typ === 'z' && !r.fl.offen ? ctl.rlast : OFFEN;
      if (uq > 0 && rv < OFFEN / 10) {
        const i0 = uq / rv * 1000, xi = uq * rl / (rv + rl);
        let a = [0, i0], b = [xi, 0];
        if (a[1] > rg.y1) a = [xi * (1 - rg.y1 / i0), rg.y1];
        if (b[0] > rg.x1) b = [rg.x1, i0 * (1 - rg.x1 / xi)];
        if (a[0] < rg.x0) a = [rg.x0, i0 * (1 - rg.x0 / xi)];
        if (b[0] > a[0] + 1e-9 && isNum(a[0] + a[1] + b[0] + b[1])) series.push({ name: 'Widerstandsgerade', points: [a, b], kind: 'line' });
      }
      if (ctl.modell === 'kennlinie' && isNum(r.us) && isNum(r.rd) && r.rd > 0 && r.zustand === 'leitet' && !r.fl.offen) {
        const xe = r.us + rg.y1 / 1000 * r.rd;
        series.push({ name: 'Tangente (Schwellspannung)', points: [[r.us, 0], [Math.min(xe, rg.x1), (Math.min(xe, rg.x1) - r.us) / r.rd * 1000]], kind: 'tangent' });
      }
      if (ctl.typ !== 'z') {
        ['si', 'schottky', 'led_rot'].filter(t => t !== ctl.typ).slice(0, 3).forEach((t, k) => {
          if (series.length >= 6) return;
          const gc = CORE.diode.curve({ typ: t, modell: ctl.modell, uq: 5, rv: 1000, temp: cfgC.temp }, us);
          if (gc && gc.ok !== false) { const pts = clip(gc.u, gc.i); if (pts.length >= 2) series.push({ name: { si: 'Silizium', schottky: 'Schottky', led_rot: 'LED rot' }[t], points: pts, kind: 'ghost', ghost: true }); }
          void k;
        });
      }
      const cvo = { id: 'kennlinie', title: 'Kennlinie mit Arbeitspunkt', xLabel: 'Spannung U_D', xUnit: 'V', xScale: 'lin', yLabel: 'Strom I_D', yUnit: 'mA', series,
        marker: { x: r.ud, y: r.id * 1000, label: 'Arbeitspunkt: ' + val(r.ud, 'V') + ' | ' + val(r.id * 1000, 'mA') }, xRange: [rg.x0, rg.x1], yRange: [-rg.y1 * 0.04, rg.y1] };
      if (isLed(ctl.typ)) cvo.limit = { y: lim('led_imax') * 1000, name: 'I_max', sym: false };
      return [cvo];
    }

    // ---- Zeichnen ----
    function labelsFor(r, ctl) {
      const z = ctl.typ === 'z';
      const L = { uq: 'U_q = ' + val(r.uqEff, 'V'), id: (z ? 'I_Z = ' : 'I_D = ') + val(r.id * 1000, 'mA'), ud: 'U_D = ' + val(r.ud, 'V'), ur: 'U_R = ' + val(r.ur, 'V') };
      if (z && ctl.rlast < 1e6) L.il = 'I_L = ' + val(r.ilast * 1000, 'mA');
      return L;
    }
    function draw(ctx, w, h, t, view, sc) {
      const r = view.res, pal = sc.pal, R0 = sc.rect, gap = 8, ctl = view.ctl;
      if (!r || !r.ok) { sc.gfx.text(ctx, (r && r.why) || '', R0.x + 8, R0.y + 20, { size: 13, color: pal.fg, max: R0.w - 16 }); return; }
      const wide = R0.w >= 640;
      let kR, sR, fR;
      if (wide) {
        const lw = Math.round(R0.w * 0.52) - gap / 2, rw = R0.w - lw - gap, sh = Math.round(R0.h * 0.56);
        kR = { x: R0.x, y: R0.y, w: lw, h: R0.h }; sR = { x: R0.x + lw + gap, y: R0.y, w: rw, h: sh - gap / 2 }; fR = { x: R0.x + lw + gap, y: R0.y + sh + gap / 2, w: rw, h: R0.h - sh - gap / 2 };
      } else {
        const h1 = Math.round(R0.h * 0.4), h2 = Math.round(R0.h * 0.32);
        kR = { x: R0.x, y: R0.y, w: R0.w, h: h1 - gap }; sR = { x: R0.x, y: R0.y + h1, w: R0.w, h: h2 - gap }; fR = { x: R0.x, y: R0.y + h1 + h2, w: R0.w, h: R0.h - h1 - h2 };
      }
      const cs = curves(r, ctl);
      if (cs[0] && !sc.view('curve', kR, cs[0], {})) { sc.gfx.panel(ctx, kR.x, kR.y, kR.w, kR.h, pal.panel, pal.line, 6); sc.gfx.text(ctx, 'Kennlinie nicht darstellbar', kR.x + 8, kR.y + 22, { size: 12, color: pal.mute, max: kR.w - 16 }); }
      const verd = view.verdeckt, f = ctl.fehler;
      const data = { kind: 'diode', typ: ctl.typ, values: { uq: val(ctl.uq, 'V'), rv: engF(ctl.rv, 'Ω') }, labels: labelsFor(r, ctl) };
      if (ctl.typ === 'z') { data.values.uz = val(ctl.uz, 'V'); if (ctl.rlast < 1e6) data.values.rlast = engF(ctl.rlast, 'Ω'); }
      if (!verd && f !== 'keiner') {
        data.fault = f === 'rv offen' ? 'rv' : 'diode'; data.faultText = 'Fehlerstelle: ' + FEHLER_TEXT[f];
        if (f === 'verpolt') data.rev = true;
      }
      if (!sc.view('schematic', sR, data, {})) { sc.gfx.panel(ctx, sR.x, sR.y, sR.w, sR.h, pal.panel, pal.line, 6); }
      // Formel mit Zahlen
      sc.gfx.panel(ctx, fR.x, fR.y, fR.w, fR.h, pal.panel, pal.line, 6);
      const rows = [{ t: 'R_V = (U_q − U_F) / I_F', bold: true, color: pal.u }];
      const uqs = val(r.uqEff, 'V');
      if (ctl.typ === 'z') {
        rows.push({ t: 'U_R = U_q − U_Z = ' + uqs + ' − ' + val(r.ud, 'V') + ' = ' + val(r.ur, 'V') });
        rows.push({ t: 'I_q = U_R / R_V = ' + mA(r.iq) + (ctl.rlast < 1e6 ? ',  I_L = U_Z / R_L = ' + mA(r.ilast) : '') });
        rows.push({ t: 'I_Z = I_q − I_L = ' + mA(r.iz), bold: true });
      } else {
        rows.push({ t: 'U_R = U_q − U_D = ' + uqs + ' − ' + val(r.ud, 'V') + ' = ' + val(r.ur, 'V') });
        rows.push({ t: 'I = U_R / R_V = ' + mA(r.id), bold: true });
        rows.push({ t: 'P_R = ' + val(r.pr * 1000, 'mW') + ',  P_D = ' + val(r.pd * 1000, 'mW') });
      }
      if (isNum(r.rd) && r.rd > 0) rows.push({ t: 'r_d = ' + val(r.rd, 'Ω') + ',  U_S = ' + val(r.us, 'V') });
      if (isNum(r.rvSoll)) rows.push({ t: 'Für die Vorgabe: R_V = ' + engF(r.rvSoll, 'Ω'), color: pal.out, bold: true });
      rows.push({ t: ctl.modell === 'konstant' ? 'Modell: konstante Flussspannung (Übungswert)' : 'Modell: Exponentialkennlinie (Übungswerte)', color: pal.mute });
      sc.gfx.lines(ctx, fR, rows, pal, { size: sc.fs, lh: sc.fs + 5 });
      if (sweeping) sc.gfx.text(ctx, 'Spannungsdurchlauf: U_q = ' + val(r.uqEff, 'V'), kR.x + kR.w - 8, kR.y + kR.h - 8, { size: 11, color: pal.fg, bg: pal.panel, align: 'right', max: kR.w - 16 });
    }

    function state(r, ctl) {
      if (!r.ok) return { valid: false, why: r.why, sweep: sweeping, sweepP, uqEff: ctl.uq * sweepP };
      return { valid: true, zustand: r.zustand, typ: r.typ, ud: r.ud, id: r.id, iz: r.iz, ur: r.ur, pr: r.pr, pd: r.pd, rd: isNum(r.rd) ? r.rd : 0, us: isNum(r.us) ? r.us : 0, ilast: r.ilast, iq: r.iq, ueberlast: !!r.ueberlast,
        istI: r.istI, rvSoll: isNum(r.rvSoll) ? r.rvSoll : 0, sweep: sweeping, sweepP, uqEff: r.uqEff, uf: isNum(r.uf) ? r.uf : 0 };
    }
    return {
      compute, meters, assess, diag, befund, curves, state, draw,
      phaseHz: () => 0,
      fire() {
        if (sweeping) { sweeping = false; sweepP = 1; P0.say('Spannungsdurchlauf abgebrochen.', 'info'); P0.bump(); return true; }
        sweeping = true; sweepP = 0; P0.say('Spannungsdurchlauf gestartet: Die Quellenspannung steigt von 0 V bis zum eingestellten Wert, der Arbeitspunkt wandert auf der Kennlinie.', 'info');
        P0.bump(); return true;
      },
      step(dtMs) {
        if (!sweeping) return;
        sweepP = Math.min(1, sweepP + dtMs / 4000);
        if (sweepP >= 1) { sweeping = false; sweepP = 1; P0.say('Spannungsdurchlauf beendet.', 'info'); }
        P0.bump();
      },
      reset() { sweeping = false; sweepP = 1; }
    };
  }

  R.register({ id: 'diode', name: 'Dioden, LED und Z-Diode', icon: '➡️', info: INFO, controls: CONTROLS, meters: METERS, presets: PRESETS,
    create(opts) { return B.makeRig({ id: 'diode', name: 'Dioden, LED und Z-Diode', icon: '➡️', info: INFO, world: { w: 960, h: 600 }, sicht: SICHT, controls: CONTROLS, meters: METERS, presets: PRESETS,
      zielKeys: ['ziel'], params: {}, plant }, opts); } });
})(typeof window !== 'undefined' ? window : globalThis);
