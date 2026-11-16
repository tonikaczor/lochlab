'use strict';
/* Tonfunk Lab: Prüfungs-Countdown (Coach, Startseite, Mein Stand).
   Die Nutzerin oder der Nutzer setzt ein Datum (Abschlussprüfung Teil 1 oder Teil 2, bei den Wegen Studium/Technik eine freie Klausur oder einen Abschluss).
   Daraus entstehen "noch X Tage", ein Wochenplan (bis zu 8 Wochen, je Woche 2 bis 3 Themen oder Lerneinheiten aus den schwachen Stellen, dazu Karten und Probeprüfung)
   und ein Vorschlag "heute dran". Alles wird aus den vorhandenen Daten gerechnet (Modell aus meinstand-core.js: Ampel der Lernfelder/Module und Prüfungsthemen, fällige Karten,
   Wiederholen). Es wird NICHTS gespeichert außer dem Datum selbst. Keine Benachrichtigungen, nichts verlässt das Gerät.

   Speicher: lm4.countdown = { v: 1, art: 'ap1' | 'ap2' | 'frei', datum: 'JJJJ-MM-TT', titel: 'Name bei frei (höchstens 40 Zeichen)', t: ms Zeitpunkt des Setzens }
   Der Schlüssel wird beim Laden dieser Datei in Lernstand.PROGRESS eingetragen (wie lm4.pkarten und lm4.e10), damit Lernstand-Code und -Datei ihn mitnehmen; die Datei-Sicherung nimmt ohnehin
   alle lm4.*-Schlüssel. Zusammenführen (lernstand.js): vorhandenes Datum bleibt, Zahl t wird der höchste Wert. Ältere Stände und Sicherungen ohne den Schlüssel funktionieren unverändert (dann gibt es keinen Countdown).
   Der Wochenplan wird bei jedem Öffnen neu aus den aktuellen Daten gerechnet: wer ein Thema verbessert, sieht es nicht mehr im Plan, es rücken andere nach. */
