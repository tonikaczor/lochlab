'use strict';
/* Tonfunk Lab: Suche auf der Startseite (SPEC-STARTSEITE-FABLE.md, Abschnitt 6.3). Offline, ohne Bibliothek.
   Indexiert Lab-Karten (aus dem DOM), alle Lernhefte (statische Liste HEFTE, aus lernen.html abgeleitet) und alle Aufgaben (AUFGABEN aus aufgaben.js).
   Labs werden in den Bereichen gefiltert (.card.srch-out), darunter steht eine Trefferliste mit Heften und Aufgaben.
   Tastatur: / oder Strg+K fokussiert, Esc leert, Pfeil auf/ab wählt, Enter öffnet. Die reine Suchlogik (norm, fold, search) wird in Node getestet.
   W12a Wiki: Treffer aus dem Wiki (Bauteile, Geräte, Begriffe, höchstens 2 Regler/Messwerte) als Gruppe "Im Wiki", Link wiki.html#e=<id>. Die Wiki-Skripte
   (wiki.js, wiki-suche.js, wiki-index.js) werden erst beim Fokus ins Suchfeld nachgeladen, der Regler-Index (wiki-index-regler.js) erst nach dem ersten Tastendruck;
   beim Start der Startseite wird nichts vom Wiki geladen. */
