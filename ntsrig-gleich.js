/* ntsrig-gleich.js - Netzteil-Lab (WP2a): Pruefstand 2 `gleich` - Gleichrichter und Siebung (SPEC 5.2).
 * Die gemeinsame Huelle liegt in ntsrig-base.js: Diese Datei im Browser NACH ntsrig-base.js laden (in Node holt sie sich die Basis per require).
 * Gerechnet wird NUR im Kern (NTS_CORE.rect.peak / ripple / wave / inrush / cmin / rcSieb); hier steht keine zweite Formel (Ohmsches Gesetz am Siebwiderstand und
 * Leistung = Spannung mal Strom in der Bilanz ausgenommen). Der Eingang ist Wechselspannung bis 50 V (limits u_ac_max): Kleinspannung, kein Netz.
 * Brummspannung: Lehrnaeherung dU = I/(f_p*C), gueltig fuer dU <= 0,2*U_hat (limits ripple_naeh); darueber zeigt der Pruefstand die Zeitschritt-Rechnung (rect.wave)
 * und meldet "Näherung versagt". Ampelgrenzen (ripple_ok, reserve) sind Lehrfaustwerte (A, F12), der Uebungsregler 7805 (umin_7805) ist ein Uebungswert (F6).
 * Das RC-Glied (rc_r, rc_c) ist ein Uebungswert (F29), die Eintraege werden hier in NTS_CORE.limits ergaenzt (einzige Quelle bleibt `limits`).
 * Steuerwerte: topo (Einweg/Bruecke), u2 (V eff), diode (Si/Schottky), c (µF, log), rs (Ohm, Vorwiderstand), rsieb (RC-Glied an/aus), iLast (A), Taste fire (Einschalten).
 * Messgeraete: uhat (V), udc (V), dubrumm (V), fp (Hz), iPeak (A), tLeit (ms), imax (A), umin (V), dusieb (mV, 0 = RC-Glied aus). Wirft nie.
 */
