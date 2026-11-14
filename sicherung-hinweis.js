'use strict';
/* Tonfunk Lab: Sicherungs-Hinweis auf der Startseite.
   1. Beim Start einmal pro Sitzung navigator.storage.persist() anfragen (der Browser darf den Lernstand dann nicht von selbst aufräumen).
   2. „Zuletzt gesichert: vor X Tagen“ im Fuß (neben „Lernstand sichern oder laden“).
   3. Ab 7 Tagen ohne Sicherung eine freundliche Erinnerung mit Knopf zur Sicherung; „Später“ blendet sie für 7 Tage aus.
   Den Zeitstempel schreibt lernstand.js (Schlüssel lernstand.sicherung, ms) beim Kopieren des Codes, beim Speichern der Datei und beim QR.
   Eigene Schlüssel: lernstand.erst (erster Start mit diesem Skript, Bezug für „noch nie gesichert“), lernstand.hinweis.bis (ausgeblendet bis, ms).
   Die Schlüssel gehören nicht zum Lernstand und werden nicht mitgesichert. Die Rechenlogik ist rein und im Test ohne Browser prüfbar. */
(function (root) {
  const TAG = 86400000, SCHWELLE = 7, PAUSE = 7;
  const K_SICH = 'lernstand.sicherung', K_ERST = 'lernstand.erst', K_BIS = 'lernstand.hinweis.bis', K_SESS = 'lernstand.persist.versucht';
  const PROGRESS = ['sim.done', 'lm4.stats', 'lm4.badges', 'lm4.seen', 'lm4.tdone'];

  const tage = (jetzt, t) => Math.max(0, Math.floor((jetzt - t) / TAG));
  const num = v => { const n = Number(v); return isFinite(n) && n > 0 ? n : 0; };
  /* in: jetzt (ms), sich (ms oder 0), erst (ms oder 0), bis (ms oder 0), fortschritt (bool) */
  function info(o) {
    const jetzt = o.jetzt, sich = num(o.sich), erst = num(o.erst), bis = num(o.bis);
    const bezug = sich || erst || jetzt, d = tage(jetzt, bezug);
    const label = sich ? (d === 0 ? 'Zuletzt gesichert: heute' : d === 1 ? 'Zuletzt gesichert: gestern' : 'Zuletzt gesichert: vor ' + d + ' Tagen') : 'Zuletzt gesichert: noch nie';
    const faellig = !!o.fortschritt && d >= SCHWELLE && !(bis && jetzt < bis);
    const text = sich ? 'Dein Lernstand wurde seit ' + d + ' Tagen nicht gesichert.' : 'Dein Lernstand wurde noch nicht gesichert (seit ' + d + ' Tagen mit diesem Hinweis).';
    return { tage: d, label, faellig, text, nie: !sich };
  }
  const bisNach = jetzt => jetzt + PAUSE * TAG;

  const api = { info, bisNach, SCHWELLE, PAUSE, TAG, KEYS: { sich: K_SICH, erst: K_ERST, bis: K_BIS } };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.SicherungHinweis = api;

  const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  /* 1. Speicher als dauerhaft anfragen, einmal pro Sitzung, nie ein Fehler nach außen */
  function persist() {
    try {
      if (sessionStorage.getItem(K_SESS)) return; sessionStorage.setItem(K_SESS, '1');
    } catch (e) { /* ohne sessionStorage trotzdem einmal versuchen */ }
    try {
      const s = navigator.storage; if (!s || !s.persist) return;
      const p = s.persisted ? s.persisted() : Promise.resolve(false);
      Promise.resolve(p).then(ok => ok ? true : s.persist()).catch(() => {});
    } catch (e) {}
  }
  const hatFortschritt = () => PROGRESS.some(k => ls.get(k) != null);
  const lage = () => info({ jetzt: Date.now(), sich: ls.get(K_SICH), erst: ls.get(K_ERST), bis: ls.get(K_BIS), fortschritt: hatFortschritt() });

  const CSS = '#sichHint{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin:10px 0;padding:12px 14px;border:1px solid var(--accent,#5fb0ff);border-radius:14px;background:var(--panel,#222830);color:var(--fg,#e8ecf0);font-size:14px;line-height:1.4}'
    + '#sichHint .sh-t{flex:1 1 220px;min-width:0}#sichHint button{min-height:44px;padding:0 16px;border-radius:12px;border:1px solid var(--line,#38424d);background:var(--panel2,#2c343e);color:var(--fg,#e8ecf0);font:inherit;font-weight:600;cursor:pointer;touch-action:manipulation}'
    + '#sichHint button.pri{background:var(--accent-bg,#1a6fd4);border-color:var(--accent-bg,#1a6fd4);color:var(--accent-ink,#fff)}#sichHint button:focus-visible{outline:3px solid var(--focus,#ffd166);outline-offset:2px}'
    + '.sichZ{color:var(--mute,#9aa6b2);font-size:14px}';
  function zeigen() {
    const L = lage(), z = document.getElementById('sichZuletzt'), alt = document.getElementById('sichHint');
    if (z) z.textContent = L.label;
    if (!L.faellig) { if (alt) alt.remove(); return; }
    if (alt) { alt.querySelector('.sh-t').textContent = L.text; return; }
    const h = document.getElementById('top') || document.querySelector('header'); if (!h || !h.parentNode) return;
    const b = document.createElement('div'); b.id = 'sichHint'; b.setAttribute('role', 'status');
    b.innerHTML = '<span class="sh-t"></span><button type="button" class="pri" data-a="ja">Jetzt sichern</button><button type="button" data-a="spaeter">Später erinnern</button>';
    b.querySelector('.sh-t').textContent = L.text + ' Sichere ihn, damit nichts verloren geht, wenn du das Gerät wechselst oder der Browser aufräumt.';
    b.querySelector('[data-a=ja]').onclick = () => { const x = document.getElementById('lsOpen'); if (x) x.click(); else if (root.Lernstand) root.Lernstand.open(); };
    b.querySelector('[data-a=spaeter]').onclick = () => { ls.set(K_BIS, String(bisNach(Date.now()))); b.remove(); };
    h.parentNode.insertBefore(b, h);
  }
  function start() {
    if (!ls.get(K_ERST)) ls.set(K_ERST, String(Date.now()));
    persist();
    if (!document.getElementById('sichCss')) { const st = document.createElement('style'); st.id = 'sichCss'; st.textContent = CSS; document.head.appendChild(st); }
    const lb = document.getElementById('lsOpen');
    if (lb && !document.getElementById('sichZuletzt')) { const sp = document.createElement('span'); sp.id = 'sichZuletzt'; sp.className = 'sichZ'; sp.setAttribute('aria-live', 'polite'); lb.insertAdjacentElement('afterend', sp); }
    zeigen();
  }
  root.addEventListener('lernstand-gesichert', zeigen);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})(typeof window !== 'undefined' ? window : globalThis);
