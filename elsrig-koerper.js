/* elsrig-koerper.js - ELS-Lab (WP2a): Pruefstand 1 `koerper` - Stromwirkung auf den Koerper (SPEC 5.1).
 * Die gemeinsame Huelle (Steuerwerte, Cache, Ampel, Vorher/Nachher, Partikel, Zeichenhuelle) liegt in elsrig-base.js: Diese Datei im Browser NACH elsrig-base.js laden
 * (in Node holt sie sich die Basis per require). Gerechnet wird NUR im Kern (ELS_CORE.body.touch / zone / zoneCurve / resistance, rcd.person); hier steht keine zweite Formel.
 * Alle Zahlen sind Uebungswerte (Koerperwiderstand F11, Zonen F10): Uebungsanlage. Simulation, kein Hinweis fuer Arbeiten an Netzspannung. Kein Blut, keine Verletzungsdarstellung.
 * Steuerwerte: u (V), typ, haut, weg, rv (Ohm, log, 0 erlaubt), t (ms, Einwirkdauer), rcd (0 = aus, 30 = 30 mA Zusatzschutz), Taste fire (Beruehren).
 * Messgeraete: ik (mA), ub (V), rk (Ohm), zone (1...4, 0 = nicht gerechnet), tAb (ms, 0 = keine Abschaltung), rges (Ohm). Wirft nie.
 */
