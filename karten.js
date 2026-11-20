'use strict';
/* Tonfunk Lab: Lernkarten (v42.159). Karteikasten nach Leitner: 5 Fächer, Wiederholung nach 0, 1, 3, 7 und 14 Tagen.
   Karten stammen aus dem Wiki (karten-daten.js). Stand je Karte in localStorage 'lm4.karten' = { id: [fach 1..5, fällig ms] }.
   Kern ohne DOM (core), damit er in Node testbar ist. */
(function (root) {
  const KEY = 'lm4.karten', TAG = 86400000, ABST = [0, 1, 3, 7, 14];
  const core = {
    ABST,
    fach: st => (st && st[0] >= 1 && st[0] <= 5) ? st[0] : 1,
    /* Antwort verbuchen: gewusst = ein Fach höher, nicht gewusst = zurück in Fach 1 (sofort wieder fällig) */
    antwort(st, gewusst, now) {
      const f = core.fach(st), n = gewusst ? Math.min(5, f + 1) : 1;
      return [n, now + (gewusst ? ABST[n - 1] * TAG : 0)];
    },
    faellig(st, now) { return !st || st[1] <= now; },
    /* Kartenfilter: 'alle' = alles, 'p' = Karten aus falsch beantworteten Prüfungsfragen (pkarten.js), 'pt1' / 'pt2' = davon aus Teil 1 / Teil 2, sonst die Kartenart (b, f, t) */
    passt(k, art) { return !art || art === 'alle' || (art === 'p' ? k[1] === 'p' : art === 'pt1' || art === 'pt2' ? k[1] === 'p' && k[4] === art.slice(1) : k[1] === art); },
    /* Reihenfolge der Sitzung: zuerst fällige Karten in niedrigen Fächern, neue Karten zuletzt gemischt; höchstens n */
    sitzung(karten, stand, art, n, now, rnd) {
      rnd = rnd || Math.random;
      const ok = karten.filter(k => core.passt(k, art) && core.faellig(stand[k[0]], now));
      const alt = ok.filter(k => stand[k[0]]).sort((a, b) => core.fach(stand[a[0]]) - core.fach(stand[b[0]]) || stand[a[0]][1] - stand[b[0]][1]);
      const neu = ok.filter(k => !stand[k[0]]).map(k => [rnd(), k]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
      return alt.concat(neu).slice(0, n);
    },
    zaehl(karten, stand, art, now) {
      const ks = karten.filter(k => core.passt(k, art)), f = [0, 0, 0, 0, 0, 0];
      let neu = 0, due = 0;
      ks.forEach(k => { const st = stand[k[0]]; if (!st) neu++; else { f[core.fach(st)]++; if (core.faellig(st, now)) due++; } });
      return { gesamt: ks.length, neu, faellig: due, faecher: f.slice(1), gelernt: f[5] };
    }
  };
  root.Karten = core;
  if (typeof module !== 'undefined' && module.exports) module.exports = core;
  if (typeof document === 'undefined') return;

  /* ---------- Oberfläche ---------- */
  const $ = s => document.querySelector(s), esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const load = () => { try { const o = JSON.parse(localStorage.getItem(KEY) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } };
  const save = o => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* ohne Speicher läuft die Sitzung trotzdem */ } };
  const ARTEN = { alle: 'Alle Karten', b: 'Begriffe', f: 'Formeln', t: 'Bauteile', p: 'Aus Prüfung', pt1: 'Aus Prüfung: Teil 1', pt2: 'Aus Prüfung: Teil 2' };
  /* Karten aus Prüfungsfehlern (pkarten.js, lm4.pkarten) tragen ihr Fach in der Karte selbst; hier werden sie mit den Wiki-Karten zu einer Liste und einem Stand zusammengesetzt */
  const PK = root.PKarten;
  /* W187-KARTEN-IM: Karten für Industriemechaniker (karten-im.js, window.KARTEN_IM, fünftes Feld = Lab). Der Stapel gilt nur beim Beruf im (?beruf=im oder lm4.beruf).
     Bei jedem anderen Beruf bleibt alles wie bisher: nur window.KARTEN, kein Auswahlfeld „Stapel“. Der Lernstand liegt wie bei allen Karten in lm4.karten (Ids im-<lab>-NN). */
  const KIM = root.KARTEN_IM || [], IMLAB = {fer: 'Fertigungs-Lab', tol: 'Toleranz-Lab', zer: 'Zerspan-Lab', wer: 'Werkstoff-Lab', fug: 'Füge-Lab', mas: 'Maschinenelemente-Lab', mch: 'Mechanik-Lab', mak: 'Maschinen-Lab', cnc: 'CNC-Lab', pne: 'Pneumatik-Lab', hyd: 'Hydraulik-Lab', ins: 'Instandhaltungs-Lab', zei: 'Zeichnungs-Lab', kon: 'Konstruktions-Lab'};
  const beruf = (() => { try { const m = /[?&]beruf=([a-z0-9]+)/.exec(String(root.location && root.location.search || '')); return m ? m[1] : (localStorage.getItem('lm4.beruf') || 'egs'); } catch (e) { return 'egs'; } })();
  const mitIM = beruf === 'im' && KIM.length > 0;
  let deck = mitIM ? 'im' : 'e';   // im = alle IM-Karten, <lab> = ein Lab, e = bisherige Karten, alle = beides
  const basis = () => deck === 'e' ? (root.KARTEN || []) : deck === 'alle' ? KIM.concat(root.KARTEN || []) : deck === 'im' ? KIM : KIM.filter(k => k[4] === deck);
  let pk = PK ? PK.laden() : {}, stand = load(), art = 'alle', q = [], pos = 0, offen = false, richtig = 0, falsch = 0;
  const K = () => basis().concat(PK ? PK.toKarten(pk) : []);
  const istP = k => k[1] === 'p';
  const sicht = () => { const s = Object.assign({}, stand); Object.keys(pk).forEach(id => { s[id] = PK.stateOf(pk[id]); }); return s; };
  function kopf() {
    const z = core.zaehl(K(), sicht(), art, Date.now()), summe = Math.max(1, z.faecher.reduce((a, b) => a + b, 0)), np = K().filter(istP).length, PAUSE = ['sofort wieder', 'nach 1 Tag', 'nach 3 Tagen', 'nach 7 Tagen', 'nach 14 Tagen'];
    return '<div class="kpis"><div class="kpi"><b>' + z.gesamt + '</b><span>Karten</span></div><div class="kpi"><b>' + z.faellig + '</b><span>jetzt fällig</span></div><div class="kpi"><b>' + z.neu + '</b><span>neu</span></div><div class="kpi"><b>' + z.gelernt + '</b><span>im letzten Fach</span></div></div>' +
      '<div class="fb" role="group" aria-label="Verteilung auf die fünf Fächer">' + z.faecher.map((n, i) => '<div class="z"><span>Fach ' + (i + 1) + ' <span class="mute">(' + PAUSE[i] + ')</span></span><span class="bar"><i style="width:' + Math.round(100 * n / summe) + '%"></i></span><span class="n">' + n + '</span></div>').join('') + '</div>' +
      (np > 0 && !/^p/.test(art) ? '<p class="hint">Du hast ' + np + (np === 1 ? ' Karte' : ' Karten') + ' aus falsch beantworteten Prüfungsfragen. <button type="button" class="btn" id="zuP">Nur diese Karten üben</button></p>' : (np === 0 && !/^p/.test(art) ? '<p class="mute">Falsche Antworten im Prüfungs-Lab legen hier automatisch Karten an (Auswahl „Aus Prüfung“).</p>' : ''));
  }
  function start() {
    const a0 = $('#art'); art = a0 ? a0.value : art;
    const d0 = $('#deck'); if (d0) deck = d0.value;
    if (PK) pk = PK.laden(); stand = load(); q = core.sitzung(K(), sicht(), art, 20, Date.now()); pos = 0; offen = false; richtig = 0; falsch = 0; zeige();
  }
  function zeige() {
    const out = $('#out'); if (!out) return;
    if (!q.length || pos >= q.length) {
      const done = q.length > 0;
      out.innerHTML = kopf() + (done ? '<div class="card fin"><h2>Sitzung fertig</h2><p>' + richtig + ' gewusst, ' + falsch + ' nochmal üben. Nicht gewusste Karten kommen sofort wieder, gewusste später.</p></div>' : '<div class="card fin"><h2>Nichts fällig</h2><p>In dieser Auswahl ist gerade keine Karte fällig. Komm später wieder oder wähle eine andere Kartenart.</p></div>') + '<button type="button" class="btn" id="neu">' + (done ? 'Neue Sitzung' : 'Neu prüfen') + '</button>';
      $('#neu').onclick = start; return;
    }
    const k = q[pos], bild = k[1] === 'f' ? 'Formel' : k[1] === 't' ? 'Bauteil' : istP(k) ? 'Prüfungsfrage' + (k[4] === 't1' ? ' Teil 1' : k[4] === 't2' ? ' Teil 2' : '') : 'Begriff', labn = !istP(k) && IMLAB[k[4]] ? ' · ' + IMLAB[k[4]] : '';
    out.innerHTML = kopf() + '<div class="card"><p class="mute">Karte ' + (pos + 1) + ' von ' + q.length + ' · ' + bild + labn + ' · Fach ' + core.fach(sicht()[k[0]]) + '</p><h2 class="fr">' + esc(k[2]) + '</h2>' +
      (offen ? '<div class="an">' + esc(k[3]).replace(/\n/g, '<br>') + '</div><p class="btns"><button type="button" class="btn ja" id="ja">Gewusst</button><button type="button" class="btn nein" id="nein">Nicht gewusst</button></p>' : '<p class="mute">Überlege zuerst, was du dazu weißt (bei Formeln: wie lautet sie?). Dann deck die Antwort auf.</p><p class="btns"><button type="button" class="btn" id="auf">Antwort zeigen</button></p>') + '</div>';
    if (offen) { $('#ja').onclick = () => ant(true); $('#nein').onclick = () => ant(false); $('#ja').focus(); } else { $('#auf').onclick = () => { offen = true; zeige(); }; $('#auf').focus(); }
  }
  function ant(ok) {
    const k = q[pos]; if (istP(k) && pk[k[0]]) { pk = PK.antwort(pk, k[0], ok, Date.now()); PK.sichern(pk); } else { stand[k[0]] = core.antwort(stand[k[0]], ok, Date.now()); save(stand); }
    if (ok) richtig++; else falsch++;
    pos++; offen = false; zeige();
  }
  function init() {
    const sel = $('#art'); if (sel) { sel.innerHTML = Object.keys(ARTEN).map(k => '<option value="' + k + '">' + ARTEN[k] + '</option>').join(''); sel.onchange = start; }
    document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('#zuP'); if (!b) return; const s = $('#art'); if (s) { s.value = 'p'; start(); } });
    const rs = $('#reset'); if (rs) rs.onclick = () => {   // eigene Rückfrage in der Seite statt confirm()
      if ($('#resetBox')) return; const d = document.createElement('div'); d.id = 'resetBox'; d.className = 'card'; d.setAttribute('role', 'alertdialog'); d.setAttribute('aria-labelledby', 'resetT');
      d.innerHTML = '<b id="resetT">Lernstand aller Karten löschen?</b><p class="mute">Alle Karten kommen zurück in Fach 1. Das lässt sich nicht rückgängig machen.</p><p class="btns"><button type="button" class="btn grau" id="resetNo">Behalten</button><button type="button" class="btn nein" id="resetYes">Ja, löschen</button></p>';
      rs.parentNode.insertAdjacentElement('afterend', d);
      const zu = () => { d.parentNode.removeChild(d); rs.focus(); };
      $('#resetNo').onclick = zu; d.onkeydown = ev => { if (ev.key === 'Escape') zu(); };
      $('#resetYes').onclick = () => { stand = {}; save(stand); if (PK) { Object.keys(pk).forEach(id => { pk[id].f = 1; pk[id].d = Date.now(); }); PK.sichern(pk); } zu(); start(); };
      $('#resetNo').focus();
    };
    document.addEventListener('keydown', e => {
      if (e.target && /select|input|textarea/i.test(e.target.tagName)) return;
      if (e.key === ' ' && !offen && q[pos] && !/^(BUTTON|A|SUMMARY)$/.test(e.target.tagName)) { e.preventDefault(); offen = true; zeige(); }
      else if (offen && e.key === 'ArrowRight') ant(true); else if (offen && e.key === 'ArrowLeft') ant(false);
    });
    if (mitIM && sel) {   // W187-KARTEN-IM: Auswahl des Stapels, nur beim Beruf Industriemechaniker
      const lb = document.createElement('label'), ds = document.createElement('select'), n = l => KIM.filter(k => k[4] === l).length;
      lb.htmlFor = 'deck'; lb.textContent = 'Stapel: '; ds.id = 'deck';
      ds.innerHTML = '<option value="im">Industriemechaniker (' + KIM.length + ')</option>' + Object.keys(IMLAB).filter(n).map(l => '<option value="' + l + '">' + esc(IMLAB[l]) + ' (' + n(l) + ')</option>').join('') + '<option value="e">Elektronik und Grundlagen</option><option value="alle">Alle Karten</option>';
      const p = sel.parentNode, vor = p.querySelector('label[for="art"]') || sel; p.insertBefore(lb, vor); p.insertBefore(ds, vor); p.insertBefore(document.createTextNode(' '), vor);
      ds.onchange = start;
      try { const m = /[?&]deck=([a-z]+)/.exec(String(root.location && root.location.search || '')); if (m && ds.querySelector('option[value="' + m[1] + '"]')) ds.value = m[1]; } catch (e) {}   // karten.html?deck=zer: gleich ein Lab üben
    }
    try { const m = /[?&]art=([a-z0-9]+)/.exec(String(root.location && root.location.search || '')); if (m && sel && ARTEN[m[1]]) sel.value = m[1]; } catch (e) {}   // karten.html?art=p: gleich die Fehlerkarten (aus Prüfung) üben
    start();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : globalThis);
