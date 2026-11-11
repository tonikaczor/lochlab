'use strict';
/* Tonfunk Lab: Schaltfläche "Nächste Aufgabe" (Wunsch des Ausbilders: nach einer geschafften Aufgabe direkt weiter, ohne Umweg über das Menü).
   Kernfunktionen ohne Browserbezug (node-testbar, window.Weiter). Der Browserteil unten hängt sich wie feedback.js ein: er beobachtet Schreibzugriffe auf
   sim.done / lm4.tdone, erkennt eine NEU gelöste Aufgabe (Ergebnis >= 100, vorher darunter; höchstens 3 geänderte Einträge, sonst Import oder
   Zurücksetzen) und blendet unten rechts eine kleine, schließbare Leiste ein: "Nächste Aufgabe →" mit dem Titel der nächsten noch ungelösten Aufgabe
   desselben Labs. Der Wechsel ist ein Seitenaufruf <lab>.html?aufgabe=<ID>; diesen Deep-Link verarbeitet jedes Lab selbst (kein gemeinsames Aufgabenwahl-Interface).
   Reihenfolge: wie im Aufgabenverzeichnis (aufgaben.js) nach der aktuellen, am Ende wieder von vorn, nur Aufgaben mit Ergebnis < 100. Sind alle gelöst,
   zeigt die Leiste stattdessen den Abschluss mit Links zur Übersicht und zum Ausbildungsplan.
   Nicht angezeigt: Startseite und alle Nicht-Lab-Seiten, Hub verbund.html (Projekt-Stationen, ?verbund=), Prüfungs-Lab (pr), Duell/Wettbewerb/Probetest
   (?duell=, ?wett, ?probe, ?pruefung), im Passwort-Tor (#gate) und beim Drucken.
   Speicher: nur lesend (sim.done, lm4.tdone). Geschrieben wird allein der Sitzungsmerker sessionStorage "lm4.weiter.zu" nach dem Schließen (ohne Speicher
   passiert nichts Schlimmes). Die Lab-Seiten bleiben unverändert; design.js lädt dieses Skript nach und es prüft sich selbst. */
