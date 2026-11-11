'use strict';
/* Tonfunk Lab: Ein-Klick-Rückmeldung je Aufgabe ("War die Aufgabe: zu leicht | passt | zu schwer | unklar").
   Kernmodul ohne Browserbezug (node-testbar). Der Browserteil unten hängt sich selbst ein: er beobachtet wie design.js (lm4.last) Schreibzugriffe auf
   sim.done / lm4.tdone und blendet nach einer neu bearbeiteten Aufgabe eine kleine Zeile ein. Die Lab-Seiten müssen dafür nicht einzeln geändert werden;
   design.js lädt dieses Skript nach. Ohne Speicher oder ohne Aufgabenverzeichnis passiert einfach nichts.

   Speicher: lm4.fb = { "<aufgabeId>": { l: "<Lab-Kürzel>", v: "leicht|passt|schwer|unklar", t: ms } }, je Aufgabe die letzte Antwort dieses Geräts.
   Keine Namen, kein Server. Der Schlüssel beginnt mit lm4. und wandert deshalb in die Lernstand-Datei (lernstand.js, "Alles als Datei"). Ausgewertet wird
   in feedback-auswertung.html (Häufungen, Export als JSON oder CSV, Zusammenführen mehrerer Geräte-Dateien). */
(function (root) {
  const KEY = 'lm4.fb', MAXN = 3000, MAXTXT = 2000000;
  const ID = /^[A-Za-z0-9_.-]{1,40}$/, LAB = /^[a-z0-9]{1,10}$/;
  const WERTE = ['leicht', 'passt', 'schwer', 'unklar'];
  const TEXT = { leicht: 'zu leicht', passt: 'passt', schwer: 'zu schwer', unklar: 'unklar' };
  const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
  const num = v => { const x = +v; return isFinite(x) ? x : 0; };

  /* gespeicherten Zustand säubern: nur gültige Id, Lab, Wert, Zeit > 0; höchstens MAXN Einträge (die ältesten fallen weg) */
  function norm(raw) {
    const o = {}; if (!isObj(raw)) return o;
    Object.keys(raw).forEach(id => {
      const e = raw[id]; if (!ID.test(id) || !isObj(e)) return;
      const l = String(e.l == null ? '' : e.l), v = String(e.v), t = Math.round(num(e.t));
      if (!LAB.test(l) || WERTE.indexOf(v) < 0 || t <= 0) return;
      o[id] = { l, v, t };
    });
    const ks = Object.keys(o); if (ks.length > MAXN) ks.sort((a, b) => o[a].t - o[b].t).slice(0, ks.length - MAXN).forEach(k => { delete o[k]; });
    return o;
  }
  /* neue Antwort eintragen (ersetzt die frühere zu dieser Aufgabe); null bei ungültigen Angaben */
  function setze(state, lab, id, v, t) {
    if (!ID.test(String(id)) || !LAB.test(String(lab)) || WERTE.indexOf(v) < 0) return null;
    const s = norm(state), z = Math.round(num(t)) || Date.now(); s[id] = { l: lab, v, t: z }; return norm(s);
  }
  const liste = state => { const s = norm(state); return Object.keys(s).map(id => ({ lab: s[id].l, id, v: s[id].v, t: s[id].t })).sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1)); };
  const tag = t => { const d = new Date(t), p = n => (n < 10 ? '0' : '') + n; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };

  /* mehrere Listen zusammenlegen; gleicher Eintrag (Lab, Aufgabe, Wert, Zeit) zählt nur einmal, damit dieselbe Datei zweimal einlesen nichts verdoppelt */
  function zusammen() {
    const seen = {}, out = [];
    Array.prototype.slice.call(arguments).forEach(l => (Array.isArray(l) ? l : []).forEach(r => {
      if (!isObj(r) || !ID.test(String(r.id)) || !LAB.test(String(r.lab)) || WERTE.indexOf(r.v) < 0) return; const t = Math.round(num(r.t)); if (t <= 0) return;
      const k = r.lab + '|' + r.id + '|' + r.v + '|' + t; if (seen[k]) return; seen[k] = 1; out.push({ lab: r.lab, id: String(r.id), v: r.v, t });
    }));
    return out.sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1));
  }

  /* Auswertung je Aufgabe. titel(id) liefert optional den Namen. Sortiert nach Zahl der Antworten "unklar" plus "zu schwer", dann nach deren Anteil. */
  const MIN_N = 2, ANTEIL = 0.4;
  function aggregiere(recs, titel) {
    const m = {};
    zusammen(recs).forEach(r => {
      const e = m[r.id] || (m[r.id] = { id: r.id, lab: r.lab, titel: (titel && titel(r.id)) || '', n: 0, leicht: 0, passt: 0, schwer: 0, unklar: 0 });
      e.n++; e[r.v]++;
    });
    const rows = Object.keys(m).map(k => {
      const e = m[k]; e.problem = e.schwer + e.unklar; e.anteil = e.n ? e.problem / e.n : 0;
      e.flags = [];
      if (e.unklar >= MIN_N && e.unklar / e.n >= ANTEIL) e.flags.push('oft unklar');
      if (e.schwer >= MIN_N && e.schwer / e.n >= ANTEIL) e.flags.push('oft zu schwer');
      if (e.leicht >= MIN_N && e.leicht / e.n >= ANTEIL) e.flags.push('oft zu leicht');
      return e;
    });
    return rows.sort((a, b) => b.problem - a.problem || b.anteil - a.anteil || b.n - a.n || (a.id < b.id ? -1 : 1));
  }
  function summe(recs) {
    const s = { n: 0, leicht: 0, passt: 0, schwer: 0, unklar: 0, aufgaben: 0 }, ids = {};
    zusammen(recs).forEach(r => { s.n++; s[r.v]++; ids[r.id] = 1; }); s.aufgaben = Object.keys(ids).length; return s;
  }

  /* Export. JSON: { app, v, t, d:[{lab,id,v,t}] }. CSV: Semikolon, Kopfzeile, mit BOM für Excel (deutsche Einstellung). */
  function zuJson(recs, now) { return JSON.stringify({ app: 'tonfunk-lab-feedback', v: 1, t: new Date(num(now) || Date.now()).toISOString(), d: zusammen(recs) }); }
  const csvZelle = s => { s = String(s); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  function zuCsv(recs) {
    const z = ['Lab;Aufgabe;Wert;Datum'];
    zusammen(recs).forEach(r => z.push([r.lab, r.id, TEXT[r.v], tag(r.t)].map(csvZelle).join(';')));
    return '﻿' + z.join('\r\n') + '\r\n';
  }
  /* Einlesen einer exportierten JSON-Datei; wirft Error mit deutscher Meldung */
  function leseJson(text) {
    if (typeof text !== 'string' || !text.trim()) throw new Error('Die Datei ist leer.');
    if (text.length > MAXTXT) throw new Error('Die Datei ist zu groß.');
    let o; try { o = JSON.parse(text.replace(/^﻿/, '')); } catch (e) { throw new Error('Das ist keine gültige Rückmelde-Datei.'); }
    if (!isObj(o) || o.app !== 'tonfunk-lab-feedback' || !Array.isArray(o.d)) throw new Error('Das ist keine Rückmelde-Datei aus dem Tonfunk Lab.');
    return zusammen(o.d.slice(0, 20000));
  }

  /* Welche Aufgaben haben sich zwischen zwei Ständen von sim.done / lm4.tdone (JSON-Text) geändert? Nur Aufgaben mit einem Wert. Mehr als max Änderungen
     (Import, Zurücksetzen) gelten nicht als eigenes Bearbeiten. */
  function geaendert(altText, neuText, max) {
    let o, n; try { o = JSON.parse(altText || '{}') || {}; n = JSON.parse(neuText) || {}; } catch (e) { return []; }
    if (!isObj(o) || !isObj(n)) return [];
    const ch = Object.keys(n).filter(x => ID.test(x) && n[x] !== o[x] && n[x] != null && n[x] !== false);
    return ch.length && ch.length <= (max || 3) ? ch : [];
  }
  function labVon(id, rows, fallback) {
    if (Array.isArray(rows)) for (let i = 0; i < rows.length; i++) { const r = rows[i]; if (r && r[0] === id && LAB.test(String(r[1]))) return r[1]; }
    const f = String(fallback || '').toLowerCase().replace(/\.html$/, '').replace(/lab$/, '').replace(/[^a-z0-9]/g, '').slice(0, 10);
    return LAB.test(f) ? f : '';
  }

  const api = { KEY, WERTE, TEXT, MIN_N, ANTEIL, norm, setze, liste, zusammen, aggregiere, summe, zuJson, zuCsv, leseJson, geaendert, labVon, tag };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Feedback = Object.assign(root.Feedback || {}, api);

  /* ---------- Browserteil ---------- */
  if (typeof document === 'undefined' || !root.localStorage || !root.Storage) return;
  const FILES = ['layout.html', 'schaltplan.html', 'simlab.html', 'digilab.html', 'messlab.html', 'elslab.html', 'ntslab.html', 'wsllab.html', 'analab.html', 'hauslab.html', 'appwerkstatt.html', 'spslab.html', 'pcblab.html', 'antlab.html', 'senlab.html', 'reglab.html', 'thmlab.html', 'emvlab.html', 'enrlab.html', 'codelab.html', 'pilab.html', 'dslab.html', 'pruefungslab.html', 'verbund.html', 'tollab.html', 'zerlab.html', 'pnelab.html', 'hydlab.html', 'cnclab.html', 'werlab.html', 'inslab.html', 'netlab.html', 'kallab.html', 'laglab.html', 'zeilab.html', 'arblab.html', 'matlab.html', 'itslab.html', 'buclab.html', 'ladlab.html', 'englab.html', 'bhflab.html', 'konlab.html', 'wfllab.html', 'reclab.html', 'sqllab.html', 'linlab.html', 'alglab.html', 'hwllab.html', 'syslab.html', 'ssllab.html', 'fuglab.html', 'maslab.html', 'mchlab.html', 'ferlab.html', 'maklab.html'];
  let file = ''; try { file = String(root.location.pathname || '').split('/').pop(); } catch (e) { file = ''; }
  if (FILES.indexOf(file) < 0 || root.__lm4FbWrapped) return;
  root.__lm4FbWrapped = true;
  const ls = root.localStorage, ST = root.Storage.prototype, orig = ST.setItem;
  const lesen = () => { try { return norm(JSON.parse(ls.getItem(KEY))); } catch (e) { return {}; } };
  const speichern = s => { try { orig.call(ls, KEY, JSON.stringify(s)); return true; } catch (e) { return false; } };
  let strip = null, timer = null;
  const weg = () => { clearTimeout(timer); if (strip) { strip.remove(); strip = null; } };
  function css() {
    if (document.getElementById('fbCss')) return;
    const st = document.createElement('style'); st.id = 'fbCss';
    st.textContent = '#fbStrip{position:fixed;left:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:250;max-width:calc(100vw - 24px);display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:6px 8px 6px 12px;border-radius:12px;border:1px solid var(--line,#38424d);background:var(--panel,#222830);color:var(--fg,#e8ecf0);font:13px/1.3 system-ui,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.3)}'
      + '#fbStrip button{min-height:44px;min-width:44px;padding:0 10px;border-radius:10px;border:1px solid var(--line,#38424d);background:var(--panel2,#2c343e);color:var(--fg,#e8ecf0);font:600 13px system-ui,sans-serif;cursor:pointer}'
      + '#fbStrip button:hover{filter:brightness(1.12)}#fbStrip button:focus-visible{outline:3px solid var(--focus,#ffd166);outline-offset:2px}#fbStrip .fbX{border-color:transparent;background:transparent;color:var(--mute,#9aa6b2);font-size:18px}'
      + '@media print{#fbStrip{display:none}}';
    document.head.appendChild(st);
  }
  function zeige(id, lab) {
    weg(); css();
    const el = document.createElement('div'); el.id = 'fbStrip'; el.setAttribute('role', 'group'); el.setAttribute('aria-label', 'Rückmeldung zur Aufgabe');
    const q = document.createElement('span'); q.textContent = 'War die Aufgabe:'; el.appendChild(q);
    WERTE.forEach(v => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = TEXT[v];
      b.onclick = () => {
        const s = setze(lesen(), lab, id, v, Date.now()); if (s) speichern(s);
        el.textContent = ''; const d = document.createElement('span'); d.setAttribute('role', 'status'); d.textContent = 'Danke für die Rückmeldung.'; el.appendChild(d);
        clearTimeout(timer); timer = setTimeout(weg, 1600);
      };
      el.appendChild(b);
    });
    const x = document.createElement('button'); x.type = 'button'; x.className = 'fbX'; x.textContent = '×'; x.setAttribute('aria-label', 'Rückmeldung schließen'); x.onclick = weg; el.appendChild(x);
    document.body.appendChild(el); strip = el;
    timer = setTimeout(weg, 30000);
  }
  function nachBearbeiten(ids) {
    try {
      const id = ids[ids.length - 1], cur = lesen(); if (cur[id]) return;   // je Aufgabe nur einmal fragen
      const lab = labVon(id, root.AUFGABEN, root.LAB || file); if (!lab) return;
      setTimeout(() => { try { if (document.body && !lesen()[id]) zeige(id, lab); } catch (e) {} }, 700);
    } catch (e) {}
  }
  ST.setItem = function (k, v) {
    const res = (k === 'sim.done' || k === 'lm4.tdone') && this === ls; let old = null;
    if (res) { try { old = this.getItem(k); } catch (e) { old = null; } }
    const r = orig.apply(this, arguments);
    if (res) { try { const ids = geaendert(old, v, 3); if (ids.length) nachBearbeiten(ids); } catch (e) {} }
    return r;
  };
})(typeof window !== 'undefined' ? window : globalThis);
