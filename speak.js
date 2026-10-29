/* Sprechende Bauteile (alle Labs): Ein Bauteil antippen, dann „🔊 Erkläre dich“: Das Bauteil stellt sich in der Ich-Form vor
   (Sprechblase und Sprachausgabe des Geräts, falls vorhanden). Schalter „Bauteile sprechen automatisch“ im Menü. */
(function () {
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  /* Schlüssel normalisieren: LochLab- und Schaltplan-Namen auf einen gemeinsamen Steckbrief */
  var ALIAS = { P: 'POT', TP: 'POT', CF: 'C', T: 'NPN', PNP: 'NPN', SW: 'SPST', SCH: 'SPST', PB: 'SPST', PBC: 'SPST', SPDT: 'SPST', KREUZ: 'SPST', NMOS: 'FET', PMOS: 'FET', FET: 'FET', ZD: 'D', SCHOTTKY: 'D', DUOLED: 'LED', RGBLED: 'LED', ICX: 'IC', NE555: 'IC', REG: 'U', GL: 'BRUECKE', SIG: 'AC', NETZ3: 'NETZ', MOTOR3: 'MOTOR', HEAT: 'LAMP', PHT: 'LDR', NANO: 'UNO', SPK: 'PIEZO', BZ: 'PIEZO' };
  var T = {
    R: ['Widerstand', 'Ich bin ein Widerstand. Mein Job ist es, den Strom zu bremsen. Je größer mein Wert in Ohm, desto weniger Strom lasse ich durch. Ich werde dabei warm, deshalb vertrage ich nur eine bestimmte Leistung, meist ein Viertel Watt. Meinen Wert erkennst du am Farbcode.'],
    POT: ['Potentiometer', 'Ich bin ein Poti, ein Widerstand zum Drehen. Mit meinem Schleifer greife ich eine Spannung zwischen zwei Anschlüssen ab. So regelst du Lautstärke, Helligkeit oder Drehzahl.'],
    C: ['Kondensator', 'Ich bin ein Kondensator. Ich speichere elektrische Ladung wie ein kleiner Tank. Gleichstrom lasse ich nur kurz beim Laden durch, Wechselstrom dagegen schon. Zusammen mit einem Widerstand bestimme ich Zeiten und Filter.'],
    CE: ['Elko', 'Ich bin ein Elko, ein Kondensator mit großer Kapazität. Aber Achtung: Ich habe einen Plus- und einen Minuspol. Falsch herum eingebaut werde ich heiß und kann platzen. Der Streifen auf mir markiert den Minuspol.'],
    L: ['Spule', 'Ich bin eine Spule. Ich mag keine plötzlichen Änderungen des Stroms und baue ein Magnetfeld auf. Schaltest du mich ab, erzeuge ich eine hohe Spannung. Darum brauchen Relaisspulen eine Freilaufdiode.'],
    D: ['Diode', 'Ich bin eine Diode, das Ventil der Elektronik. Strom lasse ich nur in einer Richtung durch, von der Anode zur Kathode. Der Ring auf mir markiert die Kathode. Bei Silizium fallen etwa 0,7 Volt an mir ab, bei einer Schottky-Diode nur etwa 0,3.'],
    LED: ['Leuchtdiode', 'Ich bin eine LED und leuchte, wenn Strom in Durchlassrichtung fließt. Ohne Vorwiderstand brenne ich sofort durch. Mein längeres Bein ist die Anode, der Pluspol. Je nach Farbe fallen etwa zwei bis drei Volt an mir ab.'],
    NPN: ['Transistor', 'Ich bin ein Transistor. Ein kleiner Strom in meine Basis steuert einen großen Strom zwischen Kollektor und Emitter, ich bin Schalter und Verstärker zugleich. Ohne Basiswiderstand gehe ich kaputt. Schau immer im Datenblatt nach, welches Bein was ist.'],
    FET: ['MOSFET', 'Ich bin ein MOSFET. Anders als ein normaler Transistor steuert mich die Spannung am Gate, fast ohne Strom. Mein Gate ist empfindlich, mehr als zwanzig Volt vertrage ich nicht, und ich mag keine statische Aufladung.'],
    THY: ['Thyristor', 'Ich bin ein Thyristor. Ein kurzer Impuls am Gate zündet mich, danach leite ich von allein weiter, bis der Strom unter meinen Haltestrom fällt. Praktisch für Alarmanlagen und Leistungssteuerungen.'],
    TRIAC: ['TRIAC', 'Ich bin ein TRIAC, ein Wechselstrom-Schalter. Ich kann in beide Richtungen leiten und werde durch einen Impuls am Gate gezündet. In Lampen-Dimmern arbeite ich mit einem DIAC zusammen.'],
    DIAC: ['DIAC', 'Ich bin ein DIAC. Ich sperre, bis die Spannung an mir etwa 32 Volt erreicht, dann kippe ich durch. Damit zünde ich einen TRIAC im Dimmer.'],
    VDR: ['Varistor', 'Ich bin ein Varistor. Bei normaler Spannung bin ich fast unsichtbar, bei einer Überspannung werde ich plötzlich leitend und leite sie ab. Ich schütze Geräte vor Blitzeinschlägen im Netz, aber nur begrenzt oft.'],
    LDR: ['Fotowiderstand', 'Ich bin ein Fotowiderstand. Im Hellen habe ich nur wenige Kiloohm, im Dunkeln hunderte. So merkt eine Schaltung, ob es hell oder dunkel ist, zum Beispiel für Dämmerungsschalter.'],
    NTC: ['Heißleiter', 'Ich bin ein Temperaturfühler. Wird mir warm, sinkt mein Widerstand. Zusammen mit einem Festwiderstand mache ich daraus eine Spannung, die man messen kann.'],
    PTC: ['Kaltleiter', 'Ich bin ein Kaltleiter. Werde ich warm, steigt mein Widerstand. Ich eigne mich als Überstromschutz oder Heizelement, das sich selbst begrenzt.'],
    RLY: ['Relais', 'Ich bin ein Relais. In mir sitzt eine Spule: Fließt Strom, zieht sie einen Kontakt an und schaltet einen zweiten Stromkreis, der mit dem ersten nichts zu tun hat. So schaltet ein kleines Signal große Lasten.'],
    SPST: ['Schalter', 'Ich bin ein Schalter oder Taster. Geschlossen leite ich, offen unterbreche ich den Stromkreis. Bei Netzspannung gehöre ich immer in den Außenleiter, nie in den Neutralleiter.'],
    LAMP: ['Verbraucher', 'Ich bin ein Verbraucher: Strom wird in mir zu Licht und Wärme. Meine Leistung steht auf mir. Aus Spannung und Leistung kannst du meinen Strom berechnen: Strom gleich Leistung geteilt durch Spannung.'],
    MOTOR: ['Motor', 'Ich bin ein Motor. Beim Anlaufen ziehe ich viel Strom, weil ich noch keine Gegenspannung erzeuge. Läuft mein Rotor, sinkt der Strom. Bremst man mich, steigt er wieder.'],
    FUSE: ['Sicherung', 'Ich bin eine Sicherung. Fließt zu viel Strom, schmilzt mein dünner Draht und unterbricht den Kreis, bevor eine Leitung brennt. Ich bin ein Wegwerfteil und darf nie überbrückt werden.'],
    LSS: ['Sicherungsautomat', 'Ich bin ein Leitungsschutzschalter. Bei Überlast schalte ich langsam ab, bei einem Kurzschluss sofort. Ich schütze die Leitung vor dem Überhitzen, nicht den Menschen.'],
    RCD: ['FI-Schutzschalter', 'Ich bin ein FI-Schutzschalter. Ich vergleiche den Strom auf dem Hinweg mit dem Rückweg. Fehlen mehr als dreißig Milliampere, fließt Strom durch einen Menschen oder die Erde, und ich schalte sofort ab.'],
    TRF: ['Transformator', 'Ich bin ein Transformator. Ich wandle Wechselspannung in eine höhere oder niedrigere um, ohne dass beide Seiten leitend verbunden sind. Für Gleichspannung bin ich nicht zu gebrauchen.'],
    BAT: ['Spannungsquelle', 'Ich bin eine Spannungsquelle. Mein Pluspol drückt Strom durch die Schaltung, mein Minuspol nimmt ihn zurück. Wie viel Strom fließt, bestimmt der Rest der Schaltung, nicht ich.'],
    AC: ['Wechselspannungsquelle', 'Ich bin eine Wechselspannungsquelle. Meine Spannung schwingt hin und her, bei der Steckdose fünfzigmal pro Sekunde. Der Scheitelwert ist das 1,4-Fache des Effektivwerts.'],
    NETZ: ['Netz', 'Ich bin das Netz. Zwischen Außenleiter und Neutralleiter liegen 230 Volt. Der Schutzleiter ist grün-gelb und führt im Normalbetrieb keinen Strom. Ich bin lebensgefährlich, im SimLab aber ungefährlich.'],
    GND: ['Masse', 'Ich bin die Masse, der Bezugspunkt der Schaltung mit null Volt. Alle Spannungen werden gegen mich gemessen. Ohne mich weiß der Simulator nicht, wo er anfangen soll.'],
    IC: ['Integrierter Schaltkreis', 'Ich bin ein IC, ein ganzes Schaltungsstück in einem Gehäuse. Meine Kerbe markiert Pin eins. Ohne Betriebsspannung tue ich nichts, und ich sollte in einem Sockel sitzen.'],
    U: ['Spannungsregler', 'Ich bin ein Spannungsregler. Egal, ob am Eingang etwas mehr oder weniger anliegt, am Ausgang halte ich die Spannung konstant. Den Unterschied verheize ich als Wärme, bei viel Strom brauche ich einen Kühlkörper.'],
    BRUECKE: ['Brückengleichrichter', 'Ich bin ein Brückengleichrichter aus vier Dioden. Egal, wie die Wechselspannung gerade gepolt ist, am Ausgang kommt immer Plus und Minus an der richtigen Stelle heraus.'],
    OPA: ['Operationsverstärker', 'Ich bin ein Operationsverstärker. Ich vergleiche meine zwei Eingänge und verstärke den Unterschied enorm. Mit Gegenkopplung werde ich ein präziser Verstärker, ohne bin ich ein Komparator.'],
    PIEZO: ['Summer oder Lautsprecher', 'Ich mache Töne. Je schneller du mich ein- und ausschaltest, desto höher klinge ich. Ein Lautsprecher braucht einen Widerstand in Reihe, damit der Strom nicht zu groß wird.'],
    UNO: ['Arduino', 'Ich bin ein Arduino Uno, ein kleiner Computer auf einer Platine. Meine Pins können Spannung ausgeben oder messen, je nach Programm. Pro Pin vertrage ich nur etwa zwanzig Milliampere.'],
    PI: ['Raspberry Pi', 'Ich bin ein Raspberry Pi. Meine GPIO-Pins arbeiten mit 3,3 Volt, mehr vertragen sie nicht. Ich laufe mit einem richtigen Betriebssystem, deshalb fahre ich besser ordentlich herunter.'],
  };
  /* Wiki-Datenquelle (W2b): Steckbrief und Alias kommen aus wiki-bauteile.js (Wiki.bySpeak); T/ALIAS oben sind nur noch der eingebaute Fallback
     (Wiki noch nicht geladen oder nicht erreichbar) und enthalten denselben Text (test_wiki_speak.js). Nachgeladen wird im Leerlauf nach dem Laden der Seite;
     bis dahin antwortet part() synchron aus T, damit das Abspielen im Tipp-Handler bleibt (iOS). */
  var wikiTried = false;
  function wiki(k) {
    try { var W = window.Wiki, e = W && W.bySpeak ? W.bySpeak(k) : null; return e && e.kat === 'bauteil' && e.speak && e.kurz ? e : null; } catch (x) { return null; }
  }
  function loadWiki() {
    if (wikiTried) return; wikiTried = true;
    try {
      var need = function () { try { window.Wiki.need(['bauteile']); } catch (x) {} };
      if (window.Wiki && window.Wiki.need) return need();
      if (document.querySelector('script[src$="wiki.js"]')) return;   /* Seite bindet wiki.js selbst ein, nicht doppelt laden */
      var s = document.createElement('script'); s.src = 'wiki.js'; s.async = true; s.onload = need; document.head.appendChild(s);
    } catch (x) {}
  }
  try {
    var later = function () { setTimeout(loadWiki, 600); };
    if (document.readyState === 'complete') later(); else window.addEventListener('load', later);
  } catch (x) {}
  function key(k) { var e = wiki(k); return e ? e.speak : (ALIAS[k] || k); }
  function info(k) { var e = wiki(k); return e ? [e.titel, e.kurz] : (T[ALIAS[k] || k] || null); }
  /* Geräte-Stimme (Fallback): beste deutsche Stimme wählen; getVoices() ist anfangs oft leer, daher bei voiceschanged neu */
  var voice = null;
  function score(v) {
    var n = v.name + ' ' + (v.voiceURI || ''), s = 0;
    if (!/^de/i.test(v.lang)) return -1;
    if (/^de[-_]DE/i.test(v.lang)) s += 50; else s += 20;
    if (/natural|neural|online/i.test(n)) s += 40;
    if (/premium|enhanced|erweitert/i.test(n)) s += 30;
    if (/anna|petra|katja|conrad|google deutsch/i.test(n)) s += 15;
    if (/compact|eloquence|espeak|grandma|grandpa|rocko/i.test(n)) s -= 60;
    return s;
  }
  function pick() {
    try { var best = -1; voice = null; (window.speechSynthesis.getVoices() || []).forEach(function (v) { var s = score(v); if (s > best) { best = s; voice = v; } }); } catch (e) {}
  }
  try { if ('speechSynthesis' in window) { pick(); window.speechSynthesis.addEventListener('voiceschanged', pick); } } catch (e) {}
  function sayRaw(txt) {
    try { if (!('speechSynthesis' in window)) return; if (!voice) pick(); var u = new SpeechSynthesisUtterance(txt); u.lang = 'de-DE'; u.rate = 0.95; if (voice) u.voice = voice; window.speechSynthesis.speak(u); } catch (e) {}
  }
  /* Aufnahmen (sprache/index.js, Piper-Stimme): Hash schützt davor, dass ein später geänderter Text mit alter Aufnahme gesprochen wird */
  var cur = null, tok = 0;
  function hash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0; return h.toString(36); }
  function stop() {
    tok++;
    if (cur) { try { cur.onended = cur.onerror = null; cur.pause(); } catch (e) {} cur = null; }
    try { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch (e) {}
  }
  function say(txt) { stop(); sayRaw(txt); }
  /* base = Text der Aufnahme, extra = dynamischer Zusatz (immer Geräte-Stimme, nach dem Ende der Aufnahme) */
  function speak(k, base, extra) {
    stop();
    var my = tok, A = window.SpeakAudio, e = A && A[key(k)], all = base + (extra ? ' ' + extra : '');
    var fb = function () { cur = null; if (my === tok) sayRaw(all); };
    if (!e || e.h !== hash(base) || !window.Audio) return fb();
    try {
      var a = new Audio('sprache/' + e.f + '.mp3'); cur = a;
      a.onended = function () { cur = null; if (my === tok && extra) sayRaw(extra); };
      a.onerror = fb;
      var p = a.play(); if (p && p.catch) p.catch(function () { if (cur === a) fb(); });
    } catch (x) { fb(); }
  }
  /* Knopf "Im Wiki" (W5): nur dort, wo wiki-labs.js den Drawer samt Stil mitbringt, und nur mit vorhandenem Eintrag; uebergeben wird allein die Eintrags-ID */
  function wikiBtn(k) { return k && window.WikiLabs ? wiki(k) : null; }
  function bubble(title, txt, again, k) {
    var b = document.getElementById('speakBubble'); if (b) b.remove();
    b = document.createElement('div'); b.id = 'speakBubble';
    b.style.cssText = 'position:fixed;left:50%;bottom:calc(96px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:150;max-width:min(560px,92vw);background:#fff;color:#1b1f24;border-radius:18px;padding:14px 18px 14px 16px;font:500 15px/1.45 system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.45)';
    b.innerHTML = '<b style="display:block;margin-bottom:4px">💬 ' + esc(title) + '</b>' + esc(txt) + '<div style="margin-top:8px;display:flex;gap:8px"><button id="spkAgain" style="font:600 13px system-ui;border:1px solid #bbb;background:#f3f3f3;border-radius:10px;padding:6px 12px">🔊 Nochmal</button><button id="spkClose" style="font:600 13px system-ui;border:1px solid #bbb;background:#f3f3f3;border-radius:10px;padding:6px 12px">Schließen</button>' + (wikiBtn(k) ? '<button id="spkWiki" style="font:600 13px system-ui;border:1px solid #bbb;background:#f3f3f3;border-radius:10px;padding:6px 12px">📖 Im Wiki</button>' : '') + '</div>';
    document.body.appendChild(b);
    b.querySelector('#spkClose').onclick = function () { b.remove(); stop(); };
    b.querySelector('#spkAgain').onclick = again;
    var we = wikiBtn(k);
    if (we) b.querySelector('#spkWiki').onclick = function () { var W = window.Wiki; stop(); (W.needAll ? W.needAll() : Promise.resolve()).then(function () { W.open(we.id, { lab: W.lab ? W.lab() : '' }); }); };
    setTimeout(function () { if (b.parentNode) b.remove(); }, 30000);
  }
  function part(k, extra) {
    var i = info(k); if (!i) { if (window.LabUI) window.LabUI.toast('Zu diesem Bauteil gibt es noch keinen Steckbrief'); return; }
    var go = function () { speak(k, i[1], extra); }; bubble(i[0], i[1] + (extra ? ' ' + extra : ''), go, k); go();
  }
  function auto() { try { return localStorage.getItem('lm4.speakauto') === '1'; } catch (e) { return false; } }
  function toggleAuto() { var v = !auto(); try { localStorage.setItem('lm4.speakauto', v ? '1' : '0'); } catch (e) {} var t = (window.LabUI && window.LabUI.toast) || window.toast; if (t) t(v ? 'Bauteile sprechen jetzt automatisch, wenn du sie antippst' : 'Automatisches Sprechen aus'); return v; }
  window.Speak = { part: part, info: info, auto: auto, toggleAuto: toggleAuto, say: say, speak: speak, stop: stop };
})();
