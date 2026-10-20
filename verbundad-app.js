'use strict';
/* Tonfunk Verbund: Adapter für die App-Werkstatt (Paket A6, SPEC 5.2 und 5.5).
   Die Station wird als Notiz in den Notizen der App-Werkstatt (Obsidian-Format, AppWerk.W.notes/setNotes) bearbeitet. Die Notiz der Station trägt die Marke
   vb = "<projekt>:<station>"; apply legt sie mit einer Vorlage an (Frontmatter mit tags und date, Überschriften aus station.template, sonst
   Technische Daten, Bedienung, Sicherheit, Wartung) und öffnet sie. Mit Musterlösung wird eine vorhandene eigene Notiz vorher als Kopie "(gesichert …)" abgelegt.
   collect : app.note { title, md, tags }. Quelle: Text der Notiz, wenn er von der Vorlage abweicht; sonst das Formularfeld (erstes Feld vom Typ area,
             Standard 'md') der Leiste (Rückfall, wenn die Notiz nicht lesbar ist oder lieber im Formular geschrieben wird). Eine unveränderte Vorlage wird nicht
             übergeben. Titel = erste Überschrift "# …" (sonst Notiztitel), tags aus dem Frontmatter (tags: [a, b] oder Liste) plus #Schlagwörter.
   fillForm: { <area-Feld>: md } für die Musterlösung. Reine Teile in adapter.pure (Node-Test quelle/verbund/test_verbundad_app.js). */
