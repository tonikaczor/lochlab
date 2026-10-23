/* ntscore-sw.js - Netzteil-Lab Kern Teil 2 (NTS_CORE): Schaltregler (buck, boost, bb, fly, topology), Verluste (loss), Gate (gate), Regelkreis (loop), Labornetzteil (lab)
 * SPEC 4.5 bis 4.9. Reine Rechnung, keine DOM-Zugriffe. Erweitert DENSELBEN Namensraum wie ntscore.js (muss VOR dieser Datei geladen sein).
 * Browser: window.NTS_CORE, Node: module.exports / globalThis.NTS_CORE. Vanilla-JS, kein eval, kein Math.random, keine Datumsabfrage.
 *
 * ===================================================================================================
 * ALLGEMEINES
 *  - Einheiten im Kern: SI (V, A, Ohm, W, Hz, s, F, H). Die Anzeige rechnet mit fmtEng/fmt um. Wave-Zeitachse in us (tUnit 'µs').
 *  - Alle oeffentlichen Funktionen mit guard: Unsinn wirft nie (Rechenfunktionen NaN, Strukturfunktionen { ok:false, why }).
 *  - Schaltregler im Gleichspannungsmodell mit IDEALEN Bauteilen (Schalter, Diode, Drossel, Kondensator); Verluste getrennt in loss.*.
 *    Formeln ausserhalb des Gueltigkeitsbereichs melden ok:false mit Text oder lueckt:true, sie rechnen nie still weiter.
 *  - Topologien (kind): 'buck' Tiefsetzsteller, 'boost' Hochsetzsteller, 'bb' Inverswandler (Buck-Boost, Ausgang negativ; Zahlen als Betrag),
 *    'fly' Sperrwandler (Uebertrager mit Luftspalt, n = N2/N1, Lm auf die Primaerseite bezogen, potentialgetrennt).
 *  - Verlaeufe (wave): der ESR wirkt nur auf die Anzeige u_aus (ESR mal Kondensatorstrom); seine Rueckwirkung auf den Laststrom (esr/R, unter 0,3 %) ist nicht
 *    modelliert. Die Phasenformeln sind exakt (stueckweise linearer Drosselstrom, Kondensatorspannung durch exaktes Integral mit Mittelwert
 *    null); der Test vergleicht sie mit einer unabhaengigen Zeitschritt-Simulation (RK4).
 *
 * ===================================================================================================
 * SCHNITTSTELLEN (Kurzfassung; SPEC 4.5 bis 4.9 massgeblich, Abweichungen in quelle/ntslab/ABWEICHUNGEN.md)
 *  buck.ccm(cfg) ; buck.dcm(cfg) ; buck.wave(cfg, nPts) ; buck.lcrit(cfg) ; buck.ripple(cfg)
 *  boost.ccm/.dcm/.wave ; bb.ccm/.dcm/.wave ; fly.ccm/.dcm/.wave ; fly.power(cfg) ; topology(need)
 *  loss.parts(cfg) ; loss.eta(cfg) ; loss.curve(cfg, 'I'|'f', lo, hi, n) ; loss.vsLinear(cfg)
 *  gate.drive(cfg) ; gate.switching(cfg) ; gate.deadtime(cfg) ; gate.sweepRg(cfg, list)
 *  loop.divider(cfg) ; loop.step(cfg) ; loop.stability(cfg) ; lab.cvcc(cfg) ; lab.ilim(cfg) ; lab.short(cfg)
 *  cfg-Felder (Auswahl): Uin, Uout | D, f (Hz), L (H), C (F), Iout (A), Rlast (Ohm), esr (Ohm), n (N2/N1)
 * ===================================================================================================
 */
