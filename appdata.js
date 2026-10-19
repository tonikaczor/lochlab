'use strict';
/* Tonfunk App-Werkstatt: Aufgaben, Musterapps und Fallbeispiele.
   appwerk.js ruft APP_DATA(W) auf (W = Werkzeuge: Zustand, Sandbox, Notizen, Bibliothek). Jede Aufgabe hat eine Prüfung (check, asynchron) und eine
   Musterlösung (sol), mit der selftest.html die Prüfung testet. Aufgabenformat für mkaufg.py: { id: 'x', lab: 'app', cat: '…', title: '…', level: n */
(function (root) {
  root.APP_DATA = function (W) {
    const RES = W.RES;

    /* ---------------- Musterapps (jeweils eine einzige HTML-Datei, ohne Internet) ---------------- */
    const page = (title, body, script, css) => '<!doctype html>\n<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + title + '</title>\n<style>body{font-family:system-ui,sans-serif;margin:0;padding:16px;background:#f4f6f9;color:#1b2230}h1{font-size:22px;margin:0 0 10px}button{font-size:17px;padding:10px 16px;margin:4px;border-radius:10px;border:0;background:#2b7de9;color:#fff}input{font-size:18px;padding:8px;width:120px;margin:4px;border-radius:8px;border:1px solid #9aa6b5}.box{background:#fff;border-radius:14px;padding:14px;margin:10px 0;box-shadow:0 1px 4px rgba(0,0,0,.15)}' + (css || '') + '</style></head><body>\n' + body + '\n<script>' + script + '<\/script></body></html>';
    const SAMPLES = {
      hallo: page('Zähler', '<h1>Mein erster Zähler</h1><div class="box"><p>Du hast <b id="n">0</b> Mal gedrückt.</p><button id="b">Drücken</button></div>', 'var n=0;document.getElementById("b").onclick=function(){n++;document.getElementById("n").textContent=n;};'),
      quiz: page('Quiz Elektrotechnik', '<h1>Quiz: Elektrotechnik</h1><div class="box"><p id="q"></p><div id="a"></div><p id="r"></p></div><p id="s"></p>',
        'var Q=[["Wie heißt die Einheit der Spannung?",["Volt","Ampere","Ohm"],0],["Wie heißt die Einheit des Widerstands?",["Watt","Ohm","Volt"],1],["Welche Größe misst man in Ampere?",["Strom","Spannung","Leistung"],0],["Wie viel Volt hat die Steckdose in Deutschland?",["110","230","400"],1],["Was schützt Menschen vor Fehlerströmen?",["FI","Relais","Diode"],0],["Wie nennt man die Formel U = R · I?",["Ohmsches Gesetz","Kirchhoff","Faraday"],0],["Welche Einheit hat die Leistung?",["Watt","Joule","Henry"],0],["Wie viele Phasen hat Drehstrom?",["eine","zwei","drei"],2],["Welche Ader ist der Schutzleiter?",["blau","grün-gelb","braun"],1],["Was begrenzt den Strom einer LED?",["Vorwiderstand","Kondensator","Spule"],0]];var i=0,p=0;function show(){if(i>=Q.length){document.getElementById("q").textContent="Fertig!";document.getElementById("a").innerHTML="";document.getElementById("s").textContent=p+" von "+Q.length+" richtig";return;}document.getElementById("q").textContent=(i+1)+". "+Q[i][0];var h="";Q[i][1].forEach(function(t,k){h+=\'<button data-k="\'+k+\'">\'+t+"</button>";});document.getElementById("a").innerHTML=h;document.getElementById("r").textContent="";var bs=document.querySelectorAll("#a button");for(var j=0;j<bs.length;j++){bs[j].onclick=function(){var k=+this.getAttribute("data-k");if(k===Q[i][2]){p++;document.getElementById("r").textContent="Richtig!";}else{document.getElementById("r").textContent="Leider falsch.";}i++;setTimeout(show,600);};}}show();'),
      ohm: page('Ohm-Rechner', '<h1>Ohm-Rechner</h1><div class="box">Spannung U in V: <input id="u" type="number"><br>Widerstand R in Ω: <input id="r" type="number"><br><button id="b">Berechnen</button><p>Strom I = <b id="i">-</b> A</p></div>',
        'document.getElementById("b").onclick=function(){var u=parseFloat(document.getElementById("u").value),r=parseFloat(document.getElementById("r").value);document.getElementById("i").textContent=(u/r).toFixed(2).replace(".",",");};'),
      farbcode: page('Farbcode-Trainer', '<h1>Widerstands-Farbcode</h1><div class="box"><p>Welche Zahl gehört zur Farbe?</p><p id="f" style="font-size:26px"></p><div id="z"></div><p id="r"></p></div>',
        'var C=[["schwarz",0],["braun",1],["rot",2],["orange",3],["gelb",4],["grün",5],["blau",6],["violett",7],["grau",8],["weiß",9]];var cur=0;function neu(){cur=Math.floor(Math.random()*10);document.getElementById("f").textContent=C[cur][0];var h="";for(var k=0;k<10;k++)h+=\'<button data-k="\'+k+\'">\'+k+"</button>";document.getElementById("z").innerHTML=h;var bs=document.querySelectorAll("#z button");for(var j=0;j<bs.length;j++){bs[j].onclick=function(){document.getElementById("r").textContent=(+this.getAttribute("data-k")===C[cur][1])?"Richtig!":"Falsch, es ist "+C[cur][1];setTimeout(neu,900);};}}neu();'),
      spannungsfall: page('Spannungsfall-Rechner', '<h1>Spannungsfall</h1><div class="box">Strom I in A: <input id="i" type="number"><br>Länge einfach in m: <input id="l" type="number"><br>Querschnitt in mm²: <input id="a" type="number"><br>Netzspannung in V: <input id="n" type="number"><br><button id="b">Berechnen</button><p>ΔU = <b id="du">-</b> V, das sind <b id="p">-</b> %</p></div>',
        'document.getElementById("b").onclick=function(){var i=+document.getElementById("i").value,l=+document.getElementById("l").value,a=+document.getElementById("a").value,n=+document.getElementById("n").value;var du=2*i*0.0178*l/a;document.getElementById("du").textContent=du.toFixed(2).replace(".",",");document.getElementById("p").textContent=(du/n*100).toFixed(1).replace(".",",");};'),
      fehlerhaft: page('Leistungsrechner', '<h1>Leistungsrechner</h1><div class="box">Spannung U in V: <input id="u" type="number"><br>Strom I in A: <input id="i" type="number"><br><button id="b">Berechnen</button><p>Leistung P = <b id="p">-</b> W</p></div>',
        'document.getElementById("b").onclick=function(){var u=parseFloat(document.getElementById("u").value),i=parseFloat(document.getElementById("i").value);document.getElementById("p").textContent=(u+i);};')
    };
    const kartenApp = titles => page('Karteikarten', '<h1>Karteikarten</h1><div class="box"><p id="k" style="font-size:22px"></p><button id="w">Umdrehen</button><button id="n">Nächste</button><p id="a"></p></div>',
      'var K=' + JSON.stringify(titles.map(t => [t, 'Das steht in deiner Notiz zu ' + t + '.'])) + ';var i=0;function z(){document.getElementById("k").textContent=K[i][0];document.getElementById("a").textContent="";}document.getElementById("w").onclick=function(){document.getElementById("a").textContent=K[i][1];};document.getElementById("n").onclick=function(){i=(i+1)%K.length;z();};z();');

    /* ---------------- Fallbeispiele ---------------- */
    const BAD_PROMPT = 'mach mir ne app für elektro';
    const KI_TEXT = [
      ['Die Einheit der elektrischen Spannung ist das Volt.', true],
      ['Bei einer Reihenschaltung ist die Spannung überall gleich groß, der Strom teilt sich auf.', false],
      ['Der FI-Schutzschalter löst bei einem Fehlerstrom von 30 mA aus.', true],
      ['Eine Leitung mit 1,5 mm² darf grundsätzlich mit einem B32-Automaten abgesichert werden.', false],
      ['Die elektrische Leistung berechnet man mit P = U · I.', true],
      ['Der Schutzleiter ist an der Farbe Blau zu erkennen.', false]
    ];
    const DATA_Q = [
      { q: 'Darf ich in der Eingabe an die KI den Namen und die Adresse eines Kunden schreiben?', o: ['Ja, damit die KI genau passt', 'Nein, persönliche Daten gehören nicht in KI-Eingaben', 'Nur wenn der Kunde zustimmt und ich es nicht merke'], r: 1 },
      { q: 'Die KI schreibt eine Normangabe in meine App. Was tue ich?', o: ['Ich übernehme sie, die KI weiß das', 'Ich prüfe sie in einer verlässlichen Quelle', 'Ich frage dieselbe KI noch einmal und glaube ihr'], r: 1 },
      { q: 'Ich bekomme eine fremde App als Code. Was ist sinnvoll?', o: ['Sofort auf dem Firmenrechner starten', 'Nur in der abgeschotteten Vorschau ausprobieren', 'An alle weiterschicken'], r: 1 },
      { q: 'Muss ich angeben, dass ein Text oder Code von einer KI stammt?', o: ['Nie', 'Wenn es verlangt wird oder ich es als eigene Arbeit abgebe: ja, ehrlich benennen', 'Nur bei Prüfungen'], r: 1 },
      { q: 'Eine App fragt nach einem Passwort und sendet es ins Internet. Was ist das?', o: ['Normal', 'Ein Warnzeichen: Passwörter gehören nirgends in fremde Apps', 'Eine Funktion von Browsern'], r: 1 }
    ];
    const KIQ = { wrong: [1, 3, 5] };
    const notesSol = [
      ['Ohmsches Gesetz', 'Das Ohmsche Gesetz verbindet Spannung, Strom und Widerstand: U = R · I. Siehe auch [[Leistung]] und [[Reihenschaltung]].\n#grundlagen'],
      ['Leistung', 'Die Leistung ist P = U · I. Sie hängt mit dem [[Ohmsches Gesetz]] zusammen und bestimmt den Strom im [[Stromkreis]].\n#grundlagen'],
      ['Reihenschaltung', 'In der Reihenschaltung fließt überall derselbe Strom, die Spannungen addieren sich. Vergleiche [[Parallelschaltung]].\n#schaltungen'],
      ['Parallelschaltung', 'In der Parallelschaltung liegt an allen Zweigen dieselbe Spannung, die Ströme addieren sich. Gegenstück zur [[Reihenschaltung]].\n#schaltungen'],
      ['Stromkreis', 'Ein Stromkreis besteht aus Quelle, Verbraucher und Leitung. Er braucht Schutz durch [[Sicherung]] und [[Ohmsches Gesetz]] hilft beim Rechnen.\n#grundlagen'],
      ['Sicherung', 'Ein Sicherungsautomat schützt Leitung und Verbraucher vor Überlast. Der Nennstrom richtet sich nach dem [[Stromkreis]].\n#schutz']
    ].map((n, i) => ({ id: 'sol' + i, title: n[0], text: n[1], t: 0 }));

    /* ---------------- Aufgaben ---------------- */
    const run = (html, steps) => W.runApp(html, steps || []);
    const okApp = (f, L) => { const errs = f.errors.length ? f.errors[0] : ''; L.push(RES(!errs, errs ? 'Die App meldet einen Fehler: ' + errs : 'Die App startet ohne Fehlermeldung', 'Kopiere die Fehlermeldung in deine nächste Eingabe an die KI und bitte um eine korrigierte, vollständige Datei.')); L.push(RES(!f.ext.length, f.ext.length ? 'Die App will etwas aus dem Internet laden (' + f.ext[0] + ')' : 'Die App läuft ohne Internet', 'Bitte die KI: „Eine einzige HTML-Datei, ohne externe Bibliotheken und ohne Internet.“')); };
    const needCode = () => (W.S.code && W.S.code.trim().length > 30) ? null : [RES(false, 'In der Werkstatt ist noch kein Code', 'Gehe in die Werkstatt, füge den Code der KI ein und starte ihn. Danach hier prüfen.')];
    const numNear = (nums, v, tol) => nums.some(x => Math.abs(x - v) <= Math.abs(v) * tol + 1e-9);
    const calcCheck = (cases, minIn) => async () => {
      const m = needCode(); if (m) return m; const L = [];
      const base = await run(W.S.code, []); okApp(base.facts, L);
      L.push(RES(base.facts.nInputs >= minIn, base.facts.nInputs >= minIn ? 'Die App hat ' + base.facts.nInputs + ' Eingabefelder' : 'Es werden mindestens ' + minIn + ' Eingabefelder erwartet (gefunden: ' + base.facts.nInputs + ')', 'Schreibe in den Auftrag, welche Größen eingegeben werden: „Eingabefelder für …“'));
      for (const c of cases) {
        const r = await run(W.S.code, [{ op: 'fill', values: c.in }, { op: 'click', match: 'rechn|berechn|ergebnis|los|ok|\\=' }, { op: 'wait', ms: 80 }, { op: 'read' }]);
        const nums = (r.reads[r.reads.length - 1] || {}).nums || [], hit = c.exp.some(e => numNear(nums, e, c.tol || 0.03));
        L.push(RES(hit, hit ? 'Eingabe ' + c.in.join(', ') + ' liefert ' + c.label : 'Eingabe ' + c.in.join(', ') + ': erwartet wird ' + c.label + ' (die App zeigt: ' + (nums.slice(0, 5).join('; ') || 'keine Zahl') + ')', c.why || 'Rechne selbst nach und vergleiche. Beschreibe der KI genau, was rauskommen müsste.'));
      }
      return L;
    };
    const promptCheck = (id, minOk, topic) => async () => {
      const t = (W.S.prompts[id] || '').trim(); if (!t) return [RES(false, 'Es ist noch kein Auftrag eingetragen')];
      const rb = W.rubric(t), n = rb.filter(c => c.ok).length, L = rb.map(c => RES(c.ok, c.label + (c.ok ? ': genannt' : ': fehlt'), c.hint));
      L.unshift(RES(n >= minOk, n + ' von ' + rb.length + ' Bausteinen im Auftrag (gefordert: mindestens ' + minOk + ')'));
      if (topic) L.push(RES(topic.re.test(t), topic.re.test(t) ? 'Das Thema „' + topic.name + '“ kommt vor' : 'Das Thema „' + topic.name + '“ fehlt im Auftrag'));
      return L;
    };
    const flagRes = (txt, ok, why) => RES(ok, txt, why);

    const TASKS = [
      { id: 'ap1', lab: 'app', cat: 'Stufe 1: Los geht’s', title: 'Erste App starten', level: 1, kind: 'app',
        text: 'Bitte eine KI (zum Beispiel Claude oder ChatGPT) um eine kleine App, etwa einen Zähler mit einem Knopf. Der Auftrag: „Schreibe eine einzige HTML-Datei, die einen Zähler mit Knopf zeigt, ohne Internet.“ Kopiere den ganzen Code in die Werkstatt und starte ihn.',
        hint: 'Im Tab „Auftrag“ gibt es fertige Vorlagen. Kopiere sie in die KI, kopiere die Antwort (den ganzen Code, vom ersten bis zum letzten Zeichen) in die Werkstatt und tippe „Starten“.',
        check: async () => { const m = needCode(); if (m) return m; const r = await run(W.S.code, []), f = r.facts, L = []; okApp(f, L); L.push(RES(f.textLen >= 20, f.textLen >= 20 ? 'Die App zeigt Text' : 'Die App zeigt noch kaum Text', 'Hast du den vollständigen Code kopiert?')); L.push(RES(f.nButtons + f.nInputs >= 1, f.nButtons + f.nInputs >= 1 ? 'Es gibt Knöpfe oder Eingabefelder' : 'Die App hat keine Knöpfe und keine Eingabefelder', 'Bitte die KI um einen Knopf, der etwas bewirkt.')); return L; },
        sol: () => { W.S.code = SAMPLES.hallo; } },
      { id: 'ap2', lab: 'app', cat: 'Stufe 1: Los geht’s', title: 'Einen guten Auftrag schreiben', level: 1, kind: 'prompt',
        text: 'Schreibe einen Auftrag an die KI für ein Quiz zum Thema Farbcode von Widerständen. Ein guter Auftrag nennt: was die App sein soll, für wen sie ist, das Thema, wie man sie bedient, die Technik (eine HTML-Datei, ohne Internet), den Umfang und wie die Antwort aussehen soll.',
        hint: 'Benutze den Baukasten im Tab „Auftrag“ oder schreibe selbst. Beispiel: „Baue ein Quiz zum Widerstands-Farbcode für Auszubildende. Zehn Fragen, große Knöpfe fürs iPad. Eine einzige HTML-Datei ohne Internet. Gib nur den vollständigen Code aus.“',
        check: promptCheck('ap2', 5, { name: 'Widerstands-Farbcode', re: /farbcode|widerstand/i }),
        sol: () => { W.S.prompts.ap2 = 'Baue eine Quiz-App zum Thema Farbcode von Widerständen für Auszubildende. Zehn Fragen, große Knöpfe fürs iPad. Liefere eine einzige HTML-Datei ohne Internet. Gib nur den vollständigen Code aus, auf Deutsch.'; } },
      { id: 'ap3', lab: 'app', cat: 'Stufe 1: Los geht’s', title: 'Einen schlechten Auftrag verbessern', level: 1, kind: 'prompt',
        text: 'Dieser Auftrag ist schlecht: „' + BAD_PROMPT + '“. Die KI weiß nicht, was für eine App, für wen, mit welchem Inhalt, auf welchem Gerät. Schreibe ihn so um, dass fast alle Bausteine (mindestens sechs von sieben) vorkommen.',
        hint: 'Entscheide dich für ein Thema (zum Beispiel Formeln der Elektrotechnik). Nenne die Art der App, die Zielgruppe, das Gerät, die Technik (eine HTML-Datei, ohne Internet), den Umfang (Zahl der Fragen oder Karten) und die Ausgabe.',
        check: promptCheck('ap3', 6),
        sol: () => { W.S.prompts.ap3 = 'Baue eine Karteikarten-App zu den wichtigsten Formeln der Elektrotechnik für Auszubildende zum Elektroniker. Fünfzehn Karten, große Knöpfe fürs iPad im Hochformat. Eine einzige HTML-Datei ohne Internet und ohne Bibliothek. Gib nur den vollständigen Code aus.'; } },
      { id: 'ap18', lab: 'app', cat: 'Stufe 1: Los geht’s', title: 'KI-Führerschein', level: 1, kind: 'kifs',
        text: 'Mache den KI-Führerschein: sechs kurze Lektionen zu Datenschutz, Prüfen von Antworten, fremdem Code und den Regeln im Betrieb. Die Lektionen findest du im Tab „KI-Führerschein“. Die Aufgabe ist geschafft, wenn alle sechs Lektionen richtig sind.',
        hint: 'Beantworte die Fragen jeder Lektion richtig. In der Daten-Ampel zeigt dir das Lab sofort, ob eine Zuordnung stimmt.',
        check: async () => { const st = root.KIFS.status(W.S.answers.kf); return root.KIFS.LESSONS.map((l, i) => RES(st.done[i], 'Lektion ' + (i + 1) + ' (' + l.t + '): ' + (st.done[i] ? 'geschafft' : 'noch offen'), 'Öffne die Lektion im Tab „KI-Führerschein“ und beantworte alle Fragen richtig.')); },
        sol: () => { W.S.answers.kf = W.S.answers.kf || {}; root.KIFS.solve(W.S.answers.kf); } },
      { id: 'ap4', lab: 'app', cat: 'Stufe 2: Lernapps bauen', title: 'Lernapp: Quiz mit zehn Fragen', level: 2, kind: 'app',
        text: 'Lass dir ein Quiz mit mindestens zehn Fragen zu einem Thema deiner Lehre bauen. Die App muss mit Knöpfen bedienbar sein und auf Antworten reagieren (zum Beispiel „Richtig“ oder „Falsch“ zeigen). Starte sie in der Werkstatt.',
        hint: 'Auftrag: „Quiz mit zehn Fragen zu …, jede Frage mit drei Antworten als Knöpfe, zeigt nach dem Tippen Richtig oder Falsch und am Ende die Punkte. Eine HTML-Datei, ohne Internet.“',
        check: async () => { const m = needCode(); if (m) return m; const L = [], r = await run(W.S.code, [{ op: 'read' }, { op: 'click', match: 'first' }, { op: 'wait', ms: 150 }, { op: 'read' }]), f = r.facts; okApp(f, L); const q = (r.reads[0] || {}).text || '', qn = (q.match(/\?/g) || []).length; L.push(RES(qn >= 1, qn >= 1 ? 'Die App zeigt Fragen' : 'Es ist keine Frage zu sehen', 'Eine Frage endet mit einem Fragezeichen. Bitte die KI um zehn Fragen.')); L.push(RES(f.textLen >= 0 && f.nButtons >= 2, f.nButtons >= 2 ? f.nButtons + ' Knöpfe zum Antworten' : 'Es werden Antwortknöpfe erwartet', 'Bitte um mehrere Antworten als Knöpfe.')); const changed = (r.reads[0] || {}).text !== (r.reads[1] || {}).text; L.push(RES(changed, changed ? 'Ein Tipp auf einen Knopf verändert die Anzeige' : 'Ein Tipp auf einen Knopf verändert nichts', 'Bitte um eine Rückmeldung „Richtig/Falsch“ nach dem Tippen.')); const total = (W.S.code.match(/\?/g) || []).length; L.push(RES(total >= 10, total >= 10 ? 'Mindestens zehn Fragen im Code' : 'Im Code stehen nur ' + total + ' Fragezeichen: es sollen mindestens zehn Fragen sein', 'Frage die KI nach „mindestens zehn Fragen“.')); return L; },
        sol: () => { W.S.code = SAMPLES.quiz; } },
      { id: 'ap5', lab: 'app', cat: 'Stufe 2: Lernapps bauen', title: 'Rechner: Ohmsches Gesetz', level: 2, kind: 'app',
        text: 'Baue mit der KI einen Rechner, der aus Spannung U und Widerstand R den Strom I berechnet. Die Prüfung gibt zwei Werte ein: U = 12 V und R = 4 Ω (I = 3 A) sowie U = 230 V und R = 50 Ω (I = 4,6 A). Die Eingabefelder müssen in der Reihenfolge U, R stehen.',
        hint: 'Auftrag: „Rechner für das Ohmsche Gesetz: Eingabefelder zuerst Spannung in V, dann Widerstand in Ω, Knopf Berechnen, zeigt den Strom in A mit zwei Nachkommastellen.“',
        check: calcCheck([{ in: [12, 4], exp: [3], label: 'I = 3 A' }, { in: [230, 50], exp: [4.6], label: 'I = 4,6 A' }], 2),
        sol: () => { W.S.code = SAMPLES.ohm; } },
      { id: 'ap6', lab: 'app', cat: 'Stufe 2: Lernapps bauen', title: 'Trainer: Widerstands-Farbcode', level: 2, kind: 'app',
        text: 'Lass dir einen Trainer für den Farbcode bauen: Die App zeigt eine Farbe, und man wählt die passende Ziffer. Alle zehn Farben (schwarz, braun, rot, orange, gelb, grün, blau, violett, grau, weiß) müssen vorkommen.',
        hint: 'Auftrag: „Trainer für die Ziffern des Widerstands-Farbcodes: Zufällige Farbe, zehn Knöpfe 0 bis 9, Rückmeldung richtig oder falsch, danach neue Farbe.“',
        check: async () => { const m = needCode(); if (m) return m; const L = [], r = await run(W.S.code, []), f = r.facts; okApp(f, L); const src = W.S.code.toLowerCase(), cols = ['schwarz', 'braun', 'rot', 'orange', 'gelb', 'grün', 'blau', 'violett', 'grau', 'weiß'].filter(c => src.includes(c)); L.push(RES(cols.length >= 9, cols.length >= 9 ? 'Alle Farben kommen vor (' + cols.length + ' von 10)' : 'Es fehlen Farben: gefunden ' + cols.length + ' von 10', 'Zähle die Farben im Auftrag einzeln auf. Wichtig: schwarz, braun, rot, orange, gelb, grün, blau, violett, grau, weiß.')); L.push(RES(f.nButtons >= 3, f.nButtons >= 3 ? f.nButtons + ' Knöpfe zum Antworten' : 'Es werden mindestens drei Knöpfe erwartet', 'Bitte um Knöpfe 0 bis 9.')); return L; },
        sol: () => { W.S.code = SAMPLES.farbcode; } },
      { id: 'ap7', lab: 'app', cat: 'Stufe 2: Lernapps bauen', title: 'KI-Antwort prüfen', level: 2, kind: 'review',
        text: 'Die KI hat eine Erklärung zur Elektrotechnik geschrieben. Drei Aussagen sind falsch. Hake die falschen Aussagen an. Das ist die wichtigste Fähigkeit im Umgang mit KI: nicht blind glauben, sondern prüfen.',
        hint: 'Gehe jede Aussage einzeln durch. Reihenschaltung: Der Strom ist gleich, die Spannung teilt sich. B32 für 1,5 mm² ist zu viel. Welche Farbe hat der Schutzleiter?',
        widget: { type: 'checks', items: KI_TEXT.map(x => x[0]) },
        check: async () => { const a = W.S.answers.ap7 || {}, sel = (a.sel || []).map(Number).sort(), want = KIQ.wrong, ok = sel.length === want.length && sel.every((v, i) => v === want[i]); const L = [RES(sel.length > 0, sel.length ? sel.length + ' Aussagen angehakt' : 'Es ist noch nichts angehakt')]; if (sel.length) { want.forEach(k => L.push(RES(sel.includes(k), sel.includes(k) ? 'Falsche Aussage erkannt: „' + KI_TEXT[k][0].slice(0, 50) + '…“' : 'Eine falsche Aussage fehlt noch', 'Lies die Aussagen noch einmal: Reihenschaltung, Leitungsschutz und Schutzleiter-Farbe.'))); sel.filter(k => !want.includes(k)).forEach(k => L.push(RES(false, 'Diese Aussage ist richtig: „' + KI_TEXT[k][0].slice(0, 50) + '…“', 'Nicht jede Aussage ist falsch. Prüfe sie gegen dein Wissen.'))); } return L; },
        sol: () => { W.S.answers.ap7 = { sel: KIQ.wrong.slice() }; } },
      { id: 'ap8', lab: 'app', cat: 'Stufe 3: Prüfen und verbessern', title: 'Rechner nachrechnen: Spannungsfall', level: 3, kind: 'app',
        text: 'Lass dir einen Rechner für den Spannungsfall bauen (ΔU = 2 · I · ρ · l / A mit ρ = 0,0178 Ωmm²/m). Eingabefelder in dieser Reihenfolge: Strom in A, einfache Länge in m, Querschnitt in mm², Netzspannung in V. Die Prüfung nimmt I = 13 A, l = 36 m, A = 4 mm², U = 230 V: Der Spannungsfall beträgt etwa 4,16 V, das sind 1,8 %. Rechne selbst nach!',
        hint: 'Gib der KI die Formel und die Reihenfolge der Felder vor. Prüfe das Ergebnis mit dem Taschenrechner: 2 · 13 · 0,0178 · 36 / 4 = 4,16.',
        check: calcCheck([{ in: [13, 36, 4, 230], exp: [4.16, 1.8], tol: 0.04, label: 'ΔU ≈ 4,16 V (1,8 %)', why: 'Prüfe die Formel: Faktor 2 für Hin- und Rückleiter, ρ = 0,0178, geteilt durch den Querschnitt.' }, { in: [10, 20, 2.5, 230], exp: [2.85, 1.2], tol: 0.04, label: 'ΔU ≈ 2,85 V (1,2 %)' }], 4),
        sol: () => { W.S.code = SAMPLES.spannungsfall; } },
      { id: 'ap9', lab: 'app', cat: 'Stufe 3: Prüfen und verbessern', title: 'Fehler in einer App finden', level: 3, kind: 'review',
        text: 'Diese App rechnet die Leistung P = U · I, hat aber einen Fehler. Tippe „Fehlerhafte App laden“, gib U = 10 V und I = 2 A ein und lies das Ergebnis ab. Trage ein, was die App zeigt, was richtig wäre und welcher Fehler vorliegt.',
        hint: 'Richtig wäre 20 W. Was rechnet die App stattdessen? Schau, ob sie addiert oder multipliziert.',
        widget: { type: 'bug' },
        check: async () => { const a = W.S.answers.ap9 || {}, L = []; const shown = W.parse(a.shown), right = W.parse(a.right); L.push(RES(shown === 12, shown === 12 ? 'Die App zeigt 12: richtig abgelesen' : 'Die App zeigt bei 10 V und 2 A einen anderen Wert. Lade die Fehlerhafte App und probiere es aus', 'Gib U = 10 und I = 2 ein und tippe Berechnen.')); L.push(RES(right === 20, right === 20 ? 'Richtig wäre 20 W' : 'P = U · I: Rechne noch einmal', 'U mal I, nicht plus.')); L.push(RES(a.bug === 'plus', a.bug === 'plus' ? 'Fehler erkannt: Die App addiert statt zu multiplizieren' : 'Welche Rechenart steckt im Fehler?', 'Vergleiche 10 + 2 mit der angezeigten Zahl.')); return L; },
        sol: () => { W.S.answers.ap9 = { shown: '12', right: '20', bug: 'plus' }; } },
      { id: 'ap10', lab: 'app', cat: 'Stufe 3: Prüfen und verbessern', title: 'Fehler an die KI melden', level: 3, kind: 'prompt',
        text: 'Schreibe eine Meldung an die KI für den Fehler aus der vorigen Aufgabe (Leistungsrechner zeigt bei 10 V und 2 A die Zahl 12). Eine gute Fehlermeldung sagt: was passiert, was erwartet wird, mit welchen Zahlen, und bittet um die vollständige korrigierte Datei.',
        hint: 'Beispiel: „Bei U = 10 und I = 2 zeigt die App 12. Erwartet wird 20, denn P = U · I. Bitte korrigiere den Fehler und gib den vollständigen Code erneut aus.“',
        check: async () => { const t = (W.S.prompts.ap10 || '').trim(); if (!t) return [RES(false, 'Es ist noch keine Meldung eingetragen')]; const c = [['Was passiert', /(zeigt|steht|ergibt|anzeige|ausgabe|rechnet|kommt)/i], ['Was erwartet wird', /(erwart|soll|müsste|sollte|richtig w)/i], ['Zahlen als Beispiel', /\d+/], ['Bitte um vollständigen Code', /(vollständig|ganzen code|komplett)/i], ['Bitte um Korrektur', /(korrigier|behebe|beheb|fix|verbesser)/i]], L = c.map(x => RES(x[1].test(t), x[0] + (x[1].test(t) ? ': genannt' : ': fehlt'))), n = L.filter(x => x.ok).length; L.unshift(RES(n >= 4 && t.length >= 50, n + ' von 5 Bausteinen (gefordert: mindestens 4, Länge mindestens 50 Zeichen)')); return L; },
        sol: () => { W.S.prompts.ap10 = 'Bei U = 10 und I = 2 zeigt die App 12 W. Erwartet wird 20 W, denn P = U · I. Bitte korrigiere den Fehler und gib den vollständigen Code erneut aus.'; } },
      { id: 'ap11', lab: 'app', cat: 'Stufe 4: Wissen sammeln', title: 'Erstes Notizbuch', level: 1, kind: 'notes',
        text: 'Lege im Tab „Notizen“ drei Notizen an (zum Beispiel Ohmsches Gesetz, Leistung, Reihenschaltung). Jede mit mindestens 40 Zeichen Text. Verknüpfe sie mit [[Doppelklammern]]: schreibe zum Beispiel [[Leistung]] in die Notiz „Ohmsches Gesetz“. Insgesamt zwei gültige Verknüpfungen.',
        hint: 'Eine Verknüpfung ist der Titel einer anderen Notiz in doppelten eckigen Klammern. Sie wird erst gültig, wenn es eine Notiz mit genau diesem Titel gibt.',
        check: async () => { const N = W.notes(), long = N.filter(n => (n.text || '').trim().length >= 40).length, valid = W.linkCount(N); return [RES(N.length >= 3, N.length >= 3 ? N.length + ' Notizen' : 'Es werden mindestens drei Notizen erwartet (jetzt ' + N.length + ')'), RES(long >= 3, long >= 3 ? 'Mindestens drei Notizen haben genug Text' : 'Mindestens drei Notizen brauchen je 40 Zeichen Text (jetzt ' + long + ')'), RES(valid >= 2, valid >= 2 ? valid + ' gültige Verknüpfungen' : 'Es werden zwei gültige Verknüpfungen erwartet (jetzt ' + valid + ')', 'Der Titel in [[ ]] muss genau zu einer vorhandenen Notiz passen.')]; },
        sol: () => { W.setNotes(notesSol.slice(0, 3)); } },
      { id: 'ap12', lab: 'app', cat: 'Stufe 4: Wissen sammeln', title: 'Wissensnetz aufbauen', level: 2, kind: 'notes',
        text: 'Baue ein Netz aus mindestens sechs Notizen mit mindestens fünf gültigen Verknüpfungen und mindestens zwei Schlagwörtern (#grundlagen). Jede Notiz muss mit einer anderen verbunden sein. Öffne die Übersichtskarte und sieh dir das Netz an.',
        hint: 'Schlagwörter schreibst du mit einem #: zum Beispiel #schutz. Eine Notiz ist verbunden, wenn sie auf eine andere verweist oder von einer anderen verlinkt wird.',
        check: async () => { const N = W.notes(), valid = W.linkCount(N), tags = W.tags(N), iso = W.isolated(N); return [RES(N.length >= 6, N.length >= 6 ? N.length + ' Notizen' : 'Es werden mindestens sechs Notizen erwartet (jetzt ' + N.length + ')'), RES(valid >= 5, valid >= 5 ? valid + ' gültige Verknüpfungen' : 'Es werden fünf gültige Verknüpfungen erwartet (jetzt ' + valid + ')'), RES(tags.length >= 2, tags.length >= 2 ? tags.length + ' Schlagwörter' : 'Es werden zwei Schlagwörter erwartet (jetzt ' + tags.length + ')', 'Schreibe zum Beispiel #grundlagen in eine Notiz.'), RES(N.length >= 6 && !iso.length, N.length >= 6 && !iso.length ? 'Jede Notiz ist verbunden' : 'Nicht verbunden: ' + (iso.slice(0, 3).join(', ') || '–'), 'Verlinke diese Notizen mit anderen.')]; },
        sol: () => { W.setNotes(notesSol); } },
      { id: 'ap13', lab: 'app', cat: 'Stufe 4: Wissen sammeln', title: 'Nach Obsidian exportieren', level: 1, kind: 'flag',
        text: 'Exportiere deine Notizen als ZIP-Datei (Tab „Notizen“, Knopf „Als ZIP für Obsidian“). Die Dateien öffnest du in der kostenlosen App Obsidian: „Ordner als Vault öffnen“. Dort siehst du dieselben Notizen mit Graphansicht.',
        hint: 'Du brauchst mindestens eine Notiz. Der Knopf erzeugt eine Datei mit einer .md-Datei je Notiz.',
        check: async () => [RES(W.notes().length >= 1, W.notes().length >= 1 ? 'Es gibt Notizen zum Exportieren' : 'Lege zuerst eine Notiz an'), RES((W.S.flags.exported || 0) >= 1, (W.S.flags.exported || 0) >= 1 ? 'Export durchgeführt' : 'Tippe im Tab „Notizen“ auf „Als ZIP für Obsidian“')],
        sol: () => { W.setNotes(notesSol.slice(0, 2)); W.S.flags.exported = 1; } },
      { id: 'ap14', lab: 'app', cat: 'Stufe 4: Wissen sammeln', title: 'Karteikarten-App aus deinen Notizen', level: 3, kind: 'app',
        text: 'Mach aus deinen Notizen eine Lernapp: Bitte die KI um eine Karteikarten-App mit mindestens drei deiner Notiztitel als Karten (Vorderseite: Titel, Rückseite: dein Text). Starte sie in der Werkstatt. Der Knopf „Notizen als Eingabe kopieren“ im Tab „Auftrag“ hilft.',
        hint: 'Kopiere deine Notizen mit dem Knopf in die Eingabe, ergänze: „Baue daraus eine Karteikarten-App als einzige HTML-Datei ohne Internet, mit Knöpfen Umdrehen und Nächste.“',
        check: async () => { const m = needCode(); if (m) return m; const N = W.notes(), L = []; if (N.length < 3) return [RES(false, 'Es werden mindestens drei Notizen erwartet (jetzt ' + N.length + ')')]; const r = await run(W.S.code, []), f = r.facts; okApp(f, L); const src = W.S.code.toLowerCase(), hit = N.filter(n => src.includes((n.title || '').toLowerCase())).length; L.push(RES(hit >= 3, hit >= 3 ? hit + ' deiner Notiztitel kommen in der App vor' : 'Nur ' + hit + ' deiner Notiztitel kommen vor (mindestens drei)', 'Gib der KI die Notiztitel und Texte mit.')); L.push(RES(f.nButtons >= 2, f.nButtons >= 2 ? f.nButtons + ' Knöpfe' : 'Es werden mindestens zwei Knöpfe erwartet (Umdrehen, Nächste)')); return L; },
        sol: () => { W.setNotes(notesSol); W.S.code = kartenApp(notesSol.map(n => n.title)); } },
      { id: 'ap15', lab: 'app', cat: 'Stufe 5: Teilen und Sicherheit', title: 'App weitergeben', level: 2, kind: 'flag',
        text: 'Gib eine App weiter: Speichere sie in der Bibliothek, erzeuge den Teilen-Code und lies ihn wieder ein (Tab „Bibliothek“: Teilen, dann „Code einlesen“). So kommen Apps von Azubi zu Azubi.',
        hint: 'Du brauchst mindestens eine gespeicherte App. „Als Code teilen“ erzeugt einen Text, „Code einlesen“ nimmt ihn wieder auf.',
        check: async () => [RES(W.lib().length >= 1, W.lib().length >= 1 ? 'Eine App ist gespeichert' : 'Speichere eine App in der Bibliothek'), RES((W.S.flags.shared || 0) >= 1, (W.S.flags.shared || 0) >= 1 ? 'Teilen-Code erzeugt' : 'Erzeuge einen Teilen-Code'), RES((W.S.flags.imported || 0) >= 1, (W.S.flags.imported || 0) >= 1 ? 'Code eingelesen' : 'Lies einen Code ein')],
        sol: () => { W.setLib([{ id: 'sol1', name: 'Zähler', html: SAMPLES.hallo, t: 0 }]); W.S.flags.shared = 1; W.S.flags.imported = 1; } },
      { id: 'ap16', lab: 'app', cat: 'Stufe 5: Teilen und Sicherheit', title: 'Datenschutz und Sicherheit', level: 1, kind: 'quiz',
        text: 'Beantworte fünf Fragen zu Datenschutz, Quellen und Sicherheit im Umgang mit KI. Alle müssen stimmen.',
        hint: 'Denke daran: Keine persönlichen Daten in Eingaben, Aussagen der KI prüfen, fremden Code nur abgeschottet starten.',
        widget: { type: 'quiz', items: DATA_Q },
        check: async () => { const a = W.S.answers.ap16 || {}, L = DATA_Q.map((q, i) => RES(a['q' + i] === q.r, a['q' + i] == null ? 'Frage ' + (i + 1) + ': keine Antwort' : (a['q' + i] === q.r ? 'Frage ' + (i + 1) + ': richtig' : 'Frage ' + (i + 1) + ': leider falsch'), 'Lies die Frage noch einmal und überlege, was passiert, wenn der Inhalt in falsche Hände gerät.')); return L; },
        sol: () => { const a = {}; DATA_Q.forEach((q, i) => { a['q' + i] = q.r; }); W.S.answers.ap16 = a; } },
      { id: 'ap17', lab: 'app', cat: 'Stufe 6: Projekt', title: 'Projekt: Lernapp für die Klasse', level: 3, kind: 'app',
        text: 'Baue eine eigene Lernapp für deine Klasse zu einem Thema, das dir wichtig ist (Quiz, Trainer, Rechner oder Karteikarten). Speichere sie in der Bibliothek und schreibe eine Notiz „Beschreibung: <Name der App>“ mit mindestens 60 Zeichen: Was kann die App, wie bedient man sie, woher stammen die Inhalte. Die App muss ohne Fehler laufen, mindestens drei Knöpfe oder Eingabefelder haben und ohne Internet funktionieren.',
        hint: 'Gehe die Stufen durch: Auftrag schreiben, Code testen, Fehler an die KI melden, Inhalte prüfen, speichern, beschreiben. Dein Ausbilder kann sie danach der Klasse zur Verfügung stellen.',
        check: async () => { const L = [], lib = W.lib(); if (!lib.length) return [RES(false, 'Speichere deine App zuerst in der Bibliothek')]; const app = lib[lib.length - 1], r = await run(app.html, []), f = r.facts; okApp(f, L); L.push(RES(f.nButtons + f.nInputs >= 3, f.nButtons + f.nInputs >= 3 ? (f.nButtons + f.nInputs) + ' Knöpfe und Eingabefelder' : 'Es werden mindestens drei Knöpfe oder Eingabefelder erwartet')); L.push(RES(f.title && f.title.length >= 3, f.title ? 'Titel: ' + f.title : 'Die App hat keinen Titel (<title>)')); const nn = W.notes().find(n => (n.title || '').toLowerCase().startsWith('beschreibung') && (n.title || '').toLowerCase().includes((app.name || '').toLowerCase())); L.push(RES(!!nn && (nn.text || '').trim().length >= 60, nn ? ((nn.text || '').trim().length >= 60 ? 'Die Beschreibung ist da' : 'Die Beschreibung ist zu kurz (mindestens 60 Zeichen)') : 'Es fehlt eine Notiz „Beschreibung: ' + app.name + '“', 'Titel genau so: Beschreibung: ' + app.name)); return L; },
        sol: () => { W.setLib([{ id: 'sol2', name: 'Ohm-Rechner', html: SAMPLES.quiz, t: 0 }]); W.setNotes([{ id: 'sol9', title: 'Beschreibung: Ohm-Rechner', text: 'Diese App stellt zehn Fragen zur Elektrotechnik. Man tippt die Antwort an und sieht sofort, ob sie stimmt. Die Fragen stammen aus dem Lernheft.', t: 0 }]); } }
    ];

    return { SAMPLES, TASKS, BAD_PROMPT, KI_TEXT, DATA_Q, KIQ, kartenApp, notesSol };
  };
})(window);
