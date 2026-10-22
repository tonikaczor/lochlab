/* elsrig-schutz.js - ELS-Lab (WP2b): Pruefstand 3 `schutz` - Sicherung und LS-Schalter (SPEC 5.3).
 * Die gemeinsame Huelle (Steuerwerte, Cache, Ampel, Vorher/Nachher, Partikel, Zeichenhuelle) liegt in elsrig-base.js: Diese Datei im Browser NACH elsrig-base.js laden
 * (in Node holt sie sich die Basis per require). Gerechnet wird NUR im Kern (ELS_CORE.prot.trip / ia / curve / cable / check / inrush); hier steht keine zweite Formel.
 * Alle Zahlen sind Uebungswerte (Lehrmodell F7, F8, Leitungstabelle F21): Uebungsanlage. Simulation, kein Hinweis fuer Arbeiten an Netzspannung.
 * Steuerwerte: dev (LS-B/C/D/gG), In (A), i (Pruefstrom als Vielfaches von In), ib (Betriebsstrom A), q (Leitung mm2), ein (Einschaltstrom als Vielfaches von In, 1 = keiner),
 *   sel (Vorsicherung, nur Begriff), Taste fire (Strom anlegen).
 * Messgeraete: tMin, tMax (s, 0 = keine Ausloesung), bereich (0 nicht, 1 thermisch, 2 unsicher, 3 sicher), iz (A), ia (A), strom (A, Pruefstrom). Wirft nie.
 */
