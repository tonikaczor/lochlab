/* Gerätetest, reiner Kern (ohne DOM, ohne Netz): Gerät erkennen, Messwerte bewerten, Bericht formatieren.
   Jede bewerte*-Funktion bekommt einfache Messwerte (Objekt) und liefert eine Liste von Ergebnissen
   { id, gruppe, titel, status: 'ok' | 'fail' | 'warn' | 'offen', text, tipp }.
   ok = ✓, fail = ✗, warn und offen = ! (nicht prüfbar bzw. noch nicht gemacht).
   Der Bericht enthält nur technische Daten des Geräts: keine Namen, keinen Lernstand, keine Zugangsdaten.
   Die Funktionen parseSw/neuester/zaehle stammen aus offline-status.js (dort geprüft) und sind hier bewusst als Kopie, damit die Testseite
   die Offline-Anzeige der Startseite nicht mitladen muss. Test: quelle/geraetetest/test_core.js */
(function (root) {
  'use strict';
  var ICON = { ok: '✓', fail: '✗', warn: '!', offen: '!' };
  var GRUPPEN = { umgebung: 'Umgebung', sw: 'Service Worker', speicher: 'Speicher', offline: 'Offline-Fähigkeit', vorlesen: 'Vorlesen', touch: 'Canvas und Touch', leistung: 'Leistung', anzeige: 'Anzeige' };

  function R(id, gruppe, titel, status, text, tipp) { var r = { id: id, gruppe: gruppe, titel: titel, status: status, text: text }; if (tipp) r.tipp = tipp; return r; }
  function num(v) { return typeof v === 'number' && isFinite(v); }
  function zahl(v, n) { var f = Math.pow(10, n == null ? 1 : n); return String(Math.round(v * f) / f).replace('.', ','); }
  function mb(bytes) { return num(bytes) ? zahl(bytes / 1048576, bytes < 10485760 ? 1 : 0) + ' MB' : '?'; }
  function liste(a, max) { a = a || []; max = max || 3; return a.slice(0, max).join(', ') + (a.length > max ? ' u. a. (' + a.length + ' insgesamt)' : ''); }

  /* ---- Gerät aus User-Agent erkennen. iPadOS 13+ meldet sich als "Macintosh" und ist nur über maxTouchPoints > 1 vom Mac zu unterscheiden ---- */
  function erkenneGeraet(d) {
    d = d || {}; var ua = String(d.ua || ''), touch = d.maxTouch || 0, m, g = { art: 'unbekannt', os: '', osVer: '', browser: 'unbekannt', browserVer: '', ios: false, safariVer: '' };
    var iphone = /iPhone|iPod/.test(ua), ipad = /iPad/.test(ua) || (/Macintosh/.test(ua) && touch > 1);
    if (iphone || ipad) {
      g.ios = true; g.art = iphone ? 'iPhone' : 'iPad'; g.os = iphone ? 'iOS' : 'iPadOS';
      m = /OS (\d+)[_.](\d+)(?:[_.](\d+))?/.exec(ua); if (m && !(ipad && /Macintosh/.test(ua))) g.osVer = m[1] + '.' + m[2] + (m[3] ? '.' + m[3] : '');
      m = /Version\/(\d+(?:\.\d+)*)/.exec(ua); if (m) g.safariVer = m[1];
      if (!g.osVer && g.safariVer) g.osVer = g.safariVer + ' (geschätzt aus Safari)';   // iPad im Desktop-Modus: kein echter OS-Wert im UA, Safari-Nummer entspricht meist der iPadOS-Nummer
    } else if (/Android/.test(ua)) {
      g.art = /Mobile/.test(ua) ? 'Android-Handy' : 'Android-Tablet'; g.os = 'Android'; m = /Android (\d+(?:\.\d+)*)/.exec(ua); if (m) g.osVer = m[1];
    } else if (/Windows NT/.test(ua)) { g.art = 'Windows-PC'; g.os = 'Windows'; m = /Windows NT (\d+(?:\.\d+)?)/.exec(ua); if (m) g.osVer = m[1]; }
    else if (/Macintosh/.test(ua)) { g.art = 'Mac'; g.os = 'macOS'; }
    else if (/Linux|X11/.test(ua)) { g.art = 'Linux-PC'; g.os = 'Linux'; }
    if ((m = /(CriOS|FxiOS|EdgiOS|OPiOS)\/(\d+(?:\.\d+)*)/.exec(ua))) { g.browser = { CriOS: 'Chrome (iOS)', FxiOS: 'Firefox (iOS)', EdgiOS: 'Edge (iOS)', OPiOS: 'Opera (iOS)' }[m[1]]; g.browserVer = m[2]; }
    else if ((m = /Edg(?:e|A)?\/(\d+(?:\.\d+)*)/.exec(ua))) { g.browser = 'Edge'; g.browserVer = m[1]; }
    else if ((m = /SamsungBrowser\/(\d+(?:\.\d+)*)/.exec(ua))) { g.browser = 'Samsung Internet'; g.browserVer = m[1]; }
    else if ((m = /Firefox\/(\d+(?:\.\d+)*)/.exec(ua))) { g.browser = 'Firefox'; g.browserVer = m[1]; }
    else if ((m = /Chrome\/(\d+(?:\.\d+)*)/.exec(ua))) { g.browser = 'Chrome'; g.browserVer = m[1]; }
    else if ((m = /Version\/(\d+(?:\.\d+)*).*Safari/.exec(ua))) { g.browser = 'Safari'; g.browserVer = m[1]; }
    return g;
  }
  function geraetText(g) {
    if (!g || !g.art) return '?';
    var t = g.art + (g.os ? ' · ' + g.os + (g.osVer ? ' ' + g.osVer : '') : '');
    if (g.browser !== 'unbekannt') t += ' · ' + g.browser + (g.browserVer ? ' ' + g.browserVer : '');
    return t;
  }
  /* ältestes iOS, das Tonfunk Lab sicher kann, ist nicht gemessen: nur eine Warnschwelle für sehr alte Versionen (kein Service-Worker-Support für Home-Bildschirm-Apps davor unsicher) */
  function iosAlt(g) { var v = g && g.ios ? parseInt(g.osVer, 10) : NaN; return num(v) && v < 15; }

  /* ---- Service-Worker-Liste (Kopie aus offline-status.js) ---- */
  function parseSw(txt) {
    var f = /const FILES = \[([^\]]*)\]/.exec(txt || ''), c = /const CACHE = '([^']+)'/.exec(txt || '');
    return { files: f ? (f[1].match(/'[^']*'/g) || []).map(function (s) { return s.slice(1, -1); }) : [], cache: c ? c[1] : '' };
  }
  function neuester(namen) {
    var v = function (n) { return (/^lochlab-v(\d+(?:\.\d+)*)/.exec(n) || [0, '0'])[1].split('.').map(Number); };
    return (namen || []).filter(function (n) { return /^lochlab-v\d/.test(n); }).sort(function (a, b) {
      var x = v(a), y = v(b); for (var i = 0; i < Math.max(x.length, y.length); i++) { var d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0;
    }).pop() || null;
  }
  function zaehle(files, urls, base) {
    var set = {}, path = {}, n = 0, miss = [];
    (urls || []).forEach(function (u) { set[u] = 1; path[u.split('?')[0].split('#')[0]] = 1; });
    (files || []).forEach(function (f) {
      var u; try { u = new URL(f, base).href; } catch (e) { return; }
      if (set[u] || path[u.split('?')[0]]) n++; else miss.push(f);
    });
    return { ist: n, soll: (files || []).length, fehlt: miss };
  }
  /* Version aus dem Text von ver.js ("var V = 'v62.173'") */
  function parseVer(txt) { var m = /var V\s*=\s*'([^']+)'/.exec(txt || ''); return m ? m[1] : ''; }
  /* "viewport"-Meta: sperrt sie das Zoomen? */
  function zoomGesperrt(content) { var c = String(content || '').toLowerCase().replace(/\s+/g, ''); return /user-scalable=(no|0)/.test(c) || /maximum-scale=1(\.0*)?(,|$)/.test(c); }

  /* ---- 1 Umgebung ---- */
  function bewerteUmgebung(d) {
    d = d || {}; var g = 'umgebung', a = [], gt = d.geraet || {};
    if (d.version) a.push(R('version', g, 'Version der App', 'ok', 'Tonfunk Lab ' + d.version + (d.swCache && d.swCache !== 'lochlab-' + d.version ? ' (Cache: ' + d.swCache + ')' : '') + '.'));
    else a.push(R('version', g, 'Version der App', 'warn', 'Version nicht lesbar (ver.js nicht erreichbar).', 'Mit Internet neu laden und den Test wiederholen.'));
    a.push(R('geraet', g, 'Gerät und Browser', iosAlt(gt) ? 'warn' : 'ok', geraetText(gt) + '.', iosAlt(gt) ? 'Dieses iOS ist sehr alt. Wenn etwas nicht geht: wenn möglich auf eine neuere Version aktualisieren.' : ''));
    if (d.standalone) a.push(R('standalone', g, 'Home-Bildschirm-App', 'ok', 'Ja, die Seite läuft als App (ohne Browserleiste).'));
    else if (gt.ios) a.push(R('standalone', g, 'Home-Bildschirm-App', 'warn', 'Nein, die Seite läuft im Safari-Tab.', 'Für die beste Offline-Nutzung: in Safari auf Teilen tippen und „Zum Home-Bildschirm“ wählen, dann die App vom Home-Bildschirm starten.'));
    else a.push(R('standalone', g, 'Home-Bildschirm-App', 'ok', 'Nein, normaler Browser-Tab (auf diesem Gerät kein Problem).'));
    if (d.online === false) a.push(R('online', g, 'Online-Status', 'warn', 'Das Gerät meldet: keine Verbindung.', 'Das ist richtig, wenn du absichtlich offline testest. Sonst WLAN prüfen.'));
    else a.push(R('online', g, 'Online-Status', 'ok', 'Das Gerät meldet: online.'));
    var sperr = zoomGesperrt(d.meta);
    if (sperr) a.push(R('zoom', g, 'Zoom möglich', 'fail', 'Die Seite sperrt das Zoomen (viewport-Angabe).', 'Meldung an den Ausbilder: Zoom muss erlaubt bleiben.'));
    else a.push(R('zoom', g, 'Zoom möglich', 'ok', 'Zoom ist nicht gesperrt' + (num(d.vvScale) ? ' (aktuelle Vergrößerung ' + zahl(d.vvScale, 2) + 'fach).' : '.') + ' Zum Ausprobieren mit zwei Fingern auseinanderziehen.'));
    a.push(R('motion', g, 'Bewegung reduzieren', 'ok', d.reduced ? 'An: Animationen werden gedämpft (Einstellung des Geräts).' : 'Aus: normale Animationen.'));
    a.push(R('scheme', g, 'Farbschema des Geräts', 'ok', d.scheme === 'dark' ? 'Dunkel.' : d.scheme === 'light' ? 'Hell.' : 'Nicht erkennbar (Standard wird genutzt).'));
    return a;
  }

  /* ---- 2 Service Worker ---- */
  function bewerteSw(d) {
    d = d || {}; var g = 'sw', a = [], reg = d.reg;
    if (!d.api) { a.push(R('sw-reg', g, 'Service Worker registriert', 'fail', 'Dieser Browser kann hier keinen Service Worker nutzen.', 'Seite über https öffnen, nicht im privaten Modus. Online funktioniert alles, offline nicht.')); return a; }
    if (!reg) { a.push(R('sw-reg', g, 'Service Worker registriert', 'fail', 'Noch nicht registriert.', 'Startseite einmal mit Internet öffnen, kurz warten und die Seite neu laden.')); return a; }
    a.push(R('sw-reg', g, 'Service Worker registriert', 'ok', 'Ja' + (reg.scope ? ' (Bereich ' + reg.scope.replace(/^https?:\/\/[^/]+/, '') + ').' : '.')));
    if (reg.active && d.controller) a.push(R('sw-aktiv', g, 'Service Worker aktiv', 'ok', 'Aktiv und steuert diese Seite.'));
    else if (reg.active) a.push(R('sw-aktiv', g, 'Service Worker aktiv', 'warn', 'Aktiv, steuert diese Seite aber noch nicht.', 'Seite einmal neu laden, dann den Test wiederholen.'));
    else if (reg.installing) a.push(R('sw-aktiv', g, 'Service Worker aktiv', 'warn', 'Wird gerade installiert.', 'Ein paar Sekunden mit Internet warten und den Test wiederholen.'));
    else a.push(R('sw-aktiv', g, 'Service Worker aktiv', 'fail', 'Registriert, aber nicht aktiv.', 'Seite neu laden. Hilft das nicht: die App vom Home-Bildschirm entfernen und neu hinzufügen.'));
    if (!d.cacheName) a.push(R('sw-cache', g, 'Offline-Speicher (Cache)', 'fail', 'Kein Cache „lochlab-v…“ gefunden.', 'Mit WLAN verbunden bleiben, Startseite öffnen und warten, bis dort „Offline bereit ✓“ steht.'));
    else {
      var soll = d.soll, ist = d.ist, n = d.fehlt || [];
      if (!num(soll) || !soll) a.push(R('sw-cache', g, 'Offline-Speicher (Cache)', 'warn', 'Cache ' + d.cacheName + ' vorhanden, Sollliste (sw.js) nicht lesbar.', 'Mit Internet erneut testen.'));
      else if (ist >= soll) a.push(R('sw-cache', g, 'Offline-Speicher (Cache)', 'ok', 'Cache ' + d.cacheName + ': alle ' + soll + ' Dateien gespeichert.'));
      else a.push(R('sw-cache', g, 'Offline-Speicher (Cache)', ist === 0 ? 'fail' : 'warn', 'Cache ' + d.cacheName + ': ' + ist + ' von ' + soll + ' Dateien. Es fehlen ' + (soll - ist) + (n.length ? ' (z. B. ' + liste(n, 3) + ')' : '') + '.', 'Mit WLAN verbunden bleiben, Startseite öffnen und warten, bis „Offline bereit ✓“ steht. Dann den Test wiederholen.'));
    }
    if (reg.waiting) a.push(R('sw-update', g, 'Update-Status', 'warn', 'Eine neue Version wartet auf den Neustart.', 'App komplett schließen (im App-Wechsler nach oben wischen) und neu starten.'));
    else if (d.swSoll && d.cacheName && d.swSoll !== d.cacheName && neuester([d.swSoll, d.cacheName]) === d.swSoll) a.push(R('sw-update', g, 'Update-Status', 'warn', 'Auf dem Server liegt eine neuere Version (' + d.swSoll + ') als im Gerät (' + d.cacheName + ').', 'Mit Internet die Startseite öffnen, App schließen und neu starten.'));
    else if (d.updateFehler) a.push(R('sw-update', g, 'Update-Status', 'warn', 'Update-Abfrage nicht möglich (' + d.updateFehler + ').', 'Mit Internet erneut testen.'));
    else a.push(R('sw-update', g, 'Update-Status', 'ok', 'Aktuell, kein Update ausstehend.'));
    return a;
  }

  /* ---- 3 Speicher ---- */
  function bewerteSpeicher(d) {
    d = d || {}; var g = 'speicher', a = [];
    a.push(d.ls ? R('ls', g, 'localStorage', 'ok', 'Schreiben und Lesen funktioniert (hier wird der Lernstand gespeichert).')
      : R('ls', g, 'localStorage', 'fail', 'Speichern nicht möglich' + (d.lsFehler ? ' (' + d.lsFehler + ')' : '') + '.', 'Privaten Modus beenden. Auf iPhone und iPad: In den iOS-Einstellungen bei Safari prüfen, ob „Alle Cookies blockieren“ ausgeschaltet ist.'));
    a.push(d.idb ? R('idb', g, 'IndexedDB', 'ok', 'Schreiben und Lesen funktioniert.')
      : R('idb', g, 'IndexedDB', 'fail', 'Nicht verfügbar' + (d.idbFehler ? ' (' + d.idbFehler + ')' : '') + '.', 'Privaten Modus beenden, Gerät neu starten. Der Lernstand läuft über localStorage, einzelne Zusatzfunktionen können fehlen.'));
    if (d.persistApi === false) a.push(R('persist', g, 'Dauerhafter Speicher', 'warn', 'Diese Funktion gibt es auf diesem Gerät nicht.', 'Kein Fehler. Als Home-Bildschirm-App ist der Speicher meist am sichersten.'));
    else if (d.persisted) a.push(R('persist', g, 'Dauerhafter Speicher', 'ok', 'Der Browser hat den Speicher als „dauerhaft“ markiert (wird nicht automatisch gelöscht).'));
    else a.push(R('persist', g, 'Dauerhafter Speicher', 'warn', 'Nicht als „dauerhaft“ markiert' + (d.persistFrage ? ' (Anfrage wurde abgelehnt)' : '') + '.', 'Der Browser kann gespeicherte Daten bei Speichermangel löschen. Im Safari-Tab kann iOS Daten nach längerer Nichtnutzung entfernen; als Home-Bildschirm-App ist das Risiko geringer.'));
    if (num(d.usage) && num(d.quota)) {
      var anteil = d.quota > 0 ? d.usage / d.quota : 0;
      a.push(R('estimate', g, 'Speicherplatz', anteil > 0.8 || d.quota < 52428800 ? 'warn' : 'ok', 'Belegt ' + mb(d.usage) + ' von ' + mb(d.quota) + ' erlaubt (' + zahl(anteil * 100, anteil < 0.1 ? 1 : 0) + ' %).', anteil > 0.8 ? 'Speicher fast voll: nicht mehr benötigte Apps und Fotos auf dem Gerät löschen.' : d.quota < 52428800 ? 'Sehr wenig Platz erlaubt, evtl. privater Modus oder Gerät fast voll.' : ''));
    } else a.push(R('estimate', g, 'Speicherplatz', 'warn', 'Der Browser nennt keine Speichergröße.', 'Kein Fehler, nur nicht prüfbar.'));
    return a;
  }

  /* ---- 4a Offline-Fähigkeit vor dem Flugmodus: liegen die Kernseiten im Cache? ---- */
  function bewerteCacheSeiten(d) {
    d = d || {}; var g = 'offline', ges = d.gesucht || [], fund = d.gefunden || [], fehlt = ges.filter(function (x) { return fund.indexOf(x) < 0; });
    if (d.fehler) return [R('cache-seiten', g, 'Kernseiten im Speicher', 'warn', 'Nicht prüfbar (' + d.fehler + ').', 'Seite über https öffnen und mit Internet erneut testen.')];
    if (!ges.length) return [R('cache-seiten', g, 'Kernseiten im Speicher', 'warn', 'Keine Seitenliste vorhanden.')];
    if (!fehlt.length) return [R('cache-seiten', g, 'Kernseiten im Speicher', 'ok', 'Alle ' + ges.length + ' geprüften Kernseiten liegen im Speicher.')];
    return [R('cache-seiten', g, 'Kernseiten im Speicher', fund.length ? 'warn' : 'fail', fund.length + ' von ' + ges.length + ' Kernseiten im Speicher, es fehlen: ' + liste(fehlt, 4) + '.', 'Mit WLAN die Startseite öffnen und warten, bis „Offline bereit ✓“ steht. Dann den Test wiederholen.')];
  }

  /* ---- 4b Range-Anfrage (Audio auf iOS fragt mit Range an): 206 und passendes Content-Range ---- */
  function rangeBewerte(r, von, bis) {
    r = r || {}; von = von == null ? 0 : von; bis = bis == null ? 1023 : bis;
    if (r.fehler) return { ok: false, text: 'Anfrage fehlgeschlagen (' + r.fehler + ').' };
    if (r.status === 200) return { ok: false, text: 'Antwort 200 (ganze Datei) statt 206. iOS kann Aufnahmen dann nicht abspielen.' };
    if (r.status !== 206) return { ok: false, text: 'Unerwartete Antwort ' + r.status + ' statt 206.' };
    var m = /^bytes (\d+)-(\d+)\/(\d+|\*)$/.exec(String(r.contentRange || '').trim());
    if (!m) return { ok: false, text: '206 ohne gültiges Content-Range (' + (r.contentRange || 'fehlt') + ').' };
    var a = +m[1], z = +m[2], total = m[3] === '*' ? null : +m[3], wantEnd = total == null ? bis : Math.min(bis, total - 1);
    if (a !== von || z !== wantEnd) return { ok: false, text: 'Content-Range ' + r.contentRange + ' passt nicht zu bytes=' + von + '-' + bis + '.' };
    if (num(r.laenge) && r.laenge !== z - a + 1) return { ok: false, text: 'Content-Range sagt ' + (z - a + 1) + ' Byte, geliefert wurden ' + r.laenge + '.' };
    return { ok: true, text: '206, Content-Range ' + r.contentRange + (num(r.laenge) ? ', ' + r.laenge + ' Byte' : '') + '.' };
  }

  /* ---- 4c Flugmodus-Test (Nutzer hat Flugmodus eingeschaltet, Seite hat Seiten, MP3 und Range geladen) ---- */
  function bewerteFlug(d) {
    d = d || {}; var g = 'offline', a = [], s = d.seiten || [], gut = s.filter(function (x) { return x.ok; }), schlecht = s.filter(function (x) { return !x.ok; });
    if (d.online === true) a.push(R('flug-modus', g, 'Flugmodus erkannt', 'warn', 'Das Gerät meldet noch eine Verbindung. Das Ergebnis sagt dann nichts über offline.', 'Flugmodus einschalten (WLAN muss auch aus sein) und den Test wiederholen.'));
    else a.push(R('flug-modus', g, 'Flugmodus erkannt', 'ok', 'Das Gerät meldet: keine Verbindung.'));
    if (!s.length) a.push(R('flug-seiten', g, 'Lab-Seiten offline', 'warn', 'Keine Seite geprüft.'));
    else if (!schlecht.length) a.push(R('flug-seiten', g, 'Lab-Seiten offline', 'ok', 'Alle ' + s.length + ' Lab-Seiten haben sich ohne Netz geladen.'));
    else a.push(R('flug-seiten', g, 'Lab-Seiten offline', gut.length ? 'warn' : 'fail', gut.length + ' von ' + s.length + ' Seiten geladen. Nicht geladen: ' + liste(schlecht.map(function (x) { return x.name; }), 4) + '.', 'Mit WLAN die Startseite öffnen und warten, bis „Offline bereit ✓“ steht. Dann den Flugmodus-Test wiederholen.'));
    var m = d.mp3 || {};
    if (!m.name) a.push(R('flug-mp3', g, 'Aufnahme offline', 'warn', 'Keine Aufnahme zum Prüfen gefunden.'));
    else if (m.ok) a.push(R('flug-mp3', g, 'Aufnahme offline', 'ok', m.name + ' geladen (' + (num(m.bytes) ? Math.round(m.bytes / 1024) + ' KB' : 'ok') + ').'));
    else a.push(R('flug-mp3', g, 'Aufnahme offline', 'fail', m.name + ' ließ sich ohne Netz nicht laden' + (m.fehler ? ' (' + m.fehler + ')' : '') + '.', 'Auf der Startseite „Alles offline laden (Vorlesen)“ antippen (mit WLAN), dann wiederholen.'));
    var rb = rangeBewerte(d.range, 0, 1023);
    if (!d.range) a.push(R('flug-range', g, 'Teilstück anfordern (Range)', 'warn', 'Nicht geprüft.'));
    else a.push(R('flug-range', g, 'Teilstück anfordern (Range)', rb.ok ? 'ok' : 'fail', rb.text, rb.ok ? '' : 'Wenn das auch nach einem Neustart der App so bleibt: Foto an den Ausbilder schicken.'));
    return a;
  }

  /* ---- 5 Vorlesen ---- */
  function bewerteVorlesen(d) {
    d = d || {}; var g = 'vorlesen', a = [];
    if (num(d.indexAnzahl) && d.indexAnzahl > 0) a.push(R('v-index', g, 'Aufnahmen-Verzeichnis', 'ok', d.indexAnzahl + ' Aufnahmen im Verzeichnis (SpeakAudio).'));
    else a.push(R('v-index', g, 'Aufnahmen-Verzeichnis', 'fail', 'Verzeichnis nicht geladen' + (d.indexFehler ? ' (' + d.indexFehler + ')' : '') + '.', 'Mit Internet neu laden und den Test wiederholen.'));
    var m = d.mp3;
    if (!m) a.push(R('v-mp3', g, 'Aufnahme abspielen', 'offen', 'Noch nicht gemacht: unten „Ton testen“ antippen.', 'Auf iPhone und iPad startet Ton erst nach einem Tipp. Lautstärke hochdrehen und die Stumm-Taste prüfen.'));
    else if (m.ok) a.push(R('v-mp3', g, 'Aufnahme abspielen', 'ok', 'Abspielbar: ' + m.name + ', Länge ' + zahl(m.dauer, 1) + ' s' + (m.spielt ? ', Wiedergabe gestartet' : '') + '.'));
    else a.push(R('v-mp3', g, 'Aufnahme abspielen', 'fail', 'Abspielen nicht möglich' + (m.fehler ? ' (' + m.fehler + ')' : '') + '.', m.fehler && /NotAllowed/i.test(m.fehler) ? 'Der Browser hat den Ton blockiert. Noch einmal direkt auf den Knopf tippen, Lautstärke und Stumm-Schalter prüfen.' : 'Mit Internet erneut versuchen. Bleibt es so: Foto an den Ausbilder schicken.'));
    var v = d.stimmen || {};
    if (v.api === false) a.push(R('v-stimme', g, 'Gerätestimme', 'warn', 'Dieser Browser hat keine Sprachausgabe.', 'Die Aufnahmen funktionieren trotzdem. Nur Texte ohne Aufnahme werden nicht vorgelesen.'));
    else if (num(v.anzahl) && v.deutsch && v.deutsch.length) a.push(R('v-stimme', g, 'Gerätestimme', 'ok', v.deutsch.length + ' deutsche Stimme' + (v.deutsch.length > 1 ? 'n' : '') + ' (' + liste(v.deutsch, 2) + '), insgesamt ' + v.anzahl + '.'));
    else a.push(R('v-stimme', g, 'Gerätestimme', 'warn', num(v.anzahl) && v.anzahl ? 'Keine deutsche Stimme unter ' + v.anzahl + ' Stimmen.' : 'Keine Stimme gemeldet (die Liste füllt sich manchmal erst nach einigen Sekunden).', 'Die Aufnahmen funktionieren trotzdem. Eine deutsche Stimme lässt sich meist in den Einstellungen unter Bedienungshilfen → Gesprochene Inhalte laden.'));
    a.push(R('v-ios', g, 'Hinweis Ton', 'ok', d.ios ? 'iPhone/iPad: Ton startet erst nach einem Tipp auf „Vorlesen“. Das ist normal, kein Fehler.' : 'Manche Geräte starten Ton nur nach einem Tipp.'));
    return a;
  }

  /* ---- 6 Canvas / Touch ---- */
  function bewerteTouch(d) {
    d = d || {}; var g = 'touch', a = [];
    if (!d.canvas) a.push(R('canvas', g, 'Zeichenfläche (Canvas)', 'fail', 'Canvas 2D nicht verfügbar.', 'Browser aktualisieren oder Safari/Chrome statt eines anderen Browsers nutzen. Ohne Canvas bleiben Schaltungen und Kurven leer.'));
    else if (d.pixelOk === false) a.push(R('canvas', g, 'Zeichenfläche (Canvas)', 'fail', 'Canvas 2D vorhanden, Zeichnen liefert aber falsche Pixel.', 'Seite neu laden. Bleibt es so: Foto an den Ausbilder schicken.'));
    else a.push(R('canvas', g, 'Zeichenfläche (Canvas)', 'ok', 'Canvas 2D funktioniert, Pixeldichte ' + (num(d.dpr) ? zahl(d.dpr, 2) : '?') + '.'));
    a.push(d.pointer ? R('pointer', g, 'Pointer Events', 'ok', 'Vorhanden (Maus, Stift und Finger über eine Schnittstelle).') : R('pointer', g, 'Pointer Events', 'fail', 'Nicht vorhanden.', 'Browser aktualisieren, sonst lassen sich Regler und Zeichnungen schlecht bedienen.'));
    if (num(d.maxTouch)) a.push(R('touchpunkte', g, 'Touch-Punkte', d.maxTouch >= 2 ? 'ok' : d.maxTouch === 1 ? 'warn' : 'ok', d.maxTouch === 0 ? 'Kein Touch gemeldet (normal bei PC mit Maus).' : d.maxTouch + ' gleichzeitige Berührungen' + (d.maxTouch < 2 ? ' (Zoomen mit zwei Fingern nicht möglich).' : '.')));
    var p = d.pinch;
    if (!p || !p.getestet) a.push(R('pinch', g, 'Zwei-Finger-Geste', 'offen', 'Noch nicht gemacht: im Testfeld unten mit zwei Fingern ziehen.', 'Am PC ohne Touchscreen nicht prüfbar.'));
    else if (p.erkannt) a.push(R('pinch', g, 'Zwei-Finger-Geste', 'ok', 'Erkannt: zwei Finger gleichzeitig, Abstandsänderung ' + Math.round(p.aenderung || 0) + ' px.'));
    else a.push(R('pinch', g, 'Zwei-Finger-Geste', p.maxFinger >= 2 ? 'warn' : 'fail', p.maxFinger >= 2 ? 'Zwei Finger erkannt, aber kaum Abstandsänderung.' : 'Nur ein Finger erkannt (' + (p.maxFinger || 0) + ').', 'Beide Finger gleichzeitig aufs Feld setzen und weit auseinander- oder zusammenziehen. Bleibt es so: andere Finger/Hände versuchen, Schutzfolie oder Hülle prüfen.'));
    a.push(R('tastatur', g, 'Tastatur-Eingabe', 'ok', 'Hinweis: Eingabefelder der App brauchen mindestens 16 px Schrift, sonst zoomt iOS beim Antippen von selbst. Das lässt sich hier nicht an den echten Seiten messen. Wenn eine Seite beim Tippen ins Textfeld heranzoomt: Foto/Seitenname an den Ausbilder.'));
    return a;
  }

  /* ---- 7 Leistung ---- */
  function einstufungLeistung(mioProSek, linienMs) {
    var s1 = !num(mioProSek) ? 'unbekannt' : mioProSek >= 20 ? 'gut' : mioProSek >= 5 ? 'mittel' : 'langsam';
    var s2 = !num(linienMs) ? 'unbekannt' : linienMs <= 60 ? 'gut' : linienMs <= 200 ? 'mittel' : 'langsam';
    var rang = { unbekannt: 0, gut: 1, mittel: 2, langsam: 3 }, w = rang[s1] >= rang[s2] ? s1 : s2;
    return { rechnen: s1, zeichnen: s2, gesamt: w };
  }
  function bewerteLeistung(d) {
    d = d || {}; var g = 'leistung', e = einstufungLeistung(d.mioProSek, d.linienMs), a = [];
    var t = 'Rechnen ' + (num(d.mioProSek) ? zahl(d.mioProSek, 0) + ' Mio. Schritte/s' : '?') + ', ' + (d.linien || 2000) + ' Linien zeichnen in ' + (num(d.linienMs) ? Math.round(d.linienMs) + ' ms' : '?') + '.';
    if (e.gesamt === 'gut') a.push(R('leistung', g, 'Geschwindigkeit', 'ok', 'Schnell genug. ' + t));
    else if (e.gesamt === 'mittel') a.push(R('leistung', g, 'Geschwindigkeit', 'ok', 'Ausreichend, bei großen Simulationen kann es ruckeln. ' + t));
    else if (e.gesamt === 'langsam') a.push(R('leistung', g, 'Geschwindigkeit', 'warn', 'Langsam. ' + t, 'Andere Apps und Browser-Tabs schließen, Gerät kurz abkühlen lassen, Stromsparmodus ausschalten, dann wiederholen. Bleibt es langsam: aufwendige Simulationen (z. B. Oszilloskop) können ruckeln.'));
    else a.push(R('leistung', g, 'Geschwindigkeit', 'warn', 'Nicht messbar. ' + t));
    return a;
  }

  /* ---- 8 Anzeige ---- */
  function bewerteAnzeige(d) {
    d = d || {}; var g = 'anzeige', a = [], s = d.safe || {}, t = s.t || 0, r = s.r || 0, b = s.b || 0, l = s.l || 0;
    a.push(R('groesse', g, 'Anzeigegröße', 'ok', (d.w || '?') + ' × ' + (d.h || '?') + ' Pixel (CSS), ' + (d.w >= d.h ? 'Querformat' : 'Hochformat') + ', Pixeldichte ' + (num(d.dpr) ? zahl(d.dpr, 2) : '?') + '.'));
    var klein = d.w && d.w < 360, flach = d.h && d.h < 500 && d.w > d.h;
    if (klein) a.push(R('breite', g, 'Breite', 'warn', 'Sehr schmale Anzeige (' + d.w + ' px).', 'Wenn Knöpfe abgeschnitten wirken: Handy quer halten oder die Schriftgröße in den Geräteeinstellungen verkleinern.'));
    else a.push(R('breite', g, 'Breite', 'ok', 'Breite reicht für die App-Ansicht.'));
    if (t || r || b || l) a.push(R('safe', g, 'Sicherer Bereich (Notch/Home-Balken)', 'ok', 'Ränder: oben ' + t + ', rechts ' + r + ', unten ' + b + ', links ' + l + ' px.'));
    else a.push(R('safe', g, 'Sicherer Bereich (Notch/Home-Balken)', 'ok', 'Keine Sonderränder (alles nutzbar).'));
    if (flach) a.push(R('leisten', g, 'Platz für Leisten', 'warn', 'Nur ' + d.h + ' px Höhe: Kopfzeile und untere Leiste (Bottom-Navigation) können viel Platz nehmen.', 'Gerät hochkant halten, wenn Inhalte verdeckt wirken.'));
    else if (b > 0 && d.standalone) a.push(R('leisten', g, 'Platz für Leisten', 'warn', 'Unten ' + b + ' px Sperrbereich (Home-Balken): die untere Leiste der Labs sollte darüber stehen.', 'Prüfen: Ist der unterste Knopf in einem Lab noch gut antippbar? Wenn nicht: Foto an den Ausbilder.'));
    else a.push(R('leisten', g, 'Platz für Leisten', 'ok', 'Kein Hinweis auf Kollision der Leisten.'));
    return a;
  }

  /* ---- Auswertung ---- */
  function zusammen(res) {
    var z = { ok: 0, fail: 0, warn: 0, offen: 0, gesamt: 0 };
    (res || []).forEach(function (r) { z.gesamt++; if (z[r.status] != null) z[r.status]++; });
    z.ampel = z.fail ? 'fail' : (z.warn || z.offen) ? 'warn' : 'ok';
    z.text = z.gesamt === 0 ? 'Noch nichts geprüft.' : z.fail ? z.fail + ' Problem' + (z.fail > 1 ? 'e' : '') + ' gefunden (✗), bitte Hinweise lesen.' : (z.warn || z.offen) ? 'Keine Fehler. ' + (z.offen ? z.offen + ' Prüfung' + (z.offen > 1 ? 'en' : '') + ' noch offen. ' : '') + (z.warn ? z.warn + ' Hinweis' + (z.warn > 1 ? 'e' : '') + ' (!).' : '') : 'Alles in Ordnung.';
    z.text = z.text.trim();
    return z;
  }
  /* Fazit: klare Aussage am Ende. { stufe: geeignet | hinweise | offen | eingeschraenkt, titel, text } */
  function fazit(res) {
    var z = zusammen(res), probs = (res || []).filter(function (r) { return r.status === 'fail'; }).map(function (r) { return r.titel; });
    if (!z.gesamt) return { stufe: 'offen', titel: 'Dein Gerät ist noch nicht geprüft', text: 'Dein Gerät ist noch nicht geprüft, weil noch kein Test gelaufen ist.' };
    if (z.fail) return { stufe: 'eingeschraenkt', titel: 'Dein Gerät ist eingeschränkt geeignet', text: 'Dein Gerät ist eingeschränkt geeignet, weil: ' + probs.join(', ') + '. Lies bei den Punkten mit ✗ nach, was Du tun kannst.' };
    if (z.offen) return { stufe: 'offen', titel: 'Dein Gerät ist noch nicht ganz geprüft', text: 'Dein Gerät ist noch nicht ganz geprüft, weil ' + z.offen + (z.offen > 1 ? ' Tests' : ' Test') + ' noch offen ' + (z.offen > 1 ? 'sind' : 'ist') + '. Bisher gab es keine Fehler.' };
    if (z.warn) return { stufe: 'hinweise', titel: 'Dein Gerät ist geeignet, mit Hinweisen', text: 'Dein Gerät ist geeignet, weil es keine Fehler gab. Beachte die ' + z.warn + (z.warn > 1 ? ' Hinweise' : ' Hinweis') + ' mit !.' };
    return { stufe: 'geeignet', titel: 'Dein Gerät ist geeignet', text: 'Dein Gerät ist geeignet, weil alle Prüfungen in Ordnung sind.' };
  }
  function zeile(r) { return ICON[r.status] + ' ' + r.titel + ': ' + r.text + (r.tipp && r.status !== 'ok' ? ' → ' + r.tipp : ''); }
  /* kompakter Bericht zum Kopieren. info: { version, geraet, ua, w, h, dpr, orient, zoom, zeit } */
  function bericht(info, res) {
    info = info || {}; var z = zusammen(res), L = [];
    L.push('Tonfunk Lab Gerätetest');
    L.push('Version: ' + (info.version || '?') + (info.zeit ? ' | ' + info.zeit : ''));
    L.push('Gerät: ' + geraetText(info.geraet));
    L.push('User-Agent: ' + (info.ua || '?'));
    L.push('Anzeige: ' + (info.w || '?') + 'x' + (info.h || '?') + ' px, Pixeldichte ' + (num(info.dpr) ? zahl(info.dpr, 2) : '?') + (info.orient ? ', ' + info.orient : '') + (num(info.zoom) ? ', Zoom ' + zahl(info.zoom, 2) : ''));
    L.push('Ergebnis: ' + z.ok + ' ✓, ' + z.fail + ' ✗, ' + (z.warn + z.offen) + ' !' + (z.offen ? ' (davon ' + z.offen + ' noch nicht gemacht)' : ''));
    L.push('Fazit: ' + fazit(res).text);
    var g = null;
    (res || []).forEach(function (r) { if (r.gruppe !== g) { g = r.gruppe; L.push(''); L.push('[' + (GRUPPEN[g] || g) + ']'); } L.push(zeile(r)); });
    return L.join('\n');
  }

  var api = {
    ICON: ICON, GRUPPEN: GRUPPEN, erkenneGeraet: erkenneGeraet, geraetText: geraetText, parseSw: parseSw, neuester: neuester, zaehle: zaehle, parseVer: parseVer, zoomGesperrt: zoomGesperrt,
    bewerteUmgebung: bewerteUmgebung, bewerteSw: bewerteSw, bewerteSpeicher: bewerteSpeicher, bewerteCacheSeiten: bewerteCacheSeiten, rangeBewerte: rangeBewerte, bewerteFlug: bewerteFlug,
    bewerteVorlesen: bewerteVorlesen, bewerteTouch: bewerteTouch, einstufungLeistung: einstufungLeistung, bewerteLeistung: bewerteLeistung, bewerteAnzeige: bewerteAnzeige,
    zusammen: zusammen, fazit: fazit, zeile: zeile, bericht: bericht, mb: mb
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.GeraetetestCore = api;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
