'use strict';
/* Tonfunk Netzwerk-Lab: Oberfläche (Lab-Kennung 'net').
   Reiter: Binär, Subnetz-Rechner, Werkstatt (Teilen und VLSM), Gleiches Netz?, Schichten und Ports, Beispiele, Aufgaben, Trainer, Hilfe.
   Module: netcore.js (NET_CORE, Logik), netdata.js (NET_DATA, NET_TASKS).
   Speicher (Präfix lm4.net.): tab, bin, calc, werk, same, done ({id:true} nur gelöste), prog ({id:Prozent}), hints ({id:höchste Stufe}),
   ctipps ({id:Stufe} nur im Prüfmodus), exam ('1' = Prüfmodus), rt (Trainer: n, ok, streak, best).
   Tipp-Abzug (25 % je Stufe) gibt es nur im Prüfmodus; beim normalen Üben kosten Tipps nichts.
   Aufrufe: netlab.html?aufgabe=net1 öffnet die Aufgabe, netlab.html?bsp die Beispielauswahl (?bsp=bsp3 öffnet ein Beispiel). */
(function (root) {
  const C = root.NET_CORE, D = root.NET_DATA;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.net.';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(LS + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} };
  const nf = v => Number(v).toLocaleString('de-DE');
  const dots = l => '●'.repeat(l || 1) + '○'.repeat(3 - (l || 1));
  const fx = () => root.LochFX || null;
  const ding = () => { const F = fx(); if (F && F.sound) try { F.sound('ding', 0.6); } catch (e) {} };
  const sad = () => { const F = fx(); if (F && F.sound) try { F.sound('sad', 0.5); } catch (e) {} };

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
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>Netzwerk-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">netcore.js oder netdata.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks, EX = D.examples;
  const qCache = {}, qOf = t => qCache[t.id] || (qCache[t.id] = C.mk(t.kind, t.p));

  /* ============================================================ Zustand */
  const TABS = [['bin', '🔢', 'Binär'], ['calc', '🧮', 'Subnetz-Rechner'], ['werk', '🛠️', 'Werkstatt'], ['same', '🔗', 'Gleiches Netz?'], ['osi', '🧱', 'Schichten und Ports'], ['bsp', '📖', 'Beispiele'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['help', '📘', 'Hilfe']];
  const DEF_DEPS = [{ n: 'Vertrieb', h: '100' }, { n: 'Technik', h: '50' }, { n: 'Verwaltung', h: '25' }, { n: 'Server', h: '10' }];
  const S = {
    tab: lsGet('tab', 'calc'),
    bin: Object.assign({ v: 181, ip: '192.168.10.1', m: '24' }, lsGet('bin', {})),
    calc: Object.assign({ ip: '192.168.10.77', m: '26' }, lsGet('calc', {})),
    werk: Object.assign({ mode: 'split', net: '192.168.0.0/24', n: '4', deps: DEF_DEPS }, lsGet('werk', {})),
    same: Object.assign({ a: '192.168.1.130', b: '192.168.1.190', m: '26', gw: '192.168.1.129' }, lsGet('same', {})),
    bsp: null, task: null, tAns: {}, tRes: null,
    tr: { cat: 'all', level: 2, q: null, ans: {}, res: null },
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {}))
  };
  if (!Number.isInteger(S.bin.v) || S.bin.v < 0 || S.bin.v > 255) S.bin.v = 181;
  if (!Array.isArray(S.werk.deps) || !S.werk.deps.every(d => d && typeof d.n === 'string')) S.werk.deps = DEF_DEPS;
  S.werk.deps = S.werk.deps.map(d => ({ n: d.n, h: String(d.h) }));
  if (S.werk.mode !== 'vlsm') S.werk.mode = 'split';
  ['ip', 'm'].forEach(k => { S.calc[k] = String(S.calc[k]); S.bin[k] = String(S.bin[k]); });
  const R0 = (() => { const m = /[?&]seed=([^&]+)/.exec(location.search); return C.rng(m ? decodeURIComponent(m[1]) : String(Math.random()) + Date.now()); })();
  const save = k => lsSet(k, S[k]);

  /* ============================================================ Binäranzeige */
  function binRow(label, v, p) {
    const b = C.toBin(v, 32); let s = '';
    for (let i = 0; i < 32; i++) { if (i && i % 8 === 0) s += '<i>.</i>'; s += `<span class="${i < p ? 'nw' : 'ho'}">${b[i]}</span>`; }
    return `<div class="bin"><span class="lb">${esc(label)}</span>${s}</div>`;
  }
  function ipErr(ipS, mS) {
    if (C.parseIP(ipS) === null) return 'Die IP-Adresse ist ungültig. Erlaubt sind vier Zahlen von 0 bis 255, durch Punkte getrennt, ohne führende Nullen (z. B. 192.168.10.77).';
    if (C.parsePrefix(mS) === null) return 'Die Maske ist ungültig. Erlaubt: /0 bis /32, eine Zahl 0 bis 32 oder eine Maske aus zusammenhängenden Einsen (z. B. 255.255.255.192).';
    return '';
  }

  /* ============================================================ Reiter Binär */
  function renderBin() {
    $('#binView').innerHTML = `<div class="card pl"><h4>8-Bit-Umrechner</h4><p class="hint2" style="margin-top:0">Tippe auf ein Bit, um es umzuschalten. Unter jedem Bit steht sein Stellenwert.</p>
      <div class="bitrow" id="bits"></div><div class="rdout" id="bitOut"></div>
      <div class="ctl"><button class="chip" data-b="0">Alle 0</button><button class="chip" data-b="255">Alle 1</button><button class="chip" data-b="inc">+ 1</button><button class="chip" data-b="dec">− 1</button><button class="chip" data-b="shl">× 2</button><button class="chip" data-b="rnd">🎲 Zufall</button></div>
      <label class="f"><span>Dezimalwert (0 bis 255)</span><input id="bDec" inputmode="numeric" autocomplete="off" value="${S.bin.v}"></label></div>
      <div class="card pl"><h4>IP-Adresse und Subnetzmaske binär</h4><div class="dsrow"><label class="f"><span>IP-Adresse</span><input id="bIp" inputmode="decimal" autocomplete="off" spellcheck="false" value="${esc(S.bin.ip)}"></label>
      <label class="f"><span>Maske (/n oder 255.255.…)</span><input id="bM" inputmode="decimal" autocomplete="off" spellcheck="false" value="${esc(S.bin.m)}"></label></div><div id="ipBin"></div></div>`;
    updateBits(); updateIpBin();
  }
  function updateBits() {
    const v = S.bin.v, b = C.toBin(v, 8), ws = [];
    const btn = i => `<button class="bitb${b[7 - i] === '1' ? ' on' : ''}" data-i="${i}" aria-pressed="${b[7 - i] === '1'}" aria-label="Bit ${i}, Wert ${1 << i}">${b[7 - i]}<small>${1 << i}</small></button>`;
    $('#bits').innerHTML = `<div class="nib">${[7, 6, 5, 4].map(btn).join('')}</div><div class="nib">${[3, 2, 1, 0].map(btn).join('')}</div>`;
    for (let i = 7; i >= 0; i--) if (b[7 - i] === '1') ws.push(1 << i);
    $('#bitOut').innerHTML = `Binär <b>${b.slice(0, 4)} ${b.slice(4)}</b> · Dezimal <b>${v}</b> · Hex <b>${v.toString(16).toUpperCase().padStart(2, '0')}</b><br>Rechnung: ${ws.length ? ws.join(' + ') + ' = ' + v : '0'}`;
  }
  function updateIpBin() {
    const e = ipErr(S.bin.ip, S.bin.m), o = $('#ipBin'); if (!o) return;
    if (e) { o.innerHTML = `<div class="rdout bad">${esc(e)}</div>`; return; }
    const ip = C.parseIP(S.bin.ip), p = C.parsePrefix(S.bin.m), m = C.maskOf(p), net = (ip & m) >>> 0;
    o.innerHTML = binRow('IP-Adresse ' + C.fmtIP(ip), ip, p) + binRow('Subnetzmaske ' + C.fmtIP(m) + ' (/' + p + ')', m, p) + binRow('Netzadresse = IP UND Maske: ' + C.fmtIP(net), net, p)
      + `<p class="hint2"><span style="color:var(--accent)">Blau</span>: Netzanteil (${p} Bit), <span style="color:var(--hi)">orange</span>: Hostanteil (${32 - p} Bit). Wo die Maske eine 1 hat, bleibt das IP-Bit erhalten, sonst wird es 0.</p>`;
  }
  $('#binView').addEventListener('click', e => {
    const bt = e.target.closest('.bitb'), ch = e.target.closest('[data-b]'); if (!bt && !ch) return;
    if (bt) S.bin.v ^= 1 << +bt.dataset.i;
    else { const a = ch.dataset.b; S.bin.v = a === 'inc' ? (S.bin.v + 1) & 255 : a === 'dec' ? (S.bin.v + 255) & 255 : a === 'shl' ? (S.bin.v * 2) & 255 : a === 'rnd' ? Math.floor(Math.random() * 256) : +a; }
    save('bin'); $('#bDec').value = S.bin.v; updateBits();
  });
  $('#binView').addEventListener('input', e => {
    const id = e.target.id;
    if (id === 'bDec') { const s = e.target.value.trim(); if (/^\d{1,3}$/.test(s) && +s <= 255) { S.bin.v = +s; save('bin'); updateBits(); } }
    else if (id === 'bIp' || id === 'bM') { S.bin[id === 'bIp' ? 'ip' : 'm'] = e.target.value; save('bin'); updateIpBin(); }
  });

  /* ============================================================ Reiter Subnetz-Rechner */
  function renderCalc() {
    $('#calcView').innerHTML = `<div class="card pl"><h4>Subnetz-Rechner (IPv4)</h4><div class="dsrow"><label class="f"><span>IP-Adresse</span><input id="cIp" inputmode="decimal" autocomplete="off" spellcheck="false" value="${esc(S.calc.ip)}"></label>
      <label class="f"><span>Präfix oder Maske (/26 oder 255.255.255.192)</span><input id="cM" inputmode="decimal" autocomplete="off" spellcheck="false" value="${esc(S.calc.m)}"></label></div>
      <div class="ctl">${[8, 16, 24, 25, 26, 27, 28, 29, 30, 31, 32].map(p => `<button class="chip s" data-p="${p}">/${p}</button>`).join('')}</div></div><div id="cOut"></div>`;
    updateCalc();
  }
  function updateCalc() {
    const o = $('#cOut'); if (!o) return; const e = ipErr(S.calc.ip, S.calc.m);
    if (e) { o.innerHTML = `<div class="card pl"><div class="rdout bad">${esc(e)}</div></div>`; return; }
    const c = C.calc(S.calc.ip, S.calc.m), h = 32 - c.p;
    const row = (k, v, x) => `<tr><td>${k}</td><td class="mono">${v}</td><td class="hint2" style="margin:0">${x || ''}</td></tr>`;
    let note = '';
    if (c.kind === 'p2p') note = 'Sonderfall /31 (RFC 3021): Punkt-zu-Punkt-Verbindung. Beide Adressen sind nutzbar, es gibt keine Netz- und Broadcast-Adresse im üblichen Sinn. /* PRUEFEN */ Manche Lehrbücher nennen hier 0 Hosts.';
    else if (c.kind === 'host') note = 'Sonderfall /32: genau eine Adresse (Host-Route), z. B. für Loopback-Adressen oder Firewall-Regeln für einen einzelnen Host.';
    o.innerHTML = `<div class="card pl"><h4>Ergebnis</h4><div class="scrx"><table class="tt" style="min-width:0"><tbody>
      ${row('IP-Adresse', c.ip)}${row('Subnetzmaske', c.mask, '/' + c.p)}${row('Wildcard-Maske', c.wildcard, 'Maske invertiert')}
      ${row('Netzadresse', '<b>' + c.network + '</b>', 'Hostbits alle 0')}${row('Broadcast', c.broadcast ? '<b>' + c.broadcast + '</b>' : '–', c.broadcast ? 'Hostbits alle 1' : 'nicht vorhanden')}
      ${row('Erste Hostadresse', c.first)}${row('Letzte Hostadresse', c.last)}${row('Nutzbare Hosts', '<b>' + nf(c.hosts) + '</b>', c.kind === 'normal' ? '2^' + h + ' − 2' : '')}${row('Adressen gesamt', nf(c.total), '2^' + h)}
      ${row('Klasse', c.cls, 'klassenbehaftet')}${row('Bereich', esc(C.SCOPE_TXT[c.scope]))}</tbody></table></div>${note ? `<div class="rdout">${esc(note)}</div>` : ''}</div>
      <div class="card pl"><h4>Binär</h4>${binRow('IP-Adresse', c.n.ip, c.p)}${binRow('Subnetzmaske', c.n.mask, c.p)}${binRow('Netzadresse', c.n.net, c.p)}</div>`;
  }
  $('#calcView').addEventListener('input', e => { if (e.target.id === 'cIp') S.calc.ip = e.target.value; else if (e.target.id === 'cM') S.calc.m = e.target.value; else return; save('calc'); updateCalc(); });
  $('#calcView').addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (!b) return; S.calc.m = '/' + b.dataset.p; save('calc'); $('#cM').value = S.calc.m; updateCalc(); });

  /* ============================================================ Reiter Werkstatt */
  const PAL = ['#3b9eff', '#ff9f1c', '#4cd964', '#c77dff', '#ff5c5c', '#2ec4b6', '#f4d35e', '#90a4ae'];
  function svgBar(blocks, total) {
    const W = 360, H = 58; let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Aufteilung des Adressraums">`;
    blocks.forEach((b, i) => {
      const x = b.off / total * W, w = Math.max(1.5, b.size / total * W);
      s += b.free ? `<rect x="${x.toFixed(1)}" y="4" width="${w.toFixed(1)}" height="${H - 8}" fill="none" stroke="var(--mute)" stroke-dasharray="4 3"/>` : `<rect x="${x.toFixed(1)}" y="4" width="${w.toFixed(1)}" height="${H - 8}" fill="${PAL[i % PAL.length]}" fill-opacity=".55" stroke="${PAL[i % PAL.length]}"/>`;
      if (w >= 44) { const mc = Math.floor(w / 6.4), cx = (x + w / 2).toFixed(1); s += `<text x="${cx}" y="26" text-anchor="middle" font-size="11" font-weight="600" fill="var(--fg)" style="fill:var(--fg)">${esc(b.l1.length > mc ? b.l1.slice(0, Math.max(1, mc - 1)) + '…' : b.l1)}</text><text x="${cx}" y="42" text-anchor="middle" font-size="11" style="fill:var(--fg)">${esc(b.l2)}</text>`; }
    });
    return `<div class="inst fit">${s}</svg></div>`;
  }
  function renderWerk() {
    const W = S.werk, vl = W.mode === 'vlsm';
    $('#werkView').innerHTML = `<div class="card pl"><h4>Subnetting-Werkstatt</h4><div class="seg" role="group"><button data-m="split" class="${vl ? '' : 'on'}">In n gleich große Netze</button><button data-m="vlsm" class="${vl ? 'on' : ''}">VLSM nach Abteilungen</button></div>
      <label class="f"><span>Netz (Adresse/Präfix)</span><input id="wNet" inputmode="decimal" autocomplete="off" spellcheck="false" value="${esc(W.net)}"></label>
      ${vl ? `<div class="gh" style="padding:4px 0">Abteilungen (Name und benötigte Hosts)</div><div id="deps">${depRows()}</div><div class="btns" style="margin-top:4px"><button class="btn" data-a="add">+ Abteilung</button><button class="btn" data-a="sort">Zurücksetzen</button></div>`
        : `<label class="f"><span>Anzahl der Subnetze</span><input id="wN" inputmode="numeric" autocomplete="off" value="${esc(W.n)}"></label>`}</div><div id="wOut"></div>`;
    updateWerk();
  }
  const depRows = () => S.werk.deps.map((d, i) => `<div class="dep"><input class="nm" data-d="n" data-i="${i}" value="${esc(d.n)}" aria-label="Name der Abteilung ${i + 1}" autocomplete="off"><input class="hn" data-d="h" data-i="${i}" value="${esc(d.h)}" inputmode="numeric" aria-label="Hosts der Abteilung ${i + 1}" autocomplete="off"><button class="chip" data-del="${i}" aria-label="Abteilung entfernen">✕</button></div>`).join('');
  function updateWerk() {
    const o = $('#wOut'); if (!o) return; const W = S.werk; let h = '';
    const err = m => { o.innerHTML = `<div class="card pl"><div class="rdout bad">${esc(m)}</div></div>`; };
    if (W.mode === 'split') {
      const n = /^\d+$/.test(String(W.n).trim()) ? +W.n : NaN, r = C.splitEqual(W.net, n);
      if (!r.ok) return err(isNaN(n) ? 'Die Anzahl der Subnetze muss eine ganze Zahl sein.' : r.err);
      const shown = r.subs.slice(0, 256);
      h += `<div class="card pl"><h4>Ergebnis</h4><p class="hint2" style="margin-top:0">${r.rounded ? `${r.requested} Subnetze sind keine Zweierpotenz: aufgerundet auf <b>${r.count}</b>. ` : ''}Es werden ${Math.log2(r.count)} Bit geborgt: /${r.basePrefix} + ${Math.log2(r.count)} = <b>/${r.prefix}</b>, Maske ${shown[0].mask}, je ${nf(shown[0].total)} Adressen und ${nf(shown[0].hosts)} Hosts.</p>`;
      if (r.count <= 64) { const base = C.parseIP(r.base); h += svgBar(r.subs.map((s, i) => ({ off: s.n.net - base, size: s.total, l1: String(i + 1), l2: '/' + s.p })), C.parseCidr(W.net) ? Math.pow(2, 32 - r.basePrefix) : 1); }
      h += `<div class="scrx"><table class="tt"><thead><tr><th class="n">Nr.</th><th>Netzadresse</th><th>Erste Host</th><th>Letzte Host</th><th>Broadcast</th></tr></thead><tbody>${shown.map((s, i) => `<tr><td class="n">${i + 1}</td><td class="mono"><b>${s.network}/${s.p}</b></td><td class="mono">${s.first}</td><td class="mono">${s.last}</td><td class="mono">${s.broadcast || '–'}</td></tr>`).join('')}</tbody></table></div>${r.count > 256 ? '<p class="hint2">Angezeigt werden die ersten 256 Subnetze.</p>' : ''}</div>`;
    } else {
      const deps = [], bad = W.deps.findIndex(d => !/^\d+$/.test(String(d.h).trim()) || +d.h < 1);
      if (bad >= 0) return err('Abteilung ' + (bad + 1) + ': Die Hostzahl muss eine ganze Zahl ab 1 sein.');
      W.deps.forEach((d, i) => deps.push({ n: d.n.trim() || 'Abteilung ' + (i + 1), h: +d.h }));
      const r = C.vlsm(W.net, deps); if (!r.ok) return err(r.err);
      const base = C.parseIP(r.base), total = Math.pow(2, 32 - r.basePrefix);
      const blocks = r.list.map(x => ({ off: x.c.n.net - base, size: x.size, l1: x.name, l2: '/' + x.prefix })); if (r.free) blocks.push({ off: r.used, size: r.free, l1: 'frei', l2: '', free: true });
      h += `<div class="card pl"><h4>Ergebnis (absteigend nach Hosts sortiert)</h4><p class="hint2" style="margin-top:0">Je Abteilung: kleinste Zweierpotenz mit 2^h − 2 ≥ Hosts, Präfix = 32 − h. Lückenlos vergeben ab ${r.base}. ${r.free ? 'Frei: ' + r.freeFrom + ' bis ' + C.fmtIP(base + total - 1) + ' (' + nf(r.free) + ' Adressen).' : 'Das Netz ist vollständig belegt.'}</p>${svgBar(blocks, total)}
        <div class="scrx"><table class="tt"><thead><tr><th>Abteilung</th><th class="n">Hosts</th><th>Netzadresse</th><th>Maske</th><th>Erste bis letzte Host</th><th>Broadcast</th><th class="n">Frei</th></tr></thead><tbody>${r.list.map(x => `<tr><td><b>${esc(x.name)}</b></td><td class="n">${nf(x.h)}</td><td class="mono"><b>${x.c.network}/${x.prefix}</b></td><td class="mono">${x.c.mask}</td><td class="mono">${x.c.first} – ${x.c.last}</td><td class="mono">${x.c.broadcast || '–'}</td><td class="n">${nf(x.c.hosts - x.h)}</td></tr>`).join('')}</tbody></table></div></div>`;
    }
    o.innerHTML = h;
  }
  $('#werkView').addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'wNet') S.werk.net = t.value; else if (t.id === 'wN') S.werk.n = t.value; else if (t.dataset.d) S.werk.deps[+t.dataset.i][t.dataset.d] = t.value; else return;
    save('werk'); updateWerk();
  });
  $('#werkView').addEventListener('click', e => {
    const m = e.target.closest('[data-m]'), a = e.target.closest('[data-a]'), d = e.target.closest('[data-del]');
    if (m) { S.werk.mode = m.dataset.m; save('werk'); renderWerk(); }
    else if (a) { if (a.dataset.a === 'add') { if (S.werk.deps.length >= 16) return toast('Mehr als 16 Abteilungen sind nicht vorgesehen.'); S.werk.deps.push({ n: 'Abteilung ' + (S.werk.deps.length + 1), h: '10' }); } else S.werk.deps = DEF_DEPS.map(x => Object.assign({}, x)); save('werk'); renderWerk(); }
    else if (d) { if (S.werk.deps.length <= 1) return toast('Mindestens eine Abteilung bleibt stehen.'); S.werk.deps.splice(+d.dataset.del, 1); save('werk'); renderWerk(); }
  });

  /* ============================================================ Reiter Gleiches Netz? */
  function renderSame() {
    $('#sameView').innerHTML = `<div class="card pl"><h4>Gleiches Netz? Gateway-Prüfung</h4><div class="dsrow"><label class="f"><span>Host A</span><input id="sA" inputmode="decimal" autocomplete="off" spellcheck="false" value="${esc(S.same.a)}"></label><label class="f"><span>Host B</span><input id="sB" inputmode="decimal" autocomplete="off" spellcheck="false" value="${esc(S.same.b)}"></label></div>
      <div class="dsrow"><label class="f"><span>Maske (/n oder 255.255.…)</span><input id="sM" inputmode="decimal" autocomplete="off" spellcheck="false" value="${esc(S.same.m)}"></label><label class="f"><span>Standardgateway (optional)</span><input id="sG" inputmode="decimal" autocomplete="off" spellcheck="false" value="${esc(S.same.gw)}"></label></div></div><div id="sOut"></div>`;
    updateSame();
  }
  const GWTXT = { ok: 'liegt im Netz des Hosts und ist eine nutzbare Hostadresse: plausibel.', other: 'liegt in einem anderen Subnetz als der Host: Der Host erreicht es nicht direkt.', net: 'ist die Netzadresse, keine Hostadresse.', bcast: 'ist die Broadcast-Adresse, keine Hostadresse.', self: 'hat dieselbe Adresse wie der Host: Adresskonflikt.' };
  function updateSame() {
    const o = $('#sOut'), Y = S.same; if (!o) return;
    const bad = C.parseIP(Y.a) === null ? 'Host A ist keine gültige IP-Adresse.' : C.parseIP(Y.b) === null ? 'Host B ist keine gültige IP-Adresse.' : C.parsePrefix(Y.m) === null ? 'Die Maske ist ungültig (z. B. /24 oder 255.255.255.0, nur zusammenhängende Einsen).' : '';
    if (bad) { o.innerHTML = `<div class="card pl"><div class="rdout bad">${esc(bad)}</div></div>`; return; }
    const s = C.sameNet(Y.a, Y.b, Y.m), ca = C.calc(Y.a, Y.m), cb = C.calc(Y.b, Y.m); let h = `<div class="card pl"><h4>Ergebnis</h4>`;
    h += `<div class="verd ${s.same ? 'ok' : 'bad'}"><b class="v">${s.same ? 'Ja, im selben Subnetz' : 'Nein, in verschiedenen Subnetzen'}</b><br>Netz von A: <b class="mono">${s.netA}/${s.p}</b><br>Netz von B: <b class="mono">${s.netB}/${s.p}</b><br>${s.same ? 'A und B erreichen sich direkt, ohne Router.' : 'Für die Kommunikation ist ein Router (Gateway) nötig.'}</div>`;
    [['A', ca], ['B', cb]].forEach(([nm, c]) => { if (c.p <= 30 && (c.ip === c.network || c.ip === c.broadcast)) h += `<div class="verd bad">Hinweis: Host ${nm} (${c.ip}) ist die ${c.ip === c.network ? 'Netzadresse' : 'Broadcast-Adresse'} seines Netzes und keine gültige Hostadresse.</div>`; });
    if (Y.a.trim() === Y.b.trim()) h += '<div class="verd bad">Hinweis: A und B haben dieselbe Adresse (Adresskonflikt).</div>';
    if (Y.gw.trim()) {
      if (C.parseIP(Y.gw) === null) h += '<div class="verd bad">Das Standardgateway ist keine gültige IP-Adresse.</div>';
      else [['A', Y.a], ['B', Y.b]].forEach(([nm, ip]) => { const g = C.gwCheck(ip, Y.gw, Y.m); h += `<div class="verd ${g.ok ? 'ok' : 'bad'}"><b class="v">Gateway für ${nm}: ${g.ok ? 'plausibel' : 'nicht plausibel'}</b><br>${esc(C.fmtIP(C.parseIP(Y.gw)))} ${GWTXT[g.reason]}${g.reason === 'other' ? ' Netz von ' + nm + ': ' + g.network + '/' + ca.p + '.' : ''}</div>`; });
    }
    o.innerHTML = h + '</div>';
  }
  $('#sameView').addEventListener('input', e => { const k = { sA: 'a', sB: 'b', sM: 'm', sG: 'gw' }[e.target.id]; if (!k) return; S.same[k] = e.target.value; save('same'); updateSame(); });

  /* ============================================================ Reiter Schichten und Ports */
  function renderOsi() {
    $('#osiView').innerHTML = `<div class="card pl"><h4>OSI-Modell und TCP/IP-Modell</h4><div class="scrx"><table class="tt"><thead><tr><th class="n">Nr.</th><th>OSI-Schicht</th><th>Einheit</th><th>Beispiele</th><th>TCP/IP</th></tr></thead><tbody>${C.OSI.map(o => `<tr><td class="n"><b>${o.n}</b></td><td><b>${o.name}</b></td><td>${esc(o.pdu)}</td><td>${esc(o.bsp)}</td><td>${C.TCPIP[o.tcpip]}</td></tr>`).join('')}</tbody></table></div>
      <p class="hint2">Merkhilfe für die Geräte: Hub = Schicht 1, Switch = Schicht 2 (arbeitet mit MAC-Adressen), Router = Schicht 3 (arbeitet mit IP-Adressen). /* PRUEFEN */ Das TCP/IP-Modell wird mit 4 oder 5 Schichten gelehrt; hier gilt das 4-Schichten-Modell.</p></div>
      <div class="card pl"><h4>Typische Ports</h4><div class="scrx"><table class="tt"><thead><tr><th class="n">Port</th><th>Dienst</th><th>Transport</th></tr></thead><tbody>${C.PORTS.map(p => `<tr><td class="n"><b>${p[1]}</b></td><td>${esc(p[0])}</td><td>${esc(p[2])}</td></tr>`).join('')}</tbody></table></div></div>
      <div class="btns"><button class="btn pri" data-go="schicht">🎲 Zuordnung üben</button></div>`;
  }
  $('#osiView').addEventListener('click', e => { if (e.target.closest('[data-go]')) { S.tr.cat = 'schicht'; setTab('rt'); newTrainer(); } });

  /* ============================================================ Reiter Beispiele */
  function renderBsp() {
    const ex = EX.find(x => x.id === S.bsp); let h = '';
    if (ex) h += `<div class="card pl" style="border-color:var(--accent)"><h4>Beispiel</h4><div class="big">${esc(ex.title)}</div><p class="hint2" style="margin:0">${esc(ex.sub)}</p><ol class="st">${ex.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
      <div class="btns"><button class="btn pri" data-ld="${esc(ex.id)}">In ${esc(tabName(ex.tab))} laden</button><button class="btn" data-x="close">Schließen</button></div></div>`;
    h += `<p class="hint2" style="margin:4px 0 0">${EX.length} fertige Beispiele zum Ansehen. Mit „Laden“ übernimmt das passende Werkzeug die Werte, dann kannst du selbst weiterprobieren.</p>`;
    EX.forEach(x => { h += `<button class="row" data-ex="${esc(x.id)}"><span class="dot${S.bsp === x.id ? ' g' : ''}">${S.bsp === x.id ? '▸' : ''}</span><div class="grow"><b>${esc(x.title)}</b><small>${esc(x.sub)}</small></div></button>`; });
    $('#bspView').innerHTML = h;
  }
  const tabName = k => (TABS.find(t => t[0] === k) || [0, 0, k])[2];
  function loadExample(ex) {
    const l = ex.load;
    if (ex.tab === 'calc') { S.calc.ip = l.ip; S.calc.m = l.m; save('calc'); }
    else if (ex.tab === 'bin') { S.bin.ip = l.ip; S.bin.m = l.m; S.bin.v = l.v; save('bin'); }
    else if (ex.tab === 'same') { S.same = { a: l.a, b: l.b, m: l.m, gw: l.gw }; save('same'); }
    else if (ex.tab === 'werk') { S.werk.mode = l.mode; S.werk.net = l.net; if (l.deps) S.werk.deps = l.deps.map(d => ({ n: d.n, h: String(d.h) })); if (l.n) S.werk.n = l.n; save('werk'); }
    setTab(ex.tab); toast('Beispiel geladen: ' + ex.title);
  }
  $('#bspView').addEventListener('click', e => {
    const r = e.target.closest('[data-ex]'), l = e.target.closest('[data-ld]'), x = e.target.closest('[data-x]');
    if (r) { S.bsp = r.dataset.ex; renderBsp(); $('#pgBsp').scrollTop = 0; } else if (l) loadExample(EX.find(y => y.id === l.dataset.ld)); else if (x) { S.bsp = null; renderBsp(); }
  });

  /* ============================================================ Fragen: Eingabe und Prüfung (Aufgaben und Trainer) */
  function qHTML(q, a, locked, ok) {
    if (q.ask.type === 'choice') return `<div class="opts">${q.ask.choices.map((c, i) => `<button data-qc="${i}" ${locked ? 'disabled' : ''} class="${ok === true && i === q.ans ? 'ok' : a.c === i ? (ok === false ? 'bad' : 'on') : ''}">${esc(c)}</button>`).join('')}</div>`;
    const ph = { ip: 'z. B. 192.168.0.0', bin: 'z. B. 10110101', num: '' }[q.ask.type];
    return `<label class="f"><span>${esc(q.ask.label)}</span><div class="qin"><input class="qIn" inputmode="${q.ask.type === 'ip' ? 'decimal' : 'numeric'}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${ph}" value="${esc(a.v || '')}" ${locked ? 'disabled' : ''}>${q.ask.unit ? `<span class="u">${esc(q.ask.unit)}</span>` : ''}</div></label>`;
  }
  function qVerify(q, a) {
    if (q.ask.type === 'choice') { if (a.c == null) return { err: 'Wähle zuerst eine Antwort.' }; return { ok: C.check(q, a.c), given: q.ask.choices[a.c] }; }
    const v = (a.v || '').trim(); if (!v) return { err: 'Bitte gib eine Antwort ein.' };
    if (q.ask.type === 'ip' && C.parseIP(v) === null) return { err: 'Das ist keine gültige IP-Adresse: vier Zahlen von 0 bis 255, durch Punkte getrennt.' };
    if (q.ask.type === 'num' && !/^\/?\d+$/.test(v.replace(/\s/g, ''))) return { err: 'Bitte gib eine ganze Zahl ein.' };
    if (q.ask.type === 'bin' && C.fromBin(v) === null) return { err: 'Bitte nur 0 und 1 eingeben (z. B. 10110101).' };
    return { ok: C.check(q, v), given: v };
  }
  function tipSheet(q, n, ex, trainer) {
    sheet('Tipp, Stufe ' + n + (trainer ? ' von 2' : ' von 3'), b => {
      let x = `<p style="margin-top:0"><b>Stufe 1:</b> ${esc(q.tips[0])}</p>`;
      if (n >= 2) x += `<p><b>Stufe 2:</b> ${esc(q.tips[1])}</p>`;
      if (n >= 3) x += `<p><b>Stufe 3:</b> Die Lösung lautet <b>${esc(q.sol)}</b>.</p>`;
      else x += '<p class="hint2">Noch mehr Hilfe? Tippe noch einmal auf „Tipp“ für die nächste Stufe.</p>';
      x += trainer ? '<p class="hint2">Im Trainer kosten Tipps nichts.</p>' : ex ? '<p class="hint2" style="color:var(--warn)">Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte. Mit Stufe 3 zählt die Aufgabe nicht mehr.</p>' : '<p class="hint2">Beim normalen Üben kosten Tipps nichts. Im Prüfmodus (🎓) zählen sie.</p>';
      b.innerHTML = x;
    });
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
  const nDone = () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)).length;
  function updateBadge() { const b = $('#tkBd'); if (b) b.textContent = nDone() + '/' + TASKS.length; }
  const curTask = () => S.task && TASKS.find(t => t.id === S.task);
  function checkTask(t) {
    const q = qOf(t), a = S.tAns[t.id] || {}, v = qVerify(q, a); if (v.err) { toast(v.err); return; }
    const ok = v.ok, pct = ok ? pctFor(t.id) : 0, ex = exam();
    S.tRes = { id: t.id, ok, pct, text: ok ? 'Richtig: ' + v.given : 'Deine Antwort „' + v.given + '“ stimmt nicht.' };
    if (ok) { markSolved(t.id, pct); if (pct === 0) toast('Mit angezeigter Lösung zählt die Aufgabe im Prüfmodus nicht.'); else { const F = fx(); if (F && F.pass) try { F.pass(pct); } catch (e) { ding(); } else ding(); toast(ex && pct < 100 ? pct + ' % (Tipps abgezogen)' : '🎉 Geschafft!'); } } else { sad(); toast('Noch nicht richtig. Nutze einen Tipp oder lies die Erklärung.'); }
    renderTasks(false);
  }
  function hintTask(t) {
    const q = qOf(t), h = lsGet('hints', {}), n = Math.min(3, (h[t.id] || 0) + 1), ex = exam();
    h[t.id] = Math.max(h[t.id] || 0, n); lsSet('hints', h);
    if (ex) { const c = lsGet('ctipps', {}); c[t.id] = Math.max(c[t.id] || 0, n); lsSet('ctipps', c); }
    tipSheet(q, n, ex, false);
  }
  function renderTasks(top) {
    const V = $('#taskView'), d = done(), prog = lsGet('prog', {}), t = curTask(); let h = '';
    if (t) {
      const q = qOf(t), r = S.tRes && S.tRes.id === t.id ? S.tRes : null, a = S.tAns[t.id] || {};
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv">${dots(t.level)}</div><p style="margin:8px 0">${esc(q.text)}</p>`;
      h += qHTML(q, a, !!(r && r.ok), r ? r.ok : null);
      h += `<div class="btns"><button class="btn pri" data-ta="chk"${r && r.ok ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" data-ta="hint">💡 Tipp</button><button class="btn" data-ta="close">Schließen</button></div>`;
      if (exam()) h += '<p class="hint2" style="color:var(--warn)">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>';
      if (r) {
        h += `<ul class="tl"><li class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓' : '✗'} ${esc(r.text)}</li></ul>`;
        if (r.ok || !exam()) h += `<div class="rdout ${r.ok ? 'ok' : 'bad'}"><b>Lösung:</b> ${esc(q.sol)}<br>${esc(q.expl)}</div>`;
        else h += '<div class="rdout bad">🎓 Prüfmodus: Die Erklärung gibt es erst, wenn die Aufgabe richtig gelöst ist. Nutze einen Tipp oder versuche es noch einmal.</div>';
        if (r.ok) h += '<div class="btns"><button class="btn pri" data-ta="next">Nächste Aufgabe</button></div>';
      }
      h += '</div>';
    }
    h += `<p class="hint2" style="margin:4px 0 0">${nDone()} von ${TASKS.length} Aufgaben gelöst. ${exam() ? '🎓 Prüfmodus ist an.' : 'Tipp: Im Prüfmodus (🎓 oben) zählen Tipps als Abzug.'}</p>`;
    let last = '';
    TASKS.forEach(x => { if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; } const p = prog[x.id]; h += `<button class="row" data-t="${esc(x.id)}"><span class="dot ${d[x.id] ? 'g' : p > 0 ? 'p' : ''}">${d[x.id] ? '✓' : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${dots(x.level)}</span>${p != null && !d[x.id] ? ' · bisher ' + p + ' %' : ''}</small></div></button>`; });
    V.innerHTML = h; if (top !== false) $('#pgTasks').scrollTop = 0;
  }
  $('#taskView').addEventListener('input', e => { const t = curTask(); if (t && e.target.classList.contains('qIn')) (S.tAns[t.id] = S.tAns[t.id] || {}).v = e.target.value; });
  $('#taskView').addEventListener('keydown', e => { const t = curTask(); if (t && e.key === 'Enter' && e.target.classList.contains('qIn')) { e.preventDefault(); checkTask(t); } });
  $('#taskView').addEventListener('click', e => {
    const t = curTask(), tc = e.target.closest('[data-qc]'), ta = e.target.closest('[data-ta]'), row = e.target.closest('.row[data-t]');
    if (tc && t) { (S.tAns[t.id] = S.tAns[t.id] || {}).c = +tc.dataset.qc; if (S.tRes && !S.tRes.ok) S.tRes = null; renderTasks(false); return; }
    if (ta && t) { const a = ta.dataset.ta; if (a === 'chk') checkTask(t); else if (a === 'hint') hintTask(t); else if (a === 'close') { S.task = null; S.tRes = null; renderTasks(); } else if (a === 'next') { const i = TASKS.findIndex(x => x.id === t.id), nx = TASKS.slice(i + 1).find(x => !done()[x.id]) || TASKS[(i + 1) % TASKS.length]; startTask(nx.id); } return; }
    if (row) startTask(row.dataset.t);
  });
  function startTask(id) {
    S.task = id; S.tAns = {}; S.tRes = null;
    const h = lsGet('hints', {}), c = lsGet('ctipps', {}); if (h[id]) { delete h[id]; lsSet('hints', h); } if (c[id]) { delete c[id]; lsSet('ctipps', c); }
    renderTasks();
  }

  /* ============================================================ Zufalls-Trainer */
  const TCATS = [['all', 'Alle'], ['bin', 'Binär'], ['sub', 'Subnetting'], ['vlsm', 'VLSM'], ['adr', 'Adressierung'], ['schicht', 'Schichten/Ports']];
  function newTrainer() { const T = S.tr; T.q = C.gen(R0, T.cat, T.level); T.ans = {}; T.res = null; T.tip = 0; renderTrainer(); }
  function renderTrainer() {
    const T = S.tr, V = $('#rtView'); if (!T.q) { T.q = C.gen(R0, T.cat, T.level); T.tip = 0; }
    const q = T.q, r = T.res;
    let h = `<div class="card pl"><h4>Zufalls-Trainer</h4><div class="seg" role="group" style="flex-wrap:wrap">${TCATS.map(c => `<button data-rc="${c[0]}" class="${T.cat === c[0] ? 'on' : ''}">${c[1]}</button>`).join('')}</div>
      <div class="seg" role="group">${[1, 2, 3].map(l => `<button data-rl="${l}" class="${T.level === l ? 'on' : ''}" aria-label="Stufe ${l}">Stufe ${l} ${dots(l)}</button>`).join('')}</div>
      <div class="stats"><div class="bx"><b>${S.rt.streak}</b>Serie</div><div class="bx"><b>${S.rt.best}</b>Beste Serie</div><div class="bx"><b>${S.rt.ok}/${S.rt.n}</b>richtig</div></div>
      <div class="lv">${dots(q.level)} · ${esc(C.CATS[q.cat])}</div><p style="margin:8px 0">${esc(q.text)}</p>${qHTML(q, T.ans, !!r, r ? (r.shown ? null : r.ok) : null)}
      <div class="btns"><button class="btn pri" data-ra="chk"${r ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" data-ra="hint"${r ? ' disabled' : ''}>💡 Tipp</button><button class="btn" data-ra="show"${r ? ' disabled' : ''}>Lösung</button><button class="btn" data-ra="next">${r ? 'Nächste Frage' : 'Überspringen'}</button></div>`;
    if (r) h += `<div class="rdout ${r.ok ? 'ok' : 'bad'}"><b>${r.ok ? '✓ Richtig!' : r.shown ? 'Lösung:' : '✗ Leider falsch. Lösung:'}</b> ${esc(q.sol)}<br>${esc(q.expl)}</div>`;
    V.innerHTML = h + '</div>';
  }
  function trainerAnswered(ok) { const s = S.rt; s.n++; if (ok) { s.ok++; s.streak++; if (s.streak > s.best) s.best = s.streak; } else s.streak = 0; lsSet('rt', s); updatePal(); }
  $('#rtView').addEventListener('input', e => { if (e.target.classList.contains('qIn')) S.tr.ans.v = e.target.value; });
  $('#rtView').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.classList.contains('qIn')) { e.preventDefault(); trainerCheck(); } });
  function trainerCheck() {
    const T = S.tr; if (T.res) return; const v = qVerify(T.q, T.ans); if (v.err) return toast(v.err);
    T.res = { ok: v.ok }; trainerAnswered(v.ok); if (v.ok) { const F = fx(); if (F && F.pass) try { F.pass(100); } catch (e) { ding(); } else ding(); } else sad(); renderTrainer();
  }
  $('#rtView').addEventListener('click', e => {
    const T = S.tr, c = e.target.closest('[data-rc]'), l = e.target.closest('[data-rl]'), a = e.target.closest('[data-ra]'), qc = e.target.closest('[data-qc]');
    if (c) { T.cat = c.dataset.rc; newTrainer(); } else if (l) { T.level = +l.dataset.rl; newTrainer(); }
    else if (qc) { if (!T.res) { T.ans.c = +qc.dataset.qc; renderTrainer(); } }
    else if (a) {
      const k = a.dataset.ra;
      if (k === 'chk') trainerCheck();
      else if (k === 'hint') { T.tip = Math.min(2, (T.tip || 0) + 1); tipSheet(T.q, T.tip, false, true); }
      else if (k === 'show') { if (!T.res) { T.res = { ok: false, shown: true }; trainerAnswered(false); renderTrainer(); } }
      else if (k === 'next') { if (!T.res) { S.rt.streak = 0; lsSet('rt', S.rt); updatePal(); } newTrainer(); }
    }
  });

  /* ============================================================ Hilfe */
  function renderHelp() {
    const rows = [8, 12, 16, 20, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32].map(p => { const c = C.calc('10.0.0.0', p); return `<tr><td><b>/${p}</b></td><td class="mono">${c.mask}</td><td class="n">${nf(c.total)}</td><td class="n">${nf(c.hosts)}</td></tr>`; }).join('');
    const sec = (t, b, o) => `<details${o ? ' open' : ''}><summary>${t}</summary><div class="hb2">${b}</div></details>`;
    $('#helpView').innerHTML =
      sec('Binär und Stellenwerte', `<p>Ein Oktett hat 8 Bit mit den Stellenwerten:</p><table><tr><th>128</th><th>64</th><th>32</th><th>16</th><th>8</th><th>4</th><th>2</th><th>1</th></tr></table><p>Dezimal nach Binär: von links jeden Stellenwert abziehen, wenn er noch passt (1), sonst 0. Binär nach Dezimal: die Stellenwerte der Einsen addieren. Beispiel: 10110101 = 128 + 32 + 16 + 4 + 1 = 181.</p>`, true)
      + sec('Formeln', `<span class="eq">Hostbits h = 32 − Präfix</span><span class="eq">Adressen im Netz = 2^h</span><span class="eq">Nutzbare Hosts = 2^h − 2</span><span class="eq">Blockgröße = 256 − Maskenwert (im interessanten Oktett)</span><span class="eq">Netzadresse = IP UND Maske</span><span class="eq">Broadcast = alle Hostbits 1 = Netzadresse + Blockgröße − 1</span><span class="eq">Wildcard = 255 − Maske (je Oktett)</span><p>Subnetze teilen: n Subnetze brauchen b Bit mit 2^b ≥ n, neuer Präfix = alter Präfix + b.</p><p>VLSM: Abteilungen absteigend nach Hosts sortieren, je Abteilung die kleinste Zweierpotenz mit 2^h − 2 ≥ Hosts wählen, lückenlos ab der Netzadresse vergeben.</p>`)
      + sec('Präfix, Maske und Hosts', `<table><tr><th>Präfix</th><th>Maske</th><th>Adressen</th><th>Hosts</th></tr>${rows}</table><p>Maskenwerte im interessanten Oktett: 128, 192, 224, 240, 248, 252, 254, 255 (1 bis 8 Einsen). Die Blockgröße ist 128, 64, 32, 16, 8, 4, 2, 1.</p><p><b>/31</b> (RFC 3021): 2 nutzbare Adressen für Punkt-zu-Punkt-Verbindungen. <b>/32</b>: eine einzelne Host-Adresse. /* PRUEFEN */ Manche Lehrbücher nennen dafür 0 Hosts.</p>`)
      + sec('Merkregeln', `<p><b>Zweierpotenzen:</b> 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096.</p><p><b>Privat (RFC 1918):</b> 10.0.0.0/8, 172.16.0.0/12 (172.16 bis 172.31), 192.168.0.0/16.</p><p><b>Sonderbereiche:</b> 127.0.0.0/8 Loopback, 169.254.0.0/16 APIPA (kein DHCP erreichbar), 224.0.0.0/4 Multicast.</p><p><b>Klassen:</b> A 1–126 (/8), B 128–191 (/16), C 192–223 (/24), D 224–239, E ab 240.</p><p><b>Gateway:</b> liegt im selben Subnetz wie der Host, ist weder Netz- noch Broadcast-Adresse.</p><p><b>Vorgehen:</b> Maske in Punktschreibweise, interessantes Oktett suchen, Blockgröße bilden, Vielfaches unterhalb der IP-Zahl = Netzadresse.</p>`)
      + sec('Schichten und Ports', `<p>OSI: 7 Anwendung, 6 Darstellung, 5 Sitzung, 4 Transport, 3 Vermittlung, 2 Sicherung, 1 Bitübertragung. Hub = 1, Switch = 2, Router = 3; Ethernet = 2, IP = 3, TCP/UDP = 4, HTTP/DNS/SSH = 7.</p><p>Ports: SSH 22, Telnet 23, SMTP 25, DNS 53, DHCP 67/68, HTTP 80, POP3 110, IMAP 143, HTTPS 443, RDP 3389. Alle Details im Reiter „Schichten und Ports“.</p>`)
      + sec('Prüfmodus und Tipps', '<p>Beim normalen Üben kosten Tipps nichts. Im Prüfmodus (🎓) kostet jede Tipp-Stufe 25 % der Punkte; Stufe 3 verrät die Lösung, dann zählt die Aufgabe nicht. Die Erklärung gibt es im Prüfmodus erst nach der richtigen Antwort.</p>')
      + sec('Aufrufe', '<p><span class="eq">netlab.html?aufgabe=net1</span><span class="eq">netlab.html?bsp</span></p>');
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'calc'; S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    ({ bin: renderBin, calc: renderCalc, werk: renderWerk, same: renderSame, osi: renderOsi, bsp: renderBsp, tasks: renderTasks, rt: renderTrainer, help: renderHelp })[t]();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'Netzwerk-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = 'Netzwerk-Lab: ' + T[2];
    const ab = $('.tab.on'); if (ab && ab.scrollIntoView) try { ab.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {}
  }
  function setExam(on) { lsSet('exam', on ? '1' : '0'); updatePal(); $('#bExam').classList.toggle('on', on); $('#bExam').setAttribute('aria-pressed', on); toast(on ? '🎓 Prüfmodus an: Tipps kosten 25 % je Stufe.' : 'Prüfmodus aus: Tipps kosten nichts.'); if (S.tab === 'tasks') renderTasks(false); }
  let palSig = '';
  function updatePal() {
    const F = !!fx(), fxOn = F && !fx().isMuted(), sig = [F, fxOn, exam(), nDone(), S.rt.streak, S.rt.best].join('|'); if (sig === palSig) return; palSig = sig;
    $('#pal').innerHTML = `${F ? `<button class="chip ${fxOn ? 'on' : ''}" data-a="fx" aria-pressed="${fxOn}" title="Effekte und Ton">${fxOn ? '🎉' : '🔇'} Effekte</button>` : ''}<button class="chip ${exam() ? 'on' : ''}" data-a="exam" aria-pressed="${exam()}" title="Prüfmodus: Tipps zählen als Abzug">🎓 Prüfmodus</button><button class="chip" data-a="rand" title="Zufällige Frage im Trainer">🎲 Zufallsaufgabe</button>
      <span id="stat">Aufgaben gelöst <b>${nDone()}/${TASKS.length}</b> · Serie <b>${S.rt.streak}</b> · Beste Serie <b>${S.rt.best}</b></span>`;
    $('#bExam').classList.toggle('on', exam());
  }
  $('#pal').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.a === 'fx') { const F = fx(); if (F) { F.setMuted(!F.isMuted()); palSig = ''; updatePal(); if (!F.isMuted()) ding(); } }
    else if (b.dataset.a === 'exam') setExam(!exam());
    else if (b.dataset.a === 'rand') { setTab('rt'); newTrainer(); }
  });
  $('#bTasks').onclick = () => setTab('tasks'); $('#bHelp').onclick = () => setTab('help'); $('#bExam').onclick = () => setExam(!exam());
  $('#title').onclick = () => setTab('calc');
  $('#bMenu').onclick = () => {
    const rows = [['bsp', 'Beispiele', EX.length + ' fertige Beispiele zum Ansehen und Laden'], ['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung und Tipps'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Fragen mit Serien-Zähler'], ['help', 'Hilfe und Spickzettel', 'Formeln, Präfix-Tabelle, Merkregeln'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben und Trainer-Serie auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
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
      b.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (!x) return; if (x.dataset.x === 'yes') { ['done', 'prog', 'hints', 'ctipps', 'rt'].forEach(k => { try { localStorage.removeItem(LS + k); } catch (er) {} }); S.rt = { n: 0, ok: 0, streak: 0, best: 0 }; S.task = null; S.tRes = null; palSig = ''; updatePal(); updateBadge(); if (S.tab === 'tasks') renderTasks(); else if (S.tab === 'rt') renderTrainer(); toast('Fortschritt gelöscht'); } close(); });
    });
  }

  /* Schnittstelle für Karriere/Lernpfad */
  root.NET_LAB = { id: 'net', title: 'Netzwerk-Lab', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.NET_TASKS };

  buildTabs(); updatePal(); setTab(S.tab);
  /* Aufrufe ?aufgabe=net1 (Startseite, Lernhefte) und ?bsp / ?bsp=bsp3 (Beispielauswahl) */
  root.LabGoto = id => { try { if (TASKS.some(t => t.id === id)) { setTab('tasks'); startTask(id); return true; } } catch (e) {} return false; };
  try {
    const q = new URLSearchParams(location.search), qa = q.get('aufgabe');
    if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); }
    else if (q.has('bsp')) { const b = q.get('bsp'); S.bsp = EX.some(x => x.id === b) ? b : null; setTab('bsp'); }
  } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
