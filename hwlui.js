'use strict';
/* Tonfunk PC-Hardware-Lab: Oberfläche (Lab-Kennung 'hwl').
   ALLE Leistungs-, Kapazitäts-, Datenraten- und Preiswerte sind ÜBUNGSWERTE für die Ausbildung, nicht für den Einkauf.
   Reiter: PC und Netzteil, RAID (interaktive SVG-Grafik), Konfigurator (SVG-Verbindungsplan), Einheiten und Daten, Fehlersuche (Entscheidungsbaum), Aufgaben, Trainer, Beispiele, Hilfe.
   Module: hwlcore.js (HWL_CORE, Rechenlogik), hwldata.js (HWL_DATA, HWL_TASKS: Aufgaben, Beispiele, Diagnose-Bäume).
   Speicher (Präfix lm4.hwl.): tab, pc, raid, kfg, bit, diag, done ({id:true} nur gelöste), prog ({id:Prozent}), hints, ctipps (nur Prüfmodus), exam ('1'), rt (Trainer).
   Tipp-Abzug (25 % je Stufe, höchstens 2 Stufen) gibt es nur im Prüfmodus; beim normalen Üben kosten Tipps nichts.
   Aufruf: hwllab.html?aufgabe=hwl1 öffnet die Aufgabe, hwllab.html?bsp öffnet die Beispiele (?bsp=psu1 springt zu einem Beispiel). */
