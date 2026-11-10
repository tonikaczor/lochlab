'use strict';
/* Tonfunk Netzteil-Lab: Visualisierungen (Lab-Kennung 'nts'), window.NTS_VIZ, per Node testbar (module.exports).
   Hängt sich ohne Änderung an ntsui.js an (MutationObserver und leiser Takt), Bauteilbilder kommen aus bauteilbild.js:
   1. Handy: Das Prüfstandbild bekommt auf schmalen Bildschirmen ein hohes Format und verzichtet auf die doppelte Ampelzeile im Bild
      (die Szenen sind für Hochformat gezeichnet; im Querformat-Seitenverhältnis blieb auf dem Handy nur ein Textrest).
   2. Karte "Bauteile und Bauformen" unter dem Bild: zeigt je Prüfstand die echten Bauformen (Transformator mit EI-Kern, Brückenmodul,
      Elko, Widerstand mit Farbringen und Bauform nach Verlustleistung, TO-220, Ringkerndrossel ...), live nach den Einstellungen.
   Aufgabenintegrität: Die Karte erscheint nicht während einer Aufgabe (S.task) und nie im Prüfstand "Fehlersuche"; sie zeigt nur
   Größen, die der Prüfstand ohnehin als Messwert oder Einstellung zeigt. Größen und Bauformen sind Richtwerte (Übungswerte), keine
   Herstellerdaten. Farben nur über CSS-Variablen (und hsl für Objektfarben). Keine Animation. */