(function (root) {
  'use strict';
  const R = root.ELS_RIGS = root.ELS_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };
  if (typeof module !== 'undefined') module.exports = R;
  if (!R.base && typeof require === 'function') { try { require('./elsrig-base.js'); } catch (e) { /* Basis fehlt */ } }
  const B = R.base;
  if (!B) { if (typeof console !== 'undefined') console.warn('elsrig-koerper.js: Die Basis elsrig-base.js fehlt (bitte davor laden).'); return; }
  const { clamp, num, fm, isNum, eng } = B;

  const G_E = 'Berührung', G_K = 'Körper und Boden', G_Z = 'Zusatzschutz';
  const opt = (arr) => arr.map(a => ({ value: a[0], label: a[1] }));
  const CONTROLS = [
    { key: 'u', label: 'Spannung', type: 'slider', scale: 'lin', min: 12, max: 400, step: 1, unit: 'V', unitKind: 'volt', value: 230, ebene: 'basis', group: G_E,
      help: 'Spannung am berührten Teil. Kleinspannung senkt den Strom und ist Basisschutz. Die 50 V für Wechselspannung gelten für trockene Bedingungen, bei Nässe ist die Gefährdung größer.' },
    { key: 'typ', label: 'Stromart', type: 'select', value: 'wechsel', options: opt([['wechsel', 'Wechselspannung (50 Hz)'], ['gleich', 'Gleichspannung']]), ebene: null, group: G_E,
      help: 'Das Zonenmodell gilt nur für Wechselstrom von 50 Hz. Gleichstrom wird nicht gerechnet: Bei Gleichstrom gilt Fachkraft, Abstand, Notruf.' },
    { key: 'haut', label: 'Haut', type: 'select', value: 'trocken', options: opt([['trocken', 'trocken'], ['feucht', 'feucht'], ['nass', 'nass']]), ebene: null, group: G_K,
      help: 'Zustand der Haut bestimmt den Körperwiderstand (Übungswerte, F11): trocken 3 kΩ, feucht 1,5 kΩ, nass 1 kΩ. Nasse Haut leitet besser.' },
    { key: 'weg', label: 'Strompfad', type: 'select', value: 'hand-fuss', options: opt([['hand-fuss', 'Hand – Fuß'], ['hand-hand', 'Hand – Hand'], ['hand-rumpf', 'Hand – Rumpf']]), ebene: null, group: G_K,
      help: 'Weg des Stroms durch den Körper. Der Faktor des Pfades verändert den Körperwiderstand (Übungswert, F11); der Pfad über Rumpf ist kürzer.' },
    { key: 'rv', label: 'Boden und Schuhe', type: 'slider', scale: 'log', logZero: true, min: 0, max: 100000, step: 1, unit: 'Ω', unitKind: 'res', value: 0, ebene: 'basis', group: G_K,
      help: 'Übergangswiderstand von Boden und Schuhen in Reihe zum Körper. Mehr Widerstand bedeutet weniger Körperstrom (Basisschutz durch Isolierung). 0 Ω heißt: keine Isolierung.' },
    { key: 't', label: 'Einwirkdauer', type: 'slider', scale: 'log', min: 10, max: 10000, step: 1, unit: 'ms', unitKind: 'ms', value: 1000, ebene: null, group: G_E,
      help: 'Wie lange der Strom fließt. Die Lehrkurve der Zonen hängt von der Dauer ab: Kürzere Zeit verträgt mehr Strom. Mit RCD begrenzt dessen Auslösezeit die Dauer.' },
    { key: 'rcd', label: 'RCD (Zusatzschutz)', type: 'select', value: 0, options: [{ value: 0, label: 'aus' }, { value: 30, label: '30 mA' }], ebene: 'zusatz', group: G_Z,
      help: 'Zusatzschutz durch RCD mit 30 mA: Er löst bei Körperstrom ab IΔn aus und verkürzt die Einwirkdauer. Die Berührung wird dadurch nicht ungefährlich.' },
    { key: 'fire', label: 'Berühren', type: 'button', ebene: null, group: G_E, help: 'Startet die Berührung: Der Strom fließt, der Zeitbalken läuft. Das ist nur eine Simulation.' }
  ];
  const METERS = [
    { key: 'ik', label: 'Körperstrom I_K', unit: 'mA', digits: 2, min: 0, max: 1000, warnAbove: 10, help: 'Strom durch den Körper aus Spannung und Gesamtwiderstand.' },
    { key: 'ub', label: 'Berührungsspannung U_B', unit: 'V', digits: 0, min: 0, max: 400, help: 'Spannung am berührten Teil.' },
    { key: 'rk', label: 'Körperwiderstand R_K', unit: 'Ω', digits: 0, min: 0, max: 5000, help: 'Körperwiderstand nach Haut und Strompfad (Übungswert, F11).' },
    { key: 'rges', label: 'Gesamtwiderstand R_ges', unit: 'Ω', digits: 0, min: 0, max: 105000, help: 'Körperwiderstand plus Boden und Schuhe.' },
    { key: 'zone', label: 'Zone', unit: '', digits: 0, min: 0, max: 4, zeroIsNone: true, help: 'Zone 1 bis 4 der Lehrdarstellung; 0 heißt: bei Gleichstrom nicht gerechnet.' },
    { key: 'tAb', label: 'Abschaltzeit des RCD', unit: 'ms', digits: 0, min: 0, max: 300, zeroIsNone: true, help: 'Höchste Auslösezeit des RCD bei diesem Körperstrom; 0 heißt: keine sichere Auslösung.' }
  ];
  const PRESETS = [
    { id: 'trocken-230', name: '230 V, Haut trocken', info: 'Trockene Haut, keine Isolierung: Körperstrom und Zone aus der Rechnung.', params: { u: 230, typ: 'wechsel', haut: 'trocken', weg: 'hand-fuss', rv: 0, t: 1000, rcd: 0 } },
    { id: 'nass-230', name: '230 V, Haut nass', info: 'Nasse Haut, Rechenwert 1 kΩ: der Strom steigt deutlich.', params: { u: 230, typ: 'wechsel', haut: 'nass', weg: 'hand-fuss', rv: 0, t: 1000, rcd: 0 } },
    { id: 'kleinspannung', name: 'Kleinspannung 12 V', info: 'Niedrige Spannung, trockene Haut: weniger Strom, aber noch spürbar.', params: { u: 12, typ: 'wechsel', haut: 'trocken', weg: 'hand-fuss', rv: 0, t: 1000, rcd: 0 } },
    { id: 'schuhe', name: 'Mit Schuhen und Boden', info: 'Isolierender Boden und Schuhe in Reihe: der Strom sinkt stark.', params: { u: 230, typ: 'wechsel', haut: 'trocken', weg: 'hand-fuss', rv: 100000, t: 1000, rcd: 0 } },
    { id: 'kurz-lang', name: 'Mit RCD kürzer, nicht harmlos', info: 'Nasse Haut mit RCD 30 mA: Die Zeit wird kurz, die Zone bleibt hoch.', params: { u: 230, typ: 'wechsel', haut: 'nass', weg: 'hand-fuss', rv: 0, t: 1000, rcd: 30 } }
  ];
  const PFAD = { fehler: 'Berührung eines spannungsführenden Teils', weg: 'Hand – Körper – Fuß (Strompfad durch den Körper)', schutz: 'Isolierung und Schuhe, Kleinspannung, RCD (Zusatzschutz)', art: 'direkt' };
  const PARAMS = { dispMs: 2000, zeigeNachlauf: 500 };
  const WEG_TXT = { 'hand-fuss': 'Hand – Fuß', 'hand-hand': 'Hand – Hand', 'hand-rumpf': 'Hand – Rumpf' };

  function plant(P0) {
    const CORE = P0.CORE;
    let fireT = -1;                                     // ms seit Start der Berührung, -1 = noch nicht berührt
    const ulAc = () => { try { const l = CORE.limit('ul_ac'); return l && isNum(l.value) ? l.value : 50; } catch (e) { return 50; } };

    function compute(ctl) {
      const U = ctl.u, tMs = ctl.t, base = { U, tMs, haut: ctl.haut, weg: ctl.weg, rv: ctl.rv };
      if (ctl.typ === 'gleich') {
        const rs = CORE.body.resistance({ haut: ctl.haut, pfad: ctl.weg, rv: ctl.rv });
        return Object.assign(base, { ok: true, dc: true, valid: false, rk: rs.rk, rges: rs.rges, text: CORE.TEXTS.gleichstrom });
      }
      const touch = CORE.body.touch({ U, haut: ctl.haut, pfad: ctl.weg, rv: ctl.rv, tMs });
      if (!touch || touch.ok === false) return Object.assign(base, { ok: false, dc: false, valid: false, text: (touch && touch.why) || CORE.TEXTS.eingabe });
      let person = null;
      if (ctl.rcd > 0) person = CORE.rcd.person({ U, idn: ctl.rcd, type: 'A', on: true, haut: ctl.haut, pfad: ctl.weg, rv: ctl.rv });
      if (person && person.ok === false) person = null;
      const tripMs = person && person.trip && person.trip.tripped && isNum(person.trip.tTrip) ? person.trip.tTrip * 1000 : NaN;
      const verkuerzt = isNum(tripMs) && tripMs < tMs;
      const tEff = verkuerzt ? tripMs : tMs;
      const zone = CORE.body.zone(touch.iK, tEff);
      const zoneOhne = verkuerzt ? CORE.body.zone(touch.iK, tMs) : zone;
      return Object.assign(base, { ok: true, dc: false, valid: true, touch, person, tripMs, loest: !!(person && person.trip && person.trip.tripped), verkuerzt, tEff, zone, zoneOhne,
        iKmA: touch.iK * 1000, rk: touch.rk, rges: touch.rges });
    }
    function meters(r) {
      if (!r || r.ok === false) return { ik: 0, ub: 0, rk: 0, rges: 0, zone: 0, tAb: 0 };
      if (r.dc) return { ik: 0, ub: r.U, rk: r.rk, rges: r.rges, zone: 0, tAb: 0 };
      return { ik: r.iKmA, ub: r.U, rk: r.rk, rges: r.rges, zone: r.zone.zone, tAb: isNum(r.tripMs) ? r.tripMs : 0 };
    }
    function assess(r, ctl) {
      if (!r || r.ok === false) return { ok: false, ampel: 'grau', text: (r && r.text) || CORE.TEXTS.eingabe };
      if (r.dc) return { ok: false, ampel: 'grau', text: r.text };
      const z = r.zone, a = z.zone === 1 ? 'gruen' : z.zone === 2 ? 'gelb' : 'rot';
      let t = z.text + ' Körperstrom ' + eng(r.touch.iK, 'A') + ' über ' + fm(r.tEff, 0) + ' ms.';
      let zusatz = null;
      if (r.person) {
        zusatz = r.person.text;
        if (r.verkuerzt) t += ' ' + r.person.trip.text + ' ' + CORE.TEXTS.rcdVerkuerzt;
        else if (r.loest) t += ' Der RCD löst erst nach der Berührung aus (' + fm(r.tripMs, 0) + ' ms).';
        else t += ' ' + r.person.trip.text;
      }
      if (r.touch.hinweis) t += ' ' + r.touch.hinweis;
      return { ok: a !== 'rot', ampel: a, text: t, margin: z.margin * 1000, zusatz: zusatz };
    }
    function diag(r, ctl) {
      const out = [];
      if (!r || r.ok === false) return out;
      if (r.dc) { out.push({ id: 'gleichstrom', kind: 'warn', text: r.text }); return out; }
      const ul = ulAc();
      if (r.U > ul) out.push({ id: 'ub-gross', kind: 'warn', text: 'Die Spannung ' + fm(r.U, 0) + ' V liegt über der dauernd zulässigen Berührungsspannung von ' + fm(ul, 0) + ' V.' });
      if (r.touch.hinweis) out.push({ id: 'ul-nass', kind: 'info', text: r.touch.hinweis });
      if (r.person && r.verkuerzt) out.push({ id: 'rcd-verkuerzt', kind: 'info', text: r.person.trip.text + ' Die Einwirkdauer sinkt von ' + fm(r.tMs, 0) + ' ms auf ' + fm(r.tEff, 0) + ' ms (Zone ' + r.zoneOhne.zone + ' → Zone ' + r.zone.zone + '). ' + CORE.TEXTS.rcdVerkuerzt });
      if (r.person && !r.loest) out.push({ id: 'rcd-nicht', kind: 'warn', text: 'Der RCD löst bei ' + eng(r.touch.iK, 'A') + ' nicht sicher aus: ' + r.person.trip.text });
      return out;
    }
    function curves(r, ctl) {
      const ts = [], z1 = [], z2 = [], fl = [];
      let zc = null;
      for (let k = 0; k <= 30; k++) {
        const t = Math.pow(10, 1 + 3 * k / 30);
        zc = CORE.body.zoneCurve(t);
        if (!zc || zc.ok === false) continue;
        ts.push(t); z1.push([t, zc.z1 * 1000]); z2.push([t, zc.z2 * 1000]); fl.push([t, zc.flimmer * 1000]);
      }
      const c1 = { id: 'zonen', title: 'Stromwirkung über der Einwirkdauer (Lehrdarstellung, Übungswerte)', xLabel: 'Einwirkdauer', xUnit: 'ms', xScale: 'log', yLabel: 'Körperstrom', yUnit: 'mA', yScale: 'log',
        series: [{ name: 'Zone 1 bis', points: z1 }, { name: 'Zone 2 bis', points: z2 }, { name: 'Flimmerkurve (Zone 3 bis)', points: fl }] };
      if (r && r.valid) c1.marker = { x: r.tEff, y: Math.max(r.iKmA, 1e-3), label: 'Betriebspunkt ' + eng(r.touch.iK, 'A') + ', ' + fm(r.tEff, 0) + ' ms' };
      const us = [], is = [];
      if (r && r.rges > 0) for (let k = 0; k <= 40; k++) { const u = 12 + (400 - 12) * k / 40; us.push([u, u / r.rges * 1000]); }
      const c2 = { id: 'strom-spannung', title: 'Körperstrom über der Spannung', xLabel: 'Spannung', xUnit: 'V', xScale: 'lin', yLabel: 'Körperstrom', yUnit: 'mA', yScale: 'lin',
        series: [{ name: 'I_K = U / R_ges', points: us }] };
      if (r && r.valid) c2.marker = { x: r.U, y: r.iKmA, label: eng(r.touch.iK, 'A') };
      if (zc && zc.ok !== false) c2.limit = { y: zc.z1 * 1000, label: 'Zone 1 bis ' + fm(zc.z1 * 1000, 1) + ' mA' };
      return [c1, c2];
    }
    function waveform(r, ctl) {
      if (!r || !r.valid) return null;
      const tEnd = Math.max(r.tMs * 1.25, 40), N = 60, t = [], y = [], yl = [];
      for (let k = 0; k <= N; k++) {
        const tk = tEnd * k / N; t.push(tk);
        const on = tk <= r.tEff;
        y.push(on ? r.iKmA : 0);
        const zc = CORE.body.zoneCurve(Math.max(tk, 1));
        yl.push(zc && zc.ok !== false ? zc.flimmer * 1000 : 0);
      }
      const marks = [{ t: r.tEff, label: r.verkuerzt ? 'RCD trennt (höchstens ' + fm(r.tripMs, 0) + ' ms)' : 'Ende der Berührung' }];
      return { tUnit: 'ms', t, series: [{ name: 'Körperstrom I_K', y, unit: 'mA' }, { name: 'Flimmerkurve', y: yl, unit: 'mA' }], marks };
    }
    const running = () => fireT >= 0;
    const progress = (reduced) => (fireT < 0 ? 0 : reduced ? 1 : clamp(fireT / PARAMS.dispMs, 0, 1));

    function draw(ctx, w, h, t, view, sc) {
      const R0 = sc.rect, pal = sc.pal, g = sc.gfx, r = view.res, fs = sc.fs, D = sc.D;
      if (!R0 || !(R0.w >= 200 && R0.h >= 150) || !r) return;
      const narrow = R0.w < 560, barH = narrow ? 84 : 44, top = { x: R0.x, y: R0.y, w: R0.w, h: R0.h - barH - 6 };
      const f = progress(sc.reduced), valid = !!(r.valid);
      const zcol = valid ? pal['z' + r.zone.zone] : pal.grau;
      const flowing = valid && fireT >= 0 && f < 1 && (!r.verkuerzt || f < r.tEff / r.tMs);
      const rate = flowing ? clamp(Math.log10(1 + r.iKmA) / Math.log10(1001), 0.12, 1) : 0;
      // ---- oben: Strichfigur und Zonenbild (oder Hinweis bei Gleichstrom) ----
      let fig = null, chart = null;
      if (!valid) {
        g.panel(ctx, top.x, top.y, top.w, top.h, pal.panel, pal.grau, 10);
        g.text(ctx, 'Gleichstrom: Zonenmodell nicht gerechnet', top.x + 14, top.y + 26, { size: fs + 2, bold: true, color: pal.fg, max: top.w - 28 });
        g.text(ctx, (CORE.TEXTS.gleichstrom || ''), top.x + 14, top.y + 52, { size: fs, color: pal.mute, max: top.w - 28 });
      } else if (!narrow) {
        fig = { x: top.x, y: top.y, w: Math.round(top.w * 0.4), h: top.h };
        chart = { x: top.x + fig.w + 8, y: top.y, w: top.w - fig.w - 8, h: top.h };
      } else {
        const fh = Math.max(140, Math.round(top.h * 0.5)), ch = top.h - fh - 6;
        fig = { x: top.x, y: top.y, w: top.w, h: ch >= 140 ? fh : top.h };
        chart = ch >= 140 ? { x: top.x, y: top.y + fh + 6, w: top.w, h: ch } : null;
      }
      if (fig && fig.w >= 120 && fig.h >= 140) {
        let done = false;
        if (D && typeof D.bodyFigure === 'function') {
          try {
            let ps = null;
            if (typeof D.bodyPaths === 'function') {
              const bp = D.bodyPaths(fig, ctl0(view).weg, rate);
              ps = sc.ps('koerper', bp.map(p => Object.assign({}, p, { color: p.color || zcol, rate })), { speed: 80 });
            }
            const lab = fm(r.U, 0) + ' V · ' + (WEG_TXT[ctl0(view).weg] || '') + (flowing ? '' : (fireT < 0 ? ' · noch keine Berührung' : ' · beendet'));
            done = !!D.bodyFigure(ctx, fig, { zone: r.zone.zone, current: r.iKmA, path: ctl0(view).weg, rate, label: lab }, { theme: sc.theme, particles: ps });
          } catch (e) { done = false; }
        }
        if (!done) {
          g.panel(ctx, fig.x, fig.y, fig.w, fig.h, pal.panel, zcol, 8);
          g.text(ctx, 'Zone ' + r.zone.zone + ' ' + AMP_SYM(r), fig.x + 10, fig.y + 22, { size: fs + 1, bold: true, color: zcol, max: fig.w - 20 });
          g.text(ctx, 'Strom ' + eng(r.touch.iK, 'A'), fig.x + 10, fig.y + 44, { size: fs, color: pal.fg, max: fig.w - 20 });
        }
        sc.hit('fire', fig.x, fig.y, fig.w, fig.h);
      }
      if (chart && chart.w >= 200 && chart.h >= 140) {
        let done = false;
        if (D && typeof D.zoneChart === 'function') {
          try {
            const b = { z1: CORE.body.zoneCurve(100).z1 * 1000, z2: CORE.body.zoneCurve(100).z2 * 1000, fl: tt => { const c = CORE.body.zoneCurve(tt); return c && c.ok !== false ? c.flimmer * 1000 : NaN; } };
            done = !!D.zoneChart(ctx, chart, { I: Math.max(r.iKmA, 1e-3), t: r.tEff }, { bounds: b, theme: sc.theme });
          } catch (e) { done = false; }
        }
        if (!done) {
          g.panel(ctx, chart.x, chart.y, chart.w, chart.h, pal.panel, pal.line, 8);
          g.text(ctx, 'Zone ' + r.zone.zone + ': ' + r.zone.name, chart.x + 10, chart.y + 22, { size: fs, bold: true, color: zcol, max: chart.w - 20 });
        }
      }
      // ---- unten: Tasten und Zeitbalken ----
      const by = R0.y + R0.h - barH, chipH = 34, cw = 124;
      g.chip(ctx, '', 'Berühren', R0.x, by, cw, chipH, pal, { color: pal.fehler, on: running(), size: fs });
      sc.hit('fire', R0.x, by, cw, chipH);
      g.chip(ctx, 'RCD ', view.ctl.rcd > 0 ? view.ctl.rcd + ' mA' : 'aus', R0.x + cw + 8, by, cw, chipH, pal, { color: B.ebeneColor('zusatz', pal), on: view.ctl.rcd > 0, size: fs });
      sc.hit('rcd', R0.x + cw + 8, by, cw, chipH);
      const bx = narrow ? R0.x : R0.x + 2 * cw + 20, bw = narrow ? R0.w : R0.w - 2 * cw - 20, bby = narrow ? by + chipH + 8 : by + 16, bh = 14;
      if (bw > 60) {
        const lab = valid ? 'Einwirkdauer ' + fm(r.tMs, 0) + ' ms' + (r.verkuerzt ? ' · RCD löst nach höchstens ' + fm(r.tripMs, 0) + ' ms aus' : '') : 'Einwirkdauer: bei Gleichstrom nicht gerechnet';
        g.text(ctx, lab, bx, bby - 5, { size: fs, color: pal.mute, max: bw });
        g.bar(ctx, bx, bby, bw, bh, valid ? f : 0, 1, zcol, pal, valid && r.verkuerzt ? clamp(r.tEff / r.tMs, 0.02, 1) : undefined);
      }
    }
    const ctl0 = view => view.ctl;
    const AMP_SYM = r => (r.zone.zone === 1 ? '✓' : r.zone.zone === 2 ? '!' : '✗');

    return {
      compute, meters, assess, diag, curves, waveform, draw,
      phaseHz: () => 0.4,
      step(dtMs) { if (fireT >= 0 && fireT < PARAMS.dispMs + PARAMS.zeigeNachlauf) fireT += dtMs; },
      fire(r) {
        fireT = 0;
        if (r && r.dc) P0.say(r.text, 'warn');
        else if (r && r.valid) P0.say('Berührung: Körperstrom ' + eng(r.touch.iK, 'A') + ' über ' + fm(r.tEff, 0) + ' ms, Zone ' + r.zone.zone + '.' + (r.verkuerzt ? ' Der RCD verkürzt die Einwirkdauer von ' + fm(r.tMs, 0) + ' ms.' : ''), r.zone.zone >= 3 ? 'warn' : 'info');
        return true;
      },
      onControl() { fireT = -1; },
      reset() { fireT = -1; },
      state(r) { return { zone: r && r.valid ? r.zone.zone : 0, ik: r && r.valid ? r.iKmA : 0, tEff: r && r.valid ? r.tEff : 0, beruehrt: fireT >= 0, fireT: Math.max(fireT, 0) }; }
    };
  }

  R.register({ id: 'koerper', name: 'Stromwirkung auf den Körper', icon: '🧍',
    info: 'Körperstrom aus Spannung, Haut, Strompfad und Boden; Zonen der Stromwirkung (Lehrdarstellung, Übungswerte). Simulation, kein Hinweis für Arbeiten an Netzspannung.',
    controls: CONTROLS, meters: METERS, presets: PRESETS,
    create(opts) { return B.makeRig({ id: 'koerper', name: 'Stromwirkung auf den Körper', icon: '🧍', info: '', world: { w: 960, h: 600 }, pfad: PFAD, controls: CONTROLS, meters: METERS, presets: PRESETS, params: PARAMS, plant }, opts); } });
})(typeof window !== 'undefined' ? window : globalThis);
