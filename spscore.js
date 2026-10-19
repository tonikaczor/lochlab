/* spscore.js - SPS-Lab Kern (Version 1.0)
 * Laufzeit, Kompilierer, Scan-Zyklus, Adress-Anzeige, GRAFCET-Parser.
 * Vanilla-JS, keine Abhaengigkeiten, kein eval/new Function. Laedt im Browser (window.SPS_CORE) und in Node.
 *
 * ENTSCHEIDUNGEN (wo die Spezifikation offen laesst):
 *  - plc.errors enthaelt Fehler UND Warnungen (Strings). Zusaetzlich: plc.warnings (nur Warnungen),
 *    plc.errorList (nur echte Fehler), plc.ok (true = keine echten Fehler, Warnungen erlaubt).
 *    scan() ist nur bei echten Fehlern ein No-Op.
 *  - Auswertung: und/oder/xor werten IMMER alle Eingaenge aus (kein Kurzschluss), damit Flanken und
 *    Bausteine genau einmal je Zyklus laufen. xor mit mehreren Eingaengen = ungerade Anzahl true.
 *  - Zeitglieder: der erste Zyklus mit in=true zaehlt bereits dtMs (TON mit pt=100, dt=10: Q im 10. Zyklus).
 *    TOF/TP: Q bleibt genau pt/dt Zyklen (die Flanke zaehlt als Zyklus 0). pt muss Zahl >= 0 sein.
 *  - Zaehler: CTU zaehlt ohne Obergrenze bis 999, r hat Vorrang vor Zaehlen. CTD: ld hat Vorrang, Startwert 0
 *    (Q ist dann nach dem ersten Scan true), min 0. Flanken-Anfangswert ist false (wie ein Merkerbit = 0).
 *  - rs/sr: Ausgang id+'.Q' (id z. B. FF1; darf keine Adresse sein). Fb-Kinder-Pfade fuer power(): in=".0",
 *    s=".1", r=".2", ld=".3" (feste Positionen, unabhaengig davon, welche vorhanden sind).
 *  - Lesen von 'T1' / 'C1' ohne Suffix = T1.Q / C1.Q. T1.ET / C1.CV als Kontakt = (Wert > 0).
 *  - Netzwerk ohne expr: Warnung, expr gilt als false. Netzwerk-ID fehlt: 'N'+Position (1-basiert).
 *  - power() liefert { N1:{power,nodes,outs}, ..., networks: <dasselbe> } (networks nicht aufzaehlbar),
 *    nodes[path] = Kontakt leitet bzw. Zwischenergebnis (nach neg). outs = Array der Ausgangswerte.
 *  - GRAFCET: Schrittzeit des Eintrittszyklus = 0, danach +dtMs je Zyklus (Initialschritte: erster Scan = 0).
 *    Alle Bedingungen werden jeden Zyklus ausgewertet (damit RE/FE Flanken sauber erfassen). Konflikt zweier
 *    schaltbereiter Transitionen mit gleicher Quelle: die in der Liste erste gewinnt.
 *    Ausgang = (durch S/R gespeicherter Wert) ODER (aktive N/D/L-Aktion). Bedingungen lesen Ausgaenge/Merker
 *    des vorherigen Zyklus (Aktionen laufen nach den Transitionen).
 *  - Operanden im GRAFCET-Text: Schritt-ID (hat Vorrang) > Adresse (alle Schreibweisen) > Symbolname aus prog.symbols.
 *    Zusaetzlich erlaubt: ! und ^ ( NICHT / XOR ), && und ||, 1/0 als true/false, Dezimalkomma bei Zeiten.
 *    Prioritaet: NICHT > UND > XOR > ODER.
 *  - addr(key, mode, kind?) - optionaler dritter Parameter kind ('ton','tof','tp','ctu','ctd') liefert
 *    TON1/TOF1/TP1/CTU1/CTD1 (IEC) bzw. 'T1 (SE)' / 'Z1 (ZV)' (Siemens).
 *  - exampleProgs ist ein Array [{id,name,desc,plant,prog}], zusaetzlich per ID als Eigenschaft erreichbar.
 *  - Zusatz-API: parseCond(text, prog) (Syntaxpruefung fuer die UI), condToText(ast, mode), normKey = parseAddr.
 */
