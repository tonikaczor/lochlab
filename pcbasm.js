'use strict';
/* Tonfunk Leiterplatten-Lab: Bestückung und Löten.
   Ansichten:  asm    = Bestückungsplan, Stückliste, Pick&Place, Reihenfolge-Spiel, Bauteil-Erkennung
               solder = Reflow-Lötsimulation (Pastendruck, Bestückung, Profil, Ergebnis) und Handlöten
   Teil A (Logik) ist reine Berechnung ohne DOM und läuft auch in Node: window.PCB_ASM / module.exports
       PCB_ASM.reflow(board, profile, opts)  -> { joints:[{ref,pad,result,reason,...}], ok, warnings, metrics, counts }
       PCB_ASM.handSolder(params)            -> { quality, defects:[...], joint, notes }
       PCB_ASM.orderScore(order, board)      -> { score, errors, ideal }
   Alle Ergebnisse sind deterministisch aus Seed + Parametern (kein Math.random in Teil A).
   Teil B (Oberfläche) registriert PCB_VIEWS 'asm' und 'solder'. */
(function (root) {
  /* ====================================================================================
     TEIL A: LOGIK (ohne DOM)
     ==================================================================================== */
  const fm = (v, d) => (+v).toFixed(d == null ? 1 : d).replace('.', ',');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function hash(seed, str) {            // deterministisch in [0,1)
    let h = (2166136261 ^ (seed | 0)) >>> 0;
    str = String(str);
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0;
    h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995) >>> 0; h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  function core() { return root.PCB_CORE || (typeof globalThis !== 'undefined' ? globalThis.PCB_CORE : null) || null; }

  /* ---------- Beschreibung der Ergebnisse ---------- */
  const RESULTS = {
    gut: { t: 'Gute Lötstelle', col: '#4cd964', x: 'Glänzender, leicht hohler Meniskus (Kehle) rund um den Anschluss, Pad und Anschluss sind vollständig benetzt.', fix: '' },
    kalt: { t: 'Kalte Lötstelle', col: '#ffb340', x: 'Das Lot ist nicht richtig geschmolzen oder zu schnell erstarrt: matt, körnig, kugelig. Die Verbindung hält schlecht und macht Wackelkontakt.', fix: 'Peak über 235 °C und mindestens 30 s über Liquidus (217 °C) einstellen, Abkühlrate nicht unter 1 °C/s.' },
    bruecke: { t: 'Lötbrücke', col: '#ff5c5c', x: 'Zu viel Paste fließt zwischen zwei Pads zusammen und schließt sie kurz.', fix: 'Dünnere Schablone oder kleinerer Öffnungsfaktor, vor allem bei engem Pad-Abstand.' },
    tombstone: { t: 'Tombstone (Grabstein)', col: '#ff5c5c', x: 'Ein Ende des Bauteils schmilzt früher, die Oberflächenspannung zieht es hoch, das andere Ende hat keinen Kontakt.', fix: 'Pads gleich groß und symmetrisch anbinden (Thermals), langsamere Rampe und ausreichend langes Soak, Bauteil mittig platzieren.' },
    zinnperlen: { t: 'Zinnperlen', col: '#ffb340', x: 'Kleine Lotkugeln neben dem Bauteil. Sie entstehen, wenn Paste unter dem Bauteil herausgedrückt wird oder Flussmittel zu schnell ausgast.', fix: 'Rampe unter 3 °C/s, Soak lang genug (mindestens 60 s), Pastenmenge und Öffnungsfaktor nicht zu groß.' },
    zuwenig: { t: 'Zu wenig Lot', col: '#ffb340', x: 'Das Pad ist nur dünn benetzt, der Meniskus fehlt. Die Verbindung ist mechanisch schwach.', fix: 'Dickere Schablone oder größerer Öffnungsfaktor; bei sehr kleinen Pads auf Flächenverhältnis (Area Ratio) achten.' },
    benetzung: { t: 'Benetzungsfehler', col: '#ffb340', x: 'Das Lot zieht sich zusammen und benetzt das Pad nicht (Dewetting). Das Flussmittel war schon verbraucht oder das Pad oxidiert.', fix: 'Soak höchstens 120 s und höchstens etwa 190 °C am Ende, damit das Flussmittel zum Schmelzen noch wirkt.' },
    ueberhitzt: { t: 'Überhitzt', col: '#ff5c5c', x: 'Zu heiß oder zu lange über Liquidus: Pad und Lot sind verfärbt, Flussmittel verbrannt, Bauteil und Pad können Schaden nehmen.', fix: 'Peak höchstens 250 °C, Zeit über Liquidus höchstens 90 s.' }
  };
  const RESULT_ORDER = ['gut', 'kalt', 'bruecke', 'tombstone', 'zinnperlen', 'zuwenig', 'benetzung', 'ueberhitzt'];

  /* ---------- Reflow-Profil ---------- */
  const DEFAULT_PROFILE = { ramp: 2, soakTime: 90, soakEnd: 180, peak: 245, tal: 60, cool: 3 };
  const DEFAULT_STENCIL = { t: 0.12, f: 0.9 };
  const PROFILES = {
    standard: { n: 'Standard bleifrei', p: { ramp: 2, soakTime: 90, soakEnd: 180, peak: 245, tal: 60, cool: 3 } },
    steil: { n: 'Zu steil', p: { ramp: 4.6, soakTime: 40, soakEnd: 170, peak: 245, tal: 60, cool: 3 } },
    heiss: { n: 'Zu heiß', p: { ramp: 2, soakTime: 90, soakEnd: 180, peak: 262, tal: 100, cool: 3 } },
    kalt: { n: 'Zu kalt', p: { ramp: 2, soakTime: 90, soakEnd: 180, peak: 224, tal: 18, cool: 3 } },
    soak: { n: 'Soak zu lang', p: { ramp: 2, soakTime: 170, soakEnd: 195, peak: 245, tal: 60, cool: 3 } },
    langsam: { n: 'Zu langsam gekühlt', p: { ramp: 2, soakTime: 90, soakEnd: 180, peak: 245, tal: 60, cool: 0.5 } }
  };
  const LIQ = 217;
  function mergeProfile(p) { const o = {}; for (const k in DEFAULT_PROFILE) o[k] = p && isFinite(p[k]) ? +p[k] : DEFAULT_PROFILE[k]; return o; }
  function mergeStencil(s) { return { t: s && isFinite(s.t) ? +s.t : DEFAULT_STENCIL.t, f: s && isFinite(s.f) ? +s.f : DEFAULT_STENCIL.f }; }

  /* Kurvenpunkte und Kennwerte */
  function profileCurve(profile) {
    const p = mergeProfile(profile), ramp = Math.max(0.05, p.ramp), cool = Math.max(0.05, p.cool);
    const t1 = (150 - 25) / ramp, t2 = t1 + Math.max(0, p.soakTime), soakEnd = Math.max(150, p.soakEnd);
    const melts = p.peak > LIQ;
    const tr = melts ? (p.peak - LIQ) / ramp : 0, tf = melts ? (p.peak - LIQ) / cool : 0;
    const talAct = melts ? Math.max(p.tal, tr + tf) : 0, hold = melts ? talAct - tr - tf : 0;
    const t3 = t2 + Math.max(0, (Math.min(LIQ, p.peak) - soakEnd)) / ramp;
    const t4 = t3 + tr, t5 = t4 + hold, t6 = t5 + Math.max(0, p.peak - 100) / cool;
    const pts = [
      { t: 0, T: 25, id: 'start' }, { t: t1, T: 150, id: 'preheat' }, { t: t2, T: soakEnd, id: 'soak' },
      { t: t3, T: Math.min(LIQ, p.peak), id: 'liq' }, { t: t4, T: p.peak, id: 'peak' }, { t: t5, T: p.peak, id: 'peakEnd' }, { t: t6, T: 100, id: 'end' }];
    return { pts, total: t6, metrics: { ramp: p.ramp, soakTime: p.soakTime, soakEnd, peak: p.peak, tal: talAct, cool: p.cool, hold, tLiq: t3, tPeak: t4, tPeakEnd: t5, melts }, profile: p };
  }
  function tempAt(curve, t) {
    const a = curve.pts;
    if (t <= 0) return a[0].T;
    for (let i = 1; i < a.length; i++) if (t <= a[i].t) { const u = a[i].t > a[i - 1].t ? (t - a[i - 1].t) / (a[i].t - a[i - 1].t) : 1; return a[i - 1].T + (a[i].T - a[i - 1].T) * u; }
    return a[a.length - 1].T;
  }
  /* Warnungen: level 'bad' (führt zu Fehlern) oder 'warn' (grenzwertig) */
  function profileCheck(profile) {
    const c = profileCurve(profile), m = c.metrics, w = [];
    const add = (level, id, text) => w.push({ level, id, text });
    if (m.ramp > 4) add('bad', 'ramp', 'Aufheizrate ' + fm(m.ramp) + ' °C/s ist viel zu steil: thermischer Schock, ungleiches Aufheizen (Tombstone) und Zinnperlen.');
    else if (m.ramp > 3) add('warn', 'ramp', 'Aufheizrate ' + fm(m.ramp) + ' °C/s ist zu steil (höchstens 3 °C/s).');
    else if (m.ramp < 0.7) add('warn', 'ramp', 'Aufheizrate ' + fm(m.ramp) + ' °C/s ist sehr flach: das Flussmittel ist verbraucht, bevor das Lot schmilzt.');
    if (m.soakTime < 40) add('bad', 'soak', 'Soak nur ' + Math.round(m.soakTime) + ' s: Flussmittel wird nicht aktiv, die Platine heizt ungleichmäßig auf (mindestens 60 s).');
    else if (m.soakTime < 60) add('warn', 'soak', 'Soak ' + Math.round(m.soakTime) + ' s ist zu kurz (60 bis 120 s).');
    else if (m.soakTime > 150) add('bad', 'soak', 'Soak ' + Math.round(m.soakTime) + ' s ist viel zu lang: das Flussmittel ist verbraucht, das Lot benetzt schlecht.');
    else if (m.soakTime > 120) add('warn', 'soak', 'Soak ' + Math.round(m.soakTime) + ' s ist zu lang (60 bis 120 s).');
    if (m.soakEnd > 190) add('warn', 'soakEnd', 'Soak-Ende bei ' + Math.round(m.soakEnd) + ' °C: das Flussmittel verbrennt vorzeitig (bis etwa 190 °C).');
    if (m.peak <= LIQ) add('bad', 'peak', 'Peak ' + Math.round(m.peak) + ' °C erreicht den Liquidus (217 °C) nicht: die Paste schmilzt nicht.');
    else if (m.peak < 230) add('bad', 'peak', 'Peak ' + Math.round(m.peak) + ' °C ist zu kalt: kalte Lötstellen (mindestens 235 °C).');
    else if (m.peak < 235) add('warn', 'peak', 'Peak ' + Math.round(m.peak) + ' °C ist knapp: große Pads erreichen die Schmelztemperatur nicht (235 bis 250 °C).');
    else if (m.peak >= 255) add('bad', 'peak', 'Peak ' + Math.round(m.peak) + ' °C ist zu heiß: Bauteile und Pads werden geschädigt (höchstens 250 °C).');
    else if (m.peak > 250) add('warn', 'peak', 'Peak ' + Math.round(m.peak) + ' °C ist zu heiß (höchstens 250 °C).');
    if (m.melts) {
      if (m.tal < 20) add('bad', 'tal', 'Nur ' + Math.round(m.tal) + ' s über Liquidus: das Lot benetzt nicht richtig (30 bis 90 s).');
      else if (m.tal < 30) add('warn', 'tal', Math.round(m.tal) + ' s über Liquidus sind zu kurz (30 bis 90 s).');
      else if (m.tal > 110) add('bad', 'tal', Math.round(m.tal) + ' s über Liquidus sind viel zu lang: Lot und Bauteile überhitzt.');
      else if (m.tal > 90) add('warn', 'tal', Math.round(m.tal) + ' s über Liquidus sind zu lang (30 bis 90 s).');
    }
    if (m.cool > 6) add('bad', 'cool', 'Abkühlrate ' + fm(m.cool) + ' °C/s ist viel zu schnell: Keramikkondensatoren können reißen.');
    else if (m.cool > 4) add('warn', 'cool', 'Abkühlrate ' + fm(m.cool) + ' °C/s ist zu schnell (1 bis 4 °C/s).');
    else if (m.cool < 1) add('warn', 'cool', 'Abkühlrate ' + fm(m.cool, 1) + ' °C/s ist zu langsam: grobes, mattes Lotgefüge.');
    return { warnings: w, curve: c, metrics: m, ok: !w.length };
  }

  /* ---------- Pads, Paste ---------- */
  const isSmdPad = p => !(p.drill > 0) && p.layers && p.layers.length === 1;
  const padSide = p => (p.layers && p.layers[0] === 'B.Cu') ? 'bot' : 'top';
  function padArea(p) {
    const w = +p.w || 0, h = +p.h || 0;
    if (p.shape === 'round') return Math.PI / 4 * w * h;
    if (p.shape === 'oval') { const m = Math.min(w, h); return w * h - (4 - Math.PI) / 4 * m * m; }
    return w * h;
  }
  /* Paste je Pad nach Schablone: t = Dicke (mm), f = Öffnungsfaktor (Flächenfaktor) */
  function pasteInfo(pad, stencil) {
    const st = mergeStencil(stencil), A = padArea(pad), k = Math.sqrt(Math.max(0.01, st.f));
    const w = pad.w * k, h = pad.h * k, Aa = A * st.f;
    const ar = (w * h) / Math.max(1e-6, 2 * (w + h) * st.t);                 // Area Ratio
    const release = ar >= 0.66 ? 0.95 : 0.95 * Math.max(0.3, (ar - 0.3) / 0.36);
    const vol = Aa * st.t * release, ideal = A * DEFAULT_STENCIL.t * DEFAULT_STENCIL.f * 0.95;
    return { area: A, ar, release, vol, ideal, ratio: ideal > 0 ? vol / ideal : 0 };
  }
  function pointInPoly(x, y, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if (((a[1] > y) !== (b[1] > y)) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  }
  /* Wärmekapazität am Pad: Leiterbahnen, Kupferflächen (Zonen) und Vias ziehen Wärme ab */
  function thermalMass(board, pad) {
    let m = 1; const layer = padSide(pad) === 'bot' ? 'B.Cu' : 'F.Cu';
    const hw = pad.w / 2 + 0.05, hh = pad.h / 2 + 0.05;
    (board.tracks || []).forEach(t => {
      if (t.layer !== layer || !t.pts) return;
      if (pad.net && t.net && t.net !== pad.net) return;
      const hit = t.pts.some(q => Math.abs(q[0] - pad.x) <= hw && Math.abs(q[1] - pad.y) <= hh);
      if (hit) m += clamp((t.w || 0.25) / 0.25, 0.5, 4) * 0.3;
    });
    (board.zones || []).forEach(z => {
      if (z.layer !== layer || !z.poly || !z.net || z.net !== pad.net) return;
      if (pointInPoly(pad.x, pad.y, z.poly)) m += z.thermals === false ? 2.2 : 0.8;
    });
    (board.vias || []).forEach(v => { if (Math.abs(v.x - pad.x) <= hw && Math.abs(v.y - pad.y) <= hh) m += 0.6; });
    return Math.min(4.5, m);
  }
  function sizeFactor(fp) {
    fp = String(fp || '');
    if (/0402/.test(fp)) return 1.3;
    if (/0603/.test(fp)) return 1.0;
    if (/0805|SOD-123/.test(fp)) return 0.85;
    if (/1206/.test(fp)) return 0.7;
    return 1;
  }
  function defaultOffsets(board, seed) {      // leicht versetzte Bestückung (Schritt 2), deterministisch
    const o = {};
    (board.parts || []).forEach(p => { o[p.ref] = { dx: (hash(seed || 1, p.ref + 'x') - 0.5) * 0.2, dy: (hash(seed || 1, p.ref + 'y') - 0.5) * 0.2 }; });
    return o;
  }
  function gapBetween(a, b) {
    const dx = Math.max(0, Math.abs(a.x - b.x) - (a.w + b.w) / 2), dy = Math.max(0, Math.abs(a.y - b.y) - (a.h + b.h) / 2);
    return Math.hypot(dx, dy);
  }

  /* Hauptfunktion: Reflow-Ergebnis je Lötstelle (SMD-Pads); THT-Pads werden nicht reflowt (siehe metrics.tht) */
  function reflow(board, profile, opts) {
    opts = opts || {};
    const seed = opts.seed == null ? 1 : opts.seed, pr = mergeProfile(profile), st = mergeStencil(opts.stencil);
    const chk = profileCheck(pr), cm = chk.metrics, curve = chk.curve;
    const C = core();
    const allPads = opts.pads || (C && C.padsOf ? C.padsOf(board) : []);
    const sides = opts.sides || 'both';
    const pads = allPads.filter(p => isSmdPad(p) && (sides === 'both' || padSide(p) === sides));
    const tht = allPads.filter(p => !isSmdPad(p)).length;
    const offsets = opts.offsets || defaultOffsets(board, seed);
    const partOf = {}; (board.parts || []).forEach(p => { partOf[p.ref] = p; });
    const oxid = new Set(opts.oxidized || []);
    const info = pads.map(p => {
      const pi = pasteInfo(p, st), mass = thermalMass(board, p);
      return { p, pi, mass, key: p.ref + '.' + p.n, res: 'gut', reason: '', stage: 99 };
    });
    const byKey = {}; info.forEach(i => { byKey[i.key] = i; });
    const setRes = (i, res, reason, stage) => { if (stage < i.stage) { i.res = res; i.reason = reason; i.stage = stage; } };
    const name = i => i.p.ref + '.' + i.p.n;

    /* 1) Profil: Überhitzung, nicht geschmolzen, Benetzung */
    info.forEach(i => {
      const k = name(i), h = hash(seed, k), mass = i.mass;
      const peakEff = cm.peak - 4 * (mass - 1), talEff = cm.tal - 6 * (mass - 1);
      if (cm.peak >= 255 || cm.tal > 110) {
        setRes(i, 'ueberhitzt', 'Lötstelle ' + k + ': ' + (cm.peak >= 255 ? 'Peak ' + Math.round(cm.peak) + ' °C' : Math.round(cm.tal) + ' s über Liquidus') + ' sind zu viel. Pad und Lot sind verfärbt, das Flussmittel ist verbrannt.', 1);
      }
      if (!cm.melts) setRes(i, 'kalt', 'Lötstelle ' + k + ': Peak ' + Math.round(cm.peak) + ' °C erreicht den Liquidus von 217 °C nicht. Die Paste schmilzt gar nicht.', 2);
      else if (peakEff < 230) setRes(i, 'kalt', 'Lötstelle ' + k + ': Am Pad kommen nur etwa ' + Math.round(peakEff) + ' °C an' + (mass > 1.4 ? ' (große Kupferfläche zieht Wärme ab, Wärmekapazität ×' + fm(mass) + ')' : '') + ', zu wenig zum sauberen Verfließen. Peak höher oder Profil länger.', 2);
      else if (talEff < 25) setRes(i, 'kalt', 'Lötstelle ' + k + ': Nur etwa ' + Math.round(Math.max(0, talEff)) + ' s über Liquidus am Pad' + (mass > 1.4 ? ' (große Kupferfläche)' : '') + ': das Lot benetzt nicht vollständig, matt und körnig.', 2);
      else if (cm.cool < 1) setRes(i, 'kalt', 'Lötstelle ' + k + ': Abkühlrate ' + fm(cm.cool) + ' °C/s ist zu langsam, das Lotgefüge wird grob und matt (wirkt wie eine kalte Lötstelle).', 2);
      if (cm.melts) {
        const sev = Math.max((cm.soakTime - 120) / 60, (cm.soakEnd - 190) / 20, oxid.has(i.p.ref) ? 1 : 0);
        if (sev > 0 && h < Math.min(1, sev * 1.2)) setRes(i, 'benetzung', 'Lötstelle ' + k + ': ' + (oxid.has(i.p.ref) ? 'Das Pad ist oxidiert. ' : 'Soak ' + Math.round(cm.soakTime) + ' s bis ' + Math.round(cm.soakEnd) + ' °C hat das Flussmittel verbraucht. ') + 'Das Lot zieht sich zur Kugel zusammen und benetzt das Pad nicht.', 3);
      }
    });

    /* 2) Tombstone bei Zweipol-Bauteilen (Chip-Bauteile mit genau zwei SMD-Pads) */
    const byRef = {}; info.forEach(i => { (byRef[i.p.ref] = byRef[i.p.ref] || []).push(i); });
    const melted = cm.melts && cm.peak >= 230;
    const tombs = [];
    Object.keys(byRef).forEach(ref => {
      const L = byRef[ref];
      if (L.length !== 2 || L[0].p.part !== undefined && L[0].p.part !== L[1].p.part) return;
      const a = L[0], b = L[1], pa = a.p, pb = b.p, part = partOf[ref], fp = part ? part.fp : '';
      const areaAsym = 1 - Math.min(a.pi.area, b.pi.area) / Math.max(a.pi.area, b.pi.area);
      const pasteAsym = 1 - Math.min(a.pi.vol, b.pi.vol) / Math.max(a.pi.vol, b.pi.vol, 1e-9);
      const thermAsym = 1 - Math.min(a.mass, b.mass) / Math.max(a.mass, b.mass);
      const ux = pb.x - pa.x, uy = pb.y - pa.y, ul = Math.hypot(ux, uy) || 1, nx = ux / ul, ny = uy / ul;
      const off = offsets[ref] || { dx: 0, dy: 0 };
      const along = Math.abs(off.dx * nx + off.dy * ny), lat = Math.abs(off.dx * ny - off.dy * nx);
      const padLen = Math.abs(nx) * pa.w + Math.abs(ny) * pa.h, padWid = Math.abs(ny) * pa.w + Math.abs(nx) * pa.h;
      const asym = 1.2 * areaAsym + 0.6 * pasteAsym + 0.8 * thermAsym + 0.6 * along / Math.max(0.1, padLen) + 0.3 * lat / Math.max(0.1, padWid);
      const eq = cm.soakTime >= 60 ? 1 - Math.min(0.5, (cm.soakTime - 60) / 120) : 1 + (60 - cm.soakTime) / 60;
      const S = asym * clamp(cm.ramp / 2, 0.4, 3) * eq * sizeFactor(fp);
      if (melted && S > 0.35) {
        const lifted = (a.mass * a.pi.area >= b.mass * b.pi.area) ? (a.mass * a.pi.area === b.mass * b.pi.area && hash(seed, ref) < 0.5 ? b : a) : b;
        const other = lifted === a ? b : a;
        const causes = [];
        if (areaAsym > 0.15) causes.push('die Pads sind unterschiedlich groß (Fläche 1 : ' + fm(Math.max(a.pi.area, b.pi.area) / Math.min(a.pi.area, b.pi.area), 1) + ')');
        if (thermAsym > 0.15) causes.push('ein Pad hängt an einer großen Kupferfläche (Wärmekapazität ×' + fm(Math.max(a.mass, b.mass)) + ' gegen ×' + fm(Math.min(a.mass, b.mass)) + ')');
        if (along / Math.max(0.1, padLen) > 0.15) causes.push('das Bauteil liegt ' + fm(along, 2) + ' mm längs versetzt');
        if (cm.ramp > 2.5) causes.push('die Aufheizrate von ' + fm(cm.ramp) + ' °C/s ist hoch');
        if (cm.soakTime < 60) causes.push('das Soak von ' + Math.round(cm.soakTime) + ' s gleicht die Temperaturen nicht aus');
        const why = 'Grabstein bei ' + ref + ': ' + (causes.length ? causes.join(', ') : 'das eine Ende schmilzt früher als das andere') + '. Pad ' + other.p.n + ' schmilzt zuerst und zieht das Bauteil an Pad ' + lifted.p.n + ' hoch (Kennwert ' + fm(S, 2) + ', ab 0,35 kippt es).';
        setRes(lifted, 'tombstone', why, 4);
        tombs.push({ ref, S, lifted: lifted.p.n });
      }
    });

    /* 3) Brücken zwischen benachbarten Pads (nur verschiedene Netze) */
    const slump = 0.04 + 0.015 * Math.max(0, (cm.soakTime - 90) / 30) + (cm.ramp < 1 ? 0.02 : 0);
    const cell = 3, grid = {};
    info.forEach((i, idx) => { const key = padSide(i.p) + ':' + Math.floor(i.p.x / cell) + ':' + Math.floor(i.p.y / cell); (grid[key] = grid[key] || []).push(idx); });
    const bridged = [];
    info.forEach((a, ia) => {
      const gx = Math.floor(a.p.x / cell), gy = Math.floor(a.p.y / cell), sd = padSide(a.p);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const lst = grid[sd + ':' + (gx + dx) + ':' + (gy + dy)]; if (!lst) continue;
        lst.forEach(ib => {
          if (ib <= ia) return;
          const b = info[ib];
          if (a.p.ref === b.p.ref && a.p.n === b.p.n) return;
          if (a.p.net && a.p.net === b.p.net) return;
          if (a.p.ref === b.p.ref && byRef[a.p.ref].length === 2) return;     // Chip-Bauteil: Körper trennt die Pads (dort entstehen eher Zinnperlen)
          const gap = gapBetween(a.p, b.p); if (gap > 1.0) return;
          const oa = Math.max(0, a.pi.ratio - 1) * 0.25, ob = Math.max(0, b.pi.ratio - 1) * 0.25;
          if (oa + ob + slump > Math.max(0.05, gap) * 0.6) bridged.push([a, b, gap, a.pi.ratio, b.pi.ratio]);
        });
      }
    });
    bridged.forEach(br => {
      const [a, b, gap] = br, mx = Math.max(br[3], br[4]);
      [[a, b], [b, a]].forEach(pair => {
        setRes(pair[0], 'bruecke', 'Brücke zwischen ' + name(a) + ' und ' + name(b) + ': Pad-Abstand nur ' + fm(gap, 2) + ' mm, die Pastenmenge ist ' + Math.round(mx * 100) + ' % des Sollwerts (Schablone ' + fm(st.t * 1000, 0) + ' µm, Öffnungsfaktor ' + Math.round(st.f * 100) + ' %). Die Paste fließt zusammen.', 5);
      });
    });

    /* 4) zu wenig Lot, Zinnperlen */
    info.forEach(i => {
      const k = name(i);
      if (i.pi.ratio < 0.6) setRes(i, 'zuwenig', 'Lötstelle ' + k + ': nur ' + Math.round(i.pi.ratio * 100) + ' % der Sollpastenmenge' + (i.pi.ar < 0.66 ? ' (Flächenverhältnis ' + fm(i.pi.ar, 2) + ' unter 0,66: die Paste löst sich schlecht aus der Öffnung)' : ' (Schablone ' + fm(st.t * 1000, 0) + ' µm, Öffnungsfaktor ' + Math.round(st.f * 100) + ' %)') + '. Der Meniskus fehlt.', 6);
      const part = partOf[i.p.ref], chip = byRef[i.p.ref] && byRef[i.p.ref].length === 2;
      const score = 0.5 * Math.max(0, i.pi.ratio - 1.3) / 0.5 * (chip ? 1 : 0.5) + Math.max(0, cm.ramp - 2.8) / 1.0 * 0.6 + Math.max(0, 50 - cm.soakTime) / 50 * 0.5;
      if (score * (0.6 + 0.8 * hash(seed, k + 'b')) > 0.5) {
        const c = [];
        if (i.pi.ratio > 1.4) c.push('zu viel Paste (' + Math.round(i.pi.ratio * 100) + ' %) wird unter dem Bauteil herausgequetscht');
        if (cm.ramp > 2.8) c.push('die Aufheizrate ' + fm(cm.ramp) + ' °C/s lässt das Flussmittel spritzen');
        if (cm.soakTime < 50) c.push('das Soak von ' + Math.round(cm.soakTime) + ' s ist zu kurz zum Ausgasen');
        setRes(i, 'zinnperlen', 'Zinnperlen an ' + k + ': ' + c.join(', ') + '.', 7);
      }
    });

    const joints = info.map(i => {
      const p = i.p; let res = i.res, reason = i.reason;
      if (res === 'gut') reason = 'Lötstelle ' + name(i) + ': ' + Math.round(i.pi.ratio * 100) + ' % Paste, Profil passt, glänzender Meniskus.';
      return { ref: p.ref, pad: p.n, result: res, reason, side: padSide(p), x: p.x, y: p.y, w: p.w, h: p.h, net: p.net || '', paste: i.pi.ratio, ar: i.pi.ar, mass: i.mass };
    });
    const counts = {}; RESULT_ORDER.forEach(r => { counts[r] = 0; }); joints.forEach(j => { counts[j.result]++; });
    return { joints, ok: joints.length > 0 && counts.gut === joints.length, warnings: chk.warnings, metrics: Object.assign({}, cm, { tht, smd: joints.length, curveTotal: curve.total }), counts, tombstones: tombs, bridges: bridged.map(b => [name(b[0]), name(b[1])]), stencil: st, profile: pr };
  }

  /* ---------- Handlöten ---------- */
  const TIPS = {
    meissel: { n: 'Meißelspitze 2,4 mm', f: 1.0, c: 1.2, w: 2.4 },
    kegel: { n: 'Kegelspitze 1,0 mm', f: 0.9, c: 0.8, w: 1.0 },
    fein: { n: 'Feinspitze 0,4 mm', f: 0.88, c: 0.6, w: 0.4 },
    messer: { n: 'Messerspitze 3 mm (Schleppen)', f: 0.97, c: 1.1, w: 3.0 }
  };
  const HAND_KINDS = {
    tht: { n: 'Widerstand THT', mass: 1.2, need: 4.0, pitch: 2.54, best: ['meissel', 'kegel'], bridge: false },
    dip: { n: 'DIP-IC (Pins)', mass: 1.4, need: 3.5, pitch: 2.54, best: ['meissel', 'kegel'], bridge: true },
    soic: { n: 'SOIC-Pins', mass: 1.0, need: 1.2, pitch: 1.27, best: ['messer', 'fein', 'kegel'], bridge: true },
    smd0603: { n: '0603 mit Pinzette', mass: 0.8, need: 1.0, pitch: 1.6, best: ['fein', 'kegel'], bridge: false }
  };
  const HAND_IDEAL_ORDER = ['heat', 'solder', 'wireOff', 'ironOff'];
  const HAND_DEFECT_TEXT = {
    kalt: 'Kalte Lötstelle: matt und körnig, das Pad war beim Zuführen des Lots nicht heiß genug.',
    ueberhitzt: 'Überhitzt: Flussmittel verbrannt, Lot dunkel und stumpf, das Bauteil leidet.',
    padlift: 'Pad abgelöst: zu heiß oder zu lange. Das Kupfer hat sich vom Basismaterial gelöst.',
    bruecke: 'Lötbrücke zur Nachbarstelle: zu viel Lot oder zu große Spitze.',
    zuwenig: 'Zu wenig Lot: das Pad ist nicht ganz benetzt, kein Meniskus.',
    zuviel: 'Zu viel Lot: dicke Kugel, nicht zu sehen, ob der Anschluss sauber benetzt ist.',
    verrutscht: 'Bauteil verrutscht: die Pinzette wurde zu früh losgelassen, das Lot war noch flüssig.',
    reihenfolge: 'Falsche Reihenfolge: erst Pad erwärmen, dann Lot zuführen, Lot wegnehmen, zuletzt den Kolben.'
  };
  function handDefaults(kind) {
    const k = HAND_KINDS[kind] || HAND_KINDS.tht;
    return { kind, temp: 340, tip: k.best[0], time: kind === 'smd0603' ? 3 : kind === 'dip' ? 4 : 3.5, preheat: kind === 'smd0603' || kind === 'dip' ? 2 : 1.6, wireMm: k.need, order: HAND_IDEAL_ORDER.slice(), drag: kind === 'soic' ? 5 : 0, hold: kind === 'smd0603' ? 1.5 : 0, seed: 1 };
  }
  /* Wärmemodell: PT1-Glied, die Spitze sackt je nach Pad-Masse ab; Schleppen: das Lot bringt die Wärme zum Pad */
  function heatModel(params) {
    const P = Object.assign({}, handDefaults((params && params.kind) || 'tht'), params || {});
    const K = HAND_KINDS[P.kind] || HAND_KINDS.tht, tip = TIPS[P.tip] || TIPS.meissel, drag = +P.drag > 0 && P.kind === 'soic';
    const Tinf = (+P.temp) * tip.f - 45 * K.mass;
    let tau = 0.7 * K.mass / tip.c, time = +P.time, preheat = +P.preheat;
    if (drag) { tau *= 0.3; time = 3 / +P.drag; preheat = time * 0.6; }
    return { Tinf, tau, time, preheat, drag, padT: t => 25 + (Tinf - 25) * (1 - Math.exp(-Math.max(0, t) / tau)) };
  }
  function handSolder(params) {
    const d = handDefaults((params && params.kind) || 'tht'), P = Object.assign({}, d, params || {});
    const K = HAND_KINDS[P.kind] || HAND_KINDS.tht, tip = TIPS[P.tip] || TIPS.meissel, drag = +P.drag > 0 && P.kind === 'soic';
    const order = Array.isArray(P.order) ? P.order : HAND_IDEAL_ORDER;
    const temp = +P.temp, def = {}, notes = [];
    const heat = heatModel(P), Tinf = heat.Tinf, padT = heat.padT; let time = heat.time, preheat = heat.preheat;
    const add = (id, txt) => { if (!def[id]) { def[id] = 1; if (txt) notes.push(txt); } };
    const jit = hash(P.seed | 0, 'h' + P.kind + (P.pin == null ? '' : P.pin));
    // Temperaturverlauf am Pad: PT1-Glied, die Spitze sackt je nach Pad-Masse ab
    const iOrder = order.indexOf('heat'), iSol = order.indexOf('solder'), iWoff = order.indexOf('wireOff'), iIoff = order.indexOf('ironOff');
    let orderOK = iOrder >= 0 && iSol > iOrder && (iWoff < 0 || iWoff > iSol) && (iIoff < 0 || (iIoff > iSol && (iWoff < 0 || iIoff > iWoff)));
    if (!drag && iSol >= 0 && iOrder < 0) orderOK = false;
    const wireMm = +P.wireMm;
    const noWire = !(wireMm > 0.05) || (iSol < 0 && !drag);
    if (!orderOK && !noWire) add('reihenfolge', 'Reihenfolge: ' + (iSol >= 0 && (iOrder < 0 || iSol < iOrder) ? 'Das Lot kam, bevor das Pad heiß war. Es schmilzt nur an der Spitze und perlt am kalten Pad ab. ' : iIoff >= 0 && iWoff >= 0 && iIoff < iWoff ? 'Der Kolben ging vor dem Lot weg, der Lotdraht klebt fest und die Stelle wird unruhig. ' : 'Der Ablauf ist nicht korrekt. ') + 'Richtig: erst Pad erwärmen, dann Lot, Lot weg, dann Kolben weg.');
    let padAtWire = padT(preheat);
    if (iSol >= 0 && (iOrder < 0 || iSol < iOrder)) padAtWire = 25;
    // Wärme
    const padMax = padT(time);
    const reach = Tinf > 220;
    if (noWire) { add('zuwenig', 'Es wurde kein Lot zugeführt: die Stelle ist nicht verbunden.'); }
    if (padAtWire < 217 && !noWire) add('kalt', 'Das Pad war beim Lotzuführen erst ' + Math.round(padAtWire) + ' °C heiß (Lot schmilzt ab 217 °C)' + (!reach ? '. Mit ' + Math.round(temp) + ' °C und ' + tip.n + ' kommt am Pad nie genug an (Spitze sackt auf ' + Math.round(Tinf) + ' °C ab)' : (P.kind !== 'soic' || !drag ? ': länger erwärmen (etwa 1 bis 2 s)' : '')) + '.');
    if (padMax < 232 && padAtWire >= 217 && !noWire) add('kalt', 'Das Pad blieb unter 232 °C: das Lot verfließt nicht richtig.');
    // Überhitzung
    const tSafe = Math.min(8, 5 * Math.exp(-(temp - 350) / 55));
    const idx = time / tSafe;
    if (idx > 1) add('ueberhitzt', 'Zu lange und/oder zu heiß: ' + fm(time, 1) + ' s bei ' + Math.round(temp) + ' °C (verträglich sind etwa ' + fm(tSafe, 1) + ' s). Das Flussmittel verbrennt, Bauteil und Pad werden heiß.');
    if (idx > 2.2 || (temp >= 390 && time > 3.5)) add('padlift', 'Das Pad hat sich abgelöst (' + Math.round(temp) + ' °C, ' + fm(time, 1) + ' s).');
    if (idx > 1 && temp <= 300 && !reach) { /* niedrige Temperatur, lange Zeit: Hitze kommt nicht an, nur Bauteil wird warm */ }
    // Lotmenge
    const r = noWire ? 0 : wireMm / K.need;
    if (!noWire) {
      if (r < 0.45) add('zuwenig', 'Zu wenig Lot (' + fm(wireMm, 1) + ' mm statt etwa ' + fm(K.need, 1) + ' mm): das Pad ist nicht ganz bedeckt.');
      else if (r > 1.7 && !(K.bridge && r > 2.2)) add('zuviel', 'Zu viel Lot (' + fm(wireMm, 1) + ' mm statt etwa ' + fm(K.need, 1) + ' mm): dicke Kugel ohne Kehle.');
      const bigTip = tip.w > 1.2 && (P.kind === 'soic' || P.kind === 'smd0603') && !drag;
      if (K.bridge && (r > 2.2 || (r > 1.5 && bigTip) || (drag && +P.drag < 2.5 && r > 1.1 && hash(P.seed | 0, 'br' + P.pin) < 0.8))) add('bruecke', 'Brücke zur Nachbarstelle (Pitch ' + fm(K.pitch, 2) + ' mm): ' + (bigTip ? 'Spitze ' + tip.n + ' ist zu groß und ' : '') + 'zu viel Lot (' + fm(wireMm, 1) + ' mm).');
      if (drag) {
        const sp = +P.drag;
        if (sp > 9) add('zuwenig', 'Zu schnell geschleppt (' + fm(sp, 1) + ' mm/s): kaum Lot bleibt an den Pins, das Pad wird nicht warm genug.');
        if (sp < 2.5 && r > 1.1 && !def.bruecke) add('zuviel', 'Zu langsam geschleppt (' + fm(sp, 1) + ' mm/s): das Lot sammelt sich, es drohen Brücken.');
      }
    }
    if (tip.w < 0.5 && K.mass > 1.1 && !def.kalt && padMax < 240 && !noWire) add('kalt', 'Die ' + tip.n + ' ist für diese Stelle zu schwach (kleine Wärmemenge).');
    // Pinzette
    if (P.kind === 'smd0603' && +P.hold < 1) add('verrutscht', 'Die Pinzette wurde nach ' + fm(+P.hold, 1) + ' s losgelassen, das Lot war noch flüssig (mindestens 1 s nach dem Kolben halten).');
    // Qualität
    const pen = { padlift: 70, bruecke: 55, kalt: 50, ueberhitzt: 35, zuwenig: 30, zuviel: 25, verrutscht: 25, reihenfolge: 25 };
    let q = 100, any = false;
    Object.keys(def).forEach(k => { q -= pen[k] || 20; any = true; });
    if (!any) {                                     // weiche Abzüge für Abweichungen vom Idealwert
      q -= Math.min(10, Math.abs(temp - 340) / 10 * 0.5);
      q -= Math.min(10, Math.abs(r - 1) * 12);
      q -= Math.min(6, Math.max(0, idx - 0.7) * 6);
      q -= Math.round(jit * 3);
    }
    q = Math.round(clamp(q, 0, 100));
    const prio = ['padlift', 'bruecke', 'kalt', 'ueberhitzt', 'zuwenig', 'zuviel', 'verrutscht', 'reihenfolge'];
    const defects = prio.filter(k => def[k]);
    const joint = defects.length ? defects[0] : 'gut';
    if (!defects.length) notes.push('Glänzender Meniskus, sauber benetzt.');
    return { quality: q, defects, joint, notes, gloss: !def.kalt && !def.ueberhitzt && !def.padlift, padAtWire: Math.round(padAtWire), padMax: Math.round(padMax), idx: Math.round(idx * 100) / 100, ratio: Math.round(r * 100) / 100, perfect: !defects.length && q >= 90 };
  }

  /* ---------- Bestückungsreihenfolge ---------- */
  const HEIGHTS = [[/^R_AXIAL/, 2.5], [/C_RADIAL_2\.5/, 7], [/C_RADIAL_5/, 11], [/LED_5MM/, 8.6], [/DIP/, 4.5], [/TO-92/, 5], [/TO-220/, 10], [/HDR_1x/, 8.5], [/HDR_2x/, 8.5], [/DC_JACK/, 11], [/SWITCH/, 5],
    [/0402/, 0.35], [/R0603|C0603|LED0603/, 0.5], [/0805/, 0.65], [/1206/, 0.6], [/SOT-223/, 1.8], [/SOT-23/, 1.1], [/SOIC|SOP/, 1.75], [/TSSOP/, 1.2], [/QFP/, 1.6], [/QFN/, 0.9], [/SOD-123/, 1.1]];
  function fpInfo(fpId, opts) {
    const C = core(), tbl = (opts && opts.footprints) || (C && C.footprints) || {};
    const f = tbl[fpId] || (C && C.footprint ? (function () { try { return C.footprint(fpId); } catch (e) { return null; } })() : null);
    let kind = f && f.kind, h = f && f.bodyH;
    if (!kind) kind = /AXIAL|RADIAL|LED_5MM|DIP|TO-|HDR|JACK|SWITCH/.test(fpId) ? 'tht' : 'smd';
    if (!(h > 0)) { h = 1; for (const e of HEIGHTS) if (e[0].test(fpId)) { h = e[1]; break; } }
    return { kind, h };
  }
  function orderKey(part, opts) { const f = fpInfo(part.fp, opts); return { g: f.kind === 'tht' ? 2 : (part.side === 'bot' ? 0 : 1), h: f.h, tht: f.kind === 'tht', ref: part.ref, fp: part.fp }; }
  function idealOrder(board, opts) {
    return (board.parts || []).map(p => orderKey(p, opts)).sort((a, b) => a.g - b.g || a.h - b.h || (a.ref < b.ref ? -1 : 1)).map(k => k.ref);
  }
  /* order = Liste der Referenzen in der Reihenfolge des Spielers; Punkte 0..100 */
  function orderScore(order, board, opts) {
    const parts = board.parts || [], keys = {};
    parts.forEach(p => { keys[p.ref] = orderKey(p, opts); });
    const seen = []; (order || []).forEach(r => { if (keys[r] && seen.indexOf(r) < 0) seen.push(r); });
    let good = 0, tot = 0; const errors = [];
    const gname = k => k.g === 0 ? 'Unterseite (SMD)' : k.g === 1 ? 'Oberseite (SMD)' : 'THT';
    for (let i = 0; i < seen.length; i++) for (let j = i + 1; j < seen.length; j++) {
      const a = keys[seen[i]], b = keys[seen[j]];        // a wird vor b bestückt
      let want = 0;                                       // -1 a muss vor b, 1 b muss vor a, 0 egal
      if (a.g !== b.g) want = a.g < b.g ? -1 : 1; else if (Math.abs(a.h - b.h) > 0.3) want = a.h < b.h ? -1 : 1;
      if (!want) continue;
      tot++;
      if (want === -1) good++;
      else {
        let why;
        if (a.g !== b.g) why = a.g === 2 ? a.ref + ' (THT) steht vor ' + b.ref + ' (' + gname(b) + '): SMD-Teile werden zuerst bestückt und gelötet, THT zuletzt, weil die Anschlussdrähte beim Reflow stören und die Platine sonst nicht flach liegt.' : a.g === 1 && b.g === 0 ? a.ref + ' (Oberseite) steht vor ' + b.ref + ' (Unterseite): beim Reflow kommt die Unterseite zuerst, sonst fallen deren Bauteile beim zweiten Durchlauf ab.' : a.ref + ' steht vor ' + b.ref + ', obwohl die Reihenfolge nach Seite oder Art nicht stimmt.';
        else why = a.ref + ' (' + fm(a.h, 1) + ' mm hoch) steht vor ' + b.ref + ' (' + fm(b.h, 1) + ' mm hoch): niedrige Bauteile zuerst, damit die Platine beim Bestücken und Löten nicht auf hohen Teilen wackelt.';
        errors.push({ a: a.ref, b: b.ref, why });
      }
    }
    const n = parts.length;
    let score = tot ? Math.round(good / tot * 100) : (seen.length > 1 ? 100 : 0);
    if (n > 0 && seen.length < n) score = Math.round(score * seen.length / n);
    return { score, good, total: tot, errors, ideal: idealOrder(board, opts), complete: seen.length === n, placed: seen.length };
  }

  const PCB_ASM = {
    version: '1.0', RESULTS, RESULT_ORDER, PROFILES, DEFAULT_PROFILE, DEFAULT_STENCIL, LIQUIDUS: LIQ, TIPS, HAND_KINDS, HAND_DEFECT_TEXT, HAND_IDEAL_ORDER,
    reflow, handSolder, heatModel, orderScore, idealOrder, profileCurve, profileCheck, tempAt, pasteInfo, thermalMass, defaultOffsets, handDefaults, fpInfo, hash, fm
  };
  root.PCB_ASM = PCB_ASM;
  if (typeof module !== 'undefined' && module.exports) module.exports = PCB_ASM;
  if (typeof document === 'undefined') return;      // Node: keine Oberfläche

  /* ====================================================================================
     TEIL B: OBERFLÄCHE
     ==================================================================================== */
  root.PCB_VIEWS = root.PCB_VIEWS || { views: {}, register(id, def) { this.views[id] = def; } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function h(tag, attrs, kids) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v; else if (k === 'text') e.textContent = v; else if (k === 'html') e.innerHTML = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
    }
    (Array.isArray(kids) ? kids : kids == null ? [] : [kids]).forEach(c => { if (c != null && c !== false) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  const C = () => root.PCB_CORE || null;
  const padsOf = b => { try { return C().padsOf(b) || []; } catch (e) { return []; } };
  const fpTable = () => (C() && C().footprints) || {};
  const fpOf = id => { const t = fpTable(); if (t[id]) return t[id]; try { return C() && C().footprint ? C().footprint(id) : null; } catch (e) { return null; } };
  function bomOf(b) {
    try { if (C() && C().bom) return C().bom(b); } catch (e) { /* lokal */ }
    const m = {}; (b.parts || []).forEach(p => { const k = p.value + '|' + p.fp; (m[k] = m[k] || { value: p.value, fp: p.fp, refs: [], qty: 0 }); m[k].refs.push(p.ref); m[k].qty++; });
    return Object.keys(m).map(k => m[k]).sort((a, b) => (a.refs[0] < b.refs[0] ? -1 : 1));
  }
  function ppOf(b) {
    try { if (C() && C().pickplace) return C().pickplace(b); } catch (e) { /* lokal */ }
    return (b.parts || []).map(p => ({ ref: p.ref, x: p.x, y: p.y, rot: p.rot || 0, side: p.side || 'top', fp: p.fp, value: p.value }));
  }
  function csvOf(rows, cols) { return cols.join(';') + '\n' + rows.map(r => cols.map(c => '"' + String(r[c] == null ? '' : r[c]).replace(/"/g, '""') + '"').join(';')).join('\n') + '\n'; }
  function download(name, text) {
    try {
      const a = h('a', { href: URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' })), download: name });
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); return true;
    } catch (e) { return false; }
  }
  const save = (k, v) => { try { localStorage.setItem('pcb.asm.' + k, JSON.stringify(v)); } catch (e) { /* ok */ } };
  const load = (k, d) => { try { const v = localStorage.getItem('pcb.asm.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const rng = seed => { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };

  function ensureCss() {
    if (document.getElementById('pcbasm-css')) return;
    const st = document.createElement('style'); st.id = 'pcbasm-css';
    st.textContent = `
.pa{min-height:100%;color:var(--fg,#e8ecf0);font:14px/1.35 -apple-system,system-ui,"Segoe UI",sans-serif;background:var(--bg,#14181c);-webkit-user-select:none;user-select:none}
.pa *{box-sizing:border-box}
.pa-tabs{display:flex;gap:6px;padding:7px 10px;overflow-x:auto;border-bottom:1px solid var(--line,#38424d);scrollbar-width:none;position:sticky;top:0;z-index:3;background:var(--bg,#14181c)}
.pa-b{min-height:40px;min-width:40px;padding:0 14px;border-radius:10px;border:1px solid var(--line,#38424d);background:var(--panel2,#2c343e);color:inherit;font:inherit;cursor:pointer;touch-action:manipulation;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;gap:6px}
.pa-b.on{background:var(--accent,#3b9eff);border-color:var(--accent,#3b9eff);color:#fff;font-weight:600}
.pa-b.ok{background:#2a6b3a;border-color:#3f9a55;color:#fff}
.pa-b.pri{background:var(--accent,#3b9eff);border-color:var(--accent,#3b9eff);color:#fff;font-weight:600}
.pa-tabs .pa-b,.pa-step .pa-b{flex:none}
.pa-b:disabled{opacity:.45;cursor:default}
.pa-b.s{min-height:40px;padding:0 10px}
.pa-body{padding:10px}
.pa-split{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:10px;align-items:start}
@media(max-width:860px){.pa-split{grid-template-columns:minmax(0,1fr)}}
.pa-card{background:var(--panel,#222830);border:1px solid var(--line,#38424d);border-radius:12px;padding:10px;margin-bottom:10px}
.pa-card h3{margin:0 0 6px;font-size:15px}
.pa-mute{color:var(--mute,#8d99a6);font-size:13px}
.pa-cv{position:relative;width:100%;height:min(56vh,540px);min-height:250px;background:#0f1418;border:1px solid var(--line,#38424d);border-radius:12px;overflow:hidden;touch-action:none;margin-bottom:10px}
.pa-cv.sm{height:190px;min-height:190px}
.pa-cv.chart{height:min(40vh,330px);min-height:230px}
.pa-cv canvas{position:absolute;left:0;top:0;width:100%;height:100%;display:block}
.pa-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:8px}
.pa-seg{display:inline-flex;border:1px solid var(--line,#38424d);border-radius:10px;overflow:hidden}
.pa-seg button{min-height:40px;min-width:48px;padding:0 12px;background:var(--panel2,#2c343e);color:inherit;border:0;border-right:1px solid var(--line,#38424d);font:inherit;cursor:pointer;touch-action:manipulation}
.pa-seg button:last-child{border-right:0}
.pa-seg button.on{background:var(--accent,#3b9eff);color:#fff;font-weight:600}
.pa table{border-collapse:collapse;width:100%;font-size:13.5px}
.pa th{position:sticky;top:55px;background:var(--panel2,#2c343e);text-align:left;padding:8px;border-bottom:1px solid var(--line,#38424d);white-space:nowrap}
.pa td{padding:8px;border-bottom:1px solid var(--line,#38424d);vertical-align:top}
.pa tr.clk{cursor:pointer}.pa tr.clk:hover td{background:#ffffff0d}
.pa-sl{display:grid;grid-template-columns:1fr auto;gap:2px 8px;margin-bottom:8px;align-items:center}
.pa-sl label{font-size:13px}.pa-sl b{font-variant-numeric:tabular-nums;font-size:13px}
.pa-sl input[type=range]{grid-column:1/3;width:100%;height:40px;margin:0;accent-color:var(--accent,#3b9eff);touch-action:pan-y}
.pa-warn{padding:6px 9px;border-radius:8px;margin-bottom:6px;font-size:13px;border:1px solid}
.pa-warn.bad{background:#4a1d20;border-color:#a33;color:#ffd2d2}.pa-warn.warn{background:#4a3a14;border-color:#a87b1c;color:#ffe3a6}.pa-warn.good{background:#17391f;border-color:#2f7a42;color:#c9f3d3}
.pa-chip{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 11px;border-radius:20px;border:1px solid var(--line,#38424d);background:var(--panel2,#2c343e);color:inherit;font:inherit;font-size:13px;cursor:pointer;touch-action:manipulation}
.pa-chip.on{outline:2px solid var(--accent,#3b9eff)}
.pa-dot{width:11px;height:11px;border-radius:50%;display:inline-block}
.pa-step{display:flex;gap:6px;overflow-x:auto;margin-bottom:10px;scrollbar-width:none}
.pa-step .pa-b{flex:1 0 auto}
.pa-card2{display:flex;align-items:center;gap:8px;background:var(--panel,#222830);border:1px solid var(--line,#38424d);border-radius:10px;padding:6px 8px;margin-bottom:6px}
.pa-card2.bad{border-color:#a33;background:#3a1a1c}.pa-card2.ok{border-color:#3f9a55}
.pa-n{width:28px;text-align:center;font-weight:700;color:var(--mute,#8d99a6)}
.pa-grow{flex:1;min-width:0}
.pa-tag{display:inline-block;padding:1px 7px;border-radius:9px;font-size:11.5px;background:#38424d;margin-right:4px}
.pa big{font-size:26px;font-weight:700}
`;
    document.head.appendChild(st);
  }

  /* ---------- Zeichenfläche mit Größenanpassung ---------- */
  function mkCv(box, draw, opts) {
    const cv = h('canvas'); box.appendChild(cv);
    const o = { cv, w: 0, h: 0, dpr: 1, dead: false };
    o.redraw = () => {
      if (o.dead || !o.w) return; const g = cv.getContext('2d'); g.setTransform(o.dpr, 0, 0, o.dpr, 0, 0); g.clearRect(0, 0, o.w, o.h);
      try { draw(g, o.w, o.h, o); } catch (e) { if (root.console) console.error('pcbasm draw', e); }
    };
    const rs = () => {
      const r = box.getBoundingClientRect(), w = Math.max(10, Math.floor(r.width)), hh = Math.max(10, Math.floor(r.height)), dpr = Math.min(2, root.devicePixelRatio || 1);
      if (w !== o.w || hh !== o.h || dpr !== o.dpr) { o.w = w; o.h = hh; o.dpr = dpr; cv.width = Math.round(w * dpr); cv.height = Math.round(hh * dpr); if (opts && opts.onResize) opts.onResize(o); }
      o.redraw();
    };
    if (root.ResizeObserver) { o.ro = new ResizeObserver(rs); o.ro.observe(box); }
    setTimeout(rs, 0);
    o.resize = rs;
    o.destroy = () => { o.dead = true; if (o.ro) o.ro.disconnect(); };
    return o;
  }
  function fitView(v, board, w, hh) {
    const p = 14, s = Math.min((w - 2 * p) / Math.max(1, board.w), (hh - 2 * p) / Math.max(1, board.h));
    v.s = Math.max(0.5, s); v.min = v.s * 0.5; v.ox = (w - board.w * v.s) / 2; v.oy = (hh - board.h * v.s) / 2; v.auto = true;
  }
  /* Schieben und Zoomen mit Maus, Mausrad und zwei Fingern; onTap(x,y) bei kurzem Antippen */
  function attachPZ(cv, view, redraw, onTap) {
    const pts = new Map(); let moved = 0, t0 = 0, pinch = null;
    const pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const zoomAt = (x, y, f) => { const s2 = Math.max(view.min || 0.5, Math.min(600, view.s * f)); f = s2 / view.s; view.ox = x - (x - view.ox) * f; view.oy = y - (y - view.oy) * f; view.s = s2; view.auto = false; redraw(); };
    cv.addEventListener('pointerdown', e => { try { cv.setPointerCapture(e.pointerId); } catch (x) { /* ok */ } pts.set(e.pointerId, pos(e)); if (pts.size === 1) { moved = 0; t0 = Date.now(); } pinch = null; });
    cv.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return; const p = pos(e), q = pts.get(e.pointerId);
      if (pts.size === 1) { const dx = p.x - q.x, dy = p.y - q.y; moved += Math.abs(dx) + Math.abs(dy); if (moved > 6) { view.ox += dx; view.oy += dy; view.auto = false; redraw(); } }
      else if (pts.size === 2) {
        pts.set(e.pointerId, p); const a = [...pts.values()], d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), c = { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2 };
        if (pinch) { zoomAt(c.x, c.y, d / pinch.d); view.ox += c.x - pinch.c.x; view.oy += c.y - pinch.c.y; } pinch = { d, c }; moved = 99; return;
      }
      pts.set(e.pointerId, p);
    });
    const up = e => { const had = pts.has(e.pointerId), single = pts.size === 1; pts.delete(e.pointerId); pinch = null; if (had && single && moved <= 6 && Date.now() - t0 < 600 && onTap) { const p = pos(e); onTap(p.x, p.y); } };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', e => { pts.delete(e.pointerId); pinch = null; });
    cv.addEventListener('wheel', e => { e.preventDefault(); const p = pos(e); zoomAt(p.x, p.y, e.deltaY < 0 ? 1.18 : 1 / 1.18); }, { passive: false });
    return { zoomAt };
  }
  function tween(view, to, ms, redraw) {
    const from = { s: view.s, ox: view.ox, oy: view.oy }, t0 = performance.now(); view.auto = false;
    const f = now => { const u = Math.min(1, (now - t0) / ms), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; view.s = from.s + (to.s - from.s) * e; view.ox = from.ox + (to.ox - from.ox) * e; view.oy = from.oy + (to.oy - from.oy) * e; redraw(); if (u < 1) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  }

  /* ---------- Geometrie der Bauteile (Footprint -> Weltkoordinaten) ---------- */
  function applyX(c, part, lx, ly) {
    let x = lx, y = ly; const rot = (part.rot || 0) * Math.PI / 180;
    if (c.mir && c.order === 0) x = -x;
    const a = c.rs * rot, ca = Math.cos(a), sa = Math.sin(a);
    let rx = x * ca - y * sa, ry = x * sa + y * ca;
    if (c.mir && c.order === 1) rx = -rx;
    return [part.x + rx, part.y + ry];
  }
  function xformFor(part, fp, wp) {
    const bot = part.side === 'bot', cands = [];
    [bot, !bot].forEach(m => [1, -1].forEach(rs => [0, 1].forEach(order => { if (m || order === 0) cands.push({ mir: m, rs, order }); })));
    let best = cands[0], be = Infinity;
    cands.forEach(c => {
      let e = 0, n = 0; (fp.pads || []).forEach(p => { const w = wp.find(q => String(q.n) === String(p.n)); if (!w) return; const t = applyX(c, part, p.x, p.y); e += Math.hypot(t[0] - w.x, t[1] - w.y); n++; });
      if (n && e < be - 1e-6) { be = e; best = c; }
    });
    return best;
  }
  function rectBox(r, pc) {
    const A = { x: r.x, y: r.y, w: r.w, h: r.h }, B = { x: r.x - r.w / 2, y: r.y - r.h / 2, w: r.w, h: r.h };
    const dA = Math.hypot(A.x + A.w / 2 - pc[0], A.y + A.h / 2 - pc[1]), dB = Math.hypot(B.x + B.w / 2 - pc[0], B.y + B.h / 2 - pc[1]);
    return dB <= dA ? B : A;
  }
  function polarityOf(part, fp, wp) {
    const id = String(part.fp || ''), ref = String(part.ref || ''), two = wp.length === 2;
    let type = null;
    if (/C_RADIAL|CP_|ELKO/.test(id)) type = 'elko';
    else if (/^LED/.test(id)) type = 'led';
    else if (/SOD|^D_|DIODE/.test(id) || (/^D\d/.test(ref) && two)) type = 'diode';
    else if (/DIP|SOIC|TSSOP|QFP|QFN|SOT/.test(id)) type = 'ic';
    else if (/^TO-/.test(id)) type = 'to';
    else if (/HDR/.test(id)) type = 'hdr';
    const T = {
      elko: 'Elko gepolt: Pad 1 ist Plus, der Streifen am Gehäuse markiert Minus. Verkehrt herum kann er platzen.',
      led: 'LED gepolt: Pad 1 ist die Kathode (K, flache Seite oder Balken), Pad 2 die Anode.',
      diode: 'Diode gepolt: Der Balken zeigt die Kathode (Pad 1), Strom fließt von der Anode zur Kathode.',
      ic: 'IC: Pin 1 ist durch Punkt oder Kerbe markiert. Danach gegen den Uhrzeigersinn zählen.',
      to: 'Transistor/Regler: Pin 1 beachten, die Gehäuseform gibt die Richtung vor (flache Seite).',
      hdr: 'Stiftleiste: Pad 1 ist quadratisch, Pin 1 ist durch eine 1 markiert.'
    };
    return { type, text: type ? T[type] : '' };
  }
  /* liefert { poly:[{pts,open,circle}], court:[pts], bbox, pol, pin1:{x,y}, marks:[...] } in Weltkoordinaten */
  function partGeom(part, fp, wp) {
    const g = { silk: [], court: null, bbox: null, pol: polarityOf(part, fp, wp), marks: [] };
    if (!fp) return g;
    const c = xformFor(part, fp, wp), T = (x, y) => applyX(c, part, x, y);
    const pads = fp.pads || [], pc = pads.length ? [pads.reduce((s, p) => s + p.x, 0) / pads.length, pads.reduce((s, p) => s + p.y, 0) / pads.length] : [0, 0];
    (fp.silk || []).forEach(s => {
      if (s.t === 'line') g.silk.push({ pts: [T(s.x1, s.y1), T(s.x2, s.y2)], open: true });
      else if (s.t === 'rect') { const b = rectBox(s, pc); g.silk.push({ pts: [T(b.x, b.y), T(b.x + b.w, b.y), T(b.x + b.w, b.y + b.h), T(b.x, b.y + b.h)] }); }
      else if (s.t === 'circle') { const q = T(s.x, s.y); g.silk.push({ circle: true, x: q[0], y: q[1], r: s.r }); }
    });
    if (fp.courtyard) { const b = rectBox(fp.courtyard, pc); g.court = [T(b.x, b.y), T(b.x + b.w, b.y), T(b.x + b.w, b.y + b.h), T(b.x, b.y + b.h)]; g.cw = Math.min(b.w, b.h); }
    const all = g.court ? g.court : wp.map(p => [p.x - p.w / 2, p.y - p.h / 2]).concat(wp.map(p => [p.x + p.w / 2, p.y + p.h / 2]));
    if (all.length) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; all.forEach(q => { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }); g.bbox = [x0, y0, x1, y1]; }
    // Polarität: Markierungen
    const p1 = wp.find(q => String(q.n) === '1'), p2 = wp.find(q => String(q.n) === '2');
    if (p1 && g.pol.type) {
      const cx = wp.reduce((s, q) => s + q.x, 0) / wp.length, cy = wp.reduce((s, q) => s + q.y, 0) / wp.length;
      let dx = p1.x - cx, dy = p1.y - cy; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
      g.pin1 = { x: p1.x, y: p1.y };
      const ty = g.pol.type;
      if (ty === 'ic' || ty === 'to') g.marks.push({ k: 'dot', x: p1.x + dx * (Math.max(p1.w, p1.h) / 2 + 0.35), y: p1.y + dy * (Math.max(p1.w, p1.h) / 2 + 0.35), r: 0.22 });
      else if (ty === 'elko') {
        g.marks.push({ k: 'text', x: p1.x + dx * 0.9, y: p1.y + dy * 0.9 - 0.2, t: '+', col: '#ff8a65' });
        if (p2) { const mx = (p2.x + cx) / 2, my = (p2.y + cy) / 2; g.marks.push({ k: 'stripe', x: mx, y: my, nx: -dx, ny: -dy, len: (g.cw || 3) * 0.9 }); g.marks.push({ k: 'text', x: p2.x - dx * 0.9, y: p2.y - dy * 0.9 - 0.2, t: '−', col: '#8ec5ff' }); }
      } else if (ty === 'led' || ty === 'diode') {
        g.marks.push({ k: 'stripe', x: cx + dx * 0.45, y: cy + dy * 0.45, nx: dx, ny: dy, len: Math.min(1.4, g.cw || 1.2) * 0.9 });
        g.marks.push({ k: 'text', x: p1.x + dx * 0.9, y: p1.y + dy * 0.9 - 0.2, t: 'K', col: '#ffd54f' });
      } else if (ty === 'hdr') g.marks.push({ k: 'text', x: p1.x, y: p1.y - Math.max(p1.w, p1.h) * 0.9, t: '1', col: '#ffd54f' });
    }
    return g;
  }

  /* ---------- Zeichnen der Platine ---------- */
  const COL = { board: { top: '#1d4a2c', bot: '#173f4a' }, cu: '#cf9f4e', silk: '#f1f1e0', silkB: '#e0d79a', court: 'rgba(255,255,255,.07)' };
  function prep(S, board) {
    S.board = board; S.pads = padsOf(board); S.byRef = {}; S.geom = {};
    S.pads.forEach(p => { (S.byRef[p.ref] = S.byRef[p.ref] || []).push(p); });
    (board.parts || []).forEach(p => { const fp = fpOf(p.fp); S.geom[p.ref] = partGeom(p, fp, S.byRef[p.ref] || []); });
    const sig = (board.parts || []).map(p => p.ref + p.fp + p.side).join(',');
    S.sig = sig;
  }
  function mkT(board, view, mir) {
    return { X: x => view.ox + (mir ? board.w - x : x) * view.s, Y: y => view.oy + y * view.s, L: l => l * view.s, inv: (px, py) => [mir ? board.w - (px - view.ox) / view.s : (px - view.ox) / view.s, (py - view.oy) / view.s] };
  }
  function drawBoard(g, w, hh, S, view, o) {
    o = o || {}; const board = S.board, side = o.side || 'top', mir = side === 'bot', T = mkT(board, view, mir);
    g.fillStyle = '#0f1418'; g.fillRect(0, 0, w, hh);
    // Platine
    g.beginPath();
    if (board.outline && board.outline.length > 2) board.outline.forEach((q, i) => { i ? g.lineTo(T.X(q[0]), T.Y(q[1])) : g.moveTo(T.X(q[0]), T.Y(q[1])); });
    else { const x0 = T.X(0), x1 = T.X(board.w), y0 = T.Y(0), y1 = T.Y(board.h); g.rect(Math.min(x0, x1), y0, Math.abs(x1 - x0), y1 - y0); }
    g.closePath(); g.fillStyle = COL.board[side]; g.fill(); g.strokeStyle = '#e6c84a'; g.lineWidth = 1.5; g.stroke();
    const px = (a, b) => [T.X(a), T.Y(b)];
    const poly = (pts, close) => { g.beginPath(); pts.forEach((q, i) => { const s = px(q[0] + (o.dx || 0), q[1] + (o.dy || 0)); i ? g.lineTo(s[0], s[1]) : g.moveTo(s[0], s[1]); }); if (close) g.closePath(); };
    // Bauteil-Körper und Siebdruck
    const showBody = o.parts !== false;
    (board.parts || []).forEach(part => {
      const gm = S.geom[part.ref]; if (!gm || !showBody) return;
      const onSide = (part.side || 'top') === side, fp = fpOf(part.fp), tht = fp && fp.kind === 'tht';
      if (!onSide && !tht) return;
      const off = o.offsets && o.offsets[part.ref], k = o.offScale || 1, dx = off ? off.dx * k : 0, dy = off ? off.dy * k : 0, lift = (o.lift && o.lift[part.ref]) || 0;
      g.save(); const ox = (mir ? -1 : 1) * dx * view.s, oy = dy * view.s - lift * 10; g.translate(ox, oy);
      g.globalAlpha = onSide ? (o.bodyAlpha == null ? 1 : o.bodyAlpha) : 0.35; if (!onSide) g.setLineDash([4, 3]);
      if (gm.court) { poly(gm.court, true); g.fillStyle = o.bodyFill || COL.court; g.fill(); g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1; g.stroke(); }
      g.strokeStyle = side === 'bot' ? COL.silkB : COL.silk; g.lineWidth = Math.max(1, T.L(0.15));
      gm.silk.forEach(s => { if (s.circle) { g.beginPath(); g.arc(T.X(s.x), T.Y(s.y), T.L(s.r), 0, 7); g.stroke(); } else { poly(s.pts, !s.open); g.stroke(); } });
      g.setLineDash([]); g.restore();
    });
    // Pads
    S.pads.forEach(p => {
      const tht = p.drill > 0 || (p.layers && p.layers.length > 1), want = side === 'bot' ? 'B.Cu' : 'F.Cu';
      if (!tht && !(p.layers && p.layers.indexOf(want) >= 0)) return;
      if (o.onlySmd && tht) return;
      const x = T.X(p.x), y = T.Y(p.y), pw = T.L(p.w), ph = T.L(p.h);
      let fill = COL.cu;
      if (o.padFill) { const f = o.padFill(p); if (f === false) return; if (f) fill = f; }
      g.fillStyle = fill;
      if (p.shape === 'round' || p.shape === 'oval') { g.beginPath(); if (p.shape === 'round' && Math.abs(p.w - p.h) < 1e-6) g.arc(x, y, pw / 2, 0, 7); else g.ellipse(x, y, pw / 2, ph / 2, 0, 0, 7); g.fill(); }
      else g.fillRect(x - pw / 2, y - ph / 2, pw, ph);
      if (p.drill > 0) { g.fillStyle = '#0a0c0e'; g.beginPath(); g.arc(x, y, T.L(p.drill) / 2, 0, 7); g.fill(); }
      if (o.padStroke) { const s = o.padStroke(p); if (s) { g.strokeStyle = s; g.lineWidth = 2; g.strokeRect(x - pw / 2 - 2, y - ph / 2 - 2, pw + 4, ph + 4); } }
    });
    // Polarität, Pin 1
    if (o.polarity) {
      (board.parts || []).forEach(part => {
        const gm = S.geom[part.ref]; if (!gm || (part.side || 'top') !== side) return;
        g.save();
        gm.marks.forEach(m => {
          const x = T.X(m.x), y = T.Y(m.y);
          if (m.k === 'dot') { g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, Math.max(2.5, T.L(m.r)), 0, 7); g.fill(); g.strokeStyle = '#000'; g.lineWidth = 1; g.stroke(); }
          else if (m.k === 'text') { g.fillStyle = m.col; g.font = '700 ' + Math.max(9, Math.min(22, T.L(1.1))) + 'px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(m.t, x, y); }
          else if (m.k === 'stripe') { const tx = -m.ny, ty = m.nx, l = T.L(m.len) / 2, dxs = (mir ? -1 : 1); g.strokeStyle = '#fff'; g.lineWidth = Math.max(3, T.L(0.45)); g.lineCap = 'butt'; g.beginPath(); g.moveTo(x - dxs * tx * l, y - ty * l); g.lineTo(x + dxs * tx * l, y + ty * l); g.stroke(); }
        });
        if (gm.pin1) { const x = T.X(gm.pin1.x), y = T.Y(gm.pin1.y); g.strokeStyle = '#ffd54f'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, Math.max(5, T.L(0.9)), 0, 7); g.stroke(); }
        g.restore();
      });
    }
    // Referenzen
    if (o.refs) {
      g.textAlign = 'center'; g.textBaseline = 'middle';
      (board.parts || []).forEach(part => {
        if ((part.side || 'top') !== side) return; const gm = S.geom[part.ref]; if (!gm || !gm.bbox) return;
        const fsz = Math.max(0, Math.min(16, T.L(1.0))); if (fsz < 6.5) return;
        g.font = '600 ' + fsz + 'px system-ui'; const cx = T.X((gm.bbox[0] + gm.bbox[2]) / 2), cy = T.Y((gm.bbox[1] + gm.bbox[3]) / 2);
        g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.7)'; g.strokeText(part.ref, cx, cy); g.fillStyle = '#fff'; g.fillText(part.ref, cx, cy);
      });
    }
    // Hervorhebung
    if (o.hl && o.hl.size) {
      g.strokeStyle = '#ffd54f'; g.lineWidth = 2.5;
      (board.parts || []).forEach(part => { if (!o.hl.has(part.ref)) return; const gm = S.geom[part.ref]; if (!gm || !gm.bbox) return; const a = T.X(gm.bbox[0]), b = T.X(gm.bbox[2]), c = T.Y(gm.bbox[1]), d = T.Y(gm.bbox[3]); g.strokeRect(Math.min(a, b) - 3, c - 3, Math.abs(b - a) + 6, d - c + 6); });
    }
    if (o.overlay) o.overlay(g, T);
    return T;
  }
  /* Bauteil-Bild für das Quiz: Footprint in Normallage, Gehäusemarkierung wie bei echten Bauteilen */
  function drawFootprintPic(g, w, hh, fp, o) {
    o = o || {}; g.fillStyle = '#10161b'; g.fillRect(0, 0, w, hh);
    if (!fp) return;
    const wp = (fp.pads || []).map(p => ({ n: p.n, x: p.x, y: p.y, w: p.w, h: p.h, shape: p.shape, drill: p.drill }));
    const gm = partGeom({ x: 0, y: 0, rot: 0, side: 'top', fp: fp.id, ref: o.ref || '' }, fp, wp);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    wp.forEach(p => { x0 = Math.min(x0, p.x - p.w / 2); x1 = Math.max(x1, p.x + p.w / 2); y0 = Math.min(y0, p.y - p.h / 2); y1 = Math.max(y1, p.y + p.h / 2); });
    if (gm.court) gm.court.forEach(q => { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); });
    const s = Math.min((w - 40) / Math.max(1, x1 - x0), (hh - 40) / Math.max(1, y1 - y0)), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const X = x => w / 2 + (x - cx) * s, Y = y => hh / 2 + (y - cy) * s;
    // Gehäuse (Körper), nur wenn Markierungen gezeigt werden sollen
    if (gm.court) { g.beginPath(); gm.court.forEach((q, i) => i ? g.lineTo(X(q[0]), Y(q[1])) : g.moveTo(X(q[0]), Y(q[1]))); g.closePath(); g.fillStyle = o.body ? '#2b3036' : 'rgba(255,255,255,.05)'; g.fill(); g.strokeStyle = 'rgba(255,255,255,.25)'; g.stroke(); }
    g.strokeStyle = COL.silk; g.lineWidth = Math.max(1.5, 0.15 * s);
    gm.silk.forEach(q => { if (q.circle) { g.beginPath(); g.arc(X(q.x), Y(q.y), q.r * s, 0, 7); g.stroke(); } else { g.beginPath(); q.pts.forEach((a, i) => i ? g.lineTo(X(a[0]), Y(a[1])) : g.moveTo(X(a[0]), Y(a[1]))); if (!q.open) g.closePath(); g.stroke(); } });
    const hits = [];
    wp.forEach(p => {
      g.fillStyle = o.hit && o.hit.n === p.n ? (o.hit.ok ? '#4cd964' : '#ff5c5c') : COL.cu;
      const px = X(p.x), py = Y(p.y), pw = p.w * s, ph = p.h * s;
      if (p.shape === 'round' || p.shape === 'oval') { g.beginPath(); g.ellipse(px, py, pw / 2, ph / 2, 0, 0, 7); g.fill(); } else g.fillRect(px - pw / 2, py - ph / 2, pw, ph);
      if (p.drill > 0) { g.fillStyle = '#0a0c0e'; g.beginPath(); g.arc(px, py, p.drill * s / 2, 0, 7); g.fill(); }
      hits.push({ n: p.n, x: px, y: py, r: Math.max(18, Math.max(pw, ph) / 2 + 6) });
      if (o.numbers) { g.fillStyle = '#fff'; g.font = '600 ' + Math.max(10, Math.min(16, s * 0.6)) + 'px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(p.n, px, py - ph / 2 - 8); }
    });
    if (o.marks) gm.marks.forEach(m => {
      const x = X(m.x), y = Y(m.y);
      if (m.k === 'dot') { g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, Math.max(3, m.r * s), 0, 7); g.fill(); }
      else if (m.k === 'stripe') { const tx = -m.ny, ty = m.nx, l = m.len * s / 2; g.strokeStyle = '#fff'; g.lineWidth = Math.max(4, 0.45 * s); g.beginPath(); g.moveTo(x - tx * l, y - ty * l); g.lineTo(x + tx * l, y + ty * l); g.stroke(); }
    });
    return hits;
  }

  /* ---------- Lötstellen-Bilder (Mikroskop) ---------- */
  function blob(g, cx, cy, rx, ry, rnd, jit, fill) {
    g.beginPath(); const n = 22;
    for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2, k = 1 + (rnd() - 0.5) * jit; const x = cx + Math.cos(a) * rx * k, y = cy + Math.sin(a) * ry * k; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); }
  }
  function metal(g, cx, cy, rx, ry, dull) {
    const r = Math.max(rx, ry), gr = g.createRadialGradient(cx - rx * 0.3, cy - ry * 0.35, r * 0.05, cx, cy, r * 1.05);
    if (dull) { gr.addColorStop(0, '#9aa0a6'); gr.addColorStop(1, '#5d6368'); } else { gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.3, '#dfe6ec'); gr.addColorStop(0.75, '#98a4b0'); gr.addColorStop(1, '#5f6a75'); }
    return gr;
  }
  /* kind: gut kalt bruecke tombstone zinnperlen zuwenig benetzung ueberhitzt padlift zuviel verrutscht
     geom: { smd:bool, pw, ph } in mm (Pad), gap in mm bis zum Nachbarpad */
  function microPic(g, w, hh, kind, seed, geom) {
    const rnd = rng(seed || 1); geom = geom || {};
    g.fillStyle = '#17331f'; g.fillRect(0, 0, w, hh);
    g.fillStyle = 'rgba(255,255,255,.03)'; for (let i = 0; i < 60; i++) g.fillRect(rnd() * w, rnd() * hh, 2, 2);
    const smd = geom.smd !== false, cx = w / 2, cy = hh / 2;
    const pwmm = geom.pw || (smd ? 0.9 : 1.7), phmm = geom.ph || (smd ? 1.0 : 1.7), gapmm = geom.gap == null ? 0.7 : geom.gap;
    if (kind === 'tombstone') {                        // Seitenansicht
      g.fillStyle = '#2b5a35'; g.fillRect(0, hh * 0.68, w, hh * 0.32);
      const pwp = w * 0.26, y0 = hh * 0.68;
      g.fillStyle = COL.cu; g.fillRect(w * 0.12, y0 - 4, pwp, 4); g.fillRect(w * 0.62, y0 - 4, pwp, 4);
      g.fillStyle = metal(g, w * 0.25, y0 - 10, pwp * 0.5, 12); g.beginPath(); g.ellipse(w * 0.25, y0 - 10, pwp * 0.55, 13, 0, 0, 7); g.fillStyle = metal(g, w * 0.25, y0 - 10, pwp * 0.5, 12); g.fill();
      g.fillStyle = '#6a6f74'; g.beginPath(); g.ellipse(w * 0.75, y0 - 7, pwp * 0.45, 6, 0, 0, 7); g.fill();   // Pastenrest ohne Kontakt
      g.save(); g.translate(w * 0.27, y0 - 14); g.rotate(-1.25); g.fillStyle = '#c9cdd2'; g.fillRect(0, -9, 14, 18); g.fillStyle = '#3a2f26'; g.fillRect(14, -9, w * 0.3, 18); g.fillStyle = '#c9cdd2'; g.fillRect(14 + w * 0.3, -9, 14, 18); g.restore();
      g.fillStyle = '#fff'; g.font = '12px system-ui'; g.textAlign = 'left'; g.fillText('Seitenansicht: ein Ende steht in der Luft', 10, 18);
      return;
    }
    const sc = Math.min((w * 0.62) / (smd ? pwmm * 2 + gapmm : pwmm), (hh * 0.74) / phmm), pw = pwmm * sc, ph = phmm * sc, gap = gapmm * sc;
    const lx = smd ? cx - gap / 2 - pw / 2 : cx, rx = cx + gap / 2 + pw / 2;
    const drawPad = (x, lifted) => {
      g.save(); if (lifted) { g.translate(x, cy); g.rotate(0.06); g.translate(-x, -cy); g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 10; }
      g.fillStyle = kind === 'ueberhitzt' || lifted ? '#8a5a2a' : COL.cu;
      if (smd) g.fillRect(x - pw / 2, cy - ph / 2, pw, ph); else { g.beginPath(); g.arc(x, cy, pw / 2, 0, 7); g.fill(); g.fillStyle = '#0a0c0e'; g.beginPath(); g.arc(x, cy, pw * 0.14, 0, 7); g.fill(); }
      g.restore();
    };
    drawPad(lx, kind === 'padlift'); if (smd) drawPad(rx, false);
    const rx0 = pw * 0.5, ry0 = ph * 0.5;
    if (kind === 'gut') {
      g.fillStyle = metal(g, lx, cy, rx0, ry0); g.beginPath(); if (smd) g.roundRect ? g.roundRect(lx - rx0 * 0.98, cy - ry0 * 0.92, rx0 * 1.96, ry0 * 1.84, 14) : g.rect(lx - rx0, cy - ry0, rx0 * 2, ry0 * 2); else g.arc(lx, cy, rx0 * 0.95, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(lx - rx0 * 0.3, cy - ry0 * 0.4, rx0 * 0.28, ry0 * 0.12, -0.5, 0, 7); g.fill();
      if (smd) { g.fillStyle = '#3a2f26'; g.fillRect(lx + rx0 * 0.15, cy - ry0 * 0.7, gap * 0.9 + rx0 * 0.2, ry0 * 1.4); g.fillStyle = metal(g, lx, cy, rx0, ry0); g.beginPath(); g.ellipse(lx + rx0 * 0.15, cy, rx0 * 0.45, ry0 * 0.8, 0, 0, 7); g.fill(); }
    } else if (kind === 'kalt') {
      blob(g, lx, cy, rx0 * 0.85, ry0 * 0.8, rnd, 0.35, metal(g, lx, cy, rx0, ry0, true)); g.fillStyle = 'rgba(255,255,255,.14)'; for (let i = 0; i < 26; i++) { g.beginPath(); g.arc(lx + (rnd() - .5) * rx0 * 1.6, cy + (rnd() - .5) * ry0 * 1.5, 1 + rnd() * 2.5, 0, 7); g.fill(); }
      g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(lx - rx0 * 0.6, cy - ry0 * 0.1); g.lineTo(lx - rx0 * 0.1, cy + ry0 * 0.2); g.lineTo(lx + rx0 * 0.4, cy - ry0 * 0.05); g.stroke();
    } else if (kind === 'zuwenig') {
      g.fillStyle = metal(g, lx, cy, rx0 * 0.5, ry0 * 0.4); g.beginPath(); g.ellipse(lx - rx0 * 0.25, cy + ry0 * 0.25, rx0 * 0.5, ry0 * 0.4, 0.3, 0, 7); g.fill();
    } else if (kind === 'zuviel') {
      const R = Math.min(w, hh) * 0.3; g.fillStyle = metal(g, lx, cy, R, R); g.beginPath(); g.arc(lx, cy, R, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(lx - R * 0.35, cy - R * 0.4, R * 0.25, R * 0.12, -0.6, 0, 7); g.fill();
    } else if (kind === 'bruecke') {
      const x0 = lx - rx0 * 0.9, x1 = (smd ? rx : lx + pw) + rx0 * 0.9; g.fillStyle = metal(g, (x0 + x1) / 2, cy, (x1 - x0) / 2, ry0 * 0.85);
      g.beginPath(); g.moveTo(x0, cy - ry0 * 0.85); g.bezierCurveTo((x0 + x1) / 2, cy - ry0 * 0.35, (x0 + x1) / 2, cy - ry0 * 0.35, x1, cy - ry0 * 0.85); g.lineTo(x1, cy + ry0 * 0.85); g.bezierCurveTo((x0 + x1) / 2, cy + ry0 * 0.35, (x0 + x1) / 2, cy + ry0 * 0.35, x0, cy + ry0 * 0.85); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.ellipse(cx, cy - ry0 * 0.25, (x1 - x0) * 0.22, ry0 * 0.1, 0, 0, 7); g.fill();
    } else if (kind === 'zinnperlen') {
      g.fillStyle = metal(g, lx, cy, rx0, ry0); g.beginPath(); g.ellipse(lx, cy, rx0 * 0.9, ry0 * 0.85, 0, 0, 7); g.fill();
      for (let i = 0; i < 6; i++) { const bx = cx + (rnd() - 0.5) * w * 0.5, by = cy + (rnd() > 0.5 ? 1 : -1) * (ry0 * 0.9 + rnd() * hh * 0.1), br = 4 + rnd() * 7; g.fillStyle = metal(g, bx, by, br, br); g.beginPath(); g.arc(bx, by, br, 0, 7); g.fill(); }
    } else if (kind === 'benetzung') {
      for (let i = 0; i < 3; i++) { const bx = lx + (rnd() - 0.5) * rx0, by = cy + (rnd() - 0.5) * ry0, br = rx0 * (0.18 + rnd() * 0.2); g.fillStyle = metal(g, bx, by, br, br, true); g.beginPath(); g.arc(bx, by, br, 0, 7); g.fill(); }
      g.strokeStyle = 'rgba(40,20,5,.55)'; g.lineWidth = 3; g.strokeRect(lx - rx0, cy - ry0, rx0 * 2, ry0 * 2);
    } else if (kind === 'ueberhitzt' || kind === 'padlift') {
      blob(g, lx, cy, rx0 * 0.8, ry0 * 0.75, rnd, 0.3, '#5a4636'); g.fillStyle = 'rgba(20,10,4,.6)'; for (let i = 0; i < 12; i++) { g.beginPath(); g.arc(lx + (rnd() - .5) * rx0 * 1.4, cy + (rnd() - .5) * ry0 * 1.3, 2 + rnd() * 5, 0, 7); g.fill(); }
      if (kind === 'padlift') { g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.moveTo(lx - rx0, cy - ry0); g.lineTo(lx - rx0 * 0.3, cy - ry0 * 0.7); g.stroke(); }
    } else if (kind === 'verrutscht') {
      g.fillStyle = metal(g, lx, cy, rx0 * 0.6, ry0 * 0.6); g.beginPath(); g.ellipse(lx, cy, rx0 * 0.7, ry0 * 0.6, 0, 0, 7); g.fill(); g.fillStyle = '#3a2f26'; g.fillRect(lx + rx0 * 0.5, cy - ry0 * 0.2, gap + pw * 0.5, ry0 * 1.1); g.fillStyle = '#c9cdd2'; g.fillRect(lx + rx0 * 0.15, cy - ry0 * 0.2, rx0 * 0.6, ry0 * 1.1);
    }
  }

  /* ====================================================================================
     Ansicht asm: Bestückungsplan, Stückliste, Pick&Place, Reihenfolge, Erkennen
     ==================================================================================== */
  function mountAsm(el, ctx) {
    ensureCss();
    const fx = (k, x, y, t) => { try { if (ctx && ctx.fx) ctx.fx(k, x, y, t); } catch (e) { /* ok */ } };
    const S = { tab: load('asmTab', 'plan'), side: 'top', refs: true, pol: true, hl: new Set(), sel: null, view: { s: 1, ox: 0, oy: 0, auto: true }, game: null, quiz: null };
    let cvo = null, destroyed = false, quizCv = null;
    const rootEl = h('div', { class: 'pa' });
    const tabsEl = h('div', { class: 'pa-tabs' });
    const body = h('div', { class: 'pa-body' });
    rootEl.appendChild(tabsEl); rootEl.appendChild(body);
    el.innerHTML = ''; el.appendChild(rootEl);
    const TABS = [['plan', 'Bestückungsplan'], ['bom', 'Stückliste'], ['pnp', 'Pick&Place'], ['order', 'Reihenfolge'], ['quiz', 'Bauteile erkennen']];
    const board = () => ctx.getBoard();
    function cleanup() { if (cvo) { cvo.destroy(); cvo = null; } if (quizCv) { quizCv.destroy(); quizCv = null; } }
    function tabs() {
      tabsEl.innerHTML = '';
      TABS.forEach(t => tabsEl.appendChild(h('button', { class: 'pa-b' + (S.tab === t[0] ? ' on' : ''), text: t[1], onclick: () => { S.tab = t[0]; save('asmTab', S.tab); render(); } })));
    }
    function noBoard() { return !board() || !(board().parts || []).length; }
    function empty() {
      body.appendChild(h('div', { class: 'pa-card' }, [h('h3', { text: 'Noch keine Bauteile' }), h('div', { class: 'pa-mute', text: 'Setze im Layout-Editor Bauteile auf die Platine oder lade ein Beispiel. Dann erscheinen hier Bestückungsplan, Stückliste und Pick&Place-Daten.' })]));
    }
    function render() {
      cleanup(); tabs(); body.innerHTML = '';
      if (!C()) { body.appendChild(h('div', { class: 'pa-card' }, [h('h3', { text: 'Kern fehlt' }), h('div', { class: 'pa-mute', text: 'pcbcore.js ist nicht geladen.' })])); return; }
      if (noBoard()) { empty(); return; }
      prep(S, board());
      ({ plan, bom, pnp, order, quiz })[S.tab]();
    }

    /* ---------- Bestückungsplan ---------- */
    function plan() {
      const b = board();
      const bar = h('div', { class: 'pa-row' });
      const seg = h('div', { class: 'pa-seg' }, [['top', 'Oberseite'], ['bot', 'Unterseite']].map(a => h('button', { class: S.side === a[0] ? 'on' : '', text: a[1], onclick: () => { S.side = a[0]; S.view.auto = true; render(); } })));
      const tg = (k, txt) => h('button', { class: 'pa-chip' + (S[k] ? ' on' : ''), text: txt, onclick: () => { S[k] = !S[k]; render(); } });
      const nTop = b.parts.filter(p => (p.side || 'top') === 'top').length, nBot = b.parts.length - nTop;
      bar.appendChild(seg); bar.appendChild(tg('refs', 'Referenzen')); bar.appendChild(tg('pol', 'Polarität und Pin 1'));
      bar.appendChild(h('button', { class: 'pa-b s', text: '+', 'aria-label': 'Vergrößern', onclick: () => pz.zoomAt(cvo.w / 2, cvo.h / 2, 1.4) }));
      bar.appendChild(h('button', { class: 'pa-b s', text: '−', 'aria-label': 'Verkleinern', onclick: () => pz.zoomAt(cvo.w / 2, cvo.h / 2, 1 / 1.4) }));
      bar.appendChild(h('button', { class: 'pa-b s', text: 'Einpassen', onclick: () => { fitView(S.view, b, cvo.w, cvo.h); cvo.redraw(); } }));
      body.appendChild(bar);
      const split = h('div', { class: 'pa-split' }), left = h('div'), right = h('div');
      const box = h('div', { class: 'pa-cv' }); left.appendChild(box);
      left.appendChild(h('div', { class: 'pa-mute', text: 'Unterseite: Ansicht von unten, gespiegelt. Antippen zeigt Bauteildaten, Zwei-Finger-Geste oder Mausrad zoomt. Oben ' + nTop + ' Bauteile, unten ' + nBot + '.' }));
      split.appendChild(left); split.appendChild(right); body.appendChild(split);
      const info = h('div', { class: 'pa-card' }); right.appendChild(info);
      const showInfo = () => {
        info.innerHTML = '';
        const sel = S.sel && b.parts.find(p => p.ref === S.sel);
        if (!sel) { info.appendChild(h('h3', { text: 'Bauteil wählen' })); info.appendChild(h('div', { class: 'pa-mute', text: 'Tippe ein Bauteil im Plan an. Hier siehst du Wert, Bauform, Lage und Polaritätshinweis.' })); }
        else {
          const fp = fpOf(sel.fp), gm = S.geom[sel.ref] || {};
          info.appendChild(h('h3', { text: sel.ref + '  ' + (sel.value || '') }));
          info.appendChild(h('div', { html: '<span class="pa-tag">' + esc(sel.fp) + '</span><span class="pa-tag">' + (fp && fp.kind === 'tht' ? 'THT' : 'SMD') + '</span><span class="pa-tag">' + (sel.side === 'bot' ? 'Unterseite' : 'Oberseite') + '</span>' }));
          info.appendChild(h('div', { class: 'pa-mute', style: 'margin-top:6px', text: 'Position ' + (+sel.x).toFixed(2).replace('.', ',') + ' / ' + (+sel.y).toFixed(2).replace('.', ',') + ' mm, Drehung ' + (sel.rot || 0) + ' Grad' + (fp && fp.desc ? '. ' + fp.desc : '') }));
          if (gm.pol && gm.pol.type) info.appendChild(h('div', { class: 'pa-warn good', style: 'margin-top:8px', text: gm.pol.text }));
          else info.appendChild(h('div', { class: 'pa-mute', style: 'margin-top:8px', text: 'Keine Polarität: das Bauteil darf in beiden Richtungen bestückt werden.' }));
        }
        const pol = (b.parts || []).filter(p => (S.geom[p.ref] || {}).pol && S.geom[p.ref].pol.type && ['ic', 'elko', 'led', 'diode', 'to'].indexOf(S.geom[p.ref].pol.type) >= 0);
        info.appendChild(h('div', { class: 'pa-mute', style: 'margin-top:8px', text: pol.length + ' Bauteile mit Polarität oder Pin-1-Markierung auf dieser Platine.' }));
      };
      showInfo();
      cvo = mkCv(box, (g, w, hh) => drawBoard(g, w, hh, S, S.view, { side: S.side, refs: S.refs, polarity: S.pol, hl: S.sel ? new Set([S.sel]) : S.hl }), {
        onResize: o => { if (S.view.auto) fitView(S.view, b, o.w, o.h); }
      });
      const pz = attachPZ(cvo.cv, S.view, () => cvo.redraw(), (x, y) => {
        const T = mkT(b, S.view, S.side === 'bot'), q = T.inv(x, y); let best = null, ba = 1e9;
        b.parts.forEach(p => { const gm = S.geom[p.ref]; if (!gm || !gm.bbox) return; const fp = fpOf(p.fp); if ((p.side || 'top') !== S.side && !(fp && fp.kind === 'tht')) return; const bb = gm.bbox; if (q[0] >= bb[0] && q[0] <= bb[2] && q[1] >= bb[1] && q[1] <= bb[3]) { const a = (bb[2] - bb[0]) * (bb[3] - bb[1]); if (a < ba) { ba = a; best = p.ref; } } });
        S.sel = best; S.hl = new Set(); showInfo(); cvo.redraw();
      });
    }

    /* ---------- Stückliste ---------- */
    function bom() {
      const b = board(), rows = bomOf(b), tot = rows.reduce((s, r) => s + r.qty, 0);
      let smd = 0, tht = 0; b.parts.forEach(p => { const f = fpOf(p.fp); (f && f.kind === 'tht') ? tht++ : smd++; });
      const card = h('div', { class: 'pa-card' });
      card.appendChild(h('div', { class: 'pa-row' }, [
        h('div', { class: 'pa-grow', html: '<b>' + rows.length + ' Positionen</b>, ' + tot + ' Bauteile (' + smd + ' SMD, ' + tht + ' THT)' }),
        h('button', { class: 'pa-b', text: 'CSV exportieren', onclick: () => { const ok = download((b.name || 'platine').replace(/[^\w-]+/g, '_') + '-stueckliste.csv', csvOf(rows.map((r, i) => ({ Pos: i + 1, Menge: r.qty, Wert: r.value, Footprint: r.fp, Referenzen: r.refs.join(' ') })), ['Pos', 'Menge', 'Wert', 'Footprint', 'Referenzen'])); ctx.toast && ctx.toast(ok ? 'Stückliste als CSV gespeichert.' : 'Export nicht möglich.'); } })]));
      const tbl = h('table'); tbl.appendChild(h('thead', null, h('tr', null, ['Pos', 'Menge', 'Wert', 'Bauform', 'Typ', 'Referenzen'].map(t => h('th', { text: t })))));
      const tb = h('tbody');
      rows.forEach((r, i) => {
        const f = fpOf(r.fp), kind = f ? (f.kind === 'tht' ? 'THT' : 'SMD') : '';
        tb.appendChild(h('tr', { class: 'clk', onclick: () => { S.hl = new Set(r.refs); S.sel = null; S.tab = 'plan'; S.side = (b.parts.find(p => p.ref === r.refs[0]) || {}).side || 'top'; render(); } }, [
          h('td', { text: i + 1 }), h('td', { text: r.qty + '×' }), h('td', { text: r.value }), h('td', { text: r.fp + (f && f.name && f.name !== r.fp ? ' (' + f.name + ')' : '') }), h('td', { text: kind }), h('td', { text: r.refs.join(', ') })]));
      });
      tbl.appendChild(tb); card.appendChild(h('div', { style: 'overflow-x:auto' }, tbl)); card.appendChild(h('div', { class: 'pa-mute', style: 'margin-top:6px', text: 'Zeile antippen: die Bauteile werden im Bestückungsplan markiert.' }));
      body.appendChild(card);
    }

    /* ---------- Pick&Place ---------- */
    function pnp() {
      const b = board(), rows = ppOf(b).slice().sort((a, c) => (a.side === c.side ? (a.ref < c.ref ? -1 : 1) : a.side === 'bot' ? 1 : -1));
      const card = h('div', { class: 'pa-card' });
      const num = v => (+v).toFixed(2).replace('.', ',');
      card.appendChild(h('div', { class: 'pa-row' }, [
        h('div', { class: 'pa-grow', html: '<b>' + rows.length + ' Platzierungen</b> für den Bestückungsautomaten' }),
        h('button', { class: 'pa-b', text: 'CSV exportieren', onclick: () => { let t; try { t = C().pickplaceCsv ? C().pickplaceCsv(b) : null; } catch (e) { t = null; } if (!t) t = csvOf(rows, ['ref', 'value', 'fp', 'x', 'y', 'rot', 'side']); const ok = download((b.name || 'platine').replace(/[^\w-]+/g, '_') + '-pickplace.csv', t); ctx.toast && ctx.toast(ok ? 'Pick&Place als CSV gespeichert.' : 'Export nicht möglich.'); } })]));
      card.appendChild(h('div', { class: 'pa-mute', style: 'margin-bottom:8px', text: 'Koordinaten in mm ab linker oberer Ecke der Platine, y nach unten. Der Automat nimmt jedes Bauteil aus dem Gurt, dreht es auf die angegebene Rotation und setzt es auf die Position. Bauteile der Unterseite werden im zweiten Durchgang bestückt.' }));
      const tbl = h('table'); tbl.appendChild(h('thead', null, h('tr', null, ['Ref', 'Wert', 'Bauform', 'X mm', 'Y mm', 'Rot', 'Seite'].map(t => h('th', { text: t })))));
      const tb = h('tbody');
      rows.forEach(r => tb.appendChild(h('tr', { class: 'clk', onclick: () => { S.sel = r.ref; S.tab = 'plan'; S.side = r.side === 'bot' ? 'bot' : 'top'; render(); } }, [h('td', { text: r.ref }), h('td', { text: r.value }), h('td', { text: r.fp }), h('td', { text: num(r.x) }), h('td', { text: num(r.y) }), h('td', { text: r.rot + '°' }), h('td', { text: r.side === 'bot' ? 'unten' : 'oben' })])));
      tbl.appendChild(tb); card.appendChild(h('div', { style: 'overflow-x:auto' }, tbl)); body.appendChild(card);
    }

    /* ---------- Reihenfolge-Spiel ---------- */
    function gameItems(b) {
      const m = {};
      b.parts.forEach(p => { const k = (p.side || 'top') + '|' + p.fp + '|' + (p.value || ''); (m[k] = m[k] || { key: k, refs: [], fp: p.fp, value: p.value, side: p.side || 'top' }).refs.push(p.ref); });
      return Object.keys(m).map(k => { const it = m[k], f = PCB_ASM.fpInfo(it.fp); it.kind = f.kind; it.h = f.h; return it; });
    }
    function order() {
      const b = board(), sig = b.parts.map(p => p.ref + p.fp + p.side).join(',');
      if (!S.game || S.game.sig !== sig) {
        const items = gameItems(b), r = rng(Date.now() % 100000 + 7), ord = items.map(i => i.key);
        for (let i = ord.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = ord[i]; ord[i] = ord[j]; ord[j] = t; }
        S.game = { sig, items, order: ord, res: null, tries: 0, best: 0 };
      }
      const G = S.game, byKey = {}; G.items.forEach(i => { byKey[i.key] = i; });
      const info = h('div', { class: 'pa-card' }, [h('h3', { text: 'Bestückungsreihenfolge' }), h('div', { class: 'pa-mute', html: 'Bringe die Positionen in die richtige Reihenfolge, mit den Pfeilen. Regeln: <b>1.</b> SMD vor THT. <b>2.</b> Beim Reflow die <b>Unterseite zuerst</b>. <b>3.</b> Innerhalb einer Seite <b>niedrige Bauteile vor hohen</b>. <b>4.</b> THT-Teile zuletzt (Handlöten oder Welle).' })]);
      body.appendChild(info);
      const bar = h('div', { class: 'pa-row' }, [
        h('button', { class: 'pa-b pri', text: 'Prüfen', onclick: () => check() }),
        h('button', { class: 'pa-b', text: 'Mischen', onclick: () => { const r = rng(Date.now() % 100000), o = G.order; for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = o[i]; o[i] = o[j]; o[j] = t; } G.res = null; paint(); } }),
        h('button', { class: 'pa-b', text: 'Lösung zeigen', onclick: () => { const ideal = PCB_ASM.idealOrder(b), seen = []; ideal.forEach(r => { const it = G.items.find(i => i.refs.indexOf(r) >= 0); if (it && seen.indexOf(it.key) < 0) seen.push(it.key); }); G.order = seen; G.res = null; check(true); } })]);
      body.appendChild(bar);
      const resBox = h('div'), list = h('div'); body.appendChild(resBox); body.appendChild(list);
      const move = (i, d) => { const o = G.order, j = i + d; if (j < 0 || j >= o.length) return; const t = o[i]; o[i] = o[j]; o[j] = t; G.res = null; paint(); };
      function refsInOrder() { const out = []; G.order.forEach(k => byKey[k].refs.forEach(r => out.push(r))); return out; }
      function check(silent) {
        const r = PCB_ASM.orderScore(refsInOrder(), b); G.res = r; G.tries++; G.best = Math.max(G.best, r.score); paint();
        if (!silent) { const bb = list.getBoundingClientRect(); if (r.score >= 100) { fx('tada', bb.left + bb.width / 2, bb.top + 40, 'Perfekte Reihenfolge!'); try { root.LochFX && root.LochFX.pass && root.LochFX.pass(100); } catch (e) { /* ok */ } } else fx(r.score >= 70 ? 'click' : 'boing', bb.left + bb.width / 2, bb.top + 40); }
      }
      function paint() {
        resBox.innerHTML = ''; list.innerHTML = '';
        const r = G.res, badKeys = new Set();
        if (r) {
          const col = r.score >= 100 ? 'good' : r.score >= 70 ? 'warn' : 'bad';
          const card = h('div', { class: 'pa-warn ' + col }, [h('b', { text: r.score + ' von 100 Punkten' }), h('span', { text: r.score >= 100 ? '  Alles richtig, so läuft die Fertigung ohne Probleme.' : '  ' + r.errors.length + ' Reihenfolgefehler.' })]);
          resBox.appendChild(card);
          r.errors.slice(0, 4).forEach(e => resBox.appendChild(h('div', { class: 'pa-warn warn', text: e.why })));
          if (r.errors.length > 4) resBox.appendChild(h('div', { class: 'pa-mute', text: '... und ' + (r.errors.length - 4) + ' weitere.' }));
          r.errors.forEach(e => { G.items.forEach(it => { if (it.refs.indexOf(e.a) >= 0 && it.refs.indexOf(e.b) < 0) badKeys.add(it.key); }); });
        }
        G.order.forEach((k, i) => {
          const it = byKey[k];
          list.appendChild(h('div', { class: 'pa-card2' + (r ? (badKeys.has(k) ? ' bad' : ' ok') : '') }, [
            h('div', { class: 'pa-n', text: i + 1 }),
            h('div', { class: 'pa-grow' }, [h('div', { html: '<b>' + esc(it.refs.join(', ')) + '</b> ' + esc(it.value || '') }),
              h('div', { html: '<span class="pa-tag">' + esc(it.fp) + '</span><span class="pa-tag">' + (it.kind === 'tht' ? 'THT' : 'SMD') + '</span><span class="pa-tag">' + (it.side === 'bot' ? 'Unterseite' : 'Oberseite') + '</span><span class="pa-tag">ca. ' + it.h.toFixed(1).replace('.', ',') + ' mm hoch</span>' })]),
            h('button', { class: 'pa-b s', text: '▲', 'aria-label': 'Nach oben', disabled: i === 0, onclick: () => move(i, -1) }),
            h('button', { class: 'pa-b s', text: '▼', 'aria-label': 'Nach unten', disabled: i === G.order.length - 1, onclick: () => move(i, 1) })]));
        });
        list.appendChild(h('div', { class: 'pa-mute', text: 'Versuche: ' + G.tries + ', beste Wertung: ' + G.best + ' Punkte.' }));
      }
      paint();
    }

    /* ---------- Bauteil-Erkennung (Quiz) ---------- */
    function quizPool() { const t = fpTable(); return Object.keys(t).map(k => t[k]).filter(f => f && f.pads && f.pads.length); }
    function newQ() {
      const pool = quizPool(); if (pool.length < 4) return null;
      const r = rng(Date.now() % 1000003 + (S.quiz ? S.quiz.n * 7919 : 1)), pick = a => a[Math.floor(r() * a.length)];
      const pols = pool.filter(f => { const gm = partGeom({ x: 0, y: 0, rot: 0, side: 'top', fp: f.id, ref: 'X1' }, f, f.pads.map(p => ({ n: p.n, x: p.x, y: p.y, w: p.w, h: p.h }))); return gm.pol.type && gm.pol.type !== 'hdr' && gm.marks.length; });
      const type = r() < 0.4 && pols.length ? 'pol' : r() < 0.5 ? 'name' : 'kind';
      if (type === 'pol') {
        const f = pick(pols), gm = partGeom({ x: 0, y: 0, rot: 0, side: 'top', fp: f.id, ref: 'X1' }, f, f.pads.map(p => ({ n: p.n, x: p.x, y: p.y, w: p.w, h: p.h })));
        const t = gm.pol.type, ask = { ic: 'Tippe auf Pin 1.', to: 'Tippe auf Pin 1.', elko: 'Dieser Elko hat einen Streifen am Gehäuse. Tippe auf den Pluspol.', led: 'Tippe auf die Kathode (Balken oder flache Seite).', diode: 'Tippe auf die Kathode (Balken).' }[t];
        return { type, fp: f, ask, answer: '1', pol: gm.pol };
      }
      const f = pick(pool);
      if (type === 'kind') return { type, fp: f, ask: 'Ist dieses Bauteil für Durchsteckmontage (THT) oder Oberflächenmontage (SMD)?', options: ['THT', 'SMD'], answer: f.kind === 'tht' ? 'THT' : 'SMD' };
      const same = pool.filter(x => x.id !== f.id && x.kind === f.kind), opts = [f];
      while (opts.length < 4 && same.length) { const o = pick(same); if (opts.indexOf(o) < 0) opts.push(o); if (opts.length >= same.length + 1) break; }
      for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = opts[i]; opts[i] = opts[j]; opts[j] = t; }
      return { type, fp: f, ask: 'Welche Bauform ist das?', options: opts.map(o => o.name || o.id), answer: f.name || f.id, ids: opts.map(o => o.id) };
    }
    function quiz() {
      if (!S.quiz) S.quiz = { n: 0, score: 0, total: 10, cur: null, done: false, hit: null, answered: false };
      const Q = S.quiz;
      if (!Q.cur && !Q.done) Q.cur = newQ();
      if (!Q.cur && !Q.done) { body.appendChild(h('div', { class: 'pa-card', text: 'Zu wenige Footprints im Kern für das Quiz.' })); return; }
      const card = h('div', { class: 'pa-card' }); body.appendChild(card);
      if (Q.done) {
        card.appendChild(h('h3', { text: 'Ergebnis' }));
        card.appendChild(h('div', { html: '<big>' + Q.score + ' von ' + Q.total + '</big>' }));
        card.appendChild(h('div', { class: 'pa-mute', style: 'margin:6px 0 10px', text: Q.score >= 9 ? 'Ausgezeichnet, du erkennst Bauformen und Polarität sicher.' : Q.score >= 6 ? 'Gut. Übe noch Polarität und Bauformen mit ähnlichem Aussehen.' : 'Schau dir die Bauteile im Bestückungsplan nochmal an und versuche es erneut.' }));
        card.appendChild(h('button', { class: 'pa-b pri', text: 'Nochmal', onclick: () => { S.quiz = null; render(); } }));
        return;
      }
      const q = Q.cur;
      card.appendChild(h('div', { class: 'pa-row' }, [h('b', { text: 'Frage ' + (Q.n + 1) + ' von ' + Q.total }), h('span', { class: 'pa-mute', text: 'Punkte: ' + Q.score })]));
      card.appendChild(h('div', { style: 'margin:4px 0 8px', text: q.ask }));
      const box = h('div', { class: 'pa-cv', style: 'height:230px;min-height:230px' }); card.appendChild(box);
      let hits = [];
      quizCv = mkCv(box, (g, w, hh) => { hits = drawFootprintPic(g, w, hh, q.fp, { marks: q.type === 'pol', body: q.type === 'pol', hit: Q.hit, numbers: false }) || []; });
      const fb = h('div'), nextRow = h('div', { class: 'pa-row' });
      const finish = ok => {
        Q.answered = true; if (ok) Q.score++;
        const bb = box.getBoundingClientRect(); fx(ok ? 'ding' : 'boing', bb.left + bb.width / 2, bb.top + 40, ok ? 'Richtig!' : 'Knapp daneben.');
        fb.innerHTML = ''; fb.appendChild(h('div', { class: 'pa-warn ' + (ok ? 'good' : 'bad'), text: (ok ? 'Richtig. ' : 'Leider falsch. ') + (q.type === 'pol' ? q.pol.text : q.type === 'name' ? (q.fp.name || q.fp.id) + (q.fp.desc ? ': ' + q.fp.desc : '') : (q.fp.name || q.fp.id) + ' ist ein ' + (q.fp.kind === 'tht' ? 'THT-Bauteil (Anschlüsse durch Löcher)' : 'SMD-Bauteil (Anschlüsse auf der Oberfläche)') + '.') }));
        nextRow.appendChild(h('button', { class: 'pa-b pri', text: Q.n + 1 >= Q.total ? 'Ergebnis' : 'Weiter', onclick: () => { Q.n++; Q.cur = null; Q.hit = null; Q.answered = false; if (Q.n >= Q.total) Q.done = true; render(); } }));
        quizCv && quizCv.redraw();
      };
      if (q.type === 'pol') {
        quizCv.cv.addEventListener('pointerdown', e => {
          if (Q.answered) return; const r = quizCv.cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; let best = null, bd = 1e9;
          hits.forEach(p => { const d = Math.hypot(p.x - x, p.y - y); if (d < p.r && d < bd) { bd = d; best = p; } });
          if (!best) return; const ok = best.n === q.answer; Q.hit = { n: best.n, ok }; finish(ok);
        });
      } else {
        const row = h('div', { class: 'pa-row', style: 'margin-top:8px' });
        q.options.forEach(o => row.appendChild(h('button', { class: 'pa-b', text: o, onclick: ev => { if (Q.answered) return; const ok = o === q.answer; row.querySelectorAll('button').forEach(bn => { bn.disabled = true; if (bn.textContent === q.answer) bn.classList.add('ok'); }); if (!ok) ev.currentTarget.style.background = '#7a2a2a'; finish(ok); } })));
        card.appendChild(row);
      }
      card.appendChild(fb); card.appendChild(nextRow);
    }

    render();
    return {
      refresh() { if (destroyed || S.tab === 'quiz') return; render(); },
      destroy() { destroyed = true; cleanup(); el.innerHTML = ''; },
      onShow() { if (!destroyed && S.tab !== 'quiz') render(); }
    };
  }
  PCB_VIEWS.register('asm', { title: 'Bestückung', mount: mountAsm });

  /* ====================================================================================
     Ansicht solder: Reflow-Lötsimulation und Handlöten
     ==================================================================================== */
  const smdPads = pads => pads.filter(p => !(p.drill > 0) && p.layers && p.layers.length === 1);
  function mkSlider(label, min, max, step, val, fmtv, oninput) {
    const lab = h('label', { text: label }), out = h('b'), inp = h('input', { type: 'range', min, max, step, value: val });
    const upd = () => { out.textContent = fmtv(+inp.value); };
    inp.addEventListener('input', () => { upd(); oninput(+inp.value); }); upd();
    const el = h('div', { class: 'pa-sl' }, [lab, out, inp]);
    return { el, inp, set(v) { inp.value = v; upd(); }, disable(d) { inp.disabled = d; } };
  }
  const f1 = (v, d) => PCB_ASM.fm(v, d == null ? 1 : d);

  function mountSolder(el, ctx) {
    ensureCss();
    const fx = (k, x, y, t) => { try { if (ctx && ctx.fx) ctx.fx(k, x, y, t); } catch (e) { /* ok */ } };
    const sv = load('solder', {});
    const R = {
      mode: sv.mode || 'reflow', step: 1, stencil: Object.assign({}, PCB_ASM.DEFAULT_STENCIL, sv.stencil || {}), profile: Object.assign({}, PCB_ASM.DEFAULT_PROFILE, sv.profile || {}),
      printed: false, pp: 0, placed: false, drop: 0, result: null, seed: 1, sel: null, attempts: 0, demo: false, side: 'top', S: {}, view: { s: 1, ox: 0, oy: 0, auto: true },
      oven: { run: false, p: 0 }, filter: null, best: sv.best || 0, fxDone: false
    };
    const H = { ex: sv.ex || 'tht', temp: 340, tip: 'meissel', wire: 4, drag: 5, res: {}, run: null, drawing: 0, pending: null, best: sv.hbest || {} };
    let destroyed = false, cvo = null, ovo = null, chartO = null, microO = null, handO = null, tick = 0, raf = 0, demoB = null;
    const persist = () => save('solder', { mode: R.mode, stencil: R.stencil, profile: R.profile, best: R.best, ex: H.ex, hbest: H.best });
    const rootEl = h('div', { class: 'pa' }), tabsEl = h('div', { class: 'pa-tabs' }), body = h('div', { class: 'pa-body' });
    rootEl.appendChild(tabsEl); rootEl.appendChild(body); el.innerHTML = ''; el.appendChild(rootEl);
    function killLoops() { cancelAnimationFrame(raf); clearInterval(tick); raf = 0; tick = 0; R.oven.run = false; }
    let animTok = 0;
    /* Animation mit requestAnimationFrame und Zeitgeber als Rückfall (läuft auch, wenn die Seite im Hintergrund ist) */
    function anim(ms, frame, done) {
      const tok = ++animTok, t0 = performance.now(); let fin = false;
      const end = () => { if (fin || tok !== animTok || destroyed) return; fin = true; frame(1); if (done) done(); };
      const f = now => { if (fin || tok !== animTok || destroyed) return; const u = Math.min(1, (now - t0) / ms); if (u < 1) { frame(u); raf = requestAnimationFrame(f); } else end(); };
      raf = requestAnimationFrame(f); setTimeout(end, ms + 300);
    }
    function cleanup() { animTok++; killLoops();[cvo, ovo, chartO, microO, handO].forEach(o => o && o.destroy()); cvo = ovo = chartO = microO = handO = null; }
    function topTabs() {
      tabsEl.innerHTML = '';
      [['reflow', 'Reflow-Löten'], ['hand', 'Handlöten']].forEach(t => tabsEl.appendChild(h('button', { class: 'pa-b' + (R.mode === t[0] ? ' on' : ''), text: t[1], onclick: () => { R.mode = t[0]; persist(); render(); } })));
    }
    function render() {
      cleanup(); topTabs(); body.innerHTML = '';
      if (R.mode === 'hand') return renderHand();
      renderReflow();
    }

    /* ---------- Platine für die Simulation ---------- */
    function demoBoard() {
      if (demoB) return demoB; const Cc = C(); if (!Cc || !Cc.newBoard) return null;
      let b; try { b = Cc.newBoard({ name: 'Übungsplatine Reflow', w: 46, h: 30, layers: 2 }); } catch (e) { return null; }
      b.name = 'Übungsplatine Reflow'; b.w = 46; b.h = 30; b.parts = b.parts || [];
      const add = (ref, fp, x, y, v) => { if (fpOf(fp)) b.parts.push({ id: 'd' + b.parts.length, ref, fp, value: v || '', x, y, rot: 0, side: 'top' }); };
      add('R1', 'R0603', 8, 7, '10k'); add('R2', 'R0603', 17, 7, '10k'); add('R3', 'R0603', 26, 7, '10k'); add('R4', 'R0603', 35, 7, '10k'); add('C1', 'C0603', 42, 7, '100n');
      add('R5', 'R0805', 8, 14, '1k'); add('C2', 'C0805', 17, 14, '1u'); add('R6', 'R0402', 26, 14, '4k7'); add('D1', 'LED0603', 35, 14, 'rot');
      add('U1', 'SOIC-8', 30, 23, 'LM358'); add('R7', 'R1206', 12, 23, '470');
      b.nets = [{ name: 'GND', cls: 'power', pins: ['R2.1', 'R4.1', 'C1.2', 'U1.4'] }, { name: 'VCC', cls: 'power', pins: ['R1.1', 'U1.8'] }];
      b.zones = b.zones || []; b.tracks = b.tracks || []; b.vias = b.vias || [];
      const pd = padsOf(b), at = (r, n) => pd.find(p => p.ref === r && String(p.n) === n);
      const z = (r, th) => { const p = at(r, '1'); if (p) b.zones.push({ id: 'z' + r, layer: 'F.Cu', net: 'GND', thermals: th, clearance: 0.3, poly: [[p.x - 2.2, p.y - 1.6], [p.x + 0.4, p.y - 1.6], [p.x + 0.4, p.y + 1.6], [p.x - 2.2, p.y + 1.6]] }); };
      z('R2', false); z('R4', true);
      demoB = b; return b;
    }
    function work() {
      const b = ctx.getBoard(); let own = false;
      if (b && (b.parts || []).length && !R.demo) { const n = smdPads(padsOf(b)).length; own = n >= 2; }
      if (own) return { b, demo: false, note: '' };
      const d = demoBoard();
      return { b: d, demo: true, note: b && (b.parts || []).length ? 'Deine Platine hat kaum SMD-Pads. Du siehst deshalb die Übungsplatine.' : 'Du hast noch keine SMD-Bauteile gesetzt. Hier siehst du die Übungsplatine.' };
    }
    function resetRun(full) {
      R.printed = false; R.pp = 0; R.placed = false; R.drop = 0; R.result = null; R.sel = null; R.fxDone = false; R.oven = { run: false, p: 0 }; R.step = 1;
      if (full) { R.stencil = Object.assign({}, PCB_ASM.DEFAULT_STENCIL); R.profile = Object.assign({}, PCB_ASM.DEFAULT_PROFILE); R.attempts = 0; }
      R.S = {};
    }

    function renderReflow() {
      if (!C()) { body.appendChild(h('div', { class: 'pa-card' }, [h('h3', { text: 'Kern fehlt' }), h('div', { class: 'pa-mute', text: 'pcbcore.js ist nicht geladen.' })])); return; }
      const W = work(); if (!W.b) { body.appendChild(h('div', { class: 'pa-card', text: 'Es ist keine Platine verfügbar.' })); return; }
      prep(R.S, W.b); R.wb = W.b;
      if (R.sigRun && R.sigRun !== R.S.sig && R.step > 1) { const keep = R.S; resetRun(); R.S = keep; }
      R.sigRun = R.S.sig;
      if (!R.offsets || R.offsetsFor !== R.S.sig) { R.offsets = PCB_ASM.defaultOffsets(W.b, R.seed); R.offsetsFor = R.S.sig; }
      const hasBot = smdPads(R.S.pads).some(p => p.layers[0] === 'B.Cu');
      if (!hasBot) R.side = 'top';
      // Kopf
      const head = h('div', { class: 'pa-row' });
      const steps = ['1 Pastendruck', '2 Bestücken', '3 Reflow-Profil', '4 Ergebnis'];
      const st = h('div', { class: 'pa-step' }, steps.map((t, i) => h('button', { class: 'pa-b' + (R.step === i + 1 ? ' on' : '') + (R.step > i + 1 ? ' ok' : ''), text: t, disabled: (i + 1 === 2 && !R.printed) || (i + 1 === 3 && !R.placed) || (i + 1 === 4 && !R.result), onclick: () => { R.step = i + 1; render(); } })));
      body.appendChild(st);
      if (W.demo) {
        head.appendChild(h('div', { class: 'pa-grow pa-mute', text: W.note }));
        if (ctx.getBoard() && smdPads(padsOf(ctx.getBoard())).length >= 2) head.appendChild(h('button', { class: 'pa-b s', text: 'Meine Platine', onclick: () => { R.demo = false; resetRun(); render(); } }));
      } else if (smdPads(padsOf(ctx.getBoard())).length >= 2) head.appendChild(h('button', { class: 'pa-b s', text: 'Übungsplatine', onclick: () => { R.demo = true; resetRun(); render(); } }));
      if (hasBot) head.appendChild(h('div', { class: 'pa-seg' }, [['top', 'Oberseite'], ['bot', 'Unterseite']].map(a => h('button', { class: R.side === a[0] ? 'on' : '', text: a[1], onclick: () => { R.side = a[0]; R.view.auto = true; render(); } }))));
      if (head.children.length) body.appendChild(head);
      ({ 1: stepPaste, 2: stepPlace, 3: stepProfile, 4: stepResult })[R.step](W);
    }

    /* gemeinsame Platinenfläche der Schritte 1, 2 und 4 */
    function boardCanvas(box, drawOpts, onTap) {
      const b = R.wb;
      cvo = mkCv(box, (g, w, hh) => { const o = drawOpts(); drawBoard(g, w, hh, R.S, R.view, Object.assign({ side: R.side }, o)); }, { onResize: o => { if (R.view.auto) fitView(R.view, b, o.w, o.h); } });
      R.view.auto = true;
      const pz = attachPZ(cvo.cv, R.view, () => cvo.redraw(), onTap);
      return pz;
    }
    const sidePads = () => smdPads(R.S.pads).filter(p => (p.layers[0] === 'B.Cu' ? 'bot' : 'top') === R.side);
    const zoomBar = pz => h('div', { class: 'pa-row' }, [
      h('button', { class: 'pa-b s', text: '+', 'aria-label': 'Vergrößern', onclick: () => pz.zoomAt(cvo.w / 2, cvo.h / 2, 1.5) }),
      h('button', { class: 'pa-b s', text: '−', 'aria-label': 'Verkleinern', onclick: () => pz.zoomAt(cvo.w / 2, cvo.h / 2, 1 / 1.5) }),
      h('button', { class: 'pa-b s', text: 'Einpassen', onclick: () => { fitView(R.view, R.wb, cvo.w, cvo.h); cvo.redraw(); } })]);

    /* ----- Schritt 1: Lotpastendruck ----- */
    function stepPaste() {
      const split = h('div', { class: 'pa-split' }), left = h('div'), right = h('div'); split.appendChild(left); split.appendChild(right); body.appendChild(split);
      const box = h('div', { class: 'pa-cv' }); left.appendChild(box);
      const info = h('div', { class: 'pa-card' }), stats = h('div');
      const infoOf = p => PCB_ASM.pasteInfo(p, R.stencil);
      const tint = r => r < 0.6 ? '#7fa2e6' : r > 1.4 ? '#e8908c' : '#c3c9cf';
      const pz = boardCanvas(box, () => ({
        parts: false, onlySmd: true,
        padFill: p => ((p.layers && p.layers[0]) === (R.side === 'bot' ? 'B.Cu' : 'F.Cu') || p.drill > 0) ? (R.printed && p.x / R.wb.w <= R.pp ? tint(infoOf(p).ratio) : undefined) : false,
        overlay: (g, T) => {
          const ps = sidePads(), k = Math.sqrt(R.stencil.f);
          if (!R.printed) {
            g.save(); g.beginPath(); const x0 = T.X(0), x1 = T.X(R.wb.w);
            g.rect(Math.min(x0, x1) - 8, T.Y(0) - 8, Math.abs(x1 - x0) + 16, T.L(R.wb.h) + 16);
            ps.forEach(p => g.rect(T.X(p.x) - T.L(p.w * k) / 2, T.Y(p.y) - T.L(p.h * k) / 2, T.L(p.w * k), T.L(p.h * k)));
            g.fillStyle = 'rgba(140,152,164,.88)'; g.fill('evenodd'); g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 1; g.stroke();
            g.fillStyle = 'rgba(0,0,0,.55)'; g.font = '600 12px system-ui'; g.textAlign = 'left'; g.fillText('Schablone ' + Math.round(R.stencil.t * 1000) + ' µm, Öffnungen ' + Math.round(R.stencil.f * 100) + ' %', Math.min(x0, x1) + 6, T.Y(0) + 16); g.restore();
          } else {
            ps.forEach(p => { if (p.x / R.wb.w > R.pp) return; const r = infoOf(p).ratio; if (r < 0.6 || r > 1.4) { g.strokeStyle = r < 0.6 ? '#7fa2e6' : '#ff6a63'; g.lineWidth = 2; g.strokeRect(T.X(p.x) - T.L(p.w * k) / 2 - 3, T.Y(p.y) - T.L(p.h * k) / 2 - 3, T.L(p.w * k) + 6, T.L(p.h * k) + 6); } });
            if (R.pp < 1) { const sx = T.X(R.pp * R.wb.w); g.fillStyle = '#9aa7b3'; g.fillRect(sx - 3, T.Y(0) - 6, 6, T.L(R.wb.h) + 12); }
          }
        }
      }));
      left.appendChild(zoomBar(pz));
      const upd = () => {
        const ps = sidePads(), is = ps.map(infoOf); stats.innerHTML = '';
        if (!ps.length) { stats.appendChild(h('div', { class: 'pa-mute', text: 'Keine SMD-Pads auf dieser Seite.' })); return; }
        const ratios = is.map(i => i.ratio), mn = Math.min.apply(null, is.map(i => i.ar)), lowAR = is.filter(i => i.ar < 0.66).length, lo = ratios.filter(r => r < 0.6).length, hi = ratios.filter(r => r > 1.4).length, avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
        stats.appendChild(h('div', { html: 'Pastenmenge im Mittel <b>' + Math.round(avg * 100) + ' %</b> des Sollwerts (' + ps.length + ' Pads).' }));
        stats.appendChild(h('div', { class: 'pa-warn ' + (hi ? 'bad' : lo ? 'warn' : 'good'), style: 'margin-top:6px', text: hi ? hi + ' Pads mit zu viel Paste (über 140 %): Brücken, Zinnperlen.' : lo ? lo + ' Pads mit zu wenig Paste (unter 60 %): zu wenig Lot.' : 'Pastenmenge für alle Pads im grünen Bereich.' }));
        stats.appendChild(h('div', { class: 'pa-warn ' + (lowAR ? 'warn' : 'good'), text: 'Kleinstes Flächenverhältnis (Area Ratio) ' + f1(mn, 2) + (lowAR ? ': ' + lowAR + ' Pads unter 0,66, die Paste löst sich schlecht aus der Öffnung.' : ': gut, die Paste löst sich sauber aus der Schablone.') }));
      };
      info.appendChild(h('h3', { text: 'Schritt 1: Lotpastendruck' }));
      info.appendChild(h('div', { class: 'pa-mute', style: 'margin-bottom:8px', text: 'Die Schablone (Stencil) hat für jedes SMD-Pad eine Öffnung. Die Rakel drückt Lotpaste hindurch. Dicke und Öffnungsgröße bestimmen die Pastenmenge je Pad.' }));
      const s1 = mkSlider('Schablonendicke', 80, 200, 10, Math.round(R.stencil.t * 1000), v => v + ' µm', v => { R.stencil.t = v / 1000; changed(); });
      const s2 = mkSlider('Öffnungsfaktor (Fläche der Öffnung zum Pad)', 50, 120, 5, Math.round(R.stencil.f * 100), v => v + ' %', v => { R.stencil.f = v / 100; changed(); });
      const changed = () => { R.printed = false; R.pp = 0; R.placed = false; R.result = null; persist(); upd(); cvo && cvo.redraw(); go.disabled = true; pr.textContent = 'Paste drucken'; };
      info.appendChild(s1.el); info.appendChild(s2.el); info.appendChild(stats);
      info.appendChild(h('div', { class: 'pa-mute', style: 'margin-top:6px', text: 'Richtwert: 120 µm Dicke und 90 % Öffnung. Feine Pads brauchen dünnere Schablonen, große Pads vertragen mehr.' }));
      const pr = h('button', { class: 'pa-b pri', text: R.printed ? 'Nochmal drucken' : 'Paste drucken', onclick: () => {
        R.printed = true; R.pp = 0; R.placed = false; R.result = null; go.disabled = true;
        anim(900, u => { R.pp = u; cvo && cvo.redraw(); }, () => { go.disabled = false; pr.textContent = 'Nochmal drucken'; fx('click', undefined, undefined, 'Gedruckt'); });
      } });
      const go = h('button', { class: 'pa-b', text: 'Weiter: Bestücken', disabled: !R.printed, onclick: () => { R.step = 2; render(); } });
      if (R.printed) R.pp = 1;
      info.appendChild(h('div', { class: 'pa-row', style: 'margin-top:8px' }, [pr, go]));
      right.appendChild(info); upd();
    }

    /* ----- Schritt 2: Bestücken ----- */
    function stepPlace() {
      const split = h('div', { class: 'pa-split' }), left = h('div'), right = h('div'); split.appendChild(left); split.appendChild(right); body.appendChild(split);
      const box = h('div', { class: 'pa-cv' }); left.appendChild(box);
      const lift = () => { const o = {}; if (!R.placed || R.drop < 1) (R.wb.parts || []).forEach(p => { o[p.ref] = (R.placed ? 1 - R.drop : 1.6) * 0.8; }); return o; };
      const pz = boardCanvas(box, () => ({ offsets: R.offsets, offScale: 4, lift: lift(), polarity: false,
        padFill: p => (R.printed ? '#b9bfc5' : undefined) }));
      left.appendChild(zoomBar(pz));
      const info = h('div', { class: 'pa-card' });
      const mx = Math.max.apply(null, (R.wb.parts || []).map(p => { const o = R.offsets[p.ref] || { dx: 0, dy: 0 }; return Math.hypot(o.dx, o.dy); }).concat([0]));
      info.appendChild(h('h3', { text: 'Schritt 2: Bestücken' }));
      info.appendChild(h('div', { class: 'pa-mute', text: 'Der Automat setzt die Bauteile in die Paste. Sie liegen nie ganz genau: hier bis zu ' + f1(mx, 2) + ' mm daneben (im Bild vierfach übertrieben). Solange die Paste flüssig wird, ziehen kleine Bauteile sich durch die Oberflächenspannung selbst zurecht (Self-Alignment). Ungleichmäßiges Aufschmelzen kann sie aber auch aufrichten.' }));
      const pl = h('button', { class: 'pa-b pri', text: R.placed ? 'Nochmal bestücken' : 'Bestücken', onclick: () => {
        R.placed = true; R.drop = 0; R.result = null; go.disabled = true;
        anim(1000, u => { R.drop = u; cvo && cvo.redraw(); }, () => { go.disabled = false; pl.textContent = 'Nochmal bestücken'; fx('click', undefined, undefined, 'Bestückt'); });
      } });
      const go = h('button', { class: 'pa-b', text: 'Weiter: Reflow-Profil', disabled: !R.placed, onclick: () => { R.step = 3; render(); } });
      if (R.placed) R.drop = 1;
      info.appendChild(h('div', { class: 'pa-row', style: 'margin-top:8px' }, [pl, go]));
      info.appendChild(h('div', { class: 'pa-mute', text: 'Reihenfolge der Bestückung: im Tab "Bestückung" unter Reihenfolge üben.' }));
      right.appendChild(info);
    }

    /* ----- Schritt 3: Reflow-Profil ----- */
    function stepProfile() {
      const split = h('div', { class: 'pa-split' }), left = h('div'), right = h('div'); split.appendChild(left); split.appendChild(right); body.appendChild(split);
      const ovBox = h('div', { class: 'pa-cv', style: 'height:118px;min-height:118px;margin-bottom:8px' }), chBox = h('div', { class: 'pa-cv chart' });
      left.appendChild(ovBox); left.appendChild(chBox);
      left.appendChild(h('div', { class: 'pa-mute', text: 'Ziehe die Punkte im Diagramm oder nutze die Regler. Grün hinterlegt ist der Peak-Bereich 235 bis 250 °C, rot gestrichelt der Liquidus des bleifreien Lots (217 °C).' }));
      const info = h('div', { class: 'pa-card' }); right.appendChild(info);
      const sliders = {}, warnBox = h('div');
      const geo = {};
      const warnPaint = () => {
        const c = PCB_ASM.profileCheck(R.profile); warnBox.innerHTML = '';
        if (c.ok) warnBox.appendChild(h('div', { class: 'pa-warn good', text: 'Profil im Prozessfenster. Gesamtdauer ' + Math.round(c.curve.total) + ' s, ' + Math.round(c.metrics.tal) + ' s über Liquidus.' }));
        c.warnings.forEach(w => warnBox.appendChild(h('div', { class: 'pa-warn ' + w.level, text: w.text })));
        return c;
      };
      const sync = () => { const p = R.profile; sliders.ramp.set(p.ramp); sliders.soakTime.set(p.soakTime); sliders.soakEnd.set(p.soakEnd); sliders.peak.set(p.peak); sliders.tal.set(p.tal); sliders.cool.set(p.cool); };
      const upd = () => { R.result = null; persist(); warnPaint(); chartO && chartO.redraw(); };
      info.appendChild(h('h3', { text: 'Schritt 3: Reflow-Profil' }));
      const pre = h('div', { class: 'pa-row' }, Object.keys(PCB_ASM.PROFILES).map(k => h('button', { class: 'pa-chip', text: PCB_ASM.PROFILES[k].n, onclick: () => { Object.assign(R.profile, PCB_ASM.PROFILES[k].p); sync(); upd(); } })));
      info.appendChild(pre);
      const mk = (key, label, min, max, step, fmtv) => { sliders[key] = mkSlider(label, min, max, step, R.profile[key], fmtv, v => { R.profile[key] = v; upd(); }); info.appendChild(sliders[key].el); };
      mk('ramp', 'Aufheizrate bis 150 °C', 0.5, 5, 0.1, v => f1(v) + ' °C/s');
      mk('soakTime', 'Soak-Dauer (150 °C bis Soak-Ende)', 20, 180, 5, v => v + ' s');
      mk('soakEnd', 'Soak-Ende', 150, 200, 5, v => v + ' °C');
      mk('peak', 'Spitzentemperatur (Peak)', 215, 270, 1, v => v + ' °C');
      mk('tal', 'Zeit über Liquidus (217 °C)', 10, 130, 5, v => v + ' s');
      mk('cool', 'Abkühlrate', 0.5, 8, 0.1, v => f1(v) + ' °C/s');
      info.appendChild(warnBox);
      const start = h('button', { class: 'pa-b pri', text: 'Ofen starten', onclick: () => runOven() }), skip = h('button', { class: 'pa-b', text: 'Überspringen', style: 'display:none', onclick: () => finishOven() });
      info.appendChild(h('div', { class: 'pa-row', style: 'margin-top:8px' }, [start, skip]));
      const lock = d => Object.keys(sliders).forEach(k => sliders[k].disable(d));
      // Diagramm
      const clr = w => w.some(x => x.level === 'bad') ? '#ff6a63' : w.length ? '#ffb340' : '#4cd964';
      chartO = mkCv(chBox, (g, w, hh) => {
        const Lm = 46, Rm = 12, Tp = 16, Bm = 34, pw = w - Lm - Rm, ph = hh - Tp - Bm, cur = PCB_ASM.profileCurve(R.profile), m = cur.metrics;
        const xmax = geo.freeze || Math.max(330, Math.ceil((cur.total + 20) / 30) * 30); geo.xmax = xmax; geo.Lm = Lm; geo.Tp = Tp; geo.pw = pw; geo.ph = ph;
        const X = t => Lm + t / xmax * pw, Y = T => Tp + ph - T / 280 * ph; geo.X = X; geo.Y = Y;
        g.fillStyle = '#0f1418'; g.fillRect(0, 0, w, hh);
        const band = (t0, t1, col, txt) => { g.fillStyle = col; g.fillRect(X(t0), Tp, X(t1) - X(t0), ph); g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '11px system-ui'; g.textAlign = 'center'; g.fillText(txt, (X(t0) + X(t1)) / 2, Tp + 12); };
        const pts = cur.pts;
        band(0, pts[1].t, 'rgba(80,140,255,.10)', 'Vorwärmen'); band(pts[1].t, pts[2].t, 'rgba(255,200,60,.09)', 'Soak'); band(pts[3].t, pts[5].t + (m.peak - 217) / Math.max(.05, m.cool), 'rgba(255,90,60,.12)', 'Reflow'); band(pts[6].t - (m.peak - 100) / Math.max(.05, m.cool) + 0, pts[6].t, 'rgba(120,200,255,.06)', 'Kühlen');
        g.fillStyle = 'rgba(76,217,100,.16)'; g.fillRect(Lm, Y(250), pw, Y(235) - Y(250));
        g.strokeStyle = '#38424d'; g.lineWidth = 1; g.fillStyle = '#8d99a6'; g.font = '11px system-ui'; g.textAlign = 'right';
        for (let T = 0; T <= 250; T += 50) { g.beginPath(); g.moveTo(Lm, Y(T)); g.lineTo(Lm + pw, Y(T)); g.stroke(); g.fillText(T + '', Lm - 5, Y(T) + 4); }
        g.textAlign = 'center'; for (let t = 0; t <= xmax; t += 60) { g.fillText(t + '', X(t), Tp + ph + 15); } g.fillText('Zeit in s', Lm + pw / 2, hh - 5);
        g.save(); g.translate(12, Tp + ph / 2); g.rotate(-Math.PI / 2); g.fillText('°C', 0, 0); g.restore();
        g.setLineDash([6, 4]); g.strokeStyle = '#ff6a63'; g.beginPath(); g.moveTo(Lm, Y(217)); g.lineTo(Lm + pw, Y(217)); g.stroke(); g.strokeStyle = '#6b7885'; g.beginPath(); g.moveTo(Lm, Y(150)); g.lineTo(Lm + pw, Y(150)); g.stroke(); g.setLineDash([]);
        g.fillStyle = '#ff9a94'; g.textAlign = 'left'; g.fillText('Liquidus 217 °C', Lm + pw - 92, Y(217) - 4);
        const chk = PCB_ASM.profileCheck(R.profile); g.strokeStyle = clr(chk.warnings); g.lineWidth = 3; g.lineJoin = 'round'; g.beginPath(); pts.forEach((q, i) => i ? g.lineTo(X(q.t), Y(q.T)) : g.moveTo(X(q.t), Y(q.T))); g.stroke();
        geo.h = [['preheat', 1], ['soak', 2], ['peak', 4], ['peakEnd', 5], ['end', 6]].map(a => ({ id: a[0], x: X(pts[a[1]].t), y: Y(pts[a[1]].T) }));
        if (!R.oven.run) geo.h.forEach(q => { g.fillStyle = geo.drag === q.id ? '#fff' : '#3b9eff'; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(q.x, q.y, 9, 0, 7); g.fill(); g.stroke(); });
        if (R.oven.run || R.oven.p > 0) { const t = R.oven.p * cur.total, T = PCB_ASM.tempAt(cur, t); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(X(t), Tp); g.lineTo(X(t), Tp + ph); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.arc(X(t), Y(T), 6, 0, 7); g.fill(); }
        if (geo.drag) { g.fillStyle = 'rgba(0,0,0,.7)'; g.fillRect(Lm + 6, Tp + 20, 190, 20); g.fillStyle = '#fff'; g.textAlign = 'left'; g.fillText(dragLabel(), Lm + 12, Tp + 34); }
      });
      const dragLabel = () => { const p = R.profile; return ({ preheat: 'Aufheizrate ' + f1(p.ramp) + ' °C/s', soak: 'Soak ' + p.soakTime + ' s bis ' + p.soakEnd + ' °C', peak: 'Peak ' + p.peak + ' °C', peakEnd: 'Zeit über Liquidus ' + p.tal + ' s', end: 'Abkühlrate ' + f1(p.cool) + ' °C/s' })[geo.drag] || ''; };
      const cv = chartO.cv;
      const toT = e => { const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; return { x, y, t: (x - geo.Lm) / geo.pw * geo.xmax, T: 25 + 0 + (geo.Tp + geo.ph - y) / geo.ph * 280 - 25 }; };
      cv.addEventListener('pointerdown', e => {
        if (R.oven.run || !geo.h) return; const q = toT(e); let best = null, bd = 28;
        geo.h.forEach(hd => { const d = Math.hypot(hd.x - q.x, hd.y - q.y); if (d < bd) { bd = d; best = hd; } });
        if (best) { geo.drag = best.id; geo.freeze = geo.xmax; try { cv.setPointerCapture(e.pointerId); } catch (x) { /* ok */ } e.preventDefault(); chartO.redraw(); }
      });
      cv.addEventListener('pointermove', e => {
        if (!geo.drag) return; const q = toT(e), p = R.profile, cur = PCB_ASM.profileCurve(p), pts = cur.pts, cl = (v, a, b) => Math.max(a, Math.min(b, v)), id = geo.drag;
        if (id === 'preheat') p.ramp = Math.round(cl(125 / Math.max(5, q.t), 0.5, 5) * 10) / 10;
        else if (id === 'soak') { p.soakTime = Math.round(cl(q.t - pts[1].t, 20, 180) / 5) * 5; p.soakEnd = Math.round(cl(q.T, 150, 200) / 5) * 5; }
        else if (id === 'peak') p.peak = Math.round(cl(q.T, 215, 270));
        else if (id === 'peakEnd') { const tr = (p.peak - 217) / p.ramp, tf = (p.peak - 217) / p.cool; p.tal = Math.round(cl(tr + Math.max(0, q.t - pts[4].t) + tf, 10, 130) / 5) * 5; }
        else if (id === 'end') p.cool = Math.round(cl((p.peak - 100) / Math.max(5, q.t - pts[5].t), 0.5, 8) * 10) / 10;
        sync(); upd();
      });
      const endDrag = () => { if (geo.drag) { geo.drag = null; geo.freeze = null; chartO.redraw(); } };
      cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
      // Ofen
      ovo = mkCv(ovBox, (g, w, hh) => {
        const cur = PCB_ASM.profileCurve(R.profile), p = R.oven.p, T = PCB_ASM.tempAt(cur, p * cur.total), a = Math.min(1, Math.max(0, (T - 25) / 230));
        g.fillStyle = '#0f1418'; g.fillRect(0, 0, w, hh);
        const x0 = 14, x1 = w - 14, y0 = 14, y1 = hh - 22; g.fillStyle = '#2a3038'; g.beginPath(); g.roundRect ? g.roundRect(x0, y0, x1 - x0, y1 - y0, 14) : g.rect(x0, y0, x1 - x0, y1 - y0); g.fill();
        const zn = 5, zw = (x1 - x0 - 20) / zn;
        for (let i = 0; i < zn; i++) { const here = Math.abs((i + 0.5) / zn - p), k = Math.max(0, 1 - here * 2.2) * 0.65 + 0.15 * (i / zn < p ? 1 : 0); g.fillStyle = 'rgba(255,' + Math.round(150 - 90 * a) + ',30,' + (0.12 + 0.6 * a * Math.min(1, k + 0.2)).toFixed(2) + ')'; g.fillRect(x0 + 10 + i * zw + 3, y0 + 8, zw - 6, 16); }
        g.fillStyle = '#5a636d'; g.fillRect(x0 + 4, y1 - 24, x1 - x0 - 8, 5);          // Förderband
        const bw = 56, bx = x0 + 10 + p * (x1 - x0 - 20 - bw); g.fillStyle = '#1d6a3a'; g.fillRect(bx, y1 - 34, bw, 10);
        const hot = T > 217; g.fillStyle = hot ? '#e8edf1' : '#b9bfc5'; for (let i = 0; i < 6; i++) g.fillRect(bx + 6 + i * 8, y1 - 37, 4, 3);
        g.fillStyle = '#fff'; g.font = '700 18px system-ui'; g.textAlign = 'left'; g.fillText(Math.round(T) + ' °C', x0 + 14, y1 - 44 > y0 + 44 ? y1 - 46 : y0 + 46);
        g.font = '12px system-ui'; g.fillStyle = '#8d99a6'; g.textAlign = 'right'; g.fillText(R.oven.run ? 'Ofen läuft' : p >= 1 ? 'Fertig' : 'Reflow-Ofen, bereit', x1 - 6, hh - 6);
      });
      function runOven() {
        if (R.oven.run) return; R.oven = { run: true, p: 0 }; lock(true); start.disabled = true; skip.style.display = ''; chartO.redraw();
        anim(6500, u => { R.oven.p = u; ovo && ovo.redraw(); chartO && chartO.redraw(); }, () => { if (R.step === 3 && R.oven.run) finishOven(); });
      }
      function finishOven() {
        animTok++; cancelAnimationFrame(raf); R.oven = { run: false, p: 1 };
        R.result = PCB_ASM.reflow(R.wb, R.profile, { stencil: R.stencil, seed: R.seed, offsets: R.offsets }); R.attempts++;
        const pc = R.result.joints.length ? Math.round(R.result.counts.gut / R.result.joints.length * 100) : 0; if (pc > R.best) R.best = pc; persist();
        if (pc >= 90) { try { ctx && ctx.stat && ctx.stat('pcbsolder', 1); } catch (e) { /* ok */ } } const bb = ovBox.getBoundingClientRect(); fx('ding', bb.left + bb.width / 2, bb.top + 30, 'Ofen fertig!'); R.fxDone = false;
        R.step = 4; render();
      }
      warnPaint();
    }

    /* ----- Schritt 4: Ergebnis ----- */
    function stepResult() {
      const res = R.result; if (!res) { R.step = 3; return render(); }
      const split = h('div', { class: 'pa-split' }), left = h('div'), right = h('div'); split.appendChild(left); split.appendChild(right); body.appendChild(split);
      const box = h('div', { class: 'pa-cv' }); left.appendChild(box);
      const key = j => j.ref + '.' + j.pad, byKey = {}; res.joints.forEach(j => { byKey[key(j)] = j; });
      const sideJ = j => j.side === R.side;
      const padKey = p => p.ref + '.' + p.n;
      const lift = {}; res.joints.forEach(j => { if (j.result === 'tombstone') lift[j.ref] = 0.9; });
      const pz = boardCanvas(box, () => ({
        offsets: null, lift, onlySmd: true,
        padFill: p => { const j = byKey[padKey(p)]; if (!j) return undefined; if (R.filter && j.result !== R.filter && !(R.sel && padKey(p) === R.sel)) return '#6e6258'; return j.result === 'gut' ? '#dfe5ea' : j.result === 'kalt' || j.result === 'benetzung' ? '#7d8388' : j.result === 'ueberhitzt' ? '#6a4a2c' : '#d0d6db'; },
        padStroke: p => { const j = byKey[padKey(p)]; if (!j) return null; if (R.sel === padKey(p)) return '#ffd54f'; return j.result === 'gut' ? null : PCB_ASM.RESULTS[j.result].col; },
        overlay: (g, T) => {
          (res.bridges || []).forEach(br => { const a = R.S.pads.find(p => padKey(p) === br[0]), b2 = R.S.pads.find(p => padKey(p) === br[1]); if (!a || !b2 || (a.layers[0] === 'B.Cu' ? 'bot' : 'top') !== R.side) return; g.strokeStyle = '#ff5c5c'; g.lineWidth = Math.max(3, T.L(0.35)); g.lineCap = 'round'; g.beginPath(); g.moveTo(T.X(a.x), T.Y(a.y)); g.lineTo(T.X(b2.x), T.Y(b2.y)); g.stroke(); });
          g.font = '700 ' + Math.max(10, Math.min(15, T.L(1.1))) + 'px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
          res.joints.forEach(j => { if (j.result === 'gut' || !sideJ(j)) return; const x = T.X(j.x), y = T.Y(j.y) - Math.max(10, T.L(1.2)); g.fillStyle = PCB_ASM.RESULTS[j.result].col; g.beginPath(); g.arc(x, y, Math.max(6, Math.min(10, T.L(0.8))), 0, 7); g.fill(); g.fillStyle = '#111'; g.fillText('!', x, y + 1); });
        }
      }), (px, py) => {
        const T = mkT(R.wb, R.view, R.side === 'bot'), q = T.inv(px, py); let best = null, bd = 1e9;
        res.joints.forEach(j => { if (!sideJ(j)) return; const dx = Math.max(0, Math.abs(q[0] - j.x) - j.w / 2), dy = Math.max(0, Math.abs(q[1] - j.y) - j.h / 2), d = Math.hypot(dx, dy); if (d < 0.8 && d < bd) { bd = d; best = j; } });
        if (best) selectJ(best, true);
      });
      left.appendChild(zoomBar(pz));
      const info = h('div', { class: 'pa-card' }), sum = h('div'), micro = h('div');
      const total = res.joints.length, good = res.counts.gut, pct = total ? Math.round(good / total * 100) : 0;
      info.appendChild(h('h3', { text: 'Schritt 4: Ergebnis je Lötstelle' }));
      info.appendChild(h('div', { html: '<big>' + good + ' von ' + total + '</big> Lötstellen gut (' + pct + ' %)' }));
      info.appendChild(h('div', { class: 'pa-mute', text: 'Versuch ' + R.attempts + ', Bestwert ' + R.best + ' %.' + (res.metrics.tht ? ' ' + res.metrics.tht + ' THT-Pad(s) werden nicht im Ofen gelötet.' : '') }));
      const chips = h('div', { class: 'pa-row', style: 'margin-top:8px' });
      PCB_ASM.RESULT_ORDER.forEach(k => { const n = res.counts[k]; if (!n) return; chips.appendChild(h('button', { class: 'pa-chip' + (R.filter === k ? ' on' : ''), onclick: () => { R.filter = R.filter === k ? null : k; paintList(); cvo && cvo.redraw(); } }, [h('span', { class: 'pa-dot', style: 'background:' + PCB_ASM.RESULTS[k].col }), PCB_ASM.RESULTS[k].t + ' ' + n])); });
      info.appendChild(chips); info.appendChild(sum);
      const tips = []; const c = res.counts;
      if (c.tombstone) tips.push('Grabstein: Aufheizrate senken und Soak verlängern. Im Layout beide Pads gleich groß machen und an Kupferflächen mit Thermals anbinden.');
      if (c.bruecke) tips.push('Brücken: dünnere Schablone oder kleinerer Öffnungsfaktor, besonders bei engem Raster.');
      if (c.zinnperlen) tips.push('Zinnperlen: Rampe unter 3 °C/s, Soak mindestens 60 s, weniger Paste.');
      if (c.kalt) tips.push('Kalte Lötstellen: Peak 235 bis 250 °C, 30 bis 90 s über Liquidus, nicht zu langsam abkühlen.');
      if (c.ueberhitzt) tips.push('Überhitzt: Peak und Zeit über Liquidus senken.');
      if (c.benetzung) tips.push('Benetzungsfehler: Soak kürzer und nicht über 190 °C.');
      if (c.zuwenig) tips.push('Zu wenig Lot: dickere Schablone oder größere Öffnungen.');
      (res.warnings || []).slice(0, 2).forEach(w => { if (tips.length < 4) tips.push(w.text); });
      const tipEl = h('div', { style: 'margin-top:8px' }, tips.length ? tips.map(t => h('div', { class: 'pa-warn warn', text: t })) : [h('div', { class: 'pa-warn good', text: 'Alle Lötstellen gut: sauberes Profil, passende Schablone. So sieht ein stabiler Prozess aus.' })]);
      info.appendChild(tipEl);
      info.appendChild(h('div', { class: 'pa-row', style: 'margin-top:8px' }, [
        h('button', { class: 'pa-b pri', text: 'Nochmal mit Verbesserung', onclick: () => { const a = R.attempts, best = R.best; resetRun(); R.attempts = a; R.best = best; render(); } }),
        h('button', { class: 'pa-b', text: 'Neu starten', onclick: () => { resetRun(true); persist(); render(); } })]));
      right.appendChild(info);
      const mcard = h('div', { class: 'pa-card' }); mcard.appendChild(h('h3', { text: 'Mikroskop' })); mcard.appendChild(micro); right.appendChild(mcard);
      function paintList() {
        sum.innerHTML = '';
        const bad = res.joints.filter(j => j.result !== 'gut' && (!R.filter || j.result === R.filter));
        if (!bad.length) return;
        const lst = h('div', { style: 'max-height:150px;overflow:auto;margin-top:8px' });
        bad.slice(0, 60).forEach(j => lst.appendChild(h('button', { class: 'pa-chip' + (R.sel === key(j) ? ' on' : ''), style: 'margin:0 6px 6px 0', onclick: () => selectJ(j, true) }, [h('span', { class: 'pa-dot', style: 'background:' + PCB_ASM.RESULTS[j.result].col }), j.ref + '.' + j.pad])));
        sum.appendChild(lst);
      }
      function selectJ(j, zoom) {
        R.sel = key(j); if (j.side !== R.side) { R.side = j.side; return render(); }
        paintList(); paintMicro(j); cvo && cvo.redraw();
        if (zoom && cvo) { const s = Math.min(cvo.w, cvo.h) / 6, T = mkT(R.wb, R.view, R.side === 'bot'); const wx = R.side === 'bot' ? R.wb.w - j.x : j.x; tween(R.view, { s, ox: cvo.w / 2 - wx * s, oy: cvo.h / 2 - j.y * s }, 420, () => cvo && cvo.redraw()); }
      }
      function paintMicro(j) {
        microO && microO.destroy(); micro.innerHTML = ''; const R2 = PCB_ASM.RESULTS[j.result];
        const mb = h('div', { class: 'pa-cv sm' }); micro.appendChild(mb);
        let gap = 0.7, bestd = 9; R.S.pads.forEach(p => { if (p.ref === j.ref && p.n === j.pad) return; if ((p.layers && p.layers[0] === 'B.Cu' ? 'bot' : 'top') !== j.side) return; const dx = Math.max(0, Math.abs(p.x - j.x) - (p.w + j.w) / 2), dy = Math.max(0, Math.abs(p.y - j.y) - (p.h + j.h) / 2), d = Math.hypot(dx, dy); if (d < bestd) { bestd = d; } });
        if (bestd < 9) gap = Math.max(0.15, bestd);
        microO = mkCv(mb, (g, w, hh) => microPic(g, w, hh, j.result, PCB_ASM.hash(3, key(j)) * 100000 | 0, { smd: true, pw: j.w, ph: j.h, gap }));
        micro.appendChild(h('div', { style: 'font-weight:700;color:' + R2.col + ';margin-top:2px', text: j.ref + '.' + j.pad + ': ' + R2.t }));
        micro.appendChild(h('div', { style: 'margin:4px 0', text: j.reason }));
        if (R2.fix) micro.appendChild(h('div', { class: 'pa-mute', text: 'So behebst du es: ' + R2.fix }));
        else micro.appendChild(h('div', { class: 'pa-mute', text: R2.x }));
      }
      const firstBad = res.joints.find(j => j.result !== 'gut');
      if (firstBad) paintMicro(firstBad); else { micro.appendChild(h('div', { class: 'pa-mute', text: 'Alles gut. Tippe eine Lötstelle an, um sie unter dem Mikroskop zu sehen.' })); }
      paintList();
      if (!R.fxDone) {
        R.fxDone = true; const bb = box.getBoundingClientRect(), cx = bb.left + bb.width / 2, cy = bb.top + bb.height / 3;
        if (c.tombstone) setTimeout(() => fx('squeak', cx, cy, 'Grabstein! Das Bauteil macht Männchen.'), 700);
        if (c.bruecke) setTimeout(() => fx('zap', cx, cy + 30, 'Brücke! Zwei Pads, eine Idee.'), c.tombstone ? 1900 : 700);
      }
    }

    /* ----- Handlöten ----- */
    const EX = [
      { id: 'tht', kind: 'tht', n: 2, title: 'Widerstand THT', text: 'Zwei Anschlussdrähte eines Widerstands löten. Ablauf je Lötstelle: Kolben ans Pad, kurz warten, Lot zuführen, Lot weg, Kolben weg.' },
      { id: 'dip', kind: 'dip', n: 4, title: 'DIP-IC', text: 'Vier Pins eines DIP-ICs löten. Der IC hält mehr Wärme ab als ein Widerstand: etwas länger erwärmen, aber nicht zu viel Lot.' },
      { id: 'soic', kind: 'soic', n: 8, title: 'SOIC schleppen', text: 'Acht SOIC-Pins in einem Zug schleppen: Messerspitze mit einem Lottropfen langsam über die Pins ziehen. Zu schnell: kaltes Lot, zu langsam oder zu viel Lot: Brücken.' },
      { id: 'smd0603', kind: 'smd0603', n: 2, title: '0603 mit Pinzette', text: 'Ein 0603-Widerstand wird mit der Pinzette gehalten. Erst ein Pad löten, dann das andere. Die Pinzette erst loslassen, wenn das Lot erstarrt ist (nach dem Kolben mindestens 1 s halten).' }
    ];
    const TIPN = Object.keys(PCB_ASM.TIPS);
    function miniJoint(g, x, y, rw, rh, kind, round) {
      const col = { gut: '#e7ecf0', kalt: '#80868b', ueberhitzt: '#4d3a2c', padlift: '#4d3a2c', bruecke: '#e7ecf0', zuwenig: '#a7adb2', zuviel: '#e7ecf0', verrutscht: '#c4cacf', reihenfolge: '#80868b' }[kind] || '#ccc';
      const gr = g.createRadialGradient(x - rw * 0.25, y - rh * 0.3, 2, x, y, Math.max(rw, rh)); gr.addColorStop(0, '#fff'); gr.addColorStop(1, col);
      g.fillStyle = kind === 'gut' || kind === 'bruecke' || kind === 'zuviel' ? gr : col; g.beginPath();
      const k = kind === 'zuwenig' ? 0.5 : kind === 'zuviel' ? 1.45 : 0.95; g.ellipse(x, y, rw * k * (round ? 0.9 : 1), rh * k * (round ? 0.9 : 1), 0, 0, 7); g.fill();
      if (kind !== 'gut') { g.strokeStyle = PCB_ASM.RESULTS[kind] ? PCB_ASM.RESULTS[kind].col : '#ffb340'; g.lineWidth = 2; g.stroke(); }
    }
    function renderHand() {
      const ex = EX.find(e => e.id === H.ex) || EX[0];
      if (!H.res[ex.id]) H.res[ex.id] = [];
      const cur = H.res[ex.id], isSoic = ex.kind === 'soic', smd06 = ex.kind === 'smd0603';
      const done = cur.length >= ex.n;
      // Übungswahl
      const exRow = h('div', { class: 'pa-row' });
      EX.forEach(e => { const b = H.best[e.id]; exRow.appendChild(h('button', { class: 'pa-chip' + (e.id === ex.id ? ' on' : ''), onclick: () => { if (H.run && H.run.ironOn) return; H.ex = e.id; H.run = null; if (e.kind === 'soic') { H.tip = 'messer'; H.wire = 1.2; } else if (e.kind === 'smd0603') { H.tip = 'fein'; H.wire = 1; } else { H.tip = 'meissel'; H.wire = e.kind === 'dip' ? 3.5 : 4; } persist(); render(); } }, [e.title + (b != null ? '  ' + b + ' P.' : '')])); });
      const tot = EX.reduce((s, e) => s + (H.best[e.id] || 0), 0);
      exRow.appendChild(h('div', { class: 'pa-mute', text: 'Gesamt: ' + tot + ' von 400 Punkten' }));
      body.appendChild(exRow);
      const split = h('div', { class: 'pa-split' }), left = h('div'), right = h('div'); split.appendChild(left); split.appendChild(right); body.appendChild(split);
      const box = h('div', { class: 'pa-cv', style: 'height:min(46vh,380px)' }); left.appendChild(box);
      const stepRow = h('div', { class: 'pa-row' }), msg = h('div');
      left.appendChild(stepRow); left.appendChild(msg);
      const ctl = h('div', { class: 'pa-card' }), resCard = h('div', { class: 'pa-card' });
      right.appendChild(ctl); right.appendChild(resCard);
      ctl.appendChild(h('h3', { text: ex.title }));
      ctl.appendChild(h('div', { class: 'pa-mute', style: 'margin-bottom:8px', text: ex.text }));
      const lockable = [];
      const sT = mkSlider('Löttemperatur', 250, 400, 5, H.temp, v => v + ' °C', v => { H.temp = v; }); ctl.appendChild(sT.el); lockable.push(sT);
      ctl.appendChild(h('div', { class: 'pa-mute', text: 'Spitzenform' }));
      const tipRow = h('div', { class: 'pa-row', style: 'margin-top:4px' }); ctl.appendChild(tipRow);
      const paintTips = () => { tipRow.innerHTML = ''; TIPN.forEach(k => tipRow.appendChild(h('button', { class: 'pa-chip' + (H.tip === k ? ' on' : ''), text: PCB_ASM.TIPS[k].n, onclick: () => { if (H.run) return; H.tip = k; paintTips(); } }))); };
      paintTips();
      const need = PCB_ASM.HAND_KINDS[ex.kind].need;
      const sW = mkSlider(isSoic ? 'Lotmenge je Pin' : 'Lotmenge (Lotdraht)', 0, isSoic || smd06 ? 4 : 10, isSoic || smd06 ? 0.1 : 0.5, H.wire, v => f1(v) + ' mm', v => { H.wire = v; }); ctl.appendChild(sW.el); lockable.push(sW);
      let sD = null; if (isSoic) { sD = mkSlider('Schleppgeschwindigkeit', 1, 15, 0.5, H.drag, v => f1(v) + ' mm/s', v => { H.drag = v; }); ctl.appendChild(sD.el); lockable.push(sD); }
      ctl.appendChild(h('div', { class: 'pa-mute', text: 'Hinweis: Wie viel Lot genau reicht, musst du ausprobieren. Zu wenig und zu viel sieht man an der Lötstelle.' }));
      const setLock = d => lockable.forEach(s => s.disable(d));
      // Szene
      const sceneState = { fed: 0 };
      handO = mkCv(box, (g, w, hh) => drawScene(g, w, hh));
      function padPos(i) {
        if (ex.kind === 'tht') return { x: 170 + i * 140, y: 175, rw: 26, rh: 26, round: true };
        if (ex.kind === 'dip') return { x: 150, y: 70 + i * 52, rw: 20, rh: 20, round: true };
        if (ex.kind === 'soic') return { x: 62 + i * 52, y: 190, rw: 16, rh: 32, round: false };
        return { x: 190 + i * 100, y: 175, rw: 32, rh: 34, round: false };
      }
      const heatFor = t => PCB_ASM.heatModel({ kind: ex.kind, temp: H.temp, tip: H.tip, preheat: 0, time: 0 }).padT(t);
      function elapsed() { return H.run && H.run.tIron ? (performance.now() - H.run.tIron) / 1000 : 0; }
      function drawScene(g, w, hh) {
        const sc = Math.min(w / 480, hh / 290); g.save(); g.translate((w - 480 * sc) / 2, (hh - 290 * sc) / 2); g.scale(sc, sc);
        g.fillStyle = '#1d4a2c'; g.fillRect(0, 0, 480, 290);
        const n = ex.kind === 'tht' ? 2 : ex.kind === 'dip' ? 4 : ex.kind === 'soic' ? 8 : 2;
        // Bauteil
        if (ex.kind === 'tht') { g.fillStyle = '#c4a46a'; g.beginPath(); g.roundRect ? g.roundRect(190, 150, 100, 50, 14) : g.rect(190, 150, 100, 50); g.fill(); [210, 228, 246].forEach((x, i) => { g.fillStyle = ['#8b4513', '#111', '#c00'][i]; g.fillRect(x, 150, 8, 50); }); }
        if (ex.kind === 'dip') { g.fillStyle = '#16191d'; g.fillRect(190, 40, 230, 220); g.fillStyle = '#2a2f35'; g.beginPath(); g.arc(305, 40, 14, 0, Math.PI); g.fill(); }
        if (ex.kind === 'soic') { g.fillStyle = '#16191d'; g.fillRect(50, 60, 396, 90); g.fillStyle = '#2f353c'; g.beginPath(); g.arc(70, 78, 6, 0, 7); g.fill(); }
        if (ex.kind === 'smd0603') { g.fillStyle = '#3a2f26'; g.fillRect(212, 160, 56, 30); g.fillStyle = '#c9cdd2'; g.fillRect(206, 160, 12, 30); g.fillRect(262, 160, 12, 30); }
        // Pads
        const dragP = H.drawing, activeI = Math.min(cur.length, n - 1);
        for (let i = 0; i < n; i++) {
          const p = padPos(i), r = cur[i]; g.fillStyle = r && r.joint === 'padlift' ? '#7a4d22' : '#cf9f4e';
          if (p.round) { g.beginPath(); g.arc(p.x, p.y, p.rw, 0, 7); g.fill(); g.fillStyle = '#0a0c0e'; g.beginPath(); g.arc(p.x, p.y, 5, 0, 7); g.fill(); } else g.fillRect(p.x - p.rw, p.y - p.rh, p.rw * 2, p.rh * 2);
          if (ex.kind === 'dip') { g.fillStyle = '#c9cdd2'; g.fillRect(p.x + 10, p.y - 4, 44, 8); }
          if (ex.kind === 'soic') { g.fillStyle = '#c9cdd2'; g.fillRect(p.x - 6, 138, 12, 30); }
          if (ex.kind === 'tht') { g.fillStyle = '#c9cdd2'; g.fillRect(p.x - 3, p.y - 3, i ? -(p.x - 270) * 0 + 0 : 0, 0); }
          if (r) miniJoint(g, p.x, p.y, p.rw * 0.85, p.rh * 0.85, r.joint, p.round);
          else if (isSoic && dragP && (i + 0.5) / n < dragP) miniJoint(g, p.x, p.y, p.rw * 0.85, p.rh * 0.85, 'gut', false);
          else if (i === activeI && !isSoic && !done) { g.strokeStyle = '#ffd54f'; g.lineWidth = 2.5; g.setLineDash([5, 4]); g.beginPath(); if (p.round) g.arc(p.x, p.y, p.rw + 7, 0, 7); else g.rect(p.x - p.rw - 7, p.y - p.rh - 7, p.rw * 2 + 14, p.rh * 2 + 14); g.stroke(); g.setLineDash([]); }
        }
        if (ex.kind === 'tht') { g.fillStyle = '#c9cdd2'; g.fillRect(170, 172, 20, 6); g.fillRect(290, 172, 20, 6); }
        // Kolben
        const run = H.run, hot = run && run.ironOn;
        let tx, ty;
        if (isSoic && dragP > 0 && dragP < 1) { tx = 62 + dragP * 7 * 52; ty = 190; } else { const p = padPos(activeI); tx = p.x; ty = p.y; }
        if (hot || (isSoic && dragP > 0 && dragP < 1)) {
          const T = isSoic ? 260 : heatFor(elapsed()), a = Math.min(1, Math.max(0, (T - 25) / 280));
          g.save(); g.translate(tx + 6, ty - 4); g.rotate(-0.78); g.fillStyle = '#9aa3ab'; g.fillRect(34, -9, 200, 18); g.fillStyle = '#25292e'; g.fillRect(100, -11, 140, 22);
          g.fillStyle = 'rgb(' + Math.round(150 + 105 * a) + ',' + Math.round(120 - 50 * a) + ',40)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(36, -9); g.lineTo(36, 9); g.closePath(); g.fill(); g.restore();
          g.fillStyle = 'rgba(255,170,60,' + (0.25 * a) + ')'; g.beginPath(); g.arc(tx, ty, 34 * a + 10, 0, 7); g.fill();
        }
        if (run && run.fedAt && performance.now() - run.fedAt < 900 && run.order.indexOf('wireOff') < 0) { g.strokeStyle = '#d7dadd'; g.lineWidth = 4; g.beginPath(); g.moveTo(tx - 150, ty - 120); g.lineTo(tx - 6, ty - 2); g.stroke(); }
        else if (run && run.order.indexOf('solder') >= 0 && run.order.indexOf('wireOff') < 0) { g.strokeStyle = '#d7dadd'; g.lineWidth = 4; g.beginPath(); g.moveTo(tx - 150, ty - 120); g.lineTo(tx - 6, ty - 2); g.stroke(); }
        if (smd06 && !done) { g.strokeStyle = '#9aa3ab'; g.lineWidth = 5; g.beginPath(); g.moveTo(190, 70); g.lineTo(226, 158); g.moveTo(290, 70); g.lineTo(254, 158); g.stroke(); }
        // Anzeige
        const T = hot ? heatFor(elapsed()) : 25, tSafe = Math.min(8, 5 * Math.exp(-(H.temp - 350) / 55)), load2 = hot ? Math.min(1.3, elapsed() / tSafe) : 0;
        g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(12, 10, 210, 56); g.fillStyle = '#fff'; g.font = '12px system-ui'; g.textAlign = 'left'; g.fillText('Pad-Temperatur ' + Math.round(T) + ' °C', 20, 26);
        g.fillStyle = '#333'; g.fillRect(20, 31, 190, 8); g.fillStyle = T < 217 ? '#5aa0ff' : '#4cd964'; g.fillRect(20, 31, 190 * Math.min(1, T / 320), 8); g.fillStyle = '#ff6a63'; g.fillRect(20 + 190 * 217 / 320, 29, 2, 12);
        g.fillStyle = '#fff'; g.fillText('Belastung', 20, 56); g.fillStyle = '#333'; g.fillRect(80, 49, 130, 8); g.fillStyle = load2 > 1 ? '#ff6a63' : '#ffb340'; g.fillRect(80, 49, 130 * Math.min(1, load2 / 1.3), 8);
        g.restore();
      }
      // Ablauf-Knöpfe
      const run0 = () => ({ tIron: null, tWire: null, tOff: null, order: [], ironOn: false, fedAt: 0, wire: 0 });
      const btns = {};
      function press(tok) {
        if (done || isSoic) return;
        const run = H.run || (H.run = run0()); if (run.order.indexOf(tok) >= 0 || run.finished) return;
        if (run.order.indexOf('ironOff') >= 0 && tok !== 'release') return;
        const now = performance.now(); run.order.push(tok);
        if (tok === 'heat') { run.tIron = now; run.ironOn = true; setLock(true); startTick(); }
        else if (tok === 'solder') { run.tWire = now; run.fedAt = now; run.wire = H.wire; setLock(true); }
        else if (tok === 'ironOff') { run.tOff = now; run.ironOn = false; if (!smd06) finalize(); }
        else if (tok === 'release') { run.tRel = now; finalize(); }
        paintBtns(); handO && handO.redraw();
        if (tok === 'wireOff' && smd06) { /* weiter */ }
      }
      function paintBtns() {
        stepRow.innerHTML = ''; if (isSoic) return;
        const run = H.run, used = t => run && run.order.indexOf(t) >= 0;
        const defs = [['heat', '1 Kolben ans Pad'], ['solder', '2 Lot zuführen'], ['wireOff', '3 Lot wegnehmen'], ['ironOff', '4 Kolben wegnehmen']]; if (smd06) defs.push(['release', '5 Pinzette loslassen']);
        defs.forEach(d => stepRow.appendChild(h('button', { class: 'pa-b' + (used(d[0]) ? ' ok' : ''), text: d[1], disabled: done || (run && run.finished), onclick: () => press(d[0]) })));
      }
      function startTick() {
        clearInterval(tick); tick = setInterval(() => {
          if (destroyed) return; handO && handO.redraw();
          const run = H.run; if (run && run.ironOn && elapsed() > 14) { run.order.push('ironOff'); run.tOff = performance.now(); run.ironOn = false; fx('crash', undefined, undefined, 'Viel zu lange!'); if (!smd06) finalize(); paintBtns(); }
        }, 60);
      }
      function finalize() {
        clearInterval(tick); const run = H.run; if (!run || run.finished) return; run.finished = true; setLock(false);
        const sec = (a, b) => (a != null && b != null ? Math.max(0, (b - a) / 1000) : 0);
        const order = run.order.filter(t => t !== 'release');
        const params = { kind: ex.kind, temp: H.temp, tip: H.tip, time: sec(run.tIron, run.tOff || performance.now()), preheat: run.tWire != null && run.tIron != null ? Math.max(0, sec(run.tIron, run.tWire)) : 0, wireMm: run.tWire != null ? run.wire : 0, order, hold: smd06 ? sec(run.tOff, run.tRel) : 0, seed: 11 + cur.length * 17 };
        const r = PCB_ASM.handSolder(params); r.params = params; cur.push(r); showResult(r); afterJoint(r);
      }
      function afterJoint(r) {
        const bb = box.getBoundingClientRect(), x = bb.left + bb.width / 2, y = bb.top + bb.height / 3;
        if (r.joint === 'gut') { try { ctx && ctx.stat && ctx.stat('pcbsolder', 1); } catch (e) { /* ok */ } fx('ding', x, y, 'Glänzend!'); } else if (r.joint === 'padlift') fx('crash', x, y, 'Pad abgehoben!'); else if (r.joint === 'bruecke') fx('zap', x, y, 'Brücke!'); else if (r.joint === 'kalt') fx('squeak', x, y, 'Kalte Lötstelle!'); else fx('boing', x, y);
        if (cur.length >= ex.n) finishEx();
        else { msg.innerHTML = ''; msg.appendChild(h('button', { class: 'pa-b pri', text: 'Nächste Lötstelle', onclick: () => { H.run = null; render(); } })); }
        handO && handO.redraw();
      }
      function finishEx() {
        const mean = Math.round(cur.reduce((s, r) => s + r.quality, 0) / cur.length);
        const better = H.best[ex.id] == null || mean > H.best[ex.id]; if (better) H.best[ex.id] = mean; persist();
        const stars = mean >= 90 ? 3 : mean >= 70 ? 2 : mean >= 50 ? 1 : 0;
        msg.innerHTML = ''; msg.appendChild(h('div', { class: 'pa-warn ' + (stars >= 2 ? 'good' : 'warn'), html: '<b>' + mean + ' von 100 Punkten</b>  ' + '★'.repeat(stars) + '☆'.repeat(3 - stars) + (better ? '  (neue Bestleistung)' : '') }));
        msg.appendChild(h('div', { class: 'pa-row' }, [h('button', { class: 'pa-b pri', text: 'Übung wiederholen', onclick: () => { H.res[ex.id] = []; H.run = null; H.drawing = 0; render(); } }),
          h('button', { class: 'pa-b', text: 'Nächste Übung', onclick: () => { const i = EX.indexOf(ex); H.ex = EX[(i + 1) % EX.length].id; H.run = null; H.drawing = 0; if (H.ex === 'soic') { H.tip = 'messer'; H.wire = 1.2; } else if (H.ex === 'smd0603') { H.tip = 'fein'; H.wire = 1; } else { H.tip = 'meissel'; H.wire = H.ex === 'dip' ? 3.5 : 4; } persist(); render(); } })]));
        if (mean >= 90) { const bb = box.getBoundingClientRect(); fx('tada', bb.left + bb.width / 2, bb.top + 40, 'Meisterlöter!'); }
      }
      function showResult(r) {
        resCard.innerHTML = ''; if (!r) return;
        const kind = r.joint === 'reihenfolge' ? 'kalt' : r.joint;
        resCard.appendChild(h('h3', { text: 'Lötstelle ' + cur.length + ' von ' + ex.n + ': ' + r.quality + ' Punkte' }));
        const mb = h('div', { class: 'pa-cv sm' }); resCard.appendChild(mb);
        const mo = mkCv(mb, (g, w, hh) => microPic(g, w, hh, kind, 5 + cur.length * 13, { smd: ex.kind === 'soic' || ex.kind === 'smd0603', pw: ex.kind === 'soic' ? 0.6 : ex.kind === 'smd0603' ? 0.9 : 1.7, ph: ex.kind === 'soic' ? 1.5 : ex.kind === 'smd0603' ? 1.0 : 1.7, gap: ex.kind === 'soic' ? 0.67 : 0.7 }));
        const prev = handO; handO = { destroy() { prev && prev.destroy(); mo.destroy(); }, redraw() { prev && prev.redraw(); } };
        resCard.appendChild(h('div', { class: 'pa-warn ' + (r.joint === 'gut' ? 'good' : 'bad'), text: r.joint === 'gut' ? 'Gute Lötstelle: ' + r.notes.join(' ') : PCB_ASM.HAND_DEFECT_TEXT[r.joint] }));
        (r.notes || []).forEach(t => { if (r.joint !== 'gut') resCard.appendChild(h('div', { class: 'pa-mute', style: 'margin-bottom:4px', text: t })); });
        if (r.params) resCard.appendChild(h('div', { class: 'pa-mute', text: 'Messwerte: ' + Math.round(r.params.temp) + ' °C, Kontaktzeit ' + f1(r.params.time) + ' s, Vorwärmen ' + f1(r.params.preheat) + ' s, Lot ' + f1(r.params.wireMm) + ' mm' + (r.params.hold ? ', Pinzette ' + f1(r.params.hold) + ' s' : '') + '.' }));
      }
      // Schleppen (SOIC)
      if (isSoic) {
        const go = h('button', { class: 'pa-b pri', text: done ? 'Schon geschleppt' : 'Schleppen starten', disabled: done, onclick: () => {
          if (H.drawing) return; setLock(true); go.disabled = true; H.drawing = 0.001;
          anim(Math.min(7000, Math.max(1200, 8 * 1.27 / H.drag * 1000)), u => { H.drawing = Math.max(0.001, u); handO && handO.redraw(); }, endDrag);
        } });
        stepRow.appendChild(go);
        const endDrag = () => {
          setLock(false);
          for (let i = 0; i < 8; i++) { const r = PCB_ASM.handSolder({ kind: 'soic', temp: H.temp, tip: H.tip, drag: H.drag, wireMm: H.wire, pin: i, seed: 31 + i }); r.params = { temp: H.temp, time: 3 / H.drag, preheat: 1.8 / H.drag, wireMm: H.wire }; cur.push(r); }
          H.drawing = 1; const worst = cur.slice().sort((a, b) => a.quality - b.quality)[0]; showResult(worst);
          resCard.firstChild.textContent = 'Schlechteste Stelle von 8: ' + worst.quality + ' Punkte';
          const bad = cur.filter(r => r.joint !== 'gut').length; resCard.appendChild(h('div', { class: 'pa-mute', text: bad ? bad + ' von 8 Pins haben Fehler (rot umrandet).' : 'Alle 8 Pins sauber.' }));
          afterJoint(worst);
        };
      } else paintBtns();
      if (done && cur.length) { showResult(cur[cur.length - 1]); finishEx(); }
      else resCard.appendChild(h('div', { class: 'pa-mute', text: 'Nach jeder Lötstelle siehst du hier das Ergebnis unter dem Mikroskop und warum sie gut oder schlecht wurde.' }));
    }

    render();
    return {
      refresh() { if (destroyed) return; if (R.oven.run || (H.run && H.run.ironOn) || H.drawing > 0 && H.drawing < 1) return; if (R.mode === 'reflow' && R.step === 3) return; render(); },
      destroy() { destroyed = true; cleanup(); el.innerHTML = ''; },
      onShow() { if (!destroyed && !R.oven.run) render(); }
    };
  }
  PCB_VIEWS.register('solder', { title: 'Löten', mount: mountSolder });

})(typeof window !== 'undefined' ? window : globalThis);
