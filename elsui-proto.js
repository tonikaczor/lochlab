'use strict';
/* Tonfunk Sicherheits-Lab (ELS-Lab): Tab "Prüfprotokoll" (WP3b, SPEC 6.3).
   Formular aus ELS_CORE.protocol.template (alle Felder aus 4.7). Messwerte, Prüfling und Sichtprüfung kommen mit "Werte übernehmen" aus dem Prüfplatz (rig.protokollWerte(), rig.pruefling()).
   Das Gesamtergebnis trägt der Azubi selbst ein; erst "Protokoll kontrollieren" ruft ELS_CORE.protocol.check(entry, dev) und zeigt jede Abweichung mit dem Text des Kerns.
   Hier steht KEINE zweite Prüflogik (SPEC Regel 7): Konsistenz, Grenzwerte, Urteil und Texte kommen aus protocol.check / device.verdict. Das Protokoll geht als Druck/PDF und als CSV hinaus (Roundtrip: fromCsv(toCsv(e)) liefert dieselben Werte);
   Verlauf der letzten 20 Protokolle in els.proto (Zähler elsproto = im Verlauf abgelegte, stimmige Protokolle). Das laufende Protokoll steht in S.protokoll (api.getProtokoll/setProtokoll) und reist mit Speichern, Teilen und Abgabe.
   Hinweis in jeder Ansicht: "Übungsprotokoll, kein Prüfnachweis." Prüffristen legt der Betrieb fest (Norm und Vorschrift maßgeblich).
   Schnittstelle (VERTRAG 6.5): window.ELS_UI_EXT.proto = { render(host, api), refresh(), redraw(), fn }. Reine Funktionen unter fn (test_elsui_ext.js). */
