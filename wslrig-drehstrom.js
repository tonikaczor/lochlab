/* wslrig-drehstrom.js - WSL-Lab (WP2d): Pruefstand 8 `drehstrom` - Drehstrom kurz (SPEC 5.8, F7).
 * Die gemeinsame Huelle liegt in wslrig-base.js: Diese Datei im Browser NACH wslrig-base.js laden (in Node holt sie sich die Basis per require).
 * Gerechnet wird NUR im Kern (WSL_CORE.three.star / delta / power / phases, WSL_CORE.cx); hier steht keine zweite Formel.
 * PFLICHTHINWEIS (SPEC 4.8, 9.4, F7): gerechnet wird nur eine SYMMETRISCHE Last; unsymmetrische Last, Sternpunktstrom und Anlauf sind nur Begriffe
 *   (WSL_CORE.TEXTS.dreiOhne). Das Netz 230/400 V ist ein Uebungswert (limits u_aussen, F7). Der Stern-Dreieck-Wechsel ist ein reiner Rechenvergleich (Leistung x3), kein Anlaufmodell.
 * Steuerwerte: ul (V, Aussenleiterspannung), schaltung (stern, dreieck), rstr (Ohm, Strangwiderstand), cosphi, ansicht (zeit, zeiger), ziel (W, Vorgabe Wirkleistung, 0 = keine Vorgabe),
 *   Taste fire (Stern/Dreieck umschalten als Rechenvergleich).
 * Messgeraete: ustr, istr, il, p, q, s, summe (Summe der drei Leiterstroeme, aus dem Kern gerechnet; bei symmetrischer Last 0). Wirft nie.
 */
