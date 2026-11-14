/* „Offline bereit“-Anzeige (Startseite, im Fussbereich): zeigt, ob alle Dateien aus dem Precache des Service Workers (sw.js, Liste FILES) im Cache liegen.
   Soll = FILES aus sw.js (wird als Text gelesen, so bleibt die Anzeige ohne Pflege aktuell), Ist = Eintraege im neuesten Cache "lochlab-v*".
   Beim Erstladen (Cache waechst) wird alle 1,5 s nachgezaehlt. Ohne Service Worker (alter Browser, kein https, Privatmodus) steht ein Hinweis da.
   Knopf "Alles offline laden (Vorlesen)" startet das Laden aller Vorlese-Aufnahmen, "Nach Gruppen laden" oeffnet die Gruppenliste (beides in vorlesen-offline.js, wird erst dann geladen). Zeile "Vorlesen komplett offline bereit: ja/teilweise" zaehlt die Aufnahmen im Cache. Laeuft auch ohne diese Datei und ohne Cache-API. */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : null, doc = root && root.document;
  var pure = {
    /* Liste FILES und Cache-Name aus dem Text von sw.js lesen */
    parseSw: function (txt) {
      var f = /const FILES = \[([^\]]*)\]/.exec(txt || ''), c = /const CACHE = '([^']+)'/.exec(txt || '');
      return { files: f ? (f[1].match(/'[^']*'/g) || []).map(function (s) { return s.slice(1, -1); }) : [], cache: c ? c[1] : '' };
    },
    /* neuester Cache "lochlab-v<zahl>.<zahl>..." */
    neuester: function (namen) {
      var v = function (n) { return (/^lochlab-v(\d+(?:\.\d+)*)/.exec(n) || [0, '0'])[1].split('.').map(Number); };
      return (namen || []).filter(function (n) { return /^lochlab-v\d/.test(n); }).sort(function (a, b) {
        var x = v(a), y = v(b); for (var i = 0; i < Math.max(x.length, y.length); i++) { var d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0;
      }).pop() || null;
    },
    /* Zaehlen: wie viele der Soll-Dateien (relativ zu base) liegen in der Menge der Cache-URLs */
    zaehle: function (files, urls, base) {
      var set = {}, path = {}, i, n = 0, miss = [];
      (urls || []).forEach(function (u) { set[u] = 1; path[u.split('?')[0].split('#')[0]] = 1; });
      for (i = 0; i < files.length; i++) {
        var u; try { u = new URL(files[i], base).href; } catch (e) { continue; }
        if (set[u] || path[u.split('?')[0]]) n++; else miss.push(files[i]);
      }
      return { ist: n, soll: files.length, fehlt: miss };
    },
    text: function (z) {
      if (!z || !z.soll) return '';
      if (z.ist >= z.soll) return 'Offline bereit ✓';
      return 'Noch ' + (z.soll - z.ist) + ' von ' + z.soll + ' Dateien';
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = pure;
  if (!doc) return;

  var el, line, bar, fill, btn, btnAll, acts, vline, vsBusy = false, timer = null, busy = false, lastN = -1, still = 0;
  var tag = doc.currentScript;
  function css() {
    if (doc.getElementById('offlineStatusCss')) return;
    var s = doc.createElement('style'); s.id = 'offlineStatusCss';
    s.textContent = '#offlineStatus{margin:20px auto 0;max-width:900px;padding:8px 12px;text-align:center;font:14px/1.45 system-ui,-apple-system,sans-serif;color:var(--mute,#8d99a6)}' +
      '#offlineStatus .os-z{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center}' +
      '#offlineStatus .os-ok{color:var(--ok,#3fb950);font-weight:600}' +
      '#offlineStatus .os-b{display:block;width:min(260px,70%);height:4px;margin:6px auto 0;border-radius:2px;background:var(--line,#38424d);overflow:hidden}' +
      '#offlineStatus .os-b i{display:block;height:100%;width:0;background:var(--accent,#5fb0ff);transition:width .3s}' +
      '#offlineStatus button{min-height:44px;padding:0 14px;border-radius:10px;border:1px solid var(--line,#38424d);background:transparent;color:var(--accent,#5fb0ff);font:inherit;cursor:pointer}' +
      '#offlineStatus .os-a{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:8px}#offlineStatus .os-v{margin-top:6px}' +
      '#offlineStatus button.os-p{min-height:48px;font-size:15px;font-weight:600;background:var(--accent-bg,#1a6fd4);border-color:var(--accent-bg,#1a6fd4);color:var(--accent-ink,#fff)}' +
      '#offlineStatus .os-g{display:flex;align-items:center;justify-content:center;min-height:44px;color:var(--accent,#5fb0ff);font:inherit}' +
      '#offlineStatus button:focus-visible,#offlineStatus .os-g:focus-visible{outline:2px solid var(--accent,#5fb0ff);outline-offset:2px}';
    doc.head.appendChild(s);
  }
  function mount() {
    if (el) return;
    css();
    el = doc.createElement('div'); el.id = 'offlineStatus'; el.setAttribute('role', 'status');
    line = doc.createElement('span'); line.className = 'os-z'; line.setAttribute('aria-live', 'polite');
    bar = doc.createElement('span'); bar.className = 'os-b'; bar.hidden = true; fill = doc.createElement('i'); bar.appendChild(fill);
    vline = doc.createElement('div'); vline.className = 'os-v'; vline.hidden = true; vline.setAttribute('aria-live', 'polite');
    acts = doc.createElement('div'); acts.className = 'os-a'; acts.hidden = true;
    btnAll = doc.createElement('button'); btnAll.type = 'button'; btnAll.className = 'os-p'; btnAll.textContent = 'Alles offline laden (Vorlesen)';
    btnAll.addEventListener('click', function () { oeffneVorlesen('alles'); });
    btn = doc.createElement('button'); btn.type = 'button'; btn.className = 'os-gr'; btn.textContent = 'Nach Gruppen laden';
    btn.addEventListener('click', function () { oeffneVorlesen(); });
    acts.appendChild(btnAll); acts.appendChild(btn);
    el.appendChild(line); el.appendChild(bar); el.appendChild(vline); el.appendChild(acts);
    var gt = doc.createElement('a'); gt.className = 'os-g'; gt.href = 'geraetetest.html'; gt.textContent = 'Gerätetest'; el.appendChild(gt);   // Link zur Gerätetest-Seite, direkt unter der Offline-Anzeige
    var u = doc.getElementById('urheber-hinweis');
    if (u && u.parentNode) u.parentNode.insertBefore(el, u); else doc.body.appendChild(el);
    if (!u) { var n = 0, iv = setInterval(function () { var u2 = doc.getElementById('urheber-hinweis'); if (u2 && u2.parentNode && el.nextSibling !== u2) { u2.parentNode.insertBefore(el, u2); clearInterval(iv); } else if (++n > 20) clearInterval(iv); }, 250); }
  }
  function zeige(txt, ok, p, vorlesen) {
    mount(); line.textContent = ''; var s = doc.createElement('span'); s.textContent = txt; if (ok) s.className = 'os-ok'; line.appendChild(s);
    if (p == null) bar.hidden = true; else { bar.hidden = false; fill.style.width = Math.round(p * 100) + '%'; }
    acts.hidden = !vorlesen;
  }
  function oeffneVorlesen(modus) {
    function go() { try { root.VorlesenOffline[modus === 'alles' ? 'alles' : 'open']({ nachher: function () { pruefen(); } }); } catch (e) { zeige('Vorlesen offline: Fehler beim Öffnen', false, null, true); } }
    if (root.VorlesenOffline) return go();
    var s = doc.createElement('script'); s.src = 'vorlesen-offline.js'; s.onload = go;
    s.onerror = function () { zeige('Vorlesen offline: Datei nicht erreichbar (bitte mit WLAN erneut versuchen)', false, null, true); };
    doc.head.appendChild(s);
  }
  /* Zeile "Vorlesen komplett offline bereit": zaehlt alle Aufnahmen aus sprache/index.js im Cache (laedt dazu vorlesen-offline.js und den Index, beides liegt im Precache) */
  function vorlesenZeile() {
    if (vsBusy || !el) return; vsBusy = true;
    function go() {
      root.VorlesenOffline.status().then(function (s) {
        vsBusy = false; if (!s) { vline.hidden = true; return; }
        vline.hidden = false; vline.className = 'os-v' + (s.ja ? ' os-ok' : ''); vline.textContent = 'Vorlesen komplett offline bereit: ' + s.text;
      }).catch(function () { vsBusy = false; });
    }
    if (root.VorlesenOffline && root.VorlesenOffline.status) return go();
    var sc = doc.createElement('script'); sc.src = 'vorlesen-offline.js'; sc.onload = function () { try { go(); } catch (e) { vsBusy = false; } }; sc.onerror = function () { vsBusy = false; };
    doc.head.appendChild(sc);
  }
  function pruefen() {
    if (busy) return Promise.resolve(); busy = true;
    var API = 'serviceWorker' in root.navigator && root.caches;
    if (!API) { busy = false; zeige('Offline-Nutzung hier nicht verfügbar (Browser ohne Service Worker oder Seite nicht über https geöffnet). Online funktioniert alles.', false, null, false); return Promise.resolve(); }
    return fetch('sw.js').then(function (r) { if (!r.ok) throw 0; return r.text(); }).then(function (t) {
      var sw = pure.parseSw(t); if (!sw.files.length) throw 0;
      return root.caches.keys().then(function (ks) {
        var name = pure.neuester(ks); if (!name) return { ist: 0, soll: sw.files.length };
        return root.caches.open(name).then(function (c) { return c.keys(); }).then(function (rs) { return pure.zaehle(sw.files, rs.map(function (r) { return r.url; }), root.location.href); });
      });
    }).then(function (z) {
      busy = false;
      var ok = z.ist >= z.soll, off = root.navigator.onLine === false;
      if (ok) { zeige('Offline bereit ✓', true, null, true); stop(); setTimeout(vorlesenZeile, 1200); return; }
      var ctrl = !!root.navigator.serviceWorker.controller;
      var msg = pure.text(z);
      if (off) msg += ' – mit WLAN verbinden, um alles zu laden';
      else if (z.ist === 0 && !ctrl) msg = 'Lade Dateien für den Offline-Betrieb …';
      else msg += ' – lädt …';
      zeige(msg, false, z.soll ? z.ist / z.soll : 0, z.ist > 0);
      if (z.ist === lastN) still++; else { still = 0; lastN = z.ist; }
      if (still >= 40) { stop(); zeige(pure.text(z) + ' – Seite neu laden oder mit WLAN verbinden', false, z.ist / z.soll, true); return; }   // 1 Minute ohne Fortschritt: aufhoeren zu zaehlen
      if (!timer) timer = setInterval(pruefen, 1500);
    }).catch(function () {
      busy = false; stop();
      zeige('Offline-Status nicht lesbar – Seite mit WLAN neu laden', false, null, false);
    });
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  function start() { mount(); zeige('Offline-Status wird geprüft …', false, null, false); pruefen(); }
  root.OfflineStatus = { pruefen: pruefen, parseSw: pure.parseSw, neuester: pure.neuester, zaehle: pure.zaehle };
  root.addEventListener('vorlesen-offline-geaendert', function () { vorlesenZeile(); });
  root.addEventListener('online', function () { still = 0; if (!timer) pruefen(); });
  root.addEventListener('offline', function () { pruefen(); });
  if (doc.readyState === 'complete') setTimeout(start, 300); else root.addEventListener('load', function () { setTimeout(start, 300); });
})();
