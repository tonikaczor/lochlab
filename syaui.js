'use strict';
/* Tonfunk Systemanalyse-Lab: Oberfläche (Lab-Kennung 'sya').
   ALLE Zahlen sind ÜBUNGSWERTE für die Ausbildung. Modellgerät: Temperaturwächter TW-1 vom Modellbetrieb (frei erfunden).
   Reiter: Gerät (Fehler einbauen, an MP1 bis MP8 messen, Ursache tippen), Geräteprüfung (Prüfprotokoll nach Instandsetzung bewerten),
           Bauteile (Rechner für Regler und Kühlkörper, Ladeelko, Relaistreiber, LED), Aufgaben, Trainer, Hilfe.
   Module: syacore.js (SYA_CORE), syadata.js (SYA_DATA, SYA_TASKS), syaviz.js (SYA_VIZ, vor dieser Datei geladen).
   Speicher (Präfix lm4.sya.): tab, g (Gerät), vde, dim, done ({id:true}), prog ({id:Prozent}), hints, ctipps (nur Prüfmodus), exam ('1'), rt (Trainer).
   Tipp-Abzug (25 % je Stufe, höchstens 2 Stufen) gibt es nur im Prüfmodus.
   Aufruf: syalab.html?aufgabe=sya1 öffnet die Aufgabe. */
