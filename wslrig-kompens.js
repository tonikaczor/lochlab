/* wslrig-kompens.js - WSL-Lab (WP2b): Pruefstand 4 `kompens` - Blindleistungskompensation (SPEC 5.4).
 * Die gemeinsame Huelle liegt in wslrig-base.js: Diese Datei im Browser NACH wslrig-base.js laden (in Node holt sie sich die Basis per require).
 * Gerechnet wird NUR im Kern (WSL_CORE.comp.need / after / state / cMax, WSL_CORE.power.fromPcos / triangle / line, WSL_CORE.cx, WSL_CORE.sine.at); hier steht keine zweite Formel.
 * Alle Zahlen sind Uebungswerte (Uebungsschaltung). Simulation, kein Hinweis fuer Arbeiten an Netzspannung. Gerechnet wird nur die Parallelkompensation
 * (Reihen-, Gruppen- und Zentralkompensation sind Begriffe, F6); Modell: ideale Bauteile, Beharrungszustand, 50 Hz (limits f_netz).
 * Steuerwerte: u (V), p (W, log), cos1 (cos phi vorher), c (F, Kompensations-C, 0 erlaubt), ziel (cos phi nachher, 0 = keine Vorgabe, Ampel dann grau; die Anzeige
 *   cNoetig und zustand rechnen dann mit dem Uebungsziel limits.cos_ziel), form (nur parallel), Taste fire (Kondensator zuschalten: C steigt von 0 bis zum Anderthalbfachen der Grenze der Ueberkompensation).
 * Messgeraete: qc (var), cNoetig (uF), cos2 (cos phi nach der Kompensation), i1, i2 (A), dpv (relativer Leitungsverlust in %, (I2 / I1)^2), zustand (Code 0 unter, 1 Ziel, 2 ueber; Texte in meters[].texts).
 * Ampel (nur mit Vorgabe): gruen = Ziel erreicht und nicht ueberkompensiert (comp.state), gelb = unter dem Ziel, aber hoechstens limits.cos_fenster darunter, sonst rot; Ueberkompensation ist immer rot.
 * Zeigerbild (phasors): I_W (Wirkstrom), I1 (ohne C), I2 (mit C), I_C (Kondensatorstrom = I2 - I1, komplex ueber WSL_CORE.cx), Bezug Spannung.
 */
