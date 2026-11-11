'use strict';
/* Tonfunk IT-Sicherheits-Lab: Oberfläche (Lab-Kennung 'its').
   Reiter: Passwörter, Verschlüsseln, Rechte & Firewall, Backup & Verfügbarkeit, Beispiele, Aufgaben, Trainer, Hilfe.
   Module: itscore.js (ITS_CORE, Logik), itsdata.js (ITS_DATA, ITS_TASKS).
   Speicher (Präfix lm4.its.): tab, done ({id:true} nur gelöste), prog ({id:Prozent}), hints ({id:höchste Stufe}), ctipps ({id:Stufe} nur im Prüfmodus),
   exam ('1' = Prüfmodus), rt (Trainer: n, ok, streak, best).
   Tipp-Abzug (25 % je Stufe) gibt es nur im Prüfmodus; beim normalen Üben kosten Tipps nichts.
   Aufgabenarten: Zahl, Text, eine Antwort wählen, mehrere markieren, Zeilen zuordnen. Alles läuft im Browser, ohne Server. */
(function (root) {
  const C = root.ITS_CORE, D = root.ITS_DATA;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.its.';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(LS + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} };
  const dots = l => '●'.repeat(l || 1) + '○'.repeat(3 - (l || 1));
  const fx = () => root.LochFX || null;
  const ding = () => { const F = fx(); if (F && F.sound) try { F.sound('ding', 0.6); } catch (e) {} };
  const sad = () => { const F = fx(); if (F && F.sound) try { F.sound('sad', 0.5); } catch (e) {} };
  const fmt = C && C.fmt;

  function toast(m) { const t = $('#toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), Math.max(2200, m.length * 55)); }
  function sheet(title, build) {
    const bd = document.createElement('div'); bd.className = 'backdrop';
    bd.innerHTML = `<div class="sheet" role="dialog" aria-label="${esc(title)}"><div class="sh-h"><b>${esc(title)}</b><button class="x" aria-label="Schließen">✕</button></div><div class="sh-b"></div></div>`;
    document.body.appendChild(bd);
    const close = () => bd.remove();
    bd.addEventListener('pointerdown', e => { if (e.target === bd) close(); });
    $('.x', bd).onclick = close; build($('.sh-b', bd), close); return close;
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { const b = $$('.backdrop'); if (b.length) b[b.length - 1].remove(); } });

  if (!C || !D) {
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>IT-Sicherheits-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">itscore.js oder itsdata.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks;

  /* ============================================================ Zustand */
  const TABS = [['pw', '🔑', 'Passwörter'], ['kry', '🔐', 'Verschlüsseln'], ['net', '🛡️', 'Rechte & Firewall'], ['bak', '💾', 'Backup & Verfügbarkeit'], ['bsp', '💡', 'Beispiele'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['help', '📘', 'Hilfe']];
  const S = {
    tab: lsGet('tab', 'pw'),
    pw: { sets: ['klein', 'ziff'], L: '8', rate: '1000000000', W: '7776', k: '5' },
    kry: { mode: 'caesar', dir: 'enc', text: 'NETZWERK', key: '3', a: '01001000', b: '10110101' },
    net: { perm: 'rw-r-----', oct: '750', proto: 'tcp', src: '203.0.113.7', dst: '192.168.10.80', port: '443' },
    bak: { type: 'inc', F: '200', c: '10', days: '4', gb: '600', mbs: '200', pct: '99,9', comb: 'serial', a: '99', b: '98' },
    task: null, tAns: {}, tRes: null, seeds: {}, inst: {},
    tr: { cat: 'alle', level: 0, p: null, ans: null, res: null },
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {}))
  };

  /* ============================================================ kleine HTML-Bausteine */
  const stp = (steps, last) => '<ol class="stp">' + steps.map((s, i) => `<li${last && i === steps.length - 1 ? ' class="res"' : ''}>${esc(s)}</li>`).join('') + '</ol>';
  const inp = (key, label, val, extra) => `<label class="f"><span>${esc(label)}</span><input inputmode="decimal" autocomplete="off" data-s="${key}" value="${esc(val)}" ${extra || ''}></label>`;
  const txt = (key, label, val, extra) => `<label class="f"><span>${esc(label)}</span><input autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" data-s="${key}" value="${esc(val)}" ${extra || ''}></label>`;
  const seg = (key, items, cur) => `<div class="seg" role="group">${items.map(([k, l]) => `<button data-seg="${key}" data-v="${k}" class="${String(cur) === String(k) ? 'on' : ''}" aria-pressed="${String(cur) === String(k)}">${l}</button>`).join('')}</div>`;
  const sel = (key, opts, cur, re) => `<select data-s="${key}"${re ? ' data-r="1"' : ''}>${opts.map(o => `<option value="${esc(o[0])}"${o[0] === cur ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
  const hint = m => `<p class="hint2">${esc(m)}</p>`;
  const num = s => C.parseDe(s);
  const bin4 = b => b.length === 8 ? b.slice(0, 4) + ' ' + b.slice(4) : b;

  /* Tabelle (Regeln, Matrix, Pakete); sel = Zeilenindex mit Hervorhebung */
  function tableHTML(b, selRow) {
    return `<div class="tscroll">${b.title ? `<div class="cap">${esc(b.title)}</div>` : ''}<table class="tt"><tr>${b.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr>${b.rows.map((r, i) => `<tr${i === selRow ? ' class="sel"' : ''}>${r.map((c, j) => `<td>${j === 0 && b.head[0] === '' ? '<b>' + esc(c) + '</b>' : esc(c)}</td>`).join('')}</tr>`).join('')}</table></div>`;
  }
  function mailHTML(m) {
    return `<div class="mail"><div class="mh"><div><b>Von:</b> ${esc(m.from)}</div><div><b>Betreff:</b> ${esc(m.subj)}</div></div>${m.body.map(p => `<p>${esc(p)}</p>`).join('')}${m.link ? `<span class="lk">${esc(m.linkText)}<small>Link-Ziel: ${esc(m.link)}</small></span>` : ''}</div>`;
  }
  const showHTML = show => !show ? '' : show.map(b => b.type === 'mail' ? mailHTML(b) : b.type === 'table' ? tableHTML(b) : `<div class="mono">${esc(b.text)}</div>`).join('');

  /* ============================================================ Reiter: Passwörter */
  const RATES = [['1000', '1 000 pro Sekunde (Anmeldeformular mit Bremse)'], ['1000000', '1 Million pro Sekunde (einfacher Rechner)'], ['1000000000', '1 Milliarde pro Sekunde (Rechner mit Grafikkarten)'], ['10000000000', '10 Milliarden pro Sekunde'], ['1000000000000', '1 Billion pro Sekunde (großes Rechenzentrum)']];   /* PRUEFEN: die Raten sind Größenordnungen zur Anschauung, keine Messwerte. Passen die Beschreibungen zum Unterricht? */
  function renderPw() {
    const E = S.pw;
    $('#v_pw').innerHTML = `<div class="card pl"><h4>Passwort-Stärke: Entropie und Brute-Force-Zeit</h4>
      <p class="hint2" style="margin:0 0 6px">Wähle die erlaubten Zeichengruppen. Gerechnet wird mit einem zufällig gewählten Passwort: Jede Stelle wird gleich wahrscheinlich aus dem Zeichenvorrat gezogen.</p>
      <div class="cf">${C.CHARSETS.map(c => `<button class="chip${E.sets.includes(c.k) ? ' on' : ''}" data-set="${c.k}" aria-pressed="${E.sets.includes(c.k)}">${esc(c.name)}</button>`).join('')}</div>
      <div class="two">${inp('pw.L', 'Länge L (Zeichen)', E.L)}<label class="f"><span>Versuche pro Sekunde</span>${sel('pw.rate', RATES, E.rate)}</label></div><div id="pOut"></div></div>
      <div class="card pl"><h4>Passphrase aus zufälligen Wörtern</h4><div class="two">${inp('pw.W', 'Wörter in der Liste', E.W)}${inp('pw.k', 'Anzahl Wörter', E.k)}</div><div id="qOut"></div></div>`;
    updPw();
  }
  function updPw() {
    const E = S.pw, N = C.poolSize(E.sets), L = num(E.L), po = $('#pOut'); let h;
    if (!N) h = hint('Wähle mindestens eine Zeichengruppe.');
    else if (!isFinite(L) || L !== Math.floor(L) || L < 1 || L > 64) h = hint('Bitte gib eine ganze Länge zwischen 1 und 64 ein.');
    else {
      const e = C.entropy(N, L), b = C.brute(N, L, +E.rate);
      h = `<div class="big2">${esc(fmt(C.rd(e.bits, 1), 1))} Bit <small>Entropie bei Zeichenvorrat N = ${N}</small></div>${stp(e.steps)}
        <div class="rdout"><b>Höchstdauer</b> (alle Möglichkeiten): ${esc(C.humanTime(b.seconds))}<br><b>Im Mittel</b> (halber Suchraum): ${esc(C.humanTime(b.avgSeconds))}</div>${stp(b.steps.slice(0, 2))}
        <p class="hint2">Jedes zusätzliche Bit verdoppelt die Zahl der Möglichkeiten und damit die Zeit. Eine Stelle mehr multipliziert sie mit N.</p>`;
    }
    po.innerHTML = h;
    const W = num(E.W), k = num(E.k), q = $('#qOut');
    q.innerHTML = isFinite(W) && isFinite(k) && W >= 2 && k >= 1 && k <= 30 && k === Math.floor(k) && W === Math.floor(W) ? (() => { const p = C.passphrase(W, k); return `<div class="big2">${esc(fmt(C.rd(p.bits, 1), 1))} Bit</div>${stp(p.steps)}`; })() : hint('Wörterzahl (mindestens 2) und Anzahl Wörter (1 bis 30) als ganze Zahlen eingeben.');
  }

  /* ============================================================ Reiter: Verschlüsseln */
  function renderKry() {
    const E = S.kry; let f;
    if (E.mode === 'caesar') f = `${txt('kry.text', 'Text', E.text)}${inp('kry.key', 'Schlüssel k (Verschiebung, ganze Zahl)', E.key)}`;
    else if (E.mode === 'vig') f = `${txt('kry.text', 'Text', E.text)}${txt('kry.key', 'Schlüsselwort (nur Buchstaben)', E.key)}`;
    else f = `<div class="two">${txt('kry.a', 'Bitfolge A (Klartext oder Geheimtext)', E.a, 'inputmode="numeric"')}${txt('kry.b', 'Bitfolge B (Schlüssel)', E.b, 'inputmode="numeric"')}</div>`;
    $('#v_kry').innerHTML = `<div class="card pl"><h4>Verschlüsseln von Hand nachrechnen</h4>${seg('kry.mode', [['caesar', 'Caesar'], ['vig', 'Vigenère'], ['xor', 'XOR']], E.mode)}
      ${E.mode === 'xor' ? '' : `<div style="margin:8px 0">${seg('kry.dir', [['enc', 'verschlüsseln'], ['dec', 'entschlüsseln']], E.dir)}</div>`}
      <div style="margin-top:8px">${f}</div><div id="kOut"></div></div>
      <div class="card pl"><h4>Merke</h4><p class="hint2" style="margin:0">Caesar und Vigenère sind historische Verfahren und heute nicht mehr sicher: Sie dienen zum Üben des Prinzips. Moderne Verfahren wie AES arbeiten ebenfalls mit einem Schlüssel, aber mit viel mehr Rechenschritten. XOR ist die Grundbausteinoperation vieler Verfahren: Zweimal mit demselben Schlüssel angewendet, ergibt es wieder den Klartext.</p></div>`;
    updKry();
  }
  function updKry() {
    const E = S.kry, dec = E.dir === 'dec'; let h;
    if (E.mode === 'caesar') {
      const k = num(E.key);
      h = !String(E.text).trim() ? hint('Bitte gib einen Text ein.') : (!isFinite(k) || k !== Math.floor(k)) ? hint('Der Schlüssel muss eine ganze Zahl sein (zum Beispiel 3).') : `<div class="big2">${esc(C.caesar(E.text, dec ? -k : k))}</div>${stp(C.caesarSteps(E.text, k, dec))}<p class="hint2">Umlaute und ß werden hier nicht verschoben (nur A bis Z).</p>`;
    } else if (E.mode === 'vig') {
      h = !String(E.text).trim() ? hint('Bitte gib einen Text ein.') : !C.keyShifts(E.key).length ? hint('Das Schlüsselwort braucht mindestens einen Buchstaben (A bis Z).') : `<div class="big2">${esc(C.vigenere(E.text, E.key, dec ? -1 : 1))}</div>${stp(C.vigenereSteps(E.text, E.key, dec))}`;
    } else {
      const x = C.xorSteps(E.a, E.b);
      h = !x ? hint('Beide Bitfolgen müssen gleich lang sein und nur aus 0 und 1 bestehen.') : `<div class="big2">${esc(bin4(x.result))}</div>${stp(x.steps)}<p class="hint2">Probe: Das Ergebnis noch einmal mit der Bitfolge B verknüpfen, dann kommt A wieder heraus.</p>`;
    }
    $('#kOut').innerHTML = h;
  }

  /* ============================================================ Reiter: Rechte und Firewall */
  function renderNet() {
    const E = S.net, p = E.perm, G = ['Besitzer', 'Gruppe', 'Andere'], L = ['r', 'w', 'x'];
    const chips = G.map((g, gi) => `<span class="gl">${g}</span>` + L.map((l, li) => { const i = gi * 3 + li, on = p[i] !== '-'; return `<button class="chip${on ? ' on' : ''}" data-pb="${i}" aria-pressed="${on}" aria-label="${g} ${['lesen', 'schreiben', 'ausführen'][li]}">${on ? l : '−'}</button>`; }).join('')).join('');
    $('#v_net').innerHTML = `<div class="card pl"><h4>Dateirechte (Linux): Zeichen und Oktalzahl</h4><p class="hint2" style="margin:0 0 4px">Tippe auf die Felder: r = lesen (4), w = schreiben (2), x = ausführen (1).</p>
      <div class="pbits">${chips}</div><div id="nOut"></div>
      <div class="two" style="margin-top:8px">${txt('net.oct', 'Oktalzahl eingeben (z. B. 750)', E.oct, 'inputmode="numeric"')}<div id="oOut" style="padding-top:20px"></div></div></div>
      <div class="card pl"><h4>Firewall-Regeln lesen: wird das Paket erlaubt?</h4><p class="hint2" style="margin:0 0 6px">Die Firewall geht die Regeln von oben nach unten durch. Die erste passende Regel entscheidet. Trifft keine zu, wird geblockt.</p>
      <div class="three"><label class="f"><span>Protokoll</span>${sel('net.proto', [['tcp', 'TCP'], ['udp', 'UDP']], E.proto)}</label>${txt('net.src', 'Quelle (IP)', E.src, 'inputmode="decimal"')}${txt('net.dst', 'Ziel (IP)', E.dst, 'inputmode="decimal"')}</div>
      <div class="two">${inp('net.port', 'Zielport', E.port)}<div></div></div><div id="fOut"></div></div>`;
    updNet();
  }
  function updNet() {
    const E = S.net, o = C.permToOctal(E.perm);
    $('#nOut').innerHTML = `<div class="big2">${esc(E.perm)} = ${o.octal}</div>${stp(o.steps)}`;
    const q = C.octalToPerm(E.oct); $('#oOut').innerHTML = q ? `<div class="big2" style="margin:0">${esc(q.perm)}</div>` : hint('Drei Ziffern von 0 bis 7.');
    const port = num(E.port), pk = { proto: E.proto, src: E.src.trim(), dst: E.dst.trim(), port }; let h;
    if (C.ipInt(pk.src) == null || C.ipInt(pk.dst) == null) h = hint('Bitte gib gültige IP-Adressen ein (vier Zahlen von 0 bis 255, mit Punkten).');
    else if (!isFinite(port) || port !== Math.floor(port) || port < 0 || port > 65535) h = hint('Der Port ist eine ganze Zahl von 0 bis 65535.');
    else {
      const e = C.fwEval(D.FW1, pk), tb = { title: 'Regeln (Beispiel-Firmennetz 192.168.10.0/24, Webserver 192.168.10.80)', head: ['Nr.', 'Aktion', 'Protokoll', 'Quelle', 'Ziel', 'Zielport'], rows: D.FW1.map((r, i) => [String(i + 1), r.action === 'allow' ? 'erlauben' : 'blocken', r.proto === '*' ? 'alle' : r.proto.toUpperCase(), r.src === '*' ? 'alle' : r.src, r.dst === '*' ? 'alle' : r.dst, r.port === '*' ? 'alle' : String(r.port)]) };
      h = `<div class="big2">${e.action === 'allow' ? '✓ Erlauben' : '✗ Blocken'} <small>${e.idx >= 0 ? 'nach Regel ' + (e.idx + 1) : 'keine Regel passt: Standard blocken'}</small></div>${tableHTML(tb, e.idx)}<p class="hint2">${esc(C.fwStep(D.FW1, pk, 0).replace(/^Paket 1 /, 'Paket '))}</p>`;
    }
    $('#fOut').innerHTML = h;
  }

  /* ============================================================ Reiter: Backup und Verfügbarkeit */
  function renderBak() {
    const E = S.bak;
    $('#v_bak').innerHTML = `<div class="card pl"><h4>Backup-Größe und Wiederherstellung</h4>${seg('bak.type', [['inc', 'inkrementell'], ['diff', 'differentiell']], E.type)}
      <p class="hint2">Eine Vollsicherung, danach täglich eine Sicherung. Angenommen: Jeden Tag ändern sich neue, bisher unveränderte Daten.</p>
      <div class="three">${inp('bak.F', 'Vollsicherung (GB)', E.F)}${inp('bak.c', 'Änderung pro Tag (GB)', E.c)}${inp('bak.days', 'Tage danach (1 bis 14)', E.days)}</div><div id="bOut"></div></div>
      <div class="card pl"><h4>Wiederherstellungszeit</h4><div class="two">${inp('bak.gb', 'Datenmenge (GB)', E.gb)}${inp('bak.mbs', 'Rate (MB/s)', E.mbs)}</div><div id="rOut"></div></div>
      <div class="card pl"><h4>Verfügbarkeit und Ausfallzeit</h4>${inp('bak.pct', 'Verfügbarkeit (%)', E.pct)}<div id="aOut"></div>
      <h4 style="margin-top:14px">Mehrere Komponenten</h4>${seg('bak.comb', [['serial', 'alle müssen laufen'], ['parallel', 'redundant: einer reicht']], E.comb)}
      <div class="two" style="margin-top:8px">${inp('bak.a', 'Komponente 1 (%)', E.a)}${inp('bak.b', 'Komponente 2 (%)', E.b)}</div><div id="cOut"></div></div>`;
    updBak();
  }
  function updBak() {
    const E = S.bak, F = num(E.F), c = num(E.c), d = num(E.days); let h;
    if (![F, c, d].every(isFinite) || F < 0 || c < 0 || d !== Math.floor(d) || d < 1 || d > 14) h = hint('Bitte gib die Größen als Zahlen ein, die Tage als ganze Zahl von 1 bis 14.');
    else {
      const p = C.backupPlan(E.type, F, Array(d).fill(c)), n = C.restoreSets(E.type, d), other = C.backupPlan(E.type === 'inc' ? 'diff' : 'inc', F, Array(d).fill(c));
      h = `<div class="big2">Gesamt ${esc(fmt(p.total))} GB <small>(${E.type === 'inc' ? 'inkrementell' : 'differentiell'}; zum Vergleich ${E.type === 'inc' ? 'differentiell' : 'inkrementell'}: ${esc(fmt(other.total))} GB)</small></div>${stp(p.steps)}<div class="rdout"><b>Wiederherstellung am Tag ${d}:</b> ${n} Sicherungen nötig (Vollsicherung eingerechnet).</div>`;
    }
    $('#bOut').innerHTML = h;
    const gb = num(E.gb), mb = num(E.mbs), m = C.restoreMinutes(gb, mb);
    $('#rOut').innerHTML = m == null ? hint('Datenmenge und Rate müssen größer als 0 sein.') : `<div class="big2">${esc(fmt(C.rd(m, 1), 1))} min <small>(etwa ${esc(fmt(C.rd(m / 60, 2), 2))} Stunden)</small></div>${stp([`${fmt(gb)} GB = ${fmt(gb * 1000)} MB (1 GB = 1000 MB)`, `${fmt(gb * 1000)} MB : ${fmt(mb)} MB/s = ${fmt(C.rd(gb * 1000 / mb, 1), 1)} s`, `${fmt(C.rd(gb * 1000 / mb, 1), 1)} s : 60 = ${fmt(C.rd(m, 1), 1)} min`])}<p class="hint2">Das ist nur das Zurückspielen. Die gesamte Wiederanlaufzeit (RTO) enthält auch Fehlersuche, Neuaufbau und Prüfung.</p>`;
    const pc = num(E.pct);
    $('#aOut').innerHTML = !isFinite(pc) || pc <= 0 || pc > 100 ? hint('Bitte gib eine Verfügbarkeit zwischen 0 und 100 Prozent ein.') : (() => { const h2 = C.downHours(pc); return `<div class="big2">${esc(fmt(C.rd(h2, 2), 2))} h <small>Ausfall pro Jahr (= ${esc(fmt(C.rd(h2 * 60, 1), 1))} min = ${esc(fmt(C.rd(h2 / 24, 2), 2))} Tage)</small></div>${stp([`Ein Jahr: 365 · 24 = ${C.HOURS_YEAR} Stunden`, `Ausfallanteil: 100 % − ${fmt(pc)} % = ${fmt(C.rs(100 - pc))} %`, `Ausfallzeit: ${C.HOURS_YEAR} h · ${fmt(C.rs(100 - pc))} / 100 = ${fmt(C.rd(h2, 2), 2)} h`])}`; })();
    const a = num(E.a), b = num(E.b);
    $('#cOut').innerHTML = ![a, b].every(x => isFinite(x) && x >= 0 && x <= 100) ? hint('Bitte gib beide Verfügbarkeiten zwischen 0 und 100 Prozent ein.') : E.comb === 'serial'
      ? `<div class="big2">${esc(fmt(C.rd(C.serial([a, b]), 4), 4))} %</div>${stp(['Beide müssen laufen: Anteile multiplizieren.', `${fmt(a / 100, 6)} · ${fmt(b / 100, 6)} = ${fmt(C.rd(C.serial([a, b]) / 100, 8), 8)}`, 'Das Ergebnis ist kleiner als jeder Einzelwert.'])}`
      : `<div class="big2">${esc(fmt(C.rd(C.parallel([a, b]), 4), 4))} %</div>${stp(['Der Dienst fällt nur aus, wenn beide ausfallen: Ausfallanteile multiplizieren.', `${fmt(C.rs(1 - a / 100), 6)} · ${fmt(C.rs(1 - b / 100), 6)} = ${fmt(C.rd((1 - a / 100) * (1 - b / 100), 8), 8)}`, `Verfügbarkeit = 1 − ${fmt(C.rd((1 - a / 100) * (1 - b / 100), 8), 8)} = ${fmt(C.rd(C.parallel([a, b]) / 100, 8), 8)}`, 'Das Ergebnis ist größer als jeder Einzelwert (Redundanz).'])}`;
  }

  /* ============================================================ Beispiele (Aufruf ?bsp) */
  const BSP = D.beispiele;
  function renderBsp() {
    $('#v_bsp').innerHTML = '<div class="card pl"><h4>Beispiele</h4><p class="hint2" style="margin:0">Fertig durchgerechnete Beispiele, Schritt für Schritt. „Ausprobieren“ lädt die Werte in den passenden Reiter, dort kannst du sie ändern.</p></div>' +
      BSP.map((b, i) => `<div class="card pl"><h4>${esc(b.titel)}</h4><p style="margin:0 0 4px;line-height:1.45"><b>Aufgabe:</b> ${esc(b.aufgabe)}</p>${stp(b.steps)}<div class="rdout ok"><b>${esc(b.ergebnis)}</b></div><div class="btns"><button class="btn pri" data-bsp="${i}">Ausprobieren</button></div></div>`).join('');
  }
  function loadBsp(b) {
    const set = b.set, k = b.tab; Object.assign(S[k], set); if (set.sets) S[k].sets = set.sets.slice();
    setTab(k); toast('Beispiel geladen: ' + b.titel);
  }

  /* ============================================================ Aufgaben */
  const done = () => lsGet('done', {});
  const exam = () => lsGet('exam', '0') === '1';
  function pctFor(id) { if (!exam()) return 100; const st = lsGet('ctipps', {})[id] || 0; return st >= 3 ? 0 : 100 - 25 * st; }   /* Stufe 3 verrät die Lösung: 0 % */
  function markSolved(id, pct) {
    const p = lsGet('prog', {}); if ((p[id] || 0) < pct) p[id] = pct; lsSet('prog', p);
    if (pct > 0) { const d = done(); d[id] = true; lsSet('done', d); }
    updateBadge(); updatePal();
  }
  function updateBadge() { const b = $('#tkBd'); if (!b) return; const n = Object.keys(done()).filter(k => TASKS.some(t => t.id === k)).length; b.textContent = n + '/' + TASKS.length; }
  const curTask = () => S.task && TASKS.find(t => t.id === S.task);
  const instOf = t => { const sd = S.seeds[t.id] || 0, i = S.inst[t.id]; if (i && i.seed === sd) return i; return (S.inst[t.id] = D.build(t, sd)); };
  const solText = p => p.sol;
  const rdOf = (p, ok) => `<div class="rdout ${ok ? 'ok' : 'bad'}"><b>Lösungsweg</b>${stp(p.steps, true)}</div>`;

  /* Aufgabe + Eingabe (für Aufgaben und Trainer). reveal = Richtig/Falsch an den Antworten markieren */
  function probHTML(p, ans, res, ns, reveal) {
    const solved = !!(res && res.ok), lock = solved || (ns === 'rt' && !!res), mark = !!(res && reveal);
    let h = `<div class="lv">${dots(p.level)}</div><p style="margin:8px 0">${esc(p.text)}</p>${showHTML(p.show)}`;
    if (p.kind === 'num') h += `<label class="f"><span>${esc(p.label)}${p.unit ? ' (' + esc(p.unit) + ')' : ''}</span><div class="qin"><input id="${ns}In" data-ans="${ns}" inputmode="decimal" autocomplete="off" value="${esc(ans || '')}" ${lock ? 'disabled' : ''}><span class="u">${esc(p.unit)}</span></div></label>`;
    else if (p.kind === 'text') h += `<label class="f"><span>${esc(p.label)}</span><div class="qin"><input id="${ns}In" data-ans="${ns}" ${p.numeric ? 'inputmode="numeric"' : ''} autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" value="${esc(ans || '')}" ${lock ? 'disabled' : ''}></div></label>`;
    else if (p.kind === 'choice') h += '<div class="opts">' + p.opts.map((o, i) => { const sel1 = ans === i, cls = mark ? (i === p.correct ? 'ok' : sel1 ? 'bad' : '') : sel1 ? 'on' : ''; return `<button data-o="${ns}|0|${i}" class="${cls}" aria-pressed="${sel1}"${lock ? ' disabled' : ''}>${esc(o)}</button>`; }).join('') + '</div>';
    else if (p.kind === 'multi') h += '<p class="hint2" style="margin:2px 0">Mehrere Antworten möglich. Tippe zum Markieren, noch einmal zum Entfernen.</p><div class="opts">' + p.opts.map((o, i) => { const sel1 = (ans || []).indexOf(i) >= 0, right = p.correct.indexOf(i) >= 0, cls = mark ? (sel1 && right ? 'ok' : sel1 ? 'bad' : right ? 'miss' : '') : sel1 ? 'on' : ''; return `<button data-o="${ns}|0|${i}" class="${cls}" aria-pressed="${sel1}"${lock ? ' disabled' : ''}><span class="mk">${sel1 ? '☑' : '☐'}</span>${esc(o)}</button>`; }).join('') + '</div>';
    else h += '<div>' + p.rows.map((r, ri) => `<div class="rw"><div class="q">${esc(r.q)}</div><div class="seg" role="group">${r.opts.map((o, i) => { const sel1 = (ans || [])[ri] === i, cls = mark ? (i === r.correct ? 'ok' : sel1 ? 'bad' : '') : sel1 ? 'on' : ''; return `<button data-o="${ns}|${ri}|${i}" class="${cls}" aria-pressed="${sel1}"${lock ? ' disabled' : ''}>${esc(o)}</button>`; }).join('')}</div></div>`).join('') + '</div>';
    return h;
  }
  const givenText = (p, v) => fmt(v, 6) + (p.unit ? ' ' + p.unit : '');
  const emptyMsg = p => p.kind === 'num' ? 'Bitte gib eine Zahl ein (mit Komma oder Punkt).' : p.kind === 'text' ? 'Bitte gib eine Antwort ein.' : p.kind === 'rows' ? 'Bitte beantworte alle Zeilen.' : 'Bitte wähle eine Antwort.';
  function checkTask(t) {
    const p = instOf(t), r0 = C.checkAnswer(p, S.tAns[t.id]); if (r0.empty) { toast(emptyMsg(p)); return; }
    const ok = r0.ok, pct = ok ? pctFor(t.id) : 0, ex = exam();
    S.tRes = { id: t.id, ok, pct, text: ok ? (p.kind === 'num' ? 'Richtig: ' + givenText(p, r0.v) : 'Richtig!') : p.kind === 'num' ? 'Deine Antwort „' + givenText(p, r0.v) + '“ stimmt nicht.' : p.kind === 'text' ? 'Deine Antwort „' + String(S.tAns[t.id]).trim() + '“ stimmt nicht.' : 'Das stimmt noch nicht.' + (r0.detail && !ex ? ' (' + r0.detail + ')' : '') };
    if (ok) { markSolved(t.id, pct); if (pct === 0) toast('Mit angezeigter Lösung zählt die Aufgabe im Prüfmodus nicht.'); else { const F = fx(); if (F && F.pass) try { F.pass(pct); } catch (e) {} else ding(); toast(ex && pct < 100 ? pct + ' % (Tipps abgezogen)' : '🎉 Geschafft!'); } } else { sad(); toast('Noch nicht richtig. Lies den Lösungsweg und versuche es noch einmal.'); }
    renderTasks(false);
  }
  function hintTask(t) {
    const p = instOf(t), h = lsGet('hints', {}), n = Math.min(3, (h[t.id] || 0) + 1), ex = exam();
    h[t.id] = Math.max(h[t.id] || 0, n); lsSet('hints', h);
    if (ex) { const c = lsGet('ctipps', {}); c[t.id] = Math.max(c[t.id] || 0, n); lsSet('ctipps', c); }
    sheet('Tipp, Stufe ' + n + ' von 3', b => {
      let x = `<p style="margin-top:0"><b>Stufe 1:</b> ${esc(p.tips[0])}</p>`;
      if (n >= 2) x += `<p><b>Stufe 2:</b> ${esc(p.tips[1])}</p>`;
      if (n >= 3) x += `<p><b>Stufe 3:</b> Die Lösung lautet <b>${esc(solText(p))}</b>.</p>`; else x += '<p class="hint2">Noch mehr Hilfe? Tippe noch einmal auf „Tipp“ für die nächste Stufe.</p>';
      x += ex ? '<p class="hint2" style="color:var(--warn)">Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte. Mit Stufe 3 zählt die Aufgabe nicht mehr.</p>' : '<p class="hint2">Beim normalen Üben kosten Tipps nichts. Im Prüfmodus (🎓) zählen sie.</p>';
      b.innerHTML = x;
    });
  }
  function renderTasks(top) {
    const V = $('#v_tasks'), d = done(), prog = lsGet('prog', {}), t = curTask(), n100 = TASKS.filter(x => d[x.id]).length; let h = '';
    if (t) {
      const p = instOf(t), r = S.tRes && S.tRes.id === t.id ? S.tRes : null, reveal = !!r && (r.ok || !exam());
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div>${probHTML(p, S.tAns[t.id], r, 'tk', reveal)}`;
      h += `<div class="btns"><button class="btn pri" data-ta="chk"${r && r.ok ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" data-ta="hint">💡 Tipp</button><button class="btn" data-ta="new">🔀 Neue Variante</button><button class="btn" data-ta="close">Schließen</button></div>`;
      if (exam()) h += '<p class="hint2" style="color:var(--warn)">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>';
      if (r) {
        h += `<ul class="tl"><li class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓' : '✗'} ${esc(r.text)}</li>${p.kind === 'num' && !p.exact ? `<li>ℹ Erlaubte Abweichung: ±${esc(fmt(p.tol, 6))} (Rundung).</li>` : ''}</ul>`;
        if (r.ok || !exam()) h += (r.ok ? '' : `<div class="rdout bad"><b>Richtig wäre:</b> ${esc(solText(p))}</div>`) + rdOf(p, r.ok);
        else h += '<div class="rdout bad">🎓 Prüfmodus: Den Lösungsweg gibt es erst, wenn die Aufgabe richtig gelöst ist. Nutze einen Tipp oder versuche es noch einmal.</div>';
        if (r.ok) h += '<div class="btns"><button class="btn pri" data-ta="next">Nächste Aufgabe</button></div>';
      }
      h += '</div>';
    }
    h += `<p class="hint2" style="margin:4px 0 0">${n100} von ${TASKS.length} Aufgaben gelöst. ${exam() ? '🎓 Prüfmodus ist an.' : 'Tipp: Im Prüfmodus (🎓 oben) zählen Tipps als Abzug.'}</p>`;
    let last = '';
    TASKS.forEach(x => { if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; } const p = prog[x.id]; h += `<button class="row" data-t="${esc(x.id)}"><span class="dot ${d[x.id] ? 'g' : p > 0 ? 'p' : ''}">${d[x.id] ? '✓' : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${dots(x.level)}</span>${p != null && !d[x.id] ? ' · bisher ' + p + ' %' : ''}</small></div></button>`; });
    V.innerHTML = h; if (top !== false) $('#pg_tasks').scrollTop = 0;
  }
  function resetTipps(id) { const h = lsGet('hints', {}), c = lsGet('ctipps', {}); if (h[id]) { delete h[id]; lsSet('hints', h); } if (c[id]) { delete c[id]; lsSet('ctipps', c); } }
  function startTask(id, fresh) {
    const t = TASKS.find(x => x.id === id); S.task = id; S.tRes = null; if (fresh) S.seeds[id] = Math.floor(Math.random() * 1e9); S.tAns[id] = C.emptyAns(instOf(t)); resetTipps(id); renderTasks();
  }
  /* Antwort-Taste (Auswahl, Markierung, Zeile) in Aufgabe oder Trainer */
  function optClick(ns, row, i) {
    if (ns === 'tk') {
      const t = curTask(); if (!t) return; if (S.tRes && S.tRes.id === t.id && S.tRes.ok) return;
      const p = instOf(t); S.tAns[t.id] = applyOpt(p, S.tAns[t.id], row, i); S.tRes = null; renderTasks(false);
    } else { const T = S.tr; if (!T.p || T.res) return; T.ans = applyOpt(T.p, T.ans, row, i); renderTrainer(); }
  }
  function applyOpt(p, ans, row, i) {
    if (p.kind === 'choice') return i;
    if (p.kind === 'multi') { const a = (ans || []).slice(), k = a.indexOf(i); if (k >= 0) a.splice(k, 1); else a.push(i); return a; }
    const a = (ans || p.rows.map(() => null)).slice(); a[row] = i; return a;
  }

  /* ============================================================ Zufalls-Trainer */
  function newTrainer() {
    const T = S.tr; let pool = TASKS.filter(t => (T.cat === 'alle' || t.cat === T.cat) && (!T.level || t.level === T.level)); if (!pool.length) pool = TASKS;
    const t = pool[Math.floor(Math.random() * pool.length)]; T.p = D.build(t, Math.floor(Math.random() * 1e9)); T.ans = C.emptyAns(T.p); T.res = null; renderTrainer();
  }
  function renderTrainer() {
    const T = S.tr, V = $('#v_rt'); if (!T.p) { newTrainer(); return; }
    const st = S.rt, p = T.p, r = T.res;
    let h = `<div class="card pl"><h4>Zufalls-Trainer: unendlich viele Aufgaben</h4><div class="fbar">${seg('tr.cat', [['alle', 'Alle']].concat(D.cats.map(c => [c, c])), T.cat)}</div><div class="fbar">${seg('tr.level', [[0, 'alle Stufen'], [1, 'leicht'], [2, 'mittel'], [3, 'schwer']], T.level)}</div>
      <div class="stats"><div class="bx"><b>${st.streak}</b>Serie</div><div class="bx"><b>${st.best}</b>Beste Serie</div><div class="bx"><b>${st.ok}/${st.n}</b>Richtig</div></div>
      <div class="hint2" style="margin:0">${esc(p.cat)} · ${esc(p.title)}</div>${probHTML(p, T.ans, r, 'rt', !!r)}`;
    h += r ? '<div class="btns"><button class="btn pri" data-r="next">Nächste Aufgabe</button></div>' : '<div class="btns"><button class="btn pri" data-r="chk">✓ Prüfen</button><button class="btn" data-r="show">Lösung zeigen</button></div>';
    if (r) h += `<div class="fb ${r.ok ? 'ok' : 'bad'}"><span class="v">${r.shown ? 'Lösung: ' + esc(solText(p)) + ' (zählt als Fehler, Serie beginnt neu)' : r.ok ? '✓ Richtig! Serie: ' + st.streak : '✗ Nicht ganz. Richtig ist: ' + esc(solText(p))}</span></div>${rdOf(p, r.ok)}`;
    V.innerHTML = h + '</div>';
  }
  function trainerResult(ok, shown) {
    const T = S.tr, st = S.rt; st.n++; if (ok && !shown) { st.ok++; st.streak++; st.best = Math.max(st.best, st.streak); } else st.streak = 0; lsSet('rt', st);
    T.res = { ok: ok && !shown, shown }; if (ok && !shown) ding(); else sad(); renderTrainer(); updatePal();
    if (ok && !shown && st.streak > 0 && st.streak % 5 === 0) { toast('🔥 ' + st.streak + ' richtige in Folge!'); const F = fx(); if (F && F.pass) try { F.pass(100); } catch (e) {} }
  }
  function checkTrainer() { const T = S.tr, r = C.checkAnswer(T.p, T.ans); if (r.empty) { toast(emptyMsg(T.p)); return; } trainerResult(r.ok, false); }

  /* ============================================================ Hilfe */
  function renderHelp() {
    const dt = pc => { const h = C.downHours(pc); return h >= 1 ? fmt(C.rd(h, 2), 2) + ' Stunden' : fmt(C.rd(h * 60, 2), 2) + ' Minuten'; };
    $('#v_help').innerHTML = `
    <details open><summary>🔑 Passwörter, Entropie, Brute-Force</summary><div class="hb2">
      <span class="eq">Möglichkeiten = N^L  (N = Zeichenvorrat, L = Länge)</span><span class="eq">Entropie H = L · log₂(N)  in Bit</span><span class="eq">Höchstdauer = N^L / Versuche pro Sekunde</span>
      <table><tr><th>Zeichengruppe</th><th>Anzahl</th></tr><tr><td>Kleinbuchstaben a bis z</td><td>26</td></tr><tr><td>Großbuchstaben A bis Z</td><td>26</td></tr><tr><td>Ziffern 0 bis 9</td><td>10</td></tr><tr><td>Sonderzeichen (hier)</td><td>32</td></tr><tr><td>alle vier zusammen</td><td>94</td></tr></table>
      <p>Jedes zusätzliche Bit verdoppelt die Möglichkeiten. Eine zusätzliche Stelle multipliziert sie mit N. Länge wirkt stärker als ein exotisches Sonderzeichen. Die Rechnung gilt nur für <b>zufällig</b> gewählte Passwörter: Bekannte Wörter, Namen und Muster sind viel schneller zu erraten.</p>
      <p>Eine Passphrase aus k zufälligen Wörtern einer Liste mit W Wörtern hat H = k · log₂(W) Bit. Passwort-Manager und eine zweite Sicherung der Anmeldung (Zwei-Faktor) helfen im Alltag.</p></div></details>
    <details><summary>🔐 Verschlüsselung und Hash</summary><div class="hb2">
      <p><b>Caesar:</b> jeder Buchstabe um k Stellen verschieben. <b>Vigenère:</b> jeder Buchstabe um die Zahl des passenden Schlüsselbuchstabens verschieben (A = 0, B = 1, ...), das Schlüsselwort wird wiederholt. Beide sind nur zum Üben, nicht sicher.</p>
      <span class="eq">XOR: 0⊕0 = 0, 0⊕1 = 1, 1⊕0 = 1, 1⊕1 = 0   (Klartext ⊕ Schlüssel = Geheimtext, Geheimtext ⊕ Schlüssel = Klartext)</span>
      <table><tr><th></th><th>symmetrisch</th><th>asymmetrisch</th></tr><tr><td>Schlüssel</td><td>ein gemeinsamer geheimer Schlüssel</td><td>Schlüsselpaar: öffentlich und privat</td></tr><tr><td>Beispiele</td><td>AES</td><td>RSA</td></tr><tr><td>Stärke</td><td>schnell</td><td>kein geheimer Austausch nötig, langsamer</td></tr><tr><td>Schlüssel bei n Personen</td><td>n · (n − 1) / 2 (paarweise)</td><td>2 · n (ein Paar je Person)</td></tr></table>
      <p><b>Hash</b> (Einweg-Prüfsumme): gleiche Eingabe gleicher Wert, feste Länge, praktisch nicht umkehrbar, kleine Änderung ergibt ganz anderen Wert. Er prüft die Integrität. Er verschlüsselt nichts. Passwörter speichert man nur als gesalzenen Hash.</p>
      <table><tr><th>Verfahren</th><th>Länge</th><th>Hex-Zeichen</th></tr><tr><td>MD5 (gilt als gebrochen)</td><td>128 Bit</td><td>32</td></tr><tr><td>SHA-1 (veraltet)</td><td>160 Bit</td><td>40</td></tr><tr><td>SHA-256</td><td>256 Bit</td><td>64</td></tr><tr><td>SHA-512</td><td>512 Bit</td><td>128</td></tr></table></div></details>
    <details><summary>🎣 Phishing und Social Engineering erkennen</summary><div class="hb2">
      <p><b>Prüfliste für E-Mails:</b></p><ul style="margin:.3em 0;padding-left:20px;line-height:1.55">
        <li><b>Absenderadresse</b> lesen, nicht den Anzeigenamen. Passt die Domain zur Firma?</li>
        <li><b>Link-Ziel</b> prüfen (Mauszeiger darüber, lange drücken). Die Domain steht direkt vor der Endung, von rechts nach links lesen.</li>
        <li><b>Druck</b>: Frist, Drohung, „letzte Chance“, Geheimhaltung.</li>
        <li><b>Unpersönliche Anrede</b> bei angeblich bekannten Absendern.</li>
        <li><b>Ungewöhnliche Bitte</b>: Passwort, Zahlung, Gutscheincodes, Anhang öffnen.</li>
        <li>Vertauschte Zeichen in Adressen (Ziffer 1 statt Buchstabe l).</li></ul>
      <p>Einzelne Merkmale beweisen nichts, entscheidend ist das Gesamtbild. „https“ und ein Schloss-Symbol sagen nur: verschlüsselte Verbindung, nicht: vertrauenswürdig.</p>
      <p><b>Richtig reagieren:</b> Nicht klicken, nichts eingeben, nicht antworten. Über einen bekannten Weg nachfragen (Rückruf mit bekannter Nummer). Melden. <b>Social Engineering</b> nutzt Hilfsbereitschaft, Neugier, Autorität und Zeitdruck aus: Prüfen kostet nichts, ein Fehler kann viel kosten.</p></div></details>
    <details><summary>🛡️ Rechte und Firewall</summary><div class="hb2">
      <table><tr><th>Recht</th><th>Wert</th><th>Bedeutung bei Datei</th></tr><tr><td>r</td><td>4</td><td>lesen</td></tr><tr><td>w</td><td>2</td><td>schreiben</td></tr><tr><td>x</td><td>1</td><td>ausführen</td></tr></table>
      <p>Drei Gruppen: Besitzer, Gruppe, Andere. Beispiel: rwxr-x--- = 7 5 0. Je Gruppe die Werte addieren.</p>
      <p><b>Prinzip der minimalen Rechte (Need-to-know):</b> Jeder bekommt nur die Rechte, die er für seine Aufgabe braucht. Rechte nach Rollen (Gruppen) statt nach Einzelpersonen vergeben, regelmäßig prüfen.</p>
      <p><b>Firewall-Regeln lesen:</b> von oben nach unten, die erste passende Regel entscheidet (Protokoll, Quelle, Ziel und Zielport müssen alle passen). Was keine Regel trifft, wird geblockt. Darum zählt die Reihenfolge: Eine „blocken“-Regel weiter oben schlägt eine „erlauben“-Regel weiter unten.</p></div></details>
    <details><summary>💾 Backup, RPO und RTO</summary><div class="hb2">
      <p><b>3-2-1-Regel:</b> mindestens 3 Kopien der Daten (Original mitgezählt), auf 2 verschiedenen Medien, davon 1 Kopie an einem anderen Ort.</p>
      <table><tr><th>Art</th><th>enthält</th><th>Wiederherstellung</th></tr><tr><td>Voll</td><td>alle Daten</td><td>1 Sicherung</td></tr><tr><td>Inkrementell</td><td>Änderungen seit der letzten Sicherung (klein)</td><td>Voll + alle Inkremente bis zum Stand (viele Teile, Kette)</td></tr><tr><td>Differentiell</td><td>Änderungen seit der letzten Vollsicherung (wächst)</td><td>Voll + letzte Differenz (2 Teile)</td></tr></table>
      <span class="eq">RPO (Recovery Point Objective) = höchstens tolerierter Datenverlust (Zeit zwischen zwei Sicherungen)</span><span class="eq">RTO (Recovery Time Objective) = höchstens tolerierte Dauer bis zum Wiederanlauf</span><span class="eq">Rückspielzeit = Datenmenge / Rate  (1 GB = 1000 MB)</span>
      <p>Eine Sicherung gilt erst, wenn die Wiederherstellung getestet wurde.</p></div></details>
    <details><summary>⏱️ Verfügbarkeit</summary><div class="hb2">
      <span class="eq">Verfügbarkeit = Laufzeit / Gesamtzeit · 100 %</span><span class="eq">Ausfallzeit pro Jahr = (1 − Verfügbarkeit) · 8760 h</span>
      <table><tr><th>Verfügbarkeit</th><th>Ausfall pro Jahr (höchstens)</th></tr>${[99, 99.5, 99.9, 99.95, 99.99].map(p => `<tr><td>${fmt(p)} %</td><td>${dt(p)}</td></tr>`).join('')}</table>
      <span class="eq">in Reihe (alle müssen laufen): V = V₁ · V₂ · ...</span><span class="eq">redundant (einer reicht): V = 1 − (1 − V₁) · (1 − V₂) · ...</span>
      <p>Reihenschaltung macht schlechter als die schwächste Komponente, Redundanz macht besser als die beste.</p></div></details>
    <details><summary>📜 Schutzziele, DSGVO, BSI</summary><div class="hb2">
      <table><tr><th>Schutzziel</th><th>Bedeutung</th></tr><tr><td>Vertraulichkeit</td><td>Nur Berechtigte sehen die Daten.</td></tr><tr><td>Integrität</td><td>Daten bleiben vollständig und unverändert, Änderungen fallen auf.</td></tr><tr><td>Verfügbarkeit</td><td>Daten und Dienste sind bei Bedarf nutzbar.</td></tr></table>
      <p><b>DSGVO:</b> Personenbezogene Daten sind alle Angaben zu einer identifizierten oder identifizierbaren Person. Betroffene Person = der Mensch, dessen Daten verarbeitet werden. Grundsätze: Zweckbindung, Datenminimierung, Richtigkeit, Speicherbegrenzung, Integrität und Vertraulichkeit. Datenpannen mit Risiko für die Betroffenen sind unverzüglich, möglichst binnen 72 Stunden nach Bekanntwerden, der Aufsichtsbehörde zu melden.</p>
      <p><b>TOM</b> (technische und organisatorische Maßnahmen): technisch zum Beispiel Verschlüsselung, Firewall, Zutrittskontrolle. Organisatorisch zum Beispiel Dienstanweisungen, Schulungen, Rollenkonzepte.</p>
      <p><b>BSI IT-Grundschutz:</b> Vorgehensweise des Bundesamtes für Sicherheit in der Informationstechnik mit Bausteinen und Maßnahmen. Der Schutzbedarf wird in die Stufen normal, hoch und sehr hoch eingeteilt.</p></div></details>`;
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  const RENDER = { pw: renderPw, kry: renderKry, net: renderNet, bak: renderBak, bsp: renderBsp, tasks: renderTasks, rt: renderTrainer, help: renderHelp };
  const UPD = { pw: updPw, kry: updKry, net: updNet, bak: updBak };
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'pw'; S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.pg').forEach(p => { p.style.display = p.dataset.tab === t ? 'flex' : 'none'; });
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    RENDER[t](); const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'IT-Sicherheits-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = 'IT-Sicherheits-Lab: ' + T[2];
  }
  function setExam(on) { lsSet('exam', on ? '1' : '0'); palSig = ''; updatePal(); $('#bExam').classList.toggle('on', on); $('#bExam').setAttribute('aria-pressed', on); toast(on ? '🎓 Prüfmodus an: Tipps kosten 25 % je Stufe.' : 'Prüfmodus aus: Tipps kosten nichts.'); if (S.tab === 'tasks') renderTasks(false); }
  let palSig = '';
  function updatePal() {
    const F = !!fx(), fxOn = F && !fx().isMuted(), n = Object.keys(done()).filter(k => TASKS.some(t => t.id === k)).length, sig = [F, fxOn, exam(), n, S.rt.streak, S.rt.best].join('|'); if (sig === palSig) return; palSig = sig;
    $('#pal').innerHTML = `${F ? `<button class="chip ${fxOn ? 'on' : ''}" data-a="fx" aria-pressed="${fxOn}" title="Effekte und Ton">${fxOn ? '🎉' : '🔇'} Effekte</button>` : ''}<button class="chip ${exam() ? 'on' : ''}" data-a="exam" aria-pressed="${exam()}" title="Prüfmodus: Tipps zählen als Abzug">🎓 Prüfmodus</button><button class="chip" data-a="rand" title="Zufällige Aufgabe im Trainer">🎲 Zufallsaufgabe</button>
      <span id="stat">Aufgaben gelöst <b>${n}/${TASKS.length}</b> · Serie <b>${S.rt.streak}</b> · Beste Serie <b>${S.rt.best}</b></span>`;
    $('#bExam').classList.toggle('on', exam());
  }
  $('#pal').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.a === 'fx') { const F = fx(); if (F) { F.setMuted(!F.isMuted()); palSig = ''; updatePal(); if (!F.isMuted()) ding(); } }
    else if (b.dataset.a === 'exam') setExam(!exam());
    else if (b.dataset.a === 'rand') { setTab('rt'); newTrainer(); }
  });
  $('#bTasks').onclick = () => setTab('tasks'); $('#bHelp').onclick = () => setTab('help'); $('#bExam').onclick = () => setExam(!exam());
  $('#title').onclick = () => setTab('pw');
  $('#bMenu').onclick = () => {
    const rows = [['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung, Lösungsweg und Tipps'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Aufgaben mit Serien-Zähler'], ['bsp', 'Beispiele', 'Durchgerechnete Beispiele zum Nachvollziehen'], ['help', 'Hilfe und Spickzettel', 'Entropie, Verschlüsselung, Phishing, Rechte, Backup, Verfügbarkeit'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben und Trainer-Serie auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
    sheet('Menü', (b, close) => {
      b.innerHTML = rows.map(r => `<button class="row" data-m="${r[0]}"><div class="grow"><b>${esc(r[1])}</b><small>${esc(r[2])}</small></div></button>`).join('');
      b.addEventListener('click', e => {
        const r = e.target.closest('.row'); if (!r) return; close(); const m = r.dataset.m;
        if (m === 'home') location.href = 'index.html'; else if (m === 'exam') setExam(!exam()); else if (m === 'reset') resetAll(); else setTab(m);
      });
    });
  };
  function resetAll() {
    sheet('Fortschritt zurücksetzen?', (b, close) => {
      b.innerHTML = '<p style="margin-top:0">Alle gelösten Aufgaben, Tipps und die Trainer-Serie dieses Labs werden auf diesem Gerät gelöscht. Das kann nicht rückgängig gemacht werden.</p><div class="btns"><button class="btn" data-x="no">Abbrechen</button><button class="btn danger" data-x="yes">Löschen</button></div>';
      b.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (!x) return; if (x.dataset.x === 'yes') { ['done', 'prog', 'hints', 'ctipps', 'rt'].forEach(k => { try { localStorage.removeItem(LS + k); } catch (er) {} }); S.rt = { n: 0, ok: 0, streak: 0, best: 0 }; S.task = null; S.tRes = null; palSig = ''; updatePal(); updateBadge(); if (S.tab === 'tasks') renderTasks(); toast('Fortschritt gelöscht'); } close(); });
    });
  }

  /* ============================================================ Ereignisse (alle Reiter) */
  function setPath(key, val) { const p = key.split('.'); let o = S[p[0]]; for (let i = 1; i < p.length - 1; i++) o = o[p[i]]; o[p[p.length - 1]] = val; }
  function onField(e) {
    const el = e.target;
    if (el.dataset.ans) { if (el.dataset.ans === 'tk') { const t = curTask(); if (t) S.tAns[t.id] = el.value; } else S.tr.ans = el.value; return; }
    const k = el.dataset.s; if (!k) return; setPath(k, el.value);
    const g = k.split('.')[0]; if (el.dataset.r) RENDER[g](); else if (UPD[g]) UPD[g]();
  }
  document.addEventListener('input', onField); document.addEventListener('change', e => { if (e.target.tagName === 'SELECT') onField(e); });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || !e.target.dataset || !e.target.dataset.ans) return; e.preventDefault();
    if (e.target.dataset.ans === 'tk') { const t = curTask(); if (t && !(S.tRes && S.tRes.id === t.id && S.tRes.ok)) checkTask(t); } else if (S.tr.res) newTrainer(); else checkTrainer();
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.closest('#tabs,#pal,header,.backdrop')) return; const ds = b.dataset;
    if (ds.o) { const q = ds.o.split('|'); optClick(q[0], +q[1], +q[2]); return; }
    if (ds.seg) { const [g, f] = ds.seg.split('.'); S[g][f] = f === 'level' ? +ds.v : ds.v; if (g === 'tr') { newTrainer(); return; } RENDER[g](); return; }
    if (ds.set) { const a = S.pw.sets, i = a.indexOf(ds.set); if (i >= 0) a.splice(i, 1); else a.push(ds.set); renderPw(); return; }
    if (ds.pb != null) { const i = +ds.pb, p = S.net.perm.split(''); p[i] = p[i] === '-' ? 'rwx'[i % 3] : '-'; S.net.perm = p.join(''); renderNet(); return; }
    if (ds.bsp != null && BSP[+ds.bsp]) { loadBsp(BSP[+ds.bsp]); return; }
    if (ds.r) { if (ds.r === 'chk') checkTrainer(); else if (ds.r === 'show') trainerResult(false, true); else if (ds.r === 'next') newTrainer(); return; }
    const t = curTask();
    if (ds.ta && t) { const a = ds.ta; if (a === 'chk') checkTask(t); else if (a === 'hint') hintTask(t); else if (a === 'new') startTask(t.id, true); else if (a === 'close') { S.task = null; S.tRes = null; renderTasks(); } else if (a === 'next') { const i = TASKS.findIndex(x => x.id === t.id), nx = TASKS.slice(i + 1).find(x => !done()[x.id]) || TASKS[(i + 1) % TASKS.length]; startTask(nx.id); } return; }
    const row = b.closest('.row[data-t]'); if (row && S.tab === 'tasks') startTask(row.dataset.t);
  });

  /* Schnittstelle für Karriere/Lernpfad */
  root.ITS_LAB = { id: 'its', title: 'IT-Sicherheits-Lab', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.ITS_TASKS };

  buildTabs(); updatePal();
  /* Aufruf ?aufgabe=its1 (Startseite, Lernhefte): Aufgabe gleich öffnen; ?bsp: Beispielauswahl zeigen */
  root.LabGoto = id => { try { if (TASKS.some(t => t.id === id)) { setTab('tasks'); startTask(id); return true; } } catch (e) {} return false; };
  let start = S.tab, openId = null;
  try { const q = new URLSearchParams(location.search), qa = q.get('aufgabe'); if (qa && TASKS.some(t => t.id === qa)) { start = 'tasks'; openId = qa; } else if (q.has('bsp')) start = 'bsp'; } catch (e) {}
  setTab(start); if (openId) startTask(openId);
})(typeof window !== 'undefined' ? window : globalThis);
