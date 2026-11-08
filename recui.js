'use strict';
/* Tonfunk Auftrag-und-Recht-Lab: Oberfläche (Lab-Kennung 'rec').
   KEINE RECHTSBERATUNG. Prozentsätze, Fristen und Beträge sind ÜBUNGSWERTE; Gesetze ändern sich.
   Reiter: Vertrag (Zustandekommen), Fall-Prüfer (Rechte des Käufers), Fristen (Datumsrechner), Belegkette (Ordner), Brutto-Netto, Begriffe, Aufgaben, Trainer, Beispiele, Hilfe.
   Module: reccore.js (REC_CORE, Rechenlogik), recdata.js (REC_DATA, REC_TASKS: Aufgaben, Beispiele, Zuordnungs-Sätze).
   Speicher (Präfix lm4.rec.): tab, vert, fall, frist, beleg, lohn, mt, done ({id:true} nur gelöste), prog ({id:Prozent}), hints, ctipps (nur Prüfmodus), exam ('1'), rt (Trainer).
   Tipp-Abzug (25 % je Stufe, höchstens 2 Stufen) gibt es nur im Prüfmodus; beim normalen Üben kosten Tipps nichts.
   Aufruf: reclab.html?aufgabe=rec1 öffnet die Aufgabe, reclab.html?bsp öffnet die Beispiele (?bsp=vert1 springt zu einem Beispiel). */