(function (root) {
  const ID = /^[A-Za-z0-9_.-]{1,40}$/, LABK = /^[a-z0-9]{1,10}$/, ZU = 'lm4.weiter.zu';
  const MODUS = /[?&](duell|wett|wettbewerb|probe|probetest|pruefung|exam|verbund)(=|&|#|$)/i;
  const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
  const num = v => { const x = +v; return isFinite(x) ? x : 0; };
  const jparse = t => { try { const o = JSON.parse(t || '{}'); return isObj(o) ? o : null; } catch (e) { return null; } };

  /* beste Ergebnisse je Aufgabe aus den beiden Speichern (Texte oder Objekte), wie lernpfad.js */
  function ergebnisse() {
    const m = {};
    Array.prototype.slice.call(arguments).forEach(a => {
      const o = typeof a === 'string' ? jparse(a) : (isObj(a) ? a : null); if (!o) return;
      Object.keys(o).forEach(k => { const v = num(o[k]); if (v > (m[k] || 0)) m[k] = v; });
    });
    return m;
  }
  const geloest = (res, id) => num(res && res[id]) >= 100;

  /* Welche Aufgaben sind zwischen zwei Ständen NEU gelöst (>= 100, vorher darunter)? Änderten sich mehr als max Einträge, war es ein Import oder
     Zurücksetzen und es zählt nicht als eigenes Lösen. */
  function neuGeloest(altText, neuText, max) {
    const o = typeof altText === 'string' || altText == null ? jparse(altText) : altText, n = typeof neuText === 'string' ? jparse(neuText) : neuText;
    if (!o || !n) return [];
    const ch = Object.keys(n).filter(x => ID.test(x) && n[x] !== o[x]);
    return ch.length && ch.length <= (max || 3) ? ch.filter(x => num(n[x]) >= 100 && num(o[x]) < 100) : [];
  }

  /* Lab-Schlüssel zu einer Seitendatei (nur echte Labs, keine Hubs) */
  function labVonDatei(reg, file) {
    if (!isObj(reg) || !file) return '';
    const ks = Object.keys(reg);
    for (let i = 0; i < ks.length; i++) { const r = reg[ks[i]]; if (r && r.file === file && !r.hub) return ks[i]; }
    return '';
  }
  /* Grund, warum die Leiste auf dieser Seite nicht erscheint ('' = darf erscheinen) */
  function ausnahme(file, search, reg) {
    const k = labVonDatei(reg, file);
    if (!k) return 'kein Lab';
    if (k === 'pr') return 'Prüfung';
    if (MODUS.test(String(search || ''))) return 'Modus';
    return '';
  }

  /* nächste noch ungelöste Aufgabe im Lab der Aufgabe id (Reihenfolge wie im Verzeichnis, danach wieder von vorn); null bei unbekannter Aufgabe.
     { art: 'aufgabe', row, lab } oder { art: 'fertig', lab } */
  function naechste(rows, res, id) {
    if (!Array.isArray(rows)) return null;
    const row = rows.filter(r => Array.isArray(r) && r[0] === id)[0]; if (!row) return null;
    const lab = row[1], list = rows.filter(r => Array.isArray(r) && r[1] === lab), i = list.indexOf(row);
    for (let k = 1; k < list.length; k++) { const r = list[(i + k) % list.length]; if (r[0] !== id && !geloest(res, r[0])) return { art: 'aufgabe', row: r, lab }; }
    return { art: 'fertig', lab };
  }

  /* Adresse der Aufgabe; ein ?beruf= der aktuellen Seite bleibt erhalten */
  function link(reg, row, search) {
    const R = reg && reg[row[1]]; if (!R || !R.file || !ID.test(String(row[0]))) return '';
    const b = /[?&]beruf=(\w+)/.exec(String(search || ''));
    return R.file + '?aufgabe=' + encodeURIComponent(row[0]) + (b ? '&beruf=' + b[1] : '');
  }

  /* Inhalt der Leiste für die gerade gelöste Aufgabe id, oder null (Ausnahmeseite, unbekannte Aufgabe, Verzeichnis fehlt).
     c: { rows, reg, res, id, file, search, plan (ausbildungsplan.html vorhanden, Standard ja) } */
  function planen(c) {
    c = c || {};
    if (ausnahme(c.file, c.search, c.reg)) return null;
    const lab = labVonDatei(c.reg, c.file), n = naechste(c.rows, c.res, c.id);
    if (!n || n.lab !== lab || !c.reg[n.lab]) return null;
    if (n.art === 'aufgabe') {
      const href = link(c.reg, n.row, c.search); if (!href) return null;
      return { art: 'aufgabe', kopf: 'Nächste Aufgabe', titel: String(n.row[3] || n.row[0]), href, aria: 'Nächste Aufgabe: ' + String(n.row[3] || n.row[0]) };
    }
    const links = [{ text: 'Zurück zur Übersicht', href: 'index.html' }];
    if (c.plan !== false) links.push({ text: 'Weiter im Ausbildungsplan', href: 'ausbildungsplan.html' });
    return { art: 'fertig', kopf: 'Alle Aufgaben in diesem Lab geschafft', titel: String(c.reg[n.lab].name || ''), links };
  }

  const CSS = '#wtBar{position:fixed;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:240;width:min(420px,calc(100vw - 24px));display:flex;align-items:stretch;gap:6px;padding:6px;border-radius:14px;border:1px solid var(--line,#38424d);background:var(--panel,#222830);color:var(--fg,#e8ecf0);font:14px/1.3 system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.35)}'
    + '#wtBar .wtMain{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:1px;min-height:44px;padding:6px 14px;border-radius:10px;border:1px solid transparent;background:var(--accent-bg,#0f5fb8);color:#fff;text-decoration:none;font:700 15px/1.25 system-ui,sans-serif}'
    + '#wtBar .wtMain small{display:block;font:500 12.5px/1.25 system-ui,sans-serif;opacity:.95;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '#wtBar .wtDone{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px;padding:4px 6px}#wtBar .wtDone b{font-size:14px}#wtBar .wtLinks{display:flex;flex-wrap:wrap;gap:6px}'
    + '#wtBar .wtLinks a{display:inline-flex;align-items:center;min-height:44px;padding:0 12px;border-radius:10px;border:1px solid var(--line,#38424d);background:var(--panel2,#2c343e);color:var(--fg,#e8ecf0);text-decoration:none;font:600 13.5px system-ui,sans-serif}'
    + '#wtBar .wtX{flex:none;min-width:44px;min-height:44px;border-radius:10px;border:1px solid transparent;background:transparent;color:var(--mute,#9aa6b2);font:18px system-ui,sans-serif;cursor:pointer}'
    + '#wtBar a:hover,#wtBar .wtX:hover{filter:brightness(1.1)}#wtBar a:focus-visible,#wtBar .wtX:focus-visible{outline:3px solid var(--focus,#ffd166);outline-offset:2px}'
    + '@media print{#wtBar{display:none!important}}';

  /* Leiste bauen (document-ähnliches Objekt mit createElement); onZu wird beim Schließen aufgerufen */
  function bauen(doc, p, onZu) {
    const el = doc.createElement('div'); el.id = 'wtBar'; el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Weiter zur nächsten Aufgabe'); el.setAttribute('aria-live', 'polite');
    if (p.art === 'aufgabe') {
      const a = doc.createElement('a'); a.className = 'wtMain'; a.href = p.href; a.setAttribute('aria-label', p.aria);
      const b = doc.createElement('span'); b.textContent = p.kopf + ' →'; a.appendChild(b);
      const s = doc.createElement('small'); s.textContent = p.titel; a.appendChild(s);
      el.appendChild(a);
    } else {
      const d = doc.createElement('div'); d.className = 'wtDone';
      const b = doc.createElement('b'); b.textContent = '✓ ' + p.kopf; d.appendChild(b);
      const l = doc.createElement('div'); l.className = 'wtLinks';
      p.links.forEach(x => { const a = doc.createElement('a'); a.href = x.href; a.textContent = x.text; l.appendChild(a); });
      d.appendChild(l); el.appendChild(d);
    }
    const x = doc.createElement('button'); x.type = 'button'; x.className = 'wtX'; x.textContent = '×'; x.setAttribute('aria-label', 'Hinweis schließen'); x.onclick = () => { if (onZu) onZu(); };
    el.appendChild(x);
    el.onkeydown = e => { if (e && e.key === 'Escape' && onZu) onZu(); };
    return el;
  }

  const api = { ZU, ergebnisse, geloest, neuGeloest, labVonDatei, ausnahme, naechste, link, planen, bauen, CSS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Weiter = Object.assign(root.Weiter || {}, api);

  /* ---------- Browserteil ---------- */
  if (typeof document === 'undefined' || !root.localStorage || !root.Storage || root.__lm4WeiterWrapped) return;
  let file = '', search = ''; try { file = String(root.location.pathname || '').split('/').pop(); search = String(root.location.search || ''); } catch (e) { file = ''; }
  if (!/lab\.html$|^(layout|schaltplan|appwerkstatt)\.html$/.test(file) || file === 'pruefungslab.html' || MODUS.test(search)) return;
  root.__lm4WeiterWrapped = true;
  const ls = root.localStorage, ST = root.Storage.prototype, orig = ST.setItem, t0 = Date.now();
  let bar = null, timer = null, poll = null;
  const zu = () => { try { return !!root.sessionStorage.getItem(ZU); } catch (e) { return false; } };
  const merke = () => { try { root.sessionStorage.setItem(ZU, '1'); } catch (e) {} };
  const weg = () => { clearTimeout(timer); if (poll) { try { clearInterval(poll); } catch (e) {} poll = null; } if (bar) { bar.remove(); bar = null; } };
  const lese = k => { try { return ls.getItem(k); } catch (e) { return null; } };
  /* Platz machen: steht die Rückmeldezeile (#fbStrip, unten links) da, sitzt die Leiste darüber, damit sich beide nie verdecken */
  function lage() {
    if (!bar) return;
    let h = 0; try { const fb = document.getElementById('fbStrip'); if (fb) h = Math.ceil(fb.getBoundingClientRect().height) + 8; } catch (e) { h = 0; }
    bar.style.bottom = 'calc(' + (12 + h) + 'px + env(safe-area-inset-bottom))';
  }
  function zeige(id) {
    try {
      if (zu() || !document.body || document.getElementById('gate')) return;
      try { if (root.Duell && typeof root.Duell.active === 'function' && root.Duell.active()) return; } catch (e) {}
      const p = planen({ rows: root.AUFGABEN, reg: root.LAB_REG, res: ergebnisse(lese('sim.done'), lese('lm4.tdone')), id, file, search });
      if (!p) return;
      weg();
      if (!document.getElementById('wtCss')) { const st = document.createElement('style'); st.id = 'wtCss'; st.textContent = CSS; document.head.appendChild(st); }
      bar = bauen(document, p, () => { merke(); weg(); });
      document.body.appendChild(bar); lage();
      if (typeof root.setInterval === 'function') poll = root.setInterval(lage, 500);
    } catch (e) {}
  }
  function nach(ids) {
    if (Date.now() - t0 < 1200) return;      // Spiegelung beim Seitenstart (BerufReg) ist kein Lösen
    const id = ids[ids.length - 1];
    clearTimeout(timer); timer = setTimeout(() => zeige(id), 900);   // nach der Rückmeldezeile (0,7 s), damit diese zuerst da ist
  }
  ST.setItem = function (k, v) {
    const res = (k === 'sim.done' || k === 'lm4.tdone') && this === ls; let old = null;
    if (res) { try { old = this.getItem(k); } catch (e) { old = null; } }
    const r = orig.apply(this, arguments);
    if (res) { try { const ids = neuGeloest(old, v, 3); if (ids.length) nach(ids); } catch (e) {} }
    return r;
  };
})(typeof window !== 'undefined' ? window : globalThis);
