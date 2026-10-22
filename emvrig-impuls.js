/* emvrig-impuls.js - EMV-Lab, Prüfstand `esd` (ESD, Burst und Surge mit Schutzbauteilen und Bewertungskriterien A/B/C), Paket WP2c.
 *
 * Laden: im Browser NACH emvcore.js, emvcore-lay.js, emvdraw.js und emvrig-base.js; in Node holt sich die Datei Kern und Basis per require.
 * Fehlt die Basis oder EMV_CORE.pulse/protect/device (emvcore-lay.js), meldet sie console.warn und registriert nichts.
 * Übungsanlage: Impulse, Schutzbauteile und Gerät sind Übungswerte (Übungsimpuls nach Vorbild der Prüfnorm), keine Vorhersage eines echten Geräts.
 * Herstellerdokumentation und aktuelle Norm maßgeblich. EMV-Maßnahmen ersetzen keine Schutzmaßnahmen.
 *
 * Schnittstelle: SPEC 5.0 und 5.7. Bis `fire()` ausgelöst wurde, ist die Ampel grau („Noch keine Entladung ausgelöst“). Nach `fire()` rechnen die
 * Messgeräte live weiter (jede Änderung eines Steuerwerts wirkt sofort auf Spitzenwerte und Kriterium); `fire()` startet die Zeitlupe neu.
 * Zeitlupe (ESD): 1 ns entspricht 0,1 s Anzeigezeit bei Faktor 1 (Steuerwert `slow`). Mit `reduced` entfällt der Funke, es bleibt ein Symbol.
 * Die Rechnung steckt vollständig in EMV_CORE (pulse, protect, device); dieser Prüfstand baut nur die Konfiguration, zeigt Ergebnisse und zeichnet.
 */
