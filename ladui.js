'use strict';
/* Tonfunk Ladungssicherungs-Lab: Oberfläche (Lab-Kennung 'lad').
   ALLE Zurr-, Reib- und Mengenwerte sind ÜBUNGSWERTE für die Ausbildung, nicht für die Praxis.
   Reiter: Kräfte & Zurren, Ladefläche (interaktive SVG-Grafik), Stapeln & Kippen, Sicherungsarten, Gefahrgut, Symbole, Verantwortung, Aufgaben, Trainer, Beispiele, Hilfe.
   Module: ladcore.js (LAD_CORE, Rechenlogik), laddata.js (LAD_DATA, LAD_TASKS: Aufgaben, Beispiele, Zuordnungs-Sätze).
   Speicher (Präfix lm4.lad.): tab, kr, stap, lade, gg, mt, done ({id:true} nur gelöste), prog ({id:Prozent}), hints, ctipps (nur Prüfmodus), exam ('1'), rt (Trainer).
   Tipp-Abzug (25 % je Stufe, höchstens 2 Stufen) gibt es nur im Prüfmodus; beim normalen Üben kosten Tipps nichts.
   Aufruf: ladlab.html?aufgabe=lad1 öffnet die Aufgabe, ladlab.html?bsp öffnet die Beispiele (?bsp=zurr1 springt zu einem Beispiel). */
