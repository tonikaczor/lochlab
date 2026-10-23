/* ntsrig-trafo.js - Netzteil-Lab (WP2a): Pruefstand 1 `trafo` - Transformator (SPEC 5.1).
 * Die gemeinsame Huelle (Steuerwerte, Cache, Ampel, Vorher/Nachher, Zeichenhuelle) liegt in ntsrig-base.js: Diese Datei im Browser NACH ntsrig-base.js laden
 * (in Node holt sie sich die Basis per require). Gerechnet wird NUR im Kern (NTS_CORE.trafo.load / dc / ratio); hier steht keine zweite Formel.
 * Die Netzspannung 230 V steht nur als Zahl (limits u_netz, belegt); die Sekundaerseite bleibt mit Kleinspannung im Modell (N1 >= 600, N2 <= 100).
 * Alle Widerstaende sind Uebungswerte (F1), die Ampelgrenzen Lehrgrenzen (F2). Eisenverluste und Saettigung sind NICHT modelliert, der Strom an
 * Gleichrichterlast wird wie bei Widerstandslast als Effektivwert gerechnet (ABWEICHUNGEN Punkt 4 des Kerns). Simulation, kein Hinweis fuer Arbeiten an Netzspannung.
 * Steuerwerte: n1, n2 (Windungen), ri (Ohm, Sekundaer, Uebung), gleichspannung (Lehrfehler), iLast (A), last (Widerstand/Gleichrichter), Taste fire (Einschalten).
 * Messgeraete: u2 (V), i1 (mA), i2 (A), pv (W), eta (%), einbruch (%). Wirft nie.
 */
