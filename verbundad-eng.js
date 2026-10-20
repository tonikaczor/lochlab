/* verbundad-eng.js - Adapter der Engine-Labs fuer die Verbundprojekte (Paket A1): SchaltLab (sch), SimLab (sim), DigiLab (digi), MessLab (mess), HausLab (haus).
 * Die Leiste (verbundbar.js) laedt diese Datei nach verbund.js und verbundnl.js, der Adapter liest ueber window.LabVerbund (Hook in schaltplan.js, SPEC 5.3) und window.LabDigiAPI (Auto-Weg, Bauteilgeometrie).
 *   apply(station, ctx)   sichert die Arbeit (LabVerbund.load) und laedt Startdaten bzw. bei ctx.solution die Musterloesung (Netzliste -> Plan mit Auto-Weg)
 *   collect(station, ctx) liest den Lab-Stand ohne Nebenwirkung: sch/sim -> sch.circuit, digi -> digi.design, mess -> mess.protocol, haus -> haus.plan
 * Reine Teile (ohne Browser, Node-testbar) stehen in `pure`: digiIO, vddOf, measSpecs, protoToData, rowsFromForm, fillFormFromData, housePlan, starterHouse, injectFault, layoutNetlist, buildSnap.
 * Annahmen sind mit (A) gekennzeichnet. */
