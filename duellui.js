/* duellui.js - Oberflaeche des Pruefungs-Duells (Paket D2). Wird von duell.js bei Bedarf geladen (Chip, Startseiten-Band, ?duell=, Duell.open).
   Dialoge: Lobby, Neues Duell (Rundencode + QR), Beitreten, Countdown, Chip im Lab, Ergebnis (TFD1 + QR), Vergleich, Blitz-Duell (Rechnen, vom SchaltLab).
   Im Duell gesperrt: Tipp 3 (in auswertung.js), Aufloesung/"Fehler zeigen" (Klick-Sperre unten). Es wird nie Fehlername oder Ursache angezeigt:
   Ergebnis und Lernhinweis arbeiten nur mit Zahlen (Punkte, Zeit, Tipps, Versuche, Messungen). */
(function (root) {
  'use strict';
  const D = root.Duell; if (!D || D.ui) return;
  const C = D.core, W = D.W, doc = document;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const lsGet = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const el = (tag, cls, html) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const fmt = ms => { const s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const KRE = /^[A-Za-z0-9ÄÖÜäöüß_.-]{2,24}$/;   /* wie stand.js und Duell.core.KRE */
  const rows = () => C.pool(root.AUFGABEN || []);
  const taskRow = id => (root.AUFGABEN || []).find(r => r[0] === id) || null;
  const labName = id => (root.LAB_REG && root.LAB_REG[id] && root.LAB_REG[id].name) || id;
  const labFile = id => (root.LAB_REG && root.LAB_REG[id] && root.LAB_REG[id].file) || 'index.html';
  const labApi = () => { try { const a = root.LabDuellAPI; return a ? { m: typeof a.messungen === 'function' ? a.messungen() : null, mp: a.messpunkte == null ? null : a.messpunkte } : {}; } catch (e) { return {}; } };

  /* ---------- Toast ---------- */
  function toast(msg) {
    const old = doc.getElementById('dlToast'); if (old) old.remove();
    const t = el('div', 'dl dl-toast', esc(msg)); t.id = 'dlToast'; t.setAttribute('role', 'status'); doc.body.appendChild(t); setTimeout(() => t.remove(), 3200);
  }

  /* ---------- Dialog-Gerüst ---------- */
  function modal(title, wide) {
    const old = doc.getElementById('dlBox'); if (old) old.remove();
    const ov = el('div', 'dl dl-ov'); ov.id = 'dlBox';
    const box = el('div', 'dl-box' + (wide ? ' wide' : '')); box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', title);
    const hd = el('div', 'dl-hd', '<b>' + esc(title) + '</b>'), x = el('button', 'dl-x0', '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Schließen'); hd.appendChild(x);
    const body = el('div'); box.appendChild(hd); box.appendChild(body); ov.appendChild(box); doc.body.appendChild(ov);
    const close = () => { ov.remove(); doc.removeEventListener('keydown', key, true); };
    const key = e => { if (e.key === 'Escape') close(); };
    x.onclick = close; ov.addEventListener('mousedown', e => { if (e.target === ov) close(); }); doc.addEventListener('keydown', key, true);
    setTimeout(() => { try { x.focus(); } catch (e) {} }, 0);
    return { ov, box, body, close };
  }

  /* ---------- QR (qr.js bei Bedarf nachladen) ---------- */
  function qrInto(host, text) {
    const draw = () => { try { const q = root.qrcode(0, 'M'); q.addData(String(text), 'Byte'); q.make(); host.innerHTML = q.createSvgTag({ cellSize: 4, margin: 4, scalable: true }); host.setAttribute('role', 'img'); host.setAttribute('aria-label', 'QR-Code'); } catch (e) { host.textContent = 'QR nicht möglich (Text zu lang)'; } };
    if (root.qrcode) { draw(); return; }
    const s = doc.createElement('script'); s.src = 'qr.js'; s.onload = draw; s.onerror = () => { host.textContent = 'QR nicht verfügbar'; }; doc.head.appendChild(s);
  }
  const copy = (text, ta) => { try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(() => toast('Kopiert'), () => sel()); return; } } catch (e) {} sel(); function sel() { if (ta) { ta.focus(); ta.select(); try { doc.execCommand('copy'); toast('Kopiert'); } catch (e) { toast('Bitte Text markieren und kopieren'); } } } };

  /* ---------- Countdown ---------- */
  function countdown(done) {
    let n = 3; const ov = el('div', 'dl dl-cd'); ov.setAttribute('role', 'timer'); ov.setAttribute('aria-live', 'assertive'); doc.body.appendChild(ov);
    const step = () => { if (n > 0) { ov.textContent = n--; try { if (root.LochFX) root.LochFX.sound('tick'); } catch (e) {} setTimeout(step, 800); } else { ov.remove(); done(); } };
    step();
  }

  /* ---------- Kürzel, Jahrgang, Stufe, Lab ---------- */
  const thisYear = () => new Date().getFullYear();
  const jgDefault = () => { const j = lsGet('lm4.jahrgang').replace(/"/g, ''); return /^\d{4}$/.test(j) ? j : String(thisYear()); };
  const stDefault = j => Math.min(3, Math.max(1, thisYear() - (+j || thisYear()) + 1));
  function formHtml(o) {
    const y = thisYear(), j = o.j; let jo = ''; for (let i = y; i >= y - 5; i--) jo += `<option value="${i}"${String(i) === String(j) ? ' selected' : ''}>${i}</option>`;
    const labs = {}; rows().forEach(r => { labs[r[1]] = 1; });
    const lo = '<option value="">Alle Fehlersuchen</option>' + Object.keys(labs).sort((a, b) => labName(a) < labName(b) ? -1 : 1).map(l => `<option value="${l}"${l === o.lab ? ' selected' : ''}>${esc(labName(l))}</option>`).join('');
    return `<div class="dl-two"><div><label for="dlK">Dein Kürzel (kein Klarname)</label><input type="text" id="dlK" maxlength="12" autocomplete="off" autocapitalize="off" value="${esc(o.k)}" placeholder="az07"></div>
      <div><label for="dlJ">Jahrgang</label><select id="dlJ">${jo}</select></div></div>
      <label id="dlStL">Stufe (Lehrjahr)</label><div class="dl-seg" role="group" aria-labelledby="dlStL">${[1, 2, 3].map(i => `<button type="button" class="dl-btn" data-st="${i}" aria-pressed="${i === o.st}">${i}</button>`).join('')}</div>
      <label for="dlL">Lab</label><select id="dlL">${lo}</select><div class="dl-err" id="dlE" role="alert"></div>`;
  }
  function readForm(b, o) {
    const k = b.querySelector('#dlK').value.trim(); o.k = k; o.j = b.querySelector('#dlJ').value; o.lab = b.querySelector('#dlL').value;
    const p = b.querySelector('[data-st][aria-pressed=true]'); o.st = p ? +p.dataset.st : 2; return o;
  }
  function wireSeg(b, onChange) {
    b.querySelectorAll('[data-st]').forEach(x => { x.onclick = () => { b.querySelectorAll('[data-st]').forEach(y => y.setAttribute('aria-pressed', String(y === x))); onChange && onChange(); }; });
    ['#dlL', '#dlJ', '#dlK'].forEach(s => { const e = b.querySelector(s); if (e) e.onchange = () => onChange && onChange(); });
  }
  function checkId(b, o) { const e = b.querySelector('#dlE'); if (!KRE.test(o.k)) { e.textContent = 'Bitte ein Kürzel eintragen (2 bis 24 Zeichen: Buchstaben, Ziffern, _ . -).'; return false; } e.textContent = ''; return true; }
  const joinStr = o => o.r + ' · Stufe ' + o.st + (o.lab ? ' · ' + o.lab : '');

  /* ---------- Start des Duells (nach Countdown) ---------- */
  function begin(o, row) {
    lsSet('lm4.kuerzel', o.k); lsSet('lm4.jahrgang', o.j);
    const go = () => countdown(() => {
      const c = D.store.start(o.r, row, o.st); if (!c) { toast('Duell konnte nicht gestartet werden (Speicher gesperrt, z. B. privater Modus?)'); return; }
      const q = new URLSearchParams(location.search);
      const same = location.pathname.split('/').pop() === labFile(row[1]) && q.get('aufgabe') === row[0];
      if (same) { chip(); return; }
      location.href = labFile(row[1]) + '?aufgabe=' + encodeURIComponent(row[0]) + '&duell=' + encodeURIComponent(o.r) + '&st=' + o.st + (o.lab ? '&lab=' + o.lab : '');
    });
    const cur = D.store.current(null);
    if (cur && cur.start && cur.r !== o.r) { if (!root.confirm('Es läuft noch ein Duell (' + cur.r + '). Aufgeben (mit Wertung) und das neue starten?')) return; D.store.giveUp(null, Date.now(), labApi()); chip(); }
    const m = doc.getElementById('dlBox'); if (m) m.remove(); go();
  }
  const rowFor = o => { const r = (o.aufgabe && taskRow(o.aufgabe)) || C.pick(o.r, rows(), { st: o.st, lab: o.lab || '' }); return r; };
  const taskInfo = row => row ? `<b>${esc(row[3])}</b><br><small>${esc(labName(row[1]))} · Stufe ${row[4]}</small>` : '<span class="dl-err">Keine passende Aufgabe gefunden.</span>';

  /* ---------- Neues Duell ---------- */
  function neu(pre) {
    const m = modal('Neues Duell', true), b = m.body, j = jgDefault();
    const o = Object.assign({ k: lsGet('lm4.kuerzel'), j, st: stDefault(j), lab: '' }, pre || {});
    b.innerHTML = '<p>Du erzeugst einen Runden-Code. Wer ihn eingibt, bekommt dieselbe Aufgabe mit demselben Fehler. Zählt: richtig lösen, sauber messen, wenige Tipps, dann die Zeit.</p><div class="dl-cols"><div id="dlF"></div><div id="dlR"></div></div>';
    const F = b.querySelector('#dlF'), R = b.querySelector('#dlR');
    F.innerHTML = formHtml(o) + '<div class="dl-row"><button type="button" class="dl-btn pri" id="dlGen">Runden-Code erzeugen</button></div>';
    const gen = () => {
      readForm(F, o); if (!checkId(F, o)) return;
      o.r = C.newRound(Date.now()); const row = rowFor(o);
      const url = new URL(labFile(row ? row[1] : 'sch') + '?aufgabe=' + (row ? row[0] : '') + '&duell=' + o.r + '&st=' + o.st + (o.lab ? '&lab=' + o.lab : ''), location.href).href;
      R.innerHTML = `<div class="dl-card"><div class="dl-mute">Runden-Code</div><div class="dl-code" id="dlCode">${esc(o.r)}</div><div class="dl-qr" id="dlQr"></div>
        <p>${taskInfo(row)}</p><p><small>Der Gegner scannt den QR-Code oder tippt bei „Beitreten“ den Code ein: <b>${esc(joinStr(o))}</b>. Gleicher Code und gleiche Stufe = gleiche Aufgabe, gleicher Fehler.</small></p>
        <div class="dl-row"><button type="button" class="dl-btn pri" id="dlGo"${row ? '' : ' disabled'}>Los (3, 2, 1)</button><button type="button" class="dl-btn" id="dlCp">Kopieren</button></div></div>`;
      qrInto(R.querySelector('#dlQr'), url);
      R.querySelector('#dlCp').onclick = () => { const t = el('textarea'); t.value = joinStr(o); R.appendChild(t); copy(joinStr(o), t); t.remove(); };
      R.querySelector('#dlGo').onclick = () => { if (row) begin(o, row); };
    };
    F.querySelector('#dlGen').onclick = gen; wireSeg(F, () => { R.innerHTML = ''; });
  }

  /* ---------- Beitreten ---------- */
  function parseJoin(txt) {
    const t = String(txt || ''), m = /K\d{2}-[0-9A-Fa-f]{4}(?:-E)?/.exec(t), s = /[?&\s·]st=?\s*([123])|Stufe\s*([123])/i.exec(t), l = /[?&\s·]lab=([a-z]{2,5})/i.exec(t) || /·\s*([a-z]{2,5})\s*$/i.exec(t), a = /[?&]aufgabe=([A-Za-z0-9_-]+)/.exec(t);
    return { r: m ? C.roundBase(m[0]) : '', st: s ? +(s[1] || s[2]) : 0, lab: l ? l[1].toLowerCase() : '', aufgabe: a ? a[1] : '' };
  }
  function beitreten(pre) {
    const m = modal('Duell beitreten', true), b = m.body, j = jgDefault();
    const o = Object.assign({ k: lsGet('lm4.kuerzel'), j, st: 0, lab: '', r: '', aufgabe: '' }, pre || {}); if (!o.st) o.st = stDefault(j); const r0 = o.r, a0 = o.aufgabe;
    b.innerHTML = `<p>Gib den Runden-Code deines Gegners ein (oder den ganzen Link). Stufe und Lab müssen zu seiner Anzeige passen. Prüfe, ob unten dieselbe Aufgabe steht.</p>
      <label for="dlRc">Runden-Code</label><input type="text" id="dlRc" autocomplete="off" autocapitalize="characters" placeholder="K43-7F2A" value="${esc(o.r)}">
      ${formHtml(o)}<div class="dl-card" id="dlT"></div><div class="dl-row"><button type="button" class="dl-btn pri" id="dlGo">Los (3, 2, 1)</button></div>`;
    const upd = () => {
      readForm(b, o); const p = parseJoin(b.querySelector('#dlRc').value); o.r = p.r; o.aufgabe = p.aufgabe || (o.r === r0 ? a0 : '');
      const row = o.r ? rowFor(o) : null; b.querySelector('#dlT').innerHTML = o.r ? taskInfo(row) : '<small>Noch kein gültiger Runden-Code (Form: K43-7F2A).</small>'; return row;
    };
    const rc = b.querySelector('#dlRc');
    rc.oninput = () => { const p = parseJoin(rc.value); if (p.st) b.querySelectorAll('[data-st]').forEach(y => y.setAttribute('aria-pressed', String(+y.dataset.st === p.st))); if (p.lab) b.querySelector('#dlL').value = p.lab; upd(); };
    wireSeg(b, upd); upd();
    b.querySelector('#dlGo').onclick = () => { const row = upd(); if (!o.r) { b.querySelector('#dlE').textContent = 'Bitte einen gültigen Runden-Code eingeben (z. B. K43-7F2A).'; return; } if (!checkId(b, o)) return; if (!row) return; begin(o, row); };
  }

  /* ---------- Scan (qrscan.js, jsqr.js erst beim ersten Scan nachgeladen); ohne Kamera/Scanner bleibt das Einfuegen per Text ---------- */
  function scanCode(onText) {
    const go = () => { if (root.QrScan) root.QrScan.open({ title: 'QR-Code scannen', onText }); else toast('Scanner nicht verfügbar. Bitte den Code einfügen.'); };
    if (root.QrScan) { go(); return; }
    const sc = doc.createElement('script'); sc.src = 'qrscan.js'; sc.onload = go; sc.onerror = () => toast('Scanner nicht verfügbar. Bitte den Code einfügen.'); doc.head.appendChild(sc);
  }
  /* ---------- Bestenliste vom Ausbilder (TFB1, freiwillig, E3): einlesen, anzeigen, entfernen; gespeichert in lm4.besten ---------- */
  function bestenUi(box) {
    let o = null; try { o = JSON.parse(lsGet('lm4.besten') || 'null'); } catch (e) {}
    const ok = o && Array.isArray(o.rows) && o.rows.length;
    box.innerHTML = (ok ? '<p><small>KW ' + (+o.kw || '?') + (o.j ? ', Jahrgang ' + esc(o.j) : '') + ' · ' + esc(o.t ? new Date(o.t).toLocaleDateString('de-DE') : '') + '</small></p><ol class="dl-best">' + o.rows.map(r => '<li>' + esc(r[0]) + ': <b>' + (+r[1] || 0) + ' Punkte</b> (' + (+r[2] || 0) + ' Duelle)</li>').join('') + '</ol>' : '<p><small>Noch keine Bestenliste eingelesen. Sie ist freiwillig: dein Ausbilder gibt einen Code aus (Text oder QR), den du hier einliest.</small></p>')
      + '<label for="dlBt">Bestenlisten-Code einfügen</label><textarea id="dlBt" rows="2" placeholder="TFB1.…"></textarea><div class="dl-row"><button type="button" class="dl-btn" id="dlBi">Einlesen</button><button type="button" class="dl-btn" id="dlBs">Scannen</button>' + (ok ? '<button type="button" class="dl-btn" id="dlBx">Entfernen</button>' : '') + '</div><p class="dl-err" id="dlBe" role="alert"></p>';
    const take = txt => { const l = C.parseBest(txt); if (!l.length) return false; const x = l[0]; lsSet('lm4.besten', JSON.stringify({ kw: x.kw, j: x.j, t: x.t, rows: x.rows, sig: x.sig })); bestenUi(box); toast('Bestenliste eingelesen'); return true; };
    box.querySelector('#dlBi').onclick = () => { if (!take(box.querySelector('#dlBt').value)) box.querySelector('#dlBe').textContent = 'Kein gültiger Bestenlisten-Code (TFB1.…) gefunden.'; };
    box.querySelector('#dlBs').onclick = () => scanCode(t => (take(t) ? true : 'Das ist kein Bestenlisten-Code (TFB1.…).'));
    const x = box.querySelector('#dlBx'); if (x) x.onclick = () => { try { localStorage.removeItem('lm4.besten'); } catch (e) {} bestenUi(box); };
  }

  /* ---------- Lobby ---------- */
  function lobby() {
    const m = modal('Prüfungs-Duell', true), b = m.body, cur = D.store.current(null), h = D.store.history(null).slice(-5).reverse();
    b.innerHTML = `<p>Zwei Azubis lösen <b>dieselbe Fehlersuche</b> mit demselben verdeckten Fehler. Gewertet werden Richtigkeit, saubere Arbeitsweise und Zeit. Jeder Tipp kostet ${W.tipp} Punkte, eine Auflösung gibt es im Duell nicht.</p>
      ${cur && cur.start ? `<div class="dl-card"><b>Ein Duell läuft:</b> ${esc(cur.r)} <div class="dl-row"><button type="button" class="dl-btn pri" id="dlCont">Zum Duell</button></div></div>` : ''}
      <div class="dl-row"><button type="button" class="dl-btn pri" id="dlN">Neues Duell</button><button type="button" class="dl-btn" id="dlJ2">Beitreten</button><button type="button" class="dl-btn" id="dlBl">Blitz-Duell (Rechnen)</button></div>
      <div id="dlH"></div><details style="margin-top:12px"><summary style="min-height:44px;display:flex;align-items:center;cursor:pointer"><b>Bestenliste vom Ausbilder</b></summary><div id="dlBest"></div></details>`;
    bestenUi(b.querySelector('#dlBest'));
    b.querySelector('#dlN').onclick = () => neu(); b.querySelector('#dlJ2').onclick = () => beitreten();
    b.querySelector('#dlBl').onclick = () => { m.close(); blitz(root.__duellRechOpt || {}); };
    const c = b.querySelector('#dlCont'); if (c) c.onclick = () => { m.close(); const r = taskRow(cur.a); if (r) location.href = labFile(r[1]) + '?aufgabe=' + r[0] + '&duell=' + cur.r + '&st=' + cur.st; };
    if (h.length) { b.querySelector('#dlH').innerHTML = '<p style="margin-top:14px"><b>Letzte Duelle</b></p><table class="dl-tbl"><thead><tr><th>Runde</th><th>Aufgabe</th><th class="n">Punkte</th><th></th></tr></thead><tbody>' + h.map((x, i) => { const r = taskRow(x.a); return `<tr><td>${esc(x.r)}</td><td>${esc(r ? r[3] : x.a)}</td><td class="n">${x.pts}</td><td><button type="button" class="dl-btn" data-h="${i}">Code</button></td></tr>`; }).join('') + '</tbody></table>'; b.querySelectorAll('[data-h]').forEach(x => { x.onclick = () => finished(Object.assign({}, h[+x.dataset.h], { k: lsGet('lm4.kuerzel'), j: jgDefault(), sc: null, again: 1 })); }); }
  }

  /* ---------- Chip ---------- */
  let chipEl = null, chipT = 0;
  const MAXMS = 3 * 3600 * 1000;   /* Duell läuft nach 3 Stunden aus */
  function live() { const c = D.store.current(null); if (!c || !c.start) return null; if (Date.now() - c.start > MAXMS) { D.store.cancel(null); toast('Das Duell ist nach 3 Stunden abgelaufen.'); return null; } return c; }
  function chip() {
    const cur = live(), rc = D.rechnen.cur(), duel = !!(cur && cur.start), bl = !duel && !!(rc.start && !rc.done);
    if (!duel && !bl) { if (chipT) clearInterval(chipT); chipT = 0; if (chipEl) { chipEl.remove(); chipEl = null; } return; }
    if (!chipEl) {
      chipEl = el('div', 'dl dl-chip'); chipEl.id = 'duelChip'; chipEl.setAttribute('role', 'group'); chipEl.setAttribute('aria-label', 'Duell');
      chipEl.innerHTML = '<span class="dl-n"></span><span class="dl-t" aria-live="off"></span><span class="dl-m dl-h"></span><span class="dl-m dl-v"></span><button type="button" class="dl-xx" aria-label="Duell aufgeben">✕<span class="dl-m"> Aufgeben</span></button>';
      doc.body.appendChild(chipEl); let sure = 0;
      chipEl.querySelector('.dl-xx').onclick = e => {
        const bt = e.currentTarget; if (!sure) { sure = 1; bt.classList.add('sure'); bt.textContent = 'Sicher?'; setTimeout(() => { sure = 0; bt.classList.remove('sure'); bt.innerHTML = '✕<span class="dl-m"> Aufgeben</span>'; }, 3000); return; }
        sure = 0; const c2 = D.store.current(null);
        if (c2 && c2.start) { const rec = D.store.giveUp(null, Date.now(), labApi()); chip(); if (rec) finished(rec); }
        else { D.rechnen.cancel(); chip(); toast('Duell abgebrochen'); }
      };
    }
    const tick = () => {
      const c = D.store.current(null), r2 = D.rechnen.cur(); if (!(c && c.start) && !(r2.start && !r2.done)) { chip(); return; }
      if (c && c.start) {
        const h = D.store.hintsUsed(c, null);
        chipEl.querySelector('.dl-n').textContent = '⚔️ ' + c.r; chipEl.querySelector('.dl-t').textContent = fmt(Date.now() - c.start);
        chipEl.querySelector('.dl-h').textContent = 'Tipps ' + h + (h ? ' (−' + h * W.tipp + ')' : ''); chipEl.querySelector('.dl-v').textContent = 'Versuche ' + (c.tries || 0);
      } else { chipEl.querySelector('.dl-n').textContent = '⚔️ Blitz ' + r2.seed; chipEl.querySelector('.dl-t').textContent = fmt(Date.now() - r2.start); chipEl.querySelector('.dl-h').textContent = ''; chipEl.querySelector('.dl-v').textContent = ''; }
    };
    tick(); if (!chipT) chipT = setInterval(tick, 500);
  }

  /* ---------- Ergebnis ---------- */
  const FLAGS = { punkte: 'Punkte passen nicht zu den Zahlen', geraten: '0 Messungen bei 100 %: geraten?', zu_schnell: 'Unplausibel schnell', tipps: 'Mehr als 2 Tipps im Code', zukunft: 'Zeitstempel liegt in der Zukunft', fremde_kw: 'Code aus einer anderen Kalenderwoche', sig_falsch: 'Signatur stimmt nicht (Tippfehler oder geändert)', unsigniert: 'Ohne Signatur (nicht geprüft)' };
  function hinweis(o) {
    const L = [];
    if (o.pct < 100) L.push('Du hast die Aufgabe nicht ganz geschafft. Miss zuerst die Spannungen und Ströme an den Prüfpunkten, bevor du etwas änderst.');
    if (o.h > 0) L.push('Du hast ' + o.h + (o.h === 1 ? ' Tipp' : ' Tipps') + ' gebraucht (−' + o.h * W.tipp + ' Punkte). Versuche es zuerst mit einer weiteren Messung.');
    if (o.f > 0 && o.pct >= 100) L.push('Du hast ' + o.f + (o.f === 1 ? ' Mal' : ' Mal') + ' geprüft, bevor es stimmte. Entscheide erst nach der Messung, nicht nach dem Gefühl.');
    if (o.m === 0 && o.pct >= 100) L.push('Du hast ohne eine einzige Messung getroffen. In der Prüfung zählt der Weg: miss zuerst, dann entscheide.');
    if (o.pct >= 100 && !L.length) L.push('Sauber gelöst: richtig, ohne Tipp und ohne Fehlversuch. Als Nächstes zählt die Zeit, übe die Messreihenfolge.');
    return L[0];
  }
  function histPatch(rec, patch) {
    try { const st = JSON.parse(lsGet('lm4.duell') || 'null'); if (!st || !Array.isArray(st.hist)) return; for (let i = st.hist.length - 1; i >= 0; i--) { const x = st.hist[i]; if (x.r === rec.r && x.a === rec.a && x.t === rec.t) { Object.assign(x, patch); break; } } lsSet('lm4.duell', JSON.stringify(st)); } catch (e) {}
  }
  function badges() {
    const B = root.Badges; if (!B || !B.stat) return;
    try {
      const h0 = D.store.history(null), seen = {}, h = h0.filter(x => { if (x.pct < 100 || seen[x.r]) return false; seen[x.r] = 1; return true; }), won = h.filter(x => x.win != null ? x.win === 1 : x.gp != null && Math.round(x.pts * (x.pr ? 0.5 : 1)) > x.gp), per = {}; h.forEach(x => { const k = C.kw(x.t); per[k] = (per[k] || 0) + 1; });   /* nur zu Ende gespielte, je Runde einmal */
      B.stat('duelle', h.length + Object.keys(JSON.parse(lsGet('lm4.duels') || '{}')).length, 'max');
      B.stat('duellsieg', won.length, 'max'); B.stat('duellmess', won.filter(x => x.m >= 3).length, 'max'); B.stat('duellwoche', Math.max(0, ...Object.keys(per).map(k => per[k])), 'max');
    } catch (e) {}
  }
  async function finished(rec) {
    chip(); const again = rec.again; rec.k = C.cleanId(rec.k || lsGet('lm4.kuerzel')); rec.j = rec.j || jgDefault();
    if (!again) { try { if (root.Badges) { root.Badges.confetti && root.Badges.confetti(false); root.Badges.chime && root.Badges.chime(false); } } catch (e) {} badges(); }
    const m = modal(again ? 'Duell-Code' : '🏁 Im Ziel', true), b = m.body, sc = rec.sc || C.score({ st: rec.st, pct: rec.pct, ms: rec.ms, h: rec.h, f: rec.f, m: rec.m == null ? null : rec.m });
    const row = taskRow(rec.a);
    b.innerHTML = `<div class="dl-cols"><div><div class="dl-card"><div class="dl-big">${rec.pts} Punkte</div>
      <p>Richtigkeit ${sc.R} · Arbeitsweise ${sc.A} · Zeit ${sc.Z}${sc.T ? ' · Tipp-Abzug −' + sc.T : ''}</p>
      <p><small>${esc(rec.r)} · ${esc(row ? row[3] : rec.a)}<br>Zeit ${fmt(rec.ms)} · Tipps ${rec.h} (−${rec.h * W.tipp}) · Versuche ${rec.f} · Messungen ${rec.m == null ? '–' : rec.m}${rec.pr ? '<br>Du kanntest die Aufgabe schon: in der Bestenliste zählt sie halb.' : ''}</small></p></div>
      ${again ? '' : `<p>${esc(hinweis({ pct: rec.pct, h: rec.h, f: rec.f, m: rec.m }))}</p>`}<p class="dl-ok"><small>Gespeichert auf diesem Gerät.</small></p></div>
      <div><label for="dlMy">Dein Duell-Code (zeig ihn dem Gegner oder dem Ausbilder)</label><textarea id="dlMy" readonly rows="3" aria-label="Duell-Code">…</textarea><div class="dl-qr" id="dlQr" style="width:170px"></div>
      <div class="dl-row"><button type="button" class="dl-btn" id="dlCp">Kopieren</button><button type="button" class="dl-btn" id="dlSh" hidden>Teilen</button></div></div></div>
      <label for="dlOp">Gegner-Code einfügen</label><textarea id="dlOp" rows="2" placeholder="TFD1.…"></textarea><div class="dl-row"><button type="button" class="dl-btn pri" id="dlCmp">Vergleichen</button><button type="button" class="dl-btn" id="dlScan">Gegner-Code scannen</button><button type="button" class="dl-btn" id="dlRev">Revanche (neue Runde)</button></div><div id="dlOut"></div>`;
    const my = b.querySelector('#dlMy'); let code = null;
    const api = labApi();
    const pay = { k: rec.k, j: rec.j, r: rec.r, a: rec.a, lab: rec.lab, st: rec.st, t: rec.t, ms: rec.ms, p: rec.pct, h: rec.h, f: rec.f, pr: rec.pr || 0, app: root.LAB_VERSION || '' }; if (rec.m != null) pay.m = rec.m;
    code = await C.encode(pay, null, { mp: api.mp }); my.value = code || 'Code nicht möglich (Kürzel fehlt?)';
    if (code) { qrInto(b.querySelector('#dlQr'), code); if (!again) histPatch(rec, { code }); }
    b.querySelector('#dlCp').onclick = () => copy(my.value, my);
    const sh = b.querySelector('#dlSh'); if (navigator.share && code) { sh.hidden = false; sh.onclick = () => { try { navigator.share({ title: 'Duell-Code', text: code }); } catch (e) {} }; }
    b.querySelector('#dlRev').onclick = () => neu({ st: rec.st, lab: '' });
    b.querySelector('#dlScan').onclick = () => scanCode(t => { if (!C.parse(t).length) return 'Das ist kein Duell-Code (er beginnt mit TFD1.).'; b.querySelector('#dlOp').value = t; b.querySelector('#dlCmp').click(); return true; });
    b.querySelector('#dlCmp').onclick = async () => {
      const out = b.querySelector('#dlOut'), v = await C.verify(b.querySelector('#dlOp').value, undefined, { mp: api.mp });
      if (!v) { out.innerHTML = '<p class="dl-err">Kein gültiger Duell-Code gefunden (er beginnt mit TFD1.).</p>'; return; }
      const o = v.rec; if (o.r !== C.roundBase(rec.r)) { out.innerHTML = `<p class="dl-err">Der Code gehört zu einer anderen Runde (${esc(o.r)}). Verglichen wird nur dieselbe Runde.</p>`; return; }
      const me = { pts: C.effPts(rec), ms: rec.ms, h: rec.h }, op = { pts: C.effPts(o), ms: o.ms, h: o.h }, c = C.cmp(me, op);
      const win = c < 0 ? 'Du gewinnst.' : c > 0 ? esc(o.k) + ' gewinnt.' : 'Unentschieden.';
      const fl = v.flags.map(f => '<li>' + esc(FLAGS[f] || f) + '</li>').join('');
      out.innerHTML = `<table class="dl-tbl"><thead><tr><th></th><th>${esc(rec.k)} (du)</th><th>${esc(o.k)}</th></tr></thead><tbody>
        <tr><td>Punkte</td><td class="${c < 0 ? 'dl-win' : ''}">${me.pts}</td><td class="${c > 0 ? 'dl-win' : ''}">${op.pts}</td></tr>
        <tr><td>Zeit</td><td>${fmt(rec.ms)}</td><td>${fmt(o.ms)}</td></tr><tr><td>Tipps</td><td>${rec.h}</td><td>${o.h}</td></tr>
        <tr><td>Versuche</td><td>${rec.f}</td><td>${o.f}</td></tr><tr><td>Messungen</td><td>${rec.m == null ? '–' : rec.m}</td><td>${o.m == null ? '–' : o.m}</td></tr></tbody></table>
        <p><b>${win}</b> ${esc(hinweis({ pct: rec.pct, h: rec.h, f: rec.f, m: rec.m }))}</p>${fl ? '<p class="dl-warn">Hinweise zum Code:</p><ul class="dl-warn">' + fl + '</ul>' : '<p class="dl-ok"><small>Signatur ok, Zahlen plausibel.</small></p>'}`;
      histPatch(rec, { g: o.k, gp: op.pts, win: rec.pct >= 100 && c < 0 ? 1 : 0 }); badges();
    };
  }

  /* ---------- Blitz-Duell (Rechnen), vom SchaltLab eingebunden ---------- */
  function blitz(opt) {
    if (!opt || !opt.start) { location.href = 'schaltplan.html?duell'; return; }
    const seed = String(1000 + Math.floor(Math.random() * 9000)), m = modal('Duell (Rechnen)'), b = m.body;
    b.innerHTML = `<p>Zwei oder mehr Azubis lösen <b>dieselbe Aufgabe mit denselben Zahlen</b>. Wer zuerst richtig ist, gewinnt.</p>
      <label for="dSeed">Duell-Code (alle geben denselben ein)</label><input type="text" id="dSeed" inputmode="numeric" maxlength="6" value="${seed}" style="font-size:26px;text-align:center;letter-spacing:4px">
      <div class="dl-row"><button type="button" class="dl-btn pri" id="dGo">Los! (3, 2, 1)</button></div><p><small>Tipp: Einer denkt sich einen Code aus und sagt ihn laut. Gleichzeitig auf „Los“ tippen.</small></p>`;
    b.querySelector('#dGo').onclick = () => {
      const sd = (b.querySelector('#dSeed').value || '').replace(/\D/g, '') || seed; m.close();
      const go = () => { D.rechnen.prep(sd); countdown(() => { D.rechnen.start(sd); opt.start(); chip(); }); };
      if (opt.hasWork && opt.hasWork() && opt.confirmNew) opt.confirmNew(go); else go();
    };
  }
  function rechnenSolved(taskId) {
    const r = D.rechnen.solved(taskId); if (!r) return; chip();
    try { if (root.Badges) { root.Badges.stat('duelle', r.n, 'max'); root.Badges.confetti(false); root.Badges.chime(false); } } catch (e) {}
    const m = modal('🏁 Im Ziel!'), b = m.body;
    b.innerHTML = `<p style="font-size:22px"><b>${esc(fmtRech(r.ms))}</b></p><p>Duell-Code <b>${esc(r.seed)}</b>. Vergleicht eure Zeiten. Der Ausbilder trägt sie in die Rangliste ein: tippe auf „Ergebnis senden“ und zeige den QR-Code.</p><div class="dl-row"><button type="button" class="dl-btn pri" id="dSend">Ergebnis senden</button></div>`;
    b.querySelector('#dSend').onclick = () => { m.close(); if (root.Auswertung) root.Auswertung.openSend(); };
  }
  const fmtRech = ms => { const s = ms / 1000, mi = Math.floor(s / 60); return (mi ? mi + ':' : '') + (s - mi * 60).toFixed(1).padStart(mi ? 4 : 1, '0').replace('.', ',') + (mi ? '' : ' s'); };

  /* ---------- Einstieg ---------- */
  function open(o) {
    o = o || {};
    if (o.art === 'rechnen') { root.__duellRechOpt = o; blitz(o); return; }
    if (o.art === 'neu') { neu(o); return; }
    if (o.art === 'beitreten') { beitreten(o); return; }
    root.__duellRechOpt = o.start ? o : root.__duellRechOpt; lobby();
  }

  /* ---------- Sperre: im Duell keine Aufloesung / kein "Fehler zeigen" ---------- */
  const BLOCK = '[data-d="show"],[data-dc="show"],[data-fa="reveal"],[data-a="gdv"],[data-a="dreveal"],[data-a="a-sol"],#vbSol,#tSol,#hSol';
  const BLOCKTXT = /^\s*(Auflösung( zeigen)?\??|Lösung (zeigen|anzeigen)|Fehler (zeigen|anzeigen|aufdecken)|Musterlösung (laden|öffnen))\s*$/i;
  root.addEventListener('click', e => {
    const c = live(); if (!c || !location.pathname.endsWith(labFile(c.lab))) return;   /* nur auf der Lab-Seite der Duell-Aufgabe */
    const t = e.target && e.target.closest ? e.target.closest('button,a,[role=button]') : null; if (!t) return;
    let hit = false; try { hit = t.matches(BLOCK) || BLOCKTXT.test(t.textContent || ''); } catch (x) {}
    if (hit && !t.closest('.dl')) { e.preventDefault(); e.stopImmediatePropagation(); toast('Im Duell gibt es keine Auflösung.'); }
  }, true);

  /* ---------- Startseiten-Band ---------- */
  function band() {
    const top = doc.getElementById('top'); if (!top || doc.getElementById('duellBand')) return;
    const w = C.kw(Date.now()), h = D.store.history(null).filter(x => C.kw(x.t) === w), best = h.reduce((a, x) => Math.max(a, x.pts), 0);
    const d = el('div', 'dl dl-band'); d.id = 'duellBand';
    d.innerHTML = `<div class="dl-tx">⚔️ <b>Prüfungs-Duell</b><br><small>${h.length ? 'Diese Woche: ' + h.length + (h.length === 1 ? ' Duell' : ' Duelle') + ', bester Wert ' + best : 'Fehlersuche gegen einen Mitazubi, mit Runden-Code'}</small></div>
      <button type="button" class="dl-btn pri" data-b="neu">Neues Duell</button><button type="button" class="dl-btn" data-b="beitreten">Beitreten</button>`;
    top.parentNode.insertBefore(d, top.nextSibling);
    d.querySelector('[data-b=neu]').onclick = () => neu(); d.querySelector('[data-b=beitreten]').onclick = () => beitreten();
  }

  D.ui = { open, finished, chip, rechnenSolved, lobby, neu, beitreten, blitz, parseJoin, hinweis, toast };
  const q = new URLSearchParams(location.search), dq = q.get('duell');
  const boot = () => {
    band(); chip();
    if (dq && /^K\d{2}-[0-9A-Fa-f]{4}(-E)?$/.test(dq) && !D.active()) {
      const st = +q.get('st') || 0, lab = q.get('lab') || '', a = q.get('aufgabe') || '';
      beitreten({ r: C.roundBase(dq), st: st >= 1 && st <= 3 ? st : 0, lab: /^[a-z]{2,5}$/.test(lab) ? lab : '', aufgabe: a });
    }
  };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
