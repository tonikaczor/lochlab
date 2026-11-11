'use strict';
/* Tonfunk Lab: Ausbildungsplan, Kern (Schema, Registrierung, Fortschritt, "Du bist hier / Als Nächstes", Prüfung der Pläne).
   Läuft im Browser (window.AusbildungsPlan) und in Node (module.exports). Reine Funktionen, schreibt nie in den Speicher.
   Die Pläne liegen je Beruf in ausbildungsplan-<beruf>.js und melden sich mit AusbildungsPlan.register('<beruf>', {...}) an
   (Reihenfolge der Skripte egal: Pläne, die vor diesem Kern geladen werden, warten in window.__apQueue).
   Schema: quelle/lernfaden/SCHEMA.md. Prüfung eines Plans: node quelle/lernfaden/validate_plan.js <beruf>.

   Lernstand (lernstand-Objekt, vom DOM-Teil aus localStorage gelesen, hier nur ausgewertet):
     done    = sim.done      { aufgabeId: Prozent }          (100 = gelöst)
     tdone   = lm4.tdone     { aufgabeId: Prozent }          (res = Maximum aus beiden, wie lernpfad.js results())
     last    = lm4.last      { file, task, t }               (zuletzt benutztes Lab)
     when    = lm4.when      { aufgabeId: ms }               (Zeitpunkt der letzten Änderung)
     wdh     = lm4.wdh       { aufgabeId: { b: Box 1..4 } }  (Wiederholen; Box 1 = noch unsicher)
     verbund = { <projektId>: verbund.<id> }                 (stations.<stationId>.passed/stale, final.ok)
     stats   = lm4.stats     { 'vb'+projektId: 0|1 }
     lf      = lm4.lf        { probe: { <lernfeld>: { note, pct } } }  (nur egs/ige)
   Optionale Lernfelder (optional:true, z. B. Aufbau zum Elektroniker beim Industrieelektriker) bleiben abrufbar (lernfeldFortschritt liefert sie mit optional:true),
   zählen aber nicht in gesamt, offenePflicht und die Vorschläge von naechste().
   ladeLernstand(getItem) baut dieses Objekt aus einer localStorage-ähnlichen Funktion. */
