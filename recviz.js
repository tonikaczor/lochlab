'use strict';
/* Tonfunk Auftrag-und-Recht-Lab: Visualisierungen (window.REC_VIZ bzw. module.exports). Reine Anzeige, inline-SVG, keine Bibliothek, offline.
   KEINE RECHTSBERATUNG: Die Bilder zeigen dieselben Übungswerte und Vereinfachungen wie die Rechner (alle Zahlen kommen aus REC_CORE).
   - vert(p):   Weg zum Vertrag: Zeitstrahl (Bindungsfrist, Bestellung) und Kette Antrag -> Annahme -> Vertrag
   - fall(s):   Rechte des Käufers als Entscheidungsweg (Störung -> Rüge/Verzug -> Nacherfüllung/Nachfrist -> Rechte), erreichte Rechte hervorgehoben
   - frist(p):  Fristen als Zeitstrahl (Beginn, Fristende, Wochenende -> nächster Werktag, Zahlungstag, Skonto-/Zahlungsziel-Zonen)
   - lohn(s):   Vom Brutto zum Netto als gestapelter Balken mit Abzügen
   - beleg(key, order, res): Belegkette als Bahnen (Kunde/Lieferant); die Bahn eines Schritts wird erst nach richtiger Platzierung verraten (Verdeckte-Fehler-Prinzip)
   Farben nur über die CSS-Variablen der Seite. Keine Bewegung. Aufruf-Stellen: recui.js (Hooks). */
