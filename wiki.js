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
  // W7: Regler + Messwerte je Rig-Lab (erzeugt von quelle/gen/mkwikireg.js); "lazy" = nur bei Bedarf (needFor, needAll(true)), nicht bei needAll()
  var REGLER_LABS = ['ana', 'ant', 'els', 'emv', 'enr', 'nts', 'reg', 'sen', 'thm', 'wsl'];
  REGLER_LABS.forEach(function (l) { DATEIEN['regler-' + l] = { src: 'wiki-regler-' + l + '.js', kat: ['regler', 'messwert'], lab: l, da: true, lazy: true }; });
  // Datei-Name zu einer Eintrags-ID (ohne Index): rg-/mw-<lab>-... -> regler-<lab>, bt- -> bauteile, ger-/bd- -> geraete
  function dateiFuer(id) {
    var m = /^(rg|mw)-([a-z]+)-/.exec(id || ''); if (m && DATEIEN['regler-' + m[2]]) return 'regler-' + m[2];
    if (/^bt-/.test(id)) return 'bauteile'; if (/^(ger|bd)-/.test(id)) return 'geraete'; if (/^bg-/.test(id)) return 'begriffe'; if (/^(fo|nw|lab)-/.test(id)) return 'formeln';
    return '';
  }
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
      ['verweise', 'labs', 'rigs', 'rignamen', 'stich', 'alias', 'alt'].forEach(function (f) { if (e[f] != null && !Array.isArray(e[f])) E(id, f + ' kein Array'); });
      if (e.rignamen && e.rigs && e.rignamen.length !== e.rigs.length) E(id, 'rignamen und rigs verschieden lang');
      if (e.kopf != null && (typeof e.kopf !== 'string' || e.kopf.length < 10 || e.kopf.length > 320)) E(id, 'kopf: Text 10-320 Zeichen oder weglassen');
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
    // Regler/Messwerte gelten je Lab (gleiche Beschriftung in zwei Labs = zwei Eintraege, Toni-Entscheidung 1)
    entries.forEach(function (e) { if (!e || !e.titel) return; var k = e.kat + ':' + (/^(regler|messwert)$/.test(e.kat) ? (e.labs || []).join(',') + ':' : '') + fold(e.titel); if (seen[k]) W(e.id, 'Titel-Dublette mit ' + seen[k]); else seen[k] = e.id; });
    return { err: err, warn: warn, n: entries.length };
  }

  var api = { KAT: KAT, KAT_PREFIX: KAT_PREFIX, LABS: LABS, DATEIEN: DATEIEN, REGLER_LABS: REGLER_LABS, dateiFuer: dateiFuer, STATUS: STATUS, fold: fold, render: render, formel: formel, links: links, validate: validate, esc: esc };
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
      if (e.key && e.labs) {   // W7: je Kategorie und Pruefstand (gleicher key kann Regler und Messfeld sein, oder je Pruefstand anders beschriftet)
        var kk = e.kat + ':' + e.labs[0] + ':';
        if (!KEYS[kk + e.key]) KEYS[kk + e.key] = e.id;
        (e.rigs || []).forEach(function (r) { KEYS[kk + r + ':' + e.key] = e.id; });
      }
    });
    BACK = null;
    W.onchange && W.onchange(name);
  };
  W.get = function (id) { return E[id] || (ALT[id] ? E[ALT[id]] : null); };
  W.has = function (id) { return !!W.get(id); };
  W.bySpeak = function (k) { return E[SPEAK[k]] || null; };
  // byKey(lab, key, rig, kat): Pruefstand zuerst (eindeutig), dann Lab; kat 'regler' (Standard) oder 'messwert'
  W.byKey = function (lab, key, rig, kat) {
    var ks = kat ? [kat] : ['regler', 'messwert'];
    for (var i = 0; i < ks.length; i++) {
      var p = ks[i] + ':' + lab + ':';
      var id = (rig && KEYS[p + rig + ':' + key]) || KEYS[p + key];
      if (id && E[id]) return E[id];
    }
    return E['rg-' + lab + '-' + key] || (rig && E['rg-' + lab + '-' + rig + '-' + key]) || E['mw-' + lab + '-' + key] || null;
  };
  W.all = function () { return ORDER.map(function (id) { return E[id]; }); };
  W.byKat = function (kat) { return W.all().filter(function (e) { return e.kat === kat; }).sort(function (a, b) { return a.titel.localeCompare(b.titel, 'de'); }); };
  W.count = function (kat) { return W.byKat(kat).length; };
  W.loaded = function (name) { return !!LOADED[name]; };
  W.offen = function () { return Object.keys(DATEIEN).filter(function (n) { return DATEIEN[n].da && !DATEIEN[n].lazy && !LOADED[n]; }); };

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
  // needAll(): alle Grunddateien (ohne die lazy Regler-Dateien, ca. 1 MB); needAll(true): wirklich alles (Pruefansicht)
  W.needAll = function (alles) { return W.need(Object.keys(DATEIEN).filter(function (n) { return alles === true || !DATEIEN[n].lazy; })); };
  // needFor(id): genau die Datei, in der der Eintrag steht (aus dem ID-Praefix), sonst alle Grunddateien
  W.needFor = function (id) {
    if (W.get(id)) return Promise.resolve([true]);
    var d = dateiFuer(id);
    return d && DATEIEN[d] ? W.need(/^regler-/.test(d) ? [d, 'bauteile', 'geraete'] : [d]).then(function (r) { return W.get(id) ? r : W.needAll(); }) : W.needAll();
  };
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
  W.recentPush = function (id) { var r = W.recent().filter(function (x) { return x !== id; }); r.unshift(id); r = r.slice(0, 12); try { localStorage.setItem(RK, JSON.stringify(r)); } catch (e) {} W.seenPush(id); };
  // W12b: verschiedene geoeffnete Eintraege (rein lokal, lm4.wiki.seen, unabhaengig vom Loeschen der Zuletzt-Liste) -> Abzeichen "Nachschlager" (badges.js, ab 10)
  var SK = 'lm4.wiki.seen', SEEN_MAX = 300;
  W.NACHSCHLAGER = 10;
  W.seen = function () { try { var v = JSON.parse(localStorage.getItem(SK) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  W.seenPush = function (id) {
    if (!id) return;
    var s = W.seen(); if (s.indexOf(id) < 0) { s.push(id); if (s.length > SEEN_MAX) s = s.slice(-SEEN_MAX); try { localStorage.setItem(SK, JSON.stringify(s)); } catch (e) {} }
    W.nachschlager();
  };
  // Abzeichen vergeben: mit badges.js (Labs) ueber Badges.check (Popup, Konfetti), auf wiki.html ohne badges.js direkt in lm4.badges (gleiches Format) mit kleiner Meldung
  W.nachschlager = function () {
    if (W.seen().length < W.NACHSCHLAGER) return false;
    try {
      var B = root.Badges;
      if (B && B.check) { B.check(); return true; }
      var e = JSON.parse(localStorage.getItem('lm4.badges') || '{}'); if (!e || typeof e !== 'object' || Array.isArray(e)) e = {};
      if (e.nachschlager) return false;
      e.nachschlager = Date.now(); localStorage.setItem('lm4.badges', JSON.stringify(e));
      var t = document.createElement('div'); t.className = 'wk-toast'; t.setAttribute('role', 'status'); t.textContent = 'Neues Abzeichen: Nachschlager – zehn Wiki-Einträge aufgeschlagen';
      document.body.appendChild(t); setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 4500);
      return true;
    } catch (x) { return false; }
  };
  W.recentClear = function () { try { localStorage.removeItem(RK); } catch (e) {} };

  // Suche (W4): Logik in wiki-suche.js (Faltung, Synonyme, Tippfehler, Ranking), Index aus wiki-index.js + geladenen Eintraegen.
  // W.search(q, {lab}) -> Array von Eintraegen (nicht geladene als Stub {id,titel,kat,labs,stub:true}); Array.meint = "Meintest du ...?"-Vorschlag
  var SX = null, SXKEY = '';
  function suchModul() { return root.WikiSuche || (typeof require === 'function' ? (function () { try { return require('./wiki-suche.js'); } catch (e) { return null; } })() : null); }
  function suchIndex() {
    var a = root.WikiIndex || (typeof require === 'function' ? (function () { try { return require('./wiki-index.js'); } catch (e) { return []; } })() : []);
    var b = root.WikiIndexRegler || [];   // W7: Regler/Messwerte (wiki-index-regler.js)
    return b.length ? a.concat(b) : a;
  }
  W.index = suchIndex;
  // Typ-Text fuer Treffer: Regler/Messwerte mit Lab (gleiche Beschriftung gibt es in mehreren Labs)
  W.katText = function (e) { var t = KAT[e.kat] ? KAT[e.kat][0] : e.kat; return /^(regler|messwert)$/.test(e.kat) && e.labs && e.labs[0] && LABS[e.labs[0]] ? t + ' · ' + LABS[e.labs[0]][0] : t; };
  // Treffer-Hervorhebung (P3): Suchwoerter im (HTML-)Titel per <mark> (nur Unterstreichung, CSS). Vergleich gefaltet wie die Suche (Umlaute, ss, Ohm ...),
  // nur Textknoten (Indizes <sub> bleiben heil), "meint" = Korrekturvorschlag der Suche (Tippfehler) zaehlt mit.
  function fch(c) { return String(c).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/ω/g, 'ohm').replace(/µ|μ/g, 'u').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ' '); }
  W.hl = function (html, q, meint) {
    if (typeof document === 'undefined' || !q) return html;
    try {
      var toks = [], seen = {};
      [q, meint].forEach(function (s) { fold(s || '').replace(/[.,]/g, '').split(' ').forEach(function (t) { if (t && !seen[t]) { seen[t] = 1; toks.push(t); } }); });
      toks = toks.filter(function (t) { return t.length >= 2 || toks.length === 1; });
      if (!toks.length) return html;
      var box = document.createElement('div'); box.innerHTML = html;
      var nodes = [], walk = function (n) { for (var c = n.firstChild; c; c = c.nextSibling) { if (c.nodeType === 3) nodes.push(c); else if (c.nodeType === 1) walk(c); } }; walk(box);
      var any = false;
      nodes.forEach(function (nd) {
        var txt = nd.nodeValue, f = '', map = [], i, j, s;
        for (i = 0; i < txt.length; i++) { s = fch(txt.charAt(i)); for (j = 0; j < s.length; j++) { f += s.charAt(j); map.push(i); } }
        var rg = [];
        toks.forEach(function (t) { var p = 0, k; while ((k = f.indexOf(t, p)) >= 0) { rg.push([map[k], map[k + t.length - 1] + 1]); p = k + t.length; } });
        if (!rg.length) return;
        rg.sort(function (a, b) { return a[0] - b[0] || b[1] - a[1]; });
        var m = [rg[0].slice()]; rg.slice(1).forEach(function (r) { var l = m[m.length - 1]; if (r[0] <= l[1]) l[1] = Math.max(l[1], r[1]); else m.push(r.slice()); });
        var fr = document.createDocumentFragment(), pos = 0;
        m.forEach(function (r) { if (r[0] > pos) fr.appendChild(document.createTextNode(txt.slice(pos, r[0]))); var mk = document.createElement('mark'); mk.textContent = txt.slice(r[0], r[1]); fr.appendChild(mk); pos = r[1]; });
        if (pos < txt.length) fr.appendChild(document.createTextNode(txt.slice(pos)));
        nd.parentNode.replaceChild(fr, nd); any = true;
      });
      return any ? box.innerHTML : html;
    } catch (x) { return html; }
  };
  W.suchbereit = function () { return !!suchModul(); };
  W.needSuche = function () {
    if (suchModul() && root.WikiIndexRegler) return Promise.resolve(true);
    return Promise.all(['wiki-suche.js', 'wiki-index.js', 'wiki-index-regler.js'].filter(function (src) { return !(src === 'wiki-suche.js' && suchModul()) && !(src === 'wiki-index.js' && root.WikiIndex) && !(src === 'wiki-index-regler.js' && root.WikiIndexRegler); }).map(function (src) {
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
  // Aehnliche Eintraege (W9, Design-Review P2-3): nur aus dem Index und den geladenen Eintraegen. Gleicher Schluessel in anderen Labs (Regler und Messwerte),
  // dazu Nachbarn derselben Kategorie im selben Lab und Pruefstand. Hoechstens max (6).
  function slug(t) { return String(t).replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
  W.aehnlich = function (e, max) {
    if (!/^(regler|messwert)$/.test(e.kat) || !e.key || !e.labs || !e.labs[0]) return [];
    var out = [], seen = {}, suf = '-' + slug(e.key), lab = e.labs[0], n = max || 6;
    var toks = function (t) { return fold(t).split(' ').filter(function (w) { return w.length >= 4; }); }, et = toks(e.titel);   // gleicher Schluessel allein reicht nicht (R_V kann in einem anderen Lab etwas anderes sein): mindestens ein gemeinsames Titelwort
    seen[e.id] = 1;
    (W.index ? W.index() : []).forEach(function (r) {
      if (seen[r[0]] || !/^(rg|mw)-/.test(r[0]) || r[0].slice(-suf.length) !== suf) return;
      var rl = r[4] ? r[4].split(',') : [];
      if (rl[0] === lab) return;   // im selben Lab zaehlen die Nachbarn unten
      if (!toks(r[2]).some(function (w) { return et.indexOf(w) >= 0; })) return;
      seen[r[0]] = 1; out.push({ id: r[0], kat: r[1], titel: r[2], labs: rl });
    });
    out.sort(function (a, b) { return (a.kat === e.kat ? 0 : 1) - (b.kat === e.kat ? 0 : 1); });
    var nb = W.all().filter(function (x) { return !seen[x.id] && x.kat === e.kat && x.labs && x.labs[0] === lab && (x.rigs || []).some(function (r) { return (e.rigs || []).indexOf(r) >= 0; }); })
      .sort(function (a, b) { return a.titel.localeCompare(b.titel, 'de'); });
    var pos = 0; nb.forEach(function (x, k) { if (x.titel.localeCompare(e.titel, 'de') < 0) pos = k + 1; });
    nb = nb.slice(Math.max(0, pos - 2)).concat(nb.slice(0, Math.max(0, pos - 2)));   // erst die Nachbarn um den eigenen Titel
    nb.forEach(function (x) { seen[x.id] = 1; out.push(x); });
    return out.slice(0, n);
  };
  function chipLinks(arr, mitKat) {
    return '<div class="lk">' + arr.map(function (t) {
      var sm = [];
      if (mitKat || /^(regler|messwert)$/.test(t.kat)) sm.push(KAT[t.kat] ? KAT[t.kat][0] : t.kat);
      if (/^(regler|messwert)$/.test(t.kat) && t.labs && t.labs[0]) sm.push(LABS[t.labs[0]] ? LABS[t.labs[0]][0] : t.labs[0]);
      return '<a class="wl" href="#e=' + esc(t.id) + '" data-id="' + esc(t.id) + '">' + formel(t.titel) + (sm.length ? '<small>' + esc(sm.join(' · ')) + '</small>' : '') + '</a>';
    }).join('') + '</div>';
  }
  W.aehnlichHtml = function (e) {
    var a = W.aehnlich(e, 6);
    return a.length ? '<h4>Ähnliche Einträge</h4>' + chipLinks(a, false) : '';
  };
  var ICO_SPK = '<svg class="ico" aria-hidden="true" viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>';
  var ICO_LAB = '<svg class="ico" aria-hidden="true" viewBox="0 0 24 24"><path d="M9 3h6M10 3v6l-5.5 9A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-3L14 9V3"/><path d="M8 15h8"/></svg>';
  var ICO_CHEV = '<svg class="ico chev" aria-hidden="true" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>';
  W.ICO = { spk: ICO_SPK, lab: ICO_LAB, chev: ICO_CHEV };
  // Steckbrief (P3): Regler/Messwerte als Beschreibungsliste statt Tabelle und statt des Absatzes "Bedienelement:" bzw. "Messfeld:" (erster lang-Absatz);
  // Felder: Bedienelement, Einheit, Werte aus werte[] (mit Pille), Gruppe. Kein passender Absatz -> null (Renderer bleibt bei Tabelle und Langtext).
  function steckAus(e) {
    var lang = String(e.lang || '').replace(/\r/g, ''), i = lang.search(/\n\s*\n/), first = (i < 0 ? lang : lang.slice(0, i)).trim(), rest = i < 0 ? '' : lang.slice(i).replace(/^\s+/, '');
    var m = /^\*\*(Bedienelement|Messfeld):\*\*\s*([\s\S]+)$/.exec(first); if (!m) return null;
    var body = m[2].trim(), k = body.indexOf('. '), spec = (k < 0 ? body : body.slice(0, k)).replace(/\.$/, ''), note = k < 0 ? '' : body.slice(k + 2).trim(), rows = [], gr = '';
    if (m[1] === 'Messfeld') rows.push(['Messfeld', spec]);
    else {
      var be = [], ein = '';
      spec.split(', ').forEach(function (p) { var x; if ((x = /^Einheit (.+)$/.exec(p))) ein = x[1]; else if ((x = /^Gruppe [„"](.+)[“"]$/.exec(p))) gr = x[1]; else be.push(p); });
      rows.push(['Bedienelement', be.join(', ')]); if (ein) rows.push(['Einheit', ein]);
    }
    return { rows: rows, gruppe: gr, note: note, rest: rest };
  }
  function pille(s) { return s === 'ueb' ? '<span class="st ueb">Übungswert</span>' : s === 'belegt' ? '<span class="st ok">✓ belegt</span>' : '<span class="st norm">Normwert</span>'; }
  W.renderEntry = function (e, opt) {
    opt = opt || {};
    var has = W.has, h = [], KL = /^(regler|messwert)$/.test(e.kat), L0 = (e.labs || [])[0], SB = KL ? steckAus(e) : null;
    var kat = KAT[e.kat] ? KAT[e.kat][0] : e.kat;
    h.push('<article class="we" data-id="' + esc(e.id) + '" data-kat="' + esc(e.kat) + '"' + (L0 ? ' data-lab="' + esc(L0) + '"' : '') + '>');
    // Kategoriezeile: Kategorie fett, Lab(s), bei Reglern/Messwerten der Pruefstand
    var lz = (e.labs || []).map(function (l) { return LABS[l] ? LABS[l][0] : l; }), rn = e.rignamen || [];
    h.push('<p class="wk-kat"><b>' + esc(kat) + '</b>' + (lz.length ? ' · ' + (lz.length > 2 ? 'in ' + lz.length + ' Labs' : esc(lz.join(', '))) : '') +
      (KL && rn.length ? ' · ' + (rn.length === 1 ? 'Prüfstand „' + esc(rn[0]) + '“' : rn.length === 2 ? 'Prüfstände „' + esc(rn[0]) + '“, „' + esc(rn[1]) + '“' : rn.length + ' Prüfstände') : '') + '</p>');
    h.push('<h' + (opt.h || 3) + ' class="wt">' + formel(e.titel) + ((e.alias || []).length ? ' <small>(' + esc(e.alias.join(' · ')) + ')</small>' : '') + '</h' + (opt.h || 3) + '>');
    h.push('<div class="wk-top"><p class="kurz">' + formel(e.kurz) + '</p>' + (e.bild ? '<img class="bild" src="' + esc(e.bild) + '" alt="">' : e.svg ? '<div class="bild">' + e.svg + '</div>' : '') + '</div>');
    if (!opt.extern) h.push('<div class="wk-tools"><button type="button" class="btn wk-speak" aria-pressed="false" title="Kurztext vorlesen">' + ICO_SPK + 'Vorlesen</button><button type="button" class="btn wk-share" title="Link kopieren">Link kopieren</button></div>');
    if (e.lang && (!SB || SB.rest)) h.push('<div class="lang">' + render(SB ? SB.rest : e.lang, has) + '</div>');
    if (e.formeln && e.formeln.length) {
      h.push('<h4>Formeln</h4><ul class="fo">' + e.formeln.map(function (f) {
        return '<li><code' + (f.sprich ? ' aria-label="' + esc(f.sprich) + '"' : '') + '>' + formel(f.text) + '</code>' + (f.sprich ? '<small>' + esc(f.sprich) + '</small>' : '') + (f.id && has(f.id) ? ' <a class="wl" href="#e=' + f.id + '" data-id="' + f.id + '">→ ' + formel(W.get(f.id).titel) + '</a>' : '') + '</li>';
      }).join('') + '</ul>');
    }
    if (SB) {
      h.push('<h4>Steckbrief</h4><div class="tw"><dl class="steck">' + SB.rows.map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + formel(r[1]) + '</dd>'; }).join('') +
        (e.werte || []).map(function (w) { return '<dt>' + esc(w[0]) + '</dt><dd>' + esc(w[1]) + pille(w[2]) + '</dd>'; }).join('') +
        (SB.gruppe ? '<dt>Gruppe</dt><dd>' + esc(SB.gruppe) + '</dd>' : '') + '</dl></div>' +
        (SB.note ? '<p class="quelle">' + formel(SB.note) + '</p>' : '') + (opt.pruef && e.quelle ? '<p class="quelle">Quelle: ' + esc(e.quelle) + '</p>' : ''));
    } else if (e.werte && e.werte.length) {
      h.push('<h4>' + (KL ? 'Werte im Prüfstand' : 'Typische Werte') + '</h4><div class="tw"><table><thead><tr><th>Größe</th><th>Wert</th><th>Status</th></tr></thead><tbody>' + e.werte.map(function (w) {
        var st = w[2] === 'ueb' ? '<span class="st ueb">Übungswert</span>' : w[2] === 'belegt' ? '<span class="st ok">✓ belegt</span>' : '<span class="st norm">Normwert</span>';
        return '<tr><td>' + esc(w[0]) + '</td><td>' + esc(w[1]) + '</td><td>' + st + '</td></tr>';
      }).join('') + '</tbody></table></div>' + (opt.pruef && e.quelle ? '<p class="quelle">Quelle: ' + esc(e.quelle) + '</p>' : ''));
    }
    // Wo im Lab? (Regler/Messwerte): eine Karte je Pruefstand, Sprung per #rig=<Pruefstand> (wiki-labs.js waehlt ihn). Im Drawer (man ist ja im Lab) entfaellt die Karte.
    if (KL && L0 && LABS[L0] && (e.rigs || []).length) {
      if (!opt.extern) h.push('<h4>Wo im Lab?</h4><div class="wo">' + e.rigs.map(function (r, i) {
        return '<a href="' + LABS[L0][1] + '#rig=' + esc(r) + '" data-lab="' + esc(L0) + '">' + ICO_LAB + '<span><b>Prüfstand „' + esc(rn[i] || r) + '“</b><small>Im ' + esc(LABS[L0][0]) + ' öffnen</small></span>' + ICO_CHEV + '</a>';
      }).join('') + '</div>');
    } else if ((e.labs || []).length) h.push('<h4>Vorkommen</h4><p class="chips">' + e.labs.map(function (l) { return labChip(l, ''); }).join('') + '</p>');
    h.push('<div class="wk-sim">' + W.aehnlichHtml(e) + '</div>');
    var sa = (e.verweise || []).map(function (id) { return W.get(id); }).filter(Boolean);
    if (sa.length) h.push('<h4>Siehe auch</h4>' + chipLinks(sa, true));
    var bl = W.backlinks(e.id), mehr = 0;
    // Regler/Messwerte verweisen auf Bauteile -> Rueckverweise zuerst die uebrigen Kategorien, hoechstens 8 (Rest als Zahl)
    bl.sort(function (a, b) { var ra = /^(regler|messwert)$/.test(a.kat) ? 1 : 0, rb = /^(regler|messwert)$/.test(b.kat) ? 1 : 0; return ra - rb; });
    if (bl.length > 8) { mehr = bl.length - 8; bl = bl.slice(0, 8); }
    if (bl.length) h.push('<h4>Wird erwähnt in</h4>' + chipLinks(bl, true).replace(/<\/div>$/, mehr ? '<span class="mute more-n">+ ' + mehr + ' weitere</span></div>' : '</div>') + (!opt.extern && W.offen().length ? '<p><button type="button" class="lnk wk-all">weitere nach Laden aller Bereiche</button></p>' : ''));
    if (e.heft) h.push('<p class="heft"><a href="' + esc(e.heft) + '">Mehr im Heft →</a></p>');
    // Meta: Pruefungsrelevanz nur wenn gesetzt; Status kurz ("Entwurf" - der Hinweis zur fachlichen Pruefung steht in der Fusszeile der Seite)
    var meta = [];
    if (e.pruef != null) meta.push('<span class="pr" title="Prüfungsrelevanz">' + '●'.repeat(e.pruef) + '○'.repeat(3 - e.pruef) + ' ' + PRUEF[e.pruef] + '</span>');
    meta.push('<span class="stt ' + esc(e.status) + '">' + (e.status === 'geprueft' ? '✓ geprüft' : e.status === 'frage' ? 'Frage offen' + (opt.pruef && e.frage ? ' (' + esc(e.frage) + ')' : '') : 'Entwurf') + '</span>');
    h.push('<p class="meta">' + meta.join(' · ') + '</p>');
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
    var txt = /^(regler|messwert)$/.test(e.kat) && e.kopf ? e.kopf + ' ' + e.kurz : e.kurz;   // Regler/Messwerte: Kopfsatz (Titel, Typ, Lab, Pruefstand) mitsprechen, damit die Stimme den Kontext behaelt
    if (S && typeof S.speak === 'function' && e.speak) S.speak(e.speak, e.kurz);
    else if (S && typeof S.say === 'function') S.say(txt);
    else if ('speechSynthesis' in root) { try { var u = new SpeechSynthesisUtterance(txt); u.lang = 'de-DE'; u.onend = W.stopSpeak; root.speechSynthesis.speak(u); } catch (x) {} }
    if (btn) btn.title = (S && S.speak && e.speak) ? 'Aufnahme' : 'Gerätestimme';
  };
  W.stopSpeak = function () {
    speaking = null;
    try { if ('speechSynthesis' in root) root.speechSynthesis.cancel(); } catch (x) {}
    try { var S = root.Speak; if (S && S.stop) S.stop(); } catch (x) {}
    Array.prototype.forEach.call(document.querySelectorAll('.wk-speak[aria-pressed=true]'), function (b) { b.setAttribute('aria-pressed', 'false'); });
  };

  /* ---------- Drawer (im Lab) ----------
   * W9 (Design-Review P2-7): Handy = Bottom-Sheet mit zwei Hoehen (62 % / 92 %, Tippen auf den Griff oder Doppeltipp auf den Kopf), Desktop rechts 440 px.
   * Kopf = Eintragstitel + Zeile Kategorie/Lab/Pruefstand, Lupe klappt die Suche auf (Treffer als Overlay), Fussleiste fest: Vorlesen, Im Wiki oeffnen.
   * Seite dahinter bleibt stehen (html.wkd-open: overflow hidden), Inhalt scrollt mit overscroll-behavior:contain. */
  var drawer = null, lastFocus = null;
  var ICO_LUPE = '<svg class="ico" aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/></svg>';
  var ICO_X = '<svg class="ico" aria-hidden="true" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  function labName() { var l = (root.LabUI && root.LabUI.LAB) || (root.WikiLabs && root.WikiLabs.lab && root.WikiLabs.lab()) || document.body.dataset.lab || (/(\w+)lab\.html|(\w+)\.html/.exec(location.pathname) || [])[1] || ''; return l; }
  W.lab = labName;
  function drawerSub(e) {
    var rn = e.rignamen || [];
    return W.katText(e) + (/^(regler|messwert)$/.test(e.kat) && rn.length ? ' · ' + (rn.length === 1 ? 'Prüfstand „' + rn[0] + '“' : rn.length + ' Prüfstände') : '');
  }
  W.open = function (id, ctx) {
    ctx = ctx || {};
    if (document.body.dataset.wiki === 'seite') { location.hash = '#e=' + id; return; }   // wiki.html: Hash-Navigation
    W.recentPush(id);
    var e = W.get(id);
    var d = W.drawer(ctx);
    var body = d.querySelector('.wkd-body'), t = d.querySelector('#wkdT'), sb = d.querySelector('#wkdS'), ext = d.querySelector('.wkd-ext');
    W.stopSpeak(); d.dataset.id = e ? e.id : '';
    if (e) {
      body.innerHTML = W.renderEntry(e, { extern: true, h: 2 });
      t.innerHTML = formel(e.titel); sb.textContent = drawerSub(e); ext.href = 'wiki.html#e=' + e.id; ext.hidden = false;
      // Aehnliche Eintraege brauchen den Suchindex (im Lab nicht geladen): nachladen und dazuhaengen, falls der Eintrag noch offen ist
      if (/^(regler|messwert)$/.test(e.kat) && !(root.WikiIndexRegler && W.suchbereit())) W.needSuche().then(function () { var sim = body.querySelector('.we[data-id="' + e.id + '"] .wk-sim'); if (sim && !sim.innerHTML) sim.innerHTML = W.aehnlichHtml(e); });
    } else {
      body.innerHTML = '<p class="mute">Kein Eintrag „' + esc(id) + '“ – Suche:</p>'; t.textContent = 'Nicht gefunden'; sb.textContent = 'Im Wiki suchen'; ext.hidden = true;
      d.querySelector('.wkd-qw').hidden = false; d.querySelector('.wkd-q').value = ctx.q || id;
    }
    body.scrollTop = 0;
    var f = e ? t : d.querySelector('.wkd-q'); if (f) { f.setAttribute('tabindex', '-1'); f.focus({ preventScroll: true }); }
    return d;
  };
  W.drawer = function (ctx) {
    ctx = ctx || {};
    if (drawer) { if (drawer.hidden) lastFocus = document.activeElement; drawer.hidden = false; drawer.previousSibling.hidden = false; document.documentElement.classList.add('wkd-open'); return drawer; }
    lastFocus = document.activeElement;
    var bd = document.createElement('div'); bd.className = 'wkd-bd';
    var d = document.createElement('aside'); d.className = 'wkd'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-labelledby', 'wkdT');
    var lab = ctx.lab || labName();
    d.innerHTML = '<div class="wkd-hd"><button type="button" class="wkd-grip" aria-label="Höhe wechseln" aria-expanded="false"></button>' +
      '<div class="ti"><b id="wkdT"></b><small id="wkdS" class="wkd-aus"></small></div>' +
      '<button type="button" class="ib wkd-s" aria-label="Im Wiki suchen" aria-expanded="false">' + ICO_LUPE + '</button><button type="button" class="ib wkd-x" aria-label="Schließen">' + ICO_X + '</button></div>' +
      '<div class="wkd-qw" hidden><input class="wkd-q" type="search" placeholder="Im Wiki suchen…" aria-label="Im Wiki suchen" autocomplete="off"><div class="wkd-res" role="listbox" aria-label="Treffer"></div></div>' +
      '<div class="wkd-body"></div>' +
      '<div class="wkd-ft"><button type="button" class="btn wk-speak" aria-pressed="false" title="Kurztext vorlesen">' + ICO_SPK + 'Vorlesen</button><a class="btn wkd-ext" target="_blank" rel="noopener">Im Wiki öffnen</a></div>';
    document.body.appendChild(bd); document.body.appendChild(d); drawer = d;
    document.documentElement.classList.add('wkd-open');
    var close = W.close;
    var q = d.querySelector('.wkd-q'), res = d.querySelector('.wkd-res'), qw = d.querySelector('.wkd-qw'), sBtn = d.querySelector('.wkd-s'), grip = d.querySelector('.wkd-grip'), t;
    function voll(on) { d.classList.toggle('voll', on); grip.setAttribute('aria-expanded', d.classList.contains('voll') ? 'true' : 'false'); }
    function suche(on) { qw.hidden = !on; sBtn.setAttribute('aria-expanded', on ? 'true' : 'false'); if (on) q.focus(); else { res.innerHTML = ''; q.value = ''; } }
    bd.addEventListener('click', close);
    d.querySelector('.wkd-x').addEventListener('click', close);
    var hd = d.querySelector('.wkd-hd'), drag = false, moved = false, sy = 0, sh = 0, ly = 0, lt = 0, vel = 0, just = false;
    // Ziehen (P3, Handy): Zeiger auf Griff/Kopf; beim Loslassen rastet das Sheet bei 92 % / 62 % ein oder schliesst (Richtung und Tempo zaehlen mit).
    // Bewegung und Loslassen werden am document abgehoert (Maus verliert sonst den Kopf, sobald der Zeiger ihn verlaesst); ohne Zeigerfang bleibt das Tippen auf den Griff ein normaler Klick.
    function sheet() { return getComputedStyle(grip).display !== 'none'; }
    function dragMove(ev) {
      if (!drag) return; var dy = ev.clientY - sy;
      if (!moved) { if (Math.abs(dy) < 6) return; moved = true; d.classList.add('zieht'); }
      var vh = window.innerHeight; d.style.height = Math.max(0.15 * vh, Math.min(0.94 * vh, sh - dy)) + 'px';
      var dt = ev.timeStamp - lt; if (dt > 0) vel = (ev.clientY - ly) / dt; ly = ev.clientY; lt = ev.timeStamp;
    }
    function dragEnd(ev) {
      document.removeEventListener('pointermove', dragMove); document.removeEventListener('pointerup', dragEnd); document.removeEventListener('pointercancel', dragEnd);
      if (!drag) return; drag = false; if (!moved) return;
      just = true; setTimeout(function () { just = false; }, 80);   // der Klick nach dem Ziehen (Loslassen auf dem Griff) darf nicht noch einmal umschalten
      if (ev.timeStamp - lt > 120) vel = 0;   // Finger ruhte vor dem Loslassen: kein Schwung
      var vh = window.innerHeight, tgt = d.offsetHeight - vel * 150;   // nach unten (vel > 0) zieht die Zielhoehe herunter
      d.classList.remove('zieht'); d.style.height = '';
      if (ev.type === 'pointercancel') return;
      if (tgt < 0.4 * vh) { voll(false); close(); } else voll(tgt > 0.77 * vh);
    }
    hd.addEventListener('pointerdown', function (ev) {
      if (!sheet() || ev.button || ev.target.closest('button:not(.wkd-grip)')) return;
      drag = true; moved = false; sy = ly = ev.clientY; lt = ev.timeStamp; vel = 0; sh = d.offsetHeight;
      document.addEventListener('pointermove', dragMove); document.addEventListener('pointerup', dragEnd); document.addEventListener('pointercancel', dragEnd);
    });
    grip.addEventListener('click', function () { if (just) return; voll(!d.classList.contains('voll')); });
    d.querySelector('.wkd-hd').addEventListener('dblclick', function (ev) { if (!ev.target.closest('button') && getComputedStyle(grip).display !== 'none') voll(!d.classList.contains('voll')); });
    sBtn.addEventListener('click', function () { suche(qw.hidden); });
    d.addEventListener('keydown', function (ev) {
      ev.stopPropagation();   // Lab-Tastenkuerzel (keys.js) bekommen nichts aus dem Drawer
      if (ev.key === 'Escape') {   // erst Suche/Treffer zu, dann der Drawer
        ev.preventDefault();
        if (!qw.hidden && (res.innerHTML || q.value)) { res.innerHTML = ''; q.value = ''; q.focus(); return; }
        if (!qw.hidden) { suche(false); sBtn.focus(); return; }
        close(); return;
      }
      if (ev.key === 'Tab') {   // Fokusfalle (nur sichtbare Elemente)
        var f = [].filter.call(d.querySelectorAll('button,[href],input,[tabindex]:not([tabindex="-1"])'), function (x) { return !x.disabled && x.getClientRects().length > 0; }); if (!f.length) return;
        var a = f[0], z = f[f.length - 1];
        if (ev.shiftKey && (document.activeElement === a || !d.contains(document.activeElement))) { ev.preventDefault(); z.focus(); } else if (!ev.shiftKey && document.activeElement === z) { ev.preventDefault(); a.focus(); }
      }
    });
    q.addEventListener('input', function () {
      clearTimeout(t);
      t = setTimeout(function () {
        W.needSuche().then(function () {
        var r = W.search(q.value, { lab: lab });
        res.innerHTML = (r.meint ? '<p class="mute">Meintest du „' + esc(r.meint) + '“?</p>' : '') + r.map(function (e) { return '<button type="button" role="option" class="wkd-hit" data-id="' + e.id + '"><b>' + W.hl(formel(e.titel), q.value, r.meint) + '</b> <small>' + esc(W.katText(e)) + '</small></button>'; }).join('') || (q.value.trim() ? '<p class="mute">Kein Treffer</p>' : '');
        });
      }, 120);
    });
    res.addEventListener('click', function (ev) { var b = ev.target.closest('.wkd-hit'); if (b) { var hid = b.dataset.id; res.innerHTML = ''; q.value = ''; suche(false); W.needFor(hid).then(function () { W.open(hid, ctx); }); } });
    d.addEventListener('click', function (ev) {
      var a = ev.target.closest('a.wl[data-id]'); if (a) { ev.preventDefault(); var wid = a.dataset.id; W.needFor(wid).then(function () { W.open(wid, ctx); }); return; }
      var s = ev.target.closest('.wk-speak'); if (s) { var en = W.get(d.dataset.id); if (en) W.speak(en, s); return; }
      var al = ev.target.closest('.wk-all'); if (al) { W.needAll().then(function () { var art = al.closest('.we'); if (art) W.open(art.dataset.id, ctx); }); }
    });
    return d;
  };
  W.close = function () {
    if (!drawer) return;
    W.stopSpeak();
    drawer.hidden = true; drawer.previousSibling.hidden = true;
    document.documentElement.classList.remove('wkd-open');
    try { if (lastFocus && lastFocus.focus) lastFocus.focus(); } catch (x) {}
  };

  // Zentrale Delegation: Klick auf .wk / [data-wiki] oeffnet den Eintrag (Abschnitt 6.2). Auto-Zuordnung ("?"-Knoepfe) folgt in W5/W8.
  W.marks = function () { try { return localStorage.getItem('lm4.wiki.hints') !== '0' && localStorage.getItem('lm4.wiki.marks') !== '0'; } catch (e) { return true; } };
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('button.wk'); if (!b || document.body.dataset.wiki === 'seite') return;
    ev.preventDefault(); ev.stopPropagation();
    var id = b.dataset.wiki || b.dataset.id, ctx = { lab: b.dataset.lab || labName(), rig: b.dataset.rig, key: b.dataset.key };
    W.needFor(id).then(function () { W.open(id, ctx); });
  });
  document.addEventListener('pointerdown', function (ev) { if (ev.target.closest && ev.target.closest('button.wk')) ev.stopPropagation(); }, true);
})(typeof window !== 'undefined' ? window : this);
