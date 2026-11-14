'use strict';
/* Tonfunk Linien-Lab: Oberfläche (Lab-Kennung 'fli', Stufe 'studium').
   Reiter: Linie (Regler: Takt, Ausschuss, Puffer, Störung), Rückverfolgung, Lack und Verguss, Aufgaben, Hilfe.
   Module: flicore.js (FLI_CORE), flidata.js (FLI_DATA, FLI_TASKS), fliviz.js (FLI_VIZ); die Linie A selbst kommt aus pcbfehler.js (PCB_FEHLER).
   Speicher (Präfix lm4.fli.): tab, li (Reglerwerte), rv (Auswahl), lv (Rechner), done ({id:true} nur gelöste), prog ({id:Prozent}), hints, ctipps (nur Prüfmodus), auf ({id:true} Lösung aufgedeckt), exam ('1').
   Tipp-Abzug (25 % je Stufe, höchstens 3 Stufen) gibt es nur im Prüfmodus; beim normalen Üben kosten Tipps nichts.
   Lösung zeigen (nur beim Üben, erst nach einer falschen Antwort): Wer die Lösung aufdeckt, bevor die Aufgabe richtig gelöst ist, bekommt für das nächste richtige Lösen
   dieser Aufgabe 25 % (so viel wie mit allen drei Tipp-Stufen im Prüfmodus). Der Merker auf[id] bleibt über Schließen und Neuladen stehen und fällt erst mit diesem Lösen weg;
   danach zählt ein Lösen ohne Lösung wieder voll. prog behält immer den besten Wert.
   Alle Zahlen sind Übungswerte eines Lernmodells (Linie A), keine Betriebswerte. Aufruf: flilab.html?aufgabe=fli1 öffnet die Aufgabe. */
