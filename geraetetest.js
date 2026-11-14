/* Gerätetest (Oberfläche): misst, ruft den Kern (geraetetest-core.js) zum Bewerten auf und zeigt Liste, Ergebnisbild und Kopiertext.
   Jede Messung läuft in try/catch mit Zeitlimit. Es wird nichts gesendet; die Testwerte (localStorage/IndexedDB) werden sofort wieder gelöscht. */
(function () {
  'use strict';
  var C = window.GeraetetestCore, doc = document, nav = navigator;
  function $(id) { return doc.getElementById(id); }
  if (!C) { $('fort').textContent = 'Kern (geraetetest-core.js) nicht geladen. Seite mit Internet neu laden.'; return; }

  var KERN = ['index.html', 'schaltplan.html', 'simlab.html', 'digilab.html', 'messlab.html', 'analab.html', 'lernen.html', 'sprache/index.js'];
  var FLUG_SEITEN = ['index.html', 'schaltplan.html', 'simlab.html', 'digilab.html', 'messlab.html', 'analab.html'];
  var S = { gestartet: false, laeuft: false, d: {}, mp3: null, pinch: null, flug: null, index: null, geraet: null };

  /* ---- Hilfen ---- */
  function zeit(p, ms, was) {
    return new Promise(function (res, rej) {
      var t = setTimeout(function () { rej(new Error('Zeitlimit ' + (was || ''))); }, ms);
      Promise.resolve(p).then(function (v) { clearTimeout(t); res(v); }, function (e) { clearTimeout(t); rej(e); });
    });
  }
  function versuche(fn, ms, was) { try { return zeit(fn(), ms, was); } catch (e) { return Promise.reject(e); } }
  function msg(e) { return String(e && e.message || e || 'Fehler').slice(0, 80); }
  function pause(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function url(p) { return new URL(p, location.href).href; }
  function fort(t) { $('fort').textContent = t; }
  function jetzt() { var d = new Date(), z = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes()); }

  /* ---- Messungen ---- */
  function messeUmgebung() {
    var d = S.d.umg = {};
    d.geraet = S.geraet;
    d.standalone = nav.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
    d.online = nav.onLine;
    d.vvScale = window.visualViewport ? window.visualViewport.scale : null;
    var m = doc.querySelector('meta[name=viewport]'); d.meta = m ? m.getAttribute('content') : '';
    d.reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    d.scheme = window.matchMedia ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : matchMedia('(prefers-color-scheme: light)').matches ? 'light' : '') : '';
    d.version = window.LAB_VERSION || '';
    return versuche(function () { return fetch('ver.js').then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); }); }, 4000, 'ver.js')
      .then(function (t) { d.version = C.parseVer(t) || d.version; }, function () {});
  }
  function messeSw() {
    var d = S.d.sw = { api: !!(nav.serviceWorker && window.caches) };
    if (!d.api) return Promise.resolve();
    d.controller = !!nav.serviceWorker.controller;
    var reg = null;
    return versuche(function () { return nav.serviceWorker.getRegistration(); }, 4000, 'Registrierung').then(function (r) { reg = r || null; }, function (e) { d.fehler = msg(e); })
      .then(function () {
        if (!reg) return;
        var info = function () { return { active: !!reg.active, waiting: !!reg.waiting, installing: !!reg.installing, scope: reg.scope }; };
        d.reg = info();
        return versuche(function () { return caches.keys(); }, 4000, 'Cache-Namen').then(function (ks) {
          d.cacheName = C.neuester(ks);
          return versuche(function () { return fetch('sw.js').then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); }); }, 5000, 'sw.js').then(function (t) {
            var sw = C.parseSw(t); d.swSoll = sw.cache;
            if (!d.cacheName || !sw.files.length) return;
            return versuche(function () { return caches.open(d.cacheName).then(function (c) { return c.keys(); }); }, 5000, 'Cache lesen').then(function (rs) {
              var z = C.zaehle(sw.files, rs.map(function (r) { return r.url; }), location.href); d.ist = z.ist; d.soll = z.soll; d.fehlt = z.fehlt;
            });
          }, function (e) { d.fehler = msg(e); });
        }, function (e) { d.fehler = msg(e); }).then(function () {
          if (nav.onLine === false) { d.updateFehler = 'kein Netz'; return; }
          return versuche(function () { return reg.update(); }, 6000, 'Update').then(function () { d.reg = info(); }, function (e) { d.updateFehler = msg(e); });
        });
      });
  }
  function messeSpeicher() {
    var d = S.d.sp = {};
    try { var k = 'geraetetest.probe', v = String(Math.random()); localStorage.setItem(k, v); d.ls = localStorage.getItem(k) === v; localStorage.removeItem(k); } catch (e) { d.ls = false; d.lsFehler = msg(e); }
    var p = versuche(function () {
      return new Promise(function (res, rej) {
        if (!window.indexedDB) return rej(new Error('nicht vorhanden'));
        var q = indexedDB.open('geraetetest-probe', 1);
        q.onupgradeneeded = function () { q.result.createObjectStore('t'); };
        q.onerror = function () { rej(q.error || new Error('Fehler')); };
        q.onblocked = function () { rej(new Error('blockiert')); };
        q.onsuccess = function () {
          var db = q.result, ok = false;
          try {
            var tx = db.transaction('t', 'readwrite'); tx.objectStore('t').put('x', 'k');
            tx.oncomplete = function () {
              var r = db.transaction('t').objectStore('t').get('k');
              r.onsuccess = function () { ok = r.result === 'x'; db.close(); try { indexedDB.deleteDatabase('geraetetest-probe'); } catch (e) {} res(ok); };
              r.onerror = function () { db.close(); rej(r.error || new Error('Lesen')); };
            };
            tx.onerror = tx.onabort = function () { db.close(); rej(tx.error || new Error('Schreiben')); };
          } catch (e) { try { db.close(); } catch (e2) {} rej(e); }
        };
      });
    }, 5000, 'IndexedDB').then(function (ok) { d.idb = !!ok; }, function (e) { d.idb = false; d.idbFehler = msg(e); });
    return p.then(function () {
      var st = nav.storage;
      d.persistApi = !!(st && st.persisted);
      var a = d.persistApi ? versuche(function () { return st.persisted(); }, 3000, 'persisted').then(function (v) { d.persisted = !!v; }, function () { d.persisted = false; }) : Promise.resolve();
      return a.then(function () {
        if (!d.persistApi || d.persisted || !st.persist) return;
        d.persistFrage = true;
        return versuche(function () { return st.persist(); }, 3000, 'persist').then(function (v) { d.persisted = !!v; }, function () {});
      });
    }).then(function () {
      if (!(nav.storage && nav.storage.estimate)) return;
      return versuche(function () { return nav.storage.estimate(); }, 3000, 'estimate').then(function (e) { d.usage = e.usage; d.quota = e.quota; }, function () {});
    });
  }
  function messeCacheSeiten() {
    var d = S.d.cs = { gesucht: KERN.slice(), gefunden: [] };
    if (!window.caches) { d.fehler = 'Cache-Funktion fehlt'; return Promise.resolve(); }
    var ketten = KERN.map(function (p) {
      return versuche(function () { return caches.match(url(p), { ignoreSearch: true }); }, 4000, p).then(function (r) { if (r) d.gefunden.push(p); }, function () {});
    });
    return Promise.all(ketten);
  }
  /* Aufnahmen-Verzeichnis (sprache/index.js) einmal laden */
  function ladeIndex() {
    if (S.index) return S.index;
    S.index = new Promise(function (res) {
      if (window.SpeakAudio) return res({ n: Object.keys(window.SpeakAudio).length });
      var s = doc.createElement('script'); s.src = 'sprache/index.js';
      var t = setTimeout(function () { res({ fehler: 'Zeitlimit' }); }, 8000);
      s.onload = function () { clearTimeout(t); res(window.SpeakAudio ? { n: Object.keys(window.SpeakAudio).length } : { fehler: 'leer' }); };
      s.onerror = function () { clearTimeout(t); res({ fehler: 'nicht erreichbar' }); };
      doc.head.appendChild(s);
    });
    return S.index;
  }
  function mp3Name() { var A = window.SpeakAudio, e = A && (A.R || A[Object.keys(A)[0]]); return 'sprache/' + (e && e.f ? e.f : 'R') + '.mp3'; }
  function messeVorlesen() {
    var d = S.d.vo = { ios: S.geraet && S.geraet.ios };
    return ladeIndex().then(function (r) { d.indexAnzahl = r.n; d.indexFehler = r.fehler; }).then(function () {
      var ss = window.speechSynthesis;
      if (!ss || !ss.getVoices) { d.stimmen = { api: false }; return; }
      var lies = function () { var v = ss.getVoices() || []; return { api: true, anzahl: v.length, deutsch: v.filter(function (x) { return /^de/i.test(x.lang || ''); }).map(function (x) { return x.name; }) }; };
      d.stimmen = lies();
      if (d.stimmen.anzahl) return;
      return new Promise(function (res) { var t = setTimeout(res, 1500); try { ss.addEventListener('voiceschanged', function () { clearTimeout(t); res(); }, { once: true }); } catch (e) {} }).then(function () { d.stimmen = lies(); });
    });
  }
  function messeTouch() {
    var d = S.d.to = { pointer: 'PointerEvent' in window, maxTouch: nav.maxTouchPoints || 0, dpr: window.devicePixelRatio || 1 };
    try {
      var c = doc.createElement('canvas'); c.width = 20; c.height = 20; var x = c.getContext('2d');
      if (x) { d.canvas = true; x.fillStyle = '#ff0000'; x.fillRect(0, 0, 20, 20); var px = x.getImageData(5, 5, 1, 1).data; d.pixelOk = px[0] > 240 && px[1] < 15 && px[2] < 15 && px[3] === 255; }
    } catch (e) { d.canvas = d.canvas || false; }
    return Promise.resolve();
  }
  function messeLeistung() {
    var d = S.d.le = { linien: 2000 };
    return pause(30).then(function () {
      var x = 0, i = 0, n = 0, t0 = performance.now(), el;
      do { for (i = 0; i < 20000; i++) x += Math.sqrt(n + i) * 1.0000001; n += 20000; el = performance.now() - t0; } while (el < 200);
      d.mioProSek = n / el / 1000; d.schleifeMs = el; d.x = x;
      try {
        var best = Infinity, run;
        var c = doc.createElement('canvas'); c.width = 600; c.height = 400; var g = c.getContext('2d');
        for (run = 0; run < 3; run++) {
          var s = performance.now(), k;
          g.clearRect(0, 0, 600, 400); g.strokeStyle = '#3a8'; g.lineWidth = 1;
          for (k = 0; k < 2000; k++) { g.beginPath(); g.moveTo((k * 37) % 600, (k * 91) % 400); g.lineTo((k * 53 + 100) % 600, (k * 29 + 50) % 400); g.stroke(); }
          g.getImageData(0, 0, 1, 1);
          best = Math.min(best, performance.now() - s);
        }
        d.linienMs = best;
      } catch (e) { d.linienMs = null; }
    });
  }
  function messeAnzeige() {
    var d = S.d.an = { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1, standalone: S.d.umg && S.d.umg.standalone };
    var p = doc.createElement('div');
    p.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    doc.body.appendChild(p); var cs = getComputedStyle(p), f = function (v) { return Math.round(parseFloat(v) || 0); };
    d.safe = { t: f(cs.paddingTop), r: f(cs.paddingRight), b: f(cs.paddingBottom), l: f(cs.paddingLeft) };
    doc.body.removeChild(p);
    return Promise.resolve();
  }

  /* ---- Auswertung ---- */
  function platzhalterFlug() { return [{ id: 'flug', gruppe: 'offline', titel: 'Flugmodus-Test', status: 'offen', text: 'Noch nicht gemacht: unten bei „Mitmach-Test 3“ den Flugmodus-Test beginnen.', tipp: 'Zeigt, ob alle Lab-Seiten, eine Aufnahme und Teilstück-Anfragen ohne Netz funktionieren.' }]; }
  function alleErgebnisse() {
    var d = S.d, out = [], sw = d.sw || {};
    if (d.umg) { d.umg.swCache = sw.cacheName; out = out.concat(C.bewerteUmgebung(d.umg)); }
    if (d.sw) out = out.concat(C.bewerteSw(d.sw));
    if (d.sp) out = out.concat(C.bewerteSpeicher(d.sp));
    if (d.cs) out = out.concat(C.bewerteCacheSeiten(d.cs));
    out = out.concat(S.flug ? C.bewerteFlug(S.flug) : platzhalterFlug());
    if (d.vo) { var v = {}; for (var k in d.vo) v[k] = d.vo[k]; v.mp3 = S.mp3; out = out.concat(C.bewerteVorlesen(v)); }
    if (d.to) { var t = {}; for (var k2 in d.to) t[k2] = d.to[k2]; t.pinch = S.pinch; out = out.concat(C.bewerteTouch(t)); }
    if (d.le) out = out.concat(C.bewerteLeistung(d.le));
    if (d.an) out = out.concat(C.bewerteAnzeige(d.an));
    return out;
  }
  function el(tag, cls, text) { var e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function zeigeErgebnis() {
    var res = alleErgebnisse(), z = C.zusammen(res), L = $('liste'), g = null, box = null;
    $('ergebnis').hidden = false;
    var sm = $('summe'); sm.textContent = '';
    sm.appendChild(el('b', null, z.ampel === 'ok' ? '✓ ' + z.text : z.ampel === 'fail' ? '✗ ' + z.text : '! ' + z.text));
    sm.appendChild(el('div', 'tl', z.ok + ' in Ordnung · ' + z.fail + ' Problem(e) · ' + (z.warn + z.offen) + ' Hinweis/offen'));
    L.textContent = '';
    res.forEach(function (r) {
      if (r.gruppe !== g) { g = r.gruppe; box = el('div', 'grp'); box.appendChild(el('h2', null, C.GRUPPEN[g] || g)); L.appendChild(box); }
      var row = el('div', 'res s-' + r.status), body = el('div');
      row.appendChild(el('div', 'ic', C.ICON[r.status])); row.lastChild.setAttribute('aria-label', { ok: 'in Ordnung', fail: 'Problem', warn: 'Hinweis', offen: 'noch offen' }[r.status]);
      body.appendChild(el('b', null, r.titel)); body.appendChild(el('span', null, r.text));
      if (r.tipp && r.status !== 'ok') body.appendChild(el('div', 'tipp', 'Was tun: ' + r.tipp));
      row.appendChild(body); box.appendChild(row);
    });
    zeigeBild(res, z);
    $('bericht').value = C.bericht(info(), res);
  }
  function info() {
    var d = S.d, vv = window.visualViewport;
    return { version: d.umg && d.umg.version, geraet: S.geraet, ua: nav.userAgent, w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1,
      orient: window.innerWidth >= window.innerHeight ? 'Querformat' : 'Hochformat', zoom: vv ? vv.scale : null, zeit: jetzt() };
  }
  function zeigeBild(res, z) {
    var b = $('bild'), i = info(); b.textContent = '';
    b.appendChild(el('div', 'bk', 'Tonfunk Lab Gerätetest · ' + (i.version || '?')));
    b.appendChild(el('div', 'bg', (z.ampel === 'ok' ? '✓ ' : z.ampel === 'fail' ? '✗ ' : '! ') + (z.ampel === 'ok' ? 'Alles in Ordnung' : z.ampel === 'fail' ? 'Probleme gefunden' : 'Keine Fehler, Hinweise offen')));
    var zl = el('div', 'bz'); zl.appendChild(el('span', 'a', '✓ ' + z.ok)); zl.appendChild(el('span', 'b', '✗ ' + z.fail)); zl.appendChild(el('span', 'c', '! ' + (z.warn + z.offen))); b.appendChild(zl);
    var ul = el('ul'), n = 0;
    res.forEach(function (r) { if (r.status !== 'ok' && n < 8) { n++; ul.appendChild(el('li', null, C.ICON[r.status] + ' ' + r.titel + (r.status === 'offen' ? ' (offen)' : ''))); } });
    if (res.filter(function (r) { return r.status !== 'ok'; }).length > 8) ul.appendChild(el('li', null, '… weitere in der Liste'));
    b.appendChild(ul);
    b.appendChild(el('div', 'bf', C.geraetText(i.geraet) + ' · ' + i.w + '×' + i.h + ' px · Pixeldichte ' + String(Math.round(i.dpr * 100) / 100).replace('.', ',') + ' · ' + i.zeit));
  }

  /* ---- Test starten ---- */
  function start() {
    if (S.laeuft) return; S.laeuft = true; S.gestartet = true;
    var b = $('start'); b.disabled = true; S.geraet = C.erkenneGeraet({ ua: nav.userAgent, platform: nav.platform, maxTouch: nav.maxTouchPoints || 0 });
    var schritte = [['Umgebung', messeUmgebung], ['Service Worker', messeSw], ['Speicher', messeSpeicher], ['Offline-Speicher', messeCacheSeiten], ['Vorlesen', messeVorlesen], ['Touch und Canvas', messeTouch], ['Leistung', messeLeistung], ['Anzeige', messeAnzeige]];
    var p = Promise.resolve();
    schritte.forEach(function (s, i) {
      p = p.then(function () {
        fort('Prüfe ' + (i + 1) + ' von ' + schritte.length + ': ' + s[0] + ' …');
        return versuche(s[1], 20000, s[0]).catch(function (e) { S.d['fehler_' + i] = msg(e); }).then(function () { return pause(20); });
      });
    });
    p.then(function () {
      S.laeuft = false; b.disabled = false; b.textContent = 'Test erneut starten'; fort('Fertig.');
      try { zeigeErgebnis(); } catch (e) { fort('Auswertung fehlgeschlagen: ' + msg(e)); }
      $('ergebnis').scrollIntoView && $('ergebnis').scrollIntoView({ block: 'start' });
    });
  }
  function aktualisiere() { if (S.gestartet && !S.laeuft) { try { zeigeErgebnis(); } catch (e) {} } }

  /* ---- Mitmach-Test Ton: play() läuft direkt im Tipp-Ereignis ---- */
  function ton() {
    var btn = $('tonBtn'), st = $('tonSt'); btn.disabled = true; st.textContent = 'Spiele …';
    var name = mp3Name(), a = new Audio(), fertig = false, canplay = false, m = { name: name.replace(/^sprache\//, '') };
    a.preload = 'auto'; a.src = name;
    function ende(ok, fehler) {
      if (fertig) return; fertig = true; clearTimeout(tm);
      m.ok = ok; if (fehler) m.fehler = fehler; m.dauer = a.duration;
      if (ok && !(a.duration > 0)) { m.ok = false; m.fehler = 'Dauer 0'; }
      try { a.pause(); } catch (e) {}
      S.mp3 = m; btn.disabled = false; st.textContent = m.ok ? '✓ Abgespielt (' + String(Math.round(a.duration * 10) / 10).replace('.', ',') + ' s)' : '✗ ' + (m.fehler || 'Fehler');
      aktualisiere();
    }
    var tm = setTimeout(function () { ende(canplay && m.spielt, canplay ? 'kein Ton gestartet' : 'Zeitlimit beim Laden'); }, 7000);
    a.addEventListener('canplay', function () { canplay = true; });
    a.addEventListener('error', function () { ende(false, 'Datei nicht ladbar'); });
    a.addEventListener('playing', function () { m.spielt = true; });
    a.addEventListener('timeupdate', function () { if (a.currentTime > 0.3 && !fertig && canplay) ende(true); });
    a.addEventListener('ended', function () { ende(true); });
    try {
      var pr = a.play();
      if (pr && pr.catch) pr.catch(function (e) { ende(false, (e && e.name) || 'Fehler'); });
    } catch (e) { ende(false, msg(e)); }
  }

  /* ---- Mitmach-Test Zwei Finger ---- */
  function pinchInit() {
    var f = $('pinch'), pts = {}, p0 = 0, maxF = 0, maxD = 0, n = 0;
    function dist() { var k = Object.keys(pts); if (k.length < 2) return 0; var a = pts[k[0]], b = pts[k[1]]; return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2)); }
    function zeig() { $('pinchSt').textContent = 'Finger: ' + n + ' (höchstens ' + maxF + '), Abstandsänderung ' + Math.round(maxD) + ' px'; }
    f.addEventListener('pointerdown', function (e) { pts[e.pointerId] = { x: e.clientX, y: e.clientY }; n = Object.keys(pts).length; maxF = Math.max(maxF, n); if (n === 2) p0 = dist(); try { f.setPointerCapture(e.pointerId); } catch (x) {} zeig(); });
    f.addEventListener('pointermove', function (e) { if (!pts[e.pointerId]) return; pts[e.pointerId] = { x: e.clientX, y: e.clientY }; if (n >= 2) maxD = Math.max(maxD, Math.abs(dist() - p0)); zeig(); });
    function hoch(e) {
      if (!pts[e.pointerId]) return; delete pts[e.pointerId]; n = Object.keys(pts).length;
      if (n === 0) { S.pinch = { getestet: true, erkannt: maxF >= 2 && maxD >= 30, maxFinger: maxF, aenderung: maxD }; $('pinchSt').textContent = (S.pinch.erkannt ? '✓ Zwei-Finger-Geste erkannt' : '✗ ' + (maxF >= 2 ? 'Zwei Finger erkannt, aber zu wenig Bewegung. Weiter auseinanderziehen.' : 'Nur ein Finger erkannt. Mit beiden Fingern gleichzeitig noch einmal versuchen.')) + ' (Abstandsänderung ' + Math.round(maxD) + ' px)'; maxF = 0; maxD = 0; aktualisiere(); }
    }
    f.addEventListener('pointerup', hoch); f.addEventListener('pointercancel', hoch);
    var t = $('tast'); t.addEventListener('input', function () { $('tastSt').textContent = '✓ Eingabe kommt an (' + t.value.length + ' Zeichen).'; });
  }

  /* ---- Mitmach-Test Flugmodus ---- */
  function flugBeginn() { $('flugSchritte').hidden = false; $('flugWeiter').hidden = false; $('flugBtn').hidden = true; $('flugSt').textContent = ''; }
  function holeSeite(p) {
    return versuche(function () { return fetch(p, { cache: 'no-store' }).then(function (r) { return r.arrayBuffer().then(function (b) { return { name: p, ok: r.ok && b.byteLength > 500, status: r.status, bytes: b.byteLength }; }); }); }, 8000, p)
      .catch(function (e) { return { name: p, ok: false, fehler: msg(e) }; });
  }
  function flugWeiter() {
    var wb = $('flugWeiter'); wb.disabled = true; $('flugSt').textContent = 'Prüfe ohne Netz …';
    var d = { online: nav.onLine, seiten: [], mp3: {}, range: null };
    ladeIndex().catch(function () {}).then(function () {
      var chain = Promise.resolve();
      FLUG_SEITEN.forEach(function (p) { chain = chain.then(function () { return holeSeite(p); }).then(function (r) { d.seiten.push(r); }); });
      return chain;
    }).then(function () {
      var m = mp3Name(); d.mp3 = { name: m.replace(/^sprache\//, '') };
      return holeSeite(m).then(function (r) { d.mp3.ok = r.ok || (r.status === 200 && r.bytes > 0); d.mp3.bytes = r.bytes; d.mp3.fehler = r.fehler; });
    }).then(function () {
      return versuche(function () { return fetch(mp3Name(), { headers: { Range: 'bytes=0-1023' } }).then(function (r) { return r.arrayBuffer().then(function (b) { return { status: r.status, contentRange: r.headers.get('Content-Range'), laenge: b.byteLength }; }); }); }, 8000, 'Range')
        .catch(function (e) { return { fehler: msg(e) }; }).then(function (r) { d.range = r; });
    }).then(function () {
      S.flug = d; wb.disabled = false; wb.hidden = true; $('flugBtn').hidden = false; $('flugBtn').textContent = 'Flugmodus-Test wiederholen'; $('flugSchritte').hidden = true;
      var z = C.zusammen(C.bewerteFlug(d));
      $('flugSt').textContent = (z.fail ? '✗ Probleme, Details im Ergebnis. ' : z.warn ? '! Hinweise im Ergebnis. ' : '✓ Alles geladen. ') + 'Jetzt den Flugmodus wieder ausschalten.';
      if (!S.gestartet) { $('flugSt').textContent += ' „Test starten“ zeigt das Gesamtergebnis.'; }
      aktualisiere();
    });
  }

  /* ---- Kopieren ---- */
  function kopieren() {
    var t = $('bericht').value, st = $('kopieSt');
    function weg() { var ta = $('bericht'); ta.focus(); ta.select(); try { ta.setSelectionRange(0, t.length); } catch (e) {} var ok = false; try { ok = doc.execCommand('copy'); } catch (e) {} st.textContent = ok ? 'Kopiert ✓' : 'Automatisch kopieren geht hier nicht: Text unten markieren und „Kopieren“ wählen.'; }
    if (nav.clipboard && nav.clipboard.writeText) nav.clipboard.writeText(t).then(function () { st.textContent = 'Kopiert ✓'; }, weg); else weg();
  }

  $('start').addEventListener('click', start);
  $('tonBtn').addEventListener('click', ton);
  $('flugBtn').addEventListener('click', flugBeginn);
  $('flugWeiter').addEventListener('click', flugWeiter);
  $('kopie').addEventListener('click', kopieren);
  pinchInit();
  window.addEventListener('load', function () { setTimeout(function () { ladeIndex(); }, 400); });
  window.GeraetetestUI = { start: start, state: S, alleErgebnisse: alleErgebnisse };
})();
