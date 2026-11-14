/* Tonfunk Lab: Vorlesen an vielen Stellen (Karte "Warum brauche ich das?", Verbundprojekte, Ausbildungsplan, Wiki-Begriffe/-Formeln).
   Ein kleines Modul, zwei Teile:
   1) Vorlesen.Texte: baut je Kategorie den Text, der gesprochen wird (Basis-Anzeigetext, ohne Emojis und Markup). Dieselbe Datei benutzt der Export
      quelle/gen/stimme_export.js, damit Hash der Aufnahme und Text der App garantiert aus einer Quelle kommen. Die Aussprache-Ersetzungen (SPS -> Es-Peh-Es ...)
      passieren NUR im Export (Aufnahme), nie hier und nie im Hash.
   2) Vorlesen.knopf(doc, key, textOderFn, opts): liefert einen <button> "Vorlesen / Stopp". Mit der Aufnahme sprache/<datei>.mp3, wenn window.SpeakAudio[key].h dem Hash
      des Textes entspricht (speak.js, djb2), sonst mit der Gerätestimme. speak.js (mit data-wiki="lazy") und sprache/index.js werden beim Erzeugen des Knopfs (oder mit
      Vorlesen.vorladen) im Hintergrund nachgeladen. Der Tipp selbst startet das Sprechen sofort: ist speak.js noch nicht da, spricht ein eigener Mini-Weg mit der
      Gerätestimme direkt im Tipp-Handler (iOS verlangt, dass Audio und Sprachausgabe aus dem Tipp heraus starten, nicht erst nach dem Nachladen).
   Nur ein Sprecher gleichzeitig: Start stoppt alles andere (auch Wiki-Vorlesen, Speak.part); startet jemand anderes, wird der Knopf zurückgesetzt.
   Schlüssel: WZ_<lab>, VB_<projekt>, VB_<projekt>_<station>, LF_<beruf>_<lernfeld>, WK_<wiki-id>, AU_<lab>_<aufgabe> (opts.nurAufnahme: nur mit Aufnahme, nie Gerätestimme). Läuft im Browser (window.Vorlesen) und in Node (module.exports). */