(function (root) {
  'use strict';
  const R = root.NTS_RIGS = root.NTS_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id] ? this.defs[id].create(opts || {}) : null; } };
  if (typeof module !== 'undefined') module.exports = R;
  if (!R.base && typeof require === 'function') { try { require('./ntsrig-base.js'); } catch (e) { /* Basis fehlt */ } }
  const B = R.base;
  if (!B) { if (typeof console !== 'undefined') console.warn('ntsrig-gleich.js: Die Basis ntsrig-base.js fehlt (bitte davor laden).'); return; }
  const { clamp, isNum, fm, eng } = B;

  /* Uebungswerte des RC-Glieds in die einzige Quelle `limits` eintragen (einmalig) */
  try {
    const C0 = B.core();
    if (C0 && Array.isArray(C0.limits)) {
      if (!C0.limits.some(l => l.id === 'rc_r')) C0.limits.push({ id: 'rc_r', value: 2.2, unit: 'Ω', cmp: '=', status: 'A', quelle: '—', frage: 'F29', text: 'Widerstand des RC-Glieds am Ausgang des Gleichrichter-Prüfstands.' });
      if (!C0.limits.some(l => l.id === 'rc_c')) C0.limits.push({ id: 'rc_c', value: 1000, unit: 'µF', cmp: '=', status: 'A', quelle: '—', frage: 'F29', text: 'Kondensator des RC-Glieds am Ausgang des Gleichrichter-Prüfstands.' });
    }
  } catch (e) { /* ohne Kern keine Grenzwerte */ }

  const G_E = 'Eingang und Transformator', G_G = 'Gleichrichtung und Siebung', G_L = 'Last und Anzeige';
  const opt = arr => arr.map(a => ({ value: a[0], label: a[1] }));
  const CONTROLS = [
    { key: 'u2', label: 'Sekundärspannung U2 (Effektivwert)', type: 'slider', scale: 'lin', min: 3, max: 50, step: 0.5, unit: 'V', unitKind: 'volt', value: 12, stufe: 'trafo', group: G_E,
      help: 'Wechselspannung am Eingang des Gleichrichters (Effektivwert). Der Scheitelwert ist U2 mal Wurzel aus 2, abzüglich der Durchlassspannungen. Das Modell rechnet nur mit Kleinspannung bis 50 V.' },
    { key: 'topo', label: 'Schaltung', type: 'select', value: 'bruecke', options: opt([['einweg', 'Einweggleichrichter'], ['bruecke', 'Brückengleichrichter']]), stufe: 'gleich', group: G_G,
      help: 'Einweg lädt den Kondensator nur in einer Halbwelle (Pulsfrequenz 50 Hz, eine Diode), die Brücke in beiden (100 Hz, zwei Dioden im Strompfad). Bei gleichem Ladekondensator ist der Brumm der Brücke halb so groß.' },
    { key: 'diode', label: 'Diodenart', type: 'select', value: 'si', options: opt([['si', 'Silizium-Diode (0,7 V)'], ['schottky', 'Schottky-Diode (0,4 V, Übungswert)']]), stufe: 'gleich', group: G_G,
      help: 'Die Durchlassspannung je Diode: Silizium 0,7 V (belegt), Schottky 0,4 V (Übungswert, Ausbilder gleicht ab). Eine kleinere Durchlassspannung erhöht den Scheitelwert und senkt die Diodenverluste.' },
    { key: 'rs', label: 'Vorwiderstand R_s', type: 'slider', scale: 'lin', min: 0, max: 20, step: 0.1, unit: 'Ω', unitKind: 'res', value: 0, stufe: 'gleich', group: G_G,
      help: 'Widerstand in Reihe vor dem Ladekondensator. Er begrenzt den Einschaltstrom (Û geteilt durch R_i plus R_s) und die Ladestromspitzen. R_i des Transformators ist ein Übungswert.' },
    { key: 'c', label: 'Ladekondensator C', type: 'slider', scale: 'log', min: 100, max: 10000, step: 1, unit: 'µF', unitKind: 'cap', value: 2200, stufe: 'sieb', group: G_G,
      help: 'Kapazität des Ladekondensators. Ein größeres C verkleinert die Brummspannung (ΔU = I / (f_p · C), Lehrnäherung), macht die Ladestromimpulse aber schmaler und höher.' },
    { key: 'rsieb', label: 'RC-Glied nach dem Ladekondensator', type: 'switch', value: false, stufe: 'sieb', group: G_G,
      help: 'Schaltet ein RC-Glied (2,2 Ω und 1000 µF, Übungswerte) hinter den Ladekondensator. Es dämpft die Brummspannung, kostet aber Gleichspannung (I · R) und Verlustleistung.' },
    { key: 'iLast', label: 'Laststrom I', type: 'slider', scale: 'lin', min: 0, max: 3, step: 0.05, unit: 'A', unitKind: 'amp', value: 0.5, stufe: 'last', group: G_L,
      help: 'Konstanter Strom, den die Last aus dem Ladekondensator zieht. Doppelter Strom verdoppelt die Brummspannung. Vorgabe 0,5 A wie in der Pool-Aufgabe.' },
    { key: 'fire', label: 'Einschalten', type: 'button', stufe: null, group: G_L, help: 'Schaltet im Modell ein und meldet den Einschaltstrom: Der leere Ladekondensator wirkt zuerst wie ein Kurzschluss. Das ist nur eine Simulation.' }
  ];
  const METERS = [
    { key: 'uhat', label: 'Scheitelwert Û', unit: 'V', digits: 2, min: 0, max: 75, help: 'Scheitelwert hinter den Dioden: U2 mal Wurzel 2 minus n_D mal U_F (Einweg n_D = 1, Brücke n_D = 2).' },
    { key: 'udc', label: 'Gleichspannung U_DC (Mittel)', unit: 'V', digits: 2, min: 0, max: 75, help: 'Mittelwert hinter dem Ladekondensator: Û minus ΔU/2 (Näherung). Versagt die Näherung, steht hier der Mittelwert der Zeitschritt-Rechnung. Mit RC-Glied ist I · R abgezogen.' },
    { key: 'dubrumm', label: 'Brummspannung ΔU (Spitze–Spitze)', unit: 'V', digits: 2, min: 0, max: 40, help: 'Brumm am Ladekondensator: ΔU = I / (f_p · C), Lehrnäherung (Sägezahn). Versagt sie, steht hier die Spanne der Zeitschritt-Rechnung.' },
    { key: 'fp', label: 'Pulsfrequenz f_p', unit: 'Hz', digits: 0, min: 0, max: 100, help: 'Frequenz der Ladeimpulse: 50 Hz beim Einweggleichrichter, 100 Hz bei der Brücke (50 Hz Netzfrequenz).' },
    { key: 'iPeak', label: 'Ladestromspitze', unit: 'A', digits: 2, min: 0, max: 40, help: 'Höchster Strom der Dioden im Ladeimpuls aus der Zeitschritt-Rechnung. Dieser Strom ist viel größer als der mittlere Laststrom.' },
    { key: 'tLeit', label: 'Leitdauer je Impuls', unit: 'ms', digits: 2, min: 0, max: 10, zeroIsNone: true, help: 'Dauer, in der die Dioden je Ladeimpuls leiten, aus der Zeitschritt-Rechnung. 0 heißt: keine Leitphase (kein Laststrom).' },
    { key: 'imax', label: 'Einschaltstrom I_max', unit: 'A', digits: 1, min: 0, max: 200, help: 'Höchster Strom beim Einschalten in den leeren Kondensator: Û / (R_i + R_s). R_i (Übungswert) und R_s begrenzen ihn.' },
    { key: 'umin', label: 'Kleinste Spannung U_min', unit: 'V', digits: 2, min: 0, max: 75, help: 'Tiefster Wert der Ladekondensatorspannung: Û minus ΔU. Mit RC-Glied ist I · R abgezogen. Dieser Wert muss über der Mindest-Eingangsspannung des Reglers bleiben.' },
    { key: 'dusieb', label: 'Brumm nach RC-Glied', unit: 'mV', digits: 1, min: 0, max: 5000, zeroIsNone: true, help: 'Brummspannung hinter dem RC-Glied (Spannungsteiler aus R und Blindwiderstand von C2). 0 heißt: RC-Glied aus.' }
  ];
  const PRESETS = [
    { id: 'einweg-brueck', name: 'Einweg gegen Brücke', info: 'Einweggleichrichter mit 2200 µF, 0,5 A: halbe Pulsfrequenz, doppelter Brumm.', params: { u2: 12, topo: 'einweg', diode: 'si', rs: 0, c: 2200, rsieb: false, iLast: 0.5 } },
    { id: 'c-gross-klein', name: 'Ladekondensator groß', info: 'Brücke mit 10 000 µF: kleiner Brumm, schmale hohe Ladeimpulse.', params: { u2: 12, topo: 'bruecke', diode: 'si', rs: 0, c: 10000, rsieb: false, iLast: 0.5 } },
    { id: 'last-doppelt', name: 'Last verdoppelt', info: 'Brücke, 1 A statt 0,5 A: die Brummspannung verdoppelt sich.', params: { u2: 12, topo: 'bruecke', diode: 'si', rs: 0, c: 2200, rsieb: false, iLast: 1 } },
    { id: 'einschaltstrom', name: 'Einschaltstrom begrenzen', info: 'Mit 4,7 Ω Vorwiderstand sinkt der Einschaltstrom deutlich.', params: { u2: 12, topo: 'bruecke', diode: 'si', rs: 4.7, c: 2200, rsieb: false, iLast: 0.5 } }
  ];
  const PFAD = { quelle: 'Sekundärspannung des Transformators, Wechselspannung bis 50 V (Kleinspannung)', wandlung: 'Gleichrichter und Ladekondensator: Gleichspannung mit Brummspannung, optional RC-Glied', senke: 'Konstante Last am Ausgang, Eingang eines Spannungsreglers', art: 'passiv' };

  function plant(P0) {
    const CORE = P0.CORE;
    const L = id => B.lim(CORE, id);
    function compute(ctl) {
      const uf = ctl.diode === 'schottky' ? L('uf_schottky') : L('uf_si'), f = L('f_netz'), ri = L('ri_trafo');
      const cfg = { topo: ctl.topo, U2: ctl.u2, uf, f, C: ctl.c, I: ctl.iLast, ri, rs: ctl.rs };
      const rip = CORE.rect.ripple(cfg);
      if (!rip || !rip.ok) return { ok: false, error: rip && rip.why || 'Eingabe' };
      const wv = CORE.rect.wave(cfg, 400);
      if (!wv || !wv.ok) return { ok: false, error: wv && wv.why || 'Eingabe' };
      const inr = CORE.rect.inrush({ topo: ctl.topo, U2: ctl.u2, uf, ri, rs: ctl.rs });
      const okLim = L('ripple_ok') / 100 * rip.peak;
      const cmin = ctl.iLast > 0 ? CORE.rect.cmin({ topo: ctl.topo, I: ctl.iLast, dU: okLim, f }) : NaN;
      const valid = rip.valid;
      let mean = 0; for (let i = 0; i < wv.uc.length; i++) mean += wv.uc[i]; mean /= Math.max(1, wv.uc.length);
      const dU = valid ? rip.dU : wv.dU, Umittel0 = valid ? rip.Umittel : mean, Umin0 = valid ? rip.Umin : wv.Umin;
      let rc = null, drop = 0;
      if (ctl.rsieb) {
        const rcR = L('rc_r'), rcC = L('rc_c');
        rc = CORE.rect.rcSieb({ U1: dU, R: rcR, C: rcC, fp: rip.fp });
        if (rc && rc.ok) drop = ctl.iLast * rcR; else rc = null;
      }
      const other = CORE.rect.ripple({ topo: ctl.topo === 'einweg' ? 'bruecke' : 'einweg', U2: ctl.u2, uf, f, C: ctl.c, I: ctl.iLast });
      return { ok: true, cfg, uf, f, ri, rip, wv, inr, okLim, cmin, valid, dU, Umittel: Umittel0 - drop, Umin: Umin0 - drop, Umittel0, Umin0, rc, drop, rcR: ctl.rsieb ? L('rc_r') : 0,
        reglerMin: L('umin_7805'), reserveMin: L('reserve'), nD: ctl.topo === 'einweg' ? 1 : 2, other: other && other.ok ? other : null };
    }
    function meters(r) {
      if (!r.ok) return {};
      return { uhat: r.rip.peak, udc: r.Umittel, dubrumm: r.dU, fp: r.rip.fp, iPeak: r.wv.iPeak, tLeit: r.wv.tLeit * 1000, imax: isNum(r.inr.Imax) ? r.inr.Imax : 0, umin: r.Umin, dusieb: r.rc ? r.rc.U2 * 1000 : 0 };
    }
    /* Leistungsbilanz: abgegeben U_DC * I (Spannung mal Strom), Verluste der Dioden n_D * U_F * I und am Siebwiderstand I * (I * R). R_i und R_s sind nicht enthalten. */
    function bilanz(r, ctl) {
      if (!r.ok) return null;
      const I = ctl.iLast, pab = Math.max(0, r.Umittel) * I, pd = r.nD * r.uf * I, pr = I * r.drop;
      const pv = [{ stufe: 'gleich', w: pd }];
      if (ctl.rsieb) pv.push({ stufe: 'sieb', w: pr });
      return { pzu: pab + pd + pr, pab, pv };
    }
    /* Ampel nach SPEC 4.10 (siehe ABWEICHUNGEN WP2a): rot U_min unter Mindest-Eingang des Uebungsreglers; gelb Naeherung versagt, dU ueber Lehrgrenze oder Reserve < reserve;
       gruen sonst. Vergleiche exakt (Toleranz 1e-9). */
    function assess(r) {
      if (!r.ok) return { ok: false, ampel: 'grau', text: 'Die Anlage ist mit diesen Werten nicht rechenbar.' };
      const reg = eng(r.reglerMin, 'V'), um = eng(Math.max(0, r.Umin), 'V');
      if (r.Umin < r.reglerMin - 1e-9) return { ok: false, ampel: 'rot', text: 'U_min = ' + um + ' liegt unter der Mindest-Eingangsspannung des Übungsreglers 7805 (' + reg + ', Übungswert, Datenblatt maßgeblich): Der Regler fällt aus dem Betrieb.', margin: r.Umin > 0 ? r.Umin / r.reglerMin : 0 };
      if (!r.valid) return { ok: false, ampel: 'gelb', text: 'Die Brummformel gilt hier nicht (ΔU über ' + fm(L('ripple_naeh') * 100, 0) + ' % von Û): Angezeigt ist die Zeitschritt-Rechnung. U_min = ' + um + ' bleibt über ' + reg + '.' };
      const lim = r.okLim, d = r.dU, pct = fm(L('ripple_ok'), 0);
      if (d > lim + 1e-9) return { ok: false, ampel: 'gelb', text: 'ΔU = ' + eng(d, 'V') + ' liegt über dem Lehrfaustwert ' + pct + ' % von Û (' + eng(lim, 'V') + ', Übungswert). U_min = ' + um + ' bleibt über ' + reg + '.', margin: lim / d };
      const m = d > 0 ? lim / d : Infinity;
      if (m < r.reserveMin - 1e-9) return { ok: false, ampel: 'gelb', text: 'ΔU = ' + eng(d, 'V') + ' ist nahe der Grenze (' + eng(lim, 'V') + '): Reserve ' + fm(m, 2) + ' unter ' + fm(r.reserveMin, 1) + ' (Lehrfaustwerte).', margin: m };
      return { ok: true, ampel: 'gruen', text: 'ΔU = ' + eng(d, 'V') + ' liegt unter ' + pct + ' % von Û (' + eng(lim, 'V') + ') und U_min = ' + um + ' über ' + reg + ' (Lehrfaustwerte, Übungsregler).', margin: isFinite(m) ? m : undefined };
    }
    function diag(r, ctl) {
      const out = [];
      if (!r.ok) return out;
      out.push({ id: 'gleich-bilanz', kind: 'info', text: 'Die Verlustbilanz enthält die Dioden und den Siebwiderstand. Verluste in R_i und R_s sind nicht enthalten.' });
      if (!r.valid) out.push({ id: 'ripple-naeherung', kind: 'warn', text: (r.rip.diag[0] && r.rip.diag[0].text) || B.msg(CORE, 'ripple-naeherung', { dU: eng(r.rip.dU, 'V'), grenze: eng(r.rip.grenze, 'V') }, 'Näherung versagt.') });
      if (r.valid && r.dU > r.okLim + 1e-9) {
        out.push({ id: 'brumm-gross', kind: 'warn', text: B.msg(CORE, 'brumm-gross', { dU: eng(r.dU, 'V'), fp: eng(r.rip.fp, 'Hz'), C: fm(ctl.c, 0) + ' µF', grenze: eng(r.okLim, 'V') },
          'Die Brummspannung ΔU = {dU} (f_p = {fp}, C = {C}) liegt über dem Lehrfaustwert {grenze} (Übungswert).') });
        if (isNum(r.cmin) && ctl.c < r.cmin) out.push({ id: 'c-zu-klein', kind: 'warn', text: B.msg(CORE, 'c-zu-klein', { cmin: fm(r.cmin, 0) + ' µF', C: fm(ctl.c, 0) + ' µF' },
          'Für den Lehrfaustwert braucht der Ladekondensator mindestens {cmin}; eingestellt sind {C}.') });
      }
      if (ctl.topo === 'einweg' && r.other && r.other.dU) out.push({ id: 'brumm-100-gegen-50', kind: 'info', text: B.msg(CORE, 'brumm-100-gegen-50', { fp: eng(r.rip.fp, 'Hz'), dU: eng(r.rip.dU, 'V'), dUb: eng(r.other.dU, 'V') },
        'Einweg: Die Pulsfrequenz beträgt nur {fp}, ΔU = {dU}. Mit der Brücke (100 Hz) wäre ΔU = {dUb}.') });
      if (r.Umin < r.reglerMin - 1e-9) out.push({ id: 'regler-dropout', kind: 'error', text: B.msg(CORE, 'regler-dropout', { umin: eng(r.reglerMin, 'V'), uein: eng(Math.max(0, r.Umin), 'V') },
        'Der Regler braucht mindestens {umin} am Eingang, anliegen sind {uein}.') });
      if (isNum(r.inr.Imax) && r.inr.valid) out.push({ id: 'einschalt-hoch', kind: 'info', text: B.msg(CORE, 'einschalt-hoch', { imax: eng(r.inr.Imax, 'A') },
        'Beim Einschalten fließt bis zu {imax}: Der leere Ladekondensator wirkt zuerst wie ein Kurzschluss, R_i und der Vorwiderstand begrenzen den Strom.') });
      return out;
    }
    function curves(r, ctl) {
      if (!r.ok) return [];
      const cfg = r.cfg, A = [], B2 = [];
      for (let k = 0; k <= 40; k++) {
        const c = 100 * Math.pow(100, k / 40), q = CORE.rect.ripple(Object.assign({}, cfg, { C: c }));
        if (q && q.ok) A.push([c, q.dU]);
      }
      for (let k = 1; k <= 60; k++) {
        const i = 3 * k / 60, q = CORE.rect.ripple(Object.assign({}, cfg, { I: i }));
        if (q && q.ok) B2.push([i, q.dU]);
      }
      return [{ id: 'brumm-c', title: 'Brummspannung über dem Ladekondensator (Lehrnäherung)', xLabel: 'Ladekondensator C', xUnit: 'µF', xScale: 'log', yLabel: 'Brummspannung ΔU', yUnit: 'V',
        series: [{ name: 'ΔU = I / (f_p · C)', points: A }], marker: { x: ctl.c, y: r.rip.dU, label: 'jetzt ' + eng(r.rip.dU, 'V') }, limit: { y: r.okLim, label: 'Lehrfaustwert ' + fm(L('ripple_ok'), 0) + ' % von Û' } },
      { id: 'brumm-i', title: 'Brummspannung über dem Laststrom (Lehrnäherung)', xLabel: 'Laststrom I', xUnit: 'A', xScale: 'lin', yLabel: 'Brummspannung ΔU', yUnit: 'V',
        series: [{ name: 'ΔU = I / (f_p · C)', points: B2 }], marker: ctl.iLast > 0 ? { x: ctl.iLast, y: r.rip.dU, label: 'jetzt ' + eng(r.rip.dU, 'V') } : undefined, limit: { y: r.okLim, label: 'Lehrfaustwert ' + fm(L('ripple_ok'), 0) + ' % von Û' } }];
    }
    function waveform(r) {
      if (!r.ok) return null;
      const w = r.wv;
      return { tUnit: 'ms', t: w.t.map(v => v * 1000), series: [{ name: 'u2', y: w.u2.slice(), unit: 'V' }, { name: 'uc', y: w.uc.slice(), unit: 'V' }, { name: 'iD', y: w.iD.slice(), unit: 'A' }],
        marks: [{ name: 'tLeit', value: w.tLeit * 1000, unit: 'ms' }] };
    }
    function fire(r) {
      if (!r.ok) { P0.say('Einschalten nicht möglich: ' + (r.error || 'Eingabe prüfen') + '.', 'warn'); return false; }
      P0.say('Eingeschaltet: Der Einschaltstrom beträgt bis zu ' + eng(r.inr.Imax, 'A') + ', danach fließen Ladeimpulse bis ' + eng(r.wv.iPeak, 'A') + '.', 'info');
      return true;
    }
    function draw(ctx, w, h, t, view, sc) {
      const rc = sc.rect, r = view.res, pal = sc.pal;
      if (!rc || rc.w < 140 || rc.h < 100 || !r.ok) return;
      const wide = rc.w >= 640, gap = 8;
      let a, s, b;
      if (wide) {
        const th = Math.floor(rc.h * 0.58) - gap / 2;
        a = { x: rc.x, y: rc.y, w: Math.floor(rc.w * 0.38) - gap, h: th };
        s = { x: a.x + a.w + gap, y: rc.y, w: rc.w - a.w - gap, h: th };
        b = { x: rc.x, y: rc.y + th + gap, w: rc.w, h: rc.h - th - gap };
      } else {
        const h1 = Math.floor(rc.h * 0.3), h2 = Math.floor(rc.h * 0.38);
        a = { x: rc.x, y: rc.y, w: rc.w, h: h1 - gap };
        s = { x: rc.x, y: rc.y + h1, w: rc.w, h: h2 - gap };
        b = { x: rc.x, y: rc.y + h1 + h2, w: rc.w, h: rc.h - h1 - h2 };
      }
      const opts2 = { theme: sc.theme, q: sc.quality, reduced: sc.reduced, t: sc.t, bg: false };
      const D = sc.D, half = sc.reduced || sc.phase < 0.5 ? 1 : -1;
      let ok = false;
      if (D && D.rectifierScene) ok = !!D.rectifierScene(ctx, a, { kind: view.ctl.topo, half, uf: r.uf, uPeak: r.rip.peak, c: true, rl: eng(view.ctl.iLast, 'A') }, opts2);
      if (!ok) B.gfx.text(ctx, (view.ctl.topo === 'einweg' ? 'Einweg' : 'Brücke') + ' · Û ' + eng(r.rip.peak, 'V'), a.x, a.y + 20, { size: sc.fs, color: pal.fg, max: a.w });
      const stride = Math.max(1, Math.ceil(r.wv.t.length / sc.qp.pts));
      const pts = arr => { const o = []; for (let i = 0; i < r.wv.t.length; i += stride) o.push([r.wv.t[i], arr[i]]); return o; };
      let ok2 = false;
      if (D && D.scope) {
        ok2 = !!D.scope(ctx, s, { traces: [{ name: 'u2', unit: 'V', color: 'in', points: pts(r.wv.u2) }, { name: 'uc', unit: 'V', color: 'out', points: pts(r.wv.uc) }, { name: 'iD', unit: 'A', color: 'il', points: pts(r.wv.iD) }], beam: sc.beam }, opts2);
      }
      if (!ok2) B.gfx.text(ctx, 'ΔU ' + eng(r.dU, 'V') + ' · f_p ' + eng(r.rip.fp, 'Hz'), s.x, s.y + 20, { size: sc.fs, color: pal.fg, max: s.w });
      sc.block(b);
    }
    return { compute, meters, bilanz, assess, diag, curves, waveform, fire, draw, phaseHz: () => 0.5 };
  }

  R.register({ id: 'gleich', name: 'Gleichrichter und Siebung', icon: '🌊', info: 'Einweg und Brücke mit Ladekondensator: Scheitelwert, Brummspannung, Ladeimpulse und Einschaltstrom.', controls: CONTROLS, meters: METERS, presets: PRESETS,
    create(opts) { return B.makeRig({ id: 'gleich', name: 'Gleichrichter und Siebung', icon: '🌊', info: 'Gleichrichter und Siebung', world: { w: 960, h: 600 }, pfad: PFAD, controls: CONTROLS, meters: METERS, presets: PRESETS, params: {}, plant }, opts); } });
})(typeof window !== 'undefined' ? window : globalThis);
