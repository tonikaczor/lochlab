'use strict';
/* Tonfunk Wärme und Ausfall (thermviz.js): einfaches Wärmemodell 1. Ordnung für das SchaltLab (freier Modus), Ausfall bei Überlast und die Darstellung dazu.
   window.THERM = { TAMB, FAKTOR, spec, tSS, stepT, zeitBis, leistung, create, farbe, farbeRgb, stufe, balkenHtml, balkenRoh, verlaufSvg, kartenHtml, skalaHtml, erklaerung, zeichneKoerper, zeichneRauch, zeichneDefekt, zeichneWaermebild, fmtW, fmtZeit, css }.
   Modell (alles Vereinfachung, Lehrwerte, Fragen an Eric in quelle/schaltplan/PRUEFEN_bauteile.md P15 bis P25):
     Verlustleistung P aus der laufenden Simulation (R: I²·R, LED: Uf·I, Z-Diode und Transistor: U·I, Regler: (Uein−Uaus)·I).
     Temperatur T folgt  dT/dt = (T∞ − T) / τ  mit  T∞ = 25 °C + ΔTn · P / Pn   (Pn = Nennleistung, ΔTn = Temperaturanstieg bei Nennleistung).
     Ausfall, wenn T die Ausfalltemperatur 25 °C + 1,5 · ΔTn erreicht (das ist die Temperatur bei dauerhaft 150 % der Nennleistung). Zwischen 100 % und 150 % wird das Bauteil sehr heiß, hält aber noch.
     Regler (78xx, LM317): thermische Abschaltung bei 25 °C + ΔTn, Wiedereinschalten 15 K darunter (kein Ausfall, wie im echten Regler).
   Zeit: die Wärme läuft mindestens in Echtzeit (1 s je Sekunde), bei Zeitraffer der Simulation entsprechend schneller (das legt der Aufrufer fest: advance(dtT)).
   Der Rechenkern simcore.js wird nicht verändert: Ausfälle wirken über sim.burnt (offen) und e.defect = 'short' (Kurzschluss) auf den laufenden Kern. Die einfachen Grenzen des Kerns
   (Widerstand 1,5 W, LED-Strom, Transistor 1,5 W) werden nur dann abgefangen, wenn Ausfälle über dieses Modell erlaubt sind (opts.ausfall) – sonst gilt der Kern wie bisher.
   Darstellung: Farben von Text, Linien und Rahmen nur über die CSS-Variablen der Seite; die Temperaturfarbskala und die Verfärbung sind feste Farbcodes. Keine Animation im Markup, Rauch nur auf der Zeichenfläche und bei prefers-reduced-motion statisch.
   Alle HTML/SVG-Funktionen liefern Text (oder '' bei unbekannter Eingabe), nie NaN im Markup. */
