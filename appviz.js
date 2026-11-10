'use strict';
/* Tonfunk App-Werkstatt: Bilder und Politur (SVG und CSS, ohne Bibliotheken). Datei appviz.js, eingebunden NACH appwerk.js.
   Start         Fortschrittsring und Lernpfad (eine Kette pro Stufe) statt des dünnen Balkens. Liest nur den Stand "sim.done".
   Auftrag       Ring "n von 7 Bausteinen" über den Chips des Auftrag-Baukastens und der eigenen Prüfung (zeigt nur, was schon als Text dasteht).
   Werkstatt     Vorschau im Gerätrahmen mit Breitenangabe, Prüfwerte als Kacheln.
   Notizen       Übersichtskarte besser lesbar (Beschriftung mit Rand).
   Die Bilder hängen sich per MutationObserver an die Ansicht (#view); sie ändern keine Eingaben, keine Aufgaben und kommen im Reiter
   Aufgaben nicht vor (dort bleibt alles wie es ist, keine neuen Hinweise). Theme nur über CSS-Variablen, keine Animation.
   window.APP_VIZ bzw. module.exports: reine Funktionen für Tests. */
(function (root) {
  const fin = Number.isFinite;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const n2 = v => (fin(v) ? Math.round(v * 100) / 100 : 0);

  /* Ring: ok von total Teilen (Segmente), Mitte zeigt "ok/total" */
  function ring(ok, total, o) {
    o = o || {}; total = Math.max(1, total | 0); ok = Math.max(0, Math.min(total, ok | 0));
    const R = o.r || 30, S = o.size || 80, c = S / 2, gap = total > 1 ? Math.min(0.22, (Math.PI * 2 / total) * 0.35) : 0, step = Math.PI * 2 / total;
    let b = '';
    for (let i = 0; i < total; i++) {
      const a0 = -Math.PI / 2 + i * step + gap / 2, a1 = -Math.PI / 2 + (i + 1) * step - gap / 2, big = a1 - a0 > Math.PI ? 1 : 0;
      const x0 = c + R * Math.cos(a0), y0 = c + R * Math.sin(a0), x1 = c + R * Math.cos(a1), y1 = c + R * Math.sin(a1);
      b += `<path class="avseg${i < ok ? ' on' : ''}" d="M${n2(x0)} ${n2(y0)}A${R} ${R} 0 ${big} 1 ${n2(x1)} ${n2(y1)}"/>`;
    }
    b += `<text class="avnum" x="${c}" y="${c + 2}" text-anchor="middle">${ok}/${total}</text>`;
    if (o.label) b += `<text class="avsub" x="${c}" y="${c + 15}" text-anchor="middle">${esc(o.label)}</text>`;
    return `<svg class="avring" viewBox="0 0 ${S} ${S}" role="img" aria-label="${esc(o.aria || (ok + ' von ' + total))}">${b}</svg>`;
  }

  /* Lernpfad: rows = [{ name, items: [{ id, pct }] }] -> HTML-Liste, je Zeile eine Kette aus Stationen (fertig, begonnen, offen) */
  function path(rows) {
    rows = (rows || []).filter(r => r && r.items && r.items.length);
    if (!rows.length) return '';
    return '<ol class="avpath">' + rows.map(r => {
      const n = r.items.length, W = Math.max(60, 30 * n), done = r.items.filter(i => (i.pct || 0) >= 100).length;
      let g = n > 1 ? `<line class="avlink" x1="14" y1="14" x2="${W - 14}" y2="14"/>` : '';
      r.items.forEach((it, i) => {
        const x = 14 + (W - 28) * (n === 1 ? 0 : i / (n - 1)), p = it.pct || 0, st = p >= 100 ? 'ok' : p > 0 ? 'part' : 'open';
        g += `<circle class="avst ${st}" cx="${n2(x)}" cy="14" r="9"/>` + (st === 'ok' ? `<path class="avchk" d="M${n2(x - 4)} 14l3 3 5-6"/>` : st === 'part' ? `<path class="avhalf" d="M${n2(x)} 5a9 9 0 0 0 0 18z"/>` : '');
      });
      return `<li class="avrow"><span class="avcat">${esc(r.name)}</span><svg viewBox="0 0 ${W} 28" width="${W}" height="28" role="img" aria-label="${done} von ${n} geschafft">${g}</svg><span class="avcnt">${done}/${n}</span></li>`;
    }).join('') + '</ol>';
  }

  /* Prüfwerte als Kacheln: [{ label, value }] */
  function tiles(list) {
    list = (list || []).filter(x => x && x.label);
    if (!list.length) return '';
    return '<div class="avtiles">' + list.map(x => `<div class="avtile${String(x.value).length > 12 ? ' wide' : ''}"><b>${esc(x.value)}</b><span>${esc(x.label)}</span></div>`).join('') + '</div>';
  }

  const CSS = '.avprog .bar{display:none}'
    + '.avhead{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin:6px 0 10px}.avring{width:84px;height:84px;flex:none}'
    + '.avseg{fill:none;stroke:var(--panel2,#2c343e);stroke-width:7;stroke-linecap:round}.avseg.on{stroke:var(--ok,#4cd964)}'
    + '.avnum{font:700 17px system-ui,sans-serif;fill:var(--fg,#e8ecf0)}.avsub{font:10px system-ui,sans-serif;fill:var(--mute,#8d99a6)}'
    + '.avpath{list-style:none;margin:0;padding:0;flex:1;min-width:220px}.avrow{display:grid;grid-template-columns:minmax(80px,1fr) auto 36px;gap:8px;align-items:center;padding:4px 0;border-top:1px solid var(--line,#38424d)}.avrow:first-child{border-top:0}'
    + '.avcat{font-size:13px;font-weight:600}.avcnt{font-size:12px;color:var(--mute,#8d99a6);text-align:right}.avrow svg{max-width:100%}'
    + '.avlink{stroke:var(--line,#38424d);stroke-width:3;stroke-linecap:round}.avst{stroke-width:2}.avst.open{fill:var(--panel,#222830);stroke:var(--mute,#8d99a6)}.avst.part{fill:var(--panel,#222830);stroke:var(--warn,#ffb340)}.avst.ok{fill:var(--ok,#4cd964);stroke:var(--ok,#4cd964)}'
    + '.avhalf{fill:var(--warn,#ffb340)}.avchk{fill:none;stroke:var(--bg,#14181c);stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}'
    + '.avrub{display:flex;align-items:center;gap:12px;margin:2px 0 6px}.avrub .avring{width:64px;height:64px}.avcap{font-size:13px;color:var(--mute,#8d99a6)}.avrub .avnum{font-size:15px}'
    + '#wFrameBox.avdev{background:var(--panel2,#2c343e);border:1px solid var(--line,#38424d);border-radius:20px;padding:16px 10px}'
    + '#wFrameBox.avdev #wFrame{border-radius:10px;box-shadow:0 0 0 6px var(--bg,#14181c),0 0 0 7px var(--line,#38424d)}'
    + '.avdevcap{font-size:12px;color:var(--mute,#8d99a6);margin:0 0 6px}'
    + '.avtiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:8px;margin:6px 0}.avtile{display:flex;flex-direction:column;gap:2px;padding:8px 10px;border-radius:10px;background:var(--panel2,#2c343e);border:1px solid var(--line,#38424d);min-width:0}'
    + '.avtile b{font-size:16px;overflow-wrap:anywhere}.avtile span{font-size:11px;color:var(--mute,#8d99a6)}.avtile.wide{grid-column:span 2}'
    + '.kv.avgone{display:none}'
    + '#nGraph svg{background:var(--bg,#14181c)!important;border:1px solid var(--line,#38424d)}#nGraph svg text{paint-order:stroke;stroke:var(--bg,#14181c);stroke-width:3px;stroke-linejoin:round}';

  /* ============================================================ Anbindung (nur im Browser) */
  function boot() {
    if (typeof document === 'undefined') return;
    const view = document.getElementById('view'); if (!view) return;
    const st = document.createElement('style'); st.id = 'avStyle'; st.textContent = CSS; document.head.appendChild(st);
    const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
    const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || ''); return v == null ? d : v; } catch (e) { return d; } };
    const tab = () => { const b = $('#tabs .tab.on'); return b ? b.dataset.t : ''; };

    function startPath() {
      const card = $$('.card', view).find(c => { const h = c.querySelector('h3'); return h && /Fortschritt/.test(h.textContent); });
      if (!card || card.querySelector('.avhead')) return;
      const T = root.APP_TASKS || [], d = lsGet('sim.done', {}); if (!T.length) return;
      const cats = []; T.forEach(t => { if (!cats.includes(t.cat)) cats.push(t.cat); });
      const rows = cats.map(c => ({ name: c, items: T.filter(t => t.cat === c).map(t => ({ id: t.id, pct: +d[t.id] || 0 })) }));
      const n = T.filter(t => (+d[t.id] || 0) >= 100).length;
      card.classList.add('avprog');
      const bar = card.querySelector('.bar'), h = document.createElement('div'); h.className = 'avhead';
      h.innerHTML = ring(n, T.length, { label: 'Aufgaben', size: 84, r: 32, aria: n + ' von ' + T.length + ' Aufgaben geschafft' }) + path(rows);
      (bar || card.querySelector('h3')).insertAdjacentElement(bar ? 'beforebegin' : 'afterend', h);
    }
    function rubRing(box) {
      if (!box) return;
      const chips = $$('.chip', box); if (!chips.length) { const old = box.querySelector('.avrub'); if (old) old.remove(); return; }
      const sig = chips.map(c => (c.classList.contains('ok') ? 1 : 0)).join(''), old = box.querySelector('.avrub'); if (old && old.dataset.sig === sig) return;
      if (old) old.remove();
      const ok = chips.filter(c => c.classList.contains('ok')).length, d = document.createElement('div'); d.className = 'avrub'; d.dataset.sig = sig;
      d.innerHTML = ring(ok, chips.length, { size: 64, r: 25, aria: ok + ' von ' + chips.length + ' Bausteinen' }) + (box.id === 'fRub' ? '<span class="avcap">' + ok + ' von ' + chips.length + ' Bausteinen im Auftrag</span>' : '');
      box.insertBefore(d, box.firstChild);
    }
    function auftrag() {
      ['#fRub', '#cRes'].forEach(s => { const b = $(s, view); if (!b) return; if (!b.__av) { b.__av = true; new MutationObserver(() => rubRing(b)).observe(b, { childList: true }); } rubRing(b); });
    }
    function devCap() {
      const box = $('#wFrameBox'), fr = $('#wFrame'); if (!box || !fr) return;
      let cap = $('.avdevcap', view); if (!cap) { cap = document.createElement('p'); cap.className = 'avdevcap'; box.insertAdjacentElement('beforebegin', cap); }
      const on = $('[data-w].on', view), name = on ? on.textContent.trim() : '', w = Math.round(fr.getBoundingClientRect().width);
      cap.textContent = 'Vorschau ' + (name ? '(' + name + ') ' : '') + (w ? 'etwa ' + w + ' px breit' : '');
    }
    function werkstatt() {
      const box = $('#wFrameBox', view); if (box) box.classList.add('avdev');
      devCap();
      const m = $('#wMsg', view); if (m && !m.__av) { m.__av = true; new MutationObserver(kv).observe(m, { childList: true }); }
      kv();
    }
    function kv() {
      const m = $('#wMsg', view); if (!m) return; const el = m.querySelector('.kv:not(.avgone)'); if (!el) return;
      const parts = el.innerHTML.split(' · ').map(s => { const mm = s.match(/^\s*(.*?):\s*<b>([\s\S]*?)<\/b>/); return mm ? { label: mm[1].replace(/<[^>]*>/g, ''), value: mm[2].replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"') } : null; }).filter(Boolean);
      if (parts.length < 2) return; el.classList.add('avgone'); el.insertAdjacentHTML('beforebegin', tiles(parts));
    }
    let q = 0;
    function enhance() {
      const t = tab();
      if (t === 'start') startPath(); else if (t === 'auftrag') auftrag(); else if (t === 'werkstatt') werkstatt();   // Reiter Aufgaben: nichts
    }
    const go = () => { clearTimeout(q); q = setTimeout(() => { try { enhance(); } catch (e) { /* Bilder sind nur Zugabe */ } }, 0); };
    new MutationObserver(go).observe(view, { childList: true });
    view.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-w]')) setTimeout(devCap, 30); });
    window.addEventListener('resize', () => { if (tab() === 'werkstatt') devCap(); });
    enhance();
  }

  const API = { ring, path, tiles, CSS };
  root.APP_VIZ = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot(); }
})(typeof window !== 'undefined' ? window : globalThis);
