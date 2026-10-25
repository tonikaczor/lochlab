'use strict';
/* Tonfunk Lab: Lernempfehlung „Was übe ich als Nächstes?“ (SPEC-PRUEFUNG-COACH-FABLE.md, Teil B).
   suggest(D, now, C) ist eine reine Funktion (Node-getestet): sie bekommt die gelesenen Lernstand-Daten D und einen Katalog C und liefert höchstens drei Vorschläge
   mit Begründung in einfachen Sätzen, je Art (Prüfungsthema, angefangene Aufgabe, Lernpfad, Probeprüfung) höchstens einen.
   read(get) baut D aus den Schlüsseln des Geräts und übersteht kaputte oder fehlende Daten. Es wird nichts exportiert und nichts geschrieben (lm4.when schreibt design.js,
   pr.state.tr[k].t und pr.state.rep schreibt pruefwerk.js). Alles bleibt auf dem Gerät.
   Alle Zahlen zum Einstellen stehen in der einen Tabelle W unten. */
(function (root) {
  const DAY = 864e5;
  const W = {
    schwach: 70,                    // Prozent: darunter gilt ein Prüfungsthema als schwach (gut genug ab 70 %)
    gut: 80,                        // Prozent in einem Durchgang: zählt als geschafft (wie in der Aufgabe „Thema üben“)
    minAntworten: 5,                // so viele beantwortete Fragen braucht ein Thema, bevor es bewertet wird
    gap: [1, 3, 7, 14, 30],         // Wiederholabstand in Tagen je Stufe 0 bis 4 (Stufe = Durchgänge mit mindestens 80 %)
    nichtFaellig: 0.2,              // Faktor, wenn das schwache Thema gerade erst geübt wurde
    wiederholen: 0.35,              // Grundgewicht „Gutes Thema kurz wiederholen“
    tipp: 0.3,                      // Zuschlag je Tippstufe bei angefangenen Aufgaben
    alter: { jung: 1.0, alt: 0.7, unbekannt: 0.8 },   // Aufgabe zuletzt bearbeitet vor höchstens 7 Tagen / älter / unbekannt
    letztesLab: 1.15,               // angefangene Aufgabe im zuletzt benutzten Lab
    pfad: 0.5,                      // Lernpfad weiter: fällt hinter echte Schwächen, steht sonst da
    pruefung: 0.6, pruefungNote4: 0.8, pruefungTage: 14,
    pruefBonus: 1.2,                // Faktor für prüfungsnahe Aufgaben und Themen
    minuten: { thema: 8, aufgabe: 10, pfad: 10, pruefung: 60, start: 10 }
  };
  /* Relevanz der Pool-Gruppen (Anteil der Fragen in den ausgewerteten Prüfungen, grob aus quelle/pruefpool/neu/_themen.md); Fragenbank-Themen 0,8 */
  const REL = { grund: 1.0, digi: 1.0, opv: 0.9, bus: 0.6, mess: 0.6, halb: 0.6, netz: 0.6, steu: 0.5, sich: 0.5, mcu: 0.5, wiso: 0.4, qm: 0.3 };
  const PRUEF_GRUPPEN = ['digi', 'grund', 'opv', 'bus', 'mess'];      // die ersten fünf Zeilen von _themen.md
  const PRUEF_AUFGABE = /^(pr\d+|mp\d+|cp\d+|lf\d+)$/;               // Prüfungs-Lab, MessLab-Prüfungsschaltungen, Arduino-Prüfungspraxis, LochLab-Fehlersuche
  const BANK_TITEL = { grund: 'Grundlagen Gleichstrom', bauteile: 'Bauelemente', wechsel: 'Wechselstrom und Filter', digital: 'Digitaltechnik', messen: 'Messtechnik', strom: 'Stromversorgung', mcu: 'Mikrocontroller', sicher: 'Sicherheit und Normen' };
  const GRUPPEN_TITEL = { sich: 'Sicherheit, Schutzmaßnahmen, Installation', steu: 'SPS, Steuerung und Regelung', opv: 'Operationsverstärker', netz: 'Netzteil und Spannungsversorgung', bus: 'Bussysteme und Schnittstellen', digi: 'Digitaltechnik und Zahlensysteme', halb: 'Halbleiter, Transistor, LED, Relais', mcu: 'Mikrocontroller, Speicher, Wandler', mess: 'Messtechnik und Sensorik', qm: 'Qualität, Instandhaltung, Fachenglisch', grund: 'Grundlagen, Wechselstrom, Filter', wiso: 'Wirtschafts- und Sozialkunde' };
  const PR_AUFGABE_THEMA = { pr1: 'grund', pr2: 'bauteile', pr3: 'wechsel', pr4: 'digital', pr5: 'messen', pr6: 'strom', pr7: 'mcu', pr8: 'sicher' };   // Aufgabe „Thema üben“ gilt ab 80 %
  const ART = ['thema', 'aufgabe', 'pruefung', 'pfad'];   // Reihenfolge bei gleichem Gewicht
  const LAB_PR = 'pruefungslab.html';

  const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const fin = v => { const x = typeof v === 'string' && v.trim() !== '' ? +v : v; return typeof x === 'number' && isFinite(x) ? x : null; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dayText = d => (d <= 0 ? 'heute' : d === 1 ? 'gestern' : 'vor ' + d + ' Tagen');
  const daysSince = (t, now) => (t ? Math.max(0, Math.floor((now - t) / DAY)) : null);

  /* ---------- Daten bereinigen: egal was im Speicher steht, heraus kommen nur gültige Formen ---------- */
  function clean(D) {
    D = isObj(D) ? D : {};
    const out = { tr: {}, best: {}, rep: {}, hist: [], done: {}, hints: {}, when: {}, last: null, kuerzel: typeof D.kuerzel === 'string' ? D.kuerzel : '', trainer: 0 };
    if (isObj(D.tr)) Object.keys(D.tr).slice(0, 300).forEach(k => { const t = D.tr[k], r = isObj(t) ? fin(t.r) : null, n = isObj(t) ? fin(t.n) : null; if (r != null && n != null && n > 0 && r >= 0) out.tr[k] = { r: Math.min(r, n), n, t: fin(t.t) || 0 }; });
    if (isObj(D.best)) Object.keys(D.best).slice(0, 300).forEach(k => { const v = fin(D.best[k]); if (v != null) out.best[k] = clamp(v, 0, 100); });
    if (isObj(D.rep)) Object.keys(D.rep).slice(0, 300).forEach(k => { const v = fin(D.rep[k]); if (v != null) out.rep[k] = clamp(Math.round(v), 0, 4); });
    if (Array.isArray(D.hist)) out.hist = D.hist.filter(h => isObj(h) && h.kind === 'exam' && !h.self && fin(h.t) != null).slice(-60).map(h => ({ t: fin(h.t), pct: clamp(fin(h.pct) || 0, 0, 100), note: clamp(Math.round(fin(h.note) || 0), 0, 6), v: String(h.v || '') }));
    [['done', D.done], ['hints', D.hints], ['when', D.when]].forEach(([k, o]) => { if (isObj(o)) Object.keys(o).slice(0, 2000).forEach(id => { const v = fin(o[id]); if (v != null && /^[\w.\-]{1,40}$/.test(id)) out[k][id] = k === 'when' ? v : clamp(v, 0, k === 'hints' ? 3 : 100); }); });
    if (isObj(D.last) && typeof D.last.file === 'string') out.last = { file: D.last.file, task: typeof D.last.task === 'string' ? D.last.task : '', t: fin(D.last.t) || 0 };
    out.trainer = fin(D.trainer) || 0;
    return out;
  }
  /* get(key, default) liefert den gespeicherten, schon gelesenen Wert (wie in home-cont.js). tdone wird mit done zusammengelegt (höchster Wert). */
  function read(get) {
    const g = (k, d) => { try { const v = get(k, d); return v == null ? d : v; } catch (e) { return d; } };
    const ps = g('pr.state', {}), P = isObj(ps) ? ps : {}, done = {};
    [g('sim.done', {}), g('lm4.tdone', {})].forEach(o => { if (isObj(o)) Object.keys(o).forEach(k => { const v = fin(o[k]); if (v != null && (done[k] == null || v > done[k])) done[k] = v; }); });
    const trn = g('lm4.trainer', {});
    return { tr: P.tr, best: P.best, rep: P.rep, hist: P.hist, done, hints: g('sim.hints', {}), when: g('lm4.when', {}), last: g('lm4.last', null), kuerzel: g('lm4.kuerzel', ''), trainer: isObj(trn) ? Object.keys(trn).filter(k => trn[k]).length : 0 };
  }

  /* ---------- Hilfen ---------- */
  const relOf = k => { const m = /^p:([^@]+)(?:@\d)?$/.exec(k); const g = m ? m[1] : null; return (g ? (REL[g] != null ? REL[g] : 0.5) : 0.8) * (g && PRUEF_GRUPPEN.includes(g) ? W.pruefBonus : 1); };
  const topicTitle = (k, C) => {
    const m = /^p:([^@]+)(?:@(\d))?$/.exec(k);
    if (m) { const gs = (C && C.groups) || [], g = gs.find(x => x.k === m[1]); return (g ? g.t : GRUPPEN_TITEL[m[1]] || (m[1] === 'alle' ? 'Prüfungs-Pool gemischt' : m[1])); }
    const T = (C && C.topics) || [], x = T.find(t => t.k === k); return x ? x.t : (BANK_TITEL[k] || k);
  };
  const stage = (k, D) => (D.rep[k] != null ? D.rep[k] : (D.best[k] >= W.gut ? 1 : 0));
  const labName = (key, C) => { const R = (C && C.LAB_REG) || {}; return R[key] ? R[key].name : ''; };
  const labFile = (key, C) => { const R = (C && C.LAB_REG) || {}; return R[key] ? R[key].file : ''; };
  const rowOf = (id, C) => ((C && C.AUFGABEN) || []).find(r => r[0] === id) || null;
  const trainHref = k => LAB_PR + '?thema=' + encodeURIComponent(k);
  /* erste offene Aufgabe eines Labs (leichte zuerst, wie im Lernpfad) oder null */
  function labTask(lab, D, C) {
    const rows = ((C && C.AUFGABEN) || []).filter(r => r[1] === lab).sort((a, b) => a[4] - b[4]), d = (D && D.done) || {};
    const r = rows.find(x => (d[x[0]] || 0) < 100); return r ? { id: r[0], title: r[3], lab, href: labFile(lab, C) + '?aufgabe=' + r[0] } : null;
  }
  /* Wiederholstufe nach einem Durchgang im Training: ab 80 % eine Stufe höher, unter 70 % zurück auf 0, dazwischen unverändert (pruefwerk.js benutzt das) */
  function nextStage(prev, pct) { prev = clamp(Math.round(fin(prev) || 0), 0, 4); return pct >= W.gut ? Math.min(4, prev + 1) : pct < W.schwach ? 0 : prev; }

  /* ---------- Kern ---------- */
  function suggest(D0, now, C) {
    C = C || {}; now = now || Date.now();
    const D = clean(D0), K = [];
    const hasData = Object.keys(D.done).length > 0 || Object.keys(D.tr).length > 0 || Object.keys(D.best).length > 0 || D.hist.length > 0 || D.trainer > 0;
    const lastLab = D.last ? (Object.keys(C.LAB_REG || {}).find(k => C.LAB_REG[k].file === D.last.file) || null) : null;
    /* 1. Prüfungsthemen: schwach (unter 70 %) oder gutes Thema, das nach Wiederholabstand wieder dran ist */
    Object.keys(D.tr).forEach(k => {
      const t = D.tr[k]; if (t.n < W.minAntworten) return;
      const p = Math.round(100 * t.r / t.n), st = stage(k, D), days = daysSince(t.t, now), due = !t.t || (now - t.t) >= W.gap[st] * DAY;
      if (p < W.schwach) K.push({ art: 'thema', k, w: (W.schwach - p) / W.schwach * relOf(k) * (due ? 1 : W.nichtFaellig), p, r: t.r, n: t.n, days, due, sub: 'schwach' });
      else if (st >= 1 && t.t && due) K.push({ art: 'thema', k, w: W.wiederholen * relOf(k), p, r: t.r, n: t.n, days, due, sub: 'wiederholen' });
    });
    /* 2. angefangene Aufgaben (zwischen 0 und 100 %, oder Tipp Stufe 2 und höher bei 0 %); Thema gewinnt gegen Aufgabe „Thema üben“ */
    Object.keys(D.done).forEach(id => {
      const p = D.done[id], h = D.hints[id] || 0, row = rowOf(id, C); if (p >= 100 || (p <= 0 && h < 2) || !row) return;
      if (PR_AUFGABE_THEMA[id] && D.best[PR_AUFGABE_THEMA[id]] >= W.gut) return;
      const age = D.when[id] ? (now - D.when[id]) / DAY : null;
      const w = (100 - p) / 100 * (1 + W.tipp * h) * (age == null ? W.alter.unbekannt : age <= 7 ? W.alter.jung : W.alter.alt) * (PRUEF_AUFGABE.test(id) ? W.pruefBonus : 1) * (lastLab && row[1] === lastLab ? W.letztesLab : 1);
      K.push({ art: 'aufgabe', id, lab: row[1], title: row[3], p, h, days: age == null ? null : Math.floor(age), w });
    });
    /* 3. Lernpfad weiter */
    let rc = null; try { rc = typeof C.recommend === 'function' ? C.recommend() : null; } catch (e) { rc = null; }
    if (rc && rc.rec && (C.LAB_REG || {})[rc.rec]) K.push({ art: 'pfad', lab: rc.rec, href: rc.href || '', nextTitle: rc.next ? rc.next[3] : '', started: !!rc.started, w: W.pfad });
    /* 4. Probeprüfung */
    const lastEx = D.hist.length ? D.hist.slice().sort((a, b) => a.t - b.t)[D.hist.length - 1] : null, ready = Object.keys(D.best).filter(k => D.best[k] >= W.gut).length >= 3;
    if ((!lastEx && ready) || (lastEx && now - lastEx.t > W.pruefungTage * DAY)) K.push({ art: 'pruefung', lastEx, ready: Object.keys(D.best).filter(k => D.best[k] >= W.gut).length, days: lastEx ? daysSince(lastEx.t, now) : null, w: lastEx && lastEx.note >= 4 ? W.pruefungNote4 : W.pruefung });
    /* Auswahl: höchstens drei, je Art einer */
    const top = [], seen = {};
    K.sort((a, b) => b.w - a.w || ART.indexOf(a.art) - ART.indexOf(b.art)).forEach(c => { if (!seen[c.art] && top.length < 3) { seen[c.art] = 1; top.push(c); } });
    const lsHint = !!D.kuerzel && Object.keys(D.done).length === 0 && Object.keys(D.tr).length === 0;
    let res = hasData ? top.map(c => decorate(c, C)) : [];   // ohne jede Spur von Lernstand: immer die beiden Startvorschläge (auch wenn der Lernpfad „SchaltLab“ empfiehlt)
    if (!res.length) {
      if (!hasData) res = [
        { art: 'start', title: 'Starte mit dem SchaltLab', text: 'Starte mit dem SchaltLab (Einführung, etwa ' + W.minuten.start + ' Minuten).', href: (labFile('sch', C) || 'schaltplan.html') + '?trainer', minuten: W.minuten.start, w: 1 },
        { art: 'start', title: 'Oder: Prüfungs-Lab, Grundlagen', text: 'Oder übe im Prüfungs-Lab das Thema Grundlagen: 10 Fragen mit Erklärung, etwa ' + W.minuten.thema + ' Minuten.', href: trainHref('grund'), minuten: W.minuten.thema, w: 0.9 }
      ];
      else res = [{ art: 'fertig', title: 'Nichts fällig', text: 'Im Moment ist nichts fällig. Mache eine Probeprüfung Teil 2.', href: LAB_PR + '?tab=pruefung&teil=2', minuten: W.minuten.pruefung, w: 0.1 }];
    }
    if (lsHint) res.unshift({ art: 'hinweis', title: 'Lernstand laden', text: 'Dein Lernstand scheint auf diesem Gerät zu fehlen. Lade deine gesicherte Datei mit „Lernstand laden“.', href: '', act: 'lsOpen', minuten: 0, w: 2 });
    return res.slice(0, 3);
  }
  function decorate(c, C) {
    if (c.art === 'thema') {
      const tit = topicTitle(c.k, C), zeit = c.days == null ? '' : ' Zuletzt geübt: ' + dayText(c.days) + '.';
      c.title = c.sub === 'wiederholen' ? tit + ' kurz wiederholen' : tit + ' üben';
      c.text = c.sub === 'wiederholen' ? 'Bei ' + tit + ' warst du gut (' + c.r + ' von ' + c.n + ' richtig). Das ist ' + c.days + ' Tage her, eine kurze Wiederholung hält es frisch.' : 'Du hattest bei ' + tit + ' ' + c.r + ' von ' + c.n + ' richtig. Übe das Thema, 10 Fragen, etwa ' + W.minuten.thema + ' Minuten.' + zeit;
      c.href = trainHref(c.k); c.minuten = W.minuten.thema;
    } else if (c.art === 'aufgabe') {
      const lab = labName(c.lab, C);
      c.title = c.title + (lab ? ' (' + lab + ')' : '');
      c.text = 'Diese Aufgabe hast du zu ' + c.p + ' % geschafft.' + (c.h >= 2 ? ' Du hast schon Tipps der Stufe ' + c.h + ' gebraucht.' : '') + (c.days != null ? ' Zuletzt bearbeitet: ' + dayText(c.days) + '.' : '') + ' Mach sie fertig, etwa ' + W.minuten.aufgabe + ' Minuten.';
      c.href = labFile(c.lab, C) + '?aufgabe=' + c.id; c.minuten = W.minuten.aufgabe;
    } else if (c.art === 'pfad') {
      const lab = labName(c.lab, C);
      c.title = c.started ? 'Weiter im ' + lab : 'Starte mit dem ' + lab;
      c.text = c.started ? 'Dein Lernpfad geht im ' + lab + ' weiter' + (c.nextTitle ? ': ' + c.nextTitle : '') + '.' : 'Das ist der nächste Schritt in deinem Lernpfad (Einführung).';
      c.href = c.href || (labFile(c.lab, C) + (c.started ? '' : '?trainer'));
      c.minuten = W.minuten.pfad;
    } else if (c.art === 'pruefung') {
      c.title = 'Probeprüfung machen';
      c.text = c.lastEx ? 'Deine letzte Probeprüfung war ' + dayText(c.days) + ' (' + c.lastEx.pct + ' %, Note ' + c.lastEx.note + '). Mach eine neue und vergleiche.' : 'Du hast schon ' + c.ready + ' Themen mit 80 % geschafft. Probiere jetzt eine Probeprüfung mit Zeit und Note.';
      c.href = LAB_PR + '?tab=pruefung'; c.minuten = W.minuten.pruefung;
    }
    return c;
  }
  /* Drei Karten nach einer Probeprüfung (Spec 3.4): schwächste Gruppe, passende Lab-Aufgabe, Formelsammlung/Lernheft.
     e: report()-Ergebnis mit byTopic { Thema: [richtig, gesamt] }. Themen mit weniger als 3 Aufgaben zählen nicht. */
  function afterExam(byTopic, D0, C) {
    C = C || {}; const D = clean(D0), out = [], groups = (C.groups) || [];
    const arr = Object.keys(byTopic || {}).map(k => ({ k, r: +byTopic[k][0] || 0, n: +byTopic[k][1] || 0 })).filter(x => x.n >= 3).map(x => Object.assign(x, { p: Math.round(100 * x.r / x.n) })).filter(x => x.p < W.schwach).sort((a, b) => a.p - b.p || b.n - a.n);
    const w = arr[0]; if (!w) return [{ art: 'gut', title: 'Weiter so', text: 'In keinem Thema gab es eine klare Schwäche. Mache bald eine neue Probeprüfung mit schwereren Aufgaben.', href: '', minuten: 0 }];
    const tit = topicTitle(w.k, C);
    out.push({ art: 'thema', k: w.k, title: tit + ' üben', text: 'Bei ' + tit + ' hattest du ' + w.r + ' von ' + w.n + '. Übe 10 Fragen dazu (etwa ' + W.minuten.thema + ' Minuten).', href: '', minuten: W.minuten.thema });
    const m = /^p:([^@]+)/.exec(w.k), g = m ? groups.find(x => x.k === m[1]) : null, lab = g ? g.lab : ((C.topics || []).find(t => t.k === w.k) || {}).lab;
    const lt = lab ? labTask(lab, D, C) : null;
    if (lt) out.push({ art: 'aufgabe', title: lt.title + ' (' + labName(lab, C) + ')', text: 'Zu diesem Thema passt eine Aufgabe im ' + labName(lab, C) + ': ' + lt.title + '.', href: lt.href, minuten: W.minuten.aufgabe });
    out.push({ art: 'formel', title: 'Formeln und Lernheft ansehen', text: 'Schau dir die Formeln zu ' + tit + ' an (Tab „Formeln“, nur außerhalb der Prüfung).', href: '', act: 'formeln', minuten: 5 });
    return out;
  }

  /* ---------- Oberfläche (nur im Browser) ---------- */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ICON = { thema: '📝', aufgabe: '🛠', pfad: '▶', pruefung: '🎓', start: '▶', fertig: '✓', hinweis: '💾', formel: '📐', gut: '👍' };
  const CSS = 'section.coach{grid-column:1/-1;margin:0;padding:12px 14px;border:1px solid var(--line,#38424d);border-radius:14px;background:var(--panel,#222830);color:var(--fg,#e8ecf0)}'
    + 'section.coach h2{margin:0 0 8px;font-size:18px}.coach ol{list-style:none;margin:0;padding:0;display:grid;gap:8px}.coach li{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:8px 10px;border-radius:12px;background:var(--panel2,#2c343e);border:1px solid var(--line,#38424d)}'
    + '.coach .ci{flex:none;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:rgba(0,0,0,.25);font-size:17px}.coach .ct{flex:1;min-width:200px}.coach .ct b{display:block;font-size:15px}.coach .ct span{display:block;font-size:14px;color:var(--fg,#e8ecf0);overflow-wrap:anywhere}.coach .ct small{color:#aab4bf;font-size:13px}'
    + '.coach .cb{flex:none;margin-left:auto;display:inline-flex;align-items:center;justify-content:center;min-height:44px;min-width:44px;padding:0 16px;border-radius:11px;background:var(--accent-bg,#1a6fd4);border:1px solid var(--accent-bg,#1a6fd4);color:#fff;font:600 14px system-ui,sans-serif;text-decoration:none;cursor:pointer}'
    + '.coach .cb:focus-visible{outline:3px solid #ffd166;outline-offset:2px}section.coach.inlab{margin:0 0 12px}';
  function cardHtml(list, id) {
    id = id || 'coachH';
    return '<h2 id="' + id + '">Was übe ich als Nächstes?</h2><ol>' + list.map((c, i) => '<li><span class="ci" aria-hidden="true">' + (ICON[c.art] || '•') + '</span><div class="ct"><b>' + esc(c.title) + '</b><span>' + esc(c.text) + '</span>' + (c.minuten ? '<small>etwa ' + c.minuten + ' Minuten</small>' : '') + '</div>'
      + (c.act ? '<button type="button" class="cb" data-act="' + esc(c.act) + '">' + (c.act === 'lsOpen' ? 'Lernstand laden' : 'Formeln öffnen') + '</button>' : c.href ? '<a class="cb" href="' + esc(c.href) + '" aria-label="' + esc((i === 0 ? 'Los: ' : '') + c.title) + '">Los</a>' : '') + '</li>').join('') + '</ol>';
  }
  function css() { if (typeof document === 'undefined' || document.getElementById('coachCss')) return; const s = document.createElement('style'); s.id = 'coachCss'; s.textContent = CSS; document.head.appendChild(s); }
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); if (v == null) return d; return k === 'lm4.kuerzel' ? v : JSON.parse(v); } catch (e) { return d; } };   // das Kürzel steht als einfacher Text im Speicher (stand.js)
  function context() { return { AUFGABEN: root.AUFGABEN, LAB_REG: root.LAB_REG, groups: (root.PR_POOL && root.PR_POOL.groups) || [], topics: (root.PR_BANK && root.PR_BANK.TOPICS) || [], recommend: root.Lernpfad && root.Lernpfad.recommend ? () => root.Lernpfad.recommend() : null }; }
  function current(extra) { return suggest(read(lsGet), Date.now(), Object.assign(context(), extra || {})); }
  /* Karte in host einhängen (ersetzt eine vorhandene). Fehler dürfen die Seite nie stören. */
  function mount(host, o) {
    o = o || {};
    try {
      if (!host) return null; css();
      const list = o.list || current(o.ctx);
      let sec = host.querySelector(':scope > section.coach'); if (!sec) { sec = document.createElement('section'); sec.className = 'coach' + (o.inlab ? ' inlab' : ''); sec.setAttribute('aria-labelledby', o.hid || 'coachH'); if (o.before) host.insertBefore(sec, o.before); else host.appendChild(sec); }
      sec.innerHTML = cardHtml(list, o.hid);
      sec.querySelectorAll('[data-act]').forEach(b => { b.onclick = () => { if (b.dataset.act === 'lsOpen') { const x = document.getElementById('lsOpen'); if (x) x.click(); else if (root.Lernstand && root.Lernstand.open) root.Lernstand.open(); } else if (o.onAct) o.onAct(b.dataset.act); }; });
      return sec;
    } catch (e) { return null; }
  }
  const api = { W, REL, GAP: W.gap, BANK_TITEL, GRUPPEN_TITEL, clean, read, suggest, afterExam, labTask, nextStage, topicTitle, cardHtml, mount, current, relOf, dayText };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Coach = api;
})(typeof window !== 'undefined' ? window : globalThis);
