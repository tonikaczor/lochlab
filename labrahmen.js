/* labrahmen.js - gemeinsamer Lab-Rahmen (Vorschlag A "Reiterband" plus feste Grafik am Handy). Vorgabe: quelle/audit/UMSETZUNG.md Abschnitt 4,
   Anleitung für weitere Labs: quelle/audit/umsetzung/RAHMEN-ANLEITUNG.md. Einbinden: <link rel="stylesheet" href="labrahmen.css"> nach den
   vorhandenen Stylesheets, <script src="labrahmen.js"></script> nach tutorial.js.
   Die Schicht legt sich über das vorhandene Markup (header, nav#tabs, #mid, #pal) und ersetzt keine Logik der Labs:
   - 4.1 Kopfzeile: "‹ Start" (#bHome), Name des Labs, Werkzeuge, Info-Knopf, Menü. Doppelte Knöpfe verschwinden, übrige wandern ins Menü.
   - 4.2 Reiterband (.lr-band): eigenes Band neben dem versteckten #tabs. Ein Klick löst den vorhandenen Reiter-Knopf des Labs aus.
         Zeichnet ein Lab #tabs neu, liest ein MutationObserver auf #tabs den Stand neu; das Band liegt außerhalb von #tabs, also keine Schleife.
   - 4.3 Info-Knopf: "Warum brauche ich das?" (#wzHint), Projekt-Hinweis (#vbHint), Simulationshinweis (#simBand), "Neu hier?" (#trOffer), Tour.
   - 4.4 feste Grafik am Handy (data-lr-buehne), Reihenfolge der Prüfstand-Labs, untere Leiste mit höchstens drei Knöpfen.
   - 4.5 gemeinsame Teile: Klassen lr-fb ok|tipp|loes (labrahmen.css), LabRahmen.zeig(el).
   Neuer Speicher: lm4.lr.teil = {"<datei>":{"ueben":"Trainer",...}} (zuletzt gewählter Teil je Gruppe). Alles in try/catch. */
