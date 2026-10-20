'use strict';
/* Tonfunk Verbund: Adapter für das Datenblatt-Lab (Paket A6, SPEC 5.2 und 5.5).
   apply   : sichert die Arbeit im Datenblatt-Lab (wie "Speichern"), öffnet die relevanten Übungsdatenblätter und den passenden Rechner
             (Station: open { ex, ds, calc, tab }, assist[Stufe] überschreibt bei Stufe 1) oder zeigt bei Musterlösung das gewählte Bauteil.
   collect : ds.pick { items:[{role,ds,part,ref}], calc:{…, lab:{ds,part,ref,rechner?:{id,vals,res}}}, vals:{…} }.
             Quelle ist das Formular der Leiste (ctx.formData; hat die Station fromForm(values), wird es benutzt, sonst werden Auswahlfelder mit
             Datenblatt-IDs zu items und die übrigen Felder zu vals). Zusätzlich liefert der Adapter das im Lab geöffnete Bauteil und das letzte
             Rechnerergebnis (calc.lab). Hat die Station kein Formular, zählt das im Lab geöffnete Bauteil als Auswahl.
   fillForm: Umkehrung für die Musterlösung (station.toForm(data), sonst Schlüssel = Rolle / vals / calc).
   Reine Teile stehen in adapter.pure (Node-tauglich, quelle/verbund/test_verbundad_ds.js). Es werden nur vorhandene Lab-Objekte benutzt (DS_UI, DS_LIB). */
