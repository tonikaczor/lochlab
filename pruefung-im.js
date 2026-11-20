'use strict';
/* Tonfunk Lab: Prüfungsvorbereitung Industriemechaniker (pruefung-im.html).
   Quelle: pruefpool-im.js (PR_POOL_IM: Teil 1, Teil 2 Auftrags- und Funktionsanalyse, Teil 2 Fertigungstechnik) und, wenn geladen, die Aufgaben der
   Wirtschafts- und Sozialkunde aus pruefpool.js (PR_POOL, teil WiSo).
   Zwei Wege: Gebiet üben (10 Aufgaben, Rückmeldung mit Begründung nach jeder Antwort) und Probeprüfung (nur Auswahlaufgaben, mit Zeit und Note, Auswertung am Ende).
   Der Kern (PruefIM) hat keinen DOM-Zugriff und ist in Node testbar.
   Speicher: pr.state.tr['p:<gebiet>@<1|2>'] = { r, n, t } (wie Prüfungs-Lab und 10-Minuten-Einheit, daraus wählt die Einheit schwache Gebiete),
   lm4.prim = { hist: [{ t, k, pct, ok, n, note }], last: [Ids] }, falsch beantwortete Aufgaben werden Lernkarten (pkarten.js). */
(function (root) {
  const KEY = 'lm4.prim', MAXH = 30, KEEP = 80, N_UEBEN = 10;
  /* Probeprüfungen: Zahl der Auswahlaufgaben und Zeit in Minuten (Übungswerte, die echte Prüfung enthält zusätzlich offene Aufgaben) */
  const EXAMS = [
    { k: 'IM1', t: 'Teil 1', n: 25, min: 45 },
    { k: 'IMA', t: 'Teil 2: Auftrags- und Funktionsanalyse', n: 28, min: 50 },
    { k: 'IMF', t: 'Teil 2: Fertigungstechnik', n: 28, min: 50 },
    { k: 'WiSo', t: 'Teil 2: Wirtschafts- und Sozialkunde', n: 25, min: 45 }
  ];
  const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
  const num = v => { const x = +v; return isFinite(x) ? x : 0; };
  const rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const shuffle = (arr, r) => { const x = arr.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = x[i]; x[i] = x[j]; x[j] = t; } return x; };
  const teilNr = t => (t === 'IM1' || t === 'Teil1' ? 1 : 2);

  /* Bestand: Aufgaben und Gebiete des Berufs, dazu WiSo aus dem allgemeinen Pool (falls geladen) */
  function bestand(im, allg) {
    const q = (im && Array.isArray(im.q) ? im.q : []).slice(), groups = (im && Array.isArray(im.groups) ? im.groups : []).slice();
    const ws = allg && Array.isArray(allg.q) ? allg.q.filter(p => p.teil === 'WiSo') : [];
    if (ws.length) { const g = (allg.groups || []).find(x => x.k === 'wiso'); groups.push({ k: 'wiso', teil: 'WiSo', t: g ? g.t : 'Wirtschafts- und Sozialkunde', icon: g ? g.icon : '⚖️', lab: '', labN: '' }); }
    return { q: q.concat(ws), groups };
  }
  /* Aufgabe -> Frage für die Anzeige (Antworten gemischt), Statistik-Schlüssel wie im Prüfungs-Lab */
  function frage(p, r) {
    const base = { id: p.id, pool: true, g: p.g, teil: p.teil, niv: p.n, th: p.th || '', k: 'p:' + p.g + '@' + teilNr(p.teil), q: p.q, w: p.w };
    if (p.o) { const idx = shuffle(p.o.map((x, i) => i), r); return Object.assign(base, { type: 'mc', opts: idx.map(i => p.o[i]), r: idx.indexOf(p.r) }); }
    return Object.assign(base, { type: 'num', ans: p.ans, unit: p.u || '', tol: p.tol });
  }
  /* ohne Wiederholung ziehen; Aufgaben mit gleicher Ausschlussgruppe (ex) nur einmal, solange anderes da ist */
  function nimm(liste, n, r, seen) {
    const out = [], exu = {}, mix = shuffle(liste, r), frisch = mix.filter(p => !seen[p.id]), alt = mix.filter(p => seen[p.id]);
    const lauf = (l, streng) => l.forEach(p => { if (out.length >= n || out.indexOf(p) >= 0) return; if (streng && p.ex && exu[p.ex]) return; out.push(p); if (p.ex) exu[p.ex] = 1; });
    lauf(frisch, true); lauf(alt, true); lauf(frisch, false); lauf(alt, false);
    return out;
  }
  /* Probeprüfung: n Auswahlaufgaben eines Prüfungsteils, auf die Gebiete nach ihrer Größe verteilt (größte Reste), Reihenfolge gemischt */
  function ziehePruefung(q, teil, n, seed, recent) {
    const r = rng(seed), src = (q || []).filter(p => p.teil === teil && p.o), seen = {}; (recent || []).forEach(i => { seen[i] = 1; });
    if (!src.length) return [];
    n = Math.min(n, src.length);
    const gs = Array.from(new Set(src.map(p => p.g))), anz = gs.map(g => src.filter(p => p.g === g).length);
    const soll = anz.map(a => a * n / src.length), hat = soll.map(Math.floor);
    let rest = n - hat.reduce((s, x) => s + x, 0);
    soll.map((s, i) => [s - hat[i], i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).forEach(x => { if (rest > 0) { hat[x[1]]++; rest--; } });
    let out = []; gs.forEach((g, i) => { out = out.concat(nimm(src.filter(p => p.g === g), hat[i], r, seen)); });
    if (out.length < n) out = out.concat(nimm(src.filter(p => out.indexOf(p) < 0), n - out.length, r, seen));
    return shuffle(out, r).map(p => frage(p, r));
  }
  /* Üben: n Aufgaben eines Gebiets (wo.g) oder eines Prüfungsteils (wo.teil), zuletzt gesehene zuerst ausgelassen, auch Zahlenaufgaben */
  function zieheUeben(q, wo, n, seed, recent) {
    const r = rng(seed), seen = {}; (recent || []).forEach(i => { seen[i] = 1; });
    const src = (q || []).filter(p => (wo.g ? p.g === wo.g : p.teil === wo.teil));
    return nimm(src, Math.min(n, src.length), r, seen).map(p => frage(p, r));
  }
  function parse(s) { const x = parseFloat(String(s == null ? '' : s).replace(/\s/g, '').replace(',', '.')); return isFinite(x) ? x : NaN; }
  /* Bewertung wie im Prüfungs-Lab und in der 10-Minuten-Einheit */
  function richtig(q, a) {
    if (a == null || a === '' || a === -1) return false;
    if (q.type === 'mc') return a === q.r;
    const x = parse(a); if (isNaN(x)) return false;
    return q.tol === 0 ? Math.abs(x - q.ans) < 0.5 : Math.abs(x - q.ans) <= Math.max(num(q.tol == null ? 0.02 : q.tol) * Math.abs(q.ans), 1e-9);
  }
  /* Notenschlüssel der Kammern: 100 bis 92 sehr gut, 91 bis 81 gut, 80 bis 67 befriedigend, 66 bis 50 ausreichend, 49 bis 30 mangelhaft, darunter ungenügend */
  function note(pct) { return pct >= 92 ? 1 : pct >= 81 ? 2 : pct >= 67 ? 3 : pct >= 50 ? 4 : pct >= 30 ? 5 : 6; }
  const NOTEN = ['', 'sehr gut', 'gut', 'befriedigend', 'ausreichend', 'mangelhaft', 'ungenügend'];
  function auswerten(qs, ant) {
    let ok = 0; const je = {};
    qs.forEach((q, i) => { const r = richtig(q, ant[i]); if (r) ok++; const a = je[q.g] = je[q.g] || { r: 0, n: 0 }; a.n++; if (r) a.r++; });
    const pct = qs.length ? Math.round(100 * ok / qs.length) : 0;
    return { ok, n: qs.length, pct, note: note(pct), bestanden: pct >= 50, je };
  }
  function trBuchen(state, k, ok, now) { const s = isObj(state) ? state : {}; s.tr = isObj(s.tr) ? s.tr : {}; const t = s.tr[k] = isObj(s.tr[k]) ? s.tr[k] : { r: 0, n: 0 }; t.r = num(t.r) + (ok ? 1 : 0); t.n = num(t.n) + 1; t.t = now; return s; }
  /* Quote eines Gebiets aus pr.state.tr: { r, n } über beide Bereiche */
  function quote(tr, g) { const o = { r: 0, n: 0 }; if (!isObj(tr)) return o; ['1', '2'].forEach(x => { const t = tr['p:' + g + '@' + x]; if (isObj(t)) { o.r += num(t.r); o.n += num(t.n); } }); return o; }
  function normS(s) {
    const o = { hist: [], last: [] }; if (!isObj(s)) return o;
    if (Array.isArray(s.hist)) o.hist = s.hist.filter(h => isObj(h) && typeof h.k === 'string' && isFinite(+h.pct)).map(h => ({ t: num(h.t), k: h.k.slice(0, 8), pct: Math.round(num(h.pct)), ok: Math.round(num(h.ok)), n: Math.round(num(h.n)), note: Math.round(num(h.note)) })).slice(-MAXH);
    if (Array.isArray(s.last)) o.last = s.last.filter(x => typeof x === 'string' && /^[A-Za-z0-9_.-]{1,60}$/.test(x)).slice(-KEEP);
    return o;
  }
  function merke(s, ids) { const o = normS(s); ids.forEach(i => { const j = o.last.indexOf(i); if (j >= 0) o.last.splice(j, 1); o.last.push(i); }); o.last = o.last.slice(-KEEP); return o; }
  const core = { KEY, EXAMS, N_UEBEN, NOTEN, bestand, frage, ziehePruefung, zieheUeben, richtig, parse, note, auswerten, trBuchen, quote, normS, merke, rng, teilNr };
  root.PruefIM = core;
  if (typeof module === 'object' && module.exports) module.exports = core;
  if (typeof document === 'undefined') return;

  /* ---------- Browserteil ---------- */
  const doc = document, $ = s => doc.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rd = (k, d) => { try { const v = localStorage.getItem(k); const o = v == null ? d : JSON.parse(v); return o == null ? d : o; } catch (e) { return d; } };
  const wr = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const par = (() => { const o = {}; try { new URLSearchParams(root.location.search).forEach((v, k) => { o[k] = v; }); } catch (e) {} return o; })();
  const seedNeu = () => (par.seed && isFinite(+par.seed) ? (+par.seed >>> 0) + (lauf++) : (Date.now() % 1000000000));
  let lauf = 0, B = { q: [], groups: [] }, run = null, uhr = null;
  const zahl = x => String(parseFloat((+x).toPrecision(4))).replace('.', ',');
  const antwortText = q => (q.type === 'mc' ? q.opts[q.r] : zahl(q.ans) + (q.unit ? ' ' + q.unit : ''));
  const gName = k => { const g = B.groups.find(x => x.k === k); return g ? g.t : k; };
  const out = () => $('#out');
  const fokus = sel => { const el = $(sel); if (el && el.focus) { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } } };
  const hoch = () => { try { root.scrollTo(0, 0); } catch (e) {} };
  function stopUhr() { if (uhr) { clearInterval(uhr); uhr = null; } doc.documentElement.classList.remove('pi-lauf'); }
  /* Lernstand-Code (lernstand.js) nimmt nur eingetragene Schlüssel mit */
  try { const L = root.Lernstand; if (L && Array.isArray(L.PROGRESS) && L.PROGRESS.indexOf(KEY) < 0) L.PROGRESS.push(KEY); } catch (e) {}

  function buche(q, ok, now) {
    wr('pr.state', trBuchen(rd('pr.state', {}), q.k, ok, now));
    if (!ok && root.PKarten && root.PKarten.speichern) { try { return root.PKarten.speichern([q], now).neu || 0; } catch (e) {} }
    return 0;
  }

  /* ----- Start: Probeprüfungen und Gebiete ----- */
  function start() {
    stopUhr(); run = null;
    const S = normS(rd(KEY, {})), tr = (rd('pr.state', {}) || {}).tr, teile = EXAMS.filter(x => B.q.some(p => p.teil === x.k));
    const letzte = k => { const h = S.hist.filter(x => x.k === k), l = h[h.length - 1]; return l ? 'zuletzt ' + l.pct + ' % (Note ' + l.note + ')' : ''; };
    let h = '<section class="card" id="probe" aria-labelledby="probeH"><h2 id="probeH">Probeprüfung</h2><p class="mute">Wie in der Prüfung: mit Zeit, ohne Hilfen, Auswertung mit Note am Ende. Hier kommen nur Auswahlaufgaben vor, in der echten Prüfung gibt es zusätzlich offene Aufgaben.</p><div class="pl">'
      + teile.map(x => '<button type="button" class="zeile" data-exam="' + x.k + '"><span class="zt"><b>' + esc(x.t) + '</b><small>' + Math.min(x.n, B.q.filter(p => p.teil === x.k && p.o).length) + ' Aufgaben, ' + x.min + ' Minuten</small></span><span class="zz">' + esc(letzte(x.k)) + '</span><span aria-hidden="true">›</span></button>').join('') + '</div></section>';
    h += '<section class="card" id="ueben" aria-labelledby="uebenH"><h2 id="uebenH">Gebiete üben</h2><p class="mute">Je Runde ' + N_UEBEN + ' Aufgaben. Nach jeder Antwort siehst du die Lösung mit Begründung. Falsch beantwortete Aufgaben werden zu Lernkarten.</p>';
    teile.forEach(x => {
      const gs = B.groups.filter(g => g.teil === x.k);
      h += '<h3>' + esc(x.t) + '</h3><div class="pl">' + (gs.length > 1 ? '<button type="button" class="zeile" data-teil="' + x.k + '"><span class="zt"><b>Alle Gebiete gemischt</b><small>' + B.q.filter(p => p.teil === x.k).length + ' Aufgaben</small></span><span aria-hidden="true">›</span></button>' : '')
        + gs.map(g => { const n = B.q.filter(p => p.g === g.k).length, qt = quote(tr, g.k); return '<button type="button" class="zeile" data-g="' + g.k + '"><span class="zi" aria-hidden="true">' + esc(g.icon || '') + '</span><span class="zt"><b>' + esc(g.t) + '</b><small>' + n + ' Aufgaben</small></span><span class="zz">' + (qt.n ? Math.round(100 * qt.r / qt.n) + ' % richtig (' + qt.n + ')' : '') + '</span><span aria-hidden="true">›</span></button>'; }).join('') + '</div>';
    });
    h += '</section><p class="hinweis">Die Aufgaben sind eigene Formulierungen im Stil der Abschlussprüfung (KI-Entwurf, Rechenaufgaben nachgerechnet). Die Freigabe durch den Ausbilder steht aus. Es sind keine Originalaufgaben der Kammer. Stimmt etwas nicht, sag deinem Ausbilder Bescheid.</p>'
      + '<p class="nav weiter"><b>Weiter:</b><a href="karten.html?art=p">Fehlerkarten üben</a><a href="berufsfragen.html">Fragen für deinen Beruf</a><a href="index.html#labs">Zu den Labs</a></p>';
    out().innerHTML = h;
    out().querySelectorAll('[data-exam]').forEach(b => { b.onclick = () => pruefStart(b.dataset.exam); });
    out().querySelectorAll('[data-g]').forEach(b => { b.onclick = () => uebStart({ g: b.dataset.g }); });
    out().querySelectorAll('[data-teil]').forEach(b => { b.onclick = () => uebStart({ teil: b.dataset.teil }); });
  }

  /* ----- Üben ----- */
  function uebStart(wo) {
    const S = normS(rd(KEY, {})), qs = zieheUeben(B.q, wo, N_UEBEN, seedNeu(), S.last);
    if (!qs.length) { start(); return; }
    const titel = wo.g ? gName(wo.g) : ((EXAMS.find(x => x.k === wo.teil) || {}).t || '') + ', gemischt';
    run = { art: 'ueben', wo, titel, qs, i: 0, res: [], neu: 0 }; hoch(); uebZeige();
  }
  const balken = (i, n, text) => '<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="' + n + '" aria-valuenow="' + i + '" aria-label="' + i + ' von ' + n + ' erledigt"><i style="width:' + Math.round(100 * i / n) + '%"></i></div><p class="mute kl">' + esc(text) + '</p>';
  function uebZeige() {
    const R = run; if (!R) return; if (R.i >= R.qs.length) { uebEnde(); return; }
    const q = R.qs[R.i], kopf = '<div class="card"><p class="kopfz"><b>' + esc(R.titel) + '</b><button type="button" class="btn s" id="abbr">Beenden</button></p>' + balken(R.i, R.qs.length, 'Aufgabe ' + (R.i + 1) + ' von ' + R.qs.length + (q.th ? ' · ' + q.th : ''));
    if (R.fertig) {
      const ok = R.ok, opts = q.type === 'mc' ? q.opts.map((o, k) => '<div class="opt fest ' + (k === q.r ? 'ok' : k === R.sel ? 'no' : '') + '">' + (k === q.r ? '✓ ' : k === R.sel ? '✗ ' : '') + esc(o) + '</div>').join('') : '<p class="mute">Deine Antwort: ' + esc(R.txt) + (q.unit ? ' ' + esc(q.unit) : '') + '</p>';
      out().innerHTML = kopf + '<h2 class="fr">' + esc(q.q) + '</h2>' + opts + '<div class="rm ' + (ok ? 'ok' : 'no') + '" role="status"><b>' + (ok ? '✓ Richtig.' : '✗ Leider falsch.') + '</b>' + (ok && q.type === 'mc' ? '' : ' Richtig: ' + esc(antwortText(q)) + '.') + (q.w ? '<br>' + esc(q.w) : '') + (ok ? '' : '<br><small>Die Aufgabe liegt jetzt als Lernkarte in Fach 1.</small>') + '</div><p><button type="button" class="btn" id="weiter">' + (R.i + 1 >= R.qs.length ? 'Auswertung' : 'Weiter') + '</button></p></div>';
      $('#weiter').onclick = () => { R.i++; R.fertig = false; R.sel = null; R.txt = ''; uebZeige(); }; $('#abbr').onclick = start; fokus('#weiter'); return;
    }
    if (q.type === 'mc') {
      out().innerHTML = kopf + '<h2 class="fr">' + esc(q.q) + '</h2><div role="group" aria-label="Antworten">' + q.opts.map((o, k) => '<button type="button" class="opt" data-k="' + k + '">' + esc(o) + '</button>').join('') + '</div></div>';
      out().querySelectorAll('.opt').forEach(b => { b.onclick = () => uebAntwort(+b.dataset.k, ''); });
    } else {
      out().innerHTML = kopf + '<h2 class="fr">' + esc(q.q) + '</h2><p><input class="numin" id="numin" inputmode="decimal" autocomplete="off" aria-label="Deine Antwort" placeholder="Zahl eingeben"> <span class="unit">' + esc(q.unit) + '</span></p><p><button type="button" class="btn" id="pruefen">Antwort prüfen</button></p><p class="mute" id="hint" role="status"></p></div>';
      const inp = $('#numin'), go = () => { if (isNaN(parse(inp.value))) { $('#hint').textContent = 'Gib eine Zahl ein (Komma oder Punkt).'; return; } uebAntwort(null, inp.value); };
      $('#pruefen').onclick = go; inp.onkeydown = e => { if (e.key === 'Enter') go(); }; fokus('#numin');
    }
    $('#abbr').onclick = start;
  }
  function uebAntwort(sel, txt) {
    const R = run, q = R.qs[R.i], ok = richtig(q, q.type === 'mc' ? sel : txt), now = Date.now();
    R.sel = sel; R.txt = txt; R.ok = ok; R.fertig = true; R.neu += buche(q, ok, now); R.res.push({ q, ok });
    wr(KEY, merke(rd(KEY, {}), [q.id])); uebZeige();
  }
  function uebEnde() {
    const R = run, n = R.res.length, ok = R.res.filter(x => x.ok).length, fq = n - ok;
    out().innerHTML = '<div class="card">' + balken(n, n, 'Runde beendet') + '<h2>' + ok + ' von ' + n + ' richtig (' + (n ? Math.round(100 * ok / n) : 0) + ' %)</h2><p class="mute">' + esc(R.titel) + '</p>'
      + R.res.map(x => '<div class="rl ' + (x.ok ? 'ok' : 'no') + '"><b>' + (x.ok ? '✓ ' : '✗ ') + esc(x.q.q) + '</b>' + (x.ok ? '' : '<br>Richtig: ' + esc(antwortText(x.q)) + '<div class="mute">' + esc(x.q.w) + '</div>') + '</div>').join('')
      + (fq ? '<p>' + (fq === 1 ? 'Dein Fehler liegt' : 'Deine ' + fq + ' Fehler liegen') + ' als Lernkarte in Fach 1. <a href="karten.html?art=p">Fehlerkarten jetzt üben</a></p>' : '')
      + '<p><button type="button" class="btn" id="nochmal">Noch eine Runde</button><button type="button" class="btn zwei" id="zurueck">Zur Übersicht</button></p></div>';
    const wo = R.wo; $('#nochmal').onclick = () => uebStart(wo); $('#zurueck').onclick = start; hoch(); fokus('#nochmal');
  }

  /* ----- Probeprüfung ----- */
  function pruefStart(k) {
    const X = EXAMS.find(x => x.k === k), S = normS(rd(KEY, {})); if (!X) return;
    const qs = ziehePruefung(B.q, k, X.n, seedNeu(), S.last); if (!qs.length) { start(); return; }
    out().innerHTML = '<div class="card"><h2>Probeprüfung ' + esc(X.t) + '</h2><ul class="regeln"><li>' + qs.length + ' Auswahlaufgaben, ' + X.min + ' Minuten.</li><li>Genau eine Antwort ist richtig. Du kannst zwischen den Aufgaben springen und Antworten ändern.</li><li>Lösungen und Note siehst du erst nach der Abgabe.</li><li>Erlaubt wie in der Prüfung: Tabellenbuch und Taschenrechner.</li></ul><p><button type="button" class="btn" id="los">Prüfung starten</button><button type="button" class="btn zwei" id="zurueck">Zurück</button></p></div>';
    $('#zurueck').onclick = start; hoch(); fokus('#los');
    $('#los').onclick = () => {
      run = { art: 'exam', X, qs, ant: qs.map(() => -1), i: 0, ende: Date.now() + X.min * 60000, frage: false };
      doc.documentElement.classList.add('pi-lauf'); stopUhrNur(); uhr = setInterval(tick, 1000); pruefZeige();
    };
  }
  function stopUhrNur() { if (uhr) { clearInterval(uhr); uhr = null; } }
  const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)), p = n => (n < 10 ? '0' : '') + n; return p(Math.floor(s / 60)) + ':' + p(s % 60); };
  function tick() {
    const R = run; if (!R || R.art !== 'exam') { stopUhr(); return; }
    const rest = R.ende - Date.now(), el = $('#zeit'); if (el) { el.textContent = mmss(rest); el.classList.toggle('knapp', rest < 300000); }
    if (rest <= 0) pruefEnde(true);
  }
  function pruefZeige() {
    const R = run; if (!R) return; const q = R.qs[R.i], offen = R.ant.filter(a => a < 0).length;
    out().innerHTML = '<div class="card tmr"><span><b>' + esc(R.X.t) + '</b></span><span class="zeit" id="zeit" role="timer" aria-label="Restzeit">' + mmss(R.ende - Date.now()) + '</span></div>'
      + '<div class="card"><p class="mute kl">Aufgabe ' + (R.i + 1) + ' von ' + R.qs.length + ' · ' + esc(gName(q.g)) + '</p><h2 class="fr">' + esc(q.q) + '</h2><div role="radiogroup" aria-label="Antworten">'
      + q.opts.map((o, k) => '<button type="button" class="opt" role="radio" aria-checked="' + (R.ant[R.i] === k ? 'true' : 'false') + '" data-k="' + k + '">' + esc(o) + '</button>').join('') + '</div>'
      + '<p class="navz"><button type="button" class="btn zwei" id="vor"' + (R.i === 0 ? ' disabled' : '') + '>‹ Zurück</button><button type="button" class="btn" id="nach"' + (R.i + 1 >= R.qs.length ? ' disabled' : '') + '>Weiter ›</button></p></div>'
      + '<div class="card"><p class="mute kl">Übersicht (' + (R.qs.length - offen) + ' von ' + R.qs.length + ' beantwortet)</p><div class="nrn">' + R.qs.map((x, k) => '<button type="button" class="nr' + (R.ant[k] >= 0 ? ' da' : '') + (k === R.i ? ' akt' : '') + '" data-n="' + k + '" aria-label="Aufgabe ' + (k + 1) + (R.ant[k] >= 0 ? ', beantwortet' : ', offen') + '">' + (k + 1) + '</button>').join('') + '</div>'
      + '<p id="abgabeP">' + (R.frage ? '<span class="rm no" role="alert">' + (offen ? 'Noch ' + offen + (offen === 1 ? ' Aufgabe' : ' Aufgaben') + ' offen. ' : '') + 'Wirklich abgeben?</span> <button type="button" class="btn" id="abgJa">Ja, abgeben</button><button type="button" class="btn zwei" id="abgNein">Weiterarbeiten</button>' : '<button type="button" class="btn" id="abg">Prüfung abgeben</button>') + '</p></div>';
    out().querySelectorAll('.opt').forEach(b => { b.onclick = () => { R.ant[R.i] = +b.dataset.k; R.frage = false; pruefZeige(); fokus('.opt[aria-checked=true]'); }; });
    out().querySelectorAll('.nr').forEach(b => { b.onclick = () => { R.i = +b.dataset.n; R.frage = false; pruefZeige(); hoch(); }; });
    $('#vor').onclick = () => { R.i--; R.frage = false; pruefZeige(); hoch(); }; $('#nach').onclick = () => { R.i++; R.frage = false; pruefZeige(); hoch(); };
    if (R.frage) { $('#abgJa').onclick = () => pruefEnde(false); $('#abgNein').onclick = () => { R.frage = false; pruefZeige(); }; fokus('#abgJa'); }
    else $('#abg').onclick = () => { R.frage = true; pruefZeige(); };
  }
  function pruefEnde(zeitUm) {
    const R = run; if (!R || R.art !== 'exam') return; stopUhr();
    const now = Date.now(), A = auswerten(R.qs, R.ant); let neu = 0;
    R.qs.forEach((q, i) => { neu += buche(q, R.ant[i] === q.r, now); });
    const S = merke(rd(KEY, {}), R.qs.map(q => q.id)); S.hist.push({ t: now, k: R.X.k, pct: A.pct, ok: A.ok, n: A.n, note: A.note }); S.hist = S.hist.slice(-MAXH); wr(KEY, S);
    const fq = A.n - A.ok;
    out().innerHTML = '<div class="card"><h2>Ergebnis ' + esc(R.X.t) + '</h2>' + (zeitUm ? '<p class="rm no" role="status">Die Zeit ist abgelaufen, die Prüfung wurde abgegeben.</p>' : '')
      + '<p class="pct ' + (A.bestanden ? 'g' : 'b') + '">' + A.pct + ' %</p><p><b>' + A.ok + ' von ' + A.n + ' richtig, Note ' + A.note + ' (' + NOTEN[A.note] + ').</b> ' + (A.bestanden ? 'Das wäre bestanden.' : 'Für ausreichend brauchst du mindestens 50 %.') + '</p>'
      + '<table class="je"><thead><tr><th scope="col">Gebiet</th><th scope="col">richtig</th></tr></thead><tbody>' + Object.keys(A.je).map(g => '<tr><td>' + esc(gName(g)) + '</td><td>' + A.je[g].r + ' von ' + A.je[g].n + '</td></tr>').join('') + '</tbody></table>'
      + (fq ? '<p>' + (fq === 1 ? 'Dein Fehler liegt' : 'Deine ' + fq + ' Fehler liegen') + ' als Lernkarte in Fach 1. <a href="karten.html?art=p">Fehlerkarten jetzt üben</a></p>' : '')
      + '<p><button type="button" class="btn" id="zurueck">Zur Übersicht</button></p></div><div class="card"><h2>Alle Aufgaben mit Lösung</h2>'
      + R.qs.map((q, i) => { const ok = R.ant[i] === q.r; return '<div class="rl ' + (ok ? 'ok' : 'no') + '"><b>' + (ok ? '✓ ' : '✗ ') + (i + 1) + '. ' + esc(q.q) + '</b><br>Richtig: ' + esc(q.opts[q.r]) + (ok ? '' : '<br>Deine Antwort: ' + (R.ant[i] >= 0 ? esc(q.opts[R.ant[i]]) : 'keine')) + '<div class="mute">' + esc(q.w) + '</div></div>'; }).join('') + '</div>';
    run = null; $('#zurueck').onclick = start; hoch(); fokus('#zurueck');
  }
  root.addEventListener('beforeunload', e => { if (run && run.art === 'exam') { e.preventDefault(); e.returnValue = ''; } });

  function init() {
    B = bestand(root.PR_POOL_IM, root.PR_POOL);
    if (!B.q.length) { out().innerHTML = '<p class="rm no" role="alert">Die Aufgaben konnten nicht geladen werden. Öffne die Seite einmal mit Internet, danach geht sie offline.</p>'; return; }
    if (par.g && B.groups.some(g => g.k === par.g)) { uebStart({ g: par.g }); return; }
    start();
    if (par.tab === 'ueben') { const e = $('#ueben'); if (e && e.scrollIntoView) e.scrollIntoView(); }
  }
  core.ui = { start, uebStart, pruefStart, stand: () => run };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : globalThis);
