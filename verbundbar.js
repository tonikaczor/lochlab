'use strict';
/* Tonfunk Verbund: Leiste in jedem Lab (Paket B).
   Die Leiste erscheint nur, wenn die Seite mit ?verbund=<projekt>:<station> geöffnet wurde oder in sessionStorage 'verbund.active' eine aktive Station steht.
   Ohne beides tut diese Datei nichts (außer ein kleines Objekt window.VerbundBar bereitzustellen). Sie lädt dann nach Bedarf
   verbund.js, verbundnl.js, verbundrun.js, verbunddata-<projekt>.js und den Adapter des Labs, wartet auf die Lab-API und ruft einmal adapter.apply auf.
   Prüfen = collect + Verbund.check (nichts wird gespeichert), Übergeben = collect + Verbund.deliver (immer speichern).
   Formularstationen (Datenblatt-Auswahl, Messprotokoll, Fachgespräch, Notiz) rendert die Leiste aus station.form selbst.
   Schnittstellen: Verbund (verbund.js, Paket K), Adapter laut SPEC Abschnitt 5.2. Reine Teile (Parameter, Formular, Datenansicht, Sprachbefehle) stehen in VerbundBar.pure
   und laufen auch in Node (quelle/verbund/test_verbundbar.js). Auch der Hub (verbundui.js) nutzt die reinen Teile. */