(function (root) {
  const C = root.HWL_CORE, D = root.HWL_DATA;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.hwl.';
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
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>PC-Hardware-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">hwlcore.js oder hwldata.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks;

  /* ============================================================ Zustand */
  const TABS = [['pc', '🖥️', 'PC & Netzteil'], ['raid', '💽', 'RAID'], ['kfg', '🧩', 'Konfigurator'], ['bit', '🔢', 'Einheiten & Daten'], ['diag', '🩺', 'Fehlersuche'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['bsp', '📖', 'Beispiele'], ['help', '📘', 'Hilfe']];
  const S = {
    tab: lsGet('tab', 'pc'),
    pc: Object.assign({ cpu: '95', gpu: '200', mb: '40', ram: '4', ssd: '1', hdd: '1', fan: '4', other: '0', eff: '85', h: '4', days: '365', ct: '35', tamb: '25', rth: '0,3' }, lsGet('pc', {})),
    raid: Object.assign({ level: 5, n: '4', s: '4', failed: [] }, lsGet('raid', {})),
    kfg: Object.assign({ cpu: 'c1', mb: 'b1', ram: 'r2', gpu: 'g1', cool: 'k2', psu: 'p450', case: 't1' }, lsGet('kfg', {})),
    bit: Object.assign({ v: '500', u: 'GB', fs: '25', fu: 'GB', fi: 'usb32g1', fr: '' }, lsGet('bit', {})),
    diag: Object.assign({ tree: 'dark', path: [] }, lsGet('diag', {})),
    task: null, tq: null, tAns: {}, tRes: null,
    tr: { q: null, ans: {}, res: null, level: 0 },
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {}))
  };
  if (!C.raidOf(+S.raid.level)) S.raid.level = 5; S.raid.level = +S.raid.level;
  if (!Array.isArray(S.raid.failed)) S.raid.failed = [];
  Object.keys(C.DB).forEach(k => { if (!C.part(k, S.kfg[k])) S.kfg[k] = { cpu: 'c1', mb: 'b1', ram: 'r2', gpu: 'g1', cool: 'k2', psu: 'p450', case: 't1' }[k]; });
  if (!C.UNITS[S.bit.u]) S.bit.u = 'GB'; if (!['B', 'kB', 'MB', 'GB', 'TB'].includes(S.bit.fu)) S.bit.fu = 'GB'; if (!C.ifaceOf(S.bit.fi)) S.bit.fi = 'usb32g1';
  if (!D.trees[S.diag.tree]) S.diag.tree = 'dark'; if (!Array.isArray(S.diag.path)) S.diag.path = [];
  const R0 = (() => { const m = /[?&]seed=([^&]+)/.exec(location.search); return C.rng(m ? decodeURIComponent(m[1]) : String(Math.random()) + Date.now()); })();

  /* ============================================================ Bausteine */
  const box = (t, fm, res, cls) => `<div class="rdout ${cls || ''}"><span class="st">${esc(t)}</span>${fm ? esc(fm) + ' = ' : ''}<b>${esc(res)}</b></div>`;
  const note = (t, cls) => `<div class="rdout ${cls || 'warn'}">${esc(t)}</div>`;
  const inp = (k, label, val, unit, attr) => `<label class="f"><span>${esc(label)}${unit ? ' (' + esc(unit) + ')' : ''}</span><input ${attr || 'data-k'}="${k}" inputmode="decimal" autocomplete="off" value="${esc(val)}"></label>`;
  const UEB = 'Alle Leistungs-, Kapazitäts-, Datenraten- und Preiswerte in diesem Lab sind Übungswerte für die Ausbildung, nicht für den Einkauf. Maßgebend sind die Datenblätter der Hersteller und die Vorgaben deines Betriebs.';
  const ueb = () => `<div class="rdout warn">⚠ ${esc(UEB)}</div>`;
  const seg = (attr, opts, cur) => `<div class="seg">${opts.map(o => `<button ${attr}="${esc(o[0])}" class="${String(cur) === String(o[0]) ? 'on' : ''}">${esc(o[1])}</button>`).join('')}</div>`;
  const sel = (k, opts, cur) => `<select data-k="${k}">${opts.map(o => `<option value="${esc(o[0])}"${String(cur) === String(o[0]) ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;

  /* ============================================================ PC und Netzteil */
  /* PRUEFEN P15: Stromkosten im Rechner "pc": Der Rechner läuft an allen angegebenen Tagen die angegebenen Stunden mit der berechneten Gesamtleistung (Volllast, Aufnahme aus der Steckdose). Das ist ein Höchstwert, im Alltag liegt der Verbrauch deutlich darunter. Soll das so dargestellt werden, oder ein Lastfaktor (z. B. 40 %) ergänzt werden? */
  const pcParams = s => ({ cpu: P(s.cpu), gpu: P(s.gpu), mb: P(s.mb), ram: P(s.ram), ssd: P(s.ssd), hdd: P(s.hdd), fan: P(s.fan), other: P(s.other), eff: P(s.eff), h: P(s.h), days: P(s.days), ct: P(s.ct), tamb: P(s.tamb), rth: P(s.rth) });
  function pcSvg(sum, pick, rec) {
    const W = 600, bx = 24, bw = 552, cap = fin(pick) ? pick : Math.max(rec, 1200), sx = v => Math.min(bw, Math.max(0, v / cap * bw));
    const util = sum / cap * 100, col = util > 100 ? 'var(--danger)' : 'var(--accent)';
    let s = `<rect x="${bx}" y="46" width="${bw}" height="30" rx="6" fill="var(--panel)" stroke="var(--mute)" stroke-width="1.5"/>`;
    s += `<rect x="${bx}" y="46" width="${sx(rec)}" height="30" rx="6" fill="var(--hi)" fill-opacity=".35"/>`;
    s += `<rect x="${bx}" y="46" width="${sx(sum)}" height="30" rx="6" fill="${col}" fill-opacity=".75"/>`;
    s += `<text class="g-lab" x="${bx}" y="36">Netzteil ${esc(fin(pick) ? f(pick, 0) + ' W' : 'über 1.200 W')}</text><text class="g-lab m" x="${bx + bw}" y="36" text-anchor="end">Auslastung ${esc(f(util, 0))} %</text>`;
    s += `<text class="g-lab" x="${bx + sx(sum)}" y="96" text-anchor="${sx(sum) > bw - 90 ? 'end' : 'start'}" style="fill:var(--accent)">Last ${esc(f(sum, 0))} W</text><text class="g-lab m" x="${bx + sx(rec)}" y="112" text-anchor="${sx(rec) > bw - 120 ? 'end' : 'start'}">mit 30 % Reserve ${esc(f(rec, 0))} W</text>`;
    return `<svg viewBox="0 0 ${W} 124" role="img" aria-label="Balken: Last des Rechners im Verhältnis zur Netzteilleistung">${s}</svg>`;
  }
  const fin = Number.isFinite;
  function pcOut(p) {
    if (!['cpu', 'gpu', 'mb', 'ram', 'ssd', 'hdd', 'fan', 'other'].every(k => p[k] >= 0)) return note('Bitte alle Leistungs- und Stückzahlfelder als Zahlen eingeben (nicht negativ).');
    const sum = C.loadSum(p), rec = C.psuNeed(sum), pick = C.psuPick(sum), L = C.LOAD;
    let h = box('1. Gesamtleistung', f(p.cpu, 0) + ' + ' + f(p.gpu, 0) + ' + ' + f(p.mb, 0) + ' + ' + f(p.ram, 0) + '·' + L.ram + ' + ' + f(p.ssd, 0) + '·' + L.ssd + ' + ' + f(p.hdd, 0) + '·' + L.hdd + ' + ' + f(p.fan, 0) + '·' + L.fan + ' + ' + f(p.other, 0), f(sum, 0) + ' W');
    h += box('2. Mit 30 % Reserve', f(sum, 0) + ' W · 1,3', f(rec, 1) + ' W');
    h += fin(pick) ? box('3. Nächste Normgröße des Netzteils', 'Reihe 350, 400, 450, 500, 550, 650, 750, 850, 1.000, 1.200 W', f(pick, 0) + ' W') : note('Der Bedarf mit Reserve liegt über 1.200 W: Dafür gibt es in der Übungsreihe kein Netzteil.', 'bad');
    if (fin(pick)) h += box('4. Auslastung bei voller Last', f(sum, 0) + ' W / ' + f(pick, 0) + ' W · 100', f(C.psuUtil(sum, pick), 0) + ' %');
    if (p.eff > 0 && p.eff <= 100) {
      const pin = C.inputPower(sum, p.eff), loss = C.lossPower(sum, p.eff);
      h += box('5. Aufnahme aus der Steckdose (Wirkungsgrad ' + f(p.eff, 0) + ' %)', f(sum, 0) + ' W / ' + f(p.eff / 100, 2), f(pin, 1) + ' W');
      h += box('6. Verlustleistung als Wärme im Netzteil', f(pin, 1) + ' W − ' + f(sum, 0) + ' W', f(loss, 1) + ' W');
      if (p.h >= 0 && p.days >= 0 && p.ct >= 0) {
        const e = C.kwh(pin, p.h) * p.days;
        h += box('7. Stromkosten pro Jahr (Höchstwert bei Dauer-Volllast)', f(pin, 1) + ' W · ' + f(p.h, 1) + ' h · ' + f(p.days, 0) + ' Tage = ' + f(e, 1) + ' kWh · ' + f(p.ct, 1) + ' ct', f(C.costEUR(e, p.ct), 2) + ' €');
      }
    } else h += note('Gib einen Wirkungsgrad zwischen 1 und 100 % ein, dann siehst du Aufnahme, Verlust und Kosten.');
    if (fin(p.tamb) && p.rth >= 0) {
      const T = C.cpuTemp(p.tamb, p.cpu, p.rth);
      h += box('8. Prozessortemperatur (vereinfacht)', 'Umgebung + P · Rth = ' + f(p.tamb, 0) + ' + ' + f(p.cpu, 0) + ' · ' + f(p.rth, 2), f(T, 1) + ' °C', T > C.THROTTLE ? 'bad' : '');
      if (T > C.THROTTLE) h += note('Über ' + C.THROTTLE + ' °C regelt ein Prozessor im Übungsmodell den Takt herunter. Ein Kühler mit kleinerem Wärmewiderstand wäre nötig.', 'bad');
    }
    return h + `<div class="inst">${pcSvg(sum, pick, rec)}</div>`;
  }
  function renderPc() {
    const s = S.pc;
    $('#pcView').innerHTML = ueb() + `<div class="card pl"><h4>Bauteile und ihre Leistung</h4>
      <div class="dsrow">${inp('cpu', 'Prozessor (TDP)', s.cpu, 'W')}${inp('gpu', 'Grafikkarte', s.gpu, 'W')}${inp('mb', 'Mainboard', s.mb, 'W')}${inp('other', 'Sonstiges', s.other, 'W')}</div>
      <div class="dsrow">${inp('ram', 'RAM-Riegel (je 4 W)', s.ram, 'Stück')}${inp('ssd', 'SSDs (je 5 W)', s.ssd, 'Stück')}${inp('hdd', 'Festplatten (je 8 W)', s.hdd, 'Stück')}${inp('fan', 'Lüfter (je 3 W)', s.fan, 'Stück')}</div>
      <p class="hint2">Wärme und Kosten</p>
      <div class="dsrow">${inp('eff', 'Wirkungsgrad Netzteil', s.eff, '%')}${inp('h', 'Betrieb pro Tag', s.h, 'h')}${inp('days', 'Tage pro Jahr', s.days, 'Tage')}${inp('ct', 'Strompreis', s.ct, 'ct/kWh')}</div>
      <div class="dsrow">${inp('tamb', 'Umgebungstemperatur', s.tamb, '°C')}${inp('rth', 'Wärmewiderstand des Kühlers', s.rth, 'K/W')}</div>
      <p class="hint2">Zahlen mit Komma oder Punkt eingeben. Der Prozessor und die Grafikkarte zählen mit ihrem TDP-Wert; alle anderen Bauteile mit den Übungswerten. Die Kosten gelten für Dauer-Volllast und sind ein Höchstwert.</p></div><div id="pcOut"></div>`;
    updatePc();
  }
  function updatePc() { $('#pcOut').innerHTML = pcOut(pcParams(S.pc)); }
  $('#pcView').addEventListener('input', e => { const k = e.target.dataset.k; if (!k) return; S.pc[k] = e.target.value; lsSet('pc', S.pc); updatePc(); });

  /* ============================================================ RAID */
  /* PRUEFEN P16: Schreib-Strafe (Faktor für kleine Zufallsschreibzugriffe: RAID 1 und 10 = 2, RAID 5 = 4, RAID 6 = 6) und Lesegewinn nur als grobe Richtwerte. Soll die Schreib-Strafe im Unterricht schon genannt werden? */
  function raidSvg(l, n, s, failed) {
    const chk = C.raidOk(l, n), W = 640;
    if (!chk.ok) return `<svg viewBox="0 0 ${W} 64" role="img" aria-label="RAID-Darstellung"><text class="g-lab" x="${W / 2}" y="36" text-anchor="middle">${esc(chk.why)}</text></svg>`;
    const k = n, gap = 8, dw = Math.min(64, (W - 40 - gap * (k - 1)) / k), total = k * dw + gap * (k - 1), x0 = (W - total) / 2, top = 70, dh = 110, ok = C.raidSurvives(l, n, failed);
    const r = l === 5 ? 1 / n : l === 6 ? 2 / n : 0;
    let s2 = `<text class="g-lab" x="${W / 2}" y="22" text-anchor="middle" style="font-size:15px;fill:${ok ? 'var(--ok)' : 'var(--danger)'}">${ok ? 'Verbund arbeitet, Daten sind vollständig' : 'Verbund verloren: Daten sind nicht mehr vollständig'}</text>`;
    if (l === 1) s2 += `<path d="M${x0} 58 v-8 h${total} v8" fill="none" stroke="var(--mute)" stroke-width="1.5"/><text class="g-lab m" x="${W / 2}" y="46" text-anchor="middle">alle Platten enthalten dieselben Daten (Kopien)</text>`;
    for (let i = 0; i < n; i++) {
      const x = x0 + i * (dw + gap), isF = failed.indexOf(i) >= 0;
      s2 += `<g class="hw-disk" data-rd="${i}" tabindex="0" role="button" aria-label="Platte ${i + 1}${isF ? ', ausgefallen' : ''}"><rect class="hw-d0" x="${x}" y="${top}" width="${dw}" height="${dh}" rx="6"/>`;
      if (r > 0) s2 += `<rect class="hw-dr" x="${x}" y="${top}" width="${dw}" height="${dh * r}" rx="6"/><rect class="hw-dd" x="${x}" y="${top + dh * r}" width="${dw}" height="${dh * (1 - r)}" rx="6"/>`;
      else s2 += `<rect class="hw-dd" x="${x}" y="${top}" width="${dw}" height="${dh}" rx="6"/>`;
      if (isF) s2 += `<rect class="hw-df" x="${x}" y="${top}" width="${dw}" height="${dh}" rx="6"/><path d="M${x + 6} ${top + 6} L${x + dw - 6} ${top + dh - 6} M${x + dw - 6} ${top + 6} L${x + 6} ${top + dh - 6}" stroke="var(--danger)" stroke-width="4" stroke-linecap="round"/>`;
      s2 += `<text class="g-lab" x="${x + dw / 2}" y="${top + dh + 18}" text-anchor="middle">${i + 1}</text></g>`;
    }
    if (l === 10) for (let p = 0; p < n; p += 2) { const x = x0 + p * (dw + gap); s2 += `<path d="M${x} ${top - 6} v-8 h${2 * dw + gap} v8" fill="none" stroke="var(--mute)" stroke-width="1.5"/><text class="g-lab m" x="${x + dw + gap / 2}" y="${top - 18}" text-anchor="middle" style="font-size:10px">Spiegel</text>`; }
    s2 += `<text class="g-lab m" x="${W / 2}" y="${top + dh + 44}" text-anchor="middle">${r > 0 ? 'Blau: Nutzdaten · Orange: Parität (verteilt auf alle Platten, hier als Anteil dargestellt)' : l === 0 ? 'Blau: Nutzdaten, auf alle Platten verteilt' : 'Blau: Nutzdaten bzw. deren Kopie'}</text>`;
    return `<svg viewBox="0 0 ${W} ${top + dh + 54}" role="img" aria-label="${n} Festplatten im RAID ${l}; Tippen auf eine Platte schaltet sie auf ausgefallen">${s2}</svg>`;
  }
  function raidOutFor(l, n, s, failed) {
    const chk = C.raidOk(l, n); if (!chk.ok) return note(chk.why);
    if (!(s > 0)) return note('Gib eine Plattengröße größer als 0 ein.');
    const r = C.raidOf(l), usable = C.raidUsable(l, n, s), raw = C.raidRaw(n, s), tol = C.raidTol(l, n), fl = failed.filter(i => i < n), ok = C.raidSurvives(l, n, fl);
    const fm = l === 0 ? 'n · s = ' + n + ' · ' + f(s, 2) : l === 1 ? 's = ' + f(s, 2) : l === 5 ? '(n − 1) · s = ' + (n - 1) + ' · ' + f(s, 2) : l === 6 ? '(n − 2) · s = ' + (n - 2) + ' · ' + f(s, 2) : 'n / 2 · s = ' + n / 2 + ' · ' + f(s, 2);
    let h = box(r.n, 'Rohkapazität ' + n + ' · ' + f(s, 2) + ' TB', f(raw, 2) + ' TB');
    h += box('Nutzbare Kapazität', fm + ' TB', f(usable, 2) + ' TB');
    h += box('Anteil nutzbar', f(usable, 2) + ' / ' + f(raw, 2) + ' · 100', f(usable / raw * 100, 1) + ' %');
    h += box('Beliebige Plattenausfälle, die garantiert verkraftet werden', '', f(tol, 0) + (l === 10 ? ' (mit Glück bis zu ' + n / 2 + ', wenn je Spiegel nur eine ausfällt)' : l === 1 ? ' (alle bis auf eine Platte)' : ''));
    h += box('Schreib-Strafe bei kleinen Zufallszugriffen (grober Richtwert)', '', 'Faktor ' + C.raidWP(l));
    const rest = Array.from({ length: n }, (_, i) => i).filter(i => fl.indexOf(i) < 0), spare = rest.length > 0 && rest.every(j => C.raidSurvives(l, n, fl.concat([j]))), lst = fl.map(i => i + 1).sort((x, y) => x - y).join(', ');
    h += fl.length ? (ok ? note('Ausgefallen: ' + lst + '. Der Verbund läuft weiter, hat aber ' + (spare ? 'noch Reserve für einen weiteren Ausfall.' : 'keine Reserve mehr: Der nächste Ausfall kann alles zerstören.') + ' Ausgefallene Platte schnell ersetzen.', 'ok') : note('Ausgefallen: ' + lst + '. Mehr Ausfälle, als diese Stufe verträgt: Der Verbund ist verloren, die Daten gibt es nur noch aus einer Datensicherung.', 'bad')) : note('Tippe in der Grafik auf Platten, um Ausfälle zu simulieren.', 'ok');
    return h + `<p class="hint2">RAID schützt vor Plattenausfall, ersetzt aber keine Datensicherung (Backup).</p>`;
  }
  function renderRaid() {
    const s = S.raid;
    $('#raidView').innerHTML = ueb() + `<div class="card pl"><h4>RAID-Verbund aufbauen</h4>
      <div class="fbar"><span style="font-size:12px;color:var(--mute)">STUFE</span>${seg('data-rl', C.RAIDS.map(r => [r.l, 'RAID ' + r.l]), s.level)}</div>
      <div class="dsrow">${inp('n', 'Anzahl der Platten', s.n, 'Stück')}${inp('s', 'Größe je Platte', s.s, 'TB')}</div>
      <div id="rdSvg" class="inst"></div>
      <p class="hint2">Tippe auf eine Platte, um einen Ausfall zu simulieren. Alle Platten sind gleich groß.</p>
      <div class="btns"><button class="btn" data-rd2="clear">Alle Platten heil</button></div></div><div id="raidOut"></div>`;
    updateRaid();
  }
  function updateRaid() {
    const s = S.raid, n = P(s.n), sz = P(s.s);
    s.failed = s.failed.filter(i => Number.isInteger(i) && i >= 0 && i < (Number.isInteger(n) ? n : 0));
    $('#rdSvg').innerHTML = raidSvg(s.level, n, sz, s.failed);
    $('#raidOut').innerHTML = raidOutFor(s.level, n, sz, s.failed);
  }
  $('#raidView').addEventListener('input', e => { const k = e.target.dataset.k; if (!k) return; S.raid[k] = e.target.value; lsSet('raid', S.raid); updateRaid(); });
  $('#raidView').addEventListener('click', e => {
    const lv = e.target.closest('[data-rl]'), dk = e.target.closest('[data-rd]'), cl = e.target.closest('[data-rd2]');
    if (lv) { S.raid.level = +lv.dataset.rl; lsSet('raid', S.raid); renderRaid(); return; }
    if (cl) { S.raid.failed = []; lsSet('raid', S.raid); updateRaid(); return; }
    if (dk) { const i = +dk.dataset.rd, a = S.raid.failed, j = a.indexOf(i); if (j >= 0) a.splice(j, 1); else a.push(i); lsSet('raid', S.raid); updateRaid(); }
  });
  $('#raidView').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('[data-rd]')) { e.preventDefault(); e.target.closest('[data-rd]').dispatchEvent(new MouseEvent('click', { bubbles: true })); } });

  /* ============================================================ Konfigurator */
  const KLBL = { cpu: 'Prozessor', mb: 'Mainboard', ram: 'Arbeitsspeicher', gpu: 'Grafikkarte', cool: 'Kühler', psu: 'Netzteil', case: 'Gehäuse' };
  const NODE = { cool: [20, 8, 150], cpu: [20, 96, 150], psu: [20, 186, 150], mb: [245, 96, 160], case: [245, 252, 160], ram: [470, 96, 150], gpu: [470, 186, 150] };
  function kfgSvg(sel, res) {
    const L = res.links || {}, ln = (id, d, lab, lx, ly) => { const c = L[id] === 'err' ? 'var(--danger)' : L[id] === 'warn' ? 'var(--warn)' : 'var(--ok)'; return `<path d="${d}" fill="none" stroke="${c}" stroke-width="${L[id] ? 3.5 : 2.5}"${L[id] === 'err' ? ' stroke-dasharray="7 5"' : ''}/><text class="g-lab" x="${lx}" y="${ly}" text-anchor="middle" style="fill:${c};font-size:11px">${esc(lab)}</text>`; };
    let s = '';
    s += ln('cool-cpu', 'M95 52 V96', 'Sockel, Leistung', 95, 78);
    s += ln('cpu-mb', 'M170 118 H245', 'Sockel', 207, 110);
    s += ln('ram-mb', 'M470 118 H405', 'Speicher', 437, 110);
    s += ln('psu-sys', 'M170 208 L245 140', 'Leistung', 196, 184);
    s += ln('mb-case', 'M325 140 V252', 'Formfaktor', 366, 200);
    s += ln('gpu-case', 'M545 230 V274 H405', 'Länge', 478, 268);
    s += ln('cool-case', 'M20 30 H8 V274 H245', 'Höhe', 40, 262);
    Object.keys(NODE).forEach(k => {
      const [x, y, w] = NODE[k]; s += `<g class="hw-node"><rect x="${x}" y="${y}" width="${w}" height="44" rx="8"/><text class="g-lab m" x="${x + w / 2}" y="${y + 16}" text-anchor="middle" style="font-size:10.5px">${esc(KLBL[k])}</text><text class="g-lab" x="${x + w / 2}" y="${y + 34}" text-anchor="middle">${esc(C.shortOf(k, sel[k]))}</text></g>`;
    });
    return `<svg viewBox="0 0 640 310" role="img" aria-label="Verbindungsplan der Bauteile: Grün passt, Orange knapp, Rot gestrichelt Konflikt">${s}</svg>`;
  }
  function kfgOut(sel) {
    const r = C.checkBuild(sel); if (r.invalid) return note('Bitte für jede Baugruppe ein Bauteil wählen.');
    let h = box('Gesamtleistung (rechnerisch)', 'Prozessor + Grafik + ' + C.OVERHEAD + ' W + ' + C.RAM_W + ' W · RAM-Riegel', f(r.watts, 0) + ' W');
    h += box('Bedarf mit 30 % Reserve', f(r.watts, 0) + ' W · 1,3', f(r.rec, 1) + ' W');
    if (r.err.length) h += r.err.map(e => note('✗ ' + e.t, 'bad')).join('');
    if (r.warn.length) h += r.warn.map(e => note('! ' + e.t, 'warn')).join('');
    if (!r.err.length && !r.warn.length) h += note('✓ Keine Konflikte: Alle Bauteile passen zusammen.', 'ok');
    else if (!r.err.length) h += note('Die Bauteile passen zusammen, aber ohne die übliche Reserve.', 'warn');
    else h += note(r.err.length + (r.err.length === 1 ? ' Konflikt' : ' Konflikte') + ': Die Planung funktioniert so nicht.', 'bad');
    return h + `<div class="inst">${kfgSvg(sel, r)}</div>`;
  }
  function renderKfg() {
    const s = S.kfg;
    $('#kfgView').innerHTML = ueb() + `<div class="card pl"><h4>Baugruppen wählen</h4><div class="cols">${Object.keys(KLBL).map(k => `<label class="f"><span>${esc(KLBL[k])}</span>${sel(k, C.DB[k].map(x => [x.id, C.nameOf(k, x.id)]), s[k])}</label>`).join('')}</div>
      <p class="hint2">Bauteile und Werte sind frei erfunden. Der Konfigurator prüft: Sockel, Speichertyp, Speichermenge, Kühler (Sockel und Leistung), Formfaktor, Höhe und Länge im Gehäuse und die Netzteilleistung.</p></div><div id="kfgOut"></div>`;
    updateKfg();
  }
  function updateKfg() { $('#kfgOut').innerHTML = kfgOut(S.kfg); }
  $('#kfgView').addEventListener('input', e => { const k = e.target.dataset.k; if (!k || !C.DB[k]) return; S.kfg[k] = e.target.value; lsSet('kfg', S.kfg); updateKfg(); });

  /* ============================================================ Einheiten und Daten */
  const UNIT_OPTS = C.DEC.concat(C.BIN.slice(1)).map(u => [u, u]);
  function ifaceSvg(cur, custom) {
    const rows = C.IFACES, max = 4800, W = 600, bx = 190, bw = 360;
    let s = ''; rows.forEach((x, i) => { const y = 8 + i * 26, on = x.id === cur && !(custom > 0); s += `<text class="g-lab${on ? '' : ' m'}" x="${bx - 8}" y="${y + 13}" text-anchor="end"${on ? ' style="font-weight:700"' : ''}>${esc(x.n.replace(/ \(.*\)/, ''))}</text><rect x="${bx}" y="${y}" width="${Math.max(2, x.mbs / max * bw)}" height="18" rx="4" fill="${on ? 'var(--accent)' : 'var(--mute)'}" fill-opacity="${on ? '.85' : '.45'}"/><text class="g-lab m" x="${bx + Math.max(2, x.mbs / max * bw) + 6}" y="${y + 13}">${esc(f(x.mbs, 0))} MB/s</text>`; });
    return `<svg viewBox="0 0 ${W} ${8 + rows.length * 26}" role="img" aria-label="Balken der Übungs-Höchstraten von SATA und USB">${s}</svg>`;
  }
  function bitOut(b) {
    let h = '';
    const v = P(b.v);
    if (!(v >= 0)) h += note('Gib bei „Größe umrechnen“ eine Zahl ein (nicht negativ).');
    else {
      const bytes = v * C.UNITS[b.u], dec = C.DEC.slice(1), bin = C.BIN.slice(1);
      h += box('Größe in Byte', f(v, 4) + ' ' + b.u + ' · ' + f(C.UNITS[b.u], 0) + ' Byte', f(bytes, 0) + ' Byte');
      h += `<div class="tw"><table class="tt"><tr><th>dezimal (SI)</th><th class="n">Wert</th><th>binär (IEC)</th><th class="n">Wert</th></tr>${dec.map((u, i) => `<tr><td>${esc(u)}</td><td class="n">${esc(f(C.convert(v, b.u, u), 4))}</td><td>${esc(bin[i])}</td><td class="n">${esc(f(C.convert(v, b.u, bin[i]), 4))}</td></tr>`).join('')}</table></div>`;
      if (C.BIN_OF[b.u]) { const x = C.shown(v, b.u); h += box('Als Datenträgerangabe: so zeigt es das Betriebssystem (binär)', f(v, 2) + ' ' + b.u + ' / ' + f(C.UNITS[C.BIN_OF[b.u]] / C.UNITS[b.u], 6), f(x, 2) + ' ' + C.BIN_OF[b.u] + ' (' + f((1 - x / v) * 100, 1) + ' % weniger als angegeben)'); }
    }
    const fs = P(b.fs), ifc = C.ifaceOf(b.fi), custom = P(b.fr), rate = custom > 0 ? custom : ifc.mbs;
    if (fs >= 0 && ['B', 'kB', 'MB', 'GB', 'TB'].includes(b.fu)) {
      const mb = fs * C.UNITS[b.fu] / 1e6, t = C.xferSec(mb, rate);
      h += box('Übertragungsdauer' + (custom > 0 ? ' (eigene Rate)' : ' über ' + ifc.n), f(mb, 2) + ' MB : ' + f(rate, 0) + ' MB/s = ' + f(t, 1) + ' s', C.fmtDur(t));
      h += box('Rate in Bit', f(rate, 0) + ' MB/s · 8', f(C.mbToMbit(rate), 0) + ' Mbit/s (' + f(C.mbToMbit(rate) / 1000, 2) + ' Gbit/s)');
    } else h += note('Gib bei „Übertragung“ eine Größe als Zahl ein.');
    return h + `<div class="inst">${ifaceSvg(b.fi, custom)}</div><p class="hint2">Übungs-Höchstraten (Nutzdaten, gerundet). Echte Laufwerke erreichen diese Werte meist nicht.</p>`;
  }
  function renderBit() {
    const b = S.bit;
    $('#bitView').innerHTML = ueb() + `<div class="card pl"><h4>Größe umrechnen</h4><div class="dsrow">${inp('v', 'Wert', b.v, '')}<label class="f"><span>Einheit</span>${sel('u', UNIT_OPTS, b.u)}</label></div></div>
      <div class="card pl"><h4>Übertragung</h4><div class="dsrow">${inp('fs', 'Dateigröße', b.fs, '')}<label class="f"><span>Einheit</span>${sel('fu', ['B', 'kB', 'MB', 'GB', 'TB'].map(u => [u, u]), b.fu)}</label><label class="f"><span>Schnittstelle</span>${sel('fi', C.IFACES.map(x => [x.id, x.n]), b.fi)}</label>${inp('fr', 'Eigene Rate (statt Schnittstelle, leer lassen)', b.fr, 'MB/s')}</div></div><div id="bitOut"></div>`;
    updateBit();
  }
  function updateBit() { $('#bitOut').innerHTML = bitOut(S.bit); }
  $('#bitView').addEventListener('input', e => { const k = e.target.dataset.k; if (!k) return; S.bit[k] = e.target.value; lsSet('bit', S.bit); updateBit(); });

  /* ============================================================ Fehlersuche (Entscheidungsbaum) */
  function diagBody(treeId, path, live) {
    const tr = D.trees[treeId], w = C.treeWalk(tr, path); let h = `<p style="margin:0 0 8px"><b>Meldung:</b> ${esc(tr.symptom)}</p>`;
    if (w.steps.length) h += `<ul class="tl">${w.steps.map(s => `<li class="ok">✓ ${esc(tr.nodes[s.id].q)}<br><b>${esc(tr.nodes[s.id].a[s.i].t)}</b></li>`).join('')}</ul>`;
    if (w.leaf) { const lf = tr.leaves[w.at]; h += `<div class="rdout ok"><span class="st">Wahrscheinliche Ursache</span><b>${esc(lf.cause)}</b><span class="st" style="margin-top:6px">Maßnahme</span>${esc(lf.fix)}</div>`; }
    else { const nd = tr.nodes[w.at]; h += `<div class="card pl" style="border-color:var(--accent)"><h4>Nächste Prüfung</h4><p style="margin:0 0 8px">${esc(nd.q)}</p><div class="opts">${nd.a.map((a, i) => live ? `<button data-dg="${i}">${esc(a.t)}</button>` : `<button disabled>${esc(a.t)}</button>`).join('')}</div></div>`; }
    return h;
  }
  function renderDiag() {
    const d = S.diag, tr = D.trees[d.tree], w = C.treeWalk(tr, d.path); d.path = d.path.slice(0, w.steps.length);
    $('#diagView').innerHTML = `<div class="fbar"><span style="font-size:12px;color:var(--mute)">FEHLERBILD</span>${seg('data-dt', D.treeIds.map(id => [id, D.trees[id].title]), d.tree)}</div><div id="dgBody">${diagBody(d.tree, d.path, true)}</div>
      <div class="btns"><button class="btn" data-dgb="back"${d.path.length ? '' : ' disabled'}>↶ Einen Schritt zurück</button><button class="btn" data-dgb="reset">Neu beginnen</button></div>
      <div class="card pl"><h4>Meldungen und Pieptöne (Übungstabelle)</h4><div class="tw"><table class="tt"><tr><th>Hinweis</th><th>Wahrscheinliche Ursache</th></tr>${D.post.map(p => `<tr><td>${esc(p[0])}</td><td>${esc(p[1])}</td></tr>`).join('')}</table></div><p class="hint2">Echte Pieptoncodes hängen vom BIOS-Hersteller ab: Maßgebend ist das Handbuch des Mainboards.</p></div>`;
  }
  $('#diagView').addEventListener('click', e => {
    const d = S.diag, dt = e.target.closest('[data-dt]'), dg = e.target.closest('[data-dg]'), db = e.target.closest('[data-dgb]');
    if (dt) { d.tree = dt.dataset.dt; d.path = []; } else if (dg) d.path.push(+dg.dataset.dg); else if (db) { if (db.dataset.dgb === 'back') d.path.pop(); else d.path = []; } else return;
    lsSet('diag', d); renderDiag();
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
  const solText = q => (q.ask.type === 'choice' ? q.ask.choices[q.ask.correct] : f(q.value, 2) + (q.ask.unit ? ' ' + q.ask.unit : ''));
  const qText = t => `<p style="margin:8px 0;white-space:pre-line">${esc(t)}</p>`;
  function qBody(q, a, r, pre) {
    if (q.ask.type === 'choice') return `<div class="opts">${q.ask.choices.map((c, i) => `<button data-tc="${i}" ${r && (r.ok || pre === 'rt') ? 'disabled' : ''} class="${r && i === q.ask.correct && (r.ok || pre === 'rt') ? 'ok' : a.c === i ? (r && !r.ok ? 'bad' : 'on') : ''}">${esc(c)}</button>`).join('')}</div>`;
    return `<label class="f"><span>${esc(q.ask.label)}${q.ask.unit ? ' (' + esc(q.ask.unit) + ')' : ''}</span><div class="qin"><input data-in="1" inputmode="decimal" autocomplete="off" value="${esc(a.v || '')}" ${r && (r.ok || pre === 'rt') ? 'disabled' : ''}><span class="u">${esc(q.ask.unit)}</span></div></label>`;
  }
  function evalQ(q, a) {
    if (q.ask.type === 'choice') { if (a.c == null) { toast('Wähle zuerst eine Antwort.'); return null; } return { ok: a.c === q.ask.correct, given: q.ask.choices[a.c] }; }
    const v = P(a.v); if (!Number.isFinite(v)) { toast('Bitte gib eine Zahl ein (mit Komma oder Punkt).'); return null; }
    return { ok: Math.abs(v - q.value) <= q.tol + 1e-9, given: f(v, 2) + (q.ask.unit ? ' ' + q.ask.unit : '') };
  }
  const resBlock = (q, r, showExpl) => `<ul class="tl"><li class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓ Richtig: ' + esc(r.given) : '✗ Deine Antwort „' + esc(r.given) + '“ stimmt nicht.'}</li>${q.ask.type === 'num' && q.tol > 0.011 ? `<li>ℹ Erlaubte Abweichung: ±${esc(f(q.tol, 2))} ${esc(q.ask.unit)} (wegen Rundung).</li>` : ''}</ul>` +
    (showExpl ? `<div class="rdout ${r.ok ? 'ok' : 'bad'}"><b>Lösung:</b> ${esc(solText(q))}<br><br><b>Lösungsweg:</b> ${esc(q.expl)}</div>` : '<div class="rdout bad">🎓 Prüfmodus: Den Lösungsweg gibt es erst, wenn die Aufgabe richtig gelöst ist. Nutze einen Tipp oder versuche es noch einmal.</div>');

  function renderTasks(top) {
    const V = $('#taskView'), d = done(), prog = lsGet('prog', {}), t = curTask(), n100 = TASKS.filter(x => d[x.id]).length; let h = '';
    if (t) {
      const q = S.tq, r = S.tRes && S.tRes.id === t.id ? S.tRes : null, a = S.tAns[t.id] || {};
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv">${dots(t.level)}</div>${qText(q.text)}${qBody(q, a, r, 'tk')}`;
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
      <div class="card pl"><h4>${esc(q.cat)} · <span class="lv">${dots(q.level)}</span></h4><div class="big">${esc(q.title)}</div>${qText(q.text)}${qBody(q, T.ans, T.res, 'rt')}
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
    if (e.tab === 'pc') return pcOut(pcParams(Object.fromEntries(Object.keys(p).map(k => [k, sc(p[k])]))));
    if (e.tab === 'raid') return raidOutFor(p.level, p.n, p.s, p.failed) + `<div class="inst">${raidSvg(p.level, p.n, p.s, p.failed)}</div>`;
    if (e.tab === 'kfg') return kfgOut(p);
    if (e.tab === 'bit') return bitOut(Object.assign({}, S.bit, { v: sc(p.v), u: p.u, fs: sc(p.fs), fu: p.fu, fi: p.fi, fr: '' }));
    return diagBody(p.tree, p.path, false);
  }
  function renderBsp() {
    $('#bspView').innerHTML = `<p class="hint2" style="margin:0 0 8px">Fertig durchgerechnete Beispiele (Übungswerte). Mit „In den Rechner laden“ öffnest du die Zahlen im passenden Reiter und kannst sie verändern.</p>` + D.examples.map(e => `<div class="card pl" id="ex_${e.id}"><h4>Beispiel</h4><div class="big">${esc(e.title)}</div><p style="margin:4px 0 8px">${esc(e.text)}</p>${exBody(e)}<div class="btns"><button class="btn pri" data-ex="${e.id}">In den Rechner laden</button></div></div>`).join('');
  }
  function loadExample(x) {
    const p = x.p;
    if (x.tab === 'pc') { S.pc = Object.fromEntries(Object.keys(p).map(k => [k, sc(p[k])])); lsSet('pc', S.pc); }
    else if (x.tab === 'raid') { S.raid = { level: p.level, n: sc(p.n), s: sc(p.s), failed: p.failed.slice() }; lsSet('raid', S.raid); }
    else if (x.tab === 'kfg') { S.kfg = Object.assign({}, p); lsSet('kfg', S.kfg); }
    else if (x.tab === 'bit') { S.bit = { v: sc(p.v), u: p.u, fs: sc(p.fs), fu: p.fu, fi: p.fi, fr: '' }; lsSet('bit', S.bit); }
    else { S.diag = { tree: p.tree, path: p.path.slice() }; lsSet('diag', S.diag); }
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
      sec('PC-Aufbau und Netzteil', `<p><b>Prozessor</b> rechnet, <b>Arbeitsspeicher</b> hält laufende Programme (flüchtig), <b>Mainboard</b> verbindet alles, der <b>Chipsatz</b> verteilt Datenwege, der <b>Sockel</b> nimmt den Prozessor auf, das <b>Netzteil</b> liefert 12 V, 5 V und 3,3 V.</p><span class="eq">Gesamtleistung = CPU + GPU + Mainboard + Σ(Anzahl · Leistung)</span><span class="eq">Netzteil ≥ Gesamtleistung · 1,3, dann nächste Normgröße</span><table><tr><th>Übungswert</th><th>Leistung</th></tr><tr><td>Mainboard</td><td>${C.LOAD.mb} W</td></tr><tr><td>RAM-Riegel</td><td>${C.LOAD.ram} W</td></tr><tr><td>SSD</td><td>${C.LOAD.ssd} W</td></tr><tr><td>Festplatte</td><td>${C.LOAD.hdd} W</td></tr><tr><td>Lüfter</td><td>${C.LOAD.fan} W</td></tr></table><span class="eq">Wirkungsgrad η = Abgabe / Aufnahme · Verlust = Aufnahme − Abgabe</span><span class="eq">Kühlung: T = Umgebung + P · Rth (Rth in K/W)</span><p>Der <b>TDP</b>-Wert ist die Wärmeleistung, die der Kühler abführen muss. Jede elektrische Leistung wird im Rechner letztlich zu Wärme.</p>`, true) +
      sec('Speicher und RAID', `<table><tr><th>Stufe</th><th>Mindestens</th><th>Nutzbar</th><th>Ausfälle</th></tr><tr><td>RAID 0</td><td>2</td><td>n · s</td><td>0</td></tr><tr><td>RAID 1</td><td>2</td><td>s</td><td>n − 1</td></tr><tr><td>RAID 5</td><td>3</td><td>(n − 1) · s</td><td>1</td></tr><tr><td>RAID 6</td><td>4</td><td>(n − 2) · s</td><td>2</td></tr><tr><td>RAID 10</td><td>4 (gerade)</td><td>n / 2 · s</td><td>1 je Spiegelpaar</td></tr></table><p><b>HDD:</b> Scheiben und Köpfe, viel Platz je Euro. <b>SSD (SATA):</b> Flash, bis etwa 600 MB/s. <b>NVMe (M.2):</b> Flash über PCIe, mehrere GB/s. RAID erhöht die Verfügbarkeit, ersetzt aber <b>kein Backup</b>.</p>`) +
      sec('Schnittstellen und Datenraten', `<table><tr><th>Schnittstelle</th><th>Signalrate</th><th>Übungs-Höchstrate</th></tr>${C.IFACES.map(x => `<tr><td>${esc(x.n)}</td><td>${esc(x.gbit < 1 ? f(x.gbit * 1000, 0) + ' Mbit/s' : f(x.gbit, 1) + ' Gbit/s')}</td><td>${esc(f(x.mbs, 0))} MB/s</td></tr>`).join('')}</table><table><tr><th>PCIe</th><th>je Lane</th></tr><tr><td>2.0</td><td>0,5 GB/s</td></tr><tr><td>3.0</td><td>1 GB/s</td></tr><tr><td>4.0</td><td>2 GB/s</td></tr><tr><td>5.0</td><td>4 GB/s</td></tr></table><span class="eq">1 Byte = 8 Bit · MB/s = Mbit/s / 8</span><span class="eq">Dauer = Größe / Rate (1 GB = 1.000 MB)</span><p>Eine Lane ist ein Leitungspaar je Richtung. Ein Steckplatz mit x4 hat vier Lanes. Die Steckerform (z. B. USB-C) sagt nichts über die Datenrate.</p>`) +
      sec('BIOS und UEFI', `<p>Die Firmware startet den <b>POST</b> (Selbsttest), initialisiert die Hardware und übergibt über die <b>Bootreihenfolge</b> an das Betriebssystem. Einstellungen liegen im CMOS-Speicher, gepuffert von einer Knopfzelle (CR2032). <b>UEFI</b> kennt GPT-Datenträger (auch über 2 TiB), Secure Boot und eine grafische Oberfläche. Das klassische BIOS startet MBR-Datenträger (Legacy/CSM). XMP/EXPO schaltet höhere Speichertaktraten frei.</p><span class="eq">Größe = 2^Bitbreite · Sektorgröße (MBR: 2³² · 512 Byte = 2 TiB)</span>`) +
      sec('Fehlersuche', `<p>Vorgehen: Symptom und Änderungen erfragen, einfach vor aufwendig prüfen, immer nur eine Änderung je Schritt, dokumentieren. Am geöffneten PC: Netzstecker ziehen, ESD-Schutz. Im Reiter Fehlersuche steigst du durch drei Entscheidungsbäume (PC startet nicht, No bootable device, Abstürze unter Last).</p>`) +
      sec('Zahlensysteme und Speichergrößen', `<table><tr><th>dezimal (SI)</th><th>binär (IEC)</th></tr><tr><td>1 kB = 1.000 Byte</td><td>1 KiB = 1.024 Byte</td></tr><tr><td>1 MB = 10⁶ Byte</td><td>1 MiB = 2²⁰ Byte</td></tr><tr><td>1 GB = 10⁹ Byte</td><td>1 GiB = 2³⁰ Byte = 1.073.741.824 Byte</td></tr><tr><td>1 TB = 10¹² Byte</td><td>1 TiB = 2⁴⁰ Byte</td></tr></table><p>Datenträger sind dezimal angegeben (500 GB ≈ 465,7 GiB), Arbeitsspeicher binär (16 GB meint 16 GiB). Hex-Ziffern: A = 10 bis F = 15; Binär-Stellenwerte 128, 64, 32, 16, 8, 4, 2, 1. Mit n Adressleitungen sind 2ⁿ Byte adressierbar (32 Bit = 4 GiB).</p>`) +
      sec('Strom und Kosten', `<span class="eq">Energie in kWh = Leistung in W · Zeit in h / 1.000</span><span class="eq">Kosten = Energie in kWh · Preis je kWh</span>`) +
      sec('Kompatibilität', `<p>Prüfreihenfolge: <b>Sockel</b> (Prozessor zum Mainboard), <b>Speichertyp</b> DDR4 oder DDR5 (zum Mainboard, nicht austauschbar) und Speichermenge, <b>Kühler</b> (Sockelliste und Leistung mindestens TDP), <b>Formfaktor</b> (ATX, mATX, ITX), <b>Höhe</b> des Kühlers und <b>Länge</b> der Grafikkarte im Gehäuse, <b>Netzteil</b> (Bedarf mit Reserve).</p>`) +
      `<p class="hint2">Zahlen und Begriffe sind Lehrbuch- und Übungswerte; Unsicheres ist im Quelltext mit PRUEFEN markiert.</p>`;
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'pc'; S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    ({ pc: renderPc, raid: renderRaid, kfg: renderKfg, bit: renderBit, diag: renderDiag, tasks: renderTasks, rt: renderTrainer, bsp: renderBsp, help: renderHelp })[t]();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'PC-Hardware-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = 'PC-Hardware-Lab: ' + T[2];
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
  $('#title').onclick = () => setTab('pc');
  $('#bMenu').onclick = () => {
    const rows = [['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung und Tipps'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Aufgaben mit Serien-Zähler'], ['bsp', 'Beispiele', 'Fertig durchgerechnete Beispiele zum Laden'], ['help', 'Hilfe und Formeln', 'PC, RAID, Schnittstellen, Einheiten, Fehlersuche'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben und Trainer-Serie auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
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
  root.HWL_LAB = { id: 'hwl', title: 'PC-Hardware-Lab', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.HWL_TASKS };

  /* Rauchtest für quelle/hwl/test_hwlcore.js (läuft nur, wenn der Test window.__HWL_TEST setzt) */
  root.HWL_UI = {
    smoke: function () {
      if (!root.__HWL_TEST) return 'nur im Test';
      try {
        TABS.forEach(t => setTab(t[0]));
        TASKS.forEach(t => {
          setTab('tasks'); startTask(t.id); const q = S.tq, k = q.ask.type;
          S.tAns[t.id] = {}; checkTask(t);
          S.tAns[t.id] = k === 'choice' ? { c: (q.ask.correct + 1) % q.ask.choices.length } : { v: '-12345' }; checkTask(t); renderTasks(false);
          S.tAns[t.id] = k === 'choice' ? { c: q.ask.correct } : { v: String(+q.value.toFixed(6)).replace('.', ',') }; S.tRes = null; checkTask(t);
          if (!S.tRes || !S.tRes.ok) throw new Error('Aufgabe ' + t.id + ': Musterlösung wird in der Oberfläche nicht akzeptiert');
          renderTasks(false); hintFor(q, t.id);
        });
        S.tr.level = 0; for (let k = 0; k < 40; k++) { newTrainer(); const q = S.tr.q; S.tr.ans = q.ask.type === 'choice' ? { c: q.ask.correct } : { v: String(+q.value.toFixed(6)).replace('.', ',') }; trainerCheck(); renderTrainer(); }
        D.examples.forEach(e => { loadExample(e); if (!exBody(e)) throw new Error('Beispiel ' + e.id + ' leer'); });
        S.raid.failed = [0, 1]; updateRaid(); S.raid.level = 10; S.raid.n = '5'; updateRaid(); S.raid.n = '4'; updateRaid();
        Object.keys(C.DB).forEach(k => { C.DB[k].forEach(x => { S.kfg[k] = x.id; updateKfg(); }); });
        S.bit.v = 'abc'; updateBit(); S.bit.fr = '250'; updateBit(); S.pc.cpu = 'x'; updatePc();
        D.treeIds.forEach(id => { S.diag.tree = id; S.diag.path = []; renderDiag(); for (let k = 0; k < 4; k++) { S.diag.path.push(0); renderDiag(); } });
        setTab('bsp'); setTab('help'); return 'ok';
      } catch (e) { return e && e.stack ? e.stack : String(e); }
    }
  };

  buildTabs(); updatePal(); setTab(TABS.some(x => x[0] === S.tab) ? S.tab : 'pc');
  /* Aufruf ?aufgabe=hwl1 (Startseite, Lernhefte) öffnet die Aufgabe, ?bsp die Beispiele (?bsp=psu1 springt zu einem Beispiel) */
  try {
    const qp = new URLSearchParams(location.search), qa = qp.get('aufgabe');
    if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); }
    else if (qp.has('bsp')) { setTab('bsp'); const el = $('#ex_' + (qp.get('bsp') || '').replace(/[^a-z0-9_]/gi, '')); if (el) el.scrollIntoView(); }
  } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
