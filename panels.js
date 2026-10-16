/* Seitenleisten ein- und ausklappen und in der Breite verschieben (alle Labs): Bauteilliste links, Hinweis-/Einstellungsleiste rechts.
   Am Rand der Zeichenfläche sitzt je ein Reiter zum Ein- und Ausklappen und ein Griff zum Ziehen der Breite (Doppeltipp = Standardbreite).
   Zustand und Breite werden gemerkt (localStorage „lm4.panels“). */
(function () {
  var mid, main, left, right, bl, br, gl, gr, state = { l: 0, r: 0, lw: 0, rw: 0 };
  var LIM = { l: [140, 380], r: [200, 520] };
  try { state = Object.assign(state, JSON.parse(localStorage.getItem('lm4.panels') || '{}')); } catch (e) {}
  function save() { try { localStorage.setItem('lm4.panels', JSON.stringify(state)); } catch (e) {} }
  function css() {
    var s = document.createElement('style');
    s.textContent = '#mid.noL #parts{width:0!important;min-width:0!important;padding:0!important;border:0!important;overflow:hidden!important;flex:none!important}' +
      '#mid.noR #side{width:0!important;min-width:0!important;max-height:0!important;padding:0!important;border:0!important;overflow:hidden!important;flex:none!important}' +
      '@media(min-width:720px){#mid.hasLW:not(.noL) #parts{width:var(--lw)!important}#mid.hasRW:not(.noR) #side{width:var(--rw)!important}}' +
      '.ptab{position:absolute;top:50%;transform:translateY(-50%);z-index:6;width:26px;height:64px;display:none;align-items:center;justify-content:center;font:700 20px/1 system-ui,sans-serif;color:var(--fg,#e8ecf0);background:var(--panel,#222830);border:1px solid var(--line,#38424d);opacity:.92;cursor:pointer;padding:0;touch-action:manipulation;-webkit-tap-highlight-color:transparent}' +
      '.ptab:active{background:var(--panel2,#2c343e)}.ptab.l{left:0;border-left:0;border-radius:0 12px 12px 0}.ptab.r{right:0;border-right:0;border-radius:12px 0 0 12px}' +
      '#mid .pmeasure{white-space:nowrap!important}#mid .pmeasure *{white-space:nowrap!important}' +
      '.pgrip{position:absolute;top:0;bottom:0;width:16px;z-index:5;display:none;cursor:col-resize;touch-action:none;-webkit-tap-highlight-color:transparent}' +
      '.pgrip.l{left:0}.pgrip.r{right:0}.pgrip::after{content:"";position:absolute;top:50%;height:46px;width:4px;margin-top:-23px;border-radius:2px;background:var(--mute,#8d99a6);opacity:.55}' +
      '.pgrip.l::after{left:' + 2 + 'px}.pgrip.r::after{right:2px}.pgrip:hover::after,.pgrip.on::after{opacity:1;background:var(--accent,#3b9eff)}' +
      '.ptab.l{top:calc(50% + 50px)}.ptab.r{top:calc(50% + 50px)}' +
      '@media(max-width:719px){#mid{flex-direction:column}.pgrip{display:none!important}.ptab.r{top:auto;bottom:6px;transform:none;width:64px;height:26px;right:50%;margin-right:-32px;border:1px solid var(--line,#38424d);border-radius:12px}}' +
      '@media print{.ptab,.pgrip{display:none!important}}';
    document.head.appendChild(s);
  }
  function shown(el) { return !!el && getComputedStyle(el).display !== 'none'; }
  /* natürliche Breite: so breit wie der längste Text der Leiste (ohne Umbruch), damit man sie nie weiter aufzieht als nötig */
  var nat = { l: 0, r: 0 };
  function measure(k, panel) {
    if (!panel || getComputedStyle(panel).display === 'none') return nat[k];
    var prev = panel.getAttribute('style');
    panel.classList.add('pmeasure'); panel.style.setProperty('width', 'max-content', 'important'); panel.style.setProperty('max-width', 'none', 'important'); panel.style.setProperty('overflow', 'visible', 'important');
    var pr = panel.getBoundingClientRect(), best = 0, cs = getComputedStyle(panel), padR = parseFloat(cs.paddingRight) || 0;
    var tw = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT, null), n, rg = document.createRange();
    while ((n = tw.nextNode())) {
      if (!n.nodeValue.trim()) continue;
      var pe = n.parentElement; if (!pe || getComputedStyle(pe).display === 'none' || pe.closest('[hidden]')) continue;
      rg.selectNodeContents(n); var r = rg.getBoundingClientRect(); if (r.width > 0) best = Math.max(best, r.right - pr.left);
    }
    panel.classList.remove('pmeasure');
    if (prev === null) panel.removeAttribute('style'); else panel.setAttribute('style', prev);
    if (best > 0) nat[k] = Math.ceil(best + padR + 16);
    return nat[k];
  }
  function clampW(k, w) {
    var m = Math.max(LIM[k][0], Math.min(LIM[k][1], Math.round(window.innerWidth * 0.42)));
    if (nat[k]) m = Math.max(LIM[k][0], Math.min(m, nat[k]));
    return Math.max(LIM[k][0], Math.min(m, w));
  }
  var lastSig = '';
  function update() {
    if (!mid) return;
    var narrow = window.matchMedia('(max-width:719px)').matches;
    var showL0 = shown(left) && !narrow, showR0 = shown(right);
    var sig = [state.l, state.r, state.lw, state.rw, narrow, showL0, showR0, window.innerWidth].join('|');
    if (sig === lastSig) return; lastSig = sig;
    if (state.lw && !state.l) measure('l', left); if (state.rw && !state.r) measure('r', right);
    mid.classList.toggle('noL', !!state.l); mid.classList.toggle('noR', !!state.r);
    if (state.lw) { mid.style.setProperty('--lw', clampW('l', state.lw) + 'px'); mid.classList.add('hasLW'); } else mid.classList.remove('hasLW');
    if (state.rw) { mid.style.setProperty('--rw', clampW('r', state.rw) + 'px'); mid.classList.add('hasRW'); } else mid.classList.remove('hasRW');
    var showL = shown(left) && !narrow, showR = shown(right);
    bl.style.display = showL ? 'flex' : 'none'; br.style.display = showR ? 'flex' : 'none';
    gl.style.display = (showL && !state.l) ? 'block' : 'none'; gr.style.display = (showR && !state.r && !narrow) ? 'block' : 'none';
    bl.textContent = state.l ? '›' : '‹'; bl.title = state.l ? 'Bauteilliste einblenden' : 'Bauteilliste ausblenden'; bl.setAttribute('aria-label', bl.title);
    br.textContent = narrow ? (state.r ? '▲' : '▼') : (state.r ? '‹' : '›');
    br.title = state.r ? 'Seitenleiste einblenden' : 'Seitenleiste ausblenden'; br.setAttribute('aria-label', br.title);
  }
  function fire() { window.dispatchEvent(new Event('resize')); }
  function toggle(k) { state[k] = state[k] ? 0 : 1; save(); update(); setTimeout(fire, 30); }
  function grip(el, k, panel) {
    var sx = 0, sw = 0, raf = 0;
    el.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); try { el.setPointerCapture(e.pointerId); } catch (x) {} sx = e.clientX; sw = panel.getBoundingClientRect().width; measure(k, panel); el.classList.add('on'); el._drag = true; });
    el.addEventListener('pointermove', function (e) {
      if (!el._drag) return; var dx = e.clientX - sx, w = clampW(k, sw + (k === 'l' ? dx : -dx));
      state[k + 'w'] = w; mid.style.setProperty('--' + (k === 'l' ? 'lw' : 'rw'), w + 'px'); mid.classList.add(k === 'l' ? 'hasLW' : 'hasRW');
      if (!raf) raf = requestAnimationFrame(function () { raf = 0; fire(); });
    });
    var end = function () { if (!el._drag) return; el._drag = false; el.classList.remove('on'); save(); fire(); };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    el.addEventListener('dblclick', function () { state[k + 'w'] = 0; save(); update(); setTimeout(fire, 30); });
  }
  function init() {
    mid = document.getElementById('mid'); left = document.getElementById('parts'); right = document.getElementById('side');
    main = mid && (mid.querySelector('main') || document.getElementById('stage'));
    if (!mid || !main || !left || !right) return;
    css();
    bl = document.createElement('button'); bl.className = 'ptab l'; bl.type = 'button'; bl.onclick = function () { toggle('l'); };
    br = document.createElement('button'); br.className = 'ptab r'; br.type = 'button'; br.onclick = function () { toggle('r'); };
    gl = document.createElement('div'); gl.className = 'pgrip l'; gl.title = 'Breite ziehen (Doppelklick: Standard)';
    gr = document.createElement('div'); gr.className = 'pgrip r'; gr.title = 'Breite ziehen (Doppelklick: Standard)';
    main.appendChild(gl); main.appendChild(gr); main.appendChild(bl); main.appendChild(br);
    grip(gl, 'l', left); grip(gr, 'r', right);
    new MutationObserver(update).observe(mid, { attributes: true, subtree: true, attributeFilter: ['style', 'class'] });
    window.addEventListener('resize', update);
    update(); setTimeout(function () { update(); fire(); }, 400);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
