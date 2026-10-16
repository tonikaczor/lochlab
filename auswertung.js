/* Ergebnis senden: Azubis erzeugen aus ihrem Fortschritt einen kurzen Text (Ergebnis-Code), den die Ausbilder in auswertung.html einsammeln.
   Alle Labs binden diese Datei ein. Der Code enthält nur Name, Aufgaben-Kürzel und Prozentzahlen. */
(function () {
  const get = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const b64 = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64 = s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
  /* beste Prozentzahl je Aufgabe, aus allen Labs dieses Geräts */
  function own() {
    const m = {};
    [get('sim.done', {}), get('lm4.tdone', {})].forEach(o => Object.keys(o).forEach(k => { const v = Math.round(+o[k] || 0); if (v > (m[k] || 0)) m[k] = v; }));
    return m;
  }
  /* Tipp-Stufen: 1 allgemeiner Tipp, 2 konkreter Hinweis, 3 Auflösung. Die höchste benutzte Stufe je Aufgabe wird mit abgegeben. */
  const hints = () => get('sim.hints', {});
  const hintSave = h => { try { localStorage.setItem('sim.hints', JSON.stringify(h)); } catch (e) {} };
  function hintReset(id) { const h = hints(); if (h[id]) { delete h[id]; hintSave(h); } }
  function hint(o) {
    const u = ui(), h = hints(), n = Math.min(3, (h[o.id] || 0) + 1); h[o.id] = n; hintSave(h);
    const E = s => esc(s);
    u.sheet('Tipp, Stufe ' + n + ' von 3', (b, close) => {
      let t = `<p style="margin-top:0"><b>Stufe 1:</b> ${E(o.hint || 'Gehe die Aufgabe Schritt für Schritt durch.')}</p>`;
      if (n >= 2) { let c = ''; try { c = o.concrete ? o.concrete() : ''; } catch (e) {} t += `<p><b>Stufe 2:</b> ${E(c || 'Vergleiche deine Schaltung noch einmal genau mit der Aufgabe.')}</p>`; }
      if (n >= 3) {
        if (o.reveal) { let r = ''; try { r = o.reveal(); } catch (e) {} t += `<p><b>Stufe 3:</b> ${E(r)}</p>`; }
        if (o.solution) t += '<p><b>Stufe 3:</b> Die Musterlösung wird als neues Projekt geöffnet, dein Stand bleibt gespeichert.</p><button class="btn pri" id="hSol">Musterlösung öffnen</button>';
      } else t += '<p class="hint2">Brauchst du mehr Hilfe? Tippe noch einmal auf „Tipp“ für die nächste Stufe. Dein Ausbilder sieht, wie viele Tipps du gebraucht hast.</p>';
      b.innerHTML = t;
      const s = b.querySelector('#hSol'); if (s) s.onclick = () => { close(); o.solution(); };
    });
  }
  function name() { try { return (localStorage.getItem('lm4.name') || '').trim(); } catch (e) { return ''; } }
  function ownHints(d) { const h = hints(), r = {}; Object.keys(d).forEach(k => { if (h[k]) r[k] = h[k]; }); return r; }
  function ownBadges() { return window.Badges ? window.Badges.earnedIds() : []; }
  function code() { const d = own(); return 'TFL1.' + b64(JSON.stringify({ n: name(), t: Date.now(), d, h: ownHints(d), b: ownBadges() })); }
  function parse(txt) {
    const out = [];
    (String(txt).match(/TFL1\.[A-Za-z0-9_-]+/g) || []).forEach(c => { try { const o = JSON.parse(unb64(c.slice(5))); if (o && o.d && typeof o.d === 'object') out.push(o); } catch (e) {} });
    return out;
  }
  /* QR-Code als SVG-Text (weißer Hintergrund mit Ruhezone, auch im Dunkelmodus lesbar) */
  function qrSvg(text) {
    if (!window.qrcode) return '';
    try { const q = window.qrcode(0, 'M'); q.addData(String(text), 'Byte'); q.make(); return q.createSvgTag({ cellSize: 4, margin: 4, scalable: true }); } catch (e) { return ''; }
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function ui() { return { sheet: (window.LabUI && window.LabUI.sheet) || window.sheet, toast: (window.LabUI && window.LabUI.toast) || window.toast || (() => {}) }; }
  /* Abgabe einer Aufgabe: Ergebnis-QR, den der Ausbilder in auswertung.html scannt */
  function handIn(id, pct, title) {
    const u = ui(), nm = name();
    if (!(pct > 0)) { u.toast('Prüfe zuerst deine Lösung, dann kannst du abgeben'); return; }
    if (!nm) { u.toast('Bitte zuerst deinen Namen eintragen (Startseite)'); return; }
    const c = 'TFL1.' + b64(JSON.stringify({ n: nm, t: Date.now(), d: { [id]: Math.round(pct) }, h: ownHints({ [id]: 1 }), b: ownBadges() })), svg = qrSvg(c);
    u.sheet('Abgeben', b => {
      b.innerHTML = `<p style="margin-top:0"><b>${esc(nm)}</b><br>${esc(title || id)}: <b>${Math.round(pct)} %</b></p>
        <p class="hint2">Halte dieses Bild dem Ausbilder zum Scannen hin. Danach ist deine Abgabe angekommen.</p>
        <div style="background:#fff;padding:8px;border-radius:12px;max-width:340px;margin:0 auto">${svg || '<p style="color:#000">QR-Code nicht verfügbar. Bitte den Code unten kopieren.</p>'}</div>
        <details style="margin-top:10px"><summary>Code als Text</summary><textarea readonly rows="3" style="width:100%;font:12px monospace;box-sizing:border-box">${esc(c)}</textarea></details>`;
    });
  }
  function openSend() {
    const sheet = (window.LabUI && window.LabUI.sheet) || window.sheet, toast = (window.LabUI && window.LabUI.toast) || window.toast || (() => {});
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const d = own(), n = Object.keys(d).length, full = Object.values(d).filter(v => v >= 100).length, c = code();
    sheet('Ergebnis senden', b => {
      b.innerHTML = `<p style="margin-top:0">${name() ? 'Name: <b>' + esc(name()) + '</b><br>' : '<b>Du hast noch keinen Namen gespeichert.</b> Er steht auf der Startseite (Name ändern).<br>'}Bearbeitete Aufgaben: <b>${n}</b>, davon vollständig richtig: <b>${full}</b></p>
        <p class="hint2">Kopiere diesen Ergebnis-Code und schicke ihn deinem Ausbilder (Teams, Mail oder Zettel). Er enthält nur deinen Namen und deine Prozentzahlen.</p>
        ${c.length <= 1100 && qrSvg(c) ? '<div style="background:#fff;padding:8px;border-radius:12px;max-width:340px;margin:0 auto 10px">' + qrSvg(c) + '</div>' : ''}
        <textarea id="ergCode" rows="4" readonly style="width:100%;font:12px monospace;box-sizing:border-box">${esc(c)}</textarea>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn pri" id="ergCopy">Code kopieren</button>${navigator.share ? '<button class="btn" id="ergShare">Teilen</button>' : ''}</div>`;
      const ta = b.querySelector('#ergCode');
      b.querySelector('#ergCopy').onclick = async () => { try { await navigator.clipboard.writeText(c); toast('Code kopiert'); } catch (e) { ta.select(); try { document.execCommand('copy'); toast('Code kopiert'); } catch (x) { toast('Bitte den Text markieren und kopieren'); } } };
      const sh = b.querySelector('#ergShare'); if (sh) sh.onclick = () => navigator.share({ title: 'Meine Ergebnisse', text: c }).catch(() => {});
      ta.addEventListener('focus', () => ta.select());
    });
  }
  window.Auswertung = { own, code, parse, openSend, handIn, qrSvg, name, hint, hintReset };
})();
