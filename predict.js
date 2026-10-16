/* Vorhersage-Modus (alle Labs): Vor dem Start der Simulation tippt man, was passieren wird (LED leuchtet? Lampe brennt? Relais zieht an?).
   Danach läuft die Simulation und zeigt, ob man recht hatte. Punktestand in „lm4.predict“, gute Serien geben das Abzeichen „Hellseher“. */
(function () {
  var get = function (k, d) { try { var v = JSON.parse(localStorage.getItem(k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  var set = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function ui() { return { sheet: (window.LabUI && window.LabUI.sheet) || window.sheet, toast: (window.LabUI && window.LabUI.toast) || window.toast || function () {} }; }
  function on() { try { return localStorage.getItem('lm4.predict') === '1'; } catch (e) { return false; } }
  function setOn(v) { try { localStorage.setItem('lm4.predict', v ? '1' : '0'); } catch (e) {} }
  function toggle() { var v = !on(); setOn(v); ui().toast(v ? 'Vorhersage-Modus an: Vor jedem Start tippst du, was passiert' : 'Vorhersage-Modus aus'); return v; }
  var busy = false;
  /* qs: [{id, text}], start(): Simulation starten, read(): {id: true/false} Momentaufnahme, ready(): läuft die Simulation schon lange genug? */
  function run(qs, start, read, ready) {
    if (busy) { start(); return; }
    var u = ui();
    u.sheet('Was wird passieren?', function (b, close) {
      var ans = {};
      b.innerHTML = '<p style="margin-top:0">Bevor es losgeht: Was glaubst du, passiert in der Schaltung? Danach siehst du, ob du recht hattest.</p>' +
        qs.map(function (q, i) { return '<div class="card" style="margin:8px 0;padding:10px"><b>' + esc(q.text) + '</b><div style="display:flex;gap:8px;margin-top:8px"><button class="btn" data-q="' + i + '" data-v="1" style="flex:1">Ja</button><button class="btn" data-q="' + i + '" data-v="0" style="flex:1">Nein</button></div></div>'; }).join('') +
        '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn pri" id="pGo" disabled>Simulation starten</button><button class="btn" id="pSkip">Ohne Vorhersage starten</button></div><p class="hint2">Den Vorhersage-Modus schaltest du im Menü ein und aus.</p>';
      var go = b.querySelector('#pGo');
      b.addEventListener('click', function (ev) {
        var t = ev.target.closest('[data-q]'); if (!t) return; var i = +t.dataset.q; ans[i] = t.dataset.v === '1';
        b.querySelectorAll('[data-q="' + i + '"]').forEach(function (x) { var sel = x === t; x.classList.toggle('pri', sel); });
        go.disabled = Object.keys(ans).length < qs.length;
      });
      b.querySelector('#pSkip').onclick = function () { close(); start(); };
      go.onclick = function () { close(); begin(qs, ans, start, read, ready); };
    });
  }
  function begin(qs, ans, start, read, ready) {
    busy = true; start();
    var seen = {}, t0 = Date.now(), rdyAt = 0;
    var iv = setInterval(function () {
      var s; try { s = read(); } catch (e) { s = {}; }
      qs.forEach(function (q) { if (s[q.id]) seen[q.id] = true; });
      var rd = false; try { rd = ready(); } catch (e) {}
      if (rd && !rdyAt) rdyAt = Date.now();
      if ((rdyAt && Date.now() - rdyAt > 500) || Date.now() - t0 > 9000) { clearInterval(iv); busy = false; show(qs, ans, seen); }
    }, 120);
  }
  function show(qs, ans, seen) {
    var P = get('lm4.predictstats', { right: 0, total: 0, streak: 0, best: 0 }), ok = 0;
    var rows = qs.map(function (q, i) { var real = !!seen[q.id], right = real === ans[i]; if (right) ok++; return { q: q, real: real, mine: ans[i], right: right }; });
    rows.forEach(function (r) { P.total++; if (r.right) { P.right++; P.streak++; if (P.streak > P.best) P.best = P.streak; } else P.streak = 0; });
    set('lm4.predictstats', P);
    if (window.Badges) { window.Badges.stat('predictRight', ok); window.Badges.stat('predictBest', P.best, 'max'); }
    if (ok === qs.length && window.Badges) { window.Badges.confetti(false); window.Badges.chime(false); }
    ui().sheet(ok === qs.length ? 'Alles richtig vorhergesagt!' : 'Vorhersage ausgewertet', function (b) {
      b.innerHTML = rows.map(function (r) { return '<div class="card" style="margin:8px 0;padding:10px;border-left:4px solid ' + (r.right ? '#2fae45' : '#e05050') + '"><b>' + (r.right ? '✓ ' : '✗ ') + esc(r.q.text) + '</b><div class="hint2" style="margin:4px 0 0">Du hast „' + (r.mine ? 'Ja' : 'Nein') + '“ getippt, in der Simulation ist es „' + (r.real ? 'Ja' : 'Nein') + '“.</div></div>'; }).join('') +
        '<p style="margin-bottom:4px"><b>Punktestand:</b> ' + P.right + ' von ' + P.total + ' richtig, aktuelle Serie ' + P.streak + ', beste Serie ' + P.best + '.</p>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="pOff">Vorhersage ausschalten</button></div>';
      b.querySelector('#pOff').onclick = function () { setOn(false); ui().toast('Vorhersage-Modus aus'); };
    });
  }
  window.Predict = { on: on, set: setOn, toggle: toggle, run: run };
})();
