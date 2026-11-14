'use strict';
/* Tonfunk Projekt-und-Wirtschaftlichkeits-Lab (Kürzel prj): reine Rechenlogik, ohne Oberfläche, auch per Node testbar.
   Blöcke: Lastenheft-Prüfer, Netzplan/CPM, Kosten (Stundensatz, Angebot, Break-even, Dreipunkt-Schätzung),
   Investitionsrechnung (Kapitalwert, interner Zinsfuß, Amortisation, Annuität, Vergleich, Sensitivität), Risiko (Matrix, FMEA, Pareto),
   Praxisbericht (Seitenbudget, Zitat-Baukasten).
   Rundung: Es wird NICHT zwischengerundet. Gerundet wird nur bei der Anzeige (fmtDe). Aufgaben geben Toleranzen an.
   Alle Zahlen in Aufgaben und Beispielen stammen aus diesen Funktionen; test_prjcore.js rechnet sie unabhängig nach.
   Export: window.PRJ_CORE bzw. module.exports (Node). */
(function (root) {
  const fin = v => typeof v === 'number' && isFinite(v);
  const rd = (v, d) => { const f = Math.pow(10, d); const s = v < 0 ? -1 : 1; return s * Math.round(Math.abs(v) * f + 1e-9) / f; };
  const r9 = v => Math.round(v * 1e9) / 1e9;

  /* ---------------- Zahlen deutsch ---------------- */
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NaN;
    s = String(s == null ? '' : s).replace(/[\s  ]+/g, '').replace(/(€|euro|eur|%|prozent|stück|stueck|stk\.?|h|std\.?|tage?|pt|jahre?|a)$/i, '').replace('−', '-');
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.'); else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
    if (!/^[+\-]?\d+(\.\d+)?$|^[+\-]?\.\d+$/.test(s)) return NaN;
    return parseFloat(s);
  }
  function fmtDe(v, dec, sign) {
    if (!fin(v)) return '–';
    dec = dec == null ? 2 : dec;
    let s = rd(v, dec).toFixed(dec);
    if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
    const neg = s[0] === '-'; if (neg) s = s.slice(1);
    const pp = s.split('.'); pp[0] = pp[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    s = pp.join(',');
    return (neg ? '−' : sign && v > 0 ? '+' : '') + s;
  }
  const trim0 = t => t.indexOf(',') < 0 ? t : t.replace(/0+$/, '').replace(/,$/, '');
  const fmtN = (v, dec) => trim0(fmtDe(v, dec == null ? 2 : dec));          /* 12,5 | 20 | 33,33 */
  const eur = (v, dec) => fmtDe(v, dec == null ? 2 : dec) + ' €';
  const pct = (v, dec) => fmtN(v, dec == null ? 2 : dec) + ' %';
  function checkNum(inp, v, tol) {
    const x = parseDe(inp);
    if (!fin(x)) return { ok: false, empty: String(inp == null ? '' : inp).trim() === '', nan: true };
    return { ok: Math.abs(x - v) <= (tol == null ? 0.01 : tol) + 1e-9, x };
  }

  /* ---------------- Zufall (seed-fähig) ---------------- */
  function hashStr(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    let a = (typeof seed === 'number' ? seed >>> 0 : hashStr(seed)) || 1;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const ri = (R, a, b, s) => { s = s || 1; return a + s * Math.floor(R() * (Math.floor((b - a) / s) + 1)); };
  const pick = (R, a) => a[Math.floor(R() * a.length)];
  const shuffle = (R, a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };

  /* ============================================================ Lastenheft: Anforderungs-Prüfer (Faustregeln, kein Ersatz für Prüfung durch Menschen) */
  const VAGUE = ['schnell', 'zügig', 'benutzerfreundlich', 'bedienerfreundlich', 'einfach', 'intuitiv', 'leicht', 'ausreichend', 'angemessen', 'möglichst', 'optimal', 'flexibel',
    'robust', 'modern', 'stabil', 'zuverlässig', 'gut', 'hohe', 'hoher', 'hohen', 'hohem', 'niedrig', 'geringe', 'wenig', 'viele', 'kurz', 'lang', 'groß', 'klein', 'ansprechend',
    'komfortabel', 'effizient', 'sicher', 'übersichtlich', 'etc', 'usw', 'und so weiter', 'gegebenenfalls', 'bei bedarf', 'in der regel', 'geeignet', 'unter umständen', 'eventuell', 'ca.', 'circa', 'ungefähr', 'etwa', 'und/oder', 'beliebig', 'jederzeit', 'sofort', 'immer'];
  const MODAL = /\b(muss|müssen|soll|sollen|kann|können|darf nicht|dürfen nicht)\b/i;
  /* Wörter, die allein nicht unscharf sind („sicher stillgesetzt“, „kurz“ mit Zahl daneben): nur ein Hinweis, kein Fehler */
  const SOFT = ['sicher', 'kurz', 'lang', 'groß', 'klein', 'hohe', 'hoher', 'hohen', 'hohem', 'immer'];
  const MODAL_ALL = /\b(muss|müssen|soll|sollen|kann|können|darf nicht|dürfen nicht)\b/gi;
  function analyseAnf(text) {
    const t = String(text == null ? '' : text).trim(), low = t.toLowerCase(), flags = [];
    if (!t) return { ok: false, empty: true, flags: [], hard: 0, hint: 0 };
    const vague = [];
    const soft = [];
    VAGUE.forEach(w => {
      const re = /[a-zäöüß]/.test(w[0]) && /^[a-zäöüß ]+$/.test(w) ? new RegExp('(^|[^a-zäöüß])' + w + '([^a-zäöüß]|$)', 'i') : null;
      if (re ? re.test(low) : low.indexOf(w) >= 0) (SOFT.indexOf(w) >= 0 ? soft : vague).push(w);
    });
    if (vague.length) flags.push({ k: 'vage', hard: true, txt: 'Unscharfe Wörter: ' + vague.join(', ') + '. Ersetze sie durch Zahl, Einheit oder ein prüfbares Kriterium.', words: vague });
    if (soft.length) flags.push({ k: 'weich', hard: false, txt: 'Hinweis: „' + soft.join('“, „') + '“ ist allein noch nicht messbar. Steht eine Zahl mit Einheit oder ein prüfbares Kriterium dabei, ist es in Ordnung.', words: soft });
    if (!MODAL.test(t)) flags.push({ k: 'modal', hard: true, txt: 'Keine Verbindlichkeit erkennbar. Schreibe „muss“, „soll“ oder „kann“.' });
    const nm = (t.match(MODAL_ALL) || []).length;
    if (nm >= 2) flags.push({ k: 'mehrere', hard: false, txt: 'Mehrere Verbindlichkeiten in einem Satz. Eine Anforderung je Satz lässt sich einzeln prüfen und verfolgen.' });
    if (!/\d/.test(t)) flags.push({ k: 'zahl', hard: true, txt: 'Keine Zahl, kein Grenzwert, keine Kennung. Frage dich: Womit würde man das Ergebnis messen oder abhaken?' });
    const hard = flags.filter(f => f.hard).length;
    return { ok: hard === 0, empty: false, flags, hard, hint: flags.length - hard };
  }
  /* Verfügbarkeit in Ausfallzeit je Jahr (365 Tage = 8760 h) */
  function ausfall(vPct) {
    if (!fin(vPct) || vPct < 0 || vPct > 100) return { ok: false, err: 'Verfügbarkeit zwischen 0 und 100 %.' };
    const hJahr = (1 - vPct / 100) * 8760;
    return { ok: true, hJahr, minMonat: hJahr * 60 / 12, minJahr: hJahr * 60 };
  }

  /* ============================================================ Netzplan / CPM (Vorgangsknoten, Anordnungsbeziehung Ende-Anfang, Zeitpunkte)
     Vorgang: { id, name, d (Dauer >= 0, 0 = Meilenstein), pre: [ids] }.  FAZ = früheste Anfangszeit, FEZ = FAZ + D, SEZ/SAZ spätest.
     GP = SAZ - FAZ, FP = frühester Anfang der Nachfolger - FEZ (ohne Nachfolger: Projektende - FEZ). */
  function cpm(acts) {
    if (!Array.isArray(acts) || !acts.length) return { ok: false, err: 'Keine Vorgänge vorhanden.' };
    const map = new Map(), list = [];
    for (const a of acts) {
      const id = String(a && a.id == null ? '' : a.id).trim();
      if (!id) return { ok: false, err: 'Ein Vorgang hat keine Kennung.' };
      if (map.has(id)) return { ok: false, err: 'Kennung „' + id + '“ kommt doppelt vor.' };
      const d = a.d;
      if (!fin(d) || d < 0) return { ok: false, err: 'Vorgang ' + id + ': Dauer muss eine Zahl ≥ 0 sein.' };
      const o = { id, name: a.name == null ? '' : String(a.name), d, pre: [], succ: [] };
      map.set(id, o); list.push(o);
    }
    for (const a of acts) {
      const o = map.get(String(a.id).trim()), seen = new Set();
      for (let p of (a.pre || [])) {
        p = String(p).trim(); if (!p || seen.has(p)) continue; seen.add(p);
        if (p === o.id) return { ok: false, err: 'Vorgang ' + o.id + ' ist sein eigener Vorgänger.' };
        if (!map.has(p)) return { ok: false, err: 'Vorgang ' + o.id + ': Vorgänger „' + p + '“ gibt es nicht.' };
        o.pre.push(p); map.get(p).succ.push(o.id);
      }
    }
    /* topologische Reihenfolge (Kahn) */
    const indeg = new Map(list.map(o => [o.id, o.pre.length])), order = [], q = list.filter(o => !o.pre.length).map(o => o.id);
    while (q.length) { const id = q.shift(); order.push(id); map.get(id).succ.forEach(s => { indeg.set(s, indeg.get(s) - 1); if (indeg.get(s) === 0) q.push(s); }); }
    if (order.length < list.length) return { ok: false, err: 'Die Vorgänger bilden einen Kreis (' + list.filter(o => !order.includes(o.id)).map(o => o.id).join(', ') + '). Ein Netzplan darf keine Schleife enthalten.' };
    order.forEach(id => { const o = map.get(id); o.es = o.pre.length ? Math.max.apply(null, o.pre.map(p => map.get(p).ef)) : 0; o.ef = r9(o.es + o.d); o.es = r9(o.es); });
    const duration = Math.max.apply(null, list.map(o => o.ef));
    order.slice().reverse().forEach(id => { const o = map.get(id); o.lf = o.succ.length ? Math.min.apply(null, o.succ.map(s => map.get(s).ls)) : duration; o.ls = r9(o.lf - o.d); o.lf = r9(o.lf); });
    list.forEach(o => {
      o.gp = r9(o.ls - o.es);
      o.fp = r9((o.succ.length ? Math.min.apply(null, o.succ.map(s => map.get(s).es)) : duration) - o.ef);
      o.crit = Math.abs(o.gp) < 1e-9;
    });
    const starts = list.filter(o => !o.pre.length).map(o => o.id), ends = list.filter(o => !o.succ.length).map(o => o.id);
    /* kritische Pfade: nur über kritische Vorgänge, deren Anschluss lückenlos ist (FEZ des Vorgängers = FAZ des Nachfolgers) */
    const cpaths = []; let capped = false;
    const walk = (id, path) => {
      if (cpaths.length >= 50) { capped = true; return; }
      const o = map.get(id), p = path.concat(id);
      if (!o.succ.length) { cpaths.push(p); return; }
      let any = false;
      o.succ.forEach(s => { const so = map.get(s); if (so.crit && Math.abs(so.es - o.ef) < 1e-9) { any = true; walk(s, p); } });
      if (!any && o.ef === duration) cpaths.push(p);
    };
    list.filter(o => o.crit && !o.pre.length && o.es === 0).forEach(o => walk(o.id, []));
    return { ok: true, list, map, order, duration, starts, ends, critical: list.filter(o => o.crit).map(o => o.id), paths: cpaths, pathsCapped: capped };
  }
  /* alle Wege Start -> Ende mit Längen (für die Wege-Tabelle; Obergrenze gegen Explosion) */
  function allPaths(res, cap) {
    cap = cap || 500; const out = []; let capped = false;
    const walk = (id, path, len) => {
      if (out.length >= cap) { capped = true; return; }
      const o = res.map.get(id), p = path.concat(id), l = len + o.d;
      if (!o.succ.length) { out.push({ ids: p, len: r9(l) }); return; }
      o.succ.forEach(s => walk(s, p, l));
    };
    res.starts.forEach(s => walk(s, [], 0));
    out.sort((a, b) => b.len - a.len);
    return { paths: out, capped };
  }
  /* Gantt-Zeilen: Balken FAZ..FEZ, Pufferbalken FEZ..SEZ (Gesamtpuffer) */
  function gantt(res) {
    return res.list.map(o => ({ id: o.id, name: o.name, start: o.es, end: o.ef, bufEnd: o.lf, crit: o.crit, ms: o.d === 0, gp: o.gp, fp: o.fp }));
  }
  /* Was-wäre-wenn: Dauer eines Vorgangs ändern */
  function whatIf(acts, id, newD) {
    const base = cpm(acts); if (!base.ok) return base;
    const a2 = acts.map(a => a.id === id ? Object.assign({}, a, { d: newD }) : a), res = cpm(a2);
    if (!res.ok) return res;
    return { ok: true, old: base.duration, now: res.duration, delta: r9(res.duration - base.duration), res };
  }
  /* Eingabe "A, B" -> ['A','B'] */
  const splitPre = s => String(s == null ? '' : s).split(/[,;\s]+/).map(x => x.trim()).filter(Boolean);

  /* ============================================================ Kosten */
  /* Stundensatz: Personalkosten je produktiver Stunde, Gemeinkostenzuschlag, Gewinn */
  function stundensatz(p) {
    const need = ['jb', 'lnk', 'soll', 'prod', 'gk', 'gw'];
    for (const k of need) if (!fin(p[k]) || p[k] < 0) return { ok: false, err: 'Eingabe „' + k + '“ fehlt oder ist negativ.' };
    if (p.soll <= 0 || p.prod <= 0 || p.prod > 100) return { ok: false, err: 'Sollstunden müssen > 0 und der produktive Anteil zwischen 0 und 100 % liegen.' };
    const pk = p.jb * (1 + p.lnk / 100), ph = p.soll * p.prod / 100, sk = pk / ph, mitGk = sk * (1 + p.gk / 100), vs = mitGk * (1 + p.gw / 100);
    const rows = [
      { k: 'pk', label: 'Personalkosten je Jahr', v: pk, u: '€', calc: 'Jahresbrutto · (1 + Lohnnebenkosten %)' },
      { k: 'ph', label: 'Produktive Stunden je Jahr', v: ph, u: 'h', calc: 'Sollstunden · produktiver Anteil' },
      { k: 'sk', label: 'Personalkosten je produktiver Stunde', v: sk, u: '€/h', calc: 'Personalkosten : produktive Stunden' },
      { k: 'gk', label: 'mit Gemeinkostenzuschlag', v: mitGk, u: '€/h', calc: 'Satz · (1 + Gemeinkosten %)' },
      { k: 'vs', label: 'Verrechnungssatz mit Gewinn', v: vs, u: '€/h', calc: 'Satz · (1 + Gewinn %)' }];
    return { ok: true, rows, val: { pk, ph, sk, gk: mitGk, vs } };
  }
  /* Projektangebot: pos = [{label,h,satz}] (Satz = Selbstkostensatz je Stunde), Zuschläge in %, Skonto im Hundert */
  function angebot(p) {
    const pos = p.pos || []; if (!pos.length) return { ok: false, err: 'Keine Personalposition.' };
    for (const x of pos) if (!fin(x.h) || !fin(x.satz) || x.h < 0 || x.satz < 0) return { ok: false, err: 'Stunden und Satz müssen Zahlen ≥ 0 sein.' };
    for (const k of ['mat', 'fremd', 'mgk', 'wag', 'gw', 'sko', 'ust']) if (!fin(p[k]) || p[k] < 0) return { ok: false, err: 'Eingabe „' + k + '“ fehlt oder ist negativ.' };
    if (p.sko >= 100) return { ok: false, err: 'Skonto muss unter 100 % liegen.' };
    const pers = pos.reduce((s, x) => s + x.h * x.satz, 0), mgk = p.mat * p.mgk / 100, ek = pers + p.mat + mgk + p.fremd, wag = ek * p.wag / 100, sk = ek + wag, gew = sk * p.gw / 100, bvp = sk + gew,
      zvp = bvp / (1 - p.sko / 100), skoB = zvp - bvp, netto = zvp, ustB = netto * p.ust / 100, brutto = netto + ustB;
    const rows = [
      { k: 'pers', label: 'Personalkosten (Σ Stunden · Satz)', v: pers, calc: 'Σ h · Satz' },
      { k: 'mat', label: 'Material', v: p.mat, calc: 'Einzelkosten' },
      { k: 'mgk', label: 'Materialgemeinkosten', v: mgk, calc: 'Material · MGK %' },
      { k: 'fremd', label: 'Fremdleistungen', v: p.fremd, calc: 'Einzelkosten' },
      { k: 'ek', label: 'Kosten vor Wagnis', v: ek, calc: 'Summe der vier Zeilen davor', sum: true },
      { k: 'wag', label: 'Wagniszuschlag', v: wag, calc: 'Kosten · Wagnis %' },
      { k: 'sk', label: 'Selbstkosten', v: sk, calc: 'Kosten + Wagnis', sum: true },
      { k: 'gew', label: 'Gewinn', v: gew, calc: 'Selbstkosten · Gewinn %' },
      { k: 'bvp', label: 'Barverkaufspreis', v: bvp, calc: 'Selbstkosten + Gewinn', sum: true },
      { k: 'sko', label: 'Kundenskonto (im Hundert)', v: skoB, calc: 'Barpreis : (1 − Skonto %) − Barpreis' },
      { k: 'netto', label: 'Angebotspreis netto', v: netto, calc: 'Barpreis : (1 − Skonto %)', sum: true },
      { k: 'ust', label: 'Umsatzsteuer', v: ustB, calc: 'netto · USt %' },
      { k: 'brutto', label: 'Angebotspreis brutto', v: brutto, calc: 'netto + USt', sum: true }];
    return { ok: true, rows, val: { pers, mat: p.mat, mgk, fremd: p.fremd, ek, wag, sk, gew, bvp, sko: skoB, netto, ust: ustB, brutto } };
  }
  /* Deckungsbeitrag und Break-even: p Preis je Stück, kv variable Kosten je Stück, kfix Fixkosten, x Menge, gz Zielgewinn */
  function db(p) {
    for (const k of ['p', 'kv', 'kfix']) if (!fin(p[k]) || p[k] < 0) return { ok: false, err: 'Eingabe „' + k + '“ fehlt oder ist negativ.' };
    const x = fin(p.x) && p.x >= 0 ? p.x : 0, gz = fin(p.gz) ? p.gz : 0, dbs = p.p - p.kv;
    const out = { ok: true, dbs, quote: p.p > 0 ? dbs / p.p * 100 : NaN, x, erloes: p.p * x, kosten: p.kfix + p.kv * x, gewinn: dbs * x - p.kfix, dbGes: dbs * x };
    if (dbs <= 0) { out.be = null; out.beUp = null; out.beUmsatz = null; out.zielMenge = null; out.sicher = null; out.err = 'Der Preis deckt die variablen Kosten nicht: Es gibt keinen Break-even.'; return Object.assign(out, { ok: true, noBE: true }); }
    out.be = p.kfix / dbs; out.beUp = Math.ceil(r9(out.be)); out.beUmsatz = out.be * p.p; out.zielMenge = (p.kfix + gz) / dbs; out.zielUp = Math.ceil(r9(out.zielMenge));
    out.sicher = x > 0 ? (x - out.be) / x * 100 : NaN;
    return out;
  }
  /* Dreipunkt-Schätzung (PERT): a optimistisch, m wahrscheinlich, b pessimistisch */
  function pert(a, m, b) {
    if (![a, m, b].every(fin) || a < 0 || !(a <= m && m <= b)) return { ok: false, err: 'Es muss gelten: 0 ≤ optimistisch ≤ wahrscheinlich ≤ pessimistisch.' };
    const e = (a + 4 * m + b) / 6, sd = (b - a) / 6; return { ok: true, e, sd, v: sd * sd };
  }
  function pertSum(list) {
    if (!list.length) return { ok: false, err: 'Keine Arbeitspakete.' };
    let e = 0, v = 0; const items = [];
    for (const x of list) { const r = pert(x[0], x[1], x[2]); if (!r.ok) return r; e += r.e; v += r.v; items.push(r); }
    return { ok: true, e, sd: Math.sqrt(v), v, items, plus1: e + Math.sqrt(v), plus2: e + 2 * Math.sqrt(v) };
  }

  /* ============================================================ Investitionsrechnung (Zahlungsreihe cf[0] = Zeitpunkt 0) */
  const okCF = cf => Array.isArray(cf) && cf.length >= 2 && cf.every(fin);
  function npv(i, cf) { if (!okCF(cf) || !fin(i) || i <= -1) return NaN; let s = 0; for (let t = 0; t < cf.length; t++) s += cf[t] / Math.pow(1 + i, t); return s; }
  /* interner Zinsfuß: alle Nullstellen von npv(i) für i > -99 % (Suchraster + Bisektion) */
  function irrAll(cf) {
    if (!okCF(cf)) return { ok: false, err: 'Zahlungsreihe ungültig.' };
    if (!(cf.some(x => x > 0) && cf.some(x => x < 0))) return { ok: false, err: 'Ohne Vorzeichenwechsel gibt es keinen internen Zinsfuß.', roots: [] };
    const grid = []; for (let r = -0.99; r < -0.5; r += 0.01) grid.push(r); for (let r = -0.5; r < 2; r += 0.002) grid.push(r); for (let r = 2; r <= 50.0001; r += 0.05) grid.push(r);
    const roots = []; let prev = grid[0], fp = npv(prev, cf);
    if (fp === 0) roots.push(prev);
    for (let k = 1; k < grid.length; k++) {
      const r = grid[k], f = npv(r, cf);
      if (f === 0) { roots.push(r); } else if (fp !== 0 && (fp < 0) !== (f < 0)) {
        let lo = prev, hi = r, flo = fp;
        for (let it = 0; it < 200; it++) { const mid = (lo + hi) / 2, fm = npv(mid, cf); if ((fm < 0) === (flo < 0)) { lo = mid; flo = fm; } else hi = mid; }
        roots.push((lo + hi) / 2);
      }
      prev = r; fp = f;
    }
    if (!roots.length) return { ok: false, err: 'Kein interner Zinsfuß unter 5000 %.', roots: [] };
    return { ok: true, irr: roots[0] * 100, roots: roots.map(x => x * 100), multiple: roots.length > 1 };
  }
  const irr = cf => { const r = irrAll(cf); return r.ok ? r.irr : NaN; };
  /* Amortisationsdauer in Jahren (gleichmäßiger Rückfluss innerhalb des Jahres), i = 0 statisch, sonst dynamisch */
  function payback(cf, i) {
    if (!okCF(cf)) return { ok: false, err: 'Zahlungsreihe ungültig.' };
    const q = 1 + (i || 0); let cum = cf[0];
    if (cum >= 0) return { ok: true, years: 0 };
    for (let t = 1; t < cf.length; t++) {
      const z = cf[t] / Math.pow(q, t);
      if (cum + z >= 0 && z > 0) return { ok: true, years: t - 1 + (-cum) / z, year: t };
      cum += z;
    }
    return { ok: false, never: true, err: 'Die Investition amortisiert sich innerhalb der Laufzeit nicht.', cum };
  }
  const af = (i, n) => { if (!(n >= 1)) return NaN; if (Math.abs(i) < 1e-12) return 1 / n; const q = Math.pow(1 + i, n); return i * q / (q - 1); };     /* Annuitätenfaktor (Wiedergewinnungsfaktor) */
  const rbf = (i, n) => 1 / af(i, n);                                                                                                  /* Rentenbarwertfaktor */
  const annuitaet = (K, i, n) => K * af(i, n);
  /* Zahlungsreihe aus Kennwerten: I Anschaffung, ue Überschuss je Jahr, n Jahre, rest Restwert am Ende */
  function reihe(p) {
    if (![p.I, p.ue, p.n].every(fin) || p.n < 1 || p.n !== Math.floor(p.n) || p.n > 60) return null;
    const cf = [-p.I]; for (let t = 1; t <= p.n; t++) cf.push(p.ue + (t === p.n ? (p.rest || 0) : 0)); return cf;
  }
  /* alles auf einmal für eine Investition: p = {I, ue, n, rest, i (in %)} oder cf direkt */
  function bewerte(p) {
    const cf = p.cf || reihe(p); if (!okCF(cf)) return { ok: false, err: 'Zahlungsreihe ungültig.' };
    const i = (fin(p.i) ? p.i : 0) / 100; if (i <= -1) return { ok: false, err: 'Zinssatz muss über −100 % liegen.' };
    const n = cf.length - 1, k = npv(i, cf), z = irrAll(cf), ps = payback(cf, 0), pd = payback(cf, i);
    return { ok: true, cf, n, npv: k, irr: z.ok ? z.irr : NaN, irrAll: z, pbStat: ps.ok ? ps.years : NaN, pbDyn: pd.ok ? pd.years : NaN, ann: k * af(i, n), vorteilhaft: k > 0 };
  }
  /* Vergleich zweier Investitionen (gleicher Kalkulationszins, Laufzeiten dürfen verschieden sein) */
  function vergleich(a, b, i) {
    const A = bewerte(Object.assign({}, a, { i })), B = bewerte(Object.assign({}, b, { i }));
    if (!A.ok || !B.ok) return { ok: false, err: (A.err || '') + (B.err || '') };
    const L = Math.max(A.cf.length, B.cf.length), pad = c => c.concat(Array(L - c.length).fill(0)), diff = pad(A.cf).map((v, t) => v - pad(B.cf)[t]);
    let fisher = NaN; if (A.n === B.n) { const f = irrAll(diff); if (f.ok) fisher = f.irr; }
    const best = A.n === B.n ? (A.npv > B.npv ? 'A' : A.npv < B.npv ? 'B' : '=') : (A.ann > B.ann ? 'A' : A.ann < B.ann ? 'B' : '=');
    return { ok: true, A, B, fisher, best, byAnnuity: A.n !== B.n };
  }
  /* kritische Werte: Überschuss, Anschaffung, Laufzeit bei Kapitalwert 0 */
  function kritisch(p) {
    const i = p.i / 100, n = p.n, q = Math.pow(1 + i, n), rb = Math.abs(i) < 1e-12 ? n : (q - 1) / (i * q), restPV = (p.rest || 0) / q;
    const ueKrit = (p.I - restPV) / rb, Ikrit = p.ue * rb + restPV;
    let nKrit = null; for (let m = 1; m <= 60; m++) { if (npv(i, reihe(Object.assign({}, p, { n: m }))) >= 0) { nKrit = m; break; } }
    return { ue: ueKrit, I: Ikrit, n: nKrit };
  }
  /* Sensitivität: Kapitalwert bei Änderung eines Parameters um dp (Prozent bei I, ue, rest; Prozentpunkte bei i; Jahre bei n) */
  function sens(p, key, dp) {
    const q = Object.assign({}, p);
    if (key === 'I' || key === 'ue' || key === 'rest') q[key] = (p[key] || 0) * (1 + dp / 100); else if (key === 'i') q.i = p.i + dp; else if (key === 'n') q.n = p.n + dp; else return NaN;
    const cf = reihe(q); return cf ? npv(q.i / 100, cf) : NaN;
  }
  /* lineare Interpolation für den internen Zinsfuß aus zwei Probezinssätzen (in %) */
  const irrInterp = (i1, k1, i2, k2) => i1 - k1 * (i2 - i1) / (k2 - k1);

  /* ============================================================ Risiko und Qualität */
  const RISK_CLASSES = [{ id: 'gering', name: 'gering', max: 4 }, { id: 'mittel', name: 'mittel', max: 9 }, { id: 'hoch', name: 'hoch', max: 15 }, { id: 'kritisch', name: 'kritisch', max: 25 }];
  const riskScore = (p, s) => (Number.isInteger(p) && Number.isInteger(s) && p >= 1 && p <= 5 && s >= 1 && s <= 5) ? p * s : NaN;
  const riskClass = z => !fin(z) ? null : RISK_CLASSES.find(c => z <= c.max) || null;
  const erwartung = (pPct, loss) => (fin(pPct) && fin(loss) && pPct >= 0 && pPct <= 100 && loss >= 0) ? pPct / 100 * loss : NaN;
  const reserve = list => list.reduce((s, r) => s + erwartung(r[0], r[1]), 0);
  const rpz = (b, a, e) => [b, a, e].every(x => Number.isInteger(x) && x >= 1 && x <= 10) ? b * a * e : NaN;
  function fmea(list, grenze) {
    const items = list.map((r, k) => ({ k, name: r.name, b: r.b, a: r.a, e: r.e, rpz: rpz(r.b, r.a, r.e) }));
    items.forEach(x => { x.over = fin(x.rpz) && x.rpz >= grenze; });
    items.sort((x, y) => (fin(y.rpz) ? y.rpz : -1) - (fin(x.rpz) ? x.rpz : -1) || x.k - y.k);
    return items;
  }
  /* Pareto: absteigend sortiert, Anteil, kumuliert, Klasse A (bis 80 %), B (bis 95 %), C; ein Element ist A, solange der Anteil davor < 80 % ist */
  function pareto(items) {
    if (!items.length) return { ok: false, err: 'Keine Werte.' };
    if (items.some(x => !fin(x.v) || x.v < 0)) return { ok: false, err: 'Werte müssen Zahlen ≥ 0 sein.' };
    const total = items.reduce((s, x) => s + x.v, 0); if (total <= 0) return { ok: false, err: 'Die Summe muss größer als 0 sein.' };
    const s = items.map((x, k) => ({ k, label: x.label, v: x.v })).sort((a, b) => b.v - a.v || a.k - b.k);
    let cum = 0; s.forEach(x => { const before = cum / total * 100; x.share = x.v / total * 100; cum += x.v; x.cum = cum / total * 100; x.cls = before < 80 - 1e-9 ? "A" : before < 95 - 1e-9 ? "B" : "C"; });
    return { ok: true, items: s, total, nA: s.filter(x => x.cls === 'A').length };
  }

  /* ============================================================ Praxisbericht */
  /* Seitenbudget: Anteile (beliebige Gewichte) -> Seiten (exakt) und ganzzahlig nach dem Verfahren des größten Rests, Summe = total */
  function seiten(total, weights) {
    if (!fin(total) || total <= 0 || !weights.length || weights.some(w => !fin(w) || w < 0)) return { ok: false, err: 'Seitenzahl und Anteile müssen Zahlen ≥ 0 sein.' };
    const sum = weights.reduce((s, w) => s + w, 0); if (sum <= 0) return { ok: false, err: 'Die Summe der Anteile muss größer als 0 sein.' };
    const exact = weights.map(w => total * w / sum), T = Math.round(total), fl = exact.map(Math.floor);
    let rest = T - fl.reduce((s, x) => s + x, 0);
    const ord = exact.map((x, k) => ({ k, fr: x - Math.floor(x) })).sort((a, b) => b.fr - a.fr || a.k - b.k);
    const whole = fl.slice(); for (let j = 0; j < ord.length && rest > 0; j++, rest--) whole[ord[j].k]++;
    return { ok: true, exact, whole, sum, shares: weights.map(w => w / sum * 100) };
  }
  /* Kurzbeleg und Literaturzeile aus Bausteinen (Institution statt Person; Form ist ein Vorschlag, die Vorgabe der Schule geht vor) */
  function zitat(q) {
    const g = k => String(q[k] == null ? '' : q[k]).trim();
    if (!g('quelle') || !/^\d{4}$/.test(g('jahr'))) return { ok: false, err: 'Quelle und vierstellige Jahreszahl angeben.' };
    const seite = g('seite'), sp = seite ? ', S. ' + seite : '';
    const kurz = q.art === 'woertlich' ? '„…“ (' + g('quelle') + ' ' + g('jahr') + sp + ')' : 'Sinngemäß ist das so beschrieben (vgl. ' + g('quelle') + ' ' + g('jahr') + sp + ').';
    const voll = g('quelle') + ' (' + g('jahr') + '): ' + (g('titel') || '[Titel]') + (g('ort') ? '. ' + g('ort') : '') + '.';
    return { ok: true, kurz, voll, warn: q.art === 'woertlich' && !seite ? 'Wörtliche Zitate brauchen eine Seitenangabe.' : '' };
  }

  root.PRJ_CORE = {
    fin, rd, r9, parseDe, fmtDe, fmtN, eur, pct, checkNum, hashStr, rng, ri, pick, shuffle,
    VAGUE, analyseAnf, ausfall,
    cpm, allPaths, gantt, whatIf, splitPre,
    stundensatz, angebot, db, pert, pertSum,
    npv, irrAll, irr, payback, af, rbf, annuitaet, reihe, bewerte, vergleich, kritisch, sens, irrInterp,
    RISK_CLASSES, riskScore, riskClass, erwartung, reserve, rpz, fmea, pareto,
    seiten, zitat
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PRJ_CORE;
})(typeof window !== 'undefined' ? window : globalThis);