(function (root) {
  'use strict';
  const isO = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const isA = Array.isArray;
  const fin = x => typeof x === 'number' && isFinite(x);
  const S = x => (x === null || x === undefined ? '' : String(x));
  const clone = o => JSON.parse(JSON.stringify(o));
  const natCmp = (a, b) => { const ma = /^(\D*)(\d*)(.*)$/.exec(S(a)), mb = /^(\D*)(\d*)(.*)$/.exec(S(b)); if (ma[1] !== mb[1]) return ma[1] < mb[1] ? -1 : 1; const na = ma[2] === '' ? -1 : +ma[2], nb = mb[2] === '' ? -1 : +mb[2]; if (na !== nb) return na < nb ? -1 : 1; return ma[3] < mb[3] ? -1 : ma[3] > mb[3] ? 1 : 0; };
  /* Netzlisten-Bibliothek (Browser: window.VerbundNL/Verbund.nl, Node: require relativ) */
  function lib() {
    if (root.Verbund && root.Verbund.nl) return root.Verbund.nl;
    if (root.VerbundNL) return root.VerbundNL;
    try { if (typeof require === 'function') return require('./verbundnl.js'); } catch (e) { /* nicht vorhanden */ }
    return null;
  }
  const numOf = v => { if (fin(v)) return v; const L = lib(), s = S(v).trim(); if (!s) return NaN; const n = L && L.num ? L.num(s) : NaN; return fin(n) ? n : parseFloat(s.replace(',', '.')); };
  const isPower = n => /^(GND|VCC|VDD|VSS|V\d+)$/i.test(S(n));
  const SRC = ['BAT', 'AC', 'CLK', 'NETZ', 'NETZ3'];
  const pure = {};

  /* ---------- Netzliste lesen ---------- */
  function ix(nl) {
    const net = new Map(), part = new Map();
    (nl && isA(nl.parts) ? nl.parts : []).forEach(p => part.set(p.ref, p));
    (nl && isA(nl.nets) ? nl.nets : []).forEach(n => (isA(n.pins) ? n.pins : []).forEach(a => net.set(a, n.name)));
    return { net, part, nets: nl && isA(nl.nets) ? nl.nets : [] };
  }
  /* DigiLab: Eingaenge = Schalter, Taster, Takt (Name = Beschriftung = ref, Anschluss = der nicht an Versorgung/Masse liegende), Ausgaenge = LEDs (Name = Beschriftung);
     liegt ein Vorwiderstand zwischen Gatter und LED, zeigt ref auf dessen freien Anschluss (Treibernetz). iMaxMa = Treiberfaehigkeit laut Lastenheft (spec.iOutMax, (A)). */
  pure.digiIO = function (nl, spec) {
    const X = ix(nl), inputs = [], outputs = [];
    const sig = (r, p) => { const a = r + '.' + p; return X.net.has(a) && !isPower(X.net.get(a)); };
    (nl && isA(nl.parts) ? nl.parts : []).forEach(p => {
      if (p.kind === 'SPST' || p.kind === 'PB' || p.kind === 'PBC') {
        const s1 = sig(p.ref, '1'), s2 = sig(p.ref, '2'), pin = s1 && !s2 ? '1' : '2';
        if (s1 || s2) inputs.push({ name: p.ref, ref: p.ref + '.' + pin });
      } else if (p.kind === 'CLK') { if (X.net.has(p.ref + '.+')) inputs.push({ name: p.ref, ref: p.ref + '.+' }); }
      else if (p.kind === 'LED') {
        const a = p.ref + '.A', n = X.net.get(a); if (n === undefined) return;
        let ref = a; const net = X.nets.find(q => q.name === n), others = net ? net.pins.filter(x => x !== a) : [];
        if (others.length === 1) { const o = others[0], pr = X.part.get(o.slice(0, o.indexOf('.'))); if (pr && pr.kind === 'R') { const other = o.slice(o.indexOf('.') + 1) === '1' ? '2' : '1', far = pr.ref + '.' + other; if (X.net.has(far)) ref = far; } }
        const o = { name: p.ref, ref }; if (spec && fin(spec.iOutMax)) o.iMaxMa = spec.iOutMax; outputs.push(o);
      }
    });
    return { inputs, outputs };
  };
  /* Musterloesung des DigiLab laden: Eingaenge heissen im Lab wie der Schalter (Beschriftung), Ausgaenge sind LEDs mit Vorwiderstand. Die Netzliste der Loesung wird dafuer
     umbenannt bzw. um LED und Widerstand (330 Ohm, (A)) ergaenzt, damit collect dieselben Namen und Anschluesse findet. */
  pure.digiSolutionNetlist = function (d) {
    const nl = clone(d.netlist), used = new Set(nl.parts.map(p => p.ref));
    const rename = (from, to) => {
      if (!to || from === to || used.has(to) || /[s.]/.test(to)) return false;
      nl.parts.forEach(p => { if (p.ref === from) p.ref = to; });
      nl.nets.forEach(n => { n.pins = n.pins.map(a => (a.indexOf(from + '.') === 0 ? to + a.slice(from.length) : a)); });
      used.delete(from); used.add(to); return true;
    };
    const head = a => S(a).split('.')[0], partOf = r => nl.parts.find(p => p.ref === r);
    (isA(d.inputs) ? d.inputs : []).forEach(i => { const p = partOf(head(i.ref)); if (p && ['SPST', 'PB', 'PBC', 'CLK'].includes(p.kind)) rename(p.ref, S(i.name)); });
    (isA(d.outputs) ? d.outputs : []).forEach(o => {
      const p = partOf(head(o.ref));
      if (p && p.kind === 'LED') { rename(p.ref, S(o.name)); return; }
      const net = ix(nl).net.get(S(o.ref).indexOf('.') >= 0 ? o.ref : '') ; if (net === undefined || !S(o.name) || used.has(S(o.name)) || used.has('R_' + o.name) || /[s.]/.test(o.name)) return;
      const rn = 'R_' + o.name, mid = 'N_' + o.name;
      nl.parts.push({ ref: rn, kind: 'R', value: '330', pins: { '1': net, '2': mid } }, { ref: S(o.name), kind: 'LED', value: 'rot', pins: { A: mid, K: 'GND' } });
      const addTo = (name, a) => { let n = nl.nets.find(x => x.name === name); if (!n) { n = { name, pins: [] }; nl.nets.push(n); } n.pins.push(a); };
      addTo(net, rn + '.1'); addTo(mid, rn + '.2'); addTo(mid, S(o.name) + '.A'); addTo('GND', S(o.name) + '.K'); used.add(rn); used.add(S(o.name));
    });
    return nl;
  };
  /* Versorgungsbereich: nur Gatter des Labs = Spannung der Quelle; 4000er-CMOS 3 bis 15 V (A), 74HC/AC 2 bis 6 V (A), TTL 4,75 bis 5,25 V (A) */
  pure.vddOf = function (nl, icFind) {
    const parts = nl && isA(nl.parts) ? nl.parts : [], bat = parts.find(p => p.kind === 'BAT'), u = bat ? numOf(bat.value) : NaN;
    let lo = fin(u) ? u : 5, hi = lo;
    parts.filter(p => p.kind === 'ICX').forEach(p => {
      const d = icFind ? icFind(p.value) : null; if (!d) return;
      const r = /^4\d{3}/.test(d.key) ? [3, 15] : d.fam === 'ttl' ? [4.75, 5.25] : [2, 6];
      lo = Math.min(lo, r[0]); hi = Math.max(hi, r[1]);
    });
    return { min: lo, max: hi };
  };
  /* Messungen fuer sch.circuit: Spannung je Netz (U_<Netz>, gegen Masse) und Strom je Zweipol bzw. Transistor/Relais (I_<ref>, in das Bauteil hinein); Einheiten V und A.
     Eigene Vorgaben: station.meas (Liste oder Funktion (nl, ctx) -> Liste von { label, kind, ref, pin|pins }). */
  const TWO = ['R', 'LED', 'D', 'ZD', 'SCHOTTKY', 'L', 'C', 'CE', 'FUSE', 'LAMP', 'MOTOR', 'SPK', 'BAT', 'NTC', 'PTC', 'LDR', 'POT'];
  pure.measSpecs = function (nl, st, ctx) {
    if (st && st.meas) { const m = typeof st.meas === 'function' ? st.meas(nl, ctx) : st.meas; if (isA(m)) return m; }
    const out = [], L = lib();
    (nl && isA(nl.nets) ? nl.nets : []).slice(0, 60).forEach(n => { if (n.pins.length) { const a = n.pins[0], i = a.indexOf('.'); out.push({ label: 'U_' + n.name, kind: 'v', ref: a.slice(0, i), pin: a.slice(i + 1) }); } });
    (nl && isA(nl.parts) ? nl.parts : []).forEach(p => {
      const names = L && L.pinNames ? L.pinNames(p.kind, p) : [];
      if (TWO.includes(p.kind) && names.length) out.push({ label: 'I_' + p.ref, kind: 'i', ref: p.ref, pin: names[0] });
      else if (['NPN', 'PNP'].includes(p.kind)) out.push({ label: 'I_' + p.ref + '_C', kind: 'i', ref: p.ref, pin: 'C' });
      else if (['NMOS', 'PMOS'].includes(p.kind)) out.push({ label: 'I_' + p.ref + '_D', kind: 'i', ref: p.ref, pin: 'D' });
      else if (p.kind === 'RLY') out.push({ label: 'I_' + p.ref, kind: 'i', ref: p.ref, pin: 'A1' });
    });
    return out;
  };

  /* ---------- MessLab: Protokoll ---------- */
  const slug = (s, n) => (S(s).toLowerCase().replace(/[^a-z0-9äöüß]+/g, '_').replace(/^_+|_+$/g, '') || 'z' + n);
  /* Zeilen des Lab-Protokolls { w, u, s, i } -> mess.protocol (Messgeraet (A): Multimeter) */
  pure.protoToData = function (rows, tol) {
    const out = [], values = {};
    (isA(rows) ? rows : []).forEach((r, k) => {
      if (!isO(r) || (S(r.w).trim() === '' && S(r.i).trim() === '' && S(r.s).trim() === '')) return;
      const soll = numOf(r.s), ist = S(r.i).trim() === '' ? NaN : numOf(r.i);
      let id = slug(r.w, k + 1); while (out.some(o => o.id === id)) id += '_';
      out.push({ id, label: S(r.w), unit: S(r.u), soll: fin(soll) ? soll : 0, ist: fin(ist) ? ist : null, tol: fin(tol) && tol > 0 ? tol : 5, instrument: 'Multimeter' });
      if (fin(ist)) values[id] = ist;
    });
    return { rows: out, values, findings: [] };
  };
  /* Formularstation ohne eigenes fromForm: Zahlenfelder werden Zeilen, Textfelder (area/text) der Befund */
  pure.rowsFromForm = function (form, vals) {
    const rows = [], findings = [], values = {};
    (isA(form) ? form : []).forEach(f => {
      const v = vals ? vals[f.key] : null;
      if (f.type === 'area' || f.type === 'text') { if (S(v).trim()) findings.push(S(v).trim()); return; }
      const n = numOf(v);
      rows.push({ id: f.key, label: S(f.label || f.key), unit: S(f.unit), soll: 0, ist: fin(n) ? n : null, tol: 5, instrument: 'Multimeter' });
      if (fin(n)) values[f.key] = n;
    });
    return { rows, values, findings };
  };
  /* Umkehrung fuer die Musterloesung: Formularwert je Feld aus den Zeilen (Schluessel normalisiert, auch Anfang passt: 'tRelais' ~ 'tRelaisMs') */
  pure.fillFormFromData = function (form, data) {
    const out = {}, rows = data && isA(data.rows) ? data.rows : [], nz = s => S(s).toLowerCase().replace(/[^a-z0-9]/g, '');
    (isA(form) ? form : []).forEach(f => {
      if (f.type === 'area' || f.type === 'text') { out[f.key] = data && isA(data.findings) ? data.findings.join('\n') : ''; return; }
      const k = nz(f.key), r = rows.find(x => nz(x.id) === k) || rows.find(x => nz(x.id).indexOf(k) === 0 || k.indexOf(nz(x.id)) === 0) || rows.find(x => nz(x.label) === nz(f.label));
      if (r && fin(r.ist)) out[f.key] = String(r.ist).replace('.', ',');
    });
    return out;
  };

  /* ---------- HausLab ---------- */
  const lsOf = ls => { const m = /^([A-Za-z]+)\s*(\d+(?:[.,]\d+)?)/.exec(S(ls)); return m ? { type: m[1].toUpperCase(), inA: parseFloat(m[2].replace(',', '.')) } : { type: '', inA: 0 }; };
  const LOADK = { lamp: 'Lampe', sock: 'Steckdose', dev: 'Gerät', sock3: 'CEE-Steckdose', dev3: 'Drehstromgerät' };
  /* haus.plan aus dem Hausmodell: je Abgang des Verteilers ein Stromkreis. Leitung = kleinster Querschnitt im Stromkreis und laengster Weg vom Verteiler (Summe der Teilstuecke, Wege aus HAUS.route);
     FI Typ A als Annahme (A, das Lab kennt nur 30 und 300 mA); Verbraucher = Lampen, Steckdosen mit Geraet, feste Geraete mit Leistung. */
  pure.housePlan = function (h, HAUS) {
    if (!isO(h) || !isA(h.objs) || !isA(h.cables) || !isO(h.panel)) return null;
    const panel = h.objs.find(o => o.t === 'panel'); if (!panel) return null;
    const obj = id => h.objs.find(o => o.id === id), room = o => { const r = (h.rooms || []).find(x => x.id === o.room); return r ? S(r.n) : ''; };
    const adj = {}; h.cables.forEach(c => { (adj[c.a] = adj[c.a] || []).push(c); (adj[c.b] = adj[c.b] || []).push(c); });
    const len = c => { try { const r = HAUS && HAUS.route ? HAUS.route(h, c) : null; return r && fin(r.len) ? r.len : 0; } catch (e) { return 0; } };
    const circuits = [];
    h.cables.filter(c => c.slot != null && (c.a === panel.id || c.b === panel.id)).sort((a, b) => a.slot - b.slot).forEach(c0 => {
      const slot = (h.panel.slots || [])[c0.slot] || {}, first = obj(c0.a === panel.id ? c0.b : c0.a); if (!first) return;
      const seen = new Set([panel.id]), loads = []; let minS = c0.s || 1.5, maxL = 0;
      const walk = (o, via, dist) => {
        seen.add(o.id); maxL = Math.max(maxL, dist);
        if (LOADK[o.t] && (o.t === 'lamp' ? true : (o.w || 0) > 0)) loads.push({ name: S(o.n) || LOADK[o.t], kind: o.t, w: o.t === 'lamp' ? (o.w || 60) : (o.w || 0), room: room(o) });
        (adj[o.id] || []).forEach(c => { if (c === via) return; const q = obj(c.a === o.id ? c.b : c.a); if (!q || seen.has(q.id) || q.t === 'panel') return; minS = Math.min(minS, c.s || minS); walk(q, c, dist + len(c)); });
      };
      walk(first, c0, len(c0));
      const b = lsOf(slot.ls), fi = slot.fi ? (h.panel.fi || [])[slot.fi - 1] : null, ma = fi ? parseFloat(S(fi.type)) : NaN;
      const c = { name: 'Abgang ' + (c0.slot + 1) + ' (' + (room(first) || 'Haus') + ')', breaker: { type: b.type, inA: b.inA }, rcd: fi && fin(ma) ? { imaMa: ma, type: 'A' } : null, cable: { mm2: minS, lenM: Math.round(maxL * 100) / 100 }, loads };
      if (slot.p3) c.breaker.poles = 3;
      circuits.push(c);
    });
    return { circuits };
  };
  /* Formularwerte (Station: fromForm) uebersteuern den Plan aus dem Lab: erster Stromkreis, der zum Aussenabgang passt, sonst der erste. Nur gefuellte Felder zaehlen. */
  pure.mergeHausPlan = function (plan, extra) {
    const p = plan && isA(plan.circuits) ? clone(plan) : { circuits: [] }, x = isO(extra) ? extra : {}, xc = isA(x.circuits) && isO(x.circuits[0]) ? x.circuits[0] : {};
    if (!p.circuits.length) p.circuits.push({ name: S(xc.name) || 'Abgang 1', loads: [] });
    const c = p.circuits.find(q => /auß|auss|garten|steckdose|aussen/i.test(S(q.name))) || p.circuits[0];
    ['breaker', 'rcd', 'cable', 'socket'].forEach(k => { if (isO(xc[k])) c[k] = Object.assign({}, c[k], xc[k]); });
    if (isA(xc.loads)) c.loads = clone(xc.loads);
    if (xc.name && !/auß|auss|garten|steckdose|aussen/i.test(S(c.name))) c.name = S(xc.name);
    if (x.pAvailW !== undefined) p.pAvailW = x.pAvailW; if (x.notes) p.notes = S(x.notes);
    return p;
  };
  /* Startmodell: Haus mit Verteiler und Gartenhaus (leere Abgaenge), Lampe und Steckdose im Gartenhaus. opts.haus (Station: start.haus) ersetzt es. */
  pure.starterHouse = function (HAUS, name) {
    if (!HAUS || !HAUS.newHouse) return null;
    const h = HAUS.newHouse(name || 'Gartenhaus mit Verteiler'), T = HAUS.TYPES || {};
    const R = (n, x, y, w, d) => { const r = { id: HAUS.nid(h), n, x, y, w, d, c: '#3b4756' }; h.rooms.push(r); return r; };
    const O = (key, t, room, face, u, z, extra) => { const o = Object.assign({ id: HAUS.nid(h), key, t, room: room.id, face, u, z: z == null ? (T[t] ? T[t].z : 1) : z, on: t === 'swi' || t === 'swc' ? 0 : 1 }, extra || {}); if (face === 'C') o.v = o.v == null ? 1.5 : o.v; h.objs.push(o); return o; };
    const R1 = R('Haus', 0, 0, 9, 4), R2 = R('Gartenhaus', 9, 0, 9, 4);
    O('pan', 'panel', R1, 'W', 2, 1.5); O('sw', 'swi', R2, 'S', 1.5); O('l', 'lamp', R2, 'C', 4.5, null, { v: 2 }); O('so', 'sock', R2, 'E', 2, 1.05, { w: 0 });
    return h;
  };

  /* ---------- Fehler im Messaufbau (Stufe 3): rb10 = Basiswiderstand zehnfach, diodeRev = Freilaufdiode verpolt ---------- */
  function swapAddr(nl, a, b) {
    nl.nets.forEach(n => { n.pins = n.pins.map(x => (x === a ? b : x === b ? a : x)); });
    nl.parts.forEach(p => { const m = /^([^.]+)\./.exec(a); if (m && p.ref === m[1]) { const pa = a.slice(m[0].length), pb = b.slice(m[0].length), t = p.pins[pa]; p.pins[pa] = p.pins[pb]; p.pins[pb] = t; } });
  }
  pure.injectFault = function (nl, fault) {
    const c = clone(nl), L = lib(), X = ix(c);
    if (fault === 'rb10') {
      const tr = c.parts.find(p => p.kind === 'NPN' || p.kind === 'PNP' || p.kind === 'NMOS' || p.kind === 'PMOS'); if (!tr) return { nl: c, ok: false };
      const base = X.net.get(tr.ref + (tr.kind === 'NPN' || tr.kind === 'PNP' ? '.B' : '.G')), r = c.parts.find(p => p.kind === 'R' && (X.net.get(p.ref + '.1') === base || X.net.get(p.ref + '.2') === base));
      if (!r) return { nl: c, ok: false };
      const v = numOf(r.value); if (!fin(v)) return { nl: c, ok: false };
      r.value = L && L.fmt ? L.fmt(v * 10) : S(v * 10); return { nl: c, ok: true, what: 'rb10' };
    }
    if (fault === 'diodeRev') {
      const rly = c.parts.find(p => p.kind === 'RLY' || p.kind === 'MOTOR'); if (!rly) return { nl: c, ok: false };            // Relaisspule oder Motor (Gießanlage)
      const pa = rly.kind === 'MOTOR' ? ['.1', '.2'] : ['.A1', '.A2'], c1 = X.net.get(rly.ref + pa[0]), c2 = X.net.get(rly.ref + pa[1]);
      const d = c.parts.find(p => (p.kind === 'D' || p.kind === 'SCHOTTKY') && [X.net.get(p.ref + '.A'), X.net.get(p.ref + '.K')].sort().join() === [c1, c2].sort().join());
      if (!d) return { nl: c, ok: false };
      swapAddr(c, d.ref + '.A', d.ref + '.K'); return { nl: c, ok: true, what: 'diodeRev' };
    }
    const fx = (v, f) => { const x = numOf(v); return fin(x) ? (L && L.fmt ? L.fmt(x * f) : S(x * f)) : null; };
    /* rgs = Pulldown R_GS fehlt (Widerstand zwischen Gate und Source wird entfernt) */
    if (fault === 'rgs') {
      const m = c.parts.find(p => p.kind === 'NMOS' || p.kind === 'PMOS'); if (!m) return { nl: c, ok: false };
      const g = X.net.get(m.ref + '.G'), so = X.net.get(m.ref + '.S');
      const r = c.parts.find(p => p.kind === 'R' && g !== undefined && so !== undefined && [X.net.get(p.ref + '.1'), X.net.get(p.ref + '.2')].sort().join() === [g, so].sort().join());
      if (!r) return { nl: c, ok: false };
      c.parts = c.parts.filter(p => p !== r); c.nets.forEach(n => { n.pins = n.pins.filter(a => a.split('.')[0] !== r.ref); }); c.nets = c.nets.filter(n => n.pins.length > 0); return { nl: c, ok: true, what: 'rgs' };
    }
    /* cWrong = Filterkondensatoren C<k> (alle Kanäle) zehnfach; divSwap = Teilerwiderstände je Kanal vertauscht (R(2k-1) <-> R(2k)) */
    if (fault === 'cWrong') {
      const cs = c.parts.filter(p => p.kind === 'C' && /^C\d+$/.test(p.ref)); if (!cs.length) return { nl: c, ok: false };
      let n = 0; cs.forEach(p => { const v = fx(p.value, 10); if (v) { p.value = v; n++; } }); return { nl: c, ok: n > 0, what: 'cWrong' };
    }
    if (fault === 'divSwap') {
      let n = 0;
      for (let k = 1; k <= 8; k++) { const a = c.parts.find(p => p.ref === 'R' + (2 * k - 1)), b = c.parts.find(p => p.ref === 'R' + 2 * k); if (a && b && a.kind === 'R' && b.kind === 'R') { const t = a.value; a.value = b.value; b.value = t; n++; } }
      return { nl: c, ok: n > 0, what: 'divSwap' };
    }
    /* P2 (Ampel), Text <art>:<Kanal>: rv10 = Vorwiderstand RV<k> zehnfach, ledRev = LED D<k> verpolt */
    const m2 = /^(rv10|ledRev):(\d+)$/.exec(S(fault));
    if (m2) {
      const k = m2[2];
      if (m2[1] === 'rv10') { const r = c.parts.find(p => p.ref === 'RV' + k && p.kind === 'R'); const v = r ? fx(r.value, 10) : null; if (!v) return { nl: c, ok: false }; r.value = v; return { nl: c, ok: true, what: 'rv10:' + k }; }
      const d = c.parts.find(p => p.ref === 'D' + k && (p.kind === 'LED' || p.kind === 'D')); if (!d) return { nl: c, ok: false };
      swapAddr(c, d.ref + '.A', d.ref + '.K'); return { nl: c, ok: true, what: 'ledRev:' + k };
    }
    return { nl: c, ok: false };
  };

  /* ---------- Netzliste -> Plan (Platzierung im Raster, Verdrahtung ueber den Auto-Weg des Labs) ----------
     geo = { names(p) -> Anschlussnamen, pins(p) -> [[dx,dy]] relativ zum Ursprung, box(p) -> [x0,y0,x1,y1], known(kind) }. Zeilen [k,x,y,r,v,extra] wie LabDigiAPI.mkParts. */
  pure.layoutNetlist = function (nl, geo, opt) {
    opt = opt || {};
    const list = [], notPlaced = [];
    (nl && isA(nl.parts) ? nl.parts : []).forEach(p => {
      if (!geo.known(p.kind)) { notPlaced.push(p.ref); return; }
      const rel = geo.pins(p) || [], bx = geo.box(p) || [0, 0, 1, 1]; list.push({ p, rel, names: geo.names(p) || [], bx });
    });
    list.sort((a, b) => (SRC.includes(a.p.kind) ? 0 : 1) - (SRC.includes(b.p.kind) ? 0 : 1) || natCmp(a.p.ref, b.p.ref));
    const cols = Math.max(1, Math.min(opt.cols || 99, Math.ceil(Math.sqrt(list.length * 1.4)))), rows = [], at = new Map();
    let cx = 4, cy = 4, rowH = 0, col = 0;
    list.forEach(it => {
      const w = Math.ceil(it.bx[2]) - Math.floor(it.bx[0]), h = Math.ceil(it.bx[3]) - Math.floor(it.bx[1]);
      if (col >= cols) { col = 0; cx = 4; cy += rowH + 6; rowH = 0; }
      const px = cx - Math.floor(it.bx[0]), py = cy - Math.floor(it.bx[1]);
      const ex = it.p.kind === 'GND' ? {} : { l: it.p.ref }, pr = it.p.props || {};
      if (pr.sw !== undefined) ex.sw = pr.sw ? 1 : 0; if (pr.pos !== undefined) ex.pos = pr.pos; if (pr.pressed !== undefined) ex.pressed = !!pr.pressed; if (pr.vr !== undefined) ex.vr = pr.vr; if (pr.n !== undefined || it.p.kind === 'ICX' || it.p.kind === 'CPU') ex.n = pr.n || it.names.length;
      rows.push([it.p.kind, px, py, 0, S(it.p.value) === '' ? undefined : it.p.value, ex]);
      at.set(it.p.ref, { px, py, rel: it.rel, names: it.names });
      cx += w + 6; rowH = Math.max(rowH, h); col++;
    });
    const nets = [], bad = [], pinPts = new Set();
    at.forEach(q => q.rel.forEach(r => pinPts.add((q.px + r[0]) + ',' + (q.py + r[1]))));
    (nl && isA(nl.nets) ? nl.nets : []).forEach(n => {
      const pts = [];
      (isA(n.pins) ? n.pins : []).forEach(a => {
        const i = a.indexOf('.'), q = at.get(a.slice(0, i)); if (!q) return;
        const k = q.names.indexOf(a.slice(i + 1)); if (k < 0 || !q.rel[k]) { bad.push(a); return; }
        pts.push([q.px + q.rel[k][0], q.py + q.rel[k][1]]);
      });
      if (n.name === 'GND') pts.forEach(pt => rows.push(['GND', pt[0], pt[1], 0, undefined, {}]));
      else if (pts.length >= 2) nets.push(pts);
    });
    return { rows, nets, notPlaced, badPins: bad, pinPts };
  };
  /* Nachbesserung: Netze, die der Auto-Weg nicht ganz verbunden hat, werden mit geraden bzw. L-foermigen Drahtstuecken ergaenzt (Knickpunkt nie auf einem Anschluss oder Drahtende
     eines anderen Netzes, sonst Umweg ueber freie Spalten rechts vom Plan). segs = [[x1,y1,x2,y2]]; Ergebnis: zusaetzliche Stuecke. */
  pure.connectMissing = function (L, segs) {
    const par = new Map(), key = (x, y) => x + ',' + y;
    const find = k => { if (!par.has(k)) par.set(k, k); while (par.get(k) !== k) { par.set(k, par.get(par.get(k))); k = par.get(k); } return k; };
    const occ = new Set(L.pinPts || []), out = []; let maxX = 0, lane = 0;
    occ.forEach(k => { maxX = Math.max(maxX, +k.split(',')[0]); });
    segs.forEach(s => { par.set(find(key(s[0], s[1])), find(key(s[2], s[3]))); occ.add(key(s[0], s[1])); occ.add(key(s[2], s[3])); });
    const put = path => { for (let i = 0; i + 1 < path.length; i++) { const a = path[i], b = path[i + 1]; if (a[0] === b[0] && a[1] === b[1]) continue; out.push([a[0], a[1], b[0], b[1]]); par.set(find(key(a[0], a[1])), find(key(b[0], b[1]))); occ.add(key(a[0], a[1])); occ.add(key(b[0], b[1])); } };
    (L.nets || []).forEach(pts => {
      const groups = new Map(); pts.forEach(p => { const r = find(key(p[0], p[1])); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(p); });
      const gs = [...groups.values()];
      for (let g = 1; g < gs.length; g++) {
        const a = gs[g][0]; let b = gs[0][0], bd = 1e9;
        gs[0].forEach(q => { const d = Math.abs(q[0] - a[0]) + Math.abs(q[1] - a[1]); if (d < bd) { bd = d; b = q; } });
        const free = c => !occ.has(key(c[0], c[1])), c1 = [b[0], a[1]], c2 = [a[0], b[1]];
        let path;
        if (a[0] === b[0] || a[1] === b[1]) path = [a, b]; else if (free(c1)) path = [a, c1, b]; else if (free(c2)) path = [a, c2, b];
        else { const xc = maxX + 3 + 2 * (lane++); path = [a, [xc, a[1]], [xc, b[1]], b]; }
        put(path); gs[0] = gs[0].concat(gs[g]);
      }
    });
    return out;
  };
  /* Zeilen und Verdrahtung -> Engine-Stand { snap: { name, parts, wires, nid, scopes }, fixed }; mk(rows) = LabDigiAPI.mkParts, route(rows, nets) = routeNets (Stuecke [x1,y1,x2,y2]) */
  pure.buildSnap = function (name, L, mk, route) {
    const parts = mk(L.rows); let segs = L.nets.length ? (route(L.rows, L.nets) || []) : [];
    const more = pure.connectMissing(L, segs); segs = segs.concat(more);
    const wires = segs.map((s, k) => ({ id: parts.length + k + 1, x1: s[0], y1: s[1], x2: s[2], y2: s[3] }));
    return { snap: { name, parts, wires, nid: parts.length + wires.length + 1, scopes: [] }, fixed: more.length };
  };
  /* Startschaltung aus station.assist (Stufe 1: 'startschaltung' mit Teilen wie 'BAT 12 V', 'Masse'; 'gatterkarte' mit Gatterarten) und station.start { supply, inputs, outputs, parts } */
  pure.starterNetlist = function (st, ctx) {
    const parts = [], a = st && st.assist && ctx && st.assist[ctx.level], start = st && st.start;
    let n = 0; const add = (kind, value, pre, props) => { parts.push({ ref: pre + (++n), kind, value: S(value), pins: {}, props }); };
    if (isO(start)) {
      if (fin(start.supply)) { add('BAT', String(start.supply), 'V'); add('GND', '', 'M'); }
      (isA(start.inputs) ? start.inputs : []).forEach(nm => parts.push({ ref: S(nm), kind: 'SPST', value: '', pins: {} }));
      (isA(start.outputs) ? start.outputs : []).forEach(nm => parts.push({ ref: S(nm), kind: 'LED', value: 'rot', pins: {} }));
      (isA(start.parts) ? start.parts : []).forEach(q => { if (isO(q) && q.kind) parts.push({ ref: S(q.ref) || q.kind + (++n), kind: q.kind, value: S(q.value), pins: {} }); });
    }
    if (ctx && ctx.assist && isO(a)) {
      if (a.kind === 'startschaltung') (isA(a.parts) ? a.parts : []).forEach(t => { const m = /^BAT\s+([\d.,]+)\s*V?$/i.exec(S(t)); if (m) add('BAT', m[1].replace(',', '.'), 'V'); else if (/^masse$/i.test(S(t))) add('GND', '', 'M'); });
      else if (a.kind === 'gatterkarte') { add('BAT', '5', 'V'); add('GND', '', 'M'); (isA(a.gates) ? a.gates : []).forEach(g => { if (/^(AND|NAND|OR|NOR|XOR|NOT|DFF)$/.test(S(g))) add(g, '5V', 'G'); }); }
    }
    const seen = new Set(); parts.forEach(p => { while (seen.has(p.ref)) p.ref += '_'; seen.add(p.ref); });
    return { v: 1, name: S(st && st.title), parts, nets: [] };
  };
  pure.natCmp = natCmp;

  /* ---------- Browser-Anbindung ---------- */
  const hook = () => root.LabVerbund || null;
  const api = () => root.LabDigiAPI || null;
  function geoFromApi(A, L) {
    const K = A.KINDS, extra = p => (p.kind === 'ICX' || p.kind === 'CPU' ? { n: (p.props && p.props.n) || L.pinNames(p.kind, p).length } : p.props && p.props.n ? { n: p.props.n } : {});
    const row = p => [[p.kind, 0, 0, 0, S(p.value) === '' ? undefined : p.value, extra(p)]];
    return {
      known: k => !!K[k],
      names: p => L.pinNames(p.kind, Object.assign({}, p, { props: Object.assign({}, p.props, extra(p)) })),
      pins: p => A.pinPts(row(p))[0],
      box: p => {
        const rel = A.pinPts(row(p))[0], k = K[p.kind]; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        rel.forEach(q => { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); });
        if (k && k.box && !k.dyn) { x0 = Math.min(x0, k.box[0]); y0 = Math.min(y0, k.box[1]); x1 = Math.max(x1, k.box[2]); y1 = Math.max(y1, k.box[3]); }
        return [x0 - 0.5, y0 - 0.5, x1 + 0.5, y1 + 0.5];
      }
    };
  }
  /* Netzliste in den Plan des Labs legen: { ok, snap, msg } */
  function snapFromNetlist(name, nl, opt) {
    const A = api(), L = lib(); if (!A || !L) return { ok: false, msg: 'Das Lab ist noch nicht bereit (Auto-Weg oder Netzlisten-Bibliothek fehlt).' };
    const r = opt && opt.raw ? { ok: true, nl } : L.normalize(nl, { lenient: true });
    if (!r.ok) return { ok: false, msg: 'Die Netzliste ist ungültig: ' + (r.errs[0] || '') };
    const Lay = pure.layoutNetlist(r.nl, geoFromApi(A, L));
    A.routeFails = 0;
    const b = pure.buildSnap(name, Lay, rows => A.mkParts(rows), (rows, nets) => A.routeNets(rows, nets));
    const miss = Lay.notPlaced.length;
    return { ok: true, snap: b.snap, msg: (b.fixed ? ' ' + b.fixed + ' Drahtstück(e) liegen als Notlösung (der Auto-Weg fand keinen Weg).' : '') + (miss ? ' Nicht platziert: ' + Lay.notPlaced.join(', ') + '.' : '') };
  }
  const NOT_READY = { ok: false, msg: 'Das Lab ist noch nicht bereit.' };
  function applyCircuit(st, ctx) {
    const H = hook(); if (!H || !H.ready()) return NOT_READY;
    const sol = ctx && ctx.solution && ctx.solution.data, name = S(st && st.title) || 'Verbund-Station';
    let snap = null, msg = '';
    if (isO(sol) && isO(sol.snap) && isA(sol.snap.parts) && sol.snap.parts.length) { snap = clone(sol.snap); snap.name = name + ' (Musterlösung)'; }
    else if (isO(sol) && isO(sol.netlist)) { const r = snapFromNetlist(name + ' (Musterlösung)', st && st.type === 'digi.design' || (isA(sol.inputs) && isA(sol.outputs)) ? pure.digiSolutionNetlist(sol) : sol.netlist); if (!r.ok) return r; snap = r.snap; msg = r.msg; }
    else {
      const L = lib(), nl = pure.starterNetlist(st, ctx);
      if (nl.parts.length && L) { const r = snapFromNetlist(name, nl, { raw: true }); if (!r.ok) return r; snap = r.snap; msg = r.msg; }
      else snap = { name, parts: [], wires: [], nid: 1, scopes: [] };
    }
    if (!H.load(snap, snap.name)) return { ok: false, msg: 'Der Plan konnte nicht geladen werden.' };
    return { ok: true, msg: (sol ? 'Musterlösung geladen. Deine Arbeit ist gesichert.' : snap.parts.length ? 'Startschaltung geladen. Deine bisherige Arbeit ist gesichert.' : 'Leeres Blatt geladen. Deine bisherige Arbeit ist gesichert.') + msg };
  }
  /* MessLab: Messaufbau = Schaltplan der Station davor (Slot sch), bei Fehlerstufe mit eingebautem Fehler (spec.fault) */
  function applyMess(st, ctx) {
    const H = hook(); if (!H || !H.ready()) return NOT_READY;
    const sch = ctx && ctx.get ? ctx.get('sch') : null;
    if (!isO(sch) || !isO(sch.netlist)) return { ok: true, msg: 'Kein Schaltplan aus einer früheren Station vorhanden. Baue den Messaufbau selbst auf.' };
    let nl = sch.netlist, note = '';
    const f = ctx.spec && ctx.spec.fault;
    if (f) { const r = pure.injectFault(nl, f); if (r.ok) { nl = r.nl; note = ' Der Aufbau enthält einen Fehler. Finde ihn.'; } }
    const r = snapFromNetlist('Messaufbau: ' + (S(sch.name) || S(st && st.title)), nl); if (!r.ok) return r;
    if (!H.load(r.snap, r.snap.name)) return { ok: false, msg: 'Der Messaufbau konnte nicht geladen werden.' };
    return { ok: true, msg: 'Messaufbau geladen. Deine Arbeit ist gesichert.' + note + r.msg };
  }
  function applyHaus(st, ctx) {
    const H = hook(), HAUS = root.HAUS; if (!H || !H.ready() || !HAUS) return NOT_READY;
    const model = (st && st.start && isO(st.start.haus)) ? clone(st.start.haus) : pure.starterHouse(HAUS, S(st && st.title));
    if (!model || !H.setHaus(model, model.name)) return { ok: false, msg: 'Das Haus konnte nicht geladen werden (Aufgabe beenden?).' };
    return { ok: true, msg: (ctx && ctx.solution ? (st && isA(st.form) && st.form.length ? 'Die Musterlösung steht im Formular, das Startgrundstück steht bereit. ' : 'Für das HausLab gibt es keine ladbare Musterlösung, das Startgrundstück steht bereit. ') : 'Startgrundstück geladen. ') + 'Deine Arbeit ist gesichert.' };
  }
  function collectCircuit(st, ctx) {
    const H = hook(); if (!H || !H.ready()) return { error: 'Das Lab ist noch nicht bereit.' };
    const parts = H.parts() || []; if (!parts.length) return { error: 'Es ist noch kein Bauteil gezeichnet.' };
    const nl = H.netlist(); if (!nl) return { error: 'Die Netzliste konnte nicht gelesen werden (Bibliothek verbundnl.js fehlt oder Plan fehlerhaft).' };
    const meas = H.simMeas(pure.measSpecs(nl, st, ctx)) || {};
    return { type: 'sch.circuit', data: { lab: H.lab, name: S(nl.name) || 'Schaltung', netlist: nl, meas, snap: H.snap() || {} } };
  }
  function collectDigi(st, ctx) {
    const H = hook(); if (!H || !H.ready()) return { error: 'Das Lab ist noch nicht bereit.' };
    if (!(H.parts() || []).length) return { error: 'Es ist noch kein Bauteil gezeichnet.' };
    const nl = H.netlist(); if (!nl) return { error: 'Die Netzliste konnte nicht gelesen werden (Bibliothek verbundnl.js fehlt oder Plan fehlerhaft).' };
    const io = pure.digiIO(nl, ctx && ctx.spec);
    return { type: 'digi.design', data: { netlist: nl, inputs: io.inputs, outputs: io.outputs, vdd: pure.vddOf(nl, root.LochSimICs && root.LochSimICs.find ? v => root.LochSimICs.find(v) : null) } };
  }
  function collectMess(st, ctx) {
    const form = ctx && ctx.formData;
    if (st && isA(st.form) && st.form.length && form) return { type: 'mess.protocol', data: typeof st.fromForm === 'function' ? st.fromForm(form, ctx) : pure.rowsFromForm(st.form, form) };
    const H = hook(); if (!H || !H.ready()) return { error: 'Das Lab ist noch nicht bereit.' };
    const rows = H.proto() || [], d = pure.protoToData(rows, H.protoTol());
    if (!d.rows.length || !d.rows.some(r => r.ist !== null)) return { error: 'Das Messprotokoll ist noch leer. Trage Soll- und Istwerte ein (Menü, Messprotokoll).' };
    return { type: 'mess.protocol', data: d };
  }
  function collectHaus(st, ctx) {
    const form = ctx && ctx.formData, hasForm = !!(st && isA(st.form) && st.form.length && form);
    if (hasForm) {   // Station mit Formular (Aussenanschluss): Werte aus dem Formular, ergaenzt um den Plan im Lab, soweit er etwas liefert
      let extra = null; try { extra = typeof st.fromForm === 'function' ? st.fromForm(form, ctx) : null; } catch (x) { return { error: 'Das Formular konnte nicht ausgewertet werden: ' + (x && x.message ? x.message : x) }; }
      const H0 = hook(), m0 = H0 && H0.ready() ? H0.haus() : null; let lab = m0 ? pure.housePlan(m0, root.HAUS) : null; if (lab && !lab.circuits.length) lab = null;
      const c0 = extra && isA(extra.circuits) && extra.circuits[0] || {};
      if (!lab && !Object.keys(c0).some(k => k !== 'name') && extra && extra.pAvailW === undefined) return { error: 'Trage die Werte deines Abgangs im Formular ein (oder verlege im Lab eine Leitung vom Verteilerkasten).' };
      return { type: 'haus.plan', data: pure.mergeHausPlan(lab, extra) };
    }
    const H = hook(); if (!H || !H.ready()) return { error: 'Das Lab ist noch nicht bereit.' };
    const m = H.haus(), plan = m ? pure.housePlan(m, root.HAUS) : null;
    if (!plan) return { error: 'Es gibt noch kein Haus mit Verteilerkasten.' };
    if (!plan.circuits.length) return { error: 'Vom Verteilerkasten geht noch keine Leitung ab. Verlege Leitungen zu den Verbrauchern.' };
    return { type: 'haus.plan', data: plan };
  }
  const BY = { sch: [applyCircuit, collectCircuit, 'sch.circuit'], sim: [applyCircuit, collectCircuit, 'sch.circuit'], digi: [applyCircuit, collectDigi, 'digi.design'], mess: [applyMess, collectMess, 'mess.protocol'], haus: [applyHaus, collectHaus, 'haus.plan'] };
  function adapterFor(lab) {
    const a = { lab, ready: () => { const H = hook(); return !!(H && H.lab === lab && H.ready() && (lab === 'haus' ? !!root.HAUS : !!api())); }, apply: BY[lab][0], collect: BY[lab][1], pure };
    if (lab === 'mess') a.fillForm = (st, data) => pure.fillFormFromData(st && st.form, data);
    return a;
  }
  const mod = { pure, adapterFor, snapFromNetlist };
  if (typeof module === 'object' && module && module.exports) module.exports = mod;
  root.VerbundAdEng = mod;
  const V = root.Verbund;
  if (V && typeof V.registerAdapter === 'function') Object.keys(BY).forEach(l => V.registerAdapter(l, adapterFor(l)));
})(typeof window !== 'undefined' ? window : globalThis);
