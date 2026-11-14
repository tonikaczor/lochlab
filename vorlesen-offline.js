/* „Vorlesen offline laden“: Die Vorlese-Aufnahmen (sprache/*.mp3) liegen nur zum Teil im Precache des Service Workers, der Rest wird beim ersten Hoeren nachgeladen.
   Hier kann der Azubi sie gezielt vorab laden, gruppenweise (Lab, Projekt, Lernfelder, Wiki). Grundlage ist window.SpeakAudio (sprache/index.js); der Index waechst,
   darum gibt es keine feste Zahl: Gruppen, Anzahl und Groesse werden zur Laufzeit gebildet, unvollstaendige Eintraege uebersprungen.
   Gespeichert wird als ganze Datei (Status 200) in den neuesten Cache "lochlab-v*" des Service Workers, unter derselben URL wie beim Abspielen (sprache/<datei>.mp3);
   der fetch-Handler in sw.js schneidet daraus offline die Range-Stuecke fuer Safari/iOS. Aufruf: VorlesenOffline.open({gruppe:'lab:alg'}) */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : null, doc = root && root.document;
  var KB = 54;   /* mittlere Dateigroesse in KB (Schaetzung fuer die Anzeige: ca. 144 MB / 2750 Dateien, die echten Dateien sind 20 bis 150 KB) */
  var PAR = 5;   /* so viele Dateien gleichzeitig bei "Alles offline laden" (kleine Pakete, kein Hunderterpack) */
  var PREFIX = /^(WZ|VB|LF|WK|AU)_/;
  var pure = {
    /* Gruppen aus dem Index bilden: [{id,label,art,dateien:[{key,f,url}]}] */
    gruppen: function (idx) {
      var g = {}, order = [], seen = {};
      Object.keys(idx || {}).forEach(function (k) {
        var e = idx[k], m = PREFIX.exec(k);
        if (!m || !e || typeof e.f !== 'string' || !/^[\w.\-]+$/.test(e.f)) return;
        var p = k.split('_'), id, label, art;
        if (m[1] === 'WZ' || m[1] === 'AU') { if (!p[1]) return; id = 'lab:' + p[1]; label = p[1].toUpperCase(); art = 'lab'; }
        else if (m[1] === 'VB') { if (!p[1]) return; id = 'vb:' + p[1]; label = 'Projekt ' + p[1]; art = 'vb'; }
        else if (m[1] === 'LF') { if (!p[1]) return; id = 'lf:' + p[1]; label = 'Lernfelder ' + p[1].toUpperCase(); art = 'lf'; }
        else { id = 'wk'; label = 'Wiki-Einträge'; art = 'wk'; }
        if (!g[id]) { g[id] = { id: id, label: label, art: art, dateien: [] }; order.push(id); }
        if (seen[e.f]) return; seen[e.f] = 1;
        g[id].dateien.push({ key: k, f: e.f, url: 'sprache/' + e.f + '.mp3' });
      });
      var rang = { lab: 0, vb: 1, lf: 2, wk: 3 };
      return order.map(function (i) { return g[i]; }).sort(function (a, b) { return rang[a.art] - rang[b.art] || (a.label < b.label ? -1 : a.label > b.label ? 1 : 0); });
    },
    mb: function (n) { var m = n * KB / 1024; return m < 0.1 ? '< 0,1 MB' : (m < 10 ? m.toFixed(1) : String(Math.round(m))).replace('.', ',') + ' MB'; },
    zahl: function (n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); },
    mbBytes: function (b) { var m = b / 1048576; return m < 0.1 ? '< 0,1 MB' : (m < 10 ? m.toFixed(1) : String(Math.round(m))).replace('.', ',') + ' MB'; },
    schaetzBytes: function (n) { return n * KB * 1024; },
    /* Wie gruppen(), dazu eine Gruppe "basis" mit allen uebrigen Aufnahmen (Bauteile, Geraete): normalerweise im Precache, hier nur als Absicherung. Jede Datei genau einmal. */
    alleGruppen: function (idx) {
      var g = pure.gruppen(idx), seen = {}, rest = [];
      g.forEach(function (x) { x.dateien.forEach(function (d) { seen[d.f] = 1; }); });
      Object.keys(idx || {}).forEach(function (k) {
        var e = idx[k]; if (!e || typeof e.f !== 'string' || !/^[\w.\-]+$/.test(e.f) || seen[e.f]) return;
        seen[e.f] = 1; rest.push({ key: k, f: e.f, url: 'sprache/' + e.f + '.mp3' });
      });
      if (rest.length) g.push({ id: 'basis', label: 'Bauteile und Geräte', art: 'basis', dateien: rest });
      return g;
    },
    /* Plan fuer "Alles laden": hat(url)->bool sagt, ob die Datei schon im Cache liegt. Ergebnis: alle, offen (fehlende), gesamt, da */
    plan: function (idx, hat) {
      var gr = pure.alleGruppen(idx), alle = [], offen = [];
      gr.forEach(function (g) { g.dateien.forEach(function (d) { alle.push(d); if (!hat(d.url)) offen.push(d); }); });
      return { gruppen: gr, alle: alle, offen: offen, gesamt: alle.length, da: alle.length - offen.length };
    },
    /* Speicherpruefung: est = navigator.storage.estimate()-Ergebnis (oder null), bedarf in Byte.
       zuwenig: Bedarf groesser als der freie Platz (nicht starten); knapp: Bedarf ueber 80 % des freien Platzes (warnen); unbekannt: Browser sagt nichts */
    platz: function (est, bedarf) {
      if (!est || !(est.quota > 0)) return { stufe: 'unbekannt', frei: null, bedarf: bedarf };
      var frei = Math.max(0, est.quota - (est.usage || 0));
      return { stufe: bedarf > frei ? 'zuwenig' : bedarf > 0.8 * frei ? 'knapp' : 'ok', frei: frei, bedarf: bedarf };
    },
    /* Status fuer die Offline-Karte: "ja" / "teilweise (n von m)" / "nein (0 von m)" */
    status: function (gesamt, da) {
      if (!gesamt) return null;
      var ja = da >= gesamt;
      return { ja: ja, da: da, gesamt: gesamt, text: ja ? 'ja' : (da ? 'teilweise' : 'nein') + ' (' + pure.zahl(da) + ' von ' + pure.zahl(gesamt) + ')' };
    },
    /* Eine Datei holen und in den Cache legen. Ganze Datei lesen, Laenge gegen Content-Length pruefen (ein abgerissener Download wird verworfen, nie halb gespeichert),
       als saubere 200-Antwort speichern (der Service Worker schneidet daraus die Range-Stuecke). Ergebnis: Bytes (0 = ungueltig/Fehler); Netz- und Speicherfehler als Ablehnung */
    holeDatei: function (fetchFn, cache, u, signal) {
      return fetchFn(u, signal ? { signal: signal, cache: 'no-cache' } : { cache: 'no-cache' }).then(function (r) {
        if (!r.ok || r.status !== 200) return 0;
        var cl = +r.headers.get('Content-Length') || 0, enc = r.headers.get('Content-Encoding');
        return r.arrayBuffer().then(function (b) {
          if (!b.byteLength || (cl && !enc && b.byteLength !== cl)) return 0;
          var neu = new Response(b, { status: 200, headers: { 'Content-Type': r.headers.get('Content-Type') || 'audio/mpeg', 'Content-Length': String(b.byteLength) } });
          return cache.put(u, neu).then(function () { return b.byteLength; });
        });
      });
    },
    neuester: function (namen) {
      var v = function (n) { return (/^lochlab-v(\d+(?:\.\d+)*)/.exec(n) || [0, '0'])[1].split('.').map(Number); };
      return (namen || []).filter(function (n) { return /^lochlab-v\d/.test(n); }).sort(function (a, b) {
        var x = v(a), y = v(b); for (var i = 0; i < Math.max(x.length, y.length); i++) { var d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0;
      }).pop() || null;
    },
    /* Dateien nacheinander (n parallel) laden. api: {vorhanden(url)->Promise<bool>, hole(url,signal)->Promise<bool>, fortschritt(i,n,fehler), abbruch()->bool}
       Bricht nach 6 Fehlern in Folge ab (kein Netz). Bei vollem Speicher (QuotaExceededError) ebenfalls. Ergebnis: {fertig, fehler, uebersprungen, abgebrochen, keinNetz, speicherVoll} */
    laden: function (dateien, api, par) {
      var i = 0, n = dateien.length, res = { fertig: 0, fehler: 0, uebersprungen: 0, abgebrochen: false, keinNetz: false, speicherVoll: false }, folge = 0, erledigt = 0;
      return new Promise(function (ok) {
        if (!n) return ok(res);
        var laufend = 0;
        function weiter() {
          while (laufend < (par || 3) && i < n && !res.abgebrochen && !res.keinNetz && !res.speicherVoll) {
            if (api.abbruch()) { res.abgebrochen = true; break; }
            (function (d) {
              laufend++;
              Promise.resolve().then(function () { return api.vorhanden(d.url); }).then(function (da) {
                if (da) { res.uebersprungen++; folge = 0; return; }
                return api.hole(d.url).then(function (g) { if (g) { res.fertig++; folge = 0; } else { res.fehler++; folge++; } });
              }).catch(function (e) { if (api.abbruch()) res.abgebrochen = true; else if (e && e.name === 'QuotaExceededError') { res.fehler++; res.speicherVoll = true; } else { res.fehler++; folge++; } }).then(function () {
                laufend--; erledigt++; if (folge >= 6) res.keinNetz = true;
                try { api.fortschritt(erledigt, n, res.fehler); } catch (e) {}
                weiter();
              });
            })(dateien[i++]);
          }
          if (!laufend) ok(res);
        }
        weiter();
      });
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = pure;
  if (!doc) return;

  /* ---------- Oberflaeche ---------- */
  var dlg = null, abbr = null, aktiv = false, gr = [], vorhanden = {}, cacheName = null;
  function h(tag, cls, txt) { var e = doc.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function css() {
    if (doc.getElementById('voOfflineCss')) return;
    var s = h('style'); s.id = 'voOfflineCss';
    s.textContent = '#voOff{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:12px;font:14px/1.45 system-ui,-apple-system,sans-serif}' +
      '#voOff .vo-box{width:min(560px,100%);max-height:calc(100vh - 24px);max-height:calc(100dvh - 24px);display:flex;flex-direction:column;background:var(--panel,#1c2228);color:var(--fg,#e8ecf0);border:1px solid var(--line,#38424d);border-radius:14px;overflow:hidden}' +
      '#voOff .vo-k{padding:14px 16px 8px;display:flex;align-items:center;gap:8px}#voOff h2{margin:0;font-size:17px;flex:1}' +
      '#voOff .vo-l{overflow:auto;-webkit-overflow-scrolling:touch;padding:4px 16px;flex:1;min-height:80px}' +
      '#voOff .vo-r{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--line,#38424d)}#voOff .vo-r>span{flex:1;min-width:0}' +
      '#voOff .vo-r small,#voOff .vo-n{display:block;color:var(--mute,#8d99a6);font-size:14px}#voOff .vo-n{padding:8px 16px}' +
      '#voOff .vo-f{padding:10px 16px 14px;border-top:1px solid var(--line,#38424d)}' +
      '#voOff button{min-height:44px;min-width:44px;padding:0 14px;border-radius:10px;border:1px solid var(--line,#38424d);background:transparent;color:var(--accent,#5fb0ff);font:inherit;cursor:pointer}' +
      '#voOff button[disabled]{opacity:.45;cursor:default}#voOff button:focus-visible{outline:2px solid var(--accent,#5fb0ff);outline-offset:2px}' +
      '#voOff .vo-b{height:6px;border-radius:3px;background:var(--line,#38424d);overflow:hidden;margin:8px 0 4px}#voOff .vo-b i{display:block;height:100%;width:0;background:var(--accent,#5fb0ff);transition:width .2s}' +
      '#voOff .vo-ok{color:var(--ok,#3fb950)}' +
      '#voOff .vo-t{margin:0;padding:6px 16px;font-size:14px;line-height:1.5;overflow-wrap:anywhere}#voOff .vo-l .vo-t{padding-left:0;padding-right:0}#voOff .vo-h{font-size:15px;font-weight:600}#voOff .vo-m{color:var(--mute,#8d99a6)}' +
      '#voOff .vo-w{border:1px solid var(--warn,#ffd166);border-radius:10px;padding:8px 12px!important;margin:6px 0}#voOff .vo-e{color:var(--danger,#ff7a7a)}#voOff .vo-w.vo-e{border-color:var(--danger,#ff7a7a)}' +
      '#voOff .vo-kn{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}#voOff .vo-kn button{flex:1 1 130px}#voOff button.vo-p{background:var(--accent-bg,#1a6fd4);border-color:var(--accent-bg,#1a6fd4);color:var(--accent-ink,#fff);font-weight:600}';
    doc.head.appendChild(s);
  }
  function dz(n) { return n + (n === 1 ? ' Datei' : ' Dateien'); }
  function holeCacheName() { return root.caches.keys().then(function (k) { cacheName = pure.neuester(k); return cacheName; }); }
  function leseVorhanden() {
    vorhanden = {};
    return holeCacheName().then(function (nm) {
      if (!nm) return;
      return root.caches.open(nm).then(function (c) { return c.keys(); }).then(function (rs) { rs.forEach(function (r) { vorhanden[new URL(r.url).pathname] = 1; }); });
    }).catch(function () {});
  }
  var abs = function (url) { return new URL(url, root.location.href).pathname; };
  function stat(g) { var da = g.dateien.filter(function (d) { return vorhanden[abs(d.url)]; }).length; return { da: da, rest: g.dateien.length - da }; }
  function labTitel(g) {
    if (g.art !== 'lab' || !root.caches) return;
    root.caches.match(g.id.slice(4) + 'lab.html').then(function (r) { return r && r.text(); }).then(function (t) {
      var m = t && /<title>([^<]{2,80})<\/title>/i.exec(t); if (m && g.zeile) g.zeile.querySelector('b').textContent = m[1].replace(/\s*[–\-|·].*$/, '').replace(/^Tonfunk\s+/i, '').trim() || g.label;
    }).catch(function () {});
  }
  function speicher(el) {
    try {
      if (root.navigator.storage && root.navigator.storage.estimate) root.navigator.storage.estimate().then(function (e) {
        if (e && e.quota) el.textContent = 'Speicher für diese Seite: ca. ' + Math.round((e.usage || 0) / 1048576) + ' MB belegt, ca. ' + Math.round((e.quota - (e.usage || 0)) / 1048576) + ' MB frei (Schätzung des Browsers).';
      }).catch(function () {});
    } catch (x) {}
  }
  function schliessen() { if (abbr) abbr.abbruch = true; if (abbr && abbr.ctl) try { abbr.ctl.abort(); } catch (e) {} if (dlg && dlg.parentNode) dlg.parentNode.removeChild(dlg); dlg = null; aktiv = false; doc.removeEventListener('keydown', taste, true); if (opts && opts.nachher) try { opts.nachher(); } catch (e) {} }
  function taste(ev) { if (ev.key === 'Escape') { ev.preventDefault(); schliessen(); } }
  var opts = null, ui = {};
  function zeilen() {
    ui.liste.textContent = '';
    var tot = gr.reduce(function (s, g) { return s + stat(g).rest; }, 0);
    ui.alle.disabled = aktiv || !tot; ui.alle.textContent = tot ? 'Alles laden (' + tot + ' Dateien, ca. ' + pure.mb(tot) + ')' : 'Alles geladen ✓';
    if (!gr.length) ui.liste.appendChild(h('p', 'vo-n', 'Keine Vorlese-Aufnahmen gefunden (sprache/index.js nicht geladen).'));
    gr.forEach(function (g) {
      var s = stat(g), r = h('div', 'vo-r'); r.setAttribute('data-g', g.id); var  t = h('span'), b = h('b', null, g.label), k = h('small');
      t.appendChild(b);
      if (!s.rest) { k.textContent = dz(g.dateien.length) + ' – offline bereit ✓'; k.className = 'vo-ok'; }
      else k.textContent = dz(g.dateien.length) + (s.da ? ' (' + s.da + ' schon da)' : '') + ', noch ca. ' + pure.mb(s.rest);
      t.appendChild(k); r.appendChild(t);
      var bt = h('button', null, s.rest ? 'Laden' : '✓'); bt.type = 'button'; bt.disabled = aktiv || !s.rest; bt.setAttribute('aria-label', g.label + (s.rest ? ' laden' : ' bereit'));
      bt.addEventListener('click', function () { start([g]); });
      r.appendChild(bt); g.zeile = r; ui.liste.appendChild(r); labTitel(g);
      if (opts && opts.gruppe === g.id && !g.gezeigt) { g.gezeigt = true; setTimeout(function () { try { r.scrollIntoView({ block: 'center' }); } catch (e) {} }, 0); }
    });
  }
  function start(gruppen) {
    if (aktiv || !root.caches) return;
    var dateien = [], seen = {};
    gruppen.forEach(function (g) { g.dateien.forEach(function (d) { if (!seen[d.url]) { seen[d.url] = 1; dateien.push(d); } }); });
    var offen = dateien.filter(function (d) { return !vorhanden[abs(d.url)]; });
    if (!offen.length) return;
    aktiv = true; abbr = { abbruch: false, ctl: typeof AbortController !== 'undefined' ? new AbortController() : null };
    ui.abbr.hidden = false; ui.bar.hidden = false; ui.fill.style.width = '0'; ui.txt.textContent = 'Lade 0 von ' + offen.length + ' …'; zeilen();
    var my = abbr;
    holeCacheName().then(function (nm) {
      if (!nm) throw new Error('kein Cache');
      return root.caches.open(nm);
    }).then(function (cache) {
      return pure.laden(offen, {
        abbruch: function () { return my.abbruch; },
        vorhanden: function (u) { return cache.match(u).then(function (r) { return !!r; }); },
        hole: function (u) {
          return fetch(u, my.ctl ? { signal: my.ctl.signal, cache: 'no-cache' } : { cache: 'no-cache' }).then(function (r) {
            if (!r.ok || r.status !== 200) return false;
            return cache.put(u, r).then(function () { vorhanden[abs(u)] = 1; return true; });
          });
        },
        fortschritt: function (i, n, f) { if (dlg && my === abbr) { ui.fill.style.width = Math.round(i / n * 100) + '%'; ui.txt.textContent = 'Lade ' + i + ' von ' + n + (f ? ' (' + f + ' Fehler)' : '') + ' …'; } }
      }, 3);
    }).then(function (res) {
      if (!dlg || my !== abbr) return;
      aktiv = false; ui.abbr.hidden = true;
      var m = res.abgebrochen ? 'Abgebrochen. Bereits geladene Dateien bleiben gespeichert.' : res.keinNetz ? 'Keine Verbindung – bitte mit WLAN verbinden und erneut starten. Bereits Geladenes bleibt gespeichert.' :
        res.fehler ? res.fehler + ' Dateien konnten nicht geladen werden (nochmal versuchen).' : 'Fertig – ' + res.fertig + ' Dateien offline gespeichert ✓';
      ui.txt.textContent = m; ui.fill.style.width = '100%'; zeilen();
    }).catch(function (e) {
      aktiv = false; if (!dlg) return; ui.abbr.hidden = true;
      ui.txt.textContent = 'Nicht möglich: Der Offline-Speicher ist hier nicht verfügbar (Service Worker noch nicht aktiv oder Privatmodus). Seite einmal neu laden.'; zeilen();
    });
  }
  function open(o) {
    opts = o || {};
    if (dlg) return;
    if (!root.caches) { try { root.alert('Offline-Speicher ist in diesem Browser nicht verfügbar.'); } catch (e) {} return; }
    css();
    dlg = h('div'); dlg.id = 'voOff';
    var box = h('div', 'vo-box'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Vorlesen offline laden');
    var k = h('div', 'vo-k'), tt = h('h2', null, 'Vorlesen offline laden'), x = h('button', null, '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Schließen'); x.addEventListener('click', schliessen);
    k.appendChild(tt); k.appendChild(x);
    var intro = h('p', 'vo-n', 'Die Vorlese-Aufnahmen werden sonst erst beim ersten Anhören geladen. Hier kannst du sie vorab speichern, damit sie auch ohne WLAN laufen.');
    ui.liste = h('div', 'vo-l'); ui.alle = h('button', null, '…'); ui.alle.type = 'button'; ui.alle.style.margin = '4px 16px 8px';
    ui.alle.addEventListener('click', function () { start(gr); });
    var f = h('div', 'vo-f'); ui.txt = h('div', null, ''); ui.txt.setAttribute('aria-live', 'polite');
    ui.bar = h('div', 'vo-b'); ui.fill = h('i'); ui.bar.appendChild(ui.fill); ui.bar.hidden = true;
    ui.abbr = h('button', null, 'Abbrechen'); ui.abbr.type = 'button'; ui.abbr.hidden = true;
    ui.abbr.addEventListener('click', function () { if (abbr) { abbr.abbruch = true; if (abbr.ctl) try { abbr.ctl.abort(); } catch (e) {} } ui.txt.textContent = 'Wird abgebrochen …'; });
    var sp = h('small', 'vo-n'); sp.style.padding = '6px 0 0';
    sp.textContent = 'Hinweis: Eine Aufnahme ist etwa 20 bis 150 KB groß. iPhone und iPad räumen Daten von Webseiten, die lange nicht geöffnet wurden, unter Umständen wieder auf; die Seite zum Home-Bildschirm hinzuzufügen und gelegentlich zu öffnen hilft. Die Größen hier sind Schätzungen. Am besten im WLAN laden.';
    var sp2 = h('small', 'vo-n'); sp2.style.padding = '2px 0 0'; speicher(sp2);
    f.appendChild(ui.txt); f.appendChild(ui.bar); f.appendChild(ui.abbr); f.appendChild(sp); f.appendChild(sp2);
    box.appendChild(k); box.appendChild(intro); box.appendChild(ui.alle); box.appendChild(ui.liste); box.appendChild(f);
    dlg.appendChild(box); dlg.addEventListener('click', function (ev) { if (ev.target === dlg && !aktiv) schliessen(); });
    doc.body.appendChild(dlg); doc.addEventListener('keydown', taste, true); try { x.focus(); } catch (e) {}
    ui.txt.textContent = 'Liste wird gelesen …';
    var haveIdx = root.SpeakAudio ? Promise.resolve() : new Promise(function (ok) {
      var s = doc.createElement('script'); s.src = 'sprache/index.js'; s.onload = ok; s.onerror = ok; doc.head.appendChild(s);
    });
    haveIdx.then(leseVorhanden).then(function () {
      if (!dlg) return; gr = pure.gruppen(root.SpeakAudio); ui.txt.textContent = ''; zeilen();
    });
  }
  /* ---------- "Alles offline laden": ein Dialog fuer alle Gruppen nacheinander ---------- */
  var ua = {}, P = null;
  function ladeIndex() { return root.SpeakAudio ? Promise.resolve() : new Promise(function (ok) { var s = doc.createElement('script'); s.src = 'sprache/index.js'; s.onload = ok; s.onerror = ok; doc.head.appendChild(s); }); }
  function schaetzung() {
    return new Promise(function (ok) {
      try {
        var s = root.navigator.storage; if (!s || !s.estimate) return ok(null);
        var t = setTimeout(function () { ok(null); }, 2500);
        s.estimate().then(function (e) { clearTimeout(t); ok(e); }, function () { clearTimeout(t); ok(null); });
      } catch (e) { ok(null); }
    });
  }
  function kn(txt, cls, fn) { var b = h('button', cls || null, txt); b.type = 'button'; b.addEventListener('click', fn); return b; }
  function knoepfe(list) { ua.k.textContent = ''; list.forEach(function (b) { ua.k.appendChild(b); }); }
  function zeig(txt, kl) { ua.txt.textContent = txt; ua.txt.className = 'vo-t vo-h' + (kl ? ' ' + kl : ''); }
  function melde() { try { root.dispatchEvent(new root.CustomEvent('vorlesen-offline-geaendert')); } catch (e) {} }
  function setProg(i, n, f, bytes, nDl) {
    var avg = nDl ? bytes / nDl : KB * 1024, tot = bytes + Math.max(0, n - i) * avg;
    ua.fill.style.width = (n ? Math.round(i / n * 100) : 0) + '%';
    ua.prog.textContent = pure.zahl(i) + ' von ' + pure.zahl(n) + ' Dateien · ' + pure.mbBytes(bytes) + ' von etwa ' + pure.mbBytes(tot) + (f ? ' · ' + f + ' Fehler' : '');
  }
  function planen(auto) {
    var my = dlg; if (!my) return Promise.resolve();
    zeig('Liste wird gelesen …'); ua.det.textContent = ''; ua.warn.textContent = ''; ua.warn.hidden = true; ua.bar.hidden = true; ua.prog.textContent = '';
    knoepfe([kn('Abbrechen', null, schliessen)]);
    return ladeIndex().then(leseVorhanden).then(function () {
      if (dlg !== my) return;
      var zu = kn('Schließen', null, schliessen);
      if (!cacheName) { zeig('Nicht möglich: Der Offline-Speicher ist hier nicht verfügbar (Service Worker noch nicht aktiv oder Privatmodus). Lade die Seite einmal neu.', 'vo-e'); knoepfe([zu]); return; }
      P = pure.plan(root.SpeakAudio, function (u) { return vorhanden[abs(u)]; });
      if (!P.gesamt) { zeig('Keine Vorlese-Aufnahmen gefunden. Die Liste konnte nicht gelesen werden.', 'vo-e'); knoepfe([zu]); return; }
      if (!P.offen.length) { zeig('Fertig: Alle ' + pure.zahl(P.gesamt) + ' Vorlese-Aufnahmen sind offline auf deinem Gerät ✓', 'vo-ok'); knoepfe([zu]); melde(); return; }
      var bedarf = pure.schaetzBytes(P.offen.length);
      return schaetzung().then(function (est) {
        if (dlg !== my) return;
        var pl = pure.platz(est, bedarf), weiter = P.da > 0;
        zeig(weiter ? 'Weitermachen: Ein Teil ist schon da, den Rest holst du jetzt.' : 'Alle Vorlese-Aufnahmen auf dein Gerät laden, damit sie auch ohne Netz laufen.');
        ua.det.textContent = 'Noch zu laden: ' + pure.zahl(P.offen.length) + ' Dateien, etwa ' + pure.mbBytes(bedarf) + (weiter ? '. Schon auf deinem Gerät: ' + pure.zahl(P.da) + ' von ' + pure.zahl(P.gesamt) + ' Dateien' : '') + '. Das dauert je nach Netz ein paar Minuten. Am besten im WLAN, sonst brauchst du viel Datenvolumen. Die Größe ist eine Schätzung.';
        if (pl.stufe === 'zuwenig') { ua.warn.textContent = 'Zu wenig Platz: Du brauchst etwa ' + pure.mbBytes(bedarf) + ', frei sind etwa ' + pure.mbBytes(pl.frei) + '. Mach zuerst Platz frei (zum Beispiel Apps oder Videos löschen). Du kannst auch nur einzelne Gruppen laden.'; ua.warn.className = 'vo-t vo-w vo-e'; }
        else if (pl.stufe === 'knapp') { ua.warn.textContent = 'Achtung, der Platz ist knapp: Du brauchst etwa ' + pure.mbBytes(bedarf) + ', frei sind etwa ' + pure.mbBytes(pl.frei) + '. Du kannst trotzdem starten. Wenn der Speicher voll ist, hört das Laden von selbst auf.'; ua.warn.className = 'vo-t vo-w'; }
        else if (pl.stufe === 'unbekannt') { ua.warn.textContent = 'Dein Browser sagt nicht, wie viel Platz frei ist. Du kannst trotzdem starten.'; ua.warn.className = 'vo-t vo-w'; }
        ua.warn.hidden = pl.stufe === 'ok';
        var st = kn(weiter ? 'Weitermachen' : 'Start', 'vo-p', lauf); st.disabled = pl.stufe === 'zuwenig';
        var lst = [st];
        if (pl.stufe === 'zuwenig') lst.push(kn('Nach Gruppen laden', null, function () { var o = opts; schliessen(); open(o); }));
        lst.push(kn('Abbrechen', null, schliessen)); knoepfe(lst);
        if (auto && pl.stufe !== 'zuwenig') lauf(); else { try { st.focus(); } catch (e) {} }
      });
    }).catch(function () { if (dlg === my) { zeig('Das hat nicht geklappt. Versuche es später noch einmal.', 'vo-e'); knoepfe([kn('Schließen', null, schliessen)]); } });
  }
  function lauf() {
    if (aktiv || !P || !dlg) return;
    var my = dlg, offen = P.offen.slice(), bytes = 0, nDl = 0;
    aktiv = true; abbr = { abbruch: false, ctl: typeof AbortController !== 'undefined' ? new AbortController() : null }; var ab = abbr;
    ua.warn.hidden = true; ua.det.textContent = ''; ua.bar.hidden = false; zeig('Die Aufnahmen werden geladen. Lass diese Seite offen.'); setProg(0, offen.length, 0, 0, 0);
    knoepfe([kn('Abbrechen', null, function () { ab.abbruch = true; if (ab.ctl) try { ab.ctl.abort(); } catch (e) {} zeig('Wird abgebrochen …'); })]);
    holeCacheName().then(function (nm) {
      if (!nm) throw new Error('kein Cache');
      return root.caches.open(nm);
    }).then(function (cache) {
      return pure.laden(offen, {
        abbruch: function () { return ab.abbruch; },
        vorhanden: function (u) { return cache.match(u).then(function (r) { return !!r; }); },
        hole: function (u) {
          return pure.holeDatei(fetch, cache, u, ab.ctl && ab.ctl.signal).then(function (n) { if (!n) return false; vorhanden[abs(u)] = 1; bytes += n; nDl++; return true; });
        },
        fortschritt: function (i, n, f) { if (dlg === my && ab === abbr) setProg(i, n, f, bytes, nDl); }
      }, PAR);
    }).then(function (res) {
      if (dlg !== my || ab !== abbr) return;
      aktiv = false; ua.fill.style.width = '100%';
      var rest = P.offen.filter(function (d) { return !vorhanden[abs(d.url)]; }).length, fehlt = pure.zahl(rest) + (rest === 1 ? ' Datei fehlt' : ' Dateien fehlen') + ' noch.';
      var zu = kn('Schließen', null, schliessen), nochmal = function (t) { return kn(t, 'vo-p', function () { planen(true); }); };
      if (res.speicherVoll) { zeig('Der Speicher ist voll. ' + fehlt + ' Mach Platz frei und starte dann noch einmal. Was schon geladen ist, bleibt gespeichert.', 'vo-e'); knoepfe([nochmal('Nochmal versuchen'), zu]); }
      else if (res.abgebrochen) { zeig('Abgebrochen. ' + (rest ? fehlt + ' ' : '') + 'Was schon geladen ist, bleibt gespeichert.'); knoepfe(rest ? [nochmal('Weitermachen'), zu] : [zu]); }
      else if (res.keinNetz) { zeig('Die Verbindung ist weg. ' + fehlt + ' Verbinde dich mit dem WLAN und mach dann weiter. Was schon geladen ist, bleibt gespeichert.', 'vo-e'); knoepfe([nochmal('Weitermachen'), zu]); }
      else if (rest) { zeig(fehlt + ' Das kann am Netz liegen.', 'vo-e'); knoepfe([nochmal('Nochmal versuchen'), zu]); }
      else { zeig('Fertig: Alle ' + pure.zahl(P.gesamt) + ' Vorlese-Aufnahmen sind jetzt offline auf deinem Gerät ✓', 'vo-ok'); knoepfe([zu]); }
      melde();
    }).catch(function () {
      aktiv = false; if (dlg !== my) return;
      zeig('Nicht möglich: Der Offline-Speicher ist hier nicht verfügbar. Lade die Seite einmal neu.', 'vo-e'); knoepfe([kn('Schließen', null, schliessen)]);
    });
  }
  function alles(o) {
    opts = o || {};
    if (dlg) return;
    if (!root.caches) { try { root.alert('Offline-Speicher ist in diesem Browser nicht verfügbar.'); } catch (e) {} return; }
    css();
    dlg = h('div'); dlg.id = 'voOff';
    var box = h('div', 'vo-box'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Alles offline laden (Vorlesen)');
    var k = h('div', 'vo-k'), tt = h('h2', null, 'Alles offline laden (Vorlesen)'), x = h('button', null, '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Schließen'); x.addEventListener('click', schliessen);
    k.appendChild(tt); k.appendChild(x);
    var body = h('div', 'vo-l');
    ua.txt = h('p', 'vo-t vo-h'); ua.txt.setAttribute('aria-live', 'polite');
    ua.det = h('p', 'vo-t'); ua.warn = h('p', 'vo-t vo-w'); ua.warn.hidden = true;
    var bw = h('div', 'vo-t'); ua.bar = h('div', 'vo-b'); ua.fill = h('i'); ua.bar.appendChild(ua.fill); ua.bar.hidden = true; bw.appendChild(ua.bar);
    ua.prog = h('p', 'vo-t');
    var hw = h('p', 'vo-t vo-m', 'Tipp für iPhone und iPad: Füge die Seite zum Home-Bildschirm hinzu und öffne sie ab und zu. Dann räumt dein Gerät die Aufnahmen nicht so schnell wieder weg.');
    [ua.txt, ua.det, ua.warn, bw, ua.prog, hw].forEach(function (e) { body.appendChild(e); });
    ua.k = h('div', 'vo-f vo-kn');
    box.appendChild(k); box.appendChild(body); box.appendChild(ua.k);
    dlg.appendChild(box); dlg.addEventListener('click', function (ev) { if (ev.target === dlg && !aktiv) schliessen(); });
    doc.body.appendChild(dlg); doc.addEventListener('keydown', taste, true); try { x.focus(); } catch (e) {}
    planen(false);
  }
  /* Status fuer die Offline-Karte: wie viele aller Aufnahmen liegen schon im Cache -> {ja, da, gesamt, text} oder null */
  function status() {
    return ladeIndex().then(leseVorhanden).then(function () {
      if (!cacheName || !root.SpeakAudio) return null;
      var p = pure.plan(root.SpeakAudio, function (u) { return vorhanden[abs(u)]; });
      return pure.status(p.gesamt, p.da);
    });
  }
  root.VorlesenOffline = { open: open, alles: alles, status: status, gruppen: pure.gruppen, laden: pure.laden };
})();
