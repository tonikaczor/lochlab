/* wiki-labs.js - Tonfunk Wiki, "?"-Knoepfe in SchaltLab, SimLab und MessLab (Paket W5, SPEC-WIKI-FABLE.md Abschnitt 6).
 * Laedt wiki.css/wiki.js im Leerlauf nach, haengt per MutationObserver kleine "?"-Knoepfe (button.wk) an Bauteile, Messgeraete und
 * Bedienelemente und laesst die zentrale Delegation in wiki.js den Drawer oeffnen (kein Seitenwechsel, Lab-Zustand bleibt).
 *
 * VERDECKTE-FEHLER-PRINZIP (Spec 4.1/6.4): Der Knopf traegt NUR die Eintrags-ID (data-wiki) und das Lab-Kuerzel (data-lab).
 * Nie Aufgabe, Fehlerzustand, Messwert, Steuerwert oder Schaltungsinhalt. Die Zuordnung steht in den Tabellen unten (fest verdrahtet,
 * nur Bauteilart, Geraet, Bedienelement). Verdeckte Elemente (.hid, [data-t=hidden], [hidden], [aria-hidden=true]) bekommen kein "?".
 * Nur Eintraege, die im Wiki existieren, bekommen einen Knopf (Wiki.has); sonst bleibt die Stelle ohne "?".
 * Node: module.exports = {GER, BEDIEN, TAG, PIT_SEL, ...} fuer quelle/wiki/test_wiki_labs.js (reine Tabellen, kein DOM). */
