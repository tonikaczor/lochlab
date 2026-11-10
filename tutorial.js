/* tutorial.js - zentrale Tutorial-Engine aller Lab-Seiten (Tonfunk Lab).
 * Zeigt beim ERSTEN Öffnen eines Labs eine kurze Tour: Spotlight auf ein Element plus Textkarte
 * (Schritt x von y, Zurück, Weiter, Überspringen, Häkchen "Nicht mehr zeigen"). Jederzeit überspringbar (Esc).
 * Die Schritte stehen in tutorial-data.js (window.TUTORIAL_DATA.labs[<Dateiname ohne .html>]):
 *   { name, steps: [ { h: Überschrift, t: Text, s: Selektor oder Liste von Selektoren (erster sichtbarer gilt),
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
    '.tfT{--t-bg:var(--panel,#fff);--t-fg:var(--fg,#141a21);--t-mute:var(--mute,#4f5b67);--t-line:var(--line,#c8d0d9);--t-b2:var(--panel2,#eaeef3);--t-acc:var(--accent-bg,#0a4fb3);--t-on:#fff;--t-dim:rgba(6,10,16,.66);--t-ring:#ffd166;position:fixed;left:0;top:0;right:0;bottom:0;z-index:5000;font:15px/1.4 -apple-system,system-ui,"Segoe UI",sans-serif;-webkit-user-select:none;user-select:none}',
    '@media(prefers-color-scheme:dark){:root:not([data-theme=light]) .tfT{--t-bg:var(--panel,#222830);--t-fg:var(--fg,#e8ecf0);--t-mute:var(--mute,#9aa6b2);--t-line:var(--line,#38424d);--t-b2:var(--panel2,#2c343e);--t-acc:var(--accent-bg,#1a6fd4)}}',
    '.tfT *{box-sizing:border-box}',
    '.tfT.tfT-nospot{background:var(--t-dim)}',
    '.tfT .tfT-spot{position:fixed;border-radius:12px;box-shadow:0 0 0 100vmax var(--t-dim);outline:3px solid var(--t-ring);outline-offset:0;pointer-events:none;display:none}',
    '.tfT .tfT-card{position:fixed;display:flex;flex-direction:column;background:var(--t-bg);color:var(--t-fg);border:1px solid var(--t-line);border-radius:16px;box-shadow:0 10px 36px rgba(0,0,0,.45);padding:14px 14px 10px;outline:none;max-width:calc(100vw - 16px)}',
    '.tfT .tfT-meta{font-size:12.5px;font-weight:600;color:var(--t-mute);letter-spacing:.03em;margin:0 0 4px}',
    '.tfT .tfT-h{margin:0 0 6px;font-size:18px;line-height:1.25;font-weight:700;color:var(--t-fg)}',
    '.tfT .tfT-body{overflow-y:auto;overflow-x:hidden;min-height:0;-webkit-overflow-scrolling:touch;-webkit-user-select:text;user-select:text}',
    '.tfT .tfT-t{margin:0 0 8px;font-size:15.5px;line-height:1.5;color:var(--t-fg)}',
    '.tfT .tfT-chk{display:flex;align-items:center;gap:10px;min-height:44px;margin:2px 0 4px;color:var(--t-mute);font-size:14px;cursor:pointer}',
    '.tfT .tfT-chk input{width:24px;height:24px;min-height:0;margin:0;padding:0;flex:none;accent-color:var(--t-acc)}',
    '.tfT .tfT-btns{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding-top:6px;border-top:1px solid var(--t-line)}',
    '.tfT .tfT-sp{flex:1 1 8px}',
    '.tfT .tfT-b{min-height:44px;min-width:44px;padding:0 16px;border-radius:12px;border:1px solid var(--t-line);background:var(--t-b2);color:var(--t-fg);font-weight:600;font-size:15px;line-height:1;font-family:inherit;cursor:pointer;touch-action:manipulation}',
    '.tfT .tfT-b.pri{background:var(--t-acc);border-color:var(--t-acc);color:var(--t-on)}',
    '.tfT .tfT-b.gh{background:transparent;color:var(--t-fg)}',
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
  function place() {
    if (!S) return;
    var V = vp(), card = S.card, spot = S.spot, el = S.target;
    var narrow = V.w <= 600;
    var r = el && isVisible(el) ? el.getBoundingClientRect() : null;
    S.root.className = 'tfT' + (r ? '' : ' tfT-nospot');
    if (r) {
      var pad = 6, x = Math.max(0, r.left - pad), y = Math.max(0, r.top - pad);
      var x2 = Math.min(V.w, r.right + pad), y2 = Math.min(V.h, r.bottom + pad);
      spot.style.display = 'block'; spot.style.left = x + 'px'; spot.style.top = y + 'px';
      spot.style.width = Math.max(0, x2 - x) + 'px'; spot.style.height = Math.max(0, y2 - y) + 'px';
    } else spot.style.display = 'none';
    var w = narrow ? V.w - 16 : Math.min(400, V.w - 24);
    card.style.width = w + 'px';
    card.style.maxHeight = (narrow ? Math.floor(V.h * 0.52) : V.h - 24) + 'px';
    card.style.left = card.style.right = card.style.top = card.style.bottom = 'auto';
    var h = card.offsetHeight, left, top;
    function hit(t, l) { return r && !(l + w < r.left - 4 || l > r.right + 4 || t + h < r.top - 4 || t > r.bottom + 4); }
    if (narrow) {
      var bottomTop = V.h - h - 8, topTop = 8;
      left = 8; top = bottomTop;
      if (r) {
        var inLower = (r.top + r.bottom) / 2 > V.h * 0.5;
        if (inLower) top = topTop;
        if (hit(top, left)) top = (top === topTop) ? bottomTop : topTop;
      }
    } else if (!r) {
      left = Math.round((V.w - w) / 2); top = Math.round((V.h - h) / 2);
    } else {
      var gap = 14, c = [
        [r.bottom + gap, r.left], [r.top - gap - h, r.left], [r.top, r.right + gap], [r.top, r.left - gap - w]
      ];
      left = null;
      for (var i = 0; i < c.length; i++) {
        var t = c[i][0], l = Math.min(Math.max(8, c[i][1]), V.w - w - 8);
        if (t >= 8 && t + h <= V.h - 8 && l >= 8 && l + w <= V.w - 8 && !hit(t, l)) { top = t; left = l; break; }
      }
      if (left === null) { left = Math.round((V.w - w) / 2); top = V.h - h - 12; if (hit(top, left)) top = 12; }
    }
    top = Math.max(4, Math.min(top, V.h - h - 4));
    left = Math.max(4, Math.min(left, V.w - w - 4));
    card.style.left = left + 'px'; card.style.top = top + 'px';
  }
  var raf = null;
  function schedulePlace() {
    if (raf || !S) return;
    var f = root.requestAnimationFrame || function (fn) { return setTimeout(fn, 16); };
    raf = f(function () { raf = null; place(); });
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
    S.body.scrollTop = 0;
    if (el) { try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {} }
    place();
    setTimeout(place, 60);
    try { S.next.focus(); } catch (e) {}
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

  function onKey(e) {
    if (!S) return;
    var k = e.key || e.keyCode;
    if (e.type === 'keyup') { e.stopPropagation(); return; }
    if (k === 'Escape' || k === 'Esc' || k === 27) { e.preventDefault(); e.stopPropagation(); finish(); return; }
    if (k === 'ArrowRight' || k === 39) { e.preventDefault(); e.stopPropagation(); go(S.idx + 1); return; }
    if (k === 'ArrowLeft' || k === 37) { e.preventDefault(); e.stopPropagation(); go(S.idx - 1); return; }
    if (k === 'Tab' || k === 9) {
      var f = focusables(S.card); if (!f.length) { e.preventDefault(); return; }
      var a = document.activeElement, ix = f.indexOf(a);
      e.preventDefault(); e.stopPropagation();
      if (e.shiftKey) ix = ix <= 0 ? f.length - 1 : ix - 1; else ix = ix < 0 || ix === f.length - 1 ? 0 : ix + 1;
      f[ix].focus(); return;
    }
    e.stopPropagation();
  }
  function onFocusIn(e) {
    if (!S || S.card.contains(e.target)) return;
    var f = focusables(S.card); if (f.length) f[0].focus(); else S.card.focus();
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
      document.removeEventListener('keydown', onKey, true); document.removeEventListener('keyup', onKey, true);
      document.removeEventListener('focusin', onFocusIn, true);
      root.removeEventListener('resize', schedulePlace); root.removeEventListener('orientationchange', schedulePlace);
      document.removeEventListener('scroll', schedulePlace, true);
      clearInterval(s.timer);
    } catch (e) {}
    if (s.root.parentNode) s.root.parentNode.removeChild(s.root);
    commit(s.key, s.chk.checked, s.auto || s.marked);
    try {
      restoreTab(s.tab0);
    } catch (e) {}
    try { if (s.prevFocus && s.prevFocus.focus && document.body.contains(s.prevFocus)) s.prevFocus.focus(); } catch (e) {}
  }

  function start(opts) {
    opts = opts || {};
    if (!hasDoc || S) return false;
    var key = opts.key || labKey(), L = dataFor(key);
    if (!L) return false;
    injectCss();
    var el = mk('div', 'tfT'); el.id = 'tfTut';
    var spot = mk('div', 'tfT-spot');
    var card = mk('section', 'tfT-card');
    card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'tfTutH'); card.setAttribute('aria-describedby', 'tfTutT'); card.tabIndex = -1;
    var meta = mk('div', 'tfT-meta'); meta.setAttribute('aria-live', 'polite');
    var h = mk('h2', 'tfT-h'); h.id = 'tfTutH';
    var body = mk('div', 'tfT-body'), txt = mk('p', 'tfT-t'); txt.id = 'tfTutT'; body.appendChild(txt);
    var lab = mk('label', 'tfT-chk'), chk = mk('input'); chk.type = 'checkbox'; chk.checked = lsGet(OFFKEY) === '1';
    lab.appendChild(chk); lab.appendChild(mk('span', '', 'Nicht mehr zeigen'));
    var btns = mk('div', 'tfT-btns');
    var skip = mk('button', 'tfT-b gh', 'Überspringen'), back = mk('button', 'tfT-b', 'Zurück'), next = mk('button', 'tfT-b pri', 'Weiter');
    skip.type = back.type = next.type = 'button';
    skip.setAttribute('aria-label', 'Tutorial überspringen');
    btns.appendChild(skip); btns.appendChild(mk('span', 'tfT-sp')); btns.appendChild(back); btns.appendChild(next);
    card.appendChild(meta); card.appendChild(h); card.appendChild(body); card.appendChild(lab); card.appendChild(btns);
    el.appendChild(spot); el.appendChild(card);
    S = { key: key, name: L.name || 'Tutorial', steps: L.steps, idx: 0, gen: 0, root: el, spot: spot, card: card, meta: meta, h: h, txt: txt, body: body,
      chk: chk, back: back, next: next, auto: !!opts.auto, marked: false, target: null, tab0: tabId(activeTab()), prevFocus: document.activeElement, timer: 0 };
    skip.addEventListener('click', function () { finish(); });
    back.addEventListener('click', function () { go(S ? S.idx - 1 : 0); });
    next.addEventListener('click', function () { go(S ? S.idx + 1 : 0); });
    el.addEventListener('click', function (e) { e.stopPropagation(); });
    document.body.appendChild(el);
    document.addEventListener('keydown', onKey, true); document.addEventListener('keyup', onKey, true);
    document.addEventListener('focusin', onFocusIn, true);
    root.addEventListener('resize', schedulePlace); root.addEventListener('orientationchange', schedulePlace);
    document.addEventListener('scroll', schedulePlace, true);
    S.timer = setInterval(function () { if (S) place(); }, 700);
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
    try { return !!(root.Trainer && typeof root.Trainer.active === 'function' && root.Trainer.active()); } catch (e) { return false; }
  }
  function context() {
    var key = labKey(), L = dataFor(key), tab = activeTab(), only = L && L.only;
    var tabOk = true;
    if (only) { var tv = tab && (tab.getAttribute('data-tab') || tab.getAttribute('data-t')); tabOk = tv === only; }
    var g = document.getElementById('gate');
    return {
      hasData: !!L, off: lsGet(OFFKEY) === '1', seen: lsGet(PFX + key) === '1',
      search: String((root.location && root.location.search) || '').replace(/^\?/, ''),
      hash: String((root.location && root.location.hash) || '').replace(/^#/, ''),
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
  function boot() { try { mountButtons(); } catch (e) {} try { auto(); } catch (e2) {} }

  var API = {
    start: start, stop: stop, restart: function () { return start({ manual: true }); }, running: running,
    labKey: labKey, steps: function (k) { var L = dataFor(k || labKey()); return L ? L.steps : null; },
    skipReason: skipReason, commit: commit, isTransient: isTransient, examOn: examOn, setStore: setStore,
    mountButtons: mountButtons, boot: boot, context: context, _find: findTarget, KEY_PREFIX: PFX, KEY_OFF: OFFKEY
  };
  root.Tutorial = API;
  if (typeof module === 'object' && module && module.exports) module.exports = API;

  if (hasDoc && root.addEventListener && !root.__TUTORIAL_NOBOOT) {
    if (document.readyState === 'complete') setTimeout(boot, 300);
    else root.addEventListener('load', function () { setTimeout(boot, 400); });
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