(function (root) {
  'use strict';
  var doc = root.document;
  if (!doc || root.LabRahmen) return;
  if (/[?&]lr=aus\b/.test(String(root.location.search || ''))) return;   // Vergleich ohne Rahmen: ?lr=aus
  var FILE = String(root.location.pathname || '').split('/').pop() || '';

  /* ------------------------------------------------------------------ Tabelle je Lab (Schlüssel = Dateiname). Format: RAHMEN-ANLEITUNG.md */
  var PNE_MODE = 'lm4.pne.mode';
  var TAB = {
    'werlab.html': {
      saetze: { 'Prüfung': 'Wie in der Prüfung: Jeder Tipp kostet 25 % der Punkte.' },
      leiste: { weg: ['[data-a=exam]', '[data-a=rand]'] }
    },
    'pnelab.html': {
      gruppe: { rech: 'thema' },
      saetze: { 'Prüfung': 'Wie in der Prüfung: Jeder Tipp kostet Punkte.' },
      pruefung: {
        ist: function () { try { return localStorage.getItem(PNE_MODE) === 'pruef'; } catch (e) { return false; } },
        an: function () { pneModus('pruef'); },
        aus: function () { pneModus('ueben'); }
      },
      leiste: { haupt: ['[data-p=chk]', '[data-p=run]', '[data-p=reset]'] }
    },
    /* buehneMax 48dvh: das Schaltbild im Prüfstand (anarig-diode.js, schmale Aufteilung 40/32/28 %) braucht rund 385 px Bildhöhe, sonst zeichnet es nur den Platzhalter */
    'analab.html': { gruppen: [{ name: 'Diagramme', teile: ['wave', 'curve'] }], buehneMax: '48dvh' },
    'ntslab.html': { gruppen: [{ name: 'Diagramme', teile: ['wave', 'curve'] }] },
    'simlab.html': { flaeche: 'Schaltung', leiste: false }
  };
  function pneModus(m) {
    var b = doc.getElementById('bTasks'); if (b) b.click();
    var s = doc.querySelector('#taskView .modebar [data-m="' + m + '"]'); if (s) s.click();
  }

  /* Vorgaben, wenn die Tabelle nichts sagt */
  var SATZ = {
    'Aufgaben': 'Feste Aufgaben mit Tipp und zweitem Versuch.',
    'Trainer': 'Endlos neue Zufallsaufgaben zum selben Thema.',
    'Prüfung': 'Wie in der Prüfung: kein Tipp, die Lösung kommt erst am Ende.'
  };
  var IM_MENUE = ['bEx', 'bOpen', 'bShare', 'bPrint', 'bCab', 'bTasks', 'bHelp', 'bExam'];   // diese Kopfzeilenknöpfe haben in den Menüs der Labs schon eine Zeile
  var WERKZEUG = ['bRun', 'bUndo', 'bRedo', 'bSim', 'bWater', 'bMenu', 'bHome'];

  /* Einträge je Lab dürfen auch im Lab selbst stehen: <script>window.LR_TAB = { 'xlab.html': {...} }</script> vor labrahmen.js (hat Vorrang) */
  if (root.LR_TAB) { for (var lrk in root.LR_TAB) if (Object.prototype.hasOwnProperty.call(root.LR_TAB, lrk)) TAB[lrk] = root.LR_TAB[lrk]; }
  var T = TAB[FILE] || {};
  var $ = function (s, r) { return (r || doc).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  var mk = function (tag, cls, txt) { var e = doc.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  var reduced = function () { try { return root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  function sicht(el) { if (!el || !el.getClientRects || !el.getClientRects().length) return false; var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }
  function lsJson(k) { try { var o = JSON.parse(localStorage.getItem(k) || 'null'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (e) { return {}; } }
  function lsPut(k, o) { try { localStorage.setItem(k, JSON.stringify(o)); } catch (e) {} }
  var EMOJI = /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{2460}-\u{24FF}\u{25A0}-\u{27BF}\u{2900}-\u{297F}\u{2B00}-\u{2BFF}\u{3030}\u{303D}\u{FE0F}\u{200D}\u{20E3}]/gu;
  function sauber(t) { return String(t || '').replace(EMOJI, '').replace(/\s+/g, ' ').trim(); }

  /* ------------------------------------------------------------------ Lab-Name */
  function labName() {
    if (T.name) return T.name;
    var m = $('meta[name="apple-mobile-web-app-title"]'); if (m && m.content) return sauber(m.content);
    var g = $('script[data-title]'); if (g) return sauber(g.getAttribute('data-title').replace(/^Tonfunk\s+/, ''));
    return sauber(String(doc.title || '').split(':')[0].replace(/^Tonfunk\s+/, '')) || 'Lab';
  }

  /* ------------------------------------------------------------------ Zustand */
  var S = { band: null, teile: null, info: null, blatt: null, name: null, sig: '', sel: '', mehr: null, hdr: null, app: null, tabs: null, engine: false };

  /* ------------------------------------------------------------------ 4.1 Kopfzeile */
  function kopf() {
    var h = S.hdr, home = doc.getElementById('bHome');
    if (home && !home.querySelector('.lr-pf')) {
      home.innerHTML = '<span class="lr-pf" aria-hidden="true">‹</span>Start';
      home.setAttribute('aria-label', 'Zur Startseite'); home.removeAttribute('title');
      if (home.tagName === 'A' && !home.getAttribute('href')) home.setAttribute('href', 'index.html');
    }
    if (!S.name) {
      var n = mk('div', 'lr-name'), lab = mk('span', 'lr-lab', labName()), sub = mk('button', 'lr-sub');
      sub.type = 'button';
      sub.addEventListener('click', function () { var t = doc.getElementById('title'); if (t) t.click(); });
      n.appendChild(lab); n.appendChild(sub); S.name = n;
      var t0 = doc.getElementById('title');
      if (t0 && t0.parentNode === h) h.insertBefore(n, t0.nextSibling); else h.appendChild(n);
      if (t0 && root.MutationObserver) new MutationObserver(titel).observe(t0, { childList: true, characterData: true, subtree: true });
    }
    if (!S.info) {
      var b = mk('button', 'lr-info'); b.type = 'button'; b.id = 'lrInfo';
      b.setAttribute('aria-label', 'Hinweise zum Lab'); b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-controls', 'lrBlatt');
      b.innerHTML = '<span class="lr-ci" aria-hidden="true">i</span>';
      b.addEventListener('click', function (e) { e.stopPropagation(); infoUmschalten(); });
      h.appendChild(b); S.info = b;
    }
    titel();
  }
  function titel() {
    if (!S.name) return;
    var t = doc.getElementById('title'), lab = labName(), sub = '';
    if (t) {
      var teile = String(t.innerText || t.textContent || '').split(/\n|·/).map(sauber).filter(Boolean);
      var reiter = $$('#tabs button').map(function (b) { return labelVon(b); });
      sub = teile.filter(function (x) { return x !== lab && x !== 'Neuer Versuch' && x.replace(/\s*•$/, '') !== 'Neuer Versuch' && reiter.indexOf(x) < 0; }).join(' · ');
    }
    var el = S.name.querySelector('.lr-sub');
    if (el.textContent !== sub) el.textContent = sub;
    S.name.classList.toggle('lr-hat-sub', !!sub);   /* uifix63186 */
    el.setAttribute('aria-label', sub ? 'Versuch: ' + sub : '');
  }
  /* Kopfzeilenknöpfe, die unter 1100 px verschwinden und im Menü der Labs noch fehlen, bekommen dort eine Zeile */
  function menueErgaenzen(bd) {
    try {
      var kopfB = $('.sh-h b', bd); if (!kopfB || !/^Menü$/.test(kopfB.textContent.trim())) return;
      if (root.innerWidth >= 1100) return;
      var body = $('.sh-b', bd); if (!body || body.querySelector('.lr-row')) return;
      var bekannt = IM_MENUE.concat(T.kopfMenue || []);
      $$('#app>header>.hb, #app>header>.hb2').forEach(function (b) {
        if (bekannt.indexOf(b.id) >= 0 || b.style.display === 'none') return;
        var name = sauber(b.getAttribute('aria-label') || b.textContent); if (!name) return;
        var r = mk('button', 'row lr-row'); r.type = 'button';
        r.innerHTML = '<div class="grow"><b></b><small>Aus der Kopfzeile</small></div>';
        r.querySelector('b').textContent = name;
        r.addEventListener('click', function (e) { e.stopPropagation(); var x = $('.x', bd); if (x) x.click(); else if (bd.parentNode) bd.parentNode.removeChild(bd); setTimeout(function () { b.click(); }, 0); });
        body.insertBefore(r, body.firstChild);
      });
    } catch (e) {}
  }
  /* Zeile im Menü des Labs auslösen (für Labs ohne Reiter): öffnet das Menü und tippt die Zeile data-m an; fehlt sie, schließt es das Menü wieder */
  function menue(m) {
    var bm = doc.getElementById('bMenu'); if (!bm) return false;
    bm.click();
    var bds = $$('.backdrop'), bd = bds[bds.length - 1]; if (!bd) return false;
    var r = bd.querySelector('.row[data-m="' + m + '"]');
    if (r) { r.click(); return true; }
    var x = $('.x', bd); if (x) x.click();
    return false;
  }

  /* ------------------------------------------------------------------ 4.2 Reiterband */
  function labelVon(b) {
    var c = b.cloneNode(true);
    $$('.bd,.badge,small,.cnt', c).forEach(function (x) { x.parentNode.removeChild(x); });
    return sauber(c.textContent).replace(/\s*\d+\s*\/\s*\d+\s*$/, '');
  }
  function zaehler(b) { var m = /(\d+)\s*\/\s*(\d+)/.exec(b.textContent || ''); return m ? m[1] + '/' + m[2] : ''; }
  function keyVon(b, i) { return b.getAttribute('data-t') || b.getAttribute('data-tab') || b.getAttribute('data-k') || ('#' + i); }
  function gewaehlt(b) { return b.classList.contains('on') || b.classList.contains('active') || b.getAttribute('aria-selected') === 'true'; }
  function autoGruppe(k, l) {
    if (/^(tasks?|aufg|aufgaben|quiz|rt|trn|trainer|train|pruef|exam|test|uebung|ueben)$/i.test(k) || /^(aufgaben?|trainer|zufallstrainer|zufallsaufgaben?|prüfung|prüfmodus|prüfen|quiz|übungen|übung|üben|test)\b/i.test(l)) return 'ueben';
    if (/^(help|hilfe|lern|lernen|learn|bsp|beispiele|wissen)$/i.test(k) || /^(hilfe|lernen|beispiele|wissen|spickzettel|grundlagen)\b/i.test(l)) return 'hilfe';
    return 'thema';
  }
  function teilName(k, l) {
    if (/^(tasks?|aufg|aufgaben)$/i.test(k) || /^aufgabe/i.test(l)) return 'Aufgaben';
    if (/^(rt|trn|trainer|train)$/i.test(k) || /trainer|zufall/i.test(l)) return 'Trainer';
    if (/^(pruef|exam|test)$/i.test(k) || /^prüf(ung|modus|en)/i.test(l)) return 'Prüfung';
    if (/^bsp$/i.test(k) || /^beispiel/i.test(l)) return 'Beispiele';
    return l;
  }
  function pruefung() {
    if (T.pruefung === false) return null;
    if (T.pruefung) return T.pruefung;
    var b = doc.getElementById('bExam'); if (!b) return null;
    var ist = function () { return b.getAttribute('aria-pressed') === 'true' || b.classList.contains('on'); };
    return { ist: ist, an: function () { if (!ist()) b.click(); }, aus: function () { if (ist()) b.click(); } };
  }
  /* Modell des Bands aus den vorhandenen Reitern lesen */
  function modell() {
    var items = [], ueben = { key: 'ueben', label: 'Üben', gruppe: 'ueben', teile: [], small: '' }, hilfe = { key: 'hilfe', label: 'Hilfe', gruppe: 'hilfe', teile: [], small: '' };
    var combos = (T.gruppen || []).map(function (g) { return { key: 'g:' + g.name, label: g.name, gruppe: 'thema', teile: [], keys: g.teile }; });
    var btns = S.tabs ? $$('button,[role=tab]', S.tabs).filter(function (b) { return b.parentNode && b.closest('#tabs') === S.tabs && !b.closest('.lr-band'); }) : [];
    btns = btns.filter(function (b, i) { return btns.indexOf(b) === i && b.style.display !== 'none' && !b.hidden; });
    var tasksBtn = null;
    btns.forEach(function (b, i) {
      var k = keyVon(b, i), l = labelVon(b), g = (T.gruppe && T.gruppe[k]) || autoGruppe(k, l);
      var teil = { key: k, label: (T.teil && T.teil[k]) || teilName(k, l), btn: b, sel: gewaehlt(b) };
      if (g === 'ueben') { ueben.teile.push(teil); var z = zaehler(b); if (z && !ueben.small) ueben.small = z; if (teil.label === 'Aufgaben' && !tasksBtn) tasksBtn = teil; }
      else if (g === 'hilfe') hilfe.teile.push(teil);
      else {
        var c = combos.filter(function (x) { return x.keys.indexOf(k) >= 0; })[0];
        if (c) { if (!c.teile.length) items.push(c); c.teile.push(teil); }
        else items.push({ key: k, label: l, gruppe: 'thema', teile: [teil], small: '' });
      }
    });
    /* Labs ohne Reiter (Zeichen-Labs): Arbeitsfläche plus Aufgaben und Hilfe als Aktionen */
    if (!btns.length) {
      items.push({ key: 'flaeche', label: T.flaeche || 'Zeichnen', gruppe: 'thema', teile: [{ key: 'flaeche', label: T.flaeche || 'Zeichnen', sel: true }] });
      var bt = doc.getElementById('bTasks');
      ueben.teile.push({ key: 'tasks', label: 'Aufgaben', aktion: function () { if (bt && bt.style.display !== 'none') bt.click(); else menue('tasks'); } });
      hilfe.teile.push({ key: 'help', label: 'Hilfe', aktion: function () { menue('help'); } });
    }
    /* Prüfmodus als Schalter: Teil "Prüfung" neben "Aufgaben" */
    var P = pruefung();
    if (P && tasksBtn && !ueben.teile.some(function (t) { return t.label === 'Prüfung'; })) {
      var on = false; try { on = !!P.ist(); } catch (e) {}
      if (tasksBtn.sel && on) { tasksBtn.sel = false; }
      var pt = { key: 'pruef', label: 'Prüfung', btn: tasksBtn.btn, pruef: true, sel: !!(tasksBtn.btn && gewaehlt(tasksBtn.btn) && on) };
      ueben.teile.push(pt);
    }
    /* Beispiele als Sheet (#bEx) gehören zur Hilfe, wenn es keinen Beispiel-Reiter gibt */
    var bex = doc.getElementById('bEx');
    if (bex && btns.length && !hilfe.teile.concat(items).some(function (t) { return t.label === 'Beispiele'; })) hilfe.teile.push({ key: 'bex', label: 'Beispiele', aktion: function () { bex.click(); } });
    (T.extra || []).forEach(function (x) {
      var tgt = x.gruppe === 'ueben' ? ueben : hilfe;
      tgt.teile.push({ key: 'x:' + x.name, label: x.name, aktion: function () { if (x.knopf) { var e = $(x.knopf); if (e) e.click(); } else if (x.menue) menue(x.menue); else if (typeof x.tu === 'function') x.tu(); } });
    });
    /* feste Reihenfolge der Teile: Aufgaben, Trainer, Prüfung, dann übrige; Hilfe: Hilfe oder Lernen zuerst, Beispiele danach */
    var RANG = { 'Aufgaben': 1, 'Trainer': 2, 'Prüfung': 3, 'Hilfe': 1, 'Lernen': 1, 'Beispiele': 5 };
    [ueben, hilfe].forEach(function (g) { g.teile = g.teile.map(function (t, i) { return [t, i]; }).sort(function (a, b) { return ((RANG[a[0].label] || 4) - (RANG[b[0].label] || 4)) || (a[1] - b[1]); }).map(function (x) { return x[0]; }); });
    if (ueben.teile.length) items.push(ueben);
    if (hilfe.teile.length) items.push(hilfe);
    items.forEach(function (it) { it.sel = it.teile.some(function (t) { return t.sel; }); });
    return items;
  }
  function teilMerken(g, label) { var o = lsJson('lm4.lr.teil'); var f = o[FILE] && typeof o[FILE] === 'object' ? o[FILE] : {}; f[g] = label; o[FILE] = f; lsPut('lm4.lr.teil', o); }
  function teilGemerkt(g) { var o = lsJson('lm4.lr.teil'); return o[FILE] && o[FILE][g]; }
  function teilWaehlen(it, t) {
    if (!t) return;
    if (t.aktion) { schliessen(); t.aktion(); return; }
    if (it.teile.length > 1 && it.gruppe !== 'thema') teilMerken(it.key, t.label);
    var P = pruefung();
    if (t.btn && !gewaehlt(t.btn)) t.btn.click();
    if (P && t.label === 'Aufgaben') { try { if (P.ist()) P.aus(); } catch (e) {} }
    if (P && t.pruef) { try { if (!P.ist()) P.an(); } catch (e) {} }
    soon();
  }
  function itemKlick(it) {
    schliessen();
    if (it.sel && it.teile.length === 1) return;
    if (it.sel) return;   // Gruppe schon offen: der Umschalter wählt den Teil
    var views = it.teile.filter(function (t) { return !t.aktion; });
    if (!views.length) { teilWaehlen(it, it.teile[0]); return; }
    var m = teilGemerkt(it.key), t = views.filter(function (x) { return x.label === m; })[0] || views[0];
    teilWaehlen(it, t);
  }
  function bandZeichnen(items) {
    var b = S.band, sig = items.map(function (it) { return it.key + '|' + it.label + '|' + (it.small || ''); }).join('§');
    if (sig !== S.sig) {
      S.sig = sig; b.innerHTML = '';
      items.forEach(function (it) {
        var x = mk('button'); x.type = 'button'; x.setAttribute('role', 'tab');
        x.setAttribute('data-lr-gruppe', it.gruppe === 'thema' ? it.key : it.gruppe);
        if (it.teile.length === 1 && it.teile[0].key) x.setAttribute('data-lr-t', it.teile[0].key);
        x.appendChild(doc.createTextNode(it.label));
        if (it.small) { var s = mk('small', '', it.small); s.setAttribute('aria-label', it.small.replace('/', ' von ') + ' gelöst'); x.appendChild(s); }
        x.addEventListener('click', function () { itemKlick(S.items.filter(function (y) { return y.key === it.key; })[0] || it); });
        b.appendChild(x);
      });
    }
    var selKey = '';
    items.forEach(function (it, i) { var on = !!it.sel; b.children[i].setAttribute('aria-selected', on ? 'true' : 'false'); b.children[i].tabIndex = on ? 0 : -1; if (on) selKey = it.key; });
    if (!selKey && b.children.length && !items.some(function (x) { return x.sel; })) { /* nichts gewählt: erster Reiter bleibt fokussierbar */ b.children[0].tabIndex = 0; }
    if (selKey !== S.sel) { var first = !S.sel; S.sel = selKey; mitte(first); }
    rand();
  }
  /* gewählten Reiter in die Mitte des Bands holen (nur das Band rollt, nicht die Seite) */
  function mitte(sofort) {
    var b = S.band, a = b && b.querySelector('[aria-selected="true"]'); if (!a || b.scrollWidth <= b.clientWidth + 1) { rand(); return; }
    var x = a.offsetLeft - (b.clientWidth - a.offsetWidth) / 2;
    try { b.scrollTo({ left: Math.max(0, x), behavior: sofort || reduced() ? 'auto' : 'smooth' }); } catch (e) { b.scrollLeft = Math.max(0, x); }
    setTimeout(rand, 350);
  }
  function rand() {
    var b = S.band; if (!b) return;
    var max = b.scrollWidth - b.clientWidth, sl = Math.abs(b.scrollLeft);
    b.classList.toggle('lr-ov-l', max > 4 && sl > 4); b.classList.toggle('lr-ov-r', max > 4 && sl < max - 4);
  }
  /* Umschalter unter dem Band (Gruppe mit mehreren Teilen) */
  function teileZeichnen(items) {
    var it = items.filter(function (x) { return x.sel && x.teile.length > 1; })[0], el = S.teile;
    if (!it) { if (el.parentNode) el.parentNode.removeChild(el); el.removeAttribute('data-sig'); return; }
    var selT = it.teile.filter(function (t) { return t.sel; })[0] || it.teile[0];
    var sig = it.key + '|' + it.teile.map(function (t) { return t.label + (t === selT ? '*' : ''); }).join(',');
    if (el.getAttribute('data-sig') !== sig) {
      el.setAttribute('data-sig', sig); el.innerHTML = '';
      var seg = mk('div', 'lr-seg'); seg.setAttribute('role', 'tablist'); seg.setAttribute('aria-label', it.gruppe === 'ueben' ? 'Art des Übens' : it.label);
      it.teile.forEach(function (t) {
        var x = mk('button', '', t.label); x.type = 'button'; x.setAttribute('role', 'tab'); x.setAttribute('aria-selected', t === selT ? 'true' : 'false');
        x.setAttribute('data-lr-teil', t.key);
        x.addEventListener('click', function () { var cur = (S.items || []).filter(function (y) { return y.key === it.key; })[0] || it; teilWaehlen(cur, cur.teile.filter(function (y) { return y.key === t.key; })[0] || t); });
        seg.appendChild(x);
      });
      el.appendChild(seg);
      var satz = it.gruppe === 'ueben' ? ((T.saetze && T.saetze[selT.label]) || SATZ[selT.label] || '') : ((T.saetze && T.saetze[selT.label]) || '');
      var p = mk('p', 'lr-satz', satz); el.appendChild(p);
    }
    /* an den Anfang der sichtbaren Seite (scrollt mit dem Inhalt, wie im Modell) */
    var pg = sichtbareSeite();
    if (pg && el.parentNode !== pg) pg.insertBefore(el, pg.firstChild);
    else if (pg && pg.firstChild !== el) pg.insertBefore(el, pg.firstChild);
  }
  function sichtbareSeite() {
    var mid = doc.getElementById('mid'); if (!mid) return null;
    for (var i = 0; i < mid.children.length; i++) { var c = mid.children[i]; if (c.classList.contains('pg') && sicht(c)) return c; }
    return null;
  }
  var raf = 0;
  function soon() { if (raf) return; raf = (root.requestAnimationFrame || setTimeout)(function () { raf = 0; aktualisieren(); }); }
  function aktualisieren() {
    if (!S.band) return;
    S.n = (S.n || 0) + 1;
    try {
      var items = modell(); S.items = items;
      if (!items.length) { S.band.hidden = true; doc.documentElement.classList.remove('lr-band-an'); return; }
      S.band.hidden = false; doc.documentElement.classList.add('lr-band-an');
      bandZeichnen(items); teileZeichnen(items); titel(); buehne();
    } catch (e) { if (root.console) console.warn('labrahmen:', e); }
  }
  /* Desktop: Band in die Kopfzeile, wenn es hineinpasst; sonst eigene Zeile */
  function platz() {
    var b = S.band, h = S.hdr; if (!b) return;
    var breit = root.innerWidth >= 1100;
    if (breit) {
      if (b.parentNode !== h) { h.insertBefore(b, S.name ? S.name.nextSibling : null); }
      b.classList.add('lr-im-kopf'); h.classList.add('lr-kopf-band');
      if (b.scrollWidth > b.clientWidth + 1 || h.scrollWidth > h.clientWidth + 1) { breit = false; }
    }
    if (!breit) {
      b.classList.remove('lr-im-kopf'); h.classList.remove('lr-kopf-band');
      if (b.parentNode !== S.app || b.previousElementSibling !== h) S.app.insertBefore(b, h.nextSibling);
    }
    S.sel = ''; mitte(true); rand(); blattLage(); rigOrdnen();
  }

  /* ------------------------------------------------------------------ 4.3 Info-Knopf und Blatt */
  function blattBauen() {
    var d = mk('div', 'lr-blatt'); d.id = 'lrBlatt'; d.hidden = true; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Hinweise zum Lab');
    var k = mk('div', 'lr-blatt-kopf'); k.appendChild(mk('b', '', 'Hinweise zu diesem Lab'));
    var x = mk('button', 'lr-blatt-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Hinweise schließen'); x.addEventListener('click', function () { schliessen(true); });
    k.appendChild(x); d.appendChild(k);
    ['lr-s-wz', 'lr-s-tr', 'lr-s-vb', 'lr-s-sim'].forEach(function (c) { var s = mk('div', c); d.appendChild(s); });
    var leer = mk('p', 'lr-blatt-leer', 'Zu diesem Lab gibt es keine weiteren Hinweise.'); d.appendChild(leer);
    var tour = mk('button', 'lr-zeile lr-tour'); tour.type = 'button'; tour.innerHTML = '<span>Tour zeigen</span><i aria-hidden="true">›</i>';
    tour.addEventListener('click', function () { schliessen(); setTimeout(function () { try { root.Tutorial.restart(); } catch (e) {} }, 0); });
    d.appendChild(tour);
    d.addEventListener('click', function (e) { e.stopPropagation(); });
    doc.body.appendChild(d); S.blatt = d;
  }
  function slot(c) { return S.blatt && S.blatt.querySelector('.' + c); }
  function einsammeln() {
    if (!S.blatt) return;
    var moved = false;
    var put = function (el, c) { var s = slot(c); if (el && s && el.parentNode !== s) { s.appendChild(el); moved = true; } };
    var wz = doc.getElementById('wzHint');
    if (wz && !wz.closest('.lr-blatt')) {
      put(wz, 'lr-s-wz');
      var tt = $('.wzTt', wz), body = $('.wzB', wz);
      if (tt && body && body.hidden) tt.click();   // im Blatt aufgeklappt (lädt auch "Vorlesen" wie beim Antippen)
    }
    put(doc.getElementById('vbHint'), 'lr-s-vb');
    var sb = doc.getElementById('simBand'); if (sb && !sb.closest('.lr-blatt')) put(sb, 'lr-s-sim');
    var tr = doc.getElementById('trOffer');
    if (tr && !tr.closest('.lr-blatt')) { put(tr, 'lr-s-tr'); if (S.info && S.blatt.hidden) S.info.classList.add('lr-neu'); }
    blattStand();
    return moved;
  }
  function blattStand() {
    if (!S.blatt) return;
    var sb = doc.getElementById('simBand');
    if (sb && sb.closest('.lr-blatt')) { var tx = doc.getElementById('simTx'); sb.classList.toggle('lr-leer', !(tx && sauber(tx.textContent))); }
    var hat = ['lr-s-wz', 'lr-s-tr', 'lr-s-vb', 'lr-s-sim'].some(function (c) { var s = slot(c); return s && s.firstElementChild && !s.firstElementChild.classList.contains('lr-leer'); });
    var tourOk = false; try { tourOk = !!(root.Tutorial && root.Tutorial.steps && root.Tutorial.steps()); } catch (e) {}
    S.blatt.querySelector('.lr-tour').hidden = !tourOk;
    S.blatt.querySelector('.lr-blatt-leer').hidden = hat;
    if (S.info && !(doc.getElementById('trOffer') && doc.getElementById('trOffer').closest('.lr-blatt'))) S.info.classList.remove('lr-neu');
  }
  /* "Warum brauche ich das?" wurde früher geschlossen (lm4.wz.zu): im Blatt trotzdem zeigen (Einordnung-API, Daten lädt einordnung.js) */
  function warumNachbauen() {
    try {
      if (doc.getElementById('wzHint')) return;
      var E = root.Einordnung, REG = root.LAB_REG; if (!E || !REG || !E.labVonDatei || !E.modell || !E.baue) return;
      var lab = E.labVonDatei(REG, FILE); if (!lab) return;
      var BR = root.BerufReg, beruf = 'egs'; try { if (BR && BR.cur) beruf = BR.cur() || 'egs'; } catch (e) {}
      var m = E.modell(lab, { beruf: beruf, AP: root.AusbildungsPlan, BR: BR }); if (!m) return;
      if (!doc.getElementById('wzCss') && E.zeige) { /* Stil von einordnung.js: entsteht beim ersten zeige(); ohne ihn reichen die Regeln des Blatts */ }
      var box = E.baue(doc, m, function () {}); slot('lr-s-wz').appendChild(box);
      var tt = $('.wzTt', box), body = $('.wzB', box); if (tt && body && body.hidden) tt.click();
    } catch (e) {}
  }
  function blattLage() {
    if (!S.blatt || !S.hdr) return;
    var r = S.hdr.getBoundingClientRect(), top = Math.max(0, Math.round(r.bottom)) + 6;
    S.blatt.style.top = top + 'px';
    S.blatt.style.maxHeight = 'calc(100vh - ' + (top + 12) + 'px)';
    if (root.innerWidth >= 700) { var ir = S.info.getBoundingClientRect(); S.blatt.style.right = Math.max(8, Math.round(root.innerWidth - ir.right)) + 'px'; } else S.blatt.style.right = '';
  }
  function infoUmschalten() { if (S.blatt.hidden) oeffnen(); else schliessen(true); }
  function oeffnen() {
    schliessen(); einsammeln(); warumNachbauen(); blattStand(); blattLage();
    S.blatt.hidden = false; S.info.setAttribute('aria-expanded', 'true'); S.info.classList.remove('lr-neu');
    try { S.blatt.querySelector('.lr-blatt-x').focus({ preventScroll: true }); } catch (e) {}
  }
  function schliessen(fokus) {
    if (S.blatt && !S.blatt.hidden) { S.blatt.hidden = true; S.info.setAttribute('aria-expanded', 'false'); if (fokus) try { S.info.focus({ preventScroll: true }); } catch (e) {} }
    if (S.mehr && !S.mehr.hidden) { S.mehr.hidden = true; var mk2 = $('#pal .lr-mehr-knopf'); if (mk2) mk2.setAttribute('aria-expanded', 'false'); }
  }

  /* ------------------------------------------------------------------ 4.4 feste Grafik am Handy */
  /* Prüfstand-Labs unter 700 px: Regler (#presetBar, #ctlHost) aus #rigSide direkt unter die Grafik in #rigMain holen, damit die feste Grafik
     beim Rollen durch die Regler stehen bleibt (sticky wirkt nur innerhalb des Elternelements). Ab 700 px zurück an die alte Stelle (Platzhalter). */
  var RIG_REGLER = ['presetBar', 'ctlHost'];
  function rigOrdnen() {
    var main = doc.getElementById('rigMain'); if (!main || !doc.documentElement.classList.contains('lr-rig')) return;
    var schmal = root.innerWidth < 700;
    (T.regler || RIG_REGLER).forEach(function (id) {
      var el = doc.getElementById(id); if (!el) return;
      if (schmal) {
        if (el.parentNode === main) return;
        if (!el.__lrPlatz) { el.__lrPlatz = doc.createComment('lr:' + id); el.parentNode.insertBefore(el.__lrPlatz, el); }
        main.appendChild(el);
      } else if (el.__lrPlatz && el.__lrPlatz.parentNode && el.parentNode === main) {
        el.__lrPlatz.parentNode.insertBefore(el, el.__lrPlatz);
      }
    });
  }
  /* Seitenverhältnis der Bühne als CSS-Variable --lr-ar (Breite/Höhe): die Grafik wird am Handy schmaler statt verzerrt, wenn sie 45 % der Höhe erreicht */
  function seitenVerh(el) {
    try {
      var a = root.getComputedStyle(el).aspectRatio || el.style.aspectRatio || '', m = /([\d.]+)\s*\/\s*([\d.]+)/.exec(a), v = 0;
      if (m && +m[2]) v = +m[1] / +m[2];
      else if (/^[\d.]+$/.test(a.trim())) v = +a;
      else if (el.viewBox && el.viewBox.baseVal && el.viewBox.baseVal.height) v = el.viewBox.baseVal.width / el.viewBox.baseVal.height;
      else { var r = el.getBoundingClientRect(); if (r.height) v = r.width / r.height; }
      if (v > 0.2 && v < 6) { var s = v.toFixed(3); if (el.style.getPropertyValue('--lr-ar') !== s) el.style.setProperty('--lr-ar', s); }
    } catch (e) {}
  }
  function buehnenVerh() { $$('[data-lr-buehne]').forEach(seitenVerh); }
  function buehne() {
    try { buehne0(); } catch (e) {}
    buehnenVerh();
    var b = doc.querySelector('[data-lr-buehne]');
    if (b && !b.__lrObs && root.MutationObserver) { b.__lrObs = new MutationObserver(function () { seitenVerh(b); }); b.__lrObs.observe(b, { attributes: true, attributeFilter: ['style', 'viewBox', 'width', 'height'] }); }
  }
  function buehne0() {
    {
      var tab = (doc.getElementById('mid') || {}).getAttribute ? doc.getElementById('mid').getAttribute('data-tab') : '';
      var B = T.buehne || {};
      var pg = sichtbareSeite(); if (!pg) return;
      if (pg.querySelector('[data-lr-buehne]:not([data-lr-buehne="auto"])')) return;
      var sel = tab && Object.prototype.hasOwnProperty.call(B, tab) ? B[tab] : (pg.id === 'pgRig' && pg.classList.contains('rigc') ? '#cvw' : true);
      if (sel === false) { $$('[data-lr-buehne]', pg).forEach(function (e) { e.removeAttribute('data-lr-buehne'); }); return; }
      if (typeof sel === 'string') { var e = $(sel, pg); if (e) e.setAttribute('data-lr-buehne', 'tab'); return; }
      /* Automatik (vorsichtig): direktes Kind von .wrap, das eine große Grafik ist oder nur aus ihr besteht, mit Reglern dahinter; höchstens 45 % der Höhe */
      if (pg.querySelector('[data-lr-buehne="auto"]') || root.innerWidth >= 700) return;
      var wrap = $('.wrap', pg); if (!wrap) return;
      var kids = Array.prototype.slice.call(wrap.children);
      for (var i = 0; i < kids.length; i++) {
        var k = kids[i], g = /^(CANVAS|svg)$/i.test(k.tagName) ? k : null;
        if (!g && k.children.length === 1 && /^(CANVAS|svg)$/i.test(k.firstElementChild.tagName)) g = k.firstElementChild;
        if (!g) continue;
        var r = k.getBoundingClientRect(); if (r.width < wrap.clientWidth * 0.6 || r.height < 120 || r.height > root.innerHeight * 0.45) continue;
        var danach = kids.slice(i + 1).some(function (n) { return n.querySelector && n.querySelector('input[type=range],input[type=number],select'); });
        if (danach) { k.setAttribute('data-lr-buehne', 'auto'); return; }
      }
    }
  }

  /* ------------------------------------------------------------------ 4.4 untere Leiste: am Handy höchstens drei Knöpfe */
  var PAL_DOPPELT = /^(Prüfmodus|Aufgaben|Hilfe|Trainer)\b/i;
  function leiste() {
    var pal = doc.getElementById('pal'); if (!pal || T.leiste === false || S.engine && !T.leiste) return;
    var L = T.leiste || {};
    var rig = doc.querySelector('#pgRig.rigc');
    var weg = (L.weg || []).concat(rig && !L.weg ? ['[data-a=run]'] : []);
    var haupt = L.haupt || (rig ? ['[data-a=fire]', '[data-a=reset]', '[data-a=chk]'] : []);
    var kids = Array.prototype.slice.call(pal.children).filter(function (c) { return !c.classList.contains('lr-mehr-knopf'); });
    var aktiv = [];
    kids.forEach(function (c) {
      c.classList.remove('lr-weg', 'lr-mehr-teil');
      var isBtn = c.matches('button,select,input,.seg,label');
      if (!isBtn) return;
      var w = weg.some(function (s) { try { return c.matches(s); } catch (e) { return false; } }) || (c.tagName === 'BUTTON' && PAL_DOPPELT.test(sauber(c.textContent)));
      if (w) { c.classList.add('lr-weg'); return; }
      if (c.style.display !== 'none' && !c.hidden) aktiv.push(c);
    });
    var rest = [];
    if (aktiv.length > 3) {
      var keep = [];
      haupt.forEach(function (s) { aktiv.forEach(function (c) { if (keep.length < 2 && keep.indexOf(c) < 0) { try { if (c.matches(s)) keep.push(c); } catch (e) {} } }); });
      aktiv.forEach(function (c) { if (keep.length < 2 && keep.indexOf(c) < 0) keep.push(c); });
      rest = aktiv.filter(function (c) { return keep.indexOf(c) < 0; });
      rest.forEach(function (c) { c.classList.add('lr-mehr-teil'); });
    }
    pal.classList.add('lr-pal'); pal.classList.toggle('lr-hat-mehr', rest.length > 0);
    var mb = $('.lr-mehr-knopf', pal);
    if (rest.length && !mb) {
      mb = mk('button', 'chip lr-mehr-knopf', 'Mehr …'); mb.type = 'button'; mb.setAttribute('aria-expanded', 'false'); mb.setAttribute('aria-haspopup', 'true');
      mb.addEventListener('click', function (e) { e.stopPropagation(); mehrUmschalten(mb); });
      pal.appendChild(mb);
    } else if (!rest.length && mb) mb.parentNode.removeChild(mb);
    if (S.mehr && !S.mehr.hidden) mehrFuellen();
  }
  function mehrUmschalten(mb) {
    if (!S.mehr) { S.mehr = mk('div', 'lr-mehr-blatt'); S.mehr.hidden = true; S.mehr.setAttribute('role', 'group'); S.mehr.setAttribute('aria-label', 'Weitere Knöpfe'); S.mehr.addEventListener('click', function (e) { e.stopPropagation(); }); doc.body.appendChild(S.mehr); }
    if (!S.mehr.hidden) { schliessen(); return; }
    schliessen(); mehrFuellen();
    var pal = doc.getElementById('pal'), r = pal.getBoundingClientRect();
    S.mehr.style.bottom = Math.round(root.innerHeight - r.top + 8) + 'px';
    S.mehr.hidden = false; mb.setAttribute('aria-expanded', 'true');
  }
  /* Stellvertreter der versteckten Knöpfe; ein Tipp löst den Knopf des Labs aus */
  function mehrFuellen() {
    var box = S.mehr; box.innerHTML = '';
    $$('#pal > .lr-mehr-teil').forEach(function (c) {
      var cl = c.cloneNode(true);
      cl.removeAttribute('id'); $$('[id]', cl).forEach(function (x) { x.removeAttribute('id'); });
      cl.classList.remove('lr-mehr-teil');
      var orig = c.matches('button') ? [c] : $$('button', c), kop = cl.matches('button') ? [cl] : $$('button', cl);
      kop.forEach(function (k, i) { k.addEventListener('click', function (e) { e.stopPropagation(); if (orig[i]) orig[i].click(); setTimeout(function () { leiste(); mehrFuellen(); }, 60); }); });
      box.appendChild(cl);
    });
    var stt = doc.getElementById('stat');
    if (stt && sauber(stt.textContent) && doc.getElementById('pal').classList.contains('lr-hat-mehr')) { var p = mk('p', 'lr-stat'); p.innerHTML = stt.innerHTML; box.appendChild(p); }
    if (!box.children.length) schliessen();
  }

  /* ------------------------------------------------------------------ 4.5 Rückmeldung ins Bild holen */
  function scroller(el) {
    for (var p = el.parentElement; p && p !== doc.body; p = p.parentElement) {
      var cs = root.getComputedStyle(p); if (/(auto|scroll)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight + 1) return p;
    }
    return null;
  }
  function zeig(el, opt) {
    try {
      if (typeof el === 'string') el = $(el);
      if (!el || !el.getBoundingClientRect) return false;
      var sc = scroller(el), top = 12;
      var st = sc ? sc.querySelector('[data-lr-buehne]') : null;
      if (st && root.getComputedStyle(st).position === 'sticky') top += st.getBoundingClientRect().height;
      el.style.scrollMarginTop = top + 'px'; el.style.scrollMarginBottom = '12px';
      el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
      if (el.classList.contains('lr-fb')) { el.classList.remove('lr-neu'); void el.offsetWidth; el.classList.add('lr-neu'); setTimeout(function () { el.classList.remove('lr-neu'); }, 1000); }
      if (opt && opt.fokus) { if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1'); try { el.focus({ preventScroll: true }); } catch (e) {} }
      return true;
    } catch (e) { return false; }
  }

  /* ------------------------------------------------------------------ uifix63186: Einheiten nicht in Versalien (B05)
     Tabellenkoepfe und Kartentitel der Metall-Labs sind per CSS in Versalien gesetzt: aus "µm" wird dann "ΜM" (griechisches Mu), aus "mm" "MM", aus "p + 1" "P + 1".
     Enthaelt so ein Element eine Einheit oder eine Formel, bekommt es text-transform:none. Nur in den 14 Metall-Labs; Elektronik-Labs bleiben unberuehrt. */
  var METALL_LABS = ' fer tol zer wer fug mas mch mak cnc pne hyd ins zei kon ';
  function metallLab() { var m = /^([a-z]+)lab\.html$/.exec(FILE); return !!m && METALL_LABS.indexOf(' ' + m[1] + ' ') >= 0; }
  var EINHEIT = /[\u00B5\u03BC]|(^|[^A-Za-z\u00C4\u00D6\u00DC\u00E4\u00F6\u00FC\u00DF])(m{1,2}|cm|dm|km|kg|kN|kW|kHz|MPa|kPa|bar|min|ml)(?![A-Za-z\u00C4\u00D6\u00DC\u00E4\u00F6\u00FC\u00DF])|[=\u00B7]|\(\s*[a-z]\s*[+\-\u2212\u00B7*\/=]/;
  function versalien() {
    try {
      $$('th, h3, h4, h5, summary, .lbl, .gh').forEach(function (e) {
        if (e.style.textTransform === 'none') return;
        if (!EINHEIT.test(e.textContent || '')) return;
        if (root.getComputedStyle(e).textTransform === 'uppercase') e.style.textTransform = 'none';
      });
    } catch (err) {}
  }
  function versalienStart() {
    if (!metallLab()) return;
    versalien();
    if (!root.MutationObserver) return;
    var tv = 0, soonV = function () { clearTimeout(tv); tv = setTimeout(versalien, 120); };
    var mid = doc.getElementById('mid'); if (mid) new MutationObserver(soonV).observe(mid, { childList: true, subtree: true });
    new MutationObserver(soonV).observe(doc.body, { childList: true });
  }

  /* ------------------------------------------------------------------ Start */
  /* v63.189 Abzeichen in jedem Lab: Labs ohne eigenes badges.js laden auswertung.js, badges.js und kampagne.js nach (wie matnotiz.js).
     Danach zählt der Trainer-Stand nach (wie trainer.js finish), alle Abzeichen werden geprüft und bei jeder Änderung von sim.done oder lm4.tdone wieder. */
  function abzeichen() {
    if (root.Badges) return;
    var liste = ['auswertung.js', 'badges.js', 'kampagne.js'].filter(function (f) { return !(f === 'auswertung.js' && root.Auswertung) && !(f === 'kampagne.js' && root.Kampagne); });
    (function lade() {
      var f = liste.shift(); if (!f) return fertig();
      var sc = doc.createElement('script'); sc.src = f; sc.onload = lade; doc.head.appendChild(sc);
    })();
    function fertig() {
      var B = root.Badges, tr = {}; if (!B) return;
      try { tr = JSON.parse(localStorage.getItem('lm4.trainer') || '{}') || {}; } catch (e) { tr = {}; }
      B.stat('trainer', Object.keys(tr).filter(function (k) { return !((root.LAB_REG || {})[k] || {}).hub; }).length, 'max');
      var P = root.Storage && root.Storage.prototype, orig = P && P.setItem, t = 0; if (!orig) return;
      P.setItem = function (k) { var r = orig.apply(this, arguments); if (k === 'sim.done' || k === 'lm4.tdone') { clearTimeout(t); t = setTimeout(B.check, 300); } return r; };
    }
  }
  function start() {
    try { abzeichen(); } catch (e) {}
    S.app = doc.getElementById('app'); S.hdr = S.app && S.app.querySelector(':scope > header');
    if (!S.app || !S.hdr) return;   // kein Lab-Gerüst: nichts tun
    doc.documentElement.classList.add('lr-on');
    /* uifix63186: Kennung des Labs (data-lr-lab="zerlab.html") und Klasse lr-metall fuer die 14 Metall-Labs; nur Selektoren fuer CSS-Regeln */
    doc.documentElement.setAttribute('data-lr-lab', FILE);
    if (metallLab()) doc.documentElement.classList.add('lr-metall');
    S.tabs = doc.getElementById('tabs');
    S.engine = !S.tabs && !!(doc.getElementById('parts') && doc.getElementById('cv'));
    if (doc.querySelector('#pgRig.rigc')) doc.documentElement.classList.add('lr-rig');
    if (T.buehneMax) doc.documentElement.style.setProperty('--lr-buehne-max', T.buehneMax);
    kopf();
    /* Band */
    S.band = mk('nav', 'lr-band'); S.band.setAttribute('role', 'tablist'); S.band.setAttribute('aria-label', 'Ansichten');
    S.band.addEventListener('scroll', rand, { passive: true });
    S.band.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var bs = Array.prototype.slice.call(S.band.children), i = bs.indexOf(doc.activeElement); if (i < 0) return;
      var n = bs[(i + (e.key === 'ArrowRight' ? 1 : bs.length - 1)) % bs.length]; if (n) { e.preventDefault(); n.focus(); }
    });
    S.app.insertBefore(S.band, S.hdr.nextSibling);
    S.teile = mk('div', 'lr-teile');
    blattBauen();
    if (S.tabs || S.engine) aktualisieren(); else { S.band.hidden = true; }
    platz();
    einsammeln();
    leiste();
    /* Beobachter: Reiter (Neuzeichnen, Zähler, Auswahl), Prüfmodus-Schalter, Seiteninhalt (feste Grafik), Hinweise, Leiste, Menü */
    if (root.MutationObserver) {
      if (S.tabs) new MutationObserver(soon).observe(S.tabs, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'aria-selected', 'style', 'hidden'] });
      var bx = doc.getElementById('bExam'); if (bx) new MutationObserver(soon).observe(bx, { attributes: true, attributeFilter: ['class', 'aria-pressed'] });
      var mid = doc.getElementById('mid');
      if (mid) { new MutationObserver(soon).observe(mid, { attributes: true, attributeFilter: ['data-tab'] }); var t2 = 0; new MutationObserver(function () { clearTimeout(t2); t2 = setTimeout(buehne, 120); }).observe(mid, { childList: true, subtree: true }); }
      new MutationObserver(function () { einsammeln(); }).observe(S.app, { childList: true });
      new MutationObserver(function (ms) {
        var neu = false;
        ms.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, function (n) { if (n.nodeType !== 1) return; if (n.id === 'trOffer') neu = true; if (n.classList.contains('backdrop')) { schliessen(); setTimeout(function () { menueErgaenzen(n); }, 0); } }); });
        if (neu) einsammeln();
      }).observe(doc.body, { childList: true });
      var pal = doc.getElementById('pal');
      if (pal) { var t3 = 0; new MutationObserver(function () { clearTimeout(t3); t3 = setTimeout(leiste, 30); }).observe(pal, { childList: true, attributes: true, attributeFilter: ['style'] }); }
      var st = doc.getElementById('simTx'); if (st) new MutationObserver(blattStand).observe(st, { childList: true, characterData: true, subtree: true });
    }
    doc.addEventListener('click', function (e) {
      if (S.blatt && !S.blatt.hidden && !S.blatt.contains(e.target) && e.target !== S.info && !S.info.contains(e.target)) schliessen();
      if (S.mehr && !S.mehr.hidden && !S.mehr.contains(e.target) && !(e.target.closest && e.target.closest('.lr-mehr-knopf'))) schliessen();
      setTimeout(soon, 60);
    }, true);
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && ((S.blatt && !S.blatt.hidden) || (S.mehr && !S.mehr.hidden))) { schliessen(true); } });
    var rz = 0; root.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { platz(); buehne(); }, 120); });
    root.addEventListener('orientationchange', function () { setTimeout(platz, 300); });
    setTimeout(function () { aktualisieren(); platz(); einsammeln(); leiste(); }, 600);
    setTimeout(function () { einsammeln(); buehne(); }, 2500);
    versalienStart();   /* uifix63186 */
    rechenhilfe();
  }

  /* Rechenhilfe (v63.187, Wunsch Toni 23.11.2026): Notizfeld und Taschenrechner aus dem Rechen-Duell (matnotiz.js) unter jeder Aufgabe mit Zahlen-Antwortfeld.
     Zahlenfeld = inputmode decimal/numeric oder type number im Aufgabenbereich; Parameterfelder von Simulation, Rechner-Reiter und Editor zählen nicht.
     Es gibt einen Kasten je Seite. Er hängt an der Aufgabenkarte, in der zuletzt ein Zahlenfeld den Fokus hatte (sonst an der ersten sichtbaren).
     Wechselt die Aufgabe (andere erste Überschrift der Karte, ohne Überschrift: anderer Kartenanfang), wird er neu gebaut: das Notizfeld ist wieder leer, wie im Duell. */
  var RH_FELD = 'input[inputmode=decimal],input[inputmode=numeric]';   /* type=number nur in Editor-Parameterfeldern (pcb), nie als Antwortfeld */
  var RH_BEREICH = '#pgTasks,#pg_tasks,#taskView,#v_tasks,#taskCard,#task-open,.taskcard,.card.task,details.task';
  function rechenhilfe() {
    var box = null, karte = null, schluessel = '', letztes = null, t = 0;
    function sichtbar(e) { return !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length); }
    function kartenText(k) { var h = k.querySelector('h1,h2,h3,h4,h5'); if (h && !(box && box.contains(h)) && h.textContent.trim()) return h.textContent.replace(/s+/g, ' ').trim(); var s = ''; for (var n = k.firstChild; n && s.length < 160; n = n.nextSibling) if (n !== box) s += n.textContent || ''; return s.replace(/\s+/g, ' ').slice(0, 160); }
    function ziel() { if (letztes && karte && karte.contains(letztes)) return letztes; var f = karte && karte.querySelectorAll(RH_FELD); return f && f.length === 1 ? f[0] : null; }   /* mehrere Felder und keins angetippt: nichts raten */
    function karteVon(f) { return f.closest('.mn') || !f.closest(RH_BEREICH) ? null : f.closest('.card,.qcard,details.task') || f.closest(RH_BEREICH); }
    function pruefen() {
      if (!root.MatNotiz) return;
      var k = letztes && doc.contains(letztes) && sichtbar(letztes) ? karteVon(letztes) : null;
      if (!k) { var a = doc.querySelectorAll(RH_FELD); for (var i = 0; i < a.length && !k; i++) if (sichtbar(a[i])) k = karteVon(a[i]); }
      if ([].some.call(doc.querySelectorAll('.mn'), function (m) { return m !== box && sichtbar(m); })) k = null;   /* ein Kasten je Seite: das Rechen-Duell hat seinen eigenen */
      if (!k) { if (box && box.parentNode) box.parentNode.removeChild(box); karte = null; return; }
      var s = kartenText(k);
      if (box && karte === k && box.parentNode === k && s === schluessel) return;
      if (box && s === schluessel) { k.appendChild(box); karte = k; return; }
      if (box && box.parentNode) box.parentNode.removeChild(box);
      karte = k; schluessel = s;
      box = root.MatNotiz.einbau(k, { ziel: ziel }).box;
    }
    function bald() { if (!t && !doc.hidden) t = setTimeout(function () { t = 0; pruefen(); }, 150); }   /* gedrosselt, nicht entprellt: laufende Animationen dürfen die Prüfung nicht aufschieben */
    doc.addEventListener('visibilitychange', bald);
    doc.addEventListener('focusin', function (e) { if (e.target.matches && e.target.matches(RH_FELD) && !e.target.closest('.mn')) { letztes = e.target; bald(); } });
    new MutationObserver(function (ms) { for (var i = 0; i < ms.length; i++) if (!(box && box.contains(ms[i].target))) { bald(); return; } }).observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class', 'open'] });
    if (root.MatNotiz) bald();
    else { var sc = doc.createElement('script'); sc.src = 'matnotiz.js'; sc.onload = bald; doc.head.appendChild(sc); }
  }

  root.LabRahmen = {
    version: 1, tabelle: TAB, eintrag: T,
    zeig: zeig, aktualisieren: function () { aktualisieren(); platz(); leiste(); einsammeln(); },
    info: { auf: function () { if (S.blatt) oeffnen(); }, zu: function () { schliessen(); } },
    menue: menue, _modell: function () { return modell(); }, _laeufe: function () { return S.n || 0; }
  };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
  /* Abkürzungen im Fließtext beim ersten Vorkommen erklären (abk.js, Toni 25.11.2026) */
  (function () { var sc = doc.createElement('script'); sc.src = 'abk.js'; doc.head.appendChild(sc); })();
})(window);
