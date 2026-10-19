'use strict';
/* Tonfunk App-Werkstatt: Oberfläche und Werkzeuge.
   Auftragswerkstatt (Eingaben für eine KI), Werkstatt (Code einfügen, abgeschottete Vorschau, Prüfung), Notizen (Obsidian-kompatibel),
   Bibliothek (speichern, teilen, Klassenbibliothek) und Aufgaben. Die KI selbst läuft außerhalb (Claude, ChatGPT oder andere).
   Fremder Code läuft nur in einem Fenster mit sandbox="allow-scripts" (kein Zugriff auf Fortschritt und Namen) und einer Inhaltsrichtlinie ohne Netz. */
(function (root) {
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const newS = () => ({ code: '', prompts: {}, answers: {}, flags: {}, name: 'Meine App' });

  /* ---------------- Zustand ---------------- */
  let S = Object.assign(newS(), lsGet('app.state', {})), NOTES = lsGet('app.notes', []), LIB = lsGet('app.lib', []);
  ['prompts', 'answers', 'flags'].forEach(k => { S[k] = S[k] || {}; });
  const persist = () => { if (testing) return; lsSet('app.state', S); lsSet('app.notes', NOTES); lsSet('app.lib', LIB); };
  let testing = false;
  const RES = (ok, text, why) => ({ ok: !!ok, text, why: why || '' });
  const parse = s => { const x = parseFloat(String(s == null ? '' : s).replace(',', '.')); return isFinite(x) ? x : NaN; };
  const stat = (k, v, m) => { if (!testing && root.Badges) root.Badges.stat(k, v, m); };
  const uid = () => 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /* ---------------- Bausteine eines guten Auftrags ---------------- */
  const CRIT = [
    { k: 'zweck', label: 'Art der App (Quiz, Rechner, Trainer, Karteikarten …)', re: /\b(app|quiz|rechner|trainer|lernapp|karteikarten|lernhilfe|formelsammlung|spiel)\b/i, hint: 'Sage, was für eine App entstehen soll.' },
    { k: 'ziel', label: 'Zielgruppe', re: /(azubi|auszubildende|berufsschul|schüler|klasse|anfänger|elektroniker|lehrling|einsteiger)/i, hint: 'Für wen ist die App? Zum Beispiel „für Auszubildende zum Elektroniker“.' },
    { k: 'thema', label: 'Thema oder Inhalt', re: /\b(zu|über|zum|zur|für)\s+(dem\s+|der\s+|den\s+)?(thema\s+)?[\p{L}-]{4,}/iu, hint: 'Nenne das Thema: „zum Thema Ohmsches Gesetz“.' },
    { k: 'bedienung', label: 'Bedienung und Gerät', re: /(ipad|handy|smartphone|touch|tablet|große knöpfe|grosse knöpfe|hochformat|querformat|finger)/i, hint: 'Wie wird die App bedient? „große Knöpfe fürs iPad“.' },
    { k: 'technik', label: 'Technik: eine Datei, ohne Internet', re: /(einzige[nr]?\s+(html|datei)|eine\s+(einzige\s+)?(html|datei)|html-datei|ohne\s+internet|offline|ohne\s+(externe\s+)?bibliothek|ohne externe)/i, hint: 'Verlange „eine einzige HTML-Datei, ohne Internet und ohne externe Bibliotheken“.' },
    { k: 'umfang', label: 'Umfang (Zahl der Fragen, Karten, Felder …)', re: /(\d+|ein|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|zwölf|fünfzehn|zwanzig)\s+(fragen|aufgaben|karten|eingabefelder|felder|knöpfe|schritte|seiten|rechnungen)/i, hint: 'Wie viel soll es sein? „zehn Fragen“.' },
    { k: 'ausgabe', label: 'Ausgabe: nur der vollständige Code', re: /(nur den (vollständigen )?code|vollständigen code|ganzen code|komplett(en)? code|ohne (lange )?erklärung|code in einem codeblock|auf deutsch)/i, hint: 'Bitte: „Gib nur den vollständigen Code aus.“' }
  ];
  const rubric = t => CRIT.map(c => ({ k: c.k, label: c.label, ok: c.re.test(String(t || '')), hint: c.hint }));

  /* ---------------- abgeschotteter Lauf ---------------- */
  function harness() {
    var errors = [], ext = [], store = function () { var m = {}; return { getItem: function (k) { return k in m ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); }, removeItem: function (k) { delete m[k]; }, clear: function () { m = {}; }, key: function (i) { return Object.keys(m)[i] || null; }, get length() { return Object.keys(m).length; } }; };
    try { Object.defineProperty(window, 'localStorage', { value: store(), configurable: true }); Object.defineProperty(window, 'sessionStorage', { value: store(), configurable: true }); } catch (e) {}
    var send = function (o) { try { parent.postMessage(o, '*'); } catch (e) {} };
    window.addEventListener('error', function (e) { var m = (e.message || 'Fehler') + (e.lineno ? ' (Zeile ' + e.lineno + ')' : ''); errors.push(m); send({ type: 'err', msg: m }); });
    window.addEventListener('unhandledrejection', function (e) { var m = 'Unbehandelter Fehler: ' + (e.reason && e.reason.message || e.reason); errors.push(m); send({ type: 'err', msg: m }); });
    document.addEventListener('securitypolicyviolation', function (e) { var b = e.blockedURI || ''; if (b === 'inline' || b === 'eval') { if (b === 'eval') errors.push('Die App nutzt eval(), das ist hier nicht erlaubt'); return; } ext.push(b); send({ type: 'ext', uri: b }); });
    var facts = function () { var q = function (s) { return document.querySelectorAll(s).length; }, tx = document.body ? document.body.innerText : ''; return { title: document.title || '', textLen: tx.trim().length, nButtons: q('button,input[type=button],input[type=submit],[role=button]'), nInputs: q('input:not([type=button]):not([type=submit]):not([type=checkbox]):not([type=radio]):not([type=hidden]),textarea,select'), nLinks: q('a[href]'), errors: errors.slice(), ext: ext.slice() }; };
    var btns = function () { return [].slice.call(document.querySelectorAll('button,input[type=button],input[type=submit],[role=button]')); };
    var inputs = function () { return [].slice.call(document.querySelectorAll('input:not([type=button]):not([type=submit]):not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=file]),textarea')).filter(function (e) { return !e.disabled; }); };
    var nums = function (t) { return (t.match(/-?\d+(?:[.,]\d+)?/g) || []).map(function (x) { return parseFloat(x.replace(',', '.')); }); };
    window.addEventListener('message', function (ev) {
      var d = ev.data; if (!d || d.type !== 'prog') return; var reads = [], steps = d.steps || [], i = 0;
      var next = function () {
        if (i >= steps.length) { send({ type: 'res', id: d.id, facts: facts(), reads: reads }); return; }
        var s = steps[i++];
        try {
          if (s.op === 'fill') { var ins = inputs(); (s.values || []).forEach(function (v, k) { var e = ins[k]; if (!e) return; e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }); }
          else if (s.op === 'click') { var b = btns(), t = null; if (s.match === 'first') t = b[0]; else if (s.match === 'all') { b.forEach(function (x) { x.click(); }); } else { var re = new RegExp(s.match, 'i'); for (var k = 0; k < b.length; k++) { if (re.test(b[k].innerText || b[k].value || '')) { t = b[k]; break; } } } if (t) t.click(); }
          else if (s.op === 'read') { var tx = document.body ? document.body.innerText : ''; reads.push({ text: tx, nums: nums(tx) }); }
        } catch (e) { errors.push('Fehler beim Bedienen: ' + e.message); }
        if (s.op === 'wait') setTimeout(next, s.ms || 100); else next();
      };
      next();
    });
    window.addEventListener('load', function () { send({ type: 'ready', facts: facts() }); });
  }
  const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; form-action 'none'";
  const srcdoc = html => '<meta http-equiv="Content-Security-Policy" content="' + CSP + '"><script>(' + harness.toString() + ')()<\/script>' + html;
  let rid = 0;
  function runApp(html, steps) {
    return new Promise(resolve => {
      const f = document.createElement('iframe'); f.setAttribute('sandbox', 'allow-scripts'); f.style.cssText = 'position:fixed;left:-9999px;top:0;width:360px;height:640px;border:0';
      const id = ++rid; let done = false, ready = false;
      const fin = r => { if (done) return; done = true; window.removeEventListener('message', on); setTimeout(() => f.remove(), 0); resolve(r); };
      const on = e => {
        if (e.source !== f.contentWindow || !e.data) return; const d = e.data;
        if (d.type === 'ready' && !ready) { ready = true; f.contentWindow.postMessage({ type: 'prog', id, steps: steps || [] }, '*'); }
        else if (d.type === 'res' && d.id === id) fin({ facts: d.facts, reads: d.reads });
      };
      window.addEventListener('message', on);
      setTimeout(() => fin({ facts: { title: '', textLen: 0, nButtons: 0, nInputs: 0, nLinks: 0, errors: ['Keine Antwort der App (Endlosschleife oder schwerer Fehler im Code)'], ext: [] }, reads: [] }), 5000);
      f.srcdoc = srcdoc(html); document.body.appendChild(f);
    });
  }

  /* ---------------- Notizen ---------------- */
  const key = t => String(t || '').trim().toLowerCase();
  const byTitle = t => NOTES.find(n => key(n.title) === key(t));
  const linksOf = n => { const o = [], re = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g; let m; while ((m = re.exec(n.text || ''))) o.push(m[1].trim()); return o; };
  const tagsOf = n => { const o = [], re = /(^|\s)#([\p{L}\d_-]+)/gu; let m; while ((m = re.exec(n.text || ''))) o.push(m[2].toLowerCase()); return o; };
  const validOut = (n, N) => [...new Set(linksOf(n).map(key))].filter(t => N.some(x => key(x.title) === t && x !== n));
  const linkCount = N => N.reduce((s, n) => s + validOut(n, N).length, 0);
  const tags = N => [...new Set(N.flatMap(tagsOf))];
  const isolated = N => N.filter(n => !validOut(n, N).length && !N.some(x => x !== n && validOut(x, N).includes(key(n.title)))).map(n => n.title || '(ohne Titel)');
  const backlinks = n => NOTES.filter(x => x !== n && validOut(x, NOTES).includes(key(n.title)));
  function md(t) {
    let h = esc(t);
    h = h.replace(/^### (.*)$/gm, '<h4>$1</h4>').replace(/^## (.*)$/gm, '<h3>$1</h3>').replace(/^# (.*)$/gm, '<h2>$1</h2>').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>').replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/^- (.*)$/gm, '<li>$1</li>');
    h = h.replace(/(<li>.*<\/li>\n?)+/g, m => '<ul>' + m.replace(/\n/g, '') + '</ul>');
    h = h.replace(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g, (m, a) => '<a href="#" data-n="' + a.trim() + '" class="' + (byTitle(a) ? '' : 'miss') + '">' + a.trim() + '</a>');
    h = h.replace(/(^|\s)#([\p{L}\d_-]+)/gu, '$1<span class="tag">#$2</span>');
    return h.replace(/\n/g, '<br>').replace(/<\/(h\d|ul)><br>/g, '</$1>');
  }

  /* ---------------- ZIP (ohne Kompression), Dateien, Codes ---------------- */
  const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = u8 => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function makeZip(files) {
    const enc = new TextEncoder(), parts = [], cen = []; let off = 0;
    const w16 = (a, v) => a.push(v & 255, (v >> 8) & 255), w32 = (a, v) => a.push(v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255);
    files.forEach(f => {
      const name = enc.encode(f.name), data = enc.encode(f.text), crc = crc32(data), h = [];
      w32(h, 0x04034b50); w16(h, 20); w16(h, 0x0800); w16(h, 0); w16(h, 0); w16(h, 0x21); w32(h, crc); w32(h, data.length); w32(h, data.length); w16(h, name.length); w16(h, 0);
      parts.push(new Uint8Array(h), name, data);
      const c = []; w32(c, 0x02014b50); w16(c, 20); w16(c, 20); w16(c, 0x0800); w16(c, 0); w16(c, 0); w16(c, 0x21); w32(c, crc); w32(c, data.length); w32(c, data.length); w16(c, name.length); w16(c, 0); w16(c, 0); w16(c, 0); w16(c, 0); w32(c, 0); w32(c, off);
      cen.push(new Uint8Array(c), name); off += h.length + name.length + data.length;
    });
    const cs = cen.reduce((s, x) => s + x.length, 0), e = []; w32(e, 0x06054b50); w16(e, 0); w16(e, 0); w16(e, files.length); w16(e, files.length); w32(e, cs); w32(e, off); w16(e, 0);
    return new Blob(parts.concat(cen, [new Uint8Array(e)]), { type: 'application/zip' });
  }
  function download(name, blobOrText, type) { const b = blobOrText instanceof Blob ? blobOrText : new Blob([blobOrText], { type: type || 'text/plain' }), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
  const safeName = s => String(s || 'Notiz').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'Notiz';
  const b64u = u8 => { let s = ''; u8.forEach(b => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64u = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  const pipe = async (u8, stream) => new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(stream)).arrayBuffer());
  async function encodeApp(app) { const raw = new TextEncoder().encode(JSON.stringify({ n: app.name, h: app.html })); if (typeof CompressionStream !== 'undefined') { try { return 'TFA1.' + b64u(await pipe(raw, new CompressionStream('deflate-raw'))); } catch (e) {} } return 'TFA0.' + b64u(raw); }
  async function decodeApp(code) {
    const m = String(code || '').replace(/\s+/g, '').match(/^TFA([01])\.(.+)$/); if (!m) throw new Error('Das ist kein App-Code (er beginnt mit TFA).');
    let u8 = unb64u(m[2]); if (m[1] === '1') { if (typeof DecompressionStream === 'undefined') throw new Error('Dieses Gerät kann den Code nicht lesen. Nimm die Datei.'); u8 = await pipe(u8, new DecompressionStream('deflate-raw')); }
    const o = JSON.parse(new TextDecoder().decode(u8)); if (!o || typeof o.h !== 'string') throw new Error('Der Code enthält keine App.'); return { name: o.n || 'Importierte App', html: o.h };
  }

  /* ---------------- Fenster und Meldungen ---------------- */
  function toast(t) { let e = $('#toast'); if (!e) { e = document.createElement('div'); e.id = 'toast'; document.body.appendChild(e); } e.textContent = t; e.className = 'show'; clearTimeout(toast.t); toast.t = setTimeout(() => { e.className = ''; }, 2600); }
  function sheet(title, fn) {
    const w = document.createElement('div'); w.className = 'backdrop'; w.innerHTML = '<div class="sheet"><div class="sh"><b>' + esc(title) + '</b><button class="x" aria-label="Schließen">✕</button></div><div class="sb"></div></div>';
    document.body.appendChild(w); const close = () => w.remove(); w.addEventListener('pointerdown', e => { if (e.target === w) close(); }); $('.x', w).onclick = close; fn($('.sb', w), close); return w;
  }
  root.LabUI = { sheet, toast };
  root.sheet = sheet; root.toast = toast;

  /* ---------------- Aufgaben und Ergebnisse ---------------- */
  const W = {
    RES, parse, rubric, runApp, linkCount, tags, isolated,
    get S() { return S; }, notes: () => NOTES, setNotes: n => { NOTES = n.map(x => Object.assign({}, x)); persist(); }, lib: () => LIB, setLib: l => { LIB = l.map(x => Object.assign({}, x)); persist(); }
  };
  const DATA = root.APP_DATA(W), TASKS = DATA.TASKS, SAMPLES = DATA.SAMPLES;
  root.APP_TASKS = TASKS;
  const done = () => lsGet('sim.done', {});
  function markDone(id, pct) { try { const d = done(); if ((d[id] || 0) < pct) { d[id] = pct; localStorage.setItem('sim.done', JSON.stringify(d)); } } catch (e) {} if (root.Badges) root.Badges.result(id, pct); }
  async function runCheck(t) { try { return await t.check(); } catch (e) { return [RES(false, 'Die Prüfung ist abgestürzt: ' + (e && e.message || e))]; } }
  const pctOf = L => (L.length ? Math.round(100 * L.filter(x => x.ok).length / L.length) : 0);
  root.TaskTest = async only => {
    const ids = only || TASKS.map(t => t.id), out = []; const keep = { S, NOTES, LIB }; testing = true;
    try {
      for (const id of ids) {
        const t = TASKS.find(x => x.id === id); if (!t) { out.push({ id, err: 'unbekannt' }); continue; }
        try {
          S = newS(); NOTES = []; LIB = []; const a = pctOf(await runCheck(t)); S = newS(); NOTES = []; LIB = []; t.sol(); const p = pctOf(await runCheck(t)), L = await runCheck(t);
          out.push({ id, pct: p, startPct: a, bad: L.filter(x => !x.ok).map(x => x.text) });
        } catch (e) { out.push({ id, err: String(e) }); }
      }
    } finally { S = keep.S; NOTES = keep.NOTES; LIB = keep.LIB; testing = false; }
    return out;
  };

  /* ---------------- Oberfläche ---------------- */
  const TABS = [['start', 'Start'], ['auftrag', 'Auftrag'], ['werkstatt', 'Werkstatt'], ['notizen', 'Notizen'], ['bibliothek', 'Bibliothek'], ['fuehrer', 'KI-Führerschein'], ['aufgaben', 'Aufgaben']];
  let tab = 'start', curNote = null, openTaskId = null, notePrev = false, noteMap = false;
  function go(t, id) { tab = t; if (t === 'aufgaben') openTaskId = id || null; render(); window.scrollTo(0, 0); }
  function render() {
    $('#tabs').innerHTML = TABS.map(([k, n]) => '<button class="tab' + (tab === k ? ' on' : '') + '" data-t="' + k + '">' + n + '</button>').join('');
    $$('#tabs .tab').forEach(b => { b.onclick = () => go(b.dataset.t); });
    const v = $('#view'); ({ start: vStart, auftrag: vAuftrag, werkstatt: vWerk, notizen: vNotes, bibliothek: vLib, fuehrer: vFuehrer, aufgaben: vTasks })[tab](v);
    try { localStorage.setItem('app.tab', tab); } catch (e) {}
  }

  /* ----- Start ----- */
  function vStart(v) {
    const d = done(), n = TASKS.filter(t => (d[t.id] || 0) >= 100).length;
    v.innerHTML = '<div class="card"><h2>Willkommen in der App-Werkstatt</h2><p>Hier baust du <b>eigene kleine Apps</b>, zum Beispiel Lernhilfen für die Lehre, und einen <b>eigenen Wissensspeicher</b>. Die Arbeit macht eine KI (Claude, ChatGPT oder eine andere). Du gibst den Auftrag, prüfst das Ergebnis und verbesserst es. Vorkenntnisse brauchst du nicht.</p>'
      + '<div class="steps"><div><b>1</b> Auftrag formulieren<br><button class="btn" data-g="auftrag">Zum Auftrag</button></div><div><b>2</b> Code in der Werkstatt starten<br><button class="btn" data-g="werkstatt">Zur Werkstatt</button></div><div><b>3</b> Prüfen und verbessern<br><button class="btn" data-g="aufgaben">Aufgaben</button></div><div><b>4</b> Wissen sammeln und teilen<br><button class="btn" data-g="notizen">Notizen</button></div></div></div>'
      + '<div class="card"><h3>Dein Fortschritt</h3><div class="bar"><i style="width:' + Math.round(100 * n / TASKS.length) + '%"></i></div><p>' + n + ' von ' + TASKS.length + ' Aufgaben geschafft.</p><button class="btn pri" data-g="aufgaben">' + (n ? 'Weiter mit den Aufgaben' : 'Los geht’s mit Stufe 1') + '</button></div>'
      + '<div class="card warn"><h3>Wichtig: Sicherheit und Datenschutz</h3><ul><li>Schreibe <b>keine persönlichen Daten</b> (Namen, Adressen, Kundendaten, Passwörter) in Eingaben an eine KI.</li><li>Die KI behauptet auch Falsches. <b>Prüfe</b> Zahlen, Formeln und Normangaben in einer verlässlichen Quelle.</li><li>Fremden Code startest du nur hier in der <b>abgeschotteten Vorschau</b>, nie ungeprüft auf einem anderen Gerät.</li><li>Die Anbieter haben Nutzungsbedingungen mit Altersgrenzen. Lies sie, bevor du ein Konto anlegst.</li></ul></div>';
    $$('[data-g]', v).forEach(b => { b.onclick = () => go(b.dataset.g); });
  }

  /* ----- Auftrag ----- */
  const TYPES = {
    Quiz: ['Quiz-App', 'Fragen', 'jede Frage mit drei Antworten als Knöpfe, zeigt nach dem Tippen Richtig oder Falsch und am Ende die Punkte'],
    Rechner: ['Rechner-App', 'Eingabefelder', 'ein Knopf Berechnen, das Ergebnis erscheint mit Einheit auf zwei Nachkommastellen'],
    Trainer: ['Trainer-App', 'Aufgaben', 'zufällige Aufgabe, Antwort per Knopf, Rückmeldung richtig oder falsch, danach die nächste'],
    Karteikarten: ['Karteikarten-App', 'Karten', 'Vorderseite mit Begriff, Knopf Umdrehen zeigt die Erklärung, Knopf Nächste'],
    Formelsammlung: ['Formelsammlung-App', 'Formeln', 'Suchfeld, Liste der Formeln mit Erklärung und Einheit']
  };
  function buildPrompt(f) {
    const T = TYPES[f.type] || TYPES.Quiz;
    return 'Baue eine ' + T[0] + ' zum Thema ' + (f.topic || 'Ohmsches Gesetz') + ' für ' + f.aud + '. Umfang: ' + f.amount + ' ' + T[1] + '; ' + T[2] + '. Bedienung: große Knöpfe, gut mit dem Finger bedienbar auf ' + f.dev + '. Technik: Liefere eine einzige HTML-Datei (HTML, CSS und JavaScript zusammen), ohne Internet und ohne externe Bibliotheken. Sprache der App: Deutsch.' + (f.extra ? ' ' + f.extra.trim() : '') + ' Gib nur den vollständigen Code in einem Codeblock aus, ohne lange Erklärung.';
  }
  function copy(text) { (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => toast('Kopiert'), () => { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); toast('Kopiert'); } catch (e) { toast('Bitte von Hand kopieren'); } t.remove(); }); }
  function vAuftrag(v) {
    const f = lsGet('app.form', { type: 'Quiz', topic: 'Ohmsches Gesetz', aud: 'Auszubildende zum Elektroniker', dev: 'dem iPad im Hochformat', amount: 10, extra: '' });
    const opt = (arr, cur) => arr.map(x => '<option' + (x === cur ? ' selected' : '') + '>' + esc(x) + '</option>').join('');
    v.innerHTML = '<div class="card"><h2>Auftrag-Baukasten</h2><p class="mute">Ein guter Auftrag nennt sieben Dinge. Der Baukasten setzt sie für dich zusammen. Kopiere den Text in die KI deiner Wahl.</p>'
      + '<div class="grid"><label>Art der App<select id="fType">' + opt(Object.keys(TYPES), f.type) + '</select></label><label>Thema<input id="fTopic" value="' + esc(f.topic) + '"></label><label>Für wen<select id="fAud">' + opt(['Auszubildende zum Elektroniker', 'eine Berufsschulklasse', 'Anfänger ohne Vorkenntnisse'], f.aud) + '</select></label><label>Gerät<select id="fDev">' + opt(['dem iPad im Hochformat', 'dem Handy', 'iPad und Handy'], f.dev) + '</select></label><label>Umfang (Zahl)<input id="fAmount" type="number" min="1" max="40" value="' + esc(f.amount) + '"></label><label>Besonderes (freiwillig)<input id="fExtra" placeholder="z. B. mit Punkteanzeige" value="' + esc(f.extra) + '"></label></div>'
      + '<textarea id="fOut" rows="6" readonly></textarea><div class="row"><button class="btn pri" id="fCopy">Auftrag kopieren</button><button class="btn" id="fNotes">Notizen als Eingabe kopieren</button><a class="btn" href="https://claude.ai" target="_blank" rel="noopener">Claude öffnen</a><a class="btn" href="https://chatgpt.com" target="_blank" rel="noopener">ChatGPT öffnen</a></div>'
      + '<div id="fRub" class="rub"></div></div>'
      + '<div class="card"><h3>Eigenen Auftrag prüfen</h3><p class="mute">Schreibe oder füge einen Auftrag ein. Das Lab zeigt, welche der sieben Bausteine fehlen.</p><textarea id="cOwn" rows="4" placeholder="Dein Auftrag …"></textarea><div id="cRes" class="rub"></div></div>'
      + '<div class="card"><h3>Gut oder schlecht?</h3><details><summary>Beispiel schlecht</summary><p class="bad">„' + esc(DATA.BAD_PROMPT) + '“<br><span class="mute">Welche App? Für wen? Welches Thema? Auf welchem Gerät? Die KI muss raten, und das Ergebnis ist Zufall.</span></p></details><details><summary>Beispiel gut</summary><p class="good">„Baue eine Quiz-App zum Thema Farbcode von Widerständen für Auszubildende. Zehn Fragen, große Knöpfe fürs iPad. Eine einzige HTML-Datei ohne Internet. Gib nur den vollständigen Code aus.“</p></details>'
      + '<details><summary>Wenn etwas nicht klappt</summary><p>Beschreibe der KI genau: was du gemacht hast, was passiert ist, was du erwartet hast, und kopiere Fehlermeldungen wörtlich hinein. Bitte um die <b>vollständige</b> korrigierte Datei. Mehr dazu in Stufe 3.</p></details></div>';
    const upd = () => {
      const fm = { type: $('#fType').value, topic: $('#fTopic').value, aud: $('#fAud').value, dev: $('#fDev').value, amount: $('#fAmount').value || 10, extra: $('#fExtra').value }; lsSet('app.form', fm);
      const p = buildPrompt(fm); $('#fOut').value = p; $('#fRub').innerHTML = rubric(p).map(c => '<span class="chip ' + (c.ok ? 'ok' : 'no') + '">' + (c.ok ? '✓ ' : '✗ ') + esc(c.label) + '</span>').join('');
    };
    ['fType', 'fTopic', 'fAud', 'fDev', 'fAmount', 'fExtra'].forEach(i => { $('#' + i).oninput = upd; }); upd();
    $('#fCopy').onclick = () => { copy($('#fOut').value); stat('appAuftrag', 1); };
    $('#fNotes').onclick = () => { if (!NOTES.length) { toast('Du hast noch keine Notizen'); return; } copy('Hier sind meine Notizen:\n\n' + NOTES.map(n => '## ' + n.title + '\n' + n.text).join('\n\n') + '\n\nBaue daraus eine Karteikarten-App (Vorderseite: Titel der Notiz, Rückseite: Text) als einzige HTML-Datei ohne Internet, große Knöpfe fürs iPad, mit Knöpfen Umdrehen und Nächste. Gib nur den vollständigen Code aus.'); };
    $('#cOwn').oninput = () => { const t = $('#cOwn').value, r = rubric(t), n = r.filter(c => c.ok).length; $('#cRes').innerHTML = t.trim() ? '<b>' + n + ' von 7 Bausteinen</b><br>' + r.map(c => '<span class="chip ' + (c.ok ? 'ok' : 'no') + '" title="' + esc(c.hint) + '">' + (c.ok ? '✓ ' : '✗ ') + esc(c.label) + '</span>').join('') + (n < 7 ? '<p class="mute">' + r.filter(c => !c.ok).map(c => esc(c.hint)).join(' ') + '</p>' : '<p class="good">Das ist ein sehr guter Auftrag.</p>') : ''; };
  }

  /* ----- Werkstatt ----- */
  let msgs = [], prevWidth = 'ipad';
  function vWerk(v) {
    v.innerHTML = '<div class="card"><h2>Werkstatt</h2><p class="mute">Füge den kompletten Code der KI ein (vom ersten bis zum letzten Zeichen) und tippe „Starten“. Die App läuft abgeschottet: Sie sieht weder deinen Fortschritt noch das Internet.</p>'
      + '<textarea id="wCode" rows="9" spellcheck="false" placeholder="<!doctype html> …">' + esc(S.code) + '</textarea>'
      + '<div class="row"><button class="btn pri" id="wRun">▶ Starten</button><button class="btn" id="wClr">Leeren</button><label class="btn file">Datei laden<input type="file" id="wFile" accept=".html,.htm,.txt" hidden></label><label class="inl">Name <input id="wName" value="' + esc(S.name) + '" style="width:150px"></label><button class="btn" id="wSave">In Bibliothek speichern</button></div></div>'
      + '<div class="card"><div class="row"><b>Vorschau</b><span class="grow"></span><button class="btn s' + (prevWidth === 'hand' ? ' on' : '') + '" data-w="hand">Handy</button><button class="btn s' + (prevWidth === 'ipad' ? ' on' : '') + '" data-w="ipad">iPad</button><button class="btn s' + (prevWidth === 'breit' ? ' on' : '') + '" data-w="breit">breit</button></div>'
      + '<div id="wFrameBox"><iframe id="wFrame" sandbox="allow-scripts" title="Vorschau"></iframe></div></div>'
      + '<div class="card"><h3>Meldungen und Prüfwerte</h3><div id="wMsg" class="msgs"></div><div class="row"><button class="btn" id="wBug">Fehler an die KI formulieren</button></div></div>';
    const fr = $('#wFrame'), width = () => ({ hand: '390px', ipad: '768px', breit: '100%' }[prevWidth]);
    const sizeFrame = () => { fr.style.width = width(); }; sizeFrame();
    $$('[data-w]', v).forEach(b => { b.onclick = () => { prevWidth = b.dataset.w; $$('[data-w]', v).forEach(x => x.classList.toggle('on', x === b)); sizeFrame(); }; });
    const showMsgs = facts => {
      const M = $('#wMsg'); if (!M) return; const rows = [];
      if (facts) rows.push('<div class="kv">Titel: <b>' + esc(facts.title || '(keiner)') + '</b> · Knöpfe: <b>' + facts.nButtons + '</b> · Eingabefelder: <b>' + facts.nInputs + '</b> · Textlänge: <b>' + facts.textLen + '</b> · Größe: <b>' + Math.round(S.code.length / 102.4) / 10 + ' kB</b></div>');
      msgs.forEach(m => rows.push('<div class="m ' + m.k + '">' + (m.k === 'err' ? '⚠ ' : 'ℹ ') + esc(m.t) + '</div>'));
      if (!msgs.length && facts) rows.push('<div class="m ok">✓ Keine Fehlermeldung. Prüfe jetzt die Inhalte: Stimmen Zahlen und Aussagen?</div>');
      M.innerHTML = rows.join('') || '<div class="mute">Noch nichts gestartet.</div>';
    };
    const start = () => {
      S.code = $('#wCode').value; S.name = $('#wName').value || 'Meine App'; persist(); msgs = [];
      if (!S.code.trim()) { toast('Füge zuerst Code ein'); return; }
      const frame = $('#wFrame'); const on = e => { if (e.source !== frame.contentWindow || !e.data) return; const d = e.data; if (d.type === 'err') { msgs.push({ k: 'err', t: d.msg }); showMsgs(); } else if (d.type === 'ext') { msgs.push({ k: 'err', t: 'Die App will etwas aus dem Internet laden (' + d.uri + '). Das ist hier blockiert. Bitte die KI um eine Version ohne externe Dateien.' }); showMsgs(); } else if (d.type === 'ready') { showMsgs(d.facts); } };
      if (start.h) window.removeEventListener('message', start.h); start.h = on; window.addEventListener('message', on);
      frame.srcdoc = srcdoc(S.code); stat('appStart', 1);
    };
    $('#wRun').onclick = start; $('#wCode').oninput = () => { S.code = $('#wCode').value; persist(); };
    $('#wClr').onclick = () => { S.code = ''; $('#wCode').value = ''; $('#wFrame').srcdoc = ''; msgs = []; persist(); showMsgs(); };
    $('#wFile').onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { S.code = String(r.result); $('#wCode').value = S.code; persist(); toast('Datei geladen'); }; r.readAsText(f); };
    $('#wSave').onclick = () => { S.code = $('#wCode').value; S.name = $('#wName').value || 'Meine App'; if (!S.code.trim()) { toast('Es ist noch kein Code da'); return; } const ex = LIB.find(a => key(a.name) === key(S.name)); if (ex) { ex.html = S.code; ex.t = Date.now(); } else LIB.push({ id: uid(), name: S.name, html: S.code, t: Date.now() }); persist(); stat('appSaved', LIB.length, 'max'); toast('In der Bibliothek gespeichert'); };
    $('#wBug').onclick = () => { const errs = msgs.filter(m => m.k === 'err').map(m => m.t); copy('Die App hat ein Problem.\nWas passiert: ' + (errs.length ? errs.join(' / ') : '(bitte beschreiben)') + '\nWas ich erwartet habe: (bitte beschreiben)\nBeispiel mit Zahlen: (bitte eintragen)\nBitte korrigiere den Fehler und gib den vollständigen Code erneut aus.'); stat('appBug', 1); };
    showMsgs();
  }

  /* ----- Notizen ----- */
  function vNotes(v) {
    if (curNote && !NOTES.some(n => n.id === curNote)) curNote = null; if (!curNote && NOTES.length) curNote = NOTES[0].id;
    const q = (lsGet('app.search', '') || '').toLowerCase(), list = NOTES.filter(n => !q || (n.title + ' ' + n.text).toLowerCase().includes(q)), cur = NOTES.find(n => n.id === curNote);
    v.innerHTML = '<div class="notes"><div class="nlist card"><div class="row"><button class="btn pri" id="nNew">＋ Neue Notiz</button></div><input id="nSearch" placeholder="Suchen …" value="' + esc(q) + '">'
      + '<div class="nl">' + (list.map(n => '<button class="ni' + (n.id === curNote ? ' on' : '') + '" data-id="' + n.id + '">' + esc(n.title || '(ohne Titel)') + '</button>').join('') || '<p class="mute">Noch keine Notizen.</p>') + '</div>'
      + '<div class="row"><button class="btn s" id="nMap">Übersichtskarte</button><button class="btn s" id="nZip">Als ZIP für Obsidian</button><label class="btn s file">Importieren<input type="file" id="nImp" accept=".md,.txt" multiple hidden></label></div><p class="mute small">' + NOTES.length + ' Notizen · ' + linkCount(NOTES) + ' Verknüpfungen · ' + tags(NOTES).length + ' Schlagwörter</p></div>'
      + '<div class="ned card">' + (noteMap ? '<h3>Übersichtskarte</h3><div id="nGraph"></div>' : cur ? '<input id="nTitle" class="ntitle" value="' + esc(cur.title) + '" placeholder="Titel"><div class="row"><button class="btn s' + (notePrev ? '' : ' on') + '" id="nEdit">Schreiben</button><button class="btn s' + (notePrev ? ' on' : '') + '" id="nPrev">Ansicht</button><span class="grow"></span><button class="btn s danger" id="nDel">Löschen</button></div>'
        + (notePrev ? '<div class="prev" id="nBody">' + md(cur.text) + '</div>' : '<textarea id="nText" rows="12" placeholder="Schreibe hier. Mit [[Titel]] verknüpfst du eine andere Notiz, mit #schlagwort ordnest du sie ein.">' + esc(cur.text) + '</textarea>')
        + '<div class="bl"><b>Verweist auf:</b> ' + ([...new Set(linksOf(cur))].map(t => '<a href="#" data-n="' + esc(t) + '" class="' + (byTitle(t) ? '' : 'miss') + '">' + esc(t) + '</a>').join(' ') || '–') + '<br><b>Verlinkt von:</b> ' + (backlinks(cur).map(x => '<a href="#" data-n="' + esc(x.title) + '">' + esc(x.title) + '</a>').join(' ') || '–') + '</div>' : '<p class="mute">Lege deine erste Notiz an. Tipp: Schreibe Wissen in eigenen Worten auf und verknüpfe Notizen mit [[Doppelklammern]].</p>') + '</div></div>';
    $('#nNew').onclick = () => { const n = { id: uid(), title: 'Neue Notiz ' + (NOTES.length + 1), text: '', t: Date.now() }; NOTES.push(n); curNote = n.id; notePrev = false; noteMap = false; persist(); stat('appNotes', NOTES.length, 'max'); render(); };
    $('#nSearch').oninput = e => { lsSet('app.search', e.target.value); const pos = e.target.selectionStart; render(); const s = $('#nSearch'); s.focus(); s.setSelectionRange(pos, pos); };
    $$('.ni', v).forEach(b => { b.onclick = () => { curNote = b.dataset.id; noteMap = false; render(); }; });
    $('#nMap').onclick = () => { noteMap = !noteMap; render(); stat('appMap', 1, 'max'); };
    $('#nZip').onclick = () => { if (!NOTES.length) { toast('Es gibt noch keine Notizen'); return; } const used = {}; download('Notizen-App-Werkstatt.zip', makeZip(NOTES.map(n => { let b = safeName(n.title), k = b, i = 2; while (used[k]) k = b + ' ' + i++; used[k] = 1; return { name: k + '.md', text: n.text || '' }; }))); S.flags.exported = (S.flags.exported || 0) + 1; persist(); stat('appExport', 1); toast('ZIP gespeichert. In Obsidian: „Ordner als Vault öffnen“.'); };
    $('#nImp').onchange = e => { const fs = [...e.target.files]; let n = 0; fs.forEach(f => { const r = new FileReader(); r.onload = () => { NOTES.push({ id: uid(), title: f.name.replace(/\.(md|txt)$/i, ''), text: String(r.result), t: Date.now() }); n++; if (n === fs.length) { persist(); render(); toast(n + ' Notizen importiert'); } }; r.readAsText(f); }); };
    if (noteMap) graph($('#nGraph'));
    if (cur && !noteMap) {
      $('#nTitle').onchange = e => { const old = cur.title, t = e.target.value.trim() || 'Ohne Titel'; if (old && key(old) !== key(t)) NOTES.forEach(x => { x.text = (x.text || '').replace(new RegExp('\\[\\[' + old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\|[^\\]]*)?\\]\\]', 'gi'), '[[' + t + '$1]]'); }); cur.title = t; persist(); render(); };
      $('#nEdit').onclick = () => { notePrev = false; render(); }; $('#nPrev').onclick = () => { notePrev = true; render(); };
      $('#nDel').onclick = () => { if (confirm('Diese Notiz löschen?')) { NOTES = NOTES.filter(x => x !== cur); curNote = null; persist(); render(); } };
      const ta = $('#nText'); if (ta) ta.oninput = () => { cur.text = ta.value; cur.t = Date.now(); persist(); stat('appNotes', NOTES.length, 'max'); };
    }
    $$('a[data-n]', v).forEach(a => { a.onclick = e => { e.preventDefault(); let n = byTitle(a.dataset.n); if (!n) { n = { id: uid(), title: a.dataset.n, text: '', t: Date.now() }; NOTES.push(n); persist(); } curNote = n.id; noteMap = false; render(); }; });
  }
  function graph(el) {
    const N = NOTES, W2 = 560, H2 = 380, cx = W2 / 2, cy = H2 / 2, R = Math.min(cx, cy) - 56; if (!N.length) { el.innerHTML = '<p class="mute">Noch keine Notizen.</p>'; return; }
    const pos = N.map((n, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / N.length; return [cx + R * Math.cos(a), cy + R * Math.sin(a)]; });
    let s = '<svg viewBox="0 0 ' + W2 + ' ' + H2 + '" style="width:100%;background:#10151a;border-radius:10px">';
    N.forEach((n, i) => validOut(n, N).forEach(t => { const j = N.findIndex(x => key(x.title) === t); if (j >= 0) s += '<line x1="' + pos[i][0] + '" y1="' + pos[i][1] + '" x2="' + pos[j][0] + '" y2="' + pos[j][1] + '" stroke="#3b9eff" stroke-opacity=".6" stroke-width="1.5"/>'; }));
    N.forEach((n, i) => { const k = validOut(n, N).length + backlinks(n).length; s += '<g data-id="' + n.id + '" style="cursor:pointer"><circle cx="' + pos[i][0] + '" cy="' + pos[i][1] + '" r="' + (7 + Math.min(k, 6) * 1.5) + '" fill="' + (k ? '#3b9eff' : '#6b7682') + '"/><text x="' + pos[i][0] + '" y="' + (pos[i][1] - 14) + '" fill="#e8ecf0" font-size="12" text-anchor="middle">' + esc((n.title || '').slice(0, 18)) + '</text></g>'; });
    el.innerHTML = s + '</svg><p class="mute small">Punkte sind Notizen, Linien sind Verknüpfungen. Tippe einen Punkt an, um die Notiz zu öffnen. Grau: noch nicht verbunden.</p>';
    $$('g[data-id]', el).forEach(g => { g.onclick = () => { curNote = g.dataset.id; noteMap = false; render(); }; });
  }

  /* ----- Bibliothek ----- */
  function vLib(v) {
    v.innerHTML = '<div class="card"><h2>Meine Apps</h2>' + (LIB.length ? LIB.map(a => '<div class="li"><div><b>' + esc(a.name) + '</b><br><span class="mute small">' + new Date(a.t || Date.now()).toLocaleDateString('de-DE') + ' · ' + Math.round((a.html || '').length / 102.4) / 10 + ' kB</span></div><div class="row"><button class="btn s" data-a="open" data-id="' + a.id + '">In die Werkstatt</button><button class="btn s" data-a="code" data-id="' + a.id + '">Als Code teilen</button><button class="btn s" data-a="file" data-id="' + a.id + '">Als Datei</button><button class="btn s danger" data-a="del" data-id="' + a.id + '">Löschen</button></div></div>').join('') : '<p class="mute">Noch keine Apps gespeichert. In der Werkstatt gibt es den Knopf „In Bibliothek speichern“.</p>') + '</div>'
      + '<div class="card"><h3>App einlesen</h3><p class="mute">Füge einen Teilen-Code (beginnt mit TFA) ein oder wähle eine HTML-Datei.</p><textarea id="lIn" rows="3" placeholder="TFA1.…"></textarea><div class="row"><button class="btn pri" id="lImp">Code einlesen</button><label class="btn file">HTML-Datei wählen<input type="file" id="lFile" accept=".html,.htm" hidden></label></div><div id="lMsg" class="mute"></div></div>'
      + '<div class="card"><h2>Klassenbibliothek</h2><p class="mute">Apps, die dein Ausbilder geprüft und freigegeben hat.</p><div id="cls"><span class="mute">Lade …</span></div></div>';
    const find = id => LIB.find(a => a.id === id);
    $$('[data-a]', v).forEach(b => { b.onclick = async () => { const a = find(b.dataset.id); if (!a) return; if (b.dataset.a === 'open') { S.code = a.html; S.name = a.name; persist(); go('werkstatt'); } else if (b.dataset.a === 'file') download(safeName(a.name) + '.html', a.html, 'text/html'); else if (b.dataset.a === 'del') { if (confirm('„' + a.name + '“ löschen?')) { LIB = LIB.filter(x => x !== a); persist(); render(); } } else if (b.dataset.a === 'code') { const c = await encodeApp(a); S.flags.shared = (S.flags.shared || 0) + 1; persist(); stat('appShare', 1); sheet('Teilen-Code', bd => { bd.innerHTML = '<p class="mute" style="margin-top:0">Schicke diesen Text weiter. Wer ihn einliest, bekommt eine Kopie der App.</p><textarea rows="6" readonly style="width:100%">' + esc(c) + '</textarea><div class="row"><button class="btn pri" id="cC">Kopieren</button></div>'; $('#cC', bd).onclick = () => copy(c); }); } }; });
    const imp = async txt => { try { const a = await decodeApp(txt); LIB.push({ id: uid(), name: a.name, html: a.html, t: Date.now() }); S.flags.imported = (S.flags.imported || 0) + 1; persist(); stat('appImport', 1); toast('„' + a.name + '“ eingelesen'); render(); } catch (e) { $('#lMsg').style.color = '#ff8a7a'; $('#lMsg').textContent = String(e.message || e); } };
    $('#lImp').onclick = () => { const t = $('#lIn').value; if (!t.trim()) { $('#lMsg').textContent = 'Füge zuerst einen Code ein.'; return; } imp(t); };
    $('#lFile').onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { LIB.push({ id: uid(), name: f.name.replace(/\.html?$/i, ''), html: String(r.result), t: Date.now() }); S.flags.imported = (S.flags.imported || 0) + 1; persist(); render(); toast('Datei eingelesen'); }; r.readAsText(f); };
    fetch('apps/apps.json', { cache: 'no-cache' }).then(r => r.json()).then(list => {
      const c = $('#cls'); if (!c) return; c.innerHTML = list.length ? list.map((a, i) => '<div class="li"><div><b>' + esc(a.name) + '</b><br><span class="mute small">' + esc(a.desc || '') + '</span></div><button class="btn s" data-c="' + i + '">In die Werkstatt</button></div>').join('') : '<p class="mute">Noch keine Apps freigegeben.</p>';
      $$('[data-c]', c).forEach(b => { b.onclick = () => { const a = list[+b.dataset.c]; fetch('apps/' + a.file).then(r => r.text()).then(t => { S.code = t; S.name = a.name; persist(); go('werkstatt'); }).catch(() => toast('App konnte nicht geladen werden')); }; });
    }).catch(() => { const c = $('#cls'); if (c) c.innerHTML = '<p class="mute">Die Klassenbibliothek braucht eine Internetverbindung.</p>'; });
  }

  /* ----- KI-Führerschein (Inhalt in kifs.js) ----- */
  function vFuehrer(v) { root.KIFS.mount(v, { S, persist, stat, toast, render }); }

  /* ----- Aufgaben ----- */
  function vTasks(v) {
    if (openTaskId) { card(v, TASKS.find(t => t.id === openTaskId)); return; }
    const d = done(), cats = []; TASKS.forEach(t => { if (!cats.includes(t.cat)) cats.push(t.cat); });
    v.innerHTML = '<div class="card"><h2>Aufgaben</h2><p class="mute">In Stufen vom ersten Start bis zum eigenen Projekt. Jede Aufgabe prüft das Lab automatisch.</p></div>' + cats.map(c => '<div class="card"><h3>' + esc(c) + '</h3>' + TASKS.filter(t => t.cat === c).map(t => { const p = d[t.id] || 0; return '<button class="ti" data-id="' + t.id + '"><span class="dot ' + (p >= 100 ? 'g' : p > 0 ? 'y' : '') + '">' + (p >= 100 ? '✓' : '') + '</span><span><b>' + esc(t.title) + '</b><br><span class="mute small">' + ['', 'Einstieg', 'Mittel', 'Fortgeschritten'][t.level] + (p ? ' · ' + p + ' %' : '') + '</span></span></button>'; }).join('') + '</div>').join('');
    $$('.ti', v).forEach(b => { b.onclick = () => go('aufgaben', b.dataset.id); });
  }
  function think(t) {
    const q = root.THINK && root.THINK[t.id]; if (!q) return ''; const a = lsGet('app.think', {})[t.id];
    return '<div class="think"><b>🤔 Denkfrage: Was erwartest du?</b><div>' + esc(q.q) + '</div>' + q.opts.map((o, i) => '<button class="btn s opt" data-th="' + i + '"' + (a != null ? ' disabled' : '') + '>' + (a != null && i === q.right ? '✓ ' : (a === i ? '✗ ' : '')) + esc(o) + '</button>').join('') + (a != null ? '<div class="small ' + (a === q.right ? 'good' : 'warnt') + '"><b>' + (a === q.right ? 'Richtig gedacht.' : 'Nicht ganz.') + '</b> ' + esc(q.why) + '</div>' : '') + '</div>';
  }
  function card(v, t) {
    const d = done(), A = S.answers[t.id] = S.answers[t.id] || {}; let w = '';
    if (t.kind === 'prompt') w = '<textarea id="tP" rows="6" placeholder="Dein Auftrag …">' + esc(S.prompts[t.id] || '') + '</textarea>';
    else if (t.widget && t.widget.type === 'checks') w = t.widget.items.map((x, i) => '<label class="ck"><input type="checkbox" data-i="' + i + '"' + ((A.sel || []).map(Number).includes(i) ? ' checked' : '') + '> ' + esc(x) + '</label>').join('');
    else if (t.widget && t.widget.type === 'quiz') w = t.widget.items.map((q, i) => '<div class="qz"><b>' + (i + 1) + '. ' + esc(q.q) + '</b>' + q.o.map((o, k) => '<label class="ck"><input type="radio" name="q' + i + '" data-q="' + i + '" value="' + k + '"' + (A['q' + i] === k ? ' checked' : '') + '> ' + esc(o) + '</label>').join('') + '</div>').join('');
    else if (t.widget && t.widget.type === 'bug') w = '<div class="row"><button class="btn" id="tLoad">Fehlerhafte App in die Werkstatt laden</button></div><label>Die App zeigt bei 10 V und 2 A<input id="tShown" value="' + esc(A.shown || '') + '" inputmode="decimal"></label><label>Richtig wäre (in W)<input id="tRight" value="' + esc(A.right || '') + '" inputmode="decimal"></label><label>Der Fehler<select id="tBug"><option value="">wählen …</option><option value="plus"' + (A.bug === 'plus' ? ' selected' : '') + '>Die App addiert statt zu multiplizieren</option><option value="div"' + (A.bug === 'div' ? ' selected' : '') + '>Die App teilt statt zu multiplizieren</option><option value="einheit"' + (A.bug === 'einheit' ? ' selected' : '') + '>Die Einheit ist falsch</option></select></label>';
    else if (t.kind === 'app') w = '<div class="row"><button class="btn" id="tWerk">Zur Werkstatt</button><button class="btn" id="tAuf">Zum Auftrag</button></div><p class="mute small">Geprüft wird der Code, der gerade in der Werkstatt steht.</p>';
    else if (t.kind === 'kifs') w = '<div class="row"><button class="btn pri" id="tKf">Zum KI-Führerschein</button></div>';
    else if (t.kind === 'notes') w = '<div class="row"><button class="btn" id="tNotes">Zu den Notizen</button></div>';
    else if (t.kind === 'flag') w = '<div class="row"><button class="btn" id="tNotes">Zu den Notizen</button><button class="btn" id="tLib">Zur Bibliothek</button></div>';
    v.innerHTML = '<div class="card"><button class="btn s" id="tBack">← Alle Aufgaben</button><h2>' + esc(t.title) + '</h2><p>' + esc(t.text) + '</p>' + think(t) + w + '<div class="row"><button class="btn pri" id="tCheck">Prüfen</button><button class="btn" id="tHint">Tipp</button>' + (t.kind === 'app' || t.kind === 'prompt' ? '<button class="btn" id="tSol">Beispiel zeigen</button>' : '') + '<button class="btn" id="tHand" ' + ((d[t.id] || 0) > 0 ? '' : 'disabled') + '>Abgeben</button></div><div id="tHintBox" class="hintbox" hidden>' + esc(t.hint || '') + '</div><div id="tRes"></div></div>';
    $('#tBack').onclick = () => go('aufgaben');
    $$('[data-th]', v).forEach(b => { b.onclick = () => { const o = lsGet('app.think', {}); o[t.id] = +b.dataset.th; lsSet('app.think', o); const q = root.THINK[t.id]; if (+b.dataset.th === q.right) { try { const th = lsGet('lm4.think', {}); th[t.id] = 1; lsSet('lm4.think', th); } catch (e) {} if (root.Badges) root.Badges.stat('think', 1, 'max'); } render(); }; });
    if ($('#tP')) $('#tP').oninput = e => { S.prompts[t.id] = e.target.value; persist(); };
    $$('input[data-i]', v).forEach(c => { c.onchange = () => { A.sel = $$('input[data-i]', v).filter(x => x.checked).map(x => +x.dataset.i); persist(); }; });
    $$('input[data-q]', v).forEach(c => { c.onchange = () => { A['q' + c.dataset.q] = +c.value; persist(); }; });
    if ($('#tLoad')) $('#tLoad').onclick = () => { S.code = SAMPLES.fehlerhaft; S.name = 'Leistungsrechner'; persist(); go('werkstatt'); toast('Fehlerhafte App geladen: starten, 10 und 2 eingeben'); };
    ['tShown', 'tRight'].forEach(i => { if ($('#' + i)) $('#' + i).oninput = e => { A[i === 'tShown' ? 'shown' : 'right'] = e.target.value; persist(); }; }); if ($('#tBug')) $('#tBug').onchange = e => { A.bug = e.target.value; persist(); };
    if ($('#tWerk')) $('#tWerk').onclick = () => go('werkstatt'); if ($('#tAuf')) $('#tAuf').onclick = () => go('auftrag'); if ($('#tNotes')) $('#tNotes').onclick = () => go('notizen'); if ($('#tLib')) $('#tLib').onclick = () => go('bibliothek'); if ($('#tKf')) $('#tKf').onclick = () => go('fuehrer');
    $('#tHint').onclick = () => { $('#tHintBox').hidden = !$('#tHintBox').hidden; try { const h = lsGet('sim.hints', {}); h[t.id] = Math.max(h[t.id] || 0, 1); localStorage.setItem('sim.hints', JSON.stringify(h)); } catch (e) {} };
    if ($('#tSol')) $('#tSol').onclick = () => { if (t.kind === 'prompt') { const keep = S.prompts[t.id]; t.sol(); const p = S.prompts[t.id]; S.prompts[t.id] = keep; sheet('Beispiel', b => { b.innerHTML = '<p class="mute" style="margin-top:0">So könnte ein guter Text aussehen. Schreibe deinen eigenen, am besten zu einem Thema, das dich interessiert.</p><div class="prev">' + esc(p) + '</div>'; }); } else if (confirm('Das Beispiel ersetzt den Code in der Werkstatt. Weiter?')) { const keep = { n: NOTES, l: LIB, a: S.answers, p: S.prompts, f: S.flags }; t.sol(); NOTES = keep.n; LIB = keep.l; S.answers = keep.a; S.prompts = keep.p; S.flags = keep.f; persist(); try { const h = lsGet('sim.hints', {}); h[t.id] = 3; localStorage.setItem('sim.hints', JSON.stringify(h)); } catch (e) {} go('werkstatt'); toast('Beispiel geladen: Starten und ansehen'); } };
    $('#tCheck').onclick = async () => {
      $('#tRes').innerHTML = '<p class="mute">Prüfe …</p>'; const L = await runCheck(t), p = pctOf(L); markDone(t.id, p); persist();
      $('#tRes').innerHTML = '<div class="pct ' + (p >= 100 ? 'g' : '') + '">' + p + ' %</div>' + L.map(l => '<div class="rl ' + (l.ok ? 'ok' : 'no') + '">' + (l.ok ? '✓ ' : '✗ ') + esc(l.text) + (!l.ok && l.why ? '<div class="why">' + esc(l.why) + '</div>' : '') + '</div>').join('');
      $('#tHand').disabled = !(p > 0); if (p >= 100) toast('Geschafft!');
    };
    $('#tHand').onclick = () => { const p = done()[t.id] || 0; if (root.Auswertung && p > 0) root.Auswertung.handIn(t.id, p, t.title); };
  }

  /* ----- Menü ----- */
  function menu() {
    sheet('Menü', b => {
      const items = [['Aufgaben', () => go('aufgaben')], ['Abzeichen', () => root.Badges && root.Badges.open()], ['Trainer: Erste Schritte', () => root.Trainer && root.Trainer.start()], ['Kampagne', () => root.Kampagne && root.Kampagne.open()], ['Lernstand sichern oder laden', () => root.Lernstand && root.Lernstand.open()], ['Ergebnis senden', () => root.Auswertung && root.Auswertung.openSend()], ['Lernheft App-Werkstatt (PDF)', () => { location.href = 'tonfunk-lab-lernen-app.pdf'; }], ['Neu in dieser Version', () => root.LabNeu && root.LabNeu()]];
      b.innerHTML = items.map((x, i) => '<button class="row mi" data-i="' + i + '">' + x[0] + '</button>').join('');
      $$('.mi', b).forEach(btn => { btn.onclick = () => { $('.backdrop').remove(); items[+btn.dataset.i][1](); }; });
    });
  }
  root.AppWerk = { go, W, TASKS, DATA, runApp, rubric, makeZip, encodeApp, decodeApp, md, state: () => ({ S, NOTES, LIB }) };
  root.LabTrainerAPI = { lab: 'app', go, tab: () => tab, notes: () => NOTES.length, lib: () => LIB.length, code: () => S.code };

  /* ----- Start ----- */
  const init = () => {
    $('#bMenu').onclick = menu; const sp = new URLSearchParams(location.search), t0 = sp.get('aufgabe'); let st = 'start'; try { st = localStorage.getItem('app.tab') || 'start'; } catch (e) {}
    tab = TABS.some(x => x[0] === st) ? st : 'start'; if (t0 && TASKS.some(t => t.id === t0)) { tab = 'aufgaben'; openTaskId = t0; } render();
    if (!document.getElementById('gate')) return;
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window);
