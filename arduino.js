'use strict';
/* Tonfunk CodeLab: Interpreter für ein Arduino-C++-Subset.
   Läuft schrittweise (Generatoren): delay() und pulseIn() unterbrechen das Programm bis zur passenden Simulationszeit.
   Kein eval, kein Zugriff auf die Seite: der Sketch erreicht die Außenwelt nur über das io-Objekt. */
(function (root) {

/* ---------- Werte ---------- */
class Fl { constructor(x) { this.x = x; } }                 // Kommazahl (float/double)
class Ch { constructor(c) { this.c = c; } }                 // Zeichen (char): rechnet wie eine Zahl, wird aber als Buchstabe ausgegeben (Serial.print('A') zeigt A, nicht 65)
const isF = v => v instanceof Fl, isC = v => v instanceof Ch;
const N = v => (isF(v) ? v.x : (isC(v) ? v.c : (typeof v === 'boolean' ? (v ? 1 : 0) : (typeof v === 'number' ? v : (typeof v === 'string' ? (parseFloat(v) || 0) : 0)))));
const WRAP = {
  int: x => (x << 16) >> 16, short: x => (x << 16) >> 16, long: x => x | 0, 'long long': x => Math.trunc(x),
  'unsigned int': x => x & 0xFFFF, 'unsigned short': x => x & 0xFFFF, 'unsigned long': x => x >>> 0, 'unsigned long long': x => Math.max(0, Math.trunc(x)),
  byte: x => x & 255, uint8_t: x => x & 255, uint16_t: x => x & 0xFFFF, uint32_t: x => x >>> 0, int8_t: x => (x << 24) >> 24, int16_t: x => (x << 16) >> 16, int32_t: x => x | 0,
  char: x => (x << 24) >> 24, word: x => x & 0xFFFF, size_t: x => x & 0xFFFF, 'unsigned char': x => x & 255,
};
const TYPES = new Set(['int', 'long', 'short', 'float', 'double', 'bool', 'boolean', 'byte', 'char', 'void', 'String', 'size_t', 'word', 'uint8_t', 'uint16_t', 'uint32_t', 'int8_t', 'int16_t', 'int32_t', 'unsigned', 'signed', 'const', 'static', 'volatile', 'auto']);
const CLASSES = new Set(['Servo', 'LiquidCrystal', 'LiquidCrystal_I2C', 'CapacitiveSensor', 'DHT', 'NewPing', 'Stepper']);
function norm(v, type) {                                      // Wert beim Speichern in eine Variable des Typs umwandeln
  if (type === 'float') return new Fl(Math.fround(N(v)));
  if (type === 'double') return new Fl(N(v));
  if (type === 'bool' || type === 'boolean') return N(v) ? 1 : 0;
  if (type === 'String') return typeof v === 'string' ? v : (isF(v) ? fmtF(v.x, 2) : (isC(v) ? chStr(v) : String(v)));
  if (type === 'char') return new Ch(WRAP.char(Math.trunc(N(v))));
  const w = WRAP[type]; if (w) return w(Math.trunc(N(v)));
  return v;
}
const fmtF = (x, d) => (isFinite(x) ? x.toFixed(d) : (x !== x ? 'nan' : (x > 0 ? 'inf' : '-inf')));
const chStr = v => String.fromCharCode(v.c & 255);

/* ---------- Lexer ---------- */
const KW_OPS = ['<<=', '>>=', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '==', '!=', '<=', '>=', '&&', '||', '<<', '>>', '->'];
function lex(src, errors) {
  const toks = [], macros = {}; let i = 0, line = 1; const n = src.length;
  const err = (m) => { errors.push({ line, msg: m }); };
  const NOTES = ['C', 'CS', 'D', 'DS', 'E', 'F', 'FS', 'G', 'GS', 'A', 'AS', 'B'];
  while (i < n) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; } i += 2; continue; }
    if (c === '#') {
      let j = i; while (j < n && src[j] !== '\n') j++; const dl = src.slice(i, j); i = j;
      const m = dl.match(/^#\s*define\s+([A-Za-z_]\w*)\s+(.+?)\s*$/); if (m) macros[m[1]] = m[2];
      continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      let j = i, isFloat = false, val;
      if (c === '0' && /[xX]/.test(src[i + 1] || '')) { j = i + 2; while (/[0-9a-fA-F]/.test(src[j] || '')) j++; val = parseInt(src.slice(i + 2, j), 16); }
      else if (c === '0' && /[bB]/.test(src[i + 1] || '')) { j = i + 2; while (/[01]/.test(src[j] || '')) j++; val = parseInt(src.slice(i + 2, j), 2); }
      else {
        while (/[0-9]/.test(src[j] || '')) j++;
        if (src[j] === '.') { isFloat = true; j++; while (/[0-9]/.test(src[j] || '')) j++; }
        if (/[eE]/.test(src[j] || '') && /[-+0-9]/.test(src[j + 1] || '')) { isFloat = true; j += 2; while (/[0-9]/.test(src[j] || '')) j++; }
        val = parseFloat(src.slice(i, j));
      }
      while (/[uUlLfF]/.test(src[j] || '')) { if (/[fF]/.test(src[j]) && !/^0[xX]/.test(src.slice(i, i + 2))) isFloat = true; j++; }
      toks.push({ t: 'num', v: val, f: isFloat, line }); i = j; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i; while (/[\w]/.test(src[j] || '')) j++; const w = src.slice(i, j); i = j;
      if (macros[w] !== undefined) { const sub = []; lex(macros[w], errors).forEach(t => { t.line = line; sub.push(t); }); sub.pop(); toks.push(...sub.filter(t => t.t !== 'eof')); continue; }
      toks.push({ t: 'id', v: w, line }); continue;
    }
    if (c === '"') {
      let j = i + 1, s = '';
      while (j < n && src[j] !== '"') { if (src[j] === '\\') { const e = src[j + 1]; s += ({ n: '\n', t: '\t', r: '\r', '0': '\0', '\\': '\\', '"': '"', "'": "'" }[e] ?? e); j += 2; } else { if (src[j] === '\n') { err('Text in Anführungszeichen nicht abgeschlossen'); break; } s += src[j++]; } }
      toks.push({ t: 'str', v: s, line }); i = j + 1; continue;
    }
    if (c === "'") {
      let j = i + 1, s = '';
      if (src[j] === '\\') { const e = src[j + 1]; s = ({ n: '\n', t: '\t', r: '\r', '0': '\0', '\\': '\\', "'": "'" }[e] ?? e); j += 2; } else s = src[j++];
      if (src[j] === "'") j++; else err('Zeichen-Konstante nicht abgeschlossen');
      toks.push({ t: 'num', v: s.charCodeAt(0), f: false, ch: true, line }); i = j; continue;
    }
    let op = null; for (const o of KW_OPS) if (src.startsWith(o, i)) { op = o; break; }
    if (!op) op = c;
    if (!/[-+*/%=<>!&|^~?:;,.(){}\[\]]/.test(op[0])) { err('Unbekanntes Zeichen „' + c + '“'); i++; continue; }
    toks.push({ t: 'op', v: op, line }); i += op.length;
  }
  // Tonhöhen (pitches.h) als Makros
  toks.push({ t: 'eof', line });
  return toks;
}