(function (root) {
  const C = root.REC_CORE, D = root.REC_DATA;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.rec.';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(LS + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} };
  const f = (v, d) => C.fmtN(v, d == null ? 2 : d, true), fe = v => C.eur(v), P = s => C.parseDe(s), PD = s => C.parseDate(s), sc = v => String(v).replace('.', ',');
  const dots = l => '●'.repeat(l || 1) + '○'.repeat(3 - (l || 1));
  const fx = () => root.LochFX || null;
  const ding = () => { const F = fx(); if (F && F.sound) try { F.sound('ding', 0.6); } catch (e) {} };
  const sad = () => { const F = fx(); if (F && F.sound) try { F.sound('sad', 0.5); } catch (e) {} };
  function toast(m) { const t = $('#toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), Math.max(2200, m.length * 55)); }
  function sheet(title, build) {
    const bd = document.createElement('div'); bd.className = 'backdrop';
    bd.innerHTML = `<div class="sheet" role="dialog" aria-label="${esc(title)}"><div class="sh-h"><b>${esc(title)}</b><button class="x" aria-label="Schließen">✕</button></div><div class="sh-b"></div></div>`;
    document.body.appendChild(bd);
    const close = () => bd.remove();
    bd.addEventListener('pointerdown', e => { if (e.target === bd) close(); });
    $('.x', bd).onclick = close; build($('.sh-b', bd), close); return close;
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { const b = $$('.backdrop'); if (b.length) b[b.length - 1].remove(); } });
  if (!C || !D) {
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>Auftrag-und-Recht-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">reccore.js oder recdata.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks;

  /* ============================================================ Zustand */
  const TABS = [['vert', '📜', 'Vertrag'], ['fall', '⚖️', 'Fall-Prüfer'], ['frist', '📅', 'Fristen'], ['beleg', '🗂️', 'Belegkette'], ['lohn', '💶', 'Brutto-Netto'], ['beg', '🔤', 'Begriffe'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['bsp', '📖', 'Beispiele'], ['help', '📘', 'Hilfe']];
  const MATCH = ['beg'];
  const S = {
    tab: lsGet('tab', 'vert'),
    vert: Object.assign({ angebot: 'bindend', bis: '30.04.2025', best: '28.04.2025', abw: 'nein', ab: 'keine' }, lsGet('vert', {})),
    fall: Object.assign({ stoerung: 'mangel', handel: 'ja', mangelart: 'offen', ruege: 'ja', nacherf: 'gescheitert', erheblich: 'ja', verschulden: 'ja', kalender: 'nein', mahnung: 'nein', fix: 'nein', nachfrist: 'nein' }, lsGet('fall', {})),
    frist: Object.assign({ mode: 'verj', d1: '15.06.2025', d2: '20.05.2025', n: '30', einheit: 'tage', tage: '7', betrag: '4000', satz: '11', sk: '10', ziel: '30', jahre: '6', probe: 'nein' }, lsGet('frist', {})),
    beleg: Object.assign({ set: 'beleg' }, lsGet('beleg', {})), bl: { order: [], res: null },
    lohn: Object.assign({ brutto: '2800', lst: '15', rv: '9,3', kv: '7,3', pv: '1,8', av: '1,3' }, lsGet('lohn', {})),
    mt: Object.assign({ beg: { n: 0, ok: 0 } }, lsGet('mt', {})), mq: { beg: { i: -1, sel: -1 } },
    task: null, tq: null, tAns: {}, tRes: null,
    tr: { q: null, ans: {}, res: null, level: 0 },
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {}))
  };
  if (!C.ORDER[S.beleg.set]) S.beleg.set = 'beleg';
  MATCH.forEach(k => { if (!S.mt[k]) S.mt[k] = { n: 0, ok: 0 }; });
  const R0 = (() => { const m = /[?&]seed=([^&]+)/.exec(location.search); return C.rng(m ? decodeURIComponent(m[1]) : String(Math.random()) + Date.now()); })();

  /* ============================================================ Bausteine */
  const box = (t, fm, res, cls) => `<div class="rdout ${cls || ''}"><span class="st">${esc(t)}</span>${fm ? esc(fm) + ' = ' : ''}<b>${esc(res)}</b></div>`;
  const note = (t, cls) => `<div class="rdout ${cls || 'warn'}">${esc(t)}</div>`;
  const inp = (k, label, val, unit, ph) => `<label class="f"><span>${esc(label)}${unit ? ' (' + esc(unit) + ')' : ''}</span><input data-k="${k}" inputmode="decimal" autocomplete="off" placeholder="${esc(ph || '')}" value="${esc(val)}"></label>`;
  const UEB = 'Dieses Lab ist keine Rechtsberatung. Prozentsätze, Fristen und Beträge sind Übungswerte für die Ausbildung, Gesetze ändern sich. Maßgebend sind immer die aktuellen Vorschriften, deine Verträge und die Angaben deines Betriebs.';
  const ueb = () => `<div class="rdout warn">⚠ ${esc(UEB)}</div>`;
  /* Auswahlleiste: Wert in S[tab][key] setzen (data-sk, data-sv) */
  const segk = (label, key, opts, cur) => `<div class="fbar"><span class="lbl" style="font-size:12px;color:var(--mute)">${esc(label)}</span><div class="seg">${opts.map(o => `<button data-sk="${esc(key)}" data-sv="${esc(o[0])}" class="${String(cur) === String(o[0]) ? 'on' : ''}">${esc(o[1])}</button>`).join('')}</div></div>`;
  const YN = [['ja', 'Ja'], ['nein', 'Nein']];
  const dateMsg = (what) => note('Gib ' + what + ' als Datum TT.MM.JJJJ ein, zum Beispiel 10.03.2025.');
  function bindTool(view, key, render, update) {
    view.addEventListener('input', e => { const k = e.target.dataset.k; if (!k) return; S[key][k] = e.target.value; lsSet(key, S[key]); update(); });
    view.addEventListener('click', e => { const b = e.target.closest('[data-sk]'); if (b) { S[key][b.dataset.sk] = b.dataset.sv; lsSet(key, S[key]); render(); } });
  }
  const endHint = e => (C.isWeekend(e) ? note('Das Fristende fällt auf einen ' + C.WDL[C.weekday(e)] + ' (§ 193 BGB, vereinfacht): Die Frist endet erst am nächsten Werktag, ' + C.fmtDateWd(C.nextWerktag(e)) + '. Feiertage prüfst du selbst.') : '');

  /* ============================================================ Vertrag (Zustandekommen) */
  function vertOut(p) {
    const bis = PD(p.bis), best = PD(p.best), hasB = String(p.best || '').trim() !== '';
    if (p.angebot === 'bindend' && !Number.isFinite(bis)) return dateMsg('das Datum "Angebot gültig bis"');
    if (hasB && !Number.isFinite(best)) return dateMsg('das Bestelldatum');
    const v = C.kaufvertrag({ angebot: p.angebot, gueltigBis: bis, bestellung: Number.isFinite(best) ? best : null, abweichend: p.abw === 'ja', ab: p.ab === 'keine' ? null : p.ab });
    let h = '';
    if (p.angebot === 'bindend' && Number.isFinite(best)) h += box('Bindung ans Angebot', 'Bestellung ' + C.fmtDate(best) + ', Angebot gültig bis ' + C.fmtDate(bis), best <= bis ? 'rechtzeitig' : 'verspätet', best <= bis ? 'ok' : 'bad');
    h += box('Ergebnis', '', C.VERTRAG[v.code] || '–', v.code === 'bestellung' || v.code === 'ab' ? 'ok' : 'warn');
    return h + note(v.grund, 'ok');
  }
  function renderVert() {
    const s = S.vert;
    $('#vertView').innerHTML = ueb() + `<div class="card pl"><h4>Angebot, Bestellung, Auftragsbestätigung</h4>
      ${segk('ANGEBOT', 'angebot', [['bindend', 'bindend, befristet'], ['frei', 'freibleibend'], ['kein', 'kein Angebot (nur Anfrage)']], s.angebot)}
      <div class="dsrow">${s.angebot === 'bindend' ? inp('bis', 'Angebot gültig bis', s.bis, '', 'TT.MM.JJJJ') : ''}${inp('best', 'Bestellung des Kunden am (leer = keine Bestellung)', s.best, '', 'TT.MM.JJJJ')}</div>
      ${segk('BESTELLUNG WEICHT VOM ANGEBOT AB', 'abw', YN, s.abw)}
      ${segk('AUFTRAGSBESTÄTIGUNG', 'ab', [['keine', 'keine'], ['gleich', 'wie bestellt'], ['abweichend', 'weicht ab']], s.ab)}
      <p class="hint2">Ein Kaufvertrag braucht Antrag und Annahme. Ein bindendes Angebot ist ein Antrag, ein freibleibendes nur eine Aufforderung zur Bestellung.</p></div><div id="vertOut"></div>`;
    updateVert();
  }
  function updateVert() { const e = $('#vertOut'); if (e) e.innerHTML = vertOut(S.vert); }
  bindTool($('#vertView'), 'vert', renderVert, updateVert);

  /* ============================================================ Fall-Prüfer (Rechte des Käufers) */
  /* PRUEFEN P25: Fall-Prüfer: Eingaben stark vereinfacht (Handelskauf ja/nein, Fixgeschäft, Mangel offen/versteckt/arglistig). Beim bürgerlichen Kauf (Handelskauf = Nein) entfällt die Rügepflicht; Verbrauchsgüterkauf-Sonderregeln fehlen. Fachliche Schwerpunkte und Reihenfolge der Rechte hier nach Lehrbuch-Schema (siehe P9): passt das so? */
  const yn = v => v === 'ja';
  const fallParams = s => ({ stoerung: s.stoerung, handel: yn(s.handel), mangelart: s.mangelart, ruege: yn(s.ruege), nacherf: s.nacherf, erheblich: yn(s.erheblich), verschulden: yn(s.verschulden), kalender: yn(s.kalender), mahnung: yn(s.mahnung), fix: yn(s.fix), nachfrist: yn(s.nachfrist) });
  function fallOut(s) {
    const r = C.kaeuferRechte(fallParams(s)); let h = '';
    if (r.blocked) h += note(r.blocked, 'bad');
    if (r.rights.length) h += `<div class="rdout ok"><span class="st">Rechte des Käufers</span><ul class="tl">${r.rights.map(k => `<li class="ok">✓ <b>${esc(C.RECHTE[k].n)}</b>: ${esc(C.RECHTE[k].d)}</li>`).join('')}</ul></div>`;
    else if (!r.blocked) h += note('Keine Rechte erkennbar.');
    r.notes.forEach(n => { h += note(n, 'warn'); });
    return h;
  }
  function renderFall() {
    const s = S.fall; let h = ueb() + `<div class="card pl"><h4>Was ist passiert?</h4>${segk('STÖRUNG', 'stoerung', [['mangel', 'mangelhafte Lieferung'], ['verzug', 'Lieferverzug']], s.stoerung)}`;
    if (s.stoerung === 'mangel') {
      h += segk('HANDELSKAUF (beide Seiten Kaufleute)', 'handel', YN, s.handel);
      if (s.handel === 'ja') h += segk('MANGEL', 'mangelart', [['offen', 'offen erkennbar'], ['versteckt', 'versteckt'], ['arglist', 'arglistig verschwiegen']], s.mangelart) + segk('RÜGE RECHTZEITIG', 'ruege', YN, s.ruege);
      h += segk('NACHERFÜLLUNG', 'nacherf', [['offen', 'noch offen'], ['gescheitert', 'gescheitert oder Nachfrist erfolglos']], s.nacherf) + segk('MANGEL ERHEBLICH', 'erheblich', YN, s.erheblich) + segk('VERKÄUFER HAT VERSCHULDET', 'verschulden', YN, s.verschulden);
    } else h += segk('LIEFERTERMIN NACH DEM KALENDER BESTIMMT', 'kalender', YN, s.kalender) + segk('FIXGESCHÄFT (Termin ist wesentlich)', 'fix', YN, s.fix) + segk('GEMAHNT', 'mahnung', YN, s.mahnung) + segk('ANGEMESSENE NACHFRIST ERFOLGLOS ABGELAUFEN', 'nachfrist', YN, s.nachfrist) + segk('LIEFERANT HAT VERSCHULDET', 'verschulden', YN, s.verschulden);
    $('#fallView').innerHTML = h + `<p class="hint2">Der Prüfer arbeitet mit einem vereinfachten Schema für Geschäfte zwischen Unternehmen.</p></div><div id="fallOut">${fallOut(s)}</div>`;
  }
  $('#fallView').addEventListener('click', e => { const b = e.target.closest('[data-sk]'); if (b) { S.fall[b.dataset.sk] = b.dataset.sv; lsSet('fall', S.fall); renderFall(); } });

  /* ============================================================ Fristen (Datumsrechner) */
  const MODES = [['verj', 'Verjährung'], ['gew', 'Gewährleistung'], ['ruege', 'Rüge'], ['verzug', 'Zahlungsverzug'], ['skonto', 'Zahlungsziel'], ['kuend', 'Kündigung'], ['add', 'Frist addieren']];
  function fristOut(p) {
    const d1 = PD(p.d1), d2 = PD(p.d2); let h = '';
    const need1 = what => dateMsg(what);
    switch (p.mode) {
      case 'verj': {
        if (!Number.isFinite(d1)) return need1('den Tag der Entstehung des Anspruchs');
        const y = C.ymd(d1).y, e = C.verjaehrungEnde(d1);
        h += box('Beginn der Verjährung', '', 'mit Ablauf des 31.12.' + y) + box('Ende nach drei Jahren', 'Jahresende ' + y + ' + 3 Jahre', C.fmtDateWd(e)) + endHint(e);
        return h + note('Die Verjährung beginnt erst mit dem Ende des Jahres der Entstehung, wenn der Gläubiger davon weiß. Hemmung und Neubeginn (z. B. durch Mahnbescheid) sind nicht eingerechnet.', 'warn');
      }
      case 'gew': {
        if (!Number.isFinite(d1)) return need1('den Tag der Ablieferung');
        const e = C.gewaehrleistungEnde(d1, 2);
        return box('Ablieferung', '', C.fmtDateWd(d1)) + box('Ende der Gewährleistung (2 Jahre)', 'Ablieferung + 2 Jahre', C.fmtDateWd(e)) + endHint(e) + note('Der Tag der Ablieferung zählt nicht mit. Die Frist endet mit Ablauf des Tages, der dem Ablieferungstag nach zwei Jahren entspricht.', 'warn');
      }
      case 'ruege': {
        if (!Number.isFinite(d1)) return need1('den Tag der Ablieferung bzw. der Entdeckung');
        const t = Number.isFinite(P(p.tage)) && P(p.tage) >= 0 ? P(p.tage) : C.RUEGE_TAGE, e = C.ruegeEnde(d1, t);
        h += box('Frist für die Rüge', 'Start ' + C.fmtDate(d1) + ' + ' + f(t, 0) + ' Tage', C.fmtDateWd(e));
        if (String(p.d2 || '').trim() !== '') { if (!Number.isFinite(d2)) return h + dateMsg('den Tag der Rüge'); const ok = C.ruegeRechtzeitig(d1, d2, t); h += box('Rüge am ' + C.fmtDate(d2), '', ok ? 'rechtzeitig: Rechte bleiben erhalten' : 'zu spät: Ware gilt als genehmigt', ok ? 'ok' : 'bad'); }
        return h + note('Im Handelskauf muss offen erkennbare Mängel "unverzüglich" gerügt werden, versteckte unverzüglich nach der Entdeckung. Das Gesetz nennt keine Tage; 7 Tage sind hier ein Übungswert.', 'warn');
      }
      /* PRUEFEN P26: Im Fristenrechner werden Zinsen und Verzugspauschale (40 €) auch zusammen als Gesamtforderung angezeigt, ohne Mahnkosten und ohne Prüfung, ob die Pauschale bei mehreren Teilforderungen nur einmal anfällt. Soll die Pauschale im Lab überhaupt erscheinen? */
      case 'verzug': {
        if (!Number.isFinite(d1)) return need1('den Tag des Rechnungszugangs');
        const e = C.verzugFristEnde(d1), b = C.verzugBeginn(d1);
        h += box('30-Tage-Frist endet', 'Zugang ' + C.fmtDate(d1) + ' + 30 Tage', C.fmtDateWd(e)) + box('Verzug (ohne Mahnung) beginnt', '', C.fmtDateWd(b));
        if (String(p.d2 || '').trim() !== '') {
          if (!Number.isFinite(d2)) return h + dateMsg('den Zahlungstag');
          const t = C.zinsTage(d1, d2), K = P(p.betrag), pr = P(p.satz);
          h += box('Zinstage', 'Tage vom Fristende bis ' + C.fmtDate(d2), f(t, 0) + ' Tage');
          if (Number.isFinite(K) && K >= 0 && Number.isFinite(pr) && pr >= 0) {
            const z = C.zins(K, pr, t); h += box('Verzugszinsen', 'K · p · t / 36.000 = ' + f(K, 2) + ' · ' + f(pr, 2) + ' · ' + f(t, 0) + ' / 36.000', fe(z));
            if (t > 0) h += box('Mit Verzugspauschale (Übungswert ' + fe(C.VERZ.pauschale) + ')', 'Betrag + Zinsen + Pauschale', fe(K + z + C.VERZ.pauschale));
          } else h += note('Gib Rechnungsbetrag und Zinssatz als Zahlen ein, dann siehst du die Zinsen.');
        }
        return h + note('Übungswert: Verzugszinssatz im Geschäftsverkehr = Basiszinssatz (hier ' + f(C.VERZ.basis, 1) + ' %) + ' + C.VERZ.pp + ' Prozentpunkte = ' + f(C.verzugssatz(false), 1) + ' %. Der Basiszinssatz ändert sich halbjährlich.', 'warn');
      }
      case 'skonto': {
        if (!Number.isFinite(d1)) return need1('das Rechnungsdatum');
        const sk = P(p.sk), zl = P(p.ziel);
        if (!(sk > 0) || !(zl > sk)) return note('Gib Skontofrist und Zahlungsziel in Tagen ein; das Zahlungsziel muss länger sein als die Skontofrist.');
        h += box('Skontofrist endet', 'Rechnungsdatum + ' + f(sk, 0) + ' Tage', C.fmtDateWd(C.skontoEnde(d1, sk))) + box('Zahlungsziel endet', 'Rechnungsdatum + ' + f(zl, 0) + ' Tage', C.fmtDateWd(C.skontoEnde(d1, zl)));
        if (String(p.d2 || '').trim() !== '') {
          if (!Number.isFinite(d2)) return h + dateMsg('den Zahlungstag');
          const a = C.zahlungsArt(d1, d2, sk, zl);
          if (!a) return h + note('Der Zahlungstag liegt vor dem Rechnungsdatum.');
          h += a === 'skonto' ? box('Zahlung am ' + C.fmtDate(d2), '', 'Skonto darf abgezogen werden', 'ok') : a === 'netto' ? box('Zahlung am ' + C.fmtDate(d2), '', 'voller Betrag, noch rechtzeitig', 'warn') : box('Zahlung am ' + C.fmtDate(d2), '', 'überfällig, Zahlungsziel überschritten', 'bad');
        }
        return h + note('Hier geht es nur um die Fristen. Wie sich Skonto auf die Kalkulation auswirkt, rechnest du im Kalkulations-Lab.', 'warn');
      }
      case 'kuend': {
        if (!Number.isFinite(d1)) return need1('den Tag des Zugangs der Kündigung');
        const j = P(p.jahre);
        if (p.probe !== 'ja' && !(j >= 0)) return note('Gib die Beschäftigungsdauer in Jahren als Zahl ein.');
        const e = C.kuendEnde(d1, j, p.probe === 'ja');
        h += p.probe === 'ja' ? box('Frist in der Probezeit', 'Zugang + 14 Tage', 'zwei Wochen') : (C.kuendMonate(j) ? box('Frist (Kündigung durch den Arbeitgeber)', 'nach ' + f(j, 0) + ' Jahren', C.kuendMonate(j) + ' Monat(e) zum Monatsende') : box('Frist (Grundfrist)', 'nach ' + f(j, 0) + ' Jahren', '4 Wochen zum 15. oder zum Monatsende'));
        return h + box('Ende des Arbeitsverhältnisses', 'Zugang ' + C.fmtDate(d1), C.fmtDateWd(e)) + note('Übungswerte nach § 622 BGB, nur für Kündigung durch den Arbeitgeber. Arbeits- oder Tarifvertrag kann andere Fristen vorsehen.', 'warn');
      }
      default: {
        if (!Number.isFinite(d1)) return need1('das Startdatum');
        const n = P(p.n); if (!Number.isFinite(n) || n < 0 || n > 100000) return note('Gib die Länge der Frist als Zahl ein.');
        const e = p.einheit === 'tage' ? C.addDays(d1, n) : p.einheit === 'wochen' ? C.addDays(d1, 7 * n) : p.einheit === 'monate' ? C.addMonths(d1, n) : C.addYears(d1, n);
        return box('Start', '', C.fmtDateWd(d1)) + box('Fristende', 'Start + ' + f(n, 0) + ' ' + ({ tage: 'Tage', wochen: 'Wochen', monate: 'Monate', jahre: 'Jahre' }[p.einheit]), C.fmtDateWd(e)) + endHint(e) + note('Der Starttag zählt nicht mit. Gibt es im Zielmonat den Tag nicht (z. B. 31.), endet die Frist am Monatsende.', 'warn');
      }
    }
  }
  function renderFrist() {
    const s = S.frist, m = s.mode;
    const lbl = { verj: 'Anspruch entstanden am', gew: 'Ablieferung am', ruege: 'Ablieferung bzw. Entdeckung am', verzug: 'Rechnung zugegangen am', skonto: 'Rechnungsdatum', kuend: 'Kündigung zugegangen am', add: 'Startdatum' }[m];
    let h = ueb() + `<div class="card pl"><h4>Fristenrechner</h4><div class="fbar"><div class="seg" style="flex-wrap:wrap">${MODES.map(o => `<button data-sk="mode" data-sv="${o[0]}" class="${m === o[0] ? 'on' : ''}">${esc(o[1])}</button>`).join('')}</div></div><div class="dsrow">${inp('d1', lbl, s.d1, '', 'TT.MM.JJJJ')}`;
    if (m === 'ruege') h += inp('tage', 'Frist für "unverzüglich"', s.tage, 'Tage') + inp('d2', 'Rüge abgesendet am (optional)', s.d2, '', 'TT.MM.JJJJ');
    if (m === 'verzug') h += inp('d2', 'Zahlung am (optional)', s.d2, '', 'TT.MM.JJJJ') + inp('betrag', 'Rechnungsbetrag', s.betrag, '€') + inp('satz', 'Verzugszinssatz', s.satz, '% p. a.');
    if (m === 'skonto') h += inp('sk', 'Skontofrist', s.sk, 'Tage') + inp('ziel', 'Zahlungsziel', s.ziel, 'Tage') + inp('d2', 'Zahlung am (optional)', s.d2, '', 'TT.MM.JJJJ');
    if (m === 'kuend') h += inp('jahre', 'Betriebszugehörigkeit', s.jahre, 'Jahre');
    if (m === 'add') h += inp('n', 'Dauer', s.n, '');
    h += '</div>';
    if (m === 'kuend') h += segk('IN DER PROBEZEIT', 'probe', YN, s.probe);
    if (m === 'add') h += segk('EINHEIT', 'einheit', [['tage', 'Tage'], ['wochen', 'Wochen'], ['monate', 'Monate'], ['jahre', 'Jahre']], s.einheit);
    $('#fristView').innerHTML = h + `<p class="hint2">Datum als TT.MM.JJJJ eingeben. Der Tag des auslösenden Ereignisses zählt nicht mit. Feiertage sind nicht eingebaut.</p></div><div id="fristOut"></div>`;
    updateFrist();
  }
  function updateFrist() { const e = $('#fristOut'); if (e) e.innerHTML = fristOut(S.frist); }
  bindTool($('#fristView'), 'frist', renderFrist, updateFrist);

  /* ============================================================ Belegketten-Ordner */
  function belegMix(force) {
    const n = C.ORDER[S.beleg.set].items.length; let o = [...Array(n).keys()];
    for (let t = 0; t < 20; t++) { o = C.shuffle(R0, o); if (o.some((v, i) => v !== i)) break; }
    S.bl = { order: o, res: null };
  }
  function renderBeleg() {
    const set = C.ORDER[S.beleg.set];
    if (!Array.isArray(S.bl.order) || S.bl.order.length !== set.items.length) belegMix();
    const o = S.bl.order, res = S.bl.res;
    let h = ueb() + `<div class="card pl"><h4>${esc(set.title)}</h4><div class="fbar"><div class="seg">${Object.keys(C.ORDER).map(k => `<button data-bs="${k}" class="${S.beleg.set === k ? 'on' : ''}">${esc(C.ORDER[k].title)}</button>`).join('')}</div></div><p class="hint2" style="margin:0 0 6px">${esc(set.hint)} Mit den Pfeilen verschiebst du einen Schritt.</p>`;
    h += o.map((idx, i) => `<div class="row" style="cursor:default"><span class="dot ${res ? (res[i] ? 'g' : 'p') : ''}">${res ? (res[i] ? '✓' : '✗') : i + 1}</span><div class="grow"><b>${esc(set.items[idx].n)}</b>${res && res[i] ? `<small>${esc(set.items[idx].wer)}: ${esc(set.items[idx].d)}</small>` : ''}</div><button class="ib" data-bm="${i}:-1" aria-label="nach oben"${i === 0 ? ' disabled' : ''}>▲</button><button class="ib" data-bm="${i}:1" aria-label="nach unten"${i === o.length - 1 ? ' disabled' : ''}>▼</button></div>`).join('');
    h += `<div class="btns"><button class="btn pri" data-ba="chk">✓ Prüfen</button><button class="btn" data-ba="mix">Neu mischen</button><button class="btn" data-ba="sol">Lösung zeigen</button></div>`;
    if (res) { const n = res.filter(Boolean).length; h += note(n === res.length ? '🎉 Alles richtig! Reihenfolge: ' + C.orderRight(S.beleg.set).join(' → ') : n + ' von ' + res.length + ' Schritten stehen richtig. Verschiebe die anderen und prüfe noch einmal.', n === res.length ? 'ok' : 'warn'); }
    $('#belegView').innerHTML = h + '</div>';
  }
  $('#belegView').addEventListener('click', e => {
    const bs = e.target.closest('[data-bs]'), bm = e.target.closest('[data-bm]'), ba = e.target.closest('[data-ba]');
    if (bs) { S.beleg.set = bs.dataset.bs; lsSet('beleg', S.beleg); belegMix(); renderBeleg(); return; }
    if (bm) { const [i, d] = bm.dataset.bm.split(':').map(Number), j = i + d, o = S.bl.order; if (j >= 0 && j < o.length) { [o[i], o[j]] = [o[j], o[i]]; S.bl.res = null; renderBeleg(); } return; }
    if (ba) {
      const a = ba.dataset.ba;
      if (a === 'mix') { belegMix(); renderBeleg(); } else if (a === 'sol') { S.bl.order = C.ORDER[S.beleg.set].items.map((x, i) => i); S.bl.res = S.bl.order.map(() => true); renderBeleg(); }
      else { S.bl.res = C.orderCheck(S.beleg.set, S.bl.order); if (S.bl.res.every(Boolean)) ding(); else sad(); renderBeleg(); }
    }
  });
  const belegStatic = key => { const set = C.ORDER[key]; return `<div class="tw"><table class="tt"><tr><th class="n">Nr.</th><th>Schritt</th><th>erstellt von</th></tr>${set.items.map((x, i) => `<tr><td class="n">${i + 1}</td><td><b>${esc(x.n)}</b><br><span class="hint2">${esc(x.d)}</span></td><td>${esc(x.wer)}</td></tr>`).join('')}</table></div>`; };

  /* ============================================================ Brutto-Netto-Rechner */
  /* PRUEFEN P27: Der Arbeitgeberanteil wird im Brutto-Netto-Rechner nur erklärt, nicht berechnet (Vorgabe: nur erklären). Reicht die Erklärung (zahlt der Arbeitgeber zusätzlich, nicht vom Brutto abgezogen, erhöht Personalkosten)? Die Rechnung mit Prozentsätzen ist ein Übungsmodell ohne Steuerklassen. */
  function lohnOut(s) {
    const b = P(s.brutto), L = { lst: P(s.lst), rv: P(s.rv), kv: P(s.kv), pv: P(s.pv), av: P(s.av) };
    if (!(b >= 0)) return note('Gib ein Bruttogehalt als Zahl ein (zum Beispiel 2800).');
    if (!Object.values(L).every(v => Number.isFinite(v) && v >= 0 && v <= 60)) return note('Alle Prozentsätze müssen Zahlen zwischen 0 und 60 sein.');
    const a = C.abrechnung(b, L);
    let h = `<div class="tw"><table class="tt"><tr><th></th><th class="n">Satz</th><th class="n">Betrag</th></tr>
      <tr><td><b>Bruttogehalt</b></td><td class="n"></td><td class="n"><b>${esc(fe(a.brutto))}</b></td></tr>
      <tr><td>− Lohnsteuer</td><td class="n">${esc(f(L.lst, 2))} %</td><td class="n">${esc(fe(a.lst))}</td></tr>
      <tr><td>− Rentenversicherung</td><td class="n">${esc(f(L.rv, 2))} %</td><td class="n">${esc(fe(a.rv))}</td></tr>
      <tr><td>− Krankenversicherung</td><td class="n">${esc(f(L.kv, 2))} %</td><td class="n">${esc(fe(a.kv))}</td></tr>
      <tr><td>− Pflegeversicherung</td><td class="n">${esc(f(L.pv, 2))} %</td><td class="n">${esc(fe(a.pv))}</td></tr>
      <tr><td>− Arbeitslosenversicherung</td><td class="n">${esc(f(L.av, 2))} %</td><td class="n">${esc(fe(a.av))}</td></tr>
      <tr><td><b>Summe Abzüge</b></td><td class="n">${esc(f(L.lst + L.rv + L.kv + L.pv + L.av, 2))} %</td><td class="n"><b>${esc(fe(a.summe))}</b></td></tr>
      <tr><td><b>Nettogehalt (Auszahlung)</b></td><td class="n"></td><td class="n"><b>${esc(fe(a.netto))}</b></td></tr></table></div>`;
    h += box('Davon Sozialversicherung (Arbeitnehmeranteil)', '', fe(a.sv));
    return h + note('Arbeitgeberanteil: Zusätzlich zum Bruttogehalt zahlt der Arbeitgeber einen eigenen Anteil zur Sozialversicherung. Er wird dir nicht abgezogen und steht nicht in dieser Tabelle, er erhöht aber die Kosten des Betriebs. Die Buchung findest du im Buchführungs-Lab.', 'warn');
  }
  function renderLohn() {
    const s = S.lohn;
    $('#lohnView').innerHTML = ueb() + `<div class="card pl"><h4>Vom Brutto zum Netto (Übungssätze)</h4><div class="dsrow">${inp('brutto', 'Bruttogehalt', s.brutto, '€')}${inp('lst', 'Lohnsteuer pauschal', s.lst, '%')}</div>
      <div class="dsrow">${inp('rv', 'Rentenversicherung', s.rv, '%')}${inp('kv', 'Krankenversicherung', s.kv, '%')}${inp('pv', 'Pflegeversicherung', s.pv, '%')}${inp('av', 'Arbeitslosenversicherung', s.av, '%')}</div>
      <div class="btns"><button class="btn" data-lr="1">Übungssätze zurücksetzen</button></div>
      <p class="hint2">Die echte Lohnsteuer hängt von Steuerklasse und Einkommen ab und wird nach Tabelle berechnet. Hier rechnest du vereinfacht mit einem festen Prozentsatz.</p></div><div id="lohnOut"></div>`;
    updateLohn();
  }
  function updateLohn() { const e = $('#lohnOut'); if (e) e.innerHTML = lohnOut(S.lohn); }
  bindTool($('#lohnView'), 'lohn', renderLohn, updateLohn);
  $('#lohnView').addEventListener('click', e => { if (e.target.closest('[data-lr]')) { Object.assign(S.lohn, { lst: '15', rv: '9,3', kv: '7,3', pv: '1,8', av: '1,3' }); lsSet('lohn', S.lohn); renderLohn(); } });

  /* ============================================================ Begriffe (Zuordnungsübung) */
  function renderMatch(key) {
    const set = D.sets[key]; let h = `<div class="card pl"><h4>Zuordnungsübung: ${esc(set.title)}</h4><div id="mq_${key}"></div></div><div class="dt">`, last = '';
    set.items.forEach(o => {
      if (o.g !== last) { if (last) h += '</div>'; last = o.g; h += `<div class="gh">${esc(o.g)}</div><div>`; }
      h += `<details><summary>${esc(o.n)}</summary><div class="hb2"><p>${esc(o.d)}</p>${o.pts.length ? '<ul>' + o.pts.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : ''}</div></details>`;
    });
    $('#' + key + 'View').innerHTML = h + '</div></div>';
    if (S.mq[key].i < 0) newMQ(key); else renderMQ(key);
  }
  function newMQ(key) { S.mq[key] = { i: Math.floor(R0() * D.sets[key].items.length), sel: -1 }; renderMQ(key); }
  function renderMQ(key) {
    const set = D.sets[key], q = S.mq[key], o = set.items[q.i], pool = set.items.filter(x => x.g === o.g), opts = C.shuffle(C.rng(key + q.i + ':' + S.mt[key].n), pool), done = q.sel >= 0;
    const el = $('#mq_' + key); if (!el) return;
    el.innerHTML = `<p style="margin-top:0">${esc(set.prompt)} <b>${esc(o.d)}</b></p><div class="opts">${opts.map(x => `<button data-on="${esc(x.n)}" class="${done ? (x === o ? 'ok' : set.items[q.sel] === x ? 'bad' : '') : ''}" ${done ? 'disabled' : ''}>${esc(x.n)}</button>`).join('')}</div>
      <p class="hint2">Richtig: <b>${S.mt[key].ok}</b> von <b>${S.mt[key].n}</b></p>${done ? '<div class="btns"><button class="btn pri" data-on="__next">Nächste Frage</button></div>' : ''}`;
  }
  MATCH.forEach(key => {
    $('#' + key + 'View').addEventListener('click', e => {
      const b = e.target.closest('[data-on]'); if (!b) return;
      if (b.dataset.on === '__next') { newMQ(key); return; }
      const set = D.sets[key], i = set.items.findIndex(x => x.n === b.dataset.on), right = i === S.mq[key].i;
      S.mq[key].sel = i; S.mt[key].n++; if (right) { S.mt[key].ok++; ding(); } else sad(); lsSet('mt', S.mt); renderMQ(key);
    });
  });

  /* ============================================================ Aufgaben und Trainer */
  const done = () => lsGet('done', {});
  const exam = () => lsGet('exam', '0') === '1';
  function pctFor(id) { if (!exam()) return 100; return 100 - 25 * Math.min(2, lsGet('ctipps', {})[id] || 0); }
  function markSolved(id, pct) {
    const p = lsGet('prog', {}); if ((p[id] || 0) < pct) p[id] = pct; lsSet('prog', p);
    const d = done(); d[id] = true; lsSet('done', d); updateBadge(); updatePal();
  }
  function updateBadge() { const b = $('#tkBd'); if (b) b.textContent = Object.keys(done()).filter(k => TASKS.some(t => t.id === k)).length + '/' + TASKS.length; }
  const curTask = () => S.task && TASKS.find(t => t.id === S.task);
  const solText = q => (q.ask.type === 'choice' ? q.ask.choices[q.ask.correct] : f(q.value, 2) + ' ' + q.ask.unit);
  function qBody(q, a, r, pre) {
    if (q.ask.type === 'choice') return `<div class="opts">${q.ask.choices.map((c, i) => `<button data-tc="${i}" ${r && (r.ok || pre === 'rt') ? 'disabled' : ''} class="${r && i === q.ask.correct && (r.ok || pre === 'rt') ? 'ok' : a.c === i ? (r && !r.ok ? 'bad' : 'on') : ''}">${esc(c)}</button>`).join('')}</div>`;
    return `<label class="f"><span>${esc(q.ask.label)} (${esc(q.ask.unit)})</span><div class="qin"><input data-in="1" inputmode="decimal" autocomplete="off" value="${esc(a.v || '')}" ${r && (r.ok || pre === 'rt') ? 'disabled' : ''}><span class="u">${esc(q.ask.unit)}</span></div></label>`;
  }
  function evalQ(q, a) {
    if (q.ask.type === 'choice') { if (a.c == null) { toast('Wähle zuerst eine Antwort.'); return null; } return { ok: a.c === q.ask.correct, given: q.ask.choices[a.c] }; }
    const v = P(a.v); if (!Number.isFinite(v)) { toast('Bitte gib eine Zahl ein (mit Komma oder Punkt).'); return null; }
    return { ok: Math.abs(v - q.value) <= q.tol + 1e-9, given: f(v, 2) + ' ' + q.ask.unit };
  }
  const resBlock = (q, r, showExpl) => `<ul class="tl"><li class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓ Richtig: ' + esc(r.given) : '✗ Deine Antwort „' + esc(r.given) + '“ stimmt nicht.'}</li>${q.ask.type === 'num' && q.tol > 0.011 ? `<li>ℹ Erlaubte Abweichung: ±${esc(f(q.tol, 2))} ${esc(q.ask.unit)} (wegen Rundung).</li>` : ''}</ul>` +
    (showExpl ? `<div class="rdout ${r.ok ? 'ok' : 'bad'}"><b>Lösung:</b> ${esc(solText(q))}<br><br><b>Lösungsweg:</b> ${esc(q.expl)}</div>` : '<div class="rdout bad">🎓 Prüfmodus: Den Lösungsweg gibt es erst, wenn die Aufgabe richtig gelöst ist. Nutze einen Tipp oder versuche es noch einmal.</div>');

  function renderTasks(top) {
    const V = $('#taskView'), d = done(), prog = lsGet('prog', {}), t = curTask(), n100 = TASKS.filter(x => d[x.id]).length; let h = '';
    if (t) {
      const q = S.tq, r = S.tRes && S.tRes.id === t.id ? S.tRes : null, a = S.tAns[t.id] || {};
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv">${dots(t.level)}</div><p style="margin:8px 0">${esc(q.text)}</p>${qBody(q, a, r, 'tk')}`;
      h += `<div class="btns"><button class="btn pri" data-ta="chk"${r && r.ok ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" data-ta="hint">💡 Tipp</button><button class="btn" data-ta="close">Schließen</button></div>`;
      if (exam()) h += '<p class="hint2" style="color:var(--warn)">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>';
      if (r) { h += resBlock(q, r, r.ok || !exam()); if (r.ok) h += `<div class="btns"><button class="btn pri" data-ta="next">Nächste Aufgabe</button></div>`; }
      h += '</div>';
    }
    h += `<p class="hint2" style="margin:4px 0 0">${n100} von ${TASKS.length} Aufgaben gelöst. ${exam() ? '🎓 Prüfmodus ist an.' : 'Tipp: Im Prüfmodus (🎓 oben) zählen Tipps als Abzug.'}</p><p class="hint2" style="margin:4px 0 0">⚠ ${esc(UEB)}</p>`;
    let last = '';
    TASKS.forEach(x => { if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; } const p = prog[x.id]; h += `<button class="row" data-t="${esc(x.id)}"><span class="dot ${d[x.id] ? 'g' : ''}">${d[x.id] ? '✓' : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${dots(x.level)}</span>${p != null && p < 100 ? ' · bisher ' + p + ' %' : ''}</small></div></button>`; });
    V.innerHTML = h; if (top !== false) $('#pgTasks').scrollTop = 0;
  }
  function checkTask(t) {
    const a = S.tAns[t.id] || {}, e = evalQ(S.tq, a); if (!e) return; const pct = e.ok ? pctFor(t.id) : 0;
    S.tRes = { id: t.id, ok: e.ok, given: e.given, pct };
    if (e.ok) { markSolved(t.id, pct); const F = fx(); if (F && F.pass) try { F.pass(pct); } catch (er) {} else ding(); toast(exam() && pct < 100 ? pct + ' % (Tipps abgezogen)' : '🎉 Geschafft!'); } else { sad(); toast('Noch nicht richtig. Lies den Lösungsweg und versuche es noch einmal.'); }
    renderTasks(false);
  }
  function hintFor(q, id) {
    const h = lsGet('hints', {}), n = Math.min(2, (h[id] || 0) + 1), ex = exam(); h[id] = Math.max(h[id] || 0, n); lsSet('hints', h);
    if (ex) { const c = lsGet('ctipps', {}); c[id] = Math.max(c[id] || 0, n); lsSet('ctipps', c); }
    sheet('Tipp, Stufe ' + n + ' von 2', b => {
      let x = `<p style="margin-top:0"><b>Stufe 1:</b> ${esc(q.tips[0])}</p>`; if (n >= 2) x += `<p><b>Stufe 2:</b> ${esc(q.tips[1])}</p>`;
      x += n >= 2 ? '<p class="hint2">Mehr Tipps gibt es nicht. Den Lösungsweg siehst du nach dem Prüfen.</p>' : '<p class="hint2">Noch mehr Hilfe? Tippe noch einmal auf „Tipp“.</p>';
      x += ex ? '<p class="hint2" style="color:var(--warn)">Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>' : '<p class="hint2">Beim normalen Üben kosten Tipps nichts. Im Prüfmodus (🎓) zählen sie.</p>';
      b.innerHTML = x;
    });
  }
  function startTask(id) {
    const t = TASKS.find(x => x.id === id); if (!t) return;
    S.task = id; S.tq = D.makeTask(t); S.tAns = {}; S.tRes = null;
    const h = lsGet('hints', {}), c = lsGet('ctipps', {}); if (h[id]) { delete h[id]; lsSet('hints', h); } if (c[id]) { delete c[id]; lsSet('ctipps', c); }
    renderTasks();
  }
  const tv = $('#taskView');
  tv.addEventListener('input', e => { const t = curTask(); if (t && e.target.dataset.in) (S.tAns[t.id] = S.tAns[t.id] || {}).v = e.target.value; });
  tv.addEventListener('keydown', e => { const t = curTask(); if (t && e.key === 'Enter' && e.target.dataset.in) { e.preventDefault(); checkTask(t); } });
  tv.addEventListener('click', e => {
    const t = curTask(), tc = e.target.closest('[data-tc]'), ta = e.target.closest('[data-ta]'), row = e.target.closest('.row[data-t]');
    if (tc && t) { (S.tAns[t.id] = S.tAns[t.id] || {}).c = +tc.dataset.tc; if (S.tRes && !S.tRes.ok) S.tRes = null; renderTasks(false); return; }
    if (ta && t) { const a = ta.dataset.ta; if (a === 'chk') checkTask(t); else if (a === 'hint') hintFor(S.tq, t.id); else if (a === 'close') { S.task = null; S.tRes = null; renderTasks(); } else if (a === 'next') { const i = TASKS.findIndex(x => x.id === t.id), nx = TASKS.slice(i + 1).find(x => !done()[x.id]) || TASKS[(i + 1) % TASKS.length]; startTask(nx.id); } return; }
    if (row) startTask(row.dataset.t);
  });

  /* Zufalls-Trainer (Tipps kosten hier nie etwas) */
  function newTrainer() { const T = S.tr; T.q = D.randomQ(R0, T.level); T.ans = {}; T.res = null; renderTrainer(); }
  function renderTrainer() {
    const T = S.tr; if (!T.q) { newTrainer(); return; }
    const q = T.q;
    $('#rtView').innerHTML = `<div class="stats"><div class="bx"><b>${S.rt.n}</b>Fragen</div><div class="bx"><b>${S.rt.ok}</b>richtig</div><div class="bx"><b>${S.rt.streak}</b>Serie</div><div class="bx"><b>${S.rt.best}</b>Beste Serie</div></div>
      <div class="fbar"><span class="lbl" style="font-size:12px;color:var(--mute)">STUFE</span><div class="seg">${[[0, 'Alle'], [1, '1'], [2, '2'], [3, '3']].map(l => `<button data-lv="${l[0]}" class="${T.level === l[0] ? 'on' : ''}">${l[1]}</button>`).join('')}</div></div>
      <div class="card pl"><h4>${esc(q.cat)} · <span class="lv">${dots(q.level)}</span></h4><div class="big">${esc(q.title)}</div><p style="margin:8px 0">${esc(q.text)}</p>${qBody(q, T.ans, T.res, 'rt')}
      <div class="btns"><button class="btn pri" data-ra="chk" ${T.res ? 'disabled' : ''}>✓ Prüfen</button><button class="btn" data-ra="hint" ${T.res ? 'disabled' : ''}>💡 Tipp</button><button class="btn" data-ra="next">${T.res ? 'Nächste Frage' : 'Überspringen'}</button></div>
      ${T.res ? resBlock(q, T.res, true) : ''}</div>`;
  }
  const rv = $('#rtView');
  rv.addEventListener('input', e => { if (e.target.dataset.in) S.tr.ans.v = e.target.value; });
  rv.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.in) { e.preventDefault(); trainerCheck(); } });
  rv.addEventListener('click', e => {
    const T = S.tr, tc = e.target.closest('[data-tc]'), ra = e.target.closest('[data-ra]'), lv = e.target.closest('[data-lv]');
    if (lv) { T.level = +lv.dataset.lv; newTrainer(); return; }
    if (tc && !T.res) { T.ans.c = +tc.dataset.tc; renderTrainer(); return; }
    if (ra) { const a = ra.dataset.ra; if (a === 'chk') trainerCheck(); else if (a === 'hint') hintFor(T.q, 'rt'); else { if (!T.res && S.rt.streak) { S.rt.streak = 0; lsSet('rt', S.rt); } newTrainer(); updatePal(); } }
  });
  function trainerCheck() {
    const T = S.tr; if (T.res) return; const e = evalQ(T.q, T.ans); if (!e) return;
    T.res = { ok: e.ok, given: e.given }; S.rt.n++; if (e.ok) { S.rt.ok++; S.rt.streak++; S.rt.best = Math.max(S.rt.best, S.rt.streak); ding(); } else { S.rt.streak = 0; sad(); }
    lsSet('rt', S.rt); renderTrainer(); updatePal();
  }

  /* ============================================================ Beispiele */
  function exBody(e) {
    const p = e.p;
    if (e.tab === 'vert') return vertOut(p);
    if (e.tab === 'fall') return fallOut(p);
    if (e.tab === 'frist') return fristOut(Object.assign({ d2: '', n: '', einheit: 'tage', tage: '7', betrag: '', satz: '', sk: '10', ziel: '30', jahre: '', probe: 'nein' }, p));
    if (e.tab === 'beleg') return belegStatic(p.set);
    return lohnOut({ brutto: p.brutto, lst: '15', rv: '9,3', kv: '7,3', pv: '1,8', av: '1,3' });
  }
  function renderBsp() {
    $('#bspView').innerHTML = `<p class="hint2" style="margin:0 0 8px">Fertig durchgerechnete Beispiele (Übungswerte, keine Rechtsberatung). Mit „In den Rechner laden“ öffnest du die Zahlen im passenden Reiter und kannst sie verändern.</p>` + D.examples.map(e => `<div class="card pl" id="ex_${e.id}"><h4>Beispiel</h4><div class="big">${esc(e.title)}</div><p style="margin:4px 0 8px">${esc(e.text)}</p>${exBody(e)}<div class="btns"><button class="btn pri" data-ex="${e.id}">In den Rechner laden</button></div></div>`).join('');
  }
  $('#bspView').addEventListener('click', e => {
    const b = e.target.closest('[data-ex]'); if (!b) return; const x = D.examples.find(z => z.id === b.dataset.ex), p = x.p;
    if (x.tab === 'vert') { S.vert = Object.assign({}, S.vert, p); lsSet('vert', S.vert); }
    else if (x.tab === 'fall') { S.fall = Object.assign({}, S.fall, p); lsSet('fall', S.fall); }
    else if (x.tab === 'frist') { S.frist = Object.assign({}, S.frist, p); lsSet('frist', S.frist); }
    else if (x.tab === 'beleg') { S.beleg.set = p.set; lsSet('beleg', S.beleg); belegMix(); }
    else { S.lohn = Object.assign({}, S.lohn, { brutto: p.brutto }); lsSet('lohn', S.lohn); }
    setTab(x.tab); toast('Beispiel geladen: ' + x.title);
  });

  /* ============================================================ Hilfe */
  function renderHelp() {
    const sec = (t, b, open) => `<details${open ? ' open' : ''}><summary>${t}</summary><div class="hb2">${b}</div></details>`;
    $('#helpView').innerHTML =
      `<div class="rdout warn">⚠ ${esc(UEB)}</div>` +
      sec('Zustandekommen des Kaufvertrags', `<p>Ein Kaufvertrag entsteht durch zwei übereinstimmende Willenserklärungen: <b>Antrag</b> und <b>Annahme</b>.</p><table><tr><th>Beleg</th><th>Wer</th><th>Rechtlich</th></tr><tr><td>Anfrage</td><td>Käufer</td><td>unverbindlich</td></tr><tr><td>Angebot (bindend)</td><td>Lieferant</td><td>Antrag, gebunden bis zum Fristende</td></tr><tr><td>Angebot (freibleibend)</td><td>Lieferant</td><td>nur Aufforderung zur Bestellung</td></tr><tr><td>Bestellung</td><td>Käufer</td><td>Annahme (bei bindendem, gültigem Angebot) oder Antrag</td></tr><tr><td>Auftragsbestätigung</td><td>Lieferant</td><td>Annahme; weicht sie ab, ist sie ein neuer Antrag</td></tr></table>`, true) +
      sec('Vertragsarten (nur abgrenzen)', `<table><tr><th>Vertrag</th><th>Geschuldet</th></tr><tr><td>Kaufvertrag</td><td>Ware und Eigentum gegen Preis</td></tr><tr><td>Werkvertrag</td><td>ein Erfolg (fertiges Werk)</td></tr><tr><td>Dienstvertrag</td><td>die Tätigkeit (auch Arbeitsvertrag)</td></tr><tr><td>Mietvertrag</td><td>Gebrauch einer Sache auf Zeit gegen Miete</td></tr></table>`) +
      sec('Vertragsstörungen und Rechte des Käufers', `<p><b>Lieferverzug:</b> Der Lieferant liefert nicht rechtzeitig. Verzug tritt ein nach Fälligkeit und Mahnung, ohne Mahnung bei Kalendertermin oder ernsthafter Weigerung, und braucht Verschulden. Rechte: auf Lieferung bestehen, Verzugsschaden; nach angemessener Nachfrist (beim Fixgeschäft sofort) Rücktritt und Schadensersatz statt der Leistung.</p><p><b>Mangelhafte Lieferung:</b> Mangel in Art, Güte oder Menge. Im Handelskauf zuerst <b>rügen</b>. Dann Nacherfüllung (Nachbesserung oder Ersatzlieferung); wenn sie scheitert: Rücktritt (erheblicher Mangel), Minderung, Schadensersatz (bei Verschulden).</p><p><b>Zahlungsverzug:</b> Verzug spätestens 30 Tage nach Zugang der Rechnung, ohne Mahnung. Rechte des Lieferanten: Verzugszinsen und Pauschale, Mahnverfahren. Probiere es im Fall-Prüfer und im Fristenrechner aus.</p>`) +
      sec('Fristen', `<span class="eq">Regelmäßige Verjährung: 3 Jahre, beginnt mit Jahresende, Ende am 31.12. des dritten Folgejahres</span><span class="eq">Gewährleistung (neue Sache): 2 Jahre ab Ablieferung</span><span class="eq">Rüge im Handelskauf: unverzüglich (Übungswert 7 Tage)</span><span class="eq">Zahlungsverzug ohne Mahnung: 30 Tage nach Zugang der Rechnung</span><p>Der Tag des Ereignisses zählt nicht mit, die Frist endet mit Ablauf des Tages gleicher Zahl. Fällt das Ende auf Samstag, Sonntag oder einen Feiertag, endet sie am nächsten Werktag.</p>`) +
      sec('Eigentumsvorbehalt', `<p><b>Einfach:</b> Die Ware bleibt bis zur vollständigen Zahlung Eigentum des Verkäufers. <b>Verlängert:</b> Beim Weiterverkauf wird die Forderung gegen den Endkunden im Voraus abgetreten. <b>Erweitert:</b> Das Eigentum bleibt, bis alle Forderungen aus der Geschäftsbeziehung bezahlt sind. Bei Verarbeitung hilft die Verarbeitungsklausel.</p>`) +
      sec('Zahlungsbedingungen und Mahnwesen', `<table><tr><th>Bedingung</th><th>Bedeutung</th></tr><tr><td>Vorauskasse</td><td>Zahlung vor Lieferung</td></tr><tr><td>netto Kasse</td><td>sofort, ohne Abzug</td></tr><tr><td>Zahlungsziel</td><td>späteste Zahlungsfrist</td></tr><tr><td>Skonto</td><td>Nachlass bei Zahlung innerhalb der kürzeren Skontofrist</td></tr></table><span class="eq">Zinsen = Kapital · Zinssatz · Tage / (100 · 360)</span><p>Übungswerte: Basiszinssatz ${esc(f(C.VERZ.basis, 1))} % + ${C.VERZ.pp} Prozentpunkte = ${esc(f(C.verzugssatz(false), 1))} % Verzugszins, Pauschale ${esc(fe(C.VERZ.pauschale))}. Mahnstufen: Zahlungserinnerung, 1. Mahnung, 2. Mahnung mit Frist, letzte Mahnung, Mahnbescheid, Vollstreckungsbescheid. Skonto in der Kalkulation: Kalkulations-Lab.</p>`) +
      sec('Belegkette und Rechnung', belegStatic('beleg') + `<p><b>Pflichtangaben der Rechnung (Übung):</b></p><ul>${C.PFLICHT.map(x => '<li>' + esc(x) + '</li>').join('')}</ul><p class="hint2">Buchung der Rechnungen: Buchführungs-Lab.</p>`) +
      sec('Lohn und Gehalt (vereinfacht)', `<span class="eq">Netto = Brutto − Lohnsteuer − Sozialversicherung (Arbeitnehmeranteil)</span><p>Übungssätze: Lohnsteuer ${C.LOHN.lst} %, Rentenversicherung ${esc(f(C.LOHN.rv, 1))} %, Krankenversicherung ${esc(f(C.LOHN.kv, 1))} %, Pflegeversicherung ${esc(f(C.LOHN.pv, 1))} %, Arbeitslosenversicherung ${esc(f(C.LOHN.av, 1))} % (zusammen ${esc(f(C.svSatz(), 1))} %). Der <b>Arbeitgeberanteil</b> zur Sozialversicherung kommt zusätzlich und wird nicht vom Brutto abgezogen. Überstundenzuschlag: Übungswert ${C.LOHN.zuschlag} %.</p>`) +
      sec('Arbeitsvertrag: Probezeit und Kündigung', `<p>Probezeit im Arbeitsvertrag höchstens 6 Monate, in der Ausbildung 1 bis 4 Monate. Kündigung in der Ausbildungs-Probezeit ohne Frist. Arbeitgeber-Kündigungsfristen (Übungswerte): Grundfrist 4 Wochen zum 15. oder Monatsende, ab 2 Jahren 1 Monat, 5 Jahren 2 Monate, 8 Jahren 3 Monate, 10 Jahren 4 Monate, 12 Jahren 5 Monate, 15 Jahren 6 Monate, 20 Jahren 7 Monate, jeweils zum Monatsende.</p>`) +
      `<p class="hint2">Zahlen und Begriffe sind Lehrbuch- und Übungswerte; Unsicheres ist im Quelltext mit PRUEFEN markiert.</p>`;
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'vert'; S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    ({ vert: renderVert, fall: renderFall, frist: renderFrist, beleg: renderBeleg, lohn: renderLohn, beg: () => renderMatch('beg'), tasks: renderTasks, rt: renderTrainer, bsp: renderBsp, help: renderHelp })[t]();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'Auftrag-und-Recht-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = 'Auftrag-und-Recht-Lab: ' + T[2];
  }
  function setExam(on) { lsSet('exam', on ? '1' : '0'); palSig = ''; updatePal(); toast(on ? '🎓 Prüfmodus an: Tipps kosten 25 % je Stufe.' : 'Prüfmodus aus: Tipps kosten nichts.'); if (S.tab === 'tasks') renderTasks(false); }
  let palSig = '';
  function updatePal() {
    const F = !!fx(), fxOn = F && !fx().isMuted(), n = Object.keys(done()).filter(k => TASKS.some(t => t.id === k)).length, sig = [F, fxOn, exam(), n, S.rt.streak, S.rt.best].join('|'); if (sig === palSig) return; palSig = sig;
    $('#pal').innerHTML = `${F ? `<button class="chip ${fxOn ? 'on' : ''}" data-a="fx" aria-pressed="${fxOn}" title="Effekte und Ton">${fxOn ? '🎉' : '🔇'} Effekte</button>` : ''}<button class="chip ${exam() ? 'on' : ''}" data-a="exam" aria-pressed="${exam()}" title="Prüfmodus: Tipps zählen als Abzug">🎓 Prüfmodus</button><button class="chip" data-a="rand" title="Zufällige Frage im Trainer">🎲 Zufallsaufgabe</button>
      <span id="stat">Aufgaben gelöst <b>${n}/${TASKS.length}</b> · Serie <b>${S.rt.streak}</b> · Beste Serie <b>${S.rt.best}</b></span>`;
    $('#bExam').classList.toggle('on', exam()); $('#bExam').setAttribute('aria-pressed', exam());
  }
  $('#pal').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.a === 'fx') { const F = fx(); if (F) { F.setMuted(!F.isMuted()); palSig = ''; updatePal(); if (!F.isMuted()) ding(); } }
    else if (b.dataset.a === 'exam') setExam(!exam());
    else if (b.dataset.a === 'rand') { setTab('rt'); newTrainer(); }
  });
  $('#bTasks').onclick = () => setTab('tasks'); $('#bHelp').onclick = () => setTab('help'); $('#bExam').onclick = () => setExam(!exam());
  $('#title').onclick = () => setTab('vert');
  $('#bMenu').onclick = () => {
    const rows = [['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung und Tipps'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Aufgaben mit Serien-Zähler'], ['bsp', 'Beispiele', 'Fertig durchgerechnete Beispiele zum Laden'], ['help', 'Hilfe und Formeln', 'Vertrag, Störungen, Fristen, Belege, Lohn'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben und Trainer-Serie auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
    sheet('Menü', (b, close) => {
      b.innerHTML = rows.map(r => `<button class="row" data-m="${r[0]}"><div class="grow"><b>${esc(r[1])}</b><small>${esc(r[2])}</small></div></button>`).join('');
      b.addEventListener('click', e => { const r = e.target.closest('.row'); if (!r) return; close(); const m = r.dataset.m; if (m === 'home') location.href = 'index.html'; else if (m === 'exam') setExam(!exam()); else if (m === 'reset') resetAll(); else setTab(m); });
    });
  };
  function resetAll() {
    sheet('Fortschritt zurücksetzen?', (b, close) => {
      b.innerHTML = '<p style="margin-top:0">Alle gelösten Aufgaben, Tipps und die Trainer-Serie dieses Labs werden auf diesem Gerät gelöscht. Das kann nicht rückgängig gemacht werden.</p><div class="btns"><button class="btn" data-x="no">Abbrechen</button><button class="btn danger" data-x="yes">Löschen</button></div>';
      b.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (!x) return; if (x.dataset.x === 'yes') { ['done', 'prog', 'hints', 'ctipps', 'rt', 'mt'].forEach(k => { try { localStorage.removeItem(LS + k); } catch (er) {} }); S.rt = { n: 0, ok: 0, streak: 0, best: 0 }; MATCH.forEach(k => { S.mt[k] = { n: 0, ok: 0 }; }); S.task = null; S.tRes = null; palSig = ''; updatePal(); updateBadge(); if (S.tab === 'tasks') renderTasks(); toast('Fortschritt gelöscht'); } close(); });
    });
  }

  /* Schnittstelle für Karriere/Lernpfad */
  root.REC_LAB = { id: 'rec', title: 'Auftrag-und-Recht-Lab', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.REC_TASKS, setTab };

  buildTabs(); updatePal(); setTab(TABS.some(x => x[0] === S.tab) ? S.tab : 'vert');
  /* Aufruf ?aufgabe=rec1 (Startseite, Lernhefte) öffnet die Aufgabe, ?bsp die Beispiele (?bsp=vert1 springt zu einem Beispiel) */
  try {
    const qp = new URLSearchParams(location.search), qa = qp.get('aufgabe');
    if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); }
    else if (qp.has('bsp')) { setTab('bsp'); const el = $('#ex_' + (qp.get('bsp') || '').replace(/[^a-z0-9_]/gi, '')); if (el) el.scrollIntoView(); }
  } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
