/* codebus.js - Transport-Schicht fuer Text-Codes (Paket T2 der Tausch-/Wettbewerbs-Spezifikation, Abschnitt 5).
   Der Kern kennt nur Text-Codes (TFF1/TFE1/TFW1/TFR1 ...). Wie ein Code von A nach B kommt, regeln austauschbare "Wege".
   Wege Stufe 1: qr (Anzeige nur bis 1100 Zeichen, Scan ueber qrscan.js + jsqr.js lazy), text (Kopieren, Einfuegen, navigator.share),
   datei (Download/Import .txt mit beliebig vielen Codes). Spaeter per Codebus.register(name, { send, receive, label }), z. B. 'server' (Firmennetz).
   LADE-REIHENFOLGE: nach qr.js (und optional qrscan.js); beide werden aber auch bei Bedarf nachgeladen. duell.css liefert die .dl-* Optik
   (wird bei Bedarf nachgeladen). Nach duell.js laden ist nicht noetig, codebus.js hat keine Abhaengigkeit zu Duell.
   API: Codebus.send(code|[codes], { title, url }), Codebus.receive({ accept: /^TF[FEWR]1\./, onCode(code, { via }) , title, onDone }),
        Codebus.register(name, { send(codes, ctx), receive(ctx), label, order, canSend(codes, opts), canReceive() }), Codebus.ways(),
        Codebus.core (ohne DOM, Node-testbar): parseCodes, collector, plan, config, serverActive.
   Datenschutz: nichts wird automatisch gesendet. Ohne Konfiguration (lm4.codebus.server leer) UND ohne Ausbildermodus (lm4.codebus.ausbilder = true)
   gibt es keinen fetch/XMLHttpRequest; der Weg 'server' ist dann gar nicht registriert aktiv und sendet auch sonst nur auf Knopfdruck.
   Codes enthalten nie lm4.name; Dateiname und aria-labels enthalten nie Code-Inhalt. Nur der DOM-Teil wird erst beim Aufruf angefasst. */
