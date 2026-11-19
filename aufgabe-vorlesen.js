/* Tonfunk Lab: Aufgabe vorlesen (Lernhilfe fuer Azubis, die schwer lesen). Ein kleines Modul, zwei Teile:
   1) Daten-Teil (Node und Browser): baut je Lab und Aufgabe den gesprochenen Text aus den Aufgabendaten, ohne DOM: Vorlesen.Texte.au(titel, auftrag) aus vorlesen.js
      (Titel + Auftrag, keine Loesung, keine Tipps, keine Bedienelemente), Schluessel AU_<lab>_<aufgabenId>. Daraus entstehen spaeter die Aufnahmen (Hash = djb2 wie speak.js);
      AU.daten(lab, globals) liefert die Liste samt Kennzeichen "geeignet" (Funktion wie aufnahmeGeeignet in quelle/gen/stimme_export.js: Zeichen | < >, 15 und mehr Zahlen, 4 und mehr
      Grossbuchstaben-Kennungen, dazu Tabelle/Code/Dokument in der Aufgabe sind ungeeignet). AU.ladeNode(lab, webOrdner) laedt in Node die Datenskripte des Labs (aus dessen HTML).
   2) Browser-Teil: design.js laedt dieses Skript auf Lab-Seiten nach. Es sucht je Lab-Familie (Selektor-Tabelle unten) die sichtbare Aufgabenkarte, liest Titel und Auftrag,
      bildet den Text und den Hash und fragt window.SpeakAudio: Nur wenn es zu AU_<lab>_<id> eine Aufnahme gibt UND deren Hash dem heutigen Text entspricht, wird direkt
      unter dem Auftrag der Knopf "Vorlesen" (vorlesen.js, opts.nurAufnahme: nie die Geraetestimme) eingefuegt. Sonst nichts: kein Knopf, kein Platzhalter, keine Luecke.
      Aufgabenwechsel und Neuzeichnen der Karte (MutationObserver) halten den Knopf aktuell und stoppen laufendes Vorlesen. speak.js und sprache/index.js werden erst nachgeladen,
      wenn eine Aufgabenkarte da ist. Wo der Auftrag nicht eindeutig zu finden ist (Labs ohne Familie), passiert nichts.
   Familien (Feld fam je Lab): "karte" = #taskView/#v_tasks .card.pl mit h4 "Aufgabe ..." + .big (Titel) + erstem Absatz (Auftrag); "task" = SchaltLab-Familie (schaltplan.js: sch, sim, code, pi, digi, mess, haus) .card.task mit h4, <b> (Titel), erstem Absatz;
   "loch" = LochLab #tcard (<b> Titel samt Stufenpunkten, erster Absatz); "app" = App-Werkstatt (Karte mit #tBack, h2 Titel, erster Absatz). Gelesen wird nur der Auftragsabsatz.
   Weitere Familien: "qt" = Studium-Labs sig/prj (#taskView .card.pl, h3 oder h4 "Aufgabe ...", .big Titel, .qtext Auftrag), "rg2" = Regelungstechnik Aufbau (Karte mit Knopf data-act=tkb, h4 "Kennung Titel", erster Absatz), "emb" = Embedded vertieft (details.task offen, summary .t "01 · Titel", .tb > p).
   Arten: 'build' = <GLOB>.build(id).text (rg2: RG2DATA, Modul per module.exports), 'seed' fuer sig/prj mit Startwert id#k wie in der Oberflaeche (nur Aufgaben mit fuer 40 Startwerte gleichem Text bekommen eine Aufnahme).
   Daten fuer die Familien task/loch/app (Aufgaben stecken in einer Funktion, nicht in einer Datei-Variable): in Node laeuft die Seite (alle ihre Skripte) in einer vm-Sandbox mit Stub-DOM, die Liste kommt aus
   LabDigiAPI.tasksList() / LochTasks.list() / APP_TASKS (im Browser dieselben Aufrufe). Aufgaben mit wechselndem Text (Zufallszahlen rand, Tages- und Duellaufgabe, get text()) bekommen KEINE Aufnahme (ohne). */
