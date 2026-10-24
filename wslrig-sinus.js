/* wslrig-sinus.js - WSL-Lab (WP2a): Pruefstand 1 `sinus` - Sinus, Effektiv-, Scheitel-, Mittelwert und Phase (SPEC 5.1).
 * Die gemeinsame Huelle (Steuerwerte, Cache, Ampel, Vorher/Nachher, Zeitlupe, Zeichenhuelle) liegt in wslrig-base.js: Diese Datei im Browser NACH wslrig-base.js laden
 * (in Node holt sie sich die Basis per require). Gerechnet wird NUR im Kern (WSL_CORE.sine.values / shift / sum / at); hier steht keine zweite Formel.
 * Alle Zahlen sind Uebungswerte. Simulation, kein Hinweis fuer Arbeiten an Netzspannung. Modell: ideale Signalquelle, Beharrungszustand.
 * Steuerwerte: form, ampl (V, Scheitelwert), f (Hz, log), phi (Grad), offset (V), zweite (zweite Spannung), ampl2 (V), phi2 (Grad), raster (Perioden im Bild), wert (Zeigerlaenge),
 *   ziel (V, Vorgabe Effektivwert, 0 = keine Vorgabe), Taste fire (Phase einfrieren, wieder loesen).
 * Messgeraete: ueff (V), uss (V), umittel (V, Gleichrichtwert), periode (ms), dt (ms, mit Vorzeichen: positiv = eilt vor), phase (Grad). Wirft nie.
 * Vorzeichen (SPEC 2, F2): phi > 0 = die Spannung eilt vor; bei zwei Spannungen gilt der Winkel von u2 gegenueber u1.
 */
