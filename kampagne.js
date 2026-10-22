'use strict';
/* Tonfunk Lab: Kampagne „Das Abschlussgerät“. Ein Lernpfad mit Geschichte über alle Labs: neun Kapitel mit Missionen.
   Der Fortschritt wird aus den vorhandenen Ergebnissen gelesen (sim.done, lm4.tdone, lm4.stats, lm4.trainer), es gibt keinen eigenen Speicher
   außer der Liste abgeschlossener Kapitel (lm4.kamp) für die Feier. Missionen führen per Link in das passende Lab. */
(function (root) {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const REG = root.LAB_REG || {}, PAGE = {}, LABN = {};
  ['sch', 'sim', 'code', 'pi', 'loch'].forEach(k => { PAGE[k] = { sch: 'schaltplan.html', sim: 'simlab.html', code: 'codelab.html', pi: 'pilab.html', loch: 'layout.html' }[k]; LABN[k] = { sch: 'SchaltLab', sim: 'SimLab', code: 'Arduino-Lab', pi: 'Pi-Lab', loch: 'LochLab' }[k]; });
  Object.keys(REG).forEach(k => { PAGE[k] = REG[k].file; LABN[k] = REG[k].name; });
  const T = (lab, id) => ({ k: 'task', lab, id });
  const CH = [
    { t: 'Willkommen in der Lehrwerkstatt', s: 'Dein erster Tag. Meister Funk drückt dir einen Lötkolben und einen Zettel in die Hand: „Erst die Werkstatt kennenlernen, dann wird gebaut. Fang mit den beiden Trainern an.“', m: [{ k: 'trainer', lab: 'sch' }, { k: 'trainer', lab: 'loch' }, T('sch', 's6')] },
    { t: 'Die Notleuchte', s: 'Im Keller fällt dauernd das Licht aus. Meister Funk will eine LED-Notleuchte: „Aber bitte so, dass sie nicht gleich verglüht.“', m: [T('sch', 's2'), T('sch', 's1'), T('sch', 'det1')] },
    { t: 'Messen, bevor man rät', s: 'Die Notleuchte flackert. „Raten kostet Zeit“, sagt Meister Funk, „messen kostet Sekunden.“ Zeit, das Multimeter und das Oszilloskop zu beherrschen.', m: [{ k: 'multi', keys: ['mmV', 'mmAC', 'mmA', 'mmR'], t: 'Multimeter: Gleichspannung, Wechselspannung, Strom und Widerstand je einmal richtig messen', where: 'SchaltLab ▸ Simulation ▸ Messen', lab: 'sch' }, { k: 'stat', key: 'oszi', min: 3, t: 'Oszilloskop-Trainer: drei Ableseaufgaben richtig', open: 'oszi' }, T('sch', 's8')] },
    { t: 'Licht nur im Dunkeln', s: 'Der Hof soll abends von allein hell werden. „Ein Fotowiderstand, ein Transistor, fertig“, sagt Meister Funk. „Und wenn es nicht geht: Fehler suchen.“', m: [T('sch', 's3'), T('sch', 's13'), T('sch', 'sf1')] },
    { t: 'Strom aus der Steckdose', s: 'Das Hoflicht braucht Gleichspannung. Meister Funk legt einen Trafo auf den Tisch: „Aus Wechselspannung mach Gleichspannung. Erst klein, dann ein richtiges Netzteil.“', m: [T('sch', 's5'), T('sch', 's11'), T('sch', 's19')] },
    { t: 'Im Haus', s: 'Ein Außeneinsatz: Ein Treppenhaus soll sicher beleuchtet werden. „Hier gibt es Sicherungsautomaten und kein Spielzeug“, sagt Meister Funk. „Schutzleiter nicht vergessen.“', m: [T('sim', 'aus'), T('sim', 'wechsel'), T('sim', 'impuls')] },
    { t: 'Löten und Aufbauen', s: 'Jetzt wird es ernst: echte Platinen. „Ein guter Plan ist die halbe Miete, eine gute Lötstelle die andere Hälfte.“', m: [{ k: 'stat', key: 'loetOK', min: 6, t: 'Lötübung: sechs gute Lötstellen sammeln', open: 'loet' }, T('loch', 'l15'), T('loch', 'l17')] },
    { t: 'Digitale Welt', s: 'Die Hoflampe soll gesteuert werden: nicht mehr mit Widerständen, sondern mit Einsen und Nullen. „Ohne Digitaltechnik läuft heute nichts“, sagt Meister Funk. „Fang bei den Gattern an und hör bei der kleinen CPU noch lange nicht auf.“', m: [{ k: 'trainer', lab: 'digi' }, T('digi', 'd1'), T('digi', 'd6'), T('digi', 'd13'), { k: 'stat', key: 'zahl', min: 3, t: 'Zahlenumrechner: drei Übungsaufgaben richtig', open: 'zahl' }, T('digi', 'dc1')] },
    { t: 'Messen wie ein Profi', s: 'Meister Funk legt ein Oszilloskop auf deine Werkbank: „Wer nicht messen kann, der baut nur Zufall.“ Jetzt lernst du, jedes Messgerät richtig anzuschließen, abzulesen und auch seinen Fehlern auf die Spur zu kommen.', m: [{ k: 'trainer', lab: 'mess' }, T('mess', 'm1'), T('mess', 'm8'), T('mess', 'm9'), T('mess', 'm15'), T('mess', 'm16')] },
    { t: 'Das eigene Haus', s: 'Meister Funk breitet einen Bauplan aus: „Ein Haus, ein Verteiler, zwanzig Leitungen. Und alles muss sicher sein.“ Du planst die Stromkreise, ziehst die Leitungen und bestückst den Verteilerkasten.', m: [{ k: 'trainer', lab: 'haus' }, T('haus', 'ha1'), T('haus', 'ha3'), T('haus', 'ha4'), T('haus', 'ha6'), T('haus', 'ha13')] },
    { t: 'Die eigene Lernapp', s: 'Meister Funk legt dir ein iPad hin: „Das Wissen steckt in euren Köpfen. Baut euch Werkzeuge, mit denen ihr es üben und weitergeben könnt. Eine KI hilft euch dabei, aber sie ersetzt das Prüfen nicht.“', m: [{ k: 'trainer', lab: 'app' }, T('app', 'ap18'), T('app', 'ap1'), T('app', 'ap2'), T('app', 'ap4'), T('app', 'ap7'), T('app', 'ap11')] },
    { t: 'Die Abschlussprüfung', s: 'Meister Funk legt dir einen Prüfungsbogen hin: „Bald ist es so weit. Üb die Themen, rechne sauber und zeig, was du kannst. Eine Probeprüfung zeigt dir, wo du stehst.“', m: [{ k: 'trainer', lab: 'pr' }, T('pr', 'pr1'), T('pr', 'pr2'), T('pr', 'pr9'), T('pr', 'pr10')] },
    { t: 'Die Anlage steht still', s: 'Im Hof steht eine Fördertechnik, ein Tank und ein Garagentor, und keine Steuerung läuft. Meister Funk drückt dir ein Tablet in die Hand: „Eine SPS ist nur so klug wie ihr Programm. Fang mit der Selbsthaltung an, dann kommen Zeit und Schrittketten. Und wenn es raucht: Fehler suchen.“', m: [{ k: 'trainer', lab: 'sps' }, T('sps', 'sp1'), T('sps', 'sp2'), T('sps', 'sp5'), T('sps', 'sp8'), T('sps', 'sp15'), T('sps', 'sp17'), T('sps', 'sp20')] },
    { t: 'Die Platine', s: 'Die Steuerung soll auf eine eigene Leiterplatte. Meister Funk legt dir einen Schaltplan hin: „Ein Schaltplan ist noch kein Gerät. Erst muss die Platine entworfen, gefertigt, bestückt und geprüft werden. Und wenn sie nicht läuft: messen, nicht raten.“', m: [{ k: 'trainer', lab: 'pcb' }, T('pcb', 'pb1'), T('pcb', 'pb5'), T('pcb', 'pb11'), T('pcb', 'pb16'), T('pcb', 'pb26'), T('pcb', 'pb30'), T('pcb', 'pb33'), T('pcb', 'pb39')] },
    { t: 'Der Antrieb', s: 'Die Anlage soll sich bewegen: Förderband, Tor, Lüfter. Meister Funk führt dich an die Prüfstände: „Ein Motor ist kein Zauberkasten. Du musst wissen, was Spannung, Strom, Drehzahl und Moment miteinander zu tun haben. Und eine H-Brücke verzeiht keinen Kurzschluss.“', m: [{ k: 'trainer', lab: 'ant' }, T('ant', 'an1'), T('ant', 'an6'), T('ant', 'an7'), T('ant', 'an10'), T('ant', 'an16'), T('ant', 'an19'), T('ant', 'an22'), T('ant', 'an25')] },
    { t: 'Die Messkette', s: 'Die Anlage soll wissen, was los ist: Temperatur, Druck, Kraft, Lage. Meister Funk legt dir ein Datenblatt hin: „Ein Sensor liefert nur eine Spannung oder einen Strom. Erst die Messkette macht daraus einen Wert, dem man trauen kann. Und jede Stufe darf einen Fehler machen.“', m: [{ k: 'trainer', lab: 'sen' }, T('sen', 'se1'), T('sen', 'se3'), T('sen', 'se5'), T('sen', 'se9'), T('sen', 'se13'), T('sen', 'se19'), T('sen', 'se21'), T('sen', 'se24')] },
    { t: 'Das Datenblatt', s: 'Ein Bauteil ist ausgefallen und niemand weiß warum. Meister Funk legt dir ein dickes Datenblatt hin: „Alles steht drin, man muss es nur lesen können. Grenzwerte sind keine Betriebswerte, und eine Zahl ohne Testbedingung ist nur eine Zahl. Und ein bisschen Englisch schadet auch nicht.“', m: [{ k: 'trainer', lab: 'ds' }, T('ds', 'ds1'), T('ds', 'ds3'), T('ds', 'ds8'), T('ds', 'ds12'), T('ds', 'ds18'), T('ds', 'ds20'), T('ds', 'ds27'), T('ds', 'ds33')] },
    { t: 'Der Regelkreis', s: 'Die Anlage soll von allein auf dem Sollwert bleiben: der Füllstand im Tank, die Temperatur im Raum, die Drehzahl am Motor. Meister Funk zeigt dir einen Schreiber: „Messen allein reicht nicht, ein Regler muss auch handeln. Zu zaghaft ist er langsam, zu scharf fängt der Kreis an zu schwingen. Erst die Strecke vermessen, dann den Regler einstellen, und nie im Blindflug.“', m: [{ k: 'trainer', lab: 'reg' }, T('reg', 'rg3'), T('reg', 'rg9'), T('reg', 'rg11'), T('reg', 'rg13'), T('reg', 'rg19'), T('reg', 'rg30')] },
    { t: 'Die Wärme', s: 'Das Netzteil der Anlage läuft, aber der Regler ist so heiß, dass man ihn nicht anfassen kann. Meister Funk hält vorsichtig die Hand darüber: „Jedes Watt, das nicht ankommt, wird zu Wärme. Die muss raus, sonst raucht es. Erst die Verlustleistung rechnen, dann den Kühlkörper wählen, und die Wärmeleitpaste nicht vergessen.“', m: [{ k: 'trainer', lab: 'thm' }, T('thm', 'th4'), T('thm', 'th9'), T('thm', 'th15'), T('thm', 'th19'), T('thm', 'th25'), T('thm', 'th30')] },
    { t: 'Die Steuerung', s: 'Die Anlage soll programmierbar werden. „Ein Arduino für die Logik, ein Raspberry Pi für die Zentrale“, sagt Meister Funk. „Fangt mit dem Einfachsten an: Blinken.“', m: [T('code', 'c1'), T('code', 'c2'), T('pi', 'p1'), T('pi', 'p2')] },
    { t: 'Das Abschlussgerät', s: 'Letzter Auftrag: ein Dämmerungsschalter mit Relais für die Hoflampe, geplant, gebaut und geprüft. „Zeig, was du kannst. Und prüfe deine Lötstellen mit der Lupe.“', m: [T('sch', 's18'), T('loch', 'l16'), { k: 'stat', key: 'lupePerfekt', min: 1, t: 'Lupen-Prüfung ohne Fehler (Qualitätskontrolle)', open: 'loet' }] },
    { t: 'Epilog: Das Verbundprojekt', epilog: true, s: 'Meister Funk breitet fünf Aufträge aus: „Bisher hast du jedes Lab einzeln gelernt. In der Firma arbeitet alles zusammen: vom Datenblatt über Schaltplan, Platine und Messung bis zur Steuerung. Such dir ein Projekt aus, jede Station liefert ihr Ergebnis an die nächste. Am Ende gibt es einen Gesamttest und ein Zertifikat.“', m: [{ k: 'verbund', pid: 'garage', t: 'Projekt Garagentor abschließen', open: 'vb' }, { k: 'stat', key: 'vbfertig', min: 2, t: 'Zwei Verbundprojekte abgeschlossen', open: 'vb' }, { k: 'stat', key: 'vbfertig', min: 5, t: 'Alle fünf Verbundprojekte', open: 'vb' }] }
  ];
  const MAIN = CH.filter(c => !c.epilog);   // Hauptkampagne: der Epilog gehört nicht zum Abzeichen „Abschlussgerät“
  const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(d)); } catch (e) { return d; } };
  const results = () => { const m = {}; [get('sim.done', {}), get('lm4.tdone', {})].forEach(o => Object.keys(o).forEach(k => { const v = +o[k] || 0; if (v > (m[k] || 0)) m[k] = v; })); return m; };
  const title = id => { const r = (root.AUFGABEN || []).find(a => a[0] === id); return r ? r[3] : id; };
  function mdone(m) {
    if (m.k === 'task') return (results()[m.id] || 0) >= 100;
    if (m.k === 'trainer') return !!get('lm4.trainer', {})[m.lab];
    if (m.k === 'stat') return (get('lm4.stats', {})[m.key] || 0) >= m.min;
    if (m.k === 'multi') { const st = get('lm4.stats', {}); return m.keys.every(k => (st[k] || 0) >= 1); }
    if (m.k === 'verbund') {   // Projekt abgeschlossen: Gesamttest bestanden (Verbund geladen), sonst der Zähler des Kerns
      try { const V = root.Verbund, s = V && V.state && V.state(m.pid) ? V.status(m.pid) : null; if (s) return s.finalState === 'passed'; } catch (e) {}
      return (get('lm4.stats', {})['vb' + m.pid] || 0) >= 1;
    }
    return false;
  }
  const mtitle = m => m.t || (m.k === 'task' ? title(m.id) + ' (' + LABN[m.lab] + ')' : m.k === 'trainer' ? 'Trainer „Erste Schritte“ im ' + LABN[m.lab] : '');
  const prog = c => { const d = c.m.filter(mdone).length; return { d, n: c.m.length }; };
  const free = () => { try { return localStorage.getItem('lm4.kamp.free') === '1'; } catch (e) { return false; } };
  const unlocked = i => free() || i === 0 || (() => { const p = prog(CH[i - 1]); return p.d >= Math.ceil(p.n * 2 / 3); })();
  const cdone = i => { const p = prog(CH[i]); return p.d === p.n; };
  /* abgeschlossene Kapitel feiern (einmalig) */
  function check(silent) {
    const k = get('lm4.kamp', { done: [] }); let fresh = [];
    const OLD = ['Willkommen in der Lehrwerkstatt', 'Die Notleuchte', 'Messen, bevor man rät', 'Licht nur im Dunkeln', 'Strom aus der Steckdose', 'Im Haus', 'Löten und Aufbauen', 'Die Steuerung', 'Digitale Welt', 'Messen wie ein Profi', 'Das eigene Haus', 'Das Abschlussgerät'];
    k.done = k.done.map(x => (typeof x === 'number' ? OLD[x] : x)).filter(Boolean);      // früher nach Nummer gespeichert
    CH.forEach((c, i) => { if (cdone(i) && !k.done.includes(c.t)) { k.done.push(c.t); fresh.push(i); } });
    if (!fresh.length) return;
    try { localStorage.setItem('lm4.kamp', JSON.stringify(k)); } catch (e) {}
    if (root.Badges) { root.Badges.stat('kapitel', k.done.length, 'max'); if (MAIN.every(c => k.done.includes(c.t))) root.Badges.stat('kampagne', 1, 'max'); if (!silent) { root.Badges.confetti(fresh.some(i => i >= MAIN.length - 1)); root.Badges.chime(false); } }
    if (!silent && root.LabUI && root.LabUI.toast) root.LabUI.toast('🎯 ' + (CH[fresh[0]].epilog ? '' : 'Kapitel ' + (fresh[0] + 1) + ' ') + 'geschafft: ' + CH[fresh[0]].t);
  }
  function go(m) {
    const close = () => { const b = document.getElementById('kampBox'); if (b) b.remove(); };
    const here = root.LabTrainerAPI && root.LabTrainerAPI.lab;
    if (m.k === 'task') { location.href = PAGE[m.lab] + '?aufgabe=' + m.id; return; }
    if (m.k === 'trainer') { if (here === m.lab && root.Trainer) { close(); root.Trainer.start(); } else location.href = PAGE[m.lab] + '?trainer'; return; }
    if (m.k === 'stat' && m.open === 'oszi' && root.Oszi) { close(); root.Oszi.open(); return; }
    if (m.k === 'stat' && m.open === 'zahl') { if (here === 'digi' && root.DIGI) { close(); root.DIGI.openConv(); } else location.href = PAGE.digi + '?zahl'; return; }
    if (m.k === 'stat' && m.open === 'loet' && root.Loetuebung) { close(); root.Loetuebung.open(); return; }
    if (m.k === 'verbund') { location.href = PAGE.vb + '?projekt=' + encodeURIComponent(m.pid); return; }
    if (m.k === 'stat' && m.open === 'vb') { location.href = PAGE.vb || 'verbund.html'; return; }
    if (m.k === 'multi') { if (here === 'sch') { close(); if (root.LabUI && root.LabUI.toast) root.LabUI.toast('Simulation einschalten und unten „Messen“ wählen'); } else location.href = PAGE.sch + '?ex=Spannungsteiler'; return; }
  }
  function open() {
    if (document.getElementById('kampBox')) return; check(true);
    const w = document.createElement('div'); w.id = 'kampBox';
    w.style.cssText = 'position:fixed;inset:0;z-index:90;background:rgba(0,0,0,.62);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:calc(12px + env(safe-area-inset-top)) 12px calc(12px + env(safe-area-inset-bottom));-webkit-overflow-scrolling:touch';
    let first = CH.findIndex((c, i) => unlocked(i) && !cdone(i)); if (first < 0) first = CH.length - 1;
    const render = () => {
      const tot = CH.reduce((s, c) => s + c.m.length, 0), dn = CH.reduce((s, c) => s + prog(c).d, 0);
      w.innerHTML = `<div style="background:#1f262e;color:#e8eaed;border:1px solid #38424d;border-radius:14px;padding:16px;max-width:680px;width:100%;font:15px/1.45 system-ui,sans-serif">
        <div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:19px">🎯 Kampagne: Das Abschlussgerät</b><button id="kX" style="background:none;border:0;color:#e8eaed;font-size:22px;cursor:pointer" aria-label="Schließen">✕</button></div>
        <p style="color:#9aa6b2;margin:6px 0">${MAIN.length} Kapitel, ein Ziel: Du baust mit Meister Funk ein Abschlussgerät. Danach wartet der Epilog mit den Verbundprojekten. Die Missionen sind Aufgaben und Übungen aus allen Labs. Dein Fortschritt zählt von selbst mit.</p>
        <div style="background:#10151a;border-radius:8px;height:12px;overflow:hidden;margin:8px 0"><div style="width:${Math.round(100 * dn / tot)}%;height:100%;background:#5ee27d"></div></div><div style="font-size:13px;color:#9aa6b2;margin-bottom:8px">${dn} von ${tot} Missionen erledigt</div>
        ${CH.map((c, i) => { const p = prog(c), un = unlocked(i), dd = cdone(i), op = i === first; return `<div style="border:1px solid ${dd ? '#2f7a45' : '#38424d'};border-radius:10px;margin:8px 0;background:#252d36;opacity:${un ? 1 : .55}"><button data-c="${i}" style="all:unset;display:flex;width:100%;box-sizing:border-box;padding:10px 12px;cursor:${un ? 'pointer' : 'default'};align-items:center;gap:8px"><span style="font-size:20px">${dd ? '✅' : un ? '▶️' : '🔒'}</span><b style="flex:1">${c.epilog ? '' : 'Kapitel ' + (i + 1) + ': '}${esc(c.t)}</b><span style="font-size:13px;color:#9aa6b2">${p.d}/${p.n}</span></button>${op && un ? `<div style="padding:0 12px 12px"><p style="margin:0 0 8px;font-style:italic;color:#c8d2dc">${esc(c.s)}</p>${c.m.map((m, j) => { const ok = mdone(m); return `<div style="display:flex;gap:8px;align-items:center;margin:6px 0"><span>${ok ? '✅' : '⬜'}</span><span style="flex:1;font-size:14px">${esc(mtitle(m))}${m.where ? '<br><span style="color:#6cb8ff;font-size:12px">' + esc(m.where) + '</span>' : ''}</span>${ok ? '' : `<button data-m="${i}.${j}" style="background:#ff9d00;border:0;border-radius:8px;padding:7px 12px;font-weight:700;cursor:pointer">Los</button>`}</div>`; }).join('')}</div>` : ''}</div>`; }).join('')}
        <label style="display:flex;gap:8px;align-items:center;margin-top:10px;font-size:13px;color:#9aa6b2"><input type="checkbox" id="kFree"${free() ? ' checked' : ''}> Alle Kapitel freischalten (für Ausbilder oder zum Stöbern)</label></div>`;
      w.querySelector('#kX').onclick = () => w.remove();
      w.querySelector('#kFree').onchange = e => { try { localStorage.setItem('lm4.kamp.free', e.target.checked ? '1' : '0'); } catch (x) {} render(); };
      w.querySelectorAll('[data-c]').forEach(b => { b.onclick = () => { const i = +b.dataset.c; if (!unlocked(i)) return; first = first === i ? -1 : i; render(); }; });
      w.querySelectorAll('[data-m]').forEach(b => { b.onclick = () => { const [i, j] = b.dataset.m.split('.').map(Number); go(CH[i].m[j]); }; });
    };
    document.body.appendChild(w); render();
    w.addEventListener('pointerdown', e => { if (e.target === w) w.remove(); });
  }
  /* Startseite: Hinweiskarte unter den Lab-Karten */
  function indexCard() {
    const cards = document.querySelector('.cards'); if (!cards || document.getElementById('kampCard')) return;
    const tot = CH.reduce((n, c) => n + c.m.length, 0), dn = CH.reduce((n, c) => n + prog(c).d, 0);
    const c = document.createElement('div'); c.id = 'kampCard';
    c.style.cssText = 'margin:14px auto;max-width:900px;padding:14px 16px;border-radius:14px;border:1px solid #ff9d00;background:rgba(255,157,0,.08);display:flex;gap:12px;align-items:center;flex-wrap:wrap';
    c.innerHTML = '<span style="font-size:28px">🎯</span><div style="flex:1;min-width:200px"><b>Kampagne: Das Abschlussgerät</b><br><span style="opacity:.8;font-size:14px">' + CH.length + ' Kapitel mit Meister Funk durch alle Labs. ' + dn + ' von ' + tot + ' Missionen erledigt.</span></div><button style="background:#ff9d00;border:0;border-radius:10px;padding:10px 16px;font-weight:700;cursor:pointer">' + (dn ? 'Weitermachen' : 'Los geht’s') + '</button>';
    c.querySelector('button').onclick = open; cards.parentNode.insertBefore(c, cards.nextSibling);
  }
  if (document.body) indexCard(); else document.addEventListener('DOMContentLoaded', indexCard);
  root.Kampagne = { open, check, CH, mdone, prog, results };
  if (/[?&]kampagne\b/.test(location.search)) setTimeout(() => { const g = document.getElementById('gate'); if (g && g.offsetParent !== null) { const t = setInterval(() => { const gg = document.getElementById('gate'); if (!gg || gg.offsetParent === null) { clearInterval(t); open(); } }, 500); } else open(); }, 1200);
  else setTimeout(() => check(false), 5000);
})(typeof window !== 'undefined' ? window : globalThis);