(function (root) {
  const isO = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const isS = x => typeof x === 'string';
  const arr = x => (Array.isArray(x) ? x : []);
  const norm = s => String(s == null ? '' : s).replace(/\r\n?/g, '\n').trim();
  const DEFAULT_SECTIONS = ['Technische Daten', 'Bedienung', 'Sicherheit', 'Wartung'];
  const slug = s => String(s || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const pad = n => (n < 10 ? '0' : '') + n;
  const isoDate = d => (d || new Date()).getFullYear() + '-' + pad((d || new Date()).getMonth() + 1) + '-' + pad((d || new Date()).getDate());
  const noteKey = (pid, sid) => String(pid || '') + ':' + String(sid || '');
  const areaKey = st => { const f = arr(st && st.form).find(x => isO(x) && x.type === 'area' && x.key); return f ? f.key : 'md'; };

  /* ---------------- reine Teile ---------------- */
  /* Vorlage (Gliederung) für die Station */
  function template(st, opt) {
    opt = opt || {}; const secs = arr(st && (st.template || st.sections)).filter(isS).filter(Boolean);
    const tags = [slug(opt.pid) || 'projekt', 'projekt'].filter((t, i, a) => t && a.indexOf(t) === i);
    const lines = ['---', 'tags: [' + tags.join(', ') + ']', 'date: ' + (opt.date || isoDate()), '---', '# ' + ((st && st.title) || 'Notiz'), ''];
    (secs.length ? secs : DEFAULT_SECTIONS).forEach(h => { lines.push('## ' + h, '…', ''); });
    return lines.join('\n').replace(/\n+$/, '') + '\n';
  }
  /* Markdown → { title, tags }: Frontmatter-tags (Liste in [] oder mit Strichen), #Schlagwörter im Text, erste Überschrift als Titel */
  function parseNote(md, fallbackTitle) {
    md = norm(md); const fm = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(md), body = fm ? md.slice(fm[0].length) : md, tags = [];
    const add = t => { t = String(t).trim().replace(/^["'#]+|["']+$/g, '').toLowerCase(); if (t && tags.indexOf(t) < 0) tags.push(t); };
    if (fm) {
      const lines = fm[1].split('\n');
      for (let i = 0; i < lines.length; i++) {
        const m = /^tags?\s*:\s*(.*)$/i.exec(lines[i]); if (!m) continue;
        const v = m[1].trim();
        if (v) v.replace(/^\[|\]$/g, '').split(',').forEach(add);
        else for (let j = i + 1; j < lines.length && /^\s*-\s+/.test(lines[j]); j++) add(lines[j].replace(/^\s*-\s+/, ''));
      }
    }
    body.replace(/(^|\s)#([\p{L}\d_-]+)/gu, (x, a, t) => { add(t); return x; });
    const h = /^#\s+(.+)$/m.exec(body);
    return { title: h ? h[1].trim() : String(fallbackTitle || ''), tags };
  }
  /* Welcher Text zählt? Notiz (verändert) vor Formular vor unveränderter Vorlage */
  function chooseText(noteText, formText, tpl) {
    const n = norm(noteText), f = norm(formText), t = norm(tpl);
    if (n && n !== t) return { src: 'notiz', md: n };
    if (f && f !== t) return { src: 'formular', md: f };
    return { src: n ? 'vorlage' : 'leer', md: '' };
  }
  function buildNote(choice, noteTitle) {
    const p = parseNote(choice.md, noteTitle); return { title: p.title, md: choice.md, tags: p.tags };
  }
  const words = md => (norm(md).match(/[\p{L}\d]+/gu) || []).length;
  function liveRows(md) {
    const m = norm(md), p = parseNote(m, ''), heads = (m.match(/^#{1,3}\s+\S/gm) || []).length;
    return [{ ok: /^---\n[\s\S]*?\n---/.test(m), text: 'Frontmatter (tags und date) am Anfang' }, { ok: p.tags.length > 0, text: 'Schlagwörter (tags): ' + (p.tags.length ? p.tags.join(', ') : 'keine') },
      { ok: heads >= 3, text: 'Überschriften: ' + heads + ' (mindestens 3)' }, { ok: words(m) >= 150, text: 'Länge: ' + words(m) + ' Wörter (Ziel mindestens 150)' }];
  }

  /* ---------------- Lab-Anbindung ---------------- */
  const W = () => (root.AppWerk && root.AppWerk.W && typeof root.AppWerk.W.notes === 'function' ? root.AppWerk : null);
  const pidOf = ctx => (ctx && ctx.pid) || ((ctx && ctx.V && typeof ctx.V.active === 'function' ? ctx.V.active() : null) || {}).pid || '';
  const sidOf = (st, ctx) => (st && st.id) || (ctx && ctx.sid) || '';
  const uid = () => 'nvb' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const findNote = (notes, key) => notes.find(n => isO(n) && n.vb === key) || null;
  const noteTitle = st => ((st && st.cat) ? st.cat + ': ' : '') + ((st && st.title) || 'Notiz');
  const adapter = {
    lab: 'app',
    ready() { return !!W() && !!(root.document && root.document.querySelector('#view')); },
    apply(st, ctx) {
      const A = W(); if (!A) return { ok: false, msg: 'Die App-Werkstatt ist nicht bereit.' };
      const key = noteKey(pidOf(ctx), sidOf(st, ctx)), tpl = template(st, { pid: pidOf(ctx) }), notes = A.W.notes().slice();
      let n = findNote(notes, key), msg = 'Die Vorlage liegt in den Notizen. Schreibe deinen Text dort (oder im Formular der Leiste).';
      const sol = ctx && ctx.solution && isO(ctx.solution.data) && isS(ctx.solution.data.md) ? ctx.solution.data.md : null;
      if (!n) { n = { id: uid(), title: noteTitle(st), text: tpl, t: Date.now(), vb: key }; notes.push(n); }
      if (sol !== null) {
        if (norm(n.text) && norm(n.text) !== norm(tpl) && norm(n.text) !== norm(sol)) {
          const d = new Date(); notes.push({ id: uid(), title: n.title + ' (gesichert ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ')', text: n.text, t: Date.now() });
          msg = 'Musterlösung geladen. Deine Notiz ist als Kopie gesichert.';
        } else msg = 'Musterlösung geladen.';
        n.text = sol; n.t = Date.now();
      }
      try { A.W.setNotes(notes); A.go('notizen'); const b = root.document.querySelector('.ni[data-id="' + n.id + '"]'); if (b) b.click(); }
      catch (e) { return { ok: false, msg: 'Die Notiz konnte nicht angelegt werden: ' + (e && e.message ? e.message : e) }; }
      return { ok: true, msg };
    },
    collect(st, ctx) {
      const A = W(), key = noteKey(pidOf(ctx), sidOf(st, ctx)), n = A ? findNote(A.W.notes(), key) : null, fd = ctx && isO(ctx.formData) ? ctx.formData : {};
      const c = chooseText(n ? n.text : '', fd[areaKey(st)], template(st, { pid: pidOf(ctx) }));
      if (c.src === 'leer' || c.src === 'vorlage') return { error: c.src === 'vorlage' ? 'Die Notiz ist noch die unveränderte Vorlage. Schreibe zuerst deinen Text.' : 'Es gibt noch keine Notiz: Schreibe sie in den Notizen der App-Werkstatt oder im Formular der Leiste.' };
      return { type: 'app.note', data: buildNote(c, n && n.title) };
    },
    live(st, ctx) {
      const A = W(), key = noteKey(pidOf(ctx), sidOf(st, ctx)), n = A ? findNote(A.W.notes(), key) : null, fd = ctx && isO(ctx.formData) ? ctx.formData : {};
      const c = chooseText(n ? n.text : '', fd[areaKey(st)], template(st, { pid: pidOf(ctx) }));
      return c.md ? liveRows(c.md) : [{ ok: false, text: 'Noch kein eigener Text in der Notiz' }];
    },
    fillForm(st, data) { return isO(data) && isS(data.md) ? { [areaKey(st)]: data.md } : {}; },
    pure: { template, parseNote, chooseText, buildNote, liveRows, words, noteKey, areaKey, norm }
  };
  if (root.Verbund && typeof root.Verbund.registerAdapter === 'function') root.Verbund.registerAdapter('app', adapter);
  root.VERBUND_ADAPTERS = root.VERBUND_ADAPTERS || {}; root.VERBUND_ADAPTERS.app = adapter;
  if (typeof module !== 'undefined' && module.exports) module.exports = adapter;
})(typeof window !== 'undefined' ? window : globalThis);
