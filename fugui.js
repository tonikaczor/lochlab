'use strict';
/* Tonfunk Füge-Lab: Oberfläche (Lab-Kennung 'fug').
   ALLE Zahlen in diesem Lab sind ÜBUNGSWERTE für die Ausbildung, nicht für die Auslegung echter Verbindungen. Maßgebend sind Tabellenbuch, Datenblätter, Normen und die Vorgaben des Betriebs.
   Reiter: Verfahren (DIN 8593, Schlussarten), Schweißen, Löten, Kleben, Schrauben, Welle-Nabe (je Rechner mit lebendiger Grafik), Aufgaben, Trainer, Beispiele, Hilfe.
   Module: fugcore.js (FUG_CORE, Rechenlogik), fugdata.js (FUG_DATA, FUG_TASKS: Aufgaben und Beispiele), fugviz.js (FUG_VIZ: SVG-Grafiken, geladen vor dieser Datei).
   Stabile Kennungen für die zentrale Einführungstour: Reiter #tab-<k> mit data-tab (vf, sw, lo, kl, sr, wn, tasks, rt, bsp, help), Eingaben #fug-<reiter>-<feld>, Hilfe #helpView, Kopfknöpfe #bTasks #bExam #bHelp.
   Speicher (Präfix lm4.fug.): tab, vf, sw, lo, kl, sr, wn, done ({id:true} nur gelöste), prog ({id:Prozent}), hints, ctipps (nur Prüfmodus), exam ('1'), rt (Trainer).
   Tipp-Abzug (25 % je Stufe, höchstens 2 Stufen) gibt es nur im Prüfmodus; beim normalen Üben kosten Tipps nichts.
   Aufruf: fuglab.html?aufgabe=fug1 öffnet die Aufgabe, fuglab.html?bsp öffnet die Beispiele (?bsp=sw1 springt zu einem Beispiel). */