(function (root) {
  const B = root.BAUTEILBILD || (typeof require !== 'undefined' ? require('./bauteilbild.js') : null);
  const fin = v => typeof v === 'number' && isFinite(v);
  const num = (v, d) => (fin(v) ? v : (d == null ? 0 : d));
  const eng = B ? B.eng : String, esc = B ? B.esc : String, nde = B ? B.nde : String;
  const W1 = 160, H1 = 124;
  const cap = c => { const u = num(c) * 1e6; return u >= 1 ? nde(u, u >= 100 ? 0 : 1) + ' µF' : nde(num(c) * 1e9, 0) + ' nF'; };                         /* kleine Kachel (viewBox) */

  /* ---------- Kacheln: { svg, vw, vh, title, sub, wide } ---------- */
  const tile = (vw, vh, svg, title, sub, wide) => ({ vw, vh, svg, title, sub, wide: !!wide });
  const lab = (x, y, t, o) => B.text(x, y, t, o);
  const heatOf = w => B.cl(num(w) / 1.0, 0, 1);      /* Wärmehof: 1 W ~ voll (nur Anschauung, die Zahl steht daneben) */

  function resTile(name, ohm, p, sub, heat, nobands) {
    const known = fin(p) && p > 0, pw = known ? B.pickPw(p) : 0.25, big = pw > 2 ? 5 : pw, cem = pw > 2, s = cem ? (pw >= 10 ? 1.7 : 3.4) : (big >= 1 ? 6.6 : 8.5), r = B.resistor(W1 / 2, 54, { ohm, pw: cem ? pw : big, s, lead: cem ? 10 : 18, heat, bands: !nobands });
    const bd = cem || nobands ? { n: 0 } : B.resBands(ohm);
    return tile(W1, H1, r.svg + lab(W1 / 2, 92, name + ' = ' + eng(ohm, 'Ω')) + lab(W1 / 2, 110, (known ? 'Bauform ' : 'z. B. ') + (cem ? B.pwName(pw) + (pw > 10 ? ' Leistungs-R.' : ' Zement') : B.pwName(big)), { cls: 'sm mute' }),
      'Widerstand ' + name, (known ? 'Verlustleistung ' + eng(p, 'W') + '. Faustwert: Bauform mit mindestens der doppelten Belastbarkeit, hier ' + B.pwName(pw) + '.' : (sub || 'Hier entsteht keine Verlustleistung.')) + (bd.n ? ' Farbringe: ' + bd.names.join(', ') + '.' : ''));
  }
  function elkoTile(cu, uN, urms, what) {
    const sc = Math.min(4.6, 66 / Math.max(11, B.elko(0, 0, { c: cu, s: 1 }).H)), e = B.elko(W1 / 2, 94, { c: cu, s: sc, label: '', lead: 10 }), uSel = B.pickU(urms, 1.25);
    return tile(W1, H1, e.svg + lab(W1 / 2 - e.D / 2 - 5, 94 - e.H / 2 + 4, cap(cu), { a: 'end' }) + lab(W1 / 2 + e.D / 2 + 5, 94 - e.H / 2 + 4, uSel + ' V', { a: 'start' }),
      what || 'Elektrolytkondensator', 'C = ' + cap(cu) + '. Faustwert: Spannungsfestigkeit mindestens 1,25 · ' + eng(urms, 'V') + ' = ' + eng(1.25 * urms, 'V') + ', aus der Reihe gewählt: ' + uSel + ' V. Größe wächst mit C und U.');
  }
  function to220Tile(title, pins, label, w, sub, heatW) {
    const t = B.to220(W1 / 2, 112, { s: 3.8, pins, heat: heatOf(heatW), label });
    return tile(W1, H1 + 4, t.svg, title, sub);
  }
  function diodeTile(title, typ, sub, heatW, ex) {
    const d = B.diode(W1 / 2, 50, { typ, s: typ === 'zener' ? 5.4 : 6.6, lead: 22, heat: heatOf(heatW) });
    return tile(W1, 86, d.svg + lab(W1 / 2 + 22, 78, '← Ring = Kathode', { cls: 'sm mute' }) + (ex || ''), title, sub);
  }
  function ringTile(title, L, iMax, sub) {
    const E = Math.max(1e-9, 0.5 * num(L) * Math.pow(num(iMax), 2)), R = B.cl(14 + 7 * Math.log10(E / 1e-6 + 1e-9), 13, 38), r = B.ringspule(W1 / 2, 60, { R, turns: 8 + R * 0.55 });
    return tile(W1, 124, r.svg + lab(W1 / 2, 116, 'L = ' + eng(L, 'H')), title, sub || ('Der Kern wächst mit der gespeicherten Energie ½ · L · I² = ' + eng(E, 'J') + '.'));
  }
  function trafoTile(ctl, m, res, simple) {
    const dc = !!ctl.gleichspannung, pv = num(m.pv), heat = dc ? 1 : B.cl(pv / 6, 0, 1), t = B.trafoEI(170, 88, { n1: ctl.n1, n2: ctl.n2, i1: m.i1, i2: m.i2, W: 200, H: 112, heat, dc });
    return tile(340, 176, t.svg + lab(6, 14, 'Primär N1 = ' + num(ctl.n1), { a: 'start', fill: 'var(--warn)' }) + lab(334, 14, 'Sekundär N2 = ' + num(ctl.n2), { a: 'end', fill: 'var(--ok)' }) +
      lab(6, 170, 'I₁ = ' + eng(m.i1, 'A'), { a: 'start', fill: 'var(--warn)' }) + lab(334, 170, 'I₂ = ' + eng(m.i2, 'A'), { a: 'end', fill: 'var(--ok)' }) + lab(170, 170, 'ü = ' + nde(num(ctl.n1) / Math.max(1, num(ctl.n2)), 2), { cls: 'b' }),
      'Transformator mit EI-Kern (Schnitt durch die Fenster)',
      'Innen liegt die Primärwicklung (orange), außen die Sekundärwicklung (grün). Der Draht ist umso dicker, je größer der Strom ist. Mehr Windungen heißt mehr Lagen.' + (dc ? ' Bei Gleichspannung gibt es keinen Wechselfluss, nur der Wicklungswiderstand begrenzt den Strom.' : ' Die gestrichelte blaue Linie ist der Wechselfluss im Kern.') + (heat > 0.05 ? ' Der rote Hauch zeigt die Verlustwärme im Kupfer.' : ''), true);
  }

  /* ---------- Je Prüfstand ---------- */
  const BUILD = {
    trafo(ctl, m, bil) { return [trafoTile(ctl, m)]; },
    gleich(ctl, m, bil) {
      const out = [], einweg = ctl.topo === 'einweg', uhat = num(m.uhat), udc = num(m.udc), il = num(ctl.iLast), ip = num(m.iPeak);
      if (einweg) out.push(diodeTile('Einweg: eine Diode', 'si', 'Ring = Kathode. ' + (ctl.diode === 'schottky' ? 'Schottky-Diode' : 'Siliziumdiode') + '. Der Ladestrom fließt nur in Spitzen von ' + eng(ip, 'A') + ' (Mittelwert Last ' + eng(il, 'A') + ').', num(bil && bil.gleich)));
      else { const b = B.bruecke(W1 / 2, 40, { s: 3.4, label: 'Brücke' }); out.push(tile(W1, H1, b.svg, 'Brückengleichrichter', 'Vier Dioden in einem Gehäuse: ~ ~ am Trafo, + und − am Elko. Ladestromspitze ' + eng(ip, 'A') + ' bei ' + eng(il, 'A') + ' Mittelwert.')); }
      out.push(elkoTile(num(ctl.c) * 1e-6, 0, uhat, 'Ladekondensator (Elko)'));
      if (il > 0 && udc > 0) { const rl = udc / il, p = udc * il; out.push(resTile('R_L', rl, p, '', 0, true)); }
      return out;
    },
    stabil(ctl, m, bil) {
      const out = [], art = ctl.art, pvW = num(m.pv);
      if (art === 'zener') {
        const uz = num(ctl.uz), rv = num(ctl.rv), ue = num(ctl.ue), p = rv > 0 ? Math.pow(Math.max(0, ue - uz), 2) / rv : 0;
        out.push(diodeTile('Z-Diode', 'zener', 'Glasgehäuse, schwarzer Ring = Kathode. Sie wird in Sperrrichtung betrieben und hält etwa ' + eng(uz, 'V') + '.', 0));
        out.push(resTile('R_V', rv, p, ''));
      } else if (art === '7805') {
        out.push(to220Tile('Festspannungsregler 7805', ['1', '2', '3'], '7805', 0, 'Anschlüsse 1 Ein, 2 GND, 3 Aus. Die Kühlfahne liegt meist an GND. Verlustwärme P_V = ' + eng(pvW, 'W') + ' (roter Hauch). Kühlung ist Thema im Thermik-Lab.', pvW));
      } else {
        const r1 = num(ctl.r1), r2 = num(ctl.r2), t = B.to220(W1 / 2, 112, { s: 3.8, pins: ['1', '2', '3'], heat: heatOf(pvW), label: 'LM317' });
        out.push(tile(W1, H1 + 4, t.svg, 'Einstellbarer Regler LM317', 'Anschlüsse von links: 1 Adj, 2 Aus, 3 Ein (Datenblatt prüfen). Verlustwärme P_V = ' + eng(pvW, 'W') + '.'));
        const iA = r1 > 0 ? 1.25 / r1 : 0;
        out.push(resTile('R1', r1, iA * iA * r1, '')); out.push(resTile('R2', r2, iA * iA * r2, ''));
      }
      return out;
    },
    buck(ctl, m, bil) {
      const out = [], pv = st => { const x = bil && bil.pv && bil.pv.find(q => q.stufe === st); return x ? num(x.w) : 0; };
      out.push(to220Tile('Schalter (MOSFET)', ['G', 'D', 'S'], 'MOSFET', 0, 'Schaltet mit ' + eng(num(ctl.f) * 1e3, 'Hz') + '. Verluste im Schalter ' + eng(pv('schalt'), 'W') + '.', pv('schalt')));
      if (ctl.uf === 'sync') out.push(to220Tile('Synchron-MOSFET', ['G', 'D', 'S'], 'MOSFET', 0, 'Ersetzt die Freilaufdiode, Verluste ' + eng(pv('gleich'), 'W') + '.', pv('gleich')));
      else out.push(diodeTile('Freilaufdiode (Schottky)', 'schottky', 'Ring = Kathode. Sie führt den Drosselstrom, wenn der Schalter sperrt. Verluste ' + eng(pv('gleich'), 'W') + '.', pv('gleich')));
      out.push(ringTile('Speicherdrossel', num(ctl.l) * 1e-6, num(m.iLmax)));
      out.push(elkoTile(num(ctl.c) * 1e-6, 0, num(ctl.uout), 'Ausgangskondensator'));
      return out;
    },
    topo(ctl, m, bil) {
      const out = [], pv = st => { const x = bil && bil.pv && bil.pv.find(q => q.stufe === st); return x ? num(x.w) : 0; };
      out.push(to220Tile('Schalter (MOSFET)', ['G', 'D', 'S'], 'MOSFET', 0, 'Verluste im Schalter ' + eng(pv('schalt'), 'W') + '.', pv('schalt')));
      out.push(diodeTile('Diode (Schottky)', 'schottky', 'Ring = Kathode. Verluste ' + eng(pv('gleich'), 'W') + '.', pv('gleich')));
      if (ctl.topo === 'sperr') {
        const t = B.trafoEI(W1 / 2, 60, { n1: 40, n2: 12 * num(ctl.n, 1), W: 130, H: 90, i1: num(m.iLmax) || 1, i2: 1 });
        out.push(tile(W1, H1, t.svg, 'Speichertrafo (Sperrwandler)', 'Er speichert Energie im Kern (meist mit Luftspalt) und gibt sie beim Sperren ab. Er trennt galvanisch und hat das Übersetzungsverhältnis n = ' + nde(num(ctl.n, 1), 2) + '.'));
      } else out.push(ringTile('Speicherdrossel', num(ctl.l) * 1e-6, num(m.iLmax)));
      out.push(elkoTile(num(ctl.c) * 1e-6, 0, num(ctl.uout), 'Ausgangskondensator'));
      return out;
    },
    gate(ctl, m, bil) {
      const out = [], psw = num(m.psw);
      out.push(to220Tile('Leistungs-MOSFET', ['G', 'D', 'S'], 'MOSFET', 0, 'Häufige Anschlussfolge von links: Gate, Drain, Source (Datenblatt prüfen). Die Kühlfahne liegt meist am Drain. Schaltverlust P_sw = ' + eng(psw, 'W') + '.', psw));
      out.push(resTile('R_g', num(ctl.rg), null, 'Begrenzt den Umladestrom des Gates (Spitze ' + eng(num(m.igPeak), 'A') + ').'));
      return out;
    },
    regel(ctl, m, bil) {
      const out = [];
      if (ctl.modus === 'labor') { const p = Math.pow(num(ctl.iset), 2) * num(ctl.rs); out.push(resTile('R_s', num(ctl.rs), p, '')); }
      else { const rs = num(ctl.r1) + num(ctl.r2), iT = rs > 0 ? num(m.uaus) / rs : 0; out.push(resTile('R1', num(ctl.r1), iT * iT * num(ctl.r1), '')); out.push(resTile('R2', num(ctl.r2), iT * iT * num(ctl.r2), '')); }
      return out;
    }
  };
  function tilesFor(rigId, ctl, m, bil) { const f = BUILD[rigId]; if (!f || !B) return []; try { return f(ctl || {}, m || {}, bil || {}).filter(Boolean); } catch (e) { return []; } }
  /* Kachel -> HTML (ein eigenes <svg> je Kachel) */
  function tileHtml(t) {
    return `<div class="nv-t${t.wide ? ' wide' : ''}"><svg viewBox="0 0 ${t.vw} ${t.vh}" role="img" aria-label="${esc(t.title)}">${t.svg}</svg><b>${esc(t.title)}</b><small>${esc(t.sub)}</small></div>`;
  }
  function cardHtml(tiles) { return tiles.map(tileHtml).join(''); }

  /* ---------- DOM-Anbindung ---------- */
  const CSS = `
.nv-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:6px 8px 10px}
@media(min-width:700px){.nv-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
.nv-t{background:var(--panel2);border:1px solid var(--line);border-radius:12px;padding:6px 8px 9px;min-width:0}
.nv-t.wide{grid-column:1/-1}.nv-t.wide svg{max-width:460px;margin:0 auto}
.nv-t svg{display:block;width:100%;height:auto}
.nv-t b{display:block;font-size:13.5px;margin:4px 0 2px}.nv-t small{display:block;font-size:12.5px;color:var(--mute);line-height:1.38}
#nvCard>summary{min-height:44px}
.nv-note{font-size:12.5px;color:var(--mute);padding:0 12px 8px;line-height:1.4;margin:0}
#cvw.nv-tall{aspect-ratio:var(--nv-ar)!important;max-height:none!important}
`;
  let last = '', tall = null;
  function injectCss() {
    if (document.getElementById('ntsviz-css')) return;
    const st = document.createElement('style'); st.id = 'ntsviz-css'; st.textContent = B.CSS + CSS; document.head.appendChild(st);
  }
  function rigOf() { return root.NTS_UI && root.NTS_UI.S && root.NTS_UI.S.rig; }
  /* Handy: hohes Bild, keine doppelte Ampelzeile im Bild */
  function wrapDraw(rg) {
    if (!rg || rg._nvw || typeof rg.draw !== 'function') return;
    const o = rg.draw; rg._nvw = 1;
    rg.draw = function (ctx, w, h, t, opt) { opt = Object.assign({}, opt || {}); if (tall) opt.header = false; return o.call(rg, ctx, w, h, t, opt); };
  }
  function layout() {
    const cvw = document.getElementById('cvw'), host = document.getElementById('rigMain'); if (!cvw || !host) return;
    const t = host.clientWidth > 0 && host.clientWidth < 600; if (t !== tall) { tall = t; cvw.classList.toggle('nv-tall', t); if (root.NTS_UI) root.NTS_UI.S.needDraw = true; }
    if (t) cvw.style.setProperty('--nv-ar', '360 / 590');
  }
  function ensureCard() {
    let c = document.getElementById('nvCard'); if (c) return c;
    const anchor = document.getElementById('meters'); if (!anchor) return null;
    c = document.createElement('details'); c.className = 'card'; c.id = 'nvCard'; c.open = true;
    c.innerHTML = '<summary>Bauteile und Bauformen</summary><div class="nv-grid" id="nvGrid"></div><p class="nv-note">Bauformen und Größen sind Richtwerte aus gängigen Datenblättern, schematisch gezeichnet. Alle Zahlen sind Übungswerte (A).</p>';
    anchor.parentNode.insertBefore(c, anchor); return c;
  }
  function refresh(force) {
    const U = root.NTS_UI; if (!U || !U.S) return; const S = U.S; layout(); wrapDraw(S.rig);
    const card = ensureCard(); if (!card) return;
    const show = S.tab === 'rig' && S.rig && !S.task && S.rigId !== 'fehler' && BUILD[S.rigId];
    card.style.display = show ? '' : 'none'; if (!show) { last = ''; return; }
    let ctl = {}, m = {}, bil = null; try { ctl = S.rig.getControls(); m = S.rig.readMeters() || {}; bil = S.rig.bilanz ? S.rig.bilanz() : null; } catch (e) { return; }
    const sig = S.rigId + '|' + JSON.stringify(ctl) + '|' + JSON.stringify(m, (k, v) => (typeof v === 'number' ? Math.round(v * 1e4) / 1e4 : v)) + '|' + JSON.stringify(bil && bil.pv);
    if (!force && sig === last) return; last = sig;
    const tiles = tilesFor(S.rigId, ctl, m, bil), g = document.getElementById('nvGrid'); if (g) g.innerHTML = cardHtml(tiles);
  }
  if (typeof document !== 'undefined' && typeof window !== 'undefined') {
    const start = () => {
      if (!B) return; injectCss();
      if (window.ResizeObserver) { const h = document.getElementById('rigMain'); if (h) new ResizeObserver(() => layout()).observe(h); }
      window.addEventListener('resize', layout);
      setInterval(() => { if (!document.hidden) { try { refresh(false); } catch (e) {} } }, 350);
      refresh(true);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  }
  const API = { tilesFor, tileHtml, cardHtml, BUILD, CSS };
  root.NTS_VIZ = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
