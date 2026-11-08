'use strict';
/* Tonfunk Kalkulations-Lab: reine Rechenlogik (ohne Oberfläche, auch per Node testbar).
   Schemata: Bezugskalkulation, Selbstkosten (Industrie), Handels-Selbstkosten, Angebot vorwärts (auf/im Hundert),
   Rückwärtskalkulation, Differenzkalkulation, Handelsspanne/Kalkulationszuschlag/-faktor, Deckungsbeitrag und Break-even.
   Rundungsregel: Jedes Zwischenergebnis wird kaufmännisch auf ganze Cent gerundet (0,005 wird aufgerundet).
   Mit p.exact = true wird nicht gerundet (nur für Zufallsgeneratoren, die krumme Werte vermeiden).
   Jede Schemafunktion liefert { ok, rows, val } oder { ok:false, err }. rows: [{k,label,op,v,u,pct,bas,calc,sum}], val: {k:v}.
   Export: window.KAL_CORE bzw. module.exports (Node). */
(function (root) {
  const fin = v => typeof v === 'number' && isFinite(v);
  const rd = (v, d) => { const f = Math.pow(10, d); const s = v < 0 ? -1 : 1; return s * Math.round(Math.abs(v) * f + 1e-7) / f; };
  const rd2 = v => rd(v, 2);

  /* ---------------- Zahlen deutsch ---------------- */
  /* "1.234,50 €", "12,5 %", "12.5" -> Zahl; sonst NaN. Punkte zählen nur dann als Tausendertrenner, wenn ein Komma vorkommt oder mehrere Punkte da sind. */
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NaN;
    s = String(s == null ? '' : s).replace(/[\s  ]+/g, '').replace(/(€|euro|eur|%|prozent|stück|stueck|stk\.?)$/i, '').replace('−', '-');
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.'); else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
    if (!/^[+\-]?\d+(\.\d+)?$|^[+\-]?\.\d+$/.test(s)) return NaN;
    return parseFloat(s);
  }
  /* Zahl -> deutscher Text mit fester Nachkommastellenzahl und Tausenderpunkt */
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
  const trim0 = t => t.replace(/(,\d*?)0+$/, '$1').replace(/,$/, '');
  const fmtP = v => trim0(fmtDe(v, 2));                 /* 12,5 | 20 | 33,33 */
  const eur = v => fmtDe(v, 2) + ' €';
  function fmtRow(r) {
    if (!fin(r.v)) return '–';
    if (r.u === '€') return eur(r.v);
    if (r.u === '%') return fmtDe(r.v, 2) + ' %';
    if (r.u === 'Stück') return fmtDe(r.v, Number.isInteger(rd(r.v, 2)) ? 0 : 2) + ' Stück';
    return trim0(fmtDe(r.v, r.dec == null ? 4 : r.dec));
  }

  /* ---------------- Zufall (seed-fähig) ---------------- */
  function hashStr(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    let a = (typeof seed === 'number' ? seed >>> 0 : hashStr(seed)) || 1;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const ri = (R, a, b, s) => { s = s || 1; return a + s * Math.floor(R() * (Math.floor((b - a) / s) + 1)); };
  const pick = (R, a) => a[Math.floor(R() * a.length)];

  /* ---------------- Schema-Baukasten ---------------- */
  function Sch(p) {
    const r = p.exact ? (x => x) : rd2, rows = [], val = {};
    const put = (k, label, op, v, o) => { val[k] = v; rows.push(Object.assign({ k, label, op, v, u: '€' }, o || {})); return v; };
    return {
      rows, val, r,
      add: (k, label, op, v, o) => put(k, label, op, v, o),
      pc: (k, label, op, base, pct, bas) => put(k, label, op, r(base * pct / 100), { pct, bas, calc: eur(base) + ' × ' + fmtP(pct) + ' % : 100' }),
      sum: (k, label, v, calc, o) => put(k, label, '=', v, Object.assign({ sum: true, calc }, o || {})),
      fin: () => ({ ok: true, rows, val })
    };
  }
  const bad = e => ({ ok: false, err: e });
  const miss = (p, keys) => keys.some(k => !fin(p[k]));
  const ERR_N = 'Bitte alle Felder mit Zahlen füllen.';

  /* ---------------- 1. Bezugskalkulation ---------------- */
  /* PRUEFEN: Bezugskosten werden nach dem Skonto addiert (übliche Lehrbuchsystematik; manche Betriebe/Bücher ziehen Skonto vom Bezugspreis ab). */
  function bezug(p) {
    if (miss(p, ['lep', 'rab', 'sko', 'bk'])) return bad(ERR_N);
    if (p.lep < 0 || p.bk < 0 || p.rab < 0 || p.rab >= 100 || p.sko < 0 || p.sko >= 100) return bad('Preise und Kosten dürfen nicht negativ sein, Rabatt und Skonto müssen unter 100 % liegen.');
    const s = Sch(p), r = s.r;
    s.add('lep', 'Listeneinkaufspreis', '', p.lep);
    const ra = s.pc('rab', 'Liefererrabatt', '−', p.lep, p.rab, 'vom Listeneinkaufspreis');
    const zep = s.sum('zep', 'Zieleinkaufspreis', r(p.lep - ra), eur(p.lep) + ' − ' + eur(ra));
    const sk = s.pc('sko', 'Liefererskonto', '−', zep, p.sko, 'vom Zieleinkaufspreis');
    const bep = s.sum('bep', 'Bareinkaufspreis', r(zep - sk), eur(zep) + ' − ' + eur(sk));
    s.add('bk', 'Bezugskosten', '+', p.bk, { bas: 'Fracht, Verpackung, Zoll …' });
    s.sum('bzp', 'Bezugspreis (Einstandspreis)', r(bep + p.bk), eur(bep) + ' + ' + eur(p.bk));
    return s.fin();
  }

  /* ---------------- 2. Selbstkosten Industrie ---------------- */
  /* PRUEFEN: Schema ohne Sondereinzelkosten und ohne Bestandsveränderungen; VwGK/VtGK als Zuschlag auf die Herstellkosten. */
  function selbstkosten(p) {
    if (miss(p, ['mek', 'mgk', 'fl', 'fgk', 'vwgk', 'vtgk'])) return bad(ERR_N);
    if (['mek', 'mgk', 'fl', 'fgk', 'vwgk', 'vtgk'].some(k => p[k] < 0)) return bad('Negative Werte sind hier nicht sinnvoll.');
    const s = Sch(p), r = s.r;
    s.add('mek', 'Materialeinzelkosten (Fertigungsmaterial)', '', p.mek);
    const mg = s.pc('mgk', 'Materialgemeinkosten', '+', p.mek, p.mgk, 'Zuschlag auf Materialeinzelkosten');
    const mk = s.sum('mk', 'Materialkosten', r(p.mek + mg), eur(p.mek) + ' + ' + eur(mg));
    s.add('fl', 'Fertigungslöhne (Fertigungseinzelkosten)', '', p.fl);
    const fg = s.pc('fgk', 'Fertigungsgemeinkosten', '+', p.fl, p.fgk, 'Zuschlag auf Fertigungslöhne');
    const fk = s.sum('fk', 'Fertigungskosten', r(p.fl + fg), eur(p.fl) + ' + ' + eur(fg));
    const hk = s.sum('hk', 'Herstellkosten', r(mk + fk), eur(mk) + ' + ' + eur(fk));
    const vw = s.pc('vwgk', 'Verwaltungsgemeinkosten', '+', hk, p.vwgk, 'Zuschlag auf Herstellkosten');
    const vt = s.pc('vtgk', 'Vertriebsgemeinkosten', '+', hk, p.vtgk, 'Zuschlag auf Herstellkosten');
    s.sum('sk', 'Selbstkosten', r(hk + vw + vt), eur(hk) + ' + ' + eur(vw) + ' + ' + eur(vt));
    return s.fin();
  }

  /* Handel: Bezugspreis + Handlungskosten = Selbstkosten */
  function handelSk(p) {
    if (miss(p, ['bzp', 'hk'])) return bad(ERR_N);
    if (p.bzp < 0 || p.hk < 0) return bad('Negative Werte sind hier nicht sinnvoll.');
    const s = Sch(p);
    s.add('bzp', 'Bezugspreis (Einstandspreis)', '', p.bzp);
    const h = s.pc('hk', 'Handlungskosten', '+', p.bzp, p.hk, 'Zuschlag auf den Bezugspreis');
    s.sum('sk', 'Selbstkosten', s.r(p.bzp + h), eur(p.bzp) + ' + ' + eur(h));
    return s.fin();
  }

  /* ---------------- 3. Angebotskalkulation vorwärts ----------------
     Start wahlweise bei den Selbstkosten (p.sk, p.gew), beim Barverkaufspreis (p.bvp) oder beim Zielverkaufspreis (p.zvp).
     Gewinn: Zuschlag AUF die Selbstkosten (auf Hundert). Skonto und Provision: IM HUNDERT vom Zielverkaufspreis. Rabatt: IM HUNDERT vom Listenverkaufspreis.
     ZVP = BVP × 100 : (100 − Skonto − Provision);  LVP = ZVP × 100 : (100 − Rabatt). */
  function angebot(p) {
    const st = fin(p.zvp) ? 2 : fin(p.bvp) ? 1 : 0;
    if (st === 0 && miss(p, ['sk', 'gew'])) return bad(ERR_N);
    if (st < 2 && miss(p, ['sko', 'prov'])) return bad(ERR_N);
    if (miss(p, ['rab', 'ust'])) return bad(ERR_N);
    if (st < 2 && (p.sko < 0 || p.prov < 0 || p.sko + p.prov >= 100)) return bad('Skonto + Provision müssen zusammen unter 100 % liegen (sonst gibt es keinen Zielverkaufspreis).');
    if (p.rab < 0 || p.rab >= 100) return bad('Der Kundenrabatt muss unter 100 % liegen.');
    if (p.ust < 0) return bad('Die Umsatzsteuer darf nicht negativ sein.');
    const s = Sch(p), r = s.r; let bvp, zvp;
    if (st === 0) {
      s.add('sk', 'Selbstkosten', '', p.sk);
      const g = s.pc('gew', 'Gewinn', '+', p.sk, p.gew, 'Zuschlag auf die Selbstkosten (auf Hundert)');
      bvp = s.sum('bvp', 'Barverkaufspreis', r(p.sk + g), eur(p.sk) + ' + ' + eur(g));
    } else if (st === 1) { bvp = s.add('bvp', 'Barverkaufspreis', '', p.bvp); }
    if (st < 2) {
      const dn = 100 - p.sko - p.prov;
      zvp = r(bvp * 100 / dn);
      s.pc('sko', 'Kundenskonto', '+', zvp, p.sko, 'im Hundert vom Zielverkaufspreis');
      s.pc('prov', 'Vertreterprovision', '+', zvp, p.prov, 'im Hundert vom Zielverkaufspreis');
      s.sum('zvp', 'Zielverkaufspreis', zvp, eur(bvp) + ' × 100 : ' + fmtP(dn), { bas: 'BVP = ' + fmtP(dn) + ' % des ZVP' });
    } else { zvp = s.add('zvp', 'Zielverkaufspreis', '', p.zvp); }
    const lvp = r(zvp * 100 / (100 - p.rab));
    s.pc('rab', 'Kundenrabatt', '+', lvp, p.rab, 'im Hundert vom Listenverkaufspreis');
    s.sum('lvp', 'Listenverkaufspreis (netto)', lvp, eur(zvp) + ' × 100 : ' + fmtP(100 - p.rab), { bas: 'ZVP = ' + fmtP(100 - p.rab) + ' % des LVP' });
    const us = s.pc('ust', 'Umsatzsteuer', '+', lvp, p.ust, 'auf den Nettopreis (auf Hundert)');
    s.sum('brutto', 'Bruttoverkaufspreis', r(lvp + us), eur(lvp) + ' + ' + eur(us));
    return s.fin();
  }

  /* ---------------- 4a. Rückwärtskalkulation ----------------
     p: art ('brutto'|'netto'), preis, ust, rab, sko, prov, gew, hk, bk, lsko, lrab; p.bis = 'sk' | 'bzp' | 'lep' (Abbruch nach dieser Zeile) */
  function rueckwaerts(p) {
    const brutto = p.art === 'brutto';
    if (miss(p, ['preis', 'rab', 'sko', 'prov', 'gew', 'hk', 'bk', 'lsko', 'lrab']) || (brutto && !fin(p.ust))) return bad(ERR_N);
    if (p.preis < 0 || p.bk < 0) return bad('Preis und Bezugskosten dürfen nicht negativ sein.');
    if (p.rab < 0 || p.rab >= 100 || p.sko < 0 || p.prov < 0 || p.sko + p.prov >= 100 || p.lsko < 0 || p.lsko >= 100 || p.lrab < 0 || p.lrab >= 100 || p.gew <= -100 || p.hk <= -100) return bad('Ein Prozentsatz ist nicht zulässig (Rabatt, Skonto, Provision jeweils unter 100 %, zusammen Skonto + Provision unter 100 %).');
    const s = Sch(p), r = s.r; let lvp;
    if (brutto) {
      s.add('brutto', 'Bruttopreis (Marktpreis)', '', p.preis);
      lvp = r(p.preis * 100 / (100 + p.ust));
      s.add('ust', 'Umsatzsteuer', '−', r(p.preis - lvp), { pct: p.ust, bas: 'Brutto = ' + fmtP(100 + p.ust) + ' % (auf Hundert)', calc: eur(p.preis) + ' − ' + eur(lvp) });
      s.sum('lvp', 'Listenverkaufspreis (netto)', lvp, eur(p.preis) + ' × 100 : ' + fmtP(100 + p.ust));
    } else { lvp = s.add('lvp', 'Listenverkaufspreis (netto, Marktpreis)', '', p.preis); }
    const ra = s.pc('rab', 'Kundenrabatt', '−', lvp, p.rab, 'im Hundert vom Listenverkaufspreis');
    const zvp = s.sum('zvp', 'Zielverkaufspreis', r(lvp - ra), eur(lvp) + ' − ' + eur(ra));
    const sk = s.pc('sko', 'Kundenskonto', '−', zvp, p.sko, 'im Hundert vom Zielverkaufspreis');
    const pv = s.pc('prov', 'Vertreterprovision', '−', zvp, p.prov, 'im Hundert vom Zielverkaufspreis');
    const bvp = s.sum('bvp', 'Barverkaufspreis', r(zvp - sk - pv), eur(zvp) + ' − ' + eur(sk) + ' − ' + eur(pv));
    const sel = r(bvp * 100 / (100 + p.gew));
    s.add('gewinn', 'Gewinn', '−', r(bvp - sel), { pct: p.gew, bas: 'BVP = ' + fmtP(100 + p.gew) + ' % der Selbstkosten (auf Hundert)', calc: eur(bvp) + ' − ' + eur(sel) });
    s.sum('sk', 'Selbstkosten (höchstens)', sel, eur(bvp) + ' × 100 : ' + fmtP(100 + p.gew));
    const bzp = r(sel * 100 / (100 + p.hk));
    s.add('hkost', 'Handlungskosten', '−', r(sel - bzp), { pct: p.hk, bas: 'SK = ' + fmtP(100 + p.hk) + ' % des Bezugspreises', calc: eur(sel) + ' − ' + eur(bzp) });
    s.sum('bzp', 'Bezugspreis (höchstens)', bzp, eur(sel) + ' × 100 : ' + fmtP(100 + p.hk));
    const bep = r(bzp - p.bk);
    s.add('bk', 'Bezugskosten', '−', p.bk);
    s.sum('bep', 'Bareinkaufspreis', bep, eur(bzp) + ' − ' + eur(p.bk));
    const zep = r(bep * 100 / (100 - p.lsko));
    s.add('lsko', 'Liefererskonto', '−', r(zep - bep), { pct: p.lsko, bas: 'im Hundert vom Zieleinkaufspreis', calc: eur(zep) + ' − ' + eur(bep) });
    s.sum('zep', 'Zieleinkaufspreis', zep, eur(bep) + ' × 100 : ' + fmtP(100 - p.lsko));
    const lep = r(zep * 100 / (100 - p.lrab));
    s.add('lrab', 'Liefererrabatt', '−', r(lep - zep), { pct: p.lrab, bas: 'im Hundert vom Listeneinkaufspreis', calc: eur(lep) + ' − ' + eur(zep) });
    s.sum('lep', 'Listeneinkaufspreis (höchstens)', lep, eur(zep) + ' × 100 : ' + fmtP(100 - p.lrab));
    if (p.bis) { const i = s.rows.findIndex(x => x.k === p.bis); if (i >= 0) s.rows.length = i + 1; }
    return s.fin();
  }

  /* ---------------- 4b. Differenzkalkulation ---------------- */
  function differenz(p) {
    if (miss(p, ['lvp', 'rab', 'sko', 'prov', 'sk'])) return bad(ERR_N);
    if (p.lvp < 0 || p.sk < 0 || p.rab < 0 || p.rab >= 100 || p.sko < 0 || p.prov < 0 || p.sko + p.prov >= 100) return bad('Ein Wert ist nicht zulässig (Preise nicht negativ, Prozentsätze unter 100 %).');
    const s = Sch(p), r = s.r;
    s.add('lvp', 'Listenverkaufspreis (netto, Marktpreis)', '', p.lvp);
    const ra = s.pc('rab', 'Kundenrabatt', '−', p.lvp, p.rab, 'im Hundert vom Listenverkaufspreis');
    const zvp = s.sum('zvp', 'Zielverkaufspreis', r(p.lvp - ra), eur(p.lvp) + ' − ' + eur(ra));
    const sk = s.pc('sko', 'Kundenskonto', '−', zvp, p.sko, 'im Hundert vom Zielverkaufspreis');
    const pv = s.pc('prov', 'Vertreterprovision', '−', zvp, p.prov, 'im Hundert vom Zielverkaufspreis');
    const bvp = s.sum('bvp', 'Barverkaufspreis', r(zvp - sk - pv), eur(zvp) + ' − ' + eur(sk) + ' − ' + eur(pv));
    s.add('sk', 'Selbstkosten', '−', p.sk);
    s.sum('diff', bvp - p.sk >= 0 ? 'Gewinn (Differenz)' : 'Verlust (Differenz)', r(bvp - p.sk), eur(bvp) + ' − ' + eur(p.sk));
    s.val.pct = p.sk > 0 ? rd(s.val.diff / p.sk * 100, 2) : null;
    if (p.sk > 0) s.rows.push({ k: 'pct', label: 'in % der Selbstkosten', op: '', v: s.val.pct, u: '%', calc: eur(s.val.diff) + ' : ' + eur(p.sk) + ' × 100' });
    return s.fin();
  }

  /* ---------------- 5. Handelsspanne, Kalkulationszuschlag, Kalkulationsfaktor ---------------- */
  const zuschlagToSpanne = z => (fin(z) && z > -100) ? z / (100 + z) * 100 : null;
  const spanneToZuschlag = s => (fin(s) && s < 100) ? s / (100 - s) * 100 : null;
  const faktorToZuschlag = f => fin(f) ? (f - 1) * 100 : null;
  const zuschlagToFaktor = z => fin(z) ? 1 + z / 100 : null;
  const spanneToFaktor = s => (fin(s) && s < 100) ? 100 / (100 - s) : null;

  /* PRUEFEN: Handelsspanne und Zuschlag beziehen sich hier auf Bezugspreis bzw. netto-Verkaufspreis (Aufschlag = Handlungskosten + Gewinn); in manchen Büchern auf den Barverkaufspreis. */
  function spanne(p) {
    if (miss(p, ['bzp', 'vp'])) return bad(ERR_N);
    if (p.bzp <= 0 || p.vp <= 0) return bad('Bezugspreis und Verkaufspreis müssen größer als 0 sein (sonst ist eine Division durch 0 nötig).');
    const s = Sch({}), a = rd2(p.vp - p.bzp);
    s.add('bzp', 'Bezugspreis (Einstandspreis)', '', p.bzp);
    s.add('auf', 'Aufschlag (Handlungskosten + Gewinn)', '+', a, { calc: eur(p.vp) + ' − ' + eur(p.bzp) });
    s.add('vp', 'Verkaufspreis (netto)', '=', p.vp, { sum: true });
    s.add('z', 'Kalkulationszuschlag', '', a / p.bzp * 100, { u: '%', calc: eur(a) + ' : ' + eur(p.bzp) + ' × 100', bas: 'Aufschlag in % des Bezugspreises' });
    s.add('s', 'Handelsspanne', '', a / p.vp * 100, { u: '%', calc: eur(a) + ' : ' + eur(p.vp) + ' × 100', bas: 'Aufschlag in % des Verkaufspreises' });
    s.add('f', 'Kalkulationsfaktor', '', p.vp / p.bzp, { u: '', dec: 4, calc: eur(p.vp) + ' : ' + eur(p.bzp) });
    return s.fin();
  }
  /* Umrechnung: gegeben ist genau eine Kennzahl (g = 'z' | 's' | 'f'), optional der Bezugspreis. */
  function spFrom(p) {
    if (!fin(p.wert)) return bad(ERR_N);
    let z, s, f;
    if (p.g === 'z') { if (p.wert <= -100) return bad('Der Zuschlag muss größer als −100 % sein.'); z = p.wert; s = zuschlagToSpanne(z); f = zuschlagToFaktor(z); }
    else if (p.g === 's') { if (p.wert >= 100) return bad('Die Handelsspanne muss unter 100 % liegen (Division durch 0).'); s = p.wert; z = spanneToZuschlag(s); f = spanneToFaktor(s); }
    else if (p.g === 'f') { if (p.wert <= 0) return bad('Der Faktor muss größer als 0 sein.'); f = p.wert; z = faktorToZuschlag(f); s = z / (100 + z) * 100; }
    else return bad('Unbekannte Angabe.');
    const sc = Sch({}), val = { z, s, f };
    sc.add('z', 'Kalkulationszuschlag', '', z, { u: '%', calc: p.g === 'z' ? 'gegeben' : p.g === 's' ? fmtP(p.wert) + ' : (100 − ' + fmtP(p.wert) + ') × 100' : '(' + trim0(fmtDe(f, 4)) + ' − 1) × 100' });
    sc.add('s', 'Handelsspanne', '', s, { u: '%', calc: p.g === 's' ? 'gegeben' : 'Zuschlag : (100 + Zuschlag) × 100' });
    sc.add('f', 'Kalkulationsfaktor', '', f, { u: '', dec: 4, calc: p.g === 'f' ? 'gegeben' : '1 + Zuschlag : 100' });
    if (fin(p.bzp) && p.bzp > 0) { const vp = rd2(p.bzp * f); sc.add('vp', 'Verkaufspreis zum Bezugspreis ' + eur(p.bzp), '', vp, { calc: eur(p.bzp) + ' × ' + trim0(fmtDe(f, 4)) }); }
    return sc.fin();
  }

  /* ---------------- 6. Deckungsbeitrag und Break-even ---------------- */
  /* PRUEFEN: Break-even-Umsatz wird mit der exakten (nicht aufgerundeten) Menge gerechnet; langfristige Preisuntergrenze = Stückkosten bei Menge x. */
  function db(p) {
    if (miss(p, ['p', 'kv', 'kfix', 'x'])) return bad(ERR_N);
    if (p.p < 0 || p.kv < 0 || p.kfix < 0 || p.x < 0) return bad('Preise, Kosten und Menge dürfen nicht negativ sein.');
    const s = Sch({}), dbs = rd2(p.p - p.kv), gdb = rd2(dbs * p.x), gew = rd2(gdb - p.kfix);
    s.add('dbs', 'Stückdeckungsbeitrag db', '', dbs, { calc: eur(p.p) + ' − ' + eur(p.kv), bas: 'Preis − variable Stückkosten' });
    s.add('gdb', 'Gesamtdeckungsbeitrag bei ' + fmtDe(p.x, 0) + ' Stück', '', gdb, { calc: eur(dbs) + ' × ' + fmtDe(p.x, 0) });
    s.add('kfix', 'Fixkosten', '−', p.kfix);
    s.add('gewinn', gew >= 0 ? 'Gewinn' : 'Verlust', '=', gew, { sum: true, calc: eur(gdb) + ' − ' + eur(p.kfix) });
    s.val.bepStueck = null; s.val.bepMenge = null; s.val.bepUmsatz = null;
    if (dbs > 0) {
      const m = p.kfix / dbs, u = rd2(m * p.p);
      s.val.bepMenge = m; s.val.bepStueck = Math.ceil(m - 1e-9); s.val.bepUmsatz = u;
      s.add('bepM', 'Break-even-Menge (Gewinnschwelle)', '', m, { u: 'Stück', calc: eur(p.kfix) + ' : ' + eur(dbs), bas: 'Fixkosten : Stückdeckungsbeitrag; bei Bruchteilen aufrunden' });
      s.add('bepU', 'Break-even-Umsatz', '', u, { calc: fmtDe(m, Number.isInteger(rd(m, 2)) ? 0 : 2) + ' Stück × ' + eur(p.p) });
    }
    s.add('puk', 'Preisuntergrenze kurzfristig', '', p.kv, { calc: 'variable Stückkosten', bas: 'darunter wächst der Verlust mit jedem verkauften Stück' });
    if (p.x > 0) s.add('pul', 'Preisuntergrenze langfristig (Stückkosten bei ' + fmtDe(p.x, 0) + ' Stück)', '', rd2(p.kv + p.kfix / p.x), { calc: eur(p.kv) + ' + ' + eur(p.kfix) + ' : ' + fmtDe(p.x, 0) });
    s.val.dbs = dbs; s.val.gewinn = gew;
    return s.fin();
  }

  /* ---------------- Antworten prüfen ---------------- */
  const tolOf = u => u === '%' ? 0.1 : 0.01;
  function checkNum(inp, v, tol) {
    const x = parseDe(inp);
    if (!fin(x)) return { ok: false, empty: String(inp == null ? '' : inp).trim() === '', nan: true };
    return { ok: Math.abs(x - v) <= (tol == null ? 0.01 : tol) + 1e-9, x };
  }

  const api = {
    fin, rd, rd2, parseDe, fmtDe, fmtP, eur, fmtRow, rng, hashStr, ri, pick,
    bezug, selbstkosten, handelSk, angebot, rueckwaerts, differenz,
    spanne, spFrom, zuschlagToSpanne, spanneToZuschlag, faktorToZuschlag, zuschlagToFaktor, spanneToFaktor,
    db, tolOf, checkNum
  };
  root.KAL_CORE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