(function (root) {
  'use strict';
  const R = root.WSL_RIGS = root.WSL_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };
  if (typeof module !== 'undefined') module.exports = R;
  if (!R.base && typeof require === 'function') { try { require('./wslrig-base.js'); } catch (e) { /* Basis fehlt */ } }
  const B = R.base;
  if (!B) { if (typeof console !== 'undefined') console.warn('wslrig-kompens.js: Die Basis wslrig-base.js fehlt (bitte davor laden).'); return; }
  const { clamp, num, fm, isNum, eng, val } = B;

  let C0 = null; try { C0 = B.core(); } catch (e) { C0 = null; }
  const T0 = (C0 && C0.TEXTS) || {};
  const MODELL = T0.modell || 'Modell: ideale Bauteile, Beharrungszustand, Wechselspannung mit einer festen Frequenz.';
  const KONV = T0.konvention || 'Bezug ist bei der Reihenschaltung der Strom, bei der Parallelschaltung die Spannung. φ = φ_u − φ_i: induktiv ist φ positiv, kapazitiv negativ.';
  const AM = x => (Math.abs(x) >= 1 ? fm(x, 2) : fm(x, 3)) + ' A';
  const K = fn => { try { return C0 ? fn(C0) : ''; } catch (e) { return ''; } };
  const SWEEP_S = 10;                                     // Dauer des Zuschaltens (s, Zeitlupe verlaengert)
  const STUFEN = 8, STUFE_TEIL = 6;                       // Darstellung der Bank: 8 Stufen, eine Stufe = Sechstel der Grenze der Ueberkompensation (nur Bild)

  const opt = arr => arr.map(a => ({ value: a[0], label: a[1] }));
  const CONTROLS = B.fillControls([
    { key: 'u', label: 'Spannung U', type: 'slider', scale: 'lin', min: 1, max: 400, step: 1, unit: 'V', unitKind: 'volt', value: 230, gruppe: 'quelle', sicht: 'formel',
      help: 'Effektivwert der Netzspannung an Last und Kondensator. Übungswert; die Simulation ist kein Aufbau an Netzspannung.' },
    { key: 'p', label: 'Wirkleistung P', type: 'slider', scale: 'log', min: 100, max: 100000, step: 1, unit: 'W', unitKind: 'watt', value: 3200, gruppe: 'last', sicht: 'zeiger',
      help: 'Wirkleistung der Last in W. Sie ändert sich durch die Kompensation nicht; nur die Blindleistung wird kleiner. Übungswert.' },
    { key: 'cos1', label: 'cos φ vorher', type: 'slider', scale: 'lin', min: 0.3, max: 1, step: 0.01, unit: '', unitKind: 'plain', value: 0.8, gruppe: 'last', sicht: 'zeiger',
      help: 'Leistungsfaktor der induktiven Last vor der Kompensation. Bei 1 ist nichts zu kompensieren. Übungswert.' },
    { key: 'c', label: 'Kompensations-C', type: 'slider', scale: 'log', logZero: true, min: 0, max: 0.001, step: 1e-7, unit: 'F', unitKind: 'cap', value: 0, gruppe: 'bauteile', sicht: 'zeiger',
      help: 'Kapazität des Kondensators parallel zur Last. Er liefert Blindleistung Q_C = ω · C · U² und gleicht die induktive Blindleistung aus. Zu viel C überkompensiert: Die Last wird kapazitiv. Die Bank im Bild ist nur eine Darstellung in acht Stufen; gerechnet wird mit dem eingestellten C. Kondensatoren speichern Ladung (Entladen vor Berühren, nur als Begriff).' },
    { key: 'ziel', label: 'Vorgabe cos φ nachher', type: 'slider', scale: 'lin', min: 0, max: 1, step: 0.01, unit: '', unitKind: 'plain', value: 0, gruppe: 'ziel', sicht: 'formel',
      help: 'Vorgabe für den Leistungsfaktor nach der Kompensation. Bei 0 ist keine Vorgabe gesetzt und die Ampel bleibt grau; die Anzeigen rechnen dann mit dem Übungsziel. Übungswerte, F6. Bei 1 passt genau ein C, schon ein winziges Mehr überkompensiert. Die Ampelfenster sind Lehrfaustwerte.' },
    { key: 'form', label: 'Art der Kompensation', type: 'select', value: 'parallel', options: opt([['parallel', 'Parallelkompensation (nur diese wird gerechnet)']]), gruppe: 'last', sicht: null,
      help: 'Gerechnet wird nur die Parallelkompensation: Der Kondensator liegt parallel zur Last. Reihen-, Gruppen- und Zentralkompensation sind hier nur Begriffe. Netzbetreiber und Norm maßgeblich.' },
    { key: 'fire', label: 'Kondensator zuschalten', type: 'button', gruppe: 'ziel', sicht: 'zeiger',
      help: 'Schaltet den Kondensator zu: C steigt von 0 an, das Leistungsdreieck schrumpft und der Strom sinkt. Läuft C über die Grenze hinaus, kippt Q ins Negative (Überkompensation) und cos φ sinkt wieder. Ein zweiter Druck bricht ab.' }
  ]);
  const METERS = [
    { key: 'qc', label: 'Kondensator-Blindleistung Q_C', unit: 'var', digits: 1, min: 0, max: 100000, zeroIsNone: true, help: 'Blindleistung, die der eingestellte Kondensator liefert, Q_C = ω · C · U².' },
    { key: 'cNoetig', label: 'Nötiges C', unit: 'µF', digits: 2, min: 0, max: 1000, zeroIsNone: true, help: 'Kapazität, die für das Ziel nötig ist (Rechenweg im Kern). Ohne gesetzte Vorgabe gilt das Übungsziel; 0 heißt: Es muss nichts kompensiert werden.' },
    { key: 'cos2', label: 'cos φ nachher', unit: '', digits: 3, min: 0, max: 1, help: 'Leistungsfaktor mit dem eingestellten C. Er steigt bis zur Grenze der Überkompensation und sinkt danach wieder.' },
    { key: 'i1', label: 'Strom I₁ ohne C', unit: 'A', digits: 3, min: 0, max: 100, help: 'Strom aus dem Netz ohne Kompensation, I₁ = S₁ / U.' },
    { key: 'i2', label: 'Strom I₂ mit C', unit: 'A', digits: 3, min: 0, max: 100, help: 'Strom aus dem Netz mit dem eingestellten C. Er ist am kleinsten, wenn die Blindleistung ausgeglichen ist.' },
    { key: 'dpv', label: 'Leitungsverlust relativ', unit: '%', digits: 1, min: 0, max: 200, help: 'Leitungsverlust mit C im Verhältnis zu ohne C, (I₂ / I₁)². 100 % heißt: keine Ersparnis.' },
    { key: 'zustand', label: 'Zustand', unit: '', digits: 0, min: 0, max: 2, texts: ['unter dem Ziel', 'Ziel erreicht', 'überkompensiert'], help: 'Zustand der Kompensation im Vergleich zum Ziel: unter dem Ziel (0), Ziel erreicht (1) oder überkompensiert (2).' }
  ];
  const PRESETS = [
    { id: 'motor-08', name: 'Motor mit cos φ 0,8', info: 'Übungsschaltung (Pool S2023-N05): ' + K(c => { const q = c.power.fromPcos(3200, 0.8, 230); return 'Der Motor mit P = 3,2 kW und cos φ = 0,8 nimmt bei 230 V ' + AM(q.i) + ' auf (S = ' + val(q.s / 1000, 'kVA', 2) + ') und hat Q = ' + val(q.q / 1000, 'kvar', 2) + '.'; }),
      controls: { u: 230, p: 3200, cos1: 0.8, c: 0, ziel: 0 } },
    { id: 'ziel-095', name: 'Ziel cos φ 0,95', info: 'Übungsschaltung (Ziel 0,95, F6): ' + K(c => { const n = c.comp.need({ p: 3200, cos1: 0.8, cos2: 0.95, u: 230, f: 50 }); return 'Für cos φ = 0,95 sind Q_C = ' + val(n.qc, 'var') + ' und C = ' + val(n.c * 1e6, 'µF', 2) + ' nötig; der Strom sinkt von ' + AM(n.i1) + ' auf ' + AM(n.i2) + '.'; }),
      controls: { u: 230, p: 3200, cos1: 0.8, c: 0, ziel: 0.95 } },
    { id: 'ueberkomp', name: 'Überkompensation', info: 'Fehlerbild der Simulation (nicht nachbauen): ' + K(c => { const a = c.comp.after({ p: 3200, cos1: 0.8, u: 230, f: 50, c: 300e-6 }); return 'Mit C = 300 µF ist die Last überkompensiert: Q = ' + val(a.q, 'var', 1).replace('-', '−') + ' ist negativ, cos φ sinkt auf ' + fm(a.cos, 3) + ' und der Strom steigt auf ' + AM(a.i) + '.'; }),
      controls: { u: 230, p: 3200, cos1: 0.8, c: 300e-6, ziel: 0.95 } },
    { id: 'ziel-10', name: 'Ziel cos φ 1', info: 'Übungsschaltung (Pool S2023-N05): ' + K(c => { const n = c.comp.need({ p: 3200, cos1: 0.8, cos2: 1, u: 230, f: 50 }); return 'Für cos φ = 1 gleicht Q_C = ' + val(n.qc / 1000, 'kvar', 2) + ' die Blindleistung ganz aus; dazu ist C = ' + val(n.c * 1e6, 'µF', 1) + ' nötig.'; }),
      controls: { u: 230, p: 3200, cos1: 0.8, c: 0, ziel: 1 } }
  ];
  const SICHT = { zeit: 'Zeitbild: Strom ohne und mit Kondensator, der Strom mit C ist kleiner', zeiger: 'Leistungsdreieck vorher und nachher, Stromzeiger I₁, I₂ und I_C', formel: 'Q_C = P · (tan φ₁ − tan φ₂), C = Q_C / (ω · U²)' };
  const INFO = 'Blindleistungskompensation mit parallelem Kondensator, Leistungsdreieck vorher und nachher, Strom und Überkompensation. Gerechnet wird nur die Parallelkompensation. ' + KONV + ' ' + MODELL;

  function plant(P0) {
    const CORE = P0.CORE, PW = CORE.power, CP = CORE.comp, CX = CORE.cx;
    const F = B.limV(CORE, 'f_netz', 50), COS_Z = B.limV(CORE, 'cos_ziel', 0.95), COS_FEN = B.limV(CORE, 'cos_fenster', 0.05);
    const sw = { active: false, p: 0, c: 0, hi: 0, cNeed: 0, cMax: 0 };
    const cfgOf = ctl => ({ p: ctl.p, cos1: ctl.cos1, u: ctl.u, f: F, form: 'parallel' });
    const cEffOf = ctl => (sw.active ? sw.c : ctl.c);
    const okRes = r => r && r.ok !== false && r.valid !== false;

    function compute(ctl) {
      const cfg = cfgOf(ctl), cEff = cEffOf(ctl), zielSet = ctl.ziel > 0, ziel = zielSet ? ctl.ziel : COS_Z;
      const aft = CP.after(Object.assign({}, cfg, { c: cEff }));
      if (!okRes(aft)) return { ok: false, why: (aft && (aft.why || aft.text)) || CORE.TEXTS.eingabe };
      const st = CP.state(Object.assign({}, cfg, { c: cEff, cos2: ziel }));
      if (!okRes(st)) return { ok: false, why: (st && (st.why || st.text)) || CORE.TEXTS.eingabe };
      const need = CP.need(Object.assign({}, cfg, { cos2: ziel }));
      const p1 = PW.fromPcos(ctl.p, ctl.cos1, ctl.u);
      if (!okRes(p1)) return { ok: false, why: (p1 && (p1.why || p1.text)) || CORE.TEXTS.eingabe };
      const ln = PW.line({ p: ctl.p, cosphi: ctl.cos1, u: ctl.u, rl: 1, cos2: aft.cos });
      const tri2 = PW.triangle({ p: ctl.p, q: aft.q });
      return { ok: true, cfg, cEff, zielSet, ziel, aft, st, need: okRes(need) ? need : null, needWhy: okRes(need) ? '' : ((need && need.why) || ''), p1, ln: okRes(ln) ? ln : null, tri2: okRes(tri2) ? tri2 : null, cMax: aft.cMax };
    }
    const zustandCode = st => (st.state === 'ueber' ? 2 : st.state === 'ziel' ? 1 : 0);
    function meters(r) {
      if (!r.ok) return { qc: 0, cNoetig: 0, cos2: 0, i1: 0, i2: 0, dpv: 0, zustand: 0 };
      return { qc: r.aft.qc, cNoetig: r.need ? r.need.c * 1e6 : 0, cos2: r.aft.cos, i1: r.p1.i, i2: r.aft.i, dpv: r.ln ? r.ln.ratio * 100 : 0, zustand: zustandCode(r.st) };
    }
    function assess(r, ctl) {
      if (!r.ok) return { ok: false, ampel: 'rot', text: r.why };
      const a = r.aft, soll = ctl.ziel, o = { ziel: { text: 'cos φ ≥ ' + fm(soll, 2), soll, ist: a.cos, unit: '' }, margin: Math.abs(a.cos - soll) };
      if (r.st.state === 'ueber') return Object.assign(o, { ok: false, ampel: 'rot', text: r.st.text + ' Ein hoher cos φ allein heißt nicht: gut kompensiert.' });
      if (r.st.state === 'ziel') return Object.assign(o, { ok: true, ampel: 'gruen', text: r.st.text + ' Die Vorgabe ist erreicht.' });
      const gelb = a.cos >= soll - COS_FEN - 1e-9;
      let lim = ''; try { lim = CORE.limitText('cos_fenster'); } catch (e) { lim = ''; }
      return Object.assign(o, { ok: false, ampel: gelb ? 'gelb' : 'rot', text: r.st.text + (gelb ? ' Knapp darunter (gelb bei ' + lim + ', Lehrfaustwert).' : ' Noch deutlich darunter.') });
    }
    function diag(r, ctl) {
      if (!r.ok) return [{ id: 'ungueltig', kind: 'error', text: r.why }];
      const out = [];
      if (r.st.state === 'ueber') out.push({ id: 'ueber', kind: 'warn', text: r.st.text + ' Überkompensation ist hier ein Fehlerbild der Simulation; ein hoher cos φ allein heißt nicht: gut kompensiert.' });
      if (ctl.cos1 >= 1) out.push({ id: 'cos-eins', kind: 'info', text: 'Der Leistungsfaktor ist schon 1: Es muss nichts kompensiert werden.' });
      else if (ctl.ziel > 0 && !r.need) out.push({ id: 'ziel-niedrig', kind: 'info', text: CORE.TEXTS.kompZielNiedrig });
      if (r.aft.c > 0 && r.st.state !== 'ueber' && r.ln && r.ln.ratio < 1) out.push({ id: 'ersparnis', kind: 'info', text: 'Der Strom sinkt von ' + AM(r.p1.i) + ' auf ' + AM(r.aft.i) + '; der Leitungsverlust sinkt auf ' + fm(r.ln.ratio * 100, 1) + ' % des Werts ohne Kondensator.' });
      if (sw.active) out.push({ id: 'durchlauf', kind: 'info', text: 'Der Kondensator wird zugeschaltet: aktuell C = ' + eng(r.cEff, 'F') + '.' });
      return out;
    }
    function phasors(r) {
      if (!r.ok) return { ok: false, why: r.why };
      if (!r.tri2) return { ok: false, why: CORE.TEXTS.eingabe };
      const rad = d => d * Math.PI / 180, deg = x => x * 180 / Math.PI;
      const w = PW.fromPcos(r.cfg.p, 1, r.cfg.u);
      const z1 = CX.fromPolar(r.p1.i, -rad(r.p1.phi)), z2 = CX.fromPolar(r.aft.i, -rad(r.tri2.phi)), d = CX.sub(z2, z1);
      const lc = CX.abs(d), ac = lc > 1e-9 * Math.max(r.p1.i, 1e-300) ? deg(CX.arg(d)) : 90;
      if (!isNum(lc) || !isNum(ac) || !okRes(w)) return { ok: false, why: CORE.TEXTS.eingabe };
      return { ok: true, art: 'induktiv', bezug: 'spannung', effektiv: true, unit: 'A', phi: r.p1.phi,
        list: [{ name: 'I_W', len: w.i, angle: 0, kind: 'p', unit: 'A' }, { name: 'I₁', len: r.p1.i, angle: -r.p1.phi, kind: 'ref', unit: 'A' }, { name: 'I₂', len: r.aft.i, angle: -r.tri2.phi, kind: 'i', unit: 'A' }, { name: 'I_C', len: lc, angle: ac, kind: 'q', unit: 'A' }] };
    }
    function curves(r, ctl) {
      if (!r.ok) return [];
      const hi = r.cMax > 0 ? 2 * r.cMax : 100e-6, N = 80, cs = [], is = [], qs = [];
      for (let k = 0; k <= N; k++) {
        const c = hi * k / N, a = CP.after(Object.assign({}, r.cfg, { c }));
        if (!okRes(a)) continue;
        cs.push([c * 1e6, a.cos]); is.push([c * 1e6, a.i]); qs.push([c * 1e6, a.q]);
      }
      const marks = [];
      if (r.need && r.need.c > 0) marks.push({ x: r.need.c * 1e6, label: 'nötiges C' });
      if (r.cMax > 0) marks.push({ x: r.cMax * 1e6, label: 'Grenze der Überkompensation' });
      const mk = y => ({ x: r.cEff * 1e6, y, label: 'jetzt' });
      const X = { xLabel: 'Kompensations-C', xUnit: 'µF', xScale: 'lin', marks };
      const cosC = Object.assign({ id: 'cos', title: 'cos φ über dem Kompensations-C', yLabel: 'Leistungsfaktor cos φ', yUnit: '–', series: [{ name: 'cos φ', points: cs }], marker: mk(r.aft.cos) }, X);
      if (ctl.ziel > 0) cosC.limit = { y: ctl.ziel, label: 'Ziel cos φ' };
      return [Object.assign({ id: 'strom', title: 'Strom I über dem Kompensations-C', yLabel: 'Strom I', yUnit: 'A', series: [{ name: 'I', points: is }], marker: mk(r.aft.i) }, X), cosC,
        Object.assign({ id: 'blind', title: 'Blindleistung Q über dem Kompensations-C', yLabel: 'Blindleistung Q', yUnit: 'var', series: [{ name: 'Q', points: qs }], marker: mk(r.aft.q) }, X)];
    }
    function state(r, ctl) {
      const base = { sweep: sw.active, sweepP: sw.p, ziel: ctl.ziel, zielGesetzt: ctl.ziel > 0, f: F };
      if (!r.ok) return Object.assign(base, { valid: false, why: r.why, text: r.why, zustand: '', zustandCode: 0 });
      return Object.assign(base, { valid: true, zielWirksam: r.ziel, zustand: r.st.state, zustandCode: zustandCode(r.st), text: r.st.text, cEff: r.cEff, cNoetig: r.need ? r.need.c : 0, cMax: r.cMax, cos: r.aft.cos, cos1: ctl.cos1,
        q: r.aft.q, q1: r.aft.q1, qc: r.aft.qc, i1: r.p1.i, i2: r.aft.i, ueber: !!r.aft.ueber, art: r.aft.art, dpv: r.ln ? r.ln.ratio : 1, nichtsNoetig: !r.need });
    }
    function timeData(r, n) {
      const T = 1 / F, per = 2, k = T >= 1e-3 ? { u: 'ms', k: 1e3 } : { u: 'µs', k: 1e6 };
      const a1 = { ampl: r.p1.i * Math.SQRT2, f: F, phi: -r.p1.phi }, a2 = { ampl: r.aft.i * Math.SQRT2, f: F, phi: -r.tri2.phi }, au = { ampl: r.cfg.u * Math.SQRT2, f: F, phi: 0 };
      const t = [], y1 = [], y2 = [], yu = [];
      for (let q = 0; q < n; q++) { const ts = -T / 2 + q * (per * T) / (n - 1); t.push(ts * k.k); y1.push(CORE.sine.at(a1, ts)); y2.push(CORE.sine.at(a2, ts)); yu.push(CORE.sine.at(au, ts)); }
      return { tUnit: k.u, t, series: [{ name: 'i₁ ohne C', unit: 'A', kind: 'ref', y: y1 }, { name: 'i₂ mit C', unit: 'A', kind: 'i', y: y2 }, { name: 'u', unit: 'V', kind: 'u', y: yu }], marks: { span: [{ t0: 0, t1: T * k.k, name: 'T' }] } };
    }
    function wrap(ctx, g, text, maxW, size, maxLines) {
      const words = String(text).split(' '), lines = []; let cur = '';
      ctx.font = g.font(size, false);
      words.forEach(wd => { const t = cur ? cur + ' ' + wd : wd; if (cur && ctx.measureText(t).width > maxW) { lines.push(cur); cur = wd; } else cur = t; });
      if (cur) lines.push(cur);
      return lines.slice(0, maxLines || 4);
    }
    function draw(ctx, w, h, t, view, sc) {
      const r = view.res, pal = sc.pal, R0 = sc.rect, gap = 8, g = sc.gfx;
      if (!r || !r.ok) {
        wrap(ctx, g, (r && r.why) || '', R0.w - 16, 13, 4).forEach((ln, k) => g.text(ctx, ln, R0.x + 8, R0.y + 20 + k * 18, { size: 13, color: pal.fg, max: R0.w - 16 }));
        return;
      }
      const chipsH = R0.h >= 330 ? 30 : 0, bodyH = R0.h - chipsH - gap, a = r.aft;
      let cR, tR, pR, sR;
      if (R0.w >= 680) {
        const lw = Math.round(R0.w * 0.5) - gap / 2, rw = R0.w - lw - gap, h1 = Math.round(bodyH * 0.38), h2 = Math.round(bodyH * 0.5);
        cR = { x: R0.x, y: R0.y, w: lw, h: h1 }; tR = { x: R0.x, y: R0.y + h1 + gap, w: lw, h: bodyH - h1 - gap };
        pR = { x: R0.x + lw + gap, y: R0.y, w: rw, h: h2 }; sR = { x: R0.x + lw + gap, y: R0.y + h2 + gap, w: rw, h: bodyH - h2 - gap };
      } else {
        const hs = [0.21, 0.28, 0.3, 0.21].map(q => Math.round((bodyH - 3 * gap) * q));
        let y = R0.y;
        cR = { x: R0.x, y, w: R0.w, h: hs[0] }; y += hs[0] + gap; tR = { x: R0.x, y, w: R0.w, h: hs[1] }; y += hs[1] + gap;
        pR = { x: R0.x, y, w: R0.w, h: hs[2] }; y += hs[2] + gap; sR = { x: R0.x, y, w: R0.w, h: hs[3] };
      }
      const on = r.cMax > 0 ? clamp(Math.round(r.cEff / (r.cMax / STUFE_TEIL)), 0, STUFEN) : 0;
      if (!sc.view('capBank', cR, { n: STUFEN, on, cTotal: r.cEff, state: r.st.state }, {})) sc.view('schematic', cR, { kind: 'komp', labels: { u: 'U = ' + val(r.cfg.u, 'V'), z: 'Last', c: 'C = ' + eng(r.cEff, 'F') } }, {});
      sc.view('triangle', tR, { kind: 'leistung', a: r.cfg.p, b: a.q, ghost: { a: r.cfg.p, b: a.q1 } }, {});
      const ph = phasors(r);
      if (ph.ok) sc.view('phasor', pR, { list: ph.list, unit: 'A', bezug: 'spannung', rotate: false, project: false }, {});
      else { g.panel(ctx, pR.x, pR.y, pR.w, pR.h, pal.panel, pal.line, 6); g.text(ctx, ph.why || '', pR.x + 10, pR.y + 24, { size: 12, color: pal.mute, max: pR.w - 20 }); }
      if (r.tri2) sc.view('scope', sR, timeData(r, sc.quality === 'niedrig' ? 160 : 360), {});
      if (chipsH) {
        const y = R0.y + bodyH + gap;
        const items = [['cos φ', fm(a.cos, 3)], ['I₁', val(r.p1.i, 'A')], ['I₂', val(a.i, 'A')], [sw.active ? 'C (zuschalten)' : 'C', val(r.cEff * 1e6, 'µF', 1)]];
        const cw = (R0.w - gap * (items.length - 1)) / items.length;
        items.forEach((it, k) => g.chip(ctx, it[0], it[1], R0.x + k * (cw + gap), y, cw, chipsH - 2, pal, { size: 12, color: k === 1 || k === 2 ? undefined : (r.st.state === 'ueber' ? pal.bad : undefined) }));
      }
    }
    return {
      compute, meters, assess, diag, curves, phasors, state, draw,
      phaseHz: () => 0.15,
      step(dtMs, r, ctl) {
        if (!sw.active) return;
        const prev = sw.c;
        sw.p += dtMs / (SWEEP_S * 1000);
        if (sw.p >= 1) { sw.p = 1; sw.active = false; P0.say('Das Zuschalten ist beendet.', 'info'); P0.bump(); return; }
        sw.c = sw.hi * sw.p;
        if (sw.cNeed > 0 && prev < sw.cNeed && sw.c >= sw.cNeed) P0.say('Bei C = ' + eng(sw.cNeed, 'F') + ' erreicht cos φ das Ziel ' + fm(r.ziel, 3) + '.', 'info');
        if (sw.cMax > 0 && prev < sw.cMax && sw.c >= sw.cMax) P0.say('Ab C = ' + eng(sw.cMax, 'F') + ' ist die Last überkompensiert: Q wird negativ, cos φ sinkt wieder.', 'warn');
        P0.bump();
      },
      fire(r, ctl) {
        if (sw.active) { sw.active = false; P0.say('Das Zuschalten wurde abgebrochen.', 'info'); return true; }
        if (!r.ok) { P0.say('Mit diesen Werten gibt es nichts zuzuschalten: ' + r.why, 'warn'); return false; }
        if (!(r.cMax > 0)) { P0.say('Der Leistungsfaktor ist schon 1: Es muss nichts kompensiert werden.', 'info'); return true; }
        sw.hi = 1.5 * r.cMax; sw.cMax = r.cMax; sw.cNeed = r.need ? r.need.c : 0; sw.p = 0; sw.c = 0; sw.active = true;
        P0.say('Der Kondensator wird zugeschaltet: C steigt von 0 bis ' + eng(sw.hi, 'F') + '. Beobachte Leistungsdreieck und Strom.', 'info');
        return true;
      },
      reset() { sw.active = false; sw.p = 0; sw.c = 0; }
    };
  }

  R.register({ id: 'kompens', name: 'Blindleistungskompensation', icon: '⚖️', info: INFO, controls: CONTROLS, meters: METERS, presets: PRESETS,
    create(opts) { return B.makeRig({ id: 'kompens', name: 'Blindleistungskompensation', icon: '⚖️', info: INFO, world: { w: 960, h: 640 }, sicht: SICHT, controls: CONTROLS, meters: METERS, presets: PRESETS,
      zielKeys: ['ziel'], params: {}, plant }, opts); } });
})(typeof window !== 'undefined' ? window : globalThis);
