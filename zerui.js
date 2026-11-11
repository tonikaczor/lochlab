'use strict';
/* Tonfunk Zerspan-Lab: Oberfläche.
   Tabs: Drehen, Fräsen, Bohren (animierte SVG-Simulationen mit Rechenweg), Richtwerte (Tafel und "Drehzahl wählen"), Aufgaben (ZER_TASKS),
   Trainer (Zufallsaufgaben mit Serien-Zähler), Fehlersuche (Karten), Hilfe (Spickzettel).
   Module: zercore.js (ZER_CORE), zerdata.js (ZER_TASKS, ZER_DEFS, ZER_BUILD). Fehlt eine Datei, erscheint ein Hinweis.
   Speicher (Präfix lm4.zer.): done {id:true} (gelöste Aufgaben, Schnittstelle zur Startseite), pct {id:Prozent}, hints {id:Stufe}, ctipps (nur Prüfmodus),
   tried, seeds, exam, tab, sim (Reglerwerte), trainer, fs.
   Tipp-Abzug nur im Prüfmodus: Stufe 1 = 10 %, Stufe 2 = 25 %, Stufe 3 = 50 % der Punkte. Im normalen Üben kosten Tipps nichts. */
(function (root) {
  const C = root.ZER_CORE, BUILD = root.ZER_BUILD, DEFS = root.ZER_DEFS, ORDER = root.ZER_ORDER;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  if (!C || !BUILD || !DEFS) {
    const m = $('#mid'); if (m) m.innerHTML = '<div style="padding:24px;text-align:center"><p>Das Zerspan-Lab konnte nicht vollständig geladen werden (zercore.js oder zerdata.js fehlt).</p><button class="btn pri" onclick="location.reload()">Erneut laden</button></div>';
    return;
  }
  const F = C.fmt, PI = Math.PI;
  const P = 'lm4.zer.';
  const lsG = (k, d) => { try { const v = JSON.parse(localStorage.getItem(P + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsS = (k, v) => { try { localStorage.setItem(P + k, JSON.stringify(v)); } catch (e) {} };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const isNum = v => typeof v === 'number' && isFinite(v);
  const reduced = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();
  const sound = k => { try { if (root.LochFX && root.LochFX.sound) root.LochFX.sound(k, 0.6); } catch (e) {} };

  /* ============================================================ Fenster, Meldungen */
  function toast(m) { const t = $('#toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), Math.max(2200, m.length * 55)); }
  function sheet(title, build, onClose) {
    const bd = document.createElement('div'); bd.className = 'backdrop';
    bd.innerHTML = `<div class="sheet" role="dialog" aria-label="${esc(title)}"><div class="sh-h"><b>${esc(title)}</b><button class="x" aria-label="Schließen">✕</button></div><div class="sh-b"></div></div>`;
    document.body.appendChild(bd);
    let closed = false;
    const close = () => { if (closed) return; closed = true; bd.remove(); if (onClose) onClose(); };
    bd.addEventListener('pointerdown', e => { if (e.target === bd) close(); });
    $('.x', bd).onclick = close;
    build($('.sh-b', bd), close);
    return close;
  }
  root.LabUI = { sheet, esc, toast, userName: () => { try { return localStorage.getItem('lm4.name') || ''; } catch (e) { return ''; } }, LAB: 'zer' };

  /* ============================================================ Zustand */
  const TABS = [['dreh', 'Drehen'], ['fraes', 'Fräsen'], ['bohr', 'Bohren'], ['tafel', 'Richtwerte'], ['tasks', 'Aufgaben'], ['train', 'Trainer'], ['fehler', 'Fehlersuche'], ['help', 'Hilfe'], ['bsp', 'Beispiele']];   /* Beispiele am Ende: Tasten 1 bis 8 bleiben unverändert */
  const DEF_SIM = {
    dreh: { d: 40, l: 100, n: 500, f: 0.2, ap: 1.5, i: 1, la: 3, lu: 2, mat: 's235', cut: 'hss', fc: true },
    fraes: { d: 63, z: 5, vc: 150, fz: 0.1, l: 150, la: 5, lu: 5, gr: 'stahl', cut: 'hm' },
    bohr: { d: 10, vc: 25, f: 0.15, t: 20, durch: true, lu: 1, sigma: 118, gr: 'stahl', cut: 'hss' }
  };
  const S = {
    tab: lsG('tab', 'dreh'), run: !reduced, exam: !!lsG('exam', false), done: lsG('done', {}), pct: lsG('pct', {}), hints: lsG('hints', {}), tried: lsG('tried', {}), seeds: lsG('seeds', {}),
    sim: { dreh: Object.assign({}, DEF_SIM.dreh), fraes: Object.assign({}, DEF_SIM.fraes), bohr: Object.assign({}, DEF_SIM.bohr) },
    task: null, taskFilter: 'alle', trainCat: 'alle'
  };
  ['done', 'pct', 'hints', 'tried', 'seeds'].forEach(k => { if (!S[k] || typeof S[k] !== 'object' || Array.isArray(S[k])) S[k] = {}; });
  (function loadSim() { const o = lsG('sim', null); if (o && typeof o === 'object') ['dreh', 'fraes', 'bohr'].forEach(k => { if (o[k] && typeof o[k] === 'object') Object.keys(DEF_SIM[k]).forEach(f => { if (typeof o[k][f] === typeof DEF_SIM[k][f] && (typeof o[k][f] !== 'number' || isFinite(o[k][f]))) S.sim[k][f] = o[k][f]; }); }); })();
  if (!TABS.some(t => t[0] === S.tab)) S.tab = 'dreh';
  const saveSim = () => lsS('sim', S.sim);
  const taskIds = () => (root.ZER_TASKS || []).map(t => t.id);
  const nDone = () => taskIds().filter(id => S.done[id]).length;

  /* ============================================================ Regler */
  const CT = (k, label, unit, min, max, step, dec) => ({ k, label, unit, min, max, step, dec: dec || 0 });
  const SPEC = {
    dreh: [CT('d', 'Durchmesser d', 'mm', 10, 100, 1), CT('l', 'Länge l', 'mm', 10, 250, 1), CT('n', 'Drehzahl n', 'min⁻¹', 20, 2500, 5), CT('f', 'Vorschub f', 'mm/U', 0.05, 1, 0.05, 2), CT('ap', 'Zustellung ap', 'mm', 0.1, 5, 0.1, 1), CT('i', 'Anzahl Schnitte i', '', 1, 10, 1), CT('la', 'Anlaufweg la', 'mm', 0, 15, 1), CT('lu', 'Überlaufweg lü', 'mm', 0, 15, 1)],
    fraes: [CT('d', 'Fräserdurchmesser d', 'mm', 6, 125, 1), CT('z', 'Schneidenzahl z', '', 1, 12, 1), CT('vc', 'Schnittgeschwindigkeit vc', 'm/min', 10, 400, 5), CT('fz', 'Zahnvorschub fz', 'mm', 0.01, 0.3, 0.01, 2), CT('l', 'Länge l', 'mm', 10, 300, 5), CT('la', 'Anlaufweg la', 'mm', 0, 80, 1), CT('lu', 'Überlaufweg lü', 'mm', 0, 80, 1)],
    bohr: [CT('d', 'Bohrerdurchmesser d', 'mm', 2, 40, 0.5, 1), CT('vc', 'Schnittgeschwindigkeit vc', 'm/min', 5, 150, 1), CT('f', 'Vorschub f', 'mm/U', 0.05, 0.5, 0.01, 2), CT('t', 'Bohrtiefe t', 'mm', 2, 80, 1), CT('lu', 'Überlaufweg lü', 'mm', 0, 5, 0.5, 1)]
  };
  const dispNum = (v, dec) => String(+(+v).toFixed(dec)).replace('.', ',');
  const ctlHtml = (sim, c) => `<div class="ctl" data-k="${c.k}"><div class="ctl-h"><label for="${sim}-${c.k}-n">${esc(c.label)}</label><span class="ctl-v"><input class="num" id="${sim}-${c.k}-n" data-k="${c.k}" inputmode="decimal" autocomplete="off" aria-label="${esc(c.label)} in ${esc(c.unit)}"> ${esc(c.unit)}</span></div><input type="range" id="${sim}-${c.k}-r" data-k="${c.k}" min="${c.min}" max="${c.max}" step="${c.step}" aria-label="${esc(c.label)}"></div>`;
  const selHtml = (sim, k, label, opts) => `<div class="ctl"><div class="ctl-h"><label for="${sim}-${k}-s">${esc(label)}</label></div><select id="${sim}-${k}-s" data-k="${k}" data-t="${typeof opts[0][0]}">${opts.map(o => `<option value="${esc(o[0])}">${esc(o[1])}</option>`).join('')}</select></div>`;
  const matOpts = Object.keys(C.MATERIALS).map(k => [k, C.MATERIALS[k].name]);
  const grOpts = C.GRUPPEN.map(g => [g[0], g[1]]);
  const cutOpts = [['hss', 'HSS (Schnellarbeitsstahl)'], ['hm', 'Hartmetall']];

  function setVal(sim, k, v) {
    const c = SPEC[sim].find(x => x.k === k), s = S.sim[sim]; if (!c || !isNum(v)) return;
    v = clamp(v, c.min, c.max); if (c.step >= 1 && c.dec === 0) v = Math.round(v); s[k] = v;
    if (sim === 'dreh') s.ap = Math.min(s.ap, Math.max(0.1, +(s.d / 2 - 0.5).toFixed(1)));
    syncCtl(sim); saveSim(); update(sim);
  }
  function syncCtl(sim) {
    const host = $('#' + sim + 'View'), s = S.sim[sim]; if (!host) return;
    SPEC[sim].forEach(c => {
      const r = $('#' + sim + '-' + c.k + '-r', host), n = $('#' + sim + '-' + c.k + '-n', host);
      if (r && r !== document.activeElement && +r.value !== s[c.k]) r.value = s[c.k];
      if (n && n !== document.activeElement) n.value = dispNum(s[c.k], c.dec);
    });
    $$('select[data-k]', host).forEach(e => { e.value = String(s[e.dataset.k]); });
    $$('input[type=checkbox][data-k]', host).forEach(e => { e.checked = !!s[e.dataset.k]; });
    const lu = $('#bohr-lu-wrap', host); if (lu) lu.style.display = s.durch ? '' : 'none';
  }
  function bindSim(sim) {
    const host = $('#' + sim + 'View'), s = S.sim[sim];
    host.addEventListener('input', e => { const t = e.target; if (t.type === 'range') setVal(sim, t.dataset.k, +t.value); });
    host.addEventListener('change', e => {
      const t = e.target, k = t.dataset.k; if (!k) return;
      if (t.classList.contains('num')) { const v = C.parseDE(t.value); if (isNum(v)) setVal(sim, k, v); else syncCtl(sim); t.value = dispNum(s[k], SPEC[sim].find(x => x.k === k).dec); }
      else if (t.tagName === 'SELECT') { s[k] = t.dataset.t === 'number' ? +t.value : t.value; if (sim === 'dreh' && k === 'mat') { /* Gruppe folgt dem Werkstoff */ } saveSim(); update(sim); }
      else if (t.type === 'checkbox') { s[k] = t.checked; saveSim(); update(sim); syncCtl(sim); }
    });
    host.addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b) return; const a = b.dataset.act;
      if (a === 'reset') { Object.assign(s, DEF_SIM[sim]); saveSim(); syncCtl(sim); update(sim); A.t = 0; toast('Standardwerte eingestellt'); }
      else if (a === 'nrich') {
        const g = C.gruppeOf(s.mat), w = C.vcWindow('dreh', g, s.cut); if (!w) return;
        const n = C.nFromVc((w[0] + w[1]) / 2, s.d); setVal('dreh', 'n', Math.round(n / 5) * 5); toast('Drehzahl für die Mitte des Richtwert-Fensters: ' + F(Math.round(n / 5) * 5, 0) + ' min⁻¹');
      } else if (a === 'half') { setVal('fraes', 'la', Math.round(s.d / 2)); setVal('fraes', 'lu', Math.round(s.d / 2)); }
      else if (a === 'tafel') setTab('tafel');
    });
  }

  /* ============================================================ Rechenmodelle */
  function model(sim) {
    const s = S.sim[sim], m = Object.assign({}, s);
    if (sim === 'dreh') {
      m.ap = Math.min(s.ap, Math.max(0.1, s.d / 2 - 0.5)); m.gr = C.gruppeOf(s.mat);
      m.n = s.n; m.vc = C.vc(s.d, s.n); m.vf = C.vf(s.f, s.n); m.L = C.weg(s.l, s.la, s.lu); m.th = C.th(m.L, s.i, m.vf);
      m.A = C.spanquerschnitt(m.ap, s.f); m.kc = C.kcOf(s.mat); m.Fc = C.schnittkraft(m.A, m.kc); m.Pc = C.schnittleistung(m.Fc, m.vc);
      m.win = C.vcWindow('dreh', m.gr, s.cut);
    } else if (sim === 'fraes') {
      m.n = C.nFromVc(s.vc, s.d); m.vf = C.vfFraes(s.fz, s.z, m.n); m.f = C.fFraes(s.fz, s.z); m.L = C.weg(s.l, s.la, s.lu); m.th = C.th(m.L, 1, m.vf);
      m.win = C.vcWindow('fraes', s.gr, s.cut);
    } else {
      m.n = C.nFromVc(s.vc, s.d); m.vf = C.vf(s.f, m.n); m.la = C.bohrAnschnitt(s.d, s.sigma); m.L = C.bohrWeg(s.t, s.d, { sigma: s.sigma, durchgang: s.durch, lu: s.lu }); m.th = C.th(m.L, 1, m.vf);
      m.win = C.vcWindow('bohr', s.gr, s.cut);
    }
    m.st = C.vcStatus(m.vc, m.win);
    return m;
  }
  const fz = (v, d) => F(v, d);
  function rows(sim, m) {
    const r = [];
    if (sim === 'dreh') {
      r.push(['Schnittgeschwindigkeit vc', `π · ${F(m.d)} · ${F(m.n)} / 1000`, `${fz(m.vc)} m/min`]);
      r.push(['Vorschubgeschwindigkeit vf', `${F(m.f)} · ${F(m.n)}`, `${fz(m.vf)} mm/min`]);
      r.push(['Gesamtweg L', `${F(m.l)} + ${F(m.la)} + ${F(m.lu)}`, `${fz(m.L)} mm`]);
      r.push(['Hauptzeit th', `${fz(m.L)} · ${F(m.i)} / ${fz(m.vf)}`, `${fz(m.th)} min<br><small>${C.fmtZeit(m.th)}</small>`]);
      r.push(['Spanquerschnitt A', `${F(m.ap)} · ${F(m.f)}`, `${fz(m.A)} mm²`]);
      if (m.fc) { r.push(['Schnittkraft Fc', `${fz(m.A)} · ${F(m.kc)} (kc, Richtwert)`, `${fz(m.Fc)} N`]); r.push(['Schnittleistung Pc', `${fz(m.Fc)} · ${fz(m.vc)} / 60 000`, `${F(m.Pc, 2)} kW`]); }
    } else if (sim === 'fraes') {
      r.push(['Drehzahl n', `${F(m.vc)} · 1000 / (π · ${F(m.d)})`, `${fz(m.n)} min⁻¹`]);
      r.push(['Vorschubgeschwindigkeit vf', `${F(m.fz)} · ${F(m.z)} · ${fz(m.n)}`, `${fz(m.vf)} mm/min`]);
      r.push(['Vorschub je Umdrehung f', `${F(m.fz)} · ${F(m.z)}`, `${F(m.f)} mm/U`]);
      r.push(['Gesamtweg L', `${F(m.l)} + ${F(m.la)} + ${F(m.lu)}`, `${fz(m.L)} mm`]);
      r.push(['Hauptzeit th', `${fz(m.L)} / ${fz(m.vf)}`, `${fz(m.th)} min<br><small>${C.fmtZeit(m.th)}</small>`]);
    } else {
      r.push(['Drehzahl n', `${F(m.vc)} · 1000 / (π · ${F(m.d)})`, `${fz(m.n)} min⁻¹`]);
      r.push(['Vorschubgeschwindigkeit vf', `${F(m.f)} · ${fz(m.n)}`, `${fz(m.vf)} mm/min`]);
      r.push([`Anschnitt la (${m.sigma}°)`, `(${F(m.d)} / 2) / tan(${m.sigma}° / 2)`, `${fz(m.la, 2)} mm`]);
      r.push(['Bohrweg L', m.durch ? `${F(m.t)} + ${fz(m.la, 2)} + ${F(m.lu)}` : `${F(m.t)} + ${fz(m.la, 2)} (Sackloch)`, `${fz(m.L)} mm`]);
      r.push(['Bohrzeit th', `${fz(m.L)} / ${fz(m.vf)}`, `${fz(m.th)} min<br><small>${C.fmtZeit(m.th)}</small>`]);
    }
    return r;
  }
  function winHtml(m, what) {
    if (!isNum(m.vc)) return '';
    if (!m.win) return `<div class="win"><p class="hint2">Für diese Kombination ist kein Richtwert hinterlegt. Herstellerangaben beachten.</p></div>`;
    const lo = m.win[0], hi = m.win[1], mx = hi * 1.6, pos = clamp(m.vc / mx, 0, 1) * 100;
    const txt = m.st === 'ok' ? `vc liegt im Richtwert-Fenster (${lo} bis ${hi} m/min).` : m.st === 'niedrig' ? `vc liegt unter dem Fenster (${lo} bis ${hi} m/min): Aufbauschneide und unsaubere Oberfläche möglich.` : `vc liegt über dem Fenster (${lo} bis ${hi} m/min): Schneide wird zu heiß, der Verschleiß steigt stark.`;
    return `<div class="win" aria-label="Richtwert-Fenster"><div class="tr"><div class="zone" style="left:${lo / mx * 100}%;width:${(hi - lo) / mx * 100}%"></div><div class="mk" style="left:${pos}%"></div></div><p class="${m.st}">${txt}</p><p class="hint2">Richtwert für ${esc(what)}; Werkzeughersteller beachten.</p></div>`;
  }
  /* Zeit kompakt für die Kacheln: 1:03 min oder 32 s */
  function zt(th) { if (!isNum(th)) return ['–', '']; const s = Math.round(th * 60); return s >= 60 ? [Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'), 'min'] : [String(s), 's']; }
  function liveHtml(sim, m) {
    const k = (l, v, u, cls) => `<div class="kv ${cls || ''}"><small>${l}</small><b>${v}${u ? ' <i>' + u + '</i>' : ''}</b></div>`;
    if (sim === 'dreh') return k('vc', fz(m.vc), 'm/min', m.st) + k('vf', fz(m.vf), 'mm/min') + k('th', zt(m.th)[0], zt(m.th)[1]) + (m.fc ? k('Pc', F(m.Pc, 2), 'kW') : k('A', fz(m.A), 'mm²'));
    if (sim === 'fraes') return k('n', fz(m.n), 'min⁻¹') + k('vf', fz(m.vf), 'mm/min') + k('th', zt(m.th)[0], zt(m.th)[1]) + k('vc', F(m.vc), 'm/min', m.st);
    return k('n', fz(m.n), 'min⁻¹') + k('vf', fz(m.vf), 'mm/min') + k('th', zt(m.th)[0], zt(m.th)[1]) + k('la', fz(m.la, 2), 'mm');
  }
  const whatOf = (sim, m) => sim === 'dreh' ? `${C.MATERIALS[m.mat].name}, ${C.CUTS[m.cut]}` : `${(C.GRUPPEN.find(g => g[0] === m.gr) || [0, m.gr])[1]}, ${C.CUTS[m.cut]}`;
  function update(sim) {
    const m = model(sim), host = $('#' + sim + 'View'); if (!host) return;
    const res = $('#' + sim + '-res', host), live = $('#' + sim + '-live', host), win = $('#' + sim + '-win', host);
    if (res) res.innerHTML = `<table class="iot"><tr><th>Größe</th><th>Rechnung</th><th style="text-align:right">Ergebnis</th></tr>${rows(sim, m).map(r => `<tr><td>${r[0]}</td><td class="a">${r[1]}</td><td class="v">${r[2]}</td></tr>`).join('')}</table>`;
    if (live) live.innerHTML = liveHtml(sim, m);
    if (win) win.innerHTML = winHtml(m, whatOf(sim, m));
    const vz = $('#' + sim + '-viz', host); if (vz && root.ZERVIZ) vz.innerHTML = root.ZERVIZ.sim(sim, m);
    const note = $('#' + sim + '-note', host); if (note) note.textContent = zeitNote(m);
    draw(sim, m);
  }
  function cycleT(m) { const s = isNum(m.th) ? m.th * 60 : 60; return clamp(s / 12, 3, 14); }
  function zeitNote(m) { const T = cycleT(m), s = isNum(m.th) ? m.th * 60 : NaN; return isNum(s) ? `Zeitraffer ×${F(s / T, s / T >= 10 ? 0 : 1)} · Drehung nicht maßstäblich` : 'Zeitraffer · Drehung nicht maßstäblich'; }

  /* ============================================================ SVG: Drehbank */
  const SVGNS = 'http://www.w3.org/2000/svg';
  const EL = { dreh: {}, fraes: {}, bohr: {} };
  const svgDreh = () => {
    let st = ''; for (let k = 0; k < 7; k++) st += `<line class="sa" stroke="var(--sv-ln)" stroke-width="1" /><line class="sb" stroke="var(--sv-ln)" stroke-width="1" />`;
    let ch = ''; for (let k = 0; k < 7; k++) ch += `<circle class="chp" r="2.4" fill="var(--sv-chip)"/>`;
    return `<svg class="sim" id="dr-svg" viewBox="0 0 640 290" role="img" aria-label="Drehbank: Werkstück, Spannfutter und Drehmeißel in der Seitenansicht">
<rect x="0" y="252" width="640" height="38" fill="var(--sv-bed)"/>
<rect x="6" y="70" width="64" height="182" rx="4" fill="var(--sv-chuck)" opacity=".75"/>
<rect x="70" y="92" width="52" height="86" rx="3" fill="var(--sv-chuck)"/>
<line x1="20" y1="135" x2="620" y2="135" stroke="var(--sv-dim)" stroke-width=".8" stroke-dasharray="14 4 2 4"/>
<rect id="dr-A" fill="var(--sv-wp)" stroke="var(--sv-ln)" stroke-width="1"/>
<rect id="dr-B" fill="var(--sv-wp2)" stroke="var(--sv-ln)" stroke-width="1"/>
<g id="dr-st">${st}</g>
<text id="dr-dia" text-anchor="middle" style="fill:var(--sv-ln);font-size:16px"></text>
<g id="dr-dim"><line id="dr-l1" class="wl"/><line id="dr-l2" class="wl"/><line id="dr-l3" class="wl"/><text id="dr-lt" text-anchor="middle"></text></g>
<g id="dr-tool"><polygon id="dr-bit" fill="var(--sv-tool)" stroke="var(--sv-ln)" stroke-width="1"/><rect id="dr-hold" fill="var(--sv-chuck)" stroke="var(--sv-ln)" stroke-width="1"/><text id="dr-fl" text-anchor="start"></text></g>
<g id="dr-chips">${ch}</g>
<text id="dr-ap" style="fill:var(--sv-tool)"></text>
<g id="dr-rot"><path d="M34 40a14 14 0 1 1-12 7" fill="none" stroke="var(--sv-cut)" stroke-width="2.4"/><polygon points="16,42 27,44 20,53" fill="var(--sv-cut)"/></g>
<text x="56" y="44" id="dr-nt"></text></svg>`;
  };
  function mountDreh() {
    const h = $('#drehView'), e = EL.dreh; e.svg = $('#dr-svg', h);
    ['A', 'B', 'dia', 'l1', 'l2', 'l3', 'lt', 'bit', 'hold', 'fl', 'ap', 'rot', 'nt'].forEach(k => { e[k] = $('#dr-' + k, h); });
    e.sa = $$('.sa', h); e.sb = $$('.sb', h); e.chips = $$('.chp', h);
  }
  function setLines(lines, x1, x2, cy, r, phase, show) {
    lines.forEach((ln, k) => {
      if (!show || x2 - x1 < 1) { ln.setAttribute('opacity', 0); return; }
      const a = ((phase + k / lines.length) % 1), th = a * PI, y = cy - r * Math.cos(th);
      ln.setAttribute('x1', x1); ln.setAttribute('x2', x2); ln.setAttribute('y1', y); ln.setAttribute('y2', y); ln.setAttribute('opacity', (Math.sin(th) * 0.55).toFixed(2));
    });
  }
  function drawDreh(m) {
    const e = EL.dreh; if (!e.A) return;
    const sc = Math.min(340 / m.l, 125 / m.d, 3.2), sx = sc, sd = sc, x0 = 130, cy = 135, W = m.l * sx, rW = m.d * sd / 2, rT = Math.max(3, rW - Math.max(4, m.ap * sd * 1.2));
    const xs = x0 + W + m.la * sx, xe = x0 - m.lu * sx, p = A.prog, x = xs - (xs - xe) * p, xc = clamp(x, x0, x0 + W);
    e.A.setAttribute('x', x0); e.A.setAttribute('y', cy - rW); e.A.setAttribute('width', Math.max(0, xc - x0)); e.A.setAttribute('height', 2 * rW);
    e.B.setAttribute('x', xc); e.B.setAttribute('y', cy - rT); e.B.setAttribute('width', Math.max(0, x0 + W - xc)); e.B.setAttribute('height', 2 * rT);
    setLines(e.sa, x0, xc, cy, rW, A.phase, true); setLines(e.sb, xc, x0 + W, cy, rT, A.phase, true);
    e.dia.setAttribute('x', x0 + W / 2); e.dia.setAttribute('y', cy + 4); e.dia.textContent = W > 110 && rW > 12 ? 'Ø ' + F(m.d) + ' mm' : '';
    const yl = cy + rW + 18;
    [['l1', x0, yl - 5, x0, yl + 5], ['l2', x0 + W, yl - 5, x0 + W, yl + 5], ['l3', x0, yl, x0 + W, yl]].forEach(a => { const n = e[a[0]]; n.setAttribute('x1', a[1]); n.setAttribute('y1', a[2]); n.setAttribute('x2', a[3]); n.setAttribute('y2', a[4]); });
    e.lt.setAttribute('x', x0 + W / 2); e.lt.setAttribute('y', yl + 15); e.lt.textContent = 'l = ' + F(m.l) + ' mm';
    const ty = cy - rT;
    e.bit.setAttribute('points', `${x},${ty} ${x + 26},${ty} ${x + 26},${ty - 15} ${x + 4},${ty - 15}`);
    e.hold.setAttribute('x', x + 4); e.hold.setAttribute('y', ty - 45); e.hold.setAttribute('width', 96); e.hold.setAttribute('height', 30);
    e.fl.setAttribute('x', x + 10); e.fl.setAttribute('y', ty - 52); e.fl.textContent = '← Vorschub f';
    e.ap.setAttribute('x', Math.max(8, x - 28)); e.ap.setAttribute('y', ty - 4); e.ap.textContent = 'ap';
    const cutting = x < x0 + W && x > x0 - 1 && p < 1;
    e.chips.forEach((c, k) => {
      if (!cutting) { c.setAttribute('opacity', 0); return; }
      const ph = (A.t * 1.6 + k / e.chips.length) % 1;
      c.setAttribute('cx', x + 12 + ph * 34 + (k % 3) * 3); c.setAttribute('cy', ty - 8 - ph * 22 + ph * ph * 30); c.setAttribute('opacity', (1 - ph).toFixed(2));
    });
    e.rot.setAttribute('transform', `rotate(${(A.phase * 360).toFixed(1)} 28 40)`);
    e.nt.textContent = 'n = ' + F(m.n) + ' min⁻¹';
  }

  /* ============================================================ SVG: Fräser */
  const svgFraes = () => `<svg class="sim" id="fr-svg" viewBox="0 0 640 300" role="img" aria-label="Fräsen: Fräser mit Schneiden in der Draufsicht über dem Werkstück">
<rect x="0" y="262" width="640" height="38" fill="var(--sv-bed)"/>
<rect id="fr-wp" fill="var(--sv-wp)" stroke="var(--sv-ln)" stroke-width="1"/>
<rect id="fr-mill" fill="var(--sv-wp2)" opacity=".9"/>
<g id="fr-lines"></g>
<text id="fr-lt" text-anchor="middle"></text>
<g id="fr-cut"><circle id="fr-body" fill="var(--sv-cut)" fill-opacity=".14" stroke="var(--sv-cut)" stroke-width="1.5"/><g id="fr-teeth"></g><circle id="fr-hub" fill="var(--sv-chuck)" stroke="var(--sv-ln)" stroke-width="1"/></g>
<g id="fr-arrow"><line id="fr-ar" stroke="var(--sv-tool)" stroke-width="2.4" marker-end="url(#fr-head)"/><text id="fr-at" style="fill:var(--sv-tool)"></text></g>
<defs><marker id="fr-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--sv-tool)"/></marker></defs>
<g id="fr-rot"><path d="M34 40a14 14 0 1 1-12 7" fill="none" stroke="var(--sv-cut)" stroke-width="2.4"/><polygon points="16,42 27,44 20,53" fill="var(--sv-cut)"/></g>
<text x="56" y="44" id="fr-nt"></text></svg>`;
  function mountFraes() { const h = $('#fraesView'), e = EL.fraes; ['wp', 'mill', 'lines', 'lt', 'cut', 'body', 'teeth', 'hub', 'ar', 'at', 'rot', 'nt'].forEach(k => { e[k] = $('#fr-' + k, h); }); e.sig = ''; }
  function drawFraes(m) {
    const e = EL.fraes; if (!e.wp) return;
    const sc = Math.min(140 / m.d, 450 / (m.l + m.la + m.lu), 2.6), sx = sc, wy0 = 120, wh = 130, cyc = wy0 + wh / 2, rc = m.d * sc / 2, x0 = 40 + rc + m.la * sx, W = m.l * sx;
    const xs = x0 - m.la * sx, xe = x0 + W + m.lu * sx, p = A.prog, xc = xs + (xe - xs) * p;
    e.wp.setAttribute('x', x0); e.wp.setAttribute('y', wy0); e.wp.setAttribute('width', W); e.wp.setAttribute('height', wh);
    const bandY0 = Math.max(wy0, cyc - rc), bandY1 = Math.min(wy0 + wh, cyc + rc), mw = clamp(xc - x0, 0, W);
    e.mill.setAttribute('x', x0); e.mill.setAttribute('y', bandY0); e.mill.setAttribute('width', mw); e.mill.setAttribute('height', Math.max(0, bandY1 - bandY0));
    e.lt.setAttribute('x', x0 + W / 2); e.lt.setAttribute('y', wy0 + wh + 20); e.lt.textContent = 'l = ' + F(m.l) + ' mm';
    const sig = m.z + '|' + m.d + '|' + sc.toFixed(3);
    if (e.sig !== sig) {
      e.sig = sig; e.body.setAttribute('r', rc); e.hub.setAttribute('r', clamp(rc * 0.22, 5, 14));
      let t = ''; for (let k = 0; k < m.z; k++) { const a = k * 360 / m.z; t += `<g transform="rotate(${a})"><line x1="${clamp(rc * 0.22, 5, 14)}" y1="0" x2="${rc}" y2="0" stroke="var(--sv-cut)" stroke-width="1" opacity=".5"/><polygon points="${rc - 3},-5 ${rc + 9},-2 ${rc + 9},4 ${rc - 3},5" fill="var(--sv-tool)" stroke="var(--sv-ln)" stroke-width="1"/></g>`; }
      e.teeth.innerHTML = t;
    }
    e.cut.setAttribute('transform', `translate(${xc.toFixed(1)} ${cyc})`); e.teeth.setAttribute('transform', `rotate(${(A.phase * 360).toFixed(1)})`);
    e.ar.setAttribute('x1', 150); e.ar.setAttribute('y1', wy0 + wh + 44); e.ar.setAttribute('x2', 260); e.ar.setAttribute('y2', wy0 + wh + 44);
    e.at.setAttribute('x', 268); e.at.setAttribute('y', wy0 + wh + 48); e.at.textContent = 'Vorschub vf = ' + F(m.vf) + ' mm/min';
    e.rot.setAttribute('transform', `rotate(${(-A.phase * 360).toFixed(1)} 28 40)`); e.nt.textContent = 'n = ' + F(m.n) + ' min⁻¹ · z = ' + m.z;
  }

  /* ============================================================ SVG: Bohrer */
  const svgBohr = () => `<svg class="sim" id="bo-svg" viewBox="0 0 640 330" role="img" aria-label="Bohren: Spiralbohrer mit Spitze im Schnitt durch die Platte">
<defs><pattern id="bo-fl" width="22" height="16" patternUnits="userSpaceOnUse"><rect width="22" height="16" fill="var(--sv-tool)"/><path d="M-2 18L24 -2" stroke="var(--sv-hole)" stroke-width="5" opacity=".55"/></pattern></defs>
<rect x="0" y="300" width="640" height="30" fill="var(--sv-bed)"/>
<rect id="bo-plate" fill="var(--sv-wp)" stroke="var(--sv-ln)" stroke-width="1"/>
<path id="bo-hole" fill="var(--sv-hole)"/>
<g id="bo-chips"><circle class="cp" r="3" fill="var(--sv-chip)"/><circle class="cp" r="2.4" fill="var(--sv-chip)"/><circle class="cp" r="3" fill="var(--sv-chip)"/><circle class="cp" r="2.4" fill="var(--sv-chip)"/><circle class="cp" r="3" fill="var(--sv-chip)"/></g>
<g id="bo-drill"><rect id="bo-chuck" fill="var(--sv-chuck)" stroke="var(--sv-ln)" stroke-width="1"/><rect id="bo-body" fill="url(#bo-fl)" stroke="var(--sv-ln)" stroke-width="1"/><polygon id="bo-tip" fill="var(--sv-tool)" stroke="var(--sv-ln)" stroke-width="1"/></g>
<text id="bo-dt" text-anchor="middle"></text><text id="bo-lt" text-anchor="start"></text><text id="bo-st" text-anchor="start"></text>
<g id="bo-rot"><path d="M34 40a14 14 0 1 1-12 7" fill="none" stroke="var(--sv-cut)" stroke-width="2.4"/><polygon points="16,42 27,44 20,53" fill="var(--sv-cut)"/></g>
<text x="56" y="44" id="bo-nt"></text></svg>`;
  function mountBohr() { const h = $('#bohrView'), e = EL.bohr; ['plate', 'hole', 'chuck', 'body', 'tip', 'dt', 'lt', 'st', 'rot', 'nt', 'fl'].forEach(k => { e[k] = $('#bo-' + k, h); }); e.cps = $$('.cp', h); e.pat = $('#bo-fl', h); }
  function drawBohr(m) {
    const e = EL.bohr; if (!e.plate) return;
    const s = Math.min(150 / m.t, 88 / m.d, 3), cx = 320, top = 130, px = 220, pw = 200, tpx = m.t * s, bottom = top + tpx, dw = m.d * s, la = m.la * s, lu = m.durch ? m.lu * s : 0;
    const total = (m.L * s) + 40, p = A.prog, tipY = top - 40 + p * total, yb = tipY - la;
    e.plate.setAttribute('x', px); e.plate.setAttribute('y', top); e.plate.setAttribute('width', pw); e.plate.setAttribute('height', tpx);
    const hb = Math.min(bottom, Math.max(top, yb)), hbt = Math.min(bottom, Math.max(top, tipY)), r = dw / 2;
    e.hole.setAttribute('d', tipY <= top ? '' : (yb >= bottom || tipY >= bottom && m.durch) ? `M${cx - r},${top} L${cx - r},${bottom} L${cx + r},${bottom} L${cx + r},${top} Z` : `M${cx - r},${top} L${cx - r},${hb} L${cx},${hbt} L${cx + r},${hb} L${cx + r},${top} Z`);
    const bodyH = 150;
    e.body.setAttribute('x', cx - r); e.body.setAttribute('y', yb - bodyH); e.body.setAttribute('width', dw); e.body.setAttribute('height', bodyH);
    e.tip.setAttribute('points', `${cx - r},${yb} ${cx + r},${yb} ${cx},${tipY}`);
    e.chuck.setAttribute('x', cx - r - 8); e.chuck.setAttribute('y', yb - bodyH - 44); e.chuck.setAttribute('width', dw + 16); e.chuck.setAttribute('height', 44);
    e.pat.setAttribute('patternTransform', `translate(0 ${((A.phase * 16 * 2) % 16).toFixed(2)})`);
    e.dt.setAttribute('x', cx); e.dt.setAttribute('y', bottom + 18); e.dt.textContent = 'Ø ' + F(m.d) + ' mm';
    e.lt.setAttribute('x', px + pw + 10); e.lt.setAttribute('y', (top + bottom) / 2 + 4); e.lt.textContent = 't = ' + F(m.t) + ' mm';
    e.st.setAttribute('x', px + pw + 10); e.st.setAttribute('y', top + 12); e.st.textContent = 'Spitzenwinkel ' + m.sigma + '°' + (m.durch ? ' · Durchgangsbohrung' : ' · Sackloch');
    const cutting = tipY > top && p < 1;
    e.cps.forEach((c, k) => {
      if (!cutting) { c.setAttribute('opacity', 0); return; }
      const ph = (A.t * 1.4 + k / e.cps.length) % 1, side = k % 2 ? 1 : -1;
      c.setAttribute('cx', cx + side * (r + 6 + ph * 28 + k * 2)); c.setAttribute('cy', top - 4 - ph * 30 + ph * ph * 40); c.setAttribute('opacity', (1 - ph).toFixed(2));
    });
    e.rot.setAttribute('transform', `rotate(${(A.phase * 360).toFixed(1)} 28 40)`); e.nt.textContent = 'n = ' + F(m.n) + ' min⁻¹';
  }
  function draw(sim, m) { m = m || model(sim); if (sim === 'dreh') drawDreh(m); else if (sim === 'fraes') drawFraes(m); else if (sim === 'bohr') drawBohr(m); }

  /* ============================================================ Animationsschleife */
  const A = { last: 0, phase: 0, t: 0, prog: 0, raf: 0 };
  function loop(ts) {
    A.raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, ((ts || 0) - (A.last || ts || 0)) / 1000); A.last = ts;
    const sim = S.tab; if (!EL[sim] || !S.run) return;
    const m = model(sim), T = cycleT(m), n = isNum(m.n) ? m.n : 0;
    A.phase = (A.phase + dt * (0.5 + 2.5 * Math.min(1, n / 2000))) % 1; A.t += dt;
    if (A.t > T + 0.9) A.t = 0;
    A.prog = Math.min(1, A.t / T);
    draw(sim, m);
  }

  /* ============================================================ Seiten Drehen, Fräsen, Bohren */
  function simPage(sim, svg, ctrls, extra, title) {
    return `<div class="sim-grid"><div class="card simL">${svg}<div class="live" id="${sim}-live" aria-live="polite"></div><div class="simbar"><span id="${sim}-note"></span></div></div>
<div><div class="card"><h4>Einstellungen</h4><div class="cb">${ctrls}</div></div>
<div class="card"><h4>Rechenweg und Ergebnis</h4><div class="cb"><div id="${sim}-res"></div><div id="${sim}-win"></div></div></div>
<div class="card"><h4>Schnittgrößen im Bild</h4><div class="cb" id="${sim}-viz"></div></div>
${extra || ''}</div></div>`;
  }
  const lernBox = (t, h) => `<details class="card"><summary>${t}</summary><div class="cb" style="font-size:14px;line-height:1.5">${h}</div></details>`;
  function buildDreh() {
    const c = SPEC.dreh.map(x => ctlHtml('dreh', x)).join('');
    const ctrls = c + `<div class="two">${selHtml('dreh', 'mat', 'Werkstoff', matOpts)}${selHtml('dreh', 'cut', 'Schneidstoff', cutOpts)}</div>
<div class="ctl chk"><input type="checkbox" id="dreh-fc" data-k="fc"><label for="dreh-fc">Schnittkraft und Leistung anzeigen (kc, Richtwert)</label></div>
<div class="btns"><button class="btn s" data-act="nrich">n aus Richtwert einstellen</button><button class="btn s" data-act="tafel">Richtwert-Tafel</button><button class="btn s" data-act="reset">Standardwerte</button></div>`;
    const extra = lernBox('Was zeigt die Simulation?', '<p>Der Drehmeißel fährt bei laufender Spindel von rechts nach links. Links vom Meißel ist das Werkstück noch dick, rechts schon auf Maß gedreht (Zustellung ap).</p><p><b>Je größer n, desto größer vc</b> bei gleichem Durchmesser. <b>Je größer f und n, desto schneller</b> fährt der Meißel (vf) und desto kürzer ist die Hauptzeit th. Die Animation läuft im Zeitraffer.</p><p class="hint2">Richtwerte (vc-Fenster, kc) sind gerundete Näherungen. Werkzeughersteller beachten.</p>');
    $('#drehView').innerHTML = simPage('dreh', svgDreh(), ctrls, extra); mountDreh(); bindSim('dreh'); syncCtl('dreh'); update('dreh');
  }
  function buildFraes() {
    const c = SPEC.fraes.map(x => ctlHtml('fraes', x)).join('');
    const ctrls = c + `<div class="two">${selHtml('fraes', 'gr', 'Werkstoff', grOpts)}${selHtml('fraes', 'cut', 'Schneidstoff', cutOpts)}</div>
<div class="btns"><button class="btn s" data-act="half">Anlauf = Überlauf = d/2</button><button class="btn s" data-act="tafel">Richtwert-Tafel</button><button class="btn s" data-act="reset">Standardwerte</button></div>`;
    const extra = lernBox('Was zeigt die Simulation?', '<p>Draufsicht auf einen Fräser mit <b>z Schneiden</b>. Der Fräser läuft über das Werkstück, die gefräste Fläche ist dunkler.</p><p>Die Drehzahl folgt aus vc und Fräserdurchmesser. Der Tischvorschub ist <b>vf = fz · z · n</b>: Jede Schneide nimmt pro Umdrehung einen Span der Dicke fz ab, mehr Schneiden erlauben bei gleichem fz mehr Vorschub.</p><p class="hint2">Anlauf und Überlauf hängen von der Fräsart ab. Der Knopf setzt beide auf d/2 als einfache Annahme für Planfräsen. Genaue Werte im Tabellenbuch nachsehen.</p>');
    $('#fraesView').innerHTML = simPage('fraes', svgFraes(), ctrls, extra); mountFraes(); bindSim('fraes'); syncCtl('fraes'); update('fraes');
  }
  function buildBohr() {
    const c = SPEC.bohr.slice(0, 4).map(x => ctlHtml('bohr', x)).join('');
    const sig = selHtml('bohr', 'sigma', 'Spitzenwinkel σ', [[90, '90°'], [118, '118° (Stahl, Normal)'], [130, '130°'], [140, '140°']]);
    const ctrls = c + `<div class="ctl chk"><input type="checkbox" id="bohr-durch" data-k="durch"><label for="bohr-durch">Durchgangsbohrung (mit Überlauf)</label></div><div id="bohr-lu-wrap">${ctlHtml('bohr', SPEC.bohr[4])}</div>
<div class="two">${selHtml('bohr', 'gr', 'Werkstoff', grOpts)}${selHtml('bohr', 'cut', 'Schneidstoff', cutOpts)}</div>${sig}
<div class="btns"><button class="btn s" data-act="tafel">Richtwert-Tafel</button><button class="btn s" data-act="reset">Standardwerte</button></div>`;
    const extra = lernBox('Was zeigt die Simulation?', '<p>Schnitt durch die Platte: Der Bohrer fährt von oben nach unten. Die <b>Spitze</b> hat den Winkel σ (118° bei Stahl) und eine Länge von etwa <b>0,3 · d</b>. Dieser Weg zählt zur Bohrzeit mit, denn bis die Spitze eingetaucht ist, ist das Loch noch nicht auf voller Tiefe.</p><p>Bei einer <b>Durchgangsbohrung</b> kommt noch der Überlauf lü hinzu, beim <b>Sackloch</b> nicht.</p><p class="hint2">Die Spiralnuten drehen sich nicht maßstäblich.</p>');
    $('#bohrView').innerHTML = simPage('bohr', svgBohr(), ctrls, extra); mountBohr(); bindSim('bohr'); syncCtl('bohr'); update('bohr');
  }

  /* ============================================================ Richtwerte */
  const TF = { proc: 'dreh', gr: 'stahl', cut: 'hss', d: 30, mode: 'frei', sel: null, pr: null };
  function winTxt(w) { return w ? w[0] + ' – ' + w[1] : '–'; }
  function tafelTable() {
    const P0 = C.VC_TAB[TF.proc];
    return `<table class="iot"><tr><th>Werkstoff</th><th>HSS</th><th>Hartmetall</th></tr>${C.GRUPPEN.map(g => `<tr><td>${g[1]}</td><td class="a">${winTxt(P0[g[0]].hss)}</td><td class="a">${P0[g[0]].hm ? winTxt(P0[g[0]].hm) : '<span class="hint2">Herstellerangaben</span>'}</td></tr>`).join('')}</table><p class="hint2">vc in m/min. Richtwerte, Werkzeughersteller beachten. Schruppen eher unten im Fenster, Schlichten eher oben.</p>`;
  }
  function seriesHtml(cfg) {
    return `<div class="rw" id="${cfg.id}">${C.SERIES_STD.map(n => {
      const v = cfg.d ? C.vc(cfg.d, n) : NaN, inw = cfg.win && cfg.d && C.vcStatus(v, cfg.win) === 'ok';
      const cls = (cfg.cls && cfg.cls(n)) || (cfg.sel === n ? 'on' : inw && cfg.mark ? 'inw' : '');
      return `<button data-n="${n}" class="${cls}"${cfg.disabled ? ' disabled' : ''} aria-label="${n} pro Minute">${n}<small>${cfg.d ? F(v, v >= 100 ? 0 : 1) + ' m/min' : 'min⁻¹'}</small></button>`;
    }).join('')}</div>`;
  }
  function tafelPick() {
    const win = C.vcWindow(TF.proc, TF.gr, TF.cut);
    if (!win) return '<p class="hint2">Für diese Kombination ist kein Richtwert hinterlegt. Bohren mit Hartmetall bitte nach Herstellerangabe.</p>';
    const nLo = C.nFromVc(win[0], TF.d), nHi = C.nFromVc(win[1], TF.d);
    if (TF.mode === 'ueb') {
      const q = TF.pr; if (!q) return '';
      const best = C.nearestSpeed(C.SERIES_STD, q.nS), inW = k => C.vcStatus(C.vc(q.d, k), q.win) === 'ok';
      const res = q.sel ? (() => { const v = C.vc(q.d, q.sel), st = C.vcStatus(v, q.win); return `<div class="fb ${q.sel === best ? 'ok' : 'bad'}"><b>${q.sel === best ? '✓ Das ist die nächstliegende Stufe.' : '✗ Näher liegt ' + best + ' min⁻¹.'}</b><br>Rechnerisch n = ${q.vcT} · 1000 / (π · ${q.d}) = <b>${F(q.nS)} min⁻¹</b>. Mit ${q.sel} min⁻¹ ist vc = <b>${F(v)} m/min</b>: ${st === 'ok' ? 'im Fenster' : st === 'niedrig' ? 'unter dem Fenster' : 'über dem Fenster'} (${winTxt(q.win)} m/min).</div>` })() : '';
      return `<p><b>Übung:</b> ${esc(q.what)}, Ø ${q.d} mm. Sollwert vc = ${q.vcT} m/min. Tippe die <b>nächstliegende Drehzahlstufe</b> der Maschine an.</p>${seriesHtml({ id: 'tfSer', d: q.d, sel: q.sel, disabled: !!q.sel, cls: n => q.sel ? (n === best ? 'ok' : n === q.sel ? 'bad' : '') : '' })}${res}<div class="btns"><button class="btn pri" data-tf="newpr">Neue Übung</button></div>`;
    }
    const sel = TF.sel, v = sel ? C.vc(TF.d, sel) : NaN, st = sel ? C.vcStatus(v, win) : '';
    return `<p>Für Ø ${F(TF.d)} mm und vc = ${winTxt(win)} m/min liegt die Drehzahl zwischen <b>${F(nLo, 0)}</b> und <b>${F(nHi, 0)} min⁻¹</b>. Grün: Stufen im Fenster.</p>${root.ZERVIZ ? root.ZERVIZ.nBand(win, TF.d, sel) : ''}${seriesHtml({ id: 'tfSer', d: TF.d, win, sel, mark: true })}${sel ? `<div class="fb ${st === 'ok' ? 'ok' : 'bad'}">Gewählt: <b>${sel} min⁻¹</b> ergibt vc = <b>${F(v)} m/min</b>, das ist ${st === 'ok' ? 'im Richtwert-Fenster.' : st === 'niedrig' ? 'zu niedrig (Aufbauschneide, schlechte Oberfläche).' : 'zu hoch (Schneide überhitzt, hoher Verschleiß).'}</div>` : '<p class="hint2">Tippe eine Stufe an, um vc zu sehen.</p>'}`;
  }
  function newPractice() {
    const combos = []; ['dreh', 'fraes', 'bohr'].forEach(p => C.GRUPPEN.forEach(g => ['hss', 'hm'].forEach(c => { const w = C.vcWindow(p, g[0], c); if (w) combos.push({ p, g, c, w }); })));
    const o = combos[Math.floor(Math.random() * combos.length)], dl = [10, 12, 16, 20, 25, 30, 40, 50, 63], d = dl[Math.floor(Math.random() * dl.length)];
    const vcT = Math.max(5, Math.round((o.w[0] + o.w[1]) / 2 / 5) * 5);
    TF.pr = { d, win: o.w, vcT, nS: C.nFromVc(vcT, d), sel: null, what: `${C.PROCS[o.p]} in ${o.g[1]} mit ${C.CUTS[o.c]}` };
  }
  function renderTafel() {
    const h = $('#tafelView');
    const opts = (arr, cur) => arr.map(o => `<option value="${o[0]}"${String(cur) === String(o[0]) ? ' selected' : ''}>${esc(o[1])}</option>`).join('');
    h.innerHTML = `<div class="card"><h4>Richtwert-Tafel: Schnittgeschwindigkeit vc</h4><div class="cb"><div class="seg" id="tfProc">${Object.keys(C.PROCS).map(k => `<button data-p="${k}" class="${TF.proc === k ? 'on' : ''}">${C.PROCS[k]}</button>`).join('')}</div><div style="margin-top:8px">${tafelTable()}</div>${root.ZERVIZ ? root.ZERVIZ.tafel(TF.proc) : ''}</div></div>
<details class="card"><summary>kc-Richtwerte (spezifische Schnittkraft)</summary><div class="cb"><table class="iot"><tr><th>Werkstoff</th><th>kc in N/mm²</th></tr>${Object.keys(C.MATERIALS).map(k => `<tr><td>${C.MATERIALS[k].name}</td><td class="a">${C.MATERIALS[k].kc}</td></tr>`).join('')}</table><p class="hint2">Richtwerte, vereinfacht für übliche Spanungsdicken. Echte kc-Werte hängen von der Spanungsdicke ab (Tabellenbuch). Fc = A · kc.</p></div></details>
<div class="card"><h4>Drehzahl wählen</h4><div class="cb"><div class="seg" id="tfMode"><button data-m="frei" class="${TF.mode === 'frei' ? 'on' : ''}">Frei probieren</button><button data-m="ueb" class="${TF.mode === 'ueb' ? 'on' : ''}">Übung</button></div>
${TF.mode === 'frei' ? `<div style="margin-top:10px"><div class="two"><label class="f"><span>Verfahren</span><select id="tfP">${opts(Object.keys(C.PROCS).map(k => [k, C.PROCS[k]]), TF.proc)}</select></label><label class="f"><span>Werkstoff</span><select id="tfG">${opts(C.GRUPPEN, TF.gr)}</select></label></div><div class="two"><label class="f"><span>Schneidstoff</span><select id="tfC">${opts(cutOpts, TF.cut)}</select></label><label class="f"><span>Durchmesser d in mm</span><input id="tfD" inputmode="decimal" value="${dispNum(TF.d, 1)}"></label></div></div>` : ''}
<div id="tfBody">${tafelPick()}</div><p class="hint2">Maschinen-Drehzahlreihe (Beispiel, Normzahlreihe): ${C.SERIES_STD.join(' · ')} min⁻¹. Richtwerte, Werkzeughersteller beachten.</p></div></div>`;
  }
  function bindTafel() {
    const h = $('#tafelView');
    h.addEventListener('click', e => {
      const p = e.target.closest('#tfProc [data-p]'), m = e.target.closest('#tfMode [data-m]'), s = e.target.closest('#tfSer [data-n]'), b = e.target.closest('[data-tf]');
      if (p) { TF.proc = p.dataset.p; if (!C.vcWindow(TF.proc, TF.gr, TF.cut)) TF.cut = 'hss'; TF.sel = null; renderTafel(); }
      else if (m) { TF.mode = m.dataset.m; TF.sel = null; if (TF.mode === 'ueb' && !TF.pr) newPractice(); renderTafel(); }
      else if (s) { const n = +s.dataset.n; if (TF.mode === 'ueb') { if (!TF.pr.sel) { TF.pr.sel = n; renderTafel(); } } else { TF.sel = n; $('#tfBody').innerHTML = tafelPick(); } }
      else if (b && b.dataset.tf === 'newpr') { newPractice(); renderTafel(); }
    });
    h.addEventListener('change', e => {
      const t = e.target;
      if (t.id === 'tfP') { TF.proc = t.value; if (!C.vcWindow(TF.proc, TF.gr, TF.cut)) TF.cut = 'hss'; TF.sel = null; renderTafel(); }
      else if (t.id === 'tfG') { TF.gr = t.value; TF.sel = null; renderTafel(); }
      else if (t.id === 'tfC') { TF.cut = t.value; TF.sel = null; renderTafel(); }
      else if (t.id === 'tfD') { const v = C.parseDE(t.value); if (isNum(v) && v > 0) TF.d = clamp(v, 2, 400); TF.sel = null; t.value = dispNum(TF.d, 1); $('#tfBody').innerHTML = tafelPick(); }
    });
  }

  /* ============================================================ Quiz (Aufgaben, Trainer, Fehlersuche) */
  const ABZUG = [0, 10, 25, 50];
  const stars = n => '★'.repeat(n) + '☆'.repeat(3 - n);
  function makeQuiz(host, cfg) {
    const q = { o: null, sel: null, val: '', hint: 0, checked: false, ok: false, res: null, pct: 0 };
    function load(id, seed) { q.o = BUILD(id, seed); q.sel = null; q.val = ''; q.hint = 0; q.checked = false; q.ok = false; q.res = null; q.pct = 0; render(); if (cfg.onLoad) cfg.onLoad(q); }
    function answerHtml() {
      const o = q.o;
      if (o.type === 'num') return `<div class="qin"><input id="${cfg.id}In" inputmode="decimal" autocomplete="off" placeholder="Deine Antwort" aria-label="Antwort" value="${esc(q.val)}"${q.checked ? ' disabled' : ''}><span class="u">${esc(o.unit || '')}</span></div>`;
      if (o.type === 'choice') return `<div class="opts">${o.optsShown.map((t, i) => `<button data-a="opt" data-i="${i}" class="${q.checked ? (i === o.ans ? 'ok' : i === q.sel ? 'bad' : '') : (q.sel === i ? 'on' : '')}"${q.checked ? ' disabled' : ''}>${esc(t)}</button>`).join('')}</div>`;
      const best = o.accept;
      return `<div class="rw">${o.series.map(n => `<button data-a="ser" data-n="${n}" class="${q.checked ? (best.includes(n) ? 'ok' : n === q.sel ? 'bad' : '') : (q.sel === n ? 'on' : '')}"${q.checked ? ' disabled' : ''}>${n}<small>min⁻¹</small></button>`).join('')}</div><p class="hint2">Tippe eine Stufe der Drehzahlreihe an, dann „Prüfen“.</p>`;
    }
    function fbHtml() {
      if (!q.checked) return '';
      const o = q.o, u = esc(o.unit || ''); let h;
      if (o.type === 'num') h = q.ok ? `<b>✓ Richtig.</b> Ergebnis: <span class="res">${F(o.sol)} ${u}</span>${q.res && q.res.rel > 0.5 ? ' (dein Wert weicht ' + F(q.res.rel, 1) + ' % ab, das ist in der Toleranz)' : ''}.` : `<b>✗ Nicht richtig.</b> Dein Wert: ${isNum(q.res && q.res.value) ? F(q.res.value) : '–'} ${u}. Richtig ist <span class="res">${F(o.sol)} ${u}</span> (Toleranz ${o.tol ? '±' + o.tol + ' %' : 'exakt'}).`;
      else if (o.type === 'choice') h = q.ok ? `<b>✓ Richtig:</b> ${esc(o.sol)}.` : `<b>✗ Nicht richtig.</b> Richtig ist: <span class="res">${esc(o.sol)}</span>.`;
      else {
        const v = C.vc(o.d, q.sel), st = o.window[0] === o.window[1] ? '' : C.vcStatus(v, o.window);
        h = `${q.ok ? '<b>✓ Richtig.</b>' : '<b>✗ Nicht richtig.</b>'} Mit ${q.sel} min⁻¹ ist vc = <span class="res">${F(v)} m/min</span>${st ? ': ' + (st === 'ok' ? 'im Fenster' : st === 'niedrig' ? 'unter dem Fenster' : 'über dem Fenster') : ''}.${q.ok ? '' : ' Richtig wäre ' + o.accept.join(' oder ') + ' min⁻¹.'}`;
      }
      if (cfg.exam && cfg.exam() && q.ok) h += `<br>Punkte im Prüfmodus: <b>${q.pct} %</b>${q.hint ? ' (Tipp-Abzug ' + ABZUG[q.hint] + ' %)' : ''}.`;
      return `<div class="fb ${q.ok ? 'ok' : 'bad'}">${h}<div style="margin-top:8px"><b>Lösungsweg</b></div><ol>${o.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol></div>`;
    }
    function hintHtml() {
      if (!cfg.tips || !q.hint) return '';
      return q.o.tips.slice(0, q.hint).map((t, i) => `<div class="fb"><b>Tipp ${i + 1}:</b> ${esc(t)}</div>`).join('');
    }
    function render() {
      const o = q.o; if (!o) { host.innerHTML = ''; return; }
      const exam = cfg.exam && cfg.exam(), maxT = o.tips.length;
      const meta = `<div class="qm"><span class="tag">${esc(o.catName)}</span><span class="tag lv" aria-label="Stufe ${o.level}">${stars(o.level)}</span>${exam ? '<span class="badge-exam">Prüfmodus</span>' : ''}</div>`;
      const btns = q.checked ? (cfg.afterHtml ? cfg.afterHtml(q) : '') : `<div class="btns"><button class="btn pri" data-a="check">✓ Prüfen</button>${cfg.tips ? `<button class="btn" data-a="hint"${q.hint >= maxT ? ' disabled' : ''}>💡 Tipp (${q.hint}/${maxT})</button>` : ''}${cfg.skip ? `<button class="btn" data-a="skip">Überspringen</button>` : ''}</div>${exam && cfg.tips ? `<p class="hint2">Prüfmodus: Tipp 1 kostet ${ABZUG[1]} %, Tipp 2 ${ABZUG[2]} %, Tipp 3 ${ABZUG[3]} % der Punkte.</p>` : ''}`;
      host.innerHTML = `${cfg.head ? cfg.head(q) : ''}<div class="qcard">${meta}<div class="qt">${esc(o.text)}</div><div data-zv="${esc(o.id)}" data-exam="${exam ? 1 : 0}">${root.ZERVIZ ? root.ZERVIZ.task(o.id, exam) : ''}</div>${answerHtml()}${hintHtml()}${btns}${fbHtml()}</div>`;
    }
    function sync() { const i = $('#' + cfg.id + 'In', host); if (i) q.val = i.value; }
    function check() {
      if (!q.o || q.checked) return; sync(); const o = q.o;
      if (o.type === 'num') { const v = C.parseDE(q.val); if (!isNum(v)) { toast('Bitte eine Zahl eingeben.'); return; } q.res = C.checkNum(q.val, o.sol, { tol: o.tol }); q.ok = q.res.ok; }
      else if (o.type === 'choice') { if (q.sel == null) { toast('Bitte eine Antwort wählen.'); return; } q.ok = q.sel === o.ans; }
      else { if (q.sel == null) { toast('Bitte eine Stufe wählen.'); return; } q.ok = o.accept.includes(q.sel); }
      q.checked = true; const ex = cfg.exam && cfg.exam(); q.pct = q.ok ? (ex ? Math.max(0, 100 - ABZUG[q.hint]) : 100) : 0;
      sound(q.ok ? 'ding' : 'buzz'); render(); if (cfg.onCheck) cfg.onCheck(q);
    }
    function hint() { if (q.checked || q.hint >= q.o.tips.length) return; sync(); q.hint++; if (cfg.onHint) cfg.onHint(q); render(); }
    host.addEventListener('click', e => {
      const b = e.target.closest('[data-a]'); if (!b || !host.contains(b)) return; const a = b.dataset.a;
      if (a === 'opt' && !q.checked) { sync(); q.sel = +b.dataset.i; render(); }
      else if (a === 'ser' && !q.checked) { sync(); q.sel = +b.dataset.n; render(); }
      else if (a === 'check') check(); else if (a === 'hint') hint();
      else if (cfg.onAction) { sync(); cfg.onAction(a, q, b); }
    });
    host.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); check(); } });
    return { q, load, render, check };
  }

  /* ---------- Aufgabenliste und Detail ---------- */
  let taskQuiz = null;
  const seedOf = id => (S.seeds[id] == null ? 0 : S.seeds[id]);
  const newSeed = () => Math.floor(Math.random() * 1e6) + 1;
  function markResult(q) {
    const id = q.o.id; S.tried[id] = true; lsS('tried', S.tried);
    if (q.ok) { S.done[id] = true; S.pct[id] = Math.max(S.pct[id] || 0, q.pct); lsS('done', S.done); lsS('pct', S.pct); }
    updateChrome();
  }
  function recordHint(q) {
    const id = q.o.id; S.hints[id] = Math.max(S.hints[id] || 0, q.hint); lsS('hints', S.hints);
    if (S.exam) { const c = lsG('ctipps', {}); c[id] = Math.max(c[id] || 0, q.hint); lsS('ctipps', c); }
  }
  function openTask(id) {
    if (!DEFS[id]) return; S.task = id; setTab('tasks', true); renderTasks();
    taskQuiz.load(id, seedOf(id)); const v = $('#pgTasks'); if (v) v.scrollTop = 0; updateChrome();
  }
  function nextTaskId(cur) {
    const ids = taskIds(), i = ids.indexOf(cur), order = ids.slice(i + 1).concat(ids.slice(0, i + 1));
    return order.find(x => !S.done[x]) || order.find(x => x !== cur) || cur;
  }
  function renderTasks() {
    const h = $('#taskView');
    if (!taskQuiz || !$('#taskQ', h)) {
      h.innerHTML = '<div id="taskList"></div><div id="taskQ" hidden></div>';
      taskQuiz = makeQuiz($('#taskQ', h), {
        id: 'tk', tips: true, exam: () => S.exam,
        head: q => `<div class="fbar"><button class="chip s" data-a="back">← Aufgabenliste</button><button class="chip s" data-a="newnum">🔄 Neue Zahlen</button></div><div class="big">${esc(q.o.title)}</div>`,
        afterHtml: q => `<div class="btns"><button class="btn" data-a="newnum">🔄 Mit neuen Zahlen</button><button class="btn pri" data-a="next">Nächste Aufgabe</button><button class="btn" data-a="back">Zur Liste</button></div>`,
        onHint: recordHint, onCheck: markResult,
        onAction: (a, q) => {
          if (a === 'back') { S.task = null; renderTasks(); updateChrome(); }
          else if (a === 'newnum') { S.seeds[q.o.id] = newSeed(); lsS('seeds', S.seeds); taskQuiz.load(q.o.id, S.seeds[q.o.id]); }
          else if (a === 'next') openTask(nextTaskId(q.o.id));
        }
      });
    }
    const list = $('#taskList', h), qd = $('#taskQ', h);
    if (S.task) { list.hidden = true; qd.hidden = false; return; }
    qd.hidden = true; list.hidden = false;
    const ids = taskIds(), tot = ids.length, dn = nDone();
    const T = root.ZER_TASKS, cats = Array.from(new Set(T.map(t => t.cat)));
    const flt = S.taskFilter;
    let html = `<div class="card"><div class="cb" style="padding-top:12px"><div class="big" style="margin:0">${dn} von ${tot} Aufgaben gelöst</div><div class="stbar"><i style="width:${tot ? Math.round(dn / tot * 100) : 0}%"></i></div><p class="hint2">Zahlen kommen aus Parametern: „Neue Zahlen“ erzeugt dieselbe Aufgabe mit anderen Werten. ${S.exam ? '<span class="badge-exam">Prüfmodus an</span> Tipps kosten Punkte.' : 'Tipps sind im normalen Üben kostenlos. Im Prüfmodus kosten sie Punkte (Schalter unten).'}</p>
<div class="fbar" style="margin-top:8px"><button class="chip s ${flt === 'alle' ? 'on' : ''}" data-f="alle">Alle</button>${cats.map(c => `<button class="chip s ${flt === c ? 'on' : ''}" data-f="${esc(c)}">${esc(c)}</button>`).join('')}</div></div></div>`;
    cats.filter(c => flt === 'alle' || flt === c).forEach(c => {
      html += `<div class="gh">${esc(c)}</div><div class="card">${T.filter(t => t.cat === c).map(t => {
        const d = S.done[t.id], p = S.pct[t.id];
        return `<button class="row" data-t="${t.id}"><span class="dot ${d ? 'g' : S.tried[t.id] ? 'p' : ''}" aria-hidden="true">${d ? '✓' : S.tried[t.id] ? '…' : ''}</span><div class="grow"><b>${esc(t.title)}</b><small>${t.id} · <span class="lv">${stars(t.level)}</span>${d && S.pct[t.id] != null ? ' · beste Wertung ' + p + ' %' : ''}</small></div></button>`;
      }).join('')}</div>`;
    });
    list.innerHTML = html;
  }
  function bindTasks() {
    $('#taskView').addEventListener('click', e => {
      const r = e.target.closest('[data-t]'), f = e.target.closest('[data-f]');
      if (r) openTask(r.dataset.t); else if (f) { S.taskFilter = f.dataset.f; renderTasks(); }
    });
  }

  /* ---------- Trainer ---------- */
  const TRS = Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsG('trainer', {}));
  let trainQuiz = null;
  function trainPool() { return ORDER.filter(id => DEFS[id].type !== 'choice' && !DEFS[id].extra && (S.trainCat === 'alle' || DEFS[id].cat === S.trainCat)); }
  function nextTrain() { const p = trainPool(), id = p[Math.floor(Math.random() * p.length)]; trainQuiz.load(id, newSeed()); }
  function renderTrain() {
    const h = $('#trainView');
    if (!trainQuiz) {
      h.innerHTML = '<div id="trHead"></div><div id="trQ"></div>';
      trainQuiz = makeQuiz($('#trQ', h), {
        id: 'tr', tips: true, skip: true, exam: null,
        onCheck: q => { TRS.n++; if (q.ok) { TRS.ok++; TRS.streak++; TRS.best = Math.max(TRS.best, TRS.streak); } else TRS.streak = 0; lsS('trainer', TRS); trHead(); },
        afterHtml: () => '<div class="btns"><button class="btn pri" data-a="next">Nächste Aufgabe</button></div>',
        onAction: a => { if (a === 'next' || a === 'skip') nextTrain(); }
      });
      nextTrain();
    }
    trHead();
  }
  function trHead() {
    const cats = [['alle', 'Alle']].concat(root.ZER_CAT_KEYS.filter(k => k !== 'praxis').map(k => [k, root.ZER_CATS[k]]));
    $('#trHead').innerHTML = `<div class="boxes"><div class="bx"><b>${TRS.streak}</b>Serie</div><div class="bx"><b>${TRS.best}</b>Beste Serie</div><div class="bx"><b>${TRS.ok} / ${TRS.n}</b>richtig</div></div><div class="fbar">${cats.map(c => `<button class="chip s ${S.trainCat === c[0] ? 'on' : ''}" data-c="${c[0]}">${esc(c[1])}</button>`).join('')}<button class="chip s danger" data-c="reset">Zähler zurücksetzen</button></div>`;
  }
  function bindTrain() {
    $('#trainView').addEventListener('click', e => {
      const c = e.target.closest('#trHead [data-c]'); if (!c) return;
      if (c.dataset.c === 'reset') { Object.assign(TRS, { n: 0, ok: 0, streak: 0, best: 0 }); lsS('trainer', TRS); trHead(); }
      else { S.trainCat = c.dataset.c; trHead(); nextTrain(); }
    });
  }

  /* ---------- Fehlersuche ---------- */
  const FSS = Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsG('fs', {}));
  let fsQuiz = null, fsLast = null;
  function fsPool() { return ORDER.filter(id => DEFS[id].cat === 'praxis' && DEFS[id].type === 'choice'); }
  function nextFs() { const p = fsPool().filter(id => id !== fsLast), id = p[Math.floor(Math.random() * p.length)]; fsLast = id; fsQuiz.load(id, newSeed()); }
  function fsHead() { $('#fsHead').innerHTML = `<div class="boxes"><div class="bx"><b>${FSS.streak}</b>Serie</div><div class="bx"><b>${FSS.best}</b>Beste Serie</div><div class="bx"><b>${FSS.ok} / ${FSS.n}</b>richtig</div></div><p class="hint2" style="margin:0 0 8px">Lies die Fehlerkarte, rechne vc nach und wähle die wahrscheinlichste Ursache. Die Zahlen stehen auf der Karte, die Ursache nicht.</p>`; }
  function renderFehler() {
    const h = $('#fehlerView');
    if (!fsQuiz) {
      h.innerHTML = '<div id="fsHead"></div><div id="fsQ"></div>';
      fsQuiz = makeQuiz($('#fsQ', h), {
        id: 'fs', tips: true, skip: false, exam: null,
        onCheck: q => { FSS.n++; if (q.ok) { FSS.ok++; FSS.streak++; FSS.best = Math.max(FSS.best, FSS.streak); } else FSS.streak = 0; lsS('fs', FSS); fsHead(); },
        afterHtml: () => '<div class="btns"><button class="btn pri" data-a="next">Nächste Karte</button></div>',
        onAction: a => { if (a === 'next') nextFs(); }
      });
      nextFs();
    }
    fsHead();
  }

  /* ============================================================ Hilfe */
  function renderHelp() {
    const tr = (a, b, c) => `<tr><td>${a}</td><td><code>${b}</code></td><td>${c}</td></tr>`;
    $('#helpView').innerHTML = `
<details open><summary>Formeln auf einen Blick</summary><div class="hb2"><table><tr><th>Größe</th><th>Formel</th><th>Einheit</th></tr>
${tr('Schnittgeschwindigkeit', 'vc = π · d · n / 1000', 'm/min')}${tr('Drehzahl', 'n = vc · 1000 / (π · d)', 'min⁻¹')}${tr('Durchmesser', 'd = vc · 1000 / (π · n)', 'mm')}
${tr('Vorschubgeschwindigkeit (Drehen, Bohren)', 'vf = f · n', 'mm/min')}${tr('Vorschubgeschwindigkeit (Fräsen)', 'vf = fz · z · n', 'mm/min')}
${tr('Hauptzeit', 'th = L · i / vf', 'min')}${tr('Gesamtweg', 'L = l + la + lü', 'mm')}${tr('Spanquerschnitt', 'A = ap · f', 'mm²')}
${tr('Schnittkraft (vereinfacht)', 'Fc = A · kc', 'N')}${tr('Schnittleistung', 'Pc = Fc · vc / 60 000', 'kW')}${tr('Anschnitt Bohrer', 'la = (d/2) / tan(σ/2) ≈ 0,3 · d (118°)', 'mm')}</table>
<div class="tryit"><button class="btn s" data-go="dreh">Im Drehen-Tab ausprobieren</button><button class="btn s" data-go="fraes">Fräsen</button><button class="btn s" data-go="bohr">Bohren</button></div></div></details>
<details><summary>Einheiten: m/min, mm/min und min⁻¹</summary><div class="hb2"><p><b>vc</b> ist der Weg der Schneide am Umfang in <b>Metern je Minute</b>. <b>vf</b> ist der Vorschubweg in <b>Millimetern je Minute</b>. <b>n</b> ist die Zahl der Umdrehungen je Minute (<b>min⁻¹</b>, früher U/min).</p>
<p>Die Zahl <code>1000</code> in der vc-Formel rechnet Millimeter (d · π ist ein Umfang in mm) in Meter um. Vergisst du sie, ist vc 1000-mal zu groß.</p><p>Typische Fallen: n in U/s statt min⁻¹ einsetzen (mal 60 nehmen), d in Metern statt Millimetern, vf in mm/min mit m/min verwechseln.</p>
<table><tr><th>Umrechnung</th><th>Rechnung</th></tr><tr><td>m/min in mm/min</td><td><code>mal 1000</code></td></tr><tr><td>U/s in min⁻¹</td><td><code>mal 60</code></td></tr><tr><td>min in s</td><td><code>mal 60</code></td></tr></table></div></details>
<details><summary>Umstellen nach n und d</summary><div class="hb2"><p>Aus <code>vc = π · d · n / 1000</code> wird:</p><p><b>Drehzahl:</b> <code>n = vc · 1000 / (π · d)</code><br><b>Durchmesser:</b> <code>d = vc · 1000 / (π · n)</code></p>
<p>Beispiel: vc = 25 m/min, d = 30 mm. n = 25 · 1000 / (π · 30) = 265 min⁻¹. An der Maschine wählst du die nächstliegende Stufe, bei empfindlichen Werkzeugen lieber die niedrigere.</p><p class="hint2">Je kleiner der Durchmesser, desto höher die Drehzahl: ein 5-mm-Bohrer läuft viel schneller als ein 20-mm-Bohrer.</p></div></details>
<details><summary>Drehen: Hauptzeit</summary><div class="hb2"><p><code>th = L · i / (f · n)</code> mit <code>L = l + la + lü</code>. Der Meißel fährt vor dem Werkstück an (Anlauf la) und läuft hinter dem Werkstück aus (Überlauf lü), das zählt zur Zeit dazu. Bei mehreren Schnitten (i) multipliziert sich die Zeit.</p><p>Anzahl der Schnitte: <code>i = (d1 − d2) / (2 · ap)</code>, aufgerundet. ap wirkt am Radius.</p></div></details>
<details><summary>Fräsen und Bohren</summary><div class="hb2"><p><b>Fräsen:</b> n kommt vom Fräserdurchmesser. Jede der z Schneiden nimmt pro Umdrehung einen Span der Dicke fz ab: <code>vf = fz · z · n</code>.</p><p><b>Bohren:</b> n aus vc und Bohrerdurchmesser. Die Spitze (118° bei Stahl) braucht einen Anschnittweg von etwa 0,3 · d. Bei der Durchgangsbohrung kommt der Überlauf dazu: <code>th = (t + 0,3 · d + lü) / (f · n)</code>.</p></div></details>
<details><summary>Richtwerte richtig benutzen</summary><div class="hb2"><p>Die Tafel nennt <b>Richtwerte</b>. Sie hängen von Werkstoff, Schneidstoff, Kühlung, Maschine und Aufspannung ab. <b>Werkzeughersteller beachten.</b> Schruppen: eher untere Fensterhälfte. Schlichten: eher obere.</p><p>vc zu hoch: Schneide wird heiß, Verschleiß, Anlauffarben. vc zu niedrig: Aufbauschneide, schlechte Oberfläche. Vorschub zu groß: raue Fläche, Werkzeugbruch. Ohne Kühlung bei Stahl und HSS: Überhitzung.</p>
<div class="tryit"><button class="btn s" data-go="tafel">Zur Richtwert-Tafel</button><button class="btn s" data-go="fehler">Fehlersuche üben</button></div></div></details>
<details><summary>Rechenbeispiel Schritt für Schritt</summary><div class="hb2"><p>Welle S235, d = 40 mm, l = 100 mm, HSS, vc = 30 m/min, f = 0,2 mm/U, Anlauf 3 mm, Überlauf 2 mm.</p><ol><li>n = 30 · 1000 / (π · 40) = 239 min⁻¹, gewählt 250 min⁻¹ (nächste Stufe)</li><li>vf = 0,2 · 250 = 50 mm/min</li><li>L = 100 + 3 + 2 = 105 mm</li><li>th = 105 / 50 = 2,1 min (2 min 06 s)</li></ol></div></details>`;
    $('#helpView').addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) setTab(b.dataset.go); });
  }

  /* ============================================================ Rahmen: Tabs, Leiste, Menü */
  const built = {};
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(t => `<button class="tab" role="tab" data-t="${t[0]}" id="tab-${t[0]}">${t[1]}${t[0] === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    $('#tabs').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) setTab(b.dataset.t); });
  }
  function setTab(t, keepTask) {
    if (!TABS.some(x => x[0] === t)) return;
    S.tab = t; lsS('tab', t); $('#mid').dataset.tab = t;
    if (t === 'tasks' && !keepTask) { /* Liste oder offene Aufgabe wie zuletzt */ }
    if (!built[t]) { built[t] = true; ({ dreh: buildDreh, fraes: buildFraes, bohr: buildBohr, tafel: () => { renderTafel(); bindTafel(); }, tasks: () => { bindTasks(); renderTasks(); }, train: () => { bindTrain(); renderTrain(); }, fehler: renderFehler, help: renderHelp, bsp: renderBsp })[t](); }
    else if (t === 'tasks') renderTasks(); else if (t === 'dreh' || t === 'fraes' || t === 'bohr') update(t);
    A.t = 0; A.prog = 0; updateChrome();
    const tb = $('#tab-' + t), bar = $('#tabs'); if (tb && bar) bar.scrollLeft = Math.max(0, tb.offsetLeft - (bar.clientWidth - tb.offsetWidth) / 2);
  }
  function buildPal() {
    const sim = S.tab === 'dreh' || S.tab === 'fraes' || S.tab === 'bohr';
    $('#pal').innerHTML = `${sim ? `<button class="chip ${S.run ? 'on' : ''}" data-p="run" aria-pressed="${S.run}">${S.run ? '⏸ Pause' : '▶ Start'}</button><button class="chip" data-p="rewind" aria-label="Von vorn">⏮ Von vorn</button><span class="sep"></span>` : ''}<button class="chip ${S.exam ? 'on' : ''}" data-p="exam" aria-pressed="${S.exam}">🎯 Prüfmodus ${S.exam ? 'an' : 'aus'}</button><button class="chip" data-p="tasks">📝 Aufgaben</button><span id="stat"><b>${nDone()}</b> / ${taskIds().length} gelöst</span>`;
  }
  function updateTaskBar() {
    const el = $('#taskBar'), t = S.task && S.tab === 'tasks' ? (root.ZER_TASKS || []).find(x => x.id === S.task) : null;
    if (!t) { el.className = ''; el.innerHTML = ''; return; }
    el.className = 'on'; el.innerHTML = `<span>📝</span><b>${esc(t.title)}</b><button class="chip s" data-ta="list">Liste</button>`;
  }
  function updateChrome() {
    $$('.tab', $('#tabs')).forEach(b => { const on = b.dataset.t === S.tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    const bd = $('#tkBd'); if (bd) bd.textContent = nDone() + '/' + taskIds().length;
    $('#title').innerHTML = 'Zerspan-Lab<small>' + esc((TABS.find(x => x[0] === S.tab) || [0, ''])[1]) + '</small>';
    buildPal(); updateTaskBar();
  }
  function openMenu() {
    const rows = [['tasks', 'Aufgaben', nDone() + ' von ' + taskIds().length + ' gelöst'], ['exam', 'Prüfmodus: ' + (S.exam ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps Punkte (10, 25, 50 %)'], ['tafel', 'Richtwert-Tafel', 'vc je Werkstoff und Schneidstoff'], ['help', 'Hilfe und Spickzettel', 'Formeln, Einheiten, Umstellen'], ['reset', 'Fortschritt zurücksetzen', 'Gelöste Aufgaben und Zähler löschen'], ['start', 'Startseite', '']];
    sheet('Menü', (b, close) => {
      b.innerHTML = rows.map(r => `<button class="row" data-m="${r[0]}"><div class="grow"><b>${esc(r[1])}</b>${r[2] ? `<small>${esc(r[2])}</small>` : ''}</div></button>`).join('');
      b.addEventListener('click', e => {
        const r = e.target.closest('.row'); if (!r) return; const m = r.dataset.m; close();
        if (m === 'tasks' || m === 'tafel' || m === 'help') setTab(m); else if (m === 'exam') toggleExam(); else if (m === 'start') location.href = 'index.html'; else if (m === 'reset') resetAll();
      });
    });
  }
  function toggleExam() { S.exam = !S.exam; lsS('exam', S.exam); updateChrome(); if (taskQuiz && S.task) taskQuiz.render(); if (S.tab === 'tasks' && !S.task) renderTasks(); toast(S.exam ? 'Prüfmodus an: Tipps kosten Punkte' : 'Prüfmodus aus: Tipps sind kostenlos'); }
  function resetAll() {
    sheet('Fortschritt zurücksetzen?', (b, close) => {
      b.innerHTML = '<p style="margin-top:0">Alle gelösten Aufgaben, Wertungen, Tipps und Trainer-Zähler dieses Labs werden auf diesem Gerät gelöscht. Das kann nicht rückgängig gemacht werden.</p><div class="btns"><button class="btn" data-c>Abbrechen</button><button class="btn danger" data-ok>Löschen</button></div>';
      $('[data-c]', b).onclick = close;
      $('[data-ok]', b).onclick = () => {
        ['done', 'pct', 'hints', 'tried', 'seeds', 'ctipps', 'trainer', 'fs'].forEach(k => { try { localStorage.removeItem(P + k); } catch (e) {} });
        S.done = {}; S.pct = {}; S.hints = {}; S.tried = {}; S.seeds = {}; Object.assign(TRS, { n: 0, ok: 0, streak: 0, best: 0 }); Object.assign(FSS, { n: 0, ok: 0, streak: 0, best: 0 });
        S.task = null; close(); if (built.tasks) renderTasks(); if (trainQuiz) trHead(); if (fsQuiz) fsHead(); updateChrome(); toast('Fortschritt gelöscht');
      };
    });
  }
  function bindFrame() {
    $('#bMenu').onclick = openMenu; $('#bTasks').onclick = () => { if (S.tab === 'tasks' && S.task) { S.task = null; renderTasks(); updateChrome(); } else setTab('tasks'); };
    $('#bHelp').onclick = () => setTab('help'); $('#title').onclick = () => { location.href = 'index.html'; };
    $('#pal').addEventListener('click', e => {
      const b = e.target.closest('[data-p]'); if (!b) return; const a = b.dataset.p;
      if (a === 'run') { S.run = !S.run; updateChrome(); } else if (a === 'rewind') { A.t = 0; A.prog = 0; if (EL[S.tab]) draw(S.tab); }
      else if (a === 'exam') toggleExam(); else if (a === 'tasks') { if (S.tab === 'tasks' && S.task) { S.task = null; renderTasks(); updateChrome(); } else setTab('tasks'); }
    });
    $('#taskBar').addEventListener('click', e => { if (e.target.closest('[data-ta]')) { S.task = null; renderTasks(); updateChrome(); } });
    root.addEventListener('keydown', e => {
      const t = e.target; if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable) || e.altKey || e.ctrlKey || e.metaKey || document.querySelector('.backdrop')) return;
      if (e.key >= '1' && e.key <= '8') setTab(TABS[+e.key - 1][0]); else if (e.key === ' ' && EL[S.tab] && t === document.body) { e.preventDefault(); S.run = !S.run; updateChrome(); }
    });
  }

  /* ============================================================ Start */
  function init() {
    buildTabs(); bindFrame();
  root.LabGoto = id => { try { if (DEFS[id]) { openTask(id); return true; } } catch (e) {} return false; };
    let go = S.tab, task = null;
    try { const q = new URLSearchParams(location.search), a = q.get('aufgabe'), tb = q.get('tab'); if (a && DEFS[a]) { task = a; } else if (tb && TABS.some(x => x[0] === tb)) go = tb; if (q.has('bsp') && !(a && DEFS[a])) go = 'bsp'; } catch (e) {}
    if (task) { go = 'tasks'; S.task = task; }
    setTab(go);
    if (task) openTask(task);
    A.raf = requestAnimationFrame(loop);
    try { if (!localStorage.getItem(P + 'welcome')) { localStorage.setItem(P + 'welcome', '1'); setTimeout(() => toast('Willkommen im Zerspan-Lab! Stelle n, f und ap ein und schau, wie vc und die Hauptzeit reagieren.'), 900); } } catch (e) {}
  }
  /* ============================================================ Beispiele (Reiter "Beispiele", Aufruf ?bsp) */
  const BSP = root.ZER_BEISPIELE || [], BSP_INTRO = 'Fertige Parameter-Voreinstellungen. „Laden“ übernimmt die Werte in Drehen, Fräsen oder Bohren. Die Richtwerte gelten nur als Anhalt, Werkzeughersteller beachten.', BSP_BTN = 'Laden';
  function renderBsp() {
    const V = $('#bspView'); if (!V) return;
    V.innerHTML = '<div class="card pl"><h4>Beispiele</h4><p class="hint2" style="margin:0">' + BSP_INTRO + '</p></div>' +
      BSP.map((b, i) => '<div class="card pl"><h4>' + esc(b.titel) + '</h4><p style="margin:0 0 4px;line-height:1.45">' + esc(b.text) + '</p>' + '<p class="hint2" style="margin:0 0 4px">Lädt in: ' + ({ dreh: 'Drehen', fraes: 'Fräsen', bohr: 'Bohren' }[b.sim]) + '</p>' + '<div class="btns"><button class="btn pri" data-bsp="' + i + '" style="min-height:44px">' + BSP_BTN + '</button></div></div>').join('');
    V.onclick = e => { const x = e.target.closest('[data-bsp]'); if (x && BSP[+x.dataset.bsp]) loadBsp(BSP[+x.dataset.bsp]); };
  }
  function loadBsp(b) {
    const s = S.sim[b.sim], def = DEF_SIM[b.sim];
    Object.keys(b.set).forEach(k => { if (k in def && typeof b.set[k] === typeof def[k]) s[k] = b.set[k]; });
    saveSim(); setTab(b.sim); syncCtl(b.sim); update(b.sim); toast('Beispiel geladen: ' + b.titel);
  }
  root.ZER_UI = { S, setTab, openTask, model, update, setVal, TF, newPractice, toggleExam, A };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : globalThis);
