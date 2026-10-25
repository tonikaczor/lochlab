'use strict';
/* Tonfunk Analogtechnik-Lab (ANA-Lab): Tab "Messreihe" (WP3b, SPEC 6.4).
   Formular aus ANA_CORE.report.template (Name, Datum, Schaltung, Bauteilwerte, Quelle, Messreihe, Auswertung, Ergebnis). "Messreihe aufnehmen" holt die Tabelle (x, Messwert) über
   ANA_CORE.report.generate aus dem Zustand des Prüfstands (alle acht Anlagen; liefert der Kern für die Einstellung keine Messreihe, zum Beispiel idealer Operationsverstärker oder
   Rechteckgenerator, steht sein Text als ruhiger Hinweis da, kein Fehler). Die Kennwerte (I_C, U_CE, V_u, f_g, U_o, U_u, …) und das Ergebnis trägt der Azubi selbst ein.
   Erst "Bericht kontrollieren" ruft ANA_CORE.report.check und zeigt jede Abweichung mit dem Text des Kerns direkt am Feld.
   Hier steht KEINE zweite Prüflogik (SPEC Regel 7): Konsistenz, Toleranzen und Texte kommen aus report.check. Die Geisterlinie der Rechnung (erst nach der Kontrolle) ist die Referenzreihe
   aus report.generate mit demselben Zustand und Startwert (Rauschen höchstens 1 %); es wird nichts selbst gerechnet.
   Das Diagramm zeigt die eigenen Messpunkte; CSV: ANA_CORE.report.csv/parseCsv (Roundtrip, Regel 8); Druck/PDF über #printArea.
   Verlauf der letzten 20 Berichte in ana.report (Zähler anareport = abgelegte, stimmige Berichte). Der laufende Bericht steht in S.bericht (api.getBericht/setBericht) und reist mit Speichern,
   Teilen und Abgabe. Hinweis in jeder Ansicht: "Übungsbericht, kein Nachweis." Alle Bauteilwerte sind Übungswerte.
   Schnittstelle (VERTRAG 6.5): window.ANA_UI_EXT.report = { render(host, api), refresh(), redraw(), fn }. Reine Funktionen unter fn (test_anaui_ext.js). */