(function (root) {
  'use strict';
  var Vl = (typeof module !== 'undefined' && module.exports && typeof require === 'function') ? require('./vorlesen.js') : root.Vorlesen;

  /* Lab -> { datei, art }. art: 'seed' = Generator mit Startwert, Text nur wenn fuer 40 Startwerte gleich (its, buc, hyd, zei), 'text' = DATEN.tasks[i].text (feld: anderer Name der Liste, z. B. TASKS), 'make' = DATEN.makeTask(t).text (fester Seed = Aufgaben-ID), 'mk' = <LAB>_CORE.mk(t.kind, t.p).text (feste Parameter), 'rig' = <LAB>_TASKS.tasks[i].text.
     Nur Labs mit eindeutigem, in Node baubarem Text und stabiler Aufgabenkarte. */
  /* Aufgaben, deren Text sich aendert (Zufallszahlen per Knopf "Neue Zahlen", Tages- und Duellaufgabe, get text()): kein fester Text, keine Aufnahme */
  function wechselt(t) { var d = Object.getOwnPropertyDescriptor(t, 'text'); return !!(t.rand || t.daily || t.duel || (d && typeof d.get === 'function')); }
  var LABS = {
    tol: { datei: 'tollab.html', art: 'text' }, wer: { datei: 'werlab.html', art: 'text' }, cnc: { datei: 'cnclab.html', art: 'text' },
    ins: { datei: 'inslab.html', art: 'text', ohne: function (t) { return t.kind === 'scen'; } }, sql: { datei: 'sqllab.html', art: 'text' },
    lad: { datei: 'ladlab.html', art: 'make' }, eng: { datei: 'englab.html', art: 'make' }, kon: { datei: 'konlab.html', art: 'make' }, wfl: { datei: 'wfllab.html', art: 'make' },
    rec: { datei: 'reclab.html', art: 'make' }, lin: { datei: 'linlab.html', art: 'make' }, alg: { datei: 'alglab.html', art: 'make' }, hwl: { datei: 'hwllab.html', art: 'make' },
    sys: { datei: 'syslab.html', art: 'make' }, ssl: { datei: 'ssllab.html', art: 'make' }, lag: { datei: 'laglab.html', art: 'make' }, bhf: { datei: 'bhflab.html', art: 'make' },
    fug: { datei: 'fuglab.html', art: 'make' }, fer: { datei: 'ferlab.html', art: 'make' }, mak: { datei: 'maklab.html', art: 'make' }, mas: { datei: 'maslab.html', art: 'make' },
    mch: { datei: 'mchlab.html', art: 'make' }, arb: { datei: 'arblab.html', art: 'text' }, net: { datei: 'netlab.html', art: 'mk' },
    pne: { datei: 'pnelab.html', art: 'text', feld: 'TASKS', fam: 'pne' },
    its: { datei: 'itslab.html', art: 'seed', seed: function (g, t, k) { return g.ITS_DATA.build(t, k).text; } },
    buc: { datei: 'buclab.html', art: 'seed', seed: function (g, t, k) { return t.make(g.BUC_CORE.rng(t.id + '#' + k), g.BUC_CORE).text; } },
    hyd: { datei: 'hydlab.html', art: 'seed', seed: function (g, t, k) { return t.make(g.HYD_CORE.rng('au' + k + t.id)).text; } },
    zei: { datei: 'zeilab.html', art: 'seed', seed: function (g, t, k) { return g.ZEI_CORE.build(t, k + 1).prompt; } },
    ana: { datei: 'analab.html', art: 'rig' }, els: { datei: 'elslab.html', art: 'rig' }, nts: { datei: 'ntslab.html', art: 'rig' }, wsl: { datei: 'wsllab.html', art: 'rig' },
    enr: { datei: 'enrlab.html', art: 'rig' }, thm: { datei: 'thmlab.html', art: 'rig' }, reg: { datei: 'reglab.html', art: 'rig' },
    sps: { datei: 'spslab.html', art: 'rig' }, pcb: { datei: 'pcblab.html', art: 'rig' }, ant: { datei: 'antlab.html', art: 'rig' }, sen: { datei: 'senlab.html', art: 'rig' },
    emv: { datei: 'emvlab.html', art: 'rig' }, ds: { datei: 'dslab.html', art: 'rig' },
    sch: { datei: 'schaltplan.html', art: 'api', fam: 'task', ohne: wechselt, ohneId: /^det[0-9]+$/ }, sim: { datei: 'simlab.html', art: 'api', fam: 'task', ohne: wechselt },
    code: { datei: 'codelab.html', art: 'api', fam: 'task', ohne: wechselt }, pi: { datei: 'pilab.html', art: 'api', fam: 'task', ohne: wechselt },
    digi: { datei: 'digilab.html', art: 'api', fam: 'task', ohne: wechselt }, mess: { datei: 'messlab.html', art: 'api', fam: 'task', ohne: wechselt }, haus: { datei: 'hauslab.html', art: 'api', fam: 'task', ohne: wechselt },
    mat2: { datei: 'mat2lab.html', art: 'make' }, nrm: { datei: 'nrmlab.html', art: 'make' }, fli: { datei: 'flilab.html', art: 'make' },
    sig: { datei: 'siglab.html', art: 'seed', fam: 'qt', seed: function (g, t, k) { return t.make(g.SIG_CORE.rng(t.id + '#' + k), g.SIG_CORE).text; } },
    hf: { datei: 'hflab.html', art: 'seed', fam: 'qt', seed: function (g, t, k) { return t.make(g.HF_CORE.rng(t.id + '#' + k), g.HF_CORE).text; } },
    prj: { datei: 'prjlab.html', art: 'seed', fam: 'qt', seed: function (g, t, k) { return t.make(g.PRJ_CORE.rng(t.id + '#' + k), g.PRJ_CORE).text; } },
    rg2: { datei: 'rg2lab.html', art: 'build', fam: 'rg2', modul: 'rg2data.js', glob: 'RG2DATA' }, emb: { datei: 'emblab.html', art: 'rig', fam: 'emb' },
    loch: { datei: 'layout.html', art: 'loch', fam: 'loch', ohne: wechselt }, app: { datei: 'appwerkstatt.html', art: 'app', fam: 'app', ohne: wechselt }
  };
  function labs() { return Object.keys(LABS); }   // abgedeckte Labs (Schluessel), damit niemand die Liste fest verdrahtet
  function labVonDatei(datei) { var ks = Object.keys(LABS); for (var i = 0; i < ks.length; i++) if (LABS[ks[i]].datei === datei) return ks[i]; return ''; }

  /* ---------------------------------------------------------------- Daten-Teil */
  /* wie aufnahmeGeeignet in quelle/gen/stimme_export.js (ein Test haelt beide gleich) */
  var BEKANNT_GROSS = /^(LED|SPS|CNC|ISO|DIN|ADU|PWM|SQL|CPU|SSD|RAID|BCD|UND|ODER|GND|HRC|IEC)$/;
  function geeignet(basis) {
    var zahlen = (basis.match(/\d[\d.,]*/g) || []).length;
    var kenn = (basis.match(/(?<![\p{L}\p{N}_])[A-ZÄÖÜ]{3,}(?![\p{L}\p{N}_])/gu) || []).filter(function (w) { return !BEKANNT_GROSS.test(w); }).length;
    return !/[|<>]/.test(basis) && zahlen < 15 && kenn < 4;
  }
  function liste(x) { return Array.isArray(x) ? x : (x && typeof x === 'object' ? Object.keys(x).map(function (k) { return x[k]; }) : []); }
  /* Aufgabenliste eines Labs: [{ id, key, titel, basis, geeignet, grund }]. g = Objekt mit den Globals der Datenskripte (window bzw. globalThis).
     grund: '' | 'symbol' | 'tabelle' | 'code' | 'regel' (Zahlen-, Kennungs- oder Sonderzeichenregel). */
  /* Rohliste der Aufgaben: Arten text/make/rig aus <LAB>_DATA bzw. <LAB>_TASKS; api/loch/app aus der laufenden Seite (im Browser g = window; in Node die Sandbox aus ladeNode, g.__AU_SB[lab]) */
  function roh(lab, g) {
    var L = LABS[lab], h = (g.__AU_SB && g.__AU_SB[lab]) || g, D;
    if (L.art === 'api') return h.LabDigiAPI && typeof h.LabDigiAPI.tasksList === 'function' ? liste(h.LabDigiAPI.tasksList()) : [];
    if (L.art === 'loch') return h.LochTasks && typeof h.LochTasks.list === 'function' ? liste(h.LochTasks.list()) : [];
    if (L.art === 'app') return liste(h.APP_TASKS);
    if (L.art === 'build') return g[L.glob] ? liste(g[L.glob].TASKS) : [];   // Aufgabe wird erst von build(id) fertig gebaut (rg2)
    if (lab === 'pcb') {   // dazu die Quizfragen der Reiter Fehlerbild und ESD (AU_pcb_fq1 ..., AU_pcb_eq1 ...)
      D = g.PCB_TASKS; var fq = (g.PCB_FEHLER || h.PCB_FEHLER || {}).QUIZ, eq = (g.PCB_ESD || h.PCB_ESD || {}).QUIZ;
      return liste(D ? D.tasks : []).concat(liste(fq), liste(eq));
    }
    D = g[lab.toUpperCase() + (L.art === 'rig' ? '_TASKS' : '_DATA')];
    return D ? liste(D[L.feld || 'tasks']) : [];
  }
  /* Ids der Aufgaben, die zum Lab gehoeren, aber keine Karte mit festem Text haben (ohne-Regel des Labs): fuer den Abgleich mit aufgaben.js */
  function ausgenommen(lab, g) {
    var L = LABS[lab]; if (!L || !(L.ohne || L.art === 'seed')) return [];
    return roh(lab, g).filter(function (t) { return t && t.id != null && ohneT(L, lab, g, t); }).map(function (t) { return String(t.id); });
  }
  /* Seed-Generatoren (Rechen-, Zeichnungs-, Hydraulik-Lab ...): der Text zaehlt als fest, wenn er fuer SEED_N verschiedene Startwerte gleich ist (der Knopf erscheint ohnehin nur, wenn der angezeigte Text den Hash trifft) */
  var SEED_N = 40;
  function festSeed(L, g, t) {
    try { var a = L.seed(g, t, 0), k; if (typeof a !== 'string' || !a) return null; for (k = 1; k < SEED_N; k++) if (L.seed(g, t, k) !== a) return null; return a; } catch (e) { return null; }
  }
  function ohneT(L, lab, g, t) { return L.art === 'seed' ? festSeed(L, g, t) === null : !!(L.ohne && L.ohne(t)); }
  function daten(lab, g) {
    var L = LABS[lab]; if (!L) return [];
    var T = (Vl || root.Vorlesen).Texte, out = [], D = L.art === 'make' ? g[lab.toUpperCase() + '_DATA'] : null, K = L.art === 'mk' ? g[lab.toUpperCase() + '_CORE'] : null;
    if ((L.art === 'make' && !D) || (L.art === 'mk' && !K) || (L.art === 'build' && !g[L.glob])) return out;
    roh(lab, g).forEach(function (t) {
      if (!t || t.id == null || ohneT(L, lab, g, t)) return;   // ohne: Aufgaben, die nicht als Karte mit festem Text erscheinen (Instandhaltung: Szenarien; Zufall, Tages-, Duellaufgabe)
      var q = t, titel = t.title;
      if (L.art === 'make') q = D.makeTask(t);
      else if (L.art === 'mk') q = K.mk(t.kind, t.p);
      else if (L.art === 'build') q = g[L.glob].build(t.id);
      else if (L.art === 'seed') q = { text: festSeed(L, g, t) };
      var text = q && typeof q.text === 'string' ? q.text : '', basis = T.au(titel, text);
      if (!basis) return;
      var grund = '';
      if (/{sym:/.test(titel + ' ' + text)) grund = 'symbol';   // Thermik: Formelzeichen je nach Einstellung der Nutzerin oder des Nutzers (andere Schreibweise auf dem Bildschirm)
      else if (q.table || t.table) grund = 'tabelle'; else if (q.code || t.code || q.prog || t.prog || q.doc || t.doc) grund = 'code';
      else if (!geeignet(basis)) grund = 'regel';
      out.push({ id: String(t.id), key: T.auKey(lab, t.id), titel: String(titel || ''), basis: basis, geeignet: !grund, grund: grund });
    });
    return out;
  }
  /* Node: Datenskripte eines Labs laden (die core-, data- und tasks-Skripte aus der Lab-HTML, in deren Reihenfolge); liefert die Globals (globalThis) */
  function ladeNode(lab, web) {
    var fs = require('fs'), path = require('path'), L = LABS[lab]; if (!L) return null;
    web = path.resolve(web); globalThis.window = globalThis;
    if (L.art === 'api' || L.art === 'loch' || L.art === 'app') {   // die Aufgaben stecken in der Seite selbst: ganze Seite in der Sandbox laufen lassen
      (globalThis.__AU_SB = globalThis.__AU_SB || {})[lab] = sandbox(lab, web);
      return globalThis;
    }
    if (L.art === 'build') { globalThis[L.glob] = require(path.join(web, L.modul)); return globalThis; }   // Modul ohne Browser-Global (module.exports): selbst eintragen
    var html = fs.readFileSync(path.join(web, L.datei), 'utf8'), re = /<script[^>]*src="([^"]+)"/g, m, srcs = [];
    var eigen = new RegExp('^' + lab + '[a-z0-9-]*\\.js$');   // die eigenen Skripte des Labs in HTML-Reihenfolge, ohne Oberflaeche (ui) und Zeichnungen (viz)
    while ((m = re.exec(html))) if (eigen.test(m[1]) && !/(ui|viz)[a-z0-9-]*\.js$/.test(m[1])) srcs.push(m[1]);
    srcs.forEach(function (s) { require(path.join(web, s)); });
    return globalThis;
  }

  /* Node: Lab-Seite in einer vm-Sandbox ausfuehren (Stub-DOM, das jeden Zugriff schluckt). Alle Skripte der HTML in ihrer Reihenfolge (ohne Nachladeskripte wie design.js, gate.js, speak.js);
     Fehler einzelner Skripte werden gesammelt (sb.__fehler), die Aufgabenlisten stehen dann in LabDigiAPI / LochTasks / APP_TASKS. Ergebnis: das Sandbox-Objekt. */
  function sandbox(lab, web) {
    var fs = require('fs'), path = require('path'), vm = require('vm'), L = LABS[lab], html = fs.readFileSync(path.join(web, L.datei), 'utf8');
    function stub() {
      var store = {}, p = new Proxy(function () {}, {
        get: function (t, k) {
          if (k === Symbol.toPrimitive) return function (h) { return h === 'number' ? 0 : ''; };
          if (k === 'length') return 0; if (k === 'then') return undefined;
          if (k === 'getBoundingClientRect') return function () { return { left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, x: 0, y: 0 }; };
          if (k === 'querySelectorAll' || k === 'getElementsByTagName' || k === 'getElementsByClassName') return function () { return []; };
          if (k in store) return store[k];
          return (store[k] = stub());
        },
        set: function (t, k, v) { store[k] = v; return true; }, apply: function () { return stub(); }, construct: function () { return stub(); }, has: function () { return true; }
      });
      return p;
    }
    var sb = { console: console, setTimeout: function () { return 0; }, clearTimeout: function () {}, setInterval: function () { return 0; }, clearInterval: function () {}, requestAnimationFrame: function () { return 0; }, cancelAnimationFrame: function () {}, __fehler: [] };
    sb.window = sb; sb.self = sb; sb.globalThis = sb; sb.LAB = lab;
    sb.document = stub(); sb.navigator = { userAgent: 'node', maxTouchPoints: 0, language: 'de' };
    sb.location = { search: '', hash: '', pathname: '/' + L.datei, href: 'http://x/' + L.datei, hostname: 'x', protocol: 'http:' };
    var ls = {}; sb.localStorage = { getItem: function (k) { return k in ls ? ls[k] : null; }, setItem: function (k, v) { ls[k] = String(v); }, removeItem: function (k) { delete ls[k]; } }; sb.sessionStorage = sb.localStorage;
    ['Image', 'Audio', 'Event', 'CustomEvent', 'MutationObserver', 'ResizeObserver', 'IntersectionObserver', 'Worker', 'Blob', 'URL', 'XMLHttpRequest', 'FileReader', 'AudioContext', 'Path2D', 'DOMParser', 'URLSearchParams', 'Option', 'HTMLElement', 'Node', 'Element'].forEach(function (n) { sb[n] = stub(); });
    sb.matchMedia = function () { return { matches: false, addEventListener: function () {}, addListener: function () {} }; };
    sb.addEventListener = sb.removeEventListener = function () {}; sb.dispatchEvent = function () { return true; }; sb.getComputedStyle = function () { return stub(); };
    sb.fetch = function () { return new Promise(function () {}); }; sb.innerWidth = 1180; sb.innerHeight = 820; sb.devicePixelRatio = 1; sb.performance = { now: function () { return 0; } };
    sb.alert = sb.confirm = sb.prompt = function () { return null; };
    vm.createContext(sb);
    var re = /<script([^>]*)>([\s\S]*?)<\/script>/g, m;
    while ((m = re.exec(html))) {
      var src = /src="([^"]+)"/.exec(m[1]), code;
      if (src) { if (/^(design|gate|tutorial|tutorial-data|iliasbar|hdr|verbundbar|urheber|speak|voice|feel|ver)\.js$|^sprache\/|^sw\.js$/.test(src[1])) continue; code = fs.readFileSync(path.join(web, src[1]), 'utf8'); }
      else { code = m[2]; if (code.length < 500 && /serviceWorker/.test(code)) continue; }
      try { vm.runInContext(code, sb, { filename: src ? src[1] : 'inline' }); } catch (e) { sb.__fehler.push((src ? src[1] : 'inline') + ': ' + String(e && e.message).split('\n')[0]); }
    }
    return sb;
  }

  var API = { LABS: LABS, labs: labs, labVonDatei: labVonDatei, geeignet: geeignet, daten: daten, ausgenommen: ausgenommen, ladeNode: ladeNode };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof document === 'undefined' || root.document !== document) return;   // Node: nur der Daten-Teil
  root.AufgabeVorlesen = API;

  /* ---------------------------------------------------------------- Browser-Teil */
  var doc = document, file = '', lab = '';
  try { file = String(root.location.pathname || '').split('/').pop(); } catch (e) { file = ''; }
  lab = labVonDatei(file); if (!lab) return;
  var CSSID = 'auCss', cur = null, raf = 0, idx = null, idxFuer = null, vorgeladen = false, warte = 0, obs = null;

  function css() {
    if (doc.getElementById(CSSID)) return;
    var st = doc.createElement('style'); st.id = CSSID;
    st.textContent = '.au-wrap{margin:2px 0 4px}.au-wrap .vl-btn{margin:2px 0}'
      + '@media(max-width:640px){.au-wrap .vl-btn{font-size:0;padding:0;width:44px;min-width:44px}.au-wrap .vl-btn::before{content:"\\1F50A";font-size:20px;line-height:1}'
      + '.au-wrap .vl-btn[aria-pressed=true]::before{content:"\\23F9"}}';
    (doc.head || doc.documentElement).appendChild(st);
  }

  /* Aufgabenkarte der Familie "karte": { card, anchor (Absatz mit dem Auftrag), titel, auftrag } oder null */
  function sichtbar(e) { return !!(e.offsetParent || e.getClientRects().length); }
  /* Titel ohne Stufenpunkte o. Ae.: nur der erste Textknoten (LochLab: <b>Titel <span>●●○○</span></b>) */
  function ersterText(e) { for (var n = e.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && /\S/.test(n.nodeValue)) return n.nodeValue; return e.textContent || ''; }
  function finde() {
    var fam = (LABS[lab] && LABS[lab].fam) || 'karte', c, h, big, p, cards, i;
    if (fam === 'task') {   // SchaltLab-Familie: <div class="card task"><h4>Aufgabe · Kategorie</h4><b>Titel</b><p class="hint2">Auftrag</p> ...
      cards = doc.querySelectorAll('.card.task');
      for (i = 0; i < cards.length; i++) {
        c = cards[i]; h = c.querySelector(':scope > h4'); big = c.querySelector(':scope > b'); p = c.querySelector(':scope > p');
        if (!h || !big || !p || !/^Aufgabe/.test(h.textContent || '') || !sichtbar(c) || !sichtbar(p)) continue;
        return { card: c, anchor: p, titel: big.textContent || '', auftrag: p.textContent || '' };
      }
      return null;
    }
    if (fam === 'loch') {   // LochLab: <div id="tcard"><b>Titel <span>Stufe</span></b><p>Auftrag</p> ... (eingeklappt: Absatz ausgeblendet)
      c = doc.getElementById('tcard'); if (!c) return null;
      big = c.querySelector(':scope > b'); p = c.querySelector(':scope > p');
      if (!big || !p || !sichtbar(c) || !sichtbar(p)) return null;
      return { card: c, anchor: p, titel: ersterText(big), auftrag: p.textContent || '' };
    }
    if (fam === 'pne') {   // Pneumatik: <div class="tp"><div class="tph"><b>Titel</b> ...</div><p class="tpt">Auftrag</p> ...
      cards = doc.querySelectorAll('.tp');
      for (i = 0; i < cards.length; i++) {
        c = cards[i]; big = c.querySelector('.tph > b'); p = c.querySelector(':scope > p.tpt');
        if (!big || !p || !sichtbar(c) || !sichtbar(p)) continue;
        return { card: c, anchor: p, titel: big.textContent || '', auftrag: p.textContent || '' };
      }
      return null;
    }
    if (fam === 'qt') {   // Studium-Labs sig und prj: <div class="card pl"><h3|h4>Aufgabe · Block</h3><div class="big">Titel</div> ... <p|div class="qtext">Auftrag</p>
      cards = doc.querySelectorAll('#taskView .card.pl');
      for (i = 0; i < cards.length; i++) {
        c = cards[i]; h = c.querySelector(':scope > h3, :scope > h4'); big = c.querySelector(':scope > .big'); p = c.querySelector(':scope > .qtext');
        if (!h || !big || !p || !/^Aufgabe/.test(h.textContent || '') || !sichtbar(c) || !sichtbar(p)) continue;
        return { card: c, anchor: p, titel: big.textContent || '', auftrag: p.textContent || '' };
      }
      return null;
    }
    if (fam === 'rg2') {   // Regelungstechnik Aufbau: <div class="card pl"><button data-act="tkb"> <h4>rg2-01 Titel</h4> <div class="lv"> <p>Auftrag</p> ...  (die Kennung vor dem Titel gehoert nicht zum Titel)
      cards = doc.querySelectorAll('.card.pl');
      for (i = 0; i < cards.length; i++) {
        c = cards[i]; h = c.querySelector(':scope > h4'); p = c.querySelector(':scope > p');
        if (!h || !p || !c.querySelector(':scope > [data-act="tkb"]') || !sichtbar(c) || !sichtbar(p)) continue;
        return { card: c, anchor: p, titel: (h.textContent || '').replace(/^\S+\s+/, ''), auftrag: p.textContent || '' };
      }
      return null;
    }
    if (fam === 'emb') {   // Embedded vertieft: <details class="task" open><summary><span class="t">01 · Titel</span> ...</summary><div class="tb"><p>Auftrag</p> ... (erste geoeffnete Karte)
      cards = doc.querySelectorAll('details.task[open]');
      for (i = 0; i < cards.length; i++) {
        c = cards[i]; big = c.querySelector(':scope > summary .t'); p = c.querySelector(':scope > .tb > p');
        if (!big || !p || !sichtbar(c) || !sichtbar(p)) continue;
        return { card: c, anchor: p, titel: (big.textContent || '').replace(/^[^·]*·\s*/, ''), auftrag: p.textContent || '' };
      }
      return null;
    }
    if (fam === 'app') {   // App-Werkstatt: <div class="card"><button id="tBack"> <h2>Titel</h2><p>Auftrag</p> ...
      var back = doc.getElementById('tBack'); c = back && back.parentNode; if (!c) return null;
      big = c.querySelector(':scope > h2'); p = c.querySelector(':scope > p');
      if (!big || !p || !sichtbar(c) || !sichtbar(p)) return null;
      return { card: c, anchor: p, titel: big.textContent || '', auftrag: p.textContent || '' };
    }
    cards = doc.querySelectorAll('#taskView .card.pl, #v_tasks .card.pl');
    for (i = 0; i < cards.length; i++) {
      c = cards[i]; h = c.querySelector(':scope > h4'); big = c.querySelector(':scope > .big');
      if (!h || !big || !/^Aufgabe/.test(h.textContent || '')) continue;
      if (!c.offsetParent && c.getClientRects().length === 0) continue;   // nicht sichtbar
      p = c.querySelector(':scope > p:not(.hint2):not(.hint)') || c.querySelector(':scope > #tkQ > p.qt') || c.querySelector(':scope > [data-ctx="task"] > p');
      if (!p) continue;
      return { card: c, anchor: p, titel: big.textContent || '', auftrag: p.textContent || '' };
    }
    return null;
  }
  function index() {
    var A = root.SpeakAudio; if (!A) return null;
    if (idxFuer === A && idx) return idx;
    idx = {}; idxFuer = A;
    var pre = 'AU_' + lab + '_', ks = Object.keys(A);
    for (var i = 0; i < ks.length; i++) if (ks[i].indexOf(pre) === 0 && A[ks[i]] && A[ks[i]].h) idx[A[ks[i]].h] = ks[i];
    return idx;
  }
  function weg() {
    if (!cur) return;
    try { if (root.Vorlesen && root.Vorlesen.aktiv && root.Vorlesen.aktiv() === cur.btn) root.Vorlesen.stop(); } catch (e) {}
    try { if (cur.wrap.parentNode) cur.wrap.parentNode.removeChild(cur.wrap); } catch (e) {}
    cur = null;
  }
  function beschrifte(b) { b.setAttribute('aria-label', b.getAttribute('aria-pressed') === 'true' ? 'Vorlesen stoppen' : 'Aufgabe vorlesen'); }

  function sync() {
    raf = 0;
    try {
      var c = finde();
      if (!c) { weg(); return; }
      var V = root.Vorlesen; if (!V || !V.knopf || !V.Texte) return;
      if (!vorgeladen) { vorgeladen = true; try { V.vorladen(doc); } catch (e) {} }   // speak.js und sprache/index.js erst jetzt, wenn eine Aufgabenkarte da ist
      var ix = index();
      if (!ix) { if (warte++ < 40) setTimeout(plane, 300); return; }
      var basis = V.Texte.au(c.titel, c.auftrag), key = basis ? ix[V.Texte.hash(basis)] : '';
      if (!key) { weg(); return; }
      if (cur && cur.key !== key) weg();   // Aufgabenwechsel: stoppen und neu aufbauen
      if (!cur) {
        css();
        var wrap = doc.createElement('div'); wrap.className = 'vl-wrap au-wrap'; wrap.setAttribute('data-key', key);
        var b = V.knopf(doc, key, basis, { nurAufnahme: true, vorladen: false, cls: 'au-btn' });
        beschrifte(b);
        try { new MutationObserver(function () { beschrifte(b); }).observe(b, { attributes: true, attributeFilter: ['aria-pressed'] }); } catch (e) {}
        wrap.appendChild(b); cur = { key: key, wrap: wrap, btn: b };
      }
      if (cur.wrap.previousElementSibling !== c.anchor || cur.wrap.parentNode !== c.anchor.parentNode) c.anchor.parentNode.insertBefore(cur.wrap, c.anchor.nextSibling);
    } catch (e) {}
  }
  function plane() { if (!raf) raf = (root.requestAnimationFrame || root.setTimeout)(sync, 16); }

  function start() {
    if (!root.Vorlesen) {   // vorlesen.js (Texte + Knopf) erst bei Bedarf nachladen
      try { var s = doc.createElement('script'); s.src = 'vorlesen.js'; s.async = true; s.onload = plane; doc.head.appendChild(s); } catch (e) {}
    }
    try {
      obs = new MutationObserver(function (ms) {
        for (var i = 0; i < ms.length; i++) { var t = ms[i].target; if (t && t.closest && t.closest('.au-wrap')) continue; plane(); return; }
      });
      obs.observe(doc.body, { childList: true, subtree: true, characterData: true });
    } catch (e) {}
    plane();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
})(typeof window !== 'undefined' ? window : globalThis);
