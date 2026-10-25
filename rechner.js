/* Tonfunk Lab: Rechner für die Ausbildung (Ohmsches Gesetz, Widerstandsfarbcode, LED-Vorwiderstand, Spannungsteiler, RC-Glied,
   Reihen- und Parallelschaltung, Leitung/Spannungsfall). Zum Ausprobieren und zur Selbstkontrolle bei Aufgaben. */
(function () {
'use strict';
const UI = () => window.LabUI || window.LabKeysAdapter;
const E12 = [1, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];
const COL = [['schwarz', '#111', 0], ['braun', '#7a4a21', 1], ['rot', '#d32f2f', 2], ['orange', '#f57c00', 3], ['gelb', '#fbc02d', 4], ['grün', '#388e3c', 5], ['blau', '#1976d2', 6], ['violett', '#7b1fa2', 7], ['grau', '#757575', 8], ['weiß', '#eee', 9]];
const MUL = [['schwarz', '#111', 1], ['braun', '#7a4a21', 10], ['rot', '#d32f2f', 100], ['orange', '#f57c00', 1e3], ['gelb', '#fbc02d', 1e4], ['grün', '#388e3c', 1e5], ['blau', '#1976d2', 1e6], ['gold', '#c9a227', 0.1], ['silber', '#b0b4b8', 0.01]];
const TOL = [['braun', '#7a4a21', 1], ['rot', '#d32f2f', 2], ['gold', '#c9a227', 5], ['silber', '#b0b4b8', 10]];
const num = s => { if (s == null) return NaN; let t = String(s).trim().replace(',', '.').replace(/\s+/g, ''); if (!t) return NaN; const m = t.match(/^([-+]?\d*\.?\d+)([pnuµmkMG]?)(?:[ΩVAFWHz]*)$/); if (!m) return NaN; const f = { p: 1e-12, n: 1e-9, u: 1e-6, 'µ': 1e-6, m: 1e-3, k: 1e3, M: 1e6, G: 1e9 }[m[2]] || 1; return parseFloat(m[1]) * f; };
const eng = (v, u) => { if (!isFinite(v)) return '–'; const a = Math.abs(v); const [d, p] = a >= 1e9 ? [1e9, 'G'] : a >= 1e6 ? [1e6, 'M'] : a >= 1e3 ? [1e3, 'k'] : a >= 1 || a === 0 ? [1, ''] : a >= 1e-3 ? [1e-3, 'm'] : a >= 1e-6 ? [1e-6, 'µ'] : [1e-9, 'n']; return (+(v / d).toPrecision(3)).toString().replace('.', ',') + ' ' + p + u; };
const ESC = s => (UI() ? UI().esc(s) : String(s));
const input = (id, label, ph, val) => `<label class="f" style="display:block;margin:6px 0"><span style="display:block;color:var(--mute,#8d99a6);font-size:12px">${ESC(label)}</span><input id="${id}" value="${ESC(val || '')}" placeholder="${ESC(ph || '')}" inputmode="decimal" style="width:100%;padding:9px 10px;border-radius:9px;border:1px solid var(--line,#38424d);background:var(--panel2,#2c343e);color:inherit;font-size:15px"></label>`;
const out = id => `<div id="${id}" style="margin-top:10px;padding:10px 12px;border-radius:10px;background:var(--panel2,#2c343e);line-height:1.6;min-height:2.4em"></div>`;
const g = (b, id) => b.querySelector('#' + id);
const wire = (b, ids, fn) => ids.forEach(i => { const e = g(b, i); if (e) e.addEventListener('input', fn); });

const TABS = [
  ['ohm', 'Ohm', b => {
    b.innerHTML = '<p style="margin-top:0;color:var(--mute)">Zwei Werte eintragen, die anderen werden berechnet. Mit k (Kilo), M (Mega), m (Milli), µ (Mikro): zum Beispiel 4,7k oder 20m.</p>' + input('oU', 'Spannung U in V') + input('oI', 'Strom I in A') + input('oR', 'Widerstand R in Ω') + input('oP', 'Leistung P in W') + out('oOut');
    const f = () => { let U = num(g(b, 'oU').value), I = num(g(b, 'oI').value), R = num(g(b, 'oR').value), P = num(g(b, 'oP').value); const n = [U, I, R, P].filter(x => !isNaN(x)).length; const o = g(b, 'oOut');
      if (n < 2) { o.textContent = 'Trage zwei Werte ein.'; return; }
      if (!isNaN(U) && !isNaN(I)) { R = U / I; P = U * I; } else if (!isNaN(U) && !isNaN(R)) { I = U / R; P = U * U / R; } else if (!isNaN(I) && !isNaN(R)) { U = I * R; P = I * I * R; } else if (!isNaN(U) && !isNaN(P)) { I = P / U; R = U * U / P; } else if (!isNaN(I) && !isNaN(P)) { U = P / I; R = P / (I * I); } else if (!isNaN(R) && !isNaN(P)) { U = Math.sqrt(P * R); I = Math.sqrt(P / R); }
      o.innerHTML = `U = <b>${eng(U, 'V')}</b><br>I = <b>${eng(I, 'A')}</b><br>R = <b>${eng(R, 'Ω')}</b><br>P = <b>${eng(P, 'W')}</b>`; };
    wire(b, ['oU', 'oI', 'oR', 'oP'], f); f();
  }],
  ['farbe', 'Farbcode', b => {
    const sel = (id, list, cur) => `<select id="${id}" style="padding:8px;border-radius:9px;border:1px solid var(--line,#38424d);background:var(--panel2,#2c343e);color:inherit">${list.map((c, i) => `<option value="${i}" ${i === cur ? 'selected' : ''}>${c[0]}</option>`).join('')}</select>`;
    b.innerHTML = `<p style="margin-top:0;color:var(--mute)">Ringe wählen (4 oder 5 Ringe), der Wert erscheint. Oder unten einen Wert eintragen, dann zeigt der Rechner die Ringe.</p>
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><span>Ringe:</span>${sel('c1', COL, 1)}${sel('c2', COL, 0)}<span id="c3w" style="display:none">${sel('c3', COL, 0)}</span>${sel('cm', MUL, 2)}${sel('ct', TOL, 2)}</div>
      <label style="display:flex;gap:6px;align-items:center;margin:8px 0"><input type="checkbox" id="c5"> 5 Ringe (3 Ziffern)</label><div id="cOut" style="padding:10px 12px;border-radius:10px;background:var(--panel2,#2c343e);line-height:1.7"></div>
      <hr style="border:0;border-top:1px solid var(--line);margin:14px 0">${input('cV', 'Wert eintragen, z. B. 4,7k oder 330', '', '')}<div id="cOut2" style="margin-top:8px"></div>`;
    const sw = (c, w) => `<span style="display:inline-block;width:${w || 14}px;height:30px;background:${c};border:1px solid #888;border-radius:3px;vertical-align:middle;margin:0 2px"></span>`;
    const f1 = () => { const five = g(b, 'c5').checked; g(b, 'c3w').style.display = five ? '' : 'none'; const a = +g(b, 'c1').value, c = +g(b, 'c2').value, d = five ? +g(b, 'c3').value : 0, m = MUL[+g(b, 'cm').value], t = TOL[+g(b, 'ct').value];
      const val = (five ? a * 100 + c * 10 + d : a * 10 + c) * m[2]; g(b, 'cOut').innerHTML = `${sw(COL[a][1])}${sw(COL[c][1])}${five ? sw(COL[d][1]) : ''}${sw(m[1])}${sw(t[1], 22)}<br><b>${eng(val, 'Ω')}</b> ± ${t[2]} %`; };
    const f2 = () => { const v = num(g(b, 'cV').value), o = g(b, 'cOut2'); if (!(v > 0)) { o.textContent = ''; return; } let e = Math.floor(Math.log10(v)) - 1, m = Math.round(v / Math.pow(10, e)); if (m >= 100) { m = Math.round(m / 10); e++; } const mi = MUL.findIndex(x => Math.abs(x[2] - Math.pow(10, e)) < 1e-9); if (mi < 0 || m < 10) { o.textContent = 'Dieser Wert lässt sich nicht mit 4 Ringen darstellen.'; return; } o.innerHTML = `${sw(COL[Math.floor(m / 10)][1])}${sw(COL[m % 10][1])}${sw(MUL[mi][1])}<br>${COL[Math.floor(m / 10)][0]}, ${COL[m % 10][0]}, ${MUL[mi][0]}`; };
    b.querySelectorAll('select,#c5').forEach(e => e.addEventListener('change', f1)); wire(b, ['cV'], f2); f1();
  }],
  ['led', 'LED-Vorwiderstand', b => {
    b.innerHTML = '<p style="margin-top:0;color:var(--mute)">Berechnet den Vorwiderstand für eine LED.</p>' + input('lU', 'Versorgungsspannung in V', '', '9') + input('lF', 'Spannungsabfall der LED in V (rot 2 V, grün 2,1 V, blau/weiß 3 V)', '', '2') + input('lI', 'Gewünschter Strom in mA', '', '15') + out('lOut');
    const f = () => { const U = num(g(b, 'lU').value), Uf = num(g(b, 'lF').value), I = num(g(b, 'lI').value) / 1000, o = g(b, 'lOut'); if (!(U > Uf) || !(I > 0)) { o.textContent = 'Die Versorgung muss größer sein als der Spannungsabfall der LED.'; return; }
      const R = (U - Uf) / I; let e = Math.pow(10, Math.floor(Math.log10(R))), best = null; [...E12, 10].forEach(x => { const v = x * e; if (v >= R && (best == null || v < best)) best = v; }); if (best == null) best = R * 1.1; const Ir = (U - Uf) / best;
      o.innerHTML = `Rechnerisch: <b>${eng(R, 'Ω')}</b><br>Nächster Normwert (E12, nicht kleiner): <b>${eng(best, 'Ω')}</b><br>Damit fließen <b>${(Ir * 1000).toFixed(1).replace('.', ',')} mA</b><br>Verlustleistung im Widerstand: ${eng(Ir * Ir * best, 'W')} (ein 0,25-W-Widerstand genügt${Ir * Ir * best > 0.25 ? ' NICHT' : ''})`; };
    wire(b, ['lU', 'lF', 'lI'], f); f();
  }],
  ['teiler', 'Spannungsteiler', b => {
    b.innerHTML = '<p style="margin-top:0;color:var(--mute)">U2 = U · R2 / (R1 + R2). Mit Last parallel zu R2 wird die Spannung kleiner.</p>' + input('tU', 'Eingangsspannung in V', '', '9') + input('t1', 'R1 in Ω', '', '1k') + input('t2', 'R2 in Ω', '', '2k') + input('tL', 'Last parallel zu R2 in Ω (leer = keine)', '', '') + out('tOut');
    const f = () => { const U = num(g(b, 'tU').value), R1 = num(g(b, 't1').value), R2 = num(g(b, 't2').value), RL = num(g(b, 'tL').value), o = g(b, 'tOut'); if (!(R1 > 0) || !(R2 > 0) || isNaN(U)) { o.textContent = 'Werte eintragen.'; return; }
      const U0 = U * R2 / (R1 + R2); let t = `Unbelastet: <b>${eng(U0, 'V')}</b>`; if (RL > 0) { const Rp = R2 * RL / (R2 + RL), UL = U * Rp / (R1 + Rp); t += `<br>Mit Last ${eng(RL, 'Ω')}: <b>${eng(UL, 'V')}</b>`; } t += `<br>Strom durch R1 (unbelastet): ${eng(U / (R1 + R2), 'A')}`; o.innerHTML = t; };
    wire(b, ['tU', 't1', 't2', 'tL'], f); f();
  }],
  ['rc', 'RC-Glied', b => {
    b.innerHTML = '<p style="margin-top:0;color:var(--mute)">Zeitkonstante τ = R · C und Grenzfrequenz fg = 1 / (2 · π · R · C).</p>' + input('rR', 'Widerstand R in Ω', '', '10k') + input('rC', 'Kapazität C in F', '', '100n') + out('rOut');
    const f = () => { const R = num(g(b, 'rR').value), C = num(g(b, 'rC').value), o = g(b, 'rOut'); if (!(R > 0) || !(C > 0)) { o.textContent = 'Werte eintragen.'; return; } const tau = R * C; o.innerHTML = `τ = <b>${eng(tau, 's')}</b><br>Nach 1 τ: 63 % geladen, nach 3 τ: 95 %, nach 5 τ: 99 %<br>Grenzfrequenz: <b>${eng(1 / (2 * Math.PI * tau), 'Hz')}</b>`; };
    wire(b, ['rR', 'rC'], f); f();
  }],
  ['rp', 'Reihe und Parallel', b => {
    b.innerHTML = '<p style="margin-top:0;color:var(--mute)">Widerstandswerte mit Leerzeichen getrennt eintragen.</p>' + input('pL', 'Widerstände in Ω', '', '1k 2,2k 470') + out('pOut');
    const f = () => { const v = g(b, 'pL').value.trim().split(/\s+/).map(num).filter(x => x > 0), o = g(b, 'pOut'); if (!v.length) { o.textContent = 'Werte eintragen.'; return; } o.innerHTML = `Reihenschaltung: <b>${eng(v.reduce((a, c) => a + c, 0), 'Ω')}</b><br>Parallelschaltung: <b>${eng(1 / v.reduce((a, c) => a + 1 / c, 0), 'Ω')}</b>`; };
    wire(b, ['pL'], f); f();
  }],
  ['kabel', 'Leitung', b => {
    b.innerHTML = '<p style="margin-top:0;color:var(--mute)">Spannungsfall und Belastbarkeit einer Kupferleitung (Hin- und Rückleiter).</p>' + input('kP', 'Leistung des Verbrauchers in W', '', '2000') + input('kU', 'Spannung in V', '', '230') + input('kL', 'Länge der Leitung (einfach) in m', '', '50') + input('kA', 'Querschnitt in mm²', '', '1,5') + out('kOut');
    const IZ = [[1.5, 16.5], [2.5, 23], [4, 30], [6, 38], [10, 52], [16, 70]];
    const f = () => { const P = num(g(b, 'kP').value), U = num(g(b, 'kU').value), L = num(g(b, 'kL').value), A = num(g(b, 'kA').value), o = g(b, 'kOut'); if (!(P > 0 && U > 0 && L > 0 && A > 0)) { o.textContent = 'Werte eintragen.'; return; }
      const I = P / U, R = 2 * 0.0178 * L / A, dU = I * R, pc = 100 * dU / U, iz = (IZ.filter(x => x[0] <= A).pop() || IZ[0])[1], ls = [6, 10, 13, 16, 20, 25, 32].filter(x => x >= I && x <= iz);
      o.innerHTML = `Strom: <b>${I.toFixed(1).replace('.', ',')} A</b><br>Leitungswiderstand (hin und zurück): ${eng(R, 'Ω')}<br>Spannungsfall: <b>${dU.toFixed(1).replace('.', ',')} V = ${pc.toFixed(1).replace('.', ',')} %</b> ${pc <= 3 ? '✓ (höchstens 3 % ist gut)' : '✗ zu viel, größeren Querschnitt wählen'}<br>Belastbarkeit etwa ${iz} A<br>Passender Automat: ${ls.length ? 'B' + ls.join(', B') : 'keiner (Leitung zu dünn)'}`; };
    wire(b, ['kP', 'kU', 'kL', 'kA'], f); f();
  }],
];

function open(first) {
  const ui = UI(); if (!ui) return;
  ui.sheet('Rechner', b => {
    b.innerHTML = `<div id="rTabs" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px"></div><div id="rBody"></div>`;
    const bar = b.querySelector('#rTabs'), body = b.querySelector('#rBody');
    const show = id => { bar.querySelectorAll('button').forEach(x => { x.style.background = x.dataset.id === id ? 'var(--accent,#3b9eff)' : 'var(--panel2,#2c343e)'; x.style.color = x.dataset.id === id ? '#fff' : 'inherit'; }); body.innerHTML = ''; TABS.find(t => t[0] === id)[2](body); };
    TABS.forEach(t => { const x = document.createElement('button'); x.dataset.id = t[0]; x.textContent = t[1]; x.style.cssText = 'padding:7px 12px;border-radius:9px;border:1px solid var(--line,#38424d);font-weight:600;font-size:13px'; x.onclick = () => show(t[0]); bar.appendChild(x); });
    show(first || 'ohm');
  });
}
window.Rechner = { open, num, eng };
})();