(function (root) {
  'use strict';
  const R = root.WSL_RIGS = root.WSL_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };
  if (typeof module !== 'undefined') module.exports = R;
  if (!R.base && typeof require === 'function') { try { require('./wslrig-base.js'); } catch (e) { /* Basis fehlt */ } }
  const B = R.base;
  if (!B) { if (typeof console !== 'undefined') console.warn('wslrig-sinus.js: Die Basis wslrig-base.js fehlt (bitte davor laden).'); return; }
  const { clamp, num, fm, isNum, eng, val } = B;

  let C0 = null; try { C0 = B.core(); } catch (e) { C0 = null; }
  const MODELL = (C0 && C0.TEXTS && C0.TEXTS.modell) || 'Modell: ideale Bauteile, Beharrungszustand, Wechselspannung mit einer festen Frequenz.';
  /** Zahl aus dem Kern fuer Voreinstellungs-Texte (keine Handzahlen); ohne Kern leer. */
  const K = fn => { try { return C0 ? fn(C0) : ''; } catch (e) { return ''; } };

  const opt = arr => arr.map(a => ({ value: a[0], label: a[1] }));
  const CONTROLS = B.fillControls([
    { key: 'form', label: 'Kurvenform', type: 'select', value: 'sinus', options: opt([['sinus', 'Sinus'], ['rechteck', 'Rechteck'], ['dreieck', 'Dreieck']]), gruppe: 'quelle', sicht: 'zeit',
      help: 'Form der Spannung. Beim Sinus gilt U = û / √2; beim Rechteck ist der Effektivwert gleich dem Scheitelwert, beim Dreieck û / √3. Zeiger gibt es nur für den Sinus.' },
    { key: 'ampl', label: 'Scheitelwert û', type: 'slider', scale: 'lin', min: 0.1, max: 600, step: 0.01, unit: 'V', unitKind: 'volt', value: 325.27, gruppe: 'quelle', sicht: 'zeit',
      help: 'Scheitelwert der Spannung, der höchste Augenblickswert. Der Spitze-Spitze-Wert U_ss ist doppelt so groß. Übungswert: 325,27 V ergibt beim Sinus 230 V Effektivwert.' },
    { key: 'f', label: 'Frequenz f', type: 'slider', scale: 'log', min: 1, max: 100000, step: 0.1, unit: 'Hz', unitKind: 'freq', value: 50, gruppe: 'quelle', sicht: 'zeit',
      help: 'Frequenz der Spannung. Die Periodendauer ist T = 1 / f; bei höherer Frequenz wird die Periode kürzer, und derselbe Phasenwinkel entspricht einem kürzeren Zeitversatz.' },
    { key: 'phi', label: 'Phasenwinkel φ', type: 'slider', scale: 'lin', min: -180, max: 180, step: 1, unit: '°', unitKind: 'deg', value: 0, gruppe: 'quelle', sicht: 'zeiger',
      help: 'Phasenwinkel der Spannung gegenüber dem Bezug (Nulldurchgang bei t = 0). Positiv heißt: Die Spannung eilt vor. Der Zeitversatz Δt ist φ / 360° · T.' },
    { key: 'offset', label: 'Gleichanteil', type: 'slider', scale: 'lin', min: -300, max: 300, step: 1, unit: 'V', unitKind: 'volt', value: 0, gruppe: 'quelle', sicht: 'zeit',
      help: 'Gleichspannung, die zur Wechselspannung addiert wird. Der Effektivwert wird dann U = √(U_DC² + U_AC²); Gleichrichtwert und Formfaktor gelten für den Wechselanteil.' },
    { key: 'zweite', label: 'Zweite Spannung', type: 'switch', value: false, gruppe: 'quelle', sicht: 'zeiger',
      help: 'Schaltet eine zweite, gleichfrequente Spannung u₂ dazu. Die Summe wird als Zeiger-Addition gerechnet (nur für den Sinus) und im Zeitbild als dritte Kurve gezeigt.' },
    { key: 'ampl2', label: 'Scheitelwert û₂', type: 'slider', scale: 'lin', min: 0, max: 600, step: 0.01, unit: 'V', unitKind: 'volt', value: 150, gruppe: 'quelle', sicht: 'zeiger',
      visible: s => !!s.zweite, help: 'Scheitelwert der zweiten Spannung u₂ (gleiche Frequenz und Kurvenform wie u₁).' },
    { key: 'phi2', label: 'Phasenwinkel φ₂', type: 'slider', scale: 'lin', min: -180, max: 180, step: 1, unit: '°', unitKind: 'deg', value: 90, gruppe: 'quelle', sicht: 'zeiger',
      visible: s => !!s.zweite, help: 'Phasenwinkel der zweiten Spannung. Gemessen wird φ₂ − φ₁: Positiv heißt, u₂ eilt der Spannung u₁ vor.' },
    { key: 'raster', label: 'Perioden im Bild', type: 'select', value: 2, options: opt([[1, '1 Periode'], [2, '2 Perioden'], [3, '3 Perioden'], [4, '4 Perioden']]), gruppe: 'ziel', sicht: 'zeit',
      help: 'Zeitbasis des Zeitbildes: wie viele Perioden zu sehen sind. Das ist nur die Darstellung, die Rechnung ändert sich nicht.' },
    { key: 'wert', label: 'Zeigerlänge', type: 'select', value: 'scheitel', options: opt([['scheitel', 'Scheitelwert'], ['effektiv', 'Effektivwert']]), gruppe: 'ziel', sicht: 'zeiger',
      help: 'Ob der Zeiger den Scheitelwert oder den Effektivwert darstellt. Nur beim Scheitelwert ist die Projektion auf die Zeitachse der Augenblickswert.' },
    { key: 'ziel', label: 'Vorgabe Effektivwert', type: 'slider', scale: 'lin', min: 0, max: 600, step: 0.1, unit: 'V', unitKind: 'volt', value: 0, gruppe: 'ziel', sicht: null,
      help: 'Vorgabe für den Effektivwert U. Bei 0 V ist keine Vorgabe gesetzt und die Ampel bleibt grau. Die Ampelfenster sind Lehrfaustwerte und stehen in den Grenzwerten des Kerns.' },
    { key: 'fire', label: 'Phase einfrieren', type: 'button', gruppe: 'ziel', sicht: 'zeiger',
      help: 'Friert den umlaufenden Zeiger ein, damit du den Phasenwinkel und den Zeitversatz am Raster ablesen kannst. Ein zweiter Druck lässt den Zeiger wieder laufen.' }
  ]);
  const METERS = [
    { key: 'ueff', label: 'Effektivwert U', unit: 'V', digits: 2, min: 0, max: 600, help: 'Effektivwert aus dem Kern (Sinus: û / √2). Er wirkt im Widerstand wie eine Gleichspannung gleicher Höhe.' },
    { key: 'uss', label: 'Spitze-Spitze-Wert U_ss', unit: 'V', digits: 2, min: 0, max: 1200, help: 'Abstand zwischen höchstem und tiefstem Augenblickswert: das Doppelte des Scheitelwerts.' },
    { key: 'umittel', label: 'Gleichrichtwert', unit: 'V', digits: 2, min: 0, max: 600, help: 'Arithmetischer Mittelwert des Betrags (Gleichrichtwert), beim Sinus 2 / π · û.' },
    { key: 'periode', label: 'Periodendauer T', unit: 'ms', digits: 3, min: 0, max: 1000, help: 'Dauer einer vollen Schwingung, T = 1 / f.' },
    { key: 'dt', label: 'Zeitversatz Δt', unit: 'ms', digits: 3, min: -500, max: 500, help: 'Zeitversatz zum Bezug, aus dem Phasenwinkel gerechnet. Positiv heißt: Die Spannung eilt vor. Bei zwei Spannungen gilt u₂ gegenüber u₁.' },
    { key: 'phase', label: 'Phasenwinkel φ', unit: '°', digits: 1, min: -180, max: 180, help: 'Phasenwinkel gegenüber dem Bezug. Bei zwei Spannungen ist es φ₂ − φ₁.' }
  ];
  const PRESETS = [
    { id: 'netz-230', name: 'Netzspannung 230 V', info: 'Übungsschaltung: ' + K(c => 'Scheitelwert ' + fm(325.27, 2) + ' V' + ' ergibt beim Sinus ' + val(c.sine.values({ ampl: 325.27, f: 50 }).rms, 'V') + ' Effektivwert.'),
      controls: { form: 'sinus', ampl: 325.27, f: 50, phi: 0, offset: 0, zweite: false } },
    { id: 'phase-45', name: 'Phase 45°', info: K(c => 'Bei 50 Hz sind 45° ein Zeitversatz von ' + eng(c.sine.shift({ f: 50, phi: 45 }).dtS, 's') + '; die Spannung eilt vor.'),
      controls: { form: 'sinus', ampl: 325.27, f: 50, phi: 45, offset: 0, zweite: false } },
    { id: 'rechteck', name: 'Rechteck', info: K(c => { const v = c.sine.values({ form: 'rechteck', ampl: 100, f: 1000 }); return 'Beim Rechteck ist der Effektivwert gleich dem Scheitelwert (' + val(v.rms, 'V') + '), der Formfaktor ist ' + fm(v.formFactor, 2) + '.'; }),
      controls: { form: 'rechteck', ampl: 100, f: 1000, phi: 0, offset: 0, zweite: false } },
    { id: 'zwei-sinus', name: 'Zwei Sinusspannungen', info: K(c => { const s = c.sine.sum({ ampl: 100, phi: 0, f: 50 }, { ampl: 100, phi: 90, f: 50 }); return 'Zwei gleich große Spannungen mit 90° Phasenverschiebung ergeben als Summe û = ' + val(s.ampl, 'V') + ' bei ' + fm(s.phi, 1) + '°.'; }),
      controls: { form: 'sinus', ampl: 100, f: 50, phi: 0, offset: 0, zweite: true, ampl2: 100, phi2: 90 } },
    { id: 'gleichanteil', name: 'Mit Gleichanteil', info: K(c => { const v = c.sine.values({ ampl: 100, f: 50, offset: 100 }); return 'Gleichanteil 100 V und Wechselanteil û = 100 V ergeben U = √(U_DC² + U_AC²) = ' + val(v.rms, 'V') + '.'; }),
      controls: { form: 'sinus', ampl: 100, f: 50, phi: 0, offset: 100, zweite: false } }
  ];
  const SICHT = { zeit: 'Zeitbild: u über t mit û, U_ss, T und Δt', zeiger: 'Zeigerbild: der Zeiger dreht, seine Projektion auf die Zeitachse ist u', formel: 'Sinus: U = û / √2 und T = 1 / f' };
  const INFO = 'Sinus, Effektivwert, Scheitelwert, Mittelwert und Phase. Zeitbild und Zeigerbild zeigen dieselbe Spannung. ' + MODELL;

  function plant(P0) {
    const CORE = P0.CORE;
    let frozen = false;
    const fmt = (x, d) => { try { return CORE.fmt(x, d); } catch (e) { return fm(x, d); } };
    const engF = (x, u) => { try { return CORE.fmtEng(x, u); } catch (e) { return eng(x, u); } };
    const tUnitOf = T => (T >= 1 ? { u: 's', k: 1 } : T >= 1e-3 ? { u: 'ms', k: 1e3 } : { u: 'µs', k: 1e6 });
    const normDeg = p => { let x = p % 360; if (x > 180) x -= 360; if (x <= -180) x += 360; return x; };

    function compute(ctl) {
      const cfg = { form: ctl.form, ampl: ctl.ampl, f: ctl.f, phi: ctl.phi, offset: ctl.offset };
      const v = CORE.sine.values(cfg);
      if (!v || v.ok === false) return { ok: false, why: (v && v.why) || CORE.TEXTS.eingabe };
      const two = !!ctl.zweite;
      const cfg2 = two ? { form: ctl.form, ampl: ctl.ampl2, f: ctl.f, phi: ctl.phi2, offset: 0 } : null;
      const dphi = two ? normDeg(ctl.phi2 - ctl.phi) : ctl.phi;
      const sh = CORE.sine.shift({ f: ctl.f, phi: dphi });
      if (!sh || sh.ok === false) return { ok: false, why: (sh && sh.why) || CORE.TEXTS.eingabe };
      const dtSigned = sh.dir === 'vor' ? sh.dtMs : sh.dir === 'nach' ? -sh.dtMs : 0;
      let sum = null;
      if (two && ctl.form === 'sinus') {
        const s = CORE.sine.sum({ ampl: ctl.ampl, phi: ctl.phi, f: ctl.f }, { ampl: ctl.ampl2, phi: ctl.phi2, f: ctl.f });
        if (s && s.ok !== false) sum = s;
      }
      return { ok: true, cfg, cfg2, v, two, dphi, sh, dtSigned, sum, T: v.T, tu: tUnitOf(v.T) };
    }
    const shiftText = (r, ctl) => {
      if (!r.ok) return '';
      const w = r.two ? ['Die Spannung u₂', 'der Spannung u₁'] : ['Die Spannung', 'dem Bezug'];
      if (r.sh.dir === 'gleich') return (r.two ? 'Die Spannungen u₁ und u₂' : 'Die Spannung und der Bezug') + ' sind in Phase.';
      return w[0] + ' eilt ' + w[1] + ' um ' + fmt(Math.abs(r.sh.phi), 1) + '° (' + engF(r.sh.dtS, 's') + ') ' + r.sh.dir + '.';
    };

    function meters(r) {
      if (!r.ok) return { ueff: 0, uss: 0, umittel: 0, periode: 0, dt: 0, phase: 0 };
      return { ueff: r.v.rms, uss: r.v.pp, umittel: r.v.rect, periode: r.T * 1000, dt: r.dtSigned, phase: r.dphi };
    }
    function assess(r, ctl) {
      if (!r.ok) return { ok: false, ampel: 'rot', text: r.why };
      const soll = ctl.ziel, ist = r.v.rms, pct = Math.abs(ist - soll) / soll * 100;
      const amp = B.devAmpel(pct, CORE);
      let text = B.devText('Effektivwert', ist, soll, 'V', pct, CORE);
      if (amp === 'gruen') text += ' Die Vorgabe ist erreicht.';
      else text += ist < soll ? ' Der Effektivwert ist zu klein.' : ' Der Effektivwert ist zu groß.';
      return { ok: amp === 'gruen', ampel: amp, text, margin: pct, ziel: { text: 'Effektivwert ' + val(soll, 'V'), soll, ist, unit: 'V' } };
    }
    function diag(r, ctl) {
      const out = [];
      if (!r.ok) { out.push({ id: 'ungueltig', kind: 'error', text: r.why }); return out; }
      if (ctl.form !== 'sinus' && (ctl.phi !== 0 || ctl.zweite)) out.push({ id: 'nur-sinus', kind: 'info', text: CORE.TEXTS.nurSinus });
      if (ctl.offset !== 0) out.push({ id: 'gleichanteil', kind: 'info', text: 'Mit Gleichanteil ' + val(ctl.offset, 'V') + ' gilt U = √(U_DC² + U_AC²) = ' + val(r.v.rms, 'V') + ' (Wechselanteil ' + val(r.v.acRms, 'V') + ').' });
      if (r.two) {
        if (r.sum) out.push({ id: 'summe', kind: 'info', text: 'Die Summe gleichfrequenter Sinusspannungen ist wieder ein Sinus: û = ' + val(r.sum.ampl, 'V') + ', Phasenwinkel ' + fmt(r.sum.phi, 1) + '° (Zeiger-Addition).' });
        else out.push({ id: 'summe-kurve', kind: 'info', text: 'Bei dieser Kurvenform gibt es keine Zeiger-Addition; die Summe ist nur als Kurve im Zeitbild zu sehen.' });
      }
      if (frozen) out.push({ id: 'eingefroren', kind: 'info', text: 'Zeiger eingefroren: ' + shiftText(r, ctl) });
      return out;
    }
    function waveform(r, ctl, o) {
      if (!r.ok) return null;
      o = o || {};
      const n = clamp(Math.floor(num(o.n, 360)), 24, 4000), per = clamp(Math.floor(num(o.periods, ctl.raster)), 1, 20), T = r.T, tu = r.tu;
      const t = [], y1 = [], y2 = [], ys = [];
      for (let k = 0; k < n; k++) {
        const ts = -T / 2 + k * (per * T) / (n - 1);
        t.push(ts * tu.k);
        const a = CORE.sine.at(r.cfg, ts), b = r.two ? CORE.sine.at(r.cfg2, ts) : 0;
        y1.push(a); y2.push(b); ys.push(a + b);
      }
      const series = [{ name: r.two ? 'u₁' : 'u', unit: 'V', kind: 'u', y: y1 }];
      if (r.two) { series.push({ name: 'u₂', unit: 'V', kind: 'l2', y: y2 }); series.push({ name: 'u₁ + u₂', unit: 'V', kind: 'l3', y: ys }); }
      const h = [{ y: r.v.max, name: ctl.offset === 0 ? 'û' : 'u_max', series: 0 }, { y: r.v.rms, name: 'U', series: 0 }];
      if (ctl.offset !== 0) h.push({ y: ctl.offset, name: 'Gleichanteil', series: 0 });
      const span = [{ t0: 0, t1: T * tu.k, name: 'T' }];
      const tc1 = -ctl.phi / 360 * T, tc2 = r.two ? -ctl.phi2 / 360 * T : 0;
      const a0 = r.two ? tc1 : 0, a1 = r.two ? tc2 : tc1;
      if (Math.abs(a1 - a0) > 1e-12 * T && r.sh.dir !== 'gleich') span.push({ t0: Math.min(a0, a1) * tu.k, t1: Math.max(a0, a1) * tu.k, name: 'Δt' });
      return { tUnit: tu.u, t, series, marks: { h, span }, periods: per, T };
    }
    function phasors(r, ctl) {
      if (!r.ok) return { ok: false, why: r.why };
      if (ctl.form !== 'sinus') return { ok: false, why: CORE.TEXTS.nurSinus };
      const eff = ctl.wert === 'effektiv', k = eff ? 1 / Math.SQRT2 : 1;
      const list = [{ name: r.two ? 'U_1' : 'U', len: r.cfg.ampl * k, angle: ctl.phi, unit: 'V' }];
      if (r.two) {
        list.push({ name: 'U_2', len: ctl.ampl2 * k, angle: ctl.phi2, unit: 'V' });
        if (r.sum) list.push({ name: 'U_Σ', len: r.sum.ampl * k, angle: r.sum.phi, unit: 'V' });
      }
      return { ok: true, bezug: 'spannung', f: ctl.f, phi: r.dphi, effektiv: eff, wert: ctl.wert, list };
    }
    function curves(r, ctl) {
      if (!r.ok) return [];
      const fs = [], pts = [], pts2 = [];
      for (let k = 0; k <= 60; k++) fs.push(Math.pow(10, k / 60 * 5));
      fs.forEach(f => {
        const v = CORE.sine.values({ form: 'sinus', ampl: 1, f });
        pts.push([f, v.T * 1000]);
        const sh = CORE.sine.shift({ f, phi: r.dphi });
        pts2.push([f, sh.dtMs]);
      });
      return [
        { id: 'periode', title: 'Periodendauer über der Frequenz', xLabel: 'Frequenz f', xUnit: 'Hz', xScale: 'log', yLabel: 'Periodendauer T', yUnit: 'ms', series: [{ name: 'T', points: pts }], marker: { x: ctl.f, y: r.T * 1000, label: 'jetzt' } },
        { id: 'zeitversatz', title: 'Zeitversatz bei gleichem Phasenwinkel', xLabel: 'Frequenz f', xUnit: 'Hz', xScale: 'log', yLabel: 'Zeitversatz |Δt|', yUnit: 'ms', series: [{ name: '|Δt| bei ' + fmt(Math.abs(r.dphi), 1) + '°', points: pts2 }], marker: { x: ctl.f, y: Math.abs(r.dtSigned), label: 'jetzt' } }
      ];
    }
    function state(r, ctl) {
      if (!r.ok) return { valid: false, why: r.why, frozen };
      return { valid: true, frozen, T: r.T, tUnit: r.tu.u, dtMs: r.dtSigned, dphi: r.dphi, dir: r.sh.dir, shiftText: shiftText(r, ctl), rms: r.v.rms, peak: r.v.peak, pp: r.v.pp, rect: r.v.rect,
        formFactor: r.v.formFactor, crest: r.v.crest, summeAmpl: r.sum ? r.sum.ampl : 0, summePhi: r.sum ? r.sum.phi : 0, summeRms: r.sum ? r.sum.rms : 0, hasSum: !!r.sum };
    }
    function draw(ctx, w, h, t, view, sc) {
      const r = view.res, pal = sc.pal, R0 = sc.rect, gap = 8;
      if (!r || !r.ok) { sc.gfx.text(ctx, (r && r.why) || '', R0.x + 8, R0.y + 20, { size: 13, color: pal.fg, max: R0.w - 16 }); return; }
      const chipsH = R0.h >= 300 ? 30 : 0, hintH = R0.h >= 260 ? 18 : 0, bodyH = R0.h - chipsH - hintH - 2 * gap;
      const wide = R0.w >= 640;
      const sR = wide ? { x: R0.x, y: R0.y, w: Math.round(R0.w * 0.6) - gap / 2, h: bodyH } : { x: R0.x, y: R0.y, w: R0.w, h: Math.round(bodyH * 0.55) };
      const pR = wide ? { x: R0.x + sR.w + gap, y: R0.y, w: R0.w - sR.w - gap, h: bodyH } : { x: R0.x, y: R0.y + sR.h + gap, w: R0.w, h: bodyH - sR.h - gap };
      const wf = waveform(r, view.ctl, { n: sc.quality === 'niedrig' ? 160 : 360 });
      if (wf) sc.view('scope', sR, wf, {});
      const ph = phasors(r, view.ctl);
      if (ph.ok) {
        const arc = r.two && Math.abs(r.dphi) > 1e-9 ? { a: 'U_2', b: 'U_1', label: 'φ = ' + fmt(r.dphi, 1) + '°' } : null;
        const data = { list: ph.list, unit: 'V', bezug: 'spannung', rotate: !frozen, project: true };
        if (arc) data.arc = arc;
        sc.view('phasor', pR, data, {});
      } else {
        sc.gfx.panel(ctx, pR.x, pR.y, pR.w, pR.h, pal.panel, pal.line, 6);
        sc.gfx.text(ctx, ph.why || '', pR.x + 10, pR.y + 24, { size: 12, color: pal.mute, max: pR.w - 20 });
      }
      let y = R0.y + bodyH + gap;
      if (hintH) { sc.gfx.text(ctx, CORE.TEXTS.effHinweis, R0.x + 2, y + 12, { size: 11, color: pal.mute, max: R0.w - 4 }); y += hintH; }
      if (chipsH) {
        const items = [['U', val(r.v.rms, 'V')], ['U_ss', val(r.v.pp, 'V')], ['Gleichrichtwert', val(r.v.rect, 'V')], ['T', engF(r.T, 's')], ['Δt', engF(Math.abs(r.dtSigned) / 1000, 's')]];
        const cw = (R0.w - gap * (items.length - 1)) / items.length;
        items.forEach((it, k) => sc.gfx.chip(ctx, it[0], it[1], R0.x + k * (cw + gap), y, cw, chipsH - 2, pal, { size: 12 }));
      }
    }
    return {
      compute, meters, assess, diag, curves, waveform, phasors, state, draw,
      phaseHz: () => (frozen ? 0 : 0.15),
      fire() { frozen = !frozen; if (!frozen) P0.say('Der Zeiger läuft wieder.', 'info'); return true; },
      reset() { frozen = false; }
    };
  }

  R.register({ id: 'sinus', name: 'Sinus, Effektivwert und Phase', icon: '〰️', info: INFO, controls: CONTROLS, meters: METERS, presets: PRESETS,
    create(opts) { return B.makeRig({ id: 'sinus', name: 'Sinus, Effektivwert und Phase', icon: '〰️', info: INFO, world: { w: 960, h: 600 }, sicht: SICHT, controls: CONTROLS, meters: METERS, presets: PRESETS,
      zielKeys: ['ziel'], params: {}, plant }, opts); } });
})(typeof window !== 'undefined' ? window : globalThis);
