'use strict';
/* Tonfunk Lab: Sprachsteuerung (optional). Mikrofon-Knopf, deutsche Befehle wie „starte Simulation“, „setze einen Widerstand“,
   „Wert 4,7 Kiloohm“. Die Spracherkennung macht der Browser des Geräts (bei iPad und Chrome meist über einen Online-Dienst):
   deshalb nur nach ausdrücklicher Zustimmung. Befehle lassen sich auch als Text prüfen: Voice.handle('starte simulation'). */
(function (root) {
  const SR = root.SpeechRecognition || root.webkitSpeechRecognition;
  const $ = s => document.querySelector(s);
  const toast = t => { if (root.LabUI && root.LabUI.toast) root.LabUI.toast(t); };
  const V = () => root.LabVoiceAPI || {}, T = () => root.LabTrainerAPI || {};
  const KIND = { widerstand: 'R', poti: 'POT', potentiometer: 'POT', kondensator: 'C', elko: 'CE', spule: 'L', diode: 'D', 'z diode': 'ZD', zenerdiode: 'ZD', led: 'LED', batterie: 'BAT', spannungsquelle: 'BAT', masse: 'GND', schalter: 'SPST', taster: 'PB', lampe: 'LAMP', glühlampe: 'LAMP', gluehlampe: 'LAMP', transistor: 'NPN', relais: 'RLY', sicherung: 'FUSE', motor: 'MOTOR', lautsprecher: 'SPK', fotowiderstand: 'LDR', ldr: 'LDR', ntc: 'NTC', trafo: 'TRF', transformator: 'TRF' };
  const NUM = { null: 0, eins: 1, ein: 1, eine: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, fuenf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12, zwoelf: 12, zwanzig: 20, fünfzig: 50, fuenfzig: 50, hundert: 100, tausend: 1000 };
  const norm = t => String(t || '').toLowerCase().replace(/(\d),(\d)/g, '$1.$2').replace(/[,!?;:]/g, ' ').replace(/\.(?!\d)/g, ' ').replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  /* Wert aus gesprochenem Text: „4.7 kiloohm“, „zehn kilo ohm“, „100 nanofarad“, „220 mikrofarad“, „9 volt“ */
  function parseValue(t) {
    t = norm(t); let n = null; const m = t.match(/(\d+(?:\.\d+)?)/);
    if (m) n = parseFloat(m[1]); else { for (const w of t.split(' ')) if (NUM[w] != null) { n = NUM[w]; break; } }
    if (n == null) return null;
    let suf = ''; if (/kilo|\bk\b|kohm/.test(t)) suf = 'k'; else if (/mega/.test(t)) suf = 'M'; else if (/nano/.test(t)) suf = 'n'; else if (/mikro|micro/.test(t)) suf = 'u'; else if (/pico|piko/.test(t)) suf = 'p'; else if (/milli/.test(t)) suf = 'm';
    return String(n) + suf;
  }
  const click = id => { const e = $(id); if (e) { e.click(); return true; } return false; };
  const RULES = [
    [/(starte|start|schalte|aktiviere|beginne).*(simulation|sim)\b|^simulation (an|ein|starten)/, () => { const t = T(); if (t.simMode && t.simMode()) return 'Die Simulation läuft schon.'; return click('#bSim') ? 'Simulation an' : null; }],
    [/(stoppe|beende|schalte|deaktiviere|verlasse).*(simulation|sim)( aus)?\b|^simulation (aus|beenden)|zurück zum zeichnen|zeichenmodus/, () => { const t = T(); if (t.simMode && !t.simMode()) return 'Du bist schon im Zeichenmodus.'; return click('#bSim') ? 'Zeichenmodus' : null; }],
    [/^(pause|halt|anhalten|stopp)\b|pausiere/, () => { const t = T(); if (t.running && t.running()) { click('#bRun'); return 'Pause'; } return t.simMode && t.simMode() ? 'Die Simulation steht schon.' : 'Erst die Simulation starten.'; }],
    [/^(weiter|fortsetzen|play|los)\b|simulation weiter/, () => { const t = T(); if (t.simMode && t.simMode() && t.running && !t.running()) { click('#bRun'); return 'Weiter'; } return 'Es läuft schon oder die Simulation ist aus.'; }],
    [/rückgängig|rueckgaengig|schritt zurück(?! in der zeit)|mach das rückgängig/, () => click('#bUndo') ? 'Rückgängig' : null],
    [/wiederholen|wiederherstellen|schritt vor\b/, () => click('#bRedo') ? 'Wiederholt' : null],
    [/wasser/, () => { const v = V(); if (!v.toggleWater) return 'Die Wasser-Ansicht gibt es hier nicht.'; const on = v.toggleWater(); return on ? 'Wasser-Ansicht an' : 'Wasser-Ansicht aus'; }],
    [/(zeitreise|spule|spul).*(zurück|rückwärts)|zeit zurück/, () => { const v = V(); return v.tlBack && v.tlBack() ? 'Zeitreise zurück' : 'Zeitreise geht nur in der laufenden Simulation.'; }],
    [/(zeitreise|spule|spul).*(vor|schritt|weiter)|zeit vor/, () => { const v = V(); return v.tlFwd && v.tlFwd() ? 'Ein Schritt vor' : 'Zeitreise geht nur in der laufenden Simulation.'; }],
    [/erkläre? (dich|das|mir das|das bauteil)|erklär mal/, () => { const v = V(); return v.speakSel && v.speakSel() ? 'Das Bauteil erklärt sich' : 'Erst ein Bauteil antippen.'; }],
    [/(wert|stelle|setze).* (?:auf|wert) (.+)|^wert (.+)/, (m, x, full) => { const val = parseValue(full.replace(/^.*?wert/, '')); const v = V(); if (!val) return 'Den Wert habe ich nicht verstanden. Sag zum Beispiel „Wert 4,7 Kiloohm“.'; return v.setValue && v.setValue(val) ? 'Wert ' + val : 'Erst ein Bauteil antippen.'; }],
    [/(setze|platziere|nimm|neuer|neue|neues|füge).*?(widerstand|poti|potentiometer|kondensator|elko|spule|diode|z diode|zenerdiode|led|batterie|spannungsquelle|masse|schalter|taster|lampe|glühlampe|gluehlampe|transistor|relais|sicherung|motor|lautsprecher|fotowiderstand|ldr|ntc|trafo|transformator)/, (m, name) => { const v = V(), k = KIND[name]; if (!v.place) return 'Bauteile setzen geht hier nicht per Sprache.'; return v.place(k) ? (/^(led|ldr|ntc)$/.test(name) ? name.toUpperCase() : name.charAt(0).toUpperCase() + name.slice(1)) + ' gewählt. Tippe auf die Fläche zum Absetzen.' : 'Dieses Bauteil gibt es in diesem Lab nicht.'; }],
    [/einpassen|alles zeigen|ansicht anpassen|zoom/, () => { const v = V(); return v.fit && v.fit() ? 'Eingepasst' : null; }],
    [/(öffne|zeige|zeig).*(menü|menue)|^menü/, () => click('#bMenu') ? 'Menü' : null],
    [/beispiel/, () => click('#bEx') ? 'Beispiele' : null],
    [/aufgabe(?!n.*tag)|aufgaben/, () => click('#bTasks') ? 'Aufgaben' : null],
    [/tagesaufgabe/, () => { const v = V(); return v.menu && v.menu('tag') ? 'Tagesaufgabe' : 'Die Tagesaufgabe gibt es im SchaltLab.'; }],
    [/trainer|erste schritte|einführung|hilfe/, () => { if (root.Trainer) { root.Trainer.start(); return 'Trainer'; } return null; }],
    [/tonwerkstatt|klavier/, () => { if (root.Tonwerkstatt) { root.Tonwerkstatt.open(); return 'Tonwerkstatt'; } return null; }],
    [/löt|loet/, () => { if (root.Loetuebung) { root.Loetuebung.open(); return 'Lötübung'; } return null; }],
    [/oszi/, () => { if (root.Oszi) { root.Oszi.open(); return 'Oszilloskop-Trainer'; } return null; }],
    [/was ist neu|neu in dieser version|neuigkeiten/, () => { if (root.LabNeu) { root.LabNeu(); return 'Neu in dieser Version'; } return null; }],
    [/abzeichen/, () => { if (root.Badges) { root.Badges.open(); return 'Abzeichen'; } return null; }]
  ];
  const HELP = ['„Starte Simulation“, „Stoppe Simulation“, „Pause“, „Weiter“', '„Setze einen Widerstand“ (oder Kondensator, LED, Batterie, Schalter, Lampe …), dann auf die Fläche tippen', '„Wert 4,7 Kiloohm“, „Wert 100 Nanofarad“ für das gewählte Bauteil', '„Rückgängig“, „Wiederholen“, „Einpassen“', '„Wasser-Ansicht“, „Zeitreise zurück“, „Erkläre dich“', '„Menü“, „Beispiele“, „Aufgaben“, „Trainer“, „Tonwerkstatt“, „Lötübung“, „Oszilloskop“, „Was ist neu“, „Abzeichen“'];
  function handle(text) {
    const list = Array.isArray(text) ? text : [text];
    for (const raw of list) {
      const t = norm(raw); if (!t) continue;
      for (const [re, fn] of RULES) { const m = t.match(re); if (m) { let r; try { r = fn(m, m[m.length - 1], t); } catch (e) { r = null; } if (r) return { ok: true, said: raw, msg: r }; } }
    }
    return { ok: false, said: list[0] || '', msg: 'Nicht verstanden.' };
  }
  /* ---------- Oberfläche ---------- */
  let btn = null, bub = null, rec = null, listening = false;
  const enabled = () => { try { return localStorage.getItem('lm4.voice') === '1'; } catch (e) { return false; } };
  function show(msg, ok) {
    if (!bub) { bub = document.createElement('div'); bub.style.cssText = 'position:fixed;left:12px;right:12px;bottom:128px;margin:auto;max-width:420px;z-index:61;background:#1f262e;color:#e8eaed;border:2px solid #38424d;border-radius:12px;padding:10px 14px;font:14px/1.4 system-ui;box-shadow:0 6px 20px rgba(0,0,0,.5);text-align:center'; document.body.appendChild(bub); }
    bub.style.borderColor = ok === false ? '#ffb020' : ok ? '#5ee27d' : '#38424d'; bub.textContent = msg; bub.style.display = 'block'; clearTimeout(show.t); show.t = setTimeout(() => { if (bub) bub.style.display = 'none'; }, 4200);
  }
  function listen() {
    if (!SR) { toast('Dieser Browser kann leider keine Sprache erkennen.'); return; }
    if (listening) { try { rec.stop(); } catch (e) {} return; }
    rec = new SR(); rec.lang = 'de-DE'; rec.interimResults = false; rec.maxAlternatives = 3; rec.continuous = false;
    rec.onstart = () => { listening = true; btn.style.background = '#e53935'; show('Ich höre zu …'); };
    rec.onend = () => { listening = false; btn.style.background = '#2c343e'; };
    rec.onerror = e => { listening = false; btn.style.background = '#2c343e'; show(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'Mikrofon nicht erlaubt. Bitte im Browser freigeben.' : e.error === 'no-speech' ? 'Ich habe nichts gehört.' : 'Spracherkennung nicht möglich (' + e.error + ').', false); };
    rec.onresult = ev => { const alts = []; for (let i = 0; i < ev.results[0].length; i++) alts.push(ev.results[0][i].transcript); const r = handle(alts); show((r.ok ? '✓ ' : '✗ ') + '„' + r.said + '“ → ' + r.msg, r.ok); };
    try { rec.start(); } catch (e) { show('Konnte das Mikrofon nicht starten.', false); }
  }
  function ensureBtn() {
    if (btn) { btn.style.display = enabled() ? 'block' : 'none'; return; }
    btn = document.createElement('button'); btn.type = 'button'; btn.setAttribute('aria-label', 'Sprachsteuerung'); btn.title = 'Sprachbefehl geben';
    btn.style.cssText = 'position:fixed;left:12px;bottom:72px;z-index:61;width:48px;height:48px;border-radius:24px;border:1px solid #38424d;background:#2c343e;color:#fff;font-size:22px;cursor:pointer;padding:0;box-shadow:0 4px 14px rgba(0,0,0,.4)';
    btn.textContent = '🎤'; btn.onclick = listen; document.body.appendChild(btn); btn.style.display = enabled() ? 'block' : 'none';
  }
  function toggle() {
    if (enabled()) { try { localStorage.setItem('lm4.voice', '0'); } catch (e) {} ensureBtn(); toast('Sprachsteuerung aus'); return; }
    if (!SR) { toast('Dieser Browser kann leider keine Sprache erkennen. Probiere Safari oder Chrome.'); return; }
    const w = document.createElement('div'); w.style.cssText = 'position:fixed;inset:0;z-index:95;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;padding:16px';
    w.innerHTML = `<div style="background:#1f262e;color:#e8eaed;border:1px solid #38424d;border-radius:14px;padding:16px;max-width:460px;width:100%;font:15px/1.45 system-ui"><b style="font-size:18px">🎤 Sprachsteuerung</b><p>Mit dem Mikrofon-Knopf gibst du kurze Befehle, zum Beispiel:</p><ul style="margin:0 0 8px;padding-left:20px;font-size:14px">${HELP.map(h => '<li>' + h + '</li>').join('')}</ul><p style="color:#ffd37a;font-size:13px"><b>Datenschutz:</b> Die Spracherkennung übernimmt der Browser deines Geräts. Dabei kann die Aufnahme an einen Online-Dienst (Apple oder Google) gehen. Das Lab selbst speichert nichts. Schalte sie nur ein, wenn das für dich in Ordnung ist.</p><div style="display:flex;gap:8px"><button id="vOk" style="background:#ff9d00;border:0;border-radius:9px;padding:10px 16px;font-weight:700;cursor:pointer">Einschalten</button><button id="vNo" style="background:#2c343e;color:#e8eaed;border:1px solid #38424d;border-radius:9px;padding:10px 16px;cursor:pointer">Abbrechen</button></div></div>`;
    document.body.appendChild(w);
    w.querySelector('#vOk').onclick = () => { try { localStorage.setItem('lm4.voice', '1'); } catch (e) {} w.remove(); ensureBtn(); toast('Sprachsteuerung an: Mikrofon-Knopf unten links'); };
    w.querySelector('#vNo').onclick = () => w.remove();
  }
  root.Voice = { toggle, handle, listen, enabled, parseValue, HELP };
  const init = () => { if (enabled()) ensureBtn(); };
  if (document.body) init(); else document.addEventListener('DOMContentLoaded', init);
})(typeof window !== 'undefined' ? window : globalThis);
