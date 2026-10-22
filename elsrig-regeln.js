/* elsrig-regeln.js - ELS-Lab (WP2d): Pruefstand 8 `regeln` - Sicherheitsregeln und Erste Hilfe (SPEC 5.8).
 * Die gemeinsame Huelle liegt in elsrig-base.js: Diese Datei im Browser NACH elsrig-base.js laden (in Node holt sie sich die Basis per require).
 * Gerechnet/geprueft wird NUR im Kern (ELS_CORE.rules.check / list / five, ELS_CORE.aid.check / list / chain); die Texte der Pruefung stehen dort (eine Quelle).
 * Sicherheit (SPEC 9, verbindlich): Spannungspruefer, Erdungsseil, Schloss nur als SYMBOL, keine Bedienanleitung, kein Hinweis zu Messgeraeten. Erste Hilfe nur als
 * Reihenfolge und Begriffe, KEINE Zahlen zur Wiederbelebung (F12), nichts zu Behandlung oder Medikamenten. Immer: "Dieses Lab ersetzt keine Unterweisung und keinen
 * Erste-Hilfe-Kurs." Die fuenf Sicherheitsregeln sind Lernstoff fuer Elektrofachkraefte und unterwiesene Personen; die Simulation ersetzt keine Unterweisung.
 *
 * Steuerwerte: modus (regeln | rettung), szene (schaltschrank | maschine | leuchte; nur Beschriftung und Bild, NICHT die Reihenfolge), schritt (naechster Schritt der
 *              fuenf Regeln) und rschritt (naechster Schritt der Rettungskette), je nach Modus sichtbar, Optionen in gemischter Reihenfolge (die Anzeige verraet die
 *              Loesung nicht), reihenfolgeFrei (aus: ein falscher Schritt wird abgelehnt und erklaert; ein: freie Reihenfolge, Fehler werden erklaert und gezaehlt),
 *              Tasten fire (Schritt bestaetigen) und neu (von vorn; zaehlt nicht als Fehler).
 * Messgeraete: schritte (richtige Schritte von 5, ab Anfang gezaehlt), fehler (Anzahl falscher Bestaetigungen, jede Fehlerreihe zaehlt einmal).
 * Zusatzmethoden: do(name) (Schritt-Id wie freischalten, notruf, oder neu; fuer Ablaufzeilen {t, do:'freischalten'}), folge() (bestaetigte Schritte des aktuellen Modus),
 *              pruefung() (Ergebnis von rules.check bzw. aid.check fuer die aktuelle Folge). Wirft nie.
 * hitTest: Schritt-Karten (key schritt/rschritt, to), Bestaetigen (fire), Neu (neu).
 */
