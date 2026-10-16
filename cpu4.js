'use strict';
/* Tonfunk DigiLab: Mini-CPU „TF-4“ (4 Bit). Baustein mit 16 Pins (siehe simics.js, Eintrag cpu4), Assembler, Befehlsausführung bei jeder steigenden
   Taktflanke, Editor mit Registeranzeige und Einzelschritt.
   Pins: 1 CLK, 2 RST, 3-6 IN0..IN3, 7 HLT (Ausgang), 8 GND, 9 CF, 10 ZF, 11-14 OUT3..OUT0, 15 NC, 16 VCC.
   Register: A (Akku), B, PC (6 Bit), Flags Z und C, RAM mit 16 Halbbytes, Ausgangsregister OUT. Programmspeicher: 64 Befehle. */
(function (root) {
  const OPS = {
    NOP: '', HLT: '', LDI: 'n', LDBI: 'n', LDA: 'a', STA: 'a', LDB: 'a', STB: 'a', TAB: '', TBA: '', SWP: '',
    ADD: '', SUB: '', ADDI: 'n', SUBI: 'n', CMP: '', CMPI: 'n', AND: '', OR: '', XOR: '', NOT: '', SHL: '', SHR: '', INC: '', DEC: '',
    IN: '', OUT: '', OUTI: 'n', JMP: 'l', JZ: 'l', JNZ: 'l', JC: 'l', JNC: 'l', CALL: 'l', RET: '', PUSH: '', POP: ''
  };
  const DOC = {
    NOP: 'tut nichts', HLT: 'hält die CPU an (bis Reset)', LDI: 'A = n', LDBI: 'B = n', LDA: 'A = RAM[a]', STA: 'RAM[a] = A', LDB: 'B = RAM[a]', STB: 'RAM[a] = B',
    TAB: 'B = A', TBA: 'A = B', SWP: 'A und B tauschen', ADD: 'A = A + B (C = Übertrag)', SUB: 'A = A − B (C = geborgt)', ADDI: 'A = A + n', SUBI: 'A = A − n',
    CMP: 'vergleicht A mit B (Flags, A bleibt)', CMPI: 'vergleicht A mit n', AND: 'A = A und B', OR: 'A = A oder B', XOR: 'A = A xor B', NOT: 'A = nicht A',
    SHL: 'A um 1 nach links (C = herausgeschobenes Bit)', SHR: 'A um 1 nach rechts (C = herausgeschobenes Bit)', INC: 'A = A + 1', DEC: 'A = A − 1',
    IN: 'A = Eingänge IN0..IN3', OUT: 'Ausgänge = A', OUTI: 'Ausgänge = n', JMP: 'springt zur Marke', JZ: 'springt, wenn Z = 1', JNZ: 'springt, wenn Z = 0', JC: 'springt, wenn C = 1', JNC: 'springt, wenn C = 0',
    CALL: 'Unterprogramm aufrufen: merkt sich die Rückkehr-Adresse (Stapel, vier Ebenen)', RET: 'zurück hinter den letzten CALL', PUSH: 'A auf den Datenstapel legen (vier Plätze)', POP: 'A = oberster Wert des Datenstapels'
  };
  const PROGRAMS = {
    'Zähler 0 bis 15': 'start:  LDI 0\nloop:   OUT\n        INC\n        JMP loop\n',
    'Lauflicht': 'start:  LDI 1\nloop:   OUT\n        SHL\n        JNC loop      ; C wird 1, wenn das Bit links herausfällt\n        JMP start\n',
    'Eingabe plus 3': 'loop:   IN            ; Schalter lesen\n        ADDI 3\n        OUT\n        JMP loop\n',
    'Abwärtszähler 9 bis 0': 'start:  LDI 9\nloop:   OUT\n        DEC\n        CMPI 15       ; nach 0 kommt 15 (Unterlauf)\n        JNZ loop\n        JMP start\n',
    'Unterprogramm: zweimal ausgeben': 'start:  LDI 5\n        CALL zeige    ; Unterprogramm aufrufen\n        LDI 10\n        CALL zeige\n        JMP start\nzeige:  OUT           ; Unterprogramm: Wert ausgeben ...\n        NOP\n        NOP\n        RET           ; ... und zurück\n',
    'Unterprogramm: Wartezeit': 'start:  OUTI 15\n        CALL warte\n        OUTI 0\n        CALL warte\n        JMP start\nwarte:  LDI 5         ; Zählschleife als Verzögerung\nw1:     DEC\n        JNZ w1\n        RET\n',
    'Fibonacci': '        LDI 0\n        STA 0         ; RAM0 = alte Zahl\n        LDI 1\n        STA 1         ; RAM1 = neue Zahl\nloop:   LDA 1\n        OUT\n        LDB 0         ; B = alte Zahl\n        ADD           ; A = neu + alt\n        JC reset      ; ab 16 Übertrag: von vorn\n        LDB 1\n        STB 0         ; alt = neu\n        STA 1         ; neu = Summe\n        JMP loop\nreset:  JMP 0\n'
  };

  /* ---------- Assembler ---------- */
  function assemble(text) {
    const lines = String(text || '').split('\n'), labels = {}, ins = [], errors = [];
    const num = t => { t = String(t).trim().replace(/^#/, ''); if (/^0x[0-9a-f]+$/i.test(t)) return parseInt(t, 16); if (/^0b[01]+$/i.test(t)) return parseInt(t.slice(2), 2); if (/^-?\d+$/.test(t)) return parseInt(t, 10); return NaN; };
    lines.forEach((raw, i) => {
      let s = raw.replace(/(;|\/\/).*$/, '').trim(); if (!s) return;
      let m = s.match(/^([A-Za-z_]\w*)\s*:\s*(.*)$/);
      while (m) { if (labels[m[1].toLowerCase()] != null) errors.push({ line: i + 1, msg: 'Marke „' + m[1] + '“ gibt es schon' }); labels[m[1].toLowerCase()] = ins.length; s = m[2].trim(); m = s.match(/^([A-Za-z_]\w*)\s*:\s*(.*)$/); }
      if (!s) return;
      const parts = s.split(/\s+/), op = parts[0].toUpperCase(), arg = parts.slice(1).join('');
      if (!(op in OPS)) { errors.push({ line: i + 1, msg: 'Unbekannter Befehl „' + parts[0] + '“' }); return; }
      const need = OPS[op]; let n = 0;
      if (need === '' && arg) errors.push({ line: i + 1, msg: op + ' braucht keinen Operanden' });
      if (need === 'n' || need === 'a') { n = num(arg); if (!arg) errors.push({ line: i + 1, msg: op + ' braucht eine Zahl 0 bis 15' }); else if (isNaN(n) || n < 0 || n > 15) errors.push({ line: i + 1, msg: 'Zahl muss zwischen 0 und 15 liegen: ' + arg }); }
      if (need === 'l' && !arg) errors.push({ line: i + 1, msg: op + ' braucht eine Marke' });
      ins.push({ op, n, label: need === 'l' ? arg : null, line: i + 1 });
    });
    ins.forEach(x => {
      if (x.label == null) return; const k = x.label.toLowerCase();
      if (labels[k] != null) x.n = labels[k]; else { const v = num(x.label); if (!isNaN(v) && v >= 0 && v < 64) x.n = v; else errors.push({ line: x.line, msg: 'Marke „' + x.label + '“ nicht gefunden' }); }
    });
    if (ins.length > 64) errors.push({ line: 0, msg: 'Der Programmspeicher fasst 64 Befehle, es sind ' + ins.length });
    return { prog: ins, labels, errors };
  }
  let cacheT = null, cacheP = { prog: [], errors: [] };
  const program = () => { const t = (root.LabDigiAPI && root.LabDigiAPI.sch && root.LabDigiAPI.sch.code) || ''; if (t !== cacheT) { cacheT = t; cacheP = assemble(t); } return cacheP; };

  /* ---------- Ausführung ---------- */
  function fresh(st) { st.pc = 0; st.a = 0; st.b = 0; st.z = 0; st.c = 0; st.out = 0; st.halt = 0; st.ram = new Array(16).fill(0); st.steps = 0; st.last = -1; st.stack = []; st.dstack = []; st.err = ''; }
  function exec(e) {
    const st = e.st, P = program(), ins = P.prog[st.pc];
    if (!ins || P.errors.length) { st.halt = 1; return; }
    let pc = st.pc + 1; const set = v => { st.z = (v & 15) === 0 ? 1 : 0; return v & 15; };
    st.last = ins.line;
    switch (ins.op) {
      case 'NOP': break;
      case 'HLT': st.halt = 1; break;
      case 'LDI': st.a = set(ins.n); break;
      case 'LDBI': st.b = ins.n & 15; break;
      case 'LDA': st.a = set(st.ram[ins.n]); break;
      case 'STA': st.ram[ins.n] = st.a; break;
      case 'LDB': st.b = st.ram[ins.n]; break;
      case 'STB': st.ram[ins.n] = st.b; break;
      case 'TAB': st.b = st.a; break;
      case 'TBA': st.a = set(st.b); break;
      case 'SWP': { const t = st.a; st.a = st.b; st.b = t; break; }
      case 'ADD': { const s = st.a + st.b; st.c = s > 15 ? 1 : 0; st.a = set(s); break; }
      case 'ADDI': { const s = st.a + ins.n; st.c = s > 15 ? 1 : 0; st.a = set(s); break; }
      case 'SUB': { const s = st.a - st.b; st.c = s < 0 ? 1 : 0; st.a = set(s); break; }
      case 'SUBI': { const s = st.a - ins.n; st.c = s < 0 ? 1 : 0; st.a = set(s); break; }
      case 'CMP': { const s = st.a - st.b; st.c = s < 0 ? 1 : 0; st.z = (s & 15) === 0 ? 1 : 0; break; }
      case 'CMPI': { const s = st.a - ins.n; st.c = s < 0 ? 1 : 0; st.z = (s & 15) === 0 ? 1 : 0; break; }
      case 'AND': st.a = set(st.a & st.b); st.c = 0; break;
      case 'OR': st.a = set(st.a | st.b); st.c = 0; break;
      case 'XOR': st.a = set(st.a ^ st.b); st.c = 0; break;
      case 'NOT': st.a = set(~st.a); st.c = 0; break;
      case 'SHL': st.c = (st.a >> 3) & 1; st.a = set(st.a << 1); break;
      case 'SHR': st.c = st.a & 1; st.a = set(st.a >> 1); break;
      case 'INC': { const s = st.a + 1; st.c = s > 15 ? 1 : 0; st.a = set(s); break; }
      case 'DEC': { const s = st.a - 1; st.c = s < 0 ? 1 : 0; st.a = set(s); break; }
      case 'IN': st.a = set(st.inv || 0); break;
      case 'OUT': st.out = st.a; break;
      case 'OUTI': st.out = ins.n; break;
      case 'JMP': pc = ins.n; break;
      case 'JZ': if (st.z) pc = ins.n; break;
      case 'JNZ': if (!st.z) pc = ins.n; break;
      case 'JC': if (st.c) pc = ins.n; break;
      case 'JNC': if (!st.c) pc = ins.n; break;
      case 'CALL': if ((st.stack || (st.stack = [])).length >= 4) { st.halt = 1; st.err = 'Stapel voll: zu viele verschachtelte CALL'; break; } st.stack.push(pc); pc = ins.n; break;
      case 'RET': if (!(st.stack || []).length) { st.halt = 1; st.err = 'RET ohne CALL: der Stapel ist leer'; break; } pc = st.stack.pop(); break;
      case 'PUSH': if ((st.dstack || (st.dstack = [])).length >= 4) { st.halt = 1; st.err = 'Datenstapel voll'; break; } st.dstack.push(st.a); break;
      case 'POP': if (!(st.dstack || []).length) { st.halt = 1; st.err = 'POP bei leerem Datenstapel'; break; } st.a = set(st.dstack.pop()); break;
    }
    st.pc = pc & 63; st.steps++;
    if (st.pc >= P.prog.length) st.halt = 1;
  }
  function update(e, vp, lv, O, rise) {
    const st = e.st; if (st.pc == null) fresh(st);
    st.n = (st.n || 0) + 1;
    const clk = lv(e, vp, 1), rst = lv(e, vp, 2);
    st.inv = lv(e, vp, 3) | (lv(e, vp, 4) << 1) | (lv(e, vp, 5) << 2) | (lv(e, vp, 6) << 3);
    const edge = rise(e, 'clk', clk) && st.n > 30;
    if (rst) fresh(st); else if (edge && !st.halt) exec(e);
    [14, 13, 12, 11].forEach((pin, i) => O(pin, (st.out >> i) & 1, { rh: 40, rl: 40 }));
    O(7, st.halt ? 1 : 0, { rh: 40, rl: 40 }); O(9, st.c ? 1 : 0, { rh: 40, rl: 40 }); O(10, st.z ? 1 : 0, { rh: 40, rl: 40 });
  }
  const cpuElem = api => (api.circ && api.circ.elems.find(e => e.type === 'IC' && e.key === 'cpu4')) || null;

  /* ---------- Editor ---------- */
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let timer = 0;
  function closeEditor() { clearInterval(timer); timer = 0; const p = document.getElementById('cpuPanel'); if (p) p.remove(); }
  function openEditor(api) {
    if (document.getElementById('cpuPanel')) { closeEditor(); return; }
    const w = document.createElement('div'); w.id = 'cpuPanel';
    w.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:70;width:min(480px,calc(100vw - 16px));max-height:84vh;overflow:auto;background:#1f262e;color:#e8eaed;border:1px solid #38424d;border-radius:12px;padding:10px 12px;font:13px/1.4 system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.55)';
    w.innerHTML = `<div style="display:flex;align-items:center;gap:8px"><b style="font-size:15px;flex:1">Mini-CPU TF-4: Programm</b><select id="cpS" style="background:#10151a;color:#e8eaed;border:1px solid #38424d;border-radius:6px;padding:4px"><option>Beispiel laden …</option>${Object.keys(PROGRAMS).map(k => `<option>${esc(k)}</option>`).join('')}</select><button id="cpX" style="background:none;border:0;color:#e8eaed;font-size:20px;cursor:pointer">✕</button></div>
      <textarea id="cpT" spellcheck="false" style="width:100%;box-sizing:border-box;height:170px;margin-top:6px;background:#10151a;color:#cfe3ff;border:1px solid #38424d;border-radius:8px;padding:8px;font:13px/1.45 ui-monospace,Consolas,monospace;resize:vertical"></textarea>
      <div id="cpE" style="min-height:18px;color:#ffb020;margin:4px 0"></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="cb pri" id="cpL">Übernehmen und starten</button><button class="cb" id="cpP">⏭ Ein Schritt</button><button class="cb" id="cpR">↺ Reset</button><button class="cb" id="cpH">Befehle</button></div>
      <div id="cpV" style="margin-top:8px;font-family:ui-monospace,Consolas,monospace"></div><div id="cpD" style="display:none;margin-top:8px;max-height:160px;overflow:auto;font-size:12px"></div>
      <style>#cpuPanel .cb{background:#2c343e;color:#e8eaed;border:1px solid #38424d;border-radius:8px;padding:7px 11px;font-size:13px;cursor:pointer}#cpuPanel .cb.pri{background:#ff9d00;color:#1b1b1b;border-color:#ff9d00;font-weight:700}</style>`;
    document.body.appendChild(w);
    const q = s => w.querySelector(s), ta = q('#cpT'); ta.value = api.sch.code || PROGRAMS['Zähler 0 bis 15'];
    const check = () => { const P = assemble(ta.value); q('#cpE').innerHTML = P.errors.length ? P.errors.slice(0, 3).map(x => (x.line ? 'Zeile ' + x.line + ': ' : '') + esc(x.msg)).join('<br>') : '<span style="color:#5ee27d">Programm in Ordnung (' + P.prog.length + ' Befehle)</span>'; return P; };
    ta.addEventListener('input', check); check();
    const bin = (v, n) => v.toString(2).padStart(n, '0');
    const show = () => {
      const e = cpuElem(api), P = program(); const st = (e && e.st && e.st.pc != null) ? e.st : null;
      if (!st) { q('#cpV').innerHTML = '<span style="color:#9aa6b2">Setze eine Mini-CPU (Menü „IC“ oder Baustein „Mini-CPU“), versorge sie mit 5 V und Masse und gib ihr einen Takt, dann siehst du hier die Register.</span>'; return; }
      const nxt = P.prog[st.pc], cell = (n, v, b) => `<span style="display:inline-block;margin:2px 10px 2px 0">${n} <b style="color:#6dff7a">${bin(v, b)}</b> <span style="color:#9aa6b2">(${v})</span></span>`;
      q('#cpV').innerHTML = cell('A', st.a, 4) + cell('B', st.b, 4) + cell('OUT', st.out, 4) + '<br>' + `<span style="margin-right:10px">PC <b style="color:#6dff7a">${st.pc}</b></span><span style="margin-right:10px">Z <b style="color:#6dff7a">${st.z}</b></span><span style="margin-right:10px">C <b style="color:#6dff7a">${st.c}</b></span><span style="margin-right:10px">IN <b style="color:#6dff7a">${bin(st.inv || 0, 4)}</b></span>${st.halt ? '<b style="color:#ffb020">HALT</b>' : ''}<br>Stapel <span style="color:#6dff7a">${(st.stack && st.stack.length ? st.stack.map(x => x).join(' · ') : '–')}</span>${st.dstack && st.dstack.length ? ' · Daten <span style="color:#6dff7a">' + st.dstack.join(' · ') + '</span>' : ''}${st.err ? '<br><b style="color:#ffb020">' + esc(st.err) + '</b>' : ''}<br>RAM ${st.ram.map((v, i) => `<span style="color:${v ? '#6dff7a' : '#6b7682'}">${v.toString(16).toUpperCase()}</span>`).join(' ')}<br><span style="color:#9aa6b2">Nächster Befehl: ${nxt ? 'Zeile ' + nxt.line + ': <b>' + nxt.op + (OPS[nxt.op] ? ' ' + (nxt.label != null ? nxt.label : nxt.n) : '') + '</b>' : 'Programmende'} · ${st.steps} Schritte</span>`;
    };
    timer = setInterval(show, 150); show();
    q('#cpX').onclick = closeEditor;
    q('#cpL').onclick = () => { const P = check(); if (P.errors.length) { api.toast('Das Programm hat noch Fehler'); return; } api.sch.code = ta.value; api.commit(true, true); api.rebuild(); api.refreshUI(); api.draw(); api.toast('Programm übernommen'); };
    q('#cpP').onclick = () => { const e = cpuElem(api); if (!e) { api.toast('Keine Mini-CPU in der Schaltung (oder Simulation aus)'); return; } if (e.st.pc == null) fresh(e.st); if (api.sch.code !== ta.value) { const P = check(); if (!P.errors.length) { api.sch.code = ta.value; } } exec(e); show(); };
    q('#cpR').onclick = () => { const e = cpuElem(api); if (e) { fresh(e.st); show(); } };
    q('#cpS').onchange = ev => { const t = PROGRAMS[ev.target.value]; if (t) { ta.value = t; check(); } ev.target.selectedIndex = 0; };
    q('#cpH').onclick = () => { const d = q('#cpD'); d.style.display = d.style.display === 'none' ? 'block' : 'none'; d.innerHTML = '<table style="width:100%;border-collapse:collapse">' + Object.keys(OPS).map(k => `<tr><td style="padding:2px 8px 2px 0;font-family:monospace;color:#6dff7a">${k}${OPS[k] ? ' ' + ({ n: 'n', a: 'a', l: 'Marke' }[OPS[k]]) : ''}</td><td>${esc(DOC[k])}</td></tr>`).join('') + '</table><p style="color:#9aa6b2">Zahlen: 0 bis 15, auch 0x… und 0b…. Marken stehen vor dem Befehl: <code>loop:</code>. Kommentare nach <code>;</code>.</p>'; };
  }
  root.CPU4 = { assemble, update, exec, fresh, program, openEditor, closeEditor, PROGRAMS, OPS, cpuElem };
})(typeof window !== 'undefined' ? window : globalThis);
