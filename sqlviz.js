'use strict';
/* Tonfunk Datenbank-Lab (SQL): Visualisierungen (window.SQL_VIZ bzw. module.exports). Reine Anzeige, inline-SVG, keine Bibliothek, offline.
   Zeigt Zusammenhänge, keine Aufgabenlösungen:
   - html(sql, db, opt): "Der Weg der Zeilen" zu einer eingegebenen Abfrage (FROM/JOIN -> WHERE -> GROUP BY -> HAVING -> Ergebnis, mit echten Zeilenzahlen
     aus dem Interpreter), JOIN-Zuordnung (Zeile links <-> Zeile rechts) und bei UPDATE/DELETE die betroffenen Zeilen.
     Es wird nur die Abfrage visualisiert, die die Lernenden selbst geschrieben haben (oder ein Beispiel); die Aufgabenlösung kommt nie vor.
     In Aufgaben (opt.task) ist die Anzeige im Prüfmodus abgeschaltet und es gibt keine Darstellung zu UPDATE/DELETE (dort würde sie ein fehlendes WHERE verraten).
   - mount(el, db): "Tabellen als Raster" und Beziehungs-Explorer (Zeile wählen: Eltern- und Kindzeilen über Fremdschlüssel).
   Farben nur über die CSS-Variablen der Seite (Hell/Dunkel/Auto). Keine Bewegung. Aufruf-Stellen: sqlui.js (Hooks). */