(function (root) {
  const C = root.FUG_CORE, D = root.FUG_DATA, V = root.FUG_VIZ;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.fug.';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(LS + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} };
  const f = (v, d) => C.fmtN(v, d == null ? 2 : d, true), P = s => C.parseDe(s), sc2 = v => String(v).replace('.', ',');
  const dots = l => '●'.repeat(l || 1) + '○'.repeat(3 - (l || 1));
  const fin = Number.isFinite;
  const fx = () => root.LochFX || null;
  const ding = () => { const F = fx(); if (F && F.sound) try { F.sound('ding', 0.6); } catch (e) {} };
  const sad = () => { const F = fx(); if (F && F.sound) try { F.sound('sad', 0.5); } catch (e) {} };
  const viz = spec => (V && spec ? V.render(spec) : '');
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
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>Füge-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">fugcore.js oder fugdata.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks;

  /* ============================================================ Zustand */
  const TABS = [['vf', '🧩', 'Verfahren'], ['sw', '🔥', 'Schweißen'], ['lo', '🔗', 'Löten'], ['kl', '🧴', 'Kleben'], ['sr', '🔩', 'Schrauben'], ['wn', '⚙️', 'Welle-Nabe'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['bsp', '📖', 'Beispiele'], ['help', '📘', 'Hilfe']];
  const S = {
    tab: lsGet('tab', 'vf'),
    vf: Object.assign({ v: 'sw' }, lsGet('vf', {})),
    sw: Object.assign({ nt: 'K', mode: 'a', a: '4', z: '', l: '80', F: '24000', n: '2', t: '' }, lsGet('sw', {})),
    lo: Object.assign({ art: 'weich', D: '22,2', d: '22', l: '20' }, lsGet('lo', {})),
    kl: Object.assign({ b: '25', l: '12,5', F: '1200', tauB: '15', S: '3' }, lsGet('kl', {})),
    sr: Object.assign({ M: 'M10', c: '8.8', Mset: '', mat: 'stahl' }, lsGet('sr', {})),
    wn: Object.assign({ view: 'pass', d: '30', l: '45', M: '100', U: '0,04', play: '0,04', mat: 'stahl' }, lsGet('wn', {})),
    task: null, tq: null, tAns: {}, tRes: null,
    tr: { q: null, ans: {}, res: null, level: 0 },
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {}))
  };
  const fix = () => {
    if (!C.VERF[S.vf.v]) S.vf.v = 'sw'; if (!C.NAHT[S.sw.nt]) S.sw.nt = 'K'; if (S.sw.mode !== 'z') S.sw.mode = 'a';
    if (S.lo.art !== 'hart') S.lo.art = 'weich'; if (!C.BOLT[S.sr.M]) S.sr.M = 'M10'; if (C.CLASSES.indexOf(S.sr.c) < 0) S.sr.c = '8.8'; if (!C.DEPTH[S.sr.mat]) S.sr.mat = 'stahl';
    if (S.wn.view !== 'press') S.wn.view = 'pass'; if (!C.ALPHA[S.wn.mat]) S.wn.mat = 'stahl';
  };
  fix();
  const R0 = (() => { const m = /[?&]seed=([^&]+)/.exec(location.search); return C.rng(m ? decodeURIComponent(m[1]) : String(Math.random()) + Date.now()); })();

  /* ============================================================ Bausteine */
  const box = (t, fm, res, cls) => `<div class="rdout ${cls || ''}"><span class="st">${esc(t)}</span>${fm ? esc(fm) + ' = ' : ''}<b>${esc(res)}</b></div>`;
  const note = (t, cls) => `<div class="rdout ${cls || 'warn'}">${esc(t)}</div>`;
  const inp = (tab, k, label, val, unit) => `<label class="f"><span>${esc(label)}${unit ? ' (' + esc(unit) + ')' : ''}</span><input id="fug-${tab}-${k}" data-k="${k}" inputmode="decimal" autocomplete="off" value="${esc(val)}"></label>`;
  const UEB = 'Alle Zahlen in diesem Lab sind Übungswerte für die Ausbildung, nicht für die Auslegung echter Verbindungen. Maßgebend sind Tabellenbuch, Datenblätter, Normen und die Vorgaben deines Betriebs.';
  const ueb = () => `<div class="rdout warn">⚠ ${esc(UEB)}</div>`;
  const seg = (attr, opts, cur, idp) => `<div class="seg">${opts.map(o => `<button ${attr}="${esc(o[0])}"${idp ? ` id="${idp}-${esc(o[0])}"` : ''} class="${String(cur) === String(o[0]) ? 'on' : ''}" aria-pressed="${String(cur) === String(o[0])}">${esc(o[1])}</button>`).join('')}</div>`;
  const sel = (tab, k, opts, cur) => `<select id="fug-${tab}-${k}" data-k="${k}">${opts.map(o => `<option value="${esc(o[0])}"${String(cur) === String(o[0]) ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
  const lbl = t => `<span class="lbl" style="font-size:12px;color:var(--mute)">${esc(t)}</span>`;
  const inst = svgText => (svgText ? `<div class="inst">${svgText}</div>` : '');
  const kv = rows => `<div class="kv">${rows.map(r => `<span>${esc(r[0])}</span><b>${esc(r[1])}</b>`).join('')}</div>`;

  /* ============================================================ Verfahren */
  function vfOut(id) {
    const v = C.VERF[id], g = C.DIN8593.find(x => x.n === v.din);
    return inst(V ? V.verf(id) : '') + inst(V ? V.schluss(v.s) : '') +
      `<div class="card pl"><h4>${esc(v.n)}</h4><p style="margin:0 0 6px">${esc(v.e)}</p>${kv([['Schlussart', v.s], ['Lösbar', v.lo ? 'ja, ohne Zerstörung' : 'nein (nur durch Zerstören oder Aufbohren, Aufschmelzen)'], ['DIN 8593', v.din + ' ' + g.t], ['Beispiele', v.ex]])}</div>` + inst(V ? V.din(v.din) : '');
  }
  function renderVf() {
    $('#vfView').innerHTML = ueb() + `<div class="card pl"><h4>Fügeverfahren im Überblick</h4><div class="fbar">${lbl('VERFAHREN')}${seg('data-vf', C.VERF_ORDER.map(k => [k, C.VERF[k].n]), S.vf.v, 'fug-vf')}</div><p class="hint2" style="margin-top:0">Tippe ein Verfahren an: Du siehst die Verbindung im Schnitt, die Schlussart und die Gruppe nach DIN 8593.</p></div><div id="vfOut">${vfOut(S.vf.v)}</div>`;
  }
  $('#vfView').addEventListener('click', e => { const b = e.target.closest('[data-vf]'); if (!b) return; S.vf.v = b.dataset.vf; lsSet('vf', S.vf); renderVf(); });

  /* ============================================================ Schweißen */
  const swP = s => ({ nt: C.NAHT[s.nt] ? s.nt : 'K', mode: s.mode === 'z' ? 'z' : 'a', a: P(s.a), z: P(s.z), l: P(s.l), F: P(s.F), n: Math.max(1, Math.round(P(s.n)) || 1), t: P(s.t) });
  function swOut(p) {
    const a = p.mode === 'z' ? C.kehlA(p.z) : p.a, z = p.mode === 'z' ? p.z : C.kehlZ(p.a);
    if (!(a > 0) || !(p.l > 0)) return note('Bitte a-Maß (oder z-Maß) und die Nahtlänge als Zahlen eingeben.');
    let h = '';
    h += p.mode === 'z' ? box('1. a-Maß aus dem z-Maß', 'a = z / √2 = ' + f(z, 2) + ' / 1,414', f(a, 2) + ' mm') : box('1. z-Maß aus dem a-Maß', 'z = a · √2 = ' + f(a, 2) + ' · 1,414', f(z, 2) + ' mm');
    h += box('2. Nahtquerschnitt (Dreieck)', 'A = a² = ' + f(a, 2) + '²', f(C.kehlArea(a), 2) + ' mm²');
    const At = p.n * C.seamArea(a, p.l);
    h += box('3. Tragende Nahtfläche (' + p.n + (p.n === 1 ? ' Naht' : ' Nähte') + ')', 'A = n · a · l = ' + p.n + ' · ' + f(a, 2) + ' · ' + f(p.l, 0), f(At, 1) + ' mm²');
    if (p.F > 0) h += box('4. Schubspannung in der Naht', 'τ = F / A = ' + f(p.F, 0) + ' / ' + f(At, 1), f(p.F / At, 1) + ' N/mm²');
    const vol = p.n * C.seamVolCm3(a, p.l);
    h += box('5. Schweißgut (ohne Zuschläge)', 'V = n · a² · l = ' + f(vol, 2) + ' cm³ → m = V · 7,85 g/cm³', f(vol * C.RHO_ST, 1) + ' g');
    if (p.t > 0) { const am = C.kehlAmax(p.t); h += `<div class="rdout ${a <= am + 1e-9 ? 'ok' : 'warn'}"><span class="st">6. Faustregel a ≤ 0,7 · Blechdicke (Hinweis)</span><b>${esc('0,7 · ' + f(p.t, 1) + ' mm = ' + f(am, 2) + ' mm')}</b><br>${a <= am + 1e-9 ? 'Das a-Maß liegt unter der Faustwert-Grenze.' : 'Das a-Maß liegt darüber: Mehr Naht bringt mehr Wärme und Verzug, aber nicht automatisch mehr Festigkeit.'}</div>`; }
    h += note('Mehr Nahtdicke heißt mehr Querschnitt (a²) und damit mehr Wärme und Verzug: Eine doppelt so dicke Naht hat vier Mal so viel Querschnitt.', 'ok');
    return h;
  }
  function swVizHtml(p) {
    const a = p.mode === 'z' ? C.kehlA(p.z) : p.a, z = p.mode === 'z' ? p.z : C.kehlZ(p.a);
    if (!(a > 0) || !(p.l > 0)) return '';
    return inst(V ? V.kehl({ a, z, l: p.l, F: p.F > 0 ? p.F : undefined, val: 'A = ' + f(p.n * a * p.l, 1) + ' mm²' }) : '');
  }
  function nahtVizHtml(p) { return inst(V ? V.naht({ sym: p.nt, a: p.mode === 'z' ? C.kehlA(p.z) : p.a, l: p.l }) : '') + `<p class="hint2" style="margin:2px 0 0">${esc(C.NAHT[p.nt].n)}: ${esc(C.NAHT[p.nt].d)}.</p>`; }
  function renderSw() {
    const s = S.sw;
    $('#swView').innerHTML = ueb() + `<div class="card pl"><h4>Nahtarten und Nahtsymbole</h4><div class="fbar">${lbl('NAHTART')}${seg('data-nt', C.NAHT_ORDER.map(k => [k, C.NAHT[k].n]), s.nt, 'fug-sw-nt')}</div><div id="swNaht">${nahtVizHtml(swP(s))}</div></div>
      <div class="card pl"><h4>Kehlnaht rechnen</h4><div class="fbar">${lbl('GEGEBEN')}${seg('data-mode', [['a', 'a-Maß'], ['z', 'z-Maß']], s.mode, 'fug-sw-mode')}</div>
      <div class="dsrow">${s.mode === 'z' ? inp('sw', 'z', 'z-Maß (Schenkel)', s.z, 'mm') : inp('sw', 'a', 'a-Maß (Nahtdicke)', s.a, 'mm')}${inp('sw', 'l', 'Nahtlänge l', s.l, 'mm')}${inp('sw', 'n', 'Zahl der Nähte', s.n, '')}${inp('sw', 'F', 'Kraft auf Schub (0 = keine)', s.F, 'N')}${inp('sw', 't', 'Blechdicke (optional)', s.t, 'mm')}</div>
      <p class="hint2">Zahlen mit Komma oder Punkt eingeben. Die Grafik passt sich sofort an.</p></div><div id="swOut"></div>`;
    updateSw();
  }
  function updateSw() { const p = swP(S.sw), o = $('#swOut'); if (o) o.innerHTML = swVizHtml(p) + swOut(p); const n = $('#swNaht'); if (n) n.innerHTML = nahtVizHtml(p); }

  /* ============================================================ Löten */
  const loP = s => ({ art: s.art === 'hart' ? 'hart' : 'weich', D: P(s.D), d: P(s.d), l: P(s.l) });
  function loOut(p) {
    if (!(p.D > 0) || !(p.d > 0)) return note('Bitte Muffen-Innendurchmesser D und Rohr-Außendurchmesser d als Zahlen eingeben.');
    const s = C.gapRadial(p.D, p.d), st = C.gapState(p.art, s), lim = C.GAP[p.art]; let h = '';
    if (!(s >= 0)) return note('Die Muffe muss größer sein als das Rohr (D > d), sonst ist es ein Pressverband und kein Lötspalt.', 'bad');
    const fill = st === 'ok' ? 'voll' : st === 'weit' ? 'teil' : 'wenig';
    h += inst(V ? V.loet({ D: p.D, d: p.d, s, l: p.l, fill, kind: p.art, showD: true }) : '');
    h += box('1. Lötspalt (radial)', 's = (D − d) / 2 = (' + f(p.D, 2) + ' − ' + f(p.d, 2) + ') / 2', f(s, 3) + ' mm');
    h += `<div class="rdout ${st === 'ok' ? 'ok' : 'bad'}"><span class="st">2. Bewertung (${p.art === 'weich' ? 'Weichlöten' : 'Hartlöten'}, Übungsbereich ${esc(f(lim.lo, 2))} bis ${esc(f(lim.hi, 2))} mm)</span><b>${st === 'ok' ? '✓ Spalt passt' : st === 'eng' ? '✗ Spalt zu eng' : '✗ Spalt zu weit'}</b><br>${st === 'ok' ? 'Die Kapillarkraft zieht das Lot in den ganzen Spalt.' : st === 'eng' ? 'Lot und Flussmittel kommen schlecht hinein, es bleiben Hohlräume und Flussmittelreste.' : 'Die Kapillarkraft lässt nach, das Lot füllt den Spalt nicht vollständig: Die Festigkeit sinkt.'}</div>`;
    if (p.l > 0) { const A = C.brazeArea(p.d, p.l), F = C.lotForce(C.SOLDER_TAU[p.art], A); h += box('3. Lötfläche (Mantel)', 'A = π · d · l = 3,142 · ' + f(p.d, 1) + ' · ' + f(p.l, 0), f(A, 0) + ' mm²'); h += box('4. Scherkraft (Übungswert τ = ' + C.SOLDER_TAU[p.art] + ' N/mm²)', 'F = τ · A', f(F / 1000, 1) + ' kN'); }
    h += note('Vor dem Löten: Fläche blank und fettfrei machen, Flussmittel auftragen, gleichmäßig erwärmen. Weichlöten arbeitet unter 450 °C, Hartlöten darüber.', 'ok');
    return h;
  }
  function renderLo() {
    const s = S.lo, p = loP(s), gap = C.gapRadial(p.D, p.d), cur = fin(gap) ? Math.max(0, Math.min(0.4, gap)) : 0.1;
    $('#loView').innerHTML = ueb() + `<div class="card pl"><h4>Lötspalt und Lötfläche</h4><div class="fbar">${lbl('LÖTART')}${seg('data-art', [['weich', 'Weichlöten'], ['hart', 'Hartlöten']], s.art, 'fug-lo-art')}</div>
      <div class="dsrow">${inp('lo', 'D', 'Muffe: Innendurchmesser D', s.D, 'mm')}${inp('lo', 'd', 'Rohr: Außendurchmesser d', s.d, 'mm')}${inp('lo', 'l', 'Lötlänge l', s.l, 'mm')}</div>
      <label class="f"><span>Spalt mit dem Regler verändern (stellt D passend zu d ein)</span><div class="rg"><input type="range" id="fug-lo-s" data-k="s" min="0" max="0.4" step="0.01" value="${cur}" aria-label="Lötspalt in Millimeter"><output id="loSv">${esc(f(cur, 2))} mm</output></div></label></div><div id="loOut"></div>`;
    updateLo();
  }
  function updateLo() { const o = $('#loOut'); if (o) o.innerHTML = loOut(loP(S.lo)); }

  /* ============================================================ Kleben */
  const klP = s => ({ b: P(s.b), l: P(s.l), F: P(s.F), tauB: P(s.tauB), S: P(s.S) });
  function klOut(p) {
    if (!(p.b > 0) || !(p.l > 0)) return note('Bitte Breite b und Überlappungslänge l als Zahlen eingeben.');
    const A = C.glueArea(p.b, p.l); let h = '', util = NaN;
    const tauZ = p.tauB > 0 && p.S > 0 ? p.tauB / p.S : NaN, tau = p.F >= 0 ? C.shearStrength(p.F, A) : NaN;
    if (fin(tau) && fin(tauZ)) util = tau / tauZ;
    h += inst(V ? V.kleb({ b: p.b, l: p.l, F: p.F > 0 ? p.F : undefined, util, val: 'A = ' + f(A, 1) + ' mm²' }) : '');
    h += box('1. Klebfläche', 'A = b · l = ' + f(p.b, 1) + ' · ' + f(p.l, 1), f(A, 1) + ' mm²');
    if (fin(tau)) h += box('2. Zugscherfestigkeit aus der Kraft', 'τ = F / A = ' + f(p.F, 0) + ' / ' + f(A, 1), f(tau, 2) + ' N/mm²');
    if (fin(tauZ)) { h += box('3. Zulässige Spannung', 'τ_zul = τ_B / S = ' + f(p.tauB, 1) + ' / ' + f(p.S, 1), f(tauZ, 2) + ' N/mm²'); h += box('4. Zulässige Kraft', 'F_zul = τ_zul · A', f(tauZ * A, 0) + ' N'); }
    if (fin(util)) h += `<div class="rdout ${util <= 1 ? 'ok' : 'bad'}"><span class="st">5. Auslastung</span><b>${esc(f(util * 100, 0) + ' %')}</b><br>${util <= 1 ? '✓ Die Klebung trägt die Kraft mit dem gewählten Sicherheitsbeiwert.' : '✗ Zu hoch belastet: größere Klebfläche oder festeren Klebstoff wählen.'}</div>`;
    if (p.F > 0 && p.tauB > 0 && p.S > 0) h += box('6. Mindest-Klebfläche für diese Kraft', 'A = F · S / τ_B', f(C.glueAreaNeed(p.F, p.S, p.tauB), 1) + ' mm²');
    h += note('Vorbereitung: entfetten, aufrauen, Staub entfernen, erneut entfetten, Klebstoff dünn auftragen, fixieren, Aushärtezeit abwarten. Auf Schub belasten, Schälen vermeiden.', 'ok');
    return h;
  }
  function renderKl() {
    const s = S.kl;
    $('#klView').innerHTML = ueb() + `<div class="card pl"><h4>Klebfläche und Zugscherfestigkeit</h4><div class="dsrow">${inp('kl', 'b', 'Breite b', s.b, 'mm')}${inp('kl', 'l', 'Überlappung l', s.l, 'mm')}${inp('kl', 'F', 'Kraft F', s.F, 'N')}${inp('kl', 'tauB', 'Bruchfestigkeit des Klebstoffs', s.tauB, 'N/mm²')}${inp('kl', 'S', 'Sicherheitsbeiwert S', s.S, '')}</div>
      <p class="hint2">Normprobe (Zugscherversuch): 25 mm breit, 12,5 mm überlappt, also 312,5 mm². Klebstoffwerte sind Übungszahlen.</p></div><div id="klOut"></div>`;
    updateKl();
  }
  function updateKl() { const o = $('#klOut'); if (o) o.innerHTML = klOut(klP(S.kl)); }

  /* ============================================================ Schrauben */
  const TABM = ['M3', 'M4', 'M5', 'M6', 'M8', 'M10', 'M12', 'M14', 'M16', 'M20', 'M24'];
  const srP = s => { const B = C.BOLT[s.M], Mtab = C.torque(s.M, s.c); return { M: s.M, c: s.c, B, Mtab, Mset: s.Mset !== '' && s.Mset != null && fin(P(s.Mset)) ? P(s.Mset) : Mtab, mat: s.mat }; };
  function srOut(p) {
    const B = p.B, Rm = C.boltRm(p.c), Re = C.boltRe(p.c), fyield = Re * B.As / 1000; let h = '';
    const hasM = fin(p.Mset) && p.Mset > 0, Fv = hasM ? C.preload(p.Mset, B.d) : NaN, ratio = hasM ? C.utilPreload(Fv, p.M, p.c) : NaN;
    h += inst(V ? V.schraube({ M: p.M, c: p.c, ratio: fin(ratio) ? ratio : undefined, Fv, Mnm: hasM ? p.Mset : undefined }) : '');
    h += box('1. Festigkeitsklasse ' + p.c, 'Rm = ' + p.c.split('.')[0] + ' · 100, Re = ' + p.c.split('.')[0] + ' · ' + p.c.split('.')[1] + ' · 10', f(Rm, 0) + ' N/mm² und ' + f(Re, 0) + ' N/mm²');
    h += box('2. Passende Mutter', 'Zahl vor dem Punkt', 'Festigkeitsklasse ' + C.nutFor(p.c));
    h += box('3. Löcher für ' + p.M + ' (P = ' + f(B.P, 2) + ' mm)', 'Kernloch / Durchgangsloch (mittel)', f(B.kern, 1) + ' mm / ' + f(B.dh, 1) + ' mm');
    h += box('4. Spannungsquerschnitt und Streckgrenzkraft', 'As = ' + f(B.As, 1) + ' mm², F = Re · As', f(fyield, 1) + ' kN');
    if (fin(p.Mtab)) h += box('5. Anzugsmoment aus der Übungstabelle', p.M + ', ' + p.c, f(p.Mtab, 1) + ' Nm'); else h += note('Für ' + p.M + ' mit Klasse ' + p.c + ' enthält die Übungstabelle kein Anzugsmoment (Tabelle: M5 bis M20 mit 8.8, 10.9, 12.9). Stelle ein Moment mit dem Regler ein.');
    if (hasM) {
      h += box('6. Vorspannkraft bei ' + f(p.Mset, 1) + ' Nm', 'F_V = M / (0,2 · d) = ' + f(p.Mset, 1) + ' / (0,2 · ' + B.d + ')', f(Fv, 1) + ' kN');
      h += `<div class="rdout ${ratio > 1 ? 'bad' : ratio > 0.9 ? 'warn' : 'ok'}"><span class="st">7. Ausnutzung der Streckgrenze (F_V / (Re · As))</span><b>${esc(f(ratio * 100, 0) + ' %')}</b><br>${ratio > 1 ? '✗ Die Schraube wird über die Streckgrenze belastet: Sie würde plastisch gelängt oder reißen.' : ratio > 0.9 ? '⚠ Sehr hohe Ausnutzung (über 90 %). Dem Betrieb bleibt kaum Reserve.' : '✓ Die Vorspannkraft liegt im üblichen Bereich unter 90 % der Streckgrenze.'}</div>`;
      h += box('8. Übertragbare Querkraft durch Reibung (μ = ' + f(C.MU_T, 2) + ', eine Reibfläche)', 'F_Q = μ · F_V', f(C.frictionLoad(Fv, C.MU_T, 1), 1) + ' kN');
    }
    h += box('9. Einschraubtiefe in ' + C.DEPTH[p.mat].n + ' (Faustwert ' + f(C.DEPTH[p.mat].f, 2) + ' · d)', '', f(C.screwDepth(p.mat, B.d), 1) + ' mm');
    h += note('Anzugsmomente gelten nur für die angenommenen Reibwerte (trocken oder leicht geölt). Mit Drehmomentschlüssel kreuzweise und in Stufen anziehen; ein zu hohes Moment überlastet die Schraube, ein zu niedriges lässt zu wenig Vorspannkraft entstehen.', 'ok');
    return h;
  }
  function renderSr() {
    const s = S.sr, p = srP(s), mx = Math.round((fin(p.Mtab) ? p.Mtab : 50) * 1.6), cur = fin(p.Mset) ? Math.min(mx, p.Mset) : 0;
    $('#srView').innerHTML = ueb() + `<div class="card pl"><h4>Schraube wählen</h4><div class="dsrow"><label class="f"><span>Gewinde</span>${sel('sr', 'M', TABM.map(m => [m, m]), s.M)}</label><label class="f"><span>Festigkeitsklasse</span>${sel('sr', 'c', C.CLASSES.map(c => [c, c]), s.c)}</label><label class="f"><span>Werkstoff des Gewindelochs</span>${sel('sr', 'mat', Object.keys(C.DEPTH).map(k => [k, C.DEPTH[k].n]), s.mat)}</label></div>
      <label class="f"><span>Anzugsmoment mit dem Regler einstellen (Tabellenwert: ${fin(p.Mtab) ? esc(f(p.Mtab, 1)) + ' Nm' : 'keiner'})</span><div class="rg"><input type="range" id="fug-sr-Mset" data-k="Mset" min="0" max="${mx}" step="0.5" value="${cur}" aria-label="Anzugsmoment in Newtonmeter"><output id="srMv">${esc(f(cur, 1))} Nm</output></div></label>
      <div class="btns sm"><button class="btn" id="fug-sr-tab" data-sr="tab"${fin(p.Mtab) ? '' : ' disabled'}>Tabellenwert einstellen</button></div></div><div id="srOut"></div>`;
    updateSr();
  }
  function updateSr() { const o = $('#srOut'); if (o) o.innerHTML = srOut(srP(S.sr)); }

  /* ============================================================ Welle-Nabe */
  const wnP = s => ({ view: s.view === 'press' ? 'press' : 'pass', d: P(s.d), l: P(s.l), M: P(s.M), U: P(s.U), play: P(s.play), mat: C.ALPHA[s.mat] ? s.mat : 'stahl' });
  /* PRUEFEN P27: Hinweistexte im Rechner (Passfeder: zulässige Pressung nur im Tabellenbuch, kein Grenzwert im Lab; Pressverband: Fügen heiß mit Sicherheitshinweis, Werkstatttemperatur 20 °C; Schraube: Drehmomentschlüssel, kreuzweise in Stufen). Sollen konkrete zulässige Pressungen oder Fügetemperaturen genannt werden? */
  function wnOut(p) {
    if (!(p.d > 0)) return note('Bitte den Wellendurchmesser d als Zahl eingeben.');
    let h = '';
    if (p.view === 'pass') {
      const K = C.keyFor(p.d);
      if (!K) return note('Für diesen Durchmesser enthält die Übungstabelle keine Passfeder (Wellen über 6 bis 58 mm).');
      const ltr = C.keyLtr(p.l, K.b), pr = C.keyPress(p.M, p.d, K.h, K.t1, ltr), info = [];
      if (fin(ltr)) info.push('l = ' + f(p.l, 0) + ' mm, l_tr = ' + f(ltr, 0) + ' mm');
      if (fin(pr)) info.push('p = ' + f(pr, 1) + ' N/mm²');
      h += inst(V ? V.pass({ d: p.d, info }) : '');
      h += box('1. Passfeder nach DIN 6885 (Form A) für d = ' + f(p.d, 0) + ' mm', 'b × h', f(K.b, 0) + ' × ' + f(K.h, 0) + ' mm');
      h += box('2. Nuttiefen', 't1 (Welle) / t2 (Nabe)', f(K.t1, 1) + ' mm / ' + f(K.t2, 1) + ' mm');
      if (fin(ltr)) h += box('3. Tragende Länge', 'l_tr = l − b = ' + f(p.l, 0) + ' − ' + f(K.b, 0), f(ltr, 0) + ' mm'); else h += note('Die Passfederlänge muss größer sein als die Breite b.');
      if (fin(pr)) h += box('4. Flächenpressung bei ' + f(p.M, 0) + ' Nm', 'p = 2 · M / (d · (h − t1) · l_tr) = ' + f(2 * p.M * 1000, 0) + ' / (' + f(p.d, 0) + ' · ' + f(K.h - K.t1, 1) + ' · ' + f(ltr, 0) + ')', f(pr, 1) + ' N/mm²');
      h += note('Die Passfeder überträgt das Drehmoment mit ihren Flanken (Formschluss). Zulässige Pressungen stehen im Tabellenbuch; sie hängen vom Werkstoff der Nabe ab.', 'ok');
    } else {
      const dT = C.expandDT(p.U, p.play, p.d, p.mat);
      if (!fin(dT)) return note('Bitte Übermaß und Fügespiel als Zahlen (0 oder größer) eingeben.');
      h += inst(V ? V.press({ U: p.U, play: p.play, dT }) : '');
      h += box('1. Notwendiges Wachstum der Bohrung', 'Übermaß + Spiel = ' + f(p.U, 3) + ' + ' + f(p.play, 3), f(p.U + p.play, 3) + ' mm');
      h += box('2. Erwärmung der Nabe (' + C.ALPHA[p.mat].n + ', α = ' + C.ALPHA[p.mat].a + ' · 10⁻⁶ pro K)', 'ΔT = (U + Spiel) / (α · d)', f(dT, 0) + ' K');
      h += box('3. Temperatur der Nabe bei 20 °C Werkstattwärme', '20 °C + ΔT', f(20 + dT, 0) + ' °C');
      h += note('Fügen: Nabe erwärmen (Schrumpfen) oder Welle kühlen, dann zügig fügen. Beim Abkühlen entsteht die Pressung, die Welle und Nabe hält (Kraftschluss). Sicherheitsvorgaben des Betriebs für heiße Teile beachten.', 'ok');
    }
    return h;
  }
  function renderWn() {
    const s = S.wn;
    $('#wnView').innerHTML = ueb() + `<div class="card pl"><h4>Welle-Nabe-Verbindung</h4><div class="fbar">${lbl('ART')}${seg('data-wv', [['pass', 'Passfeder'], ['press', 'Pressverband']], s.view, 'fug-wn-view')}</div>
      <div class="dsrow">${inp('wn', 'd', 'Wellendurchmesser d', s.d, 'mm')}${s.view === 'pass' ? inp('wn', 'l', 'Passfederlänge l', s.l, 'mm') + inp('wn', 'M', 'Drehmoment M', s.M, 'Nm') : inp('wn', 'U', 'Übermaß U', s.U, 'mm') + inp('wn', 'play', 'Fügespiel', s.play, 'mm') + `<label class="f"><span>Werkstoff der Nabe</span>${sel('wn', 'mat', Object.keys(C.ALPHA).map(k => [k, C.ALPHA[k].n]), s.mat)}</label>`}</div></div><div id="wnOut"></div>`;
    updateWn();
  }
  function updateWn() { const o = $('#wnOut'); if (o) o.innerHTML = wnOut(wnP(S.wn)); }

  /* Eingabe-Verteiler der Rechner-Reiter */
  const CALC = { sw: [updateSw, renderSw], lo: [updateLo, renderLo], kl: [updateKl, renderKl], sr: [updateSr, renderSr], wn: [updateWn, renderWn] };
  Object.keys(CALC).forEach(tab => {
    const v = $('#' + tab + 'View');
    const onIn = e => {
      const k = e.target.dataset && e.target.dataset.k; if (!k) return;
      if (tab === 'lo' && k === 's') { const sv = parseFloat(e.target.value), d = P(S.lo.d); if (fin(sv) && d > 0) { S.lo.D = sc2(C.rd(d + 2 * sv, 3)); const di = $('#fug-lo-D'); if (di) di.value = S.lo.D; const o = $('#loSv'); if (o) o.textContent = f(sv, 2) + ' mm'; lsSet('lo', S.lo); updateLo(); } return; }
      if (tab === 'sr' && k === 'Mset') { S.sr.Mset = sc2(e.target.value); const o = $('#srMv'); if (o) o.textContent = f(parseFloat(e.target.value), 1) + ' Nm'; lsSet('sr', S.sr); updateSr(); return; }
      if (e.target.tagName === 'SELECT') return;
      S[tab][k] = e.target.value; lsSet(tab, S[tab]); CALC[tab][0]();
    };
    v.addEventListener('input', onIn);
    v.addEventListener('change', e => {
      const k = e.target.dataset && e.target.dataset.k; if (!k || e.target.tagName !== 'SELECT') return;
      S[tab][k] = e.target.value; if (tab === 'sr' && (k === 'M' || k === 'c')) S.sr.Mset = ''; lsSet(tab, S[tab]); CALC[tab][1]();
    });
    v.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.nt) { S.sw.nt = b.dataset.nt; lsSet('sw', S.sw); renderSw(); }
      else if (b.dataset.mode) { const p = swP(S.sw); if (b.dataset.mode === 'z' && p.a > 0) S.sw.z = sc2(C.rd(C.kehlZ(p.a), 2)); if (b.dataset.mode === 'a' && p.z > 0) S.sw.a = sc2(C.rd(C.kehlA(p.z), 2)); S.sw.mode = b.dataset.mode; lsSet('sw', S.sw); renderSw(); }
      else if (b.dataset.art) { S.lo.art = b.dataset.art; lsSet('lo', S.lo); renderLo(); }
      else if (b.dataset.sr === 'tab') { S.sr.Mset = ''; lsSet('sr', S.sr); renderSr(); }
      else if (b.dataset.wv) { S.wn.view = b.dataset.wv; lsSet('wn', S.wn); renderWn(); }
    });
  });

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
  const qText = t => `<p style="margin:8px 0;white-space:pre-line">${esc(t)}</p>`;
  function qBody(q, a, r, pre) {
    const dn = r && (r.ok || pre === 'rt'), as = q.ask; let h = '';
    if (q.viz) h += inst(viz(q.viz));
    if (as.type === 'choice') h += `<div class="opts">${as.choices.map((c, i) => `<button data-tc="${i}" ${dn ? 'disabled' : ''} class="${r && i === as.correct && dn ? 'ok' : a.c === i ? (r && !r.ok ? 'bad' : 'on') : ''}">${esc(c)}</button>`).join('')}</div>`;
    else if (as.type === 'num') h += `<label class="f"><span>${esc(as.label)}${as.unit ? ' (' + esc(as.unit) + ')' : ''}</span><div class="qin"><input id="fug-ans-${pre}" data-in="1" inputmode="decimal" autocomplete="off" value="${esc(a.v || '')}" ${dn ? 'disabled' : ''}><span class="u">${esc(as.unit)}</span></div></label>`;
    else if (as.type === 'order') { const o = a.o || []; h += `<p class="hint2" style="margin:4px 0">Tippe die Einträge in der richtigen Reihenfolge an. Nochmal tippen nimmt einen Eintrag zurück.</p><div class="opts">${as.items.map((t, i) => { const k = o.indexOf(i); return `<button data-to="${i}" ${dn ? 'disabled' : ''} class="${k >= 0 ? 'on' : ''}"><span class="no">${k >= 0 ? k + 1 : '·'}</span> ${esc(t)}</button>`; }).join('')}</div><div class="btns"><button class="btn" data-oc="1" ${dn ? 'disabled' : ''}>↺ Reihenfolge zurücksetzen</button></div>`; }
    else if (as.type === 'match') { const m = a.m || []; h += `<div class="mrows">${as.rows.map((t, i) => `<label class="mrow"><span>${esc(t)}</span><select data-mr="${i}" ${dn ? 'disabled' : ''}><option value="">– wählen –</option>${as.options.map((op, j) => `<option value="${j}"${m[i] === j ? ' selected' : ''}>${esc(op)}</option>`).join('')}</select></label>`).join('')}</div>`; }
    return h;
  }
  function evalQ(q, a) { const e = D.evaluate(q, a); if (e.err) { toast(e.err); return null; } return e; }
  const resBlock = (q, r, showExpl) => `<ul class="tl"><li class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓ Richtig: ' + esc(r.given) : '✗ Deine Antwort „' + esc(r.given) + '“ stimmt nicht.'}</li>${q.ask.type === 'num' && q.tol > 0.011 ? `<li>ℹ Erlaubte Abweichung: ±${esc(f(q.tol, 2))} ${esc(q.ask.unit)} (wegen Rundung).</li>` : ''}</ul>` +
    (showExpl ? `<div class="rdout ${r.ok ? 'ok' : 'bad'}"><b>Lösung:</b> ${esc(D.solText(q))}<br><br><b>Lösungsweg:</b> ${esc(q.expl)}</div>` : '<div class="rdout bad">🎓 Prüfmodus: Den Lösungsweg gibt es erst, wenn die Aufgabe richtig gelöst ist. Nutze einen Tipp oder versuche es noch einmal.</div>');

  function renderTasks(top) {
    const Vw = $('#taskView'), d = done(), prog = lsGet('prog', {}), t = curTask(), n100 = TASKS.filter(x => d[x.id]).length; let h = '';
    if (t) {
      const q = S.tq, r = S.tRes && S.tRes.id === t.id ? S.tRes : null, a = S.tAns[t.id] || (S.tAns[t.id] = {});
      h += `<div class="card pl" id="taskCard" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv">${dots(t.level)}</div>${qText(q.text)}${qBody(q, a, r, 'tk')}`;
      h += `<div class="btns"><button class="btn pri" id="fug-task-check" data-ta="chk"${r && r.ok ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" id="fug-task-hint" data-ta="hint">💡 Tipp</button><button class="btn" data-ta="close">Schließen</button></div>`;
      if (exam()) h += '<p class="hint2" style="color:var(--warn)">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>';
      if (r) { h += resBlock(q, r, r.ok || !exam()); if (r.ok) h += `<div class="btns"><button class="btn pri" data-ta="next">Nächste Aufgabe</button></div>`; }
      h += '</div>';
    }
    h += `<p class="hint2" style="margin:4px 0 0">${n100} von ${TASKS.length} Aufgaben gelöst. ${exam() ? '🎓 Prüfmodus ist an.' : 'Tipp: Im Prüfmodus (🎓 oben) zählen Tipps als Abzug.'}</p><p class="hint2" style="margin:4px 0 0">⚠ ${esc(UEB)}</p>`;
    let last = '';
    TASKS.forEach(x => { if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; } const p = prog[x.id]; h += `<button class="row" data-t="${esc(x.id)}"><span class="dot ${d[x.id] ? 'g' : ''}">${d[x.id] ? '✓' : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${dots(x.level)}</span>${p != null && p < 100 ? ' · bisher ' + p + ' %' : ''}</small></div></button>`; });
    Vw.innerHTML = h; if (top !== false) $('#pgTasks').scrollTop = 0;
  }
  function checkTask(t) {
    const a = S.tAns[t.id] || {}, e = evalQ(S.tq, a); if (!e) return; const pct = e.ok ? pctFor(t.id) : 0;
    S.tRes = { id: t.id, ok: e.ok, given: e.given, pct };
    if (e.ok) { markSolved(t.id, pct); const F = fx(); if (F && F.pass) try { F.pass(pct); } catch (er) {} else ding(); toast(exam() && pct < 100 ? pct + ' % (Tipps abgezogen)' : '🎉 Geschafft!'); } else { sad(); toast('Noch nicht richtig. Lies die Hinweise und versuche es noch einmal.'); }
    renderTasks(false);
  }
  function hintFor(q, id) {
    const h = lsGet('hints', {}), n = Math.min(2, (h[id] || 0) + 1), ex = exam(); h[id] = Math.max(h[id] || 0, n); lsSet('hints', h);
    if (ex && id !== 'rt') { const c = lsGet('ctipps', {}); c[id] = Math.max(c[id] || 0, n); lsSet('ctipps', c); }
    sheet('Tipp, Stufe ' + n + ' von 2', b => {
      let x = `<p style="margin-top:0"><b>Stufe 1:</b> ${esc(q.tips[0])}</p>`; if (n >= 2) x += `<p><b>Stufe 2:</b> ${esc(q.tips[1])}</p>`;
      x += n >= 2 ? '<p class="hint2">Mehr Tipps gibt es nicht. Den Lösungsweg siehst du nach dem Prüfen.</p>' : '<p class="hint2">Noch mehr Hilfe? Tippe noch einmal auf „Tipp“.</p>';
      x += ex && id !== 'rt' ? '<p class="hint2" style="color:var(--warn)">Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>' : '<p class="hint2">Beim normalen Üben kosten Tipps nichts. Im Prüfmodus (🎓) zählen sie.</p>';
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
  tv.addEventListener('change', e => { const t = curTask(), mr = e.target.dataset && e.target.dataset.mr; if (t && mr != null) { const a = S.tAns[t.id] = S.tAns[t.id] || {}; a.m = a.m || []; a.m[+mr] = e.target.value === '' ? null : +e.target.value; if (S.tRes && !S.tRes.ok) { S.tRes = null; renderTasks(false); } } });
  tv.addEventListener('keydown', e => { const t = curTask(); if (t && e.key === 'Enter' && e.target.dataset.in) { e.preventDefault(); checkTask(t); } });
  tv.addEventListener('click', e => {
    const t = curTask(), tc = e.target.closest('[data-tc]'), ta = e.target.closest('[data-ta]'), row = e.target.closest('.row[data-t]'), to = e.target.closest('[data-to]'), oc = e.target.closest('[data-oc]');
    if (tc && t) { (S.tAns[t.id] = S.tAns[t.id] || {}).c = +tc.dataset.tc; if (S.tRes && !S.tRes.ok) S.tRes = null; renderTasks(false); return; }
    if (to && t) { const a = S.tAns[t.id] = S.tAns[t.id] || {}, o = a.o = a.o || [], i = +to.dataset.to, k = o.indexOf(i); if (k >= 0) o.splice(k, 1); else o.push(i); if (S.tRes && !S.tRes.ok) S.tRes = null; renderTasks(false); return; }
    if (oc && t) { (S.tAns[t.id] = S.tAns[t.id] || {}).o = []; if (S.tRes && !S.tRes.ok) S.tRes = null; renderTasks(false); return; }
    if (ta && t) { const a = ta.dataset.ta; if (a === 'chk') checkTask(t); else if (a === 'hint') hintFor(S.tq, t.id); else if (a === 'close') { S.task = null; S.tRes = null; renderTasks(); } else if (a === 'next') { const i = TASKS.findIndex(x => x.id === t.id), nx = TASKS.slice(i + 1).find(x => !done()[x.id]) || TASKS[(i + 1) % TASKS.length]; startTask(nx.id); } return; }
    if (row) startTask(row.dataset.t);
  });

  /* Zufalls-Trainer (Tipps kosten hier nie etwas) */
  function newTrainer() { const T = S.tr; T.q = D.randomQ(R0, T.level); T.ans = {}; T.res = null; renderTrainer(); }
  function renderTrainer() {
    const T = S.tr; if (!T.q) { newTrainer(); return; }
    const q = T.q;
    $('#rtView').innerHTML = `<div class="stats"><div class="bx"><b>${S.rt.n}</b>Fragen</div><div class="bx"><b>${S.rt.ok}</b>richtig</div><div class="bx"><b>${S.rt.streak}</b>Serie</div><div class="bx"><b>${S.rt.best}</b>Beste Serie</div></div>
      <div class="fbar">${lbl('STUFE')}<div class="seg">${[[0, 'Alle'], [1, '1'], [2, '2'], [3, '3']].map(l => `<button data-lv="${l[0]}" class="${T.level === l[0] ? 'on' : ''}">${l[1]}</button>`).join('')}</div></div>
      <div class="card pl"><h4>${esc(q.cat)} · <span class="lv">${dots(q.level)}</span></h4><div class="big">${esc(q.title)}</div>${qText(q.text)}${qBody(q, T.ans, T.res, 'rt')}
      <div class="btns"><button class="btn pri" id="fug-rt-check" data-ra="chk" ${T.res ? 'disabled' : ''}>✓ Prüfen</button><button class="btn" data-ra="hint" ${T.res ? 'disabled' : ''}>💡 Tipp</button><button class="btn" data-ra="next">${T.res ? 'Nächste Frage' : 'Überspringen'}</button></div>
      ${T.res ? resBlock(q, T.res, true) : ''}</div>`;
  }
  const rv = $('#rtView');
  rv.addEventListener('input', e => { if (e.target.dataset.in) S.tr.ans.v = e.target.value; });
  rv.addEventListener('change', e => { const mr = e.target.dataset && e.target.dataset.mr; if (mr != null && !S.tr.res) { const a = S.tr.ans; a.m = a.m || []; a.m[+mr] = e.target.value === '' ? null : +e.target.value; } });
  rv.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.in) { e.preventDefault(); trainerCheck(); } });
  rv.addEventListener('click', e => {
    const T = S.tr, tc = e.target.closest('[data-tc]'), ra = e.target.closest('[data-ra]'), lv = e.target.closest('[data-lv]'), to = e.target.closest('[data-to]'), oc = e.target.closest('[data-oc]');
    if (lv) { T.level = +lv.dataset.lv; newTrainer(); return; }
    if (tc && !T.res) { T.ans.c = +tc.dataset.tc; renderTrainer(); return; }
    if (to && !T.res) { const o = T.ans.o = T.ans.o || [], i = +to.dataset.to, k = o.indexOf(i); if (k >= 0) o.splice(k, 1); else o.push(i); renderTrainer(); return; }
    if (oc && !T.res) { T.ans.o = []; renderTrainer(); return; }
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
    if (e.tab === 'sw') { const q = swP(p); return swVizHtml(q) + swOut(q); }
    if (e.tab === 'lo') return loOut(loP(p));
    if (e.tab === 'kl') return klOut(klP(p));
    if (e.tab === 'sr') return srOut(srP(Object.assign({}, p, { mat: 'stahl' })));
    if (e.tab === 'wn') return wnOut(wnP(p));
    return vfOut(p.v);
  }
  function renderBsp() {
    $('#bspView').innerHTML = `<p class="hint2" style="margin:0 0 8px">Fertig durchgerechnete Beispiele (Übungswerte). Mit „In den Rechner laden“ öffnest du die Zahlen im passenden Reiter und kannst sie verändern.</p>` + D.examples.map(e => `<div class="card pl" id="ex_${e.id}"><h4>Beispiel</h4><div class="big">${esc(e.title)}</div><p style="margin:4px 0 8px">${esc(e.text)}</p>${exBody(e)}<div class="btns"><button class="btn pri" data-ex="${e.id}">In den Rechner laden</button></div></div>`).join('');
  }
  function loadExample(x) {
    const p = x.p;
    if (x.tab === 'sw') S.sw = Object.assign({}, S.sw, p); else if (x.tab === 'lo') S.lo = Object.assign({}, S.lo, p); else if (x.tab === 'kl') S.kl = Object.assign({}, S.kl, p);
    else if (x.tab === 'sr') S.sr = Object.assign({}, S.sr, p); else if (x.tab === 'wn') S.wn = Object.assign({}, S.wn, p); else S.vf = Object.assign({}, S.vf, p);
    fix(); lsSet(x.tab, S[x.tab]); setTab(x.tab);
  }
  $('#bspView').addEventListener('click', e => {
    const b = e.target.closest('[data-ex]'); if (!b) return; const x = D.examples.find(z => z.id === b.dataset.ex); if (!x) return;
    loadExample(x); toast('Beispiel geladen: ' + x.title);
  });

  /* ============================================================ Hilfe */
  function renderHelp() {
    const sec = (id, t, b, open) => `<details id="help-${id}"${open ? ' open' : ''}><summary>${t}</summary><div class="hb2">${b}</div></details>`;
    const tb = (head, rows) => `<table><tr>${head.map(x => `<th>${esc(x)}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map(x => `<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</table>`;
    $('#helpView').innerHTML =
      `<div class="rdout warn">⚠ ${esc(UEB)}</div>` +
      sec('din', 'Fügen nach DIN 8593', tb(['Nr.', 'Untergruppe', 'Beispiele'], C.DIN8593.map(g => [g.n, g.t, g.ex])) + `<p><b>Stoffschluss:</b> Schweißen, Löten, Kleben (unlösbar). <b>Formschluss:</b> Niet, Passfeder, Bolzen. <b>Kraftschluss:</b> Schrauben (Vorspannung), Pressverband, Klemmen (Reibung).</p>`, true) +
      sec('sw', 'Schweißen', `<span class="eq">a = z / √2 ≈ 0,707 · z · Querschnitt A = a²</span><span class="eq">tragende Fläche A = n · a · l · τ = F / A</span><span class="eq">Schweißgut: V = a² · l, m = V · 7,85 g/cm³</span>` + tb(['Nr.', 'Verfahren', 'Schutzgas'], Object.keys(C.PROC).map(k => [k, C.PROC[k].n, C.PROC[k].gas])) + tb(['Position', 'Name'], Object.keys(C.POS).map(k => [k, C.POS[k].n])) + `<p>Nahtsymbol: das a-Maß steht vor dem Symbol, die Länge dahinter. Verzug entsteht durch Wärme und Schrumpfung: Heften, Spannen, Schweißfolge und kleines a-Maß helfen.</p>`) +
      sec('lo', 'Löten', `<span class="eq">Lötspalt s = (D − d) / 2</span><span class="eq">Lötfläche A = π · d · l</span><p>Weichlöten arbeitet unter 450 °C, Hartlöten darüber. Das Lot schmilzt, der Grundwerkstoff nicht. Übungsbereich Lötspalt: Weichlöten ${C.GAP.weich.lo} bis ${C.GAP.weich.hi} mm, Hartlöten ${C.GAP.hart.lo} bis ${C.GAP.hart.hi} mm. Flussmittel löst Oxide und lässt das Lot benetzen.</p>`) +
      sec('kl', 'Kleben', `<span class="eq">Klebfläche A = b · l</span><span class="eq">Zugscherfestigkeit τ = F / A</span><span class="eq">zulässige Kraft F = τ_B / S · A, Fläche A = F · S / τ_B</span><p>Auf Schub belasten, Schälen und Spalten vermeiden. Ablauf: entfetten, aufrauen, Staub entfernen, erneut entfetten, Klebstoff dünn auftragen, fügen, aushärten.</p>`) +
      sec('ni', 'Nieten, Klemmen, Stecken', `<span class="eq">Nietlänge L = Σ t + 1,5 · d (Halbrundniet)</span><span class="eq">Scherkraft F = n · m · (π/4) · d² · τ</span><p>Niete sind formschlüssig und unlösbar (Abscheren, Lochleibung). Blindniete setzt man von einer Seite. Sicherungsringe: DIN 471 für Wellen (außen), DIN 472 für Bohrungen (innen). Splint sichert eine Kronenmutter formschlüssig.</p>`) +
      sec('sr', 'Schrauben', `<span class="eq">Rm = x · 100, Re = x · y · 10 (Klasse x.y)</span><span class="eq">F_V = M / (0,2 · d), Ausnutzung F_V / (Re · As)</span><span class="eq">Querkraft durch Reibung F_Q = μ · n · F_V</span>` +
        tb(['Gewinde', 'P', 'Kernloch', 'Durchgangsloch (mittel)', 'As'], C.BOLT_ORDER.map(k => [k, f(C.BOLT[k].P, 2), f(C.BOLT[k].kern, 1), f(C.BOLT[k].dh, 1), f(C.BOLT[k].As, 1) + ' mm²'])) +
        tb(['Anzugsmoment (Nm)', '8.8', '10.9', '12.9'], C.TORQ_ORDER.map(k => [k, f(C.TORQ[k]['8.8'], 1), f(C.TORQ[k]['10.9'], 1), f(C.TORQ[k]['12.9'], 1)])) +
        `<p>Einschraubtiefe: Stahl 1,0 · d, Gusseisen 1,25 · d, Aluminium 2,0 · d. Montage: reinigen, ansetzen, kreuzweise in Stufen anziehen, Moment kontrollieren, sichern.</p>`) +
      sec('wn', 'Welle-Nabe', tb(['Welle d über … bis', 'b × h', 't1', 't2'], C.KEYS.map(k => [k.lo + ' bis ' + k.hi + ' mm', k.b + ' × ' + k.h, f(k.t1, 1), f(k.t2, 1)])) + `<span class="eq">l_tr = l − b (Form A) · p = 2 · M / (d · (h − t1) · l_tr)</span><span class="eq">Pressverband: ΔT = (U + Spiel) / (α · d), α Stahl 12 · 10⁻⁶ pro K</span>`) +
      `<p class="hint2">Zahlen und Begriffe sind Lehrbuch- und Übungswerte; Unsicheres ist im Quelltext mit PRUEFEN markiert.</p>`;
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  const RENDER = { vf: renderVf, sw: renderSw, lo: renderLo, kl: renderKl, sr: renderSr, wn: renderWn, tasks: renderTasks, rt: renderTrainer, bsp: renderBsp, help: renderHelp };
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" id="tab-${k}" data-tab="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.tab); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'vf'; S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.tab === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    RENDER[t]();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'Füge-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = 'Füge-Lab: ' + T[2];
  }
  function setExam(on) { lsSet('exam', on ? '1' : '0'); palSig = ''; updatePal(); toast(on ? '🎓 Prüfmodus an: Tipps kosten 25 % je Stufe.' : 'Prüfmodus aus: Tipps kosten nichts.'); if (S.tab === 'tasks') renderTasks(false); }
  let palSig = '';
  function updatePal() {
    const F = !!fx(), fxOn = F && !fx().isMuted(), n = Object.keys(done()).filter(k => TASKS.some(t => t.id === k)).length, sig = [F, fxOn, exam(), n, S.rt.streak, S.rt.best].join('|'); if (sig === palSig) return; palSig = sig;
    $('#pal').innerHTML = `${F ? `<button class="chip ${fxOn ? 'on' : ''}" data-a="fx" aria-pressed="${fxOn}" title="Effekte und Ton">${fxOn ? '🎉' : '🔇'} Effekte</button>` : ''}<button class="chip ${exam() ? 'on' : ''}" id="fug-pal-exam" data-a="exam" aria-pressed="${exam()}" title="Prüfmodus: Tipps zählen als Abzug">🎓 Prüfmodus</button><button class="chip" id="fug-pal-rand" data-a="rand" title="Zufällige Frage im Trainer">🎲 Zufallsaufgabe</button>
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
  $('#title').onclick = () => setTab('vf');
  $('#bMenu').onclick = () => {
    const rows = [['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung und Tipps'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Aufgaben mit Serien-Zähler'], ['bsp', 'Beispiele', 'Fertig durchgerechnete Beispiele zum Laden'], ['help', 'Hilfe und Formeln', 'DIN 8593, Schweißen, Löten, Kleben, Schrauben, Welle-Nabe'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben und Trainer-Serie auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
    sheet('Menü', (b, close) => {
      b.innerHTML = rows.map(r => `<button class="row" data-m="${r[0]}"><div class="grow"><b>${esc(r[1])}</b><small>${esc(r[2])}</small></div></button>`).join('');
      b.addEventListener('click', e => { const r = e.target.closest('.row'); if (!r) return; close(); const m = r.dataset.m; if (m === 'home') location.href = 'index.html'; else if (m === 'exam') setExam(!exam()); else if (m === 'reset') resetAll(); else setTab(m); });
    });
  };
  function resetAll() {
    sheet('Fortschritt zurücksetzen?', (b, close) => {
      b.innerHTML = '<p style="margin-top:0">Alle gelösten Aufgaben, Tipps und die Trainer-Serie dieses Labs werden auf diesem Gerät gelöscht. Das kann nicht rückgängig gemacht werden.</p><div class="btns"><button class="btn" data-x="no">Abbrechen</button><button class="btn danger" data-x="yes">Löschen</button></div>';
      b.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (!x) return; if (x.dataset.x === 'yes') { ['done', 'prog', 'hints', 'ctipps', 'rt'].forEach(k => { try { localStorage.removeItem(LS + k); } catch (er) {} }); S.rt = { n: 0, ok: 0, streak: 0, best: 0 }; S.task = null; S.tRes = null; palSig = ''; updatePal(); updateBadge(); if (S.tab === 'tasks') renderTasks(); toast('Fortschritt gelöscht'); } close(); });
    });
  }

  /* Schnittstelle für Karriere/Lernpfad */
  root.FUG_LAB = { id: 'fug', title: 'Füge-Lab', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.FUG_TASKS };

  /* Rauchtest für quelle/fug/test_fugcore.js (läuft nur, wenn der Test window.__FUG_TEST setzt) */
  root.FUG_UI = {
    smoke: function () {
      if (!root.__FUG_TEST) return 'nur im Test';
      try {
        TABS.forEach(t => setTab(t[0]));
        TASKS.forEach(t => {
          setTab('tasks'); startTask(t.id); const q = S.tq;
          S.tAns[t.id] = {}; checkTask(t);
          S.tAns[t.id] = D.wrongAns(q); checkTask(t); renderTasks(false);
          S.tAns[t.id] = D.solAns(q); S.tRes = null; checkTask(t);
          if (!S.tRes || !S.tRes.ok) throw new Error('Aufgabe ' + t.id + ': Musterlösung wird in der Oberfläche nicht akzeptiert');
          renderTasks(false); hintFor(q, t.id);
        });
        S.tr.level = 0; for (let k = 0; k < 60; k++) { newTrainer(); const q = S.tr.q; S.tr.ans = D.solAns(q); trainerCheck(); renderTrainer(); }
        D.examples.forEach(e => { loadExample(e); if (!exBody(e)) throw new Error('Beispiel ' + e.id + ' leer'); });
        S.sw.a = 'x'; S.sw.mode = 'a'; updateSw(); S.sw.a = '5'; S.sw.l = '0'; updateSw(); S.sw.l = '100'; S.sw.t = '3'; updateSw();
        C.NAHT_ORDER.forEach(k => { S.sw.nt = k; renderSw(); });
        S.lo.D = '21'; S.lo.d = '22'; updateLo(); S.lo.D = '22,02'; updateLo(); S.lo.D = '22,8'; renderLo(); S.lo.art = 'hart'; renderLo();
        S.kl.F = ''; S.kl.S = '0'; updateKl(); S.kl.b = '0'; updateKl();
        C.BOLT_ORDER.forEach(m => C.CLASSES.forEach(c => { S.sr.M = m; S.sr.c = c; S.sr.Mset = ''; renderSr(); S.sr.Mset = '999'; updateSr(); }));
        S.wn.view = 'pass'; [5, 20, 40, 57, 70].forEach(d => { S.wn.d = String(d); renderWn(); }); S.wn.d = '30'; S.wn.l = '5'; updateWn(); S.wn.view = 'press'; S.wn.U = 'x'; renderWn(); S.wn.U = '0,05'; Object.keys(C.ALPHA).forEach(k => { S.wn.mat = k; renderWn(); });
        C.VERF_ORDER.forEach(k => { S.vf.v = k; renderVf(); });
        setTab('bsp'); setTab('help'); return 'ok';
      } catch (e) { return e && e.stack ? e.stack : String(e); }
    }
  };

  buildTabs(); updatePal(); setTab(TABS.some(x => x[0] === S.tab) ? S.tab : 'vf');
  /* Aufruf ?aufgabe=fug1 (Startseite, Lernhefte) öffnet die Aufgabe, ?bsp die Beispiele (?bsp=sw1 springt zu einem Beispiel) */
  root.LabGoto = id => { try { if (TASKS.some(t => t.id === id)) { setTab('tasks'); startTask(id); return true; } } catch (e) {} return false; };
  try {
    const qp = new URLSearchParams(location.search), qa = qp.get('aufgabe');
    if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); }
    else if (qp.has('bsp')) { setTab('bsp'); const el = $('#ex_' + (qp.get('bsp') || '').replace(/[^a-z0-9_]/gi, '')); if (el) el.scrollIntoView(); }
  } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