(function (root) {
  const fin = Number.isFinite;
  const core = () => root.REC_CORE;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = v => (fin(v) ? String(Math.round(v * 10) / 10) : '0');
  const clip = (s, n) => { s = String(s); return s.length > n ? s.slice(0, Math.max(1, n - 1)) + '…' : s; };
  const W = 340, DAY = 864e5;
  const CSS = `.rv{background:var(--panel2);border:1px solid var(--line);border-radius:12px;padding:10px 10px 8px;margin:8px 0}
.rv h5{margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.07em;color:var(--mute);font-weight:600}
.rv svg{display:block;width:100%;max-width:560px;height:auto;margin:0 auto}
.rv svg text{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;fill:var(--fg);font-size:12px}
.rv .m{fill:var(--mute)!important}.rv .b{font-weight:700}.rv .sm{font-size:10.5px}.rv .ok{fill:var(--ok)!important}.rv .bad{fill:var(--danger)!important}.rv .wn{fill:var(--warn)!important}
.rv .nd{fill:var(--panel);stroke:var(--line);stroke-width:1.3}.rv .nok{fill:var(--panel);stroke:var(--ok);stroke-width:2}.rv .nno{fill:var(--panel);stroke:var(--danger);stroke-width:2}
.rv .noff{fill:none;stroke:var(--mute);stroke-width:1.2;stroke-dasharray:3 3}.rv .ngo{fill:var(--panel);stroke:var(--accent);stroke-width:2}.rv .nwt{fill:var(--panel);stroke:var(--warn);stroke-width:2}
.rv .ax{stroke:var(--mute);stroke-width:1.6}.rv .tk{stroke:var(--line);stroke-width:1}.rv .ar{stroke:var(--mute);stroke-width:1.5;fill:none}
.rv .sa{fill:var(--accent);opacity:.35}.rv .so{fill:var(--ok);opacity:.4}.rv .sw{fill:var(--warn);opacity:.4}.rv .sb{fill:var(--danger);opacity:.38}
.rv .da{fill:var(--accent)}.rv .do{fill:var(--ok)}.rv .dw{fill:var(--warn)}.rv .db{fill:var(--danger)}.rv .dm{fill:var(--mute)}
.rv .l1{fill:var(--accent)}.rv .l2{fill:var(--accent);opacity:.7}.rv .l3{fill:var(--accent);opacity:.5}.rv .l4{fill:var(--accent);opacity:.32}.rv .lh{fill:var(--hi)}.rv .ln{fill:var(--ok)}
.rv-note{margin:6px 0 0;font-size:12.5px;color:var(--mute);line-height:1.4}`;
  function css() { try { if (typeof document === 'undefined' || document.getElementById('rvCss')) return; const s = document.createElement('style'); s.id = 'rvCss'; s.textContent = CSS; document.head.appendChild(s); } catch (e) {} }
  css();
  const wrap = (title, svg, note) => `<div class="rv"><h5>${esc(title)}</h5>${svg}${note ? `<p class="rv-note">${esc(note)}</p>` : ''}</div>`;
  const svgOf = (h, label, body) => `<svg viewBox="0 0 ${W} ${f(h)}" role="img" aria-label="${esc(label)}">${body}</svg>`;

  /* ---------- Zeitstrahl ---------- */
  /* segs: [{a,b,cls('sa'|'so'|'sw'|'sb'),label}], marks: [{t,label,sub,cls('da'|'do'|'dw'|'db'|'dm')}] (Datumswerte in ms); null bei ungültigen Werten */
  function timeline(segs, marks, aria) {
    const ts = []; segs.forEach(s => { ts.push(s.a, s.b); }); marks.forEach(m => ts.push(m.t));
    if (!ts.length || !ts.every(fin)) return null;
    let lo = Math.min.apply(null, ts), hi = Math.max.apply(null, ts); if (hi - lo < DAY) hi = lo + DAY;
    const pad = (hi - lo) * 0.05, a0 = lo - pad, span = hi + pad - a0, X0 = 16, X1 = W - 16, x = t => X0 + (t - a0) / span * (X1 - X0);
    const R = core(), up = [], dn = [];
    const place = (lanes, x0, x1) => { for (let l = 0; l < 3; l++) { if (!lanes[l] || lanes[l] < x0 - 4) { lanes[l] = x1; return l; } } return 2; };
    const items = marks.map((m, i) => {
      const lines = [m.label, m.sub].filter(Boolean), w = Math.max.apply(null, lines.map(s => s.length)) * 5.4 + 6, cx = x(m.t);
      let anchor = 'middle', x0 = cx - w / 2, x1 = cx + w / 2; if (x0 < 4) { anchor = 'start'; x0 = Math.max(4, cx - 6); x1 = x0 + w; } else if (x1 > W - 4) { anchor = 'end'; x1 = Math.min(W - 4, cx + 6); x0 = x1 - w; }
      return { m, i, lines, cx, anchor, x0, x1 };
    }).sort((p, q) => p.m.t - q.m.t);
    items.forEach((it, k) => { it.side = k % 2 === 0 ? 'up' : 'dn'; it.lane = place(it.side === 'up' ? up : dn, it.x0, it.x1); });
    const nu = Math.max(1, up.length), nd = dn.length, LH = 30, topH = nu * LH + 8, axisY = topH + 14, tickY = axisY + 26, botH = (nd ? nd * LH : 0);
    let s = '';
    segs.forEach(sg => { const xa = x(sg.a), xb = x(sg.b); s += `<rect class="${sg.cls}" x="${f(Math.min(xa, xb))}" y="${f(axisY - 7)}" width="${f(Math.max(2, Math.abs(xb - xa)))}" height="14" rx="3"/>`; if (sg.label && Math.abs(xb - xa) > sg.label.length * 5.4) s += `<text class="sm" x="${f((xa + xb) / 2)}" y="${f(axisY + 3.5)}" text-anchor="middle">${esc(sg.label)}</text>`; });
    s += `<line class="ax" x1="${X0}" y1="${f(axisY)}" x2="${X1}" y2="${f(axisY)}"/>`;
    /* Teilstriche: Monatsanfänge bei kurzer Spanne, sonst Jahresanfänge */
    const y0 = R.ymd(a0), ticks = []; const long = span > 500 * DAY;
    for (let yy = y0.y, c = 0; c < 80; c++) {
      if (long) { const t = R.mk(yy + c, 1, 1); if (t > a0 + span) break; if (t >= a0) ticks.push([t, String(yy + c)]); }
      else { const mm = y0.m - 1 + c, t = R.mk(yy + Math.floor(mm / 12), (mm % 12 + 12) % 12 + 1, 1); if (t > a0 + span) break; if (t >= a0) ticks.push([t, ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'][R.ymd(t).m - 1]]); }
    }
    const step = Math.max(1, Math.ceil(ticks.length / 9)); let lastTx = -99;
    ticks.forEach((tk, k) => { const tx = x(tk[0]); s += `<line class="tk" x1="${f(tx)}" y1="${f(axisY - 5)}" x2="${f(tx)}" y2="${f(axisY + 5)}"/>`; if (k % step === 0 && tx - lastTx > 22) { s += `<text class="m sm" x="${f(tx)}" y="${f(tickY - 6)}" text-anchor="middle">${esc(tk[1])}</text>`; lastTx = tx; } });
    items.forEach(it => {
      const ly = it.side === 'up' ? axisY - 12 - it.lane * LH : axisY + 34 + it.lane * LH, y1 = it.side === 'up' ? ly + 2 : axisY + 8;
      const tx = it.anchor === 'middle' ? it.cx : it.anchor === 'start' ? it.x0 : it.x1;
      s += `<line class="tk" x1="${f(it.cx)}" y1="${f(axisY)}" x2="${f(it.cx)}" y2="${f(it.side === 'up' ? ly + 1 : ly - 11)}" stroke-dasharray="2 2"/><circle class="${it.m.cls}" cx="${f(it.cx)}" cy="${f(axisY)}" r="5.5"/>`;
      it.lines.forEach((ln, k) => { s += `<text class="${k === 0 ? 'b sm' : 'sm m'}" x="${f(tx)}" y="${f((it.side === 'up' ? ly - (it.lines.length - 1 - k) * 12 : ly + k * 12))}" text-anchor="${it.anchor}">${esc(ln)}</text>`; });
    });
    const h = axisY + 34 + botH + (nd ? 4 : -10);
    return svgOf(h, aria, s);
  }

  /* ---------- Vertrag ---------- */
  function vert(p) {
    try {
      const C = core(); if (!C || !p) return ''; css();
      const bis = C.parseDate(p.bis), best = C.parseDate(p.best), hasB = String(p.best || '').trim() !== '';
      if (hasB && !fin(best)) return ''; if (p.angebot === 'bindend' && !fin(bis)) return '';
      const v = C.kaufvertrag({ angebot: p.angebot, gueltigBis: bis, bestellung: fin(best) ? best : null, abweichend: p.abw === 'ja', ab: p.ab === 'keine' ? null : p.ab });
      let tl = '';
      if (p.angebot === 'bindend' && fin(bis)) {
        const lo = Math.min(bis, fin(best) ? best : bis) - 21 * DAY, ok = fin(best) && best <= bis;
        const segs = [{ a: lo, b: bis, cls: 'sa', label: 'Angebot bindet' }], marks = [{ t: bis, label: 'gültig bis', sub: C.fmtDate(bis), cls: 'da' }];
        if (fin(best)) marks.push({ t: best, label: 'Bestellung', sub: C.fmtDate(best) + (ok ? '' : ' (zu spät)'), cls: ok ? 'do' : 'db' });
        tl = timeline(segs, marks, 'Zeitstrahl: Angebot gültig bis ' + C.fmtDate(bis) + (fin(best) ? ', Bestellung am ' + C.fmtDate(best) : '')) || '';
      }
      /* Kette Antrag -> Annahme -> Vertrag (genau wie C.kaufvertrag entscheidet) */
      const code = v.code, A = {
        bestellung: ['Angebot (Lieferant)', 'Bestellung (Kunde)', true], ab: ['Bestellung (Kunde)', 'Auftragsbestätigung', true],
        'wartet-lieferant': ['Bestellung (Kunde)', 'Annahme fehlt noch', false], 'wartet-kunde': ['Auftragsbestätigung', 'Zustimmung des Kunden fehlt', false],
        'kein-antrag': ['kein Antrag', '–', false]
      }[code] || ['–', '–', false];
      const nx = [{ t: 'Antrag', s: A[0], st: code === 'kein-antrag' ? 'noff' : 'ngo' }, { t: 'Annahme', s: A[1], st: A[2] ? 'nok' : (code === 'kein-antrag' ? 'noff' : 'nwt') }, { t: 'Vertrag', s: A[2] ? 'kommt zustande' : 'noch nicht', st: A[2] ? 'nok' : 'noff' }];
      let s = '', bw = 98;
      nx.forEach((n, i) => { const bx = 8 + i * (bw + 13); s += `<rect class="${n.st}" x="${bx}" y="6" width="${bw}" height="48" rx="8"/><text class="b" x="${bx + bw / 2}" y="24" text-anchor="middle">${esc(n.t)}</text><text class="sm m" x="${bx + bw / 2}" y="42" text-anchor="middle">${esc(clip(n.s, 19))}</text>`; if (i < 2) s += `<path class="ar" d="M${bx + bw + 1} 30 h9 m-4 -4 l4 4 l-4 4"/>`; });
      return wrap('Weg zum Vertrag', (tl || '') + svgOf(60, 'Kette: Antrag, Annahme, Vertrag', s), 'Ein Vertrag braucht zwei übereinstimmende Willenserklärungen: Antrag und Annahme. Grün: erfüllt, gelb: es fehlt noch etwas, gestrichelt: nicht vorhanden.');
    } catch (e) { return ''; }
  }

  /* ---------- Fall-Prüfer ---------- */
  function box(x, y, w, h, st, title, sub) {
    const mark = st === 'nok' ? '✓' : st === 'nno' ? '✗' : st === 'nwt' ? '…' : '';
    return `<rect class="${st}" x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="8"/><text class="b sm${st === 'noff' ? ' m' : ''}" x="${f(x + w / 2)}" y="${f(y + (sub ? h / 2 - 2 : h / 2 + 4))}" text-anchor="middle">${esc(title)}${mark ? ' ' + mark : ''}</text>${sub ? `<text class="sm m" x="${f(x + w / 2)}" y="${f(y + h / 2 + 11)}" text-anchor="middle">${esc(clip(sub, Math.floor(w / 5.3)))}</text>` : ''}`;
  }
  function fall(s) {
    try {
      const C = core(); if (!C || !s) return ''; css(); const yn = v => v === 'ja';
      const r = C.kaeuferRechte({ stoerung: s.stoerung, handel: yn(s.handel), mangelart: s.mangelart, ruege: yn(s.ruege), nacherf: s.nacherf, erheblich: yn(s.erheblich), verschulden: yn(s.verschulden), kalender: yn(s.kalender), mahnung: yn(s.mahnung), fix: yn(s.fix), nachfrist: yn(s.nachfrist) });
      const has = k => r.rights.indexOf(k) >= 0, blocked = !!r.blocked; let y = 4, o = '';
      const down = yy => `<path class="ar" d="M${W / 2} ${f(yy)} v8 m-4 -4 l4 4 l4 -4"/>`;
      const single = (st, t, sub) => { o += box(20, y, W - 40, 34, st, t, sub); y += 34; };
      const row = (items) => { const n = items.length, gap = 8, w = (W - 16 - gap * (n - 1)) / n; items.forEach((it, i) => { o += box(8 + i * (w + gap), y, w, 40, it[0], it[1], it[2]); }); y += 40; };
      const gap = () => { o += down(y); y += 14; };
      if (s.stoerung === 'mangel') {
        single('ngo', 'Mangelhafte Lieferung', yn(s.handel) ? 'Handelskauf' : 'kein Handelskauf (keine Rügepflicht)');
        if (yn(s.handel)) { gap(); single(blocked ? 'nno' : 'nok', 'Rüge rechtzeitig?', blocked ? 'zu spät: Ware gilt als genehmigt' : s.mangelart === 'arglist' ? 'Rügepflicht entfällt (arglistig)' : 'ja'); }
        gap(); single(blocked ? 'noff' : 'nok', 'Nacherfüllung', blocked ? 'Rechte entfallen' : 'hat Vorrang');
        gap(); const failed = has('minderung'); single(blocked ? 'noff' : failed ? 'nok' : 'nwt', 'Nacherfüllung gescheitert?', blocked ? '' : failed ? 'ja: weitere Rechte' : 'noch offen: Frist setzen');
        gap(); row([[has('ruecktritt') ? 'nok' : 'noff', 'Rücktritt', failed && !has('ruecktritt') ? 'unerheblicher Mangel' : ''], [has('minderung') ? 'nok' : 'noff', 'Minderung', ''], [has('schadensersatz') ? 'nok' : 'noff', 'Schadensersatz', failed && !has('schadensersatz') ? 'ohne Verschulden nicht' : '']]);
      } else {
        single('ngo', 'Lieferverzug', 'Lieferung ist nicht rechtzeitig da');
        gap(); single(blocked ? 'nno' : 'nok', 'Verzug eingetreten?', blocked ? 'noch nicht: erst mahnen' : 'ja (Termin, Mahnung oder Fixgeschäft)');
        gap(); row([[blocked ? 'noff' : 'nok', 'Lieferung verlangen', ''], [has('verzugsschaden') ? 'nok' : 'noff', 'Verzugsschaden', !blocked && !has('verzugsschaden') ? 'ohne Verschulden nicht' : '']]);
        gap(); const nf = has('ruecktritt'); single(blocked ? 'noff' : nf ? 'nok' : 'nwt', 'Nachfrist erfolglos oder Fixgeschäft?', blocked ? '' : nf ? 'ja: weitere Rechte' : 'noch nicht: Nachfrist setzen');
        gap(); row([[nf ? 'nok' : 'noff', 'Rücktritt', ''], [has('schadensersatz') ? 'nok' : 'noff', 'Schadensersatz', nf && !has('schadensersatz') ? 'ohne Verschulden nicht' : '']]);
      }
      return wrap('Entscheidungsweg des Käufers', svgOf(y + 6, 'Entscheidungsweg: Welche Rechte hat der Käufer? ' + r.rights.map(k => C.RECHTE[k].n).join(', '), o), 'Grün: Voraussetzung erfüllt bzw. Recht vorhanden, rot: Weg versperrt, gelb: noch offen, gestrichelt: nicht erreicht. Vereinfachtes Schema für Geschäfte zwischen Unternehmen.');
    } catch (e) { return ''; }
  }

  /* ---------- Fristen ---------- */
  function frist(p) {
    try {
      const C = core(); if (!C || !p) return ''; css(); const P = C.parseDe, d1 = C.parseDate(p.d1), d2 = C.parseDate(p.d2), has2 = String(p.d2 || '').trim() !== '';
      if (!fin(d1)) return ''; if (has2 && !fin(d2)) return '';
      const D = C.fmtDate, segs = [], marks = []; let note = '', ttl = 'Zeitstrahl';
      const endMarks = (e, label, cls) => { marks.push({ t: e, label, sub: C.fmtDateWd(e), cls }); if (C.isWeekend(e)) { const w = C.nextWerktag(e); marks.push({ t: w, label: 'nächster Werktag', sub: C.fmtDateWd(w), cls: 'dw' }); segs.push({ a: e, b: w, cls: 'sw', label: '' }); } };
      switch (p.mode) {
        case 'verj': {
          const y = C.ymd(d1).y, e = C.verjaehrungEnde(d1), j = C.mk(y, 12, 31);
          segs.push({ a: j, b: e, cls: 'sa', label: '3 Jahre' }); marks.push({ t: d1, label: 'Anspruch entsteht', sub: D(d1), cls: 'dm' }, { t: j, label: 'Beginn der Frist', sub: '31.12.' + y, cls: 'da' }); endMarks(e, 'Verjährung', 'db'); note = 'Die Frist beginnt mit dem Ende des Jahres und läuft drei Jahre.'; break;
        }
        case 'gew': { const e = C.gewaehrleistungEnde(d1, 2); segs.push({ a: d1, b: e, cls: 'sa', label: '2 Jahre' }); marks.push({ t: d1, label: 'Ablieferung', sub: D(d1), cls: 'dm' }); endMarks(e, 'Ende Gewährleistung', 'db'); break; }
        case 'ruege': {
          const t = fin(P(p.tage)) && P(p.tage) >= 0 ? P(p.tage) : C.RUEGE_TAGE, e = C.ruegeEnde(d1, t); segs.push({ a: d1, b: e, cls: 'so', label: Math.round(t) + ' Tage' }); marks.push({ t: d1, label: 'Ablieferung/Entdeckung', sub: D(d1), cls: 'dm' }); endMarks(e, 'Frist für die Rüge', 'dw');
          if (has2) { const ok = C.ruegeRechtzeitig(d1, d2, t); marks.push({ t: d2, label: ok ? 'Rüge (rechtzeitig)' : 'Rüge (zu spät)', sub: D(d2), cls: ok ? 'do' : 'db' }); } break;
        }
        case 'verzug': {
          const e = C.verzugFristEnde(d1), b = C.verzugBeginn(d1); segs.push({ a: d1, b: e, cls: 'so', label: '30 Tage' }); marks.push({ t: d1, label: 'Rechnung zugegangen', sub: D(d1), cls: 'dm' }, { t: e, label: 'Frist endet', sub: D(e), cls: 'dw' });
          if (has2 && d2 > e) { segs.push({ a: e, b: d2, cls: 'sb', label: 'Zinstage' }); marks.push({ t: d2, label: 'Zahlung', sub: D(d2) + ' (verspätet)', cls: 'db' }); } else if (has2) marks.push({ t: d2, label: 'Zahlung', sub: D(d2), cls: 'do' });
          else marks.push({ t: b, label: 'Verzug beginnt', sub: D(b), cls: 'db' }); note = 'Grün: Zahlungsfrist, rot: Zeit, für die Verzugszinsen anfallen.'; break;
        }
        case 'skonto': {
          const sk = P(p.sk), zl = P(p.ziel); if (!(sk > 0) || !(zl > sk)) return '';
          const e1 = C.skontoEnde(d1, sk), e2 = C.skontoEnde(d1, zl); segs.push({ a: d1, b: e1, cls: 'so', label: 'Skonto' }, { a: e1, b: e2, cls: 'sw', label: 'voller Betrag' });
          marks.push({ t: d1, label: 'Rechnungsdatum', sub: D(d1), cls: 'dm' }, { t: e1, label: 'Skontofrist endet', sub: D(e1), cls: 'do' }, { t: e2, label: 'Zahlungsziel', sub: D(e2), cls: 'dw' });
          if (has2) { const a = C.zahlungsArt(d1, d2, sk, zl); if (!a) return ''; marks.push({ t: d2, label: 'Zahlung', sub: D(d2), cls: a === 'skonto' ? 'do' : a === 'netto' ? 'dw' : 'db' }); }
          note = 'Grün: Zahlung mit Skonto möglich, gelb: voller Betrag, danach überfällig.'; break;
        }
        case 'kuend': {
          const j = P(p.jahre); if (p.probe !== 'ja' && !(j >= 0)) return ''; const e = C.kuendEnde(d1, j, p.probe === 'ja'); if (!fin(e)) return '';
          segs.push({ a: d1, b: e, cls: 'sa', label: 'Frist' }); marks.push({ t: d1, label: 'Kündigung zugegangen', sub: D(d1), cls: 'dm' }); endMarks(e, 'Ende des Arbeitsverhältnisses', 'db'); break;
        }
        default: {
          const n = P(p.n); if (!fin(n) || n < 0 || n > 100000) return '';
          const e = p.einheit === 'tage' ? C.addDays(d1, n) : p.einheit === 'wochen' ? C.addDays(d1, 7 * n) : p.einheit === 'monate' ? C.addMonths(d1, n) : C.addYears(d1, n); if (!fin(e)) return '';
          segs.push({ a: d1, b: e, cls: 'sa', label: '' }); marks.push({ t: d1, label: 'Start', sub: D(d1), cls: 'dm' }); endMarks(e, 'Fristende', 'db');
        }
      }
      const svg = timeline(segs, marks, ttl + ': ' + marks.map(m => m.label + ' ' + (m.sub || '')).join('; ')); if (!svg) return '';
      return wrap('Die Frist auf dem Zeitstrahl', svg, (note ? note + ' ' : '') + 'Fällt ein Fristende auf Samstag oder Sonntag, rückt es auf den nächsten Werktag (Feiertage sind nicht eingebaut).');
    } catch (e) { return ''; }
  }

  /* ---------- Brutto-Netto ---------- */
  function lohn(s) {
    try {
      const C = core(); if (!C || !s) return ''; css();
      const b = C.parseDe(s.brutto), L = { lst: C.parseDe(s.lst), rv: C.parseDe(s.rv), kv: C.parseDe(s.kv), pv: C.parseDe(s.pv), av: C.parseDe(s.av) };
      if (!(b > 0) || !Object.keys(L).every(k => fin(L[k]) && L[k] >= 0 && L[k] <= 60)) return '';
      const a = C.abrechnung(b, L); if (!a || !fin(a.netto) || a.netto < 0) return '';
      const parts = [['Netto', a.netto, 'ln'], ['Lohnsteuer', a.lst, 'lh'], ['Rentenvers.', a.rv, 'l1'], ['Krankenvers.', a.kv, 'l2'], ['Pflegevers.', a.pv, 'l3'], ['Arbeitslosenvers.', a.av, 'l4']];
      let x = 8, s2 = `<text class="b" x="8" y="14">Brutto ${esc(C.eur(a.brutto))} = 100 %</text>`; const bw = W - 16;
      parts.forEach(pt => { const w = bw * pt[1] / a.brutto; if (w > 0) { s2 += `<rect class="${pt[2]}" x="${f(x)}" y="22" width="${f(Math.max(0.5, w))}" height="26"/>`; } x += w; });
      s2 += `<rect x="8" y="22" width="${bw}" height="26" rx="4" fill="none" stroke="var(--line)" stroke-width="1.2"/>`;
      parts.forEach((pt, i) => { const yy = 66 + i * 20; s2 += `<rect class="${pt[2]}" x="10" y="${yy - 10}" width="12" height="12" rx="3"/><text class="sm" x="30" y="${yy}">${esc(pt[0])}</text><text class="sm" x="${W - 8}" y="${yy}" text-anchor="end">${esc(C.eur(pt[1]))}  (${esc(C.fmtN(pt[1] / a.brutto * 100, 1, true))} %)</text>`; });
      return wrap('Wohin geht das Brutto?', svgOf(66 + parts.length * 20, 'Balken: Brutto ' + C.eur(a.brutto) + ', Netto ' + C.eur(a.netto) + ', Abzüge ' + C.eur(a.summe), s2), 'Der Balken ist das Bruttogehalt. Netto kommt aufs Konto, der Rest geht an Finanzamt (Lohnsteuer) und Sozialversicherung. Der Arbeitgeberanteil ist hier nicht enthalten.');
    } catch (e) { return ''; }
  }

  /* ---------- Belegkette (Bahnen) ---------- */
  function beleg(key, order, res) {
    try {
      const C = core(); if (!C || !C.ORDER[key]) return ''; css(); const set = C.ORDER[key];
      if (!Array.isArray(order) || order.length !== set.items.length || order.some(i => !set.items[i])) return '';
      const lanes = []; set.items.forEach(it => { if (lanes.indexOf(it.wer) < 0) lanes.push(it.wer); }); lanes.sort();
      const L = lanes.length, laneX = i => (L === 1 ? W / 2 : 8 + 75 + i * ((W - 16 - 150) / (L - 1))), RH = 38, top = 28;
      let s = '', prev = null;
      if (L > 1) lanes.forEach((l, i) => { s += `<text class="b sm m" x="${f(laneX(i))}" y="14" text-anchor="middle">${esc(l)}</text><line class="tk" x1="${f(laneX(i))}" y1="20" x2="${f(laneX(i))}" y2="${top + set.items.length * RH}" stroke-dasharray="2 4"/>`; });
      order.forEach((idx, pos) => {
        const it = set.items[idx], known = !!(res && res[pos]), cx = known ? laneX(lanes.indexOf(it.wer)) : W / 2, y = top + pos * RH, w = 138;
        if (prev) s += `<path class="ar" d="M${f(prev.cx)} ${f(prev.y + 26)} L${f(cx)} ${f(y + 2)} m-3 -5 l3 5 l3 -5"/>`;
        s += `<rect class="${known ? 'nok' : 'nd'}" x="${f(cx - w / 2)}" y="${f(y)}" width="${w}" height="26" rx="7"/><text class="b sm" x="${f(cx)}" y="${f(y + 17)}" text-anchor="middle">${pos + 1}. ${esc(clip(it.k, 17))}</text>`;
        prev = { cx, y };
      });
      const hasRes = res && res.some(Boolean);
      return wrap('Belegfluss', svgOf(top + set.items.length * RH + 4, 'Belegfluss in deiner aktuellen Reihenfolge', s), hasRes ? 'Die Bahn zeigt, wer den Beleg ausstellt. Richtig platzierte Schritte (grün) rücken in ihre Bahn.' : 'So sieht deine aktuelle Reihenfolge aus. Nach „Prüfen“ rücken richtig platzierte Schritte in die Bahn dessen, der den Beleg ausstellt.');
    } catch (e) { return ''; }
  }

  const API = { vert, fall, frist, lohn, beleg, timeline };
  root.REC_VIZ = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  /* Die Oberfläche (recui.js) wird vor dieser Datei geladen und hat den ersten Reiter schon gezeichnet: einmal neu zeichnen, damit die Bilder erscheinen. */
  if (typeof document !== 'undefined') { try { const b = document.querySelector('#tabs .tab.on'); if (b) b.click(); } catch (e) {} }
})(typeof window !== 'undefined' ? window : globalThis);
