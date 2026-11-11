'use strict';
/* Tonfunk Lab: Einordnung "Warum brauche ich das?" (Paket P2).
   Zeigt oben in einem Lab eine kleine, schließbare Karte: wo das Thema im Betrieb vorkommt, was in der Prüfung typisch ist, in welchen Lernfeldern
   deines Berufs es steht und in welchen Projekten das Lab Station ist. Läuft im Browser (window.Einordnung) und in Node (module.exports).

   Daten: Die Dateien einordnung-elektro.js, einordnung-mech.js und einordnung-lager-it-kauf.js melden je Lab an:
     Einordnung.register({ lab: '<Schlüssel wie in LAB_REG>', betrieb: '1-2 Sätze', pruefung: '1 Satz (optional)', lernfelder: ['<Lernfeld-id>', ...] (optional) });
   `lernfelder` (optional) nennt Lernfeld-IDs des Ausbildungsplans, die statt der abgeleiteten gezeigt werden. Ohne Angabe werden die Lernfelder des
   gewählten Berufs aus dem Ausbildungsplan (AusbildungsPlan.plan(beruf).lernfelder[].labs) abgeleitet. Das Modul liest nur, es ändert keinen Lernstand.

   Einhängen: design.js lädt dieses Skript auf Lab-Seiten nach (einordnung:begin/end); die Seiten selbst bleiben unverändert. Das Modul lädt seine Datendateien
   und, falls nötig, den Ausbildungsplan selbst nach (alles optional: fehlt eine Datei, bleibt die Karte kleiner oder ganz weg).
   Erkennung des Labs: über window.LAB_REG[k].file === Dateiname (nicht über eine Namens-Regel; Hubs wie verbund.html, Seiten mit ?verbund= und
   gesperrte Labs ohne Beruf zeigen nichts). Im Passwort-Tor (#gate) erscheint nichts, die Karte kommt erst nach dem Öffnen.
   Speicher: lm4.wz.zu = { "<Lab>": 1 } (geschlossene Karten, je Lab). Zurücksetzen: den Schlüssel löschen. */
