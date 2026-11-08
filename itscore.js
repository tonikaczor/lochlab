'use strict';
/* Tonfunk IT-Sicherheits-Lab (Fachinformatiker): reine Logik ohne Oberfläche, auch per Node testbar.
   Inhalt: Passwörter (Zeichenvorrat, Entropie, Brute-Force-Zeit), Verschlüsselung von Hand (Caesar, Vigenère, XOR),
   Schlüsselanzahl, Rechte (Unix-Oktalschreibweise), Firewall-Regeln (erste passende Regel gilt), Backup (Voll/Inkrementell/Differentiell,
   Wiederherstellung), Verfügbarkeit (Ausfallzeit, Reihen- und Parallelschaltung), Antwortprüfung für alle Aufgabenarten.
   Alles ist reine Schutz-Sicht: nur Rechnen, Lesen und Bewerten, keine Angriffswerkzeuge.
   Jede Rechnung liefert den Lösungsweg als Liste von Textzeilen (steps).
   Export: window.ITS_CORE bzw. module.exports (Node). */
(function (root) {
  const fin = v => typeof v === 'number' && isFinite(v);
  const rs = v => fin(v) ? parseFloat(v.toPrecision(12)) : v;               /* 12 gültige Stellen: Gleitkomma-Rauschen weg */
  /* kaufmännisch runden (0,5 rundet auf), d = Nachkommastellen */
  function rd(v, d) { if (!fin(v)) return v; const f = Math.pow(10, d || 0); return rs(Math.sign(v) * Math.round(parseFloat((Math.abs(v) * f).toPrecision(15))) / f); }
  const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
  const sup = n => String(n).replace(/[0-9-]/g, c => SUP[c]);

  /* ---------------- Zahlen deutsch ---------------- */
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NaN;
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/[A-Za-zµΩ°€%‰²³\/]+$/, '').replace(',', '.');
    if (!/^[+\-−]?\d+(\.\d+)?$|^[+\-−]?\.\d+$/.test(s)) return NaN;
    return parseFloat(s.replace('−', '-'));
  }
  function fmt(v, md) {
    if (!fin(v)) return '–';
    md = md == null ? 6 : md;
    let s = rd(v, md).toFixed(md); if (md > 0) s = s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
    if (/^-0$/.test(s)) s = '0';
    return s.replace('-', '−').replace('.', ',');
  }
  function fmtDe(v, dec) {
    if (!fin(v)) return '–';
    let s = rd(v, dec).toFixed(dec); if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
    return s.replace('-', '−').replace('.', ',');
  }
  /* große Zahlen lesbar: 208 827 064 576 ; ab 10^15 als m · 10ⁿ */
  const group = v => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  function fmtBig(v) {
    if (!fin(v)) return '–'; const a = Math.abs(v);
    if (a >= 1e15) { const e = Math.floor(Math.log10(a)); let m = rs(v / Math.pow(10, e)); if (Math.abs(m) >= 10) { m = rs(m / 10); } return fmt(rd(m, 2), 2) + ' · 10' + sup(Math.abs(m) >= 10 ? e + 1 : e); }
    return Number.isInteger(v) ? group(v) : fmt(v, 2);
  }

  /* ---------------- Zufall (seed-fähig, wie im Rechen-Lab) ---------------- */
  function hashStr(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    let a = (typeof seed === 'number' ? seed >>> 0 : hashStr(seed)) || 1;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const ri = (R, a, b) => a + Math.floor(R() * (b - a + 1));
  const pick = (R, a) => a[Math.floor(R() * a.length)];
  const shuffle = (R, a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };

  /* ---------------- Passwörter ---------------- */
  /* Zeichengruppen; Anzahl der Sonderzeichen: 32 druckbare ASCII-Sonderzeichen (ohne Leerzeichen, ohne Umlaute und ß) */
  const CHARSETS = [
    { k: 'klein', name: 'Kleinbuchstaben a bis z', n: 26 },
    { k: 'gross', name: 'Großbuchstaben A bis Z', n: 26 },
    { k: 'ziff', name: 'Ziffern 0 bis 9', n: 10 },
    { k: 'sonder', name: 'Sonderzeichen (32 verschiedene)', n: 32 }   /* PRUEFEN: Sonderzeichen als 32 gezählt (ASCII ohne Leerzeichen). Mancher Unterricht rechnet mit 33 (mit Leerzeichen) oder 30. Welche Zahl gilt bei euch? */
  ];
  function poolSize(keys) { return CHARSETS.filter(c => keys.indexOf(c.k) >= 0).reduce((s, c) => s + c.n, 0); }
  function combos(N, L) { let r = 1; for (let i = 0; i < L; i++) r *= N; return r; }
  /* Entropie H = L · log2(N) bei zufälliger Wahl jeder Stelle (gleichverteilt) */
  function entropy(N, L) {
    if (!(N >= 2) || !(L >= 1) || !fin(N) || !fin(L)) return null;
    const per = Math.log2(N), bits = rs(L * per), c = combos(N, L);
    return { bits, perChar: per, combos: c, steps: [`Zeichenvorrat N = ${fmt(N)}, Länge L = ${fmt(L)}`, `Mögliche Passwörter: N^L = ${fmt(N)}^${fmt(L)} = ${fmtBig(c)}`, `Entropie H = L · log₂(N) = ${fmt(L)} · log₂(${fmt(N)}) = ${fmt(L)} · ${fmt(rd(per, 3), 3)} = ${fmt(rd(bits, 2), 2)} Bit`] };
  }
  /* Passphrase: k Wörter aus einer Liste mit W Wörtern */
  function passphrase(W, k) {
    if (!(W >= 2) || !(k >= 1)) return null;
    const per = Math.log2(W), bits = rs(k * per);
    return { bits, perWord: per, steps: [`Wortliste W = ${fmt(W)} Wörter, k = ${fmt(k)} Wörter`, `Entropie je Wort: log₂(${fmt(W)}) = ${fmt(rd(per, 3), 3)} Bit`, `Gesamt: H = k · log₂(W) = ${fmt(k)} · ${fmt(rd(per, 3), 3)} = ${fmt(rd(bits, 2), 2)} Bit`] };
  }
  const TU = [['Sekunde', 'Sekunden', 1], ['Minute', 'Minuten', 60], ['Stunde', 'Stunden', 3600], ['Tag', 'Tage', 86400], ['Jahr', 'Jahre', 31536000]];  /* 1 Jahr = 365 Tage */
  /* Sekunden -> "2,5 Jahre" (größte passende Einheit) */
  function humanTime(s) {
    if (!fin(s) || s < 0) return '–'; if (s < 1) return 'weniger als 1 Sekunde';
    let u = TU[0]; for (const x of TU) if (s >= x[2]) u = x;
    const v = s / u[2], r = v >= 100 ? Math.round(v) : rd(v, 1), t = r >= 100 ? fmtBig(r) : fmt(r, 1);
    return t + ' ' + (r === 1 ? u[0] : u[1]);
  }
  /* Brute-Force bei bekannter Rate: Höchstdauer = alle Möglichkeiten, im Mittel die Hälfte */
  function brute(N, L, rate) {
    if (!(N >= 2) || !(L >= 1) || !(rate > 0)) return null;
    const c = combos(N, L), sec = c / rate;
    return { combos: c, seconds: sec, avgSeconds: sec / 2, steps: [`Mögliche Passwörter: N^L = ${fmt(N)}^${fmt(L)} = ${fmtBig(c)}`, `Höchstdauer = Möglichkeiten / Rate = ${fmtBig(c)} / ${fmtBig(rate)} pro Sekunde = ${fmtBig(rs(sec))} s`, `Das sind etwa ${humanTime(sec)} (im Mittel findet man das Passwort nach der Hälfte: ${humanTime(sec / 2)}).`] };   /* PRUEFEN: Aufgaben fragen nach der Höchstdauer (alle Möglichkeiten). Reicht das, oder soll die mittlere Dauer (halber Suchraum) gerechnet werden? */
  }

  /* ---------------- Verschlüsselung von Hand ---------------- */
  /* nur Buchstaben A-Z / a-z werden verschoben, alles andere bleibt (Umlaute und ß sind nicht vorgesehen) */
  function shiftCh(ch, k) {
    const c = ch.charCodeAt(0);
    if (c >= 65 && c <= 90) return String.fromCharCode((c - 65 + (k % 26) + 26) % 26 + 65);
    if (c >= 97 && c <= 122) return String.fromCharCode((c - 97 + (k % 26) + 26) % 26 + 97);
    return ch;
  }
  /* k > 0 verschlüsselt, k < 0 entschlüsselt */
  const caesar = (t, k) => Array.from(String(t == null ? '' : t)).map(ch => shiftCh(ch, k)).join('');
  function caesarSteps(text, k, decrypt) {
    const sh = decrypt ? -k : k, letters = Array.from(String(text)).filter(ch => /[A-Za-z]/.test(ch));
    return [`Schlüssel k = ${k}: ${decrypt ? 'jeder Buchstabe wird um ' + k + ' Stellen im Alphabet zurückgeschoben (vor A folgt Z).' : 'jeder Buchstabe wird um ' + k + ' Stellen im Alphabet weitergeschoben (nach Z folgt A).'}`, letters.map(ch => ch + ' → ' + shiftCh(ch, sh)).join(',  '), `Ergebnis: ${caesar(text, sh)}`];
  }
  const keyShifts = key => Array.from(String(key || '').toUpperCase()).filter(ch => ch >= 'A' && ch <= 'Z').map(ch => ch.charCodeAt(0) - 65);
  /* dir = 1 verschlüsseln, -1 entschlüsseln; das Schlüsselwort wird wiederholt, nur Buchstaben verbrauchen Schlüsselstellen */
  function vigenere(t, key, dir) {
    const ks = keyShifts(key); if (!ks.length) return null; dir = dir === -1 ? -1 : 1; let i = 0;
    return Array.from(String(t == null ? '' : t)).map(ch => /[A-Za-z]/.test(ch) ? shiftCh(ch, dir * ks[i++ % ks.length]) : ch).join('');   /* PRUEFEN: Leerzeichen und Satzzeichen verbrauchen keine Schlüsselstelle (übliche Konvention); die Aufgaben nutzen nur einzelne Wörter */
  }
  function vigenereSteps(text, key, decrypt) {
    const ks = keyShifts(key), up = String(text).toUpperCase().replace(/[^A-Z]/g, ''), rows = [];
    for (let i = 0; i < up.length; i++) { const kk = ks[i % ks.length]; rows.push(`${up[i]} ${decrypt ? '−' : '+'} ${String.fromCharCode(65 + kk)}(${kk}) = ${shiftCh(up[i], decrypt ? -kk : kk)}`); }
    return [`Alphabet: A = 0, B = 1, ... Z = 25. Das Schlüsselwort ${String(key).toUpperCase()} wird wiederholt: ${Array.from(up).map((_, i) => String.fromCharCode(65 + ks[i % ks.length])).join(' ')}`, rows.join(',  '), `Ergebnis: ${vigenere(text, key, decrypt ? -1 : 1)}`];
  }
  /* Bitfolgen als Text aus 0 und 1 (Leerzeichen erlaubt) */
  const cleanBin = s => String(s == null ? '' : s).replace(/[\s_]/g, '');
  const isBin = s => /^[01]+$/.test(cleanBin(s));
  function xorBin(a, b) {
    a = cleanBin(a); b = cleanBin(b); if (!/^[01]+$/.test(a) || !/^[01]+$/.test(b) || a.length !== b.length) return null;
    let r = ''; for (let i = 0; i < a.length; i++) r += a[i] === b[i] ? '0' : '1'; return r;
  }
  const toBin = (n, w) => { let s = (n >>> 0).toString(2); while (s.length < (w || 8)) s = '0' + s; return s; };
  function xorSteps(a, b) {
    const r = xorBin(a, b); if (r == null) return null; a = cleanBin(a); b = cleanBin(b);
    return { result: r, steps: ['Regel: gleiche Bits ergeben 0, verschiedene Bits ergeben 1 (0⊕0 = 0, 0⊕1 = 1, 1⊕0 = 1, 1⊕1 = 0).', `  ${a}\n⊕ ${b}\n= ${r}`] };
  }
  /* Schlüsselanzahl: symmetrisch paarweise n(n-1)/2, asymmetrisch 2n (je ein Schlüsselpaar) */
  const symKeys = n => n * (n - 1) / 2;
  const asymKeys = n => 2 * n;

  /* ---------------- Rechte (Unix) ---------------- */
  const PERM_RE = /^[r-][w-][x-][r-][w-][x-][r-][w-][x-]$/;
  function permToOctal(s) {
    s = String(s == null ? '' : s).trim(); if (!PERM_RE.test(s)) return null;
    const d = [0, 3, 6].map(i => (s[i] === 'r' ? 4 : 0) + (s[i + 1] === 'w' ? 2 : 0) + (s[i + 2] === 'x' ? 1 : 0));
    return { digits: d, octal: d.join(''), value: parseInt(d.join(''), 10), steps: ['r = 4, w = 2, x = 1, kein Recht (−) = 0. Je Dreiergruppe (Besitzer, Gruppe, Andere) addieren:'].concat(['Besitzer', 'Gruppe', 'Andere'].map((n, i) => `${n}: ${s.substr(i * 3, 3)} = ${[4, 2, 1].map((w, j) => s[i * 3 + j] !== '-' ? w : null).filter(x => x != null).join(' + ') || '0'} = ${d[i]}`), [`Oktal: ${d.join('')}`]) };
  }
  function octalToPerm(o) {
    o = String(o == null ? '' : o).trim(); if (!/^[0-7]{3}$/.test(o)) return null;
    const p = Array.from(o).map(c => { const n = +c; return (n & 4 ? 'r' : '-') + (n & 2 ? 'w' : '-') + (n & 1 ? 'x' : '-'); }).join('');
    return { perm: p, steps: Array.from(o).map((c, i) => `${['Besitzer', 'Gruppe', 'Andere'][i]}: ${c} = ${p.substr(i * 3, 3)}`) };
  }

  /* ---------------- Firewall ---------------- */
  function ipInt(ip) {
    const p = String(ip == null ? '' : ip).trim().split('.'); if (p.length !== 4) return null; let n = 0;
    for (const x of p) { if (!/^\d{1,3}$/.test(x) || +x > 255) return null; n = n * 256 + (+x); } return n;
  }
  /* spec: '*' (alle), 'a.b.c.d' oder 'a.b.c.d/länge' */
  function inNet(ip, spec) {
    if (spec == null || spec === '*') return true;
    const parts = String(spec).split('/'), a = ipInt(ip), b = ipInt(parts[0]); if (a == null || b == null) return false;
    const l = parts.length > 1 ? +parts[1] : 32; if (!(l >= 0 && l <= 32)) return false; if (l === 0) return true;
    const size = Math.pow(2, 32 - l); return Math.floor(a / size) === Math.floor(b / size);
  }
  /* Regel: { action:'allow'|'deny', proto:'tcp'|'udp'|'*', src, dst, port:Zahl|'*' }  Paket: { proto, src, dst, port } (Zielport) */
  function ruleHit(r, p) { return (r.proto === '*' || r.proto === p.proto) && inNet(p.src, r.src) && inNet(p.dst, r.dst) && (r.port === '*' || r.port === p.port); }
  /* erste passende Regel entscheidet; ohne Treffer gilt die Standardaktion (hier: blocken) */
  function fwEval(rules, p, def) {   /* PRUEFEN: Reihenfolge "erste passende Regel gilt" und Standard "alles Übrige wird blockiert" (Default-Deny) so vorgegeben; echte Firewalls (z. B. iptables, Windows-Firewall) unterscheiden sich im Detail */
    for (let i = 0; i < rules.length; i++) if (ruleHit(rules[i], p)) return { action: rules[i].action, idx: i };
    return { action: def || 'deny', idx: -1 };
  }
  const fwRuleText = r => `${r.action === 'allow' ? 'erlauben' : 'blocken'}  ${r.proto === '*' ? 'alle Protokolle' : r.proto.toUpperCase()}  von ${r.src === '*' ? 'überall' : r.src}  nach ${r.dst === '*' ? 'überall' : r.dst}  Port ${r.port === '*' ? 'alle' : r.port}`;
  const pktText = p => `${p.proto.toUpperCase()} von ${p.src} nach ${p.dst}:${p.port}`;
  function fwStep(rules, p, i) {
    const e = fwEval(rules, p); return `Paket ${i + 1} (${pktText(p)}): ${e.idx >= 0 ? 'erste passende Regel ist Nr. ' + (e.idx + 1) + ' → ' + (e.action === 'allow' ? 'erlauben' : 'blocken') : 'keine Regel passt → Standard: blocken'}`;
  }

  /* ---------------- Backup ---------------- */
  /* Voll-Sicherung F (GB) und täglich neue Änderungen changes[i] (GB) an den Folgetagen.
     inkrementell: jede Sicherung enthält nur die Änderungen seit der letzten Sicherung.
     differentiell: jede Sicherung enthält alle Änderungen seit der Vollsicherung (wächst täglich). */
  function backupPlan(type, F, changes) {   /* PRUEFEN: vereinfachtes Modell: jeder Tag ändert NEUE Daten (nichts wird zweimal geändert), Änderungen in GB */
    if (!(type === 'inc' || type === 'diff') || !fin(F) || !Array.isArray(changes) || !changes.every(fin)) return null;
    const sizes = [F]; let cum = 0;
    changes.forEach(c => { cum += c; sizes.push(type === 'inc' ? c : cum); });
    const total = rs(sizes.reduce((s, x) => s + x, 0));
    return { sizes: sizes.map(rs), total, steps: [`Vollsicherung: ${fmt(F)} GB`].concat(sizes.slice(1).map((s, i) => `Tag ${i + 1}: ${type === 'inc' ? 'nur die Änderungen dieses Tages' : 'alle Änderungen seit der Vollsicherung'} = ${fmt(rs(s))} GB`), [`Summe: ${sizes.map(x => fmt(rs(x))).join(' + ')} = ${fmt(total)} GB`]) };
  }
  /* Sicherungssätze für die Wiederherstellung am n-ten Tag nach der Vollsicherung (n >= 0) */
  function restoreSets(type, n) {
    if (!(n >= 0) || !(type === 'full' || type === 'inc' || type === 'diff')) return null;
    if (type === 'full' || n === 0) return 1; return type === 'inc' ? n + 1 : 2;
  }
  /* Rückspielzeit in Minuten: 1 GB = 1000 MB */
  const restoreMinutes = (gb, mbs) => (gb > 0 && mbs > 0) ? gb * 1000 / mbs / 60 : null;   /* PRUEFEN: 1 GB = 1000 MB gerechnet (nicht 1024). Passt das zum Unterricht? */
  /* Datenverlust in Stunden: letzte Sicherung zur Uhrzeit a, Ausfall zur Uhrzeit b (gleicher oder nächster Tag) */
  const lossHours = (a, b) => ((b - a) % 24 + 24) % 24;
  /* 3-2-1-Regel: mindestens 3 Kopien (Original zählt mit), 2 verschiedene Medien, 1 Kopie an einem anderen Ort */
  const check321 = o => !!o && o.copies >= 3 && o.media >= 2 && o.offsite >= 1;   /* PRUEFEN: Original wird als eine der 3 Kopien gezählt (3 Datensätze insgesamt). Andere Quellen zählen "3 Backups zusätzlich zum Original". Was gilt in der Berufsschule? */

  /* ---------------- Verfügbarkeit ---------------- */
  const HOURS_YEAR = 8760;   /* PRUEFEN: 1 Jahr = 365 Tage = 8760 Stunden (kein Schaltjahr, kein 365,25) */
  const downHours = pct => (1 - pct / 100) * HOURS_YEAR;
  const availFromDown = (h, per) => (1 - h / (per || HOURS_YEAR)) * 100;
  /* in Reihe: alle müssen laufen -> Produkt; parallel (redundant): nur ausfallen, wenn alle ausfallen. Eingabe und Ausgabe in Prozent */
  const serial = a => a.reduce((p, x) => p * x / 100, 100);
  const parallel = a => 100 * (1 - a.reduce((p, x) => p * (1 - x / 100), 1));

  /* ---------------- Antworten prüfen (alle Aufgabenarten) ---------------- */
  /* Text vergleichen: Großschreibung, Leer- und Satzzeichen egal */
  const norm = s => String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, '');
  /* leere Antwort passend zur Art: num/text '', choice null, multi [], rows Liste mit null */
  function emptyAns(p) {
    if (p.kind === 'choice') return null; if (p.kind === 'multi') return []; if (p.kind === 'rows') return p.rows.map(() => null); return '';
  }
  function checkAnswer(p, ans) {
    const k = p.kind || 'num';
    if (k === 'num') { const v = parseDe(ans); if (!fin(v)) return { empty: true, ok: false, v }; return { ok: Math.abs(v - p.value) <= p.tol + 1e-9, v }; }
    if (k === 'text') { const n = norm(ans); if (!n) return { empty: true, ok: false }; return { ok: p.accept.some(a => norm(a) === n), v: ans }; }
    if (k === 'choice') { if (ans == null || ans === '') return { empty: true, ok: false }; return { ok: +ans === p.correct }; }
    if (k === 'multi') {
      if (!Array.isArray(ans) || !ans.length) return { empty: true, ok: false };
      const sel = ans.map(Number), wrong = sel.filter(i => p.correct.indexOf(i) < 0), missed = p.correct.filter(i => sel.indexOf(i) < 0);
      return { ok: !wrong.length && !missed.length, wrong, missed, detail: `${wrong.length} falsch markiert, ${missed.length} übersehen` };
    }
    if (k === 'rows') {
      if (!Array.isArray(ans) || ans.length !== p.rows.length || ans.some(x => x == null || x === '')) return { empty: true, ok: false };
      const good = p.rows.filter((r, i) => +ans[i] === r.correct).length;
      return { ok: good === p.rows.length, good, detail: `${good} von ${p.rows.length} Zeilen richtig` };
    }
    return { empty: true, ok: false };
  }

  const api = {
    fin, rs, rd, sup, parseDe, fmt, fmtDe, fmtBig, group, hashStr, rng, ri, pick, shuffle,
    CHARSETS, poolSize, combos, entropy, passphrase, humanTime, brute,
    shiftCh, caesar, caesarSteps, vigenere, vigenereSteps, keyShifts, cleanBin, isBin, xorBin, xorSteps, toBin, symKeys, asymKeys,
    permToOctal, octalToPerm, ipInt, inNet, ruleHit, fwEval, fwRuleText, pktText, fwStep,
    backupPlan, restoreSets, restoreMinutes, lossHours, check321,
    HOURS_YEAR, downHours, availFromDown, serial, parallel,
    norm, emptyAns, checkAnswer
  };
  root.ITS_CORE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