(function (root) {
  'use strict';
  const R = root.EMV_RIGS = root.EMV_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };
  if (typeof module !== 'undefined') module.exports = R;

  function tryRequire(n) { try { return typeof require === 'function' ? require(n) : null; } catch (e) { return null; } }
  if (!R.base) tryRequire('./emvrig-base.js');
  const B = R.base;
  if (!B) { if (typeof console !== 'undefined') console.warn('emvrig-impuls.js: emvrig-base.js fehlt - Prüfstand esd nicht registriert.'); return; }
  if (!root.EMV_CORE || !root.EMV_CORE.pulse) { tryRequire('./emvcore.js'); tryRequire('./emvcore-lay.js'); }
  const CORE0 = root.EMV_CORE;
  if (!CORE0 || !CORE0.pulse || !CORE0.protect || !CORE0.device || typeof CORE0.device.verdict !== 'function') {
    if (typeof console !== 'undefined') console.warn('emvrig-impuls.js: EMV_CORE.pulse/protect/device (emvcore-lay.js) fehlt - Prüfstand esd nicht registriert.');
    return;
  }

  const { clamp, num, isNum, fm, fn, eng, gfx, okv } = B;
  const LEVEL = { esdk: [2, 4, 6, 8], esdl: [2, 4, 8, 15], burst: [0.5, 1, 2, 4], surge: [0.5, 1, 2, 4] };
  const ORTS = { esdk: ['io', 'gehaeuse'], esdl: ['io', 'gehaeuse'], burst: ['io', 'netzln', 'netzlpe'], surge: ['netzln', 'netzlpe'] };
  const ORT_DEFAULT = { esdk: 'io', esdl: 'io', burst: 'io', surge: 'netzln' };
  const PRUEF_NAME = { esdk: 'ESD Kontakt', esdl: 'ESD Luft', burst: 'Burst', surge: 'Surge' };
  const ORT_NAME = { io: 'Stecker-Pin', gehaeuse: 'Gehäuse', netzln: 'Netz L–N', netzlpe: 'Netz L–PE' };
  const LG = { g360: 5e-9, g50: 50e-9, lose: 500e-9 };      // Masseverbindung Gehäuse (SPEC 4.8)
  const MASSE_NAME = { g360: '360°-Verbindung (5 nH)', g50: 'Leitung (50 nH)', lose: 'lose (500 nH)' };
  const KRIT = ['A', 'B', 'C', 'Ausfall'];
  const TVS_IDS = ['tvs3', 'tvs5', 'tvs12', 'tvs24'], VAR_IDS = ['v230', 'v275', 'v320'];
  const levelOf = (pr, kv) => { const l = LEVEL[pr] || LEVEL.esdk; let best = l[0]; l.forEach(v => { if (Math.abs(v - kv) < Math.abs(best - kv)) best = v; }); return best; };
  const kvLabel = v => fn(v, 1) + ' kV';

  const TX = {
    info: 'Übungsgerät (Controllerplatine im Gehäuse) mit Stecker-Pin, Netzanschluss und Reset-Leitung. Ein Prüfgenerator löst ESD (Kontakt und Luft), Burst oder Surge aus; du wählst den Einkoppelort, die Gehäuseanbindung und das Schutzbauteil und liest das Bewertungskriterium A, B oder C bzw. „Ausfall“ ab. Übungsimpuls nach Vorbild der Prüfnorm, Übungsanlage: Die Zahlen sind Übungswerte. Herstellerdokumentation und aktuelle Norm maßgeblich. EMV-Maßnahmen ersetzen keine Schutzmaßnahmen.',
    grau: 'Noch keine Entladung ausgelöst.',
    ausfall: (x, y) => 'Spitze am Eingang ' + fm(x, 1) + ' V, höchstzulässig ' + fm(y, 1) + ' V: Das Bauteil wird zerstört.',
    ausfallE: (x, y) => 'Das Schutzbauteil nimmt ' + fm(x, 2) + ' mJ auf (Grenze ' + fm(y, 2) + ' mJ): Es wird überlastet.',
    reset: (x, y) => 'Der Reset-Pegel fiel ' + fm(x, 0) + ' ns unter ' + fm(y, 2) + ' V: Das Gerät startet neu (Kriterium B).',
    treppe: (n, x, tau) => 'Die Impulse addieren sich: nach ' + n + ' Impulsen ' + fm(x, 1) + ' V (τ = ' + fm(tau * 1e6, 1) + ' µs).',
    varDauer: x => 'Dauerspannung 253 V über Vac,max ' + fm(x, 0) + ' V: Der Varistor wird warm und altert.',
    varEnergie: (x, y) => 'Der Varistor nimmt ' + fm(x, 2) + ' J auf (Grenze ' + fm(y, 0) + ' J).',
    glitch: (x, y) => 'Datenfehler: Der Eingang lag ' + fm(x, 0) + ' ns über ' + fm(y, 2) + ' V.',
    ortFix: (pr, ort) => PRUEF_NAME[pr] + ' wird hier am Ort „' + ORT_NAME[ort] + '“ eingekoppelt.',
    help: {
      pruef: 'Prüfart: ESD Kontakt (Entladung auf das Gerät), ESD Luft (Funke über eine Luftstrecke), Burst (schnelle Impulsfolge) oder Surge (Energie eines Blitz- oder Schaltstoßes).',
      kv: 'Prüfpegel in kV. Die Stufen hängen von der Prüfart ab (ESD Kontakt 2/4/6/8, Luft 2/4/8/15, Burst und Surge 0,5/1/2/4). Übungsstufen.',
      ort: 'Einkoppelort des Impulses: Stecker-Pin, Gehäuse oder Netz (L–N bzw. L–PE). Nicht jeder Ort passt zu jeder Prüfart; der Prüfstand wählt dann den passenden Ort.',
      masse: 'Anbindung des Gehäuses an die Masse: 360°-Verbindung (5 nH), Leitung (50 nH) oder lose (500 nH). Der Masseversatz L·di/dt wächst mit der Induktivität.',
      schutz: 'Schutz am Eingang: keiner, RC-Glied (Reihenwiderstand mit Puffer-C), TVS-Diode, TVS mit Reihenwiderstand oder Varistor am Netzeingang.',
      tvs: 'TVS-Diode: Der Typ nennt die Spannungsklasse (3, 5, 12 oder 24 V). Eine höhere Durchbruchspannung schützt den Eingang weniger.',
      rs: 'Reihenwiderstand zwischen Stecker und Controller-Eingang: begrenzt den Strom in den Eingang, braucht aber Platz zum Spannungsabfall.',
      cbuf: 'Puffer-Kondensator am Pin: nimmt Ladung auf und glättet die Spitze, verlangsamt aber das Signal.',
      var: 'Varistor am Netzeingang: Die Dauerspannung 253 V (230 V plus 10 %) muss unter Vac,max liegen, sonst wird er warm und altert.',
      frep: 'Wiederholrate der Einzelimpulse im Burst: 5 kHz oder 100 kHz (75 Impulse je Burst).',
      fire: 'Löst den Impuls aus (Zeitlupe). Bis dahin ist die Ampel grau.',
      slow: 'Zeitlupe-Faktor der Animation: Bei 1 entspricht 1 ns ESD-Verlauf 0,1 s Anzeigezeit.'
    }
  };

  const CONTROLS = [
    { key: 'pruef', label: 'Prüfart', type: 'select', value: 'esdk', options: [{ value: 'esdk', label: 'ESD Kontakt' }, { value: 'esdl', label: 'ESD Luft' }, { value: 'burst', label: 'Burst' }, { value: 'surge', label: 'Surge' }], group: 'Prüfgenerator', lever: 'quelle', help: TX.help.pruef },
    { key: 'kv', label: 'Prüfpegel', type: 'select', value: 4, options: [0.5, 1, 2, 4, 6, 8, 15].map(v => ({ value: v, label: kvLabel(v) })), optionsOf: s => (LEVEL[(s && s.pruef) || 'esdk'] || LEVEL.esdk).map(v => ({ value: v, label: kvLabel(v) })), unit: 'kV', group: 'Prüfgenerator', lever: 'quelle', help: TX.help.kv },
    { key: 'frep', label: 'Burst-Wiederholrate', type: 'select', value: 5000, options: [{ value: 5000, label: '5 kHz' }, { value: 100000, label: '100 kHz' }], unit: 'Hz', group: 'Prüfgenerator', lever: 'quelle', visible: s => !!s && s.pruef === 'burst', help: TX.help.frep },
    { key: 'ort', label: 'Einkoppelort', type: 'select', value: 'io', options: [{ value: 'io', label: 'Stecker-Pin' }, { value: 'gehaeuse', label: 'Gehäuse' }, { value: 'netzln', label: 'Netz L–N' }, { value: 'netzlpe', label: 'Netz L–PE' }], optionsOf: s => (ORTS[(s && s.pruef) || 'esdk'] || ORTS.esdk).map(o => ({ value: o, label: ORT_NAME[o] })), group: 'Weg zum Gerät', lever: 'pfad', help: TX.help.ort },
    { key: 'masse', label: 'Gehäuseanbindung', type: 'select', value: 'g50', options: [{ value: 'g360', label: MASSE_NAME.g360 }, { value: 'g50', label: MASSE_NAME.g50 }, { value: 'lose', label: MASSE_NAME.lose }], group: 'Weg zum Gerät', lever: 'pfad', help: TX.help.masse },
    { key: 'schutz', label: 'Schutz', type: 'select', value: 'kein', options: [{ value: 'kein', label: 'kein Schutz' }, { value: 'rc', label: 'RC-Glied (Reihenwiderstand und Puffer-C)' }, { value: 'tvs', label: 'TVS-Diode' }, { value: 'tvsrs', label: 'TVS mit Reihenwiderstand' }, { value: 'varistor', label: 'Varistor am Netzeingang' }], group: 'Schutz', lever: 'senke', help: TX.help.schutz },
    { key: 'tvs', label: 'TVS-Typ', type: 'select', value: 'tvs5', options: TVS_IDS.map(v => ({ value: v, label: v.replace('tvs', 'TVS ') + ' V' })), group: 'Schutz', lever: 'senke', visible: s => !!s && (s.schutz === 'tvs' || s.schutz === 'tvsrs'), help: TX.help.tvs },
    { key: 'rs', label: 'Reihenwiderstand Rs', type: 'slider', scale: 'log', unitKind: 'res', min: 1, max: 1000, step: 1, unit: 'Ω', value: 100, group: 'Schutz', lever: 'senke', visible: s => !!s && (s.schutz === 'rc' || s.schutz === 'tvsrs'), help: TX.help.rs },
    { key: 'cbuf', label: 'Puffer-C am Pin', type: 'slider', scale: 'log', unitKind: 'cap', min: 1e-10, max: 1e-7, step: 1e-10, unit: 'F', value: 1e-8, group: 'Schutz', lever: 'senke', visible: s => !!s && s.schutz === 'rc', help: TX.help.cbuf },
    { key: 'var', label: 'Varistor', type: 'select', value: 'v275', options: VAR_IDS.map(v => ({ value: v, label: v.replace('v', 'V') + ' V' })), group: 'Schutz', lever: 'senke', visible: s => !!s && s.schutz === 'varistor', help: TX.help.var },
    { key: 'slow', label: 'Zeitlupe-Faktor', type: 'slider', scale: 'log', min: 0.25, max: 4, step: 0.05, unit: '', value: 1, group: 'Anzeige und Vorgaben', lever: null, help: TX.help.slow },
    { key: 'fire', label: 'Auslösen', type: 'button', group: 'Prüfgenerator', lever: null, help: TX.help.fire }
  ];
  const METERS = [
    { key: 'vq', label: 'Spitze am Controller', unit: 'V', digits: 1, min: 0, max: 100 },
    { key: 'vp', label: 'Spitze am Pin bzw. Gehäuse', unit: 'V', digits: 1, min: 0, max: 100 },
    { key: 'ip', label: 'Entladestrom (Spitze)', unit: 'A', digits: 1, min: 0, max: 100 },
    { key: 'wTvs', label: 'Energie im TVS', unit: 'mJ', digits: 3, min: 0, max: 1 },
    { key: 'wVar', label: 'Energie im Varistor', unit: 'J', digits: 2, min: 0, max: 100 },
    { key: 'nReset', label: 'Resets', unit: '', digits: 0, min: 0, max: 5 },
    { key: 'nGlitch', label: 'Datenfehler', unit: '', digits: 0, min: 0, max: 75 },
    { key: 'kriterium', label: 'Bewertungskriterium (0 = A, 1 = B, 2 = C, 3 = Ausfall)', unit: '', digits: 0, min: 0, max: 3, names: KRIT }
  ];
  const PRESETS = [
    { id: 'ohne', name: 'ESD ohne Schutz', params: { pruef: 'esdk', kv: 4, ort: 'io', masse: 'g50', schutz: 'kein' } },
    { id: 'esd-tvs', name: 'ESD mit TVS und Reihenwiderstand', params: { pruef: 'esdk', kv: 4, ort: 'io', masse: 'g360', schutz: 'tvsrs', tvs: 'tvs5', rs: 100 } },
    { id: 'burst-reset', name: 'Burst auf die Signalleitung', params: { pruef: 'burst', kv: 2, frep: 5000, ort: 'io', masse: 'g50', schutz: 'kein' } },
    { id: 'surge-var', name: 'Surge mit Varistor', params: { pruef: 'surge', kv: 2, ort: 'netzln', masse: 'g50', schutz: 'varistor', var: 'v275' } },
    { id: 'gehaeuse-lose', name: 'ESD aufs Gehäuse, lose Masse', params: { pruef: 'esdk', kv: 4, ort: 'gehaeuse', masse: 'lose', schutz: 'kein' } }
  ];

  // ---------------------------------------------------------------------------------------------------- Hilfen
  const arr = (o, ...names) => { for (const n of names) { const a = o && o[n]; if (a && typeof a.length === 'number' && typeof a !== 'string') return a; } return null; };
  const maxOf = a => { let m = -Infinity; if (a) for (let k = 0; k < a.length; k++) if (a[k] > m) m = a[k]; return isFinite(m) ? m : 0; };
  const absMax = a => { let m = 0; if (a) for (let k = 0; k < a.length; k++) { const v = Math.abs(a[k]); if (v > m) m = v; } return m; };
  function longest(t, y, test) {   // längster zusammenhängender Zeitraum, in dem test(y) gilt, und Anzahl der Zeiträume
    let best = 0, n = 0, inRun = false, t0 = 0;
    for (let k = 0; k < y.length; k++) {
      if (test(y[k])) { if (!inRun) { inRun = true; t0 = t[k]; n++; } best = Math.max(best, (k + 1 < y.length ? t[k + 1] : t[k]) - t0); } else inRun = false;
    }
    return { best: best, n: n };
  }
  function interp(t, y, x) {   // lineare Interpolation (t aufsteigend)
    const n = t.length; if (!n) return 0; if (x <= t[0]) return y[0]; if (x >= t[n - 1]) return y[n - 1];
    let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (t[m] <= x) lo = m; else hi = m; }
    const d = t[hi] - t[lo] || 1; return y[lo] + (y[hi] - y[lo]) * (x - t[lo]) / d;
  }
  function share(total, fr) {
    const s = fr.reduce((a, b) => a + b, 0) || 1, ex = fr.map(f => f / s * total), out = ex.map(Math.floor); let rest = total - out.reduce((a, b) => a + b, 0);
    const ord = ex.map((e, i) => [e - Math.floor(e), i]).sort((a, b) => b[0] - a[0]);
    for (let i = 0; rest > 0 && i < ord.length; i++, rest--) out[ord[i][1]]++;
    return out;
  }
  function makePool(max, seed) {
    const pool = { max: max, n: 0, path: new Int16Array(max), u: new Float32Array(max), paths: [], cnt: [] };
    const rnd = B.mulberry32(seed || 1);
    pool.setPaths = function (paths) {
      pool.paths = paths.map(p => {
        const pts = (p.pts && p.pts.length > 1 ? p.pts : [[0, 0], [1, 0]]).filter(q => okv(q[0], q[1])), cum = [0];
        for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
        return { pts: pts, cum: cum, len: cum[cum.length - 1] || 1, color: p.color, dir: 1, speed: p.speed || 30, key: p.key };
      });
      pool.cnt = pool.paths.map(() => 0);
    };
    pool.assign = function (counts) {
      let k = 0; pool.cnt = pool.paths.map(() => 0);
      for (let p = 0; p < pool.paths.length; p++) { const c = Math.max(0, Math.floor(counts[p] || 0)); for (let j = 0; j < c && k < pool.max; j++, k++) { pool.path[k] = p; pool.u[k] = ((j + 0.5) / c + 0.2 * (rnd() - 0.5) / Math.max(1, c)) % 1; pool.cnt[p]++; } }
      pool.n = k;
    };
    pool.step = function (dtS, f) { for (let i = 0; i < pool.n; i++) { const p = pool.paths[pool.path[i]]; let u = pool.u[i] + p.speed * f * dtS / p.len; u -= Math.floor(u); pool.u[i] = u; } };
    pool.pos = function (p, u, out) {
      const P0 = pool.paths[p], d = u * P0.len, c = P0.cum; let lo = 0, hi = c.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m] <= d) lo = m; else hi = m; }
      const seg = (c[hi] - c[lo]) || 1, f = (d - c[lo]) / seg, a = P0.pts[lo], b = P0.pts[hi];
      out[0] = a[0] + (b[0] - a[0]) * f; out[1] = a[1] + (b[1] - a[1]) * f; out[2] = (b[0] - a[0]) / seg; out[3] = (b[1] - a[1]) / seg;
    };
    return pool;
  }

  // ---------------------------------------------------------------------------------------------------- Rechnung
  // Steuerwerte -> Konfiguration von EMV_CORE.protect.* (SPEC 4.8); Ergebnis und Kriterium kommen vollständig aus dem Kern.
  // burstIo entspricht den Vorgaben von protect.burstLine (rin 100 kΩ, cin 10 pF); burstNetz ist eine niederohmige Netzleitung (A).
  const PARAMS = { burstIo: { rin: 100e3, cin: 10e-12 }, burstNetz: { rin: 1e3, cin: 100e-12 }, cc: 100e-12 };
  function effective(ctl) {
    const pr = LEVEL[ctl.pruef] ? ctl.pruef : 'esdk', kv = levelOf(pr, ctl.kv);
    const ort = ORTS[pr].includes(ctl.ort) ? ctl.ort : ORT_DEFAULT[pr];
    return { pr: pr, kv: kv, ort: ort, kind: pr === 'burst' ? 'burst' : pr === 'surge' ? 'surge' : ort === 'gehaeuse' ? 'bounce' : 'esdio' };
  }
  function protOf(ctl, kind) {   // Schutzkonfiguration aus dem Steuerwert `schutz` (je nach Prüfart wirksam)
    const s = ctl.schutz, o = { tvs: null, rs: 0, cbuf: 0, varistor: null };
    if (kind === 'surge') { if (s === 'varistor') o.varistor = ctl.var; return o; }
    if (s === 'rc') { o.rs = ctl.rs; o.cbuf = ctl.cbuf; } else if (s === 'tvs') o.tvs = ctl.tvs; else if (s === 'tvsrs') { o.tvs = ctl.tvs; o.rs = ctl.rs; }
    return o;
  }
  const VERDICT_KIND = { esdio: 'esd', bounce: 'bounce', burst: 'burst', surge: 'surge' };
  function compute(ctl, params, CORE) {
    const ef = effective(ctl), P = CORE.protect, D = CORE.device, pr = protOf(ctl, ef.kind);
    const out = { ok: false, eff: ef, kind: ef.kind, prot: pr, m: { vq: 0, vp: 0, ip: 0, wTvs: 0, wVar: 0, nReset: 0, nGlitch: 0, kriterium: 0 } };
    let sim = null, cfg = null;
    try {
      if (ef.kind === 'esdio') { cfg = { kV: ef.kv, tvs: pr.tvs, rs: pr.rs, cbuf: pr.cbuf }; sim = P.esdIO(cfg); }
      else if (ef.kind === 'bounce') { cfg = { kV: ef.kv, masse: ctl.masse }; sim = P.bounce(cfg); }
      else if (ef.kind === 'burst') {
        const ln = ef.ort === 'io' ? params.burstIo : params.burstNetz; cfg = { kV: ef.kv, fRep: ctl.frep, cc: params.cc, rin: ln.rin, cin: ln.cin + pr.cbuf };
        const tp = pr.tvs && P.parts && P.parts.tvs && P.parts.tvs[pr.tvs]; if (tp) cfg.vclamp = tp.vbr; sim = P.burstLine(cfg);
      } else { cfg = { kV: ef.kv, zi: ef.ort === 'netzlpe' ? 12 : 2, var: pr.varistor }; sim = P.surge(cfg); }
    } catch (e) { out.why = 'Rechnung nicht möglich: ' + (e && e.message ? e.message : e); return out; }
    if (!sim || sim.ok === false) { out.why = (sim && sim.why) || 'Rechnung nicht möglich: Der Impuls liefert keine gültigen Werte.'; return out; }
    let verdict = null;
    try { verdict = D.verdict(sim, VERDICT_KIND[ef.kind], {}); } catch (e) { verdict = null; }
    if (!verdict || verdict.ok === false || !verdict.kriterium) { out.why = (verdict && typeof verdict.why === 'string' ? verdict.why : 'Die Bewertung ist nicht möglich.'); return out; }
    const m = out.m, dp = D.params || {};
    if (ef.kind === 'esdio') { m.vq = sim.vqPeak; m.vp = sim.vpPeak; m.ip = sim.ip; m.wTvs = (sim.wTvs || 0) * 1e3; }
    else if (ef.kind === 'bounce') { m.vp = sim.dvMax; m.vq = sim.kk * sim.dvMax; m.ip = maxOf(sim.i); }
    else if (ef.kind === 'burst') { m.vq = verdict.vq; m.vp = ef.kv * 1e3; m.ip = 0; }
    else { m.vq = sim.vPeak; m.vp = ef.kv * 1e3; m.ip = sim.iPeak; m.wVar = sim.w || 0; }
    m.nReset = verdict.nReset || 0; m.nGlitch = verdict.nGlitch || 0;
    const kix = KRIT.indexOf(verdict.kriterium); m.kriterium = kix < 0 ? 3 : kix;
    Object.keys(m).forEach(k => { if (!isNum(m[k])) m[k] = 0; });
    return Object.assign(out, { ok: true, sim: sim, cfg: cfg, verdict: verdict, vabs: dp.vabs, vil: dp.vil, vih: dp.vih, vdd: dp.vdd });
  }

  // Zeitverlauf-Aufbereitung (gemeinsame Achse in der Anzeigeeinheit, höchstens 121 Punkte)
  function wave(v) {
    const sim = v.sim, kind = v.kind, out = { tUnit: 'ns', t: [], series: [], marks: [] };
    const st = arr(sim, 't') || [];
    if (!st.length) return out;
    const NP = 121, pick = a => { const r = []; for (let k = 0; k < NP; k++) r.push(a[Math.min(a.length - 1, Math.round(k * (a.length - 1) / (NP - 1)))]); return r; };
    if (kind === 'esdio' || kind === 'bounce') {
      pick(st).forEach(x => out.t.push(x * 1e9));
      if (kind === 'esdio') {
        out.series.push({ name: 'Controller vq(t)', unit: 'V', y: pick(sim.vq) });
        out.series.push({ name: 'Pin vp(t)', unit: 'V', y: pick(sim.vp) });
        out.series.push({ name: 'Entladestrom i(t)', unit: 'A', y: pick(sim.iesd) });
        out.series.push({ name: 'höchstzulässig vabs', unit: 'V', y: out.t.map(() => v.vabs) });
      } else {
        out.series.push({ name: 'Reset-Leitung', unit: 'V', y: pick(sim.vrst) });
        out.series.push({ name: 'Masseversatz ΔV(t)', unit: 'V', y: pick(sim.dv) });
        out.series.push({ name: 'Entladestrom i(t)', unit: 'A', y: pick(sim.i) });
        out.series.push({ name: 'Reset-Schwelle vil', unit: 'V', y: out.t.map(() => v.vil) });
      }
    } else if (kind === 'burst') {
      out.tUnit = 'ms'; st.forEach(x => out.t.push(x * 1e3));
      out.series.push({ name: 'Spannung an der Leitung', unit: 'V', y: Array.prototype.slice.call(arr(sim, 'vt') || []) });
      out.series.push({ name: 'Schwelle vih', unit: 'V', y: out.t.map(() => v.vih) });
    } else {
      out.tUnit = 'µs'; pick(st).forEach(x => out.t.push(x * 1e6));
      out.series.push({ name: 'Spannung am Gerät', unit: 'V', y: pick(sim.v) });
      out.series.push({ name: 'Quellenstrom', unit: 'A', y: pick(sim.i) });
    }
    out.series.forEach(s => { s.y = s.y.map(x => (isNum(x) ? x : 0)); });
    return out;
  }
  const animDur = (kind, slow) => (kind === 'esdio' || kind === 'bounce' ? 15 : 8) / Math.max(0.05, slow);   // s Anzeigezeit: ESD 150 ns x 0,1 s/ns

  // Die Meldungstexte stammen aus EMV_CORE.diagnose bzw. device.verdict (einzige Quelle); ohne diagnose (alter Kern) gelten kurze Hilfstexte.
  function coreList(ctx) {
    try { const D = root.EMV_CORE && root.EMV_CORE.diagnose; if (typeof D !== 'function') return null; const r = D(ctx); return Array.isArray(r) ? r : null; } catch (e) { return null; }
  }
  function diag(v, ctl, S) {
    const out = [], cx = {}, C = root.EMV_CORE;
    const vpart = ctl.schutz === 'varistor' ? C.protect.parts.var[ctl.var] : null;
    if (vpart) cx.varist = { vacMax: vpart.vacMax };
    if (S.fired && v && v.ok) {
      const k = v.verdict, sim = v.sim;
      if (v.kind === 'esdio' || v.kind === 'bounce') {
        cx.esd = { verdict: k, vq: k.vq, vabs: k.vabs, resetNs: k.resetNs, resetV: k.resetV, vil: k.vil };
        if (v.kind === 'esdio' && sim.tvsPart) { cx.esd.w = sim.wTvs; cx.esd.wLimit = sim.tvsPart.eMax; }
      }
      if (v.kind === 'burst' && sim.treppe) cx.burst = { n: sim.n, v: sim.vN, tau: sim.tau, gap: sim.gap };
      if (v.kind === 'surge' && vpart) { cx.varist.w = sim.w; cx.varist.wLimit = sim.wLimit; }
    }
    const list = coreList(cx);
    if (list) list.forEach(d => { if (d && d.id && d.text) out.push({ id: d.id, kind: d.kind || 'warn', text: d.text }); });
    else {   // Notfall ohne EMV_CORE.diagnose (alter Kern): nur die Meldungen, deren Bedingung hier geprüft ist
      if (vpart && vpart.vacMax < 253) out.push({ id: 'var-dauer', kind: 'warn', text: 'Dauerspannung 253 V über Vac,max ' + fm(vpart.vacMax, 0) + ' V: Der Varistor wird warm und altert.' });
      if (S.fired && v && v.ok && v.verdict.kriterium === 'Ausfall' && v.m.vq > v.vabs) out.push({ id: 'esd-ausfall', kind: 'error', text: 'Spitze am Eingang ' + fm(v.m.vq, 1) + ' V, höchstzulässig ' + fm(v.vabs, 1) + ' V: Das Bauteil wird zerstört.' });
    }
    if (S.fired && v && v.ok) {   // Meldungen des Prüfstands aus den geprüften Aussagen des Kerns (verdict.why)
      const k = v.verdict, why = k.why || [];
      if ((v.kind === 'esdio' || v.kind === 'burst') && k.nGlitch > 0 && why[0]) out.push({ id: v.kind === 'burst' ? 'burst-daten' : 'esd-daten', kind: 'warn', text: why[0] });
      if (v.kind === 'surge' && k.kriterium === 'Ausfall' && why[0] && !out.some(d => d.id === 'var-energie')) out.push({ id: 'surge-ausfall', kind: 'error', text: why[0] });
      if (v.kind === 'bounce' && k.nReset === 0 && why[0]) out.push({ id: 'esd-kein-reset', kind: 'info', text: why[0] });
    }
    return out;
  }

  function assess(v, ctl, S) {
    if (!S.fired) return { ok: false, ampel: 'grau', text: TX.grau };
    if (!v || !v.ok) return { ok: false, ampel: 'grau', text: (v && v.why) || 'Die Prüfung ist nicht möglich.' };
    const k = v.verdict.kriterium; let a = null;
    try { const r = root.EMV_CORE.assess && root.EMV_CORE.assess.immunity ? root.EMV_CORE.assess.immunity(v.verdict) : null; if (r && r.ampel) a = B.ampelNorm(r.ampel); else if (typeof r === 'string') a = B.ampelNorm(r); } catch (e) { a = null; }
    if (!a || a === 'grau') a = B.ampelNorm(v.verdict.ampel);
    const txt = PRUEF_NAME[v.eff.pr] + ' ' + kvLabel(v.eff.kv) + ', ' + ORT_NAME[v.eff.ort] + ': ' + String(v.verdict.text || '') + ' ' + (v.verdict.why || []).join(' ');
    return { ok: k === 'A' || k === 'B', ampel: a, text: txt.trim(), kriterium: k };
  }

  function curves(v, ctl, S) {
    if (!v || !v.ok) return [{ id: 'vq', title: 'Spannung am Controller', xLabel: 'Zeit', xUnit: 'ns', xScale: 'lin', yLabel: 'Spannung', yUnit: 'V', series: [{ name: 'keine Rechnung', points: [[0, 0], [150, 0]] }] }];
    const w = wave(v), out = [], tu = w.tUnit;
    const pts = s => w.t.map((x, k) => [x, s.y[k]]);
    const ser = n => w.series.find(s => s.name.indexOf(n) === 0);
    if (v.kind === 'esdio') {
      out.push({ id: 'vq', title: 'Spannung am Pin und am Controller', xLabel: 'Zeit', xUnit: tu, xScale: 'lin', yLabel: 'Spannung', yUnit: 'V', series: [{ name: 'Pin vp', points: pts(ser('Pin')) }, { name: 'Controller vq', points: pts(ser('Controller')) }], limit: { y: v.vabs, name: 'vabs = ' + fm(v.vabs, 1) + ' V' } });
      out.push({ id: 'i', title: 'Entladestrom', xLabel: 'Zeit', xUnit: tu, xScale: 'lin', yLabel: 'Strom', yUnit: 'A', series: [{ name: 'i(t)', points: pts(ser('Entladestrom')) }] });
    } else if (v.kind === 'bounce') {
      out.push({ id: 'vq', title: 'Masseversatz und Reset-Leitung', xLabel: 'Zeit', xUnit: tu, xScale: 'lin', yLabel: 'Spannung', yUnit: 'V', series: [{ name: 'ΔV', points: pts(ser('Masseversatz')) }, { name: 'Reset', points: pts(ser('Reset-Leitung')) }], limit: { y: v.vil, name: 'vil = ' + fm(v.vil, 2) + ' V' } });
      out.push({ id: 'i', title: 'Entladestrom', xLabel: 'Zeit', xUnit: tu, xScale: 'lin', yLabel: 'Strom', yUnit: 'A', series: [{ name: 'i(t)', points: pts(ser('Entladestrom')) }] });
    } else if (v.kind === 'burst') {
      out.push({ id: 'vq', title: 'Spannung an der Leitung', xLabel: 'Zeit', xUnit: tu, xScale: 'lin', yLabel: 'Spannung', yUnit: 'V', series: [{ name: 'Spannung an der Leitung', points: pts(w.series[0]) }], limit: { y: v.vih, name: 'vih = ' + fm(v.vih, 2) + ' V' } });
    } else {
      out.push({ id: 'vq', title: 'Spannung am Gerät', xLabel: 'Zeit', xUnit: tu, xScale: 'lin', yLabel: 'Spannung', yUnit: 'V', series: [{ name: 'Gerät', points: pts(w.series[0]) }] });
      out.push({ id: 'i', title: 'Quellenstrom', xLabel: 'Zeit', xUnit: tu, xScale: 'lin', yLabel: 'Strom', yUnit: 'A', series: [{ name: 'i(t)', points: pts(w.series[1]) }] });
    }
    return out;
  }

  // ---------------------------------------------------------------------------------------------------- Zeichnung
  const CHAIN = { quelle: 'Entladung bzw. Impulsgenerator', pfad: 'Gehäuse, Masseverbindung, Leitung, Schutzbauteil', senke: 'Controller-Eingang bzw. Netzteil', art: 'impuls', kopplung: ['galvanisch', 'kapazitiv', 'induktiv'] };
  function header(ctx, w, sc, view) {
    const pal = sc.pal, narrow = w < 640, a = view.ampel;
    const cw = narrow ? w - 8 : Math.max(240, w - Math.min(300, w * 0.4) - 8);
    gfx.chainBar(ctx, 4, 3, cw, 44, CHAIN, sc.active, { pal: pal, size: sc.fs });
    if (narrow) { gfx.ampelRow(ctx, 8, 62, a, { pal: pal, size: sc.fs + 1, max: w - 16 }); return 80; }
    gfx.ampelRow(ctx, cw + 14, 25, a, { pal: pal, size: sc.fs + 1, max: w - cw - 20 });
    return 52;
  }
  // Weltkoordinaten der Szene (100 x 70)
  const G = { hous: [16, 14, 68, 42], chip: [50, 30, 14, 12], pin: [84, 34], netz: [16, 34], gnd: 64, strap: [50, 56], reset: [57, 22], tvsX: 76 };
  function pathsOf(v, ctl) {
    const k = v.kind, m = v.m, ip = Math.max(1e-9, m.ip);
    const back = [[57, 42], [57, 50], [50, 50], [50, 64]];
    if (k === 'esdio') {
      const hasT = !!v.prot.tvs, sT = hasT ? clamp(maxOf(arr(v.sim, 'itvs')) / ip, 0, 1) : 0;
      return [{ key: 'tvs', w: sT, pts: [[90, 34], [76, 34], [76, 50], [50, 50], [50, 64]] }, { key: 'pin', w: 1 - sT, pts: [[90, 34], [76, 34], [64, 36]] }, { key: 'back', w: 1 - sT, pts: back }];
    }
    if (k === 'bounce') {
      const kk = v.sim.kk;
      return [{ key: 'wl', w: (1 - kk) / 2, pts: [[50, 14], [18, 14], [18, 56], [50, 56], [50, 64]] }, { key: 'wr', w: (1 - kk) / 2, pts: [[50, 14], [82, 14], [82, 56], [50, 56], [50, 64]] }, { key: 'rst', w: kk, pts: [[57, 14], [57, 22], [57, 30]] }];
    }
    if (k === 'burst') return [{ key: 'pin', w: 1, pts: v.eff.ort === 'io' ? [[96, 34], [84, 34], [64, 36]] : [[0, 34], [16, 34], [30, 34], [50, 34], [50, 36]] }, { key: 'back', w: 1, pts: back }];
    const hasV = !!v.prot.varistor;
    return [{ key: 'var', w: hasV ? 0.9 : 0, pts: [[0, 30], [16, 30], [26, 30], [26, 46], [16, 46], [0, 46]] }, { key: 'psu', w: hasV ? 0.1 : 1, pts: [[0, 34], [16, 34], [34, 34], [34, 44], [16, 44], [0, 44]] }];
  }
  // Beschriftung so setzen, dass sie in die Bildbreite passt (Schätzbreite wie im Mock, Obergrenze `max`)
  function place(gfxText, ctx, w, s, x, y, o) {
    o = o || {}; s = String(s); const size = o.size || 12, wd = Math.min(o.max || 1e9, s.length * size * 0.55 + 8), al = o.align || 'left';
    let x0 = al === 'center' ? x - wd / 2 : al === 'right' ? x - wd : x; x0 = Math.max(3, Math.min(x0, w - 3 - wd));
    const nx = al === 'center' ? x0 + wd / 2 : al === 'right' ? x0 + wd : x0; return gfxText(ctx, s, nx, y, Object.assign({}, o, { max: Math.min(o.max || 1e9, w - 6) }));
  }
  function sparkPts(x0, y0, x1, y1, seed, n) {
    const r = B.mulberry32(seed), pts = [[x0, y0]], dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    for (let k = 1; k < n; k++) { const u = k / n, j = (r() - 0.5) * L * 0.22; pts.push([x0 + dx * u + nx * j, y0 + dy * u + ny * j]); }
    pts.push([x1, y1]); return pts;
  }

  function plant(P0) {
    const S = { fired: false, tShot: 0, shots: 0, seed: 1, pool: null, poolKey: '', counts: null, geo: null, top: 52, shotsBy: { esdk: 0, esdl: 0, burst: 0, surge: 0 }, last: null };
    function ensurePool(v, sc, ctl) {
      const cap = Math.max(40, Math.round(sc.qp.particles / 2)), pa = pathsOf(v, ctl), sig = [sc.quality, v.kind, v.eff.ort, ctl.masse, v.prot.tvs, pa.map(p => p.w.toFixed(3)).join(','), sc.pal.quelle].join('|');
      if (S.pool && S.poolKey === sig) return S.pool;
      const pool = makePool(cap, 1), col = [sc.pal.quelle, sc.pal.senke, sc.pal.masse];
      pool.setPaths(pa.map((p, k) => ({ pts: p.pts, color: col[k % 3], speed: 40, key: p.key })));
      const frac = clamp((Math.log10(Math.max(0.1, v.m.ip || v.m.vq / 100)) + 1) / 2.4, 0.1, 1), N = Math.round(cap * frac);
      const c = share(N, pa.map(p => p.w)); pool.assign(c); pool.counts = c; pool.weights = pa.map(p => p.w);
      S.pool = pool; S.poolKey = sig; S.counts = { total: c.reduce((a, b) => a + b, 0), perPath: c, weights: pool.weights, keys: pa.map(p => p.key) }; return pool;
    }
    function tvsSym(ctx, x, y, col) {   // Diode gegen Masse (Pfeilspitze nach unten, Balken)
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 4, y - 4); ctx.lineTo(x + 4, y - 4); ctx.lineTo(x, y + 3); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - 5, y + 4); ctx.lineTo(x + 5, y + 4); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - 5, y + 4); ctx.lineTo(x - 7, y + 7); ctx.moveTo(x + 5, y + 4); ctx.lineTo(x + 7, y + 1); ctx.stroke();
    }
    function drawDevice(ctx, rx, ry, rw, rh, v, ctl, view, sc) {
      const pal = sc.pal, qp = sc.qp, ghost = sc.ghost, res = ghost || S.fired, s = Math.min((rw - 12) / 100, (rh - 26) / 70), W = rx + rw, tx = (ctx2, str, x, y, o) => place(gfx.text, ctx2, W, str, x, y, o);
      const ox = rx + (rw - 100 * s) / 2, oy = ry + 20 + (rh - 20 - 70 * s) / 2, X = x => ox + x * s, Y = y => oy + y * s;
      S.geo = { x: ox, y: oy, s: s, w: 100 * s, h: 70 * s };
      const ef = v.eff, kind = v.kind, fs = sc.fs, tcur = S.tShot, dur = animDur(kind, ctl.slow);
      tx(ctx, PRUEF_NAME[ef.pr] + ' ' + kvLabel(ef.kv) + ' am Ort „' + ORT_NAME[ef.ort] + '“', ox, ry + 12, { size: fs + 1, bold: true, color: pal.fg, max: Math.max(100, 100 * s) });
      // Erde und Masseverbindung
      ctx.strokeStyle = pal.mute; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(8), Y(G.gnd)); ctx.lineTo(X(92), Y(G.gnd)); ctx.stroke();
      for (let k = 0; k < 14; k++) { ctx.beginPath(); ctx.moveTo(X(10 + k * 6), Y(G.gnd)); ctx.lineTo(X(8 + k * 6), Y(G.gnd + 3)); ctx.stroke(); }
      gfx.text(ctx, 'Erde', X(94), Y(G.gnd), { size: fs, color: pal.mute, base: 'middle' });
      // Gehäuse (Metall) und Leiterplatte
      const h0 = G.hous; gfx.rr(ctx, X(h0[0]), Y(h0[1]), h0[2] * s, h0[3] * s, 8);
      if (qp.gradients && ctx.createLinearGradient) { const gr = ctx.createLinearGradient(X(h0[0]), Y(h0[1]), X(h0[0]), Y(h0[1] + h0[3])); gr.addColorStop(0, pal.panel2); gr.addColorStop(1, pal.panel); ctx.fillStyle = gr; } else ctx.fillStyle = pal.panel2;
      ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = pal.schirm; ctx.stroke();
      gfx.text(ctx, 'Gehäuse', X(h0[0] + 3), Y(h0[1] + 4), { size: fs, color: pal.mute, base: 'middle' });
      gfx.rr(ctx, X(21), Y(19), 58 * s, 32 * s, 4); ctx.fillStyle = sc.theme === 'light' ? '#cfe8df' : '#0f3b2e'; ctx.fill();
      // Controller mit Status
      const c0 = G.chip, st = !res ? 'bereit' : v.verdict.kriterium === 'Ausfall' ? 'defekt' : v.verdict.kriterium === 'C' ? 'haengt' : v.verdict.kriterium === 'B' && v.m.nReset > 0 ? 'reset' : v.verdict.kriterium === 'B' ? 'fehler' : 'ok';
      gfx.rr(ctx, X(c0[0]), Y(c0[1]), c0[2] * s, c0[3] * s, 3); ctx.fillStyle = '#2b3340'; ctx.fill(); ctx.strokeStyle = st === 'defekt' ? pal.rot : pal.fg; ctx.lineWidth = 1.5; ctx.stroke();
      gfx.text(ctx, 'Controller', X(c0[0] + c0[2] / 2), Y(c0[1] + 5), { align: 'center', size: Math.max(11, fs - 1), color: '#fff', base: 'middle', max: c0[2] * s });
      const led = { bereit: pal.grau, ok: pal.gruen, fehler: pal.gelb, reset: pal.gelb, haengt: pal.rot, defekt: pal.rot }[st], ledTxt = { bereit: 'bereit', ok: 'läuft normal', fehler: 'Datenfehler', reset: 'Neustart', haengt: 'hängt', defekt: 'Defekt' }[st];
      ctx.beginPath(); ctx.arc(X(19.5), Y(60.5), Math.max(5, 1.5 * s), 0, Math.PI * 2); ctx.fillStyle = led; ctx.fill(); ctx.strokeStyle = pal.fg; ctx.lineWidth = 1.5; ctx.stroke();
      gfx.text(ctx, ledTxt, X(19.5) + Math.max(5, 1.5 * s) + 6, Y(60.5), { align: 'left', size: fs, bold: true, color: pal.fg, base: 'middle', max: 26 * s });
      if (st === 'defekt' && !sc.reduced) for (let k = 0; k < 6; k++) { const age = ((tcur * 0.5 + k / 6) % 1), px = X(c0[0] + 3 + (k % 3) * 4 + Math.sin(k * 2.1 + age * 5) * 2), py = Y(c0[1] - 1) - age * 26 * s / 4; ctx.beginPath(); ctx.arc(px, py, (3 + age * 6), 0, Math.PI * 2); ctx.fillStyle = 'rgba(160,160,160,' + (0.5 * (1 - age)).toFixed(2) + ')'; ctx.fill(); }
      if (st === 'defekt' && sc.reduced) gfx.text(ctx, '✗', X(c0[0] + c0[2] / 2), Y(c0[1] - 3), { align: 'center', size: 18, bold: true, color: pal.rot });
      // Reset-Leitung mit RC
      ctx.strokeStyle = pal.senke; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(57), Y(30)); ctx.lineTo(X(57), Y(22)); ctx.stroke();
      gfx.text(ctx, 'Reset', X(59), Y(24), { size: Math.max(11, fs - 1), color: pal.senke, base: 'middle' });
      // Stecker-Pin, Netzanschluss
      gfx.rr(ctx, X(84), Y(28), 8 * s, 12 * s, 3); ctx.fillStyle = pal.panel2; ctx.fill(); ctx.strokeStyle = pal.fg; ctx.lineWidth = 1.5; ctx.stroke();
      gfx.text(ctx, 'Stecker', X(88), Y(43), { align: 'center', size: Math.max(11, fs - 1), color: pal.mute, base: 'middle' });
      ctx.strokeStyle = pal.senke; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(84), Y(34)); ctx.lineTo(X(64), Y(36)); ctx.stroke();
      gfx.rr(ctx, X(8), Y(28), 8 * s, 12 * s, 3); ctx.fillStyle = pal.panel2; ctx.fill(); ctx.strokeStyle = pal.fg; ctx.stroke();
      gfx.text(ctx, 'Netz', X(12), Y(25), { align: 'center', size: Math.max(11, fs - 1), color: pal.mute, base: 'middle' });
      gfx.rr(ctx, X(24), Y(26), 12 * s, 16 * s, 3); ctx.fillStyle = '#2b3340'; ctx.fill(); ctx.strokeStyle = pal.fg; ctx.stroke();
      gfx.text(ctx, 'Netzteil', X(30), Y(34), { align: 'center', size: Math.max(11, fs - 1), color: '#fff', base: 'middle', max: 12 * s });
      // Schutzbauteile
      const pr = v.prot;
      if (pr.tvs) { ctx.strokeStyle = pal.schutz; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(76), Y(34)); ctx.lineTo(X(76), Y(44)); ctx.stroke(); tvsSym(ctx, X(76), Y(48), pal.schutz); ctx.beginPath(); ctx.moveTo(X(76), Y(53)); ctx.lineTo(X(76), Y(56)); ctx.stroke(); gfx.text(ctx, String(ctl.tvs).replace('tvs', 'TVS '), X(70), Y(52), { align: 'right', size: Math.max(11, fs - 1), color: pal.schutz, bg: pal.panel, pad: 2, base: 'middle' }); }
      if (pr.rs > 0) { ctx.strokeStyle = pal.schutz; ctx.fillStyle = pal.panel; ctx.lineWidth = 2; ctx.fillRect(X(68), Y(32), 8 * s, 4 * s); ctx.strokeRect(X(68), Y(32), 8 * s, 4 * s); gfx.text(ctx, 'Rs ' + eng(pr.rs, 'Ω'), X(72), Y(29), { align: 'center', size: Math.max(11, fs - 1), color: pal.schutz, bg: pal.panel, pad: 2, base: 'middle' }); }
      if (pr.cbuf > 0) { ctx.strokeStyle = pal.schutz; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(66), Y(35.5)); ctx.lineTo(X(66), Y(42)); ctx.moveTo(X(63), Y(42)); ctx.lineTo(X(69), Y(42)); ctx.moveTo(X(63), Y(44)); ctx.lineTo(X(69), Y(44)); ctx.moveTo(X(66), Y(44)); ctx.lineTo(X(66), Y(50)); ctx.stroke(); gfx.text(ctx, 'C ' + eng(pr.cbuf, 'F'), X(61), Y(46), { align: 'right', size: Math.max(11, fs - 1), color: pal.schutz, bg: pal.panel, pad: 2, base: 'middle' }); }
      if (pr.varistor) { ctx.strokeStyle = pal.schutz; ctx.fillStyle = pal.panel; ctx.lineWidth = 2; ctx.fillRect(X(23), Y(30), 6 * s, 12 * s); ctx.strokeRect(X(23), Y(30), 6 * s, 12 * s); gfx.text(ctx, String(ctl.var).replace('v', 'Varistor '), X(26), Y(27), { align: 'center', size: Math.max(11, fs - 1), color: pal.schutz, bg: pal.panel, pad: 2, base: 'middle' }); }
      // Masseverbindung (Strap): Form nach Gehäuseanbindung
      const mk = ctl.masse; ctx.strokeStyle = pal.masse; ctx.lineCap = 'round';
      if (mk === 'g360') { ctx.lineWidth = Math.max(7, 6 * s); ctx.beginPath(); ctx.moveTo(X(50), Y(56)); ctx.lineTo(X(50), Y(64)); ctx.stroke(); }
      else if (mk === 'g50') { ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(X(50), Y(56)); ctx.lineTo(X(50), Y(64)); ctx.stroke(); }
      else { ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(X(50), Y(56)); for (let k = 1; k <= 24; k++) ctx.lineTo(X(50 + (k % 2 ? 7 : -7) * Math.sin(k)), Y(56 + k * 8 / 24)); ctx.stroke(); }
      ctx.lineCap = 'butt';
      gfx.text(ctx, 'L = ' + fm((P0.params.lg[mk]) * 1e9, 0) + ' nH', X(56), Y(60), { size: Math.max(11, fs - 1), color: pal.masse, bg: pal.panel, pad: 2, base: 'middle' });
      // Prüfgenerator: Pistole (ESD, EMV_DRAW.gun mit einmaligem Funken) bzw. Generator (Burst, Surge)
      const tgt = kind === 'bounce' ? [50, 14] : kind === 'esdio' ? [90, 34] : kind === 'burst' && ef.ort === 'io' ? [96, 34] : [0, 34];
      let gunDrawn = false;
      if (ef.pr === 'esdk' || ef.pr === 'esdl') {
        const D = B.getDraw(), gx = X(tgt[0]), gy = Y(tgt[1]), ang = kind === 'bounce' ? Math.PI / 2 : Math.PI / 2 + 0.5, size = clamp(24 * s, 80, 140), off = ef.pr === 'esdl' ? 14 : 3;   // Luft: Funkenstrecke zwischen Spitze und Ziel
        const tipx = gx + Math.cos(ang) * off, tipy = gy - Math.sin(ang) * off;
        if (D && typeof D.gun === 'function') { try { gunDrawn = !!D.gun(ctx, tipx, tipy, { angle: ang, size: size, spark: S.fired && !ghost ? S.tShot * 1000 : -1, target: { x: gx, y: gy }, seed: S.seed, reduced: sc.reduced, palette: pal }); } catch (e) { gunDrawn = false; } }
        if (!gunDrawn) {
          ctx.save(); ctx.translate(tipx, tipy); ctx.rotate(-ang); gfx.rr(ctx, 0, -3 * s, size, 6 * s, 3); ctx.fillStyle = pal.panel2; ctx.fill(); ctx.strokeStyle = pal.quelle; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
          tx(ctx, ef.pr === 'esdl' ? 'ESD-Pistole (Luft)' : 'ESD-Pistole (Kontakt)', tipx + Math.cos(ang) * size * 0.5, tipy - Math.sin(ang) * size * 0.5 - 14, { align: 'center', size: Math.max(11, fs - 1), color: pal.quelle, base: 'middle', max: 40 * s });
        }
      } else {
        const bx = ef.pr === 'burst' && ef.ort === 'io' ? 94 : 0;
        gfx.rr(ctx, X(bx), Y(24), 6 * s, 20 * s, 4); ctx.fillStyle = pal.panel2; ctx.fill(); ctx.strokeStyle = pal.quelle; ctx.lineWidth = 2; ctx.stroke();
        tx(ctx, ef.pr === 'burst' ? 'Burst-Generator' : 'Surge-Generator', X(bx + 3), Y(ef.pr === 'burst' && bx ? 54 : 46), { align: bx ? 'right' : 'left', size: Math.max(11, fs - 1), color: pal.quelle, base: 'middle' });
      }
      // Funke ohne EMV_DRAW (einmalige Aufhellung, höchstens 200 ms) bzw. Symbol bei reduzierter Bewegung
      if (!gunDrawn && S.fired && !ghost && tcur < 0.2 && !sc.reduced && (ef.pr === 'esdk' || ef.pr === 'esdl')) {
        const a = 1 - tcur / 0.2, pts = sparkPts(X(tgt[0]) + 14, Y(tgt[1]) - 12, X(tgt[0]), Y(tgt[1]), S.seed, 6);
        const prev = ctx.globalCompositeOperation; if (qp.glow) ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = '#fff6c9'; ctx.globalAlpha = a; ctx.lineWidth = 3; ctx.beginPath(); pts.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = prev;
      } else if (S.fired && !ghost && sc.reduced && tcur < 3) tx(ctx, '⚡ Entladung', X(tgt[0]), Y(tgt[1]) - 12, { align: 'center', size: fs, bold: true, color: pal.fg, bg: pal.panel, pad: 3 });
      // Strompartikel (nur während der Zeitlupe, Anteil nach Strompfad)
      if (!ghost && res) {
        const pool = ensurePool(v, sc, ctl), tmp = [0, 0, 0, 0], running = S.fired && tcur < dur;
        const prev = ctx.globalCompositeOperation; if (qp.glow) ctx.globalCompositeOperation = 'lighter';
        pool.paths.forEach((pp, k) => {
          if (running && !sc.reduced) { ctx.fillStyle = pp.color; ctx.globalAlpha = 0.95; ctx.beginPath(); for (let i = 0; i < pool.n; i++) { if (pool.path[i] !== k) continue; pool.pos(k, pool.u[i], tmp); ctx.rect(X(tmp[0]) - 1.5, Y(tmp[1]) - 1.5, 3, 3); } ctx.fill(); ctx.globalAlpha = 1; }
          if (pool.cnt[k] > 0) { pool.pos(k, 0.5, tmp); const ux = tmp[2], uy = tmp[3], x = X(tmp[0]), y = Y(tmp[1]); ctx.fillStyle = pp.color; ctx.beginPath(); ctx.moveTo(x + ux * 7, y + uy * 7); ctx.lineTo(x - ux * 3 - uy * 5, y - uy * 3 + ux * 5); ctx.lineTo(x - ux * 3 + uy * 5, y - uy * 3 - ux * 5); ctx.closePath(); ctx.fill(); }
        });
        ctx.globalCompositeOperation = prev;
      }
      // Messgrößen im Bild, an den Stellen, an denen sie entstehen
      if (res) {
        tx(ctx, 'Controller: ' + fm(v.m.vq, 1) + ' V (vabs ' + fm(v.vabs, 1) + ' V)', X(c0[0] + c0[2] / 2), Y(c0[1] + c0[3] + 5), { align: 'center', size: fs, bold: true, color: pal.fg, bg: pal.panel, pad: 2, base: 'middle', max: 46 * s });
        if (kind === 'esdio') tx(ctx, 'Pin: ' + fm(v.m.vp, 1) + ' V, i = ' + fm(v.m.ip, 1) + ' A', X(90), Y(44), { align: 'center', size: fs, color: pal.fg, bg: pal.panel, pad: 2, base: 'middle', max: 30 * s });
        if (kind === 'bounce') tx(ctx, 'ΔV = ' + fm(v.m.vp, 0) + ' V', X(30), Y(14), { align: 'center', size: fs, bold: true, color: pal.fg, bg: pal.panel, pad: 2, base: 'middle' });
        if (kind === 'burst') tx(ctx, 'Treppe: ' + fm(v.sim.vMax, 0) + ' V nach ' + (v.sim.n || 75) + ' Impulsen', X(70), Y(8), { align: 'center', size: fs, color: pal.fg, bg: pal.panel, pad: 2, base: 'middle', max: 60 * s });
        if (kind === 'surge') tx(ctx, 'Gerät: ' + fm(v.m.vq, 0) + ' V, ' + fm(v.m.wVar, 2) + ' J', X(30), Y(14), { align: 'center', size: fs, color: pal.fg, bg: pal.panel, pad: 2, base: 'middle' });
      } else tx(ctx, TX.grau, X(50), Y(8), { align: 'center', size: fs + 1, bold: true, color: pal.fg, bg: pal.panel, pad: 3, max: 90 * s });
    }
    // Zeitverläufe (EMV_DRAW.traceChart mit Zeitlupe-Cursor und Grenzlinie, sonst die Notfall-Zeichnung der Basis) und Zähler
    function chartSpecs(v, wv, ctl) {
      const by = n => wv.series.find(s => s.name.indexOf(n) === 0), mkw = list => ({ tUnit: wv.tUnit, t: wv.t, series: list.filter(Boolean), marks: [] });
      if (v.kind === 'esdio') return [{ title: 'ESD ' + kvLabel(v.eff.kv) + ': Spannung am Controller und am Pin', wave: mkw([by('Controller'), by('Pin'), by('Entladestrom')]), hlines: [{ y: v.vabs, name: 'vabs' }] }];
      if (v.kind === 'bounce') return [{ title: 'Reset-Leitung', wave: mkw([by('Reset-Leitung')]), hlines: [{ y: v.vil, name: 'vil' }] }, { title: 'Masseversatz und Entladestrom', wave: mkw([by('Masseversatz'), by('Entladestrom')]), hlines: [] }];
      if (v.kind === 'burst') return [{ title: 'Burst ' + kvLabel(v.eff.kv) + ': Spannung an der Leitung', wave: mkw([by('Spannung an der Leitung')]), hlines: [{ y: v.vih, name: 'vih' }] }];
      return [{ title: 'Surge ' + kvLabel(v.eff.kv) + ': Spannung am Gerät und Quellenstrom', wave: mkw([by('Spannung am Gerät'), by('Quellenstrom')]), hlines: [] }];
    }
    function traceIn(ctx, x, y, w, h, spec, cursor, sc) {
      const D = B.getDraw();
      if (D && typeof D.traceChart === 'function') {
        let r = false; const o = { palette: sc.pal, theme: sc.theme, title: spec.title, hlines: spec.hlines }; if (isNum(cursor)) o.cursor = cursor;
        try { r = D.traceChart(ctx, { x: x, y: y, w: w, h: h }, spec.wave, o); } catch (e) { r = false; }
        if (r) return true;
      }
      const w2 = Object.assign({}, spec.wave, { series: spec.wave.series.filter(s => s.unit === spec.wave.series[0].unit) });
      return !!gfx.traceChart(ctx, x, y, w, h, w2, { pal: sc.pal, size: sc.fs + 1, title: spec.title });
    }
    function panels(ctx, x, y, w, h, v, ctl, sc) {
      const pal = sc.pal, fs = sc.fs; if (w < 200 || h < 100) return;
      const res = sc.ghost || S.fired, hw = Math.min(h * 0.64, 300);
      if (res) {
        const wv = wave(v), specs = chartSpecs(v, wv, ctl), two = specs.length > 1 && hw >= 230 && !sc.ghost, list = two ? specs : specs.slice(0, 1), ch = two ? Math.floor((hw - 4) / 2) : hw;
        const dur = animDur(v.kind, ctl.slow), frac = S.fired && !sc.ghost ? clamp(S.tShot / dur, 0, 1) : null, t0 = wv.t[0], t1 = wv.t[wv.t.length - 1];
        list.forEach((sp, q) => { traceIn(ctx, x, y + q * (ch + 4), w, ch, sp, frac === null || frac >= 1 ? undefined : t0 + frac * (t1 - t0), sc); });
        if (v.kind === 'esdio' || v.kind === 'bounce') gfx.text(ctx, 'Zeitlupe: 1 ns entspricht ' + fm(0.1 / Math.max(0.05, ctl.slow), 2) + ' s', x + w - 8, y + hw + 12, { align: 'right', size: fs, color: pal.mute, max: w - 16 });
      } else gfx.text(ctx, TX.grau + ' Der Zeitverlauf erscheint nach dem Auslösen.', x + w / 2, y + 40, { align: 'center', size: fs, color: pal.mute, max: w - 20 });
      // Zähler und Kriterium
      const by = y + hw + 22, bh = Math.max(0, Math.min(96, y + h - by - 2));
      if (bh >= 70) {
        gfx.panel(ctx, x, by, w, bh, pal.panel, pal.line, 8); let yy = by + 18;
        const k = res ? v.verdict.kriterium : '–', m = v.m;
        gfx.text(ctx, 'Kriterium: ' + (res ? (k === 'Ausfall' ? 'Ausfall' : k) : '–') + (res ? '  (' + ({ A: 'normales Verhalten', B: 'kurz beeinträchtigt, erholt sich selbst', C: 'Bedienereingriff nötig', Ausfall: 'Bauteil defekt' }[k] || '') + ')' : ''), x + 10, yy, { size: fs + 1, bold: true, color: pal.fg, max: w - 20 }); yy += 17;
        if (res) {
          gfx.text(ctx, 'Spitze Controller ' + fm(m.vq, 1) + ' V · Pin/Gehäuse ' + fm(m.vp, 1) + ' V · Strom ' + fm(m.ip, 1) + ' A', x + 10, yy, { size: fs, color: pal.fg, max: w - 20 }); yy += 16;
          gfx.text(ctx, 'Resets ' + m.nReset + ' · Datenfehler ' + m.nGlitch + ' · TVS ' + fm(m.wTvs, 3) + ' mJ · Varistor ' + fm(m.wVar, 2) + ' J', x + 10, yy, { size: fs, color: pal.fg, max: w - 20 });
        }
      }
    }
    return {
      compute,
      assess: (v, ctl) => assess(v, ctl, S), diag: (v, ctl) => diag(v, ctl, S), curves: (v, ctl) => curves(v, ctl, S),
      meters(v) { if (!S.fired || !v || !v.ok) return { vq: 0, vp: 0, ip: 0, wTvs: 0, wVar: 0, nReset: 0, nGlitch: 0, kriterium: 0 }; return v.m; },
      waveform(v) { return v && v.ok ? wave(v) : { tUnit: 'ns', t: [], series: [], marks: [] }; },
      state(v, ctl) {
        const ef = effective(ctl);
        return { fired: S.fired, tShot: S.tShot, shots: S.shots, shotsBy: Object.assign({}, S.shotsBy), kriterium: S.fired && v && v.ok ? v.verdict.kriterium : null, animDur: animDur(ef.kind, ctl.slow), kind: ef.kind, effKv: ef.kv, effOrt: ef.ort,
          kvOptions: LEVEL[ef.pr].slice(), ortOptions: ORTS[ef.pr].slice(), status: !S.fired || !v || !v.ok ? 'bereit' : ({ A: 'ok', B: v.m.nReset > 0 ? 'reset' : 'fehler', C: 'haengt', Ausfall: 'defekt' })[v.verdict.kriterium], partikel: S.counts, animSlow: true, phaseHz: 0.5,
          treppe: v && v.ok && v.kind === 'burst' ? { n: v.sim.n, vN: v.sim.vN, vInf: v.sim.vInf, vMax: v.sim.vMax, tau: v.sim.tau, gap: v.sim.gap, treppe: v.sim.treppe } : null };
      },
      phaseHz() { return 0.5; },
      step(dtMs, v, ctl) {
        const dt = dtMs / 1000; if (S.fired) S.tShot = Math.min(S.tShot + dt, 600);
        if (S.pool && S.pool.n && v && v.ok) { const dur = animDur(v.kind, ctl.slow); if (S.tShot < dur) S.pool.step(Math.min(0.25, dt), 1); }
      },
      fire(v, ctl) {
        if (!v || !v.ok) return false;
        S.fired = true; S.tShot = 0; S.shots++; S.seed = 1 + S.shots * 7919; S.shotsBy[v.eff.pr]++;
        P0.say('Entladung ausgelöst: ' + PRUEF_NAME[v.eff.pr] + ' ' + kvLabel(v.eff.kv) + ' am Ort „' + ORT_NAME[v.eff.ort] + '“.', 'info');
        return true;
      },
      onControl(key) {
        const c = P0.ctl;
        if (key === 'pruef' || key === 'kv' || key === 'ort' || key === '*') {
          const ef = effective(c);
          if (c.kv !== ef.kv) P0.setCtl('kv', ef.kv);
          if (c.ort !== ef.ort) { const wanted = c.ort; P0.setCtl('ort', ef.ort); if (key === 'ort' || key === 'pruef') P0.say(TX.ortFix(ef.pr, ef.ort), 'info'); void wanted; }
        }
      },
      reset() { S.fired = false; S.tShot = 0; S.shots = 0; S.pool = null; S.poolKey = ''; S.counts = null; S.shotsBy = { esdk: 0, esdl: 0, burst: 0, surge: 0 }; },
      hit(px, py, w, h, view) {
        const g = S.geo; if (!g || !(px >= g.x && px <= g.x + g.w && py >= g.y && py <= g.y + g.h)) return null;
        const x = (px - g.x) / g.s, y = (py - g.y) / g.s;
        if (x > 66 && x < 82 && y > 26 && y < 58 && view.ctl.schutz !== 'kein') return { key: 'schutz' };
        if (x > 44 && x < 62 && y > 52) return { key: 'masse' };
        if (x > 84 || x < 8 || y < 10) return { key: 'ort' };
        return { key: 'schutz' };
      },
      draw(ctx, w, h, t, view, sc) {
        const v = view.res, ctl = view.ctl, pal = sc.pal;
        if (!sc.ghost) S.top = header(ctx, w, sc, view);
        const top = S.top || 52;
        if (!v || !v.ok) { gfx.text(ctx, (v && v.why) || 'Rechnung nicht möglich.', w / 2, h / 2, { align: 'center', size: 14, color: pal.fg, max: w - 20 }); return; }
        const wide = w >= 640, dw = wide ? Math.round(w * 0.56) : w, dh = wide ? h - top : Math.round((h - top) * 0.50);
        drawDevice(ctx, 0, top, dw, dh, v, ctl, view, sc);
        const px = wide ? dw + 6 : 6, py = wide ? top + 2 : top + dh + 2, pw = wide ? w - dw - 12 : w - 12, ph = wide ? h - top - 8 : h - top - dh - 6;
        panels(ctx, px, py, pw, ph, v, ctl, sc);
        gfx.text(ctx, 'Übungsanlage · Übungsimpuls · Animation verlangsamt', w - 8, h - 6, { align: 'right', size: Math.max(11, sc.fs - 1), color: pal.mute, max: w - 16 });
      }
    };
  }

  const SPEC = {
    id: 'esd', name: 'ESD, Burst und Surge', icon: '💥', info: TX.info, world: { w: 100, h: 70 }, chain: CHAIN,
    controls: CONTROLS, noLever: ['slow', 'fire'], meters: METERS, presets: PRESETS, params: PARAMS_with_lg(),
    plant
  };
  function PARAMS_with_lg() { return Object.assign({}, PARAMS, { lg: LG }); }
  R.register({ id: SPEC.id, name: SPEC.name, icon: SPEC.icon, info: SPEC.info, controls: SPEC.controls, meters: SPEC.meters, presets: SPEC.presets, create: opts => B.makeRig(SPEC, opts) });
  R.impulsHelpers = { effective, protOf, share, longest, LEVEL, ORTS, LG, KRIT };
})(typeof window !== 'undefined' ? window : globalThis);
