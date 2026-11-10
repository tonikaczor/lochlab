'use strict';
/* Tonfunk Instandhaltungs-Lab: Visualisierungen (Lab-Kennung 'ins'), window.INS_VIZ, per Node testbar (module.exports).
   Reine SVG-Funktionen plus eine kleine DOM-Anbindung, die ohne Änderung an insui.js auskommt:
   - Reiter "Grundbegriffe": Karte "Badewannenkurve" (Ausfallrate über der Betriebszeit, Regler, Phase mit passender Maßnahme).
   - Reiter "Kennzahlen": zum Rechner passende Zeitstrahlen. MTBF (Betriebszeit mit Ausfällen), Verfügbarkeit (Betrieb und Stillstand
     im Wechsel), Ausfallkosten (Balken aus Stillstand, Lohn, Teilen). Sie reagieren live auf die Eingaben im Rechner.
   - Reiter "Wartungsplan": "Termine je Monat" aus den vom Azubi gesetzten Feldern (zeigt nur die eigene Eingabe, nie die Lösung).
   Aufgabenintegrität: Die Skizzen lesen nur die Eingabefelder des Rechners und die selbst gesetzten Plan-Felder, nie die Zufallsaufgaben
   und nie die Lösungsmarken (rot/gestrichelt) des Plans. Die Badewannenkurve ist qualitativ (keine Zahlen). Keine Animation.
   Farben nur über die CSS-Variablen des Labs. */