(function (root) {
  var KEY = 'lm4.wz.zu', ID = 'wzHint', CSSID = 'wzCss';
  var LABRE = /^[a-z0-9]{1,10}$/;
  var DATEIEN = ['einordnung-elektro.js', 'einordnung-mech.js', 'einordnung-lager-it-kauf.js'];
  var MAX_LF = 4;
  var DATA = {};

  /* ---------------------------------------------------------------- Register */
  function register(e) {
    if (!e || typeof e !== 'object' || !LABRE.test(String(e.lab || ''))) return false;
    var betrieb = typeof e.betrieb === 'string' ? e.betrieb.trim() : '';
    if (!betrieb) return false;
    var o = { lab: e.lab, betrieb: betrieb, pruefung: typeof e.pruefung === 'string' ? e.pruefung.trim() : '' };
    if (Array.isArray(e.lernfelder)) o.lernfelder = e.lernfelder.filter(function (x) { return typeof x === 'string' && x; });
    DATA[e.lab] = o;
    return true;
  }
  function get(lab) { return Object.prototype.hasOwnProperty.call(DATA, lab) ? DATA[lab] : null; }
  function labs() { return Object.keys(DATA); }

  /* ---------------------------------------------------------------- Lab-Erkennung (reine Funktion) */
  function dateiName(pfad) { return String(pfad || '').split('?')[0].split('#')[0].split('/').pop() || ''; }
  function labVonDatei(reg, file) {
    if (!reg || !file) return null;
    var ks = Object.keys(reg);
    for (var i = 0; i < ks.length; i++) {
      var r = reg[ks[i]];
      if (r && r.file === file && !r.hub && Array.isArray(r.beruf) && r.beruf.length) return ks[i];
    }
    return null;
  }

  /* ---------------------------------------------------------------- Lernfelder und Projekte */
  function lernfelder(lab, beruf, AP, eintrag) {
    var p = null; try { p = AP && typeof AP.plan === 'function' ? AP.plan(beruf) : null; } catch (e) { p = null; }
    var lf = p && Array.isArray(p.lernfelder) ? p.lernfelder : [], out = [];
    function mk(x) { return { id: x.id, nr: x.nr || '', titel: x.titel || x.id }; }
    if (eintrag && eintrag.lernfelder && eintrag.lernfelder.length) {
      eintrag.lernfelder.forEach(function (id) { lf.forEach(function (x) { if (x.id === id) out.push(mk(x)); }); });
      return out;
    }
    lf.forEach(function (x) {
      var hit = !x.optional && (x.labs || []).some(function (e) { return e && e.lab === lab && !e.fremd; });   // optionale Lernfelder (z. B. Aufbau zum Elektroniker) nicht anzeigen
      if (hit) out.push(mk(x));
    });
    return out;
  }
  function projekte(lab, beruf, BR) {
    try { return BR && typeof BR.vbLab === 'function' ? (BR.vbLab(lab, beruf) || []) : []; } catch (e) { return []; }
  }
  /* Modell der Karte; null, wenn es nichts Sinnvolles zu zeigen gibt (kein Text zu diesem Lab) */
  function modell(lab, ctx) {
    var e = get(lab); if (!e) return null;
    var beruf = ctx.beruf || 'egs';
    var lf = lernfelder(lab, beruf, ctx.AP, e), pj = projekte(lab, beruf, ctx.BR);
    return { lab: lab, beruf: beruf, betrieb: e.betrieb, pruefung: e.pruefung || '', lf: lf, projekte: pj };
  }
  function lfName(x) { return x.nr ? 'LF ' + x.nr : x.titel; }
  function lfTitel(x) { return String(x.titel || '').replace(/^LF\s*[\w.]+\s*:\s*/, ''); }
  var q = function (s) { return '„' + s + '“'; };

  /* ---------------------------------------------------------------- Darstellung */
  function css(doc) {
    if (doc.getElementById(CSSID)) return;
    var st = doc.createElement('style'); st.id = CSSID;
    st.textContent = '#wzHint{margin:8px 0;padding:8px 6px 8px 12px;border:1px solid var(--line,#444);border-radius:10px;background:var(--panel,transparent);color:var(--fg,inherit);font-size:13.5px;line-height:1.45;box-sizing:border-box;max-width:100%;overflow-wrap:anywhere}'
      + '#wzHint .wzTop{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}#wzHint .wzTt{font-weight:700;margin:4px 0 2px}'
      + '#wzHint .wzX{flex:none;min-width:44px;min-height:44px;margin:-8px -2px 0 0;border:0;background:transparent;color:var(--mute,#9aa6b2);font:inherit;font-size:22px;line-height:1;cursor:pointer;border-radius:10px}'
      + '#wzHint .wzX:hover{color:var(--fg,inherit)}#wzHint .wzX:focus-visible,#wzHint a:focus-visible{outline:3px solid var(--focus,#ffd166);outline-offset:2px}'
      + '#wzHint p{margin:4px 6px 4px 0}#wzHint .wzK{display:block;font-size:12px;font-weight:700;color:var(--mute,#9aa6b2);text-transform:none;letter-spacing:.02em}'
      + '#wzHint a{color:var(--accent,#5fb0ff);font-weight:600;display:inline-block;min-height:24px}#wzHint .wzGo{margin:2px 0 4px}#wzHint .wzL{display:block;padding:2px 0}'
      + '@media print{#wzHint{display:none!important}}';
    (doc.head || doc.body).appendChild(st);
  }
  function el(doc, tag, cls, text) { var e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function zeile(doc, kopf) { var p = el(doc, 'p'); p.appendChild(el(doc, 'span', 'wzK', kopf)); return p; }

  function baue(doc, m, onClose) {
    var box = el(doc, 'section'); box.id = ID; box.setAttribute('role', 'note'); box.setAttribute('aria-label', 'Warum brauche ich das?');
    var top = el(doc, 'div', 'wzTop');
    top.appendChild(el(doc, 'div', 'wzTt', 'Warum brauche ich das?'));
    var x = el(doc, 'button', 'wzX', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Hinweis schließen, für dieses Lab merken');
    x.addEventListener('click', onClose);
    top.appendChild(x); box.appendChild(top);

    var p = zeile(doc, 'Im Betrieb'); p.appendChild(doc.createTextNode(m.betrieb)); box.appendChild(p);
    if (m.pruefung) { p = zeile(doc, 'Typisch in der Prüfung'); p.appendChild(doc.createTextNode(m.pruefung)); box.appendChild(p); }
    if (m.lf.length) {
      p = zeile(doc, m.lf.length === 1 ? 'Lernfeld in deinem Beruf' : 'Lernfelder in deinem Beruf');
      m.lf.slice(0, MAX_LF).forEach(function (x2) {
        var a = el(doc, 'a', 'wzL', lfName(x2) + (x2.nr && lfTitel(x2) ? ' ' + lfTitel(x2) : ''));
        a.href = 'ausbildungsplan.html#lf=' + encodeURIComponent(x2.id); p.appendChild(a);
      });
      if (m.lf.length > MAX_LF) p.appendChild(el(doc, 'span', 'wzL', 'und ' + (m.lf.length - MAX_LF) + ' weitere'));
      box.appendChild(p);
    }
    if (m.projekte.length) {
      p = zeile(doc, 'Im Projekt');
      var pj = m.projekte.slice(0, 3);
      pj.forEach(function (x3, i) {
        if (i) p.appendChild(doc.createTextNode(i === pj.length - 1 ? ' und ' : ', '));
        var a = el(doc, 'a', null, q(x3.name)); a.href = 'verbund.html?projekt=' + encodeURIComponent(x3.id); p.appendChild(a);
      });
      p.appendChild(doc.createTextNode(' (dieses Lab ist dort Station)' + (m.projekte.length > 3 ? ', dazu ' + (m.projekte.length - 3) + ' weitere' : '')));
      box.appendChild(p);
    }
    var go = el(doc, 'p', 'wzGo'); var l = el(doc, 'a', null, 'Im Ausbildungsplan ansehen');
    l.href = 'ausbildungsplan.html' + (m.lf.length ? '#lf=' + encodeURIComponent(m.lf[0].id) : ''); go.appendChild(l); box.appendChild(go);
    return box;
  }

  /* ---------------------------------------------------------------- Speicher */
  function geschlossen(W, lab) {
    try { var o = JSON.parse(W.localStorage.getItem(KEY) || 'null'); return !!(o && typeof o === 'object' && !Array.isArray(o) && o[lab]); } catch (e) { return false; }
  }
  function merke(W, lab) {
    try {
      var o = null; try { o = JSON.parse(W.localStorage.getItem(KEY) || 'null'); } catch (e) { o = null; }
      if (!o || typeof o !== 'object' || Array.isArray(o)) o = {};
      o[lab] = 1; W.localStorage.setItem(KEY, JSON.stringify(o));
    } catch (e) {}
  }

  /* ---------------------------------------------------------------- Einhängen (W = window oder Stub: document, location, localStorage, LAB_REG, BerufReg, AusbildungsPlan) */
  function zeige(W) {
    try {
      var doc = W.document, REG = W.LAB_REG; if (!doc || !REG) return null;
      var loc = W.location || {}, file = dateiName(loc.pathname);
      if (/[?&]verbund=/.test(String(loc.search || ''))) return null;
      var lab = labVonDatei(REG, file); if (!lab) return null;
      if (doc.getElementById(ID) || doc.getElementById('gate')) return null;
      if (geschlossen(W, lab)) return null;
      var BR = W.BerufReg, beruf = 'egs'; try { if (BR && BR.cur) beruf = BR.cur() || 'egs'; } catch (e) {}
      var m = modell(lab, { beruf: beruf, AP: W.AusbildungsPlan, BR: BR }); if (!m) return null;
      var hdr = doc.querySelector('header'); if (!hdr || !hdr.parentNode) return null;
      css(doc);
      var box = baue(doc, m, function () { merke(W, lab); if (box.parentNode) box.parentNode.removeChild(box); });
      var after = doc.getElementById('vbHint'); if (!after || after.parentNode !== hdr.parentNode) after = hdr;
      hdr.parentNode.insertBefore(box, after.nextSibling);
      return box;
    } catch (e) { return null; }
  }

  /* Skripte nachladen (alles optional); cb, wenn alle fertig oder fehlgeschlagen sind */
  function lade(W, cb) {
    var doc = W.document, need = [], AP = W.AusbildungsPlan, beruf = 'egs';
    try { if (W.BerufReg && W.BerufReg.cur) beruf = W.BerufReg.cur() || 'egs'; } catch (e) {}
    DATEIEN.forEach(function (f) { need.push(f); });
    var haveAP = false; try { haveAP = !!(AP && AP.plan && AP.plan(beruf)); } catch (e) {}
    if (!haveAP && /^[a-z]{2,4}$/.test(beruf)) { if (!AP) need.push('ausbildungsplan-core.js'); need.push('ausbildungsplan-' + beruf + '.js'); }
    var n = need.length, fertig = false;
    function done() { if (fertig) return; if (--n <= 0) { fertig = true; cb(); } }
    need.forEach(function (f) {
      try { var s = doc.createElement('script'); s.src = f; s.async = true; s.onload = done; s.onerror = done; doc.head.appendChild(s); } catch (e) { done(); }
    });
    setTimeout(function () { if (!fertig) { fertig = true; cb(); } }, 4000);
  }
  function start(W) {
    try {
      var doc = W.document; if (!doc || !W.LAB_REG) return;
      var file = dateiName((W.location || {}).pathname); if (!labVonDatei(W.LAB_REG, file)) return;   // nur Lab-Seiten laden überhaupt nach
      var go = function () {
        // im Passwort-Tor nichts zeigen: erst wenn das Tor weg ist
        if (doc.getElementById('gate')) {
          if (typeof W.MutationObserver === 'function' && doc.body) {
            var mo = new W.MutationObserver(function () { if (!doc.getElementById('gate')) { mo.disconnect(); lade(W, function () { zeige(W); }); } });
            mo.observe(doc.body, { childList: true });
          }
          return;
        }
        lade(W, function () { zeige(W); });
      };
      if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', go); else go();
    } catch (e) {}
  }

  var API = { KEY: KEY, MAX_LF: MAX_LF, DATEIEN: DATEIEN, register: register, get: get, labs: labs, labVonDatei: labVonDatei, dateiName: dateiName,
    lernfelder: lernfelder, projekte: projekte, modell: modell, baue: baue, zeige: zeige, start: start, _reset: function () { DATA = {}; } };
  var vorhanden = root.Einordnung;
  if (vorhanden && vorhanden !== API && typeof vorhanden.register === 'function' && typeof vorhanden.labs === 'function') {
    // Datendateien, die vor diesem Modul geladen wurden
    vorhanden.labs().forEach(function (k) { register(vorhanden.get(k)); });
  }
  root.Einordnung = API;
  /* Warteschlange: alle drei Datendateien legen Einträge in window.__einQueue ab, wenn dieses Modul noch nicht geladen ist (__wzQueue: alter Name, wird weiter gelesen) */
  ['__einQueue', '__wzQueue'].forEach(function (n) { var q2 = root[n]; if (Array.isArray(q2)) { root[n] = []; q2.forEach(register); } });
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof document !== 'undefined' && root.document === document && root.LAB_REG) start(root);
})(typeof window !== 'undefined' ? window : globalThis);
