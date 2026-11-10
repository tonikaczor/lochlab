'use strict';
/* Tonfunk Buchführungs-Lab: Visualisierungen (inline-SVG, ohne Bibliotheken).
   Wird in buclab.html NACH bucui.js geladen und ergänzt per MutationObserver:
   Editor    -> Buchungssatz als T-Konten mit Pfeilen (Entwurf oder Journal-Eintrag wählbar), Bilanz-Waage aus den T-Konten, Merkbild „Auf welcher Seite steht was?“
   Beispiele -> unter jedem fertigen Buchungssatz das Pfeil-Bild
   Aufgaben und Trainer bleiben absichtlich ohne Grafik (keine Lösungen verraten).
   Farben nur über CSS-Variablen (Soll = Akzentfarbe, Haben = Orange wie im Editor). Bewegung entfällt.
   Der Journal-Stand wird aus localStorage (lm4.buc.ed) gelesen, nichts wird zusätzlich gespeichert.
   Export: window.BUC_VIZ bzw. module.exports (quelle/buc/test_bucviz.js). */
(function (root) {
  const C = root.BUC_CORE || (typeof require === 'function' ? require('./buccore.js') : null);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f1 = v => (Math.round(v * 10) / 10).toString();
  const fin = v => typeof v === 'number' && isFinite(v);
  const svg = (w, h, aria, body) => `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(aria)}">${body}</svg>`;
  const num = v => typeof v === 'number' ? v : C.parseDe(v);
  const money = v => fin(v) ? C.fmtDe(v, 2) : '?';
  const cut = (s, n) => s.length > n ? s.slice(0, n - 1) + '…' : s;

  /* ---------------------------------------------------------- T-Konto-Symbol */
  /* side: 'S' | 'H' | '' (nichts hervorheben); amt: Zahl oder NaN */
  function tGlyph(x, y, nr, side, amt) {
    const k = nr ? C.konto(nr) : null, w = 140;
    let s = k ? `<text x="${x + w / 2}" y="${y + 11}" text-anchor="middle" class="s11 b">${esc(k.nr)}</text><text x="${x + w / 2}" y="${y + 23}" text-anchor="middle" class="s10 m">${esc(cut(k.name, 24))}</text>`
      : `<text x="${x + w / 2}" y="${y + 17}" text-anchor="middle" class="s11 m">Konto wählen</text>`;
    if (side === 'S') s += `<rect x="${x}" y="${y + 28}" width="${w / 2}" height="38" class="cS"/>`;
    if (side === 'H') s += `<rect x="${x + w / 2}" y="${y + 28}" width="${w / 2}" height="38" class="cH"/>`;
    s += `<line x1="${x}" y1="${y + 28}" x2="${x + w}" y2="${y + 28}" class="tl"/><line x1="${x + w / 2}" y1="${y + 28}" x2="${x + w / 2}" y2="${y + 66}" class="tl"/>`;
    s += `<text x="${x + w / 4}" y="${y + 40}" text-anchor="middle" class="s9 m">Soll</text><text x="${x + 3 * w / 4}" y="${y + 40}" text-anchor="middle" class="s9 m">Haben</text>`;
    if (side) s += `<text x="${x + (side === 'S' ? w / 4 : 3 * w / 4)}" y="${y + 58}" text-anchor="middle" class="s12 b">${esc(money(amt))}</text>`;
    return s;
  }
  /* Buchungssatz: links Soll-Konten, rechts Haben-Konten, in der Mitte „an“ mit Pfeilen. lines: [{s,k,b}] */
  function bookingSvg(lines) {
    const S = lines.filter(l => l.s === 'S'), H = lines.filter(l => l.s === 'H'), rows = Math.max(S.length, H.length, 1);
    const top = 22, gap = 76, midY = top + (rows * gap - 10) / 2, mx = 180; let s = '';
    s += `<text x="76" y="13" text-anchor="middle" class="s12 b tS">Soll</text><text x="284" y="13" text-anchor="middle" class="s12 b tH">Haben</text>`;
    S.forEach((l, i) => { const y = top + i * gap, cy = y + 47; s += tGlyph(6, y, l.k, 'S', num(l.b)) + `<path d="M148 ${cy}L${mx - 16} ${f1(midY)}" class="pf"/>`; });
    H.forEach((l, i) => { const y = top + i * gap, cy = y + 47; s += tGlyph(214, y, l.k, 'H', num(l.b)) + `<path d="M${mx + 16} ${f1(midY)}L204 ${cy}" class="pf"/><path d="M212 ${cy}l-9 -5v10z" class="ah"/>`; });
    s += `<circle cx="${mx}" cy="${f1(midY)}" r="14" class="nd"/><text x="${mx}" y="${f1(midY + 4)}" text-anchor="middle" class="s12 b">an</text>`;
    const so = C.sums(lines), yEnd = top + rows * gap + 6;
    if (so.soll || so.haben) s += `<text x="180" y="${yEnd + 8}" text-anchor="middle" class="s11 ${so.diff === 0 ? 'tOk' : 'tBad'}">Soll ${esc(C.eur(so.soll))} · Haben ${esc(C.eur(so.haben))}${so.diff === 0 ? ' · ausgeglichen' : ' · Differenz ' + esc(C.eur(Math.abs(so.diff)))}</text>`;
    return svg(360, yEnd + 16, 'Buchungssatz: ' + S.length + ' Soll-Konto(en) an ' + H.length + ' Haben-Konto(en)', s);
  }

  /* ---------------------------------------------------------- Bilanz-Waage */
  /* Summen aus den T-Konten: Aktiva (A), Passiva (P), Ergebnis der noch nicht abgeschlossenen Erfolgskonten (Ertrag minus Aufwand) */
  function bilanzSums(tk) {
    const A = [], P = []; let er = 0, aw = 0, neg = false;
    tk.order.slice().sort().forEach(nr => {
      const t = tk.m[nr], k = C.konto(nr); if (!k) return;
      if (k.typ === 'A') { const v = C.rd2(t.sumS - t.sumH); if (v < 0) neg = true; else if (v > 0) A.push({ nr, name: k.name, v }); }
      else if (k.typ === 'P') { const v = C.rd2(t.sumH - t.sumS); if (v < 0) neg = true; else if (v > 0) P.push({ nr, name: k.name, v }); }
      else if (k.typ === 'Er') er += t.sumH - t.sumS;
      else if (k.typ === 'Aw') aw += t.sumS - t.sumH;
    });
    const erg = C.rd2(er - aw), sa = C.rd2(A.reduce((a, x) => a + x.v, 0)), sp = C.rd2(P.reduce((a, x) => a + x.v, 0));
    return { A, P, erg, neg, sa, sp };
  }
  function waageSvg(b) {
    const L = b.A.slice(), R = b.P.slice();
    if (b.erg > 0) R.push({ nr: '', name: 'Gewinn (offen)', v: b.erg, open: true }); else if (b.erg < 0) L.push({ nr: '', name: 'Verlust (offen)', v: -b.erg, open: true });
    const sl = C.rd2(L.reduce((a, x) => a + x.v, 0)), sr = C.rd2(R.reduce((a, x) => a + x.v, 0)), mx = Math.max(sl, sr);
    if (!(mx > 0)) return '';
    const diff = C.rd2(sl - sr), tilt = Math.max(-1, Math.min(1, diff / mx)), phi = -tilt * 12 * Math.PI / 180;
    const px = 180, py = 40, half = 120, ly = py + half * Math.sin(phi) * -1, ry = py + half * Math.sin(phi), lx = px - half * Math.cos(phi), rx = px + half * Math.cos(phi);
    let s = `<line x1="${px}" y1="${py}" x2="${px}" y2="228" class="st"/><rect x="130" y="226" width="100" height="6" rx="3" class="st2"/>`;
    s += `<line x1="${f1(lx)}" y1="${f1(ly)}" x2="${f1(rx)}" y2="${f1(ry)}" class="bm"/><circle cx="${px}" cy="${py}" r="6" class="pv"/>`;
    const pan = (cx, ey, items, cls, lab, sum) => {
      const py2 = ey + 96, scale = 70 / mx; let st = `<path d="M${f1(cx)} ${f1(ey)}L${f1(cx - 55)} ${f1(py2)}M${f1(cx)} ${f1(ey)}L${f1(cx + 55)} ${f1(py2)}" class="sg"/><line x1="${f1(cx - 60)}" y1="${f1(py2)}" x2="${f1(cx + 60)}" y2="${f1(py2)}" class="pn"/>`;
      let yy = py2;
      items.forEach(it => { const h = Math.max(13, it.v * scale); yy -= h; st += `<rect x="${f1(cx - 48)}" y="${f1(yy)}" width="96" height="${f1(h)}" class="c ${it.open ? 'cD' : cls}"/>`; if (h >= 13) st += `<text x="${f1(cx)}" y="${f1(yy + h / 2 + 3.5)}" text-anchor="middle" class="s9">${esc(cut(it.nr ? it.nr + ' ' + it.name : it.name, 17))}</text>`; });
      return st + `<text x="${f1(cx)}" y="${f1(py2 + 18)}" text-anchor="middle" class="s11 b">${lab}</text><text x="${f1(cx)}" y="${f1(py2 + 31)}" text-anchor="middle" class="s11">${esc(C.eur(sum))}</text>`;
    };
    s += pan(lx, ly, L, 'cS', 'Aktiva' + (b.erg < 0 ? ' + Verlust' : ''), sl) + pan(rx, ry, R, 'cH', 'Passiva' + (b.erg > 0 ? ' + Gewinn' : ''), sr);
    return { svg: svg(360, 250, diff === 0 ? 'Bilanz-Waage im Gleichgewicht: ' + C.eur(sl) : 'Bilanz-Waage nicht im Gleichgewicht, Differenz ' + C.eur(Math.abs(diff)), s), diff, sl, sr };
  }

  /* ---------------------------------------------------------- Merkbild: Seiten der Konten */
  function sidesSvg() {
    const P = [[0, 0, 'Aktivkonto', ['AB', 'Zugang (+)'], ['Abgang (−)', 'Endbestand']], [1, 0, 'Passivkonto', ['Abgang (−)', 'Endbestand'], ['AB', 'Zugang (+)']],
      [0, 1, 'Aufwandskonto', ['Aufwand'], ['Saldo an GuV']], [1, 1, 'Ertragskonto', ['Saldo an GuV'], ['Ertrag']]];
    let s = '';
    P.forEach(([cx, cy, t, a, b]) => {
      const x = 8 + cx * 178, y = 4 + cy * 124, w = 164;
      s += `<text x="${x + w / 2}" y="${y + 12}" text-anchor="middle" class="s12 b">${t}</text>`;
      s += `<rect x="${x}" y="${y + 20}" width="${w / 2}" height="84" class="cS"/><rect x="${x + w / 2}" y="${y + 20}" width="${w / 2}" height="84" class="cH"/>`;
      s += `<line x1="${x}" y1="${y + 36}" x2="${x + w}" y2="${y + 36}" class="tl"/><line x1="${x + w / 2}" y1="${y + 20}" x2="${x + w / 2}" y2="${y + 104}" class="tl"/>`;
      s += `<text x="${x + w / 4}" y="${y + 32}" text-anchor="middle" class="s10 b tS">Soll</text><text x="${x + 3 * w / 4}" y="${y + 32}" text-anchor="middle" class="s10 b tH">Haben</text>`;
      a.forEach((v, i) => { s += `<text x="${x + w / 4}" y="${y + 54 + i * 18}" text-anchor="middle" class="s10">${esc(v)}</text>`; });
      b.forEach((v, i) => { s += `<text x="${x + 3 * w / 4}" y="${y + 54 + i * 18}" text-anchor="middle" class="s10">${esc(v)}</text>`; });
    });
    return svg(360, 256, 'Auf welcher Seite stehen Anfangsbestand, Zugang, Abgang, Aufwand und Ertrag', s);
  }

  /* ---------------------------------------------------------- Stil */
  const CSS = `
.nv svg{display:block;width:100%;height:auto;max-width:560px;margin:4px auto 0;overflow:visible}
.nv svg text{fill:var(--fg);font:11px system-ui,-apple-system,"Segoe UI",sans-serif}
.nv svg .b{font-weight:700}.nv svg .m{fill:var(--mute)}.nv svg .s9{font-size:9.5px}.nv svg .s10{font-size:10px}.nv svg .s11{font-size:11px}.nv svg .s12{font-size:12px}
.nv svg .tS{fill:var(--accent)}.nv svg .tH{fill:var(--hi)}.nv svg .tOk{fill:var(--ok);font-weight:700}.nv svg .tBad{fill:var(--danger);font-weight:700}
.nv svg .c{stroke-width:1}
.nv svg .cS{fill:var(--accent);fill-opacity:.22;stroke:none}.nv svg .cH{fill:var(--hi);fill-opacity:.22;stroke:none}
.nv svg .c.cS{fill-opacity:.35;stroke:var(--accent)}.nv svg .c.cH{fill-opacity:.35;stroke:var(--hi)}.nv svg .c.cD{fill:var(--danger);fill-opacity:.35;stroke:var(--danger);stroke-dasharray:3 2}
.nv svg .tl{stroke:var(--fg);stroke-width:1.5}
.nv svg .pf{stroke:var(--mute);stroke-width:2;fill:none}.nv svg .ah{fill:var(--mute)}
.nv svg .nd{fill:var(--panel2);stroke:var(--mute)}
.nv svg .st{stroke:var(--mute);stroke-width:3}.nv svg .st2{fill:var(--mute)}.nv svg .bm{stroke:var(--fg);stroke-width:4;stroke-linecap:round}.nv svg .pv{fill:var(--fg)}
.nv svg .sg{stroke:var(--mute);stroke-width:1;fill:none}.nv svg .pn{stroke:var(--fg);stroke-width:3;stroke-linecap:round}
.nv .nvc{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 4px}
.nv .nvc .chip{min-height:44px;height:auto;min-width:44px;justify-content:center;padding:6px 12px}
.nv .nvc .chip.on{background:var(--accent-bg);border-color:var(--accent-bg);color:#fff}
.nv .nvx{margin:8px 0 0;font-size:14px;line-height:1.45}
.nv.nvbs{margin:4px 0 8px;padding:6px;background:var(--panel2);border:1px solid var(--line);border-radius:10px}
@media print{.nv{display:none!important}}`;

  /* Bilanz-Waage aus Journal und Anfangsbeständen (wie im Editor: nur gültige Anfangsbestände zählen) */
  function abMap(ab) { const m = {}; (ab || []).forEach(a => { const x = C.parseDe(a.b); if (a && a.k && C.konto(a.k) && fin(x) && x > 0 && C.normalSide(a.k)) m[a.k] = (m[a.k] || 0) + x; }); return m; }
  function waageFor(ed) {
    const j = (ed && Array.isArray(ed.j) ? ed.j : []), ab = abMap(ed && ed.ab);
    if (!j.length && !Object.keys(ab).length) return { empty: true };
    const b = bilanzSums(C.tkonten(j, ab));
    if (b.neg) return { neg: true };
    const w = waageSvg(b); return w || { empty: true };
  }

  const API = { tGlyph, bookingSvg, bilanzSums, waageSvg, waageFor, sidesSvg, abMap, CSS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.BUC_VIZ = API;
  if (typeof document === 'undefined' || !C) return;

  /* ---------------------------------------------------------- Einbau in die Seite (nur im Browser) */
  const $ = id => document.getElementById(id);
  const st = document.createElement('style'); st.id = 'nvCss'; st.textContent = CSS; document.head.appendChild(st);
  const readEd = () => { try { return JSON.parse(localStorage.getItem('lm4.buc.ed') || '{}') || {}; } catch (e) { return {}; } };
  function card(view, id, title, idx) {
    let c = $(id);
    if (!c || c.parentNode !== view) { c = document.createElement('div'); c.id = id; c.className = 'card pl nv'; c.innerHTML = '<h4></h4><div class="nvb"></div>'; const ref = idx != null ? view.children[idx] : null; ref ? view.insertBefore(c, ref) : view.appendChild(c); }
    c.firstChild.textContent = title; return c;
  }
  function watch(viewId, build) {
    const v = $(viewId); if (!v) return null; let t = 0;
    const run = () => { t = 0; mo.disconnect(); try { build(v); } catch (e) { if (root.console) console.warn('bucviz', e); } mo.observe(v, { childList: true, subtree: true }); };
    const later = () => { if (!t) t = setTimeout(run, 40); };
    const mo = new MutationObserver(later);
    ['input', 'change', 'click'].forEach(ev => v.addEventListener(ev, later));
    run(); return run;
  }
  const show = (c, html) => { c.style.display = html ? '' : 'none'; c.lastChild.innerHTML = html || ''; };

  /* Entwurf aus den Eingabefeldern des Editors lesen */
  function draftLines(v) {
    return [...v.querySelectorAll('.bl[data-bl]')].map(r => {
      const on = r.querySelector('[data-bv].on'), k = r.querySelector('select[data-bf="k"]'), b = r.querySelector('input[data-bf="b"]');
      return { s: on ? on.dataset.bv : 'S', k: k ? k.value : '', b: b ? C.parseDe(b.value) : NaN };
    });
  }
  const SEL = { i: 'auto' };   /* 'auto' | 'd' (Entwurf) | Journal-Index */
  watch('edView', v => {
    const ed = readEd(), J = Array.isArray(ed.j) ? ed.j.filter(b => b && Array.isArray(b.lines)) : [], D = draftLines(v), dHas = D.some(l => l.k);
    let pick = SEL.i; if (pick === 'auto' || (pick !== 'd' && !J[pick])) pick = dHas ? 'd' : J.length ? J.length - 1 : 'd';
    const c = card(v, 'nvBook', 'Grafik: Buchungssatz mit T-Konten und Pfeilen', 2);
    const lines = pick === 'd' ? D.filter(l => l.k || fin(l.b)) : J[pick].lines;
    const chips = `<div class="nvc" role="group" aria-label="Buchungssatz wählen"><button class="chip${pick === 'd' ? ' on' : ''}" data-nvb="d" aria-pressed="${pick === 'd'}">Entwurf</button>${J.map((_, i) => `<button class="chip${pick === i ? ' on' : ''}" data-nvb="${i}" aria-pressed="${pick === i}">${i + 1}</button>`).join('')}</div>`;
    show(c, (J.length ? chips : '') + (lines.length ? bookingSvg(lines) + '<p class="hint2">Der Betrag steht auf der Soll- (blau) bzw. Haben-Seite (orange) des Kontos. „Soll an Haben“: Die Soll-Konten werden belastet, die Haben-Konten ' + 'gutgeschrieben; beide Seiten sind gleich groß.</p>' : '<p class="hint2" style="margin:0">Wähle unten ein Konto, dann erscheint hier der Buchungssatz als Bild.</p>'));
    const w = card(v, 'nvWaage', 'Grafik: Bilanz-Waage aus den T-Konten');
    const wf = waageFor(ed);
    if (wf.empty) show(w, '<p class="hint2" style="margin:0">Sobald Buchungen oder Anfangsbestände vorhanden sind, zeigt die Waage Aktiva und Passiva.</p>');
    else if (wf.neg) show(w, '<p class="hint2" style="margin:0">Ein Bestandskonto steht auf der ungewöhnlichen Seite (zum Beispiel Bank im Haben). Trage die Anfangsbestände ein, dann zeigt die Waage die Bilanz.</p>');
    else show(w, wf.svg + `<p class="hint2">${wf.diff === 0 ? 'Gleichgewicht: Aktiva und Passiva sind gleich groß (Bilanzgleichung).' : 'Nicht im Gleichgewicht, Differenz ' + esc(C.eur(Math.abs(wf.diff))) + '. Das liegt oft an fehlenden Anfangsbeständen, zum Beispiel dem Eigenkapital.'} Orange gestrichelt: Ergebnis der noch nicht abgeschlossenen Erfolgskonten (Erträge minus Aufwendungen).</p>`);
    const m = card(v, 'nvSides', 'Merkbild: Auf welcher Seite steht was?');
    if (!m.lastChild.firstChild) m.lastChild.innerHTML = sidesSvg() + '<p class="hint2">Aktiv und Aufwand beginnen im Soll, Passiv und Ertrag im Haben. Der Saldo steht immer auf der kleineren Seite.</p>';
  });
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('#nvBook [data-nvb]'); if (!b) return;
    SEL.i = b.dataset.nvb === 'd' ? 'd' : +b.dataset.nvb;
  });
  /* Beispiele: Pfeil-Bild unter jedem Buchungssatz */
  watch('bspView', v => {
    const D = root.BUC_DATA; if (!D || !D.examples) return;
    [...v.querySelectorAll('.card')].forEach(cd => {
      const btn = cd.querySelector('[data-ex]'); if (!btn) return; const ex = D.examples.find(x => x.id === btn.dataset.ex); if (!ex) return;
      [...cd.querySelectorAll('.bsatz')].forEach((el, j) => {
        if (!ex.buchungen[j] || (el.nextElementSibling && el.nextElementSibling.classList.contains('nvbs'))) return;
        const d = document.createElement('div'); d.className = 'nv nvbs'; d.innerHTML = bookingSvg(ex.buchungen[j].lines); el.parentNode.insertBefore(d, el.nextSibling);
      });
    });
  });
})(typeof window !== 'undefined' ? window : globalThis);