(function (root) {
  const E = root.ANA_UI_EXT = root.ANA_UI_EXT || {};
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fin = v => typeof v === 'number' && isFinite(v);
  const once = (host, name, ty, fn) => { host.__anarp = host.__anarp || {}; if (host.__anarp[name + ty]) return; host.__anarp[name + ty] = 1; host.addEventListener(ty, fn); };
  const CORE = () => (A && A.ANA_CORE) || root.ANA_CORE;
  const KEY = 'ana.report', MAXH = 20, MAXROWS = 200;
  const NOCORE = 'Der Rechenkern ist nicht geladen (anacore.js, anacore-op.js und anacore-res.js fehlen). Ohne ihn gibt es hier keine Messreihe.';
  const hintText = () => { const C = CORE(); return C && C.TEXTS && typeof C.TEXTS.protoHinweis === 'string' ? C.TEXTS.protoHinweis : 'Übungsbericht, kein Nachweis.'; };
  /* Namen und Einheiten der Felder (nur Beschriftung; welche Felder gelten, entscheidet der Bericht selbst) */
  const FIELD = {
    r1: ['Widerstand R_1', 'Ω'], r2: ['Widerstand R_2', 'Ω'], r3: ['Widerstand R_3', 'Ω'], r4: ['Widerstand R_4', 'Ω'], rc: ['Kollektorwiderstand R_C', 'Ω'], re1: ['Emitterwiderstand R_E1', 'Ω'], re2: ['Emitterwiderstand R_E2', 'Ω'],
    rb: ['Basisvorwiderstand R_B', 'Ω'], rv: ['Vorwiderstand R_V', 'Ω'], rf: ['Rückkopplungswiderstand R_f', 'Ω'], rg: ['Widerstand R_g', 'Ω'], rl: ['Lastwiderstand R_L', 'Ω'], rlast: ['Lastwiderstand R_L', 'Ω'], rspule: ['Spulenwiderstand', 'Ω'], rt: ['Widerstand R_T', 'Ω'], rs: ['Widerstand R_S', 'Ω'],
    c: ['Kapazität C', 'F'], ce: ['Emitterkondensator C_E', 'F'], c1: ['Koppelkondensator C_1', 'F'], c2: ['Koppelkondensator C_2', 'F'], lspule: ['Spuleninduktivität', 'H'],
    uz: ['Z-Spannung U_Z', 'V'], uf: ['Flussspannung U_F', 'V'], ud: ['Diodenspannung U_D', 'V'], ub: ['Betriebsspannung U_B', 'V'], ust: ['Steuerspannung U_St', 'V'], uq: ['Quellenspannung U_q', 'V'], ue: ['Eingangsspannung U_e', 'V'], uv: ['Versorgung U_V', 'V'],
    uref: ['Referenzspannung U_ref', 'V'], ue2: ['Eingangsspannung U_e2', 'V'], ue3: ['Eingangsspannung U_e3', 'V'], u1: ['Spannung U_1', 'V'], u2: ['Spannung U_2', 'V'], b: ['Stromverstärkung B', ''], f: ['Frequenz f', 'Hz'], temp: ['Temperatur', '°C'], iz: ['Strom I_Z', 'A'], ic: ['Kollektorstrom I_C', 'A'], nd: ['Anzahl Dioden', '']
  };
  /* Auswertungsfelder je Prüfstand (Kennwerte, die der Azubi einträgt); die Namen entsprechen den Schlüsseln von report.generate(...).ref.ausw */
  const AW = { ud: ['Spannung am Bauteil U_D', 'V'], id: ['Strom I', 'A'], ic: ['Kollektorstrom I_C', 'A'], uce: ['Kollektor-Emitter-Spannung U_CE', 'V'], vu: ['Spannungsverstärkung V_u', ''], rout: ['Ausgangswiderstand r_aus', 'Ω'], v: ['Spannungsverstärkung V_u', ''], fg: ['Grenzfrequenz f_g', 'Hz'], uo: ['obere Schaltschwelle U_o', 'V'], uu: ['untere Schaltschwelle U_u', 'V'] };
  const AUSW = { diode: ['ud', 'id'], schalter: ['ic', 'uce'], emitter: ['ic', 'uce', 'vu'], folger: ['vu', 'rout'], opv_inv: ['v', 'fg'], opv_nin: ['v', 'fg'], opv_komp: ['uo', 'uu'], opv_aktiv: ['fg'] };

  /* ============================================================ reine Funktionen (ohne DOM) */
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  const str = (v, n) => { const s = v === undefined || v === null ? '' : String(v); return s.length > (n || 200) ? s.slice(0, n || 200) : s; };
  const val = v => (fin(v) ? v : typeof v === 'string' ? str(v) : undefined);
  const cleanMap = (o, max) => { const r = {}; if (!isObj(o)) return r; Object.keys(o).slice(0, max || 30).forEach(k => { const v = val(o[k]); if (v !== undefined && /^[A-Za-z0-9_]{1,20}$/.test(k)) r[k] = v; }); return r; };
  function blank(o) { o = o || {}; return { rigId: '', name: o.name ? str(o.name, 80) : '', datum: o.datum !== undefined ? str(o.datum, 20) : today(), schaltung: '', bauteile: {}, quelle: {}, spalten: [], messreihe: [], rows: [], auswertung: {}, ergebnis: '', seed: 0, zustand: null, hinweis: '' }; }
  /* Bericht bereinigen (aus Speicher, Link oder CSV): bekannte Felder, Texte als Text, Zahlen nur endlich, Zeilen begrenzt; messreihe und rows bleiben gleich */
  function norm(x) {
    const o = isObj(x) ? x : {}, e = blank({ datum: '' });
    e.rigId = str(o.rigId, 20); e.name = str(o.name, 80); e.datum = str(o.datum, 20); e.schaltung = str(o.schaltung, 120); e.ergebnis = str(o.ergebnis, 1000); e.hinweis = str(o.hinweis, 200);
    e.bauteile = cleanMap(o.bauteile); e.quelle = cleanMap(o.quelle); e.auswertung = cleanMap(o.auswertung);
    e.spalten = (Array.isArray(o.spalten) ? o.spalten : []).slice(0, 8).filter(isObj).map(c => ({ key: str(c.key, 20), label: str(c.label || c.key, 80), unit: str(c.unit, 12) })).filter(c => c.key);
    const src = Array.isArray(o.messreihe) ? o.messreihe : (Array.isArray(o.rows) ? o.rows : []);
    e.messreihe = src.slice(0, MAXROWS).map(r => cleanMap(r, 8)); e.rows = e.messreihe.map(r => Object.assign({}, r));
    if (!e.spalten.length && e.messreihe.length) e.spalten = Object.keys(e.messreihe[0]).map(k => ({ key: k, label: k, unit: '' }));
    e.seed = fin(+o.seed) && +o.seed >= 0 ? Math.floor(+o.seed) : 0;
    e.zustand = isObj(o.zustand) ? (() => { const z = {}; Object.keys(o.zustand).slice(0, 40).forEach(k => { const v = o.zustand[k]; if (fin(v) || typeof v === 'string' || typeof v === 'boolean') z[k] = typeof v === 'string' ? str(v, 60) : v; }); return z; })() : null;
    return e;
  }
  const isEmpty = e => { const n = norm(e); return !n.rigId && !n.name && !n.schaltung && !n.messreihe.length && !n.ergebnis && !Object.keys(n.auswertung).length; };
  const parseNum = s => { if (typeof s === 'number') return s; const C = CORE(); if (C && typeof C.parseNum === 'function') { try { const v = C.parseNum(s); return fin(v) ? v : NaN; } catch (e) { return NaN; } } return parseFloat(String(s == null ? '' : s).replace(',', '.')); };
  /* Zahl für die Anzeige: SI-Einheit mit Vorsatz über den Kern (4,7 kΩ), sonst Dezimalkomma */
  function disp(v, unit) {
    if (!fin(v)) return typeof v === 'string' ? v : '';
    const C = CORE(); if (unit && /^(Hz|F|H|Ω|V|A|W|s)$/.test(unit) && C && typeof C.fmtEng === 'function') { try { const t = C.fmtEng(v, unit); if (typeof t === 'string' && t) return t; } catch (e) {} }
    return String(+v.toPrecision(5)).replace('.', ',');
  }
  const cellText = v => (fin(v) ? String(+v.toPrecision(5)).replace('.', ',') : typeof v === 'string' ? v : '');
  /* Messreihe aufnehmen: ausschließlich ANA_CORE.report.generate; Name und Datum bleiben, Auswertung und Ergebnis beginnen neu.
     Rückgabe { ok:true, entry, ref, seed } oder { ok:false, why, none? }; none: der Kern hat für diese Einstellung keine Messreihe (valid:false), kein Fehler */
  function take(e, rigId, state, seedIn) {
    const C = CORE(); if (!C || !C.report || typeof C.report.generate !== 'function') return { ok: false, nocore: true, why: NOCORE };
    const n = norm(e), seed = fin(seedIn) ? seedIn : (n.rigId === rigId && n.seed >= 0 ? n.seed + 1 : 1);
    let g = null; try { g = C.report.generate(String(rigId || ''), state, seed); } catch (er) { g = null; }
    if (!g) return { ok: false, why: 'Die Messreihe konnte nicht aufgenommen werden.' };
    if (g.valid === false) return { ok: false, none: true, why: String(g.why || 'Für diese Einstellung gibt es keine Messreihe.') };
    if (g.ok === false || !g.entry) return { ok: false, why: String(g.why || 'Die Messreihe konnte nicht aufgenommen werden.') };
    const m = norm(Object.assign({}, g.entry, { name: n.name, datum: n.datum || today(), ergebnis: '', auswertung: {} }));
    return { ok: true, entry: m, ref: g.ref || null, seed };
  }
  /* Kontrolle: ausschließlich ANA_CORE.report.check; Antwort mit Punkten (feld, ok, text) und den Abweichungen */
  function checkEntry(e) {
    const C = CORE(); if (!C || !C.report || typeof C.report.check !== 'function') return { ok: false, nocore: true, items: [], abw: [], text: NOCORE };
    const n = norm(e); if (!n.rigId || !n.messreihe.length) return { ok: false, noentry: true, items: [], abw: [], text: 'Zum Kontrollieren fehlt die Messreihe: Nimm sie zuerst am Prüfstand auf.' };
    let r = null; try { r = C.report.check(n, n.zustand ? { rigId: n.rigId, state: n.zustand } : null); } catch (er) { r = null; }
    if (!r || typeof r !== 'object' || r.ok === false || !Array.isArray(r.items)) return { ok: false, items: [], abw: [], text: 'Die Kontrolle ist nicht gelungen' + (r && r.why ? ': ' + r.why : '.'), why: r && r.why };
    const items = r.items.map(x => ({ feld: String(x.feld), ok: !!x.ok, text: String(x.text) }));
    return { ok: !!r.passt, ran: true, items, abw: items.filter(x => !x.ok), text: String(r.text || '') };
  }
  const xCol = n => (n.spalten || []).find(c => c.key === 'x') || { key: 'x', label: 'x', unit: '' };
  const dataCols = n => (n.spalten || []).filter(c => c.key !== 'x');
  /* eigene Messpunkte (x, y) einer Spalte: nur endliche Zahlen (x > 0 nur bei logarithmischer Achse, das entscheidet chartSvg) */
  function points(n, col) {
    return (n.messreihe || []).map(r => [parseNum(r.x), parseNum(r[col])]).filter(p => fin(p[0]) && fin(p[1])).sort((a, b) => a[0] - b[0]);
  }
  /* Geisterlinie der Rechnung (nur nach der Kontrolle): Referenzreihe aus report.generate mit Zustand und Startwert des Berichts */
  function ghostPoints(n, col) {
    const C = CORE(); if (!C || !C.report || typeof C.report.generate !== 'function' || !n || !n.rigId || !n.zustand) return null;
    let g = null; try { g = C.report.generate(n.rigId, n.zustand, n.seed || 1); } catch (e) { g = null; }
    if (!g || g.valid === false || g.ok === false || !Array.isArray(g.rows)) return null;
    const out = g.rows.map(r => [r.x, r[col]]).filter(p => fin(p[0]) && fin(p[1])).sort((a, b) => a[0] - b[0]);
    return out.length >= 2 ? out : null;
  }
  const fv = v => { if (!fin(v)) return '–'; const a = Math.abs(v); if (a === 0) return '0'; const s = a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : a >= 1 ? v.toFixed(2) : v.toPrecision(3); return (s.indexOf('.') >= 0 && s.indexOf('e') < 0 ? s.replace(/0+$/, '').replace(/\.$/, '') : s).replace('.', ','); };
  const niceNum = x => { const e = Math.floor(Math.log10(x)), f = x / Math.pow(10, e); return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * Math.pow(10, e); };
  function range(lo, hi, log) {
    if (!fin(lo) || !fin(hi)) return log ? [1, 10] : [0, 1];
    if (log) { lo = Math.pow(10, Math.floor(Math.log10(lo) + 1e-9)); hi = Math.pow(10, Math.ceil(Math.log10(hi) - 1e-9)); if (hi <= lo) hi = lo * 10; return [lo, hi]; }
    if (lo >= 0 && lo <= 0.35 * hi) lo = 0; if (hi === lo) hi = lo + 1;
    const st = niceNum((hi - lo) / 5); return [Math.floor(lo / st + 1e-9) * st, Math.ceil(hi / st - 1e-9) * st];
  }
  function tickList(lo, hi, log) {
    const o = []; if (log) { for (let e = Math.round(Math.log10(lo)); e <= Math.round(Math.log10(hi)) && o.length < 14; e++) o.push(Math.pow(10, e)); return o; }
    const st = niceNum((hi - lo) / 5); for (let v = Math.ceil(lo / st - 1e-9) * st, k = 0; v <= hi + st * 1e-9 && k < 20; v += st, k++) o.push(+v.toPrecision(12)); return o;
  }
  const cut = (s, n) => (s.length > n ? s.slice(0, Math.max(1, n - 1)) + '…' : s);
  /* Diagramm der eigenen Messpunkte (Kreise), optional Geisterlinie der Rechnung; x logarithmisch, wenn alle x positiv sind und der Bereich über zwei Dekaden geht; y logarithmisch bei großem Bereich */
  function chartSvg(pts, ghost, o) {
    o = o || {}; const w = fin(o.w) ? Math.max(260, Math.min(900, Math.round(o.w))) : 560, h = Math.round(Math.max(240, Math.min(380, w * 0.58))), L = 54, R = 28, T = 10, B = 46, pw = w - L - R, ph = h - T - B;
    const all = (pts || []).concat(ghost || []); if (!all.length) return '';
    const ys = all.map(p => p[1]), xs = all.map(p => p[0]), ymin = Math.min.apply(null, ys), ymax = Math.max.apply(null, ys), xmin = Math.min.apply(null, xs), xmax = Math.max.apply(null, xs);
    const xlog = xmin > 0 && xmax / xmin > 100, ylog = ymin > 0 && ymax / ymin > 30;
    const rx = range(xmin, xmax, xlog), ry = range(ymin, ymax, ylog);
    const fx = v => (xlog ? (Math.log10(v) - Math.log10(rx[0])) / (Math.log10(rx[1]) - Math.log10(rx[0])) : (v - rx[0]) / (rx[1] - rx[0])), fy = v => (ylog ? (Math.log10(v) - Math.log10(ry[0])) / (Math.log10(ry[1]) - Math.log10(ry[0])) : (v - ry[0]) / (ry[1] - ry[0]));
    const px = v => L + fx(v) * pw, py = v => T + (1 - fy(v)) * ph;
    const s = ['<defs><clipPath id="anaRpClip"><rect x="' + L + '" y="' + T + '" width="' + pw + '" height="' + ph + '"/></clipPath></defs><rect class="ana-rp-bg" x="' + L + '" y="' + T + '" width="' + pw + '" height="' + ph + '"/>'];
    tickList(rx[0], rx[1], xlog).forEach(v => { const x = px(v); s.push('<line class="ana-rp-gr" x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + T + '" y2="' + (T + ph) + '"/><text class="ana-rp-tx" x="' + x.toFixed(1) + '" y="' + (T + ph + 16) + '" text-anchor="middle">' + fv(v) + '</text>'); });
    tickList(ry[0], ry[1], ylog).forEach(v => { const y = py(v); s.push('<line class="ana-rp-gr" x1="' + L + '" x2="' + (L + pw) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '"/><text class="ana-rp-tx" x="' + (L - 5) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end">' + fv(v) + '</text>'); });
    s.push('<rect class="ana-rp-fr" x="' + L + '" y="' + T + '" width="' + pw + '" height="' + ph + '"/>');
    s.push('<text class="ana-rp-ti" x="' + (L + pw / 2) + '" y="' + (h - 6) + '" text-anchor="middle">' + esc(cut((o.xLabel || 'x') + (o.xUnit ? ' in ' + o.xUnit : '') + (xlog ? ' (log.)' : ''), Math.floor(pw / 7))) + '</text>');
    s.push('<text class="ana-rp-ti" transform="translate(13 ' + (T + ph / 2) + ') rotate(-90)" text-anchor="middle">' + esc(cut((o.yLabel || 'Messwert') + (o.yUnit ? ' in ' + o.yUnit : '') + (ylog ? ' (log.)' : ''), Math.floor(ph / 7))) + '</text>');
    s.push('<g clip-path="url(#anaRpClip)">');
    if (ghost && ghost.length > 1) s.push('<path class="ana-rp-gh" d="' + ghost.map((p, i) => (i ? 'L' : 'M') + px(p[0]).toFixed(1) + ' ' + py(p[1]).toFixed(1)).join('') + '"/>');
    (pts || []).forEach(p => s.push('<circle class="ana-rp-pt" cx="' + px(p[0]).toFixed(1) + '" cy="' + py(p[1]).toFixed(1) + '" r="4"/>'));
    s.push('</g>');
    return '<svg class="ana-rp-svg" id="anaRpSvg" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + esc('Diagramm deiner Messpunkte: ' + (o.yLabel || 'Messwert') + ' über ' + (o.xLabel || 'x') + ', ' + (pts || []).length + ' Punkte' + (ghost && ghost.length > 1 ? ', dazu die Linie der Rechnung' : '') + '.') + '">' + s.join('') + '</svg>';
  }
  /* CSV und Rückweg: ausschließlich ANA_CORE.report.csv / parseCsv */
  function toCsv(e) {
    const C = CORE(); if (!C || !C.report || typeof C.report.csv !== 'function') return null;
    let r = null; try { r = C.report.csv(norm(e)); } catch (er) { r = null; } return r && r.ok !== false && typeof r.text === 'string' ? r.text : null;
  }
  function fromCsvRes(text) {
    const C = CORE(); if (!C || !C.report || typeof C.report.parseCsv !== 'function') return { ok: false, why: NOCORE };
    let r = null; try { r = C.report.parseCsv(String(text == null ? '' : text)); } catch (er) { r = null; }
    if (!r || r.ok === false || !r.entry) return { ok: false, why: String((r && r.why) || 'Die Datei konnte nicht gelesen werden.') };
    return { ok: true, entry: norm(r.entry) };
  }
  const fromCsv = text => { const r = fromCsvRes(text); return r.ok ? r.entry : null; };
  /* Bauteil- und Quellenfelder (aus dem Bericht): Zahlen sind eingabefähig, Texte (Betriebsart, Schaltung, Typ) stehen als Kennzeichen */
  const fieldOf = k => FIELD[k] || [k, ''];
  const numFields = (map, skipStr) => Object.keys(map || {}).filter(k => (fin(map[k]) || (!skipStr && typeof map[k] === 'string')) && (fin(map[k]) || fin(parseNum(map[k])))).map(k => ({ key: k, label: fieldOf(k)[0], unit: fieldOf(k)[1], value: map[k] }));
  const bauteilFields = n => numFields(n.bauteile);
  const quelleFields = n => numFields(n.quelle);
  const extraFields = n => Object.keys(n.bauteile || {}).filter(k => typeof n.bauteile[k] === 'string' && !fin(parseNum(n.bauteile[k]))).map(k => ({ key: k, label: ({ typ: 'Typ', modell: 'Modell', schaltung: 'Schaltung', opv: 'Operationsverstärker', betrieb: 'Betriebsart', last: 'Last' })[k] || k, value: String(n.bauteile[k]) }));
  const auswFields = n => (Object.prototype.hasOwnProperty.call(AUSW, n.rigId) ? AUSW[n.rigId] : []).map(k => ({ key: k, label: AW[k][0], unit: AW[k][1], value: n.auswertung && n.auswertung[k] !== undefined ? n.auswertung[k] : '' }));
  const ymd = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? m[3] + '.' + m[2] + '.' + m[1] : String(s || ''); };
  function printHtml(e, res) {
    const n = norm(e), rows = [], cols = n.spalten, dash = v => (v === '' || v === undefined ? '–' : v);
    rows.push(['Name', dash(n.name)], ['Datum', dash(ymd(n.datum))], ['Schaltung', dash(n.schaltung)]);
    bauteilFields(n).forEach(f => rows.push([f.label, disp(parseNum(f.value), f.unit) || String(f.value)]));
    extraFields(n).forEach(f => rows.push([f.label, f.value]));
    quelleFields(n).forEach(f => rows.push([f.label, disp(parseNum(f.value), f.unit) || String(f.value)]));
    auswFields(n).forEach(f => rows.push([f.label, f.value === '' ? '–' : String(f.value) + (f.unit && !/[A-Za-zΩ]$/.test(String(f.value)) ? ' ' + f.unit : '')]));
    rows.push(['Ergebnis', dash(n.ergebnis)]);
    const tb = cols.length ? '<h2>Messreihe</h2><table><tr>' + cols.map(c => '<th>' + esc(c.label + (c.unit ? ' in ' + c.unit : '')) + '</th>').join('') + '</tr>' + n.messreihe.map(r => '<tr>' + cols.map(c => '<td>' + esc(cellText(r[c.key]) || '–') + '</td>').join('') + '</tr>').join('') + '</table>' : '';
    return '<div class="proto"><h1>Messreihe und Bericht (Übung)</h1><p><b>' + esc(hintText()) + '</b> Bauteilwerte sind Übungswerte; die Messwerte stammen aus der Simulation.</p><table>' + rows.map(r => '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>').join('') + '</table>' + tb +
      (res && res.ran ? '<h2>Kontrolle</h2><p>' + esc(res.ok ? res.text : res.abw.length + ' Abweichung(en)') + '</p>' + (res.abw.length ? '<ul>' + res.abw.map(a => '<li>' + esc(a.text) + '</li>').join('') + '</ul>' : '') : '') + '</div>';
  }
  /* Verlauf: neueste zuletzt, höchstens 20 */
  function addHistory(list, item, max) { const a = (Array.isArray(list) ? list : []).filter(x => x && typeof x === 'object'); a.push(item); return a.slice(-(max || MAXH)); }
  const countOk = list => (Array.isArray(list) ? list : []).filter(x => x && x.ok === true).length;

  /* ============================================================ Oberfläche */
  let A = null, H = null;
  const st = { entry: null, res: null, armed: 0, open: false, col: null, w: 0 };
  const CSS = '.ana-rp-err{color:var(--bad-fg);font-size:13px;margin:3px 0 0}.ana-rp-bad input{border-color:var(--danger)}.ana-rp-sec{margin:14px 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:.07em;color:var(--mute);font-weight:600}' +
    '.ana-rp-g{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px 10px}.ana-rp-tb{margin:0;display:grid;gap:6px}.ana-rp-tb .ana-rp-r{display:grid;grid-template-columns:repeat(var(--n,3),minmax(0,1fr));gap:6px}.ana-rp-tb .ana-rp-h{font-size:12px;color:var(--mute);font-weight:600;text-transform:uppercase;letter-spacing:.04em}' +
    '.ana-rp-tb input{padding:10px 8px;min-width:0}.ana-rp-tags{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:13px;color:var(--mute);margin:2px 0 6px}.ana-rp-hist small{color:var(--mute)}' +
    '.ana-rp-svg{display:block;width:100%;height:auto;border-radius:8px}.ana-rp-bg{fill:var(--well)}.ana-rp-fr{fill:none;stroke:var(--chart-axis);stroke-width:1}.ana-rp-gr{stroke:var(--chart-grid);stroke-width:1}.ana-rp-tx{fill:var(--mute);font-size:12px;font-variant-numeric:tabular-nums}.ana-rp-ti{fill:var(--fg);font-size:12px}' +
    '.ana-rp-pt{fill:var(--accent);stroke:var(--bg);stroke-width:1.5}.ana-rp-gh{fill:none;stroke:var(--mute);stroke-width:2.2;stroke-dasharray:3 3}.ana-rp-leg{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:13px;margin:6px 0 0}';
  function css() { try { if (typeof document !== 'undefined' && document.head && !document.getElementById('anaReportCss')) { const s = document.createElement('style'); s.id = 'anaReportCss'; s.textContent = CSS; document.head.appendChild(s); } } catch (e) {} }
  const hist = () => { const a = A && A.lsGet ? A.lsGet(KEY, []) : []; return Array.isArray(a) ? a : []; };
  const prefer = () => { try { const v = typeof localStorage !== 'undefined' ? localStorage.getItem('lm4.name') : ''; return v ? String(v).replace(/^"|"$/g, '') : ''; } catch (e) { return ''; } };
  const toast = m => { if (A && A.toast) A.toast(m); };
  const rigState = () => { try { if (A && typeof A.allCtl === 'function') return A.allCtl(); if (A && A.rig && typeof A.rig.getControls === 'function') return A.rig.getControls(); } catch (e) {} return {}; };
  const tpl = (key, dflt) => { const C = CORE(), t = C && C.report && Array.isArray(C.report.template) ? C.report.template.find(x => x && x.key === key) : null; return t && t.label ? String(t.label) : dflt; };
  function load() {
    let cur = null; try { cur = A && typeof A.getBericht === 'function' ? A.getBericht() : (A && A.S ? A.S.bericht : null); } catch (e) { cur = null; }
    st.entry = cur ? norm(cur) : blank({ name: prefer() });
  }
  function commit() { if (A && typeof A.setBericht === 'function') { try { A.setBericht(norm(st.entry)); } catch (e) {} } }
  const errOf = f => (st.res && st.res.abw ? st.res.abw.filter(a => a.feld === f || a.feld.indexOf(f + '.') === 0) : []);
  const errHtml = f => errOf(f).map(a => '<div class="ana-rp-err" role="alert">✗ ' + esc(a.text) + '</div>').join('');
  const field = (key, label, type, v, extra) => '<label class="f' + (errOf(extra && extra.err ? extra.err : key).length ? ' ana-rp-bad' : '') + '"><span>' + esc(label) + '</span><input id="anaRpf_' + key + '" data-f="' + key + '" type="' + type + '" value="' + esc(v) + '" autocomplete="off"' + (extra && extra.ph ? ' placeholder="' + esc(extra.ph) + '"' : '') + (extra && extra.list ? ' list="' + extra.list + '"' : '') + '>' + errHtml(extra && extra.err ? extra.err : key) + '</label>';
  const small = (grp, k, label, unit, v) => '<label class="f' + (errOf(grp + '.' + k).length ? ' ana-rp-bad' : '') + '"><span>' + esc(label + (unit ? ' in ' + unit : '')) + '</span><input id="anaRp_' + grp + '_' + k + '" data-g="' + grp + '" data-k="' + k + '" inputmode="decimal" value="' + esc(grp === 'auswertung' ? (typeof v === 'string' ? v : cellText(v)) : disp(parseNum(v), unit) || String(v)) + '" autocomplete="off">' + errHtml(grp + '.' + k) + '</label>';
  /* Gibt der Kern für den Zustand des Prüfstands eine Messreihe? Sonst steht sein Text als Hinweis da (kein Fehler) */
  /* Verdeckter Fehler (Fehlersuche): Eine Messreihe trägt den Zustand der Anlage in Bericht und CSV und würde die Ursache verraten; deshalb erst messen und raten, dann aufnehmen */
  const HIDDEN = 'Der Aufbau hat einen verdeckten Fehler: Miss zuerst am Prüfstand und finde die Ursache. Eine Messreihe mit allen Einstellungen würde ihn verraten, darum ist sie erst danach möglich.';
  const hiddenFault = () => { try { return !!(A && A.rig && typeof A.rig.isVerdeckt === 'function' && A.rig.isVerdeckt()); } catch (e) { return false; } };
  function probe() {
    const C = CORE(); if (!C) return { ok: false, nocore: true, why: NOCORE };
    if (!A || !A.rig) return { ok: false, norig: true, why: 'Wähle im Tab Prüfstand eine Anlage.' };
    if (hiddenFault()) return { ok: false, hidden: true, why: HIDDEN };
    const r = take(st.entry, A.rig.id, rigState(), 1); return r.ok ? { ok: true } : { ok: false, none: !!r.none, why: r.why };
  }
  function tableHtml(n) {
    const cols = n.spalten; if (!cols.length || !n.messreihe.length) return '<p class="hint2">Noch keine Messreihe im Bericht. „Messreihe aufnehmen“ holt sie vom Prüfstand.</p>' + errHtml('messreihe') + errHtml('messwerte');
    return '<div class="ana-rp-tb" style="--n:' + cols.length + '"><div class="ana-rp-r">' + cols.map(c => '<div class="ana-rp-h">' + esc(c.label + (c.unit ? ' [' + c.unit + ']' : '')) + '</div>').join('') + '</div>' +
      n.messreihe.map((r, i) => '<div class="ana-rp-r">' + cols.map(c => '<input data-r="' + i + '" data-c="' + esc(c.key) + '" inputmode="decimal" aria-label="' + esc(c.label + ' in Zeile ' + (i + 1)) + '" value="' + esc(cellText(r[c.key])) + '" autocomplete="off">').join('') + '</div>').join('') + '</div>' + errHtml('messreihe') + errHtml('messwerte');
  }
  function chartHtml() {
    const n = st.entry, cols = dataCols(n); if (!cols.length || !n.messreihe.length) return '';
    const c = cols.find(q => q.key === st.col) || cols[0]; st.col = c.key; const xc = xCol(n);
    const pts = points(n, c.key), ghost = st.res && st.res.ran ? ghostPoints(n, c.key) : null;
    if (!pts.length) return '<p class="hint2">Im Diagramm erscheinen deine Messpunkte, sobald die Tabelle gültige Zahlen enthält.</p>';
    return '<div class="ana-rp-sec">Diagramm deiner Messpunkte</div>' + (cols.length > 1 ? '<div class="chips" role="tablist" aria-label="Messgröße wählen">' + cols.map(q => '<button class="chip' + (q.key === c.key ? ' on' : '') + '" role="tab" aria-selected="' + (q.key === c.key) + '" data-col="' + esc(q.key) + '">' + esc(cut(q.label, 40)) + '</button>').join('') + '</div>' : '') +
      chartSvg(pts, ghost, { w: st.w || (H && H.clientWidth ? H.clientWidth - 26 : 560), yLabel: c.label, yUnit: c.unit, xLabel: xc.label, xUnit: xc.unit }) +
      '<div class="ana-rp-leg"><span>● Deine Messpunkte</span>' + (ghost ? '<span>- - Rechnung (Geisterlinie, nach der Kontrolle)</span>' : '<span>Die Linie der Rechnung erscheint erst nach „Bericht kontrollieren“.</span>') + '</div>';
  }
  function resHtml() {
    const r = st.res; if (!r) return '';
    if (!r.ran) return '<div class="ex bad" role="alert"><b>✗ Keine Kontrolle möglich</b><p style="margin:6px 0 0">' + esc(r.text) + '</p></div>';
    const all = '<details style="margin-top:8px"><summary style="cursor:pointer;min-height:40px;display:flex;align-items:center">Alle geprüften Punkte (' + r.items.length + ')</summary><ul style="margin:4px 0 0;padding-left:20px">' + r.items.map(x => '<li>' + (x.ok ? '✓ ' : '✗ ') + esc(x.text) + '</li>').join('') + '</ul></details>';
    if (r.ok) return '<div class="ex ok" role="status"><b>✓ Stimmig.</b> ' + esc(r.text) + all + '</div>';
    return '<div class="ex bad" role="alert"><b>✗ ' + r.abw.length + (r.abw.length === 1 ? ' Abweichung' : ' Abweichungen') + '</b><ul style="margin:6px 0 0;padding-left:20px">' + r.abw.map(a => '<li>' + esc(a.text) + '</li>').join('') + '</ul>' + all + '</div>';
  }
  function histHtml() {
    const h = hist().slice().reverse();
    if (!h.length) return '<details class="card" id="anaRpHist"><summary>Verlauf der letzten Berichte</summary><div class="cb"><p class="hint2" style="padding:6px">Noch kein Bericht abgelegt. „Ablegen“ speichert den Bericht auf diesem Gerät (die letzten ' + MAXH + ').</p></div></details>';
    return '<details class="card" id="anaRpHist"' + (st.open ? ' open' : '') + '><summary>Verlauf der letzten Berichte (' + h.length + ')</summary><div class="cb ana-rp-hist">' + h.map(x => {
      const e = x.entry || {}, d = new Date(x.t || 0), when = isNaN(d) ? '' : d.toLocaleDateString('de-DE') + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      return '<div class="row"><span aria-hidden="true">' + (x.ok ? '✓' : '✗') + '</span><div class="grow">' + esc(e.schaltung || 'Ohne Schaltung') + ' · ' + esc(e.name || 'ohne Namen') + '<small>' + esc(when) + ' · ' + (x.ok ? 'bei der Kontrolle stimmig' : 'bei der Kontrolle nicht stimmig oder nicht geprüft') + '</small></div><button class="chip s" data-h="load" data-id="' + esc(x.id) + '">Laden</button><button class="chip s danger" data-h="del" data-id="' + esc(x.id) + '" aria-label="Bericht löschen">Löschen</button></div>';
    }).join('') + '</div></details>';
  }
  function html() {
    const C = CORE(); if (!C || !C.report || !Array.isArray(C.report.template)) return '<div class="card pl"><p class="big">Messreihe</p><p class="hint2">' + esc(NOCORE) + '</p></div>';
    const n = st.entry, pr = probe(), same = A && A.rig && n.rigId === A.rig.id;
    const rn = id => (A && typeof A.rigName === 'function' ? A.rigName(id) : id);
    const other = n.rigId && A && A.rig && !same ? '<p class="hint2" style="margin:0 0 8px">Der Bericht gehört zu „' + esc(n.schaltung || rn(n.rigId)) + '“. Am Prüfstand steht gerade etwas anderes; „Messreihe aufnehmen“ ersetzt die Messreihe (Name und Datum bleiben).</p>' : '';
    const nomess = !pr.ok && !pr.norig && !pr.nocore ? '<div class="ex" role="status"><b>' + (pr.none ? 'Für diese Einstellung gibt es keine Messreihe.' : 'Gerade keine Messreihe möglich.') + '</b><p style="margin:6px 0 0">' + esc(pr.why) + '</p><div class="btns"><button class="btn" data-a="rig">Zum Prüfstand</button></div></div>' : '';
    const b = bauteilFields(n), q = quelleFields(n), x = extraFields(n), aw = auswFields(n), dl = (A && Array.isArray(A.ORDER) ? A.ORDER : []).map(id => '<option value="' + esc(rn(id)) + '"></option>').join('');
    return '<div class="card pl"><h4>Messreihe und Bericht</h4><p class="hint2" style="margin:0 0 8px"><b>' + esc(hintText()) + '</b> Nimm am Prüfstand eine Messreihe auf, trage die Kennwerte selbst ein und lass dann kontrollieren, ob alles zusammenpasst. Pflichtfelder sind mit * markiert. Die Bauteilwerte sind Übungswerte.</p>' + other + nomess +
      '<div class="btns" style="margin:0 0 8px"><button class="btn pri" data-a="take">Messreihe aufnehmen</button></div>' +
      '<div class="ana-rp-g">' + field('name', tpl('name', 'Name') + ' *', 'text', n.name) + field('datum', tpl('datum', 'Datum') + ' *', 'date', n.datum) + field('schaltung', tpl('schaltung', 'Schaltung') + ' *', 'text', n.schaltung, { ph: 'zum Beispiel Transistor als Schalter', list: 'anaRpSch' }) + '</div><datalist id="anaRpSch">' + dl + '</datalist>' +
      '<div class="ana-rp-sec">' + esc(tpl('bauteile', 'Bauteilwerte')) + ' *</div>' + ((b.length || x.length) ? (x.length ? '<div class="ana-rp-tags">' + x.map(f => '<span>' + esc(f.label) + ': <b>' + esc(f.value) + '</b></span>').join('') + '</div>' : '') + '<div class="ana-rp-g">' + b.map(f => small('bauteile', f.key, f.label, f.unit, f.value)).join('') + '</div>' : '<p class="hint2">Die Bauteilwerte kommen mit der Messreihe aus dem Prüfstand.</p>') + errHtml('bauteile') +
      '<div class="ana-rp-sec">' + esc(tpl('quelle', 'Quelle')) + ' *</div>' + (q.length ? '<div class="ana-rp-g">' + q.map(f => small('quelle', f.key, f.label, f.unit, f.value)).join('') + '</div>' : '<p class="hint2">Die Quelle kommt mit der Messreihe aus dem Prüfstand.</p>') + errHtml('quelle') +
      '<div class="ana-rp-sec">' + esc(tpl('messreihe', 'Messreihe')) + ' *</div>' + tableHtml(n) + '<div id="anaRpChart">' + chartHtml() + '</div>' +
      '<div class="ana-rp-sec">Auswertung: trage die Kennwerte selbst ein *</div>' + (aw.length ? '<div class="ana-rp-g">' + aw.map(f => small('auswertung', f.key, f.label, f.unit, f.value)).join('') + '</div>' : '<p class="hint2">Die Kennwerte (zum Beispiel I_C, U_CE, V_u, f_g, U_o oder U_u) trägst du nach der Messreihe ein.</p>') + errHtml('auswertung') +
      '<div class="ana-rp-sec">' + esc(tpl('ergebnis', 'Ergebnis')) + ' *</div>' + field('ergebnis', 'Ergebnis in einem Satz', 'text', n.ergebnis, { ph: 'Was hast du herausgefunden?' }) +
      '<div id="anaRpRes" style="margin-top:10px">' + resHtml() + '</div>' +
      '<div class="btns"><button class="btn pri" data-a="check">Bericht kontrollieren</button><button class="btn" data-a="save">Ablegen (Verlauf)</button><button class="btn" data-a="print">Drucken oder als PDF</button><button class="btn" data-a="csv">Als CSV</button><button class="btn" data-a="import">CSV laden</button><button class="btn danger" data-a="clear">' + (st.armed > Date.now() ? 'Wirklich leeren?' : 'Neuer Bericht') + '</button></div>' +
      '<input type="file" id="anaRpFile" accept=".csv,text/csv" hidden aria-label="CSV-Datei wählen"></div>' + histHtml();
  }
  function paint() { if (!H) return; css(); st.w = H.clientWidth ? H.clientWidth - 26 : 0; H.innerHTML = html(); H.dataset.rp = '1'; }
  /* Eingabe geändert: alte Kontrolle gilt nicht mehr (Regel 2: nur Geprüftes behaupten); nur Ergebnisbereich und Diagramm neu, damit kein Fokus verloren geht */
  function stale() {
    if (!st.res) return; st.res = null;
    if (H && typeof H.querySelector === 'function') { const r = H.querySelector('#anaRpRes'), c = H.querySelector('#anaRpChart'); if (r) r.innerHTML = ''; if (c) c.innerHTML = chartHtml(); }
    if (H && typeof H.querySelectorAll === 'function') { Array.prototype.forEach.call(H.querySelectorAll('.ana-rp-err'), n => { if (n.remove) n.remove(); }); Array.prototype.forEach.call(H.querySelectorAll('.ana-rp-bad'), n => { if (n.classList) n.classList.remove('ana-rp-bad'); }); }
  }
  function exportCsv() {
    const txt = toCsv(st.entry); if (txt === null) { toast('Die CSV-Datei konnte nicht erzeugt werden.'); return null; }
    const blob = new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8' });
    try {
      if (root.LabExport && root.LabExport.saveBlob) root.LabExport.saveBlob(blob, root.LabExport.fname ? root.LabExport.fname('csv') : 'ana-messreihe.csv');
      else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'ana-messreihe.csv'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
      A && A.stat && A.stat('csv'); toast('CSV gespeichert');
    } catch (e) { toast('Die Datei konnte nicht gespeichert werden.'); }
    return txt;
  }
  function printNow() {
    const pa = typeof document !== 'undefined' ? document.getElementById('printArea') : null; if (!pa) { toast('Drucken ist hier nicht möglich.'); return; }
    pa.innerHTML = printHtml(st.entry, st.res); setTimeout(() => { try { window.print(); } catch (e) {} }, 80);
  }
  function doTake() {
    if (!A || !A.rig) { toast('Wähle zuerst im Tab Prüfstand eine Anlage.'); return false; }
    if (hiddenFault()) { toast(HIDDEN); paint(); return false; }
    const r = take(st.entry, A.rig.id, rigState());
    if (!r.ok) { toast(r.none ? 'Für diese Einstellung gibt es keine Messreihe: ' + r.why : String(r.why)); paint(); return false; }
    st.entry = r.entry; st.res = null; st.col = null; commit(); paint(); toast('Messreihe aufgenommen. Die Kennwerte und das Ergebnis trägst du selbst ein.'); return true;
  }
  function doCheck() { st.res = checkEntry(st.entry); paint(); return st.res; }
  function doSave() {
    const res = st.res && st.res.ran ? st.res : checkEntry(st.entry);
    const item = { id: 'b' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), t: Date.now(), entry: norm(st.entry), ok: !!res.ok };
    const a = addHistory(hist(), item, MAXH); A.lsSet(KEY, a); if (A.stat) A.stat('anareport', countOk(a), 'max');
    st.open = true; paint(); toast(res.ok ? 'Abgelegt: Der Bericht war bei der Kontrolle stimmig.' : 'Abgelegt, aber bei der Kontrolle nicht stimmig oder noch nicht kontrolliert.'); return item;
  }
  function onClick(e) {
    const t = e.target && e.target.closest ? e.target : null; if (!t) return;
    const col = t.closest('[data-col]'); if (col) { st.col = col.dataset.col; const c = H.querySelector('#anaRpChart'); if (c) c.innerHTML = chartHtml(); return; }
    const h = t.closest('[data-h]');
    if (h) {
      const id = h.dataset.id, a = hist();
      if (h.dataset.h === 'load') { const it = a.find(x => x.id === id); if (it) { st.entry = norm(it.entry); st.res = null; st.col = null; commit(); paint(); toast('Bericht geladen'); } }
      else { A.lsSet(KEY, a.filter(x => x.id !== id)); st.open = true; paint(); toast('Bericht gelöscht'); }
      return;
    }
    const b = t.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
    if (a === 'take') doTake(); else if (a === 'rig') { if (A && A.setTab) A.setTab('rig'); }
    else if (a === 'check') doCheck(); else if (a === 'save') doSave(); else if (a === 'print') printNow(); else if (a === 'csv') exportCsv();
    else if (a === 'import') { const f = H.querySelector('#anaRpFile'); if (f && f.click) f.click(); }
    else if (a === 'clear') { if (st.armed > Date.now()) { st.entry = blank({ name: prefer() }); st.res = null; st.armed = 0; st.col = null; commit(); paint(); toast('Neuer Bericht'); } else { st.armed = Date.now() + 4000; paint(); toast('Nochmal tippen leert den Bericht.'); setTimeout(() => { if (st.armed && st.armed <= Date.now() + 50) { st.armed = 0; paint(); } }, 4100); } }
  }
  function onChange(e) {
    const t = e.target; if (!t || !t.dataset) return;
    if (t.id === 'anaRpFile') {
      const f = t.files && t.files[0]; if (!f) return;
      const rd = new FileReader(); rd.onload = () => { const r = fromCsvRes(String(rd.result || '')); if (!r.ok) { toast(r.why); return; } st.entry = r.entry; st.res = null; st.col = null; commit(); paint(); toast('CSV geladen'); };
      rd.readAsText(f, 'utf-8'); t.value = ''; return;
    }
    store(t, true);
  }
  /* Eingabe übernehmen: Texte und Kennwerte bleiben, wie getippt; Zahlenfelder (Bauteile, Quelle, Tabelle) werden bei "change" in eine Zahl gewandelt, wenn sie lesbar ist */
  function store(t, conv) {
    const n = st.entry, raw = String(t.value == null ? '' : t.value);
    if (t.dataset.f) { if (!/^(name|datum|schaltung|ergebnis)$/.test(t.dataset.f)) return; n[t.dataset.f] = raw; }
    else if (t.dataset.g) {
      const g = t.dataset.g, k = t.dataset.k; if (g !== 'bauteile' && g !== 'quelle' && g !== 'auswertung') return;
      n[g] = n[g] || {}; const v = g === 'auswertung' || !conv ? raw : parseNum(raw); n[g][k] = fin(v) ? v : raw;
    } else if (t.dataset.r !== undefined && t.dataset.c) {
      const i = +t.dataset.r; if (!(i >= 0 && i < n.messreihe.length)) return; const v = conv ? parseNum(raw) : NaN; n.messreihe[i][t.dataset.c] = fin(v) ? v : raw; n.rows = n.messreihe.map(r => Object.assign({}, r));
    } else return;
    commit(); if (conv) stale();
  }
  function render(host, api) {
    A = api; H = host; st.armed = 0; load();
    once(host, 'c', 'click', onClick); once(host, 'g', 'change', onChange);
    once(host, 'i', 'input', e => { const t = e.target; if (t && t.dataset && (t.dataset.f || t.dataset.g || t.dataset.r !== undefined)) store(t, false); });
    paint();
  }
  function refresh() { if (H && A) { load(); paint(); } }
  function redraw() { if (H && A && H.clientWidth && Math.abs(H.clientWidth - 26 - st.w) > 6) { const c = H.querySelector ? H.querySelector('#anaRpChart') : null; st.w = H.clientWidth - 26; if (c) c.innerHTML = chartHtml(); } }

  E.report = { render, refresh, redraw, fn: { blank, norm, isEmpty, take, checkEntry, points, ghostPoints, chartSvg, toCsv, fromCsv, fromCsvRes, bauteilFields, quelleFields, extraFields, auswFields, printHtml, addHistory, countOk, disp, cellText, probe, hiddenFault, html, state: st, setApi: a => { A = a; }, setHost: h => { H = h; }, load, AUSW, AW, FIELD } };
})(typeof window !== 'undefined' ? window : globalThis);