(function (root) {
  'use strict';
  const R = root.NTS_RIGS = root.NTS_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id] ? this.defs[id].create(opts || {}) : null; } };
  if (typeof module !== 'undefined') module.exports = R;
  if (!R.base && typeof require === 'function') { try { require('./ntsrig-base.js'); } catch (e) { /* Basis fehlt */ } }
  const B = R.base;
  if (!B) { if (typeof console !== 'undefined') console.warn('ntsrig-trafo.js: Die Basis ntsrig-base.js fehlt (bitte davor laden).'); return; }
  const { clamp, isNum, fm, eng } = B;

  const G_E = 'Eingang und Transformator', G_L = 'Last und Anzeige';
  const opt = arr => arr.map(a => ({ value: a[0], label: a[1] }));
  const CONTROLS = [
    { key: 'n1', label: 'Windungen primär N1', type: 'slider', scale: 'lin', min: 600, max: 2300, step: 1, unit: '', unitKind: 'count', value: 1150, stufe: 'trafo', group: G_E,
      help: 'Windungszahl der Primärwicklung. Mehr Primärwindungen bei gleicher Sekundärwicklung ergeben eine kleinere Sekundärspannung: U2 = U1 · N2 / N1. Vorgabe 1150 wie in der Pool-Aufgabe.' },
    { key: 'n2', label: 'Windungen sekundär N2', type: 'slider', scale: 'lin', min: 10, max: 100, step: 1, unit: '', unitKind: 'count', value: 69, stufe: 'trafo', group: G_E,
      help: 'Windungszahl der Sekundärwicklung. Mehr Sekundärwindungen ergeben eine größere Sekundärspannung. Vorgabe 69 gibt bei 1150 Primärwindungen 13,8 V im Leerlauf. Der Bereich bleibt im Modell bei Kleinspannung.' },
    { key: 'ri', label: 'Innenwiderstand sekundär R_i (Übungswert)', type: 'slider', scale: 'lin', min: 0, max: 2, step: 0.05, unit: 'Ω', unitKind: 'res', value: 0.4, stufe: 'trafo', group: G_E,
      help: 'Ohmscher Widerstand der Wicklungen, auf die Sekundärseite bezogen. Übungswert (Ausbilder gleicht ab). Ein größerer Innenwiderstand lässt die Klemmenspannung unter Last stärker einbrechen und erhöht die Verlustleistung.' },
    { key: 'gleichspannung', label: 'Gleichspannung statt Wechselspannung (Lehrfehler)', type: 'switch', value: false, stufe: 'trafo', group: G_E,
      help: 'Lehrfehler: Gleichspannung am Primäranschluss. Es entsteht keine Gegeninduktion, nur der Wicklungswiderstand (Übungswert) begrenzt den Strom, die Wicklung wird zerstört. Sekundär entsteht keine Spannung.' },
    { key: 'iLast', label: 'Laststrom I2', type: 'slider', scale: 'lin', min: 0, max: 5, step: 0.05, unit: 'A', unitKind: 'amp', value: 2.5, stufe: 'last', group: G_L,
      help: 'Strom, den die Last aus der Sekundärwicklung zieht (Effektivwert). Mehr Laststrom erhöht den Primärstrom im Verhältnis der Windungszahlen und lässt die Klemmenspannung sinken. Vorgabe 2,5 A wie in der Pool-Aufgabe.' },
    { key: 'last', label: 'Lastart', type: 'select', value: 'R', options: opt([['R', 'Widerstand'], ['diode', 'Gleichrichter']]), stufe: null, group: G_L,
      help: 'Art der Last. Das Modell rechnet in beiden Fällen mit dem Effektivwert des Laststroms: Die Stromimpulse an einer Gleichrichterlast ändern die Zahlen nicht. Die Wahl wird nur angezeigt.' },
    { key: 'fire', label: 'Einschalten', type: 'button', stufe: null, group: G_L, help: 'Schaltet den Transformator im Modell ein und meldet die Sekundärspannung. Das ist nur eine Simulation.' }
  ];
  const lv = id => { try { return B.lim(B.core(), id); } catch (e) { return NaN; } };
  const METERS = [
    { key: 'u2', label: 'Klemmenspannung U2', unit: 'V', digits: 2, min: 0, max: 40, help: 'Spannung an den Sekundärklemmen unter Last: Leerlaufspannung minus Spannungsabfall am Innenwiderstand.' },
    { key: 'i1', label: 'Primärstrom I1', unit: 'mA', digits: 1, min: 0, max: 400, help: 'Strom in der Primärwicklung: I1 = I2 · N2 / N1. Bei Gleichspannung zeigt das Gerät den Strom durch den Wicklungswiderstand.' },
    { key: 'i2', label: 'Sekundärstrom I2', unit: 'A', digits: 2, min: 0, max: 5, help: 'Laststrom auf der Sekundärseite.' },
    { key: 'pv', label: 'Verlustleistung P_V', unit: 'W', digits: 2, min: 0, max: 60, help: 'Verlust in den Wicklungen (I² · R). Eisenverluste sind nicht modelliert.' },
    { key: 'eta', label: 'Wirkungsgrad η', unit: '%', digits: 1, min: 0, max: 100, help: 'Abgegebene Leistung durch zugeführte Leistung, aus den Wicklungsverlusten gerechnet.' },
    { key: 'einbruch', label: 'Spannungseinbruch', unit: '%', digits: 1, min: 0, max: 100, warnAbove: lv('trafo_gelb'), help: 'Einbruch der Klemmenspannung gegen die Leerlaufspannung. Lehrgrenzen der Ampel: grün bis 5 %, rot über 10 % (Übungswerte).' }
  ];
  const PRESETS = [
    { id: 'uebersetzung', name: 'Übersetzung, Leerlauf', info: 'N1 1150, N2 69, ohne Last: die Leerlaufspannung folgt allein aus den Windungen.', params: { n1: 1150, n2: 69, ri: 0.4, iLast: 0, gleichspannung: false, last: 'R' } },
    { id: 'belastet', name: 'Belastet mit 2,5 A', info: 'Wie die Pool-Aufgabe: 1150 zu 69 Windungen, 2,5 A Last, Primärstrom und Einbruch aus der Rechnung.', params: { n1: 1150, n2: 69, ri: 0.4, iLast: 2.5, gleichspannung: false, last: 'R' } },
    { id: 'gleichstrom', name: 'Gleichspannung (Lehrfehler)', info: 'Gleichspannung am Primäranschluss: keine Spannung sekundär, die Wicklung wird zerstört.', params: { n1: 1150, n2: 69, ri: 0.4, iLast: 2.5, gleichspannung: true, last: 'R' } }
  ];
  const PFAD = { quelle: 'Netz 230 V, nur als Zahl im Modell (keine Messung, kein Aufbau)', wandlung: 'Transformator: Spannung und Strom nach dem Windungsverhältnis, dazu ohmsche Wicklungsverluste', senke: 'Last an der Sekundärwicklung, Widerstand oder Gleichrichter, Kleinspannung', art: 'passiv' };

  function plant(P0) {
    const CORE = P0.CORE;
    const t1 = lim => B.lim(CORE, lim);

    function compute(ctl) {
      const u1 = t1('u_netz'), f = t1('f_netz');
      const rat = CORE.trafo.ratio({ U1: u1, n1: ctl.n1, n2: ctl.n2, iLast: ctl.iLast });
      if (!rat || !rat.ok) return { ok: false, error: rat && rat.why || 'Eingabe', u1 };
      const gelb = t1('trafo_gelb'), rot = t1('trafo_rot');
      if (ctl.gleichspannung) {
        const dc = CORE.trafo.dc({ U: u1, Rw: t1('ri1_trafo') });
        if (!dc || !dc.ok) return { ok: false, error: dc && dc.why || 'Eingabe', u1 };
        return { ok: true, dcMode: true, u1, f, rat, dc, gelb, rot, uleer: rat.U2_leer, valid: true };
      }
      const ld = CORE.trafo.load({ U1: u1, n1: ctl.n1, n2: ctl.n2, ri: ctl.ri, iLast: ctl.iLast, last: ctl.last, gleich: ctl.last === 'diode' });
      if (!ld || !ld.ok) return { ok: false, error: ld && ld.why || 'Eingabe', u1 };
      return { ok: true, dcMode: false, u1, f, rat, ld, gelb, rot, uleer: ld.U2_leer, valid: ld.valid, einbruchProz: ld.einbruch * 100 };
    }
    function meters(r) {
      if (!r.ok) return {};
      if (r.dcMode) return { u2: 0, i1: r.dc.I * 1000, i2: 0, pv: r.dc.P, eta: 0, einbruch: 0 };
      const l = r.ld;
      return { u2: Math.max(0, l.U2_klemme), i1: l.I1 * 1000, i2: l.I2, pv: l.Pv, eta: isNum(l.eta) ? l.eta * 100 : 0, einbruch: isNum(r.einbruchProz) ? clamp(r.einbruchProz, 0, 999) : 0 };
    }
    function bilanz(r) {
      if (!r.ok) return null;
      if (r.dcMode) return { pzu: r.dc.P, pab: 0, pv: [{ stufe: 'trafo', w: r.dc.P }], eta: 0 };
      return { pzu: r.ld.Pzu, pab: r.ld.Pab, pv: [{ stufe: 'trafo', w: r.ld.Pv }], eta: isNum(r.ld.eta) ? r.ld.eta : 0 };
    }
    /* Ampel nach SPEC 4.10: gruen Einbruch <= trafo_gelb, gelb bis trafo_rot, rot darueber oder Gleichspannung. Vergleich in Prozent, Grenzen exakt (Toleranz 1e-9). */
    function assess(r) {
      if (!r.ok) return { ok: false, ampel: 'grau', text: 'Die Anlage ist mit diesen Werten nicht rechenbar.' };
      if (r.dcMode) return { ok: false, ampel: 'rot', text: 'Gleichspannung am Transformator: Die Wicklung wird zerstört, sekundär entsteht keine Spannung.' };
      if (!r.valid) return { ok: false, ampel: 'rot', text: 'Überlast: Die Klemmenspannung ist unter null gerechnet, der Strom ist für diesen Innenwiderstand zu groß.' };
      const e = r.einbruchProz, g = r.gelb, ro = r.rot, st = B.stat(CORE, 'trafo_gelb') ? ' (Lehrgrenzen, Übungswerte)' : '';
      const txt = 'Einbruch ' + fm(e, 1) + ' % der Leerlaufspannung' + ' (grün bis ' + fm(g, 0) + ' %, rot über ' + fm(ro, 0) + ' %' + ')' + st + '.';
      if (e <= g + 1e-9) return { ok: true, ampel: 'gruen', text: txt, margin: e > 0 ? g / e : undefined };
      if (e <= ro + 1e-9) return { ok: false, ampel: 'gelb', text: txt, margin: ro / e };
      return { ok: false, ampel: 'rot', text: txt, margin: ro / e };
    }
    function diag(r) {
      const out = [];
      if (!r.ok) return out;
      out.push({ id: 'trafo-modell', kind: 'info', text: 'Das Modell rechnet mit Wicklungsverlusten. Eisenverluste und Sättigung des Kerns sind nicht modelliert.' });
      if (r.dcMode) {
        out.push({ id: 'trafo-dc', kind: 'error', text: B.msg(CORE, 'trafo-dc', { I: eng(r.dc.I, 'A') }, 'Gleichspannung am Transformator: Es entsteht keine Gegeninduktion, nur der Wicklungswiderstand begrenzt den Strom ({I}). Die Wicklung wird zerstört.') });
        return out;
      }
      if (!r.valid) out.push({ id: 'trafo-ueberlast', kind: 'error', text: B.msg(CORE, 'trafo-ueberlast', {}, 'Überlast: Die Klemmenspannung ist unter null gerechnet.') });
      else if (r.einbruchProz > r.gelb + 1e-9) {
        out.push({ id: 'trafo-einbruch', kind: r.einbruchProz > r.rot + 1e-9 ? 'error' : 'warn', text: B.msg(CORE, 'trafo-einbruch', { e: fm(r.einbruchProz, 1) + ' %', uk: eng(r.ld.U2_klemme, 'V'), ul: eng(r.ld.U2_leer, 'V'), g: fm(r.gelb, 0), r: fm(r.rot, 0) },
          'Die Klemmenspannung bricht um {e} ein ({uk} von {ul}); grün bis {g} %, rot über {r} % (Übungswerte, der Ausbilder gleicht ab).') });
      }
      if (r.ld && r.ld.last === 'diode') out.push({ id: 'trafo-last-diode', kind: 'info', text: 'Gleichrichterlast: Der Strom fließt real in Impulsen. Das Modell rechnet mit dem Effektivwert wie bei Widerstandslast.' });
      return out;
    }
    function curves(r, ctl) {
      if (!r.ok) return [];
      const u1 = r.u1, A = [], E = [];
      for (let k = 0; k <= 50; k++) {
        const I = 5 * k / 50, ld = CORE.trafo.load({ U1: u1, n1: ctl.n1, n2: ctl.n2, ri: ctl.ri, iLast: I });
        if (ld && ld.ok) { if (ld.U2_klemme >= 0) A.push([I, ld.U2_klemme]); if (I > 0 && isNum(ld.eta) && ld.U2_klemme >= 0) E.push([I, ld.eta * 100]); }
      }
      const cur = r.dcMode ? null : r.ld;
      const out = [{ id: 'u2-last', title: 'Klemmenspannung über dem Laststrom', xLabel: 'Laststrom I2', xUnit: 'A', xScale: 'lin', yLabel: 'Klemmenspannung U2', yUnit: 'V',
        series: [{ name: 'U2 unter Last', points: A }], limit: { y: r.uleer * (1 - r.gelb / 100), label: 'Einbruch ' + fm(r.gelb, 0) + ' % (grün darüber)' } },
        { id: 'eta-last', title: 'Wirkungsgrad über dem Laststrom', xLabel: 'Laststrom I2', xUnit: 'A', xScale: 'lin', yLabel: 'Wirkungsgrad η', yUnit: '%', series: [{ name: 'η', points: E }] }];
      if (cur && cur.U2_klemme >= 0) {
        out[0].marker = { x: cur.I2, y: cur.U2_klemme, label: 'jetzt ' + eng(cur.U2_klemme, 'V') };
        if (cur.I2 > 0 && isNum(cur.eta)) out[1].marker = { x: cur.I2, y: cur.eta * 100, label: 'jetzt ' + fm(cur.eta * 100, 1) + ' %' };
      }
      return out;
    }
    function waveform(r) {
      if (!r.ok) return null;
      const n = 200, T = 1 / r.f, t = [], u1 = [], u2 = [], i1 = [], i2 = [];
      const s2 = Math.SQRT2;
      for (let k = 0; k <= n; k++) {
        const tt = 2 * T * k / n, s = Math.sin(2 * Math.PI * r.f * tt);
        t.push(tt * 1000);
        if (r.dcMode) { u1.push(r.u1); u2.push(0); i1.push(r.dc.I); i2.push(0); }
        else { u1.push(s2 * r.u1 * s); u2.push(s2 * Math.max(0, r.ld.U2_klemme) * s); i1.push(s2 * r.ld.I1 * s); i2.push(s2 * r.ld.I2 * s); }
      }
      return { tUnit: 'ms', t, series: [{ name: 'u1', y: u1, unit: 'V' }, { name: 'u2', y: u2, unit: 'V' }, { name: 'i1', y: i1, unit: 'A' }, { name: 'i2', y: i2, unit: 'A' }] };
    }
    function fire(r) {
      if (!r.ok) { P0.say('Einschalten nicht möglich: ' + (r.error || 'Eingabe prüfen') + '.', 'warn'); return false; }
      if (r.dcMode) P0.say('Eingeschaltet an Gleichspannung: Der Strom beträgt ' + eng(r.dc.I, 'A') + ', sekundär entsteht keine Spannung.', 'error');
      else P0.say('Eingeschaltet: Leerlaufspannung ' + eng(r.ld.U2_leer, 'V') + ', unter Last ' + eng(r.ld.U2_klemme, 'V') + ', Primärstrom ' + eng(r.ld.I1, 'A') + '.', 'info');
      return true;
    }
    function draw(ctx, w, h, t, view, sc) {
      const rc = sc.rect, r = view.res, pal = sc.pal;
      if (!rc || rc.w < 140 || rc.h < 100 || !r.ok) return;
      const wide = rc.w >= 560;
      const a = wide ? { x: rc.x, y: rc.y, w: Math.floor(rc.w * 0.5) - 6, h: rc.h } : { x: rc.x, y: rc.y, w: rc.w, h: Math.floor(rc.h * 0.55) - 4 };
      const b = wide ? { x: rc.x + a.w + 12, y: rc.y, w: rc.w - a.w - 12, h: rc.h } : { x: rc.x, y: rc.y + a.h + 8, w: rc.w, h: rc.h - a.h - 8 };
      const d = { n1: view.ctl.n1, n2: view.ctl.n2, u1: r.u1, u2: r.dcMode ? 0 : Math.max(0, r.ld.U2_klemme), i1: r.dcMode ? r.dc.I : r.ld.I1, i2: r.dcMode ? 0 : r.ld.I2, dc: r.dcMode };
      let ok = false;
      if (sc.D && sc.D.trafoCore) ok = !!sc.D.trafoCore(ctx, a, d, { theme: sc.theme, q: sc.quality, reduced: sc.reduced, t: sc.t, bg: false });
      if (!ok) B.gfx.text(ctx, 'N1 ' + view.ctl.n1 + ' : N2 ' + view.ctl.n2 + '  ·  U2 ' + eng(d.u2, 'V'), a.x, a.y + 20, { size: sc.fs, color: pal.fg, max: a.w });
      sc.block(b);
    }
    return { compute, meters, bilanz, assess, diag, curves, waveform, fire, draw, phaseHz: () => 0.5 };
  }

  R.register({ id: 'trafo', name: 'Transformator', icon: '🔄', info: 'Windungsverhältnis, Klemmenspannung unter Last und Verluste; Gleichspannung als Lehrfehler.', controls: CONTROLS, meters: METERS, presets: PRESETS,
    create(opts) { return B.makeRig({ id: 'trafo', name: 'Transformator', icon: '🔄', info: 'Transformator', world: { w: 960, h: 600 }, pfad: PFAD, controls: CONTROLS, meters: METERS, presets: PRESETS, params: {}, plant }, opts); } });
})(typeof window !== 'undefined' ? window : globalThis);
