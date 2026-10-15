/* Tonfunk Pi-Lab: kleiner Python-Interpreter (für Raspberry-Pi-Aufgaben) mit gpiozero und RPi.GPIO.
   compile(src) -> {ok, program} | {ok:false, errors:[{line,msg}]}
   createRunner(program, io) -> {start(), step(t), error, t}
   io: setMode(gpio, 'out'|'in'|'up'), write(gpio, 0|1, vt), read(gpio), pwm(gpio, duty|null), servo(gpio, deg|null), tone(gpio, hz|null),
       echo(gpio) (Länge des letzten Echos in µs oder null), print(text), pulse(gpio, vt)
   Unterstützt: Ganzzahlen/Kommazahlen, Texte (auch f-Strings), Listen, Tupel, Dictionaries, if/elif/else, while, for, def, lambda, try/except, import,
   time, random, math, signal; gpiozero: LED, PWMLED, Buzzer, Button, MotionSensor, DistanceSensor, Servo, AngularServo, LEDBoard, TrafficLights. */
(function (root) {
'use strict';
class F { constructor(v) { this.v = v; } }                 // Kommazahl (float)
class PyErr extends Error { constructor(type, msg, line) { super(msg); this.pytype = type; this.pymsg = msg; this.line = line; } }
class Range { constructor(a, b, c) { this.a = a; this.b = b; this.c = c; } }
const isNum = x => typeof x === 'number' || x instanceof F || typeof x === 'boolean';
const nv = x => (x instanceof F ? x.v : (typeof x === 'boolean' ? (x ? 1 : 0) : x));
const isInt = x => typeof x === 'number' || typeof x === 'boolean';
const mk = v => (Number.isInteger(v) ? new F(v) : new F(v));

/* ---------- Lexer ---------- */
const KW = new Set(['False', 'None', 'True', 'and', 'as', 'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'nonlocal']);
function lex(src) {
  const toks = [], n = src.length; let i = 0, line = 1, depth = 0, atStart = true; const ind = [0];
  const err = (m, l) => { throw new PyErr('SyntaxError', m, l || line); };
  const push = (t, v, extra) => toks.push(Object.assign({ t, v, line }, extra || {}));
  const OPS3 = ['**=', '//=', '>>=', '<<=', '...'], OPS2 = ['==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '%=', '**', '//', '->', '<<', '>>', '&=', '|=', '^=', ':='];
  while (i < n) {
    if (atStart && depth === 0) {
      let col = 0, j = i;
      while (j < n && (src[j] === ' ' || src[j] === '\t')) { col += src[j] === '\t' ? 4 : 1; j++; }
      if (j >= n) { i = j; break; }
      if (src[j] === '\n' || src[j] === '#' || src[j] === '\r') { while (j < n && src[j] !== '\n') j++; i = j < n ? j + 1 : j; line++; continue; }
      if (col > ind[ind.length - 1]) { ind.push(col); push('INDENT'); }
      else while (col < ind[ind.length - 1]) { ind.pop(); push('DEDENT'); if (col > ind[ind.length - 1]) err('IndentationError: Einrückung passt zu keiner äußeren Ebene'); }
      i = j; atStart = false;
    }
    const c = src[i];
    if (c === '\n') { i++; if (depth === 0) { if (toks.length && toks[toks.length - 1].t !== 'NEWLINE') push('NEWLINE'); atStart = true; } line++; continue; }
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '#') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '\\' && (src[i + 1] === '\n' || (src[i + 1] === '\r' && src[i + 2] === '\n'))) { i += src[i + 1] === '\r' ? 3 : 2; line++; continue; }
    // Texte (mit Präfix)
    const sm = /^([rRbBfFuU]{0,2})('''|"""|'|")/.exec(src.slice(i, i + 6));
    if (sm && (sm[1] === '' || /^[rRbBfFuU]+$/.test(sm[1]))) {
      const pre = sm[1].toLowerCase(), q = sm[2], raw = pre.includes('r'), isF = pre.includes('f'); i += sm[0].length; let s = '', startLine = line;
      for (;;) {
        if (i >= n) err('SyntaxError: Text nicht beendet (Anführungszeichen fehlt)', startLine);
        if (src.startsWith(q, i)) { i += q.length; break; }
        const ch = src[i];
        if (ch === '\n') { if (q.length === 1) err('SyntaxError: Text nicht beendet (Anführungszeichen fehlt)', line); line++; }
        if (ch === '\\' && !raw) {
          const e = src[i + 1]; i += 2;
          const map = { n: '\n', t: '\t', r: '\r', '\\': '\\', "'": "'", '"': '"', '0': '\0', a: '\x07', b: '\b' };
          if (e === '\n') { line++; continue; }
          if (e === 'x') { s += String.fromCharCode(parseInt(src.substr(i, 2), 16)); i += 2; continue; }
          if (e === 'u') { s += String.fromCharCode(parseInt(src.substr(i, 4), 16)); i += 4; continue; }
          s += e in map ? map[e] : '\\' + e; continue;
        }
        s += ch; i++;
      }
      push(isF ? 'FSTR' : 'STR', s); continue;
    }
    if (/[A-Za-z_À-￿]/.test(c)) { let j = i + 1; while (j < n && /[A-Za-z0-9_À-￿]/.test(src[j])) j++; const w = src.slice(i, j); push(KW.has(w) ? 'KW' : 'NAME', w); i = j; continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      const m = /^(0[xX][0-9a-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|(?:[0-9][0-9_]*)?\.?[0-9_]*(?:[eE][+-]?[0-9]+)?)/.exec(src.slice(i));
      const txt = m[0].replace(/_/g, ''); i += m[0].length;
      if (/^0[xXbBoO]/.test(txt)) push('NUM', parseInt(txt.slice(2), { x: 16, b: 2, o: 8 }[txt[1].toLowerCase()]));
      else if (/[.eE]/.test(txt)) push('NUM', new F(parseFloat(txt))); else push('NUM', parseInt(txt, 10));
      continue;
    }
    const o3 = src.substr(i, 3), o2 = src.substr(i, 2);
    if (OPS3.includes(o3)) { push('OP', o3); i += 3; continue; }
    if (OPS2.includes(o2)) { push('OP', o2); i += 2; continue; }
    if ('+-*/%<>=()[]{},:.;@&|^~'.includes(c)) { if ('([{'.includes(c)) depth++; if (')]}'.includes(c)) depth = Math.max(0, depth - 1); push('OP', c); i++; continue; }
    err('SyntaxError: Unerlaubtes Zeichen „' + c + '“');
  }
  if (toks.length && toks[toks.length - 1].t !== 'NEWLINE') push('NEWLINE');
  while (ind.length > 1) { ind.pop(); push('DEDENT'); }
  push('EOF');
  return toks;
}

/* ---------- Parser ---------- */
function parse(toks) {
  let p = 0; const peek = () => toks[p], next = () => toks[p++];
  const err = (m, tk) => { throw new PyErr('SyntaxError', m, (tk || peek()).line); };
  const isOp = (v, tk) => { tk = tk || peek(); return tk.t === 'OP' && tk.v === v; };
  const isKw = (v, tk) => { tk = tk || peek(); return tk.t === 'KW' && tk.v === v; };
  const eatOp = v => { if (isOp(v)) { p++; return true; } return false; };
  const eatKw = v => { if (isKw(v)) { p++; return true; } return false; };
  const needOp = (v, hint) => { if (!eatOp(v)) err('SyntaxError: „' + v + '“ erwartet' + (hint ? ' ' + hint : '')); };
  const needName = () => { const t = next(); if (t.t !== 'NAME') err('SyntaxError: Name erwartet', t); return t.v; };

  function parseModule() { const body = []; while (peek().t !== 'EOF') { if (peek().t === 'NEWLINE') { p++; continue; } body.push(...parseStmt()); } return { t: 'Module', body }; }
  function parseBlock() {
    needOp(':', '(Doppelpunkt am Zeilenende vergessen?)');
    if (peek().t === 'NEWLINE') {
      p++; if (peek().t !== 'INDENT') err('IndentationError: eingerückter Block erwartet');
      p++; const body = [];
      while (peek().t !== 'DEDENT' && peek().t !== 'EOF') { if (peek().t === 'NEWLINE') { p++; continue; } body.push(...parseStmt()); }
      if (peek().t === 'DEDENT') p++;
      return body;
    }
    return parseSimpleLine();
  }
  function parseSimpleLine() { const out = []; for (;;) { out.push(parseSimple()); if (eatOp(';')) { if (peek().t === 'NEWLINE') break; continue; } break; } if (peek().t === 'NEWLINE') p++; else if (peek().t !== 'EOF') err('SyntaxError: Ende der Zeile erwartet'); return out; }
  function parseStmt() {
    const tk = peek();
    if (tk.t === 'INDENT') err('IndentationError: unerwartete Einrückung');
    if (tk.t === 'KW') {
      const line = tk.line;
      switch (tk.v) {
        case 'if': { p++; const tests = [], bodies = []; tests.push(parseExpr()); bodies.push(parseBlock()); let orelse = null;
          for (;;) { if (isKw('elif')) { p++; tests.push(parseExpr()); bodies.push(parseBlock()); } else if (isKw('else')) { p++; orelse = parseBlock(); break; } else break; }
          return [{ t: 'If', tests, bodies, orelse, line }]; }
        case 'while': { p++; const test = parseExpr(), body = parseBlock(); let orelse = null; if (isKw('else')) { p++; orelse = parseBlock(); } return [{ t: 'While', test, body, orelse, line }]; }
        case 'for': { p++; const target = parseTargetList(); if (!eatKw('in')) err('SyntaxError: „in“ erwartet'); const iter = parseExprList(), body = parseBlock(); let orelse = null; if (isKw('else')) { p++; orelse = parseBlock(); } return [{ t: 'For', target, iter, body, orelse, line }]; }
        case 'def': { p++; const name = needName(); needOp('('); const params = [];
          while (!isOp(')')) { let star = null; if (eatOp('*')) star = 'args'; else if (eatOp('**')) star = 'kw'; const pn = needName(); let def = null; if (eatOp('=')) def = parseExpr(); params.push({ name: pn, def, star }); if (!eatOp(',')) break; }
          needOp(')'); if (eatOp('->')) parseExpr(); const body = parseBlock(); return [{ t: 'Def', name, params, body, line }]; }
        case 'try': { p++; const body = parseBlock(), handlers = []; let orelse = null, fin = null;
          while (isKw('except')) { p++; let type = null, name = null; if (!isOp(':')) { type = parseExpr(); if (eatKw('as')) name = needName(); } handlers.push({ type, name, body: parseBlock() }); }
          if (isKw('else')) { p++; orelse = parseBlock(); } if (isKw('finally')) { p++; fin = parseBlock(); }
          if (!handlers.length && !fin) err('SyntaxError: „except“ oder „finally“ erwartet');
          return [{ t: 'Try', body, handlers, orelse, fin, line }]; }
        case 'class': { p++; const name = needName(); let base = null; if (eatOp('(')) { if (!isOp(')')) base = parseExpr(); needOp(')'); } const body = parseBlock(); return [{ t: 'Class', name, base, body, line }]; }
        case 'with': { p++; const items = []; for (;;) { const ex = parseExpr(); let nm = null; if (eatKw('as')) nm = needName(); items.push({ ex, nm }); if (!eatOp(',')) break; } let wb = parseBlock(); for (let i = items.length - 1; i >= 0; i--) wb = [{ t: 'With', ex: items[i].ex, nm: items[i].nm, body: wb, line }]; return wb; }
      }
    }
    if (isOp('@')) err('Dekoratoren (@) werden im Pi-Lab nicht unterstützt.');
    return parseSimpleLine();
  }
  function parseTargetList() { const first = parseBit(); if (isOp(',')) { const el = [first]; while (eatOp(',')) { if (isKw('in')) break; el.push(parseBit()); } return { t: 'Tuple', el }; } return first; }
  function parseSimple() {
    const tk = peek(), line = tk.line;
    if (tk.t === 'KW') {
      switch (tk.v) {
        case 'pass': p++; return { t: 'Pass', line };
        case 'break': p++; return { t: 'Break', line };
        case 'continue': p++; return { t: 'Continue', line };
        case 'return': { p++; let v = null; if (peek().t !== 'NEWLINE' && !isOp(';') && peek().t !== 'EOF') v = parseExprList(); return { t: 'Return', v, line }; }
        case 'global': case 'nonlocal': { p++; const names = [needName()]; while (eatOp(',')) names.push(needName()); return { t: 'Global', names, line }; }
        case 'import': { p++; const items = []; do { let name = needName(); while (eatOp('.')) name += '.' + needName(); let as = null; if (eatKw('as')) as = needName(); items.push({ name, as }); } while (eatOp(',')); return { t: 'Import', items, line }; }
        case 'from': { p++; let mod = needName(); while (eatOp('.')) mod += '.' + needName(); if (!eatKw('import')) err('SyntaxError: „import“ erwartet'); const items = [];
          if (eatOp('*')) items.push({ name: '*', as: null }); else { const par = eatOp('('); do { if (par && isOp(')')) break; const name = needName(); let as = null; if (eatKw('as')) as = needName(); items.push({ name, as }); } while (eatOp(',')); if (par) needOp(')'); }
          return { t: 'ImportFrom', mod, items, line }; }
        case 'raise': { p++; let v = null; if (peek().t !== 'NEWLINE' && peek().t !== 'EOF') v = parseExpr(); return { t: 'Raise', v, line }; }
        case 'del': { p++; const targets = [parseOr()]; while (eatOp(',')) targets.push(parseOr()); return { t: 'Del', targets, line }; }
      }
    }
    const e = parseExprList();
    if (peek().t === 'OP') {
      const v = peek().v;
      if (v === '=') { const targets = [e]; let val; while (eatOp('=')) { val = parseExprList(); if (isOp('=')) targets.push(val); } return { t: 'Assign', targets, value: val, line }; }
      if (['+=', '-=', '*=', '/=', '//=', '%=', '**=', '&=', '|=', '^=', '<<=', '>>='].includes(v)) { p++; const val = parseExprList(); return { t: 'AugAssign', op: v.slice(0, -1), target: e, value: val, line }; }
    }
    return { t: 'Expr', e, line };
  }
  function parseExprList() { const first = parseExpr(); if (isOp(',')) { const el = [first]; while (eatOp(',')) { if (['NEWLINE', 'EOF'].includes(peek().t) || isOp('=') || isOp(')') || isOp(':')) break; el.push(parseExpr()); } return { t: 'Tuple', el, line: first.line }; } return first; }
  function parseExpr() {
    if (isKw('lambda')) { const line = next().line; const params = []; while (!isOp(':')) { const pn = needName(); let def = null; if (eatOp('=')) def = parseExpr(); params.push({ name: pn, def }); if (!eatOp(',')) break; } needOp(':'); const body = parseExpr(); return { t: 'Lambda', params, body, line }; }
    const e = parseOr();
    if (isKw('if')) { const line = next().line; const test = parseOr(); if (!eatKw('else')) err('SyntaxError: „else“ erwartet'); const other = parseExpr(); return { t: 'IfExp', test, a: e, b: other, line }; }
    return e;
  }
  function parseOr() { let l = parseAnd(); if (isKw('or')) { const vals = [l]; while (eatKw('or')) vals.push(parseAnd()); return { t: 'BoolOp', op: 'or', vals, line: l.line }; } return l; }
  function parseAnd() { let l = parseNot(); if (isKw('and')) { const vals = [l]; while (eatKw('and')) vals.push(parseNot()); return { t: 'BoolOp', op: 'and', vals, line: l.line }; } return l; }
  function parseNot() { if (isKw('not')) { const line = next().line; return { t: 'Unary', op: 'not', e: parseNot(), line }; } return parseCmp(); }
  function parseCmp() {
    const first = parseBit(), ops = [], rest = [];
    for (;;) {
      let op = null; const tk = peek();
      if (tk.t === 'OP' && ['==', '!=', '<', '>', '<=', '>='].includes(tk.v)) { op = tk.v; p++; }
      else if (isKw('in')) { op = 'in'; p++; }
      else if (isKw('not') && isKw('in', toks[p + 1])) { op = 'not in'; p += 2; }
      else if (isKw('is')) { p++; op = eatKw('not') ? 'is not' : 'is'; }
      if (!op) break; ops.push(op); rest.push(parseBit());
    }
    return ops.length ? { t: 'Cmp', first, ops, rest, line: first.line } : first;
  }
  const binLevel = (ops, sub) => () => { let l = sub(); for (;;) { const tk = peek(); if (tk.t === 'OP' && ops.includes(tk.v)) { p++; const r = sub(); l = { t: 'BinOp', op: tk.v, l, r, line: tk.line }; } else break; } return l; };
  const parseUnary = () => { const tk = peek(); if (tk.t === 'OP' && (tk.v === '-' || tk.v === '+' || tk.v === '~')) { p++; return { t: 'Unary', op: tk.v, e: parseUnary(), line: tk.line }; } return parsePow(); };
  function parsePow() { const base = parsePostfix(); if (isOp('**')) { const line = next().line; return { t: 'BinOp', op: '**', l: base, r: parseUnary(), line }; } return base; }
  const parseTerm = binLevel(['*', '/', '//', '%'], parseUnary), parseArith = binLevel(['+', '-'], parseTerm), parseShift = binLevel(['<<', '>>'], parseArith);
  const parseBAnd = binLevel(['&'], parseShift), parseBXor = binLevel(['^'], parseBAnd), parseBit = binLevel(['|'], parseBXor);
  function parsePostfix() {
    let e = parseAtom();
    for (;;) {
      const tk = peek();
      if (isOp('(')) { p++; const args = [], kw = []; while (!isOp(')')) { if (eatOp('*')) { args.push({ t: 'Star', e: parseExpr() }); } else if (peek().t === 'NAME' && isOp('=', toks[p + 1])) { const k = next().v; p++; kw.push([k, parseExpr()]); } else { let a = parseExpr(); if (isKw('for')) a = compFor(a); args.push(a); } if (!eatOp(',')) break; } needOp(')', '(Klammer schließen)'); e = { t: 'Call', f: e, args, kw, line: tk.line }; }
      else if (isOp('[')) { p++; const idx = parseSlice(); needOp(']'); e = { t: 'Sub', o: e, idx, line: tk.line }; }
      else if (isOp('.')) { p++; const name = next(); if (name.t !== 'NAME' && name.t !== 'KW') err('SyntaxError: Name nach „.“ erwartet', name); e = { t: 'Attr', o: e, name: name.v, line: tk.line }; }
      else break;
    }
    return e;
  }
  function parseSlice() {
    let lo = null, hi = null, st = null, sl = false;
    if (!isOp(':')) lo = parseExpr();
    if (eatOp(':')) { sl = true; if (!isOp(']') && !isOp(':')) hi = parseExpr(); if (eatOp(':')) { if (!isOp(']')) st = parseExpr(); } }
    return sl ? { t: 'Slice', lo, hi, st } : lo;
  }
  function compFor(elt) {
    const line = next().line; const target = parseTargetList(); if (!eatKw('in')) err('SyntaxError: „in“ erwartet'); const iter = parseOr(); let cond = null; if (eatKw('if')) cond = parseOr();
    return { t: 'ListComp', elt, target, iter, cond, line };
  }
  function parseAtom() {
    const tk = next(), line = tk.line;
    switch (tk.t) {
      case 'NUM': return { t: 'Num', v: tk.v, line };
      case 'STR': { let s = tk.v; while (peek().t === 'STR') s += next().v; return { t: 'Str', v: s, line }; }
      case 'FSTR': return fstr(tk.v, line);
      case 'NAME': return { t: 'Name', id: tk.v, line };
      case 'KW': if (tk.v === 'True') return { t: 'Const', v: true, line }; if (tk.v === 'False') return { t: 'Const', v: false, line }; if (tk.v === 'None') return { t: 'Const', v: null, line };
        err('SyntaxError: Unerwartetes Schlüsselwort „' + tk.v + '“', tk); break;
      case 'OP':
        if (tk.v === '(') { if (eatOp(')')) return { t: 'Tuple', el: [], line }; let e = parseExpr(); if (isKw('for')) e = compFor(e); if (isOp(',')) { const el = [e]; while (eatOp(',')) { if (isOp(')')) break; el.push(parseExpr()); } needOp(')'); return { t: 'Tuple', el, line }; } needOp(')', '(Klammer schließen)'); return e; }
        if (tk.v === '[') { if (eatOp(']')) return { t: 'List', el: [], line }; let e = parseExpr(); if (isKw('for')) { const c = compFor(e); needOp(']'); return c; } const el = [e]; while (eatOp(',')) { if (isOp(']')) break; el.push(parseExpr()); } needOp(']', '(Klammer schließen)'); return { t: 'List', el, line }; }
        if (tk.v === '{') { const keys = [], vals = []; while (!isOp('}')) { keys.push(parseExpr()); needOp(':'); vals.push(parseExpr()); if (!eatOp(',')) break; } needOp('}'); return { t: 'Dict', keys, vals, line }; }
        err('SyntaxError: Unerwartetes Zeichen „' + tk.v + '“', tk); break;
      case 'NEWLINE': err('SyntaxError: Ausdruck unvollständig', tk); break;
      default: err('SyntaxError: Unerwartetes Ende', tk);
    }
  }
  function fstr(s, line) {
    const parts = []; let lit = '', i = 0;
    while (i < s.length) {
      const c = s[i];
      if (c === '{') {
        if (s[i + 1] === '{') { lit += '{'; i += 2; continue; }
        let j = i + 1, d = 0, spec = null, expr = '', conv = null;
        for (; j < s.length; j++) { const ch = s[j]; if ('([{'.includes(ch)) d++; else if (')]'.includes(ch)) d--; else if (ch === '}') { if (d === 0) break; d--; } else if (ch === ':' && d === 0 && spec === null) { spec = ''; continue; } else if (ch === '!' && d === 0 && s[j + 1] !== '=' && spec === null) { conv = s[j + 1]; j++; continue; } if (spec !== null) spec += ch; else expr += ch; }
        if (j >= s.length) err('SyntaxError: „}“ im f-String fehlt', { line });
        if (lit) { parts.push({ lit }); lit = ''; }
        const sub = lex(expr.trim()); const sp = parse(sub, true);
        parts.push({ e: sp.body[0] && sp.body[0].e, spec, conv }); i = j + 1; continue;
      }
      if (c === '}') { if (s[i + 1] === '}') { lit += '}'; i += 2; continue; } lit += '}'; i++; continue; }
      lit += c; i++;
    }
    if (lit) parts.push({ lit });
    return { t: 'FStr', parts, line };
  }
  return parseModule();
}

/* ---------- Ausgabe von Werten ---------- */
function fmtFloat(x) {
  if (Number.isNaN(x)) return 'nan'; if (!Number.isFinite(x)) return x > 0 ? 'inf' : '-inf';
  if (Number.isInteger(x) && Math.abs(x) < 1e16) return x.toFixed(1);
  let s = String(x); const m = /^(-?[\d.]+)e([+-])(\d+)$/.exec(s); if (m) s = m[1] + 'e' + m[2] + (m[3].length < 2 ? '0' + m[3] : m[3]); return s;
}
function repr(x) {
  if (typeof x === 'string') return "'" + x.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'";
  return str(x);
}
function str(x) {
  if (x === null || x === undefined) return 'None'; if (x === true) return 'True'; if (x === false) return 'False';
  if (typeof x === 'number') return String(x); if (x instanceof F) return fmtFloat(x.v); if (typeof x === 'string') return x;
  if (Array.isArray(x)) return x._t ? '(' + x.map(repr).join(', ') + (x.length === 1 ? ',' : '') + ')' : '[' + x.map(repr).join(', ') + ']';
  if (x instanceof Map) return '{' + [...x].map(([k, v]) => repr(k) + ': ' + repr(v)).join(', ') + '}';
  if (x instanceof Range) return 'range(' + x.a + ', ' + x.b + (x.c !== 1 ? ', ' + x.c : '') + ')';
  if (x && x.kind === 'func') return '<function ' + x.name + '>';
  if (typeof x === 'function') return '<built-in function ' + (x.pyname || 'fn') + '>';
  if (x && x.kind === 'inst') return '<__main__.' + x.cls.name + ' object>'; if (x && x.kind === 'class') return "<class '__main__." + x.name + "'>";
  if (x && x.dev) return '<' + x.dev + ' object>';
  return String(x);
}
function truthy(x) { if (x === null || x === undefined || x === false) return false; if (x === true) return true; if (typeof x === 'number') return x !== 0; if (x instanceof F) return x.v !== 0; if (typeof x === 'string' || Array.isArray(x)) return x.length > 0; if (x instanceof Map) return x.size > 0; return true; }
function formatSpec(x, spec) {
  if (!spec) return str(x);
  const m = /^(?:(.)?([<>^=]))?([+\- ])?(0)?(\d+)?(,)?(?:\.(\d+))?([bcdeEfFgGnosxX%])?$/.exec(spec);
  if (!m) return str(x);
  const [, fill, align, sign, zero, width, comma, prec, type] = m; let s;
  if (type === 'f' || type === 'F' || type === 'e' || type === '%' || type === 'g') {
    let v = nv(x); const p = prec === undefined ? 6 : +prec;
    s = type === '%' ? (v * 100).toFixed(p) + '%' : type === 'e' ? v.toExponential(p).replace(/e([+-])(\d)$/, 'e$10$2') : type === 'g' ? String(+v.toPrecision(p || 6)) : v.toFixed(p);
  } else if (type === 'd' || type === 'n') s = String(Math.trunc(nv(x)));
  else if (type === 'x') s = Math.trunc(nv(x)).toString(16); else if (type === 'X') s = Math.trunc(nv(x)).toString(16).toUpperCase(); else if (type === 'b') s = Math.trunc(nv(x)).toString(2); else if (type === 'o') s = Math.trunc(nv(x)).toString(8);
  else if (prec !== undefined && typeof x === 'string') s = x.slice(0, +prec);
  else if (prec !== undefined && isNum(x)) s = nv(x).toFixed(+prec); else s = str(x);
  if (comma && isNum(x)) { const [a, b] = s.split('.'); s = a.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (b ? '.' + b : ''); }
  if (sign === '+' && isNum(x) && nv(x) >= 0) s = '+' + s;
  const w = width ? +width : 0;
  if (s.length < w) {
    const al = align || (zero ? '=' : (isNum(x) ? '>' : '<')), fc = fill || (zero ? '0' : ' '), padn = w - s.length;
    if (al === '<') s += fc.repeat(padn); else if (al === '^') s = fc.repeat(Math.floor(padn / 2)) + s + fc.repeat(Math.ceil(padn / 2));
    else if (al === '=' && /^[+-]/.test(s)) s = s[0] + fc.repeat(padn) + s.slice(1); else s = fc.repeat(padn) + s;
  }
  return s;
}

/* ---------- Interpreter ---------- */
function compile(src) {
  try { return { ok: true, program: parse(lex(src)) }; }
  catch (e) { if (e instanceof PyErr) return { ok: false, errors: [{ line: e.line, msg: e.pymsg }] }; throw e; }
}

function createRunner(prog, io) {
  const self = { error: null, t: 0, done: false, out: '' };
  const COST = 2e-6, BUDGET = 400;       // simulierte Zeit je Anweisung, Anweisungen je Zeitscheibe
  let ops = 0, curTask = null;
  const tasks = [], devices = [];
  const throwE = (type, msg, node) => { throw new PyErr(type, msg, node && node.line || (curTask && curTask.line) || 0); };
  const pyname = (f, n) => { f.pyname = n; return f; };
  const bi = (n, f, gen) => { f.pyname = n; if (gen) f.gen = true; return f; };

  /* ----- Zahlen und Operatoren ----- */
  function arith(op, a, b, node) {
    if (isNum(a) && isNum(b)) {
      const bothInt = isInt(a) && isInt(b), x = nv(a), y = nv(b);
      switch (op) {
        case '+': return bothInt ? x + y : new F(x + y);
        case '-': return bothInt ? x - y : new F(x - y);
        case '*': return bothInt ? x * y : new F(x * y);
        case '/': if (y === 0) throwE('ZeroDivisionError', 'division by zero', node); return new F(x / y);
        case '//': if (y === 0) throwE('ZeroDivisionError', 'integer division or modulo by zero', node); return bothInt ? Math.floor(x / y) : new F(Math.floor(x / y));
        case '%': if (y === 0) throwE('ZeroDivisionError', 'integer modulo by zero', node); { const r = x - Math.floor(x / y) * y; return bothInt ? r : new F(r); }
        case '**': { const r = Math.pow(x, y); return bothInt && y >= 0 ? r : new F(r); }
        case '&': return x & y; case '|': return x | y; case '^': return x ^ y; case '<<': return x << y; case '>>': return x >> y;
      }
    }
    if (op === '+') { if (typeof a === 'string' && typeof b === 'string') return a + b; if (Array.isArray(a) && Array.isArray(b)) { const r = a.concat(b); if (a._t) r._t = true; return r; } }
    if (op === '*') { if (typeof a === 'string' && isInt(b)) return a.repeat(Math.max(0, nv(b))); if (typeof b === 'string' && isInt(a)) return b.repeat(Math.max(0, nv(a))); if (Array.isArray(a) && isInt(b)) { let r = []; for (let i = 0; i < nv(b); i++) r = r.concat(a); return r; } }
    if (op === '%' && typeof a === 'string') return pctFormat(a, b, node);
    const tn = v => (v === null ? 'NoneType' : typeof v === 'string' ? 'str' : Array.isArray(a) && v === a ? (v._t ? 'tuple' : 'list') : v instanceof F ? 'float' : typeof v === 'number' ? 'int' : typeof v === 'boolean' ? 'bool' : Array.isArray(v) ? 'list' : 'object');
    throwE('TypeError', "unsupported operand type(s) for " + op + ": '" + tn(a) + "' and '" + tn(b) + "'" + (op === '+' && (typeof a === 'string' || typeof b === 'string') ? ' (Tipp: Zahlen mit str() in Text umwandeln)' : ''), node);
  }
  function pctFormat(f, args, node) {
    const list = Array.isArray(args) && args._t ? args : [args]; let k = 0;
    return f.replace(/%(?:\((\w+)\))?([-+0 #]*)(\d+)?(?:\.(\d+))?([sdifrxX%])/g, (m, key, flags, w, pr, ty) => {
      if (ty === '%') return '%'; const v = key !== undefined ? args.get(key) : list[k++]; let s;
      if (ty === 's') s = str(v); else if (ty === 'r') s = repr(v); else if (ty === 'd' || ty === 'i') s = String(Math.trunc(nv(v))); else if (ty === 'f') s = nv(v).toFixed(pr === undefined ? 6 : +pr); else s = Math.trunc(nv(v)).toString(16);
      if (w) s = flags.includes('-') ? s.padEnd(+w) : s.padStart(+w, flags.includes('0') ? '0' : ' '); return s;
    });
  }
  function cmpVals(a, b) { if (isNum(a) && isNum(b)) return nv(a) - nv(b); if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0; if (Array.isArray(a) && Array.isArray(b)) { for (let i = 0; i < Math.min(a.length, b.length); i++) { const c = cmpVals(a[i], b[i]); if (c) return c; } return a.length - b.length; } return NaN; }
  function eq(a, b) {
    if (isNum(a) && isNum(b)) return nv(a) === nv(b); if (a === b) return true;
    if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => eq(x, b[i]));
    if (a instanceof Map && b instanceof Map) return a.size === b.size && [...a].every(([k, v]) => b.has(k) && eq(v, b.get(k)));
    return false;
  }
  function contains(c, x, node) {
    if (typeof c === 'string') { if (typeof x !== 'string') throwE('TypeError', "'in <string>' requires string as left operand", node); return c.includes(x); }
    if (Array.isArray(c)) return c.some(y => eq(y, x)); if (c instanceof Map) return c.has(key(x)); if (c instanceof Range) return toList(c).some(y => eq(y, x));
    throwE('TypeError', 'argument is not iterable', node);
  }
  const key = k => (k instanceof F ? (Number.isInteger(k.v) ? k.v : k.v) : (typeof k === 'boolean' ? (k ? 1 : 0) : (Array.isArray(k) ? JSON.stringify(k.map(str)) : k)));
  function toList(x, node) {
    if (Array.isArray(x)) return x; if (typeof x === 'string') return [...x]; if (x instanceof Map) return [...x.keys()];
    if (x instanceof Range) { const r = []; if (x.c > 0) for (let i = x.a; i < x.b; i += x.c) r.push(i); else for (let i = x.a; i > x.b; i += x.c) r.push(i); return r; }
    if (x && x.dev === 'LEDBoard') return x.leds; if (x && x.dev === 'TrafficLights') return [x.red, x.amber, x.green];
    throwE('TypeError', "'" + (isNum(x) ? 'int' : x === null ? 'NoneType' : 'object') + "' object is not iterable", node);
  }
  const idx = (n, len, node) => { n = nv(n); const i = n < 0 ? n + len : n; if (!Number.isInteger(i) || i < 0 || i >= len) throwE('IndexError', 'index out of range', node); return i; };

  /* ----- Attribute von eingebauten Typen ----- */
  function strMethod(s, name, node) {
    const f = {
      upper: () => s.toUpperCase(), lower: () => s.toLowerCase(), strip: a => (a === undefined ? s.trim() : s.replace(new RegExp('^[' + a.replace(/[\]\\^-]/g, '\\$&') + ']+|[' + a.replace(/[\]\\^-]/g, '\\$&') + ']+$', 'g'), '')),
      lstrip: () => s.trimStart(), rstrip: () => s.trimEnd(), title: () => s.replace(/\b\w/g, c => c.toUpperCase()), capitalize: () => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(),
      split: (sep, mx) => { const r = sep == null ? s.trim().split(/\s+/).filter(x => x !== '') : s.split(sep); return r; }, join: it => toList(it, node).map(x => { if (typeof x !== 'string') throwE('TypeError', 'sequence item: expected str instance', node); return x; }).join(s),
      replace: (a, b) => s.split(a).join(b), startswith: a => s.startsWith(a), endswith: a => s.endsWith(a), find: a => s.indexOf(a), count: a => (a === '' ? s.length + 1 : s.split(a).length - 1),
      isdigit: () => /^\d+$/.test(s), isalpha: () => /^[A-Za-zÄÖÜäöüß]+$/.test(s), isnumeric: () => /^\d+$/.test(s), zfill: n => s.padStart(nv(n), '0'), center: (n, c) => { const w = nv(n), pd = w - s.length; return pd > 0 ? (c || ' ').repeat(Math.floor(pd / 2)) + s + (c || ' ').repeat(Math.ceil(pd / 2)) : s; },
      format: (...a) => { let k = 0; const kw = a._kw || {}; return s.replace(/\{([^{}:]*)(?::([^{}]*))?\}/g, (m, nm, sp) => { const v = nm === '' ? a[k++] : (/^\d+$/.test(nm) ? a[+nm] : kw[nm]); return formatSpec(v, sp); }); },
    }[name];
    return f && bi('str.' + name, (args, kw) => { args._kw = kw; return f(...args); });
  }
  function listMethod(l, name, node) {
    const f = {
      append: x => { l.push(x); return null; }, extend: x => { l.push(...toList(x, node)); return null; }, pop: i => { if (!l.length) throwE('IndexError', 'pop from empty list', node); return i === undefined ? l.pop() : l.splice(idx(i, l.length, node), 1)[0]; },
      insert: (i, x) => { l.splice(nv(i), 0, x); return null; }, remove: x => { const i = l.findIndex(y => eq(y, x)); if (i < 0) throwE('ValueError', 'list.remove(x): x not in list', node); l.splice(i, 1); return null; },
      index: x => { const i = l.findIndex(y => eq(y, x)); if (i < 0) throwE('ValueError', str(x) + ' is not in list', node); return i; }, count: x => l.filter(y => eq(y, x)).length,
      sort: (kw) => { l.sort((a, b) => cmpVals(a, b)); return null; }, reverse: () => { l.reverse(); return null; }, copy: () => l.slice(), clear: () => { l.length = 0; return null; },
    }[name];
    return f && bi('list.' + name, (args, kw) => { if (name === 'sort' && kw && kw.reverse && truthy(kw.reverse)) { l.sort((a, b) => cmpVals(b, a)); return null; } return f(...args); });
  }
  function dictMethod(d, name) {
    const f = { get: (k, dv) => (d.has(key(k)) ? d.get(key(k)) : (dv === undefined ? null : dv)), keys: () => [...d.keys()], values: () => [...d.values()], items: () => [...d].map(([k, v]) => { const t = [k, v]; t._t = true; return t; }),
      update: o => { (o instanceof Map ? [...o] : []).forEach(([k, v]) => d.set(k, v)); return null; }, pop: (k, dv) => { const kk = key(k); if (d.has(kk)) { const v = d.get(kk); d.delete(kk); return v; } if (dv !== undefined) return dv; throwE('KeyError', repr(k)); }, clear: () => { d.clear(); return null; }, copy: () => new Map(d) }[name];
    return f && bi('dict.' + name, args => f(...args));
  }
  const findAttr = (cls, name) => { for (let c = cls; c; c = c.base) if (c.attrs.has(name)) return c.attrs.get(name); return undefined; };
  const bindTo = (v, inst) => (v && v.kind === 'func' ? Object.assign({}, v, { bound: inst }) : v);
  function getAttr(o, name, node) {
    if (o && (o.kind === 'inst' || o.kind === 'class' || o.kind === 'super')) {
      if (o.kind === 'inst' && o.attrs.has(name)) return o.attrs.get(name);
      const v = findAttr(o.kind === 'inst' ? o.cls : o.kind === 'class' ? o : o.cls, name);
      if (v !== undefined) return o.kind === 'class' ? v : bindTo(v, o.inst || o);
      throwE('AttributeError', o.kind === 'class' ? "type object '" + o.name + "' has no attribute '" + name + "'" : "'" + (o.cls ? o.cls.name : 'super') + "' object has no attribute '" + name + "'", node);
    }
    if (typeof o === 'string') { const m = strMethod(o, name, node); if (m) return m; }
    else if (Array.isArray(o)) { const m = listMethod(o, name, node); if (m) return m; }
    else if (o instanceof Map) { const m = dictMethod(o, name); if (m) return m; }
    else if (o && o.mod) { if (name in o.mod) return o.mod[name]; throwE('AttributeError', "module '" + o.name + "' has no attribute '" + name + "'", node); }
    else if (o && o.dev) { return devGet(o, name, node); }
    else if (o instanceof F) { if (name === 'is_integer') return bi('is_integer', () => Number.isInteger(o.v)); }
    throwE('AttributeError', "'" + (o === null ? 'NoneType' : typeof o === 'string' ? 'str' : Array.isArray(o) ? 'list' : typeof o === 'number' ? 'int' : 'object') + "' object has no attribute '" + name + "'", node);
  }

  /* ----- Auswertung (Generatoren, damit sleep() die Zeit anhalten kann) ----- */
  class Env { constructor(parent, isFunc) { this.vars = new Map(); this.parent = parent; this.globals = new Set(); this.isFunc = isFunc; } }
  const lookup = (env, name, node) => { for (let e = env; e; e = e.parent) { if (e.vars.has(name)) return e.vars.get(name); } throwE('NameError', "name '" + name + "' is not defined", node); };
  const store = (env, name, v) => { if (env.globals.has(name)) { let g = env; while (g.parent) g = g.parent; g.vars.set(name, v); } else env.vars.set(name, v); };
  function* assign(target, v, env) {
    switch (target.t) {
      case 'Name': store(env, target.id, v); break;
      case 'Tuple': case 'List': { const items = toList(v, target); if (items.length !== target.el.length) throwE(items.length < target.el.length ? 'ValueError' : 'ValueError', items.length < target.el.length ? 'not enough values to unpack (expected ' + target.el.length + ', got ' + items.length + ')' : 'too many values to unpack (expected ' + target.el.length + ')', target); for (let i = 0; i < items.length; i++) yield* assign(target.el[i], items[i], env); break; }
      case 'Sub': { const o = yield* ev(target.o, env), i = yield* ev(target.idx, env); if (Array.isArray(o)) o[idx(i, o.length, target)] = v; else if (o instanceof Map) o.set(key(i), v); else throwE('TypeError', 'object does not support item assignment', target); break; }
      case 'Attr': { const o = yield* ev(target.o, env); if (o && (o.kind === 'inst' || o.kind === 'class')) o.attrs.set(target.name, v); else if (o && o.dev) devSet(o, target.name, v, target); else throwE('AttributeError', "Attribute '" + target.name + "' kann nicht gesetzt werden", target); break; }
      default: throwE('SyntaxError', 'Zuweisung nicht möglich', target);
    }
  }
  function* callFn(f, args, kw, node) {
    if (typeof f === 'function') { const r = f(args, kw || {}, node); if (f.gen) return yield* r; return r; }
    if (f && f.kind === 'class') {
      const inst = { kind: 'inst', cls: f, attrs: new Map() }, init = findAttr(f, '__init__');
      if (init) yield* callFn(bindTo(init, inst), args, kw, node); else if (args.length) throwE('TypeError', f.name + '() takes no arguments', node);
      return inst;
    }
    if (f && f.kind === 'func') {
      if (f.bound !== undefined) args = [f.bound, ...args];
      const env = new Env(f.closure, true); let ai = 0; const ps = f.params;
      if (f.owner) { env.vars.set('__cls__', f.owner); env.vars.set('__self__', f.bound); }
      for (const p of ps) {
        if (p.star === 'args') { env.vars.set(p.name, Object.assign(args.slice(ai), { _t: true })); ai = args.length; continue; }
        if (p.star === 'kw') { env.vars.set(p.name, new Map(Object.entries(kw || {}))); continue; }
        if (ai < args.length) env.vars.set(p.name, args[ai++]);
        else if (kw && p.name in kw) env.vars.set(p.name, kw[p.name]);
        else if (p.def !== undefined && p.def !== null) env.vars.set(p.name, p.defv);
        else throwE('TypeError', f.name + '() missing 1 required positional argument: \'' + p.name + '\'', node);
      }
      if (ai < args.length && !ps.some(p => p.star === 'args')) throwE('TypeError', f.name + '() takes ' + ps.length + ' positional arguments but ' + args.length + ' were given', node);
      if (f.expr) return yield* ev(f.body, env);
      const sig = yield* execBlock(f.body, env); return sig && sig.ret !== undefined ? sig.ret : null;
    }
    throwE('TypeError', "'" + (f === null ? 'NoneType' : typeof f === 'string' ? 'str' : 'object') + "' object is not callable", node);
  }
  function* ev(n, env) {
    switch (n.t) {
      case 'Num': return n.v; case 'Str': return n.v; case 'Const': return n.v;
      case 'FStr': { let s = ''; for (const part of n.parts) { if (part.lit !== undefined) s += part.lit; else { let v = yield* ev(part.e, env); if (part.conv === 'r') v = repr(v); else if (part.conv === 's') v = str(v); s += formatSpec(v, part.spec); } } return s; }
      case 'Name': return lookup(env, n.id, n);
      case 'List': { const r = []; for (const e of n.el) r.push(yield* ev(e, env)); return r; }
      case 'Tuple': { const r = []; for (const e of n.el) r.push(yield* ev(e, env)); r._t = true; return r; }
      case 'Dict': { const d = new Map(); for (let i = 0; i < n.keys.length; i++) d.set(key(yield* ev(n.keys[i], env)), yield* ev(n.vals[i], env)); return d; }
      case 'BinOp': { const a = yield* ev(n.l, env), b = yield* ev(n.r, env); return arith(n.op, a, b, n); }
      case 'Unary': { const v = yield* ev(n.e, env); if (n.op === 'not') return !truthy(v); if (!isNum(v)) throwE('TypeError', "bad operand type for unary " + n.op, n); const x = nv(v); const r = n.op === '-' ? -x : n.op === '~' ? ~x : x; return isInt(v) ? r : new F(r); }
      case 'BoolOp': { let v; for (const e of n.vals) { v = yield* ev(e, env); if (n.op === 'or' ? truthy(v) : !truthy(v)) return v; } return v; }
      case 'Cmp': { let l = yield* ev(n.first, env); for (let i = 0; i < n.ops.length; i++) { const r = yield* ev(n.rest[i], env); const op = n.ops[i]; let ok;
          if (op === '==') ok = eq(l, r); else if (op === '!=') ok = !eq(l, r); else if (op === 'is') ok = l === r; else if (op === 'is not') ok = l !== r; else if (op === 'in') ok = contains(r, l, n); else if (op === 'not in') ok = !contains(r, l, n);
          else { const c = cmpVals(l, r); if (Number.isNaN(c)) throwE('TypeError', "'" + op + "' not supported between these types" + ((typeof l === 'string') !== (typeof r === 'string') ? ' (Text und Zahl lassen sich nicht vergleichen, Tipp: int() oder str())' : ''), n); ok = op === '<' ? c < 0 : op === '>' ? c > 0 : op === '<=' ? c <= 0 : c >= 0; }
          if (!ok) return false; l = r; } return true; }
      case 'IfExp': return truthy(yield* ev(n.test, env)) ? yield* ev(n.a, env) : yield* ev(n.b, env);
      case 'Lambda': { const f = { kind: 'func', name: '<lambda>', params: n.params.map(p => Object.assign({}, p)), body: n.body, closure: env, expr: true }; for (const p of f.params) if (p.def) p.defv = yield* ev(p.def, env); return f; }
      case 'Attr': { const o = yield* ev(n.o, env); const r = getAttr(o, n.name, n); if (r && r.__gen) return yield* r.__gen; return r; }
      case 'Sub': { const o = yield* ev(n.o, env); if (n.idx && n.idx.t === 'Slice') { const lo = n.idx.lo ? nv(yield* ev(n.idx.lo, env)) : null, hi = n.idx.hi ? nv(yield* ev(n.idx.hi, env)) : null, st = n.idx.st ? nv(yield* ev(n.idx.st, env)) : 1; const seq = typeof o === 'string' ? [...o] : toList(o, n); const L = seq.length; let a = lo === null ? (st > 0 ? 0 : L - 1) : (lo < 0 ? Math.max(lo + L, st > 0 ? 0 : -1) : Math.min(lo, st > 0 ? L : L - 1)), b = hi === null ? (st > 0 ? L : -1) : (hi < 0 ? Math.max(hi + L, -1) : Math.min(hi, L)); const r = []; if (st > 0) for (let i = a; i < b; i += st) r.push(seq[i]); else for (let i = a; i > b; i += st) r.push(seq[i]); return typeof o === 'string' ? r.join('') : (o._t ? Object.assign(r, { _t: true }) : r); }
        const i = yield* ev(n.idx, env); if (typeof o === 'string') return o[idx(i, o.length, n)]; if (Array.isArray(o)) return o[idx(i, o.length, n)]; if (o instanceof Map) { const k = key(i); if (!o.has(k)) throwE('KeyError', repr(i), n); return o.get(k); } if (o instanceof Range) return toList(o)[idx(i, toList(o).length, n)]; if (o && o.dev === 'LEDBoard') return o.leds[idx(i, o.leds.length, n)]; throwE('TypeError', 'object is not subscriptable', n); break; }
      case 'ListComp': { const items = toList(yield* ev(n.iter, env), n), r = []; const e2 = new Env(env, false); for (const it of items) { yield* assign(n.target, it, e2); if (n.cond && !truthy(yield* ev(n.cond, e2))) continue; r.push(yield* ev(n.elt, e2)); } return r; }
      case 'Call': {
        if (n.f.t === 'Name' && n.f.id === 'super' && !n.args.length) { const oc = lookup(env, '__cls__', n), inst = lookup(env, '__self__', n); if (!oc.base) throwE('TypeError', 'super(): Die Klasse ' + oc.name + ' hat keine Oberklasse', n); return { kind: 'super', cls: oc.base, inst }; }
        const f = yield* ev(n.f, env), args = []; for (const a of n.args) { if (a.t === 'Star') args.push(...toList(yield* ev(a.e, env), n)); else args.push(yield* ev(a, env)); }
        const kw = {}; for (const [k, v] of n.kw) kw[k] = yield* ev(v, env);
        if (++ops >= BUDGET) { ops = 0; yield { tick: true }; }
        curTask.line = n.line; return yield* callFn(f, args, kw, n);
      }
    }
    throwE('SyntaxError', 'Ausdruck wird nicht unterstützt: ' + n.t, n);
  }
  function* execBlock(body, env) { for (const s of body) { const sig = yield* exec(s, env); if (sig) return sig; } return undefined; }
  function* exec(s, env) {
    if (++ops >= BUDGET) { ops = 0; yield { tick: true }; }
    curTask.line = s.line;
    switch (s.t) {
      case 'Expr': yield* ev(s.e, env); return;
      case 'Assign': { const v = yield* ev(s.value, env); for (const t of s.targets) yield* assign(t, v, env); return; }
      case 'AugAssign': { const cur = yield* ev(s.target, env), v = yield* ev(s.value, env); let r; if (s.op === '+' && Array.isArray(cur) && !cur._t) { cur.push(...toList(v)); r = cur; } else r = arith(s.op, cur, v, s); yield* assign(s.target, r, env); return; }
      case 'Pass': return;
      case 'Break': return { brk: true }; case 'Continue': return { cont: true };
      case 'Return': return { ret: s.v ? yield* ev(s.v, env) : null };
      case 'Global': s.names.forEach(nm => env.globals.add(nm)); return;
      case 'If': { for (let i = 0; i < s.tests.length; i++) if (truthy(yield* ev(s.tests[i], env))) return yield* execBlock(s.bodies[i], env); if (s.orelse) return yield* execBlock(s.orelse, env); return; }
      case 'While': { let guard = 0; while (truthy(yield* ev(s.test, env))) { const sig = yield* execBlock(s.body, env); if (sig) { if (sig.brk) return; if (sig.cont) continue; return sig; } if (++guard % 50 === 0) { /* Zeit läuft über ops */ } } if (s.orelse) return yield* execBlock(s.orelse, env); return; }
      case 'For': { const it = yield* ev(s.iter, env); let broke = false;
        if (it instanceof Range && it.c !== 0) { for (let i = it.a; it.c > 0 ? i < it.b : i > it.b; i += it.c) { yield* assign(s.target, i, env); const sig = yield* execBlock(s.body, env); if (sig) { if (sig.brk) { broke = true; break; } if (sig.cont) continue; return sig; } } }
        else for (const x of toList(it, s)) { yield* assign(s.target, x, env); const sig = yield* execBlock(s.body, env); if (sig) { if (sig.brk) { broke = true; break; } if (sig.cont) continue; return sig; } }
        if (!broke && s.orelse) return yield* execBlock(s.orelse, env); return; }
      case 'With': {
        const cm = yield* ev(s.ex, env); let wv = cm;
        const enter = cm && cm.kind === 'inst' ? findAttr(cm.cls, '__enter__') : undefined, exit = cm && cm.kind === 'inst' ? findAttr(cm.cls, '__exit__') : undefined;
        if (enter) wv = yield* callFn(bindTo(enter, cm), [], {}, s);
        if (s.nm) store(env, s.nm, wv);
        try { return yield* execBlock(s.body, env); } finally { if (exit) yield* callFn(bindTo(exit, cm), [null, null, null], {}, s); } }
      case 'Class': {
        const base = s.base ? yield* ev(s.base, env) : null;
        if (base && base.kind !== 'class') throwE('TypeError', 'Im Pi-Lab kann eine Klasse nur von einer eigenen Klasse erben, nicht von Bauteilklassen wie LED', s);
        const cenv = new Env(env, false); yield* execBlock(s.body, cenv);
        const cls = { kind: 'class', name: s.name, base, attrs: cenv.vars };
        cenv.vars.forEach(v => { if (v && v.kind === 'func') { v.closure = env; v.owner = cls; } });
        store(env, s.name, cls); return; }
      case 'Def': { const f = { kind: 'func', name: s.name, params: s.params.map(p => Object.assign({}, p)), body: s.body, closure: env }; for (const p of f.params) if (p.def) p.defv = yield* ev(p.def, env); store(env, s.name, f); return; }
      case 'Try': {
        let sig;
        try { sig = yield* execBlock(s.body, env); if (s.orelse && !sig) sig = yield* execBlock(s.orelse, env); }
        catch (e) {
          if (!(e instanceof PyErr)) throw e; let handled = false;
          for (const h of s.handlers) { let ok = !h.type; if (h.type) { const tv = yield* ev(h.type, env); ok = (tv && tv.exc && (tv.exc === 'Exception' || tv.exc === e.pytype)) || (Array.isArray(tv) && tv.some(x => x.exc === 'Exception' || x.exc === e.pytype)); }
            if (ok) { if (h.name) store(env, h.name, e.pymsg ? e.pytype + ': ' + e.pymsg : e.pytype); handled = true; sig = yield* execBlock(h.body, env); break; } }
          if (!handled) { if (s.fin) yield* execBlock(s.fin, env); throw e; }
        }
        if (s.fin) { const s2 = yield* execBlock(s.fin, env); if (s2) return s2; } return sig; }
      case 'Raise': { if (!s.v) throwE('RuntimeError', 'No active exception to reraise', s); const v = yield* ev(s.v, env); if (v && v.exc) throwE(v.exc, '', s); if (v && v.excInst) throwE(v.excInst.exc, v.excInst.msg, s); throwE('TypeError', 'exceptions must derive from BaseException', s); break; }
      case 'Del': { for (const t of s.targets) { if (t.t === 'Name') env.vars.delete(t.id); else if (t.t === 'Sub') { const o = yield* ev(t.o, env), i = yield* ev(t.idx, env); if (Array.isArray(o)) o.splice(idx(i, o.length, t), 1); else if (o instanceof Map) o.delete(key(i)); } } return; }
      case 'Import': { for (const it of s.items) { const m = MODULES[it.name.split('.')[0]]; if (!m) throwE('ModuleNotFoundError', "No module named '" + it.name + "' (dieses Modul gibt es im Pi-Lab nicht)", s); store(env, (it.as || it.name.split('.')[0]), it.name.includes('.') && it.as ? subMod(m, it.name) : m); } return; }
      case 'ImportFrom': { const m = MODULES[s.mod.split('.')[0]]; if (!m) throwE('ModuleNotFoundError', "No module named '" + s.mod + "' (dieses Modul gibt es im Pi-Lab nicht)", s); const mm = s.mod.includes('.') ? subMod(m, s.mod) : m;
        for (const it of s.items) { if (it.name === '*') { Object.keys(mm.mod).forEach(k => store(env, k, mm.mod[k])); continue; } if (!(it.name in mm.mod)) throwE('ImportError', "cannot import name '" + it.name + "' from '" + s.mod + "'", s); store(env, it.as || it.name, mm.mod[it.name]); } return; }
    }
    throwE('SyntaxError', 'Anweisung wird nicht unterstützt: ' + s.t, s);
  }
  const subMod = (m, full) => { const parts = full.split('.').slice(1); let cur = m; for (const pt of parts) { if (cur.mod && cur.mod[pt] && cur.mod[pt].mod) cur = cur.mod[pt]; } return cur; };

  /* ----- eingebaute Funktionen ----- */
  const num = (x, node) => { if (!isNum(x)) throwE('TypeError', 'Zahl erwartet, bekam ' + (typeof x === 'string' ? 'Text' : 'anderen Typ'), node); return nv(x); };
  const B = {
    print: bi('print', (a, kw) => { const sep = kw.sep != null ? kw.sep : ' ', end = kw.end != null ? kw.end : '\n'; const t = a.map(str).join(sep) + end; self.out += t; io.print && io.print(t); return null; }),
    len: bi('len', a => { const x = a[0]; if (typeof x === 'string' || Array.isArray(x)) return x.length; if (x instanceof Map) return x.size; if (x instanceof Range) return toList(x).length; throwE('TypeError', 'object has no len()'); }),
    range: bi('range', a => { a = a.map(x => { if (!isInt(x)) throwE('TypeError', "'float' object cannot be interpreted as an integer (range braucht ganze Zahlen)"); return nv(x); }); return a.length === 1 ? new Range(0, a[0], 1) : a.length === 2 ? new Range(a[0], a[1], 1) : new Range(a[0], a[1], a[2]); }),
    int: bi('int', (a, kw) => { const x = a[0]; if (x === undefined) return 0; if (typeof x === 'string') { const t = x.trim(); const base = a[1] ? nv(a[1]) : 10; if (!(base === 10 ? /^[+-]?\d+$/ : /^[+-]?[0-9a-zA-Z]+$/).test(t)) throwE('ValueError', "invalid literal for int() with base " + base + ": " + repr(x)); return parseInt(t, base); } return Math.trunc(num(x)); }),
    float: bi('float', a => { const x = a[0]; if (x === undefined) return new F(0); if (typeof x === 'string') { const t = x.trim(); if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$|^[+-]?(inf|nan)$/i.test(t)) throwE('ValueError', 'could not convert string to float: ' + repr(x)); return new F(parseFloat(t)); } return new F(num(x)); }),
    str: bi('str', a => (a.length ? str(a[0]) : '')), bool: bi('bool', a => truthy(a[0])),
    abs: bi('abs', a => { const x = a[0]; return isInt(x) ? Math.abs(nv(x)) : new F(Math.abs(num(x))); }),
    round: bi('round', a => { const x = num(a[0]); if (a.length < 2) { const r = Math.round(x); return (Math.abs(x % 1) === 0.5) ? 2 * Math.round(x / 2) : r; } const d = Math.pow(10, nv(a[1])); return new F(Math.round(x * d) / d); }),
    min: bi('min', (a, kw) => { const L = a.length === 1 ? toList(a[0]) : a; if (!L.length) throwE('ValueError', 'min() arg is an empty sequence'); return L.reduce((m, x) => (cmpVals(x, m) < 0 ? x : m)); }),
    max: bi('max', (a, kw) => { const L = a.length === 1 ? toList(a[0]) : a; if (!L.length) throwE('ValueError', 'max() arg is an empty sequence'); return L.reduce((m, x) => (cmpVals(x, m) > 0 ? x : m)); }),
    sum: bi('sum', a => toList(a[0]).reduce((s, x) => arith('+', s, x), a[1] !== undefined ? a[1] : 0)),
    sorted: bi('sorted', (a, kw) => { const r = toList(a[0]).slice().sort((x, y) => cmpVals(x, y)); if (kw.reverse && truthy(kw.reverse)) r.reverse(); return r; }),
    reversed: bi('reversed', a => toList(a[0]).slice().reverse()), list: bi('list', a => (a.length ? toList(a[0]).slice() : [])),
    tuple: bi('tuple', a => Object.assign(a.length ? toList(a[0]).slice() : [], { _t: true })), dict: bi('dict', (a, kw) => { const d = new Map(); Object.keys(kw).forEach(k => d.set(k, kw[k])); return d; }),
    enumerate: bi('enumerate', a => toList(a[0]).map((x, i) => Object.assign([i + (a[1] ? nv(a[1]) : 0), x], { _t: true }))),
    zip: bi('zip', a => { const L = a.map(x => toList(x)), n = Math.min(...L.map(l => l.length)), r = []; for (let i = 0; i < n; i++) r.push(Object.assign(L.map(l => l[i]), { _t: true })); return r; }),
    any: bi('any', a => toList(a[0]).some(truthy)), all: bi('all', a => toList(a[0]).every(truthy)),
    chr: bi('chr', a => String.fromCharCode(nv(a[0]))), ord: bi('ord', a => a[0].charCodeAt(0)), divmod: bi('divmod', a => Object.assign([arith('//', a[0], a[1]), arith('%', a[0], a[1])], { _t: true })),
    pow: bi('pow', a => arith('**', a[0], a[1])), isinstance: bi('isinstance', a => { const t = a[1]; const chk = tt => (tt && tt.kind === 'class' ? !!(a[0] && a[0].kind === 'inst' && (() => { for (let c = a[0].cls; c; c = c.base) if (c === tt) return true; return false; })()) : tt === B.int ? isInt(a[0]) && typeof a[0] !== 'boolean' : tt === B.float ? a[0] instanceof F : tt === B.str ? typeof a[0] === 'string' : tt === B.list ? Array.isArray(a[0]) && !a[0]._t : tt === B.bool ? typeof a[0] === 'boolean' : false); return Array.isArray(t) ? t.some(chk) : chk(t); }),
    type: bi('type', a => (a[0] instanceof F ? 'float' : typeof a[0] === 'number' ? 'int' : typeof a[0] === 'string' ? 'str' : typeof a[0] === 'boolean' ? 'bool' : Array.isArray(a[0]) ? (a[0]._t ? 'tuple' : 'list') : a[0] instanceof Map ? 'dict' : 'object')),
    input: bi('input', () => throwE('RuntimeError', 'input() gibt es im Pi-Lab nicht. Nutze feste Werte im Programm.')),
    exit: bi('exit', () => { throw { exit: true }; }),
    OSError: { exc: 'OSError' }, IOError: { exc: 'OSError' }, FileNotFoundError: { exc: 'FileNotFoundError' }, Exception: { exc: 'Exception' }, ValueError: { exc: 'ValueError' }, ZeroDivisionError: { exc: 'ZeroDivisionError' }, TypeError: { exc: 'TypeError' }, NameError: { exc: 'NameError' }, IndexError: { exc: 'IndexError' }, KeyError: { exc: 'KeyError' }, KeyboardInterrupt: { exc: 'KeyboardInterrupt' }, RuntimeError: { exc: 'RuntimeError' },
  };
  B.quit = B.exit; B.True = true;
  const mkMod = (name, mod) => ({ name, mod });
  const rngState = { s: (Math.random() * 2 ** 31) | 0 }; const rnd = () => { rngState.s = (rngState.s * 1664525 + 1013904223) >>> 0; return rngState.s / 4294967296; };
  const sleepFn = bi('sleep', function* (a) { const s = num(a[0]); if (s < 0) throwE('ValueError', 'sleep length must be non-negative'); yield { sleep: s }; return null; }, true);
  const MODULES = {
    time: mkMod('time', { sleep: sleepFn, time: bi('time', () => new F(1.7e9 + curTask.vt + ops * COST)), monotonic: bi('monotonic', () => new F(curTask.vt + ops * COST)), perf_counter: bi('perf_counter', () => new F(curTask.vt + ops * COST)) }),
    random: mkMod('random', { random: bi('random', () => new F(rnd())), randint: bi('randint', a => nv(a[0]) + Math.floor(rnd() * (nv(a[1]) - nv(a[0]) + 1))), uniform: bi('uniform', a => new F(nv(a[0]) + rnd() * (nv(a[1]) - nv(a[0])))), choice: bi('choice', a => { const L = toList(a[0]); if (!L.length) throwE('IndexError', 'Cannot choose from an empty sequence'); return L[Math.floor(rnd() * L.length)]; }), seed: bi('seed', a => { rngState.s = nv(a[0]) | 0; return null; }), shuffle: bi('shuffle', a => { const l = a[0]; for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; } return null; }) }),
    math: mkMod('math', { pi: new F(Math.PI), e: new F(Math.E), sqrt: bi('sqrt', a => { if (num(a[0]) < 0) throwE('ValueError', 'math domain error'); return new F(Math.sqrt(nv(a[0]))); }), sin: bi('sin', a => new F(Math.sin(num(a[0])))), cos: bi('cos', a => new F(Math.cos(num(a[0])))), tan: bi('tan', a => new F(Math.tan(num(a[0])))), floor: bi('floor', a => Math.floor(num(a[0]))), ceil: bi('ceil', a => Math.ceil(num(a[0]))), fabs: bi('fabs', a => new F(Math.abs(num(a[0])))), pow: bi('pow', a => new F(Math.pow(num(a[0]), num(a[1])))), log: bi('log', a => new F(a.length > 1 ? Math.log(nv(a[0])) / Math.log(nv(a[1])) : Math.log(num(a[0])))), log10: bi('log10', a => new F(Math.log10(num(a[0])))), radians: bi('radians', a => new F(num(a[0]) * Math.PI / 180)), degrees: bi('degrees', a => new F(num(a[0]) * 180 / Math.PI)) }),
    signal: mkMod('signal', { pause: bi('pause', function* () { yield { pause: true }; return null; }, true) }),
    sys: mkMod('sys', { exit: B.exit }),
  };
  MODULES.gpiozero = mkMod('gpiozero', {});
  MODULES.smbus2 = mkMod('smbus2', {}); MODULES.smbus = mkMod('smbus', {});
  MODULES.RPi = mkMod('RPi', { GPIO: null });

  /* ----- Geräte (gpiozero) ----- */
  const GPIOS = [2, 3, 4, 14, 15, 17, 18, 27, 22, 23, 24, 10, 9, 25, 11, 8, 7, 0, 1, 5, 6, 12, 13, 19, 16, 26, 20, 21];
  const pinCheck = (p, node) => { p = nv(p); if (!GPIOS.includes(p)) throwE('GPIOZeroError', 'GPIO' + p + ' gibt es nicht (erlaubt sind BCM-Nummern wie 17, 18, 27; Tipp: gpiozero nutzt GPIO-Nummern, nicht die Pin-Nummern 1 bis 40)', node); return p; };
  const used = new Map();
  function claim(pin, dev, node) { if (used.has(pin)) throwE('GPIOPinInUse', 'pin GPIO' + pin + ' is already in use by ' + used.get(pin) + ' (ein Pin kann nur von einem Gerät genutzt werden)', node); used.set(pin, dev); }
  const mkDev = (dev, o) => { const d = Object.assign({ dev }, o); devices.push(d); return d; };
  const num01 = (v, node) => { const x = num(v, node); if (x < 0 || x > 1) throwE('OutputDeviceBadValue', 'Wert muss zwischen 0 und 1 liegen', node); return x; };
  function ctor(name) {
    return bi(name, (a, kw, node) => {
      const g = (i, k, def) => (a[i] !== undefined ? a[i] : (kw[k] !== undefined ? kw[k] : def));
      switch (name) {
        case 'LED': { const p = pinCheck(g(0, 'pin'), node); claim(p, 'LED', node); io.setMode(p, 'out'); io.write(p, 0, curTask.vt); return mkDev('LED', { pin: p, on: 0, blink: null }); }
        case 'PWMLED': { const p = pinCheck(g(0, 'pin'), node); claim(p, 'PWMLED', node); io.setMode(p, 'out'); io.write(p, 0, curTask.vt); return mkDev('PWMLED', { pin: p, val: 0, pulse: null }); }
        case 'Buzzer': { const p = pinCheck(g(0, 'pin'), node); claim(p, 'Buzzer', node); io.setMode(p, 'out'); io.write(p, 0, curTask.vt); return mkDev('Buzzer', { pin: p, on: 0, blink: null }); }
        case 'Button': { const p = pinCheck(g(0, 'pin'), node); claim(p, 'Button', node); const pullUp = g(1, 'pull_up', true); io.setMode(p, pullUp === false || pullUp === null ? 'in' : 'up'); return mkDev('Button', { pin: p, pullUp: pullUp !== false, last: null, wp: null, wr: null }); }
        case 'MotionSensor': { const p = pinCheck(g(0, 'pin'), node); claim(p, 'MotionSensor', node); io.setMode(p, 'in'); return mkDev('MotionSensor', { pin: p, last: null, wm: null, wn: null }); }
        case 'DistanceSensor': { const e = pinCheck(g(0, 'echo'), node), t = pinCheck(g(1, 'trigger'), node); claim(e, 'DistanceSensor', node); claim(t, 'DistanceSensor', node); io.setMode(e, 'in'); io.setMode(t, 'out'); io.write(t, 0, curTask.vt); const mx = g(2, 'max_distance', 1); return mkDev('DistanceSensor', { echo: e, trig: t, max: nv(mx) }); }
        case 'Servo': { const p = pinCheck(g(0, 'pin'), node); claim(p, 'Servo', node); io.setMode(p, 'out'); const d = mkDev('Servo', { pin: p, val: 0, angMode: false }); io.servo(p, 90); return d; }
        case 'AngularServo': { const p = pinCheck(g(0, 'pin'), node); claim(p, 'AngularServo', node); io.setMode(p, 'out'); const mn = nv(g(1, 'min_angle', -90)), mx = nv(g(2, 'max_angle', 90)), ia = Math.max(mn, Math.min(mx, nv(g(3, 'initial_angle', 0)))); const d = mkDev('Servo', { pin: p, val: (ia - mn) / (mx - mn) * 2 - 1, angMode: true, mn, mx, angle: ia }); io.servo(p, (ia - mn) / (mx - mn) * 180); return d; }
        case 'SMBus': { const bn = nv(g(0, 'bus', 1)); if (bn !== 1) throwE('FileNotFoundError', "[Errno 2] No such file or directory: '/dev/i2c-" + bn + "' (beim Raspberry Pi liegen GPIO2 und GPIO3 am Bus 1: SMBus(1))", node); return mkDev('SMBus', {}); }
        case 'TonalBuzzer': { const p = pinCheck(g(0, 'pin'), node); claim(p, 'TonalBuzzer', node); io.setMode(p, 'out'); io.write(p, 0, curTask.vt); return mkDev('TonalBuzzer', { pin: p, on: 0, freq: null }); }
        case 'MCP3008': {
          const ch = nv(g(0, 'channel', 0)); if (!Number.isInteger(ch) || ch < 0 || ch > 7) throwE('SPIBadChannel', 'channel muss eine Zahl von 0 bis 7 sein (der MCP3008 hat 8 Kanäle)', node);
          const sw = ['clock_pin', 'mosi_pin', 'miso_pin', 'select_pin'].some(k => kw[k] !== undefined);
          const spec = sw ? { hw: false, clk: pinCheck(kw.clock_pin !== undefined ? kw.clock_pin : 11, node), mosi: pinCheck(kw.mosi_pin !== undefined ? kw.mosi_pin : 10, node), miso: pinCheck(kw.miso_pin !== undefined ? kw.miso_pin : 9, node), cs: pinCheck(kw.select_pin !== undefined ? kw.select_pin : 8, node) }
            : { hw: true, clk: 11, mosi: 10, miso: 9, cs: kw.device !== undefined && nv(kw.device) === 1 ? 7 : 8 };
          const sk = JSON.stringify(spec); if (!spiClaimed.has(sk)) { [spec.clk, spec.mosi, spec.miso, spec.cs].forEach(pp => claim(pp, 'MCP3008', node)); spiClaimed.add(sk); }
          return mkDev('MCP3008', { ch, spec, maxv: nv(g(99, 'max_voltage', 3.3)) });
        }
        case 'LEDBoard': { const leds = a.map(p => ctor('LED')([p], {}, node)); return mkDev('LEDBoard', { leds }); }
        case 'TrafficLights': { const r = ctor('LED')([g(0, 'red')], {}, node), y = ctor('LED')([g(1, 'amber')], {}, node), gr = ctor('LED')([g(2, 'green')], {}, node); return mkDev('TrafficLights', { red: r, amber: y, green: gr }); }
      }
    });
  }
  const spiClaimed = new Set();
  MODULES.smbus2.mod.SMBus = MODULES.smbus.mod.SMBus = ctor('SMBus');
  ['LED', 'PWMLED', 'Buzzer', 'Button', 'MotionSensor', 'DistanceSensor', 'Servo', 'AngularServo', 'LEDBoard', 'TrafficLights', 'MCP3008', 'TonalBuzzer'].forEach(nm => { MODULES.gpiozero.mod[nm] = ctor(nm); });
  const setOut = (d, v) => { d.on = v ? 1 : 0; io.write(d.pin, d.on, curTask.vt); if (d.dev === 'Buzzer' && io.tone) io.tone(d.pin, d.on ? 2300 : null); };
  const noteFreq = (v, node) => {                            // Zahl (Hz) oder Notenname wie 'A4', 'C#5', 'Bb3'
    if (typeof v === 'number' || v instanceof F) { const h = nv(v); if (!(h > 0)) throwE('ValueError', 'Die Frequenz muss größer als 0 sein', node); return h; }
    const m = typeof v === 'string' && v.match(/^([A-Ga-g])([#b]?)(\d)$/); if (!m) throwE('ValueError', 'Unbekannte Note ' + JSON.stringify(v) + ': erlaubt sind Namen wie "A4", "C#5" oder eine Frequenz in Hz', node);
    const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1].toUpperCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); return 440 * Math.pow(2, (12 * (+m[3] + 1) + base - 69) / 12);
  };
  const startBlink = (d, on, off, n, node) => { d.blink = { on, off, n, phase: 0, next: curTask.vt }; };
  function devGet(d, name, node) {
    const f = (fn, gen) => bi(d.dev + '.' + name, (a, kw) => fn(a, kw), gen);
    switch (d.dev) {
      case 'LED': case 'Buzzer': switch (name) {
        case 'on': return f(() => { d.blink = null; setOut(d, 1); return null; }); case 'off': return f(() => { d.blink = null; setOut(d, 0); return null; }); case 'toggle': return f(() => { d.blink = null; setOut(d, d.on ? 0 : 1); return null; });
        case 'blink': case 'beep': return f((a, kw) => { startBlink(d, nv(a[0] !== undefined ? a[0] : (kw.on_time !== undefined ? kw.on_time : 1)), nv(a[1] !== undefined ? a[1] : (kw.off_time !== undefined ? kw.off_time : 1)), kw.n !== undefined ? nv(kw.n) : null, node); return null; });
        case 'is_lit': case 'is_active': case 'value': return d.on ? (name === 'value' ? 1 : true) : (name === 'value' ? 0 : false); case 'pin': return d.pin; } break;
      case 'SMBus': {
        const X = (addr, wr, n) => { const r = io.i2c ? io.i2c(nv(addr), wr, n) : { err: '[Errno 121] Remote I/O error' }; if (r.err) throwE('OSError', r.err, node); return r.data; };
        const by = v => nv(v) & 255;
        switch (name) {
          case 'read_byte': return f(a => X(a[0], [], 1)[0]);
          case 'read_byte_data': return f(a => X(a[0], [by(a[1])], 1)[0]);
          case 'read_word_data': return f(a => { const b = X(a[0], [by(a[1])], 2); return b[0] | (b[1] << 8); });
          case 'read_i2c_block_data': return f(a => X(a[0], [by(a[1])], nv(a[2])).slice());
          case 'write_byte': return f(a => { X(a[0], [by(a[1])], 0); return null; });
          case 'write_byte_data': return f(a => { X(a[0], [by(a[1]), by(a[2])], 0); return null; });
          case 'write_i2c_block_data': return f(a => { X(a[0], [by(a[1])].concat(toList(a[2], node).map(by)), 0); return null; });
          case 'close': return f(() => null);
        } break; }
      case 'TonalBuzzer': switch (name) {
        case 'play': return f(a => { const fr = noteFreq(a[0], node); d.freq = fr; d.on = 1; io.write(d.pin, 1, curTask.vt); if (io.tone) io.tone(d.pin, fr); return null; });
        case 'stop': return f(() => { d.freq = null; d.on = 0; io.write(d.pin, 0, curTask.vt); if (io.tone) io.tone(d.pin, null); return null; });
        case 'is_active': return d.on ? true : false; case 'value': return d.on ? 1 : 0; case 'pin': return d.pin; } break;
      case 'PWMLED': switch (name) {
        case 'on': return f(() => { d.pulse = null; setVal(d, 1); return null; }); case 'off': return f(() => { d.pulse = null; setVal(d, 0); return null; }); case 'toggle': return f(() => { d.pulse = null; setVal(d, d.val > 0 ? 0 : 1); return null; });
        case 'pulse': return f((a, kw) => { d.pulse = { fi: nv(a[0] !== undefined ? a[0] : (kw.fade_in_time !== undefined ? kw.fade_in_time : 1)), fo: nv(a[1] !== undefined ? a[1] : (kw.fade_out_time !== undefined ? kw.fade_out_time : 1)), t0: curTask.vt }; return null; });
        case 'blink': return f((a, kw) => { d.pulse = null; d.blink = { on: nv(a[0] !== undefined ? a[0] : (kw.on_time !== undefined ? kw.on_time : 1)), off: nv(a[1] !== undefined ? a[1] : (kw.off_time !== undefined ? kw.off_time : 1)), n: null, phase: 0, next: curTask.vt }; return null; });
        case 'value': return new F(d.val); case 'is_lit': return d.val > 0; } break;
      case 'Button': switch (name) {
        case 'is_pressed': case 'is_active': return btnPressed(d); case 'value': return btnPressed(d) ? 1 : 0;
        case 'wait_for_press': return f(function* () { while (!btnPressed(d)) yield { sleep: 0.002 }; return null; }, true); case 'wait_for_release': return f(function* () { while (btnPressed(d)) yield { sleep: 0.002 }; return null; }, true);
        case 'when_pressed': return d.wp; case 'when_released': return d.wr; } break;
      case 'MotionSensor': switch (name) {
        case 'motion_detected': case 'is_active': case 'value': return io.read(d.pin) ? (name === 'value' ? 1 : true) : (name === 'value' ? 0 : false);
        case 'wait_for_motion': return f(function* () { while (!io.read(d.pin)) yield { sleep: 0.002 }; return null; }, true); case 'wait_for_no_motion': return f(function* () { while (io.read(d.pin)) yield { sleep: 0.002 }; return null; }, true);
        case 'when_motion': return d.wm; case 'when_no_motion': return d.wn; } break;
      case 'DistanceSensor': if (name === 'distance') return { __gen: distGen(d, node) }; if (name === 'max_distance') return new F(d.max); break;
      case 'Servo': switch (name) {
        case 'value': return d.val === null ? null : new F(d.val); case 'angle': return d.angMode ? new F(d.angle) : null;
        case 'min': return f(() => { servoVal(d, -1); return null; }); case 'mid': return f(() => { servoVal(d, 0); return null; }); case 'max': return f(() => { servoVal(d, 1); return null; }); case 'detach': return f(() => { io.servo(d.pin, null); return null; }); } break;
      case 'GPIOPWM': return gpioPwmGet(d, name, node);
      case 'MCP3008': {
        const rd = () => { const r = io.adc(d.ch, d.spec); if (r.err) throwE('GPIOZeroError', r.err, node); return r; };
        switch (name) { case 'value': return new F(rd().value); case 'raw_value': return rd().raw; case 'voltage': return new F(rd().value * d.maxv); case 'channel': return d.ch; case 'bits': return 10; }
        break; }
      case 'LEDBoard': switch (name) {
        case 'on': return f(() => { d.leds.forEach(l => { l.blink = null; setOut(l, 1); }); return null; }); case 'off': return f(() => { d.leds.forEach(l => { l.blink = null; setOut(l, 0); }); return null; }); case 'toggle': return f(() => { d.leds.forEach(l => { l.blink = null; setOut(l, l.on ? 0 : 1); }); return null; });
        case 'blink': return f((a, kw) => { d.leds.forEach(l => startBlink(l, nv(a[0] !== undefined ? a[0] : 1), nv(a[1] !== undefined ? a[1] : 1), null, node)); return null; }); case 'leds': return d.leds; } break;
      case 'TrafficLights': switch (name) {
        case 'red': return d.red; case 'amber': case 'yellow': return d.amber; case 'green': return d.green;
        case 'on': return f(() => { [d.red, d.amber, d.green].forEach(l => { l.blink = null; setOut(l, 1); }); return null; }); case 'off': return f(() => { [d.red, d.amber, d.green].forEach(l => { l.blink = null; setOut(l, 0); }); return null; }); } break;
    }
    throwE('AttributeError', "'" + d.dev + "' object has no attribute '" + name + "'", node);
  }
  const btnPressed = d => { const v = io.read(d.pin); return d.pullUp ? !v : !!v; };
  function setVal(d, v) { d.val = v; io.pwm(d.pin, v >= 1 ? null : v, v >= 1 ? 1 : 0); if (v >= 1) io.write(d.pin, 1, curTask.vt); else if (v <= 0) { io.pwm(d.pin, null); io.write(d.pin, 0, curTask.vt); } }
  function servoVal(d, v) { d.val = v; const deg = (v + 1) * 90; d.angle = d.angMode ? d.mn + (deg / 180) * (d.mx - d.mn) : deg; io.servo(d.pin, deg); }
  function devSet(d, name, v, node) {
    switch (d.dev) {
      case 'PWMLED': if (name === 'value') { d.pulse = null; d.blink = null; setVal(d, num01(v, node)); return; } break;
      case 'LED': case 'Buzzer': if (name === 'value') { d.blink = null; setOut(d, truthy(v) && nv(v) ? 1 : 0); return; } break;
      case 'Button': if (name === 'when_pressed') { d.wp = v; return; } if (name === 'when_released') { d.wr = v; return; } break;
      case 'MotionSensor': if (name === 'when_motion') { d.wm = v; return; } if (name === 'when_no_motion') { d.wn = v; return; } break;
      case 'Servo': if (name === 'value') { servoVal(d, Math.max(-1, Math.min(1, num(v, node)))); return; }
        if (name === 'angle' && d.angMode) { const a = Math.max(d.mn, Math.min(d.mx, num(v, node))); d.angle = a; d.val = (a - d.mn) / (d.mx - d.mn) * 2 - 1; io.servo(d.pin, (a - d.mn) / (d.mx - d.mn) * 180); return; } break;
    }
    throwE('AttributeError', "'" + d.dev + "' hat kein Attribut '" + name + "' zum Setzen", node);
  }
  function* distGen(d, node) {
    io.write(d.trig, 1, curTask.vt); io.write(d.trig, 0, curTask.vt + 1.2e-5); yield { sleep: 0.03 };
    const us = io.echo(d.echo); if (us == null) return new F(d.max);
    return new F(Math.min(d.max, (us * 1e-6 * 343) / 2));
  }
  // RPi.GPIO
  const GP = { BCM: 11, BOARD: 10, OUT: 'out', IN: 'in', HIGH: 1, LOW: 0, PUD_UP: 'up', PUD_DOWN: 'down', RISING: 1, FALLING: 2, BOTH: 3 };
  const pwms = [];
  const physToGpio = { 3: 2, 5: 3, 7: 4, 8: 14, 10: 15, 11: 17, 12: 18, 13: 27, 15: 22, 16: 23, 18: 24, 19: 10, 21: 9, 22: 25, 23: 11, 24: 8, 26: 7, 27: 0, 28: 1, 29: 5, 31: 6, 32: 12, 33: 13, 35: 19, 36: 16, 37: 26, 38: 20, 40: 21 };
  let gpioMode = null; const gp = (p, node) => { p = nv(p); if (gpioMode === null) throwE('RuntimeError', 'Please set pin numbering mode using GPIO.setmode(GPIO.BOARD) or GPIO.setmode(GPIO.BCM)', node); if (gpioMode === 10) { if (!(p in physToGpio)) throwE('ValueError', 'Pin ' + p + ' ist kein GPIO-Pin', node); return physToGpio[p]; } return pinCheck(p, node); };
  const gpioApi = Object.assign({}, GP, {
    setmode: bi('setmode', a => { gpioMode = nv(a[0]); return null; }), setwarnings: bi('setwarnings', () => null), getmode: bi('getmode', () => gpioMode),
    setup: bi('setup', (a, kw, node) => { const ps = Array.isArray(a[0]) ? a[0] : [a[0]]; ps.forEach(p0 => { const p = gp(p0, node), dir = a[1] !== undefined ? a[1] : kw.direction; const pud = kw.pull_up_down; io.setMode(p, dir === 'out' ? 'out' : (pud === 'up' ? 'up' : 'in')); if (dir === 'out') io.write(p, kw.initial ? 1 : 0, curTask.vt); }); return null; }),
    output: bi('output', (a, kw, node) => { const ps = Array.isArray(a[0]) ? a[0] : [a[0]]; ps.forEach(p0 => { io.write(gp(p0, node), truthy(a[1]) && nv(a[1]) ? 1 : 0, curTask.vt); }); return null; }),
    input: bi('input', (a, kw, node) => (io.read(gp(a[0], node)) ? 1 : 0)), cleanup: bi('cleanup', () => { pwms.forEach(p => io.pwm(p.pin, null)); return null; }),
    PWM: bi('PWM', (a, kw, node) => { const p = gp(a[0], node), o = mkDev('GPIOPWM', { pin: p, freq: nv(a[1]), duty: 0 }); pwms.push(o); return o; }),
    wait_for_edge: bi('wait_for_edge', function* (a, kw, node) { const p = gp(a[0], node), mode = nv(a[1]); const prev = io.read(p) ? 1 : 0; for (;;) { yield { sleep: 0.002 }; const now = io.read(p) ? 1 : 0; if (now !== prev && ((mode === 3) || (mode === 1 && now) || (mode === 2 && !now))) return p; } }, true),
  });
  MODULES.RPi.mod.GPIO = mkMod('RPi.GPIO', gpioApi);
  function gpioPwmGet(d, name, node) {
    const f = fn => bi('PWM.' + name, fn);
    if (name === 'start') return f(a => { d.duty = nv(a[0]); io.pwm(d.pin, d.duty / 100); return null; });
    if (name === 'ChangeDutyCycle') return f(a => { d.duty = nv(a[0]); io.pwm(d.pin, d.duty / 100); return null; });
    if (name === 'ChangeFrequency') return f(a => { d.freq = nv(a[0]); return null; });
    if (name === 'stop') return f(() => { io.pwm(d.pin, null); io.write(d.pin, 0, curTask.vt); return null; });
    throwE('AttributeError', "'PWM' object has no attribute '" + name + "'", node);
  }

  /* ----- Ausführung: Aufgaben (main + Rückrufe) und Zeit ----- */
  const topEnv = new Env(null, false);
  Object.keys(B).forEach(k => topEnv.vars.set(k, B[k]));
  topEnv.vars.set('__name__', '__main__');
  function newTask(genFactory, name) { const t = { name, vt: self.t, wakeAt: self.t, done: false, paused: false, line: 0 }; t.gen = genFactory(t); tasks.push(t); return t; }
  function runTask(t, tNow) {
    curTask = t; let guard = 0;
    while (!t.done && !t.paused && t.wakeAt <= tNow && guard++ < 200) {
      let r; ops = 0;
      try { r = t.gen.next(); }
      catch (e) {
        t.done = true;
        if (e && e.exit) { return; }
        if (e instanceof PyErr) { if (t.name === 'main' || !self.error) self.error = { type: e.pytype, msg: e.pymsg, line: e.line || t.line, text: 'Traceback (most recent call last):\n  Zeile ' + (e.line || t.line) + '\n' + e.pytype + (e.pymsg ? ': ' + e.pymsg : '') }; io.print && io.print('\n' + self.error.text + '\n'); return; }
        throw e;
      }
      if (r.done) { t.done = true; return; }
      const y = r.value || {};
      t.vt = Math.max(t.vt, t.wakeAt);
      if (y.sleep !== undefined) { t.vt += ops * COST; t.wakeAt = t.vt + y.sleep; t.vt = t.wakeAt; }
      else if (y.pause) { t.paused = true; }
      else { t.vt += BUDGET * COST; t.wakeAt = t.vt; if (t.wakeAt > tNow) break; }
    }
  }
  function pollDevices(tNow) {
    for (const d of devices) {
      if (d.dev === 'Button') {
        const p = btnPressed(d); if (d.last === null) { d.last = p; continue; }
        if (p !== d.last) { d.last = p; const cb = p ? d.wp : d.wr; if (cb) spawn(cb, tNow); }
      } else if (d.dev === 'MotionSensor') {
        const p = !!io.read(d.pin); if (d.last === null) { d.last = p; continue; }
        if (p !== d.last) { d.last = p; const cb = p ? d.wm : d.wn; if (cb) spawn(cb, tNow); }
      } else if ((d.dev === 'LED' || d.dev === 'Buzzer' || d.dev === 'PWMLED') && d.blink) {
        const b = d.blink; if (tNow >= b.next) {
          const turnOn = b.phase === 0; if (d.dev === 'PWMLED') { d.val = turnOn ? 1 : 0; io.write(d.pin, turnOn ? 1 : 0, b.next); io.pwm(d.pin, null); } else { d.on = turnOn ? 1 : 0; io.write(d.pin, d.on, b.next); if (d.dev === 'Buzzer' && io.tone) io.tone(d.pin, d.on ? 2300 : null); }
          b.next += turnOn ? b.on : b.off; b.phase = turnOn ? 1 : 0; if (!turnOn && b.n != null) { b.n--; if (b.n <= 0) d.blink = null; }
        }
      } else if (d.dev === 'PWMLED' && d.pulse) {
        const p = d.pulse, cyc = p.fi + p.fo, ph = ((tNow - p.t0) % cyc + cyc) % cyc, v = ph < p.fi ? ph / p.fi : 1 - (ph - p.fi) / p.fo; d.val = v; io.pwm(d.pin, Math.max(0.001, Math.min(0.999, v)));
      }
    }
  }
  function spawn(cb, tNow) {
    const t = { name: 'cb', vt: tNow, wakeAt: tNow, done: false, paused: false, line: 0 };
    t.gen = (function* () { curTask = t; yield* callFn(cb, [], {}, null); })(); tasks.push(t);
  }
  self.start = function () {
    self.error = null; self.t = 0;
    newTask(function (t) { return (function* () { curTask = t; yield* execBlock(prog.body, topEnv); })(); }, 'main');
  };
  self.step = function (tNow) {
    self.t = tNow; if (self.error && false) return;
    pollDevices(tNow);
    for (let i = 0; i < tasks.length; i++) { const t = tasks[i]; if (!t.done) runTask(t, tNow); }
    for (let i = tasks.length - 1; i >= 0; i--) if (tasks[i].done && tasks[i].name !== 'main') tasks.splice(i, 1);
    self.done = tasks.length === 0 || tasks.every(t => t.done || t.paused) && !devices.some(d => d.wp || d.wr || d.wm || d.wn || d.blink || d.pulse);
  };
  return self;
}

const api = { compile, createRunner, F, PyErr, str, repr };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PyRun = api;
})(typeof window !== 'undefined' ? window : globalThis);
