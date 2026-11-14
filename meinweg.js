'use strict';
/* Tonfunk Lab: „Mein Weg“, ruhige Kurzansicht oben auf der Startseite (für neue und unsichere Nutzer).
   Oben: Weitermachen (der vorhandene Knopf #contGo wird hierher gesetzt) und Mein Stand. Darunter vier Kacheln: Wiederholen (fällige Karten und Aufgaben), 10-Minuten-Einheit
   (der vorhandene Knopf #e10Go), Ausbildungsplan bzw. Lernpfad mit dem nächsten Schritt, Prüfung bzw. bei den Wegen Studium (mit Prüfungs-Countdown).
   Darunter „Alle Labs“: die bestehenden Karten (Rubriken, Projekte, Plan-Zeile) einklappbar. Standard: für Nutzer ohne Fortschritt zu, mit Fortschritt offen wie bisher; die eigene Wahl
   merkt sich lm4.home.alle ('1' offen, '0' zu). Suche und „Startseite anpassen“ öffnen den Bereich vorübergehend (Klasse rub-free auf <html>).
   tiles(m, cd) ist reine Logik (Node-getestet); der Rest ist Oberfläche. Es wird nichts am Lernstand verändert. Fehlt ein Skript oder gibt es einen Fehler, bleibt die Startseite wie sie war. */
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
    const first = m.bereiche.find(b => !b.optional && b.n > 0 && b.ampel === 'gelb') || m.bereiche.find(b => !b.optional && b.n > 0 && b.ampel === 'grau');
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
  const doc = document, html = doc.documentElement, KEY = exp.KEY;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lsGet = k => { try { return root.localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { root.localStorage.setItem(k, v); } catch (e) {} };
  const MS = root.MeinStandCore;
  if (!MS || !doc.getElementById('top') || !doc.getElementById('contGo')) return;
  let sec = null, tg = null;
  const ICON = { stand: '📊', wd: '🔁', plan: '🗺', pr: '🎓' };
  /* Kachel in place aktualisieren (das Element bleibt, damit ein Tastaturfokus beim Neuzeichnen nicht verloren geht) */
  function setTile(id, ic, t) {
    const a = sec.querySelector('#' + id); if (!a) return;
    a.setAttribute('href', t.href);
    a.innerHTML = '<span class="mw-i" aria-hidden="true">' + ic + '</span><span class="mw-x"><b>' + esc(t.titel) + '</b><small>' + esc(t.text) + '</small>' + (t.sub ? '<small class="mw-s">' + esc(t.sub) + '</small>' : '') + '</span><span class="mw-p" aria-hidden="true">›</span>';
  }
  function model() { return MS.build(MS.fromGlobals(root)); }
  function fill() {
    if (!sec) return;
    let m; try { m = model(); } catch (e) { return; }
    let cd = null; try { cd = root.Countdown && root.Countdown.kurz ? root.Countdown.kurz(m) : null; } catch (e) { cd = null; }
    const t = tiles(m, cd);
    setTile('mwStand', ICON.stand, t.stand); setTile('mwWd', ICON.wd, t.wiederholen); setTile('mwPlan', ICON.plan, t.plan); setTile('mwPr', ICON.pr, t.pruefung);
    html.classList.toggle('mw-neu', t.neu);
    toggleLabel();
  }
  /* „Alle Labs“: Zustand und Knopf */
  const wantOpen = () => { let neu = false; try { neu = !MS.hatFortschritt(k => lsGet(k)); } catch (e) { neu = false; } return alleOffen(lsGet(KEY), neu); };
  function nLabs() { try { return doc.querySelectorAll('#groups .card:not(.vbrow):not(.be-out):not(.hm-hid)').length; } catch (e) { return 0; } }
  function toggleLabel() {
    if (!tg) return; const open = !html.classList.contains('mw-zu'), n = nLabs();
    tg.querySelector('.lb').textContent = 'Alle Labs' + (n ? ' (' + n + ')' : '') + (open ? '' : ': einblenden');
    tg.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  function setOpen(o, save) { html.classList.toggle('mw-zu', !o); if (save) lsSet(KEY, o ? '1' : '0'); toggleLabel(); }
  function build() {
    const top = doc.getElementById('top'), go = doc.getElementById('contGo'); if (!top || !go || doc.getElementById('meinWeg')) return;
    sec = doc.createElement('section'); sec.id = 'meinWeg'; sec.className = 'mw'; sec.setAttribute('aria-labelledby', 'mwH');
    sec.innerHTML = '<h2 id="mwH">Mein Weg</h2><div class="mw-g"><div class="mw-hero" id="mwHero"></div><a class="mw-t mw-stand" id="mwStand" href="meinstand.html"><span class="mw-x"><b>Mein Stand</b></span></a></div>'
      + '<div class="mw-row" id="mwRow"><a class="mw-t" id="mwWd" href="wiederholen.html"><span class="mw-x"><b>Wiederholen</b></span></a><a class="mw-t" id="mwPlan" href="ausbildungsplan.html"><span class="mw-x"><b>Ausbildungsplan</b></span></a><a class="mw-t" id="mwPr" href="meinstand.html#countdown"><span class="mw-x"><b>Prüfung</b></span></a></div>';
    top.parentNode.insertBefore(sec, top);
    sec.querySelector('#mwHero').appendChild(go);
    place();
    html.classList.add('mw');
    const sn = doc.querySelector('#bnav a[href="#top"]'); if (sn) { sn.setAttribute('href', '#meinWeg'); sn.setAttribute('data-t', 'meinWeg'); }   // "Start" in der unteren Leiste springt zu Mein Weg
    /* Alle Labs: Knopf über der Plan-Zeile */
    const anchor = doc.getElementById('planRow') || doc.getElementById('vbRow') || doc.getElementById('rub') || doc.getElementById('groups');
    if (anchor && anchor.parentNode) {
      tg = doc.createElement('button'); tg.type = 'button'; tg.id = 'mwAlle'; tg.className = 'cl-tg mw-tg'; tg.innerHTML = '<span class="ch" aria-hidden="true"></span><span class="lb"></span>';
      tg.setAttribute('aria-controls', 'groups');
      anchor.parentNode.insertBefore(tg, anchor);
      tg.addEventListener('click', () => setOpen(html.classList.contains('mw-zu'), true));
      setOpen(wantOpen(), false);
    }
    /* Sprungmarken der unteren Leiste und Adressen mit #grp-… öffnen den Bereich */
    doc.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[href^="#grp-"]'); if (a && html.classList.contains('mw-zu')) setOpen(true, false); });
    if (/^#grp-/.test(root.location.hash || '') && html.classList.contains('mw-zu')) setOpen(true, false);
    /* während Suche und „Startseite anpassen“ (rub-free) bleibt der Bereich sichtbar; Knopf-Text nachführen */
    try { new MutationObserver(() => toggleLabel()).observe(html, { attributes: true, attributeFilter: ['class'] }); } catch (e) {}
    fill();
  }
  /* 10-Minuten-Knopf (einheit10.js) in die Kachelreihe setzen, auch wenn er erst später entsteht */
  function place() {
    if (!sec) return; const row = sec.querySelector('#mwRow'), e10 = doc.getElementById('e10Go'); if (!row) return;
    if (e10 && e10.parentNode !== row) row.insertBefore(e10, row.querySelector('#mwPlan'));
    const go = doc.getElementById('contGo'), hero = sec.querySelector('#mwHero'); if (go && hero && go.parentNode !== hero) hero.insertBefore(go, hero.firstChild);
  }
  function again() { try { place(); fill(); } catch (e) {} }
  try { build(); } catch (e) { try { if (sec && sec.parentNode) { const go = doc.getElementById('contGo'), top = doc.getElementById('top'); if (go && top && go.parentNode !== top) top.insertBefore(go, top.firstChild); sec.remove(); } html.classList.remove('mw', 'mw-zu'); } catch (x) {} return; }
  [400, 1200, 2800].forEach(ms => setTimeout(again, ms));   // Plan, Coach und 10-Minuten-Knopf laden teils später
  root.addEventListener('load', again);
  root.addEventListener('pageshow', e => { if (e.persisted) again(); });
  doc.addEventListener('visibilitychange', () => { if (!doc.hidden) again(); });
  root.addEventListener('storage', again); root.addEventListener('countdown:geaendert', again); root.addEventListener('plan:geladen', again);
  root.MeinWeg.render = again; root.MeinWeg.setOpen = setOpen;
})(typeof window !== 'undefined' ? window : globalThis);
