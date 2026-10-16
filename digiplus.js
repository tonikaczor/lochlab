'use strict';
/* Tonfunk DigiLab: Werkzeuge für Fortgeschrittene.
   KV-Diagramm (Karnaugh-Veitch), Zustandsautomaten (Tabelle, Diagramm, Simulation, Bau der Schaltung mit D-Flipflops, Reset-Eingang)
   und der Fehler-Würfel für Gatterschaltungen. Wird von digi.js (DIGI_DEF) mit DIGI_PLUS(api, DIGI) eingehängt. */
(function (root) {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const COL = ['#ff6b6b', '#4dabf7', '#51cf66', '#fcc419', '#cc5de8', '#ff922b', '#20c997', '#f783ac'];
  const bits = (v, n) => v.toString(2).padStart(n, '0');

  /* ---------- Vereinfachen mit Don't-Care (Quine-McCluskey) ---------- */
  function primesOf(care, n) {
    let level = new Set(care.map(m => bits(m, n))); const prim = new Set();
    while (level.size) {
      const arr = [...level], next = new Set(), used = new Set();
      for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i], b = arr[j]; let diff = -1, ok = true;
        for (let k = 0; k < n; k++) if (a[k] !== b[k]) { if (a[k] === '-' || b[k] === '-' || diff >= 0) { ok = false; break; } diff = k; }
        if (ok && diff >= 0) { used.add(a); used.add(b); next.add(a.slice(0, diff) + '-' + a.slice(diff + 1)); }
      }
      arr.forEach(x => { if (!used.has(x)) prim.add(x); }); level = next;
    }
    return [...prim];
  }
  const covers = (p, m, n) => { const b = bits(m, n); for (let i = 0; i < n; i++) if (p[i] !== '-' && p[i] !== b[i]) return false; return true; };
  /* minterms: Pflicht-Einsen, dc: Don't-Care. Ergebnis: ausgewählte Terme (Muster aus 0, 1, -) */
  function minimize(minterms, dc, n) {
    if (!minterms.length) return [];
    if (minterms.length + dc.length === (1 << n)) return ['-'.repeat(n)];
    const primes = primesOf(minterms.concat(dc), n), chosen = [], left = new Set(minterms);
    minterms.forEach(m => { const c = primes.filter(p => covers(p, m, n)); if (c.length === 1 && !chosen.includes(c[0])) chosen.push(c[0]); });
    chosen.forEach(p => minterms.forEach(m => { if (covers(p, m, n)) left.delete(m); }));
    while (left.size) { let best = null, bc = -1; primes.forEach(p => { const k = [...left].filter(m => covers(p, m, n)).length; if (k > bc) { bc = k; best = p; } }); chosen.push(best); [...left].forEach(m => { if (covers(best, m, n)) left.delete(m); }); }
    return chosen;
  }
  const termText = (t, names) => { const a = []; for (let i = 0; i < t.length; i++) if (t[i] !== '-') a.push((t[i] === '0' ? '¬' : '') + names[i]); return a.length ? a.join(' · ') : '1'; };
  const exprText = (terms, names) => (terms.length ? terms.map(t => termText(t, names)).join(' + ') : '0');

  /* aus Termen eine Gatter-Beschreibung für den Auto-Layout (DIGI.layout) */
  function gatesFromTerms(terms, ctx) {
    const { gates, used, refOf, prefix } = ctx;
    const inv = x => { const id = 'n_' + x; if (!used.has(id)) { used.add(id); gates.push({ id, t: 'NOT', in: [x] }); } return id; };
    if (!terms.length) return 'L';
    if (terms.some(t => /^-*$/.test(t))) return 'H';
    const refs = terms.map((t, k) => {
      const lits = []; for (let i = 0; i < t.length; i++) if (t[i] !== '-') lits.push(t[i] === '1' ? refOf(i, true, inv) : refOf(i, false, inv));
      let ref = lits[0]; for (let q = 1; q < lits.length; q++) { const id = prefix + 'a' + k + '_' + q; gates.push({ id, t: 'AND', in: [ref, lits[q]] }); ref = id; }
      return ref;
    });
    let ref = refs[0]; for (let q = 1; q < refs.length; q++) { const id = prefix + 'o' + q; gates.push({ id, t: 'OR', in: [ref, refs[q]] }); ref = id; }
    return ref;
  }

  /* ---------- Zustandsautomat: Gleichungen und Schaltung ---------- */
  const fsmBits = M => Math.max(1, Math.ceil(Math.log2(M.states.length)));
  function fsmEqs(M) {
    const S = M.states.length, k = fsmBits(M), nv = k + 1, names = []; for (let i = k - 1; i >= 0; i--) names.push('Q' + i); names.push('X');
    const dcAll = []; const D_ = Array.from({ length: k }, () => []), O_ = M.outs.map(() => []);
    for (let code = 0; code < (1 << k); code++) for (let x = 0; x < 2; x++) {
      const idx = (code << 1) | x;
      if (code >= S) { dcAll.push(idx); continue; }
      const nx = M.states[code].t[M.x ? x : 0]; for (let i = 0; i < k; i++) if ((nx >> i) & 1) D_[i].push(idx);
      M.outs.forEach((_, j) => { if (M.states[code].o[j]) O_[j].push(idx); });
    }
    return { k, nv, names, D: D_.map(m => minimize(m, dcAll, nv)), O: O_.map(m => minimize(m, dcAll, nv)), Dm: D_, Om: O_, dc: dcAll };
  }
  function fsmSpec(M, reset) {
            const E2 = fsmEqs(M), k = E2.k, gates = [], used = new Set(), inputs = []; if (M.x) inputs.push('X'); if (reset) inputs.push('R');
            const refOf = (i, pos, inv) => { if (i === E2.nv - 1) return pos ? 'X' : inv('X'); const bit = k - 1 - i; return pos ? 'q' + bit : 'q' + bit + '.n'; };
            const dRefs = E2.D.map((terms, i) => gatesFromTerms(terms, { gates, used, refOf, prefix: 'd' + i }));
            // Reset (synchron): D = D · ¬R für jedes Flipflop
            const nR = () => { if (!used.has('n_R')) { used.add('n_R'); gates.push({ id: 'n_R', t: 'NOT', in: ['R'] }); } return 'n_R'; };
            const dFinal = dRefs.map((ref, i) => { if (!reset || ref === 'L') return ref; if (ref === 'H') return nR(); const id = 'dr' + i; gates.push({ id, t: 'AND', in: [ref, nR()] }); return id; });
            for (let i = 0; i < k; i++) gates.push({ id: 'q' + i, t: 'DFF', in: [dFinal[i], 'CLK'] });
            const outputs = []; for (let i = k - 1; i >= 0; i--) outputs.push({ name: 'Q' + i, src: 'q' + i, color: 'grün' });
            M.outs.forEach((o, j) => { const t = E2.O[j]; if (!t.length || t.some(tt => /^-*$/.test(tt))) return; const ref = gatesFromTerms(t, { gates, used, refOf, prefix: 'z' + j }); outputs.push({ name: o, src: ref, color: j ? 'gelb' : 'rot' }); });
    return { inputs, clk: '1Hz', gates, outputs, scope: [], win: 10, tempo: 0.75 };
  }

  root.DIGI_PLUS = function (api, D) {
    const sheet = (t, f) => root.LabUI.sheet(t, f);
    const stat = (k, v, m) => { if (root.Badges) root.Badges.stat(k, v, m); };
    const build = (spec, name, extraMsg) => {
      spec.name = name; const L = root.DIGI.layout(spec);
      if (api.sch.parts.length) { try { api.saveNamed(); } catch (e) {} }
      api.loadCircuit(api.buildExample({ name, make: () => L }));
      api.toast(L.fails ? 'Achtung: ' + L.fails + ' Verbindung(en) waren zu eng für den Auto-Weg. Ergänze sie von Hand.' : (extraMsg || 'Schaltung gebaut.'));
    };

    /* ================= KV-Diagramm ================= */
    function openKV(pre) {
      let n = 3, cells = new Array(16).fill(0);      // 0, 1, 2 (= egal)
      if (pre) { n = pre.n; cells = pre.cells.slice(); while (cells.length < 16) cells.push(0); }
      const VAR = ['A', 'B', 'C', 'D'], GRAY = [0, 1, 3, 2];
      sheet('KV-Diagramm', (b, close) => {
        const draw = () => {
          const N = 1 << n, mt = [], dc = []; for (let i = 0; i < N; i++) { if (cells[i] === 1) mt.push(i); else if (cells[i] === 2) dc.push(i); }
          const terms = minimize(mt, dc, n), names = VAR.slice(0, n);
          // Zeilen und Spalten (Gray-Code): 2 Variablen: A × B, 3: A × BC, 4: AB × CD
          const rv = n === 2 ? 1 : n === 3 ? 1 : 2, cvn = n - rv, R = 1 << rv, C = 1 << cvn;
          const rowCode = r => (rv === 1 ? r : GRAY[r]), colCode = c => (cvn === 1 ? c : GRAY[c]);
          const idxOf = (r, c) => (rowCode(r) << cvn) | colCode(c);
          const groupsOf = i => terms.map((t, k) => covers(t, i, n) ? k : -1).filter(k => k >= 0);
          let h = `<p class="hint2" style="margin-top:0">Tippe auf ein Feld: 0 → 1 → X (egal). Das Lab sucht die größten Gruppen aus 1, 2, 4, 8 oder 16 benachbarten Einsen (auch über den Rand!) und liest die Gleichung ab.</p>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px"><label class="hint2">Variablen <select id="kn">${[2, 3, 4].map(k => `<option${k === n ? ' selected' : ''}>${k}</option>`).join('')}</select></label><button class="btn" id="kz">Alles 0</button><button class="btn" id="ki">Aus Schaltung übernehmen</button></div>`;
          h += '<div style="overflow:auto"><table style="border-collapse:collapse;margin:6px auto;text-align:center">';
          h += '<tr><td style="padding:2px 8px;color:var(--mute);font-size:12px">' + (rv === 1 ? names[0] : names.slice(0, rv).join('')) + ' \\ ' + names.slice(rv).join('') + '</td>' + Array.from({ length: C }, (_, c) => `<td style="padding:2px 6px;font-family:monospace;color:var(--mute)">${bits(colCode(c), cvn)}</td>`).join('') + '</tr>';
          for (let r = 0; r < R; r++) {
            h += `<tr><td style="padding:2px 8px;font-family:monospace;color:var(--mute)">${bits(rowCode(r), rv)}</td>`;
            for (let c = 0; c < C; c++) {
              const i = idxOf(r, c), gs = groupsOf(i), v = cells[i], sh = gs.map((k, q) => `inset 0 0 0 ${3 * (q + 1)}px ${COL[k % COL.length]}`).join(',');
              h += `<td><button data-i="${i}" style="width:54px;height:54px;border-radius:6px;border:1px solid var(--line);background:${v === 1 ? 'rgba(109,255,122,.28)' : v === 2 ? 'rgba(255,200,60,.2)' : 'var(--panel2)'};color:var(--fg);font:700 18px ui-monospace,monospace;cursor:pointer;box-shadow:${sh || 'none'}" title="Feld ${i}">${v === 2 ? 'X' : v}<span style="display:block;font:10px system-ui;color:var(--mute)">${i}</span></button></td>`;
            }
            h += '</tr>';
          }
          h += '</table></div>';
          h += `<div style="margin:8px 0"><b>Gruppen:</b> ${terms.length ? terms.map((t, k) => `<span style="display:inline-block;margin:2px 6px 2px 0;padding:2px 8px;border-radius:10px;border:2px solid ${COL[k % COL.length]}">${esc(termText(t, names))}</span>`).join('') : '–'}</div>`;
          h += `<div style="font-size:16px;margin:6px 0"><b>Y</b> = <span style="font-family:monospace">${esc(mt.length ? exprText(terms, names) : '0')}</span></div><p class="hint2">· heißt UND, + heißt ODER, ¬ heißt NICHT. Eine X-Zelle darfst du zur Gruppe nehmen, musst es aber nicht: Das Lab nimmt sie, wenn dadurch die Gruppe größer und die Gleichung kürzer wird.</p><div class="btns"><button class="btn pri" id="kb">Schaltung bauen</button></div>`;
          b.innerHTML = h;
          b.querySelector('#kn').onchange = e => { n = +e.target.value; draw(); };
          b.querySelector('#kz').onclick = () => { cells = new Array(16).fill(0); draw(); };
          b.querySelectorAll('button[data-i]').forEach(x => { x.onclick = () => { const i = +x.dataset.i; cells[i] = (cells[i] + 1) % 3; draw(); stat('kv', 1, 'max'); }; });
          b.querySelector('#ki').onclick = () => {
            const an = root.DIGI.analyse(); if (an.error) { api.toast(an.error); return; }
            if (an.n > 4) { api.toast('Mehr als vier Eingänge passen nicht in ein KV-Diagramm'); return; }
            n = Math.max(2, an.n); cells = new Array(16).fill(0); for (let c = 0; c < an.N; c++) cells[c] = an.rows[c][0] ? 1 : 0; draw(); api.toast('Übernommen: ' + an.outNames[0] + ' als Funktion von ' + an.inNames.join(', '));
          };
          b.querySelector('#kb').onclick = () => {
            if (!terms.length || terms.some(t => /^-*$/.test(t))) { api.toast('Die Funktion ist konstant (immer 0 oder immer 1), dafür braucht es keine Gatter.'); return; }
            const ctx = { gates: [], used: new Set(), prefix: 'k', refOf: (i, pos, inv) => (pos ? names[i] : inv(names[i])) };
            const ref = gatesFromTerms(terms, ctx); close();
            build({ inputs: names.slice(), gates: ctx.gates, outputs: [{ name: 'Y', src: ref, color: 'grün' }], scope: [] }, 'Aus KV-Diagramm', 'Schaltung gebaut. Prüfe sie mit der Wahrheitstabelle.');
            stat('synth', 1, 'max');
          };
        };
        draw();
      });
    }

    /* ================= Zustandsautomat ================= */
    const FSM_T = {
      'Ampel (rot, rot-gelb, grün, gelb)': { x: false, outs: ['Rot', 'Gelb', 'Grün'], states: [{ n: 'Rot', o: [1, 0, 0], t: [1, 1] }, { n: 'Rot-Gelb', o: [1, 1, 0], t: [2, 2] }, { n: 'Grün', o: [0, 0, 1], t: [3, 3] }, { n: 'Gelb', o: [0, 1, 0], t: [0, 0] }] },
      'Folge 101 erkennen': { x: true, outs: ['Z'], states: [{ n: 'Start', o: [0], t: [0, 1] }, { n: '1', o: [0], t: [2, 1] }, { n: '10', o: [0], t: [0, 3] }, { n: '101', o: [1], t: [2, 1] }] },
      'Zähler 0 bis 3 mit Freigabe': { x: true, outs: ['Null', 'Drei'], states: [{ n: 'Z0', o: [1, 0], t: [0, 1] }, { n: 'Z1', o: [0, 0], t: [1, 2] }, { n: 'Z2', o: [0, 0], t: [2, 3] }, { n: 'Z3', o: [0, 1], t: [3, 0] }] },
      'Treppenlicht (Taste, drei Takte)': { x: true, outs: ['Licht'], states: [{ n: 'Aus', o: [0], t: [0, 1] }, { n: 'An1', o: [1], t: [2, 2] }, { n: 'An2', o: [1], t: [3, 3] }, { n: 'An3', o: [1], t: [0, 0] }] }
    };
    function openFSM(preName) {
      const clone = o => JSON.parse(JSON.stringify(o));
      let M = clone(FSM_T[preName || 'Folge 101 erkennen']), cur = 0, hist = [], reset = true;
      sheet('Zustandsautomat', (b, close) => {
        const nb = () => fsmBits(M);
        const eqs = () => fsmEqs(M);
        const diagram = () => {
          const S = M.states.length, W = 360, H = 270, cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.36, r = 26;
          const pos = M.states.map((_, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / S; return [cx + R * Math.cos(a), cy + R * Math.sin(a)]; });
          let s = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:420px;display:block;margin:0 auto;background:#10151a;border-radius:10px"><defs><marker id="ar" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8z" fill="#9aa6b2"/></marker></defs>`;
          const edge = (i, j, lab) => {
            if (i === j) { const [x, y] = pos[i], dx = x - cx, dy = y - cy, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, ox = x + ux * (r + 10), oy = y + uy * (r + 10); return `<circle cx="${ox}" cy="${oy}" r="11" fill="none" stroke="#9aa6b2" stroke-width="1.5"/><text x="${ox + ux * 17}" y="${oy + uy * 17 + 4}" fill="#cfe3ff" font-size="12" text-anchor="middle">${lab}</text>`; }
            const [x1, y1] = pos[i], [x2, y2] = pos[j], mx = (x1 + x2) / 2, my = (y1 + y2) / 2, k = 0.22, qx = mx + (cx - mx) * k - (y2 - y1) * 0.12, qy = my + (cy - my) * k + (x2 - x1) * 0.12;
            const a1 = Math.atan2(qy - y1, qx - x1), a2 = Math.atan2(qy - y2, qx - x2), sx = x1 + Math.cos(a1) * r, sy = y1 + Math.sin(a1) * r, ex = x2 + Math.cos(a2) * (r + 3), ey = y2 + Math.sin(a2) * (r + 3);
            return `<path d="M${sx} ${sy}Q${qx} ${qy} ${ex} ${ey}" fill="none" stroke="#9aa6b2" stroke-width="1.5" marker-end="url(#ar)"/><text x="${(sx + 2 * qx + ex) / 4}" y="${(sy + 2 * qy + ey) / 4 - 3}" fill="#cfe3ff" font-size="12" text-anchor="middle">${lab}</text>`;
          };
          M.states.forEach((st, i) => { const t0 = st.t[0], t1 = M.x ? st.t[1] : st.t[0]; if (M.x && t0 !== t1) { s += edge(i, t0, '0') + edge(i, t1, '1'); } else s += edge(i, t0, M.x ? '0,1' : ''); });
          M.states.forEach((st, i) => { const [x, y] = pos[i]; s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${i === cur ? '#2f6f3f' : '#1f262e'}" stroke="${i === cur ? '#6dff7a' : '#9aa6b2'}" stroke-width="${i === cur ? 3 : 1.5}"/><text x="${x}" y="${y - 2}" fill="#e8eaed" font-size="12" font-weight="700" text-anchor="middle">${esc(st.n)}</text><text x="${x}" y="${y + 12}" fill="#6dff7a" font-size="10" text-anchor="middle">${M.outs.map((o, j) => st.o[j] ? o : '').filter(Boolean).join(' ')}</text>`; });
          return s + '</svg>';
        };
        const draw = () => {
          const S = M.states.length, E = eqs(), sel = (v, i, k) => `<select data-t="${i}" data-k="${k}" style="padding:3px">${M.states.map((s, q) => `<option value="${q}"${q === v ? ' selected' : ''}>${esc(s.n)}</option>`).join('')}</select>`;
          let h = `<p class="hint2" style="margin-top:0">Ein Zustandsautomat hat Zustände, Übergänge (je nach Eingang X) und Ausgänge. Wähle eine Vorlage oder ändere die Tabelle, schalte mit den Takt-Knöpfen weiter, und lass die Schaltung aus D-Flipflops bauen.</p>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px"><label class="hint2">Vorlage <select id="ft"><option>wählen …</option>${Object.keys(FSM_T).map(k => `<option>${esc(k)}</option>`).join('')}</select></label><label class="hint2"><input type="checkbox" id="fx" ${M.x ? 'checked' : ''}> Eingang X nutzen</label></div>
            ${diagram()}
            <div style="margin:8px 0;display:flex;gap:6px;flex-wrap:wrap;align-items:center"><button class="btn pri" id="c0">Takt, X = 0</button>${M.x ? '<button class="btn pri" id="c1">Takt, X = 1</button>' : ''}<button class="btn" id="cr">Zurück zum Start</button><span class="hint2">Zustand: <b>${esc(M.states[cur].n)}</b>${M.outs.map((o, j) => M.states[cur].o[j] ? ' · ' + esc(o) : '').join('')}</span></div>
            <div class="hint2" style="margin:4px 0">Verlauf: ${hist.slice(-10).map(esc).join(' → ') || '–'}</div>
            <div style="overflow:auto"><table style="border-collapse:collapse;width:100%;font-size:13px"><tr style="text-align:left;color:var(--mute)"><th>Zustand</th><th>X=0 →</th>${M.x ? '<th>X=1 →</th>' : ''}${M.outs.map(o => `<th>${esc(o)}</th>`).join('')}</tr>` +
            M.states.map((st, i) => `<tr style="border-top:1px solid var(--line)"><td><input data-n="${i}" value="${esc(st.n)}" style="width:78px;padding:3px"></td><td>${sel(st.t[0], i, 0)}</td>${M.x ? `<td>${sel(st.t[1], i, 1)}</td>` : ''}${st.o.map((v, j) => `<td><input type="checkbox" data-o="${i}" data-j="${j}" ${v ? 'checked' : ''}></td>`).join('')}</tr>`).join('') + `</table></div>
            <div class="row2" style="margin:6px 0"><button class="btn" id="fa" ${S >= 8 ? 'disabled' : ''}>Zustand hinzufügen</button><button class="btn" id="fd" ${S <= 2 ? 'disabled' : ''}>Letzten entfernen</button></div>
            <h4 style="margin:10px 0 4px">Zustandscodierung und Gleichungen</h4><p class="hint2" style="margin:0">${S} Zustände brauchen ${E.k} Flipflop${E.k > 1 ? 's' : ''} (Zustand ${esc(M.states[0].n)} = ${bits(0, E.k)}). Nicht benutzte Codes sind Don't-Care.</p>
            <div style="overflow:auto"><table style="border-collapse:collapse;font-family:monospace;font-size:12px;margin:6px 0"><tr style="color:var(--mute)"><th>${E.names.slice(0, E.k).join('')}</th>${M.x ? '<th>X</th>' : ''}<th>→ ${Array.from({ length: E.k }, (_, i) => 'D' + (E.k - 1 - i)).join('')}</th>${M.outs.map(o => `<th>${esc(o)}</th>`).join('')}</tr>` +
            M.states.flatMap((st, i) => (M.x ? [0, 1] : [0]).map(x => { const nx = st.t[M.x ? x : 0]; return `<tr style="border-top:1px solid var(--line)"><td>${bits(i, E.k)}</td>${M.x ? `<td>${x}</td>` : ''}<td>${bits(nx, E.k)}</td>${st.o.map(v => `<td>${v}</td>`).join('')}</tr>`; })).join('') + '</table></div>' +
            E.D.map((t, i) => `<div style="margin:3px 0"><b>D${i}</b> = <span style="font-family:monospace">${esc(exprText(t, E.names))}</span></div>`).reverse().join('') +
            M.outs.map((o, j) => `<div style="margin:3px 0"><b>${esc(o)}</b> = <span style="font-family:monospace">${esc(exprText(E.O[j], E.names))}</span></div>`).join('') +
            `<p class="hint2">Zu jedem Takt nimmt jedes Flipflop sein D als neuen Zustand. Die Ausgänge hängen hier nur vom Zustand ab (Moore-Automat).</p><label class="hint2" style="display:block;margin:6px 0"><input type="checkbox" id="fr" ${reset ? 'checked' : ''}> Reset-Schalter R einbauen (synchron: wirkt mit dem nächsten Takt, setzt auf Zustand 0)</label><div class="btns"><button class="btn pri" id="fb">Schaltung bauen</button></div>`;
          b.innerHTML = h;
          b.querySelector('#ft').onchange = e => { const t = FSM_T[e.target.value]; if (t) { M = clone(t); cur = 0; hist = []; draw(); } };
          b.querySelector('#fx').onchange = e => { M.x = e.target.checked; if (!M.x) M.states.forEach(s => { s.t[1] = s.t[0]; }); draw(); };
          const step = x => { const nx = M.states[cur].t[M.x ? x : 0]; hist.push(M.states[cur].n); cur = nx; stat('fsm', 1, 'max'); draw(); };
          b.querySelector('#c0').onclick = () => step(0); const c1 = b.querySelector('#c1'); if (c1) c1.onclick = () => step(1);
          b.querySelector('#cr').onclick = () => { cur = 0; hist = []; draw(); };
          b.querySelectorAll('select[data-t]').forEach(x => { x.onchange = () => { const st = M.states[+x.dataset.t]; st.t[+x.dataset.k] = +x.value; if (!M.x) st.t[1] = st.t[0]; draw(); }; });
          b.querySelectorAll('input[data-n]').forEach(x => { x.onchange = () => { M.states[+x.dataset.n].n = x.value.trim() || 'S' + x.dataset.n; draw(); }; });
          b.querySelectorAll('input[data-o]').forEach(x => { x.onchange = () => { M.states[+x.dataset.o].o[+x.dataset.j] = x.checked ? 1 : 0; draw(); }; });
          b.querySelector('#fa').onclick = () => { M.states.push({ n: 'S' + M.states.length, o: M.outs.map(() => 0), t: [0, 0] }); draw(); };
          b.querySelector('#fd').onclick = () => { const k = M.states.length - 1; M.states.pop(); M.states.forEach(s => { s.t = s.t.map(v => (v >= k ? 0 : v)); }); if (cur >= M.states.length) cur = 0; draw(); };
          b.querySelector('#fr').onchange = e => { reset = e.target.checked; };
          b.querySelector('#fb').onclick = () => {
            const sp = fsmSpec(M, reset);
            close(); build(sp, 'Zustandsautomat', 'Schaltung gebaut. Lege X und R mit den Schaltern fest und beobachte den Takt (1 Hz).'); stat('synth', 1, 'max');
          };
        };
        draw();
      });
    }

    /* ================= Fehler-Würfel für Gatterschaltungen ================= */
    const GATES = ['AND', 'NAND', 'OR', 'NOR', 'XOR'];
    const SWAP = { AND: ['NAND', 'OR', 'XOR'], NAND: ['AND', 'NOR'], OR: ['NOR', 'AND', 'XOR'], NOR: ['OR', 'NAND'], XOR: ['OR', 'AND'] };
    const gateParts = () => api.sch.parts.filter(p => GATES.includes(p.k));
    const gname = (p, i) => (p.l ? p.l : p.k + ' ' + (i + 1)) + ' (' + p.k + ')';
    function rollGate() {
      if (api.simMode) { api.toast('Zum Würfeln zurück in den Zeichenmodus'); return; }
      const dc0 = api.sch.digiDice; if (dc0 && !dc0.solved) fixGate(true);
      const gs = gateParts(); if (gs.length < 2) { api.toast('Zu wenige Gatter. Lade ein Beispiel (zum Beispiel Volladdierer) und würfle dann.'); return; }
      const p = gs[Math.floor(Math.random() * gs.length)], opts = SWAP[p.k], to = opts[Math.floor(Math.random() * opts.length)];
      api.sch.digiDice = { id: p.id, orig: p.k, now: to, tries: 0, solved: false, msg: '' }; p.k = to;
      api.commit(true, true); api.rebuild && api.rebuild(); api.refreshUI(); api.draw(); api.toast('🎲 Gewürfelt: Ein Gatter ist vertauscht. Prüfe mit der Wahrheitstabelle und finde es.');
    }
    function fixGate(silent) {
      const dc = api.sch.digiDice; if (!dc) return; const p = api.sch.parts.find(q => q.id === dc.id); if (p) p.k = dc.orig; delete api.sch.digiDice;
      if (!silent) { api.commit(true, true); api.rebuild && api.rebuild(); api.refreshUI(); api.draw(); api.toast('Fehler behoben'); }
    }
    function reportGate() {
      const dc = api.sch.digiDice; if (!dc) return; const gs = gateParts();
      sheet('Welches Gatter ist falsch?', (b, close) => {
        b.innerHTML = '<p class="hint2" style="margin-top:0">Vergleiche die Wahrheitstabelle mit dem, was du erwartest. Welches Gatter hat die falsche Funktion? Wähle es aus und sage, was es eigentlich sein müsste.</p><label class="hint2">Gatter<select id="rg" style="width:100%;padding:6px;margin:4px 0">' + gs.map((p, i) => `<option value="${p.id}">${esc(gname(p, i))} bei x=${p.x}, y=${p.y}</option>`).join('') + '</select></label><label class="hint2">Es müsste sein<select id="rk" style="width:100%;padding:6px;margin:4px 0">' + GATES.map(g => `<option>${g}</option>`).join('') + '</select></label><div class="btns"><button class="btn pri" id="rb">Melden</button></div><div id="rm" class="hint2"></div>';
        b.querySelector('#rb').onclick = () => {
          const id = +b.querySelector('#rg').value, k = b.querySelector('#rk').value; dc.tries++;
          const m = b.querySelector('#rm'); m.style.color = '#ffb340';
          if (id === dc.id && k === dc.orig) { dc.solved = true; dc.msg = '🎉 Gefunden nach ' + dc.tries + (dc.tries === 1 ? ' Versuch' : ' Versuchen') + ': Das Gatter war ein ' + dc.now + ' statt ' + dc.orig + '.'; fixGate(false); close(); api.toast(dc.msg); try { const dn = JSON.parse(localStorage.getItem('sim.done') || '{}'); dn['ddice'] = Math.max(dn['ddice'] || 0, Math.max(30, 100 - 20 * (dc.tries - 1))); localStorage.setItem('sim.done', JSON.stringify(dn)); } catch (e) {} stat('digiDice', 1); if (root.Badges) { root.Badges.confetti && root.Badges.confetti(false); } }
          else if (id === dc.id) { m.textContent = 'Das Gatter stimmt, aber die Funktion nicht. Vergleiche die Wahrheitstabelle Zeile für Zeile. (Versuch ' + dc.tries + ')'; }
          else { m.textContent = 'Dieses Gatter ist in Ordnung. Suche weiter. (Versuch ' + dc.tries + ')'; }
        };
      });
    }
    function cardHtml() {
      const dc = api.sch.digiDice;
      return '<div class="card"><h4>Fehler-Würfel</h4>' + (dc && !dc.solved ? '<p class="hint2" style="margin:0 0 6px">In der Schaltung ist ein Gatter vertauscht. Öffne die Wahrheitstabelle und vergleiche mit dem Erwarteten.</p><div class="row2"><button class="btn pri" data-a="gdr">Fehler melden</button></div><div class="row2"><button class="btn" data-a="gdv">Auflösung zeigen</button><button class="btn" data-a="gdw">Neu würfeln</button></div>' : '<p class="hint2" style="margin:0 0 6px">Würfelt ein Gatter in der Schaltung um. Finde es mit der Wahrheitstabelle.</p><div class="row2"><button class="btn" data-a="gdw">🎲 Würfeln</button></div>') + '</div>';
    }
    function reveal() {
      const dc = api.sch.digiDice; if (!dc) return; const p = api.sch.parts.find(q => q.id === dc.id), i = gateParts().findIndex(q => q.id === dc.id);
      api.toast('Auflösung: ' + (p ? gname(p, i) : 'Gatter') + ' war eigentlich ein ' + dc.orig + '.'); fixGate(false);
    }
    return { openKV, openFSM, fsmSpec, fsmEqs, rollGate, reportGate, reveal, fixGate, cardHtml, FSM_T };
  };
  root.DIGI_PLUS.fsmSpec = fsmSpec; root.DIGI_PLUS.util = { minimize, covers, exprText, primesOf };
})(window);