(function (root) {
  var BERUFE = [
    { k: 'egs', n: 'Elektroniker für Geräte und Systeme' }, { k: 'ige', n: 'Industrieelektriker Geräte und Systeme' },
    { k: 'im', n: 'Industriemechaniker' }, { k: 'tpd', n: 'Technischer Produktdesigner' }, { k: 'fll', n: 'Fachkraft für Lagerlogistik' },
    { k: 'ik', n: 'Industriekaufmann' }, { k: 'fi', n: 'Fachinformatiker' }
  ];
  var STATUS = ['skelett', 'entwurf', 'bestaetigt'];       // Stand des ganzen Plans
  var PRUEFUNG = ['AP1', 'AP2', 'beide'];
  var AUSGEBLENDET = ['arb'];                              // gesperrte Labs: nie im Plan (zusätzlich: jedes Lab mit beruf: [])
  var MAX_KURZ = 200;
  var W = { abstand: 0.3, begonnen: 25, wdh: 20, probe: 20, pruefung: 15, block: 10, anzahl: 3 };   // Punkte für "Als Nächstes"
  var NAMEN_RE = /\b(Herr|Frau)\b/;                        // der Test prüft zusätzlich die Namensliste der Schule

  var REG = {};
  function register(k, plan) { if (plan && typeof plan === 'object') REG[k] = plan; return plan; }
  function plan(k) { return REG[k] || null; }
  function berufe() { return Object.keys(REG); }
  function drain() { var q = root.__apQueue; if (Array.isArray(q)) { root.__apQueue = []; q.forEach(function (a) { register(a[0], a[1]); }); } }

  /* ---------------------------------------------------------------- Kontext (Aufgabenzeilen, Lab-Verzeichnis, Projekte, Wiki, Dateien) */
  var IDX = typeof WeakMap === 'function' ? new WeakMap() : null;
  function index(rows) {
    var ix = IDX && IDX.get(rows); if (ix) return ix;
    ix = { byId: {}, byLab: {}, cats: {} };
    rows.forEach(function (r) { ix.byId[r[0]] = r; (ix.byLab[r[1]] = ix.byLab[r[1]] || []).push(r); (ix.cats[r[1]] = ix.cats[r[1]] || {})[r[2]] = 1; });
    if (IDX) IDX.set(rows, ix);
    return ix;
  }
  function C(ctx) {
    ctx = ctx || {};
    if (ctx.__c) return ctx;   // schon aufbereitet
    var rows = ctx.AUFGABEN || root.AUFGABEN || [], d = ctx.dateien;
    return { __c: true, rows: rows, ix: index(rows), reg: ctx.LAB_REG || root.LAB_REG || {}, vb: ctx.VB_INDEX || root.VB_INDEX || [], wiki: ctx.WikiIndex || root.WikiIndex || [],
      dateien: d ? (d instanceof Set ? d : new Set(d)) : null };
  }
  var has = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };
  var arr = function (x) { return x == null ? [] : Array.isArray(x) ? x : [x]; };
  function ausgeblendet(c, lab) { var r = c.reg[lab]; return AUSGEBLENDET.indexOf(lab) >= 0 || !r || !(r.beruf && r.beruf.length); }
  function labGehoert(c, lab, b) { var r = c.reg[lab]; return !!r && !r.hub && AUSGEBLENDET.indexOf(lab) < 0 && (r.beruf || []).indexOf(b) >= 0; }
  function labsVon(c, b) { return Object.keys(c.reg).filter(function (k) { return labGehoert(c, k, b); }); }
  function labVonDatei(c, file) { var ks = Object.keys(c.reg); for (var i = 0; i < ks.length; i++) if (c.reg[ks[i]].file === file && !c.reg[ks[i]].hub) return ks[i]; return null; }
  var bereichListe = function (e) { return arr(e.bereich).filter(function (x) { return typeof x === 'string'; }); };

  /* ---------------------------------------------------------------- Zuordnung: jede Aufgabe zählt in genau einem Lernfeld
     Rang 0 = Aufgaben-ID genannt, 1 = Kategorie genannt, 2 = bereich '*' (Rest des Labs); bei gleichem Rang gewinnt das Lernfeld, das im Plan zuerst steht.
     Einträge mit fremd:true (Lab gehört zu einem anderen Beruf, nur Verweis) zählen nicht mit. */
  function zuordnung(p, ctx) {
    var c = C(ctx), best = {}, byLf = {}, b = p && p.beruf;
    ((p && p.lernfelder) || []).forEach(function (lf) {
      byLf[lf.id] = [];
      (lf.labs || []).forEach(function (e) {
        if (e.fremd || !labGehoert(c, e.lab, b)) return;
        var ids = {}; arr(e.aufgaben).forEach(function (i) { ids[i] = 1; });
        var cats = bereichListe(e), star = cats.indexOf('*') >= 0;
        (c.ix.byLab[e.lab] || []).forEach(function (r) {
          var rank = ids[r[0]] ? 0 : cats.indexOf(r[2]) >= 0 ? 1 : star ? 2 : -1;
          if (rank < 0) return;
          var o = best[r[0]]; if (!o || rank < o.rank) best[r[0]] = { lf: lf.id, rank: rank };
        });
      });
    });
    var byId = {};
    c.rows.forEach(function (r) { var o = best[r[0]]; if (o) { byId[r[0]] = o.lf; byLf[o.lf].push(r[0]); } });
    return { byId: byId, byLf: byLf };
  }
  /* Zeilen eines Lab-Eintrags (für fremd: alles, was der Eintrag nennt; sonst nur, was dem Lernfeld zugeordnet ist) */
  function eintragZeilen(c, e) {
    var ids = {}; arr(e.aufgaben).forEach(function (i) { ids[i] = 1; });
    var cats = bereichListe(e), star = cats.indexOf('*') >= 0;
    return (c.ix.byLab[e.lab] || []).filter(function (r) { return ids[r[0]] || cats.indexOf(r[2]) >= 0 || star; });
  }

  /* ---------------------------------------------------------------- Lernstand */
  function ergebnis(ls) {
    var m = {}; [ls && ls.done, ls && ls.tdone].forEach(function (o) { if (o && typeof o === 'object') Object.keys(o).forEach(function (k) { var v = +o[k] || 0; if (v > (m[k] || 0)) m[k] = v; }); });
    return m;
  }
  function ladeLernstand(getItem, projektIds) {
    var j = function (k) { try { var v = JSON.parse(getItem(k) || 'null'); return v && typeof v === 'object' ? v : null; } catch (e) { return null; } };
    var verbund = {}; (projektIds || []).forEach(function (id) { var v = j('verbund.' + id); if (v) verbund[id] = v; });
    return { done: j('sim.done') || {}, tdone: j('lm4.tdone') || {}, last: j('lm4.last'), when: j('lm4.when') || {}, wdh: j('lm4.wdh') || {}, verbund: verbund, stats: j('lm4.stats') || {}, lf: j('lm4.lf') || {} };
  }
  function vbOwn(p, s, b) { return !((p.beruf || []).indexOf('alle') >= 0 && b && s[4] && s[4].length) || s[4].indexOf(b) >= 0; }
  function projektStand(c, b, pe, ls) {
    var p = c.vb.filter(function (x) { return x.id === pe.pid; })[0]; if (!p) return { pid: pe.pid, done: 0, total: 0, fin: false, started: false };
    var ids = arr(pe.station).length ? arr(pe.station) : p.st.filter(function (s) { return vbOwn(p, s, b); }).map(function (s) { return s[0]; });
    var v = ls && ls.verbund && ls.verbund[pe.pid], st = (ls && ls.stats) || {}, done = 0;
    if (v && v.stations && typeof v.stations === 'object') ids.forEach(function (k) { var e = v.stations[k]; if (e && e.passed && !e.stale) done++; });
    var fin = !!((v && v.final && v.final.ok) || +st['vb' + pe.pid] >= 1);
    return { pid: pe.pid, done: done, total: ids.length, fin: fin, started: !!v || fin };
  }

  /* Fortschritt je Lernfeld (nur Lesen). Rückgabe: { beruf, lf: { <id>: { n, done, begun, started, pct|null, wdh1, zuletzt, probe, labs[], projekt[] } }, gesamt }.
     n/done/pct zählen nur Aufgaben von Labs des Berufs; gesamt ohne optionale Lernfelder; pct ist null, wenn das Lernfeld keine eigenen Aufgaben hat. labs[]: je Lab { lab, n, done, pct, fremd }. */
  function lernfeldFortschritt(beruf, ls, ctx) {
    var p = plan(beruf); if (!p) return null;
    var c = C(ctx), z = zuordnung(p, c), R = ergebnis(ls), wdh = (ls && ls.wdh) || {}, when = (ls && ls.when) || {}, pb = (ls && ls.lf && ls.lf.probe) || {};
    var out = { beruf: beruf, lf: {}, gesamt: { n: 0, done: 0, begun: 0, pct: 0 } };
    (p.lernfelder || []).forEach(function (lf) {
      var ids = z.byLf[lf.id] || [], o = { optional: !!lf.optional, n: ids.length, done: 0, begun: 0, started: false, pct: null, wdh1: 0, zuletzt: 0, probe: null, labs: [], projekt: [] }, set = {};
      ids.forEach(function (i) { set[i] = 1; var v = R[i] || 0; if (v >= 100) o.done++; else if (v > 0) o.begun++; if (v > 0) o.started = true; if (wdh[i] && +wdh[i].b === 1) o.wdh1++; if (+when[i] > o.zuletzt) o.zuletzt = +when[i]; });
      o.pct = o.n ? Math.round(100 * o.done / o.n) : null;
      var pr = pb[lf.id]; if (pr && typeof pr === 'object' && isFinite(+pr.note)) o.probe = { note: +pr.note, pct: +pr.pct || 0 };
      var byLab = {};
      (lf.labs || []).forEach(function (e) {
        var rows = e.fremd ? eintragZeilen(c, e) : eintragZeilen(c, e).filter(function (r) { return set[r[0]]; });
        var a = byLab[e.lab]; if (!a) { a = byLab[e.lab] = { lab: e.lab, n: 0, done: 0, pct: null, fremd: !!e.fremd }; o.labs.push(a); }
        var seen = {}; rows.forEach(function (r) { if (seen[r[0]]) return; seen[r[0]] = 1; a.n++; if ((R[r[0]] || 0) >= 100) a.done++; });
        a.pct = a.n ? Math.round(100 * a.done / a.n) : null;
      });
      (lf.projekt || []).forEach(function (pe) { o.projekt.push(projektStand(c, beruf, pe, ls)); });
      out.lf[lf.id] = o; if (!lf.optional) { out.gesamt.n += o.n; out.gesamt.done += o.done; out.gesamt.begun += o.begun; }
    });
    out.gesamt.pct = out.gesamt.n ? Math.round(100 * out.gesamt.done / out.gesamt.n) : 0;
    return out;
  }

  /* "Du bist hier / Als Nächstes": keine starre Reihenfolge. Rückgabe { hier, naechste[], offenePflicht[], leer }.
     hier = { lf, lab, task, quelle } oder null; naechste = bis zu W.anzahl Einträge { lf, punkte, grund } (ohne das Lernfeld "hier");
     opts: { jahr: nur Lernfelder bis zu diesem Jahr (und Jahr 0), ueberspringen: [lernfeld-ids] }. */
  function naechste(beruf, ls, ctx, opts) {
    var p = plan(beruf); if (!p) return null;
    opts = opts || {};
    var c = C(ctx), z = zuordnung(p, c), F = lernfeldFortschritt(beruf, ls, c), lfs = p.lernfelder || [], skip = arr(opts.ueberspringen);
    var hier = null, last = ls && ls.last;
    if (last && typeof last === 'object' && last.file) {
      var lab = labVonDatei(c, last.file);
      if (lab) {
        if (last.task && has(z.byId, last.task)) hier = { lf: z.byId[last.task], lab: lab, task: last.task, quelle: 'last' };
        else { var f = lfs.filter(function (lf) { return (lf.labs || []).some(function (e) { return e.lab === lab && !e.fremd; }); })[0]; if (f) hier = { lf: f.id, lab: lab, task: last.task || '', quelle: 'last-lab' }; }
      }
    }
    if (!hier && ls && ls.when) {
      var t = 0, tid = null; Object.keys(ls.when).forEach(function (i) { if (has(z.byId, i) && +ls.when[i] > t) { t = +ls.when[i]; tid = i; } });
      if (tid) hier = { lf: z.byId[tid], lab: (c.ix.byId[tid] || [])[1] || '', task: tid, quelle: 'when' };
    }
    var hierLf = hier ? lfs.filter(function (l) { return l.id === hier.lf; })[0] : null;
    var anyStart = lfs.some(function (l) { return !l.optional && F.lf[l.id].started; });
    var offenePflicht = lfs.filter(function (l) { var f = F.lf[l.id]; return !l.optional && l.pruefung && f.n && f.pct < 100; }).map(function (l) { return l.id; });
    var jahrOk = function (l) { return !opts.jahr || !l.jahr || l.jahr <= opts.jahr; };
    var kand = [];
    lfs.forEach(function (l, i) {
      var f = F.lf[l.id];
      if (l.optional || !f.n || f.pct >= 100 || skip.indexOf(l.id) >= 0 || !jahrOk(l)) return;
      var pt = (100 - f.pct) * W.abstand;
      if (f.started) pt += W.begonnen;
      if (f.wdh1 > 0) pt += W.wdh;
      if (f.probe && f.probe.note > 4) pt += W.probe;
      if (l.pruefung) pt += W.pruefung;
      if (hierLf && hierLf.id !== l.id && hierLf.block && hierLf.block === l.block) pt += W.block;
      kand.push({ lf: l.id, punkte: Math.round(pt * 10) / 10, grund: grund(l, f), i: i });
    });
    kand.sort(function (a, b) { return b.punkte - a.punkte || a.i - b.i; });
    var liste = kand.filter(function (k) { return !hier || k.lf !== hier.lf; }).slice(0, W.anzahl).map(function (k) { return { lf: k.lf, punkte: k.punkte, grund: k.grund }; });
    if (!anyStart) {   // leerer Speicher: das erste Lernfeld des niedrigsten Jahres, ohne Zwang
      var erste = kand.slice().sort(function (a, b) { var ja = lfs[a.i].jahr || 9, jb = lfs[b.i].jahr || 9; return ja - jb || a.i - b.i; })[0];
      liste = erste ? [{ lf: erste.lf, punkte: erste.punkte, grund: 'Beginne mit dem ersten Lernfeld deines Jahres, du musst nichts in fester Reihenfolge machen.' }] : [];
    }
    return { hier: hier, naechste: liste, offenePflicht: offenePflicht, leer: !anyStart };
  }
  function grund(l, f) {
    if (f.probe && f.probe.note > 4) return 'Dein Probetest war noch nicht bestanden.';
    if (f.wdh1 > 0) return 'Hier warten ' + f.wdh1 + (f.wdh1 === 1 ? ' Aufgabe' : ' Aufgaben') + ' zum Wiederholen.';
    if (f.started) return f.done ? 'Du hast hier schon ' + f.done + ' von ' + f.n + ' Aufgaben gelöst.' : 'Du hast hier schon Aufgaben angefangen.';
    if (l.pruefung) return 'Kommt in der Abschlussprüfung ' + (l.pruefung === 'AP1' ? 'Teil 1' : l.pruefung === 'AP2' ? 'Teil 2' : 'Teil 1 und Teil 2') + ' vor.';
    return 'Hier ist noch am meisten offen (' + f.pct + ' % gelöst).';
  }

  /* ---------------------------------------------------------------- Prüfung eines Plans
     ctx: { AUFGABEN, LAB_REG, VB_INDEX, WikiIndex, dateien (Dateinamen des Web-Ordners; ohne Angabe werden Dateien nicht geprüft) }
     Rückgabe { ok, fehler[], warnungen[], status, info: { labsOhneLernfeld[], aufgabenN, aufgabenZugeordnet, abdeckung (Prozent) } }. */
  function wikiTreffer(c, s) {
    var q = String(s).toLowerCase();
    return c.wiki.some(function (e) { return e[0] === s || String(e[2]).toLowerCase() === q || String(e[3] || '').toLowerCase().split('|').indexOf(q) >= 0; });
  }
  function validate(p, ctx) {
    var c = C(ctx), F = [], Wn = [], info = { labsOhneLernfeld: [], aufgabenN: 0, aufgabenZugeordnet: 0, abdeckung: 100 };
    var err = function (s) { F.push(s); }, warn = function (s) { Wn.push(s); };
    var done = function () { return { ok: F.length === 0, fehler: F, warnungen: Wn, status: p && p.status, info: info }; };
    if (!p || typeof p !== 'object') { err('Plan fehlt oder ist kein Objekt.'); return done(); }
    var b = p.beruf;
    if (!BERUFE.some(function (x) { return x.k === b; })) { err('beruf "' + b + '" ist unbekannt (erlaubt: ' + BERUFE.map(function (x) { return x.k; }).join(', ') + ').'); return done(); }
    if (typeof p.titel !== 'string' || p.titel.length < 5) err('titel fehlt.');
    if (STATUS.indexOf(p.status) < 0) err('status muss ' + STATUS.join(', ') + ' sein (ist "' + p.status + '").');
    if (typeof p.quelle !== 'string' || !p.quelle) err('quelle (Plan) fehlt.');
    var jahre = {}; if (!Array.isArray(p.jahre) || !p.jahre.length) err('jahre fehlt (Liste { j, t }).'); else p.jahre.forEach(function (y) { if (!y || typeof y.j !== 'number' || y.j < 0 || y.j > 4 || typeof y.t !== 'string') err('jahre: ungültiger Eintrag ' + JSON.stringify(y)); else jahre[y.j] = 1; });
    var lfs = p.lernfelder;
    if (!Array.isArray(lfs)) { err('lernfelder muss eine Liste sein.'); return done(); }
    var skelett = p.status === 'skelett';
    if (skelett && lfs.length) err('status "skelett", aber lernfelder ist nicht leer: status auf "entwurf" setzen.');
    if (!skelett && !lfs.length) err('lernfelder ist leer: Status "skelett" lassen oder Lernfelder eintragen.');
    var ids = {}, expl = {}, labsGenutzt = {};
    lfs.forEach(function (lf, n) {
      var w = 'Lernfeld ' + (lf && lf.id != null ? '"' + lf.id + '"' : '#' + (n + 1)) + ': ';
      if (!lf || typeof lf !== 'object') { err(w + 'kein Objekt.'); return; }
      if (typeof lf.id !== 'string' || !/^[A-Za-z0-9._-]+$/.test(lf.id)) err(w + 'id fehlt oder enthält ungültige Zeichen.'); else if (ids[lf.id]) err(w + 'id doppelt.'); else ids[lf.id] = 1;
      if (typeof lf.nr !== 'string') err(w + 'nr muss ein Text sein (leer bei Zusatzthemen ohne Lernfeldnummer).');
      if (typeof lf.titel !== 'string' || lf.titel.length < 5) err(w + 'titel fehlt.');
      if (typeof lf.kurz !== 'string' || lf.kurz.length < 20) err(w + 'kurz fehlt oder ist zu kurz (1-2 Sätze).'); else if (lf.kurz.length > MAX_KURZ) err(w + 'kurz hat ' + lf.kurz.length + ' Zeichen (höchstens ' + MAX_KURZ + ').');
      [lf.titel, lf.kurz].concat(arr(lf.themen)).forEach(function (s) {
        if (typeof s !== 'string') return;
        if (NAMEN_RE.test(s)) err(w + 'Personenbezug im Text: "' + s.slice(0, 40) + '".');
        if (/https?:\/\/|www\./i.test(s)) err(w + 'keine Adressen in Texten.');
        if (/\bman\b/i.test(s)) warn(w + 'Du-Form statt "man": "' + s.slice(0, 50) + '".');
      });
      if (typeof lf.jahr !== 'number' || !jahre[lf.jahr]) err(w + 'jahr ' + lf.jahr + ' steht nicht in jahre.');
      if (typeof lf.quelle !== 'string' || !lf.quelle) err(w + 'quelle fehlt (z. B. "KMK-Rahmenlehrplan: <Quelle 1>, <Quelle 2>" oder "Entwurf").');
      if (typeof lf.entwurf !== 'boolean') err(w + 'entwurf muss true oder false sein.');
      else if (/^entwurf/i.test(String(lf.quelle)) && !lf.entwurf) err(w + 'quelle "Entwurf", aber entwurf ist false.');
      if (lf.block != null && typeof lf.block !== 'string') err(w + 'block muss ein Text sein.');
      if (lf.optional !== undefined && typeof lf.optional !== 'boolean') err(w + 'optional muss true oder false sein.');
      if (lf.pruefungAbgeleitet !== undefined && typeof lf.pruefungAbgeleitet !== 'boolean') err(w + 'pruefungAbgeleitet muss true oder false sein.');
      if (lf.pruefung != null && PRUEFUNG.indexOf(lf.pruefung) < 0) err(w + 'pruefung muss AP1, AP2, beide oder null sein.');
      if (lf.heft != null) {
        if (typeof lf.heft !== 'string' || !/^lernen-[a-z0-9]+\.html$/.test(lf.heft)) err(w + 'heft muss lernen-<name>.html oder null sein.');
        else if (c.dateien && !c.dateien.has(lf.heft)) err(w + 'Heft ' + lf.heft + ' existiert nicht.');
      }
      if (lf.heft === undefined) err(w + 'heft fehlt (Dateiname oder null).');
      if (!Array.isArray(lf.labs)) err(w + 'labs muss eine Liste sein.');
      (lf.labs || []).forEach(function (e) {
        var ew = w + 'Lab "' + (e && e.lab) + '": ';
        if (!e || typeof e.lab !== 'string') { err(w + 'Lab-Eintrag ohne lab.'); return; }
        var r = c.reg[e.lab];
        if (!r) { err(ew + 'Lab unbekannt.'); return; }
        if (AUSGEBLENDET.indexOf(e.lab) >= 0 || !(r.beruf && r.beruf.length)) { err(ew + 'dieses Lab ist gesperrt und gehört nicht in den Plan.'); return; }
        if (r.hub) { err(ew + 'Hub-Seite, kein Lab.'); return; }
        if (c.dateien && !c.dateien.has(r.file)) err(ew + 'Lab-Seite ' + r.file + ' existiert nicht.');
        if (e.fremd !== undefined && typeof e.fremd !== 'boolean') err(ew + 'fremd muss true oder false sein.');
        if (e.fremd) { if ((r.beruf || []).indexOf(b) >= 0) err(ew + 'fremd:true, aber das Lab gehört zum Beruf.'); } else {
          if ((r.beruf || []).indexOf(b) < 0) { err(ew + 'gehört nicht zum Beruf ' + b + ' (Verweis auf Labs anderer Berufe mit fremd:true).'); return; }
          labsGenutzt[e.lab] = 1;
        }
        if (e.aufgaben === undefined && e.bereich === undefined) err(ew + 'aufgaben oder bereich nötig.');
        arr(e.aufgaben).forEach(function (i) {
          var row = c.ix.byId[i];
          if (!row) err(ew + 'Aufgabe "' + i + '" existiert nicht in aufgaben.js.');
          else if (row[1] !== e.lab) err(ew + 'Aufgabe "' + i + '" gehört zu Lab ' + row[1] + '.');
          else if (!e.fremd) { if (expl[i] && expl[i] !== lf.id) err(ew + 'Aufgabe "' + i + '" steht auch in Lernfeld ' + expl[i] + ' (eine Aufgabe zählt in genau einem Lernfeld).'); expl[i] = lf.id; }
        });
        var cats = c.ix.cats[e.lab] || {};
        arr(e.bereich).forEach(function (k) { if (typeof k !== 'string' || (k !== '*' && !cats[k])) err(ew + 'Kategorie "' + k + '" gibt es in diesem Lab nicht.'); });
        if (e.aufgaben !== undefined && !Array.isArray(e.aufgaben)) err(ew + 'aufgaben muss eine Liste sein.');
      });
      arr(lf.wiki).forEach(function (s) { if (typeof s !== 'string' || !wikiTreffer(c, s)) err(w + 'Wiki-Verweis "' + s + '" steht nicht in wiki-index.js (ID, Titel oder Stichwort).'); });
      if (lf.wiki !== undefined && !Array.isArray(lf.wiki)) err(w + 'wiki muss eine Liste sein.');
      arr(lf.projekt).forEach(function (pe) {
        var pw = w + 'Projekt "' + (pe && pe.pid) + '": ', pr = pe && c.vb.filter(function (x) { return x.id === pe.pid; })[0];
        if (!pr) { err(pw + 'steht nicht in VB_INDEX.'); return; }
        if ((pr.beruf || []).indexOf('alle') < 0 && (pr.beruf || []).indexOf(b) < 0) err(pw + 'gehört nicht zum Beruf ' + b + '.');
        arr(pe.station).forEach(function (s) { if (!pr.st.some(function (x) { return x[0] === s; })) err(pw + 'Station "' + s + '" gibt es nicht.'); });
      });
    });
    /* Abdeckung: jedes Lab des Berufs muss in mindestens einem Lernfeld stehen, die Aufgaben zu mindestens 95 Prozent */
    if (lfs.length) {
      var labs = labsVon(c, b);
      info.labsOhneLernfeld = labs.filter(function (k) { return !labsGenutzt[k]; });
      var z = zuordnung(p, c), mine = c.rows.filter(function (r) { return labs.indexOf(r[1]) >= 0; });
      info.aufgabenN = mine.length; info.aufgabenZugeordnet = mine.filter(function (r) { return has(z.byId, r[0]); }).length;
      info.abdeckung = mine.length ? Math.round(1000 * info.aufgabenZugeordnet / mine.length) / 10 : 100;
      if (info.labsOhneLernfeld.length) err('Labs des Berufs ohne Lernfeld: ' + info.labsOhneLernfeld.join(', ') + '.');
      if (info.abdeckung < 95) err('Nur ' + info.abdeckung + ' % der Aufgaben sind einem Lernfeld zugeordnet (mindestens 95 %).');
      else if (info.abdeckung < 100) {
        var rest = {}; mine.forEach(function (r) { if (!has(z.byId, r[0])) rest[r[1]] = (rest[r[1]] || 0) + 1; });
        warn(info.aufgabenN - info.aufgabenZugeordnet + ' Aufgaben ohne Lernfeld (' + Object.keys(rest).map(function (k) { return k + ' ' + rest[k]; }).join(', ') + ').');
      }
    } else if (skelett) {
      info.labsOhneLernfeld = labsVon(c, b);
      info.aufgabenN = c.rows.filter(function (r) { return info.labsOhneLernfeld.indexOf(r[1]) >= 0; }).length; info.abdeckung = 0;
      warn('Skelett: noch keine Lernfelder, ' + info.labsOhneLernfeld.length + ' Labs mit ' + info.aufgabenN + ' Aufgaben ohne Lernfeld.');
    }
    return done();
  }

  var API = { BERUFE: BERUFE, STATUS: STATUS, PRUEFUNG: PRUEFUNG, AUSGEBLENDET: AUSGEBLENDET, MAX_KURZ: MAX_KURZ, W: W,
    register: register, plan: plan, berufe: berufe, zuordnung: zuordnung, lernfeldFortschritt: lernfeldFortschritt, naechste: naechste, validate: validate,
    ladeLernstand: ladeLernstand, ergebnis: ergebnis, labsVon: function (b, ctx) { return labsVon(C(ctx), b); }, _reset: function () { REG = {}; } };
  var vorhanden = root.AusbildungsPlan;   // zweites Laden (z. B. Test) überschreibt nichts Fremdes
  root.AusbildungsPlan = API; drain();
  if (vorhanden && vorhanden !== API && typeof vorhanden.berufe === 'function') vorhanden.berufe().forEach(function (k) { register(k, vorhanden.plan(k)); });
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
