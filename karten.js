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
    /* Reihenfolge der Sitzung: zuerst fällige Karten in niedrigen Fächern, neue Karten zuletzt gemischt; höchstens n */
    sitzung(karten, stand, art, n, now, rnd) {
      rnd = rnd || Math.random;
      const ok = karten.filter(k => (!art || art === 'alle' || k[1] === art) && core.faellig(stand[k[0]], now));
      const alt = ok.filter(k => stand[k[0]]).sort((a, b) => core.fach(stand[a[0]]) - core.fach(stand[b[0]]) || stand[a[0]][1] - stand[b[0]][1]);
      const neu = ok.filter(k => !stand[k[0]]).map(k => [rnd(), k]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
      return alt.concat(neu).slice(0, n);
    },
    zaehl(karten, stand, art, now) {
      const ks = karten.filter(k => !art || art === 'alle' || k[1] === art), f = [0, 0, 0, 0, 0, 0];
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
  const ARTEN = { alle: 'Alle Karten', b: 'Begriffe', f: 'Formeln', t: 'Bauteile' };
  let stand = load(), art = 'alle', q = [], pos = 0, offen = false, richtig = 0, falsch = 0;
  const K = () => root.KARTEN || [];
  function kopf() {
    const z = core.zaehl(K(), stand, art, Date.now());
    return '<div class="kpis"><div class="kpi"><b>' + z.gesamt + '</b><span>Karten</span></div><div class="kpi"><b>' + z.faellig + '</b><span>jetzt fällig</span></div><div class="kpi"><b>' + z.neu + '</b><span>neu</span></div><div class="kpi"><b>' + z.gelernt + '</b><span>im letzten Fach</span></div></div>' +
      '<p class="boxen" aria-label="Verteilung auf die fünf Fächer">' + z.faecher.map((n, i) => '<span title="Fach ' + (i + 1) + '">F' + (i + 1) + ': <b>' + n + '</b></span>').join(' · ') + '</p>';
  }
  function start() {
    const a0 = $('#art'); art = a0 ? a0.value : art;
    q = core.sitzung(K(), stand, art, 20, Date.now()); pos = 0; offen = false; richtig = 0; falsch = 0; zeige();
  }
  function zeige() {
    const out = $('#out'); if (!out) return;
    if (!q.length || pos >= q.length) {
      const done = q.length > 0;
      out.innerHTML = kopf() + (done ? '<div class="card fin"><h2>Sitzung fertig</h2><p>' + richtig + ' gewusst, ' + falsch + ' nochmal üben. Nicht gewusste Karten kommen sofort wieder, gewusste später.</p></div>' : '<div class="card fin"><h2>Nichts fällig</h2><p>In dieser Auswahl ist gerade keine Karte fällig. Komm später wieder oder wähle eine andere Kartenart.</p></div>') + '<button type="button" class="btn" id="neu">' + (done ? 'Neue Sitzung' : 'Neu prüfen') + '</button>';
      $('#neu').onclick = start; return;
    }
    const k = q[pos], bild = k[1] === 'f' ? 'Formel' : k[1] === 't' ? 'Bauteil' : 'Begriff';
    out.innerHTML = kopf() + '<div class="card"><p class="mute">Karte ' + (pos + 1) + ' von ' + q.length + ' · ' + bild + ' · Fach ' + core.fach(stand[k[0]]) + '</p><h2 class="fr">' + esc(k[2]) + '</h2>' +
      (offen ? '<div class="an">' + esc(k[3]).replace(/\n/g, '<br>') + '</div><p class="btns"><button type="button" class="btn ja" id="ja">Gewusst</button><button type="button" class="btn nein" id="nein">Nicht gewusst</button></p>' : '<p class="mute">Überlege zuerst, was du dazu weißt (bei Formeln: wie lautet sie?). Dann deck die Antwort auf.</p><p class="btns"><button type="button" class="btn" id="auf">Antwort zeigen</button></p>') + '</div>';
    if (offen) { $('#ja').onclick = () => ant(true); $('#nein').onclick = () => ant(false); $('#ja').focus(); } else { $('#auf').onclick = () => { offen = true; zeige(); }; $('#auf').focus(); }
  }
  function ant(ok) {
    const k = q[pos]; stand[k[0]] = core.antwort(stand[k[0]], ok, Date.now()); save(stand);
    if (ok) richtig++; else falsch++;
    pos++; offen = false; zeige();
  }
  function init() {
    const sel = $('#art'); if (sel) { sel.innerHTML = Object.keys(ARTEN).map(k => '<option value="' + k + '">' + ARTEN[k] + '</option>').join(''); sel.onchange = start; }
    const rs = $('#reset'); if (rs) rs.onclick = () => { if (confirm('Den Lernstand aller Karten löschen?')) { stand = {}; save(stand); start(); } };
    document.addEventListener('keydown', e => {
      if (e.target && /select|input|textarea/i.test(e.target.tagName)) return;
      if (e.key === ' ' && !offen && q[pos]) { e.preventDefault(); offen = true; zeige(); }
      else if (offen && e.key === 'ArrowRight') ant(true); else if (offen && e.key === 'ArrowLeft') ant(false);
    });
    start();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : globalThis);
