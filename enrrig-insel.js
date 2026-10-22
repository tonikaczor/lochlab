/* enrrig-insel.js - Energie-Lab (WP3c): gemeinsame Basis der Tages-Pruefstaende (ENR_RIGS.baseC) und Pruefstand 4 `insel` (Inselanlage im Tagesgang, SPEC 5.3.4).
 * Dieselbe Basis benutzt enrrig-netz.js (im Browser NACH enrrig-insel.js laden; in Node holt sich enrrig-netz.js die Basis per require).
 * Abhaengigkeiten: ENR_CORE (enrcore.js: sun, pv; enrsys.js: sys, loads, inv, design, TEXTS), ENR_DRAW.scene (enrdraw.js) nur zum Zeichnen.
 *
 * Schnittstelle: SPEC 5.1 (controls, meters, presets, setControl/getControl, step, stepProcess, setClock, controlInfo, analysis, trace, dayTrace, balance, reset,
 * events, params, state, readMeters, draw, hitTest, curves, applyPreset, diagnose, worldSize, id, timeScale (Getter: haengt von `lauf` ab), tUnit 'h', h) plus:
 *  - dragValue(key, px, py, w, h) -> Wert fuer Ziehen auf Sonne (uhr) und Modul (neigung); setDetail(bool) / rig.detail (graue Verlustpfeile).
 *  - hitTest(px, py, w, h) -> null | { key, kind:'switch'|'drag'|'info', to?, also?, id?, title?, text? } (Welt-Koordinaten aus dem Rechteck `hits`, das
 *    ENR_DRAW.scene in data.hits ausfuellt; ohne gezeichnete Szene gelten Standardrechtecke).
 *  - Szenen-Vertrag `data` fuer ENR_DRAW.scene(ctx, w, h, data): { mode:'insel'|'netz', t (ms), reduced, sun:{ alt, az, up, m, path:{t,alt,az}, pathSummer, pathWinter },
 *    cloud:{ c, m, seed, tS, zug }, house:{ kind, lamps, pump, jet }, modules:{ spec, ns, np, beta, gam, tc }, rays:{ gb, gd, gr, aoi }, flows:[{ id, from, to, P, kind, label, loss? }],
 *    tech:{ batt, ctrl, inv, meter, grid, speicher }, labels:{ clock, date, ort, status, bubble }, detail, uhr, N, lat, hits:{} }.
 *    Pfeilarten (kind): solar, laden, entladen, last, bezug, einspeisung, verlust (SPEC 5.4 Nr. 6).
 * Zustand der Simulation: ENR_CORE.sys.create(cfg).state() wird ueber `norm` gelesen (kanonische Namen, Aliasse siehe ALIAS und WUENSCHE.md).
 * Zeit: Prozess-Sekunden, Festschritt h = 60 s, Sonnenzeit (keine Uhrzeit an der Wand). Deterministisch (Wolkenzug nur aus `seed`). Wirft nie.
 */