/* ---------- Parser ---------- */
function parse(toks, errors) {
  let p = 0; const peek = (k = 0) => toks[Math.min(p + k, toks.length - 1)];
  const isOp = (v, k = 0) => { const t = peek(k); return t.t === 'op' && t.v === v; };
  const isId = (v, k = 0) => { const t = peek(k); return t.t === 'id' && t.v === v; };
  class PErr extends Error {}
  const fail = (m, t) => { errors.push({ line: (t || peek()).line, msg: m }); throw new PErr(m); };
  const eat = v => { if (isOp(v)) return toks[p++]; const t = peek(); fail('„' + v + '“ erwartet, gefunden: ' + (t.t === 'eof' ? 'Dateiende' : '„' + (t.v) + '“'), t); };
  const ident = () => { const t = peek(); if (t.t !== 'id') fail('Name erwartet', t); p++; return t.v; };

  function typeAt() {          // liest Typangabe ab p; gibt {type, isConst} oder null (ohne p zu ändern)
    let q = p, parts = [], isConst = false;
    while (toks[q] && toks[q].t === 'id' && (TYPES.has(toks[q].v) || CLASSES.has(toks[q].v))) {
      const v = toks[q].v; if (v === 'const') isConst = true; else if (v !== 'static' && v !== 'volatile') parts.push(v); q++;
      if (CLASSES.has(v)) break;
    }
    if (!parts.length) return null;
    let type; const has = w => parts.includes(w);
    if (has('unsigned')) { const base = parts.filter(x => x !== 'unsigned')[0] || 'int'; type = 'unsigned ' + (base === 'char' ? 'char' : base); if (parts.filter(x => x === 'long').length > 1) type = 'unsigned long long'; }
    else if (has('long') && parts.filter(x => x === 'long').length > 1) type = 'long long';
    else if (has('long') && has('double')) type = 'double';
    else type = parts.filter(x => x !== 'signed')[0] || 'int';
    return { type, isConst, len: q - p };
  }
  function funcAhead(ty) {       // steht ab p „Typ name (“, also ein Funktionskopf mitten im Block? (nicht bei Objekten wie Servo s(9))
    return !CLASSES.has(ty.type) && peek(ty.len).t === 'id' && isOp('(', ty.len + 1) && (isOp(')', ty.len + 2) || (peek(ty.len + 2).t === 'id' && TYPES.has(peek(ty.len + 2).v))) ? peek(ty.len).v : null;
  }

  function program() {
    const prog = { globals: [], funcs: {}, decls: [] };
    while (peek().t !== 'eof') {
      try {
        const ty = typeAt(); if (!ty) fail(isOp('}') ? 'Eine schließende Klammer „}“ zu viel' : 'Hier wird eine Funktion oder Variable erwartet', peek());
        const start = p; p += ty.len; const nm = ident();
        if (isOp('(') && !CLASSES.has(ty.type)) { // Funktion
          p++; const params = [];
          if (!isOp(')')) do { const pt = typeAt(); if (!pt) { if (isId('void')) { p++; break; } fail('Parametertyp erwartet'); } p += pt.len; let ref = false; if (isOp('&')) { p++; ref = true; } const pn = ident(); let arr = false; if (isOp('[')) { p++; eat(']'); arr = true; } params.push({ type: pt.type, name: pn, arr, ref }); } while (isOp(',') && (p++, true));
          eat(')'); const body = block(); prog.funcs[nm] = { name: nm, ret: ty.type, params, body, line: toks[start].line };
        } else { p = start; prog.globals.push(declStmt()); }
      } catch (e) { if (!(e instanceof PErr)) throw e; // bis zum nächsten sinnvollen Punkt überspringen
        let depth = 0; while (peek().t !== 'eof') { const t = peek(); if (t.t === 'op' && t.v === '{') depth++; if (t.t === 'op' && t.v === '}') { depth--; if (depth <= 0) { p++; break; } } if (t.t === 'op' && t.v === ';' && depth <= 0) { p++; break; } p++; } }
    }
    return prog;
  }

  function declStmt() {        // Typ name [= init] {, name ...} ;   auch Objekte: Servo s;  LiquidCrystal_I2C lcd(0x27,16,2);
    const line = peek().line, ty = typeAt(); p += ty.len; const items = [];
    do {
      const nm = ident(); let arr = null, init = null, ctor = null;
      if (isOp('[')) { p++; arr = isOp(']') ? { auto: true } : { size: expr() }; eat(']'); }
      if (CLASSES.has(ty.type) && isOp('(')) { p++; ctor = []; if (!isOp(')')) do ctor.push(expr()); while (isOp(',') && (p++, true)); eat(')'); }
      else if (isOp('=')) { p++; init = initializer(); }
      items.push({ name: nm, arr, init, ctor });
    } while (isOp(',') && (p++, true));
    eat(';'); return { k: 'decl', type: ty.type, isConst: ty.isConst, items, line };
  }
  function initializer() { if (isOp('{')) { p++; const a = []; if (!isOp('}')) do { if (isOp('}')) break; a.push(initializer()); } while (isOp(',') && (p++, true)); eat('}'); return { k: 'list', items: a }; } return expr(); }
  function block() { const line = peek().line; eat('{'); const body = []; while (!isOp('}')) { if (peek().t === 'eof') fail('„}“ fehlt am Ende', toks[p]); body.push(stmt()); } p++; return { k: 'block', body, line }; }
  function stmt() {
    const t = peek(), line = t.line;
    if (isOp('{')) return block();
    if (isOp(';')) { p++; return { k: 'empty', line }; }
    if (t.t === 'id') {
      switch (t.v) {
        case 'if': { p++; eat('('); const c = expr(); eat(')'); const a = stmt(); let b = null; if (isId('else')) { p++; b = stmt(); } return { k: 'if', c, a, b, line }; }
        case 'while': { p++; eat('('); const c = expr(); eat(')'); return { k: 'while', c, body: stmt(), line }; }
        case 'do': { p++; const body = stmt(); if (!isId('while')) fail('„while“ erwartet'); p++; eat('('); const c = expr(); eat(')'); eat(';'); return { k: 'do', c, body, line }; }
        case 'for': { p++; eat('('); let init = null; if (!isOp(';')) { init = typeAt() ? declStmt() : (() => { const e = expr(); eat(';'); return { k: 'expr', e, line }; })(); } else p++;
          let c = null; if (!isOp(';')) c = expr(); eat(';'); let step = null; if (!isOp(')')) step = expr(); eat(')'); return { k: 'for', init, c, step, body: stmt(), line }; }
        case 'switch': { p++; eat('('); const e = expr(); eat(')'); eat('{'); const cases = []; let cur = null;
          while (!isOp('}')) { if (isId('case')) { p++; const v = expr(); eat(':'); cur = { v, body: [] }; cases.push(cur); } else if (isId('default')) { p++; eat(':'); cur = { v: null, body: [] }; cases.push(cur); } else { if (!cur) fail('„case“ erwartet'); cur.body.push(stmt()); } }
          p++; return { k: 'switch', e, cases, line }; }
        case 'break': p++; eat(';'); return { k: 'break', line };
        case 'continue': p++; eat(';'); return { k: 'continue', line };
        case 'return': { p++; let e = null; if (!isOp(';')) e = expr(); eat(';'); return { k: 'return', e, line }; }
      }
      const ty = typeAt();
      if (ty) { const fn = funcAhead(ty); if (fn) fail('Hier beginnt die Funktion „' + fn + '()“: vermutlich fehlt davor eine schließende Klammer „}“', t); return declStmt(); }
    }
    const e = expr(); eat(';'); return { k: 'expr', e, line };
  }

  const PREC = { '||': 1, '&&': 2, '|': 3, '^': 4, '&': 5, '==': 6, '!=': 6, '<': 7, '>': 7, '<=': 7, '>=': 7, '<<': 8, '>>': 8, '+': 9, '-': 9, '*': 10, '/': 10, '%': 10 };
  const ASSIGN = new Set(['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=']);
  function expr() { return assign(); }
  function assign() {
    const l = ternary(); const t = peek();
    if (t.t === 'op' && ASSIGN.has(t.v)) { if (l.k !== 'id' && l.k !== 'idx') fail('Links von „' + t.v + '“ muss eine Variable stehen', t); p++; const r = assign(); return { k: 'assign', op: t.v, l, r, line: t.line }; }
    return l;
  }
  function ternary() { const c = binary(1); if (isOp('?')) { p++; const a = assign(); eat(':'); const b = assign(); return { k: 'tern', c, a, b, line: c.line }; } return c; }
  function binary(min) {
    let l = unary();
    for (;;) { const t = peek(); if (t.t !== 'op' || !(t.v in PREC) || PREC[t.v] < min) break; p++; const r = binary(PREC[t.v] + 1); l = { k: 'bin', op: t.v, l, r, line: t.line }; }
    return l;
  }
  function unary() {
    const t = peek();
    if (t.t === 'op') {
      if (['!', '-', '+', '~'].includes(t.v)) { p++; return { k: 'un', op: t.v, e: unary(), line: t.line }; }
      if (t.v === '++' || t.v === '--') { p++; const e = unary(); return { k: 'inc', op: t.v, e, pre: true, line: t.line }; }
      if (t.v === '(' && peek(1).t === 'id' && (TYPES.has(peek(1).v)) && !CLASSES.has(peek(1).v)) { const save = p; p++; const ty = typeAt(); if (ty) { p += ty.len; if (isOp(')')) { p++; return { k: 'cast', type: ty.type, e: unary(), line: t.line }; } } p = save; }
    }
    return postfix();
  }
  function postfix() {
    let e = primary();
    for (;;) {
      const t = peek();
      if (t.t !== 'op') break;
      if (t.v === '(' && e.k === 'id') { p++; const args = []; if (!isOp(')')) do args.push(expr()); while (isOp(',') && (p++, true)); eat(')'); e = { k: 'call', name: e.name, args, line: t.line }; }
      else if (t.v === '[') { p++; const i = expr(); eat(']'); e = { k: 'idx', a: e, i, line: t.line }; }
      else if (t.v === '.') { p++; const m = ident(); let args = []; if (isOp('(')) { p++; if (!isOp(')')) do args.push(expr()); while (isOp(',') && (p++, true)); eat(')'); } e = { k: 'mcall', obj: e, name: m, args, line: t.line }; }
      else if (t.v === '++' || t.v === '--') { p++; e = { k: 'inc', op: t.v, e, pre: false, line: t.line }; }
      else break;
    }
    return e;
  }
  function primary() {
    const t = peek();
    if (t.t === 'num') { p++; return { k: 'num', v: t.v, f: t.f, ch: !!t.ch, line: t.line }; }
    if (t.t === 'str') { p++; return { k: 'str', v: t.v, line: t.line }; }
    if (t.t === 'id') {
      p++;
      if (t.v === 'true') return { k: 'num', v: 1, f: false, line: t.line };
      if (t.v === 'false') return { k: 'num', v: 0, f: false, line: t.line };
      if (CLASSES.has(t.v) && isOp('(')) { p++; const args = []; if (!isOp(')')) do args.push(expr()); while (isOp(',') && (p++, true)); eat(')'); return { k: 'new', cls: t.v, args, line: t.line }; }
      if (t.v === 'String' && isOp('(')) { p++; const args = []; if (!isOp(')')) do args.push(expr()); while (isOp(',') && (p++, true)); eat(')'); return { k: 'call', name: 'String', args, line: t.line }; }
      if (t.v === 'sizeof') { eat('('); const e = expr(); eat(')'); return { k: 'sizeof', e, line: t.line }; }
      return { k: 'id', name: t.v, line: t.line };
    }
    if (t.t === 'op' && t.v === '(') { p++; const e = expr(); eat(')'); return e; }
    fail('Ausdruck erwartet, gefunden: ' + (t.t === 'eof' ? 'Dateiende' : '„' + t.v + '“'), t);
  }
  return program();
}