(function (root) {
  'use strict';

  /* ---------------------------------------------------------------- Texte */
  /* Anzeige-Text -> Sprech-Basistext: keine Emojis, kein Markup, Unterstriche (U_1) als Leerzeichen, ruhige Leerzeichen. Reine Funktion. */
  function bereinige(t) {
    var s = String(t == null ? '' : t);
    s = s.replace(/\[\[([^\]|]*)\|?([^\]]*)\]\]/g, function (m, a, b) { return b || a; });
    s = s.replace(/\*\*|`/g, '');
    s = s.replace(/[­​-‏⁠︀-️]/g, '');
    s = s.replace(/[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/gu, ' ');
    s = s.replace(/_/g, ' ').replace(/[   ]/g, ' ').replace(/\s+/g, ' ').trim();
    s = s.replace(/\s+([.,;:!?])/g, '$1');
    return s;
  }
  function punkt(t) { t = bereinige(t); return t && !/[.!?:;]$/.test(t) ? t + '.' : t; }
  /* djb2 wie speak.js und mksprache.py (UTF-16-Einheiten) */
  function hash(s) { var h = 5381; s = String(s); for (var i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0; return h.toString(36); }

  var Texte = {
    bereinige: bereinige, hash: hash,
    /* Karte "Warum brauche ich das?": e = { lab, betrieb, pruefung } (Einordnung.get(lab)). Lernfeld- und Projekt-Links werden nicht gesprochen. */
    wz: function (e) {
      if (!e || !e.betrieb) return '';
      return bereinige('Im Betrieb: ' + punkt(e.betrieb) + (e.pruefung ? ' Typisch in der Prüfung: ' + punkt(e.pruefung) : ''));
    },
    wzKey: function (lab) { return 'WZ_' + lab; },
    /* Verbundprojekt: Name und Auftragsgeschichte (def.story). Das Lastenheft (Zahlen je Stufe und Zufallswert) wird nicht gesprochen. */
    vbProjekt: function (def) { return def && def.story ? bereinige(punkt(String(def.name || '').replace(/\s*\/\s*/g, ', ')) + ' ' + punkt(def.story)) : ''; },
    vbProjektKey: function (pid) { return 'VB_' + pid; },
    /* Station: fester Auftragstext (def.stations[i].text, für alle Stufen und Zufallswerte gleich). Hat die Station eine Sprechfassung (sprich: ohne Tabellen, Zahlenlisten, Zeilenformate), wird die gelesen. */
    vbStation: function (st) { return st && typeof st.sprich === 'string' && st.sprich ? bereinige(st.sprich) : st && typeof st.text === 'string' ? bereinige(st.text) : ''; },
    vbStationKey: function (pid, sid) { return 'VB_' + pid + '_' + sid; },
    /* Ausbildungsplan: Lernfeld-Titel und Kurztext */
    lf: function (l) { return l && l.kurz ? bereinige(punkt(l.titel || '') + ' ' + punkt(l.kurz)) : ''; },
    lfKey: function (beruf, id) { return 'LF_' + beruf + '_' + id; },
    /* Wiki: Kurztext; bei Reglern und Messwerten mit dem Kopfsatz davor (Titel, Typ, Lab, Prüfstand), wie das Wiki es schon immer vorliest */
    wiki: function (e) {
      if (!e || !e.kurz) return '';
      return bereinige(/^(regler|messwert)$/.test(e.kat) && e.kopf ? e.kopf + ' ' + e.kurz : e.kurz);
    },
    wikiKey: function (id) { return 'WK_' + id; },
    /* Aufgabe (Lab-Karte): Titel und Auftrag, ohne Loesung, Tipps und Bedienelemente. Schluessel AU_<lab>_<aufgabenId>. Aufgaben werden nur mit Aufnahme vorgelesen (aufgabe-vorlesen.js). */
    au: function (titel, auftrag) { var a = bereinige(auftrag); return a ? bereinige(punkt(titel) + ' ' + a) : ''; },
    auKey: function (lab, id) { return 'AU_' + lab + '_' + id; }
  };

  var API = { Texte: Texte };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof document === 'undefined' || root.document !== document) return;   // Node: nur die Texte

  /* ---------------------------------------------------------------- Knopf (Browser) */
  var CSSID = 'vlCss';
  var aktiv = null, tok = 0, eigen = false, geladen = false;

  function css(doc) {
    if (!doc || doc.getElementById(CSSID)) return;
    var st = doc.createElement('style'); st.id = CSSID;
    st.textContent = '.vl-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:44px;min-width:44px;max-width:100%;margin:6px 0;padding:0 18px;box-sizing:border-box;'
      + 'border:1px solid var(--line,#38424d);border-radius:22px;background:var(--panel2,#2c343e);color:var(--fg,#e8ecf0);font:600 14px/1.2 -apple-system,system-ui,"Segoe UI",sans-serif;cursor:pointer;'
      + '-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;touch-action:manipulation}'
      + '.vl-btn:hover{border-color:var(--accent,#5fb0ff)}'
      + '.vl-btn[aria-pressed=true]{background:var(--accent-bg,#1a6fd4);border-color:var(--accent-bg,#1a6fd4);color:#fff}'
      + '.vl-btn:focus-visible{outline:3px solid var(--focus,#ffd166);outline-offset:2px}'
      + '@media print{.vl-btn,.vl-wrap{display:none!important}}';
    (doc.head || doc.body || doc.documentElement).appendChild(st);
  }
  function zustand(b, an) {
    try { b.setAttribute('aria-pressed', an ? 'true' : 'false'); b.textContent = an ? '⏹ Stopp' : '🔊 Vorlesen'; } catch (e) {}
  }
  function zuruecksetzen() { var b = aktiv; aktiv = null; tok++; if (b) zustand(b, false); }

  /* Wer anderes spricht (Wiki-Vorlesen, "Erkläre dich"), setzt unseren Knopf zurück. speak.js ruft intern seine eigenen Funktionen, darum haken wir die öffentlichen ein. */
  function haken(S) {
    if (!S || S.__vlHaken) return;
    S.__vlHaken = 1;
    ['speak', 'say', 'stop', 'part'].forEach(function (n) {
      var o = S[n]; if (typeof o !== 'function') return;
      S[n] = function () { if (!eigen && aktiv) zuruecksetzen(); return o.apply(this, arguments); };
    });
  }
  function skript(doc, src, lazy) {
    try {
      var s = doc.createElement('script'); s.src = src; s.async = true;
      if (lazy) s.setAttribute('data-wiki', 'lazy');   /* nur das Vorlesen, nicht das Wiki im Leerlauf nachladen */
      s.onload = function () { haken(root.Speak); };
      (doc.head || doc.documentElement).appendChild(s);
    } catch (e) {}
  }
  /* speak.js und sprache/index.js nachladen, falls die Seite sie nicht schon hat (einmal) */
  function vorladen(doc) {
    doc = doc || root.document;
    if (root.Speak) { haken(root.Speak); }
    if (geladen) return; geladen = true;
    if (!root.SpeakAudio) skript(doc, 'sprache/index.js', false);
    if (!root.Speak) skript(doc, 'speak.js', true);
  }
  /* Notweg im Tipp-Handler, solange speak.js noch lädt: Gerätestimme direkt */
  function geraet(text, fertig) {
    try {
      var ss = root.speechSynthesis;
      if (!ss || typeof root.SpeechSynthesisUtterance !== 'function') { fertig(); return; }
      ss.cancel();
      var u = new root.SpeechSynthesisUtterance(text); u.lang = 'de-DE'; u.rate = 0.95; u.onend = u.onerror = fertig;
      ss.speak(u);
    } catch (e) { fertig(); }
  }
  function stop() {
    if (!aktiv) return;
    eigen = true;
    try { if (root.Speak && typeof root.Speak.stop === 'function') root.Speak.stop(); else if (root.speechSynthesis) root.speechSynthesis.cancel(); } catch (e) {}
    eigen = false;
    zuruecksetzen();
  }

  function knopf(doc, key, textOderFn, opts) {
    opts = opts || {};
    css(doc);
    var b = doc.createElement('button'); b.type = 'button'; b.className = 'vl-btn' + (opts.cls ? ' ' + opts.cls : '');
    if (opts.titel) b.title = opts.titel;
    zustand(b, false);
    b.addEventListener('click', function () {
      if (aktiv === b) { stop(); return; }
      if (aktiv) stop();
      var text = '';
      try { text = bereinige(typeof textOderFn === 'function' ? textOderFn() : textOderFn); } catch (e) { text = ''; }
      if (!text) return;
      try { if (root.Wiki && typeof root.Wiki.stopSpeak === 'function') root.Wiki.stopSpeak(); } catch (e) {}
      var my; aktiv = b; my = ++tok; zustand(b, true);
      var fertig = function () { if (my === tok && aktiv === b) zuruecksetzen(); };
      var S = root.Speak, nur = opts.nurAufnahme ? { nurAufnahme: true } : undefined;   /* nurAufnahme: nie die Geraetestimme, bei Fehler still zuruecksetzen */
      eigen = true;
      try {
        if (S && typeof S.speak === 'function') S.speak(key, text, '', fertig, nur);
        else if (nur) fertig();
        else geraet(text, fertig);
      } catch (e) { fertig(); }
      eigen = false;
      if (!S) vorladen(doc);
    });
    if (opts.vorladen !== false) vorladen(doc);
    return b;
  }

  API.knopf = knopf; API.stop = stop; API.vorladen = vorladen; API.aktiv = function () { return aktiv; };
  root.Vorlesen = API;
})(typeof window !== 'undefined' ? window : globalThis);
