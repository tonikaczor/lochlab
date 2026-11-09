'use strict';
/* Tonfunk Schaltschrank-Lab: Oberfläche (Lab-Kennung 'ssl').
   ALLE Größen, Verlustleistungen, Reserven und Zuordnungstabellen sind ÜBUNGSWERTE für die Ausbildung, nicht für die Planung echter Anlagen.
   Reiter: Schutz und Leitung (Rechner), Schrank-Layout (Planer mit Ziehen per Zeiger-Ereignis), Verdrahtung (Aderfarben, Klemmenplan), Prüfen (Ablauf), Aufgaben, Trainer, Beispiele, Hilfe.
   Module: sslcore.js (SSL_CORE, Rechenlogik und Regelprüfung), ssldata.js (SSL_DATA, SSL_TASKS: Aufgaben, Szenarien, Beispiele).
   Speicher (Präfix lm4.ssl.): tab, sch, lay, ver, pru, done ({id:true} nur gelöste), prog ({id:Prozent}), hints, ctipps (nur Prüfmodus), exam ('1'), rt (Trainer).
   Tipp-Abzug (25 % je Stufe, höchstens 2 Stufen) gibt es nur im Prüfmodus; beim normalen Üben kosten Tipps nichts.
   Bedienung des Schrank-Planers: Bauteil mit Finger oder Maus ziehen (Zeiger-Ereignisse), alternativ antippen und mit den Pfeiltasten (44 px) verschieben; kein Hover nötig.
   Aufruf: ssllab.html?aufgabe=ssl1 öffnet die Aufgabe, ssllab.html?bsp öffnet die Beispiele (?bsp=abg1 springt zu einem Beispiel). */
