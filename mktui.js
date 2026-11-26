'use strict';
/* Tonfunk Marketing-Lab: Oberfläche (Lab-Kennung 'mkt'). Industriekaufleute, LF 9, 2. Lehrjahr.
   ALLE Zahlen sind ÜBUNGSWERTE im frei erfundenen Modellbetrieb (Elektronik für Haus und Garten), Produkte frei erfunden.
   Reiter: Markt (Potenzial, Volumen, Anteil), Zyklus (Lebenszyklus, BCG), Preis (Preis-Absatz, DB, Untergrenzen), Werbung (AIDA), Budget (Planer je Kanal),
           Begriffe, Aufgaben, Trainer, Hilfe.
   Module: mktcore.js (MKT_CORE), mktdata.js (MKT_DATA, MKT_TASKS), mktviz.js (MKT_VIZ, Bilder).
   Speicher (Präfix lm4.mkt.): tab, mf, mix, pre, wer, bud, wiss, mt, done ({id:true}), prog ({id:Prozent}), hints, ctipps (nur Prüfmodus), exam ('1'), rt.
   Tipp-Abzug (25 % je Stufe, höchstens 2 Stufen) nur im Prüfmodus. Aufruf: mktlab.html?aufgabe=mkt1 öffnet die Aufgabe. */
