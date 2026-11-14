'use strict';
/* Tonfunk Lab: 10-Minuten-Einheit (Knopf auf der Startseite, neben „Weitermachen“).
   Eine kurze Einheit aus 6 Aufgaben: 3 Lernkarten, 2 Rechenaufgaben, 1 Prüfungsfrage. Läuft offline (alle Quellen liegen im Cache), zeigt einen Fortschrittsbalken und am Ende eine Zusammenfassung.
   Auswahl (wahl, reine Funktion, node-testbar):
   - Lernkarten: zuerst fällige Karten (niedriges Fach zuerst, Karten aus eigenen Prüfungsfehlern vor Wiki-Karten, dann am längsten überfällig), danach neue Karten, zuletzt noch nicht fällige.
   - Rechenaufgaben und Prüfungsfrage: aus dem Prüfungs-Pool, Themen mit schwacher Quote (pr.state.tr, mindestens 3 Antworten) werden bevorzugt, zwei Rechenaufgaben aus verschiedenen Themen, bevorzugt Niveau 1 und 2,
     Aufgaben der letzten Einheiten (lm4.e10.last) zuerst ausgelassen.
   - Beruf (lm4.beruf): Elektroniker und Industrieelektriker ziehen aus Teil 1 und Teil 2 (Systementwurf, Funktions- und Systemanalyse), Industriekaufleute aus Wirtschafts- und Sozialkunde, die übrigen Berufe
     (Mechaniker, Produktdesigner, Lagerlogistik, Fachinformatiker) bekommen Mehrfachwahl-Fragen ihres Berufs (PR_BANK.drawBeruf); wo es keine Rechenaufgaben gibt, ersetzen zwei weitere Fragen sie. Bei diesen Berufen kommen
     Wiki-Karten nur nach den eigenen Prüfungs-Karten und den Begriffen.
   Ergebnisse fließen in die vorhandene Fortschrittslogik: Karten im Leitner-Kasten (lm4.karten bzw. lm4.pkarten, Abstände 0, 1, 3, 7, 14 Tage), Pool-Aufgaben in die Prüfungsstatistik (pr.state.tr),
   falsch beantwortete Fragen als neue Lernkarten (pkarten.js). Die Einheit selbst steht in lm4.e10 = { n: Einheiten, tage: { "JJJJ-MM-TT": Anzahl }, last: [Ids], ok, tot }.
   Fälligkeit der Aufgaben-Wiederholung (wiederholen.js) wird in der Zusammenfassung nur angezeigt, nicht verändert. */
