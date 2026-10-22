'use strict';
/* Tonfunk Sicherheits-Lab (ELS-Lab): Tab "Lernen" (WP3d, SPEC 6.5).
   Siebzehn ausklappbare Abschnitte mit SVG-Zeichnungen, die meisten mit "Probier es aus"-Knopf (lädt ein Beispiel elx<n> oder eine Voreinstellung des Prüfstands).
   Tabellen und Zahlen kommen AUS DEM KERN und den Tabellen der Oberfläche (SPEC Regel 1, 5, 7): Formelsammlung aus ELS_CORE.formulas, Glossar aus ELS_CORE.glossary,
   Tastenkürzel aus api.KEYS (sonst window.ELS_KEYS), Schutzebenen aus api.EBENEN (sonst ELS_CORE.ebenen), Grenzwerte NUR über ELS_CORE.limitText / limits,
   Schutzklassen aus cls.info, IP aus ip.table, Netzformen aus grid.forms, RCD-Typen aus rcd.types, Prüfablauf aus cls.info.pruefung und device, Protokollfelder aus protocol.template,
   Sicherheitsregeln aus rules.list, Rettungskette aus aid.list. Jede Zahl im Fließtext stammt aus derselben Kernfunktion wie die Rechnung im Rechner (formulas.<id>.explain,
   grid, prot, rcd, body, insu, pe, leak); fehlt eine Funktion, steht ein Strich statt einer Zahl. Es gibt keine zweite Formelimplementierung.
   Übungswerte (Status A) erscheinen immer mit dem Kennzeichen aus limitText ("Übungswert (A), F<n>"); belegte Werte mit "✓ belegt". Normangaben nur mit "Norm und Vorschrift maßgeblich".
   Sicherheit (SPEC 9): keine Mess- oder Aufbauanleitung für Netzspannung; Abschnitte 13 und 14 tragen den Satz aus TEXTS.keinKurs; Erste Hilfe ohne Zahlen (außer dem Notruf des Kerns).
   Schnittstelle (VERTRAG 6.5): window.ELS_UI_EXT.help = { render(host, api), fn }. Die reinen Funktionen (ohne DOM) hängen unter ELS_UI_EXT.help.fn und werden von test_elsui_help.js geprüft. */