/* ---------- Standardkonstanten ---------- */
function constants() {
  const c = { HIGH: 1, LOW: 0, INPUT: 0, OUTPUT: 1, INPUT_PULLUP: 2, LED_BUILTIN: 13, PI: new Fl(Math.PI), HALF_PI: new Fl(Math.PI / 2), TWO_PI: new Fl(Math.PI * 2), DEG_TO_RAD: new Fl(Math.PI / 180), RAD_TO_DEG: new Fl(180 / Math.PI),
    LSBFIRST: 0, MSBFIRST: 1, DEC: 10, HEX: 16, OCT: 8, BIN: 2, A0: 14, A1: 15, A2: 16, A3: 17, A4: 18, A5: 19, A6: 20, A7: 21, SDA: 18, SCL: 19, SS: 10, MOSI: 11, MISO: 12, SCK: 13 };
  const names = ['C', 'CS', 'D', 'DS', 'E', 'F', 'FS', 'G', 'GS', 'A', 'AS', 'B'];
  for (let o = 0; o <= 8; o++) names.forEach((nm, i) => { const midi = 12 * (o + 1) + i; c['NOTE_' + nm + o] = Math.round(440 * Math.pow(2, (midi - 69) / 12)); });
  c.NOTE_B0 = 31;
  return c;
}