(function (root) {
  const DAY = 86400000, ABST = [0, 1, 3, 7, 14], N_KARTE = 3, N_RECHNEN = 2, N_PRUEF = 1, KEY = 'lm4.e10', KEEP = 40;
  const ELEKTRO = ['egs', 'ige'], POOLTEIL = { egs: ['Teil1', 'SysE', 'FuSa'], ige: ['Teil1', 'SysE', 'FuSa'], ik: ['WiSo'] };
  const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
  const num = v => { const x = +v; return isFinite(x) ? x : 0; };
  const rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const shuffle = (arr, r) => { const x = arr.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = x[i]; x[i] = x[j]; x[j] = t; } return x; };
  const fach = st => (st && st[0] >= 1 && st[0] <= 5) ? st[0] : 1;
  /* Leitner wie karten.js: gewusst = ein Fach höher, sonst Fach 1 und sofort fällig */
  const kAntwort = (st, gewusst, now) => { const f = fach(st), n = gewusst ? Math.min(5, f + 1) : 1; return [n, now + (gewusst ? ABST[n - 1] * DAY : 0)]; };
  const tagKey = now => { const d = new Date(now), p = n => (n < 10 ? '0' : '') + n; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };

  /* Quote je Pool-Gruppe aus pr.state.tr (Schlüssel 'p:<gruppe>@<1|2>', beide Bereiche zusammen, mindestens 3 Antworten): { gruppe: Prozent richtig } */
  function schwach(tr) {
    const s = {}; if (!isObj(tr)) return {};
    Object.keys(tr).forEach(k => { const m = /^p:([^@]+)@\d$/.exec(k); if (!m) return; const t = tr[k]; if (!isObj(t)) return; const a = s[m[1]] = s[m[1]] || { r: 0, n: 0 }; a.r += num(t.r); a.n += num(t.n); });
    const out = {}; Object.keys(s).forEach(g => { if (s[g].n >= 3) out[g] = Math.round(100 * s[g].r / s[g].n); }); return out;
  }
  /* Lernkarten: karten = [[id, art, Titel, Antwort, Teil]], st = { id: [fach, fällig ms] } (auch die Karten aus Prüfungsfehlern, art 'p') */
  function waehleKarten(karten, st, beruf, now, r, n) {
    n = n == null ? N_KARTE : n; st = isObj(st) ? st : {};
    let cand = (karten || []).filter(k => ELEKTRO.indexOf(beruf) >= 0 || k[1] === 'p' || k[1] === 'b');
    if (cand.length < n) cand = (karten || []).slice();
    const has = k => !!st[k[0]], due = k => has(k) && st[k[0]][1] <= now, pr = k => (k[1] === 'p' ? 0 : 1);
    const f = cand.filter(due).sort((a, b) => fach(st[a[0]]) - fach(st[b[0]]) || pr(a) - pr(b) || st[a[0]][1] - st[b[0]][1] || (a[0] < b[0] ? -1 : 1));
    const neu = shuffle(cand.filter(k => !has(k)), r);
    const spaeter = cand.filter(k => has(k) && !due(k)).sort((a, b) => st[a[0]][1] - st[b[0]][1] || (a[0] < b[0] ? -1 : 1));
    return f.concat(neu, spaeter).slice(0, n).map(k => ({ typ: 'karte', id: k[0], art: k[1], front: k[2], back: k[3], teil: k[4] || '', faellig: due(k), fach: fach(st[k[0]]) }));
  }
  /* Eine Gruppe wählen: Gewicht 1, schwache Gruppen (unter 60 %) bis 2,5-fach; ausgeschlossene Gruppen nur, wenn nichts anderes bleibt */
  function waehleGruppe(gruppen, weak, ausser, r) {
    let gs = gruppen.filter(g => ausser.indexOf(g) < 0); if (!gs.length) gs = gruppen.slice(); if (!gs.length) return null;
    const w = gs.map(g => { const p = weak[g]; return p != null && p < 60 ? 1 + 1.5 * (60 - p) / 60 : 1; }), sum = w.reduce((s, x) => s + x, 0);
    let x = r() * sum; for (let i = 0; i < gs.length; i++) { x -= w[i]; if (x <= 0) return gs[i]; } return gs[gs.length - 1];
  }
  const teilNr = t => (t === 'Teil1' ? 1 : 2);
  /* Pool-Aufgabe -> Frage im Format des Prüfungs-Labs; Mehrfachwahl bekommt gemischte Antworten */
  function poolFrage(p, r) {
    const base = { id: p.id, pool: true, g: p.g, teil: p.teil, niv: p.n, k: 'p:' + p.g + '@' + teilNr(p.teil), q: p.q, w: p.w };
    if (p.o) { const idx = shuffle(p.o.map((x, i) => i), r); return Object.assign(base, { type: 'mc', opts: idx.map(i => p.o[i]), r: idx.indexOf(p.r) }); }
    return Object.assign(base, { type: 'num', ans: p.ans, unit: p.u || '', tol: p.tol });
  }
  /* Rechenaufgaben und Prüfungsfrage aus dem Pool. in: { pool, beruf, tr, recent, r } */
  function waehlePool(pool, beruf, tr, recent, r, nCalc, nMc) {
    const teile = POOLTEIL[beruf]; if (!teile || !Array.isArray(pool)) return null;
    const src = pool.filter(p => teile.indexOf(p.teil) >= 0), weak = schwach(tr), seen = {}; (recent || []).forEach(i => { seen[i] = 1; });
    const out = [], used = [], exu = {};   // exu: schon gezogene Ausschlussgruppen (Pool-Feld ex)
    const nimm = (istMc, n, typ) => {
      const alle = src.filter(p => (istMc ? !!p.o : !p.o));
      for (let i = 0; i < n; i++) {
        const frei = alle.filter(p => !p.ex || !exu[p.ex]), liste = frei.length ? frei : alle;   // belegte Ausschlussgruppen nur, wenn sonst nichts bleibt
        const gruppen = Array.from(new Set(liste.map(p => p.g))), g = waehleGruppe(gruppen, weak, used, r); if (g == null) return;
        used.push(g);
        let c = liste.filter(p => p.g === g && !seen[p.id] && !out.some(o => o.q.id === p.id)); if (!c.length) c = liste.filter(p => p.g === g && !out.some(o => o.q.id === p.id)); if (!c.length) return;
        const leicht = c.filter(p => (p.n || 2) <= 2); c = leicht.length ? leicht : c;
        const wahl = c[Math.floor(r() * c.length)]; if (wahl.ex) exu[wahl.ex] = 1;
        out.push({ typ, q: poolFrage(wahl, r) });
      }
    };
    nimm(false, nCalc, 'rechnen'); const nd = out.length;
    nimm(true, nMc + (nCalc - nd), 'pruef');   // fehlen Rechenaufgaben (z. B. kleine Auswahl), kommen Fragen dazu
    return out;
  }
  /* Mehrfachwahl-Fragen aus dem Berufsbank (PR_BANK.drawBeruf) für Berufe ohne Pool-Rechenaufgaben */
  function waehleBank(bank, beruf, recent, r, n) {
    if (!bank || !bank.themen || !bank.draw) return [];
    const ts = bank.themen(beruf), seen = {}; (recent || []).forEach(i => { seen[i] = 1; }); let all = [];
    shuffle(ts, r).forEach(t => { all = all.concat(bank.draw(t, 99, Math.floor(r() * 1e9)).map(q => Object.assign({}, q, { bank: true }))); });
    let c = all.filter(q => !seen[q.id]); if (c.length < n) c = all;
    return shuffle(c, r).slice(0, n).map(q => ({ typ: 'pruef', q }));
  }
  /* Die ganze Einheit. in: { now, seed, beruf, karten, kstand, pool, tr, recent, bank } -> { items, plan } */
  function wahl(inp) {
    const now = num(inp.now) || Date.now(), r = rng(inp.seed == null ? now : inp.seed), beruf = inp.beruf || 'egs';
    const karten = waehleKarten(inp.karten, inp.kstand, beruf, now, r), n = N_RECHNEN + N_PRUEF;
    let fragen = waehlePool(inp.pool, beruf, inp.tr, inp.recent, r, N_RECHNEN, N_PRUEF);
    if (!fragen || fragen.length < n) fragen = (fragen || []).concat(waehleBank(inp.bank, beruf, inp.recent, r, n - (fragen || []).length));
    return { items: karten.concat(fragen), plan: { karten: karten.length, rechnen: fragen.filter(f => f.typ === 'rechnen').length, pruef: fragen.filter(f => f.typ === 'pruef').length, beruf } };
  }
  /* Antwort bewerten wie im Prüfungs-Lab: Mehrfachwahl = Index, Rechnen = Zahl mit Toleranz (Komma oder Punkt) */
  function parse(s) { const x = parseFloat(String(s == null ? '' : s).replace(/\s/g, '').replace(',', '.')); return isFinite(x) ? x : NaN; }
  function richtig(q, a) {
    if (a == null || a === '') return false;
    if (q.type === 'mc') return a === q.r;
    const x = parse(a); if (isNaN(x)) return false;
    return q.tol === 0 ? Math.abs(x - q.ans) < 0.5 : Math.abs(x - q.ans) <= Math.max(num(q.tol == null ? 0.02 : q.tol) * Math.abs(q.ans), 1e-9);
  }
  /* Einheiten-Stand (lm4.e10) säubern und eine abgeschlossene Einheit eintragen */
  function normE(e) {
    const o = { n: 0, tage: {}, last: [], ok: 0, tot: 0 }; if (!isObj(e)) return o;
    o.n = Math.max(0, Math.round(num(e.n))); o.ok = Math.max(0, Math.round(num(e.ok))); o.tot = Math.max(0, Math.round(num(e.tot)));
    if (isObj(e.tage)) Object.keys(e.tage).forEach(k => { if (/^\d{4}-\d{2}-\d{2}$/.test(k) && num(e.tage[k]) > 0) o.tage[k] = Math.round(num(e.tage[k])); });
    if (Array.isArray(e.last)) o.last = e.last.filter(x => typeof x === 'string' && /^[A-Za-z0-9_.-]{1,60}$/.test(x)).slice(-KEEP);
    return o;
  }
  function buche(e, ids, ok, tot, now) {
    const o = normE(e); o.n++; o.ok += ok; o.tot += tot; const k = tagKey(now); o.tage[k] = (o.tage[k] || 0) + 1;
    ids.forEach(i => { if (typeof i === 'string' && /^[A-Za-z0-9_.-]{1,60}$/.test(i)) { const j = o.last.indexOf(i); if (j >= 0) o.last.splice(j, 1); o.last.push(i); } });
    o.last = o.last.slice(-KEEP); return o;
  }
  /* Prüfungsstatistik wie addTr in pruefwerk.js: pr.state.tr['p:<g>@<n>'] = { r, n, t } */
  function trBuchen(state, k, ok, now) { const s = isObj(state) ? state : {}; s.tr = isObj(s.tr) ? s.tr : {}; const t = s.tr[k] = isObj(s.tr[k]) ? s.tr[k] : { r: 0, n: 0 }; t.r = num(t.r) + (ok ? 1 : 0); t.n = num(t.n) + 1; t.t = now; return s; }
  const minuten = 10, text = { karte: 'Lernkarte', rechnen: 'Rechenaufgabe', pruef: 'Prüfungsfrage' };
  const sub = 'Heute: 3 Karten, 2 Rechenaufgaben, 1 Prüfungsfrage';
  const api = { DAY, ABST, N_KARTE, N_RECHNEN, N_PRUEF, KEY, ELEKTRO, POOLTEIL, schwach, waehleKarten, waehlePool, waehleBank, wahl, richtig, parse, kAntwort, normE, buche, trBuchen, tagKey, poolFrage, rng, text, sub };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.Einheit10 = api;

  /* ---------- Browserteil ---------- */
  if (typeof document === 'undefined') return;
  const doc = document;
  const rd = (k, d) => { try { const v = localStorage.getItem(k); const o = v == null ? d : JSON.parse(v); return o == null ? d : o; } catch (e) { return d; } };
  const wr = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const beruf = () => { try { if (root.Berufe && root.Berufe.get) return root.Berufe.get() || 'egs'; } catch (e) {} const b = rd('lm4.beruf', 'egs'); return typeof b === 'string' ? b : 'egs'; };
  /* Der Lernstand-Code (lernstand.js) nimmt nur Schlüssel aus Lernstand.PROGRESS mit: Einheit und Prüfungs-Karten eintragen */
  function registrieren() { try { const L = root.Lernstand; if (L && Array.isArray(L.PROGRESS)) ['lm4.pkarten', KEY].forEach(k => { if (L.PROGRESS.indexOf(k) < 0) L.PROGRESS.push(k); }); } catch (e) {} }
  registrieren(); doc.addEventListener('click', registrieren, true);

  const laden = src => new Promise((ok, fail) => { if (doc.querySelector('script[data-e10="' + src + '"]')) { ok(); return; } const s = doc.createElement('script'); s.src = src; s.setAttribute('data-e10', src); s.onload = () => ok(); s.onerror = () => fail(new Error(src)); doc.head.appendChild(s); });
  /* nur laden, was noch fehlt; Reihenfolge wie in den Lab-Seiten */
  async function quellen() {
    const need = [['KARTEN', 'karten-daten.js'], ['PKarten', 'pkarten.js'], ['PR_BANK', 'pruefbank.js'], ['PR_POOL', 'pruefpool.js']];
    for (const [g, f] of need) { if (!root[g]) await laden(f); }
    if (root.PR_BANK && !root.PR_BANK.drawBeruf) await laden('pruefbank-beruf.js');
  }
  const CSS = '#e10Go{display:flex;align-items:center;gap:12px;width:100%;min-height:56px;margin:0;padding:10px 14px;border-radius:14px;border:1px solid var(--accent,#3b9eff);background:var(--panel,#222830);color:var(--fg,#e8ecf0);font:inherit;text-align:left;cursor:pointer;align-self:stretch;box-sizing:border-box;touch-action:manipulation}'
    + '#e10Go:hover{filter:brightness(1.08)}#e10Go:focus-visible,#e10Box button:focus-visible,#e10Box input:focus-visible{outline:3px solid var(--focus,#ffd166);outline-offset:2px}'
    + '#e10Go .e10i{flex:none;font-size:26px;line-height:1}#e10Go .e10t{flex:1;min-width:0}#e10Go b{display:block;font-size:16px;line-height:1.25}#e10Go small{display:block;color:var(--mute,#9aa6b2);font-size:14px;line-height:1.3}#e10Go .e10p{flex:none;color:var(--accent,#3b9eff);font-size:18px}'
    + '#e10Box{position:fixed;inset:0;z-index:310;background:rgba(0,0,0,.65);display:flex;align-items:flex-start;justify-content:center;overflow:auto;-webkit-overflow-scrolling:touch;padding:calc(12px + env(safe-area-inset-top)) 12px calc(12px + env(safe-area-inset-bottom)) 12px;box-sizing:border-box}'
    + '#e10Box .e10p{background:var(--panel,#222830);color:var(--fg,#e8ecf0);border:1px solid var(--line,#38424d);border-radius:16px;max-width:600px;width:100%;padding:14px 16px 16px;font:15px/1.45 system-ui,sans-serif;box-sizing:border-box}'
    + '#e10Box .e10h{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px}#e10Box .e10h b{font-size:17px}'
    + '#e10Box .e10x{flex:none;min-width:48px;height:44px;border-radius:12px;background:var(--panel2,#2c343e);border:1px solid var(--line,#46525f);color:var(--fg,#e8ecf0);font-size:22px;cursor:pointer}'
    + '#e10Box .e10bar{height:10px;border-radius:6px;background:var(--panel2,#2c343e);border:1px solid var(--line,#38424d);overflow:hidden}#e10Box .e10bar i{display:block;height:100%;background:var(--accent,#3b9eff);transition:width .25s}'
    + '#e10Box .e10m{color:var(--mute,#9aa6b2);font-size:14px;margin:6px 0 10px}#e10Box h2{font-size:19px;line-height:1.3;margin:4px 0 10px;overflow-wrap:anywhere}#e10Box .e10q{font-size:17px;line-height:1.45;margin:4px 0 12px;overflow-wrap:anywhere}'
    + '#e10Box .e10a{border-left:4px solid var(--accent,#3b9eff);padding:6px 12px;margin:10px 0;font-size:16px;overflow-wrap:anywhere}'
    + '#e10Box .e10b{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 0}#e10Box .e10b button,#e10Box .e10o{min-height:48px;padding:8px 16px;border-radius:12px;border:1px solid var(--line,#46525f);background:var(--panel2,#2c343e);color:var(--fg,#e8ecf0);font:600 15px/1.3 system-ui,sans-serif;cursor:pointer;touch-action:manipulation}'
    + '#e10Box .e10b button.pri{background:var(--accent-bg,#1a6fd4);border-color:var(--accent-bg,#1a6fd4);color:var(--accent-ink,#fff)}#e10Box .e10b button{flex:1 1 140px}'
    + '#e10Box .e10o{display:block;width:100%;text-align:left;margin:6px 0;font-weight:500}#e10Box .e10o[aria-checked=true]{border-color:var(--accent,#3b9eff);box-shadow:inset 0 0 0 2px var(--accent,#3b9eff)}#e10Box .e10o.ok{border-color:var(--ok,#4cd964);box-shadow:inset 0 0 0 2px var(--ok,#4cd964)}#e10Box .e10o.no{border-color:var(--danger,#ff8a7a);box-shadow:inset 0 0 0 2px var(--danger,#ff8a7a)}'
    + '#e10Box input.e10n{min-height:48px;width:min(220px,60%);padding:6px 10px;border-radius:10px;border:1px solid var(--line,#46525f);background:var(--bg,#14181c);color:var(--fg,#e8ecf0);font:17px system-ui}'
    + '#e10Box .e10r{margin:10px 0;padding:8px 12px;border-radius:10px;border:1px solid var(--line,#38424d);overflow-wrap:anywhere}#e10Box .e10r.ok{border-color:var(--ok,#4cd964)}#e10Box .e10r.no{border-color:var(--danger,#ff8a7a)}#e10Box .e10r b.ok{color:var(--ok,#4cd964)}#e10Box .e10r b.no{color:var(--danger,#ff8a7a)}'
    + '#e10Box ul.e10l{list-style:none;margin:8px 0;padding:0}#e10Box ul.e10l li{display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid var(--line,#38424d)}#e10Box a{color:var(--accent,#5fb0ff)}'
    + '@media(max-width:420px){#e10Box .e10p{padding:12px}#e10Box .e10b button{flex:1 1 100%}}';
  function css() { if (doc.getElementById('e10Css')) return; const st = doc.createElement('style'); st.id = 'e10Css'; st.textContent = CSS; doc.head.appendChild(st); }

  let box = null, opener = null, run = null;
  function schliessen() { if (box) { box.remove(); box = null; } doc.removeEventListener('keydown', taste, true); run = null; if (opener && opener.focus) { try { opener.focus(); } catch (e) {} } opener = null; }
  function taste(e) { if (e.key === 'Escape' && box) { e.preventDefault(); schliessen(); } }
  function geruest() {
    css(); if (box) box.remove();
    box = doc.createElement('div'); box.id = 'e10Box'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', '10-Minuten-Einheit');
    box.innerHTML = '<div class="e10p"><div class="e10h"><b>⏱ 10-Minuten-Einheit</b><button type="button" class="e10x" aria-label="Schließen">✕</button></div><div id="e10In"></div></div>';
    doc.body.appendChild(box); box.querySelector('.e10x').onclick = schliessen; box.addEventListener('pointerdown', e => { if (e.target === box) schliessen(); }); doc.addEventListener('keydown', taste, true);
  }
  const inn = () => box && box.querySelector('#e10In');
  const bar = (i, n, label) => '<div class="e10bar" role="progressbar" aria-valuemin="0" aria-valuemax="' + n + '" aria-valuenow="' + i + '" aria-label="Fortschritt: ' + i + ' von ' + n + ' erledigt"><i style="width:' + Math.round(100 * i / n) + '%"></i></div><p class="e10m">' + label + '</p>';
  const fokus = sel => { const el = box && box.querySelector(sel); if (el && el.focus) { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } } };

  async function start() {
    opener = doc.activeElement; geruest(); inn().innerHTML = '<p class="e10m" role="status">Einheit wird zusammengestellt …</p>';
    try { await quellen(); } catch (e) { if (inn()) inn().innerHTML = '<p class="e10r no" role="alert">Die Einheit konnte nicht geladen werden (' + esc(e.message) + '). Öffne die Startseite einmal mit Internet, danach geht sie offline.</p><div class="e10b"><button type="button" class="pri" id="e10Zu">Schließen</button></div>'; if (box) { box.querySelector('#e10Zu').onclick = schliessen; fokus('#e10Zu'); } return; }
    if (!box) return;
    const now = Date.now(), PK = root.PKarten, pk = PK ? PK.laden() : {}, kst = rd('lm4.karten', {}), st = Object.assign({}, isObj(kst) ? kst : {});
    Object.keys(pk).forEach(id => { st[id] = PK.stateOf(pk[id]); });
    const B = root.PR_BANK, ps = rd('pr.state', {}), e10 = normE(rd(KEY, {}));
    const w = wahl({ now, seed: now % 1000000000, beruf: beruf(), karten: (root.KARTEN || []).concat(PK ? PK.toKarten(pk) : []), kstand: st, pool: root.PR_POOL && root.PR_POOL.q, tr: ps && ps.tr, recent: e10.last,
      bank: B && B.drawBeruf ? { themen: b => (B.themenFuer ? B.themenFuer(b) : []).map(t => t.k), draw: (k, n, seed) => B.drawBeruf(k, n, seed) } : null });
    if (!w.items.length) { inn().innerHTML = '<p class="e10m">Für heute gibt es keine passende Aufgabe. Wähle ein Lab auf der Startseite.</p><div class="e10b"><button type="button" class="pri" id="e10Zu">Schließen</button></div>'; box.querySelector('#e10Zu').onclick = schliessen; return; }
    run = { items: w.items, i: 0, res: [], neu: 0, vor: 0, start: now };
    zeige();
  }
  function zeige() {
    const R = run, el = inn(); if (!R || !el) return;
    if (R.i >= R.items.length) { ende(); return; }
    const it = R.items[R.i], head = bar(R.i, R.items.length, 'Aufgabe ' + (R.i + 1) + ' von ' + R.items.length + ' · ' + text[it.typ]);
    if (it.typ === 'karte') {
      el.innerHTML = head + '<h2>' + esc(it.front) + '</h2>' + (it.phase ? '<div class="e10a">' + esc(it.back).replace(/\n/g, '<br>') + '</div><div class="e10b"><button type="button" class="pri" id="e10Ja">Gewusst</button><button type="button" id="e10Nein">Nicht gewusst</button></div>'
        : '<p class="e10m">Überlege zuerst, was du dazu weißt. Dann deck die Antwort auf.</p><div class="e10b"><button type="button" class="pri" id="e10Auf">Antwort zeigen</button></div>');
      if (it.phase) { box.querySelector('#e10Ja').onclick = () => karteFertig(true); box.querySelector('#e10Nein').onclick = () => karteFertig(false); fokus('#e10Ja'); }
      else { box.querySelector('#e10Auf').onclick = () => { it.phase = 1; zeige(); }; fokus('#e10Auf'); }
      return;
    }
    const q = it.q;
    if (it.fertig) { feedback(it, head); return; }
    if (q.type === 'mc') {
      el.innerHTML = head + '<div class="e10q">' + esc(q.q) + '</div><div role="radiogroup" aria-label="Antworten">' + q.opts.map((o, k) => '<button type="button" class="e10o" role="radio" aria-checked="' + (it.sel === k ? 'true' : 'false') + '" data-k="' + k + '">' + esc(o) + '</button>').join('') + '</div><div class="e10b"><button type="button" class="pri" id="e10Ok">Antwort prüfen</button></div><p class="e10m" id="e10Hint" role="status"></p>';
      box.querySelectorAll('.e10o').forEach(b => { b.onclick = () => { it.sel = +b.dataset.k; box.querySelectorAll('.e10o').forEach(x => x.setAttribute('aria-checked', x === b ? 'true' : 'false')); }; });
      box.querySelector('#e10Ok').onclick = () => { if (it.sel == null) { box.querySelector('#e10Hint').textContent = 'Wähle zuerst eine Antwort.'; return; } frageFertig(it, it.sel); };
    } else {
      el.innerHTML = head + '<div class="e10q">' + esc(q.q) + '</div><p><input class="e10n" id="e10N" inputmode="decimal" autocomplete="off" aria-label="Deine Antwort" placeholder="Zahl eingeben" value="' + esc(it.txt || '') + '"> <span>' + esc(q.unit) + '</span></p><div class="e10b"><button type="button" class="pri" id="e10Ok">Antwort prüfen</button></div><p class="e10m" id="e10Hint" role="status"></p>';
      const inp = box.querySelector('#e10N'), go = () => { const v = inp.value; it.txt = v; if (isNaN(parse(v))) { box.querySelector('#e10Hint').textContent = 'Gib eine Zahl ein (Komma oder Punkt).'; return; } frageFertig(it, v); };
      box.querySelector('#e10Ok').onclick = go; inp.onkeydown = e => { if (e.key === 'Enter') go(); }; fokus('#e10N');
    }
  }
  function karteFertig(ok) {
    const R = run, it = R.items[R.i], now = Date.now(), PK = root.PKarten;
    if (it.art === 'p' && PK) { const pk = PK.laden(); if (pk[it.id]) { PK.sichern(PK.antwort(pk, it.id, ok, now)); } }
    else { const s = rd('lm4.karten', {}), o = isObj(s) ? s : {}; o[it.id] = kAntwort(o[it.id], ok, now); wr('lm4.karten', o); }
    R.res.push({ typ: 'karte', ok, id: it.id }); R.i++; zeige();
  }
  function frageFertig(it, a) {
    const q = it.q, ok = richtig(q, a), now = Date.now(); it.antwort = a; it.ok = ok; it.fertig = true;
    if (q.pool) { const s = rd('pr.state', {}); wr('pr.state', trBuchen(s, q.k, ok, now)); }
    if (!ok && root.PKarten) { try { const r = root.PKarten.speichern([q], now); run.neu += r.neu; } catch (e) {} }
    run.res.push({ typ: it.typ, ok, id: q.id, g: q.g || '' }); zeige();
  }
  const antwortText = q => (q.type === 'mc' ? q.opts[q.r] : (root.PKarten ? root.PKarten.zahl(q.ans) : String(q.ans)) + (q.unit ? ' ' + q.unit : ''));
  function feedback(it, head) {
    const q = it.q, el = inn(), last = run.i + 1 >= run.items.length;
    let opts = '';
    if (q.type === 'mc') opts = '<div aria-label="Antworten">' + q.opts.map((o, k) => '<div class="e10o ' + (k === q.r ? 'ok' : k === it.sel ? 'no' : '') + '">' + (k === q.r ? '✓ ' : k === it.sel ? '✗ ' : '') + esc(o) + '</div>').join('') + '</div>';
    el.innerHTML = head + '<div class="e10q">' + esc(q.q) + '</div>' + opts + '<div class="e10r ' + (it.ok ? 'ok' : 'no') + '" role="status"><b class="' + (it.ok ? 'ok' : 'no') + '">' + (it.ok ? '✓ Richtig.' : '✗ Leider falsch.') + '</b>' + (it.ok && q.type === 'mc' ? '' : ' Richtig: ' + esc(antwortText(q)) + '.') + (q.w ? '<br>' + esc(q.w) : '') + (it.ok ? '' : '<br><small>Die Frage liegt jetzt als Lernkarte in Fach 1 („Aus Prüfung“).</small>') + '</div><div class="e10b"><button type="button" class="pri" id="e10Weiter">' + (last ? 'Zusammenfassung' : 'Weiter') + '</button></div>';
    box.querySelector('#e10Weiter').onclick = () => { run.i++; zeige(); }; fokus('#e10Weiter');
  }
  function ende() {
    const R = run, el = inn(), n = R.res.length, ok = R.res.filter(x => x.ok).length, now = Date.now();
    wr(KEY, buche(rd(KEY, {}), R.res.filter(x => x.typ !== 'karte').map(x => x.id), ok, n, now));
    const zeile = (t, typ) => { const l = R.res.filter(x => x.typ === typ); return l.length ? '<li><span>' + t + '</span><b>' + l.filter(x => x.ok).length + ' von ' + l.length + '</b></li>' : ''; };
    let wd = 0; try { if (root.Wiederholen && root.Wiederholen.stand) { const s = root.Wiederholen.stand(now); wd = s.liste.length; } } catch (e) {}
    const mins = Math.max(1, Math.round((now - R.start) / 60000));
    el.innerHTML = bar(n, n, 'Fertig in etwa ' + mins + (mins === 1 ? ' Minute' : ' Minuten')) + '<h2>' + (ok === n ? 'Alles richtig, stark!' : ok >= n / 2 ? 'Gut gemacht' : 'Weiter üben lohnt sich') + '</h2><p class="e10q"><b>' + ok + ' von ' + n + '</b> richtig.</p><ul class="e10l">' + zeile('Lernkarten gewusst', 'karte') + zeile('Rechenaufgaben', 'rechnen') + zeile('Prüfungsfrage', 'pruef') + '</ul>'
      + (R.neu ? '<p>' + (R.neu === 1 ? '1 Fehler wurde' : R.neu + ' Fehler wurden') + ' als Lernkarte gespeichert (Lernkarten, Filter „Aus Prüfung“).</p>' : '')
      + (wd ? '<p>' + (wd === 1 ? 'Außerdem wartet 1 Aufgabe' : 'Außerdem warten ' + wd + ' Aufgaben') + ' zum <a href="wiederholen.html">Wiederholen</a>.</p>' : '')
      + '<div class="e10b"><button type="button" class="pri" id="e10Nochmal">Noch eine Einheit</button><button type="button" id="e10Zu">Fertig</button></div>';
    box.querySelector('#e10Nochmal').onclick = start; box.querySelector('#e10Zu').onclick = schliessen; fokus('#e10Zu');
    try { root.dispatchEvent(new CustomEvent('einheit10:fertig', { detail: { ok, n } })); } catch (e) {}
  }

  /* Knopf direkt hinter „Weitermachen“ im Primärband */
  function mount() {
    const go = doc.getElementById('contGo'); if (!go || doc.getElementById('e10Go')) return; css();
    const b = doc.createElement('button'); b.type = 'button'; b.id = 'e10Go';
    b.innerHTML = '<span class="e10i" aria-hidden="true">⏱</span><span class="e10t"><b>10-Minuten-Einheit</b><small>' + sub + '</small></span><span class="e10p" aria-hidden="true">▶</span>';
    b.setAttribute('aria-label', '10-Minuten-Einheit starten: 3 Lernkarten, 2 Rechenaufgaben, 1 Prüfungsfrage');
    b.onclick = start; go.insertAdjacentElement('afterend', b);
  }
  if (doc.getElementById('top') && doc.getElementById('contGo')) { mount(); root.addEventListener('pageshow', mount); }
  root.Einheit10.start = start; root.Einheit10.mount = mount;
})(typeof window !== 'undefined' ? window : globalThis);
