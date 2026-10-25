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
  var FILES = ['layout.html', 'schaltplan.html', 'simlab.html', 'digilab.html', 'messlab.html', 'elslab.html', 'ntslab.html', 'wsllab.html', 'analab.html', 'hauslab.html', 'appwerkstatt.html', 'spslab.html', 'pcblab.html', 'antlab.html', 'senlab.html', 'reglab.html', 'thmlab.html', 'emvlab.html', 'enrlab.html', 'codelab.html', 'pilab.html', 'dslab.html', 'pruefungslab.html', 'verbund.html'];
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
