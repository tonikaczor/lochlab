'use strict';
/* Tonfunk Rechen-Lab (Technische Mathematik): reine Logik ohne Oberfläche, auch per Node testbar.
   Inhalt: Zahlen (deutsch lesen/schreiben, Runden, signifikante Stellen), Einheiten und Zehnerpotenzen, Dreisatz, Mischung, Maßstab,
   Prozent/Promille/Zinsen, Formeln umstellen (mit Ausdrucks-Parser zur Gegenprobe), Geometrie, Pythagoras und Winkelfunktionen,
   Statistik und Messwerte. Jede Rechnung liefert den Lösungsweg als Liste von Textzeilen (steps).
   Export: window.MAT_CORE bzw. module.exports (Node). */
(function (root) {
  const fin = v => typeof v === 'number' && isFinite(v);
  const rs = v => fin(v) ? parseFloat(v.toPrecision(12)) : v;               /* 12 gültige Stellen: Gleitkomma-Rauschen weg */
  /* kaufmännisch runden (0,5 rundet auf), d = Nachkommastellen (auch negativ: Zehner, Hunderter) */
  function rd(v, d) { if (!fin(v)) return v; const f = Math.pow(10, d || 0); return rs(Math.sign(v) * Math.round(parseFloat((Math.abs(v) * f).toPrecision(15))) / f); }
  const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
  const sup = n => String(n).replace(/[0-9-]/g, c => SUP[c]);
  const MU = 'µ', OHM = 'Ω';

  /* ---------------- Zahlen deutsch ---------------- */
  /* "23,35", "12 V", "3,5 €", "1 250" -> Zahl; sonst NaN */
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NaN;
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/[A-Za-zµΩ°€%‰²³\/]+$/, '').replace(',', '.');
    if (!/^[+\-−]?\d+(\.\d+)?$|^[+\-−]?\.\d+$/.test(s)) return NaN;
    return parseFloat(s.replace('−', '-'));
  }
  /* Zahl -> Text, höchstens md Nachkommastellen, ohne überflüssige Nullen: 2,5 ; 1200 ; 0,000047 */
  function fmt(v, md) {
    if (!fin(v)) return '–';
    md = md == null ? 6 : md;
    let s = rd(v, md).toFixed(md); if (md > 0) s = s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
    if (/^-0$/.test(s)) s = '0';
    return s.replace('-', '−').replace('.', ',');
  }
  /* feste Nachkommastellen: 3,50 */
  function fmtDe(v, dec) {
    if (!fin(v)) return '–';
    let s = rd(v, dec).toFixed(dec); if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
    return s.replace('-', '−').replace('.', ',');
  }
  /* signifikante Stellen runden: roundSig(0,0123456, 3) = 0,0123 */
  function roundSig(v, n) { if (!fin(v) || v === 0 || n < 1) return v === 0 ? 0 : NaN; return rd(v, n - 1 - Math.floor(Math.log10(Math.abs(v)))); }
  /* signifikante Stellen einer Zahl als Text: "0,0250" -> 3, "1200" -> 2 (Nullen am Ende ohne Komma zählen nicht), "100,0" -> 4 */
  function sigDigits(s) {
    s = String(s).trim().replace(/^[+\-−]/, '').replace(',', '.'); if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
    let d = s.replace('.', '');
    if (s.indexOf('.') < 0) d = d.replace(/0+$/, ''); d = d.replace(/^0+/, '');
    return d.length || (/^0*$/.test(s.replace('.', '')) ? 1 : 0);
  }

  /* ---------------- Zufall (seed-fähig) ---------------- */
  function hashStr(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    let a = (typeof seed === 'number' ? seed >>> 0 : hashStr(seed)) || 1;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const ri = (R, a, b) => a + Math.floor(R() * (b - a + 1));
  const pick = (R, a) => a[Math.floor(R() * a.length)];
  const shuffle = (R, a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };

  /* ---------------- Vorsätze, Zehnerpotenzen ---------------- */
  const PREFIX = [{ s: 'p', n: 'Piko', e: -12 }, { s: 'n', n: 'Nano', e: -9 }, { s: MU, n: 'Mikro', e: -6 }, { s: 'm', n: 'Milli', e: -3 }, { s: 'k', n: 'Kilo', e: 3 }, { s: 'M', n: 'Mega', e: 6 }, { s: 'G', n: 'Giga', e: 9 }];
  /* Wissenschaftliche Schreibweise: v = m · 10^e mit 1 <= |m| < 10 */
  function sci(v) {
    if (!fin(v)) return null; if (v === 0) return { m: 0, e: 0 };
    let e = Math.floor(Math.log10(Math.abs(v))), m = rs(v / Math.pow(10, e));
    if (Math.abs(m) >= 10) { m = rs(m / 10); e++; } if (Math.abs(m) < 1) { m = rs(m * 10); e--; }
    return { m, e };
  }
  function fmtSci(v) { const s = sci(v); if (!s) return '–'; return s.e === 0 ? fmt(s.m, 10) : fmt(s.m, 10) + ' · 10' + sup(s.e); }
  /* Technische Schreibweise: Exponent durch 3 teilbar, dazu der Vorsatz: 47000 -> 47 k */
  function eng(v) {
    const s = sci(v); if (!s || v === 0) return { m: 0, e3: 0, prefix: '' };
    const e3 = Math.floor(s.e / 3) * 3, p = PREFIX.find(x => x.e === e3);
    return { m: rs(v / Math.pow(10, e3)), e3, prefix: e3 === 0 ? '' : p ? p.s : null };
  }

  /* ---------------- Einheiten ---------------- */
  const FAM = {
    laenge: { name: 'Länge', lb: 1, u: { nm: 1e-9, [MU + 'm']: 1e-6, mm: 1e-3, cm: 1e-2, dm: 0.1, m: 1, km: 1e3 } },
    flaeche: { name: 'Fläche', u: { 'mm²': 1e-6, 'cm²': 1e-4, 'dm²': 1e-2, 'm²': 1, a: 100, ha: 1e4, 'km²': 1e6 } },
    volumen: { name: 'Volumen', u: { 'mm³': 1e-9, 'cm³': 1e-6, ml: 1e-6, 'dm³': 1e-3, l: 1e-3, 'm³': 1 } },
    masse: { name: 'Masse', lb: 1e-3, u: { [MU + 'g']: 1e-9, mg: 1e-6, g: 1e-3, kg: 1, t: 1e3 } },
    zeit: { name: 'Zeit', lb: 1, u: { ms: 1e-3, s: 1, min: 60, h: 3600, d: 86400 } },
    geschw: { name: 'Geschwindigkeit', u: { 'mm/s': 1e-3, 'm/min': 1 / 60, 'm/s': 1, 'km/h': 1 / 3.6 } },
    druck: { name: 'Druck', lb: 1, u: { Pa: 1, mbar: 100, hPa: 100, kPa: 1e3, bar: 1e5, 'N/mm²': 1e6, MPa: 1e6 } },
    leistung: { name: 'Leistung', lb: 1, u: { mW: 1e-3, W: 1, kW: 1e3, MW: 1e6 } },
    spannung: { name: 'Spannung', lb: 1, u: { [MU + 'V']: 1e-6, mV: 1e-3, V: 1, kV: 1e3 } },
    strom: { name: 'Strom', lb: 1, u: { [MU + 'A']: 1e-6, mA: 1e-3, A: 1, kA: 1e3 } },
    widerstand: { name: 'Widerstand', lb: 1, u: { ['m' + OHM]: 1e-3, [OHM]: 1, ['k' + OHM]: 1e3, ['M' + OHM]: 1e6 } }
  };
  function unitInfo(u) { for (const k in FAM) if (Object.prototype.hasOwnProperty.call(FAM[k].u, u)) return { fam: k, f: FAM[k].u[u] }; return null; }
  /* Umrechnen mit Lösungsweg. Ergebnis { value, ratio, steps } oder null (unbekannte Einheit, andere Größenart, keine Zahl) */
  function convert(v, from, to) {
    const a = unitInfo(from), b = unitInfo(to); if (!a || !b || a.fam !== b.fam || !fin(v)) return null;
    const ratio = rs(a.f / b.f), value = rs(v * ratio), lg = Math.log10(ratio), isPow = Math.abs(lg - Math.round(lg)) < 1e-9, n = Math.round(lg), steps = [];
    if (from === to) return { value: v, ratio: 1, steps: ['Gleiche Einheit: nichts umzurechnen.'] };
    if (isPow) {
      steps.push(ratio >= 1 ? `1 ${from} = ${fmt(ratio)} ${to}` : `1 ${to} = ${fmt(rs(1 / ratio))} ${from}`);
      const fam = a.fam, quad = fam === 'flaeche' ? ' (Fläche: je Stufe 100, nicht 10)' : fam === 'volumen' ? ' (Volumen: je Stufe 1000, nicht 10)' : '';
      steps.push(`Umrechnungszahl ${fmt(ratio >= 1 ? ratio : rs(1 / ratio))} = 10${sup(Math.abs(n))}${quad}`);
      steps.push(ratio >= 1 ? `${fmt(v)} ${from} · ${fmt(ratio)} = ${fmt(value)} ${to}  (Komma ${Math.abs(n)} Stellen nach rechts: die Einheit wird kleiner, die Zahl größer)` : `${fmt(v)} ${from} : ${fmt(rs(1 / ratio))} = ${fmt(value)} ${to}  (Komma ${Math.abs(n)} Stellen nach links: die Einheit wird größer, die Zahl kleiner)`);
    } else {
      steps.push(ratio >= 1 ? `1 ${from} = ${fmt(ratio)} ${to}` : `1 ${to} = ${fmt(rs(1 / ratio))} ${from}`);
      steps.push(ratio >= 1 ? `${fmt(v)} ${from} · ${fmt(ratio)} = ${fmt(value)} ${to}` : `${fmt(v)} ${from} : ${fmt(rs(1 / ratio))} = ${fmt(value)} ${to}`);
    }
    return { value, ratio, steps };
  }

  /* ---------------- Dreisatz, Mischung, Maßstab ---------------- */
  /* a la <-> b lb ; gesucht: y lb bei x la.  typ 'direkt' (je mehr, desto mehr) oder 'indirekt' (je mehr, desto weniger) */
  function dreisatz(typ, a, b, x, la, lb) {
    la = la || ''; lb = lb || ''; if (![a, b, x].every(fin) || a === 0 || (typ === 'indirekt' && x === 0) || (typ !== 'direkt' && typ !== 'indirekt')) return null;
    const U = (n, u) => fmt(n) + (u ? ' ' + u : ''); let c, y, steps;
    if (typ === 'direkt') {
      c = rs(b / a); y = rs(c * x);
      steps = ['Gegeben: ' + U(a, la) + '  →  ' + U(b, lb), `Auf 1 ${la} schließen (÷ ${fmt(a)}): 1 ${la}  →  ${fmt(b)} ÷ ${fmt(a)} = ${U(c, lb)}`, `Auf ${U(x, la)} hochrechnen (· ${fmt(x)}): ${fmt(c)} · ${fmt(x)} = ${U(y, lb)}`, 'Je mehr, desto mehr (direkt proportional): beide Seiten ändern sich mit demselben Faktor.'];
    } else {
      c = rs(a * b); y = rs(c / x);
      steps = ['Gegeben: ' + U(a, la) + '  →  ' + U(b, lb), `Auf 1 ${la} schließen (· ${fmt(a)}): 1 ${la}  →  ${fmt(b)} · ${fmt(a)} = ${U(c, lb)}`, `Auf ${U(x, la)} aufteilen (÷ ${fmt(x)}): ${fmt(c)} ÷ ${fmt(x)} = ${U(y, lb)}`, 'Je mehr, desto weniger (indirekt proportional): das Produkt aus beiden Größen bleibt gleich.'];
    }
    return { value: y, one: c, steps, schema: [[a, b], [1, c], [x, y]], typ };
  }
  /* Teilungsverhältnis, z. B. Konzentrat : Wasser = 1 : 4 bei 10 l Gesamtmenge */
  function teilung(parts, total) {
    if (!Array.isArray(parts) || !parts.length || !parts.every(p => fin(p) && p >= 0) || !fin(total)) return null;
    const sum = parts.reduce((s, p) => s + p, 0); if (sum === 0) return null;
    const one = rs(total / sum), shares = parts.map(p => rs(p * one));
    return { shares, one, steps: [`Teile insgesamt: ${parts.map(fmt).join(' + ')} = ${fmt(sum)}`, `Ein Teil: ${fmt(total)} ÷ ${fmt(sum)} = ${fmt(one)}`, ...shares.map((s, i) => `Anteil ${i + 1}: ${fmt(parts[i])} · ${fmt(one)} = ${fmt(s)}`)] };
  }
  /* Maßstab num : den (z. B. 1 : 50 verkleinert, 5 : 1 vergrößert); aus Zeichnungslänge die wirkliche Länge, oder umgekehrt */
  function massstab(num, den, len, richtung) {
    if (![num, den, len].every(fin) || num <= 0 || den <= 0) return null; const f = rs(den / num), back = richtung === 'zeichnung';
    const value = back ? rs(len / f) : rs(len * f), s = [`Maßstab ${fmt(num)} : ${fmt(den)} heißt: ${fmt(num)} Teil auf dem Papier = ${fmt(den)} Teile in Wirklichkeit.`, `Umrechnungsfaktor: ${fmt(den)} ÷ ${fmt(num)} = ${fmt(f)}`];
    s.push(back ? `Zeichnung = wirkliche Länge ÷ ${fmt(f)} = ${fmt(len)} ÷ ${fmt(f)} = ${fmt(value)}` : `Wirkliche Länge = Zeichnung · ${fmt(f)} = ${fmt(len)} · ${fmt(f)} = ${fmt(value)}`);
    return { value, factor: f, steps: s };
  }

  /* ---------------- Prozent, Promille, Zinsen ---------------- */
  /* kind: pw (Prozentwert), ps (Prozentsatz), gw (Grundwert), mehr (vermehrter Grundwert), minder (verminderter Grundwert),
     gwMehr (Grundwert aus vermehrtem Wert), gwMinder, mwst (netto -> brutto), netto (brutto -> netto), skonto (Zahlbetrag),
     promille (Promillewert), toleranz (Toleranz in % vom Nennmaß), zins (Zinsen, z = Tage, 360-Tage-Jahr) */
  function proz(kind, x, y, z) {
    if (!fin(x) || !fin(y)) return null; let v, s;
    const one = (G, W) => `Dreisatz: 100 % ≙ ${fmt(G)}  →  1 % ≙ ${fmt(G)} ÷ 100 = ${fmt(rs(G / 100))}`;
    switch (kind) {
      case 'pw': v = rs(x * y / 100); s = [one(x), `${fmt(y)} % ≙ ${fmt(rs(x / 100))} · ${fmt(y)} = ${fmt(v)}`, `Formel: W = G · p / 100 = ${fmt(x)} · ${fmt(y)} / 100 = ${fmt(v)}`]; break;
      case 'ps': if (x === 0) return null; v = rs(y / x * 100); s = [`Formel: p = W / G · 100 %`, `p = ${fmt(y)} / ${fmt(x)} · 100 % = ${fmt(rs(y / x), 6)} · 100 % = ${fmt(v)} %`]; break;
      case 'gw': if (y === 0) return null; v = rs(x * 100 / y); s = [`${fmt(y)} % ≙ ${fmt(x)}`, `1 % ≙ ${fmt(x)} ÷ ${fmt(y)} = ${fmt(rs(x / y), 6)}`, `100 % ≙ ${fmt(rs(x / y), 6)} · 100 = ${fmt(v)}`, `Formel: G = W · 100 / p = ${fmt(x)} · 100 / ${fmt(y)} = ${fmt(v)}`]; break;
      case 'mehr': case 'mwst': v = rs(x * (1 + y / 100)); s = [`Vermehrter Wert: ${kind === 'mwst' ? 'Brutto' : 'Endwert'} = Grundwert · (1 + p/100)`, `${fmt(x)} · (1 + ${fmt(y)}/100) = ${fmt(x)} · ${fmt(rs(1 + y / 100))} = ${fmt(v)}`, `Probe: Zuschlag ${fmt(y)} % von ${fmt(x)} = ${fmt(rs(x * y / 100))}; ${fmt(x)} + ${fmt(rs(x * y / 100))} = ${fmt(v)}`]; break;
      case 'minder': case 'skonto': v = rs(x * (1 - y / 100)); s = [`Verminderter Wert: ${kind === 'skonto' ? 'Zahlbetrag' : 'Endwert'} = Grundwert · (1 − p/100)`, `${fmt(x)} · (1 − ${fmt(y)}/100) = ${fmt(x)} · ${fmt(rs(1 - y / 100))} = ${fmt(v)}`, `Probe: Abzug ${fmt(y)} % von ${fmt(x)} = ${fmt(rs(x * y / 100))}; ${fmt(x)} − ${fmt(rs(x * y / 100))} = ${fmt(v)}`]; break;
      case 'gwMehr': case 'netto': if (1 + y / 100 === 0) return null; v = rs(x / (1 + y / 100)); s = [`Der vermehrte Wert ${fmt(x)} entspricht ${fmt(rs(100 + y))} % (Grundwert = 100 %).`, `Grundwert (${kind === 'netto' ? 'Netto' : 'vorher'}) = ${fmt(x)} / (1 + ${fmt(y)}/100) = ${fmt(x)} / ${fmt(rs(1 + y / 100))} = ${fmt(v)}`, 'Achtung: nicht einfach p % abziehen, denn p % beziehen sich auf den kleineren Grundwert.']; break;
      case 'gwMinder': if (y === 100) return null; v = rs(x / (1 - y / 100)); s = [`Der verminderte Wert ${fmt(x)} entspricht ${fmt(rs(100 - y))} % (Grundwert = 100 %).`, `Grundwert = ${fmt(x)} / (1 − ${fmt(y)}/100) = ${fmt(x)} / ${fmt(rs(1 - y / 100))} = ${fmt(v)}`]; break;
      case 'promille': v = rs(x * y / 1000); s = ['1 ‰ = 1/1000 (Promille = Tausendstel)', `W = G · p‰ / 1000 = ${fmt(x)} · ${fmt(y)} / 1000 = ${fmt(v)}`]; break;
      case 'toleranz': if (x === 0) return null; v = rs(Math.abs(y) / Math.abs(x) * 100); s = ['Toleranz in % = Abmaß / Nennmaß · 100 %', `${fmt(Math.abs(y))} / ${fmt(Math.abs(x))} · 100 % = ${fmt(v)} %`]; break;
      case 'zins': if (!fin(z)) return null; v = rs(x * y / 100 * z / 360); s = ['Einfache Zinsen: Z = K · p/100 · t/360 (kaufmännisch: 1 Jahr = 360 Tage)', `Z = ${fmt(x)} · ${fmt(y)}/100 · ${fmt(z)}/360 = ${fmt(rs(x * y / 100))} · ${fmt(rs(z / 360), 6)} = ${fmt(v)}`]; break;
      default: return null;
    }
    return { value: v, steps: s, kind };
  }

  /* ---------------- Ausdrücke rechnen (Gegenprobe beim Umstellen) ---------------- */
  /* + - * / ^ ( ), Zahlen, Variablen, pi, sqrt(). Ungültig oder Division durch 0 gibt NaN/Infinity zurück. */
  function evalExpr(str, vars) {
    vars = vars || {}; const src = String(str).replace(/\s+/g, ''), tk = src.match(/\d+\.?\d*|\.\d+|[A-Za-z_]\w*|[-+*\/^()]/g) || [];
    if (tk.join('') !== src) return NaN; let i = 0; const peek = () => tk[i], next = () => tk[i++];
    function expr() { let v = term(); while (peek() === '+' || peek() === '-') { const o = next(), r = term(); v = o === '+' ? v + r : v - r; } return v; }
    function term() { let v = unary(); while (peek() === '*' || peek() === '/') { const o = next(), r = unary(); v = o === '*' ? v * r : v / r; } return v; }
    function unary() { if (peek() === '-') { next(); return -unary(); } if (peek() === '+') { next(); return unary(); } return power(); }
    function power() { const b = atom(); if (peek() === '^') { next(); return Math.pow(b, unary()); } return b; }
    function atom() {
      const t = next(); if (t === undefined) throw new Error('Ende');
      if (/^[\d.]/.test(t)) return parseFloat(t);
      if (t === '(') { const v = expr(); if (next() !== ')') throw new Error(')'); return v; }
      if (t === 'sqrt') { if (next() !== '(') throw new Error('('); const v = expr(); if (next() !== ')') throw new Error(')'); return Math.sqrt(v); }
      if (t === 'pi') return Math.PI;
      if (typeof vars[t] === 'number') return vars[t];
      throw new Error('Variable ' + t);
    }
    try { const v = expr(); return i === tk.length ? v : NaN; } catch (e) { return NaN; }
  }
  const idsOf = e => (String(e).match(/[A-Za-z_]\w*/g) || []).filter(x => x !== 'pi' && x !== 'sqrt');
  /* Anzeige: * -> ·, pi -> π, rho -> ρ, ^2 -> ² */
  const pretty = s => String(s).replace(/\*/g, '·').replace(/\bpi\b/g, 'π').replace(/\brho\b/g, 'ρ').replace(/\^2/g, '²').replace(/\^3/g, '³').replace(/sqrt\(/g, '√(').replace(/([\w²³)])([+-])(?=[\w(π√(])/g, (m, a, o) => a + ' ' + (o === '-' ? '−' : '+') + ' ');
  /* Zahlen in den Ausdruck einsetzen: 'pi*d^2/4' mit d=20 -> 'π·20²/4' */
  const subst = (e, env) => pretty(String(e).replace(/[A-Za-z_]\w*/g, m => (m === 'pi' || m === 'sqrt') ? m : typeof env[m] === 'number' ? (env[m] < 0 ? '(' + fmt(env[m]) + ')' : fmt(env[m])) : m));
  /* Rechenzeile: "A = π·d²/4 = π·20²/4 = 314,2 mm²" */
  function calcLine(name, expr, env, dec, unit) {
    const v = evalExpr(expr, env), txt = !fin(v) ? '–' : dec == null ? fmt(v, 4) : fmtDe(v, dec);
    return `${name} = ${pretty(expr)} = ${subst(expr, env)} = ${txt}${unit ? ' ' + unit : ''}`;
  }

  /* ---------------- Formeln umstellen ----------------
     Jede Umformung: [Rechenschritt (Operation auf beiden Seiten), neue Gleichung, falsche Alternativen (für den Übungsmodus)]. */
  const BOTH = 'beide Seiten ';
  const FORMELN = [
    { id: 'ohm', name: 'Ohmsches Gesetz', eq: 'U = R*I', vars: { U: ['Spannung', 'V'], R: ['Widerstand', OHM], I: ['Strom', 'A'] }, sol: {
      R: [[BOTH + ': I', 'U/I = R', [BOTH + '· I', BOTH + '− I']], ['Seiten tauschen', 'R = U/I', []]],
      I: [[BOTH + ': R', 'U/R = I', [BOTH + '· R', BOTH + '− R']], ['Seiten tauschen', 'I = U/R', []]] } },
    { id: 'weg', name: 'Geschwindigkeit', eq: 'v = s/t', vars: { v: ['Geschwindigkeit', 'km/h'], s: ['Weg', 'km'], t: ['Zeit', 'h'] }, sol: {
      s: [[BOTH + '· t', 'v*t = s', [BOTH + ': t', BOTH + '+ t']], ['Seiten tauschen', 's = v*t', []]],
      t: [[BOTH + '· t', 'v*t = s', [BOTH + ': t', BOTH + '− t']], [BOTH + ': v', 't = s/v', [BOTH + '· v', BOTH + '− v']]] } },
    { id: 'kraft', name: 'Kraft', eq: 'F = m*a', vars: { F: ['Kraft', 'N'], m: ['Masse', 'kg'], a: ['Beschleunigung', 'm/s²'] }, sol: {
      m: [[BOTH + ': a', 'F/a = m', [BOTH + '· a', BOTH + '− a']], ['Seiten tauschen', 'm = F/a', []]],
      a: [[BOTH + ': m', 'F/m = a', [BOTH + '· m', BOTH + '− m']], ['Seiten tauschen', 'a = F/m', []]] } },
    { id: 'kreis', name: 'Kreisfläche', eq: 'A = pi*d^2/4', vars: { A: ['Fläche', 'mm²'], d: ['Durchmesser', 'mm'] }, sol: {
      d: [[BOTH + '· 4', '4*A = pi*d^2', [BOTH + ': 4', BOTH + '− 4']], [BOTH + ': π', '4*A/pi = d^2', [BOTH + '· π', BOTH + '− π']], ['Wurzel ziehen (√)', 'sqrt(4*A/pi) = d', ['Quadrieren (²)', BOTH + ': 2']], ['Seiten tauschen', 'd = sqrt(4*A/pi)', []]] } },
    { id: 'leist', name: 'Elektrische Leistung', eq: 'P = U*I', vars: { P: ['Leistung', 'W'], U: ['Spannung', 'V'], I: ['Strom', 'A'] }, sol: {
      U: [[BOTH + ': I', 'P/I = U', [BOTH + '· I', BOTH + '− I']], ['Seiten tauschen', 'U = P/I', []]],
      I: [[BOTH + ': U', 'P/U = I', [BOTH + '· U', BOTH + '− U']], ['Seiten tauschen', 'I = P/U', []]] } },
    { id: 'dichte', name: 'Dichte', eq: 'rho = m/V', vars: { rho: ['Dichte', 'g/cm³'], m: ['Masse', 'g'], V: ['Volumen', 'cm³'] }, sol: {
      m: [[BOTH + '· V', 'rho*V = m', [BOTH + ': V', BOTH + '+ V']], ['Seiten tauschen', 'm = rho*V', []]],
      V: [[BOTH + '· V', 'rho*V = m', [BOTH + ': V', BOTH + '− V']], [BOTH + ': ρ', 'V = m/rho', [BOTH + '· ρ', BOTH + '− ρ']]] } },
    { id: 'pu2r', name: 'Leistung aus Spannung und Widerstand', eq: 'P = U^2/R', vars: { P: ['Leistung', 'W'], U: ['Spannung', 'V'], R: ['Widerstand', OHM] }, sol: {
      U: [[BOTH + '· R', 'P*R = U^2', [BOTH + ': R', BOTH + '− R']], ['Wurzel ziehen (√)', 'sqrt(P*R) = U', ['Quadrieren (²)', BOTH + ': 2']], ['Seiten tauschen', 'U = sqrt(P*R)', []]],
      R: [[BOTH + '· R', 'P*R = U^2', [BOTH + ': R', BOTH + '− R']], [BOTH + ': P', 'R = U^2/P', [BOTH + '· P', BOTH + '− P']]] } },
    { id: 'zyl', name: 'Zylindervolumen', eq: 'V = pi*d^2/4*h', vars: { V: ['Volumen', 'cm³'], d: ['Durchmesser', 'cm'], h: ['Höhe', 'cm'] }, sol: {
      h: [[BOTH + '· 4', '4*V = pi*d^2*h', [BOTH + ': 4', BOTH + '− 4']], [BOTH + ': (π · d²)', '4*V/(pi*d^2) = h', [BOTH + '· (π · d²)', BOTH + '− h']], ['Seiten tauschen', 'h = 4*V/(pi*d^2)', []]] } },
    /* Neu (Berufsschulstoff Grundlagen Elektrotechnik): Ladung und Leiterwiderstand */
    { id: 'ladung', name: 'Ladung und Strom (Akku)', eq: 'Q = I*t', vars: { Q: ['Ladung', 'mAh'], I: ['Strom', 'mA'], t: ['Zeit', 'h'] }, sol: {
      I: [[BOTH + ': t', 'Q/t = I', [BOTH + '· t', BOTH + '− t']], ['Seiten tauschen', 'I = Q/t', []]],
      t: [[BOTH + ': I', 'Q/I = t', [BOTH + '· I', BOTH + '− I']], ['Seiten tauschen', 't = Q/I', []]] } },
    { id: 'draht', name: 'Widerstand eines Leiters', eq: 'R = rho*l/A', vars: { R: ['Widerstand', OHM], rho: ['spezifischer Widerstand', OHM + '·mm²/m'], l: ['Länge', 'm'], A: ['Querschnitt', 'mm²'] }, sol: {
      l: [[BOTH + '· A', 'R*A = rho*l', [BOTH + ': A', BOTH + '− A']], [BOTH + ': ρ', 'R*A/rho = l', [BOTH + '· ρ', BOTH + '− ρ']], ['Seiten tauschen', 'l = R*A/rho', []]],
      A: [[BOTH + '· A', 'R*A = rho*l', [BOTH + ': A', BOTH + '− A']], [BOTH + ': R', 'A = rho*l/R', [BOTH + '· R', BOTH + '− R']]] } }
  ];
  const formel = id => FORMELN.find(f => f.id === id) || null;
  const lhsOf = f => f.eq.split('=')[0].trim(), rhsOf = f => f.eq.split('=')[1].trim();
  /* Umformung zu 'target' gesucht: { start, steps:[{op, eq, bad}], result } oder null. Steht die Größe schon links, gibt es keinen Schritt. */
  function umformung(id, target) {
    const f = formel(id); if (!f) return null;
    if (lhsOf(f) === target) return { f, start: f.eq, steps: [], result: f.eq, expr: rhsOf(f) };
    const s = f.sol[target]; if (!s) return null;
    const last = s[s.length - 1][1];
    return { f, start: f.eq, steps: s.map(x => ({ op: x[0], eq: x[1], bad: x[2] })), result: last, expr: last.split('=')[1].trim() };
  }
  /* Zahlenwert der umgestellten Formel; null bei Division durch 0 oder ungültiger Wurzel */
  function solveFor(id, target, env) {
    const u = umformung(id, target); if (!u) return null; const v = evalExpr(u.expr, env); return fin(v) ? v : null;
  }
  /* Gegenprobe (für Tests und Autoren): prüft jede Zeile numerisch an Zufallswerten; Liste der Fehler, leer = alles stimmt */
  function checkUmformung(id, target, seed) {
    const f = formel(id), u = umformung(id, target), R = rng(seed || id + target), err = [];
    if (!f || !u) return ['unbekannt']; const L = lhsOf(f), names = Object.keys(f.vars);
    for (let k = 0; k < 8; k++) {
      const env = {}; names.forEach(n => { env[n] = 1 + ri(R, 1, 90) / 10; }); env[L] = evalExpr(rhsOf(f), env);
      u.steps.forEach((st, i) => { const p = st.eq.split('='), a = evalExpr(p[0], env), b = evalExpr(p[1], env); if (!(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a)))) err.push(`Schritt ${i + 1} (${st.eq}) stimmt nicht`); });
    }
    const fin_ = u.steps.length ? u.steps[u.steps.length - 1].eq.split('=') : null;
    if (fin_ && (fin_[0].trim() !== target || idsOf(fin_[1]).includes(target))) err.push('Ergebnis nicht nach ' + target + ' aufgelöst');
    return [...new Set(err)];
  }

  /* ---------------- Geometrie ---------------- */
  const SHAPES = {
    rechteck: { name: 'Rechteck', p: [['a', 'Länge'], ['b', 'Breite']], o: [['U', 'Umfang', '2*(a+b)', 1], ['A', 'Fläche', 'a*b', 2]] },
    kreis: { name: 'Kreis', p: [['d', 'Durchmesser']], o: [['U', 'Umfang', 'pi*d', 1], ['A', 'Fläche', 'pi*d^2/4', 2]] },
    dreieck: { name: 'Dreieck', p: [['g', 'Grundseite'], ['h', 'Höhe']], o: [['A', 'Fläche', 'g*h/2', 2]] },
    trapez: { name: 'Trapez', p: [['a', 'Seite a'], ['c', 'Seite c'], ['h', 'Höhe']], o: [['A', 'Fläche', '(a+c)/2*h', 2]] },
    ring: { name: 'Kreisring', p: [['D', 'Außen-Ø'], ['d', 'Innen-Ø']], o: [['A', 'Ringfläche', 'pi*(D^2-d^2)/4', 2]] },
    quader: { name: 'Quader', p: [['a', 'Länge'], ['b', 'Breite'], ['c', 'Höhe']], o: [['V', 'Volumen', 'a*b*c', 3], ['O', 'Oberfläche', '2*(a*b+a*c+b*c)', 2]] },
    zylinder: { name: 'Zylinder', p: [['d', 'Durchmesser'], ['h', 'Höhe']], o: [['V', 'Volumen', 'pi*d^2/4*h', 3], ['M', 'Mantelfläche', 'pi*d*h', 2]] },
    kegel: { name: 'Kegel', p: [['d', 'Durchmesser'], ['h', 'Höhe']], o: [['V', 'Volumen', 'pi*d^2/12*h', 3]] },
    kugel: { name: 'Kugel', p: [['d', 'Durchmesser']], o: [['V', 'Volumen', 'pi*d^3/6', 3], ['O', 'Oberfläche', 'pi*d^2', 2]] }
  };
  const unitPow = (u, p) => p === 1 ? u : u + sup(p);
  /* Alle Größen einer Form mit Lösungsweg. env z. B. {d:20, h:50}, unit z. B. 'mm'. null bei Werten <= 0 oder Innen-Ø >= Außen-Ø. */
  function geo(shape, env, unit, dec) {
    const S = SHAPES[shape]; if (!S) return null; const e = {};
    for (const [k] of S.p) { if (!fin(env[k]) || env[k] <= 0) return null; e[k] = env[k]; }
    if (shape === 'ring' && e.d >= e.D) return null;
    if (shape === 'trapez' || shape === 'kegel') { /* keine Zusatzregel */ }
    dec = dec == null ? 2 : dec; unit = unit || '';
    return { results: S.o.map(([k, name, expr, pw]) => ({ k, name, value: evalExpr(expr, e), pow: pw, unit: unit ? unitPow(unit, pw) : '', line: calcLine(k, expr, e, dec, unit ? unitPow(unit, pw) : '') })) };
  }
  const masse = (rho, V) => fin(rho) && fin(V) && rho >= 0 && V >= 0 ? rs(rho * V) : null;

  /* Winkelfunktionen in Grad (auf 12 Stellen gerundet: sin 30° = 0,5 genau) */
  const RAD = Math.PI / 180;
  const sinD = a => rs(Math.sin(a * RAD)), cosD = a => rs(Math.cos(a * RAD)), tanD = a => rs(Math.tan(a * RAD));
  const asinD = x => Math.abs(x) <= 1 ? rs(Math.asin(x) / RAD) : NaN, acosD = x => Math.abs(x) <= 1 ? rs(Math.acos(x) / RAD) : NaN, atanD = x => rs(Math.atan(x) / RAD);
  /* Pythagoras: genau zwei von a, b, c (Katheten a, b; Hypotenuse c) */
  function pyth(o) {
    const has = k => fin(o[k]) && o[k] > 0, n = ['a', 'b', 'c'].filter(has).length; if (n !== 2) return null;
    if (has('c')) { const k = has('a') ? 'a' : 'b', m = k === 'a' ? 'b' : 'a'; if (o.c <= o[k]) return null; const v = Math.sqrt(o.c * o.c - o[k] * o[k]); return { [m]: rs(v), steps: [calcLine(m, 'sqrt(c^2-' + k + '^2)', { c: o.c, [k]: o[k] })] }; }
    return { c: rs(Math.sqrt(o.a * o.a + o.b * o.b)), steps: [calcLine('c', 'sqrt(a^2+b^2)', { a: o.a, b: o.b })] };
  }
  /* Rechtwinkliges Dreieck: a, b Katheten, c Hypotenuse, alpha (gegenüber a), beta (gegenüber b), gamma = 90°. Gegeben: zwei Seiten
     oder eine Seite und ein spitzer Winkel. Ergebnis { a, b, c, alpha, beta, steps } oder null. */
  function solveTri(o) {
    const has = k => fin(o[k]) && o[k] > 0, sides = ['a', 'b', 'c'].filter(has), angs = ['alpha', 'beta'].filter(has);
    for (const k of angs) if (o[k] >= 90) return null;
    let a, b, c, al; const st = [];
    if (sides.length === 2 && angs.length === 0) {
      const p = pyth(o); if (!p) return null; ({ a, b, c } = Object.assign({ a: o.a, b: o.b, c: o.c }, p)); st.push('Pythagoras: a² + b² = c²'); st.push(p.steps[0]);
      if (has('a') && has('b')) { al = atanD(a / b); st.push(`tan α = a / b = ${fmt(a)} / ${fmt(b)} = ${fmt(rs(a / b), 5)}  →  α = tan⁻¹(${fmt(rs(a / b), 5)}) = ${fmt(rd(al, 2))}°`); }
      else if (has('a')) { al = asinD(a / c); st.push(`sin α = a / c = ${fmt(a)} / ${fmt(c)} = ${fmt(rs(a / c), 5)}  →  α = sin⁻¹(${fmt(rs(a / c), 5)}) = ${fmt(rd(al, 2))}°`); }
      else { al = acosD(b / c); st.push(`cos α = b / c = ${fmt(b)} / ${fmt(c)} = ${fmt(rs(b / c), 5)}  →  α = cos⁻¹(${fmt(rs(b / c), 5)}) = ${fmt(rd(al, 2))}°`); }
    } else if (sides.length === 1 && angs.length === 1) {
      al = angs[0] === 'alpha' ? o.alpha : 90 - o.beta; if (angs[0] === 'beta') st.push(`α = 90° − β = 90° − ${fmt(o.beta)}° = ${fmt(al)}°`);
      const s = sides[0], v = o[s];
      if (s === 'a') { a = v; b = rs(a / tanD(al)); c = rs(a / sinD(al)); st.push(`tan α = a / b  →  b = a / tan α = ${fmt(a)} / tan ${fmt(al)}° = ${fmt(rd(b, 3))}`, `sin α = a / c  →  c = a / sin α = ${fmt(a)} / sin ${fmt(al)}° = ${fmt(rd(c, 3))}`); }
      else if (s === 'b') { b = v; a = rs(b * tanD(al)); c = rs(b / cosD(al)); st.push(`tan α = a / b  →  a = b · tan α = ${fmt(b)} · tan ${fmt(al)}° = ${fmt(rd(a, 3))}`, `cos α = b / c  →  c = b / cos α = ${fmt(b)} / cos ${fmt(al)}° = ${fmt(rd(c, 3))}`); }
      else { c = v; a = rs(c * sinD(al)); b = rs(c * cosD(al)); st.push(`sin α = a / c  →  a = c · sin α = ${fmt(c)} · sin ${fmt(al)}° = ${fmt(rd(a, 3))}`, `cos α = b / c  →  b = c · cos α = ${fmt(c)} · cos ${fmt(al)}° = ${fmt(rd(b, 3))}`); }
    } else return null;
    if (![a, b, c, al].every(fin)) return null;
    const be = rs(90 - al); st.push(`β = 90° − α = 90° − ${fmt(rd(al, 2))}° = ${fmt(rd(be, 2))}°  (Winkelsumme 180°, γ = 90°)`);
    return { a, b, c, alpha: al, beta: be, steps: st };
  }

  /* ---------------- Statistik und Messwerte ---------------- */
  /* "25,02 24,98; 25,01" -> [25.02, 24.98, 25.01]; bei ungültigem Eintrag null (Trennung durch Leerzeichen, Semikolon, Zeilenumbruch) */
  function parseList(s) {
    const parts = String(s == null ? '' : s).split(/[;\s]+/).filter(Boolean), r = parts.map(parseDe); return r.length && r.every(fin) ? r : null;
  }
  const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
  const median = a => { const b = a.slice().sort((x, y) => x - y), n = b.length, m = n >> 1; return n % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
  const range = a => Math.max(...a) - Math.min(...a);
  /* Standardabweichung der Stichprobe (n − 1); bei n < 2 null */
  const stdev = a => { if (a.length < 2) return null; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1)); };
  function stats(a, dec) {
    if (!Array.isArray(a) || !a.length || !a.every(fin)) return null; dec = dec == null ? 3 : dec; const n = a.length, sum = rs(a.reduce((s, x) => s + x, 0)), m = rs(mean(a)), b = a.slice().sort((x, y) => x - y), sd = stdev(a);
    const steps = [`Anzahl n = ${n}`, `Mittelwert x̄ = Summe / n = ${fmt(sum)} / ${n} = ${fmt(m, dec + 2)}`, `Sortiert: ${b.map(x => fmt(x)).join('; ')}`, `Median (mittlerer Wert${n % 2 ? '' : ', Mittel der zwei mittleren'}) = ${fmt(rs(median(a)), dec + 2)}`, `Spannweite R = größter − kleinster Wert = ${fmt(b[n - 1])} − ${fmt(b[0])} = ${fmt(rs(range(a)), dec + 2)}`];
    if (sd == null) steps.push('Standardabweichung: nicht definiert (mindestens 2 Werte nötig).');
    else steps.push(`Abweichungen vom Mittelwert quadrieren und addieren: Σ(x − x̄)² = ${fmt(rs(a.reduce((s, x) => s + (x - m) * (x - m), 0)), dec + 4)}`, `s = √( Σ(x − x̄)² / (n − 1) ) = √( ${fmt(rs(a.reduce((s, x) => s + (x - m) * (x - m), 0)), dec + 4)} / ${n - 1} ) = ${fmt(rs(sd), dec + 2)}`);
    return { n, sum, mean: m, median: rs(median(a)), range: rs(range(a)), stdev: sd == null ? null : rs(sd), steps };
  }
  /* Fehlerfortpflanzung als Faustregel in Prozent: bei Produkt und Quotient addieren sich die relativen Fehler, bei Potenz mal Exponent */
  function fehlerFaust(kind, errs, n) {
    if (!Array.isArray(errs) || !errs.every(fin)) return null;
    if (kind === 'pot') return fin(n) && errs.length === 1 ? rs(Math.abs(n) * errs[0]) : null;
    if (kind === 'mul' || kind === 'div') return rs(errs.reduce((s, e) => s + Math.abs(e), 0));
    return null;
  }

  /* Antwort prüfen: Zahl mit Toleranz */
  function check(ans, value, tol) { const v = parseDe(ans); if (!fin(v)) return { empty: true, ok: false, v }; return { ok: Math.abs(v - value) <= tol + 1e-9, v }; }

  const api = {
    fin, rs, rd, sup, parseDe, fmt, fmtDe, roundSig, sigDigits, hashStr, rng, ri, pick, shuffle,
    PREFIX, sci, fmtSci, eng, FAM, unitInfo, convert, dreisatz, teilung, massstab, proz,
    evalExpr, idsOf, pretty, subst, calcLine, FORMELN, formel, umformung, solveFor, checkUmformung,
    SHAPES, unitPow, geo, masse, sinD, cosD, tanD, asinD, acosD, atanD, pyth, solveTri,
    parseList, mean, median, range, stdev, stats, fehlerFaust, check
  };
  root.MAT_CORE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