(function (root) {
  const C = root.SYA_CORE, D = root.SYA_DATA, V = root.SYA_VIZ;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.sya.';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(LS + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} };
  const f = (v, d) => C.fmtN(v, d == null ? 2 : d, true), P = s => C.parseDe(s);
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
  if (!C || !D || !V) {
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>Systemanalyse-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">syacore.js, syadata.js oder syaviz.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks;

  /* ============================================================ Zustand */
  const TABS = [['geraet', '🔌', 'Gerät'], ['vde', '🛡️', 'Geräteprüfung'], ['dim', '🧮', 'Bauteile'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['help', '📘', 'Hilfe']];
  const TEMPS = [25, 40, 55, 60, 70, 85], MODES = [['dc', 'V='], ['ac', 'V~'], ['osz', 'Oszi']];
  const DIM0 = { reg: { uin: '11', i: '0,2', tj: '125', tu: '40', rjg: '5', rgk: '1' }, gl: { i: '230', du: '1', br: '1' }, drv: { u: '12', r: '400', b: '100', ue: '3', ust: '5' }, led: { u: '5', uf: '2', i: '15' } };
  const S = {
    tab: lsGet('tab', 'geraet'),
    g: Object.assign({ fault: 'ok', hidden: true, T: 25, mode: 'dc', sel: '', log: {}, guess: '', solved: false }, lsGet('g', {})),
    vde: Object.assign({ seed: 'p1', sel: {}, all: '', done: false, m: 'rpe' }, lsGet('vde', {})),
    dim: lsGet('dim', null) || JSON.parse(JSON.stringify(DIM0)),
    task: null, tq: null, tAns: {}, tRes: null, tFehl: {},
    tr: { q: null, ans: {}, res: null, level: 0 },
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {}))
  };
  /* Gespeicherte Zustände prüfen */
  if (!C.FAULTS.some(x => x.k === S.g.fault)) S.g.fault = 'ok';
  if (!TEMPS.includes(S.g.T)) S.g.T = 25;
  if (!MODES.some(m => m[0] === S.g.mode)) S.g.mode = 'dc';
  if (!C.MPS.some(m => m.k === S.g.sel)) S.g.sel = '';
  if (!S.g.log || typeof S.g.log !== 'object') S.g.log = {};
  if (!S.vde.sel || typeof S.vde.sel !== 'object') S.vde.sel = {};
  if (!['rpe', 'riso', 'ileak'].includes(S.vde.m)) S.vde.m = 'rpe';
  Object.keys(DIM0).forEach(k => { if (!S.dim[k] || typeof S.dim[k] !== 'object') S.dim[k] = Object.assign({}, DIM0[k]); Object.keys(DIM0[k]).forEach(x => { if (typeof S.dim[k][x] !== 'string') S.dim[k][x] = DIM0[k][x]; }); });
  const R0 = (() => { const m = /[?&]seed=([^&]+)/.exec(location.search); return C.rng(m ? decodeURIComponent(m[1]) : String(Math.random()) + Date.now()); })();
  const newSeed = () => 's' + Math.floor(R0() * 1e9).toString(36);

  /* ============================================================ Bausteine */
  const box = (t, fm, res, cls) => `<div class="rdout ${cls || ''}"><span class="st">${esc(t)}</span>${fm ? esc(fm) + ' = ' : ''}<b>${esc(res)}</b></div>`;
  const note = (t, cls) => `<div class="rdout ${cls || 'warn'}">${esc(t)}</div>`;
  const inp = (k, label, val, unit) => `<label class="f"><span>${esc(label)}${unit ? ' (' + esc(unit) + ')' : ''}</span><input data-k="${k}" inputmode="decimal" autocomplete="off" value="${esc(val)}"></label>`;
  const UEB = 'Alle Zahlen in diesem Lab (Spannungen, Bauteilwerte, Preise, Stundensätze) sind Übungswerte. Das Modellgerät TW-1 ist frei erfunden. Maßgebend sind immer die Serviceunterlagen, die Normen und die Regeln deines Betriebs.';
  const ueb = () => `<p class="hint2" style="margin:10px 0 0">⚠ ${esc(UEB)}</p>`;
  const seg = (attr, opts, cur) => `<div class="seg">${opts.map(o => `<button ${attr}="${esc(o[0])}" class="${String(cur) === String(o[0]) ? 'on' : ''}">${esc(o[1])}</button>`).join('')}</div>`;
  const lbl = t => `<span style="font-size:14px;color:var(--mute)">${esc(t)}</span>`;
  const stepsBox = st => st && st.length ? `<div class="steps"><b>So gehst du vor</b><ol>${st.map(s => `<li>${esc(s)}</li>`).join('')}</ol></div>` : '';
  const tableHtml = t => t ? `<div class="tw"><table class="tt"><tr>${t.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr>${t.rows.map(r => `<tr>${r.map((c, i) => `<td${i ? ' class="n"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('')}</table></div>` : '';
  const imgHtml = img => { const s = V.taskImg(img); return s ? `<div class="vzbox">${s}</div>` : ''; };

  /* ============================================================ Gerät */
  const curSim = () => C.sim(S.g.fault, S.g.T);
  const sollOf = (k, mode) => { const m = C.measure('ok', S.g.T, k, mode); return m; };
  const mval = (m, mode) => !m ? '-' : m.jump ? 'springt' : mode === 'osz' ? f(m.v, 2) + ' Vss' + (m.f ? ', ' + f(m.f, 0) + ' Hz' : '') : f(m.v, 2) + (mode === 'ac' ? ' V~' : ' V');
  const wideNow = () => root.innerWidth >= 760; let wideWas = wideNow();
  function renderGeraet() {
    const g = S.g;
    $('#geraetView').innerHTML = `<div class="card pl">
      <div class="gbar"><select data-gsel aria-label="Fehler einbauen"><option value="rnd"${g.hidden ? ' selected' : ''}>🎲 Zufallsfehler (verdeckt)</option>${C.FAULTS.map(x => `<option value="${x.k}"${!g.hidden && x.k === g.fault ? ' selected' : ''}>${esc(x.k === 'ok' ? x.n : 'Fehler: ' + x.n)}</option>`).join('')}</select>
      <label class="tsl"><span>🌡 <b id="gtv">${g.T} °C</b></span><input type="range" data-gt min="0" max="${TEMPS.length - 1}" step="1" value="${TEMPS.indexOf(g.T)}" aria-label="Temperatur am Fühler"></label>${seg('data-gm', MODES, g.mode)}</div>
      <div class="vzbox full" id="bsHost"></div><div id="mpInfo"></div>
      <div class="mpb">${C.MPS.map(m => `<button data-mpb="${m.k}" class="${g.sel === m.k ? 'on' : ''}">${m.k}</button>`).join('')}</div>
      <div id="logBox"></div></div>
      <div class="card pl"><h4>Deine Diagnose am Modellgerät TW-1</h4>${stepsBox(['Gerätefront ansehen (Anzeige, LED, Relais, Lüfter).', 'Von MP1 aus in Richtung Relais messen oder mit der Halbierungsmethode in der Mitte anfangen (MP3 oder MP4).', 'Den letzten guten und den ersten schlechten Messpunkt suchen: Der Fehler sitzt im Block dazwischen.', 'Ursache wählen und prüfen.'])}
      <label class="f"><span>Vermutete Ursache</span><select data-gg><option value="">Ursache wählen</option>${C.FAULTS.map(x => `<option value="${x.k}"${x.k === g.guess ? ' selected' : ''}>${esc(x.n)}</option>`).join('')}</select></label>
      <div class="btns"><button class="btn pri" data-ga="chk">✓ Ursache prüfen</button><button class="btn" data-ga="new">Neuer Fehler</button></div><div id="gRes"></div></div>`;
    updateGeraet();
    if (g.solved) gResult();
  }
  function updateGeraet() {
    const g = S.g, s = curSim(), m = g.sel ? C.measure(g.fault, g.T, g.sel, g.mode) : null;
    wideWas = wideNow();
    $('#bsHost').innerHTML = V.benchSvg({ sim: s, sel: g.sel, def: g.solved ? C.faultOf(g.fault).blk : '', m, mode: g.mode, wide: wideWas });
    const mp = C.MPS.find(x => x.k === g.sel);
    $('#mpInfo').innerHTML = mp ? `<p class="hint2" style="margin:6px 0"><b>${esc(mp.k)}</b>: ${esc(mp.n)}. Soll: ${esc(mval(sollOf(mp.k, g.mode), g.mode))}${m && m.jump ? '. Der Wert springt im Abstand von Minuten.' : ''}</p>` + (mp.netz ? note('⚡ Netzseite: Messen nur mit Messgerät und Messleitungen für Netzspannung (passende Messkategorie), berührungsgeschützten Prüfspitzen und nur als Elektrofachkraft oder unter deren Aufsicht.', 'bad') : '') : '<p class="hint2" style="margin:6px 0">Tippe auf einen Messpunkt im Bild: Die Messleitungen springen dorthin, das Messgerät zeigt den Wert. Vergleiche mit dem Sollwert.</p>';
    $$('[data-mpb]', $('#geraetView')).forEach(b => b.classList.toggle('on', b.dataset.mpb === g.sel));
    const keys = Object.keys(g.log);
    $('#logBox').innerHTML = keys.length ? `<h5 style="margin:10px 0 4px">Dein Messprotokoll</h5><div class="tw"><table class="tt"><tr><th>Messpunkt</th><th>Messart</th><th class="n">Soll</th><th class="n">Ist</th></tr>${keys.sort().map(k => { const [mk, md] = k.split('|'), e = g.log[k]; return `<tr><td>${esc(mk)}</td><td>${esc(MODES.find(x => x[0] === md)[1])}</td><td class="n">${esc(e.soll)}</td><td class="n">${esc(e.ist)}</td></tr>`; }).join('')}</table></div><div class="btns"><button class="btn" data-ga="clr">Protokoll leeren</button></div>` : '';
  }
  function measureAt(k) {
    const g = S.g; g.sel = k; const m = C.measure(g.fault, g.T, k, g.mode);
    g.log[k + '|' + g.mode] = { soll: mval(sollOf(k, g.mode), g.mode) + ' (' + g.T + ' °C)', ist: mval(m, g.mode) };
    lsSet('g', g); updateGeraet();
  }
  function gResult() {
    const g = S.g, fl = C.faultOf(g.fault), ok = g.guess === g.fault;
    $('#gRes').innerHTML = `<div class="lr-fb ${ok ? 'ok' : 'loes'} fb"><p><strong>${ok ? '✓ Richtig erkannt:' : '✗ Leider nicht. Eingebaut war:'}</strong> ${esc(fl.n)}</p><p>${esc(fl.ursache)}</p></div>`;
  }
  const gv = $('#geraetView');
  gv.addEventListener('click', e => {
    const g = S.g, mpEl = e.target.closest('[data-mp]'), mb = e.target.closest('[data-mpb]'), gm = e.target.closest('[data-gm]'), ga = e.target.closest('[data-ga]');
    if (mpEl || mb) { measureAt((mpEl || mb).dataset.mp || mb.dataset.mpb); return; }
    if (gm) { g.mode = gm.dataset.gm; lsSet('g', g); $$('[data-gm]', gv).forEach(b => b.classList.toggle('on', b.dataset.gm === g.mode)); if (g.sel) measureAt(g.sel); else updateGeraet(); return; }
    if (ga) {
      const a = ga.dataset.ga;
      if (a === 'clr') { g.log = {}; lsSet('g', g); updateGeraet(); }
      else if (a === 'new') { g.fault = g.hidden ? C.pick(R0, C.FAULTS).k : g.fault; g.log = {}; g.sel = ''; g.solved = false; g.guess = ''; lsSet('g', g); renderGeraet(); toast(g.hidden ? 'Neuer verdeckter Fehler eingebaut.' : 'Messungen zurückgesetzt.'); }
      else if (a === 'chk') { if (!g.guess) { toast('Wähle zuerst eine Ursache.'); return; } g.solved = true; lsSet('g', g); updateGeraet(); gResult(); if (g.guess === g.fault) ding(); else sad(); }
    }
  });
  gv.addEventListener('keydown', e => { const mpEl = e.target.closest && e.target.closest('[data-mp]'); if (mpEl && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); measureAt(mpEl.dataset.mp); } });
  gv.addEventListener('input', e => { if (!e.target.matches('[data-gt]')) return; S.g.T = TEMPS[+e.target.value] || 25; lsSet('g', S.g); $('#gtv').textContent = S.g.T + ' °C'; updateGeraet(); });
  root.addEventListener('resize', () => { if (S.tab === 'geraet' && wideNow() !== wideWas) updateGeraet(); });
  gv.addEventListener('change', e => {
    const g = S.g;
    if (e.target.matches('[data-gsel]')) { g.hidden = e.target.value === 'rnd'; g.fault = g.hidden ? C.pick(R0, C.FAULTS).k : e.target.value; if (g.hidden) toast('Ein Fehler ist verdeckt eingebaut (vielleicht auch keiner).'); g.log = {}; g.solved = false; g.guess = ''; lsSet('g', g); renderGeraet(); }
    else if (e.target.matches('[data-gg]')) { g.guess = e.target.value; lsSet('g', g); }
  });

  /* ============================================================ Geräteprüfung */
  const PMODE = [['rpe', 'Schutzleiter'], ['riso', 'Isolation'], ['ileak', 'Ableitstrom']];
  const wertTxt = r => typeof r.wert === 'number' ? f(r.wert, 2) + ' ' + r.unit : r.wert;
  function renderVde() {
    const v = S.vde, p = C.makePruef(v.seed);
    if (p.sk === 2 && v.m === 'rpe') v.m = 'riso';
    $('#vdeView').innerHTML = `<div class="card pl"><h4>Prüfung nach Instandsetzung</h4>
      <p class="hint2" style="margin:0 0 6px">Der TW-1 kommt aus der Reparatur. Schutzklasse ${p.sk === 1 ? 'I (Metallgehäuse mit Schutzleiter)' : 'II (Kunststoffgehäuse, ohne Schutzleiter)'}${p.sk === 1 ? ', Netzleitung ' + f(p.L, 1) + ' m' : ''}. Bewerte jede Zeile und dann das ganze Gerät. Die Grenzwerte bestimmst du selbst (siehe Hilfe).</p>
      ${stepsBox(['Schutzklasse und Leitungslänge ablesen.', 'Für jede Messung den Grenzwert bestimmen.', 'Jede Zeile mit „in Ordnung“ oder „nicht in Ordnung“ bewerten.', 'Gesamturteil: Nur wenn alles in Ordnung ist, hat das Gerät bestanden.'])}
      <div class="fbar">${lbl('PRÜFAUFBAU')}${seg('data-pm', PMODE.filter(x => p.sk === 1 || x[0] !== 'rpe').map(x => x[0] === 'ileak' ? ['ileak', p.sk === 1 ? 'Schutzleiterstrom' : 'Berührungsstrom'] : x), v.m)}</div><div class="vzbox" id="prHost">${V.pruefSvg(v.m, p.sk)}</div>
      <div class="tw chk"><table class="tt"><tr><th>Prüfschritt</th><th>Messwert bzw. Befund</th><th>Urteil</th></tr>${p.rows.map(r => `<tr><td>${esc(r.n)}</td><td>${esc(wertTxt(r))}${v.done ? '<br><small class="hint2">Grenzwert: ' + esc(r.grenz) + '</small>' : ''}</td><td><select data-pr="${r.k}"><option value="">wählen</option><option value="ok"${v.sel[r.k] === 'ok' ? ' selected' : ''}>in Ordnung</option><option value="bad"${v.sel[r.k] === 'bad' ? ' selected' : ''}>nicht in Ordnung</option></select>${v.done ? ((v.sel[r.k] === 'ok') === r.ok ? ' ✓' : ' ✗') : ''}</td></tr>`).join('')}</table></div>
      <div class="fbar">${lbl('GESAMTURTEIL')}${seg('data-pa', [['ok', 'bestanden'], ['bad', 'nicht bestanden']], v.all)}</div>
      <div class="btns"><button class="btn pri" data-pv="chk">✓ Auswerten</button><button class="btn" data-pv="new">Neues Gerät</button></div><div id="vdeRes"></div></div>
      <details class="dt"><summary>Ablauf der Prüfung</summary><div class="hb2"><ol>${C.PRUEF_SCHRITTE.map(s => `<li>${esc(s)}</li>`).join('')}</ol><p class="hint2">Prüfen darf eine Elektrofachkraft, oder eine elektrotechnisch unterwiesene Person mit geeignetem Prüfgerät unter Leitung und Aufsicht einer Elektrofachkraft.</p></div></details>`;
    if (v.done) vdeResult(p);
  }
  function vdeResult(p) {
    const v = S.vde, nOk = p.rows.filter(r => (v.sel[r.k] === 'ok') === r.ok).length, allOk = (v.all === 'ok') === p.ok;
    $('#vdeRes').innerHTML = `<div class="lr-fb ${nOk === p.rows.length && allOk ? 'ok' : 'loes'} fb"><p><strong>${nOk} von ${p.rows.length} Zeilen richtig bewertet.</strong> Gesamturteil ${allOk ? 'richtig' : 'falsch'}: Das Gerät hat ${p.ok ? 'bestanden' : 'nicht bestanden'}.</p><p>${esc(p.rows.filter(r => !r.ok).map(r => r.n + ': ' + wertTxt(r) + ', Grenzwert ' + r.grenz).join('. ') || 'Alle Werte liegen innerhalb der Grenzwerte.')}${p.ok ? '' : ' Ein nicht bestandenes Gerät wird gekennzeichnet und nicht übergeben.'}</p></div>`;
  }
  const vv = $('#vdeView');
  vv.addEventListener('change', e => { const k = e.target.dataset.pr; if (!k) return; S.vde.sel[k] = e.target.value; lsSet('vde', S.vde); });
  vv.addEventListener('click', e => {
    const v = S.vde, pm = e.target.closest('[data-pm]'), pa = e.target.closest('[data-pa]'), pb = e.target.closest('[data-pv]');
    if (pm) { v.m = pm.dataset.pm; lsSet('vde', v); $('#prHost').innerHTML = V.pruefSvg(v.m, C.makePruef(v.seed).sk); $$('[data-pm]', vv).forEach(b => b.classList.toggle('on', b.dataset.pm === v.m)); return; }
    if (pa) { v.all = pa.dataset.pa; lsSet('vde', v); $$('[data-pa]', vv).forEach(b => b.classList.toggle('on', b.dataset.pa === v.all)); return; }
    if (!pb) return;
    if (pb.dataset.pv === 'new') { S.vde = { seed: newSeed(), sel: {}, all: '', done: false, m: 'rpe' }; lsSet('vde', S.vde); renderVde(); return; }
    const p = C.makePruef(v.seed);
    if (!p.rows.every(r => v.sel[r.k]) || !v.all) { toast('Bewerte zuerst jede Zeile und das ganze Gerät.'); return; }
    v.done = true; lsSet('vde', v); renderVde(); const good = p.rows.every(r => (v.sel[r.k] === 'ok') === r.ok) && (v.all === 'ok') === p.ok; if (good) ding(); else sad();
  });

  /* ============================================================ Bauteile (Rechner) */
  function renderDim() {
    const d = S.dim;
    $('#dimView').innerHTML = `<div class="card pl"><h4>Regler und Kühlkörper</h4><div class="dsrow">${inp('reg.uin', 'Eingangsspannung UE', d.reg.uin, 'V')}${inp('reg.i', 'Laststrom I', d.reg.i, 'A')}${inp('reg.tj', 'Sperrschicht höchstens ϑj', d.reg.tj, '°C')}${inp('reg.tu', 'Umgebung ϑu', d.reg.tu, '°C')}${inp('reg.rjg', 'Rth,JG', d.reg.rjg, 'K/W')}${inp('reg.rgk', 'Rth,GK', d.reg.rgk, 'K/W')}</div><div id="oReg"></div></div>
      <div class="card pl"><h4>Ladeelko (Glättung)</h4><div class="dsrow">${inp('gl.i', 'Laststrom I', d.gl.i, 'mA')}${inp('gl.du', 'Brummspannung ΔU höchstens', d.gl.du, 'Vss')}</div><div class="fbar">${lbl('GLEICHRICHTER')}${seg('data-br', [['1', 'Brücke (100 Hz)'], ['0', 'Einweg (50 Hz)']], d.gl.br)}</div><div id="oGl"></div></div>
      <div class="card pl"><h4>Relaistreiber</h4><div class="dsrow">${inp('drv.u', 'Spulenspannung', d.drv.u, 'V')}${inp('drv.r', 'Spulenwiderstand', d.drv.r, 'Ω')}${inp('drv.b', 'Stromverstärkung B', d.drv.b, '')}${inp('drv.ue', 'Übersteuerung ü', d.drv.ue, '')}${inp('drv.ust', 'Steuerspannung µC', d.drv.ust, 'V')}</div><div id="oDrv"></div></div>
      <div class="card pl"><h4>LED-Vorwiderstand</h4><div class="dsrow">${inp('led.u', 'Betriebsspannung U', d.led.u, 'V')}${inp('led.uf', 'Durchlassspannung UF', d.led.uf, 'V')}${inp('led.i', 'LED-Strom I', d.led.i, 'mA')}</div><div id="oLed"></div></div>`;
    updateDim();
  }
  function updateDim() {
    const d = S.dim, n = o => { const r = {}; Object.keys(o).forEach(k => { r[k] = P(o[k]); }); return r; };
    const a = n(d.reg), Pv = C.regLoss(a.uin, 5, a.i), rk = C.rthK(a.tj, a.tu, Pv, a.rjg, a.rgk);
    let h = Number.isFinite(Pv) ? box('Verlustleistung', '(' + f(a.uin) + ' V − 5 V) · ' + f(a.i) + ' A', f(Pv, 2) + ' W') : note('UE muss mindestens 5 V sein, Strom als Zahl.');
    if (Number.isFinite(rk)) h += box('Kühlkörper höchstens', '(ϑj − ϑu) / P − Rth,JG − Rth,GK', f(rk, 2) + ' K/W', rk > 0 ? 'ok' : 'bad') + (rk <= 0 ? note('Kein Kühlkörper reicht: Verlustleistung senken (kleinere Eingangsspannung, weniger Strom).', 'bad') : '');
    h += `<div class="vzbox">${V.thermSvg({ P: Pv, tj: a.tj, tu: a.tu, rjg: a.rjg, rgk: a.rgk, rk })}</div>`;
    $('#oReg').innerHTML = h;
    const b = n(d.gl), fr = d.gl.br === '1' ? 100 : 50, cap = C.capFor(b.i / 1000, fr, b.du) * 1e6;
    $('#oGl').innerHTML = (Number.isFinite(cap) ? box('Kapazität mindestens', f(b.i) + ' mA / (' + fr + ' Hz · ' + f(b.du) + ' V)', f(cap, 0) + ' µF') + box('Normwert E6 (aufrunden)', '', f(C.eUp(cap, C.E6), 0) + ' µF', 'ok') : note('Strom und Brummspannung als Zahlen größer 0 eingeben.')) + `<div class="vzbox">${V.rippleSvg({ up: 11, pp: Math.min(5, Number.isFinite(b.du) ? b.du : 1), f: fr })}</div>`;
    const c = n(d.drv), Ic = C.coilI(c.u, c.r), Ib = C.baseI(Ic, c.b, c.ue), Rb = C.rBase(c.ust, 0.7, Ib);
    $('#oDrv').innerHTML = (Number.isFinite(Rb) ? box('Kollektorstrom IC', f(c.u) + ' V / ' + f(c.r, 0) + ' Ω', f(Ic * 1000, 1) + ' mA') + box('Basisstrom IB', 'IC / B · ü', f(Ib * 1000, 3) + ' mA') + box('Basiswiderstand RB', '(' + f(c.ust) + ' V − 0,7 V) / IB', f(Rb / 1000, 2) + ' kΩ') + box('Normwert E12 (abrunden)', '', f(C.eDown(Rb) / 1000, 2) + ' kΩ', 'ok') : note('Alle Werte als Zahlen größer 0 eingeben, Steuerspannung größer 0,7 V.')) + `<div class="vzbox">${V.drvSvg({ on: true })}</div>`;
    const e = n(d.led), Rl = C.rLed(e.u, e.uf, e.i / 1000);
    $('#oLed').innerHTML = (Number.isFinite(Rl) ? box('Vorwiderstand', '(' + f(e.u) + ' V − ' + f(e.uf) + ' V) / ' + f(e.i) + ' mA', f(Rl, 1) + ' Ω') + box('Normwert E12 (aufrunden)', '', f(C.eUp(Rl), 1) + ' Ω', 'ok') + box('Leistung am Widerstand', 'I² · R', f(C.pRes(e.i / 1000, C.eUp(Rl)) * 1000, 1) + ' mW') : note('U muss größer als UF sein, Strom größer 0.')) + `<div class="vzbox">${V.ledSvg({})}</div>`;
  }
  const dv = $('#dimView');
  dv.addEventListener('input', e => { const k = e.target.dataset.k; if (!k) return; const [a, b] = k.split('.'); S.dim[a][b] = e.target.value; lsSet('dim', S.dim); updateDim(); });
  dv.addEventListener('click', e => { const b = e.target.closest('[data-br]'); if (!b) return; S.dim.gl.br = b.dataset.br; lsSet('dim', S.dim); $$('[data-br]', dv).forEach(x => x.classList.toggle('on', x.dataset.br === S.dim.gl.br)); updateDim(); });

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
  const eingabeHinweis = q => q.ask.type === 'num' ? `<p class="lr-hinweis hint2">Zahl in ${esc(q.ask.unit)}.${q.tol > 0.011 ? ' ±' + esc(f(q.tol, 2)) + ' ' + esc(q.ask.unit) + ' gelten als richtig (wegen Rundung).' : ''}</p>` : '';
  const stufeFuer = (ok, fehl, ex) => ok ? 'ok' : ex ? 'pruef' : fehl >= 2 ? 'loes' : 'tipp';
  const zeigFb = el => { try { const x = el && el.querySelector('.lr-fb'); if (x && root.LabRahmen) root.LabRahmen.zeig(x); } catch (e) {} };
  function qBody(q, a, r) {
    const lock = r && (r.ok || r.stufe === 'loes');
    if (q.ask.type === 'choice') return `<div class="opts">${q.ask.choices.map((c, i) => `<button data-tc="${i}" ${lock ? 'disabled' : ''} class="${lock && i === q.ask.correct ? 'ok' : a.c === i ? (r && !r.ok && r.given === c ? 'bad' : 'on') : ''}">${esc(c)}</button>`).join('')}</div>`;
    return `<label class="f"><span>${esc(q.ask.label)} (${esc(q.ask.unit)})</span><div class="qin"><input data-in="1" inputmode="decimal" autocomplete="off" value="${esc(a.v || '')}" ${lock ? 'disabled' : ''}><span class="u">${esc(q.ask.unit)}</span></div>${eingabeHinweis(q)}</label>`;
  }
  const qHead = q => `<p style="margin:8px 0">${esc(q.text)}</p>${imgHtml(q.img)}${tableHtml(q.table)}${stepsBox(q.steps)}`;
  function evalQ(q, a) {
    if (q.ask.type === 'choice') { if (a.c == null) { toast('Wähle zuerst eine Antwort.'); return null; } return { ok: a.c === q.ask.correct, given: q.ask.choices[a.c] }; }
    const v = P(a.v); if (!Number.isFinite(v)) { toast('Bitte gib eine Zahl ein (mit Komma oder Punkt).'); return null; }
    return { ok: Math.abs(v - q.value) <= q.tol + 1e-9, given: f(v, 2) + ' ' + q.ask.unit };
  }
  function fbHTML(q, r) {
    if (r.stufe === 'ok') return `<div class="lr-fb ok fb"><p><strong>✓ Richtig:</strong> ${esc(r.given)}</p><p><strong>Lösungsweg:</strong> ${esc(q.expl)}</p></div>`;
    const ist = '<strong>Noch nicht:</strong> Deine Antwort „' + esc(r.given) + '“ stimmt nicht.';
    if (r.stufe === 'tipp') return `<div class="lr-fb tipp fb"><p>${ist}</p><p><strong>Tipp:</strong> ${esc(q.tips[0])} Du hast einen zweiten Versuch.</p></div>`;
    if (r.stufe === 'loes') return `<div class="lr-fb loes fb"><p>${ist}</p><p><strong>Lösung:</strong> ${esc(solText(q))}</p><p><strong>Lösungsweg:</strong> ${esc(q.expl)}</p></div>`;
    return `<div class="lr-fb tipp fb"><p>${ist}</p><p>🎓 Prüfmodus: Den Lösungsweg gibt es erst, wenn die Aufgabe richtig gelöst ist. Nutze einen Tipp (kostet 25 %) oder versuche es noch einmal.</p></div>`;
  }
  function renderTasks(top) {
    const Vw = $('#taskView'), d = done(), prog = lsGet('prog', {}), t = curTask(), n100 = TASKS.filter(x => d[x.id]).length; let h = '';
    if (t) {
      const q = S.tq, r = S.tRes && S.tRes.id === t.id ? S.tRes : null, a = S.tAns[t.id] || {};
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv">${dots(t.level)} · ${t.lj}. Lehrjahr</div>${qHead(q)}${qBody(q, a, r)}`;
      if (r) h += fbHTML(q, r);
      h += `<div class="btns"><button class="btn pri" data-ta="chk"${r && (r.ok || r.stufe === 'loes') ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" data-ta="hint">💡 Tipp</button><button class="btn" data-ta="close">Schließen</button></div>`;
      if (exam()) h += '<p class="hint2" style="color:var(--warn)">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>';
      if (r && (r.ok || r.stufe === 'loes')) h += `<div class="btns"><button class="btn pri" data-ta="next">Nächste Aufgabe</button></div>`;
      h += '</div>';
    }
    h += `<p class="hint2" style="margin:4px 0 0">${n100} von ${TASKS.length} Aufgaben gelöst. ${exam() ? '🎓 Prüfmodus ist an.' : 'Tipp: Im Prüfmodus (🎓 oben) zählen Tipps als Abzug.'}</p>`;
    let last = '';
    TASKS.forEach(x => { if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; } const p = prog[x.id]; h += `<button class="row" data-t="${esc(x.id)}"><span class="dot ${d[x.id] ? 'g' : ''}">${d[x.id] ? '✓' : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${dots(x.level)}</span> · ${x.lj}. Lehrjahr${p != null && p < 100 ? ' · bisher ' + p + ' %' : ''}</small></div></button>`; });
    Vw.innerHTML = h + ueb(); if (top !== false) $('#pgTasks').scrollTop = 0;
  }
  function checkTask(t) {
    const a = S.tAns[t.id] || {}, e = evalQ(S.tq, a); if (!e) return; const pct = e.ok ? pctFor(t.id) : 0;
    const fehl = e.ok ? 0 : (S.tFehl[t.id] = (S.tFehl[t.id] || 0) + 1); S.tRes = { id: t.id, ok: e.ok, given: e.given, pct, stufe: stufeFuer(e.ok, fehl, exam()) };
    if (e.ok) { markSolved(t.id, pct); const F = fx(); if (F && F.pass) try { F.pass(pct); } catch (er) {} else ding(); toast(exam() && pct < 100 ? pct + ' % (Tipps abgezogen)' : '🎉 Geschafft!'); } else { sad(); toast(S.tRes.stufe === 'loes' ? 'Lösung und Lösungsweg stehen unter der Aufgabe.' : 'Noch nicht richtig. Lies den Tipp und versuche es noch einmal.'); }
    renderTasks(false); zeigFb($('#taskView'));
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
    S.task = id; S.tq = D.makeTask(t); S.tAns = {}; S.tRes = null; S.tFehl[id] = 0;
    const h = lsGet('hints', {}), c = lsGet('ctipps', {}); if (h[id]) { delete h[id]; lsSet('hints', h); } if (c[id]) { delete c[id]; lsSet('ctipps', c); }
    renderTasks();
  }
  const tv = $('#taskView');
  tv.addEventListener('input', e => { const t = curTask(); if (t && e.target.dataset.in) (S.tAns[t.id] = S.tAns[t.id] || {}).v = e.target.value; });
  tv.addEventListener('keydown', e => { const t = curTask(); if (t && e.key === 'Enter' && e.target.dataset.in) { e.preventDefault(); checkTask(t); } });
  tv.addEventListener('click', e => {
    const t = curTask(), tc = e.target.closest('[data-tc]'), ta = e.target.closest('[data-ta]'), row = e.target.closest('.row[data-t]');
    if (tc && t) { (S.tAns[t.id] = S.tAns[t.id] || {}).c = +tc.dataset.tc; renderTasks(false); return; }
    if (ta && t) { const a = ta.dataset.ta; if (a === 'chk') checkTask(t); else if (a === 'hint') hintFor(S.tq, t.id); else if (a === 'close') { S.task = null; S.tRes = null; renderTasks(); } else if (a === 'next') { const i = TASKS.findIndex(x => x.id === t.id), nx = TASKS.slice(i + 1).find(x => !done()[x.id]) || TASKS[(i + 1) % TASKS.length]; startTask(nx.id); } return; }
    if (row) startTask(row.dataset.t);
  });

  /* Zufalls-Trainer (Tipps kosten hier nie etwas) */
  function newTrainer() { const T = S.tr; T.q = D.randomQ(R0, T.level); T.ans = {}; T.res = null; T.fehl = 0; renderTrainer(); }
  function renderTrainer() {
    const T = S.tr; if (!T.q) { newTrainer(); return; }
    const q = T.q;
    $('#rtView').innerHTML = `<div class="stats"><div class="bx"><b>${S.rt.n}</b>Fragen</div><div class="bx"><b>${S.rt.ok}</b>richtig</div><div class="bx"><b>${S.rt.streak}</b>Serie</div><div class="bx"><b>${S.rt.best}</b>Beste Serie</div></div>
      <div class="fbar"><span class="lbl2" style="font-size:14px;color:var(--mute)">STUFE</span><div class="seg">${[[0, 'Alle'], [1, '1'], [2, '2'], [3, '3']].map(l => `<button data-lv="${l[0]}" class="${T.level === l[0] ? 'on' : ''}">${l[1]}</button>`).join('')}</div></div>
      <div class="card pl"><h4>${esc(q.cat)} · <span class="lv">${dots(q.level)}</span></h4><div class="big">${esc(q.title)}</div>${qHead(q)}${qBody(q, T.ans, T.res)}${T.res ? fbHTML(q, T.res) : ''}
      <div class="btns"><button class="btn pri" data-ra="chk" ${T.res && T.res.stufe !== 'tipp' ? 'disabled' : ''}>✓ Prüfen</button><button class="btn" data-ra="hint" ${T.res && T.res.stufe !== 'tipp' ? 'disabled' : ''}>💡 Tipp</button><button class="btn" data-ra="next">${T.res && T.res.stufe !== 'tipp' ? 'Nächste Frage' : 'Überspringen'}</button></div></div>`;
    if (T.res) zeigFb($('#rtView'));
  }
  const rv = $('#rtView');
  rv.addEventListener('input', e => { if (e.target.dataset.in) S.tr.ans.v = e.target.value; });
  rv.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.in) { e.preventDefault(); trainerCheck(); } });
  rv.addEventListener('click', e => {
    const T = S.tr, tc = e.target.closest('[data-tc]'), ra = e.target.closest('[data-ra]'), lv = e.target.closest('[data-lv]');
    if (lv) { T.level = +lv.dataset.lv; newTrainer(); return; }
    if (tc && (!T.res || T.res.stufe === 'tipp')) { T.ans.c = +tc.dataset.tc; renderTrainer(); return; }
    if (ra) { const a = ra.dataset.ra; if (a === 'chk') trainerCheck(); else if (a === 'hint') hintFor(T.q, 'rt'); else { if ((!T.res || T.res.stufe === 'tipp') && S.rt.streak) { S.rt.streak = 0; lsSet('rt', S.rt); } newTrainer(); updatePal(); } }
  });
  function trainerCheck() {
    const T = S.tr; if (T.res && T.res.stufe !== 'tipp') return; const e = evalQ(T.q, T.ans); if (!e) return;
    if (!e.ok && !T.fehl) { T.fehl = 1; T.res = { ok: false, given: e.given, stufe: 'tipp' }; sad(); renderTrainer(); return; }
    T.res = { ok: e.ok, given: e.given, stufe: e.ok ? 'ok' : 'loes' }; S.rt.n++; if (e.ok) { S.rt.ok++; S.rt.streak++; S.rt.best = Math.max(S.rt.best, S.rt.streak); ding(); } else { S.rt.streak = 0; sad(); }
    lsSet('rt', S.rt); renderTrainer(); updatePal();
  }

  /* ============================================================ Hilfe */
  function renderHelp() {
    const sec = (t, b, open) => `<details${open ? ' open' : ''}><summary>${t}</summary><div class="hb2">${b}</div></details>`;
    const s0 = C.sim('ok', 25), s7 = C.sim('ok', 70);
    $('#helpView').innerHTML =
      sec('Modellgerät TW-1: Blöcke und Sollwerte', `<div class="vzbox">${V.blockSvg({ sim: s7 })}</div><table><tr><th>Block</th><th>Aufgabe</th></tr>${C.BLOCKS.map(b => `<tr><td>${esc(b.n)}</td><td>${esc(b.d)}</td></tr>`).join('')}</table><table><tr><th>Messpunkt</th><th>Soll bei 25 °C</th><th>Soll bei 70 °C</th></tr>${C.MPS.map(m => { const ac = m.art === 'ac', v = s => ac ? f(s.mp[m.k].ac, 0) + ' V~' : f(s.mp[m.k].dc, 2) + ' V'; return `<tr><td>${esc(m.k)} ${esc(m.n)}</td><td>${esc(v(s0))}</td><td>${esc(v(s7))}</td></tr>`; }).join('')}</table><p class="hint2">Brummspannung an MP3: ${esc(f(s0.mp.MP3.pp, 1))} Vss bei 100 Hz (Relais aus). Das Relais zieht ab 60 °C an. Spannungen gegen Masse (Minus von C1).</p>`, true) +
      sec('Fehlersuche', `<ol><li>Fehlerbild aufnehmen (Kunde fragen, Gerät ansehen).</li><li>Sichtprüfung (verbrannte Bauteile, lose Kühlkörper, ausgelaufene Elkos).</li><li>Messen: von vorn nach hinten oder mit der Halbierungsmethode.</li><li>Ursache finden, nicht nur das Symptom beheben.</li><li>Instandsetzen, prüfen, dokumentieren.</li></ol><span class="eq">Halbierungsmethode: höchstens m Messungen mit 2 hoch m ≥ Anzahl Stufen</span><p>Netzseite (MP1): nur mit geeignetem Messgerät (Messkategorie), berührungsgeschützten Prüfspitzen und als Elektrofachkraft oder unter deren Aufsicht. Widerstände nur spannungsfrei messen, Elko vorher über einen Widerstand entladen.</p>`) +
      sec('Prüfung nach Instandsetzung (DIN VDE 0701-0702)', `<table><tr><th>Messung</th><th>Grenzwert (Übersicht)</th></tr><tr><td>Schutzleiterwiderstand (SK I)</td><td>0,3 Ω bis 5 m, je weitere 7,5 m plus 0,1 Ω, höchstens 1 Ω; Prüfstrom mindestens 200 mA</td></tr><tr><td>Isolationswiderstand, 500 V DC</td><td>SK I: 1 MΩ · SK II: 2 MΩ · SK III (250 V DC): 0,25 MΩ</td></tr><tr><td>Schutzleiterstrom (SK I)</td><td>höchstens 3,5 mA</td></tr><tr><td>Berührungsstrom (SK II)</td><td>höchstens 0,5 mA</td></tr></table><ol>${C.PRUEF_SCHRITTE.map(s => `<li>${esc(s)}</li>`).join('')}</ol><p class="hint2">Sonderfälle (Heizgeräte, große Leistungen) und genaue Messverfahren stehen in der Norm. Die Übersicht ersetzt sie nicht.</p>`) +
      sec('Formeln', `<span class="eq">Û = U · √2</span><span class="eq">UC1 ≈ U · √2 − 2 · 0,7 V (Brücke)</span><span class="eq">ΔU = I / (f · C), Brücke f = 100 Hz, Einweg f = 50 Hz</span><span class="eq">U5 = 5 V · RNTC / (10 kΩ + RNTC)</span><span class="eq">P = (UE − UA) · I</span><span class="eq">Rth,K = (ϑj − ϑu) / P − Rth,JG − Rth,GK</span><span class="eq">IC = U / RSpule, IB = IC / B · ü, RB = (USt − UBE) / IB (E12 abrunden)</span><span class="eq">RV = (U − UF) / I (E12 aufrunden)</span>`) +
      sec('Dokumentation und Kostenvoranschlag', `<span class="eq">Netto = Material + Minuten / 60 · Stundensatz</span><span class="eq">Brutto = Netto · 1,19 (19 % MwSt)</span><p>Arbeitsbericht: Fehlerbild, Messwerte, Ursache, getauschte Teile, Arbeitszeit, Prüfergebnis. Bei der Übergabe erklärst du dem Kunden, was defekt war, was getauscht wurde und dass die Prüfung bestanden ist.</p><p class="hint2">Stundensatz ${esc(f(C.RATE, 0))} €/h und Preise sind Übungswerte.</p>`) + ueb();
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'geraet'; S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    ({ geraet: renderGeraet, vde: renderVde, dim: renderDim, tasks: renderTasks, rt: renderTrainer, help: renderHelp })[t]();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'Systemanalyse-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = 'Systemanalyse-Lab: ' + T[2];
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
  $('#title').onclick = () => setTab('geraet');
  $('#bMenu').onclick = () => {
    const rows = [['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung und Tipps'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Aufgaben mit Serien-Zähler'], ['help', 'Hilfe und Formeln', 'Sollwerte, Fehlersuche, Grenzwerte, Formeln'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben und Trainer-Serie auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
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
  root.SYA_LAB = { id: 'sya', title: 'Systemanalyse-Lab', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.SYA_TASKS };

  buildTabs(); updatePal(); setTab(TABS.some(x => x[0] === S.tab) ? S.tab : 'geraet');
  /* Aufruf ?aufgabe=sya1 öffnet die Aufgabe */
  root.LabGoto = id => { try { if (TASKS.some(t => t.id === id)) { setTab('tasks'); startTask(id); return true; } } catch (e) {} return false; };
  try { const qa = new URLSearchParams(location.search).get('aufgabe'); if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); } } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
