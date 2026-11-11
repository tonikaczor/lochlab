'use strict';
/* Tonfunk Lab: Oberfläche der Seite ausbildungsplan.html (Paket P1).
   Zeigt den Ausbildungsplan des gewählten Berufs: oben "Du bist hier / Als Nächstes" und der Gesamtfortschritt, darunter die Lernfelder je Ausbildungsjahr
   (Karten mit Fortschritt, Labs, Heft, Wiki, Projekt-Stationen, Prüfungsbezug, Entwurf-Marke). Daten und Logik stehen im Kern ausbildungsplan-core.js (AusbildungsPlan),
   die Pläne je Beruf in ausbildungsplan-<beruf>.js (werden bei Bedarf nachgeladen). Der Lernstand wird nur gelesen, nie geschrieben.
   Gebaut nur mit createElement/textContent (keine fremden Texte als HTML). Beruf: ?beruf=<k> in der Adresse, sonst lm4.beruf; ohne beides Auswahl. */
(function (root) {
  const doc = root.document;
  const NEUTRAL = { head: 'Plan für deinen Beruf wird gerade zusammengestellt.', sub: 'Sobald er fertig ist, siehst du hier deine Lernfelder mit Aufgaben, Heften und Projekten. Die Labs findest du bis dahin ganz normal auf der Startseite.' };
  const PRUEF = { AP1: ['AP1', 'Kommt in der Abschlussprüfung Teil 1 vor'], AP2: ['AP2', 'Kommt in der Abschlussprüfung Teil 2 vor'], beide: ['AP1 + AP2', 'Kommt in beiden Teilen der Abschlussprüfung vor'] };
  const ENTWURF_TIP = 'Zuordnung wird noch geprüft';
  const norm = s => String(s == null ? '' : s).toLowerCase();
  const de = x => String(+(+x).toPrecision(3)).replace('.', ',');

  /* ---------- reine Teile (auch ohne Seite prüfbar) ---------- */
  function labLink(lab, aufgabe, reg) {
    const r = (reg || {})[lab] || {};
    return (r.file || 'index.html') + (aufgabe ? '?aufgabe=' + encodeURIComponent(aufgabe) : '');
  }
  /* erste noch nicht gelöste Aufgabe des Labs in diesem Lernfeld (Reihenfolge wie in aufgaben.js); null, wenn alles gelöst oder nichts zugeordnet */
  function offeneAufgabe(ids, lab, rowLab, R) {
    const mine = (ids || []).filter(i => rowLab[i] === lab);
    for (let i = 0; i < mine.length; i++) if ((R[mine[i]] || 0) < 100) return mine[i];
    return null;
  }
  function wikiLink(s, idx) {
    const q = norm(s);
    const e = (idx || []).filter(x => x[0] === s || norm(x[2]) === q || String(x[3] || '').toLowerCase().split('|').indexOf(q) >= 0)[0];
    return e ? { text: e[2], href: 'wiki.html#e=' + encodeURIComponent(e[0]) } : { text: String(s), href: 'wiki.html#q=' + encodeURIComponent(String(s)) };
  }
  function zeigeNr(lf) { return !!lf.nr && String(lf.titel).indexOf(lf.nr) < 0; }
  function passt(lf, f, filt, regs) {
    if (filt.jahr != null && lf.jahr !== filt.jahr) return false;
    if (filt.offen && f && f.pct === 100) return false;
    const q = norm(filt.q).trim();
    if (!q) return true;
    const hay = norm([lf.nr, lf.titel, lf.kurz, lf.block].concat(lf.themen || [], (lf.labs || []).map(e => (regs && regs[e.lab] && regs[e.lab].name) || e.lab), lf.wiki || []).join(' '));
    return q.split(/\s+/).every(w => hay.indexOf(w) >= 0);
  }
  function gruppen(lfs) {   // Blöcke in der Reihenfolge ihres ersten Auftretens; Lernfelder ohne Block zuerst
    const order = [], map = {};
    lfs.forEach(l => { const k = l.block || ''; if (!map[k]) { map[k] = []; order.push(k); } map[k].push(l); });
    order.sort((a, b) => (a === '' ? -1 : 0) - (b === '' ? -1 : 0));
    return order.map(k => ({ block: k, lfs: map[k] }));
  }
  function jahrSumme(lfs, F) {   // optionale Lernfelder zählen nicht mit
    let n = 0, d = 0; lfs.forEach(l => { const f = F.lf[l.id]; if (f && !l.optional) { n += f.n; d += f.done; } });
    return { n: n, done: d, pct: n ? Math.round(100 * d / n) : null };
  }
  function gesamtText(plan, F) {
    const mit = (plan.lernfelder || []).filter(l => !l.optional && F.lf[l.id] && F.lf[l.id].n > 0);
    const begonnen = mit.filter(l => F.lf[l.id].started).length;
    return { lernfelder: mit.length, begonnen: begonnen, n: F.gesamt.n, done: F.gesamt.done, pct: F.gesamt.pct };
  }
  /* Aufteilung eines Jahres: Pflicht-Lernfelder und optionale (eingeklappter Abschnitt mit dem Block-Titel) */
  function teile(lfs) {
    const opt = lfs.filter(l => l.optional), pflicht = lfs.filter(l => !l.optional);
    return { pflicht: pflicht, optional: opt, titel: (opt.filter(l => l.block)[0] || {}).block || 'Optionale Lernfelder' };
  }
  const exp = { labLink, offeneAufgabe, wikiLink, passt, gruppen, jahrSumme, gesamtText, zeigeNr, teile, NEUTRAL };
  root.AusbildungsPlanUI = exp;
  if (typeof module === 'object' && module.exports) module.exports = exp;
  if (!doc) return;
  const app = doc.getElementById('apApp'); if (!app) return;

  /* ---------- Hilfen ---------- */
  function h(tag, props, kids) {
    const e = doc.createElement(tag);
    Object.keys(props || {}).forEach(k => {
      const v = props[k];
      if (v == null || v === false) return;
      if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : String(v));
    });
    (kids || []).forEach(c => { if (c == null || c === false) return; e.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c); });
    return e;
  }
  const clear = e => { while (e.firstChild) e.removeChild(e.firstChild); };
  const bar = (pct, label) => { const i = h('i'); i.style.width = Math.max(0, Math.min(100, pct || 0)) + '%'; return h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct || 0, 'aria-label': label || 'Fortschritt' }, [i]); };
  const query = k => { try { const m = new RegExp('[?&]' + k + '=([^&#]*)').exec(root.location.search || ''); return m ? decodeURIComponent(m[1]) : null; } catch (e) { return null; } };
  const lsRead = k => { try { return root.localStorage.getItem(k); } catch (e) { return null; } };
  const prevent = e => { if (e && e.preventDefault) e.preventDefault(); };

  /* ---------- Zustand ---------- */
  const S = { beruf: '', wechseln: false, jahr: null, offen: false, q: '', skip: [], hash: '', openYears: null, openCards: {}, openOpt: {}, fehler: '' };
  const AP = () => root.AusbildungsPlan;
  const berufName = k => { const a = AP(); const b = a && a.BERUFE.filter(x => x.k === k)[0]; return b ? b.n : k; };
  function startBeruf() {
    const a = AP(); if (!a) return '';
    const ok = k => !!k && a.BERUFE.some(x => x.k === k);
    const q = query('beruf'); if (ok(q)) return q;
    const s = lsRead('lm4.beruf'); return ok(s) ? s : '';
  }
  function ladePlan(b, cb) {
    const a = AP(); if (!a) return cb(false);
    if (a.plan(b)) return cb(true);
    try {
      const s = doc.createElement('script'); s.src = 'ausbildungsplan-' + b + '.js';
      s.onload = () => cb(!!(AP() && AP().plan(b))); s.onerror = () => cb(false);
      (doc.head || doc.body).appendChild(s);
    } catch (e) { cb(false); }
  }

  /* ---------- Gerüst ---------- */
  const el = {};
  function build() {
    clear(app);
    el.top = h('div', { class: 'apbar noprint' });
    el.chooser = h('div', { class: 'card', id: 'apWahl', hidden: true });
    el.status = h('div', { id: 'apStatus', 'aria-live': 'polite' });
    el.hier = h('section', { class: 'card ap-hier', id: 'apHier', 'aria-labelledby': 'apHierH' });
    el.gesamt = h('section', { class: 'card', id: 'apGesamt', 'aria-labelledby': 'apGesamtH' });
    el.filter = h('section', { class: 'card ap-filter', id: 'apFilter', 'aria-label': 'Lernfelder filtern' });
    el.count = h('p', { class: 'lead', id: 'apCount', role: 'status', 'aria-live': 'polite' });
    el.list = h('div', { id: 'apList' });
    [el.top, el.chooser, el.status, el.hier, el.gesamt, el.filter, el.count, el.list].forEach(x => app.appendChild(x));
  }
  function zeichneKopf(p) {
    clear(el.top);
    el.top.appendChild(h('a', { class: 'btn', href: 'index.html' }, ['Startseite']));
    if (S.beruf) {
      el.top.appendChild(h('span', { class: 'apwho' }, [h('b', { text: berufName(S.beruf) })]));
      el.top.appendChild(h('button', { type: 'button', class: 'btn', 'aria-expanded': S.wechseln ? 'true' : 'false', 'aria-controls': 'apWahl', onclick: () => { S.wechseln = !S.wechseln; zeichneWahl(); zeichneKopf(p); } }, ['Beruf wechseln']));
      if ((S.beruf === 'egs' || S.beruf === 'ige') && root.LERNFELDER) el.top.appendChild(h('a', { class: 'btn', href: 'lernfelder.html' }, ['Lernfelder und Probetests']));
    }
  }
  function zeichneWahl() {
    clear(el.chooser);
    const zeigen = !S.beruf || S.wechseln;
    el.chooser.hidden = !zeigen;
    if (!zeigen) return;
    el.chooser.appendChild(h('h2', { id: 'apWahlH', text: S.beruf ? 'Beruf wechseln' : 'Für welchen Beruf möchtest du den Plan sehen?' }));
    if (!S.beruf) el.chooser.appendChild(h('p', { class: 'lead', text: 'Du hast auf der Startseite noch keinen Beruf gewählt. Such dir hier einen aus; gespeichert wird dabei nichts.' }));
    const seg = h('div', { class: 'seg', role: 'group', 'aria-labelledby': 'apWahlH' });
    AP().BERUFE.forEach(b => seg.appendChild(h('button', { type: 'button', 'aria-pressed': b.k === S.beruf ? 'true' : 'false', 'data-beruf': b.k, onclick: () => waehle(b.k) }, [b.n])));
    el.chooser.appendChild(seg);
  }
  function waehle(k) {
    S.beruf = k; S.wechseln = false; S.jahr = null; S.offen = false; S.q = ''; S.skip = []; S.openYears = null; S.openCards = {}; S.openOpt = {}; S.fehler = '';
    try { if (root.history && root.history.replaceState) root.history.replaceState(null, '', '?beruf=' + k); } catch (e) {}
    ladeUndZeige();
  }

  /* ---------- Daten ---------- */
  function daten() {
    const a = AP(), p = a.plan(S.beruf); if (!p) return null;
    const ids = (root.VB_INDEX || []).map(x => x.id);
    const ls = a.ladeLernstand(lsRead, ids);
    const F = a.lernfeldFortschritt(S.beruf, ls), z = a.zuordnung(p), R = a.ergebnis(ls), N = a.naechste(S.beruf, ls, undefined, { ueberspringen: S.skip });
    const rowLab = {}; (root.AUFGABEN || []).forEach(r => { rowLab[r[0]] = r[1]; });
    return { p: p, F: F, z: z, R: R, N: N, rowLab: rowLab, reg: root.LAB_REG || {}, byId: {} };
  }
  function lfVon(D, id) { return D.p.lernfelder.filter(l => l.id === id)[0] || null; }
  const lfTitel = l => (zeigeNr(l) ? l.nr + ' ' : '') + l.titel;

  /* ---------- Du bist hier / Als Nächstes ---------- */
  function ersteLabLink(D, l) {
    const f = D.F.lf[l.id], e = (l.labs || []).filter(x => !x.fremd)[0]; if (!e) return null;
    const best = (f.labs.filter(x => !x.fremd && x.pct !== 100)[0] || f.labs.filter(x => !x.fremd)[0] || { lab: e.lab }).lab;
    const info = D.reg[best] || {};
    return { href: labLink(best, offeneAufgabe(D.z.byLf[l.id], best, D.rowLab, D.R), D.reg), name: info.name || best };
  }
  function zeichneHier(D) {
    clear(el.hier);
    el.hier.appendChild(h('h2', { id: 'apHierH', text: 'Du bist hier / Als Nächstes' }));
    const N = D.N; if (!N) return;
    if (N.hier) {
      const l = lfVon(D, N.hier.lf), info = D.reg[N.hier.lab] || {};
      if (l) el.hier.appendChild(h('div', { class: 'ap-row' }, [
        h('p', { class: 'ap-sent' }, [h('b', { text: 'Du bist hier: ' }), lfTitel(l), info.name ? ' (zuletzt im ' + info.name + ')' : '']),
        h('div', { class: 'btns' }, [
          h('a', { class: 'btn pri', href: labLink(N.hier.lab, N.hier.task, D.reg) }, ['Weitermachen im ' + (info.name || N.hier.lab)]),
          h('a', { class: 'btn', href: '#lf=' + encodeURIComponent(l.id), onclick: ev => { prevent(ev); fokus(l.id); } }, ['Lernfeld ansehen'])])]));
    } else el.hier.appendChild(h('p', { class: 'lead', text: 'Noch kein Lab benutzt. Fang irgendwo an, eine feste Reihenfolge gibt es nicht.' }));
    if (N.naechste.length) {
      el.hier.appendChild(h('h3', { text: 'Als Nächstes könnten dich diese Lernfelder weiterbringen' }));
      const ul = h('ul', { class: 'ap-next' });
      N.naechste.forEach(k => {
        const l = lfVon(D, k.lf); if (!l) return;
        const lab = ersteLabLink(D, l), btns = h('div', { class: 'btns' }, [h('a', { class: 'btn', href: '#lf=' + encodeURIComponent(l.id), onclick: ev => { prevent(ev); fokus(l.id); } }, ['Zum Lernfeld'])]);
        if (lab) btns.appendChild(h('a', { class: 'btn pri', href: lab.href }, ['Aufgabe öffnen: ' + lab.name]));
        btns.appendChild(h('button', { type: 'button', class: 'btn', onclick: () => { S.skip.push(l.id); zeige(); } }, ['Überspringen']));
        ul.appendChild(h('li', {}, [h('b', { text: lfTitel(l) }), h('span', { class: 'ap-why', text: k.grund }), btns]));
      });
      el.hier.appendChild(ul);
    } else if (!N.hier || N.leer) el.hier.appendChild(h('p', { class: 'lead', text: S.skip.length ? 'Alle Vorschläge übersprungen. Lade die Seite neu, um sie wieder zu sehen.' : 'Im Moment gibt es keinen Vorschlag.' }));
    if (N.offenePflicht.length) {
      const chips = h('div', { class: 'chips' });
      N.offenePflicht.slice(0, 8).forEach(id => { const l = lfVon(D, id); if (l) chips.appendChild(h('a', { class: 'chip neu', href: '#lf=' + encodeURIComponent(id), onclick: ev => { prevent(ev); fokus(id); } }, [lfTitel(l)])); });
      el.hier.appendChild(h('p', { class: 'ap-sent' }, [h('b', { text: 'Offene Pflichtthemen für die Abschlussprüfung: ' + N.offenePflicht.length })]));
      el.hier.appendChild(chips);
    }
  }
  function zeichneGesamt(D) {
    clear(el.gesamt);
    const g = gesamtText(D.p, D.F);
    el.gesamt.appendChild(h('h2', { id: 'apGesamtH', text: 'Dein Gesamtfortschritt' }));
    if (!g.n) { el.gesamt.appendChild(h('p', { class: 'lead', text: 'Für diesen Plan gibt es noch keine Aufgaben zum Zählen.' })); return; }
    el.gesamt.appendChild(bar(g.pct, 'Gesamtfortschritt'));
    el.gesamt.appendChild(h('p', { class: 'ap-sent', text: g.done + ' von ' + g.n + ' Aufgaben gelöst (' + g.pct + ' %). ' + g.begonnen + ' von ' + g.lernfelder + ' Lernfeldern begonnen.' }));
  }

  /* ---------- Filter ---------- */
  function zeichneFilter(D) {
    clear(el.filter);
    const jahre = D.p.jahre.filter(y => D.p.lernfelder.some(l => l.jahr === y.j));
    const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Ausbildungsjahr' }, [h('button', { type: 'button', 'aria-pressed': S.jahr == null ? 'true' : 'false', onclick: () => { S.jahr = null; zeichneFilter(D); zeichneListe(D); } }, ['Alle Jahre'])]);
    jahre.forEach(y => seg.appendChild(h('button', { type: 'button', 'aria-pressed': S.jahr === y.j ? 'true' : 'false', 'data-jahr': y.j, onclick: () => { S.jahr = y.j; zeichneFilter(D); zeichneListe(D); } }, [y.j === 0 ? 'Übergreifend' : y.j + '. Jahr'])));
    const cb = h('input', { type: 'checkbox', id: 'apOffen', onchange: ev => { S.offen = !!(ev.target && ev.target.checked); zeichneListe(D); } });
    if (S.offen) cb.checked = true;
    const q = h('input', { type: 'search', id: 'apSuche', placeholder: 'Lernfeld, Thema, Lab …', autocomplete: 'off', 'aria-label': 'Lernfelder durchsuchen', value: S.q, oninput: ev => { S.q = (ev.target && ev.target.value) || ''; zeichneListe(D); } });
    el.filter.appendChild(seg);
    el.filter.appendChild(h('div', { class: 'ap-fz' }, [h('label', { class: 'ap-cb', for: 'apOffen' }, [cb, 'nur offene Lernfelder']), q]));
  }

  /* ---------- Lernfeld-Karten ---------- */
  function chip(text, cls, tip) { return h('span', { class: 'chip' + (cls ? ' ' + cls : ''), title: tip, tabindex: tip ? '0' : null, 'aria-label': tip ? text + '. ' + tip : null }, [text]); }
  function karte(D, l) {
    const f = D.F.lf[l.id] || { n: 0, done: 0, pct: null, labs: [], projekt: [], wdh1: 0, probe: null, started: false };
    const chips = h('div', { class: 'chips' });
    if (zeigeNr(l)) chips.appendChild(chip(l.nr, 'k'));
    if (!l.nr) chips.appendChild(chip('Zusatzthema', ''));
    if (l.entwurf) chips.appendChild(chip('Entwurf', 'warn', ENTWURF_TIP));
    if (l.optional) chips.appendChild(chip('Optional', '', 'Gehört nicht zur Ausbildung selbst und zählt nicht in deinen Fortschritt'));
    if (l.pruefung && PRUEF[l.pruefung]) chips.appendChild(chip(PRUEF[l.pruefung][0], 'neu', PRUEF[l.pruefung][1] + (l.pruefungAbgeleitet ? ' (aus dem Ausbildungsjahr abgeleitet, noch nicht geprüft)' : '')));
    if (f.probe) chips.appendChild(chip('Probetest: Note ' + de(f.probe.note), f.probe.note <= 4 ? 'ok' : 'warn'));
    if (f.wdh1 > 0) chips.appendChild(chip(f.wdh1 + ' zu wiederholen', 'warn'));
    const art = h('article', { class: 'lfk', id: 'lf-' + l.id, 'data-lf': l.id, 'aria-labelledby': 'lft-' + l.id }, [
      h('h5', { id: 'lft-' + l.id, text: l.titel }), chips, h('p', { class: 'kurz', text: l.kurz })]);
    if (f.pct == null) art.appendChild(h('p', { class: 'meta', text: 'Zu diesem Lernfeld gibt es noch keine eigenen Aufgaben.' }));
    else {
      art.appendChild(bar(f.pct, 'Fortschritt ' + l.titel));
      art.appendChild(h('p', { class: 'meta', text: f.done + ' von ' + f.n + ' gelöst · ' + f.pct + ' %' + (f.begun ? ' · ' + f.begun + ' begonnen' : '') }));
    }
    // Labs und Heft (immer sichtbar, damit der Weg zur Aufgabe kurz bleibt)
    const links = h('ul', { class: 'lablinks', 'aria-label': 'Labs und Heft' });
    f.labs.forEach(x => {
      const info = D.reg[x.lab] || {}, auf = x.fremd ? null : offeneAufgabe(D.z.byLf[l.id], x.lab, D.rowLab, D.R);
      const sub = x.fremd ? 'Lab eines anderen Berufs' : x.pct == null ? '' : x.done + '/' + x.n;
      links.appendChild(h('li', {}, [h('a', { class: 'lab' + (x.fremd ? ' fremd' : ''), href: labLink(x.lab, auf, D.reg), 'aria-label': (info.name || x.lab) + (sub ? ', ' + sub : '') }, [h('span', { text: info.name || x.lab }), sub ? h('small', { text: sub }) : null])]));
    });
    if (l.heft) links.appendChild(h('li', {}, [h('a', { class: 'lab heft', href: l.heft }, [h('span', { text: 'Heft' }), h('small', { text: 'lesen' })])]));
    else links.appendChild(h('li', {}, [h('span', { class: 'lab keinheft' }, [h('span', { text: 'Heft' }), h('small', { text: 'noch keins' })])]));
    art.appendChild(links);
    // Mehr: Themen, Wiki, Projekt-Stationen, Probetest
    const mehr = [], themen = l.themen || [], wiki = (l.wiki || []).slice(0, 8), pro = l.projekt || [];
    if (themen.length) mehr.push(h('div', {}, [h('h6', { text: 'Themen' }), h('ul', { class: 'plain' }, themen.map(t => h('li', { text: t })))]));
    if (wiki.length) mehr.push(h('div', {}, [h('h6', { text: 'Im Wiki nachschlagen' }), h('ul', { class: 'lablinks' }, wiki.map(s => { const w = wikiLink(s, root.WikiIndex); return h('li', {}, [h('a', { class: 'lab', href: w.href }, [h('span', { text: w.text })])]); }))]));
    if (pro.length) mehr.push(h('div', {}, [h('h6', { text: 'Stationen in Projekten' }), h('ul', { class: 'lablinks' }, pro.map((pe, i) => {
      const vp = (root.VB_INDEX || []).filter(x => x.id === pe.pid)[0], st = f.projekt[i], stand = st && st.total ? (st.fin ? 'fertig' : st.done + '/' + st.total) : '';
      const stations = (pe.station || []).map(sid => { const s = vp && vp.st.filter(x => x[0] === sid)[0]; return s ? h('li', {}, [h('a', { class: 'lab', href: 'verbund.html?projekt=' + encodeURIComponent(pe.pid) + '&station=' + encodeURIComponent(sid) }, [h('span', { text: 'Station: ' + s[1] })])]) : null; });
      return h('li', { class: 'proj' }, [h('a', { class: 'lab', href: 'verbund.html?projekt=' + encodeURIComponent(pe.pid) }, [h('span', { text: 'Projekt ' + (vp ? vp.name : pe.pid) }), stand ? h('small', { text: stand }) : null])].concat(stations.length ? [h('ul', { class: 'lablinks sub' }, stations)] : []));
    }))]));
    if (f.probe === null && (S.beruf === 'egs' || S.beruf === 'ige') && l.nr && probeMoeglich(l.id)) mehr.push(h('div', {}, [h('a', { class: 'btn', href: 'lernfelder.html?lf=' + encodeURIComponent(l.id) + '&probe' }, ['Probetest zu diesem Lernfeld'])]));
    if (l.entwurf) mehr.push(h('p', { class: 'note', text: 'Entwurf: ' + ENTWURF_TIP + '. Die Zuordnung der Aufgaben zu diesem Lernfeld kann sich noch ändern.' }));
    if (l.quelle) mehr.push(h('p', { class: 'meta', text: 'Quelle: ' + l.quelle }));
    if (mehr.length) {
      const d = h('details', { class: 'lfmore', 'data-lf': l.id }, [h('summary', { text: 'Mehr zu diesem Lernfeld' })].concat(mehr));
      if (S.openCards[l.id]) d.open = true;
      d.addEventListener('toggle', () => { if (d.open) S.openCards[l.id] = 1; else delete S.openCards[l.id]; });
      art.appendChild(d);
    }
    return art;
  }
  function probeMoeglich(id) { try { return !!(root.LERNFELDER && typeof root.LERNFELDER.lf === 'function' && root.LERNFELDER.lf(id)); } catch (e) { return false; } }

  function standardJahre(D) {
    const N = D.N, hier = N && N.hier && lfVon(D, N.hier.lf);
    if (hier) return [hier.jahr];
    const offen = D.p.lernfelder.filter(l => !l.optional && D.F.lf[l.id] && D.F.lf[l.id].n && D.F.lf[l.id].pct < 100).map(l => l.jahr).filter(j => j > 0);
    const j = offen.length ? Math.min.apply(null, offen) : (D.p.jahre[0] || {}).j;
    return [j];
  }
  function zeichneListe(D) {
    clear(el.list);
    if (!S.openYears) S.openYears = standardJahre(D);
    const filt = { jahr: S.jahr, offen: S.offen, q: S.q }, aktiv = !!(S.q.trim() || S.offen || S.jahr != null);
    let gesamt = 0;
    D.p.jahre.forEach(y => {
      const alle = D.p.lernfelder.filter(l => l.jahr === y.j); if (!alle.length) return;
      const sicht = alle.filter(l => passt(l, D.F.lf[l.id], filt, D.reg)); if (!sicht.length) return;
      gesamt += sicht.length;
      const sum = jahrSumme(alle, D.F), open = aktiv || S.openYears.indexOf(y.j) >= 0, tl = teile(sicht), tla = teile(alle), np = tla.pflicht.length;
      const ymText = np ? np + (np === 1 ? ' Lernfeld' : ' Lernfelder') + (sum.pct == null ? '' : ' · ' + sum.pct + ' % gelöst') + (tla.optional.length ? ' · dazu ' + tla.optional.length + ' optional' : '') : tla.optional.length + (tla.optional.length === 1 ? ' optionales Lernfeld' : ' optionale Lernfelder');
      const det = h('details', { class: 'jahr', id: 'jahr-' + y.j, 'data-jahr': y.j }, [h('summary', {}, [h('h3', { text: y.t }), h('span', { class: 'ym', text: ymText })])]);
      if (open) det.open = true;
      det.addEventListener('toggle', () => { const i = S.openYears.indexOf(y.j); if (det.open && i < 0) S.openYears.push(y.j); else if (!det.open && i >= 0 && !aktiv) S.openYears.splice(i, 1); });
      const gs = gruppen(tl.pflicht);
      gs.forEach(g => {
        const box = h('div', { class: 'grid' }, g.lfs.map(l => karte(D, l)));
        if (g.block) det.appendChild(h('h4', { class: 'blk', text: g.block }));
        else if (gs.length > 1) det.appendChild(h('h4', { class: 'blk', text: 'Weitere Themen' }));
        det.appendChild(box);
      });
      if (tl.optional.length) {   // optionale Lernfelder: eingeklappter Abschnitt mit dem Block-Titel, zählt nicht im Fortschritt
        const od = h('details', { class: 'lfopt', 'data-jahr': y.j }, [h('summary', {}, [h('span', { text: tl.titel }), h('span', { class: 'ym', text: tl.optional.length + (tl.optional.length === 1 ? ' Lernfeld' : ' Lernfelder') + ' · zählt nicht in deinen Fortschritt' })])]);
        if (aktiv || S.openOpt[y.j]) od.open = true;
        od.addEventListener('toggle', () => { if (od.open) S.openOpt[y.j] = 1; else if (!aktiv) delete S.openOpt[y.j]; });
        od.appendChild(h('div', { class: 'grid' }, tl.optional.map(l => karte(D, l))));
        det.appendChild(od);
      }
      el.list.appendChild(det);
    });
    el.count.textContent = gesamt ? (aktiv ? gesamt + (gesamt === 1 ? ' Lernfeld passt' : ' Lernfelder passen') + ' zu deiner Auswahl.' : '') : '';
    if (!gesamt) el.list.appendChild(h('div', { class: 'card' }, [h('p', { text: 'Keine Lernfelder passen zu deiner Auswahl.' }), h('button', { type: 'button', class: 'btn', onclick: () => { S.jahr = null; S.offen = false; S.q = ''; zeichneFilter(D); zeichneListe(D); } }, ['Auswahl zurücksetzen'])]));
  }
  function fokus(id) {
    const D = cache; if (!D) return;
    const l = lfVon(D, id); if (!l) return;
    S.jahr = null; S.offen = false; S.q = ''; if (S.openYears.indexOf(l.jahr) < 0) S.openYears.push(l.jahr); S.openCards[id] = 1; if (l.optional) S.openOpt[l.jahr] = 1;
    zeichneFilter(D); zeichneListe(D);
    const t = doc.getElementById('lf-' + id);
    if (t) { try { t.setAttribute('tabindex', '-1'); if (t.scrollIntoView) t.scrollIntoView({ block: 'start' }); if (t.focus) t.focus(); } catch (e) {} }
    try { if (root.history && root.history.replaceState) root.history.replaceState(null, '', '#lf=' + encodeURIComponent(id)); } catch (e) {}
  }

  /* ---------- Gesamtablauf ---------- */
  let cache = null;
  function leerhinweis(titel, sub) {
    clear(el.status); el.status.appendChild(h('div', { class: 'card ap-leer' }, [h('h2', { text: titel }), sub ? h('p', { class: 'lead', text: sub }) : null]));
    [el.hier, el.gesamt, el.filter, el.list].forEach(clear); el.count.textContent = '';
    el.hier.hidden = el.gesamt.hidden = el.filter.hidden = true;
  }
  function zeige() {
    clear(el.status); cache = null;
    try {
      const a = AP();
      if (!a) { leerhinweis('Der Ausbildungsplan konnte nicht geladen werden.', 'Lade die Seite neu. Dein Lernstand ist davon nicht betroffen.'); return; }
      zeichneKopf(null); zeichneWahl();
      if (!S.beruf) { leerhinweis('Wähle zuerst deinen Beruf.', ''); return; }
      const p = a.plan(S.beruf);
      if (!p || p.status === 'skelett' || !(p.lernfelder || []).length) { leerhinweis(NEUTRAL.head, NEUTRAL.sub); return; }
      el.hier.hidden = el.gesamt.hidden = el.filter.hidden = false;
      const D = daten(); cache = D;
      if (p.status === 'entwurf') el.status.appendChild(h('p', { class: 'note', text: 'Dieser Plan ist noch ein Entwurf. Einige Zuordnungen werden noch von deinem Ausbilder geprüft und können sich ändern.' }));
      zeichneKopf(p); zeichneHier(D); zeichneGesamt(D); zeichneFilter(D); zeichneListe(D);
      if (S.hash) { const id = S.hash; S.hash = ''; fokus(id); }
    } catch (e) {
      leerhinweis('Der Plan konnte gerade nicht angezeigt werden.', 'Lade die Seite neu. Dein Lernstand ist davon nicht betroffen.');
      try { if (root.console) root.console.warn('ausbildungsplan:', e); } catch (x) {}
    }
  }
  function ladeUndZeige() {
    if (!S.beruf) { zeige(); return; }
    clear(el.status); el.status.appendChild(h('p', { class: 'lead', text: 'Lade Plan …' }));
    ladePlan(S.beruf, ok => { if (!ok && AP() && !AP().plan(S.beruf)) { zeichneKopf(null); zeichneWahl(); leerhinweis(NEUTRAL.head, NEUTRAL.sub); return; } zeige(); });
  }
  function start() {
    build();
    S.beruf = startBeruf();
    try { const m = /[#&]lf=([^&]+)/.exec(root.location.hash || ''); S.hash = m ? decodeURIComponent(m[1]) : ''; } catch (e) { S.hash = ''; }
    ladeUndZeige();
    root.addEventListener('pageshow', () => { if (S.beruf) zeige(); });
    root.addEventListener('storage', e => { if (S.beruf && (!e.key || /^(sim\.done|lm4\.|verbund\.)/.test(e.key))) zeige(); });
  }
  root.AusbildungsPlanUI.start = start; root.AusbildungsPlanUI._S = S;
  start();
})(typeof window !== 'undefined' ? window : globalThis);