(function (root) {
  const X = root.ELS_UI_EXT = root.ELS_UI_EXT || {};
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  /* Ereignisbehandler am Host nur einmal anhängen (der Host bleibt bei jedem render derselbe, sein Inhalt wird neu gesetzt) */
  const once = (host, name, ty, fn) => { host.__elsl = host.__elsl || {}; if (host.__elsl[name + ty]) return; host.__elsl[name + ty] = 1; host.addEventListener(ty, fn); };
  const fin = v => typeof v === 'number' && isFinite(v);
  const CORE = () => root.ELS_CORE;
  const DASH = '–';
  /* Zahlenformat wie im Rechner: Dezimalkomma, Einheit mit Vorsatz */
  function fe(x, unit) {
    const C = CORE(); if (!fin(x)) return DASH;
    if (C && typeof C.fmtEng === 'function') { try { const t = C.fmtEng(x, unit || ''); if (typeof t === 'string' && t) return t; } catch (e) { /* Rückfall unten */ } }
    return String(+x.toPrecision(3)).replace('.', ',') + (unit ? ' ' + unit : '');
  }
  function ff(x, d) {
    const C = CORE(); if (!fin(x)) return DASH;
    if (C && typeof C.fmt === 'function') { try { const t = C.fmt(x, d == null ? 1 : d); if (typeof t === 'string' && t) return t; } catch (e) { /* Rückfall unten */ } }
    return (+x).toFixed(d == null ? 1 : d).replace('.', ',');
  }
  const fz = v => (fin(v) ? String(+v.toFixed(5)).replace('.', ',') : DASH);
  const mA = v => (fin(v) ? String(+(v * 1000).toPrecision(3)).replace('.', ',') : DASH);
  /* Funktionsaufruf im Kern über Pfad ("grid.fault"); null bei fehlender Funktion oder Ausnahme */
  const call = (path, ...args) => { const C = CORE(); let o = C, ctx = null; for (const k of path.split('.')) { ctx = o; o = o && o[k]; } if (typeof o !== 'function') return null; try { return o.apply(ctx, args); } catch (e) { return null; } };
  /* Formel: explain-Ergebnis (mit Rechenweg) bzw. nur der Wert; NaN, wenn der Kern die Formel nicht hat oder sie ungültig meldet */
  const FX = (id, ...args) => { const C = CORE(), f = C && C.formulas && C.formulas[id]; if (!f || typeof f.explain !== 'function') return null; try { const r = f.explain(...args); return r && r.ok !== false && fin(r.value) ? r : null; } catch (e) { return null; } };
  const FV = (id, ...args) => { const r = FX(id, ...args); return r ? r.value : NaN; };
  const FT = (id, ...args) => { const r = FX(id, ...args); return r ? r.text : DASH; };
  /* Grenzwerttext mit Statuszeichen (✓ belegt / Übungswert (A), F<n>) nur aus dem Kern */
  const LT = id => { const C = CORE(); if (C && typeof C.limitText === 'function') { try { const t = C.limitText(id); if (typeof t === 'string' && t) return t; } catch (e) { /* Strich */ } } return DASH; };
  const TX = k => { const C = CORE(), t = C && C.TEXTS && C.TEXTS[k]; return typeof t === 'string' ? t : ''; };
  const NORM = 'Norm und Vorschrift maßgeblich';
  const KURS = () => TX('keinKurs') || 'Dieses Lab ersetzt keine Unterweisung und keinen Erste-Hilfe-Kurs.';

  /* ============================================================ Zahlenblatt: jede Zahl im Fließtext, mit der Kernfunktion, aus der sie stammt (Test rechnet jede unabhängig nach) */
  const TN = { form: 'TN-S', q: 2.5, qpe: 2.5, l: 20, dev: 'LS-B', In: 16 };
  function nums() {
    const o = {}, C = CORE(); if (!C) return o;
    const K = C.const || {}, rho = K.rho, zv = K.zv;
    o.rho = rho; o.zv = zv; o.l = TN.l; o.q = TN.q; o.In = TN.In;
    o.zc = call('body.zoneCurve', 1000); o.zc100 = call('body.zoneCurve', 100);
    ['trocken', 'feucht', 'nass'].forEach(h => { const r = call('body.resistance', { haut: h }); o['rk_' + h] = r && r.rk; });
    o.tTr = call('body.touch', { U: 230, haut: 'trocken', tMs: 1000 }); o.tNa = call('body.touch', { U: 230, haut: 'nass', tMs: 1000 }); o.t50 = call('body.touch', { U: 50, haut: 'nass', tMs: 1000 });
    o.xTr = FX('koerperStrom', 230, o.rk_trocken, 0); o.xNa = FX('koerperStrom', 230, o.rk_nass, 0);
    o.tn = call('grid.fault', TN); o.lmax = call('grid.maxLength', { form: 'TN-S', q: TN.q, qpe: TN.qpe, dev: TN.dev, In: TN.In });
    o.xRl = FX('rLeiter', TN.l, TN.q, rho); o.rl = o.xRl && o.xRl.value;
    o.xZs = FX('zs', zv, o.rl, o.rl); o.zs = o.xZs && o.xZs.value;
    o.xIf = FX('iF', 230, o.zs); o.iF = o.xIf && o.xIf.value;
    o.xUb = FX('uB', o.iF, o.rl); o.uB = o.xUb && o.xUb.value;
    o.xIa = FX('ia', 5, TN.In); o.ia = o.xIa && o.xIa.value; o.xZm = FX('zsMax', 230, o.ia); o.zsMax = o.xZm && o.xZm.value;
    o.zsB = call('grid.zsMax', 'LS-B', 16); o.zsC = call('grid.zsMax', 'LS-C', 16); o.zsD = call('grid.zsMax', 'LS-D', 16);
    o.iaB = call('prot.ia', 'LS-B', 16); o.iaC = call('prot.ia', 'LS-C', 16); o.iaD = call('prot.ia', 'LS-D', 16);
    o.tnPE = call('grid.fault', Object.assign({ fehler: 'pe-unterbrochen' }, TN));
    o.xTT30 = FX('raTT', 50, 0.03); o.xTT300 = FX('raTT', 50, 0.3); o.raMax30 = call('grid.raMax', 30); o.raMax300 = call('grid.raMax', 300);
    o.it = call('grid.it', { form: 'IT', cleck: 50 });
    o.t145 = call('prot.trip', 'LS-B', 16, 16 * 1.45); o.tUns = call('prot.trip', 'LS-B', 16, 16 * 4); o.tSich = call('prot.trip', 'LS-B', 16, 16 * 5); o.tGG = call('prot.trip', 'gG', 16, 16 * 5);
    o.inB = call('prot.inrush', 'LS-B', 16, 6); o.inC = call('prot.inrush', 'LS-C', 16, 6);
    o.cable = {}; [1.5, 2.5, 4, 6].forEach(q => { const r = call('prot.cable', q); o.cable[q] = r && r.iz; }); o.cab25 = call('prot.cable', 2.5); o.chk = call('prot.check', 10, 16, 20);
    o.curveB = call('prot.curve', 'LS-B', 16);
    o.sumX = call('rcd.sum', [{ i: 5, phase: 'L' }, { i: 4.97, phase: 'N' }]);
    o.rTr10 = call('rcd.trip', { idn: 30, type: 'A' }, 'sinus', 10); o.rTr20 = call('rcd.trip', { idn: 30, type: 'A' }, 'sinus', 20); o.rTr40 = call('rcd.trip', { idn: 30, type: 'A' }, 'sinus', 40);
    o.rBlind = call('rcd.trip', { idn: 30, type: 'A' }, 'gleich', 100); o.tb = call('rcd.testButton', { idn: 30, type: 'A' });
    o.leakOk = call('rcd.leakSum', [3, 3, 3], { idn: 30 }); o.leakFa = call('rcd.leakSum', [5, 5, 5], { idn: 30 });
    o.isoTr = call('insu.measure', { feuchte: 0, sk: 'I' }); o.isoFe = call('insu.measure', { feuchte: 0.8, sk: 'I' }); o.isoParts = call('insu.parts', { feuchte: 0.5, schmutz: 0.5, defekt: true });
    o.xPar = FX('rParallel', 1e6, 2e6); o.xIiso = FX('iIso', 500, 1e6);
    o.p2 = call('pe.measure', { len: 5, q: 1.5, mode: '2L', rk: 0.2 }); o.p4 = call('pe.measure', { len: 5, q: 1.5, mode: '4L', rk: 0.2 }); o.pw = call('pe.measure', { len: 5, q: 1.5, mode: '2L', rk: 0.2, bruch: 'wackel', wiggle: true });
    o.xY22 = FX('ableit', 2.2e-9, 230, 50); o.xY47 = FX('ableit', 4.7e-9, 230, 50); o.xCmax = FX('cMax', 0.0005, 230, 50);
    o.ip44 = call('ip.decode', 'IP44'); o.ip65 = call('ip.decode', 'IP65');
    const r = call('rules.check', ['freischalten', 'sichern', 'erden', 'spannungsfrei', 'abdecken']); o.regelFalsch = r && r.text;
    const a = call('aid.check', ['eigenschutz', 'notruf', 'abschalten', 'pruefen', 'massnahmen']); o.aidFalsch = a && a.text;
    return o;
  }

  /* ============================================================ Zeichnungen (SVG, Breite 400, Schrift 14; Text bis zum Rand: Prüfung im Test) */
  const svg = (label, body, h) => `<svg class="dr" viewBox="0 0 400 ${h || 170}" role="img" aria-label="${esc(label)}" xmlns="http://www.w3.org/2000/svg" font-family="system-ui,sans-serif" font-size="14" fill="currentColor">${body}</svg>`;
  const T = (x, y, t, anchor, extra) => `<text x="${x}" y="${y}"${anchor ? ` text-anchor="${anchor}"` : ''}${extra ? ' ' + extra : ''}>${esc(t)}</text>`;
  const LN = (x1, y1, x2, y2, c, w, dash) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c || 'currentColor'}" stroke-width="${w || 2}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
  const RC = (x, y, w, h, c, fill, r) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r == null ? 8 : r}" fill="${fill || 'none'}" stroke="${c || 'currentColor'}" stroke-width="2"/>`;
  const ARR = (x1, y1, x2, y2, c) => { const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, col = c || 'currentColor'; return `<line x1="${x1}" y1="${y1}" x2="${x2 - ux * 6}" y2="${y2 - uy * 6}" stroke="${col}" stroke-width="2"/><polygon points="${x2},${y2} ${x2 - ux * 9 - uy * 4.5},${y2 - uy * 9 + ux * 4.5} ${x2 - ux * 9 + uy * 4.5},${y2 - uy * 9 - ux * 4.5}" fill="${col}"/>`; };
  const COL = { L: '#e0a63c', N: '#52a8f5', PE: '#3fc47a', basis: '#52c4f5', fehler: '#ffc64d', zusatz: '#3fd7c0', z1: '#3fd7c0', z2: '#ffd84d', z3: '#ff9a3c', z4: '#ff4d4d' };
  /* Zeilenumbruch für SVG-Text (kein tspan, jede Zeile ein eigenes text-Element, damit die Prüfung jede Zeile misst) */
  function wrap(t, max) {
    const words = String(t == null ? '' : t).split(/\s+/).filter(Boolean), lines = []; let cur = '';
    words.forEach(w => { if (cur && (cur + ' ' + w).length > max) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; });
    if (cur) lines.push(cur); return lines.length ? lines : [''];
  }
  /* Senkrechte Schrittfolge (Prüfablauf, Sicherheitsregeln, Rettungskette): Nummer, Kasten mit umbrochenem Text, Pfeil zum nächsten */
  function stepsSvg(label, items) {
    let y = 6, b = '';
    items.forEach((it, i) => {
      const lines = wrap(it, 38), h = 12 + 17 * lines.length;
      b += RC(46, y, 346, h, 'currentColor', 'none', 8) + `<circle cx="24" cy="${y + h / 2}" r="14" fill="none" stroke="currentColor" stroke-width="2"/>` + T(24, y + h / 2 + 5, String(i + 1), 'middle') + lines.map((s, k) => T(56, y + 22 + 17 * k, s)).join('');
      y += h; if (i < items.length - 1) { b += ARR(24, y + 1, 24, y + 9); y += 10; }
    });
    return svg(label, b, y + 8);
  }
  const FALL_EB = { basis: { name: 'Basisschutz', color: COL.basis }, fehler: { name: 'Fehlerschutz', color: COL.fehler }, zusatz: { name: 'Zusatzschutz', color: COL.zusatz } };
  function ebenenOf(api) {
    const C = CORE(), out = {};
    ['basis', 'fehler', 'zusatz'].forEach(k => {
      const u = api && api.EBENEN && api.EBENEN[k], c = C && C.ebenen && C.ebenen[k];
      out[k] = { id: k, name: (u && u.name) || (c && c.name) || FALL_EB[k].name, text: (u && u.text) || (c && c.text) || '', color: (u && u.color) || FALL_EB[k].color };
    });
    return out;
  }
  const DRAW = {
    ebenen: api => { const E = ebenenOf(api), st = k => `style="stroke:${E[k].color}"`; return svg('Drei Schutzebenen als Schalen um den Menschen: außen Zusatzschutz, dann Fehlerschutz, innen Basisschutz',
      `<rect x="6" y="6" width="388" height="178" rx="14" fill="none" stroke-width="3" ${st('zusatz')}/>${T(18, 28, E.zusatz.name)}<rect x="24" y="38" width="352" height="134" rx="12" fill="none" stroke-width="3" ${st('fehler')}/>${T(36, 60, E.fehler.name)}<rect x="42" y="70" width="316" height="92" rx="10" fill="none" stroke-width="3" ${st('basis')}/>${T(54, 92, E.basis.name)}<circle cx="200" cy="118" r="10" fill="none" stroke="currentColor" stroke-width="2"/>${LN(200, 128, 200, 146, 'currentColor')}${LN(188, 136, 212, 136, 'currentColor')}${T(280, 130, 'Mensch', 'middle')}`, 190); },
    zonen: n => {
      const zc = (n && n.zc) || {}, z1 = fin(zc.z1) ? zc.z1 : NaN, z2 = fin(zc.z2) ? zc.z2 : NaN, fl = fin(zc.flimmer) ? zc.flimmer : NaN;
      const X0 = 20, XW = 360, xm = i => Math.max(X0, Math.min(X0 + XW, X0 + XW * (Math.log10(Math.max(i * 1000, 0.1)) + 1) / 4));
      if (!fin(z1) || !fin(z2) || !fin(fl)) return svg('Zonenbild der Stromwirkung nicht verfügbar', T(200, 60, 'Zonengrenzen fehlen im Kern', 'middle'), 100);
      const a = xm(z1), b = xm(z2), c = xm(fl), e = X0 + XW, tk = (x, v) => LN(x, 82, x, 90, 'currentColor', 1.5) + T(x, 106, mA(v) + ' mA', 'middle');
      return svg('Zonenbild der Stromwirkung: vier Zonen über dem Körperstrom in logarithmischer Teilung', T(200, 20, 'Körperstrom (logarithmisch)', 'middle') +
        `<rect x="${X0}" y="40" width="${a - X0}" height="40" fill="${COL.z1}" fill-opacity=".55" stroke="currentColor"/><rect x="${a}" y="40" width="${b - a}" height="40" fill="${COL.z2}" fill-opacity=".55" stroke="currentColor"/><rect x="${b}" y="40" width="${c - b}" height="40" fill="${COL.z3}" fill-opacity=".55" stroke="currentColor"/><rect x="${c}" y="40" width="${e - c}" height="40" fill="${COL.z4}" fill-opacity=".55" stroke="currentColor"/>` +
        T((X0 + a) / 2, 66, 'Z1', 'middle') + T((a + b) / 2, 66, 'Z2', 'middle') + T((b + c) / 2, 66, 'Z3', 'middle') + T((c + e) / 2, 66, 'Z4', 'middle') + tk(a, z1) + tk(b, z2) + tk(c, fl) +
        T(200, 134, 'Wechselstrom 50 Hz, Einwirkdauer ' + ff((zc.t || 1000) / 1000, 0) + ' s', 'middle') + T(200, 156, 'Lehrdarstellung, Übungswerte (A)', 'middle'), 166);
    },
    klassen: n => { const I = n && n.sk ? n.sk : {}; const nm = k => (I[k] && I[k].name) || 'Schutzklasse ' + k;
      const col = (x, k, sym) => T(x, 20, 'Schutzklasse', 'middle') + sym + T(x, 160, k, 'middle', 'font-size="18" font-weight="700"');
      const sk1 = RC(52, 36, 76, 70, 'currentColor') + LN(90, 106, 90, 124) + LN(68, 124, 112, 124) + LN(76, 132, 104, 132) + LN(84, 140, 96, 140);
      const sk2 = RC(166, 40, 68, 60, 'currentColor') + RC(182, 54, 36, 32, 'currentColor', 'none', 2);
      const sk3 = `<polygon points="310,36 346,76 310,116 274,76" fill="none" stroke="currentColor" stroke-width="2"/>` + T(310, 82, 'III', 'middle');
      return svg('Zeichen der Schutzklassen: Schutzleiter-Symbol, Doppelquadrat und römisch III in einer Raute (' + nm('I') + ', ' + nm('II') + ', ' + nm('III') + ')', col(90, 'I', sk1) + col(200, 'II', sk2) + col(310, 'III', sk3), 172); },
    ip: n => { const a = n && n.ip65 && fin(n.ip65.a) ? n.ip65.a : DASH, b = n && n.ip65 && fin(n.ip65.b) ? n.ip65.b : DASH;
      return svg('Aufbau des IP-Codes: erste Ziffer Fremdkörper und Berührung, zweite Ziffer Wasser', RC(40, 30, 70, 60, 'currentColor') + T(75, 70, 'IP', 'middle', 'font-size="26" font-weight="700"') + RC(130, 30, 70, 60, 'currentColor') + T(165, 72, String(a), 'middle', 'font-size="28" font-weight="700"') + RC(220, 30, 70, 60, 'currentColor') + T(255, 72, String(b), 'middle', 'font-size="28" font-weight="700"') +
        LN(165, 90, 165, 112) + T(165, 130, 'Fremdkörper,', 'middle') + T(165, 148, 'Berührung', 'middle') + LN(255, 90, 255, 112) + T(255, 130, 'Wasser', 'middle') + T(330, 78, 'Beispiel IP' + a + b, 'middle'), 160); },
    netz: () => { const colx = [10, 108, 206, 304], cw = 86, ids = ['TN-S', 'TN-C-S', 'TT', 'IT'];
      const lines = (x, kind) => { const x0 = x, x1 = x + cw; let b = LN(x0, 60, x1, 60, COL.L, 3) + T(x0, 54, 'L', 'start', 'font-size="13"') + LN(x0, 84, x1, 84, COL.N, 3) + T(x0, 78, 'N', 'start', 'font-size="13"');
        if (kind === 'TN-S') b += LN(x0, 108, x1, 108, COL.PE, 3) + T(x0, 102, 'PE', 'start', 'font-size="13"');
        else if (kind === 'TN-C-S') { b = LN(x0, 60, x1, 60, COL.L, 3) + T(x0, 54, 'L', 'start', 'font-size="13"') + LN(x0, 96, x0 + 36, 96, COL.PE, 3) + T(x0, 90, 'PEN', 'start', 'font-size="13"') + LN(x0 + 36, 96, x1, 84, COL.N, 3) + LN(x0 + 36, 96, x1, 108, COL.PE, 3) + T(x1, 80, 'N', 'end', 'font-size="13"') + T(x1, 128, 'PE', 'end', 'font-size="13"'); }
        else if (kind === 'TT') b += LN(x1 - 20, 84, x1 - 20, 130, COL.PE, 3) + LN(x1 - 32, 130, x1 - 8, 130, COL.PE, 3) + LN(x1 - 27, 137, x1 - 13, 137, COL.PE, 3) + T(x0, 128, 'Erder', 'start', 'font-size="13"');
        else b = LN(x0, 60, x1, 60, COL.L, 3, '6 4') + LN(x0, 84, x1, 84, COL.N, 3, '6 4') + LN(x1 - 20, 84, x1 - 20, 108, COL.PE, 3) + LN(x1 - 32, 108, x1 - 8, 108, COL.PE, 3) + T(x0, 128, 'isoliert', 'start', 'font-size="13"');
        return b; };
      return svg('Vier Netzformen: TN-S mit getrenntem N und PE, TN-C-S mit PEN, TT mit eigenem Erder, IT isoliert gegen Erde', ids.map((id, i) => T(colx[i] + cw / 2, 24, id, 'middle', 'font-weight="700"') + lines(colx[i], id)).join(''), 160); },
    schleife: () => svg('Fehlerschleife im TN-System: Strom vom Außenleiter über den Körperschluss und den Schutzleiter zurück zur Quelle', RC(8, 38, 62, 92, 'currentColor') + T(39, 90, 'Quelle', 'middle') + RC(282, 38, 110, 92, 'currentColor') + T(337, 82, 'Gerät', 'middle') + T(337, 150, 'Körperschluss', 'middle') +
      LN(70, 58, 282, 58, COL.L, 3) + ARR(150, 58, 210, 58, COL.L) + T(176, 46, 'Außenleiter L', 'middle') + LN(70, 110, 282, 110, COL.PE, 3) + ARR(210, 110, 150, 110, COL.PE) + T(176, 134, 'Schutzleiter PE', 'middle') + `<polyline points="337,98 327,114 345,114 335,132" fill="none" stroke="${COL.z4}" stroke-width="3"/>` + T(176, 90, 'Schleife Zs', 'middle'), 164),
    ls: n => {
      const pts = n && Array.isArray(n.curveB) ? n.curveB.filter(p => p && fin(p[0]) && fin(p[1]) && fin(p[2]) && p[1] > 0 && p[2] > 0) : []; if (pts.length < 2) return svg('Auslöseband nicht verfügbar', T(200, 60, 'Kennlinie fehlt im Kern', 'middle'), 100);
      const X0 = 52, XW = 330, Y0 = 26, YH = 112, lx = Math.log10(20), xm = x => X0 + XW * Math.log10(Math.max(x, 1)) / lx, ym = t => Y0 + YH - YH * (Math.log10(Math.max(t, 1e-3)) + 3) / 7;
      const up = pts.map(p => xm(p[0]).toFixed(1) + ',' + ym(p[2]).toFixed(1)), lo = pts.slice().reverse().map(p => xm(p[0]).toFixed(1) + ',' + ym(p[1]).toFixed(1));
      const xt = [1, 3, 5, 10], yt = [[1e-2, '10 ms'], [1, '1 s'], [100, '100 s']];
      return svg('Auslöseband eines Leitungsschutzschalters Typ B mit 16 A: Zeit über dem Vielfachen des Nennstroms, beide logarithmisch', T(X0, 16, 'Auslösezeit (logarithmisch)') + `<polygon points="${up.concat(lo).join(' ')}" fill="${COL.zusatz}" fill-opacity=".35" stroke="currentColor" stroke-width="2"/>` + LN(X0, Y0, X0, Y0 + YH) + LN(X0, Y0 + YH, X0 + XW, Y0 + YH) +
        xt.map(v => LN(xm(v), Y0 + YH, xm(v), Y0 + YH + 6, 'currentColor', 1.5) + T(xm(v), Y0 + YH + 22, String(v), 'middle')).join('') + yt.map(a => LN(X0 - 5, ym(a[0]), X0, ym(a[0]), 'currentColor', 1.5) + T(X0 - 8, ym(a[0]) + 5, a[1], 'end')).join('') +
        LN(xm(3), Y0, xm(3), Y0 + YH, 'currentColor', 1, '3 4') + LN(xm(5), Y0, xm(5), Y0 + YH, 'currentColor', 1, '3 4') + T(X0 + XW / 2, Y0 + YH + 42, 'Vielfaches von In (logarithmisch)', 'middle'), 186); },
    rcd: () => svg('Summenstromwandler: Hin- und Rückstrom gehen durch den Ring, ein Fehlerstrom nach Erde bleibt als Differenz', LN(10, 52, 290, 52, COL.L, 3) + ARR(40, 52, 80, 52, COL.L) + LN(10, 92, 290, 92, COL.N, 3) + ARR(80, 92, 40, 92, COL.N) + RC(290, 36, 100, 72, 'currentColor') + T(340, 76, 'Gerät', 'middle') +
      `<ellipse cx="150" cy="72" rx="18" ry="40" fill="none" stroke="currentColor" stroke-width="3"/>` + T(150, 22, 'Summenstromwandler', 'middle') + LN(150, 112, 150, 126, 'currentColor') + RC(120, 126, 60, 26, 'currentColor') + T(150, 144, 'Auslöser', 'middle') + `<path d="M340 108 L340 150 L356 150" fill="none" stroke="${COL.z4}" stroke-width="3" stroke-dasharray="6 4"/>` + T(360, 154, 'Erde', 'start', 'font-size="13"'), 166),
    iso: n => { const P = n && n.isoParts && Array.isArray(n.isoParts.parts) ? n.isoParts.parts.slice(0, 4) : []; if (!P.length) return svg('Parallele Leckpfade nicht verfügbar', T(200, 50, 'Isolationsmodell fehlt im Kern', 'middle'), 100);
      let b = '', y = 44; const top = y;
      P.forEach(p => { b += T(200, y - 6, p.name, 'middle', 'font-size="13"') + LN(70, y + 8, 150, y + 8) + RC(150, y, 100, 16, 'currentColor', 'none', 2) + LN(250, y + 8, 330, y + 8); y += 40; });
      const bot = y - 32; b += LN(70, top + 8, 70, bot + 8) + LN(330, top + 8, 330, bot + 8) + LN(70, (top + bot) / 2 + 8, 30, (top + bot) / 2 + 8) + LN(330, (top + bot) / 2 + 8, 370, (top + bot) / 2 + 8) + T(200, 18, 'Leckpfade liegen parallel', 'middle') + T(30, (top + bot) / 2 + 28, 'R_iso', 'start', 'font-size="13"');
      return svg('Isolationswiderstand als Parallelschaltung von Leckpfaden: Material, Feuchtigkeit, Schmutz und Defekt', b, y + 8); },
    ableit: () => svg('Netzteil mit Y-Kondensator zwischen Außenleiter und berührbarem Gehäuse: Ein Teil des Stroms fließt über den Körper nach Erde', RC(40, 24, 220, 100, 'currentColor') + T(150, 46, 'Netzteil', 'middle') + LN(10, 62, 40, 62, COL.L, 3) + T(10, 56, 'L', 'start', 'font-size="13"') + LN(40, 62, 130, 62, COL.L, 3) + LN(130, 62, 130, 76, COL.L, 2) + LN(116, 76, 144, 76, 'currentColor') + LN(116, 84, 144, 84, 'currentColor') + LN(130, 84, 130, 100, 'currentColor', 2) + LN(130, 100, 260, 100, 'currentColor', 2) + T(158, 82, 'Cy', 'start') + T(150, 118, 'Gehäuse', 'middle', 'font-size="13"') +
      ARR(300, 100, 300, 140, COL.z4) + T(312, 124, 'Körper', 'start', 'font-size="13"') + LN(260, 100, 300, 100, 'currentColor', 2) + LN(280, 152, 320, 152) + LN(288, 158, 312, 158), 170),
    pruef: n => stepsSvg('Prüfreihenfolge: Sichtprüfung, Schutzleiterwiderstand, Isolationswiderstand, Schutzleiterstrom', (n && n.pruefSchritte) || []),
    leiter: () => svg('Leiterfarben: Schutzleiter grün-gelb, Neutralleiter blau, Außenleiter braun, schwarz und grau', [['Schutzleiter PE: grün-gelb'], ['Neutralleiter N: blau'], ['Außenleiter L: braun, schwarz, grau']].map((r, i) => {
      const y = 12 + i * 44, st = `<rect x="10" y="${y}" width="60" height="26" rx="4" fill="none" stroke="currentColor" stroke-width="2"/>`;
      const fill = i === 0 ? `<rect x="11" y="${y + 1}" width="58" height="24" fill="#3fc47a"/><rect x="26" y="${y + 1}" width="14" height="24" fill="#e8d84a"/><rect x="52" y="${y + 1}" width="14" height="24" fill="#e8d84a"/>` : i === 1 ? `<rect x="11" y="${y + 1}" width="58" height="24" fill="#52a8f5"/>` : `<rect x="11" y="${y + 1}" width="19" height="24" fill="#8a5a2b"/><rect x="30" y="${y + 1}" width="19" height="24" fill="#222"/><rect x="49" y="${y + 1}" width="20" height="24" fill="#999"/>`;
      return fill + st + T(82, y + 18, r[0]);
    }).join(''), 140),
    regeln: n => stepsSvg('Die fünf Sicherheitsregeln in fester Reihenfolge', (n && n.regelNamen) || []),
    aid: n => stepsSvg('Rettungskette bei einem Stromunfall in fester Reihenfolge', (n && n.aidNamen) || [])
  };
  /* SVG-Texte: grobe Breitenschätzung (0,6 · Schriftgröße je Zeichen) gegen die Zeichenfläche. Bei 390 Pixel Seitenbreite wird die Zeichnung (Breite 400) auf etwa 334 Pixel verkleinert;
     scale0 = 334/400 ist der Verkleinerungsfaktor, die wirksame Schrift (Schrift · scale0) muss lesbar bleiben (Test: mindestens 11 Pixel). Browser misst zusätzlich mit getBBox. */
  const SCALE390 = (390 - 56) / 400;
  function svgTextCheck(markup, width) {
    const bad = [], vb = /viewBox="0 0 (\d+) (\d+)"/.exec(markup), W = vb ? +vb[1] : width || 400, root0 = /<svg[^>]*font-size="(\d+)"/.exec(markup), fs0 = root0 ? +root0[1] : 14, re = /<text\b([^>]*)>([^<]*)<\/text>/g; let m;
    while ((m = re.exec(markup))) {
      const at = k => { const q = new RegExp('(?:^|\\s)' + k + '="([^"]*)"').exec(m[1]); return q ? q[1] : null; }, x = +at('x'), fs = +(at('font-size') || fs0), t = m[2].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"'), w = t.length * fs * 0.6, anc = at('text-anchor') || 'start';
      const x0 = anc === 'middle' ? x - w / 2 : anc === 'end' ? x - w : x, x1 = x0 + w;
      if (x0 < -1 || x1 > W + 1) bad.push(t + ' (' + Math.round(x0) + '…' + Math.round(x1) + ' von ' + W + ')');
      if (fs * SCALE390 < 10.5) bad.push(t + ' (Schrift zu klein bei 390 px: ' + (fs * SCALE390).toFixed(1) + ')');
    }
    return bad;
  }

  /* ============================================================ Abschnitte */
  const P = t => `<p>${t}</p>`, LI = a => '<ul>' + a.map(x => `<li>${x}</li>`).join('') + '</ul>', OL = a => '<ol>' + a.map(x => `<li>${x}</li>`).join('') + '</ol>';
  const TB = (head, rows) => `<table class="rs"><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map((c, i) => `<td data-l="${esc(head[i] || '')}">${c}</td>`).join('')}</tr>`).join('')}</table>`;
  /* Auf dem Handy werden Tabellen zu Karten (Zeile = Karte, Spaltenkopf vor dem Inhalt), damit nichts seitlich abgeschnitten wird */
  const CSS = '@media(max-width:600px){.hl table.rs,.hl table.rs tbody{display:block;overflow:visible}.hl table.rs tr:first-child{display:none}.hl table.rs tr{display:block;padding:6px 0;border-top:1px solid var(--line)}.hl table.rs td{display:block;border:0;padding:2px 4px}.hl table.rs td::before{content:attr(data-l) ": ";color:var(--mute);font-size:11px;text-transform:uppercase;letter-spacing:.04em}.hl table.rs td:first-child::before{content:""}}.hl .kk{border-left:4px solid var(--accent);background:var(--well);padding:8px 12px;border-radius:6px;margin:8px 0}.hl ol,.hl ul{margin:.4em 0;padding-left:1.3em}';
  const SHAPE = { sinus: 'Sinus (Wechselstrom)', puls: 'pulsierender Gleichstrom', mix: 'Frequenzgemisch', gleich: 'glatter Gleichstrom' };
  const STEPNAME = { sicht: 'Sichtprüfung', rpe: 'Schutzleiterwiderstand', riso: 'Isolationswiderstand', ipe: 'Schutzleiterstrom oder Berührungsstrom' };
  const STEPLIM = { rpe: { I: 'rpe_5m' }, riso: { I: 'riso_sk1', II: 'riso_sk2', III: 'riso_sk3' }, ipe: { I: 'ipe_sk1', II: 'ber_sk2' } };
  const STEPS = ['sicht', 'rpe', 'riso', 'ipe'];
  const TRY = [
    { ex: 'elx6', rig: 'netz', preset: 'tns-ok' }, { ex: 'elx1', rig: 'koerper', preset: 'trocken-230' }, { ex: 'elx22', rig: 'klassen', preset: 'sk1-fehler' }, { ex: 'elx25', rig: 'klassen', preset: 'ip44-ip65' },
    { ex: 'elx11', rig: 'netz', preset: 'it-fehler1' }, { ex: 'elx6', rig: 'netz', preset: 'tns-ok' }, { ex: 'elx7', rig: 'netz', preset: 'tns-zulang', label: 'Die Leitung ist zu lang' }, { ex: 'elx12', rig: 'schutz', preset: 'b16-ueberlast' },
    { ex: 'elx17', rig: 'rcd', preset: 'taste' }, { ex: 'elx19', rig: 'rcd', preset: 'fehlausloesung', label: 'Ableitströme summieren sich' }, { ex: 'elx26', rig: 'isolation', preset: 'riso-feucht' }, { ex: 'elx27', rig: 'isolation', preset: 'pe-2l-4l', label: '2-Leiter gegen 4-Leiter' },
    { ex: 'elx28', rig: 'isolation', preset: 'y-ableit' }, { ex: 'elx29', rig: 'pruefplatz', preset: 'wasserkocher-ok' }, { ex: 'elx30', rig: 'pruefplatz', preset: 'bohrmaschine-iso', label: 'Bohrmaschine mit Isolationsfehler' }, { ex: 'elx9', rig: 'netz', preset: 'tt-rcd' },
    { ex: 'elx32', rig: 'regeln', preset: 'schaltschrank' }, { ex: 'elx33', rig: 'regeln', preset: 'rettung' }, { tab: 'calc', label: 'Zum Rechner' }
  ];
  const tryBtn = a => '<div class="tryit">' + a.map((i, k) => { const t = TRY[i]; return t ? `<button class="btn${k ? '' : ' pri'}" data-try="${i}">${t.tab ? '🧮' : '▶'} ${esc(t.label || 'Probier es aus')}</button>` : ''; }).join('') + '</div>';
  function steps4(n) { /* Prüfreihenfolge für die Zeichnung aus dem Kern: Schritte von Schutzklasse I */
    const C = CORE(), i1 = C && C.cls && call('cls.info', 'I'), pr = i1 && Array.isArray(i1.pruefung) ? i1.pruefung : STEPS; return pr.map(s => STEPNAME[s] || s);
  }
  function pruefTable() {
    const info = {}; ['I', 'II', 'III'].forEach(k => { info[k] = call('cls.info', k); });
    return TB(['Schritt', 'Schutzklasse I', 'Schutzklasse II', 'Schutzklasse III'], STEPS.map(s => ['<b>' + esc(STEPNAME[s]) + '</b>'].concat(['I', 'II', 'III'].map(k => {
      const pr = info[k] && Array.isArray(info[k].pruefung) ? info[k].pruefung : null;
      if (!pr) return DASH; if (pr.indexOf(s) < 0) return 'entfällt';
      if (s === 'sicht') return 'Mängel suchen'; const id = STEPLIM[s] && STEPLIM[s][k]; return id ? esc(LT(id)) : DASH;
    }))));
  }
  function limitRows() { const C = CORE(), l = C && Array.isArray(C.limits) ? C.limits : []; return l.map(x => ({ id: x.id, text: x.text || '', lt: LT(x.id), status: x.status === 'belegt' ? '✓ belegt' : 'Übungswert (A)', frage: x.frage || DASH })); }
  function limitTableHtml() { const r = limitRows(); if (!r.length) return P('Die Grenzwerte sind nicht geladen (elscore.js fehlt).'); return `<div data-lim="1">` + TB(['Größe', 'Wert im Lab', 'Status', 'Frage'], r.map(x => [esc(x.text), '<b>' + esc(x.lt) + '</b>', esc(x.status), esc(x.frage)])) + '</div>'; }
  function sections(api) {
    const n = nums(), C = CORE(), E = ebenenOf(api), out = [], A = k => (n && n[k]) || null;
    n.sk = { I: call('cls.info', 'I'), II: call('cls.info', 'II'), III: call('cls.info', 'III') };
    n.pruefSchritte = steps4(n);
    const rl = C && C.rules && Array.isArray(C.rules.list) ? C.rules.list : [], al = C && C.aid && Array.isArray(C.aid.list) ? C.aid.list : [];
    n.regelNamen = rl.map(x => x.name); n.aidNamen = al.map(x => x.name);
    const add = (id, title, html, tryIdx) => out.push({ id, title, html: html + (tryIdx && tryIdx.length ? tryBtn(tryIdx) : ''), tryIdx: tryIdx || null });
    const tn = A('tn') || {}, zc = A('zc') || {};
    /* 1 */
    add('ebenen', '1 Gefährdung und Schutzebenen', DRAW.ebenen(api) + P('Strom durch den Körper ist gefährlich, weil er Muskeln und Herz beeinflusst. Damit nichts passiert, schützt eine Anlage in drei <b>Schutzebenen</b>, die sich ergänzen. Jedes Bedienelement im Prüfstand gehört zu einer dieser Ebenen und trägt ihre Farbe:') +
      TB(['Ebene', 'Aufgabe'], ['basis', 'fehler', 'zusatz'].map(k => ['<b>' + esc(E[k].name) + '</b>', esc(E[k].text)])) +
      P('Die Einteilung in drei Ebenen ist eine Lernhilfe dieses Labs; die Zuordnung der Bedienelemente ist ein Übungswert (A), der Ausbilder gleicht sie ab. Der Zusatzschutz in Wohn-Steckdosen ist ein RCD mit dem Nennfehlerstrom ' + esc(LT('idn_zusatz')) + '.') +
      P('Frage dich bei jedem Aufbau: Welche Ebene schützt hier, und was passiert, wenn sie ausfällt? ' + esc(TX('ampelHinweis'))) + P(esc(TX('uebung'))), [0]);
    /* 2 */
    add('koerper', '2 Stromwirkung auf den Körper', DRAW.zonen(n) +
      P('Die Wirkung hängt von der Stromstärke und der Einwirkdauer ab. Das Zonenbild (Wechselstrom 50 Hz) hat vier Zonen: Zone 1 bis ' + esc(mA(zc.z1)) + ' mA (kaum wahrnehmbar), Zone 2 bis ' + esc(mA(zc.z2)) + ' mA (spürbar, Loslassen möglich), Zone 3 bis zur Flimmerkurve (bei ' + esc(ff((zc.t || 1000) / 1000, 0)) + ' s ' + esc(mA(zc.flimmer)) + ' mA: Muskelverkrampfung, Loslassen nicht möglich, Atembeschwerden) und Zone 4 darüber (Herzkammerflimmern möglich, lebensgefährlich).') +
      P('Grenzen im Lab: ' + esc(LT('zonen')) + '. ' + esc(TX('flimmerKurve')) + ' Bei kurzer Einwirkdauer verträgt der Körper mehr: bei ' + esc(ff(100, 0)) + ' ms liegt die Flimmergrenze bei ' + esc(mA((A('zc100') || {}).flimmer)) + ' mA (Übungswert (A)).') +
      TB(['Haut', 'Körperwiderstand R_K (Übungswert (A))'], [['trocken', esc(fe(n.rk_trocken, 'Ω'))], ['feucht', esc(fe(n.rk_feucht, 'Ω'))], ['nass', esc(fe(n.rk_nass, 'Ω'))]]) +
      P('Rechenwert: ' + esc(LT('rk')) + '. ' + esc(TX('rkRechenwert')) + ' ' + esc(TX('rkModell'))) +
      LI(['230 V, trockene Haut: <b>' + esc(FT('koerperStrom', 230, n.rk_trocken, 0)) + '</b>, ' + esc(n.tTr && n.tTr.zoneInfo ? n.tTr.zoneInfo.name : DASH) + ' (Zone ' + esc(n.tTr ? n.tTr.zone : DASH) + ' bei ' + esc(ff(1, 0)) + ' s).', '230 V, nasser Körperwiderstand: <b>' + esc(FT('koerperStrom', 230, n.rk_nass, 0)) + '</b> (Zone ' + esc(n.tNa ? n.tNa.zone : DASH) + ').', '50 V, nasser Körperwiderstand: <b>' + esc(n.t50 ? fe(n.t50.I_K, 'A') : DASH) + '</b> (Zone ' + esc(n.t50 ? n.t50.zone : DASH) + '). ' + esc(TX('ulTrocken'))]) +
      P('Ein Übergangswiderstand R_v (Boden, Schuhe) liegt in Reihe und verkleinert den Strom. Dauernd zulässige Berührungsspannung: Wechselspannung ' + esc(LT('ul_ac')) + ', Gleichspannung ' + esc(LT('ul_dc')) + '. ' + esc(TX('gleichstrom'))), [1]);
    /* 3 */
    add('klassen', '3 Schutzklassen und Symbole', DRAW.klassen(n) + P('Die <b>Schutzklasse</b> sagt, wie ein Gerät gegen elektrischen Schlag geschützt ist. Du erkennst sie am Zeichen auf dem Typenschild:') +
      TB(['Klasse', 'Merkmal', 'Zeichen', 'Bei Körperschluss', 'Beispiele'], ['I', 'II', 'III'].map(k => { const i = n.sk[k] || {}, ef = call('cls.effect', k, 'koerperschluss'); return ['<b>' + esc(i.name || 'Schutzklasse ' + k) + '</b>', esc(i.merkmal || DASH), esc((i.zeichen ? i.zeichen + ' ' : '') + (i.symbol || DASH)), esc(ef && ef.text ? ef.text : DASH), esc(i.beispiel || DASH)]; })) +
      P(esc((n.sk.III && n.sk.III.hinweisPruefung) || '') + ' Der Grenzwert für den Berührungsstrom bei Schutzklasse II ist ' + esc(LT('ber_sk2')) + '. Der Körperschluss ist der Fehler am Gerät; bei Schutzklasse II gibt es keinen Schutzleiter am Gerät, der Fehlerschutz ist die Schutzisolierung.'), [2]);
    /* 4 */
    const ex = k => call('cls.extra', k), exr = ['SELV', 'PELV', 'schutztrennung'].map(ex).filter(x => x && x.ok);
    const ipT = C && C.ip && C.ip.table ? C.ip.table : null;
    add('selv', '4 SELV, PELV, Schutztrennung und Schutzart IP', DRAW.ip(n) +
      (exr.length ? TB(['Maßnahme', 'Erklärung'], exr.map(x => ['<b>' + esc(x.name) + '</b>', esc(x.text)])) : P('Die Erklärungen fehlen im Kern.')) +
      P('Kleinspannung heißt: Wechselspannung ' + esc(LT('ul_ac')) + ' oder Gleichspannung ' + esc(LT('ul_dc')) + '. ' + esc(TX('ulTrocken'))) +
      P('Die <b>Schutzart</b> steht im IP-Code: Die erste Ziffer sagt, wie gut das Gehäuse gegen Fremdkörper und Berühren schützt, die zweite, wie gut gegen Wasser. ' + esc(n.ip44 ? n.ip44.text : DASH) + ' ' + esc(n.ip65 ? n.ip65.text : DASH)) +
      (ipT ? TB(['1. Ziffer', 'Schutz gegen Fremdkörper und Berühren'], (ipT.a || []).map((t, i) => [String(i), esc(t)])) + TB(['2. Ziffer', 'Schutz gegen Wasser'], (ipT.b || []).map((t, i) => [String(i), esc(t)])) + P('Übungswert (A): ' + esc(ipT.hinweis || NORM + '.')) : P('Die IP-Tabelle fehlt im Kern.')), [3]);
    /* 5 */
    const forms = C && Array.isArray(C.grid && C.grid.forms) ? C.grid.forms : [];
    add('netzformen', '5 Netzformen TN-S, TN-C-S, TT, IT', DRAW.netz() + P('Die Buchstaben beschreiben das Netz: Der <b>erste</b> Buchstabe zeigt die Erdung der Quelle (T von „terra“: direkt geerdet, I: isoliert gegen Erde). Der <b>zweite</b> Buchstabe zeigt, wie die Körper der Anlage geerdet sind (T: eigener Erder, N: Verbindung zum Neutralpunkt der Quelle). Der <b>dritte</b> Buchstabe sagt, wie Neutralleiter und Schutzleiter geführt werden (C: gemeinsam als PEN-Leiter, S: getrennt).') +
      (forms.length ? TB(['Netzform', 'Beschreibung', 'Schutzleiter'], forms.map(f => ['<b>' + esc(f.id) + '</b>', esc(f.begriff ? TX('tnCBegriff') || f.text : f.text), esc(f.pe || DASH)])) : P('Die Netzformen fehlen im Kern.')) +
      P('Im TT-System hat die Anlage einen eigenen Erder; die Abschaltung übernimmt meist der RCD. Im IT-System gilt: ' + esc(n.it ? n.it.text : DASH) + ' (Beispiel mit 50 nF Leitungskapazität, Übungswert (A).)') + P('Das Lab rechnet TN-S, TN-C-S, TT und IT. Die Werte der Übungsanlage sind Übungswerte (A).'), [4]);
    /* 6 */
    add('schleife', '6 Fehlerschleife und Abschaltbedingung', DRAW.schleife() +
      P('Bei einem Körperschluss fließt der Fehlerstrom vom Außenleiter über den Körperschluss und den <b>Schutzleiter</b> zurück zur Quelle. Der Widerstand dieser Schleife ist die <b>Schleifenimpedanz</b> Zs. Das Schutzorgan muss den Fehler schnell genug abschalten: Das ist die <b>Abschaltbedingung</b> <b>Zs ≤ U0 / Ia</b>.') +
      P('Rechenweg am Beispiel TN-S, ' + esc(ff(TN.q, 1)) + ' mm², ' + esc(ff(TN.l, 0)) + ' m, LS-B 16 A (Übungswerte (A): Netzimpedanz Zv = ' + esc(fe(n.zv, 'Ω')) + ', F20; ρ = ' + esc(ff(n.rho, 4)) + ' Ω·mm²/m):') +
      OL(['Leiterwiderstand: ' + esc(n.xRl ? n.xRl.text : DASH), 'Schleifenimpedanz (Hin- und Rückleiter): ' + esc(n.xZs ? n.xZs.text : DASH), 'Fehlerstrom: ' + esc(n.xIf ? n.xIf.text : DASH), 'Berührungsspannung: ' + esc(n.xUb ? n.xUb.text : DASH),
        'Auslösestrom des LS-B, sichere Auslösung bei ' + esc(LT('faktor_b')) + ': ' + esc(n.xIa ? n.xIa.text : DASH), 'Größte Schleifenimpedanz: Zs_max = ' + esc(fz(n.zsB)) + ' Ω (' + esc(n.xZm ? n.xZm.text : DASH) + ')', 'Ergebnis: ' + esc(tn.text || DASH)]) +
      P(esc(n.lmax && n.lmax.text ? n.lmax.text : DASH) + ' Die Rechnung ist vereinfacht, ohne Spannungsfaktor, wie in der Prüfung (Übungswert (A), F19).') +
      P('Abschaltzeit im TN-System (230 V): ' + esc(LT('tab_033')) + ' im Endstromkreis bis 32 A und ' + esc(LT('tab_5')) + ' im Verteilerstromkreis. Für TT und IT: ' + esc(LT('tab_tt')) + '.') +
      P('<b>TT-System:</b> ' + esc(n.xTT30 ? n.xTT30.text : DASH) + ' bei 30 mA, ' + esc(n.xTT300 ? n.xTT300.text : DASH) + ' bei 300 mA (R_A ≤ U_L / IΔn, Lehrregel, Übungswert (A), F6).') +
      P('<b>Schutzleiter unterbrochen:</b> ' + esc(n.tnPE ? n.tnPE.text : DASH) + ' ' + esc(TX('zusatzErsetztNicht'))), [5, 6]);
    /* 7 */
    const devs = C && C.prot && Array.isArray(C.prot.devices) ? C.prot.devices.filter(d => d.art === 'ls') : [];
    add('ls', '7 LS-Schalter und Sicherungen', DRAW.ls(n) +
      P('Ein <b>Leitungsschutzschalter</b> (LS) löst bei Überlast thermisch und bei Kurzschluss magnetisch aus. Die Kennlinie ist ein <b>Band</b>: Zwischen der kleinsten und der größten Zeit kann er auslösen; sicher ist erst die obere Grenze.') +
      TB(['Typ', 'Magnetischer Bereich', 'Ia bei In = 16 A', 'Zs_max bei In = 16 A'], devs.map(d => { const k = d.id === 'LS-B' ? 'B' : d.id === 'LS-C' ? 'C' : 'D'; return ['<b>' + esc(d.name || d.id) + '</b>', esc(ff(d.lo, 0) + ' bis ' + ff(d.hi, 0) + ' · In'), esc(fe(n['ia' + k], 'A')), esc(fz(n['zs' + k]) + ' Ω')]; })) +
      P('Bereiche: ' + esc(LT('ls_bcd')) + '; belegt ist nur der Typ B: sichere Auslösung bei ' + esc(LT('faktor_b')) + ' (Zs_max steht in der Tabelle). ' + esc(LT('ls_thermisch'))) +
      LI([esc(n.t145 ? n.t145.text : DASH), esc(n.tUns ? n.tUns.text : DASH), esc(n.tSich ? n.tSich.text : DASH)]) +
      P('<b>Motoranlauf</b> mit dem 6-fachen Nennstrom: ' + esc(n.inB ? n.inB.text : DASH) + ' ' + esc(n.inC ? n.inC.text : DASH)) +
      P('<b>Schmelzsicherung gG:</b> ' + esc(n.tGG ? n.tGG.text : DASH) + ' Das ist ein Lehrmodell (Übungswert (A), F8).') +
      P('<b>Leitungsschutz:</b> Der Nennstrom muss zwischen dem Betriebsstrom und der Strombelastbarkeit der Leitung liegen. ' + esc(n.chk ? n.chk.text : DASH) + ' Strombelastbarkeit Iz (Übungswerte (A), F21, Tabellenbuch maßgeblich): ' + [1.5, 2.5, 4, 6].map(q => esc(ff(q, 1) + ' mm² → ' + fe(n.cable[q], 'A'))).join('; ') + '.') +
      P('<b>Selektivität</b> heißt: Bei einem Fehler löst nur das Schutzorgan aus, das dem Fehler am nächsten liegt; das vorgeschaltete bleibt in Betrieb. Im Lab ist das nur ein Begriff (F26).'), [7]);
    /* 8 */
    const types = C && C.rcd && Array.isArray(C.rcd.types) ? C.rcd.types : [];
    add('rcd', '8 RCD: der Summenstrom', DRAW.rcd() +
      P('Ein <b>RCD</b> (Fehlerstrom-Schutzeinrichtung) vergleicht den Strom, der zum Verbraucher hinfließt, mit dem, der zurückfließt. Fließt ein Teil über den Schutzleiter oder über einen Menschen nach Erde, bleibt eine Differenz: der <b>Differenzstrom</b>. Beispiel: ' + esc(fe(5, 'A')) + ' hin, ' + esc(fe(4.97, 'A')) + ' zurück, Differenzstrom ' + esc(fe(n.sumX, 'A')) + '.') +
      P('Der RCD löst aus, wenn der Differenzstrom den Nennfehlerstrom IΔn erreicht. Bereich: ' + esc(LT('rcd_bereich')) + '; Auslösezeit: ' + esc(LT('rcd_zeit')) + '. Beispiele für IΔn = 30 mA:') +
      LI([n.rTr10, n.rTr20, n.rTr40].map(r => esc(r ? r.text : DASH) + ' (Übungswert (A))')) +
      (types.length ? TB(['Typ', 'Erkennt', 'Stromformen'], types.map(t => ['<b>' + esc(t.name || t.id) + '</b>', esc(t.text || ''), esc((t.shapes || []).map(s => SHAPE[s] || s).join(', '))])) : P('Die RCD-Typen fehlen im Kern.')) +
      P('Beispiel glatter Gleichfehlerstrom: ' + esc(n.rBlind ? n.rBlind.text : DASH) + ' (Lehrmodell, Übungswert (A), F9).') +
      P('<b>Prüftaste:</b> ' + esc(n.tb ? n.tb.text : DASH)) +
      P('<b>Fehlauslösung:</b> Ableitströme mehrerer Geräte addieren sich. Drei Geräte mit je ' + esc(fe(0.003, 'A')) + ': Summe ' + esc(fe(n.leakOk ? n.leakOk.sum / 1000 : NaN, 'A')) + ' = ' + esc(ff(n.leakOk ? n.leakOk.ratio : NaN, 2)) + ' · IΔn. Bei drei Geräten mit je ' + esc(fe(0.005, 'A')) + ': ' + esc(n.leakFa ? n.leakFa.text : DASH)) +
      P('<b>Zusatzschutz:</b> RCD mit ' + esc(LT('idn_zusatz')) + '. ' + esc(TX('rcdVerkuerzt')) + ' ' + esc(TX('zusatzErsetztNicht'))), [8, 9]);
    /* 9 */
    add('iso', '9 Isolationswiderstand und Schutzleiterwiderstand', P('<b>' + esc(TX('isoNurFrei')) + '</b>') + DRAW.iso(n) +
      P('Die Isolation trennt spannungsführende Teile von berührbaren. Durch Feuchte, Schmutz und Alterung entstehen Leckpfade, die <b>parallel</b> liegen: 1/R = Σ 1/R_i (Lehrmodell, die Zahlen sind Übungswerte (A), F28). Beispiel: ' + esc(n.xPar ? n.xPar.text : DASH) + '.') +
      P('Das Prüfgerät legt eine Gleichspannung an, im Lab ' + esc(LT('upruef_iso')) + ', und misst den Strom: ' + esc(n.xIiso ? n.xIiso.text : DASH) + ' (R = U / I). Grenzwerte: Schutzklasse I ' + esc(LT('riso_sk1')) + ', Schutzklasse II ' + esc(LT('riso_sk2')) + ', Schutzklasse III ' + esc(LT('riso_sk3')) + '.') +
      LI(['Neuer, trockener Prüfling (Schutzklasse I): ' + esc(n.isoTr ? fe(n.isoTr.R_gemessen, 'Ω') : DASH) + '.', esc(n.isoFe ? n.isoFe.text : DASH) + ' Die Prüfspannung ist ein Übungswert (A).']) +
      P('Der <b>Schutzleiterwiderstand</b> zeigt, ob der Schutzleiter im Gerät und in der Anschlussleitung durchgehend und niederohmig ist: ' + esc(LT('rpe_5m')) + '. Über 5 m: ' + esc(LT('rpe_zuschlag')) + '. Im Lab gibt es für längere Leitungen kein Urteil.') +
      P('Bei der 2-Leiter-Messung steckt der Kontaktwiderstand der Messspitzen im Ergebnis, bei der 4-Leiter-Messung nicht. Beispiel mit ' + esc(n.p2 ? fe(n.p2.R_Kontakt, 'Ω') : DASH) + ' Kontaktwiderstand (Übungswert (A)): ' + esc(n.p2 ? n.p2.text : DASH) + ' ' + esc(n.p4 ? n.p4.text : DASH)) +
      P('Bei einer Bruchstelle schwankt der Wert, sobald sich die Leitung bewegt: im Beispiel zwischen ' + esc(n.pw ? fe(n.pw.rMin, 'Ω') : DASH) + ' und ' + esc(n.pw ? fe(n.pw.rMax, 'Ω') : DASH) + '.'), [10, 11]);
    /* 10 */
    const G = id => { const g = C && C.glossary && typeof C.glossary.get === 'function' ? call('glossary.get', id) : null; return g && g.text ? g : null; };
    add('ableit', '10 Schutzleiterstrom, Berührungsstrom, Ableitstrom', DRAW.ableit() + LI(['schutzleiterstrom', 'beruehrungsstrom', 'ableitstrom'].map(id => { const g = G(id); return g ? '<b>' + esc(g.term) + ':</b> ' + esc(g.text) : DASH; })) +
      P('Ein <b>Y-Kondensator</b> im Netzteil verbindet den Außenleiter mit dem berührbaren Teil und lässt dadurch einen kleinen Strom fließen: I = 2π · f · C · U. Beispiele bei 230 V und 50 Hz: ' + esc(n.xY22 ? n.xY22.text : DASH) + '; ' + esc(n.xY47 ? n.xY47.text : DASH) + '.') +
      P('Grenzwert Berührungsstrom Schutzklasse II: ' + esc(LT('ber_sk2')) + '. Größte Kapazität bei diesem Grenzstrom: ' + esc(n.xCmax ? n.xCmax.text : DASH) + '.') +
      P('Schutzklasse I: Schutzleiterstrom ' + esc(LT('ipe_sk1')) + ', Berührungsstrom ' + esc(LT('ber_sk1')) + '. Das Messverfahren legt der Ausbilder fest (F3).') +
      P('Gemessen werden diese Ströme unter Spannung: ' + esc(TX('messNurFachkraft')) + ' Im EMV-Lab zeigt der Netzfilter dieselben Y-Kondensatoren und denselben Ableitstrom.'), [12]);
    /* 11 */
    const flt = C && C.device && Array.isArray(C.device.faults) ? C.device.faults : [];
    add('pruefung', '11 Prüfung elektrischer Geräte nach VDE 0701-0702', DRAW.pruef(n) +
      P('Geräte werden in einer festen Reihenfolge geprüft. Norm: VDE 0701-0702 (Bezeichnung der aktuellen Norm bitte prüfen, Übungswert (A), F4); ' + esc(NORM) + '.') + pruefTable() +
      P('Ein Gerät gilt erst als <b>bestanden</b>, wenn alle Schritte durchgeführt und mit dem Grenzwert verglichen sind. Fehlt ein Schritt oder ein Grenzwert, ist das Ergebnis unvollständig, nie bestanden. Grenzwerte mit dem Zeichen „Übungswert (A)“ gleicht der Ausbilder ab.') +
      (flt.length ? TB(['Mangel am Prüfling', 'Zeigt sich in Schritt'], flt.map(f => [esc((C.device.faultName || {})[f] || f), esc(STEPNAME[(C.device.faultStep || {})[f]] || DASH)])) : '') +
      (C && C.protocol && Array.isArray(C.protocol.template) ? P('<b>Prüfprotokoll:</b> Diese Felder gehören hinein.') + TB(['Feld', 'Hinweis'], C.protocol.template.map(f => ['<b>' + esc(f.label) + '</b>' + (f.pflicht ? ' *' : ''), esc(f.hilfe || '')])) + P('* Pflichtfeld. ' + esc(TX('uebungProtokoll'))) : '') +
      P('<b>Nächste Prüfung:</b> ' + esc(TX('betriebLegtFest')) + ' Der Prüfplatz im Lab hat ' + esc(String(C && C.device && Array.isArray(C.device.catalog) ? C.device.catalog.length : DASH)) + ' Prüflinge (Übungswert (A), F14).') +
      P('Messungen unter Spannung: ' + esc(TX('messNurFachkraft'))), [13, 14]);
    /* 12 */
    add('vde0100', '12 VDE 0100 im Überblick', DRAW.leiter() + P('Die Normenreihe VDE 0100 regelt das Errichten von Niederspannungsanlagen; hier stehen nur die Begriffe, ' + esc(NORM) + '. Zahlen stehen in diesem Abschnitt nur in der Tabelle der Grenzwerte.') +
      TB(['Begriff', 'Bedeutung'], ['basis', 'fehler', 'zusatz'].map(k => ['<b>' + esc(E[k].name) + '</b>', esc(E[k].text)])) +
      LI(['<b>Leiterfarben:</b> Der Schutzleiter ist grün-gelb, der Neutralleiter blau; Außenleiter sind braun, schwarz und grau.', '<b>Potentialausgleich:</b> Der Hauptpotentialausgleich verbindet leitfähige Teile wie Wasser- und Heizungsrohre mit dem Schutzleitersystem, damit zwischen ihnen keine gefährliche Spannung entsteht. Der zusätzliche Potentialausgleich ergänzt ihn in besonderen Bereichen.',
        '<b>Bad und feuchte Räume:</b> Es gibt Schutzbereiche mit besonderen Anforderungen an Schutzart und Zusatzschutz; die Einteilung steht in der Norm.']) +
      P('<b>Alle Grenzwerte und Übungswerte des Labs</b> aus einer Tabelle (✓ belegt: Quelle im Prüfungspool oder vom Ausbilder; Übungswert (A): Ausbilder gleicht ab):') + limitTableHtml(), [15]);
    /* 13 */
    add('regeln', '13 Fünf Sicherheitsregeln', `<p class="kk"><b>${esc(KURS())}</b></p>` + DRAW.regeln(n) + P('Bevor jemand an einer Anlage arbeitet, gelten die fünf Sicherheitsregeln, immer in dieser Reihenfolge (Wortlaut wie im Pool, der Ausbilder gleicht ihn mit dem Betrieb ab, F15):') +
      (rl.length ? TB(['Nr.', 'Regel', 'Warum'], rl.map(r => [String(r.nr), '<b>' + esc(r.name) + '</b><br>' + esc(r.text), esc(r.grund)])) : P('Die Sicherheitsregeln fehlen im Kern.')) +
      P('Typischer Fehler: ' + esc(n.regelFalsch || DASH)) + P('Der Spannungsprüfer erscheint im Lab nur als Symbol. Wie du ein Prüfgerät bedienst, lernst du in deiner Unterweisung.') + P(esc(TX('simOnly'))) + `<p class="kk"><b>${esc(KURS())}</b></p>`, [16]);
    /* 14 */
    add('hilfe', '14 Erste Hilfe bei Stromunfall', `<p class="kk"><b>${esc(KURS())}</b></p>` + DRAW.aid(n) + P('Bei einem Stromunfall zählt die Reihenfolge der Rettungskette. Das Lab nennt nur die Reihenfolge, keine Behandlung:') +
      (al.length ? TB(['Nr.', 'Schritt', 'Warum'], al.map(r => [String(r.nr), '<b>' + esc(r.name) + '</b><br>' + esc(r.text), esc(r.grund)])) : P('Die Rettungskette fehlt im Kern.')) +
      P('Typischer Fehler: ' + esc(n.aidFalsch || DASH)) + P('Bei Gleichstrom, Hochspannung und Blitz gilt nur: Fachkraft, Abstand, Notruf.') + P('Ergänzungen deines Betriebs (Ersthelfer, Meldekette) legt dein Betrieb fest; der Ausbilder gleicht den Ablauf ab.') + `<p class="kk"><b>${esc(KURS())}</b></p>`, [17]);
    add('formeln', '15 Formelsammlung', formulaTableHtml(), [18]);
    add('glossar', '16 Glossar', glossaryHtml(), null);
    add('tasten', '17 Tastenkürzel', keysTableHtml(api), null);
    return out;
  }
  /* Tabellen aus Kern und KEYS (nichts davon steht hier von Hand). Die Formel "energie" ist im Kern als "nicht benutzt" markiert und bleibt aus der Sammlung. */
  function formulaRows() { const C = CORE(), f = C && C.formulas; if (!f) return []; const l = typeof f.list === 'function' ? f.list() : Object.keys(f).map(k => f[k]); return (l || []).filter(x => x && x.id && x.id !== 'energie').map(x => ({ id: x.id, name: x.name || x.id, symbol: x.symbol || '', expr: x.expr || '', unit: x.unit || '' })); }
  function formulaTableHtml() { const r = formulaRows(); if (!r.length) return P('Der Rechenkern ist nicht geladen (elscore.js fehlt): Ohne ihn gibt es keine Formelsammlung.'); return P('Alle Formeln des Labs aus einer Tabelle. Im Tab „Rechnen“ setzt du Zahlen ein und siehst den Rechenweg.') + TB(['Größe', 'Formel', 'Einheit'], r.map(x => [esc(x.name), esc(x.expr), esc(x.unit || DASH)])); }
  function glossaryRows() { const C = CORE(), g = C && C.glossary, items = g && Array.isArray(g.items) ? g.items : []; return items.map(x => ({ id: x.id, term: x.term, article: x.article || x.genus || '', symbol: x.symbol || '', unit: x.unit || '', text: x.text || '' })); }
  function glossaryHtml() {
    const r = glossaryRows(), C = CORE(), fo = C && C.glossary && Array.isArray(C.glossary.foreign) ? C.glossary.foreign : []; if (!r.length) return P('Das Glossar ist nicht geladen (elscore.js fehlt).');
    return TB(['Begriff', 'Bedeutung'], r.map(x => [`<b>${esc((x.article ? x.article + ' ' : '') + x.term)}</b>${x.symbol ? ' (' + esc(x.symbol) + (x.unit ? ', ' + esc(x.unit) : '') + ')' : ''}`, esc(x.text)])) + (fo.length ? '<div class="gh" style="padding-left:0">Alte Bezeichnungen</div>' + TB(['Bezeichnung', 'Im Lab heißt es'], fo.map(x => [esc((x.genus ? x.genus + ' ' : '') + x.term), esc(x.text)])) : '');
  }
  function keyRows(api) { const K = (api && api.KEYS) || root.ELS_KEYS || []; return K.map(k => ({ keys: k.keys || [], t: k.t || '' })); }
  function keysTableHtml(api) { const r = keyRows(api); return r.length ? TB(['Taste', 'Wirkung'], r.map(k => [k.keys.map(x => `<code>${esc(x)}</code>`).join(' oder '), esc(k.t)])) + '<p class="hint2">Die Kürzel gelten nicht, solange ein Eingabefeld oder ein Fenster offen ist.</p>' : P('Die Tastenkürzel sind nicht geladen.'); }

  const exampleExists = id => { const d = root.ELS_DATA, a = d && d.examples; return !!(Array.isArray(a) && a.some(x => x && x.id === id)); };
  X.help = X.help || {};
  X.help.render = function (host, api) {
    if (!host) return; api = api || {};
    if (typeof document !== 'undefined' && document.getElementById && !document.getElementById('els-help-css')) { const s = document.createElement('style'); s.id = 'els-help-css'; s.textContent = CSS; document.head.appendChild(s); }
    if (!CORE()) { host.innerHTML = `<div class="card pl"><p class="big">Lernen wird geladen</p><p class="hint2">Der Rechenkern ist nicht geladen (elscore.js fehlt). Ohne ihn gibt es hier keine Zahlen und Tabellen.</p><div class="btns"><button class="btn" data-retry>Erneut prüfen</button></div></div>`; return; }
    const secs = sections(api);
    host.innerHTML = `<div class="card pl"><h4>Lernen</h4><p class="hint2" style="margin:0">Grundlagen der elektrischen Sicherheit, kurz erklärt. Jeder Abschnitt mit Versuch hat einen Knopf „Probier es aus“, der den passenden Prüfstand lädt. Alle Zahlen stammen aus derselben Rechnung wie im Rechner; Übungswerte tragen das Zeichen „Übungswert (A)“. ${esc(TX('simOnly'))}</p></div><div class="hl">` +
      secs.map((s, i) => `<details${i === 0 ? ' open' : ''} data-sec="${esc(s.id)}"><summary>${esc(s.title)}</summary><div class="hb2">${s.html}</div></details>`).join('') + '</div>';
    /* Zähler elslern1 (Abzeichen „Schutzebenen verstanden“): Abschnitt 1 steht beim Aufruf des Tabs offen und wird damit angezeigt */
    try { if (api.stat && secs[0] && /^1/.test(secs[0].title)) api.stat('elslern1', 1, 'max'); } catch (e) { /* Zähler ist freiwillig */ }
    if (!host.addEventListener) return;
    once(host, 'help', 'click', e => {
      const b = e.target && e.target.closest && e.target.closest('[data-try]'); if (!b) return; const t = TRY[+b.dataset.try]; if (!t) return;
      if (t.tab) { if (api.setTab) api.setTab(t.tab); return; }
      let ok = false; if (t.ex && api.loadExample && exampleExists(t.ex)) ok = api.loadExample(t.ex) !== false;
      if (!ok && api.loadRig) api.loadRig({ rig: t.rig, preset: t.preset, controls: t.controls, tab: 'rig', name: 'Probier es aus', toast: 'Geladen: ' + (t.label || t.rig) });
    });
  };
  X.help.fn = { nums, FX, FV, FT, LT, TX, sections, formulaRows, formulaTableHtml, glossaryRows, glossaryHtml, keyRows, keysTableHtml, limitRows, limitTableHtml, pruefTable, svgTextCheck, DRAW, TRY, NORM, SHAPE, STEPNAME, ebenenOf, exampleExists, wrap, stepsSvg, SCALE390 };
  if (typeof module !== 'undefined') module.exports = X.help;
})(typeof window !== 'undefined' ? window : globalThis);
