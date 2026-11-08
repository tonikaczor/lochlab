'use strict';
/* Tonfunk Datenbank-Lab (SQL): eigener SQL-Interpreter in reinem JavaScript (Kennung 'sql'). window.SQL_CORE bzw. module.exports.
   Keine externe Bibliothek, alles offline. Es gibt KEINE Ausnahmen nach außen: Fehler kommen als deutsche Meldung im Ergebnis ({ok:false, error}).
   Unterstützt:
     SELECT [DISTINCT] Spalten/Ausdrücke [AS Alias] FROM Tabelle [Alias] [, Tabelle] [[INNER|LEFT|CROSS] JOIN Tabelle [Alias] [ON Bedingung]]
            [WHERE ...] [GROUP BY ...] [HAVING ...] [ORDER BY ... [ASC|DESC]] [LIMIT n [OFFSET m]]   (auch Unterabfragen in FROM, WHERE, IN, EXISTS und als Einzelwert)
     INSERT INTO t [(Spalten)] VALUES (...)[, (...)] | INSERT INTO t [(Spalten)] SELECT ...
     UPDATE t SET s = Ausdruck [, ...] [WHERE ...]      DELETE FROM t [WHERE ...]
   Ausdrücke: + - * / % ||, Vergleiche, AND OR NOT, IS [NOT] NULL, [NOT] IN, [NOT] BETWEEN, [NOT] LIKE, EXISTS, CASE WHEN,
     COUNT SUM AVG MIN MAX (auch COUNT(DISTINCT x)), UPPER LOWER LENGTH TRIM ROUND ABS COALESCE IFNULL SUBSTR CONCAT.
   Drei-Wertelogik (TRUE, FALSE, NULL/unbekannt) wie im SQL-Standard. Datenbank = { tables: { name: { name, cols:[{n,type,nn}], pk:[..], fks:[{c,t,rc}], rows:[[..]] } } }.
   Fremdschlüssel werden geprüft (RESTRICT, kein CASCADE); Primärschlüssel, NOT NULL und Datentypen auch. Jede Anweisung ist atomar. */