(function (root) {
  const E = root.ELS_UI_EXT = root.ELS_UI_EXT || {};
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fin = v => typeof v === 'number' && isFinite(v);
  const once = (host, name, ty, fn) => { host.__elspr = host.__elspr || {}; if (host.__elspr[name + ty]) return; host.__elspr[name + ty] = 1; host.addEventListener(ty, fn); };
  const CORE = () => root.ELS_CORE;
  const KEY = 'els.proto', MAXH = 20;
  const NOCORE = 'Der Rechenkern ist nicht geladen (elscore.js und elscore-pruef.js fehlen). Ohne ihn gibt es hier kein Formular.';
  const HINT = 'Übungsprotokoll, kein Prüfnachweis.';
  const MW = { rpe: ['Schutzleiterwiderstand', 'Ω'], riso: ['Isolationswiderstand', 'MΩ'], ipe: ['Schutzleiterstrom', 'mA'], ber: ['Berührungsstrom', 'mA'] };
  const mwKeys = sk => (sk === 'III' ? ['riso'] : sk === 'II' ? ['riso', 'ber'] : sk === 'I' ? ['rpe', 'riso', 'ipe'] : []);

  /* ============================================================ reine Funktionen (ohne DOM) */
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const tpl = () => { const C = CORE(); return C && C.protocol && Array.isArray(C.protocol.template) ? C.protocol.template : []; };
  function blank(o) {
    o = o || {}; const e = { dev: null };
    tpl().forEach(f => { e[f.key] = f.key === 'sicht' || f.key === 'messwerte' ? null : f.typ === 'datum' ? (o.datum || today()) : ''; });
    if (o.pruefer) e.pruefer = String(o.pruefer);
    return e;
  }
  /* Eintrag bereinigen (aus Speicher, Link oder CSV): nur bekannte Felder, Texte als Text */
  function norm(x) {
    const o = x && typeof x === 'object' ? x : {}, e = blank({ datum: '' });
    tpl().forEach(f => {
      const v = o[f.key];
      if (f.key === 'sicht') e.sicht = Array.isArray(v) ? v.map(String) : null;
      else if (f.key === 'messwerte') { if (v && typeof v === 'object') { e.messwerte = {}; Object.keys(MW).forEach(k => { if (v[k] !== undefined && v[k] !== null) e.messwerte[k] = String(v[k]); }); } }
      else e[f.key] = v === undefined || v === null ? '' : String(v);
    });
    const d = o.dev; e.dev = d && typeof d === 'object' && typeof d.id === 'string' ? { id: d.id, faults: Array.isArray(d.faults) ? d.faults.map(String) : [], seed: fin(+d.seed) ? Math.floor(+d.seed) : 1 } : null;
    return e;
  }
  const isEmpty = e => { const b = blank({ datum: '' }), n = norm(e); return !n.dev && tpl().every(f => (f.key === 'sicht' ? n.sicht === null : f.key === 'messwerte' ? n.messwerte === null : (n[f.key] === '' || n[f.key] === b[f.key] || f.typ === 'datum'))); };
  const dispNum = v => (fin(v) ? String(+(+v).toPrecision(4)).replace('.', ',') : '');
  /* Vorschlag aus dem Prüfplatz übernehmen: nur Durchgeführtes; das Gesamtergebnis bleibt leer (das trägt der Azubi selbst ein) */
  function take(e, w) {
    const n = norm(e); if (!w || typeof w !== 'object') return n;
    if (w.geraet) n.geraet = String(w.geraet);
    if (w.schutzklasse) n.schutzklasse = String(w.schutzklasse);
    if (w.pruefart) n.pruefart = String(w.pruefart);
    if (Array.isArray(w.sicht)) n.sicht = w.sicht.map(String);
    if (w.messwerte && typeof w.messwerte === 'object') { n.messwerte = {}; Object.keys(MW).forEach(k => { if (fin(w.messwerte[k])) n.messwerte[k] = dispNum(w.messwerte[k]); }); }
    if (w.dev && typeof w.dev.id === 'string') n.dev = { id: w.dev.id, faults: Array.isArray(w.dev.faults) ? w.dev.faults.map(String) : [], seed: fin(+w.dev.seed) ? Math.floor(+w.dev.seed) : 1 };
    n.ergebnis = '';
    return n;
  }
  /* Kontrolle: ausschließlich ELS_CORE.protocol.check */
  function checkEntry(e) {
    const C = CORE(); if (!C || !C.protocol || typeof C.protocol.check !== 'function') return { ok: false, nocore: true, abw: [], text: NOCORE };
    const n = norm(e); if (!n.dev) return { ok: false, nodev: true, abw: [], text: 'Zum Vergleichen fehlt der Prüfling: Öffne den Prüfplatz, führe die Schritte aus und übernimm die Werte hier.' };
    let r = null; try { r = C.protocol.check(n, n.dev); } catch (er) { r = null; }
    if (!r || typeof r !== 'object' || r.ok === undefined) return { ok: false, abw: [], text: 'Die Kontrolle ist nicht gelungen' + (r && r.why ? ': ' + r.why : '.') };
    return { ok: !!r.ok, abw: Array.isArray(r.abweichungen) ? r.abweichungen : [], text: String(r.text || ''), erwartet: r.erwartet, why: r.why };
  }
  /* Grenzwerte je Schritt des Prüflings (aus device.verdict, mit Status) */
  function limitRows(e) {
    const C = CORE(), n = norm(e); if (!C || !C.device || !n.dev) return [];
    let v = null; try { v = C.device.verdict({}, { id: n.dev.id }); } catch (er) { v = null; }
    return v && Array.isArray(v.steps) ? v.steps.filter(s => s.id !== 'sicht').map(s => ({ id: s.id, name: s.name, grenze: s.grenzText || '', status: s.limitStatus || '', einheit: s.einheit })) : [];
  }
  /* CSV: Feld;Wert;Einheit, Dezimalkomma bleibt, wie getippt; Felder mit ; oder " in Anführungszeichen; Liste mit | */
  const cq = s => (/[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s);
  function toCsv(e) {
    const n = norm(e), rows = ['# Tonfunk Sicherheits-Lab;Prüfprotokoll;' + HINT, 'Feld;Wert;Einheit'];
    tpl().forEach(f => {
      if (f.key === 'sicht') { if (n.sicht !== null) rows.push('sicht;' + cq(n.sicht.join('|')) + ';'); }
      else if (f.key === 'messwerte') { if (n.messwerte) Object.keys(MW).forEach(k => { if (n.messwerte[k] !== undefined) rows.push('messwerte.' + k + ';' + cq(n.messwerte[k]) + ';' + MW[k][1]); }); }
      else rows.push(f.key + ';' + cq(n[f.key]) + ';');
    });
    if (n.dev) rows.push('dev.id;' + cq(n.dev.id) + ';', 'dev.faults;' + cq(n.dev.faults.join('|')) + ';', 'dev.seed;' + n.dev.seed + ';');
    return rows.join('\r\n') + '\r\n';
  }
  /* Zeilen und Felder in einem Zug lesen: Anführungszeichen dürfen Semikolon und Zeilenumbruch einschließen */
  function parseRows(text) {
    const rows = []; let row = [], cur = '', q = false;
    const end = () => { row.push(cur); cur = ''; rows.push(row); row = []; };
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true; else if (ch === ';') { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; end(); } else cur += ch;
    }
    if (cur !== '' || row.length) end();
    return rows;
  }
  function fromCsv(text) {
    const o = { messwerte: null, sicht: null, dev: null }; let any = false; const dv = {};
    parseRows(String(text == null ? '' : text).replace(/^﻿/, '')).forEach(c => {
      const k = c[0], v = c[1] === undefined ? '' : c[1]; if (!k || k[0] === '#' || k === 'Feld') return;
      if (k === 'sicht') { o.sicht = v === '' ? [] : v.split('|'); any = true; }
      else if (/^messwerte\./.test(k)) { const m = k.slice(10); if (MW[m]) { o.messwerte = o.messwerte || {}; o.messwerte[m] = v; any = true; } }
      else if (/^dev\./.test(k)) { dv[k.slice(4)] = v; any = true; }
      else if (tpl().some(f => f.key === k)) { o[k] = v; any = true; }
    });
    if (dv.id) o.dev = { id: dv.id, faults: dv.faults ? dv.faults.split('|') : [], seed: +dv.seed };
    return any ? norm(o) : null;
  }
  const ymd = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? m[3] + '.' + m[2] + '.' + m[1] : String(s || ''); };
  const faultName = id => { const C = CORE(); return (C && C.device && C.device.faultName && C.device.faultName[id]) || id; };
  function printHtml(e, res) {
    const n = norm(e), t = tpl(), rows = [];
    t.forEach(f => {
      let v = n[f.key];
      if (f.key === 'sicht') v = n.sicht === null ? '–' : n.sicht.length ? n.sicht.map(faultName).join('; ') : 'keine Mängel';
      else if (f.key === 'messwerte') v = n.messwerte ? Object.keys(MW).filter(k => n.messwerte[k] !== undefined).map(k => MW[k][0] + ' ' + n.messwerte[k] + ' ' + MW[k][1]).join('; ') || '–' : '–';
      else if (f.typ === 'datum') v = ymd(v); else if (v === '') v = '–';
      rows.push('<tr><td>' + esc(f.label) + '</td><td>' + esc(v) + '</td></tr>');
    });
    const lr = limitRows(n);
    return '<div class="proto"><h1>Prüfprotokoll (Übung)</h1><p><b>' + esc(HINT) + '</b> Die Prüffrist legt der Betrieb fest; Norm und Vorschrift maßgeblich.</p><table>' + rows.join('') + '</table>' +
      (lr.length ? '<h2>Grenzwerte dieses Prüflings</h2><table><tr><th>Prüfschritt</th><th>Grenzwert</th><th>Status</th></tr>' + lr.map(r => '<tr><td>' + esc(r.name) + '</td><td>' + esc(r.grenze) + '</td><td>' + (r.status === 'belegt' ? 'belegt' : 'Übungswert (A)') + '</td></tr>').join('') + '</table>' : '') +
      (res ? '<h2>Kontrolle</h2><p>' + esc(res.ok ? res.text : (res.abw && res.abw.length ? res.abw.length + ' Abweichung(en)' : res.text)) + '</p>' + (res.abw && res.abw.length ? '<ul>' + res.abw.map(a => '<li>' + esc(a.text) + '</li>').join('') + '</ul>' : '') : '') + '</div>';
  }
  /* Verlauf: neueste zuletzt, höchstens 20 */
  function addHistory(list, item, max) {
    const a = (Array.isArray(list) ? list : []).filter(x => x && typeof x === 'object'); a.push(item); return a.slice(-(max || MAXH));
  }
  const countOk = list => (Array.isArray(list) ? list : []).filter(x => x && x.ok === true).length;

  /* ============================================================ Oberfläche */
  let A = null, H = null;
  const st = { entry: null, res: null, armed: 0, open: false };
  const CSS = '.pr-err{color:var(--bad-fg);font-size:13px;margin:3px 0 0}.pr-bad input,.pr-bad select{border-color:var(--danger)}.pr-mw{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px 10px}.pr-lim{font-size:12.5px;color:var(--mute);margin-top:3px}.pr-sec{margin:12px 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--mute);font-weight:600}.pr-hist small{color:var(--mute)}';
  function css() { try { if (typeof document !== 'undefined' && document.head && !document.getElementById('elsProtoCss')) { const s = document.createElement('style'); s.id = 'elsProtoCss'; s.textContent = CSS; document.head.appendChild(s); } } catch (e) {} }
  const hist = () => { const a = A && A.lsGet ? A.lsGet(KEY, []) : []; return Array.isArray(a) ? a : []; };
  const prefer = () => { try { const v = typeof localStorage !== 'undefined' ? localStorage.getItem('lm4.name') : ''; return v ? String(v).replace(/^"|"$/g, '') : ''; } catch (e) { return ''; } };
  function load() {
    const cur = A && typeof A.getProtokoll === 'function' ? A.getProtokoll() : (A && A.S ? A.S.protokoll : null);
    st.entry = cur ? norm(cur) : blank({ pruefer: prefer() });
  }
  function commit() { if (A && typeof A.setProtokoll === 'function') A.setProtokoll(st.entry); }
  const errOf = (feld) => (st.res && st.res.abw ? st.res.abw.filter(a => a.feld === feld) : []);
  const errHtml = feld => errOf(feld).map(a => '<div class="pr-err" role="alert">✗ ' + esc(a.text) + '</div>').join('');
  function fieldHtml(f, n) {
    const bad = errOf(f.key).length ? ' pr-bad' : '', id = 'prf_' + f.key;
    if (f.typ === 'sicht' || f.key === 'sicht' || f.key === 'messwerte') return '';
    const v = n[f.key] || '';
    if (f.typ === 'select') return '<label class="f' + bad + '"><span>' + esc(f.label) + (f.pflicht ? ' *' : '') + '</span><select id="' + id + '" data-f="' + f.key + '"><option value=""' + (v === '' ? ' selected' : '') + '>– bitte wählen –</option>' + (f.optionen || []).map(o => '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select>' + errHtml(f.key) + '</label>';
    return '<label class="f' + bad + '"><span>' + esc(f.label) + (f.pflicht ? ' *' : '') + '</span><input id="' + id + '" data-f="' + f.key + '" type="' + (f.typ === 'datum' ? 'date' : 'text') + '" value="' + esc(v) + '" autocomplete="off" title="' + esc(f.hilfe || '') + '">' + errHtml(f.key) + '</label>';
  }
  function sichtHtml(n) {
    const C = CORE(), list = C && C.device && C.device.sichtMaengel ? C.device.sichtMaengel : [], done = n.sicht !== null, bad = errOf('sicht').length ? ' pr-bad' : '';
    return '<div class="pr-sec">Sichtprüfung (Mängel) *</div><div class="' + bad + '"><label class="chk"><input type="checkbox" data-sichtdone ' + (done ? 'checked' : '') + '> Sichtprüfung ist erledigt (ohne Haken in der Liste heißt das: keine Mängel gefunden)</label>' +
      list.map(m => '<label class="chk" style="margin-left:18px"><input type="checkbox" data-mangel="' + esc(m) + '" ' + (done ? '' : 'disabled ') + (done && n.sicht.indexOf(m) >= 0 ? 'checked' : '') + '> ' + esc(faultName(m)) + '</label>').join('') + errHtml('sicht') + '</div>';
  }
  function mwHtml(n) {
    const keys = mwKeys(n.schutzklasse), lr = limitRows(n), lim = {}; lr.forEach(r => { lim[r.id] = r; });
    if (!keys.length) return '<div class="pr-sec">Messwerte *</div><p class="hint2">Wähle zuerst die Schutzklasse oder übernimm die Werte aus dem Prüfplatz. Dann erscheinen die passenden Felder.</p>' + errHtml('messwerte');
    return '<div class="pr-sec">Messwerte (Wert, Grenzwert) *</div><div class="pr-mw">' + keys.map(k => {
      const g = lim[k === 'ber' ? 'ipe' : k], bad = errOf('messwerte.' + k).length ? ' pr-bad' : '', v = n.messwerte && n.messwerte[k] !== undefined ? n.messwerte[k] : '';
      return '<label class="f' + bad + '"><span>' + esc(MW[k][0]) + ' in ' + MW[k][1] + '</span><input id="prm_' + k + '" data-m="' + k + '" inputmode="decimal" value="' + esc(v) + '" autocomplete="off">' +
        (g ? '<div class="pr-lim">Grenzwert: ' + esc(g.grenze) + ' (' + (g.status === 'belegt' ? '✓ belegt' : 'Übungswert (A)') + ')</div>' : '') + errHtml('messwerte.' + k) + '</label>';
    }).join('') + '</div>' + (n.dev ? '' : '<p class="hint2">Die Grenzwerte erscheinen, sobald ein Prüfling aus dem Prüfplatz übernommen ist.</p>');
  }
  function resHtml() {
    const r = st.res; if (!r) return '';
    if (r.ok) return '<div class="ex ok" role="status"><b>✓ Stimmig.</b> ' + esc(r.text) + '</div>';
    return '<div class="ex bad" role="alert"><b>✗ ' + (r.abw && r.abw.length ? r.abw.length + (r.abw.length === 1 ? ' Abweichung' : ' Abweichungen') : 'Keine Kontrolle möglich') + '</b>' + (r.abw && r.abw.length ? '<ul style="margin:6px 0 0;padding-left:20px">' + r.abw.map(a => '<li>' + esc(a.text) + '</li>').join('') + '</ul>' : '<p style="margin:6px 0 0">' + esc(r.text) + '</p>') + '</div>';
  }
  function histHtml() {
    const h = hist().slice().reverse();
    if (!h.length) return '<details class="card" id="prHist"><summary>Verlauf der letzten Protokolle</summary><div class="cb"><p class="hint2" style="padding:6px">Noch kein Protokoll abgelegt. „Ablegen“ speichert das Protokoll auf diesem Gerät (die letzten ' + MAXH + ').</p></div></details>';
    return '<details class="card" id="prHist"' + (st.open ? ' open' : '') + '><summary>Verlauf der letzten Protokolle (' + h.length + ')</summary><div class="cb pr-hist">' + h.map(x => {
      const e = x.entry || {}, d = new Date(x.t || 0), when = isNaN(d) ? '' : d.toLocaleDateString('de-DE') + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      return '<div class="row"><span class="dot ' + (x.ok ? 'g' : '') + '" aria-hidden="true">' + (x.ok ? '✓' : '✗') + '</span><div class="grow">' + esc(e.geraet || 'Ohne Gerät') + ' · ' + esc(e.ergebnis || 'ohne Ergebnis') + '<small>' + esc(when) + ' · ' + (x.ok ? 'bei der Kontrolle stimmig' : 'bei der Kontrolle nicht stimmig oder nicht geprüft') + '</small></div><button class="chip s" data-h="load" data-id="' + esc(x.id) + '">Laden</button><button class="chip s danger" data-h="del" data-id="' + esc(x.id) + '" aria-label="Protokoll löschen">Löschen</button></div>';
    }).join('') + '</div></details>';
  }
  function html() {
    const C = CORE(); if (!C || !C.protocol || !tpl().length) return '<div class="card pl"><p class="big">Prüfprotokoll</p><p class="hint2">' + esc(NOCORE) + '</p></div>';
    const n = st.entry, rid = A && A.rig ? A.rig.id : '', canTake = !!(A && A.rig && typeof A.rig.protokollWerte === 'function');
    const other = n.dev && canTake && typeof A.rig.pruefling === 'function' ? (() => { let p = null; try { p = A.rig.pruefling(); } catch (e) { p = null; } return p && (p.id !== n.dev.id || p.seed !== n.dev.seed || p.faults.join() !== n.dev.faults.join()); })() : false;
    return '<div class="card pl"><h4>Prüfprotokoll</h4><p class="hint2" style="margin:0 0 8px"><b>' + esc(HINT) + '</b> Trage ein, was du geprüft hast; dann kontrolliert das Lab, ob alles zusammenpasst. Pflichtfelder sind mit * markiert. Die Prüffrist legt der Betrieb fest; Norm und Vorschrift maßgeblich.</p>' +
      '<div class="btns" style="margin:0 0 8px">' + (canTake ? '<button class="btn pri" data-a="take">Werte aus dem Prüfplatz übernehmen</button>' : '<button class="btn pri" data-a="open">Prüfplatz öffnen</button>') + '</div>' +
      (canTake ? '' : '<p class="hint2">Die Werte kommen aus dem Prüfstand „Prüfplatz Geräteprüfung“ (aktuell: ' + esc(rid || 'keiner') + '). Führe dort die Prüfschritte aus und komm zurück.</p>') +
      (n.dev ? '<p class="hint2" style="margin:0 0 8px">Prüfling im Protokoll: <b>' + esc(n.geraet || n.dev.id) + '</b>' + (other ? ' · Im Prüfplatz steht inzwischen ein anderer Prüfling: übernimm die Werte erneut.' : '') + '</p>' : '') +
      '<div class="frm">' + tpl().map(f => fieldHtml(f, n)).join('') + '</div>' + sichtHtml(n) + mwHtml(n) + resHtml() +
      '<div class="btns"><button class="btn pri" data-a="check">Protokoll kontrollieren</button><button class="btn" data-a="save">Ablegen (Verlauf)</button><button class="btn" data-a="print">Drucken oder als PDF</button><button class="btn" data-a="csv">Als CSV</button><button class="btn" data-a="import">CSV laden</button><button class="btn danger" data-a="clear">' + (st.armed > Date.now() ? 'Wirklich leeren?' : 'Neues Protokoll') + '</button></div>' +
      '<input type="file" id="prFile" accept=".csv,text/csv" hidden aria-label="CSV-Datei wählen"></div>' + histHtml();
  }
  function paint() { if (!H) return; css(); H.innerHTML = html(); H.dataset.pr = '1'; }
  const toast = m => { if (A && A.toast) A.toast(m); };
  function exportCsv() {
    const txt = toCsv(st.entry), blob = new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8' });
    try {
      if (root.LabExport && root.LabExport.saveBlob) root.LabExport.saveBlob(blob, root.LabExport.fname ? root.LabExport.fname('csv') : 'els-pruefprotokoll.csv');
      else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'els-pruefprotokoll.csv'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
      A && A.stat && A.stat('csv'); toast('CSV gespeichert');
    } catch (e) { toast('Die Datei konnte nicht gespeichert werden.'); }
    return txt;
  }
  function printNow() {
    const pa = typeof document !== 'undefined' ? document.getElementById('printArea') : null; if (!pa) { toast('Drucken ist hier nicht möglich.'); return; }
    pa.innerHTML = printHtml(st.entry, st.res); setTimeout(() => { try { window.print(); } catch (e) {} }, 80);
  }
  function doTake() {
    const rig = A && A.rig; if (!rig || typeof rig.protokollWerte !== 'function') { toast('Wechsle zuerst zum Prüfstand Prüfplatz Geräteprüfung.'); return false; }
    let w = null; try { w = rig.protokollWerte(); } catch (e) { w = null; }
    if (!w) { toast('Im Prüfplatz gibt es noch nichts zu übernehmen.'); return false; }
    st.entry = take(st.entry, w); st.res = null; commit(); paint();
    toast('Werte übernommen. Das Gesamtergebnis trägst du selbst ein.'); return true;
  }
  function doCheck() { st.res = checkEntry(st.entry); paint(); return st.res; }
  function doSave() {
    const res = st.res && st.res.ok !== undefined ? st.res : checkEntry(st.entry);
    const item = { id: 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), t: Date.now(), entry: norm(st.entry), ok: !!res.ok };
    const a = addHistory(hist(), item, MAXH); A.lsSet(KEY, a); const n = countOk(a); if (A.stat) A.stat('elsproto', n, 'max');
    st.open = true; paint(); toast(res.ok ? 'Abgelegt: Das Protokoll war bei der Kontrolle stimmig.' : 'Abgelegt, aber bei der Kontrolle nicht stimmig oder noch nicht kontrolliert.'); return item;
  }
  function onClick(e) {
    const t = e.target && e.target.closest ? e.target : null; if (!t) return;
    const h = t.closest('[data-h]');
    if (h) {
      const id = h.dataset.id, a = hist();
      if (h.dataset.h === 'load') { const it = a.find(x => x.id === id); if (it) { st.entry = norm(it.entry); st.res = null; commit(); paint(); toast('Protokoll geladen'); } }
      else { A.lsSet(KEY, a.filter(x => x.id !== id)); st.open = true; paint(); toast('Protokoll gelöscht'); }
      return;
    }
    const b = t.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
    if (a === 'take') doTake(); else if (a === 'open') { if (A.loadRig) A.loadRig({ rig: 'pruefplatz', toast: 'Prüfplatz geöffnet: Führe die Prüfschritte aus und übernimm die Werte im Tab Prüfprotokoll.' }); }
    else if (a === 'check') doCheck(); else if (a === 'save') doSave(); else if (a === 'print') printNow(); else if (a === 'csv') exportCsv();
    else if (a === 'import') { const f = H.querySelector('#prFile'); if (f && f.click) f.click(); }
    else if (a === 'clear') { if (st.armed > Date.now()) { st.entry = blank({ pruefer: prefer() }); st.res = null; st.armed = 0; commit(); paint(); toast('Neues Protokoll'); } else { st.armed = Date.now() + 4000; paint(); toast('Nochmal tippen leert das Protokoll.'); setTimeout(() => { if (st.armed && st.armed <= Date.now() + 50) { st.armed = 0; paint(); } }, 4100); } }
  }
  function onChange(e) {
    const t = e.target; if (!t || !t.dataset) return;
    if (t.id === 'prFile') {
      const f = t.files && t.files[0]; if (!f) return;
      const rd = new FileReader(); rd.onload = () => { const en = fromCsv(String(rd.result || '')); if (!en) { toast('In der Datei steht kein Prüfprotokoll.'); return; } st.entry = en; st.res = null; commit(); paint(); toast('CSV geladen'); };
      rd.readAsText(f, 'utf-8'); t.value = ''; return;
    }
    const n = st.entry; let redo = false;
    if (t.dataset.f) { n[t.dataset.f] = String(t.value); redo = t.dataset.f === 'schutzklasse'; }
    else if (t.dataset.m) { n.messwerte = n.messwerte || {}; n.messwerte[t.dataset.m] = String(t.value); }
    else if (t.hasAttribute && t.hasAttribute('data-sichtdone')) { n.sicht = t.checked ? (n.sicht || []) : null; redo = true; }
    else if (t.dataset.mangel) { if (n.sicht === null) return; const i = n.sicht.indexOf(t.dataset.mangel); if (t.checked && i < 0) n.sicht.push(t.dataset.mangel); else if (!t.checked && i >= 0) n.sicht.splice(i, 1); }
    else return;
    commit(); if (redo) paint();
  }
  function render(host, api) {
    A = api; H = host; load();
    once(host, 'c', 'click', onClick); once(host, 'g', 'change', onChange);
    once(host, 'i', 'input', e => { const t = e.target; if (t && t.dataset && (t.dataset.f && t.tagName !== 'SELECT' || t.dataset.m)) { if (t.dataset.f) st.entry[t.dataset.f] = String(t.value); else { st.entry.messwerte = st.entry.messwerte || {}; st.entry.messwerte[t.dataset.m] = String(t.value); } commit(); } });
    paint();
  }
  function refresh() { if (H && A) { load(); paint(); } }
  function redraw() {}

  E.proto = { render, refresh, redraw, fn: { blank, norm, isEmpty, take, checkEntry, limitRows, toCsv, fromCsv, printHtml, addHistory, countOk, mwKeys, html, state: st, HINT, setApi: a => { A = a; } } };
})(typeof window !== 'undefined' ? window : globalThis);
