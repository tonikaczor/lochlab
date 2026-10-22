/* enrrig-schatten.js - Energie-Lab: Pruefstand 2 `schatten` (Verschattung, Strings, Bypassdioden, MPP-Suche, SPEC 5.3.2)
 * Physik: ENR_CORE.pv (shade.make/obstacle, array, analyze). Der Tracker (Perturb and Observe, mit Rasterlauf bei `global`) rechnet im Prueffstand,
 * eine Iteration je Kernschritt h = 0,2 s; Kennzahlen kommen aus pv.analyze (globales Maximum) und am Arbeitspunkt des Trackers.
 * Die gemeinsame Basis (Bedienpult, Zeit, Meldungen, Schreiber, Zeichenhelfer) liegt in enrrig-modul.js (ENR_RIGS.baseS):
 * Diese Datei im Browser NACH enrrig-modul.js laden (in Node holt sie sich die Basis per require).
 */
(function (root) {
  'use strict';
  const R = root.ENR_RIGS = root.ENR_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };
  if (!R.baseS && typeof require === 'function') { try { require('./enrrig-modul.js'); } catch (e) { /* Basis fehlt */ } }
  const B = R.baseS;
  if (!B) { if (typeof console !== 'undefined') console.warn('enrrig-schatten.js: Die Basis aus enrrig-modul.js fehlt (bitte davor laden).'); return; }
  const clamp = B.clamp, num = B.num, fm = B.fm, G = B.G, COL = B.COL, TXT = B.TXT;

  const GRP = { mod: 'Modul und Strang', sch: 'Schatten', cond: 'Bedingung', trk: 'MPP-Suche', hec: 'Hecke und Sonne' };
  const isHecke = s => !!s && s.schatten === 'hecke';
  const KINDS = ['keiner', 'kante', 'seite', 'blatt', 'laub', 'mast', 'diagonal', 'hecke'];
  const CONTROLS = [
    { key: 'preset', label: 'Modul', type: 'select', value: 'si60', group: GRP.mod, options: [{ value: 'si36', label: 'Modul 36 Zellen (12 V)' }, { value: 'si60', label: 'Modul 60 Zellen' }, { value: 'si72', label: 'Modul 72 Zellen' }],
      help: 'Welches Modul du verschattest. Jedes Modul hat Bypassdioden, die je einen Teilstrang überbrücken können: zwei beim 36-Zellen-Modul, drei bei den größeren.' },
    { key: 'ns', label: 'Module je Strang (ns)', type: 'slider', scale: 'lin', min: 1, max: 4, step: 1, int: true, unit: '', value: 1, group: GRP.mod, help: 'Zahl der Module in Reihe. In Reihe fließt überall derselbe Strom: Das schwächste Modul bestimmt, wie viel Strom durch den Strang geht.' },
    { key: 'np', label: 'Stränge parallel (np)', type: 'slider', scale: 'lin', min: 1, max: 2, step: 1, int: true, unit: '', value: 1, group: GRP.mod, help: 'Zahl der Stränge nebeneinander. Parallel haben alle Stränge dieselbe Spannung. Ein verschatteter Strang kann Strom aus dem anderen zurückbekommen.' },
    { key: 'orient', label: 'Aufstellung', type: 'select', value: 'hochkant', group: GRP.mod, options: [{ value: 'hochkant', label: 'hochkant' }, { value: 'quer', label: 'quer' }],
      help: 'Hochkant liegen die Teilstränge als senkrechte Streifen nebeneinander, quer als waagerechte Bänder übereinander. Ein Schatten von unten trifft hochkant alle Teilstränge, quer nur einen.' },
    { key: 'bypass', label: 'Bypassdioden', type: 'select', value: 'ok', group: GRP.mod, options: [{ value: 'ok', label: 'in Ordnung' }, { value: 'fehlt', label: 'fehlen' }, { value: 'kurz', label: 'eine durchlegiert (Kurzschluss)' }],
      help: 'In Ordnung: Die Diode übernimmt den Strom, wenn ihr Teilstrang verschattet ist. Fehlt sie, wird die verschattete Zelle zum Verbraucher. Durchlegiert: Ein Teilstrang des ersten Moduls liefert gar nichts mehr.' },
    { key: 'schatten', label: 'Schatten', type: 'select', value: 'keiner', group: GRP.sch, options: [{ value: 'keiner', label: 'kein Schatten' }, { value: 'kante', label: 'Kante von unten (Hecke, Schnee)' }, { value: 'seite', label: 'Kante von der Seite' }, { value: 'blatt', label: 'ein Blatt (eine Zelle)' }, { value: 'laub', label: 'Laub (verstreute Zellen)' }, { value: 'mast', label: 'Mast (eine Zellspalte)' }, { value: 'diagonal', label: 'Diagonal (Ecke)' }, { value: 'hecke', label: 'Hecke vor dem Modul (Sonnenstand)' }],
      help: 'Die Art des Schattens. Bei der Hecke bestimmen Sonnenhöhe, Höhe und Abstand der Hecke den Schatten, die Einstrahlung folgt dem klaren Himmel. Tippe im Bild auf eine Zelle, um ein Blatt zu setzen.' },
    { key: 'tiefe', label: 'Ausdehnung', type: 'slider', scale: 'lin', min: 0, max: 100, step: 1, unit: '%', value: 10, group: GRP.sch, visible: s => !!s && ['kante', 'seite', 'diagonal', 'laub'].indexOf(s.schatten) >= 0,
      help: 'Wie weit der Schatten ins Modul reicht (Kante, Seite, Diagonal). Beim Laub ist es der Anteil an einem Viertel der Zellen.' },
    { key: 'dunkel', label: 'Schattentiefe', type: 'slider', scale: 'lin', min: 0, max: 100, step: 5, unit: '%', value: 100, group: GRP.sch, visible: s => !!s && s.schatten !== 'keiner',
      help: '100 % ist Kernschatten: Die Zelle bekommt nur Diffuslicht. 50 % ist Halbschatten, etwa von einem dünnen Zweig.' },
    { key: 'betroffen', label: 'Betroffen', type: 'select', value: 'modul1', group: GRP.sch, options: [{ value: 'modul1', label: 'nur das erste Modul' }, { value: 'strang1', label: 'der ganze erste Strang' }, { value: 'alle', label: 'alle Module' }], visible: s => !!s && s.schatten !== 'keiner' && (s.ns > 1 || s.np > 1),
      help: 'Welche Module im Schatten liegen. Bei einem Modul ist die Wahl ohne Wirkung. Bei mehreren Modulen in Reihe zieht ein einziges verschattetes Modul den ganzen Strang herunter.' },
    { key: 'seed', label: 'Laubmuster', type: 'slider', scale: 'lin', min: 1, max: 99, step: 1, int: true, unit: '', value: 1, group: GRP.sch, visible: s => !!s && s.schatten === 'laub', help: 'Zahl, aus der das Muster der Blätter entsteht. Gleiche Zahl, gleiches Muster.' },
    { key: 'zCol', label: 'Blatt: Spalte', type: 'slider', scale: 'lin', min: 0, max: 5, step: 1, int: true, unit: '', value: 3, group: GRP.sch, visible: () => false, help: 'Spalte der Zelle, die ein Blatt trägt (von links, ab 0). Wird durch Antippen einer Zelle im Bild gesetzt.' },
    { key: 'zRow', label: 'Blatt: Zeile', type: 'slider', scale: 'lin', min: 0, max: 11, step: 1, int: true, unit: '', value: 9, group: GRP.sch, visible: () => false, help: 'Zeile der Zelle, die ein Blatt trägt (von oben, ab 0). Wird durch Antippen einer Zelle im Bild gesetzt.' },
    { key: 'G', label: 'Einstrahlung G', type: 'slider', scale: 'lin', min: 100, max: 1100, step: 10, unit: 'W/m²', value: 1000, group: GRP.cond, visible: s => !isHecke(s), help: 'Bestrahlungsstärke in der Modulebene. Bei der Hecke ist sie gesperrt und folgt dem Sonnenstand bei klarem Himmel.' },
    { key: 'diff', label: 'Diffusanteil', type: 'slider', scale: 'lin', min: 5, max: 100, step: 1, unit: '%', value: 12, group: GRP.cond, visible: s => !isHecke(s), help: 'Anteil der Einstrahlung, der als Streulicht aus dem ganzen Himmel kommt. Im Schatten bleibt nur dieser Anteil übrig. Bedeckt ist er fast 100 %.' },
    { key: 'tc', label: 'Zelltemperatur Tc', type: 'slider', scale: 'lin', min: 0, max: 70, step: 1, unit: '°C', value: 25, group: GRP.cond, help: 'Temperatur der Zellen.' },
    { key: 'mppt', label: 'MPP-Regler', type: 'select', value: 'lokal', group: GRP.trk, options: [{ value: 'lokal', label: 'sucht nur in der Nähe (lokal)' }, { value: 'global', label: 'sucht alle 30 s im ganzen Bereich (global)' }, { value: 'fest', label: 'feste Spannung' }],
      help: 'Lokal: Der Regler verschiebt die Spannung in kleinen Schritten und bleibt am nächsten Maximum hängen, auch wenn es ein schlechtes ist. Global: Alle 30 Sekunden läuft ein Suchlauf über den ganzen Spannungsbereich. Fest: Die Spannung bleibt, wo du sie einstellst.' },
    { key: 'uFrac', label: 'Feste Spannung', type: 'slider', scale: 'lin', min: 0, max: 105, step: 1, unit: '% von Uoc', value: 80, group: GRP.trk, visible: s => !!s && s.mppt === 'fest', help: 'Die Spannung als Anteil der Leerlaufspannung, die der Regler hält.' },
    { key: 'datum', label: 'Datum', type: 'select', value: 'winter', group: GRP.hec, options: [{ value: 'sommer', label: '21. Juni (Sommer)' }, { value: 'fruehling', label: '21. März (Frühling)' }, { value: 'winter', label: '21. Dezember (Winter)' }], visible: isHecke, help: 'Der Tag bestimmt, wie hoch die Sonne steht. Im Winter steht sie tief und der Schatten der Hecke wird lang.' },
    { key: 'uhr', label: 'Sonnenzeit', type: 'slider', scale: 'lin', unitKind: 'clock', min: 6, max: 18, step: 0.25, unit: 'h', value: 12, group: GRP.hec, visible: isHecke, help: 'Sonnenzeit, nicht die Uhrzeit an der Wand: Mittag ist, wenn die Sonne am höchsten steht.' },
    { key: 'zeitlauf', label: 'Zeitlauf', type: 'select', value: 'aus', group: GRP.hec, options: [{ value: 'aus', label: 'aus' }, { value: 'min15', label: '15 Minuten je Sekunde' }, { value: 'h1', label: '1 Stunde je Sekunde' }], visible: isHecke, help: 'Lässt die Sonnenzeit laufen: Der Schatten wandert und der Ertrag ändert sich. Die Zeit läuft zwischen 6 und 18 Uhr im Kreis.' },
    { key: 'hH', label: 'Höhe der Hecke', type: 'slider', scale: 'lin', min: 0.5, max: 6, step: 0.1, unit: 'm', value: 1.5, group: GRP.hec, visible: isHecke, help: 'Höhe der Hecke über dem Boden. Du kannst die Hecke im Bild nach oben und unten ziehen.' },
    { key: 'hD', label: 'Abstand zur Hecke', type: 'slider', scale: 'lin', min: 1, max: 15, step: 0.5, unit: 'm', value: 3, group: GRP.hec, visible: isHecke, help: 'Abstand zwischen der Hecke und der Unterkante des Moduls. Weiter weg wirft die Hecke einen kürzeren Schatten aufs Modul.' },
    { key: 'beta', label: 'Neigung', type: 'slider', scale: 'lin', min: 10, max: 60, step: 1, unit: '°', value: 35, group: GRP.hec, visible: isHecke, help: 'Neigung des Moduls gegen die Waagerechte. Das Modul zeigt genau nach Süden, die Unterkante liegt 0,5 m über dem Boden.' }
  ];
  const METERS = [
    { key: 'pMpp', label: 'Maximale Leistung (global)', unit: 'W', digits: 1, min: 0, max: 1600 }, { key: 'pOp', label: 'Leistung am Arbeitspunkt', unit: 'W', digits: 1, min: 0, max: 1600 },
    { key: 'pFree', label: 'Leistung ohne Schatten', unit: 'W', digits: 1, min: 0, max: 1600 }, { key: 'loss', label: 'Verlust gegen ohne Schatten', unit: '%', digits: 1, min: 0, max: 100, warnAbove: 20 },
    { key: 'nPeaks', label: 'Zahl der Maxima', unit: '', digits: 0, min: 0, max: 6 }, { key: 'uOp', label: 'Spannung am Arbeitspunkt', unit: 'V', digits: 1, min: 0, max: 200 },
    { key: 'iOp', label: 'Strom am Arbeitspunkt', unit: 'A', digits: 2, min: 0, max: 25 }, { key: 'bypassN', label: 'Leitende Bypassdioden', unit: '', digits: 0, min: 0, max: 24 },
    { key: 'hotP', label: 'Hotspot (größte Zellverlustleistung)', unit: 'W', digits: 1, min: 0, max: 150, warnAbove: 25 }, { key: 'shadedCells', label: 'Verschattete Zellen', unit: '', digits: 0, min: 0, max: 600 },
    { key: 'iRev', label: 'Rückstrom im Strang', unit: 'A', digits: 2, min: 0, max: 20, warnAbove: 15 }, { key: 'alt', label: 'Sonnenhöhe (Hecke)', unit: '°', digits: 1, min: -90, max: 90 },
    { key: 'fracShade', label: 'Verschatteter Flächenanteil', unit: '%', digits: 1, min: 0, max: 100 }
  ];
  const mkP = (id, name, params) => ({ id, name, params });
  const PRESETS = [
    mkP('laub', 'Eine Zelle im Laub', { schatten: 'blatt', dunkel: 100, zCol: 3, zRow: 9 }),
    mkP('hecke-hochkant', 'Hecke von unten, hochkant', { schatten: 'kante', tiefe: 10, orient: 'hochkant' }),
    mkP('hecke-quer', 'Hecke von unten, quer', { schatten: 'kante', tiefe: 10, orient: 'quer', mppt: 'global' }),
    mkP('lokal-global', 'Lokales gegen globales Maximum', { schatten: 'kante', tiefe: 10, orient: 'quer', mppt: 'lokal' }),
    mkP('ohne-bypass', 'Ohne Bypassdiode', { schatten: 'blatt', dunkel: 100, bypass: 'fehlt', zCol: 3, zRow: 9 }),
    mkP('zwei-straenge', 'Zwei Stränge, einer im Schatten', { np: 2, schatten: 'kante', tiefe: 15, betroffen: 'strang1' }),
    mkP('hecke-winter', 'Hecke im Winter', { schatten: 'hecke', datum: 'winter', uhr: 12 })
  ];
  const P = { z0: 0.5, lat: 51.7, N: { sommer: 172, fruehling: 80, winter: 355 }, ctStep: 0.5, scanS: 30, stuckF: 0.95, aspect: 1.65, zellMin: 0.2 };

  function plantSchatten(api) {
    const ctl = api.ctl, vis = { t: -1, ph: 0 }, T = { n: 0, u0: 0, st: 0, P: 0, U: 0, started: false, dir: -1, scanT: -1, path: [], stuck: false };
    let A = null, cache = new Map(), memoP = new Map(), detCache = new Map(), curveCache = new Map(), layoutCache = {}, hotCmp = new Map();
    const zero = why => ({ ok: false, why: why || TXT.kern, G: 0, Tc: 25, dark: true, ns: 1, np: 1, an: null, shade: null, spec: null });
    const f0 = x => (typeof x === 'number' && isFinite(x) ? x : 0);
    // ---- Modell
    function lMod(spec, orient) { const a = spec.A * (orient === 'quer' ? spec.cols / spec.rows : spec.rows / spec.cols); return Math.sqrt(a); } // Laenge entlang der Neigung (Flaeche A, Seitenverhaeltnis aus dem Raster)
    function shadeSpec(spec, G0, hk) {
      const kind = ctl.schatten; if (kind === 'keiner') return { kind: 'keiner' };
      const dunkel = ctl.dunkel / 100, base = { orient: ctl.orient, dunkel, wer: ctl.betroffen, seed: ctl.seed };
      if (kind === 'kante' || kind === 'seite' || kind === 'diagonal') return Object.assign(base, { kind, p: { frac: ctl.tiefe / 100 } });
      if (kind === 'blatt') return Object.assign(base, { kind, p: { col: clamp(ctl.zCol, 0, spec.cols - 1), row: clamp(ctl.zRow, 0, spec.rows - 1) } });
      if (kind === 'laub') return Object.assign(base, { kind, p: { count: Math.round(ctl.tiefe / 100 * 0.25 * spec.cols * spec.rows), seed: ctl.seed } });
      if (kind === 'mast') return Object.assign(base, { kind, p: { col: Math.floor(spec.cols / 2) } });
      if (kind === 'hecke') return Object.assign(base, { kind: 'kante', p: { frac: hk ? hk.frac : 0 } });
      return { kind: 'keiner' };
    }
    function compute() {
      const C = api.core(); memoP = new Map(); detCache = new Map(); hotCmp = new Map();
      if (!C || !C.pv || !C.pv.array || !C.pv.analyze) { A = zero(); return; }
      const spec = C.pv.spec(ctl.preset); if (!spec || spec.ok === false) { A = zero((spec && spec.why) || 'Unbekanntes Modul.'); return; }
      const hecke = ctl.schatten === 'hecke'; let G0 = ctl.G, fd = ctl.diff / 100, sunInfo = { alt: 0, az: 0, gPoa: 0, N: P.N[ctl.datum] || 355 }, hk = null;
      if (hecke && C.sun) {
        const N = sunInfo.N, pos = C.sun.position(N, ctl.uhr, P.lat), pa = C.sun.poa({ N, tS: ctl.uhr, lat: P.lat, beta: ctl.beta, gam: 0, c: 0 });
        sunInfo = { alt: pos.alt, az: pos.az, gPoa: f0(pa && pa.g), N, aoi: f0(pa && pa.aoi), gb: f0(pa && pa.gb), gd: f0(pa && pa.gd), gr: f0(pa && pa.gr) };
        G0 = sunInfo.gPoa; fd = G0 >= 1 ? clamp((sunInfo.gd + sunInfo.gr) / G0, 0.05, 1) : 1;
        hk = C.pv.shade.obstacle({ H: ctl.hH, D: ctl.hD, z0: P.z0, l: lMod(spec, ctl.orient), beta: ctl.beta, alt: pos.alt, az: pos.az, gam: 0 });
        if (!hk || !isFinite(hk.frac)) hk = { frac: 0, sShade: 0, alphaEff: 0, shaded: false };
      }
      const dark = !(G0 >= 1), Tc = ctl.tc, ss = shadeSpec(spec, G0, hk);
      const cfg = { spec: spec.id || ctl.preset, ns: ctl.ns, np: ctl.np, cond: { G: dark ? 0 : G0, Tc, fd }, bypass: ctl.bypass === 'kurz' ? Array.from({ length: Math.max(1, ctl.ns * ctl.np * (spec.subs || 3)) }, (_, q) => (q === 0 ? 'kurz' : 'ok')) : ctl.bypass };
      if (ss.kind !== 'keiner') cfg.shade = ss; const shapeKey = JSON.stringify(cfg);
      let sh = null; if (ss.kind !== 'keiner') { sh = C.pv.shade.make(spec, ctl.orient, ss.kind, Object.assign({ dunkel: ss.dunkel, seed: ss.seed }, ss.p)); }
      const nAff = ss.kind === 'keiner' ? 0 : (ctl.betroffen === 'alle' ? ctl.ns * ctl.np : ctl.betroffen === 'strang1' ? ctl.ns : 1);
      const m = { ok: true, spec, cfg, G: G0, fd, Tc, dark, ns: ctl.ns, np: ctl.np, ss, sh, hk, sun: sunInfo, nAff, lPlate: lMod(spec, ctl.orient), hecke };
      if (dark) { m.an = null; m.feld = null; A = m; Uoc0(m, 0); return; }
      let an = cache.get(shapeKey); if (!an) { try { an = C.pv.analyze(cfg, {}); } catch (e) { an = null; } if (an) { cache.set(shapeKey, an); if (cache.size > 12) cache.delete(cache.keys().next().value); } }
      if (!an || !an.keys) { A = zero('Die Rechnung liefert keine Kennwerte.'); return; }
      m.an = an; m.feld = C.pv.array(cfg); m.Uoc = f0(an.keys.Uoc); A = m;
      // Tracker: Schrittweite neu, Punkt beibehalten (aber im Bereich)
      T.st = P.ctStep * m.Uoc / 100; if (T.started) { T.n = Math.round((clamp(T.U, 0, m.Uoc) - T.u0) / (T.st || 1)); } if (ctl.mppt === 'global') T.scanT = -1;
      trackerUpdate(true);
    }
    function Uoc0(m, v) { m.Uoc = v; T.U = 0; T.P = 0; T.path = []; T.stuck = false; T.started = false; }
    function iAt(U) { try { return f0(A.feld.iAt(U)); } catch (e) { return 0; } }
    function pAtN(n) { let p = memoP.get(n); if (p === undefined) { const U = clamp(T.u0 + n * T.st, 0, A.Uoc); p = U * iAt(U); memoP.set(n, p); } return p; }
    function trackerUpdate(fresh) {
      if (!A || !A.ok || A.dark || !A.feld) return; const uo = A.Uoc;
      if (!(uo > 0)) { T.U = 0; T.P = 0; return; }
      if (ctl.mppt === 'fest') { T.U = clamp(ctl.uFrac / 100 * uo, 0, uo); T.P = T.U * iAt(T.U); T.stuck = false; T.started = false; return; }
      if (!T.started) { T.u0 = 0.8 * uo; T.n = 0; T.dir = -1; T.started = true; T.path = []; }
      T.U = clamp(T.u0 + T.n * T.st, 0, uo); T.P = pAtN(T.n); if (fresh) pushPath();
      const g = A.an.peaks && A.an.peaks[0] ? A.an.peaks[0].P : A.an.keys.Pmpp; T.stuck = A.an.peaks.length >= 2 && T.P < P.stuckF * g;
    }
    function pushPath() { T.path.push([+T.U.toFixed(3), +T.P.toFixed(3)]); if (T.path.length > 200) T.path.shift(); }
    function tick(k, t) {
      if (ctl.schatten === 'hecke' && ctl.zeitlauf !== 'aus') { // Sonnenzeit laeuft (Quantisierung 0,05 h gegen Neuberechnen je Schritt)
        const dtH = (ctl.zeitlauf === 'h1' ? 1 : 0.25) * 0.2; T.clock = (T.clock === undefined ? ctl.uhr : T.clock) + dtH; if (T.clock > 18) T.clock = 6 + (T.clock - 18);
        const q = Math.round(T.clock * 20) / 20; if (Math.abs(q - ctl.uhr) >= 0.05 - 1e-9) { ctl.uhr = clamp(q, 6, 18); api.dirty(); }
      } else T.clock = undefined;
      if (!A || !A.ok || A.dark || !A.feld) return;
      const uo = A.Uoc; if (!(uo > 0)) return;
      if (ctl.mppt === 'fest') { trackerUpdate(); return; }
      if (!T.started) trackerUpdate(true);
      if (ctl.mppt === 'global' && (T.scanT < 0 || t - T.scanT >= P.scanS)) { // Rasterlauf ueber den ganzen Spannungsbereich, danach P&O am besten Punkt
        let bi = 0, bp = -1; for (let i = 0; i <= 60; i++) { const U = uo * i / 60, p = U * iAt(U); if (p > bp) { bp = p; bi = i; } }
        T.u0 = uo * bi / 60; T.n = 0; T.dir = -1; memoP = new Map(); T.scanT = t;
      }
      const pPrev = pAtN(T.n), nNext = T.n + T.dir, pNext = pAtN(nNext);
      if (pNext < pPrev) { T.dir = -T.dir; } T.n = nNext; // P&O: Richtung beibehalten, wenn P stieg, sonst umkehren
      T.n = clamp(T.n, Math.ceil(-T.u0 / T.st), Math.floor((uo - T.u0) / T.st)); trackerUpdate(false); pushPath();
    }
    // ---- Auswertung am Arbeitspunkt des Trackers (zwischengespeichert nach 1 %-Stufen der Spannung)
    function opDetail() {
      const m = A; if (!m || !m.ok || m.dark || !m.an) return { subs: [], hot: { P: 0 }, bypassN: 0 };
      const key = Math.round(T.U / Math.max(1e-6, 0.01 * m.Uoc)); let d = detCache.get(key); if (d) return d;
      const C = api.core(); let a = null; try { a = C.pv.analyze(m.cfg, { mode: 'u', x: T.U }); } catch (e) { a = null; }
      d = a ? { subs: a.subs || [], hot: a.hot || { P: 0 }, bypassN: (a.subs || []).filter(s => s.bypassOn).length } : { subs: [], hot: { P: 0 }, bypassN: 0 };
      detCache.set(key, d); return d;
    }
    function hotWithout(U) { // Hotspot am selben Punkt ohne Bypassdioden (Vergleich fuer die Meldung)
      const key = Math.round(U * 100), v = hotCmp.get(key); if (v !== undefined) return v; const C = api.core(); let r = null;
      try { const a = C.pv.analyze(Object.assign({}, A.cfg, { bypass: 'fehlt' }), { mode: 'u', x: U }); r = a && a.hot ? f0(a.hot.P) : null; } catch (e) { r = null; } hotCmp.set(key, r); return r;
    }
    function iRevAt(U) { // groesster Rueckstrom eines Strangs bei Spannung U (Strang 1 allein gerechnet, Strang 1 ist der verschattete)
      const m = A; if (!m || !m.ok || m.dark || m.np < 2 || m.ss.kind === 'keiner' || m.cfg.shade.wer === 'alle') return 0;
      const key = 'ir' + Math.round(U * 50), v = detCache.get(key); if (v !== undefined) return v; const C = api.core(); let r = 0;
      try { const one = C.pv.array(Object.assign({}, m.cfg, { np: 1 })); r = Math.max(0, -f0(one.iAt(U))); } catch (e) { r = 0; } detCache.set(key, r); return r;
    }
    // ---- Ausgaben
    function meters() {
      const m = A; if (!m || !m.ok) return {}; const an = m.an, dt = opDetail(), I = m.dark ? 0 : T.U > 0 ? T.P / T.U : (m.feld ? iAt(0) : 0);
      return { pMpp: an ? an.keys.Pmpp : 0, pOp: m.dark ? 0 : T.P, pFree: an ? an.keysFree.Pmpp : 0, loss: an ? an.lossPct : 0, nPeaks: an ? an.peaks.length : 0, uOp: m.dark ? 0 : T.U, iOp: I, bypassN: dt.bypassN,
        hotP: f0(dt.hot && dt.hot.P), shadedCells: m.sh ? m.sh.count * m.nAff : 0, iRev: m.dark ? 0 : iRevAt(T.U), alt: m.hecke ? m.sun.alt : 0, fracShade: m.sh ? m.sh.frac * 100 : 0 };
    }
    function diag() {
      const m = A, out = []; if (!m || !m.ok) return out;
      if (m.dark) { out.push({ id: 'nacht', kind: 'info', text: TXT.nacht }); return out; }
      const an = m.an, dt = opDetail(), lim = (api.core().pv.hotspotLimits) || { warn: 25, error: 100 }, hotP = f0(dt.hot && dt.hot.P), per = m.spec.Ns / m.spec.subs;
      if (m.sh && m.sh.count > 0 && an.lossPct >= 5) out.push({ id: 'pv-schatten', kind: 'info', text: 'Der Schatten kostet ' + fm(an.lossW, 1) + ' W (' + fm(an.lossPct, 1) + ' %). In einem verschatteten Modul sind ' + m.sh.subsHit.length + ' von ' + m.spec.subs + ' Teilsträngen betroffen.' });
      if (dt.bypassN >= 1) out.push({ id: 'bypass-an', kind: 'info', text: (dt.bypassN === 1 ? 'Eine Bypassdiode leitet' : dt.bypassN + ' Bypassdioden leiten') + ' und überbrückt jeweils ' + fm(per, 0) + ' Zellen: Das Modul liefert dafür weniger Spannung, aber der Strom bleibt erhalten.' });
      if (ctl.bypass !== 'ok' && hotP >= lim.warn) out.push({ id: 'bypass-fehlt', kind: 'warn', text: 'Ohne funktionierende Bypassdiode wird die verschattete Zelle zum Verbraucher: etwa ' + fm(hotP, 1) + ' W Verlustleistung in einer Zelle.' });
      if (hotP >= lim.warn) {
        let extra = ''; if (ctl.bypass === 'ok') { const w = hotWithout(T.U); if (w !== null && w > hotP) extra = ' Ohne Bypassdioden wären es ' + fm(w, 1) + ' W.'; }
        const err = hotP >= lim.error; out.push({ id: 'hotspot', kind: err ? 'error' : 'warn', text: 'Hotspot: Eine verschattete Zelle erwärmt sich mit ' + fm(hotP, 1) + ' W.' + (extra ? extra + ' Bypassdioden begrenzen das, beseitigen es nicht.' : ''), fx: err ? 'overheat' : undefined });
      }
      if (an.peaks.length >= 2 && T.stuck && ctl.mppt !== 'fest') out.push({ id: 'lokal-mpp', kind: 'warn', text: 'Der MPP-Regler hängt im lokalen Maximum (' + fm(T.P, 1) + ' W) statt im globalen (' + fm(an.peaks[0].P, 1) + ' W). Ein Suchlauf über den ganzen Spannungsbereich findet das bessere.' });
      const ir = iRevAt(T.U); if (ir > m.spec.Irev) out.push({ id: 'rueckstrom', kind: 'warn', text: 'Der Strang führt ' + fm(ir, 1) + ' A rückwärts, mehr als das Modul verträgt (' + fm(m.spec.Irev, 0) + ' A).' });
      return out;
    }
    function curveOf(feld, n) {
      let cv = null; try { cv = feld.curve({ points: n }); } catch (e) { cv = null; }
      const U = cv && (cv.U || cv.u), I = cv && (cv.I || cv.i);
      if (U && I && U.length === I.length && U.length > 2) return U.map((u, k) => [+f0(u).toFixed(4), +f0(I[k]).toFixed(5)]);
      const uo = f0(feld.uoc ? feld.uoc() : A.Uoc), out = []; for (let k = 0; k <= n; k++) { const u = uo * k / n; out.push([+u.toFixed(4), +f0(feld.iAt(u)).toFixed(5)]); } return out;
    }
    function curves() {
      const m = A; if (!m || !m.ok || m.dark || !m.an) return [];
      const sig = JSON.stringify(m.cfg), hit0 = curveCache.get(sig); if (hit0) return hit0.main.concat(hit0.loss || []);
      const C = api.core(), free = C.pv.array(Object.assign({}, m.cfg, { shade: null })), iuS = curveOf(m.feld, 160), iuF = curveOf(free, 160), puS = iuS.map(q => [q[0], +(q[0] * q[1]).toFixed(3)]), puF = iuF.map(q => [q[0], +(q[0] * q[1]).toFixed(3)]);
      const pk = m.an.peaks, marks = pk.map((q, i) => ({ x: q.U, y: q.P, label: (q.global ? 'global ' : 'lokal ') + fm(q.P, 1) + ' W', global: !!q.global }));
      const main = [
        { id: 'iu', title: 'Kennlinie I(U): verschattet gegen unverschattet', xLabel: 'Spannung U', xUnit: 'V', yLabel: 'Strom I', yUnit: 'A', series: [{ name: 'verschattet', points: iuS, bold: true }, { name: 'unverschattet', points: iuF, dash: [6, 4] }], marker: { x: T.U, y: T.U > 0 ? T.P / T.U : 0 } },
        { id: 'pu', title: 'Leistung P(U) mit allen Maxima', xLabel: 'Spannung U', xUnit: 'V', yLabel: 'Leistung P', yUnit: 'W', series: [{ name: 'verschattet', points: puS, bold: true }, { name: 'unverschattet', points: puF, dash: [6, 4] }, { name: 'Weg des MPP-Reglers', points: T.path.length ? T.path.slice() : [[0, 0]], dash: [2, 3] }], marker: { x: T.U, y: T.P }, marks }
      ];
      curveCache.set(sig, { main, loss: null }); if (curveCache.size > 6) curveCache.delete(curveCache.keys().next().value); return main;
    }
    // Verlust ueber der Ausdehnung (Kante von unten) fuer hochkant und quer: rechnet erst, wenn die Oberflaeche es verlangt
    function lossCurves() {
      const m = A; if (!m || !m.ok || m.dark || !m.an) return null; const C = api.core(), key = 'loss' + JSON.stringify([m.cfg.spec, m.ns, m.np, m.cfg.cond, m.cfg.bypass, m.ss.dunkel, m.ss.wer]), c = curveCache.get(key); if (c) return c;
      const mk = orient => { const pts = []; for (let f = 0; f <= 100; f += 10) { const cfg = Object.assign({}, m.cfg, { shade: f === 0 ? null : { kind: 'kante', p: { frac: f / 100 }, orient, dunkel: m.ss.dunkel === undefined ? 1 : m.ss.dunkel, wer: m.ss.wer || 'alle', seed: 1 } }); let pm = 0; try { const fd = C.pv.array(cfg); const pk = fd.mpp ? fd.mpp() : fd.peaks()[0]; pm = f0(pk && (pk.P !== undefined ? pk.P : pk.p)); } catch (e) { pm = 0; } pts.push([f, +pm.toFixed(2)]); } return pts; };
      const res = { id: 'verlust', title: 'Leistung über der Ausdehnung des Schattens (Kante von unten)', xLabel: 'Ausdehnung des Schattens', xUnit: '%', yLabel: 'Maximale Leistung', yUnit: 'W', series: [{ name: 'hochkant', points: mk('hochkant'), bold: ctl.orient === 'hochkant' }, { name: 'quer', points: mk('quer'), dash: [8, 4], bold: ctl.orient === 'quer' }], marker: ctl.schatten === 'kante' ? { x: ctl.tiefe, y: m.an.keys.Pmpp } : null };
      curveCache.set(key, res); if (curveCache.size > 8) curveCache.delete(curveCache.keys().next().value); return res;
    }
    function curvesAll() { const base = curves(); if (!base.length) return base; const l = lossCurves(); return l ? base.concat([l]) : base; }
    function layoutOf(spec) { const k = spec.id + ctl.orient; if (!layoutCache[k]) layoutCache[k] = api.core().pv.shade.layout(spec, ctl.orient); return layoutCache[k]; }
    function tables() {
      const m = A; if (!m || !m.ok || m.dark) return []; const dt = opDetail(), cells = layoutOf(m.spec), rows = [];
      (dt.subs || []).forEach(s => { const aff = m.sh && (ctl.betroffen === 'alle' || ctl.betroffen === 'strang1' || s.mod === 0); let n = 0; if (aff) cells.forEach((c, i) => { if (c.sub === s.sub && m.sh.s[i] < 1) n++; });
        rows.push(['Modul ' + (s.mod + 1) + ', Teilstrang ' + (s.sub + 1), fm(s.U, 2) + ' V', fm(s.Ic, 2) + ' A', s.bypassOn ? 'leitet' : 'gesperrt', String(n)]); });
      return [{ id: 'teilstraenge', title: 'Teilstränge des ersten Strangs am Arbeitspunkt des MPP-Reglers', head: ['Teilstrang', 'Spannung', 'Zellstrom', 'Bypassdiode', 'Verschattete Zellen'], rows }];
    }
    function analysis() { const m = A; if (!m || !m.ok) return { ok: false, why: (m && m.why) || TXT.kern }; if (m.dark) return { ok: true, dark: true, text: TXT.nacht }; return Object.assign({ ok: true, tracker: { U: T.U, P: T.P, stuck: T.stuck, path: T.path.slice() }, sun: m.sun }, m.an); }
    // ---- Geometrie
    function geom(L) {
      const wide = L === 'wide', ns = ctl.ns, np = ctl.np, quer = ctl.orient === 'quer';
      const g = wide ? { scene: { x: 20, y: 20, w: 640, h: 360 }, mods: { x: 70, y: 100, w: 540, h: 200 }, info: { x: 680, y: 20, w: 300, h: 360 }, mini: { x: 20, y: 390, w: 640, h: 230 }, btnBox: { x: 680, y: 390, w: 300, h: 230 } }
        : { scene: { x: 10, y: 10, w: 540, h: 360 }, mods: { x: 40, y: 90, w: 480, h: 200 }, mini: { x: 10, y: 380, w: 540, h: 210 }, info: { x: 10, y: 600, w: 540, h: 0 }, btnBox: { x: 10, y: 600, w: 540, h: 200 } };
      const gap = 16, mw0 = (g.mods.w - gap * (ns - 1)) / ns, mh0 = (g.mods.h - 26 - gap * (np - 1)) / np; let mw, mh;
      // Modul zeichnen als Rechteck mit Seitenverhaeltnis (hochkant: schmal und hoch, quer: breit und flach)
      const asp = quer ? 1.5 : 0.62; mh = Math.min(mh0, mw0 / asp); mw = mh * asp; const totW = mw * ns + gap * (ns - 1), totH = mh * np + gap * (np - 1) + 26 * np;
      g.cells = { x0: g.mods.x + (g.mods.w - totW) / 2, y0: g.mods.y + (g.mods.h - totH) / 2, mw, mh, gap, rowH: mh + 26 + gap }; g.wide = wide;
      const bw = wide ? 270 : 170, bh = wide ? 40 : 58; g.btn = ['lokal', 'global', 'fest'].map((v, i) => wide ? { v, x: g.btnBox.x + 15, y: g.btnBox.y + 50 + i * 50, w: bw, h: bh } : { v, x: g.btnBox.x + 10 + i * 178, y: g.btnBox.y + 50, w: bw, h: bh });
      g.orientBtn = wide ? { x: g.btnBox.x + 15, y: g.btnBox.y + 200, w: 270, h: 24, hidden: true } : { x: g.btnBox.x + 10, y: g.btnBox.y + 125, w: 350, h: 58, hidden: false };
      if (!wide) { g.btn.forEach(b => { b.w = 170; }); } return g;
    }
    const inR = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    const NXT = { keiner: 'blatt', blatt: 'blatt' };
    function modPos(g, i, j) { const c = g.cells; return { x: c.x0 + i * (c.mw + c.gap), y: c.y0 + j * c.rowH, w: c.mw, h: c.mh }; }
    function hit(x, y, L) {
      const m = A; if (!m || !m.ok) return null; const g = geom(L);
      for (const b of g.btn) if (inR(x, y, b)) return { key: 'mppt', kind: 'switch', to: b.v };
      if (inR(x, y, g.orientBtn) && !g.orientBtn.hidden) return { key: 'orient', kind: 'switch', to: ctl.orient === 'quer' ? 'hochkant' : 'quer' };
      // Hindernis (Hecke): Ziehen aendert die Hoehe
      if (ctl.schatten === 'hecke') { const hb = heckeRect(g); if (inR(x, y, { x: hb.x, y: hb.y - 12, w: hb.w, h: hb.h + 24 })) return { key: 'hH', kind: 'drag', min: 0.5, max: 6, value: ctl.hH }; }
      for (let j = 0; j < ctl.np; j++) for (let i = 0; i < ctl.ns; i++) {
        const q = modPos(g, i, j);
        // Bypassdioden-Symbole unter dem Modul
        for (let k = 0; k < m.spec.subs; k++) { const dx = diodeX(q, k, m.spec.subs); if (Math.abs(x - dx) <= 22 && y >= q.y + q.h + 2 && y <= q.y + q.h + 28) return { key: 'bypass', kind: 'switch', to: ctl.bypass === 'ok' ? 'fehlt' : ctl.bypass === 'fehlt' ? 'kurz' : 'ok' }; }
        if (inR(x, y, q)) {
          const xf = (x - q.x) / q.w, yf = 1 - (y - q.y) / q.h, cells = layoutOf(m.spec); let best = null, bd = 9;
          cells.forEach(c => { const d = Math.hypot(c.xf - xf, c.yf - yf); if (d < bd) { bd = d; best = c; } });
          if (best) { const same = ctl.schatten === 'blatt' && ctl.zCol === best.col && ctl.zRow === best.row; return { key: 'schatten', kind: 'switch', to: same ? 'keiner' : 'blatt', cell: { col: best.col, row: best.row }, set: { zCol: best.col, zRow: best.row } }; }
        }
      }
      return null;
    }
    function diodeX(q, k, subs) { return q.x + q.w * (k + 0.5) / subs; }
    function heckeRect(g) { const s = g.scene, hpx = clamp(ctl.hH / 6, 0.05, 1) * 130; return { x: s.x + 8, y: s.y + s.h - 8 - hpx, w: s.w - 16, h: hpx }; }
    // ---- Zeichnen
    function cellMap(m, w, h) { // s-Werte auf dargestelltes Raster (cols x rows der Ansicht) abbilden
      const spec = m.spec, quer = ctl.orient === 'quer', pc = quer ? spec.rows : spec.cols, pr = quer ? spec.cols : spec.rows, cells = layoutOf(spec), s = new Array(pc * pr).fill(1); if (!m.sh) return { pc, pr, s };
      cells.forEach((c, i) => { const col = clamp(Math.floor(c.xf * pc), 0, pc - 1), row = clamp(Math.floor((1 - c.yf) * pr), 0, pr - 1); s[row * pc + col] = m.sh.s[i]; }); return { pc, pr, s };
    }
    function affected(m, i, j) { if (!m.sh) return false; const w = ctl.betroffen; return w === 'alle' || (w === 'strang1' && j === 0) || (w === 'modul1' && i === 0 && j === 0); }
    function drawScene(ctx, g, tms, rd, V) {
      const m = A, s = g.scene, c = g.cells, fs = g.wide ? 1 : 1.3, alt = m.hecke ? m.sun.alt : 50, dark = m.dark;
      G.sky(ctx, s.x, s.y, s.w, s.h, alt, tms, rd);
      // Boden
      ctx.fillStyle = '#35502f'; ctx.fillRect(s.x, s.y + s.h - 40, s.w, 40);
      const sx = m.hecke ? s.x + s.w * (0.5 + clamp(m.sun.az, -120, 120) / 240) : s.x + s.w - 80, sy = m.hecke ? s.y + s.h - 60 - clamp(m.sun.alt / 90, 0, 1) * (s.h - 150) : s.y + 70;
      if (!dark) G.sun(ctx, sx, Math.max(s.y + 24, sy), 24, clamp(m.G / 1000, 0.2, 1), tms, rd);
      else G.text(ctx, 'Nacht: Das Modul liefert nichts.', s.x + s.w / 2, s.y + 40, { size: 15 * fs, bold: true });
      const spec = m.spec, cm = cellMap(m), lod = ctl.ns * ctl.np <= 1 ? 0 : ctl.ns * ctl.np <= 4 ? 1 : 2, glint = rd ? 0.3 : (tms / 8000) % 1;
      const dt = opDetail(), hot = dt.hot && dt.hot.P > 0 ? dt.hot : null, cellsL = layoutOf(spec);
      for (let j = 0; j < ctl.np; j++) for (let i = 0; i < ctl.ns; i++) {
        const q = modPos(g, i, j), aff = affected(m, i, j);
        G.panel(ctx, q.x, q.y, q.w, q.h, { cols: cm.pc, rows: cm.pr, subs: spec.subs, orient: ctl.orient, temp: m.Tc, lod, glint: glint + i * 0.07, noGlint: dark, s: aff ? cm.s : null });
        // Schraffur auf verschatteten Flaechen (Zusatz zur Farbe)
        if (aff && m.sh && m.sh.count > 0) { ctx.save(); ctx.beginPath(); ctx.rect(q.x, q.y, q.w, q.h); ctx.clip(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); const cw = q.w / cm.pc, ch = q.h / cm.pr; for (let r = 0; r < cm.pr; r++) for (let cc = 0; cc < cm.pc; cc++) if (cm.s[r * cm.pc + cc] < 1 && (lod < 2)) { const x0 = q.x + cc * cw, y0 = q.y + r * ch; ctx.moveTo(x0, y0 + ch); ctx.lineTo(x0 + cw, y0); } ctx.stroke(); ctx.restore(); }
        // Bypassdioden-Symbole je Teilstrang (unter dem Modul)
        for (let k = 0; k < spec.subs; k++) {
          const sd = (dt.subs || []).find(z => z.mod === (j === 0 ? i : i) && z.sub === k), on = j === 0 ? !!(sd && sd.bypassOn) : (ctl.betroffen === 'alle' && !!(sd && sd.bypassOn));
          const kind = ctl.bypass === 'ok' ? 'ok' : ctl.bypass === 'fehlt' ? 'fehlt' : (i === 0 && j === 0 && k === 0 ? 'kurz' : 'ok'), dx = diodeX(q, k, spec.subs), dy = q.y + q.h + 15;
          G.diode(ctx, dx, dy, 7 * (g.wide ? 1 : 1.2), { on: on && kind === 'ok', kind });
          if (on && kind === 'ok') { G.arrow(ctx, dx - 16, dy, dx + 16, dy, COL.gold, 2, 7); }
        }
        if (hot && i === hot.mod && j === 0 && cellsL[hot.cell]) { // Hotspot glimmt (pulsierend, zusaetzlich Textschild)
          const c0 = cellsL[hot.cell], hx = q.x + c0.xf * q.w, hy = q.y + (1 - c0.yf) * q.h, pulse = rd ? 0.8 : 0.65 + 0.35 * Math.sin(tms / 180), rr = (q.w / cm.pc) * (1.6 + pulse);
          const gr = ctx.createRadialGradient(hx, hy, 1, hx, hy, rr); gr.addColorStop(0, 'rgba(255,240,200,' + (0.9 * pulse).toFixed(2) + ')'); gr.addColorStop(0.4, 'rgba(255,120,30,' + (0.7 * pulse).toFixed(2) + ')'); gr.addColorStop(1, 'rgba(255,60,20,0)');
          ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(hx, hy, rr, 0, 6.2832); ctx.fill();
          if (dt.hot.P >= (api.core().pv.hotspotLimits || { warn: 25 }).warn) G.text(ctx, 'Hotspot ' + fm(dt.hot.P, 1) + ' W', hx, hy - rr - 8, { size: 12 * fs, bold: true, color: COL.warn });
        }
      }
      // Hecke und Schatten
      if (ctl.schatten === 'hecke') {
        const hb = heckeRect(g); const gr = ctx.createLinearGradient(0, hb.y, 0, hb.y + hb.h); gr.addColorStop(0, '#1f4a22'); gr.addColorStop(1, '#16331a'); ctx.fillStyle = gr;
        ctx.beginPath(); ctx.moveTo(hb.x, hb.y + hb.h); for (let x = 0; x <= hb.w; x += 16) ctx.lineTo(hb.x + x, hb.y + ((x / 16) % 2) * 5); ctx.lineTo(hb.x + hb.w, hb.y + hb.h); ctx.closePath(); ctx.fill();
        G.text(ctx, 'Hecke ' + fm(ctl.hH, 1) + ' m (ziehen)', hb.x + 90, hb.y + 16, { size: 12 * fs, bold: true });
        if (m.hk && m.hk.frac > 0) { const q0 = modPos(g, 0, 0), sh = q0.h * m.hk.frac; const gr2 = ctx.createLinearGradient(0, q0.y + q0.h - sh - 10, 0, q0.y + q0.h - sh + 4); gr2.addColorStop(0, 'rgba(0,0,0,0)'); gr2.addColorStop(1, 'rgba(0,0,0,0.35)'); ctx.fillStyle = gr2; ctx.fillRect(q0.x - 4, q0.y + q0.h - sh - 10, q0.w * ctl.ns + c.gap * (ctl.ns - 1) + 8, 14); }
        if (!dark) { const rx = c.x0 + c.mw * ctl.ns / 2; ctx.strokeStyle = 'rgba(255,214,90,0.6)'; ctx.lineWidth = 2; ctx.setLineDash([8, 5]); ctx.lineDashOffset = rd ? 0 : -(tms / 40) % 13; ctx.beginPath(); ctx.moveTo(sx, sy + 20); ctx.lineTo(rx, c.y0 - 4); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0; }
        G.text(ctx, 'Sonnenhöhe ' + fm(m.sun.alt, 1) + '°, Schatten ' + fm((m.hk ? m.hk.frac : 0) * 100, 0) + ' % des Moduls', s.x + s.w / 2, s.y + 18, { size: 14 * fs, bold: true, color: COL.gold });
      } else if (!dark) {
        const rx = c.x0 + c.mw * ctl.ns / 2, n = 5; ctx.strokeStyle = 'rgba(255,214,90,0.5)'; ctx.lineWidth = 1 + 5 * Math.sqrt(clamp(m.G / 1000, 0, 1.2)) * 0.6; ctx.setLineDash([8, 5]); ctx.lineDashOffset = rd ? 0 : -(tms / 40) % 13; ctx.beginPath();
        for (let k = 0; k < n; k++) { const px = c.x0 + c.mw * ctl.ns * (k + 0.5) / n; ctx.moveTo(sx - 20, Math.max(s.y + 24, sy) + 14); ctx.lineTo(px, c.y0 - 6); } ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
        G.text(ctx, 'Einstrahlung G = ' + fm(m.G, 0) + ' W/m², Diffusanteil ' + fm(m.fd * 100, 0) + ' %', s.x + s.w / 2, s.y + 18, { size: 14 * fs, bold: true, color: COL.gold });
      }
      G.text(ctx, (m.sh ? m.sh.count + ' verschattete Zellen je Modul' : 'kein Schatten') + ', ' + (ctl.orient === 'quer' ? 'quer' : 'hochkant'), s.x + s.w / 2, s.y + s.h - 56 * (g.wide ? 1 : 1), { size: 13 * fs, bold: true });
    }
    function drawMini(ctx, g, V) {
      const m = A, mi = g.mini, fs = g.wide ? 1 : 1.2; G.box(ctx, mi.x, mi.y, mi.w, mi.h, COL.panel, COL.line, 10); G.text(ctx, 'Leistung über der Spannung', mi.x + 14, mi.y + 22, { size: 15 * fs, bold: true, align: 'left' });
      const px = mi.x + 50, py = mi.y + mi.h - 42, pw = mi.w - 80, ph = mi.h - 86; G.line(ctx, [[px, py - ph], [px, py], [px + pw, py]], COL.mute, 1.5);
      if (m.dark || !m.an) { G.text(ctx, 'Nacht: Das Modul liefert nichts.', mi.x + mi.w / 2, mi.y + mi.h / 2, { size: 15 * fs }); return; }
      const cv = curves().find(q => q.id === 'pu'); if (!cv) return; const xs = Math.max(1, m.Uoc), ys = Math.max(1, m.an.keysFree.Pmpp * 1.1), X = u => px + pw * u / xs, Y = p => py - ph * clamp(p / ys, 0, 1);
      G.line(ctx, cv.series[1].points.map(q => [X(q[0]), Y(q[1])]), COL.mute, 2, [6, 4]); G.line(ctx, cv.series[0].points.map(q => [X(q[0]), Y(q[1])]), COL.gold, 3);
      if (T.path.length > 1) G.line(ctx, T.path.slice(-60).map(q => [X(q[0]), Y(q[1])]), COL.cyan, 1.5, [2, 3]);
      m.an.peaks.forEach((q, i) => { G.circle(ctx, X(q.U), Y(q.P), q.global ? 6 : 5, q.global ? COL.ok : COL.warn, '#fff', 1.5); G.text(ctx, (q.global ? 'global ' : 'lokal ') + fm(q.P, 0) + ' W', X(q.U), Y(q.P) - 14, { size: 12 * fs, bold: true, color: q.global ? COL.ok : COL.warn }); });
      G.circle(ctx, X(T.U), Y(T.P), 5, COL.danger, '#fff', 1.5); G.text(ctx, 'Regler', X(T.U), Y(T.P) + 16, { size: 11 * fs, color: COL.danger });
      G.text(ctx, 'Spannung U in V', px + pw / 2, py + 26, { size: 11 * fs, color: COL.mute }); G.text(ctx, 'P in W', px, py - ph - 10, { size: 11 * fs, color: COL.mute, align: 'left' });
      G.text(ctx, '- - ohne Schatten   — mit Schatten', mi.x + mi.w - 12, mi.y + 22, { size: 11 * fs, align: 'right', color: COL.mute });
    }
    function drawInfo(ctx, g, V) {
      const m = A, i = g.info, mt = meters(), fs = g.wide ? 1 : 1.25; if (g.wide) { G.box(ctx, i.x, i.y, i.w, i.h, COL.panel, COL.line, 10); G.text(ctx, 'Messwerte', i.x + 14, i.y + 22, { size: 15, bold: true, align: 'left' });
        const rows = [['Global maximal', fm(mt.pMpp, 1) + ' W'], ['Am Arbeitspunkt', fm(mt.pOp, 1) + ' W'], ['Ohne Schatten', fm(mt.pFree, 1) + ' W'], ['Verlust', fm(mt.loss, 1) + ' %'], ['Maxima', String(mt.nPeaks)], ['Arbeitspunkt', fm(mt.uOp, 1) + ' V, ' + fm(mt.iOp, 2) + ' A'], ['Leitende Bypassdioden', String(mt.bypassN)], ['Hotspot', fm(mt.hotP, 1) + ' W'], ['Rückstrom', fm(mt.iRev, 2) + ' A']];
        rows.forEach((r, k) => { G.text(ctx, r[0], i.x + 14, i.y + 52 + k * 33, { size: 13, align: 'left', color: COL.mute, outline: false }); G.text(ctx, r[1], i.x + i.w - 14, i.y + 52 + k * 33, { size: 13, bold: true, align: 'right', outline: false }); }); }
      const b = g.btnBox; G.box(ctx, b.x, b.y, b.w, b.h, COL.panel, COL.line, 10); G.text(ctx, 'MPP-Regler (antippen)', b.x + 14, b.y + 24, { size: 15 * fs, bold: true, align: 'left' });
      const nm = { lokal: 'lokal', global: 'global', fest: 'fest' }; g.btn.forEach(q => { const on = ctl.mppt === q.v; G.box(ctx, q.x, q.y, q.w, q.h, on ? COL.gold : COL.panel2, on ? COL.gold : COL.line, 8); G.text(ctx, nm[q.v], q.x + q.w / 2, q.y + q.h / 2, { size: 14 * fs, bold: true, color: on ? '#10161c' : COL.fg, outline: false }); });
      const o = g.orientBtn; if (g.wide) { G.text(ctx, 'Aufstellung: ' + (ctl.orient === 'quer' ? 'quer' : 'hochkant') + ' (im Bedienpult ändern)', o.x, o.y + 10, { size: 12, align: 'left', color: COL.mute }); } else { G.box(ctx, o.x, o.y, o.w, o.h, COL.panel2, COL.line, 8); G.text(ctx, 'Aufstellung: ' + (ctl.orient === 'quer' ? 'quer' : 'hochkant') + ' (antippen: drehen)', o.x + o.w / 2, o.y + o.h / 2, { size: 14 * fs, bold: true, outline: false }); }
      const msg = diag().filter(d => d.kind !== 'info').slice(0, 2); const yy = g.wide ? b.y + 215 : b.y + 190; msg.forEach((d, k) => { G.text(ctx, d.id === 'lokal-mpp' ? 'Meldung: lokales Maximum' : 'Meldung: ' + d.id, b.x + 14, yy + k * 18 * fs, { size: 12 * fs, align: 'left', color: COL.danger }); });
      if (m.dark) G.text(ctx, 'Nacht', b.x + b.w - 14, b.y + 24, { size: 13, bold: true, align: 'right' });
    }
    function draw(ctx, W, H, tms, L, V) {
      const m = A; ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, W, H);
      if (!m || !m.ok) { G.text(ctx, (m && m.why) || TXT.kern, W / 2, H / 2, { size: 18 }); return; }
      const g = geom(L), rd = B.reduced(); drawScene(ctx, g, tms, rd, V); drawMini(ctx, g, V); drawInfo(ctx, g, V);
    }
    return {
      compute, tick, meters, diag, curves: curvesAll, tables, analysis, hit, draw,
      stateExtra() {
        const m = A; if (!m || !m.ok) return { N: 355, tS: 12, elev: 0, azim: 0, gPoa: 0, tcell: 25, peaks: [], trackPath: [], stuck: false, dark: true };
        return { N: m.sun.N, tS: ctl.uhr, elev: f0(m.sun.alt), azim: f0(m.sun.az), gPoa: f0(m.G), tcell: m.Tc, peaks: m.an ? m.an.peaks.map(q => ({ U: q.U, I: q.I, P: q.P, global: !!q.global })) : [], trackPath: T.path.slice(), stuck: !!T.stuck, dark: !!m.dark, uoc: f0(m.Uoc), fd: m.fd, hecke: !!m.hecke, shadeFrac: m.hk ? m.hk.frac : 0, subsHit: m.sh ? m.sh.subsHit.slice() : [], nPlus: m.an ? m.an.keys.Pmpp : 0 };
      },
      traceNow() { const mt = meters(); return { pOp: mt.pOp || 0, pMpp: mt.pMpp || 0, uOp: mt.uOp || 0 }; },
      setClock(N, tS) { if (isFinite(tS)) { ctl.uhr = clamp(tS, 6, 18); } },
      onSet(key) { if (key === 'zeitlauf') T.clock = undefined; },
      onPreset() { T.started = false; T.path = []; },
      reset() { T.started = false; T.n = 0; T.path = []; T.stuck = false; T.scanT = -1; T.clock = undefined; T.P = 0; T.U = 0; memoP = new Map(); vis.t = -1; },
      drag(key, wx, wy, L) { if (key !== 'hH') return false; const g = geom(L), s = g.scene, hpx = clamp((s.y + s.h - 8) - wy, 6.5, 130); ctl.hH = clamp(Math.round(hpx / 130 * 6 * 10) / 10, 0.5, 6); api.dirty(); return true; }
    };
  }

  R.register({
    id: 'schatten', name: 'Verschattung und Bypassdioden', icon: '⛅',
    info: 'Verschatte Zellen und sieh, was die Bypassdioden tun: Die Kennlinie bekommt Knicke und mehrere Maxima, ein MPP-Regler kann im falschen Maximum hängen bleiben. Vergleiche hochkant und quer, mit und ohne Bypassdiode, und lass den Schatten einer Hecke mit der Sonne wandern.',
    controls: CONTROLS, meters: METERS, presets: PRESETS,
    create(opts) {
      return B.makeRig({ id: 'schatten', controls: CONTROLS, meters: METERS, presets: PRESETS, h: 0.2, timeScale: 1, tUnit: 's', world: { w: 1000, h: 640 }, compactWorld: { w: 560, h: 820 }, params: P, traceKeys: ['pOp', 'pMpp', 'uOp'], sampleEvery: 5, setClockOk: true, build: plantSchatten }, opts);
    }
  });

  if (typeof module !== 'undefined') module.exports = R;
})(typeof window !== 'undefined' ? window : globalThis);
