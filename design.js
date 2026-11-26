/* design.js (v23): Überlauf-Hinweise (Fade + Pfeil) für die waagerecht scrollbaren Leisten der Labs (#tabs, #pal, #rigPick).
   Setzt die Klassen ov-l / ov-r (Stil in design.css) und blendet kleine Pfeile am Rand ein. Keine Abhängigkeit zu anderen Skripten, nichts davon ändert Layout oder Inhalt. */
(function () {
  'use strict';
  var IDS = ['tabs', 'pal', 'rigPick'], hints = {};
  function arrow(side) {
    var d = document.createElement('div');
    d.className = 'ovHint'; d.hidden = true; d.setAttribute('aria-hidden', 'true'); d.textContent = side === 'l' ? '‹' : '›';
    document.body.appendChild(d); return d;
  }
  function update(id) {
    var el = document.getElementById(id); if (!el) return;
    var h = hints[id] || (hints[id] = { l: arrow('l'), r: arrow('r') });
    var vis = el.offsetParent !== null && el.clientWidth > 0;
    var max = el.scrollWidth - el.clientWidth, sl = Math.abs(el.scrollLeft);
    var more = vis && max > 4, left = more && sl > 4, right = more && sl < max - 4;
    el.classList.toggle('ov-l', left); el.classList.toggle('ov-r', right);
    var r = el.getBoundingClientRect();
    h.l.hidden = !left; h.r.hidden = !right;
    h.l.style.top = h.r.style.top = Math.round(r.top) + 'px';
    h.l.style.height = h.r.style.height = Math.round(r.height) + 'px';
    h.l.style.left = Math.round(r.left + 2) + 'px';
    h.r.style.left = Math.round(r.right - 32) + 'px';
  }
  function all() { IDS.forEach(update); }
  var raf = 0;
  function soon() { if (raf) return; raf = requestAnimationFrame(function () { raf = 0; all(); }); }
  function init() {
    IDS.forEach(function (id) {
      var el = document.getElementById(id); if (!el) return;
      el.addEventListener('scroll', soon, { passive: true });
      if (window.ResizeObserver) { try { new ResizeObserver(soon).observe(el); } catch (e) {} }
      if (window.MutationObserver) { try { new MutationObserver(soon).observe(el, { childList: true }); } catch (e) {} }
    });
    window.addEventListener('resize', soon); window.addEventListener('orientationchange', soon);
    document.addEventListener('click', function () { setTimeout(soon, 60); }, true);
    all(); setTimeout(all, 400); setTimeout(all, 1500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

/* lm4.last:begin
   Zuletzt benutztes Lab merken (v23.145, Startseite "Weitermachen", SPEC-STARTSEITE-FABLE.md Abschnitt 6.2).
   localStorage lm4.last = {"file":"ntslab.html","task":"nts7","t":1730000000000}. Wird beim Laden eines Labs gesetzt (Datei und ?aufgabe=)
   und bei jeder Änderung von sim.done / lm4.tdone (Aufgabe zuletzt bearbeitet) nachgetragen. Ein dünner Wrapper um Storage.setItem,
   damit die 20 Lab-Oberflächen nicht einzeln angefasst werden müssen. Alles in try/catch: ohne Speicher passiert einfach nichts.
   Dazu lm4.when = {"aufgabeId": ms}: Zeitpunkt der letzten Änderung je Aufgabe (v23.145, Lernempfehlung coach.js, SPEC-PRUEFUNG-COACH-FABLE.md 4.1). Nur lokal, nicht im Export. */
(function (root) {
  'use strict';
  var FILES = ['layout.html', 'schaltplan.html', 'simlab.html', 'digilab.html', 'messlab.html', 'elslab.html', 'ntslab.html', 'wsllab.html', 'analab.html', 'hauslab.html', 'appwerkstatt.html', 'spslab.html', 'pcblab.html', 'antlab.html', 'senlab.html', 'reglab.html', 'thmlab.html', 'emvlab.html', 'enrlab.html', 'codelab.html', 'pilab.html', 'dslab.html', 'pruefungslab.html', 'verbund.html', 'tollab.html', 'zerlab.html', 'pnelab.html', 'hydlab.html', 'cnclab.html', 'werlab.html', 'inslab.html', 'netlab.html', 'kallab.html', 'laglab.html', 'zeilab.html', 'arblab.html', 'emslab.html', 'matlab.html', 'itslab.html', 'buclab.html', 'ladlab.html', 'englab.html', 'bhflab.html', 'konlab.html', 'wfllab.html', 'toulab.html', 'syalab.html', 'kunlab.html', 'prdlab.html', 'mktlab.html', 'reclab.html', 'sqllab.html', 'linlab.html', 'alglab.html', 'hwllab.html', 'syslab.html', 'ssllab.html', 'fuglab.html', 'maslab.html', 'mchlab.html', 'ferlab.html', 'maklab.html', 'mat2lab.html', 'siglab.html', 'hflab.html', 'rg2lab.html', 'emblab.html', 'prjlab.html', 'nrmlab.html', 'flilab.html'];
  var KEY = 'lm4.last', TASK = /^[A-Za-z0-9_.-]{1,40}$/;
  try {
    var file = String(root.location.pathname || '').split('/').pop();
    if (FILES.indexOf(file) < 0) return;
    var ST = root.Storage && root.Storage.prototype, ls = root.localStorage;
    if (!ST || !ls) return;
    var orig = ST.setItem;
    var WK = 'lm4.when';
    var stamp = function (ids) {   // lm4.when: Zeitpunkt der letzten Änderung je Aufgabe, höchstens 1000 Einträge (die ältesten fallen weg)
      try {
        var w = {}; try { w = JSON.parse(ls.getItem(WK)) || {}; } catch (e) { w = {}; }
        if (!w || typeof w !== 'object' || Array.isArray(w)) w = {};
        var t = Date.now(); ids.forEach(function (x) { w[x] = t; });
        var ks = Object.keys(w); if (ks.length > 1200) ks.sort(function (a, b) { return w[a] - w[b]; }).slice(0, ks.length - 1000).forEach(function (k) { delete w[k]; });
        orig.call(ls, WK, JSON.stringify(w));
      } catch (e) {}
    };
    var put = function (task) { try { orig.call(ls, KEY, JSON.stringify({ file: file, task: task || '', t: Date.now() })); } catch (e) {} };
    var prev = null; try { prev = JSON.parse(ls.getItem(KEY)); } catch (e) { prev = null; }
    var q = ''; try { q = new URLSearchParams(root.location.search).get('aufgabe') || ''; } catch (e) { q = ''; }
    if (!TASK.test(q)) q = (!q && prev && prev.file === file && typeof prev.task === 'string' && TASK.test(prev.task)) ? prev.task : '';
    put(q);
    if (root.__lm4LastWrapped) return;
    root.__lm4LastWrapped = true;
    ST.setItem = function (k, v) {
      var old = null, isRes = (k === 'sim.done' || k === 'lm4.tdone') && this === ls;
      if (isRes) { try { old = this.getItem(k); } catch (e) { old = null; } }
      var r = orig.apply(this, arguments);
      if (isRes) {
        try {
          var o = JSON.parse(old || '{}') || {}, n = JSON.parse(v) || {}, ch = Object.keys(n).filter(function (x) { return n[x] !== o[x] && TASK.test(x); });
          if (ch.length && ch.length <= 8) { put(ch[ch.length - 1]); stamp(ch); }
        } catch (e) {}
      }
      return r;
    };
  } catch (e) {}
})(window);
/* lm4.last:end */
/* feedback.js nachladen (Ein-Klick-Rückmeldung je Aufgabe, nur Lab-Seiten, prüft sich selbst; ohne die Datei passiert nichts) */
(function () { try { if (!/lab\.html$|^(layout|schaltplan|verbund|appwerkstatt)\.html$/.test(String(location.pathname).split('/').pop())) return; var s = document.createElement('script'); s.src = 'feedback.js'; s.async = true; s.onerror = function () {}; document.head.appendChild(s); } catch (e) {} })();
/* vbhint:begin
   Hinweis "Dieses Lab ist Station im Projekt X" (v55.170): unter der Kopfzeile eines Labs, wenn dieses Lab in einem Verbundprojekt deines Berufs vorkommt
   (als Arbeits-Lab einer Station oder über eine Lab-Aufgabe). Quelle: window.VB_INDEX und BerufReg aus aufgaben.js (wird von jedem Lab geladen). Ohne diese Daten
   oder im Projekt selbst (?verbund=) passiert nichts. */
(function () {
  function go() {
    try {
      var BR = window.BerufReg, REG = window.LAB_REG, file = String(location.pathname).split('/').pop() || '';
      if (!BR || !REG || !BR.vbLab || !Array.isArray(window.VB_INDEX) || !/lab\.html$|^(layout|schaltplan)\.html$/.test(file) || /[?&]verbund=/.test(location.search)) return;
      var key = Object.keys(REG).filter(function (k) { return REG[k].file === file && !REG[k].hub; })[0]; if (!key) return;
      var list = BR.vbLab(key, BR.cur()); if (!list.length) return;
      if (document.documentElement.classList.contains('pr-lauf')) return;   // laufende Probeprüfung (pruefwerk.js): Projekthinweis gar nicht erst einblenden
      var hdr = document.querySelector('header'); if (!hdr || document.getElementById('vbHint')) return;
      var q = function (n) { return '„' + n + '“'; }, t, href = 'verbund.html';
      if (list.length === 1) {
        var s = list[0].st, nr = s.length === 1 ? 'Station ' + s[0] : 'Stationen ' + s.slice(0, -1).join(', ') + ' und ' + s[s.length - 1];
        t = 'Dieses Lab ist Station im Projekt ' + q(list[0].name) + ' (' + nr + ').'; href += '?projekt=' + encodeURIComponent(list[0].id);
      } else if (list.length <= 3) {
        t = 'Dieses Lab ist Station in den Projekten ' + list.slice(0, -1).map(function (p) { return q(p.name); }).join(', ') + ' und ' + q(list[list.length - 1].name) + '.';
      } else {
        t = 'Dieses Lab ist Station in ' + list.length + ' Projekten, zum Beispiel ' + q(list[0].name) + ' und ' + q(list[1].name) + '.';
      }
      var d = document.createElement('div'); d.id = 'vbHint'; d.setAttribute('role', 'note');
      d.style.cssText = 'margin:8px 0;padding:8px 12px;border:1px solid var(--line,#444);border-radius:10px;background:var(--panel,transparent);color:var(--fg,inherit);font-size:13.5px;line-height:1.4;display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center';
      var sp = document.createElement('span'); sp.textContent = '🧩 ' + t; d.appendChild(sp);
      var a = document.createElement('a'); a.href = href; a.textContent = list.length === 1 ? 'Projekt öffnen' : 'Zu den Projekten'; a.style.cssText = 'color:var(--accent,#5fb0ff);font-weight:600;min-height:24px';
      d.appendChild(a);
      var st = document.createElement('style'); st.textContent = '@media print{#vbHint{display:none!important}}'; d.appendChild(st);
      hdr.parentNode.insertBefore(d, hdr.nextSibling);
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
/* vbhint:end */
/* einordnung:begin  Karte "Warum brauche ich das?" (einordnung.js prüft sich selbst: nur Lab-Seiten, nie im Tor) */
(function () { try { if (!/lab\.html$|^(layout|schaltplan|appwerkstatt)\.html$/.test(String(location.pathname).split('/').pop())) return; var s = document.createElement('script'); s.src = 'einordnung.js'; s.async = true; s.onerror = function () {}; document.head.appendChild(s); } catch (e) {} })();
/* einordnung:end */
/* weiter.js nachladen (Schaltfläche "Nächste Aufgabe" nach gelöster Aufgabe, nur Lab-Seiten, prüft sich selbst) */
(function () { try { if (!/lab\.html$|^(layout|schaltplan|appwerkstatt)\.html$/.test(String(location.pathname).split('/').pop())) return; var s = document.createElement('script'); s.src = 'weiter.js'; s.async = true; s.onerror = function () {}; document.head.appendChild(s); } catch (e) {} })();
/* lehrjahr-liste:begin  Aufgabenlisten und Folge nach Lehrjahr (Paket L3): lernfelder.js, lehrjahr.js, lehrjahr-liste.js nacheinander nachladen (nur Lab-Seiten; das Modul prüft selbst Beruf und Lehrjahr und tut sonst nichts) */
(function () { try { if (!/lab\.html$|^(layout|schaltplan|appwerkstatt)\.html$/.test(String(location.pathname).split('/').pop())) return; var q = ['lernfelder.js', 'lehrjahr.js', 'lehrjahr-liste.js'], i = 0; (function nx() { if (i >= q.length) return; var s = document.createElement('script'); s.src = q[i++]; s.async = true; s.onload = nx; s.onerror = function () {}; document.head.appendChild(s); })(); } catch (e) {} })();
/* lehrjahr-liste:end */
/* aufgabe-vorlesen:begin  Knopf "Vorlesen" an der Aufgabenkarte (nur mit passender Aufnahme AU_<lab>_<id>; aufgabe-vorlesen.js prueft sich selbst: nur Lab-Seiten mit Aufgabenkarte) */
(function () { try { if (!/(lab\.html|^layout\.html|^schaltplan\.html|^appwerkstatt\.html)$/.test(String(location.pathname).split('/').pop())) return; var s = document.createElement('script'); s.src = 'aufgabe-vorlesen.js'; s.async = true; s.onerror = function () {}; document.head.appendChild(s); } catch (e) {} })();
/* aufgabe-vorlesen:end */
/* toast-lage:begin  Meldung (#toast) und Versionsplakette (#verBadge) verdecken nichts mehr.
   1) Steht die Rückfrage-Zeile (#fbStrip) oder die Leiste "Nächste Aufgabe" (#wtBar) da, rückt die Meldung darüber (die Leisten erscheinen erst 0,7 bis 0,9 s nach "Geschafft!", daher läuft die Lage-Prüfung, solange die Meldung zu sehen ist).
   2) Das Willkommens-Banner der Labs wird auf den Satz vor dem Doppelpunkt bzw. den ersten Satz gekürzt (nur wenn es länger als 60 Zeichen ist), nach 4 s ausgeblendet und lässt sich antippen (schließt es); jede andere Eingabe in der Seite schließt es ebenfalls. Bei reduzierter Bewegung gibt es keinen Übergang.
   3) Die Versionsplakette zeigt nur noch die Nummer, klein und blass, und fängt keine Eingaben ab; am Handy (bis 640 px) ist sie weg; "Was ist neu?" bleibt im Menü der Labs und auf der Startseite. */
(function () {
  try {
    var t = null, iv = 0, busy = false, wel = false, welTimer = 0;
    function stapel() {
      var top = 0, vh = window.innerHeight;
      ['fbStrip', 'wtBar'].forEach(function (id) {
        var e = document.getElementById(id); if (!e) return; var r = e.getBoundingClientRect();
        if (r.height > 0 && r.bottom > vh / 2 && (!top || r.top < top)) top = r.top;
      });
      return top;
    }
    /* uifix63186: Liegt die Meldung ueber einer Rueckmeldung (.lr-fb), rueckt sie unter Kopfzeile und Reiterband an den oberen Rand. */
    function ueberFb() {
      var tr = t.getBoundingClientRect(), fbs = document.querySelectorAll('.lr-fb'), i, r, y = 0;
      for (i = 0; i < fbs.length; i++) {
        r = fbs[i].getBoundingClientRect();
        if (r.height > 0 && r.bottom > tr.top && r.top < tr.bottom && r.right > tr.left && r.left < tr.right) {
          ['#app>header', '.lr-band'].forEach(function (s) { var e = document.querySelector(s); if (!e) return; var q = e.getBoundingClientRect(); if (q.height > 0 && q.bottom > y && q.bottom < window.innerHeight / 2) y = q.bottom; });
          t.style.bottom = 'auto'; t.style.top = Math.round(y + 8) + 'px'; return;
        }
      }
    }
    function lage() {
      if (!t) return;
      if (wel && document.getElementById('tfGo')) { weg(); return; }   // das Angebot des Trainers ("Neu hier?") hat Vorrang: das Willkommens-Banner würde seine Knöpfe verdecken
      if (!t.classList.contains('show')) { t.style.bottom = ''; t.style.top = ''; if (iv) { clearInterval(iv); iv = 0; } return; }
      t.style.bottom = '';
      t.style.top = ''; var top = stapel(); if (!top) { ueberFb(); return; }
      var vh = window.innerHeight, frei = vh - t.getBoundingClientRect().bottom, need = Math.ceil(vh - top + 8);
      if (need > frei) t.style.bottom = need + 'px';
    }
    function weg() { if (!t) return; wel = false; clearTimeout(welTimer); t.classList.remove('show'); t.style.pointerEvents = ''; lage(); }
    function pruefen() {
      if (busy || !t) return;
      var show = t.classList.contains('show'), txt = t.textContent || '';
      if (show && /^Willkommen/.test(txt) && !wel && /(^|\s)tf-erst(\s|$)/.test(document.documentElement.className)) {
        /* erster Besuch mit Tour (tutorial.js setzt tf-erst): nur ein Hinweis, die Tour. Das Banner wird gar nicht erst gezeigt. */
        busy = true; t.classList.remove('show'); t.style.pointerEvents = ''; busy = false;
        return;
      }
      if (show && /^Willkommen/.test(txt) && !wel) {
        wel = true; busy = true;
        if (txt.length > 60) { var i = txt.indexOf(':'), m = /^[^!.]{20,}[!.](?=\s)/.exec(txt); if (i > 20) t.textContent = txt.slice(0, i) + '.'; else if (m) t.textContent = m[0]; }
        busy = false; t.style.pointerEvents = 'auto'; clearTimeout(welTimer); welTimer = setTimeout(weg, 4000);
      } else if (!show && wel) { wel = false; clearTimeout(welTimer); t.style.pointerEvents = ''; }
      if (show && !iv) iv = setInterval(lage, 100);
      lage();
    }
    function start() {
      t = document.getElementById('toast'); if (!t) return;
      new MutationObserver(pruefen).observe(t, { attributes: true, attributeFilter: ['class'], childList: true, characterData: true, subtree: true });
      t.addEventListener('click', function () { if (wel) weg(); });
      document.addEventListener('pointerdown', function (e) { if (wel && e.target !== t) weg(); }, true);
      var st = document.createElement('style');
      st.textContent = '#toast[style*="pointer-events: auto"]{cursor:pointer}@media (prefers-reduced-motion:reduce){#toast{transition:none!important}}'
        + '#verBadge{pointer-events:none!important;opacity:.6}#verBadge[data-v]{font-size:0!important;padding:3px 6px!important}#verBadge[data-v]::after{content:attr(data-v);font:700 10px/1 system-ui,sans-serif;letter-spacing:.03em}@media(max-width:640px){#verBadge{display:none!important}}';
      document.head.appendChild(st);
      var vb = function () { var b = document.getElementById('verBadge'); if (b && window.LAB_VERSION) b.setAttribute('data-v', window.LAB_VERSION); };
      vb(); setTimeout(vb, 700);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  } catch (e) {}
})();
/* toast-lage:end */

/* offer-unten:begin  Erster Besuch (Audit U-vb-06, Q3): Das Angebot "Neu hier?" (#trOffer, trainer.js) deckt am Handy in Seiten ohne Lab-Rahmen die Überschrift ab, weil es oben unter der Kopfzeile sitzt.
   Hier rückt es am Handy an den unteren Rand (volle Breite), nur in Seiten, die kein Lab sind (verbund.html u. a.). In Labs liegt es im Info-Blatt (labrahmen.js) bzw. bleibt im ersten Besuch aus (tutorial.js). Nur Stil, keine Logik, kein Speicher. */
(function () {
  try {
    if (/lab\.html$/.test(String(location.pathname).split('/').pop())) return;   // Labs: Rahmen bzw. Tour regeln das
    var st = document.createElement('style'); st.id = 'tfOfferUnten';
    st.textContent = '@media(max-width:600px){html:not(.lr-on) body #trOffer{top:auto!important;bottom:calc(env(safe-area-inset-bottom,0px) + 8px)!important;left:8px!important;right:8px!important;max-width:none!important}}';
    (document.head || document.documentElement).appendChild(st);
  } catch (e) {}
})();
/* offer-unten:end */