(function (root) {
  const C = root.FLI_CORE, D = root.FLI_DATA, V = root.FLI_VIZ;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.fli.';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(LS + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} };
  const f = (v, d) => C.fmtN(v, d == null ? 1 : d, true), P = s => C.parseDe(s);
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
  if (!C || !D || !V) {
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>Linien-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">flicore.js, flidata.js, fliviz.js oder pcbfehler.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks, PF = C.PF, RU = C.RUECK;
  const KURZ = id => C.ST[id].kurz, NAMEN = id => C.ST[id].name;

  /* ============================================================ Zustand */
  const TABS = [['li', '🏭', 'Linie'], ['rv', '🔎', 'Rückverfolgung'], ['lv', '🎨', 'Lack und Verguss'], ['tasks', '📝', 'Aufgaben'], ['help', '📘', 'Hilfe']];
  const S = {
    tab: lsGet('tab', 'li'),
    li: C.normiere(lsGet('li', {})),
    rv: Object.assign({ mode: 'charge', k: 'lk', w: 'LK2', sel: [] }, lsGet('rv', {})),
    lv: Object.assign({ stueck: 24, minuten: 30, topf: 45, je: 4, gesamt: 90, b: 25 }, lsGet('lv', {})),
    task: null, tq: null, tAns: {}, tRes: null, tShow: null
  };
  if (!Array.isArray(S.rv.sel)) S.rv.sel = [];
  const num = (v, a, b, d) => { v = +v; return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d; };
  S.lv.stueck = num(S.lv.stueck, 1, 60, 24); S.lv.minuten = num(S.lv.minuten, 10, 120, 30); S.lv.topf = num(S.lv.topf, 10, 90, 45); S.lv.je = num(S.lv.je, 1, 10, 4); S.lv.gesamt = num(S.lv.gesamt, 20, 300, 90); S.lv.b = num(S.lv.b, 5, 50, 25);
  const wOf = el => { const w = el && el.clientWidth ? el.clientWidth : (el && el.parentNode && el.parentNode.clientWidth) || window.innerWidth - 24; return Math.max(240, Math.min(1000, w)); };
  const setHtml = (id, h) => { const e = $('#' + id); if (e) e.innerHTML = h; };

  /* ============================================================ 1 Linie */
  function liOut(m) {
    const e = m.engpass, h = m.hebel, st = m.stoerung;
    let h2 = `<div class="rdout"><b>Engpass: ${esc(e ? NAMEN(e) : '–')}</b> mit ${f(m.tEngpass, 0)} s je Stück.<span class="st">Start-Rate ${f(m.startRate, 1)} Stück/h · Gutstücke ${f(m.gutRate, 1)} Stück/h · Gesamtausbeute ${f(m.rty * 100, 1)} %</span></div>`;
    h2 += `<div class="rdout"><b>Durchlaufzeit ${f(m.dlzSek / 60, 1)} min</b> (Summe der Takte ${f(m.summeTakt, 0)} s plus ${f(m.puffer, 0)} Stück Puffer mal ${f(m.tEngpass, 0)} s).<span class="st">Bestand nach Little: ${f(m.bestand, 1)} Stück in der Linie (mit der Start-Rate gerechnet, also eine obere Abschätzung).</span></div>`;
    if (h) h2 += `<div class="rdout ok"><b>Hebel:</b> ${esc(NAMEN(h.id))} – ein Prozentpunkt mehr Ausbeute bringt ${f(h.gain * 100, 2)} Prozentpunkte Gesamtausbeute (die größte Wirkung aller Stationen).${h.id === 'pruef' ? '<span class="st">Die Ausbeute an der Prüfstation steigt vor allem, wenn die Ursachen der Fehler davor abgestellt werden und weniger Fehlalarme entstehen.</span>' : ''}</div>`;
    if (st) h2 += st.vorEngpass
      ? `<div class="rdout ${st.verlustS > 0 ? 'warn' : 'ok'}"><b>Störung an ${esc(NAMEN(m.p.stoerSt))}, ${f(m.p.stoer, 0)} min:</b> Der Puffer trägt ${f(st.reichweiteS / 60, 1)} min. ${st.verlustS > 0 ? 'Der Engpass steht ' + f(st.verlustS / 60, 1) + ' min still: ' + f(st.stueckeEngpass, 1) + ' Stück am Engpass und etwa ' + f(st.gutVerlust, 1) + ' Gutstücke gehen verloren.' : 'Der Engpass läuft weiter, es geht nichts verloren.'}</div>`
      : `<div class="rdout bad"><b>Störung an ${esc(NAMEN(m.p.stoerSt))}, ${f(m.p.stoer, 0)} min:</b> Diese Station liegt am oder hinter dem Engpass. Der Puffer davor schützt hier nicht: Etwa ${f(st.gutVerlust, 1)} Gutstücke gehen verloren.</div>`;
    return h2;
  }
  const liModel = () => C.modell(S.li);
  let liW = 0;   // Breite, mit der die Diagramme zuletzt gezeichnet wurden
  function updateLi() {
    const m = liModel(), w = wOf($('#liTakt')); liW = w;
    setHtml('liTakt', V.taktSvg(m, w)); setHtml('liAus', V.ausbeuteSvg(m, wOf($('#liAus')))); setHtml('liOut', liOut(m));
    C.STATIONEN.forEach(s => { const a = $('#vT_' + s.id); if (a) a.textContent = f(S.li.takt[s.id], 0) + ' s'; });
    C.INNEN.forEach(id => { const a = $('#vA_' + id); if (a) a.textContent = f(S.li.ausschuss[id], 1) + ' %'; });
    const p = $('#vP'), s2 = $('#vS'); if (p) p.textContent = S.li.puffer + ' Stück'; if (s2) s2.textContent = f(S.li.stoer, 0) + ' min';
    lsSet('li', S.li);
  }
  function renderLi() {
    const L = C.LIMITS;
    const rows = C.STATIONEN.map(s => {
      const inn = C.INNEN.indexOf(s.id) >= 0, off = s.id === 'verguss' && !S.li.verguss;
      return `<div class="card pl" style="margin-bottom:8px"><h4>${s.nr} · ${esc(s.name)}</h4>
        <label class="f"><span>Taktzeit: <b id="vT_${s.id}">${f(S.li.takt[s.id], 0)} s</b></span><input type="range" data-sl="takt.${s.id}" min="${L.takt[0]}" max="${L.takt[1]}" step="1" value="${S.li.takt[s.id]}" aria-label="Taktzeit ${esc(s.kurz)} in Sekunden"${off ? ' disabled' : ''}></label>
        ${inn ? `<label class="f" style="margin-bottom:0"><span>Ausschuss im ersten Durchlauf: <b id="vA_${s.id}">${f(S.li.ausschuss[s.id], 1)} %</b></span><input type="range" data-sl="ausschuss.${s.id}" min="${L.ausschuss[0]}" max="${L.ausschuss[1]}" step="0.1" value="${S.li.ausschuss[s.id]}" aria-label="Ausschuss ${esc(s.kurz)} in Prozent"${off ? ' disabled' : ''}></label>` : '<p class="hint2" style="margin:0">Keine Ausbeute-Regler: Ausbeute fest 100 Prozent im Modell.</p>'}
        ${s.id === 'verguss' ? `<div class="ctl"><button class="chip ${S.li.verguss ? 'on' : ''}" data-lit="vg" aria-pressed="${S.li.verguss}">${S.li.verguss ? '✓ Verguss wird durchlaufen' : 'Verguss wird übersprungen'}</button></div>` : ''}</div>`;
    }).join('');
    $('#liView').innerHTML = `<div class="card pl"><h4>Modell-Linie A</h4><p class="big">Wo bremst die Linie?</p>
      <p class="hint2" style="margin-top:0">Neun Stationen, alle Zahlen sind Übungswerte. Verändere Takt, Ausschuss, Puffer und eine Störung und beobachte, wie Engpass, Durchsatz und Ausbeute reagieren. Fehlerbilder der Stationen findest du im Leiterplatten-Lab, Reiter Fehlerbild (<a href="pcblab.html">pcblab.html</a>).</p>
      <div class="inst" id="liTakt"></div><div class="inst" id="liAus"></div><div id="liOut"></div>
      <div class="ctl"><button class="chip" data-lit="reset">↺ Ausgangslage</button><button class="chip" data-lit="eng">⚡ Engpass 10 % schneller</button><button class="chip" data-lit="pufmax">▤ Puffer auf 12</button></div>
      <p class="hint2">Modell: Stücke, die eine Station im ersten Durchlauf nicht bestehen, verlassen den Fluss. Der Engpass ist die Station mit der kleinsten Grenze (Kapazität geteilt durch den Anteil, der bis dorthin ankommt).</p></div>
      <div class="card pl"><h4>Puffer und Störung</h4>
        <label class="f"><span>Puffer vor dem Engpass: <b id="vP">${S.li.puffer} Stück</b></span><input type="range" data-sl="puffer" min="${L.puffer[0]}" max="${L.puffer[1]}" step="1" value="${S.li.puffer}" aria-label="Puffer in Stück"></label>
        <label class="f"><span>Störung an einer Station: <b id="vS">${f(S.li.stoer, 0)} min</b></span><input type="range" data-sl="stoer" min="${L.stoer[0]}" max="${L.stoer[1]}" step="1" value="${S.li.stoer}" aria-label="Störung in Minuten"></label>
        <label class="f" style="margin-bottom:0"><span>Welche Station steht still?</span><select data-sel="stoerSt" aria-label="Station mit Störung">${C.STATIONEN.map(s => `<option value="${s.id}"${S.li.stoerSt === s.id ? ' selected' : ''}>${s.nr} · ${esc(s.name)}</option>`).join('')}</select></label></div>
      <details class="ex" open><summary>Regler je Station</summary>${rows}</details>`;
    updateLi();
  }
  const liv = $('#liView');
  /* Die Zeichenfläche kann schmaler werden, ohne dass das Fenster seine Größe ändert (am PC erscheint ein Rollbalken, sobald unter dem Lab der Urheber-Hinweis steht):
     Dann neu zeichnen, sonst verkleinert der Browser die Zeichnung und die Schrift fällt unter 14 px. */
  try { if (typeof ResizeObserver === 'function') new ResizeObserver(() => { if (S.tab === 'li' && liW && wOf($('#liTakt')) !== liW) updateLi(); }).observe(liv); } catch (e) {}
  liv.addEventListener('input', e => {
    const k = e.target.dataset && e.target.dataset.sl; if (!k) return; const v = +e.target.value, [a, id] = k.split('.');
    if (a === 'takt') S.li.takt[id] = v; else if (a === 'ausschuss') S.li.ausschuss[id] = v; else S.li[a] = v;
    S.li = C.normiere(S.li); updateLi();
  });
  liv.addEventListener('change', e => { if (e.target.dataset && e.target.dataset.sel) { S.li.stoerSt = e.target.value; S.li = C.normiere(S.li); updateLi(); } });
  liv.addEventListener('click', e => {
    const b = e.target.closest('[data-lit]'); if (!b) return; const a = b.dataset.lit;
    if (a === 'reset') S.li = C.normiere({}); else if (a === 'pufmax') S.li.puffer = 12;
    else if (a === 'vg') S.li.verguss = !S.li.verguss;
    else if (a === 'eng') { const m = liModel(); if (m.engpass) S.li.takt[m.engpass] = Math.max(C.LIMITS.takt[0], Math.round(S.li.takt[m.engpass] * 0.9)); }
    S.li = C.normiere(S.li); renderLi();
  });

  /* ============================================================ 2 Rückverfolgung */
  function rvTable(hit, sel, interactive) {
    const fe = RU.felder;
    return `<div class="tw"><table class="tt rvt" aria-label="Rückverfolgungstabelle der Linie A"><tr><th>Seriennr.</th>${fe.map(x => `<th title="${esc(x.name)}">${esc(x.kurz)}</th>`).join('')}</tr>` +
      RU.zeilen.map(z => {
        const on = sel.indexOf(z.sn) >= 0, mark = hit && hit.sns.indexOf(z.sn) >= 0;
        return `<tr class="${on || mark ? 'sel' : ''}"><td>${interactive ? `<button class="chip s" data-rvs="${z.sn}" aria-pressed="${on}" aria-label="Seriennummer ${z.sn} ${on ? 'abwählen' : 'auswählen'}">${on ? '●' : '○'} ${z.sn}</button>` : (mark ? '● ' : '') + z.sn}</td>${fe.map(x => `<td class="${hit && hit.k === x.k && z[x.k] === hit.w ? 'hit' : ''}">${z[x.k] == null ? '–' : esc(z[x.k])}</td>`).join('')}</tr>`;
      }).join('') + '</table></div>';
  }
  function renderRv() {
    const R = S.rv, fe = RU.felder, ws = PF.werte(RU, R.k); if (ws.indexOf(R.w) < 0) R.w = ws[0];
    let out = '', hit = null;
    if (R.mode === 'charge') {
      const sns = PF.betroffen(RU, R.k, R.w), name = fe.find(x => x.k === R.k).name; hit = { k: R.k, w: R.w, sns };
      out = `<div class="rdout"><b>${esc(name)} ${esc(R.w)}</b> steckt in <b>${sns.length}</b> Baugruppen: ${sns.length ? sns.join(', ') : 'keine'}.<span class="st">Rückruf-Richtung: von der Charge zu den Seriennummern. Diese Baugruppen müssen gesperrt oder geprüft werden.</span></div>`;
    } else {
      const g = PF.gemeinsam(RU, R.sel);
      out = !R.sel.length ? '<div class="rdout warn">Tippe in der Tabelle auf die Seriennummern der auffälligen Baugruppen.</div>'
        : g.length ? `<div class="rdout ok"><b>Gemeinsam bei ${R.sel.length} Baugruppen:</b> ${g.map(x => esc(x.name) + ' ' + esc(x.wert)).join('; ')}.<span class="st">Eingrenzen: von den Seriennummern zur Charge. Prüfe danach, welche anderen Baugruppen dieselbe Charge tragen.</span></div>`
          : '<div class="rdout bad">Kein Merkmal ist bei allen gewählten Baugruppen gleich. Wähle weniger Baugruppen oder suche zwei getrennte Ursachen.</div>';
    }
    $('#rvView').innerHTML = `<div class="card pl"><h4>Rückverfolgung</h4><p class="big">Von der Charge zur Baugruppe und zurück</p>
      <p class="hint2" style="margin-top:0">Drei Ebenen nicht vermischen: <b>Charge</b> (Los des Materials), <b>Verpackungs-Kennung</b> (Rolle, Tray) und <b>Seriennummer</b> (einzelne Baugruppe). Die Tabelle ist ein frei erfundenes Übungsbeispiel.</p>
      <div class="seg" role="group" aria-label="Richtung"><button class="${R.mode === 'charge' ? 'on' : ''}" data-rvm="charge" aria-pressed="${R.mode === 'charge'}">Charge → Baugruppen</button><button class="${R.mode === 'sn' ? 'on' : ''}" data-rvm="sn" aria-pressed="${R.mode === 'sn'}">Baugruppen → gemeinsame Charge</button></div>
      ${R.mode === 'charge' ? `<div class="dsrow" style="margin-top:8px"><label class="f"><span>Merkmal</span><select data-rvk="k" aria-label="Merkmal">${fe.map(x => `<option value="${x.k}"${R.k === x.k ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label><label class="f"><span>Wert</span><select data-rvk="w" aria-label="Wert">${ws.map(w => `<option${R.w === w ? ' selected' : ''}>${esc(w)}</option>`).join('')}</select></label></div>`
        : `<div class="ctl"><button class="chip" data-rva="ueb">Übung: Blasen im Lack bei vier Baugruppen</button><button class="chip" data-rva="clr">Auswahl löschen</button></div>`}
      ${out}${rvTable(hit, R.mode === 'sn' ? R.sel : [], R.mode === 'sn')}
      <p class="hint2">Die Spalten: Leiterplatten-Charge (LP), Pasten-Charge, Kondensator-Charge, Ofenlauf, Lack-Charge, Vergussmasse-Charge. „–“ heißt: diese Baugruppe wurde nicht vergossen. Fehlerbilder und ihre Ursachen: Leiterplatten-Lab, Reiter Fehlerbild.</p><p class="hint2">Chargen können parallel im Einsatz sein, die Reihenfolge ist nicht streng. Vereinfachte Tabelle ohne Gebinde-Kennung und Zeitstempel.</p></div>`;
  }
  $('#rvView').addEventListener('click', e => {
    const m = e.target.closest('[data-rvm]'), s = e.target.closest('[data-rvs]'), a = e.target.closest('[data-rva]');
    if (m) { S.rv.mode = m.dataset.rvm; lsSet('rv', S.rv); renderRv(); }
    else if (s) { const i = S.rv.sel.indexOf(s.dataset.rvs); if (i >= 0) S.rv.sel.splice(i, 1); else S.rv.sel.push(s.dataset.rvs); lsSet('rv', S.rv); renderRv(); }
    else if (a) { S.rv.sel = a.dataset.rva === 'ueb' ? RU.uebung.auffaellig.slice() : []; lsSet('rv', S.rv); renderRv(); }
  });
  $('#rvView').addEventListener('change', e => { const k = e.target.dataset && e.target.dataset.rvk; if (!k) return; S.rv[k] = e.target.value; if (k === 'k') S.rv.w = PF.werte(RU, S.rv.k)[0]; lsSet('rv', S.rv); renderRv(); });

  /* ============================================================ 3 Lack und Verguss */
  const LACK = [
    { n: 'Reinigen', was: 'Staub, Fett und Flussmittelreste entfernen, trocknen lassen. Nicht mit bloßen Fingern anfassen.', achte: ['Haftung hängt an einer sauberen, trockenen Oberfläche.', 'Rückstände sind eine häufige Ursache für Benetzungsfehler.'], fehler: 'Lack perlt ab, Haftungsfehler' },
    { n: 'Maskieren', was: 'Stellen abdecken, an denen kein Lack hin darf: Stecker, Taster, Messpunkte, Kühlflächen, Schraubstellen.', achte: ['Abdeckung dicht und richtig sitzend, passend zur Variante der Baugruppe.', 'Abdeckungen entfernst du nach Anweisung, meist nach dem Antrocknen oder Aushärten.'], fehler: 'Lack auf Kontakten, Lack an Schraubstellen' },
    { n: 'Auftragen', was: 'Lack in gleichmäßiger Schicht aufbringen (Sprühen, Tauchen, Pinseln oder Selektivlackieren).', achte: ['Die Schichtdicke ist ein Fenster: zu dünn schützt nicht, zu dick staut Lösemittel. Der Wert steht in der Prüfanweisung.', 'Hohe Bauteile können dahinter Schatten werfen.'], fehler: 'zu dünn, zu dick, Läufer, Schatten' },
    { n: 'Ablüften', was: 'Lösemittel verdunsten lassen, bevor die Oberfläche durch Wärme schließt.', achte: ['Zu schnelles Aufheizen schließt die Oberfläche, darunter bleiben Bläschen.', 'Zeit und Umgebung nach Prüfanweisung.'], fehler: 'Blasen, Kocher' },
    { n: 'Aushärten', was: 'Der Lack trocknet oder vernetzt (an der Luft, mit Wärme oder mit Licht, je nach Lack).', achte: ['Aushärten läuft oft im Gestell: Die Zahl der Plätze bestimmt den Durchsatz (siehe Rechner unten).', 'Erst nach dem Aushärten umlagern.'], fehler: 'klebrige Oberfläche, Abdrücke' },
    { n: 'Prüfen', was: 'Sichtkontrolle, oft mit UV-Licht, und Kontrolle der abgedeckten Stellen.', achte: ['Prüfe an mehreren Stellen, besonders an Kanten und hinter hohen Bauteilen.', 'Dicke nach Anweisung messen; zusätzlich Sichtbild: glatte, geschlossene Haut ohne Lücken.'], fehler: 'Fehlstellen, Nadellöcher' }
  ];
  const VERG = [
    { n: 'Vorbereiten', was: 'Gehäuse und Baugruppe sauber, trocken und richtig positioniert, Anschlüsse abgedichtet.', achte: ['Undichte Gehäuse laufen aus.', 'Feuchte stört die Aushärtung.'], fehler: 'Auslaufen, Feuchteblasen' },
    { n: 'Mischen', was: 'Harz und Härter im vorgeschriebenen Verhältnis mischen (nach Gewicht oder Volumen).', achte: ['Falsches oder schlechtes Mischen lässt die Masse klebrig oder zu hart zurück.', 'Die Topfzeit läuft ab dem Mischen. Angemischte Masse wenn vorgeschrieben im Vakuum entgasen; das zählt zur Topfzeit. Gefüllte Harze vor dem Abwiegen aufrühren.'], fehler: 'klebrig, weich, Schlieren' },
    { n: 'Füllen', was: 'Masse blasenarm einfüllen, so dass alle Hohlräume gefüllt werden.', achte: ['Langsam und von der tiefsten Stelle her füllen.', 'Wenn vorgeschrieben: unter Vakuum vergießen.'], fehler: 'Luftblasen, Lunker' },
    { n: 'Aushärten', was: 'Die Masse vernetzt, bei Raumtemperatur oder im Ofen.', achte: ['Ungleichmäßige Wärme kann Spannungen erzeugen.', 'Nicht bewegen, bis die Masse fest ist.'], fehler: 'Risse, Spannungsrisse' },
    { n: 'Prüfen', was: 'Sichtkontrolle der Oberfläche und, wo nötig, Funktionstest.', achte: ['Füllstand und Oberfläche prüfen.', 'Lunker sind oft von außen nicht sichtbar, darum zählt der Ablauf.'], fehler: 'Lunker, Rissbild' }
  ];
  function lvSteps(arr, key) {
    const cur = S.lvStep[key]; const s = arr[cur];
    return `<div class="seg" role="group" aria-label="Schritte ${key}">${arr.map((x, i) => `<button class="${i === cur ? 'on' : ''}" data-lvs="${key}.${i}" aria-pressed="${i === cur}">${i + 1} ${esc(x.n)}</button>`).join('')}</div>
      <div class="rdout"><b>${cur + 1} ${esc(s.n)}:</b> ${esc(s.was)}<ul class="nhlog" style="margin:6px 0 0">${s.achte.map(a => '<li>' + esc(a) + '</li>').join('')}</ul><span class="st">Typische Fehlerbilder: ${esc(s.fehler)}. Mehr dazu im Leiterplatten-Lab, Reiter Fehlerbild.</span></div>`;
  }
  S.lvStep = { lack: 0, verguss: 0 };
  function lvOut() {
    const L = S.lv, dur = C.SOLVE.haerten({ stueck: L.stueck, minuten: L.minuten }), m = liModel(), tz = C.SOLVE.topfzeit({ topf: L.topf, je: L.je }), bk = C.SOLVE.mischung({ gesamt: L.gesamt, a: 100, b: L.b });
    const eng = m.zeilen.find(z => z.id === 'lack'), zu = eng ? eng.zufluss : 0;
    return `<div class="rdout ${dur >= zu ? 'ok' : 'warn'}"><b>Aushärten:</b> ${f(dur, 1)} Stück/h. ${eng ? (dur >= zu ? 'Das reicht für den Zufluss an der Station Lackieren (' + f(zu, 1) + ' Stück/h): Das Aushärten bremst nicht.' : 'Das ist weniger als der Zufluss an der Station Lackieren (' + f(zu, 1) + ' Stück/h): Hier würde das Aushärten bremsen. Zweites Gestell oder kürzere Zeit prüfen.') : ''} Der Rechner ist getrennt vom Linienmodell.</div>
      <div class="rdout"><b>Topfzeit:</b> höchstens ${f(tz, 0)} ganze Baugruppen aus einem Ansatz (Topfzeit ${f(L.topf, 0)} min, ${f(L.je, 0)} min je Baugruppe). Die echte Topfzeit hängt von Ansatzmenge und Temperatur ab.</div>
      <div class="rdout"><b>Mischen 100 zu ${f(L.b, 0)} nach Gewicht:</b> bei ${f(L.gesamt, 0)} g angemischter Masse sind das ${f(L.gesamt - bk, 1)} g Harz und ${f(bk, 1)} g Härter.</div>`;
  }
  function renderLv() {
    const L = S.lv, sl = (k, a, b, label, unit) => `<label class="f"><span>${label}: <b id="vL_${k}">${f(L[k], 0)} ${unit}</b></span><input type="range" data-lv="${k}" min="${a}" max="${b}" step="1" value="${L[k]}" aria-label="${label}"></label>`;
    $('#lvView').innerHTML = `<div class="card pl"><p class="rdout warn" style="margin-top:0"><b>Arbeitsschutz:</b> Trage Handschuhe und sorge für Lüftung oder Absaugung. Harze und Härter können sensibilisieren. Mehr dazu: Arbeitsschutz im Leiterplatten-Lab.</p><h4>Lackieren (Schutzlack)</h4><p class="big">Sechs Schritte bis zur geschützten Baugruppe</p>${lvSteps(LACK, 'lack')}</div>
      <div class="card pl"><h4>Verguss (wo nötig)</h4><p class="big">Fünf Schritte bis zur vergossenen Baugruppe</p>${lvSteps(VERG, 'verguss')}</div>
      <div class="card pl"><h4>Rechner</h4><p class="big">Aushärten, Topfzeit, Mischung</p>
        <div class="cols"><div>${sl('stueck', 1, 60, 'Baugruppen je Gestell', 'Stück')}${sl('minuten', 10, 120, 'Aushärtezeit', 'min')}</div><div>${sl('topf', 10, 90, 'Topfzeit', 'min')}${sl('je', 1, 10, 'Zeit je Baugruppe vergießen', 'min')}</div></div>
        ${sl('gesamt', 20, 300, 'Angemischte Masse', 'g')}${sl('b', 5, 50, 'Härter auf 100 Teile Harz', 'Teile')}
        <div id="lvOut">${lvOut()}</div>
        <p class="hint2">Alle Werte sind Übungswerte. Die echten Zeiten, Schichtdicken und Mischungsverhältnisse stehen in der Prüfanweisung und im Datenblatt des Werkstoffs.</p></div>`;
  }
  $('#lvView').addEventListener('click', e => { const b = e.target.closest('[data-lvs]'); if (!b) return; const [k, i] = b.dataset.lvs.split('.'); S.lvStep[k] = +i; renderLv(); });
  $('#lvView').addEventListener('input', e => {
    const k = e.target.dataset && e.target.dataset.lv; if (!k) return; S.lv[k] = +e.target.value; lsSet('lv', S.lv);
    const u = { stueck: 'Stück', minuten: 'min', topf: 'min', je: 'min', gesamt: 'g', b: 'Teile' }[k], v = $('#vL_' + k); if (v) v.textContent = f(S.lv[k], 0) + ' ' + u; setHtml('lvOut', lvOut());
  });

  /* ============================================================ Aufgaben */
  const done = () => lsGet('done', {});
  const exam = () => lsGet('exam', '0') === '1';
  const AUF_PCT = 25;   // Wert einer Aufgabe, deren Lösung vor dem richtigen Lösen aufgedeckt wurde (wie drei Tipp-Stufen im Prüfmodus)
  const aufg = id => !!lsGet('auf', {})[id];
  function pctFor(id, base) {
    let b = base == null ? 100 : base;
    if (exam()) b = Math.max(0, Math.round(b * (100 - 25 * Math.min(3, lsGet('ctipps', {})[id] || 0)) / 100));
    return aufg(id) ? Math.min(b, AUF_PCT) : b;
  }
  function markSolved(id, pct) {
    const p = lsGet('prog', {}); if ((p[id] || 0) < pct) p[id] = pct; lsSet('prog', p);
    const d = done(); d[id] = true; lsSet('done', d); updateBadge(); updatePal();
  }
  function updateBadge() { const b = $('#tkBd'); if (b) b.textContent = Object.keys(done()).filter(k => TASKS.some(t => t.id === k)).length + '/' + TASKS.length; }
  const curTask = () => S.task && TASKS.find(t => t.id === S.task);
  const optT = (q, k) => (q.ask.options.find(o => o.k === k) || {}).t || k;
  function solText(q) {
    if (q.ask.type === 'num') return f(q.value, 3) + (q.ask.unit ? ' ' + q.ask.unit : '');
    if (q.ask.type === 'match') return q.ask.items.map(i => i.t + ' → ' + optT(q, q.sol[i.k])).join(' | ');
    return q.sol.map(k => optT(q, k)).join(' | ');
  }
  function qBody(q, a, r, pre) {
    const locked = r && r.ok;
    if (q.ask.type === 'multi') return `<div class="opts" role="group" aria-label="Aussagen, mehrere möglich">${q.ask.options.map(o => { const on = (a.s || []).indexOf(o.k) >= 0, st = r ? (locked ? (q.sol.indexOf(o.k) >= 0 ? 'ok' : '') : (on ? 'bad' : '')) : (on ? 'on' : ''); return `<button data-tm="${o.k}" ${locked ? 'disabled' : ''} class="${st}" aria-pressed="${on}">${on ? '☑' : '☐'} ${esc(o.t)}</button>`; }).join('')}</div>`;
    if (q.ask.type === 'match') return q.ask.items.map(i => { const v = (a.m || {})[i.k] || '', bad = r && !r.ok && v && v !== q.sol[i.k]; return `<label class="f"><span>${esc(i.t)}${bad ? ' ✗' : (r && v === q.sol[i.k] ? ' ✓' : '')}</span><select data-ts="${i.k}" ${locked ? 'disabled' : ''} aria-label="${esc(i.t)}"><option value="">Bitte wählen</option>${q.ask.options.map(o => `<option value="${o.k}"${v === o.k ? ' selected' : ''}>${esc(o.t)}</option>`).join('')}</select></label>`; }).join('');
    return `<label class="f"><span>${esc(q.ask.label)}${q.ask.unit ? ' (' + esc(q.ask.unit) + ')' : ''}</span><div class="qin"><input data-in="1" inputmode="decimal" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(a.v || '')}" ${locked ? 'disabled' : ''}><span class="u">${esc(q.ask.unit)}</span></div></label>`;
  }
  function evalQ(q, a) {
    const r = C.pruefe(q, a);
    if (!r) toast(q.ask.type === 'num' ? 'Bitte gib eine Zahl ein (mit Komma oder Punkt).' : q.ask.type === 'match' ? 'Ordne zuerst jeder Zeile eine Antwort zu.' : 'Kreuze zuerst mindestens eine Aussage an.');
    return r;
  }
  const stepsHtml = q => '<ol class="steps">' + q.expl.map(l => '<li>' + esc(l) + '</li>').join('') + '</ol>';
  const solHtml = q => `<b>Lösung:</b> ${esc(solText(q))}<br><br><b>Musterlösung mit Rechenweg:</b>${stepsHtml(q)}`;
  /* Rückmeldung nach dem Prüfen. Richtig: Lösung mit Rechenweg. Falsch: nur die Rückmeldung und der Hinweis auf den Tipp;
     beim Üben dazu der Knopf „Lösung zeigen“ (shown = Lösung ist schon aufgedeckt, sie steht dann in einem eigenen Block darunter), im Prüfmodus gibt es die Lösung erst nach dem Lösen. */
  const resBlock = (q, r, shown) => `<ul class="tl"><li class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓ Richtig: ' + esc(r.given) : '✗ Noch nicht richtig (' + esc(r.given) + ').'}</li>${q.ask.type === 'num' && q.tol > 0.011 ? `<li>ℹ Erlaubte Abweichung: ±${esc(f(q.tol, 3))} ${esc(q.ask.unit)} (wegen Rundung).</li>` : ''}</ul>` +
    (r.ok ? `<div class="rdout ok">${solHtml(q)}${r.auf ? `<span class="st" style="margin-top:8px">Gezählt: ${r.pct} %, weil die Lösung aufgedeckt war. Öffne die Aufgabe später noch einmal und löse sie ohne Lösung, dann zählt sie voll.</span>` : ''}</div>`
      : exam() ? '<div class="rdout bad">🎓 Prüfmodus: Den Lösungsweg gibt es erst, wenn die Aufgabe richtig gelöst ist. Nutze einen Tipp oder versuche es noch einmal.</div>'
        : shown ? '' : `<div class="rdout bad">Lies den Tipp (💡) oder versuche es noch einmal. Kommst du gar nicht weiter, kannst du dir die Lösung zeigen lassen. Dann zählt die Aufgabe in dieser Runde nur ${AUF_PCT} %.</div><div class="btns"><button class="btn" data-ta="sol">Lösung zeigen</button></div>`);
  /* Aufgedeckte Lösung (nur beim Üben, bis die Aufgabe richtig gelöst ist) */
  const aufBlock = (q, id) => `<div class="rdout warn" id="tkSol">${solHtml(q)}<span class="st" style="margin-top:8px">${aufg(id) ? `Lösung aufgedeckt: Löst du die Aufgabe jetzt, zählt sie ${AUF_PCT} %. Öffne sie später noch einmal und löse sie ohne Lösung, dann zählt sie voll.` : 'Lösung aufgedeckt. Diese Aufgabe hast du schon einmal voll gelöst, dein bester Wert bleibt.'}</span></div>`;
  /* Platz für den Vorlesen-Knopf (aufgabe-vorlesen.js setzt ihn erst nach dem Zeichnen direkt hinter den Auftrag): Die Karte hält die Höhe frei (.au-slot),
     solange eine Aufnahme zu erwarten ist; sobald der Knopf da ist, blendet CSS den Platzhalter aus (.au-wrap + .au-slot). So springt nichts.
     Erwartet wird der Knopf, wenn der Sprachindex die Aufnahme AU_fli_<id> mit passendem Text-Hash führt; ist der Index noch nicht geladen, bei allen Aufgaben ohne Tabelle. */
  const auKey = id => 'AU_fli_' + id;
  function auErwartet(t, q) {
    if (q.rv) return false;
    try { const A = root.SpeakAudio, T = root.Vorlesen && root.Vorlesen.Texte; if (!A || !T) return true; const e = A[auKey(t.id)]; return !!(e && e.h && e.h === T.hash(T.au(t.title, q.text))); } catch (e) { return true; }
  }
  let auT = 0;
  function auSlotWeg() { const s = $('#taskView .au-slot'); if (s && !$('#taskView .au-wrap') && s.parentNode) s.parentNode.removeChild(s); }   // nach 4 s ohne Knopf (Aufnahme fehlt oder Index nicht ladbar): Lücke schließen
  function renderTasks(top) {
    const V_ = $('#taskView'), d = done(), prog = lsGet('prog', {}), t = curTask(), n100 = TASKS.filter(x => d[x.id]).length; let h = '';
    if (t) {
      const q = S.tq, r = S.tRes && S.tRes.id === t.id ? S.tRes : null, a = S.tAns[t.id] || {};
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv" aria-label="Schwierigkeit ${t.level} von 3">${dots(t.level)}</div><p style="margin:8px 0">${esc(q.text)}</p>${auErwartet(t, q) ? '<div class="au-slot" aria-hidden="true"></div>' : ''}${q.rv ? rvTable(null, [], false) : ''}${qBody(q, a, r)}`;
      h += `<div class="btns"><button class="btn pri" data-ta="chk"${r && r.ok ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" data-ta="hint">💡 Tipp</button><button class="btn" data-ta="close">Schließen</button></div>`;
      if (exam()) h += '<p class="hint2" style="color:var(--warn)">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>';
      const shown = S.tShow === t.id && !exam() && !(r && r.ok);
      if (r) { h += resBlock(q, r, shown); if (r.ok) h += `<div class="btns"><button class="btn pri" data-ta="next">Nächste Aufgabe</button></div>`; }
      if (shown) h += aufBlock(q, t.id);
      h += `<p class="hint2">${esc(D.NOTE)}</p></div>`;
    }
    h += `<p class="hint2" style="margin:4px 0 0">${n100} von ${TASKS.length} Aufgaben gelöst. ${exam() ? '🎓 Prüfmodus ist an.' : 'Tipp: Im Prüfmodus (🎓) zählen Tipps als Abzug.'} Die Zahlen jeder Aufgabe sind fest. Zahlenaufgaben nimmst du als Rechnung, bei Zuordnungen wählst du je Zeile eine Antwort, bei Mehrfachwahl kreuzt du alle richtigen Aussagen an.</p>`;
    let last = '';
    TASKS.forEach(x => { if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; } const p = prog[x.id]; h += `<button class="row" data-t="${esc(x.id)}"><span class="dot ${d[x.id] ? 'g' : ''}">${d[x.id] ? '✓' : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${dots(x.level)}</span> · ${x.art === 'num' ? 'Rechnung' : x.art === 'match' ? 'Zuordnung' : 'Mehrfachwahl'}${p != null && p < 100 ? ' · bisher ' + p + ' %' : ''}</small></div></button>`; });
    /* Vorlesen-Knopf der offenen Aufgabe über das Neuzeichnen retten (sonst fehlt er ein Bild lang und laufendes Vorlesen bricht ab) */
    const au = t && V_.querySelector ? V_.querySelector('.au-wrap') : null, keep = au && au.dataset && au.dataset.key === auKey(t.id) ? au : null;
    V_.innerHTML = h;
    if (t) {
      const slot = V_.querySelector ? V_.querySelector('.au-slot') : null;
      if (keep && slot && slot.parentNode && slot.parentNode.insertBefore) slot.parentNode.insertBefore(keep, slot);
      clearTimeout(auT); if (slot && !keep) auT = setTimeout(auSlotWeg, 4000);
    }
    if (top !== false) $('#pgTasks').scrollTop = 0;
  }
  function checkTask(t) {
    const a = S.tAns[t.id] || {}, r0 = evalQ(S.tq, a); if (!r0) return; const auf = r0.ok && aufg(t.id), pct = r0.ok ? pctFor(t.id) : 0;
    S.tRes = { id: t.id, ok: r0.ok, given: r0.given, pct, auf };
    if (r0.ok) {
      markSolved(t.id, pct);
      if (auf) { const m = lsGet('auf', {}); delete m[t.id]; lsSet('auf', m); }   // abgegolten: das nächste Lösen ohne aufgedeckte Lösung zählt wieder voll
      const F = fx(); if (F && F.pass) try { F.pass(pct); } catch (er) {} else ding();
      toast(pct < 100 ? pct + (auf && pct === AUF_PCT ? ' % (Lösung war aufgedeckt)' : ' % (Tipps abgezogen)') : '🎉 Geschafft!');
    } else { sad(); toast('Noch nicht richtig. Lies den Tipp oder versuche es noch einmal.'); }
    renderTasks(false);
  }
  /* Lösung zeigen: nur beim Üben und erst nach einer falschen Antwort. Der Merker auf[id] wird nur gesetzt, solange die Aufgabe noch nicht voll (100 %) gelöst ist. */
  function showSol(t) {
    if (exam() || !S.tRes || S.tRes.id !== t.id || S.tRes.ok) return;
    if ((lsGet('prog', {})[t.id] || 0) < 100) { const m = lsGet('auf', {}); m[t.id] = true; lsSet('auf', m); }
    S.tShow = t.id; renderTasks(false);   // die Lösung erscheint an der Stelle des Knopfs, es muss nichts verschoben werden
  }
  /* Tipps in 3 Stufen: 1 Denkanstoß, 2 Formel, 3 erster Rechenschritt */
  function hintFor(q, id) {
    const h = lsGet('hints', {}), n = Math.min(3, (h[id] || 0) + 1), ex = exam(); h[id] = Math.max(h[id] || 0, n); lsSet('hints', h);
    if (ex) { const c = lsGet('ctipps', {}); c[id] = Math.max(c[id] || 0, n); lsSet('ctipps', c); }
    sheet('Tipp, Stufe ' + n + ' von 3', b => {
      const lab = ['Denkanstoß', 'Formel', 'Erster Schritt']; let x = '';
      for (let i = 0; i < n; i++) x += `<p${i ? '' : ' style="margin-top:0"'}><b>Stufe ${i + 1} (${lab[i]}):</b> ${esc(q.tips[i])}</p>`;
      x += n >= 3 ? '<p class="hint2">Mehr Tipps gibt es nicht. ' + (ex ? 'Den Lösungsweg siehst du, wenn die Aufgabe richtig gelöst ist.' : 'Nach einer falschen Antwort kannst du dir die Lösung zeigen lassen.') + '</p>' : '<p class="hint2">Noch mehr Hilfe? Tippe noch einmal auf „Tipp“.</p>';
      x += ex ? '<p class="hint2" style="color:var(--warn)">Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>' : '<p class="hint2">Beim normalen Üben kosten Tipps nichts. Im Prüfmodus (🎓) zählen sie.</p>';
      b.innerHTML = x;
    });
  }
  function startTask(id) {
    const t = TASKS.find(x => x.id === id); if (!t) return;
    S.task = id; S.tq = D.makeTask(t); S.tAns = {}; S.tRes = null; S.tShow = null;
    const h = lsGet('hints', {}), c = lsGet('ctipps', {}); if (h[id]) { delete h[id]; lsSet('hints', h); } if (c[id]) { delete c[id]; lsSet('ctipps', c); }
    renderTasks();
  }
  const tv = $('#taskView');
  tv.addEventListener('input', e => { const t = curTask(); if (t && e.target.dataset.in) (S.tAns[t.id] = S.tAns[t.id] || {}).v = e.target.value; });
  tv.addEventListener('keydown', e => { const t = curTask(); if (t && e.key === 'Enter' && e.target.dataset.in) { e.preventDefault(); checkTask(t); } });
  tv.addEventListener('change', e => { const t = curTask(); if (t && e.target.dataset.ts) { const a = S.tAns[t.id] = S.tAns[t.id] || {}; (a.m = a.m || {})[e.target.dataset.ts] = e.target.value; if (S.tRes && !S.tRes.ok) { S.tRes = null; renderTasks(false); } } });
  tv.addEventListener('click', e => {
    const t = curTask(), tm = e.target.closest('[data-tm]'), ta = e.target.closest('[data-ta]'), row = e.target.closest('.row[data-t]');
    if (tm && t) { const a = S.tAns[t.id] = S.tAns[t.id] || {}; a.s = a.s || []; const i = a.s.indexOf(tm.dataset.tm); if (i >= 0) a.s.splice(i, 1); else a.s.push(tm.dataset.tm); if (S.tRes && !S.tRes.ok) S.tRes = null; renderTasks(false); return; }
    if (ta && t) { const a = ta.dataset.ta; if (a === 'chk') checkTask(t); else if (a === 'hint') hintFor(S.tq, t.id); else if (a === 'sol') showSol(t); else if (a === 'close') { S.task = null; S.tRes = null; S.tShow = null; renderTasks(); } else if (a === 'next') { const i = TASKS.findIndex(x => x.id === t.id), nx = TASKS.slice(i + 1).find(x => !done()[x.id]) || TASKS[(i + 1) % TASKS.length]; startTask(nx.id); } return; }
    if (row) startTask(row.dataset.t);
  });

  /* ============================================================ Hilfe */
  function renderHelp() {
    const sec = (t, b, open) => `<details${open ? ' open' : ''}><summary>${t}</summary><div class="hb2">${b}</div></details>`;
    $('#helpView').innerHTML =
      sec('Für wen ist dieses Lab?', `<p>Das Lab ist für alle gedacht, die eine Fertigungslinie verstehen wollen: Techniker in der Weiterbildung, Studierende, Wirtschaftsingenieure und auch Azubis, die schon sicher mit Prozent und Dreisatz rechnen. Es zeigt an einer erfundenen Modell-Linie („Linie A“) mit neun Stationen, wie Takt, Engpass, Durchlaufzeit, Ausbeute, Puffer und Rückverfolgung zusammenhängen.</p><p class="rdout warn"><b>Wichtig:</b> Linie A ist ein Lernmodell. Alle Zahlen sind Übungswerte und stammen von keinem Betrieb. Zeiten, Schichtdicken, Mischungsverhältnisse und Grenzwerte stehen immer in der jeweiligen Prüfanweisung.</p>`, true) +
      sec('So arbeitest du', `<p>Im Reiter <b>Linie</b> stellst du Takt, Ausschuss, Puffer und eine Störung ein und siehst sofort den Engpass, den Durchsatz und die Gesamtausbeute. <b>Rückverfolgung</b> zeigt, wie du von einer Charge zu den betroffenen Baugruppen kommst und umgekehrt. <b>Lack und Verguss</b> erklärt beide Stationen und rechnet Aushärten, Topfzeit und Mischung. Unter <b>Aufgaben</b> findest du 28 Aufgaben mit Tipps und Lösungsweg: Rechnung, Zuordnung und Mehrfachwahl.</p><p><b>Tipps</b> gibt es in drei Stufen. Im Prüfmodus kostet jede Stufe 25 % der Punkte.</p><p><b>Lösung zeigen:</b> Nach einer falschen Antwort kannst du dir beim Üben die Lösung mit Rechenweg zeigen lassen. Dann zählt die Aufgabe in dieser Runde nur 25 %. Löst du sie später noch einmal ohne Lösung, zählt sie voll. Im Prüfmodus gibt es die Lösung erst, wenn die Aufgabe richtig gelöst ist.</p>`) +
      sec('Das Rechenmodell der Linie', `<ul><li>Jede Station hat eine Taktzeit t (Sekunden je Stück) und eine Ausbeute y im ersten Durchlauf.</li><li>Kapazität = 3600 / t Stück je Stunde. Die Taktzeit je Station ist hier ihre Zykluszeit. „Takt“ im engen Sinn ist der Kundentakt (verfügbare Zeit geteilt durch Bedarf).</li><li>Eine Station sieht nur die Stücke, die alle Stationen davor bestanden haben (Produkt der Ausbeuten davor).</li><li>Start-Rate = kleinster Wert aus Kapazität geteilt durch dieses Produkt. Diese Station ist der <b>Engpass</b>.</li><li>Gutstücke je Stunde = Start-Rate mal Gesamtausbeute (Rolled Throughput Yield).</li><li>Durchlaufzeit = Summe der Takte plus Puffer mal Takt des Engpasses. Bestand = Durchsatz mal Durchlaufzeit (Gesetz von Little). Die Summe der Takte ist bei Öfen und Gestellen vereinfacht, denn dort ist die Verweilzeit länger. Little rechnet mit der Start-Rate und ist deshalb eine obere Abschätzung.</li><li>Ausschuss einer Station gilt als dort erkannt: Das Stück verlässt den Fluss an dieser Station.</li><li>Eine Störung wirkt nur dann abgefedert, wenn der Puffer vor dem Engpass liegt. Hinter dem Engpass gibt es im Modell keinen Puffer.</li></ul><p>Das Modell ist bewusst einfach: keine Streuung der Taktzeiten, keine Nacharbeitsschleifen, ein Puffer vor dem Engpass.</p>`) +
      sec('Wichtige Regeln auf einen Blick', `<table><tr><th>Thema</th><th>Merksatz</th></tr><tr><td>Engpass</td><td>Die langsamste Station bestimmt den Durchsatz. Schneller machen lohnt nur dort.</td></tr><tr><td>Ausschuss</td><td>Vor dem Engpass kostet er Material und die Arbeit der Stationen davor, danach zusätzlich Engpasszeit.</td></tr><tr><td>Little</td><td>Bestand = Durchsatz mal Durchlaufzeit.</td></tr><tr><td>Puffer</td><td>Schützt den Engpass vor Störungen davor, verlängert aber die Durchlaufzeit und kann Probleme verdecken.</td></tr><tr><td>Ausbeute</td><td>Gesamtausbeute = Produkt der Einzelausbeuten. Der größte Hebel liegt bei der schwächsten Station.</td></tr><tr><td>Rückverfolgung</td><td>Charge (Los), Verpackungs-Kennung (Gebinde), Seriennummer (Stück) nicht vermischen.</td></tr><tr><td>Lackieren</td><td>Sauber, trocken, maskiert, in Fenster-Schicht aufgetragen, abgelüftet, ausgehärtet, geprüft.</td></tr><tr><td>Verguss</td><td>Verhältnis und Topfzeit beachten, blasenarm füllen, in Ruhe aushärten.</td></tr></table>`) +
      sec('Was nicht enthalten ist', `<p>Nicht enthalten sind Prüfanweisungen, Rezepte, Grenzwerte, Normen, Messwerte aus einem Betrieb und die Beschreibung bestimmter Maschinen. Fehlerbilder und ihre Ursachen stehen im Leiterplatten-Lab, Reiter Fehlerbild.</p>`) +
      `<p class="hint2">Alle Rechenergebnisse der Aufgaben kommen aus dem Rechenkern und werden im Test mit einem unabhängigen zweiten Rechenweg verglichen.</p>`;
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  const RENDER = { li: renderLi, rv: renderRv, lv: renderLv, tasks: renderTasks, help: renderHelp };
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'li'; S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    RENDER[t]();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'Linien-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = 'Linien-Lab: ' + T[2];
  }
  let rzT = 0, lastW = 0;
  window.addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(() => { const w = window.innerWidth; if (w === lastW) return; lastW = w; if (S.tab === 'li') updateLi(); }, 120); });
  /* Rückmelde- und Weiter-Leiste (feedback.js, weiter.js: #fbStrip, #wtBar, fest am unteren Fensterrand) immer über der Bedienleiste #pal halten.
     Die beiden Skripte suchen die Bedienleiste am unteren Fensterrand; ist die Seite ein Stück weitergeschoben (unter dem Lab steht der Urheber-Hinweis), finden sie sie nicht
     und die Leisten lägen auf #pal. Darum misst das Lab die Oberkante von #pal selbst und gibt sie als --flidock an das CSS (flilab.html, mit !important gegen die Inline-Werte).
     --flifb: Höhe der Rückmeldezeile plus 8 px, wenn die Weiter-Leiste darüber stapelt (am Handy teilen sich beide eine Zeile, wenn eine nächste Aufgabe angeboten wird). */
  let dockT = 0;
  function dock() {
    clearTimeout(dockT);
    try {
      const pal = $('#pal'), fb = document.getElementById('fbStrip'), wt = document.getElementById('wtBar'), st = document.documentElement.style;
      if (!pal || !pal.getBoundingClientRect || (!fb && !wt)) return;
      const vh = window.innerHeight, d = Math.max(0, Math.min(Math.round(vh - pal.getBoundingClientRect().top), Math.round(vh * 0.6)));
      const schmal = !!(window.matchMedia && window.matchMedia('(max-width:640px)').matches), stapel = fb && wt && !(schmal && wt.getAttribute('data-art') === 'a');
      st.setProperty('--flidock', d + 'px'); st.setProperty('--flifb', (stapel ? Math.ceil(fb.getBoundingClientRect().height) + 8 : 0) + 'px');
      dockT = setTimeout(dock, 400);   // solange eine Leiste steht: Höhe der Rückmeldezeile kann sich ändern („Danke“)
    } catch (e) {}
  }
  try {
    if (typeof MutationObserver === 'function' && document.body && document.documentElement) {
      new MutationObserver(dock).observe(document.body, { childList: true });
      window.addEventListener('scroll', dock, { passive: true }); window.addEventListener('resize', dock);
    }
  } catch (e) {}
  function setExam(on) { lsSet('exam', on ? '1' : '0'); if (on) S.tShow = null; palSig = ''; updatePal(); toast(on ? '🎓 Prüfmodus an: Tipps kosten 25 % je Stufe.' : 'Prüfmodus aus: Tipps kosten nichts.'); if (S.tab === 'tasks') renderTasks(false); }
  let palSig = '';
  function updatePal() {
    const F = !!fx(), fxOn = F && !fx().isMuted(), n = Object.keys(done()).filter(k => TASKS.some(t => t.id === k)).length, sig = [F, fxOn, exam(), n].join('|'); if (sig === palSig) return; palSig = sig;
    $('#pal').innerHTML = `${F ? `<button class="chip ${fxOn ? 'on' : ''}" data-a="fx" aria-pressed="${fxOn}" title="Effekte und Ton">${fxOn ? '🎉' : '🔇'} Effekte</button>` : ''}<button class="chip ${exam() ? 'on' : ''}" data-a="exam" aria-pressed="${exam()}" title="Prüfmodus: Tipps zählen als Abzug">🎓 Prüfmodus</button><button class="chip" data-a="rand" title="Nächste offene Aufgabe">🎲 Zufallsaufgabe</button>
      <span id="stat">Aufgaben gelöst <b>${n}/${TASKS.length}</b></span>`;
    $('#bExam').classList.toggle('on', exam()); $('#bExam').setAttribute('aria-pressed', exam());
  }
  $('#pal').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.a === 'fx') { const F = fx(); if (F) { F.setMuted(!F.isMuted()); palSig = ''; updatePal(); if (!F.isMuted()) ding(); } }
    else if (b.dataset.a === 'exam') setExam(!exam());
    else if (b.dataset.a === 'rand') { const open = TASKS.filter(x => !done()[x.id]), pool = open.length ? open : TASKS; setTab('tasks'); startTask(pool[Math.floor(Math.random() * pool.length)].id); }
  });
  $('#bTasks').onclick = () => setTab('tasks'); $('#bHelp').onclick = () => setTab('help'); $('#bExam').onclick = () => setExam(!exam());
  $('#title').onclick = () => setTab('li');
  $('#bMenu').onclick = () => {
    const rows = [['li', 'Linie', 'Takt, Engpass, Puffer, Ausschuss und Störung mit Reglern'], ['rv', 'Rückverfolgung', 'Von der Charge zu den Baugruppen und zurück'], ['lv', 'Lack und Verguss', 'Schritte und Rechner für Aushärten, Topfzeit, Mischung'], ['tasks', 'Aufgaben', '28 Aufgaben mit Tipps und Lösungsweg'], ['help', 'Hilfe', 'Rechenmodell und Merksätze'], ['exam', 'Prüfmodus ' + (exam() ? 'ausschalten' : 'einschalten'), 'Im Prüfmodus kosten Tipps Punkte'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben dieses Labs auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
    sheet('Menü', (b, close) => {
      b.innerHTML = rows.map(r => `<button class="row" data-m="${r[0]}"><div class="grow"><b>${esc(r[1])}</b><small>${esc(r[2])}</small></div></button>`).join('');
      b.addEventListener('click', e => { const r = e.target.closest('.row'); if (!r) return; close(); const m = r.dataset.m; if (m === 'home') location.href = 'index.html'; else if (m === 'exam') setExam(!exam()); else if (m === 'reset') resetAll(); else setTab(m); });
    });
  };
  function resetAll() {
    sheet('Fortschritt zurücksetzen?', (b, close) => {
      b.innerHTML = '<p style="margin-top:0">Alle gelösten Aufgaben und Tipps dieses Labs werden auf diesem Gerät gelöscht. Das kann nicht rückgängig gemacht werden.</p><div class="btns"><button class="btn" data-x="no">Abbrechen</button><button class="btn danger" data-x="yes">Löschen</button></div>';
      b.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (!x) return; if (x.dataset.x === 'yes') { ['done', 'prog', 'hints', 'ctipps', 'auf'].forEach(k => { try { localStorage.removeItem(LS + k); } catch (er) {} }); S.task = null; S.tRes = null; S.tShow = null; palSig = ''; updatePal(); updateBadge(); if (S.tab === 'tasks') renderTasks(); toast('Fortschritt gelöscht'); } close(); });
    });
  }

  /* Schnittstelle für Karriere/Lernpfad */
  root.FLI_LAB = { id: 'fli', title: 'Linien-Lab', stufe: 'studium', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.FLI_TASKS };

  buildTabs(); updatePal(); lastW = window.innerWidth; setTab(TABS.some(x => x[0] === S.tab) ? S.tab : 'li');
  root.LabGoto = id => { try { if (TASKS.some(t => t.id === id)) { setTab('tasks'); startTask(id); return true; } } catch (e) {} return false; };
  try { const qt = new URLSearchParams(location.search).get('tab'); if (qt && TABS.some(x => x[0] === qt)) setTab(qt); } catch (e) {}   // flilab.html?tab=rv öffnet den Reiter (Suche der Startseite)
  try { const qa = new URLSearchParams(location.search).get('aufgabe'); if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); } } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