(function (root) {
  'use strict';
  const C = root.NTS_CORE = root.NTS_CORE || {};
  if (!C.guard || !C.util || !C.limit) {
    if (typeof console !== 'undefined') console.warn('ntscore-sw.js: ntscore.js muss zuerst geladen werden.');
    return;
  }
  const U = C.util;
  const num = U.num, pos = U.pos, nn = U.nn, fin = U.fin;
  const fail = U.fail, has = U.has, hide = U.hide;
  const G_ = function (fn) { return C.guard(fn, 'num'); };
  const S_ = function (fn) { return C.guard(fn, 'struct'); };
  const fmtEng = C.fmtEng, fmt = C.fmt;
  const TEXTS = C.TEXTS;
  const LV = function (id) { return C.limitValue(id); };
  function isObj(o) { return o !== null && typeof o === 'object' && !Array.isArray(o); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  const PI = Math.PI;
  const EPS = 1e-9;

  /* ---------- zusaetzliche Grenzwerte (Lehrfaustwerte, Frage F11) ---------- */
  function addLimit(id, value, unit, cmp, frage, text) {
    if (C.limit(id)) return;
    C.limits.push({ id: id, value: value, unit: unit, cmp: cmp, status: 'A', quelle: '—', frage: frage, text: text });
  }
  addLimit('pm_min', 45, '°', '>=', 'F11', 'Phasenreserve des Regelkreises: ab hier grün (Lehrfaustwert).');
  addLimit('pm_rot', 30, '°', '>=', 'F11', 'Phasenreserve des Regelkreises: darunter rot, dazwischen gelb (Lehrfaustwert).');
  addLimit('regel_band', 2, '%', '=', 'F11', 'Toleranzband für die Ausregelzeit (Lehrmodell).');

  /* ---------- Meldungstexte (id wie SPEC 4.10; ntscore-diag.js darf sie ueberschreiben) ---------- */
  const D = TEXTS.diag;
  function dText(id, kind, text, extra) { if (!has(D, id)) { D[id] = { kind: kind, text: text }; if (extra) for (const k in extra) D[id][k] = extra[k]; } }
  dText('lueckt', 'warn', 'Lückbetrieb: Der Drosselstrom fällt in jeder Periode auf null (Ausgangsstrom {iout} unter der Grenze {ikrit}). Die Formel für nicht lückenden Betrieb gilt hier nicht, gerechnet wird mit der Lückformel.');
  dText('l-zu-klein', 'warn', 'Die Drossel ({l}) ist kleiner als die Grenze für nicht lückenden Betrieb ({lkrit}) bei der kleinsten Last.');
  dText('delta-i-gross', 'warn', 'Die Drosselwelligkeit ΔI_L = {dil} ist größer als {faktor} mal der Ausgangsstrom ({grenze}; Lehrfaustwert). Eine größere Drossel oder eine höhere Schaltfrequenz verkleinert sie.');
  dText('d-grenze', 'warn', 'Das Tastverhältnis {d} liegt außerhalb des Bereichs {dmin} bis {dmax} (Lehrfaustwert): Die Regelung hat kaum noch Spielraum.');
  dText('topologie-falsch', 'error', 'Diese Grundschaltung kann die gewünschte Ausgangsspannung nicht erzeugen: {grund}');
  dText('ug-zu-klein', 'error', 'Die Gate-Spannung {ug} erreicht die Plateauspannung {uplat} nicht: Der MOSFET schaltet nicht durch. Gegenprobe: ab {ugmin} ({uplat} plus 2 V Reserve) schaltet er sicher.');
  dText('querstrom', 'error', 'Die Totzeit {tot} ist kürzer als die Ausschaltzeit {toff}: Beide Schalter der Halbbrücke leiten gleichzeitig ({tueber} Überlappung), der Querstrom ist ein Kurzschluss der Versorgung.');
  dText('schaltverlust-gross', 'warn', 'Der Schaltverlust {psw} beträgt {anteil} der Ausgangsleistung (Lehrfaustwert: über 1 %). Ein kleinerer Gate-Widerstand schaltet schneller, stört aber stärker (Link EMV).', { link: 'emvlab.html' });
  dText('regler-schwingt', 'error', 'Die Phasenreserve beträgt nur {pm} (Lehrfaustwert: mindestens {pmmin}): Der Regelkreis neigt zum Schwingen, der Ausgang schwingt nach einem Lastsprung nach.');
  dText('r1-offen', 'error', 'R1 (Teilerwiderstand nach Masse) ist offen: Die Rückkopplung sieht die volle Ausgangsspannung und regelt auf die Referenzspannung {uref}. Der Ausgang ist viel zu niedrig.');
  dText('r2-offen', 'error', 'R2 (Teilerwiderstand zum Ausgang) ist offen: Die Rückkopplung sieht 0 V, der Regler dreht auf und der Ausgang steigt bis zum Anschlag ({uanschlag}).');
  dText('cc-aktiv', 'info', 'Konstantstrombetrieb (CC): Der Lastwiderstand {r} liegt unter dem Grenzwiderstand {rkrit}, der Strom ist auf {iset} begrenzt, die Spannung sinkt auf {uout}.');
  dText('cv-aktiv', 'info', 'Konstantspannungsbetrieb (CV): Der Lastwiderstand {r} liegt über dem Grenzwiderstand {rkrit}, die Spannung bleibt {uset}, der Strom ist {iout}.');
  dText('ungeregelt', 'info', 'Ungeregelt (offene Steuerung): Die Ausgangsspannung folgt dem Produkt aus Tastverhältnis und Eingangsspannung und ändert sich mit ihr.');
  dText('kurzschluss-boost', 'info', 'Kurzschluss am Ausgang eines Hochsetzstellers ist nicht begrenzbar: Der Strom fließt über Drossel und Diode am Schalter vorbei.');

  /* =====================================================================================================
   *  Hilfsfunktionen: stueckweise lineare Verlaeufe (exakt integrierbar)
   * ===================================================================================================== */
  /* seg = { t0, t1, y0, y1 }, Liste ueber eine Periode (Luecken = 0 werden vom Aufrufer als Segment eingefuegt) */
  function segEval(segs, tp) {
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      if (tp >= s.t0 && tp < s.t1) return s.y0 + (s.y1 - s.y0) * (tp - s.t0) / (s.t1 - s.t0);
    }
    const l = segs[segs.length - 1];
    return l.y1;
  }
  /* Kumuliertes Integral Q(t) (t in einer Periode) und Mittelwert von Q ueber die Periode; segs lueckenlos und aufsteigend */
  function segIntegrator(segs, T) {
    const Q0 = [];
    let q = 0, qm = 0;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i], h = s.t1 - s.t0;
      Q0.push(q);
      const sl = h > 0 ? (s.y1 - s.y0) / h : 0;
      qm += q * h + s.y0 * h * h / 2 + sl * h * h * h / 6;
      q += s.y0 * h + sl * h * h / 2;
    }
    return {
      total: q, mean: qm / T,
      at: function (tp) {
        for (let i = 0; i < segs.length; i++) {
          const s = segs[i];
          if (tp >= s.t0 && tp < s.t1) {
            const h = s.t1 - s.t0, d = tp - s.t0, sl = (s.y1 - s.y0) / h;
            return Q0[i] + s.y0 * d + sl * d * d / 2;
          }
        }
        return q;
      }
    };
  }
  function pc(t0, t1, y) { return { t0: t0, t1: t1, y0: y, y1: y }; }

  /* =====================================================================================================
   *  Arbeitspunkt (Kern aller Wandler): ideal, CCM oder DCM
   *  kind: 'buck' | 'boost' | 'bb' | 'fly'. Rueckgabe op oder { ok:false, why }.
   *  Zulaessige Vorgaben (Uin, f, L immer; fly: n = N2/N1, Standard 1):
   *   (a) Uout (geregelt) + Iout oder Rlast: D stellt sich so ein, dass Uout gilt (CCM; wird die Drossel lueckend, DCM mit passendem D)
   *   (b) D + Rlast (ungeregelt): Uout folgt aus Last und D (CCM oder DCM)
   *   (c) D + Iout (Stromlast, nur CCM) oder Uout/D allein (nur Formeln, ohne Last)
   * ===================================================================================================== */
  const KINDS = { buck: 1, boost: 1, bb: 1, fly: 1 };
  const NAMES = { buck: 'Tiefsetzsteller', boost: 'Hochsetzsteller', bb: 'Inverswandler', fly: 'Sperrwandler' };
  function vOn(kind, Uin, Uo) { return kind === 'buck' ? Uin - Uo : Uin; }                      /* Drosselspannung im Einschaltintervall */
  function vOff(kind, Uin, Uo, n) { return kind === 'buck' ? Uo : (kind === 'boost' ? Uo - Uin : (kind === 'bb' ? Uo : Uo / n)); }
  function dCcm(kind, Uin, Uo, n) {
    if (kind === 'buck') return Uo / Uin;
    if (kind === 'boost') return 1 - Uin / Uo;
    if (kind === 'bb') return Uo / (Uin + Uo);
    return Uo / (Uo + n * Uin);
  }
  function uCcm(kind, Uin, D, n) {
    if (kind === 'buck') return D * Uin;
    if (kind === 'boost') return Uin / (1 - D);
    if (kind === 'bb') return Uin * D / (1 - D);
    return n * Uin * D / (1 - D);
  }
  function iLavgCcm(kind, Iout, D, n) {            /* Mittelwert des Drosselstroms (Primaerseite bei fly) */
    if (kind === 'buck') return Iout;
    if (kind === 'fly') return n * Iout / (1 - D);
    return Iout / (1 - D);
  }
  function uDcm(kind, Uin, D, K, R, f, L) {         /* K = 2 L f / R */
    if (kind === 'buck') return Uin * 2 / (1 + Math.sqrt(1 + 4 * K / (D * D)));
    if (kind === 'boost') return Uin * (1 + Math.sqrt(1 + 4 * D * D / K)) / 2;
    if (kind === 'bb') return Uin * D / Math.sqrt(K);
    return Uin * D * Math.sqrt(R / (2 * L * f));
  }
  function dDcm(kind, Uin, Uo, K, R, f, L) {        /* Tastverhaeltnis fuer gegebenes Uo im Lueckbetrieb */
    const M = Uo / Uin;
    if (kind === 'buck') { const a = 2 / M - 1; return 2 * Math.sqrt(K) / Math.sqrt(a * a - 1); }
    if (kind === 'boost') return Math.sqrt(K * M * (M - 1));
    if (kind === 'bb') return M * Math.sqrt(K);
    return Uo / (Uin * Math.sqrt(R / (2 * L * f)));
  }
  function d2Dcm(kind, Uin, Uo, D, n) {
    if (kind === 'buck') return D * (Uin - Uo) / Uo;
    if (kind === 'boost') return D * Uin / (Uo - Uin);
    if (kind === 'bb') return D * Uin / Uo;
    return D * Uin * n / Uo;
  }
  function checkBasics(kind, cfg) {
    if (!has(KINDS, kind)) return fail('Unbekannte Grundschaltung.');
    if (!isObj(cfg)) return fail('Eingabe fehlt.');
    if (!pos(cfg.Uin)) return fail('Die Eingangsspannung muss größer als 0 sein.');
    if (!pos(cfg.f)) return fail('Die Schaltfrequenz muss größer als 0 sein.');
    if (!pos(cfg.L)) return fail('Die Induktivität muss größer als 0 sein.');
    if (kind === 'fly' && cfg.n !== undefined && !pos(cfg.n)) return fail('Das Übersetzungsverhältnis n = N2/N1 muss größer als 0 sein.');
    if (cfg.C !== undefined && !pos(cfg.C)) return fail('Die Kapazität muss größer als 0 sein.');
    if (cfg.esr !== undefined && !nn(cfg.esr)) return fail('Der ESR darf nicht negativ sein.');
    return null;
  }
  function uoutCheck(kind, Uin, Uo) {
    if (!pos(Uo)) return 'Die Ausgangsspannung muss (als Betrag) größer als 0 sein.';
    if (kind === 'buck' && Uo >= Uin) return 'Ausgangsspannung ≥ Eingangsspannung: Ein Tiefsetzsteller kann nur kleinere Spannungen erzeugen, ein Hochsetzsteller ist nötig.';
    if (kind === 'boost' && Uo <= Uin) return 'Ausgangsspannung ≤ Eingangsspannung: Ein Hochsetzsteller kann nur größere Spannungen erzeugen, ein Tiefsetzsteller ist nötig.';
    return null;
  }
  function operating(kind, cfg) {
    const bad = checkBasics(kind, cfg);
    if (bad) return bad;
    const Uin = cfg.Uin, f = cfg.f, L = cfg.L, T = 1 / f;
    const n = kind === 'fly' ? (cfg.n === undefined ? 1 : cfg.n) : 1;
    const hasUo = cfg.Uout !== undefined, hasD = cfg.D !== undefined;
    let R = NaN, Iout = NaN;
    if (cfg.Rlast !== undefined) { if (!pos(cfg.Rlast)) return fail('Der Lastwiderstand muss größer als 0 sein.'); R = cfg.Rlast; }
    if (cfg.Iout !== undefined) { if (!nn(cfg.Iout)) return fail('Der Ausgangsstrom darf nicht negativ sein.'); Iout = cfg.Iout; }
    if (!hasUo && !hasD) return fail('Es fehlt die Ausgangsspannung oder das Tastverhältnis.');
    const op = { ok: true, kind: kind, name: NAMES[kind], Uin: Uin, f: f, T: T, L: L, n: n, C: cfg.C, esr: cfg.esr === undefined ? 0 : cfg.esr };
    let Uo, Dd;
    if (hasUo) {
      /* (a) geregelt: Uout vorgegeben */
      Uo = Math.abs(cfg.Uout);
      if (cfg.Uout < 0 && kind !== 'bb') return fail('Eine negative Ausgangsspannung erzeugt nur der Inverswandler.', { text: 'topologie-falsch' });
      const m = uoutCheck(kind, Uin, Uo); if (m) return fail(m);
      Dd = dCcm(kind, Uin, Uo, n);
      op.geregelt = true;
      if (!fin(Iout) && fin(R)) Iout = Uo / R;
      if (!fin(R) && fin(Iout) && Iout > 0) R = Uo / Iout;
    } else {
      /* (b)/(c) D vorgegeben */
      if (!(typeof cfg.D === 'number' && fin(cfg.D) && cfg.D > 0)) return fail('Das Tastverhältnis muss größer als 0 sein.');
      if (cfg.D >= 1) return fail('Das Tastverhältnis muss kleiner als 1 (100 %) sein.');
      Dd = cfg.D; op.geregelt = false;
      Uo = uCcm(kind, Uin, Dd, n);
      if (fin(R)) Iout = Uo / R; /* Last gibt den Strom vor (CCM), im Lueckbetrieb unten neu */
    }
    op.D = Dd; op.Uout = Uo; op.Iout = Iout; op.R = R;
    /* CCM-Kennzahlen */
    const Von = vOn(kind, Uin, Uo);
    let dIL = Von * Dd / (f * L);
    op.mode = 'ccm'; op.D2 = 1 - Dd; op.D3 = 0;
    if (fin(Iout)) {
      const avg = iLavgCcm(kind, Iout, Dd, n);
      if (avg < dIL / 2 - EPS * Math.max(1, dIL)) {
        /* Lueckbetrieb */
        if (!fin(R) || !(R > 0)) {
          if (Iout === 0) return fail('Ohne Last (Ausgangsstrom 0) gibt es keinen Arbeitspunkt im Lückbetrieb; Last angeben.');
          return fail('Lückbetrieb: Für diese Stromlast ist die Drossel zu klein oder die Last zu gering. Gib einen Lastwiderstand Rlast an.');
        }
        const K = 2 * L * f / R;
        if (op.geregelt) {
          Dd = dDcm(kind, Uin, Uo, K, R, f, L);
        } else {
          Uo = uDcm(kind, Uin, Dd, K, R, f, L);
        }
        if (!(Dd > 0) || !(Uo > 0) || !fin(Dd) || !fin(Uo)) return fail('Für diese Vorgaben gibt es keinen Arbeitspunkt (Lückformel nicht lösbar).');
        const D2 = d2Dcm(kind, Uin, Uo, Dd, n);
        if (Dd + D2 > 1 + 1e-9) {
          return fail('Für diese Vorgaben gibt es keinen stationären Arbeitspunkt: Die Last ist zu klein für die Drossel und das Tastverhältnis.');
        }
        op.mode = 'dcm'; op.D = Dd; op.Uout = Uo; op.D2 = D2; op.D3 = Math.max(0, 1 - Dd - D2);
        op.Iout = Uo / R; op.K = K;
        dIL = vOn(kind, Uin, Uo) * Dd / (f * L);
      }
    }
    op.Von = vOn(kind, Uin, Uo); op.Voff = vOff(kind, Uin, op.Uout, n);
    op.dIL = vOn(kind, Uin, op.Uout) * op.D / (f * L);     /* Anstieg im Einschaltintervall = Spitze-Spitze (CCM) bzw. Spitzenstrom (DCM) */
    if (op.mode === 'ccm') {
      if (fin(op.Iout)) {
        op.ILavg = iLavgCcm(kind, op.Iout, op.D, n);
        op.ILmin = op.ILavg - op.dIL / 2; op.ILpk = op.ILavg + op.dIL / 2;
      }
    } else {
      op.ILmin = 0; op.ILpk = op.dIL; op.ILavg = op.dIL * (op.D + op.D2) / 2;
    }
    return op;
  }

  /* Grenzstrom zwischen nicht lueckendem und lueckendem Betrieb bei der Ausgangsspannung des Arbeitspunkts:
   * Drosselstrom-Mittelwert = dIL/2 mit dem Tastverhaeltnis des nicht lueckenden Betriebs (L: an der Drossel, out: am Ausgang). */
  function ikritFor(kind, op) {
    const Dc = dCcm(kind, op.Uin, op.Uout, op.n);
    const dI = vOn(kind, op.Uin, op.Uout) * Dc / (op.f * op.L);
    const h = dI / 2;
    return { L: h, out: kind === 'buck' ? h : (kind === 'fly' ? (1 - Dc) * h / op.n : (1 - Dc) * h) };
  }

  /* gemeinsame Kennzahlen und Hinweise zu einem Arbeitspunkt */
  function ccmReport(kind, cfg) {
    const op = operating(kind, cfg);
    if (op.ok === false) return op;
    const out = { ok: true, kind: kind, name: op.name, Uin: op.Uin, Uout: kind === 'bb' ? -op.Uout : op.Uout, Uabs: op.Uout, D: op.D, f: op.f, T: op.T, L: op.L, C: op.C, n: kind === 'fly' ? op.n : undefined,
      Iout: op.Iout, R: op.R, mode: op.mode, geregelt: op.geregelt, status: 'ideal (Lehrmodell)', diag: [] };
    out.D2 = op.D2; out.D3 = op.D3;
    out.dIL = op.dIL; out.ILavg = op.ILavg; out.ILmin = op.ILmin; out.ILmax = op.ILpk;
    /* kritischer Strom: ILavg = dIL/2 (Drossel), umgerechnet auf den Ausgang */
    const ik = ikritFor(kind, op);
    out.IkritL = ik.L;
    out.Ikrit = ik.out;
    out.ccm = op.mode === 'ccm';
    out.lueckt = op.mode === 'dcm';
    /* Welligkeit der Ausgangsspannung */
    let dUc = NaN, dUesr = NaN;
    if (fin(op.C) || op.C !== undefined) {
      if (kind === 'buck') dUc = op.dIL / (8 * op.f * op.C);
      else if (fin(op.Iout)) dUc = op.Iout * op.D / (op.f * op.C);
    }
    if (kind === 'buck') dUesr = op.dIL * op.esr;
    else if (fin(op.ILpk)) dUesr = (kind === 'fly' ? op.ILpk / op.n : op.ILpk) * op.esr;
    out.dUc = dUc; out.dUesr = dUesr; out.esr = op.esr;
    out.dU = fin(dUc) ? dUc + (fin(dUesr) ? dUesr : 0) : (fin(dUesr) && op.esr > 0 ? dUesr : NaN);
    out.dUText = 'Spitze-Spitze: Kapazitätsanteil plus ESR-Anteil (Summe = obere Näherung, Lehrmodell)';
    /* Hinweise (nur gerechnete Fakten) */
    if (out.lueckt) out.diag.push(TEXTS.get('lueckt', { iout: fmtEng(cfg.Iout !== undefined ? cfg.Iout : op.Iout, 'A'), ikrit: fmtEng(out.Ikrit, 'A') }));
    const dmin = LV('d_min') / 100, dmax = LV('d_max') / 100;
    if (op.D < dmin || op.D > dmax) out.diag.push(TEXTS.get('d-grenze', { d: fmt(op.D * 100, 1) + ' %', dmin: fmt(dmin * 100, 0) + ' %', dmax: fmt(dmax * 100, 0) + ' %' }));
    if (fin(op.Iout) && op.Iout > 0 && out.ccm && op.dIL > LV('dil_max') * op.Iout) {
      const gr = kind === 'buck' ? LV('dil_max') * op.Iout : LV('dil_max') * (out.ILavg);
      if (op.dIL > gr) out.diag.push(TEXTS.get('delta-i-gross', { dil: fmtEng(op.dIL, 'A'), faktor: fmt(LV('dil_max')), grenze: fmtEng(gr, 'A') }));
    }
    if (kind === 'boost') out.diag.push(TEXTS.get('kurzschluss-boost'));
    if (!op.geregelt && out.ccm) out.diag.push(TEXTS.get('ungeregelt'));
    hide(out, '_op', op);
    return out;
  }

  /* =====================================================================================================
   *  Verlaeufe (wave): exakte Phasenformeln; cfg wie operating() plus periods (Standard 3), esr, C
   *  Rueckgabe { ok, tUnit:'µs', t[], series:[{name,y,unit}], marks, mode, D, D2, Uout, ... }
   * ===================================================================================================== */
  function waveFor(kind, cfg, nPts) {
    const op = operating(kind, cfg);
    if (op.ok === false) return op;
    if (!pos(op.C)) return fail('Für den Spannungsverlauf fehlt die Ausgangskapazität C.');
    if (!fin(op.Iout) || !(op.Iout >= 0)) return fail('Für den Verlauf fehlt der Laststrom oder der Lastwiderstand.');
    const N = clamp(Math.round(num(nPts, 400)), 8, 20000);
    const per = clamp(Math.round(num(cfg.periods, 3)), 1, 50);
    const T = op.T, D = op.D, D2 = op.D2, D3 = op.D3;
    const Ts = D * T, Tf = D2 * T;
    const Ipk = op.ILpk, Imin = op.ILmin, Uo = op.Uout, Uin = op.Uin, n = op.n;
    /* Drosselstrom */
    const iLs = [{ t0: 0, t1: Ts, y0: Imin, y1: Ipk }];
    if (op.mode === 'ccm') iLs.push({ t0: Ts, t1: T, y0: Ipk, y1: Imin });
    else {
      iLs.push({ t0: Ts, t1: Ts + Tf, y0: Ipk, y1: 0 });
      if (D3 > 0) iLs.push(pc(Ts + Tf, T, 0));
    }
    /* Diodenstrom (Sekundaerstrom bei fly), Schalterstrom nicht noetig */
    const sc = kind === 'fly' ? 1 / n : 1;
    const iDs = [pc(0, Ts, 0)];
    if (op.mode === 'ccm') iDs.push({ t0: Ts, t1: T, y0: Ipk * sc, y1: Imin * sc });
    else { iDs.push({ t0: Ts, t1: Ts + Tf, y0: Ipk * sc, y1: 0 }); if (D3 > 0) iDs.push(pc(Ts + Tf, T, 0)); }
    /* Strom in den Kondensatorknoten: buck = Drosselstrom, sonst Diodenstrom */
    const icSrc = kind === 'buck' ? iLs : iDs;
    const icSegs = icSrc.map(function (s) { return { t0: s.t0, t1: s.t1, y0: s.y0 - op.Iout, y1: s.y1 - op.Iout }; });
    const integ = segIntegrator(icSegs, T);
    /* Schaltknotenspannung */
    let uSw;
    if (kind === 'buck') uSw = [pc(0, Ts, Uin), pc(Ts, Ts + Tf, 0)];
    else if (kind === 'boost') uSw = [pc(0, Ts, 0), pc(Ts, Ts + Tf, Uo)];
    else if (kind === 'bb') uSw = [pc(0, Ts, 0), pc(Ts, Ts + Tf, Uin + Uo)];
    else uSw = [pc(0, Ts, 0), pc(Ts, Ts + Tf, Uin + Uo / n)];
    if (op.mode === 'dcm' && D3 > 0) uSw.push(pc(Ts + Tf, T, kind === 'buck' ? Uo : Uin));
    else if (op.mode === 'ccm') uSw[1].t1 = T;
    const tArr = new Array(N), uswA = new Array(N), iLA = new Array(N), iDA = new Array(N), uCA = new Array(N), uoA = new Array(N);
    const sg = kind === 'bb' ? -1 : 1;
    for (let k = 0; k < N; k++) {
      const tt = k / N * per * T;
      let tp = tt - Math.floor(tt / T + 1e-12) * T; if (tp < 0) tp = 0; if (tp >= T) tp = 0;
      tArr[k] = tt * 1e6;
      uswA[k] = segEval(uSw, tp);
      iLA[k] = segEval(iLs, tp);
      iDA[k] = segEval(iDs, tp);
      const q = integ.at(tp);
      const uC = Uo + (q - integ.mean) / op.C;
      const ic = segEval(icSegs, tp);
      uCA[k] = sg * uC;
      uoA[k] = sg * (uC + op.esr * ic);
    }
    const res = { ok: true, tUnit: 'µs', kind: kind, t: tArr, periods: per, T: T, mode: op.mode, D: D, D2: D2, D3: D3, Uout: sg * Uo, Iout: op.Iout, Uin: Uin,
      ILmin: Imin, ILmax: Ipk, ILavg: op.ILavg, dIL: op.dIL, geregelt: op.geregelt,
      series: [
        { name: 'u_sw', y: uswA, unit: 'V' }, { name: 'i_L', y: iLA, unit: 'A' }, { name: 'i_D', y: iDA, unit: 'A' },
        { name: 'u_C', y: uCA, unit: 'V' }, { name: 'u_aus', y: uoA, unit: 'V' }
      ],
      marks: [{ name: 'T', t: T * 1e6 }, { name: 'D·T', t: Ts * 1e6 }],
      diag: [] };
    if (op.mode === 'dcm') { res.marks.push({ name: '(D+D2)·T', t: (D + D2) * T * 1e6 }); res.diag.push(TEXTS.get('lueckt', { iout: fmtEng(op.Iout, 'A'), ikrit: fmtEng(ikritFor(kind, op).out, 'A') })); }
    return res;
  }

  /* =====================================================================================================
   *  Oeffentliche Gruppen
   * ===================================================================================================== */
  function mkGroup(kind) {
    const g = C[kind] = C[kind] || {};
    g.ccm = S_(function (cfg) { return ccmReport(kind, cfg); });
    g.wave = S_(function (cfg, nPts) { return waveFor(kind, cfg, nPts); });
    g.dcm = S_(function (cfg) {
      const op = operating(kind, cfg);
      if (op.ok === false) return op;
      if (!fin(op.R)) return fail('Der Lückbetrieb braucht einen Lastwiderstand Rlast.');
      if (op.mode !== 'dcm') {
        const r = ccmReport(kind, cfg);
        if (r.ok === false) return r;
        r.lueckt = false;
        r.Kkrit = NaN;
        r.hinweis = 'Der Betrieb ist nicht lückend, es gelten die Formeln für nicht lückenden Betrieb (ccm).';
        return r;
      }
      const r = ccmReport(kind, cfg);
      if (r.ok === false) return r;
      r.K = op.K; r.IL_pk = op.ILpk; r.D2 = op.D2; r.D3 = op.D3;
      r.M = op.Uout / op.Uin;
      return r;
    });
    return g;
  }
  const buck = mkGroup('buck');
  mkGroup('boost'); mkGroup('bb'); mkGroup('fly');
  /* fly.power: Leistung im Lueckbetrieb P = 1/2 Lm Ipk^2 f, Ipk = Uin D / (f Lm); Energie je Zyklus E = 1/2 Lm Ipk^2 */
  C.fly.power = S_(function (cfg) {
    if (!isObj(cfg)) return fail('Eingabe fehlt.');
    if (!pos(cfg.Uin) || !pos(cfg.f) || !pos(cfg.L)) return fail('Uin, f und L müssen größer als 0 sein.');
    let ipk = cfg.Ipk;
    if (ipk === undefined) {
      if (!pos(cfg.D) || cfg.D >= 1) return fail('Spitzenstrom oder Tastverhältnis (0 bis 1) fehlt.');
      ipk = cfg.Uin * cfg.D / (cfg.f * cfg.L);
    } else if (!pos(ipk)) return fail('Der Spitzenstrom muss größer als 0 sein.');
    const E = 0.5 * cfg.L * ipk * ipk;
    return { ok: true, Ipk: ipk, E: E, P: E * cfg.f, text: 'Lehrmodell: Die gespeicherte Energie je Takt wird vollständig abgegeben (Lückbetrieb). Gate-Ansteuerung und Netzseite nur als Begriff.' };
  });

  /* ---------- buck.lcrit: kleinste Drossel fuer nicht lueckenden Betrieb: L_krit = (1 - D) R / (2 f) ---------- */
  buck.lcrit = S_(function (cfg) {
    if (!isObj(cfg)) return fail('Eingabe fehlt.');
    if (!pos(cfg.f)) return fail('Die Schaltfrequenz muss größer als 0 sein.');
    let Dd = cfg.D, Uo = cfg.Uout;
    if (Dd === undefined) {
      if (!pos(cfg.Uin) || !pos(Uo)) return fail('Es fehlt das Tastverhältnis oder Uin und Uout.');
      if (Uo >= cfg.Uin) return fail('Ausgangsspannung ≥ Eingangsspannung: Hochsetzsteller nötig.');
      Dd = Uo / cfg.Uin;
    } else if (!(typeof Dd === 'number' && fin(Dd) && Dd > 0 && Dd < 1)) return fail('Das Tastverhältnis muss zwischen 0 und 1 liegen.');
    let R = cfg.Rlast;
    if (R === undefined) {
      if (cfg.Imin !== undefined && pos(cfg.Imin) && pos(Uo)) R = Uo / cfg.Imin;
      else if (cfg.Imin !== undefined && pos(cfg.Imin) && pos(cfg.Uin)) R = Dd * cfg.Uin / cfg.Imin;
    }
    if (!pos(R)) return fail('Es fehlt der Lastwiderstand (Rlast) oder der kleinste Ausgangsstrom (Imin) mit Uout.');
    const Lk = (1 - Dd) * R / (2 * cfg.f);
    const out = { ok: true, D: Dd, R: R, Lkrit: Lk, f: cfg.f, diag: [] };
    if (cfg.L !== undefined) {
      if (!pos(cfg.L)) return fail('Die Induktivität muss größer als 0 sein.');
      out.L = cfg.L; out.nichtLueckend = cfg.L >= Lk; out.reserve = cfg.L / Lk;
      if (!out.nichtLueckend) out.diag.push(TEXTS.get('l-zu-klein', { l: fmtEng(cfg.L, 'H'), lkrit: fmtEng(Lk, 'H') }));
    }
    return out;
  });

  /* ---------- buck.ripple: Welligkeit und Auslegung ---------- */
  buck.ripple = S_(function (cfg) {
    if (!isObj(cfg)) return fail('Eingabe fehlt.');
    const r = ccmReport('buck', cfg);
    if (r.ok === false) return r;
    const out = { ok: true, D: r.D, dIL: r.dIL, dUc: r.dUc, dUesr: r.dUesr, dU: r.dU, ccm: r.ccm, lueckt: r.lueckt, Ikrit: r.Ikrit, diag: r.diag };
    if (fin(cfg.Iout)) {
      out.verhaeltnis = r.dIL / cfg.Iout;
      out.dilOk = out.verhaeltnis <= LV('dil_max') + 1e-12;
      const ziel = LV('dil_ausleg') * cfg.Iout;
      out.Lauslegung = ziel > 0 ? (cfg.Uin - r.Uout) * r.D / (cfg.f * ziel) : NaN;
      out.zielDIL = ziel;
    }
    if (cfg.dUziel !== undefined) {
      if (!pos(cfg.dUziel)) return fail('Die Zielwelligkeit muss größer als 0 sein.');
      const esr = cfg.esr === undefined ? 0 : cfg.esr;
      const rest = cfg.dUziel - r.dIL * esr;
      out.Cmin = rest > 0 ? r.dIL / (8 * cfg.f * rest) : NaN;
      out.cminText = rest > 0 ? 'ideale Kapazität für die Zielwelligkeit nach Abzug des ESR-Anteils' : 'Der ESR-Anteil allein liegt schon über der Zielwelligkeit: Kondensator mit kleinerem ESR nötig, mehr Kapazität hilft nicht.';
    }
    return out;
  });

  /* =====================================================================================================
   *  topology(need): empfohlene Grundschaltung mit Begruendung und Gegenprobe
   *  need = { Uin, Uout (mit Vorzeichen), getrennt?:bool, Iout? }
   * ===================================================================================================== */
  C.topology = S_(function (need) {
    if (!isObj(need)) return fail('Eingabe fehlt.');
    if (!pos(need.Uin)) return fail('Die Eingangsspannung muss größer als 0 sein.');
    if (!(typeof need.Uout === 'number' && fin(need.Uout) && need.Uout !== 0 && Math.abs(need.Uout) <= 1e12)) return fail('Die Ausgangsspannung fehlt (positiv oder negativ, nicht 0).');
    const Uin = need.Uin, Uo = need.Uout, ua = Math.abs(Uo);
    let kind, grund;
    if (need.getrennt) {
      kind = 'fly';
      grund = 'Potentialtrennung verlangt einen Übertrager: Der Sperrwandler trennt Eingang und Ausgang und kann die Spannung hoch- oder heruntersetzen (Übersetzungsverhältnis n = N2/N1).';
    } else if (Uo < 0) {
      kind = 'bb';
      grund = 'Eine Ausgangsspannung mit umgekehrtem Vorzeichen erzeugt der Inverswandler (Buck-Boost): Die Drossel wird beim Einschalten geladen und gibt ihre Energie mit umgekehrter Polarität ab.';
    } else if (ua < Uin) {
      kind = 'buck';
      grund = 'Die Ausgangsspannung ist kleiner als die Eingangsspannung und hat dasselbe Vorzeichen: Der Tiefsetzsteller (Step-down) mit Schalter in Reihe, Speicherdrossel und Freilaufdiode ist die Grundschaltung dafür.';
    } else if (ua > Uin) {
      kind = 'boost';
      grund = 'Die Ausgangsspannung ist größer als die Eingangsspannung: Nur der Hochsetzsteller (Step-up) erzeugt eine größere Spannung mit gleichem Vorzeichen.';
    } else {
      return { ok: true, topo: 'keine', name: 'keine Wandlung nötig', grund: 'Eingangs- und Ausgangsspannung sind gleich: Es ist kein Wandler nötig.', D: NaN, gegenprobe: 'Uout = Uin', alternativen: [], diag: [] };
    }
    const out = { ok: true, topo: kind, name: NAMES[kind], grund: grund, Uin: Uin, Uout: Uo, diag: [], alternativen: [] };
    let Dd;
    if (kind === 'fly') { Dd = dCcm('fly', Uin, ua, 1); out.hinweisN = 'Gerechnet mit n = 1: D = ' + fmt(Dd * 100, 2) + ' %. Ein anderes n verschiebt D.'; }
    else Dd = dCcm(kind, Uin, ua, 1);
    out.D = Dd;
    const alt = [];
    const gk = { buck: 'D = Uout/Uin', boost: 'D = 1 − Uin/Uout', bb: 'D = |Uout|/(Uin + |Uout|)', fly: 'D = Uout/(Uout + n·Uin)' }[kind];
    out.formel = gk;
    out.gegenprobe = 'Gegenprobe: ' + gk + ' = ' + fmt(Dd * 100, 2) + ' %, mit diesem D liefert die Grundschaltung wieder ' + fmtEng(uCcm(kind, Uin, Dd, 1), 'V') + (kind === 'bb' ? ' (negativ)' : '') + '.';
    out.dOk = Dd >= LV('d_min') / 100 && Dd <= LV('d_max') / 100;
    if (!out.dOk) out.diag.push(TEXTS.get('d-grenze', { d: fmt(Dd * 100, 1) + ' %', dmin: fmt(LV('d_min'), 0) + ' %', dmax: fmt(LV('d_max'), 0) + ' %' }));
    if (kind === 'buck') {
      const I = nn(need.Iout) ? need.Iout : 1;
      alt.push({ topo: 'linear', name: 'Linearregler', text: 'Möglich, aber η = ' + fmt(C.lin.eta(Uin, ua, I) * 100, 1) + ' % und ' + fmtEng(C.lin.loss(Uin, ua, I), 'W') + ' Verlust bei ' + fmtEng(I, 'A') + ' (Wärme statt Nutzleistung).' });
    }
    out.alternativen = alt;
    out.falsch = {};
    ['buck', 'boost', 'bb'].forEach(function (k) {
      if (k === kind) return;
      let why = '';
      if (k === 'buck') why = ua >= Uin || Uo < 0 ? 'Der Tiefsetzsteller kann keine Spannung erzeugen, die größer oder gleich Uin oder negativ ist.' : '';
      if (k === 'boost') why = ua <= Uin || Uo < 0 ? 'Der Hochsetzsteller kann keine Spannung erzeugen, die kleiner oder gleich Uin oder negativ ist.' : '';
      if (k === 'bb') why = Uo > 0 ? 'Der Inverswandler liefert eine Spannung mit umgekehrtem Vorzeichen.' : '';
      if (why) out.falsch[k] = why;
    });
    return out;
  });

  /* =====================================================================================================
   *  VERLUSTE (loss): SPEC 4.7, nur Lehrmodell. Bauteilwerte ohne Eingabe kommen aus limits (Uebungswerte, Fragen F8 bis F10).
   *  Eisenverluste der Drossel werden NICHT modelliert. Verluste wirken nicht auf D zurueck (Lehrmodell).
   * ===================================================================================================== */
  function linMsq(a, b) { return (a * a + a * b + b * b) / 3; }       /* Mittel des Quadrats einer Rampe von a nach b */
  const loss = C.loss = C.loss || {};
  function lossCalc(cfg) {
    if (!isObj(cfg)) return fail('Eingabe fehlt.');
    const kind = cfg.kind === undefined ? 'buck' : String(cfg.kind);
    if (!has(KINDS, kind)) return fail('Unbekannte Grundschaltung (buck, boost, bb oder fly).');
    if (!pos(cfg.Uin) || !pos(cfg.Uout)) return fail('Eingangs- und Ausgangsspannung müssen größer als 0 sein.');
    if (!pos(cfg.Iout)) return fail('Der Ausgangsstrom muss größer als 0 sein.');
    const uebung = [];
    function pick(key, lim) {
      const v = cfg[key];
      if (v === undefined) { uebung.push(key); return LV(lim); }
      return v;
    }
    const rdson = pick('rdson', 'rds_on'), uf = pick('uf', 'uf_schottky'), tsw = pick('tsw', 'tsw');
    const Qg = pick('Qg', 'qg'), UG = pick('UG', 'ug'), rl = pick('rl', 'rl_dr');
    const esr = cfg.esr === undefined ? 0 : cfg.esr, iq = cfg.iq === undefined ? 0 : cfg.iq;
    const sync = !!cfg.sync;
    const rds2 = cfg.rdson2 === undefined ? rdson : cfg.rdson2;
    if (!nn(rdson) || !nn(uf) || !nn(tsw) || !nn(Qg) || !nn(UG) || !nn(rl) || !nn(esr) || !nn(iq) || !nn(rds2)) return fail('Die Bauteilwerte dürfen nicht negativ sein.');
    const op = operating(kind, { Uin: cfg.Uin, Uout: cfg.Uout, Iout: cfg.Iout, f: cfg.f, L: cfg.L, n: cfg.n });
    if (op.ok === false) return op;
    const D = op.D, D2 = op.D2, Ipk = op.ILpk, Imin = op.ILmin, ccm = op.mode === 'ccm';
    const sc = kind === 'fly' ? 1 / op.n : 1;
    const msqOn = ccm ? linMsq(Imin, Ipk) : Ipk * Ipk / 3;
    const msqOff = ccm ? linMsq(Ipk, Imin) : Ipk * Ipk / 3;
    const msqL = D * msqOn + D2 * msqOff;
    const iSwRms2 = D * msqOn;
    const iDmean = D2 * (ccm ? (Ipk + Imin) / 2 : Ipk / 2) * sc;
    const iDms = D2 * msqOff * sc * sc;
    const Vsw = kind === 'buck' ? op.Uin : (kind === 'boost' ? op.Uout : (kind === 'bb' ? op.Uin + op.Uout : op.Uin + op.Uout / op.n));
    const Pab = cfg.Uout * cfg.Iout;
    const parts = [];
    const pCond = rdson * iSwRms2;
    const pDio = sync ? rds2 * iDms : uf * iDmean;
    const pSw = ccm ? 0.5 * Vsw * op.ILavg * tsw * cfg.f : 0.5 * Vsw * Ipk * (tsw / 2) * cfg.f;
    const pG = Qg * UG * cfg.f;
    const pL = rl * msqL;
    const icMs = (kind === 'buck' ? msqL : (D2 * msqOff * sc * sc)) - cfg.Iout * cfg.Iout;
    const pC = esr * Math.max(icMs, 0);
    const pQ = cfg.Uin * iq;
    parts.push({ id: 'leitung', name: 'Leitverlust Schalter', formel: 'P = R_ds · D · I_rms²', w: pCond, text: 'I_rms² = I² + ΔI²/12 (Dreieckanteil); R_ds,on ' + (uebung.indexOf('rdson') >= 0 ? 'Übungswert' : 'Eingabe') });
    parts.push({ id: 'diode', name: sync ? 'Leitverlust Synchron-MOSFET' : 'Diodenverlust', formel: sync ? 'P = R_ds · I_rms,D²' : 'P = U_F · I_D,mittel', w: pDio, text: sync ? 'Die Diode ist durch einen MOSFET ersetzt: statt U_F·I fällt nur R_ds·I² ab (Totzeit nicht modelliert).' : 'U_F ' + (uebung.indexOf('uf') >= 0 ? 'Übungswert (Schottky)' : 'Eingabe') });
    parts.push({ id: 'schalt', name: 'Schaltverlust', formel: 'P = ½ · U · I · (t_r + t_f) · f', w: pSw, text: 'wächst mit der Schaltfrequenz; Zeiten Übungswert, Datenblatt maßgeblich' });
    parts.push({ id: 'gate', name: 'Gate-Verlust', formel: 'P = Q_g · U_G · f', w: pG, text: 'wächst mit der Schaltfrequenz, unabhängig von der Last (Festverlust)' });
    parts.push({ id: 'drossel', name: 'Drosselkupfer', formel: 'P = R_L · I_rms²', w: pL, text: 'Eisenverluste der Drossel sind nicht modelliert' });
    parts.push({ id: 'kondensator', name: 'Kondensator (ESR)', formel: 'P = ESR · I_C,rms²', w: pC, text: esr > 0 ? 'ESR als Eingabe' : 'ESR nicht angegeben, daher 0 W (Lehrmodell)' });
    parts.push({ id: 'ruhe', name: 'Ruhestrom Regler', formel: 'P = U_ein · I_q', w: pQ, text: iq > 0 ? 'Ruhestrom als Eingabe' : 'Ruhestrom nicht angegeben, daher 0 W' });
    const sum = pCond + pDio + pSw + pG + pL + pC + pQ;
    const out = { ok: true, kind: kind, mode: op.mode, D: D, parts: parts, leitung: pCond, diode: pDio, schalt: pSw, gate: pG, drossel: pL, kondensator: pC, ruhe: pQ,
      sum: sum, Pv: sum, Pab: Pab, Pzu: Pab + sum, eta: Pab / (Pab + sum), sync: sync, uebung: uebung, status: 'Lehrmodell, Übungswerte (A)', diag: [] };
    if (op.mode === 'dcm') out.diag.push(TEXTS.get('lueckt', { iout: fmtEng(cfg.Iout, 'A'), ikrit: fmtEng(op.dIL / 2, 'A') }));
    if (sync) out.syncHinweis = 'Mit Synchrongleichrichter steigt der Wirkungsgrad (nur nach Rechnung).';
    return out;
  }
  loss.parts = S_(lossCalc);
  loss.eta = S_(function (cfg) {
    const r = lossCalc(cfg);
    if (r.ok === false) return r;
    const c2 = {}; for (const k in cfg) c2[k] = cfg[k];
    c2.sync = !cfg.sync;
    const r2 = lossCalc(c2);
    if (r2.ok !== false) { r.etaSync = cfg.sync ? r.eta : r2.eta; r.etaDiode = cfg.sync ? r2.eta : r.eta; }
    return r;
  });
  /* curve(cfg, 'I'|'f', lo, hi, n): Wirkungsgrad ueber Last (linear) oder Schaltfrequenz (logarithmisch) */
  loss.curve = S_(function (cfg, what, lo, hi, n) {
    if (!isObj(cfg)) return fail('Eingabe fehlt.');
    if (what !== 'I' && what !== 'f') return fail('Die Kennlinie gibt es über der Last (I) oder der Schaltfrequenz (f).');
    if (!pos(lo) || !pos(hi) || hi <= lo) return fail('Die Grenzen müssen größer als 0 sein und aufsteigen.');
    const N = clamp(Math.round(num(n, 40)), 3, 400);
    const x = [], eta = [], pv = [];
    for (let i = 0; i < N; i++) {
      const fr = i / (N - 1);
      const v = what === 'I' ? lo + (hi - lo) * fr : lo * Math.pow(hi / lo, fr);
      const c2 = {}; for (const k in cfg) c2[k] = cfg[k];
      if (what === 'I') c2.Iout = v; else c2.f = v;
      const r = lossCalc(c2);
      x.push(v); eta.push(r.ok === false ? NaN : r.eta); pv.push(r.ok === false ? NaN : r.Pv);
    }
    let best = -1, bi = -1;
    for (let i = 0; i < N; i++) if (fin(eta[i]) && eta[i] > best) { best = eta[i]; bi = i; }
    return { ok: true, what: what, x: x, eta: eta, pv: pv, xUnit: what === 'I' ? 'A' : 'Hz', etaMax: best, xAtMax: bi >= 0 ? x[bi] : NaN,
      text: what === 'I' ? 'Bei kleiner Last fallen die Festverluste (Gate, Ruhestrom, Schalten) ins Gewicht, bei großer Last die Leitverluste.' : 'Bei höherer Schaltfrequenz wachsen Schalt- und Gate-Verlust, die Drossel kann kleiner werden.' };
  });
  /* vsLinear: Verlustleistung Schaltregler gegen Linearregler (Pool W2023-09: 5 V, 0,4 A aus 12 V, 88 %: 2,527 W) */
  loss.vsLinear = S_(function (cfg) {
    if (!isObj(cfg)) return fail('Eingabe fehlt.');
    if (!pos(cfg.Uin) || !pos(cfg.Uout) || !pos(cfg.Iout)) return fail('Uin, Uout und Iout müssen größer als 0 sein.');
    if (cfg.Uout > cfg.Uin) return fail('Ein Linearregler kann die Spannung nicht erhöhen (Uout größer als Uin).');
    const eta = cfg.etaSchalt;
    if (!(typeof eta === 'number' && fin(eta) && eta > 0 && eta <= 1)) return fail('Der Wirkungsgrad des Schaltreglers muss zwischen 0 und 1 (0 bis 100 %) liegen.');
    const Pab = cfg.Uout * cfg.Iout;
    const PvLin = C.lin.loss(cfg.Uin, cfg.Uout, cfg.Iout);
    const PvSw = Pab * (1 / eta - 1);
    return { ok: true, Pab: Pab, PvLin: PvLin, PvSchalt: PvSw, diff: PvLin - PvSw, etaLin: C.lin.eta(cfg.Uin, cfg.Uout, cfg.Iout), etaSchalt: eta,
      text: 'Linearregler: P_V = (U_ein − U_aus)·I. Schaltregler: P_V = P_ab·(1/η − 1).' };
  });

  /* =====================================================================================================
   *  GATE (gate): SPEC 4.8. Standardwerte aus limits (Uebung, F10). Lehrmodell, Datenblatt massgeblich.
   *  Einschalten: Plateaustrom (UG - Uplat)/Rg, tR = Qgd / Plateaustrom ("t_sw"). Ausschalten: Entladestrom Uplat/Rg, tF = Qgd / (Uplat/Rg).
   *  tOn und tOff: gesamte Gate-Ladung Qg mit dem jeweiligen Plateaustrom (obere Naeherung, kein Zeitverlauf der Spannung).
   * ===================================================================================================== */
  const gate = C.gate = C.gate || {};
  function gateCalc(cfg) {
    if (!isObj(cfg)) return fail('Eingabe fehlt.');
    const uebung = [];
    function pick(key, lim) { if (cfg[key] === undefined) { uebung.push(key); return LV(lim); } return cfg[key]; }
    const UG = pick('UG', 'ug'), Rg = pick('Rg', 'rg'), Qg = pick('Qg', 'qg'), Qgd = pick('Qgd', 'qgd'), Uplat = pick('Uplat', 'uplat');
    if (!pos(Rg)) return fail('Der Gate-Widerstand muss größer als 0 sein.');
    if (!pos(UG)) return fail('Die Gate-Spannung muss größer als 0 sein.');
    if (!pos(Uplat)) return fail('Die Plateauspannung muss größer als 0 sein.');
    if (!pos(Qg) || !pos(Qgd)) return fail('Die Gate-Ladungen müssen größer als 0 sein.');
    if (UG <= Uplat) {
      const d = TEXTS.get('ug-zu-klein', { ug: fmtEng(UG, 'V'), uplat: fmtEng(Uplat, 'V'), ugmin: fmtEng(Uplat + 2, 'V') });
      return fail('Die Gate-Spannung ' + fmtEng(UG, 'V') + ' erreicht die Plateauspannung ' + fmtEng(Uplat, 'V') + ' nicht: Der MOSFET schaltet nicht durch.', { id: 'ug-zu-klein', diag: [d], reserve: UG - Uplat });
    }
    if (cfg.f !== undefined && !pos(cfg.f)) return fail('Die Schaltfrequenz muss größer als 0 sein.');
    const IgPeak = UG / Rg, IgPlat = (UG - Uplat) / Rg, IgOff = Uplat / Rg;
    const out = { ok: true, UG: UG, Rg: Rg, Qg: Qg, Qgd: Qgd, Uplat: Uplat, Ig_peak: IgPeak, Ig_plateau: IgPlat, Ig_off: IgOff,
      t_sw: Qgd / IgPlat, tR: Qgd / IgPlat, tF: Qgd / IgOff, tOn: Qg / IgPlat, tOff: Qg / IgOff,
      reserve: UG - Uplat, knapp: UG < Uplat + 2, uebung: uebung, status: 'Übungswerte (A), Datenblatt maßgeblich', diag: [] };
    out.PG = cfg.f !== undefined ? Qg * UG * cfg.f : NaN;
    if (cfg.Ciss !== undefined) out.tauG = pos(cfg.Ciss) ? Rg * cfg.Ciss : NaN;
    if (out.knapp) out.diag.push({ id: 'ug-knapp', kind: 'warn', text: 'Die Gate-Spannung liegt nur ' + fmtEng(UG - Uplat, 'V') + ' über der Plateauspannung (Lehrfaustwert: mindestens 2 V Reserve): Der MOSFET schaltet langsam und der Plateaustrom ist klein.' });
    return out;
  }
  const gate_ = gate;
  gate.drive = S_(gateCalc);
  gate.switching = S_(function (cfg) {
    const g = gateCalc(cfg);
    if (g.ok === false) return g;
    const V = cfg.Vsw !== undefined ? cfg.Vsw : cfg.Uin;
    if (!pos(V)) return fail('Die Schaltspannung (Uin) muss größer als 0 sein.');
    if (!pos(cfg.I)) return fail('Der Schaltstrom muss größer als 0 sein.');
    if (!pos(cfg.f)) return fail('Die Schaltfrequenz muss größer als 0 sein.');
    const Psw = 0.5 * V * cfg.I * (g.tR + g.tF) * cfg.f;
    const out = { ok: true, Vsw: V, I: cfg.I, f: cfg.f, tR: g.tR, tF: g.tF, tSchalt: g.tR + g.tF, Psw: Psw, PG: g.PG, dIdt: cfg.I / g.tR, dUdt: V / g.tR,
      Rg: g.Rg, diag: g.diag.slice(), text: 'Größerer Gate-Widerstand: langsamer schalten, mehr Schaltverlust, aber weniger Störung (Link EMV).' };
    const Pab = cfg.Pab !== undefined ? cfg.Pab : (cfg.Uout !== undefined && pos(cfg.Uout) ? cfg.Uout * cfg.I : NaN);
    if (fin(Pab) && Pab > 0) {
      out.Pab = Pab; out.anteil = Psw / Pab;
      if (out.anteil > 0.01) out.diag.push(TEXTS.get('schaltverlust-gross', { psw: fmtEng(Psw, 'W'), anteil: fmt(out.anteil * 100, 2) + ' %' }));
    }
    return out;
  });
  gate.sweepRg = S_(function (cfg, list) {
    if (!isObj(cfg) || !Array.isArray(list) || list.length === 0 || list.length > 200) return fail('Es fehlt eine Liste von Gate-Widerständen (höchstens 200).');
    const rows = [];
    for (let i = 0; i < list.length; i++) {
      const c2 = {}; for (const k in cfg) c2[k] = cfg[k]; c2.Rg = list[i];
      const r = gate_.switching(c2);
      rows.push(r.ok === false ? { Rg: list[i], ok: false, why: r.why } : { Rg: list[i], ok: true, tR: r.tR, tF: r.tF, Psw: r.Psw, dIdt: r.dIdt, dUdt: r.dUdt });
    }
    return { ok: true, rows: rows };
  });
  /* deadtime: Totzeit gegen Ausschaltzeit des oberen Schalters der Halbbruecke. cfg = { tot (s), tOffHi (s) | Gate-Felder } */
  gate.deadtime = S_(function (cfg) {
    if (!isObj(cfg)) return fail('Eingabe fehlt.');
    if (!nn(cfg.tot)) return fail('Die Totzeit darf nicht negativ sein.');
    let toff = cfg.tOffHi;
    if (toff === undefined) { const g = gateCalc(cfg); if (g.ok === false) return g; toff = g.tOff; }
    else if (!pos(toff)) return fail('Die Ausschaltzeit muss größer als 0 sein.');
    const ueber = cfg.tot < toff;
    const out = { ok: true, tot: cfg.tot, tOff: toff, reserve: cfg.tot - toff, ueberlappung: ueber, querstrom: ueber, tUeber: ueber ? toff - cfg.tot : 0, diag: [],
      text: 'Die Halbbrücke braucht eine Totzeit mindestens so lang wie die Ausschaltzeit des oberen Schalters. Bootstrap und High-Side-Treiber nur als Begriff.' };
    if (ueber) out.diag.push(TEXTS.get('querstrom', { tot: fmtEng(cfg.tot, 's'), toff: fmtEng(toff, 's'), tueber: fmtEng(toff - cfg.tot, 's') }));
    return out;
  });

  /* =====================================================================================================
   *  RUECKKOPPLUNG, REGELKREIS (loop), LABORNETZTEIL (lab): SPEC 4.9
   * ===================================================================================================== */
  const loop = C.loop = C.loop || {};
  const BIGI = 1e12;
  loop.r2For = G_(function (Uaus, R1, Uref) { return C.lin.r2For(Uaus, R1, Uref); });
  /* divider: Teiler R1 nach Masse, R2 zum Ausgang (Pool W2023-07): Uaus = Uref (1 + R2/R1). offen:'R1'|'R2' simuliert einen offenen Widerstand. */
  loop.divider = S_(function (cfg) {
    if (!isObj(cfg)) return fail('Eingabe fehlt.');
    const Uref = cfg.Uref === undefined ? LV('uref_317') : cfg.Uref;
    if (!pos(Uref)) return fail('Die Referenzspannung muss größer als 0 sein.');
    if (!pos(cfg.R1)) return fail('R1 muss größer als 0 sein.');
    let R2 = cfg.R2;
    const out = { ok: true, Uref: Uref, R1: cfg.R1, diag: [] };
    if (R2 === undefined) {
      if (!pos(cfg.Uaus)) return fail('Es fehlt R2 oder die gewünschte Ausgangsspannung.');
      if (cfg.Uaus < Uref) return fail('Die Ausgangsspannung kann nicht kleiner als die Referenzspannung sein (Teiler nur nach oben).');
      R2 = cfg.R1 * (cfg.Uaus / Uref - 1);
      out.R2gerechnet = true;
    } else if (!nn(R2)) return fail('R2 darf nicht negativ sein.');
    out.R2 = R2;
    out.ratio = R2 / cfg.R1;
    out.Uaus = Uref * (1 + out.ratio);
    out.Ifb = Uref / cfg.R1;
    out.Pteiler = out.Uaus * out.Ifb;
    out.offen = null;
    if (cfg.offen !== undefined && cfg.offen !== null) {
      if (cfg.offen === 'R1') {
        out.offen = 'R1'; out.Uaus = Uref; out.Ifb = 0; out.Pteiler = 0;
        out.diag.push(TEXTS.get('r1-offen', { uref: fmtEng(Uref, 'V') }));
      } else if (cfg.offen === 'R2') {
        out.offen = 'R2';
        const ua = cfg.Uanschlag !== undefined ? cfg.Uanschlag : (cfg.Uein !== undefined ? cfg.Uein : NaN);
        out.Uaus = fin(ua) && ua >= 0 ? ua : NaN; out.anschlag = true; out.Ifb = 0; out.Pteiler = 0;
        out.diag.push(TEXTS.get('r2-offen', { uanschlag: fin(out.Uaus) ? fmtEng(out.Uaus, 'V') : 'Eingangsspannung abzüglich Verlust' }));
      } else return fail('offen kann nur "R1" oder "R2" sein.');
    }
    out.status = 'Referenz 1,25 V belegt (Pool W2023-07); Teiler wie im Pool: R1 nach Masse, R2 zum Ausgang';
    return out;
  });

  /* Linearisiertes Lehrmodell des Regelkreises: Stellglied mit Innenwiderstand Raus speist C und Last,
   *   C dU/dt = (Ue - U)/Raus - I ;  tau dUe/dt = Uset + Vr (Uset - U) - Ue   (Regler mit Verstaerkung Vr und Verzoegerung tau)
   * statische Abweichung: dU = -I Raus / (1 + Vr). Schleifenverstaerkung L(s) = Vr / ((1 + s tau)(1 + s Raus C)). */
  function loopCheck(cfg) {
    if (!isObj(cfg)) return fail('Eingabe fehlt.');
    if (!pos(cfg.C)) return fail('Die Ausgangskapazität muss größer als 0 sein.');
    if (!pos(cfg.Raus)) return fail('Der Ausgangswiderstand des Stellglieds muss größer als 0 sein.');
    if (!nn(cfg.Vr)) return fail('Die Reglerverstärkung darf nicht negativ sein.');
    if (!pos(cfg.tau)) return fail('Die Verzögerung des Reglers muss größer als 0 sein.');
    return null;
  }
  function loopPm(Vr, tau, RC) {
    if (Vr <= 1) return { pm: 180, wc: 0 };
    const a = tau * tau * RC * RC, b = tau * tau + RC * RC, c = 1 - Vr * Vr;
    const x = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
    const wc = Math.sqrt(Math.max(x, 0));
    return { pm: 180 - Math.atan(wc * tau) * 180 / PI - Math.atan(wc * RC) * 180 / PI, wc: wc };
  }
  function ampelPm(pm) { return pm >= LV('pm_min') ? 'gruen' : (pm >= LV('pm_rot') ? 'gelb' : 'rot'); }
  loop.stability = S_(function (cfg) {
    const bad = loopCheck(cfg); if (bad) return bad;
    const RC = cfg.Raus * cfg.C;
    const r = loopPm(cfg.Vr, cfg.tau, RC);
    const wn = Math.sqrt((1 + cfg.Vr) / (RC * cfg.tau)), zeta = (1 / RC + 1 / cfg.tau) / (2 * wn);
    const ampel = ampelPm(r.pm);
    const out = { ok: true, pm: r.pm, fc: r.wc / (2 * PI), wn: wn, zeta: zeta, ampel: ampel, schwingt: r.pm < LV('pm_min'), pmMin: LV('pm_min'), pmRot: LV('pm_rot'), diag: [],
      begriffe: ['Phasenreserve: Abstand der Phase von −180° bei der Durchtrittsfrequenz (Schleifenverstärkung 1).', 'Verstärkung: Schleifenverstärkung des Regelkreises.', 'Je kleiner die Phasenreserve, desto stärker schwingt der Ausgang nach einem Lastsprung nach.'],
      text: 'Nur Ampelaussage (Lehrfaustwerte, F11); keine Bode-Auslegung (Link Regelungstechnik-Lab).', link: 'reglab.html' };
    if (out.schwingt) out.diag.push(TEXTS.get('regler-schwingt', { pm: fmt(r.pm, 0) + '°', pmmin: fmt(LV('pm_min'), 0) + '°' }));
    return out;
  });
  /* step: Lastsprung dI. Einschwingen aus Zeitschritt-Simulation (RK4), nicht aus einer Formel. */
  loop.step = S_(function (cfg) {
    const bad = loopCheck(cfg); if (bad) return bad;
    if (!(typeof cfg.dI === 'number' && fin(cfg.dI) && cfg.dI > 0 && cfg.dI <= BIGI)) return fail('Der Laststromsprung muss größer als 0 sein.');
    const Uset = cfg.Uset === undefined ? 0 : cfg.Uset;
    if (!(typeof Uset === 'number' && fin(Uset))) return fail('Der Sollwert muss eine Zahl sein.');
    const RC = cfg.Raus * cfg.C, tau = cfg.tau, Vr = cfg.Vr, dI = cfg.dI;
    /* Zeitskala aus dem charakteristischen Polynom nur zur Wahl von Schrittweite und Dauer */
    const tr = 1 / RC + 1 / tau, det = (1 + Vr) / (RC * tau), disc = tr * tr / 4 - det;
    const lamMax = disc >= 0 ? tr / 2 + Math.sqrt(disc) : Math.sqrt(det);
    const alpha = disc >= 0 ? tr / 2 - Math.sqrt(disc) : tr / 2;          /* langsamster Abfall */
    const tEnd = Math.min(Math.max(12 / alpha, 20 / Math.sqrt(det)), 1e3);
    let N = Math.ceil(Math.max(4000, tEnd * lamMax * 40)); if (N > 400000) N = 400000;
    const dt = tEnd / N;
    let d = 0, ue = 0;      /* Abweichung vom Sollwert (U - Uset) und Ue - Uset */
    const f = function (dd, uu) { return [((uu - dd) / cfg.Raus - dI) / cfg.C, (-Vr * dd - uu) / tau]; };
    const dF = -dI * cfg.Raus / (1 + Vr);
    const M = 200, tv = [], uv = [];
    let dmin = 0, tmin = 0, lastOut = -1;
    const band = LV('regel_band') / 100;
    const ds = new Float64Array(N + 1); ds[0] = 0;
    for (let k = 0; k < N; k++) {
      const k1 = f(d, ue), k2 = f(d + dt / 2 * k1[0], ue + dt / 2 * k1[1]), k3 = f(d + dt / 2 * k2[0], ue + dt / 2 * k2[1]), k4 = f(d + dt * k3[0], ue + dt * k3[1]);
      d += dt / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
      ue += dt / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
      ds[k + 1] = d;
      if (Math.abs(d) > Math.abs(dmin)) { dmin = d; tmin = (k + 1) * dt; }
    }
    const dUmax = Math.abs(dmin);
    const tolB = band * Math.max(dUmax, 1e-30);
    for (let k = 0; k <= N; k++) if (Math.abs(ds[k] - dF) > tolB) lastOut = k;
    const tAus = lastOut < 0 ? 0 : (lastOut >= N ? NaN : (lastOut + 1) * dt);
    const ueber = Math.abs(dF) > 0 ? Math.max(0, (dUmax - Math.abs(dF)) / Math.abs(dF)) : 0;
    for (let i = 0; i < M; i++) { const k = Math.round(i / (M - 1) * N); tv.push(k * dt); uv.push(Uset + ds[k]); }
    const st = loop.stability(cfg);
    const out = { ok: true, dUmax: dUmax, tMin: tmin, dUstat: dF, tAus: tAus, ueber: ueber, ueberText: fmt(ueber * 100, 1) + ' %', schwingt: st.ok !== false && st.schwingt,
      pm: st.pm, zeta: st.zeta, wn: st.wn, ampel: st.ampel, tEnd: tEnd, dt: dt, n: N, verlauf: { t: tv, u: uv, unitT: 's', unitU: 'V' }, diag: [] };
    if (st.diag) out.diag = st.diag.slice();
    out.ueberGelb = ueber > LV('ueberschwing') / 100;
    out.status = 'Lehrmodell zweiter Ordnung (Übung, F11), keine exakte Datenblattaussage';
    return out;
  });

  const lab = C.lab = C.lab || {};
  /* cvcc: Labornetzteil mit Spannungs- und Strombegrenzung */
  lab.cvcc = S_(function (cfg) {
    if (!isObj(cfg)) return fail('Eingabe fehlt.');
    if (!nn(cfg.Uset)) return fail('Die eingestellte Spannung darf nicht negativ sein.');
    if (!pos(cfg.Iset)) return fail('Der eingestellte Strom muss größer als 0 sein.');
    if (!nn(cfg.Rlast)) return fail('Der Lastwiderstand darf nicht negativ sein (0 = Kurzschluss).');
    const Rk = cfg.Uset / cfg.Iset;
    const out = { ok: true, Uset: cfg.Uset, Iset: cfg.Iset, Rlast: cfg.Rlast, Rkrit: Rk, diag: [] };
    if (cfg.Rlast >= Rk) { out.modus = 'CV'; out.Uout = cfg.Uset; out.Iout = cfg.Uset / cfg.Rlast; }
    else { out.modus = 'CC'; out.Iout = cfg.Iset; out.Uout = cfg.Iset * cfg.Rlast; }
    out.Pout = out.Uout * out.Iout;
    if (cfg.Uin !== undefined) {
      if (!pos(cfg.Uin)) return fail('Die Eingangsspannung muss größer als 0 sein.');
      out.PvLinear = Math.max(0, cfg.Uin - out.Uout) * out.Iout;
    }
    out.diag.push(TEXTS.get(out.modus === 'CC' ? 'cc-aktiv' : 'cv-aktiv', { r: fmtEng(cfg.Rlast, 'Ω'), rkrit: fmtEng(Rk, 'Ω'), iset: fmtEng(cfg.Iset, 'A'), uset: fmtEng(cfg.Uset, 'V'), uout: fmtEng(out.Uout, 'V'), iout: fmtEng(out.Iout, 'A') }));
    return out;
  });
  /* ilim: Strombegrenzung mit zweitem Transistor: I = U_BE / R_s (Pool W2024-23: 0,7 V / 0,6 Ohm = 1,17 A) */
  lab.ilim = S_(function (cfg) {
    if (!isObj(cfg)) return fail('Eingabe fehlt.');
    const Ube = cfg.Ube === undefined ? LV('ube') : cfg.Ube;
    if (!pos(Ube)) return fail('U_BE muss größer als 0 sein.');
    if (cfg.Rs === undefined && cfg.Iset === undefined) return fail('Es fehlt der Messwiderstand Rs oder der gewünschte Strom Iset.');
    const out = { ok: true, Ube: Ube };
    if (cfg.Rs !== undefined) {
      if (!pos(cfg.Rs)) return fail('Der Messwiderstand muss größer als 0 sein.');
      out.Rs = cfg.Rs; out.Ilim = Ube / cfg.Rs; out.P = out.Ilim * out.Ilim * cfg.Rs;
    }
    if (cfg.Iset !== undefined) {
      if (!pos(cfg.Iset)) return fail('Der gewünschte Strom muss größer als 0 sein.');
      out.Iset = cfg.Iset; out.RsFor = Ube / cfg.Iset; out.PFor = cfg.Iset * cfg.Iset * out.RsFor;
    }
    return out;
  });
  /* short: Kurzschluss im CC-Betrieb. Laengsregler: P_V = (Uin - Uout) * Iset (Uout = 0). Schaltregler: nur Begriff. */
  lab.short = S_(function (cfg) {
    if (!isObj(cfg)) return fail('Eingabe fehlt.');
    if (!pos(cfg.Uin)) return fail('Die Eingangsspannung muss größer als 0 sein.');
    if (!pos(cfg.Iset)) return fail('Der eingestellte Strom muss größer als 0 sein.');
    const typ = cfg.typ === undefined ? 'linear' : String(cfg.typ);
    const Uo = cfg.Uout === undefined ? 0 : cfg.Uout;
    if (!nn(Uo) || Uo > cfg.Uin) return fail('Die Ausgangsspannung im Kurzschluss muss zwischen 0 und Uin liegen.');
    if (typ === 'schalt') return { ok: true, typ: typ, PvRegler: NaN, begriff: true, thermHinweis: false, text: 'Beim Schaltregler-Labornetzteil entsteht im Kurzschluss deutlich weniger Verlustwärme im Regler (nur als Begriff, keine Rechnung).' };
    if (typ !== 'linear') return fail('Die Bauart ist "linear" oder "schalt".');
    const Pv = (cfg.Uin - Uo) * cfg.Iset;
    return { ok: true, typ: typ, PvRegler: Pv, thermHinweis: Pv >= LV('pv_therm'), text: 'Beim Längsregler fällt im Kurzschluss die ganze Eingangsspannung am Regler ab: P_V = U_ein · I_set. Kühlung rechnest du im Thermik-Lab.', link: 'thmlab.html' };
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = C;
})(typeof window !== 'undefined' ? window : globalThis);