(function (root) {
  'use strict';

  /* ================= Kern (ohne DOM) ================= */
  const MAXQR = 1100;                                   /* QR nur bis 1100 Zeichen (wie Auswertung.openSend) */
  const DEFAULT_ACCEPT = /^TF[A-Z]+\d\./;

  /* Einstellung lm4.codebus = { server:'', ausbilder:false }; Standard leer. Fehler beim Lesen => Standard. */
  function config() {
    let o = null;
    try { const s = root.localStorage && root.localStorage.getItem('lm4.codebus'); o = s ? JSON.parse(s) : null; } catch (e) { o = null; }
    const server = o && typeof o.server === 'string' ? o.server.trim() : '';
    return { server: /^https?:\/\//i.test(server) ? server : '', ausbilder: !!(o && o.ausbilder === true) };
  }
  const serverActive = c => { c = c || config(); return !!(c.server && c.ausbilder); };

  /* accept ohne g/y-Flag (sonst "lastIndex"-Falle bei wiederholtem test) */
  function acceptRe(a) {
    if (a instanceof RegExp) return new RegExp(a.source, a.flags.replace(/[gy]/g, ''));
    if (typeof a === 'function') return { test: a };
    return DEFAULT_ACCEPT;
  }

  /* Ein Kandidat (Token) -> Code oder ''. Toleriert Anfuehrungszeichen, Klammern, Komma/Semikolon, URL mit #t=/#s=/#c=Code, BOM. */
  function cleanToken(t) {
    t = String(t).replace(/^[\s﻿​"'`(<\[{*•·-]+|[\s"'`)>\]},;*.]+$/g, '');
    const h = t.match(/[#?&](?:t|s|c|code)=([^&#\s]+)/);    /* Link mit Code im Fragment */
    if (h) { try { t = decodeURIComponent(h[1]); } catch (e) { t = h[1]; } }
    return t.replace(/\.+$/, '');                           /* Satzpunkt hinten weg (Codes enden auf Signatur) */
  }

  /* Text (beliebig viele Codes, Zeilen/Leerraum/Kommas tolerant, ggf. mit Kopfzeilen oder Fremdtext) -> Liste gueltiger Codes ohne Duplikate */
  function parseCodes(text, accept) {
    const re = acceptRe(accept), out = [], seen = Object.create(null);
    if (text == null) return out;
    let s = typeof text === 'string' ? text : (Array.isArray(text) ? text.join('\n') : String(text));
    if (s.length > 5e6) s = s.slice(0, 5e6);                /* Schutz gegen Riesendateien */
    s.split(/[\s,;]+/).forEach(tok => {
      if (!tok) return;
      const c = cleanToken(tok);
      if (c && !seen[c] && re.test(c)) { seen[c] = 1; out.push(c); }
    });
    return out;
  }

  /* Sammler: add(text, via) liest Codes, filtert Praefix, entfernt Duplikate (auch ueber mehrere add-Aufrufe), ruft onCode je neuem Code.
     onCode darf false oder einen Fehltext liefern => Code wird abgelehnt (zaehlt nicht, darf erneut angeboten werden). */
  function collector(accept, onCode) {
    const re = acceptRe(accept), have = Object.create(null), list = [];
    return {
      list: () => list.slice(),
      add(text, via) {
        const res = { neu: [], dup: 0, abgelehnt: [] };
        const hit = parseCodes(text, re);
        hit.forEach(c => {
          if (have[c]) { res.dup++; return; }
          let r = true;
          try { r = onCode ? onCode(c, { via: via || 'text' }) : true; } catch (e) { r = 'Fehler beim Verarbeiten'; }
          if (r === false || typeof r === 'string') { res.abgelehnt.push({ code: c, grund: typeof r === 'string' ? r : '' }); return; }
          have[c] = 1; list.push(c); res.neu.push(c);
        });
        return res;
      }
    };
  }

  /* Datei-Inhalt fuer den Weg 'datei': ein Code je Zeile. Kein Kopf, damit jede Zeile ein Code ist (Parser ignoriert Kopfzeilen trotzdem). */
  const fileText = codes => codes.join('\n') + '\n';
  const FILENAME = 'tonfunk-codes.txt';                     /* bewusst ohne Code-/Namensbezug */

  /* ---------- Registry ---------- */
  const reg = Object.create(null);
  function register(name, w) {
    if (!name || typeof name !== 'string' || !w || typeof w !== 'object') return false;
    reg[name] = { name, label: String(w.label || name), order: typeof w.order === 'number' ? w.order : 50,
      send: typeof w.send === 'function' ? w.send : null, receive: typeof w.receive === 'function' ? w.receive : null,
      canSend: typeof w.canSend === 'function' ? w.canSend : null, canReceive: typeof w.canReceive === 'function' ? w.canReceive : null };
    return true;
  }
  const unregister = name => { delete reg[name]; };
  const sorted = () => Object.keys(reg).map(k => reg[k]).sort((a, b) => a.order - b.order || (a.name < b.name ? -1 : 1));
  const asList = c => (Array.isArray(c) ? c : [c]).map(x => String(x == null ? '' : x).trim()).filter(Boolean);
  /* Welche Wege gelten fuer diese Codes? (Reihenfolge nach order) */
  function plan(codes, opts) {
    codes = asList(codes); opts = opts || {};
    return sorted().filter(w => w.send && (!w.canSend || w.canSend(codes, opts))).map(w => w.name);
  }
  const planReceive = () => sorted().filter(w => w.receive && (!w.canReceive || w.canReceive())).map(w => w.name);
  const ways = () => sorted().map(w => ({ name: w.name, label: w.label, send: !!w.send, receive: !!w.receive }));

  /* ================= DOM-Teil (nur lazy beim Aufruf) ================= */
  const hasDoc = () => typeof document !== 'undefined' && !!document.body;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  function ensureCss() {
    if (document.querySelector('link[href$="duell.css"]')) return;
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'duell.css'; document.head.appendChild(l);
  }
  function toast(msg) {
    const old = document.getElementById('cbToast'); if (old) old.remove();
    const t = el('div', 'dl dl-toast', esc(msg)); t.id = 'cbToast'; t.setAttribute('role', 'status'); document.body.appendChild(t); setTimeout(() => t.remove(), 3200);
  }
  function modal(title) {
    ensureCss();
    const old = document.getElementById('cbBox'); if (old) old.remove();
    const back = document.activeElement;
    const ov = el('div', 'dl dl-ov'); ov.id = 'cbBox';
    const box = el('div', 'dl-box'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', title);
    const hd = el('div', 'dl-hd', '<b>' + esc(title) + '</b>'), x = el('button', 'dl-x0', '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Schließen'); hd.appendChild(x);
    const body = el('div'); box.appendChild(hd); box.appendChild(body); ov.appendChild(box); document.body.appendChild(ov);
    const key = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    function close() { ov.remove(); document.removeEventListener('keydown', key, true); if (back && back.focus) { try { back.focus(); } catch (e) {} } }
    x.onclick = close; ov.addEventListener('mousedown', e => { if (e.target === ov) close(); }); document.addEventListener('keydown', key, true);
    setTimeout(() => { try { x.focus(); } catch (e) {} }, 0);
    return { ov, box, body, close };
  }
  function qrInto(host, text) {                              /* wie duellui.qrInto: qr.js bei Bedarf nachladen, keine zweite Bibliothek */
    const draw = () => { try { const q = root.qrcode(0, 'M'); q.addData(String(text), 'Byte'); q.make(); host.innerHTML = q.createSvgTag({ cellSize: 4, margin: 4, scalable: true }); host.setAttribute('role', 'img'); host.setAttribute('aria-label', 'QR-Code'); } catch (e) { host.textContent = 'QR nicht möglich (Text zu lang)'; } };
    if (root.qrcode) { draw(); return; }
    const s = document.createElement('script'); s.src = 'qr.js'; s.onload = draw; s.onerror = () => { host.textContent = 'QR nicht verfügbar'; }; document.head.appendChild(s);
  }
  function scanCode(onText) {                                /* wie duellui.scanCode: qrscan.js (und jsqr.js) erst beim ersten Scan */
    const go = () => { if (root.QrScan) root.QrScan.open({ title: 'QR-Code scannen', onText }); else toast('Scanner nicht verfügbar. Bitte den Code einfügen.'); };
    if (root.QrScan) { go(); return; }
    const sc = document.createElement('script'); sc.src = 'qrscan.js'; sc.onload = go; sc.onerror = () => toast('Scanner nicht verfügbar. Bitte den Code einfügen.'); document.head.appendChild(sc);
  }
  function copy(text, ta) {
    const sel = () => { if (ta) { ta.focus(); ta.select(); try { document.execCommand('copy'); toast('Kopiert'); } catch (e) { toast('Bitte Text markieren und kopieren'); } } };
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(() => toast('Kopiert'), sel); return; } } catch (e) {}
    sel();
  }
  async function saveText(text, name) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    if (root.LabExport && root.LabExport.saveBlob) { try { await root.LabExport.saveBlob(blob, name); return; } catch (e) {} }
    try { const f = new File([blob], name, { type: blob.type }); if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: name }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }
  const readFile = f => new Promise((res, rej) => {
    if (f.text) { f.text().then(res, rej); return; }
    const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsText(f);
  });
  const btn = (label, cls, aria) => { const b = el('button', 'dl-btn' + (cls ? ' ' + cls : ''), esc(label)); b.type = 'button'; if (aria) b.setAttribute('aria-label', aria); return b; };

  /* ---------- eingebaute Wege ---------- */
  register('qr', {
    label: 'QR-Code', order: 10,
    canSend: (codes) => codes.length === 1 && codes[0].length <= MAXQR,
    send(codes, ctx) {
      const h = el('div', 'dl-qr'); ctx.host.appendChild(h); qrInto(h, codes[0]);
      ctx.host.appendChild(el('p', '', '<small>Zum Weitergeben scannen lassen (Kamera). Bei schlechtem Empfang: Text oder Datei nutzen.</small>'));
    },
    receive(ctx) {
      const b = btn('Scannen', '', 'QR-Code scannen'); ctx.host.appendChild(b);
      b.onclick = () => scanCode(t => { const r = ctx.add(t, 'qr'); return r.neu.length ? true : (r.dup ? 'Diesen Code hast du schon.' : 'Das ist kein passender Code.'); });
    }
  });
  register('text', {
    label: 'Text', order: 20,
    send(codes, ctx) {
      const text = codes.join('\n');
      const ta = el('textarea'); ta.readOnly = true; ta.rows = Math.min(6, codes.length + 1); ta.value = text; ta.id = 'cbTx'; ta.setAttribute('aria-label', 'Code als Text'); ta.style.fontSize = '13px';
      const row = el('div', 'dl-row'), c = btn('Kopieren'), sh = btn('Teilen'); row.appendChild(c);
      c.onclick = () => copy(text, ta); ta.onfocus = () => ta.select();
      if (typeof navigator !== 'undefined' && navigator.share) { row.appendChild(sh); sh.onclick = () => { const d = { title: ctx.opts.title || 'Code', text }; if (ctx.opts.url) d.url = ctx.opts.url; try { const p = navigator.share(d); if (p && p.catch) p.catch(() => {}); } catch (e) {} }; }
      ctx.host.appendChild(ta); ctx.host.appendChild(row);
    },
    receive(ctx) {
      const ta = el('textarea'); ta.rows = 3; ta.id = 'cbIn'; ta.placeholder = 'Code(s) hier einfügen'; ta.setAttribute('aria-label', 'Codes einfügen');
      const row = el('div', 'dl-row'), ok = btn('Übernehmen'); row.appendChild(ok);
      ok.onclick = () => { const r = ctx.add(ta.value, 'text'); if (r.neu.length) ta.value = ''; };
      ctx.host.appendChild(ta); ctx.host.appendChild(row);
    }
  });
  register('datei', {
    label: 'Datei', order: 30,
    send(codes, ctx) {
      const b = btn(codes.length > 1 ? 'Alle ' + codes.length + ' Codes als Datei speichern' : 'Als Datei speichern (.txt)', 'pri');
      b.onclick = () => { saveText(fileText(codes), FILENAME); };
      ctx.host.appendChild(b); ctx.host.appendChild(el('p', '', '<small>Eine .txt-Datei, ein Code je Zeile. Der Dateiname enthält keinen Code.</small>'));
    },
    receive(ctx) {
      const inp = el('input'); inp.type = 'file'; inp.accept = '.txt,.csv,text/plain'; inp.multiple = true; inp.hidden = true; inp.setAttribute('aria-label', 'Datei mit Codes auswählen');
      const b = btn('Datei einlesen (.txt, mehrere Codes)'); b.onclick = () => inp.click();
      inp.onchange = async () => {
        const fs = Array.prototype.slice.call(inp.files || []); let neu = 0, dup = 0;
        for (const f of fs) { try { const r = ctx.add(await readFile(f), 'datei'); neu += r.neu.length; dup += r.dup; } catch (e) { toast('Datei konnte nicht gelesen werden'); } }
        if (fs.length && !neu) toast(dup ? 'Alle Codes waren schon da.' : 'Keine passenden Codes in der Datei.');
        inp.value = '';
      };
      ctx.host.appendChild(b); ctx.host.appendChild(inp);
    }
  });
  /* Weg 'server' (Firmennetz): nur aktiv, wenn lm4.codebus.server gesetzt UND Ausbildermodus (lm4.codebus.ausbilder === true).
     Sendet/holt ausschliesslich im Klick-Handler. Ohne Konfiguration: weder sichtbar noch ein Netzaufruf. Abstimmung mit Betriebsrat vor Aktivierung. */
  register('server', {
    label: 'Server', order: 40,
    canSend: () => serverActive(), canReceive: () => serverActive(),
    send(codes, ctx) {
      const b = btn('An Server senden'); ctx.host.appendChild(b);
      b.onclick = () => { const c = config(); if (!serverActive(c) || typeof fetch !== 'function') return; fetch(c.server, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: fileText(codes) }).then(r => toast(r.ok ? 'Gesendet' : 'Server hat abgelehnt'), () => toast('Server nicht erreichbar')); };
    },
    receive(ctx) {
      const b = btn('Vom Server holen'); ctx.host.appendChild(b);
      b.onclick = () => { const c = config(); if (!serverActive(c) || typeof fetch !== 'function') return; fetch(c.server).then(r => r.text()).then(t => ctx.add(t, 'server'), () => toast('Server nicht erreichbar')); };
    }
  });

  /* ---------- Oeffentlich: send / receive ---------- */
  function send(code, opts) {
    opts = opts || {}; const codes = asList(code);
    if (!hasDoc() || !codes.length) return null;
    const m = modal(opts.title || 'Code weitergeben');
    m.body.appendChild(el('p', '', '<small>Der Code enthält nur dein Kürzel, nie deinen Klarnamen. Es wird nichts automatisch gesendet.</small>'));
    plan(codes, opts).forEach(n => {
      const w = reg[n], card = el('div', 'dl-card'); card.setAttribute('role', 'group'); card.setAttribute('aria-label', w.label);
      card.appendChild(el('div', 'dl-mute', esc(w.label))); m.body.appendChild(card);
      try { w.send(codes, { host: card, opts, toast }); } catch (e) { card.appendChild(el('p', 'dl-err', 'Weg nicht verfügbar')); }
    });
    return { close: m.close };
  }
  function receive(opts) {
    opts = opts || {};
    if (!hasDoc()) return null;
    const m = modal(opts.title || 'Code einlesen');
    const status = el('p', '', ''); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    const col = collector(opts.accept || DEFAULT_ACCEPT, opts.onCode);
    const ctx = {
      host: null, opts, toast,
      add(text, via) {
        const r = col.add(text, via);
        const n = col.list().length, bits = [n + (n === 1 ? ' Code übernommen' : ' Codes übernommen')];
        if (r.dup) bits.push(r.dup + ' doppelt');
        if (r.abgelehnt.length) bits.push(r.abgelehnt.length + ' abgelehnt' + (r.abgelehnt[0].grund ? ' (' + r.abgelehnt[0].grund + ')' : ''));
        if (!r.neu.length && !r.dup && !r.abgelehnt.length) bits.push('kein passender Code gefunden');
        status.textContent = bits.join(' · ');
        return r;
      }
    };
    m.body.appendChild(el('p', '', '<small>Mehrere Codes sind möglich (eine Datei oder ein Text mit vielen Zeilen). Doppelte werden ignoriert.</small>'));
    planReceive().forEach(n => {
      const w = reg[n], card = el('div', 'dl-card'); card.setAttribute('role', 'group'); card.setAttribute('aria-label', w.label);
      card.appendChild(el('div', 'dl-mute', esc(w.label))); m.body.appendChild(card);
      try { w.receive(Object.assign({}, ctx, { host: card })); } catch (e) { card.appendChild(el('p', 'dl-err', 'Weg nicht verfügbar')); }
    });
    m.body.appendChild(status);
    const done = btn('Fertig', 'pri'); const row = el('div', 'dl-row'); row.appendChild(done); m.body.appendChild(row);
    done.onclick = () => { m.close(); if (typeof opts.onDone === 'function') { try { opts.onDone(col.list()); } catch (e) {} } };
    return { close: m.close, codes: col.list };
  }

  const Codebus = { send, receive, register, unregister, ways, core: { parseCodes, collector, plan, planReceive, config, serverActive, fileText, MAXQR, FILENAME } };
  if (typeof module !== 'undefined' && module.exports) module.exports = Codebus; else root.Codebus = Codebus;
})(typeof window !== 'undefined' ? window : globalThis);