(function (root) {
  'use strict';

  const VERSION = '1.0';
  const MAXD = 100;          // maximale Verschachtelungstiefe
  const IKEYS = [], QKEYS = [], MKEYS = [];
  for (let b = 0; b < 2; b++) for (let i = 0; i < 8; i++) { IKEYS.push('I' + b + '.' + i); QKEYS.push('Q' + b + '.' + i); }
  for (let b = 0; b < 4; b++) for (let i = 0; i < 8; i++) MKEYS.push('M' + b + '.' + i);

  const isObj = function (x) { return x !== null && typeof x === 'object' && !Array.isArray(x); };
  const nul = function () { return Object.create(null); };

  // ---------------------------------------------------------------- Adressen
  function parseAddr(text) {
    if (typeof text !== 'string') return null;
    let t = text.trim().toUpperCase();
    if (!t) return null;
    let m = /^%?([IQM])X?(\d+)\.(\d)$/.exec(t) || /^([EA])(\d+)\.(\d)$/.exec(t);
    if (m) {
      let c = m[1] === 'E' ? 'I' : m[1] === 'A' ? 'Q' : m[1];
      let by = parseInt(m[2], 10), bi = parseInt(m[3], 10);
      if (bi > 7) return null;
      let maxBy = c === 'M' ? 3 : 1;
      if (by > maxBy) return null;
      return c + by + '.' + bi;
    }
    m = /^(?:T|TON|TOF|TP)(\d+)(?:\.(Q|ET))?$/.exec(t);
    if (m) { let n = parseInt(m[1], 10); if (n < 1 || n > 16 || /^0/.test(m[1])) return null; return 'T' + n + (m[2] ? '.' + m[2] : ''); }
    m = /^(?:C|Z|CTU|CTD)(\d+)(?:\.(Q|CV))?$/.exec(t);
    if (m) { let n = parseInt(m[1], 10); if (n < 1 || n > 16 || /^0/.test(m[1])) return null; return 'C' + n + (m[2] ? '.' + m[2] : ''); }
    return null;
  }

  function normMode(mode) { return (mode === 's7' || mode === 'siemens' || mode === 'S7') ? 's7' : 'iec'; }
  const KIND_S7 = { ton: 'SE', tof: 'SA', tp: 'SI', ctu: 'ZV', ctd: 'ZR' };

  function addr(key, mode, kind) {
    let k = parseAddr(typeof key === 'string' ? key : '');
    if (!k) return String(key);
    const s7 = normMode(mode) === 's7';
    let m = /^([IQM])(\d\.\d)$/.exec(k);
    if (m) {
      if (s7) return (m[1] === 'I' ? 'E' : m[1] === 'Q' ? 'A' : 'M') + m[2];
      return '%' + m[1] + 'X' + m[2];
    }
    m = /^T(\d+)(?:\.(Q|ET))?$/.exec(k);
    if (m) {
      if (m[2] === 'ET') return k;
      if (m[2] === 'Q') return s7 ? 'T' + m[1] : k;
      if (kind && KIND_S7[kind] && /^t/.test(kind)) return s7 ? 'T' + m[1] + ' (' + KIND_S7[kind] + ')' : kind.toUpperCase() + m[1];
      return 'T' + m[1];
    }
    m = /^C(\d+)(?:\.(Q|CV))?$/.exec(k);
    if (m) {
      if (m[2] === 'CV') return s7 ? 'Z' + m[1] + '.CV' : k;
      if (m[2] === 'Q') return s7 ? 'Z' + m[1] : k;
      if (kind && KIND_S7[kind] && /^c/.test(kind)) return s7 ? 'Z' + m[1] + ' (' + KIND_S7[kind] + ')' : kind.toUpperCase() + m[1];
      return s7 ? 'Z' + m[1] : 'C' + m[1];
    }
    return String(key);
  }

  function label(prog, key, mode) {
    const a = addr(key, mode);
    const sy = prog && isObj(prog.symbols) ? prog.symbols[key] : null;
    return typeof sy === 'string' && sy ? sy + ' (' + a + ')' : a;
  }

  // Lese-Schluessel normalisieren: T1 -> T1.Q, C1 -> C1.Q
  function normRead(text, ffq) {
    if (typeof text !== 'string') return null;
    const t = text.trim();
    if (ffq && ffq[t]) return t;
    const k = parseAddr(t);
    if (!k) return null;
    if (/^[TC]\d+$/.test(k)) return k + '.Q';
    return k;
  }

  // ---------------------------------------------------------------- GRAFCET-Bedingungsparser
  function pfmt(msg, pos) { return msg + ' (Position ' + pos + ')'; }
  function perr(msg, pos) { return { pe: true, msg: pfmt(msg, pos), pos: pos }; }

  function lexCond(src) {
    const toks = [];
    let i = 0;
    const n = src.length;
    const WORDS = { AND: 'and', UND: 'and', OR: 'or', ODER: 'or', XOR: 'xor', XODER: 'xor', EXOR: 'xor', NOT: 'not', NICHT: 'not',
      TRUE: 'true', WAHR: 'true', FALSE: 'false', FALSCH: 'false', RE: 're', FE: 'fe' };
    while (i < n) {
      const c = src[i];
      const pos = i + 1;
      if (/\s/.test(c)) { i++; continue; }
      if (c === '(') { toks.push({ k: 'lp', pos: pos, txt: c }); i++; continue; }
      if (c === ')') { toks.push({ k: 'rp', pos: pos, txt: c }); i++; continue; }
      if ((c === 't' || c === 'T') && /^\s*\//.test(src.slice(i + 1))) {
        const m = /^[tT]\s*\/\s*([A-Za-z_][A-Za-z0-9_]*)\s*\/\s*(\d+(?:[.,]\d+)?)\s*(ms|s|min)?(?![A-Za-z0-9_])/i.exec(src.slice(i));
        if (!m) throw perr('Zeitbedingung falsch geschrieben, erwartet wird t/Schritt/Zeit, z. B. t/S1/3s oder t/S1/500ms', pos);
        const mult = { ms: 1, s: 1000, min: 60000 }[(m[3] || 's').toLowerCase()];
        toks.push({ k: 'time', pos: pos, txt: m[0], step: m[1], ms: Math.round(parseFloat(m[2].replace(',', '.')) * mult) });
        i += m[0].length; continue;
      }
      if (c === '&') { i += src[i + 1] === '&' ? 2 : 1; toks.push({ k: 'and', pos: pos, txt: '&' }); continue; }
      if (c === '+') { toks.push({ k: 'or', pos: pos, txt: '+' }); i++; continue; }
      if (c === '|') { i += src[i + 1] === '|' ? 2 : 1; toks.push({ k: 'or', pos: pos, txt: '|' }); continue; }
      if (c === '/' || c === '!') { toks.push({ k: 'not', pos: pos, txt: c }); i++; continue; }
      if (c === '^') { toks.push({ k: 'xor', pos: pos, txt: c }); i++; continue; }
      const m2 = /^[A-Za-z0-9_%][A-Za-z0-9_%.]*/.exec(src.slice(i));
      if (m2) {
        const w = m2[0];
        const up = w.toUpperCase();
        let k = WORDS[up];
        if (!k && w === '1') k = 'true';
        if (!k && w === '0') k = 'false';
        toks.push({ k: k || 'id', pos: pos, txt: w });
        i += w.length; continue;
      }
      throw perr('Unerwartetes Zeichen "' + c + '"', pos);
    }
    return toks;
  }

  // ctx: { stepIds:[...], symbols:{key:name} }
  function parseCondInternal(text, ctx) {
    ctx = ctx || {};
    if (typeof text !== 'string') throw perr('Die Bedingung fehlt', 1);
    const src = text;
    const toks = lexCond(src);
    if (!toks.length) throw perr('Die Bedingung ist leer, schreibe z. B. I0.0 oder true', 1);
    const endPos = src.length + 1;
    const stepUp = nul();
    if (Array.isArray(ctx.stepIds)) ctx.stepIds.forEach(function (s) { stepUp[String(s).toUpperCase()] = String(s); });
    const haveSteps = Array.isArray(ctx.stepIds);
    const symRev = nul();
    if (isObj(ctx.symbols)) Object.keys(ctx.symbols).forEach(function (k) { if (typeof ctx.symbols[k] === 'string') symRev[ctx.symbols[k].toUpperCase()] = k; });
    let p = 0, depth = 0;

    function peek() { return toks[p]; }
    function enter(pos) { if (++depth > MAXD) throw perr('Die Bedingung ist zu tief verschachtelt', pos); }
    function operatorMissing(tok) {
      if (tok.k === 'rp') return perr('Schließende Klammer ")" ohne passende öffnende Klammer', tok.pos);
      const prev = toks[p - 1];
      return perr('Zwischen "' + (prev ? prev.txt : '') + '" und "' + tok.txt + '" fehlt ein Operator (UND, ODER, XOR)', tok.pos);
    }
    function orExpr() {
      enter(peek() ? peek().pos : endPos);
      const parts = [xorExpr()];
      while (peek() && peek().k === 'or') { p++; parts.push(xorExpr()); }
      depth--;
      return parts.length === 1 ? parts[0] : { t: 'or', in: parts };
    }
    function xorExpr() {
      const parts = [andExpr()];
      while (peek() && peek().k === 'xor') { p++; parts.push(andExpr()); }
      return parts.length === 1 ? parts[0] : { t: 'xor', in: parts };
    }
    function andExpr() {
      const parts = [unary()];
      while (peek() && peek().k === 'and') { p++; parts.push(unary()); }
      return parts.length === 1 ? parts[0] : { t: 'and', in: parts };
    }
    function unary() {
      const tok = peek();
      if (tok && tok.k === 'not') { p++; enter(tok.pos); const x = unary(); depth--; return { t: 'not', x: x }; }
      return primary();
    }
    function expectRp(openTok) {
      const tok = peek();
      if (!tok) throw perr('Die schließende Klammer ")" fehlt, die Klammer von Position ' + openTok.pos + ' bleibt offen', endPos);
      if (tok.k !== 'rp') throw operatorMissing(tok);
      p++;
    }
    function primary() {
      const tok = peek();
      if (!tok) throw perr('Hier fehlt ein Operand, die Bedingung endet zu früh', endPos);
      switch (tok.k) {
        case 'lp': { p++; const e = orExpr(); expectRp(tok); return e; }
        case 'true': p++; return { t: 'const', v: true };
        case 'false': p++; return { t: 'const', v: false };
        case 'time':
          p++;
          if (haveSteps && !stepUp[tok.step.toUpperCase()]) throw perr('Zeitbedingung: Schritt "' + tok.step + '" gibt es nicht', tok.pos);
          return { t: 'time', step: haveSteps ? stepUp[tok.step.toUpperCase()] : tok.step, ms: tok.ms };
        case 're': case 'fe': {
          p++;
          const lp = peek();
          if (!lp || lp.k !== 'lp') throw perr('Nach ' + tok.txt.toUpperCase() + ' muss eine Klammer folgen, z. B. ' + tok.txt.toUpperCase() + '(I0.0)', lp ? lp.pos : endPos);
          p++;
          const x = orExpr();
          expectRp(lp);
          return { t: 'edge', mode: tok.k === 're' ? 'P' : 'N', x: x };
        }
        case 'id': {
          p++;
          const up = tok.txt.toUpperCase();
          if (stepUp[up]) return { t: 'step', id: stepUp[up] };
          const k = normRead(tok.txt);
          if (k) return { t: 'key', key: k };
          if (symRev[up]) { const k2 = normRead(symRev[up]); return { t: 'key', key: k2 || symRev[up] }; }
          throw perr('Unbekannter Operand "' + tok.txt + '" (weder Schritt noch Adresse noch Symbol)', tok.pos);
        }
        default:
          throw perr('Hier wird ein Operand erwartet, gefunden wurde "' + tok.txt + '"', tok.pos);
      }
    }
    const ast = orExpr();
    if (p < toks.length) throw operatorMissing(toks[p]);
    return ast;
  }

  function parseCond(text, prog) {
    try {
      const ctx = { symbols: prog && prog.symbols };
      const g = prog && prog.gra;
      if (g && Array.isArray(g.steps)) ctx.stepIds = g.steps.filter(isObj).map(function (s) { return s.id; }).filter(function (s) { return typeof s === 'string'; });
      const ast = parseCondInternal(text, ctx);
      return { ok: true, ast: ast, error: null, pos: 0 };
    } catch (e) {
      if (e && e.pe) return { ok: false, ast: null, error: e.msg, pos: e.pos };
      return { ok: false, ast: null, error: 'Die Bedingung konnte nicht gelesen werden', pos: 1 };
    }
  }

  function fmtMs(ms) { return ms % 1000 === 0 ? (ms / 1000) + 's' : ms + 'ms'; }

  function condToText(ast, mode, opts) {
    const s7 = normMode(mode) === 's7';
    const OP = s7 ? { and: ' UND ', or: ' ODER ', xor: ' XODER ', not: 'NICHT ' } : { and: ' AND ', or: ' OR ', xor: ' XOR ', not: 'NOT ' };
    const prec = { or: 1, xor: 2, and: 3 };
    const fk = function (k) { return opts && opts.prog ? label(opts.prog, k, mode) : addr(k, mode); };
    function r(n, parent) {
      if (!isObj(n)) return '?';
      switch (n.t) {
        case 'const': return n.v ? 'true' : 'false';
        case 'key': return fk(n.key);
        case 'step': return n.id;
        case 'time': return 't/' + n.step + '/' + fmtMs(n.ms);
        case 'edge': return (n.mode === 'P' ? 'RE(' : 'FE(') + r(n.x, 0) + ')';
        case 'not': { const x = n.x; const sub = r(x, 0); return OP.not + (x && (x.t === 'and' || x.t === 'or' || x.t === 'xor') ? '(' + sub + ')' : sub); }
        case 'and': case 'or': case 'xor': {
          const s = (n.in || []).map(function (c) { return r(c, prec[n.t]); }).join(OP[n.t]);
          return parent && parent > prec[n.t] ? '(' + s + ')' : s;
        }
        default: return '?';
      }
    }
    return r(ast, 0);
  }

  // ---------------------------------------------------------------- Kompilierer / Laufzeit
  const FB_KINDS = { ton: 'T', tof: 'T', tp: 'T', ctu: 'C', ctd: 'C', rs: 'F', sr: 'F' };
  const FB_CHILDREN = [['in', '.0'], ['s', '.1'], ['r', '.2'], ['ld', '.3']];

  function create(prog, opts) {
    const plc = { errors: [], warnings: [], errorList: [], ok: false, lang: null };
    const errs = plc.errorList, warns = plc.warnings;
    const inp = nul(), img = nul(), vals = nul(), forced = nul();
    IKEYS.forEach(function (k) { inp[k] = false; img[k] = false; });
    QKEYS.concat(MKEYS).forEach(function (k) { vals[k] = false; });
    const tm = nul(), cn = nul(), ff = nul(), ffq = nul();
    const edgeStates = [];
    const nets = [];
    let cycleMs = 10, cycles = 0, timeMs = 0;
    let gra = null;
    const warnedRead = nul();
    let stepMapTmp = nul();

    function E(msg) { errs.push(msg); }
    function W(msg) { warns.push(msg); }

    function build() {
      let lang = prog.lang;
      if (lang === undefined || lang === null) lang = prog.gra ? 'gra' : 'kop';
      if (lang !== 'kop' && lang !== 'fup' && lang !== 'gra') { E('Unbekannte Programmiersprache "' + lang + '" (erlaubt: kop, fup, gra).'); return; }
      plc.lang = lang;
      if (prog.cycleMs !== undefined) {
        if (typeof prog.cycleMs === 'number' && isFinite(prog.cycleMs) && prog.cycleMs > 0) cycleMs = prog.cycleMs;
        else W('Zykluszeit (cycleMs) ist ungültig, es gelten 10 ms.');
      }
      if (lang === 'gra') buildGra(); else buildNets();
    }

    // ---- Zustandsobjekte lesen
    function makeReader(key) {
      let m;
      if (/^I/.test(key)) return function () { return img[key]; };
      if (/^[QM]/.test(key)) return function () { return vals[key]; };
      if ((m = /^(T\d+)\.(Q|ET)$/.exec(key))) {
        const t = tm[m[1]];
        if (!t) { warnRead(key, 'Zeitglied ' + m[1]); return function () { return false; }; }
        return m[2] === 'Q' ? function () { return t.q; } : function () { return t.et > 0; };
      }
      if ((m = /^(C\d+)\.(Q|CV)$/.exec(key))) {
        const c = cn[m[1]];
        if (!c) { warnRead(key, 'Zähler ' + m[1]); return function () { return false; }; }
        return m[2] === 'Q' ? function () { return c.q; } : function () { return c.cv > 0; };
      }
      if (ffq[key]) { const f = ff[key.slice(0, -2)]; return function () { return f.q; }; }
      return function () { return false; };
    }
    function warnRead(key, what) {
      if (warnedRead[key]) return;
      warnedRead[key] = true;
      W(key + ' wird gelesen, aber ' + what + ' kommt im Programm nicht vor (Wert ist immer 0).');
    }
    function write(key, v) { vals[key] = forced[key] !== undefined ? forced[key] : v; }

    function writableKey(text, where) {
      const k = typeof text === 'string' ? parseAddr(text) : null;
      if (!k) { E('Unbekannte Adresse "' + text + '" bei ' + where + '.'); return null; }
      if (/^I/.test(k)) { E('Der Eingang ' + k + ' kann nicht beschrieben werden (' + where + '), nur Q und M.'); return null; }
      if (!/^[QM]\d\.\d$/.test(k)) { E(k + ' kann nicht beschrieben werden (' + where + '), nur Q und M.'); return null; }
      return k;
    }

    // ---- Funktionsbausteine einsammeln (1. Durchgang)
    function registerFb(node, where) {
      const kind = node.fb;
      const cls = FB_KINDS[kind];
      if (!cls) { E('Unbekannter Baustein "' + kind + '" in ' + where + '.'); return; }
      const raw = node.id;
      let id = null;
      if (cls === 'T') {
        const k = typeof raw === 'string' ? parseAddr(raw) : null;
        if (k && /^T\d+$/.test(k)) id = k;
        else { E('Das Zeitglied in ' + where + ' braucht eine Kennung T1 bis T16 (gefunden: "' + raw + '").'); return; }
        if (tm[id]) { E('Zeitglied ' + id + ' wird zweimal benutzt.'); return; }
        const pt = node.pt;
        if (typeof pt !== 'number' || !isFinite(pt) || pt < 0) E('Zeitglied ' + id + ': Die Zeit (pt) fehlt oder ist ungültig (Millisekunden, mindestens 0).');
        tm[id] = { id: id, kind: kind, pt: typeof pt === 'number' && pt >= 0 ? pt : 0, et: 0, q: false, running: false, prevIn: false, armed: false };
      } else if (cls === 'C') {
        const k = typeof raw === 'string' ? parseAddr(raw) : null;
        if (k && /^C\d+$/.test(k)) id = k;
        else { E('Der Zähler in ' + where + ' braucht eine Kennung C1 bis C16 (gefunden: "' + raw + '").'); return; }
        if (cn[id]) { E('Zähler ' + id + ' wird zweimal benutzt.'); return; }
        const pv = node.pv;
        if (typeof pv !== 'number' || !isFinite(pv) || pv < 0 || Math.floor(pv) !== pv) E('Zähler ' + id + ': Der Vorgabewert (pv) fehlt oder ist keine ganze Zahl ab 0.');
        cn[id] = { id: id, kind: kind, pv: typeof pv === 'number' && pv >= 0 ? Math.floor(pv) : 0, cv: 0, q: false, prevIn: false };
      } else {
        if (typeof raw !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(raw) || parseAddr(raw)) { E('Der Flipflop in ' + where + ' braucht einen Namen wie FF1 (keine Adresse, nur Buchstaben, Ziffern, _), gefunden: "' + raw + '".'); return; }
        id = raw;
        if (ff[id]) { E('Flipflop ' + id + ' wird zweimal benutzt.'); return; }
        ff[id] = { id: id, kind: kind, q: false };
        ffq[id + '.Q'] = true;
      }
    }
    function collectFb(node, where, depth) {
      if (!isObj(node) || depth > MAXD) return;
      if (node.t === 'fb') {
        FB_CHILDREN.forEach(function (c) { if (node[c[0]] !== undefined && node[c[0]] !== null) collectFb(node[c[0]], where, depth + 1); });
        registerFb(node, where);
      } else if (Array.isArray(node.in)) {
        node.in.forEach(function (c) { collectFb(c, where, depth + 1); });
      }
    }

    // ---- KOP / FUP
    function buildNets() {
      if (!Array.isArray(prog.networks)) { E('Das Programm hat keine Netzwerkliste (networks).'); return; }
      const ids = nul();
      const labels = prog.networks.map(function (n, i) { return isObj(n) && typeof n.id === 'string' && n.id ? n.id : 'N' + (i + 1); });
      prog.networks.forEach(function (net, i) {
        if (!isObj(net)) return;
        collectFb(net.expr, 'Netzwerk ' + labels[i], 0);
      });
      const writers = nul();   // key -> [{net, kind}]
      prog.networks.forEach(function (net, ni) {
        const nid = labels[ni];
        const where = 'Netzwerk ' + nid;
        if (!isObj(net)) { E(where + ' ist ungültig (kein Objekt).'); return; }
        if (ids[nid]) E('Netzwerk-Kennung "' + nid + '" kommt zweimal vor.');
        ids[nid] = true;
        const pw = { power: false, nodes: {}, outs: [] };
        let ev;
        if (net.expr === undefined || net.expr === null) {
          W(where + ' ist leer (kein Ausdruck), der Wert gilt als 0.');
          ev = function () { return false; };
        } else {
          ev = compNode(net.expr, 'n0', pw.nodes, where, 0);
        }
        const outs = [];
        if (!Array.isArray(net.outs) || !net.outs.length) {
          if (!Array.isArray(net.outs) && net.outs !== undefined) E(where + ': "outs" muss eine Liste sein.');
          else W(where + ' hat keinen Ausgang (Spule).');
        } else {
          net.outs.forEach(function (o, oi) {
            if (!isObj(o)) { E(where + ': Ausgang ' + (oi + 1) + ' ist ungültig.'); return; }
            if (o.t !== 'coil' && o.t !== 'set' && o.t !== 'reset') { E(where + ': Unbekannter Ausgangstyp "' + o.t + '" (erlaubt: coil, set, reset).'); return; }
            const key = writableKey(o.a, where);
            if (!key) return;
            outs.push({ t: o.t, key: key, neg: !!o.neg });
            (writers[key] = writers[key] || []).push({ net: ni, kind: o.t });
            pw.outs.push(false);
          });
        }
        nets.push({ id: nid, ev: ev, outs: outs, pw: pw });
      });
      Object.keys(writers).forEach(function (key) {
        const w = writers[key];
        const coils = w.filter(function (x) { return x.kind === 'coil'; });
        const sr = w.filter(function (x) { return x.kind !== 'coil'; });
        if (coils.length > 1) W('Doppelte Zuweisung auf ' + key + ' (mehrere Spulen, nur die letzte gilt im Zyklus).');
        else if (coils.length && sr.length) W(key + ' wird mit Spule und mit Setzen/Rücksetzen beschrieben, das Ergebnis hängt von der Reihenfolge ab.');
      });
    }

    function compNode(node, path, nodes, where, depth) {
      nodes[path] = false;
      if (depth > MAXD) { E(where + ' ist zu tief verschachtelt.'); return function () { return false; }; }
      if (!isObj(node)) { E(where + ': Ungültiger Ausdruck bei ' + path + '.'); return function () { return false; }; }
      const bad = function (msg) { E(where + ': ' + msg); return function () { return false; }; };
      switch (node.t) {
        case 'var': {
          const key = normRead(node.a, ffq);
          if (!key) return bad('Unbekannte Adresse "' + node.a + '".');
          const rd = makeReader(key), neg = !!node.neg;
          return function () { const v = neg ? !rd() : rd(); nodes[path] = v; return v; };
        }
        case 'edge': {
          const key = normRead(node.a, ffq);
          if (!key) return bad('Unbekannte Adresse "' + node.a + '" bei Flanke.');
          if (node.mode !== 'P' && node.mode !== 'N') return bad('Flanke braucht mode "P" oder "N".');
          const rd = makeReader(key), st = { prev: false }, rising = node.mode === 'P';
          edgeStates.push(st);
          return function () {
            const c = rd();
            const r = rising ? (c && !st.prev) : (!c && st.prev);
            st.prev = c; nodes[path] = r; return r;
          };
        }
        case 'const': { const v = !!node.v; return function () { nodes[path] = v; return v; }; }
        case 'and': case 'or': case 'xor': {
          if (!Array.isArray(node.in) || !node.in.length) return bad('Das Gatter ' + node.t.toUpperCase() + ' hat keine Eingänge.');
          const cs = node.in.map(function (c, i) { return compNode(c, path + '.' + i, nodes, where, depth + 1); });
          const neg = !!node.neg, n = cs.length, t = node.t;
          return function () {
            let r;
            if (t === 'and') { r = true; for (let i = 0; i < n; i++) if (!cs[i]()) r = false; }
            else if (t === 'or') { r = false; for (let i = 0; i < n; i++) if (cs[i]()) r = true; }
            else { let c = 0; for (let i = 0; i < n; i++) if (cs[i]()) c++; r = (c % 2) === 1; }
            if (neg) r = !r;
            nodes[path] = r; return r;
          };
        }
        case 'fb': return compFb(node, path, nodes, where, depth);
        default: return bad('Unbekannter Knotentyp "' + node.t + '".');
      }
    }

    function compFb(node, path, nodes, where, depth) {
      const kind = node.fb, cls = FB_KINDS[kind];
      const sub = {};
      FB_CHILDREN.forEach(function (c) {
        const ch = node[c[0]];
        if (ch !== undefined && ch !== null) sub[c[0]] = compNode(ch, path + c[1], nodes, where, depth + 1);
      });
      const neg = !!node.neg;
      const F = function () { return false; };
      const call = function (n) { return sub[n] ? !!sub[n]() : false; };
      let state, qkey;
      if (cls === 'T') {
        const id = typeof node.id === 'string' ? parseAddr(node.id) : null;
        state = id && tm[id];
        if (!state) return function () { nodes[path] = false; return false; };
        if (!sub.in) E(where + ': Zeitglied ' + id + ' hat keinen Eingang (in).');
        qkey = id + '.Q';
        return function () {
          const inv = call('in'), dt = curDt, pt = state.pt;
          if (kind === 'ton') {
            if (inv) { state.et = Math.min(pt, state.et + dt); state.q = state.et >= pt; state.running = !state.q; }
            else { state.et = 0; state.q = false; state.running = false; }
          } else if (kind === 'tof') {
            if (inv) { state.q = true; state.et = 0; state.armed = false; state.running = false; }
            else {
              if (state.prevIn) { state.armed = true; state.et = 0; }
              else if (state.armed) state.et = Math.min(pt, state.et + dt);
              if (state.armed && state.et < pt) { state.q = true; state.running = true; }
              else { state.q = false; state.armed = false; state.running = false; }
            }
          } else { // tp
            if (state.running) {
              state.et = Math.min(pt, state.et + dt);
              if (state.et >= pt) { state.running = false; state.q = false; }
              else state.q = true;
            } else if (inv && !state.prevIn) {
              state.et = 0;
              if (pt > 0) { state.running = true; state.q = true; } else state.q = false;
            } else state.q = false;
          }
          state.prevIn = inv;
          if (forced[qkey] !== undefined) state.q = forced[qkey];
          const r = neg ? !state.q : state.q;
          nodes[path] = r; return r;
        };
      }
      if (cls === 'C') {
        const id = typeof node.id === 'string' ? parseAddr(node.id) : null;
        state = id && cn[id];
        if (!state) return function () { nodes[path] = false; return false; };
        if (!sub.in) E(where + ': Zähler ' + id + ' hat keinen Eingang (in).');
        qkey = id + '.Q';
        return function () {
          const inv = call('in'), rv = call('r'), ld = call('ld');
          const edge = inv && !state.prevIn;
          if (kind === 'ctu') {
            if (rv) state.cv = 0; else if (edge && state.cv < 999) state.cv++;
            state.q = state.cv >= state.pv;
          } else {
            if (ld) state.cv = state.pv; else if (edge && state.cv > 0) state.cv--;
            state.q = state.cv <= 0;
          }
          state.prevIn = inv;
          if (forced[qkey] !== undefined) state.q = forced[qkey];
          const r = neg ? !state.q : state.q;
          nodes[path] = r; return r;
        };
      }
      // rs / sr
      state = typeof node.id === 'string' ? ff[node.id] : null;
      if (!state) return function () { nodes[path] = false; return false; };
      qkey = node.id + '.Q';
      return function () {
        const s = call('s'), r = call('r');
        if (kind === 'rs') state.q = (state.q || s) && !r;
        else state.q = s || (state.q && !r);
        if (forced[qkey] !== undefined) state.q = forced[qkey];
        const res = neg ? !state.q : state.q;
        nodes[path] = res; return res;
      };
    }

    // ---- GRAFCET
    function buildGra() {
      const g = prog.gra;
      if (!isObj(g) || !Array.isArray(g.steps) || !Array.isArray(g.transitions)) { E('GRAFCET braucht gra.steps und gra.transitions (Listen).'); return; }
      const stepById = nul(), steps = [];
      const actKeys = [], actIdx = nul();
      g.steps.forEach(function (s, i) {
        if (!isObj(s) || typeof s.id !== 'string' || !s.id) { E('Schritt ' + (i + 1) + ' hat keine gültige Kennung (id).'); return; }
        if (stepById[s.id]) { E('Schritt ' + s.id + ' kommt zweimal vor.'); return; }
        const st = { id: s.id, init: !!s.init, active: false, time: 0, fresh: false, acts: [] };
        if (s.actions !== undefined && !Array.isArray(s.actions)) E('Schritt ' + s.id + ': "actions" muss eine Liste sein.');
        (Array.isArray(s.actions) ? s.actions : []).forEach(function (a, ai) {
          const w = 'Schritt ' + s.id + ', Aktion ' + (ai + 1);
          if (!isObj(a)) { E(w + ' ist ungültig.'); return; }
          const q = typeof a.q === 'string' ? a.q.toUpperCase() : '';
          if (['N', 'S', 'R', 'D', 'L'].indexOf(q) < 0) { E(w + ': Unbekannter Aktionstyp "' + a.q + '" (erlaubt: N, S, R, D, L).'); return; }
          const key = writableKey(a.a, w);
          if (!key) return;
          let t = 0;
          if (q === 'D' || q === 'L') {
            if (typeof a.t !== 'number' || !isFinite(a.t) || a.t < 0) { E(w + ': Aktion ' + q + ' braucht eine Zeit t in Millisekunden (mindestens 0).'); return; }
            t = a.t;
          }
          if (actIdx[key] === undefined) { actIdx[key] = actKeys.length; actKeys.push(key); }
          st.acts.push({ q: q, key: key, t: t, idx: actIdx[key] });
        });
        stepById[s.id] = st; steps.push(st);
      });
      if (!steps.length) { E('Das GRAFCET hat keine Schritte.'); }
      else if (!steps.some(function (s) { return s.init; })) E('Das GRAFCET braucht mindestens einen Initialschritt (init:true).');
      stepMapTmp = stepById;
      const stepUp = nul();
      steps.forEach(function (s) { stepUp[s.id.toUpperCase()] = s.id; });
      const trs = [];
      const hasOut = nul(), hasIn = nul();
      const tids = nul();
      g.transitions.forEach(function (t, i) {
        const tid = isObj(t) && typeof t.id === 'string' && t.id ? t.id : 'Transition ' + (i + 1);
        const w = 'Transition ' + tid;
        if (!isObj(t)) { E(w + ' ist ungültig.'); return; }
        if (tids[tid]) E('Transition ' + tid + ' kommt zweimal vor.'); tids[tid] = true;
        const lst = function (x) { return typeof x === 'string' ? [x] : x; };
        const from = lst(t.from), to = lst(t.to);
        let ok = true;
        [['from', from, 'Quelle'], ['to', to, 'Ziel']].forEach(function (e) {
          if (!Array.isArray(e[1]) || !e[1].length) { E(w + ' hat kein ' + e[2] + ' (' + e[0] + ' braucht mindestens einen Schritt).'); ok = false; return; }
          e[1].forEach(function (id) { if (!stepById[id]) { E(w + ': Schritt "' + id + '" (' + e[2] + ') gibt es nicht.'); ok = false; } });
        });
        if (typeof t.cond !== 'string' || !t.cond.trim()) { E(w + ' hat keine Bedingung (schreibe true, wenn sie immer gelten soll).'); ok = false; }
        let cond = null;
        if (typeof t.cond === 'string' && t.cond.trim()) {
          try { cond = parseCondInternal(t.cond, { stepIds: steps.map(function (s) { return s.id; }), symbols: prog.symbols }); }
          catch (e) { E(w + ': Fehler in der Bedingung "' + t.cond + '": ' + (e && e.pe ? e.msg : 'nicht lesbar') + '.'); ok = false; }
        }
        if (!ok) return;
        from.forEach(function (id) { hasOut[id] = true; });
        to.forEach(function (id) { hasIn[id] = true; });
        trs.push({ id: tid, from: from.map(function (id) { return stepById[id]; }), to: to.map(function (id) { return stepById[id]; }), ev: compCond(cond, 0), en: false });
      });
      if (!errs.length) {
        steps.forEach(function (s) {
          if (!hasOut[s.id]) W('Schritt ' + s.id + ' hat keine Transition nach außen (Sackgasse).');
          if (!s.init && !hasIn[s.id]) W('Schritt ' + s.id + ' wird nie erreicht (keine Transition führt hinein).');
        });
      }
      const st = nul();   // gespeicherte Werte (S/R)
      actKeys.forEach(function (k) { st[k] = false; });
      const nOn = new Array(actKeys.length);
      gra = { steps: steps, trs: trs, st: st, actKeys: actKeys, nOn: nOn, stepById: stepById };
    }

    function compCond(ast, depth) {
      if (depth > MAXD) { E('Eine Bedingung ist zu tief verschachtelt.'); return function () { return false; }; }
      switch (ast.t) {
        case 'const': { const v = ast.v; return function () { return v; }; }
        case 'key': return makeReader(ast.key);
        case 'step': { const s = stepMapTmp[ast.id]; return function () { return s.active; }; }
        case 'time': { const s = stepMapTmp[ast.step], ms = ast.ms; return function () { return s.active && s.time >= ms; }; }
        case 'not': { const f = compCond(ast.x, depth + 1); return function () { return !f(); }; }
        case 'and': case 'or': case 'xor': {
          const fs = ast.in.map(function (c) { return compCond(c, depth + 1); }), n = fs.length, t = ast.t;
          return function () {
            if (t === 'and') { let r = true; for (let i = 0; i < n; i++) if (!fs[i]()) r = false; return r; }
            if (t === 'or') { let r = false; for (let i = 0; i < n; i++) if (fs[i]()) r = true; return r; }
            let c = 0; for (let i = 0; i < n; i++) if (fs[i]()) c++; return c % 2 === 1;
          };
        }
        case 'edge': {
          const f = compCond(ast.x, depth + 1), s = { prev: false }, rising = ast.mode === 'P';
          edgeStates.push(s);
          return function () { const c = f(); const r = rising ? (c && !s.prev) : (!c && s.prev); s.prev = c; return r; };
        }
        default: return function () { return false; };
      }
    }
    // ---- Laufzeit
    let curDt = 10;

    function resetAll() {
      IKEYS.forEach(function (k) { img[k] = false; });
      QKEYS.concat(MKEYS).forEach(function (k) { vals[k] = false; });
      Object.keys(tm).forEach(function (id) { const t = tm[id]; t.et = 0; t.q = false; t.running = false; t.prevIn = false; t.armed = false; });
      Object.keys(cn).forEach(function (id) { const c = cn[id]; c.cv = 0; c.q = false; c.prevIn = false; });
      Object.keys(ff).forEach(function (id) { ff[id].q = false; });
      edgeStates.forEach(function (s) { s.prev = false; });
      nets.forEach(function (n) { n.pw.power = false; Object.keys(n.pw.nodes).forEach(function (p) { n.pw.nodes[p] = false; }); n.pw.outs = n.pw.outs.map(function () { return false; }); });
      if (gra) {
        gra.steps.forEach(function (s) { s.active = s.init; s.time = 0; s.fresh = s.init; });
        gra.actKeys.forEach(function (k) { gra.st[k] = false; });
      }
      cycles = 0; timeMs = 0;
      applyForcedVals();
    }
    function applyForcedVals() {
      for (const k in forced) if (/^[QM]/.test(k)) vals[k] = forced[k];
    }

    function scanNets() {
      for (let i = 0; i < nets.length; i++) {
        const n = nets[i];
        const p = n.ev();
        n.pw.power = p;
        for (let j = 0; j < n.outs.length; j++) {
          const o = n.outs[j];
          if (o.t === 'coil') { const v = o.neg ? !p : p; write(o.key, v); n.pw.outs[j] = v; }
          else if (o.t === 'set') { if (p) write(o.key, true); n.pw.outs[j] = vals[o.key]; }
          else { if (p) write(o.key, false); n.pw.outs[j] = vals[o.key]; }
        }
      }
    }

    function scanGra(dt) {
      const steps = gra.steps, trs = gra.trs;
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        if (s.active) { if (s.fresh) s.fresh = false; else s.time += dt; }
      }
      for (let i = 0; i < trs.length; i++) {
        const t = trs[i];
        let en = t.ev();
        if (en) for (let j = 0; j < t.from.length; j++) if (!t.from[j].active) { en = false; break; }
        t.en = en;
      }
      const consumed = [], fired = [];
      for (let i = 0; i < trs.length; i++) {
        const t = trs[i];
        if (!t.en) continue;
        let clash = false;
        for (let j = 0; j < t.from.length; j++) if (consumed.indexOf(t.from[j]) >= 0) { clash = true; break; }
        if (clash) continue;
        for (let j = 0; j < t.from.length; j++) consumed.push(t.from[j]);
        fired.push(t);
      }
      for (let i = 0; i < fired.length; i++) for (let j = 0; j < fired[i].from.length; j++) fired[i].from[j].active = false;
      for (let i = 0; i < fired.length; i++) for (let j = 0; j < fired[i].to.length; j++) { const s = fired[i].to[j]; s.active = true; s.time = 0; s.fresh = false; }
      const nOn = gra.nOn, ak = gra.actKeys, st = gra.st;
      for (let i = 0; i < nOn.length; i++) nOn[i] = false;
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        if (!s.active) continue;
        for (let j = 0; j < s.acts.length; j++) {
          const a = s.acts[j];
          switch (a.q) {
            case 'N': nOn[a.idx] = true; break;
            case 'S': st[a.key] = true; break;
            case 'R': st[a.key] = false; break;
            case 'D': if (s.time >= a.t) nOn[a.idx] = true; break;
            case 'L': if (s.time < a.t) nOn[a.idx] = true; break;
          }
        }
      }
      for (let i = 0; i < ak.length; i++) write(ak[i], st[ak[i]] || nOn[i]);
    }

    // ---- oeffentliche API
    plc.setInput = function (key, v) {
      const k = parseAddr(key);
      if (!k || !/^I\d\.\d$/.test(k)) return false;
      inp[k] = !!v; return true;
    };
    plc.getInput = function (key) {
      const k = parseAddr(key);
      if (!k || !/^I\d\.\d$/.test(k)) return false;
      return forced[k] !== undefined ? forced[k] : inp[k];
    };
    plc.getOutput = function (key) {
      const k = parseAddr(key);
      return k && /^Q\d\.\d$/.test(k) ? vals[k] : false;
    };
    plc.getMarker = function (key) {
      const k = parseAddr(key);
      return k && /^M\d\.\d$/.test(k) ? vals[k] : false;
    };
    plc.scan = function (dtMs) {
      if (!plc.ok) return false;
      let dt = typeof dtMs === 'number' ? dtMs : Number(dtMs);
      if (dtMs === undefined || dtMs === null || !isFinite(dt) || dt < 0) dt = cycleMs;
      curDt = dt;
      timeMs += dt; cycles++;
      for (let i = 0; i < IKEYS.length; i++) { const k = IKEYS[i]; img[k] = forced[k] !== undefined ? forced[k] : inp[k]; }
      if (gra) scanGra(dt); else scanNets();
      applyForcedVals();
      return true;
    };
    plc.state = function () {
      const I = {}, Q = {}, M = {}, T = {}, C = {}, F = {};
      IKEYS.forEach(function (k) { I[k] = forced[k] !== undefined ? forced[k] : inp[k]; });
      QKEYS.forEach(function (k) { Q[k] = vals[k]; });
      MKEYS.forEach(function (k) { M[k] = vals[k]; });
      Object.keys(tm).forEach(function (id) { const t = tm[id]; T[id] = { q: t.q, et: t.et, pt: t.pt, running: t.running }; });
      Object.keys(cn).forEach(function (id) { const c = cn[id]; C[id] = { q: c.q, cv: c.cv, pv: c.pv }; });
      Object.keys(ff).forEach(function (id) { F[id] = { q: ff[id].q }; });
      const steps = [], stepTimes = {};
      if (gra) gra.steps.forEach(function (s) { if (s.active) { steps.push(s.id); stepTimes[s.id] = s.time; } });
      const fo = {}; for (const k in forced) fo[k] = forced[k];
      return { I: I, Q: Q, M: M, T: T, C: C, F: F, steps: steps, stepTimes: stepTimes, cycles: cycles, timeMs: timeMs, forced: fo };
    };
    plc.reset = function () { if (plc.ok || !errs.length) resetAll(); };
    plc.force = function (key, v) {
      let k = null;
      if (typeof key === 'string') k = ffq[key.trim()] ? key.trim() : normRead(key, ffq);
      if (!k || (!/^[IQM]\d\.\d$/.test(k) && !/^(T|C)\d+\.Q$/.test(k) && !ffq[k])) return false;
      if (v === null || v === undefined) { delete forced[k]; return true; }
      forced[k] = !!v;
      if (/^[QM]/.test(k)) vals[k] = !!v;
      return true;
    };
    plc.power = function () {
      const out = {};
      nets.forEach(function (n) { out[n.id] = n.pw; });
      Object.defineProperty(out, 'networks', { value: out, enumerable: false });
      return out;
    };

    try {
      if (!isObj(prog)) { E('Das Programm fehlt oder ist kein Objekt.'); }
      else build();
    } catch (e) {
      if (e instanceof RangeError) E('Das Programm ist zu tief verschachtelt oder enthält einen Zirkelbezug.');
      else E('Interner Fehler beim Prüfen des Programms: ' + (e && e.message ? e.message : e));
    }

    plc.ok = !errs.length;
    plc.errors = errs.concat(warns);
    if (plc.ok) resetAll();
    return plc;
  }

  function validate(prog) {
    const p = create(prog);
    return { ok: p.ok, errors: p.errorList.slice(), warnings: p.warnings.slice() };
  }

  // ---------------------------------------------------------------- toText
  function toText(prog, mode, opts) {
    try {
      mode = normMode(mode);
      if (!isObj(prog)) return '; Kein Programm vorhanden.';
      const lang = prog.lang || (prog.gra ? 'gra' : 'kop');
      return lang === 'gra' ? graToText(prog, mode, opts) : awlToText(prog, mode, opts);
    } catch (e) {
      return '; Das Programm kann nicht als Text angezeigt werden (' + (e && e.message ? e.message : e) + ').';
    }
  }

  function awlToText(prog, mode, opts) {
    const s7 = mode === 's7';
    const fk = function (k) { return opts && opts.symbols ? label(prog, k, mode) : addr(k, mode); };
    const lines = [];
    const pad = function (op) { return (op + '     ').slice(0, Math.max(5, op.length + 1)); };
    function mn(kind, neg) {
      const M7 = { ld: ['U', 'UN'], and: ['U', 'UN'], or: ['O', 'ON'], xor: ['X', 'XN'] };
      const MI = { ld: ['LD', 'LDN'], and: ['AND', 'ANDN'], or: ['OR', 'ORN'], xor: ['XOR', 'XORN'] };
      return (s7 ? M7 : MI)[kind][neg ? 1 : 0];
    }
    function operandText(n) {
      if (n.t === 'var') return fk(n.a);
      if (n.t === 'edge') return s7 ? (n.mode === 'P' ? 'P(' : 'N(') + fk(n.a) + ')' : (n.mode === 'P' ? 'R_TRIG(' : 'F_TRIG(') + fk(n.a) + ')';
      if (n.t === 'const') return n.v ? 'TRUE' : 'FALSE';
      if (n.t === 'fb') return fbQ(n);
      return '?';
    }
    function fbQ(n) { return fbRef(n) + (FB_KINDS[n.fb] === 'F' ? '.Q' : ''); }
    function fbRef(n) {
      const cls = FB_KINDS[n.fb];
      if (cls === 'F') return String(n.id);
      if (cls === 'T') return s7 ? addr(n.id, 's7') : addr(n.id, 'iec', n.fb);
      if (cls === 'C') return s7 ? addr(n.id, 's7') : addr(n.id, 'iec', n.fb);
      return String(n.id);
    }
    const isOperand = function (n) { return n.t === 'var' || n.t === 'edge' || n.t === 'const' || n.t === 'fb'; };
    const neg = function (n) { return !!(n && n.neg); };
    function emit(op, arg, ind) { lines.push('  '.repeat(ind) + (arg === undefined ? op : pad(op) + arg)); }

    function chain(node, ind) {   // gibt den Ausdruck als Ladezeile + Verknuepfungen aus (ohne aeussere Klammer)
      if (isOperand(node)) { emit(mn('ld', neg(node)), operandText(node), ind); if (node.t === 'fb') return; return; }
      const kids = node.in || [];
      kids.forEach(function (c, i) { child(c, i === 0 ? 'ld' : node.t, node.t, ind); });
    }
    function child(c, kind, parentOp, ind) {
      if (isOperand(c)) { emit(mn(kind, neg(c)), operandText(c), ind); return; }
      const same = c.t === parentOp && !c.neg && kind !== 'ld';
      if (same || (kind === 'ld' && c.t === parentOp && !c.neg)) { (c.in || []).forEach(function (cc, i) { child(cc, i === 0 ? kind : c.t, c.t, ind); }); return; }
      emit(mn(kind, neg(c)) + '(', undefined, ind);
      chain(Object.assign({}, c, { neg: false }), ind + 1);
      emit(')', undefined, ind);
    }
    function hoist(node, acc) {
      if (!isObj(node)) return;
      if (node.t === 'fb') { FB_CHILDREN.forEach(function (c) { if (node[c[0]]) hoist(node[c[0]], acc); }); acc.push(node); }
      else if (Array.isArray(node.in)) node.in.forEach(function (c) { hoist(c, acc); });
    }
    function subExpr(node, ind) {   // Ausdruck laden, der als einzelner RLO dient
      if (!isObj(node)) { emit('// (leer)', undefined, ind); return false; }
      if (isOperand(node)) { emit(mn('ld', neg(node)), operandText(node), ind); return true; }
      chain(Object.assign({}, node, { neg: false }), ind);
      if (node.neg) emit('NOT', undefined, ind);
      return true;
    }
    function emitFb(n) {
      const kind = n.fb, ref = fbRef(n);
      if (FB_KINDS[kind] === 'T') {
        const pt = Number(n.pt) || 0;
        if (s7) {
          if (n.in) subExpr(n.in, 0);
          emit('L', 'T#' + pt + 'MS', 0);
          emit({ ton: 'SE', tof: 'SA', tp: 'SI' }[kind], addr(n.id, 's7'), 0);
        } else {
          if (n.in) subExpr(n.in, 0);
          emit('ST', ref + '.IN', 0);
          emit('CAL', ref + '(PT := T#' + pt + 'MS)', 0);
        }
      } else if (FB_KINDS[kind] === 'C') {
        const cnt = addr(n.id, 's7');
        if (s7) {
          if (n.in) subExpr(n.in, 0);
          emit(kind === 'ctu' ? 'ZV' : 'ZR', cnt, 0);
          if (kind === 'ctu' && n.r) { subExpr(n.r, 0); emit('R', cnt, 0); }
          if (kind === 'ctd' && n.ld) { subExpr(n.ld, 0); emit('L', 'C#' + (Number(n.pv) || 0), 0); emit('S', cnt, 0); }
          lines.push('// Vorgabewert PV = ' + (Number(n.pv) || 0));
        } else {
          if (n.in) subExpr(n.in, 0);
          emit('ST', ref + (kind === 'ctu' ? '.CU' : '.CD'), 0);
          if (kind === 'ctu' && n.r) { subExpr(n.r, 0); emit('ST', ref + '.R', 0); }
          if (kind === 'ctd' && n.ld) { subExpr(n.ld, 0); emit('ST', ref + '.LD', 0); }
          emit('CAL', ref + '(PV := ' + (Number(n.pv) || 0) + ')', 0);
        }
      } else {
        const sName = kind === 'rs' ? 'S' : 'S1', rName = kind === 'rs' ? 'R1' : 'R';
        if (s7) {
          const sFirst = kind === 'sr';
          const doS = function () { if (n.s) { subExpr(n.s, 0); emit('S', ref, 0); } };
          const doR = function () { if (n.r) { subExpr(n.r, 0); emit('R', ref, 0); } };
          if (kind === 'sr') { doR(); doS(); } else { doS(); doR(); }
          void sFirst;
        } else {
          if (n.s) { subExpr(n.s, 0); emit('ST', ref + '.' + (kind === 'rs' ? 'S' : 'S1'), 0); }
          if (n.r) { subExpr(n.r, 0); emit('ST', ref + '.' + rName, 0); }
          emit('CAL', ref, 0);
          void sName;
        }
      }
    }

    const nets = Array.isArray(prog.networks) ? prog.networks : [];
    lines.push('// ' + (s7 ? 'Siemens-AWL' : 'IEC-Anweisungsliste (IL)') + (prog.lang === 'fup' ? ' (aus FUP)' : ''));
    nets.forEach(function (net, i) {
      if (!isObj(net)) return;
      lines.push('');
      lines.push('// Netzwerk ' + (i + 1) + (net.title ? ': ' + net.title : '') + (typeof net.id === 'string' && net.id ? ' [' + net.id + ']' : ''));
      const fbs = []; hoist(net.expr, fbs);
      fbs.forEach(emitFb);
      // Ausdruck mit durch Q ersetzten Bausteinen: fb-Knoten gelten als Operand (operandText -> fbQ)
      subExpr(net.expr, 0);
      const outs = Array.isArray(net.outs) ? net.outs : [];
      outs.forEach(function (o, oi) {
        if (!isObj(o)) return;
        const a = fk(o.a);
        if (o.t === 'coil') {
          if (o.neg) { if (s7) { emit('NOT', undefined, 0); emit('=', a, 0); if (oi < outs.length - 1) emit('NOT', undefined, 0); } else emit('STN', a, 0); }
          else emit(s7 ? '=' : 'ST', a, 0);
        } else if (o.t === 'set') emit('S', a, 0);
        else if (o.t === 'reset') emit('R', a, 0);
      });
    });
    return lines.join('\n');
  }

  function graToText(prog, mode, opts) {
    const g = isObj(prog.gra) ? prog.gra : {};
    const fk = function (k) { return opts && opts.symbols ? label(prog, k, mode) : addr(k, mode); };
    const lines = ['// GRAFCET (' + (mode === 's7' ? 'Siemens-Schreibweise' : 'IEC-Schreibweise') + ')'];
    const names = { N: 'N (nicht gespeichert)', S: 'S (setzen, gespeichert)', R: 'R (rücksetzen)', D: 'D (verzögert)', L: 'L (zeitbegrenzt)' };
    (Array.isArray(g.steps) ? g.steps : []).forEach(function (s) {
      if (!isObj(s)) return;
      lines.push('');
      lines.push('Schritt ' + s.id + (s.init ? ' [Anfangsschritt]' : '') + (s.title ? ' - ' + s.title : ''));
      (Array.isArray(s.actions) ? s.actions : []).forEach(function (a) {
        if (!isObj(a)) return;
        const q = String(a.q).toUpperCase();
        lines.push('    ' + (names[q] || q) + ' ' + fk(a.a) + ((q === 'D' || q === 'L') ? ', t = ' + fmtMs(Number(a.t) || 0) : ''));
      });
    });
    lines.push('');
    (Array.isArray(g.transitions) ? g.transitions : []).forEach(function (t) {
      if (!isObj(t)) return;
      const lst = function (x) { return Array.isArray(x) ? x.join(' + ') : String(x); };
      const r = parseCond(t.cond, prog);
      lines.push('Transition ' + t.id + ': ' + lst(t.from) + ' -> ' + lst(t.to) + '  wenn  ' + (r.ok ? condToText(r.ast, mode, opts && opts.symbols ? { prog: prog } : null) : String(t.cond)));
    });
    return lines.join('\n');
  }

  // ---------------------------------------------------------------- Beispiele
  const V = function (a, neg) { return neg ? { t: 'var', a: a, neg: true } : { t: 'var', a: a }; };
  const exampleProgs = [
    { id: 'selbsthaltung', name: 'Selbsthaltung (Motor Start/Stopp)', plant: 'foerderband',
      desc: 'Start-Taster schaltet ein, der Öffner-Stopp-Taster schaltet aus; Q0.0 hält sich selbst.',
      prog: { lang: 'kop', symbols: { 'I0.0': 'S1_Start', 'I0.1': 'S2_Stopp', 'Q0.0': 'K1_Band' },
        networks: [{ id: 'N1', title: 'Selbsthaltung', expr: { t: 'and', in: [{ t: 'or', in: [V('I0.0'), V('Q0.0')] }, V('I0.1')] }, outs: [{ t: 'coil', a: 'Q0.0' }] }] } },
    { id: 'blinker', name: 'Blinker mit zwei Einschaltverzögerungen', plant: 'ampel',
      desc: 'T1 und T2 schalten sich gegenseitig; Q0.0 blinkt, solange I0.0 gesetzt ist (Periode ca. 1 s).',
      prog: { lang: 'kop', symbols: { 'I0.0': 'S1_Ein', 'Q0.0': 'H1_Blinker' },
        networks: [
          { id: 'N1', title: 'Pause (T1)', expr: { t: 'fb', fb: 'ton', id: 'T1', pt: 500, in: { t: 'and', in: [V('I0.0'), V('T2.Q', true)] } }, outs: [{ t: 'coil', a: 'Q0.0' }] },
          { id: 'N2', title: 'Impuls (T2)', expr: { t: 'fb', fb: 'ton', id: 'T2', pt: 500, in: V('T1.Q') }, outs: [] }] } },
    { id: 'zaehler', name: 'Aufwärtszähler bis 5', plant: 'foerderband',
      desc: 'Jede steigende Flanke an I0.2 zählt +1; bei 5 geht Q0.0 an, I0.1 setzt den Zähler zurück.',
      prog: { lang: 'kop', symbols: { 'I0.2': 'B1_Lichtschranke', 'I0.1': 'S2_Reset', 'Q0.0': 'H1_Voll' },
        networks: [{ id: 'N1', title: 'Zählen', expr: { t: 'fb', fb: 'ctu', id: 'C1', pv: 5, in: V('I0.2'), r: V('I0.1', true) }, outs: [{ t: 'coil', a: 'Q0.0' }] }] } },
    { id: 'treppenlicht', name: 'Treppenlicht (Impuls TP)', plant: 'garagentor',
      desc: 'Ein Tastendruck startet 3 Sekunden Licht, unabhängig davon, wie lange gedrückt wird.',
      prog: { lang: 'fup', symbols: { 'I0.0': 'S1_Taster', 'Q0.3': 'H2_Licht' },
        networks: [{ id: 'N1', title: 'Impuls', expr: { t: 'fb', fb: 'tp', id: 'T1', pt: 3000, in: V('I0.0') }, outs: [{ t: 'coil', a: 'Q0.3' }] }] } },
    { id: 'gra-zeit', name: 'Zeit-Sequenz als GRAFCET', plant: 'ampel',
      desc: 'Start mit I0.0, dann Q0.0 2 s, Q0.1 1 s, Q0.2 1 s und zurück zur Grundstellung.',
      prog: { lang: 'gra', symbols: { 'I0.0': 'S1_Start', 'Q0.0': 'H1', 'Q0.1': 'H2', 'Q0.2': 'H3' },
        gra: {
          steps: [
            { id: 'S0', init: true, title: 'Grundstellung', actions: [] },
            { id: 'S1', title: 'Phase 1', actions: [{ q: 'N', a: 'Q0.0' }] },
            { id: 'S2', title: 'Phase 2', actions: [{ q: 'N', a: 'Q0.1' }] },
            { id: 'S3', title: 'Phase 3', actions: [{ q: 'N', a: 'Q0.2' }] }],
          transitions: [
            { id: 'T1', from: ['S0'], to: ['S1'], cond: 'I0.0' },
            { id: 'T2', from: ['S1'], to: ['S2'], cond: 't/S1/2s' },
            { id: 'T3', from: ['S2'], to: ['S3'], cond: 't/S2/1s' },
            { id: 'T4', from: ['S3'], to: ['S0'], cond: 't/S3/1s' }] } } }
  ];
  exampleProgs.forEach(function (e) { Object.defineProperty(exampleProgs, e.id, { value: e, enumerable: false }); });

  const api = {
    version: VERSION, create: create, validate: validate, addr: addr, parseAddr: parseAddr, normKey: parseAddr,
    label: label, toText: toText, exampleProgs: exampleProgs, parseCond: parseCond, condToText: condToText,
    keys: { I: IKEYS.slice(), Q: QKEYS.slice(), M: MKEYS.slice() }
  };
  root.SPS_CORE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