(function (root) {
  const C = root.SSL_CORE, D = root.SSL_DATA;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.ssl.';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(LS + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} };
  const f = (v, d) => C.fmtN(v, d == null ? 2 : d, true), P = s => C.parseDe(s), sc2 = v => String(v).replace('.', ',');
  const dots = l => '●'.repeat(l || 1) + '○'.repeat(3 - (l || 1));
  const fin = Number.isFinite;
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
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>Schaltschrank-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">sslcore.js oder ssldata.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks;

  /* ============================================================ Zustand */
  const TABS = [['sch', '⚡', 'Schutz & Leitung'], ['lay', '🗄️', 'Schrank-Layout'], ['ver', '🔌', 'Verdrahtung'], ['pru', '✅', 'Prüfen'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['bsp', '📖', 'Beispiele'], ['help', '📘', 'Hilfe']];
  const S = {
    tab: lsGet('tab', 'sch'),
    sch: Object.assign({ ph: '3', P: '5500', U: '400', cos: '0,85', eta: '0,87', In: '', S: '', ch: 'C' }, lsGet('sch', {})),
    lay: Object.assign({ sc: 'b', Ls: {}, A: '1,6', To: '25', Ti: '35' }, lsGet('lay', {})),
    ver: Object.assign({ view: 'x1' }, lsGet('ver', {})),
    pru: Object.assign({ done: 0, pe: 0 }, lsGet('pru', {})),
    task: null, tq: null, tAns: {}, tRes: null,
    tr: { q: null, ans: {}, res: null, level: 0 },
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {}))
  };
  if (!['1', '3'].includes(String(S.sch.ph))) S.sch.ph = '3'; if (!C.LS_CHAR[S.sch.ch]) S.sch.ch = 'B';
  if (S.sch.In && !C.LS_IN.includes(P(S.sch.In))) S.sch.In = ''; if (S.sch.S && !C.IZ[P(S.sch.S)]) S.sch.S = '';
  if (S.lay.sc !== 'free' && !D.scenarios[S.lay.sc]) S.lay.sc = 'b'; if (!S.lay.Ls || typeof S.lay.Ls !== 'object') S.lay.Ls = {};
  if (!['x1', 'schrank', 'sensor', 'huelse'].includes(S.ver.view)) S.ver.view = 'x1';
  S.pru.done = Math.max(0, Math.min(C.PRUEF_STEPS.length, +S.pru.done || 0)); S.pru.pe = Math.max(0, Math.min(C.PE_STEPS.length, +S.pru.pe || 0));
  const R0 = (() => { const m = /[?&]seed=([^&]+)/.exec(location.search); return C.rng(m ? decodeURIComponent(m[1]) : String(Math.random()) + Date.now()); })();

  /* ============================================================ Bausteine */
  const box = (t, fm, res, cls) => `<div class="rdout ${cls || ''}"><span class="st">${esc(t)}</span>${fm ? esc(fm) + ' = ' : ''}<b>${esc(res)}</b></div>`;
  const note = (t, cls) => `<div class="rdout ${cls || 'warn'}">${esc(t)}</div>`;
  const inp = (k, label, val, unit) => `<label class="f"><span>${esc(label)}${unit ? ' (' + esc(unit) + ')' : ''}</span><input data-k="${k}" inputmode="decimal" autocomplete="off" value="${esc(val)}"></label>`;
  const UEB = 'Alle Bauteilgrößen, Verlustleistungen, Reserven und Zuordnungstabellen in diesem Lab sind Übungswerte für die Ausbildung, nicht für die Planung echter Anlagen. Maßgebend sind Datenblätter, Normen und die Vorgaben deines Betriebs.';
  const ueb = () => `<div class="rdout warn">⚠ ${esc(UEB)}</div>`;
  const seg = (attr, opts, cur) => `<div class="seg">${opts.map(o => `<button ${attr}="${esc(o[0])}" class="${String(cur) === String(o[0]) ? 'on' : ''}">${esc(o[1])}</button>`).join('')}</div>`;
  const sel = (k, opts, cur) => `<select data-k="${k}">${opts.map(o => `<option value="${esc(o[0])}"${String(cur) === String(o[0]) ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
  const COLCSS = { braun: '#8a5a2b', schwarz: '#202428', grau: '#9aa1a8', blau: '#1f6feb', hellblau: '#6cc6ff', 'grün-gelb': 'repeating-linear-gradient(135deg,#2e9e3e 0 6px,#f2d21b 6px 12px)', rot: '#d83b3b', orange: '#ff8a1c', 'weiß': '#f4f4f4', gelb: '#f2d21b' };
  const colSw = n => `<span class="sw" style="background:${COLCSS[n] || '#888'}" title="${esc(n)}"></span>`;
  const colTag = n => `<span class="ctag">${colSw(n)} ${esc(n)}</span>`;

  /* ============================================================ Schutz und Leitung */
  const schParams = s => ({ ph: +s.ph === 3 ? 3 : 1, P: P(s.P), U: P(s.U), cos: P(s.cos), eta: P(s.eta), In: s.In ? P(s.In) : NaN, S: s.S ? P(s.S) : NaN, ch: C.LS_CHAR[s.ch] ? s.ch : 'B' });
  function schSvg(ib, In, iz, ok) {
    const W = 600, bx = 24, bw = 552, mx = Math.max(ib, In, iz) * 1.12, X = v => bx + Math.min(bw, Math.max(0, v / mx * bw));
    let s = `<rect x="${bx}" y="50" width="${bw}" height="26" rx="6" fill="var(--panel)" stroke="var(--mute)" stroke-width="1.5"/>`;
    s += `<rect x="${X(ib)}" y="50" width="${Math.max(0, X(iz) - X(ib))}" height="26" fill="var(--ok)" fill-opacity=".28"/>`;
    const mark = (v, lab, col, y, anchor) => `<path d="M${X(v)} 44 V82" stroke="${col}" stroke-width="3"/><text class="g-lab" x="${X(v)}" y="${y}" text-anchor="${anchor}" style="fill:${col}">${esc(lab)}</text>`;
    s += mark(ib, 'Ib ' + f(ib, 1) + ' A', 'var(--accent)', 38, 'middle') + mark(In, 'In ' + f(In, 0) + ' A', ok ? 'var(--ok)' : 'var(--danger)', 100, 'middle') + mark(iz, 'Iz ' + f(iz, 0) + ' A', 'var(--hi)', 38, 'middle');
    s += `<text class="g-lab m" x="${bx}" y="120">Der Bemessungsstrom In muss zwischen Betriebsstrom Ib und Strombelastbarkeit Iz liegen (grün).</text>`;
    return `<svg viewBox="0 0 ${W} 130" role="img" aria-label="Skala: Betriebsstrom, Bemessungsstrom des Leitungsschutzschalters und Strombelastbarkeit der Leitung">${s}</svg>`;
  }
  function schOut(p) {
    if (!(p.P >= 0) || !(p.U > 0) || !(p.cos > 0 && p.cos <= 1)) return note('Bitte Leistung, Spannung und cos φ als Zahlen eingeben (cos φ zwischen 0 und 1).');
    const eta = p.eta > 0 && p.eta <= 1 ? p.eta : 1, ib = p.ph === 3 ? C.i3(p.P, p.U, p.cos, eta) : C.i1(p.P / eta, p.U, p.cos);
    if (!fin(ib)) return note('Mit diesen Werten lässt sich kein Strom berechnen.');
    const rec = C.pickIn(ib); let h = '';
    h += p.ph === 3 ? box('1. Betriebsstrom je Außenleiter', 'P / (√3 · U · cos φ · η) = ' + f(p.P, 0) + ' / (1,732 · ' + f(p.U, 0) + ' · ' + f(p.cos, 2) + ' · ' + f(eta, 2) + ')', f(ib, 2) + ' A') : box('1. Betriebsstrom', 'P / (U · cos φ · η) = ' + f(p.P, 0) + ' / (' + f(p.U, 0) + ' · ' + f(p.cos, 2) + ' · ' + f(eta, 2) + ')', f(ib, 2) + ' A');
    if (!fin(rec)) return h + note('Der Betriebsstrom liegt über 63 A: Dafür gibt es in der Übungsreihe keinen Leitungsschutzschalter.', 'bad');
    const recS = C.minCross(rec);
    h += box('2. Kleinster passender LS (Reihe 6 bis 63 A)', 'In ≥ ' + f(ib, 2) + ' A', f(rec, 0) + ' A');
    h += box('3. Kleinster Querschnitt für diesen LS (Übungstabelle)', 'Iz ≥ ' + f(rec, 0) + ' A', fin(recS) ? f(recS, 1) + ' mm² (Iz = ' + C.izOf(recS) + ' A)' : '–');
    const In = fin(p.In) ? p.In : rec, Sx = fin(p.S) ? p.S : recS, iz = C.izOf(Sx), ab = C.abgang(ib, In, Sx);
    h += `<div class="rdout ${ab.ok ? 'ok' : 'bad'}"><span class="st">4. Prüfung deiner Wahl: LS ${esc(p.ch)}${esc(f(In, 0))} mit ${esc(f(Sx, 1))} mm²</span><b>${ab.ok ? '✓ Passt' : '✗ ' + (ab.kind === 'zugross' ? 'LS zu groß für die Leitung' : ab.kind === 'zuklein' ? 'LS zu klein für den Betriebsstrom' : 'ungültig')}</b><br>${esc(ab.why)}</div>`;
    h += box('5. Magnetische Auslösung (Charakteristik ' + p.ch + ')', C.LS_CHAR[p.ch].lo + ' bis ' + C.LS_CHAR[p.ch].hi + ' · ' + f(In, 0) + ' A', f(C.tripLow(p.ch, In), 0) + ' A bis ' + f(C.tripHigh(p.ch, In), 0) + ' A');
    if (fin(iz)) h += `<div class="inst">${schSvg(ib, In, iz, ab.ok)}</div>`;
    /* PRUEFEN P25: Hinweistext im Rechner (Häufung und Temperatur mindern die Belastbarkeit, Motorschutzschalter, Selektivität nur qualitativ). Reicht das als Hinweis, oder soll ein Umrechnungsfaktor (z. B. für Häufung) in einer späteren Version geübt werden? */
    h += note('Hinweis: Im Schaltschrank mindern Häufung der Leitungen und hohe Temperatur die Belastbarkeit; plane zusätzlich Reserve ein. Motoren schützt man vor Überlast mit einem Motorschutzschalter, nicht allein mit dem LS. Die Abstufung (Selektivität) der Schutzorgane hintereinander wird hier nur qualitativ behandelt: Das vorgeschaltete Gerät ist größer oder träger als das nachgeschaltete.', 'ok');
    return h;
  }
  function renderSch() {
    const s = S.sch;
    $('#schView').innerHTML = ueb() + `<div class="card pl"><h4>Last und Netz</h4>
      <div class="fbar"><span class="lbl" style="font-size:12px;color:var(--mute)">NETZ</span>${seg('data-ph', [['1', 'einphasig 230 V'], ['3', 'Drehstrom 400 V']], s.ph)}</div>
      <div class="dsrow">${inp('P', 'Leistung (Abgabe)', s.P, 'W')}${inp('U', 'Spannung', s.U, 'V')}${inp('cos', 'cos φ', s.cos, '')}${inp('eta', 'Wirkungsgrad (0 bis 1)', s.eta, '')}</div>
      <p class="hint2">Zahlen mit Komma oder Punkt eingeben. Bei ohmschen Lasten sind cos φ und Wirkungsgrad 1.</p></div>
      <div class="card pl"><h4>Deine Wahl</h4>
      <div class="dsrow"><label class="f"><span>Bemessungsstrom In des LS</span>${sel('In', [['', 'wie empfohlen']].concat(C.LS_IN.map(x => [String(x), x + ' A'])), s.In)}</label><label class="f"><span>Querschnitt (Kupfer)</span>${sel('S', [['', 'wie empfohlen']].concat(C.CROSS.map(x => [sc2(x), f(x, 1) + ' mm²'])), s.S)}</label></div>
      <div class="fbar"><span class="lbl" style="font-size:12px;color:var(--mute)">CHARAKTERISTIK</span>${seg('data-ch', [['B', 'B'], ['C', 'C'], ['D', 'D']], s.ch)}</div></div><div id="schOut"></div>`;
    updateSch();
  }
  function updateSch() { const o = $('#schOut'); if (o) o.innerHTML = schOut(schParams(S.sch)); }
  $('#schView').addEventListener('input', e => { const k = e.target.dataset.k; if (!k) return; S.sch[k] = e.target.value; lsSet('sch', S.sch); updateSch(); });
  $('#schView').addEventListener('change', e => { const k = e.target.dataset.k; if (!k) return; S.sch[k] = e.target.value; lsSet('sch', S.sch); updateSch(); });
  $('#schView').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.ph) { S.sch.ph = b.dataset.ph; if (S.sch.ph === '1') { S.sch.U = '230'; S.sch.cos = '1'; S.sch.eta = '1'; } else { S.sch.U = '400'; } lsSet('sch', S.sch); renderSch(); }
    else if (b.dataset.ch) { S.sch.ch = b.dataset.ch; lsSet('sch', S.sch); renderSch(); }
  });

  /* ============================================================ Schrank-Editor (SVG, Zeiger-Ereignisse) */
  const TEP = 34, ML = 44, RHT = 56, PITCH = 100, TOP = 20, BW = ML + C.RAIL_TE * TEP + 8, BH = TOP + (C.RAILS - 1) * PITCH + RHT + 44;
  const railY = r => TOP + r * PITCH;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const validIt = i => !!C.part(i.p);
  function bmkMap(L) {
    const cnt = {}, m = new Map();
    L.items.filter(validIt).forEach(it => { const k = C.part(it.p).k; cnt[k] = (cnt[k] || 0) + 1; m.set(it, '-' + k + cnt[k]); });
    return m;
  }
  function fitBad(L) {
    const bad = new Set();
    L.items.forEach((a, i) => { const p = C.part(a.p); if (!p) return; if (a.r < 0 || a.r >= C.RAILS || a.x < 0 || a.x + p.w > C.RAIL_TE) bad.add(a); L.items.forEach((b, j) => { if (j > i && C.part(b.p) && b.r === a.r && C.overlap(a, b)) { bad.add(a); bad.add(b); } }); });
    return bad;
  }
  /* Zeichnung der Montageplatte; o: { sel: Index, drag: Index } */
  function boardInner(L, o) {
    o = o || {}; const bm = bmkMap(L), bad = fitBad(L); let s = '';
    for (let r = 0; r < C.RAILS; r++) {
      const y = railY(r);
      s += `<text class="g-lab m" x="3" y="${y + RHT / 2 + 4}" style="font-size:11px">Sch.${r + 1}</text><rect class="sl-rail" x="${ML}" y="${y + RHT + 10}" width="${C.RAIL_TE * TEP}" height="6" rx="3"/>`;
      s += `<line class="sl-res" x1="${ML + C.MAX_TE * TEP}" x2="${ML + C.MAX_TE * TEP}" y1="${y - 4}" y2="${y + RHT + 8}"/>`;
      if (r < C.RAILS - 1) {
        const ky = y + RHT + 20;
        s += `<rect class="sl-kan" x="${ML}" y="${ky}" width="${C.RAIL_TE * TEP}" height="22" rx="4"/><text class="g-lab m" x="${ML + 8}" y="${ky + 15}" style="font-size:11px">Kanal ${r + 1}${L.sep && L.sep[r] ? ' · Trennsteg' : ''}</text>`;
        if (L.sep && L.sep[r]) s += `<rect class="sl-sep" x="${ML + 130}" y="${ky + 8}" width="${C.RAIL_TE * TEP - 146}" height="6" rx="2"/>`;
      }
    }
    s += `<text class="g-lab m" x="${ML + C.MAX_TE * TEP + 3}" y="${BH - 4}" style="font-size:10px">80 %</text>`;
    const order = L.items.map((_, i) => i).filter(i => validIt(L.items[i]) && i !== o.drag); if (o.drag != null && L.items[o.drag] && validIt(L.items[o.drag])) order.push(o.drag);
    order.forEach(i => {
      const it = L.items[i], p = C.part(it.p), x = ML + it.x * TEP, y = railY(clamp(it.r, 0, C.RAILS - 1)) + 4, w = p.w * TEP - 2, name = (bm.get(it) || '') ;
      const cls = 'sl-it sl-' + p.z + (p.heat ? ' sl-heat' : '') + (p.sens ? ' sl-sens' : '') + (o.sel === i ? ' sl-sel' : '') + (bad.has(it) ? ' sl-bad' : '') + (o.drag === i ? ' sl-drag' : '') + (it.lab ? '' : ' sl-nolab');
      s += `<g class="${cls}" data-i="${i}" ${o.st ? 'role="img"' : 'tabindex="0" role="button"'} aria-label="${esc(p.n + (it.lab ? ', ' + name : ', unbeschriftet') + ', Schiene ' + (it.r + 1) + ', ab TE ' + (it.x + 1))}"><title>${esc(p.n + ' · ' + p.w + ' TE · ' + p.pv + ' W Verlust')}</title><rect x="${x}" y="${y}" width="${w}" height="${RHT - 4}" rx="5"/>`;
      if (p.w >= 3) s += `<text class="g-lab" x="${x + w / 2}" y="${y + 20}" text-anchor="middle" style="font-size:11px">${esc(p.s)}</text><text class="g-lab ${it.lab ? '' : 'sl-q'}" x="${x + w / 2}" y="${y + 38}" text-anchor="middle" style="font-size:12px;font-weight:700">${it.lab ? esc(name) : '? ohne Namen'}</text>`;
      else s += `<text class="g-lab ${it.lab ? '' : 'sl-q'}" x="${x + w / 2}" y="${y + 30}" text-anchor="middle" style="font-size:${p.w === 1 ? 9 : 11}px;font-weight:700">${it.lab ? esc(name.replace('-', '')) : '?'}</text>`;
      if (p.heat && p.w >= 2) s += `<text x="${x + w - 3}" y="${y + 13}" text-anchor="end" style="font-size:12px">♨</text>`;
      s += '</g>';
    });
    return s;
  }
  const boardStatic = L => `<svg class="sl-board" viewBox="0 0 ${BW} ${BH}" role="img" aria-label="Montageplatte mit ${L.items.length} Bauteilen auf drei Hutschienen">${boardInner(L, { st: true })}</svg>`;
  const LEG = '<p class="hint2">Orange: Leistung (230/400 V), blau: Steuerung (24 V), ♨ Wärmequelle (ab 8 W), gestrichelt: noch ohne Betriebsmittelkennzeichen, rot: Platzfehler. Die gestrichelte Linie markiert 80 % der Schiene.</p>';
  let edN = 0;
  /* Editor: o = { get(), set(L), need: [Kennungen], rules: [Regeln], live: Regelanzeige, onChange() } */
  function makeEditor(el, o) {
    const id = 'ed' + (++edN); let selI = -1, drag = null, pal = null, ghost = null;
    const L = () => o.get(), part = i => (L().items[i] ? C.part(L().items[i].p) : null);
    const q = s => el.querySelector(s), svgEl = () => q('#' + id + 's');
    const commit = () => { o.set(L()); if (o.onChange) o.onChange(); };
    function missing() { const have = {}; L().items.forEach(i => { have[i.p] = (have[i.p] || 0) + 1; }); const m = []; const want = {}; o.need.forEach(p => { want[p] = (want[p] || 0) + 1; }); Object.keys(want).forEach(p => { const n = want[p] - (have[p] || 0); if (n > 0) m.push([p, n]); }); return m; }
    function trayHtml() {
      const ids = o.free ? Object.keys(C.PARTS) : missing().map(x => x[0]), cn = {}; if (!o.free) missing().forEach(x => { cn[x[0]] = x[1]; });
      if (!ids.length) return '<p class="hint2">Alle Bauteile der Liste sind eingebaut.</p>';
      return `<p class="hint2" style="margin:6px 0 4px">${o.free ? 'Bauteil antippen oder auf die Platte ziehen:' : 'Noch nicht eingebaut (antippen oder auf die Platte ziehen):'}</p><div class="tray">${ids.map(p => `<button class="chip pchip sl-${C.part(p).z}" data-add="${p}" title="${esc(C.part(p).n)}">＋ ${esc(C.part(p).s)} · ${C.part(p).w} TE${cn[p] > 1 ? ' ×' + cn[p] : ''}</button>`).join('')}</div>`;
    }
    function selHtml() {
      const it = L().items[selI], p = it && C.part(it.p);
      if (!it || !p) return '<p class="hint2">Tippe ein Bauteil an, um es mit den Pfeilen zu verschieben, zu beschriften oder zu entfernen. Oder ziehe es direkt.</p>';
      return `<div class="selbar"><div class="sel-t"><b>${esc(p.n)}</b> · Schiene ${it.r + 1}, ab TE ${it.x + 1}, ${p.w} TE breit, ${p.pv} W Verlust</div><div class="btns sm"><button class="btn" data-ea="l" aria-label="1 TE nach links">◀</button><button class="btn" data-ea="r" aria-label="1 TE nach rechts">▶</button><button class="btn" data-ea="u" aria-label="eine Schiene nach oben">▲</button><button class="btn" data-ea="d" aria-label="eine Schiene nach unten">▼</button><button class="btn ${it.lab ? 'pri' : ''}" data-ea="lab">🏷 ${it.lab ? 'beschriftet' : 'beschriften'}</button><button class="btn danger" data-ea="del">🗑 Entfernen</button></div></div>`;
    }
    function sepHtml() { const Lx = L(); return `<div class="fbar" style="margin-top:6px"><span class="lbl" style="font-size:12px;color:var(--mute)">TRENNSTEG IM KANAL</span>${[0, 1].map(k => `<button class="chip ${Lx.sep[k] ? 'on' : ''}" data-ea="sep${k}" aria-pressed="${!!Lx.sep[k]}">Kanal ${k + 1}: ${Lx.sep[k] ? 'eingebaut' : 'fehlt'}</button>`).join('')}</div>`; }
    function infoHtml() {
      const Lx = L(); let h = '<div class="stats" style="margin-top:8px">';
      for (let r = 0; r < C.RAILS; r++) { const u = C.railUsed(Lx, r); h += `<div class="bx"><b style="${u > C.MAX_TE ? 'color:var(--danger)' : ''}">${u}/${C.RAIL_TE}</b>TE Schiene ${r + 1}</div>`; }
      h += `<div class="bx"><b>${f(C.pvSum(Lx), 0)}</b>W Verlust</div></div>`;
      if (o.live) {
        const chk = C.checkLayout(Lx, o.need, o.rules);
        h += `<ul class="tl">${chk.rules.map(r => `<li class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓' : '✗'} ${esc(r.t)}${r.ok ? '' : '<br><small>' + esc(r.det.slice(0, 3).join('; ')) + (r.det.length > 3 ? ' …' : '') + '</small>'}</li>`).join('')}</ul>`;
      } else h += '<p class="hint2">Ob alle Regeln erfüllt sind, siehst du nach dem Prüfen.</p>';
      return h;
    }
    function placedHtml() { const bm = bmkMap(L()); return L().items.length ? `<div class="tray" style="margin-top:6px">${L().items.map((it, i) => validIt(it) ? `<button class="chip pchip sl-${C.part(it.p).z} ${selI === i ? 'on' : ''}" data-sel="${i}" title="Bauteil auswählen">${esc(C.part(it.p).s)} ${it.lab ? esc(bm.get(it)) : '?'}</button>` : '').join('')}</div>` : ''; }
    function refreshBoard() { const s = svgEl(); if (s) s.innerHTML = boardInner(L(), { sel: selI, drag: drag && drag.moved ? drag.i : null }); }
    function refreshTray() { const a = q('#' + id + 't'); if (a) a.innerHTML = trayHtml(); }
    function refreshPanels() { const a = q('#' + id + 'a'); if (a) a.innerHTML = selHtml() + sepHtml() + `<div class="hint2" style="margin:8px 0 2px">Eingebaut (antippen zum Auswählen):</div>` + placedHtml() + infoHtml(); }
    function refresh() { refreshBoard(); refreshTray(); refreshPanels(); }
    function render() { el.innerHTML = `<div id="${id}t"></div><div class="inst"><svg id="${id}s" class="sl-board" viewBox="0 0 ${BW} ${BH}" role="group" aria-label="Montageplatte mit drei Hutschienen und zwei Kanälen"></svg></div>${LEG}<div id="${id}a"></div>`; refresh(); }
    /* Hilfsfunktionen für Positionen */
    function pt(e) { const s = svgEl(), r = s.getBoundingClientRect(), k = BW / (r.width || BW); return { x: ((e.clientX - r.left) * k - ML) / TEP, y: (e.clientY - r.top) * k, inside: e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom }; }
    const railAt = y => clamp(Math.round((y - TOP - RHT / 2 - 4) / PITCH), 0, C.RAILS - 1);
    function nearestFree(it, r, x) {
      const w = C.part(it.p).w, others = L().items.filter(o2 => o2 !== it && validIt(o2) && o2.r === r);
      for (let d = 0; d <= C.RAIL_TE; d++) for (const xx of d ? [x - d, x + d] : [x]) { if (xx < 0 || xx + w > C.RAIL_TE) continue; if (!others.some(o2 => C.overlap({ p: it.p, x: xx }, o2))) return xx; }
      return -1;
    }
    function addPart(p, r, x) {
      const Lx = L(), pp = C.part(p), it = { p, r: 0, x: 0, lab: false };
      let rails = [0, 1, 2];
      if (r == null) { const z = pp.z; rails = rails.slice().sort((a, b) => { const sa = C.zonesOf(Lx, a), sb = C.zonesOf(Lx, b), ra = sa.length === 0 ? 1 : sa[0] === z ? 0 : 2, rb = sb.length === 0 ? 1 : sb[0] === z ? 0 : 2; return ra - rb || a - b; }); }
      else rails = [r];
      for (const rr of rails) { const xx = x == null ? C.freeSpot(Lx, p, rr) : nearestFree(it, rr, x); if (xx >= 0 && (x != null || C.railUsed(Lx, rr) + pp.w <= C.MAX_TE || rr === rails[rails.length - 1])) { it.r = rr; it.x = xx; Lx.items.push(it); selI = Lx.items.length - 1; commit(); refresh(); return true; } }
      toast('Kein freier Platz für ' + pp.s + '.'); return false;
    }
    function move(dx, dr) {
      const it = L().items[selI]; if (!it || !C.part(it.p)) return; const w = C.part(it.p).w;
      if (dx) { const nx = it.x + dx; if (nx < 0 || nx + w > C.RAIL_TE) { toast('Das Ende der Schiene ist erreicht.'); return; } if (L().items.some(o2 => o2 !== it && validIt(o2) && o2.r === it.r && C.overlap({ p: it.p, x: nx }, o2))) { toast('Dort ist schon ein Bauteil.'); return; } it.x = nx; }
      if (dr) { const nr = it.r + dr; if (nr < 0 || nr >= C.RAILS) return; const nx = nearestFree(it, nr, it.x); if (nx < 0) { toast('Auf dieser Schiene ist kein Platz.'); return; } it.r = nr; it.x = nx; }
      commit(); refresh();
    }
    /* Zeiger-Ereignisse: Ziehen von Bauteilen auf der Platte und aus der Auswahlleiste */
    el.addEventListener('pointerdown', e => {
      const g = e.target.closest && e.target.closest('.sl-it');
      if (g) {
        const i = +g.dataset.i, it = L().items[i]; if (!it || !C.part(it.p)) return; const p = pt(e);
        selI = i; drag = { i, id: e.pointerId, ox: p.x - it.x, r0: it.r, x0: it.x, sx: e.clientX, sy: e.clientY, moved: false };
        try { svgEl().setPointerCapture(e.pointerId); } catch (er) {}
        refresh(); if (e.preventDefault) e.preventDefault(); return;
      }
      const ad = e.target.closest && e.target.closest('[data-add]');
      if (ad) { pal = { p: ad.dataset.add, sx: e.clientX, sy: e.clientY, moved: false }; try { ad.setPointerCapture(e.pointerId); } catch (er) {} }
    });
    el.addEventListener('pointermove', e => {
      if (drag && e.pointerId === drag.id) {
        if (!drag.moved && Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) < 5) return; drag.moved = true;
        const it = L().items[drag.i], w = C.part(it.p).w, p = pt(e); it.x = clamp(Math.round(p.x - drag.ox), 0, C.RAIL_TE - w); it.r = railAt(p.y); refreshBoard(); if (e.preventDefault) e.preventDefault();
      } else if (pal) {
        if (!pal.moved && Math.abs(e.clientX - pal.sx) + Math.abs(e.clientY - pal.sy) < 8) return; pal.moved = true;
        if (!ghost) { ghost = document.createElement('div'); ghost.className = 'ghost'; ghost.textContent = C.part(pal.p).s + ' · ' + C.part(pal.p).w + ' TE'; document.body.appendChild(ghost); }
        ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px';
      }
    });
    function endDrag(e, cancel) {
      if (drag && e.pointerId === drag.id) {
        const d = drag; drag = null; const it = L().items[d.i];
        if (it && d.moved) { if (cancel) { it.r = d.r0; it.x = d.x0; } else { const nx = nearestFree(it, it.r, it.x); if (nx < 0) { it.r = d.r0; it.x = d.x0; toast('Kein Platz dort, das Bauteil ist zurückgesprungen.'); } else it.x = nx; } commit(); }
        refresh();
      } else if (pal) {
        const pp = pal; pal = null; if (ghost) { ghost.remove(); ghost = null; }
        if (cancel) return;
        if (!pp.moved) addPart(pp.p); else { const p = pt(e); if (p.inside) addPart(pp.p, railAt(p.y), Math.round(p.x - C.part(pp.p).w / 2)); }
      }
    }
    el.addEventListener('pointerup', e => endDrag(e, false));
    el.addEventListener('pointercancel', e => endDrag(e, true));
    el.addEventListener('touchmove', e => { if ((drag && drag.moved) || (pal && pal.moved)) { if (e.cancelable && e.preventDefault) e.preventDefault(); } }, { passive: false });
    el.addEventListener('click', e => {
      const a = e.target.closest && e.target.closest('[data-ea]'), s = e.target.closest && e.target.closest('[data-sel]');
      if (s) { selI = +s.dataset.sel; refresh(); return; }
      if (!a) return; const k = a.dataset.ea, it = L().items[selI];
      if (k === 'l') move(-1, 0); else if (k === 'r') move(1, 0); else if (k === 'u') move(0, -1); else if (k === 'd') move(0, 1);
      else if (k === 'lab' && it) { it.lab = !it.lab; commit(); refresh(); }
      else if (k === 'del' && it) { L().items.splice(selI, 1); selI = -1; commit(); refresh(); }
      else if (k === 'sep0' || k === 'sep1') { const n = +k.slice(3); L().sep[n] = !L().sep[n]; commit(); refresh(); }
    });
    el.addEventListener('keydown', e => {
      const g = e.target.closest && e.target.closest('.sl-it'); if (!g) return; const i = +g.dataset.i; if (!L().items[i]) return;
      if (e.key === 'Enter' || e.key === ' ') { selI = i; refresh(); e.preventDefault(); return; }
      if (selI !== i) selI = i;
      const m = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (m) { move(m[0], m[1]); e.preventDefault(); } else if (e.key === 'Delete') { L().items.splice(selI, 1); selI = -1; commit(); refresh(); }
    });
    render();
    return { refresh, render, select: i => { selI = i; refresh(); } };
  }
  /* Layout bereinigen (aus dem Speicher geladene Daten) */
  function cleanLayout(L) {
    const o = C.emptyLayout(); if (!L || !Array.isArray(L.items)) return o;
    L.items.forEach(i => { if (i && C.part(i.p) && Number.isInteger(i.r) && Number.isInteger(i.x) && o.items.length < 30) o.items.push({ p: i.p, r: i.r, x: i.x, lab: !!i.lab }); });
    if (Array.isArray(L.sep)) o.sep = [!!L.sep[0], !!L.sep[1]]; return o;
  }

  /* ============================================================ Schrank-Layout (Planer) */
  const layNeed = () => (D.scenarios[S.lay.sc] ? D.scenarios[S.lay.sc].need.slice() : []);
  const layRules = () => (D.scenarios[S.lay.sc] ? D.scenarios[S.lay.sc].rules.slice() : C.RULE_ORDER.filter(k => k !== 'pass'));
  const layCur = () => { if (!S.lay.Ls[S.lay.sc]) S.lay.Ls[S.lay.sc] = C.emptyLayout(); return S.lay.Ls[S.lay.sc]; };
  Object.keys(S.lay.Ls).forEach(k => { S.lay.Ls[k] = cleanLayout(S.lay.Ls[k]); });
  function heatOut(L) {
    const Pv = C.pvSum(L), A = P(S.lay.A), To = P(S.lay.To), Ti = P(S.lay.Ti); let h = box('Verlustleistung aller eingebauten Bauteile', 'Σ Verlust', f(Pv, 0) + ' W');
    if (!(A > 0) || !fin(To) || !fin(Ti)) return h + note('Gib Oberfläche und Temperaturen als Zahlen ein.');
    if (Ti <= To) return h + note('Die Innentemperatur muss höher sein als die Außentemperatur, sonst kann die Wand keine Wärme abgeben.', 'bad');
    const dT = Ti - To, wall = C.wallHeat(A, dT), need = C.coolNeed(Pv, A, dT);
    h += box('Wärmeabfuhr durch die Wand', '5,5 · ' + f(A, 1) + ' m² · ' + f(dT, 0) + ' K', f(wall, 1) + ' W');
    h += need > 0 ? box('Zusätzlich abzuführen (Lüfter oder Kühlgerät)', f(Pv, 0) + ' W − ' + f(wall, 1) + ' W', f(need, 1) + ' W', 'bad') + box('Lüfter-Volumenstrom (Näherung)', '3,1 · ' + f(need, 0) + ' / ' + f(dT, 0), f(C.fanFlow(need, dT), 0) + ' m³/h') : note('Die Wand führt die Verlustwärme ab: Es ist keine zusätzliche Kühlung nötig (bei dieser Näherung).', 'ok');
    return h;
  }
  function renderLay() {
    const L = layCur(), sc = D.scenarios[S.lay.sc];
    $('#layView').innerHTML = ueb() + `<div class="card pl"><h4>Schrank planen</h4><div class="fbar"><span class="lbl" style="font-size:12px;color:var(--mute)">AUFGABE</span>${seg('data-sc', [['free', 'Frei'], ['a', 'Verteiler'], ['b', 'Pumpenschrank'], ['c', 'Antriebsschrank']], S.lay.sc)}</div>
      <p class="hint2" style="margin-top:0">${sc ? '<b>' + esc(sc.t) + ':</b> Baue alle Bauteile der Liste ein. Die Regeln unten zeigen sofort, was noch nicht stimmt.' : 'Freier Modus: Du wählst die Bauteile selbst. Die Regeln gelten für alles, was du einbaust.'}</p>
      <div class="btns" style="margin-top:4px"><button class="btn" data-la="sol"${sc ? '' : ' disabled'}>💡 Lösungsbeispiel laden</button><button class="btn" data-la="clr">Leeren</button></div><div id="edP"></div></div>
      <div class="card pl"><h4>Wärme im Schrank</h4><div class="dsrow">${inp('A', 'Wirksame Oberfläche', S.lay.A, 'm²')}${inp('To', 'Außentemperatur', S.lay.To, '°C')}${inp('Ti', 'Innen höchstens', S.lay.Ti, '°C')}</div><div id="heatOut"></div></div>`;
    const ed = makeEditor($('#edP'), { get: layCur, set: Lx => { S.lay.Ls[S.lay.sc] = Lx; lsSet('lay', S.lay); }, need: layNeed(), rules: layRules(), live: true, free: !sc, onChange: () => { $('#heatOut').innerHTML = heatOut(layCur()); } });
    root.__sslEd = ed; $('#heatOut').innerHTML = heatOut(L);
  }
  $('#layView').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.sc) { S.lay.sc = b.dataset.sc; lsSet('lay', S.lay); renderLay(); }
    else if (b.dataset.la === 'sol') { const sc = D.scenarios[S.lay.sc]; if (sc) { S.lay.Ls[sc.id] = D.solution(sc); lsSet('lay', S.lay); renderLay(); toast('Lösungsbeispiel geladen. Es gibt mehrere richtige Anordnungen.'); } }
    else if (b.dataset.la === 'clr') { S.lay.Ls[S.lay.sc] = C.emptyLayout(); lsSet('lay', S.lay); renderLay(); }
  });
  $('#layView').addEventListener('input', e => { const k = e.target.dataset.k; if (!k) return; S.lay[k] = e.target.value; lsSet('lay', S.lay); const h = $('#heatOut'); if (h) h.innerHTML = heatOut(layCur()); });

  /* ============================================================ Verdrahtung */
  const TERM_TXT = { L1: 'Außenleiter L1', L2: 'Außenleiter L2', L3: 'Außenleiter L3', N: 'Neutralleiter N', PE: 'Schutzleiter PE' };
  function x1Svg() {
    let s = '', W = 560; const w = 80, g = 8, x0 = (W - (5 * w + 4 * g)) / 2;
    C.TERM_ORDER.forEach((k, i) => { const x = x0 + i * (w + g), col = C.INST_COL[k]; s += `<rect x="${x}" y="40" width="${w}" height="64" rx="6" fill="var(--panel)" stroke="var(--mute)" stroke-width="2"/><rect x="${x}" y="${col === 'grün-gelb' ? 40 : 40}" width="${w}" height="12" rx="3" style="fill:${col === 'grün-gelb' ? '#d9c514' : COLCSS[col]}"/><text class="g-lab" x="${x + w / 2}" y="80" text-anchor="middle" style="font-size:15px;font-weight:700">${k}</text><text class="g-lab m" x="${x + w / 2}" y="97" text-anchor="middle" style="font-size:11px">X1:${i + 1}</text><text class="g-lab" x="${x + w / 2}" y="26" text-anchor="middle" style="font-size:12px">${esc(col)}</text>`; });
    return `<svg viewBox="0 0 ${W} 124" role="img" aria-label="Klemmenblock X1 mit fünf Klemmen in der Reihenfolge L1, L2, L3, N, PE und den Aderfarben">${s}</svg>`;
  }
  function verHtml(view) {
    if (view === 'x1') return `<div class="inst">${x1Svg()}</div><table class="tt"><tr><th>Klemme</th><th>Leiter</th><th>Aderfarbe (feste Installation)</th></tr>${C.TERM_ORDER.map((k, i) => `<tr><td>X1:${i + 1}</td><td>${esc(TERM_TXT[k])}</td><td>${colTag(C.INST_COL[k])}</td></tr>`).join('')}</table><p class="hint2">Übliche Klemmenfolge: erst die Außenleiter der Reihe nach, dann N, dann PE. Fehlerprinzip: Stimmt die Farbe an einer Klemme nicht mit dem Klemmenplan überein, vor dem Einschalten korrigieren. Grün-gelb gehört nie an eine andere Klemme als PE.</p>`;
    if (view === 'schrank') return `<table class="tt"><tr><th>Stromkreis im Maschinenschrank (EN 60204-1, Einzeladern)</th><th>Farbe</th></tr>${Object.keys(C.SCHR_COL).map(k => `<tr><td>${esc(k)}</td><td>${colTag(C.SCHR_COL[k])}</td></tr>`).join('')}</table><p class="hint2">In der Praxis wird bei 24 V DC oft +24 V rot und 0 V blau verdrahtet. Die Außenleiter L1, L2, L3 sind im Schrank oft alle schwarz und werden über die Aderbeschriftung unterschieden. Maßgeblich ist die Vorgabe deines Betriebs.</p>`;
    if (view === 'sensor') return `<table class="tt"><tr><th>Ader am Dreileiter-Sensor (PNP)</th><th>Anschluss</th></tr>${Object.keys(C.SENSOR_COL).map(k => `<tr><td>${colTag(k)}</td><td>${esc(C.SENSOR_COL[k])}</td></tr>`).join('')}</table><p class="hint2">Die Sensorversorgung kommt aus dem 24-V-Netzteil, das Signal geht an einen Eingang der Steuerung. Die Klemmen der Steuerseite (X2) bleiben getrennt von den Leistungsklemmen (X1).</p>`;
    return `<table class="tt"><tr><th>Querschnitt</th><th>Farbe der Aderendhülse (üblich)</th></tr>${Object.keys(C.FERRULE).map(k => `<tr><td>${f(+k, 2)} mm²</td><td>${colTag(C.FERRULE[k])}</td></tr>`).join('')}</table><p class="hint2">Feindrähtige (flexible) Leiter bekommen vor der Klemme eine Aderendhülse mit passender Länge, sauber gecrimpt. Die Farbe ist herstellerabhängig, das Datenblatt gilt.</p>`;
  }
  function renderVer() {
    $('#verView').innerHTML = ueb() + `<div class="card pl"><h4>Aderfarben und Klemmenplan</h4><div class="fbar">${seg('data-v', [['x1', 'Einspeisung X1'], ['schrank', 'Maschinenschrank'], ['sensor', 'Sensor 24 V'], ['huelse', 'Aderendhülsen']], S.ver.view)}</div>${verHtml(S.ver.view)}</div>`;
  }
  $('#verView').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; S.ver.view = b.dataset.v; lsSet('ver', S.ver); renderVer(); });

  /* ============================================================ Prüfen (Ablauf zum Abhaken) */
  function pruList(items, done, key, inter, live) {
    return `<ol class="chk">${items.map((it, i) => { const on = i < done, nx = i === done; const lv = live ? live(i) : null; return `<li><button class="row chkrow ${on ? 'on' : ''} ${nx ? 'nx' : ''}" ${inter ? `data-pk="${key}" data-pi="${i}"` : ''} aria-pressed="${on}"><span class="dot ${on ? 'g' : ''}">${on ? '✓' : i + 1}</span><div class="grow"><b>${esc(typeof it === 'string' ? it : it.t)}</b>${lv != null ? `<small>${lv ? '⚡ unter Spannung' : '🔒 spannungsfrei'}</small>` : ''}</div></button></li>`; }).join('')}</ol>`;
  }
  function pruHtml(done, pe, inter) {
    const n = C.PRUEF_STEPS.length;
    return pruList(C.PRUEF_STEPS, done, 'p', inter, i => C.PRUEF_STEPS[i].live) + `<div class="rdout ${done >= n ? 'ok' : 'warn'}">${done >= n ? '✓ Alle Schritte erledigt. Ergebnis ins Protokoll.' : done < 4 ? '🔒 Bisher alles spannungsfrei. Es darf erst eingeschaltet werden, wenn die spannungsfreien Prüfungen bestanden sind.' : '⚡ Ab jetzt steht die Anlage unter Spannung: Nur noch Prüfungen im Betrieb, Vorsicht beim Messen.'}</div>`
      + `<h4 style="margin:14px 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.07em;color:var(--mute)">Ablauf der Schutzleiterprüfung</h4>` + pruList(C.PE_STEPS, pe, 'e', inter);
  }
  function renderPru() {
    $('#pruView').innerHTML = ueb() + `<div class="card pl"><h4>Prüfen vor der Inbetriebnahme</h4><p class="hint2" style="margin-top:0">Hake die Schritte der Reihe nach ab. Ein späterer Schritt geht erst, wenn alle davor erledigt sind. Nochmal tippen nimmt den Haken zurück. Grenzwerte und Messverfahren sind bewusst nicht Teil dieses Labs: Es gilt die Prüfanweisung deines Betriebs.</p>${pruHtml(S.pru.done, S.pru.pe, true)}<div class="btns"><button class="btn" data-pr="reset">Zurücksetzen</button></div></div>`;
  }
  $('#pruView').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.pr === 'reset') { S.pru.done = 0; S.pru.pe = 0; lsSet('pru', S.pru); renderPru(); return; }
    if (!b.dataset.pk) return; const key = b.dataset.pk === 'p' ? 'done' : 'pe', i = +b.dataset.pi, cur = S[key === 'done' ? 'pru' : 'pru'][key];
    if (i === cur) S.pru[key] = cur + 1; else if (i < cur) S.pru[key] = i; else { const arr = key === 'done' ? C.PRUEF_STEPS.map(x => x.t) : C.PE_STEPS; toast('Erst „' + arr[cur] + '“ erledigen.'); return; }
    lsSet('pru', S.pru); renderPru();
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
    if (q.layout) h += `<div class="inst">${boardStatic(q.layout)}</div>${LEG}`;
    if (as.type === 'choice') h += `<div class="opts">${as.choices.map((c, i) => `<button data-tc="${i}" ${dn ? 'disabled' : ''} class="${r && i === as.correct && dn ? 'ok' : a.c === i ? (r && !r.ok ? 'bad' : 'on') : ''}">${esc(c)}</button>`).join('')}</div>`;
    else if (as.type === 'num') h += `<label class="f"><span>${esc(as.label)}${as.unit ? ' (' + esc(as.unit) + ')' : ''}</span><div class="qin"><input data-in="1" inputmode="decimal" autocomplete="off" value="${esc(a.v || '')}" ${dn ? 'disabled' : ''}><span class="u">${esc(as.unit)}</span></div></label>`;
    else if (as.type === 'order') { const o = a.o || []; h += `<p class="hint2" style="margin:4px 0">Tippe die Einträge in der richtigen Reihenfolge an. Nochmal tippen nimmt einen Eintrag zurück.</p><div class="opts">${as.items.map((t, i) => { const k = o.indexOf(i); return `<button data-to="${i}" ${dn ? 'disabled' : ''} class="${k >= 0 ? 'on' : ''}"><span class="no">${k >= 0 ? k + 1 : '·'}</span> ${esc(t)}</button>`; }).join('')}</div><div class="btns"><button class="btn" data-oc="1" ${dn ? 'disabled' : ''}>↺ Reihenfolge zurücksetzen</button></div>`; }
    else if (as.type === 'match') { const m = a.m || []; h += `<div class="mrows">${as.rows.map((t, i) => `<label class="mrow"><span>${esc(t)}</span><select data-mr="${i}" ${dn ? 'disabled' : ''}><option value="">– wählen –</option>${as.options.map((op, j) => `<option value="${j}"${m[i] === j ? ' selected' : ''}>${esc(op)}</option>`).join('')}</select></label>`).join('')}</div>`; }
    else if (as.type === 'layout') h += `<div class="ed" id="ed_${pre}"></div>`;
    return h;
  }
  function mountEd(pre, q, a) {
    const el = $('#ed_' + pre); if (!el || q.ask.type !== 'layout') return;
    if (!a.lay) a.lay = C.cloneLayout(q.ask.start);
    makeEditor(el, { get: () => a.lay, set: Lx => { a.lay = Lx; }, need: q.ask.need, rules: q.ask.rules, live: false });
  }
  function evalQ(q, a) { const e = D.evaluate(q, a); if (e.err) { toast(e.err); return null; } return e; }
  const resBlock = (q, r, showExpl) => `<ul class="tl"><li class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓ Richtig: ' + esc(r.given) : '✗ ' + (q.ask.type === 'layout' ? 'Noch nicht alles erfüllt: ' + esc(r.given) : 'Deine Antwort „' + esc(r.given) + '“ stimmt nicht.')}</li>${q.ask.type === 'num' && q.tol > 0.011 ? `<li>ℹ Erlaubte Abweichung: ±${esc(f(q.tol, 2))} ${esc(q.ask.unit)} (wegen Rundung).</li>` : ''}${q.ask.type === 'layout' && !r.ok && !exam() ? (r.detail || []).map(d => `<li class="bad"><small>${esc(d)}</small></li>`).join('') : ''}${q.ask.type === 'layout' && !r.ok && exam() ? '<li><small>Prüfmodus: Es wird nur die Zahl der erfüllten Regeln genannt.</small></li>' : ''}</ul>` +
    (showExpl ? `<div class="rdout ${r.ok ? 'ok' : 'bad'}"><b>Lösung:</b> ${esc(D.solText(q))}<br><br><b>Lösungsweg:</b> ${esc(q.expl)}</div>` : '<div class="rdout bad">🎓 Prüfmodus: Den Lösungsweg gibt es erst, wenn die Aufgabe richtig gelöst ist. Nutze einen Tipp oder versuche es noch einmal.</div>');

  function renderTasks(top) {
    const V = $('#taskView'), d = done(), prog = lsGet('prog', {}), t = curTask(), n100 = TASKS.filter(x => d[x.id]).length; let h = '';
    if (t) {
      const q = S.tq, r = S.tRes && S.tRes.id === t.id ? S.tRes : null, a = S.tAns[t.id] || (S.tAns[t.id] = {});
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv">${dots(t.level)}</div>${qText(q.text)}${qBody(q, a, r, 'tk')}`;
      h += `<div class="btns"><button class="btn pri" data-ta="chk"${r && r.ok ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" data-ta="hint">💡 Tipp</button><button class="btn" data-ta="close">Schließen</button></div>`;
      if (exam()) h += '<p class="hint2" style="color:var(--warn)">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>';
      if (r) { h += resBlock(q, r, r.ok || !exam()); if (r.ok) h += `<div class="btns"><button class="btn pri" data-ta="next">Nächste Aufgabe</button></div>`; }
      h += '</div>';
    }
    h += `<p class="hint2" style="margin:4px 0 0">${n100} von ${TASKS.length} Aufgaben gelöst. ${exam() ? '🎓 Prüfmodus ist an.' : 'Tipp: Im Prüfmodus (🎓 oben) zählen Tipps als Abzug.'}</p><p class="hint2" style="margin:4px 0 0">⚠ ${esc(UEB)}</p>`;
    let last = '';
    TASKS.forEach(x => { if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; } const p = prog[x.id]; h += `<button class="row" data-t="${esc(x.id)}"><span class="dot ${d[x.id] ? 'g' : ''}">${d[x.id] ? '✓' : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${dots(x.level)}</span>${p != null && p < 100 ? ' · bisher ' + p + ' %' : ''}</small></div></button>`; });
    V.innerHTML = h; if (t) mountEd('tk', S.tq, S.tAns[t.id] || {}); if (top !== false) $('#pgTasks').scrollTop = 0;
  }
  function checkTask(t) {
    const a = S.tAns[t.id] || {}, e = evalQ(S.tq, a); if (!e) return; const pct = e.ok ? pctFor(t.id) : 0;
    S.tRes = { id: t.id, ok: e.ok, given: e.given, detail: e.detail, pct };
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
      <div class="fbar"><span class="lbl" style="font-size:12px;color:var(--mute)">STUFE</span><div class="seg">${[[0, 'Alle'], [1, '1'], [2, '2'], [3, '3']].map(l => `<button data-lv="${l[0]}" class="${T.level === l[0] ? 'on' : ''}">${l[1]}</button>`).join('')}</div></div>
      <div class="card pl"><h4>${esc(q.cat)} · <span class="lv">${dots(q.level)}</span></h4><div class="big">${esc(q.title)}</div>${qText(q.text)}${qBody(q, T.ans, T.res, 'rt')}
      <div class="btns"><button class="btn pri" data-ra="chk" ${T.res ? 'disabled' : ''}>✓ Prüfen</button><button class="btn" data-ra="hint" ${T.res ? 'disabled' : ''}>💡 Tipp</button><button class="btn" data-ra="next">${T.res ? 'Nächste Frage' : 'Überspringen'}</button></div>
      ${T.res ? resBlock(q, T.res, true) : ''}</div>`;
    mountEd('rt', q, T.ans);
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
    T.res = { ok: e.ok, given: e.given, detail: e.detail }; S.rt.n++; if (e.ok) { S.rt.ok++; S.rt.streak++; S.rt.best = Math.max(S.rt.best, S.rt.streak); ding(); } else { S.rt.streak = 0; sad(); }
    lsSet('rt', S.rt); renderTrainer(); updatePal();
  }

  /* ============================================================ Beispiele */
  function exLayout(p) {
    const sc = D.scenarios[p.sc]; if (!sc) return C.emptyLayout();
    if (p.mode === 'sol') return D.solution(sc);
    return p.L ? C.cloneLayout(p.L) : D.solution(sc);
  }
  function exBody(e) {
    const p = e.p;
    if (e.tab === 'sch') return schOut(schParams(Object.fromEntries(Object.keys(p).map(k => [k, String(p[k])]))));
    if (e.tab === 'lay') { const sc = D.scenarios[p.sc], L = exLayout(p), chk = C.checkLayout(L, sc.need, sc.rules); return `<div class="inst">${boardStatic(L)}</div><ul class="tl">${chk.rules.map(r => `<li class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓' : '✗'} ${esc(r.t)}${r.ok ? '' : ' <small>(' + esc(r.det.slice(0, 2).join('; ')) + ')</small>'}</li>`).join('')}</ul>` + box('Verlustleistung', 'Σ Verlust', f(C.pvSum(L), 0) + ' W'); }
    if (e.tab === 'ver') return verHtml(p.view);
    return pruHtml(p.done, 0, false);
  }
  function renderBsp() {
    $('#bspView').innerHTML = `<p class="hint2" style="margin:0 0 8px">Fertig durchgerechnete Beispiele (Übungswerte). Mit „In den Rechner laden“ öffnest du die Zahlen im passenden Reiter und kannst sie verändern.</p>` + D.examples.map(e => `<div class="card pl" id="ex_${e.id}"><h4>Beispiel</h4><div class="big">${esc(e.title)}</div><p style="margin:4px 0 8px">${esc(e.text)}</p>${exBody(e)}<div class="btns"><button class="btn pri" data-ex="${e.id}">In den Rechner laden</button></div></div>`).join('');
  }
  function loadExample(x) {
    const p = x.p;
    if (x.tab === 'sch') { S.sch = Object.fromEntries(Object.keys(p).map(k => [k, String(p[k])])); lsSet('sch', S.sch); }
    else if (x.tab === 'lay') { S.lay.sc = p.sc; S.lay.Ls[p.sc] = exLayout(p); lsSet('lay', S.lay); }
    else if (x.tab === 'ver') { S.ver.view = p.view; lsSet('ver', S.ver); }
    else { S.pru.done = p.done; S.pru.pe = 0; lsSet('pru', S.pru); }
    setTab(x.tab);
  }
  $('#bspView').addEventListener('click', e => {
    const b = e.target.closest('[data-ex]'); if (!b) return; const x = D.examples.find(z => z.id === b.dataset.ex); if (!x) return;
    loadExample(x); toast('Beispiel geladen: ' + x.title);
  });

  /* ============================================================ Hilfe */
  function renderHelp() {
    const sec = (t, b, open) => `<details${open ? ' open' : ''}><summary>${t}</summary><div class="hb2">${b}</div></details>`;
    $('#helpView').innerHTML =
      `<div class="rdout warn">⚠ ${esc(UEB)}</div>` +
      sec('Schutzorgane wählen', `<p>Der <b>Leitungsschutzschalter (LS)</b> schützt die Leitung vor Überlast (thermisch) und Kurzschluss (magnetisch). Der <b>FI/RCD</b> erkennt Fehlerströme nach Erde (30 mA Personenschutz, 300 mA Brandschutz), er ersetzt keinen LS. Ein <b>Motorschutzschalter</b> schützt die Wicklung vor Überlast.</p><table><tr><th>Charakteristik</th><th>Magnetische Auslösung</th><th>Typisch für</th></tr><tr><td>B</td><td>3 bis 5 · In</td><td>Steckdosen, lange Leitungen, ohmsche Last</td></tr><tr><td>C</td><td>5 bis 10 · In</td><td>Netzteile, Leuchten, kleine Einschaltströme</td></tr><tr><td>D</td><td>10 bis 20 · In</td><td>Transformatoren, große Einschaltströme</td></tr></table><p>Normreihe In: ${C.LS_IN.join(', ')} A. <b>Selektivität</b> (qualitativ): Bei einem Fehler soll nur das Schutzorgan direkt vor der Fehlerstelle auslösen; das vorgeschaltete Gerät ist größer oder träger (z. B. RCD Typ S). Ein größerer Nennstrom allein garantiert sie nicht, die Herstellertabellen geben die Grenzen.</p>`) +
      sec('Strom und Querschnitt', `<span class="eq">einphasig: I = P / (U · cos φ)</span><span class="eq">Drehstrom: I = P / (√3 · U · cos φ · η)</span><span class="eq">Auslegung: Ib ≤ In ≤ Iz</span><table><tr><th>Querschnitt (Cu)</th>${C.CROSS.map(s => `<th>${f(s, 1)} mm²</th>`).join('')}</tr><tr><td>Iz (Übung)</td>${C.CROSS.map(s => `<td>${C.IZ[s]} A</td>`).join('')}</tr><tr><td>größter LS</td>${C.CROSS.map(s => `<td>${C.maxIn(s)} A</td>`).join('')}</tr></table><p>Iz gilt als Übungswert (Verlegeart B2, PVC, 30 °C). Im Schrank mindern Häufung und Wärme die Belastbarkeit. <b>Schutzleiter:</b> bis 16 mm² gleich dem Außenleiter, bis 35 mm² 16 mm², darüber der halbe Querschnitt.</p>`) +
      sec('Netzteil und Wärme', `<span class="eq">Netzteil ≥ Last · 1,25, dann nächste Stufe (2,5 / 5 / 10 / 20 / 40 A)</span><span class="eq">Verlust = P_aus / η − P_aus</span><span class="eq">Wandabfuhr = 5,5 W/(m²·K) · A · ΔT</span><span class="eq">Lüfter: V = 3,1 · P / ΔT (m³/h)</span><p>Alle Verlustleistungen im Schrank werden zur Wärme. Reicht die Wand nicht, braucht der Schrank Lüfter oder Kühlgerät.</p>`) +
      sec('Layout-Regeln', `<ul>${C.RULE_ORDER.map(k => `<li><b>${esc(C.RULES[k].t)}:</b> ${esc(C.RULES[k].d)}</li>`).join('')}</ul><p>Platte im Übungsmodell: 3 Hutschienen zu je ${C.RAIL_TE} TE (1 TE = ${C.TE_MM} mm), zwei Kanäle dazwischen.</p>`) +
      sec('Bauteile (Übungswerte)', `<table><tr><th>Bauteil</th><th>TE</th><th>Verlust</th><th>Bereich</th><th>BMK</th></tr>${Object.keys(C.PARTS).map(k => { const p = C.PARTS[k]; return `<tr><td>${esc(p.n)}${p.heat ? ' ♨' : ''}</td><td>${p.w}</td><td>${p.pv} W</td><td>${p.z === 'L' ? 'Leistung' : 'Steuerung'}</td><td>-${p.k}</td></tr>`; }).join('')}</table><p>${Object.keys(C.BMK_LETTER).map(k => '<b>' + k + '</b> ' + esc(C.BMK_LETTER[k])).join(', ')}. ♨ = Wärmequelle (ab ${C.HEAT_MIN} W). SPS und Relais gelten als wärmeempfindlich.</p>`) +
      sec('Verdrahtung', `<table><tr><th>Feste Installation</th><th>Farbe</th></tr>${C.TERM_ORDER.map(k => `<tr><td>${esc(TERM_TXT[k])}</td><td>${colTag(C.INST_COL[k])}</td></tr>`).join('')}</table><table><tr><th>Maschinenschrank (EN 60204-1)</th><th>Farbe</th></tr>${Object.keys(C.SCHR_COL).map(k => `<tr><td>${esc(k)}</td><td>${colTag(C.SCHR_COL[k])}</td></tr>`).join('')}</table><p>Klemmenfolge der Einspeisung: L1, L2, L3, N, PE. Feindrähtige Leiter bekommen Aderendhülsen. Dreileiter-Sensor: braun +24 V, blau 0 V, schwarz Signal.</p>`) +
      sec('Prüfen vor der Inbetriebnahme', `<ol>${C.PRUEF_STEPS.map(s => `<li>${esc(s.t)} ${s.live ? '(unter Spannung)' : '(spannungsfrei)'}</li>`).join('')}</ol><p>Erst alles Spannungsfreie, dann stufenweise zuschalten. Die Isolationsmessung läuft nur spannungsfrei, empfindliche Baugruppen (Netzteil, SPS) werden vorher getrennt oder wie vom Hersteller vorgesehen behandelt. Bei auffälligen Werten wird nicht eingeschaltet, sondern die Stelle eingegrenzt und nachgearbeitet.</p>`) +
      `<p class="hint2">Zahlen und Begriffe sind Lehrbuch- und Übungswerte; Unsicheres ist im Quelltext mit PRUEFEN markiert.</p>`;
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'sch'; S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    ({ sch: renderSch, lay: renderLay, ver: renderVer, pru: renderPru, tasks: renderTasks, rt: renderTrainer, bsp: renderBsp, help: renderHelp })[t]();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'Schaltschrank-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = 'Schaltschrank-Lab: ' + T[2];
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
  $('#title').onclick = () => setTab('sch');
  $('#bMenu').onclick = () => {
    const rows = [['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung und Tipps'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Aufgaben mit Serien-Zähler'], ['bsp', 'Beispiele', 'Fertig durchgerechnete Beispiele zum Laden'], ['help', 'Hilfe und Formeln', 'Schutzorgane, Querschnitte, Wärme, Layout, Verdrahtung, Prüfen'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben und Trainer-Serie auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
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
  root.SSL_LAB = { id: 'ssl', title: 'Schaltschrank-Lab', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.SSL_TASKS };

  /* Rauchtest für quelle/ssl/test_sslcore.js (läuft nur, wenn der Test window.__SSL_TEST setzt) */
  root.SSL_UI = {
    smoke: function () {
      if (!root.__SSL_TEST) return 'nur im Test';
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
        S.sch.P = 'x'; updateSch(); S.sch.P = '1000'; S.sch.ph = '1'; S.sch.U = '230'; S.sch.cos = '1'; S.sch.eta = '1'; S.sch.In = '20'; S.sch.S = '1,5'; updateSch(); S.sch.In = '6'; updateSch();
        ['free', 'a', 'b', 'c'].forEach(k => { S.lay.sc = k; renderLay(); if (root.__sslEd) root.__sslEd.refresh(); });
        S.lay.A = '0'; renderLay(); S.ver.view = 'huelse'; renderVer(); S.pru.done = 6; renderPru();
        setTab('bsp'); setTab('help'); return 'ok';
      } catch (e) { return e && e.stack ? e.stack : String(e); }
    }
  };

  buildTabs(); updatePal(); setTab(TABS.some(x => x[0] === S.tab) ? S.tab : 'sch');
  /* Aufruf ?aufgabe=ssl1 (Startseite, Lernhefte) öffnet die Aufgabe, ?bsp die Beispiele (?bsp=abg1 springt zu einem Beispiel) */
  try {
    const qp = new URLSearchParams(location.search), qa = qp.get('aufgabe');
    if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); }
    else if (qp.has('bsp')) { setTab('bsp'); const el = $('#ex_' + (qp.get('bsp') || '').replace(/[^a-z0-9_]/gi, '')); if (el) el.scrollIntoView(); }
  } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