(function (root) {
  'use strict';
  const R = root.ELS_RIGS = root.ELS_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };
  if (typeof module !== 'undefined') module.exports = R;
  if (!R.base && typeof require === 'function') { try { require('./elsrig-base.js'); } catch (e) { /* Basis fehlt */ } }
  const B = R.base;
  if (!B) { if (typeof console !== 'undefined') console.warn('elsrig-regeln.js: Die Basis elsrig-base.js fehlt (bitte davor laden).'); return; }
  let C0 = null;
  try { C0 = B.core(); } catch (e) { C0 = null; }
  if (!C0 || !C0.rules || !C0.aid) { if (typeof console !== 'undefined') console.warn('elsrig-regeln.js: ELS_CORE Teil 2 (elscore-pruef.js: rules, aid) fehlt, der Pruefstand wird nicht registriert.'); return; }

  const FIVE = C0.rules.five.slice(), CHAIN = C0.aid.chain.slice();
  const RNAME = {}; C0.rules.list.forEach(r => { RNAME[r.id] = r; });
  const ANAME = {}; C0.aid.list.forEach(r => { ANAME[r.id] = r; });
  const RSHORT = { freischalten: 'Freischalten', sichern: 'Gegen Wiedereinschalten sichern', spannungsfrei: 'Spannungsfreiheit feststellen', erden: 'Erden und Kurzschließen', abdecken: 'Benachbarte Teile abdecken' };
  const ASHORT = { eigenschutz: 'Eigenschutz beachten', abschalten: 'Abschalten oder sicher trennen', notruf: 'Notruf absetzen', pruefen: 'Bewusstsein und Atmung prüfen', massnahmen: 'Erste-Hilfe-Maßnahmen einleiten' };
  // gemischte Anzeigereihenfolge (feste Permutation, die Loesung steht nicht in der Auswahl)
  const PERM_R = [3, 0, 4, 1, 2], PERM_A = [2, 0, 4, 1, 3];
  const MIXED_R = PERM_R.map(i => FIVE[i]), MIXED_A = PERM_A.map(i => CHAIN[i]);
  const G_M = 'Szenario', G_S = 'Ablauf';
  const CONTROLS = [
    { key: 'modus', label: 'Szenario-Modus', type: 'select', value: 'regeln', options: [{ value: 'regeln', label: 'Fünf Sicherheitsregeln' }, { value: 'rettung', label: 'Rettungskette (Stromunfall im Labor)' }], ebene: null, group: G_M,
      help: 'Zwei Übungen: die fünf Sicherheitsregeln an einer Anlage oder die Rettungskette nach einem Stromunfall im Labor. Beides nur als Reihenfolge, kein Ersatz für Unterweisung und Erste-Hilfe-Kurs.' },
    { key: 'szene', label: 'Anlage', type: 'select', value: 'schaltschrank', options: [{ value: 'schaltschrank', label: 'Schaltschrank' }, { value: 'maschine', label: 'Maschine' }, { value: 'leuchte', label: 'Leuchte' }], ebene: null, group: G_M,
      visible: st => st.modus !== 'rettung', help: 'Ändert nur Beschriftung und Bild, nicht die Reihenfolge der Regeln. Spannungsprüfer und Erdungsseil sind nur Symbole, es gibt keine Bedienanleitung.' },
    { key: 'schritt', label: 'Nächster Schritt (Sicherheitsregeln)', type: 'select', value: MIXED_R[0], options: MIXED_R.map(id => ({ value: id, label: RSHORT[id] })), ebene: 'basis', group: G_S,
      visible: st => st.modus !== 'rettung', help: 'Wähle den Schritt, den du als Nächstes bestätigen willst, und bestätige mit der Taste. Die Auswahl steht in gemischter Reihenfolge; die Reihenfolge der fünf Regeln musst du kennen.' },
    { key: 'rschritt', label: 'Nächster Schritt (Rettungskette)', type: 'select', value: MIXED_A[0], options: MIXED_A.map(id => ({ value: id, label: ASHORT[id] })), ebene: 'zusatz', group: G_S,
      visible: st => st.modus === 'rettung', help: 'Wähle den Schritt, den du als Nächstes bestätigen willst, und bestätige mit der Taste. Es gibt keine Zahlen zur Wiederbelebung: Das lernst du im Erste-Hilfe-Kurs.' },
    { key: 'reihenfolgeFrei', label: 'Freie Reihenfolge', type: 'switch', value: false, ebene: 'fehler', group: G_S,
      help: 'Aus: Ein falscher Schritt wird abgelehnt und erklärt, erst die richtige Reihenfolge schaltet den nächsten Schritt frei. Ein: Du kannst jede Reihenfolge wählen, Fehler werden erklärt und gezählt.' },
    { key: 'fire', label: 'Schritt bestätigen', type: 'button', ebene: null, group: G_S, help: 'Bestätigt den gewählten Schritt. Er kommt an das Ende deiner Reihenfolge, wenn die Reihenfolge es erlaubt (oder bei freier Reihenfolge immer).' },
    { key: 'neu', label: 'Von vorn beginnen', type: 'button', ebene: null, group: G_S, help: 'Löscht die bestätigten Schritte, Auswahl und Anlage bleiben. Das zählt nicht als Fehler.' }
  ];
  const METERS = [
    { key: 'schritte', label: 'Richtige Schritte (von 5)', unit: '', digits: 0, min: 0, max: 5, zeroIsNone: true, help: 'Wie viele Schritte stehen ab dem Anfang in der richtigen Reihenfolge. Fünf von fünf ist vollständig.' },
    { key: 'fehler', label: 'Fehler', unit: '', digits: 0, min: 0, max: 20, zeroIsNone: true, help: 'Anzahl der falschen Bestätigungen. Eine falsche Folge zählt einmal, bis du von vorn beginnst.' }
  ];
  const PRESETS = [
    { id: 'schaltschrank', name: 'Schaltschrank', info: 'Die fünf Sicherheitsregeln am Schaltschrank, strenge Reihenfolge.', params: { modus: 'regeln', szene: 'schaltschrank' } },
    { id: 'maschine', name: 'Maschine', info: 'Dieselbe Reihenfolge, Beschriftung der Maschine.', params: { modus: 'regeln', szene: 'maschine' } },
    { id: 'leuchte', name: 'Leuchte', info: 'Dieselbe Reihenfolge, Beschriftung der Leuchte; freie Reihenfolge: Fehler werden erklärt.', params: { modus: 'regeln', szene: 'leuchte', reihenfolgeFrei: true } },
    { id: 'rettung', name: 'Rettungskette', info: 'Stromunfall im Labor: Eigenschutz, Abschalten, Notruf, Prüfen, Maßnahmen. Ohne Zahlen zur Wiederbelebung.', params: { modus: 'rettung' } }
  ];
  const PFAD = { fehler: 'Arbeit an der Anlage oder Stromunfall', weg: 'Richtige Schritte, richtige Reihenfolge', schutz: 'Fünf Sicherheitsregeln, Rettungskette', art: 'verhalten' };
  const PARAMS = { maxFolge: 12 };

  function plant(P0) {
    const CORE = P0.CORE;
    const st = { regeln: [], rettung: [], fehler: 0, letzte: '', letzteArt: 'ok', inFehler: { regeln: false, rettung: false } };
    const clearAll = () => { st.regeln = []; st.rettung = []; st.fehler = 0; st.letzte = ''; st.letzteArt = 'ok'; st.inFehler = { regeln: false, rettung: false }; };
    const fn = (m, seq, sz) => (m === 'rettung' ? CORE.aid.check(seq) : CORE.rules.check(seq, sz));
    const ORD = m => (m === 'rettung' ? CHAIN : FIVE);
    const NM = m => (m === 'rettung' ? ANAME : RNAME);
    function prefix(m, seq) { const o = ORD(m); let n = 0; while (n < seq.length && seq[n] === o[n]) n++; return n; }

    function compute(ctl) {
      const m = ctl.modus === 'rettung' ? 'rettung' : 'regeln', seq = st[m].slice();
      let chk = null;
      try { chk = fn(m, seq, ctl.szene); } catch (e) { chk = null; }
      if (!chk || chk.ok === undefined) return { ok: false, text: CORE.TEXTS.eingabe };
      // Schritte (Karten) mit Beschriftung der Szene
      let schr = chk.schritte || [];
      if (m === 'regeln') { try { schr = CORE.rules.check([], ctl.szene).schritte; } catch (e) { schr = chk.schritte || []; } }
      return { ok: true, m, seq, chk, schr, pre: prefix(m, seq), fehler: st.fehler, szene: ctl.szene, frei: !!ctl.reihenfolgeFrei, letzte: st.letzte };
    }
    function meters(r) {
      if (!r || r.ok === false) return { schritte: 0, fehler: 0 };
      return { schritte: r.pre, fehler: r.fehler };
    }
    const isErr = c => !c.ok && !c.weiter;
    function assess(r) {
      if (!r || r.ok === false) return { ok: false, ampel: 'grau', text: (r && r.text) || CORE.TEXTS.eingabe };
      const c = r.chk, n = ORD(r.m).length;
      if (!r.seq.length) return { ok: false, ampel: 'grau', text: 'Noch kein Schritt bestätigt. ' + (r.letzte ? r.letzte + ' ' : '') + 'Wähle den ersten Schritt und bestätige ihn. ' + CORE.TEXTS.keinKurs };
      if (c.ok) return { ok: true, ampel: 'gruen', text: c.text, zusatz: r.pre + ' von ' + n + ' Schritten' };
      if (isErr(c)) return { ok: false, ampel: 'rot', text: c.text, zusatz: r.pre + ' von ' + n + ' Schritten richtig' };
      return { ok: false, ampel: 'gelb', text: (r.letzte ? r.letzte + ' ' : '') + 'Bisher richtig: ' + r.pre + ' von ' + n + ' Schritten. Wähle den nächsten Schritt.', zusatz: r.pre + ' von ' + n + ' Schritten' };
    }
    function diag(r) {
      const out = [];
      if (!r || r.ok === false) return out;
      if (isErr(r.chk)) out.push({ id: 'reihenfolge-' + r.m + '-' + r.chk.art + '-' + r.chk.firstError, kind: 'warn', text: r.chk.text });
      if (r.chk.ok) out.push({ id: 'fertig-' + r.m, kind: 'info', text: r.chk.text });
      return out;
    }
    function curves() { return []; }

    // ---------------- Handlungen ----------------
    function confirm(id) {
      const ctl = P0.ctl, m = ctl.modus === 'rettung' ? 'rettung' : 'regeln';
      id = String(id);
      if (ORD(m).indexOf(id) < 0) { P0.say('„' + id + '“ gehört nicht zu den Schritten dieses Szenarios.', 'warn'); return false; }
      const seq = st[m], frei = !!ctl.reihenfolgeFrei;
      let cand, c;
      try { cand = seq.concat([id]); c = fn(m, cand, ctl.szene); } catch (e) { return false; }
      const alt = (() => { try { return fn(m, seq, ctl.szene); } catch (e) { return null; } })();
      if (isErr(c)) {
        if (!frei) {                                 // streng: abgelehnt und erklaert
          st.fehler++; st.letzte = 'Abgelehnt: ' + c.text; P0.say('Abgelehnt: ' + c.text, 'warn'); P0.bump();
          return false;
        }
        seq.push(id);
        if (!(alt && isErr(alt))) st.fehler++;
        st.letzte = c.text; P0.say(c.text, 'warn'); P0.bump();
        return true;
      }
      seq.push(id);
      st.letzte = '';
      P0.say(c.ok ? c.text : 'Schritt „' + NM(m)[id].name + '“ bestätigt: richtig, bisher ' + (seq.length) + ' von ' + ORD(m).length + '.', 'info');
      P0.bump();
      return true;
    }
    function doStep(name) {
      name = String(name);
      if (name === 'neu') { st.regeln = []; st.rettung = []; st.letzte = ''; st.fehler = 0; P0.bump(); return true; }
      return confirm(name);
    }
    const stSym = (r, id) => { const i = r.seq.indexOf(id); return i < 0 ? '' : (i < r.pre ? '✓' : '✗'); };

    // ---------------- Zeichnen ----------------
    let hl = [], hlW = 0, hlH = 0;
    function draw(ctx, w, h, t, view, sc) {
      const R0 = sc.rect, pal = sc.pal, g = sc.gfx, r = view.res, fs = sc.fs, D = sc.D;
      if (!sc.ghost) { hl = []; hlW = w; hlH = h; }
      if (!R0 || !(R0.w >= 220 && R0.h >= 200)) return;
      if (!r || r.ok === false) { g.text(ctx, (r && r.text) || '', R0.x + 10, R0.y + 24, { size: fs, color: pal.fg, max: R0.w - 20 }); return; }
      const narrow = R0.w < 560, n = ORD(r.m).length, cardH = 40, gap = 6;
      const mixed = r.m === 'rettung' ? MIXED_A : MIXED_R, selKey = r.m === 'rettung' ? 'rschritt' : 'schritt', sel = view.ctl[selKey];
      const cardsH = n * cardH + (n - 1) * gap, btnH = 40;
      const msgH = 2 * (fs + 5) + 6;
      // Aufteilung: oben Bild, darunter Karten (Spalte rechts bei breit), unten Tasten und Meldung
      const bottomH = btnH + 8 + msgH;
      let img, list;
      if (!narrow) {
        const avail = R0.h - bottomH - 6;
        const lw = Math.round(R0.w * 0.46);
        img = { x: R0.x, y: R0.y, w: R0.w - lw - 8, h: avail };
        list = { x: R0.x + R0.w - lw, y: R0.y, w: lw, h: Math.min(avail, cardsH) };
      } else {
        const avail = R0.h - bottomH - 6, lh = cardsH;
        const ih = avail - lh - 8;
        img = ih >= 130 ? { x: R0.x, y: R0.y, w: R0.w, h: ih } : null;
        list = { x: R0.x, y: R0.y + (img ? img.h + 8 : 0), w: R0.w, h: Math.min(lh, avail) };
      }
      // ---- Bild ----
      if (img && img.w >= 220 && img.h >= 120) {
        if (r.m === 'regeln') {
          let done = false;
          if (D && typeof D.cabinetScene === 'function' && img.h >= 150) { try { done = !!D.cabinetScene(ctx, img, { done: Math.min(r.pre, 5) }, { theme: sc.theme }); } catch (e) { done = false; } }
          if (!done) {
            g.panel(ctx, img.x, img.y, img.w, img.h, pal.panel, pal.line, 10);
            g.text(ctx, (r.szene === 'maschine' ? 'Maschine' : r.szene === 'leuchte' ? 'Leuchte' : 'Schaltschrank') + ' (Symbolbild)', img.x + 10, img.y + 22, { size: fs + 1, bold: true, color: pal.fg, max: img.w - 20 });
            g.text(ctx, r.pre + ' von 5 Regeln erledigt', img.x + 10, img.y + 22 + fs + 8, { size: fs, color: pal.mute, max: img.w - 20 });
          }
        } else {
          g.panel(ctx, img.x, img.y, img.w, img.h, pal.panel, pal.line, 10);
          g.text(ctx, 'Rettungskette', img.x + 10, img.y + 22, { size: fs + 1, bold: true, color: pal.fg, max: img.w - 20 });
          const bw = (img.w - 20 - 4 * 10) / 5, by = img.y + 40, bh = Math.min(img.h - 56, 70);
          CHAIN.forEach((id, i) => {
            const x = img.x + 10 + i * (bw + 10), got = r.seq.indexOf(id) >= 0 && i < r.pre, col = got ? pal.gruen : pal.line;
            if (bh >= 30 && bw >= 24) {
              g.panel(ctx, x, by, bw, bh, pal.panel2, col, 6);
              g.text(ctx, String(i + 1), x + bw / 2, by + bh / 2 - 2, { size: fs + 4, bold: true, color: got ? pal.gruen : pal.mute, align: 'center', base: 'middle' });
              g.text(ctx, got ? '✓' : '·', x + bw / 2, by + bh - 12, { size: fs, bold: true, color: got ? pal.gruen : pal.mute, align: 'center', base: 'middle' });
              if (i < 4) g.arrow(ctx, x + bw + 1, by + bh / 2, x + bw + 9, by + bh / 2, pal.mute, 2, 4);
            }
          });
          g.text(ctx, CORE.TEXTS.keinKurs, img.x + 10, img.y + img.h - 10, { size: fs - 1, color: pal.mute, max: img.w - 20 });
        }
      }
      // ---- Karten ----
      const shown = Math.min(n, Math.max(1, Math.floor((list.h + gap) / (cardH + gap))));
      for (let i = 0; i < shown; i++) {
        const id = mixed[i], y = list.y + i * (cardH + gap), nm = NM(r.m)[id], sym = stSym(r, id), pos = r.seq.indexOf(id);
        const sch = r.schr.filter(q => q.id === id)[0], lab = sch && sch.beschriftung && list.w >= 340 ? ' · ' + sch.beschriftung : '';
        const col = pos < 0 ? pal.line : pos < r.pre ? pal.gruen : pal.rot;
        g.chip(ctx, '', (pos >= 0 ? (pos + 1) + ' ' : '') + (r.m === 'rettung' ? ASHORT[id] : RSHORT[id]) + lab + (sym ? ' ' + sym : ''), list.x, y, list.w, cardH, pal, { color: col, on: sel === id, size: fs });
        if (!sc.ghost) hl.push({ x: list.x, y, w: list.w, h: cardH, key: selKey, to: id });
      }
      // ---- Tasten und Meldung ----
      const by = R0.y + R0.h - bottomH, bw = Math.min(190, (R0.w - 8) / 2);
      g.chip(ctx, '', 'Schritt bestätigen', R0.x, by, bw, btnH, pal, { color: pal.schutz, size: fs });
      if (!sc.ghost) hl.push({ x: R0.x, y: by, w: bw, h: btnH, key: 'fire' });
      g.chip(ctx, '', 'Von vorn', R0.x + bw + 8, by, Math.min(120, R0.w - bw - 8), btnH, pal, { color: pal.line, size: fs });
      if (!sc.ghost) hl.push({ x: R0.x + bw + 8, y: by, w: Math.min(120, R0.w - bw - 8), h: btnH, key: 'neu' });
      if (R0.w > 2 * bw + 8 + 200) g.text(ctx, r.pre + ' von ' + n + ' richtig · Fehler ' + r.fehler, R0.x + bw + 8 + 120 + 12, by + btnH / 2, { size: fs, bold: true, color: pal.fg, base: 'middle', max: R0.w - (bw + 8 + 120 + 12) });
      const msg = view.ampel && view.ampel.text ? view.ampel.text : '';
      g.text(ctx, msg, R0.x, by + btnH + 8 + fs + 2, { size: fs, color: pal.fg, max: R0.w });
      g.text(ctx, CORE.TEXTS.keinKurs, R0.x, by + btnH + 8 + 2 * (fs + 5), { size: fs - 1, color: pal.mute, max: R0.w });
    }
    function hit(px, py, w, h) {
      if (!hl.length || !(hlW > 0) || !(hlH > 0)) return null;
      const qx = px * hlW / w, qy = py * hlH / h;
      for (let i = hl.length - 1; i >= 0; i--) {
        const q = hl[i];
        if (qx >= q.x && qx <= q.x + q.w && qy >= q.y && qy <= q.y + q.h) return q.to !== undefined ? { key: q.key, to: q.to } : { key: q.key };
      }
      return null;
    }
    return {
      compute, meters, assess, diag, curves, draw, hit,
      phaseHz: () => 0.2,
      fire(r, ctl) { return confirm(ctl.modus === 'rettung' ? ctl.rschritt : ctl.schritt); },
      onButton(key) { if (key === 'neu') return doStep('neu'); return false; },
      onControl() { },
      reset() { clearAll(); },
      state(r) { return { folge: r && r.ok ? r.seq.slice() : [], schritteRichtig: r && r.ok ? r.pre : 0, fehler: st.fehler, art: r && r.ok ? r.chk.art : 'ok', vollstaendig: !!(r && r.ok && r.chk.ok) }; },
      extend(api) {
        api.do = doStep;
        api.folge = () => { const m = P0.ctl.modus === 'rettung' ? 'rettung' : 'regeln'; return st[m].slice(); };
        api.pruefung = () => { const r = compute(P0.ctl); return r.ok ? r.chk : null; };
      }
    };
  }

  R.register({ id: 'regeln', name: 'Sicherheitsregeln und Erste Hilfe', icon: '🛡️',
    info: 'Die fünf Sicherheitsregeln an einer Anlage und die Rettungskette nach einem Stromunfall im Labor, jeweils als Reihenfolge. Simulation, kein Ersatz für Unterweisung und Erste-Hilfe-Kurs.',
    controls: CONTROLS, meters: METERS, presets: PRESETS,
    create(opts) { return B.makeRig({ id: 'regeln', name: 'Sicherheitsregeln und Erste Hilfe', icon: '🛡️', info: '', world: { w: 960, h: 600 }, pfad: PFAD, controls: CONTROLS, meters: METERS, presets: PRESETS, params: PARAMS, plant }, opts); } });
})(typeof window !== 'undefined' ? window : globalThis);