(function (root) {
  const C = root.LAD_CORE, D = root.LAD_DATA;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.lad.';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(LS + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} };
  const f = (v, d) => C.fmtN(v, d == null ? 2 : d, true), P = s => C.parseDe(s), sc = v => String(v).replace('.', ',');
  const dots = l => '●'.repeat(l || 1) + '○'.repeat(3 - (l || 1));
  const fx = () => root.LochFX || null;
  const ding = () => { const F = fx(); if (F && F.sound) try { F.sound('ding', 0.6); } catch (e) {} };
  const sad = () => { const F = fx(); if (F && F.sound) try { F.sound('sad', 0.5); } catch (e) {} };
  function toast(m) { const t = $('#toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), Math.max(2200, m.length * 55)); }
  function sheet(title, build) {
    const bd = document.createElement('div'); bd.className = 'backdrop';
    bd.innerHTML = `<div class="sheet" role="dialog" aria-label="${esc(title)}"><div class="sh-h"><b>${esc(title)}</b><button class="x" aria-label="Schließen">✕</button></div><div class="sh-b"></div></div>`;
    document.body.appendChild(bd);
    const close = () => bd.remove();
    bd.addEventListener('pointerdown', e => { if (e.target === bd) close(); });
    $('.x', bd).onclick = close; build($('.sh-b', bd), close); return close;
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { const b = $$('.backdrop'); if (b.length) b[b.length - 1].remove(); } });
  if (!C || !D) {
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>Ladungssicherungs-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">ladcore.js oder laddata.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks;

  /* ============================================================ Zustand */
  const TABS = [['kr', '⚖️', 'Kräfte & Zurren'], ['lade', '🚛', 'Ladefläche'], ['stap', '📦', 'Stapeln & Kippen'], ['art', '🔗', 'Sicherungsarten'], ['gg', '☣️', 'Gefahrgut'], ['sym', '🔣', 'Symbole'], ['ver', '👷', 'Verantwortung'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['bsp', '📖', 'Beispiele'], ['help', '📘', 'Hilfe']];
  const MATCH = ['art', 'gg', 'sym', 'ver'];
  const S = {
    tab: lsGet('tab', 'kr'),
    kr: Object.assign({ m: '10000', mid: 'holzn', mu: '0,3', dir: 'v', LC: '2000', STF: '400', alpha: '90' }, lsGet('kr', {})),
    stap: Object.assign({ lagen: '5', hl: '200', room: '3000', d: '1200', dir: 'v' }, lsGet('stap', {})),
    lade: Object.assign({ orient: 'laengs', kg: '700', placed: [] }, lsGet('lade', {})),
    gg: Object.assign({ a: '5', b: '100', c: '200' }, lsGet('gg', {})),
    mt: Object.assign({ art: { n: 0, ok: 0 }, gg: { n: 0, ok: 0 }, sym: { n: 0, ok: 0 }, ver: { n: 0, ok: 0 } }, lsGet('mt', {})), mq: { art: { i: -1, sel: -1 }, gg: { i: -1, sel: -1 }, sym: { i: -1, sel: -1 }, ver: { i: -1, sel: -1 } },
    task: null, tq: null, tAns: {}, tRes: null,
    tr: { q: null, ans: {}, res: null, level: 0 },
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {}))
  };
  if (!Array.isArray(S.lade.placed)) S.lade.placed = [];
  S.lade.placed = S.lade.placed.filter(p => p && ['x', 'y', 'w', 'h'].every(k => Number.isFinite(p[k])) && C.inside(p));
  if (!['laengs', 'quer'].includes(S.lade.orient)) S.lade.orient = 'laengs';
  if (!C.DIRS.some(d => d.k === S.kr.dir)) S.kr.dir = 'v';
  if (!C.DIRS.slice(0, 2).some(d => d.k === S.stap.dir)) S.stap.dir = 'v';
  MATCH.forEach(k => { if (!S.mt[k]) S.mt[k] = { n: 0, ok: 0 }; });
  const R0 = (() => { const m = /[?&]seed=([^&]+)/.exec(location.search); return C.rng(m ? decodeURIComponent(m[1]) : String(Math.random()) + Date.now()); })();

  /* ============================================================ Bausteine */
  const box = (t, fm, res, cls) => `<div class="rdout ${cls || ''}"><span class="st">${esc(t)}</span>${fm ? esc(fm) + ' = ' : ''}<b>${esc(res)}</b></div>`;
  const note = (t, cls) => `<div class="rdout ${cls || 'warn'}">${esc(t)}</div>`;
  const inp = (k, label, val, unit, attr) => `<label class="f"><span>${esc(label)}${unit ? ' (' + esc(unit) + ')' : ''}</span><input ${attr || 'data-k'}="${k}" inputmode="decimal" autocomplete="off" value="${esc(val)}"></label>`;
  const UEB = 'Alle Zurr-, Reib- und Mengenwerte in diesem Lab sind Übungswerte für die Ausbildung, nicht für die Praxis. Maßgebend sind immer die Vorschriften und die Angaben deines Betriebs.';
  const ueb = () => `<div class="rdout warn">⚠ ${esc(UEB)}</div>`;
  const seg = (attr, opts, cur) => `<div class="seg">${opts.map(o => `<button ${attr}="${esc(o[0])}" class="${String(cur) === String(o[0]) ? 'on' : ''}">${esc(o[1])}</button>`).join('')}</div>`;

  /* ============================================================ Kräfte und Zurren */
  const krParams = s => ({ m: P(s.m), mu: P(s.mu), dir: s.dir, LC: P(s.LC), STF: P(s.STF), alpha: P(s.alpha) });
  function krOut(p) {
    const d = C.dirOf(p.dir), c = d.c;
    if (!(p.m > 0)) return note('Gib eine Masse größer als 0 ein.');
    if (!(p.mu >= 0 && p.mu <= 1.5)) return note('Der Reibbeiwert µ muss eine Zahl zwischen 0 und 1,5 sein.');
    const Fg = C.gForce(p.m), Fm = C.accelForce(p.m, c), Fr = C.friction(p.mu, p.m), Fs = C.secureForce(p.m, c, p.mu), dn = C.toDaN;
    let h = box('1. Gewichtskraft', 'm · g = ' + f(p.m, 0) + ' kg · 9,81 m/s²', f(Fg, 0) + ' N (' + f(dn(Fg), 1) + ' daN)');
    h += box('2. Massenkraft ' + d.short + ' (c = ' + f(c, 1) + ')', 'm · g · c = ' + f(Fg, 0) + ' N · ' + f(c, 1), f(Fm, 0) + ' N (' + f(dn(Fm), 1) + ' daN)');
    h += box('3. Reibkraft', 'µ · m · g = ' + f(p.mu, 2) + ' · ' + f(Fg, 0) + ' N', f(Fr, 0) + ' N (' + f(dn(Fr), 1) + ' daN)');
    h += C.slips(c, p.mu) ? note('µ ist kleiner als c: Die Ladung rutscht ohne zusätzliche Sicherung.', 'bad') : note('µ ist nicht kleiner als c: Rechnerisch reicht die Reibung aus. Eine Sicherung ist trotzdem sinnvoll, denn Reibwerte können sich ändern (Nässe, Schmutz).', 'ok');
    h += box('4. Nötige Sicherungskraft der Zurrmittel', 'm · g · (c − µ) = ' + f(Fg, 0) + ' N · (' + f(c, 1) + ' − ' + f(p.mu, 2) + ')', f(Fs, 0) + ' N (' + f(dn(Fs), 1) + ' daN)');
    if (Fs > 0) {
      if (p.LC > 0) {
        const n0 = C.lashDirect(p.m, c, 0, p.LC), n1 = C.lashDirect(p.m, c, p.mu, p.LC);
        h += box('5a. Direktzurren ohne Reibung', 'm · g · c / LC = ' + f(dn(Fm), 1) + ' daN / ' + f(p.LC, 0) + ' daN = ' + f(dn(Fm) / p.LC, 2) + ', aufgerundet', n0 + ' Gurte');
        h += box('5b. Direktzurren mit Reibung', 'm · g · (c − µ) / LC = ' + f(dn(Fs), 1) + ' / ' + f(p.LC, 0) + ' = ' + f(dn(Fs) / p.LC, 2) + ', aufgerundet', n1 + ' Gurte');
      } else h += note('Gib die Zurrkraft LC (daN) größer als 0 ein, dann siehst du die Gurtanzahl beim Direktzurren.');
      if (p.mu > 0 && p.STF > 0 && p.alpha > 0 && p.alpha <= 90) {
        const nn = C.lashDown(p.m, c, p.mu, p.STF, p.alpha), sn = Math.sin(p.alpha * Math.PI / 180);
        h += box('6. Niederzurren', 'm · g · (c − µ) / (2 · µ · STF · sin α) = ' + f(Fs, 0) + ' N / (2 · ' + f(p.mu, 2) + ' · ' + f(p.STF * 10, 0) + ' N · ' + f(sn, 3) + ') = ' + f(Fs / (2 * p.mu * p.STF * 10 * sn), 2) + ', aufgerundet', nn + ' Gurte');
      } else h += note('Für das Niederzurren brauchst du µ größer als 0, STF größer als 0 und einen Zurrwinkel zwischen 1° und 90°.');
    } else h += note('Es ist keine Zurrkraft nötig, weil die Reibung den Beschleunigungsbeiwert überwiegt.', 'ok');
    return h;
  }
  function renderKr() {
    const s = S.kr;
    $('#krView').innerHTML = ueb() + `<div class="card pl"><h4>Ladung und Sicherung</h4>
      <div class="dsrow">${inp('m', 'Masse der Ladung', s.m, 'kg')}
      <label class="f"><span>Reibpaarung (Übungswert µ)</span><select data-k="mid">${C.MU.map(e => `<option value="${e.id}"${s.mid === e.id ? ' selected' : ''}>${esc(e.n)} (µ = ${esc(f(e.mu, 2))})</option>`).join('')}<option value="frei"${s.mid === 'frei' ? ' selected' : ''}>Eigener Wert</option></select></label>
      ${inp('mu', 'Reibbeiwert µ', s.mu, '')}</div>
      <div class="fbar"><span style="font-size:12px;color:var(--mute)">RICHTUNG</span>${seg('data-dir', C.DIRS.map(d => [d.k, d.short + ' (c = ' + f(d.c, 1) + ')']), s.dir)}</div>
      <div class="dsrow">${inp('LC', 'Zurrkraft LC je Gurt (Direktzurren)', s.LC, 'daN')}${inp('STF', 'Vorspannkraft STF je Gurt (Niederzurren)', s.STF, 'daN')}${inp('alpha', 'Zurrwinkel α (Niederzurren)', s.alpha, '°')}</div>
      <p class="hint2">Zahlen mit Komma oder Punkt eingeben. 1 daN = 10 N. Es wird immer auf ganze Gurte aufgerundet.</p></div><div id="krOut"></div>`;
    updateKr();
  }
  function updateKr() { $('#krOut').innerHTML = krOut(krParams(S.kr)); }
  $('#krView').addEventListener('input', e => {
    const k = e.target.dataset.k; if (!k) return;
    if (k === 'mid') { S.kr.mid = e.target.value; const m = C.MU.find(x => x.id === e.target.value); if (m) S.kr.mu = sc(m.mu); lsSet('kr', S.kr); renderKr(); return; }
    S.kr[k] = e.target.value; if (k === 'mu') { const m = C.MU.find(x => P(S.kr.mu) === x.mu); S.kr.mid = m ? m.id : 'frei'; const sel = $('select[data-k=mid]', $('#krView')); if (sel) sel.value = S.kr.mid; }
    lsSet('kr', S.kr); updateKr();
  });
  $('#krView').addEventListener('click', e => { const b = e.target.closest('[data-dir]'); if (b) { S.kr.dir = b.dataset.dir; lsSet('kr', S.kr); renderKr(); } });

  /* ============================================================ Ladefläche (interaktive Grafik) */
  const VB = [-62, -22, 1486, 300];
  function ladeSvg(placed, interactive) {
    const A = C.AREA;
    let s = `<rect class="cab" x="-52" y="40" width="50" height="165" rx="10"/><text class="dim" x="-27" y="128" text-anchor="middle" transform="rotate(-90 -27 128)" style="font-size:20px">Fahrerhaus</text>`;
    s += `<rect class="bed" x="0" y="0" width="${A.L}" height="${A.W}"/>`;
    [200, 400, 600, 800, 1000, 1200].forEach(x => { s += `<line class="g-grid" x1="${x}" x2="${x}" y1="0" y2="${A.W}"/><text class="dim" x="${x}" y="${A.W + 24}" text-anchor="middle" style="font-size:20px">${x / 100} m</text>`; });
    placed.forEach((p, i) => { s += `<g class="pal" data-pi="${i}"><rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="3"/><text x="${p.x + p.w / 2}" y="${p.y + p.h / 2 + 8}">${i + 1}</text></g>`; });
    s += `<text class="dim" x="${A.L / 2}" y="${A.W + 50}" text-anchor="middle">Ladefläche 13,60 m × 2,45 m · Fahrtrichtung nach links</text>`;
    return `<svg class="ldsvg" viewBox="${VB.join(' ')}" role="img" aria-label="Draufsicht auf die Ladefläche mit ${placed.length} Europaletten">${s}</svg>`;
  }
  /* PRUEFEN P16: Übungs-Nutzlast 24.000 kg (siehe laddata.js, Aufgabe 'Platz und Gewicht'). */
  function ladeOut(placed, kg) {
    const st = C.loadStats(placed, null, kg), A = C.AREA;
    let h = box('Paletten auf der Ladefläche', '', st.n + ' Stück');
    h += box('Belegte Länge', 'größte Palettenkante', f(st.used, 2) + ' m von 13,60 m');
    h += box('Ladeflächenausnutzung', 'Palettenfläche / Ladefläche = ' + f(st.palArea, 2) + ' m² / 33,32 m²', f(st.util, 1) + ' %');
    if (kg > 0) {
      const w = st.weight; h += box('Gesamtgewicht der Paletten', st.n + ' · ' + f(kg, 0) + ' kg', f(w, 0) + ' kg' + (w > 24000 ? '' : ' (Nutzlast im Übungswert 24.000 kg)'), w > 24000 ? 'bad' : '');
      if (w > 24000) h += note('Das Gesamtgewicht liegt über der Übungs-Nutzlast von 24.000 kg. Es dürfen nicht so viele Paletten geladen werden.', 'bad');
    }
    return h;
  }
  function renderLade() {
    const s = S.lade;
    $('#ladeView').innerHTML = ueb() + `<div class="card pl ld"><h4>Europaletten (1200 × 800 mm) platzieren</h4>
      <div class="fbar"><span style="font-size:12px;color:var(--mute)">AUSRICHTUNG</span>${seg('data-or', [['laengs', 'längs (lange Seite in Fahrtrichtung)'], ['quer', 'quer (kurze Seite in Fahrtrichtung)']], s.orient)}</div>
      <div id="ldSvg" class="inst"></div>
      <p class="hint2">Tippe auf die Ladefläche: Die Palette wird dort abgesetzt und rastet an Wand und Nachbarn ein. Tippe auf eine Palette, um sie wieder zu entfernen.</p>
      <div class="btns"><button class="btn" data-ld="undo">↶ Letzte zurück</button><button class="btn" data-ld="clear">Leeren</button><button class="btn" data-ld="fl">Reihen füllen: längs</button><button class="btn" data-ld="fq">Reihen füllen: quer</button></div>
      <div class="dsrow" style="margin-top:10px">${inp('kg', 'Gewicht je Palette', s.kg, 'kg')}</div></div><div id="ldOut"></div>`;
    updateLade();
  }
  function updateLade() {
    const s = S.lade; $('#ldSvg').innerHTML = ladeSvg(s.placed, true);
    const kg = P(s.kg), e = C.euroCount(s.orient);
    $('#ldOut').innerHTML = ladeOut(s.placed, kg) + `<p class="hint2">In dichten Reihen passen bei dieser Ausrichtung ${e.across} Paletten nebeneinander und ${e.rows} Reihen hintereinander, zusammen ${e.n} Paletten. Kannst du alle Plätze von Hand belegen?</p>`;
  }
  $('#ladeView').addEventListener('click', e => {
    const s = S.lade, svg = e.target.closest('svg.ldsvg');
    const ob = e.target.closest('[data-or]'), bt = e.target.closest('[data-ld]');
    if (ob) { s.orient = ob.dataset.or; lsSet('lade', s); renderLade(); return; }
    if (bt) {
      const a = bt.dataset.ld;
      if (a === 'undo') s.placed.pop(); else if (a === 'clear') s.placed = []; else if (a === 'fl') { s.orient = 'laengs'; s.placed = C.autoFill('laengs'); } else if (a === 'fq') { s.orient = 'quer'; s.placed = C.autoFill('quer'); }
      lsSet('lade', s); a === 'fl' || a === 'fq' ? renderLade() : updateLade(); return;
    }
    if (!svg) return;
    const r = svg.getBoundingClientRect(); if (!(r.width > 0)) return;
    const k = VB[2] / r.width, x = VB[0] + (e.clientX - r.left) * k, y = VB[1] + (e.clientY - r.top) * k;
    const hit = s.placed.findIndex(p => x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h);
    if (hit >= 0) { s.placed.splice(hit, 1); lsSet('lade', s); updateLade(); return; }
    const w = s.orient === 'laengs' ? C.EURO.l : C.EURO.w, h = s.orient === 'laengs' ? C.EURO.w : C.EURO.l, p = C.snapPlace(s.placed, x, y, w, h);
    const ok = C.canPlace(s.placed, p);
    if (!ok.ok) { sad(); toast(ok.reason === 'overlap' ? 'Dort steht schon eine Palette. Tippe woanders hin.' : 'Die Palette passt dort nicht auf die Ladefläche.'); return; }
    s.placed.push(p); lsSet('lade', s); updateLade();
  });
  $('#ladeView').addEventListener('input', e => { if (e.target.dataset.k === 'kg') { S.lade.kg = e.target.value; lsSet('lade', S.lade); updateLade(); } });

  /* ============================================================ Stapeln und Kippen */
  const stapParams = s => ({ lagen: P(s.lagen), hl: P(s.hl), room: P(s.room), d: P(s.d), dir: s.dir });
  function stapSvg(p, H) {
    const d = C.dirOf(p.dir), hs = C.cgHeight(H), W = 620, Hh = 270, sc2 = Math.min(210 / H, 300 / p.d), bw = p.d * sc2, bh = H * sc2, x0 = 150, y0 = 245 - bh, tip = C.tips(hs, p.d, d.c), col = tip ? 'var(--danger)' : 'var(--ok)';
    const cx = x0 + bw / 2, cy = 245 - hs * sc2, al = Math.max(24, d.c * 120), px = x0 + bw;
    let s = `<line class="g-ax" x1="20" x2="${W - 20}" y1="245" y2="245"/>`;
    s += `<rect x="${x0}" y="${y0}" width="${bw}" height="${bh}" fill="${col}" fill-opacity=".25" stroke="${col}" stroke-width="2"/>`;
    s += `<rect x="${x0}" y="${245 - 144 * sc2}" width="${bw}" height="${144 * sc2}" fill="var(--hi)" fill-opacity=".45"/>`;
    s += `<line class="g-opt" x1="${cx}" x2="${cx}" y1="${cy}" y2="245"/><line class="g-opt" x1="${px}" x2="${px}" y1="${cy}" y2="245" style="stroke:var(--warn)"/>`;
    s += `<circle cx="${cx}" cy="${cy}" r="6" fill="var(--fg)"/><line x1="${cx}" y1="${cy}" x2="${cx + al}" y2="${cy}" stroke="var(--hi)" stroke-width="3"/><path d="M${cx + al} ${cy} l-9 -5 v10 z" fill="var(--hi)"/>`;
    s += `<text class="g-lab" x="${cx + al + 8}" y="${cy + 4}" style="fill:var(--hi)">c · m · g</text><text class="g-lab" x="${cx + 8}" y="${cy + 22}">Schwerpunkt ${esc(f(hs, 0))} mm</text>`;
    s += `<text class="g-lab m" x="${x0 + bw / 2}" y="262" text-anchor="middle">Länge in Kraftrichtung ${esc(f(p.d, 0))} mm · Kippkante rechts</text>`;
    s += `<text class="g-lab m" x="${x0 - 8}" y="${y0 + 12}" text-anchor="end">${esc(f(H, 0))} mm</text><text class="g-lab" x="${W - 22}" y="22" text-anchor="end" style="fill:${col}">${tip ? 'kippt' : 'steht'}</text>`;
    return `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Seitenansicht der Ladeeinheit mit Schwerpunkt und Beschleunigungskraft">${s}</svg>`;
  }
  /* PRUEFEN P17: Kippwinkel und Kippgrenze gelten nur für einen gleichmäßig gepackten Quader ohne Zurrung und ohne Rutschen; Ausbildungsmodell, keine Berechnung nach VDI 2700. */
  function stapOut(p) {
    if (!(p.lagen >= 0 && p.hl >= 0 && p.d > 0)) return note('Gib Lagen, Lagenhöhe und Länge als Zahlen ein (nicht negativ, Länge größer als 0).');
    const H = C.palHeight(p.lagen, p.hl), d = C.dirOf(p.dir), hs = C.cgHeight(H), lim = C.tipLimit(p.d, d.c), tip = C.tips(hs, p.d, d.c);
    if (!(H > 0)) return note('Die Höhe muss größer als 0 sein.');
    let h = box('1. Gesamthöhe der Ladeeinheit', '144 mm + Lagen · Lagenhöhe = 144 + ' + f(p.lagen, 0) + ' · ' + f(p.hl, 0), f(H, 0) + ' mm');
    if (p.room > 0) h += box('2. Einheiten übereinander', 'Lagerhöhe / Gesamthöhe = ' + f(p.room, 0) + ' / ' + f(H, 0) + ' = ' + f(p.room / H, 2) + ', abgerundet', C.stackCount(p.room, H) + ' Stück');
    h += box('3. Schwerpunkthöhe (gleichmäßig gepackt)', 'Gesamthöhe / 2 = ' + f(H, 0) + ' / 2', f(hs, 0) + ' mm');
    h += box('4. Kippgrenze ' + d.short + ' (c = ' + f(d.c, 1) + ')', 'hs_max = (Länge / 2) / c = (' + f(p.d, 0) + ' / 2) / ' + f(d.c, 1), f(lim, 0) + ' mm');
    h += tip ? note('Der Schwerpunkt (' + f(hs, 0) + ' mm) liegt über der Kippgrenze (' + f(lim, 0) + ' mm): Die Ladung kippt ' + d.short + ', wenn sie nicht gesichert ist.', 'bad') : note('Der Schwerpunkt (' + f(hs, 0) + ' mm) liegt unter der Kippgrenze (' + f(lim, 0) + ' mm): Rechnerisch kippt die Ladung nicht (Reibung und Rutschen sind hier nicht betrachtet).', 'ok');
    const ang = C.tiltAngle(p.d, hs); if (Number.isFinite(ang)) h += box('5. Kippwinkel', 'tan α = (Länge / 2) / hs = ' + f(p.d / 2, 0) + ' / ' + f(hs, 0), f(ang, 1) + '°');
    return h + `<div class="inst">${stapSvg(p, H)}</div>`;
  }
  function renderStap() {
    const s = S.stap;
    $('#stapView').innerHTML = ueb() + `<div class="card pl"><h4>Ladeeinheit auf Europalette</h4>
      <div class="dsrow">${inp('lagen', 'Lagen Kartons', s.lagen, 'Stück')}${inp('hl', 'Höhe je Lage', s.hl, 'mm')}${inp('room', 'Lagerhöhe zum Stapeln (optional)', s.room, 'mm')}</div>
      <div class="fbar"><span style="font-size:12px;color:var(--mute)">LÄNGE IN KRAFTRICHTUNG</span>${seg('data-d', [['800', '800 mm'], ['1200', '1200 mm']], s.d)}</div>
      <div class="fbar"><span style="font-size:12px;color:var(--mute)">RICHTUNG</span>${seg('data-sd', C.DIRS.slice(0, 2).map(d => [d.k, d.short + ' (c = ' + f(d.c, 1) + ')']), s.dir)}</div>
      <p class="hint2">Die Palette selbst ist 144 mm hoch. Der Schwerpunkt liegt vereinfacht in halber Gesamthöhe.</p></div><div id="stapOut"></div>`;
    updateStap();
  }
  function updateStap() { $('#stapOut').innerHTML = stapOut(stapParams(S.stap)); }
  $('#stapView').addEventListener('input', e => { const k = e.target.dataset.k; if (!k) return; S.stap[k] = e.target.value; lsSet('stap', S.stap); updateStap(); });
  $('#stapView').addEventListener('click', e => { const a = e.target.closest('[data-d]'), b = e.target.closest('[data-sd]'); if (a) S.stap.d = a.dataset.d; else if (b) S.stap.dir = b.dataset.sd; else return; lsSet('stap', S.stap); renderStap(); });

  /* ============================================================ Zuordnungs-Reiter: Sicherungsarten, Gefahrgut, Symbole, Verantwortung */
  const FREI_TXT = ['Kategorie 1 (Faktor 50, höchstens 20 kg/l)', 'Kategorie 2 (Faktor 3, höchstens 333 kg/l)', 'Kategorie 3 (Faktor 1, höchstens 1.000 kg/l)'];
  function freiOut(p) {
    const list = [{ amount: p.a, factor: 50 }, { amount: p.b, factor: 3 }, { amount: p.c, factor: 1 }], pts = C.points(list);
    if (!Number.isFinite(pts)) return note('Bitte alle drei Mengen als Zahlen eingeben (nicht negativ).');
    let h = box('Summe der Punkte', f(p.a, 0) + ' · 50 + ' + f(p.b, 0) + ' · 3 + ' + f(p.c, 0) + ' · 1', f(pts, 0) + ' Punkte');
    h += C.exceeded(pts) ? note('Mehr als 1.000 Punkte: Die Beispiel-Freigrenze ist überschritten. Es gelten die vollen Gefahrgutvorschriften.', 'bad') : note('Nicht mehr als 1.000 Punkte: Die Beispiel-Freigrenze wird eingehalten.', 'ok');
    return h + `<p class="hint2">Nur als Beispiel: Die echten Regeln stehen im ADR (Abschnitt 1.1.3.6) und gelten nur für Stoffe mit passender Beförderungskategorie.</p>`;
  }
  const freiParams = s => ({ a: P(s.a), b: P(s.b), c: P(s.c) });
  function renderMatch(key) {
    const set = D.sets[key]; let h = `<div class="card pl"><h4>Zuordnungsübung: ${esc(set.title)}</h4><div id="mq_${key}"></div></div>`;
    if (key === 'gg') {
      h += `<div class="card pl"><h4>Orange Warntafel</h4><p style="margin:0 0 6px">Oben steht die <b>Gefahrnummer</b> (zwei bis drei Ziffern, z. B. 33 für leicht entzündbare Flüssigkeit, 80 für ätzend), darunter die vierstellige <b>UN-Nummer</b> des Stoffes.</p>
        <div class="tw"><table class="tt"><tr><th>Stoff</th><th class="n">Gefahrnummer</th><th class="n">UN-Nummer</th></tr>${D.un.map(u => `<tr><td>${esc(u[0])}</td><td class="n">${esc(u[2])}</td><td class="n">${esc(u[1])}</td></tr>`).join('')}</table></div></div>
        <div class="card pl"><h4>Mengen-Freigrenze (nur Beispiel)</h4><div class="dsrow">${inp('a', FREI_TXT[0], S.gg.a, 'kg oder l')}${inp('b', FREI_TXT[1], S.gg.b, 'kg oder l')}${inp('c', FREI_TXT[2], S.gg.c, 'kg oder l')}</div><div id="ggFrei"></div></div>`;
    }
    h += '<div class="dt">'; let last = '';
    set.items.forEach(o => {
      if (o.g !== last) { if (last) h += '</div>'; last = o.g; h += `<div class="gh">${esc(o.g)}</div><div>`; }
      h += `<details><summary>${esc(o.n)}</summary><div class="hb2"><p>${esc(o.d)}</p>${o.pts.length ? '<ul>' + o.pts.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : ''}</div></details>`;
    });
    $('#' + key + 'View').innerHTML = h + '</div></div>';
    if (key === 'gg') updateFrei();
    if (S.mq[key].i < 0) newMQ(key); else renderMQ(key);
  }
  function updateFrei() { const e = $('#ggFrei'); if (e) e.innerHTML = freiOut(freiParams(S.gg)); }
  function newMQ(key) { S.mq[key] = { i: Math.floor(R0() * D.sets[key].items.length), sel: -1 }; renderMQ(key); }
  function renderMQ(key) {
    const set = D.sets[key], q = S.mq[key], o = set.items[q.i], pool = set.items.filter(x => x.g === o.g), opts = C.shuffle(C.rng(key + q.i + ':' + S.mt[key].n), pool), done = q.sel >= 0;
    const el = $('#mq_' + key); if (!el) return;
    el.innerHTML = `<p style="margin-top:0">${esc(set.prompt)} <b>${esc(o.d)}</b></p><div class="opts">${opts.map(x => `<button data-on="${esc(x.n)}" class="${done ? (x === o ? 'ok' : set.items[q.sel] === x ? 'bad' : '') : ''}" ${done ? 'disabled' : ''}>${esc(x.n)}</button>`).join('')}</div>
      <p class="hint2">Richtig: <b>${S.mt[key].ok}</b> von <b>${S.mt[key].n}</b></p>${done ? '<div class="btns"><button class="btn pri" data-on="__next">Nächste Frage</button></div>' : ''}`;
  }
  MATCH.forEach(key => {
    $('#' + key + 'View').addEventListener('click', e => {
      const b = e.target.closest('[data-on]'); if (!b) return;
      if (b.dataset.on === '__next') { newMQ(key); return; }
      const set = D.sets[key], i = set.items.findIndex(x => x.n === b.dataset.on), right = i === S.mq[key].i;
      S.mq[key].sel = i; S.mt[key].n++; if (right) { S.mt[key].ok++; ding(); } else sad(); lsSet('mt', S.mt); renderMQ(key);
    });
  });
  $('#ggView').addEventListener('input', e => { const k = e.target.dataset.k; if (!k) return; S.gg[k] = e.target.value; lsSet('gg', S.gg); updateFrei(); });

  /* ============================================================ Aufgaben und Trainer */
  const done = () => lsGet('done', {});
  const exam = () => lsGet('exam', '0') === '1';
  function pctFor(id) { if (!exam()) return 100; return 100 - 25 * Math.min(2, lsGet('ctipps', {})[id] || 0); }
  function markSolved(id, pct) {
    const p = lsGet('prog', {}); if ((p[id] || 0) < pct) p[id] = pct; lsSet('prog', p);
    const d = done(); d[id] = true; lsSet('done', d); updateBadge(); updatePal();
  }
  function updateBadge() { const b = $('#tkBd'); if (b) b.textContent = Object.keys(done()).filter(k => TASKS.some(t => t.id === k)).length + '/' + TASKS.length; }
  const curTask = () => S.task && TASKS.find(t => t.id === S.task);
  const solText = q => (q.ask.type === 'choice' ? q.ask.choices[q.ask.correct] : f(q.value, 2) + ' ' + q.ask.unit);
  function qBody(q, a, r, pre) {
    if (q.ask.type === 'choice') return `<div class="opts">${q.ask.choices.map((c, i) => `<button data-tc="${i}" ${r && (r.ok || pre === 'rt') ? 'disabled' : ''} class="${r && i === q.ask.correct && (r.ok || pre === 'rt') ? 'ok' : a.c === i ? (r && !r.ok ? 'bad' : 'on') : ''}">${esc(c)}</button>`).join('')}</div>`;
    return `<label class="f"><span>${esc(q.ask.label)} (${esc(q.ask.unit)})</span><div class="qin"><input data-in="1" inputmode="decimal" autocomplete="off" value="${esc(a.v || '')}" ${r && (r.ok || pre === 'rt') ? 'disabled' : ''}><span class="u">${esc(q.ask.unit)}</span></div></label>`;
  }
  function evalQ(q, a) {
    if (q.ask.type === 'choice') { if (a.c == null) { toast('Wähle zuerst eine Antwort.'); return null; } return { ok: a.c === q.ask.correct, given: q.ask.choices[a.c] }; }
    const v = P(a.v); if (!Number.isFinite(v)) { toast('Bitte gib eine Zahl ein (mit Komma oder Punkt).'); return null; }
    return { ok: Math.abs(v - q.value) <= q.tol + 1e-9, given: f(v, 2) + ' ' + q.ask.unit };
  }
  const resBlock = (q, r, showExpl) => `<ul class="tl"><li class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓ Richtig: ' + esc(r.given) : '✗ Deine Antwort „' + esc(r.given) + '“ stimmt nicht.'}</li>${q.ask.type === 'num' && q.tol > 0.011 ? `<li>ℹ Erlaubte Abweichung: ±${esc(f(q.tol, 2))} ${esc(q.ask.unit)} (wegen Rundung).</li>` : ''}</ul>` +
    (showExpl ? `<div class="rdout ${r.ok ? 'ok' : 'bad'}"><b>Lösung:</b> ${esc(solText(q))}<br><br><b>Lösungsweg:</b> ${esc(q.expl)}</div>` : '<div class="rdout bad">🎓 Prüfmodus: Den Lösungsweg gibt es erst, wenn die Aufgabe richtig gelöst ist. Nutze einen Tipp oder versuche es noch einmal.</div>');

  function renderTasks(top) {
    const V = $('#taskView'), d = done(), prog = lsGet('prog', {}), t = curTask(), n100 = TASKS.filter(x => d[x.id]).length; let h = '';
    if (t) {
      const q = S.tq, r = S.tRes && S.tRes.id === t.id ? S.tRes : null, a = S.tAns[t.id] || {};
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv">${dots(t.level)}</div><p style="margin:8px 0">${esc(q.text)}</p>${qBody(q, a, r, 'tk')}`;
      h += `<div class="btns"><button class="btn pri" data-ta="chk"${r && r.ok ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" data-ta="hint">💡 Tipp</button><button class="btn" data-ta="close">Schließen</button></div>`;
      if (exam()) h += '<p class="hint2" style="color:var(--warn)">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>';
      if (r) { h += resBlock(q, r, r.ok || !exam()); if (r.ok) h += `<div class="btns"><button class="btn pri" data-ta="next">Nächste Aufgabe</button></div>`; }
      h += '</div>';
    }
    h += `<p class="hint2" style="margin:4px 0 0">${n100} von ${TASKS.length} Aufgaben gelöst. ${exam() ? '🎓 Prüfmodus ist an.' : 'Tipp: Im Prüfmodus (🎓 oben) zählen Tipps als Abzug.'}</p><p class="hint2" style="margin:4px 0 0">⚠ ${esc(UEB)}</p>`;
    let last = '';
    TASKS.forEach(x => { if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; } const p = prog[x.id]; h += `<button class="row" data-t="${esc(x.id)}"><span class="dot ${d[x.id] ? 'g' : ''}">${d[x.id] ? '✓' : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${dots(x.level)}</span>${p != null && p < 100 ? ' · bisher ' + p + ' %' : ''}</small></div></button>`; });
    V.innerHTML = h; if (top !== false) $('#pgTasks').scrollTop = 0;
  }
  function checkTask(t) {
    const a = S.tAns[t.id] || {}, e = evalQ(S.tq, a); if (!e) return; const pct = e.ok ? pctFor(t.id) : 0;
    S.tRes = { id: t.id, ok: e.ok, given: e.given, pct };
    if (e.ok) { markSolved(t.id, pct); const F = fx(); if (F && F.pass) try { F.pass(pct); } catch (er) {} else ding(); toast(exam() && pct < 100 ? pct + ' % (Tipps abgezogen)' : '🎉 Geschafft!'); } else { sad(); toast('Noch nicht richtig. Lies den Lösungsweg und versuche es noch einmal.'); }
    renderTasks(false);
  }
  function hintFor(q, id) {
    const h = lsGet('hints', {}), n = Math.min(2, (h[id] || 0) + 1), ex = exam(); h[id] = Math.max(h[id] || 0, n); lsSet('hints', h);
    if (ex) { const c = lsGet('ctipps', {}); c[id] = Math.max(c[id] || 0, n); lsSet('ctipps', c); }
    sheet('Tipp, Stufe ' + n + ' von 2', b => {
      let x = `<p style="margin-top:0"><b>Stufe 1:</b> ${esc(q.tips[0])}</p>`; if (n >= 2) x += `<p><b>Stufe 2:</b> ${esc(q.tips[1])}</p>`;
      x += n >= 2 ? '<p class="hint2">Mehr Tipps gibt es nicht. Den Lösungsweg siehst du nach dem Prüfen.</p>' : '<p class="hint2">Noch mehr Hilfe? Tippe noch einmal auf „Tipp“.</p>';
      x += ex ? '<p class="hint2" style="color:var(--warn)">Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>' : '<p class="hint2">Beim normalen Üben kosten Tipps nichts. Im Prüfmodus (🎓) zählen sie.</p>';
      b.innerHTML = x;
    });
  }
  function startTask(id) {
    const t = TASKS.find(x => x.id === id); if (!t) return;
    S.task = id; S.tq = D.makeTask(t); S.tAns = {}; S.tRes = null;
    const h = lsGet('hints', {}), c = lsGet('ctipps', {}); if (h[id]) { delete h[id]; lsSet('hints', h); } if (c[id]) { delete c[id]; lsSet('ctipps', c); }
    renderTasks();
  }
  const tv = $('#taskView');
  tv.addEventListener('input', e => { const t = curTask(); if (t && e.target.dataset.in) (S.tAns[t.id] = S.tAns[t.id] || {}).v = e.target.value; });
  tv.addEventListener('keydown', e => { const t = curTask(); if (t && e.key === 'Enter' && e.target.dataset.in) { e.preventDefault(); checkTask(t); } });
  tv.addEventListener('click', e => {
    const t = curTask(), tc = e.target.closest('[data-tc]'), ta = e.target.closest('[data-ta]'), row = e.target.closest('.row[data-t]');
    if (tc && t) { (S.tAns[t.id] = S.tAns[t.id] || {}).c = +tc.dataset.tc; if (S.tRes && !S.tRes.ok) S.tRes = null; renderTasks(false); return; }
    if (ta && t) { const a = ta.dataset.ta; if (a === 'chk') checkTask(t); else if (a === 'hint') hintFor(S.tq, t.id); else if (a === 'close') { S.task = null; S.tRes = null; renderTasks(); } else if (a === 'next') { const i = TASKS.findIndex(x => x.id === t.id), nx = TASKS.slice(i + 1).find(x => !done()[x.id]) || TASKS[(i + 1) % TASKS.length]; startTask(nx.id); } return; }
    if (row) startTask(row.dataset.t);
  });

  /* Zufalls-Trainer (Tipps kosten hier nie etwas) */
  function newTrainer() { const T = S.tr; T.q = D.randomQ(R0, T.level); T.ans = {}; T.res = null; renderTrainer(); }
  function renderTrainer() {
    const T = S.tr; if (!T.q) { newTrainer(); return; }
    const q = T.q;
    $('#rtView').innerHTML = `<div class="stats"><div class="bx"><b>${S.rt.n}</b>Fragen</div><div class="bx"><b>${S.rt.ok}</b>richtig</div><div class="bx"><b>${S.rt.streak}</b>Serie</div><div class="bx"><b>${S.rt.best}</b>Beste Serie</div></div>
      <div class="fbar"><span class="lbl" style="font-size:12px;color:var(--mute)">STUFE</span><div class="seg">${[[0, 'Alle'], [1, '1'], [2, '2'], [3, '3']].map(l => `<button data-lv="${l[0]}" class="${T.level === l[0] ? 'on' : ''}">${l[1]}</button>`).join('')}</div></div>
      <div class="card pl"><h4>${esc(q.cat)} · <span class="lv">${dots(q.level)}</span></h4><div class="big">${esc(q.title)}</div><p style="margin:8px 0">${esc(q.text)}</p>${qBody(q, T.ans, T.res, 'rt')}
      <div class="btns"><button class="btn pri" data-ra="chk" ${T.res ? 'disabled' : ''}>✓ Prüfen</button><button class="btn" data-ra="hint" ${T.res ? 'disabled' : ''}>💡 Tipp</button><button class="btn" data-ra="next">${T.res ? 'Nächste Frage' : 'Überspringen'}</button></div>
      ${T.res ? resBlock(q, T.res, true) : ''}</div>`;
  }
  const rv = $('#rtView');
  rv.addEventListener('input', e => { if (e.target.dataset.in) S.tr.ans.v = e.target.value; });
  rv.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.in) { e.preventDefault(); trainerCheck(); } });
  rv.addEventListener('click', e => {
    const T = S.tr, tc = e.target.closest('[data-tc]'), ra = e.target.closest('[data-ra]'), lv = e.target.closest('[data-lv]');
    if (lv) { T.level = +lv.dataset.lv; newTrainer(); return; }
    if (tc && !T.res) { T.ans.c = +tc.dataset.tc; renderTrainer(); return; }
    if (ra) { const a = ra.dataset.ra; if (a === 'chk') trainerCheck(); else if (a === 'hint') hintFor(T.q, 'rt'); else { if (!T.res && S.rt.streak) { S.rt.streak = 0; lsSet('rt', S.rt); } newTrainer(); updatePal(); } }
  });
  function trainerCheck() {
    const T = S.tr; if (T.res) return; const e = evalQ(T.q, T.ans); if (!e) return;
    T.res = { ok: e.ok, given: e.given }; S.rt.n++; if (e.ok) { S.rt.ok++; S.rt.streak++; S.rt.best = Math.max(S.rt.best, S.rt.streak); ding(); } else { S.rt.streak = 0; sad(); }
    lsSet('rt', S.rt); renderTrainer(); updatePal();
  }

  /* ============================================================ Beispiele */
  function exBody(e) {
    const p = e.p;
    if (e.tab === 'kr') return krOut({ m: p.m, mu: p.mu, dir: p.dir, LC: p.LC, STF: p.STF, alpha: p.alpha });
    if (e.tab === 'stap') return stapOut({ lagen: p.lagen, hl: p.hl, room: p.room, d: p.d, dir: p.dir });
    if (e.tab === 'lade') { const pl = C.autoFill(p.orient); return ladeOut(pl, p.kg) + `<div class="inst ld">${ladeSvg(pl, false)}</div>`; }
    return freiOut(p);
  }
  function renderBsp() {
    $('#bspView').innerHTML = `<p class="hint2" style="margin:0 0 8px">Fertig durchgerechnete Beispiele (Übungswerte). Mit „In den Rechner laden“ öffnest du die Zahlen im passenden Reiter und kannst sie verändern.</p>` + D.examples.map(e => `<div class="card pl" id="ex_${e.id}"><h4>Beispiel</h4><div class="big">${esc(e.title)}</div><p style="margin:4px 0 8px">${esc(e.text)}</p>${exBody(e)}<div class="btns"><button class="btn pri" data-ex="${e.id}">In den Rechner laden</button></div></div>`).join('');
  }
  $('#bspView').addEventListener('click', e => {
    const b = e.target.closest('[data-ex]'); if (!b) return; const x = D.examples.find(z => z.id === b.dataset.ex), p = x.p;
    if (x.tab === 'kr') { const m = C.MU.find(q => q.mu === p.mu); S.kr = { m: sc(p.m), mid: m ? m.id : 'frei', mu: sc(p.mu), dir: p.dir, LC: sc(p.LC), STF: sc(p.STF), alpha: sc(p.alpha) }; lsSet('kr', S.kr); }
    else if (x.tab === 'stap') { S.stap = { lagen: sc(p.lagen), hl: sc(p.hl), room: sc(p.room), d: sc(p.d), dir: p.dir }; lsSet('stap', S.stap); }
    else if (x.tab === 'lade') { S.lade = { orient: p.orient, kg: sc(p.kg), placed: C.autoFill(p.orient) }; lsSet('lade', S.lade); }
    else { S.gg = { a: sc(p.a), b: sc(p.b), c: sc(p.c) }; lsSet('gg', S.gg); }
    setTab(x.tab); toast('Beispiel geladen: ' + x.title);
  });

  /* ============================================================ Hilfe */
  function renderHelp() {
    const sec = (t, b, open) => `<details${open ? ' open' : ''}><summary>${t}</summary><div class="hb2">${b}</div></details>`;
    $('#helpView').innerHTML =
      `<div class="rdout warn">⚠ ${esc(UEB)}</div>` +
      sec('Kräfte und Reibung', `<span class="eq">Gewichtskraft F = m · g (g = 9,81 m/s²)</span><span class="eq">Reibkraft F_R = µ · m · g</span><span class="eq">1 daN = 10 N</span><p>Die Reibung hält die Ladung nur, wenn µ größer als der Beschleunigungsbeiwert c ist. Reibbeiwerte als Übungswerte (angelehnt an VDI 2700):</p><table><tr><th>Paarung</th><th>µ</th></tr>${C.MU.map(e => `<tr><td>${esc(e.n)}</td><td>${esc(f(e.mu, 2))}</td></tr>`).join('')}</table><p class="hint2">Hinweis für Ausbilder: Die Werte sind vereinfachte Übungswerte; bitte gegen das eingesetzte Lehrmaterial prüfen.</p>`, true) +
      sec('Sicherungsarten', `<p><b>Formschluss (Blockieren):</b> Die Ladung liegt dicht an Stirnwand, Bordwand, Kanthölzern oder Keilen an.</p><p><b>Kraftschluss (Niederzurren):</b> Gurte pressen die Ladung auf die Ladefläche, die Reibung hält sie.</p><p><b>Direktzurren:</b> Gurte ziehen von der Ladung direkt zum Fahrzeug und halten durch ihre Zugkraft.</p><p>Auf dem Gurtetikett: <b>LC</b> = Zurrkraft im geraden Zug (daN), <b>STF</b> = Vorspannkraft der Ratsche (daN).</p>`) +
      sec('Zurrkraft berechnen (vereinfacht)', `<table><tr><th>Richtung</th><th>Beiwert c</th></tr>${C.DIRS.map(d => `<tr><td>${esc(d.short)}</td><td>${esc(f(d.c, 1))} g</td></tr>`).join('')}</table><span class="eq">Massenkraft = m · g · c</span><span class="eq">Nötige Sicherungskraft = m · g · (c − µ), nie kleiner als 0</span><span class="eq">Direktzurren: n = m · g · (c − µ) / LC</span><span class="eq">Niederzurren: n = m · g · (c − µ) / (2 · µ · STF · sin α)</span><p>Immer auf ganze Gurte <b>aufrunden</b>. LC und STF in daN, die Kraft in N durch 10 teilen (oder LC und STF mal 10 nehmen).</p><p class="hint2">Hinweis für Ausbilder: Es fehlen bewusst Winkelfaktoren beim Direktzurren, Reibungsverluste der Ratsche und Sicherheitszuschläge. Die Formeln sind Übungsformeln.</p>`) +
      sec('Gefahrgut', `<table><tr><th>Klasse</th><th>Bedeutung</th></tr>${Object.keys(D.cls).map(k => `<tr><td>${esc(k)}</td><td>${esc(D.cls[k].replace(/^Klasse \d: /, ''))}</td></tr>`).join('')}</table><p>Die <b>orange Warntafel</b> hängt vorn und hinten am Fahrzeug. Oben steht die Gefahrnummer, darunter die vierstellige UN-Nummer. Versandstücke tragen UN-Nummer, Stoffbezeichnung und Gefahrzettel.</p><p><b>Mengen-Freigrenze (nur Beispiel):</b> Menge mal Faktor je Beförderungskategorie (1: ×50, 2: ×3, 3: ×1), die Summe darf 1.000 Punkte nicht überschreiten.</p>`) +
      sec('Stapelung und Standsicherheit', `<span class="eq">Gesamthöhe = 144 mm (Europalette) + Lagen · Lagenhöhe</span><span class="eq">Schwerpunkthöhe ≈ Gesamthöhe / 2</span><span class="eq">Kippgrenze: hs_max = (Länge in Kraftrichtung / 2) / c</span><p>Eine Ladung kippt, wenn ihr Schwerpunkt höher liegt als die Kippgrenze. Hohe, schmale Ladung kippt eher. Die Länge in Kraftrichtung ist bei Vollbremsung die Länge in Fahrtrichtung, bei Kurvenfahrt die Breite quer dazu.</p>`) +
      sec('Ladeeinheiten und Stauraum', `<p>Ladefläche im Übungsmodell: 13,60 m × 2,45 m. Europalette: 1,20 m × 0,80 m = 0,96 m².</p><table><tr><th>Ausrichtung</th><th>nebeneinander</th><th>Reihen</th><th>Paletten</th></tr><tr><td>längs (1,20 m in Fahrtrichtung)</td><td>3</td><td>11</td><td>33</td></tr><tr><td>quer (0,80 m in Fahrtrichtung)</td><td>2</td><td>17</td><td>34</td></tr></table><span class="eq">Ausnutzung = Anzahl · 0,96 m² / 33,32 m² · 100</span><p>Zusätzlich begrenzt die Nutzlast die Zahl der Paletten: Es gilt der kleinere Wert aus Platz und Gewicht.</p>`) +
      sec('Handhabungszeichen', `<table><tr><th>Zeichen</th><th>Bedeutung</th></tr>${D.sym.map(s => `<tr><td>${esc(s[0])}</td><td>${esc(s[1])}</td></tr>`).join('')}</table>`) +
      sec('Verantwortung', `<p><b>Absender:</b> transportfähige Verpackung, Kennzeichnung, Papiere; nach § 412 HGB zuständig für das beförderungssichere Verladen. <b>Verlader:</b> staut und sichert die Ladung. <b>Fahrer:</b> prüft Verkehrssicherheit von Fahrzeug und Ladung und darf mit unsicherer Ladung nicht losfahren. <b>Halter:</b> stellt geeignetes Fahrzeug und geprüfte Zurrmittel bereit.</p><p class="hint2">Stark vereinfacht; die genauen Pflichten stehen in HGB, StVO und ADR.</p>`) +
      `<p class="hint2">Zahlen und Begriffe sind Lehrbuch- und Übungswerte; Unsicheres ist im Quelltext mit PRUEFEN markiert.</p>`;
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'kr'; S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    ({ kr: renderKr, lade: renderLade, stap: renderStap, art: () => renderMatch('art'), gg: () => renderMatch('gg'), sym: () => renderMatch('sym'), ver: () => renderMatch('ver'), tasks: renderTasks, rt: renderTrainer, bsp: renderBsp, help: renderHelp })[t]();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'Ladungssicherungs-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = 'Ladungssicherungs-Lab: ' + T[2];
  }
  function setExam(on) { lsSet('exam', on ? '1' : '0'); palSig = ''; updatePal(); toast(on ? '🎓 Prüfmodus an: Tipps kosten 25 % je Stufe.' : 'Prüfmodus aus: Tipps kosten nichts.'); if (S.tab === 'tasks') renderTasks(false); }
  let palSig = '';
  function updatePal() {
    const F = !!fx(), fxOn = F && !fx().isMuted(), n = Object.keys(done()).filter(k => TASKS.some(t => t.id === k)).length, sig = [F, fxOn, exam(), n, S.rt.streak, S.rt.best].join('|'); if (sig === palSig) return; palSig = sig;
    $('#pal').innerHTML = `${F ? `<button class="chip ${fxOn ? 'on' : ''}" data-a="fx" aria-pressed="${fxOn}" title="Effekte und Ton">${fxOn ? '🎉' : '🔇'} Effekte</button>` : ''}<button class="chip ${exam() ? 'on' : ''}" data-a="exam" aria-pressed="${exam()}" title="Prüfmodus: Tipps zählen als Abzug">🎓 Prüfmodus</button><button class="chip" data-a="rand" title="Zufällige Frage im Trainer">🎲 Zufallsaufgabe</button>
      <span id="stat">Aufgaben gelöst <b>${n}/${TASKS.length}</b> · Serie <b>${S.rt.streak}</b> · Beste Serie <b>${S.rt.best}</b></span>`;
    $('#bExam').classList.toggle('on', exam()); $('#bExam').setAttribute('aria-pressed', exam());
  }
  $('#pal').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.a === 'fx') { const F = fx(); if (F) { F.setMuted(!F.isMuted()); palSig = ''; updatePal(); if (!F.isMuted()) ding(); } }
    else if (b.dataset.a === 'exam') setExam(!exam());
    else if (b.dataset.a === 'rand') { setTab('rt'); newTrainer(); }
  });
  $('#bTasks').onclick = () => setTab('tasks'); $('#bHelp').onclick = () => setTab('help'); $('#bExam').onclick = () => setExam(!exam());
  $('#title').onclick = () => setTab('kr');
  $('#bMenu').onclick = () => {
    const rows = [['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung und Tipps'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Aufgaben mit Serien-Zähler'], ['bsp', 'Beispiele', 'Fertig durchgerechnete Beispiele zum Laden'], ['help', 'Hilfe und Formeln', 'Kräfte, Zurren, Gefahrgut, Stauraum'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben und Trainer-Serie auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
    sheet('Menü', (b, close) => {
      b.innerHTML = rows.map(r => `<button class="row" data-m="${r[0]}"><div class="grow"><b>${esc(r[1])}</b><small>${esc(r[2])}</small></div></button>`).join('');
      b.addEventListener('click', e => { const r = e.target.closest('.row'); if (!r) return; close(); const m = r.dataset.m; if (m === 'home') location.href = 'index.html'; else if (m === 'exam') setExam(!exam()); else if (m === 'reset') resetAll(); else setTab(m); });
    });
  };
  function resetAll() {
    sheet('Fortschritt zurücksetzen?', (b, close) => {
      b.innerHTML = '<p style="margin-top:0">Alle gelösten Aufgaben, Tipps und die Trainer-Serie dieses Labs werden auf diesem Gerät gelöscht. Das kann nicht rückgängig gemacht werden.</p><div class="btns"><button class="btn" data-x="no">Abbrechen</button><button class="btn danger" data-x="yes">Löschen</button></div>';
      b.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (!x) return; if (x.dataset.x === 'yes') { ['done', 'prog', 'hints', 'ctipps', 'rt', 'mt'].forEach(k => { try { localStorage.removeItem(LS + k); } catch (er) {} }); S.rt = { n: 0, ok: 0, streak: 0, best: 0 }; MATCH.forEach(k => { S.mt[k] = { n: 0, ok: 0 }; }); S.task = null; S.tRes = null; palSig = ''; updatePal(); updateBadge(); if (S.tab === 'tasks') renderTasks(); toast('Fortschritt gelöscht'); } close(); });
    });
  }

  /* Schnittstelle für Karriere/Lernpfad */
  root.LAD_LAB = { id: 'lad', title: 'Ladungssicherungs-Lab', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.LAD_TASKS };

  buildTabs(); updatePal(); setTab(TABS.some(x => x[0] === S.tab) ? S.tab : 'kr');
  /* Aufruf ?aufgabe=lad1 (Startseite, Lernhefte) öffnet die Aufgabe, ?bsp die Beispiele (?bsp=zurr1 springt zu einem Beispiel) */
  root.LabGoto = id => { try { if (TASKS.some(t => t.id === id)) { setTab('tasks'); startTask(id); return true; } } catch (e) {} return false; };
  try {
    const qp = new URLSearchParams(location.search), qa = qp.get('aufgabe');
    if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); }
    else if (qp.has('bsp')) { setTab('bsp'); const el = $('#ex_' + (qp.get('bsp') || '').replace(/[^a-z0-9_]/gi, '')); if (el) el.scrollIntoView(); }
  } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
