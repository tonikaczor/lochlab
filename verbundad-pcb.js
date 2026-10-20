/* verbundad-pcb.js - Adapter des Leiterplatten-Labs fuer die Verbundprojekte (Paket A3).
 * Registriert sich als Verbund.registerAdapter('pcb', ...). Schnittstelle: ready(), apply(station, ctx), collect(station, ctx), live(station, ctx), pure.
 *  apply:   Netzliste aus dem Eingangs-Slot (sch.circuit oder loch.layout) -> Verbund.nl.toBoard -> Platine mit Bauteilen und Netzen im Platinenmass des Lastenhefts
 *           (boardW, boardH, layers). Stufe 1 (ctx.assist): Bauteile aufgeraeumt vorplatziert, Schraubklemmen fuer Quellen, Schalter und Relaiskontakte am linken Rand.
 *           Stufen 2 und 3: Bauteile und Netze, keine Klemmen und keine Aufraeum-Anordnung (A). Eigene Arbeit wird vorher gesichert (wie PCB_UI.stash).
 *           Musterloesung (ctx.solution): laedt solution.data.board.
 *  collect: { type:'pcb.board', data:{ board, report:{ w,h,layers,drcErrors,drcWarns,unrouted,shorts,cost,bomCount } } }, ohne Nebenwirkung.
 * Laeuft auch ohne Browser (Node): PCB_UI darf ein Ersatzobjekt sein ({ S:{board,...}, loadBoard, saveBoard, setTab }). */
