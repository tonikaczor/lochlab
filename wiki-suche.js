/* wiki-suche.js - Tonfunk Wiki, Offline-Suche (Paket W4, Spec Abschnitt 7). Reine Funktionen, keine DOM-Zugriffe, Node-testbar.
 * Browser: window.WikiSuche; Node: module.exports. Eingabe ist der Suchindex (wiki-index.js, Zeilen siehe indexRow) oder aus Eintraegen gebaute Zeilen.
 *  - Faltung mit Doppelindex: ae/ae+a, oe/o, ue/u, ss; Akzente weg, Ω -> ohm, µ -> u, U_D -> "ud" + "u d", Bindestrich-Wort -> Teile + Zusammenschreibung, 0,7 = 0.7
 *  - Synonyme SYN (Gruppen), Praefix- und Teilwort-Treffer (deutsche Komposita), Tippfehler (Damerau-Levenshtein) nur bei < 3 Treffern
 *  - Ranking: Titel (100/60) > Alias+Stichwoerter (50) > Kurztext (20) > Langtext (5, nur geladene Eintraege); + Lab 15, + Bauteil/Geraet 10, + pruef*2 */
(function () {
  'use strict';

  /* ---------- Faltung ---------- */
  function base(s, uml) {
    s = String(s == null ? '' : s).toLowerCase().replace(/²/g, '2').replace(/³/g, '3').replace(/ω/g, 'ohm').replace(/µ|μ/g, 'u');
    s = uml ? s.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue') : s.replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u');
    s = s.replace(/ß/g, 'ss').normalize('NFD').replace(/[̀-ͯ]/g, '');
    return s.replace(/(\d),(\d)/g, '$1.$2');
  }
  // Ein Rohwort -> Varianten (Umlaut doppelt, Verbundform bei _ und -), je ohne Sonderzeichen
  function wordForms(w) {
    var out = [];
    [true, false].forEach(function (u) {
      var b = base(w, u), joined = b.replace(/[_\-]+/g, ''), parts = b.replace(/[_\-]+/g, ' ');
      [joined, parts].forEach(function (x) {
        x = x.replace(/[^a-z0-9. ]+/g, '').replace(/(^|\s)\.+|\.+(\s|$)/g, '$1$2').replace(/\s+/g, ' ').trim();
        if (x && out.indexOf(x) < 0) out.push(x);
      });
    });
    return out;
  }
  // Text -> Token-Liste (eindeutig, Reihenfolge des ersten Auftretens)
  function toks(s, primar) {
    var out = [], seen = {};
    String(s == null ? '' : s).replace(/(\d),(?=\d)/g, '$1.').split(/[\s,;:()/|]+/).forEach(function (w) {
      if (!w) return;
      var wf = wordForms(w); if (primar) wf = wf.slice(0, 1);
      wf.forEach(function (f) { f.split(' ').forEach(function (t) { if (t && !seen[t]) { seen[t] = 1; out.push(t); } }); });
    });
    return out;
  }
  function fold(s) { return wordForms(s)[0] || ''; }   // Hauptform (ae) fuer Vergleiche

  /* ---------- Synonymgruppen (nur Begriffe, die zu Eintraegen des Wikis passen; test_wiki_suche prueft: jede Form findet etwas) ---------- */
  var SYN = [
    ['kondensator', 'kapazität', 'capacitor', 'elko', 'elektrolytkondensator'],
    ['widerstand', 'ohm', 'resistor', 'ohmscher widerstand'],
    ['spannung', 'volt', 'voltage'],
    ['strom', 'ampere', 'current'],
    ['oszilloskop', 'scope', 'oszi', 'oscilloscope'],
    ['poti', 'potentiometer', 'trimmer', 'drehwiderstand', 'schleifer'],
    ['fi', 'rcd', 'fehlerstromschutzschalter', 'fi schalter', 'fi schutzschalter', 'differenzstrom'],
    ['ls', 'lss', 'sicherungsautomat', 'leitungsschutzschalter', 'mcb', 'automat', 'ls schalter'],
    ['sicherung', 'schmelzsicherung', 'fuse', 'feinsicherung'],
    ['led', 'leuchtdiode', 'light emitting diode'],
    ['z diode', 'zenerdiode', 'zener diode', 'zdiode'],
    ['transistor', 'bipolartransistor', 'npn', 'pnp'],
    ['mosfet', 'fet', 'feldeffekttransistor', 'nmos', 'pmos'],
    ['trafo', 'transformator', 'übertrager', 'trenntrafo'],
    ['multimeter', 'dmm', 'vielfachmessgerät', 'digitalmultimeter', 'messgerät'],
    ['netzgerät', 'netzteil', 'labornetzgerät', 'labornetzteil'],
    ['funktionsgenerator', 'signalgenerator', 'frequenzgenerator', 'generator'],
    ['frequenzzähler', 'frequenzmesser', 'counter', 'zähler'],
    ['leistungsmesser', 'wattmeter', 'energiezähler'],
    ['kennlinienschreiber', 'kennlinie', 'curve tracer'],
    ['bode', 'bode diagramm', 'frequenzgang'],
    ['logikanalysator', 'logic analyzer', 'logikanalyser'],
    ['isolationsmessgerät', 'isolationswiderstand', 'megger', 'isolationsprüfung', 'riso'],
    ['schutzleiterwiderstand', 'rpe', 'schutzleiterprüfung'],
    ['ableitstrom', 'leckstrom', 'schutzleiterstrom'],
    ['geräteprüfgerät', 'prüfplatz', 'geräteprüfung'],
    ['effektivwert', 'rms', 'eff'],
    ['scheitelwert', 'spitzenwert', 'amplitude', 'peak'],
    ['spitze spitze', 'vss', 'uss'],
    ['periodendauer', 'schwingungsdauer', 'periode'],
    ['frequenz', 'hertz', 'hz'],
    ['tastkopf', 'probe', 'teilertastkopf', 'tastteiler'],
    ['messspitze', 'messspitzen', 'prüfspitze', 'messleitung'],
    ['trigger', 'triggern', 'triggerung'],
    ['zeitbasis', 'time div', 'timebase', 'zeitablenkung', 'tdiv'],
    ['volt je teil', 'volts div', 'vertikalablenkung', 'empfindlichkeit', 'vdiv'],
    ['gleichanteil', 'dc anteil', 'offset'],
    ['wechselspannung', 'wechselstrom', 'ac'],
    ['gleichspannung', 'gleichstrom', 'dc'],
    ['mikrocontroller', 'microcontroller', 'mcu'],
    ['arduino', 'uno', 'nano', 'atmega328p'],
    ['raspberry pi', 'pi', 'rpi', 'raspi', 'einplatinencomputer'],
    ['relais', 'relay', 'schütz'],
    ['schalter', 'switch', 'taster', 'button'],
    ['wechselschalter', 'spdt', 'umschalter', 'wechsler'],
    ['lampe', 'glühlampe', 'glühbirne', 'verbraucher', 'last'],
    ['heizung', 'heizelement', 'heater'],
    ['motor', 'elektromotor', 'gleichstrommotor'],
    ['schrittmotor', 'stepper'],
    ['batterie', 'akku', 'accu', 'spannungsquelle', 'zelle'],
    ['masse', 'gnd', 'ground', 'erde', 'bezugspotential', 'nullpotential'],
    ['spannungsregler', 'linearregler', 'festspannungsregler', '7805', 'lm317', 'regulator'],
    ['schaltregler', 'step down', 'buck'],
    ['brückengleichrichter', 'graetz', 'graetzbrücke', 'gleichrichterbrücke'],
    ['gleichrichter', 'gleichrichtung', 'rectifier'],
    ['glättung', 'siebung', 'siebelko', 'ladeelko', 'brummspannung'],
    ['operationsverstärker', 'opv', 'opamp', 'op amp', 'opa', 'operational amplifier'],
    ['komparator', 'comparator'],
    ['spannungsfolger', 'impedanzwandler', 'voltage follower'],
    ['summer', 'buzzer', 'piezo', 'piepser', 'lautsprecher', 'speaker', 'schallwandler'],
    ['ntc', 'heißleiter', 'ntc widerstand'],
    ['ptc', 'kaltleiter', 'polyfuse', 'ptc widerstand'],
    ['thermistor', 'temperaturfühler', 'temperatursensor'],
    ['ldr', 'fotowiderstand', 'photowiderstand', 'lichtsensor'],
    ['varistor', 'vdr', 'überspannungsschutz', 'mov'],
    ['thyristor', 'scr'],
    ['phasenanschnitt', 'dimmer'],
    ['diac', 'zweirichtungsdiode'],
    ['spule', 'induktivität', 'drossel', 'inductor', 'henry'],
    ['freilaufdiode', 'löschdiode', 'freilauf diode'],
    ['vorwiderstand', 'strombegrenzungswiderstand'],
    ['spannungsteiler', 'spannungsteilerschaltung'],
    ['flussspannung', 'durchlassspannung', 'vf', 'uf'],
    ['schwellspannung', 'threshold', 'uth'],
    ['schutzleiter', 'pe', 'schutzerde'],
    ['außenleiter', 'l1', 'polleiter'],
    ['neutralleiter', 'nulleiter', 'mittelleiter'],
    ['drehstrom', 'kraftstrom', 'dreiphasig'],
    ['netzspannung', 'steckdosenspannung', 'hausspannung'],
    ['schutzklasse', 'schutzklassen', 'sk1', 'sk2', 'schutzisoliert'],
    ['sicherheitsregeln', '5 sicherheitsregeln', 'fünf sicherheitsregeln'],
    ['personenschutz', 'berührungsschutz', 'körperschutz'],
    ['überlast', 'überlastschutz', 'überstrom', 'überstromschutz'],
    ['kurzschluss', 'kurzschlussstrom'],
    ['leistung', 'watt', 'wirkleistung', 'power'],
    ['energie', 'kwh', 'kilowattstunde', 'wattsekunde', 'joule'],
    ['logikpegel', 'pegel', 'ttl', 'schaltschwelle'],
    ['pwm', 'pulsweitenmodulation', 'pulsbreitenmodulation', 'tastverhältnis'],
    ['i2c', 'iic'],
    ['h brücke', 'hbrücke', 'h bridge', 'vollbrücke'],
    ['sinus', 'sinusspannung', 'sinuskurve'],
    ['rechteck', 'rechtecksignal', 'rechteckspannung'],
    ['dreieck', 'dreiecksignal', 'dreieckspannung'],
    ['oberwellen', 'harmonische', 'oberschwingungen'],
    ['grenzfrequenz', 'eckfrequenz', 'f3db'],
    ['tiefpass', 'tp', 'lowpass', 'low pass'],
    ['hochpass', 'hp', 'highpass', 'high pass'],
    ['dezibel', 'db'],
    ['phasenverschiebung', 'phasenwinkel', 'phase shift'],
    ['anlaufstrom', 'einschaltstrom'],
    ['stromverstärkung', 'hfe', 'verstärkungsfaktor'],
    ['prellen', 'entprellen', 'kontaktprellen', 'bouncing'],
    ['pull up', 'pullup', 'hochziehwiderstand'],
    ['messbereich', 'bereichswahl', 'range'],
    ['auto range', 'autorange'],
    ['durchgangsprüfer', 'durchgangsprüfung', 'continuity'],
    ['messkategorie', 'cat', 'überspannungskategorie'],
    ['innenwiderstand', 'quellenwiderstand', 'ri'],
    ['genauigkeit', 'messunsicherheit', 'messabweichung', 'messfehler', 'toleranz'],
    ['farbcode', 'farbringe', 'ringe'],
    ['smd', 'oberflächenmontage', 'surface mount'],
    ['ic', 'chip', 'baustein', 'integrierter schaltkreis', 'schaltkreis'],
    ['ne555', '555', 'timer', 'zeitgeber'],
    ['kühlkörper', 'kühler', 'heatsink'],
    ['verlustleistung', 'abwärme'],
    ['abblockkondensator', 'entkopplungskondensator', 'stützkondensator', 'blockkondensator']
  ];
  var SYNMAP = null;
  function synMap() {
    if (SYNMAP) return SYNMAP;
    SYNMAP = {};
    SYN.forEach(function (g, gi) { g.forEach(function (m) { wordForms(m).forEach(function (f) { (SYNMAP[f] = SYNMAP[f] || []).indexOf(gi) < 0 && SYNMAP[f].push(gi); }); }); });
    return SYNMAP;
  }
  function synMembers(gi) { var o = []; SYN[gi].forEach(function (m) { wordForms(m).forEach(function (f) { if (o.indexOf(f) < 0) o.push(f); }); }); return o; }

  /* ---------- Damerau-Levenshtein (optimal string alignment), mit Abbruch ab Schranke ---------- */
  function dl(a, b, max) {
    var la = a.length, lb = b.length; if (Math.abs(la - lb) > max) return max + 1;
    var p2 = null, p1 = [], i, j, cur, best;
    for (j = 0; j <= lb; j++) p1[j] = j;
    for (i = 1; i <= la; i++) {
      cur = [i]; best = i;
      for (j = 1; j <= lb; j++) {
        var c = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1, v = Math.min(p1[j] + 1, cur[j - 1] + 1, p1[j - 1] + c);
        if (p2 && i > 1 && j > 1 && a.charCodeAt(i - 1) === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === b.charCodeAt(j - 1)) v = Math.min(v, p2[j - 2] + 1);
        cur[j] = v; if (v < best) best = v;
      }
      if (best > max) return max + 1;
      p2 = p1; p1 = cur;
    }
    return p1[lb];
  }

  /* ---------- Index: Zeilen [id, kat, titel, stich, labs, datei, pruef, kurzwoerter(, langwoerter)] ---------- */
  var STOP = ' eine einen einem einer eines dass nicht wenn dann mein meine meinen meinem wird werden kann auch aber oder sich sind dieser diese dieses damit durch weil noch sehr mehr also dort hier habe haben bist dich deine deinen deiner mich dein ihre ihren nach beim vom zum zur wie was wer mal aus und der die das den dem des ein ist sie wir ihr mit von bei auf als nur dir ich du so zu im in an es er '.split(' ');
  var STOPSET = {}; STOP.forEach(function (w) { if (w) STOPSET[w] = 1; });
  function wordsOf(text, max) {
    var out = [], seen = {}, i, t, a = toks(text, true);
    for (i = 0; i < a.length; i++) { t = a[i]; if (t.length < 4 || STOPSET[t] || /^[0-9.]+$/.test(t) || seen[t]) continue; seen[t] = 1; out.push(t); if (max && out.length >= max) break; }
    return out;
  }
  function indexRow(e, datei, mitLang) {
    var st = (e.alias || []).concat(e.stich || []).join('|');
    var r = [e.id, e.kat, e.titel, st, (e.labs || []).join(','), datei || '', e.pruef || 0, wordsOf(e.kurz, 40).join(' ')];
    if (mitLang) r.push(wordsOf(e.lang, 120).join(' '));
    return r;
  }
  var KATTXT = { bauteil: 'bauteil bauteile', geraet: 'geraet geraete messgeraet', bedien: 'bedienelement bedienelemente regler', regler: 'regler', messwert: 'messwert messwerte', begriff: 'begriff begriffe', formel: 'formel formeln', norm: 'normwert normwerte', lab: 'lab labs' };

  function build(rows) {
    var map = {}, disp = {}, n = rows.length, titles = new Array(n);
    function put(tok, i, w) { var a = map[tok] || (map[tok] = {}); if (!(a[i] >= w)) a[i] = w; }
    function dispIt(word) { wordForms(word).forEach(function (f) { if (f.indexOf(' ') < 0 && !disp[f] && /[A-Za-zÄÖÜäöüß]/.test(word)) disp[f] = word.replace(/[(),;:]+/g, ''); }); }
    rows.forEach(function (r, i) {
      var tw = String(r[2]).split(/\s+/);
      titles[i] = wordForms(r[2])[0] || '';
      tw.forEach(function (w, wi) { dispIt(w); toks(w).forEach(function (t) { put(t, i, wi === 0 ? 100 : 60); }); });
      String(r[3]).split('|').forEach(function (s) { s.split(/\s+/).forEach(dispIt); toks(s).forEach(function (t) { put(t, i, 50); }); });
      String(r[7] || '').split(' ').forEach(function (t) { if (t) toks(t).forEach(function (x) { put(x, i, 20); }); });
      String(r[8] || '').split(' ').forEach(function (t) { if (t) toks(t).forEach(function (x) { put(x, i, 5); }); });
      String(r[0]).split('-').slice(1).forEach(function (t) { if (t.length > 1) toks(t).forEach(function (x) { put(x, i, 40); }); });   // Kennung (tdiv, rcd, led ...)
      toks(KATTXT[r[1]] || '').forEach(function (t) { put(t, i, 8); });
    });
    var keys = Object.keys(map).sort();
    var post = {}; keys.forEach(function (t) { var o = map[t], l = []; for (var i in o) l.push([+i, o[i]]); post[t] = l; });
    return { rows: rows, keys: keys, post: post, titles: titles, disp: disp };
  }

  /* ---------- Abfrage ---------- */
  function lowerBound(a, x) { var lo = 0, hi = a.length; while (lo < hi) { var m = (lo + hi) >> 1; if (a[m] < x) lo = m + 1; else hi = m; } return lo; }
  // Einzel-Token -> {zeile: gewicht}; exakt 1,0 · Praefix (>=3 Zeichen) 0,9 · Teilwort (>=4) 0,45
  function matchTok(ix, t, o) {
    var res = o || {}, p = ix.post[t], i, k, l, f;
    function add(list, fac) { for (var j = 0; j < list.length; j++) { var v = list[j][1] * fac, id = list[j][0]; if (!(res[id] >= v)) res[id] = v; } }
    if (p) add(p, 1);
    if (t.length >= 3) {
      for (i = lowerBound(ix.keys, t); i < ix.keys.length && ix.keys[i].indexOf(t) === 0; i++) if (ix.keys[i] !== t) add(ix.post[ix.keys[i]], 0.9);
    }
    if (t.length >= 4) {
      for (i = 0; i < ix.keys.length; i++) { k = ix.keys[i]; if (k.length > t.length && k.indexOf(t) > 0) add(ix.post[k], 0.45); }
    }
    return res;
  }
  // Begriff (evtl. mehrere Woerter): alle Woerter muessen im selben Eintrag treffen, Gewicht = Minimum
  function matchTerm(ix, term) {
    var ws = term.split(' ').filter(Boolean), res = null;
    ws.forEach(function (w) {
      var m = matchTok(ix, w);
      if (!res) res = m; else { var o = {}; for (var id in res) if (m[id] != null) o[id] = Math.min(res[id], m[id]); res = o; }
    });
    return res || {};
  }

  function parse(q) {
    var raw = String(q || '').split(/[\s,;]+/).filter(Boolean), cl = [], sm = synMap(), i, span, j, found;
    for (i = 0; i < raw.length;) {
      found = false;
      for (span = Math.min(3, raw.length - i); span >= 1 && !found; span--) {
        var phr = raw.slice(i, i + span).join(' '), forms = wordForms(phr), gs = [];
        forms.forEach(function (f) { (sm[f] || []).forEach(function (g) { if (gs.indexOf(g) < 0) gs.push(g); }); });
        if (gs.length || span === 1) {
          if (!forms.length) { i += 1; found = true; continue; }
          var alts = forms.map(function (f) { return { t: f, f: 1 }; });
          gs.forEach(function (g) { synMembers(g).forEach(function (m) { if (!alts.some(function (a) { return a.t === m; })) alts.push({ t: m, f: 0.8 }); }); });
          cl.push({ word: phr, alts: alts, orig: forms[0], syn: gs.length > 0 });
          i += span; found = true;
        }
      }
    }
    return cl;
  }
  function score(ix, clauses, ctx, mode) {
    var tot = {}, cnt = {}, dir = {}, lab = ctx && ctx.lab, id;
    clauses.forEach(function (c) {
      var best = {};
      c.alts.forEach(function (a) { var m = matchTerm(ix, a.t); for (var i in m) { var v = m[i] * a.f; if (!(best[i] >= v)) best[i] = v; } });
      c.alts.forEach(function (a) { if (a.f === 1) { var m2 = matchTerm(ix, a.t); for (var j in m2) dir[j] = 1; } });
      for (var i in best) { tot[i] = (tot[i] || 0) + (mode === 'or' ? best[i] / 2 : best[i]); cnt[i] = (cnt[i] || 0) + 1; }
    });
    var out = [], q = clauses.map(function (c) { return c.orig; }).join(' ');
    for (id in tot) {
      if (mode !== 'or' && cnt[id] < clauses.length) continue;
      var r = ix.rows[id], s = tot[id], ti = ix.titles[id];
      if (dir[id]) s += 30;
      if (ti === q) s += 60; else if (q && ti.indexOf(q) === 0) s += 30;
      if (lab && r[4] && (',' + r[4] + ',').indexOf(',' + lab + ',') >= 0) s += 15;
      if (r[1] === 'bauteil' || r[1] === 'geraet') s += 10;
      s += (r[6] || 0) * 2;
      out.push({ i: +id, s: s });
    }
    return out;
  }
  function finish(ix, list, lim, fuzzy) {
    list.sort(function (a, b) { return b.s - a.s || String(ix.rows[a.i][2]).length - String(ix.rows[b.i][2]).length || (ix.rows[a.i][0] < ix.rows[b.i][0] ? -1 : 1); });
    return list.slice(0, lim).map(function (x) { var r = ix.rows[x.i]; return { id: r[0], kat: r[1], titel: r[2], labs: r[4] ? r[4].split(',') : [], datei: r[5], score: Math.round(x.s * 10) / 10, fuzzy: !!fuzzy }; });
  }

  function search(ix, q, ctx) {
    var out = { hits: [], meint: null }, lim = (ctx && ctx.limit) || 30;
    if (!String(q || '').trim() || !ix.rows.length) return out;
    var cl = parse(q); if (!cl.length) return out;
    var list = score(ix, cl, ctx, 'and');
    if (!list.length && cl.length > 1) list = score(ix, cl, ctx, 'or');
    if (list.length >= 3) { out.hits = finish(ix, list, lim, false); return out; }
    // Tippfehler: je Klausel Tokens mit Damerau-Levenshtein <= 1 (ab 5 Zeichen) bzw. <= 2 (ab 9), gleicher Anfangsbuchstabe, Laengenunterschied <= Distanz
    var sug = [], changed = false;
    cl.forEach(function (c) {
      var w = c.orig; if (w.length < 5 || w.indexOf(' ') >= 0) { sug.push(c.word); return; }
      var d = w.length >= 9 ? 2 : 1, bestT = null, bestD = 9, bestW = 0, k, i, dd, any = false;
      if (matchTerm(ix, w) && Object.keys(matchTerm(ix, w)).length) { sug.push(c.word); return; }   // dieses Wort trifft schon
      for (i = 0; i < ix.keys.length; i++) {
        k = ix.keys[i]; if (k.charCodeAt(0) !== w.charCodeAt(0) || Math.abs(k.length - w.length) > d) continue;
        dd = dl(w, k, d); if (dd > d) continue;
        c.alts.push({ t: k, f: 0.5 }); any = true;
        var mw = 0; ix.post[k].forEach(function (p) { if (p[1] > mw) mw = p[1]; });
        if (dd < bestD || (dd === bestD && mw > bestW)) { bestD = dd; bestT = k; bestW = mw; }
      }
      if (any) { changed = true; sug.push(ix.disp[bestT] || bestT); } else sug.push(c.word);
    });
    var l2 = changed ? score(ix, cl, ctx, 'and') : [];
    if (changed && !l2.length && cl.length > 1) l2 = score(ix, cl, ctx, 'or');
    // exakte Treffer behalten, Tippfehler-Treffer ergaenzen (nur neue)
    var have = {}; list.forEach(function (x) { have[x.i] = 1; });
    var res = finish(ix, list, lim, false);
    if (l2.length) {
      var neu = l2.filter(function (x) { return !have[x.i]; }); neu.forEach(function (x) { x.s *= 0.5; });
      res = res.concat(finish(ix, neu, lim, true)).slice(0, lim);
      if (neu.length) out.meint = sug.join(' ');
    }
    out.hits = res;
    return out;
  }

  var api = { fold: fold, toks: toks, wordForms: wordForms, dl: dl, SYN: SYN, indexRow: indexRow, build: build, search: search, KATTXT: KATTXT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else window.WikiSuche = api;
})();
