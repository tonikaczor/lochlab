'use strict';
/* Tonfunk Lab: „Mein Weg“, der Kern der Ansicht Start (für neue und unsichere Nutzer).
   tiles(m, cd) ist reine Logik (Node-getestet): Mein Stand, Wiederholen, Plan, Prüfung aus dem Modell von meinstand-core.js und dem Countdown.
   alleOffen() und der Schlüssel lm4.home.alle stammen aus der Zeit vor dem Umbau in fünf Ansichten ("Alle Labs" einklappbar); der Schlüssel bleibt im Speicher, wird aber nicht mehr gelesen.
   Es wird nichts am Lernstand verändert. Fehlt ein Skript oder gibt es einen Fehler, bleibt die Startseite wie sie war. */
(function (root) {
  const WEGE = ['tec', 'stu', 'wing', 'winf'];
  const pl = (n, e, m) => n + ' ' + (n === 1 ? e : m);
  const ft = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  /* ---------- reine Logik ---------- */
  function tiles(m, cd) {
    const weg = !!m.weg, nW = m.wiederholen.liste.length, nK = m.karten.faellig;
    const st = {
      titel: 'Mein Stand',
      text: m.leer ? 'Hier siehst du, wo du stehst. Noch nichts begonnen, das ist völlig in Ordnung.' : ft(m.gesamt.d) + ' von ' + ft(m.gesamt.n) + ' Aufgaben gelöst (' + m.gesamt.pct + ' %)' + (m.serie.serie > 1 ? ' · Serie ' + m.serie.serie + ' Tage' : ''),
      sub: m.naechster ? 'Nächster Schritt: ' + m.naechster.titel : '', href: 'meinstand.html'
    };
    const parts = []; if (nK > 0) parts.push(pl(nK, 'Lernkarte', 'Lernkarten') + ' fällig'); if (nW > 0) parts.push(pl(nW, 'Aufgabe', 'Aufgaben') + ' zum Wiederholen');
    const wd = { titel: 'Wiederholen', text: parts.length ? parts.join(' · ') : (m.karten.neu > 0 ? 'Heute ist nichts fällig. Lernkarten zum Üben warten.' : 'Heute ist nichts fällig.'), href: nW > 0 ? 'wiederholen.html' : 'karten.html', n: nK + nW };
    const first = m.bereiche.find(b => !b.optional && b.n > 0 && (b.ampel === 'gelb' || b.ampel === 'grau'));   // erster offener Bereich in Planreihenfolge
    const pn = { titel: weg ? 'Mein Lernpfad' : 'Ausbildungsplan', text: first ? (first.ampel === 'gelb' ? 'Weiter: ' : 'Starte mit: ') + first.titel : (m.bereiche.length ? 'Alles Wichtige ist geschafft. Schau dir die Übersicht an.' : (weg ? 'Module ansehen' : 'Lernfelder ansehen')), href: 'ausbildungsplan.html' };
    let pr;
    if (cd) pr = { titel: weg ? 'Studium' : 'Prüfung', text: cd.text + (cd.heute ? ' Heute dran: ' + cd.heute.titel + '.' : ''), href: cd.href, gesetzt: true };
    else if (weg) pr = { titel: 'Studium', text: 'Datum von Klausur oder Abschluss setzen, dazu ein Wochenplan.', href: 'meinstand.html#countdown', gesetzt: false };
    else pr = { titel: 'Prüfung', text: m.hatPool ? 'Probeprüfung machen und Countdown mit Wochenplan setzen.' : 'Datum der Abschlussprüfung setzen, dazu ein Wochenplan.', href: 'meinstand.html#countdown', gesetzt: false };
    return { neu: !!m.leer, stand: st, wiederholen: wd, plan: pn, pruefung: pr };
  }
  /* „Alle Labs“ offen? Eigene Wahl ('1' offen, '0' zu) gilt immer; sonst offen, sobald es Fortschritt gibt */
  const alleOffen = (stored, neu) => (stored === '1' ? true : stored === '0' ? false : !neu);
  const exp = { tiles, alleOffen, WEGE, KEY: 'lm4.home.alle' };
  if (typeof module === 'object' && module.exports) module.exports = exp;
  root.MeinWeg = Object.assign(root.MeinWeg || {}, exp);
  if (typeof document === 'undefined') return;

  /* ---------- Oberfläche ---------- */
  /* Ansicht Start (Umbau S1): #meinWeg mit der blauen Karte (#contGo wird aus #top hierher gesetzt) und darunter nur Fälligem: Wiederholen (nur wenn etwas fällig ist),
     10-Minuten-Einheit (#e10Go aus einheit10.js, nur wenn heute noch keine gemacht wurde, nicht bei den Wegen), Prüfungstermin (nur mit Datum).
     Beim ersten Besuch (kein Beruf gespeichert, kein Fortschritt) steht darüber die Frage "Was lernst du?" (#mwErst) und sonst nur die blaue Karte.
     "Mein Stand" (#mwStand) steht in der Ansicht "Ich" (#ichStand), den Zustand der Zeile Wiederholen in "Üben" (#ubWd) füllt dieses Skript mit.
     Die alte Sprungmarke #meinWeg führt über home-views.js in die Ansicht Start. Es wird nichts in den Speicher geschrieben. */
  const doc = document, html = doc.documentElement;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lsGet = k => { try { return root.localStorage.getItem(k); } catch (e) { return null; } };
  const MS = root.MeinStandCore;
  if (!MS || !doc.getElementById('top') || !doc.getElementById('contGo')) return;
  let sec = null;
  const SYM = { stand: 'i-chart', wd: 'i-repeat', pr: 'i-cal' };
  const ic = s => '<span class="mw-i" aria-hidden="true"><svg class="i" viewBox="0 0 24 24" focusable="false"><use href="#' + s + '"/></svg></span>';
  /* Zeile in place aktualisieren (das Element bleibt, damit ein Tastaturfokus beim Neuzeichnen nicht verloren geht) */
  function setTile(a, sym, t) {
    if (!a) return;
    a.setAttribute('href', t.href);
    a.innerHTML = ic(sym) + '<span class="mw-x"><b>' + esc(t.titel) + '</b><small>' + esc(t.text) + '</small></span><span class="mw-p" aria-hidden="true">›</span>';
  }
  function model() { return MS.build(MS.fromGlobals(root)); }
  const erstBesuch = () => { let neu = false; try { neu = !MS.hatFortschritt(k => lsGet(k)); } catch (e) { neu = false; } return neu && !lsGet('lm4.beruf'); };
  function e10heute() { try { const E = root.Einheit10, e = E && E.normE ? E.normE(JSON.parse(lsGet(E.KEY) || '{}')) : null; return !!(e && e.tage[E.tagKey(Date.now())]); } catch (e) { return false; } }
  function fill() {
    if (!sec) return;
    let m; try { m = model(); } catch (e) { return; }
    let cd = null; try { cd = root.Countdown && root.Countdown.kurz ? root.Countdown.kurz(m) : null; } catch (e) { cd = null; }
    const t = tiles(m, cd), erst = erstBesuch();
    html.classList.toggle('mw-neu', t.neu); html.classList.toggle('mw-erst', erst);
    const erstEl = sec.querySelector('#mwErst'); if (erstEl) erstEl.hidden = !erst;
    /* Fälliges */
    const wd = sec.querySelector('#mwWd'), pr = sec.querySelector('#mwPr'), e10 = doc.getElementById('e10Go');
    setTile(wd, SYM.wd, t.wiederholen); wd.hidden = erst || !(t.wiederholen.n > 0);
    setTile(pr, SYM.pr, t.pruefung); pr.hidden = erst || !t.pruefung.gesetzt;
    if (e10) e10.classList.toggle('mw-aus', erst || !!m.weg || e10heute());
    const due = sec.querySelector('#mwDue'); if (due) due.hidden = [wd, pr, e10].every(x => !x || x.hidden || x.classList.contains('mw-aus'));
    /* Ich: Mein Stand (ohne "Nächster Schritt": die Empfehlung steht nur in der blauen Karte) */
    const host = doc.getElementById('ichStand');
    if (host) { let a = doc.getElementById('mwStand'); if (!a) { host.insertAdjacentHTML('afterbegin', '<a class="mw-t mw-stand" id="mwStand" href="meinstand.html"></a>'); a = doc.getElementById('mwStand'); } setTile(a, SYM.stand, t.stand); }
    /* Üben: Zustand der Zeile Wiederholen */
    const uw = doc.getElementById('ubWd'), uz = doc.getElementById('ubWdZ');
    if (uw) uw.setAttribute('href', t.wiederholen.href);
    if (uz) uz.textContent = t.wiederholen.n > 0 ? t.wiederholen.n + ' fällig' : 'nichts fällig';
  }
  /* Erster Besuch: elf Einträge (sieben Berufe, vier Wege); die Wahl speichert berufe.js und lädt die Startseite neu */
  function erstHtml() {
    const B = root.Berufe; if (!B || !B.BERUFE) return '';
    const k = l => l.map(b => '<button type="button" class="mw-k" data-k="' + esc(b.k) + '"><b>' + esc(b.n) + '</b><small>' + esc(b.s) + '</small></button>').join('');
    return '<h2 class="vh" id="mwErstH">Willkommen! Was lernst du?</h2><p class="vsub">Dann zeigt dir Tonfunk Lab die passenden Labs. Du kannst es später unter „Ich“ ändern.</p>'
      + '<p class="mw-gl">Ausbildung</p><div class="mw-wahl">' + k(B.BERUFE) + '</div><p class="mw-gl">Studium und Technik</p><div class="mw-wahl">' + k(B.WEGE) + '</div>'
      + '<p class="mw-gl">Oder gleich loslegen</p>';
  }
  function build() {
    const top = doc.getElementById('top'), go = doc.getElementById('contGo'); if (!top || !go || doc.getElementById('meinWeg')) return;
    sec = doc.createElement('section'); sec.id = 'meinWeg'; sec.className = 'mw'; sec.setAttribute('aria-label', 'Dein nächster Schritt');
    sec.innerHTML = '<div class="mw-erst" id="mwErst" aria-labelledby="mwErstH" hidden>' + erstHtml() + '</div><div class="mw-hero" id="mwHero"></div>'
      + '<section class="mw-due" id="mwDue" aria-labelledby="mwDueH" hidden><h3 class="vh3" id="mwDueH">Heute dran</h3><div class="vl" id="mwRow"><a class="mw-t" id="mwWd" href="wiederholen.html" hidden></a><a class="mw-t" id="mwPr" href="meinstand.html#countdown" hidden></a></div></section>';
    top.parentNode.insertBefore(sec, top);
    sec.querySelector('#mwHero').appendChild(go);
    sec.querySelector('#mwErst').addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-k]'); if (b && root.Berufe && root.Berufe.waehle) root.Berufe.waehle(b.dataset.k); });
    place();
    html.classList.add('mw');
    fill();
  }
  /* 10-Minuten-Knopf (einheit10.js) in die Liste des Fälligen setzen, auch wenn er erst später entsteht */
  function place() {
    if (!sec) return; const row = sec.querySelector('#mwRow'), e10 = doc.getElementById('e10Go'); if (!row) return;
    if (e10 && e10.parentNode !== row) row.insertBefore(e10, row.querySelector('#mwPr'));
    const go = doc.getElementById('contGo'), hero = sec.querySelector('#mwHero'); if (go && hero && go.parentNode !== hero) hero.insertBefore(go, hero.firstChild);
  }
  function again() { try { place(); fill(); } catch (e) {} }
  try { build(); } catch (e) { try { if (sec && sec.parentNode) { const go = doc.getElementById('contGo'), top = doc.getElementById('top'); if (go && top && go.parentNode !== top) top.insertBefore(go, top.firstChild); sec.remove(); } html.classList.remove('mw', 'mw-erst'); } catch (x) {} return; }
  [400, 1200, 2800].forEach(ms => setTimeout(again, ms));   // Plan, Countdown und 10-Minuten-Knopf laden teils später
  root.addEventListener('load', again);
  root.addEventListener('pageshow', e => { if (e.persisted) again(); });
  doc.addEventListener('visibilitychange', () => { if (!doc.hidden) again(); });
  root.addEventListener('storage', again); root.addEventListener('countdown:geaendert', again); root.addEventListener('einheit10:fertig', again);
  root.MeinWeg.render = again;
})(typeof window !== 'undefined' ? window : globalThis);