(function (root) {
  'use strict';
  const isO = o => o !== null && typeof o === 'object' && !Array.isArray(o);
  const isA = Array.isArray, isN = x => typeof x === 'number' && isFinite(x);
  const clone = o => JSON.parse(JSON.stringify(o));
  const tryReq = f => { try { return typeof require === 'function' ? require(f) : null; } catch (e) { return null; } };
  const CORE = () => root.PCB_CORE || tryReq('./pcbcore.js');
  const VB = () => root.Verbund || tryReq('./verbund.js');
  const NL = () => { const v = VB(); return v && v.nl ? v.nl : (root.VerbundNL || tryReq('./verbundnl.js')); };
  const UI = () => root.PCB_UI || null;
  const fpKnown = id => { const c = CORE(); return !!(c && c.footprint && c.footprint(id)); };

  /* ---------------- Parameter aus Lastenheft und Station ---------------- */
  function boardParams(spec, station) {
    const P = isO(spec) && isO(spec.params) ? spec.params : (isO(spec) ? spec : {});
    const O = station && isO(station.open) ? station.open : {};
    const pick = (v, d, lo, hi) => (isN(+v) && +v >= lo && +v <= hi ? +v : d);
    const L = +(P.layers != null ? P.layers : O.layers);
    const r = { w: pick(P.boardW != null ? P.boardW : O.boardW, 60, 10, 300), h: pick(P.boardH != null ? P.boardH : O.boardH, 40, 10, 300), layers: [1, 2, 4, 6].indexOf(L) >= 0 ? L : 2 };
    const cl = pick(P.clearance, 0, 0.05, 2); if (cl > 0) r.clearance = cl;   // Regelabstand nur, wenn das Lastenheft ihn nennt (Förderanlage: 0,3 mm)
    return r;
  }
  /* Netzliste aus den Eingangs-Slots der Station (erster Slot mit netlist) */
  function netlistOf(station, ctx) {
    const names = station && isA(station.in) ? station.in : [];
    for (let i = 0; i < names.length; i++) {
      let d = null; try { d = ctx && typeof ctx.get === 'function' ? ctx.get(names[i]) : null; } catch (e) { d = null; }
      if (isO(d) && isO(d.data) && typeof d.type === 'string') d = d.data;
      if (isO(d) && isO(d.netlist) && isA(d.netlist.parts) && d.netlist.parts.length) return { slot: names[i], nl: d.netlist };
    }
    return null;
  }

  /* ---------------- Anschluesse nach aussen (Schraubklemmen) ----------------
     Quellen (BAT) mit Netz auf der Platine -> Klemme (Plus, Masse); Schalter/Taster/Lasten ausserhalb -> Klemme (Netz, Masse bzw. beide Netze);
     Relais-Kontakte COM und NO ohne weitere Verbindung -> Klemme. Rueckgabe: [{ value, nets:[n1, n2] }] */
  const SWITCH = ['SPST', 'SPDT', 'PB', 'PBC', 'KREUZ'], LOAD = ['LAMP', 'MOTOR', 'MOTOR3', 'SPK', 'HEAT', 'SD', 'IMP'];
  function externals(nl) {
    const N = NL(); if (!N) return [];
    const r = N.normalize(nl, { lenient: true, warnSingle: false }); if (!r.ok) return [];
    const off = new Set(N.OFFBOARD), parts = r.nl.parts;
    const onNets = new Set(), cnt = {};
    parts.forEach(p => Object.keys(p.pins || {}).forEach(k => { const n = p.pins[k]; cnt[n] = (cnt[n] || 0) + 1; if (!off.has(p.kind)) onNets.add(n); }));
    const bat = parts.find(p => p.kind === 'BAT' && onNets.has(p.pins['+']));
    const gnd = onNets.has('GND') ? 'GND' : (bat ? bat.pins['-'] : null);
    const out = [], used = new Set();
    const add = (value, nets) => { const n = nets.filter(Boolean); if (!n.length || n.every(x => used.has(x) && x !== gnd)) return; n.forEach(x => used.add(x)); out.push({ value, nets: n.length === 1 && gnd && n[0] !== gnd ? [n[0], gnd] : n }); };
    parts.filter(p => p.kind === 'BAT' && onNets.has(p.pins['+'])).forEach(p => { const v = String(p.value || '').replace(/V$/i, ''); add(v ? v + 'V' : p.pins['+'], [p.pins['+'], p.pins['-']]); });
    parts.filter(p => SWITCH.indexOf(p.kind) >= 0).forEach(p => Object.keys(p.pins || {}).forEach(k => { const n = p.pins[k]; if (onNets.has(n) && n !== gnd && !used.has(n)) add(n, [n]); }));
    parts.filter(p => LOAD.indexOf(p.kind) >= 0).forEach(p => { const ns = Object.keys(p.pins || {}).map(k => p.pins[k]).filter(n => onNets.has(n)); if (ns.length) add(p.ref, ns.slice(0, 2)); });
    parts.filter(p => p.kind === 'RLY').forEach(p => {
      const c = ['COM', 'NO'].map(k => p.pins[k] || (p.ref + '_' + k));
      if (c.every((n, i) => (cnt[n] || 0) <= 1 || !p.pins[['COM', 'NO'][i]])) out.push({ value: 'KONTAKT', nets: c, contact: p.ref });
    });
    return out;
  }

  /* ---------------- Anordnung ---------------- */
  function courtyard(fpId, rot) {
    const C = CORE(), fp = C.footprint(fpId); if (!fp || !fp.courtyard) return { x0: -3, x1: 3, y0: -3, y1: 3 };
    const cy = fp.courtyard, xs = [], ys = [];
    [[cy.x, cy.y], [cy.x + cy.w, cy.y], [cy.x, cy.y + cy.h], [cy.x + cy.w, cy.y + cy.h]].forEach(pt => { const q = C.xform({ x: 0, y: 0, rot: rot, side: 'top', fp: fpId }, pt[0], pt[1]); xs.push(q[0]); ys.push(q[1]); });
    return { x0: Math.min.apply(null, xs), x1: Math.max.apply(null, xs), y0: Math.min.apply(null, ys), y1: Math.max.apply(null, ys) };
  }
  const r2 = v => Math.round(v * 100) / 100;
  /* ordnet die Bauteile der Platine zeilenweise (links nach rechts, grosse zuerst) ab Position (x0, 3); liefert { ok, over:[ref] } */
  function tidy(board, x0) {
    const vars = [[0, 2.5], [90, 2.5], [0, 1.5], [90, 1.5], [0, 1], [90, 1]];
    const order = board.parts.slice().sort((a, b) => { const ca = courtyard(a.fp, 0), cb = courtyard(b.fp, 0); return (cb.x1 - cb.x0) * (cb.y1 - cb.y0) - (ca.x1 - ca.x0) * (ca.y1 - ca.y0); });
    let best = null;
    for (let vi = 0; vi < vars.length; vi++) {
      const rot = vars[vi][0], gap = vars[vi][1], pos = {}, over = [];
      let cx = x0, cy = 3, rowH = 0;
      order.forEach(p => {
        const q = courtyard(p.fp, rot), w = q.x1 - q.x0, h = q.y1 - q.y0;
        if (cx + w > board.w - 2 && cx > x0) { cx = x0; cy += rowH + gap; rowH = 0; }
        pos[p.ref] = { x: r2(cx - q.x0), y: r2(cy - q.y0), rot };
        if (cx + w > board.w - 1 || cy + h > board.h - 1) over.push(p.ref);
        cx += w + gap; rowH = Math.max(rowH, h);
      });
      if (!best || over.length < best.over.length) best = { pos, over };
      if (!over.length) break;
    }
    board.parts.forEach(p => { const q = best.pos[p.ref]; p.x = q.x; p.y = q.y; p.rot = q.rot; });
    return { ok: best.over.length === 0, over: best.over };
  }
  function addPad(board, name, pad, cls) {
    let n = board.nets.find(x => x.name === name);
    if (!n) { n = { name, cls: cls || 'signal', pins: [] }; board.nets.push(n); }
    if (n.pins.indexOf(pad) < 0) n.pins.push(pad);
  }
  /* Schraubklemmen X1..Xn am linken Rand (Pad 1 = erstes Netz, Pad 2 = zweites Netz) */
  function addTerminals(board, ext) {
    const fp = fpKnown('TERMINAL_2') ? 'TERMINAL_2' : 'HDR_1x2';
    ext.forEach((e, i) => {
      const ref = 'X' + (i + 1);
      board.parts.push({ id: 'p' + (board.parts.length + 1), ref, fp, value: e.value, x: 2.8, y: r2((i + 0.5) * board.h / ext.length), rot: 0, side: 'top' });
      e.nets.slice(0, 2).forEach((nm, k) => addPad(board, nm, ref + '.' + (k + 1), 'signal'));
    });
  }
  /* Startplatine aus einer Netzliste: { ok, board, msg, warnings, missing } */
  function startBoard(nl, o) {
    o = o || {};
    const N = NL(), C = CORE();
    if (!N || !C) return { ok: false, msg: 'Die Hilfsbibliothek verbundnl.js oder der Platinen-Kern fehlt.' };
    const tb = N.toBoard(nl, { w: o.w, h: o.h, layers: o.layers, id: 'verbund', name: o.name || 'Verbund-Platine' });
    if (!tb.ok) return { ok: false, msg: 'Die Netzliste lässt sich nicht in eine Platine umsetzen: ' + ((tb.errs || []).join(' ') || 'unbekannter Fehler') };
    if (!tb.board.parts.length) return { ok: false, msg: 'Die Netzliste enthält keine Bauteile, die auf eine Platine gehören.' };
    const board = tb.board; board.w = o.w; board.h = o.h; board.layers = o.layers; if (o.clearance > 0) board.rules = Object.assign({}, board.rules, { clearance: o.clearance });
    const warnings = (tb.warnings || []).filter(w => !(o.assist && /^Platine /.test(w)));
    let terms = [];
    if (o.assist) {
      terms = externals(nl);
      const t = tidy(board, terms.length ? 9 : 3);
      addTerminals(board, terms);
      if (!t.ok) warnings.push('Die Platine ist für alle Bauteile eng: ' + t.over.join(', ') + ' ragen über den Rand.');
    }
    return { ok: true, board, terminals: terms, warnings, missing: tb.missing || [], placed: tb.placed || [] };
  }

  /* ---------------- Kennzahlen ---------------- */
  function reportOf(board) {
    const C = CORE(), b = C.normalize(clone(board)), conn = C.connectivity(b), drc = isA(C.drc(b)) ? C.drc(b) : [];
    let cost = NaN; try { const c = C.cost(b); cost = c && isN(c.total) ? c.total : NaN; } catch (e) { cost = NaN; }
    return { w: b.w, h: b.h, layers: b.layers,
      drcErrors: drc.filter(x => x.severity === 'error' && x.type !== 'unconnected').length,
      drcWarns: drc.filter(x => x.severity !== 'error' && x.severity !== 'info').length,
      unrouted: isA(conn.unrouted) ? conn.unrouted.length : 0, shorts: isA(conn.shorts) ? conn.shorts.length : 0,
      cost: isN(cost) ? cost : 0, bomCount: b.parts.length };
  }
  function payloadFromBoard(board) {
    if (!isO(board) || !isA(board.parts) || !board.parts.length) return { error: 'Die Platine ist leer. Lege die Bauteile aus deinem Schaltplan an oder lade die Startdaten (Knopf „Startdaten neu laden“).' };
    const b = clone(board);
    return { type: 'pcb.board', data: { board: b, report: reportOf(b) } };
  }

  /* ---------------- Lab-Anbindung ---------------- */
  /* eigene Arbeit sichern wie PCB_UI.stash (pcbui.js): nur wenn etwas darin steht, ungespeichert oder geaendert */
  function stash(ui) {
    const S = ui.S, b = S.board;
    const has = !!b && ['parts', 'tracks', 'vias', 'zones'].some(k => isA(b[k]) && b[k].length > 0);
    if (!has || (S.task && !S.dirty) || (S.id && !S.dirty) || (!S.dirty && !S.userEdit)) return false;
    try { return ui.saveBoard(b.name || 'Platine') !== false; } catch (e) { return false; }
  }
  function load(ui, board, name) {
    const had = stash(ui);
    ui.S.task = null;
    ui.loadBoard(board, name);
    if (typeof ui.setTab === 'function') ui.setTab('edit');
    return had;
  }
  function apply(station, ctx) {
    const ui = UI(), C = CORE();
    if (!ui || !C || !ui.S) return { ok: false, msg: 'Das Leiterplatten-Lab ist noch nicht bereit.' };
    ctx = ctx || {};
    const name = 'Verbund: ' + ((station && station.title) || 'Platine');
    const sol = ctx.solution && ctx.solution.data;
    if (sol) {
      let b = sol.board; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
      if (!isO(b)) return { ok: false, msg: 'Die Musterlösung enthält keine Platine.' };
      const had = load(ui, C.normalize(clone(b)), name + ' (Musterlösung)');
      return { ok: true, msg: 'Musterlösung geladen.' + (had ? ' Deine Platine ist gesichert.' : '') };
    }
    const p = boardParams(ctx.spec, station), src = netlistOf(station, ctx);
    if (!src) {
      const nb = C.newBoard({ id: 'verbund', name, w: p.w, h: p.h, layers: p.layers }); if (p.clearance > 0) nb.rules = Object.assign({}, nb.rules, { clearance: p.clearance });
      const had = load(ui, nb, name);
      return { ok: true, msg: 'Leere Platine ' + p.w + ' × ' + p.h + ' mm angelegt (keine Netzliste im Eingang).' + (had ? ' Deine Platine ist gesichert.' : '') };
    }
    const r = startBoard(src.nl, { w: p.w, h: p.h, layers: p.layers, clearance: p.clearance, name, assist: !!ctx.assist });
    if (!r.ok) return { ok: false, msg: r.msg };
    const had = load(ui, r.board, name);
    const miss = r.missing.length ? ' Ohne Footprint: ' + r.missing.map(m => m.ref).join(', ') + '.' : '';
    return { ok: true, msg: 'Platine ' + p.w + ' × ' + p.h + ' mm mit ' + r.board.parts.length + ' Bauteilen und ' + r.board.nets.length + ' Netzen geladen' + (ctx.assist ? ', Klemmen und Bauteile vorplatziert' : '') + '.' + miss + (had ? ' Deine Platine ist gesichert.' : '') };
  }
  function collect(station, ctx) {
    const ui = UI(); if (!ui || !ui.S || !ui.S.board || !CORE()) return { error: 'Das Leiterplatten-Lab ist noch nicht bereit.' };
    return payloadFromBoard(ui.S.board);
  }
  /* Hinweise ohne Speichern (nur Lesen) */
  function live(station, ctx) {
    const c = collect(station, ctx); if (c.error) return [{ ok: false, text: c.error }];
    const d = c.data, r = d.report, p = boardParams(ctx && ctx.spec, station), src = netlistOf(station, ctx), out = [];
    out.push({ ok: r.w <= p.w + 1e-6 && r.h <= p.h + 1e-6 && r.layers <= p.layers, text: 'Maße ' + r.w + ' × ' + r.h + ' mm, ' + r.layers + ' Lagen (höchstens ' + p.w + ' × ' + p.h + ' mm, ' + p.layers + ' Lagen)' });
    if (src) { const N = NL(), want = N ? N.normalize(src.nl, { lenient: true, warnSingle: false }) : null; const off = new Set(N ? N.OFFBOARD : []); const n = want && want.ok ? want.nl.parts.filter(x => !off.has(x.kind)).length : 0; const have = d.board.parts.filter(x => !/^X\d/.test(x.ref)).length; out.push({ ok: have >= n, text: have + ' von ' + n + ' Bauteilen aus der Schaltung sind auf der Platine' }); }
    out.push({ ok: r.unrouted === 0, text: r.unrouted === 0 ? 'Alle Verbindungen sind verlegt' : r.unrouted + ' Verbindungen sind noch offen' });
    out.push({ ok: r.drcErrors === 0 && r.shorts === 0, text: 'DRC: ' + r.drcErrors + ' Fehler' + (r.shorts ? ', ' + r.shorts + ' Kurzschlüsse' : '') });
    return out;
  }

  const adapter = { lab: 'pcb', ready: () => !!(UI() && UI().S && UI().S.board && CORE()), apply, collect, live,
    pure: { boardParams, netlistOf, externals, tidy, courtyard, startBoard, reportOf, payloadFromBoard, stash } };
  const V = VB();
  if (V && typeof V.registerAdapter === 'function') V.registerAdapter('pcb', adapter);
  root.VERBUND_ADAPTERS = root.VERBUND_ADAPTERS || {}; root.VERBUND_ADAPTERS.pcb = adapter;
  root.VerbundAdPcb = adapter;
  if (typeof module !== 'undefined' && module.exports) module.exports = adapter;
})(typeof window !== 'undefined' ? window : globalThis);
