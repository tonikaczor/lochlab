'use strict';
/* Tonfunk Algorithmen-Lab: Kern (Kennung 'alg'). window.ALG_CORE bzw. module.exports.
   Inhalt: kleiner Pseudocode-Interpreter (eigener Parser, KEIN eval, keine Fremdbibliothek) mit Schrittzähler,
   Variablenverlauf (Schreibtischtest) und Schrittgrenze gegen Endlosschleifen; Zeichner für Programmablaufplan (PAP)
   und Struktogramm (Nassi-Shneiderman) als SVG-Text.
   Pseudocode (Schlüsselwörter egal ob groß/klein):
     Setze x auf <Ausdruck>        auch  x := <Ausdruck>       Feldelement:  Setze a[i] auf 5
     Eingabe x                     Ausgabe <Ausdruck>[, <Ausdruck> ...]
     Wenn <Bedingung> dann ... Sonst Wenn <Bedingung> dann ... Sonst ... Ende Wenn
     Solange <Bedingung> ... Ende Solange            (kopfgesteuert)
     Wiederhole ... Bis <Bedingung>                   (fußgesteuert, läuft bis die Bedingung wahr ist)
     Für i von a bis b [Schritt s] ... Ende Für        (Zählschleife)
     Funktion name(p, q) ... Gib zurück <Ausdruck> ... Ende Funktion      Aufruf: name(3, 4)
     Kurzform: Anweisungen mit ; trennen, "Ende" allein schließt den innersten Block. Kommentar: // bis Zeilenende.
   Ausdrücke: Zahlen (Punkt als Dezimaltrenner im Quelltext), "Text", wahr, falsch, [1, 2, 3], a[i], + - * / div mod,
     = <> < > <= >= (auch ≠ ≤ ≥), und, oder, nicht; Funktionen Länge(x), Betrag, Wurzel, abrunden, Minimum, Maximum, Text.
   Ein SCHRITT (Schreibtischtest, Variablenwert nach n Schritten): eine ausgeführte Anweisung (Setze, Eingabe, Ausgabe, Gib zurück, Aufruf)
     oder ein ausgewertetes Schleifen-/Verzweigungs-Kopf (Wenn, Solange, Bis; bei Für jeder Durchgang durch den Kopf einschließlich des letzten, der die Schleife verlässt).
   Fehler: nicht initialisierte Variable, Index außerhalb, Division durch 0, Typfehler, Schrittgrenze (maxSteps, Standard 100000). */
