'use strict';
/* Tonfunk DigiLab: Prozessor-Modus „8085“ (8 Bit). Ergänzung zur Mini-CPU TF-4 (cpu4.js bleibt unverändert).
   Ein Ausschnitt des Intel-8085-Befehlssatzes (Assembler mit echten Maschinencodes), Register A, B, C, D, E, H, L, Flags S, Z, AC, P, CY,
   Speicher (64 KB), Stapel (SP), Ein- und Ausgabe über Portadressen. Die Baugruppen (Schalter = Eingabe, LED-Reihe = Ausgabe) haben die Adresse FBH.
   Baustein im Schaltplan: IC „Mini-CPU 8085“ mit 24 Pins (Eintrag cpu85 in simics.js):
   1 CLK, 2 RST, 3-10 IN0..IN7 (Eingabebaugruppe FBH), 11 NC, 12 GND, 13-20 OUT0..OUT7 (Ausgabebaugruppe FBH), 21 HLT, 22 CF, 23 ZF, 24 VCC.
   Bei jeder steigenden Taktflanke wird genau ein Befehl ausgeführt (Taktzyklen und Zeiten des echten 8085 werden nicht nachgebildet). */
(function (root) {
  const REG = ['B', 'C', 'D', 'E', 'H', 'L', 'M', 'A'], RP = ['B', 'D', 'H', 'SP'], RPP = ['B', 'D', 'H', 'PSW'], CC = ['NZ', 'Z', 'NC', 'C', 'PO', 'PE', 'P', 'M'];
  const PORT = 0xFB;
  /* ---------- Befehlstabelle: Mnemonik, Grundcode, Operandenform ----------
     rr = MOV r,r   ri = Register und 8-Bit-Zahl   r = Register in Bit 5-3   r0 = Register in Bit 2-0   p = Registerpaar (B D H SP)
     q = Registerpaar für PUSH/POP (B D H PSW)   pi = Registerpaar und 16-Bit-Zahl   a = 16-Bit-Adresse   i = 8-Bit-Zahl   o = Portadresse   '' = ohne */
  const MNEM = { NOP: [0x00, ''], HLT: [0x76, ''], MOV: [0x40, 'rr'], MVI: [0x06, 'ri'], INR: [0x04, 'r'], DCR: [0x05, 'r'], LXI: [0x01, 'pi'], INX: [0x03, 'p'], DCX: [0x0B, 'p'],
    LDA: [0x3A, 'a'], STA: [0x32, 'a'], ADD: [0x80, 'r0'], ADC: [0x88, 'r0'], SUB: [0x90, 'r0'], SBB: [0x98, 'r0'], ANA: [0xA0, 'r0'], XRA: [0xA8, 'r0'], ORA: [0xB0, 'r0'], CMP: [0xB8, 'r0'],
    ADI: [0xC6, 'i'], ACI: [0xCE, 'i'], SUI: [0xD6, 'i'], SBI: [0xDE, 'i'], ANI: [0xE6, 'i'], XRI: [0xEE, 'i'], ORI: [0xF6, 'i'], CPI: [0xFE, 'i'],
    RLC: [0x07, ''], RRC: [0x0F, ''], RAL: [0x17, ''], RAR: [0x1F, ''], CMA: [0x2F, ''], STC: [0x37, ''], CMC: [0x3F, ''],
    JMP: [0xC3, 'a'], CALL: [0xCD, 'a'], RET: [0xC9, ''], PUSH: [0xC5, 'q'], POP: [0xC1, 'q'], IN: [0xDB, 'o'], OUT: [0xD3, 'o'] };
  CC.forEach((c, i) => { MNEM['J' + c] = [0xC2 | i << 3, 'a']; MNEM['C' + c] = [0xC4 | i << 3, 'a']; MNEM['R' + c] = [0xC0 | i << 3, '']; });
  const LEN = { '': 1, rr: 1, r: 1, r0: 1, p: 1, q: 1, ri: 2, i: 2, o: 2, pi: 3, a: 3 };
  const BYTE = new Array(256).fill(null);          // Dekodiertabelle: Code -> { mn, fmt, d, s, p }
  (function () {
    const put = (code, o) => { if (code >= 0 && code < 256 && !BYTE[code]) BYTE[code] = o; };
    Object.keys(MNEM).forEach(mn => {
      const [base, fmt] = MNEM[mn];
      if (fmt === 'rr') { for (let d = 0; d < 8; d++) for (let s = 0; s < 8; s++) if (!(d === 6 && s === 6)) put(base | d << 3 | s, { mn, fmt, d, s }); }
      else if (fmt === 'ri' || fmt === 'r') { for (let r = 0; r < 8; r++) put(base | r << 3, { mn, fmt, d: r }); }
      else if (fmt === 'r0') { for (let r = 0; r < 8; r++) put(base | r, { mn, fmt, s: r }); }
      else if (fmt === 'p' || fmt === 'q' || fmt === 'pi') { for (let p = 0; p < 4; p++) put(base | p << 4, { mn, fmt, p }); }
      else put(base, { mn, fmt });
    });
  })();
  const ALU = ['ADD', 'ADC', 'SUB', 'SBB', 'ANA', 'XRA', 'ORA', 'CMP'], ALUI = ['ADI', 'ACI', 'SUI', 'SBI', 'ANI', 'XRI', 'ORI', 'CPI'];
  const hx = (v, n) => (v >>> 0).toString(16).toUpperCase().padStart(n, '0');
  const hH = (v, n) => { const s = hx(v, n); return (/^[A-F]/.test(s) ? '0' : '') + s + 'H'; };

  /* Befehlsübersicht für die Hilfe: Schreibweise, Wirkung, betroffene Flags */
  const DOC = [
    ['MOV r1,r2', 'r1 = r2 (r = A B C D E H L oder M: der Speicher, auf den HL zeigt)', 'keine'],
    ['MVI r,n', 'r = 8-Bit-Zahl n', 'keine'],
    ['LXI rp,nn', 'Registerpaar (B = BC, D = DE, H = HL, SP) = 16-Bit-Zahl', 'keine'],
    ['LDA adr', 'A = Speicherstelle adr', 'keine'], ['STA adr', 'Speicherstelle adr = A', 'keine'],
    ['INX rp / DCX rp', 'Registerpaar um 1 erhöhen / verringern', 'keine'],
    ['ADD r / ADI n', 'A = A + r bzw. A + n', 'S Z AC P CY'], ['ADC r / ACI n', 'A = A + r + CY (Übertrag mitrechnen)', 'S Z AC P CY'],
    ['SUB r / SUI n', 'A = A − r bzw. A − n (CY = 1: es musste geborgt werden)', 'S Z AC P CY'], ['SBB r / SBI n', 'A = A − r − CY', 'S Z AC P CY'],
    ['INR r / DCR r', 'r um 1 erhöhen / verringern (CY bleibt unverändert!)', 'S Z AC P'],
    ['ANA r / ANI n', 'A = A UND r bzw. n (CY = 0)', 'S Z AC P CY'], ['ORA r / ORI n', 'A = A ODER r bzw. n (CY = 0)', 'S Z AC P CY'], ['XRA r / XRI n', 'A = A EXOR r bzw. n (CY = 0)', 'S Z AC P CY'],
    ['CMP r / CPI n', 'vergleicht A mit r bzw. n (rechnet A − r, A bleibt): Z = 1 gleich, CY = 1 A kleiner', 'S Z AC P CY'],
    ['CMA', 'A = A invertiert (Einerkomplement)', 'keine'], ['STC / CMC', 'CY = 1 setzen / CY umkehren', 'CY'],
    ['RLC / RRC', 'A kreisförmig um 1 Bit nach links / rechts, das herausgeschobene Bit geht auch nach CY', 'CY'],
    ['RAL / RAR', 'A um 1 Bit nach links / rechts durch CY (CY ist das 9. Bit)', 'CY'],
    ['JMP adr', 'springt immer zur Adresse', 'keine'], ['JZ / JNZ adr', 'springt bei Z = 1 / Z = 0', 'keine'], ['JC / JNC adr', 'springt bei CY = 1 / CY = 0', 'keine'],
    ['JP / JM adr', 'springt bei S = 0 (positiv) / S = 1 (negativ)', 'keine'], ['JPE / JPO adr', 'springt bei P = 1 (gerade Parität) / P = 0', 'keine'],
    ['CALL adr', 'Unterprogramm: legt die Rücksprungadresse auf den Stapel und springt', 'keine'], ['RET', 'holt die Rücksprungadresse vom Stapel und springt dorthin', 'keine'],
    ['CZ CNZ CC CNC / RZ RNZ RC RNC', 'CALL bzw. RET nur, wenn die Bedingung erfüllt ist', 'keine'],
    ['PUSH rp', 'legt das Registerpaar (B, D, H oder PSW = A und Flags) auf den Stapel (SP wird um 2 kleiner)', 'keine'], ['POP rp', 'holt das Registerpaar vom Stapel (SP wird um 2 größer)', 'bei POP PSW: alle'],
    ['IN port', 'A = Eingabebaugruppe an der Portadresse (hier: Schalter an FBH)', 'keine'], ['OUT port', 'Ausgabebaugruppe an der Portadresse = A (hier: LED-Reihe an FBH)', 'keine'],
    ['NOP / HLT', 'tut nichts / hält den Prozessor an', 'keine'],
    ['ORG adr · DB n,n · name EQU n', 'Anweisungen für den Assembler: Startadresse, Daten ablegen, Namen für eine Zahl', '']
  ];
  const PROGRAMS = {
    'Eingabe lesen und anzeigen': '        ORG 2000H\nstart:  IN 0FBH       ; Schalter (Eingabebaugruppe FBH) in den Akku\n        OUT 0FBH      ; Akku auf die LED-Reihe (Ausgabebaugruppe FBH)\n        JMP start\n',
    'Maske: nur die oberen vier Schalter': '        ORG 2000H\nstart:  IN 0FBH\n        ANI 0F0H      ; Maske: untere vier Bit löschen\n        OUT 0FBH\n        JMP start\n',
    'Dualzähler mit Wartezeit': '        ORG 2000H\n        MVI C,00H     ; C ist der Zähler\nzaehl:  MOV A,C\n        OUT 0FBH\n        INR C\n        MVI B,04H     ; Wartezeit: B herunterzählen\nwarte:  DCR B\n        JNZ warte\n        JMP zaehl\n',
    'Zähler erst nach Schalter 7': '        ORG 2000H\nwarte:  IN 0FBH\n        ANI 80H       ; nur Schalter 7 (Bit 7) behalten\n        JZ warte      ; Z = 1: Schalter offen, weiter warten\n        MVI C,00H\nzaehl:  MOV A,C\n        OUT 0FBH\n        INR C\n        JMP zaehl\n',
    'Stapel: PUSH und POP': '        ORG 2000H\n        LXI SP,20FFH  ; Stapel einrichten\n        MVI B,11H\n        MVI C,22H\n        PUSH B        ; BC auf den Stapel\n        MVI B,00H\n        MVI C,00H\n        POP B         ; BC zurückholen\n        MOV A,B\n        OUT 0FBH\n        HLT\n',
    'Unterprogramm: CALL und RET': '        ORG 2000H\n        LXI SP,20FFH\nstart:  MVI A,55H\n        CALL zeige\n        MVI A,0AAH\n        CALL zeige\n        JMP start\nzeige:  OUT 0FBH      ; Unterprogramm: Wert anzeigen\n        RET\n',
    'Addition mit Übertrag (Carry)': '        ORG 2000H\nstart:  IN 0FBH\n        ADI 80H       ; 128 dazuzählen\n        JC ueber      ; CY = 1: Summe passt nicht in 8 Bit\n        OUT 0FBH\n        JMP start\nueber:  MVI A,0FFH    ; Warnung: alle LEDs an\n        OUT 0FBH\n        JMP start\n'
  };

  /* ---------- Assembler ---------- */
  const RESERVED = new Set(REG.concat(['SP', 'PSW', 'ORG', 'DB', 'EQU', 'END'], Object.keys(MNEM)));
  function numTok(t) {
    t = String(t).trim();
    if (/^0x[0-9a-f]+$/i.test(t)) return parseInt(t.slice(2), 16);
    if (/^0b[01]+$/i.test(t)) return parseInt(t.slice(2), 2);
    if (/^[0-9][0-9a-f]*h$/i.test(t) || /^[a-f][0-9a-f]*h$/i.test(t)) return parseInt(t.slice(0, -1), 16);
    if (/^[01]+b$/i.test(t)) return parseInt(t.slice(0, -1), 2);
    if (/^\d+$/.test(t)) return parseInt(t, 10);
    const m = t.match(/^'(.)'$/); if (m) return m[1].charCodeAt(0) & 255;
    return NaN;
  }
  function assemble(text) {
    const lines = String(text || '').split('\n'), labels = {}, items = [], errors = [], err = (line, msg) => errors.push({ line, msg });
    let addr = 0;
    /* Durchgang 1: Zeilen zerlegen, Adressen und Marken bestimmen */
    lines.forEach((raw, i) => {
      const ln = i + 1; let s = raw.replace(/;.*$/, '').trim(); if (!s) return;
      let m = s.match(/^([A-Za-z_][\w]*)\s*:\s*(.*)$/);
      while (m) {
        const nm = m[1].toLowerCase();
        if (RESERVED.has(m[1].toUpperCase())) err(ln, 'Der Name „' + m[1] + '“ ist ein Befehl oder Register und kann keine Marke sein');
        else if (labels[nm] != null) err(ln, 'Marke „' + m[1] + '“ gibt es schon'); else labels[nm] = { idx: items.length, line: ln };
        s = m[2].trim(); m = s.match(/^([A-Za-z_][\w]*)\s*:\s*(.*)$/);
      }
      if (!s) return;
      const eq = s.match(/^([A-Za-z_]\w*)\s+EQU\s+(.+)$/i);
      if (eq) { const nm = eq[1].toLowerCase(); if (RESERVED.has(eq[1].toUpperCase())) err(ln, 'Der Name „' + eq[1] + '“ ist ein Befehl oder Register'); else if (labels[nm] != null) err(ln, 'Name „' + eq[1] + '“ gibt es schon'); else labels[nm] = { expr: eq[2].trim(), line: ln }; return; }
      const sp = s.search(/\s/), op = (sp < 0 ? s : s.slice(0, sp)).toUpperCase(), rest = sp < 0 ? '' : s.slice(sp).trim();
      const args = rest ? rest.split(',').map(x => x.trim()) : [];
      if (op === 'ORG') { items.push({ line: ln, op, args, src: s, addr, size: 0, dir: true }); return; }
      if (op === 'END') return;
      if (op === 'DB') { items.push({ line: ln, op, args, src: s, addr, size: args.length, dir: true }); addr += args.length; return; }
      const d = MNEM[op];
      if (!d) { err(ln, 'Unbekannter Befehl „' + s.split(/\s+/)[0] + '“'); return; }
      items.push({ line: ln, op, args, src: s, addr, size: LEN[d[1]], fmt: d[1], base: d[0] }); addr += LEN[d[1]];
    });
    return pass2(items, labels, errors, err, lines);
  }
  function pass2(items, labels, errors, err, lines) {
    /* ORG-Zeilen setzen die Adressen neu: Durchgang 1 kennt sie noch nicht, deshalb hier die Adressen noch einmal vergeben */
    let a = 0; const resolved = {};
    const evalExpr = (str, line, lo, hi, what) => {
      let total = 0, rest = String(str).trim(); if (!rest) { err(line, what + ' fehlt'); return null; }
      const re = /^\s*([+-]?)\s*('.'|[^+\-\s]+)\s*/; 
      while (rest) {
        const m = rest.match(re); if (!m) { err(line, 'Ausdruck nicht lesbar: ' + str); return null; }
        rest = rest.slice(m[0].length); const sgn = m[1] === '-' ? -1 : 1, t = m[2]; let v;
        const sy = lookup(t.toLowerCase(), line);
        if (sy !== undefined) { if (sy === null) return null; v = sy; } else { v = numTok(t); if (isNaN(v)) { err(line, /^[0-9a-f]+$/i.test(t) && /[a-f]/i.test(t) ? 'Zahl „' + t + '“ nicht lesbar: Hexadezimalzahlen brauchen ein H am Ende (zum Beispiel ' + (/^[a-f]/i.test(t) ? '0' : '') + t.toUpperCase() + 'H)' : 'Unbekannte Marke oder Zahl „' + t + '“'); return null; } }
        total += sgn * v; if (rest && !/^[+-]/.test(rest)) { err(line, 'Ausdruck nicht lesbar: ' + str); return null; }
      }
      if (total < lo || total > hi) { err(line, what + ' liegt außerhalb des erlaubten Bereichs (' + lo + ' bis ' + hi + '): ' + str); return null; }
      return total;
    };
    const busy = {};
    const lookup = (k, line) => {
      if (!(k in labels)) return undefined; const L = labels[k];
      if (L.expr == null) return L.v; if (k in resolved) return resolved[k]; if (busy[k]) { err(line, 'Der Name „' + k + '“ verweist auf sich selbst'); return null; }
      busy[k] = 1; const v = evalExpr(L.expr, L.line, 0, 65535, 'Wert'); busy[k] = 0; resolved[k] = v == null ? null : v; return resolved[k];
    };
    /* Adressen vergeben (ORG setzt die Adresse neu); eine Marke bekommt die Adresse des Befehls oder der Daten, die hinter ihr stehen */
    items.forEach(it => { it.addr = a; if (it.op === 'ORG') { const v = it.args.length === 1 ? numTok(it.args[0]) : NaN; if (isNaN(v) || v < 0 || v > 65535) err(it.line, 'ORG braucht eine Adresse (zum Beispiel ORG 2000H)'); else a = v; } else a += it.size; });
    Object.keys(labels).forEach(k => { const L = labels[k]; if (L.expr == null) L.v = L.idx < items.length ? items[L.idx].addr : a; });
    const image = new Uint8Array(65536), occ = new Uint8Array(65536), out = []; let start = null;
    const emit = (it, bytes) => { it.bytes = bytes; bytes.forEach((b, j) => { const ad = (it.addr + j) & 65535; if (occ[ad] && !it.ovl) { err(it.line, 'Die Adresse ' + hx(ad, 4) + 'H ist schon belegt (ORG überlappt?)'); it.ovl = 1; } image[ad] = b & 255; occ[ad] = 1; }); if (bytes.length && start == null) start = it.addr; out.push(it); };
    items.forEach(it => {
      const ln = it.line, A = it.args;
      if (it.op === 'ORG') return;
      if (it.op === 'DB') { const b = A.map(x => evalExpr(x, ln, -128, 255, 'Datenbyte')); if (A.length && b.every(v => v != null)) emit(it, b.map(v => v & 255)); else if (!A.length) err(ln, 'DB braucht mindestens eine Zahl'); return; }
      const f = it.fmt, base = it.base, op = it.op;
      const reg = (x, set, what) => { const k = set.indexOf(String(x == null ? '' : x).toUpperCase()); if (k < 0) { err(ln, op + ': ' + what + ' erwartet (' + set.join(', ') + '), nicht „' + (x == null ? '' : x) + '“'); return -1; } return k; };
      const need = n => { if (A.length !== n) { err(ln, op + (n ? ' braucht ' + (n === 1 ? 'einen Operanden' : n + ' Operanden, durch Komma getrennt') : ' braucht keinen Operanden')); return false; } return true; };
      if (f === '') { if (need(0)) emit(it, [base]); return; }
      if (f === 'rr') { if (!need(2)) return; const d = reg(A[0], REG, 'Register'), s = reg(A[1], REG, 'Register'); if (d < 0 || s < 0) return; if (d === 6 && s === 6) { err(ln, 'MOV M,M gibt es nicht (der Code gehört zu HLT)'); return; } emit(it, [base | d << 3 | s]); return; }
      if (f === 'r' || f === 'r0') { if (!need(1)) return; const r = reg(A[0], REG, 'Register'); if (r < 0) return; emit(it, [f === 'r' ? base | r << 3 : base | r]); return; }
      if (f === 'ri') { if (!need(2)) return; const r = reg(A[0], REG, 'Register'), v = evalExpr(A[1], ln, -128, 255, 'Zahl'); if (r < 0 || v == null) return; emit(it, [base | r << 3, v & 255]); return; }
      if (f === 'p' || f === 'q') { if (!need(1)) return; const p = reg(A[0], f === 'p' ? RP : RPP, 'Registerpaar'); if (p < 0) return; emit(it, [base | p << 4]); return; }
      if (f === 'pi') { if (!need(2)) return; const p = reg(A[0], RP, 'Registerpaar'), v = evalExpr(A[1], ln, -32768, 65535, 'Zahl'); if (p < 0 || v == null) return; emit(it, [base | p << 4, v & 255, (v >> 8) & 255]); return; }
      if (f === 'a') { if (!need(1)) return; const v = evalExpr(A[0], ln, 0, 65535, 'Adresse'); if (v == null) return; emit(it, [base, v & 255, v >> 8]); return; }
      if (f === 'i') { if (!need(1)) return; const v = evalExpr(A[0], ln, -128, 255, 'Zahl'); if (v == null) return; emit(it, [base, v & 255]); return; }
      if (f === 'o') { if (!need(1)) return; const v = evalExpr(A[0], ln, 0, 255, 'Portadresse'); if (v == null) return; emit(it, [base, v]); }
    });
    const labs = {}; Object.keys(labels).forEach(k => { const v = lookup(k, labels[k].line); if (v != null) labs[k] = v; });
    errors.sort((x, y) => x.line - y.line);
    let size = 0; for (let i = 0; i < 65536; i++) size += occ[i]; out.sort((x, y) => x.addr - y.addr || x.line - y.line);
    const at = {}; out.forEach(x => { if (!x.dir) at[x.addr] = x.line; });
    return { at, prog: out.filter(x => !x.dir), items: out, labels: labs, errors, image, occ, start: start == null ? 0 : start, size };
  }
  let cacheT = null, cacheP = null;
  const prog = t => { t = String(t || ''); if (t !== cacheT || !cacheP) { cacheT = t; cacheP = assemble(t); } return cacheP; };
  const program = () => prog((root.LabDigiAPI && root.LabDigiAPI.sch && root.LabDigiAPI.sch.code) || '');

  /* ---------- Zustand und Ausführung ---------- */
  function fresh(st, P) {
    P = P || program();
    st.r = [0, 0, 0, 0, 0, 0, 0, 0]; st.s = 0; st.z = 0; st.ac = 0; st.p = 0; st.c = 0; st.pc = P.start; st.sp = 0;
    st.mem = new Uint8Array(P.image); st.occ = P.occ; st.prog = P; st.out = 0; st.ports = {}; st.halt = 0; st.steps = 0; st.last = -1; st.err = ''; st.warn = '';
  }
  const parity = v => { let c = 0; for (let i = 0; i < 8; i++) c += (v >> i) & 1; return c % 2 === 0 ? 1 : 0; };
  const szp = (st, v) => { st.s = (v >> 7) & 1; st.z = v === 0 ? 1 : 0; st.p = parity(v); };
  const pair = (st, k) => k === 3 ? st.sp : (st.r[k * 2] << 8 | st.r[k * 2 + 1]);
  const setPair = (st, k, v) => { v &= 65535; if (k === 3) st.sp = v; else { st.r[k * 2] = v >> 8; st.r[k * 2 + 1] = v & 255; } };
  const flagByte = st => (st.s << 7 | st.z << 6 | st.ac << 4 | st.p << 2 | st.c);
  const getR = (st, k) => k === 6 ? st.mem[pair(st, 2)] : st.r[k];
  const setR = (st, k, v) => { if (k === 6) st.mem[pair(st, 2)] = v & 255; else st.r[k] = v & 255; };
  function alu(st, k, b) {
    const a = st.r[7]; let res;
    if (k === 0 || k === 1) { const ci = k === 1 ? st.c : 0, s = a + b + ci; st.c = s > 255 ? 1 : 0; st.ac = ((a & 15) + (b & 15) + ci) > 15 ? 1 : 0; res = s & 255; }
    else if (k === 2 || k === 3 || k === 7) { const bi = k === 3 ? st.c : 0, s = a - b - bi; st.c = s < 0 ? 1 : 0; st.ac = ((a & 15) + ((~b) & 15) + (1 - bi)) > 15 ? 1 : 0; res = s & 255; }
    else if (k === 4) { res = a & b; st.c = 0; st.ac = 1; }
    else if (k === 5) { res = a ^ b; st.c = 0; st.ac = 0; }
    else { res = a | b; st.c = 0; st.ac = 0; }
    szp(st, res); if (k !== 7) st.r[7] = res;
  }
  const push16 = (st, v) => { st.sp = (st.sp - 1) & 65535; st.mem[st.sp] = (v >> 8) & 255; st.sp = (st.sp - 1) & 65535; st.mem[st.sp] = v & 255; };
  const pop16 = st => { const lo = st.mem[st.sp]; st.sp = (st.sp + 1) & 65535; const hi = st.mem[st.sp]; st.sp = (st.sp + 1) & 65535; return hi << 8 | lo; };
  const cond = (st, c) => [!st.z, st.z, !st.c, st.c, !st.p, st.p, !st.s, st.s][c] ? true : false;
  function exec(e, P) {
    const st = e.st; P = P || program();
    if (st.prog !== P || !st.mem) fresh(st, P);
    if (st.halt) return;
    if (P.errors.length || !P.size) { st.halt = 1; return; }
    const pc = st.pc, m = st.mem;
    if (!st.occ[pc]) { st.halt = 1; st.err = 'Der Befehlszähler steht bei ' + hx(pc, 4) + 'H, dort ist kein Programm. Fehlt ein HLT oder ein Sprung am Programmende?'; return; }
    const ins = BYTE[m[pc]];
    if (!ins) { st.halt = 1; st.err = 'Der Code ' + hx(m[pc], 2) + 'H bei ' + hx(pc, 4) + 'H ist kein Befehl dieses Prozessor-Modus'; return; }
    const n1 = m[(pc + 1) & 65535], n2 = m[(pc + 2) & 65535], w = n2 << 8 | n1;
    let next = (pc + LEN[ins.fmt]) & 65535;
    st.last = P.at[pc] || -1; st.warn = '';
    const mn = ins.mn;
    switch (mn) {
      case 'NOP': break;
      case 'HLT': st.halt = 1; break;
      case 'MOV': setR(st, ins.d, getR(st, ins.s)); break;
      case 'MVI': setR(st, ins.d, n1); break;
      case 'LXI': setPair(st, ins.p, w); break;
      case 'LDA': st.r[7] = m[w]; break;
      case 'STA': m[w] = st.r[7]; break;
      case 'INX': setPair(st, ins.p, pair(st, ins.p) + 1); break;
      case 'DCX': setPair(st, ins.p, pair(st, ins.p) - 1); break;
      case 'INR': { const v = getR(st, ins.d), r = (v + 1) & 255; st.ac = ((v & 15) + 1) > 15 ? 1 : 0; szp(st, r); setR(st, ins.d, r); break; }
      case 'DCR': { const v = getR(st, ins.d), r = (v - 1) & 255; st.ac = (v & 15) !== 0 ? 1 : 0; szp(st, r); setR(st, ins.d, r); break; }
      case 'RLC': { const c = (st.r[7] >> 7) & 1; st.r[7] = ((st.r[7] << 1) | c) & 255; st.c = c; break; }
      case 'RRC': { const c = st.r[7] & 1; st.r[7] = (st.r[7] >> 1) | (c << 7); st.c = c; break; }
      case 'RAL': { const c = (st.r[7] >> 7) & 1; st.r[7] = ((st.r[7] << 1) | st.c) & 255; st.c = c; break; }
      case 'RAR': { const c = st.r[7] & 1; st.r[7] = (st.r[7] >> 1) | (st.c << 7); st.c = c; break; }
      case 'CMA': st.r[7] ^= 255; break;
      case 'STC': st.c = 1; break;
      case 'CMC': st.c = st.c ? 0 : 1; break;
      case 'JMP': next = w; break;
      case 'CALL': push16(st, next); next = w; break;
      case 'RET': next = pop16(st); break;
      case 'PUSH': push16(st, ins.p === 3 ? (st.r[7] << 8 | flagByte(st)) : pair(st, ins.p)); break;
      case 'POP': { const v = pop16(st); if (ins.p === 3) { const f = v & 255; st.r[7] = v >> 8; st.s = (f >> 7) & 1; st.z = (f >> 6) & 1; st.ac = (f >> 4) & 1; st.p = (f >> 2) & 1; st.c = f & 1; } else setPair(st, ins.p, v); break; }
      case 'IN': if (n1 === PORT) st.r[7] = (st.inv || 0) & 255; else { st.r[7] = 255; st.warn = 'IN ' + hH(n1, 2) + ': an dieser Adresse hängt keine Eingabebaugruppe (die Schalter haben FBH)'; } break;
      case 'OUT': st.ports[n1] = st.r[7]; if (n1 === PORT) st.out = st.r[7]; else st.warn = 'OUT ' + hH(n1, 2) + ': an dieser Adresse hängt keine Ausgabebaugruppe (die LEDs haben FBH)'; break;
      default: {
        if (ALU.includes(mn)) alu(st, ALU.indexOf(mn), getR(st, ins.s));
        else if (ALUI.includes(mn)) alu(st, ALUI.indexOf(mn), n1);
        else { const c = CC.indexOf(mn.slice(1)); const k = mn[0]; if (c >= 0 && (k === 'J' || k === 'C' || k === 'R')) { if (cond(st, c)) { if (k === 'J') next = w; else if (k === 'C') { push16(st, next); next = w; } else next = pop16(st); } } }
      }
    }
    if (!st.halt) st.pc = next; st.steps++;
  }
  function disasm(mem, pc) {
    const ins = BYTE[mem[pc & 65535]]; if (!ins) return { text: 'DB ' + hH(mem[pc & 65535], 2), len: 1 };
    const n1 = mem[(pc + 1) & 65535], w = mem[(pc + 2) & 65535] << 8 | n1; let t = ins.mn;
    switch (ins.fmt) {
      case 'rr': t += ' ' + REG[ins.d] + ',' + REG[ins.s]; break; case 'ri': t += ' ' + REG[ins.d] + ',' + hH(n1, 2); break;
      case 'r': t += ' ' + REG[ins.d]; break; case 'r0': t += ' ' + REG[ins.s]; break;
      case 'p': t += ' ' + RP[ins.p]; break; case 'q': t += ' ' + RPP[ins.p]; break; case 'pi': t += ' ' + RP[ins.p] + ',' + hH(w, 4); break;
      case 'a': t += ' ' + hH(w, 4); break; case 'i': case 'o': t += ' ' + hH(n1, 2); break;
    }
    return { text: t, len: LEN[ins.fmt] };
  }
  /* Programm ohne Browser laufen lassen (Tests): Rückgabe { st, outs } mit dem LED-Wert nach jedem Befehl */
  function run(code, n, inv) { const P = prog(code), st = {}; fresh(st, P); st.inv = inv || 0; const outs = []; for (let i = 0; i < n && !st.halt; i++) { exec({ st }, P); outs.push(st.out); } return { st, outs, P }; }
  const regs = st => ({ A: st.r[7], B: st.r[0], C: st.r[1], D: st.r[2], E: st.r[3], H: st.r[4], L: st.r[5], SP: st.sp, PC: st.pc, S: st.s, Z: st.z, AC: st.ac, P: st.p, CY: st.c });

  function update(e, vp, lv, O, rise) {
    const st = e.st; if (st.pc == null || !st.mem) fresh(st);
    st.n = (st.n || 0) + 1;
    const clk = lv(e, vp, 1), rst = lv(e, vp, 2); let inv = 0; for (let i = 0; i < 8; i++) inv |= lv(e, vp, 3 + i) << i; st.inv = inv;
    const edge = rise(e, 'clk', clk) && st.n > 30;
    if (rst) fresh(st); else if (edge && !st.halt) exec(e);
    for (let i = 0; i < 8; i++) O(13 + i, (st.out >> i) & 1, { rh: 40, rl: 40 });
    O(21, st.halt ? 1 : 0, { rh: 40, rl: 40 }); O(22, st.c ? 1 : 0, { rh: 40, rl: 40 }); O(23, st.z ? 1 : 0, { rh: 40, rl: 40 });
  }
  const cpuElem = api => (api.circ && api.circ.elems.find(e => e.type === 'IC' && e.key === 'cpu85')) || null;

  /* ---------- Editor: Programm, Register in Hex und Binär, Schalter und LEDs, Einzelschritt und Lauf ---------- */
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let timer = 0, run0 = 0;
  function closeEditor() { clearInterval(timer); clearInterval(run0); timer = 0; run0 = 0; const p = document.getElementById('cpu85Panel'); if (p) p.remove(); }
  function openEditor(api) {
    if (document.getElementById('cpu85Panel')) { closeEditor(); return; }
    const w = document.createElement('div'); w.id = 'cpu85Panel';
    w.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:70;width:min(560px,calc(100vw - 16px));max-height:88vh;overflow:auto;background:#1f262e;color:#e8eaed;border:1px solid #38424d;border-radius:12px;padding:10px 12px;font:13px/1.4 system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.55)';
    w.innerHTML = `<div style="display:flex;align-items:center;gap:8px"><b style="font-size:15px;flex:1">Prozessor 8085: Programm</b><select id="c8S" style="background:#10151a;color:#e8eaed;border:1px solid #38424d;border-radius:6px;padding:4px;max-width:200px"><option>Beispiel laden …</option>${Object.keys(PROGRAMS).map(k => `<option>${esc(k)}</option>`).join('')}</select><button id="c8X" style="background:none;border:0;color:#e8eaed;font-size:20px;cursor:pointer" aria-label="Schließen">✕</button></div>
      <textarea id="c8T" spellcheck="false" style="width:100%;box-sizing:border-box;height:150px;margin-top:6px;background:#10151a;color:#cfe3ff;border:1px solid #38424d;border-radius:8px;padding:8px;font:13px/1.45 ui-monospace,Consolas,monospace;resize:vertical"></textarea>
      <div id="c8E" style="min-height:18px;color:#ffb020;margin:4px 0"></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="cb pri" id="c8L">Übernehmen und starten</button><button class="cb" id="c8P">⏭ Ein Schritt</button><button class="cb" id="c8G">▶ Lauf</button><button class="cb" id="c8R">↺ Reset</button><button class="cb" id="c8H">Befehle</button></div>
      <div id="c8Z" class="dv" style="margin-top:6px"></div><div id="c8V" style="margin-top:8px;font-family:ui-monospace,Consolas,monospace"></div>
      <div style="margin-top:6px;font-size:12px;color:#9aa6b2">Speicher ab <input id="c8A" value="2000" size="5" maxlength="4" style="background:#10151a;color:#e8eaed;border:1px solid #38424d;border-radius:6px;padding:2px 4px;font:12px monospace"> H <span id="c8M" style="font-family:ui-monospace,Consolas,monospace;color:#e8eaed"></span></div>
      <div id="c8C" style="margin-top:8px;max-height:130px;overflow:auto;font:12px ui-monospace,Consolas,monospace"></div><div id="c8D" style="display:none;margin-top:8px;max-height:180px;overflow:auto;font-size:12px"></div>
      <style>#cpu85Panel .cb{background:#2c343e;color:#e8eaed;border:1px solid #38424d;border-radius:8px;padding:7px 11px;font-size:13px;cursor:pointer}#cpu85Panel .cb.pri{background:#ff9d00;color:#1b1b1b;border-color:#ff9d00;font-weight:700}#cpu85Panel .sw{display:inline-block;width:26px;text-align:center;margin:1px;padding:4px 0;border-radius:6px;border:1px solid #38424d;background:#10151a;cursor:pointer;user-select:none}#cpu85Panel .sw.on{background:#2b6e3a;border-color:#5ee27d}#cpu85Panel .led{display:inline-block;width:18px;height:18px;margin:3px 5px;border-radius:50%;background:#2a1a1a;border:1px solid #38424d;vertical-align:middle}#cpu85Panel .led.on{background:#ff4040;box-shadow:0 0 8px #ff4040}</style>`;
    document.body.appendChild(w);
    const q = s => w.querySelector(s), ta = q('#c8T'); ta.value = api.sch.code || PROGRAMS['Eingabe lesen und anzeigen'];
    const check = () => { const P = prog(ta.value); q('#c8E').innerHTML = P.errors.length ? P.errors.slice(0, 3).map(x => (x.line ? 'Zeile ' + x.line + ': ' : '') + esc(x.msg)).join('<br>') : (P.size ? '<span style="color:#5ee27d">Programm in Ordnung (' + P.size + ' Byte ab ' + hx(P.start, 4) + 'H)</span>' : '<span style="color:#9aa6b2">Noch kein Befehl</span>'); return P; };
    ta.addEventListener('input', check); check();
    const local = { inv: 0 };
    const cur = () => { const e = cpuElem(api); return e && e.st && e.st.mem ? { st: e.st, live: true } : { st: local, live: false }; };
    const bin = v => v.toString(2).padStart(8, '0').replace(/(....)(....)/, '$1 $2');
    const show = () => {
      const { st, live } = cur(), P = live ? program() : prog(ta.value); if (!st.mem) fresh(st, P);
      const nx = st.occ && st.occ[st.pc] ? disasm(st.mem, st.pc) : { text: '—' };
      const cell = (n, v) => `<span style="display:inline-block;margin:2px 10px 2px 0">${n} <b style="color:#6dff7a">${hx(v, 2)}H</b> <span style="color:#8fd3ff">${bin(v)}</span> <span style="color:#9aa6b2">(${v})</span></span>`;
      const fl = [['S', st.s], ['Z', st.z], ['AC', st.ac], ['P', st.p], ['CY', st.c]].map(([n, v]) => `<span style="margin-right:10px">${n} <b style="color:${v ? '#6dff7a' : '#9aa6b2'}">${v}</b></span>`).join('');
      const sw = []; for (let i = 7; i >= 0; i--) sw.push(`<span class="sw${(st.inv >> i) & 1 ? ' on' : ''}" data-b="${i}" title="Schalter ${i}">${i}</span>`);
      const led = []; for (let i = 7; i >= 0; i--) led.push(`<span class="led${(st.out >> i) & 1 ? ' on' : ''}" title="LED ${i}"></span>`);
      const stk = []; for (let k = 0; k < 6; k++) stk.push(hx(st.mem[(st.sp + k) & 65535], 2));
      if (root.DIGI_VIZ) { const z = q('#c8Z'), rg = regs(st); if (z) z.innerHTML = root.DIGI_VIZ.cpu85Svg(rg, local.pv); local.pv = rg; }
      q('#c8V').innerHTML = cell('A', st.r[7]) + '<br>' + cell('B', st.r[0]) + cell('C', st.r[1]) + '<br>' + cell('D', st.r[2]) + cell('E', st.r[3]) + '<br>' + cell('H', st.r[4]) + cell('L', st.r[5]) + '<br>' +
        `<span style="margin-right:12px">PC <b style="color:#6dff7a">${hx(st.pc, 4)}H</b></span><span style="margin-right:12px">SP <b style="color:#6dff7a">${hx(st.sp, 4)}H</b></span><span style="color:#9aa6b2">Stapel ab SP: ${stk.join(' ')}</span><br>` + fl +
        `<br><span style="color:#9aa6b2">Nächster Befehl:</span> <b>${esc(nx.text)}</b>${st.halt ? ' <b style="color:#ffb020">· angehalten</b>' : ''}` +
        `<div style="margin-top:6px"><span style="color:#9aa6b2">Eingabe FBH (Schalter 7 … 0)${live ? ' am Schaltplan' : ' zum Antippen'}:</span><br>${sw.join('')}</div><div><span style="color:#9aa6b2">Ausgabe FBH (LEDs 7 … 0):</span><br>${led.join('')}</div>` +
        (st.err ? `<div style="color:#ff7a7a;margin-top:4px">${esc(st.err)}</div>` : '') + (st.warn ? `<div style="color:#ffb020;margin-top:4px">${esc(st.warn)}</div>` : '');
      const a0 = parseInt(q('#c8A').value, 16); if (!isNaN(a0)) { const r = []; for (let k = 0; k < 8; k++) r.push(hx(st.mem[(a0 + k) & 65535], 2)); q('#c8M').textContent = r.join(' '); } else q('#c8M').textContent = '';
      q('#c8C').innerHTML = P.items.length ? '<table style="border-collapse:collapse">' + P.items.map(it => { const on = st.occ && it.addr === st.pc && !it.dir; return `<tr style="${on ? 'background:#2c3b2c' : ''}"><td style="padding:1px 6px 1px 0;color:#9aa6b2">${on ? '►' : ''}${hx(it.addr, 4)}</td><td style="padding:1px 10px 1px 0;color:#8fd3ff">${(it.bytes || []).map(b => hx(b, 2)).join(' ')}</td><td>${esc(it.src)}</td></tr>`; }).join('') + '</table>' : '';
    };
    timer = setInterval(show, 150); show();
    q('#c8V').addEventListener('pointerdown', ev => { const t = ev.target.closest && ev.target.closest('.sw'); if (!t) return; const { st, live } = cur(); if (live) { api.toast && api.toast('Die Schalter bedienst du im Schaltplan'); return; } st.inv ^= 1 << (+t.dataset.b); show(); });
    q('#c8X').onclick = closeEditor; q('#c8A').addEventListener('input', show);
    const stepOnce = () => {
      const { st, live } = cur();
      if (live) { if (api.sch.code !== ta.value) { const P = check(); if (!P.errors.length) api.sch.code = ta.value; } exec({ st }); }
      else { const P = check(); if (P.errors.length) return; if (st.prog !== P) fresh(st, P); exec({ st }, P); }
      show();
    };
    q('#c8L').onclick = () => { const P = check(); if (P.errors.length) { api.toast('Das Programm hat noch Fehler'); return; } api.sch.code = ta.value; api.commit(true, true); api.rebuild(); api.refreshUI(); api.draw(); const c = cur(); if (!c.live) fresh(c.st, P); api.toast('Programm übernommen'); };
    q('#c8P').onclick = stepOnce;
    q('#c8G').onclick = () => { if (run0) { clearInterval(run0); run0 = 0; q('#c8G').textContent = '▶ Lauf'; } else { run0 = setInterval(stepOnce, 120); q('#c8G').textContent = '■ Stopp'; } };
    q('#c8R').onclick = () => { const c = cur(), P = c.live ? program() : check(); fresh(c.st, P); show(); };
    q('#c8S').onchange = ev => { const t = PROGRAMS[ev.target.value]; if (t) { ta.value = t; check(); } ev.target.selectedIndex = 0; };
    q('#c8H').onclick = () => { const d = q('#c8D'); d.style.display = d.style.display === 'none' ? 'block' : 'none'; d.innerHTML = '<div style="color:#9aa6b2;margin-bottom:4px">Zahlen: 10 ist dezimal, 10H hexadezimal (mit 0 davor, wenn die Zahl mit einem Buchstaben beginnt: 0FBH), 10101010B binär. Kommentar nach „;“.</div><table style="width:100%;border-collapse:collapse">' + DOC.map(r => `<tr><td style="padding:2px 8px 2px 0;font-family:monospace;color:#6dff7a;white-space:nowrap;vertical-align:top">${esc(r[0])}</td><td>${esc(r[1])}</td><td style="color:#9aa6b2;padding-left:6px;white-space:nowrap;vertical-align:top">${esc(r[2])}</td></tr>`).join('') + '</table>'; };
  }
  root.CPU85 = { assemble, prog, program, exec, fresh, disasm, run, regs, update, openEditor, closeEditor, cpuElem, PROGRAMS, MNEM, BYTE, DOC, PORT };
})(typeof window !== 'undefined' ? window : globalThis);