(function (root) {
  const isO = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const isS = x => typeof x === 'string';
  const fin = x => typeof x === 'number' && isFinite(x);
  const arr = x => (Array.isArray(x) ? x : []);
  const clone = o => JSON.parse(JSON.stringify(o));
  const blank = v => v === null || v === undefined || v === '' || (typeof v === 'number' && !isFinite(v));
  const libById = () => (root.DS_LIB && root.DS_LIB.byId) || {};
  const formOf = st => arr(st && st.form).filter(f => isO(f) && f.key);
  const fieldOpts = f => arr(f.options).map(o => (isO(o) ? o.value : o)).filter(isS);

  /* ---------------- reine Teile ---------------- */
  /* Auswahlfelder, deren gewählter Wert eine Datenblatt-ID ist, werden zu items; die Rolle ist f.role oder der Feldschlüssel */
  function itemsFromForm(st, fd, lib) {
    fd = isO(fd) ? fd : {}; lib = lib || {}; const out = [];
    formOf(st).forEach(f => {
      if (f.type !== 'select') return;
      const v = fd[f.key]; if (!isS(v) || !v || !lib[v]) return;
      out.push({ role: f.role || f.key, ds: v, part: lib[v].part || '', ref: lib[v].ref || '' });
    });
    return out;
  }
  /* übrige Felder → vals (Zahl bleibt Zahl, Text bleibt Text; Auswahlfelder mit Datenblatt-ID gehören zu items) */
  function valsFromForm(st, fd, lib) {
    fd = isO(fd) ? fd : {}; lib = lib || {}; const out = {};
    formOf(st).forEach(f => { const v = fd[f.key]; if (f.type === 'select' && isS(v) && lib[v]) return; out[f.key] = blank(v) ? null : v; });
    return out;
  }
  /* Stand des Labs: geöffnetes Bauteil und letztes Rechnerergebnis (U = DS_UI) */
  function labState(U, lib) {
    const S = U && U.S; if (!S) return { ds: '', part: '', ref: '', rechner: null };
    const d = S.dsId && lib ? lib[S.dsId] : null, r = S.lastRes && isO(S.lastRes) && isS(S.lastRes.id) ? S.lastRes : null;
    return { ds: d ? S.dsId : '', part: d ? d.part || '' : '', ref: d ? d.ref || '' : '',
      rechner: r ? { id: r.id, vals: clone(r.vals || {}), res: arr(r.res).map(x => ({ label: String(x.label), value: fin(x.value) ? x.value : null, unit: String(x.unit || '') })) } : null };
  }
  /* ds.pick aus Formular und Lab-Stand: { data } oder { error } */
  function buildPick(st, fd, lab, lib) {
    let data = null;
    if (st && typeof st.fromForm === 'function' && isO(fd)) {
      try { data = st.fromForm(fd); } catch (e) { return { error: 'Das Formular konnte nicht gelesen werden: ' + (e && e.message ? e.message : e) }; }
    }
    if (!isO(data)) data = { items: itemsFromForm(st, fd, lib), calc: {}, vals: valsFromForm(st, fd, lib) };
    const out = { items: arr(data.items).filter(isO).map(clone), calc: isO(data.calc) ? clone(data.calc) : {}, vals: isO(data.vals) ? clone(data.vals) : {} };
    Object.keys(data).forEach(k => { if (!(k in out) && data[k] !== undefined) out[k] = clone(data[k]); });
    const hasForm = formOf(st).length > 0;
    if (!hasForm && !out.items.some(i => i.ds || i.part) && lab.ds) out.items.push({ role: (st && st.role) || 'auswahl', ds: lab.ds, part: lab.part, ref: lab.ref });
    if (lab.ds || lab.rechner) { const l = { ds: lab.ds, part: lab.part, ref: lab.ref }; if (lab.rechner) l.rechner = lab.rechner; if (!('lab' in out.calc)) out.calc.lab = l; }
    const empty = !out.items.some(i => i.ds || i.part) && !Object.keys(out.vals).some(k => !blank(out.vals[k]));
    if (empty) return { error: hasForm ? 'Das Formular ist noch leer: Wähle ein Bauteil aus und trage deine Rechenwerte ein.' : 'Es ist noch nichts ausgewählt: Öffne im Datenblatt-Lab ein Bauteil.' };
    return { data: out };
  }
  /* Umkehrung: Formularwerte aus ds.pick (für die Musterlösung) */
  function formFromData(st, data) {
    if (st && typeof st.toForm === 'function') { try { const r = st.toForm(data); if (isO(r)) return r; } catch (e) {} }
    data = isO(data) ? data : {}; const items = arr(data.items), vals = isO(data.vals) ? data.vals : {}, calc = isO(data.calc) ? data.calc : {}, out = {};
    formOf(st).forEach(f => {
      let v;
      if (f.type === 'select') { const it = items.find(i => isO(i) && (i.role === f.key || i.role === f.role)); v = it ? it.ds : undefined; if (v === undefined && vals[f.key] != null && fieldOpts(f).indexOf(String(vals[f.key])) >= 0) v = String(vals[f.key]); }
      else v = vals[f.key] !== undefined ? vals[f.key] : calc[f.key];
      if (v === undefined || v === null) v = fieldOpts(f).indexOf('') >= 0 && f.type === 'select' ? '' : undefined;
      if (v !== undefined) out[f.key] = v;
    });
    return out;
  }
  /* Live-Hinweise ohne Prüfung: leere Felder, geöffnetes Bauteil, Rechnerergebnis */
  function liveRows(st, fd, lab) {
    const rows = [];
    formOf(st).forEach(f => { if (blank(isO(fd) ? fd[f.key] : null) && !(f.type === 'select' && fieldOpts(f).indexOf('') >= 0)) rows.push({ ok: false, text: f.label + ' ist noch leer' }); });
    rows.push({ ok: !!lab.ds, text: lab.ds ? 'Im Datenblatt-Lab geöffnet: ' + lab.part : 'Im Datenblatt-Lab ist noch kein Bauteil geöffnet' });
    rows.push({ ok: !!lab.rechner, text: lab.rechner ? 'Rechner: ' + lab.rechner.res.map(r => r.label + ' ' + (r.value == null ? '–' : r.value) + ' ' + r.unit).join(', ') : 'Noch kein Rechenergebnis im Rechner (Reiter „Rechner“)' });
    return rows;
  }
  /* Startparameter: Station.open, bei Stufe 1 überlagert von assist[Stufe]; erstes wählbares Datenblatt als Rückfall */
  function openPlan(st, ctx, lib) {
    const o = Object.assign({}, isO(st && st.open) ? st.open : {});
    if (ctx && ctx.assist && isO(st && st.assist)) Object.assign(o, st.assist[ctx.level] || st.assist[1] || {});
    if (!o.ds) { for (const f of formOf(st)) { const c = fieldOpts(f).find(v => lib && lib[v]); if (c) { o.ds = c; break; } } }
    if (o.ds && !(lib && lib[o.ds])) delete o.ds;
    return o;
  }

  /* ---------------- Lab-Anbindung ---------------- */
  const U = () => root.DS_UI;
  function stash() {   /* wie das Lab selbst vor dem Laden: nur echte, ungespeicherte Arbeit sichern */
    try {
      const u = U(), S = u.S;
      const work = Object.keys(S.marks || {}).length > 0 || !!S.note || Object.keys(S.calcVals || {}).some(k => k !== 'curve');
      if (!S.dirty || S.readonly || S.task || !work) return false;
      u.saveItem(S.name || 'Arbeitsstand'); S.id = null; return true;
    } catch (e) { return false; }
  }
  const adapter = {
    lab: 'ds',
    ready() { const u = U(); return !!(u && u.S && root.DS_CORE && root.DS_LIB && arr(root.DS_LIB.list).length && typeof u.goState === 'function'); },
    apply(st, ctx) {
      const u = U(); if (!u || !u.S) return { ok: false, msg: 'Das Datenblatt-Lab ist nicht bereit.' };
      const lib = libById(), saved = stash(), o = openPlan(st, ctx, lib);
      try {
        if (ctx && ctx.solution && isO(ctx.solution.data)) {
          const it = arr(ctx.solution.data.items).find(i => isO(i) && lib[i.ds]);
          u.goState({ ds: it ? it.ds : o.ds, tab: 'lib' });
          return { ok: true, msg: 'Musterlösung: Das gewählte Bauteil ist geöffnet, die Werte stehen im Formular. ' + (saved ? 'Deine Arbeit ist gesichert.' : '') };
        }
        const exOk = o.ex && typeof u.exampleList === 'function' && u.exampleList().some(e => e.id === o.ex || String(e.name).toLowerCase().indexOf(String(o.ex).toLowerCase()) >= 0);
        if (exOk) u.loadExampleByName(o.ex);
        else u.goState({ ds: o.ds, tab: o.tab || (o.calc ? 'calc' : 'lib'), calc: o.calc && arr(u.CALC).some(c => c.id === o.calc) ? o.calc : undefined });
      } catch (e) { return { ok: false, msg: 'Die Datenblätter konnten nicht geöffnet werden: ' + (e && e.message ? e.message : e) }; }
      return { ok: true, msg: 'Datenblätter geöffnet.' + (saved ? ' Deine Arbeit ist gesichert.' : '') };
    },
    collect(st, ctx) {
      const lib = libById(), r = buildPick(st, ctx && ctx.formData, labState(U(), lib), lib);
      return r.error ? { error: r.error } : { type: 'ds.pick', data: r.data };
    },
    live(st, ctx) { return liveRows(st, ctx && ctx.formData, labState(U(), libById())); },
    fillForm(st, data) { return formFromData(st, data); },
    pure: { itemsFromForm, valsFromForm, labState, buildPick, formFromData, liveRows, openPlan }
  };
  if (root.Verbund && typeof root.Verbund.registerAdapter === 'function') root.Verbund.registerAdapter('ds', adapter);
  root.VERBUND_ADAPTERS = root.VERBUND_ADAPTERS || {}; root.VERBUND_ADAPTERS.ds = adapter;
  if (typeof module !== 'undefined' && module.exports) module.exports = adapter;
})(typeof window !== 'undefined' ? window : globalThis);