(function (root) {
  'use strict';
  const R = root.ENR_RIGS = root.ENR_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };

  // =====================================================================================================================
  //  Gemeinsame Basis der Tagespruefstaende
  // =====================================================================================================================
  if (!R.baseC) R.baseC = (function () {
    const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
    const num = (v, d) => { if (typeof v === 'string' && v.trim() !== '') v = Number(v.trim().replace(',', '.')); return (typeof v === 'number' && isFinite(v)) ? v : d; };
    const fm = (v, d) => { v = +v; if (!isFinite(v)) return '–'; return v.toFixed(d).replace('.', ','); };
    const fn = (v, d) => { let s = fm(v, d); if (s.indexOf(',') >= 0) s = s.replace(/0+$/, '').replace(/,$/, ''); return s; };
    const fin = v => (typeof v === 'number' && isFinite(v)) ? v : 0;
    const isObj = v => v !== null && typeof v === 'object';
    const LAT = { mitte: 51.7, sued: 37.4, nord: 60, pol: 70 };
    const ORTE = { mitte: 'Ermsleben (51,7 °N)', sued: 'Süden (37,4 °N)', nord: 'Norden (60 °N)', pol: 'Polarkreis-Nähe (70 °N)' };
    const NDAT = { sommer: 172, fruehling: 80, winter: 355 };
    const WETTER = { klar: { c: 0 }, heiter: { c: 0.25 }, wolkig: { c: 0.625 }, bedeckt: { c: 1 }, wechselhaft: { c: 0.5, zug: true } };
    const WETTER_NEXT = { klar: 'heiter', heiter: 'wolkig', wolkig: 'bedeckt', bedeckt: 'wechselhaft', wechselhaft: 'klar', frei: 'klar' };
    const LAUF = { aus: 0, langsam: 15, normal: 30, schnell: 120 };
    const KAPPA = 56;
    function tryRequire(n) { try { return typeof require === 'function' ? require(n) : null; } catch (e) { return null; } }
    function getCore() {
      let c = root.ENR_CORE;
      if (!c || !c.sys) { tryRequire('./enrcore.js'); tryRequire('./enrsys.js'); c = root.ENR_CORE; }
      if (!c || !c.sys || !c.sun) throw new Error('ENR_CORE (enrcore.js, enrsys.js) ist nicht geladen.');
      return c;
    }
    const getDraw = () => root.ENR_DRAW || tryRequire('./enrdraw.js') || root.ENR_DRAW || null;
    const pick = (o, names) => { for (let i = 0; i < names.length; i++) { const v = o[names[i]]; if (v !== undefined && v !== null) return v; } return undefined; };
    const ALIAS = {
      elev: ['elev', 'alt', 'sunAlt'], azim: ['azim', 'az'], gPoa: ['gPoa', 'g', 'G'], tcell: ['tcell', 'tc', 'Tc'],
      pPv: ['pPv', 'pPV', 'pSolar'], pPot: ['pPot', 'pMpp', 'pPotenzial'], pCurt: ['pCurt', 'curtW', 'pAbgeregelt'], uPv: ['uPv'], iPv: ['iPv'],
      pLoad: ['pLoad', 'pLast'], pLoadDc: ['pLoadDc', 'pLastDc'], pBat: ['pBat', 'pAkku'], iBat: ['iBat'], uBat: ['uBat', 'ub'], soc: ['soc', 'SoC'], stage: ['stage', 'phase'],
      lvdAktiv: ['lvdAktiv', 'lvdOff', 'lvd'], regDead: ['regDead', 'ctrlDead', 'dead'], bmsAus: ['bmsAus'], gasAh: ['gasAh'],
      pStandby: ['pStandby', 'wrStandby'], sApp: ['sApp', 'sVA', 'S'], wrOverload: ['wrOverload', 'wrUeberlast'], uOc: ['uOc', 'uoc'], uMpp: ['uMpp'],
      pDc: ['pDc', 'pDC'], uDc: ['uDc'], pAc: ['pAc', 'pAC'], eta: ['eta'], pHaus: ['pHaus'], pNetz: ['pNetz'], pSp: ['pSp'], socSp: ['socSp'], wrDead: ['wrDead'], wrOn: ['wrOn'],
      clip: ['clip', 'clipping'], window: ['window', 'imFenster'], netzOk: ['netzOk']
    };
    const FLAGS = { lvdAktiv: 1, regDead: 1, bmsAus: 1, wrOverload: 1, wrDead: 1, wrOn: 1, clip: 1, window: 1, netzOk: 1 };
    const STAGE_NR = { aus: 0, nacht: 0, bulk: 1, abs: 2, absorption: 2, float: 3 };
    // Zustand der Simulation auf kanonische, endliche Werte bringen (fehlende Felder -> 0; Flags -> bool)
    function norm(st) {
      const o = {}; st = isObj(st) ? st : {};
      Object.keys(ALIAS).forEach(k => {
        let v = pick(st, ALIAS[k]);
        if (FLAGS[k]) o[k] = (k === 'window' || k === 'netzOk') ? (v === undefined ? true : !!v) : !!v;
        else if (k === 'stage') o[k] = typeof v === 'string' ? (STAGE_NR[v.toLowerCase()] || 0) : fin(v);
        else o[k] = fin(typeof v === 'boolean' ? (v ? 1 : 0) : v);
      });
      return o;
    }
    // Texte: einzige Quelle ENR_CORE.TEXTS; nur Texte ohne Eintrag dort stehen hier (OWN), je einmal
    const OWN = {
      'sonnenaufgang': 'Sonnenaufgang: Die Sonne geht auf ({x} Uhr Sonnenzeit).', 'sonnenuntergang': 'Sonnenuntergang: Die Sonne geht unter ({x} Uhr Sonnenzeit).',
      'akku-voll': 'Der Akku ist voll (Ladezustand {x} %).', 'wr-start': 'Der Wechselrichter startet und speist ein.', 'wr-stopp': 'Der Wechselrichter hat die Einspeisung beendet.',
      'limit-aktiv': 'Die Einspeisebegrenzung ist aktiv: Der Wechselrichter speist höchstens {x} W ein.', 'zeitraffer': 'Zeitraffer gedrosselt',
      'wert-abgelehnt': 'Diesen Wert gibt es an dieser Anlage nicht.', 'unbekannt': 'Schlüssel „{key}“ gibt es an dieser Anlage nicht.',
      'uoc-hoch': 'Hohe Gleichspannung: Das Modul liefert bei Licht immer Spannung ({x} V), Arbeiten nur durch Elektrofachkraft.'
    };
    const FALLBACK = {
      'nacht': 'Nacht: Das Modul liefert nichts. Der Akku muss alles allein tragen.', 'ladeschluss': 'Ladephase: {phase} (Spannung {x} V, Strom {y} A).',
      'tiefentladung': 'Tiefentladung: Der Akku nimmt dauerhaft Schaden (Ladezustand {x} %).', 'lvd-aus': 'Tiefentladeschutz: Last getrennt bei {x} V.', 'lvd-wieder': 'Last wieder zugeschaltet bei {x} V.',
      'akku-leer-nacht': 'Der Akku war vor Sonnenaufgang leer: Er trägt {x} Wh, die Nacht braucht {y} Wh.', 'wr-ueberlast': 'Wechselrichter überlastet: Scheinleistung {x} VA, Nennleistung {y} VA.',
      'wr-standby': 'Der Wechselrichter verbraucht auch ohne Last {x} W, das sind {y} Wh in 24 h.', 'wr-clipping': 'Der Wechselrichter begrenzt auf {x} W. Das Feld könnte {y} W liefern: {z} Wh gehen heute verloren.',
      'wr-fenster': 'Die Strangspannung ({x} V) liegt außerhalb des MPP-Fensters ({y} bis {z} V).', 'wr-zerstoert': 'Der Wechselrichter-Eingang wurde überspannt: {x} V bei erlaubten {y} V.',
      'netzausfall': 'Netzausfall: Der Wechselrichter schaltet ab und speist nicht ein (kein Inselbetrieb). Die Sonne scheint trotzdem.', 'speicher-voll': 'Der Speicher ist voll: {x} W werden eingespeist.',
      'polarnacht': 'Polarnacht: Die Sonne geht nicht auf.', 'regler-strom': 'Der Regler begrenzt den Strom auf {x} A. Das Feld könnte {y} W liefern, es werden nur {z} W genutzt.',
      'regler-tot': 'Der Regler ist zerstört: Die Leerlaufspannung ({x} V) war höher als sein Eingang ({y} V).', 'kabel-spannungsfall': 'Auf der Leitung gehen {x} V ({y} %) verloren: {z} W Verlustleistung. Nimm mehr Querschnitt.',
      'kabel-ueberlast': 'Die Leitung führt {x} A, erlaubt sind {y} A. Sie erwärmt sich zu stark.', 'ueberladung': 'Der Akku gast (Spannung {x} V): Wasser geht verloren, bei Blei entsteht Knallgas. Hier fehlt die Laderegelung.',
      'bms-aus': 'Das Batteriemanagement hat abgeschaltet: Spannung/Temperatur außerhalb des erlaubten Bereichs.'
    };
    const fillTpl = (s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v && v[k] !== undefined) ? v[k] : m);
    function TX(C, id, vars) {
      let s = '';
      try { if (C && C.TEXTS && typeof C.TEXTS.get === 'function' && !Object.prototype.hasOwnProperty.call(OWN, id)) s = C.TEXTS.get(id, vars) || ''; } catch (e) { s = ''; }
      if (!s || /\{\w+\}/.test(s)) s = fillTpl(Object.prototype.hasOwnProperty.call(OWN, id) ? OWN[id] : (FALLBACK[id] || id), vars);
      return s;
    }
    const PHASE = ['aus', 'Bulk', 'Absorption', 'Float'];
    const hhmm = tS => { tS = ((tS % 24) + 24) % 24; let h = Math.floor(tS), m = Math.round((tS - h) * 60); if (m === 60) { h = (h + 1) % 24; m = 0; } return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m; };

    // ---- Sonnen-Bedienpult (SPEC 5.1) ----
    function sunControls(group, uhr0, datum0) {
      return [
        { key: 'ort', label: 'Standort', type: 'select', value: 'mitte', group, options: Object.keys(ORTE).map(k => ({ value: k, label: ORTE[k] })),
          help: 'Der Breitengrad bestimmt, wie hoch die Sonne steht und wie lang der Tag ist. Am Polarkreis gibt es im Winter eine Polarnacht.' },
        { key: 'datum', label: 'Jahreszeit', type: 'select', value: datum0 || 'sommer', group, options: [{ value: 'sommer', label: 'Sommer (21.6.)' }, { value: 'fruehling', label: 'Frühling (21.3.)' }, { value: 'winter', label: 'Winter (21.12.)' }, { value: 'frei', label: 'frei wählen' }],
          help: 'Tag des Jahres. Im Sommer steht die Sonne hoch und der Tag ist lang, im Winter steht sie tief und der Tag ist kurz. Bei frei wählst du den Tag 1 bis 365 selbst.' },
        { key: 'tag', label: 'Tag des Jahres', type: 'slider', scale: 'lin', min: 1, max: 365, step: 1, unit: '', value: NDAT[datum0 || 'sommer'], group, visible: s => !!s && s.datum === 'frei',
          help: 'Tag des Jahres von 1 (1. Januar) bis 365 (31. Dezember). Er gilt nur bei der Jahreszeit frei.' },
        { key: 'uhr', label: 'Tageszeit (Sonnenzeit)', type: 'slider', scale: 'lin', unitKind: 'clock', min: 0, max: 24, step: 0.25, unit: 'h', value: uhr0, group,
          help: 'Sonnenzeit, nicht die Uhrzeit an der Wand: Mittag ist, wenn die Sonne am höchsten steht. Die Zeit läuft von selbst, wenn du den Zeitlauf eingeschaltet hast. Wenn du den Wert setzt, springt die Zeit.' },
        { key: 'wetter', label: 'Wetterlage', type: 'select', value: 'klar', group, options: [{ value: 'klar', label: 'klar' }, { value: 'heiter', label: 'heiter' }, { value: 'wolkig', label: 'wolkig' }, { value: 'bedeckt', label: 'bedeckt' }, { value: 'wechselhaft', label: 'wechselhaft (Wolkenzug)' }, { value: 'frei', label: 'frei wählen' }],
          help: 'Die Bewölkung mindert vor allem die direkte Strahlung. Bei wechselhaftem Wetter ziehen einzelne Wolken vor die Sonne. Bei frei stellst du die Bewölkung selbst ein.' },
        { key: 'wolken', label: 'Bewölkung', type: 'slider', scale: 'lin', min: 0, max: 100, step: 5, unit: '%', value: 0, group, visible: s => !!s && s.wetter === 'frei',
          help: 'Bewölkungsgrad von 0 % (wolkenlos) bis 100 % (bedeckt). Er gilt nur bei der Wetterlage frei.' },
        { key: 'seed', label: 'Muster des Wolkenzugs', type: 'slider', scale: 'lin', min: 1, max: 99, step: 1, unit: '', value: 1, group,
          help: 'Legt fest, wann welche Wolke vor die Sonne zieht. Gleicher Wert, gleicher Wolkenzug.' },
        { key: 'lauf', label: 'Zeitlauf', type: 'select', value: 'normal', group, options: [{ value: 'aus', label: 'aus (nur von Hand)' }, { value: 'langsam', label: 'langsam (15 min je s)' }, { value: 'normal', label: 'normal (30 min je s)' }, { value: 'schnell', label: 'schnell (120 min je s)' }],
          help: 'Wie schnell die Tageszeit läuft, in Prozess-Minuten je Sekunde. Bei aus bleibt die Zeit stehen, bis du sie mit der Tageszeit selbst verstellst.' }
      ];
    }

    // =====================================================================================================================
    //  Tagespruefstand (Kernschritt, Schreiber, Meldungen, Ansichten)
    // =====================================================================================================================
    function makeDayRig(def, opts) {
      opts = isObj(opts) ? opts : {};
      const C = getCore();
      const h = def.h;
      const params = Object.freeze(Object.assign({}, def.params, isObj(opts.params) ? opts.params : {}));
      const ctl = {}, dmap = {};
      def.controls.forEach(c => { ctl[c.key] = c.value; dmap[c.key] = c; });
      const W = def.world;
      const seed0 = num(opts.seed, 1);
      const ev = [], lastSay = {};
      let t = 0, acc = 0, N = 0, tS = 0, start = { N: 0, tS: 0 }, startCtl = null, nightBat = 0, tagCount = 0, sim = null, dirty = true, throttled = false, detail = false, st = null, prevSt = null;
      let TR = null, DB = null, SH = null, E = null, act = [], lastHits = null, drawError = null, clearCache = { key: '', g: [] }, memo = {}, fl = {}, daily = [];
      const say = (id, kind, text, fx, key) => {
        const k = key || id; if (lastSay[k] !== undefined && t - lastSay[k] < 600) return;
        lastSay[k] = t; const e = { t: t, tS: tS, N: N, id: id, text: text, kind: kind || 'info' }; if (fx) e.fx = fx; ev.push(e); if (ev.length > 120) ev.shift();
      };
      const lat = () => LAT[ctl.ort] === undefined ? LAT.mitte : LAT[ctl.ort];
      const wcfg = () => {
        if (ctl.wetter === 'frei') return { c: clamp(num(ctl.wolken, 0), 0, 100) / 100, preset: 'frei', seed: ctl.seed, zug: false };
        const w = WETTER[ctl.wetter] || WETTER.klar; return { c: w.c, preset: ctl.wetter, seed: ctl.seed, zug: !!w.zug };
      };
      const dayN = () => ctl.datum === 'frei' ? clamp(Math.round(num(ctl.tag, 172)), 1, 365) : (NDAT[ctl.datum] || 172);

      function newDay() {
        E = { ePv: 0, eLoad: 0, eCurt: 0, eBatIn: 0, eBatOut: 0, eAc: 0, eEigen: 0, eDirekt: 0, eAusSp: 0, eInSp: 0, eEinsp: 0, eBezug: 0, eHaus: 0, ePot: 0, eLost: 0, socMin: 1, socMax: 0, uMax: 0, uMin: 1e9, tLvd: 0, n: 0 };
        DB = { t: [], g: [], gc: [], pv: [], load: [], bat: [], soc: [], netz: [], pot: [], haus: [], ac: [], sp: [] };
        fl = {};
      }
      function resetTrace() { TR = { t: [], v: {} }; SH = { x: [], y: [] }; }
      function rebuild(soc0, peek) {
        let n0 = N, t0 = tS; if (peek) { t0 = tS - h / 3600; if (t0 < 0) { t0 += 24; n0 = N === 1 ? 365 : N - 1; } }
        const cfg = def.buildCfg(ctl, { N: n0, tS: t0, soc0: soc0, params: params }, wcfg());
        let s = null; try { s = C.sys.create(cfg); } catch (e) { s = { ok: false, why: String(e && e.message || e) }; }
        if (!s || s.ok === false || typeof s.step !== 'function') { say('sys-fehler', 'warn', (s && s.why) || 'Die Simulation konnte nicht gestartet werden.', null, 'sys-fehler'); return false; }
        sim = s; dirty = false; return true;
      }
      function readSim() { let raw = null; try { raw = sim.state(); } catch (e) { raw = null; } return norm(raw); }
      function clearDay() {
        const key = [N, ctl.ort, def.beta(ctl), def.gam(ctl)].join('|');
        if (clearCache.key !== key) {
          const g = []; for (let m = 0; m < 1440; m++) { let v = 0; try { v = C.sun.poa({ N: N, tS: (m + 0.5) / 60, lat: lat(), beta: def.beta(ctl), gam: def.gam(ctl), c: 0, m: 1 }).g; } catch (e) { v = 0; } g.push(fin(v)); }
          clearCache = { key: key, g: g };
        }
        return clearCache.g;
      }
      function sunTimes() { let r = null; try { r = C.sun.sunriseSunset(N, lat()); } catch (e) { r = null; } return r && typeof r === 'object' ? r : { rise: NaN, set: NaN, polar: null }; }
      const ctxOf = () => ({ C: C, ctl: ctl, st: st, prev: prevSt, N: N, tS: tS, t: t, E: E, tagCount: tagCount, nightBat: nightBat, lat: lat(), say: say, fl: fl, sun: sunTimes(), memo: memo, params: params, sim: sim });

      // ---- Kernschritt ----
      function kernel(peek) {
        if (dirty || !sim) { const s0 = st ? st.soc : num(ctl.soc0, 50) / 100; if (!rebuild(s0, !!peek)) { return false; } }
        try { sim.step(h); } catch (e) { say('sys-fehler', 'warn', 'Die Simulation hat einen Fehler gemeldet.', null, 'sys-fehler'); }
        prevSt = st; st = readSim();
        if (peek) return true;
        const dtH = h / 3600;
        t += h; tS += dtH;
        let rolled = false; const nOld = N; if (tS >= 24) { tS -= 24; N = N % 365 + 1; rolled = true; }
        def.integrate(E, st, dtH, ctl, params);
        if (st.elev <= 0) nightBat += Math.max(0, -st.pBat) * dtH; else nightBat = 0;
        E.n++; E.socMin = Math.min(E.socMin, st.soc); E.socMax = Math.max(E.socMax, st.soc);
        const ps = def.sample(st, ctl);
        const gcl = clearDay(), mi = clamp(Math.floor(((tS - dtH + 24) % 24) * 60), 0, 1439);
        DB.t.push(+((tS - dtH + 24) % 24).toFixed(5)); DB.g.push(st.gPoa); DB.gc.push(gcl[mi]); DB.pv.push(ps.pv); DB.load.push(ps.load); DB.bat.push(ps.bat); DB.soc.push(ps.soc); DB.netz.push(ps.netz); DB.pot.push(ps.pot); DB.haus.push(ps.haus); DB.ac.push(ps.ac); DB.sp.push(ps.sp);
        if (E.n % 5 === 0) {
          TR.t.push(t); Object.keys(ps.tr).forEach(k => { (TR.v[k] = TR.v[k] || []).push(ps.tr[k]); });
          if (TR.t.length > 6500) { TR.t.splice(0, 500); Object.keys(TR.v).forEach(k => TR.v[k].splice(0, 500)); }
        }
        if (E.n % 15 === 0) { SH.x.push(+(tagCount + tS / 24).toFixed(4)); SH.y.push(+(st.soc * 100).toFixed(2)); if (SH.x.length > 1100) { SH.x.splice(0, 100); SH.y.splice(0, 100); } }
        if (E.n % 5 === 0 || rolled) evaluate();
        if (rolled) {
          daily.push(Object.assign({ N: nOld }, E)); if (daily.length > 30) daily.shift();
          tagCount++; newDay(); memo = {}; if (ctl.datum !== 'frei' || ctl.tag !== N) { ctl.datum = 'frei'; ctl.tag = N; }
        }
        return true;
      }
      function evaluate() {
        const c = ctxOf(); let out = [];
        try { out = def.diag(c) || []; } catch (e) { out = []; }
        const cur = {};
        out.forEach(d => { cur[d.id] = true; if (!act.some(a => a.id === d.id)) say(d.id, d.kind, d.text, d.fx); });
        act = out.map(d => Object.assign({}, d));
        let edges = []; try { edges = def.edges(c) || []; } catch (e) { edges = []; }
        edges.forEach(d => say(d.id, d.kind, d.text, d.fx, d.key));
      }
      function stepProcess(dtS) {
        dtS = num(dtS, 0); if (!(dtS > 0)) return 0;
        acc += dtS / h; const n = Math.floor(acc + 1e-9); acc -= n;
        for (let i = 0; i < n; i++) if (!kernel(false)) break;
        return n;
      }
      const ts = () => (LAUF[ctl.lauf] === undefined ? 30 : LAUF[ctl.lauf]) * 60;
      function step(dtMs) {
        dtMs = num(dtMs, 0); if (!(dtMs > 0)) return;
        let dtS = dtMs / 1000 * ts(); if (!(dtS > 0)) return;
        if (dtS / h > 2000) { dtS = 2000 * h; if (!throttled) { throttled = true; say('zeitraffer', 'info', TX(C, 'zeitraffer')); } } else throttled = false;
        stepProcess(dtS);
      }
      // Zustand frisch lesen, wenn sich Steuerwerte geaendert haben (ohne Zeit und Energien zu buchen)
      function fresh() { if ((dirty || !sim || !st)) { const s0 = st ? st.soc : num(ctl.soc0, 50) / 100; if (rebuild(s0, true)) kernel(true); } }

      // ---- Start / Reset ----
      function initState(keepEvents) {
        N = start.N; tS = start.tS; t = 0; acc = 0; tagCount = 0; if (!keepEvents) { ev.length = 0; for (const k in lastSay) delete lastSay[k]; }
        st = null; prevSt = null; act = []; memo = {}; daily = []; throttled = false; newDay(); resetTrace(); clearCache = { key: '', g: [] };
        dirty = true; sim = null; nightBat = 0; if (rebuild(num(ctl.soc0, 50) / 100, true)) kernel(true);
        if (def.afterInit) def.afterInit(ctl, st);
      }
      function setStartFromCtl(uhr) { const u = clamp(num(uhr === undefined ? ctl.uhr : uhr, def.uhr0), 0, 23.999); ctl.uhr = u; start = { N: dayN(), tS: u }; startCtl = { datum: ctl.datum, tag: ctl.tag, uhr: u }; }

      // ---- Steuerwerte ----
      function validate(key, v) {
        const d = dmap[key]; if (!d) return { ok: false, unknown: true };
        if (d.type === 'slider') { v = num(v, NaN); if (!isFinite(v)) return { ok: false }; v = clamp(v, d.min, d.max); if (d.step >= 1) v = clamp(Math.round(v), d.min, d.max); return { ok: true, v: v }; }
        if (d.type === 'select') {
          if (v === null || v === undefined || typeof v === 'object') return { ok: false };
          for (let i = 0; i < d.options.length; i++) if (d.options[i].value === v || String(d.options[i].value) === String(v)) return { ok: true, v: d.options[i].value };
          return { ok: false };
        }
        if (typeof v === 'boolean') return { ok: true, v: v };
        if (v === 1 || v === 0) return { ok: true, v: v === 1 };
        if (typeof v === 'string') { const s = v.trim().toLowerCase(); if (s === 'true' || s === 'an' || s === '1') return { ok: true, v: true }; if (s === 'false' || s === 'aus' || s === '0') return { ok: true, v: false }; }
        return { ok: false };
      }
      function setControl(key, value) {
        const r = validate(key, value);
        if (!r.ok) { if (r.unknown) say('unbekannt', 'warn', TX(C, 'unbekannt', { key: String(key) }), null, 'unbekannt:' + key); else say('wert-abgelehnt', 'warn', TX(C, 'wert-abgelehnt'), null, 'wert-abgelehnt:' + key); return false; }
        const old = ctl[key]; ctl[key] = r.v; if (old === r.v && key !== 'uhr') return true;
        if (key === 'uhr') { tS = clamp(r.v, 0, 23.999); acc = 0; dirty = true; }
        else if (key === 'datum') { if (r.v !== 'frei') N = NDAT[r.v]; else N = dayN(); ctl.tag = N; newDay(); memo = {}; dirty = true; }
        else if (key === 'tag') { if (ctl.datum === 'frei') { N = r.v; newDay(); memo = {}; } dirty = true; }
        else if (key === 'lauf') { /* nur Zeitmassstab */ }
        else if (def.live && def.live.indexOf(key) >= 0) { /* wirkt ohne Neuaufbau */ }
        else { dirty = true; if (key === 'seed' || key === 'ort' || key === 'neigung' || key === 'azimut') { clearCache = { key: '', g: [] }; } }
        if (def.onControl) def.onControl(key, old, ctl);
        return true;
      }
      const getControl = key => key === 'uhr' ? tS : (key === 'tag' && ctl.datum !== 'frei' ? N : ctl[key]);
      function controlInfo(key) {
        const d = dmap[key]; if (!d || d.type !== 'slider') return null;
        return { min: d.min, max: d.max, step: d.step, value: getControl(key) };
      }
      function setClock(n, tSn) {
        n = num(n, NaN); tSn = num(tSn, NaN); if (!isFinite(n) || !isFinite(tSn)) return false;
        n = clamp(Math.round(n), 1, 365); tSn = ((tSn % 24) + 24) % 24;
        const keyD = Object.keys(NDAT).find(k => NDAT[k] === n);
        if (n !== N) { newDay(); memo = {}; }
        N = n; tS = tSn; ctl.datum = keyD || 'frei'; ctl.tag = n; acc = 0; dirty = true; return true;
      }
      function applyPreset(id) {
        const p = (def.presets || []).find(q => q.id === id); if (!p) return false;
        def.controls.forEach(c => { ctl[c.key] = c.value; }); ctl.seed = seed0;
        Object.keys(p.params).forEach(k => { const r = validate(k, p.params[k]); if (r.ok) ctl[k] = r.v; });
        setStartFromCtl(p.params.uhr); initState(false); say('preset', 'info', 'Voreinstellung: ' + p.name, null, 'preset'); return true;
      }
      function reset() { ctl.seed = seed0; if (startCtl) { ctl.datum = startCtl.datum; ctl.tag = startCtl.tag; ctl.uhr = startCtl.uhr; } start = { N: dayN(), tS: clamp(num(ctl.uhr, def.uhr0), 0, 23.999) }; initState(false); }

      // ---- Lesen ----
      const hasStage = () => PHASE[clamp(Math.round(fin(st && st.stage)), 0, 3)];
      function derived() {
        fresh(); const c = ctxOf(); let o = {}; try { o = def.meterFn(c) || {}; } catch (e) { o = {}; }
        return o;
      }
      function readMeters() {
        const o = derived(); const m = {}; Object.keys(o).forEach(k => { m[k] = fin(o[k]); }); return m;
      }
      function state() {
        fresh();
        const s = Object.assign({}, ctl, st || norm(null));
        const o = derived(); Object.keys(o).forEach(k => { s[k] = (o[k] === null) ? null : (typeof o[k] === 'number' ? fin(o[k]) : o[k]); });
        Object.keys(s).forEach(k => { if (typeof s[k] === 'number' && !isFinite(s[k])) s[k] = 0; });
        s.t = t; s.N = N; s.tS = tS; s.uhr = tS; s.tag = tagCount; s.throttled = throttled; s.phase = hasStage();
        s.faults = act.filter(d => d.kind !== 'info').map(d => d.id); s.clock = hhmm(tS);
        return s;
      }
      const diagnose = () => act.map(d => Object.assign({}, d));
      function trace(spanS) {
        spanS = num(spanS, 86400); if (!(spanS > 0)) spanS = 86400;
        const n = TR.t.length, out = { t: [], series: {}, marks: [] }; if (!n) return out;
        const t0 = TR.t[n - 1] - spanS; let i0 = n - 1; while (i0 > 0 && TR.t[i0 - 1] >= t0) i0--;
        const stp = Math.max(1, Math.ceil((n - i0) / 600)), idx = []; for (let i = n - 1; i >= i0; i -= stp) idx.push(i); idx.reverse();
        out.t = idx.map(i => TR.t[i]); Object.keys(TR.v).forEach(k => { out.series[k] = idx.map(i => TR.v[k][i]); });
        ev.forEach(e => { if (e.t >= t0) out.marks.push({ t: e.t, text: e.text, kind: e.kind }); });
        return out;
      }
      function dayTrace() {
        fresh(); const su = sunTimes(), cg = clearDay(), tt = [], gc = [];
        for (let m = 5; m < 1440; m += 10) { tt.push(+(m / 60).toFixed(4)); gc.push(cg[m]); }
        return { t: DB.t.slice(), g: DB.g.slice(), gClear: DB.gc.slice(), pv: DB.pv.slice(), load: DB.load.slice(), bat: DB.bat.slice(), soc: DB.soc.slice(), netz: DB.netz.slice(), pot: DB.pot.slice(), haus: DB.haus.slice(),
          ac: DB.ac.slice(), sp: DB.sp.slice(), now: tS, N: N, rise: su.rise, set: su.set, polar: su.polar, gClearDay: { t: tt, g: gc } };
      }
      function balance() {
        fresh(); let b = {}; try { b = (sim && typeof sim.balance === 'function' ? sim.balance() : {}) || {}; } catch (e) { b = {}; }
        return Object.assign({}, b, { rig: Object.assign({}, E, { N: N }) });
      }
      const energy = () => E;

      // ---- Zeichnen ----
      const reducedMotion = () => { try { return typeof root.matchMedia === 'function' && !!root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
      function view(tms) {
        fresh();
        const c = ctxOf(); let d = {}; try { d = def.scene(c, st || norm(null)) || {}; } catch (e) { d = {}; }
        const m = cloudFactor();
        d.mode = def.id; d.t = tms; d.reduced = reducedMotion(); d.detail = detail; d.uhr = tS; d.N = N; d.lat = lat(); d.hits = {};
        d.sun = Object.assign({ alt: fin(st && st.elev), az: fin(st && st.azim), up: !!(st && st.elev > 0), m: m }, d.sun || {});
        d.sun.path = sunPath(N); d.sun.pathSummer = sunPath(172); d.sun.pathWinter = sunPath(355);
        const w = wcfg(); d.cloud = { c: w.c, m: m, seed: ctl.seed, tS: tS, zug: !!w.zug };
        const q = poaNow(); d.rays = { gb: q.gb, gd: q.gd, gr: q.gr, aoi: q.aoi };
        d.labels = Object.assign({ clock: hhmm(tS) + ' Uhr Sonnenzeit', date: 'Tag ' + N, ort: ORTE[ctl.ort] || '' }, d.labels || {});
        return d;
      }
      function sunPath(n) {
        const key = 'sp' + n + '|' + ctl.ort; if (memo[key]) return memo[key];
        let p = { t: [], alt: [], az: [] }; try { p = C.sun.sunPath(n, lat(), 10) || p; } catch (e) { /* leer */ } memo[key] = p; return p;
      }
      function cloudFactor() {
        const w = wcfg(); if (!w.zug) return 1;
        const key = 'ct' + w.seed + '|' + w.c; if (!memo[key]) { try { memo[key] = C.sun.cloudTrack(w.seed, w.c, 48); } catch (e) { memo[key] = null; } }
        const f = memo[key]; if (typeof f !== 'function') return 1; const v = f(N * 24 % 48 + tS); return isFinite(v) ? clamp(v, 0.15, 1) : 1;
      }
      function poaNow() {
        const w = wcfg(); let q = null;
        try { q = C.sun.poa({ N: N, tS: tS, lat: lat(), beta: def.beta(ctl), gam: def.gam(ctl), c: w.c, m: cloudFactor() }); } catch (e) { q = null; }
        q = isObj(q) ? q : {}; return { gb: fin(q.gb), gd: fin(q.gd), gr: fin(q.gr), aoi: fin(q.aoi), g: fin(q.g) };
      }
      function toWorld(px, py, w, hh) {
        px = num(px, NaN); py = num(py, NaN); w = num(w, NaN); hh = num(hh, NaN);
        if (!isFinite(px) || !isFinite(py) || !(w > 0) || !(hh > 0)) return null;
        const s = Math.min(w / W.w, hh / W.h); return { x: (px - (w - W.w * s) / 2) / s, y: (py - (hh - W.h * s) / 2) / s };
      }
      function draw(ctx, w, hh, tms) {
        if (!ctx || !(w > 0) || !(hh > 0) || !isFinite(w) || !isFinite(hh)) return;
        tms = num(tms, 0);
        try {
          const s = Math.min(w / W.w, hh / W.h);
          ctx.save(); ctx.fillStyle = '#14181c'; ctx.fillRect(0, 0, w, hh);
          ctx.translate((w - W.w * s) / 2, (hh - W.h * s) / 2); ctx.scale(s, s);
          const D = opts.noDraw ? null : getDraw();
          if (!D || typeof D.scene !== 'function') {
            ctx.fillStyle = '#222830'; ctx.fillRect(0, 0, W.w, W.h); ctx.fillStyle = '#8d99a6'; ctx.font = '600 18px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('Der Zeichenhelfer enrdraw.js fehlt.', W.w / 2, W.h / 2);
          } else {
            const data = view(tms); D.scene(ctx, W.w, W.h, data); lastHits = data.hits && Object.keys(data.hits).length ? data.hits : lastHits;
            ctx.font = '600 13px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.fillStyle = '#ffffff';
            const txt = data.labels.clock + ' · ' + data.labels.date + ' · ' + data.labels.ort; ctx.strokeText(txt, 12, 22); ctx.fillText(txt, 12, 22);
          }
          ctx.restore();
        } catch (e) { drawError = e && e.message ? String(e.message) : 'Fehler'; try { ctx.restore(); } catch (e2) { /* ignorieren */ } }
      }
      const DEFHITS = { sun: { x: 500, y: 120, r: 40 }, modul: { x: 360, y: 250, w: 280, h: 70 }, wolke: { x: 80, y: 60, w: 220, h: 80 }, akku: { x: 440, y: 400, w: 70, h: 100 }, regler: { x: 360, y: 400, w: 70, h: 90 },
        wr: { x: 520, y: 400, w: 70, h: 90 }, lampe: { x: 600, y: 360, w: 40, h: 40 }, pumpe: { x: 650, y: 440, w: 60, h: 60 }, mast: { x: 880, y: 150, w: 70, h: 400 }, speicher: { x: 700, y: 380, w: 60, h: 120 }, zaehler: { x: 740, y: 330, w: 60, h: 60 } };
      const inRect = (r, x, y) => r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
      function hitTest(px, py, w, hh) {
        const p = toWorld(px, py, w, hh); if (!p) return null;
        const H = lastHits || DEFHITS, x = p.x, y = p.y;
        if (H.sun && Math.hypot(x - H.sun.x, y - H.sun.y) <= Math.max(40, H.sun.r || 0)) return { key: 'uhr', kind: 'drag' };
        for (let i = 0; i < def.hitOrder.length; i++) { const k = def.hitOrder[i]; if (H[k] && inRect(H[k], x, y)) { const r = def.hit(k, ctxOf(), st || norm(null), { WETTER_NEXT: WETTER_NEXT, fm: fm, fn: fn }); if (r) return r; } }
        if (H.modul && inRect(H.modul, x, y)) return { key: 'neigung', kind: 'drag' };
        if (H.wolke && inRect(H.wolke, x, y)) return { key: 'wetter', kind: 'switch', to: WETTER_NEXT[ctl.wetter] || 'klar' };
        return null;
      }
      function dragValue(key, px, py, w, hh) {
        const p = toWorld(px, py, w, hh); if (!p) return null;
        if (key === 'uhr') { const f = clamp((p.x / W.w - 0.5) * 240, -120, 120); const su = sunTimes(); const rise = isFinite(su.rise) ? su.rise : 6, set = isFinite(su.set) ? su.set : 18; return clamp(12 + f / 120 * Math.max(1, (set - rise) / 2), 0, 24); }
        if (key === 'neigung') return clamp(Math.round(90 * (1 - clamp((p.y - 200) / 160, 0, 1))), 0, 90);
        return null;
      }

      // ---- Kennlinien, Analyse ----
      function curves() { fresh(); try { return def.curves(ctxOf(), { sunPath: sunPath, dayTrace: dayTrace, SH: SH, E: E, tagCount: tagCount, poaNow: poaNow }) || []; } catch (e) { return []; } }
      function analysis() { fresh(); try { return def.analysis(ctxOf(), st || norm(null)); } catch (e) { return { ok: false, why: String(e && e.message || e) }; } }

      // ---- Start ----
      ctl.seed = seed0;
      if (isObj(opts.controls)) Object.keys(opts.controls).forEach(k => { const r = validate(k, opts.controls[k]); if (r.ok) ctl[k] = r.v; });
      if (ctl.uhr === undefined) ctl.uhr = def.uhr0;
      setStartFromCtl(ctl.uhr); start.N = dayN(); N = start.N; tS = start.tS; ctl.tag = ctl.datum === 'frei' ? ctl.tag : start.N;
      initState(false);

      const rig = { id: def.id, tUnit: 'h', h: h, controls: def.controls, meters: def.meters, presets: def.presets, events: ev, params: params,
        setControl, getControl, controlInfo, step, stepProcess, setClock, readMeters, state, draw, hitTest, dragValue, curves, reset, analysis, trace, dayTrace, balance, diagnose, applyPreset,
        worldSize() { return { w: W.w, h: W.h }; }, drawError() { return drawError; }, energy, setDetail(b) { detail = !!b; }, dailyLog() { return daily.slice(); } };
      Object.defineProperty(rig, 'timeScale', { get: ts, enumerable: true });
      Object.defineProperty(rig, 'detail', { get() { return detail; }, set(b) { detail = !!b; }, enumerable: true });
      return rig;
    }

    return { version: '1.0', clamp, num, fm, fn, fin, isObj, norm, TX, ALIAS, sunControls, makeDayRig, hhmm, LAT, ORTE, NDAT, WETTER, LAUF, KAPPA, PHASE, getCore, getDraw };
  })();

  const B = R.baseC;
  const { clamp, num, fm, fn, fin, TX, hhmm, LAT, KAPPA } = B;

  // =====================================================================================================================
  //  Pruefstand insel
  // =====================================================================================================================
  const PAR = { h: 60, uocMaxMppt: 150, uocMaxPwm: 50, kappa: KAPPA, tAkku: 25, tBeginn: 6, nachtSchwelleW: 1 };
  const G_ANL = 'Anlage', G_AKKU = 'Akku und Regler', G_LAST = 'Last und Leitungen';
  const SPECS = [{ value: 'si36', label: 'Modul 36 Zellen (12 V)' }, { value: 'si60', label: 'Modul 60 Zellen' }, { value: 'si72', label: 'Modul 72 Zellen' }];
  const CONTROLS = B.sunControls('Sonne und Wetter', 6, 'sommer').concat([
    { key: 'modul', label: 'Modultyp', type: 'select', value: 'si60', options: SPECS, group: G_ANL, help: 'Übungsmodul mit 36, 60 oder 72 Zellen. Mehr Zellen bedeuten mehr Spannung und mehr Leistung je Modul.' },
    { key: 'ns', label: 'Module in Reihe (Strang)', type: 'slider', scale: 'lin', min: 1, max: 4, step: 1, unit: '', value: 1, group: G_ANL, help: 'Module in Reihe: Die Spannungen addieren sich. Die Leerlaufspannung bei Kälte darf den Eingang des Reglers nicht übersteigen.' },
    { key: 'np', label: 'Stränge parallel', type: 'slider', scale: 'lin', min: 1, max: 4, step: 1, unit: '', value: 2, group: G_ANL, help: 'Stränge parallel: Die Ströme addieren sich, die Spannung bleibt gleich.' },
    { key: 'neigung', label: 'Modulneigung', type: 'slider', scale: 'lin', min: 0, max: 90, step: 1, unit: '°', value: 35, group: G_ANL, help: 'Neigung gegen die Waagerechte (0° = flach, 90° = senkrecht). Im Winter ist es steil besser, im Sommer flach. Du kannst das Modul im Bild ziehen.' },
    { key: 'azimut', label: 'Modulausrichtung', type: 'slider', scale: 'lin', min: -90, max: 90, step: 5, unit: '°', value: 0, group: G_ANL, help: 'Ausrichtung des Moduls: 0° = genau nach Süden, negativ nach Osten, positiv nach Westen.' },
    { key: 'regler', label: 'Reglertyp', type: 'select', value: 'mppt', options: [{ value: 'pwm', label: 'PWM' }, { value: 'mppt', label: 'MPPT' }], group: G_AKKU, help: 'PWM zwingt das Modul auf die Akkuspannung und verschenkt Leistung. MPPT wandelt die Spannung und holt die höchste Leistung aus dem Modul.' },
    { key: 'imax', label: 'Reglerstrom Imax', type: 'select', value: 40, options: [10, 20, 30, 40].map(v => ({ value: v, label: v + ' A' })), group: G_AKKU, help: 'Der Regler gibt höchstens diesen Strom ab. Liefert das Feld mehr, wird abgeregelt und die Leistung geht verloren.' },
    { key: 'chem', label: 'Akkuart', type: 'select', value: 'blei', options: [{ value: 'blei', label: 'Blei (AGM/Gel)' }, { value: 'lifepo4', label: 'Li-Ion (LiFePO4)' }], group: G_AKKU, help: 'Blei ist billig, verträgt aber nur etwa die halbe Kapazität als Entladung. Lithium-Eisenphosphat verträgt tiefere Entladung, die Spannung verrät kaum den Ladezustand.' },
    { key: 'usys', label: 'Systemspannung', type: 'select', value: 12, options: [12, 24, 48].map(v => ({ value: v, label: v + ' V' })), group: G_AKKU, help: 'Nennspannung von Akku und Gleichstromsammelpunkt. Höhere Spannung heißt weniger Strom bei gleicher Leistung und dünnere Leitungen.' },
    { key: 'cap', label: 'Akkukapazität', type: 'slider', scale: 'lin', min: 20, max: 800, step: 10, unit: 'Ah', value: 200, group: G_AKKU, help: 'Nennkapazität in Amperestunden. Die Energie in Wattstunden ist Kapazität mal Systemspannung.' },
    { key: 'soc0', label: 'Ladezustand am Start', type: 'slider', scale: 'lin', min: 5, max: 100, step: 5, unit: '%', value: 50, group: G_AKKU, help: 'Ladezustand des Akkus beim Start und beim Zurücksetzen.' },
    { key: 'lvd', label: 'Tiefentladeschutz', type: 'switch', value: true, group: G_AKKU, help: 'Trennt die Last, wenn der Akku zu leer wird. Ohne den Schutz wird der Akku tiefentladen und nimmt Schaden.' },
    { key: 'wr', label: 'Wechselrichter', type: 'select', value: 'kein', options: [{ value: 'kein', label: 'keiner (Gleichstromlast)' }, { value: '500', label: '500 VA' }, { value: '1000', label: '1000 VA' }, { value: '2000', label: '2000 VA' }], group: G_LAST, help: 'Der Inselwechselrichter macht aus der Akkuspannung 230 V Wechselspannung. Er verbraucht selbst Strom und hat eine Leistungsgrenze.' },
    { key: 'sparmodus', label: 'Sparmodus des Wechselrichters', type: 'switch', value: false, group: G_LAST, visible: s => !!s && s.wr !== 'kein', help: 'Im Sparmodus verbraucht der Wechselrichter ohne Last nur wenig, erkennt aber kleine Verbraucher unter 25 W nicht.' },
    { key: 'lastprofil', label: 'Lastprofil', type: 'select', value: 'gartenhaus', options: [{ value: 'gartenhaus', label: 'Gartenhaus' }, { value: 'camper', label: 'Camper' }, { value: 'pumpe', label: 'Bewässerungspumpe' }, { value: 'frei', label: 'frei (feste Leistung)' }], group: G_LAST, help: 'Welche Geräte zu welchen Zeiten laufen. Der Tagesverbrauch wird aus der Geräteliste gerechnet.' },
    { key: 'pFrei', label: 'Feste Last', type: 'slider', scale: 'lin', min: 0, max: 1500, step: 10, unit: 'W', value: 100, group: G_LAST, visible: s => !!s && s.lastprofil === 'frei', help: 'Konstante Leistung rund um die Uhr. Sie gilt nur beim Lastprofil frei.' },
    { key: 'lPv', label: 'Leitung Modul–Regler', type: 'slider', scale: 'lin', min: 0, max: 20, step: 1, unit: 'm', value: 2, group: G_LAST, help: 'Einfache Länge der Leitung vom Modul zum Regler. Hin- und Rückleitung zählen beide.' },
    { key: 'aPv', label: 'Querschnitt Modul–Regler', type: 'select', value: 4, options: [1.5, 2.5, 4, 6, 10].map(v => ({ value: v, label: String(v).replace('.', ',') + ' mm²' })), group: G_LAST, help: 'Querschnitt der Leitung vom Modul zum Regler. Ein dünnes Kabel verliert Spannung und Leistung.' },
    { key: 'lBat', label: 'Leitung Regler–Akku', type: 'slider', scale: 'lin', min: 0, max: 10, step: 1, unit: 'm', value: 1, group: G_LAST, help: 'Einfache Länge der Leitung zwischen Regler, Akku und Wechselrichter.' },
    { key: 'aBat', label: 'Querschnitt Akku', type: 'select', value: 10, options: [4, 6, 10, 16, 25].map(v => ({ value: v, label: v + ' mm²' })), group: G_LAST, help: 'Querschnitt der Akkuleitung. Hier fließen die größten Ströme, deshalb braucht sie mehr Querschnitt als die Modulleitung.' }
  ]);
  const METERS = [
    { key: 'elev', label: 'Sonnenhöhe', unit: '°', digits: 1, min: -90, max: 90 },
    { key: 'azim', label: 'Sonnenazimut (Süd = 0, West positiv)', unit: '°', digits: 0, min: -180, max: 180 },
    { key: 'gPoa', label: 'Einstrahlung in der Modulebene', unit: 'W/m²', digits: 0, min: 0, max: 1200, warnAbove: 1150 },
    { key: 'tcell', label: 'Zelltemperatur', unit: '°C', digits: 0, min: -20, max: 90, warnAbove: 75 },
    { key: 'pPv', label: 'Solarleistung (Feld, genutzt)', unit: 'W', digits: 0, min: 0, max: 1500 },
    { key: 'pLoad', label: 'Lastleistung', unit: 'W', digits: 0, min: 0, max: 1500 },
    { key: 'pBat', label: 'Akkuleistung (laden positiv)', unit: 'W', digits: 0, min: -1500, max: 1500 },
    { key: 'soc', label: 'Ladezustand', unit: '%', digits: 0, min: 0, max: 100 },
    { key: 'uBat', label: 'Akkuspannung', unit: 'V', digits: 2, min: 0, max: 60 },
    { key: 'ePv', label: 'Solarenergie heute', unit: 'Wh', digits: 0, min: 0, max: 6000 },
    { key: 'eLoad', label: 'Lastenergie heute', unit: 'Wh', digits: 0, min: 0, max: 6000 },
    { key: 'eCurt', label: 'Abgeregelt oder ungenutzt heute', unit: 'Wh', digits: 0, min: 0, max: 6000 },
    { key: 'socMin', label: 'Tiefster Ladezustand heute', unit: '%', digits: 0, min: 0, max: 100 },
    { key: 'autonomie', label: 'Akku reicht noch', unit: 'h', digits: 1, min: 0, max: 100 },
    { key: 'tag', label: 'Tageszähler', unit: '', digits: 0, min: 0, max: 30 },
    { key: 'stage', label: 'Ladephase (0 aus, 1 Bulk, 2 Absorption, 3 Float)', unit: '', digits: 0, min: 0, max: 3, labels: ['aus', 'Bulk', 'Absorption', 'Float'] },
    { key: 'lvdAktiv', label: 'Last getrennt (Tiefentladeschutz)', unit: '', digits: 0, min: 0, max: 1, warnAbove: 0.5 },
    { key: 'tLvd', label: 'Zeit ohne Last durch den Schutz heute', unit: 'h', digits: 1, min: 0, max: 24 }
  ];

  // ---- Lastprofil und Auslegung (alles aus ENR_CORE) ----
  function deviceHours(d) {
    let w = d.fenster || d.window || d.win || (d.von !== undefined ? [d.von, d.bis] : null);
    if (Array.isArray(w) && Array.isArray(w[0])) { let hrs = 0; w.forEach(x => { hrs += Math.max(0, x[1] - x[0]); }); return hrs * (d.duty === undefined ? 1 : d.duty); }
    if (Array.isArray(w) && w.length >= 2) return Math.max(0, w[1] - w[0]) * (d.duty === undefined ? 1 : d.duty);
    return NaN;
  }
  function geraeteVon(C, kind, ac) {
    const pr = C.loads.profile(kind, {}); let list = [];
    if (pr && Array.isArray(pr.devices)) pr.devices.forEach(d => { const hrs = deviceHours(d); if (isFinite(hrs) && num(d.P, NaN) >= 0) list.push({ name: d.name || d.id || 'Gerät', P: d.P, stunden: hrs, typ: ac ? 'ac' : 'dc' }); });
    const sum = list.reduce((s, g) => s + g.P * g.stunden, 0), e = pr ? num(pr.energyWh, NaN) : NaN;
    if (!list.length || (isFinite(e) && Math.abs(sum - e) > 0.02 * Math.max(1, e))) list = [{ name: kind, P: (isFinite(e) ? e : sum) / 24, stunden: 24, typ: ac ? 'ac' : 'dc' }];
    return list;
  }
  function designFor(C, kind, usys, ac, o) {
    o = o || {}; const inp = { geraete: geraeteVon(C, kind, ac), Usys: usys, tage: 2, ort: 'mitte', tag: 355, wetter: 'wolkig', neigung: null, azimut: 0, chem: 'blei', dod: null, PR: 0.65, modul: 'si60', laenge: { pv: 2, akku: 1, wr: 1 }, spannungsfall: 0.02, wrSparmodus: false };
    const r = C.design.autoDesign(inp); return r && r.ok !== false ? r : null;
  }
  const pickOpt = (list, v, last) => { for (let i = 0; i < list.length; i++) if (list[i] >= v) return list[i]; return last === false ? list[list.length - 1] : list[list.length - 1]; };
  function presetFromDesign(kind, usys, ac, extra) {
    // Anlagengroesse kommt aus design.autoDesign (nicht von Hand); ohne Kern bleiben die Rueckfallwerte
    const fb = { modul: 'si60', ns: 1, np: 2, cap: 200, imax: 40, neigung: 35 };
    try {
      const C = B.getCore(), r = designFor(C, kind, usys, ac); if (!r) return Object.assign({ derived: false }, fb, extra);
      const st = r.strang || {}; let ns = clamp(Math.round(num(st.ns, 1)), 1, 4), np = clamp(Math.round(num(st.np, Math.ceil(num(r.nModule, 2) / ns))), 1, 4);
      const cap = clamp(Math.round(num(r.akkuAh, 200) / 10) * 10, 20, 800), imax = pickOpt([10, 20, 30, 40], num(r.reglerA, 20));
      let neigh = num(r.neigung, NaN); if (!isFinite(neigh)) { try { neigh = C.sun.bestTilt(355, LAT.mitte, 0, 0.625); } catch (e) { neigh = 35; } }
      return Object.assign({ derived: true, modul: 'si60', ns: ns, np: np, cap: cap, imax: imax, neigung: clamp(Math.round(neigh), 0, 90), wrVA: num(r.wrVA, 500) }, extra);
    } catch (e) { return Object.assign({ derived: false }, fb, extra); }
  }
  const pGarten = presetFromDesign('gartenhaus', 12, false, {});
  const pCamper = presetFromDesign('camper', 24, false, {});
  const pPumpe = presetFromDesign('pumpe', 24, true, {});
  const wrOpt = v => String(pickOpt([500, 1000, 2000], num(v, 500)));
  const PRESETS = [
    { id: 'sommer', name: 'Sommertag klar', params: { datum: 'sommer', wetter: 'klar', uhr: 6 } },
    { id: 'winter-bedeckt', name: 'Winter bedeckt', params: { datum: 'winter', wetter: 'bedeckt', uhr: 7, soc0: 80, lauf: 'schnell' } },
    { id: 'gartenhaus', name: 'Gartenhaus (Anlage aus der Auslegung gerechnet)', derived: pGarten.derived, params: { lastprofil: 'gartenhaus', usys: 12, wr: 'kein', modul: pGarten.modul, ns: pGarten.ns, np: pGarten.np, cap: pGarten.cap, imax: pGarten.imax, neigung: pGarten.neigung, datum: 'winter', wetter: 'wolkig', uhr: 7, soc0: 100 } },
    { id: 'camper', name: 'Camper (24 V)', derived: pCamper.derived, params: { lastprofil: 'camper', usys: 24, wr: 'kein', modul: pCamper.modul, ns: pCamper.ns, np: pCamper.np, cap: pCamper.cap, imax: pCamper.imax, neigung: pCamper.neigung, datum: 'sommer', wetter: 'heiter', uhr: 6, soc0: 80 } },
    { id: 'pumpe', name: 'Bewässerungspumpe (230 V über Wechselrichter)', derived: pPumpe.derived, params: { lastprofil: 'pumpe', usys: 24, wr: wrOpt(pPumpe.wrVA), modul: pPumpe.modul, ns: pPumpe.ns, np: pPumpe.np, cap: pPumpe.cap, imax: pPumpe.imax, neigung: pPumpe.neigung, datum: 'sommer', wetter: 'klar', uhr: 6, soc0: 80 } },
    { id: 'standby', name: 'Wechselrichter-Standby', params: { wr: '1000', sparmodus: false, lastprofil: 'frei', pFrei: 0, datum: 'sommer', wetter: 'klar', uhr: 22, soc0: 80 } },
    { id: 'steil-winter', name: 'Steile Montage im Winter', params: { neigung: 60, datum: 'winter', wetter: 'klar', uhr: 8 } }
  ];

  // ---- Konfiguration, Zaehler, Messwerte ----
  function buildCfg(ctl, s, w) {
    const wr = ctl.wr === 'kein' ? null : { modell: 'insel', Sn: +ctl.wr, sparmodus: !!ctl.sparmodus };
    return { typ: 'insel', ort: ctl.ort, N: s.N, tS: s.tS, tage: 365, neigung: ctl.neigung, azimut: ctl.azimut, wetter: w, feld: { spec: ctl.modul, ns: ctl.ns, np: ctl.np },
      regler: { typ: ctl.regler, Imax: ctl.imax, Uocmax: ctl.regler === 'pwm' ? s.params.uocMaxPwm : s.params.uocMaxMppt, tempComp: ctl.chem === 'blei', lvd: !!ctl.lvd, lLeitung: ctl.lPv, qLeitung: ctl.aPv, lPv: ctl.lPv, aPv: ctl.aPv, lBat: ctl.lBat, aBat: ctl.aBat },
      akku: { chem: ctl.chem, Usys: ctl.usys, C: ctl.cap, soc0: clamp(s.soc0, 0, 1), T: s.params.tAkku }, wr: wr, last: { profil: ctl.lastprofil, faktor: 1, pFrei: ctl.pFrei }, h: PAR.h };
  }
  function integrate(E, st, dtH, ctl) {
    E.ePv += st.pPv * dtH; E.eLoad += st.pLoad * dtH; E.eCurt += st.pCurt * dtH; E.ePot += st.pPot * dtH;
    if (st.pBat > 0) E.eBatIn += st.pBat * dtH; else E.eBatOut += -st.pBat * dtH;
    E.uMax = Math.max(E.uMax, st.uBat); if (st.uBat > 0) E.uMin = Math.min(E.uMin, st.uBat); if (st.lvdAktiv) E.tLvd += dtH;
  }
  function sample(st) {
    return { pv: st.pPv, load: st.pLoad, bat: st.pBat, soc: st.soc * 100, netz: 0, pot: st.pPot, haus: 0, ac: 0, sp: 0, tr: { g: st.gPoa, pPv: st.pPv, pLoad: st.pLoad, pBat: st.pBat, soc: st.soc * 100, uBat: st.uBat } };
  }
  function meters(c) {
    const st = c.st || B.norm(null), E = c.E || {}, ctl = c.ctl;
    const pDc = st.pLoadDc > 0 ? st.pLoadDc : st.pLoad;
    const ah = st.soc * ctl.cap * (st.uBat > 0 ? st.uBat : 0);
    const aut = pDc > 0.5 ? ah / pDc : 999;
    return { elev: st.elev, azim: st.azim, gPoa: st.gPoa, tcell: st.tcell, pPv: st.pPv, pLoad: st.pLoad, pBat: st.pBat, soc: st.soc * 100, uBat: st.uBat, ePv: E.ePv, eLoad: E.eLoad, eCurt: E.eCurt,
      socMin: (E.n ? E.socMin : st.soc) * 100, autonomie: Math.min(aut, 999), tag: c.tagCount || 0, stage: st.stage, lvdAktiv: st.lvdAktiv ? 1 : 0, tLvd: E.tLvd };
  }

  // ---- Meldungen (jede nur bei geprueft erfuellter Bedingung, Texte aus ENR_CORE.TEXTS) ----
  function lineLoss(ctl, I, a, l) { const R = 2 * l / (KAPPA * a), dU = Math.abs(I) * R; return { R: R, dU: dU, P: I * I * R }; }
  function diag(c) {
    const st = c.st, ctl = c.ctl, C = c.C, out = [], su = c.sun; if (!st) return out;
    const add = (id, kind, vars, fx) => { const d = { id: id, kind: kind, text: TX(C, id, vars) }; if (fx) d.fx = fx; out.push(d); };
    if (st.gPoa < 1) add('nacht', 'info', {});
    if (su.polar === 'nacht') add('polarnacht', 'info', {});
    if (st.regDead) { const uoc = st.uOc > 0 ? st.uOc : 0; add('regler-tot', 'error', { x: fm(uoc, 0), y: fm(ctl.regler === 'pwm' ? c.params.uocMaxPwm : c.params.uocMaxMppt, 0) }, 'crash'); }
    const lvdLow = (ctl.chem === 'blei' ? 11.1 : 11.2) * ctl.usys / 12;
    if (st.soc < 0.10 || (!ctl.lvd && st.uBat > 0 && st.uBat < lvdLow && st.pLoad > 0)) add('tiefentladung', 'error', { x: fm(st.soc * 100, 0) });
    if (st.wrOverload || (ctl.wr !== 'kein' && st.sApp > +ctl.wr && st.sApp > 0)) add('wr-ueberlast', 'error', { x: fm(st.sApp, 0), y: fm(+ctl.wr, 0) });
    if (st.pCurt > 1 && st.uBat > 0 && st.pPv / st.uBat >= 0.98 * ctl.imax) add('regler-strom', 'warn', { x: fm(ctl.imax, 0), y: fm(st.pPv + st.pCurt, 0), z: fm(st.pPv, 0) });
    if (st.bmsAus) add('bms-aus', 'warn', {});
    if (st.gasAh > 0 && c.prev && st.gasAh > c.prev.gasAh) add('ueberladung', 'error', { x: fm(st.uBat, 2) }, 'bubbles');
    // Die Modulleitung fuehrt den Strom bei Modulspannung (MPPT: Strangspannung, PWM: Akkuspannung), nicht den Sammelpunktstrom
    const U = ctl.regler === 'mppt' && st.uMpp > 0 ? st.uMpp : (st.uBat > 0 ? st.uBat : ctl.usys), iM = st.pPv > 0 ? st.pPv / U : 0, l1 = lineLoss(ctl, iM, ctl.aPv, ctl.lPv);
    if (iM > 0 && l1.dU / U > 0.03) add('kabel-spannungsfall', 'warn', { x: fm(l1.dU, 2), y: fm(l1.dU / U * 100, 1), z: fm(l1.P, 1) });
    return out;
  }
  function edges(c) {
    const st = c.st, p = c.prev, ctl = c.ctl, C = c.C, out = [], su = c.sun; if (!st || !p) return out;
    const add = (id, kind, vars, fx, key) => { const d = { id: id, kind: kind, text: TX(C, id, vars), key: key || id }; if (fx) d.fx = fx; out.push(d); };
    if (p.elev <= 0 && st.elev > 0) add('sonnenaufgang', 'info', { x: hhmm(c.tS) }, 'ding');
    if (p.elev > 0 && st.elev <= 0) add('sonnenuntergang', 'info', { x: hhmm(c.tS) });
    if (st.stage !== p.stage && st.stage >= 1) add('ladeschluss', 'info', { phase: B.PHASE[st.stage], x: fm(st.uBat, 2), y: fm(Math.abs(st.iBat), 1) }, null, 'ladeschluss:' + st.stage);
    if (st.lvdAktiv && !p.lvdAktiv) {
      add('lvd-aus', 'warn', { x: fm(st.uBat, 2) }, 'buzz');
      if (st.elev <= 0 && c.E) {
        // Bedarf der Nacht aus dem Lastprofil (loads.power), Beitrag des Akkus seit Sonnenuntergang; nur wenn beide gerechnet werden koennen
        try {
          const pr = C.loads.profile(ctl.lastprofil, { pFrei: ctl.pFrei }), pol = su.polar === 'nacht', set = pol ? 0 : (isFinite(su.set) ? su.set : 18), len = pol ? 24 : ((isFinite(su.rise) ? su.rise : 6) - set + 24) % 24; let need = 0;
          for (let m = 0; m < len * 60; m++) need += C.loads.power(pr, (set + m / 60) % 24) / 60;
          if (isFinite(need)) add('akku-leer-nacht', 'warn', { x: fm(c.nightBat, 0), y: fm(need, 0) });
        } catch (e) { /* ohne Zahl keine Aussage */ }
      }
    }
    if (!st.lvdAktiv && p.lvdAktiv) add('lvd-wieder', 'info', { x: fm(st.uBat, 2) });
    if (st.soc >= 0.99 && p.soc < 0.99) add('akku-voll', 'info', { x: fm(st.soc * 100, 0) }, 'confetti');
    if (ctl.wr !== 'kein' && st.pLoad < 1 && st.pStandby > 0 && st.elev <= 0) add('wr-standby', 'info', { x: fm(st.pStandby, 1), y: fm(st.pStandby * 24, 0) }, null, 'wr-standby:' + c.N);
    return out;
  }

  // ---- Szene, Zeichnen ----
  function scene(c, st) {
    const ctl = c.ctl, ac = ctl.wr !== 'kein', jet = ctl.lastprofil === 'pumpe' && st.pLoad >= 100;
    const flows = [
      { id: 'pv', from: 'modul', to: 'regler', P: st.pPv, kind: 'solar', label: 'Solar' },
      { id: 'bat-in', from: 'regler', to: 'akku', P: Math.max(0, st.pBat), kind: 'laden', label: 'Akku lädt' },
      { id: 'bat-out', from: 'akku', to: ac ? 'wr' : 'last', P: Math.max(0, -st.pBat), kind: 'entladen', label: 'Akku entlädt' },
      { id: 'last', from: ac ? 'wr' : 'regler', to: 'last', P: st.pLoad, kind: 'last', label: 'Last' }
    ];
    if (c.params && true) {
      flows.push({ id: 'verl-regler', from: 'regler', to: 'verlust', P: Math.max(0, st.pPot - st.pCurt - st.pPv), kind: 'verlust', label: 'Reglerverlust', loss: true });
      if (ac) flows.push({ id: 'verl-wr', from: 'wr', to: 'verlust', P: Math.max(0, (st.pLoadDc > 0 ? st.pLoadDc : st.pLoad) - st.pLoad), kind: 'verlust', label: 'Wechselrichterverlust', loss: true });
    }
    return { house: { kind: 'gartenhaus', lamps: st.pLoad >= 1 && !st.lvdAktiv, pump: ctl.lastprofil === 'pumpe' && st.pLoad >= 100, jet: jet },
      modules: { spec: ctl.modul, ns: ctl.ns, np: ctl.np, beta: ctl.neigung, gam: ctl.azimut, tc: st.tcell },
      flows: flows,
      tech: { batt: { soc: st.soc, gas: st.gasAh > 0, warn: st.lvdAktiv || st.soc < 0.2, u: st.uBat, i: st.iBat, p: st.pBat, chem: ctl.chem, usys: ctl.usys, cap: ctl.cap },
        ctrl: { type: ctl.regler, stage: st.stage, duty: clamp(st.pPot > 0 ? st.pPv / st.pPot : 0, 0, 1), uv: st.uBat, ii: st.uBat > 0 ? st.pPv / st.uBat : 0, dead: st.regDead },
        inv: { on: ac, pAc: st.pLoad, sn: ac ? +ctl.wr : 0, standby: st.pStandby, overload: st.wrOverload } },
      labels: { status: st.lvdAktiv ? 'Last getrennt (Tiefentladeschutz)' : (st.gPoa < 1 ? 'Nacht: Der Akku trägt die Last' : ''), bubble: st.regDead ? 'Regler zerstört' : '' } };
  }
  function hit(k, c, st, u) {
    const ctl = c.ctl;
    if (k === 'wolke') return { key: 'wetter', kind: 'switch', to: u.WETTER_NEXT[ctl.wetter] || 'klar' };
    if (k === 'akku') return { kind: 'info', id: 'akku', title: 'Akku', text: (ctl.chem === 'blei' ? 'Blei' : 'Li-Ion (LiFePO4)') + ', ' + ctl.usys + ' V, ' + ctl.cap + ' Ah: Ladezustand ' + u.fm(st.soc * 100, 0) + ' %, Spannung ' + u.fm(st.uBat, 2) + ' V, Strom ' + u.fm(st.iBat, 1) + ' A (laden positiv).' };
    if (k === 'regler') return { kind: 'info', id: 'regler', title: 'Laderegler', text: (ctl.regler === 'mppt' ? 'MPPT' : 'PWM') + ', höchstens ' + ctl.imax + ' A: Phase ' + B.PHASE[clamp(Math.round(st.stage), 0, 3)] + ', Solarleistung ' + u.fm(st.pPv, 0) + ' W, möglich wären ' + u.fm(st.pPot, 0) + ' W.' };
    if (k === 'wr') return ctl.wr === 'kein' ? null : { kind: 'info', id: 'wr', title: 'Wechselrichter', text: ctl.wr + ' VA: Last ' + u.fm(st.pLoad, 0) + ' W, Scheinleistung ' + u.fm(st.sApp, 0) + ' VA, Eigenverbrauch im Stillstand ' + u.fm(st.pStandby, 1) + ' W.' };
    if (k === 'lampe' || k === 'pumpe') { const on = ctl.lastprofil === 'frei' && ctl.pFrei > 0; return { key: 'pFrei', kind: 'switch', to: on ? 0 : (k === 'pumpe' ? 250 : 20), also: { lastprofil: 'frei' } }; }
    return null;
  }

  // ---- Kennlinien ----
  const energyCache = {};
  function energyOverTilt(c) {
    const C = c.C, ctl = c.ctl, w = c.ctl.wetter === 'frei' ? clamp(ctl.wolken, 0, 100) / 100 : ({ klar: 0, heiter: 0.25, wolkig: 0.625, bedeckt: 1, wechselhaft: 0.5 }[ctl.wetter] || 0);
    const key = [c.N, ctl.ort, ctl.azimut, w].join('|'); if (energyCache[key]) return energyCache[key];
    const pts = []; for (let b = 0; b <= 90; b += 5) { let v = 0; try { v = C.sun.dayEnergy({ N: c.N, lat: LAT[ctl.ort], beta: b, gam: ctl.azimut, c: w }); } catch (e) { v = 0; } pts.push([b, fin(v)]); }
    let best = 0; try { best = C.sun.bestTilt(c.N, LAT[ctl.ort], ctl.azimut, w); } catch (e) { best = 0; }
    const keys = Object.keys(energyCache); if (keys.length > 12) delete energyCache[keys[0]];
    return (energyCache[key] = { points: pts, best: fin(best), c: w });
  }
  function curves(c, x) {
    const st = c.st || B.norm(null), E = c.E, dt = x.dayTrace(), ctl = c.ctl;
    const sp = x.sunPath(c.N), ps = x.sunPath(172), pw = x.sunPath(355), up = p => { const o = []; for (let i = 0; i < p.t.length; i++) if (p.alt[i] >= 0) o.push([+p.az[i].toFixed(2), +p.alt[i].toFixed(2)]); return o; };
    const zip = a => dt.t.map((tt, i) => [tt, +a[i].toFixed(3)]);
    const et = energyOverTilt(c);
    const verl = Math.max(0, E.ePv - E.eLoad - (E.eBatIn - E.eBatOut));
    return [
      { id: 'tagesgang', kind: 'day', title: 'Tagesgang', xLabel: 'Sonnenzeit', xUnit: 'h', yLabel: 'Leistung bzw. Einstrahlung', yUnit: 'W oder W/m²', now: dt.now, night: { rise: dt.rise, set: dt.set, polar: dt.polar },
        series: [{ name: 'Einstrahlung bei klarem Himmel (Potenzial)', points: dt.t.map((tt, i) => [tt, +dt.gClear[i].toFixed(1)]), dashed: true, line: 'dash' }, { name: 'Einstrahlung', points: zip(dt.g), line: 'solid' },
          { name: 'Solarleistung', points: zip(dt.pv), line: 'solid' }, { name: 'Lastleistung', points: zip(dt.load), line: 'dot' }, { name: 'Ladezustand (%)', points: zip(dt.soc), axis: 'right', unit: '%', line: 'dashdot' }], marker: { x: dt.now, y: st.pPv } },
      { id: 'sonnenbahn', kind: 'sun', title: 'Sonnenbahn', xLabel: 'Azimut (Süd = 0, West positiv)', xUnit: '°', yLabel: 'Sonnenhöhe', yUnit: '°',
        series: [{ name: 'Heute', points: up(sp), line: 'solid' }, { name: '21. Juni', points: up(ps), dashed: true, line: 'dash' }, { name: '21. Dezember', points: up(pw), dashed: true, line: 'dot' }], marker: { x: st.azim, y: st.elev } },
      { id: 'energie', kind: 'bars', title: 'Energie heute', yUnit: 'Wh', bars: [{ id: 'solar', label: 'Solar', value: +E.ePv.toFixed(1), unit: 'Wh' }, { id: 'last', label: 'Last', value: +E.eLoad.toFixed(1), unit: 'Wh' },
        { id: 'abgeregelt', label: 'Abgeregelt oder ungenutzt', value: +E.eCurt.toFixed(1), unit: 'Wh' }, { id: 'verluste', label: 'Verluste (Rest der Bilanz)', value: +verl.toFixed(1), unit: 'Wh' }] },
      { id: 'neigung', kind: 'line', title: 'Ertrag über der Neigung (heutiger Tag)', xLabel: 'Neigung', xUnit: '°', yLabel: 'Tagesenergie je m² Modulfläche', yUnit: 'kWh/m²', series: [{ name: 'Tagesenergie', points: et.points, line: 'solid' }],
        marker: { x: ctl.neigung, y: (et.points.find(p => p[0] === Math.round(ctl.neigung / 5) * 5) || [0, 0])[1] }, best: { x: et.best } },
      { id: 'mehrtage', kind: 'line', title: 'Ladezustand über mehrere Tage', xLabel: 'Tage seit Start', xUnit: 'd', yLabel: 'Ladezustand', yUnit: '%', series: [{ name: 'Ladezustand', points: x.SH.x.map((v, i) => [v, x.SH.y[i]]), line: 'solid' }], marker: { x: x.tagCount + c.tS / 24, y: st.soc * 100 } }
    ];
  }
  const dsgCache = {};
  function analysis(c, st) {
    const ctl = c.ctl, C = c.C, ac = ctl.wr !== 'kein', key = [ctl.lastprofil, ctl.pFrei, ctl.usys, ac].join('|');
    if (!dsgCache[key]) { let r = null; try { r = ctl.lastprofil === 'frei' ? null : designFor(C, ctl.lastprofil, ctl.usys, ac); } catch (e) { r = null; } dsgCache[key] = r || { ok: false }; }
    const r = dsgCache[key]; let pm = 0; try { pm = C.pv.keys(ctl.modul, { G: 1000, Tc: 25 }).Pmpp * ctl.ns * ctl.np; } catch (e) { pm = 0; }
    let prof = null; try { prof = C.loads.profile(ctl.lastprofil, { pFrei: ctl.pFrei }); } catch (e) { prof = null; }
    return { ok: true, state: st, design: r.ok === false ? { ok: false } : { ok: true, pPvNoetig: fin(r.pPv), modulePv: fin(r.nModule), akkuAh: fin(r.akkuAh), reglerA: fin(r.reglerA), wrVA: fin(r.wrVA), tagesWh: fin(r.tagesWh) },
      anlage: { pPvSTC: fin(pm), akkuWh: ctl.cap * ctl.usys, tagesWh: prof ? fin(prof.energyWh) : 0 } };
  }

  R.register({
    id: 'insel', name: 'Inselanlage im Tagesgang', icon: '\u{1F3E1}',
    info: 'Das ganze Inselsystem über den Tag und über mehrere Tage: Die Sonne wandert, Wolken ziehen, das Feld lädt über den Regler den Akku, Lasten laufen aus dem Akku (auf Wunsch über einen Wechselrichter). Die Energieflüsse sind in der Strichstärke nach Leistung gezeichnet.',
    controls: CONTROLS, meters: METERS, presets: PRESETS,
    create(opts) {
      return B.makeDayRig({ id: 'insel', h: PAR.h, params: PAR, controls: CONTROLS, meters: METERS, presets: PRESETS, world: { w: 1000, h: 640 }, uhr0: PAR.tBeginn,
        beta: ctl => ctl.neigung, gam: ctl => ctl.azimut, buildCfg: buildCfg, integrate: integrate, sample: sample, meterFn: meters, diag: diag, edges: edges, scene: scene, hit: hit,
        hitOrder: ['akku', 'regler', 'wr', 'lampe', 'pumpe'], curves: curves, analysis: analysis, live: [] }, opts);
    }
  });

  if (typeof module !== 'undefined') module.exports = R;
})(typeof window !== 'undefined' ? window : globalThis);