(function (root) {
  'use strict';
  const R = root.WSL_RIGS = root.WSL_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };
  if (typeof module !== 'undefined') module.exports = R;
  if (!R.base && typeof require === 'function') { try { require('./wslrig-base.js'); } catch (e) { /* Basis fehlt */ } }
  const B = R.base;
  if (!B) { if (typeof console !== 'undefined') console.warn('wslrig-drehstrom.js: Die Basis wslrig-base.js fehlt (bitte davor laden).'); return; }
  const { clamp, num, fm, isNum, eng, val } = B;

  let C0 = null; try { C0 = B.core(); } catch (e) { C0 = null; }
  const T0 = (C0 && C0.TEXTS) || {};
  const K = fn => { try { return C0 ? fn(C0) : ''; } catch (e) { return ''; } };
  const PFLICHT = T0.dreiOhne || 'Gerechnet wird nur eine symmetrische Last; unsymmetrische Last, Sternpunktstrom und Anlauf sind hier nur Begriffe.';
  const UL0 = K(c => c.limit('u_aussen').value) || 400;
  const UL_TXT = K(c => 'Außenleiterspannung ' + c.limitText('u_aussen') + '.');
  const NOTE = PFLICHT + (UL_TXT ? ' ' + UL_TXT : '') + ' Stern und Dreieck sind nur ein Rechenvergleich.';
  const Z_REF = K(c => c.three.star({ ul: UL0, il: 10 }).zstr) || 23.094;       // Referenz 400 V, 10 A (Stern)
  const Z_DEL = K(c => c.three.delta({ ul: UL0, il: 10 }).zstr) || 69.282;      // Dreieck mit demselben Leiterstrom 10 A
  const wopt = arr => arr.map(a => ({ value: a[0], label: a[1] }));
  const AM = x => (Math.abs(x) >= 1 ? fm(x, 2) : fm(x, 3)) + ' A';
  const STEP_N = 48;                                       // Stuetzstellen je Periode fuer Zeitbild und Summenpruefung

  const CONTROLS = B.fillControls([
    { key: 'ul', label: 'Außenleiterspannung U_L', type: 'slider', scale: 'lin', min: 100, max: 500, step: 1, unit: 'V', unitKind: 'volt', value: UL0, gruppe: 'quelle', sicht: 'zeiger',
      help: 'Spannung zwischen zwei Außenleitern. 230/400 V ist ein Übungswert (F7). ' + 'Die Simulation ist kein Aufbau an Netzspannung.' },
    { key: 'schaltung', label: 'Schaltung', type: 'select', value: 'stern', options: wopt([['stern', 'Stern'], ['dreieck', 'Dreieck']]), gruppe: 'last', sicht: 'formel',
      help: 'Stern: U_L = √3 · U_Str und I_L = I_Str. Dreieck: U_L = U_Str und I_L = √3 · I_Str. Dieselbe Last nimmt im Dreieck die dreifache Leistung auf (Rechenvergleich, kein Anlaufmodell). ' + PFLICHT },
    { key: 'rstr', label: 'Strangwiderstand', type: 'slider', scale: 'log', min: 1, max: 1000, step: 0.001, unit: 'Ω', unitKind: 'res', value: Z_REF, gruppe: 'last', sicht: 'formel',
      help: 'Widerstand eines Strangs der symmetrischen Last (alle drei Stränge gleich). Übungswert. ' + PFLICHT },
    { key: 'cosphi', label: 'Leistungsfaktor cos φ', type: 'slider', scale: 'lin', min: 0.1, max: 1, step: 0.01, unit: '', unitKind: 'num', value: 0.8, gruppe: 'last', sicht: 'formel',
      help: 'Leistungsfaktor der symmetrischen Last. Er bestimmt, wie viel der Scheinleistung als Wirkleistung P ankommt; der Rest ist Blindleistung Q.' },
    { key: 'ansicht', label: 'Ansicht', type: 'select', value: 'zeit', options: wopt([['zeit', 'Zeit: drei Sinuskurven'], ['zeiger', 'Zeiger: drei Zeiger im Abstand von 120°']]), gruppe: 'ziel', sicht: 'zeit',
      help: 'Zeigt entweder die drei Sinuskurven mit ihrer Summe oder die drei Zeiger im Abstand von 120°. Es ist dieselbe Rechnung.' },
    { key: 'ziel', label: 'Vorgabe Wirkleistung P', type: 'slider', scale: 'lin', min: 0, max: 100000, step: 1, unit: 'W', unitKind: 'watt', value: 0, gruppe: 'ziel', sicht: null,
      help: 'Vorgabe für die Wirkleistung P der Last. Bei 0 W ist keine Vorgabe gesetzt und die Ampel bleibt grau. Die Ampelfenster sind Lehrfaustwerte.' },
    { key: 'fire', label: 'Stern ↔ Dreieck', type: 'button', gruppe: 'ziel', sicht: 'formel',
      help: 'Schaltet dieselbe Last von Stern auf Dreieck um (und zurück) und nennt den Rechenvergleich: Die Leistung steigt auf das Dreifache. Das ist nur eine Rechnung, kein Anlaufmodell.' }
  ]);
  const METERS = [
    { key: 'ustr', label: 'Strangspannung U_Str', unit: 'V', digits: 2, min: 0, max: 600, help: 'Spannung an einem Strang der Last. Stern: U_L / √3, Dreieck: U_L.' },
    { key: 'istr', label: 'Strangstrom I_Str', unit: 'A', digits: 3, min: 0, max: 200, help: 'Strom durch einen Strang der Last.' },
    { key: 'il', label: 'Leiterstrom I_L', unit: 'A', digits: 3, min: 0, max: 300, help: 'Strom in einem Außenleiter. Stern: I_Str, Dreieck: √3 · I_Str.' },
    { key: 'p', label: 'Wirkleistung P', unit: 'W', digits: 1, min: 0, max: 100000, help: 'P = √3 · U_L · I_L · cos φ.' },
    { key: 'q', label: 'Blindleistung Q', unit: 'var', digits: 1, min: 0, max: 100000, zeroIsNone: true, help: 'Q = √3 · U_L · I_L · sin φ.' },
    { key: 's', label: 'Scheinleistung S', unit: 'VA', digits: 1, min: 0, max: 100000, help: 'S = √3 · U_L · I_L.' },
    { key: 'summe', label: 'Summe der Leiterströme', unit: 'A', digits: 3, min: 0, max: 1, zeroIsNone: true, help: 'Größter Betrag der Summe der drei Leiterströme über eine Periode. Bei symmetrischer Last ist sie null; unsymmetrische Last und Sternpunktstrom sind hier nur Begriffe.' }
  ];
  const PRESETS = [
    { id: 'stern-400', name: 'Stern 400 V', info: 'Übungsschaltung: ' + K(c => { const q = c.three.star({ ul: UL0, il: 10, cosphi: 0.8 }); return 'In Stern liegt an jedem Strang U_Str = ' + val(q.ustr, 'V', 2) + '; bei I_L = 10 A ist S = ' + val(q.s, 'VA', 1) + '.'; }),
      controls: { ul: UL0, schaltung: 'stern', rstr: Z_REF, cosphi: 0.8, ansicht: 'zeit' } },
    { id: 'dreieck-400', name: 'Dreieck 400 V', info: 'Übungsschaltung: ' + K(c => { const q = c.three.delta({ ul: UL0, il: 10, cosphi: 0.8 }); return 'Im Dreieck liegt an jedem Strang U_Str = U_L = ' + val(q.ustr, 'V', 0) + '; bei I_L = 10 A ist I_Str = ' + val(q.istr, 'A', 2) + '.'; }),
      controls: { ul: UL0, schaltung: 'dreieck', rstr: Z_DEL, cosphi: 0.8, ansicht: 'zeiger' } },
    { id: 'sternpunkt', name: 'Summe null', info: 'Übungsschaltung: Die drei Spannungen und bei symmetrischer Last auch die drei Ströme addieren sich zu null; der Sternpunktstrom ist hier nur ein Begriff.',
      controls: { ul: UL0, schaltung: 'stern', rstr: Z_REF, cosphi: 1, ansicht: 'zeit' } },
    { id: 'leistung', name: 'Leistung', info: 'Übungsschaltung: ' + K(c => { const q = c.three.star({ ul: UL0, il: 10, cosphi: 0.8 }); return UL0 + ' V, 10 A und cos φ = 0,8 ergeben S = ' + val(q.s, 'VA', 1) + ', P = ' + val(q.p, 'W', 1) + ' und Q = ' + val(q.q, 'var', 1) + '.'; }),
      controls: { ul: UL0, schaltung: 'stern', rstr: Z_REF, cosphi: 0.8, ansicht: 'zeiger' } }
  ];
  const SICHT = { zeit: 'Drei Sinuskurven, Summe null', zeiger: 'Drei Zeiger im Abstand von 120°', formel: 'U_L = √3 · U_Str, P = √3 · U_L · I_L · cos φ' };
  const INFO = 'Drehstrom kurz: drei um 120° versetzte Spannungen, Stern und Dreieck, Leistung. ' + NOTE;

  function plant(P0) {
    const CORE = P0.CORE;
    const fmt = (x, d) => { try { return CORE.fmt(x, d); } catch (e) { return fm(x, d); } };
    const fNetz = K(c => c.limit('f_netz').value) || 50;
    const grid = n => { const t = [], T = 1 / fNetz; for (let k = 0; k < n; k++) t.push(T * k / n); return t; };

    function compute(ctl) {
      const cfg = { ul: ctl.ul, rstr: ctl.rstr, cosphi: ctl.cosphi };
      const s = ctl.schaltung === 'dreieck' ? CORE.three.delta(cfg) : CORE.three.star(cfg);
      if (!s || s.ok === false || s.valid === false) return { ok: false, why: (s && (s.why || s.text)) || CORE.TEXTS.eingabe };
      const cmp = CORE.three.power(cfg);
      // Summe der Leiterstroeme: drei um 120 Grad versetzte Sinusstroeme gleicher Groesse (Kern phases mit Effektivwert I_L), ueber eine Periode
      const ph = CORE.three.phases({ ustr: s.il, f: fNetz }, grid(STEP_N));
      let sum = 0;
      if (ph && ph.ok !== false && Array.isArray(ph.sum)) ph.sum.forEach(v => { if (isNum(v) && Math.abs(v) > sum) sum = Math.abs(v); });
      if (sum < 1e-9 * Math.max(s.il, 1e-12)) sum = 0;                  // Rundungsrauschen der Gleitkommarechnung
      return { ok: true, s, cmp: cmp && cmp.ok !== false ? cmp : null, summe: sum, cfg };
    }
    function meters(r) {
      if (!r.ok) return { ustr: 0, istr: 0, il: 0, p: 0, q: 0, s: 0, summe: 0 };
      const s = r.s;
      return { ustr: s.ustr, istr: s.istr, il: s.il, p: s.p, q: s.q, s: s.s, summe: r.summe };
    }
    function assess(r, ctl) {
      if (!r.ok) return { ok: false, ampel: 'rot', text: r.why };
      const soll = ctl.ziel, ist = r.s.p, pct = Math.abs(ist - soll) / soll * 100;
      const amp = B.devAmpel(pct, CORE);
      let text = B.devText('Wirkleistung', ist, soll, 'W', pct, CORE);
      if (amp === 'gruen') text += ' Die Vorgabe ist erreicht.';
      else text += ist < soll ? ' Die Wirkleistung ist zu klein.' : ' Die Wirkleistung ist zu groß.';
      return { ok: amp === 'gruen', ampel: amp, text, margin: pct, ziel: { text: 'Wirkleistung ' + val(soll, 'W'), soll, ist, unit: 'W' } };
    }
    function diag(r, ctl) {
      const out = [];
      if (!r.ok) { out.push({ id: 'ungueltig', kind: 'error', text: r.why }); return out; }
      const s = r.s;
      if (r.cmp && r.cmp.dreieck && r.cmp.stern) out.push({ id: 'vergleich', kind: 'info', text: 'Rechenvergleich bei derselben Last: Stern P = ' + val(r.cmp.stern.p, 'W') + ', Dreieck P = ' + val(r.cmp.dreieck.p, 'W') + ', also das ' + fmt(r.cmp.faktor, 2) + '-fache. Das ist nur eine Rechnung, kein Anlaufmodell.' });
      if (s.reinBlind) out.push({ id: 'reinblind', kind: 'info', text: 'Bei cos φ = 0 ist die Last rein blind: P = 0 W, die Leistung pendelt nur.' });
      return out;
    }
    function waveform(r, ctl, o) {
      if (!r.ok) return null;
      o = o || {};
      const n = clamp(Math.floor(num(o.n, 240)), 24, 4000), per = clamp(Math.floor(num(o.periods, 2)), 1, 20), T = 1 / fNetz, ts = [];
      for (let k = 0; k < n; k++) ts.push(per * T * k / (n - 1));
      const ph = CORE.three.phases({ ustr: r.s.ustr, f: fNetz }, ts);
      if (!ph || ph.ok === false) return null;
      return { tUnit: 'ms', t: ts.map(x => x * 1000), series: [{ name: 'u_L1', unit: 'V', kind: 'l1', y: ph.u1 }, { name: 'u_L2', unit: 'V', kind: 'l2', y: ph.u2 }, { name: 'u_L3', unit: 'V', kind: 'l3', y: ph.u3 }, { name: 'Summe', unit: 'V', kind: 'ref', y: ph.sum }],
        periods: per, T };
    }
    function phasors(r) {
      if (!r.ok) return { ok: false, why: r.why };
      const U = r.s.ustr, deg = 180 / Math.PI, cx = CORE.cx;
      const a = cx.fromPolar(U, 0), b = cx.fromPolar(U, -2 * Math.PI / 3), d = cx.sub(a, b);
      const list = [{ name: 'U_L1', len: U, angle: 0, kind: 'l1' }, { name: 'U_L2', len: U, angle: -120, kind: 'l2' }, { name: 'U_L3', len: U, angle: -240, kind: 'l3' },
        { name: 'U_L12', len: cx.abs(d), angle: cx.arg(d) * deg, kind: 'ref' }];
      return { ok: true, art: 'drehstrom', bezug: 'spannung', effektiv: true, unit: 'V', list };
    }
    function state(r, ctl) {
      const base = { schaltung: ctl.schaltung, hinweis: PFLICHT, note: NOTE };
      if (!r.ok) return Object.assign(base, { valid: false, why: r.why, text: r.why });
      const s = r.s;
      const o = Object.assign(base, { valid: true, text: s.text, ul: s.ul, ustr: s.ustr, istr: s.istr, il: s.il, p: s.p, q: s.q, s_va: s.s, summe: r.summe, zstr: s.zstr || ctl.rstr });
      if (r.cmp && r.cmp.stern && r.cmp.dreieck) Object.assign(o, { pStern: r.cmp.stern.p, pDreieck: r.cmp.dreieck.p, faktor: r.cmp.faktor });
      return o;
    }
    function wrapLines(ctx, g, s, w, size, maxLines) {
      ctx.font = g.font(size, false);
      const words = String(s).split(' '), lines = []; let cur = '';
      words.forEach(wd => {
        const t = cur ? cur + ' ' + wd : wd;
        if (!cur || ctx.measureText(t).width <= w) cur = t; else { lines.push(cur); cur = wd; }
      });
      if (cur) lines.push(cur);
      return lines.slice(0, maxLines);
    }
    function draw(ctx, w, h, t, view, sc) {
      const r = view.res, pal = sc.pal, R0 = sc.rect, gap = 8, g = sc.gfx;
      if (!r || !r.ok) {
        wrapLines(ctx, g, (r && r.why) || '', R0.w - 16, 13, 6).forEach((l, k) => g.text(ctx, l, R0.x + 8, R0.y + 20 + k * 18, { size: 13, color: pal.fg, max: R0.w - 16 }));
        return;
      }
      const ctl = view.ctl, s = r.s, wide = R0.w >= 680, fs = 11, lh = 15;
      const noteLines = wrapLines(ctx, g, NOTE, R0.w - 8, fs, 4), noteH = noteLines.length * lh + 6;
      const chipsH = R0.h >= 360 ? 30 : 0, bodyH = R0.h - chipsH - noteH - gap * 2;
      if (bodyH < 120) { noteLines.forEach((l, k) => g.text(ctx, l, R0.x + 4, R0.y + 14 + k * lh, { size: fs, color: pal.mute, max: R0.w - 8 })); return; }
      let sR, tR, dR;
      if (wide) {
        const lw = Math.round(R0.w * 0.42) - gap / 2, rw = R0.w - lw - gap, h1 = Math.round(bodyH * 0.5);
        sR = { x: R0.x, y: R0.y, w: lw, h: h1 }; tR = { x: R0.x, y: R0.y + h1 + gap, w: lw, h: bodyH - h1 - gap }; dR = { x: R0.x + lw + gap, y: R0.y, w: rw, h: bodyH };
      } else {
        const hs = [0.4, 0.26, 0.34].map(q => Math.round(bodyH * q) - gap);
        let y = R0.y;
        dR = { x: R0.x, y, w: R0.w, h: hs[0] }; y += hs[0] + gap; sR = { x: R0.x, y, w: R0.w, h: hs[1] }; y += hs[1] + gap; tR = { x: R0.x, y, w: R0.w, h: hs[2] };
      }
      sc.view('schematic', sR, { kind: ctl.schaltung === 'dreieck' ? 'dreieck' : 'stern', labels: { z: 'R = ' + eng(ctl.rstr, 'Ω') } }, {});
      if (!sc.view('threePhase', dR, { ustr: s.ustr, mode: ctl.ansicht === 'zeiger' ? 'zeiger' : 'zeit', rotate: true }, {})) {
        g.panel(ctx, dR.x, dR.y, dR.w, dR.h, pal.panel, pal.line, 6);
        g.text(ctx, 'U_Str = ' + val(s.ustr, 'V', 2) + ', U_L = ' + val(s.ul, 'V', 1), dR.x + 10, dR.y + 22, { size: 12, color: pal.fg, max: dR.w - 20 });
      }
      sc.view('triangle', tR, { kind: 'leistung', a: s.p, b: s.q }, {});
      if (chipsH) {
        const y = R0.y + bodyH + gap;
        const items = [['U_Str', val(s.ustr, 'V', 1)], ['I_L', val(s.il, 'A', 2)], ['P', val(s.p, 'W', 0)], ['S', val(s.s, 'VA', 0)]];
        const cw = (R0.w - gap * (items.length - 1)) / items.length;
        items.forEach((it, k) => g.chip(ctx, it[0], it[1], R0.x + k * (cw + gap), y, cw, chipsH - 2, pal, { size: 12 }));
      }
      const ny = R0.y + R0.h - noteH + 12;
      noteLines.forEach((l, k) => g.text(ctx, l, R0.x + 4, ny + k * lh, { size: fs, color: pal.mute, max: R0.w - 8 }));
    }
    return {
      compute, meters, assess, diag, waveform, phasors, state, draw,
      curves: () => [],
      phaseHz: () => 0.15,
      fire(r, ctl) {
        if (!r.ok) { P0.say('Der Vergleich ist nicht möglich: ' + r.why, 'warn'); return false; }
        const toDelta = ctl.schaltung !== 'dreieck', c = r.cmp;
        P0.setCtl('schaltung', toDelta ? 'dreieck' : 'stern');
        if (c && c.stern && c.dreieck) P0.say((toDelta ? 'Von Stern auf Dreieck umgeschaltet' : 'Zurück auf Stern') + ' (Rechenvergleich): Stern P = ' + val(c.stern.p, 'W') + ', Dreieck P = ' + val(c.dreieck.p, 'W') + ', Faktor ' + fmt(c.faktor, 2) + '. Das ist nur eine Rechnung, kein Anlaufmodell.', 'info');
        return true;
      }
    };
  }

  R.register({ id: 'drehstrom', name: 'Drehstrom kurz', icon: '🔺', info: INFO, controls: CONTROLS, meters: METERS, presets: PRESETS,
    create(opts) { return B.makeRig({ id: 'drehstrom', name: 'Drehstrom kurz', icon: '🔺', info: INFO, world: { w: 960, h: 640 }, sicht: SICHT, controls: CONTROLS, meters: METERS, presets: PRESETS,
      zielKeys: ['ziel'], params: {}, plant }, opts); } });
})(typeof window !== 'undefined' ? window : globalThis);