/* ---------- Laufzeit ---------- */
class RuntimeError extends Error { constructor(m, line) { super(m); this.line = line; } }
class Scope { constructor(parent) { this.v = new Map(); this.parent = parent; }
  find(n) { for (let s = this; s; s = s.parent) if (s.v.has(n)) return s; return null; }
}
const BRK = { b: 1 }, CNT = { c: 1 };

function compile(src) {
  const errors = []; const toks = lex(String(src || ''), errors);
  let prog = null; if (!errors.length) prog = parse(toks, errors);
  if (prog && !errors.length) { if (!prog.funcs.setup) errors.push({ line: 1, msg: 'Die Funktion setup() fehlt.' }); if (!prog.funcs.loop) errors.push({ line: 1, msg: 'Die Funktion loop() fehlt.' }); }
  return { ok: !errors.length, errors, program: prog };
}

function createRunner(prog, io) {
  const consts = constants(), globals = new Scope(null), self = { t: 0, debt: 0, wakeAt: 0, done: false, error: null, ops: 0, loops: 0, started: false, serialBuf: '', rng: 12345 };
  const objects = [];
  const rnd = () => { self.rng = (Math.imul(self.rng, 1103515245) + 12345) & 0x7fffffff; return self.rng >> 8; };   // Math.imul: exakte 32-Bit-Rechnung; hohe Bits nutzen (die niedrigen eines LCG wechseln zu regelmäßig)
  const err = (m, line) => new RuntimeError(m, line);
  const T = v => (typeof v === 'string' ? v.length > 0 : N(v) !== 0);

  /* eingebaute Funktionen: normale (sync) und blockierende (Generatoren) */
  const mathF = fn => (a) => new Fl(fn(...a.map(N)));
  const B = {
    pinMode: a => { io.pinMode(N(a[0]) | 0, N(a[1]) | 0); },
    digitalWrite: a => { io.digitalWrite(N(a[0]) | 0, N(a[1]) ? 1 : 0, self.vt); },
    digitalRead: a => io.digitalRead(N(a[0]) | 0) ? 1 : 0,
    analogRead: a => { let p = N(a[0]) | 0; if (p < 14) p += 14; return Math.max(0, Math.min(1023, Math.round(io.analogRead(p)))); },
    analogWrite: a => { io.analogWrite(N(a[0]) | 0, Math.max(0, Math.min(255, N(a[1]) | 0))); },
    analogReference: () => {}, analogReadResolution: () => {},
    millis: () => (Math.floor(self.t * 1000) >>> 0), micros: () => (Math.floor(self.t * 1e6) >>> 0),
    tone: a => { io.tone(N(a[0]) | 0, N(a[1]), a.length > 2 ? N(a[2]) : 0); }, noTone: a => { io.noTone(N(a[0]) | 0); },
    map: a => { const [x, i0, i1, o0, o1] = a.map(N); const r = (x - i0) * (o1 - o0) / ((i1 - i0) || 1) + o0; return a.some(isF) ? new Fl(r) : Math.trunc(r); },
    constrain: a => { const [x, lo, hi] = a.map(N); const r = Math.min(Math.max(x, lo), hi); return a.some(isF) ? new Fl(r) : r; },
    min: a => { const r = Math.min(N(a[0]), N(a[1])); return a.some(isF) ? new Fl(r) : r; }, max: a => { const r = Math.max(N(a[0]), N(a[1])); return a.some(isF) ? new Fl(r) : r; },
    abs: a => (isF(a[0]) ? new Fl(Math.abs(a[0].x)) : Math.abs(N(a[0]))), sq: a => (isF(a[0]) ? new Fl(a[0].x ** 2) : N(a[0]) ** 2),
    pow: mathF((x, y) => Math.pow(x, y)), sqrt: mathF(Math.sqrt), sin: mathF(Math.sin), cos: mathF(Math.cos), tan: mathF(Math.tan), atan: mathF(Math.atan), atan2: mathF(Math.atan2), asin: mathF(Math.asin), acos: mathF(Math.acos),
    log: mathF(Math.log), log10: mathF(Math.log10), exp: mathF(Math.exp), floor: mathF(Math.floor), ceil: mathF(Math.ceil), round: mathF(Math.round), fabs: mathF(Math.abs),
    radians: mathF(x => x * Math.PI / 180), degrees: mathF(x => x * 180 / Math.PI),
    random: a => { const lo = a.length > 1 ? N(a[0]) : 0, hi = a.length > 1 ? N(a[1]) : N(a[0]); return hi <= lo ? lo : lo + (rnd() % (hi - lo)); },
    randomSeed: a => { self.rng = N(a[0]) | 0; },
    bitRead: a => (N(a[0]) >> N(a[1])) & 1, bitSet: a => N(a[0]) | (1 << N(a[1])), bitClear: a => N(a[0]) & ~(1 << N(a[1])), lowByte: a => N(a[0]) & 255, highByte: a => (N(a[0]) >> 8) & 255,
    isDigit: a => (N(a[0]) >= 48 && N(a[0]) <= 57 ? 1 : 0), isAlpha: a => (/[A-Za-z]/.test(String.fromCharCode(N(a[0]))) ? 1 : 0),
    String: a => { const v = a[0]; if (isF(v)) return fmtF(v.x, a.length > 1 ? N(a[1]) : 2); if (typeof v === 'string') return v; if (isC(v) && a.length < 2) return chStr(v); if (a.length > 1 && N(a[1]) === 16) return (N(v) >>> 0).toString(16).toUpperCase(); if (a.length > 1 && N(a[1]) === 2) return (N(v) >>> 0).toString(2); return String(N(v)); },
    attachInterrupt: () => {}, detachInterrupt: () => {}, digitalPinToInterrupt: a => N(a[0]), noInterrupts: () => {}, interrupts: () => {},
    yield: () => {}, shiftOut: () => {},
  };
  const GENB = {
    delay: function* (a) { self.wakeAt = self.t + N(a[0]) / 1000; yield { t: 'wait' }; },
    delayMicroseconds: function* (a) { const us = N(a[0]); if (us >= 50) { self.wakeAt = self.t + us / 1e6; yield { t: 'wait' }; } else { self.vt += us / 1e6; self.debt += us / 1e6; } },
    pulseIn: function* (a) {
      const pin = N(a[0]) | 0, lvl = N(a[1]) ? 1 : 0, timeout = (a.length > 2 ? N(a[2]) : 1000000) / 1e6, t0 = self.t;
      const hint = io.pulseHint ? io.pulseHint(pin, lvl) : null;
      for (;;) { if (io.digitalRead(pin) === lvl) break; if (self.t - t0 > timeout) return 0; self.wakeAt = self.t; yield { t: 'tick' }; }
      const s = self.t;
      for (;;) { if (io.digitalRead(pin) !== lvl) break; if (self.t - s > timeout) return 0; self.wakeAt = self.t; yield { t: 'tick' }; }
      const hint2 = io.pulseHint ? io.pulseHint(pin, lvl) : hint;
      return Math.round(hint2 != null ? hint2 : (self.t - s) * 1e6);
    },
  };

  /* Objekte: Serial, Servo, LCD, ... */
  const fmtNum = (v, base) => {
    if (typeof v === 'string') return v;
    if (isC(v) && base == null) return chStr(v);                     // char ohne Zahlenbasis: als Buchstabe, wie beim echten Arduino
    if (isF(v)) return fmtF(v.x, base == null ? 2 : base);
    const x = N(v); if (base === 16) return (x >>> 0).toString(16).toUpperCase(); if (base === 2) return (x >>> 0).toString(2); if (base === 8) return (x >>> 0).toString(8);
    return String(x);
  };
  const Serial = {
    begin: () => {}, end: () => {}, flush: () => {}, setTimeout: () => {},
    print: a => { const s = fmtNum(a[0], a.length > 1 ? N(a[1]) : null); self.debt += s.length * 5e-4; io.serialPrint(s); },
    println: a => { const s = (a.length ? fmtNum(a[0], a.length > 1 ? N(a[1]) : null) : '') + '\n'; self.debt += s.length * 5e-4; io.serialPrint(s); },
    write: a => { const s = typeof a[0] === 'string' ? a[0] : String.fromCharCode(N(a[0])); self.debt += s.length * 5e-4; io.serialPrint(s); },
    available: () => (io.serialAvailable ? io.serialAvailable() : 0), read: () => (io.serialRead ? io.serialRead() : -1),
    parseInt: () => (io.serialParseInt ? io.serialParseInt() : 0), readString: () => (io.serialReadString ? io.serialReadString() : ''), readStringUntil: () => (io.serialReadString ? io.serialReadString() : ''),
  };
  function makeObject(cls, args) {
    const o = { cls, id: objects.length, a: args.map(x => (typeof x === 'string' ? x : N(x))) }; objects.push(o); if (io.object) io.object(o); return o;
  }
  function callMethod(obj, name, a) {
    if (obj === Serial) { if (!Serial[name]) throw err('Serial.' + name + '() kenne ich nicht'); return Serial[name](a); }
    if (obj && obj.cls) {
      switch (obj.cls) {
        case 'Servo':
          if (name === 'attach') { obj.pin = N(a[0]) | 0; io.servo(obj.pin, 'attach', obj.angle == null ? 90 : obj.angle); return; }
          if (name === 'write') { obj.angle = Math.max(0, Math.min(180, N(a[0]))); if (obj.pin != null) io.servo(obj.pin, 'write', obj.angle); return; }
          if (name === 'writeMicroseconds') { obj.angle = Math.max(0, Math.min(180, (N(a[0]) - 544) * 180 / 1856)); if (obj.pin != null) io.servo(obj.pin, 'write', obj.angle); return; }
          if (name === 'read') return Math.round(obj.angle == null ? 90 : obj.angle);
          if (name === 'detach') { if (obj.pin != null) io.servo(obj.pin, 'detach'); obj.pin = null; return; }
          if (name === 'attached') return obj.pin != null ? 1 : 0;
          break;
        case 'LiquidCrystal': case 'LiquidCrystal_I2C':
          return io.lcd(obj, name, a.map(x => (typeof x === 'string' ? x : (isF(x) ? fmtF(x.x, 2) : (isC(x) ? chStr(x) : N(x))))));
        case 'CapacitiveSensor': if (name === 'capacitiveSensor') return io.touch ? io.touch(obj.a[1], N(a[0])) : 0; if (name.startsWith('set')) return; break;
        default: break;
      }
      throw err(obj.cls + '.' + name + '() kenne ich nicht');
    }
    if (typeof obj === 'string') {
      switch (name) { case 'length': return obj.length; case 'charAt': return new Ch(obj.charCodeAt(N(a[0])) || 0); case 'substring': return obj.substring(N(a[0]), a.length > 1 ? N(a[1]) : undefined); case 'toInt': return parseInt(obj, 10) || 0; case 'toFloat': return new Fl(parseFloat(obj) || 0); case 'indexOf': return obj.indexOf(typeof a[0] === 'string' ? a[0] : String.fromCharCode(N(a[0]))); case 'toUpperCase': return obj.toUpperCase(); case 'toLowerCase': return obj.toLowerCase(); case 'trim': return obj.trim(); case 'equals': return obj === a[0] ? 1 : 0; case 'startsWith': return obj.startsWith(a[0]) ? 1 : 0; default: throw err('String.' + name + '() kenne ich nicht'); }
    }
    throw err('Diese Methode „' + name + '“ gibt es hier nicht');
  }

  /* Auswertung */
  function* ev(n, sc) {
    if (++self.ops % 300 === 0) yield { t: 'tick' };
    switch (n.k) {
      case 'num': return n.f ? new Fl(n.v) : (n.ch ? new Ch(n.v) : n.v);
      case 'str': return n.v;
      case 'id': {
        const s = sc.find(n.name); if (s) return s.v.get(n.name).val;
        if (n.name === 'Serial') return Serial;
        if (n.name in consts) return consts[n.name];
        throw err('„' + n.name + '“ ist nicht deklariert (Tippfehler?)', n.line);
      }
      case 'un': { const v = yield* ev(n.e, sc); if (n.op === '!') return T(v) ? 0 : 1; if (n.op === '-') return isF(v) ? new Fl(-v.x) : -N(v); if (n.op === '~') return ~N(v); return v; }
      case 'cast': { const v = yield* ev(n.e, sc); return norm(v, n.type); }
      case 'tern': return (T(yield* ev(n.c, sc))) ? yield* ev(n.a, sc) : yield* ev(n.b, sc);
      case 'bin': {
        if (n.op === '&&') { const a = yield* ev(n.l, sc); if (!T(a)) return 0; return T(yield* ev(n.r, sc)) ? 1 : 0; }
        if (n.op === '||') { const a = yield* ev(n.l, sc); if (T(a)) return 1; return T(yield* ev(n.r, sc)) ? 1 : 0; }
        const a = yield* ev(n.l, sc), b = yield* ev(n.r, sc); return binop(n.op, a, b, n.line);
      }
      case 'call': {
        const args = []; for (const a of n.args) args.push(yield* ev(a, sc));
        const f = prog.funcs[n.name];
        if (f) return yield* callUser(f, args, n);
        if (GENB[n.name]) return yield* GENB[n.name](args);
        if (B[n.name]) return B[n.name](args);
        throw err('Die Funktion „' + n.name + '“ kenne ich nicht', n.line);
      }
      case 'new': { const args = []; for (const a of n.args) args.push(yield* ev(a, sc)); return makeObject(n.cls, args); }
      case 'mcall': { const obj = yield* ev(n.obj, sc); const args = []; for (const a of n.args) args.push(yield* ev(a, sc)); try { return callMethod(obj, n.name, args); } catch (e) { if (e instanceof RuntimeError && !e.line) e.line = n.line; throw e; } }
      case 'idx': { const a = yield* ev(n.a, sc), i = N(yield* ev(n.i, sc)); if (typeof a === 'string') return new Ch(a.charCodeAt(i) || 0); if (!Array.isArray(a)) throw err('Das ist kein Feld (Array)', n.line); if (i < 0 || i >= a.length) throw err('Index ' + i + ' liegt außerhalb des Feldes (Größe ' + a.length + ')', n.line); return a[i]; }
      case 'sizeof': { const v = yield* ev(n.e, sc); return Array.isArray(v) ? v.length * 2 : 2; }
      case 'inc': {
        const old = yield* ev(n.e, sc), nv = binop(n.op === '++' ? '+' : '-', old, 1, n.line); yield* store(n.e, nv, sc, n.line); return n.pre ? yield* ev(n.e, sc) : old;
      }
      case 'assign': {
        let v = yield* ev(n.r, sc);
        if (n.op !== '=') { const cur = yield* ev(n.l, sc); v = binop(n.op.slice(0, -1), cur, v, n.line); }
        yield* store(n.l, v, sc, n.line); return yield* ev(n.l, sc);
      }
      default: throw err('Unbekannter Ausdruck', n.line);
    }
  }
  function* store(l, v, sc, line) {
    if (l.k === 'id') { const s = sc.find(l.name); if (!s) throw err('„' + l.name + '“ ist nicht deklariert', line); const slot = s.v.get(l.name); if (slot.isConst) throw err('„' + l.name + '“ ist const und lässt sich nicht ändern', line); slot.val = norm(v, slot.type); return; }
    if (l.k === 'idx') { const arr = yield* ev(l.a, sc), i = N(yield* ev(l.i, sc)); if (!Array.isArray(arr)) throw err('Das ist kein Feld (Array)', line); if (i < 0 || i >= arr.length) throw err('Index ' + i + ' liegt außerhalb des Feldes (Größe ' + arr.length + ')', line); const t = arr.etype || 'int'; arr[i] = norm(v, t); return; }
    throw err('Hier kann nichts gespeichert werden', line);
  }
  function binop(op, a, b, line) {
    if ((typeof a === 'string' || typeof b === 'string') && op === '+') return fmtNum(a) + fmtNum(b);
    if (typeof a === 'string' && typeof b === 'string' && (op === '==' || op === '!=')) return (a === b) === (op === '==') ? 1 : 0;
    const fl = isF(a) || isF(b), x = N(a), y = N(b); let r;
    switch (op) {
      case '+': r = x + y; break; case '-': r = x - y; break; case '*': r = x * y; break;
      case '/': if (fl) r = x / y; else { if (y === 0) throw err('Teilen durch 0', line); r = Math.trunc(x / y); } break;
      case '%': if (y === 0) throw err('Rest bei Teilung durch 0', line); r = x % y; break;
      case '<': return x < y ? 1 : 0; case '>': return x > y ? 1 : 0; case '<=': return x <= y ? 1 : 0; case '>=': return x >= y ? 1 : 0; case '==': return x === y ? 1 : 0; case '!=': return x !== y ? 1 : 0;
      case '&': return x & y; case '|': return x | y; case '^': return x ^ y; case '<<': return x << y; case '>>': return x >> y;
      default: throw err('Operator ' + op + ' nicht unterstützt', line);
    }
    return fl ? new Fl(r) : r;
  }
  function* callUser(f, args, n) {
    if (args.length !== f.params.length) throw err('Die Funktion „' + f.name + '“ erwartet ' + f.params.length + ' Parameter', n.line);
    const sc = new Scope(globals);
    f.params.forEach((pa, i) => { sc.v.set(pa.name, { val: pa.arr ? args[i] : norm(args[i], pa.type), type: pa.type }); });
    if (++self.depth > 60) throw err('Zu viele verschachtelte Funktionsaufrufe (Rekursion ohne Ende?)', n.line);
    try { const r = yield* exec(f.body, sc); if (r && r.ret) return f.ret === 'void' ? 0 : norm(r.v, f.ret); return f.ret === 'void' ? 0 : 0; } finally { self.depth--; }
  }
  function* initVal(it, type, sc, line) {
    if (it.arr) {
      let size = null; if (it.arr.size) size = N(yield* ev(it.arr.size, sc));
      let arr;
      if (it.init && it.init.k === 'list') { arr = []; for (const x of it.init.items) arr.push(norm(yield* ev(x, sc), type)); if (size != null) while (arr.length < size) arr.push(norm(0, type)); }
      else if (it.init && typeof (yield* ev(it.init, sc)) === 'string') { const s = yield* ev(it.init, sc); arr = Array.from(s).map(ch => norm(ch.charCodeAt(0), type)); arr.push(norm(0, type)); }
      else { if (size == null) throw err('Die Feldgröße fehlt', line); arr = Array.from({ length: size }, () => norm(0, type)); }
      arr.etype = type; return arr;
    }
    if (CLASSES.has(type)) { const args = []; for (const a of it.ctor || []) args.push(yield* ev(a, sc)); if (it.init) { return yield* ev(it.init, sc); } return makeObject(type, args); }
    if (it.init) return norm(yield* ev(it.init, sc), type);
    return type === 'String' ? '' : norm(0, type);
  }
  function* exec(n, sc) {
    if (++self.ops % 300 === 0) yield { t: 'tick' };
    switch (n.k) {
      case 'empty': return null;
      case 'block': { const s2 = new Scope(sc); for (const st of n.body) { const r = yield* exec(st, s2); if (r) return r; } return null; }
      case 'decl': for (const it of n.items) { const v = yield* initVal(it, n.type, sc, n.line); sc.v.set(it.name, { val: v, type: n.type, isConst: n.isConst && !it.arr }); } return null;
      case 'expr': yield* ev(n.e, sc); return null;
      case 'if': { if (T(yield* ev(n.c, sc))) return yield* exec(n.a, sc); if (n.b) return yield* exec(n.b, sc); return null; }
      case 'while': { while (T(yield* ev(n.c, sc))) { const r = yield* exec(n.body, sc); if (r === BRK) break; if (r && r.ret) return r; if (r === CNT) continue; yield* spin(); } return null; }
      case 'do': { do { const r = yield* exec(n.body, sc); if (r === BRK) break; if (r && r.ret) return r; yield* spin(); } while (T(yield* ev(n.c, sc))); return null; }
      case 'for': {
        const s2 = new Scope(sc); if (n.init) yield* exec(n.init, s2);
        while (n.c ? T(yield* ev(n.c, s2)) : true) { const r = yield* exec(n.body, s2); if (r === BRK) break; if (r && r.ret) return r; if (n.step) yield* ev(n.step, s2); yield* spin(); }
        return null;
      }
      case 'switch': { const v = N(yield* ev(n.e, sc)); let hit = -1; n.cases.forEach((c, i) => { if (hit < 0 && c.v && N(constEval(c.v)) === v) hit = i; }); if (hit < 0) hit = n.cases.findIndex(c => !c.v);
        if (hit >= 0) for (let i = hit; i < n.cases.length; i++) for (const st of n.cases[i].body) { const r = yield* exec(st, new Scope(sc)); if (r === BRK) return null; if (r) return r; } return null; }
      case 'break': return BRK;
      case 'continue': return CNT;
      case 'return': return { ret: true, v: n.e ? yield* ev(n.e, sc) : 0 };
      default: throw err('Unbekannte Anweisung', n.line);
    }
  }
  function constEval(n) { if (n.k === 'num') return n.v; if (n.k === 'id') { const c = consts[n.name]; if (c !== undefined) return c; const s = globals.find(n.name); if (s) return s.v.get(n.name).val; } if (n.k === 'un' && n.op === '-') return -N(constEval(n.e)); return 0; }
  function* spin() { self.loops++; if (self.loops % 200 === 0) yield { t: 'tick' }; }

  function* main() {
    self.depth = 0;
    for (const g of prog.globals) yield* exec(g, globals);
    yield* callUser(prog.funcs.setup, [], { line: 1 });
    for (;;) { yield* callUser(prog.funcs.loop, [], { line: 1 }); self.loops++; yield { t: 'tick' }; }
  }
  let gen = null;
  self.start = () => { gen = main(); self.started = true; self.done = false; self.error = null; self.wakeAt = 0; };
  self.step = (t, budget = 4000) => {
    self.t = t; self.vt = t; if (!gen || self.done || self.error) return;
    if (t < self.wakeAt) return;
    self.ops = 0; self.debt = 0; let guard = 0;
    try {
      for (;;) {
        const r = gen.next(); if (r.done) { self.done = true; break; }
        const y = r.value;
        if (y.t === 'wait') { if (self.wakeAt > t) break; else continue; }
        if (y.t === 'tick') { if (++guard >= 1) break; }
      }
    } catch (e) { if (e instanceof RuntimeError) { self.error = { line: e.line || 0, msg: e.message }; } else { self.error = { line: 0, msg: 'Interner Fehler: ' + e.message }; } }
    if (!self.done && !self.error) { const cpu = t + self.ops * 2e-6 + self.debt; if (self.wakeAt < cpu) self.wakeAt = cpu; }
  };
  return self;
}

const api = { compile, createRunner, Fl, Ch };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Arduino = api;
})(typeof window !== 'undefined' ? window : globalThis);