(function (root) {
  const fin = Number.isFinite;
  class SqlError extends Error {}
  const err = m => { throw new SqlError(m); };
  const r10 = x => (fin(x) ? Math.round(x * 1e10) / 1e10 : x);
  const MAX_ROWS = 200000, MAX_OPS = 3000000;

  /* ---------- Zahlen und Zufall (wie in den anderen Labs) ---------- */
  function hashStr(s) { let h = 2166136261 >>> 0; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function rng(seed) { let a = typeof seed === 'number' ? seed >>> 0 : hashStr(seed); return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function shuffle(R, arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NaN;
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/(zeilen|zeile|stück|stk)$/i, '');
    if (/^[+\-−]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '');
    s = s.replace(',', '.');
    if (!/^[+\-−]?\d+(\.\d+)?$|^[+\-−]?\.\d+$/.test(s)) return NaN;
    return parseFloat(s.replace('−', '-'));
  }
  /* Anzeige eines Wertes: Dezimalkomma, höchstens 4 Nachkommastellen, NULL als "NULL" */
  function fmtVal(v) {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (typeof v === 'number') { if (!fin(v)) return 'NULL'; let s = (Math.round(v * 1e4) / 1e4).toString(); if (/e/i.test(s)) s = v.toFixed(4); return s.replace('.', ','); }
    return String(v);
  }

  /* ============================================================ Tokenizer */
  const RESERVED = new Set(['SELECT', 'FROM', 'WHERE', 'GROUP', 'BY', 'HAVING', 'ORDER', 'LIMIT', 'OFFSET', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER', 'CROSS', 'ON', 'AS', 'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL', 'LIKE', 'BETWEEN', 'EXISTS', 'DISTINCT', 'ASC', 'DESC', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'UNION', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'TRUE', 'FALSE', 'ALL', 'USING', 'NATURAL']);
  function tokenize(src) {
    const out = []; let i = 0; const n = src.length;
    while (i < n) {
      const c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '-' && src[i + 1] === '-') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); if (e < 0) err('Der Kommentar /* … */ wird nie geschlossen (es fehlt */).'); i = e + 2; continue; }
      const st = i;
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
        while (i < n && /[0-9]/.test(src[i])) i++;
        if (src[i] === '.') { i++; while (i < n && /[0-9]/.test(src[i])) i++; }
        if (/[A-Za-zÄÖÜäöüß_]/.test(src[i] || '')) err('Ungültige Zahl oder Name bei „' + src.slice(st, i + 1) + '“ (Position ' + (st + 1) + '). Namen dürfen nicht mit einer Ziffer beginnen.');
        out.push({ t: 'num', v: parseFloat(src.slice(st, i)), pos: st, end: i }); continue;
      }
      if (/[A-Za-zÄÖÜäöüß_]/.test(c)) { while (i < n && /[A-Za-zÄÖÜäöüß_0-9]/.test(src[i])) i++; out.push({ t: 'id', v: src.slice(st, i), pos: st, end: i }); continue; }
      if (c === "'") {
        let s = ''; i++;
        for (;;) { if (i >= n) err('Der Text ab Position ' + (st + 1) + ' wird nie geschlossen (es fehlt das schließende Hochkomma \').'); if (src[i] === "'") { if (src[i + 1] === "'") { s += "'"; i += 2; continue; } i++; break; } s += src[i++]; }
        out.push({ t: 'str', v: s, pos: st, end: i }); continue;
      }
      if (c === '"' || c === '`') { const e = src.indexOf(c, i + 1); if (e < 0) err('Der Name in ' + c + ' ab Position ' + (st + 1) + ' wird nie geschlossen.'); out.push({ t: 'id', v: src.slice(i + 1, e), pos: st, end: e + 1, q: true }); i = e + 1; continue; }
      const two = src.slice(i, i + 2);
      if (['<>', '!=', '<=', '>=', '||'].includes(two)) { out.push({ t: 'op', v: two === '!=' ? '<>' : two, pos: st, end: i + 2 }); i += 2; continue; }
      if ('=<>+-*/%'.includes(c)) { out.push({ t: 'op', v: c, pos: st, end: i + 1 }); i++; continue; }
      if ('(),.;'.includes(c)) { out.push({ t: 'p', v: c, pos: st, end: i + 1 }); i++; continue; }
      err('Unerwartetes Zeichen „' + c + '“ an Position ' + (st + 1) + '.' + (c === '’' || c === '‘' || c === '“' || c === '”' ? ' Das ist ein typografisches Anführungszeichen; benutze das gerade Hochkomma \'.' : ''));
    }
    out.push({ t: 'eof', v: '', pos: src.length, end: src.length });
    return out;
  }

  /* ============================================================ Parser */
  /* PRUEFEN P6: Umfang der Sprache: SELECT mit JOIN (INNER, LEFT, CROSS), GROUP BY, HAVING, ORDER BY, LIMIT, Unterabfragen, INSERT, UPDATE, DELETE. Bewusst nicht enthalten: CREATE/ALTER/DROP, UNION, RIGHT/FULL JOIN, Fensterfunktionen, Transaktionen. Reicht das für das 1.-2. Lehrjahr, oder sollen CREATE TABLE und UNION dazu? */
  function parseScript(src) {
    const toks = tokenize(src); let p = 0; const text = src;
    const peek = () => toks[p], next = () => toks[p++];
    const up = t => (t.t === 'id' && !t.q ? t.v.toUpperCase() : null);
    const isKw = (k, o) => { const t = toks[p + (o || 0)]; return up(t) === k; };
    const isP = v => toks[p].t === 'p' && toks[p].v === v;
    const isOp = v => toks[p].t === 'op' && toks[p].v === v;
    const show = t => (t.t === 'eof' ? 'Ende der Eingabe' : '„' + (t.t === 'str' ? "'" + t.v + "'" : src.slice(t.pos, t.end)) + '“');
    const bad = what => err('Syntaxfehler bei ' + show(peek()) + (peek().t === 'eof' ? '' : ' (Position ' + (peek().pos + 1) + ')') + ': ' + what);
    const acceptKw = k => { if (isKw(k)) { p++; return true; } return false; };
    const expectKw = (k, what) => { if (!acceptKw(k)) bad(what || ('erwartet wird ' + k + '.')); };
    const acceptP = v => { if (isP(v)) { p++; return true; } return false; };
    const expectP = (v, what) => { if (!acceptP(v)) bad(what || ('erwartet wird „' + v + '“.')); };
    function ident(what) { const t = peek(); if (t.t !== 'id' || (!t.q && RESERVED.has(up(t)))) bad(what || 'erwartet wird ein Name.'); p++; return t.v; }

    function parseStatement() {
      const t = peek(), k = up(t);
      if (k === 'SELECT') return parseSelect();
      if (k === 'INSERT') return parseInsert();
      if (k === 'UPDATE') return parseUpdate();
      if (k === 'DELETE') return parseDelete();
      if (t.t === 'p' && t.v === '(') bad('Eine Anweisung beginnt mit SELECT, INSERT, UPDATE oder DELETE.');
      if (['CREATE', 'DROP', 'ALTER', 'TRUNCATE', 'GRANT', 'REVOKE', 'REPLACE', 'MERGE', 'WITH', 'BEGIN', 'COMMIT', 'ROLLBACK', 'PRAGMA', 'SHOW', 'DESCRIBE', 'USE'].includes(k)) err('„' + k + '“ wird in diesem Lab nicht unterstützt. Möglich sind SELECT, INSERT, UPDATE und DELETE.');
      bad('Eine Anweisung beginnt mit SELECT, INSERT, UPDATE oder DELETE.');
    }
    function parseSelect() {
      expectKw('SELECT');
      const q = { k: 'select', distinct: false, items: [], from: null, where: null, group: [], having: null, order: [], limit: null, offset: null };
      if (acceptKw('DISTINCT')) q.distinct = true; else acceptKw('ALL');
      for (;;) {
        if (isOp('*')) { p++; q.items.push({ star: true, t: null }); }
        else if (peek().t === 'id' && toks[p + 1].t === 'p' && toks[p + 1].v === '.' && toks[p + 2].t === 'op' && toks[p + 2].v === '*') { q.items.push({ star: true, t: peek().v }); p += 3; }
        else {
          const st = peek().pos; const e = parseExpr(); const text0 = text.slice(st, toks[p - 1].end).replace(/\s+/g, ' ');
          let alias = null; if (acceptKw('AS')) { const t = peek(); if (t.t === 'id' || t.t === 'str') { alias = t.v; p++; } else bad('nach AS wird ein Name für die Spalte erwartet.'); }
          q.items.push({ e, alias, text: text0 });
        }
        if (acceptP(',')) { if (isKw('FROM') || peek().t === 'eof') bad('nach dem Komma fehlt ein weiterer Spaltenname oder Ausdruck (überflüssiges Komma vor FROM?).'); continue; }
        break;
      }
      if (!isKw('FROM') && peek().t === 'id' && !peek().q && !RESERVED.has(up(peek()))) bad('nach der Spaltenliste fehlt FROM (oder ein Komma zwischen den Spalten).');
      if (isKw('FROM')) {
        p++; q.from = { src: parseSrc(), joins: [] };
        for (;;) {
          if (acceptP(',')) { q.from.joins.push({ kind: 'cross', src: parseSrc(), on: null }); continue; }
          let kind = null;
          if (isKw('JOIN')) { p++; kind = 'inner'; }
          else if (isKw('INNER') && isKw('JOIN', 1)) { p += 2; kind = 'inner'; }
          else if (isKw('LEFT')) { p++; acceptKw('OUTER'); expectKw('JOIN', 'nach LEFT muss JOIN stehen.'); kind = 'left'; }
          else if (isKw('CROSS') && isKw('JOIN', 1)) { p += 2; kind = 'cross'; }
          else if (isKw('RIGHT') || isKw('FULL')) err(up(peek()) + ' JOIN wird in diesem Lab nicht unterstützt. Vertausche die Tabellen und nimm LEFT JOIN.');
          else if (isKw('NATURAL') || isKw('USING')) err(up(peek()) + ' wird in diesem Lab nicht unterstützt. Schreibe die Bedingung mit ON.');
          else break;
          const src = parseSrc(); let on = null;
          if (acceptKw('ON')) on = parseExpr();
          else if (kind === 'left') bad('LEFT JOIN braucht eine Bedingung mit ON.');
          q.from.joins.push({ kind: on || kind !== 'cross' ? kind : 'cross', src, on });
        }
      }
      if (acceptKw('WHERE')) q.where = parseExpr();
      if (isKw('GROUP')) { p++; expectKw('BY', 'nach GROUP muss BY stehen.'); do q.group.push(parseExpr()); while (acceptP(',')); }
      if (acceptKw('HAVING')) q.having = parseExpr();
      if (isKw('ORDER')) { p++; expectKw('BY', 'nach ORDER muss BY stehen.'); do { const e = parseExpr(); let dir = 1; if (acceptKw('DESC')) dir = -1; else acceptKw('ASC'); q.order.push({ e, dir }); } while (acceptP(',')); }
      if (acceptKw('LIMIT')) { q.limit = parseCount('LIMIT'); if (acceptKw('OFFSET')) q.offset = parseCount('OFFSET'); }
      if (isKw('UNION') || isKw('INTERSECT') || isKw('EXCEPT')) err(up(peek()) + ' wird in diesem Lab nicht unterstützt.');
      return q;
    }
    function parseCount(w) { const t = peek(); if (t.t !== 'num' || t.v < 0 || Math.floor(t.v) !== t.v) bad('nach ' + w + ' wird eine ganze Zahl (0 oder größer) erwartet.'); p++; return t.v; }
    function parseSrc() {
      if (isP('(')) {
        p++; if (!isKw('SELECT')) bad('in der Klammer nach FROM wird eine Unterabfrage mit SELECT erwartet.');
        const sub = parseSelect(); expectP(')', 'die Unterabfrage braucht eine schließende Klammer „)“.');
        acceptKw('AS'); const alias = ident('eine Unterabfrage in FROM braucht einen Alias, z. B. (SELECT …) AS x.');
        return { sub, alias };
      }
      const table = ident('nach FROM wird ein Tabellenname erwartet.'); let alias = null;
      if (acceptKw('AS')) alias = ident('nach AS wird ein Alias erwartet.');
      else if (peek().t === 'id' && !peek().q && !RESERVED.has(up(peek()))) alias = ident();
      return { table, alias };
    }
    function parseInsert() {
      expectKw('INSERT'); expectKw('INTO', 'nach INSERT muss INTO stehen.');
      const table = ident('nach INSERT INTO wird ein Tabellenname erwartet.'); let cols = null;
      if (isP('(') && !(isKw('SELECT', 1))) { p++; cols = []; do cols.push(ident('erwartet wird ein Spaltenname.')); while (acceptP(',')); expectP(')', 'die Spaltenliste braucht eine schließende Klammer „)“.'); }
      if (isKw('SELECT')) return { k: 'insert', table, cols, sel: parseSelect() };
      expectKw('VALUES', 'nach dem Tabellennamen (und der Spaltenliste) fehlt VALUES.');
      const rows = [];
      do { expectP('(', 'nach VALUES wird eine Klammer „(“ mit den Werten erwartet.'); const r = []; do r.push(parseExpr()); while (acceptP(',')); expectP(')', 'die Werteliste braucht eine schließende Klammer „)“ (oder es fehlt ein Komma zwischen den Werten).'); rows.push(r); } while (acceptP(','));
      return { k: 'insert', table, cols, rows };
    }
    function parseUpdate() {
      expectKw('UPDATE'); const table = ident('nach UPDATE wird ein Tabellenname erwartet.'); expectKw('SET', 'nach dem Tabellennamen fehlt SET.');
      const sets = []; do { const c = ident('nach SET wird ein Spaltenname erwartet.'); if (!isOp('=')) bad('nach dem Spaltennamen fehlt „=“.'); p++; sets.push({ c, e: parseExpr() }); } while (acceptP(','));
      let where = null; if (acceptKw('WHERE')) where = parseExpr();
      return { k: 'update', table, sets, where };
    }
    function parseDelete() {
      expectKw('DELETE'); expectKw('FROM', 'nach DELETE muss FROM stehen (DELETE FROM tabelle …).'); const table = ident('nach DELETE FROM wird ein Tabellenname erwartet.');
      let where = null; if (acceptKw('WHERE')) where = parseExpr();
      return { k: 'delete', table, where };
    }

    /* ----- Ausdrücke ----- */
    function parseExpr() { return parseOr(); }
    function parseOr() { let l = parseAnd(); while (acceptKw('OR')) l = { k: 'bin', op: 'OR', l, r: parseAnd() }; return l; }
    function parseAnd() { let l = parseNot(); while (acceptKw('AND')) l = { k: 'bin', op: 'AND', l, r: parseNot() }; return l; }
    function parseNot() { if (acceptKw('NOT')) return { k: 'not', e: parseNot() }; return parseCmp(); }
    function parseCmp() {
      let l = parseAdd();
      for (;;) {
        const t = peek();
        if (t.t === 'op' && ['=', '<>', '<', '<=', '>', '>='].includes(t.v)) { p++; l = { k: 'bin', op: t.v, l, r: parseAdd() }; continue; }
        if (isKw('IS')) { p++; const neg = acceptKw('NOT'); if (!acceptKw('NULL')) bad('nach IS [NOT] wird NULL erwartet.'); l = { k: 'isnull', e: l, neg }; continue; }
        let neg = false; if (isKw('NOT') && (isKw('IN', 1) || isKw('BETWEEN', 1) || isKw('LIKE', 1))) { p++; neg = true; }
        if (acceptKw('IN')) {
          expectP('(', 'nach IN wird eine Klammer „(“ erwartet.');
          if (isKw('SELECT')) { const sub = parseSelect(); expectP(')', 'die Unterabfrage braucht eine schließende Klammer „)“.'); l = { k: 'in', e: l, sub, neg }; }
          else { const list = []; do list.push(parseExpr()); while (acceptP(',')); expectP(')', 'die Liste nach IN braucht eine schließende Klammer „)“.'); l = { k: 'in', e: l, list, neg }; }
          continue;
        }
        if (acceptKw('BETWEEN')) { const lo = parseAdd(); expectKw('AND', 'bei BETWEEN … AND fehlt das AND.'); const hi = parseAdd(); l = { k: 'between', e: l, lo, hi, neg }; continue; }
        if (acceptKw('LIKE')) { l = { k: 'like', e: l, pat: parseAdd(), neg }; continue; }
        break;
      }
      return l;
    }
    function parseAdd() { let l = parseMul(); for (;;) { const t = peek(); if (t.t === 'op' && (t.v === '+' || t.v === '-' || t.v === '||')) { p++; l = { k: 'bin', op: t.v, l, r: parseMul() }; } else return l; } }
    function parseMul() { let l = parseUn(); for (;;) { const t = peek(); if (t.t === 'op' && (t.v === '*' || t.v === '/' || t.v === '%')) { p++; l = { k: 'bin', op: t.v, l, r: parseUn() }; } else return l; } }
    function parseUn() { if (isOp('-')) { p++; return { k: 'neg', e: parseUn() }; } if (isOp('+')) { p++; return parseUn(); } return parsePrim(); }
    function parsePrim() {
      const t = peek();
      if (t.t === 'num') { p++; return { k: 'lit', v: t.v }; }
      if (t.t === 'str') { p++; return { k: 'lit', v: t.v }; }
      if (t.t === 'p' && t.v === '(') {
        p++; if (isKw('SELECT')) { const sub = parseSelect(); expectP(')', 'die Unterabfrage braucht eine schließende Klammer „)“.'); return { k: 'sub', sub }; }
        const e = parseExpr(); expectP(')', 'es fehlt eine schließende Klammer „)“.'); return e;
      }
      if (t.t === 'id') {
        const k = up(t);
        if (k === 'NULL') { p++; return { k: 'lit', v: null }; }
        if (k === 'TRUE') { p++; return { k: 'lit', v: true }; }
        if (k === 'FALSE') { p++; return { k: 'lit', v: false }; }
        if (k === 'EXISTS') { p++; expectP('(', 'nach EXISTS wird „(“ erwartet.'); if (!isKw('SELECT')) bad('in EXISTS (…) wird eine Unterabfrage mit SELECT erwartet.'); const sub = parseSelect(); expectP(')', 'die Unterabfrage braucht eine schließende Klammer „)“.'); return { k: 'exists', sub }; }
        if (k === 'CASE') {
          p++; const whens = []; let els = null;
          if (!isKw('WHEN')) bad('nach CASE wird WHEN erwartet (nur CASE WHEN … THEN … END wird unterstützt).');
          while (acceptKw('WHEN')) { const c = parseExpr(); expectKw('THEN', 'nach WHEN … fehlt THEN.'); whens.push([c, parseExpr()]); }
          if (acceptKw('ELSE')) els = parseExpr(); expectKw('END', 'CASE wird mit END abgeschlossen.'); return { k: 'case', whens, els };
        }
        if (toks[p + 1].t === 'p' && toks[p + 1].v === '(' && !t.q) {
          p += 2; const fn = { k: 'fn', name: k, args: [], distinct: false, star: false };
          if (isOp('*')) { p++; fn.star = true; } else if (!isP(')')) { if (acceptKw('DISTINCT')) fn.distinct = true; do fn.args.push(parseExpr()); while (acceptP(',')); }
          expectP(')', 'der Funktionsaufruf braucht eine schließende Klammer „)“.'); return fn;
        }
        if (!t.q && RESERVED.has(k)) bad('hier wird ein Wert oder ein Spaltenname erwartet.');
        p++;
        if (isP('.')) { p++; const c = peek(); if (c.t === 'op' && c.v === '*') bad('„tabelle.*“ ist nur direkt hinter SELECT erlaubt.'); if (c.t !== 'id') bad('nach dem Punkt wird ein Spaltenname erwartet.'); p++; return { k: 'col', t: t.v, n: c.v }; }
        return { k: 'col', t: null, n: t.v, q: !!t.q };
      }
      bad('hier wird ein Wert oder ein Spaltenname erwartet.');
    }

    const stmts = [];
    while (peek().t !== 'eof') {
      if (acceptP(';')) continue;
      const st = peek().pos; const s = parseStatement(); s.src = text.slice(st, toks[p - 1].end);
      if (peek().t !== 'eof' && !isP(';')) bad('hier ist die Anweisung eigentlich zu Ende. Es fehlt ein Schlüsselwort (z. B. WHERE, JOIN, ORDER BY) oder ein Komma davor.');
      stmts.push(s);
    }
    return stmts;
  }

  /* ============================================================ Datenbank */
  const cloneDb = db => { const o = { tables: {} }; Object.keys(db.tables).forEach(k => { const t = db.tables[k]; o.tables[k] = { name: t.name, cols: t.cols.map(c => Object.assign({}, c)), pk: t.pk.slice(), fks: t.fks.map(f => Object.assign({}, f)), rows: t.rows.map(r => r.slice()) }; }); return o; };
  const findTable = (db, name) => { const k = Object.keys(db.tables).find(x => x.toLowerCase() === String(name).toLowerCase()); return k ? db.tables[k] : null; };
  const needTable = (db, name) => findTable(db, name) || err('Die Tabelle „' + name + '“ gibt es nicht. Vorhandene Tabellen: ' + Object.keys(db.tables).join(', ') + '.');
  const colIdx = (t, n) => t.cols.findIndex(c => c.n.toLowerCase() === String(n).toLowerCase());

  /* ============================================================ Auswertung von Ausdrücken */
  const isAgg = n => n.k === 'fn' && ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'].includes(n.name);
  function hasAgg(n) {
    if (!n || typeof n !== 'object') return false;
    if (isAgg(n)) return true;
    if (n.k === 'sub' || n.k === 'exists' || (n.k === 'in' && n.sub && false)) return false;
    return Object.keys(n).some(k => { const v = n[k]; if (k === 'sub') return false; return Array.isArray(v) ? v.some(x => Array.isArray(x) ? x.some(hasAgg) : hasAgg(x)) : (v && typeof v === 'object' ? hasAgg(v) : false); });
  }
  const tname = v => (typeof v === 'string' ? 'Text' : typeof v === 'number' ? 'Zahl' : 'Wahrheitswert');
  function toNum(v, what) { if (typeof v === 'number') return v; if (typeof v === 'boolean') return v ? 1 : 0; err('Mit ' + tname(v) + ' „' + v + '“ kann man nicht rechnen (' + what + '). Hier werden Zahlen erwartet.'); }
  function cmp(a, b) {
    if (typeof a === 'boolean') a = a ? 1 : 0; if (typeof b === 'boolean') b = b ? 1 : 0;
    if (typeof a !== typeof b) {
      const n = typeof a === 'string' ? a : b;
      if (/^\s*-?\d+(\.\d+)?\s*$/.test(n)) { a = typeof a === 'string' ? parseFloat(a) : a; b = typeof b === 'string' ? parseFloat(b) : b; }
      else err('Text und Zahl lassen sich nicht vergleichen („' + (typeof a === 'string' ? a : b) + '“ ist Text). Texte gehören in einfache Hochkommas, Zahlen nicht.');
    }
    return a < b ? -1 : a > b ? 1 : 0;
  }
  const truth = v => (v === null || v === undefined ? null : typeof v === 'boolean' ? v : typeof v === 'number' ? v !== 0 : err('Als Bedingung wird ein Vergleich erwartet, aber hier steht der Text „' + v + '“.'));
  const likeRe = pat => new RegExp('^' + String(pat).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '[\\s\\S]*').replace(/_/g, '[\\s\\S]') + '$', 'i'); /* PRUEFEN P1 */

  function resolveCol(ctx, node) {
    for (let c = ctx; c; c = c.outer) {
      const cols = c.scope.cols; let hit = -1, cnt = 0;
      for (let i = 0; i < cols.length; i++) {
        if (node.t ? (cols[i].t.toLowerCase() === node.t.toLowerCase() && cols[i].n.toLowerCase() === node.n.toLowerCase()) : cols[i].n.toLowerCase() === node.n.toLowerCase()) { hit = i; cnt++; }
      }
      if (cnt > 1) err('Die Spalte „' + node.n + '“ ist mehrdeutig, sie kommt in mehreren Tabellen vor. Schreibe tabelle.spalte, z. B. ' + cols[hit].t + '.' + node.n + '.');
      if (cnt === 1) return { c, i: hit };
    }
    if (node.t) { const tabs = []; ctx.scope.cols.forEach(c => { if (!tabs.includes(c.t)) tabs.push(c.t); }); if (!tabs.some(t => t.toLowerCase() === node.t.toLowerCase())) err('Die Tabelle bzw. der Alias „' + node.t + '“ ist in dieser Abfrage nicht vorhanden' + (tabs.length ? ' (vorhanden: ' + tabs.join(', ') + ')' : '') + '.'); err('Die Spalte „' + node.n + '“ gibt es in „' + node.t + '“ nicht. Vorhanden: ' + ctx.scope.cols.filter(c => c.t.toLowerCase() === node.t.toLowerCase()).map(c => c.n).join(', ') + '.'); }
    const names = ctx.scope.cols.map(c => c.n).filter((x, i, a) => a.indexOf(x) === i);
    err('Die Spalte „' + node.n + '“ gibt es nicht' + (names.length ? ' (vorhanden: ' + names.join(', ') + ')' : ' (die Abfrage hat keine Tabelle)') + '.' + (node.q ? '' : ' Wenn du einen Text meinst, setze ihn in einfache Hochkommas, z. B. \'' + node.n + '\'.'));
  }
  function ev(n, ctx) {
    if (++ctx.g.ops > MAX_OPS) err('Die Abfrage ist zu aufwendig für dieses Lab (zu viele Zwischenergebnisse). Prüfe, ob eine JOIN-Bedingung fehlt.');
    switch (n.k) {
      case 'lit': return n.v;
      case 'col': { const r = resolveCol(ctx, n); const row = r.c.row; if (!row) return null; return row[r.i]; }
      case 'neg': { const v = ev(n.e, ctx); return v === null ? null : -toNum(v, 'Minuszeichen'); }
      case 'not': { const v = truth(ev(n.e, ctx)); return v === null ? null : !v; }
      case 'isnull': { const v = ev(n.e, ctx); return n.neg ? v !== null : v === null; }
      case 'bin': {
        if (n.op === 'AND') { const a = truth(ev(n.l, ctx)); if (a === false) return false; const b = truth(ev(n.r, ctx)); if (b === false) return false; return a === null || b === null ? null : true; }
        if (n.op === 'OR') { const a = truth(ev(n.l, ctx)); if (a === true) return true; const b = truth(ev(n.r, ctx)); if (b === true) return true; return a === null || b === null ? null : false; }
        const a = ev(n.l, ctx), b = ev(n.r, ctx);
        if (n.op === '||') return a === null || b === null ? null : String(typeof a === 'number' ? fmtVal(a).replace(',', '.') : a) + String(typeof b === 'number' ? fmtVal(b).replace(',', '.') : b);
        if (a === null || b === null) return null;
        switch (n.op) {
          case '=': return cmp(a, b) === 0; case '<>': return cmp(a, b) !== 0; case '<': return cmp(a, b) < 0; case '<=': return cmp(a, b) <= 0; case '>': return cmp(a, b) > 0; case '>=': return cmp(a, b) >= 0;
          case '+': return r10(toNum(a, 'Plus') + toNum(b, 'Plus')); case '-': return r10(toNum(a, 'Minus') - toNum(b, 'Minus')); case '*': return r10(toNum(a, 'Mal') * toNum(b, 'Mal'));
          case '/': { const d = toNum(b, 'Geteilt'); if (d === 0) err('Division durch 0 ist nicht möglich.'); return r10(toNum(a, 'Geteilt') / d); } /* PRUEFEN P3 */
          case '%': { const d = toNum(b, 'Modulo'); if (d === 0) err('Division durch 0 ist nicht möglich.'); return toNum(a, 'Modulo') % d; }
        }
        return null;
      }
      case 'between': { const v = ev(n.e, ctx), lo = ev(n.lo, ctx), hi = ev(n.hi, ctx); if (v === null || lo === null || hi === null) return null; const r = cmp(v, lo) >= 0 && cmp(v, hi) <= 0; return n.neg ? !r : r; }
      case 'like': { const v = ev(n.e, ctx), pt = ev(n.pat, ctx); if (v === null || pt === null) return null; const r = likeRe(pt).test(String(v)); return n.neg ? !r : r; }
      case 'in': {
        const v = ev(n.e, ctx); let vals;
        if (n.sub) { const rs = execSelect(n.sub, ctx.g, ctx); if (rs.cols.length !== 1) err('Die Unterabfrage bei IN muss genau eine Spalte liefern, sie liefert ' + rs.cols.length + '.'); vals = rs.rows.map(r => r[0]); }
        else vals = n.list.map(x => ev(x, ctx));
        if (v === null) return vals.length === 0 ? (n.neg ? true : false) : null;
        let hasNull = false, found = false;
        for (const x of vals) { if (x === null) { hasNull = true; continue; } if (cmp(v, x) === 0) { found = true; break; } }
        const r = found ? true : hasNull ? null : false; return r === null ? null : (n.neg ? !r : r);
      }
      case 'exists': { const rs = execSelect(n.sub, ctx.g, ctx); return rs.rows.length > 0; }
      case 'sub': { const rs = execSelect(n.sub, ctx.g, ctx); if (rs.cols.length !== 1) err('Eine Unterabfrage als Einzelwert muss genau eine Spalte liefern, sie liefert ' + rs.cols.length + '.'); if (rs.rows.length > 1) err('Die Unterabfrage liefert ' + rs.rows.length + ' Zeilen, hier wird genau ein Wert erwartet. Nutze IN statt =, oder eine Aggregatfunktion wie MAX.'); return rs.rows.length ? rs.rows[0][0] : null; }
      case 'case': { for (const [c, r] of n.whens) if (truth(ev(c, ctx)) === true) return ev(r, ctx); return n.els ? ev(n.els, ctx) : null; }
      case 'fn': return evFn(n, ctx);
    }
    return err('Interner Fehler: unbekannter Ausdruck.');
  }
  function evFn(n, ctx) {
    if (isAgg(n)) {
      if (ctx.inAgg) err('Aggregatfunktionen dürfen nicht ineinander verschachtelt werden.');
      if (!ctx.group) err('Aggregatfunktionen (' + n.name + ') sind hier nicht erlaubt. In WHERE gehören Bedingungen für einzelne Zeilen; Bedingungen für Gruppen kommen in HAVING.');
      if (n.star) { if (n.name !== 'COUNT') err(n.name + '(*) gibt es nicht, nur COUNT(*).'); return ctx.group.length; }
      if (n.args.length !== 1) err(n.name + ' braucht genau einen Wert in der Klammer.');
      let vals = ctx.group.map(r => ev(n.args[0], Object.assign({}, ctx, { row: r, inAgg: true, group: null }))).filter(v => v !== null);
      if (n.distinct) { const seen = new Set(), o = []; vals.forEach(v => { const k = typeof v + ':' + v; if (!seen.has(k)) { seen.add(k); o.push(v); } }); vals = o; }
      if (n.name === 'COUNT') return vals.length;
      if (!vals.length) return null;
      if (n.name === 'SUM' || n.name === 'AVG') { const s = vals.reduce((a, v) => a + toNum(v, n.name), 0); return r10(n.name === 'SUM' ? s : s / vals.length); }
      let best = vals[0]; for (const v of vals) { const c = cmp(v, best); if (n.name === 'MIN' ? c < 0 : c > 0) best = v; } return best;
    }
    const a = n.args.map(x => ev(x, ctx)), need = (lo, hi) => { if (a.length < lo || a.length > hi) err(n.name + ' braucht ' + (lo === hi ? lo : lo + ' bis ' + hi) + ' Wert(e) in der Klammer, hier sind es ' + a.length + '.'); };
    switch (n.name) {
      case 'UPPER': need(1, 1); return a[0] === null ? null : String(a[0]).toUpperCase();
      case 'LOWER': need(1, 1); return a[0] === null ? null : String(a[0]).toLowerCase();
      case 'LENGTH': need(1, 1); return a[0] === null ? null : String(a[0]).length;
      case 'TRIM': need(1, 1); return a[0] === null ? null : String(a[0]).trim();
      case 'ABS': need(1, 1); return a[0] === null ? null : Math.abs(toNum(a[0], 'ABS'));
      case 'ROUND': { need(1, 2); if (a[0] === null) return null; const d = a.length > 1 ? toNum(a[1], 'ROUND') : 0, f = Math.pow(10, d), v = toNum(a[0], 'ROUND'); return Math.round((v + (v >= 0 ? 1e-9 : -1e-9)) * f) / f; }
      case 'COALESCE': case 'IFNULL': { if (!a.length) need(1, 99); for (const v of a) if (v !== null) return v; return null; }
      case 'SUBSTR': case 'SUBSTRING': { need(2, 3); if (a[0] === null) return null; const s = String(a[0]), st = Math.max(1, toNum(a[1], 'SUBSTR')) - 1; return a.length > 2 ? s.substr(st, toNum(a[2], 'SUBSTR')) : s.slice(st); }
      case 'CONCAT': { return a.some(v => v === null) ? null : a.map(v => (typeof v === 'number' ? fmtVal(v).replace(',', '.') : String(v))).join(''); }
    }
    return err('Die Funktion „' + n.name + '“ kennt dieses Lab nicht. Verfügbar: COUNT, SUM, AVG, MIN, MAX, UPPER, LOWER, LENGTH, TRIM, ROUND, ABS, COALESCE, SUBSTR, CONCAT.');
  }

  /* ============================================================ SELECT */
  const keyOf = v => (v === null ? 'N' : typeof v === 'number' ? 'n' + (Math.round(v * 1e6) / 1e6) : typeof v === 'boolean' ? 'b' + v : 's' + v);
  const rowKey = r => r.map(keyOf).join('\u0001');
  /* Struktureller Schlüssel eines Ausdrucks, Spalten über ihre aufgelöste Position (für die GROUP-BY-Prüfung) */
  function canon(n, ctx) {
    if (!n || typeof n !== 'object') return String(n);
    if (n.k === 'col') { try { const r = resolveCol(ctx, n); return 'col#' + (r.c === ctx ? '' : 'o') + r.i; } catch (e) { return 'col?' + n.n; } }
    if (Array.isArray(n)) return '[' + n.map(x => canon(x, ctx)).join(',') + ']';
    return '{' + Object.keys(n).filter(k => k !== 'text').map(k => k + ':' + (n[k] && typeof n[k] === 'object' ? canon(n[k], ctx) : JSON.stringify(n[k]))).join(',') + '}';
  }
  function checkGrouped(n, gkeys, ctx, shown) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(x => checkGrouped(x, gkeys, ctx, shown)); return; }
    if (n.k === 'col') { if (gkeys.has(canon(n, ctx))) return; err('Die Spalte „' + (n.t ? n.t + '.' : '') + n.n + '“ steht weder in GROUP BY noch in einer Aggregatfunktion (COUNT, SUM, …). Entweder nimmst du sie in GROUP BY auf oder du fasst sie mit einer Aggregatfunktion zusammen.'); } /* PRUEFEN P4 */
    if (isAgg(n)) return;
    if (n.k === 'sub' || n.k === 'exists') return;
    if (gkeys.has(canon(n, ctx))) return;
    Object.keys(n).forEach(k => { if (k === 'sub' || k === 'text') return; const v = n[k]; if (v && typeof v === 'object') checkGrouped(v, gkeys, ctx, shown); });
  }
  function loadSrc(s, g, outer) {
    if (s.sub) { const rs = execSelect(s.sub, g, outer); return { cols: rs.cols.map(n => ({ t: s.alias, n })), rows: rs.rows }; }
    const t = needTable(g.db, s.table), nm = s.alias || t.name;
    return { cols: t.cols.map(c => ({ t: nm, n: c.n })), rows: t.rows };
  }
  function execSelect(q, g, outer) {
    let scope, rows;
    if (!q.from) { scope = { cols: [] }; rows = [[]]; }
    else {
      const f0 = loadSrc(q.from.src, g, outer); scope = { cols: f0.cols }; rows = f0.rows;
      const names = [f0.cols.length ? f0.cols[0].t.toLowerCase() : ''];
      for (const j of q.from.joins) {
        const r = loadSrc(j.src, g, outer), nm = r.cols.length ? r.cols[0].t.toLowerCase() : '';
        if (names.includes(nm)) err('Die Tabelle „' + r.cols[0].t + '“ kommt mehrfach vor. Gib ihr mit einem Alias (z. B. ' + r.cols[0].t + ' AS x) einen zweiten Namen.');
        names.push(nm);
        const cols = scope.cols.concat(r.cols), sc2 = { cols }, out = [], rn = r.cols.length;
        if (rows.length * Math.max(1, r.rows.length) > MAX_ROWS * 5) err('Das Zwischenergebnis wird zu groß (' + rows.length + ' × ' + r.rows.length + ' Zeilen). Fehlt eine JOIN-Bedingung?');
        for (const l of rows) {
          let matched = false;
          for (const rr of r.rows) {
            const row = l.concat(rr);
            if (j.on) { const c = { scope: sc2, row, outer, g, group: null }; if (truth(ev(j.on, c)) !== true) continue; }
            out.push(row); matched = true; if (out.length > MAX_ROWS) err('Das Zwischenergebnis wird zu groß (mehr als ' + MAX_ROWS + ' Zeilen). Fehlt eine JOIN-Bedingung?');
          }
          if (!matched && j.kind === 'left') out.push(l.concat(new Array(rn).fill(null)));
        }
        scope = sc2; rows = out;
      }
    }
    const mk = (row, group) => ({ scope, row, outer, g, group: group || null });
    if (q.where) {
      if (hasAgg(q.where)) err('Aggregatfunktionen (COUNT, SUM, …) sind in WHERE nicht erlaubt. In WHERE gehören Bedingungen für einzelne Zeilen; Bedingungen für Gruppen kommen in HAVING.');
      rows = rows.filter(r => truth(ev(q.where, mk(r))) === true);
    }
    /* Sternchen aufklappen */
    let items = [];
    q.items.forEach(it => {
      if (!it.star) { items.push(it); return; }
      if (!scope.cols.length) err('SELECT * braucht eine Tabelle (FROM fehlt).');
      const cs = it.t ? scope.cols.filter(c => c.t.toLowerCase() === it.t.toLowerCase()) : scope.cols;
      if (!cs.length) err('Die Tabelle bzw. der Alias „' + it.t + '“ gibt es in dieser Abfrage nicht.');
      cs.forEach(c => items.push({ e: { k: 'col', t: c.t, n: c.n }, alias: null, text: c.n, fromStar: true }));
    });
    const outNames = items.map(it => it.alias || (it.e.k === 'col' ? it.e.n : it.text));
    const grouped = q.group.length > 0 || items.some(it => hasAgg(it.e)) || (q.having && hasAgg(q.having)) || q.order.some(o => hasAgg(o.e));
    /* ORDER BY und GROUP BY: Alias oder Nummer erlaubt */
    const pickAlias = e => {
      if (e.k === 'lit' && typeof e.v === 'number') { if (Math.floor(e.v) !== e.v || e.v < 1 || e.v > items.length) err('Die Nummer ' + e.v + ' in ORDER BY/GROUP BY passt zu keiner Spalte (1 bis ' + items.length + ').'); return items[e.v - 1].e; }
      if (e.k === 'col' && !e.t) { const i = q.items.findIndex(it => it.alias && it.alias.toLowerCase() === e.n.toLowerCase()); if (i >= 0) { const it = q.items[i]; if (!it.star) { let hit = false; try { resolveCol(mk(null), e); hit = true; } catch (x) { /* kein Spaltenname: Alias */ } if (!hit) return it.e; } } }
      return e;
    };
    const order = q.order.map(o => ({ e: pickAlias(o.e), dir: o.dir }));
    let outRows;
    if (!grouped) {
      if (q.having) err('HAVING gehört zu GROUP BY. Für einfache Bedingungen nimm WHERE.');
      const tmp = rows.map(r => { const c = mk(r); return { v: items.map(it => ev(it.e, c)), k: order.map(o => ev(o.e, c)) }; });
      outRows = sortDistinct(tmp, order, q);
    } else {
      const gexp = q.group.map(pickAlias);
      gexp.forEach(e => { if (hasAgg(e)) err('In GROUP BY dürfen keine Aggregatfunktionen stehen.'); });
      const base = mk(null), gkeys = new Set(gexp.map(e => canon(e, base)));
      items.forEach(it => checkGrouped(it.e, gkeys, base)); if (q.having) checkGrouped(q.having, gkeys, base); order.forEach(o => checkGrouped(o.e, gkeys, base));
      const groups = new Map();
      if (!gexp.length) groups.set('', rows);
      else rows.forEach(r => { const c = mk(r), key = gexp.map(e => keyOf(ev(e, c))).join('\u0001'); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(r); });
      const tmp = [];
      groups.forEach(gr => {
        const c = mk(gr[0] || null, gr);
        if (q.having && truth(ev(q.having, c)) !== true) return;
        tmp.push({ v: items.map(it => ev(it.e, c)), k: order.map(o => ev(o.e, c)) });
      });
      outRows = sortDistinct(tmp, order, q);
    }
    return { cols: outNames, rows: outRows };
  }
  function cmpSort(a, b) { if (a === null || b === null) return a === b ? 0 : a === null ? -1 : 1; return cmp(a, b); } /* PRUEFEN P2: NULL gilt als kleinster Wert (zuerst bei ASC) */
  function sortDistinct(tmp, order, q) {
    if (order.length) tmp = tmp.map((x, i) => ({ x, i })).sort((A, B) => { for (let j = 0; j < order.length; j++) { const c = cmpSort(A.x.k[j], B.x.k[j]) * order[j].dir; if (c) return c; } return A.i - B.i; }).map(o => o.x);
    let out = tmp.map(x => x.v);
    if (q.distinct) { const seen = new Set(); out = out.filter(r => { const k = rowKey(r); if (seen.has(k)) return false; seen.add(k); return true; }); }
    if (q.offset) out = out.slice(q.offset);
    if (q.limit !== null) out = out.slice(0, q.limit);
    return out;
  }

  /* ============================================================ Datenänderung */
  /* PRUEFEN P13: Datentypen vereinfacht: INT, DECIMAL, TEXT, DATE; Datum als Text 'JJJJ-MM-TT' (ISO), Vergleich wie Text, Dezimalpunkt statt Komma. Reichen diese vier Typen (VARCHAR(n), BOOLEAN, DATETIME fehlen)? */
  const TYPES = { INT: v => typeof v === 'number' && Math.floor(v) === v, DECIMAL: v => typeof v === 'number', TEXT: v => typeof v === 'string', DATE: v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v };
  const TYPE_HINT = { INT: 'eine ganze Zahl', DECIMAL: 'eine Zahl', TEXT: 'ein Text in einfachen Hochkommas', DATE: "ein Datum im Format 'JJJJ-MM-TT'" };
  function checkRow(t, row) {
    t.cols.forEach((c, i) => {
      const v = row[i];
      if (v === null || v === undefined) { if (c.nn || t.pk.some(p => p.toLowerCase() === c.n.toLowerCase())) err('Die Spalte „' + c.n + '“ in „' + t.name + '“ darf nicht leer (NULL) sein.'); return; }
      if (!TYPES[c.type](v)) err('Der Wert „' + fmtVal(v) + '“ passt nicht zur Spalte „' + c.n + '“ (' + c.type + '): erwartet wird ' + TYPE_HINT[c.type] + '.');
    });
  }
  const pkIdx = t => t.pk.map(p => colIdx(t, p));
  function checkKeys(db, t, rows, skipSelf) {
    const pi = pkIdx(t);
    if (pi.length) { const seen = new Set(); rows.forEach(r => { const k = rowKey(pi.map(i => r[i])); if (seen.has(k)) err('Der Primärschlüssel ' + t.pk.map((p, j) => p + ' = ' + fmtVal(r[pi[j]])).join(', ') + ' kommt in „' + t.name + '“ schon vor. Ein Primärschlüssel muss eindeutig sein.'); seen.add(k); }); }
    t.fks.forEach(fk => {
      const rt = findTable(db, fk.t), ci = colIdx(t, fk.c), ri = colIdx(rt, fk.rc); const src = rt === t ? rows : rt.rows; const have = new Set(src.map(r => keyOf(r[ri])));
      rows.forEach(r => { const v = r[ci]; if (v !== null && !have.has(keyOf(v))) err('Fremdschlüssel verletzt: ' + fk.c + ' = ' + fmtVal(v) + ' gibt es in „' + rt.name + '“ (Spalte ' + fk.rc + ') nicht. Lege zuerst die Zeile in „' + rt.name + '“ an.'); });
    });
  }
  /* PRUEFEN P5: Fremdschlüssel verhalten sich wie RESTRICT: Eine Elternzeile kann nicht gelöscht oder im Schlüssel geändert werden, solange Kindzeilen auf sie zeigen (kein ON DELETE CASCADE). Entspricht das dem, was ihr im Unterricht zeigt? */
  function checkRestrict(db, t, goneRows, keptRows, what) {
    /* Zeilen aus t verschwinden bzw. ändern ihren Schlüssel: kein anderer Datensatz darf noch darauf zeigen */
    Object.keys(db.tables).forEach(k => {
      const ct = db.tables[k];
      ct.fks.filter(fk => fk.t.toLowerCase() === t.name.toLowerCase()).forEach(fk => {
        const ri = colIdx(t, fk.rc), ci = colIdx(ct, fk.c), still = new Set(keptRows.map(r => keyOf(r[ri])));
        const kids = ct === t ? keptRows : ct.rows;
        goneRows.forEach(g => {
          const key = keyOf(g[ri]); if (still.has(key) || g[ri] === null) return;
          const kid = kids.find(r => r[ci] !== null && keyOf(r[ci]) === key);
          if (kid) err('Die Zeile mit ' + fk.rc + ' = ' + fmtVal(g[ri]) + ' in „' + t.name + '“ kann nicht ' + what + ', weil sie in „' + ct.name + '“ noch verwendet wird (Fremdschlüssel ' + fk.c + '). Ändere oder lösche zuerst die abhängigen Zeilen.');
        });
      });
    });
  }
  function execInsert(s, g) {
    const t = needTable(g.db, s.table), idx = s.cols ? s.cols.map(c => { const i = colIdx(t, c); if (i < 0) err('Die Spalte „' + c + '“ gibt es in „' + t.name + '“ nicht. Vorhanden: ' + t.cols.map(x => x.n).join(', ') + '.'); return i; }) : t.cols.map((c, i) => i);
    if (new Set(idx).size !== idx.length) err('In der Spaltenliste kommt eine Spalte doppelt vor.');
    let vals;
    if (s.sel) { const rs = execSelect(s.sel, g, null); vals = rs.rows; } else { const c = { scope: { cols: [] }, row: [], outer: null, g, group: null }; vals = s.rows.map(r => r.map(e => ev(e, c))); }
    const nr = vals.map(v => {
      if (v.length !== idx.length) err((s.cols ? 'Es sind ' + idx.length + ' Spalten angegeben' : 'Die Tabelle „' + t.name + '“ hat ' + idx.length + ' Spalten') + ', aber ' + v.length + ' Werte' + (s.cols ? '' : ' (nenne die Spalten, wenn du nicht alle füllen willst)') + '.');
      const row = new Array(t.cols.length).fill(null); idx.forEach((ci, j) => { row[ci] = v[j]; }); checkRow(t, row); return row;
    });
    const all = t.rows.concat(nr); checkKeys(g.db, t, all);
    nr.forEach(r => t.rows.push(r)); return { kind: 'insert', affected: nr.length, table: t.name };
  }
  function execUpdate(s, g) {
    const t = needTable(g.db, s.table), sc = { cols: t.cols.map(c => ({ t: t.name, n: c.n })) };
    const sets = s.sets.map(x => { const i = colIdx(t, x.c); if (i < 0) err('Die Spalte „' + x.c + '“ gibt es in „' + t.name + '“ nicht. Vorhanden: ' + t.cols.map(c => c.n).join(', ') + '.'); return { i, e: x.e }; });
    if (new Set(sets.map(x => x.i)).size !== sets.length) err('Eine Spalte wird in SET mehrfach gesetzt.');
    if (s.where && hasAgg(s.where)) err('Aggregatfunktionen sind in WHERE nicht erlaubt.');
    const olds = [], news = t.rows.map(r => { const c = { scope: sc, row: r, outer: null, g, group: null }; if (s.where && truth(ev(s.where, c)) !== true) return r; olds.push(r); const nr = r.slice(); sets.forEach(x => { nr[x.i] = ev(x.e, c); }); checkRow(t, nr); return nr; });
    checkKeys(g.db, t, news);
    const changedOld = olds.filter(r => news[t.rows.indexOf(r)].some((v, i) => keyOf(v) !== keyOf(r[i])));
    checkRestrict(g.db, t, changedOld, news, 'geändert werden');
    t.rows = news; return { kind: 'update', affected: olds.length, table: t.name };
  }
  function execDelete(s, g) {
    const t = needTable(g.db, s.table), sc = { cols: t.cols.map(c => ({ t: t.name, n: c.n })) };
    if (s.where && hasAgg(s.where)) err('Aggregatfunktionen sind in WHERE nicht erlaubt.');
    const gone = [], keep = [];
    t.rows.forEach(r => { const c = { scope: sc, row: r, outer: null, g, group: null }; if (!s.where || truth(ev(s.where, c)) === true) gone.push(r); else keep.push(r); });
    checkRestrict(g.db, t, gone, keep, 'gelöscht werden');
    t.rows = keep; return { kind: 'delete', affected: gone.length, table: t.name };
  }

  /* ============================================================ Öffentliche Schnittstelle */
  /* exec(db, sql): führt eine oder mehrere durch ; getrennte Anweisungen der Reihe nach aus (db wird verändert, bei Fehler bleibt die fehlerhafte Anweisung ohne Wirkung).
     Ergebnis: { ok, results:[{kind:'select'|'insert'|'update'|'delete', cols, rows, affected, table, sql}], error, failed:Index } */
  function exec(db, sql) {
    const res = { ok: true, results: [], error: null, failed: -1 };
    try {
      if (typeof sql !== 'string' || !sql.trim()) err('Bitte gib zuerst eine Anweisung ein.');
      const stmts = parseScript(sql); if (!stmts.length) err('Bitte gib zuerst eine Anweisung ein.');
      const g = { db, ops: 0 };
      stmts.forEach((s, i) => {
        try {
          g.ops = 0;
          if (s.k === 'select') { const r = execSelect(s, g, null); res.results.push({ kind: 'select', cols: r.cols, rows: r.rows, affected: 0, sql: s.src }); }
          else { const r = s.k === 'insert' ? execInsert(s, g) : s.k === 'update' ? execUpdate(s, g) : execDelete(s, g); r.cols = []; r.rows = []; r.sql = s.src; res.results.push(r); }
        } catch (e) { res.failed = i; throw e; }
      });
    } catch (e) {
      res.ok = false; res.error = e instanceof SqlError ? e.message : 'Interner Fehler im Lab: ' + (e && e.message ? e.message : e) + '. Bitte formuliere die Anweisung anders.';
      if (res.failed >= 0 && res.results.length > 0) res.error = 'Anweisung ' + (res.failed + 1) + ': ' + res.error;
    }
    return res;
  }
  /* Kurzform: genau ein Ergebnis oder Fehler. Gibt {ok, kind, cols, rows, affected, table} zurück. */
  function run(db, sql) { const r = exec(db, sql); if (!r.ok) return { ok: false, error: r.error }; const l = r.results[r.results.length - 1]; return Object.assign({ ok: true }, l); }

  /* ---------- Ergebnisse vergleichen (Prüfung der Aufgaben) ---------- */
  const normRow = r => r.map(keyOf);
  function compareResults(act, exp, ordered) {
    if (!act || act.kind !== 'select') return { ok: false, reason: 'kind', msg: 'Hier wird eine SELECT-Abfrage erwartet, die ein Ergebnis liefert.' };
    if (act.cols.length !== exp.cols.length) return { ok: false, reason: 'cols', msg: 'Dein Ergebnis hat ' + act.cols.length + ' Spalte' + (act.cols.length === 1 ? '' : 'n') + ', erwartet werden ' + exp.cols.length + '. Prüfe, welche Spalten die Aufgabe verlangt.' };
    if (act.rows.length !== exp.rows.length) return { ok: false, reason: 'rows', msg: 'Dein Ergebnis hat ' + act.rows.length + ' Zeile' + (act.rows.length === 1 ? '' : 'n') + ', erwartet werden ' + exp.rows.length + '. Prüfe deine Bedingungen (WHERE, JOIN, GROUP BY, HAVING, LIMIT).' };
    const a = act.rows.map(rowKey), e = exp.rows.map(rowKey);
    const sa = a.slice().sort(), se = e.slice().sort();
    let diff = 0; for (let i = 0; i < sa.length; i++) if (sa[i] !== se[i]) diff++;
    if (diff) return { ok: false, reason: 'values', msg: 'Die Anzahl stimmt, aber der Inhalt weicht ab (' + diff + ' Zeile' + (diff === 1 ? '' : 'n') + ' passen nicht). Vergleiche Werte, Spaltenreihenfolge und Bedingungen.' };
    if (ordered) for (let i = 0; i < a.length; i++) if (a[i] !== e[i]) return { ok: false, reason: 'order', msg: 'Die Zeilen sind richtig, aber die Reihenfolge stimmt nicht. Die Aufgabe verlangt eine bestimmte Sortierung (ORDER BY).' };
    return { ok: true };
  }
  function compareTables(dbA, dbB, names) {
    for (const n of names) {
      const a = findTable(dbA, n), b = findTable(dbB, n); if (!a || !b) return { ok: false, msg: 'Die Tabelle „' + n + '“ fehlt.' };
      if (a.rows.length !== b.rows.length) return { ok: false, table: n, msg: 'In der Tabelle „' + n + '“ stehen danach ' + a.rows.length + ' Zeilen, erwartet werden ' + b.rows.length + '.' };
      const x = a.rows.map(rowKey).sort(), y = b.rows.map(rowKey).sort(); let diff = 0; for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) diff++;
      if (diff) return { ok: false, table: n, msg: 'Die Tabelle „' + n + '“ hat nach deinen Anweisungen ' + diff + ' Zeile' + (diff === 1 ? '' : 'n') + ' mit anderem Inhalt als erwartet. Hast du die Bedingung (WHERE) richtig gesetzt?' };
    }
    return { ok: true };
  }
  const tableNames = db => Object.keys(db.tables);
  const API = { SqlError, exec, run, cloneDb, findTable, compareResults, compareTables, tableNames, parseScript, tokenize, fmtVal, parseDe, hashStr, rng, shuffle, keyOf };
  root.SQL_CORE = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