(function (root) {
  const KEY = 'lm4.countdown', DAY = 864e5, WOCHEN = 8, WEGE = ['tec', 'stu', 'wing', 'winf'];
  const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const num = v => { v = +v; return isFinite(v) ? v : 0; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pad = n => String(n).padStart(2, '0');
  const ARTEN = { ap1: 'Abschlussprüfung Teil 1', ap2: 'Abschlussprüfung Teil 2', frei: 'Eigener Termin' };
  const WEG_ART = 'Klausur oder Abschluss';

  /* ---------- Datum ---------- */
  /* 'JJJJ-MM-TT' oder 'TT.MM.JJJJ' (auch zweistelliges Jahr, wird 20xx); null bei ungültigem Datum */
  function parseDatum(s) {
    s = String(s == null ? '' : s).trim(); let y, m, d, k;
    if ((k = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s))) { y = +k[1]; m = +k[2]; d = +k[3]; }
    else if ((k = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/.exec(s))) { d = +k[1]; m = +k[2]; y = +k[3]; if (y < 100) y += 2000; }
    else return null;
    if (y < 2020 || y > 2100 || m < 1 || m > 12 || d < 1) return null;
    const t = new Date(y, m - 1, d); if (t.getFullYear() !== y || t.getMonth() !== m - 1 || t.getDate() !== d) return null;
    return y + '-' + pad(m) + '-' + pad(d);
  }
  const toDate = k => { const p = String(k).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
  const dmy = k => { const p = String(k).split('-'); return p[2] + '.' + p[1] + '.' + p[0]; };
  const dm = k => { const p = String(k).split('-'); return p[2] + '.' + p[1] + '.'; };
  const startOfDay = t => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
  /* Kalendertage von heute bis zum Datum (0 = heute, negativ = vorbei); sommerzeitfest */
  function tageBis(datum, now) { const a = toDate(datum), b = startOfDay(now); return Math.round((a - b) / DAY); }
  const addTage = (now, n) => { const d = startOfDay(now); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };

  /* gespeicherten Wert säubern; null, wenn kein gültiger Countdown */
  function norm(raw, weg) {
    if (!isObj(raw)) return null;
    const datum = parseDatum(raw.datum); if (!datum) return null;
    let art = ['ap1', 'ap2', 'frei'].indexOf(raw.art) >= 0 ? raw.art : 'frei';
    if (weg) art = 'frei';
    const titel = typeof raw.titel === 'string' ? raw.titel.replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) : '';
    return { v: 1, art, datum, titel, t: num(raw.t) > 0 ? num(raw.t) : 0 };
  }
  function labelOf(cd, weg) {
    if (!cd) return '';
    if (cd.art === 'frei') return cd.titel || (weg ? WEG_ART : ARTEN.frei);
    return ARTEN[cd.art];
  }
  const tageText = n => (n === 0 ? 'heute' : n === 1 ? 'noch 1 Tag' : 'noch ' + n + ' Tage');
  const wochenText = n => (n === 1 ? '1 Woche' : n + ' Wochen');

  /* ---------- Plan ---------- */
  const ordnungThemen = (a, b) => (b.ausbilder - a.ausbilder) || (b.schwach - a.schwach) || a.p - b.p || b.n - a.n || (a.k < b.k ? -1 : 1);
  /* Liste der Lerneinheiten aus dem Modell: schwache Prüfungsthemen, dann Lernfelder/Module in Arbeit, dann noch nicht begonnene; abwechselnd gemischt */
  function einheiten(m) {
    const T = [], B = [];
    if (m.pruefung && m.pruefung.sichtbar) {
      const bew = m.pruefung.themen.filter(t => !t.neu && t.ampel !== 'gruen').sort(ordnungThemen);
      bew.forEach(t => T.push({ art: 'thema', titel: t.titel + ' üben', text: t.grund + '.', href: t.href }));
      m.pruefung.themen.filter(t => t.neu).slice(0, 6).forEach(t => T.push({ art: 'thema', titel: 'Neu: ' + t.titel, text: 'Noch nicht geübt.', href: t.href }));
    }
    const lf = m.bereiche.filter(b => !b.optional && b.n > 0 && b.ampel !== 'gruen');
    lf.filter(b => b.ampel === 'gelb').concat(lf.filter(b => b.ampel === 'grau')).forEach(b => B.push({ art: m.weg ? 'modul' : (m.bereicheQuelle === 'plan' ? 'lernfeld' : 'lab'), titel: b.titel, text: b.grund + '.', href: b.href }));
    const out = []; let i = 0;
    while (i < T.length || i < B.length) { if (i < T.length) out.push(T[i]); if (i < B.length) out.push(B[i]); i++; }
    return out;
  }
  /* cd: normierter Countdown, m: Modell (meinstand-core build), now: ms. Ergebnis: { tage, status, weeks[], aktuell, heute[] , ... } */
  function plan(m, cd, now) {
    now = now || Date.now();
    const weg = !!(m && m.weg);
    if (!cd) return { status: 'kein', tage: null, weeks: [], aktuell: 0, heute: [], beginn: '', label: '' };
    const tage = tageBis(cd.datum, now), label = labelOf(cd, weg), res = { status: tage < 0 ? 'vorbei' : tage === 0 ? 'heute' : 'zukunft', tage, label, datum: cd.datum, weeks: [], aktuell: 0, heute: [], beginn: '', kurz: tageText(tage) };
    if (tage < 0) { res.kurz = tage === -1 ? 'gestern' : 'vor ' + (-tage) + ' Tagen'; return res; }
    if (tage === 0) { res.heute = [{ art: 'pruefungstag', titel: 'Heute ist dein Termin', text: 'Ruhig bleiben, in Ruhe lesen, nichts Neues mehr lernen.', href: '' }]; return res; }
    const W = clamp(Math.ceil(tage / 7), 1, WOCHEN), pool = !!(m && m.pruefung && m.pruefung.sichtbar), U = einheiten(m || { bereiche: [], pruefung: {} });
    /* Lernwochen: alle außer der letzten (die ist zum Wiederholen); die Einheiten werden gleichmäßig verteilt, höchstens 3 je Woche, bei Mangel mit "Wiederholen und festigen" auf mindestens 2 aufgefüllt */
    const lernW = W >= 2 ? W - 1 : 1, total = Math.min(U.length, 3 * lernW), base = Math.floor(total / lernW), extra = total % lernW;
    const kf = m && m.karten ? m.karten.faellig : 0;
    let pos = 0;
    for (let k = 1; k <= W; k++) {
      const off = tage - 7 * (W - k + 1);   // Tage von heute bis zum Wochenbeginn (kann negativ sein)
      const von = addTage(now, off), bis = addTage(now, off + 6), items = [];
      const letzte = W >= 2 && k === W;
      if (!letzte) {
        const size = base + (k <= extra ? 1 : 0);
        U.slice(pos, pos + size).forEach(u => items.push(Object.assign({}, u))); pos += size;
        if (items.length < 2) items.push({ art: 'wiederholen', titel: 'Wiederholen und festigen', text: 'Gehe die Themen der letzten Wochen noch einmal durch und mache die Aufgaben aus „Wiederholen“.', href: 'wiederholen.html' });
      } else items.push({ art: 'wiederholen', titel: 'Letzte Wiederholung', text: 'Nur noch wiederholen, nichts Neues anfangen. Schau dir deine Fehler und Lernkarten an.', href: 'wiederholen.html' });
      items.push({ art: 'karten', titel: 'Lernkarten wiederholen', text: kf > 0 ? kf + (kf === 1 ? ' Karte ist' : ' Karten sind') + ' jetzt fällig.' : 'Eine kurze Runde hält das Wissen frisch.', href: 'karten.html' });
      if (k >= W - 1) {
        if (pool) items.push({ art: 'probe', titel: k === W ? 'Letzte Probeprüfung' : 'Probeprüfung mit Zeit und Note', text: 'Wie in der Prüfung, ohne Hilfen. Danach die Fehler ansehen.', href: 'pruefungslab.html?tab=pruefung' + (cd.art === 'ap1' ? '&teil=1' : cd.art === 'ap2' ? '&teil=2' : '') });
        else items.push({ art: 'probe', titel: k === W ? 'Letzte Probeaufgaben' : 'Probeklausur', text: 'Löse Aufgaben aus deinen Modulen ohne Tipps und mit Zeit.', href: 'meinstand.html' });
      }
      res.weeks.push({ nr: k, von, bis, items, aktuell: off <= 0 && off + 6 >= 0 });
    }
    const cur = res.weeks.find(w => w.aktuell); res.aktuell = cur ? cur.nr : 0;
    if (tage > 7 * WOCHEN) res.beginn = addTage(now, tage - 7 * WOCHEN);
    /* heute dran: eine Einheit der Woche (wechselt mit dem Wochentag), fällige Wiederholung, fällige Karten; höchstens 3 */
    const out = [], wk = cur || res.weeks[0], units = wk ? wk.items.filter(i => i.art !== 'karten') : [];
    if (res.aktuell && units.length) { const dayIdx = Math.max(0, now ? Math.round((startOfDay(now) - toDate(wk.von)) / DAY) : 0); out.push(Object.assign({}, units[dayIdx % units.length])); }
    else if (m && m.naechster) out.push({ art: 'weiter', titel: m.naechster.titel, text: m.naechster.text, href: m.naechster.href });
    const wl = m && m.wiederholen ? m.wiederholen.liste.length : 0;
    if (wl > 0) out.push({ art: 'wiederholen', titel: wl === 1 ? '1 Aufgabe wiederholen' : wl + ' Aufgaben wiederholen', text: 'Diese Aufgaben sind heute zum Wiederholen dran.', href: 'wiederholen.html' });
    if (kf > 0) out.push({ art: 'karten', titel: kf === 1 ? '1 Lernkarte' : kf + ' Lernkarten', text: 'Fällige Karten, etwa 5 Minuten.', href: 'karten.html' });
    res.heute = out.slice(0, 3);
    return res;
  }

  const api = { KEY, WOCHEN, ARTEN, WEG_ART, parseDatum, tageBis, addTage, norm, labelOf, tageText, einheiten, plan, dmy, dm, wochenText };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.Countdown = api;
  if (typeof document === 'undefined') return;

  /* ====================================================== Browserteil ====================================================== */
  const doc = document;
  const ls = { get: k => { try { return root.localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { root.localStorage.setItem(k, v); return true; } catch (e) { return false; } }, del: k => { try { root.localStorage.removeItem(k); } catch (e) {} } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const wegNow = () => { try { const b = root.BerufReg && root.BerufReg.cur && root.BerufReg.cur(); return WEGE.indexOf(b) >= 0; } catch (e) { return false; } };
  function laden(weg) { try { const t = ls.get(KEY); return t ? norm(JSON.parse(t), weg == null ? wegNow() : weg) : null; } catch (e) { return null; } }
  function speichern(o, weg) {
    const cd = norm(Object.assign({}, o, { t: Date.now() }), weg == null ? wegNow() : weg); if (!cd) return null;
    if (!ls.set(KEY, JSON.stringify(cd))) return null;
    try { root.dispatchEvent(new Event('countdown:geaendert')); } catch (e) {} return cd;
  }
  function entfernen() { ls.del(KEY); try { root.dispatchEvent(new Event('countdown:geaendert')); } catch (e) {} }
  function registrieren() { try { const L = root.Lernstand; if (L && Array.isArray(L.PROGRESS) && L.PROGRESS.indexOf(KEY) < 0) L.PROGRESS.push(KEY); } catch (e) {} }
  registrieren(); doc.addEventListener('DOMContentLoaded', registrieren); doc.addEventListener('click', registrieren, true);

  /* kurze Angabe für Coach-Karte, Startseite und Ausbildungsplan-Zeile: { text, heute, href } oder null, wenn kein Datum gesetzt ist (dann auch kein Rechenaufwand) */
  function kurz(model) {
    const cd = laden(); if (!cd) return null;
    let m = model || null;
    if (!m && root.MeinStandCore) { try { m = root.MeinStandCore.build(root.MeinStandCore.fromGlobals(root)); } catch (e) { m = null; } }
    const p = plan(m || { bereiche: [], pruefung: {}, weg: wegNow() }, cd, Date.now());
    const lab = p.label;
    const text = p.status === 'vorbei' ? lab + ': der Termin war ' + p.kurz + '.' : p.status === 'heute' ? lab + ': heute.' : lab + ': ' + p.kurz + '.';
    return { text, tage: p.tage, status: p.status, label: lab, heute: p.heute[0] || null, href: 'meinstand.html#countdown' };
  }
  api.laden = laden; api.speichern = speichern; api.entfernen = entfernen; api.kurz = kurz; api.registrieren = registrieren;

  const CSS = '.cdw{background:var(--panel,#222830);color:var(--fg,#e8ecf0);border:1px solid var(--line,#38424d);border-radius:14px;padding:12px 14px;min-width:0}'
    + '.cdw h2{margin:0 0 6px;font-size:20px}.cdw h3{margin:0 0 4px;font-size:16px}.cdw p{margin:4px 0}.cdw .mu{color:var(--mute,#9aa6b2);font-size:14px}'
    + '.cdw .gr{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin:2px 0 6px}.cdw .gr b{font-size:32px;line-height:1.15}.cdw .gr span{font-size:16px;color:var(--mute,#9aa6b2)}'
    + '.cdw form{display:grid;gap:8px;margin:8px 0}.cdw label{display:block;font-weight:600;font-size:15px;margin:0 0 3px}'
    + '.cdw select,.cdw input[type=date],.cdw input[type=text]{width:100%;min-height:44px;font:inherit;font-size:16px;color:var(--fg,#e8ecf0);background:var(--bg,#14181c);border:1px solid var(--mute,#5b6875);border-radius:10px;padding:6px 10px}'
    + '.cdw .row{display:flex;gap:8px;flex-wrap:wrap}.cdw button,.cdw a.cb{display:inline-flex;align-items:center;justify-content:center;min-height:44px;min-width:44px;padding:0 16px;border-radius:10px;border:1px solid var(--line,#5b6875);background:var(--panel2,#2c343e);color:var(--fg,#e8ecf0);font:600 15px system-ui,sans-serif;text-decoration:none;cursor:pointer}'
    + '.cdw button.pri,.cdw a.cb.pri{background:var(--accent-bg,#1a6fd4);border-color:var(--accent-bg,#1a6fd4);color:var(--accent-ink,#fff)}'
    + '.cdw button:focus-visible,.cdw a:focus-visible,.cdw input:focus-visible,.cdw select:focus-visible,.cdw summary:focus-visible{outline:3px solid var(--focus,#ffd166);outline-offset:2px}'
    + '.cdw ul{list-style:none;margin:6px 0;padding:0;display:grid;gap:8px}.cdw li.it{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:8px 10px;border-radius:12px;background:var(--panel2,#2c343e);border:1px solid var(--line,#38424d)}'
    + '.cdw li.it .tx{flex:1 1 200px;min-width:0}.cdw li.it b{display:block;font-size:15px}.cdw li.it span.s{display:block;font-size:14px;color:var(--mute,#9aa6b2)}'
    + '.cdw details{margin:8px 0;border:1px solid var(--line,#38424d);border-radius:12px;padding:0 10px}.cdw summary{cursor:pointer;min-height:44px;display:flex;align-items:center;gap:8px;font-weight:600;font-size:15px}'
    + '.cdw .now{font-size:14px;font-weight:700;padding:1px 8px;border-radius:99px;border:1px solid var(--accent,#5fb0ff);color:var(--accent,#5fb0ff)}'
    + '.cdw .err{color:var(--danger,#ff8a7a);min-height:20px;margin:2px 0}';
  function css() { if (doc.getElementById('cdCss')) return; const s = doc.createElement('style'); s.id = 'cdCss'; s.textContent = CSS; (doc.head || doc.body).appendChild(s); }
  const itemHtml = i => '<li class="it"><div class="tx"><b>' + esc(i.titel) + '</b><span class="s">' + esc(i.text) + '</span></div>' + (i.href ? '<a class="cb pri" href="' + esc(i.href) + '" aria-label="' + esc('Los: ' + i.titel) + '">Los</a>' : '') + '</li>';

  /* Karte in host einhängen (Seite Mein Stand). m = Modell aus meinstand-core */
  function mount(host, m) {
    if (!host) return; css();
    const weg = !!(m && m.weg), cd = laden(weg), p = plan(m, cd, Date.now());
    const arten = weg ? [['frei', WEG_ART]] : [['ap1', ARTEN.ap1], ['ap2', ARTEN.ap2], ['frei', ARTEN.frei]];
    const formOpen = !cd;
    let h = '<div class="cdw"><h2 id="cdH">Prüfungs-Countdown</h2>';
    if (cd) {
      h += '<div class="gr"><b>' + esc(p.status === 'heute' ? 'Heute' : p.status === 'vorbei' ? p.kurz : p.kurz.replace('noch ', 'Noch ')) + '</b><span>' + esc(p.label) + ' am ' + dmy(cd.datum) + '</span></div>';
      if (p.status === 'zukunft') h += '<p class="mu">Das sind ' + wochenText(Math.ceil(p.tage / 7)) + (p.beginn ? '. Der Wochenplan beginnt am ' + dmy(p.beginn) + ' (8 Wochen vor dem Termin).' : '.') + '</p>';
      if (p.status === 'zukunft' && p.weeks.length && !p.aktuell) h += '<p class="mu">So funktioniert es: ' + (p.beginn ? 'Der Plan startet in ' + (p.tage - 7 * WOCHEN) + (p.tage - 7 * WOCHEN === 1 ? ' Tag' : ' Tagen') + '. ' : '') + 'Bis dahin zeigt „Heute dran“ eine Starthilfe, und der Wochenplan unten ist eine Vorschau. Mit „Los“ startest du ein Thema direkt.</p>';
      if (p.status === 'vorbei') h += '<p class="mu">Der Termin ist vorbei. Setze ein neues Datum, wenn der nächste ansteht.</p>';
    } else h += '<p>Setze das Datum deiner ' + (weg ? 'Klausur oder deines Abschlusses' : 'Prüfung') + '. Daraus entsteht ein Plan mit den Themen, die bei dir noch Luft nach oben haben.</p>';
    if (p.heute.length) h += '<h3>Heute dran</h3><ul>' + p.heute.map(itemHtml).join('') + '</ul>';
    h += '<details id="cdForm"' + (formOpen ? ' open' : '') + '><summary>' + (cd ? 'Datum ändern oder entfernen' : 'Datum setzen') + '</summary><form id="cdF" novalidate>'
      + (arten.length > 1 ? '<div><label for="cdArt">Was steht an?</label><select id="cdArt">' + arten.map(a => '<option value="' + a[0] + '"' + (cd && cd.art === a[0] ? ' selected' : '') + '>' + esc(a[1]) + '</option>').join('') + '</select></div>' : '')
      + '<div id="cdTW"' + ((weg || (cd && cd.art === 'frei')) ? '' : ' hidden') + '><label for="cdTit">Name des Termins (frei wählbar)</label><input type="text" id="cdTit" maxlength="40" autocomplete="off" value="' + esc(cd ? cd.titel : '') + '"></div>'
      + '<div><label for="cdDat">Datum</label><input type="date" id="cdDat" min="2020-01-01" max="2100-12-31" value="' + esc(cd ? cd.datum : '') + '" aria-describedby="cdE"></div><p class="err" id="cdE" role="alert"></p>'
      + '<div class="row"><button type="submit" class="pri">Speichern</button>' + (cd ? '<button type="button" id="cdDel">Countdown entfernen</button>' : '') + '</div></form></details>';
    if (p.weeks.length) {
      h += '<h3>Wochenplan</h3><p class="mu">Pro Woche ein paar Themen aus deinen schwachen Stellen, dazu Karten' + (p.weeks.length >= 2 ? ' und zum Schluss Probeprüfung und Wiederholung' : '') + '. Der Plan passt sich an, wenn du besser wirst.</p>';
      h += p.weeks.map(w => '<details' + ((w.aktuell || (!p.aktuell && w.nr === 1)) ? ' open' : '') + '><summary><span>Woche ' + w.nr + ' (' + dm(w.von) + ' bis ' + dm(w.bis) + ')</span>' + (w.aktuell ? '<span class="now">diese Woche</span>' : '') + '</summary><ul>' + w.items.map(itemHtml).join('') + '</ul></details>').join('');
    }
    h += '<p class="mu">Das Datum bleibt auf deinem Gerät und steht in deinem Lernstand-Code. Es gibt keine Benachrichtigungen.</p></div>';
    host.innerHTML = h;
    const f = host.querySelector('#cdF'), art = host.querySelector('#cdArt'), tw = host.querySelector('#cdTW');
    if (art) art.onchange = () => { tw.hidden = art.value !== 'frei'; };
    f.onsubmit = e => {
      e.preventDefault(); const err = host.querySelector('#cdE'), dat = host.querySelector('#cdDat');
      const d = parseDatum(dat.value);
      if (!d) { err.textContent = 'Bitte ein gültiges Datum eintragen, zum Beispiel 14.03.2027.'; dat.setAttribute('aria-invalid', 'true'); dat.focus(); return; }
      const ok = speichern({ art: weg ? 'frei' : (art ? art.value : 'frei'), datum: d, titel: host.querySelector('#cdTit').value }, weg);
      if (!ok) { err.textContent = 'Das Datum konnte nicht gespeichert werden (Speicher voll oder gesperrt).'; return; }
      mount(host, m); const x = host.querySelector('.cdw h2'); if (x) { x.tabIndex = -1; x.focus(); }
    };
    const del = host.querySelector('#cdDel'); if (del) del.onclick = () => { entfernen(); mount(host, m); };
  }
  api.mount = mount;
})(typeof window !== 'undefined' ? window : globalThis);