(function (root) {
  const TAMB = 25, FAKTOR = 1.5, HYST = 15;
  const fin = x => typeof x === 'number' && isFinite(x);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const q1 = x => (fin(x) ? Math.round(x * 10) / 10 : 0);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const de = x => (fin(x) ? String(Math.round(x * 100) / 100).replace('.', ',') : '–');
  const fmtW = x => (!fin(x) ? '–' : (x >= 1 ? de(Math.round(x * 100) / 100) : x >= 0.01 ? de(Math.round(x * 1000) / 1000) : de(Math.round(x * 10000) / 10000)) + ' W');
  const fmtZeit = t => (!fin(t) ? '–' : t < 0.1 ? Math.round(t * 1000) + ' ms' : t < 60 ? de(Math.round(t * 10) / 10) + ' s' : Math.floor(t / 60) + ' min ' + Math.round(t % 60) + ' s');
  const fmtA = i => (!fin(i) ? '–' : Math.abs(i) < 1 ? de(Math.round(Math.abs(i) * 10000) / 10) + ' mA' : de(Math.round(Math.abs(i) * 100) / 100) + ' A');
  const grad = T => (fin(T) ? Math.round(T) + ' °C' : '– °C');

  /* ---------- Standardwerte je Bauteil (Quelle der Maße: bauviz.js; offene Fragen: PRUEFEN_bauteile.md) ---------- */
  const NENN_R = ['0.25', '0.5', '1', '2'];
  const RTAU = { '0.25': 5, '0.5': 8, '1': 12, '2': 18 };               // Zeitkonstante in s (Lehrwerte, in echt eher länger)
  const NENN_Z = ['0.5', '1.3'];
  const ZTAU = { '0.5': 4, '1.3': 8 };
  const LEDUF = { rot: 1.9, gelb: 2.0, 'grün': 2.1, blau: 3.0, 'weiß': 3.1, orange: 2.0 };   // wie LEDVF_UI im SchaltLab
  const LEDIF = { '3': 0.020, '5': 0.020, '10': 0.030, smd: 0.020 };    // Nennstrom (Dauerstrom) nach Bauform
  const LEDTAU = { '3': 3, '5': 4, '10': 6, smd: 2 };
  const QDATA = { to92: { pn: 0.5, tau: 4 }, sot23: { pn: 0.25, tau: 2 }, to220: { pn: 2, tau: 15 }, to220ks: { pn: 15, tau: 40 } };
  const REGDATA = { frei: { pn: 2, tau: 15 }, ks: { pn: 8, tau: 40 } };
  const UFREI = ['', '6.3', '10', '16', '25', '35', '50', '63', '100'];  // Spannungsfestigkeit Elko in V ('' = Standard des Kerns, 35 V)
  const ART = { R: 'Widerstand', POT: 'Poti', LED: 'LED', ZD: 'Z-Diode', Q: 'Transistor', REG: 'Spannungsregler' };

  /* Nennwerte eines Bauteils {k, v, w, bf, ks}; null, wenn für die Art kein Wärmemodell gilt */
  function spec(it) {
    if (!it || typeof it !== 'object') return null;
    const k = it.k; let s = null;
    switch (k) {
      case 'R': { const w = NENN_R.indexOf(String(it.w)) >= 0 ? String(it.w) : '0.25'; s = { art: 'R', pn: +w, dTn: 100, tau: RTAU[w], fail: 'open', std: NENN_R.indexOf(String(it.w)) < 0, bauform: 'Widerstand ' + de(+w) + ' W' }; break; }
      case 'POT': s = { art: 'POT', pn: 0.25, dTn: 100, tau: 8, fail: 'open', std: true, bauform: 'Poti (Standard 0,25 W)' }; break;
      case 'LED': { const bf = LEDIF[String(it.bf)] ? String(it.bf) : '5', uf = LEDUF[String(it.v)] || 2.0; s = { art: 'LED', pn: uf * LEDIF[bf], uf: uf, inenn: LEDIF[bf], dTn: 60, tau: LEDTAU[bf], fail: 'open', std: false, bauform: 'LED ' + (bf === 'smd' ? 'SMD 3528' : bf + ' mm') + ', ' + fmtA(LEDIF[bf]) + ' Dauerstrom' }; break; }
      case 'ZD': { const w = NENN_Z.indexOf(String(it.w)) >= 0 ? String(it.w) : '0.5'; s = { art: 'ZD', pn: +w, dTn: 125, tau: ZTAU[w], fail: 'short', std: NENN_Z.indexOf(String(it.w)) < 0, bauform: 'Z-Diode ' + de(+w) + ' W' }; break; }
      case 'NPN': case 'PNP': {
        const bf = QDATA[String(it.bf)] ? String(it.bf) : 'to92', ks = bf === 'to220' && String(it.ks) === '1', d = QDATA[ks ? 'to220ks' : bf];
        s = { art: 'Q', pn: d.pn, dTn: 125, tau: d.tau, fail: 'open', std: false, bauform: { to92: 'TO-92', sot23: 'SOT-23', to220: 'TO-220' }[bf] + (ks ? ' mit Kühlkörper' : bf === 'to220' ? ' ohne Kühlkörper' : '') }; break; }
      case 'REG': { const ks = String(it.ks) === '1', d = REGDATA[ks ? 'ks' : 'frei']; s = { art: 'REG', pn: d.pn, dTn: 125, tau: d.tau, fail: 'abschalt', std: false, bauform: 'TO-220' + (ks ? ' mit Kühlkörper' : ' ohne Kühlkörper') }; break; }
      default: return null;
    }
    s.k = k; s.faktor = s.fail === 'abschalt' ? 1 : FAKTOR;
    s.tGrenz = TAMB + s.dTn;                 // Temperatur bei Nennleistung
    s.tAus = TAMB + s.faktor * s.dTn;        // Ausfall- bzw. Abschalttemperatur
    s.pAus = s.faktor * s.pn;
    return s;
  }
  /* Spannungsfestigkeit eines Elkos in V aus der Eigenschaft uf ('' = Standard) */
  const ufWert = it => { const u = parseFloat(String(it && it.uf)); return fin(u) && u > 0 ? u : 0; };

  /* ---------- Rechnung ---------- */
  const tSS = (P, s) => (s && s.pn > 0 && fin(P) ? TAMB + s.dTn * Math.max(0, P) / s.pn : TAMB);
  function stepT(T, P, s, dt) { const tss = tSS(P, s); if (!(dt > 0) || !s) return T; return tss + (T - tss) * Math.exp(-dt / s.tau); }
  /* Zeit bis zur Ausfalltemperatur bei gleichbleibender Leistung (Infinity, wenn nie) */
  function zeitBis(P, s, T0) {
    T0 = fin(T0) ? T0 : TAMB; const tss = tSS(P, s);
    if (T0 >= s.tAus) return 0; if (tss <= s.tAus) return Infinity;
    return -s.tau * Math.log((tss - s.tAus) / (tss - T0));
  }
  /* Verlustleistung aus den Kernelementen eines Bauteils; v = sim.v */
  function leistung(sp, es, v) {
    let P = 0;
    es.forEach(e => {
      const i = e.i || 0;
      switch (sp.art) {
        case 'R': case 'POT': if (e.type === 'R' && !e.fuse && e.g > 0) P += i * i / e.g; break;
        case 'LED': if (e.type === 'D' && i > 0) P += sp.uf * i; break;
        case 'ZD': if (e.type === 'D') P += Math.abs(i * (v[e.a] - v[e.b])); break;
        case 'Q': if (e.type === 'Q') P += Math.abs((e.ic || 0) * (v[e.c] - v[e.e])) + Math.abs((e.ib || 0) * (v[e.b] - v[e.e])); break;
        case 'REG': if (e.type === 'REG') P += Math.abs((v[e.ni] - v[e.no]) * i); break;
      }
    });
    return fin(P) ? P : 0;
  }

  /* ---------- Farben und Stufen ---------- */
  const STOPS = [[25, [53, 80, 143]], [50, [122, 63, 158]], [80, [194, 56, 107]], [110, [232, 80, 31]], [150, [245, 158, 11]], [190, [255, 216, 74]], [230, [255, 244, 200]]];
  function farbeRgb(T) {
    T = fin(T) ? T : TAMB;
    if (T <= STOPS[0][0]) return STOPS[0][1].slice();
    for (let i = 1; i < STOPS.length; i++) if (T <= STOPS[i][0]) { const a = STOPS[i - 1], b = STOPS[i], f = (T - a[0]) / (b[0] - a[0]); return a[1].map((c, k) => Math.round(c + (b[1][k] - c) * f)); }
    return STOPS[STOPS.length - 1][1].slice();
  }
  const farbe = T => { const c = farbeRgb(T); return '#' + c.map(x => ('0' + x.toString(16)).slice(-2)).join(''); };
  const STUFEN = [[0.05, 'zimmer', 'Zimmertemperatur'], [0.25, 'warm', 'warm'], [0.68, 'heiss', 'heiß'], [0.9, 'sehr', 'sehr heiß'], [9, 'gluehend', 'glühend heiß, Ausfall droht']];
  /* Stufe relativ zur Ausfalltemperatur des Bauteils: f = (T − 25) / (tAus − 25) */
  function stufe(T, s) {
    const f = s && s.tAus > TAMB && fin(T) ? (T - TAMB) / (s.tAus - TAMB) : 0;
    const x = STUFEN.find(z => f < z[0]) || STUFEN[STUFEN.length - 1];
    return { id: x[1], text: x[2], f: f };
  }

  /* ---------- Wärmespur und Zustand je Bauteil ---------- */
  function mkState() { return { T: TAMB, P: 0, status: 'ok', failAt: null, failP: null, failT: null, maxT: TAMB, hT: [], hV: [], hStep: 0.25, hNext: 0 }; }

  /* create({ aktiv: () => bool, ausfall: () => bool, name: item => text }) */
  function create(opts) {
    opts = opts || {};
    const aktiv = () => (opts.aktiv ? !!opts.aktiv() : true);
    const ausfall = () => aktiv() && (opts.ausfall ? !!opts.ausfall() : true);
    const nameOf = it => (opts.name ? opts.name(it) : (it && (it.l || it.k))) || '';
    const states = new Map();
    let entries = [], sim = null, circ = null, tT = 0;
    const byId = id => entries.find(en => en.item.id === id);

    function wirke(en) {                               // Zustand auf den Kern übertragen
      if (!sim) return;
      const st = en.st, id = en.item.id;
      if (st.status === 'defekt' && en.spec.fail === 'short') en.es.forEach(e => { e.defect = 'short'; });
      else if (st.status !== 'ok') sim.burnt.add(id);
    }
    function loesche(en) {                             // Wirkung auf den Kern zurücknehmen
      if (!sim) return;
      if (en.spec.fail === 'short') en.es.forEach(e => { if (e.defect === 'short') e.defect = (e.part && e.part.defect) || undefined; });
      sim.burnt.delete(en.item.id);
    }
    function filter(s) {                               // einfache Grenzen des Kerns abfangen, solange das Wärmemodell entscheidet
      if (!s.events || s.__therm) return;
      s.__therm = true;
      const p0 = s.events.push;
      s.events.push = function (ev) {
        if (ev && ev.kind === 'burn' && !ev.therm && ev.part && ausfall() && /^(Widerstand überlastet|LED durchgebrannt|Transistor überlastet)$/.test(String(ev.text))) {
          const en = byId(ev.part.id);
          if (en && (en.spec.art === 'R' || en.spec.art === 'LED' || en.spec.art === 'Q') && en.st.status === 'ok') { s.burnt.delete(ev.part.id); return this.length; }
        }
        return p0.apply(this, arguments);
      };
    }

    const api = {
      aktiv, ausfall,
      /* nach jedem Neuaufbau des Kerns: items = [{id, k, v, w, bf, ks, uf, l}] */
      bind(c, s, items) {
        circ = c; sim = s; entries = [];
        if (!aktiv()) { states.clear(); return; }                // Aufgabe, Duell, Fehlersuche, Prüfmodus: nichts binden, der Kern gilt wie bisher
        const ids = new Set();
        (items || []).forEach(it => {
          const sp = spec(it); if (!sp) return;
          const es = c.elems.filter(e => e.part && e.part.id === it.id); if (!es.length) return;
          ids.add(it.id);
          let st = states.get(it.id); if (!st) states.set(it.id, st = mkState());
          entries.push({ item: it, spec: sp, st, es, acc: 0, n: 0 });
        });
        states.forEach((_, id) => { if (!ids.has(id)) states.delete(id); });
        if (aktiv() && sim) {
          filter(sim);
          entries.forEach(wirke);
          (items || []).forEach(it => {                // Elko: Spannungsfestigkeit aus der Eigenschaft (nur wenn gesetzt)
            if (it.k !== 'CE') return; const u = ufWert(it); if (!u) return;
            c.elems.forEach(e => { if (e.part && e.part.id === it.id && e.type === 'C') e.vmax = u; });
          });
        }
      },
      unbind() { circ = null; sim = null; entries = []; },
      /* ein Rechenschritt: Leistung merken (billig, pro Kernschritt) */
      sample() { if (!sim || !aktiv()) return; const v = sim.v; for (let k = 0; k < entries.length; k++) { const en = entries[k]; en.acc += sim.burnt.has(en.item.id) || en.st.status === 'defekt' ? 0 : leistung(en.spec, en.es, v); en.n++; } },   // ausgefallene oder abgeschaltete Bauteile setzen nichts mehr um
      /* Wärmezeit dtT (Sekunden) weiter: Temperatur, Ausfall, Verlauf */
      advance(dtT) {
        if (!sim || !aktiv() || !(dtT > 0)) return;
        const t0 = tT; tT += dtT;
        entries.forEach(en => {
          const st = en.st, sp = en.spec, P = en.n ? en.acc / en.n : st.P; en.acc = 0; en.n = 0; st.P = P;
          const T0 = st.T, tss = tSS(P, sp), T1 = tss + (T0 - tss) * Math.exp(-dtT / sp.tau);
          st.T = T1; if (T1 > st.maxT) st.maxT = T1;
          if (st.status === 'ok' && T1 >= sp.tAus && ausfall()) {
            const dt = T0 >= sp.tAus ? 0 : -sp.tau * Math.log((tss - sp.tAus) / (tss - T0));
            st.failAt = t0 + clamp(dt, 0, dtT); st.failP = P; st.failT = sp.tAus;
            st.status = sp.fail === 'abschalt' ? 'abgeschaltet' : 'defekt';
            wirke(en);
            punkt(st, st.failAt, sp.tAus, true);
            if (st.status === 'defekt') {
              const th = { art: sp.art, k: sp.k, P: P, pn: sp.pn, t: st.failAt, T: sp.tAus, uf: sp.uf, name: nameOf(en.item), bauform: sp.bauform };
              sim.events.push({ kind: 'burn', part: en.es[0].part, text: textFehler(th), therm: th });
            }
          } else if (st.status === 'abgeschaltet' && T1 <= sp.tAus - HYST) { st.status = 'ok'; loesche(en); }
          punkt(st, tT, st.T, false);
        });
      },
      reset() { entries.forEach(loesche); states.forEach((st, id) => states.set(id, mkState())); entries.forEach(en => { en.st = states.get(en.item.id); en.acc = 0; en.n = 0; }); tT = 0; },
      /* Bauteil ersetzen: kalt, heil; gibt true zurück, wenn etwas zu ersetzen war */
      repair(id) {
        const en = byId(id); let tat = false;
        if (en) { tat = en.st.status !== 'ok'; loesche(en); const st = mkState(); states.set(id, st); en.st = st; en.acc = 0; en.n = 0; }
        if (sim && sim.burnt.has(id)) { sim.burnt.delete(id); tat = true; }
        return tat;
      },
      get(id) { const en = byId(id); return en ? { st: en.st, spec: en.spec, item: en.item } : null; },
      /* Anzeigewerte */
      info(id) {
        const en = byId(id); if (!en) return null;
        const st = en.st, sp = en.spec, pct = sp.pn > 0 ? st.P / sp.pn * 100 : 0;
        return { id, T: st.T, P: st.P, pct, status: st.status, spec: sp, stufe: stufe(st.T, sp), failAt: st.failAt, failP: st.failP, maxT: st.maxT, hT: st.hT, hV: st.hV, name: nameOf(en.item), bis: zeitBis(st.P, sp, st.T) };
      },
      ids() { return entries.map(en => en.item.id); },
      time() { return tT; },
      meldungen() {
        const out = [];
        entries.forEach(en => {
          const i = api.info(en.item.id), sp = en.spec, nm = i.name || ART[sp.art];
          if (i.status === 'defekt') out.push({ id: i.id, stufe: 'defekt', text: nm + ' ist defekt: ' + textZustand(sp, i) });
          else if (i.status === 'abgeschaltet') out.push({ id: i.id, stufe: 'abschalt', text: nm + ' hat thermisch abgeschaltet (zu heiß, ' + grad(i.T) + '). Er schaltet wieder ein, wenn er abgekühlt ist.' });
          else if (i.pct > 100) {
            const w = fmtW(i.P) + ' bei ' + fmtW(sp.pn) + ' Nennleistung (' + Math.round(i.pct) + ' %)';
            if (!ausfall()) out.push({ id: i.id, stufe: 'warn', text: nm + ': ' + w + '. Das wäre in Wirklichkeit zu viel (Ausfälle sind ausgeschaltet).' });
            else if (isFinite(i.bis)) out.push({ id: i.id, stufe: 'warn', text: nm + ': ' + w + '. Ausfall in etwa ' + fmtZeit(i.bis) + (sp.fail === 'abschalt' ? ' (Abschaltung)' : '') + '.' });
            else out.push({ id: i.id, stufe: 'warn', text: nm + ': ' + w + '. Wird sehr heiß, hält aber noch (Ausfall erst ab ' + Math.round(sp.faktor * 100) + ' %).' });
          }
        });
        return out;
      },
      snapshot() { return { tT, s: entries.map(en => [en.item.id, en.st.T, en.st.P, en.st.status, en.st.failAt, en.st.failP, en.st.failT, en.st.maxT]) }; },
      restore(sn) {
        if (!sn || !Array.isArray(sn.s)) return;
        entries.forEach(loesche); tT = sn.tT;
        sn.s.forEach(a => {
          const en = byId(a[0]); if (!en) return; const st = en.st;
          st.T = a[1]; st.P = a[2]; st.status = a[3]; st.failAt = a[4]; st.failP = a[5]; st.failT = a[6]; st.maxT = a[7];
          while (st.hT.length && st.hT[st.hT.length - 1] > tT) { st.hT.pop(); st.hV.pop(); }
          st.hNext = tT; wirke(en);
        });
      },
    };
    function punkt(st, t, T, pflicht) {
      if (!pflicht && t < st.hNext) return;
      st.hT.push(q1(t * 100) / 100); st.hV.push(q1(T)); st.hNext = t + st.hStep;
      if (st.hT.length > 420) { const a = [], b = []; for (let i = 0; i < st.hT.length; i += 2) { a.push(st.hT[i]); b.push(st.hV[i]); } st.hT = a; st.hV = b; st.hStep *= 2; }
    }
    return api;
  }

  /* ---------- Texte ---------- */
  function textFehler(th) {
    const nm = th.name ? th.name + ': ' : '', w = fmtW(th.P) + ' bei ' + fmtW(th.pn);
    switch (th.art) {
      case 'R': return nm + 'Widerstand durchgebrannt (' + w + ')';
      case 'POT': return nm + 'Poti durchgebrannt, Schleifbahn verbrannt (' + w + ')';
      case 'LED': return nm + 'LED durchgebrannt (' + fmtA(th.uf ? th.P / th.uf : 0) + ' statt Dauerstrom)';
      case 'ZD': return nm + 'Z-Diode überlastet und durchlegiert, jetzt Kurzschluss (' + w + ')';
      case 'Q': return nm + 'Transistor überlastet (' + w + ')';
      default: return nm + 'Bauteil überlastet';
    }
  }
  function textZustand(sp, i) {
    const w = fmtW(i.failP) + ' bei ' + fmtW(sp.pn) + ' Nennleistung nach ' + fmtZeit(i.failAt);
    return { R: 'durchgebrannt (offen), ' + w, POT: 'Schleifbahn verbrannt (offen), ' + w, LED: 'durchgebrannt (offen), ' + w, ZD: 'durchlegiert (Kurzschluss), ' + w, Q: 'ausgefallen (in der Simulation offen), ' + w }[sp.art] || w;
  }
  /* Erklärung für die Nachbesprechung (Was ist passiert? Wie behebst du es?) */
  function erklaerung(th) {
    th = th || {}; const nm = th.name || ART[th.art] || 'Das Bauteil', w = fmtW(th.P), pn = fmtW(th.pn), t = fmtZeit(th.t), T = grad(th.T);
    const kopf = nm + ' setzte ' + w + ' in Wärme um, dauerhaft erlaubt sind ' + pn + '. Nach ' + t + ' erreichte es etwa ' + T + '. ';
    switch (th.art) {
      case 'R': return { why: kopf + 'Die Leistung ist P = U · I = I² · R. Bei dieser Temperatur verbrennt der Widerstandsfilm und die Strecke ist unterbrochen (offen).', fix: 'Strom verkleinern (größerer Widerstandswert im Kreis, Kurzschluss nebenan beseitigen) oder einen Widerstand mit höherer Nennleistung nehmen (0,5 W, 1 W, 2 W). Faustregel: höchstens die Hälfte der Nennleistung ausnutzen.' };
      case 'POT': return { why: kopf + 'Die Schleifbahn des Potis verträgt nur kleine Leistungen. Sie ist durchgebrannt und unterbrochen.', fix: 'Das Poti nur als Steller im kleinen Strom einsetzen (Steuerspannung, Teiler), nicht als Vorwiderstand für Lasten. Für Leistung einen Drahtwiderstand oder ein Leistungspoti nehmen.' };
      case 'LED': return { why: 'Durch die LED floss etwa ' + fmtA(th.uf ? th.P / th.uf : 0) + ', der Dauerstrom liegt bei ' + fmtA(th.uf ? th.pn / th.uf : 0) + '. Nach ' + t + ' war der Halbleiter zu heiß und ist durchgebrannt (offen). Eine LED begrenzt ihren Strom nicht selbst.', fix: 'Vorwiderstand einbauen: R = (U − Uf) / If. Danach den Strom im Bauteil nachmessen.' };
      case 'ZD': return { why: kopf + 'Die Verlustleistung ist P = Uz · Iz. Die Sperrschicht hat durchlegiert, die Z-Diode leitet jetzt in beide Richtungen (Kurzschluss).', fix: 'Den Strom mit dem Vorwiderstand begrenzen (Iz höchstens P / Uz) oder eine Z-Diode mit höherer Leistung nehmen (1,3 W statt 0,5 W).' };
      case 'Q': return { why: kopf + 'Die Verlustleistung am Transistor ist P = Uce · Ic (plus ein kleiner Teil am Basisstrom). Die Sperrschicht wurde zu heiß, er ist ausgefallen (in der Simulation unterbrochen, in echt oft Kurzschluss C–E).', fix: 'Last verkleinern, den Spannungsabfall am Transistor verkleinern (als Schalter voll durchsteuern, dann ist Uce klein) oder ein TO-220-Gehäuse mit Kühlkörper nehmen.' };
      default: return { why: kopf, fix: 'Strom und Spannung am Bauteil prüfen und mit den Nennwerten vergleichen.' };
    }
  }

  /* ---------- Darstellung als HTML/SVG ---------- */
  const CSS = '.thm{margin:8px 0 2px;font-size:13px}.thm .thh{display:flex;justify-content:space-between;align-items:center;gap:8px;color:var(--mute,#8d99a6);flex-wrap:wrap}'
    + '.thc{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;border:1px solid var(--line,#38424d);background:var(--panel2,#2c343e);color:var(--fg,#e8ecf0);font-weight:600}'
    + '.thc i{display:inline-block;width:12px;height:12px;border-radius:50%;background:var(--tc,#888);border:1px solid var(--line,#38424d)}'
    + '.thb{margin:8px 0 2px;font-size:13px}.thb .bh{display:flex;justify-content:space-between;gap:8px;color:var(--mute,#8d99a6)}.thb .bh b{color:var(--fg,#e8ecf0);font-weight:600;text-align:right}'
    + '.thb .bt{position:relative;height:14px;border-radius:7px;background:var(--panel,#222830);border:1px solid var(--line,#38424d);overflow:hidden;margin:5px 0}'
    + '.thb .bt i{display:block;height:100%;background:var(--ok,#4fd58a)}.thb.warn .bt i{background:var(--warn,#ffd166)}.thb.hoch .bt i{background:var(--danger,#ff5c5c)}'
    + '.thb .bt u{position:absolute;top:0;bottom:0;width:2px;background:var(--fg,#e8ecf0);opacity:.6;text-decoration:none}.thb .bs{color:var(--fg,#e8ecf0)}'
    + '.thx{display:block;width:100%;height:auto;max-width:560px;margin:6px auto 0}.thx text{font:600 10px system-ui,-apple-system,"Segoe UI",sans-serif;fill:var(--fg,#e8ecf0)}.thx .mu{fill:var(--mute,#8d99a6);font-weight:500}.thx .me{text-anchor:end}.thx .md{text-anchor:middle}'
    + '.thx .gr{stroke:var(--line,#38424d);stroke-width:1;fill:none}.thx .cv{stroke:var(--accent,#3b9eff);stroke-width:2;fill:none}.thx .l1{stroke:var(--mute,#8d99a6);stroke-width:1.2;stroke-dasharray:2 3}.thx .l2{stroke:var(--danger,#ff5c5c);stroke-width:1.4;stroke-dasharray:6 3}'
    + '.thn{color:var(--mute,#8d99a6);font-size:12px;margin:4px 0}.thk{display:flex;flex-wrap:wrap;gap:6px 10px;margin:6px 0;font-size:12px;color:var(--mute,#8d99a6)}.thk span{display:inline-flex;align-items:center;gap:4px}.thk i{display:inline-block;width:14px;height:10px;border-radius:2px;border:1px solid var(--line,#38424d)}';
  if (typeof document !== 'undefined' && document.head && !document.getElementById('therm-css')) {
    const st = document.createElement('style'); st.id = 'therm-css'; st.textContent = CSS; document.head.appendChild(st);
  }

  const chip = (T, s) => { const st = stufe(T, s); return `<span class="thc" style="--tc:${farbe(T)}"><i></i>${esc(st.text)} · ${esc(grad(T))}</span>`; };
  /* Balken: pct (0 bis 150 sichtbar), Ampel grün bis 70 %, gelb bis 100 %, rot darüber, immer mit Text */
  function balkenRoh(o) {
    if (!o || !fin(o.pct)) return '';
    const pct = Math.max(0, o.pct), st = pct > 100 ? 'hoch' : pct > 70 ? 'warn' : 'ok', pc = Math.round(pct);
    const text = (st === 'hoch' ? '⛔ ' : st === 'warn' ? '⚠ ' : '✔ ') + (o.texte ? o.texte[st] : { ok: 'im grünen Bereich', warn: 'nahe an der Grenze', hoch: 'über der Nennleistung' }[st]);
    return `<div class="thb ${st}" role="group" aria-label="${esc(o.titel)} ${pc} Prozent: ${esc(text)}"><div class="bh"><span>${esc(o.titel)}</span><b>${pc} % · ${esc(o.detail)}</b></div><div class="bt" role="meter" aria-valuemin="0" aria-valuemax="150" aria-valuenow="${pc}"><i style="width:${q1(Math.min(pct, 150) / 150 * 100)}%"></i><u style="left:${q1(100 / 150 * 100)}%"></u></div><div class="bs">${esc(text)}.</div></div>`;
  }
  function balkenHtml(P, s) {
    if (!s || !fin(P)) return '';
    return balkenRoh({ titel: 'Belastung', pct: Math.abs(P) / s.pn * 100, detail: fmtW(Math.abs(P)) + ' von ' + fmtW(s.pn), texte: { ok: 'im grünen Bereich', warn: 'nahe an der Grenze: wird deutlich warm', hoch: 'über der Nennleistung: wird zu heiß' } });
  }
  /* Temperaturverlauf: Zeit (Wärmezeit) gegen Temperatur mit Nenn- und Ausfalllinie */
  function verlaufSvg(info) {
    if (!info || !info.spec) return '';
    const sp = info.spec, hT = info.hT || [], hV = info.hV || [], n = Math.min(hT.length, hV.length);
    const W = 300, H = 132, x0 = 38, x1 = 292, y0 = 10, y1 = 104;
    const tEnd = Math.max(10, n ? hT[n - 1] : 0), tMax = Math.max(sp.tAus * 1.1, info.maxT * 1.06, 60);
    const X = t => q1(x0 + (x1 - x0) * clamp(t / tEnd, 0, 1)), Y = T => q1(y1 - (y1 - y0) * clamp((T - 0) / tMax, 0, 1));
    const step = tMax > 200 ? 50 : 25; let grid = '', lab = '';
    for (let T = 0; T <= tMax; T += step) { grid += `<path class="gr" d="M${x0} ${Y(T)}H${x1}"/>`; lab += `<text class="mu me" x="${x0 - 4}" y="${Y(T) + 3}">${T}</text>`; }
    const unit = tEnd > 180 ? 'min' : 's', div = tEnd > 180 ? 60 : 1, tk = tEnd > 180 ? Math.ceil(tEnd / 60 / 4) * 60 : Math.max(1, Math.ceil(tEnd / 4 / (tEnd > 40 ? 10 : 5)) * (tEnd > 40 ? 10 : 5));
    let xl = ''; for (let t = 0; t <= tEnd + 1e-9; t += tk) xl += `<text class="mu md" x="${X(t)}" y="${y1 + 12}">${Math.round(t / div)}</text>`;
    let pts = ''; for (let i = 0; i < n; i++) pts += (i ? 'L' : 'M') + X(hT[i]) + ' ' + Y(hV[i]);
    if (n === 1) pts += 'L' + (X(hT[0]) + 1) + ' ' + Y(hV[0]);
    const failX = info.failAt != null ? X(info.failAt) : null;
    const lines = `<path class="l1" d="M${x0} ${Y(sp.tGrenz)}H${x1}"/><text class="mu me" x="${x1}" y="${Y(sp.tGrenz) - 3}">Nennleistung ${Math.round(sp.tGrenz)} °C</text>`
      + `<path class="l2" d="M${x0} ${Y(sp.tAus)}H${x1}"/><text class="me" x="${x1}" y="${Y(sp.tAus) - 3}">${sp.fail === 'abschalt' ? 'Abschaltung' : 'Ausfall'} ab ${Math.round(sp.tAus)} °C</text>`;
    const mark = failX != null ? `<path class="l2" d="M${failX} ${y0}V${y1}"/><text x="${Math.min(failX + 3, x1 - 40)}" y="${y0 + 22}">${info.status === 'defekt' ? 'defekt' : 'aus'}</text>` : '';
    const desc = `Temperaturverlauf von ${info.name || ART[sp.art]}: jetzt ${grad(info.T)}, Nennleistung ergibt ${Math.round(sp.tGrenz)} °C, ${sp.fail === 'abschalt' ? 'Abschaltung' : 'Ausfall'} ab ${Math.round(sp.tAus)} °C` + (info.status === 'defekt' ? ', Bauteil ist defekt' : '');
    return `<svg class="thx" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(desc)}"><title>${esc(desc)}</title>${grid}${lab}${xl}<text class="mu" x="${x0}" y="${H - 3}">Zeit in ${unit} (Wärmezeit)</text><text class="mu" x="2" y="8">°C</text>${lines}${mark}<path class="cv" d="${pts}"/></svg>`;
  }
  function skalaHtml() {
    const z = [[25, 'Zimmer'], [60, 'warm'], [100, 'heiß'], [150, 'sehr heiß'], [200, 'glühend']];
    return '<div class="thk" aria-label="Farbskala der Temperatur">' + z.map(a => `<span><i style="background:${farbe(a[0])}"></i>${esc(a[1])} ${a[0]} °C</span>`).join('') + '</div>';
  }
  /* Kartenblock für ein Bauteil: Chip, Belastungsbalken, Verlauf, Hinweise */
  function kartenHtml(info, opt) {
    if (!info || !info.spec) return '';
    opt = opt || {}; const sp = info.spec;
    const status = info.status === 'defekt' ? '<p class="thn"><b>⛔ defekt</b>: ' + esc(textZustand(sp, info)) + '.</p>' : info.status === 'abgeschaltet' ? '<p class="thn"><b>⛔ thermisch abgeschaltet</b>, schaltet nach dem Abkühlen wieder ein.</p>' : '';
    const std = sp.std ? ' (Standardwert, einstellbar)' : '';
    return `<div class="thm"><div class="thh"><span>Temperatur</span>${chip(info.T, sp)}</div>${info.status === 'ok' ? balkenHtml(info.P, sp) : ''}${status}${verlaufSvg(info)}<p class="thn">Nennwert: ${esc(fmtW(sp.pn))}${std}, ${esc(sp.bauform)}. Umgebung 25 °C. ${opt.ausfall === false ? 'Ausfälle sind ausgeschaltet: Die Temperatur wird nur angezeigt.' : ''} Vereinfachtes Modell mit Lehr-Zeitkonstanten (Wärmezeit).</p></div>`;
  }

  /* ---------- Zeichenfläche ---------- */
  let rm = false;
  try { if (root.matchMedia) { const mq = root.matchMedia('(prefers-reduced-motion: reduce)'); rm = !!mq.matches; if (mq.addEventListener) mq.addEventListener('change', e => { rm = !!e.matches; }); } } catch (e) { rm = false; }
  const reduziert = () => rm;
  /* in den lokalen Koordinaten des Bauteils (1 Einheit = 1 Rasterfeld), box = [x0, y0, x1, y1] */
  function zeichneKoerper(c, box, T, defekt) {
    if (!c || !box) return;
    const a = clamp((T - 32) / 150, 0, 0.8);
    const cx = (box[0] + box[2]) / 2, cy = (box[1] + box[3]) / 2, r = Math.max(box[2] - box[0], box[3] - box[1]) * 0.62;
    if (a >= 0.02) {
      const [R, G, B] = farbeRgb(T), g = c.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, `rgba(${R},${G},${B},${q1(a)})`); g.addColorStop(0.55, `rgba(${R},${G},${B},${q1(a * 0.45)})`); g.addColorStop(1, `rgba(${R},${G},${B},0)`);
      c.save(); c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill(); c.restore();
    }
    if (defekt) { c.save(); c.fillStyle = 'rgba(28,18,10,.72)'; c.beginPath(); c.ellipse ? c.ellipse(cx, cy, (box[2] - box[0]) * 0.28, (box[3] - box[1]) * 0.24, 0, 0, 7) : c.arc(cx, cy, 0.6, 0, 7); c.fill(); c.restore(); }
  }
  /* Rauchwölkchen in Bildschirmkoordinaten (x, y = Mitte des Bauteils, s = Pixel je Rasterfeld, t = Zeit in s) */
  function zeichneRauch(c, x, y, s, t, stark) {
    if (!c || !fin(x) || !fin(y) || !(s > 0)) return;
    c.save();
    if (rm) { c.fillStyle = 'rgba(160,160,165,.24)'; c.beginPath(); c.arc(x, y - s * 0.9, s * 0.42, 0, 7); c.fill(); c.beginPath(); c.arc(x + s * 0.25, y - s * 1.2, s * 0.3, 0, 7); c.fill(); c.restore(); return; }
    for (let i = 0; i < 3; i++) {
      const ph = ((t * 0.3 + i / 3) % 1 + 1) % 1, a = 0.24 * (1 - ph) * (stark ? 1 : 0.7);
      c.fillStyle = `rgba(160,160,165,${q1(a * 100) / 100})`;
      c.beginPath(); c.arc(x + Math.sin(t * 1.3 + i * 2.1) * s * 0.28 + (i - 1) * s * 0.18, y - s * 0.4 - ph * s * 2.2, s * (0.22 + 0.4 * ph), 0, 7); c.fill();
    }
    c.restore();
  }
  function zeichneDefekt(c, x, y, text) {
    if (!c) return;
    c.save(); c.font = '700 11px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const w = c.measureText(text).width + 12;
    c.fillStyle = 'rgba(40,16,12,.92)'; c.strokeStyle = '#ff5c5c'; c.lineWidth = 1.5; c.beginPath(); if (c.roundRect) c.roundRect(x - w / 2, y - 9, w, 18, 9); else c.rect(x - w / 2, y - 9, w, 18); c.fill(); c.stroke();
    c.fillStyle = '#ffd6d0'; c.fillText(text, x, y + 1); c.restore();
  }
  /* Wärmebild: blobs = [{x, y, r, T, text}] in Pixeln; dunkelt die Schaltung ab und legt Wärmeflecken mit Beschriftung darüber */
  function zeichneWaermebild(c, W, H, blobs, opt) {
    if (!c) return; opt = opt || {};
    c.save();
    c.fillStyle = 'rgba(6,8,12,.62)'; c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'lighter';
    (blobs || []).forEach(b => {
      if (!fin(b.x) || !fin(b.y) || !fin(b.T)) return;
      const r = Math.max(18, b.r || 40), [R, G, B] = farbeRgb(b.T), g = c.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
      g.addColorStop(0, `rgba(${R},${G},${B},.95)`); g.addColorStop(0.5, `rgba(${R},${G},${B},.45)`); g.addColorStop(1, `rgba(${R},${G},${B},0)`);
      c.fillStyle = g; c.beginPath(); c.arc(b.x, b.y, r, 0, 7); c.fill();
    });
    c.globalCompositeOperation = 'source-over';
    c.font = '700 12px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    (blobs || []).forEach(b => {
      if (!fin(b.x) || !fin(b.y) || !b.text) return;
      c.lineWidth = 4; c.strokeStyle = 'rgba(6,8,12,.95)'; c.strokeText(b.text, b.x, b.y + (b.r || 40) * 0.55); c.fillStyle = '#fff'; c.fillText(b.text, b.x, b.y + (b.r || 40) * 0.55);
    });
    /* Legende */
    const lx = 10, ly = 10, lw = Math.min(220, W - 20), lh = 12, g2 = c.createLinearGradient(lx, 0, lx + lw, 0);
    for (let i = 0; i <= 10; i++) g2.addColorStop(i / 10, farbe(25 + (230 - 25) * i / 10));
    c.fillStyle = 'rgba(6,8,12,.85)'; c.fillRect(lx - 4, ly - 4, lw + 8, 54); c.fillStyle = g2; c.fillRect(lx, ly + 14, lw, lh);
    c.fillStyle = '#e8ecf0'; c.font = '700 11px system-ui,sans-serif'; c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText('Wärmebild (°C)', lx, ly - 1);
    c.font = '600 10px system-ui,sans-serif'; c.textBaseline = 'top';
    [[25, 'Zimmer'], [100, 'heiß'], [200, 'glühend']].forEach(a => { const x = lx + lw * (a[0] - 25) / (230 - 25); c.textAlign = a[0] === 25 ? 'left' : a[0] === 200 ? 'right' : 'center'; c.fillText(a[1] + ' ' + a[0], Math.min(x, lx + lw), ly + 30); });
    c.restore();
  }

  const TH = { TAMB, FAKTOR, HYST, spec, ufWert, UFREI, tSS, stepT, zeitBis, leistung, create, farbe, farbeRgb, stufe, STUFEN, balkenHtml, balkenRoh, verlaufSvg, kartenHtml, skalaHtml, chip, erklaerung, textFehler, zeichneKoerper, zeichneRauch, zeichneDefekt, zeichneWaermebild, reduziert, fmtW, fmtZeit, fmtA, grad, css: CSS, ART };
  root.THERM = TH;
  if (typeof module !== 'undefined' && module.exports) module.exports = TH;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
