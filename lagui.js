'use strict';
/* Tonfunk Lager-Lab: Oberfläche (Lab-Kennung 'lag').
   Reiter: Kennzahlen, Disposition, Bestellmenge, ABC-Analyse, Lager (Arten/Strategien), Aufgaben, Trainer, Beispiele, Hilfe.
   Module: lagcore.js (LAG_CORE, Rechenlogik), lagdata.js (LAG_DATA, LAG_TASKS: Aufgaben, Beispiele, Lagerarten).
   Speicher (Präfix lm4.lag.): tab, kz, dis, best, abc, org, done ({id:true} nur gelöste), prog ({id:Prozent}), hints, ctipps (nur Prüfmodus), exam ('1'), rt (Trainer).
   Tipp-Abzug (25 % je Stufe, höchstens 2 Stufen) gibt es nur im Prüfmodus; beim normalen Üben kosten Tipps nichts.
   Aufruf: laglab.html?aufgabe=lag1 öffnet die Aufgabe, laglab.html?bsp öffnet die Beispiele (?bsp=meld springt zu einem Beispiel). */
(function (root) {
  const C = root.LAG_CORE, D = root.LAG_DATA;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.lag.';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(LS + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} };
  const f = (v, d) => C.fmtN(v, d == null ? 2 : d, true), eur = v => f(v, 2) + ' €', P = s => C.parseDe(s);
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
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>Lager-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">lagcore.js oder lagdata.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks;

  /* ============================================================ Zustand */
  const TABS = [['kz', '📊', 'Kennzahlen'], ['dis', '📈', 'Disposition'], ['best', '🧮', 'Bestellmenge'], ['abc', '🔠', 'ABC-Analyse'], ['org', '🏭', 'Lager'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['bsp', '📖', 'Beispiele'], ['help', '📘', 'Hilfe']];
  const ABC0 = [['Netzteil', 1800, 25], ['Display', 500, 50], ['Platine', 3000, 3], ['Gehäuse', 1500, 4], ['Kabelbaum', 2500, 2], ['Lüfter', 1000, 3], ['Akku', 500, 5], ['Dichtung', 10000, 0.2], ['Karton', 3000, 0.5], ['Schrauben M8', 20000, 0.05]];
  const S = {
    tab: lsGet('tab', 'kz'),
    kz: Object.assign({ mode: 'ae', ab: '60000', eb: '100000', months: new Array(12).fill(''), use: '480000', rate: '6', costs: '12000' }, lsGet('kz', {})),
    dis: Object.assign({ daily: 40, lead: 8, safety: 120, qty: 800 }, lsGet('dis', {})),
    best: Object.assign({ D: '8000', K: '40', P: '25', q: '16', m: '' }, lsGet('best', {})),
    abc: Object.assign({ items: ABC0.map(a => ({ n: a[0], q: String(a[1]), p: String(a[2]).replace('.', ',') })), a: '80', b: '95' }, lsGet('abc', {})),
    org: Object.assign({ n: 0, ok: 0 }, lsGet('org', {})), oq: { i: -1, sel: -1 },
    task: null, tq: null, tAns: {}, tRes: null,
    tr: { q: null, ans: {}, res: null, level: 0 },
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {}))
  };
  if (!Array.isArray(S.kz.months) || S.kz.months.length !== 12) S.kz.months = new Array(12).fill('');
  if (!Array.isArray(S.abc.items)) S.abc.items = ABC0.map(a => ({ n: a[0], q: String(a[1]), p: String(a[2]) }));
  if (!['ae', 'm12'].includes(S.kz.mode)) S.kz.mode = 'ae';
  const R0 = (() => { const m = /[?&]seed=([^&]+)/.exec(location.search); return C.rng(m ? decodeURIComponent(m[1]) : String(Math.random()) + Date.now()); })();

  /* ============================================================ Bausteine */
  const box = (t, fm, res, cls) => `<div class="rdout ${cls || ''}"><span class="st">${esc(t)}</span>${fm ? esc(fm) + ' = ' : ''}<b>${esc(res)}</b></div>`;
  const note = (t, cls) => `<div class="rdout ${cls || 'warn'}">${esc(t)}</div>`;
  const inp = (k, label, val, unit, attr) => `<label class="f"><span>${esc(label)}${unit ? ' (' + esc(unit) + ')' : ''}</span><input ${attr || 'data-k'}="${k}" inputmode="decimal" autocomplete="off" value="${esc(val)}"></label>`;
  const nice = (r, n) => { const s = r / n, p = Math.pow(10, Math.floor(Math.log10(s))), m = s / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; };
  const num2 = v => (Number.isFinite(v) ? (Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10) : 0);
  /* Achsen für ein Diagramm: gibt SVG-Text für Gitter und Beschriftung zurück. g = {l,t,r,b,W,H,x0,x1,y0,y1} */
  function axes(g, xl, yl) {
    const X = v => g.l + (v - g.x0) / (g.x1 - g.x0) * (g.W - g.l - g.r), Y = v => g.H - g.b - (v - g.y0) / (g.y1 - g.y0) * (g.H - g.t - g.b);
    let s = '', ys = nice(g.y1 - g.y0, 4), xs = nice(g.x1 - g.x0, 6);
    for (let v = Math.ceil(g.y0 / ys) * ys; v <= g.y1 + 1e-9; v += ys) s += `<line class="g-grid" x1="${g.l}" x2="${g.W - g.r}" y1="${Y(v)}" y2="${Y(v)}"/><text class="g-lab m" x="${g.l - 5}" y="${Y(v) + 4}" text-anchor="end">${esc(f(v, 0))}</text>`;
    for (let v = Math.ceil(g.x0 / xs) * xs; v <= g.x1 + 1e-9; v += xs) s += `<line class="g-grid" x1="${X(v)}" x2="${X(v)}" y1="${g.t}" y2="${g.H - g.b}"/><text class="g-lab m" x="${X(v)}" y="${g.H - g.b + 15}" text-anchor="middle">${esc(f(v, 0))}</text>`;
    s += `<line class="g-ax" x1="${g.l}" x2="${g.W - g.r}" y1="${g.H - g.b}" y2="${g.H - g.b}"/><line class="g-ax" x1="${g.l}" x2="${g.l}" y1="${g.t}" y2="${g.H - g.b}"/>`;
    s += `<text class="g-lab m" x="${(g.l + g.W - g.r) / 2}" y="${g.H - 4}" text-anchor="middle">${esc(xl)}</text><text class="g-lab m" x="12" y="${(g.t + g.H - g.b) / 2}" text-anchor="middle" transform="rotate(-90 12 ${(g.t + g.H - g.b) / 2})">${esc(yl)}</text>`;
    return { s, X, Y };
  }

  /* ============================================================ Kennzahlen */
  function kzParams(s) { return { mode: s.mode, ab: P(s.ab), eb: P(s.eb), months: s.months.map(P), use: P(s.use), rate: P(s.rate), costs: P(s.costs) }; }
  function kzOut(p) {
    const k = C.kennzahlen(p), ae = p.mode === 'ae';
    if (!(k.avg >= 0)) return note(ae ? 'Bitte Anfangs- und Endbestand als Zahlen eingeben (nicht negativ).' : 'Bitte Anfangsbestand und alle 12 Monatsendbestände als Zahlen eingeben.');
    const sum = ae ? p.ab + p.eb : p.ab + p.months.reduce((a, b) => a + b, 0);
    let h = box('1. Durchschnittlicher Lagerbestand', ae ? '(Anfangsbestand + Endbestand) / 2 = (' + f(p.ab, 0) + ' + ' + f(p.eb, 0) + ') / 2' : '(Anfangsbestand + 12 Monatsendbestände) / 13 = ' + f(sum, 0) + ' / 13', eur(k.avg));
    if (!(p.use >= 0)) return h + note('Gib den Jahresverbrauch (Wareneinsatz) ein, dann geht es weiter.');
    if (!(k.turnover > 0)) return h + note(k.avg === 0 ? 'Der durchschnittliche Lagerbestand ist 0, die Umschlagshäufigkeit ist deshalb nicht berechenbar.' : 'Bei einem Verbrauch von 0 gibt es keine Umschlagshäufigkeit und keine Lagerdauer.');
    h += box('2. Umschlagshäufigkeit', 'Jahresverbrauch / Ø Lagerbestand = ' + f(p.use, 0) + ' / ' + f(k.avg, 0), f(k.turnover, 2) + ' mal pro Jahr');
    h += box('3. Durchschnittliche Lagerdauer', '360 / Umschlagshäufigkeit = 360 / ' + f(k.turnover, 2), f(k.days, 1) + ' Tage');
    if (p.rate >= 0) {
      h += box('4. Lagerzinssatz', 'Jahreszinssatz · Lagerdauer / 360 = ' + f(p.rate, 2) + ' % · ' + f(k.days, 1) + ' / 360', f(k.stockRate, 2) + ' %');
      h += box('5. Lagerzinsen je Jahr', 'Wareneinsatz · Lagerzinssatz / 100 = ' + f(p.use, 0) + ' · ' + f(k.stockRate, 2) + ' / 100', eur(k.interest)) + `<p class="hint2">Kontrolle: Ø Lagerbestand · Jahreszinssatz / 100 = ${esc(eur(C.interestYear(k.avg, p.rate)))}.</p>`;
    }
    if (p.costs >= 0) {
      h += box('6. Lagerkostensatz', 'Lagerkosten / Ø Lagerbestand · 100 = ' + f(p.costs, 0) + ' / ' + f(k.avg, 0) + ' · 100', f(k.costRate, 2) + ' %');
      if (p.rate >= 0) h += box('7. Lagerhaltungskostensatz', '(Lagerkosten + Lagerzinsen) / Ø Lagerbestand · 100 = (' + f(p.costs, 0) + ' + ' + f(k.interest, 0) + ') / ' + f(k.avg, 0) + ' · 100', f(k.holdingRate, 2) + ' %');
    }
    return h;
  }
  const MON = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  function renderKz() {
    const s = S.kz, ae = s.mode === 'ae';
    $('#kzView').innerHTML = `<div class="card pl"><h4>Lagerkennzahlen berechnen</h4>
      <div class="fbar"><div class="seg">${[['ae', 'Anfang / Ende'], ['m12', '12 Monate']].map(m => `<button data-mode="${m[0]}" class="${s.mode === m[0] ? 'on' : ''}">${m[1]}</button>`).join('')}</div></div>
      <div class="dsrow">${inp('ab', 'Jahresanfangsbestand', s.ab, '€')}${ae ? inp('eb', 'Jahresendbestand', s.eb, '€') : ''}</div>
      ${ae ? '' : `<div class="mgrid">${MON.map((m, i) => `<label><span>${m} (Endbestand €)</span><input data-mo="${i}" inputmode="decimal" autocomplete="off" value="${esc(s.months[i])}"></label>`).join('')}</div>`}
      <div class="dsrow">${inp('use', 'Jahresverbrauch (Wareneinsatz)', s.use, '€')}${inp('rate', 'Jahreszinssatz', s.rate, '%')}${inp('costs', 'Lagerkosten je Jahr', s.costs, '€')}</div>
      <p class="hint2">Zahlen mit Komma oder Punkt eingeben. Jahreszinssatz und Lagerkosten sind optional.</p></div><div id="kzOut"></div>`;
    updateKz();
  }
  function updateKz() { $('#kzOut').innerHTML = kzOut(kzParams(S.kz)); }
  $('#kzView').addEventListener('input', e => { const k = e.target.dataset.k, m = e.target.dataset.mo; if (k) S.kz[k] = e.target.value; else if (m != null) S.kz.months[+m] = e.target.value; else return; lsSet('kz', S.kz); updateKz(); });
  $('#kzView').addEventListener('click', e => { const b = e.target.closest('[data-mode]'); if (b) { S.kz.mode = b.dataset.mode; lsSet('kz', S.kz); renderKz(); } });

  /* ============================================================ Disposition */
  function disOut(p) {
    const meld = C.reorderPoint(p.daily, p.lead, p.safety), mx = C.maxStock(p.safety, p.qty), rh = C.rhythm(p.qty, p.daily);
    let h = box('Meldebestand (Bestellpunkt)', 'Tagesverbrauch · Lieferzeit + Sicherheitsbestand = ' + f(p.daily, 1) + ' · ' + f(p.lead, 0) + ' + ' + f(p.safety, 0), f(meld, 1) + ' Stück');
    h += box('Höchstbestand', 'Sicherheitsbestand + Bestellmenge = ' + f(p.safety, 0) + ' + ' + f(p.qty, 0), f(mx, 0) + ' Stück');
    h += box('Bestellrhythmus', 'Bestellmenge / Tagesverbrauch = ' + f(p.qty, 0) + ' / ' + f(p.daily, 1), Number.isFinite(rh) ? f(rh, 1) + ' Tage' : 'nicht berechenbar');
    if (Number.isFinite(rh) && p.lead > rh) h += note('Die Lieferzeit (' + f(p.lead, 0) + ' Tage) ist länger als der Bestellrhythmus (' + f(rh, 1) + ' Tage): Es ist immer schon eine Bestellung unterwegs. Der Meldebestand liegt über dem Höchstbestand. Erhöhe die Bestellmenge oder bestelle früher.');
    return h;
  }
  function sawSvg(p) {
    const w = C.sawtooth(p, 3); if (!w.pts.length) return '';
    const W = 640, H = 300, g = { l: 52, t: 18, r: 14, b: 38, W, H, x0: 0, y0: 0, x1: w.T * 3, y1: w.max * 1.15 }, A = axes(g, 'Zeit in Tagen', 'Bestand in Stück'), X = A.X, Y = A.Y;
    let s = A.s;
    w.orders.forEach(o => { s += `<rect class="g-lead" x="${X(o[0])}" y="${g.t}" width="${Math.max(1, X(o[0] + p.lead) - X(o[0]))}" height="${H - g.b - g.t}"/>`; });
    s += `<line class="g-max" x1="${g.l}" x2="${W - g.r}" y1="${Y(w.max)}" y2="${Y(w.max)}"/><line class="g-meld" x1="${g.l}" x2="${W - g.r}" y1="${Y(w.meld)}" y2="${Y(w.meld)}"/><line class="g-sich" x1="${g.l}" x2="${W - g.r}" y1="${Y(p.safety)}" y2="${Y(p.safety)}"/>`;
    s += `<polyline class="g-saw" points="${w.pts.map(q => X(q[0]).toFixed(1) + ',' + Y(q[1]).toFixed(1)).join(' ')}"/>`;
    w.orders.forEach(o => { s += `<circle cx="${X(o[0])}" cy="${Y(o[1])}" r="5" fill="var(--hi)" stroke="var(--bg)" stroke-width="1.5"/>`; });
    const lab = (y, t, c, dy) => `<text class="g-lab" x="${W - g.r - 4}" y="${Y(y) + dy}" text-anchor="end" fill="${c}" style="fill:${c}">${esc(t)}</text>`;
    s += lab(w.max, 'Höchstbestand ' + f(w.max, 0), 'var(--ok)', -5) + lab(w.meld, 'Meldebestand ' + f(w.meld, 0), 'var(--hi)', -5) + lab(p.safety, 'Sicherheitsbestand ' + f(p.safety, 0), 'var(--danger)', p.safety > 0 && Y(p.safety) < H - g.b - 14 ? 14 : -5);
    if (w.orders.length) s += `<text class="g-lab" x="${X(w.orders[0][0]) + 7}" y="${Y(w.orders[0][1]) - 8}" style="fill:var(--hi)">Bestellung</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Lagerbestandskurve als Sägezahn mit Meldebestand, Sicherheitsbestand und Höchstbestand">${s}</svg>`;
  }
  const SL = [['daily', 'Tagesverbrauch', 'Stück/Tag', 1, 100, 1], ['lead', 'Lieferzeit', 'Tage', 1, 30, 1], ['safety', 'Sicherheitsbestand', 'Stück', 0, 400, 10], ['qty', 'Bestellmenge', 'Stück', 50, 2000, 50]];
  function renderDis() {
    $('#disView').innerHTML = `<div class="card pl"><h4>Lagerbestandskurve</h4><div id="disSvg" class="inst"></div>
      <p class="hint2"><span style="color:var(--hi)">●</span> Bestellung bei Meldebestand, der getönte Streifen ist die Lieferzeit. Die Lieferung kommt an, wenn der Bestand beim Sicherheitsbestand angekommen ist.</p></div>
      <div class="card pl"><h4>Regler</h4>${SL.map(r => `<label class="f"><span>${r[1]}: <b id="dv_${r[0]}"></b> ${r[2]}</span><input type="range" data-d="${r[0]}" min="${r[3]}" max="${r[4]}" step="${r[5]}" value="${S.dis[r[0]]}"></label>`).join('')}</div><div id="disOut"></div>`;
    updateDis();
  }
  function updateDis() {
    const p = S.dis; SL.forEach(r => { const e = $('#dv_' + r[0]); if (e) e.textContent = f(p[r[0]], 0); });
    $('#disSvg').innerHTML = sawSvg(p); $('#disOut').innerHTML = disOut(p);
  }
  $('#disView').addEventListener('input', e => { const k = e.target.dataset.d; if (!k) return; S.dis[k] = +e.target.value; lsSet('dis', S.dis); updateDis(); });

  /* ============================================================ Bestellmenge (Andler) */
  const bestParams = s => ({ D: P(s.D), K: P(s.K), P: P(s.P), q: P(s.q), m: s.m === '' ? NaN : P(s.m) });
  function bestOut(p) {
    const mo = C.andler(p.D, p.K, p.P, p.q);
    if (!Number.isFinite(mo)) return note('Jahresbedarf und Bestellkosten müssen Zahlen ab 0 sein, Einstandspreis und Lagerhaltungskostensatz müssen größer als 0 sein.');
    const n = C.ordersPerYear(p.D, mo), b = C.costOrder(p.D, p.K, mo), l = C.costStore(mo, p.P, p.q);
    let h = box('Optimale Bestellmenge (Andler)', 'm_opt = √(200 · ' + f(p.D, 0) + ' · ' + f(p.K, 2) + ' / (' + f(p.P, 2) + ' · ' + f(p.q, 2) + '))', f(mo, 1) + ' Stück');
    if (p.D > 0) h += box('Bestellungen je Jahr / Rhythmus', 'Jahresbedarf / m_opt = ' + f(p.D, 0) + ' / ' + f(mo, 1), f(n, 1) + ' Bestellungen, alle ' + f(360 / n, 0) + ' Tage');
    h += box('Kosten bei m_opt', 'Bestellkosten ' + eur(b) + ' + Lagerkosten ' + eur(l), eur(b + l)) + '<p class="hint2">Im Optimum sind Bestellkosten und Lagerkosten gleich groß.</p>';
    if (p.m > 0) { const b2 = C.costOrder(p.D, p.K, p.m), l2 = C.costStore(p.m, p.P, p.q); h += box('Kosten bei deiner Menge ' + f(p.m, 0) + ' Stück', 'Bestellkosten ' + eur(b2) + ' + Lagerkosten ' + eur(l2), eur(b2 + l2)) + `<p class="hint2">Gegenüber dem Optimum: ${esc(eur(b2 + l2 - b - l))} ${b2 + l2 - b - l >= 0 ? 'mehr' : 'weniger'}.</p>`; }
    return h;
  }
  function costSvg(p) {
    const mo = C.andler(p.D, p.K, p.P, p.q); if (!(mo > 0)) return '';
    const own = p.m > 0 ? p.m : 0, x0 = Math.min(mo * 0.35, own ? own * 0.9 : Infinity), x1 = Math.max(mo * 2.5, own * 1.1), cu = C.costCurve(p.D, p.K, p.P, p.q, x0, x1, 80), W = 640, H = 300;
    const ym = Math.max.apply(null, cu.map(q => q.g)) * 1.05, g = { l: 56, t: 14, r: 14, b: 38, W, H, x0, x1, y0: 0, y1: ym }, A = axes(g, 'Bestellmenge in Stück', 'Kosten je Jahr in €'), X = A.X, Y = A.Y;
    const line = (k, c) => `<polyline class="${c}" points="${cu.map(q => X(q.m).toFixed(1) + ',' + Y(q[k]).toFixed(1)).join(' ')}"/>`;
    let s = A.s + line('b', 'g-cb') + line('l', 'g-cl') + line('g', 'g-cg');
    s += `<line class="g-opt" x1="${X(mo)}" x2="${X(mo)}" y1="${g.t}" y2="${H - g.b}"/><text class="g-lab" x="${X(mo) + 5}" y="${g.t + 12}">m_opt ≈ ${esc(f(mo, 0))}</text>`;
    if (own) s += `<line class="g-opt" style="stroke:var(--warn)" x1="${X(own)}" x2="${X(own)}" y1="${g.t}" y2="${H - g.b}"/><text class="g-lab" style="fill:var(--warn)" x="${X(own) + 5}" y="${g.t + 26}">deine Menge ${esc(f(own, 0))}</text>`;
    s += `<g class="g-lab"><line x1="${g.l + 8}" x2="${g.l + 30}" y1="${H - g.b - 52}" y2="${H - g.b - 52}" class="g-cb"/><text x="${g.l + 36}" y="${H - g.b - 48}">Bestellkosten</text><line x1="${g.l + 8}" x2="${g.l + 30}" y1="${H - g.b - 36}" y2="${H - g.b - 36}" class="g-cl"/><text x="${g.l + 36}" y="${H - g.b - 32}">Lagerkosten</text><line x1="${g.l + 8}" x2="${g.l + 30}" y1="${H - g.b - 20}" y2="${H - g.b - 20}" class="g-cg"/><text x="${g.l + 36}" y="${H - g.b - 16}">Gesamtkosten</text></g>`;
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Kostenkurven: Bestellkosten fallen, Lagerkosten steigen, Gesamtkosten haben ihr Minimum bei der optimalen Bestellmenge">${s}</svg>`;
  }
  function renderBest() {
    const s = S.best;
    $('#bestView').innerHTML = `<div class="card pl"><h4>Optimale Bestellmenge nach Andler</h4><div class="dsrow">${inp('D', 'Jahresbedarf', s.D, 'Stück')}${inp('K', 'Bestellkosten je Bestellung', s.K, '€')}${inp('P', 'Einstandspreis je Stück', s.P, '€')}${inp('q', 'Lagerhaltungskostensatz', s.q, '%')}${inp('m', 'Eigene Bestellmenge zum Vergleich (optional)', s.m, 'Stück')}</div></div>
      <div class="card pl"><h4>Kostenkurven</h4><div id="bestSvg" class="inst"></div></div><div id="bestOut"></div>`;
    updateBest();
  }
  function updateBest() { const p = bestParams(S.best); $('#bestSvg').innerHTML = costSvg(p); $('#bestOut').innerHTML = bestOut(p); }
  $('#bestView').addEventListener('input', e => { const k = e.target.dataset.k; if (!k) return; S.best[k] = e.target.value; lsSet('best', S.best); updateBest(); });

  /* ============================================================ ABC-Analyse */
  const abcItems = () => S.abc.items.map(i => ({ name: i.n, qty: P(i.q), price: P(i.p) }));
  const abcLim = () => { const a = P(S.abc.a), b = P(S.abc.b); return a > 0 && b > a && b <= 100 ? { a, b: b - a } : null; };
  const STRAT = { A: 'A: hoher Wertanteil, wenig Artikel. Genau planen, bedarfsgenau beschaffen, kleine Bestände, Bestand eng überwachen.', B: 'B: mittlere Bedeutung. Bestellpunkt-Verfahren mit mäßigem Kontrollaufwand.', C: 'C: geringer Wertanteil, viele Artikel. Einfache Verfahren, größere Mengen auf Vorrat, wenig Kontrolle.' };
  function abcTable(r) {
    let h = `<div class="tw"><table class="tt"><tr><th class="n">Rang</th><th>Artikel</th><th class="n">Jahreswert</th><th class="n">Anteil</th><th class="n">kumuliert</th><th>Klasse</th></tr>`;
    r.rows.forEach(x => { h += `<tr><td class="n">${x.rank}</td><td>${esc(x.name || '–')}</td><td class="n">${esc(eur(x.value))}</td><td class="n">${esc(f(x.share, 1))} %</td><td class="n">${esc(f(x.cum, 1))} %</td><td><span class="badge cl-${x.cls}">${x.cls}</span></td></tr>`; });
    h += `<tr><td></td><td><b>Gesamt</b></td><td class="n"><b>${esc(eur(r.total))}</b></td><td class="n">100 %</td><td></td><td></td></tr></table></div>`;
    h += `<div class="tw"><table class="tt"><tr><th>Klasse</th><th class="n">Artikel</th><th class="n">Anteil Artikel</th><th class="n">Wertanteil</th></tr>${['A', 'B', 'C'].map(c => { const k = r.classes[c]; return `<tr><td><span class="badge cl-${c}">${c}</span></td><td class="n">${k.n}</td><td class="n">${esc(f(k.nShare, 0))} %</td><td class="n">${esc(f(k.share, 1))} %</td></tr>`; }).join('')}</table></div>`;
    return h;
  }
  function abcSvg(r) {
    const n = r.rows.length; if (!n || !(r.total > 0)) return '';
    const W = 640, H = 300, l = 44, rr = 40, t = 16, b = 64, pw = W - l - rr, ph = H - t - b, bw = pw / n, mx = Math.max.apply(null, r.rows.map(x => x.share)) * 1.1;
    const Yb = v => t + ph - v / mx * ph, Yc = v => t + ph - v / 100 * ph;
    let s = `<line class="g-ax" x1="${l}" x2="${W - rr}" y1="${t + ph}" y2="${t + ph}"/><line class="g-ax" x1="${l}" x2="${l}" y1="${t}" y2="${t + ph}"/><line class="g-ax" x1="${W - rr}" x2="${W - rr}" y1="${t}" y2="${t + ph}"/>`;
    [0, 25, 50, 75, 100].forEach(v => { s += `<line class="g-grid" x1="${l}" x2="${W - rr}" y1="${Yc(v)}" y2="${Yc(v)}"/><text class="g-lab m" x="${W - rr + 5}" y="${Yc(v) + 4}">${v} %</text>`; });
    const ls = abcLim() || { a: 80, b: 15 };
    [[ls.a, 'A'], [ls.a + ls.b, 'B']].forEach(q => { s += `<line class="g-meld" x1="${l}" x2="${W - rr}" y1="${Yc(q[0])}" y2="${Yc(q[0])}"/>`; });
    r.rows.forEach((x, i) => { const bh = Math.max(1, t + ph - Yb(x.share)); s += `<rect class="c${x.cls}" x="${l + i * bw + bw * 0.12}" y="${Yb(x.share)}" width="${bw * 0.76}" height="${bh}" rx="2"/>`; });
    s += `<polyline fill="none" stroke="var(--fg)" stroke-width="2" points="${r.rows.map((x, i) => (l + i * bw + bw / 2).toFixed(1) + ',' + Yc(x.cum).toFixed(1)).join(' ')}"/>`;
    r.rows.forEach((x, i) => { const cx = l + i * bw + bw / 2; s += `<text class="g-lab m" font-size="10" text-anchor="end" transform="translate(${cx + 3} ${t + ph + 8}) rotate(-40)">${esc((x.name || '–').slice(0, 14))}</text>`; });
    s += `<text class="g-lab m" x="${l - 4}" y="${t + 4}" text-anchor="end">${esc(f(mx, 0))} %</text><text class="g-lab m" x="${l}" y="${H - 4}">Balken: Wertanteil je Artikel (Skala links), Linie: kumuliert (Skala rechts), gestrichelt: Klassengrenzen</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="ABC-Analyse: Balken für den Wertanteil je Artikel und Linie für den kumulierten Anteil">${s}</svg>`;
  }
  function renderAbc() {
    const s = S.abc;
    $('#abcView').innerHTML = `<div class="card pl"><h4>Artikelliste (Jahresverbrauch)</h4><div class="tw"><table class="tt" id="abcIn"><tr><th>Artikel</th><th class="n">Menge</th><th class="n">Preis €</th><th></th></tr>${s.items.map((it, i) => abcRow(it, i)).join('')}</table></div>
      <div class="btns"><button class="btn" data-ab="add">＋ Artikel</button><button class="btn" data-ab="reset">Beispiel laden</button></div>
      <div class="dsrow" style="margin-top:10px">${inp('a', 'A bis kumuliert', s.a, '%', 'data-g')}${inp('b', 'B bis kumuliert', s.b, '%', 'data-g')}</div><p class="hint2">Üblich sind 80 % und 95 % (also A = 80 %, B = 15 %, C = 5 %). Ein Artikel gehört zu der Klasse, in der sein kumulierter Anteil (einschließlich seiner selbst) liegt; die Grenze gehört zur besseren Klasse.</p></div><div id="abcOut"></div>`;
    updateAbc();
  }
  const abcRow = (it, i) => `<tr><td><input data-i="${i}" data-f="n" value="${esc(it.n)}" aria-label="Artikelname" autocomplete="off"></td><td><input data-i="${i}" data-f="q" inputmode="decimal" value="${esc(it.q)}" aria-label="Menge" autocomplete="off"></td><td><input data-i="${i}" data-f="p" inputmode="decimal" value="${esc(it.p)}" aria-label="Preis" autocomplete="off"></td><td><button class="ib" data-del="${i}" aria-label="Artikel löschen">✕</button></td></tr>`;
  function updateAbc() {
    const lim = abcLim(), r = C.abc(abcItems(), lim || { a: 80, b: 15 });
    let h = lim ? '' : note('Die Grenzen müssen so liegen: 0 < A < B ≤ 100. Bis dahin gelten 80 % und 95 %.');
    h += `<div class="card pl"><h4>Ergebnis</h4>${r.rows.length ? abcTable(r) : '<p class="hint2">Trage Artikel ein.</p>'}</div>`;
    const sv = abcSvg(r); if (sv) h += `<div class="card pl"><h4>Diagramm</h4><div class="inst">${sv}</div><p class="hint2"><span style="color:#e5484d">■</span> A <span style="color:#f5a524">■</span> B <span style="color:#3b9eff">■</span> C</p></div>`;
    h += `<div class="card pl"><h4>Strategie je Klasse</h4>${['A', 'B', 'C'].map(c => `<div class="rdout">${esc(STRAT[c])}</div>`).join('')}</div>`;
    $('#abcOut').innerHTML = h;
  }
  $('#abcView').addEventListener('input', e => {
    const i = e.target.dataset.i, fl = e.target.dataset.f, g = e.target.dataset.g;
    if (g) S.abc[g] = e.target.value; else if (i != null && fl) S.abc.items[+i][fl] = e.target.value; else return;
    lsSet('abc', S.abc); updateAbc();
  });
  $('#abcView').addEventListener('click', e => {
    const d = e.target.closest('[data-del]'), a = e.target.closest('[data-ab]');
    if (d) { S.abc.items.splice(+d.dataset.del, 1); lsSet('abc', S.abc); renderAbc(); }
    else if (a && a.dataset.ab === 'add') { S.abc.items.push({ n: 'Artikel ' + (S.abc.items.length + 1), q: '100', p: '1' }); lsSet('abc', S.abc); renderAbc(); }
    else if (a && a.dataset.ab === 'reset') { S.abc.items = ABC0.map(x => ({ n: x[0], q: String(x[1]), p: String(x[2]).replace('.', ',') })); S.abc.a = '80'; S.abc.b = '95'; lsSet('abc', S.abc); renderAbc(); }
  });

  /* ============================================================ Lager: Arten, Prinzipien, Zuordnungsübung */
  function renderOrg() {
    let h = `<div class="card pl"><h4>Zuordnungsübung</h4><div id="orgQ"></div></div><div class="dt">`, last = '';
    D.org.forEach(o => {
      if (o.g !== last) { if (last) h += '</div>'; last = o.g; h += `<div class="gh">${esc(o.g)}</div><div>`; }
      h += `<details><summary>${esc(o.n)}</summary><div class="hb2"><p>${esc(o.d)}</p><p><b style="color:var(--ok)">Vorteile</b></p><ul>${o.pro.map(x => '<li>' + esc(x) + '</li>').join('')}</ul><p><b style="color:var(--danger)">Nachteile</b></p><ul>${o.con.map(x => '<li>' + esc(x) + '</li>').join('')}</ul></div></details>`;
    });
    $('#orgView').innerHTML = h + '</div></div>'; if (S.oq.i < 0) newOrgQ(); else renderOrgQ();
  }
  function newOrgQ() { S.oq = { i: Math.floor(R0() * D.org.length), sel: -1 }; renderOrgQ(); }
  function renderOrgQ() {
    const o = D.org[S.oq.i], pool = D.org.filter(x => x.g === o.g), opts = C.shuffle(C.rng('oq' + S.oq.i + ':' + S.org.n), pool), done = S.oq.sel >= 0;
    $('#orgQ').innerHTML = `<p style="margin-top:0">Welcher Begriff passt? <b>${esc(o.d)}</b></p><div class="opts">${opts.map(x => `<button data-on="${esc(x.n)}" class="${done ? (x === o ? 'ok' : D.org[S.oq.sel] === x ? 'bad' : '') : ''}" ${done ? 'disabled' : ''}>${esc(x.n)}</button>`).join('')}</div>
      <p class="hint2">Richtig: <b>${S.org.ok}</b> von <b>${S.org.n}</b></p>${done ? `<div class="btns"><button class="btn pri" data-on="__next">Nächste Frage</button></div>` : ''}`;
  }
  $('#orgView').addEventListener('click', e => {
    const b = e.target.closest('[data-on]'); if (!b) return;
    if (b.dataset.on === '__next') { newOrgQ(); return; }
    const i = D.org.findIndex(x => x.n === b.dataset.on), right = i === S.oq.i; S.oq.sel = i; S.org.n++; if (right) { S.org.ok++; ding(); } else sad(); lsSet('org', S.org); renderOrgQ();
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
    h += `<p class="hint2" style="margin:4px 0 0">${n100} von ${TASKS.length} Aufgaben gelöst. ${exam() ? '🎓 Prüfmodus ist an.' : 'Tipp: Im Prüfmodus (🎓 oben) zählen Tipps als Abzug.'}</p>`;
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
  function hintFor(q, id, cnt, close) {
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

  /* Zufalls-Trainer */
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
    if (e.tab === 'kz') return kzOut({ mode: p.mode, ab: p.ab, eb: p.eb, months: p.months || [], use: p.use, rate: p.rate, costs: p.costs });
    if (e.tab === 'dis') return disOut(p) + `<div class="inst">${sawSvg(p)}</div>`;
    if (e.tab === 'best') return bestOut({ D: p.D, K: p.K, P: p.P, q: p.q, m: NaN }) + `<div class="inst">${costSvg({ D: p.D, K: p.K, P: p.P, q: p.q, m: NaN })}</div>`;
    const r = C.abc(p.items.map(i => ({ name: i.n, qty: i.q, price: i.p })), p.lim);
    return abcTable(r) + `<div class="inst">${abcSvg(r)}</div>`;
  }
  function renderBsp() {
    $('#bspView').innerHTML = `<p class="hint2" style="margin:0 0 8px">Fertig durchgerechnete Beispiele. Mit „In den Rechner laden“ öffnest du die Zahlen im passenden Reiter und kannst sie verändern.</p>` + D.examples.map(e => `<div class="card pl" id="ex_${e.id}"><h4>Beispiel</h4><div class="big">${esc(e.title)}</div><p style="margin:4px 0 8px">${esc(e.text)}</p>${exBody(e)}<div class="btns"><button class="btn pri" data-ex="${e.id}">In den Rechner laden</button></div></div>`).join('');
  }
  $('#bspView').addEventListener('click', e => {
    const b = e.target.closest('[data-ex]'); if (!b) return; const x = D.examples.find(z => z.id === b.dataset.ex), p = x.p, s = v => String(v).replace('.', ',');
    if (x.tab === 'kz') { S.kz = { mode: p.mode, ab: s(p.ab), eb: p.eb == null ? '' : s(p.eb), months: (p.months || []).length === 12 ? p.months.map(s) : new Array(12).fill(''), use: s(p.use), rate: s(p.rate), costs: s(p.costs) }; lsSet('kz', S.kz); }
    else if (x.tab === 'dis') { S.dis = Object.assign({}, p); lsSet('dis', S.dis); }
    else if (x.tab === 'best') { S.best = { D: s(p.D), K: s(p.K), P: s(p.P), q: s(p.q), m: '' }; lsSet('best', S.best); }
    else { S.abc = { items: p.items.map(i => ({ n: i.n, q: s(i.q), p: s(i.p) })), a: String(p.lim.a), b: String(p.lim.a + p.lim.b) }; lsSet('abc', S.abc); }
    setTab(x.tab); toast('Beispiel geladen: ' + x.title);
  });

  /* ============================================================ Hilfe */
  function renderHelp() {
    const sec = (t, b, open) => `<details${open ? ' open' : ''}><summary>${t}</summary><div class="hb2">${b}</div></details>`;
    $('#helpView').innerHTML =
      sec('Lagerkennzahlen', `<p>Alle Kennzahlen bauen aufeinander auf:</p><span class="eq">Ø Lagerbestand = (Jahresanfangsbestand + Jahresendbestand) / 2</span><span class="eq">Ø Lagerbestand = (Anfangsbestand + 12 Monatsendbestände) / 13</span><span class="eq">Umschlagshäufigkeit = Jahresverbrauch (Wareneinsatz) / Ø Lagerbestand</span><span class="eq">Ø Lagerdauer = 360 / Umschlagshäufigkeit</span><span class="eq">Lagerzinssatz = Jahreszinssatz · Lagerdauer / 360</span><span class="eq">Lagerzinsen = Wareneinsatz · Lagerzinssatz / 100</span><span class="eq">Lagerkostensatz = Lagerkosten / Ø Lagerbestand · 100</span><span class="eq">Lagerhaltungskostensatz = (Lagerkosten + Lagerzinsen) / Ø Lagerbestand · 100</span><p>Hohe Umschlagshäufigkeit heißt: kurze Lagerdauer, wenig gebundenes Kapital, geringe Lagerkosten. Das Zinsjahr hat 360 Tage.</p><p class="hint2">Hinweis für Ausbilder: Der Durchschnitt aus 13 Werten (Anfangsbestand und 12 Monatsendbestände) ist die in Lehrbüchern übliche Form; manche Schulen rechnen mit 12 Monatswerten. Bitte gegen das eingesetzte Lehrbuch prüfen.</p>`, true) +
      sec('Disposition: Melde-, Sicherheits-, Höchstbestand', `<span class="eq">Sicherheitsbestand = Tagesverbrauch · Sicherheitstage</span><span class="eq">Meldebestand = Tagesverbrauch · Lieferzeit + Sicherheitsbestand</span><span class="eq">Höchstbestand = Sicherheitsbestand + Bestellmenge</span><span class="eq">Bestellrhythmus (Tage) = Bestellmenge / Tagesverbrauch</span><span class="eq">Bestellungen je Jahr = Jahresbedarf / Bestellmenge</span><p>Der <b>Sicherheitsbestand</b> (eiserne Reserve) fängt Lieferverzug und höheren Verbrauch auf. Beim <b>Meldebestand</b> wird bestellt, damit die Ware ankommt, wenn nur noch der Sicherheitsbestand da ist. Der <b>Höchstbestand</b> ist die obere Grenze direkt nach der Lieferung.</p>`) +
      sec('Optimale Bestellmenge (Andler)', `<span class="eq">m_opt = √( 200 · Jahresbedarf · Bestellkosten je Bestellung / (Einstandspreis · Lagerhaltungskostensatz in %) )</span><span class="eq">Bestellkosten = Jahresbedarf / m · Kosten je Bestellung</span><span class="eq">Lagerkosten = m / 2 · Einstandspreis · Lagerhaltungskostensatz / 100</span><p>Große Bestellmengen sparen Bestellkosten, erhöhen aber die Lagerkosten. Die Gesamtkosten sind am kleinsten, wo beide Kosten gleich groß sind. Der Lagerhaltungskostensatz geht als Prozentzahl ein (16 für 16 %). Annahmen: gleichmäßiger Verbrauch, keine Mengenrabatte, feste Lieferzeit.</p>`) +
      sec('ABC-Analyse', `<p>Die Artikel werden nach ihrem <b>Jahreswert</b> (Menge · Preis) absteigend sortiert, der Wertanteil wird aufsummiert (kumuliert).</p><table><tr><th>Klasse</th><th>Üblicher Wertanteil</th><th>Üblicher Mengenanteil</th><th>Strategie</th></tr><tr><td>A</td><td>ca. 80 %</td><td>ca. 10–20 % der Artikel</td><td>genau planen, bedarfsgenau beschaffen, kleine Bestände, scharf überwachen</td></tr><tr><td>B</td><td>ca. 15 %</td><td>ca. 30 %</td><td>mittlerer Aufwand, Bestellpunkt-Verfahren</td></tr><tr><td>C</td><td>ca. 5 %</td><td>ca. 50–60 %</td><td>einfach, größere Mengen auf Vorrat, wenig Kontrolle</td></tr></table><p>Die Grenzen 80/95 % sind üblich, aber nicht genormt und im Rechner einstellbar. Die Grenze selbst gehört hier zur besseren Klasse (kumuliert genau 80 % ist noch A).</p>`) +
      sec('Lagerprinzipien, Lagerarten, Flurförderzeuge', `<p><b>FIFO</b>: zuerst eingelagert, zuerst entnommen (verderbliche Ware). <b>LIFO</b>: zuletzt eingelagert, zuerst entnommen (Schüttgut, Blocklager). <b>Chaotische Lagerhaltung</b>: freier Platz, EDV merkt sich den Ort. <b>Festplatz</b>: jeder Artikel hat seinen Platz.</p><p><b>Blocklager</b> (ohne Regal), <b>Regallager</b> (Zugriff auf jeden Platz), <b>Hochregallager</b> (sehr hoch, Regalbediengeräte). Vor- und Nachteile findest du im Reiter „Lager“.</p>`) +
      sec('Begriffe', `<table><tr><th>Begriff</th><th>Bedeutung</th></tr><tr><td>Wareneinsatz</td><td>Wert der im Jahr verbrauchten oder verkauften Ware (zu Einstandspreisen)</td></tr><tr><td>Einstandspreis</td><td>Preis, zu dem die Ware im Lager ankommt (Einkaufspreis plus Bezugskosten abzüglich Nachlässe)</td></tr><tr><td>Lagerkosten</td><td>Raum, Personal, Energie, Versicherung, Schwund, Technik</td></tr><tr><td>Lagerzinsen</td><td>Zinsen für das im Lager gebundene Kapital</td></tr><tr><td>Lieferzeit</td><td>Tage von der Bestellung bis zum Eintreffen</td></tr><tr><td>Bestellpunkt</td><td>anderes Wort für Meldebestand</td></tr></table>`) +
      `<p class="hint2">Nicht enthalten: Ladungssicherung und Gefahrgut (folgen in einem eigenen Lab). Zahlen und Begriffe sind Lehrbuchwerte; Unsicheres ist im Quelltext mit PRUEFEN markiert.</p>`;
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'kz'; S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    ({ kz: renderKz, dis: renderDis, best: renderBest, abc: renderAbc, org: renderOrg, tasks: renderTasks, rt: renderTrainer, bsp: renderBsp, help: renderHelp })[t]();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'Lager-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = 'Lager-Lab: ' + T[2];
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
  $('#title').onclick = () => setTab('kz');
  $('#bMenu').onclick = () => {
    const rows = [['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung und Tipps'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Aufgaben mit Serien-Zähler'], ['bsp', 'Beispiele', 'Fertig durchgerechnete Beispiele zum Laden'], ['help', 'Hilfe und Formeln', 'Kennzahlen, Disposition, Andler, ABC'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben und Trainer-Serie auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
    sheet('Menü', (b, close) => {
      b.innerHTML = rows.map(r => `<button class="row" data-m="${r[0]}"><div class="grow"><b>${esc(r[1])}</b><small>${esc(r[2])}</small></div></button>`).join('');
      b.addEventListener('click', e => { const r = e.target.closest('.row'); if (!r) return; close(); const m = r.dataset.m; if (m === 'home') location.href = 'index.html'; else if (m === 'exam') setExam(!exam()); else if (m === 'reset') resetAll(); else setTab(m); });
    });
  };
  function resetAll() {
    sheet('Fortschritt zurücksetzen?', (b, close) => {
      b.innerHTML = '<p style="margin-top:0">Alle gelösten Aufgaben, Tipps und die Trainer-Serie dieses Labs werden auf diesem Gerät gelöscht. Das kann nicht rückgängig gemacht werden.</p><div class="btns"><button class="btn" data-x="no">Abbrechen</button><button class="btn danger" data-x="yes">Löschen</button></div>';
      b.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (!x) return; if (x.dataset.x === 'yes') { ['done', 'prog', 'hints', 'ctipps', 'rt', 'org'].forEach(k => { try { localStorage.removeItem(LS + k); } catch (er) {} }); S.rt = { n: 0, ok: 0, streak: 0, best: 0 }; S.org = { n: 0, ok: 0 }; S.task = null; S.tRes = null; palSig = ''; updatePal(); updateBadge(); if (S.tab === 'tasks') renderTasks(); toast('Fortschritt gelöscht'); } close(); });
    });
  }

  /* Schnittstelle für Karriere/Lernpfad */
  root.LAG_LAB = { id: 'lag', title: 'Lager-Lab', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.LAG_TASKS };

  buildTabs(); updatePal(); setTab(TABS.some(x => x[0] === S.tab) ? S.tab : 'kz');
  /* Aufruf ?aufgabe=lag1 (Startseite, Lernhefte) öffnet die Aufgabe, ?bsp die Beispiele (?bsp=meld springt zu einem Beispiel) */
  try {
    const qp = new URLSearchParams(location.search), qa = qp.get('aufgabe');
    if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); }
    else if (qp.has('bsp')) { setTab('bsp'); const el = $('#ex_' + (qp.get('bsp') || '').replace(/[^a-z0-9_]/gi, '')); if (el) el.scrollIntoView(); }
  } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