(function (root) {
  const C = root.INS_CORE || (typeof require !== 'undefined' ? require('./inscore.js') : null);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fin = v => typeof v === 'number' && isFinite(v);
  const p1 = v => (fin(v) ? v : 0).toFixed(1);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, fin(v) ? v : a));
  const de = (v, d) => (C && C.fmtDe) ? C.fmtDe(v, d) : String(v.toFixed(d)).replace('.', ',');
  const MON3 = (C && C.MON3) || ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

  /* ---------- Badewannenkurve ---------- */
  const B1 = 18, B2 = 70;   /* Phasengrenzen in % der Betriebszeit (qualitativ) */
  const PHASES = [
    { id: 'frueh', name: 'Frühausfälle', col: 'var(--warn)', range: [0, B1], text: 'Die Ausfallrate fällt. Schwache Teile, Fertigungs-, Montage- und Einstellfehler zeigen sich schon beim Einlaufen.', mass: 'Maßnahme: sorgfältig montieren, Probelauf und Einlaufphase, Fehler früh beheben.' },
    { id: 'zufall', name: 'Zufallsausfälle', col: 'var(--ok)', range: [B1, B2], text: 'Die Ausfallrate ist ungefähr konstant. Ausfälle kommen unregelmäßig, zum Beispiel durch Überlast, Verschmutzung oder Bedienfehler. Hier gilt MTBF = 1 : Ausfallrate.', mass: 'Maßnahme: Inspektion und Wartung, Zustand beobachten, bei Bedarf instand setzen.' },
    { id: 'verschleiss', name: 'Verschleißausfälle', col: 'var(--danger)', range: [B2, 100], text: 'Die Ausfallrate steigt wieder. Das Bauteil ist durch Abnutzung, Ermüdung oder Alterung am Ende seiner Lebensdauer.', mass: 'Maßnahme: Teil rechtzeitig vorbeugend tauschen, bevor es ausfällt (zeit- oder zustandsorientiert).' }
  ];
  const lam = { early: t => 0.9 * Math.exp(-t / 6), rand: () => 0.22, wear: t => 0.9 * Math.exp((t - 100) / 10) };
  const lamSum = t => lam.early(t) + lam.rand(t) + lam.wear(t);
  const phaseAt = t => (t < B1 ? PHASES[0] : t < B2 ? PHASES[1] : PHASES[2]);
  /* o: {t (Marke in % der Betriebszeit)} */
  function tubSvg(o) {
    o = o || {}; const t = clamp(+o.t, 0, 100), W = 440, H = 270, L = 40, R = 428, T = 14, B = 224, ym = 1.25, X = v => L + v / 100 * (R - L), Y = v => B - v / ym * (B - T);
    let s = `<rect class="iz-bg" width="${W}" height="${H}"/>`;
    PHASES.forEach(p => { const x0 = X(p.range[0]), x1 = X(p.range[1]), act = t >= p.range[0] && (t < p.range[1] || (p.range[1] === 100 && t <= 100)); s += `<rect x="${p1(x0)}" y="${T}" width="${p1(x1 - x0)}" height="${B - T}" fill="${p.col}" fill-opacity="${act ? 0.24 : 0.1}"/><text class="iz-pt${act ? ' act' : ''}" x="${p1((x0 + x1) / 2)}" y="${T + 14}" text-anchor="middle">${esc(p.name)}</text>`; });
    s += `<line class="iz-axl" x1="${L}" y1="${B}" x2="${R}" y2="${B}"/><line class="iz-axl" x1="${L}" y1="${T}" x2="${L}" y2="${B}"/>`;
    s += `<text class="iz-ax" x="${p1((L + R) / 2)}" y="${H - 18}" text-anchor="middle">Betriebszeit t</text><text class="iz-ax" transform="translate(13 ${p1((T + B) / 2)}) rotate(-90)" text-anchor="middle">Ausfallrate λ</text>`;
    s += `<text class="iz-ax" x="${L}" y="${H - 5}" text-anchor="start">Inbetriebnahme</text><text class="iz-ax" x="${R}" y="${H - 5}" text-anchor="end">Ende der Nutzungsdauer</text>`;
    const path = f => { let d = ''; for (let v = 0; v <= 100.001; v += 1) d += (d ? 'L' : 'M') + p1(X(v)) + ' ' + p1(Y(Math.min(f(v), ym))); return d; };
    s += `<path class="iz-c2" d="${path(lam.early)}" stroke="var(--warn)"/><path class="iz-c2" d="${path(lam.rand)}" stroke="var(--ok)"/><path class="iz-c2" d="${path(lam.wear)}" stroke="var(--danger)"/>`;
    s += `<path class="iz-cv" d="${path(lamSum)}"/>`;
    const my = Y(Math.min(lamSum(t), ym)), mx = X(t);
    s += `<line class="iz-d" x1="${p1(mx)}" y1="${p1(my)}" x2="${p1(mx)}" y2="${B}"/><circle class="iz-mk" cx="${p1(mx)}" cy="${p1(my)}" r="7"/>`;
    s += `<text class="iz-ax" x="${p1(X(62))}" y="${p1(Y(0.22) - 6)}" text-anchor="middle" style="fill:var(--ok)">Zufallsanteil</text>`;
    return { svg: `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Badewannenkurve: Ausfallrate über der Betriebszeit mit den Phasen Frühausfälle, Zufallsausfälle und Verschleißausfälle">${s}</svg>`, phase: phaseAt(t) };
  }

  /* ---------- Kennzahlen: Zeitstrahlen ---------- */
  /* MTBF: n Ausfälle in der Betriebszeit b (gleichmäßig gezeichnet) */
  function mtbfSvg(b, n) {
    if (!fin(b) || !fin(n) || b <= 0 || n < 0 || Math.floor(n) !== n) return '';
    const W = 440, H = 120, L = 14, R = 426, Y = 62, k = Math.min(n, 40);
    let s = `<rect class="iz-bg" width="${W}" height="${H}"/><rect x="${L}" y="${Y - 11}" width="${R - L}" height="22" rx="5" fill="var(--ok)" fill-opacity=".35" stroke="var(--ok)"/>`;
    const px = i => L + (i - 0.5) / Math.max(k, 1) * (R - L);
    for (let i = 1; i <= k; i++) s += `<path d="M${p1(px(i) - 5)} ${Y - 5} l10 10 m0 -10 l-10 10" stroke="var(--danger)" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
    s += `<text class="iz-ax" x="${L}" y="${Y + 28}">0 h</text><text class="iz-ax" x="${R}" y="${Y + 28}" text-anchor="end">${esc(de(b, b % 1 ? 1 : 0))} h Betriebszeit</text>`;
    if (k >= 2) { const a = px(1), c = px(2); s += `<path d="M${p1(a)} ${Y - 18} v-6 H${p1(c)} v6" fill="none" stroke="var(--hi)" stroke-width="1.6"/><text class="iz-hi" x="${p1(Math.max(a - 6, 8))}" y="${Y - 30}">Abstand zwischen Ausfällen ≈ MTBF</text>`; }
    else if (k === 1) s += `<text class="iz-hi" x="${W / 2}" y="${Y - 24}" text-anchor="middle">ein Ausfall: MTBF = ganze Betriebszeit</text>`;
    else s += `<text class="iz-hi" x="${W / 2}" y="${Y - 24}" text-anchor="middle">kein Ausfall: MTBF lässt sich nicht berechnen</text>`;
    s += `<text class="iz-ax" x="${W / 2}" y="${H - 8}" text-anchor="middle">${k} Ausfälle${n > 40 ? ' (nur 40 gezeichnet)' : ''}, gleichmäßig verteilt gezeichnet</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Zeitstrahl der Betriebszeit mit ${k} Ausfällen">${s}</svg>`;
  }
  /* Verfügbarkeit: Betrieb (MTBF) und Stillstand (MTTR) im Wechsel */
  function availSvg(m1, m2) {
    if (!fin(m1) || !fin(m2) || m1 <= 0 || m2 < 0) return '';
    const W = 440, H = 150, L = 14, R = 426, Y = 50, cyc = 3, tot = cyc * (m1 + m2), sc = (R - L) / tot, a = 100 * m1 / (m1 + m2);
    let s = `<rect class="iz-bg" width="${W}" height="${H}"/>`, x = L;
    for (let i = 0; i < cyc; i++) {
      const w1 = m1 * sc, w2 = Math.max(m2 * sc, m2 > 0 ? 2.5 : 0);
      s += `<rect x="${p1(x)}" y="${Y - 12}" width="${p1(w1)}" height="24" fill="var(--ok)" fill-opacity=".45" stroke="var(--ok)"/>`; x += w1;
      if (w2 > 0) { s += `<rect x="${p1(x)}" y="${Y - 12}" width="${p1(w2)}" height="24" fill="var(--danger)" stroke="var(--danger)"/>`; if (i === 0) s += `<line x1="${p1(x + w2 / 2)}" y1="${Y - 12}" x2="${p1(x + w2 / 2)}" y2="${Y - 24}" stroke="var(--danger)" stroke-width="1.4"/><text class="iz-bad" x="${p1(Math.min(x + w2 / 2 + 3, R))}" y="${Y - 27}" text-anchor="${x + w2 / 2 > R - 120 ? 'end' : 'start'}">Stillstand (MTTR)</text>`; x += w2; }
      if (i === 0) s += `<text class="iz-ok" x="${p1(L + w1 / 2)}" y="${Y + 4}" text-anchor="middle">Betrieb (MTBF)</text>`;
    }
    s += `<text class="iz-ax" x="${L}" y="${Y + 30}">drei Zyklen aus Betrieb und Stillstand</text>`;
    const bw = R - L; s += `<text class="iz-ax" x="${L}" y="${Y + 54}">Verfügbarkeit</text><rect x="${L}" y="${Y + 60}" width="${bw}" height="16" rx="4" fill="var(--danger)" fill-opacity=".35" stroke="var(--line)"/><rect x="${L}" y="${Y + 60}" width="${p1(bw * a / 100)}" height="16" rx="4" fill="var(--ok)" fill-opacity=".7"/><text class="iz-tx" x="${p1(Math.min(L + bw * a / 100 - 6, R - 6))}" y="${Y + 72}" text-anchor="end">${esc(de(a, 1))} %</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Betrieb und Stillstand im Wechsel, Verfügbarkeit ${esc(de(a, 1))} Prozent">${s}</svg>`;
  }
  /* Ausfallkosten: Balken aus Stillstand, Lohn, Ersatzteilen */
  function costSvg(st, kh, pe, rh, lo, te) {
    const a = st * kh, b = pe * rh * lo, c = te; if (![a, b, c].every(fin) || a < 0 || b < 0 || c < 0 || a + b + c <= 0) return '';
    const tot = a + b + c, W = 440, H = 112, L = 14, R = 426, Y = 36, sc = (R - L) / tot;
    const part = [[a, 'var(--danger)', 'Stillstand'], [b, 'var(--accent)', 'Lohn'], [c, 'var(--hi)', 'Teile']];
    let s = `<rect class="iz-bg" width="${W}" height="${H}"/>`, x = L, ly = 0;
    part.forEach(q => { const w = q[0] * sc; if (w <= 0) return; s += `<rect x="${p1(x)}" y="${Y}" width="${p1(w)}" height="26" fill="${q[1]}" fill-opacity=".8"/>`; if (w > 54) s += `<text class="iz-wt" x="${p1(x + w / 2)}" y="${Y + 17}" text-anchor="middle">${esc(q[2])}</text>`; x += w; });
    s += `<text class="iz-ax" x="${L}" y="${Y - 10}">Anteile an den Gesamtkosten</text>`;
    part.forEach((q, i) => { const px = L + i * 138; s += `<rect x="${px}" y="${Y + 40}" width="11" height="11" rx="2" fill="${q[1]}" fill-opacity=".8"/><text class="iz-tx" x="${px + 16}" y="${Y + 50}">${esc(q[2])} ${esc(de(q[0], 0))} €</text>`; });
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Ausfallkosten als Balken aus Stillstand, Lohn und Ersatzteilen">${s}</svg>`;
  }

  /* ---------- Wartungsplan: Termine je Monat ---------- */
  function loadSvg(counts) {
    if (!Array.isArray(counts) || counts.length !== 12) counts = new Array(12).fill(0);
    counts = counts.map(v => fin(v) && v > 0 ? Math.floor(v) : 0);
    const W = 440, H = 150, L = 26, R = 432, B = 112, T = 18, mx = Math.max(4, ...counts), bw = (R - L) / 12, Y = v => B - v / mx * (B - T), peak = Math.max(...counts);
    let s = `<rect class="iz-bg" width="${W}" height="${H}"/><line class="iz-axl" x1="${L}" y1="${B}" x2="${R}" y2="${B}"/>`;
    for (let v = 0; v <= mx; v += mx > 8 ? 4 : 2) s += `<line class="iz-gr" x1="${L}" x2="${R}" y1="${p1(Y(v))}" y2="${p1(Y(v))}"/><text class="iz-ax" x="${L - 5}" y="${p1(Y(v) + 3.5)}" text-anchor="end">${v}</text>`;
    counts.forEach((v, i) => {
      const x = L + i * bw + 4, w = bw - 8, hi = v > 0 && v === peak && peak > 1;
      if (v > 0) s += `<rect x="${p1(x)}" y="${p1(Y(v))}" width="${p1(w)}" height="${p1(B - Y(v))}" rx="3" fill="${hi ? 'var(--hi)' : 'var(--accent)'}" fill-opacity=".8"/><text class="iz-tx" x="${p1(x + w / 2)}" y="${p1(Y(v) - 4)}" text-anchor="middle">${v}</text>`;
      s += `<text class="iz-ax" x="${p1(x + w / 2)}" y="${B + 14}" text-anchor="middle">${esc(MON3[i])}</text>`;
    });
    s += `<text class="iz-ax" x="${W / 2}" y="${H - 6}" text-anchor="middle">Termine je Monat (nach deinen Eingaben)</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Säulen: Anzahl der Wartungstermine je Monat">${s}</svg>`;
  }

  /* ---------- DOM-Anbindung ---------- */
  const CSS = `
.iz-bg{fill:var(--panel2)}.iz-gr{stroke:var(--line);stroke-width:.7}.iz-axl{stroke:var(--mute);stroke-width:1.2}.iz-ax{fill:var(--mute);font:12px system-ui,sans-serif}.iz-tx{fill:var(--fg);font:700 12.5px system-ui,sans-serif}
.iz-pt{fill:var(--mute);font:600 12px system-ui,sans-serif}.iz-pt.act{fill:var(--fg)}
.iz-cv{fill:none;stroke:var(--fg);stroke-width:3;stroke-linejoin:round}.iz-c2{fill:none;stroke-width:1.5;stroke-dasharray:4 3;opacity:.85}
.iz-d{stroke:var(--mute);stroke-width:1.2;stroke-dasharray:4 3}.iz-mk{fill:var(--accent-bg);stroke:var(--panel2);stroke-width:2}
.iz-hi{fill:var(--hi);font:700 12.5px system-ui,sans-serif}.iz-ok{fill:var(--fg);font:700 12.5px system-ui,sans-serif}.iz-bad{fill:var(--danger);font:700 12.5px system-ui,sans-serif}.iz-wt{fill:var(--panel);font:700 12.5px system-ui,sans-serif}
.iz-fig{background:var(--panel2);border:1px solid var(--line);border-radius:12px;overflow:hidden;margin:8px 0}.iz-fig svg{display:block;width:100%;max-width:560px;height:auto;margin:0 auto}
.iz-fig svg text{-webkit-user-select:none;user-select:none}
.iz-c input[type=range]{width:100%;min-height:44px;margin:0;accent-color:var(--accent-bg)}
.iz-c label.iz-l{display:block;font-size:12.5px;color:var(--mute);margin:2px 0}
.iz-ph{border-left:4px solid var(--accent);background:var(--bg);border-radius:0 10px 10px 0;padding:8px 12px;font-size:14px;line-height:1.45;margin:6px 0}
.iz-ph b{display:block;margin-bottom:2px}
.iz-note{font-size:13px;color:var(--mute);line-height:1.45;margin:6px 0 0}
`;
  const ST = { t: 8 };
  function injectCss() { if (document.getElementById('insviz-css')) return; const st = document.createElement('style'); st.id = 'insviz-css'; st.textContent = CSS; document.head.appendChild(st); }
  function tubCard(view) {
    if (view.querySelector('.iz-tub') || !view.querySelector('.card')) return;
    const card = document.createElement('div'); card.className = 'card pl iz-c iz-tub';
    card.innerHTML = '<h4>Badewannenkurve: Wann fallen Teile aus?</h4><p class="hint2" style="margin:0 0 6px">Die Ausfallrate eines Bauteils verändert sich über seine Lebensdauer. Verschiebe den Regler und beobachte die Phase. Die Kurve ist qualitativ gezeichnet, es gibt keine Zahlenwerte.</p><label class="iz-l" for="izT">Betriebszeit: von der Inbetriebnahme bis zum Ende der Nutzungsdauer</label><input type="range" id="izT" min="0" max="100" step="1" value="' + ST.t + '" aria-label="Betriebszeit"><div class="iz-fig" data-izf></div><div class="iz-ph" data-izp></div><p class="iz-note">Gestrichelt: die drei Anteile (Früh-, Zufalls- und Verschleißausfälle). Die dicke Linie ist ihre Summe und sieht aus wie eine Badewanne. Das Bild ist ein Modell, echte Bauteile weichen ab.</p>';
    const paint = () => { const r = tubSvg({ t: ST.t }); card.querySelector('[data-izf]').innerHTML = r.svg; const p = card.querySelector('[data-izp]'); p.style.borderLeftColor = r.phase.col; p.innerHTML = '<b>' + esc(r.phase.name) + '</b>' + esc(r.phase.text) + '<br>' + esc(r.phase.mass); };
    card.querySelector('#izT').addEventListener('input', e => { ST.t = +e.target.value; paint(); }); paint();
    view.insertBefore(card, view.children[2] || null);
  }
  const num = v => { const x = C && C.parseDe ? C.parseDe(v) : parseFloat(String(v).replace(',', '.')); return typeof x === 'number' ? x : NaN; };
  function kennFigs(view) {
    const g = k => { const i = view.querySelector('input[data-kc="' + k + '"]'); return i ? num(i.value) : NaN; };
    const spec = [['b', 'mtbf', () => mtbfSvg(g('b'), g('n'))], ['m1', 'avail', () => availSvg(g('m1'), g('m2'))], ['st', 'cost', () => costSvg(g('st'), g('kh'), g('pe'), g('rh'), g('lo'), g('te'))]];
    spec.forEach(sp => {
      const inp = view.querySelector('input[data-kc="' + sp[0] + '"]'); if (!inp) return; const card = inp.closest('.card'); if (!card) return;
      let f = card.querySelector('[data-izk="' + sp[1] + '"]'); if (!f) { f = document.createElement('div'); f.className = 'iz-fig'; f.setAttribute('data-izk', sp[1]); card.appendChild(f); }
      const svg = sp[2](); f.style.display = svg ? '' : 'none'; if (f.dataset.sig !== svg) { f.dataset.sig = svg; f.innerHTML = svg; }
    });
  }
  function planLoad(view) {
    const grid = view.querySelector('.pgrid'); if (!grid) return; const counts = new Array(12).fill(0);
    view.querySelectorAll('.pc.on[data-pc]').forEach(b => { const j = +b.dataset.pc.split(':')[1]; if (j >= 0 && j < 12) counts[j]++; });
    let f = view.querySelector('[data-izk="load"]'); if (!f) { f = document.createElement('div'); f.className = 'iz-fig'; f.setAttribute('data-izk', 'load'); grid.parentNode.insertBefore(f, grid.nextSibling); }
    const svg = loadSvg(counts); if (f.dataset.sig !== svg) { f.dataset.sig = svg; f.innerHTML = svg; }
  }
  if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined' && C) {
    const start = () => {
      injectCss();
      const watch = (id, fn) => { const el = document.getElementById(id); if (!el) return; const run = () => { try { fn(el); } catch (e) {} }; new MutationObserver(run).observe(el, { childList: true }); run(); return el; };
      watch('begrView', tubCard);
      const k = watch('kennView', kennFigs); if (k) k.addEventListener('input', () => { try { kennFigs(k); } catch (e) {} });
      watch('planView', planLoad);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  }
  const API = { tubSvg, mtbfSvg, availSvg, costSvg, loadSvg, lamSum, PHASES, B1, B2 };
  root.INS_VIZ = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
