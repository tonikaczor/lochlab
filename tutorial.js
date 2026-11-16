/* tutorial.js - zentrale Tutorial-Engine aller Lab-Seiten (Tonfunk Lab).
 * Zeigt beim ERSTEN Öffnen eines Labs eine kurze Tour mit höchstens drei Schritten (Daten: labs[<lab>].kurz, siehe unten):
 * Karte am unteren Rand (Handy: volle Breite, höchstens 30 % der Höhe; Desktop: unten rechts, schmal), das erklärte Element
 * bekommt einen Ring mit Schein, wird nicht verdeckt und ins Bild gescrollt. Die Seite bleibt bedienbar (nicht modal).
 * Antippen außerhalb der Karte, Esc oder "Überspringen" beenden die automatische Tour; danach bleibt nichts zurück.
 * Die ganze Tour (alle Schritte, labs[<lab>].steps) startet mit Tutorial.restart() ("Tour zeigen" im Info-Blatt) oder dem "?"-Knopf.
 * Kurze Tour: kurz: [ { v: [ { s: Selektorliste, h, t }, ... ] }, ... ]. Je Schritt gilt die erste Variante mit sichtbarem Ziel,
 * gibt es keine, entfällt der Schritt. Selektoren: Rahmen zuerst (.lr-band, #lrInfo), dann das alte Ziel.
 * Die Schritte stehen in tutorial-data.js (window.TUTORIAL_DATA.labs[<Dateiname ohne .html>]):
 *   { name, kurz: [...], steps: [ { h: Überschrift, t: Text, s: Selektor oder Liste von Selektoren (erster sichtbarer gilt),
 *                      c: Selektor, der vorher angetippt wird (Reiter) } ] }
 * Spezial-Selektor "@page" = die gerade sichtbare Seite in #mid. Fehlt das Ziel (oder ist es versteckt), zeigt die Karte nur den Text.
 * Speicher: lm4.tut.<lab> = '1' (gesehen), lm4.tut.off = '1' (nirgends mehr automatisch). Jeder Zugriff steckt in try/catch.
 * Kein Autostart bei: ?-Parametern (bsp, aufgabe, ex, duell, tag ...), #-Sprung, Prüfmodus, offenem Gate/Login, offenem Dialog.
 * Das Tutorial rechnet nie Punkte, öffnet keine Aufgaben und zeigt keine Lösungen; es tippt höchstens Reiter an
 * und stellt am Ende den vorher aktiven Reiter wieder her.
 * Node: require('./tutorial.js') liefert die reine Logik (skipReason, labKey, examOn, ...) für Tests. ES5, keine Bibliotheken. */