(function (root) {
  /* ============================================================ reine Teile */
  const FILE2LAB = { 'layout.html': 'loch', 'schaltplan.html': 'sch', 'simlab.html': 'sim', 'digilab.html': 'digi', 'messlab.html': 'mess', 'hauslab.html': 'haus', 'appwerkstatt.html': 'app', 'pruefungslab.html': 'pr', 'spslab.html': 'sps', 'pcblab.html': 'pcb', 'antlab.html': 'ant', 'senlab.html': 'sen', 'dslab.html': 'ds', 'codelab.html': 'code', 'pilab.html': 'pi', 'verbund.html': 'vb' };
  const LAB2FILE = {}; Object.keys(FILE2LAB).forEach(f => { LAB2FILE[FILE2LAB[f]] = f; });
  const LAB_NAME = { loch: 'LochLab', sch: 'SchaltLab', sim: 'SimLab', digi: 'DigiLab', mess: 'MessLab', haus: 'HausLab', app: 'App-Werkstatt', pr: 'Prüfungs-Lab', sps: 'SPS-Lab', pcb: 'Leiterplatten-Lab', ant: 'Antriebs-Lab', sen: 'Sensorik-Lab', ds: 'Datenblatt-Lab', code: 'Arduino-Lab', pi: 'Pi-Lab', vb: 'Projekte' };
  const LAB_ICON = { loch: '🔳', sch: '📐', sim: '🧪', digi: '🔢', mess: '📟', haus: '🏠', app: '📝', pr: '🎓', sps: '🤖', pcb: '🟩', ant: '⚙️', sen: '📡', ds: '📑', code: '💻', pi: '🍓', vb: '🧩' };
  const ADAPTER_FILE = { sch: 'verbundad-eng.js', sim: 'verbundad-eng.js', digi: 'verbundad-eng.js', mess: 'verbundad-eng.js', haus: 'verbundad-eng.js', code: 'verbundad-mcu.js', pi: 'verbundad-mcu.js', loch: 'verbundad-loch.js', pcb: 'verbundad-pcb.js', sps: 'verbundad-sps.js', ant: 'verbundad-ant.js', sen: 'verbundad-sen.js', ds: 'verbundad-ds.js', app: 'verbundad-app.js', pr: 'verbundad-pr.js' };
  const PID_RE = /^[a-z][a-z0-9]*$/, SID_RE = /^v[a-z]\w*$/;
  const NUMW = { null: 0, ein: 1, eins: 1, eine: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, fuenf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12, zwoelf: 12, dreizehn: 13, vierzehn: 14, fünfzehn: 15, fuenfzehn: 15 };

  /* ?verbund=garage:vg3 (&loesung=1) oder gespeicherte aktive Station "garage:vg3" */
  function parseTarget(search, active) {
    let v = null, sol = false;
    try { const q = new URLSearchParams(String(search || '')); v = q.get('verbund'); sol = q.get('loesung') === '1'; } catch (e) {}
    const fromUrl = !!v; v = v || active || '';
    const m = String(v).match(/^([a-z][a-z0-9]*):(v[a-z]\w*)$/);
    if (!m) return null;
    return { pid: m[1], sid: m[2], fromUrl, loesung: sol && fromUrl };
  }
  function labFromPath(p) { const f = String(p || '').split(/[?#]/)[0].split('/').pop(); return FILE2LAB[f] || null; }
  /* Lade-Reihenfolge: Kern zuerst, dann Hilfsbibliotheken, Projektdaten, Adapter (Pflicht: nur Kern und Projektdaten) */
  /* Kerne, die die Prüfungen der Projekte ohne Oberfläche brauchen (Reihenfolge = Ladereihenfolge; schon vorhandene Skripte der Seite werden nicht doppelt geladen) */
  const DATA_NAME = { giess: 'giessen' };      /* Projekt-ID -> Dateiname verbunddata-<Name>.js (Projekt Gartenbewässerung heißt giess, Datei giessen) */
  const CORE_COMMON = ['dscore.js', 'dslib-semi.js'];
  const PROJECT_CORES = {
    garage: CORE_COMMON.concat(['pcbcore.js', 'sencore.js', 'senrig-opt.js', 'antcore.js', 'spscore.js', 'spsplant-garagentor.js']),
    ampel: CORE_COMMON.concat(['dslib-ic.js', 'spscore.js', 'spsplant-ampel.js', 'arduino.js', 'pyrun.js']),
    uhr: CORE_COMMON.concat(['dslib-ic.js', 'pcbcore.js', 'simics.js', 'simcore.js', 'arduino.js']),
    giess: CORE_COMMON.concat(['pcbcore.js', 'antcore.js', 'spscore.js', 'spsplant-tank.js', 'arduino.js', 'pyrun.js']),
    foerder: CORE_COMMON.concat(['dslib-ic.js', 'pcbcore.js', 'sencore.js', 'senrig-opt.js', 'antcore.js', 'spscore.js', 'spsplant-foerderband.js', 'pyrun.js'])
  };
  function coreList(pid) { return (PROJECT_CORES[pid] || []).slice(); }
  function scriptList(pid, lab) {
    const l = [{ src: 'verbund.js', must: true }, { src: 'verbundnl.js' }, { src: 'verbundrun.js' }, { src: 'verbunddata-' + (DATA_NAME[pid] || pid) + '.js', must: true }];
    if (ADAPTER_FILE[lab]) l.push({ src: ADAPTER_FILE[lab], adapter: true });
    return l;
  }
  const isNum = x => typeof x === 'number' && isFinite(x);
  /* deutsche Zahl: "4,7", " 1 000,5 ", "-3" */
  function parseNum(s) {
    if (isNum(s)) return s;
    const t = String(s == null ? '' : s).replace(/\s/g, '').replace(',', '.');
    return /^[+-]?(\d+(?:\.\d+)?|\.\d+)(e[+-]?\d+)?$/i.test(t) ? parseFloat(t) : NaN;
  }
  function fmtNum(n, maxDec) {
    if (!isNum(n)) return '–';
    const a = Math.abs(n); let d = maxDec == null ? (a >= 1000 ? 0 : a >= 100 ? 1 : a >= 1 ? 2 : a === 0 ? 0 : 4) : maxDec;
    let s = n.toFixed(d); if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s.replace('.', ',');
  }
  /* Formularfelder: key,label,type,options[{value,label}],unit,hint */
  function normFields(form) {
    return (Array.isArray(form) ? form : []).filter(f => f && typeof f === 'object' && f.key).map(f => ({
      key: String(f.key), label: String(f.label == null ? f.key : f.label),
      type: ['select', 'number', 'text', 'eseries', 'area'].indexOf(f.type) >= 0 ? f.type : 'text',
      options: (Array.isArray(f.options) ? f.options : []).map(o => (o && typeof o === 'object' ? { value: String(o.value), label: String(o.label == null ? o.value : o.label) } : { value: String(o), label: String(o) })),
      unit: f.unit ? String(f.unit) : '', hint: f.hint ? String(f.hint) : ''
    }));
  }
  const ESER_RE = /^\d+(?:[.,]\d+)?\s*[kKMGmRrΩuµnp]?\s*\d*\s*(?:Ω|ohm)?$/;
  /* Formularwerte (Texte) → data-Objekt; errs = lesbare Eingabefehler. Leere Felder werden null/'' (die Prüfung wertet das aus). */
  function formToData(form, vals) {
    const data = {}, errs = []; vals = vals && typeof vals === 'object' ? vals : {};
    normFields(form).forEach(f => {
      const raw = vals[f.key] == null ? '' : String(vals[f.key]), t = f.type === 'area' ? raw.replace(/\r\n/g, '\n') : raw.trim();
      if (f.type === 'number') {
        if (t === '') data[f.key] = null; else { const n = parseNum(t); if (isNum(n)) data[f.key] = n; else { data[f.key] = null; errs.push(f.label + ': „' + t + '“ ist keine Zahl.'); } }
      } else if (f.type === 'select') {
        if (t === '') data[f.key] = null;
        else if (!f.options.length || f.options.some(o => o.value === t)) data[f.key] = t;
        else { data[f.key] = null; errs.push(f.label + ': Auswahl „' + t + '“ gibt es nicht.'); }
      } else if (f.type === 'eseries') {
        if (t !== '' && !ESER_RE.test(t)) errs.push(f.label + ': „' + t + '“ ist kein lesbarer Wert (Beispiele: 470, 4k7, 2,2k, 1M).');
        data[f.key] = t;
      } else data[f.key] = t;
    });
    return { data, errs };
  }
  /* data-Objekt → Formularwerte (Texte, Zahlen mit Komma) */
  function dataToForm(form, data) {
    const v = {}; data = data && typeof data === 'object' ? data : {};
    normFields(form).forEach(f => { const x = data[f.key]; v[f.key] = x == null ? '' : isNum(x) ? fmtNum(x, 6) : String(x); });
    return v;
  }
  /* Lesbare Zeilen aus beliebigen Daten (für „Eingangsdaten ansehen“): [{k, v}] */
  function humanRows(data, opt) {
    opt = opt || {}; const max = opt.max || 80, rows = []; let more = 0;
    if (data && !Array.isArray(data) && typeof data === 'object' && Array.isArray(data.hidden)) { const d = {}; Object.keys(data).forEach(k => { if (k !== 'hidden' && data.hidden.indexOf(k) < 0) d[k] = data[k]; }); data = d; }   // params.hidden: Lösungswerte des Lastenhefts nicht anzeigen (Uhr)
    const prim = x => x == null || ['string', 'number', 'boolean'].indexOf(typeof x) >= 0;
    const val = x => { if (x == null) return '–'; if (typeof x === 'boolean') return x ? 'ja' : 'nein'; if (isNum(x)) return fmtNum(x); if (typeof x === 'number') return '–'; const s = String(x).replace(/\s+/g, ' '); return s.length > 140 ? s.slice(0, 137) + ' …' : s; };
    const flat = o => Object.keys(o).map(k => k + '=' + (prim(o[k]) ? val(o[k]) : Array.isArray(o[k]) && o[k].every(prim) ? '[' + o[k].map(val).join(' ') + ']' : '…')).join(', ');
    const push = (k, v) => { if (rows.length >= max) more++; else rows.push({ k, v }); };
    const walk = (x, key, depth, seen) => {
      if (prim(x)) { push(key, val(x)); return; }
      if (seen.indexOf(x) >= 0) { push(key, '(Verweis)'); return; }
      const s2 = seen.concat([x]);
      if (Array.isArray(x)) {
        if (!x.length) { push(key, '(leer)'); return; }
        if (x.every(prim)) { push(key, x.length > 14 ? x.slice(0, 14).map(val).join(', ') + ' … (' + x.length + ')' : x.map(val).join(', ')); return; }
        if (depth >= 3 || x.every(e => e && typeof e === 'object' && !Array.isArray(e) && Object.keys(e).every(k => prim(e[k]) || (Array.isArray(e[k]) && e[k].every(prim))))) {
          x.slice(0, 16).forEach((e, i) => push(key + '[' + (i + 1) + ']', e && typeof e === 'object' && !Array.isArray(e) ? flat(e) : '…'));
          if (x.length > 16) push(key, '… und ' + (x.length - 16) + ' weitere');
          return;
        }
        x.slice(0, 16).forEach((e, i) => walk(e, key + '[' + (i + 1) + ']', depth + 1, s2));
        return;
      }
      const ks = Object.keys(x); if (!ks.length) { push(key, '(leer)'); return; }
      if (depth >= 3) { let n = 0; try { n = JSON.stringify(x).length; } catch (e) {} push(key, '(Rohdaten, ' + n + ' Zeichen)'); return; }
      ks.forEach(k => walk(x[k], key ? key + '.' + k : k, depth + 1, s2));
    };
    try { walk(data, '', 0, []); } catch (e) { push('Fehler', 'Daten nicht lesbar'); }
    if (more) rows.push({ k: '…', v: more + ' weitere Zeilen' });
    return rows.map(r => ({ k: r.k || '(Wert)', v: r.v }));
  }
  /* Sprachbefehle für die Leiste/den Hub: „öffne Station drei“, „prüfen“, „übergeben“, „übersicht“, „auftrag“, „tipp“ */
  function parseVoice(text) {
    const t = String(text || '').toLowerCase().replace(/[,.!?;:]/g, ' ').replace(/\s+/g, ' ').trim(); if (!t) return null;
    let m = t.match(/\bstation (\d+|[a-zäöüß]+)\b/);
    if (m) { const n = /^\d+$/.test(m[1]) ? +m[1] : NUMW[m[1]]; if (n >= 1 && n <= 99) return { cmd: 'open', n }; }
    if (/\b(prüfe|prüfen|überprüfe|pruefe|pruefen)\b|\bprüf/.test(t)) return { cmd: 'check' };
    if (/übergeb|uebergeb|abgeb|gib ab/.test(t)) return { cmd: 'give' };
    if (/übersicht|uebersicht|projektübersicht|zurück zum projekt/.test(t)) return { cmd: 'hub' };
    if (/auftrag|lastenheft/.test(t)) return { cmd: 'panel' };
    if (/\btipp\b|hinweis|hilfe/.test(t)) return { cmd: 'hint' };
    if (/gesamttest|abschlusstest/.test(t)) return { cmd: 'final' };
    return null;
  }
  const labUrl = (lab, pid, sid, extra) => (LAB2FILE[lab] || 'index.html') + '?verbund=' + encodeURIComponent(pid) + ':' + encodeURIComponent(sid) + (extra || '');
  /* Tipp-Texte merken (Verbund.hint liefert nur die aktuelle Stufe): localStorage 'verbund.ht.<pid>.<sid>' = { s: seed, t: {1:'…',2:'…'} } */
  function hintMerge(old, seed, step, text) {
    const o = old && typeof old === 'object' && old.s === seed && old.t && typeof old.t === 'object' ? { s: seed, t: Object.assign({}, old.t) } : { s: seed, t: {} };
    if (step >= 1 && step <= 3 && text) o.t[step] = String(text); return o;
  }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hintKey = (pid, sid) => 'verbund.ht.' + pid + '.' + sid;
  const pure = { DATA_NAME, PROJECT_CORES, coreList, hintKey, FILE2LAB, LAB2FILE, LAB_NAME, LAB_ICON, ADAPTER_FILE, PID_RE, SID_RE, parseTarget, labFromPath, scriptList, parseNum, fmtNum, normFields, formToData, dataToForm, humanRows, parseVoice, labUrl, hintMerge, esc };
  const BAR = { pure, version: '1.0', active: false };
  root.VerbundBar = BAR;
  if (typeof module !== 'undefined' && module.exports) module.exports = BAR;
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  /* ============================================================ Leiste im Browser */
  const ss = { get: k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} }, del: k => { try { sessionStorage.removeItem(k); } catch (e) {} } };
  const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } } };
  const labId = () => root.LAB || (root.LabTrainerAPI && root.LabTrainerAPI.lab) || labFromPath(location.pathname) || '';
  const LAB = labId();
  if (LAB === 'vb') return;                       /* der Hub hat seine eigene Oberfläche */
  const target = parseTarget(location.search, ss.get('verbund.active'));
  if (!target) return;
  BAR.active = true;
  ss.set('verbund.active', target.pid + ':' + target.sid);
  const labName = l => (root.LAB_REG && root.LAB_REG[l] && root.LAB_REG[l].name) || LAB_NAME[l] || l;
  const T = { pid: target.pid, sid: target.sid, V: null, def: null, st: null, ad: null, adapters: {}, form: {}, panel: false, min: ss.get('verbund.bar.min') === '1', err: '', note: '', applied: false, lastCheck: null };
  const $ = (s, r) => (r || document).querySelector(s);
  const css = document.createElement('style');
  css.textContent = `
html.vbb-on #app{height:calc(100vh - var(--vbh,48px))!important;height:calc(100dvh - var(--vbh,48px))!important}
.vbb{position:sticky;top:0;z-index:390;background:#1b2530;color:#e8ecf0;border-bottom:2px solid #3b9eff;font:14px/1.3 -apple-system,system-ui,"Segoe UI",sans-serif;-webkit-user-select:none;user-select:none;box-sizing:border-box;padding-top:env(safe-area-inset-top)}
.vbb *{box-sizing:border-box}
.vbb-row{display:flex;align-items:center;gap:6px;padding:4px 8px;flex-wrap:wrap;min-height:46px}
.vbb-ico{font-size:22px;flex:none;width:30px;text-align:center}
.vbb-t{flex:1 1 170px;min-width:120px}.vbb-t b{display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.vbb-t small{display:block;color:#aab6c2;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vbb-in{flex:0 1 auto;font-size:12px;color:#aab6c2;display:flex;gap:6px;flex-wrap:wrap}.vbb-in span{padding:2px 7px;border-radius:10px;background:#0006;border:1px solid #38424d;white-space:nowrap}.vbb-in span.ok{color:#4cd964;border-color:#2c7a3c}.vbb-in span.no{color:#ff8a7a;border-color:#a8433a}
.vbb button,.vbb a.vbb-b{font:inherit;color:inherit;background:#2c343e;border:1px solid #4a5662;border-radius:20px;min-height:40px;padding:0 14px;cursor:pointer;touch-action:manipulation;display:inline-flex;align-items:center;gap:5px;white-space:nowrap;text-decoration:none;font-weight:600;flex:none}
.vbb button:active,.vbb a.vbb-b:active{background:#3b4652}
.vbb button.pri{background:#2fae45;border-color:#2fae45;color:#fff}.vbb button.acc{background:#3b9eff;border-color:#3b9eff;color:#fff}
.vbb button[disabled]{opacity:.4;cursor:default}
.vbb button.ic{padding:0;width:40px;justify-content:center}
.vbb-panel{position:absolute;left:0;right:0;top:100%;max-height:min(64vh,560px);overflow:auto;background:#222a33;border-bottom:2px solid #3b9eff;box-shadow:0 10px 24px #0009;padding:10px 14px 16px;-webkit-user-select:text;user-select:text}
.vbb-panel h4{margin:14px 0 6px;font-size:11.5px;text-transform:uppercase;letter-spacing:.07em;color:#8d99a6}.vbb-panel h4:first-child{margin-top:0}
.vbb-panel p{margin:.4em 0;line-height:1.45}.vbb-panel ul{margin:.3em 0;padding-left:20px}.vbb-panel li{margin:.15em 0}
.vbb-panel table{border-collapse:collapse;width:100%;font-size:12.5px}.vbb-panel td{padding:3px 6px;border-top:1px solid #38424d;vertical-align:top}.vbb-panel td:first-child{color:#8d99a6;white-space:nowrap;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px}
.vbb-panel details{margin:4px 0}.vbb-panel summary{min-height:36px;display:flex;align-items:center;cursor:pointer;color:#3b9eff;font-weight:600}
.vbb-panel .f{display:block;margin:0 0 10px}.vbb-panel .f span{display:block;font-size:12px;color:#8d99a6;margin-bottom:3px}
.vbb-panel input,.vbb-panel select,.vbb-panel textarea{width:100%;font:inherit;font-size:16px;color:#e8ecf0;background:#14181c;border:1px solid #38424d;border-radius:10px;padding:9px 11px;min-height:42px;-webkit-user-select:text;user-select:text}
.vbb-panel textarea{font:13px/1.45 ui-monospace,Menlo,Consolas,monospace;min-height:110px}
.vbb-panel .hintx{color:#8d99a6;font-size:12px;margin-top:2px}
.vbb-panel .btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.vbb-note{background:rgba(255,179,64,.14);border:1px solid #c97a1a;border-radius:10px;padding:8px 12px;font-size:13px;margin:6px 0}
.vbb-err{background:rgba(255,92,92,.14);border:1px solid #a8433a;border-radius:10px;padding:8px 12px;font-size:13px;margin:6px 0}
.vbb-bd{position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center}
.vbb-sh{background:#222a33;color:#e8ecf0;width:100%;max-width:580px;max-height:88dvh;border-radius:16px 16px 0 0;display:flex;flex-direction:column;padding-bottom:env(safe-area-inset-bottom);font:14px/1.4 -apple-system,system-ui,"Segoe UI",sans-serif}
@media(min-width:700px){.vbb-bd{align-items:center}.vbb-sh{border-radius:16px}}
.vbb-sh .h{display:flex;align-items:center;justify-content:space-between;padding:10px 8px 6px 16px;border-bottom:1px solid #38424d;font-size:16px;font-weight:700}
.vbb-sh .h button{width:40px;height:40px;font-size:18px;color:#8d99a6;background:none;border:0;cursor:pointer}
.vbb-sh .b{overflow:auto;padding:10px 14px 16px;-webkit-user-select:text;user-select:text}
.vbb-sh .big{font-size:30px;font-weight:800;margin:0}.vbb-sh .big.ok{color:#4cd964}.vbb-sh .big.no{color:#ffb340}
.vbb-sh ul.l{list-style:none;margin:8px 0;padding:0}.vbb-sh ul.l li{padding:6px 0 6px 26px;position:relative;border-top:1px solid #38424d;font-size:13.5px}.vbb-sh ul.l li:before{content:'✗';position:absolute;left:4px;color:#ff8a7a;font-weight:700}.vbb-sh ul.l li.ok:before{content:'✓';color:#4cd964}.vbb-sh ul.l li.ok{color:#c9d2da}
.vbb-sh .btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:44px;padding:0 16px;border-radius:12px;background:#2c343e;border:1px solid #4a5662;color:#e8ecf0;font:inherit;font-weight:600;text-decoration:none;cursor:pointer}
.vbb-sh .btn.pri{background:#2fae45;border-color:#2fae45;color:#fff}
.vbb-sh .btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.vbb-toast{position:fixed;left:50%;bottom:calc(76px + env(safe-area-inset-bottom));transform:translateX(-50%);background:#000d;color:#fff;padding:9px 16px;border-radius:99px;z-index:520;font:14px system-ui,sans-serif;max-width:92vw;text-align:center;pointer-events:none}
@media(max-width:700px){.vbb-in{display:none}}
@media print{.vbb,.vbb-bd,.vbb-toast{display:none!important}html.vbb-on #app{height:auto!important}}`;
  document.head.appendChild(css);
  const bar = document.createElement('div'); bar.className = 'vbb'; bar.id = 'vbBar'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Verbundprojekt');
  const setH = () => { const h = Math.ceil(bar.getBoundingClientRect().height) || 48; document.documentElement.style.setProperty('--vbh', h + 'px'); };
  let rzT = 0; const relayout = () => { setH(); clearTimeout(rzT); rzT = setTimeout(() => { try { window.dispatchEvent(new Event('resize')); } catch (e) {} }, 60); };
  function mount() {
    document.documentElement.classList.add('vbb-on');
    document.body.insertBefore(bar, document.body.firstChild);
    if (window.ResizeObserver) new ResizeObserver(() => relayout()).observe(bar);
    relayout();
  }
  function toast(m) { const t = document.createElement('div'); t.className = 'vbb-toast'; t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), Math.max(2600, m.length * 55)); }
  function sheet(title, build) {
    const bd = document.createElement('div'); bd.className = 'vbb-bd';
    bd.innerHTML = '<div class="vbb-sh" role="dialog" aria-label="' + esc(title) + '"><div class="h"><span>' + esc(title) + '</span><button class="x" aria-label="Schließen">✕</button></div><div class="b"></div></div>';
    document.body.appendChild(bd);
    const close = () => bd.remove();
    bd.addEventListener('pointerdown', e => { if (e.target === bd) close(); });
    $('.x', bd).onclick = close; build($('.b', bd), close); return close;
  }

  /* ---- Zugriff auf Kern, Projekt, Station ---- */
  const V = () => T.V || root.Verbund;
  const stationDef = () => (T.def && Array.isArray(T.def.stations) ? T.def.stations.find(s => s.id === T.sid) : null) || null;
  function status() { try { return V().status(T.pid); } catch (e) { return null; } }
  function stInfo() { const s = status(); if (!s) return null; const i = s.stations.findIndex(x => x.id === T.sid); return i < 0 ? null : { s: s.stations[i], i, n: s.stations.length, all: s }; }
  function levelPass(st) { const i = stInfo(); if (i && i.s.pass != null) return i.s.pass; const lv = T.def && T.def.levels && T.def.levels[(V().state(T.pid) || {}).level]; return st && st.pass != null ? st.pass : (lv && lv.pass) || 80; }
  function ctx(extra) {
    const v = V(), stt = v.state(T.pid) || {};
    return Object.assign({ pid: T.pid, sid: T.sid, seed: stt.seed || 0, spec: v.spec(T.pid), level: stt.level || 2, assist: (stt.level || 2) === 1, name: stt.name || '', get: s => v.get(String(s).indexOf('.') >= 0 ? s : T.pid + '.' + s), V: v, form: Object.assign({}, T.form) }, extra || {});
  }
  const formKey = () => 'verbund.form.' + T.pid + '.' + T.sid;
  function seedOf() { const s = V() && V().state(T.pid); return s ? s.seed : 0; }
  function loadForm() {
    T.form = {}; try { const o = JSON.parse(ls.get(formKey()) || 'null'); if (o && o.seed === seedOf() && o.v && typeof o.v === 'object') T.form = o.v; } catch (e) {}
  }
  function saveForm() { ls.set(formKey(), JSON.stringify({ seed: seedOf(), v: T.form })); }
  const hintKeyT = () => hintKey(T.pid, T.sid);
  const hintCache = () => { try { return JSON.parse(ls.get(hintKeyT()) || 'null'); } catch (e) { return null; } };

  /* ---- Laden der Skripte ---- */
  function loadScript(src) {
    return new Promise(res => {
      if (document.querySelector('script[data-vb="' + src + '"]')) { res(true); return; }
      const s = document.createElement('script'); s.src = src; s.dataset.vb = src;
      s.onload = () => res(true); s.onerror = () => { s.remove(); res(false); }; document.head.appendChild(s);
    });
  }
  async function loadAll() {
    const list = scriptList(T.pid, LAB);
    /* Kerne der Projektprüfungen nachladen, wenn die Seite sie nicht selbst mitbringt: nach Kern, Netzlisten-Kern und Läufer, vor den Projektdaten */
    const cores = coreList(T.pid).filter(f => !document.querySelector('script[src="' + f + '"],script[src^="' + f + '?"]')).map(f => ({ src: f }));
    list.splice(Math.min(3, list.length), 0, ...cores);
    for (const it of list) {
      const ok = await loadScript(it.src);
      if (!ok && it.must) { T.err = it.src === 'verbund.js' ? 'Projektkern (verbund.js) nicht geladen. Seite neu laden oder Verbindung prüfen.' : 'Projektdaten (' + it.src + ') fehlen. Seite neu laden.'; return false; }
      if (!ok && it.adapter) T.note = 'Für dieses Lab fehlt der Adapter (' + it.src + ').';
    }
    T.V = root.Verbund || null;
    if (!T.V) { T.err = 'Projektkern nicht verfügbar.'; return false; }
        try { T.def = T.V.project(T.pid); } catch (e) { T.def = null; }
    if (!T.def) { T.err = 'Projekt „' + T.pid + '“ ist nicht registriert (Projektdaten fehlen).'; return false; }
    if (!stationDef()) { T.err = T.def.final && T.def.final.id === T.sid ? 'final' : 'Station „' + T.sid + '“ gibt es in diesem Projekt nicht.'; return false; }
    if (!T.V.state(T.pid)) { T.err = 'Das Projekt wurde noch nicht gestartet. Bitte in der Übersicht starten (Teamname und Stufe wählen).'; return false; }
    try { T.V.setActive(T.pid, T.sid); } catch (e) {}
    T.mism = stationDef().on !== LAB;           /* Station gehört in ein anderes Lab: nur Hinweis und Link, kein Adapter */
    if (T.mism) return true;
    T.ad = (typeof T.V.adapter === 'function' ? T.V.adapter(LAB) : null) || (root.VERBUND_ADAPTERS && root.VERBUND_ADAPTERS[LAB]) || null;
    if (!T.ad && !T.note && !(stationDef().form || []).length) T.note = 'Der Adapter für dieses Lab hat sich nicht angemeldet.';
    return true;
  }
  function waitReady() {
    return new Promise(res => {
      if (!T.ad || typeof T.ad.ready !== 'function') { res(true); return; }
      const t0 = Date.now(); const tick = () => { let ok = false; try { ok = !!T.ad.ready(); } catch (e) {} if (ok) res(true); else if (Date.now() - t0 > 15000) res(false); else setTimeout(tick, 200); }; tick();
    });
  }

  /* ---- Startdaten laden (einmal) ---- */
  async function runApply(force, solution) {
    const st = stationDef(), key = 'verbund.applied.' + T.pid + '.' + T.sid;
    if (!force && ss.get(key) === '1') {   // Seite neu geladen: Startdaten nicht noch einmal laden, der Adapter kann aber auf Folgen hinweisen (SPS: Standardanlage)
      T.applied = true; if (T.ad && typeof T.ad.reloadNote === 'function') { try { const m = T.ad.reloadNote(st, ctx()); if (m) T.note = m; } catch (e) {} } return;
    }
    if (!T.ad || typeof T.ad.apply !== 'function') { T.applied = true; ss.set(key, '1'); return; }
    let r = null;
    try { r = await T.ad.apply(st, ctx(solution ? { solution, assist: true } : {})); } catch (e) { r = { ok: false, msg: 'Fehler beim Laden der Startdaten: ' + (e && e.message ? e.message : e) }; }
    if (r && r.ok === false) { T.note = (r.msg || 'Startdaten konnten nicht geladen werden.'); render(); return; }
    ss.set(key, '1'); T.applied = true; T.note = '';
    toast((r && r.msg) || (solution ? 'Musterlösung geladen. Deine Arbeit ist gesichert.' : 'Startdaten geladen. Deine bisherige Arbeit ist gesichert.'));
  }

  /* ---- Prüfen und Übergeben ---- */
  async function collect() {
    const st = stationDef(), fields = normFields(st.form);
    let fd = null;
    if (fields.length) {
      fd = formToData(st.form, T.form);
      if (fd.errs.length) return { error: 'Bitte zuerst im Formular korrigieren:\n• ' + fd.errs.join('\n• ') };
    }
    let r = null;
    if (T.ad && typeof T.ad.collect === 'function') {
      try { r = await T.ad.collect(st, ctx({ form: Object.assign({}, T.form), formData: fd ? fd.data : null })); } catch (e) { return { error: 'Der Lab-Stand konnte nicht gelesen werden: ' + (e && e.message ? e.message : e) }; }
    } else if (fd) {
      let d = fd.data; if (typeof st.fromForm === 'function') { try { d = st.fromForm(fd.data, ctx({ form: Object.assign({}, T.form), formData: fd.data })); } catch (e) { return { error: 'Das Formular konnte nicht ausgewertet werden: ' + (e && e.message ? e.message : e) }; } }
      r = { type: st.type, data: d };
    }
    else return { error: T.note || 'Dieses Lab ist nicht bereit (Adapter fehlt).' };
    if (!r || r.error || !r.data) return { error: (r && r.error) || 'Es gibt noch nichts zu prüfen.' };
    return { type: r.type || st.type, data: r.data };
  }
  const statusText = (s, pass) => (s.state === 'passed' ? 'bestanden' : s.state === 'stale' ? 'Eingang geändert, neu prüfen' : s.state === 'failed' ? 'nicht bestanden (Grenze ' + pass + ' %)' : s.state === 'locked' ? 'gesperrt' : 'offen');
  function linesHtml(res) {
    return '<ul class="l">' + (res.lines || []).map(l => '<li class="' + (l.ok ? 'ok' : '') + '">' + esc(l.text) + (l.max ? ' <small style="color:#8d99a6">(' + (l.ok ? l.pts : 0) + '/' + l.max + ')</small>' : '') + '</li>').join('') + '</ul>';
  }
  async function doCheck() {
    const c = await collect(); if (c.error) { errSheet(c.error); return; }
    let r; try { r = V().check(T.pid, T.sid, c.data); } catch (e) { r = null; }
    if (!r || r.ok === false) { errSheet((r && r.msg) || 'Die Prüfung ist fehlgeschlagen.'); return; }
    const pass = levelPass(stationDef());
    sheet('Prüfen (nichts wird gespeichert)', b => {
      b.innerHTML = '<p class="big ' + (r.pct >= pass ? 'ok' : 'no') + '">' + Math.round(r.pct) + ' %</p><p style="margin:0;color:#aab6c2">' + (r.pct >= pass ? 'Das würde bestehen.' : 'Bestehen ab ' + pass + ' %.') + ' Mit „Übergeben“ speicherst du diesen Stand.</p>' + linesHtml(r) + inputsHtml(r);
    });
  }
  function inputsHtml(r) {
    const bad = (r.inputs || []).filter(i => !i.ok); if (!bad.length) return '';
    return '<div class="vbb-err">Eingang fehlt oder ist veraltet: ' + bad.map(i => esc(i.slot)).join(', ') + '. Hole die Vorstation nach.</div>';
  }
  function errSheet(msg) { sheet('Das klappt noch nicht', b => { b.innerHTML = '<p style="white-space:pre-wrap">' + esc(msg) + '</p>'; }); }
  function celebrate() { try { if (root.Badges && root.Badges.confetti) root.Badges.confetti(); } catch (e) {} try { if (root.Badges && root.Badges.chime) root.Badges.chime(); else if (root.LochFX && root.LochFX.sound) root.LochFX.sound('ok'); } catch (e) {} }
  async function doGive() {
    const st = stationDef(), info = stInfo(); if (info && info.s.state === 'locked') { errSheet('Diese Station ist noch gesperrt. Schließe zuerst die Vorstation ab.'); return; }
    const c = await collect(); if (c.error) { errSheet(c.error); return; }
    let r; try { r = V().deliver(st.out, { type: c.type, data: c.data, station: T.sid, from: LAB }); } catch (e) { r = { ok: false, err: String(e && e.message || e) }; }
    if (!r || !r.ok) {
      const e = r && r.err; errSheet(e === 'speicher' ? 'Speicher voll: Sichere das Projekt als Datei (Übersicht ▸ Teilen) und lösche alte Platinen oder Programme.' : 'Die Übergabe wurde nicht gespeichert' + (r && (r.msg || r.err) ? ': ' + (r.msg || r.err) : '.'));
      return;
    }
    const res = r.check || V().check(T.pid, T.sid) || { pct: 0, lines: [] }, ok = !!res.passed;
    let nxt = null; try { nxt = V().next(T.pid); } catch (e) {}
    const sInfo = status(), ns = nxt && nxt !== 'final' && sInfo ? sInfo.stations.find(x => x.id === nxt) : null;
    if (ok) celebrate();
    sheet(ok ? 'Übergeben: bestanden' : 'Übergeben: noch nicht bestanden', b => {
      let h = '<p class="big ' + (ok ? 'ok' : 'no') + '">' + Math.round(res.pct) + ' %</p><p style="margin:0;color:#aab6c2">' + (ok ? 'Gespeichert. Die nächste Station bekommt deine Daten.' : 'Gespeichert, damit du deinen Stand siehst. Bestehen ab ' + levelPass(st) + ' %. Verbessere und übergib erneut.') + '</p>' + linesHtml(res);
      h += '<div class="btns">';
      if (ok && ns) h += '<a class="btn pri" href="' + esc(labUrl(ns.on, T.pid, ns.id)) + '">Weiter zu Station ' + (sInfo.stations.indexOf(ns) + 1) + ' (' + esc(labName(ns.on)) + ')</a>';
      else if (ok && nxt === 'final') h += '<a class="btn pri" href="verbund.html?projekt=' + esc(T.pid) + '&final=1">Zum Gesamttest</a>';
      h += '<a class="btn" href="' + esc(hubUrl()) + '">Zur Übersicht</a></div>';
      b.innerHTML = h;
    });
    render();
  }
  const hubUrl = () => 'verbund.html?projekt=' + encodeURIComponent(T.pid) + '&station=' + encodeURIComponent(T.sid);

  /* ---- Tipps ---- */
  async function doHint() {
    let h; try { h = V().hint(T.pid, T.sid); } catch (e) { h = null; }
    if (!h || h.ok === false || !h.text) { errSheet((h && h.msg) || 'Es gibt keinen weiteren Tipp.'); return; }
    ls.set(hintKeyT(), JSON.stringify(hintMerge(hintCache(), seedOf(), h.step, h.text)));
    showHints(h.step, !!h.solution);
  }
  function showHints(step, sol) {
    const c = hintCache(), t = (c && c.t) || {};
    sheet('Tipp, Stufe ' + step + ' von 3', (b, close) => {
      let h = ''; for (let i = 1; i <= step; i++) if (t[i]) h += '<p><b>Stufe ' + i + ':</b> ' + esc(t[i]) + '</p>';
      if (step < 3) h += '<p style="color:#8d99a6;font-size:13px">Brauchst du mehr Hilfe? Tippe noch einmal auf „Tipp“. Dein Ausbilder sieht, wie viele Tipps du gebraucht hast.</p>';
      else if (sol) h += '<p>Stufe 3 bietet die Musterlösung. Sie wird ins Lab geladen, dein Stand bleibt gesichert. Die Station zählt dann als „mit Hilfe“.</p>' + (stationDef().solNote ? '<p><b>Hinweis:</b> ' + esc(stationDef().solNote) + '</p>' : '') + '<div class="btns"><button class="btn pri" id="vbSol">Musterlösung laden</button></div>';
      b.innerHTML = h; const s = $('#vbSol', b); if (s) s.onclick = () => { close(); loadSolution(); };
    });
  }
  /* Formular aus Musterlösungsdaten füllen: Adapter kann das umkehren (adapter.fillForm(station, data, ctx) → Werte), sonst gleiche Schlüssel */
  function fillFormFrom(st, d) {
    if (!normFields(st.form).length || !d || typeof d !== 'object') return;
    let v = null;
    if (typeof st.toForm === 'function') { try { v = st.toForm(d, ctx()); } catch (e) { v = null; } }            // die Station kennt ihre Datenform am besten
    if (!v && T.ad && typeof T.ad.fillForm === 'function') { try { v = T.ad.fillForm(st, d, ctx()); } catch (e) { v = null; } }
    T.form = v && typeof v === 'object' ? Object.keys(v).reduce((a, k) => { a[k] = v[k] == null ? '' : typeof v[k] === 'number' ? fmtNum(v[k], 6) : String(v[k]); return a; }, {}) : dataToForm(st.form, d); saveForm();
  }
  async function loadSolution() {
    let p = null; try { p = V().solution(T.pid, T.sid); } catch (e) {}
    if (!p || p.ok === false) { errSheet((p && p.msg) || 'Die Musterlösung gibt es erst ab Tipp-Stufe 3 (oder für den Ausbilder).'); return; }
    fillFormFrom(stationDef(), p.data);
    await runApply(true, p); render();
  }

  /* ---- Anzeige ---- */
  function panelHtml() {
    const st = stationDef(), v = V(), info = stInfo(); let h = '';
    h += '<h4>Auftrag</h4><p>' + esc(st.text || '') + '</p>';
    if (T.err) h += '<div class="vbb-err">' + esc(T.err) + '</div>';
    if (T.note) h += '<div class="vbb-note">' + esc(T.note) + '</div>';
    let le = null; try { le = v.get(T.pid + '.lastenheft'); } catch (e) {}
    if (le) {
      h += '<h4>Lastenheft</h4>' + (Array.isArray(le.text) && le.text.length ? '<ul>' + le.text.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '');
      const pr = humanRows(le.params || {}); if (pr.length) h += '<details><summary>Zahlen des Lastenhefts</summary><table>' + pr.map(r => '<tr><td>' + esc(r.k) + '</td><td>' + esc(r.v) + '</td></tr>').join('') + '</table></details>';
    }
    const ins = Array.isArray(st.in) ? st.in : [];
    if (ins.length) {
      h += '<h4>Eingang aus früheren Stationen</h4>';
      ins.forEach(s => {
        let ok = false, d = null; try { ok = v.has(s); d = ok ? v.get(s) : null; } catch (e) {}
        const rows = d ? humanRows(d) : [];
        h += '<details' + (ok ? '' : ' open') + '><summary>' + (ok ? '✓ ' : '✗ ') + esc(s) + (ok ? '' : ' (fehlt)') + '</summary>' + (rows.length ? '<table>' + rows.map(r => '<tr><td>' + esc(r.k) + '</td><td>' + esc(r.v) + '</td></tr>').join('') + '</table>' : '<p class="hintx">' + (ok ? 'Keine lesbaren Daten.' : 'Diese Station wurde noch nicht übergeben.') + '</p>') + '</details>';
      });
    }
    const fields = normFields(st.form);
    if (fields.length) {
      h += '<h4>Eintragen</h4>' + fields.map(f => {
        const val = T.form[f.key] == null ? '' : String(T.form[f.key]); let inp;
        if (f.type === 'select') inp = '<select data-k="' + esc(f.key) + '"><option value="">– bitte wählen –</option>' + f.options.map(o => '<option value="' + esc(o.value) + '"' + (o.value === val ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('') + '</select>';
        else if (f.type === 'area') inp = '<textarea data-k="' + esc(f.key) + '" spellcheck="false">' + esc(val) + '</textarea>';
        else inp = '<input data-k="' + esc(f.key) + '" type="text" inputmode="' + (f.type === 'number' ? 'decimal' : 'text') + '" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" value="' + esc(val) + '">';
        return '<label class="f"><span>' + esc(f.label) + (f.unit ? ' (' + esc(f.unit) + ')' : '') + '</span>' + inp + (f.hint ? '<div class="hintx">' + esc(f.hint) + '</div>' : '') + '</label>';
      }).join('');
    }
    if (info) {
      h += '<h4>Stand</h4><p>' + (info.s.pct != null && info.s.state !== 'open' && info.s.state !== 'locked' ? '<b>' + Math.round(info.s.pct) + ' %</b> · ' : '') + esc(statusText(info.s, levelPass(st))) + (info.s.hints ? ' · Tipps benutzt: ' + info.s.hints : '') + '</p>';
    }
    h += '<div class="btns"><button data-a="hint">💡 Tipp</button>' + (T.ad && typeof T.ad.live === 'function' ? '<button data-a="live">Live-Hinweise</button>' : '') + (T.ad && typeof T.ad.apply === 'function' && !(info && info.s.state === 'locked') ? '<button data-a="reapply">Startdaten neu laden</button>' : '') + '<button data-a="end">Verbundprojekt beenden</button></div><div id="vbLive"></div>';
    return h;
  }
  async function doLive() {
    const box = $('#vbLive'); if (!box) return; let rows = null;
    try { rows = await T.ad.live(stationDef(), ctx()); } catch (e) { rows = [{ ok: false, text: 'Live-Hinweise gerade nicht möglich.' }]; }
    rows = Array.isArray(rows) ? rows : [];
    box.innerHTML = '<h4 style="margin:14px 0 6px;font-size:11.5px;text-transform:uppercase;color:#8d99a6">Live-Hinweise</h4>' + (rows.length ? '<ul class="l" style="list-style:none;padding:0">' + rows.map(r => '<li>' + (r.ok ? '✓ ' : '✗ ') + esc(r.text) + '</li>').join('') + '</ul>' : '<p class="hintx">Keine Hinweise.</p>');
  }
  function render() {
    const ae = document.activeElement;
    if (ae && bar.contains(ae) && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && !render.force) return;   /* nicht mitten im Tippen neu zeichnen */
    const st = stationDef(), info = stInfo(), mism = st && st.on !== LAB, def = T.def;
    let h = '';
    if (T.err === 'final') {
      h = '<div class="vbb-row"><span class="vbb-ico">🏁</span><div class="vbb-t"><b>' + esc((def && def.name) || T.pid) + '</b><small>Der Gesamttest läuft in der Projektübersicht.</small></div><a class="vbb-b acc" href="verbund.html?projekt=' + esc(T.pid) + '&final=1">Zum Gesamttest</a><button class="ic" data-a="end" aria-label="Verbundprojekt beenden">✕</button></div>';
    } else if (!st || !def || T.err) {
      h = '<div class="vbb-row"><span class="vbb-ico">🧩</span><div class="vbb-t"><b>Verbundprojekt</b><small>' + esc(T.err || 'Leiste wird geladen …') + '</small></div><a class="vbb-b" href="verbund.html' + (def ? '?projekt=' + esc(T.pid) : '') + '">Übersicht</a><button class="ic" data-a="end" aria-label="Verbundprojekt beenden">✕</button></div>';
    } else if (T.min) {
      h = '<div class="vbb-row" style="min-height:42px"><span class="vbb-ico">' + esc(def.icon || '🧩') + '</span><div class="vbb-t"><b>' + esc(def.name) + '</b></div><button data-a="min">▾ Leiste</button></div>';
    } else {
      const ins = (st.in || []).map(s => { let ok = false; try { ok = V().has(s); } catch (e) {} return '<span class="' + (ok ? 'ok' : 'no') + '">' + (ok ? '✓ ' : '✗ ') + esc(String(s).split('.').pop()) + '</span>'; }).join('');
      const num = info ? 'Station ' + (info.i + 1) + '/' + info.n : 'Station';
      const locked = info && info.s.state === 'locked', sub = num + ' · ' + esc(labName(st.on)) + (info && info.s.pct != null && info.s.state !== 'open' && info.s.state !== 'locked' ? ' · ' + Math.round(info.s.pct) + ' %' : '');
      if (mism) {
        h = '<div class="vbb-row"><span class="vbb-ico">' + esc(def.icon || '🧩') + '</span><div class="vbb-t"><b>' + esc(def.name) + ': ' + esc(st.title) + '</b><small>' + num + ' gehört ins ' + esc(labName(st.on)) + ', nicht hierher.</small></div><a class="vbb-b pri" href="' + esc(labUrl(st.on, T.pid, T.sid)) + '" style="background:#2fae45;border-color:#2fae45">Im ' + esc(labName(st.on)) + ' öffnen</a><a class="vbb-b" href="' + esc(hubUrl()) + '">Übersicht</a><button class="ic" data-a="end" aria-label="Verbundprojekt beenden">✕</button></div>';
      } else {
        h = '<div class="vbb-row"><span class="vbb-ico">' + esc(def.icon || '🧩') + '</span><div class="vbb-t"><b>' + esc(def.name) + ': ' + esc(st.title) + '</b><small>' + sub + (locked ? ' · gesperrt' : '') + '</small></div>' + (ins ? '<div class="vbb-in" aria-label="Eingänge">Eingang ' + ins + '</div>' : '') +
          '<button data-a="panel" aria-expanded="' + T.panel + '">Auftrag ' + (T.panel ? '▴' : '▾') + '</button><button data-a="check"' + (locked ? ' disabled' : '') + '>Prüfen</button><button class="pri" data-a="give"' + (locked ? ' disabled' : '') + '>Übergeben</button><a class="vbb-b" href="' + esc(hubUrl()) + '">Übersicht</a><button class="ic" data-a="min" aria-label="Leiste einklappen">▴</button></div>';
      }
    }
    if (T.panel && st && !T.min && !T.mism) h += '<div class="vbb-panel" id="vbPanel">' + panelHtml() + '</div>';
    const keep = $('#vbPanel') ? $('#vbPanel').scrollTop : 0;
    bar.innerHTML = h;
    const p = $('#vbPanel'); if (p) p.scrollTop = keep;
    relayout();
  }
  bar.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'panel') { T.panel = !T.panel; render(); }
    else if (a === 'min') { T.min = !T.min; ss.set('verbund.bar.min', T.min ? '1' : '0'); T.panel = false; render(); }
    else if (a === 'check') doCheck(); else if (a === 'give') doGive(); else if (a === 'hint') doHint();
    else if (a === 'live') doLive();
    else if (a === 'reapply') { if (confirm('Die Startdaten werden neu geladen. Deine bisherige Arbeit wird vorher gesichert. Fortfahren?')) runApply(true).then(render); }
    else if (a === 'end') { ss.del('verbund.active'); try { V() && V().clearActive && V().clearActive(); } catch (x) {} bar.remove(); document.documentElement.classList.remove('vbb-on'); document.documentElement.style.removeProperty('--vbh'); BAR.active = false; try { const u = new URL(location.href); u.searchParams.delete('verbund'); u.searchParams.delete('loesung'); history.replaceState(null, '', u.pathname + u.search + u.hash); } catch (x) {} try { window.dispatchEvent(new Event('resize')); } catch (x) {} }
  });
  bar.addEventListener('input', e => { const k = e.target && e.target.dataset && e.target.dataset.k; if (k) { T.form[k] = e.target.value; saveForm(); } });
  bar.addEventListener('change', e => { const k = e.target && e.target.dataset && e.target.dataset.k; if (k) { T.form[k] = e.target.value; saveForm(); } });

  /* ---- Sprache, Ereignisse, Start ---- */
  BAR.voice = function (text) {
    const c = parseVoice(text); if (!c || !BAR.active) return null;
    if (c.cmd === 'check') { doCheck(); return 'Ich prüfe.'; }
    if (c.cmd === 'give') { doGive(); return 'Ich übergebe.'; }
    if (c.cmd === 'hub') { location.href = hubUrl(); return 'Übersicht'; }
    if (c.cmd === 'panel') { T.panel = !T.panel; render(); return 'Auftrag'; }
    if (c.cmd === 'hint') { doHint(); return 'Tipp'; }
    if (c.cmd === 'final') { location.href = 'verbund.html?projekt=' + T.pid + '&final=1'; return 'Gesamttest'; }
    if (c.cmd === 'open') {
      const s = status(), x = s && s.stations[c.n - 1]; if (!x) return 'Diese Station gibt es nicht.';
      if (x.state === 'locked') return 'Station ' + c.n + ' ist noch gesperrt.';
      location.href = labUrl(x.on, T.pid, x.id); return 'Station ' + c.n;
    }
    return null;
  };
  BAR.state = () => T;
  BAR.runApply = runApply; BAR.doCheck = doCheck; BAR.doGive = doGive;
  mount(); render();
  (async function init() {
    const ok = await loadAll();
    if (!ok) { render(); return; }
    loadForm(); render();
    if (T.mism) return;
    try { if (typeof T.V.on === 'function') T.V.on('change', () => { render(); }); } catch (e) {}
    window.addEventListener('storage', e => { if (e.key && e.key.indexOf('verbund.') === 0) render(); });
    const ready = await waitReady();
    if (!ready) { T.note = 'Das Lab ist noch nicht bereit. Warte kurz oder lade die Seite neu.'; render(); return; }
    const info = stInfo();
    if (info && info.s.state === 'locked') { T.note = 'Diese Station ist noch gesperrt: Schließe zuerst die Vorstation ab (oder der Ausbilder schaltet frei).'; T.panel = true; render(); return; }
    let sol = null;
    if (target.loesung) { try { sol = T.V.solution(T.pid, T.sid); } catch (e) {} if (!sol || sol.ok === false) { T.note = (sol && sol.msg) || 'Die Musterlösung gibt es erst ab Tipp-Stufe 3 (oder für den Ausbilder).'; sol = null; } }
    if (sol) { fillFormFrom(stationDef(), sol.data); await runApply(true, sol); }
    else await runApply(false);
    if (normFields(stationDef().form).length || T.note) T.panel = true;
    render();
  })();
})(typeof window !== 'undefined' ? window : globalThis);
