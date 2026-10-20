'use strict';
/* Tonfunk Lab: Startseite anpassen.
   Jeder Nutzer kann Lab-Karten ausblenden und per Griff, Pfeile oder Tastatur umsortieren (nur auf diesem Gerät, localStorage lm4.home).
   Lab-IDs: data-lab der Karte, sonst Dateiname der ersten Ziel-URL (spslab.html -> spslab). Neue Karten in index.html erscheinen
   automatisch an der Dateiposition (relativ zu bekannten Nachbarn). Ausgeblendete Bereiche stehen als "@name" in hidden (derzeit: @lernpfad, @projekte; die Zeile Projekte ist kein Lab und steht außerhalb der Karten). */
(function () {
  const KEY = 'lm4.home', SEEN = 'lm4.home.seen';
  const SECTIONS = [{ id: '@lernpfad', name: 'Lernpfad', css: '#lernpfad{display:none!important}' }, { id: '@projekte', name: 'Projekte', css: '#vbRow{display:none!important}' }];
  const doc = document;
  let cards = null, st = { order: [], hidden: [] }, defaults = [], edit = false, showAll = false, obs = null, drag = null, armed = '';
  let ui = {};

  const load = () => {
    try {
      const o = JSON.parse(localStorage.getItem(KEY));
      if (o && typeof o === 'object') {
        const ok = a => Array.isArray(a) ? a.filter(s => typeof s === 'string') : [];
        return { order: ok(o.order), hidden: ok(o.hidden) };
      }
    } catch (e) {}
    return { order: [], hidden: [] };
  };
  const save = () => {
    try {
      if (!st.hidden.length && st.order.join('|') === defaults.join('|')) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, JSON.stringify({ order: st.order.slice(), hidden: st.hidden.slice() }));
    } catch (e) {}
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cardEls = () => Array.from(cards.children).filter(c => c.classList && c.classList.contains('card'));

  function idOf(el) {
    if (el.dataset.lab) return el.dataset.lab;
    let id = '';
    const a = el.querySelector('.btns a[href], a[href]');
    if (a) id = (a.getAttribute('href') || '').split(/[?#]/)[0].split('/').pop().replace(/\.html?$/i, '');
    if (!id) { const h = el.querySelector('h2,.tag'); id = h ? h.textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : ''; }
    if (!id) id = 'lab';
    const base = id; let n = 2;
    while (cardEls().some(o => o !== el && o.dataset.lab === id)) id = base + '-' + n++;
    el.dataset.lab = id;
    return id;
  }
  const nameOf = el => { const t = el.querySelector('.tag'), h = el.querySelector('h2'); return (t ? t.textContent.trim() : '') || (h ? h.textContent.trim() : idOf(el)); };
  const subOf = el => { const h = el.querySelector('h2'); return h ? h.textContent.trim() : ''; };

  // Fügt id in list ein: direkt nach dem nächsten bekannten Vorgänger in der DOM-Reihenfolge, sonst vor dem Nachfolger, sonst ans Ende.
  function place(list, id, ids, k) {
    if (list.indexOf(id) >= 0) return;
    for (let j = k - 1; j >= 0; j--) { const p = list.indexOf(ids[j]); if (p >= 0) { list.splice(p + 1, 0, id); return; } }
    for (let j = k + 1; j < ids.length; j++) { const p = list.indexOf(ids[j]); if (p >= 0) { list.splice(p, 0, id); return; } }
    list.push(id);
  }
  function reconcile() {
    const els = cardEls(), ids = els.map(idOf), have = {}; ids.forEach(i => { have[i] = 1; });
    st.order = st.order.filter(i => have[i]); defaults = defaults.filter(i => have[i]);
    ids.forEach((id, k) => { place(st.order, id, ids, k); place(defaults, id, ids, k); });
  }

  const isHid = id => st.hidden.indexOf(id) >= 0;
  const visIds = () => st.order.filter(i => !isHid(i));
  const byId = id => cardEls().find(e => idOf(e) === id);

  function announce(msg) { if (ui.live) { ui.live.textContent = ''; setTimeout(() => { ui.live.textContent = msg; }, 30); } }

  function render() {
    if (!cards) return;
    reconcile();
    const els = cardEls(), map = {}; els.forEach(e => { map[idOf(e)] = e; });
    if (els.map(idOf).join('|') !== st.order.join('|')) {
      if (obs) obs.disconnect();
      st.order.forEach(i => cards.appendChild(map[i]));
      watch();
    }
    els.forEach(e => e.classList.toggle('hm-hid', isHid(idOf(e)) && !showAll));
    cards.classList.toggle('hm-editing', edit);
    let css = ''; SECTIONS.forEach(s => { if (isHid(s.id)) css += s.css; });
    ui.secStyle.textContent = css;
    const nh = st.order.filter(isHid).length;
    ui.allLink.hidden = edit || (!nh && !showAll);
    ui.allA.textContent = showAll ? 'Nur meine Labs anzeigen' : 'Alle Labs anzeigen (' + nh + ' ausgeblendet)';
    if (edit) renderEdit(els);
  }

  function renderEdit(els) {
    els.forEach(e => { ensureCtl(e); updateCtl(e); });
    const hid = st.order.filter(isHid).map(byId).filter(Boolean);
    ui.hidSum.textContent = 'Ausgeblendete Labs (' + hid.length + ')';
    ui.hidList.innerHTML = hid.length ? '' : '<p class="hm-none">Du hast kein Lab ausgeblendet.</p>';
    hid.forEach(e => {
      const b = doc.createElement('button'); b.type = 'button'; b.className = 'hm-show'; b.dataset.id = idOf(e);
      b.setAttribute('aria-pressed', 'false'); b.setAttribute('aria-label', nameOf(e) + ' wieder anzeigen');
      b.innerHTML = '<span class="hm-plus" aria-hidden="true">+</span><span><b>' + esc(nameOf(e)) + '</b><small>' + esc(subOf(e)) + '</small></span><span class="hm-act">Einblenden</span>';
      ui.hidList.appendChild(b);
    });
    ui.secRow.innerHTML = '';
    SECTIONS.forEach(s => {
      const b = doc.createElement('button'); b.type = 'button'; b.className = 'hm-chip'; b.dataset.sec = s.id;
      const on = !isHid(s.id); b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.setAttribute('aria-label', 'Bereich ' + s.name + ' anzeigen');
      b.innerHTML = EYE + '<span>' + esc(s.name) + (on ? ' (sichtbar)' : ' (ausgeblendet)') + '</span>';
      ui.secRow.appendChild(b);
    });
  }

  const EYE = '<svg class="hm-eye" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7S18.5 19 12 19 1.5 12 1.5 12z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/></svg>';

  function ensureCtl(el) {
    if (el.querySelector(':scope>.hm-ctl')) return;
    const c = doc.createElement('div'); c.className = 'hm-ctl';
    c.innerHTML = '<button type="button" class="hm-grip" aria-pressed="false"><span aria-hidden="true">☰</span> Verschieben</button><span class="hm-sp"></span>'
      + '<button type="button" class="hm-up" aria-label="Nach vorn"><span aria-hidden="true">▲</span></button>'
      + '<button type="button" class="hm-dn" aria-label="Nach hinten"><span aria-hidden="true">▼</span></button>'
      + '<button type="button" class="hm-eyeb" aria-pressed="true">' + EYE + '</button>';
    el.insertBefore(c, el.firstChild);
  }
  function updateCtl(el) {
    const c = el.querySelector(':scope>.hm-ctl'); if (!c) return;
    const id = idOf(el), v = visIds(), i = v.indexOf(id), n = nameOf(el);
    const g = c.querySelector('.hm-grip'), up = c.querySelector('.hm-up'), dn = c.querySelector('.hm-dn'), ey = c.querySelector('.hm-eyeb');
    g.setAttribute('aria-label', n + ' verschieben. Ziehen oder Pfeiltasten benutzen. Position ' + (i + 1) + ' von ' + v.length + '.');
    g.setAttribute('aria-pressed', armed === id ? 'true' : 'false');
    up.disabled = i <= 0; dn.disabled = i < 0 || i >= v.length - 1;
    up.setAttribute('aria-label', n + ' nach vorn'); dn.setAttribute('aria-label', n + ' nach hinten');
    ey.setAttribute('aria-label', n + ' anzeigen'); ey.setAttribute('aria-pressed', 'true'); ey.title = 'Ausblenden';
    el.classList.toggle('hm-armed', armed === id);
  }

  // ---------- Reihenfolge ändern ----------
  function moveTo(id, targetId, before) {
    if (id === targetId) return false;
    const old = st.order.join('|');
    st.order = st.order.filter(i => i !== id);
    const p = st.order.indexOf(targetId); if (p < 0) { st.order.push(id); } else st.order.splice(before ? p : p + 1, 0, id);
    if (st.order.join('|') === old) return false;
    return true;
  }
  function step(id, dir) {
    const v = visIds(), i = v.indexOf(id), j = i + dir; if (i < 0 || j < 0 || j >= v.length) return;
    moveTo(id, v[j], dir < 0); save(); render();
    const e = byId(id); if (e) { const g = e.querySelector('.hm-grip'); if (g) g.focus({ preventScroll: true }); e.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    announce(nameOf(e) + ' ist jetzt an Position ' + (visIds().indexOf(id) + 1) + ' von ' + v.length + '.');
  }
  function setHidden(id, hide) {
    const k = st.hidden.indexOf(id);
    if (hide && k < 0) st.hidden.push(id); if (!hide && k >= 0) st.hidden.splice(k, 1);
    save(); render();
  }

  // ---------- Drag and Drop mit Pointer-Ereignissen ----------
  function targetAt(x, y, skip) {
    let best = null, bd = 1e12;
    cardEls().forEach(e => {
      if (e === skip || e.classList.contains('hm-hid')) return;
      const r = e.getBoundingClientRect(); if (!r.width) return;
      const dx = Math.max(r.left - x, 0, x - r.right), dy = Math.max(r.top - y, 0, y - r.bottom), d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = { el: e, r: r }; }
    });
    if (!best) return null;
    const r = best.r, cx = r.left + r.width / 2, cy = r.top + r.height / 2, cr = cards.getBoundingClientRect();
    const rowSame = Math.abs(y - cy) <= r.height / 2, wide = r.width > cr.width * 0.8;
    best.before = wide ? y < cy : (rowSame ? x < cx : y < cy);
    best.wide = wide;
    return best;
  }
  function showMark(t) {
    const m = ui.mark; if (!t) { m.style.display = 'none'; return; }
    const r = t.r; m.style.display = 'block';
    if (t.wide) { m.style.left = r.left + 'px'; m.style.width = r.width + 'px'; m.style.height = '6px'; m.style.top = (t.before ? r.top - 9 : r.bottom + 3) + 'px'; }
    else { m.style.top = r.top + 'px'; m.style.height = r.height + 'px'; m.style.width = '6px'; m.style.left = (t.before ? r.left - 9 : r.right + 3) + 'px'; }
  }
  function startDrag(card, e) {
    if (drag) return;
    const r = card.getBoundingClientRect();
    const g = card.cloneNode(true); g.className = 'card hm-ghost'; g.removeAttribute('data-lab'); g.setAttribute('aria-hidden', 'true');
    g.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
    g.style.cssText = 'left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px';
    doc.body.appendChild(g);
    card.classList.add('hm-dragging'); doc.documentElement.classList.add('hm-isdrag');
    drag = { card: card, id: idOf(card), ghost: g, pid: e.pointerId, ox: e.clientX - r.left, oy: e.clientY - r.top, x: e.clientX, y: e.clientY, t: null, vy: 0, raf: 0, grip: e.target };
    try { e.target.setPointerCapture(e.pointerId); } catch (_) {}
    moveDrag();
  }
  function moveDrag() {
    const d = drag; if (!d) return;
    d.ghost.style.left = (d.x - d.ox) + 'px'; d.ghost.style.top = (d.y - d.oy) + 'px';
    const h = innerHeight, z = Math.min(90, h * 0.2);
    d.vy = d.y < z ? -Math.ceil((z - d.y) / z * 22) : d.y > h - z ? Math.ceil((d.y - (h - z)) / z * 22) : 0;
    if (d.vy && !d.raf) d.raf = setTimeout(scrollLoop, 16);
    d.t = targetAt(d.x, d.y, d.card); showMark(d.t);
  }
  function scrollLoop() {
    const d = drag; if (!d) return; d.raf = 0;
    if (d.vy) { scrollBy(0, d.vy); d.t = targetAt(d.x, d.y, d.card); showMark(d.t); d.raf = setTimeout(scrollLoop, 16); }
  }
  function endDrag(commit) {
    const d = drag; if (!d) return; drag = null;
    if (d.raf) clearTimeout(d.raf);
    d.ghost.remove(); d.card.classList.remove('hm-dragging'); doc.documentElement.classList.remove('hm-isdrag'); showMark(null);
    try { d.grip.releasePointerCapture(d.pid); } catch (_) {}
    if (commit && d.t && moveTo(d.id, idOf(d.t.el), d.t.before)) {
      save(); render(); announce(nameOf(d.card) + ' verschoben auf Position ' + (visIds().indexOf(d.id) + 1) + ' von ' + visIds().length + '.');
    }
    const gp = d.card.querySelector('.hm-grip'); if (gp) gp.focus({ preventScroll: true });
  }
  addEventListener('pointermove', e => { if (drag && e.pointerId === drag.pid) { e.preventDefault(); drag.x = e.clientX; drag.y = e.clientY; moveDrag(); } }, { passive: false });
  addEventListener('pointerup', e => { if (drag && e.pointerId === drag.pid) endDrag(true); });
  addEventListener('pointercancel', e => { if (drag && e.pointerId === drag.pid) endDrag(false); });
  addEventListener('keydown', e => { if (drag && e.key === 'Escape') endDrag(false); });

  // ---------- Bearbeitungsmodus ----------
  function setEdit(on) {
    edit = on; showAll = false; armed = '';
    ui.editBtn.hidden = on; ui.panel.hidden = !on; ui.editBtn.setAttribute('aria-expanded', on ? 'true' : 'false');
    ui.confirm.hidden = true; ui.reset.hidden = false;
    if (!on) { endDrag(false); cardEls().forEach(e => { const c = e.querySelector(':scope>.hm-ctl'); if (c) c.remove(); e.classList.remove('hm-armed'); }); }
    let seen = false; try { seen = localStorage.getItem(SEEN) === '1'; } catch (e) {}
    ui.hint.hidden = !on || seen;
    render();
    if (on) { ui.done.focus({ preventScroll: true }); ui.panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); announce('Bearbeitungsmodus an. ' + visIds().length + ' Labs sichtbar.'); }
    else { ui.editBtn.focus({ preventScroll: true }); announce('Bearbeitungsmodus beendet.'); }
  }

  function watch() { if (obs && cards) obs.observe(cards, { childList: true }); }

  const CSS = '.hm-bar[hidden],.hm-panel[hidden],.hm-confirm[hidden],.hm-hint[hidden],.hm-allp[hidden],.hm-btn[hidden],.hm-editbtn[hidden]{display:none!important}.hm-bar{display:flex;justify-content:flex-end;margin:-4px 0 10px}'
    + '.hm-editbtn{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 16px;border-radius:12px;border:1px solid var(--accent);background:rgba(59,158,255,.12);color:var(--fg);font:600 15px/1 system-ui,sans-serif;cursor:pointer}.hm-editbtn:hover{background:rgba(59,158,255,.22)}'
    + '.hm-editbtn svg{width:20px;height:20px}'
    + '.hm-panel{border:1px solid var(--accent);background:var(--panel);border-radius:14px;padding:12px 14px;margin:0 0 12px;display:flex;flex-direction:column;gap:10px}'
    + '.hm-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.hm-row b{font-size:16px}.hm-row .hm-sub{flex:1;min-width:200px;color:var(--mute);font-size:13px}'
    + '.hm-btn{min-height:44px;padding:0 18px;border-radius:12px;border:1px solid var(--line);background:var(--panel2);color:var(--fg);font:600 15px system-ui,sans-serif;cursor:pointer}.hm-btn.pri{background:var(--accent);border-color:var(--accent);color:#fff}.hm-btn.dng{border-color:var(--danger);color:var(--danger)}'
    + '.hm-hint{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:10px 12px;border-radius:12px;background:rgba(59,158,255,.12);border:1px solid var(--accent);font-size:14px}.hm-hint span{flex:1;min-width:200px}'
    + '.hm-confirm{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:10px 12px;border-radius:12px;border:1px solid var(--danger);background:rgba(255,92,92,.1)}.hm-confirm span{flex:1;min-width:200px;font-size:14px}'
    + '.hm-hidbox{border:1px solid var(--line);border-radius:12px;background:var(--bg)}.hm-hidbox>summary{min-height:44px;display:flex;align-items:center;padding:0 14px;cursor:pointer;font-weight:600;list-style:none}.hm-hidbox>summary::-webkit-details-marker{display:none}.hm-hidbox>summary::before{content:"▸";margin-right:8px;transition:transform .15s}.hm-hidbox[open]>summary::before{transform:rotate(90deg)}'
    + '.hm-hidlist{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:8px;padding:0 12px 12px}.hm-none{margin:0;color:var(--mute);font-size:14px}'
    + '.hm-show{display:flex;align-items:center;gap:10px;min-height:48px;padding:6px 12px;border-radius:12px;border:1px dashed var(--line);background:var(--panel);color:var(--fg);font:inherit;text-align:left;cursor:pointer}.hm-show:hover{border-color:var(--accent)}.hm-show b{display:block;font-size:14px}.hm-show small{display:block;color:var(--mute);font-size:12px}.hm-show .hm-act{margin-left:auto;color:var(--accent);font-size:13px;font-weight:600}.hm-plus{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:var(--accent);color:#fff;font-weight:700;flex:none}'
    + '.hm-chip{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 14px;border-radius:12px;border:1px solid var(--line);background:var(--panel2);color:var(--fg);font:600 14px system-ui,sans-serif;cursor:pointer}.hm-chip[aria-pressed=false]{opacity:.65;border-style:dashed}'
    + '.hm-ctl{display:flex;gap:6px;align-items:center;margin:-4px -4px 0}.hm-sp{flex:1}'
    + '.hm-ctl button{min-width:44px;min-height:44px;border-radius:11px;border:1px solid var(--line);background:var(--panel2);color:var(--fg);font:600 14px system-ui,sans-serif;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 10px}.hm-ctl button:disabled{opacity:.35;cursor:default}'
    + '.hm-ctl .hm-grip{cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none;border-color:var(--accent);padding:0 14px}.hm-ctl .hm-grip[aria-pressed=true]{background:var(--accent);color:#fff}'
    + '.hm-editing .card{outline:2px dashed rgba(59,158,255,.55);outline-offset:2px;margin-left:6px;margin-right:2px;cursor:default}.hm-editing .card .btns{opacity:.45;pointer-events:none}'
    + '.hm-editing .card:focus-within{outline-style:solid}.hm-ctl button:focus-visible,.hm-btn:focus-visible,.hm-chip:focus-visible,.hm-show:focus-visible,.hm-editbtn:focus-visible,.hm-hidbox>summary:focus-visible{outline:3px solid #ffe14d;outline-offset:2px}'
    + '.card.hm-hid{display:none!important}.card.hm-dragging{opacity:.35;outline-color:var(--accent)}.card.hm-armed{box-shadow:0 0 0 3px #ffe14d}'
    + '.hm-ghost{position:fixed!important;z-index:1000;margin:0!important;pointer-events:none;opacity:.94;transform:scale(1.03) rotate(1.2deg);box-shadow:0 14px 34px rgba(0,0,0,.6);outline:2px solid var(--accent)!important;outline-offset:0!important}.hm-ghost .btns{opacity:.4}'
    + '.hm-mark{position:fixed;display:none;z-index:999;background:#ffe14d;border-radius:3px;box-shadow:0 0 10px #ffe14d;pointer-events:none}'
    + 'html.hm-isdrag,html.hm-isdrag *{cursor:grabbing!important;user-select:none!important;-webkit-user-select:none!important}'
    + '.hm-allp{text-align:center;margin:14px 0 0}.hm-allp a{color:var(--accent);display:inline-block;padding:12px 8px}'
    + '.hm-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}'
    + '@media(max-width:639px){.hm-bar{justify-content:stretch}.hm-editbtn{width:100%;justify-content:center}.hm-ctl .hm-grip{padding:0 10px}}';

  function init() {
    cards = doc.querySelector('.cards'); if (!cards || doc.getElementById('hmBar')) return;
    const style = doc.createElement('style'); style.textContent = CSS; doc.head.appendChild(style);
    ui.secStyle = doc.createElement('style'); doc.head.appendChild(ui.secStyle);
    const bar = doc.createElement('div'); bar.id = 'hmBar'; bar.className = 'hm-bar';
    bar.innerHTML = '<button type="button" class="hm-editbtn" id="hmEdit" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M13 7l4 4" stroke="currentColor" stroke-width="2"/></svg>Startseite anpassen</button>';
    const panel = doc.createElement('section'); panel.id = 'hmPanel'; panel.className = 'hm-panel'; panel.hidden = true; panel.setAttribute('aria-label', 'Startseite anpassen');
    panel.innerHTML = '<div class="hm-row"><b>Startseite anpassen</b><span class="hm-sub">Verschiebe die Karten mit dem Griff ☰ oder den Pfeilen ▲ ▼. Mit dem Auge blendest du ein Lab aus.</span><button type="button" class="hm-btn pri" id="hmDone">Fertig</button><button type="button" class="hm-btn dng" id="hmReset">Zurücksetzen auf Standard</button></div>'
      + '<div class="hm-confirm" id="hmConfirm" hidden role="alertdialog" aria-label="Zurücksetzen bestätigen"><span>Soll deine Reihenfolge wirklich auf den Standard zurückgesetzt werden? Alle ausgeblendeten Labs kommen zurück.</span><button type="button" class="hm-btn dng" id="hmYes">Ja, zurücksetzen</button><button type="button" class="hm-btn" id="hmNo">Abbrechen</button></div>'
      + '<div class="hm-hint" id="hmHint" hidden><span>Ziehe die Karten an den Griffen oder nutze die Pfeile. Das Auge blendet ein Lab aus. Nur auf diesem Gerät gespeichert.</span><button type="button" class="hm-btn" id="hmOk">Verstanden</button></div>'
      + '<details class="hm-hidbox" id="hmHidBox"><summary id="hmHidSum">Ausgeblendete Labs (0)</summary><div class="hm-hidlist" id="hmHidList"></div></details>'
      + '<div class="hm-row"><b>Weitere Bereiche</b><span id="hmSecRow" class="hm-row"></span></div>';
    cards.parentNode.insertBefore(bar, cards); cards.parentNode.insertBefore(panel, cards);
    const allp = doc.createElement('p'); allp.className = 'hm-allp'; allp.hidden = true; allp.innerHTML = '<a href="#" id="hmAllA"></a>';
    cards.insertAdjacentElement('afterend', allp);
    const mark = doc.createElement('div'); mark.className = 'hm-mark'; mark.setAttribute('aria-hidden', 'true'); doc.body.appendChild(mark);
    const live = doc.createElement('div'); live.className = 'hm-live'; live.setAttribute('aria-live', 'polite'); live.setAttribute('role', 'status'); doc.body.appendChild(live);
    const g = id => doc.getElementById(id);
    ui = { secStyle: ui.secStyle, panel: panel, editBtn: g('hmEdit'), done: g('hmDone'), reset: g('hmReset'), confirm: g('hmConfirm'), hint: g('hmHint'), hidSum: g('hmHidSum'), hidList: g('hmHidList'), hidBox: g('hmHidBox'), secRow: g('hmSecRow'), allLink: allp, allA: g('hmAllA'), mark: mark, live: live };

    st = load();
    obs = new MutationObserver(() => { if (!drag) render(); }); watch();
    // Standard = Reihenfolge der Datei (Ausgangs-DOM), bevor die gespeicherte Reihenfolge angewendet wird
    defaults = cardEls().map(idOf);
    render();

    ui.editBtn.addEventListener('click', () => setEdit(true));
    ui.done.addEventListener('click', () => setEdit(false));
    ui.reset.addEventListener('click', () => { ui.confirm.hidden = false; ui.reset.hidden = true; g('hmYes').focus(); });
    g('hmNo').addEventListener('click', () => { ui.confirm.hidden = true; ui.reset.hidden = false; ui.reset.focus(); });
    g('hmYes').addEventListener('click', () => {
      st = { order: defaults.slice(), hidden: [] }; armed = ''; save(); ui.confirm.hidden = true; ui.reset.hidden = false; render(); ui.reset.focus(); announce('Startseite auf Standard zurückgesetzt.');
    });
    g('hmOk').addEventListener('click', () => { try { localStorage.setItem(SEEN, '1'); } catch (e) {} ui.hint.hidden = true; ui.done.focus(); });
    ui.allA.addEventListener('click', e => { e.preventDefault(); showAll = !showAll; render(); });
    ui.hidList.addEventListener('click', e => {
      const b = e.target.closest('.hm-show'); if (!b) return; const id = b.dataset.id;
      setHidden(id, false); const c = byId(id); announce(nameOf(c) + ' wird wieder angezeigt.');
      const gp = c && c.querySelector('.hm-grip'); if (gp) { gp.focus({ preventScroll: true }); c.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    });
    ui.secRow.addEventListener('click', e => { const b = e.target.closest('.hm-chip'); if (!b) return; const id = b.dataset.sec; setHidden(id, !isHid(id)); const nb = ui.secRow.querySelector('[data-sec="' + id + '"]'); if (nb) nb.focus(); });

    cards.addEventListener('click', e => {
      if (!edit) return;
      if (e.target.closest('a')) { e.preventDefault(); return; }
      const card = e.target.closest('.card'); if (!card) return; const id = idOf(card);
      if (e.target.closest('.hm-up')) step(id, -1);
      else if (e.target.closest('.hm-dn')) step(id, 1);
      else if (e.target.closest('.hm-eyeb')) {
        const v = visIds(), i = v.indexOf(id), nxt = v[i + 1] || v[i - 1]; setHidden(id, true);
        announce(nameOf(card) + ' ausgeblendet. Du findest es unter Ausgeblendete Labs.');
        const t = nxt && byId(nxt), tb = t && t.querySelector('.hm-eyeb'); (tb || ui.hidSum).focus({ preventScroll: true });
      }
    });
    cards.addEventListener('pointerdown', e => {
      if (!edit) return; const gr = e.target.closest('.hm-grip'); if (!gr) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault(); startDrag(gr.closest('.card'), e);
    });
    cards.addEventListener('keydown', e => {
      if (!edit) return; const gr = e.target.closest('.hm-grip'); if (!gr) return;
      const card = gr.closest('.card'), id = idOf(card);
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault(); armed = armed === id ? '' : id; updateCtl(card);
        announce(armed ? nameOf(card) + ' aufgenommen. Mit den Pfeiltasten verschieben, mit der Leertaste ablegen.' : nameOf(card) + ' abgelegt.');
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); step(id, -1); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); step(id, 1); }
      else if (e.key === 'Escape' && armed) { armed = ''; updateCtl(card); }
    });
    cards.addEventListener('focusout', e => { const gr = e.target.closest && e.target.closest('.hm-grip'); if (gr && armed) { armed = ''; const c = gr.closest('.card'); if (c) updateCtl(c); } });
    window.Home = { get state() { return { order: st.order.slice(), hidden: st.hidden.slice() }; }, render: render };
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();