(function (root) {
  const fin = Number.isFinite;
  const core = () => root.SQL_CORE, dat = () => root.SQL_DATA;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = v => (fin(v) ? String(Math.round(v * 10) / 10) : '0');
  const clip = (s, n) => { s = String(s); return s.length > n ? s.slice(0, Math.max(1, n - 1)) + '…' : s; };
  const show = v => (v === null || v === undefined ? 'NULL' : core().fmtVal(v));
  const W = 340;

  /* ---------- Stil (nur Variablen der Seite) ---------- */
  const CSS = `.vq{background:var(--panel2);border:1px solid var(--line);border-radius:12px;padding:10px 10px 8px;margin:8px 0}
.vq h5{margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.07em;color:var(--mute);font-weight:600}
.vq svg{display:block;width:100%;max-width:560px;height:auto;margin:0 auto}
.vq svg text{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;fill:var(--fg);font-size:12px}
.vq .m{fill:var(--mute)!important}.vq .b{font-weight:700}.vq .sm{font-size:10.5px}
.vq .ck{fill:var(--accent)}.vq .cd{fill:none;stroke:var(--mute);stroke-width:1.2;stroke-dasharray:2 2}.vq .ch{fill:var(--hi)}.vq .co{fill:var(--ok)}
.vq .ln{stroke:var(--accent);stroke-width:1.6;fill:none}.vq .ar{stroke:var(--mute);stroke-width:1.4;fill:none}
.vq .bx{fill:var(--panel);stroke:var(--line);stroke-width:1.2}.vq .bxa{fill:var(--panel);stroke:var(--accent);stroke-width:1.6}
.vq .pk{fill:var(--warn)!important;font-weight:700}.vq .fk{fill:var(--accent)!important}.vq .nl{fill:var(--mute)!important;font-style:italic}
.vq .sel rect.cell{fill:var(--work);stroke:var(--accent)}
.vq .cell{fill:var(--panel);stroke:var(--line);stroke-width:1}.vq .hd{fill:var(--accent-bg)}.vq .hdt{fill:#fff!important;font-weight:700}
.vq .warn{fill:var(--warn)!important}.vq .okt{fill:var(--ok)!important}.vq .hit{fill:transparent;cursor:pointer}
.vq .sel2{fill:var(--work);stroke:var(--accent);stroke-width:1.4}
.vq-ctl{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 8px}.vq-ctl label{flex:1 1 140px;display:block}.vq-ctl label span{display:block;font-size:12px;color:var(--mute);margin-bottom:3px}
.vq-sc{max-height:340px;overflow:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--line);border-radius:8px;background:var(--panel)}
.vq-sc svg{max-width:none;width:100%;min-width:300px}
.vq-note{margin:6px 0 0;font-size:12.5px;color:var(--mute);line-height:1.4}`;
  function css() { try { if (typeof document === 'undefined' || document.getElementById('vqCss')) return; const s = document.createElement('style'); s.id = 'vqCss'; s.textContent = CSS; document.head.appendChild(s); } catch (e) {} }
  css();

  /* ---------- Hilfen zum Zerlegen von SQL (mit dem Tokenizer des Interpreters) ---------- */
  function statements(sql) {
    let toks; try { toks = core().tokenize(String(sql)); } catch (e) { return []; }
    toks = toks.filter(t => t.t !== 'eof'); const out = []; let cur = [];
    toks.forEach(t => { if (t.t === 'p' && t.v === ';') { if (cur.length) out.push(cur); cur = []; } else cur.push(t); });
    if (cur.length) out.push(cur);
    return out.map(ts => ({ toks: ts, sql: String(sql), text: String(sql).slice(ts[0].pos, ts[ts.length - 1].end), kw: String(ts[0].v).toUpperCase() }));
  }
  const MARKS = ['SELECT', 'FROM', 'WHERE', 'GROUP', 'HAVING', 'ORDER', 'LIMIT', 'UNION'];
  function clauses(st) {
    const ts = st.toks; let d = 0; const idx = {};
    ts.forEach((t, i) => {
      if (t.t === 'p' && t.v === '(') d++; else if (t.t === 'p' && t.v === ')') d--;
      else if (d === 0 && t.t === 'id') { const u = String(t.v).toUpperCase(); if (MARKS.indexOf(u) >= 0 && !(u in idx)) idx[u] = i; }
    });
    if ('UNION' in idx || idx.SELECT !== 0) return null;
    const order = Object.keys(idx).map(k => [k, idx[k]]).sort((a, b) => a[1] - b[1]), cl = { ts, idx };
    const txt = (k, skipBy) => {
      if (!(k in idx)) return null; const i = idx[k], nx = order.find(o => o[1] > i), a = skipBy ? ts[i + 1] : ts[i], endTok = nx ? ts[nx[1]] : null;
      if (!a) return null; return st.sql.slice(a.end, endTok ? endTok.pos : ts[ts.length - 1].end).trim();
    };
    cl.sel = txt('SELECT'); cl.from = txt('FROM'); cl.where = txt('WHERE'); cl.group = txt('GROUP', true); cl.having = txt('HAVING'); cl.limit = txt('LIMIT'); cl.hasOrder = 'ORDER' in idx;
    cl.fromRange = 'FROM' in idx ? [idx.FROM + 1, (order.find(o => o[1] > idx.FROM) || [0, ts.length])[1]] : null;
    return cl;
  }
  const JOINKW = ['JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS', 'OUTER', 'ON', 'NATURAL'];
  /* FROM-Teil: { base:{table,alias}, joins:[{kind,table,alias,on,onToks}] } oder null (Unterabfrage o. Ä.) */
  function parseFrom(st, cl) {
    if (!cl.fromRange) return null; const ts = st.toks, b = cl.fromRange[1]; let i = cl.fromRange[0];
    const isKw = t => t && t.t === 'id' && (JOINKW.indexOf(String(t.v).toUpperCase()) >= 0 || MARKS.indexOf(String(t.v).toUpperCase()) >= 0);
    const src = () => {
      const t = ts[i]; if (i >= b || !t || t.t !== 'id' || isKw(t)) return null; const table = t.v; i++; let alias = null;
      if (i < b && ts[i].t === 'id' && String(ts[i].v).toUpperCase() === 'AS') i++;
      if (i < b && ts[i].t === 'id' && !isKw(ts[i])) { alias = ts[i].v; i++; }
      return { table, alias };
    };
    const base = src(); if (!base) return null; const joins = [];
    while (i < b) {
      const t = ts[i]; let kind = 'inner';
      if (t.t === 'p' && t.v === ',') { i++; const s = src(); if (!s) return null; joins.push({ kind: 'cross', table: s.table, alias: s.alias, on: null, onToks: [] }); continue; }
      if (t.t !== 'id') return null;
      for (; i < b && ts[i].t === 'id' && String(ts[i].v).toUpperCase() !== 'JOIN'; i++) {
        const u = String(ts[i].v).toUpperCase(); if (u === 'LEFT') kind = 'left'; else if (u === 'CROSS') kind = 'cross'; else if (u === 'RIGHT' || u === 'FULL' || u === 'NATURAL') return null;
      }
      if (i >= b || String(ts[i].v).toUpperCase() !== 'JOIN') return null; i++;
      const s = src(); if (!s) return null; let on = null, onToks = [];
      if (i < b && ts[i].t === 'id' && String(ts[i].v).toUpperCase() === 'ON') {
        const a = i + 1; let d = 0, j = a;
        for (; j < b; j++) {
          const u = ts[j]; if (u.t === 'p' && u.v === '(') d++; else if (u.t === 'p' && u.v === ')') d--;
          else if (d === 0 && ((u.t === 'p' && u.v === ',') || (u.t === 'id' && ['JOIN', 'INNER', 'LEFT', 'CROSS', 'RIGHT', 'FULL'].indexOf(String(u.v).toUpperCase()) >= 0))) break;
        }
        onToks = ts.slice(a, j); on = onToks.length ? st.sql.slice(onToks[0].pos, onToks[onToks.length - 1].end) : null; i = j;
      }
      joins.push({ kind, table: s.table, alias: s.alias, on, onToks });
    }
    return { base, joins };
  }
  const run = (db, sql) => { try { return core().run(db, sql); } catch (e) { return { ok: false, error: String(e && e.message) }; } };
  const scalar = (db, sql) => { const r = run(db, sql); return r.ok && r.rows.length && fin(r.rows[0][0]) ? r.rows[0][0] : null; };

  /* ---------- Bausteine der Zeichnung ---------- */
  const arrow = (x, y1, y2) => `<path class="ar" d="M${f(x)} ${f(y1)} V${f(y2 - 3)} m-4 -5 l4 5 l4 -5"/>`;
  /* Zeilen als kleine Kästchen; flags (0/1) oder null; cls für gefüllte Kästchen; liefert [svg, Höhe] */
  function chipRows(n, flags, y, cls) {
    const cs = 9, gap = 3, per = Math.floor((W - 16) / (cs + gap)), maxC = per * 3; let s = '', cells = Math.min(n, maxC), bucket = n > maxC ? Math.ceil(n / maxC) : 1;
    cells = Math.ceil(n / bucket);
    for (let i = 0; i < cells; i++) {
      const x = 8 + (i % per) * (cs + gap), yy = y + Math.floor(i / per) * (cs + gap); let kept = 1;
      if (flags) { let k = 0, m = 0; for (let j = i * bucket; j < Math.min(n, (i + 1) * bucket); j++) { m++; k += flags[j] ? 1 : 0; } kept = m ? k / m : 0; }
      if (kept >= 0.5) s += `<rect class="${cls}" x="${f(x)}" y="${f(yy)}" width="${cs}" height="${cs}" rx="2"${kept < 1 ? ' opacity=".55"' : ''}/>`;
      else s += `<rect class="cd" x="${f(x + .6)}" y="${f(yy + .6)}" width="${cs - 1.2}" height="${cs - 1.2}" rx="2"/>`;
    }
    const rows = Math.max(1, Math.ceil(cells / per)); return [s, rows * (cs + gap)];
  }
  function stageSvg(stages) {
    let y = 6, s = '';
    stages.forEach((st, si) => {
      if (si > 0) { s += arrow(W / 2, y - 2, y + 10); y += 12; }
      s += `<text class="b" x="8" y="${f(y + 11)}">${esc(st.label)}</text><text class="b" x="${W - 8}" y="${f(y + 11)}" text-anchor="end">${esc(st.count)}</text>`;
      y += 17;
      if (st.sub) { s += `<text class="m sm" x="8" y="${f(y + 9)}">${esc(clip(st.sub, 60))}</text>`; y += 14; }
      if (st.kind === 'rows') { const r = chipRows(st.n, st.flags, y + 2, st.cls || 'ck'); s += r[0]; y += r[1] + 6; }
      else if (st.kind === 'groups') {
        const mx = Math.max.apply(null, st.items.map(g => g.n).concat([1])), shown = st.items.slice(0, 8);
        shown.forEach((g, i) => { const w = Math.max(6, (W - 90) * g.n / mx); s += `<rect class="${g.keep ? 'ck' : 'cd'}" x="8" y="${f(y + i * 15)}" width="${f(w)}" height="11" rx="3"/><text class="sm" x="${f(14 + w)}" y="${f(y + i * 15 + 9.5)}">${esc(g.n)} Zeile${g.n === 1 ? '' : 'n'}${g.keep ? '' : ' – fällt weg'}</text>`; });
        y += shown.length * 15 + 4; if (st.items.length > shown.length) { s += `<text class="m sm" x="8" y="${f(y + 9)}">… und ${st.items.length - shown.length} weitere Gruppen</text>`; y += 14; }
      }
      if (st.empty) { s += `<text class="m sm" x="8" y="${f(y + 8)}">${esc(st.empty)}</text>`; y += 14; }
    });
    const h = y + 4; return `<svg viewBox="0 0 ${W} ${f(h)}" role="img" aria-label="Der Weg der Zeilen durch die Abfrage">${s}</svg>`;
  }

  /* ---------- SELECT: Weg der Zeilen ---------- */
  function selectViz(st, db) {
    const cl = clauses(st); if (!cl || !cl.from) return '';
    const fromTxt = cl.from; const tot = scalar(db, 'SELECT COUNT(*) FROM ' + fromTxt); if (tot === null) return '';
    const res = run(db, st.text); if (!res.ok) return '';
    const pf = parseFrom(st, cl), stages = []; const nj = pf ? pf.joins.length : 0;
    const tabs = pf ? [pf.base].concat(pf.joins).map(t => t.table).join(' + ') : '';
    stages.push({ kind: 'rows', label: nj ? '1  FROM + JOIN' : '1  FROM', count: tot + ' Zeile' + (tot === 1 ? '' : 'n'), sub: tabs, n: tot, flags: null, cls: 'ck', empty: tot === 0 ? 'keine Zeilen' : '' });
    let kept = tot, step = 2;
    if (cl.where) {
      const r = run(db, 'SELECT CASE WHEN ' + cl.where + ' THEN 1 ELSE 0 END FROM ' + fromTxt);
      if (r.ok && r.rows.length === tot) { const flags = r.rows.map(x => (x[0] === 1 ? 1 : 0)); kept = flags.reduce((a, b) => a + b, 0); stages.push({ kind: 'rows', label: step + '  WHERE', count: kept + ' von ' + tot + ' bleiben', sub: cl.where.replace(/\s+/g, ' '), n: tot, flags, cls: 'ck' }); step++; }
    }
    const aggr = /\b(COUNT|SUM|AVG|MIN|MAX)\s*\(/i.test(cl.sel || '') || !!cl.having;
    if (cl.group || aggr) {
      const base = ' FROM ' + fromTxt + (cl.where ? ' WHERE ' + cl.where : '');
      let sizes = null;
      if (cl.group) { const r = run(db, 'SELECT COUNT(*)' + base + ' GROUP BY ' + cl.group); if (r.ok) sizes = r.rows.map(x => x[0]).filter(fin).sort((a, b) => b - a); }
      else sizes = [kept];
      if (sizes) {
        stages.push({ kind: 'groups', label: step + (cl.group ? '  GROUP BY' : '  Aggregat (eine Gruppe)'), count: sizes.length + ' Gruppe' + (sizes.length === 1 ? '' : 'n'), sub: cl.group ? cl.group.replace(/\s+/g, ' ') : 'ohne GROUP BY fasst die Abfrage alle Zeilen zusammen', items: sizes.map(n => ({ n, keep: true })) }); step++;
        if (cl.having && cl.group) {
          const r2 = run(db, 'SELECT COUNT(*)' + base + ' GROUP BY ' + cl.group + ' HAVING ' + cl.having);
          if (r2.ok) {
            const left = r2.rows.map(x => x[0]).filter(fin).slice(), items = sizes.map(n => { const k = left.indexOf(n); if (k >= 0) { left.splice(k, 1); return { n, keep: true }; } return { n, keep: false }; });
            stages.push({ kind: 'groups', label: step + '  HAVING', count: r2.rows.length + ' von ' + sizes.length + ' bleiben', sub: cl.having.replace(/\s+/g, ' '), items }); step++;
          }
        }
      }
    }
    const nr = res.rows.length, extra = [(/\bDISTINCT\b/i.test(cl.sel || '') ? 'DISTINCT' : ''), cl.hasOrder ? 'ORDER BY' : '', cl.limit ? 'LIMIT ' + cl.limit : ''].filter(Boolean).join(' · ');
    stages.push({ kind: 'rows', label: step + '  SELECT' + (extra ? ' · ' + extra : ''), count: nr + ' Zeile' + (nr === 1 ? '' : 'n') + ' im Ergebnis', sub: 'Spalten berechnen, sortieren, kürzen', n: nr, flags: null, cls: 'co', empty: nr === 0 ? 'Das Ergebnis ist leer.' : '' });
    let h = `<div class="vq"><h5>Der Weg der Zeilen</h5>${stageSvg(stages)}<p class="vq-note">So arbeitet die Datenbank: erst Tabellen verbinden (FROM, JOIN), dann Zeilen filtern (WHERE), gruppieren (GROUP BY), Gruppen filtern (HAVING) und zuletzt die Spalten berechnen und sortieren. Ausgefüllte Kästchen bleiben, gestrichelte fallen weg.</p></div>`;
    if (pf) h += joinViz(st, cl, pf, db);
    return h;
  }

  /* ---------- JOIN: Zuordnung links <-> rechts ---------- */
  function rowLabel(t, r) {
    const pkI = (t.pk && t.pk.length ? t.pk : [t.cols[0].n]).map(n => t.cols.findIndex(c => c.n === n)), tx = t.cols.findIndex((c, i) => c.type === 'TEXT' && pkI.indexOf(i) < 0);
    return pkI.map(i => show(r[i])).join('/') + (tx >= 0 && r[tx] != null ? ' ' + clip(r[tx], 11) : '');
  }
  function joinViz(st, cl, pf, db) {
    const C = core(); let h = '', shown = 0; const known = [pf.base];
    pf.joins.forEach(j => {
      const cur = j; const prev = known.slice(); known.push(j);
      if (shown >= 2 || !j.on || j.kind === 'cross') return;
      const nameOf = t => String(t.alias || t.table).toLowerCase(); let left = null;
      for (let i = 0; i < j.onToks.length - 1 && !left; i++) {
        const t = j.onToks[i]; if (t.t === 'id' && j.onToks[i + 1].t === 'p' && j.onToks[i + 1].v === '.') { const m = prev.find(p => nameOf(p) === String(t.v).toLowerCase()); if (m) left = m; }
      }
      if (!left) left = prev[0]; const lt = C.findTable(db, left.table), rt = C.findTable(db, cur.table); if (!lt || !rt || nameOf(left) === nameOf(cur)) return;
      const q = 'SELECT * FROM ' + left.table + (left.alias ? ' ' + left.alias : '') + ' JOIN ' + cur.table + (cur.alias ? ' ' + cur.alias : '') + ' ON ' + j.on, r = run(db, q); if (!r.ok) return;
      const nl = lt.cols.length, key = a => JSON.stringify(a), lk = new Map(), rk = new Map();
      lt.rows.forEach((row, i) => { const k = key(row); if (!lk.has(k)) lk.set(k, i); }); rt.rows.forEach((row, i) => { const k = key(row); if (!rk.has(k)) rk.set(k, i); });
      const pairs = []; r.rows.forEach(x => { const a = lk.get(key(x.slice(0, nl))), b = rk.get(key(x.slice(nl))); if (a !== undefined && b !== undefined) pairs.push([a, b]); });
      const maxR = 14, RH = 20, top = 34, nL = Math.min(lt.rows.length, maxR), nR = Math.min(rt.rows.length, maxR), hh = top + Math.max(nL, nR) * RH + 28;
      const hasL = new Set(pairs.map(p => p[0])), hasR = new Set(pairs.map(p => p[1])), lx = 116, rx = 224; let s = '';
      s += `<text class="b" x="${lx - 8}" y="16" text-anchor="end">${esc(clip((left.alias ? left.alias + ' = ' : '') + left.table, 16))}</text><text class="b" x="${rx + 8}" y="16">${esc(clip((cur.alias ? cur.alias + ' = ' : '') + cur.table, 16))}</text><text class="m sm" x="${W / 2}" y="16" text-anchor="middle">${esc(j.kind === 'left' ? 'LEFT JOIN' : 'JOIN')}</text>`;
      pairs.forEach(p => { if (p[0] < maxR && p[1] < maxR) { const y1 = top + p[0] * RH + RH / 2, y2 = top + p[1] * RH + RH / 2; s += `<path class="ln" d="M${lx} ${f(y1)} C${lx + 40} ${f(y1)} ${rx - 40} ${f(y2)} ${rx} ${f(y2)}"/>`; } });
      for (let i = 0; i < nL; i++) {
        const y = top + i * RH + RH / 2, ok = hasL.has(i);
        s += ok ? `<circle class="ck" cx="${lx}" cy="${f(y)}" r="4.5"/>` : `<circle class="cd" cx="${lx}" cy="${f(y)}" r="4"/>`;
        s += `<text class="${ok ? '' : 'm'} sm" x="${lx - 9}" y="${f(y + 3.5)}" text-anchor="end">${esc(clip(rowLabel(lt, lt.rows[i]), 19))}</text>`;
        if (!ok) s += j.kind === 'left' ? `<text class="warn sm" x="${lx + 10}" y="${f(y + 3.5)}">NULL</text>` : `<text class="m sm" x="${lx + 10}" y="${f(y + 3.5)}">✗</text>`;
      }
      for (let i = 0; i < nR; i++) {
        const y = top + i * RH + RH / 2, ok = hasR.has(i);
        s += ok ? `<circle class="ck" cx="${rx}" cy="${f(y)}" r="4.5"/>` : `<circle class="cd" cx="${rx}" cy="${f(y)}" r="4"/>`;
        s += `<text class="${ok ? '' : 'm'} sm" x="${rx + 9}" y="${f(y + 3.5)}">${esc(clip(rowLabel(rt, rt.rows[i]), 19))}</text>`;
      }
      const more = (lt.rows.length > maxR || rt.rows.length > maxR) ? 'Es werden die ersten ' + maxR + ' Zeilen je Seite gezeigt. ' : '';
      s += `<text class="m sm" x="8" y="${f(hh - 8)}">${esc(more)}${esc(pairs.length + ' Paar' + (pairs.length === 1 ? '' : 'e'))}</text>`;
      const lone = lt.rows.length - hasL.size;
      h += `<div class="vq"><h5>JOIN ${shown + 1}: Zeilen finden ihre Partner</h5><svg viewBox="0 0 ${W} ${f(hh)}" role="img" aria-label="Zuordnung der Zeilen von ${esc(left.table)} zu ${esc(cur.table)} über die ON-Bedingung">${s}</svg><p class="vq-note">Jede Linie ist ein Paar, das die ON-Bedingung erfüllt. ${lone > 0 ? (j.kind === 'left' ? lone + ' Zeile' + (lone === 1 ? '' : 'n') + ' links ohne Partner bleiben beim LEFT JOIN erhalten (rechte Spalten NULL).' : lone + ' Zeile' + (lone === 1 ? '' : 'n') + ' links ohne Partner fallen beim INNER JOIN weg.') : 'Alle Zeilen links haben mindestens einen Partner.'}${pairs.length > hasL.size && hasL.size ? ' Mehrere Linien von einer Zeile bedeuten: Diese Zeile kommt im Ergebnis mehrfach vor.' : ''}</p></div>`;
      shown++;
    });
    return h;
  }

  /* ---------- UPDATE / DELETE / INSERT: betroffene Zeilen ---------- */
  function dmlViz(st, db) {
    const C = core(), ts = st.toks; let table = null, label = '', where = null, kind = st.kw;
    if (kind === 'UPDATE' && ts[1] && ts[1].t === 'id') table = ts[1].v; else if (kind === 'DELETE' && ts[1] && String(ts[1].v).toUpperCase() === 'FROM' && ts[2]) table = ts[2].v; else return '';
    let d = 0, wi = -1; ts.forEach((t, i) => { if (t.t === 'p' && t.v === '(') d++; else if (t.t === 'p' && t.v === ')') d--; else if (d === 0 && wi < 0 && t.t === 'id' && String(t.v).toUpperCase() === 'WHERE') wi = i; });
    if (wi >= 0) where = st.sql.slice(ts[wi].end, ts[ts.length - 1].end).trim();
    const tb = C.findTable(db, table); if (!tb) return '';
    const n = tb.rows.length; let flags = tb.rows.map(() => 1);
    if (where) { const r = run(db, 'SELECT CASE WHEN ' + where + ' THEN 1 ELSE 0 END FROM ' + tb.name); if (!r.ok || r.rows.length !== n) return ''; flags = r.rows.map(x => (x[0] === 1 ? 1 : 0)); }
    const k = flags.reduce((a, b) => a + b, 0); label = (kind === 'UPDATE' ? 'ändert sich' : 'wird gelöscht');
    const r = chipRows(n, flags, 40, 'ch'), hh = 40 + r[1] + 26;
    const s = `<text class="b" x="8" y="16">${esc(tb.name)}: ${n} Zeile${n === 1 ? '' : 'n'}</text><text class="b" x="${W - 8}" y="16" text-anchor="end">${k} ${esc(label)}</text><text class="m sm" x="8" y="32">${esc(where ? 'WHERE ' + clip(where.replace(/\s+/g, ' '), 46) : 'keine WHERE-Bedingung')}</text>${r[0]}`;
    const warn = !where && n > 1 ? `<p class="vq-note" style="color:var(--warn)">⚠ Ohne WHERE trifft ${kind === 'UPDATE' ? 'UPDATE' : 'DELETE'} alle ${n} Zeilen der Tabelle.</p>` : `<p class="vq-note">Orange Kästchen sind die Zeilen, die ${kind === 'UPDATE' ? 'geändert' : 'gelöscht'} werden, gestrichelte bleiben unberührt.</p>`;
    return `<div class="vq"><h5>${kind === 'UPDATE' ? 'UPDATE' : 'DELETE'}: betroffene Zeilen</h5><svg viewBox="0 0 ${W} ${f(hh)}" role="img" aria-label="${k} von ${n} Zeilen der Tabelle ${esc(tb.name)} sind betroffen">${s}</svg>${warn}</div>`;
  }

  /* html(sql, db, opt): gibt "" zurück, wenn nichts darstellbar ist. db wird nicht verändert. */
  function html(sql, db, opt) {
    opt = opt || {};
    try {
      if (!core() || !db) return '';
      if (opt.task) { let ex = null; try { ex = JSON.parse(localStorage.getItem('lm4.sql.exam')); } catch (e) {} if (ex === '1') return ''; }
      const sts = statements(sql); if (!sts.length || sts.length > 6) return '';
      const cur = core().cloneDb(db); let out = '', n = 0;
      for (const st of sts) {
        if (n < 3) { let v = ''; if (st.kw === 'SELECT') v = selectViz(st, cur); else if ((st.kw === 'UPDATE' || st.kw === 'DELETE') && !opt.task) v = dmlViz(st, cur); /* in Aufgaben keine Warnung vor fehlendem WHERE (Verdeckte-Fehler-Prinzip) */ if (v) { out += (sts.length > 1 ? `<p class="vq-note" style="margin:8px 0 0">Anweisung ${sts.indexOf(st) + 1}</p>` : '') + v; n++; } }
        const r = core().exec(cur, st.text); if (!r.ok) break;
      }
      return out;
    } catch (e) { return ''; }
  }

  /* ---------- Tabellen als Raster und Beziehungs-Explorer ---------- */
  function gridSvg(db, name, sel) {
    const t = core().findTable(db, name); if (!t) return '';
    const nc = t.cols.length, cw = (W - 6) / nc, RH = 26, hh = 24, hgt = hh + t.rows.length * RH + 6; let s = '';
    const pkI = t.pk.map(n => t.cols.findIndex(c => c.n === n)), fkI = t.fks.map(x => t.cols.findIndex(c => c.n === x.c));
    t.cols.forEach((c, i) => { s += `<rect class="hd" x="${f(3 + i * cw)}" y="2" width="${f(cw)}" height="${hh - 2}"/><text class="hdt sm" x="${f(3 + i * cw + 4)}" y="17">${esc(clip(c.n, Math.max(3, Math.floor(cw / 6))))}</text>`; });
    t.rows.forEach((r, ri) => {
      const y = hh + ri * RH, on = ri === sel;
      s += `<g class="${on ? 'sel' : ''}" data-vqr="${ri}">`;
      r.forEach((v, i) => {
        const cls = v === null ? 'nl' : pkI.indexOf(i) >= 0 ? 'pk' : fkI.indexOf(i) >= 0 ? 'fk' : '';
        s += `<rect class="cell" x="${f(3 + i * cw)}" y="${f(y)}" width="${f(cw)}" height="${RH}"/>` + (v === null ? `<path d="M${f(3 + i * cw + 3)} ${f(y + RH - 4)} L${f(3 + i * cw + 11)} ${f(y + 4)} M${f(3 + i * cw + 9)} ${f(y + RH - 4)} L${f(3 + i * cw + 17)} ${f(y + 4)}" stroke="var(--line)" stroke-width="1.2"/>` : '') + `<text class="sm ${cls}" x="${f(3 + i * cw + 4)}" y="${f(y + 17)}">${esc(clip(show(v), Math.max(3, Math.floor((cw - 6) / 5.8))))}</text>`;
      });
      s += `<rect class="hit" x="3" y="${f(y)}" width="${W - 6}" height="${RH}"/></g>`;
    });
    return `<svg viewBox="0 0 ${W} ${f(hgt)}" role="img" aria-label="Tabelle ${esc(name)} als Raster, ${t.rows.length} Zeilen. Gelb: Primärschlüssel, blau: Fremdschlüssel, schraffiert: NULL.">${s}</svg>`;
  }
  function relSvg(db, name, ri) {
    const C = core(), t = C.findTable(db, name); if (!t || !t.rows[ri]) return '';
    const row = t.rows[ri], ci = n => t.cols.findIndex(c => c.n === n); let y = 6, s = '';
    const sum = (tb, r) => tb.cols.slice(0, 3).map((c, i) => c.n + ' ' + show(r[i])).join(' · ');
    /* Eltern (Fremdschlüssel dieser Zeile) */
    const parents = t.fks.map(fk => { const pt = C.findTable(db, fk.t), v = row[ci(fk.c)]; const pr = pt && v !== null ? pt.rows.find(x => x[pt.cols.findIndex(c => c.n === fk.rc)] === v) : null; return { fk, pt, v, pr }; });
    parents.forEach(p => {
      s += `<rect class="${p.pr ? 'bx' : 'cd'}" x="8" y="${f(y)}" width="${W - 16}" height="34" rx="6"/><text class="b sm" x="16" y="${f(y + 14)}">${esc(p.pt ? p.pt.name : p.fk.t)} (1)</text><text class="${p.pr ? '' : 'm'} sm" x="16" y="${f(y + 28)}">${esc(p.pr ? clip(sum(p.pt, p.pr), 52) : p.v === null ? p.fk.c + ' ist NULL: kein Verweis' : 'Zeile fehlt')}</text>`;
      s += `<path class="ar" d="M${W / 2} ${f(y + 52)} V${f(y + 37)} m-4 5 l4 -5 l4 5"/><text class="fk sm" x="${W / 2 + 12}" y="${f(y + 49)}">FK ${esc(p.fk.c)} = ${esc(show(p.v))}</text>`;
      y += 58;
    });
    /* gewählte Zeile */
    const bh = 22 + t.cols.length * 17 + 6;
    s += `<rect class="bxa" x="8" y="${f(y)}" width="${W - 16}" height="${f(bh)}" rx="8"/><text class="b" x="16" y="${f(y + 16)}">${esc(t.name)}</text>`;
    t.cols.forEach((c, i) => { const v = row[i], cls = v === null ? 'nl' : t.pk.indexOf(c.n) >= 0 ? 'pk' : t.fks.some(x => x.c === c.n) ? 'fk' : ''; s += `<text class="m sm" x="16" y="${f(y + 33 + i * 17)}">${esc(c.n)}</text><text class="sm ${cls}" x="120" y="${f(y + 33 + i * 17)}">${esc(clip(show(v), 34))}</text>`; });
    y += bh;
    /* Kinder (Zeilen anderer Tabellen, die auf diese Zeile zeigen) */
    const kids = [];
    Object.keys(db.tables).forEach(k => { const ct = db.tables[k]; ct.fks.filter(fk => fk.t.toLowerCase() === t.name.toLowerCase()).forEach(fk => { const a = ct.cols.findIndex(c => c.n === fk.c), b = ci(fk.rc), v = row[b]; kids.push({ ct, fk, rows: v === null ? [] : ct.rows.filter(x => x[a] === v) }); }); });
    kids.forEach(kd => {
      s += `<path class="ar" d="M${W / 2} ${f(y + 2)} V${f(y + 16)} m-4 -5 l4 5 l4 -5"/><text class="fk sm" x="${W / 2 + 12}" y="${f(y + 13)}">${esc(kd.fk.c)} zeigt hierher</text>`;
      y += 20; const kp = kd.ct.pk.length ? kd.ct.pk : [kd.ct.cols[0].n], pi = kp.map(n => kd.ct.cols.findIndex(c => c.n === n)), maxK = 12;
      s += `<rect class="${kd.rows.length ? 'bx' : 'cd'}" x="8" y="${f(y)}" width="${W - 16}" height="52" rx="6"/><text class="b sm" x="16" y="${f(y + 14)}">${esc(kd.ct.name)} (n): ${kd.rows.length} Zeile${kd.rows.length === 1 ? '' : 'n'}</text>`;
      kd.rows.slice(0, maxK).forEach((x, i) => { const lab = pi.map(j => show(x[j])).join('/'), cx = 16 + i * 25; s += `<rect class="ck" x="${f(cx)}" y="${f(y + 24)}" width="22" height="20" rx="4"/><text class="hdt sm" x="${f(cx + 11)}" y="${f(y + 38)}" text-anchor="middle">${esc(clip(lab, 3))}</text>`; });
      if (kd.rows.length > maxK) s += `<text class="m sm" x="${f(16 + maxK * 25)}" y="${f(y + 38)}">+${kd.rows.length - maxK}</text>`;
      if (!kd.rows.length) s += `<text class="m sm" x="16" y="${f(y + 38)}">keine Zeile verweist auf diese Zeile</text>`;
      y += 60;
    });
    return `<svg viewBox="0 0 ${W} ${f(y + 4)}" role="img" aria-label="Beziehungen der gewählten Zeile in ${esc(t.name)}: Elternzeilen oben, Kindzeilen unten">${s}</svg>`;
  }
  function mount(el, db) {
    try {
      if (!el || !db || !core() || typeof document === 'undefined') return; css();
      const old = el.querySelector('#vqEx'); if (old) old.remove();
      const names = Object.keys(db.tables), box = document.createElement('div'); box.className = 'card pl'; box.id = 'vqEx';
      let st = { t: names.indexOf('kunde') >= 0 ? 'kunde' : names[0], r: 0 };
      const rowOpts = () => { const t = core().findTable(db, st.t); return t ? t.rows.map((r, i) => `<option value="${i}"${i === st.r ? ' selected' : ''}>${esc(rowLabel(t, r))}</option>`).join('') : ''; };
      const draw = () => {
        const t = core().findTable(db, st.t); if (!t) return; if (st.r >= t.rows.length) st.r = 0;
        box.innerHTML = `<h4>Tabellen als Raster und ihre Beziehungen</h4><div class="vq-ctl"><label><span>Tabelle</span><select data-vq="t">${names.map(n => `<option value="${esc(n)}"${n === st.t ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label><label><span>Zeile wählen (oder im Raster antippen)</span><select data-vq="r">${rowOpts()}</select></label></div>
          <div class="vq"><h5>${esc(t.name)} als Raster</h5><div class="vq-sc">${gridSvg(db, st.t, st.r)}</div><p class="vq-note">Gelb: Primärschlüssel, blau: Fremdschlüssel, schraffiert: NULL (kein Wert). Die gewählte Zeile ist hervorgehoben.</p></div>
          <div class="vq"><h5>Die gewählte Zeile und ihre Verweise</h5>${relSvg(db, st.t, st.r)}<p class="vq-note">Oben stehen die Zeilen, auf die diese Zeile über einen Fremdschlüssel zeigt (1-Seite). Unten stehen die Zeilen anderer Tabellen, die auf sie zeigen (n-Seite).</p></div>`;
      };
      box.addEventListener('change', e => { const k = e.target && e.target.dataset && e.target.dataset.vq; if (!k) return; if (k === 't') { st.t = e.target.value; st.r = 0; } else st.r = +e.target.value || 0; draw(); });
      box.addEventListener('click', e => { const g = e.target.closest && e.target.closest('[data-vqr]'); if (g) { st.r = +g.dataset.vqr || 0; draw(); } });
      draw(); const first = el.querySelector('.card.pl'); if (first && first.nextSibling) first.parentNode.insertBefore(box, first.nextSibling); else el.appendChild(box);
    } catch (e) {}
  }

  const API = { html, mount, statements, clauses, parseFrom, gridSvg, relSvg, stageSvg, chipRows };
  root.SQL_VIZ = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  /* Die Oberfläche (sqlui.js) wird vor dieser Datei geladen und hat den ersten Reiter schon gezeichnet: einmal neu zeichnen, damit die Visualisierung erscheint. */
  if (typeof document !== 'undefined') { try { const b = document.querySelector('#tabs .tab.on'); if (b) b.click(); } catch (e) {} }
})(typeof window !== 'undefined' ? window : globalThis);
