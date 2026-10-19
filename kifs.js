'use strict';
/* KI-Führerschein (Modul der App-Werkstatt): sechs kurze Lektionen zum sicheren Umgang mit KI.
   Inhalt (LESSONS), Auswertung (status) und Oberfläche (mount). Fortschritt in S.answers.kf = { l1: { ... }, ... }.
   Die Regeln der letzten Lektion kommen aus apps/ki-regeln.json (vom Ausbilder anpassbar), mit eingebautem Entwurf als Rückfall. */
(function (root) {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const Q = (q, o, r, w) => ({ type: 'q', q, o, r, w });
  const AMP = { r: ['🔴', 'Rot', 'Nicht eingeben'], y: ['🟡', 'Gelb', 'Erst fragen oder Persönliches entfernen'], g: ['🟢', 'Grün', 'Unbedenklich'] };

  const REGELN = {
    "titel": "Deine Regeln für die eigene KI",
    "stand": "Vorschlag des Labs. Der Ausbilder kann den Text in apps/ki-regeln.json anpassen.",
    "punkte": [
      "Du nutzt deine eigene KI und bist selbst dafür verantwortlich, was du eingibst.",
      "Kundendaten und Betriebsinterna gehören nicht dir. Sie bleiben aus Eingaben heraus, bei jedem Dienst.",
      "Schau in die Einstellungen deines Dienstes (Chatverlauf, Nutzung der Eingaben zum Verbessern) und nutze ihn nur, wenn du die Bedingungen und Altersgrenzen erfüllst.",
      "Hilfe durch eine KI kennzeichnest du, und du musst erklären können, was du abgibst.",
      "Bei Prüfungen und benoteten Arbeiten nutzt du KI nur, wenn es ausdrücklich erlaubt ist.",
      "Bei Unsicherheit gilt: erst fragen, dann eingeben."
    ]
  };

  const LESSONS = [
    { id: 'l1', icon: '📤', t: 'Wohin gehen deine Eingaben?',
      text: '<p>Wenn du etwas in eine KI tippst, schickst du es über das Internet an einen Anbieter. Dort liegt es auf fremden Servern. Je nach Dienst und Einstellung kann es gespeichert werden und zur Verbesserung des Dienstes dienen. Genau weißt du das meist nicht.</p><ul><li>Ob und wann etwas wirklich gelöscht ist, entscheidet der Anbieter, nicht du.</li><li>In den Einstellungen gibt es oft Schalter, die die Nutzung deiner Eingaben begrenzen. Schau nach, aber verlass dich nicht allein darauf.</li><li><b>Merksatz: Schreib nur, was auch auf einer Postkarte stehen dürfte.</b></li></ul>',
      items: [
        Q('Wohin gehen deine Eingaben?', ['Nur an dein Tablet', 'An Server eines Anbieters im Internet', 'An deine Berufsschule'], 1, 'Die Eingabe wird über das Internet an den Anbieter geschickt und dort verarbeitet.'),
        Q('Du löschst einen Chat. Was nimmst du am besten an?', ['Alles ist sofort überall gelöscht', 'Du weißt nicht sicher, was der Anbieter noch speichert', 'Der Anbieter hat den Chat nie gesehen'], 1, 'Der Anbieter entscheidet, was gespeichert bleibt. Deshalb gehört Privates gar nicht erst hinein.'),
        Q('Welcher Merksatz passt?', ['Was ich eintippe, bleibt auf meinem Gerät', 'Schreib nur, was auch auf einer Postkarte stehen dürfte', 'Kostenlose Dienste sind immer privat'], 1, 'Eine Postkarte kann jeder lesen. Mit Eingaben an eine KI ist es ähnlich.')
      ] },
    { id: 'l2', icon: '🚦', t: 'Die Daten-Ampel',
      text: '<p>Sortiere jede Eingabe in <b>Rot</b> (nicht eingeben), <b>Gelb</b> (erst fragen oder Persönliches entfernen) oder <b>Grün</b> (unbedenklich). Du siehst sofort, ob es stimmt.</p>',
      items: [{ type: 'ampel', rows: [
        { t: 'Die Formel für das Ohmsche Gesetz', r: 'g', w: 'Allgemeines Fachwissen, kein Personenbezug.' },
        { t: 'Name und Adresse eines Kunden von Tonfunk', r: 'r', w: 'Kundendaten gehören nie in eine KI-Eingabe.' },
        { t: 'Dein WLAN- oder Kontopasswort', r: 'r', w: 'Passwörter gibst du nirgends weiter, auch keiner KI.' },
        { t: 'Foto vom Gesicht eines Mitschülers', r: 'r', w: 'Fotos von Personen sind persönliche Daten, und du darfst sie nicht ohne Erlaubnis weitergeben.' },
        { t: 'Interne Schaltpläne oder Preislisten der Firma', r: 'r', w: 'Betriebsinterna sind vertraulich.' },
        { t: 'Dein Zeugnis mit Noten und Namen', r: 'r', w: 'Das sind sehr persönliche Daten.' },
        { t: 'Dein Berichtsheft mit Namen und Betrieb', r: 'y', w: 'Erst Namen und Betrieb entfernen oder fragen, dann ist der Rest meist unbedenklich.' },
        { t: 'Ein Foto deiner Schaltung auf dem Tisch, ohne Personen im Bild', r: 'y', w: 'Nur senden, wenn auf dem Bild nichts Persönliches oder Betriebliches zu sehen ist.' },
        { t: 'Ein Mailtext des Ausbilders, in dem Namen vorkommen', r: 'y', w: 'Namen und Zusammenhänge entfernen, bevor du den Text weitergibst.' },
        { t: 'Eine Rechenaufgabe aus dem Schulbuch', r: 'g', w: 'Allgemeine Aufgabe ohne Personen- oder Firmenbezug.' },
        { t: 'Die Frage, wie ein Transistor als Schalter arbeitet', r: 'g', w: 'Reine Fachfrage.' },
        { t: 'Eine Fehlerbeschreibung deiner Übungsschaltung ohne Namen', r: 'g', w: 'Solange keine Namen oder Firmendaten drinstehen, ist das unbedenklich.' }
      ] }] },
    { id: 'l3', icon: '⬛', t: 'Schwärzen üben',
      text: '<p>Vor dem Absenden entfernst du alles Persönliche. Tippe im folgenden Text alle Stellen an, die <b>nicht</b> an eine KI gehören. Stellen, die nur Technik beschreiben, bleiben stehen. Dann tippe auf „Prüfen“.</p>',
      items: [{ type: 'redact', segs: [
        'Hallo, ich bin ', { t: 'Lena Schmidt', h: 1, w: 'Name' }, ' (Telefon ', { t: '0172 5551234', h: 1, w: 'Telefonnummer' }, ') und arbeite bei ', { t: 'Tonfunk in Ermsleben', h: 1, w: 'Betrieb' },
        '. Mein Kunde ', { t: 'Herr Weber, Musterstraße 5', h: 1, w: 'Name und Adresse eines Kunden' }, ', hat eine Steuerung, die um ', { t: '22:15 Uhr', h: 0, w: 'Zeitangabe zum Fehler, nur Technik' }, ' ausfällt. Die Anlage läuft mit ',
        { t: '24 V', h: 0, w: 'Technischer Wert' }, ' und die Sicherung ', { t: 'F2', h: 0, w: 'Technische Angabe' }, ' löst aus. Meine Schulmail ist ', { t: 'lena.schmidt@schule.example', h: 1, w: 'E-Mail-Adresse' },
        ' und mein Passwort ist ', { t: 'Sommer2026!', h: 1, w: 'Passwort' }, '. Was kann die Ursache sein?'
      ] }] },
    { id: 'l4', icon: '🔎', t: 'Der KI nicht blind glauben',
      text: '<p>Eine KI klingt sicher, auch wenn sie sich irrt. Sie erzeugt Text, der passend klingt. Ob er stimmt, weißt du erst nach der Prüfung. <b>Zahlen rechnest du nach, Normen und Grenzwerte liest du in der Quelle nach</b> (Norm, Datenblatt, Lehrbuch). Eine zweite KI ist keine Quelle.</p>',
      items: [
        Q('Die KI schreibt: „Bei 24 V und 6 Ω fließen 144 A.“ Was tust du?', ['Glauben, die KI hat gerechnet', 'Nachrechnen: I = U / R = 4 A, die KI irrt', 'Noch einmal fragen und die häufigere Antwort nehmen'], 1, 'Nachrechnen entlarvt den Fehler sofort. 24 V / 6 Ω = 4 A.'),
        Q('Die KI nennt einen Grenzwert aus einer Norm. Woher weißt du, ob er stimmt?', ['Er klingt genau, also stimmt er', 'Ich lese ihn in der Norm oder einer verlässlichen Quelle nach', 'Eine zweite KI zu fragen reicht immer'], 1, 'Eine zweite KI kann denselben Fehler machen. Nur die Quelle zählt.'),
        Q('Warum sind falsche KI-Antworten so gefährlich?', ['Sie sind meist an der Schrift zu erkennen', 'Sie klingen oft genauso überzeugend wie richtige', 'Sie kommen nur bei schweren Themen vor'], 1, 'Die Form verrät den Fehler nicht, deshalb musst du den Inhalt prüfen.')
      ] },
    { id: 'l5', icon: '🛡', t: 'Nachrichten und Code prüfen',
      text: '<p>Nachrichten, Links und Programme können gefälscht sein oder Schaden anrichten. Auch Code, den eine KI liefert, kann Unerwünschtes tun. Die Vorschau der App-Werkstatt ist abgeschottet, dein Handy oder ein Firmenrechner ist es nicht.</p><ul><li>Gib auf Druck („sofort!“) nichts ein, prüfe den Absender auf anderem Weg.</li><li>Installiere nichts, nur weil es verlangt wird.</li><li>Fremden Code zuerst nur abgeschottet starten.</li></ul>',
      items: [
        Q('Per Chat kommt: „Dein Konto wird gesperrt. Klicke sofort den Link und gib dein Passwort ein.“ Was tust du?', ['Link öffnen und das Passwort eingeben', 'Nichts eingeben, den Absender auf anderem Weg prüfen oder den Ausbilder fragen', 'Den Link an Freunde weiterleiten'], 1, 'Zeitdruck und Passwortabfrage sind typische Merkmale von Betrug.'),
        Q('Ein Programm verlangt, etwas zu installieren und Administratorrechte zu bekommen. Was ist richtig?', ['Installieren, die KI weiß es besser', 'Nicht installieren, eine kleine Lern-App braucht das nicht', 'Alles erlauben, damit es schneller geht'], 1, 'Eine einzelne HTML-Datei läuft ohne Installation. Wer mehr verlangt, will mehr, als nötig ist.'),
        Q('Wo startest du Code, den du nicht selbst geschrieben hast, zuerst?', ['Auf dem Rechner mit allen Daten', 'In einer abgeschotteten Vorschau wie in der App-Werkstatt', 'Direkt im Firmennetz'], 1, 'Die abgeschottete Vorschau hat keinen Zugriff auf deine Daten und kein Internet.')
      ] },
    { id: 'l6', icon: '📋', t: 'Deine Regeln für die eigene KI', rules: true,
      text: '<div id="kfRules" class="mute">Regeln werden geladen …</div>',
      items: [
        Q('Du bist unsicher, ob du etwas in die KI eingeben darfst. Was tust du?', ['Eingeben, es wird schon gehen', 'Erst nachfragen (Ausbilder), bis dahin nicht eingeben', 'Heimlich eingeben, damit es niemand merkt'], 1, 'Erst fragen, dann eingeben.'),
        Q('Du hast mit KI-Hilfe eine App gebaut. Was gilt?', ['Du musst die Hilfe nicht erwähnen', 'Du kennzeichnest die Hilfe und kannst erklären, was die App tut', 'Die KI haftet für Fehler'], 1, 'Du bleibst verantwortlich für das, was du abgibst.')
      ] }
  ];

  /* ---------------- Auswertung ---------------- */
  function itemOk(it, a) {
    if (it.type === 'q') return a != null && a === it.r;
    if (it.type === 'ampel') return it.rows.every((r, j) => a && a[j] === r.r);
    if (it.type === 'redact') { const sel = new Set((a || []).map(Number)); let ok = true, k = 0; it.segs.forEach(s => { if (typeof s === 'string') return; if (!!s.h !== sel.has(k)) ok = false; k++; }); return ok; }
    return false;
  }
  const lessonOk = (l, A) => l.items.every((it, i) => itemOk(it, (A[l.id] || {})[i]));
  function status(A) { A = A || {}; const done = LESSONS.map(l => lessonOk(l, A)); return { done, n: done.filter(Boolean).length, all: done.every(Boolean) }; }
  function solve(A) { LESSONS.forEach(l => { const s = A[l.id] = {}; l.items.forEach((it, i) => { if (it.type === 'q') s[i] = it.r; else if (it.type === 'ampel') s[i] = it.rows.map(r => r.r); else { const sel = []; let k = 0; it.segs.forEach(g => { if (typeof g !== 'string') { if (g.h) sel.push(k); k++; } }); s[i] = sel; } }); }); }

  /* ---------------- Oberfläche ---------------- */
  let curL = null, redactShown = {};
  function css() {
    if (document.getElementById('kfCss')) return; const s = document.createElement('style'); s.id = 'kfCss';
    s.textContent = '.kf-list{display:grid;gap:8px}.kf-l{display:flex;gap:10px;align-items:center;width:100%;text-align:left;padding:12px;border-radius:12px;background:var(--panel2);border:1px solid var(--line);color:var(--fg);font:inherit;cursor:pointer;min-height:48px}.kf-l .dt{margin-left:auto;font-size:18px}.kf-l.ok{border-color:rgba(76,217,100,.55)}'
      + '.kf-amp{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:8px 0;border-top:1px solid var(--line)}.kf-amp .t{flex:1 1 220px}.kf-amp .b button{min-width:44px;height:40px;border-radius:10px;border:2px solid var(--line);background:var(--panel2);color:var(--fg);font-size:18px;cursor:pointer;margin-right:4px}.kf-amp .b button.on{border-color:var(--accent)}'
      + '.kf-fb{flex-basis:100%;font-size:13px}.kf-fb.good{color:var(--ok)}.kf-fb.bad{color:var(--danger)}'
      + '.kf-txt{line-height:2.1;font-size:16px}.kf-seg{display:inline;padding:3px 5px;margin:0 1px;border-radius:6px;border:1px dashed var(--line);background:var(--panel2);color:var(--fg);font:inherit;cursor:pointer}.kf-seg.hid{background:#000;color:#000;border:1px solid #000;text-shadow:none}.kf-seg.good{outline:2px solid var(--ok)}.kf-seg.bad{outline:2px solid var(--danger)}'
      + '.kf-cert{border:2px solid var(--ok);text-align:center}.kf-cert .big{font-size:42px}';
    document.head.appendChild(s);
  }

  function mount(v, api) {
    css();
    const S = api.S, A = S.answers.kf = S.answers.kf || {}, st = status(A);
    const save = () => { api.persist(); api.stat('kifs', st.all ? 1 : 0, 'max'); };
    if (curL == null) {
      v.innerHTML = '<div class="card"><h2>KI-Führerschein</h2><p>Sechs kurze Lektionen (je etwa 5 Minuten) zum sicheren Umgang mit KI: was mit deinen Eingaben passiert, was nicht hineingehört, und wie du Antworten und fremden Code prüfst. Wenn du alle sechs geschafft hast, bekommst du den Führerschein.</p>'
        + '<div class="bar"><i style="width:' + Math.round(100 * st.n / LESSONS.length) + '%"></i></div><p class="mute small">' + st.n + ' von ' + LESSONS.length + ' Lektionen geschafft.</p></div>'
        + '<div class="card"><div class="kf-list">' + LESSONS.map((l, i) => '<button class="kf-l' + (st.done[i] ? ' ok' : '') + '" data-l="' + i + '"><span style="font-size:22px">' + l.icon + '</span><span><b>' + (i + 1) + '. ' + esc(l.t) + '</b></span><span class="dt">' + (st.done[i] ? '✓' : '›') + '</span></button>').join('') + '</div></div>'
        + (st.all ? certHtml(A, S) : '');
      v.querySelectorAll('[data-l]').forEach(b => { b.onclick = () => { curL = +b.dataset.l; api.render(); window.scrollTo(0, 0); }; });
      const nm = v.querySelector('#kfName'); if (nm) nm.oninput = () => { A.name = nm.value; save(); const c = v.querySelector('#kfWho'); if (c) c.textContent = A.name || '…'; };
      return;
    }
    const l = LESSONS[curL], LA = A[l.id] = A[l.id] || {};
    const body = l.items.map((it, i) => itemHtml(it, i, LA, l.id)).join('');
    v.innerHTML = '<div class="card"><button class="btn s" id="kfBack">← Alle Lektionen</button><h2>' + l.icon + ' ' + (curL + 1) + '. ' + esc(l.t) + '</h2>' + l.text + '</div><div class="card">' + body
      + (st.done[curL] ? '<p class="kf-fb good"><b>✓ Lektion geschafft.</b></p><div class="row">' + (curL < LESSONS.length - 1 ? '<button class="btn pri" id="kfNext">Nächste Lektion</button>' : '<button class="btn pri" id="kfBack2">Zum Führerschein</button>') + '</div>' : '') + '</div>';
    v.querySelector('#kfBack').onclick = () => { curL = null; api.render(); };
    const nx = v.querySelector('#kfNext'); if (nx) nx.onclick = () => { curL++; api.render(); window.scrollTo(0, 0); };
    const b2 = v.querySelector('#kfBack2'); if (b2) b2.onclick = () => { curL = null; api.render(); window.scrollTo(0, 0); };
    if (l.rules) fillRules(v);
    const touch = fn => { const was = status(A).all; fn(); save(); const now = status(A); if (!was && now.all) { A.date = new Date().toLocaleDateString('de-DE'); save(); api.toast('KI-Führerschein bestanden!'); } api.render(); };
    v.querySelectorAll('[data-q]').forEach(b => { b.onclick = () => touch(() => { LA[b.dataset.i] = +b.dataset.q; }); });
    v.querySelectorAll('[data-am]').forEach(b => { b.onclick = () => touch(() => { const i = b.dataset.i; if (!Array.isArray(LA[i])) LA[i] = []; LA[i][+b.dataset.am] = b.dataset.c; }); });
    v.querySelectorAll('[data-sg]').forEach(b => { b.onclick = () => { const i = b.dataset.i; const sel = new Set((LA[i] || []).map(Number)), k = +b.dataset.sg; sel.has(k) ? sel.delete(k) : sel.add(k); LA[i] = [...sel]; redactShown[l.id + i] = false; api.persist(); api.render(); }; });
    v.querySelectorAll('[data-rc]').forEach(b => { b.onclick = () => { const i = b.dataset.rc; redactShown[l.id + i] = true; touch(() => {}); }; });
  }

  function itemHtml(it, i, LA, lid) {
    if (it.type === 'q') {
      const a = LA[i], ok = a === it.r;
      return '<div class="qz"><b>' + (i + 1) + '. ' + esc(it.q) + '</b>' + it.o.map((o, k) => '<button class="btn" style="display:block;width:100%;text-align:left;margin:4px 0;' + (a === k ? (ok ? 'border-color:var(--ok)' : 'border-color:var(--danger)') : '') + '" data-q="' + k + '" data-i="' + i + '">' + esc(o) + '</button>').join('')
        + (a != null ? '<div class="kf-fb ' + (ok ? 'good' : 'bad') + '">' + (ok ? '✓ Richtig. ' : '✗ Nicht ganz, versuche es noch einmal. ') + (ok ? esc(it.w) : '') + '</div>' : '') + '</div>';
    }
    if (it.type === 'ampel') {
      const a = Array.isArray(LA[i]) ? LA[i] : [];
      return it.rows.map((r, j) => '<div class="kf-amp"><div class="t">' + esc(r.t) + '</div><div class="b">' + ['r', 'y', 'g'].map(c => '<button class="' + (a[j] === c ? 'on' : '') + '" data-am="' + j + '" data-c="' + c + '" data-i="' + i + '" title="' + AMP[c][1] + '" aria-label="' + AMP[c][1] + '">' + AMP[c][0] + '</button>').join('') + '</div>'
        + (a[j] ? '<div class="kf-fb ' + (a[j] === r.r ? 'good' : 'bad') + '">' + (a[j] === r.r ? '✓ ' + esc(r.w) : '✗ Überlege noch einmal, was passiert, wenn das beim Anbieter landet.') + '</div>' : '') + '</div>').join('');
    }
    const sel = new Set((LA[i] || []).map(Number)), shown = !!redactShown[lid + i]; let k = 0, h = '<div class="kf-txt">';
    it.segs.forEach(s => { if (typeof s === 'string') { h += esc(s); return; } const on = sel.has(k), cl = 'kf-seg' + (on ? ' hid' : '') + (shown ? (!!s.h === on ? ' good' : ' bad') : ''); h += '<button class="' + cl + '" data-sg="' + k + '" data-i="' + i + '">' + esc(s.t) + '</button>'; k++; });
    h += '</div><div class="row" style="margin-top:10px"><button class="btn pri" data-rc="' + i + '">Prüfen</button></div>';
    if (shown) { k = 0; const miss = [], over = []; it.segs.forEach(s => { if (typeof s === 'string') return; const on = sel.has(k++); if (s.h && !on) miss.push(s.w); else if (!s.h && on) over.push(s.t); }); h += '<div class="kf-fb ' + (!miss.length && !over.length ? 'good' : 'bad') + '">' + (!miss.length && !over.length ? '✓ Alles Persönliche ist geschwärzt, die Technik steht noch da.' : (miss.length ? '✗ Noch sichtbar: ' + esc([...new Set(miss)].join(', ')) + '. ' : '') + (over.length ? '✗ Zu viel geschwärzt (reine Technik): ' + esc(over.join(', ')) + '.' : '')) + '</div>'; }
    return h;
  }

  function certHtml(A, S) {
    return '<div class="card kf-cert"><div class="big">🪪</div><h2>KI-Führerschein</h2><p><b id="kfWho">' + esc(A.name || '…') + '</b> kennt die Regeln für den sicheren Umgang mit KI.</p><p class="mute small">Bestanden am ' + esc(A.date || new Date().toLocaleDateString('de-DE')) + ' · Tonfunk Lab, App-Werkstatt</p>'
      + '<label style="display:block;max-width:320px;margin:0 auto 8px;text-align:left">Dein Name<input id="kfName" value="' + esc(A.name || '') + '" placeholder="Vorname Nachname"></label><p class="mute small">Zeige den Bildschirm deinem Ausbilder oder mache einen Screenshot.</p></div>';
  }

  function fillRules(v) {
    const draw = R => { const e = v.querySelector('#kfRules'); if (!e) return; e.className = ''; e.innerHTML = '<h3>' + esc(R.titel || REGELN.titel) + '</h3><ul>' + (R.punkte || REGELN.punkte).map(p => '<li>' + esc(p) + '</li>').join('') + '</ul><p class="mute small">' + esc(R.stand || '') + '</p>'; };
    draw(REGELN);
    try { fetch('apps/ki-regeln.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).then(j => { if (j && Array.isArray(j.punkte)) draw(j); }).catch(() => {}); } catch (e) {}
  }

  root.KIFS = { LESSONS, REGELN, status, solve, mount, reset: () => { curL = null; redactShown = {}; } };
})(window);
