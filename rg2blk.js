/* rg2blk.js - Regelungstechnik Aufbau: die sechs interaktiven Blöcke (Visualisierung, Regler, Messwerte). Rechnet nur über rg2core.js, zeichnet über rg2viz.js. */
(function (root) {
  'use strict';
  const UI = root.RG2UI, R = root.RG2, V = root.RG2VIZ, f = UI.f, S = UI.S, esc = UI.esc, $ = UI.$;
  const DEG = 180 / Math.PI;
  const OUT = id => { const o = document.getElementById('out-' + id); return o; };
  const set = (id, html) => { const o = OUT(id); if (o) o.innerHTML = html; };
  const finite = x => typeof x === 'number' && isFinite(x);
  const sgn = (x, d) => (x >= 0 ? '+ ' : '− ') + f(Math.abs(x), d);

  /* ===================================================================== Block 1: Übertragungsfunktion */
  UI.reg('b1', {
    enums: { type: ['PT1', 'PT2', 'I', 'DT1', 'PT1Tt'] },
    def: { type: 'PT2', K: 1, T: 1, w0: 3, D: 0.4, Ki: 0.5, Kd: 0.5, T1: 0.3, Tt: 0.6, pade: 2 },
    left() {
      return ['<div class="cvrow two"><div>' + UI.canvas('c1-step', 'cv-step', 'Sprungantwort des gewählten Bausteins') + '<div id="c1-leg"></div></div><div>' + UI.canvas('c1-pz', 'cv-pz', 'Pol-Nullstellen-Plan in der s-Ebene') + '</div></div>',
        '<p class="note">Links die Sprungantwort mit Toleranzband ±5 % und Kenngrößen. Rechts der Pol-Nullstellen-Plan: Kreuze sind Pole, Kreise Nullstellen. Grün hinterlegt ist die stabile linke Halbebene.</p>'];
    },
    controls() {
      const st = S.st.b1;
      let h = UI.seg('b1', 'type', [['PT1', 'PT1'], ['PT2', 'PT2'], ['I', 'I'], ['DT1', 'D (DT1)'], ['PT1Tt', 'PT1 + Totzeit']], 'Baustein');
      if (st.type === 'PT1') h += UI.slider('b1', 'K', 'Verstärkung K', { min: 0.2, max: 5, log: true, dec: 2 }) + UI.slider('b1', 'T', 'Zeitkonstante T', { min: 0.05, max: 5, log: true, dec: 2, unit: 's' });
      if (st.type === 'PT2') h += UI.slider('b1', 'K', 'Verstärkung K', { min: 0.2, max: 5, log: true, dec: 2 }) + UI.slider('b1', 'w0', 'Kennkreisfrequenz ω0', { min: 0.3, max: 20, log: true, dec: 2, unit: '1/s' }) + UI.slider('b1', 'D', 'Dämpfung D (unter 0 instabil)', { min: -0.3, max: 2, dec: 2, snap: 0.01 });
      if (st.type === 'I') h += UI.slider('b1', 'Ki', 'Integrierbeiwert K_I', { min: 0.1, max: 5, log: true, dec: 2, unit: '1/s' });
      if (st.type === 'DT1') h += UI.slider('b1', 'Kd', 'Differenzierbeiwert K_D', { min: 0.05, max: 2, log: true, dec: 2, unit: 's' }) + UI.slider('b1', 'T1', 'Verzögerung T1', { min: 0.02, max: 2, log: true, dec: 2, unit: 's' });
      if (st.type === 'PT1Tt') h += UI.slider('b1', 'K', 'Verstärkung K', { min: 0.2, max: 5, log: true, dec: 2 }) + UI.slider('b1', 'T', 'Zeitkonstante T', { min: 0.05, max: 5, log: true, dec: 2, unit: 's' }) + UI.slider('b1', 'Tt', 'Totzeit Tt', { min: 0.05, max: 3, log: true, dec: 2, unit: 's' }) + UI.seg('b1', 'pade', [[1, '1'], [2, '2'], [3, '3'], [4, '4']], 'Padé-Ordnung für den Pol-Nullstellen-Plan');
      return h;
    },
    update() {
      const st = S.st.b1; let G, txt;
      if (st.type === 'PT1') { G = R.pt1(st.K, st.T); txt = 'G(s) = ' + f(st.K, 2) + ' / (1 + ' + f(st.T, 2) + ' s)'; }
      else if (st.type === 'PT2') { G = R.pt2(st.K, st.w0, st.D); txt = 'G(s) = ' + f(st.K * st.w0 * st.w0, 2) + ' / (s² ' + sgn(2 * st.D * st.w0, 2) + ' s + ' + f(st.w0 * st.w0, 2) + ')'; }
      else if (st.type === 'I') { G = R.integrator(st.Ki); txt = 'G(s) = ' + f(st.Ki, 2) + ' / s'; }
      else if (st.type === 'DT1') { G = R.dt1(st.Kd, st.T1); txt = 'G(s) = ' + f(st.Kd, 2) + ' s / (1 + ' + f(st.T1, 2) + ' s)'; }
      else { G = R.withDelay(R.pt1(st.K, st.T), st.Tt); txt = 'G(s) = ' + f(st.K, 2) + ' / (1 + ' + f(st.T, 2) + ' s) · e^(−' + f(st.Tt, 2) + ' s)'; }
      const Gp = R.withPade(G, st.pade || 2), poles = R.roots(Gp.den), zeros = R.roots(Gp.num), cls = R.stabilityOfPoles(poles);
      const dc = R.dcGain(G), stable = cls.cls === 'stabil';
      const r0 = R.stepResponse(G, { n: 1500 }), lim = 20 * Math.max(1, Math.abs(finite(dc) ? dc : 1));
      const rc = UI.cleanBlow(r0, lim), yFinal = finite(dc) && stable ? dc : undefined;
      const info = R.stepInfo(r0, { yFinal: yFinal });
      const series = [{ t: rc.t, y: rc.y, ci: 0 }];
      const legend = [{ color: 'var(--c0)', label: st.type === 'PT1Tt' ? 'exakt (Totzeit)' : 'Sprungantwort', dash: 0 }];
      if (st.type === 'PT1Tt') { const rp = UI.cleanBlow(R.stepResponse(Gp, { tEnd: r0.tEnd, n: 1500 }), lim); series.push({ t: rp.t, y: rp.y, ci: 1 }); legend.push({ color: 'var(--c1)', label: 'mit Padé-Ordnung ' + st.pade, dash: 1 }); }
      const marks = []; if (finite(yFinal) && stable && info.tRise != null) marks.push({ t: info.tRise, label: 'T_an', ci: 2 }); if (finite(yFinal) && stable && info.tSettle5) marks.push({ t: info.tSettle5, label: 'T_aus', ci: 1 });
      UI.draw('c1-step', (ctx, W, H, pal) => V.drawStep(ctx, W, H, pal, { series: series, yFinal: finite(yFinal) ? yFinal : null, band: 0.05, marks: marks, yClip: [-lim, lim], xLabel: 't in s', tMax: rc.cut ? rc.t[rc.t.length - 1] : undefined }));
      UI.draw('c1-pz', (ctx, W, H, pal) => V.drawPZ(ctx, W, H, pal, { poles: poles, zeros: zeros, plane: 's' }));
      UI.hover('c1-step', (px, py, P) => { const t = P.invX(px), y = P.invY(py); return P.inside(px, py) ? 't = ' + f(t, 2) + ' s, y = ' + f(y, 3) : ''; });
      $('#c1-leg').innerHTML = UI.legend(legend);
      const rows = [['Übertragungsfunktion', '<span style="font-weight:500">' + esc(txt) + '</span>'], ['Pole', UI.rootsText(poles).map(esc).join('<br>')], ['Nullstellen', UI.rootsText(zeros).map(esc).join('<br>')], ['Verhalten', UI.badge(cls.cls)]];
      if (stable && finite(yFinal)) {
        rows.push(['Endwert', f(yFinal, 3)]);
        if (Math.abs(yFinal) > 1e-9) rows.push(['Überschwingen', f(info.overshootPct, 1) + ' %'], ['Anregelzeit T_an', info.tRise == null ? 'nicht erreicht' : UI.fmtT(info.tRise)], ['Ausregelzeit ±5 %', UI.fmtT(info.tSettle5)], ['Ausregelzeit ±2 %', UI.fmtT(info.tSettle2)]);
        else rows.push(['Anfangssprung y(0+)', f(r0.y[0], 2)]);
      } else rows.push(['Endwert', cls.cls === 'instabil' ? 'läuft weg (instabil)' : 'kein fester Endwert']);
      let html = UI.kv(rows);
      if (st.type === 'PT1Tt') html += '<p class="note">Die Totzeit ist exakt gerechnet (Kurve „exakt“). Der Pol-Nullstellen-Plan zeigt das Padé-Glied ' + st.pade + '. Ordnung: Es hat Nullstellen in der rechten Halbebene. Höhere Ordnung folgt der Totzeit besser.</p>';
      if (st.type === 'PT2' && st.D < 0) html += '<p class="note">D unter 0: Das Polpaar liegt rechts der Imaginärachse, die Schwingung schaukelt sich auf.</p>';
      set('b1', html);
    }
  });

  /* ===================================================================== Block 2: Bode */
  const W2 = { lo: 0.01, hi: 1e4 };
  function b2tf(st) {
    let num = [Math.pow(10, st.Kdb / 20)], den = [1], delay = 0;
    for (let i = 0; i < st.integ; i++) den = R.pmul(den, [1, 0]);
    if (st.integ < 0) num = R.pmul(num, [1, 0]);
    if (st.a) den = R.pmul(den, [1 / st.wa, 1]);
    if (st.b) den = R.pmul(den, [1 / st.wb, 1]);
    if (st.p2) den = R.pmul(den, [1 / (st.w2 * st.w2), 2 * st.D2 / st.w2, 1]);
    if (st.z) num = R.pmul(num, [1 / st.wz, 1]);
    if (st.tt) delay = st.Tt / 1000;
    return R.tf(num, den, delay);
  }
  UI.reg('b2', {
    def: { Kdb: 20, integ: 0, a: true, wa: 2, b: true, wb: 60, p2: false, w2: 200, D2: 0.2, z: false, wz: 10, tt: false, Tt: 5, asym: true, corners: true },
    left() { return [UI.canvas('c2-bode', 'cv-bode', 'Bode-Diagramm: Betrag in dB und Phase in Grad über der Kreisfrequenz') + '<div id="c2-leg"></div>', '<p class="note">Durchgezogen der echte Verlauf, gestrichelt die Asymptoten (Geradenstücke). Senkrechte gepunktete Linien sind die Eckfrequenzen. Antippen oder Überfahren zeigt die Werte.</p>']; },
    controls() {
      const st = S.st.b2;
      let h = UI.slider('b2', 'Kdb', 'Verstärkung K', { min: -20, max: 60, dec: 0, unit: 'dB', snap: 1 }) + UI.seg('b2', 'integ', [[-1, 'D (s)'], [0, 'keiner'], [1, 'I (1/s)'], [2, 'I² (1/s²)']], 'Integrator oder Differenzierer');
      h += UI.chk('b2', 'a', 'PT1 a (Verzögerung)'); if (st.a) h += UI.slider('b2', 'wa', 'Eckfrequenz ω_a', { min: 0.1, max: 3000, log: true, dec: 1, unit: '1/s' });
      h += UI.chk('b2', 'b', 'PT1 b (Verzögerung)'); if (st.b) h += UI.slider('b2', 'wb', 'Eckfrequenz ω_b', { min: 0.1, max: 3000, log: true, dec: 1, unit: '1/s' });
      h += UI.chk('b2', 'p2', 'PT2 (schwingungsfähig)'); if (st.p2) h += UI.slider('b2', 'w2', 'Kennkreisfrequenz ω0', { min: 0.1, max: 3000, log: true, dec: 1, unit: '1/s' }) + UI.slider('b2', 'D2', 'Dämpfung D', { min: 0.05, max: 1.5, dec: 2, snap: 0.01 });
      h += UI.chk('b2', 'z', 'Vorhalt (1 + s/ω_z)'); if (st.z) h += UI.slider('b2', 'wz', 'Eckfrequenz ω_z', { min: 0.1, max: 3000, log: true, dec: 1, unit: '1/s' });
      h += UI.chk('b2', 'tt', 'Totzeit'); if (st.tt) h += UI.slider('b2', 'Tt', 'Totzeit Tt', { min: 0.1, max: 200, log: true, dec: 1, unit: 'ms' });
      return h + UI.chk('b2', 'asym', 'Asymptoten zeigen') + UI.chk('b2', 'corners', 'Eckfrequenzen markieren');
    },
    update() {
      const st = S.st.b2, G = b2tf(st), F = R.factors(G);
      const bd = R.bode(G, { wMin: W2.lo, wMax: W2.hi, n: 600, F: F });
      const A = R.bodeAsymptotes(G), asym = st.asym ? { w: bd.w, db: bd.w.map(w => A.db(w)) } : null;
      const m = R.margins(G, { wMin: W2.lo, wMax: W2.hi, F: F });
      const corners = st.corners ? A.corners.map(c => c.w) : [];
      const d = { w: bd.w, db: bd.db, ph: bd.ph, asym: asym, corners: corners, wc: m.wc, phStep: 90 };
      UI.draw('c2-bode', (ctx, W, H, pal) => V.drawBode(ctx, W, H, pal, d));
      UI.hover('c2-bode', (px, py, P) => { const A1 = P.P1, B1 = P.P2; if (!(A1.inside(px, py) || B1.inside(px, py))) return ''; const w = A1.invX(px), r = R.respAt(F, w); return 'ω = ' + f(w, 2) + ' 1/s: |G| = ' + f(r.db, 1) + ' dB, φ = ' + f(r.ph, 1) + '°'; });
      $('#c2-leg').innerHTML = UI.legend([{ color: 'var(--c0)', label: 'echter Verlauf', dash: 0 }].concat(st.asym ? [{ color: 'var(--c1)', label: 'Asymptoten (Betrag)', dash: 1 }] : []));
      const rows = [];
      const bounds = [W2.lo].concat(A.corners.map(c => c.w), [W2.hi]);
      const segs = []; for (let i = 0; i < bounds.length - 1; i++) { const mid = Math.sqrt(bounds[i] * bounds[i + 1]); segs.push([f(bounds[i], 2) + ' bis ' + f(bounds[i + 1], 2) + ' 1/s', (A.slopeAt(mid) > 0 ? '+' : A.slopeAt(mid) < 0 ? '−' : '') + f(Math.abs(A.slopeAt(mid)), 0) + ' dB/Dek.']); }
      rows.push(['Steigung bei tiefen Frequenzen', (A.slopeAt(W2.lo * 1.01) > 0 ? '+' : A.slopeAt(W2.lo * 1.01) < 0 ? '−' : '') + f(Math.abs(A.slopeAt(W2.lo * 1.01)), 0) + ' dB/Dek.']);
      A.corners.forEach(c => rows.push(['Eckfrequenz ' + (c.kind === 'p' ? '(Pol' : '(Nullstelle') + (c.pair ? ', Paar)' : ')'), f(c.w, 2) + ' 1/s']));
      rows.push(['Durchtrittsfrequenz ω_D', finite(m.wc) ? f(m.wc, 2) + ' 1/s' : 'kein Durchtritt im Bereich']);
      if (finite(m.pm)) rows.push(['Phase bei ω_D', f(m.pm - 180, 1) + '°']);
      let html = UI.kv(rows) + '<h3>Abschnitte der Asymptote</h3>' + UI.kv(segs);
      if (st.p2 && st.D2 < 0.5) html += '<p class="note">Bei kleiner Dämpfung hebt der PT2 den Betrag vor der Ecke um 1/(2·D·√(1−D²)) heraus (Resonanz); die Asymptote kennt das nicht.</p>';
      set('b2', html);
    }
  });

  /* ===================================================================== Block 3: Stabilität */
  const PLANTS3 = {
    ipt1: { name: 'I + PT1', tf: () => R.tf([1], R.pmul([1, 0], [0.1, 1])), txt: 'K / [ s (1 + 0,1 s) ]' },
    ipt1pt1: { name: 'I + PT1 + PT1', tf: () => R.itn(1, [0.1, 0.02]), txt: 'K / [ s (1 + 0,1 s)(1 + 0,02 s) ]' },
    pt3: { name: 'drei gleiche PT1', tf: () => R.ptn(1, [0.1, 0.1, 0.1]), txt: 'K / (1 + 0,1 s)³' },
    pt2: { name: 'PT1 + PT1 (ohne Integrator)', tf: () => R.ptn(1, [1, 0.2]), txt: 'K / [ (1 + s)(1 + 0,2 s) ]' },
    ipt2: { name: 'I + PT1 + PT1 (träge)', tf: () => R.itn(1, [0.5, 0.1]), txt: 'K / [ s (1 + 0,5 s)(1 + 0,1 s) ]' }
  };
  function b3model(st) {
    const P = PLANTS3[st.plant] || PLANTS3.ipt1, base = P.tf(), L = R.withDelay(R.tfGain(base, st.K), st.Tt);
    const F = R.factors(L), m = R.margins(L, { F: F }), ns = R.nyquistSimple(L), Tcl = R.closedLoop(L, 6), poles = R.roots(Tcl.den), cls = R.stabilityOfPoles(poles);
    return { P: P, L: L, F: F, m: m, ns: ns, Tcl: Tcl, poles: poles, cls: cls };
  }
  UI.reg('b3', {
    enums: { plant: Object.keys(PLANTS3) },
    def: { plant: 'ipt1pt1', K: 10, Tt: 0, R: 3 },
    left() { return [UI.canvas('c3-bode', 'cv-bode', 'Bode-Diagramm des offenen Kreises mit Phasenreserve und Amplitudenreserve'), '<div class="cvrow eq"><div>' + UI.canvas('c3-ny', 'cv-sq', 'Nyquist-Ortskurve des offenen Kreises mit dem kritischen Punkt minus eins') + '</div><div>' + UI.canvas('c3-step', 'cv-sq', 'Sprungantwort des geschlossenen Regelkreises') + '<div id="c3-leg"></div></div></div><p class="note">Bode: grüne Linie = Durchtritt ω_D mit Phasenreserve (grüne Klammer), rote Linie = ω_180 mit Amplitudenreserve (rote Klammer). Nyquist: rotes Kreuz = kritischer Punkt −1, grüner Ring = Durchtritt, roter Punkt = Phase −180°. Rechts: Sprungantwort des geschlossenen Kreises.</p>']; },
    controls() {
      const st = S.st.b3;
      return UI.select('b3', 'plant', Object.keys(PLANTS3).map(k => [k, PLANTS3[k].name]), 'Strecke (offener Kreis ohne Verstärkung)') + '<div class="eq" aria-label="Offener Kreis">L(s) = ' + esc(PLANTS3[st.plant].txt) + (st.Tt > 0 ? ' · e^(−' + f(st.Tt, 3) + ' s)' : '') + '</div>' +
        UI.slider('b3', 'K', 'Kreisverstärkung K', { min: 0.1, max: 1000, log: true, dec: 2 }) + UI.slider('b3', 'Tt', 'zusätzliche Totzeit Tt', { min: 0, max: 0.3, dec: 3, unit: 's', snap: 0.005 }) + UI.seg('b3', 'R', [[1.5, 'eng'], [3, 'mittel'], [10, 'weit']], 'Ausschnitt der Nyquist-Ortskurve');
    },
    update() {
      const st = S.st.b3, M = b3model(st), m = M.m;
            const bd = R.bode(M.L, { F: M.F, n: 500 }), ny = R.nyquist(M.L, { F: M.F, n: 800 });
      const pt = w => { if (!finite(w)) return null; const r = R.respAt(M.F, w); return { re: r.re, im: r.im }; };
      UI.draw('c3-bode', (ctx, W, H, pal) => V.drawBode(ctx, W, H, pal, { w: bd.w, db: bd.db, ph: bd.ph, wc: m.wc, wpc: m.wpc, pm: m.pm, gmDb: m.gmDb, corners: [], phStep: 90 }));
      UI.draw('c3-ny', (ctx, W, H, pal) => V.drawNyquist(ctx, W, H, pal, { re: ny.re, im: ny.im, R: st.R, wcPoint: pt(m.wc), wpcPoint: pt(m.wpc) }));
      UI.hover('c3-bode', (px, py, P) => { if (!(P.P1.inside(px, py) || P.P2.inside(px, py))) return ''; const w = P.P1.invX(px), r = R.respAt(M.F, w); return 'ω = ' + f(w, 2) + ' 1/s: |L| = ' + f(r.db, 1) + ' dB, φ = ' + f(r.ph, 1) + '°'; });
      const rc = R.stepResponse(M.Tcl, { n: 1500, tEnd: M.cls.cls === 'instabil' ? Math.min(R.autoHorizon(M.Tcl), 30) : undefined }), cl = UI.cleanBlow(rc, 5);
      const yF = M.cls.cls === 'stabil' ? R.dcGain(M.Tcl) : null;
      UI.draw('c3-step', (ctx, W, H, pal) => V.drawStep(ctx, W, H, pal, { series: [{ t: cl.t, y: cl.y, ci: 0 }], yFinal: finite(yF) ? yF : null, band: 0.05, yClip: [-5, 5], xLabel: 't in s', yLabel: 'Führungssprung', tMax: cl.cut ? cl.t[cl.t.length - 1] : undefined }));
      UI.hover('c3-step', (px, py, P) => P.inside(px, py) ? 't = ' + f(P.invX(px), 2) + ' s, y = ' + f(P.invY(py), 3) : '');
      $('#c3-leg').innerHTML = UI.legend([{ color: 'var(--c0)', label: 'Sprungantwort geschlossener Kreis', dash: 0 }]);
      const ok = M.cls.cls === 'stabil', agree = M.ns.applicable ? (M.ns.stable === ok) : null;
      const rows = [['Durchtrittsfrequenz ω_D', finite(m.wc) ? f(m.wc, 2) + ' 1/s' : 'kein Durchtritt (|L| < 1)'], ['Phasenreserve φ_R', finite(m.pm) ? f(m.pm, 1) + '°' : '–'], ['Phasendurchtritt ω_180', finite(m.wpc) ? f(m.wpc, 2) + ' 1/s' : 'nicht vorhanden'], ['Amplitudenreserve A_R', finite(m.gmDb) ? f(m.gmDb, 1) + ' dB (Faktor ' + f(m.gmLin, 2) + ')' : '∞ (nie bei −180°)']];
      if (finite(m.gmLin)) rows.push(['Kritische Verstärkung K_krit', f(st.K * m.gmLin, 2)]);
      rows.push(['Vereinfachtes Nyquist', M.ns.applicable ? UI.badge(M.ns.stable ? 'stabil' : 'instabil') : '<span class="bad warn">nicht anwendbar</span>'], ['Pole des geschlossenen Kreises (Probe)', UI.badge(M.cls.cls)]);
      let html = UI.kv(rows);
      if (!M.ns.applicable) html += '<p class="note">Das einfache Kriterium gilt hier nicht: ' + esc(M.ns.why.join('; ')) + '. Maßgeblich ist die Pol-Probe des geschlossenen Kreises.</p>';
      else html += '<p class="note">' + (agree ? 'Beide Wege stimmen überein: Aussage aus der Phasenreserve und Probe über die Pole des geschlossenen Kreises (Totzeit als Padé-Glied 6. Ordnung).' : 'Achtung: knapper Grenzfall, beide Wege weichen minimal ab (Padé-Näherung der Totzeit).') + '</p>';
      html += '<p class="note">Geschlossene Pole: ' + esc(UI.rootsText(M.poles).slice(0, 6).join(' ; ')) + (M.poles.length > 6 ? ' …' : '') + '</p>';
      if (st.Tt > 0 && finite(m.wc) && finite(m.pm)) html += '<p class="note">Totzeit-Grenze für ω_D: ' + f(st.Tt + R.tdMax(m.pm, m.wc), 3) + ' s insgesamt. Die Totzeit kostet ω_D·Tt = ' + f(m.wc * st.Tt * DEG, 1) + '° Phase.</p>';
      set('b3', html);
    }
  });

  /* ===================================================================== Block 4: Wurzelortskurve */
  const PRE4 = {
    p1: { name: '1 / [(s+1)(s+2)(s+3)]', N: [1], D: () => R.pmul(R.pmul([1, 1], [1, 2]), [1, 3]) },
    p2: { name: '1 / [s (s+4)]', N: [1], D: () => R.pmul([1, 0], [1, 4]) },
    p3: { name: '(s+3) / [s (s+1)(s+5)]', N: [1, 3], D: () => R.pmul(R.pmul([1, 0], [1, 1]), [1, 5]) },
    p4: { name: '1 / [s (s+2)(s+4)]', N: [1], D: () => R.pmul(R.pmul([1, 0], [1, 2]), [1, 4]) },
    p5: { name: '1 / [s (s² + 2s + 5)]', N: [1], D: () => R.pmul([1, 0], [1, 2, 5]) },
    p6: { name: '1 / [(s+1)(s+3)]', N: [1], D: () => R.pmul([1, 1], [1, 3]) }
  };
  const cache4 = {};
  function b4data(key) {
    if (cache4[key]) return cache4[key];
    const P = PRE4[key], N = P.N, Dd = P.D(), info = R.locusInfo(N, Dd);
    const nn = R.ptrim(N), dd = R.ptrim(Dd), kNorm = Math.abs(dd[dd.length - 1] / nn[nn.length - 1]) || 1;
    const Kmax = info.kcrit ? 3 * info.kcrit : (info.breakaway.length ? 40 * info.breakaway[0].K : 40 * kNorm);
    const Ks = [0]; for (let i = 0; i <= 500; i++) Ks.push(Kmax * Math.pow(i / 500, 3) + 1e-9 * kNorm);
    Ks.sort((a, b) => a - b);
    const br = R.rootLocus(N, Dd, Ks);
    const kc = info.kcrit ? R.locusRoots(N, Dd, info.kcrit).filter(z => Math.abs(z.re) < 1e-5 * Math.max(1, Math.abs(z.im)) && z.im !== 0) : [];
    return (cache4[key] = { N: N, D: Dd, info: info, Kmax: Kmax, br: br, kcritPts: kc, D707: R.locusKforDamping(N, Dd, Math.SQRT1_2) });
  }
  let play4 = null;
  UI.reg('b4', {
    enums: { pre: Object.keys(PRE4) },
    def: { pre: 'p1', pos: 120 },
    left() { return ['<div class="cvrow eq"><div>' + UI.canvas('c4-loc', 'cv-sq', 'Wurzelortskurve in der s-Ebene') + '</div><div>' + UI.canvas('c4-step', 'cv-sq', 'Sprungantwort des geschlossenen Kreises bei der gewählten Verstärkung') + '<div id="c4-leg"></div></div>', '<p class="note">Graue Kreuze: Pole des offenen Kreises (K = 0). Kreise: Nullstellen. Punkte: Pole des geschlossenen Kreises bei der gewählten Verstärkung (grün stabil, rot instabil). Rote Ringe: Achsenkreuzung (K_krit). Gelbe Quadrate: Verzweigungspunkte. Gestrichelt: Asymptoten.</p>']; },
    controls() {
      const st = S.st.b4, d = b4data(st.pre);
      return UI.select('b4', 'pre', Object.keys(PRE4).map(k => [k, 'L(s) = K · ' + PRE4[k].name]), 'Offener Kreis') +
        '<div class="ctl"><div class="lb"><span id="lb-b4-pos">Verstärkung K</span><b id="v-b4-pos">' + f(this.K(st), 3) + '</b></div><input type="range" min="0" max="1000" step="1" value="' + st.pos + '" id="b4pos" aria-labelledby="lb-b4-pos"></div>' +
        '<div class="btns"><button type="button" class="chip" data-act="act" data-v="kcrit"' + (d.info.kcrit ? '' : ' disabled') + '>K = K_krit</button><button type="button" class="chip" data-act="act" data-v="d707"' + (d.D707 ? '' : ' disabled') + '>D = 0,707</button><button type="button" class="chip" data-act="act" data-v="zero">K = 0</button>' + (UI.reduceMotion() ? '' : '<button type="button" class="chip" data-act="act" data-v="play" id="b4play">▶ K durchfahren</button>') + '</div>';
    },
    K(st) { const d = b4data(st.pre); return d.Kmax * Math.pow(st.pos / 1000, 3); },
    posOf(st, K) { const d = b4data(st.pre); return Math.max(0, Math.min(1000, Math.round(1000 * Math.cbrt(K / d.Kmax)))); },
    action(v) {
      const st = S.st.b4, d = b4data(st.pre);
      if (v === 'kcrit' && d.info.kcrit) st.pos = this.posOf(st, d.info.kcrit);
      else if (v === 'd707' && d.D707) st.pos = this.posOf(st, d.D707);
      else if (v === 'zero') st.pos = 0;
      else if (v === 'play') { if (play4) { cancelAnimationFrame(play4); play4 = null; return; } let p = 0; const go = () => { p += 3; if (p > 1000 || S.tab !== 'b4') { play4 = null; return; } S.st.b4.pos = p; const sl = document.getElementById('b4pos'); if (sl) sl.value = p; const lb = document.getElementById('v-b4-pos'); if (lb) lb.textContent = f(this.K(S.st.b4), 3); this.update(); play4 = requestAnimationFrame(go); }; play4 = requestAnimationFrame(go); return; }
      UI.save(); UI.renderCtl();
    },
    onSet(k) { if (k === 'pre') { S.st.b4.pos = 120; if (play4) { cancelAnimationFrame(play4); play4 = null; } } },
    update() {
      const st = S.st.b4, d = b4data(st.pre), K = this.K(st), info = d.info;
      const sl = document.getElementById('b4pos'); if (sl && !sl._bound) { sl._bound = true; sl.addEventListener('input', () => { if (play4) { cancelAnimationFrame(play4); play4 = null; } S.st.b4.pos = +sl.value; UI.save(); const lb = document.getElementById('v-b4-pos'); if (lb) lb.textContent = f(this.K(S.st.b4), 3); this.update(); }); }
      const lb = document.getElementById('v-b4-pos'); if (lb) lb.textContent = f(K, 3);
      if (sl && +sl.value !== st.pos) sl.value = st.pos;
      const now = R.locusRoots(d.N, d.D, K), cls = R.stabilityOfPoles(now);
      UI.draw('c4-loc', (ctx, W, H, pal) => V.drawLocus(ctx, W, H, pal, { branches: d.br, poles0: info.poles, zeros: info.zeros, now: now, kcritPts: d.kcritPts, breakaway: info.breakaway, centroid: info.centroid, asymAngles: info.asymAngles }));
      const num = R.pscale(d.N, K), T = R.tf(num, R.padd(d.D, num)), stb = cls.cls === 'stabil', dc = R.dcGain(T);
      const r = R.stepResponse(T, { n: 1500, tEnd: stb ? undefined : Math.min(R.autoHorizon(T), 40) }), c = UI.cleanBlow(r, 6), yF = stb && finite(dc) ? dc : null;
      const si = R.stepInfo(r, { yFinal: yF == null ? undefined : yF });
      UI.draw('c4-step', (ctx, W, H, pal) => V.drawStep(ctx, W, H, pal, { series: [{ t: c.t, y: c.y, ci: 0 }], yFinal: yF, band: 0.05, yClip: [-6, 6], xLabel: 't in s', tMax: c.cut ? c.t[c.t.length - 1] : undefined }));
      UI.hover('c4-step', (px, py, P) => P.inside(px, py) ? 't = ' + f(P.invX(px), 2) + ' s, y = ' + f(P.invY(py), 3) : '');
      $('#c4-leg').innerHTML = UI.legend([{ color: 'var(--c0)', label: 'Sprungantwort bei K = ' + f(K, 2), dash: 0 }]);
      const cp = now.filter(z => z.im > 1e-9).sort((a, b) => (a.re - b.re))[0];
      const rows = [['Verstärkung K', f(K, 3)], ['Pole des geschlossenen Kreises', UI.rootsText(now).map(esc).join('<br>')], ['Verhalten', UI.badge(cls.cls)]];
      if (cp) { const w0 = Math.hypot(cp.re, cp.im); rows.push(['Dämpfung D des Polpaars', f(-cp.re / w0, 3)], ['Kennkreisfrequenz ω0 = |s|', f(w0, 3) + ' 1/s'], ['Eigenkreisfrequenz ω_d = Im(s)', f(Math.abs(cp.im), 3) + ' 1/s']); }
      if (stb && finite(dc)) rows.push(['Überschwingen', f(si.overshootPct, 1) + ' %'], ['Ausregelzeit ±5 %', UI.fmtT(si.tSettle5)]);
      rows.push(['K_krit (Achsenkreuzung)', info.kcrit ? f(info.kcrit, 2) : 'keine'], ['ω_krit', info.wcrit ? f(info.wcrit, 3) + ' 1/s' : '–'], ['Äste ins Unendliche (n − m)', String(info.nAsym)]);
      if (info.centroid != null && info.nAsym > 1) rows.push(['Schwerpunkt σ_S der Asymptoten', f(info.centroid, 3)]);
      if (info.breakaway.length) rows.push(['Verzweigungspunkt', info.breakaway.map(b => f(b.s, 3) + ' (K = ' + f(b.K, 3) + ')').join('<br>')]);
      set('b4', UI.kv(rows));
    }
  });

  /* ===================================================================== Block 5: Reglerentwurf */
  function b5plant(st) {
    if (st.plant === 'bo') { const Ts = [st.T1]; if (st.T2 > 0.0005) Ts.push(st.T2); Ts.push(st.Ts); return { G: R.ptn(st.Ks, Ts), txt: 'G(s) = ' + f(st.Ks, 2) + ' / [ (1 + ' + f(st.T1, 2) + ' s)' + (st.T2 > 0.0005 ? '(1 + ' + f(st.T2, 3) + ' s)' : '') + '(1 + ' + f(st.Ts, 3) + ' s) ]' }; }
    if (st.plant === 'so') return { G: R.tf([st.Kis], [st.Ts, 1, 0]), txt: 'G(s) = ' + f(st.Kis, 1) + ' / [ s (1 + ' + f(st.Ts, 3) + ' s) ]' };
    if (st.plant === 'tt') return { G: R.withDelay(R.pt1(st.K, st.T), st.Tt), txt: 'G(s) = ' + f(st.K, 2) + ' / (1 + ' + f(st.T, 2) + ' s) · e^(−' + f(st.Tt, 2) + ' s)' };
    return { G: R.ptn(st.K, [st.T, st.T, st.T]), txt: 'G(s) = ' + f(st.K, 2) + ' / (1 + ' + f(st.T, 2) + ' s)³' };
  }
  function b5methods(st, G) {
    const out = [], pid = st.ctype === 'PID', mode = st.mode === 'z' ? 'stoerung' : 'fuehrung';
    const ctl = (Kp, Tn, Tv) => (pid && Tv > 0 ? R.pidTF(Kp, Tn, Tv, Tv / 10) : R.piTF(Kp, Tn));
    if (st.plant === 'bo') {
      if (pid && st.T2 > 0.0005) { const c = R.boPID(st.Ks, st.T1, st.T2, st.Ts); out.push({ name: 'Betragsoptimum (PID, Reihenform, T1 und T2 gekürzt)', Kp: c.Kp, Tn: c.Tn, Tv: c.Tv, C: R.pidSeries(c.Kp, c.Tn, c.Tv) }); }
      else { const sum = st.Ts + (st.T2 > 0.0005 ? st.T2 : 0), c = R.boPI(st.Ks, st.T1, sum); out.push({ name: 'Betragsoptimum (PI)' + (st.T2 > 0.0005 ? ', T2 zu Tσ gezählt' : ''), Kp: c.Kp, Tn: c.Tn, Tv: 0, C: R.piTF(c.Kp, c.Tn) }); }
    }
    if (st.plant === 'so') { const c = R.soPI(st.Kis, st.Ts, 2); out.push({ name: 'Symmetrisches Optimum (PI)', Kp: c.Kp, Tn: c.Tn, Tv: 0, C: R.piTF(c.Kp, c.Tn), filt: st.filt && st.mode !== 'z' ? c.Tn : 0, pm: c.pm }); }
    let id = null; try { id = R.identifyTuTg(G); } catch (e) { id = null; }
    if (id && id.Tu > 1e-9 && id.Tg > 0) {
      const z = R.znStep(id.Ks, id.Tu, id.Tg, pid ? 'PID' : 'PI'); out.push({ name: 'Ziegler-Nichols (Sprungantwort)', Kp: z.Kp, Tn: z.Tn, Tv: z.Tv || 0, C: ctl(z.Kp, z.Tn, z.Tv || 0) });
      [0, 20].forEach(os => { const c = R.chr(id.Ks, id.Tu, id.Tg, pid ? 'PID' : 'PI', mode, os); out.push({ name: 'CHR ' + os + ' % (' + (mode === 'stoerung' ? 'Störung' : 'Führung') + ')', Kp: c.Kp, Tn: c.Tn, Tv: c.Tv || 0, C: ctl(c.Kp, c.Tn, c.Tv || 0) }); });
    }
    let u = null; try { u = R.ultimate(G); } catch (e) { u = null; }
    if (u) { const z = R.znOsc(u.Kcrit, u.Tcrit, pid ? 'PID' : 'PI'); out.unshift({ name: 'Ziegler-Nichols (Schwingversuch)', Kp: z.Kp, Tn: z.Tn, Tv: z.Tv || 0, C: ctl(z.Kp, z.Tn, z.Tv || 0) }); }
    return { list: out, id: id, u: u };
  }
  UI.reg('b5', {
    wide: true,
    enums: { plant: ['tt', 'pt3', 'bo', 'so'], ctype: ['PI', 'PID'], mode: ['w', 'z'] },
    def: { plant: 'tt', ctype: 'PID', mode: 'w', filt: true, Ks: 2, T1: 0.5, T2: 0, Ts: 0.02, Kis: 20, K: 1, T: 1, Tt: 0.2, zoom: 100 },
    left() { return [UI.canvas('c5-step', 'cv-step', 'Vergleich der Sprungantworten verschiedener Reglereinstellungen') + '<div id="c5-leg"></div>', '<div class="tblw" id="c5-tbl"></div><p class="note">Alle Regelkreise sind mit derselben Strecke gerechnet. Die Totzeit steckt als Padé-Glied 4. Ordnung im Kreis, der D-Anteil ist mit Tv/10 gefiltert. Ziegler-Nichols ist bewusst scharf eingestellt. Bei PID und Sollwertsprung unterschätzt die Padé-Näherung das Überschwingen scharfer Einstellungen (mit exakter Totzeit fällt es größer aus). Die Werte Kp, Tn, Tv von Ziegler-Nichols und CHR gelten für die Parallelform, die des Betragsoptimums für die Reihenform.</p>']; },
    controls() {
      const st = S.st.b5;
      let h = UI.select('b5', 'plant', [['tt', 'PT1 mit Totzeit (ZN, CHR)'], ['pt3', 'drei gleiche PT1 (ZN, CHR)'], ['bo', 'PT1 mit kleiner Zeitkonstante (Betragsoptimum)'], ['so', 'Integrator mit kleiner Zeitkonstante (symmetrisches Optimum)']], 'Strecke');
      if (st.plant === 'bo') h += UI.slider('b5', 'Ks', 'Streckenverstärkung Ks', { min: 0.5, max: 5, log: true, dec: 2 }) + UI.slider('b5', 'T1', 'große Zeitkonstante T1', { min: 0.1, max: 2, log: true, dec: 2, unit: 's' }) + UI.slider('b5', 'T2', 'zweite Zeitkonstante T2 (0 = keine)', { min: 0, max: 0.3, dec: 3, unit: 's', snap: 0.005 }) + UI.slider('b5', 'Ts', 'kleine Zeitkonstante Tσ', { min: 0.005, max: 0.1, log: true, dec: 3, unit: 's' });
      if (st.plant === 'so') h += UI.slider('b5', 'Kis', 'Integrierbeiwert Kis', { min: 2, max: 100, log: true, dec: 1, unit: '1/s' }) + UI.slider('b5', 'Ts', 'kleine Zeitkonstante Tσ', { min: 0.002, max: 0.05, log: true, dec: 3, unit: 's' });
      if (st.plant === 'tt') h += UI.slider('b5', 'K', 'Verstärkung K', { min: 0.5, max: 4, log: true, dec: 2 }) + UI.slider('b5', 'T', 'Zeitkonstante T', { min: 0.3, max: 3, log: true, dec: 2, unit: 's' }) + UI.slider('b5', 'Tt', 'Totzeit Tt', { min: 0.05, max: 1, log: true, dec: 2, unit: 's' });
      if (st.plant === 'pt3') h += UI.slider('b5', 'K', 'Verstärkung K', { min: 0.5, max: 4, log: true, dec: 2 }) + UI.slider('b5', 'T', 'Zeitkonstante T (je Stufe)', { min: 0.1, max: 2, log: true, dec: 2, unit: 's' });
      h += UI.seg('b5', 'ctype', [['PI', 'PI-Regler'], ['PID', 'PID-Regler']], 'Reglertyp') + UI.seg('b5', 'mode', [['w', 'Sollwertsprung'], ['z', 'Störung am Streckeneingang']], 'Betrachtung');
      if (st.plant === 'so') h += UI.chk('b5', 'filt', 'Sollwertfilter mit Tn (nur Sollwertsprung)');
      return h + UI.slider('b5', 'zoom', 'Zeitausschnitt', { min: 5, max: 100, log: true, dec: 0, unit: '%', snap: 1 });
    },
    update() {
      const st = S.st.b5, P = b5plant(st), M = b5methods(st, P.G);
      const mode = st.mode === 'z' ? 'z' : 'w';
      const sims = M.list.map(m => {
        const T = mode === 'z' ? R.feedbackZ(P.G, m.C, 4) : R.feedbackW(P.G, m.C, 4);
        const Tf = (mode === 'w' && m.filt) ? R.tfMul(T, R.tf([1], [m.filt, 1])) : T;
        const cl = R.stabilityOf(Tf), hz = R.autoHorizon(Tf);
        return { m: m, T: Tf, st: cl.cls, hz: hz, stable: cl.cls === 'stabil' };
      });
      const hzs = sims.filter(s => s.stable).map(s => s.hz); let H = hzs.length ? Math.max(...hzs) * 1.1 : 10;
      if (hzs.length) H = Math.min(H, 30 * Math.min(...hzs));
      const tEnd = Math.max(1e-3, H * st.zoom / 100);
      const series = [], leg = [], rows = [];
      sims.forEach((s, i) => {
        const r = R.stepResponse(s.T, { tEnd: tEnd, n: 1600 }), c = UI.cleanBlow(r, mode === 'z' ? 50 : 5);
        series.push({ t: c.t, y: c.y, ci: i % 6 });
        leg.push({ color: 'var(--c' + (i % 6) + ')', label: s.m.name, dash: [0, 1, 2, 3, 0, 1][i % 6] });
        const rr = R.stepResponse(s.T, { tEnd: H, n: 2500 });
        let info = null, extra;
        if (mode === 'w') { info = R.stepInfo(rr, { yFinal: s.stable ? R.dcGain(s.T) : undefined }); extra = [s.stable ? f(info.overshootPct, 1) + ' %' : '–', s.stable && info.tRise != null ? UI.fmtT(info.tRise) : '–', s.stable && info.tSettle5 != null ? UI.fmtT(info.tSettle5) : '–', s.stable ? f(R.iae(rr, 1), 3) : '–']; }
        else { const pk = rr.y.reduce((mm, v) => (Math.abs(v) > Math.abs(mm) ? v : mm), 0); extra = [s.stable ? f(Math.abs(pk), 3) : '–', s.stable ? f(R.iae(rr, 0), 3) : '–']; }
        rows.push('<tr><td><span class="sw" style="background:var(--c' + (i % 6) + ')"></span>' + esc(s.m.name) + '</td><td>' + f(s.m.Kp, 3) + '</td><td>' + (s.m.Tn ? UI.fmtT(s.m.Tn) : '–') + '</td><td>' + (s.m.Tv ? UI.fmtT(s.m.Tv) : '–') + '</td>' + (s.stable ? '' : '<td colspan="' + extra.length + '" style="text-align:left"><span class="bad err">instabil</span></td>') + (s.stable ? extra.map(x => '<td>' + x + '</td>').join('') : '') + '</tr>');
      });
      const ys = []; series.forEach(s => s.y.forEach(v => { if (isFinite(v)) ys.push(v); }));
      UI.draw('c5-step', (ctx, W, H2, pal) => V.drawStep(ctx, W, H2, pal, { series: series, yFinal: mode === 'w' ? 1 : null, band: mode === 'w' ? 0.05 : 0, yClip: mode === 'w' ? [-0.5, 2.5] : [-3, 3], xLabel: 't in s', yLabel: mode === 'w' ? 'Regelgröße (Sollwert 1)' : 'Regelgröße bei Störsprung 1' }));
      UI.hover('c5-step', (px, py, P2) => P2.inside(px, py) ? 't = ' + f(P2.invX(px), 3) + ' s, y = ' + f(P2.invY(py), 3) : '');
      const el = $('#c5-leg'); if (el) el.innerHTML = UI.legend(leg);
      const tbl = $('#c5-tbl');
      const head = mode === 'w' ? '<th>Überschw.</th><th>T_an</th><th>T_aus 5 %</th><th>IAE</th>' : '<th>Spitze</th><th>IAE</th>';
      if (tbl) tbl.innerHTML = '<table class="tb"><thead><tr><th>Verfahren</th><th>Kp</th><th>Tn</th><th>Tv</th>' + head + '</tr></thead><tbody>' + (rows.join('') || '<tr><td colspan="8">Für diese Strecke gibt es hier kein Verfahren (siehe Hinweis).</td></tr>') + '</tbody></table>';
      const notes = [];
      if (M.id) notes.push('Wendetangente: Ks = ' + f(M.id.Ks, 2) + ', Tu = ' + UI.fmtT(M.id.Tu) + ', Tg = ' + UI.fmtT(M.id.Tg) + ' (Tg/Tu = ' + f(M.id.Tg / M.id.Tu, 1) + '; die Regeln gelten für etwa 3 bis 10).');
      if (M.u) notes.push('Schwingversuch: K_krit = ' + f(M.u.Kcrit, 2) + ', T_krit = ' + UI.fmtT(M.u.Tcrit) + '.');
      if (!M.u && st.plant !== 'so') notes.push('Schwingversuch nicht möglich: Der Kreis erreicht mit P-Regler nie −180° Phase.');
      if (st.plant === 'so') notes.push('Das symmetrische Optimum setzt Tn = 4·Tσ und Kp = 1/(2·Kis·Tσ). Phasenreserve des offenen Kreises: ' + f(R.soPI(st.Kis, st.Ts, 2).pm, 1) + '°. Ziegler-Nichols und CHR brauchen eine Strecke mit Ausgleich und entfallen hier.');
      if (st.plant === 'bo') notes.push('Betragsoptimum: Tn = T1 kürzt die große Zeitkonstante, Kp = T1/(2·Ks·Tσ). Das gibt 4,3 % Überschwingen und etwa 4,7·Tσ Anregelzeit. Ziegler-Nichols und CHR sind für diese Strecke sehr scharf (Tu klein).');
      set('b5', '<div class="eq">' + esc(P.txt) + '</div>' + notes.map(n => '<p class="note">' + esc(n) + '</p>').join('') + '<p class="note">IAE = Regelfläche (Integral des Betrags der Regeldifferenz), je kleiner desto besser. Zeitausschnitt kürzt die Zeitachse, um schnelle Verfahren genauer zu sehen.</p>');
    }
  });

  /* ===================================================================== Block 6: Digitale Regelung */
  function b6plant(st) {
    if (st.plant === 'pt1') return { G: R.pt1(st.K, st.T), txt: 'G(s) = ' + f(st.K, 2) + ' / (1 + ' + f(st.T, 2) + ' s)' };
    if (st.plant === 'it1') return { G: R.tf([st.K], [st.T, 1, 0]), txt: 'G(s) = ' + f(st.K, 2) + ' / [ s (1 + ' + f(st.T, 2) + ' s) ]' };
    return { G: R.pt2(st.K, st.w0, st.D), txt: 'G(s) = ' + f(st.K * st.w0 * st.w0, 2) + ' / (s² + ' + f(2 * st.D * st.w0, 2) + ' s + ' + f(st.w0 * st.w0, 2) + ')' };
  }
  const polyTxt = (p, v) => { const n = p.length - 1; return p.map((c, i) => { const e = n - i; return (i === 0 ? (c < 0 ? '−' : '') : (c < 0 ? ' − ' : ' + ')) + f(Math.abs(c), 4) + (e === 0 ? '' : e === 1 ? '·' + v : '·' + v + '^' + e); }).join(''); };
  UI.reg('b6', {
    enums: { plant: ['pt1', 'it1', 'pt2'], ctype: ['P', 'PI'] },
    def: { plant: 'pt1', K: 1, T: 0.3, w0: 8, D: 0.4, ctype: 'PI', Kp: 3, Tn: 0.3, TsMs: 20, d: 1 },
    left() { return [UI.canvas('c6-step', 'cv-step', 'Sprungantwort: kontinuierlicher und digitaler Regelkreis') + '<div id="c6-leg"></div>', '<div class="cvrow two"><div>' + UI.canvas('c6-bode', 'cv-bode', 'Bode-Diagramm des offenen Kreises, kontinuierlich und mit Abtastverzögerung') + '</div><div>' + UI.canvas('c6-z', 'cv-pz', 'Pole des geschlossenen digitalen Kreises in der z-Ebene mit Einheitskreis') + '</div></div><p class="note">Oben: durchgezogen der kontinuierliche Regelkreis, Stufen und Punkte der digitale Kreis an den Abtastzeitpunkten. Unten links: Bode mit und ohne Abtastverzug (gestrichelt). Unten rechts: z-Ebene mit Einheitskreis, Pole außerhalb oder auf dem Kreis (rot) sind instabil.</p>']; },
    controls() {
      const st = S.st.b6;
      let h = UI.select('b6', 'plant', [['pt1', 'PT1'], ['it1', 'Integrator + PT1'], ['pt2', 'PT2 (schwingungsfähig)']], 'Strecke');
      if (st.plant === 'pt1') h += UI.slider('b6', 'K', 'Verstärkung K', { min: 0.5, max: 4, log: true, dec: 2 }) + UI.slider('b6', 'T', 'Zeitkonstante T', { min: 0.05, max: 2, log: true, dec: 2, unit: 's' });
      if (st.plant === 'it1') h += UI.slider('b6', 'K', 'Integrierbeiwert K', { min: 0.5, max: 20, log: true, dec: 2, unit: '1/s' }) + UI.slider('b6', 'T', 'Zeitkonstante T', { min: 0.02, max: 1, log: true, dec: 2, unit: 's' });
      if (st.plant === 'pt2') h += UI.slider('b6', 'K', 'Verstärkung K', { min: 0.5, max: 4, log: true, dec: 2 }) + UI.slider('b6', 'w0', 'Kennkreisfrequenz ω0', { min: 1, max: 40, log: true, dec: 1, unit: '1/s' }) + UI.slider('b6', 'D', 'Dämpfung D', { min: 0.1, max: 1.5, dec: 2, snap: 0.01 });
      h += UI.seg('b6', 'ctype', [['P', 'P-Regler'], ['PI', 'PI-Regler']], 'Regler') + UI.slider('b6', 'Kp', 'Reglerverstärkung Kp', { min: 0.1, max: 60, log: true, dec: 2 });
      if (st.ctype === 'PI') h += UI.slider('b6', 'Tn', 'Nachstellzeit Tn', { min: 0.05, max: 3, log: true, dec: 2, unit: 's' });
      h += UI.slider('b6', 'TsMs', 'Abtastzeit Ts', { min: 1, max: 500, log: true, dec: 1, unit: 'ms' }) + UI.seg('b6', 'd', [[0, 'ohne Rechenverzug'], [1, '1 Takt Rechenverzug']], 'Rechenverzug');
      return h;
    },
    update() {
      const st = S.st.b6, P = b6plant(st), G = P.G, Ts = st.TsMs / 1000, d = st.d;
      const Cs = st.ctype === 'PI' ? R.piTF(st.Kp, st.Tn) : R.tf([st.Kp], [1]);
      const Lc = R.tfMul(Cs, G), mc = R.margins(Lc), Tc = R.feedbackW(G, Cs), clc = R.stabilityOf(Tc);
      const Gz = R.c2dZOH(G, Ts, d), Cz = st.ctype === 'PI' ? R.piDigital(st.Kp, st.Tn, Ts, 'rueckwaerts') : { num: [st.Kp], den: [1] };
      const Tz = R.dClosed(Gz, Cz), zs = R.zStability(Tz.den);
      const Lz = { num: R.pmul(Gz.num, Cz.num), den: R.pmul(Gz.den, Cz.den) };
      const Teff = Ts / 2 + d * Ts, ap = finite(mc.wc) ? R.pmWithDelay(Lc, Teff) : null, ex = R.marginsZ(Lz.num, Lz.den, Ts);
      // Zeitachse: Dauer des kontinuierlichen Kreises
      let tEnd = clc.cls === 'stabil' ? R.autoHorizon(Tc) : 10 * (st.plant === 'pt2' ? 1 / st.w0 : st.T) + 1; tEnd = Math.max(tEnd, 20 * Ts); const N = Math.min(3000, Math.ceil(tEnd / Ts));
      tEnd = Math.min(tEnd, 3000 * Ts);
      const rc = R.stepResponse(Tc, { tEnd: tEnd, n: 1500 }), cc = UI.cleanBlow(rc, 5);
      const yz = R.dstep(Tz.num, Tz.den, N + 1), tz = yz.map((_, k) => k * Ts), zc = UI.cleanBlow({ t: tz, y: yz }, 5);
      const dcT = R.dcGain(Tc), yF = clc.cls === 'stabil' && finite(dcT) ? dcT : null;
      UI.draw('c6-step', (ctx, W, H, pal) => V.drawStep(ctx, W, H, pal, { series: [{ t: cc.t, y: cc.y, ci: 0 }, { t: zc.t, y: zc.y, ci: 1, stairs: true, dots: zc.t.length < 90 }], yFinal: yF, band: 0.05, yClip: [-5, 5], xLabel: 't in s', tMax: tEnd }));
      UI.hover('c6-step', (px, py, P2) => P2.inside(px, py) ? 't = ' + f(P2.invX(px), 3) + ' s, y = ' + f(P2.invY(py), 3) : '');
      $('#c6-leg').innerHTML = UI.legend([{ color: 'var(--c0)', label: 'kontinuierlicher Regelkreis', dash: 0 }, { color: 'var(--c1)', label: 'digitaler Kreis (Abtastwerte)', dash: 1 }]);
      const pz = zs.poles;
      UI.draw('c6-z', (ctx, W, H, pal) => V.drawPZ(ctx, W, H, pal, { poles: pz, plane: 'z', range: [-1.6, 1.6, -1.6, 1.6] }));
      const F = R.factors(Lc), bd = R.bode(Lc, { F: F, n: 400 });
      const back = bd.ph.map((p, i) => p - bd.w[i] * Teff * DEG);
      UI.draw('c6-bode', (ctx, W, H, pal) => V.drawBode(ctx, W, H, pal, { w: bd.w, db: bd.db, ph: bd.ph, phBack: back, wc: mc.wc, pm: mc.pm, corners: [], phStep: 90 }));
      const stz = zs.cls, rows = [['Strecke', '<span style="font-weight:500">' + esc(P.txt) + '</span>'], ['ω_D (kontinuierlich)', finite(mc.wc) ? f(mc.wc, 2) + ' 1/s' : 'kein Durchtritt'], ['ω_D · Ts', finite(mc.wc) ? f(mc.wc * Ts, 3) : '–'], ['φ_R kontinuierlich', finite(mc.pm) ? f(mc.pm, 1) + '°' : '–'], ['Ersatztotzeit Ts/2 + d·Ts', UI.fmtT(Teff)], ['φ_R digital (Näherung)', ap ? f(ap.pm, 1) + '°  (Verlust ' + f(ap.loss, 1) + '°)' : '–'], ['φ_R digital (exakt im z-Bereich)', ex ? f(ex.pm, 1) + '°' : '–'], ['Kontinuierlicher Kreis', UI.badge(clc.cls)], ['Digitaler Kreis (Pole in z)', UI.badge(stz)], ['größter Betrag der Pole |z|', f(zs.maxAbs, 4)]];
      let html = UI.kv(rows);
      if (finite(mc.wc) && mc.wc * Ts > 0.3) html += '<p class="note">ω_D·Ts ist groß (über 0,3): Die Abtastung ist zu langsam für diese Durchtrittsfrequenz, die Näherung wird ungenau.</p>';
      // z-Transformation Einstieg
      const polePairs = R.roots(G.den).map(s => ({ s: s, z: R.sToZ(s, Ts) })).filter((p, i, a) => !(p.s.im < 0));
      html += '<h3>z-Transformation im Kleinen</h3><p class="note">Die Pole der Strecke wandern mit z = e^(s·Ts) in die z-Ebene. Innerhalb des Einheitskreises bleibt es stabil.</p><div class="tblw"><table class="tb"><thead><tr><th>Pol s</th><th>Pol z</th><th>|z|</th></tr></thead><tbody>' +
        polePairs.map(p => '<tr><td>' + esc(UI.rootsText([p.s].concat(p.s.im ? [{ re: p.s.re, im: -p.s.im }] : []))[0]) + '</td><td>' + (Math.abs(p.z.im) < 1e-9 ? f(p.z.re, 4) : f(p.z.re, 3) + ' ± j ' + f(Math.abs(p.z.im), 3)) + '</td><td>' + f(R.cabs(p.z), 4) + '</td></tr>').join('') + '</tbody></table></div>';
      html += '<p class="note">Pulsübertragungsfunktion der Strecke mit Halteglied' + (d ? ' und ' + d + ' Takt Verzug' : '') + ':</p><div class="eq">G(z) = (' + esc(polyTxt(Gz.num, 'z')) + ')\n       / (' + esc(polyTxt(Gz.den, 'z')) + ')</div>';
      if (st.plant === 'pt1' && !d) html += '<p class="note">Zugehörige Differenzengleichung: y[k] = a·y[k−1] + b·u[k−1] mit a = ' + f(-Gz.den[1], 4) + ' = e^(−Ts/T) und b = ' + f(Gz.num[0], 4) + '.</p>';
      set('b6', html);
    }
  });

  UI.start();
})(typeof self !== 'undefined' ? self : this);