(function (root) {
  // [Datei, Titel, Kurztext]; Test test_home.js prüft, dass jede lernen-*.html (außer lernen.html) hier vorkommt
  const HEFTE = [
    ["lernen-loch.html", "Löten und Lochraster", "Bauteile, Löttechnik, Bestückung, typische Fehler. Mit Arbeitsblatt."],
    ["lernen-schalt.html", "Elektronikgrundlagen", "Ohmsches Gesetz, Teiler, Dioden, RC, Transistor und MOSFET, Netzteile, 555. Mit Rechenaufgaben."],
    ["lernen-sim.html", "Hausinstallation und Prüfung", "Schaltungen, Schutzmaßnahmen, Leitungen, Messen und DIN VDE 0701/0702. Mit Arbeitsblatt."],
    ["lernen-digi.html", "Digitaltechnik", "Zahlensysteme, Gatter, Wahrheitstabellen, Addierer, Flipflops, Zähler, echte ICs und eine kleine CPU. Mit Arbeitsblatt."],
    ["lernen-mess.html", "Messtechnik", "Multimeter, Messfehler, Netzgerät, Oszilloskop, Leistung und Kennlinien. Mit Arbeitsblatt."],
    ["lernen-els.html", "Sicherheits-Lab: Schutz, Prüfung, Rettung", "Gefährdung und Schutzebenen, Stromwirkung auf den Körper, Schutzklassen und Schutzart, Netzformen und Abschaltbedingung, LS-Schalter und Sicherungen, RCD, Isolations- und Schutzleiterwiderstand, Geräteprüfung nach VDE 0701-0702 mit Protokoll, Sicherheitsregeln und Rettungskette. Alle Werte außer…"],
    ["lernen-nts.html", "Netzteil-Lab: Netzteile und Schaltregler", "Funktionsblöcke und Leistungsbilanz, Transformator, Gleichrichter und Siebung mit Brummspannung, Z-Diode, Linearregler (7805, LM317) mit Verlustleistung, Schaltregler (Tiefsetzsteller, Hochsetzsteller, Inverswandler, Sperrwandler), Gate-Ansteuerung und Schaltverluste, Rückkopplung und…"],
    ["lernen-wsl.html", "Wechselstrom-Lab: Wechselstrom und Schwingkreise", "Sinusgrößen mit Effektivwert, Phase und Zeigerbild, Spule und Kondensator mit Blindwiderstand, Reihen- und Parallelschaltung mit Impedanz, Wirk-, Blind- und Scheinleistung, Blindleistungskompensation, Reihen- und Parallelschwingkreis mit Resonanz, Güte und Bandbreite, RC- und RL-Filter mit…"],
    ["lernen-ana.html", "Analogtechnik-Lab: Halbleiter und Verstärker", "Diode, LED und Z-Diode mit Vorwiderstand, Transistor als Schalter mit Relais und Freilaufdiode, Arbeitspunkt und Emitterschaltung, Emitterfolger und Stromquellen, Operationsverstärker als Invertierer, Nichtinvertierer, Komparator und Schmitt-Trigger sowie Integrierer, Filter und der reale…"],
    ["lernen-haus.html", "Elektroinstallation", "Stromkreise, Verteilerkasten, Leitungen, Schalten, Last verteilen und Fehlersuche im 3D-Haus. Mit Arbeitsblatt."],
    ["lernen-app.html", "App-Werkstatt: Eigene Apps mit KI", "Aufträge an eine KI schreiben, Apps prüfen und weitergeben, Notizen im Obsidian-Format. Mit Arbeitsblatt, ohne Vorkenntnisse."],
    ["lernen-sps.html", "SPS-Lab: Steuerungen programmieren", "Zyklus einer SPS, Adressen in IEC und Siemens, KOP, FUP und GRAFCET, Zeitglieder, Zähler, vier Anlagen und Fehlersuche. Mit Arbeitsblatt zu allen 24 Aufgaben."],
    ["lernen-pcb.html", "Leiterplatten-Lab: Entwurf, Fertigung und Prüfung", "Lagen und Vias, Bahnbreite nach IPC, Masse und Rückstrom, DRC, Gerber-Daten, Bestücken und Löten, Fehlersuche und die Prüfverfahren SPI, AOI, AXI, ICT, Flying Probe und Boundary Scan. Mit Arbeitsblatt zu allen 43 Aufgaben."],
    ["lernen-ant.html", "Antriebs-Lab: Motoren, Regelung und Getriebe", "Drehzahl, Moment und Wirkungsgrad, Gleichstrommotor mit H-Brücke und PWM, Servo und Regelung, Schrittmotor, Drehstrom mit Typenschild und Stern-Dreieck, Frequenzumrichter, Getriebe und Fehlersuche. Mit Arbeitsblatt zu allen 30 Aufgaben."],
    ["lernen-sen.html", "Sensorik-Lab: Sensoren, Messketten und Normsignale", "Messkette vom Sensor bis zur Anzeige, Temperaturfühler (NTC, Pt100, Thermoelement) mit 2-, 3- und 4-Leiter-Technik, Licht und Näherungsschalter, DMS-Brücke und Kalibrierung, Beschleunigung, Normsignale 4…20 mA mit Drahtbruch, ADU und Aliasing sowie I²C-Sensoren. Mit Arbeitsblatt zu allen 28…"],
    ["lernen-reg.html", "Regelungstechnik-Lab: Regelkreis, Regler und Einstellen", "Wirkungsplan und Begriffe nach DIN 19226, Regelstrecken und Sprungantwort, P-, I- und D-Anteil, Stabilität und Schwingversuch, Einstellregeln nach Ziegler-Nichols, Chien-Hrones-Reswick und T-Summe, Zweipunktregler am Bügeleisen und Kühlschrank, Heizung, Tank, Drehzahl und Lage in der Praxis,…"],
    ["lernen-thm.html", "Thermik-Lab: Wärme, Kühlkörper und Wärmewiderstand", "Verlustleistung berechnen (Linearregler, Transistor, MOSFET, Diode, Widerstand), thermisches Ersatzschaltbild mit der Kette Rth_JC, Rth_CK und Rth_K, Wärmeleitpaste, Glimmerscheibe und Isolierbuchse, Kühlkörper mit Lüfter und Einbaulage, der Berechnungsgang für den erforderlichen Kühlkörper,…"],
    ["lernen-emv.html", "EMV-Lab: Störungen erkennen und beseitigen", "Störquelle, Kopplungspfad und Störsenke mit den drei Hebeln der Entstörung, Pegel und dB, Kopplungsarten, Spektrum und Oberwellen, Filter, Schirmung, Leitungen und Layout, ESD, Burst und Surge, Messen mit Tastkopf, Vorprüfung und ein Überblick über CE und Normen. Alle Grenzlinien und Prüfpegel…"],
    ["lernen-enr.html", "Energie-Lab: Solar, Akku, Wechselrichter", "Solarmodul-Kennlinie, Verschattung mit Bypassdioden, Laderegler mit Akku, Inselanlage und Netzeinspeisung. Mit Arbeitsblatt."],
    ["lernen-arduino.html", "Arduino verstehen", "Vom ersten Blinken zu Sensoren und Servo: 11 Kapitel mit Probier es aus-Knöpfen und Aufgaben mit automatischer Prüfung im Arduino-Lab."],
    ["lernen-pi.html", "Raspberry Pi verstehen", "Was ist ein Pi, Inbetriebnahme (auch ohne Monitor), die GPIO-Leiste, Python, LED, Taster, Sensoren und sicheres Arbeiten."],
    ["lernen-ds.html", "Datenblatt-Lab: Datenblätter lesen und verstehen", "Aufbau eines Datenblatts, Grenzwerte und Betriebswerte, Min, Typ und Max, Kennlinien mit logarithmischer Achse, Thermik und Derating, Auslegung mit LED, Transistor und Regler, Bauteilwahl, Zeitdiagramme und Register sowie Fachenglisch. Die Datenblätter im Lab sind fiktive Übungsdatenblätter. Mit…"],
    ["lernen-pr.html", "Prüfungs-Lab: Für die Abschlussprüfung üben", "Aufbau der Prüfung, sicher rechnen, die acht Themen, Lernplan und Strategie. Mit Arbeitsblatt."],
    ["lernen-w24.html", "Praxisschaltung W-2024 verstehen", "Die Schaltung der Praxisprüfung W-2024 Schritt für Schritt: Aufbau, Bauteile, Wirkungsweise und Fehlersuche, mit sieben Arbeitsblättern und einer Probeprüfung zum Ausdrucken. Die Lösungen sind für Ausbilder gedacht und liegen verschlüsselt im Lab."],
    ["lernen-vb.html", "Projekte: Verbundprojekte", "Fünf Projekte, in denen alle Labs zusammen ein Gerät fertigstellen: Garagentor, Ampelanlage, Digitale Uhr, Gartenbewässerung und Förderanlage. Ablauf, Stufen und Punkte, Datenübergabe, die Projekte mit Beispiel-Lastenheft, Formeln, Tipps, Abschlussbericht und Hinweise für die Gruppenarbeit. Mit…"]
  ];
  const toStr = s => String(s == null ? '' : s);
  // Umlaute zu ae/oe/ue/ss (Eingabe "waerme" findet "Wärme"); fold: zusätzlich Akzente weg ("warme" findet auch "Wärme")
  const norm = s => toStr(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
  const fold = s => toStr(s).toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const toks = s => toStr(s).trim().split(/\s+/).filter(Boolean);
  const MIN = 2, MAX_HEFT = 6, MAX_AUFG = 10, MAX_WIKI = 4, MAX_WIKI_REGLER = 2;
  // Wiki-Treffer ({id, kat, titel, labs}) in Eintraege (Bauteile, Geraete, Begriffe ...) und Regler/Messwerte trennen; Regler hoechstens 2, nie vor den Eintraegen
  const isReg = e => e && (e.kat === 'regler' || e.kat === 'messwert');
  function wikiSplit(hits) {
    const a = (hits || []).filter(e => e && e.id && e.titel);
    return { wiki: a.filter(e => !isReg(e)).slice(0, MAX_WIKI), reg: a.filter(isReg).slice(0, MAX_WIKI_REGLER) };
  }
  const wikiHref = id => 'wiki.html#e=' + encodeURIComponent(id);
  function prep(e) { const t = e.text || ''; e._n = norm(t); e._f = fold(t); e._nn = norm(e.name); e._nf = fold(e.name); return e; }
  const hit = (n, f, tn, tf) => tn.every((t, i) => n.indexOf(t) >= 0 || f.indexOf(tf[i]) >= 0);
  // Eintrag passt, wenn jedes Wort der Eingabe im Text vorkommt; Rang: Name vor Text, Labs vor Heften vor Aufgaben
  function search(idx, q) {
    const qq = toStr(q).trim(); if (qq.length < MIN) return { active: false, labs: [], hefte: [], aufg: [], n: { lab: 0, heft: 0, aufg: 0 } };
    const tn = toks(norm(qq)), tf = toks(fold(qq)), out = { lab: [], heft: [], aufg: [] };
    idx.forEach((e, i) => {
      if (!hit(e._n, e._f, tn, tf)) return;
      out[e.typ === 'aufg' ? 'aufg' : e.typ === 'heft' ? 'heft' : 'lab'].push({ e, nm: hit(e._nn, e._nf, tn, tf) ? 0 : 1, i });
    });
    const srt = a => a.sort((x, y) => x.nm - y.nm || x.i - y.i).map(x => x.e);
    const labs = srt(out.lab), hefte = srt(out.heft), aufg = srt(out.aufg);
    return { active: true, labs, hefte: hefte.slice(0, MAX_HEFT), aufg: aufg.slice(0, MAX_AUFG), n: { lab: labs.length, heft: hefte.length, aufg: aufg.length } };
  }
  const countText = n => {
    const p = []; if (n.lab) p.push(n.lab + (n.lab === 1 ? ' Lab' : ' Labs')); if (n.heft) p.push(n.heft + (n.heft === 1 ? ' Heft' : ' Hefte')); if (n.aufg) p.push(n.aufg + (n.aufg === 1 ? ' Aufgabe' : ' Aufgaben')); if (n.wiki) p.push(n.wiki + (n.wiki === 1 ? ' Wiki-Eintrag' : ' Wiki-Einträge'));
    return p.length ? p.join(', ') : 'Nichts gefunden';
  };
  function buildIndex(REG, ROWS, labEntries) {
    const idx = [];
    (labEntries || []).forEach(l => idx.push(prep(Object.assign({ typ: 'lab' }, l))));
    HEFTE.forEach(h => idx.push(prep({ typ: 'heft', key: h[0].replace(/\.html$/, ''), name: h[1], text: h[1] + ' ' + h[2] + ' Lernheft', href: h[0] })));
    (ROWS || []).forEach(r => { const R = REG[r[1]]; if (!R) return; idx.push(prep({ typ: 'aufg', key: r[0], name: r[3], text: r[2] + ' ' + r[3] + ' ' + R.name + ' ' + (R.short || ''), href: R.file + '?aufgabe=' + r[0], lab: R.short || R.name, thema: r[2] })); });
    return idx;
  }
  if (typeof module === 'object' && module.exports) module.exports = { norm, fold, search, countText, buildIndex, wikiSplit, wikiHref, HEFTE, MIN, MAX_HEFT, MAX_AUFG, MAX_WIKI, MAX_WIKI_REGLER };
  if (typeof document === 'undefined') return;

  const doc = document, esc = s => toStr(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const form = doc.getElementById('srch'), input = doc.getElementById('srchIn'), res = doc.getElementById('srchRes'), clr = doc.getElementById('srchClr'), live = doc.getElementById('srchLive');
  if (!form || !input || !res) return;
  form.hidden = false;
  let idx = null, cards = [], active = -1, lastQ = '', tmr = 0;

  /* ---- Wiki (W12a): Skripte lazy, nur auf Suchfokus bzw. ersten Tastendruck ---- */
  const inj = {}, WBASE = ['wiki.js', 'wiki-suche.js', 'wiki-index.js'];
  let wikiOk = false, wikiBaseP = null, wikiRegP = null;
  const inject = src => inj[src] || (inj[src] = new Promise(res => { const sc = doc.createElement('script'); sc.src = src; sc.async = true; sc.onload = () => res(true); sc.onerror = () => res(false); doc.head.appendChild(sc); }));
  function wikiBase() {
    if (!wikiBaseP) wikiBaseP = Promise.all(WBASE.map(inject)).then(r => { wikiOk = r.every(Boolean) && !!(root.Wiki && root.Wiki.search && root.WikiSuche && root.WikiIndex); if (wikiOk && input.value.trim().length >= MIN) update(); return wikiOk; });
    return wikiBaseP;
  }
  function wikiReg() {   // Regler-Index (195 KB) erst nach dem ersten Tastendruck
    if (!wikiRegP) wikiRegP = wikiBase().then(ok => ok ? inject('wiki-index-regler.js') : false).then(ok => { if (ok && input.value.trim().length >= MIN) update(); return ok; });
    return wikiRegP;
  }
  function wikiHits(q) {
    if (!wikiOk) return { wiki: [], reg: [] };
    try { return wikiSplit(root.Wiki.search(q)); } catch (e) { return { wiki: [], reg: [] }; }
  }

  function init() {
    if (idx) return;
    cards = Array.from(doc.querySelectorAll('.card')).filter(c => !c.classList.contains('hm-ghost'));
    // Die Wiki-Kachel ist kein Lab: nicht im Suchindex (zählt nicht als "Lab"-Treffer), sie wird bei aktiver Suche ausgeblendet; Wiki-Treffer stehen in der Gruppe "Im Wiki"
    const labs = cards.filter(c => !c.classList.contains('wikirow')).map(c => {
      const tag = c.querySelector('.tag'), h = c.querySelector('h3');
      const text = Array.from(c.querySelectorAll('.tag,h3,p,.steps span')).map(x => x.textContent).join(' ');
      return { key: c.dataset.lab || c.dataset.hub || '', name: (tag ? tag.textContent : '') + ' ' + (h ? h.textContent : ''), text, el: c };
    });
    idx = buildIndex(root.LAB_REG || {}, root.AUFGABEN || [], labs);
  }
  const opts = () => Array.from(res.querySelectorAll('[role=option]'));
  function setActive(i) {
    const o = opts(); if (!o.length) { active = -1; input.removeAttribute('aria-activedescendant'); return; }
    active = (i + o.length) % o.length;
    o.forEach((a, k) => a.setAttribute('aria-selected', k === active ? 'true' : 'false'));
    input.setAttribute('aria-activedescendant', o[active].id); o[active].scrollIntoView({ block: 'nearest' });
  }
  function showRes(on) { res.hidden = !on; input.setAttribute('aria-expanded', on ? 'true' : 'false'); if (!on) { active = -1; input.removeAttribute('aria-activedescendant'); } }
  function say(msg) { clearTimeout(tmr); tmr = setTimeout(() => { live.textContent = msg; }, 450); }

  function update() {
    init();
    const q = input.value; lastQ = q; clr.hidden = !q;
    const r = search(idx, q), set = new Set(r.labs.map(e => e.el));
    const wh = r.active ? wikiHits(q) : { wiki: [], reg: [] }, wl = wh.wiki.concat(wh.reg); r.n.wiki = wl.length;
    cards.forEach(c => c.classList.toggle('srch-out', r.active && !set.has(c)));
    const keys = new Set(); r.labs.forEach(e => { const g = root.HomeGroups && root.HomeGroups.groupOf(e.el); if (g) keys.add(g); });
    if (root.HomeGroups) root.HomeGroups.setSearch(r.active ? keys : null);
    doc.documentElement.classList.toggle('srch-on', r.active);
    if (!r.active) { res.innerHTML = ''; showRes(false); live.textContent = ''; return; }
    let h = '', n = 0;
    const row = (e, ty, meta) => '<a role="option" id="srchO' + (n++) + '" href="' + esc(e.href) + '" tabindex="-1" aria-selected="false"><span class="ty">' + ty + '</span><span class="nm">' + esc(e.name) + '</span>' + (meta ? '<span class="sb">' + esc(meta) + '</span>' : '') + '</a>';
    if (r.hefte.length) h += '<div role="group" aria-label="Lernhefte"><div class="ghd" aria-hidden="true">Lernhefte</div>' + r.hefte.map(e => row(e, 'Heft', '')).join('') + '</div>';
    // W9 (Design-Review P2-8): Wiki-Treffer zweizeilig wie im Wiki selbst (Icon, Titel mit Indizes, Pille Kategorie, Lab darunter) + Zeile "Alle Wiki-Treffer"
    const wrow = e => { const W = root.Wiki, reg = /^(regler|messwert)$/.test(e.kat), lab = reg && e.labs && e.labs[0] && W.LABS[e.labs[0]] ? W.LABS[e.labs[0]][0] : '';
      return '<a role="option" class="wkr" id="srchO' + (n++) + '" href="' + esc(wikiHref(e.id)) + '" tabindex="-1" aria-selected="false"><svg class="ri" aria-hidden="true" viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20"/><path d="M9 7h7M9 10.5h7"/></svg><span class="nm">' + (W.formel ? W.formel(e.titel) : esc(e.titel)) + '</span><span class="ty">' + esc(W.KAT && W.KAT[e.kat] ? W.KAT[e.kat][0] : e.kat) + '</span>' + (lab ? '<span class="sb">' + esc(lab) + '</span>' : '') + '</a>'; };
    if (wl.length) h += '<div role="group" aria-label="Im Wiki"><div class="ghd" aria-hidden="true">Im Wiki</div>' + wl.map(wrow).join('') + '<a role="option" class="wkr more" id="srchO' + (n++) + '" href="wiki.html#q=' + encodeURIComponent(q.trim()) + '" tabindex="-1" aria-selected="false"><span class="nm">Alle Wiki-Treffer für „' + esc(q.trim()) + '“ →</span></a></div>';
    if (r.aufg.length) h += '<div role="group" aria-label="Aufgaben"><div class="ghd" aria-hidden="true">Aufgaben</div>' + r.aufg.map(e => row(e, 'Aufgabe', e.lab + ' · ' + e.thema)).join('') + '</div>';
    const ct = countText(r.n);
    if (!r.n.heft && !r.n.aufg && !wl.length) h = '<p class="none">' + (r.n.lab ? esc(ct) + '. Die passenden Labs stehen unten in den Bereichen.' : 'Nichts gefunden – Begriff kürzer fassen.') + '</p>';
    else h = '<p class="cnt" aria-hidden="true">' + esc(ct) + (r.n.heft > r.hefte.length || r.n.aufg > r.aufg.length ? ' (die besten stehen hier)' : '') + '</p>' + h;
    res.innerHTML = h; showRes(true); active = -1; say(ct);
  }
  function clear() { input.value = ''; update(); }
  function go(a) { if (a && a.href) location.href = a.href; }

  input.addEventListener('input', () => { if (input.value.trim().length >= 1) wikiReg(); update(); });
  input.addEventListener('focus', () => { wikiBase(); if (input.value.trim().length >= MIN && res.innerHTML) showRes(true); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { if (res.hidden && res.innerHTML) showRes(true); e.preventDefault(); setActive(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active < 0 ? -1 : active - 1); }
    else if (e.key === 'Enter') {
      e.preventDefault(); const o = opts();
      if (active >= 0 && o[active]) go(o[active]); else if (o.length) go(o[0]);
      else { const c = cards.find(x => !x.classList.contains('srch-out') && !x.classList.contains('hm-hid') && x.offsetParent !== null), b = c && c.querySelector('.btns a'); if (b) b.focus(); }
    } else if (e.key === 'Escape') { if (input.value || !res.hidden) { e.preventDefault(); clear(); } }
  });
  clr.addEventListener('click', () => { clear(); input.focus(); });
  res.addEventListener('mousedown', e => e.preventDefault());       // Fokus bleibt im Feld, der Klick auf einen Treffer geht nicht verloren
  doc.addEventListener('pointerdown', e => { if (!form.contains(e.target)) showRes(false); });
  form.addEventListener('focusout', () => setTimeout(() => { if (!form.contains(doc.activeElement)) showRes(false); }, 150));
  doc.addEventListener('keydown', e => {
    const t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    if ((e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) || ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey) && !e.altKey)) { e.preventDefault(); input.focus(); input.select(); }
  });
  root.HomeSearch = { search: q => { init(); return search(idx, q); }, update };
})(typeof window !== 'undefined' ? window : this);