(function (root) {
  'use strict';
  var PFX = 'lm4.tut.', OFFKEY = PFX + 'off';
  var hasDoc = typeof document !== 'undefined' && !!document.createElement;
  var injected = null; /* nur für Tests: Ersatz für localStorage */

  /* ---------- Speicher (alles in try/catch) ---------- */
  function store() { try { return injected || root.localStorage || null; } catch (e) { return null; } }
  function lsGet(k) { try { var s = store(); return s ? s.getItem(k) : null; } catch (e) { return null; } }
  function lsSet(k, v) { try { var s = store(); if (!s) return false; s.setItem(k, v); return true; } catch (e) { return false; } }
  function setStore(s) { injected = s; }

  /* ---------- reine Logik ---------- */
  function labKey(loc) {
    var p = '';
    try { p = String((loc || root.location || {}).pathname || ''); } catch (e) { p = ''; }
    var m = /([^\/]+?)(?:\.html?)?$/.exec(p);
    return m ? m[1].toLowerCase() : '';
  }
  function dataFor(key) {
    var D = root.TUTORIAL_DATA;
    if (!D || !D.labs || !Object.prototype.hasOwnProperty.call(D.labs, key)) return null;
    var L = D.labs[key];
    return L && L.steps && L.steps.length ? L : null;
  }
  function prefixes(key) {
    var out = [], b = key.replace(/lab$/, '');
    if (b) out.push(b);
    try { if (root.LAB && out.indexOf(String(root.LAB)) < 0) out.push(String(root.LAB)); } catch (e) {}
    return out;
  }
  function examOn(doc, key) {
    try {
      if (doc && doc.documentElement && /(^|\s)pr-lauf(\s|$)/.test(doc.documentElement.className || '')) return true;
      var b = doc && doc.getElementById && doc.getElementById('bExam');
      if (b && (b.getAttribute('aria-pressed') === 'true' || /(^|\s)on(\s|$)/.test(b.className || ''))) return true;
    } catch (e) {}
    var ps = prefixes(key);
    for (var i = 0; i < ps.length; i++) {
      var e1 = lsGet('lm4.' + ps[i] + '.exam'), m1 = lsGet('lm4.' + ps[i] + '.mode');
      if (e1 === '1' || e1 === 'true' || m1 === 'pruef' || m1 === 'exam') return true;
      if (m1 && /^"?(pruef|exam)"?$/.test(m1)) return true;
    }
    return false;
  }
  /* c: { hasData, off, seen, search, hash, exam, gate, overlay, trainer, tabOk } -> '' = starten, sonst Grund */
  function skipReason(c) {
    if (!c.hasData) return 'keine-daten';
    if (c.off) return 'aus';
    if (c.seen) return 'gesehen';
    if (c.search) return 'parameter';
    if (c.hash) return 'sprung';
    if (c.exam) return 'pruefmodus';
    if (c.tabOk === false) return 'reiter';
    if (c.gate) return 'gate';
    if (c.overlay) return 'dialog';
    if (c.trainer) return 'trainer';
    return '';
  }
  function isTransient(why) { return why === 'gate' || why === 'dialog' || why === 'trainer'; }

  /* ---------- DOM-Hilfen ---------- */
  function isVisible(el) {
    if (!el || !el.getClientRects) return false;
    try {
      var r = el.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0) || !el.getClientRects().length) return false;
      var cs = root.getComputedStyle ? root.getComputedStyle(el) : null;
      if (cs && (cs.visibility === 'hidden' || cs.display === 'none')) return false;
      return true;
    } catch (e) { return false; }
  }
  function q1(sel) { try { return document.querySelector(sel); } catch (e) { return null; } }
  function pageEl() {
    var mid = document.getElementById('mid');
    if (!mid) return null;
    for (var i = 0; i < mid.children.length; i++) if (isVisible(mid.children[i])) return mid.children[i];
    return null;
  }
  function findTarget(sel) {
    if (!sel) return null;
    var list = Object.prototype.toString.call(sel) === '[object Array]' ? sel : [sel];
    for (var i = 0; i < list.length; i++) {
      var el = list[i] === '@page' ? pageEl() : q1(list[i]);
      if (el && isVisible(el)) return el;
    }
    return null;
  }
  function activeTab() {
    var t = document.getElementById('tabs');
    if (!t) return null;
    return t.querySelector('.on, [aria-selected="true"]');
  }
  /* Reiter merken (Attribut und Wert) und später wiederfinden: die Labs bauen die Reiterleiste beim Wechsel teils neu auf */
  function tabId(el) {
    if (!el) return null;
    var t = el.getAttribute('data-tab'), a = 'data-tab';
    if (t == null) { t = el.getAttribute('data-t'); a = 'data-t'; }
    return t == null ? null : { a: a, v: t };
  }
  function restoreTab(id) {
    if (!id) return;
    try {
      var el = q1('#tabs [' + id.a + '="' + id.v + '"]'), cur = activeTab();
      if (el && el !== cur) el.click();
    } catch (e) {}
  }
  function mk(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function focusables(card) {
    var l = card.querySelectorAll('button, input, [tabindex]'), out = [];
    for (var i = 0; i < l.length; i++) if (!l[i].disabled && l[i].getAttribute('tabindex') !== '-1') out.push(l[i]);
    return out;
  }

  /* ---------- Stil ---------- */
  var CSS = [
    '.tfT{--t-bg:var(--panel,#fff);--t-fg:var(--fg,#141a21);--t-mute:var(--mute,#4f5b67);--t-line:var(--line,#c8d0d9);--t-b2:var(--panel2,#eaeef3);--t-acc:var(--accent-bg,#0a4fb3);--t-on:#fff;--t-ring:#ffd166;position:fixed;left:0;top:0;right:0;bottom:0;z-index:5000;pointer-events:none;font:15px/1.4 -apple-system,system-ui,"Segoe UI",sans-serif;-webkit-user-select:none;user-select:none}',
    '@media(prefers-color-scheme:dark){:root:not([data-theme=light]) .tfT{--t-bg:var(--panel,#222830);--t-fg:var(--fg,#e8ecf0);--t-mute:var(--mute,#9aa6b2);--t-line:var(--line,#38424d);--t-b2:var(--panel2,#2c343e);--t-acc:var(--accent-bg,#1a6fd4)}}',
    '.tfT *{box-sizing:border-box}',
    '.tfT .tfT-spot{position:fixed;border-radius:12px;box-shadow:0 0 0 2px #141a21,0 0 0 5px var(--t-ring),0 0 22px 7px rgba(255,209,102,.6);pointer-events:none;display:none}',
    '.tfT .tfT-card{position:fixed;display:flex;flex-direction:column;pointer-events:auto;background:var(--t-bg);color:var(--t-fg);border:1px solid var(--t-line);border-radius:16px;box-shadow:0 8px 28px rgba(0,0,0,.4);padding:10px 12px 8px;outline:none;max-width:calc(100vw - 16px)}',
    '.tfT .tfT-hd{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin:0 0 4px}',
    '.tfT .tfT-meta{flex:none;font-size:14px;font-weight:600;color:var(--t-mute);white-space:nowrap}',
    '.tfT .tfT-h{margin:0;font-size:17px;line-height:1.25;font-weight:700;color:var(--t-fg)}',
    '.tfT .tfT-body{overflow-y:auto;overflow-x:hidden;min-height:0;flex:0 1 auto;-webkit-overflow-scrolling:touch;-webkit-user-select:text;user-select:text}',
    '.tfT .tfT-t{margin:0 0 6px;font-size:15px;line-height:1.45;color:var(--t-fg)}',
    '.tfT .tfT-chk{display:flex;align-items:center;gap:10px;min-height:44px;margin:0;color:var(--t-mute);font-size:14px;cursor:pointer}',
    '.tfT .tfT-chk input{width:24px;height:24px;min-height:0;margin:0;padding:0;flex:none;accent-color:var(--t-acc)}',
    '.tfT .tfT-btns{display:flex;flex-wrap:nowrap;align-items:center;gap:8px;padding-top:6px;border-top:1px solid var(--t-line);flex:none}',
    '.tfT .tfT-sp{flex:1 1 4px}',
    '.tfT .tfT-b{min-height:44px;min-width:44px;padding:0 14px;border-radius:12px;border:1px solid var(--t-line);background:var(--t-b2);color:var(--t-fg);font-weight:600;font-size:15px;line-height:1;font-family:inherit;cursor:pointer;touch-action:manipulation;white-space:nowrap}',
    '.tfT .tfT-b.pri{background:var(--t-acc);border-color:var(--t-acc);color:var(--t-on)}',
    '.tfT .tfT-b.gh{background:transparent;color:var(--t-fg);padding:0 10px}',
    '.tfT .tfT-b[disabled]{opacity:.4;cursor:default}',
    '.tfT .tfT-b:focus-visible,.tfT .tfT-chk input:focus-visible{outline:3px solid var(--t-ring);outline-offset:2px}',
    '.tfT-hb{width:44px;height:44px;min-width:44px;flex:none;margin:0 2px;border-radius:22px;border:1px solid var(--line,#c8d0d9);background:var(--panel2,#eaeef3);color:var(--fg,#141a21);font:700 19px/1 -apple-system,system-ui,"Segoe UI",sans-serif;cursor:pointer;display:inline-grid;place-items:center;padding:0;touch-action:manipulation}',
    '.tfT-hb:focus-visible{outline:3px solid var(--accent,#3b9eff);outline-offset:2px}',
    '.tfT-hb.fl{position:fixed;right:10px;bottom:calc(76px + env(safe-area-inset-bottom));z-index:90;opacity:.85}',
    '.tfT-help{margin:0 0 12px}.tfT-help .tfT-hbtn{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 16px;border-radius:12px;border:1px solid var(--line,#c8d0d9);background:var(--panel2,#eaeef3);color:var(--fg,#141a21);font:600 14.5px/1 -apple-system,system-ui,"Segoe UI",sans-serif;cursor:pointer}',
    '@media(prefers-reduced-motion:no-preference){.tfT .tfT-card{animation:tfTin .18s ease-out}@keyframes tfTin{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}}',
    '@media print{.tfT,.tfT-hb{display:none!important}}'
  ].join('\n');
  function injectCss() {
    if (!hasDoc || document.getElementById('tfTutCss')) return;
    var s = document.createElement('style'); s.id = 'tfTutCss'; s.appendChild(document.createTextNode(CSS));
    (document.head || document.documentElement).appendChild(s);
  }

  /* ---------- Tour ---------- */
  var S = null; /* aktive Tour */

  function vp() {
    var de = document.documentElement;
    return { w: Math.min(root.innerWidth || de.clientWidth, de.clientWidth || root.innerWidth), h: root.innerHeight || de.clientHeight };
  }
  function overlaps(a, r, m) { return !!r && !(a.l + a.w < r.left - m || a.l > r.right + m || a.t + a.h < r.top - m || a.t > r.bottom + m); }
  /* Karte an den unteren Rand (Handy: volle Breite, höchstens 30 % der Höhe; Desktop: unten rechts, schmal).
     Würde sie das Ziel verdecken, weicht sie aus: Handy erst nach oben, dann direkt über das Ziel; Desktop nach unten links, oben rechts, oben links. */
  function place() {
    if (!S) return;
    var V = vp(), card = S.card, spot = S.spot, el = S.target;
    var narrow = V.w <= 600, m = 8;
    var r = el && isVisible(el) ? el.getBoundingClientRect() : null;
    var w = narrow ? V.w - 2 * m : Math.min(360, V.w - 2 * m);
    card.style.width = w + 'px';
    card.style.maxHeight = Math.floor(V.h * (narrow ? 0.3 : 0.55)) + 'px';
    card.style.left = card.style.right = card.style.top = card.style.bottom = 'auto';
    var h = card.offsetHeight, cand, i, pick = null;
    if (narrow) {
      cand = [{ l: m, t: V.h - h - m }, { l: m, t: m }];
      if (r) cand.push({ l: m, t: r.top - h - m });
    } else {
      cand = [{ l: V.w - w - 16, t: V.h - h - 16 }, { l: 16, t: V.h - h - 16 }, { l: V.w - w - 16, t: 16 }, { l: 16, t: 16 }];
    }
    for (i = 0; i < cand.length; i++) {
      var c = cand[i]; c.w = w; c.h = h;
      if (c.t < 4 || c.t + h > V.h - 4) continue;
      if (!overlaps(c, r, 6)) { pick = c; break; }
    }
    var hit = false;
    if (!pick) { pick = cand[0]; hit = overlaps(pick, r, 0); }
    card.style.left = Math.max(4, Math.min(pick.l, V.w - w - 4)) + 'px';
    card.style.top = Math.max(4, Math.min(pick.t, V.h - h - 4)) + 'px';
    card.setAttribute('data-ueberdeckt', hit ? '1' : '0');
    S.root.className = 'tfT' + (r ? '' : ' tfT-nospot');
    if (!r) { spot.style.display = 'none'; return; }
    var pad = 4, x = Math.max(0, r.left - pad), y = Math.max(0, r.top - pad), x2 = Math.min(V.w, r.right + pad), y2 = Math.min(V.h, r.bottom + pad);
    if (hit) {
      /* ein hohes Ziel bleibt teils unter der Karte: den Ring nur um den freien Teil legen */
      if (pick.t > y + 40) y2 = Math.min(y2, pick.t - 4);
      else if (pick.t + h < y2 - 40) y = Math.max(y, pick.t + h + 4);
      else y2 = y;
    }
    if (y2 - y < 8 || x2 - x < 8) { spot.style.display = 'none'; return; }
    spot.style.display = 'block'; spot.style.left = x + 'px'; spot.style.top = y + 'px';
    spot.style.width = (x2 - x) + 'px'; spot.style.height = (y2 - y) + 'px';
  }
  var raf = null;
  function schedulePlace() {
    if (raf || !S) return;
    var f = root.requestAnimationFrame || function (fn) { return setTimeout(fn, 16); };
    raf = f(function () { raf = null; place(); });
  }
  /* Ziel ins Bild holen, aber nicht unter die Karte: Handy bleibt der Streifen unten (30 %) frei */
  function bringIntoView(el) {
    try {
      var V = vp(), r = el.getBoundingClientRect(), narrow = V.w <= 600;
      var low = narrow ? V.h * 0.68 : V.h - 8;
      if (r.top < 0 || r.bottom > low) {
        if (r.height <= low - 8) el.scrollIntoView({ block: 'center', inline: 'nearest' }); else el.scrollIntoView({ block: 'start', inline: 'nearest' });
      } else if (r.left < 0 || r.right > V.w) el.scrollIntoView({ block: 'nearest', inline: 'center' });
    } catch (e) {}
  }

  function render(i, el) {
    if (!S) return;
    var st = S.steps[i], n = S.steps.length;
    S.target = el || null;
    S.meta.textContent = 'Schritt ' + (i + 1) + ' von ' + n;
    S.h.textContent = st.h || S.name;
    S.txt.textContent = st.t;
    S.back.disabled = i === 0;
    S.next.textContent = i === n - 1 ? 'Fertig' : 'Weiter';
    /* Häkchen nur im letzten Schritt der kurzen Tour (spart Platz auf dem Handy) */
    S.lab.style.display = S.kurz && i < n - 1 ? 'none' : 'flex';
    S.body.scrollTop = 0;
    if (el) bringIntoView(el);
    place();
    setTimeout(function () { if (S && el && S.target === el) { bringIntoView(el); place(); } }, 60);
    setTimeout(function () { if (S && el && S.target === el) { bringIntoView(el); place(); } }, 260);
    try { S.next.focus({ preventScroll: true }); } catch (e) { try { S.next.focus(); } catch (e2) {} }
    if (!S.marked) { S.marked = true; if (S.auto) lsSet(PFX + S.key, '1'); }
  }
  function go(i) {
    if (!S) return;
    if (i < 0) i = 0;
    if (i >= S.steps.length) { finish(); return; }
    S.idx = i;
    var gen = ++S.gen, st = S.steps[i];
    if (st.c) {
      var ce = q1(st.c);
      if (ce && !(ce.classList && ce.classList.contains('on')) && ce.getAttribute('aria-selected') !== 'true') { try { ce.click(); } catch (e) {} }
    }
    if (!st.s) { setTimeout(function () { if (S && gen === S.gen) render(i, null); }, st.c ? 80 : 0); return; }
    var tries = 0;
    (function poll() {
      if (!S || gen !== S.gen) return;
      var el = findTarget(st.s);
      if (el || tries++ >= 12) { render(i, el); return; }
      setTimeout(poll, 70);
    })();
  }

  /* Kurze Tour: je Schritt die erste Variante mit sichtbarem Ziel; ohne Ziel entfällt der Schritt (höchstens drei) */
  function kurzSteps(L) {
    var out = [], k = L && L.kurz, i, j;
    if (!k) return out;
    for (i = 0; i < k.length && out.length < 3; i++) {
      var v = k[i].v || [];
      for (j = 0; j < v.length; j++) {
        if (findTarget(v[j].s)) { out.push({ h: v[j].h, t: v[j].t, s: v[j].s }); break; }
      }
    }
    return out;
  }

  function onKey(e) {
    if (!S || e.type === 'keyup') return;
    var k = e.key || e.keyCode, a = document.activeElement;
    if (k === 'Escape' || k === 'Esc' || k === 27) { e.preventDefault(); e.stopPropagation(); finish(); return; }
    /* Pfeiltasten nur, wenn der Fokus auf der Karte oder nirgends liegt (die Seite bleibt bedienbar, nichts wird gefangen) */
    if (a && a !== document.body && !S.card.contains(a)) return;
    if (k === 'ArrowRight' || k === 39) { e.preventDefault(); e.stopPropagation(); go(S.idx + 1); return; }
    if (k === 'ArrowLeft' || k === 37) { e.preventDefault(); e.stopPropagation(); go(S.idx - 1); return; }
  }
  /* Automatische Tour: ein Antippen außerhalb der Karte beendet sie (der Nutzer macht selbst weiter), das Tippen selbst geht an die Seite */
  function onPointer(e) {
    if (!S || !S.auto || S.card.contains(e.target)) return;
    S.noRestore = true; S.byUser = true; finish();
  }

  /* Ende der Tour: "Nicht mehr zeigen" (gilt für alle Labs) und "gesehen" (dieses Lab) merken */
  function commit(key, off, seen) {
    lsSet(OFFKEY, off ? '1' : '0');
    if (seen) lsSet(PFX + key, '1');
  }

  function finish() {
    if (!S) return;
    var s = S; S = null;
    try {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onPointer, true);
      root.removeEventListener('resize', schedulePlace); root.removeEventListener('orientationchange', schedulePlace);
      document.removeEventListener('scroll', schedulePlace, true);
      clearInterval(s.timer);
    } catch (e) {}
    if (s.root.parentNode) s.root.parentNode.removeChild(s.root);
    commit(s.key, s.chk.checked, s.auto || s.marked);
    if (!s.noRestore) { try { restoreTab(s.tab0); } catch (e) {} }
    try { if (!s.byUser && s.prevFocus && s.prevFocus.focus && document.body.contains(s.prevFocus)) s.prevFocus.focus(); } catch (e) {}
    try {
      var ev;
      if (typeof root.CustomEvent === 'function') ev = new root.CustomEvent('tf-tour-ende', { detail: { key: s.key, auto: s.auto, kurz: s.kurz } });
      else { ev = document.createEvent('Event'); ev.initEvent('tf-tour-ende', true, false); }
      document.dispatchEvent(ev);
    } catch (e3) {}
  }

  function start(opts) {
    opts = opts || {};
    if (!hasDoc || S) return false;
    var key = opts.key || labKey(), L = dataFor(key);
    if (!L) return false;
    var kurz = !!opts.auto, steps = kurz ? kurzSteps(L) : L.steps;
    if (!steps.length) return false;
    injectCss();
    var el = mk('div', 'tfT'); el.id = 'tfTut';
    var spot = mk('div', 'tfT-spot');
    var card = mk('section', 'tfT-card');
    card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'false');
    card.setAttribute('aria-labelledby', 'tfTutH'); card.setAttribute('aria-describedby', 'tfTutT'); card.tabIndex = -1;
    var hd = mk('div', 'tfT-hd'), h = mk('h2', 'tfT-h'); h.id = 'tfTutH';
    var meta = mk('div', 'tfT-meta'); meta.setAttribute('aria-live', 'polite');
    hd.appendChild(h); hd.appendChild(meta);
    var body = mk('div', 'tfT-body'), txt = mk('p', 'tfT-t'); txt.id = 'tfTutT'; body.appendChild(txt);
    var lab = mk('label', 'tfT-chk'), chk = mk('input'); chk.type = 'checkbox'; chk.checked = lsGet(OFFKEY) === '1';
    lab.appendChild(chk); lab.appendChild(mk('span', '', 'Nicht mehr zeigen'));
    var btns = mk('div', 'tfT-btns');
    var skip = mk('button', 'tfT-b gh', 'Überspringen'), back = mk('button', 'tfT-b', 'Zurück'), next = mk('button', 'tfT-b pri', 'Weiter');
    skip.type = back.type = next.type = 'button';
    skip.setAttribute('aria-label', 'Tutorial überspringen');
    btns.appendChild(skip); btns.appendChild(mk('span', 'tfT-sp')); btns.appendChild(back); btns.appendChild(next);
    card.appendChild(hd); card.appendChild(body); card.appendChild(lab); card.appendChild(btns);
    el.appendChild(spot); el.appendChild(card);
    S = { key: key, name: L.name || 'Tutorial', steps: steps, idx: 0, gen: 0, root: el, spot: spot, card: card, meta: meta, h: h, txt: txt, body: body, lab: lab,
      chk: chk, back: back, next: next, auto: !!opts.auto, kurz: kurz, marked: false, target: null, tab0: tabId(activeTab()), prevFocus: document.activeElement, timer: 0 };
    skip.addEventListener('click', function () { finish(); });
    back.addEventListener('click', function () { go(S ? S.idx - 1 : 0); });
    next.addEventListener('click', function () { go(S ? S.idx + 1 : 0); });
    document.body.appendChild(el);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onPointer, true);
    root.addEventListener('resize', schedulePlace); root.addEventListener('orientationchange', schedulePlace);
    document.addEventListener('scroll', schedulePlace, true);
    S.timer = setInterval(function () {
      if (!S) return;
      /* startet der Nutzer während einer automatischen Tour die Prüfung, räumt die Tour sofort ab */
      if (S.auto && (examOn(document, S.key) || overlayOpen())) { S.noRestore = true; finish(); return; }
      place();
    }, 700);
    go(0);
    return true;
  }
  function stop() { finish(); }
  function running() { return !!S; }

  /* ---------- Knöpfe zum Wiederholen ---------- */
  /* Knopf in den Kopf setzen; wird der Kopf dadurch zu breit (schmale Schirme), schwebt er stattdessen unten rechts */
  function placeButton(b) {
    var hd = document.querySelector('header');
    if (!hd) { b.className = 'tfT-hb fl'; if (b.parentNode !== document.body) document.body.appendChild(b); return; }
    if (b.parentNode !== hd) { var hp = document.getElementById('bHelp'); if (hp && hp.parentNode === hd) hd.insertBefore(b, hp); else hd.appendChild(b); }
    b.className = 'tfT-hb';
    if (hd.scrollWidth > hd.clientWidth + 1) { b.className = 'tfT-hb fl'; document.body.appendChild(b); }
  }
  function mountButtons() {
    if (!hasDoc || !dataFor(labKey())) return;
    injectCss();
    if (!document.getElementById('tfTutBtn')) {
      var b = mk('button', 'tfT-hb', '?'); b.id = 'tfTutBtn'; b.type = 'button';
      b.setAttribute('aria-label', 'Tutorial wiederholen'); b.title = 'Tutorial wiederholen';
      b.addEventListener('click', function () { start({ manual: true }); });
      placeButton(b);
      root.addEventListener('resize', function () { placeButton(b); });
    }
    var hv = document.getElementById('helpView') || document.getElementById('pgHelp');
    if (hv && !hv.__tfObs && root.MutationObserver) {
      var add = function () {
        if (hv.querySelector('.tfT-help')) return;
        var w = mk('div', 'tfT-help'), bt = mk('button', 'tfT-hbtn', '❓ Tutorial wiederholen'); bt.type = 'button';
        bt.addEventListener('click', function () { start({ manual: true }); });
        w.appendChild(bt); hv.insertBefore(w, hv.firstChild);
      };
      hv.__tfObs = new root.MutationObserver(function () { if (!hv.querySelector('.tfT-help')) add(); });
      hv.__tfObs.observe(hv, { childList: true });
      add();
    }
  }

  /* ---------- Autostart ---------- */
  function overlayOpen() {
    var l = document.querySelectorAll('.backdrop, [role="dialog"], [role="alertdialog"], .modal, .sheet');
    for (var i = 0; i < l.length; i++) {
      if (S && S.root.contains(l[i])) continue;
      if (isVisible(l[i])) return true;
    }
    return false;
  }
  function trainerOn() {
    try {
      if (root.Trainer && typeof root.Trainer.active === 'function' && root.Trainer.active()) return true;
      /* Trainer.active gibt es nicht: Angebot "Neu hier?" (#trOffer) oder Trainer-Blase (#trBub) sichtbar -> erst der Trainer, danach die Tour */
      var ids = ['trOffer', 'trBub'];
      for (var i = 0; i < ids.length; i++) { var e = document.getElementById(ids[i]); if (e && isVisible(e)) return true; }
      return false;
    } catch (e) { return false; }
  }
  function context() {
    var key = labKey(), L = dataFor(key), tab = activeTab(), only = L && L.only;
    var tabOk = true;
    if (only) { var tv = tab && (tab.getAttribute('data-tab') || tab.getAttribute('data-t')); tabOk = tv === only; }
    var g = document.getElementById('gate');
    return {
      hasData: !!L, off: lsGet(OFFKEY) === '1', seen: lsGet(PFX + key) === '1',
      search: (function (q) { return q === 'trainer' && !root.Trainer ? '' : q; })(String((root.location && root.location.search) || '').replace(/^\?/, '').replace(/(^|&)lr=[^&]*/g, '').replace(/^&/, '')), /* ?trainer (Lernpfad-Knopf) ohne Trainer auf der Seite ist kein Parameter; ?lr=aus/an (Rahmen) auch nicht */
      hash: L && L.hashOk ? '' : String((root.location && root.location.hash) || '').replace(/^#/, ''), /* hashOk: Seite führt den Block im #-Teil (emblab), das ist kein Sprung */
      exam: examOn(document, key), tabOk: tabOk, gate: !!g, overlay: overlayOpen(), trainer: trainerOn()
    };
  }
  function auto() {
    var t0 = Date.now(), clear = 0;
    (function tick() {
      if (S) return;
      var why = skipReason(context());
      if (!why) { if (++clear >= 2) { start({ auto: true }); return; } setTimeout(tick, 500); return; }
      clear = 0;
      if (!isTransient(why) || Date.now() - t0 > 1800000) return;
      setTimeout(tick, 600);
    })();
  }
  /* Erster Besuch: ein Hinweis nach dem anderen. Solange die Tour ansteht, bleiben "Neu hier?" (#trOffer, nur ohne Rahmen; mit Rahmen liegt es im Info-Blatt)
     und das Willkommens-Banner (design.js) aus dem Weg. Die Klasse tf-erst bleibt bis zum Neuladen, damit nach dem Schließen nichts Zweites auftaucht. */
  function erstBesuch() {
    if (!hasDoc) return false;
    try { var c = context(); c.gate = c.overlay = c.trainer = false; c.tabOk = true; return !skipReason(c); } catch (e) { return false; }
  }
  function markErst() {
    try {
      if (!erstBesuch()) return;
      var de = document.documentElement; if (!/(^|\s)tf-erst(\s|$)/.test(de.className)) de.className += (de.className ? ' ' : '') + 'tf-erst';
      if (!document.getElementById('tfErstCss')) {
        var st = document.createElement('style'); st.id = 'tfErstCss'; st.appendChild(document.createTextNode('html.tf-erst:not(.lr-on) #trOffer{display:none!important}'));
        (document.head || de).appendChild(st);
      }
    } catch (e) {}
  }
  function boot() { try { mountButtons(); } catch (e) {} try { auto(); } catch (e2) {} }

  var API = {
    start: start, stop: stop, restart: function () { return start({ manual: true }); }, running: running,
    labKey: labKey, steps: function (k) { var L = dataFor(k || labKey()); return L ? L.steps : null; },
    skipReason: skipReason, commit: commit, isTransient: isTransient, examOn: examOn, setStore: setStore,
    mountButtons: mountButtons, boot: boot, context: context, _find: findTarget, kurzSteps: function (k) { return kurzSteps(dataFor(k || labKey())); },
    erstBesuch: erstBesuch, state: function () { return S ? { running: true, auto: S.auto, kurz: S.kurz, idx: S.idx, n: S.steps.length, key: S.key, tgt: S.target } : { running: false }; }, KEY_PREFIX: PFX, KEY_OFF: OFFKEY
  };
  root.Tutorial = API;
  if (typeof module === 'object' && module && module.exports) module.exports = API;

  if (hasDoc && root.addEventListener && !root.__TUTORIAL_NOBOOT) {
    markErst();
    if (document.readyState === 'complete') setTimeout(boot, 300);
    else root.addEventListener('load', function () { setTimeout(boot, 400); });
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