(function (root) {
  const fin = Number.isFinite, NAN = NaN;
  const rd = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f + (v >= 0 ? 1e-9 : -1e-9)) / f; };

  /* ---------- Zahlen deutsch (wie in den anderen Labs) ---------- */
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NAN;
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/(schritte|schritt|mal|stück|stk|durchläufe|vergleiche|aufrufe|%)$/i, '');
    if (/^[+\-−]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '');
    s = s.replace(',', '.');
    if (!/^[+\-−]?\d+(\.\d+)?$|^[+\-−]?\.\d+$/.test(s)) return NAN;
    return parseFloat(s.replace('−', '-'));
  }
  function fmtDe(v, dec, group) {
    if (!fin(v)) return '–';
    dec = dec == null ? 2 : dec; let s = rd(v, dec).toFixed(dec);
    if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
    let [i, f] = s.split('.'); const neg = i[0] === '-'; if (neg) i = i.slice(1);
    if (group && i.length > 4) i = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '−' : '') + i + (f ? ',' + f : '');
  }
  function fmtN(v, dec, group) {
    if (!fin(v)) return '–'; dec = dec == null ? 2 : dec;
    let s = fmtDe(rd(v, dec), dec, group);
    if (s.indexOf(',') >= 0) s = s.replace(/0+$/, '').replace(/,$/, '');
    return s;
  }

  /* ---------- Zufall (seed-fähig) ---------- */
  function hashStr(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    let a = (typeof seed === 'number' ? seed >>> 0 : hashStr(seed)) || 1;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const ri = (R, a, b) => a + Math.floor(R() * (b - a + 1));
  const pick = (R, arr) => arr[Math.floor(R() * arr.length)];
  function shuffle(R, arr) { const o = arr.slice(); for (let j = o.length - 1; j > 0; j--) { const k = Math.floor(R() * (j + 1)); [o[j], o[k]] = [o[k], o[j]]; } return o; }

  /* ---------- Fehlerart ---------- */
  class AlgError extends Error { constructor(line, msg, kind) { super(msg); this.line = line; this.kind = kind || 'runtime'; } }

  /* ---------- Werte als Text ---------- */
  /* PRUEFEN P5: Ausgabe von Zahlen mit Dezimalkomma (höchstens 12 gültige Stellen), Wahrheitswerte als „wahr“/„falsch“, Felder als [1, 2, 3]. Soll die Ausgabe im Lab so aussehen, oder erwartet ihr Dezimalpunkt wie in vielen Programmiersprachen? */
  function fmtVal(v) {
    if (typeof v === 'number') { if (Number.isInteger(v)) return String(v); return String(+v.toPrecision(12)).replace('.', ','); }
    if (typeof v === 'boolean') return v ? 'wahr' : 'falsch';
    if (Array.isArray(v)) return '[' + v.map(fmtVal).join(', ') + ']';
    if (v === undefined) return '–';
    return String(v);
  }
  const cloneVal = v => (Array.isArray(v) ? v.map(cloneVal) : v);

  /* ============================================================ Lexer für Ausdrücke */
  const KW = { div: 1, mod: 1, und: 1, oder: 1, nicht: 1, wahr: 1, falsch: 1 };
  const BUILTIN = { 'länge': 1, 'laenge': 1, betrag: 1, wurzel: 1, abrunden: 1, minimum: 1, maximum: 1, text: 1 };
  const CLOSERS = { '"': ['"'], "'": ["'"], '„': ['“', '"', '”'], '“': ['”', '"'] };
  function lex(s, line) {
    const out = []; let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c >= '0' && c <= '9') { const m = /^\d+(\.\d+)?/.exec(s.slice(i)); out.push({ t: 'num', v: parseFloat(m[0]) }); i += m[0].length; continue; }
      if (CLOSERS[c]) {
        let j = i + 1; while (j < s.length && CLOSERS[c].indexOf(s[j]) < 0) j++;
        if (j >= s.length) throw new AlgError(line, 'Ein Text hat kein schließendes Anführungszeichen.', 'syntax');
        out.push({ t: 'str', v: s.slice(i + 1, j) }); i = j + 1; continue;
      }
      const id = /^[A-Za-zÄÖÜäöüß_][A-Za-zÄÖÜäöüß0-9_]*/.exec(s.slice(i));
      if (id) { const w = id[0], lw = w.toLowerCase(); out.push(KW[lw] ? { t: 'kw', v: lw } : { t: 'id', v: w }); i += w.length; continue; }
      const two = s.substr(i, 2);
      if (two === '<=' || two === '>=' || two === '<>' || two === '!=' || two === '==') { out.push({ t: 'op', v: two === '!=' ? '<>' : two === '==' ? '=' : two }); i += 2; continue; }
      if ('+-*/()[],=<>'.indexOf(c) >= 0) { out.push({ t: 'op', v: c }); i++; continue; }
      if (c === '≤') { out.push({ t: 'op', v: '<=' }); i++; continue; }
      if (c === '≥') { out.push({ t: 'op', v: '>=' }); i++; continue; }
      if (c === '≠') { out.push({ t: 'op', v: '<>' }); i++; continue; }
      throw new AlgError(line, 'Unerwartetes Zeichen „' + c + '“.', 'syntax');
    }
    return out;
  }

  /* ============================================================ Ausdrucks-Parser (rekursiver Abstieg) */
  function parseExpr(s, line) {
    const toks = lex(s, line); let p = 0;
    if (!toks.length) throw new AlgError(line, 'Hier fehlt ein Ausdruck.', 'syntax');
    const isOp = v => toks[p] && toks[p].t === 'op' && toks[p].v === v;
    const isKw = v => toks[p] && toks[p].t === 'kw' && toks[p].v === v;
    const bin = (op, l, r) => ({ t: 'bin', op, l, r, line, c: !!(l.c || r.c) });
    const CMP = { '=': 1, '<>': 1, '<': 1, '>': 1, '<=': 1, '>=': 1 };
    function orE() { let l = andE(); while (isKw('oder')) { p++; l = bin('oder', l, andE()); } return l; }
    function andE() { let l = notE(); while (isKw('und')) { p++; l = bin('und', l, notE()); } return l; }
    function notE() { if (isKw('nicht')) { p++; const x = notE(); return { t: 'un', op: 'nicht', x, line, c: x.c }; } return cmpE(); }
    function cmpE() { const l = addE(); if (toks[p] && toks[p].t === 'op' && CMP[toks[p].v]) { const op = toks[p++].v; return bin(op, l, addE()); } return l; }
    function addE() { let l = mulE(); while (isOp('+') || isOp('-')) { const op = toks[p++].v; l = bin(op, l, mulE()); } return l; }
    function mulE() {
      let l = unE();
      while (isOp('*') || isOp('/') || isKw('div') || isKw('mod')) { const op = toks[p++].v; l = bin(op, l, unE()); }
      return l;
    }
    function unE() { if (isOp('-')) { p++; const x = unE(); return { t: 'un', op: '-', x, line, c: x.c }; } if (isOp('+')) { p++; return unE(); } return postE(); }
    function postE() {
      let x = primE();
      while (isOp('[')) { p++; const i = orE(); if (!isOp(']')) throw new AlgError(line, 'Eine eckige Klammer „]“ fehlt.', 'syntax'); p++; x = { t: 'idx', a: x, i, line, c: !!(x.c || i.c) }; }
      return x;
    }
    function primE() {
      const k = toks[p];
      if (!k) throw new AlgError(line, 'Der Ausdruck ist unvollständig.', 'syntax');
      if (k.t === 'num') { p++; return { t: 'num', v: k.v, line, c: false }; }
      if (k.t === 'str') { p++; return { t: 'str', v: k.v, line, c: false }; }
      if (k.t === 'kw' && (k.v === 'wahr' || k.v === 'falsch')) { p++; return { t: 'bool', v: k.v === 'wahr', line, c: false }; }
      if (k.t === 'op' && k.v === '(') { p++; const x = orE(); if (!isOp(')')) throw new AlgError(line, 'Eine runde Klammer „)“ fehlt.', 'syntax'); p++; return x; }
      if (k.t === 'op' && k.v === '[') {
        p++; const items = [];
        if (!isOp(']')) { for (;;) { items.push(orE()); if (isOp(',')) { p++; continue; } break; } }
        if (!isOp(']')) throw new AlgError(line, 'Eine eckige Klammer „]“ fehlt.', 'syntax'); p++;
        return { t: 'arr', items, line, c: items.some(z => z.c) };
      }
      if (k.t === 'id') {
        p++;
        if (isOp('(')) {
          p++; const args = [];
          if (!isOp(')')) { for (;;) { args.push(orE()); if (isOp(',')) { p++; continue; } break; } }
          if (!isOp(')')) throw new AlgError(line, 'Eine runde Klammer „)“ fehlt.', 'syntax'); p++;
          return { t: 'call', name: k.v, args, line, c: !BUILTIN[k.v.toLowerCase()] || args.some(z => z.c) };
        }
        return { t: 'var', name: k.v, line, c: false };
      }
      throw new AlgError(line, 'Unerwartet: „' + (k.v !== undefined ? k.v : '?') + '“.', 'syntax');
    }
    const e = orE();
    if (p < toks.length) throw new AlgError(line, 'Unerwartet: „' + toks[p].v + '“ (Operator oder Klammer vergessen?).', 'syntax');
    return e;
  }

  /* ============================================================ Programm-Parser */
  const IDRE = '[A-Za-zÄÖÜäöüß_][A-Za-zÄÖÜäöüß0-9_]*';
  function stripCommentAndSplit(ln) {
    const parts = []; let cur = '', q = null;
    for (let i = 0; i < ln.length; i++) {
      const c = ln[i];
      if (q) { cur += c; if (CLOSERS[q].indexOf(c) >= 0) q = null; continue; }
      if (CLOSERS[c]) { q = c; cur += c; continue; }
      if (c === '/' && ln[i + 1] === '/') break;
      if (c === ';') { parts.push(cur); cur = ''; continue; }
      cur += c;
    }
    parts.push(cur); return parts;
  }
  /* PRUEFEN P18: Kurzform für Aufgabenbeschreibungen: Befehle mit „;“ trennen, ein einzelnes „Ende“ schließt den innersten Block (statt „Ende Wenn“ usw.). Ist diese Abkürzung für Azubis verständlich, oder soll sie nur in der Zeichnung erlaubt sein? */
  function classify(text) {
    let m;
    if ((m = /^ende(?:\s+(wenn|solange|für|fuer|funktion))?$/i.exec(text))) return { k: 'ende', kw: m[1] ? m[1].toLowerCase().replace('fuer', 'für') : null };
    if (/^sonst$/i.test(text)) return { k: 'sonst' };
    if ((m = /^sonst\s+wenn\s+(.+?)(?:\s+dann)?$/i.exec(text))) return { k: 'sonstwenn', c: m[1] };
    if ((m = /^bis\s+(.+)$/i.exec(text))) return { k: 'bis', c: m[1] };
    if ((m = new RegExp('^setze\\s+(.+?)\\s+auf\\s+(.+)$', 'i').exec(text))) return { k: 'set', tgt: m[1], e: m[2] };
    if ((m = /^eingabe\s+(.+)$/i.exec(text))) return { k: 'in', rest: m[1] };
    if ((m = /^ausgabe\s+(.+)$/i.exec(text))) return { k: 'out', rest: m[1] };
    if ((m = /^wenn\s+(.+?)(?:\s+dann)?$/i.exec(text))) return { k: 'wenn', c: m[1] };
    if ((m = /^solange\s+(.+)$/i.exec(text))) return { k: 'solange', c: m[1] };
    if (/^wiederhole$/i.test(text)) return { k: 'wiederhole' };
    if ((m = new RegExp('^(?:für|fuer)\\s+(' + IDRE + ')\\s+von\\s+(.+?)\\s+bis\\s+(.+)$', 'i').exec(text))) {
      const rest = m[3].split(/\s+schritt\s+/i);
      return { k: 'fuer', v: m[1], a: m[2], b: rest[0], s: rest.length > 1 ? rest.slice(1).join(' Schritt ') : null };
    }
    if ((m = new RegExp('^funktion\\s+(' + IDRE + ')\\s*\\(([^)]*)\\)$', 'i').exec(text))) return { k: 'funktion', name: m[1], params: m[2].split(',').map(x => x.trim()).filter(Boolean) };
    if ((m = /^(?:gib\s+zur(?:ü|ue)ck|r(?:ü|ue)ckgabe)\s+(.+)$/i.exec(text))) return { k: 'ret', e: m[1] };
    if ((m = /^(.+?)\s*(?::=|←)\s*(.+)$/.exec(text))) return { k: 'set', tgt: m[1], e: m[2] };
    if (new RegExp('^' + IDRE + '\\s*\\(.*\\)$').test(text)) return { k: 'call' };
    return { k: 'unbekannt' };
  }
  const WORDNAME = { wenn: 'Wenn', solange: 'Solange', für: 'Für', funktion: 'Funktion' };

  function parse(src) {
    try { return { ok: true, prog: parseProgram(src) }; }
    catch (e) { if (e instanceof AlgError) return { ok: false, error: { line: e.line, msg: e.message, kind: e.kind } }; throw e; }
  }
  function parseProgram(src) {
    const L = []; String(src == null ? '' : src).replace(/\r\n?/g, '\n').split('\n').forEach((ln, i) => stripCommentAndSplit(ln).forEach(part => { const t = part.trim(); if (t) L.push({ no: i + 1, text: t }); }));
    let i = 0, nid = 0, inFunc = 0;
    const funcs = Object.create(null), funcList = [];
    const mk = (t, line, o) => Object.assign({ t, line, id: ++nid }, o);
    const E = (txt, line) => parseExpr(txt, line);
    function target(txt, line) {
      txt = txt.trim();
      const m = new RegExp('^(' + IDRE + ')\\s*(?:\\[(.+)\\])?$').exec(txt);
      if (!m) throw new AlgError(line, 'Ungültiger Name oder Feldelement: „' + txt + '“.', 'syntax');
      if (KW[m[1].toLowerCase()]) throw new AlgError(line, '„' + m[1] + '“ ist ein Schlüsselwort und kein Variablenname.', 'syntax');
      return { name: m[1], idx: m[2] != null ? E(m[2], line) : null, txt };
    }
    function needEnd(owner, ownerLine, ownerName, kw) {
      if (i >= L.length) throw new AlgError(ownerLine, '„' + ownerName + '“ (Zeile ' + ownerLine + ') wird nicht abgeschlossen: Es fehlt „Ende' + (kw ? ' ' + WORDNAME[kw] : '') + '“.', 'syntax');
      const c = classify(L[i].text);
      if (c.k !== 'ende') throw new AlgError(L[i].no, 'Hier wird „Ende“ erwartet (Block „' + ownerName + '“ aus Zeile ' + ownerLine + ').', 'syntax');
      if (c.kw && c.kw !== kw) throw new AlgError(L[i].no, '„Ende ' + WORDNAME[c.kw] + '“ passt nicht zu „' + ownerName + '“ aus Zeile ' + ownerLine + '.', 'syntax');
      i++;
    }
    /* stop: Funktion, die für ein Schlüsselwort-Ende true liefert */
    function block(stop, ownerLine, ownerName, top) {
      const list = [];
      for (;;) {
        if (i >= L.length) { if (top) return list; return list; }
        const c = classify(L[i].text);
        if (c.k === 'ende' || c.k === 'sonst' || c.k === 'sonstwenn' || c.k === 'bis') {
          if (stop && stop(c)) return list;
          const nm = c.k === 'ende' ? 'Ende' : c.k === 'sonst' ? 'Sonst' : c.k === 'sonstwenn' ? 'Sonst Wenn' : 'Bis';
          throw new AlgError(L[i].no, '„' + nm + '“ steht ohne passenden Anfang.', 'syntax');
        }
        const st = stmt(c, top); if (st) list.push(st);
      }
    }
    function stmt(c, top) {
      const ln = L[i], line = ln.no, text = ln.text; i++;
      switch (c.k) {
        case 'set': {
          const tg = target(c.tgt, line), e = E(c.e, line);
          return mk('set', line, { tg, e, txt: tg.txt + ' := ' + c.e.trim() });
        }
        case 'in': {
          const tgs = c.rest.split(',').map(x => target(x, line));
          return mk('in', line, { tgs, txt: 'Eingabe: ' + tgs.map(x => x.txt).join(', ') });
        }
        case 'out': {
          const parts = splitTop(c.rest), es = parts.map(x => E(x, line));
          return mk('out', line, { es, txt: 'Ausgabe: ' + parts.map(x => x.trim()).join(', ') });
        }
        case 'wenn': return ifStmt(c, line);
        case 'solange': {
          const cond = E(c.c, line), body = block(z => z.k === 'ende', line, 'Solange');
          needEnd(null, line, 'Solange', 'solange');
          return mk('while', line, { c: cond, ctxt: c.c.trim(), body });
        }
        case 'wiederhole': {
          const body = block(z => z.k === 'bis', line, 'Wiederhole');
          if (i >= L.length) throw new AlgError(line, '„Wiederhole“ (Zeile ' + line + ') wird nicht abgeschlossen: Es fehlt „Bis <Bedingung>“.', 'syntax');
          const bc = classify(L[i].text), endLine = L[i].no; i++;
          return mk('repeat', line, { body, c: E(bc.c, endLine), ctxt: bc.c.trim(), endLine });
        }
        case 'fuer': {
          const a = E(c.a, line), b = E(c.b, line), s = c.s != null ? E(c.s, line) : null;
          if (KW[c.v.toLowerCase()]) throw new AlgError(line, '„' + c.v + '“ ist ein Schlüsselwort und kein Variablenname.', 'syntax');
          const body = block(z => z.k === 'ende', line, 'Für'); needEnd(null, line, 'Für', 'für');
          return mk('for', line, { v: c.v, a, b, s, atxt: c.a.trim(), btxt: c.b.trim(), stxt: c.s != null ? c.s.trim() : null, body });
        }
        case 'funktion': {
          if (!top) throw new AlgError(line, 'Eine Funktion kann nur auf der obersten Ebene stehen (nicht in einer Schleife oder Verzweigung).', 'syntax');
          if (funcs[c.name]) throw new AlgError(line, 'Die Funktion „' + c.name + '“ ist doppelt definiert.', 'syntax');
          c.params.forEach(p => { if (!new RegExp('^' + IDRE + '$').test(p) || KW[p.toLowerCase()]) throw new AlgError(line, 'Ungültiger Parametername „' + p + '“.', 'syntax'); });
          inFunc++;
          const f = { name: c.name, params: c.params, line, body: null };
          funcs[c.name] = f;
          f.body = block(z => z.k === 'ende', line, 'Funktion', false); inFunc--;
          const endLine = i < L.length ? L[i].no : line; needEnd(null, line, 'Funktion', 'funktion'); f.endLine = endLine;
          funcList.push(f); return null;
        }
        case 'ret': {
          if (!inFunc) throw new AlgError(line, '„Gib zurück“ gehört in eine Funktion.', 'syntax');
          return mk('ret', line, { e: E(c.e, line), txt: 'Gib zurück: ' + c.e.trim() });
        }
        case 'call': { const e = E(text, line); if (e.t !== 'call') throw new AlgError(line, 'Ungültiger Aufruf.', 'syntax'); return mk('call', line, { e, txt: text }); }
        default: {
          const w = (/^[^\s(]+/.exec(text) || [text])[0];
          throw new AlgError(line, 'Unbekannte Anweisung „' + w + '“. Erlaubt sind Setze, Eingabe, Ausgabe, Wenn, Solange, Wiederhole, Für, Funktion, Gib zurück.', 'syntax');
        }
      }
    }
    function ifStmt(c, line) {
      const cond = E(c.c, line);
      const th = block(z => z.k === 'ende' || z.k === 'sonst' || z.k === 'sonstwenn', line, 'Wenn');
      const node = mk('if', line, { c: cond, ctxt: c.c.trim(), th, el: null });
      if (i < L.length) {
        const n = classify(L[i].text);
        if (n.k === 'sonstwenn') { const l2 = L[i].no; i++; node.el = [ifStmt(n, l2)]; node.elif = true; return node; }
        if (n.k === 'sonst') { i++; node.el = block(z => z.k === 'ende', line, 'Sonst'); }
      }
      needEnd(null, line, 'Wenn', 'wenn');
      return node;
    }
    const main = block(null, 0, '', true);
    if (i < L.length) throw new AlgError(L[i].no, 'Unerwartetes Programmende.', 'syntax');
    return { main, funcs, funcList, src: String(src), lines: L.length ? L[L.length - 1].no : 0 };
  }
  /* Kommas auf oberster Ebene trennen (nicht in Klammern, eckigen Klammern oder Texten) */
  function splitTop(s) {
    const out = []; let d = 0, cur = '', q = null;
    for (let k = 0; k < s.length; k++) {
      const c = s[k];
      if (q) { cur += c; if (CLOSERS[q].indexOf(c) >= 0) q = null; continue; }
      if (CLOSERS[c]) { q = c; cur += c; continue; }
      if (c === '(' || c === '[') d++; else if (c === ')' || c === ']') d--;
      if (c === ',' && d === 0) { out.push(cur); cur = ''; continue; }
      cur += c;
    }
    out.push(cur); return out;
  }

  /* ============================================================ Interpreter */
  /* PRUEFEN P2: Ein „Schritt“ im Schreibtischtest ist eine ausgeführte Anweisung oder eine ausgewertete Bedingung (Wenn, Solange, Bis; bei Für jeder Durchgang durch den Kopf, auch der letzte). Die Zeilen „Wiederhole“, „Sonst“ und „Ende …“ zählen nicht. Entspricht diese Zählweise dem, was ihr beim Schreibtischtest verlangt (z. B. Zeile für Zeile)? */
  function run(src, opts) {
    opts = opts || {};
    const P = typeof src === 'string' ? parse(src) : { ok: true, prog: src };
    const res = { ok: false, finished: false, error: null, steps: 0, cmp: 0, out: [], vars: {}, lineCounts: {}, trace: opts.trace ? [] : null, traceCut: false, stoppedAt: false };
    if (!P.ok) { res.error = P.error; return res; }
    const prog = P.prog, max = opts.maxSteps || 100000, stopAfter = opts.stopAfter || 0, traceMax = opts.traceMax || 3000;
    const inputs = (opts.inputs || []).map(v => (typeof v === 'string' ? (fin(parseDe(v)) ? parseDe(v) : v.trim()) : v)); let inPos = 0;
    const out = res.out; let cmp = 0, depth = 0;
    const err = (line, msg) => new AlgError(line, msg, 'runtime');

    const num = (v, line, what) => { if (typeof v !== 'number') throw err(line, 'Hier wird eine Zahl gebraucht' + (what ? ' (' + what + ')' : '') + ', gefunden: ' + (typeof v === 'string' ? 'Text „' + v + '“' : fmtVal(v)) + '.'); return v; };
    /* PRUEFEN P6: Bedingungen müssen wahr oder falsch sein (Wenn 1 dann … ist ein Fehler, anders als in C). Vergleich ist „=“, ungleich ist „<>“, Zuweisung nur mit „Setze … auf“ oder „:=“. Passt diese Pseudocode-Schreibweise zu euren Unterlagen und zur IHK-Prüfung? */
    const bool = (v, line) => { if (typeof v !== 'boolean') throw err(line, 'Hier wird wahr oder falsch gebraucht, gefunden: ' + (typeof v === 'number' ? 'die Zahl ' + fmtVal(v) : fmtVal(v)) + '. Vergleiche mit =, <, > usw.'); return v; };
    const eq = (a, b) => (Array.isArray(a) || Array.isArray(b) ? JSON.stringify(a) === JSON.stringify(b) : a === b);
    function binop(op, l, r, line) {
      switch (op) {
        case '+':
          if (typeof l === 'string' || typeof r === 'string') { if (Array.isArray(l) || Array.isArray(r)) throw err(line, 'Felder lassen sich nicht mit + verbinden.'); return fmtVal(l) + fmtVal(r); }
          return num(l, line) + num(r, line);
        case '-': return num(l, line) - num(r, line);
        case '*': return num(l, line) * num(r, line);
        case '/': { num(l, line); num(r, line); if (r === 0) throw err(line, 'Division durch 0.'); return l / r; }
        /* PRUEFEN P4: div und mod schneiden zur 0 hin ab (−7 div 2 = −3, −7 mod 2 = −1, wie in Java/C). Bei positiven Zahlen gibt es keinen Unterschied. Reicht das, oder soll mod nie negativ werden? */
        case 'div': { num(l, line); num(r, line); if (r === 0) throw err(line, 'Division durch 0 (div).'); return Math.trunc(l / r); }
        case 'mod': { num(l, line); num(r, line); if (r === 0) throw err(line, 'Division durch 0 (mod).'); return l - r * Math.trunc(l / r); }
        case '=': cmp++; return eq(l, r);
        case '<>': cmp++; return !eq(l, r);
        case '<': case '>': case '<=': case '>=': {
          cmp++;
          if (!((typeof l === 'number' && typeof r === 'number') || (typeof l === 'string' && typeof r === 'string'))) throw err(line, 'Verglichen werden können nur zwei Zahlen oder zwei Texte.');
          return op === '<' ? l < r : op === '>' ? l > r : op === '<=' ? l <= r : l >= r;
        }
      }
      throw err(line, 'Unbekannter Operator ' + op);
    }
    /* PRUEFEN P1: Felder zählen ab Index 0 (a[0] ist das erste Element, letztes Element a[Länge(a) - 1]), wie in C, Python und Java. In manchen Prüfungsaufgaben und Lehrbüchern beginnt die Zählung bei 1. Welche Konvention soll im Unterricht gelten? */
    function index(arr, i, line) {
      if (!Array.isArray(arr)) throw err(line, 'Mit [ ] kann nur ein Feld angesprochen werden.');
      if (typeof i !== 'number' || !Number.isInteger(i)) throw err(line, 'Der Index muss eine ganze Zahl sein.');
      if (i < 0 || i >= arr.length) throw err(line, 'Index ' + i + ' liegt außerhalb des Felds (gültig sind 0 bis ' + (arr.length - 1) + ').');
      return i;
    }
    function builtin(name, a, line) {
      const nm = name.toLowerCase(), need = k => { if (a.length !== k) throw err(line, name + ' erwartet ' + k + ' Wert' + (k === 1 ? '' : 'e') + '.'); };
      switch (nm) {
        case 'länge': case 'laenge': need(1); if (Array.isArray(a[0]) || typeof a[0] === 'string') return a[0].length; throw err(line, 'Länge() braucht ein Feld oder einen Text.');
        case 'betrag': need(1); return Math.abs(num(a[0], line));
        case 'wurzel': need(1); if (num(a[0], line) < 0) throw err(line, 'Wurzel aus einer negativen Zahl.'); return Math.sqrt(a[0]);
        case 'abrunden': need(1); return Math.floor(num(a[0], line));
        case 'minimum': need(2); return Math.min(num(a[0], line), num(a[1], line));
        case 'maximum': need(2); return Math.max(num(a[0], line), num(a[1], line));
        case 'text': need(1); return fmtVal(a[0]);
      }
      throw err(line, 'Unbekannte Funktion „' + name + '“.');
    }
    function lookup(env, n) { const v = env.vars[n.name]; if (v === undefined) throw err(n.line, 'Die Variable „' + n.name + '“ hat noch keinen Wert (nicht initialisiert).'); return v; }
    /* schnelle Auswertung ohne Aufruf eigener Funktionen */
    function ev(n, env) {
      switch (n.t) {
        case 'num': case 'str': case 'bool': return n.v;
        case 'var': return lookup(env, n);
        case 'arr': return n.items.map(z => ev(z, env));
        case 'idx': { const a = ev(n.a, env), i = ev(n.i, env); return a[index(a, i, n.line)]; }
        case 'un': { const x = ev(n.x, env); return n.op === '-' ? -num(x, n.line) : !bool(x, n.line); }
        case 'bin':
          if (n.op === 'und') { if (!bool(ev(n.l, env), n.line)) return false; return bool(ev(n.r, env), n.line); }
          if (n.op === 'oder') { if (bool(ev(n.l, env), n.line)) return true; return bool(ev(n.r, env), n.line); }
          return binop(n.op, ev(n.l, env), ev(n.r, env), n.line);
        case 'call': return builtin(n.name, n.args.map(z => ev(z, env)), n.line);
      }
      throw err(n.line, 'Unbekannter Ausdruck');
    }
    /* Auswertung mit eigenen Funktionen (Generator, damit Schritte in der Funktion mitgezählt werden) */
    function* evg(n, env) {
      if (!n.c) return ev(n, env);
      switch (n.t) {
        case 'arr': { const o = []; for (const z of n.items) o.push(yield* evg(z, env)); return o; }
        case 'idx': { const a = yield* evg(n.a, env), i = yield* evg(n.i, env); return a[index(a, i, n.line)]; }
        case 'un': { const x = yield* evg(n.x, env); return n.op === '-' ? -num(x, n.line) : !bool(x, n.line); }
        case 'bin':
          if (n.op === 'und') { if (!bool(yield* evg(n.l, env), n.line)) return false; return bool(yield* evg(n.r, env), n.line); }
          if (n.op === 'oder') { if (bool(yield* evg(n.l, env), n.line)) return true; return bool(yield* evg(n.r, env), n.line); }
          { const l = yield* evg(n.l, env), r = yield* evg(n.r, env); return binop(n.op, l, r, n.line); }
        case 'call': {
          const a = []; for (const z of n.args) a.push(yield* evg(z, env));
          if (BUILTIN[n.name.toLowerCase()]) return builtin(n.name, a, n.line);
          const v = yield* callUser(n.name, a, n.line);
          if (v === undefined) throw err(n.line, 'Die Funktion „' + n.name + '“ hat keinen Wert zurückgegeben (Gib zurück fehlt).');
          return v;
        }
      }
      throw err(n.line, 'Unbekannter Ausdruck');
    }
    function* callUser(name, args, line) {
      const f = prog.funcs[name];
      if (!f) throw err(line, 'Die Funktion „' + name + '“ ist nicht definiert.');
      if (args.length !== f.params.length) throw err(line, 'Die Funktion „' + name + '“ erwartet ' + f.params.length + ' Wert' + (f.params.length === 1 ? '' : 'e') + ', bekommt aber ' + args.length + '.');
      if (depth >= 400) throw err(line, 'Zu viele verschachtelte Aufrufe (Rekursion ohne Ende?).');
      const env = { vars: Object.create(null), scope: name, ret: false, rv: undefined, depth: depth + 1 };
      f.params.forEach((p, k) => { env.vars[p] = args[k]; });
      depth++;
      try { yield* execBlock(f.body, env); } finally { depth--; }
      return env.rv;
    }
    function assign(env, tg, val, line, ix) {
      if (tg.idx) {
        const a = env.vars[tg.name];
        if (a === undefined) throw err(line, 'Die Variable „' + tg.name + '“ hat noch keinen Wert (nicht initialisiert).');
        a[index(a, ix, line)] = val;
      } else env.vars[tg.name] = val;
    }
    function* execBlock(list, env) { for (let k = 0; k < list.length; k++) { yield* exec(list[k], env); if (env.ret) return; } }
    const stepEv = (st, env, cond) => ({ line: st.line, env, cond });
    function* exec(st, env) {
      switch (st.t) {
        case 'set': {
          const val = yield* evg(st.e, env); let ix;
          if (st.tg.idx) ix = yield* evg(st.tg.idx, env);
          if (val === undefined) throw err(st.line, 'Dieser Ausdruck hat keinen Wert.');
          assign(env, st.tg, val, st.line, ix); yield stepEv(st, env); return;
        }
        case 'in': {
          for (const tg of st.tgs) {
            if (inPos >= inputs.length) throw err(st.line, 'Eingabe verlangt einen Wert, aber es wurden nicht genug Eingaben angegeben.');
            let ix; if (tg.idx) ix = yield* evg(tg.idx, env);
            assign(env, tg, inputs[inPos++], st.line, ix);
          }
          yield stepEv(st, env); return;
        }
        case 'out': {
          const o = []; for (const z of st.es) { const v = yield* evg(z, env); if (v === undefined) throw err(st.line, 'Dieser Ausdruck hat keinen Wert.'); o.push(fmtVal(v)); }
          out.push(o.join(' ')); yield stepEv(st, env); return;
        }
        case 'call': {
          if (BUILTIN[st.e.name.toLowerCase()]) yield* evg(st.e, env);
          else { const a = []; for (const z of st.e.args) a.push(yield* evg(z, env)); yield* callUser(st.e.name, a, st.line); }
          yield stepEv(st, env); return;
        }
        case 'ret': { const v = yield* evg(st.e, env); env.rv = v; env.ret = true; yield stepEv(st, env); return; }
        case 'if': {
          const c = bool(yield* evg(st.c, env), st.line); yield stepEv(st, env, c);
          if (c) yield* execBlock(st.th, env); else if (st.el) yield* execBlock(st.el, env);
          return;
        }
        case 'while': {
          for (;;) {
            const c = bool(yield* evg(st.c, env), st.line); yield stepEv(st, env, c);
            if (!c) return;
            yield* execBlock(st.body, env); if (env.ret) return;
          }
        }
        case 'repeat': {
          for (;;) {
            yield* execBlock(st.body, env); if (env.ret) return;
            const c = bool(yield* evg(st.c, env), st.endLine); yield { line: st.endLine, env, cond: c };
            if (c) return;
          }
        }
        /* PRUEFEN P3: Bei Für werden Anfangswert, Endwert und Schrittweite einmal vor der Schleife berechnet. Die Zählvariable behält nach der Schleife den ersten Wert hinter dem Ende (Für i von 1 bis 5: danach i = 6). Entspricht das dem Unterricht? */
        case 'for': {
          let i = num(yield* evg(st.a, env), st.line, 'Anfangswert'); const b = num(yield* evg(st.b, env), st.line, 'Endwert'), s = st.s ? num(yield* evg(st.s, env), st.line, 'Schrittweite') : 1;
          if (s === 0) throw err(st.line, 'Die Schrittweite darf nicht 0 sein.');
          for (;;) {
            env.vars[st.v] = i;
            const c = s > 0 ? i <= b : i >= b; yield stepEv(st, env, c);
            if (!c) return;
            yield* execBlock(st.body, env); if (env.ret) return;
            i = num(env.vars[st.v], st.line, 'Zählvariable') + s;
          }
        }
      }
      throw err(st.line, 'Unbekannte Anweisung');
    }

    const snap = env => { const v = {}; for (const k in env.vars) v[k] = cloneVal(env.vars[k]); return v; };
    const env0 = { vars: Object.create(null), scope: '', ret: false, rv: undefined, depth: 0 };
    const g = execBlock(prog.main, env0);
    let outAtLast = 0, steps = 0;
    for (;;) {
      let r;
      try { r = g.next(); }
      catch (e) { if (e instanceof AlgError) { res.error = { line: e.line, msg: e.message, kind: e.kind }; break; } throw e; }
      if (r.done) { res.finished = true; res.ok = true; break; }
      if (steps >= max) {
        res.error = { line: r.value.line, msg: 'Schrittgrenze erreicht: Nach ' + max + ' Schritten ist das Programm noch nicht zu Ende (Endlosschleife?).', kind: 'limit' };
        out.length = outAtLast; cmp = res.cmp; break;
      }
      steps++; res.steps = steps; res.cmp = cmp; outAtLast = out.length;
      const ev0 = r.value;
      res.lineCounts[ev0.line] = (res.lineCounts[ev0.line] || 0) + 1;
      if (res.trace) {
        if (res.trace.length < traceMax) res.trace.push({ n: steps, line: ev0.line, scope: ev0.env.scope, depth: ev0.env.depth, vars: snap(ev0.env), outN: out.length, cond: ev0.cond });
        else res.traceCut = true;
      }
      if (stopAfter && steps >= stopAfter) { res.stoppedAt = true; res.vars = snap(ev0.env); res.stopScope = ev0.env.scope; res.ok = true; break; }
    }
    res.cmp = Math.max(res.cmp, cmp); if (!res.stoppedAt) res.vars = snap(env0);
    return res;
  }

  /* Bequeme Hilfen */
  function valueAfter(src, n, name, inputs) { const r = run(src, { stopAfter: n, inputs }); return r.error ? undefined : r.vars[name]; }
  function lineCount(src, line, inputs, maxSteps) { const r = run(src, { inputs, maxSteps }); return r.error && r.error.kind !== 'limit' ? NAN : (r.lineCounts[line] || 0); }
  function outLines(src, inputs) { const r = run(src, { inputs }); return r.error ? null : r.out; }

  /* Ausgaben vergleichen: Klammern und Kommas zwischen Feldwerten sind egal, Zahlen mit Komma oder Punkt, Groß-/Kleinschreibung egal */
  function outTokens(x) {
    const s = (Array.isArray(x) ? x.join('\n') : String(x == null ? '' : x)).replace(/[\[\]]/g, ' ').replace(/,\s+/g, ' ').replace(/[;\n\r\t]+/g, ' ').replace(/[„“”"]/g, '').trim();
    return s ? s.split(/\s+/) : [];
  }
  function sameTok(a, b) {
    const x = parseDe(a), y = parseDe(b);
    if (fin(x) && fin(y)) return Math.abs(x - y) < 1e-9;
    return String(a).toLowerCase() === String(b).toLowerCase();
  }
  function sameOut(expected, given) {
    const e = outTokens(expected), g = outTokens(given);
    return e.length === g.length && e.every((t, k) => sameTok(t, g[k]));
  }

  /* ============================================================ Textstücke der Knoten (für Zeichner und Aufgaben) */
  function forHead(n) { return 'Für ' + n.v + ' von ' + n.atxt + ' bis ' + n.btxt + (n.stxt != null ? ' Schritt ' + n.stxt : ''); }
  function textOf(n) {
    switch (n.t) {
      case 'set': case 'in': case 'out': case 'call': case 'ret': return n.txt;
      case 'if': case 'while': case 'repeat': return n.ctxt;
      case 'for': return forHead(n);
    }
    return '';
  }
  function eachNode(list, fn) { (list || []).forEach(n => { fn(n); if (n.th) eachNode(n.th, fn); if (n.el) eachNode(n.el, fn); if (n.body) eachNode(n.body, fn); }); }
  function nodeAtLine(prog, line) {
    let found = null;
    const lists = [prog.main].concat(prog.funcList.map(f => f.body));
    lists.forEach(l => eachNode(l, n => { if (!found && (n.line === line || (n.t === 'repeat' && n.endLine === line))) found = n; }));
    return found;
  }
  function nodeText(src, line) { const P = typeof src === 'string' ? parse(src) : { ok: true, prog: src }; if (!P.ok) return ''; const n = nodeAtLine(P.prog, line); return n ? textOf(n) : ''; }
  /* oberste Anweisungen als Anzeigetexte (Eingabe: x, y := 3 * x ...) */
  function topTexts(src) { const P = parse(src); return P.ok ? P.prog.main.map(textOf) : []; }

  /* ============================================================ SVG-Zeichner */
  const escX = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const TW = s => Math.ceil(String(s).length * 7.4);
  const f1 = v => (Math.round(v * 10) / 10);
  const EMPTY = { w: 0, h: 0, cx: 0, empty: true, svg: () => '' };
  const DEFS = '<defs><marker id="algArr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" style="fill:var(--fg)"/></marker></defs>';
  const pth = (d, arrow) => '<path class="pp-l" d="' + d + '"' + (arrow ? ' marker-end="url(#algArr)"' : '') + '/>';
  const lab = (x, y, t, anchor) => '<text class="pp-lab" x="' + f1(x) + '" y="' + f1(y) + '" text-anchor="' + (anchor || 'start') + '">' + t + '</text>';
  const txt = (x, y, t, anchor, cls) => '<text class="' + (cls || 'pp-txt') + '" x="' + f1(x) + '" y="' + f1(y) + '" text-anchor="' + (anchor || 'middle') + '">' + escX(t) + '</text>';
  const grp = (c, ctx, line, inner) => '<g class="pp-g' + (c ? ' ' + c : '') + (ctx.hi != null && ctx.hi === line ? ' hi' : '') + (ctx.blankSet[line] ? ' blank' : '') + '" data-line="' + line + '">' + inner + '</g>';
  const shownText = (ctx, line, t) => (ctx.blankSet[line] ? '?' : t);

  /* ----- Programmablaufplan ----- */
  /* PRUEFEN P7: Symbole nach DIN 66001 wie gezeichnet: Abgerundetes Rechteck = Start/Ende, Rechteck = Verarbeitung (Zuweisung), Parallelogramm = Ein-/Ausgabe, Raute = Verzweigung mit „Ja“ links und „Nein“ rechts, Rechteck mit doppelten Seitenlinien = Aufruf eines Unterprogramms. Stimmt das so, oder soll „Ja“/„Nein“ anders liegen? */
  function pTerm(t, ctx, line) { const w = Math.max(96, TW(t) + 36), h = 34; return { w, h, cx: w / 2, svg: (x, y) => grp('', ctx, line, '<rect class="pp-shape" x="' + f1(x) + '" y="' + f1(y) + '" width="' + w + '" height="' + h + '" rx="17"/>' + txt(x + w / 2, y + 21, t)) }; }
  function pProc(t, ctx, line) { const s = shownText(ctx, line, t), w = Math.max(120, TW(s) + 28), h = 36; return { w, h, cx: w / 2, svg: (x, y) => grp('', ctx, line, '<rect class="pp-shape" x="' + f1(x) + '" y="' + f1(y) + '" width="' + w + '" height="' + h + '"/>' + txt(x + w / 2, y + 23, s)) }; }
  function pSub(t, ctx, line) { const s = shownText(ctx, line, t), w = Math.max(130, TW(s) + 44), h = 36; return { w, h, cx: w / 2, svg: (x, y) => grp('', ctx, line, '<rect class="pp-shape" x="' + f1(x) + '" y="' + f1(y) + '" width="' + w + '" height="' + h + '"/>' + pth('M' + f1(x + 9) + ' ' + f1(y) + 'V' + f1(y + h)) + pth('M' + f1(x + w - 9) + ' ' + f1(y) + 'V' + f1(y + h)) + txt(x + w / 2, y + 23, s)) }; }
  function pIO(t, ctx, line) { const s = shownText(ctx, line, t), w = Math.max(136, TW(s) + 56), h = 36, k = 14; return { w, h, cx: w / 2, svg: (x, y) => grp('', ctx, line, '<polygon class="pp-shape" points="' + [[x + k, y], [x + w, y], [x + w - k, y + h], [x, y + h]].map(p => f1(p[0]) + ',' + f1(p[1])).join(' ') + '"/>' + txt(x + w / 2, y + 23, s)) }; }
  function pDec(t, ctx, line) { const s = shownText(ctx, line, t), w = Math.max(150, TW(s) + 72), h = 64; return { w, h, cx: w / 2, svg: (x, y) => grp('', ctx, line, '<polygon class="pp-shape" points="' + [[x + w / 2, y], [x + w, y + h / 2], [x + w / 2, y + h], [x, y + h / 2]].map(p => f1(p[0]) + ',' + f1(p[1])).join(' ') + '"/>' + txt(x + w / 2, y + h / 2 + 4, s)) }; }
  const G = 24;
  function pSeq(list, ctx) {
    const items = []; list.forEach(n => { const l = pNode(n, ctx); if (l && !l.empty) items.push(l); });
    if (!items.length) return EMPTY;
    const axis = Math.max.apply(null, items.map(z => z.cx)), right = Math.max.apply(null, items.map(z => z.w - z.cx));
    let h = 0; const ys = items.map((z, k) => { const y = h; h += z.h + (k < items.length - 1 ? G : 0); return y; });
    return { w: axis + right, h, cx: axis, svg: (x, y) => items.map((z, k) => z.svg(x + axis - z.cx, y + ys[k]) + (k < items.length - 1 ? pth('M' + f1(x + axis) + ' ' + f1(y + ys[k] + z.h) + 'V' + f1(y + ys[k + 1]), true) : '')).join('') };
  }
  function pIf(n, ctx) {
    const D = pDec(n.ctxt, ctx, n.line), T = pSeq(n.th, ctx), E = n.el ? pSeq(n.el, ctx) : EMPTY;
    const axisT = T.empty ? 0 : T.cx, tw = T.empty ? 0 : T.w, ecx = E.empty ? 0 : E.cx, ew = E.empty ? 0 : E.w;
    const xE = Math.max(tw + 30, axisT + D.w + 24 - ecx), axisE = xE + ecx, axisD = (axisT + axisE) / 2;
    const W = Math.max(xE + ew, axisE + 2, axisD + D.w / 2), bodyTop = D.h + 22, bodyH = Math.max(T.empty ? 0 : T.h, E.empty ? 0 : E.h), yJoin = bodyTop + bodyH + 20;
    return {
      w: W, h: yJoin, cx: axisD, svg: (x, y) => {
        const ym = y + D.h / 2, xl = x + axisD - D.w / 2, xr = x + axisD + D.w / 2; let s = D.svg(x + axisD - D.w / 2, y);
        s += pth('M' + f1(xl) + ' ' + f1(ym) + 'H' + f1(x + axisT) + 'V' + f1(T.empty ? y + yJoin : y + bodyTop), !T.empty);
        s += pth('M' + f1(xr) + ' ' + f1(ym) + 'H' + f1(x + axisE) + 'V' + f1(E.empty ? y + yJoin : y + bodyTop), !E.empty);
        s += lab(xl - 4, ym - 5, 'Ja', 'end') + lab(xr + 4, ym - 5, 'Nein', 'start');
        if (!T.empty) { s += T.svg(x, y + bodyTop); s += pth('M' + f1(x + axisT) + ' ' + f1(y + bodyTop + T.h) + 'V' + f1(y + yJoin)); }
        if (!E.empty) { s += E.svg(x + xE, y + bodyTop); s += pth('M' + f1(x + axisE) + ' ' + f1(y + bodyTop + E.h) + 'V' + f1(y + yJoin)); }
        s += pth('M' + f1(x + axisT) + ' ' + f1(y + yJoin) + 'H' + f1(x + axisE));
        return s;
      }
    };
  }
  function pWhile(condTxt, line, bodyL, ctx) {
    const D = pDec(condTxt, ctx, line), B = bodyL, bw = B.empty ? 0 : B.w, bcx = B.empty ? 0 : B.cx, bh = B.empty ? 0 : B.h;
    const half = Math.max(D.w / 2, bcx), axis = 22 + half, right = axis + Math.max(D.w / 2, bw - bcx), xL = axis - half - 12, xR = right + 16;
    const bodyTop = D.h + 22, yb = bodyTop + bh, backY = yb + 16, yExit = backY + 22;
    return {
      w: xR + 4, h: yExit, cx: axis, svg: (x, y) => {
        const ym = y + D.h / 2; let s = D.svg(x + axis - D.w / 2, y);
        s += pth('M' + f1(x + axis) + ' ' + f1(y + D.h) + 'V' + f1(y + bodyTop), true) + lab(x + axis + 6, y + D.h + 14, 'Ja', 'start');
        if (!B.empty) s += B.svg(x + axis - bcx, y + bodyTop);
        s += pth('M' + f1(x + axis) + ' ' + f1(y + yb) + 'V' + f1(y + backY) + 'H' + f1(x + xL) + 'V' + f1(ym) + 'H' + f1(x + axis - D.w / 2), true);
        s += pth('M' + f1(x + axis + D.w / 2) + ' ' + f1(ym) + 'H' + f1(x + xR) + 'V' + f1(y + yExit) + 'H' + f1(x + axis)) + lab(x + axis + D.w / 2 + 4, ym - 5, 'Nein', 'start');
        return s;
      }
    };
  }
  function pRepeat(n, ctx) {
    const B = pSeq(n.body, ctx), D = pDec(n.ctxt, ctx, n.endLine), bcx = B.empty ? 0 : B.cx, bw = B.empty ? 0 : B.w, bh = B.empty ? 0 : B.h;
    const half = Math.max(bcx, D.w / 2), axis = 22 + half, xL = axis - half - 12, yBody = 18, yD = yBody + bh + 22;
    return {
      w: axis + Math.max(bw - bcx, D.w / 2) + 34, h: yD + D.h, cx: axis, svg: (x, y) => {
        let s = pth('M' + f1(x + axis) + ' ' + f1(y) + 'V' + f1(y + yBody), true);
        if (!B.empty) s += B.svg(x + axis - bcx, y + yBody);
        s += pth('M' + f1(x + axis) + ' ' + f1(y + yBody + bh) + 'V' + f1(y + yD), true) + D.svg(x + axis - D.w / 2, y + yD);
        s += pth('M' + f1(x + axis - D.w / 2) + ' ' + f1(y + yD + D.h / 2) + 'H' + f1(x + xL) + 'V' + f1(y + 9) + 'H' + f1(x + axis), true);
        s += lab(x + axis - D.w / 2 - 4, y + yD + D.h / 2 - 5, 'Nein', 'end') + lab(x + axis + 6, y + yD + D.h + 12, 'Ja', 'start');
        return s;
      }
    };
  }
  /* PRUEFEN P8: Die Zählschleife (Für) wird im Ablaufplan aufgelöst gezeichnet: i := a, Raute „i ≤ b“, Rumpf, i := i + Schritt, zurück zur Raute. Nach DIN 66001 gibt es dafür auch das Sechseck „Vorbereitung“. Welche Darstellung soll gelten? */
  function pFor(n, ctx) {
    const neg = n.stxt != null && /^-\s*\d/.test(n.stxt), step = n.stxt == null ? '1' : (neg ? n.stxt.replace(/^-\s*/, '') : n.stxt);
    const init = pProc(n.v + ' := ' + n.atxt, ctx, n.line), inc = pProc(n.v + ' := ' + n.v + (neg ? ' - ' : ' + ') + step, ctx, n.line);
    const body = pSeq(n.body, ctx), items = [body, inc].filter(z => !z.empty);
    const axis = Math.max.apply(null, items.map(z => z.cx)), right = Math.max.apply(null, items.map(z => z.w - z.cx));
    let hh = 0; const ys = items.map((z, k) => { const y = hh; hh += z.h + (k < items.length - 1 ? G : 0); return y; });
    const rump = { w: axis + right, h: hh, cx: axis, svg: (x, y) => items.map((z, k) => z.svg(x + axis - z.cx, y + ys[k]) + (k < items.length - 1 ? pth('M' + f1(x + axis) + ' ' + f1(y + ys[k] + z.h) + 'V' + f1(y + ys[k + 1]), true) : '')).join('') };
    const loop = pWhile(n.v + (neg ? ' ≥ ' : ' ≤ ') + n.btxt, n.line, rump, ctx);
    const W = Math.max(init.w, loop.w, 0), ax = Math.max(init.cx, loop.cx), rt = Math.max(init.w - init.cx, loop.w - loop.cx);
    return { w: ax + rt, h: init.h + G + loop.h, cx: ax, svg: (x, y) => init.svg(x + ax - init.cx, y) + pth('M' + f1(x + ax) + ' ' + f1(y + init.h) + 'V' + f1(y + init.h + G), true) + loop.svg(x + ax - loop.cx, y + init.h + G) };
  }
  function pNode(n, ctx) {
    switch (n.t) {
      case 'set': return pProc(n.txt, ctx, n.line);
      case 'in': case 'out': return pIO(n.txt, ctx, n.line);
      case 'call': return pSub(n.txt, ctx, n.line);
      /* PRUEFEN P11: „Gib zurück“ wird im Ablaufplan als normales Rechteck mitten im Ablauf gezeichnet (kein vorzeitiges Verlassen der Funktion, kein eigenes Symbol). Jede Funktion bekommt einen eigenen Plan mit Start „name(...)“. Ist das für die Ausbildung in Ordnung? */
      case 'ret': return pProc(n.txt, ctx, n.line);
      case 'if': return pIf(n, ctx);
      case 'while': return pWhile(n.ctxt, n.line, pSeq(n.body, ctx), ctx);
      case 'repeat': return pRepeat(n, ctx);
      case 'for': return pFor(n, ctx);
    }
    return EMPTY;
  }
  function mkCtx(opts) { opts = opts || {}; const b = {}; (opts.blank || []).forEach(l => { b[l] = true; }); return { blankSet: b, hi: opts.hi == null ? null : opts.hi }; }
  function diagrams(prog, lay) {
    const d = [{ cap: 'Hauptprogramm', build: ctx => lay(prog.main, ctx, 'Start', 'Ende', null) }];
    prog.funcList.forEach(f => d.push({ cap: 'Funktion ' + f.name + '(' + f.params.join(', ') + ')', build: ctx => lay(f.body, ctx, f.name + '(' + f.params.join(', ') + ')', 'Ende', f) }));
    return d;
  }
  function wrapSvg(parts, label, extraW) {
    let y = 12, maxW = 0, body = '';
    const multi = parts.length > 1;
    parts.forEach(p => {
      if (multi) { body += txt(12, y + 12, p.cap, 'start', 'pp-cap'); y += 24; }
      body += p.svg(12, y); y += p.h + 16; maxW = Math.max(maxW, p.w + 24);
    });
    const W = Math.ceil(Math.max(maxW, 200, extraW || 0)), H = Math.ceil(y);
    return '<svg class="algsvg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + escX(label) + '">' + DEFS + body + '</svg>';
  }
  function drawPap(src, opts) {
    const P = typeof src === 'string' ? parse(src) : { ok: true, prog: src };
    if (!P.ok) return '';
    const ctx = mkCtx(opts);
    const lay = (list, c, startT, endT) => {
      const s = pTerm(startT, c, -1), e = pTerm(endT, c, -2), b = pSeq(list, c), items = [s].concat(b.empty ? [] : [b], [e]);
      const axis = Math.max.apply(null, items.map(z => z.cx)), right = Math.max.apply(null, items.map(z => z.w - z.cx));
      let h = 0; const ys = items.map((z, k) => { const y = h; h += z.h + (k < items.length - 1 ? G : 0); return y; });
      return { w: axis + right, h, svg: (x, y) => items.map((z, k) => z.svg(x + axis - z.cx, y + ys[k]) + (k < items.length - 1 ? pth('M' + f1(x + axis) + ' ' + f1(y + ys[k] + z.h) + 'V' + f1(y + ys[k + 1]), true) : '')).join('') };
    };
    const parts = diagrams(P.prog, lay).map(d => Object.assign({ cap: d.cap }, d.build(ctx)));
    return wrapSvg(parts, 'Programmablaufplan');
  }

  /* ----- Struktogramm (Nassi-Shneiderman) ----- */
  /* PRUEFEN P9: Struktogramm nach DIN 66261 wie gezeichnet: Anweisung = Kasten, Verzweigung = Kasten mit Dreieck (Ja links, Nein rechts), Solange/Für = Kopfzeile mit eingerücktem Rumpf, Wiederhole = eingerückter Rumpf mit Fußzeile „Bis ...“. Stimmt das, oder soll die fußgesteuerte Schleife „Wiederhole ... solange (Bedingung)“ mit umgekehrter Bedingung gezeichnet werden? */
  const RH = 28, IND = 22, IFH = 46;
  const nRect = (x, y, w, h, c) => '<rect class="ns-box' + (c ? ' ' + c : '') + '" x="' + f1(x) + '" y="' + f1(y) + '" width="' + f1(w) + '" height="' + f1(h) + '"/>';
  const nGrp = (ctx, line, inner) => '<g class="ns-g' + (ctx.hi != null && ctx.hi === line ? ' hi' : '') + (ctx.blankSet[line] ? ' blank' : '') + '" data-line="' + line + '">' + inner + '</g>';
  const NEMPTY = { min: 0, h: 0, empty: true, draw: () => '' };
  function nSeq(list, ctx) {
    const items = []; list.forEach(n => { const l = nNode(n, ctx); if (l && !l.empty) items.push(l); });
    if (!items.length) return NEMPTY;
    return { min: Math.max.apply(null, items.map(z => z.min)), h: items.reduce((a, z) => a + z.h, 0), draw: (x, y, w) => { let yy = y, s = ''; items.forEach(z => { s += z.draw(x, yy, w); yy += z.h; }); return s; } };
  }
  function nNode(n, ctx) {
    switch (n.t) {
      case 'set': case 'in': case 'out': case 'call': case 'ret': {
        const t = shownText(ctx, n.line, n.txt); return { min: TW(t) + 20, h: RH, draw: (x, y, w) => nGrp(ctx, n.line, nRect(x, y, w, RH) + txt(x + w / 2, y + 18, t)) };
      }
      case 'if': {
        const t = shownText(ctx, n.line, n.ctxt), T = nSeq(n.th, ctx), E = n.el ? nSeq(n.el, ctx) : NEMPTY, mT = Math.max(T.min, 44), mE = Math.max(E.min, 44), hb = Math.max(T.h, E.h, RH);
        return {
          min: Math.max(TW(t) + 70, mT + mE), h: IFH + hb, draw: (x, y, w) => {
            const ex = w - mT - mE, wL = mT + ex * mT / (mT + mE);
            let s = nRect(x, y, w, IFH) + pth('M' + f1(x) + ' ' + f1(y) + 'L' + f1(x + wL) + ' ' + f1(y + IFH) + 'L' + f1(x + w) + ' ' + f1(y)) + txt(x + w / 2, y + 16, t) + lab(x + 8, y + IFH - 6, 'Ja', 'start') + lab(x + w - 8, y + IFH - 6, 'Nein', 'end');
            s = nGrp(ctx, n.line, s);
            s += T.empty ? nRect(x, y + IFH, wL, hb, 'ns-empty') : T.draw(x, y + IFH, wL) + (T.h < hb ? nRect(x, y + IFH + T.h, wL, hb - T.h, 'ns-empty') : '');
            s += E.empty ? nRect(x + wL, y + IFH, w - wL, hb, 'ns-empty') : E.draw(x + wL, y + IFH, w - wL) + (E.h < hb ? nRect(x + wL, y + IFH + E.h, w - wL, hb - E.h, 'ns-empty') : '');
            return s;
          }
        };
      }
      case 'while': case 'for': {
        const head = n.t === 'while' ? 'Solange ' + (ctx.blankSet[n.line] ? '?' : n.ctxt) : (ctx.blankSet[n.line] ? '?' : forHead(n)), B = nSeq(n.body, ctx), hb = Math.max(B.h, 14);
        return { min: Math.max(TW(head) + 20, IND + B.min), h: RH + hb, draw: (x, y, w) => nGrp(ctx, n.line, nRect(x, y, w, RH) + txt(x + 8, y + 18, head, 'start')) + nRect(x, y + RH, IND, hb) + (B.empty ? nRect(x + IND, y + RH, w - IND, hb, 'ns-empty') : B.draw(x + IND, y + RH, w - IND) + (B.h < hb ? nRect(x + IND, y + RH + B.h, w - IND, hb - B.h, 'ns-empty') : '')) };
      }
      case 'repeat': {
        const foot = 'Bis ' + (ctx.blankSet[n.endLine] ? '?' : n.ctxt), B = nSeq(n.body, ctx), hb = Math.max(B.h, 14);
        return { min: Math.max(TW(foot) + 20, IND + B.min), h: hb + RH, draw: (x, y, w) => nRect(x, y, IND, hb) + (B.empty ? nRect(x + IND, y, w - IND, hb, 'ns-empty') : B.draw(x + IND, y, w - IND) + (B.h < hb ? nRect(x + IND, y + B.h, w - IND, hb - B.h, 'ns-empty') : '')) + nGrp(ctx, n.endLine, nRect(x, y + hb, w, RH) + txt(x + 8, y + hb + 18, foot, 'start')) };
      }
    }
    return NEMPTY;
  }
  function drawNsd(src, opts) {
    const P = typeof src === 'string' ? parse(src) : { ok: true, prog: src };
    if (!P.ok) return '';
    const ctx = mkCtx(opts), prog = P.prog;
    const mkPart = (cap, list, title) => {
      const B = nSeq(list, ctx), tMin = title ? TW(title) + 20 : 0, min = Math.max(B.min, tMin, 140), th = title ? RH : 0;
      return { cap, w: min, h: th + (B.empty ? RH : B.h), svg: (x, y) => (title ? nRect(x, y, min, RH, 'ns-title') + txt(x + 8, y + 18, title, 'start', 'pp-txt b') : '') + (B.empty ? nRect(x, y + th, min, RH, 'ns-empty') : B.draw(x, y + th, min)) };
    };
    const parts = [mkPart('Hauptprogramm', prog.main, null)].concat(prog.funcList.map(f => mkPart('Funktion ' + f.name + '(' + f.params.join(', ') + ')', f.body, f.name + '(' + f.params.join(', ') + ')')));
    /* PRUEFEN P10: Zuweisungen werden als „x := Ausdruck“ geschrieben (nicht „x ← Ausdruck“ und nicht „x = Ausdruck“); Ein-/Ausgabe als „Eingabe: x“ und „Ausgabe: x“. Welche Schreibweise nutzt ihr im Unterricht und in der Prüfung? */
    return wrapSvg(parts, 'Struktogramm');
  }

  const API = {
    parse, run, valueAfter, lineCount, outLines, fmt: fmtVal, drawPap, drawNsd, nodeText, topTexts, textOf, outTokens, sameOut,
    parseDe, fmtDe, fmtN, rd, rng, ri, pick, shuffle, hashStr, esc: escX, AlgError, BUILTIN
  };
  root.ALG_CORE = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
