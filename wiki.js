/* wiki.js - Tonfunk Wiki, Kern (Paket W1, SPEC-WIKI-FABLE.md Abschnitt 3, 5, 6).
 * Registry window.Wiki: add, get, bySpeak, byKey, byKat, need (Lazy-Loader per <script>), backlinks, recent,
 * render (Markdown-light), open (Drawer im Lab / Hash in wiki.html), speak (Vorlesen-Bruecke), validate (Datentest).
 * Node: module.exports = {fold, render, validate, KAT, LABS, FILES, DATEIEN} (reine Funktionen, keine DOM-Zugriffe).
 * Suche: Logik in wiki-suche.js (W4), Index wiki-index.js; hier nur die Schnittstelle W.search/W.needSuche. */
(function (root) {
  'use strict';
  var KAT = {
    bauteil: ['Bauteil', 'Bauteile'], geraet: ['Messgerät', 'Messgeräte'], bedien: ['Bedienelement', 'Bedienelemente'],
    regler: ['Regler', 'Regler'], messwert: ['Messwert', 'Messwerte'], begriff: ['Begriff', 'Begriffe'],
    formel: ['Formel', 'Formeln'], norm: ['Normwert', 'Normwerte'], lab: ['Lab', 'Labs']
  };
  var KAT_PREFIX = { bauteil: 'bt-', geraet: 'ger-', bedien: 'bd-', regler: 'rg-', messwert: 'mw-', begriff: 'bg-', formel: 'fo-', norm: 'nw-', lab: 'lab-' };
  // Lab-Kuerzel wie selftest.html LABS[0] (+ Datei, Name)
  var LABS = {
    loch: ['LochLab', 'layout.html'], sch: ['SchaltLab', 'schaltplan.html'], quarz: ['SchaltLab Quarzuhr', 'schaltplan.html'], sim: ['SimLab', 'simlab.html'],
    digi: ['DigiLab', 'digilab.html'], mess: ['MessLab', 'messlab.html'], els: ['Sicherheits-Lab', 'elslab.html'], nts: ['Netzteil-Lab', 'ntslab.html'],
    wsl: ['Wechselstrom-Lab', 'wsllab.html'], ana: ['Analogtechnik-Lab', 'analab.html'], haus: ['HausLab', 'hauslab.html'], app: ['App-Werkstatt', 'appwerkstatt.html'],
    sps: ['SPS-Lab', 'spslab.html'], pcb: ['Leiterplatten-Lab', 'pcblab.html'], ant: ['Antriebs-Lab', 'antlab.html'], sen: ['Sensorik-Lab', 'senlab.html'],
    reg: ['Regelungstechnik-Lab', 'reglab.html'], thm: ['Thermik-Lab', 'thmlab.html'], emv: ['EMV-Lab', 'emvlab.html'], enr: ['Energie-Lab', 'enrlab.html'],
    code: ['Arduino-Lab', 'codelab.html'], pi: ['Pi-Lab', 'pilab.html'], ds: ['Datenblatt-Lab', 'dslab.html'], pr: ['Prüfungs-Lab', 'pruefungslab.html'], vb: ['Projekte', 'verbund.html']
  };
  // Datendateien (Abschnitt 3.3): Name -> Datei; "da" = in diesem Stand vorhanden (sonst laedt need() nicht, kein 404)
  var DATEIEN = {
    bauteile: { src: 'wiki-bauteile.js', kat: ['bauteil'], da: true },
    geraete: { src: 'wiki-geraete.js', kat: ['geraet', 'bedien'], da: true },
    begriffe: { src: 'wiki-begriffe.js', kat: ['begriff'], da: false },
    formeln: { src: 'wiki-formeln.js', kat: ['formel', 'norm', 'lab'], da: false }
  };
  var STATUS = ['entwurf', 'frage', 'geprueft'];
  var WERT_STATUS = ['ueb', 'belegt', 'norm'];

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  // Normalisierung fuer Suche (Grundform; W4 erweitert um Doppelindizierung der Umlaute)
  function fold(s) {
    return String(s || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/ω/g, 'ohm').replace(/µ|μ/g, 'u').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[_\-\/]+/g, ' ').replace(/[^a-z0-9., ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /* ---------- Renderer: Markdown-light -> HTML (Absaetze, Listen "- ", **fett**, [[id|Text]]) ---------- */
  function inline(s, has) {
    var out = esc(s);
    out = out.replace(/\[\[([a-z0-9\-]+)(?:\|([^\]]+))?\]\]/g, function (m, id, txt) {
      var t = txt || id;
      return has(id) ? '<a class="wl" href="#e=' + id + '" data-id="' + id + '">' + t + '</a>' : '<span class="wl-miss">' + t + '</span>';
    });
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    return out;
  }
  function render(lang, has) {
    has = has || function () { return true; };
    var blocks = String(lang || '').replace(/\r/g, '').split(/\n\s*\n/), h = [];
    blocks.forEach(function (b) {
      b = b.trim(); if (!b) return;
      var lines = b.split('\n');
      if (lines.every(function (l) { return /^- /.test(l); })) {
        h.push('<ul>' + lines.map(function (l) { return '<li>' + inline(l.slice(2), has) + '</li>'; }).join('') + '</ul>');
      } else h.push('<p>' + inline(lines.join(' '), has) + '</p>');
    });
    return h.join('');
  }
  // Formeltext: U_D -> U<sub>D</sub>, I_F -> I<sub>F</sub>
  function formel(t) { return esc(t).replace(/([A-Za-zΩω])_([A-Za-z0-9]+)/g, '$1<sub>$2</sub>'); }
  function links(s) { var m, r = [], re = /\[\[([a-z0-9\-]+)(?:\|[^\]]+)?\]\]/g; while ((m = re.exec(String(s || '')))) r.push(m[1]); return r; }

  /* ---------- Validierung (Schema, Abschnitt 3.1 / 4.3 / 8.5) - Node und Browser ---------- */
  function validate(entries, opt) {
    opt = opt || {};
    var err = [], warn = [], ids = {}, alts = {}, i, e;
    var LANG_PFLICHT = { bauteil: 1, geraet: 1, bedien: 1, begriff: 1, formel: 1 };
    function E(id, m) { err.push(id + ': ' + m); }
    function W(id, m) { warn.push(id + ': ' + m); }
    for (i = 0; i < entries.length; i++) {
      e = entries[i];
      if (!e || typeof e !== 'object') { E('#' + i, 'kein Objekt'); continue; }
      var id = String(e.id || '#' + i);
      if (!e.id || !/^[a-z]+-[a-z0-9][a-z0-9\-]*$/.test(e.id)) E(id, 'id fehlt oder nicht nach Muster (praefix-kleinbuchstaben-bindestrich)');
      if (ids[id]) E(id, 'id doppelt'); ids[id] = e;
      if (!KAT[e.kat]) E(id, 'kat unbekannt: ' + e.kat);
      else if (e.id && e.id.indexOf(KAT_PREFIX[e.kat]) !== 0) E(id, 'id-Praefix passt nicht zu kat ' + e.kat + ' (erwartet ' + KAT_PREFIX[e.kat] + ')');
      if (!e.titel || typeof e.titel !== 'string') E(id, 'titel fehlt');
      if (typeof e.kurz !== 'string') E(id, 'kurz fehlt');
      else {
        if (e.kurz.length < 40 || e.kurz.length > 320) E(id, 'kurz ' + e.kurz.length + ' Zeichen (40-320)');
        if (/\[\[/.test(e.kurz)) E(id, 'kurz enthaelt Verweis [[');
        if (/<[a-z\/!]/i.test(e.kurz)) E(id, 'kurz enthaelt HTML');
        if (e.kat !== 'bauteil' && /\b(ich|mein|meine|mir|mich)\b/i.test(e.kurz)) W(id, 'Ich-Form ausserhalb bauteil');
        if (e.kat === 'bauteil' && !/^Ich /.test(e.kurz)) E(id, 'bauteil: kurz muss in Ich-Form beginnen (Sprechblase)');
      }
      if (LANG_PFLICHT[e.kat] && typeof e.lang !== 'string') E(id, 'lang fehlt (Pflicht bei ' + e.kat + ')');
      if (typeof e.lang === 'string') {
        if (e.lang.length > 2500) E(id, 'lang > 2500 Zeichen');
        if (/<[a-z\/!]/i.test(e.lang)) E(id, 'lang enthaelt HTML');
        if (LANG_PFLICHT[e.kat] && !/\[\[/.test(e.lang)) E(id, 'lang ohne Verweis');
      }
      if (e.werte) {
        if (!Array.isArray(e.werte)) E(id, 'werte kein Array');
        else {
          if (!e.quelle) E(id, 'werte ohne quelle');
          e.werte.forEach(function (w, k) {
            if (!Array.isArray(w) || w.length !== 3) { E(id, 'werte[' + k + '] nicht [Name, Wert, Status]'); return; }
            if (WERT_STATUS.indexOf(w[2]) < 0) E(id, 'werte[' + k + '] Status ' + w[2] + ' unbekannt');
            if (/\d\.\d/.test(w[1])) W(id, 'werte[' + k + '] Dezimalpunkt statt Komma: ' + w[1]);
          });
        }
      }
      if (e.formeln) {
        if (!Array.isArray(e.formeln)) E(id, 'formeln kein Array');
        else e.formeln.forEach(function (f, k) { if (!f || typeof f.text !== 'string') E(id, 'formeln[' + k + '] ohne text'); if (f && f.fn) E(id, 'formeln[' + k + '] traegt fn (Rechner bleiben in den Kernen)'); });
      }
      ['verweise', 'labs', 'rigs', 'stich', 'alias', 'alt'].forEach(function (f) { if (e[f] != null && !Array.isArray(e[f])) E(id, f + ' kein Array'); });
      (e.labs || []).forEach(function (l) { if (!LABS[l]) E(id, 'labs: unbekanntes Lab ' + l); });
      if ((e.kat === 'regler' || e.kat === 'messwert')) { if (!e.key) E(id, 'regler/messwert ohne key'); if (!e.labs || e.labs.length !== 1) E(id, 'regler/messwert: genau ein Lab'); }
      if (e.pruef != null && [0, 1, 2, 3].indexOf(e.pruef) < 0) E(id, 'pruef nicht 0-3');
      if (!e.status || STATUS.indexOf(e.status) < 0) E(id, 'status fehlt/unbekannt (entwurf|frage|geprueft)');
      if (e.status === 'frage' && !/^wiki__F\d+$/.test(e.frage || '')) E(id, 'status frage ohne frage wiki__F<n>');
      if (e.svg && e.svg.length > 2048) E(id, 'svg > 2 KB');
      (e.alt || []).forEach(function (a) { alts[a] = id; });
    }
    // Verweise aufloesen, Waisen
    var eingehend = {};
    var has = function (x) { return !!ids[x] || !!alts[x]; };
    entries.forEach(function (e) {
      if (!e || !e.id) return;
      var ziele = (e.verweise || []).concat(links(e.lang)).concat((e.formeln || []).map(function (f) { return f.id; }).filter(Boolean));
      ziele.forEach(function (z) {
        if (!has(z)) { if (opt.teil) W(e.id, 'Verweis ' + z + ' noch nicht vorhanden (spaeteres Paket)'); else E(e.id, 'Verweis auf unbekannte id ' + z); return; }
        if (z === e.id) W(e.id, 'Verweis auf sich selbst');
        eingehend[z] = (eingehend[z] || 0) + 1;
      });
      (e.alt || []).forEach(function (a) { if (ids[a]) E(e.id, 'alt ' + a + ' ist eine lebende id'); });
    });
    entries.forEach(function (e) {
      if (!e || !e.id) return;
      var ok = (e.verweise && e.verweise.length) || links(e.lang).length || eingehend[e.id] || (e.labs && e.labs.length);
      if (!ok) { if (/^(bauteil|geraet|begriff)$/.test(e.kat)) E(e.id, 'Waise (kein Verweis, kein Lab)'); else W(e.id, 'Waise'); }
    });
    // Dubletten ueber fold(titel)
    var seen = {};
    entries.forEach(function (e) { if (!e || !e.titel) return; var k = e.kat + ':' + fold(e.titel); if (seen[k]) W(e.id, 'Titel-Dublette mit ' + seen[k]); else seen[k] = e.id; });
    return { err: err, warn: warn, n: entries.length };
  }

  var api = { KAT: KAT, KAT_PREFIX: KAT_PREFIX, LABS: LABS, DATEIEN: DATEIEN, STATUS: STATUS, fold: fold, render: render, formel: formel, links: links, validate: validate, esc: esc };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  /* ================= Browser-Teil ================= */
  var W = root.Wiki = root.Wiki || {};
  for (var k in api) W[k] = api[k];
  var E = {}, ALT = {}, ORDER = [], LOADED = {}, PENDING = {}, SPEAK = {}, KEYS = {}, BACK = null;
  W.entries = E;

  W.add = function (name, arr) {
    LOADED[name] = true;
    (arr || []).forEach(function (e) {
      if (!e || !e.id) return;
      if (E[e.id]) { for (var f in e) E[e.id][f] = e[f]; e = E[e.id]; }   // Hand-Override ersetzt Felder
      else { E[e.id] = e; ORDER.push(e.id); }
      (e.alt || []).forEach(function (a) { ALT[a] = e.id; });
      if (e.speak) SPEAK[e.speak] = e.id;
      (e.alias || []).forEach(function (a) { if (!SPEAK[a]) SPEAK[a] = e.id; });
      if (e.key && e.labs) KEYS[e.labs[0] + ':' + e.key] = e.id;
    });
    BACK = null;
    W.onchange && W.onchange(name);
  };
  W.get = function (id) { return E[id] || (ALT[id] ? E[ALT[id]] : null); };
  W.has = function (id) { return !!W.get(id); };
  W.bySpeak = function (k) { return E[SPEAK[k]] || null; };
  W.byKey = function (lab, key, rig) { return E[KEYS[lab + ':' + key]] || E['rg-' + lab + '-' + key] || (rig && E['rg-' + lab + '-' + rig + '-' + key]) || E['mw-' + lab + '-' + key] || null; };
  W.all = function () { return ORDER.map(function (id) { return E[id]; }); };
  W.byKat = function (kat) { return W.all().filter(function (e) { return e.kat === kat; }).sort(function (a, b) { return a.titel.localeCompare(b.titel, 'de'); }); };
  W.count = function (kat) { return W.byKat(kat).length; };
  W.loaded = function (name) { return !!LOADED[name]; };
  W.offen = function () { return Object.keys(DATEIEN).filter(function (n) { return DATEIEN[n].da && !LOADED[n]; }); };

  // Lazy-Loader: <script>-Injektion, Promise; fehlende Datei (da:false oder 404) loest trotzdem auf
  W.need = function (names) {
    if (typeof names === 'string') names = [names];
    return Promise.all(names.map(function (n) {
      var d = DATEIEN[n];
      if (!d || LOADED[n] || !d.da) return Promise.resolve(false);
      if (PENDING[n]) return PENDING[n];
      PENDING[n] = new Promise(function (res) {
        var s = document.createElement('script'); s.src = d.src; s.async = true;
        s.onload = function () { LOADED[n] = true; res(true); };
        s.onerror = function () { d.da = false; res(false); };
        document.head.appendChild(s);
      });
      return PENDING[n];
    }));
  };
  W.needAll = function () { return W.need(Object.keys(DATEIEN)); };
  W.needKat = function (kat) { return W.need(Object.keys(DATEIEN).filter(function (n) { return DATEIEN[n].kat.indexOf(kat) >= 0; })); };

  // Rueckverweise: Map id -> [ids], aus verweise + [[id]] + formeln[].id aller geladenen Eintraege
  W.backlinks = function (id) {
    if (!BACK) {
      BACK = {};
      W.all().forEach(function (e) {
        var z = (e.verweise || []).concat(links(e.lang)).concat((e.formeln || []).map(function (f) { return f.id; }).filter(Boolean));
        z.forEach(function (t) { if (t === e.id) return; (BACK[t] = BACK[t] || {})[e.id] = 1; });
      });
    }
    return Object.keys(BACK[id] || {}).map(function (x) { return E[x]; }).filter(Boolean).sort(function (a, b) { return a.titel.localeCompare(b.titel, 'de'); });
  };

  // Zuletzt gesehen (localStorage lm4.wiki.recent, max. 12 IDs)
  var RK = 'lm4.wiki.recent';
  W.recent = function () { try { var v = JSON.parse(localStorage.getItem(RK) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  W.recentPush = function (id) { var r = W.recent().filter(function (x) { return x !== id; }); r.unshift(id); r = r.slice(0, 12); try { localStorage.setItem(RK, JSON.stringify(r)); } catch (e) {} };
  W.recentClear = function () { try { localStorage.removeItem(RK); } catch (e) {} };

  // Suche (W4): Logik in wiki-suche.js (Faltung, Synonyme, Tippfehler, Ranking), Index aus wiki-index.js + geladenen Eintraegen.
  // W.search(q, {lab}) -> Array von Eintraegen (nicht geladene als Stub {id,titel,kat,labs,stub:true}); Array.meint = "Meintest du ...?"-Vorschlag
  var SX = null, SXKEY = '';
  function suchModul() { return root.WikiSuche || (typeof require === 'function' ? (function () { try { return require('./wiki-suche.js'); } catch (e) { return null; } })() : null); }
  function suchIndex() { return root.WikiIndex || (typeof require === 'function' ? (function () { try { return require('./wiki-index.js'); } catch (e) { return []; } })() : []); }
  W.suchbereit = function () { return !!suchModul(); };
  W.needSuche = function () {
    if (suchModul()) return Promise.resolve(true);
    return Promise.all(['wiki-suche.js', 'wiki-index.js'].map(function (src) {
      return new Promise(function (res) { var s = document.createElement('script'); s.src = src; s.async = true; s.onload = function () { res(true); }; s.onerror = function () { res(false); }; document.head.appendChild(s); });
    })).then(function () { return !!suchModul(); });
  };
  function suchEngine() {
    var M = suchModul(), idx = suchIndex(), key = ORDER.length + ':' + idx.length;
    if (!M) return null;
    if (SX && SXKEY === key) return SX;
    var rows = idx.filter(function (r) { return !E[r[0]]; });   // geladene Eintraege (mit Langtext) ersetzen die Indexzeile
    ORDER.forEach(function (id) { var e = E[id], d = ''; for (var n in DATEIEN) if (LOADED[n] && DATEIEN[n].kat.indexOf(e.kat) >= 0) d = n; rows.push(M.indexRow(e, d, true)); });
    SX = M.build(rows); SXKEY = key; return SX;
  }
  W.search = function (q, ctx) {
    var M = suchModul(), X = suchEngine(), out = [];
    if (!M || !X) return out;
    var r = M.search(X, q, ctx || {});
    out = r.hits.map(function (h) { return E[h.id] || { id: h.id, kat: h.kat, titel: h.titel, labs: h.labs, stub: true }; });
    out.meint = r.meint;
    return out;
  };

  /* ---------- Eintragsansicht (HTML) - genutzt von wiki.html und Drawer ---------- */
  var PRUEF = ['nicht prüfungsrelevant', 'kann in der Prüfung vorkommen', 'häufig in Teil 1/2', 'in jeder Prüfung'];
  function labChip(l, rig) {
    var L = LABS[l]; if (!L) return '';
    return '<a class="lc" data-lab="' + l + '" href="' + L[1] + '">' + esc(L[0]) + (rig ? ' · Prüfstand ' + esc(rig) : '') + '</a>';
  }
  W.renderEntry = function (e, opt) {
    opt = opt || {};
    var has = W.has, h = [];
    var kat = KAT[e.kat] ? KAT[e.kat][0] : e.kat;
    h.push('<article class="we" data-id="' + esc(e.id) + '" data-kat="' + esc(e.kat) + '">');
    h.push('<p class="wk-kat"><span>' + esc(kat) + '</span>' + ((e.labs || []).length ? ' · ' + esc(e.labs.map(function (l) { return LABS[l] ? LABS[l][0] : l; }).join(', ')) : '') + '</p>');
    h.push('<h' + (opt.h || 3) + ' class="wt">' + esc(e.titel) + ((e.alias || []).length ? ' <small>(' + esc(e.alias.join(' · ')) + ')</small>' : '') + '</h' + (opt.h || 3) + '>');
    h.push('<div class="wk-top"><p class="kurz">' + esc(e.kurz) + '</p>' + (e.bild ? '<img class="bild" src="' + esc(e.bild) + '" alt="">' : e.svg ? '<div class="bild">' + e.svg + '</div>' : '') + '</div>');
    h.push('<div class="wk-tools"><button type="button" class="btn wk-speak" aria-pressed="false" title="Kurztext vorlesen">🔊 Vorlesen</button>' + (opt.extern ? '<a class="btn" href="wiki.html#e=' + esc(e.id) + '" target="_blank" rel="noopener">Im Wiki öffnen</a>' : '<button type="button" class="btn wk-share" title="Link kopieren">⤴ Link</button>') + '</div>');
    if (e.lang) h.push('<div class="lang">' + render(e.lang, has) + '</div>');
    if (e.formeln && e.formeln.length) {
      h.push('<h4>Formeln</h4><ul class="fo">' + e.formeln.map(function (f) {
        return '<li><code' + (f.sprich ? ' aria-label="' + esc(f.sprich) + '"' : '') + '>' + formel(f.text) + '</code>' + (f.id && has(f.id) ? ' <a class="wl" href="#e=' + f.id + '" data-id="' + f.id + '">→ ' + esc(W.get(f.id).titel) + '</a>' : '') + '</li>';
      }).join('') + '</ul>');
    }
    if (e.werte && e.werte.length) {
      h.push('<h4>Typische Werte</h4><div class="tw"><table><thead><tr><th>Größe</th><th>Wert</th><th>Status</th></tr></thead><tbody>' + e.werte.map(function (w) {
        var st = w[2] === 'ueb' ? '<span class="st ueb">Übungswert</span>' : w[2] === 'belegt' ? '<span class="st ok">✓ belegt</span>' : '<span class="st norm">Normwert</span>';
        return '<tr><td>' + esc(w[0]) + '</td><td>' + esc(w[1]) + '</td><td>' + st + '</td></tr>';
      }).join('') + '</tbody></table></div>' + (opt.pruef && e.quelle ? '<p class="quelle">Quelle: ' + esc(e.quelle) + '</p>' : ''));
    }
    if ((e.labs || []).length) h.push('<h4>Vorkommen</h4><p class="chips">' + e.labs.map(function (l) { return labChip(l, e.rigs && e.labs.length === 1 ? e.rigs.join(', ') : ''); }).join('') + '</p>');
    var sa = (e.verweise || []).map(function (id) { return W.get(id); }).filter(Boolean);
    if (sa.length) h.push('<h4>Siehe auch</h4><p class="links">' + sa.map(function (t) { return '<a class="wl" href="#e=' + t.id + '" data-id="' + t.id + '">' + esc(t.titel) + '</a>'; }).join(' · ') + '</p>');
    var bl = W.backlinks(e.id);
    if (bl.length || W.offen().length) h.push('<h4>Wird erwähnt in</h4><p class="links">' + (bl.map(function (t) { return '<a class="wl" href="#e=' + t.id + '" data-id="' + t.id + '">' + esc(t.titel) + '</a>'; }).join(' · ') || '<span class="mute">noch keine</span>') + (W.offen().length ? ' <button type="button" class="lnk wk-all">weitere nach Laden aller Bereiche</button>' : '') + '</p>');
    if (e.heft) h.push('<p class="heft"><a href="' + esc(e.heft) + '">Mehr im Heft →</a></p>');
    var p = e.pruef == null ? 0 : e.pruef;
    h.push('<p class="meta"><span class="pr" title="Prüfungsrelevanz">' + '●'.repeat(p) + '○'.repeat(3 - p) + ' ' + PRUEF[p] + '</span> · <span class="stt ' + esc(e.status) + '">' + (e.status === 'geprueft' ? '✓ geprüft' : e.status === 'frage' ? 'Frage offen' + (opt.pruef && e.frage ? ' (' + esc(e.frage) + ')' : '') : 'Entwurf – noch nicht fachlich geprüft') + '</span></p>');
    h.push('</article>');
    return h.join('');
  };

  // Vorlesen: Piper-Aufnahme (ueber Speak, wenn W2b die Bruecke liefert) sonst Geraetestimme
  var speaking = null;
  W.speak = function (e, btn) {
    var S = root.Speak;
    if (speaking === e.id) { W.stopSpeak(); return; }
    W.stopSpeak();
    speaking = e.id; if (btn) btn.setAttribute('aria-pressed', 'true');
    if (S && typeof S.speak === 'function' && e.speak) S.speak(e.speak, e.kurz);
    else if (S && typeof S.say === 'function') S.say(e.kurz);
    else if ('speechSynthesis' in root) { try { var u = new SpeechSynthesisUtterance(e.kurz); u.lang = 'de-DE'; u.onend = W.stopSpeak; root.speechSynthesis.speak(u); } catch (x) {} }
    if (btn) btn.title = (S && S.speak && e.speak) ? 'Aufnahme' : 'Gerätestimme';
  };
  W.stopSpeak = function () {
    speaking = null;
    try { if ('speechSynthesis' in root) root.speechSynthesis.cancel(); } catch (x) {}
    try { var S = root.Speak; if (S && S.stop) S.stop(); } catch (x) {}
    Array.prototype.forEach.call(document.querySelectorAll('.wk-speak[aria-pressed=true]'), function (b) { b.setAttribute('aria-pressed', 'false'); });
  };

  /* ---------- Drawer (im Lab) ---------- */
  var drawer = null, lastFocus = null;
  function labName() { var l = (root.LabUI && root.LabUI.LAB) || (root.WikiLabs && root.WikiLabs.lab && root.WikiLabs.lab()) || document.body.dataset.lab || (/(\w+)lab\.html|(\w+)\.html/.exec(location.pathname) || [])[1] || ''; return l; }
  W.lab = labName;
  W.open = function (id, ctx) {
    ctx = ctx || {};
    if (document.body.dataset.wiki === 'seite') { location.hash = '#e=' + id; return; }   // wiki.html: Hash-Navigation
    W.recentPush(id);
    var e = W.get(id);
    var d = W.drawer(ctx);
    var body = d.querySelector('.wkd-body');
    if (e) { body.innerHTML = W.renderEntry(e, { extern: true, h: 2 }); }
    else { body.innerHTML = '<p class="mute">Kein Eintrag „' + esc(id) + '“ – Suche:</p>'; d.querySelector('.wkd-q').value = ctx.q || id; }
    var f = body.querySelector('.wt') || d.querySelector('.wkd-q'); if (f) { f.setAttribute('tabindex', '-1'); f.focus(); }
    return d;
  };
  W.drawer = function (ctx) {
    ctx = ctx || {};
    if (drawer) { if (drawer.hidden) lastFocus = document.activeElement; drawer.hidden = false; drawer.previousSibling.hidden = false; return drawer; }
    lastFocus = document.activeElement;
    var bd = document.createElement('div'); bd.className = 'wkd-bd';
    var d = document.createElement('aside'); d.className = 'wkd'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-label', 'Wiki');
    var lab = ctx.lab || labName(), L = LABS[lab];
    d.innerHTML = '<div class="wkd-hd"><span class="wkd-grip" aria-hidden="true"></span><p class="wkd-aus">Aus: ' + esc(L ? L[0] : 'Lab') + (ctx.rig ? ' · Prüfstand ' + esc(ctx.rig) : '') + '</p><button type="button" class="wkd-x" aria-label="Schließen">×</button>' +
      '<input class="wkd-q" type="search" placeholder="Im Wiki suchen…" aria-label="Im Wiki suchen" autocomplete="off"><div class="wkd-res" role="listbox"></div></div><div class="wkd-body"></div>';
    document.body.appendChild(bd); document.body.appendChild(d); drawer = d;
    var close = W.close;
    bd.addEventListener('click', close);
    d.querySelector('.wkd-x').addEventListener('click', close);
    d.addEventListener('keydown', function (ev) {
      ev.stopPropagation();   // Lab-Tastenkuerzel (keys.js) bekommen nichts aus dem Drawer
      if (ev.key === 'Escape') { ev.preventDefault(); close(); return; }
      if (ev.key === 'Tab') {   // Fokusfalle
        var f = d.querySelectorAll('button,[href],input,[tabindex]:not([tabindex="-1"])'); if (!f.length) return;
        var a = f[0], z = f[f.length - 1];
        if (ev.shiftKey && document.activeElement === a) { ev.preventDefault(); z.focus(); } else if (!ev.shiftKey && document.activeElement === z) { ev.preventDefault(); a.focus(); }
      }
    });
    var q = d.querySelector('.wkd-q'), res = d.querySelector('.wkd-res'), t;
    q.addEventListener('input', function () {
      clearTimeout(t);
      t = setTimeout(function () {
        W.needSuche().then(function () {
        var r = W.search(q.value, { lab: lab });
        res.innerHTML = (r.meint ? '<p class="mute">Meintest du „' + esc(r.meint) + '“?</p>' : '') + r.map(function (e) { return '<button type="button" role="option" class="wkd-hit" data-id="' + e.id + '"><b>' + esc(e.titel) + '</b> <small>' + esc(KAT[e.kat][0]) + '</small></button>'; }).join('') || (q.value.trim() ? '<p class="mute">Kein Treffer</p>' : '');
        });
      }, 120);
    });
    res.addEventListener('click', function (ev) { var b = ev.target.closest('.wkd-hit'); if (b) { var hid = b.dataset.id; res.innerHTML = ''; q.value = ''; W.needAll().then(function () { W.open(hid, ctx); }); } });
    d.addEventListener('click', function (ev) {
      var a = ev.target.closest('a.wl[data-id]'); if (a) { ev.preventDefault(); W.open(a.dataset.id, ctx); return; }
      var s = ev.target.closest('.wk-speak'); if (s) { var art = s.closest('.we'); W.speak(W.get(art.dataset.id), s); return; }
      var al = ev.target.closest('.wk-all'); if (al) { W.needAll().then(function () { var art = al.closest('.we'); W.open(art.dataset.id, ctx); }); }
    });
    return d;
  };
  W.close = function () {
    if (!drawer) return;
    W.stopSpeak();
    drawer.hidden = true; drawer.previousSibling.hidden = true;
    try { if (lastFocus && lastFocus.focus) lastFocus.focus(); } catch (x) {}
  };

  // Zentrale Delegation: Klick auf .wk / [data-wiki] oeffnet den Eintrag (Abschnitt 6.2). Auto-Zuordnung ("?"-Knoepfe) folgt in W5/W8.
  W.marks = function () { try { return localStorage.getItem('lm4.wiki.hints') !== '0' && localStorage.getItem('lm4.wiki.marks') !== '0'; } catch (e) { return true; } };
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('button.wk'); if (!b || document.body.dataset.wiki === 'seite') return;
    ev.preventDefault(); ev.stopPropagation();
    var id = b.dataset.wiki || b.dataset.id, ctx = { lab: b.dataset.lab || labName(), rig: b.dataset.rig, key: b.dataset.key };
    W.needAll().then(function () { W.open(id, ctx); });
  });
  document.addEventListener('pointerdown', function (ev) { if (ev.target.closest && ev.target.closest('button.wk')) ev.stopPropagation(); }, true);
})(typeof window !== 'undefined' ? window : this);
