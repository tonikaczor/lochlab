'use strict';
/* Tonfunk Arbeitsschutz-Lab: Visualisierungen (arbviz.js, wird NACH arbui.js eingebunden).
   Reine SVG/HTML-Funktionen (ARB_VIZ.*, in Node testbar) plus kleine Anbindung an die Reiter:
   Zeichen: Formen-Landkarte; Brandschutz: Verbrennungsdreieck und Löschmittel-Matrix; Gefährdungsbeurteilung: Beispiel-Risikomatrix
   und STOP-Treppe mit Bilanz deiner Auswahl; PSA: Figur, an der die gewählte Schutzausrüstung aufleuchtet.
   Nichts davon zeigt, welche Antwort einer Aufgabe richtig ist: die Figur und die Bilanz spiegeln nur die eigene Auswahl,
   die Matrix stammt aus den Daten des Reiters. Im Prüfmodus entfällt die Bilanz. Aufgaben-Reiter bleiben unverändert. */
(function (root) {
  const N = v => (isFinite(v) ? Math.round(v * 10) / 10 : 0);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const V = {};
  const STOPC = { S: '#1a7f4b', T: '#1a6fd4', O: '#9a5b00', P: '#a33a3a' };   /* wie das STOP-Bild im Reiter */

  const STYLE = '.vz svg{display:block;width:100%;height:auto;max-width:440px;margin:0 auto}.vz svg text{font-family:system-ui,sans-serif;fill:var(--fg)}.vz .m{fill:var(--mute)!important}'
    + '.vz .cap{margin:6px 0 0;font-size:13px;color:var(--mute);line-height:1.4}'
    + '.vz .kg{display:grid;grid-template-columns:repeat(auto-fit,minmax(104px,1fr));gap:8px}.vz .kg button{display:flex;flex-direction:column;align-items:center;gap:4px;min-height:96px;padding:8px 4px;border-radius:12px;background:var(--panel2);border:1px solid var(--line);color:var(--fg);font-size:13px;font-weight:600;text-align:center}.vz .kg small{font-weight:400;color:var(--mute);font-size:12px}'
    + '.vz .rm{display:grid;grid-template-columns:34px repeat(3,1fr);gap:6px;align-items:stretch}.vz .rm .ax{font-size:12px;color:var(--mute);display:flex;align-items:center;justify-content:center;text-align:center}.vz .rm .ax.v{writing-mode:vertical-rl;transform:rotate(180deg)}'
    + '.vz .rm button{min-height:56px;border-radius:10px;border:2px solid transparent;font-size:12.5px;font-weight:700;color:var(--fg);padding:2px 4px;line-height:1.2}'
    + '.vz .rm button.r1{background:var(--ok);background:color-mix(in srgb,var(--ok) 38%,var(--panel))}.vz .rm button.r2{background:var(--warn);background:color-mix(in srgb,var(--warn) 42%,var(--panel))}.vz .rm button.r3{background:var(--danger);background:color-mix(in srgb,var(--danger) 45%,var(--panel))}'
    + '.vz .rm button.on{border-color:var(--fg);box-shadow:0 0 0 2px var(--bg) inset}.vz .rm .hd{font-size:11.5px;color:var(--mute);text-align:center;display:flex;align-items:flex-end;justify-content:center;padding-bottom:2px;line-height:1.2}';

  /* ---------- Formen-Landkarte (Sicherheitszeichen) ---------- */
  V.shape = function (kat) {
    const red = '#d12b2b', blue = '#1a6fd4', yel = '#f2c500', grn = '#1a8a4a', k = '#1b1b1b';
    const o = { verbot: `<circle cx="28" cy="28" r="22" style="fill:#fff;stroke:${red};stroke-width:6"/><line x1="13" y1="43" x2="43" y2="13" style="stroke:${red};stroke-width:6"/>`,
      gebot: `<circle cx="28" cy="28" r="23" style="fill:${blue}"/><rect x="25.5" y="12" width="5" height="21" rx="2" style="fill:#fff"/><circle cx="28" cy="40" r="3.2" style="fill:#fff"/>`,
      warnung: `<path d="M28 6L51 47H5Z" style="fill:${yel};stroke:${k};stroke-width:3.5;stroke-linejoin:round"/><rect x="26" y="19" width="4" height="15" style="fill:${k}"/><circle cx="28" cy="40" r="2.6" style="fill:${k}"/>`,
      rettung: `<rect x="5" y="5" width="46" height="46" rx="4" style="fill:${grn}"/><path d="M28 13v30M13 28h30" style="stroke:#fff;stroke-width:9"/>`,
      brand: `<rect x="5" y="5" width="46" height="46" rx="4" style="fill:${red}"/><rect x="21" y="25" width="14" height="22" rx="5" style="fill:#fff"/><rect x="25" y="18" width="6" height="8" style="fill:#fff"/><path d="M31 20h8M38 20l4 9" style="fill:none;stroke:#fff;stroke-width:3;stroke-linecap:round"/>` };
    return `<svg viewBox="0 0 56 56" width="56" height="56" aria-hidden="true">${o[kat] || ''}</svg>`;
  };
  V.katNames = { verbot: ['Verbot', 'rund'], gebot: ['Gebot', 'rund'], warnung: ['Warnung', 'dreieckig'], rettung: ['Rettung', 'quadratisch'], brand: ['Brandschutz', 'quadratisch'] };
  V.kartenHtml = function (kat) {
    return '<div class="kg">' + Object.keys(V.katNames).filter(k => !kat || kat[k]).map(k => `<button data-kt="${k}" aria-label="${esc(V.katNames[k][0])}, ${esc(V.katNames[k][1])}, zur Erklärung springen">${V.shape(k)}<span>${esc(V.katNames[k][0])}</span><small>${esc(V.katNames[k][1])}</small></button>`).join('') + '</div>';
  };

  /* ---------- Verbrennungsdreieck ---------- */
  /* off: null | 'b' | 'o' | 'z' (welche Ecke weggenommen ist) */
  V.dreieck = function (off) {
    const A = [100, 34], B = [38, 138], Cc = [162, 138];   /* Brennstoff oben, Sauerstoff links, Zündenergie rechts */
    const e = (p, q, gone) => `<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" style="stroke:${gone ? 'var(--danger)' : 'var(--fg)'};stroke-width:${gone ? 2 : 3};stroke-linecap:round${gone ? ';stroke-dasharray:3 7' : ''}"/>`;
    let g = e(A, B, off === 'b' || off === 'o') + e(B, Cc, off === 'o' || off === 'z') + e(Cc, A, off === 'z' || off === 'b');
    const dot = (p, key, t1) => `<circle cx="${p[0]}" cy="${p[1]}" r="9" style="fill:${off === key ? 'var(--panel2)' : 'var(--accent-bg)'};stroke:${off === key ? 'var(--danger)' : 'none'};stroke-width:2"/>`
      + `<text x="${p[0]}" y="${N(p[1] + (p === A ? -15 : 24))}" font-size="12" font-weight="700" text-anchor="middle" style="${off === key ? 'fill:var(--mute)' : ''}">${t1}</text>`;
    g += dot(A, 'b', 'Brennstoff') + dot(B, 'o', 'Sauerstoff') + dot(Cc, 'z', 'Zündenergie');
    if (!off) g += '<path d="M100 68c8 14 22 22 22 40a22 22 0 0 1-44 0c0-9 4-14 9-19 0 7 4 10 7 10-1-13-3-22 6-31z" style="fill:var(--hi);stroke:var(--fg);stroke-width:1.5"/>';
    else g += '<path d="M100 68c8 14 22 22 22 40a22 22 0 0 1-44 0c0-9 4-14 9-19 0 7 4 10 7 10-1-13-3-22 6-31z" style="fill:none;stroke:var(--mute);stroke-width:1.5;stroke-dasharray:4 4"/>';
    return `<svg viewBox="0 0 200 172" role="img" aria-label="Verbrennungsdreieck: Brennstoff, Sauerstoff und Zündenergie">${g}</svg>`;
  };
  V.dreieckText = function (off) {
    return { b: 'Brennstoff entfernen, zum Beispiel die Gaszufuhr absperren oder brennbares Material wegräumen.', o: 'Sauerstoff entziehen (Ersticken), zum Beispiel mit einer Löschdecke oder mit Schaum.', z: 'Energie entziehen (Abkühlen), zum Beispiel mit Wasser.' }[off]
      || 'Ein Feuer braucht alle drei Ecken: Brennstoff, Sauerstoff und genug Zündenergie. Tippe eine Ecke an, die du wegnimmst.';
  };

  /* ---------- Löschmittel-Matrix ---------- */
  /* cols: ['A','B',...,'strom'], rows: [{name, vals:{A:'ja'|'bed'|'nein'}}], sel: Spaltenschlüssel */
  V.matrix = function (cols, rows, sel) {
    const x0 = 112, cw = 40, rh = 34, y0 = 34, W = x0 + cols.length * cw + 8, H = y0 + rows.length * rh + 40;
    let g = '';
    cols.forEach((c, i) => {
      const x = x0 + i * cw;
      if (c === sel) g += `<rect x="${x + 1}" y="2" width="${cw - 2}" height="${y0 + rows.length * rh - 2}" rx="6" style="fill:var(--accent);fill-opacity:.14;stroke:var(--accent);stroke-width:2"/>`;
      g += `<text x="${N(x + cw / 2)}" y="24" font-size="13" font-weight="700" text-anchor="middle">${c === 'strom' ? '⚡' : esc(c)}</text>`;
    });
    rows.forEach((r, j) => {
      const y = y0 + j * rh;
      g += `<text x="6" y="${N(y + rh / 2 + 4)}" font-size="12">${esc(r.name)}</text><line x1="4" y1="${y + rh}" x2="${W - 4}" y2="${y + rh}" style="stroke:var(--line)"/>`;
      cols.forEach((c, i) => {
        const v = r.vals[c], cx = x0 + i * cw + cw / 2, cy = y + rh / 2;
        const col = v === 'ja' ? 'var(--ok)' : v === 'bed' ? 'var(--warn)' : 'var(--danger)';
        g += `<circle cx="${N(cx)}" cy="${N(cy)}" r="11" style="fill:${col};fill-opacity:.22;stroke:${col};stroke-width:1.6"/>`
          + (v === 'ja' ? `<path d="M${N(cx - 5)} ${N(cy)}l4 4 7-8" style="fill:none;stroke:${col};stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round"/>`
            : v === 'bed' ? `<text x="${N(cx)}" y="${N(cy + 5)}" font-size="14" font-weight="800" text-anchor="middle" style="fill:${col}">!</text>`
              : `<path d="M${N(cx - 4.5)} ${N(cy - 4.5)}l9 9M${N(cx + 4.5)} ${N(cy - 4.5)}l-9 9" style="fill:none;stroke:${col};stroke-width:2.4;stroke-linecap:round"/>`);
      });
    });
    g += `<text x="6" y="${H - 20}" font-size="11" class="m">✓ geeignet   ! nur bedingt   ✕ ungeeignet</text><text x="6" y="${H - 6}" font-size="11" class="m">⚡ elektrische Anlage unter Spannung</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Matrix: welches Löschmittel für welche Brandklasse geeignet ist">${g}</svg>`;
  };

  /* ---------- Beispiel-Risikomatrix ---------- */
  V.SW = ['gering', 'mittel', 'schwer'];
  V.WS = ['unwahrscheinlich', 'möglich', 'wahrscheinlich'];
  V.riskLevel = (s, w) => { const p = s * w; return p <= 2 ? 1 : p <= 4 ? 2 : 3; };
  V.RNAME = ['', 'niedrig', 'mittel', 'hoch'];
  V.RTEXT = ['', 'Gefährdung im Blick behalten, vorhandene Maßnahmen beibehalten.', 'Maßnahmen festlegen und zeitnah umsetzen.', 'Sofort handeln: ohne wirksame Maßnahmen nicht arbeiten.'];
  V.riskHtml = function (sel) {
    let h = '<div class="rm"><span></span><span class="hd">Schaden gering</span><span class="hd">Schaden mittel</span><span class="hd">Schaden schwer</span>';
    for (let w = 3; w >= 1; w--) {
      h += `<span class="ax v" style="grid-column:1">${esc(V.WS[w - 1])}</span>`;
      for (let s = 1; s <= 3; s++) { const r = V.riskLevel(s, w), on = sel && sel.s === s && sel.w === w; h += `<button class="r${r}${on ? ' on' : ''}" data-rs="${s}" data-rw="${w}" aria-pressed="${on}" aria-label="Schaden ${esc(V.SW[s - 1])}, ${esc(V.WS[w - 1])}: Risiko ${V.RNAME[r]}">${V.RNAME[r]}</button>`; }
    }
    return h + '</div>';
  };

  /* ---------- STOP-Treppe mit Bilanz ---------- */
  V.STOPN = { S: 'Substitution', T: 'Technisch', O: 'Organisatorisch', P: 'Persönlich (PSA)' };
  /* counts {S,T,O,P}: Anzahl der gewählten Maßnahmen je Stufe */
  V.treppe = function (counts) {
    counts = counts || {};
    let g = '<text x="8" y="14" font-size="11" class="m">wirksamer</text><path d="M62 10h24" style="stroke:var(--mute);stroke-width:1.5"/><polygon points="86,6 94,10 86,14" style="fill:var(--mute)"/>';
    ['S', 'T', 'O', 'P'].forEach((k, i) => {
      const x = 8 + i * 78, y = 26 + i * 30, h = 130 - i * 30, n = Math.min(+counts[k] || 0, 12);
      g += `<rect x="${x}" y="${y}" width="76" height="${h}" rx="6" style="fill:${STOPC[k]}"/>`
        + `<text x="${x + 38}" y="${y + 24}" font-size="20" font-weight="800" text-anchor="middle" style="fill:#fff">${k}</text>`
        + `<text x="${x + 38}" y="${y + 40}" font-size="10" text-anchor="middle" style="fill:#fff">${esc(V.STOPN[k])}</text>`;
      for (let j = 0; j < n; j++) g += `<circle cx="${x + 12 + (j % 5) * 13}" cy="${y + 56 + Math.floor(j / 5) * 14}" r="5" style="fill:#fff"/>`;
    });
    return `<svg viewBox="0 0 324 166" role="img" aria-label="STOP-Treppe: Substitution, Technische, Organisatorische, Persönliche Maßnahmen. Gewählt: S ${counts.S | 0}, T ${counts.T | 0}, O ${counts.O | 0}, P ${counts.P | 0}">${g}</svg>`;
  };

  /* ---------- PSA-Figur ---------- */
  V.PSAZ = ['kopf', 'augen', 'gehoer', 'atem', 'hand', 'chem', 'fuss', 'warn'];
  V.psa = function (sel) {
    sel = sel || [];
    const on = k => sel.indexOf(k) >= 0;
    const z = (k, shape, col) => shape.replace('/>', ` style="${on(k) ? `fill:${col};fill-opacity:.85;stroke:var(--fg);stroke-width:1.6` : 'fill:none;stroke:var(--mute);stroke-width:1.4;stroke-dasharray:3 3'}"/>`);
    let g = '<g style="fill:var(--panel2);stroke:var(--mute);stroke-width:1.5">'
      + '<circle cx="100" cy="40" r="22"/><rect x="92" y="60" width="16" height="8"/><rect x="62" y="66" width="76" height="94" rx="10"/><rect x="40" y="70" width="22" height="80" rx="9"/><rect x="138" y="70" width="22" height="80" rx="9"/>'
      + '<rect x="70" y="160" width="28" height="74" rx="6"/><rect x="102" y="160" width="28" height="74" rx="6"/></g>';
    g += z('warn', '<path d="M62 66H84L100 84L116 66H138V160H62Z"/>', 'var(--hi)');
    g += z('chem', '<rect x="40" y="134" width="22" height="28" rx="8"/>', 'var(--ok)') + z('chem', '<rect x="138" y="134" width="22" height="28" rx="8"/>', 'var(--ok)');
    g += z('hand', '<circle cx="51" cy="160" r="11"/>', 'var(--accent)') + z('hand', '<circle cx="149" cy="160" r="11"/>', 'var(--accent)');
    g += z('fuss', '<rect x="62" y="234" width="38" height="20" rx="6"/>', 'var(--accent)') + z('fuss', '<rect x="100" y="234" width="38" height="20" rx="6"/>', 'var(--accent)');
    g += z('kopf', '<path d="M74 40a26 26 0 0 1 52 0L130 44H70Z"/>', 'var(--hi)');
    g += z('augen', '<rect x="82" y="46" width="36" height="9" rx="4"/>', 'var(--accent)');
    g += z('gehoer', '<circle cx="74" cy="50" r="8"/>', 'var(--accent)') + z('gehoer', '<circle cx="126" cy="50" r="8"/>', 'var(--accent)');
    g += z('atem', '<ellipse cx="100" cy="60" rx="11" ry="6"/>', 'var(--ok)');
    if (on('warn')) g += '<g style="stroke:var(--fg);stroke-width:2;opacity:.6"><line x1="64" y1="112" x2="136" y2="112"/><line x1="64" y1="124" x2="136" y2="124"/></g>';
    return `<svg viewBox="0 0 200 262" style="max-width:260px" role="img" aria-label="Figur mit der gewählten Schutzausrüstung: ${sel.length} von 8 Teilen">${g}</svg>`;
  };

  root.ARB_VIZ = V;
  if (typeof module !== 'undefined' && module.exports) module.exports = V;
  if (typeof document === 'undefined' || !document.getElementById) return;

  /* ============================================================ Anbindung an die Seite */
  const C = root.ARB_CORE, D = root.ARB_DATA;
  if (!C || !D) return;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem('lm4.arb.' + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const st = document.createElement('style'); st.textContent = STYLE; document.head.appendChild(st);
  const card = (key, title, inner) => { const d = document.createElement('div'); d.className = 'card pl vz'; d.setAttribute('data-vz', key); d.innerHTML = `<h4>${title}</h4>${inner}`; return d; };

  const W = {
    karte: {
      view: 'zeiView', place: cs => [cs[0], 'after'], ok: () => true,
      make() {
        const n = card('karte', 'Form und Farbe: die fünf Gruppen', `<p class="hint2" style="margin:0 0 8px">Tippe eine Gruppe an, dann springst du zur Erklärung.</p>${V.kartenHtml(D.kat)}`);
        n.addEventListener('click', e => {
          const b = e.target.closest('[data-kt]'); if (!b) return; const K = D.kat[b.dataset.kt]; if (!K) return;
          const h = $$('.card.pl > h4', $('#zeiView')).find(x => x.textContent === K.name); if (h) h.scrollIntoView({ block: 'start' });
        });
        return n;
      },
      upd() { }
    },
    dreieck: {
      view: 'braView', place: cs => [cs[0], 'before'], ok: () => true, off: null,
      make() {
        const self = this, n = card('dreieck', 'Wie brennt es? Das Verbrennungsdreieck',
          `<div class="inst fit" data-b="1"></div><div class="ctl" role="group" aria-label="Ecke wegnehmen"><button class="chip" data-o="b" aria-pressed="false">Brennstoff weg</button><button class="chip" data-o="o" aria-pressed="false">Sauerstoff weg</button><button class="chip" data-o="z" aria-pressed="false">Energie weg</button></div><p class="cap" data-c="1"></p>`);
        n.addEventListener('click', e => { const b = e.target.closest('[data-o]'); if (!b) return; self.off = self.off === b.dataset.o ? null : b.dataset.o; self.upd(n); });
        return n;
      },
      upd(n) {
        $('[data-b]', n).innerHTML = V.dreieck(this.off); $('[data-c]', n).textContent = V.dreieckText(this.off);
        $$('[data-o]', n).forEach(b => { const on = b.dataset.o === this.off; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
      }
    },
    matrix: {
      view: 'braView', place: cs => [cs[1], 'after'], ok: () => true,
      make() { return card('matrix', 'Überblick: Löschmittel und Brandklassen', '<div class="inst fit" data-b="1"></div><p class="cap">Die gewählte Brandklasse ist hervorgehoben. Wähle sie oben mit den Schaltflächen.</p>'); },
      upd(n) {
        const on = $('[data-bk].on'), sel = on ? on.dataset.bk : null, cols = D.brand.map(b => b.k).concat(['strom']);
        const rows = D.mittel.map(m => { const vals = {}; cols.forEach(k => { vals[k] = C.loeschOk(m.id, k); }); return { name: m.name, vals }; });
        $('[data-b]', n).innerHTML = V.matrix(cols, rows, sel);
      }
    },
    risiko: {
      view: 'gbView', place: cs => [cs[0], 'after'], ok: () => true, sel: { s: 2, w: 2 },
      make() {
        const self = this, n = card('risiko', 'Risiko einschätzen: Beispielmatrix',
          '<p class="hint2" style="margin:0 0 8px">Beim Beurteilen fragst du: Wie schwer kann der Schaden sein? Wie wahrscheinlich ist er? Tippe ein Feld an.</p><div data-b="1"></div><div class="rdout" data-c="1" style="margin-top:10px"></div><p class="cap">Beispielmatrix zum Üben. Jeder Betrieb legt seine eigene Bewertung fest.</p>');
        n.addEventListener('click', e => { const b = e.target.closest('[data-rs]'); if (!b) return; self.sel = { s: +b.dataset.rs, w: +b.dataset.rw }; self.upd(n); });
        return n;
      },
      upd(n) {
        $('[data-b]', n).innerHTML = V.riskHtml(this.sel); const r = V.riskLevel(this.sel.s, this.sel.w);
        $('[data-c]', n).innerHTML = `<b>Risiko: ${V.RNAME[r]}</b>. Schaden ${V.SW[this.sel.s - 1]}, ${V.WS[this.sel.w - 1]}. ${V.RTEXT[r]} Maßnahmen immer in der STOP-Reihenfolge wählen.`;
      }
    },
    treppe: {
      view: 'gbView', place: cs => [cs[2], 'before'], ok: () => lsGet('exam', '0') !== '1',
      make() { return card('treppe', 'STOP-Treppe: Deine Auswahl in der Mini-Gefährdungsbeurteilung', '<div class="inst fit" data-b="1"></div><p class="cap">Die Punkte zählen, wie viele Maßnahmen du je Stufe unten angetippt hast. Je weiter oben die Stufe, desto wirksamer.</p>'); },
      upd(n) {
        const c = { S: 0, T: 0, O: 0, P: 0 };
        $$('.gbed [data-go].on .stp').forEach(s => { const k = s.textContent.trim(); if (k in c) c[k]++; });
        $('[data-b]', n).innerHTML = V.treppe(c);
      }
    },
    psa: {
      view: 'psaView', place: cs => [cs[0], 'after'], ok: () => true,
      make() { return card('psa', 'Deine Schutzausrüstung', '<div class="inst" data-b="1" style="padding:8px"></div><p class="cap" data-c="1"></p>'); },
      upd(n) {
        const sel = $$('[data-pi][aria-pressed="true"]').map(b => b.dataset.pi);
        $('[data-b]', n).innerHTML = V.psa(sel);
        $('[data-c]', n).textContent = sel.length ? 'Gewählt: ' + sel.map(k => D.psaItems[k]).join(', ') + '.' : 'Wähle oben Schutzmittel. Hier siehst du, wo sie getragen werden. Gestrichelt ist noch frei.';
      }
    }
  };

  function sync(key) {
    const w = W[key], host = document.getElementById(w.view); if (!host) return;
    let n = host.querySelector(':scope > [data-vz="' + key + '"]');
    const cs = [...host.querySelectorAll(':scope > .card:not(.vz)')];
    if (!cs.length || !w.ok()) { if (n) n.remove(); return; }
    if (!n) {
      n = w.make(host); const p = w.place(cs);
      if (p[0]) (p[1] === 'after' ? p[0].after(n) : p[0].before(n)); else host.appendChild(n);
    }
    w.upd(n);
  }
  Object.keys(W).forEach(key => {
    const host = document.getElementById(W[key].view); if (!host) return;
    new MutationObserver(() => sync(key)).observe(host, { childList: true });
    ['input', 'change', 'click'].forEach(ev => host.addEventListener(ev, e => { if (!e.target.closest('.vz')) sync(key); }));
    sync(key);
  });
})(typeof window !== 'undefined' ? window : globalThis);
