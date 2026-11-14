'use strict';
/* Tonfunk Lab: „Mein Stand“, Oberfläche (Seite meinstand.html). Rechnung und Quellen der Wahrheit: meinstand-core.js.
   Die Seite liest nur. Sie schreibt nichts in den Lernstand (der Countdown speichert sein eigenes Datum in lm4.countdown, das macht countdown.js).
   Alle Texte werden mit esc() eingesetzt. Ampel: Farbe plus Symbol plus Wort, nie nur Farbe. */
(function (root) {
  if (typeof document === 'undefined') return;
  const doc = document, MS = root.MeinStandCore;
  if (!MS) return;
  const $ = id => doc.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const NAMEN = { egs: 'Elektroniker', ige: 'Industrieelektriker', im: 'Industriemechaniker', tpd: 'Techn. Produktdesigner', fll: 'Lagerlogistik', ik: 'Industriekaufmann', fi: 'Fachinformatiker', tec: 'Techniker Elektrotechnik', stu: 'Studium Elektrotechnik', wing: 'Wirtschaftsingenieur', winf: 'Wirtschaftsinformatik' };
  const AMP = { grau: { sym: '○', txt: 'Nicht begonnen' }, gelb: { sym: '◐', txt: 'In Arbeit' }, gruen: { sym: '✓', txt: 'Sicher' } };
  const dmy = k => { const p = String(k).split('-'); return p.length === 3 ? p[2] + '.' + p[1] + '.' : k; };
  const wdTag = k => { const d = new Date(k + 'T12:00:00'); return ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][d.getDay()] || ''; };

  function loadScript(src, cb) { try { const s = doc.createElement('script'); s.src = src; s.onload = () => cb(true); s.onerror = () => cb(false); doc.head.appendChild(s); } catch (e) { cb(false); } }
  /* Plan des gewählten Berufs nachladen (wie home-plan.js), dann zeichnen */
  function ensurePlan(cb) {
    let b = 'egs'; try { b = root.BerufReg ? root.BerufReg.cur() : 'egs'; } catch (e) {}
    const AP = root.AusbildungsPlan; if (!AP || AP.plan(b)) return cb();
    loadScript('ausbildungsplan-' + b + '.js', () => cb());
  }

  const dot = a => '<span class="dot ' + a + '" aria-hidden="true">' + AMP[a].sym + '</span>';
  const lbl = a => '<span class="lbl ' + a + '">' + AMP[a].txt + '</span>';
  const num = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  function kopf(m) {
    const k = m.karten, w = m.wiederholen, s = m.serie;
    let h = '<div class="kpi"><b>' + m.gesamt.d + ' von ' + num(m.gesamt.n) + '</b><span>Aufgaben gelöst (' + m.gesamt.pct + ' %)</span></div>'
      + '<div class="kpi"><b>' + k.faellig + '</b><span>' + (k.faellig === 1 ? 'Lernkarte fällig' : 'Lernkarten fällig') + (k.neu ? ', ' + k.neu + ' neu' : '') + '</span></div>'
      + '<div class="kpi"><b>' + w.liste.length + '</b><span>' + (w.liste.length === 1 ? 'Aufgabe' : 'Aufgaben') + ' heute zum Wiederholen</span></div>'
      + '<div class="kpi"><b>' + s.serie + (s.serie === 1 ? ' Tag' : ' Tage') + '</b><span>Serie' + (s.heuteAktiv ? ', heute dabei' : s.serie > 0 ? ', heute noch offen' : '') + '</span></div>';
    if (m.karriere && m.karriere.n) h += '<div class="kpi"><b>Rang ' + m.karriere.n + '</b><span>' + esc(m.karriere.t || '') + ' · ' + num(m.karriere.xp || 0) + ' XP</span></div>';
    h += '<div class="kpi"><b>' + m.abzeichen.n + (m.abzeichen.total ? ' von ' + m.abzeichen.total : '') + '</b><span>Abzeichen</span></div>';
    if (m.kampagne && (m.kampagne.done || m.kampagne.total)) h += '<div class="kpi"><b>' + m.kampagne.done + (m.kampagne.total ? ' von ' + m.kampagne.total : '') + '</b><span>Kampagne: Kapitel</span></div>';
    return h;
  }
  function naechster(m) {
    const x = m.naechster; if (!x) return '';
    return '<h2 id="msNextH">Dein nächster sinnvoller Schritt</h2><p><b>' + esc(x.titel) + '</b></p><p>' + esc(x.text) + '</p>'
      + (x.href ? '<a class="btn pri" href="' + esc(x.href) + '">Los</a>' : '')
      + (m.weitere.length ? '<details><summary class="hint" style="min-height:44px;display:flex;align-items:center;cursor:pointer">Weitere Vorschläge (' + m.weitere.length + ')</summary><ul class="nl" style="margin:0 0 6px;padding-left:18px">' + m.weitere.map(y => '<li>' + (y.href ? '<a href="' + esc(y.href) + '">' + esc(y.titel) + '</a>' : esc(y.titel)) + '<span class="hint"> – ' + esc(y.text) + '</span></li>').join('') + '</ul></details>' : '');
  }
  function bereiche(m) {
    const weg = m.weg, z = m.bereicheZaehl, ein = weg ? 'Modul' : (m.bereicheQuelle === 'plan' ? 'Lernfeld' : 'Lab'), mehr = weg ? 'Module' : (m.bereicheQuelle === 'plan' ? 'Lernfelder' : 'Labs');
    let h = '<h2 id="msBH">' + (weg ? 'Meine Module' : m.bereicheQuelle === 'plan' ? 'Meine Lernfelder' : 'Meine Labs') + '</h2>'
      + '<p class="lead" style="margin-bottom:10px">' + z.gruen + ' ' + (z.gruen === 1 ? ein : mehr) + ' sicher, ' + z.gelb + ' in Arbeit, ' + z.grau + ' noch nicht begonnen.</p>';
    if (!m.bereiche.length) return h + '<p class="leer">Für deinen Beruf gibt es noch keine Auswertung nach ' + mehr + '.</p>';
    h += '<ul class="amp">' + m.bereiche.map(b => {
      const labs = b.labs && b.labs.length ? '<details><summary>Labs in diesem ' + ein + ' (' + b.labs.length + ')</summary><ul class="labs">' + b.labs.map(l => '<li><span>' + (l.file ? '<a href="' + esc(l.file) + '">' + esc(l.name) + '</a>' : esc(l.name)) + (l.fremd ? ' (Verweis)' : '') + '</span><span>' + l.done + ' von ' + l.n + '</span></li>').join('') + '</ul></details>' : '';
      return '<li data-ampel="' + b.ampel + '"><div class="ah">' + dot(b.ampel) + '<div class="at"><h3>' + esc(b.titel) + (b.optional ? ' <span class="hint">(optional)</span>' : '') + lbl(b.ampel) + '</h3><p class="g">' + esc(b.grund) + '</p></div></div>'
        + (b.pct != null ? '<div class="bar" role="img" aria-label="' + b.pct + ' Prozent"><i style="width:' + b.pct + '%"></i></div>' : '')
        + labs + (b.href ? '<a class="btn" href="' + esc(b.href) + '" style="margin-top:6px">Öffnen</a>' : '') + '</li>';
    }).join('') + '</ul>';
    return h;
  }
  function pruefung(m) {
    const p = m.pruefung; if (!p.sichtbar) return '';
    const bew = p.themen.filter(t => !t.neu), neu = p.themen.filter(t => t.neu);
    let h = '<h2 id="msPH">Prüfungsthemen</h2><p class="lead" style="margin-bottom:10px">' + (p.proben ? p.proben + (p.proben === 1 ? ' Probeprüfung' : ' Probeprüfungen') + (p.letzte ? ', zuletzt ' + p.letzte.pct + ' % (Note ' + p.letzte.note + ')' : '') + '. ' : 'Noch keine Probeprüfung. ')
      + p.zaehl.gruen + ' Themen sicher, ' + p.zaehl.gelb + ' in Arbeit.</p>';
    if (bew.length) h += '<ul class="amp">' + bew.map(t => '<li data-ampel="' + t.ampel + '"><div class="ah">' + dot(t.ampel) + '<div class="at"><h3>' + esc(t.titel) + lbl(t.ampel) + '</h3><p class="g">' + esc(t.grund) + (t.schwach ? '. Hier lohnt sich Üben.' : '') + '</p></div></div><a class="btn" href="' + esc(t.href) + '">Thema üben</a></li>').join('') + '</ul>';
    else h += '<p class="leer">Noch kein Thema bewertet. Ab 5 beantworteten Fragen je Thema siehst du hier die Ampel.</p>';
    if (neu.length) h += '<details class="wn"><summary>Noch nicht geübte Themen (' + neu.length + ')</summary><ul class="labs">' + neu.map(t => '<li><a href="' + esc(t.href) + '">' + esc(t.titel) + '</a></li>').join('') + '</ul></details>';
    h += '<a class="btn pri" href="pruefungslab.html">Prüfungs-Lab öffnen</a>';
    return h;
  }
  function serie(m) {
    const s = m.serie, heute = s.tage[s.tage.length - 1].datum;
    return '<h2 id="msSH">Lerntage der letzten zwei Wochen</h2><div class="serie" role="list" aria-label="Lerntage">' + s.tage.map(t => '<i role="listitem" class="' + (t.aktiv ? 'an' : '') + (t.datum === heute ? ' heute' : '') + '" aria-label="' + dmy(t.datum) + ' ' + (t.aktiv ? 'gelernt' : 'nichts') + '" title="' + dmy(t.datum) + '">' + (t.aktiv ? '✓' : wdTag(t.datum)) + '</i>').join('') + '</div>'
      + '<p class="hint" style="margin:6px 0 0">' + s.aktiv14 + ' von 14 Tagen aktiv' + (s.serie ? ', Serie ' + s.serie + (s.serie === 1 ? ' Tag' : ' Tage') : '') + '.</p>'
      + '<p class="fn">Je Aufgabe wird nur der letzte Bearbeitungstag gespeichert. Ältere Tage können deshalb fehlen, die Serie ist mindestens so lang wie angezeigt.</p>';
  }
  let model = null;
  function render() {
    let m; try { m = MS.build(MS.fromGlobals(root)); } catch (e) { $('msKopf').innerHTML = '<p class="leer">Die Übersicht konnte nicht berechnet werden.</p>'; return; }
    model = m;
    $('msLead').textContent = (NAMEN[m.beruf] || m.beruf) + ': Eine Übersicht über alles, was du schon gemacht hast. Die Seite liest nur und verändert nichts an deinem Lernstand. Den Beruf wählst du auf der Startseite.';
    $('msKopf').innerHTML = kopf(m);
    const nx = $('msNext'); nx.innerHTML = naechster(m); nx.hidden = !m.naechster;
    $('msBereiche').innerHTML = bereiche(m);
    const pr = $('msPruef'); pr.innerHTML = pruefung(m); pr.hidden = !m.pruefung.sichtbar;
    $('msSerie').innerHTML = serie(m);
    $('msQL').innerHTML = Object.keys(m.quellen).map(k => '<li>' + esc(m.quellen[k]) + '</li>').join('');
    try { if (root.Countdown && root.Countdown.mount) root.Countdown.mount($('countdown'), m); } catch (e) {}
  }
  function start() { ensurePlan(() => { render(); if (location.hash === '#countdown') { const c = $('countdown'); if (c && c.scrollIntoView) c.scrollIntoView(); } }); }
  root.MeinStand = { render, model: () => model };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
  root.addEventListener('pageshow', e => { if (e.persisted) render(); });
  doc.addEventListener('visibilitychange', () => { if (!doc.hidden) render(); });
  root.addEventListener('countdown:geaendert', render);
})(typeof window !== 'undefined' ? window : globalThis);