(function (root) {
  const C = root.MKT_CORE, D = root.MKT_DATA, V = root.MKT_VIZ;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.mkt.';
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
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>Marketing-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">mktcore.js, mktdata.js oder mktviz.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks;

  /* ============================================================ Zustand */
  const TABS = [['mf', '📊', 'Markt'], ['mix', '🔄', 'Zyklus'], ['pre', '🏷️', 'Preis'], ['wer', '📣', 'Werbung'], ['bud', '💶', 'Budget'], ['wiss', '🔤', 'Begriffe'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['help', '📘', 'Hilfe']];
  const SETKEYS = Object.keys(D.sets);
  /* Produkte für die BCG-Matrix: Name, Umsatz in Tausend € (Blasengröße), Startwerte relativer Marktanteil und Wachstum */
  const PROD = [['RM-1', 900, 1.6, 4], ['GL-8', 400, 0.6, 18], ['WS-6', 700, 2.2, 14], ['SD-4', 200, 0.4, 3]];
  /* Werbekanäle mit Übungswerten: Name, Kosten je 1.000 Kontakte (€), Reaktionsrate (%), Konversionsrate (% der Reaktionen), Start-Budget */
  const KAN = [['Prospekt', 40, 1.5, 8, 2000], ['Suchanzeige', 25, 2.5, 3, 3000], ['Soziale Medien', 8, 0.8, 2, 1500], ['Messe', 400, 10, 15, 4000]];
  const S = {
    tab: lsGet('tab', 'mf'),
    mf: Object.assign({ pot: 200000, vol: 150000, eigen: 18000, comp: 36000 }, lsGet('mf', {})),
    mix: Object.assign({ t: 30, sel: 0, p: PROD.map(p => [p[2], p[3]]) }, lsGet('mix', {})),
    pre: Object.assign({ pmax: 50, a: 5000, kv: 15, kf: 30000, p: 30 }, lsGet('pre', {})),
    wer: Object.assign({ n: 50000, r0: 40, r1: 30, r2: 20, r3: 10, k: 2500 }, lsGet('wer', {})),
    bud: Object.assign({ b: KAN.map(k => k[4]), w: 120 }, lsGet('bud', {})),
    wiss: Object.assign({ key: SETKEYS[0] }, lsGet('wiss', {})),
    mt: lsGet('mt', {}), mq: {},
    task: null, tq: null, tAns: {}, tRes: null, tFehl: {},
    tr: { q: null, ans: {}, res: null, level: 0 },
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {}))
  };
  /* Gespeicherte Zustände prüfen */
  const fin = Number.isFinite, nums = (o, ks) => ks.every(k => fin(o[k]) && o[k] >= 0);
  if (!nums(S.mf, ['pot', 'vol', 'eigen', 'comp'])) S.mf = { pot: 200000, vol: 150000, eigen: 18000, comp: 36000 };
  if (!fin(S.mix.t) || !Number.isInteger(S.mix.sel) || S.mix.sel < 0 || S.mix.sel >= PROD.length || !Array.isArray(S.mix.p) || S.mix.p.length !== PROD.length || !S.mix.p.every(x => Array.isArray(x) && fin(x[0]) && x[0] > 0 && fin(x[1]))) S.mix = { t: 30, sel: 0, p: PROD.map(p => [p[2], p[3]]) };
  if (!nums(S.pre, ['pmax', 'a', 'kv', 'kf', 'p'])) S.pre = { pmax: 50, a: 5000, kv: 15, kf: 30000, p: 30 };
  if (!nums(S.wer, ['n', 'r0', 'r1', 'r2', 'r3', 'k'])) S.wer = { n: 50000, r0: 40, r1: 30, r2: 20, r3: 10, k: 2500 };
  if (!Array.isArray(S.bud.b) || S.bud.b.length !== KAN.length || !S.bud.b.every(v => fin(v) && v >= 0) || !fin(S.bud.w)) S.bud = { b: KAN.map(k => k[4]), w: 120 };
  if (!SETKEYS.includes(S.wiss.key)) S.wiss.key = SETKEYS[0];
  if (!S.mt || typeof S.mt !== 'object') S.mt = {};
  SETKEYS.forEach(k => { if (!S.mt[k]) S.mt[k] = { n: 0, ok: 0 }; S.mq[k] = { i: -1, sel: -1 }; });
  const R0 = (() => { const m = /[?&]seed=([^&]+)/.exec(location.search); return C.rng(m ? decodeURIComponent(m[1]) : String(Math.random()) + Date.now()); })();

  /* ============================================================ Bausteine */
  const box = (t, fm, res, cls) => `<div class="rdout ${cls || ''}"><span class="st">${esc(t)}</span>${fm ? esc(fm) + ' = ' : ''}<b>${esc(res)}</b></div>`;
  const note = (t, cls) => `<div class="rdout ${cls || 'warn'}">${esc(t)}</div>`;
  const UEB = 'Alle Zahlen in diesem Lab sind Übungswerte im frei erfundenen Modellbetrieb (Elektronik für Haus und Garten), die Produkte sind erfunden.';
  const seg = (attr, opts, cur) => `<div class="seg">${opts.map(o => `<button ${attr}="${esc(o[0])}" class="${String(cur) === String(o[0]) ? 'on' : ''}">${esc(o[1])}</button>`).join('')}</div>`;
  const lbl = t => `<span style="font-size:14px;color:var(--mute)">${esc(t)}</span>`;
  /* Regler: Wert steht im Label und wird beim Schieben mitgeschrieben */
  const sl = (k, label, v, min, max, step, unit, d) => `<label class="f"><span>${esc(label)}: <b data-o="${k}">${esc(f(v, d || 0))} ${esc(unit)}</b></span><input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${v}" data-d="${d || 0}" data-u="${esc(unit)}" aria-label="${esc(label)}"></label>`;
  function slIn(view, st, key, e) {
    const t = e.target, k = t.dataset.k; if (!k || t.type !== 'range') return false;
    st[k] = +t.value; const o = $('[data-o="' + k + '"]', view); if (o) o.textContent = f(+t.value, +t.dataset.d) + ' ' + t.dataset.u; lsSet(key, st); return true;
  }
  /* Bild weich nachführen: Teile mit data-m behalten ihren Knoten, nur die Lage (style) ändert sich, so greift der CSS-Übergang */
  function morph(el, html) {
    const tmp = document.createElement('div'); tmp.innerHTML = html;
    const a = el.firstElementChild, b = tmp.firstElementChild;
    if (!a || !b || a.tagName !== b.tagName || a.getAttribute('viewBox') !== b.getAttribute('viewBox')) { el.innerHTML = html; return; }
    const old = {}; [...a.children].forEach(n => { const m = n.getAttribute('data-m'); if (m) old[m] = n; else n.remove(); });
    let last = null;
    [...b.children].forEach(m => {
      const id = m.getAttribute('data-m'), o = id && old[id];
      if (o) { if (o.innerHTML !== m.innerHTML) o.innerHTML = m.innerHTML; o.setAttribute('style', m.getAttribute('style')); delete old[id]; last = o; return; }
      a.insertBefore(m, last ? last.nextSibling : a.firstChild); last = m;
    });
    Object.keys(old).forEach(k => old[k].remove());
    a.setAttribute('aria-label', b.getAttribute('aria-label'));
  }
  const stage = id => `<div class="inst pv" id="${id}"></div>`;

  /* ============================================================ Markt (Potenzial, Volumen, Anteil als Tortenstück) */
  function renderMf() {
    const s = S.mf;
    $('#mfView').innerHTML = stage('vzMarkt') + `<div class="card pl"><h4>Markt für Funk-Rauchmelder im Verkaufsgebiet</h4><div class="dsrow">${sl('pot', 'Marktpotenzial', s.pot, 50000, 400000, 5000, 'Stück')}${sl('vol', 'Marktvolumen', s.vol, 10000, 400000, 5000, 'Stück')}${sl('eigen', 'Unser Absatz (RM-1)', s.eigen, 0, 120000, 1000, 'Stück')}${sl('comp', 'Größter Mitbewerber', s.comp, 1000, 120000, 1000, 'Stück')}</div><div id="mfOut"></div></div>
      <div class="card pl"><h4>So kommst du an die Zahlen</h4><p style="margin:0 0 6px"><b>Primärforschung</b>: neue Daten selbst erheben (Befragung, Beobachtung, Experiment, Panel). <b>Sekundärforschung</b>: vorhandene Daten auswerten (Statistik, Branchenberichte, eigene Buchhaltung).</p></div>`;
    updMf();
  }
  function updMf() {
    const s = S.mf, ok = s.vol <= s.pot && s.eigen + s.comp <= s.vol;
    if (!ok) { $('#vzMarkt').innerHTML = ''; $('#mfOut').innerHTML = note(s.vol > s.pot ? 'Das Marktvolumen kann nicht größer sein als das Marktpotenzial. Schiebe das Volumen zurück oder das Potenzial hoch.' : 'Unser Absatz und der des größten Mitbewerbers sind zusammen größer als das Marktvolumen. Das geht nicht.', 'bad'); return; }
    morph($('#vzMarkt'), V.marktSvg(s));
    const ma = C.marktAnteil(s.eigen, s.vol), sg = C.saettigung(s.vol, s.pot), ra = C.relAnteil(s.eigen, s.comp);
    $('#mfOut').innerHTML = box('Sättigungsgrad', f(s.vol, 0) + ' / ' + f(s.pot, 0) + ' · 100', f(sg, 1) + ' %') + box('Marktanteil', f(s.eigen, 0) + ' / ' + f(s.vol, 0) + ' · 100', f(ma, 2) + ' %', 'ok') + box('Relativer Marktanteil', f(s.eigen, 0) + ' / ' + f(s.comp, 0), f(ra, 2)) +
      note(ra > 1 ? 'Relativer Marktanteil über 1: Der Modellbetrieb ist Marktführer.' : 'Relativer Marktanteil unter 1: Ein Mitbewerber ist größer.', ra > 1 ? 'ok' : 'warn') + (sg >= 85 ? note('Der Markt ist fast gesättigt. Mehr Absatz geht meist nur, wenn man Mitbewerbern Kunden abnimmt.') : '');
  }
  $('#mfView').addEventListener('input', e => { if (slIn($('#mfView'), S.mf, 'mf', e)) updMf(); });

  /* ============================================================ Zyklus (Produktlebenszyklus, BCG-Matrix) */
  function renderMix() {
    const s = S.mix, P = s.p[s.sel];
    $('#mixView').innerHTML = stage('vzPlz') + `<div class="card pl"><h4>Produktlebenszyklus der Wetterstation WS-6</h4><div class="dsrow">${sl('t', 'Zeit seit der Einführung', s.t, 0, 100, 1, '%')}</div><div id="plzOut"></div></div>
      <div class="inst pv" id="vzBcg"></div><div class="card pl"><h4>Portfolio (BCG-Matrix)</h4><div class="fbar">${lbl('PRODUKT')}${seg('data-bs', PROD.map((p, i) => [i, p[0]]), s.sel)}</div>
      <div class="dsrow">${sl('rel', 'Relativer Marktanteil', P[0], 0.1, 5, 0.1, '', 1)}${sl('w', 'Marktwachstum', P[1], -10, 30, 1, '%')}</div><div id="bcgOut"></div></div>
      <div class="card pl"><h4>Marketing-Mix (4 P)</h4><p style="margin:0">Produktpolitik (Product), Preispolitik (Price), Distributionspolitik (Place), Kommunikationspolitik (Promotion). Im Lebenszyklus ändert sich der Mix: Am Anfang viel Werbung, in der Reife Pflege und Preis, im Rückgang Kosten senken.</p></div>`;
    updPlz(); updBcg();
  }
  function updPlz() {
    const t = S.mix.t, i = C.plzPhase(t), P = C.PLZ[i];
    morph($('#vzPlz'), V.plzSvg(t));
    $('#plzOut').innerHTML = box('Phase', '', P.n, 'ok') + box('Lage', '', P.d) + box('Passende Maßnahme', '', P.m) + `<p class="hint2">Umsatz ${f(C.plzUmsatz(t), 0)} % vom Höchstwert, Gewinn ${C.plzGewinn(t) < 0 ? 'negativ (Verlust)' : 'positiv'} (Modellkurve).</p>`;
  }
  function updBcg() {
    const s = S.mix, items = PROD.map((p, i) => ({ n: p[0], u: p[1], rel: s.p[i][0], w: s.p[i][1], sel: i === s.sel })), it = items[s.sel], k = C.bcgFeld(it.rel, it.w), B = C.BCG[k];
    morph($('#vzBcg'), V.bcgSvg(items));
    $('#bcgOut').innerHTML = box(it.n + ': Feld', 'Anteil ' + f(it.rel, 1) + (it.rel > 1 ? ' (hoch)' : ' (niedrig)') + ', Wachstum ' + f(it.w, 0) + ' %' + (it.w > 10 ? ' (hoch)' : ' (niedrig)'), B.n, 'ok') + box('Bedeutung', '', B.d) + box('Empfehlung', '', B.m);
  }
  $('#mixView').addEventListener('input', e => {
    const t = e.target, k = t.dataset.k; if (!k) return;
    if (k === 'rel' || k === 'w') { S.mix.p[S.mix.sel][k === 'rel' ? 0 : 1] = +t.value; const o = $('[data-o="' + k + '"]'); if (o) o.textContent = f(+t.value, +t.dataset.d) + ' ' + t.dataset.u; lsSet('mix', S.mix); updBcg(); }
    else if (slIn($('#mixView'), S.mix, 'mix', e)) updPlz();
  });
  $('#mixView').addEventListener('click', e => { const b = e.target.closest('[data-bs]'); if (!b) return; S.mix.sel = +b.dataset.bs; lsSet('mix', S.mix); renderMix(); });

  /* ============================================================ Preis (Preis-Absatz einfach, Deckungsbeitrag, Untergrenzen) */
  const pafB = s => s.a / s.pmax;
  function renderPre() {
    const s = S.pre;
    $('#preView').innerHTML = stage('vzPreis') + `<div class="card pl"><h4>Preis für die Funk-Türklingel TK-3</h4><div class="dsrow">${sl('pmax', 'Höchstpreis (Absatz 0)', s.pmax, 20, 100, 1, '€')}${sl('a', 'Sättigungsmenge (Preis 0)', s.a, 1000, 10000, 100, 'Stück')}${sl('p', 'Dein Preis', s.p, 0, 100, 0.5, '€', 2)}${sl('kv', 'Variable Kosten je Stück', s.kv, 0, 60, 0.5, '€', 2)}${sl('kf', 'Fixkosten im Monat', s.kf, 0, 100000, 1000, '€')}</div>
      <div class="btns"><button class="btn" data-pr="opt">Preis mit dem größten Deckungsbeitrag übernehmen</button></div><div id="preOut"></div></div>`;
    updPre();
  }
  function updPre() {
    const s = S.pre, b = pafB(s);
    if (s.p > s.pmax || s.kv > s.pmax) { $('#vzPreis').innerHTML = ''; $('#preOut').innerHTML = note('Preis und variable Kosten müssen unter dem Höchstpreis liegen, sonst wird nichts verkauft.', 'bad'); return; }
    morph($('#vzPreis'), V.preisSvg({ a: s.a, b, kv: s.kv, p: s.p }));
    const x = C.absatz(s.a, b, s.p), db = C.dbGesamt(s.p, s.kv, x), er = C.ergebnis(s.p, s.kv, x, s.kf), be = C.breakEven(s.kf, s.p, s.kv), po = (s.pmax + s.kv) / 2;
    $('#preOut').innerHTML = box('Absatz bei ' + f(s.p, 2) + ' €', f(s.a, 0) + ' − ' + f(b, 2) + ' · ' + f(s.p, 2), f(x, 0) + ' Stück') + box('Umsatz', f(x, 0) + ' · ' + f(s.p, 2) + ' €', f(x * s.p, 2) + ' €') +
      box('Deckungsbeitrag je Stück', f(s.p, 2) + ' − ' + f(s.kv, 2), f(s.p - s.kv, 2) + ' €') + box('Deckungsbeitrag gesamt', f(s.p - s.kv, 2) + ' · ' + f(x, 0), f(db, 2) + ' €') +
      box('Betriebsergebnis', f(db, 2) + ' − ' + f(s.kf, 0), f(er, 2) + ' €', er >= 0 ? 'ok' : 'bad') +
      box('Kurzfristige Preisuntergrenze', 'variable Kosten', f(C.pugKurz(s.kv), 2) + ' €') + box('Langfristige Preisuntergrenze bei ' + f(x, 0) + ' Stück', f(s.kv, 2) + ' + ' + f(s.kf, 0) + ' / ' + f(x, 0), x > 0 ? f(C.pugLang(s.kv, s.kf, x), 2) + ' €' : 'kein Absatz') +
      box('Gewinnschwelle', s.p > s.kv ? f(s.kf, 0) + ' / ' + f(s.p - s.kv, 2) + ', aufgerundet' : 'Preis unter den variablen Kosten', s.p > s.kv ? f(be, 0) + ' Stück' + (be > x ? ' (mehr als der Absatz)' : '') : 'nie') +
      `<p class="hint2">Den größten Deckungsbeitrag gibt es bei dieser Geraden in der Mitte zwischen variablen Kosten und Höchstpreis: (${f(s.kv, 2)} + ${f(s.pmax, 2)}) / 2 = ${f(po, 2)} €. Schiebe den Preis: Die grüne Fläche ist der Deckungsbeitrag.</p>`;
  }
  $('#preView').addEventListener('input', e => { if (slIn($('#preView'), S.pre, 'pre', e)) updPre(); });
  $('#preView').addEventListener('click', e => { if (!e.target.closest('[data-pr]')) return; S.pre.p = Math.round((S.pre.pmax + S.pre.kv) / 2 * 2) / 2; lsSet('pre', S.pre); renderPre(); });

  /* ============================================================ Werbung (AIDA-Trichter, Kosten je Kontakt) */
  function renderWer() {
    const s = S.wer;
    $('#werView').innerHTML = stage('vzAida') + `<div class="card pl"><h4>Werbeaktion für die Gartenleuchte GL-8</h4><div class="dsrow">${sl('n', 'Kontakte', s.n, 1000, 200000, 1000, '')}${sl('k', 'Werbekosten', s.k, 100, 20000, 100, '€')}</div>
      <p class="hint2" style="margin:0 0 4px">Wie viele kommen jeweils eine Stufe weiter (Prozent der Stufe davor)?</p><div class="dsrow">${C.AIDA.map((a, i) => sl('r' + i, a.k + ' ' + a.de, s['r' + i], 0, 100, 1, '%')).join('')}</div><div id="werOut"></div></div>`;
    updWer();
  }
  function updWer() {
    const s = S.wer, r = [s.r0, s.r1, s.r2, s.r3], kauf = s.n * r.reduce((p, x) => p * x / 100, 1);
    morph($('#vzAida'), V.aidaSvg(s.n, r));
    $('#werOut').innerHTML = box('Kosten je Kontakt', f(s.k, 0) + ' / ' + f(s.n, 0), f(C.jeKontakt(s.k, s.n), 3) + ' €') + box('Tausend-Kontakt-Preis', f(s.k, 0) + ' / ' + f(s.n, 0) + ' · 1000', f(C.tkp(s.k, s.n), 2) + ' €') +
      box('Käufe am Ende', f(s.n, 0) + ' · ' + r.map(x => f(x, 0) + ' %').join(' · '), f(kauf, 0)) + box('Kosten je Kauf', f(s.k, 0) + ' / ' + f(kauf, 0), kauf >= 1 ? f(s.k / kauf, 2) + ' €' : 'kein Kauf', kauf >= 1 ? 'ok' : 'bad') +
      '<p class="hint2">Werberendite = Umsatzzuwachs / Werbekosten · 100. Klickrate = Klicks / Einblendungen · 100. Konversionsrate = Bestellungen / Besucher · 100.</p>';
  }
  $('#werView').addEventListener('input', e => { if (slIn($('#werView'), S.wer, 'wer', e)) updWer(); });

  /* ============================================================ Budget-Planer (Balken je Kanal wachsen mit) */
  function budRows() { return KAN.map((k, i) => Object.assign({ n: k[0], budget: S.bud.b[i] }, C.kanal(S.bud.b[i], k[1], k[2], k[3], S.bud.w))); }
  function renderBud() {
    const s = S.bud;
    $('#budView').innerHTML = stage('vzBud') + `<div class="card pl"><h4>Werbe-Budget-Planer</h4><div class="dsrow">${KAN.map((k, i) => sl('b' + i, k[0], s.b[i], 0, 10000, 100, '€')).join('')}${sl('w', 'Ø Auftragswert', s.w, 20, 500, 5, '€')}</div>
      <div class="tw"><table class="tt"><tr><th>Kanal (Übungswerte)</th><th class="n">je 1000 Kontakte</th><th class="n">Reaktion</th><th class="n">Bestellen</th></tr>${KAN.map(k => `<tr><td>${esc(k[0])}</td><td class="n">${f(k[1], 0)} €</td><td class="n">${f(k[2], 1)} %</td><td class="n">${f(k[3], 0)} %</td></tr>`).join('')}</table></div><div id="budOut"></div></div>`;
    updBud();
  }
  function updBud() {
    const rows = budRows(), sum = k => rows.reduce((a, r) => a + r[k], 0), B = sum('budget'), U = sum('umsatz'), A = sum('auftr');
    morph($('#vzBud'), V.budgetSvg(rows));
    $('#budOut').innerHTML = `<div class="tw"><table class="tt"><tr><th>Kanal</th><th class="n">Kontakte</th><th class="n">je Kontakt</th><th class="n">Aufträge</th><th class="n">je Auftrag</th><th class="n">Umsatz</th><th class="n">Rendite</th></tr>${rows.map(r => `<tr><td>${esc(r.n)}</td><td class="n">${f(r.kontakte, 0)}</td><td class="n">${r.kontakte > 0 ? f(r.jeKontakt, 3) + ' €' : '-'}</td><td class="n">${f(r.auftr, 1)}</td><td class="n">${r.auftr > 0 ? f(r.jeAuftrag, 2) + ' €' : '-'}</td><td class="n">${f(r.umsatz, 0)} €</td><td class="n">${r.budget > 0 ? f(r.rendite, 0) + ' %' : '-'}</td></tr>`).join('')}</table></div>` +
      box('Summe', 'Budget ' + f(B, 0) + ' €, erwartete Aufträge ' + f(A, 1), 'Umsatz ' + f(U, 0) + ' €', 'ok') + box('Werberendite gesamt', f(U, 0) + ' / ' + f(B, 0) + ' · 100', B > 0 ? f(U / B * 100, 1) + ' %' : '-') +
      '<p class="hint2">Rechenweg je Kanal: Kontakte = Budget / Preis je 1000 · 1000. Aufträge = Kontakte · Reaktion · Bestellen. Umsatz = Aufträge · Ø Auftragswert. Rendite = Umsatz / Budget · 100 (hier zählt der ganze erwartete Umsatz als Zuwachs).</p>';
  }
  $('#budView').addEventListener('input', e => {
    const t = e.target, k = t.dataset.k; if (!k) return;
    if (/^b\d$/.test(k)) { S.bud.b[+k[1]] = +t.value; const o = $('[data-o="' + k + '"]'); if (o) o.textContent = f(+t.value, 0) + ' €'; lsSet('bud', S.bud); }
    else slIn($('#budView'), S.bud, 'bud', e);
    updBud();
  });

  /* ============================================================ Begriffe (Zuordnungsübung) */
  function renderWiss() {
    const key = S.wiss.key, set = D.sets[key];
    let h = `<div class="fbar">${lbl('THEMA')}<div class="seg" style="flex-wrap:wrap">${SETKEYS.map(k => `<button data-wk="${k}" class="${k === key ? 'on' : ''}">${esc(D.sets[k].title)}</button>`).join('')}</div></div>
      <div class="card pl"><h4>Zuordnungsübung: ${esc(set.title)}</h4><div id="mq"></div></div><div class="dt">`;
    let last = '';
    set.items.forEach(o => {
      if (o.g !== last) { if (last) h += '</div>'; last = o.g; h += `<div class="gh">${esc(o.g)}</div><div>`; }
      h += `<details><summary>${esc(o.n)}</summary><div class="hb2"><p>${esc(o.d)}</p>${o.pts.length ? '<ul>' + o.pts.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : ''}</div></details>`;
    });
    $('#wissView').innerHTML = h + '</div></div>';
    if (S.mq[key].i < 0) newMQ(key); else renderMQ(key);
  }
  function newMQ(key) { S.mq[key] = { i: Math.floor(R0() * D.sets[key].items.length), sel: -1 }; renderMQ(key); }
  function renderMQ(key) {
    const set = D.sets[key], q = S.mq[key], o = set.items[q.i], pool = set.items.filter(x => x.g === o.g), opts = C.shuffle(C.rng(key + q.i + ':' + S.mt[key].n), pool), done = q.sel >= 0;
    const el = $('#mq'); if (!el) return;
    el.innerHTML = `<p style="margin-top:0">${esc(set.prompt)} <b>${esc(o.d)}</b></p><div class="opts">${opts.map(x => `<button data-on="${esc(x.n)}" class="${done ? (x === o ? 'ok' : set.items[q.sel] === x ? 'bad' : '') : ''}" ${done ? 'disabled' : ''}>${esc(x.n)}</button>`).join('')}</div>
      <p class="hint2">Richtig: <b>${S.mt[key].ok}</b> von <b>${S.mt[key].n}</b></p>${done ? '<div class="btns"><button class="btn pri" data-on="__next">Nächste Frage</button></div>' : ''}`;
  }
  $('#wissView').addEventListener('click', e => {
    const wk = e.target.closest('[data-wk]'), b = e.target.closest('[data-on]'), key = S.wiss.key;
    if (wk) { S.wiss.key = wk.dataset.wk; lsSet('wiss', S.wiss); renderWiss(); return; }
    if (!b) return;
    if (b.dataset.on === '__next') { newMQ(key); return; }
    const set = D.sets[key], i = set.items.findIndex(x => x.n === b.dataset.on), right = i === S.mq[key].i;
    S.mq[key].sel = i; S.mt[key].n++; if (right) { S.mt[key].ok++; ding(); } else sad(); lsSet('mt', S.mt); renderMQ(key);
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
  const eingabeHinweis = q => q.ask.type === 'num' ? `<p class="lr-hinweis hint2">Zahl${q.ask.unit ? ' in ' + esc(q.ask.unit) : ''}.${q.tol > 0.011 ? ' ±' + esc(f(q.tol, 2)) + ' ' + esc(q.ask.unit) + ' gelten als richtig (wegen Rundung).' : ''}</p>` : '';
  const stufeFuer = (ok, fehl, ex) => ok ? 'ok' : ex ? 'pruef' : fehl >= 2 ? 'loes' : 'tipp';
  const zeigFb = el => { try { const x = el && el.querySelector('.lr-fb'); if (x && root.LabRahmen) root.LabRahmen.zeig(x); } catch (e) {} };
  /* "So gehst du vor" und Bild zum Thema */
  const stepsHTML = q => q.steps && q.steps.length ? `<details class="dt steps" open><summary>👣 So gehst du vor</summary><div class="hb2"><ol>${q.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol></div></details>` : '';
  const picHTML = q => { const h = V.taskPic(D.cats.indexOf(q.cat)); return h ? `<div class="inst pv tpic">${h}</div>` : ''; };
  function qBody(q, a, r) {
    const lock = r && (r.ok || r.stufe === 'loes');
    if (q.ask.type === 'choice') return `<div class="opts">${q.ask.choices.map((c, i) => `<button data-tc="${i}" ${lock ? 'disabled' : ''} class="${lock && i === q.ask.correct ? 'ok' : a.c === i ? (r && !r.ok && r.given === c ? 'bad' : 'on') : ''}">${esc(c)}</button>`).join('')}</div>`;
    return `<label class="f"><span>${esc(q.ask.label)}${q.ask.unit ? ' (' + esc(q.ask.unit) + ')' : ''}</span><div class="qin"><input data-in="1" inputmode="decimal" autocomplete="off" value="${esc(a.v || '')}" ${lock ? 'disabled' : ''}><span class="u">${esc(q.ask.unit)}</span></div>${eingabeHinweis(q)}</label>`;
  }
  function evalQ(q, a) {
    if (q.ask.type === 'choice') { if (a.c == null) { toast('Wähle zuerst eine Antwort.'); return null; } return { ok: a.c === q.ask.correct, given: q.ask.choices[a.c] }; }
    const v = P(a.v); if (!Number.isFinite(v)) { toast('Bitte gib eine Zahl ein (mit Komma oder Punkt).'); return null; }
    return { ok: Math.abs(v - q.value) <= q.tol + 1e-9, given: (f(v, 2) + ' ' + q.ask.unit).trim() };
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
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv">${dots(t.level)}</div>${picHTML(q)}<p style="margin:8px 0">${esc(q.text)}</p>${stepsHTML(q)}${qBody(q, a, r)}`;
      if (r) h += fbHTML(q, r);
      h += `<div class="btns"><button class="btn pri" data-ta="chk"${r && (r.ok || r.stufe === 'loes') ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" data-ta="hint">💡 Tipp</button><button class="btn" data-ta="close">Schließen</button></div>`;
      if (exam()) h += '<p class="hint2" style="color:var(--warn)">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>';
      if (r && (r.ok || r.stufe === 'loes')) h += `<div class="btns"><button class="btn pri" data-ta="next">Nächste Aufgabe</button></div>`;
      h += '</div>';
    }
    h += `<p class="hint2" style="margin:4px 0 0">${n100} von ${TASKS.length} Aufgaben gelöst. ${exam() ? '🎓 Prüfmodus ist an.' : 'Tipp: Im Prüfmodus (🎓 oben) zählen Tipps als Abzug.'}</p><p class="hint2" style="margin:4px 0 0">⚠ ${esc(UEB)}</p>`;
    let last = '';
    TASKS.forEach(x => { if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; } const p = prog[x.id]; h += `<button class="row" data-t="${esc(x.id)}"><span class="dot ${d[x.id] ? 'g' : ''}">${d[x.id] ? '✓' : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${dots(x.level)}</span>${p != null && p < 100 ? ' · bisher ' + p + ' %' : ''}</small></div></button>`; });
    Vw.innerHTML = h; if (top !== false) $('#pgTasks').scrollTop = 0;
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
      <div class="card pl"><h4>${esc(q.cat)} · <span class="lv">${dots(q.level)}</span></h4><div class="big">${esc(q.title)}</div>${picHTML(q)}<p style="margin:8px 0">${esc(q.text)}</p>${stepsHTML(q)}${qBody(q, T.ans, T.res)}${T.res ? fbHTML(q, T.res) : ''}
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
    $('#helpView').innerHTML = `<div class="rdout warn">⚠ ${esc(UEB)}</div>` +
      sec('Marktforschung', `<span class="eq">Marktanteil = eigener Umsatz / Marktvolumen · 100</span><span class="eq">Sättigungsgrad = Marktvolumen / Marktpotenzial · 100</span><span class="eq">relativer Marktanteil = eigener Marktanteil / Marktanteil des größten Mitbewerbers</span><span class="eq">Marktwachstum = (Volumen neu − Volumen alt) / Volumen alt · 100</span><p><b>Primärforschung</b>: neue Daten selbst erheben (Befragung, Beobachtung, Test). <b>Sekundärforschung</b>: vorhandene Daten auswerten (Statistik, Verbandszahlen, eigene Verkaufszahlen). Marktpotenzial: was der Markt höchstens aufnehmen kann. Marktvolumen: was wirklich verkauft wird.</p>`, true) +
      sec('Marketing-Mix, Lebenszyklus und Portfolio', `<table><tr><th>Baustein</th><th>Fragen</th></tr><tr><td>Produktpolitik</td><td>Was bieten wir an? Qualität, Sortiment, Verpackung, Service</td></tr><tr><td>Preispolitik</td><td>Was kostet es? Preis, Rabatt, Zahlungsbedingungen</td></tr><tr><td>Distributionspolitik</td><td>Wie kommt es zum Kunden? Absatzweg, Reisender, Handelsvertreter</td></tr><tr><td>Kommunikationspolitik</td><td>Wie erfährt der Kunde davon? Werbung, Verkaufsförderung, Öffentlichkeitsarbeit</td></tr></table><p><b>Lebenszyklus</b>: Einführung (Verlust), Wachstum (Gewinn steigt), Reife (Umsatz und Gewinn erreichen ihren Höchstwert), Sättigung (Umsatz sinkt leicht, Druck auf den Preis), Rückgang. <b>BCG-Matrix</b>: Star (hoher Anteil, starkes Wachstum), Cash Cow (hoher Anteil, schwaches Wachstum), Question Mark (kleiner Anteil, starkes Wachstum), Poor Dog (kleiner Anteil, schwaches Wachstum). Im Lab gilt: relativer Anteil über 1 und Wachstum über 10 % zählen als hoch.</p>`) +
      sec('Preispolitik', `<span class="eq">Deckungsbeitrag je Stück = Preis − variable Kosten je Stück</span><span class="eq">Ergebnis = Deckungsbeitrag je Stück · Menge − Fixkosten</span><span class="eq">kurzfristige Preisuntergrenze = variable Kosten je Stück</span><span class="eq">langfristige Preisuntergrenze = Selbstkosten je Stück = variable Kosten + Fixkosten / Menge</span><span class="eq">Gewinnschwelle = Fixkosten / Deckungsbeitrag je Stück, aufrunden</span><span class="eq">Preis-Absatz: Menge = Höchstmenge − Rückgang je Euro · Preis</span><p>Strategien: Hochpreis, Niedrigpreis, Abschöpfung (erst hoch, dann runter), Durchdringung (erst niedrig, dann rauf). Einen Zusatzauftrag nimmst du an, wenn der Preis über den variablen Kosten liegt und Platz frei ist.</p>`) +
      sec('Kommunikation und Werbeerfolg', `<p><b>AIDA</b>: Attention (Aufmerksamkeit), Interest (Interesse), Desire (Wunsch), Action (Kauf).</p><span class="eq">Kosten je Kontakt = Werbekosten / Kontakte</span><span class="eq">Tausenderkontaktpreis = Werbekosten / Kontakte · 1000</span><span class="eq">Werberendite = Umsatzzuwachs / Werbekosten · 100</span><span class="eq">Klickrate = Klicks / Einblendungen · 100</span><span class="eq">Konversionsrate = Käufe / Klicks · 100</span><span class="eq">kritischer Umsatz: Reisender und Handelsvertreter kosten gleich viel</span><p>Der <b>Werbeplan</b> klärt: Ziel, Zielgruppe, Botschaft, Werbemittel, Werbeträger, Zeitraum, Budget, Erfolgskontrolle.</p>`) +
      sec('Recht im Marketing', `<p><b>UWG</b> (Gesetz gegen den unlauteren Wettbewerb) schützt Mitbewerber, Verbraucher und den fairen Wettbewerb. Irreführende Werbung ist verboten (§ 5). Vergleichende Werbung ist nur erlaubt, wenn sie sachlich und nachprüfbar ist (§ 6). Werbe-E-Mail an Verbraucher nur mit vorheriger ausdrücklicher Einwilligung (§ 7). Ausnahme für Bestandskunden: Adresse beim Verkauf erhalten, Werbung nur für eigene ähnliche Waren, kein Widerspruch, Hinweis auf das Widerspruchsrecht beim Erheben und bei jeder Mail (§ 7 Abs. 3). Bei Verstößen drohen Abmahnung (§ 13) und Anspruch auf Unterlassung (§ 8). Bezahlte Beiträge müssen als Werbung erkennbar sein (§ 5a).</p><p><b>Preisangabenverordnung</b>: Gegenüber Verbrauchern gilt der Gesamtpreis mit Umsatzsteuer. Bei einer Preissenkung ist der niedrigste Preis der letzten 30 Tage der Vergleichspreis (§ 11).</p><p class="hint2">Das ist Lernstoff, keine Rechtsberatung. Im Zweifel fragst du die Fachabteilung.</p>`) +
      `<p class="hint2">Zahlen und Begriffe sind Lehrbuch- und Übungswerte.</p>`;
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'mf'; S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    ({ mf: renderMf, mix: renderMix, pre: renderPre, wer: renderWer, bud: renderBud, wiss: renderWiss, tasks: renderTasks, rt: renderTrainer, help: renderHelp })[t]();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'Marketing-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = 'Marketing-Lab: ' + T[2];
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
  $('#title').onclick = () => setTab('mf');
  $('#bMenu').onclick = () => {
    const rows = [['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung und Tipps'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Aufgaben mit Serien-Zähler'], ['help', 'Hilfe und Formeln', 'Markt, Zyklus und Portfolio, Preis, Werbung, Recht'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben und Trainer-Serie auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
    sheet('Menü', (b, close) => {
      b.innerHTML = rows.map(r => `<button class="row" data-m="${r[0]}"><div class="grow"><b>${esc(r[1])}</b><small>${esc(r[2])}</small></div></button>`).join('');
      b.addEventListener('click', e => { const r = e.target.closest('.row'); if (!r) return; close(); const m = r.dataset.m; if (m === 'home') location.href = 'index.html'; else if (m === 'exam') setExam(!exam()); else if (m === 'reset') resetAll(); else setTab(m); });
    });
  };
  function resetAll() {
    sheet('Fortschritt zurücksetzen?', (b, close) => {
      b.innerHTML = '<p style="margin-top:0">Alle gelösten Aufgaben, Tipps und die Trainer-Serie dieses Labs werden auf diesem Gerät gelöscht. Das kann nicht rückgängig gemacht werden.</p><div class="btns"><button class="btn" data-x="no">Abbrechen</button><button class="btn danger" data-x="yes">Löschen</button></div>';
      b.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (!x) return; if (x.dataset.x === 'yes') { ['done', 'prog', 'hints', 'ctipps', 'rt', 'mt'].forEach(k => { try { localStorage.removeItem(LS + k); } catch (er) {} }); S.rt = { n: 0, ok: 0, streak: 0, best: 0 }; SETKEYS.forEach(k => { S.mt[k] = { n: 0, ok: 0 }; }); S.task = null; S.tRes = null; palSig = ''; updatePal(); updateBadge(); if (S.tab === 'tasks') renderTasks(); toast('Fortschritt gelöscht'); } close(); });
    });
  }

  /* Schnittstelle für Karriere/Lernpfad */
  root.MKT_LAB = { id: 'mkt', title: 'Marketing-Lab', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.MKT_TASKS };

  buildTabs(); updatePal(); setTab(TABS.some(x => x[0] === S.tab) ? S.tab : 'mf');
  root.LabGoto = id => { try { if (TASKS.some(t => t.id === id)) { setTab('tasks'); startTask(id); return true; } } catch (e) {} return false; };
  try { const qa = new URLSearchParams(location.search).get('aufgabe'); if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); } } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