(function (root) {
  'use strict';

  /* Werkbank-Geraet (mess.js INST-Schluessel, .wbi[data-id]) -> Wiki-Eintrag */
  var GER = {
    psu: 'ger-netzteil', gen: 'ger-fgen', dmm: 'ger-dmm', osc: 'ger-oszi', cnt: 'ger-fzaehler', pwr: 'ger-leistung',
    trace: 'ger-kennlinie', bode: 'ger-bode', la: 'ger-logik'
  };
  /* Bedienelemente innerhalb eines Geraets: [Geraete, Selektor, Filter (RegExp auf den Text; String = Element muss dieses Kind enthalten; null = keiner), Eintrag, Stelle]
     Stelle: 'after' = direkt hinter dem Element, 'append' = ans Ende des Elements, 'beforeinput' = in einem Label vor dem Eingabefeld */
  var BEDIEN = [
    [['osc', 'la'], '.wbtag', /^Zeit/, 'bd-oszi-tdiv', 'after'],
    [['osc'], '.wbtag', /^Volt/, 'bd-oszi-vdiv', 'after'],
    [['osc'], '.wbtag', /^Lage/, 'bd-oszi-lage', 'after'],
    [['osc'], '[data-chs]', null, 'bd-oszi-kanal', 'append'],
    [['osc'], '[data-ac]', null, 'bd-oszi-kopplung', 'after'],
    [['osc'], '[data-px]', null, 'bd-oszi-tastkopf', 'after'],
    [['osc'], '[data-tr]', null, 'bd-oszi-trigger', 'after'],
    [['osc'], '[data-fr]', null, 'bd-oszi-stop', 'after'],
    [['osc'], '[data-cc]', null, 'bd-oszi-cursor', 'after'],
    [['la'], '.wbtag', /^Schwelle/, 'bd-logik-schwelle', 'after'],
    [['dmm'], '[data-dials]', null, 'bd-dmm-bereich', 'append'],
    [['dmm'], '[data-jacks]', null, 'bd-dmm-buchse', 'append'],
    [['dmm'], '[data-probe]', null, 'bd-dmm-spitzen', 'after'],
    [['dmm'], '[data-fuse]', null, 'bd-dmm-sicherung', 'after'],
    [['psu'], 'label.wbf', '[data-us]', 'bd-netz-spannung', 'beforeinput'],
    [['psu'], 'label.wbf', '[data-is]', 'bd-netz-strombegrenzung', 'beforeinput'],
    [['gen'], '[data-waves]', null, 'bd-fgen-kurvenform', 'append'],
    [['gen'], 'label.wbf', '[data-f]', 'bd-fgen-frequenz', 'beforeinput'],
    [['gen'], 'label.wbf', '[data-a]', 'bd-fgen-amplitude', 'beforeinput'],
    [['pwr'], '[data-rst]', null, 'bd-leistung-energie', 'after']
  ];
  /* Palette (Bauteilliste links) und Kopfzeile der Bauteil-Karte (data-wk = Bauteilschluessel aus schaltplan.js KINDS) */
  var PIT_SEL = '#parts .pit[data-t="place"][data-k]';
  var CARD_SEL = '#side h4[data-wk]';
  /* Messwerkzeuge der Schaltplan-Leiste (nur im Simulationsmodus vorhanden) */
  var CHIPS = { meter: 'ger-dmm', scope: 'ger-oszi' };
  var HIDDEN_SEL = '.hid,[data-t="hidden"],[hidden],[aria-hidden="true"]';
  var KEY = 'lm4.wiki.hints', KEY_OLD = 'lm4.wiki.marks';
  var api = { GER: GER, BEDIEN: BEDIEN, PIT_SEL: PIT_SEL, CARD_SEL: CARD_SEL, CHIPS: CHIPS, HIDDEN_SEL: HIDDEN_SEL, KEY: KEY };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  if (typeof document === 'undefined' || root.WikiLabs) return;

  var doc = document, html = doc.documentElement;
  var LAB = (['sim', 'mess', 'code', 'pi', 'digi', 'haus'].indexOf(root.LAB) >= 0 ? root.LAB : 'sch');
  var ready = false, timer = 0, obs = null;
  html.classList.add('wk-lab');   // wiki.css: Lab-Tokens bleiben, nur Drawer und "?" kommen dazu

  function on() { try { return localStorage.getItem(KEY) !== '0' && localStorage.getItem(KEY_OLD) !== '0'; } catch (e) { return true; } }
  function applyOff() { html.classList.toggle('wk-off', !on()); }
  function set(v) { try { localStorage.setItem(KEY, v ? '1' : '0'); if (v) localStorage.removeItem(KEY_OLD); } catch (e) {} applyOff(); if (v) scan(); return v; }
  function toggle() {
    var v = !on(); set(v);
    var t = (root.LabUI && root.LabUI.toast) || root.toast;
    if (typeof t === 'function') t(v ? 'Wiki-Hilfe: die kleinen ?-Knöpfe sind sichtbar' : 'Wiki-Hilfe: ?-Knöpfe ausgeblendet');
    return v;
  }

  function has(id) { try { return !!(root.Wiki && root.Wiki.has && root.Wiki.has(id)); } catch (e) { return false; } }
  function mk(id, cls) {
    var b = doc.createElement('button');
    b.type = 'button'; b.className = 'wk' + (cls ? ' ' + cls : '');
    b.setAttribute('data-wiki', id); b.setAttribute('data-lab', LAB);
    b.setAttribute('aria-label', 'Im Wiki nachschlagen'); b.title = 'Im Wiki nachschlagen';
    b.textContent = '?';
    return b;
  }
  function hidden(el) { return !!(el.closest && el.closest(HIDDEN_SEL)); }
  function mine(el, id) { var n = el.nextElementSibling; return !!(n && n.classList.contains('wk') && n.getAttribute('data-wiki') === id); }

  // Bauteilschluessel -> Eintrag (nur Bauteile, ueber ALIAS/speak des Wiki wie speak.js)
  function partId(k) { var e = root.Wiki && root.Wiki.bySpeak ? root.Wiki.bySpeak(k) : null; return e && e.kat === 'bauteil' ? e.id : null; }

  function place(anchor, id, how, cls, ref) {
    if (!anchor || !has(id) || hidden(anchor)) return;
    if (how === 'after') { if (!mine(anchor, id)) anchor.insertAdjacentElement('afterend', mk(id, cls)); }
    else if (how === 'append') { var l = anchor.lastElementChild; if (!(l && l.classList.contains('wk') && l.getAttribute('data-wiki') === id)) anchor.appendChild(mk(id, cls)); }
    else if (how === 'beforeinput') {
      var inp = ref ? anchor.querySelector(ref) : null; if (!inp || inp.parentNode !== anchor) return;
      var p = inp.previousElementSibling; if (p && p.classList.contains('wk') && p.getAttribute('data-wiki') === id) return;
      anchor.insertBefore(mk(id, cls), inp);
    }
  }

  function scan() {
    timer = 0;
    if (!ready || !on()) return;
    if (obs) obs.disconnect();
    try {
      var i, els;
      // Bauteil-Palette (Liste links)
      els = doc.querySelectorAll(PIT_SEL);
      for (i = 0; i < els.length; i++) { var pid = partId(els[i].getAttribute('data-k')); if (pid) place(els[i], pid, 'after', 'wk-pit'); }
      // Bauteil-Karte rechts (gewaehlt oder zum Setzen)
      els = doc.querySelectorAll(CARD_SEL);
      for (i = 0; i < els.length; i++) {
        var cid = partId(els[i].getAttribute('data-wk')); if (!cid || hidden(els[i])) continue;
        var l = els[i].lastElementChild; if (!(l && l.classList.contains('wk'))) els[i].appendChild(mk(cid));
      }
      // Messwerkzeuge in der Leiste
      els = doc.querySelectorAll('#pal .chip[data-t]');
      for (i = 0; i < els.length; i++) { var g = CHIPS[els[i].getAttribute('data-t')]; if (g) place(els[i], g, 'after'); }
      // Werkbank (MessLab)
      els = doc.querySelectorAll('.wbi[data-id]');
      for (i = 0; i < els.length; i++) {
        var inst = els[i].getAttribute('data-id'), hd = els[i].querySelector('.wbh'), gid = GER[inst];
        if (hd && gid && has(gid) && !hd.querySelector('.wk')) { var x = hd.querySelector('[data-x]'), b = mk(gid); if (x) hd.insertBefore(b, x); else hd.appendChild(b); }
        BEDIEN.forEach(function (r) {
          if (r[0].indexOf(inst) < 0) return;
          var cand = els[i].querySelectorAll(r[1]);
          for (var j = 0; j < cand.length; j++) { if (r[2] && (typeof r[2] === 'string' ? !cand[j].querySelector(r[2]) : !r[2].test(cand[j].textContent.trim()))) continue; place(cand[j], r[3], r[4], '', typeof r[2] === 'string' ? r[2] : null); }
        });
      }
    } catch (e) { /* ?-Knoepfe sind Beiwerk: nie die Lab-Funktion stoeren */  }
    if (obs) obs.observe(doc.body, { childList: true, subtree: true });
  }
  function later() { if (!timer) timer = setTimeout(scan, 200); }

  function css() {
    if (doc.querySelector('link[href$="wiki.css"]')) return;
    var l = doc.createElement('link'); l.rel = 'stylesheet'; l.href = 'wiki.css'; doc.head.appendChild(l);
  }
  function start() {
    var W = root.Wiki; if (!W || !W.need) return;
    W.need(['bauteile', 'geraete']).then(function () {
      ready = true; applyOff();
      obs = new MutationObserver(function (recs) {
        for (var i = 0; i < recs.length; i++) {
          var a = recs[i].addedNodes;
          for (var j = 0; j < a.length; j++) if (a[j].nodeType === 1 && !(a[j].classList && a[j].classList.contains('wk'))) return later();
          var rm = recs[i].removedNodes;
          for (var k = 0; k < rm.length; k++) if (rm[k].nodeType === 1 && !(rm[k].classList && rm[k].classList.contains('wk'))) return later();
        }
      });
      obs.observe(doc.body, { childList: true, subtree: true });
      scan();
    });
  }
  function boot() {
    css(); applyOff();
    if (root.Wiki && root.Wiki.need) return start();
    var s = doc.querySelector('script[src$="wiki.js"]');
    if (s) { var n = 0, iv = setInterval(function () { if ((root.Wiki && root.Wiki.need) || ++n > 40) { clearInterval(iv); start(); } }, 250); return; }
    s = doc.createElement('script'); s.src = 'wiki.js'; s.async = true; s.onload = start; doc.head.appendChild(s);
  }
  root.WikiLabs = { on: on, set: set, toggle: toggle, scan: scan, lab: function () { return LAB; }, ready: function () { return ready; }, partId: partId };
  var go = function () { setTimeout(boot, 400); };
  if (doc.readyState === 'complete') go(); else root.addEventListener('load', go);
})(typeof window !== 'undefined' ? window : this);
