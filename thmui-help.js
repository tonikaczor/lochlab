'use strict';
/* Tonfunk Thermik-Lab: Tab "Lernen" (WP3b).
   15 ausklappbare Abschnitte mit SVG-Zeichnungen und "Probier es aus"-Knopf. Tabellen, Formeln und Zahlen kommen aus dem Kern (THM_CORE) und den Tabellen des Labs:
   Glossar aus glossary, Analogie aus analogie, Übergang aus mount.rthCK, Kühlkörper aus heatsinks, Lüfter und Einbaulage aus fan und orient, Fahnenpotenzial aus devices[..].tab,
   Formeln aus formulas (über explain, also immer gleich wie der Rechner), Tastenkürzel aus KEYS (thmui.js). Es gibt keine zweite Pflege von Formeln oder Tabellen (SPEC Regel 5 und 7);
   jede Zahl im Text wird hier aus einer Kernfunktion erzeugt (Regel 1). Symbole nur über sy() (THM_CORE.sym).
   Schnittstelle (SPEC 6.7): window.THM_UI_EXT.help.render(host, api); api.KEYS liefert die Tastenkürzel-Tabelle, sonst window.THM_KEYS. Reine Funktionen unter THM_UI_EXT.help.fn. */
(function (root) {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fin = v => typeof v === 'number' && isFinite(v);
  const CORE = () => root.THM_CORE;
  const fnum = (v, d) => (fin(v) ? (+v).toFixed(d == null ? 1 : d).replace('.', ',') : '–');
  const adig = v => { v = Math.abs(v); if (v === 0) return 0; return v >= 100 ? 0 : v >= 10 ? 1 : v >= 1 ? 2 : v >= 0.1 ? 3 : 4; };
  const fa = v => (fin(v) ? fnum(v, adig(v)) : '–');
  const pick = (o, keys) => { if (typeof o === 'number') return o; if (!o || typeof o !== 'object') return NaN; for (const k of keys) if (fin(o[k])) return o[k]; return NaN; };
  let A = null;
  const sy = k => { const C = CORE(); let r; if (C && typeof C.sym === 'function') { try { r = C.sym(k, A && A.symSet ? A.symSet() : undefined); } catch (e) { r = null; } } return typeof r === 'string' && r ? r : k; };
  const tpl = t => { const C = CORE(); try { return C && typeof C.tpl === 'function' ? C.tpl(String(t == null ? '' : t)) : String(t == null ? '' : t); } catch (e) { return String(t); } };
  const NOZ = '<p class="hint2" style="color:var(--warn)">Die Zahlen folgen, sobald der Rechenkern (thmcore.js) geladen ist.</p>';
  const tryf = (f, d) => { try { const r = f(); return r === undefined ? d : r; } catch (e) { return d; } };

  /* ============================================================ SVG-Helfer (Farben über Seitenvariablen, Schrift mindestens 12 px bei 360 Einheiten Breite) */
  const SV = (inner, label, vb) => `<svg class="dr" viewBox="${vb || '0 0 360 150'}" role="img" aria-label="${esc(label)}">${inner}</svg>`;
  const FILL = { fg: 'var(--fg)', mute: 'var(--mute)', acc: 'var(--accent)', warn: 'var(--warn)', ok: 'var(--ok)', bad: 'var(--danger)', panel: 'var(--panel2)' };
  /* Textbreite grob schätzen und die Schrift verkleinern, damit nichts über den Bildrand läuft (nie unter 12) */
  function TX(x, y, t, o) {
    o = o || {}; let s = o.s || 12.5; const w = String(t).length * s * 0.56, max = o.max || 0;
    if (max && w > max) s = Math.max(12, s * max / w);
    return `<text x="${x}" y="${y}" style="fill:${FILL[o.c] || o.c || FILL.fg}" font-size="${s.toFixed(1)}" text-anchor="${o.a || 'middle'}" font-family="system-ui"${o.w ? ' font-weight="700"' : ''}>${esc(t)}</text>`;
  }
  const RECT = (x, y, w, h, c, o) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${(o && o.r) || 6}" style="fill:${c};stroke:${(o && o.stroke) || FILL.mute};stroke-width:1.4"/>`;
  const ARR = (x0, y0, x1, y1, c) => { const a = Math.atan2(y1 - y0, x1 - x0), h = 7; return `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" style="stroke:${c || FILL.warn};stroke-width:2.4"/><path d="M${x1} ${y1} L${(x1 - h * Math.cos(a - 0.45)).toFixed(1)} ${(y1 - h * Math.sin(a - 0.45)).toFixed(1)} L${(x1 - h * Math.cos(a + 0.45)).toFixed(1)} ${(y1 - h * Math.sin(a + 0.45)).toFixed(1)}Z" style="fill:${c || FILL.warn}"/>`; };
  const LINE = (x0, y0, x1, y1, c, o) => `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" style="stroke:${c || FILL.mute};stroke-width:${(o && o.w) || 1.6}"${o && o.dash ? ` stroke-dasharray="${o.dash}"` : ''}/>`;
  function figKette() {
    const b = (x, w, t, c) => RECT(x, 40, w, 52, c) + TX(x + w / 2, 70, t, { max: w - 6, w: 1 });
    return SV(b(10, 66, 'Chip', 'rgba(255,92,92,.35)') + b(96, 78, 'Gehäuse', 'rgba(255,159,67,.35)') + b(194, 74, 'Kühlkörper', 'rgba(230,194,0,.30)') + b(288, 62, 'Luft', 'rgba(59,158,255,.25)') +
      ARR(76, 66, 96, 66) + ARR(174, 66, 194, 66) + ARR(268, 66, 288, 66) + TX(43, 30, sy('Tj'), { c: 'bad', w: 1 }) + TX(135, 30, sy('Tc'), { c: 'warn', w: 1 }) + TX(231, 30, sy('Tk'), { c: 'warn', w: 1 }) + TX(319, 30, sy('Ta'), { c: 'mute', w: 1 }) +
      TX(180, 118, 'Die Wärme fließt von heiß nach kalt.', { c: 'mute', max: 340 }) + TX(180, 138, 'Jede Stufe hat einen Wärmewiderstand.', { c: 'mute', max: 340 }), 'Die Wärmekette: Chip, Gehäuse, Kühlkörper, Luft');
  }
  function figErsatz() {
    const r = (x, t) => RECT(x, 18, 56, 26, FILL.panel) + TX(x + 28, 36, t, { max: 52, s: 12 });
    return SV(LINE(10, 31, 330, 31) + r(52, sy('Rth_JC')) + r(138, sy('Rth_CK')) + r(224, sy('Rth_K')) + LINE(330, 31, 330, 118) + LINE(10, 31, 10, 118) + LINE(10, 118, 330, 118) +
      `<circle cx="10" cy="74" r="14" style="fill:var(--panel);stroke:${FILL.warn};stroke-width:1.8"/>` + ARR(10, 82, 10, 66, FILL.warn) + TX(34, 78, 'P', { a: 'start', c: 'warn', w: 1 }) +
      `<circle cx="330" cy="74" r="14" style="fill:var(--panel);stroke:${FILL.acc};stroke-width:1.8"/>` + TX(330, 79, '+', { c: 'acc', w: 1 }) + TX(312, 70, sy('Ta'), { a: 'end', c: 'acc', w: 1 }) +
      `<circle cx="52" cy="31" r="3" style="fill:${FILL.bad}"/>` + TX(52, 12, sy('Tj'), { c: 'bad', w: 1 }) + `<circle cx="136" cy="31" r="3" style="fill:${FILL.bad}"/>` + TX(124, 56, sy('Tc'), { c: 'warn', w: 1 }) + `<circle cx="222" cy="31" r="3" style="fill:${FILL.bad}"/>` + TX(210, 56, sy('Tk'), { c: 'warn', w: 1 }) +
      TX(170, 136, 'Umgebung (wie Masse)', { c: 'mute', max: 200 }), 'Thermisches Ersatzschaltbild: Stromquelle, drei Wärmewiderstände, Umgebung', '0 0 360 145');
  }
  function figRippen(fan) {
    let g = LINE(20, 120, 340, 120, FILL.mute, { w: 3 });
    for (let i = 0; i < 6; i++) g += `<rect x="${50 + i * 46}" y="50" width="12" height="70" rx="2" style="fill:rgba(230,194,0,.45);stroke:${FILL.mute}"/>`;
    for (let i = 0; i < 6; i++) g += `<path d="M${56 + i * 46} 44 q-8 -12 0 -22 q8 -10 0 -20" style="fill:none;stroke:${FILL.acc};stroke-width:1.8;stroke-dasharray:4 3"/>`;
    return SV(g + TX(180, 140, 'Die warme Luft steigt zwischen den Rippen auf.', { c: 'mute', max: 340 }) + (fan ? '' : ''), 'Kühlkörper mit Rippen und aufsteigender Luft', '0 0 360 150');
  }
  /* PT1-Aufheizkurve: Punkte aus tFraction (Zeit zu einem Anteil), Marken bei 63 % und 95 % */
  function figPt1(tau) {
    const C = CORE(); if (!C || typeof C.tFraction !== 'function' || !fin(tau)) return '';
    const L = 54, T = 12, W = 292, H = 100, tmax = C.tFraction(tau, 0.99), X = t => L + W * t / tmax, Y = f => T + H * (1 - f); let pts = [];
    for (let k = 0; k <= 60; k++) { const f = Math.min(0.99, k / 60 * 0.99); const t = f === 0 ? 0 : C.tFraction(tau, f); if (fin(t)) pts.push(X(t).toFixed(1) + ',' + Y(f).toFixed(1)); }
    const m = (f, lab) => { const t = C.tFraction(tau, f); return fin(t) ? LINE(L, Y(f), X(t), Y(f), FILL.warn, { dash: '4 3', w: 1.2 }) + LINE(X(t), Y(f), X(t), T + H, FILL.warn, { dash: '4 3', w: 1.2 }) + `<circle cx="${X(t).toFixed(1)}" cy="${Y(f).toFixed(1)}" r="4" style="fill:${FILL.bad}"/>` + TX(X(t), T + H + 14, lab, { c: 'warn', s: 12 }) + TX(L - 4, Y(f) + 4, fa(f * 100) + ' %', { a: 'end', c: 'mute', s: 12 }) : ''; };
    return SV(`<rect x="${L}" y="${T}" width="${W}" height="${H}" style="fill:none;stroke:${FILL.mute}"/><polyline points="${pts.join(' ')}" style="fill:none;stroke:${FILL.acc};stroke-width:2.6"/>` + m(F1, '1 τ') + m(F3, '3 τ') + TX(L + W / 2, T + H + 30, 'Zeit (in Vielfachen der Zeitkonstante τ)', { c: 'mute', max: 290 }), 'Aufheizkurve einer Verzögerung erster Ordnung', '0 0 360 160');
  }
  function figPendeln(on, off) {
    const pts = '20,100 70,40 90,70 130,40 150,70 190,40 210,70 250,40 270,70 310,40';
    return SV(`<rect x="20" y="20" width="300" height="100" style="fill:none;stroke:${FILL.mute}"/>` + LINE(20, 40, 320, 40, FILL.bad, { dash: '5 4', w: 1.4 }) + LINE(20, 70, 320, 70, FILL.ok, { dash: '5 4', w: 1.4 }) + `<polyline points="${pts}" style="fill:none;stroke:${FILL.warn};stroke-width:2.6"/>` +
      TX(24, 34, 'Abschalten bei ' + fa(on) + ' °C', { a: 'start', c: 'bad', max: 220 }) + TX(24, 86, 'Wieder einschalten bei ' + fa(off) + ' °C', { a: 'start', c: 'ok', max: 250 }) + TX(180, 142, sy('Tj') + ' pendelt zwischen den Schwellen.', { c: 'mute', max: 340 }), 'Pendeln der thermischen Abschaltung', '0 0 360 150');
  }
  const tbl = (head, rows, o) => `<table>${head ? '<tr>' + head.map(h => `<th>${esc(tpl(h))}</th>`).join('') + '</tr>' : ''}${rows.map(r => '<tr>' + r.map(c => `<td>${(o && o.raw) ? c : esc(tpl(c))}</td>`).join('') + '</tr>').join('')}</table>`;
  const trybtn = (id, label) => `<button class="chip s" data-try="${id}">▶ ${esc(label)}</button>`;

  /* ============================================================ Zahlen für die Abschnitte (alle aus Kernfunktionen) */
  const EX = { ue: 12, ua: 5, ia: 0.5 };
  const F1 = 1 - Math.exp(-1), F3 = 1 - Math.exp(-3); /* Anteile nach einer und nach drei Zeitkonstanten (Definition von τ), die Zeiten daraus liefert tFraction */
  function data() {
    const C = CORE(); if (!C) return null; const D = { ue: EX.ue, ua: EX.ua, ia: EX.ia }, K = C.const || {};
    D.taStd = fin(K.TA_STD) ? K.TA_STD : 25; D.taDev = fin(K.TA_GERAET) ? K.TA_GERAET : 40; D.tHand = K.T_HAND; D.shutOn = K.SHUT_ON; D.shutOff = K.SHUT_OFF; D.etaSw = K.ETA_SW;
    const pl = tryf(() => C.power.linear(D.ue, D.ua, D.ia), null); D.p = pl && pl.ok !== false ? pick(pl, ['p', 'value']) : NaN; D.pSteps = pl && pl.steps;
    D.cfgFree = { device: '7805', heatsink: 'none' }; D.cfgM = { device: '7805', heatsink: 'm', joint: 'glimmer', paste: 'duenn' }; D.cfgMd = { device: '7805', heatsink: 'm', joint: 'glimmer', paste: 'keine' };
    D.sFree = tryf(() => C.steady(D.cfgFree, D.p, D.taStd), null); D.sM = tryf(() => C.steady(D.cfgM, D.p, D.taStd), null); D.sM40 = tryf(() => C.steady(D.cfgM, D.p, D.taDev), null); D.sMd = tryf(() => C.steady(D.cfgMd, D.p, D.taStd), null);
    D.kerf = tryf(() => C.rthKerf(D.cfgM, D.p, D.taDev), null); D.choose = D.kerf && fin(D.kerf.value) ? tryf(() => C.chooseHeatsink(D.kerf.value, {}), null) : null;
    D.sCheck = D.choose && D.choose.id ? tryf(() => C.steady(Object.assign({}, D.cfgM, { heatsink: D.choose.id }), D.p, D.taDev), null) : null; D.chM = tryf(() => C.chain(D.cfgM), null); D.chFan = tryf(() => C.chain(Object.assign({}, D.cfgM, { fan: 'mittel' })), null); D.chWaag = tryf(() => C.chain(Object.assign({}, D.cfgM, { orient: 'waagrecht' })), null);
    D.hsM = C.heatsinks && C.heatsinks.byId ? C.heatsinks.byId.m : null; D.tau = D.hsM && fin(D.hsM.tau) ? D.hsM.tau : (D.hsM && typeof C.tauOf === 'function' ? C.tauOf(D.hsM.rthK, D.hsM.cthK) : NaN);
    D.swp = tryf(() => C.power.switching(D.ua * D.ia, D.etaSw), null); D.etaLin = tryf(() => (C.formulas.byId.etaLin.explain(D.ue, D.ua)), null);
    D.sSw = tryf(() => C.steady({ device: '7805', heatsink: 'none', overrides: { rthJA: K.RTH_SWCHIP } }, pick(D.swp, ['p', 'value']), D.taStd), null);
    return D;
  }
  const fcalc = (id, ...a) => { const C = CORE(), f = C && C.formulas && C.formulas.byId && C.formulas.byId[id]; if (!f) return null; try { return f.explain(...a); } catch (e) { return null; } };
  const fdef = id => { const C = CORE(), f = C && C.formulas && C.formulas.byId && C.formulas.byId[id]; return f ? f.inputs.map(i => i.def) : []; };
  const stepsLi = r => (r && Array.isArray(r.steps) ? `<ol class="res" style="margin:6px 0;padding:8px 12px 8px 30px">${r.steps.map(s => `<li>${esc(tpl(s))}</li>`).join('')}</ol>` : '');

  /* ============================================================ Abschnitte */
  function sections(D, api) {
    const C = CORE(), S = sy, num = (v, u) => `<b>${fa(v)}${u ? ' ' + u : ''}</b>`;
    const R = []; const add = (id, title, html, tries) => R.push({ id, title, html, tries: tries || [] });
    const lin = (extra) => Object.assign({ rig: 'linear', controls: Object.assign({ device: '7805', loadMode: 'strom', ue: D.ue, iLoad: D.ia, ta: D.taStd }, extra) }, {});
    if (!C || !D) { add('x', 'Der Rechenkern fehlt', NOZ); return R; }
    /* 1 */
    add('warum', '1 Warum wird Wärme zum Problem?', `<p>Wo Spannung abfällt und Strom fließt, entsteht <b>Verlustleistung</b>: Sie heizt das Bauteil auf. Die Sperrschicht im Inneren darf nur bis ${S('Tjmax')} warm werden, sonst wird das Bauteil geschädigt. Die Wärme fließt nur von heiß nach kalt und braucht dafür einen Weg bis in die Umgebung.</p>${figKette()}
      <p>Beispiel: Ein Linearregler 7805 setzt bei ${num(D.ue, 'V')} Eingang, ${num(D.ua, 'V')} Ausgang und ${num(D.ia, 'A')} Last die ${S('P')} ${num(D.p, 'W')} um. Freistehend steigt die ${S('Tj')} im Beharrungszustand auf ${D.sFree && D.sFree.ok !== false ? num(D.sFree.tj, '°C') : '–'}, erlaubt sind ${D.sFree ? num(D.sFree.tjMax, '°C') : '–'}. Er braucht also einen Kühlkörper oder seine thermische Abschaltung greift.</p>`, [['warm', 'Freistehenden 7805 ansehen']]);
    /* 2 */
    const fr = [['pLinear', 'Linearregler'], ['pBipolar', 'Längstransistor'], ['pMosfet', 'MOSFET (Leitverlust)'], ['pSwitch', 'MOSFET (Schaltverlust)'], ['diodeFF', 'Diode'], ['pRes', 'Widerstand'], ['endstufe', 'Endstufe je Transistor']].map(([id, n]) => { const f = C.formulas && C.formulas.byId && C.formulas.byId[id], r = f ? fcalc(id, ...fdef(id)) : null; return [n, f ? f.expr : '–', r && r.ok !== false && fin(r.value) ? fa(r.value) + ' ' + (r.unit || '') : '–']; });
    add('verlust', '2 Verlustleistung berechnen', `<p>Die Formel hängt vom Bauteil ab. Rechne zuerst die Verlustleistung, denn sie ist die Eingangsgröße der ganzen Wärmerechnung. Beim Linearregler gilt die Prüfungsnäherung ohne Ruhestrom; die genauere Formel nimmt <b>Ue · Iq</b> dazu.</p>${tbl(['Bauteil', 'Formel', 'Beispiel mit den Startwerten des Rechners'], fr)}
      ${stepsLi({ steps: D.pSteps })}<p class="hint2">Die Beispielwerte sind die Startwerte der Rechner im Tab „Rechnen“; dort setzt du eigene Zahlen ein.</p>`, [['pv', 'Last ändern und P ablesen']]);
    /* 3 */
    add('ersatz', '3 Das thermische Ersatzschaltbild', `<p>Wärmefluss und Strom folgen denselben Gesetzen. Darum rechnest du mit einem Ersatzschaltbild wie in der Elektrik.</p>${tbl(['elektrisch', 'thermisch'], (C.analogie || []).map(a => [a.elek, a.therm]))}${figErsatz()}
      <p>Die Temperaturen an den Knoten sind die „Spannungen“: ${S('Tj')}, ${S('Tc')} und ${S('Tk')}. Über jedem Wärmewiderstand fällt <b>ΔT = P · Rth</b> ab.</p>`, [['ersatz', 'Ersatzschaltbild im Prüfstand ansehen']]);
    /* 4 */
    const chM = D.chM || {};
    add('glieder', '4 Die Glieder der Kette', `<ul><li><b>${S('Rth_JC')}</b>: Sperrschicht zum Gehäuse. Der Wert steht im Datenblatt (hier ${num(chM.rthJC, 'K/W')} beim 7805).</li><li><b>${S('Rth_CK')}</b>: Gehäuse zum Kühlkörper, also der Übergang mit Paste und Isolierscheibe (hier ${num(chM.rthCK, 'K/W')}).</li><li><b>${S('Rth_K')}</b>: Kühlkörper zur Umgebung, ein Katalogwert (hier ${num(chM.rthK, 'K/W')} beim Profil mittel).</li><li><b>${S('Rth_JA')}</b>: Sperrschicht zur Umgebung ohne Kühlkörper (7805 freistehend: ${tryf(() => num(C.devices['7805'].rthJA, 'K/W'), '–')}).</li></ul>
      <p>Mit Kühlkörper liegen die Glieder in Reihe, also addieren sie sich: <b>${S('Rth_ges')} = ${S('Rth_JC')} + ${S('Rth_CK')} + ${S('Rth_K')}</b> = ${num(chM.rthTotal, 'K/W')}. Der Parallelweg vom Gehäuse direkt in die Luft wird vernachlässigt, wie in der Prüfung.</p>${stepsLi(D.sM)}
      <p>Sitzen mehrere gleiche Bauteile auf einem Kühlkörper, trägt der Kühlkörper die <b>Summe</b> ihrer Verlustleistungen.</p>`, [['mittel', 'Beispiel am Kühlkörper ansehen']]);
    /* 5 */
    const joints = [['direkt', 'duenn', 'direkt mit Paste'], ['direkt', 'keine', 'direkt ohne Paste'], ['glimmer', 'duenn', 'Glimmerscheibe mit Paste'], ['glimmer', 'keine', 'Glimmerscheibe ohne Paste'], ['silikon', 'keine', 'Silikonfolie'], ['silikon', 'duenn', 'Silikonfolie mit Paste']];
    const rows5 = joints.map(([j, p, n]) => [n, fa(tryf(() => C.mount.rthCK('TO-220', j, p, 'fest'), NaN)) + ' K/W', fa(tryf(() => C.mount.rthCK('TO-126', j, p, 'fest'), NaN)) + ' K/W']);
    const fct = (C.mount && C.mount.factors) || {}, pots = ['7805', 'lm317', 'bd139', 'irlz34n'].map(id => { const d = C.devices[id]; return [d.name, d.tab ? 'liegt an ' + d.tab.potText : '–']; });
    add('uebergang', '5 Der Übergang: Paste, Glimmerscheibe, Silikonfolie, Isolierbuchse', `<p>Zwischen Gehäuse und Kühlkörper bleiben winzige Luftspalte. Die <b>Wärmeleitpaste</b> füllt sie und senkt ${S('Rth_CK')}. Eine <b>Glimmerscheibe</b> oder <b>Silikonfolie</b> isoliert das Gehäuse elektrisch, leitet die Wärme aber schlechter. Die <b>Isolierbuchse</b> isoliert die Schraube, damit sie keinen Kurzschluss zwischen Fahne und Kühlkörper bildet.</p>
      ${tbl(['Übergang (Schraube fest)', 'TO-220', 'TO-126'], rows5)}<p>Zu viel Paste verschlechtert den Übergang (Faktor ${fa(fct.dick)}), eine lockere Schraube ebenfalls (Faktor ${fa(fct.locker)}). Alle Werte sind Übungswerte; ein Anzugsmoment für die Schraube steht hier absichtlich nicht: Es gilt die Herstellerangabe.</p>
      <p><b>Elektrik:</b> Die Fahne ist nicht bei jedem Bauteil an Masse. Ob du isolieren musst, hängt davon ab, an welchem Potenzial die Fahne liegt und an welchem der Kühlkörper.</p>${tbl(['Bauteil', 'Die Fahne'], pots)}
      <p>Beim 7805 darf die Fahne direkt auf den geerdeten Kühlkörper, der Kühlkörper führt dann keine Spannung. Beim LM317 liegt die Fahne am Ausgang: Ein geerdeter Kühlkörper ohne Isolierung schließt den Ausgang kurz.</p>`, [['paste', 'Glimmerscheibe mit und ohne Paste vergleichen']]);
    /* 6 */
    const hs = (C.heatsinks || []).slice(), fanL = (C.fan && C.fan.list) || [], oriL = (C.orient && C.orient.list) || [];
    add('kuehlkoerper', '6 Der Kühlkörper: Rippen, Konvektion, Lüfter, Einbaulage', `<p>Die Rippen vergrößern die Fläche, an der die Luft Wärme aufnimmt. Die erwärmte Luft steigt auf und zieht kühle nach (<b>Konvektion</b>). Darum kühlen senkrecht stehende Rippen besser als liegende.</p>${figRippen()}
      ${tbl(['Kühlkörper', S('Rth_K') + ' in K/W', 'Masse in g', 'τ des Kühlkörpers in s'], hs.map(h => [h.name, fa(h.rthK), fa(h.massG), fa(h.tau)]))}
      <p><b>Lüfter und Einbaulage</b> wirken nur auf ${S('Rth_K')}: ${S('Rth_K')},eff = ${S('Rth_K')} · Faktor. ${fanL.map(f => esc(f.name) + ' ' + fa(f.factor)).join(', ')}; ${oriL.map(o => esc(o.name) + ' ' + fa(o.factor)).join(', ')}.</p>
      <p>Beispiel Profil mittel mit Lüfter mittel: ${S('Rth_K')},eff = ${num(D.chFan && D.chFan.rthK, 'K/W')} statt ${num(chM.rthK, 'K/W')}, ${S('Rth_ges')} nur noch ${num(D.chFan && D.chFan.rthTotal, 'K/W')} statt ${num(chM.rthTotal, 'K/W')}. ${S('Rth_JC')} und ${S('Rth_CK')} ändern sich nicht: Ein Lüfter hilft nur beim Kühlkörper. Waagrechter Einbau: ${S('Rth_K')},eff = ${num(D.chWaag && D.chWaag.rthK, 'K/W')}.</p>
      <p>Ein selbstgebautes Kühlblech rechnest du über seine Fläche (beide Seiten); der Rechner im Tab „Rechnen“ und der Prüfstand kennen dafür den Schalter „Kühlblech“.</p>`, [['luefter', 'Lüfter im Vergleich ansehen']]);
    /* 7 */
    const kv = D.kerf || {}, ch = D.choose || {}, steps7 = [['1', 'Verlustleistung berechnen', 'P = ' + fa(D.p) + ' W'], ['2', 'Ersatzschaltbild: Glieder benennen', S('Rth_JC') + ', ' + S('Rth_CK') + ', ' + S('Rth_K')], ['3', S('Rth_ges') + ' bilden', fa(D.sM && D.sM.rthTotal) + ' K/W (mit dem Profil mittel)'], ['4', S('Tj') + ' berechnen und mit ' + S('Tjmax') + ' vergleichen', fa(D.sM40 && D.sM40.tj) + ' °C bei ' + S('Ta') + ' = ' + fa(D.taDev) + ' °C'], ['5', S('Rth_Kerf') + ' berechnen', fin(kv.value) ? fa(kv.value) + ' K/W' : '–'], ['6', 'Kühlkörper aus der Tabelle wählen', ch.heatsink ? ch.heatsink.name : (ch.why || '–')], ['7', 'Kontrolle mit dem gewählten Kühlkörper', D.sCheck && D.sCheck.ok !== false ? S('Tj') + ' = ' + fa(D.sCheck.tj) + ' °C, Reserve ' + fa(D.sCheck.tjMax - D.sCheck.tj) + ' K' : '–']];
    add('gang', '7 Der Berechnungsgang in sieben Schritten', `<p>Die Prüfungsaufgabe „Kühlkörper berechnen“ hat immer denselben Gang. Halte ihn ein, dann verlierst du keinen Schritt:</p>${tbl(['Schritt', 'Was du tust', 'Beispiel: 7805, ' + fa(D.ue) + ' V auf ' + fa(D.ua) + ' V, ' + fa(D.ia) + ' A, Glimmer und Paste'], steps7)}${stepsLi(D.kerf)}
      <p>Prüfe die Bedingung <b>${S('Tj')} ≤ ${S('Tjmax')}</b> immer mit dem gewählten Kühlkörper nach, nicht nur mit dem Sollwert. Ergibt ${S('Rth_Kerf')} eine Zahl kleiner als 0, sind schon ${S('Rth_JC')} und ${S('Rth_CK')} zu groß: Dann hilft kein Kühlkörper, sondern nur weniger Verlustleistung oder ein besserer Übergang.</p>`, [['rechnen', 'Im Rechner nachrechnen']]);
    /* 8 */
    const dr = fcalc('derate', ...[tryf(() => C.devices.bd139.tjMax, NaN), D.taStd, tryf(() => C.devices.bd139.rthJC, NaN)]);
    add('derating', '8 Derating und Datenblatt', `<p>Im Datenblatt steht die zulässige Verlustleistung für das Gehäuse bei 25 °C. Wird das Gehäuse wärmer, sinkt sie linear: <b>P_zul(${S('Tc')}) = (${S('Tjmax')} − ${S('Tc')}) / ${S('Rth_JC')}</b>. Dieses Absenken heißt <b>Derating</b>.</p>${dr ? stepsLi(dr) : ''}${dr && fin(dr.value) ? `<p>Beim BD139 sind das bei ${S('Tc')} = ${fa(D.taStd)} °C ${num(dr.value, 'W')}.</p>` : ''}
      <p>Mit Kühlkörper zählt die Rechnung über die ganze Kette; der Freiluftwert aus dem Datenblatt gilt dann nicht mehr. Wie du ein Datenblatt liest, übst du im <a href="dslab.html">Datenblatt-Lab</a>.</p>`, [['derate', 'Zulässige Leistung am Prüfstand ablesen']]);
    /* 9 */
    const t63 = tryf(() => C.tFraction(D.tau, F1), NaN), t95 = tryf(() => C.tFraction(D.tau, F3), NaN), cth = D.hsM && D.hsM.cthK;
    add('zeit', '9 Zeitverhalten: die Zeitkonstante', `<p>Ein Kühlkörper speichert Wärme wie ein Kondensator Ladung. Er braucht Zeit, bis er seine Endtemperatur erreicht. Die <b>Zeitkonstante</b> ist <b>τ = Rth · Cth</b>; die <b>Wärmekapazität</b> folgt aus Masse und Material: <b>Cth = m · c</b>.</p>${figPt1(D.tau)}
      <p>Beispiel Profil mittel: ${S('Rth_K')} = ${num(D.hsM && D.hsM.rthK, 'K/W')}, Cth = ${num(cth, 'J/K')}, also τ = ${num(D.tau, 's')} = ${num(D.tau / 60, 'min')}. Nach einer Zeitkonstante sind ${fa(100 * F1)} % des Endwerts erreicht (${num(t63 / 60, 'min')}), nach drei Zeitkonstanten ${fa(100 * F3)} % (${num(t95 / 60, 'min')}). Das Lab rechnet die Zeit in <b>Prozess-Minuten</b>: Im Prüfstand läuft sie schneller als in Wirklichkeit.</p>
      <p>Für kurze Impulse zählt nicht der Dauerwert, sondern die Aufheizkurve: Ein Impuls, der viel kürzer als τ ist, erwärmt den Kühlkörper kaum.</p>`, [['tau', 'Aufheizkurve aufnehmen']]);
    /* 10 */
    add('abschaltung', '10 Thermische Abschaltung und Pendeln', `<p>Der Linearregler schützt sich selbst: Wird die Sperrschicht zu heiß, schaltet er den Ausgang ab. Im Übungsmodell geschieht das bei ${num(D.shutOn, '°C')}; erst bei ${num(D.shutOff, '°C')} schaltet er wieder ein (Übungswerte, im Datenblatt steht keine Zahl). Kühlt er ab, schaltet er ein, heizt sich wieder auf und so fort: Das ist das <b>Pendeln</b>.</p>${figPendeln(D.shutOn, D.shutOff)}
      <p>Die Abschaltung ist ein Schutz, kein Betriebspunkt: Die Ausgangsspannung bricht dabei immer wieder zusammen. Abhilfe schafft nur weniger ${S('P')} oder ein kleinerer ${S('Rth_ges')}.</p>`, [['abschalt', 'Abschaltung erleben']]);
    /* 11 */
    const ps = D.swp ? pick(D.swp, ['p', 'value']) : NaN, el = D.etaLin ? pick(D.etaLin, ['value']) : NaN;
    add('schalt', '11 Linearregler gegen Schaltregler', `<p>Der Linearregler vernichtet die Spannungsdifferenz als Wärme. Sein Wirkungsgrad ist nur <b>η = Ua / Ue</b> = ${num(100 * el, '%')}. Ein Schaltregler wandelt die Energie mit einem Übungswirkungsgrad von ${num(100 * D.etaSw, '%')}.</p>
      <p>Bei ${num(D.ua * D.ia, 'W')} Ausgangsleistung verbrennt der Linearregler ${num(D.p, 'W')}, der Schaltregler nur ${num(ps, 'W')}. Mit dem Schaltregler-Chip freistehend bleibt die ${S('Tj')} bei ${D.sSw && D.sSw.ok !== false ? num(D.sSw.tj, '°C') : '–'} (erlaubt ${D.sSw ? num(D.sSw.tjMax, '°C') : '–'}): ${D.sSw && D.sSw.tj <= D.sSw.tjMax ? 'Hier braucht der Chip keinen Kühlkörper.' : 'Hier braucht auch der Chip einen Kühlkörper.'} Die Annahmen sind Übungswerte.</p>`, [['rechnen', 'Beide Regler im Rechner vergleichen']]);
    /* 12 */
    add('sicherheit', '12 Sicherheit', `<ul><li><b>Heiße Oberflächen:</b> Ein Kühlkörper über ${num(D.tHand, '°C')} gilt im Lab als zu heiß zum Anfassen (Übungsgrenze, keine Norm). Fasse nach einem Lauf zuerst mit dem Handrücken in die Nähe.</li><li><b>Isolierung:</b> Führt die Fahne Spannung (zum Beispiel am LM317 der Ausgang), führt der nicht isolierte Kühlkörper sie auch. Isoliere ihn oder baue ihn berührgeschützt ein.</li><li><b>Glimmerscheibe:</b> Sie bricht leicht. Eine gebrochene Scheibe isoliert nicht mehr.</li><li><b>Wärmeleitpaste:</b> Trage sie dünn auf. Hautkontakt vermeidest du; danach wäschst du die Hände wie üblich.</li><li><b>Nach Überlast:</b> Verwende ein Bauteil, das zu heiß geworden ist, nicht weiter.</li></ul><p class="hint2">Der Defekt im Prüfstand ist eine Spielmechanik des Übungsmodells, keine Aussage über echte Bauteile.</p>`);
    /* 13 */
    add('regelstrecke', '13 Die Wärmekette als Regelstrecke', `<p>Chip, Gehäuse und Kühlkörper sind drei Wärmespeicher hintereinander. Die Kette verhält sich darum wie eine <b>Regelstrecke mit Verzögerung</b>: Auf einen Sprung der Verlustleistung folgt die Temperatur nicht sofort, sondern wie eine Aufheizkurve (bis zur dritten Ordnung). Die thermische Abschaltung wirkt wie ein <b>Zweipunktregler</b> mit Hysterese: Sie schaltet bei ${num(D.shutOn, '°C')} aus und bei ${num(D.shutOff, '°C')} ein.</p><p>Wie du Strecken misst und Regler einstellst, lernst du im <a href="reglab.html">Regelungstechnik-Lab</a>.</p>`);
    /* 14 */
    add('glossar', '14 Glossar', `<p class="hint2">Zwei Schreibweisen gelten: Datenblatt (wie im Datenblatt-Lab) und Berufsschule. Mit dem Umschalter über dem Prüfstand wechselst du.</p>${tbl(['Begriff', 'Datenblatt', 'Berufsschule', 'Einheit', 'Erklärung'], (C.glossary || []).map(g => [(g.article ? g.article + ' ' : '') + g.name, g.db || '–', g.de || '–', g.unit || '–', tpl(g.explain)]))}`);
    /* 15 */
    const keys = (api && api.KEYS) || root.THM_KEYS || [];
    add('tasten', '15 Tastenkürzel', keys.length ? `<table>${keys.map(k => `<tr><td style="white-space:nowrap">${k.keys.map(x => `<code>${esc(x)}</code>`).join(' oder ')}</td><td>${esc(k.t)}</td></tr>`).join('')}</table>` : '<p class="hint2">Die Tastenkürzel kommen aus der Seite.</p>');
    return R;
  }

  /* „Probier es aus“: lädt Prüfstand und Einstellungen über api.loadRig, ohne eigene Rechnung */
  function tryAct(id, D, api) {
    const lin = extra => Object.assign({ device: '7805', loadMode: 'strom', ue: D.ue, ua: D.ua, iLoad: D.ia, ta: D.taStd, iq: true }, extra), M = { heatsink: 'm', joint: 'glimmer', paste: 'duenn', bushing: true, screw: 'fest' };
    switch (id) {
      case 'warm': return api.loadRig({ rig: 'linear', controls: lin({ heatsink: 'none' }), name: 'Lernen: freistehend', toast: 'Geladen: 7805 ohne Kühlkörper im Beharrungszustand' });
      case 'pv': return api.loadRig({ rig: 'linear', controls: lin(M), name: 'Lernen: Last ändern', settle: true, toast: 'Geladen: Ändere die Last und lies die Verlustleistung ab' });
      case 'ersatz': { const ok = api.loadRig({ rig: 'linear', controls: lin(M), name: 'Lernen: Ersatzschaltbild', settle: true }); if (ok && api.setView) api.setView('ersatz'); return ok; }
      case 'mittel': return api.loadRig({ rig: 'linear', controls: lin(M), name: 'Lernen: Kühlkörper mittel', settle: true });
      case 'paste': return api.loadRig({ rig: 'vergleich', controls: { device: '7805', pv: D.p, ta: D.taStd, heatsink_a: 'm', joint_a: 'glimmer', paste_a: 'keine', heatsink_b: 'm', joint_b: 'glimmer', paste_b: 'duenn', heatsink_c: 'm', joint_c: 'direkt', paste_c: 'duenn', n: 3 }, name: 'Lernen: Paste mit und ohne', settle: true });
      case 'luefter': return api.loadRig({ rig: 'vergleich', controls: { device: '7805', pv: D.p, ta: D.taStd, heatsink_a: 'm', joint_a: 'glimmer', paste_a: 'duenn', fan_a: 'aus', heatsink_b: 'm', joint_b: 'glimmer', paste_b: 'duenn', fan_b: 'mittel', heatsink_c: 'm', joint_c: 'glimmer', paste_c: 'duenn', fan_c: 'stark', n: 3 }, name: 'Lernen: Lüfter', settle: true });
      case 'rechnen': api.setTab('calc'); return true;
      case 'derate': return api.loadRig({ rig: 'transistor', controls: { ta: 50, heatsink: 'm', joint: 'glimmer', paste: 'duenn' }, name: 'Lernen: Derating', settle: true });
      case 'tau': return api.loadRig({ rig: 'linear', controls: lin(M), name: 'Lernen: Aufheizkurve', settle: false, toast: 'Geladen: Starte den Prüfstand und beobachte die Aufheizkurve (Prozess-Minuten)' });
      case 'abschalt': return api.loadExample('thx1') || api.loadRig({ rig: 'linear', controls: lin({ heatsink: 'none' }), name: 'Lernen: Abschaltung', settle: false, toast: 'Geladen: Starte den Prüfstand und beobachte das Pendeln' });
    }
    return false;
  }

  function render(host, api) {
    A = api; const D = data(); let secs = []; try { secs = sections(D, api); } catch (e) { console.error('Lernen:', e); secs = [{ id: 'err', title: 'Das hat nicht geklappt', html: '<p class="hint2">' + esc((e && e.message) || e) + '</p>', tries: [] }]; }
    host.innerHTML = '<div class="card pl"><h4>Lernen</h4><p class="big">Thermik kurz erklärt</p><p class="hint2" style="margin:0">15 Abschnitte zum Aufklappen. Alle Zahlen kommen aus derselben Rechnung wie die Rechner und die Prüfstände; der Knopf „Probier es aus“ lädt den passenden Aufbau.</p></div>' +
      secs.map((s, i) => `<details data-sec="${esc(s.id)}"${i === 0 ? ' open' : ''}><summary>${esc(s.title)}</summary><div class="hb2">${s.html}${s.tries.length ? `<div class="tryit">${s.tries.map(t => trybtn(t[0], t[1])).join('')}</div>` : ''}</div></details>`).join('');
    if (!host._thmHelp) { host._thmHelp = true; host.addEventListener('click', e => { const b = e.target && e.target.closest ? e.target.closest('[data-try]') : null; if (!b || !A) return; const d = data(); if (d) tryAct(b.dataset.try, d, A); }); }
  }
  const api0 = { render, fn: { data, sections, tryAct, figKette, figErsatz, figRippen, figPt1, figPendeln, tbl }, EX };
  root.THM_UI_EXT = root.THM_UI_EXT || {}; root.THM_UI_EXT.help = api0;
  if (typeof module !== 'undefined') module.exports = api0;
})(typeof window !== 'undefined' ? window : globalThis);