(function (root) {
  'use strict';
  const R = root.ELS_RIGS = root.ELS_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };
  if (typeof module !== 'undefined') module.exports = R;
  if (!R.base && typeof require === 'function') { try { require('./elsrig-base.js'); } catch (e) { /* Basis fehlt */ } }
  const B = R.base;
  if (!B) { if (typeof console !== 'undefined') console.warn('elsrig-schutz.js: Die Basis elsrig-base.js fehlt (bitte davor laden).'); return; }
  const { clamp, num, fm, isNum, eng } = B;

  const G_S = 'Schutzorgan', G_L = 'Leitung und Last', G_P = 'Prüfstrom';
  const opt = arr => arr.map(a => ({ value: a[0], label: a[1] }));
  const SERIES = [6, 10, 13, 16, 20, 25, 32, 40, 50, 63];
  const CONTROLS = [
    { key: 'dev', label: 'Schutzorgan', type: 'select', value: 'LS-B', ebene: 'fehler', group: G_S,
      options: opt([['LS-B', 'LS-Schalter Typ B'], ['LS-C', 'LS-Schalter Typ C'], ['LS-D', 'LS-Schalter Typ D'], ['gG', 'Schmelzsicherung gG']]),
      help: 'Typ des Schutzorgans. B, C und D unterscheiden sich im magnetischen Auslösebereich (Lehrmodell, Übungswerte F7); die Schmelzsicherung gG rechnet mit einem Lehrmodell (F8), die Herstellerkennlinie ist maßgeblich.' },
    { key: 'In', label: 'Nennstrom In', type: 'select', value: 16, ebene: 'fehler', group: G_S, options: SERIES.map(v => ({ value: v, label: v + ' A' })),
      help: 'Nennstrom des Schutzorgans aus der Normreihe. Er muss zwischen dem Betriebsstrom Ib und der Strombelastbarkeit Iz der Leitung liegen: Ib ≤ In ≤ Iz.' },
    { key: 'q', label: 'Leitungsquerschnitt', type: 'select', value: 2.5, ebene: 'basis', group: G_L, options: [1.5, 2.5, 4, 6].map(v => ({ value: v, label: String(v).replace('.', ',') + ' mm²' })),
      help: 'Querschnitt der geschützten Leitung (Kupfer). Die Strombelastbarkeit Iz kommt aus einer Übungstabelle (Verlegeart B2, F21, nicht aus dem Tabellenbuch übernommen).' },
    { key: 'ib', label: 'Betriebsstrom Ib', type: 'slider', scale: 'lin', min: 0, max: 70, step: 0.5, unit: 'A', unitKind: 'amp', value: 10, ebene: null, group: G_L,
      help: 'Strom, den die Last im normalen Betrieb zieht. Ist Ib größer als In, löst das Schutzorgan im Betrieb aus.' },
    { key: 'ein', label: 'Einschaltstrom', type: 'slider', scale: 'lin', min: 1, max: 30, step: 0.5, unit: '× In', unitKind: 'plain', value: 1, ebene: null, group: G_L,
      help: 'Kurzzeitiger Einschaltstrom einer Last (zum Beispiel Motoranlauf) als Vielfaches von In. 1 heißt: kein Einschaltstrom. Liegt er im magnetischen Bereich, löst das Schutzorgan beim Einschalten aus.' },
    { key: 'sel', label: 'Vorsicherung (nur Begriff)', type: 'select', value: 'keine', ebene: null, group: G_L, options: opt([['keine', 'keine'], ['gG-vor', 'gG-Sicherung davor']]),
      help: 'Nur der Begriff Selektivität: Das Schutzorgan vor dem Abzweig soll später auslösen als das nachgeschaltete. Das wird hier nicht gerechnet, Herstellertabellen sind maßgeblich.' },
    { key: 'i', label: 'Prüfstrom', type: 'slider', scale: 'log', min: 0.5, max: 100, step: 0.01, unit: '× In', unitKind: 'plain', value: 2, ebene: null, group: G_P,
      help: 'Strom durch das Schutzorgan als Vielfaches von In. Unter 1,13 · In löst es nicht aus, darüber arbeitet zuerst der thermische Bereich, bei hohen Vielfachen der magnetische. Dazwischen liegt der unsichere Bereich.' },
    { key: 'fire', label: 'Strom anlegen', type: 'button', ebene: null, group: G_P,
      help: 'Legt den Prüfstrom an. Die Zeit läuft in Zeitlupe (logarithmische Zeitachse): Bimetall und Magnetanker bewegen sich, bis das Schutzorgan auslöst. Nur eine Simulation.' }
  ];
  const METERS = [
    { key: 'tMin', label: 'Früheste Auslösezeit', unit: 's', digits: 3, min: 0, max: 3600, zeroIsNone: true, help: 'Früheste Auslösezeit bei diesem Strom (Lehrmodell); 0 heißt: keine Auslösung.' },
    { key: 'tMax', label: 'Späteste Auslösezeit', unit: 's', digits: 3, min: 0, max: 3600, zeroIsNone: true, help: 'Späteste Auslösezeit bei diesem Strom (Lehrmodell); 0 heißt: keine sichere Auslösung.' },
    { key: 'bereich', label: 'Bereich', unit: '', digits: 0, min: 0, max: 3, zeroIsNone: true, help: '0 keine Auslösung, 1 thermisch, 2 unsicher (Auslösung möglich, nicht garantiert), 3 sicher (magnetisch).' },
    { key: 'iz', label: 'Strombelastbarkeit Iz', unit: 'A', digits: 0, min: 0, max: 40, help: 'Strombelastbarkeit der Leitung aus der Übungstabelle (F21).' },
    { key: 'ia', label: 'Auslösestrom Ia', unit: 'A', digits: 1, min: 0, max: 1300, help: 'Strom, ab dem das Schutzorgan sicher auslöst: obere magnetische Grenze beim LS-Schalter, bei gG der Strom für 0,4 s (Lehrmodell).' },
    { key: 'strom', label: 'Prüfstrom I', unit: 'A', digits: 1, min: 0, max: 6300, help: 'Prüfstrom in Ampere: Vielfaches mal Nennstrom.' }
  ];
  const PRESETS = [
    { id: 'b16-ueberlast', name: 'B16 bei Überlast', info: 'Doppelter Nennstrom: der thermische Bereich löst nach langer Zeit aus.', params: { dev: 'LS-B', In: 16, q: 2.5, ib: 12, ein: 1, sel: 'keine', i: 2 } },
    { id: 'motor-anlauf', name: 'Motoranlauf an Typ B', info: 'Sechsfacher Einschaltstrom liegt im magnetischen Bereich von Typ B: Der Schalter löst beim Anlauf aus. Probiere Typ C oder D.', params: { dev: 'LS-B', In: 16, q: 2.5, ib: 10, ein: 6, sel: 'keine', i: 2 } },
    { id: 'leitung-zu-schwach', name: 'Leitung zu schwach', info: 'Nennstrom größer als die Strombelastbarkeit der Leitung: Die Leitung ist bei Überlast nicht geschützt.', params: { dev: 'LS-B', In: 20, q: 1.5, ib: 12, ein: 1, sel: 'keine', i: 2 } },
    { id: 'gg-schmelz', name: 'gG-Sicherung schmilzt', info: 'Fünffacher Nennstrom an der gG-Sicherung (Lehrmodell, Herstellerkennlinie maßgeblich).', params: { dev: 'gG', In: 16, q: 2.5, ib: 10, ein: 1, sel: 'keine', i: 5 } }
  ];
  const PFAD = { fehler: 'Überstrom: Überlast oder Kurzschluss in der Leitung', weg: 'Strom durch Schutzorgan und Leitung (Lehrmodell, Übungswerte)', schutz: 'Schutzorgan trennt die Leitung: thermisch (Bimetall) oder magnetisch (Anker)', art: 'verhalten' };
  const PARAMS = { dispS: 3, nachlaufS: 0.6, tLo: 1e-3, tHi: 3600 };
  const BER_NR = { nicht: 0, thermisch: 1, unsicher: 2, sicher: 3 };
  const BER_TXT = { nicht: 'keine Auslösung', thermisch: 'thermischer Bereich', unsicher: 'unsicherer Bereich', sicher: 'sicherer Bereich' };
  const finOr = (v, d) => (isNum(v) ? v : d);

  function plant(P0) {
    const CORE = P0.CORE;
    let fireT = -1;                                     // s seit Anlegen des Stroms, -1 = noch nicht angelegt
    const logPos = t => clamp((Math.log10(Math.max(t, PARAMS.tLo)) - Math.log10(PARAMS.tLo)) / (Math.log10(PARAMS.tHi) - Math.log10(PARAMS.tLo)), 0, 1);

    function compute(ctl) {
      const In = ctl.In, x = ctl.i, I = x * In;
      const trip = CORE.prot.trip(ctl.dev, In, I);
      if (!trip || trip.ok === false) return { ok: false, text: (trip && trip.why) || CORE.TEXTS.eingabe };
      const ia = CORE.prot.ia(ctl.dev, In);
      const cab = CORE.prot.cable(ctl.q);
      if (!cab || cab.ok === false) return { ok: false, text: (cab && cab.why) || CORE.TEXTS.eingabe };
      const chk = CORE.prot.check(ctl.ib, In, cab.iz);
      if (!chk || typeof chk.ibOk !== 'boolean') return { ok: false, text: (chk && chk.why) || CORE.TEXTS.eingabe };
      let inr = null;
      if (ctl.ein > 1) { inr = CORE.prot.inrush(ctl.dev, In, ctl.ein); if (inr && inr.ok === false) inr = null; }
      const tMax = isFinite(trip.tMax) ? trip.tMax : null, tMin = isFinite(trip.tMin) ? trip.tMin : null;
      return { ok: true, dev: ctl.dev, In, x, I, trip, ia, iz: cab.iz, cab, chk, inr, tMin, tMax, bereich: trip.bereich, ib: ctl.ib, q: ctl.q };
    }
    function meters(r) {
      if (!r || r.ok === false) return { tMin: 0, tMax: 0, bereich: 0, iz: 0, ia: 0, strom: 0 };
      return { tMin: r.tMin === null ? 0 : r.tMin, tMax: r.tMax === null ? 0 : r.tMax, bereich: BER_NR[r.bereich], iz: r.iz, ia: finOr(r.ia, 0), strom: r.I };
    }
    function assess(r, ctl) {
      if (!r || r.ok === false) return { ok: false, ampel: 'grau', text: (r && r.text) || CORE.TEXTS.eingabe };
      const rot = !r.chk.izOk || !r.chk.ibOk || (r.inr && r.inr.ausloesung === 'ja');
      const gelb = r.bereich === 'unsicher' || (r.inr && r.inr.ausloesung === 'moeglich');
      const a = rot ? 'rot' : gelb ? 'gelb' : 'gruen';
      let t = r.chk.text + ' ' + r.trip.text;
      if (r.inr) t += ' ' + r.inr.text;
      if (isNum(r.ia)) t += ' Auslösestrom Ia = ' + eng(r.ia, 'A') + ' (Lehrmodell).';
      const margin = Math.min(r.iz / r.In, r.ib > 0 ? r.In / r.ib : Infinity);
      const out = { ok: a !== 'rot', ampel: a, text: t };
      if (isNum(margin) && isFinite(margin)) out.margin = margin;
      if (ctl.sel === 'gG-vor') out.zusatz = 'Selektivität (nur Begriff): Die Vorsicherung soll später auslösen als das nachgeschaltete Schutzorgan. Das wird hier nicht gerechnet, Herstellertabellen sind maßgeblich.';
      return out;
    }
    const fe = (v, u) => (typeof CORE.fmtEng === 'function' ? CORE.fmtEng(v, u) : eng(v, u));
    function diag(r) {
      const out = [];
      if (!r || r.ok === false) return out;
      if (!r.chk.izOk) out.push({ id: 'ls-zu-gross', kind: 'error', text: 'In = ' + fe(r.In, 'A') + ' ist größer als Iz = ' + fe(r.iz, 'A') + ': Die Leitung wäre bei Überlast nicht geschützt.' });
      if (!r.chk.ibOk) out.push({ id: 'ib-zu-gross', kind: 'warn', text: 'Ib = ' + fe(r.ib, 'A') + ' ist größer als In = ' + fe(r.In, 'A') + ': Das Schutzorgan würde im Betrieb auslösen.' });
      if (r.bereich === 'unsicher') out.push({ id: 'unsicher', kind: 'warn', text: r.trip.text });
      if (r.inr && r.inr.ausloesung === 'ja') out.push({ id: 'anlauf-loest', kind: 'warn', text: r.inr.text + ' Ein Schutzorgan mit höherem magnetischem Bereich (Typ C oder D) löst erst bei größeren Strömen aus.' });
      if (r.inr && r.inr.ausloesung === 'moeglich') out.push({ id: 'anlauf-unsicher', kind: 'warn', text: r.inr.text });
      return out;
    }
    function curves(r, ctl) {
      const band = CORE.prot.curve(ctl.dev, ctl.In) || [];
      const lo = [], hi = [];
      band.forEach(p => { if (isNum(p[0]) && isNum(p[1]) && p[1] > 0) lo.push([p[0], p[1]]); if (isNum(p[0]) && isNum(p[2]) && p[2] > 0) hi.push([p[0], p[2]]); });
      const c1 = { id: 'ausloeseband', title: 'Auslösebereich ' + ctl.dev + ' ' + ctl.In + ' A (Band, Lehrmodell)', xLabel: 'Strom als Vielfaches von In', xUnit: '· In', xScale: 'log',
        yLabel: 'Auslösezeit', yUnit: 's', yScale: 'log', series: [{ name: 'früheste Auslösezeit', points: lo }, { name: 'späteste Auslösezeit', points: hi }] };
      if (r && r.ok) {
        const ty = r.tMax !== null ? r.tMax : r.tMin;
        if (isNum(ty) && ty > 0) c1.marker = { x: r.x, y: ty, label: 'Arbeitspunkt ' + eng(r.I, 'A') + ', ' + eng(ty, 's') };
      }
      const lim = CORE.limit('tab_033');
      if (lim && isNum(lim.value)) c1.limit = { y: lim.value, label: 'Abschaltzeit ' + fm(lim.value, 1) + ' s (Endstromkreis)' };
      const pts = [];
      [1.5, 2.5, 4, 6].forEach(q => { const c = CORE.prot.cable(q); if (c && c.ok !== false) pts.push([q, c.iz]); });
      const c2 = { id: 'belastbarkeit', title: 'Strombelastbarkeit Iz der Leitung (Übungstabelle F21)', xLabel: 'Querschnitt', xUnit: 'mm²', xScale: 'lin', yLabel: 'Strom', yUnit: 'A', yScale: 'lin',
        series: [{ name: 'Iz (Übungswert)', points: pts }] };
      if (r && r.ok) {
        c2.marker = { x: r.q, y: r.In, label: 'In = ' + eng(r.In, 'A') };
        if (r.ib > 0) c2.limit = { y: r.ib, label: 'Ib = ' + eng(r.ib, 'A') };
      }
      return [c1, c2];
    }
    // ---- Zeitablauf der Anzeige (Zeitlupe, logarithmische Zeitachse) ----
    const started = () => fireT >= 0;
    const progress = reduced => (fireT < 0 ? 0 : reduced ? 1 : clamp(fireT / PARAMS.dispS, 0, 1));
    const tripPos = r => (r && r.ok && r.tMax !== null ? logPos(r.tMax) : null);
    const isTripped = (r, f) => { const p = tripPos(r); return started() && p !== null && f >= p - 1e-9; };
    function mech(r, f) {
      const p = tripPos(r);
      const pr = p === null ? 0 : p > 0 ? clamp(f / p, 0, 1) : 1;
      const b = r.bereich;
      return { thermal: b === 'thermisch' ? pr : b === 'unsicher' ? pr : b === 'sicher' ? 0.15 * pr : 0, magnet: b === 'sicher' ? pr : b === 'unsicher' ? 0.5 * pr : 0 };
    }
    function fuse(ctx, rect, r, tripped, heat, pal, g, fs) {
      g.panel(ctx, rect.x, rect.y, rect.w, rect.h, pal.panel, pal.line, 8);
      g.text(ctx, 'Schmelzsicherung gG im Schnitt', rect.x + 10, rect.y + 20, { size: fs, bold: true, color: pal.fg, max: rect.w - 20 });
      const bx = rect.x + rect.w * 0.12, bw = rect.w * 0.76, by = rect.y + rect.h * 0.34, bh = Math.max(24, rect.h * 0.36), my = by + bh / 2;
      g.panel(ctx, bx, by, bw, bh, pal.panel2, pal.fg, 6);
      const col = heat > 0.8 ? pal.rot : heat > 0.4 ? pal.gelb : pal.neutral;
      g.line(ctx, [[rect.x + 8, my], [bx + 6, my]], pal.l1, 3);
      g.line(ctx, [[bx + bw - 6, my], [rect.x + rect.w - 8, my]], pal.l1, 3);
      if (!tripped) g.line(ctx, [[bx + 6, my], [bx + bw * 0.36, my - bh * 0.22], [bx + bw * 0.5, my + bh * 0.22], [bx + bw * 0.64, my - bh * 0.22], [bx + bw - 6, my]], col, 2.5 + 2 * heat);
      else { g.line(ctx, [[bx + 6, my], [bx + bw * 0.38, my]], pal.mute, 2); g.line(ctx, [[bx + bw * 0.62, my], [bx + bw - 6, my]], pal.mute, 2); }
      g.text(ctx, tripped ? 'Schmelzleiter durchgeschmolzen' : heat > 0 ? 'Schmelzleiter erwärmt sich' : 'Schmelzleiter intakt', rect.x + 10, rect.y + rect.h - 10, { size: fs, color: tripped ? pal.rot : pal.mute, max: rect.w - 20 });
    }
    function draw(ctx, w, h, t, view, sc) {
      const R0 = sc.rect, pal = sc.pal, g = sc.gfx, r = view.res, fs = sc.fs, D = sc.D, ctl = view.ctl;
      if (!R0 || !(R0.w >= 240 && R0.h >= 170) || !r || r.ok === false) {
        if (R0 && r && r.ok === false) g.text(ctx, r.text || '', R0.x + 8, R0.y + 20, { size: fs, color: pal.rot, max: R0.w - 16 });
        return;
      }
      const narrow = R0.w < 640, chipH = 32, rows = R0.w < 480 ? 2 : 1;
      const botH = rows * (chipH + 6) + 44, top = { x: R0.x, y: R0.y, w: R0.w, h: R0.h - botH - 4 };
      const f = progress(sc.reduced), tripped = isTripped(r, f), m = mech(r, f), pos = tripPos(r);
      const cutR = narrow ? { x: top.x, y: top.y, w: top.w, h: top.h >= 330 ? Math.round(top.h * 0.5) : top.h } : { x: top.x, y: top.y, w: Math.round(top.w * 0.42), h: top.h };
      const bandR = narrow ? (top.h >= 330 ? { x: top.x, y: top.y + cutR.h + 6, w: top.w, h: top.h - cutR.h - 6 } : null) : { x: top.x + cutR.w + 8, y: top.y, w: top.w - cutR.w - 8, h: top.h };
      // ---- oben: Schnitt des Schutzorgans und Kennlinienband ----
      if (ctl.dev === 'gG') fuse(ctx, cutR, r, tripped, started() ? clamp(pos ? f / Math.max(pos, 1e-6) : f * 0.2, 0, 1) : 0, pal, g, fs);
      else {
        let done = false;
        if (D && typeof D.breakerCut === 'function') { try { done = !!D.breakerCut(ctx, cutR, { thermal: m.thermal, magnet: m.magnet, tripped, x: r.x }, { theme: sc.theme }); } catch (e) { done = false; } }
        if (!done) {
          g.panel(ctx, cutR.x, cutR.y, cutR.w, cutR.h, pal.panel, pal.line, 8);
          g.text(ctx, ctl.dev + ' ' + ctl.In + ' A: ' + (tripped ? 'hat ausgelöst' : 'bereit'), cutR.x + 10, cutR.y + 22, { size: fs, color: tripped ? pal.rot : pal.fg, max: cutR.w - 20 });
        }
      }
      sc.hit('fire', cutR.x, cutR.y, cutR.w, cutR.h);
      if (bandR && bandR.w >= 200 && bandR.h >= 140) {
        let ok2 = false;
        if (D && typeof D.tripBand === 'function') {
          try {
            const o2 = { theme: sc.theme, name: ctl.dev + ' ' + ctl.In + ' A' };
            const ty = r.tMax !== null ? r.tMax : r.tMin;
            if (r.x >= 1 && isNum(ty) && ty > 0) o2.point = { x: r.x, t: ty }; else if (r.x >= 1) o2.point = { x: r.x };
            if (isNum(r.ia) && r.ia > 0) o2.xa = r.ia / r.In;
            ok2 = !!D.tripBand(ctx, bandR, CORE.prot.curve(ctl.dev, ctl.In) || [], o2);
          } catch (e) { ok2 = false; }
        }
        if (!ok2) { g.panel(ctx, bandR.x, bandR.y, bandR.w, bandR.h, pal.panel, pal.line, 8); g.text(ctx, 'Auslösebereich ' + ctl.dev + ' ' + ctl.In + ' A', bandR.x + 10, bandR.y + 22, { size: fs, color: pal.mute, max: bandR.w - 20 }); }
      }
      // ---- unten: Tasten und Zeitbalken ----
      const by = R0.y + R0.h - botH, n = rows === 2 ? 2 : 3, cwid = Math.floor((R0.w - (n - 1) * 8) / n);
      const chips = [['', ctl.dev, 'dev', B.ebeneColor('fehler', pal)], ['In ', ctl.In + ' A', 'In', B.ebeneColor('fehler', pal)], ['', 'Strom anlegen', 'fire', pal.fehler]];
      chips.forEach((c, i) => {
        const cx = R0.x + (i % n) * (cwid + 8), cy = by + Math.floor(i / n) * (chipH + 6);
        g.chip(ctx, c[0], c[1], cx, cy, cwid, chipH, pal, { color: c[3], on: c[2] === 'fire' && started(), size: fs });
        sc.hit(c[2], cx, cy, cwid, chipH);
      });
      const bby = by + rows * (chipH + 6) + 14;
      const lab = r.tMax !== null ? (started() ? 'Zeitlupe, Zeitachse logarithmisch: ' : '') + 'löst spätestens nach ' + eng(r.tMax, 's') + ' aus (früheste ' + eng(r.tMin === null ? 0 : r.tMin, 's') + ')'
        : r.tMin !== null ? 'Auslösung möglich ab ' + eng(r.tMin, 's') + ', nicht garantiert' : 'bei diesem Strom keine Auslösung';
      g.text(ctx, lab, R0.x, bby - 4, { size: fs, color: pal.mute, max: R0.w });
      g.bar(ctx, R0.x, bby, R0.w, 14, f, 1, tripped ? pal.rot : pal.gelb, pal, pos !== null && pos > 0 ? pos : undefined);
    }
    return {
      compute, meters, assess, diag, curves, draw,
      phaseHz: () => 0.4,
      step(dtMs) { if (fireT >= 0 && fireT < PARAMS.dispS + PARAMS.nachlaufS) fireT += dtMs / 1000; },
      fire(r) {
        fireT = 0;
        if (r && r.ok) P0.say('Prüfstrom ' + eng(r.I, 'A') + ' angelegt: ' + r.trip.text, r.bereich === 'unsicher' ? 'warn' : 'info');
        return true;
      },
      onControl() { fireT = -1; },
      reset() { fireT = -1; },
      state(r) {
        const f = progress(false);
        return { bereichCode: r && r.ok ? BER_NR[r.bereich] : 0, bereichName: r && r.ok ? BER_TXT[r.bereich] : '', x: r && r.ok ? r.x : 0, strom: r && r.ok ? r.I : 0, gestartet: started(), ausgeloest: !!(r && r.ok && isTripped(r, f)), fireT: Math.max(fireT, 0) };
      }
    };
  }

  R.register({ id: 'schutz', name: 'Sicherung und LS-Schalter', icon: '🔌',
    info: 'Auslösebereich von LS-Schaltern (B, C, D) und gG-Sicherung als Band, Leitungsschutz Ib ≤ In ≤ Iz, Einschaltstrom (Lehrmodell, Übungswerte). Simulation, kein Hinweis für Arbeiten an Netzspannung.',
    controls: CONTROLS, meters: METERS, presets: PRESETS,
    create(opts) { return B.makeRig({ id: 'schutz', name: 'Sicherung und LS-Schalter', icon: '🔌', info: '', world: { w: 960, h: 600 }, pfad: PFAD, controls: CONTROLS, meters: METERS, presets: PRESETS, params: PARAMS, plant }, opts); } });
})(typeof window !== 'undefined' ? window : globalThis);
